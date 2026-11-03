/**
 * v0.81.0 ESC-APP, v0.81.1 rewrite: the HTML-escaping ratchet. Runs the escaping scanner (helpers/html-scan.ts) over
 * `src/` and fails when any value that goes into HTML (an interpolation in an HTML template, or anything reaching
 * innerHTML/outerHTML/insertAdjacentHTML/content/flavor/data-tooltip) is neither escaped (`escHtml`, resolved by
 * symbol), a number, a RULES/CONFIG.SR2E constant, nor an HTML fragment whose own parts the scanner judged, unless it
 * is on the reviewed allow-list (helpers/html-allow.ts), which is keyed by file, enclosing function and expression.
 *
 * Fixing a new failure: wrap the value in `escHtml(…)` where it enters the HTML (never a value that is already
 * HTML: escape its parts where the fragment is built instead). Allow-list only HTML the scanner cannot follow, with
 * the reason; `npx tsx src/module/__tests__/helpers/scan-dump.mts <file>` prints a file's rows in the list's format.
 * Notifications are a separate count ratchet (v0811-scan.test.ts).
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { scanHtml, type HtmlScanRow } from './helpers/html-scan.ts';
import { ALLOWED, OPEN, allowKey } from './helpers/html-allow.ts';

const fmt = (r: HtmlScanRow) => `${r.file}:${r.line}  ${allowKey(r)}${r.attr ? `  [in ${r.attr}=""]` : ''}  — ${r.verdict}`;
const listed = (r: HtmlScanRow) => !!(ALLOWED[r.file]?.[allowKey(r)] ?? OPEN[r.file]?.[allowKey(r)]);

describe('v0.81.1 HTML escaping ratchet', () => {
  const t0 = Date.now();
  const rows = scanHtml(process.cwd());
  const ms = Date.now() - t0;
  const fix = rows.filter((r) => r.verdict.startsWith('fix') && r.sink !== 'notification');

  test('the scanner sees the codebase (guards against silently scanning nothing)', () => {
    assert.ok(rows.length > 1000, `only ${rows.length} sites found`);
    assert.ok(new Set(rows.map((r) => r.file)).size > 20);
    assert.ok(rows.some((r) => r.sink === 'innerHTML') && rows.some((r) => r.sink === 'content'), 'the sink pass found no sinks');
    assert.ok(ms < 30_000, `scan took ${ms} ms`);
  });

  test('no unescaped value goes into HTML outside the allow-list', () => {
    const bad = fix.filter((r) => !listed(r));
    assert.deepEqual(bad.map(fmt), [], 'escape these with escHtml (or, if the value is HTML on purpose, allow-list it with a reason)');
  });

  test('every allow-list entry still matches a site (stale entries are removed)', () => {
    const stale: string[] = [];
    for (const list of [ALLOWED, OPEN]) {
      for (const [file, entries] of Object.entries(list)) {
        for (const k of Object.keys(entries)) if (!fix.some((r) => r.file === file && allowKey(r) === k)) stale.push(`${file}: ${k}`);
      }
    }
    assert.deepEqual(stale, []);
  });
});
