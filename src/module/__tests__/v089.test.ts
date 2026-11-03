/**
 * v0.89.0: localization, first slice. The templates' text (lang/en.json SR2E.UI, via the sr2eT helper), the settings'
 * names, hints and choices (SR2E.Settings) and the hotkeys (SR2E.Keybindings, v0.86.0) come from the language file.
 * The rest of the code's English is counted and may only go down (helpers/i18n-baseline.json).
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import Handlebars from 'handlebars';
import { formatText, t } from '../helpers/i18n.ts';
import { englishCounts, looksEnglish } from './helpers/i18n-scan.ts';
import { englishTemplate } from './helpers/english.ts';

const ROOT = process.cwd();
const TPL = join(ROOT, 'public', 'templates');
const lang = JSON.parse(readFileSync(join(ROOT, 'public', 'lang', 'en.json'), 'utf8'));
const flat = (o: any, p = ''): Record<string, string> => Object.entries(o).reduce((acc: Record<string, string>, [k, v]) => (typeof v === 'object' && v ? { ...acc, ...flat(v, `${p}${k}.`) } : { ...acc, [`${p}${k}`]: String(v) }), {});
const KEYS = flat(lang);
const templates = readdirSync(TPL).filter((f) => f.endsWith('.hbs')).sort();

describe('v0.89.0 the translation helper', () => {
  test('placeholders are filled; a missing value is empty, not "undefined"', () => {
    assert.equal(formatText('Raise to {to}: {cost} Karma', { to: 5, cost: 25 }), 'Raise to 5: 25 Karma');
    assert.equal(formatText('{a} and {b}', { a: 0 }), '0 and ');
    assert.equal(formatText('{a}', { a: null }), '');
    assert.equal(formatText('no {braces here', {}), 'no {braces here');
    assert.equal(formatText('{constructor}', {}), '', 'only own values');
  });
  test('t() uses Foundry\'s translation, else the key', () => {
    const g = globalThis as any;
    const prev = g.game;
    g.game = { i18n: { has: (k: string) => k === 'SR2E.X', localize: (k: string) => (k === 'SR2E.X' ? 'Hello {who}' : k) } };
    try {
      assert.equal(t('SR2E.X', { who: 'chummer' }), 'Hello chummer');
      assert.equal(t('SR2E.Missing'), 'SR2E.Missing');
    } finally { g.game = prev; }
  });
});

describe('v0.89.0 templates', () => {
  test('nothing left to convert (the converter changes nothing)', async () => {
    const { convertTemplate } = await import('../../../scripts/i18n-templates.mjs' as any);
    const left = templates.filter((f) => convertTemplate(readFileSync(join(TPL, f), 'utf8')) !== readFileSync(join(TPL, f), 'utf8'));
    assert.deepEqual(left, []);
  });
  test('every sr2eT key is in lang/en.json, and every SR2E.UI string is used', () => {
    const used = new Set<string>();
    for (const f of templates) for (const m of readFileSync(join(TPL, f), 'utf8').matchAll(/\{\{sr2eT "([\w.]+)"/g)) used.add(m[1]!);
    const missing = [...used].filter((k) => !(k in KEYS));
    assert.deepEqual(missing, []);
    const unused = Object.keys(KEYS).filter((k) => k.startsWith('SR2E.UI.') && !used.has(k));
    assert.deepEqual(unused, []);
    assert.ok(used.size > 1500, `${used.size} strings`);
  });
  test('every template compiles, and renders its English through sr2eT', () => {
    const hb = Handlebars.create();
    hb.registerHelper('sr2eT', (key: string, options: any) => formatText(KEYS[key] ?? key, options?.hash ?? {}));
    for (const h of ['eq', 'ne', 'lt', 'gt', 'and', 'or', 'not', 'checked', 'selectOptions', 'localize', 'lookup', 'concat', 'editor', 'numberFormat', 'timeSince', 'disabled', 'json']) if (!hb.helpers[h]) hb.registerHelper(h, () => '');
    for (const f of templates) assert.doesNotThrow(() => hb.precompile(readFileSync(join(TPL, f), 'utf8')), f);
    const track = hb.compile(readFileSync(join(TPL, 'monitor-track.hbs'), 'utf8'));
    const html = track({ t: { track: 'physical', label: 'Physical', filled: 3, boxes: 10, reached: '', groups: [{ label: '+1', title: 'L', now: false, boxes: [{ value: 1, filled: true }, { value: 2, filled: false }] }] }, action: 'setMonitor', step: true });
    assert.ok(html.includes('aria-label="Physical box 1"'), 'the box label in English');
    assert.ok(html.includes('aria-label="Physical: 3 of 10 boxes"'));
    assert.ok(html.includes('Physical minus one'));
    assert.ok(!/undefined|SR2E\.UI/.test(html));
  });
  test('every template renders with empty data, partials included, with no key or placeholder showing', () => {
    const hb = Handlebars.create();
    hb.registerHelper('sr2eT', (key: string, options: any) => formatText(KEYS[key] ?? key, options?.hash ?? {}));
    for (const h of ['eq', 'ne', 'lt', 'gt', 'and', 'or', 'not', 'checked', 'selectOptions', 'localize', 'concat', 'editor', 'numberFormat', 'timeSince', 'disabled', 'json']) hb.registerHelper(h, () => '');
    for (const f of templates) hb.registerPartial(`systems/sr2e/templates/${f}`, readFileSync(join(TPL, f), 'utf8'));
    for (const f of templates) {
      const html = hb.compile(readFileSync(join(TPL, f), 'utf8'))({});
      assert.ok(!/SR2E\.(UI|Settings)\.|\{[a-z]\w*\}|undefined/.test(html), `${f}: ${/SR2E\.(UI|Settings)\.\w+|\{[a-z]\w*\}|undefined/.exec(html)?.[0]}`);
    }
  });
  test('a function value is called, not printed; values can be escaped for HTML', async () => {
    assert.equal(formatText('{a}', { a: () => 5 }), '5');
    const { tHtml } = await import('../helpers/i18n.ts');
    const g = globalThis as any;
    const prev = g.game;
    g.game = { i18n: { localize: () => 'Hi <b>{who}</b>' } };
    try { assert.equal(tHtml('K', { who: '<i>x</i>' }), 'Hi <b>&lt;i&gt;x&lt;/i&gt;</b>'); } finally { g.game = prev; }
  });
  test('the English round trip gives the same text as before (spot checks)', () => {
    const gm = englishTemplate(readFileSync(join(TPL, 'gm-panel.hbs'), 'utf8'));
    assert.ok(gm.includes('<h2 data-heading="Starter demo">Starter demo</h2>'));
    const ch = englishTemplate(readFileSync(join(TPL, 'actor-character-sheet.hbs'), 'utf8'));
    assert.ok(ch.includes('title="Raise to {{improve.to}}: {{improve.cost}} Karma"'));
  });
});

describe('v0.89.0 settings', () => {
  test('every setting\'s name, hint, label and choice is a key in lang/en.json', () => {
    const files = ['src/module/settings.ts', 'src/module/applications/look.ts', 'src/module/applications/bugreport.ts', 'src/module/applications/tokenart.ts'];
    for (const f of files) {
      const src = readFileSync(join(ROOT, f), 'utf8');
      for (const m of src.matchAll(/\b(?:name|hint|label): "(SR2E\.Settings\.[\w.]+)"/g)) assert.ok(m[1]! in KEYS, `${f}: ${m[1]}`);
      for (const m of src.matchAll(/: "(SR2E\.Settings\.[\w]+\.Choices\.\w+)"/g)) assert.ok(m[1]! in KEYS, `${f}: ${m[1]}`);
      // No registration left with English (the per-sound settings are the one exception: built from a list).
      for (const m of src.matchAll(/register(?:Menu)?\([^,]+,\s*['"](\w+)['"],\s*\{([\s\S]*?)\}\);/g)) {
        assert.ok(!/\b(?:name|hint):\s*['"](?!SR2E\.)/.test(m[2]!), `${f}: ${m[1]} still has English`);
      }
    }
    assert.ok(Object.keys(KEYS).filter((k) => k.startsWith('SR2E.Settings.')).length >= 70);
    // No English value is itself a key (a converter run twice).
    assert.deepEqual(Object.entries(KEYS).filter(([, v]) => v.startsWith('SR2E.')).map(([k]) => k), []);
  });
});

describe('v0.89.0 the ratchet', () => {
  test('English left in the code only goes down (per file)', () => {
    const base = JSON.parse(readFileSync(join(ROOT, 'src', 'module', '__tests__', 'helpers', 'i18n-baseline.json'), 'utf8'));
    const now = englishCounts();
    const over = Object.entries(now).filter(([f, n]) => n > (base.files[f] ?? 0)).map(([f, n]) => `${f}: ${n} > ${base.files[f] ?? 0}`);
    assert.deepEqual(over, [], 'move the new text into lang/en.json (t() or sr2eT), or explain it');
    assert.ok(Object.values(now).reduce((a: number, b) => a + (b as number), 0) <= base.total);
  });
  test('the scanner tells English from keys, selectors and classes', () => {
    assert.equal(looksEnglish('Roll initiative for your tokens'), true);
    assert.equal(looksEnglish('SR2E.UI.rollInitiative'), false);
    assert.equal(looksEnglish('.sr2e-cm .sr2e-box'), false);
    assert.equal(looksEnglish('fa-solid fa-dice'), false);
    assert.equal(looksEnglish('button[data-action="ok"]'), false);
    assert.equal(looksEnglish('ok'), false);
  });
});
