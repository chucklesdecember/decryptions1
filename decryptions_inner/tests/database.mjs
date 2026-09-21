import EmbeddedPostgres from 'embedded-postgres';
import pg from 'pg';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import net from 'node:net';
import { importPuzzles } from '../scripts/import-puzzles.mjs';

export const ids = {
  daily: '10000000-0000-4000-8000-000000000001',
  archive: '10000000-0000-4000-8000-000000000002',
  future: '10000000-0000-4000-8000-000000000003',
  alice: '20000000-0000-4000-8000-000000000001',
  bob: '20000000-0000-4000-8000-000000000002',
  legacy: '20000000-0000-4000-8000-000000000003',
  cloud: '20000000-0000-4000-8000-000000000004',
  preexistingAccount: '30000001-0000-4000-8000-000000000001',
  preexistingGuest: '30000002-0000-4000-8000-000000000002',
};
// Synthetic data only. Actual puzzle seeds must stay in ignored private storage.
export const puzzles = [
  { id: ids.daily, legacyId: '2000-01-02-hidden-news', date: '2000-01-02', category: 'Test', headline: 'Hidden News', articleUrl: 'https://example.com/private-headline',
    words: [{ answer: 'HIDDEN', clues: [{ type: 'text', content: 'HID + DEN' }] }, { answer: 'NEWS', clues: [{ type: 'text', content: 'NEW + S' }] }], hints: ['First private hint', 'Second private hint'] },
  { id: ids.archive, legacyId: '2000-01-01-private-story', date: '2000-01-01', category: 'Test', headline: 'Private Story',
    words: [{ answer: 'PRIVATE', clues: [{ type: 'text', content: 'PRI + VATE' }] }, { answer: 'STORY', clues: [{ type: 'text', content: 'STOR + Y' }] }], hints: ['Archive hint one', 'Archive hint two'] },
  { id: ids.future, date: '2999-01-01', category: 'Future secret category', headline: 'Unpublished Secret',
    words: [{ answer: 'SECRET', clues: [{ type: 'text', content: 'NOT PUBLISHED' }] }], hints: ['Future secret hint'] },
];
export const migration = await readFile(new URL('../supabase/2026-09-06-authoritative-game.sql', import.meta.url), 'utf8');
export const pauseMigration = await readFile(new URL('../supabase/2026-09-21-pausable-timer.sql', import.meta.url), 'utf8');

async function freePort() {
  const server = net.createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}
export async function createDatabase() {
  const dir = await mkdtemp(join(tmpdir(), 'decryptions-pg-'));
  const port = await freePort();
  const logs = [];
  const server = new EmbeddedPostgres({ databaseDir: join(dir, 'data'), port, user: 'postgres', password: 'local-test-only', persistent: false,
    postgresFlags: ['-h', '127.0.0.1', '-k', dir],
    onLog: message => logs.push(String(message)), onError: message => logs.push(String(message)) });
  try { await server.initialise(); await server.start(); }
  catch (err) { console.error(logs.slice(-8).join('\n')); throw err; }
  const options = { host: '127.0.0.1', port, user: 'postgres', password: 'local-test-only', database: 'postgres' };
  const admin = new pg.Client(options); await admin.connect();
  const clients = [];
  try {
    // Minimal Supabase Auth contract. Business SQL is the exact production migration.
    await admin.query(`create role anon nologin; create role authenticated nologin;
      create schema auth;
      create table auth.users(
        id uuid primary key,
        email text,
        raw_user_meta_data jsonb,
        created_at timestamptz not null default now(),
        is_anonymous boolean not null default false
      );
      create function auth.uid() returns uuid language sql stable as
        'select nullif(current_setting(''request.jwt.claim.sub'', true), '''')::uuid';
      create function auth.jwt() returns jsonb language sql stable as
        'select coalesce(nullif(current_setting(''request.jwt.claims'', true), '''')::jsonb, ''{}''::jsonb)';
      grant usage on schema auth, public to anon, authenticated;
      grant execute on function auth.uid(), auth.jwt() to anon, authenticated;
      `);
    await admin.query(await readFile(new URL('../supabase/000-initial-solves.sql', import.meta.url), 'utf8'));
    await admin.query(`
      grant all on public.solves to anon, authenticated;
      alter table public.solves enable row level security;
      create policy old_unknown_write on public.solves for all to anon, authenticated using(true) with check(true);`);
    await admin.query(`insert into auth.users(id, email, raw_user_meta_data, is_anonymous) values
      ($1, 'existing@example.com', '{"username":"existing"}', false),
      ($2, '', '{"username":"existing"}', true)`, [ids.preexistingAccount, ids.preexistingGuest]);
    await admin.query(await readFile(new URL('../supabase/2026-09-05-accounts.sql', import.meta.url), 'utf8'));
    await admin.query(await readFile(new URL('../supabase/2026-09-20-passwordless-auth.sql', import.meta.url), 'utf8'));
    // Supabase usually supplies these grants through default privileges.
    await admin.query('grant select on public.profiles to authenticated; grant all on public.progress to authenticated');
    for (const [name, id] of Object.entries(ids).filter(([name]) => ['alice', 'bob', 'legacy', 'cloud'].includes(name))) {
      await admin.query('insert into auth.users(id, email, raw_user_meta_data) values($1, $2, $3)', [id, `${name}@example.com`, JSON.stringify({ username: name })]);
    }
    await admin.query('alter table public.solves disable trigger solves_set_owner_trg');
    await admin.query(`insert into public.solves(puzzle_id, display_name, time_seconds, user_id) values
      ($1, 'legacy', 2, $2), ($1, 'anonymous-old', 1, null)`, [puzzles[0].legacyId, ids.legacy]);
    await admin.query('alter table public.solves enable trigger solves_set_owner_trg');
    await admin.query(`insert into public.progress(user_id, puzzle_id, time_seconds, hints_used) values($1, $2, 9, 1)`, [ids.cloud, puzzles[0].legacyId]);
    await admin.query(migration);
    await admin.query(await readFile(new URL('../supabase/2026-09-21-guest-archive.sql', import.meta.url), 'utf8'));
    await admin.query(pauseMigration);
    await importPuzzles(admin, puzzles);
    async function clientFor(userId, role = 'authenticated', isAnonymous = false) {
      const client = new pg.Client(options); await client.connect(); clients.push(client);
      await client.query(`set role ${role === 'anon' ? 'anon' : 'authenticated'}`);
      if (userId) {
        await client.query("select set_config('request.jwt.claim.sub', $1, false)", [userId]);
        await client.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify({ sub: userId, is_anonymous: isAnonymous })]);
      }
      return client;
    }
    return { admin, clientFor, options, async stop() {
      await Promise.all(clients.map(c => c.end())); await admin.end(); await server.stop();
    } };
  } catch (err) { await admin.end(); await server.stop(); throw err; }
}
export async function rpc(client, name, args = []) {
  if (!['list_puzzles', 'start_puzzle', 'pause_puzzle', 'submit_word', 'reveal_hint', 'get_my_progress', 'get_leaderboard'].includes(name)) throw new Error('Unknown test RPC');
  const params = args.map((_, i) => `$${i + 1}`).join(',');
  return (await client.query(`select public.${name}(${params}) as result`, args)).rows[0].result;
}
