/**
 * Writes the built-in scene backdrops (the system's own, AI-drawn) from `src/art/backdrops.ts` to
 * `public/backdrops/`, removing files that are no longer drawn. Run: `npm run backdrops`.
 * The shipped geometry (`src/module/rules/backdrops.ts`) names these files; `backdrops.test.ts` checks that every
 * file is here and that this script's output matches what is committed.
 */
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { allBackdrops } from '../src/art/backdrops.ts';

const root = join(import.meta.dirname, '..', 'public', 'backdrops');
mkdirSync(root, { recursive: true });
const want = new Map(allBackdrops().map((f) => [f.file, f.svg]));
let removed = 0;
for (const x of readdirSync(root)) if (!want.has(x)) { rmSync(join(root, x)); removed++; }
for (const [file, svg] of want) writeFileSync(join(root, file), svg);
const sizes = [...want].map(([f, s]) => `${f.replace('.svg', '')} ${(s.length / 1024).toFixed(0)} KB`).join(', ');
console.log(`${want.size} backdrops written to public/backdrops (${sizes})${removed ? `, ${removed} stale removed` : ''}.`);
