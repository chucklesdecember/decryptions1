import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import pg from 'pg';

export function validatePuzzles(rows) {
  if (!Array.isArray(rows) || !rows.length) throw new Error('Expected a nonempty puzzle array');
  const ids = new Set(), dates = new Set(), legacyIds = new Set();
  for (const p of rows) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(p.id ?? '') || ids.has(p.id)) throw new Error('Puzzle IDs must be unique UUIDs');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(p.date ?? '') || new Date(p.date).toISOString().slice(0, 10) !== p.date || dates.has(p.date)) throw new Error('Puzzle dates must be unique ISO dates');
    if (p.availableDate != null && (!/^\d{4}-\d{2}-\d{2}$/.test(p.availableDate) || new Date(p.availableDate).toISOString().slice(0, 10) !== p.availableDate || p.availableDate > p.date)) throw new Error('Available date must be a valid ISO date no later than the puzzle date');
    if (typeof p.category !== 'string' || !p.category.trim() || typeof p.headline !== 'string' || !p.headline.trim()) throw new Error('Category and headline are required');
    if (p.articleUrl != null && !/^https?:\/\//.test(p.articleUrl)) throw new Error('Article URL must use HTTP(S)');
    if (!Array.isArray(p.words) || !p.words.length || p.words.length > 30 || !Array.isArray(p.hints) || p.hints.length !== p.words.length) throw new Error('Expected 1–30 words with matching hints');
    for (const [i, w] of p.words.entries()) {
      if (typeof w.answer !== 'string' || !w.answer.length || w.answer.length > 128 || !Array.isArray(w.clues) || !w.clues.length) throw new Error('Invalid puzzle word');
      if (w.acceptedAnswers != null && (!Array.isArray(w.acceptedAnswers) || !w.acceptedAnswers.length
        || w.acceptedAnswers.some(a => typeof a !== 'string' || !a.length || a.length > 128)
        || new Set(w.acceptedAnswers.map(a => a.toLocaleUpperCase('en-US'))).size !== w.acceptedAnswers.length
        || w.acceptedAnswers.some(a => a.toLocaleUpperCase('en-US') === w.answer.toLocaleUpperCase('en-US')))) {
        throw new Error('Accepted answers must be unique nonempty aliases distinct from the canonical answer');
      }
      if (typeof p.hints[i] !== 'string' || !p.hints[i].length) throw new Error('Every word needs a hint');
      for (const c of w.clues) {
        if (!['image', 'text', 'symbol', 'operator'].includes(c.type) || typeof c.content !== 'string' || (c.alt != null && typeof c.alt !== 'string') || (c.layout != null && c.layout !== 'wide')) throw new Error('Invalid clue');
        if (c.type === 'image' && !/^(\/(?!\/)|https?:\/\/)/.test(c.content)) throw new Error('Image URL must be a local path or HTTP(S)');
      }
    }
    if (p.legacyId != null && (typeof p.legacyId !== 'string' || !p.legacyId || legacyIds.has(p.legacyId))) throw new Error('Legacy IDs must be unique strings');
    ids.add(p.id); dates.add(p.date); if (p.legacyId) legacyIds.add(p.legacyId);
  }
}

