/**
 * v0.89.3: localization, fourth slice: the chat cards. Card text is in lang/en.json (SR2E.Card.<File>.*), filled by
 * `tx()`; wording chosen by a count is one counted text (`tCount(n, 'SR2E.Card.<File>.key')`, `one` / `other`), or
 * a shared counted noun (SR2E.Count). `scripts/i18n-cards.mjs` converts only text whose every use ends on a card (a
 * data-flow check), so code values (compared, stored, searched for) stay English. The outcome words outcomeBanner
 * reads back from a card stay English until v0.89.5 moves both sides together.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';

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
const CODE = ALL.map((x) => x.src).join('\n');
const parse = (x: { f: string; src: string }) => ts.createSourceFile(x.f, x.src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const lineOf = (sf: ts.SourceFile, n: ts.Node) => sf.getLineAndCharacterOfPosition(n.getStart()).line + 1;
const INDEX = readFileSync(join(SRC, 'documents', 'index.ts'), 'utf8');
const CHAT = readFileSync(join(SRC, 'applications', 'chat.ts'), 'utf8');
const CARD = lang.SR2E.Card as Record<string, Record<string, string | { one: string; other: string }>>;

describe('v0.89.3 the card keys', () => {
  test('the converter finds nothing left to convert (v0.89.5: no outcome words kept English any more)', () => {
    const out = execFileSync(process.execPath, [join(ROOT, 'scripts', 'i18n-cards.mjs'), '--check'], { cwd: ROOT, encoding: 'utf8' });
    assert.match(out, /would convert 0 strings \(0 counted\) in 0 files/);
    const notes = out.split('\n').filter((l) => l && !l.startsWith('would convert'));
    assert.deepEqual(notes, []);
  });

  test('every SR2E.Card string is used by the code, and there are a couple of thousand', () => {
    const unused: string[] = [];
    let n = 0;
    for (const [g, o] of Object.entries(CARD)) for (const k of Object.keys(o)) { n++; if (!CODE.includes(`'SR2E.Card.${g}.${k}'`)) unused.push(`${g}.${k}`); }
    assert.deepEqual(unused, []);
    assert.ok(n > 1800, `${n} card strings`);
    assert.ok(CARD.Actor && CARD.Chat, 'documents/index.ts and applications/chat.ts have their groups');
  });

  test('a counted card text has one and other (and they differ); a plain one is a string; none holds a tag or is a key', () => {
    const bad: string[] = [];
    for (const [g, o] of Object.entries(CARD)) for (const [k, v] of Object.entries(o)) {
      const texts = typeof v === 'string' ? [v] : [v.one, v.other];
      if (typeof v !== 'string' && (typeof v.one !== 'string' || typeof v.other !== 'string' || v.one === v.other || Object.keys(v).length !== 2)) bad.push(`${g}.${k}: counted text needs one and other`);
      for (const t of texts) {
        if (/<[A-Za-z/!]/.test(t)) bad.push(`${g}.${k} holds a tag`);
        if (/^SR2E\./.test(t)) bad.push(`${g}.${k} is a key`);
      }
    }
    assert.deepEqual(bad, []);
  });

  test('counted card texts are used with tCount, plain ones with tx (never the other way round)', () => {
    const bad: string[] = [];
    for (const x of ALL) {
      if (!x.src.includes('SR2E.Card.')) continue;
      const sf = parse(x);
      const v = (n: ts.Node): void => {
        if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && /^(tx|tCount)$/.test(n.expression.text)) {
          const a = n.arguments[n.expression.text === 'tx' ? 0 : 1];
          if (a && ts.isStringLiteral(a) && a.text.startsWith('SR2E.Card.')) {
            const [, , g, k] = a.text.split('.');
            const val = CARD[g!]?.[k!];
            if (val === undefined) bad.push(`${x.rel}:${lineOf(sf, n)} ${a.text} is missing`);
            else if ((typeof val === 'string') !== (n.expression.text === 'tx')) bad.push(`${x.rel}:${lineOf(sf, n)} ${a.text} with ${n.expression.text}`);
          }
        }
        ts.forEachChild(n, v);
      };
      v(sf);
    }
    assert.deepEqual(bad, []);
  });

  test('no plural suffix is chosen in code inside a card text\'s values (tCount instead)', () => {
    const bad: string[] = [];
    const suf = (e: ts.Expression) => (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) && /^(s|es|ies|y|)$/.test(e.text);
    for (const x of ALL) {
      if (!x.src.includes('SR2E.Card.')) continue;
      const sf = parse(x);
      const v = (n: ts.Node, inTx: boolean): void => {
        const isTx = ts.isCallExpression(n) && ts.isIdentifier(n.expression) && /^(tx|tCount)$/.test(n.expression.text);
        if (inTx && ts.isConditionalExpression(n) && suf(n.whenTrue) && suf(n.whenFalse) && ((n.whenTrue as ts.StringLiteral).text || (n.whenFalse as ts.StringLiteral).text)) bad.push(`${x.rel}:${lineOf(sf, n)}`);
        ts.forEachChild(n, (c) => v(c, inTx || isTx));
      };
      v(sf, false);
    }
    assert.deepEqual(bad, []);
  });

  test('a count printed escaped in the English stays out of the HTML as anything but a number (Number() around it)', () => {
    // v0.89.3 review of the converter: `${escText(t.durationMinutes)} minute${…}` became tCount, which prints {count} raw.
    assert.match(INDEX, /tCount\(Number\(t\.durationMinutes\), 'SR2E\.Card\.Actor\./);
  });
});

describe('v0.89.3 review fixes', () => {
  test('no translation is looked up when a module loads (top level, static fields): Foundry has no languages then', () => {
    const bad: string[] = [];
    for (const x of ALL) {
      if (!/\b(tx|tCount|tHtml)\(/.test(x.src)) continue;
      const sf = parse(x);
      const v = (n: ts.Node, inFn: boolean): void => {
        if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && /^(tx|tCount|tHtml)$/.test(n.expression.text) && !inFn) bad.push(`${x.rel}:${lineOf(sf, n)}`);
        const fn = inFn || ts.isFunctionLike(n);
        const stat = ts.isPropertyDeclaration(n) && !!n.modifiers?.some((m) => m.kind === ts.SyntaxKind.StaticKeyword);
        ts.forEachChild(n, (c) => v(c, stat ? false : fn));
      };
      v(sf, false);
    }
    assert.deepEqual(bad, []);
  });

  test('no list of translations is searched or compared (ids stay ids: a status, a part, a modifier, a lock kind)', () => {
    const bad: string[] = [];
    for (const x of ALL) {
      if (!x.src.includes('SR2E.Card.')) continue;
      const sf = parse(x);
      const lists = new Set<string>();
      const v = (n: ts.Node): void => {
        if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer && ts.isArrayLiteralExpression(n.initializer) && n.initializer.elements.some((e) => /^(tx|tCount)\(/.test(e.getText()))) lists.add(n.name.text);
        ts.forEachChild(n, v);
      };
      v(sf);
      const w = (n: ts.Node): void => {
        if (ts.isPropertyAccessExpression(n) && ts.isIdentifier(n.expression) && lists.has(n.expression.text) && /^(includes|indexOf|lastIndexOf|find|findIndex|some|every)$/.test(n.name.text)) bad.push(`${x.rel}:${lineOf(sf, n)} ${n.getText()}`);
        ts.forEachChild(n, w);
      };
      w(sf);
    }
    assert.deepEqual(bad, []);
  });

  test('the id lists the review found are plain again', () => {
    assert.match(INDEX, /const down3 = \['unconscious', 'dying', 'dead'\];/);
    assert.match(INDEX, /const auto = \['partialCover', 'attackerWalking', 'attackerRunning', 'laserSight'\];/);
    assert.match(INDEX, /const masking = \['invisibility', 'improvedInvisibility'/);
    assert.match(CHAT, /const CONTAGION = \['', 'airborne', 'contact', 'blood'\];/);
    assert.match(readFileSync(join(SRC, 'applications', 'look.ts'), 'utf8'), /const BODY_FLAGS = \['sr2e-reduced-motion', 'sr2e-see-through'\];/);
    assert.match(readFileSync(join(SRC, 'applications', 'sheets.ts'), 'utf8'), /const DEVICE_LOCKS = \["maglock", "door"\];/);
  });
});

describe('v0.89.3 what stays English on purpose', () => {
  test('v0.89.5: the outcome words are keys marked with ids, and outcomeBanner reads the ids (never the words)', () => {
    for (const w of ['<strong>Hit!</strong>', '<strong>Missed.</strong>', '<strong>Counterattack!</strong>', '<strong>Resisted.</strong>', "'Damage fully resisted.'", "'No drain.'", 'Takes <strong>']) assert.ok(!INDEX.includes(w), w);
    assert.doesNotMatch(INDEX, /html\.includes\('<strong>(Hit|Missed|Counterattack)/);
    assert.match(INDEX, /data-sr2e-outcome="\$\{id\}"/);
    for (const [k, v] of Object.entries({ hit: 'Hit!', missed: 'Missed.', counterattack: 'Counterattack!', resisted: 'Resisted.', fullyResisted: 'Damage fully resisted.', noDrain: 'No drain.', cleanMiss: 'Clean miss.' })) {
      assert.equal(KEYS[`SR2E.Card.Outcome.${k}`], v, k);
    }
  });

  test('the disease label picks its head before the text is built (no search for a translated "Resist")', () => {
    assert.doesNotMatch(INDEX, /#snapshot\(label\.replace\(\/\^Resist\//);
    // v0.89.5: no rewrite of a caller's label at all; a caller names where the dose came from instead
    assert.doesNotMatch(INDEX, /label\.replace\(\/\^Resist/);
    assert.match(INDEX, /const head = t\.label != null \? t\.label/);
    assert.equal(KEYS['SR2E.Card.Actor.resistInfectionFrom'], 'Resist infection: {name} (from {from})');
    assert.match(KEYS['SR2E.Card.Actor.resistInfection2'] ?? '', /^Resist infection: \{name\}$/);
  });

  test('the replaced-card notice, the tracker\'s delay buttons and the defend prompt are translated', () => {
    assert.doesNotMatch(CHAT, /REPLACED_TEXT/);
    assert.match(CHAT, /const replacedText = \(why: 'gm' \| 'newer'\): string => \(why === 'gm' \? tx\('SR2E\.Card\.Chat\.\w+'\) : tx\('SR2E\.Card\.Chat\.\w+'\)\);/);
    assert.doesNotMatch(CHAT, /label: 'Done'|label: 'Act now'|label: 'Delay'/);
    assert.doesNotMatch(CHAT, /'Resist the spell'|attacks with \$\{|to resist`/);
    assert.equal(KEYS['SR2E.Dialog.Chat.attacksWith'], '{attacker} attacks with {weaponName}');
  });
});

describe('v0.89.3 the converter\'s rules (a fixture run)', () => {
  const FIXTURE = `import { escText } from '../rules/html.ts';
declare const ChatMessage: any;
const AT_LOAD = ['loaded at start', 'not text either'];
export class SR2Actor {
  name = 'x';
  static KINDS = ['static field text'];
  async a(n: number, who: { name: string }) {
    await ChatMessage.create({ content: \`<p><strong>\${escText(this.name)}</strong> helps \${escText(who.name)}.</p>\` });
    await ChatMessage.create({ content: \`<p>\${escText(n)} round\${n === 1 ? '' : 's'} left.</p>\` });
    await ChatMessage.create({ content: \`<p><strong>Hit!</strong> Damage follows.</p>\` });
    const mode = 'full auto';
    if (mode === 'full auto') return;
    await this.update({ 'flags.sr2e.note': 'kept as data' });
    const tip = 'Shown in a title';
    await ChatMessage.create({ content: \`<p><button type="button" title="\${tip}" class="wide button">Press it now</button></p>\` });
    await this.#post(this.#snapshot(\`\${this.name} jumps the fence\`));
    const ids = ['full auto', 'semi auto'];
    if (ids.includes(mode)) return;
    const shownList = ['first line here', 'second line here'];
    await ChatMessage.create({ content: shownList.join('<br>') });
    if (\`\${this.name}\`.includes('plain words')) return;
  }
  #snapshot(label: string) { return { label }; }
  async #post(_s: unknown) {}
  async update(_d: unknown) {}
}
`;
  let out = '';
  let en: any = {};
  test('converts card text, counts and labels; keeps code values and stored data (v0.89.5: the outcome words convert too)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sr2e-cards-'));
    try {
      mkdirSync(join(dir, 'src', 'module', 'documents'), { recursive: true });
      mkdirSync(join(dir, 'public', 'lang'), { recursive: true });
      writeFileSync(join(dir, 'src', 'module', 'documents', 'index.ts'), FIXTURE);
      writeFileSync(join(dir, 'public', 'lang', 'en.json'), '{"SR2E":{}}\n');
      execFileSync(process.execPath, [join(ROOT, 'scripts', 'i18n-cards.mjs')], { cwd: dir, encoding: 'utf8' });
      out = readFileSync(join(dir, 'src', 'module', 'documents', 'index.ts'), 'utf8');
      en = JSON.parse(readFileSync(join(dir, 'public', 'lang', 'en.json'), 'utf8'));
    } finally { rmSync(dir, { recursive: true, force: true }); }
    const A = en.SR2E.Card.Actor as Record<string, any>;
    const vals = Object.values(A);
    assert.match(out, /import \{ t as tx, tCount \} from '\.\.\/helpers\/i18n\.ts';/);
    // a run of text with its values (escaped where they were)
    assert.ok(vals.includes('helps {whoName}.'), JSON.stringify(A));
    assert.match(out, /<\/strong> \$\{tx\('SR2E\.Card\.Actor\.\w+', \{ whoName: escText\(who\.name\) \}\)\}<\/p>/);
    // a count: one counted text, Number() where the English escaped it
    assert.ok(vals.some((v) => v && v.one === '{count} round left.' && v.other === '{count} rounds left.'));
    assert.match(out, /tCount\(Number\(n\), 'SR2E\.Card\.Actor\.\w+'\)/);
    // v0.89.5: the outcome word converts like any other text (outcomeBanner reads ids, not words), and so does the sentence after it
    assert.ok(vals.includes('Hit!'), JSON.stringify(A));
    assert.doesNotMatch(out, /<strong>Hit!<\/strong>/);
    assert.ok(vals.includes('Damage follows.'));
    // code values and stored data stay
    assert.match(out, /const mode = 'full auto';\n\s+if \(mode === 'full auto'\) return;/);
    assert.match(out, /'flags\.sr2e\.note': 'kept as data'/);
    // a local shown only in a title attribute, the button's text, and a test's label
    assert.match(out, /const tip = tx\('SR2E\.Card\.Actor\.\w+'\);/);
    assert.match(out, /class="wide button">\$\{tx\('SR2E\.Card\.Actor\.\w+'\)\}<\/button>/);
    assert.ok(vals.includes('{name} jumps the fence'));
    // v0.89.3 review: a searched list, text evaluated at module load and a search for plain words stay code
    assert.match(out, /const ids = \['full auto', 'semi auto'\];/);
    assert.match(out, /const AT_LOAD = \['loaded at start', 'not text either'\];/);
    assert.match(out, /static KINDS = \['static field text'\];/);
    assert.match(out, /\.includes\('plain words'\)/);
    // a list that is only joined into a card converts
    assert.ok(vals.includes('first line here') && vals.includes('second line here'));
  });
});
