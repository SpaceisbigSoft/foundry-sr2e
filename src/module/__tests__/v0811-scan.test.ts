/**
 * v0.81.1 (SEC1-13, SEC2b-5, SEC2b-7): tests of the HTML-escaping scanner itself, and the ratchets that sit beside
 * the main one (v081-html-scan.test.ts):
 * - the reviews' bypass probes (fixtures/sec1-ratchet-probe.ts: 10 sites, fixtures/sec2-bypass.ts: 25) are all
 *   reported, and a control file of correctly escaped code (fixtures/control-escaped.ts) gives no `fix` row;
 * - `ui.notifications.*` with unescaped values: none since v0.85.0 (the ratchet is 0);
 * - every Handlebars triple-stash is on a reviewed list;
 * - number/literal-typed values read from card flags: an informational count (never fails).
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { scanHtml, scanHbs, type HtmlScanRow } from './helpers/html-scan.ts';
import { HBS_ALLOWED, NOTIFICATION_MAX } from './helpers/html-allow.ts';

const FIXTURES = 'src/module/__tests__/fixtures';
const isFix = (r: HtmlScanRow) => r.verdict.startsWith('fix');

describe('v0.81.1 scanner: bypass fixtures', () => {
  const rows = scanHtml(process.cwd(), { extra: [FIXTURES], onlyExtra: true });
  const of = (name: string) => rows.filter((r) => r.file === `${FIXTURES}/${name}`);
  const source = (name: string) => fs.readFileSync(path.join(process.cwd(), FIXTURES, name), 'utf8').split('\n');

  test('SEC1-13: all 10 probe sites are reported', () => {
    const want = source('sec1-ratchet-probe.ts').map((l, i) => (/\/\/ P\d+/.test(l) ? i + 1 : 0)).filter(Boolean);
    assert.equal(want.length, 10);
    const got = new Set(of('sec1-ratchet-probe.ts').filter(isFix).map((r) => r.line));
    assert.deepEqual(want.filter((l) => !got.has(l)), [], 'probe lines with no fix row');
  });

  test('SEC2b-5: all 25 bypass patterns are reported', () => {
    const want = source('sec2-bypass.ts').map((l) => /^export function (p\d+)/.exec(l)?.[1]).filter((x): x is string => !!x);
    assert.equal(want.length, 25);
    const got = new Set(of('sec2-bypass.ts').filter(isFix).map((r) => r.fn));
    assert.deepEqual(want.filter((f) => !got.has(f)), [], 'bypass functions with no fix row');
  });

  test('the control file (escaped, numeric, constant) gives no fix row', () => {
    const ctl = of('control-escaped.ts');
    assert.ok(ctl.length >= 15, `the control file should still produce judged rows (${ctl.length})`);
    assert.deepEqual(ctl.filter(isFix).map((r) => `${r.line} ${r.fn}: ${r.expr} — ${r.verdict}`), []);
  });
});

describe('v0.81.1 scanner: side ratchets', () => {
  const rows = scanHtml(process.cwd());

  test(`ui.notifications: at most ${NOTIFICATION_MAX} unescaped values (SEC2b-7, swept in v0.85.0)`, () => {
    const n = rows.filter((r) => r.sink === 'notification' && isFix(r)).length;
    assert.ok(n > 0 || NOTIFICATION_MAX === 0, 'the notification sink found nothing: the sink pass is broken');
    assert.ok(n <= NOTIFICATION_MAX, `${n} unescaped notification values (limit ${NOTIFICATION_MAX}): escape the new ones with escHtml`);
  });

  test('every Handlebars triple-stash is reviewed (and every reviewed one still exists)', () => {
    const found = scanHbs(process.cwd()).map((r) => `${r.file} | ${r.expr}`);
    assert.ok(found.length > 0, 'no .hbs triple-stash found: is the template folder still public/templates?');
    assert.deepEqual([...new Set(found.filter((k) => !HBS_ALLOWED[k]))], [], 'a {{{…}}} skips escaping: use {{…}} or review it into HBS_ALLOWED');
    assert.deepEqual(Object.keys(HBS_ALLOWED).filter((k) => !found.includes(k)), [], 'stale HBS_ALLOWED entries');
  });

  test('no <prose-mirror> loads the raw stored field (it binds the cleaned richSource, SEC2b-4d)', () => {
    const dir = path.join(process.cwd(), 'public/templates');
    const bad: string[] = [];
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.hbs'))) {
      fs.readFileSync(path.join(dir, f), 'utf8').split('\n').forEach((l, i) => {
        for (const m of l.matchAll(/<prose-mirror\b[^>]*>/g)) if (/\bvalue="\{\{\s*system\./.test(m[0])) bad.push(`${f}:${i + 1}`);
      });
    }
    assert.deepEqual(bad, []);
  });

  test('informational: number/literal-typed values read from card flags (SEC2b-2; never fails)', (t) => {
    const flag = rows.filter((r) => r.flag);
    t.diagnostic(`${flag.length} flag-read number/literal values printed into HTML without Number()/safeInt()/Math.* at the site`);
    for (const r of flag.slice(0, 200)) t.diagnostic(`${r.file}:${r.line} ${r.fn}: ${r.expr}`);
  });
});
