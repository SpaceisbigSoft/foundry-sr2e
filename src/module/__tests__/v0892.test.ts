/**
 * v0.89.2: localization, third slice: the dialogs and window titles. Dialog titles, content and button labels are
 * keys in lang/en.json (SR2E.Dialog.<File>.*), filled by `tx()`; the windows' static titles are keys themselves
 * (SR2E.Window.<File>.*, Foundry localizes `window.title`). Content is HTML: tags stay in the code, each run of text
 * between them is one string, kept as HTML source. Counted nouns are shared in SR2E.Count (moved from
 * SR2E.Notify.Count).
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';
import { looksEnglish } from './helpers/i18n-scan.ts';
import { scanHtml } from './helpers/html-scan.ts';

const ROOT = process.cwd();
const SRC = join(ROOT, 'src', 'module');
const lang = JSON.parse(readFileSync(join(ROOT, 'public', 'lang', 'en.json'), 'utf8'));
const flat = (o: any, p = ''): Record<string, string> => Object.entries(o).reduce((acc: Record<string, string>, [k, v]) => (typeof v === 'object' && v ? { ...acc, ...flat(v, `${p}${k}.`) } : { ...acc, [`${p}${k}`]: String(v) }), {});
const KEYS = flat(lang);
const files = (d: string, out: string[] = []): string[] => {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) { if (f !== '__tests__') files(p, out); } else if (f.endsWith('.ts')) out.push(p);
  }
  return out;
};
const ALL = files(SRC).map((f) => ({ f, rel: relative(ROOT, f), src: readFileSync(f, 'utf8') }));
const parse = (x: { f: string; src: string }) => ts.createSourceFile(x.f, x.src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const lineOf = (sf: ts.SourceFile, n: ts.Node) => sf.getLineAndCharacterOfPosition(n.getStart()).line + 1;

/** Data a dialog's callback returns (a default name), not text the dialog shows: reviewed, stays English. */
const DATA_DEFAULTS = new Set(['New spell', 'Magical group']);

