import { readFile, readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { transpileModule } from 'typescript';

const source = execFileSync('git', ['show', 'c1e293e38de02dc057006703f261c87978892a1a:decryptions_inner/src/data/puzzles.ts'], { encoding: 'utf8' });
const js = transpileModule(source, { compilerOptions: { module: 99, target: 99 } }).outputText;
const { puzzles } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const markers = puzzles.flatMap(p => [p.id, p.headline, p.articleUrl, ...p.hints.filter(h => h.length > 20)]).filter(Boolean);
async function files(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(entries.map(e => e.isDirectory() ? files(join(dir, e.name)) : [join(dir, e.name)]));
  return nested.flat();
}
let checked = 0;
for (const file of await files('dist')) {
  if (!/\.(js|html|map|json|css)$/.test(file)) continue;
  const text = await readFile(file, 'utf8');
  assert(!markers.some(marker => text.includes(marker)), `Private puzzle marker found in ${file}`);
  assert(!/["']?answer["']?\s*:\s*["']/.test(text), `Canonical answer literal found in ${file}`);
  assert(!/\.from\(["'](?:solves|progress)["']\)/.test(text), `Direct legacy table access found in ${file}`);
  checked++;
}
assert(checked > 0, 'Build first: no bundle files were checked');
console.log(`Checked ${checked} bundle files: no historical headlines, slugs, article links, hints, or canonical answer literals.`);
