/**
 * v0.89.1: test preload (`npm test` runs it with `--import`). Puts the English text of `public/lang/en.json` on
 * `globalThis.__SR2E_EN__` as a flat table (`SR2E.Notify.Actor.x` → text), so code that calls `t()` shows English
 * under the tests' stub `game.i18n` (which gives keys back). Foundry never loads this file.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const flat: Record<string, string> = {};
const walk = (o: unknown, prefix: string): void => {
  if (typeof o === 'string') { flat[prefix] = o; return; }
  if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) walk(v, prefix ? `${prefix}.${k}` : k);
};
// Found from this file, not the working directory, so a test run from elsewhere still gets English (v0.89.1 review).
walk(JSON.parse(readFileSync(fileURLToPath(new URL('../../../../public/lang/en.json', import.meta.url)), 'utf8')), '');
(globalThis as any).__SR2E_EN__ = flat;