describe('v0.89.2 the dialog keys', () => {
  test('the converter finds nothing left to convert', () => {
    const out = execFileSync(process.execPath, [join(ROOT, 'scripts', 'i18n-dialogs.mjs'), '--check'], { cwd: ROOT, encoding: 'utf8' });
    assert.match(out, /would convert 0 strings in 0 files; 0 notes/);
  });

  test('every SR2E.Dialog and SR2E.Window string is used by the code', () => {
    const code = ALL.map((x) => x.src).join('\n');
    const unused = Object.keys(KEYS).filter((k) => /^SR2E\.(Dialog|Window)\./.test(k) && !code.includes(`'${k}'`));
    assert.deepEqual(unused, []);
    assert.ok(Object.keys(KEYS).filter((k) => k.startsWith('SR2E.Dialog.')).length > 1200);
  });

  test('every counted noun (SR2E.Count) has one and other, each with {count}, and is used', () => {
    const code = ALL.map((x) => x.src).join('\n');
    for (const [k, v] of Object.entries(lang.SR2E.Count as Record<string, Record<string, string>>)) {
      assert.ok(v.one?.includes('{count}') && v.other?.includes('{count}'), k);
      assert.ok(code.includes(`'SR2E.Count.${k}'`), `SR2E.Count.${k} is unused`);
    }
    assert.equal(lang.SR2E.Notify.Count, undefined, 'moved to SR2E.Count');
  });

  test('one key per English text in each group; no text holds a tag or is itself a key', () => {
    const bad: string[] = [];
    for (const store of ['Dialog', 'Window']) for (const [g, o] of Object.entries(lang.SR2E[store] as Record<string, Record<string, string>>)) {
      const seen = new Map<string, string>();
      for (const [k, v] of Object.entries(o)) {
        // v0.89.5: a context key (`key__context`) repeats an English text on purpose: one word, two translations
        if (seen.has(v) && !/__\w+$/.test(k)) bad.push(`${store}.${g}: ${seen.get(v)} = ${k}`);
        seen.set(v, k);
        if (/<[A-Za-z/!]/.test(v)) bad.push(`${store}.${g}.${k} holds a tag: ${v.slice(0, 60)}`);
        if (v.startsWith('SR2E.')) bad.push(`${store}.${g}.${k} is a key`);
      }
    }
    assert.deepEqual(bad, []);
  });

  test('the windows\' static titles are keys that exist', () => {
    const bad: string[] = [];
    let n = 0;
    for (const x of ALL) {
      const sf = parse(x);
      const v = (m: ts.Node): void => {
        if (ts.isPropertyDeclaration(m) && m.name.getText() === 'DEFAULT_OPTIONS' && m.initializer) {
          const w = (k: ts.Node): void => {
            if (ts.isPropertyAssignment(k) && k.name.getText() === 'title' && ts.isPropertyAssignment(k.parent.parent) && (k.parent.parent as ts.PropertyAssignment).name.getText() === 'window') {
              n++;
              const e = k.initializer;
              if (!ts.isStringLiteral(e) || !(e.text in KEYS)) bad.push(`${x.rel}:${lineOf(sf, k)} ${e.getText()}`);
            }
            ts.forEachChild(k, w);
          };
          w(m.initializer);
        }
        ts.forEachChild(m, v);
      };
      v(sf);
    }
    assert.deepEqual(bad, []);
    assert.ok(n >= 10, `${n} static titles`);
  });

  test('no dialog config holds English outside a tx() call (but the reviewed data defaults)', () => {
    const left: string[] = [];
    for (const x of ALL) {
      if (!/DialogV2/.test(x.src)) continue;
      const sf = parse(x);
      const v = (n: ts.Node): void => {
        if (ts.isCallExpression(n) && /DialogV2\.(prompt|confirm|wait|input|query)$/.test(n.expression.getText().replace(/\s/g, ''))) {
          const look = (m: ts.Node): void => {
            if (ts.isCallExpression(m) && ts.isIdentifier(m.expression) && (m.expression.text === 'tx' || m.expression.text === 'tCount')) { m.arguments.slice(m.expression.text === 'tx' ? 1 : 2).forEach(look); return; }
            if ((ts.isStringLiteral(m) || ts.isNoSubstitutionTemplateLiteral(m)) && looksEnglish(m.text) && !DATA_DEFAULTS.has(m.text) && !/\[name|name="|:checked/.test(m.text)) left.push(`${x.rel}:${lineOf(sf, m)} ${m.getText().slice(0, 70)}`);
            if (ts.isTemplateExpression(m)) {
              const own = [m.head.text, ...m.templateSpans.map((s) => s.literal.text)].join(' ').replace(/<[^>]*>/g, ' ');
              if (looksEnglish(own) && !/\[name|name="|:checked/.test(own)) left.push(`${x.rel}:${lineOf(sf, m)} ${m.getText().slice(0, 70)}`);
            }
            ts.forEachChild(m, look);
          };
          n.arguments.forEach(look);
        }
        ts.forEachChild(n, v);
      };
      v(sf);
    }
    assert.deepEqual(left, []);
  });

  test('no plural suffix is chosen in code inside a dialog text\'s values (tCount instead)', () => {
    const bad: string[] = [];
    const suf = (e: ts.Expression) => (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) && /^(s|es|ies|y|)$/.test(e.text);
    for (const x of ALL) {
      if (!/SR2E\.(Dialog|Window|Notify)/.test(x.src)) continue;
      const sf = parse(x);
      const v = (n: ts.Node, inTx: boolean): void => {
        const isTx = ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'tx';
        if (inTx && ts.isConditionalExpression(n) && suf(n.whenTrue) && suf(n.whenFalse) && ((n.whenTrue as ts.StringLiteral).text || (n.whenFalse as ts.StringLiteral).text)) bad.push(`${x.rel}:${lineOf(sf, n)}`);
        ts.forEachChild(n, (c) => v(c, inTx || isTx));
      };
      v(sf, false);
    }
    assert.deepEqual(bad, []);
  });
});

describe('v0.89.2 review fixes', () => {
  test('no translation is used to search other text (replace, includes, indexOf…): the text it searches stays English', () => {
    const bad: string[] = [];
    for (const x of ALL) {
      if (!/\btx\(/.test(x.src)) continue;
      const sf = parse(x);
      const v = (n: ts.Node): void => {
        if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && /^(replace|replaceAll|includes|indexOf|lastIndexOf|split|startsWith|endsWith|match|matchAll|search)$/.test(n.expression.name.text) && n.arguments[0] && /\btx\(/.test(n.arguments[0].getText())) bad.push(`${x.rel}:${lineOf(sf, n)}`);
        ts.forEachChild(n, v);
      };
      v(sf);
    }
    assert.deepEqual(bad, []);
  });

  test('texts written inside an attribute value hold no straight double quote (it would end the attribute)', () => {
    const bad: string[] = [];
    for (const x of ALL) for (const m of x.src.matchAll(/="\$\{tx\('([\w.]+)'/g)) if ((KEYS[m[1]!] ?? '').includes('"')) bad.push(`${x.rel}: ${m[1]}`);
    assert.deepEqual(bad, []);
    assert.ok(ALL.some((x) => /placeholder="\$\{tx\('/.test(x.src)), 'the pattern still finds attribute texts');
  });

  test('no English is passed to the dialog helpers or to gmMay as a title, label, line or content', () => {
    const HELPERS: Record<string, number[]> = { promptPoolDice: [1], pickOne: [0], pickActors: [0, 2], importDialog: [0], '#pickPerson': [1, 2] };
    const own = (a: ts.Expression) => (ts.isStringLiteral(a) || ts.isNoSubstitutionTemplateLiteral(a) ? a.text : ts.isTemplateExpression(a) ? [a.head.text, ...a.templateSpans.map((s) => s.literal.text)].join(' ').replace(/<[^>]*>/g, ' ') : '');
    const bad: string[] = [];
    for (const x of ALL) {
      const sf = parse(x);
      const v = (n: ts.Node): void => {
        if (ts.isCallExpression(n)) {
          const e = n.expression;
          const nm = ts.isIdentifier(e) ? e.text : ts.isPropertyAccessExpression(e) ? e.name.getText() : '';
          for (const i of Object.hasOwn(HELPERS, nm) ? HELPERS[nm]! : []) { const a = n.arguments[i]; if (a && /[A-Za-z]{2,}/.test(own(a))) bad.push(`${x.rel}:${lineOf(sf, a)} ${nm}`); }
          if (nm === 'gmMay' && n.arguments[1] && ts.isObjectLiteralExpression(n.arguments[1])) for (const p of n.arguments[1].properties) {
            if (!ts.isPropertyAssignment(p)) continue;
            const vals = p.name.getText() === 'title' ? [p.initializer] : p.name.getText() === 'lines' && ts.isArrayLiteralExpression(p.initializer) ? [...p.initializer.elements] : [];
            for (const a of vals) if (/[A-Za-z]{2,}/.test(own(a as ts.Expression))) bad.push(`${x.rel}:${lineOf(sf, a)} gmMay ${p.name.getText()}`);
          }
        }
        ts.forEachChild(n, v);
      };
      v(sf);
    }
    assert.deepEqual(bad, []);
  });
});

describe('v0.89.2 the HTML scanner and translations in HTML', () => {
  const FIX = 'src/module/__tests__/fixtures/i18n-probe.ts';
  const rows = scanHtml(ROOT, { extra: [FIX], onlyExtra: true }).filter((r) => r.file === FIX);
  const src = readFileSync(join(ROOT, FIX), 'utf8').split('\n');
  const marked = (m: string) => src.map((l, i) => (l.includes(`// ${m}`) ? i + 1 : 0)).filter(Boolean);
  const fix = rows.filter((r) => r.verdict.startsWith('fix'));

  test('a raw value inside tx() in HTML is its own fix row, under its own expression', () => {
    const [l] = marked('HTML-BAD');
    const r = fix.filter((x) => x.line === l);
    assert.equal(r.length, 1);
    assert.equal(r[0]!.expr, 'raw', 'the row names the value, so the allow-list keys stay the same');
  });
  test('a raw value next to tx() in a conditional or ?? is still a fix row', () => {
    for (const m of ['HTML-BAD2', 'HTML-BAD3']) {
      const [l] = marked(m);
      assert.deepEqual(fix.filter((x) => x.line === l).map((x) => x.expr), ['raw'], m);
    }
  });
  test('escaped and numeric values in tx() in HTML give no fix row', () => {
    const ok = marked('HTML-OK');
    assert.equal(ok.length, 2);
    assert.deepEqual(fix.filter((x) => ok.includes(x.line)).map((x) => `${x.line} ${x.expr}`), []);
  });
});
