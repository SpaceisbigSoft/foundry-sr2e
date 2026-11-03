/**
 * v0.90.0: the last build step (npm run build): minifies public/index.mjs in place, whitespace included, with a
 * source map that still points at the TypeScript sources. Vite's library build keeps whitespace in ES output, so the
 * bundle is passed once more through esbuild (which follows the input map). keepNames: Foundry keys registered sheets
 * by their class name ("sr2e.SR2CharacterSheet"); renamed classes would lose every player's sheet choice.
 */
import { build } from 'esbuild';
import { statSync } from 'node:fs';

const before = statSync('public/index.mjs').size;
await build({
  entryPoints: ['public/index.mjs'], outfile: 'public/index.mjs', allowOverwrite: true,
  bundle: false, format: 'esm', target: 'es2022', minify: true, keepNames: true, sourcemap: true, legalComments: 'none', logLevel: 'warning',
});
console.log(`index.mjs ${(before / 1024).toFixed(0)} KB → ${(statSync('public/index.mjs').size / 1024).toFixed(0)} KB`);
