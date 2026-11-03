/**
 * v0.83.0: writes the default token art (the system's own, AI-drawn) from the drawings in `src/art/` to
 * `public/tokens/`, removing files that are no longer drawn. Run: `npm run tokens`.
 * The shipped lookup (`src/module/rules/tokenart.ts`) names these files; `v083.test.ts` checks that every
 * file it can return is here and that this script's output matches what is committed.
 */
import { mkdirSync, readdirSync, rmSync, writeFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { allArt } from '../src/art/index.ts';

const root = join(import.meta.dirname, '..', 'public', 'tokens');
const want = new Map(allArt().map((f) => [f.file, f.svg]));
const walk = (d: string): string[] => {
  try { return readdirSync(d).flatMap((x) => { const p = join(d, x); return statSync(p).isDirectory() ? walk(p) : [p]; }); } catch { return []; }
};
let removed = 0;
for (const p of walk(root)) {
  const rel = relative(root, p).split('\\').join('/');
  if (!want.has(rel)) { rmSync(p); removed++; }
}
for (const [file, svg] of want) {
  const p = join(root, file);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, svg);
}
const bytes = [...want.values()].reduce((a, s) => a + s.length, 0);
console.log(`${want.size} token files written to public/tokens (${(bytes / 1024).toFixed(0)} KB)${removed ? `, ${removed} stale removed` : ''}.`);
