/**
 * v0.92.2: checks on the in-Foundry test batches (src/quench, outside src/module, so the source scans there don't see
 * it): developer-only code that never builds HTML, never translates, runs only on Quench's hook and cleans up after
 * itself; and the world-time reads that stay on Foundry's clock.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const quench = readFileSync(join(ROOT, 'src', 'quench', 'sr2e-quench.ts'), 'utf8');

describe('v0.92.2 the Quench batches', () => {
  test('build no HTML and translate nothing (test names are developer text)', () => {
    assert.doesNotMatch(quench, /\.innerHTML\s*=|insertAdjacentHTML|outerHTML\s*=/);
    assert.doesNotMatch(quench, /\btx\(|\bt\(|i18n\.localize|i18n\.format/);
  });
  test('register only on Quench\'s hook, once, and only the system imports them', () => {
    assert.match(quench, /Hooks\.once\('quenchReady'/);
    assert.doesNotMatch(quench, /Hooks\.on\('quenchReady'/);
    const users: string[] = [];
    const walk = (d: string) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) { if (f !== '__tests__') walk(p); } else if (f.endsWith('.ts') && readFileSync(p, 'utf8').includes('quench/sr2e-quench')) users.push(p); } };
    walk(join(ROOT, 'src', 'module'));
    assert.deepEqual(users.map((p) => p.split(/[\\/]/).pop()), ['sr2e-system.ts']);
  });
  test('every batch starts its record first and cleans up only what it started, own cards only', () => {
    assert.doesNotMatch(quench, /gmOnly\(this\);\s*made\.start\(\)/);
    assert.match(quench, /if \(!this\.started\) return;/);
    assert.match(quench, /String\(m\.author\?\.id \?\? m\.user\?\.id \?\? ''\) !== String\(game\.user\?\.id\)/);
    assert.match(quench, /roundTime = 0/);
  });
});

describe('v0.92.2 the system clock: what stays on Foundry\'s clock', () => {
  const src = (f: string) => readFileSync(join(ROOT, 'src', 'module', f), 'utf8');
  test('timers read the system clock; only the undo log, the Scene builder, the advancement log and the shown time read world time', () => {
    const allowed = new Set(['applications/undo.ts', 'applications/scenebuilder.ts', 'applications/advancement.ts', 'applications/ui.ts', 'helpers/clock.ts']);
    const hits: string[] = [];
    const walk = (d: string, rel = '') => { for (const f of readdirSync(d)) { const p = join(d, f); const r = rel ? `${rel}/${f}` : f; if (statSync(p).isDirectory()) { if (f !== '__tests__' && f !== 'rules') walk(p, r); } else if (f.endsWith('.ts') && /time\??\.worldTime/.test(readFileSync(p, 'utf8')) && !allowed.has(r)) hits.push(r); } };
    walk(join(ROOT, 'src', 'module'));
    assert.deepEqual(hits, []);
    // ui.ts: only the "move world time on … to <time>" line shows the calendar's own time.
    assert.equal((src('applications/ui.ts').match(/time\??\.worldTime/g) ?? []).length, 1);
  });
  test('the system\'s own clock moves count as time passed', () => {
    assert.match(src('applications/ui.ts'), /time\.advance\(seconds, COUNTED_TIME\)/);
    assert.equal((src('applications/undo.ts').match(/COUNTED_TIME\)/g) ?? []).length, 2);
  });
});
