import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { createDatabase, ids, puzzles, rpc, migration, pauseMigration } from './database.mjs';
import { importPuzzles, validatePuzzles } from '../scripts/import-puzzles.mjs';

const denied = promise => assert.rejects(promise, error => error.code === '42501');
test('legacy export preserves retained published puzzles without overwriting private data', async () => {
  const privateRoot = fileURLToPath(new URL('../private/', import.meta.url));
  await mkdir(privateRoot, { recursive: true });
  const work = await mkdtemp(join(privateRoot, 'legacy-export-test-'));
  const script = fileURLToPath(new URL('../scripts/export-legacy-puzzles.mjs', import.meta.url));
  const run = promisify(execFile);
  try {
    await run(process.execPath, [script], { cwd: work });
    const seed = join(work, 'private', 'puzzles.json');
    const original = await readFile(seed, 'utf8');
    const rows = JSON.parse(original);
    validatePuzzles(rows);
    assert.equal(rows.length, 11);
    assert(!rows.some(p => p.date === '2026-09-15' || p.legacyId === '2026-09-15-court-blocks-mail-ballot-limits'));
    assert.equal((await stat(seed)).mode & 0o777, 0o600);
    await assert.rejects(run(process.execPath, [script], { cwd: work }), /EEXIST/);
    assert.equal(await readFile(seed, 'utf8'), original);
  } finally { await rm(work, { recursive: true, force: true }); }
});

