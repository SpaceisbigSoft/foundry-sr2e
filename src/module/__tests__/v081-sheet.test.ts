/**
 * v0.81.0 fixer FX-SHEET: applications/sheets.ts, the sheet templates and the stylesheet.
 * sheets.ts can't be imported in node (it extends Foundry's sheet classes at load), so these tests read its source
 * with the TypeScript parser: the raw innerHTML writes (SEC2-2/3/4), the escaping of names in dialog HTML (S-1, S-2,
 * S-10), and the S-3..S-16 fixes. Small pure helpers (pickOne, spliceRow) are cut out, compiled and run.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { escHtml } from '../rules/html.ts';
import { t } from '../helpers/i18n.ts';

const read = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8');
const SRC = read('src', 'module', 'applications', 'sheets.ts');
const CSS = read('public', 'style', 'sr2e.css');
const sf = ts.createSourceFile('sheets.ts', SRC, ts.ScriptTarget.Latest, true);

function walk(n: ts.Node, f: (n: ts.Node) => void): void { f(n); ts.forEachChild(n, (c) => walk(c, f)); }
const lineOf = (n: ts.Node) => sf.getLineAndCharacterOfPosition(n.getStart()).line + 1;
function strip(e: ts.Expression): ts.Expression {
  while (ts.isParenthesizedExpression(e) || ts.isAsExpression(e) || ts.isNonNullExpression(e)) e = e.expression;
  return e;
}
const isEsc = (e: ts.Expression): boolean => {
  e = strip(e);
  if (!ts.isCallExpression(e)) return false;
  if (e.expression.getText() === 'escHtml') return true;
  // v0.89.6: a translation (the system's own text) whose every value is escaped
  if (e.expression.getText() === 'tx' && e.arguments.length <= 2) {
    const d = e.arguments[1];
    return !d || (ts.isObjectLiteralExpression(d) && d.properties.every((p) => ts.isPropertyAssignment(p) && isEsc(p.initializer)));
  }
  return false;
};
const HTMLISH = /<\/?[a-zA-Z][a-zA-Z0-9-]*[\s>/]/;
const tplText = (t: ts.TemplateExpression) => t.head.text + t.templateSpans.map((s) => s.literal.text).join('');

/** The text of a top-level function or a class's static method, by name. */
function fnSource(name: string): string {
  let out = '';
  walk(sf, (n) => {
    if (out) return;
    if (ts.isFunctionDeclaration(n) && n.name?.text === name) out = n.getText();
    if (ts.isMethodDeclaration(n) && n.name.getText() === name) out = n.getText();
  });
  assert.ok(out, `found ${name}`);
  return out;
}
/** Compile one top-level function and return it, with the given globals in scope. */
function compile(name: string, scope: Record<string, unknown>): any {
  const js = ts.transpileModule(fnSource(name), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
  const keys = Object.keys(scope);
  return new Function(...keys, `${js}\nreturn ${name};`)(...keys.map((k) => scope[k]));
}

/**
 * Every `${…}` that ends up in HTML must be escaped, a number, or a reviewed HTML fragment. Spans of a
 * nested template are checked where they sit.
 */
function unescapedSpans(t: ts.TemplateExpression, allowed: ReadonlySet<string>): string[] {
  const bad: string[] = [];
  for (const s of t.templateSpans) {
    const e = strip(s.expression);
    if (isEsc(e) || allowed.has(e.getText())) continue;
    if (ts.isConditionalExpression(e)) {
      for (const side of [e.whenTrue, e.whenFalse]) {
        const x = strip(side);
        if (ts.isStringLiteral(x) || ts.isNoSubstitutionTemplateLiteral(x) || isEsc(x)) continue;
        if (ts.isTemplateExpression(x)) bad.push(...unescapedSpans(x, allowed));
        else bad.push(x.getText());
      }
      continue;
    }
    bad.push(e.getText());
  }
  return bad;
}

describe('v0.81.0 FX-SHEET: raw innerHTML writes (SEC2-2, SEC2-3, SEC2-4)', () => {
  // The only reviewed exceptions: numbers and HTML fragments whose own parts are escaped where they are built.
  // v0.89.6: pvLine is one of four tx() texts whose values are escaped just before (the attack preview's dice line)
  const SAFE_SPANS = new Set(['rows', 'content', 'pvLine']);
  const SAFE_CALLS = new Set(['render(read(form))', 'fill(form, excluded)']);

  test('sheets.ts writes no unescaped ${…} into innerHTML', () => {
    const sites: string[] = [];
    const bad: string[] = [];
    walk(sf, (n) => {
      if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken && /\.innerHTML$/.test(n.left.getText())) {
        sites.push(`${lineOf(n)} ${n.right.getText().slice(0, 40)}`);
        const r = strip(n.right);
        if (ts.isTemplateExpression(r)) bad.push(...unescapedSpans(r, SAFE_SPANS).map((x) => `${lineOf(n)}: ${x}`));
        else if (!ts.isNoSubstitutionTemplateLiteral(r) && !ts.isStringLiteral(r) && !SAFE_CALLS.has(r.getText())) bad.push(`${lineOf(n)}: ${r.getText()}`);
      }
      if (ts.isCallExpression(n) && /insertAdjacentHTML$/.test(n.expression.getText())) bad.push(`${lineOf(n)}: insertAdjacentHTML`);
    });
    assert.ok(sites.length >= 4, sites.join('\n'));
    assert.deepEqual(bad, []);
  });

  test('SEC2-2: the Shift-click quick attack parses its form inside an inert <template>', () => {
    const src = fnSource('#onAttackWeapon');
    assert.ok(!/document\.createElement\("form"\)/.test(src));
    assert.match(src, /const tpl = document\.createElement\("template"\);\s*tpl\.innerHTML = `<form>\$\{content\}<\/form>`;\s*const form = tpl\.content\.querySelector\("form"\)/);
    // The names in it are escaped anyway: targeted tokens (full auto), cover notes, limbs, the range note.
    assert.match(src, /> \$\{escHtml\(t\.name\)\}<\/label>/);
    assert.match(src, /\$\{escHtml\(coverNote\(here\)\)\}/);
    assert.match(src, /\$\{escHtml\(latest\.note\)\}/);
  });

  test('SEC2-3: the Build window\'s check rows escape the label, counts and note (skill names over the cap)', () => {
    const src = fnSource('#onBuildCheck');
    assert.ok(src.includes('${escHtml(r.label)}</td><td>${escHtml(r.used)}</td><td>${escHtml(r.allowed)}</td><td>${escHtml(r.note ?? "")}</td>'));
    assert.ok(src.includes('tb.innerHTML = render(read(form))'));
  });

  test('SEC2-4: the attack preview escapes the ammunition warning (it carries the weapon name)', () => {
    assert.ok(SRC.includes('<p class="sr2e-warn">${escHtml(pv.ammoShort)}</p>'));
    assert.ok(/tx\('SR2E\.Dialog\.Sheet\.\w+', \{[^}]*\b\w+: escHtml\(skill\.name\)/.test(SRC), 'the skill name is escaped where it is filled in (v0.89.2: inside tx())');
  });

  test('the preview helper escapes without a raw fallback (SEC2-10)', () => {
    const src = fnSource('tnPreviewHtml');
    assert.ok(!src.includes('escapeHTML'));
    assert.match(src, /escHtml\(m\.label\)/);
  });
});

describe('v0.81.0 FX-SHEET: names and typed text in dialog HTML (S-1, S-2, S-10)', () => {
  test('one escape helper: rules/html.ts escHtml, no local copies', () => {
    assert.match(SRC, /^import \{ escHtml \} from "\.\.\/rules\/html\.ts";$/m);
    assert.ok(!/function escHtml\(/.test(SRC));
    assert.ok(!/const esc = /.test(SRC));
    assert.ok(!SRC.includes('.replace(/"/g, "&quot;")'));
    assert.ok(!SRC.includes('.replace(/</g, "&lt;")'));
    assert.ok(!SRC.includes('escapeHTML'));
  });

  test('no document text goes into an HTML template without escHtml', () => {
    // Property reads that carry names or typed text (documents, flags, items a player owns).
    const TEXTY = /\.(name|label|notes?|role|skills|from|to|specialization|concentration|source|reason|text|event|icType|domain|title)$/;
    const bad: string[] = [];
    walk(sf, (n) => {
      if (!ts.isTemplateExpression(n)) return;
      // Only templates that build HTML, or are nested in one.
      let html = HTMLISH.test(tplText(n));
      let escaped = false;
      for (let p = n.parent; p; p = p.parent) {
        if (ts.isTemplateExpression(p) && HTMLISH.test(tplText(p))) html = true;
        if (ts.isCallExpression(p) && isEsc(p)) escaped = true;
      }
      if (!html || escaped) return;
      for (const s of n.templateSpans) {
        let e = strip(s.expression);
        if (ts.isBinaryExpression(e) && [ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.BarBarToken].includes(e.operatorToken.kind)) e = strip(e.left);
        if ((ts.isPropertyAccessExpression(e) || ts.isElementAccessExpression(e)) && TEXTY.test(e.getText().replace(/\?\./g, '.'))) bad.push(`${lineOf(s)}: ${e.getText()}`);
      }
    });
    assert.deepEqual(bad, []);
  });

  test('pickOne escapes every option\'s value and label (and its doc sits on it)', async () => {
    let content = '';
    const foundry = { applications: { api: { DialogV2: { prompt: async (o: any) => { content = o.content; return 'x'; } } } } };
    const pickOne = compile('pickOne', { foundry, escHtml, tx: t });
    assert.equal(await pickOne('t', [{ value: '"><img src=x onerror=alert(1)>', label: '<b>Bad & "Co"</b>' }]), 'x');
    assert.ok(!content.includes('<img') && !content.includes('<b>'), content);
    assert.ok(content.includes('<option value="&quot;&gt;&lt;img src=x onerror=alert(1)&gt;">&lt;b&gt;Bad &amp; &quot;Co&quot;&lt;/b&gt;</option>'), content);
    assert.match(SRC, /\/\*\* Pick one option from a list \(null if cancelled\)\.[^\n]*\*\/\nasync function pickOne\(/);
  });

  test('S-2: the contact form keeps a value with quotes (role, skills, notes and name are escaped)', () => {
    const src = fnSource('#contactForm');
    for (const k of ['c.name', 'c.role ?? ""', 'c.skills ?? ""', 'c.notes ?? ""']) assert.ok(src.includes(`value="\${escHtml(${k})}"`), k);
  });
});

describe('v0.81.0 FX-SHEET: sheet handler fixes', () => {
  test('S-3: "Clear all here" clears every actor that has a signature at the scene, token actors included', () => {
    const src = fnSource('#onShowSignatures');
    assert.ok(!src.includes('for (const a of game.actors ?? []) await'));
    assert.match(src, /for \(const a of allActors\(\)\) if \(.*\.some\(\(s: any\) => s\?\.sceneId === sceneId\)\) await a\.clearSignatures/);
  });

  test('S-4: Reload spends the action only after the "full" check and after the clip is picked', () => {
    const src = fnSource('#onReloadWeapon');
    const useAction = src.indexOf('actor.useAction(');
    const firstSpend = src.indexOf('await spend()');
    assert.ok(useAction > 0 && src.indexOf('const spend = async') < useAction && useAction < src.indexOf('if (weapon.system.jammed)'));
    assert.ok(src.indexOf('is full.') < firstSpend, 'full check first');
    const prompt = src.indexOf('DialogV2.prompt(');
    const cancel = src.indexOf('if (pick === null || pick === undefined) return;');
    assert.ok(prompt > 0 && cancel > prompt && src.indexOf('await spend()', cancel) > cancel, 'clip picked, then the action');
    assert.ok(src.slice(prompt, src.indexOf('await spend()', cancel)).split('await spend()').length === 1, 'no spend between the picker and the cancel check');
  });

  test('S-5: the final target is checked for invisibility, only after the dialog (R2-REST 4: v081-r2rest)', () => {
    const src = fnSource('#onAttackWeapon');
    const after = src.indexOf('if (!choice) return;');
    assert.ok(after > 0);
    assert.match(src.slice(after), /choice\.targetUuid[\s\S]{0,200}actor\.seeThroughInvisibility\(picked\)/);
  });

  test('S-6: a row removal with a missing or stale index removes nothing', () => {
    const spliceRow = compile('spliceRow', {});
    const el = (index?: string) => ({ dataset: index === undefined ? {} : { index } });
    const list = ['a', 'b', 'c'];
    assert.equal(spliceRow(list, el()), false);
    assert.equal(spliceRow(list, el('')), false);
    assert.equal(spliceRow(list, el('x')), false);
    assert.equal(spliceRow(list, el('1.5')), false);
    assert.equal(spliceRow(list, el('-1')), false);
    assert.equal(spliceRow(list, el('3')), false);
    assert.deepEqual(list, ['a', 'b', 'c']);
    assert.equal(spliceRow(list, el('1')), true);
    assert.deepEqual(list, ['a', 'c']);
    assert.ok(!/list\.splice\(Number\(/.test(SRC));
  });

  test('S-7: Dismiss stops when tokens can\'t be removed, and posts its card after the actor is deleted', () => {
    // R2-REST 5 moved the deletion into dismissSpiritNow (tested in v081-r2rest).
    const src = fnSource('dismissSpiritNow');
    assert.match(src, /if \(left\.length\) return \{ ok: false/);
    assert.ok(src.indexOf('await actor.delete()') < src.indexOf('ChatMessage.create('));
    assert.ok(src.includes('${escHtml(name)}'));
  });

  test('S-8: the suppressive fire confirm doesn\'t reject on close', () => {
    assert.match(fnSource('#onSuppressFire'), /DialogV2\.confirm\(\{[^\n]*rejectClose: false/);
  });

  test('S-9: dead handler, helpers and context keys are gone', () => {
    for (const dead of ['#onCancelTraining', 'cancelTraining:', 'function monitorTracks', 'monitorTracks:', 'function matrixBoxes', 'matrixBoxes(', 'monitorMax:', 'knowsQuickening', 'backgroundCount: SR2Actor', 'bgHint', '#worldTemplates']) {
      assert.ok(!SRC.includes(dead), dead);
    }
    const sum = fnSource('summaryContext');
    assert.match(sum, /return \{ pools, chips \};/);
    assert.match(fnSource('#onSetPool'), /poolsOf\(actor\)/);
  });

  test('S-14: moved doc comments sit on their functions', () => {
    for (const [doc, fn] of [
      ['sweep someone (or yourself) for bugs. */', 'static async #onSweepBugs('],
      ['Expose people to a toxin: the targeted tokens, or a pick from the scene\'s tokens and world actors. */', 'static async #onExpose('],
      ['Falling, fire, drowning, cold, fatigue. */', 'static async #onHazard('],
      ['the user\'s current targets are pre-ticked. */', 'function areaTargetRows('],
      ['pick a target in its host and a carried attack utility. */', 'export async function frameAttackDialog('],
      ['Tabs: which exist for this actor, and which is open. */', 'function sheetLayout('],
      ['or a character\'s jammer gear). */', 'export async function jamDialog('],
    ] as const) assert.ok(SRC.includes(`${doc}\n${fn.startsWith('static') ? '  ' : ''}${fn}`), fn);
    assert.ok(!SRC.includes('What the build check needs from an actor'));
  });

  test('S-15: a sheaf step\'s copies are capped by RULES.SECURITY_V61.sheafIc.maxCopies, not 8', () => {
    const src = fnSource('#stepDialog');
    assert.ok(!src.includes('Math.min(8,'));
    assert.match(src, /Math\.min\(RULES\.SECURITY_V61\.sheafIc\.maxCopies, /);
  });
});

describe('v0.81.0 FX-SHEET: stylesheet (S-16)', () => {
  test('dead selectors are gone', () => {
    for (const dead of ['.sr2e-tracks', '.sr2e-state-unconscious', '.sr2e-state-dying', '.sr2e-state-dead', '.sr2e-weapons']) assert.ok(!CSS.includes(dead), dead);
  });
  test('layered overrides are folded into one rule each', () => {
    const count = (re: RegExp) => (CSS.match(re) ?? []).length;
    assert.equal(count(/^\.sr2e\.sheet \.sr2e-stat \{/gm), 1);
    assert.equal(count(/^\.sr2e\.sheet \.sr2e-stat input\[type="number"\] \{/gm), 1);
    assert.equal(count(/^\.sr2e-chip \{/gm), 1);
    assert.equal(count(/^\.sr2e-hover-card \{/gm), 1);
    assert.equal(count(/^a\.sr2e-inline-test \{/gm), 1);
    assert.match(CSS, /^\.sr2e\.sheet \.sr2e-stat \{[^}]*width: 2\.85rem;/m);
    assert.match(CSS, /^\.sr2e-hover-card \{[^}]*background: var\(--sr2e-window\)/m);
  });
});
