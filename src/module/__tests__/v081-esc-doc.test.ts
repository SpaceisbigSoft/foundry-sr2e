/**
 * v0.81.0 sweeper ESC-DOC: the escaping sweep of documents/index.ts. Every name, label or other text that goes into a
 * card's HTML is escaped with `escText` (= rules/html.ts `escHtml`) where it is interpolated, once; HTML fragments
 * (rows, buttons, notes built from escaped parts) and `describeResult` labels (it escapes them itself) are not.
 *
 * 1. A static guard over the source: no name-like property (`.name`, `.label`, `…Name`) is interpolated raw into an
 *    HTML template, except as plain text inside a call's argument (a `describeResult` label and the like).
 * 2. Cards built from hostile names: escaped once (no markup survives, nothing is escaped twice).
 */
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';

const SRC = readFileSync(join(process.cwd(), 'src', 'module', 'documents', 'index.ts'), 'utf8');
const sf = ts.createSourceFile('index.ts', SRC, ts.ScriptTarget.Latest, true);
const HTMLISH = /<\/?[a-zA-Z][a-zA-Z0-9-]*[\s>/]|&[a-z#0-9]+;/;
const tplText = (t: ts.TemplateExpression) => t.head.text + t.templateSpans.map((s) => s.literal.text).join('');
const lineOf = (n: ts.Node) => sf.getLineAndCharacterOfPosition(n.getStart()).line + 1;

/** Whether a `${…}` ends up in HTML: its own template has markup, or it climbs (through plain templates, `?:`, `??`, `||`) to one without crossing a call. */
function inHtml(span: ts.TemplateSpan): boolean {
  let n: ts.Node = span.parent;
  for (let p: ts.Node | undefined = n; p; n = p, p = p.parent) {
    if (ts.isTemplateExpression(p)) { if (HTMLISH.test(tplText(p))) return true; continue; }
    if (ts.isTemplateSpan(p) || ts.isParenthesizedExpression(p) || ts.isConditionalExpression(p)) continue;
    if (ts.isBinaryExpression(p) && [ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.AmpersandAmpersandToken].includes(p.operatorToken.kind)) continue;
    return false;
  }
  return false;
}
/**
 * v0.89.3: card text moved into lang/en.json, so a value can reach the HTML through a `tx()` / `tCount()` data object
 * (`${tx('SR2E.Card.Actor.key', { name: escText(x.name) })}`): the value lands in HTML when its call does.
 */
function exprInHtml(e: ts.Node): boolean {
  let n: ts.Node = e;
  for (let p: ts.Node | undefined = n.parent; p; n = p, p = p.parent) {
    if (ts.isParenthesizedExpression(p) || ts.isConditionalExpression(p)) continue;
    if (ts.isBinaryExpression(p) && [ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.AmpersandAmpersandToken].includes(p.operatorToken.kind)) continue;
    if (ts.isTemplateSpan(p)) return inHtml(p);
    if ((ts.isPropertyAssignment(p) || ts.isShorthandPropertyAssignment(p))) return txValueInHtml(p);
    return false;
  }
  return false;
}
function txValueInHtml(prop: ts.ObjectLiteralElementLike): boolean {
  const o = prop.parent;
  if (!ts.isObjectLiteralExpression(o)) return false;
  const call = o.parent;
  if (!(ts.isCallExpression(call) && ts.isIdentifier(call.expression) && /^(tx|tCount)$/.test(call.expression.text) && call.arguments.includes(o))) return false;
  return exprInHtml(call);
}
/** A name-like value read straight from data: `x.name`, `x?.label`, `c.targetName`, with or without a literal fallback. */
function nameLike(e: ts.Expression): boolean {
  while (ts.isParenthesizedExpression(e) || ts.isNonNullExpression(e) || ts.isAsExpression(e)) e = e.expression;
  if (ts.isBinaryExpression(e) && [ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(e.operatorToken.kind)) return nameLike(e.left) || nameLike(e.right);
  if (ts.isConditionalExpression(e)) return nameLike(e.whenTrue) || nameLike(e.whenFalse);
  return ts.isPropertyAccessExpression(e) && /^(name|label|\w+Name)$/.test(e.name.text);
}

describe('v0.81.0 ESC-DOC: names in card HTML are escaped', () => {
  test('documents/index.ts interpolates no raw name or label into HTML', () => {
    const bad: string[] = [];
    let checked = 0;
    const walk = (n: ts.Node) => {
      if (ts.isTemplateSpan(n) && inHtml(n)) {
        checked++;
        if (nameLike(n.expression)) bad.push(`${lineOf(n)}: ${n.expression.getText()}`);
      }
      // v0.89.3: a value given to a translation that lands in HTML
      if ((ts.isPropertyAssignment(n) || ts.isShorthandPropertyAssignment(n)) && txValueInHtml(n)) {
        checked++;
        const v = ts.isPropertyAssignment(n) ? n.initializer : n.name;
        if (nameLike(v)) bad.push(`${lineOf(n)}: ${n.getText()}`);
      }
      ts.forEachChild(n, walk);
    };
    walk(sf);
    assert.ok(checked > 2000, `scanned ${checked} spans`);
    assert.deepEqual(bad, []);
  });

  test('describeResult is the one place a card title is escaped (its labels are passed raw)', () => {
    // A label pre-escaped by a caller would show "&amp;" on the card.
    const pre: string[] = [];
    const walk = (n: ts.Node) => {
      if (ts.isCallExpression(n) && n.expression.getText() === 'describeResult') {
        const a = n.arguments[0];
        if (a && /escText\(|escHtml\(|escContent\(/.test(a.getText())) pre.push(`${lineOf(n)}: ${a.getText().slice(0, 60)}`);
      }
      ts.forEachChild(n, walk);
    };
    walk(sf);
    assert.deepEqual(pre, []);
  });
});

describe('v0.81.0 ESC-DOC: cards built from hostile names', () => {
  const g = globalThis as any;
  let SR2Actor: any;
  before(async () => {
    g.foundry = {
      abstract: { TypeDataModel: class {} },
      data: { fields: new Proxy({}, { get: () => class { constructor(..._a: any[]) {} } }) },
      utils: { randomID: () => 'r1', deepClone: (o: any) => JSON.parse(JSON.stringify(o)), getProperty: () => undefined },
      applications: { api: { DialogV2: { confirm: async () => false, prompt: async () => null, wait: async () => null } } },
    };
    g.ChatMessage ??= { create: async (d: any) => d, getSpeaker: () => ({}) };
    g.Hooks ??= { on: () => {}, once: () => {}, callAll: () => {} };
    g.game ??= { i18n: { localize: (k: string) => k }, settings: { get: () => undefined, register: () => {} }, users: [], actors: [] };
    g.Actor ??= class {};
    g.Item ??= class {};
    g.Combatant ??= class {};
    g.Combat ??= class {};
    g.fromUuidSync ??= () => null;
    ({ SR2Actor } = await import('../documents/index.ts'));
  });

  const result = (successes: number) => ({
    dice: [{ faces: [5], total: 5, success: true }], successes, botch: false, totalDice: 1, targetNumber: 4, baseTargetNumber: 4,
    modifiers: [{ label: "Bob's <i>smoke</i>", value: 2 }], targetNumberClamped: false,
  });
  const HOSTILE = `<b>Bo</b> & 'Al'`;
  const TARGET = `"Eve"<img src=x>`;
  const noDouble = (html: string) => assert.doesNotMatch(html, /&amp;(amp|lt|gt|quot|#39);/, 'nothing escaped twice');
  const noMarkup = (html: string) => { assert.doesNotMatch(html, /<b>Bo|<img|<i>smoke/, 'no markup from a name'); };

  test('a perception contest: actor, target and labels are escaped once', () => {
    const html: string = SR2Actor.contestContent({
      kind: 'perceive', actorName: HOSTILE, targetName: TARGET,
      sides: [{ name: HOSTILE, label: `${HOSTILE}: Perception`, result: result(3) }, { name: TARGET, label: `${TARGET}: Stealth`, result: result(1) }],
    });
    noMarkup(html); noDouble(html);
    assert.match(html, /<strong>&lt;b&gt;Bo&lt;\/b&gt; &amp; &#39;Al&#39; notices &quot;Eve&quot;&lt;img src=x&gt;<\/strong>/);
    // The card titles (describeResult): escaped once, quotes kept as they read.
    assert.match(html, /<h3>&lt;b&gt;Bo&lt;\/b&gt; &amp; 'Al': Perception<\/h3>/);
    assert.match(html, /title="TN: Base 4; Bob&#39;s &lt;i&gt;smoke&lt;\/i&gt; \+2"/);
  });

  test('a sneak contest: watchers and the sneak are escaped once', () => {
    const html: string = SR2Actor.contestContent({
      kind: 'sneak', actorName: HOSTILE,
      sides: [{ name: HOSTILE, label: 'Sneak', result: result(1) }, { name: TARGET, label: 'Watch', result: result(3) }, { name: "O'Neil & Co", label: 'Watch', result: null, why: '<u>asleep</u>' }],
    });
    noMarkup(html); noDouble(html);
    assert.doesNotMatch(html, /<u>/);
    assert.match(html, /<li>O&#39;Neil &amp; Co: can&#39;t notice|<li>O&#39;Neil &amp; Co: can't notice/);
    assert.match(html, /<strong>Seen<\/strong> by &quot;Eve&quot;&lt;img src=x&gt;\./);
  });
});