export async function importPuzzles(client, rows) {
  validatePuzzles(rows);
  await client.query('begin');
  try {
    // Freeze writes during identity migration. This is an administrative import,
    // never an authenticated/anonymous client endpoint.
    await client.query('lock table private.puzzles, private.attempts, public.solves, public.progress in exclusive mode');
    for (const p of rows) {
      const legacy = p.legacyId ? (await client.query('select puzzle_id from private.puzzle_legacy_ids where legacy_id = $1', [p.legacyId])).rows[0] : null;
      const id = legacy?.puzzle_id ?? p.id;
      const old = (await client.query('select * from private.puzzles where id = $1', [id])).rows[0];
      const words = p.words.map(w => ({
        answer: w.answer,
        ...(w.acceptedAnswers == null ? {} : { acceptedAnswers: w.acceptedAnswers }),
        clues: w.clues.map(c => ({ type: c.type, content: c.content, ...(c.alt == null ? {} : { alt: c.alt }), ...(c.layout == null ? {} : { layout: c.layout }) })),
      }));
      if (old) {
        const changed = (await client.query(`select not (publish_date = $2::date and available_on is not distinct from $3::date
          and category = $4 and headline = $5 and article_url is not distinct from $6
          and words = $7::jsonb and hints = $8::jsonb) as changed
          from private.puzzles where id = $1`, [id, p.date, p.availableDate ?? null, p.category, p.headline, p.articleUrl ?? null, JSON.stringify(words), JSON.stringify(p.hints)])).rows[0].changed;
        if (changed && (await client.query(`select exists(select 1 from private.attempts where puzzle_id = $1::uuid)
          or exists(select 1 from public.solves where puzzle_id = $1::text)
          or exists(select 1 from public.progress where puzzle_id = $1::text) as active`, [id])).rows[0].active) {
          throw new Error('Cannot change a puzzle after play or legacy completion; create a new puzzle instead');
        }
      }
      await client.query(`insert into private.puzzles(id, publish_date, available_on, category, headline, article_url, words, hints)
        values($1, $2, $3, $4, $5, $6, $7, $8) on conflict(id) do update set
        publish_date = excluded.publish_date, available_on = excluded.available_on, category = excluded.category,
        headline = excluded.headline, article_url = excluded.article_url, words = excluded.words, hints = excluded.hints`,
      [id, p.date, p.availableDate ?? null, p.category, p.headline, p.articleUrl ?? null, JSON.stringify(words), JSON.stringify(p.hints)]);
      if (p.legacyId) {
        await client.query('insert into private.puzzle_legacy_ids values($1, $2) on conflict(legacy_id) do nothing', [p.legacyId, id]);
        await client.query('update public.solves set puzzle_id = $1 where puzzle_id = $2', [id, p.legacyId]);
        await client.query('update public.progress set puzzle_id = $1 where puzzle_id = $2', [id, p.legacyId]);
      }
      // A pre-cutover leaderboard row is the retained score if old progress disagrees.
      // Cloud-only progress stays completed without creating a leaderboard entry.
      await client.query(`insert into public.progress(user_id, puzzle_id, time_seconds, hints_used, solved_at, leaderboard_row_id, verified)
        select user_id, puzzle_id, time_seconds, coalesce(hints_used, 0), created_at, id, verified from public.solves
        where puzzle_id = $1 and user_id is not null
        on conflict(user_id, puzzle_id) do update set time_seconds = excluded.time_seconds,
        hints_used = excluded.hints_used, solved_at = excluded.solved_at,
        leaderboard_row_id = excluded.leaderboard_row_id, verified = excluded.verified`, [id]);
      await client.query(`update public.progress p set leaderboard_row_id = null where puzzle_id = $1
        and not exists(select 1 from public.solves s where s.id = p.leaderboard_row_id
          and s.user_id = p.user_id and s.puzzle_id = p.puzzle_id)`, [id]);
    }
    await client.query('commit');
  } catch (err) { await client.query('rollback'); throw err; }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!process.env.PUZZLE_DATABASE_URL) throw new Error('Set PUZZLE_DATABASE_URL to the admin Postgres connection (never a VITE_ variable)');
  const rows = JSON.parse(await readFile(process.argv[2] ?? 'private/puzzles.json', 'utf8'));
  const client = new pg.Client({ connectionString: process.env.PUZZLE_DATABASE_URL });
  await client.connect();
  try { await importPuzzles(client, rows); console.log(`Imported ${rows.length} puzzles.`); }
  catch { console.error('Import failed; transaction rolled back. Check the private input, migrations, and database constraints.'); process.exitCode = 1; }
  finally { await client.end(); }
}
