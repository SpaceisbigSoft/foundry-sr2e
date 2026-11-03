/**
 * v0.89.1: localization, second slice: the notifications. Every `ui.notifications.*` text written in the code is a
 * key in lang/en.json (SR2E.Notify.<File>.*, counted nouns in SR2E.Count (moved there in v0.89.2)), filled by `t()` (imported as `tx`)
 * with the same values, escaped the same way, as before.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';
import { t, tCount, pluralCategory, formatText } from '../helpers/i18n.ts';
import { scanHtml } from './helpers/html-scan.ts';

const ROOT = process.cwd();
const SRC = join(ROOT, 'src', 'module');
const lang = JSON.parse(readFileSync(join(ROOT, 'public', 'lang', 'en.json'), 'utf8'));
const flat = (o: any, p = ''): Record<string, string> => Object.entries(o).reduce((acc: Record<string, string>, [k, v]) => (typeof v === 'object' && v ? { ...acc, ...flat(v, `${p}${k}.`) } : { ...acc, [`${p}${k}`]: String(v) }), {});
const KEYS = flat(lang);
const NOTIFY = Object.keys(KEYS).filter((k) => k.startsWith('SR2E.Notify.'));

const files = (d: string, out: string[] = []): string[] => {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) { if (f !== '__tests__') files(p, out); } else if (f.endsWith('.ts')) out.push(p);
  }
  return out;
};

interface Call { file: string; line: number; fn: string; key: string | null; props: string[] | null }
/** Every tx(…) / tCount(…) call in the code, with its key and the names of the values it passes. */
function calls(): Call[] {
  const out: Call[] = [];
  for (const f of files(SRC)) {
    const src = readFileSync(f, 'utf8');
    if (!/\b(tx|tCount)\(/.test(src)) continue;
    const sf = ts.createSourceFile(f, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const v = (n: ts.Node): void => {
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && (n.expression.text === 'tx' || n.expression.text === 'tCount')) {
        const counted = n.expression.text === 'tCount';
        const k = n.arguments[counted ? 1 : 0];
        const d = n.arguments[counted ? 2 : 1];
        const props = !d ? [] : ts.isObjectLiteralExpression(d) ? d.properties.map((p) => (p.name ? p.name.getText() : '...')) : null;
        out.push({ file: relative(ROOT, f), line: sf.getLineAndCharacterOfPosition(n.getStart()).line + 1, fn: n.expression.text, key: k && ts.isStringLiteral(k) ? k.text : null, props: counted && props ? [...props, 'count'] : props });
      }
      ts.forEachChild(n, v);
    };
    v(sf);
  }
  return out;
}
const CALLS = calls();
const placeholders = (s: string) => [...new Set([...s.matchAll(/\{([A-Za-z_]\w*)\}/g)].map((m) => m[1]!))].sort();

describe('v0.89.1 the notification keys', () => {
  test('the converter finds nothing left to convert', () => {
    const out = execFileSync(process.execPath, [join(ROOT, 'scripts', 'i18n-notify.mjs'), '--check'], { cwd: ROOT, encoding: 'utf8' });
    assert.match(out, /would convert 0 strings in 0 files; 0 plural suffixes/);
  });

  test('every key a call names is in lang/en.json, and every call\'s key is a literal', () => {
    assert.ok(CALLS.length > 900, `${CALLS.length} calls`);
    assert.deepEqual(CALLS.filter((c) => !c.key).map((c) => `${c.file}:${c.line}`), []);
    const missing = CALLS.filter((c) => c.fn === 'tx' ? !(c.key! in KEYS) : !(`${c.key}.other` in KEYS && `${c.key}.one` in KEYS));
    assert.deepEqual(missing.map((c) => `${c.file}:${c.line} ${c.key}`), []);
  });

  test('every SR2E.Notify string is used by the code', () => {
    const used = new Set(CALLS.flatMap((c) => (c.fn === 'tx' ? [c.key!] : [`${c.key}.one`, `${c.key}.other`])));
    assert.deepEqual(NOTIFY.filter((k) => !used.has(k)), []);
    assert.ok(NOTIFY.length > 900, `${NOTIFY.length} keys`);
  });

  test('each call passes exactly the values its English text uses', () => {
    const bad: string[] = [];
    for (const c of CALLS) {
      if (!c.props) { bad.push(`${c.file}:${c.line} data is not an object literal`); continue; }
      const texts = c.fn === 'tx' ? [KEYS[c.key!]!] : [KEYS[`${c.key}.one`]!, KEYS[`${c.key}.other`]!];
      // v0.89.3: tCount always passes {count}; a counted card text may leave it out (the number sits in its own tag).
      const want = [...new Set(texts.flatMap(placeholders))].filter((p) => c.fn === 'tx' || p !== 'count').sort();
      const got = [...new Set(c.props)].filter((p) => c.fn === 'tx' || p !== 'count').sort();
      if (want.join() !== got.join()) bad.push(`${c.file}:${c.line} ${c.key}: text uses {${want}} but the call passes {${got}}`);
    }
    assert.deepEqual(bad, []);
  });

  test('one key per English text in each group, and no text is itself a key', () => {
    const dup: string[] = [];
    for (const [g, o] of Object.entries(lang.SR2E.Notify as Record<string, Record<string, unknown>>)) {
      const seen = new Map<string, string>();
      for (const [k, v] of Object.entries(o)) {
        if (typeof v !== 'string') continue;
        // v0.89.5: a context key (`key__context`) repeats an English text on purpose: one word, two translations
        if (/__\w+$/.test(k)) continue;
        if (seen.has(v)) dup.push(`${g}: ${seen.get(v)} = ${k}`);
        seen.set(v, k);
        assert.ok(!v.startsWith('SR2E.'), `${g}.${k}`);
      }
    }
    assert.deepEqual(dup, []);
  });

  test('no notification is passed an English literal or template any more', () => {
    const left: string[] = [];
    for (const f of files(SRC)) {
      const src = readFileSync(f, 'utf8');
      if (!/notifications/.test(src)) continue;
      const sf = ts.createSourceFile(f, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
      const v = (n: ts.Node): void => {
        if (ts.isCallExpression(n) && /\bnotifications\.(info|warn|error|notify|success)$/.test(n.expression.getText().replace(/\?\./g, '.')) && n.arguments[0]) {
          let a: ts.Expression = n.arguments[0];
          while (ts.isParenthesizedExpression(a)) a = a.expression;
          const own = ts.isStringLiteral(a) || ts.isNoSubstitutionTemplateLiteral(a) ? a.text : ts.isTemplateExpression(a) ? [a.head.text, ...a.templateSpans.map((s) => s.literal.text)].join(' ') : '';
          if (/[A-Za-z]{2,}/.test(own)) left.push(`${relative(ROOT, f)}:${sf.getLineAndCharacterOfPosition(a.getStart()).line + 1}`);
        }
        ts.forEachChild(n, v);
      };
      v(sf);
    }
    assert.deepEqual(left, []);
  });
});

describe('v0.89.1 the helpers', () => {
  test('tCount picks the plural form of the language, falling back to .other', () => {
    const g = globalThis as any;
    const prev = g.game;
    const table: Record<string, string> = { 'K.one': '{count} row', 'K.other': '{count} rows', 'K.few': '{count} rowy' };
    try {
      g.game = { i18n: { lang: 'en', localize: (k: string) => table[k] ?? k } };
      assert.equal(tCount(1, 'K'), '1 row');
      assert.equal(tCount(0, 'K'), '0 rows');
      assert.equal(tCount(3, 'K'), '3 rows');
      g.game = { i18n: { lang: 'pl', localize: (k: string) => table[k] ?? k } };
      assert.equal(pluralCategory(3, 'pl'), 'few');
      assert.equal(tCount(3, 'K'), '3 rowy', 'Polish "few"');
      assert.equal(pluralCategory(5, 'pl'), 'many');
      assert.equal(tCount(5, 'K'), '5 rows', 'a category the file lacks falls back to .other');
      assert.equal(pluralCategory(2, 'not a language!'), 'other');
    } finally { g.game = prev; }
  });

  test('a real translation wins over the tests\' English table; the table only fills a key given back', () => {
    const g = globalThis as any;
    const prev = g.game;
    try {
      g.game = { i18n: { localize: (k: string) => (k === 'SR2E.Notify.Approvals.thatSpiritIsGone' ? 'Der Geist ist fort.' : k) } };
      assert.equal(t('SR2E.Notify.Approvals.thatSpiritIsGone'), 'Der Geist ist fort.');
      g.game = { i18n: { localize: (k: string) => k } };
      assert.equal(t('SR2E.Notify.Approvals.thatSpiritIsGone'), 'That spirit is gone.');
      assert.equal(t('SR2E.Notify.Nope.missing'), 'SR2E.Notify.Nope.missing');
    } finally { g.game = prev; }
  });

  test('the English round trip: spot checks of texts and their values', () => {
    const k = (key: string, d: Record<string, unknown>) => formatText(KEYS[key]!, d);
    assert.equal(k('SR2E.Notify.Actor.isAlreadyOnFullDefense', { name: 'Ace' }), 'Ace is already on full defense.');
    assert.equal(k('SR2E.Notify.Catalogue.loadedSummary', { templates: '2 templates', kits: '1 kit', actors: '0 new actors', filled: '', problems: '' }), 'Loaded 2 templates, 1 kit and 0 new actors.');
    assert.equal(formatText(KEYS['SR2E.Count.itemOrActor.other']!, { count: 4 }), '4 items and actors');
  });
});

describe('v0.89.1 the HTML scanner and translations', () => {
  const FIX = 'src/module/__tests__/fixtures/i18n-probe.ts';
  const rows = scanHtml(ROOT, { extra: [FIX], onlyExtra: true }).filter((r) => r.file === FIX);
  const src = readFileSync(join(ROOT, FIX), 'utf8').split('\n');
  const marked = (m: string) => src.map((l, i) => (l.includes(`// ${m}`) ? i + 1 : 0)).filter(Boolean);
  const fixLines = new Set(rows.filter((r) => r.verdict.startsWith('fix')).map((r) => r.line));

  test('every BAD probe gives a fix row', () => {
    const bad = marked('BAD');
    assert.equal(bad.length, 9);
    assert.deepEqual(bad.filter((l) => !fixLines.has(l)), []);
  });
  test('no OK probe gives a fix row', () => {
    const ok = marked('OK');
    assert.equal(ok.length, 5);
    assert.deepEqual(ok.filter((l) => fixLines.has(l)), []);
  });
});