test('Supabase game SQL on PostgreSQL with separate authenticated connections', async t => {
  const db = await createDatabase();
  try {
    const anon = await db.clientFor(null, 'anon');
    const alice = await db.clientFor(ids.alice), aliceTab = await db.clientFor(ids.alice);
    const bob = await db.clientFor(ids.bob);
    await t.test('users created before the profiles trigger are backfilled safely', async () => {
      const profiles = (await db.admin.query(`select id, username from public.profiles
        where id = any($1::uuid[]) order by username`, [[ids.preexistingAccount, ids.preexistingGuest]])).rows;
      assert.deepEqual(profiles, [
        { id: ids.preexistingAccount, username: 'existing' },
        { id: ids.preexistingGuest, username: 'existing-30000002' },
      ]);
    });
    await t.test('confirmed contact email stays synchronized to the private profile', async () => {
      await db.admin.query('update auth.users set email = $1 where id = $2', ['alice+confirmed@example.com', ids.alice]);
      const profile = (await db.admin.query('select email from public.profiles where id = $1', [ids.alice])).rows[0];
      assert.equal(profile.email, 'alice+confirmed@example.com');
    });
    await t.test('anonymous catalog and leaderboard expose no puzzle secrets or owners', async () => {
      const catalog = await rpc(anon, 'list_puzzles');
      assert.deepEqual(catalog.map(p => p.id), [ids.daily, ids.archive]);
      assert.deepEqual(Object.keys(catalog[0]).sort(), ['category', 'date', 'id']);
      const board = await rpc(anon, 'get_leaderboard', [ids.daily]);
      assert.deepEqual(board.map(r => r.time_seconds), [1, 2]);
      assert(board.every(r => r.verified === false && !('user_id' in r) && !('puzzle_id' in r)));
      assert.deepEqual(await rpc(anon, 'get_leaderboard', [ids.future]), []);
      for (const name of ['start_puzzle', 'submit_word', 'reveal_hint', 'get_my_progress']) {
        const args = name === 'get_my_progress' ? [] : name === 'start_puzzle' ? [ids.daily] : name === 'reveal_hint' ? [ids.daily, 0] : [ids.daily, 0, 'HIDDEN'];
        await denied(rpc(anon, name, args));
      }
    });
    await t.test('table grants, old permissive policies, private functions, and legacy claiming are closed', async () => {
      for (const client of [anon, alice]) {
        for (const table of ['public.solves', 'public.progress', 'private.puzzles', 'private.puzzle_legacy_ids', 'private.attempts', 'private.word_limits']) {
          await denied(client.query(`select * from ${table}`));
          await denied(client.query(`delete from ${table}`));
        }
        await denied(client.query('select private.game_state($1, $2)', [ids.bob, ids.daily]));
        await denied(client.query('insert into public.solves(puzzle_id, display_name, time_seconds, verified) values($1, $2, 0, true)', [ids.daily, 'forged']));
        await denied(client.query('update public.solves set time_seconds = 0, verified = true'));
        await denied(client.query('insert into public.progress(user_id, puzzle_id, time_seconds) values($1, $2, 0)', [ids.alice, ids.daily]));
        await assert.rejects(client.query('select public.claim_solves($1::uuid[])', [[randomUUID()]]), { code: '42883' });
      }
      assert.equal((await db.admin.query("select count(*)::int as n from pg_policies where schemaname='public' and tablename in ('solves','progress')")).rows[0].n, 0);
      await assert.rejects(rpc(alice, 'start_puzzle', [ids.future]), { code: 'P0002' });
      await assert.rejects(rpc(bob, 'submit_word', [ids.daily, 0, 'HIDDEN']), { code: 'P0002' });
    });
    await t.test('guests can play the current puzzle but archived puzzles require an account', async () => {
      const guestId = randomUUID();
      await db.admin.query('insert into auth.users(id, email, raw_user_meta_data) values($1, $2, $3)', [guestId, '', { username: 'daily-guest' }]);
      const guest = await db.clientFor(guestId, 'authenticated', true);
      const daily = await rpc(guest, 'start_puzzle', [ids.daily]);
      assert.equal(daily.id, ids.daily);
      await assert.rejects(rpc(guest, 'start_puzzle', [ids.archive]), { code: 'P0003' });
    });
    await t.test('concurrent starts persist one start time; word and hint responses reveal only earned data', async () => {
      const [a, b] = await Promise.all([rpc(alice, 'start_puzzle', [ids.daily]), rpc(aliceTab, 'start_puzzle', [ids.daily])]);
      assert.equal(a.startedAt, b.startedAt); assert.equal(a.result, null);
      assert(a.words.every(w => w.acceptedAnswer === null && w.hint === null && !('answer' in w)));
      assert.equal(a.words[0].answerLength, 6);
      const wrong = await rpc(alice, 'submit_word', [ids.daily, 0, 'WRONG']);
      assert.equal(wrong.correct, false); assert.equal(wrong.state.completed, false);
      const correct = await rpc(alice, 'submit_word', [ids.daily, 0, 'hidden']);
      assert.equal(correct.correct, true); assert.equal(correct.state.words[0].acceptedAnswer, 'HIDDEN');
      assert.equal(correct.state.words[1].acceptedAnswer, null);
      const [h1, h2] = await Promise.all([rpc(alice, 'reveal_hint', [ids.daily, 1]), rpc(aliceTab, 'reveal_hint', [ids.daily, 1])]);
      assert.equal(h1.hintsUsed, 1); assert.equal(h2.hintsUsed, 1);
      assert.equal(h1.words[0].hint, null); assert.equal(h1.words[1].hint, puzzles[0].hints[1]);
      const resumed = await rpc(aliceTab, 'start_puzzle', [ids.daily]);
      assert.equal(resumed.startedAt, a.startedAt); assert.equal(resumed.words[0].acceptedAnswer, 'HIDDEN');
      await assert.rejects(rpc(alice, 'submit_word', [ids.daily, 0, 'X'.repeat(129)]), { code: '22023' });
      await assert.rejects(rpc(alice, 'reveal_hint', [ids.daily, -1]), { code: '22023' });
      const independent = await rpc(bob, 'start_puzzle', [ids.daily]);
      assert.equal(independent.words[0].acceptedAnswer, null); assert.equal(independent.hintsUsed, 0);
    });
    await t.test('pausing freezes server time and resuming excludes the paused interval', async () => {
      await db.admin.query("update private.attempts set started_at = clock_timestamp() - interval '120 seconds' where user_id = $1 and puzzle_id = $2", [ids.bob, ids.daily]);
      const paused = await rpc(bob, 'pause_puzzle', [ids.daily]);
      assert.equal(paused.paused, true); assert(paused.elapsedSeconds >= 120 && paused.elapsedSeconds < 123);
      await db.admin.query("update private.attempts set started_at = started_at - interval '30 seconds', paused_at = paused_at - interval '30 seconds' where user_id = $1 and puzzle_id = $2", [ids.bob, ids.daily]);
      const resumed = await rpc(bob, 'start_puzzle', [ids.daily]);
      assert.equal(resumed.paused, false);
      assert(resumed.elapsedSeconds >= paused.elapsedSeconds && resumed.elapsedSeconds <= paused.elapsedSeconds + 1);
    });
    await t.test('concurrent final checks produce one immutable, server-timed solve and progress row', async () => {
      await db.admin.query("update private.attempts set started_at = clock_timestamp() - interval '90 seconds' where user_id = $1", [ids.alice]);
      const [a, b] = await Promise.all([rpc(alice, 'submit_word', [ids.daily, 1, 'NEWS']), rpc(aliceTab, 'submit_word', [ids.daily, 1, 'NEWS'])]);
      assert(a.state.completed && a.state.result.verified);
      assert.deepEqual(a.state.result, b.state.result);
      assert(a.state.result.timeSeconds >= 90 && a.state.result.timeSeconds < 95);
      assert.equal(a.state.result.headline, puzzles[0].headline); assert.equal(a.state.hintsUsed, 1);
      const repeated = await rpc(alice, 'submit_word', [ids.daily, 1, 'NEWS']);
      assert.deepEqual(repeated.state.result, a.state.result);
      const afterHint = await rpc(alice, 'reveal_hint', [ids.daily, 0]);
      assert.equal(afterHint.hintsUsed, 1); assert.equal(afterHint.words[0].hint, null);
      for (const table of ['solves', 'progress']) assert.equal((await db.admin.query(`select count(*)::int n from public.${table} where user_id=$1 and puzzle_id=$2`, [ids.alice, ids.daily])).rows[0].n, 1);
      const progress = await rpc(alice, 'get_my_progress'); assert.equal(progress.length, 1); assert.equal(progress[0].rowId, a.state.result.rowId);
      assert.deepEqual(await rpc(bob, 'get_my_progress'), []);
    });
    await t.test('legacy rankings survive import, ownership stays fixed, and completions cannot replay', async () => {
      const legacy = await db.clientFor(ids.legacy), cloud = await db.clientFor(ids.cloud);
      const old = await rpc(legacy, 'start_puzzle', [ids.daily]);
      assert(old.completed && !old.result.verified); assert.equal(old.result.timeSeconds, 2); assert.equal(old.startedAt, null);
      const cloudOnly = await rpc(cloud, 'start_puzzle', [ids.daily]);
      assert(cloudOnly.completed && !cloudOnly.result.verified); assert.equal(cloudOnly.result.rowId, null);
      assert.equal((await rpc(anon, 'get_leaderboard', [ids.daily])).length, 3);
      await assert.rejects(rpc(legacy, 'submit_word', [ids.daily, 0, 'HIDDEN']), { code: 'P0002' });
      const anonymous = (await db.admin.query("select user_id from public.solves where display_name='anonymous-old'")).rows[0];
      assert.equal(anonymous.user_id, null);
    });
    await t.test('60 checks per account/minute across puzzles; rejected checks preserve state', async () => {
      const id = randomUUID();
      await db.admin.query('insert into auth.users(id, email, raw_user_meta_data) values($1, $2, $3)', [id, 'rate@example.com', { username: 'rate' }]);
      const client = await db.clientFor(id), tab = await db.clientFor(id);
      await rpc(client, 'start_puzzle', [ids.daily]); await rpc(client, 'start_puzzle', [ids.archive]);
      await Promise.all([client, tab].map(async (connection, i) => {
        for (let n = 0; n < 30; n++) await rpc(connection, 'submit_word', [i ? ids.daily : ids.archive, 0, 'nope']);
      }));
      const blocked = await rpc(client, 'submit_word', [ids.daily, 0, 'HIDDEN']);
      assert(blocked.retryAfterSeconds >= 1 && blocked.retryAfterSeconds <= 60); assert.equal(blocked.state, undefined);
      assert.equal((await rpc(client, 'start_puzzle', [ids.daily])).words[0].acceptedAnswer, null);
      await db.admin.query("update private.word_limits set window_start = clock_timestamp() - interval '61 seconds' where user_id = $1", [id]);
      assert.equal((await rpc(client, 'submit_word', [ids.daily, 0, 'HIDDEN'])).correct, true);
    });
    await t.test('archive uses identical validation and migration/import reruns preserve verified results', async () => {
      await rpc(bob, 'start_puzzle', [ids.archive]);
      await rpc(bob, 'submit_word', [ids.archive, 0, 'PRIVATE']);
      const solved = await rpc(bob, 'submit_word', [ids.archive, 1, 'STORY']);
      assert(solved.state.completed && solved.state.result.verified);
      await db.admin.query(migration); await db.admin.query(pauseMigration); await importPuzzles(db.admin, puzzles);
      const accounts = await readFile(new URL('../supabase/2026-09-05-accounts.sql', import.meta.url), 'utf8');
      await assert.rejects(db.admin.query(accounts), /do not reapply/);
      await db.admin.query('rollback');
      await denied(alice.query('select * from public.solves'));
      assert.deepEqual((await rpc(bob, 'start_puzzle', [ids.archive])).result, solved.state.result);
      const changed = structuredClone(puzzles); changed[0].words[0].answer = 'CHANGED';
      await assert.rejects(importPuzzles(db.admin, changed), /Cannot change a puzzle after play/);
      assert.equal((await rpc(alice, 'start_puzzle', [ids.daily])).words[0].acceptedAnswer, 'HIDDEN');
      assert.throws(() => validatePuzzles([{ ...puzzles[0], date: '2000-02-30' }]), /dates/);
    });
  } finally { await db.stop(); }
});
