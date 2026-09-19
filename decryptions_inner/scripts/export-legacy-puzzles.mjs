// Recover already-public content once, into an ignored private file. Never use this
// workflow for new puzzle answers: author those directly in the private JSON file.
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { transpileModule } from 'typescript';

const source = execFileSync('git', ['show',
  '1bf31ad1215f6ee7e1e29fc8e5984325f68438ea:decryptions_inner/src/data/puzzles.ts'], { encoding: 'utf8' });
const js = transpileModule(source, { compilerOptions: { module: 99, target: 99 } }).outputText;
const { puzzles } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const rows = puzzles.map(p => ({
  id: randomUUID(), legacyId: p.id, date: p.id.slice(0, 10), category: p.category,
  headline: p.headline, articleUrl: p.articleUrl ?? null, words: p.words, hints: p.hints,
}));
await mkdir('private', { recursive: true });
await writeFile('private/puzzles.json', JSON.stringify(rows, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
console.log(`Exported ${rows.length} historical puzzles to private/puzzles.json. Keep this file private.`);
