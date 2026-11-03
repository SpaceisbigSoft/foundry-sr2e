#!/usr/bin/env node
/**
 * v0.89.3: move the chat cards' text into lang/en.json (`SR2E.Card.<File>.*`).
 *
 * Which text is a card's: a data-flow check (`shown`). A string or template literal converts only when every way its
 * value can go ends on a card, never in code:
 * - the `content`, `flavor` or speaker `alias` of a chat message's data (`ChatMessage.create`, `withRollMode`, a local
 *   holding the data), and the `html` of a resolved test (`{ html, flags, snap }`, `r.html += …`);
 * - through `?:` branches, `||` / `??` / `+`, escHtml and the other wrappers, template values in text (not inside a
 *   tag, except the shown attributes: title, aria-label, data-tooltip, placeholder, alt), locals and parameters (all
 *   their reads must be shown; a read is neutral when it only tests the value: `if (x)`, `x ? :`, `x.length`), arrays
 *   joined into a card (`push`, `join`, `filter`), `.map` callbacks whose results are joined, returns of same-file
 *   functions whose every call is shown, a test's label (`#snapshot(label, …)`: the label is only ever shown).
 * - Anything else (a comparison, a key, a stored flag, a call into another file, a search pattern) stops it.
 * Nested text converts on the next pass (a value inside a `tx(…)` data object is shown when the tx call is), so the
 * script loops each file to a fixed point.
 *
 * HTML: tags stay in the code; each run of text between tags (with its `${…}` values) becomes one string kept as HTML
 * source, as in v0.89.2. A run whose wording depends on one count (`n === 1 ? '' : 's'`, `n === 1 ? 'die' : 'dice'`,
 * `is`/`are`) becomes one counted key: `tCount(n, 'SR2E.Card.<File>.key', { … })` with `one` / `other` texts (the
 * count itself is `{count}`).
 *
 * v0.89.5: the outcome words outcomeBanner used to read back from the card are keys now (`SR2E.Card.Outcome`, marked
 * with `data-sr2e-outcome` ids), so nothing is left English on purpose any more.
 *
 *   node scripts/i18n-cards.mjs           convert, add the keys
 *   node scripts/i18n-cards.mjs --check   report what is left (exit 1 when something could still be converted)
 *   node scripts/i18n-cards.mjs --why     also list the English literals in card files that stay, with the reason
 */
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'src', 'module');
const LANG = path.join(ROOT, 'public', 'lang', 'en.json');
const I18N = path.join(SRC, 'helpers', 'i18n.ts');
const CHECK = process.argv.includes('--check');
const WHY = process.argv.includes('--why');
const ALIAS = 'tx';
const ATTRS = new Set(['title', 'placeholder', 'aria-label', 'data-tooltip', 'alt']);

const GROUP_OF = { 'documents/index.ts': 'Actor', 'applications/chat.ts': 'Chat', 'applications/sheets.ts': 'Sheet' };
const groupOf = (rel) => GROUP_OF[rel] ?? path.basename(rel, '.ts').replace(/(^|[-_])(\w)/g, (_m, _a, c) => c.toUpperCase());

const lang = JSON.parse(fs.readFileSync(LANG, 'utf8'));
lang.SR2E ??= {};
/** v0.89.4: card text goes to SR2E.Card; a window's own text in the UI files (settings.ts) to SR2E.App. */
const STORES = { Card: (lang.SR2E.Card ??= {}), App: (lang.SR2E.App ??= {}) };

function slug(text) {
  const words = text.replace(/\{[^}]*\}/g, ' ').replace(/<[^>]*>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/[^A-Za-z0-9 ]+/g, ' ').trim().split(/\s+/).filter(Boolean).slice(0, 6);
  const s = words.map((w, i) => (i ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w.toLowerCase())).join('').slice(0, 40);
  return /^[0-9]/.test(s) ? `n${s}` : s || 'text';
}
let added = 0;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const COUNT = (lang.SR2E.Count ??= {});
/** A shared counted noun (`SR2E.Count.<noun>`: "{count} word" / "{count} words"), reused when the texts match. */
function countNounKey(noun, one, other) {
  const base = slug(other.replace('{count}', '')) || 'thing';
  const want = { one, other };
  for (const [k, v] of Object.entries(COUNT)) if (same(v, want)) return `SR2E.Count.${k}`;
  let k = base;
  for (let n = 2; Object.hasOwn(COUNT, k); n++) k = `${base}${n}`;
  COUNT[k] = want;
  added++;
  void noun;
  return `SR2E.Count.${k}`;
}
/** The key for a text (a string, or { one, other } for a counted text): an existing key with the same text, else a new one. */
function keyFor(group, english, store = 'Card') {
  const g = (STORES[store][group] ??= {});
  for (const [k, v] of Object.entries(g)) if (same(v, english)) return `SR2E.${store}.${group}.${k}`;
  const base = slug(typeof english === 'string' ? english : english.other);
  let k = base;
  for (let n = 2; Object.hasOwn(g, k); n++) k = `${base}${n}`;
  g[k] = english;
  added++;
  return `SR2E.${store}.${group}.${k}`;
}

// ---------------------------------------------------------------- shared with i18n-dialogs.mjs (copied)
const RESERVED = new Set('break case catch class const continue debugger default delete do else enum export extends false finally for function if import in instanceof new null return super switch this throw true try typeof var void while with yield let static implements interface package private protected public await count'.split(' '));
const WRAPPERS = /^(escHtml|escText|esc|escContent|String|Number|cap|tKey|Math\.\w+|safeInt|signed|fmt\w*)$/;
const DROP = new Set(['this', 'sys', 'system', 'flags', 'data', 'game', 'ctx', 'snap', 'opts', 'o', 'r', 'a', 'b', 'c', 'x', 'f', 's', 'e', 'i', 'n', 'p', 'v', 'g', 'm', 'd', 'k', 't', 'l', 'w', 'q', 'h', 'u', 'y', 'z', 'it', 'parent', 'RULES', 'CONFIG', 'SR2E', 'B', 'L', 'R']);
const camel = (w) => (/^[A-Z0-9_]+$/.test(w) && /[A-Z]/.test(w) ? w.toLowerCase().replace(/_([a-z0-9])/g, (_m, c) => c.toUpperCase()) : w);
function strip(e) {
  while (ts.isParenthesizedExpression(e) || ts.isAsExpression(e) || ts.isNonNullExpression(e) || (ts.isSatisfiesExpression?.(e))) e = e.expression;
  return e;
}
const isLit = (e) => ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e);
const hasWord = (s) => /[A-Za-z]{2,}/.test(s.replace(/&[a-z#0-9]+;/gi, ' '));
function nameOf(expr) {
  let e = strip(expr);
  for (let guard = 0; guard < 8; guard++) {
    e = strip(e);
    if (ts.isCallExpression(e)) {
      const callee = e.expression.getText().replace(/\?\./g, '.');
      if (WRAPPERS.test(callee) && e.arguments[0]) { e = e.arguments[0]; continue; }
      if (ts.isPropertyAccessExpression(e.expression) && /^(toLocaleString|toString|toFixed|toLowerCase|toUpperCase|trim)$/.test(e.expression.name.text)) { e = e.expression.expression; continue; }
      if (ts.isPropertyAccessExpression(e.expression) && e.expression.name.text === 'join') { e = e.expression.expression; continue; }
      if (ts.isPropertyAccessExpression(e.expression) && e.expression.name.text === 'map') { e = e.expression.expression; continue; }
      if (ts.isIdentifier(e.expression) && /^(tx|tCount)$/.test(e.expression.text)) return 'part';
      if (!ts.isIdentifier(e.expression) && !ts.isPropertyAccessExpression(e.expression)) return 'part';
      const last = callee.split('.').pop() ?? 'value';
      return clean(last.replace(/^#/, '').replace(/^(get|describe|format|label|fmt)(?=[A-Z])/, '').replace(/^./, (c) => c.toLowerCase()));
    }
    if (ts.isBinaryExpression(e) && [ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.BarBarToken].includes(e.operatorToken.kind)) { e = e.left; continue; }
    break;
  }
  if (ts.isConditionalExpression(e)) {
    const lits = [e.whenTrue, e.whenFalse].map(strip);
    if (lits.every((l) => isLit(l) && /^[^A-Za-z]*$/.test(l.text))) return 'mark';
    return 'part';
  }
  if (ts.isElementAccessExpression(e)) return nameOf(e.expression);
  const parts = [];
  let x = e;
  while (ts.isPropertyAccessExpression(x)) { parts.unshift(x.name.text.replace(/^#/, '')); x = strip(x.expression); }
  if (ts.isIdentifier(x)) parts.unshift(x.text);
  const kept = parts.filter((p) => !DROP.has(p)).map(camel);
  if (!kept.length) return parts.length ? clean(camel(parts[parts.length - 1])) : 'value';
  const two = kept.slice(-2);
  return clean(two.map((w, i) => (i ? w.charAt(0).toUpperCase() + w.slice(1) : w.charAt(0).toLowerCase() + w.slice(1))).join(''));
}
function clean(n) {
  n = String(n).replace(/[^A-Za-z0-9_]/g, '');
  if (!n || /^[0-9]/.test(n)) n = `v${n}`;
  if (RESERVED.has(n)) n = `${n}Value`;
  return n.charAt(0).toLowerCase() + n.slice(1);
}
function applyEdits(src, base, edits) {
  let out = src;
  for (const [s, e, t] of [...edits].sort((a, b) => b[0] - a[0])) out = out.slice(0, s - base) + t + out.slice(e - base);
  return out;
}
const lineOf = (sf, n) => sf.getLineAndCharacterOfPosition(n.getStart()).line + 1;
const notes = [];
const why = [];

/** Text used to search other text is code: translating it breaks the match. */
function isPattern(e) {
  let n = e;
  while (n.parent && (ts.isParenthesizedExpression(n.parent) || ts.isTemplateSpan(n.parent) || ts.isTemplateExpression(n.parent) || ts.isConditionalExpression(n.parent) || ts.isBinaryExpression(n.parent))) n = n.parent;
  const c = n.parent;
  return !!c && ts.isCallExpression(c) && c.arguments.includes(n) && ts.isPropertyAccessExpression(c.expression) && /^(replace|replaceAll|includes|indexOf|lastIndexOf|split|startsWith|endsWith|match|matchAll|search)$/.test(c.expression.name.text);
}

// ---------------------------------------------------------------- the data-flow check
/** A count condition `n === 1` / `n !== 1` (either side): { n, one } where one says which branch is the `one` form. */
function countCond(cond) {
  const c = strip(cond);
  if (!ts.isBinaryExpression(c)) return null;
  const op = c.operatorToken.kind;
  const eq = op === ts.SyntaxKind.EqualsEqualsEqualsToken || op === ts.SyntaxKind.EqualsEqualsToken;
  const ne = op === ts.SyntaxKind.ExclamationEqualsEqualsToken || op === ts.SyntaxKind.ExclamationEqualsToken;
  if (!eq && !ne) return null;
  const isOne = (x) => ts.isNumericLiteral(strip(x)) && strip(x).text === '1';
  const n = isOne(c.right) ? c.left : isOne(c.left) ? c.right : null;
  return n ? { n, oneIsTrue: eq } : null;
}
/** A value whose text depends on a count: `n === 1 ? 'a' : 'b'` with literal branches. */
function countChoice(expr) {
  const e = strip(expr);
  if (!ts.isConditionalExpression(e)) return null;
  const a = strip(e.whenTrue);
  const b = strip(e.whenFalse);
  if (!isLit(a) || !isLit(b)) return null;
  const cc = countCond(e.condition);
  if (!cc) return null;
  return { n: cc.n, one: cc.oneIsTrue ? a.text : b.text, other: cc.oneIsTrue ? b.text : a.text };
}
/** The source text of a count expression with its wrappers taken off, to match `${escText(n)}` with `n === 1`. */
function countKey(e) {
  let x = strip(e);
  for (let g = 0; g < 4; g++) { if (ts.isCallExpression(x) && WRAPPERS.test(x.expression.getText()) && x.arguments[0]) x = strip(x.arguments[0]); else break; }
  return x.getText().replace(/\s+/g, '');
}

/** Where a template's span sits: 'text', 'tag' (a value inside a tag), or the name of a shown attribute. */
function spanContext(tpl, idx) {
  const texts = [tpl.head.text, ...tpl.templateSpans.map((s) => s.literal.text)].slice(0, idx + 1);
  let inTag = false;
  let quote = null;
  let attr = '';
  let pending = '';
  for (const t of texts) {
    for (let i = 0; i < t.length; i++) {
      const ch = t[i];
      if (!inTag) {
        if (ch === '<' && /[A-Za-z/!]/.test(t[i + 1] ?? '')) { inTag = true; pending = ''; quote = null; }
        continue;
      }
      if (quote) { if (ch === quote) { quote = null; attr = ''; } continue; }
      if (ch === '>') { inTag = false; continue; }
      if (ch === '"' || ch === "'") { quote = ch; attr = pending.replace(/=\s*$/, '').trim().toLowerCase(); pending = ''; continue; }
      if (/\s/.test(ch)) pending = ''; else pending += ch;
    }
    // a value between texts: a span with no quote open sits in the tag itself
  }
  if (!inTag) return 'text';
  if (quote && ATTRS.has(attr)) return attr;
  return 'tag';
}

const CREATE = /^ChatMessage(\.implementation)?\.create$/;
// v0.89.4: also `ChatMessage?.create?.(…)` and `(globalThis as any).ChatMessage?.create?.(…)` (v0.89.3 missed these)
const isCreateCall = (c) => ts.isCallExpression(c) && CREATE.test(c.expression.getText().replace(/\s/g, '').replace(/\?\./g, '.').replace(/^\(globalThisasany\)\./, ''));
const isWithRollMode = (c) => ts.isCallExpression(c) && ts.isIdentifier(c.expression) && c.expression.text === 'withRollMode';

/** v0.89.4: files whose windows' own HTML is converted too (`_renderHTML` returns, text written into the page). */
const UI_FILES = new Set(['settings.ts']);
function makeFlow(sf, checker, rel) {
  const flow = { shown: null, lastStop: '' };
  const cardFile = rel === 'documents/index.ts' || rel === 'applications/chat.ts' || UI_FILES.has(rel);
  // every identifier, by symbol
  const refs = new Map();
  const symOf = (id) => {
    try {
      if (ts.isShorthandPropertyAssignment(id.parent) && id.parent.name === id) return checker.getShorthandAssignmentValueSymbol(id.parent);
      return checker.getSymbolAtLocation(id);
    } catch { return undefined; }
  };
  const collect = (n) => {
    if (ts.isIdentifier(n) || ts.isPrivateIdentifier(n)) {
      const s = symOf(n);
      if (s) { let l = refs.get(s); if (!l) refs.set(s, (l = [])); l.push(n); }
    }
    ts.forEachChild(n, collect);
  };
  collect(sf);
  const memo = new Map();
  const pending = new Set();
  const stops = new Map();
  const cached = (key, fn) => {
    if (memo.has(key)) { if (!memo.get(key) && WHY) flow.lastStop = stops.get(key) ?? ''; return memo.get(key); }
    if (pending.has(key)) return true; // a cycle: the other edges decide
    pending.add(key);
    let r = false;
    try { r = fn(); } finally { pending.delete(key); }
    memo.set(key, r);
    if (!r && WHY) stops.set(key, flow.lastStop);
    return r;
  };

  /** Whether a read only tests the value (truthiness, length): it never shows or stores the text itself. */
  const neutral = (id) => {
    let n = id;
    while (ts.isParenthesizedExpression(n.parent) || ts.isNonNullExpression(n.parent)) n = n.parent;
    const p = n.parent;
    if (ts.isPropertyAccessExpression(p) && p.expression === n && p.name.text === 'length') return true;
    if (ts.isIfStatement(p) && p.expression === n) return true;
    if (ts.isPrefixUnaryExpression(p) && p.operator === ts.SyntaxKind.ExclamationToken) return true;
    if (ts.isConditionalExpression(p) && p.condition === n) return true;
    if (ts.isBinaryExpression(p) && p.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken && p.left === n) return true;
    if (ts.isTypeOfExpression(p)) return true;
    // searched for markup, not shown or kept: `html.includes('<strong>Hit!')`, `/…/.test(html)` (outcomeBanner reads the
    // card's HTML for the outcome words, which stay English). v0.89.3 review: a search for plain words would break in
    // another language, so only a search for a tag, a data- attribute or a regular expression is neutral.
    if (ts.isPropertyAccessExpression(p) && p.expression === n && /^(includes|startsWith|endsWith|indexOf|lastIndexOf|search|match|matchAll)$/.test(p.name.text) && ts.isCallExpression(p.parent) && p.parent.expression === p) {
      const a = p.parent.arguments[0] && strip(p.parent.arguments[0]);
      return !!a && (ts.isRegularExpressionLiteral(a) || (isLit(a) && /^<|data-/.test(a.text)));
    }
    if (ts.isCallExpression(p) && p.arguments.includes(n) && ts.isPropertyAccessExpression(p.expression) && /^(test|exec)$/.test(p.expression.name.text) && ts.isRegularExpressionLiteral(strip(p.expression.expression))) return true;
    return false;
  };
  /** The reads of a symbol (not its declaration, not a write). */
  const readsOf = (sym, decl) => (refs.get(sym) ?? []).filter((id) => {
    if (decl && (id === decl.name)) return false;
    const p = id.parent;
    if (ts.isBinaryExpression(p) && p.left === id && [ts.SyntaxKind.EqualsToken].includes(p.operatorToken.kind)) return false;
    if (ts.isBinaryExpression(p) && p.left === id && p.operatorToken.kind === ts.SyntaxKind.PlusEqualsToken) return false;
    return true;
  });
  /** All reads of a local or parameter are shown. */
  const allShown = (decl) => cached(`v${decl.pos}`, () => {
    if (!ts.isIdentifier(decl.name)) return false;
    const sym = checker.getSymbolAtLocation(decl.name);
    if (!sym) return false;
    const rs = readsOf(sym, decl);
    if (!rs.length) return stop(decl);
    // v0.89.3 review: a value that is only ever tested or searched is not shown anywhere: it stays code.
    // (A parameter that is only searched, like outcomeBanner's html, keeps nothing: the caller shows the value.)
    if (!ts.isParameter(decl) && rs.every((r) => neutral(r))) return stop(decl);
    return rs.every((r) => neutral(r) || shown(r));
  });
  /** All reads of a local array are pushes, tests or a shown join. */
  const arrayShown = (decl) => cached(`a${decl.pos}`, () => {
    if (!ts.isIdentifier(decl.name)) return false;
    const sym = checker.getSymbolAtLocation(decl.name);
    if (!sym) return false;
    const rs = readsOf(sym, decl);
    if (!rs.length) return false;
    // v0.89.3 review: an array searched for a value (`ids.includes(status)`) holds ids, not text.
    if (rs.some((r) => ts.isPropertyAccessExpression(r.parent) && r.parent.expression === r && /^(includes|indexOf|lastIndexOf|find|findIndex|some|every|has)$/.test(r.parent.name.text))) return stop(decl);
    if (!rs.some((r) => !neutral(r) && !(ts.isPropertyAccessExpression(r.parent) && /^(push|unshift)$/.test(r.parent.name.text)))) return stop(decl);
    return rs.every((r) => {
      if (neutral(r)) return true;
      const p = r.parent;
      if (ts.isPropertyAccessExpression(p) && p.expression === r && /^(push|unshift)$/.test(p.name.text) && ts.isCallExpression(p.parent) && p.parent.expression === p) return true;
      if (ts.isSpreadElement(p) && ts.isArrayLiteralExpression(p.parent)) return arrayExprShown(p.parent);
      return arrayExprShown(r);
    });
  });
  /** An array-valued expression whose elements end up shown (joined into a card). */
  const arrayExprShown = (e) => {
    let n = e;
    while (ts.isParenthesizedExpression(n.parent) || ts.isAsExpression(n.parent) || ts.isNonNullExpression(n.parent)) n = n.parent;
    const p = n.parent;
    if (ts.isPropertyAccessExpression(p) && p.expression === n && ts.isCallExpression(p.parent) && p.parent.expression === p) {
      const m = p.name.text;
      if (m === 'join') return shown(p.parent);
      if (/^(filter|slice|concat|reverse|sort)$/.test(m)) return arrayExprShown(p.parent);
      return false;
    }
    if (ts.isVariableDeclaration(p) && p.initializer === n) return arrayShown(p);
    // v0.89.4: an array a function returns: every call's result is a shown array
    if (ts.isReturnStatement(p) || (ts.isArrowFunction(p) && p.body === n)) {
      let fn = p;
      while (fn && !ts.isFunctionLike(fn)) fn = fn.parent;
      const co = fn ? callsOf(fn) : null;
      if (!co || !co.calls.length || (!ts.isPrivateIdentifier(co.nameNode) && usedElsewhere(rel, co.nameNode.getText()))) return stop(p);
      return co.calls.every((call) => { let c = call; while (ts.isAwaitExpression(c.parent) || ts.isParenthesizedExpression(c.parent)) c = c.parent; return ts.isExpressionStatement(c.parent) || arrayExprShown(c); });
    }
    if (ts.isCallExpression(p) && /(^|\.)playerMay$/.test(p.expression.getText()) && p.arguments[3] === n) return true;
    if (ts.isSpreadElement(p) && ts.isArrayLiteralExpression(p.parent)) return arrayExprShown(p.parent);
    if (ts.isConditionalExpression(p) && p.condition !== n) return arrayExprShown(p);
    if (ts.isBinaryExpression(p) && [ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(p.operatorToken.kind)) return arrayExprShown(p);
    return false;
  };
  /** An object literal is a chat message's data (content, flavor and speaker are shown). */
  const chatData = (o) => cached(`o${o.pos}`, () => {
    let n = o;
    while (ts.isParenthesizedExpression(n.parent) || ts.isAsExpression(n.parent)) n = n.parent;
    const p = n.parent;
    if (ts.isConditionalExpression(p) && p.condition !== n) return chatData(p);
    if (ts.isCallExpression(p) && p.arguments[0] === n) {
      if (isCreateCall(p)) return true;
      if (isWithRollMode(p)) return chatData(p);
      return false;
    }
    if (ts.isVariableDeclaration(p) && p.initializer === n && ts.isIdentifier(p.name)) {
      const sym = checker.getSymbolAtLocation(p.name);
      const rs = sym ? readsOf(sym, p) : [];
      return rs.length > 0 && rs.every((r) => {
        if (ts.isPropertyAccessExpression(r.parent) && r.parent.expression === r) return true; // data.speaker
        if (ts.isSpreadAssignment(r.parent) && ts.isObjectLiteralExpression(r.parent.parent)) return chatData(r.parent.parent);
        return chatData(r);
      });
    }
    return false;
  });
  /** A function's returns are shown: every call of it in this file is shown (and it is never passed as a value). */
  const returnsShown = (fn, literal) => cached(`f${fn.pos}`, () => {
    // an IIFE
    let n = fn;
    while (ts.isParenthesizedExpression(n.parent)) n = n.parent;
    if (ts.isCallExpression(n.parent) && n.parent.expression === n) return shown(n.parent);
    // a .map / .flatMap callback: its results are the array's elements
    if (ts.isCallExpression(n.parent) && n.parent.arguments[0] === n && ts.isPropertyAccessExpression(n.parent.expression) && /^(map|flatMap)$/.test(n.parent.expression.name.text)) return arrayExprShown(n.parent);
    let nameNode = null;
    let exported = false;
    if ((ts.isFunctionDeclaration(fn) || ts.isMethodDeclaration(fn)) && fn.name) {
      nameNode = fn.name;
      exported = ts.isFunctionDeclaration(fn) ? !!fn.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) : !ts.isPrivateIdentifier(fn.name) && !fn.modifiers?.some((m) => m.kind === ts.SyntaxKind.PrivateKeyword);
    } else if ((ts.isArrowFunction(fn) || ts.isFunctionExpression(fn)) && ts.isVariableDeclaration(fn.parent) && ts.isIdentifier(fn.parent.name)) {
      nameNode = fn.parent.name;
      const vs = fn.parent.parent?.parent;
      exported = !!(vs && ts.isVariableStatement(vs) && vs.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword));
    }
    if (!nameNode) return stop(fn);
    if (UI_FILES.has(rel) && ts.isMethodDeclaration(fn) && /^_render(HTML|Inner)$/.test(nameNode.getText())) return true; // a window's own HTML
    // Something other files can call returns only HTML to them: plain text returned from it stays.
    if (exported && usedElsewhere(rel, nameNode.getText()) && !(literal && /<[A-Za-z!/]/.test(literal.getText())) && !externalShown(rel, nameNode.getText())) return stop(fn);
    const sym = checker.getSymbolAtLocation(nameNode);
    const uses = (refs.get(sym) ?? []).filter((id) => id !== nameNode);
    if (!uses.length) return false;
    return uses.every((id) => {
      let c = id;
      if (ts.isPropertyAccessExpression(c.parent) && c.parent.name === c) c = c.parent;
      if (!(ts.isCallExpression(c.parent) && c.parent.expression === c)) return stop(c);
      return shown(c.parent);
    });
  });
  /**
   * The parameter an argument goes to: of a same-file function, or (a call like `actor.method(…)` from another file)
   * of the one method of that name in documents/index.ts, judged there. Null when it can't be told.
   */
  const paramFor = (call, arg) => {
    const i = call.arguments.indexOf(arg);
    if (i < 0) return null;
    let sym;
    try { sym = checker.getSymbolAtLocation(ts.isPropertyAccessExpression(call.expression) ? call.expression.name : call.expression); } catch { sym = undefined; }
    const d = sym?.declarations?.[0];
    if (d) {
      let fn = d;
      if (ts.isVariableDeclaration(d) && d.initializer && (ts.isArrowFunction(d.initializer) || ts.isFunctionExpression(d.initializer))) fn = d.initializer;
      if (!ts.isFunctionLike(fn) || fn.getSourceFile() !== sf) return null;
      const p = fn.parameters?.[i];
      if (!p || p.dotDotDotToken) return null;
      return { fn, p, flow };
    }
    // another file's call into an actor method
    const ce = strip(call.expression);
    if (rel === 'documents/index.ts' || !FOREIGN.flow || !ts.isPropertyAccessExpression(ce) || ts.isPrivateIdentifier(ce.name)) return null;
    const m = FOREIGN.methods.get(ce.name.text);
    if (!m) return null;
    const p = m.parameters?.[i];
    if (!p || p.dotDotDotToken) return null;
    return { fn: m, p, flow: FOREIGN.flow };
  };
  /** A property of an options object given to a parameter: every read of it in the function is shown. */
  const propShown = (fl, param, prop) => {
    if (ts.isObjectBindingPattern(param.name)) {
      const el = param.name.elements.find((e) => (e.propertyName ? e.propertyName.getText() : e.name.getText()) === prop);
      return !!el && ts.isIdentifier(el.name) && fl.allShown(el);
    }
    if (!ts.isIdentifier(param.name)) return false;
    return fl.paramPropShown(param, prop);
  };
  /** Every read of `param.prop` is shown, and the parameter never leaves the function whole. */
  const paramPropShown = (param, prop) => cached(`pp${param.pos}:${prop}`, () => {
    const sym = checker.getSymbolAtLocation(param.name);
    const rs = sym ? readsOf(sym, param) : [];
    let any = false;
    for (const r of rs) {
      if (neutral(r)) continue;
      const pa = r.parent;
      if (!(ts.isPropertyAccessExpression(pa) && pa.expression === r)) return false; // it escapes
      if (pa.name.text !== prop) continue;
      if (ts.isBinaryExpression(pa.parent) && pa.parent.left === pa) continue; // a write
      any = true;
      if (!(neutral(pa) || shown(pa))) return false;
    }
    return any;
  });

  /** The function an object literal is returned from (directly, or through ?: / await), or null. */
  const returnedFrom = (o) => {
    let n = o;
    while (ts.isParenthesizedExpression(n.parent) || ts.isAsExpression(n.parent) || (ts.isConditionalExpression(n.parent) && n.parent.condition !== n)) n = n.parent;
    const p = n.parent;
    if (ts.isReturnStatement(p)) { let fn = p.parent; while (fn && !ts.isFunctionLike(fn)) fn = fn.parent; return fn ?? null; }
    if (ts.isArrowFunction(p) && p.body === n) return p;
    return null;
  };
  /** The calls of a named function or method in this file (null when it is also used another way, or elsewhere). */
  const callsOf = (fn) => {
    let nameNode = null;
    if ((ts.isFunctionDeclaration(fn) || ts.isMethodDeclaration(fn)) && fn.name) nameNode = fn.name;
    else if ((ts.isArrowFunction(fn) || ts.isFunctionExpression(fn)) && ts.isVariableDeclaration(fn.parent) && ts.isIdentifier(fn.parent.name)) nameNode = fn.parent.name;
    if (!nameNode) return null;
    const sym = checker.getSymbolAtLocation(nameNode);
    const uses = (refs.get(sym) ?? []).filter((id) => id !== nameNode);
    const calls = [];
    for (const id of uses) {
      let c = id;
      if (ts.isPropertyAccessExpression(c.parent) && c.parent.name === c) c = c.parent;
      if (!(ts.isCallExpression(c.parent) && c.parent.expression === c)) return null;
      calls.push(c.parent);
    }
    return { nameNode, calls };
  };
  /** Every caller of `fn` reads only shown values from the `prop` of what it returns. */
  const retPropShown = (fn, prop) => cached(`rp${fn.pos}:${prop}`, () => {
    const co = callsOf(fn);
    if (!co || !co.calls.length) return stop(fn);
    if (!ts.isPrivateIdentifier(co.nameNode) && usedElsewhere(rel, co.nameNode.getText())) return stop(fn);
    return co.calls.every((call) => {
      let c = call;
      while (ts.isAwaitExpression(c.parent) || ts.isParenthesizedExpression(c.parent)) c = c.parent;
      const p = c.parent;
      if (ts.isExpressionStatement(p)) return true;
      if (ts.isPropertyAccessExpression(p) && p.expression === c) return p.name.text !== prop || shown(p) || stop(p);
      if (ts.isVariableDeclaration(p) && p.initializer === c) {
        if (ts.isObjectBindingPattern(p.name)) {
          const el = p.name.elements.find((e) => (e.propertyName ? e.propertyName.getText() : e.name.getText()) === prop);
          return !el || (ts.isIdentifier(el.name) && allShown(el)) || stop(p);
        }
        if (!ts.isIdentifier(p.name)) return stop(p);
        const sym = checker.getSymbolAtLocation(p.name);
        const rs = sym ? readsOf(sym, p) : [];
        return rs.every((r) => {
          if (neutral(r)) return true;
          const pa = r.parent;
          if (!(ts.isPropertyAccessExpression(pa) && pa.expression === r)) return stop(r); // it escapes whole
          return pa.name.text !== prop || neutral(pa) || shown(pa);
        });
      }
      return stop(p);
    });
  });

  /** A local map of texts (`const what = { a: '…', b: '…' }`): every read picks one entry (`what[k]`) that is shown. */
  const mapShown = (decl) => cached(`m${decl.pos}`, () => {
    if (!ts.isIdentifier(decl.name)) return false;
    const sym = checker.getSymbolAtLocation(decl.name);
    const rs = sym ? readsOf(sym, decl) : [];
    if (!rs.length) return false;
    return rs.every((r) => {
      const pa = r.parent;
      if (ts.isElementAccessExpression(pa) && pa.expression === r) return shown(pa);
      if (ts.isPropertyAccessExpression(pa) && pa.expression === r) return shown(pa);
      return stop(r);
    });
  });

  /** Whether the value of an expression is only ever shown on a card. */
  function shown(node) {
    return cached(`s${node.pos}:${node.end}`, () => {
      const r = shownStep(node);
      return r;
    });
  }
  const stop = (n) => { if (WHY) flow.lastStop = `${ts.SyntaxKind[n.kind]}:${lineOf(sf, n)} ${n.getText().slice(0, 70).replace(/\s+/g, ' ')}`; return false; };
  function shownStep(node) {
    {
      let n = node;
      while (ts.isParenthesizedExpression(n.parent) || ts.isAsExpression(n.parent) || ts.isNonNullExpression(n.parent) || (ts.isSatisfiesExpression?.(n.parent))) n = n.parent;
      const p = n.parent;
      if (!p) return stop(node);
      if (ts.isConditionalExpression(p)) return p.condition !== n ? shown(p) : true; // a condition only tests it
      if (ts.isAwaitExpression(p)) return shown(p);
      // only tested, or thrown away: never shown or kept
      if ((ts.isIfStatement(p) || ts.isWhileStatement(p) || ts.isDoStatement(p)) && p.expression === n) return true;
      if (ts.isForStatement(p) && p.condition === n) return true;
      if (ts.isPrefixUnaryExpression(p) && p.operator === ts.SyntaxKind.ExclamationToken) return true;
      if (ts.isExpressionStatement(p) || ts.isVoidExpression(p)) return n !== node;
      if (ts.isBinaryExpression(p)) {
        const k = p.operatorToken.kind;
        if (k === ts.SyntaxKind.BarBarToken || k === ts.SyntaxKind.QuestionQuestionToken || k === ts.SyntaxKind.PlusToken) return shown(p);
        if (k === ts.SyntaxKind.AmpersandAmpersandToken) return shown(p);
        if ((k === ts.SyntaxKind.EqualsToken || k === ts.SyntaxKind.PlusEqualsToken) && p.right === n) {
          const l = strip(p.left);
          if (ts.isIdentifier(l)) {
            const d = checker.getSymbolAtLocation(l)?.declarations?.[0];
            return !!d && (ts.isVariableDeclaration(d) || ts.isParameter(d)) && d.getSourceFile() === sf && allShown(d);
          }
          if (ts.isPropertyAccessExpression(l) && l.name.text === 'html' && cardFile) return true;
          // text written into the page by the card files (render hooks, the GM tools on a card)
          if (ts.isPropertyAccessExpression(l) && cardFile && k === ts.SyntaxKind.EqualsToken && /^(textContent|innerText|innerHTML|title|placeholder|ariaLabel|alt)$/.test(l.name.text)) return true;
          if (ts.isPropertyAccessExpression(l) && cardFile && k === ts.SyntaxKind.EqualsToken && l.name.text === 'tooltip' && /\.dataset$/.test(l.expression.getText())) return true;
          return stop(p);
        }
        return stop(p);
      }
      if (ts.isTemplateSpan(p)) {
        const tpl = p.parent;
        const ctx = spanContext(tpl, tpl.templateSpans.indexOf(p));
        if (ctx === 'tag') return stop(p);
        return shown(tpl);
      }
      if (ts.isCallExpression(p)) {
        if (p.expression === n) return stop(p);
        const callee = p.expression.getText().replace(/\?\./g, '.').replace(/\s/g, '');
        if (WRAPPERS.test(callee) && p.arguments[0] === n) return shown(p);
        if (/\.(push|unshift)$/.test(callee) && ts.isPropertyAccessExpression(strip(p.expression))) {
          const arr = strip(strip(p.expression).expression);
          if (!ts.isIdentifier(arr)) return stop(p);
          const d = checker.getSymbolAtLocation(arr)?.declarations?.[0];
          return !!d && ts.isVariableDeclaration(d) && d.getSourceFile() === sf && arrayShown(d);
        }
        if (/(^|\.)#snapshot$/.test(callee) && p.arguments[0] === n) return true; // a test's label: only ever shown
        if (cardFile && /\.setAttribute$/.test(callee) && p.arguments[1] === n && isLit(strip(p.arguments[0])) && ATTRS.has(strip(p.arguments[0]).text)) return true;
        if (/(^|\.)playerMay$/.test(callee) && p.arguments[3] === n) return true; // the lines of the player's confirmation (escaped there)
        if (/(^|\.)ui\.notifications\.(warn|info|error|notify)$/.test(callee)) return true; // a notification
        const pf = paramFor(p, n);
        if (pf && ts.isIdentifier(pf.p.name)) return pf.flow.allShown(pf.p) || stop(p);
        return stop(p);
      }
      if (ts.isPropertyAccessExpression(p) && p.expression === n && ts.isCallExpression(p.parent) && p.parent.expression === p) {
        if (/^(trim|trimStart|trimEnd|toUpperCase|toLowerCase|toString)$/.test(p.name.text)) return shown(p.parent);
        return stop(p);
      }
      if (ts.isPropertyAssignment(p) && p.initializer === n) {
        const nm = p.name.getText().replace(/['"]/g, '');
        const o = p.parent;
        // a modifier row's label is shown wherever the row goes (checked before a returned object's callers)
        if (nm === 'label' && ts.isObjectLiteralExpression(o) && o.properties.some((q) => q.name?.getText() === 'value') && !o.properties.some((q) => q.name?.getText() === 'action')) return true;
        if (ts.isObjectLiteralExpression(o) && nm !== 'html') { const rf = returnedFrom(o); if (rf) return retPropShown(rf, nm) || stop(p); }
        if (ts.isObjectLiteralExpression(o) && ts.isVariableDeclaration(o.parent) && o.parent.initializer === o && isLit(strip(n))) return mapShown(o.parent) || stop(p);
        // a value given to a translation: shown when the translation is
        if (ts.isObjectLiteralExpression(o) && ts.isCallExpression(o.parent) && ts.isIdentifier(o.parent.expression) && /^(tx|tCount)$/.test(o.parent.expression.text) && o.parent.arguments.includes(o)) return shown(o.parent);
        if (nm === 'html' && cardFile) return true;
        // v0.89.4: a modifier row or an option (`{ label, value }`) shows its label; a group of rows (`{ group, rows }`) its
        // name. The rows the code looks for carry an id (rules/dice.ts modifierIs), so a label is only ever shown.
        if (nm === 'label' && ts.isObjectLiteralExpression(o) && o.properties.some((q) => q.name?.getText() === 'value') && !o.properties.some((q) => q.name?.getText() === 'action')) return true;
        if (nm === 'group' && ts.isObjectLiteralExpression(o) && o.properties.some((q) => q.name?.getText() === 'rows')) return true;
        if ((nm === 'content' || nm === 'flavor') && chatData(o)) return true;
        if (nm === 'alias' && ts.isPropertyAssignment(o.parent) && o.parent.name.getText() === 'speaker' && chatData(o.parent.parent)) return true;
        if (nm === 'alias' && ts.isCallExpression(o.parent) && /getSpeaker$/.test(o.parent.expression.getText())) return true;
        if (ts.isObjectLiteralExpression(o) && ts.isCallExpression(o.parent) && o.parent.arguments.includes(o)) {
          const pf = paramFor(o.parent, o);
          if (pf) return propShown(pf.flow, pf.p, nm) || stop(p);
        }
        return stop(p);
      }
      if (ts.isShorthandPropertyAssignment(p) && p.name === n) {
        const o = p.parent;
        if (ts.isObjectLiteralExpression(o) && p.name.text !== 'html') { const rf = returnedFrom(o); if (rf) return retPropShown(rf, p.name.text) || stop(p); }
        if (ts.isObjectLiteralExpression(o) && ts.isCallExpression(o.parent) && ts.isIdentifier(o.parent.expression) && /^(tx|tCount)$/.test(o.parent.expression.text)) return shown(o.parent);
        if (p.name.text === 'html' && cardFile) return true;
        if (p.name.text === 'label' && ts.isObjectLiteralExpression(o) && o.properties.some((q) => q.name?.getText() === 'value') && !o.properties.some((q) => q.name?.getText() === 'action')) return true;
        if (p.name.text === 'group' && ts.isObjectLiteralExpression(o) && o.properties.some((q) => q.name?.getText() === 'rows')) return true;
        if ((p.name.text === 'content' || p.name.text === 'flavor') && chatData(o)) return true;
        if (ts.isObjectLiteralExpression(o) && ts.isCallExpression(o.parent) && o.parent.arguments.includes(o)) {
          const pf = paramFor(o.parent, o);
          if (pf) return propShown(pf.flow, pf.p, p.name.text) || stop(p);
        }
        return stop(p);
      }
      if (ts.isReturnStatement(p)) {
        let fn = p.parent;
        while (fn && !ts.isFunctionLike(fn)) fn = fn.parent;
        return !!fn && returnsShown(fn, node);
      }
      if ((ts.isArrowFunction(p)) && p.body === n) return returnsShown(p, node);
      if (ts.isVariableDeclaration(p) && p.initializer === n) return p.getSourceFile() === sf && allShown(p);
      if (ts.isArrayLiteralExpression(p)) return arrayExprShown(p);
      return stop(p);
    }
  }
  flow.shown = shown;
  flow.allShown = allShown;
  flow.paramPropShown = paramPropShown;
  return flow;
}

// ---------------------------------------------------------------- converting
/** Cook the raw text of a template piece (no `${` in it) into the string it stands for. */
const cook = (raw) => new Function(`return \`${raw}\`;`)();
const toRaw = (s) => s.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
/** One item of the stream: a character of static text, or a value. */
function* stream(pieces) {
  for (const p of pieces) {
    if (p.expr) { yield { expr: p.expr }; continue; }
    const r = p.raw;
    for (let i = 0; i < r.length; i++) {
      if (r[i] === '\\' && i + 1 < r.length) {
        let j = i + 2;
        if (r[i + 1] === 'u' && r[i + 2] === '{') j = r.indexOf('}', i) + 1;
        else if (r[i + 1] === 'u') j = i + 6;
        else if (r[i + 1] === 'x') j = i + 4;
        else if (r[i + 1] === '\r' && r[i + 2] === '\n') j = i + 3;
        yield { ch: r.slice(i, j), cooked: cook(r.slice(i, j)) };
        i = j - 1;
      } else yield { ch: r[i], cooked: r[i] };
    }
  }
}
function piecesOf(e) {
  if (ts.isStringLiteral(e)) return [{ raw: toRaw(e.text) }];
  if (ts.isNoSubstitutionTemplateLiteral(e)) return [{ raw: e.rawText ?? toRaw(e.text) }];
  const pieces = [{ raw: e.head.rawText ?? toRaw(e.head.text) }];
  for (const s of e.templateSpans) pieces.push({ expr: s.expression }, { raw: s.literal.rawText ?? toRaw(s.literal.text) });
  return pieces;
}

/**
 * A run of items (text and values) as one translation. Returns { src, changed }: `src` is template source (with any
 * leading and trailing whitespace kept outside), or, with `asExpr`, an expression.
 */
function convertRun(list, ctx, { collapse, asExpr }) {
  const verbatim = () => list.map((x) => (x.ch !== undefined ? x.ch : '${' + x.expr.getText() + '}')).join('');
  const textOnly = list.map((x) => (x.ch !== undefined ? x.cooked : countChoice(x.expr) ? ` ${countChoice(x.expr).other} ` : ' ')).join('');
  if (!hasWord(textOnly) || /^\s*SR2E\./.test(textOnly)) return null;
  // Braces would be read as placeholders: left as it is (quietly for Foundry's own `@UUID[…]{…}` link syntax, which is code).
  if (/[{}]/.test(textOnly)) { if (!/@[A-Za-z]+\[/.test(textOnly)) notes.push(`${ctx.rel}: braces in text: ${textOnly.slice(0, 60)}`); return null; }
  let a = 0;
  let b = list.length;
  if (!asExpr) {
    while (a < b && list[a].ch !== undefined && /^\s$/.test(list[a].cooked)) a++;
    while (b > a && list[b - 1].ch !== undefined && /^\s$/.test(list[b - 1].cooked)) b--;
  }
  const lead = list.slice(0, a).map((x) => x.ch).join('');
  const trail = list.slice(b).map((x) => x.ch).join('');
  const body = list.slice(a, b);
  // the wording chosen by a count
  let body2 = body;
  let choices = body.filter((x) => x.expr && countChoice(x.expr)).map((x) => countChoice(x.expr));
  let counts = [...new Set(choices.map((c) => countKey(c.n)))];
  if (counts.length > 1) {
    // Two counts in one run: each `${n} word${n === 1 ? '' : 's'}` becomes a counted noun of its own.
    body2 = [];
    for (let i = 0; i < body.length; i++) {
      const x = body[i];
      if (x.expr && !x.syn) {
        let j = i + 1;
        let word = '';
        while (j < body.length && body[j].ch !== undefined) { word += body[j].cooked; j++; }
        const cc = j < body.length && body[j].expr ? countChoice(body[j].expr) : null;
        const m = /^ ([A-Za-z][A-Za-z -]{0,30})$/.exec(word);
        if (cc && m && countKey(cc.n) === countKey(x.expr) && /^(s|es|ies|y|)$/.test(cc.one) && /^(s|es|ies|y|)$/.test(cc.other)) {
          const one = `{count} ${m[1]}${cc.one}`;
          const other = `{count} ${m[1]}${cc.other}`;
          body2.push({ syn: { name: clean(slug(m[1] + cc.other)), src: `tCount(${cc.n.getText()}, '${countNounKey(m[1], one, other)}')` } });
          i = j;
          continue;
        }
      }
      body2.push(x);
    }
    choices = body2.filter((x) => x.expr && countChoice(x.expr)).map((x) => countChoice(x.expr));
    counts = [...new Set(choices.map((c) => countKey(c.n)))];
    if (counts.length > 1) notes.push(`${ctx.rel}: wording chosen by two counts (by hand): ${textOnly.slice(0, 60)}`);
  }
  const count = counts.length === 1 ? counts[0] : null;
  const names = new Map();
  const used = new Set(count ? ['count'] : []);
  const props = [];
  const textFor = (form) => {
    let text = '';
    for (const x of body2) {
      if (x.ch !== undefined) { text += x.cooked; continue; }
      if (x.syn) {
        let nm = names.get(x.syn.src);
        if (!nm) {
          nm = x.syn.name;
          for (let k = 2; used.has(nm); k++) nm = `${x.syn.name}${k}`;
          used.add(nm);
          names.set(x.syn.src, nm);
          props.push(`${nm}: ${x.syn.src}`);
        }
        text += `{${nm}}`;
        continue;
      }
      const cc = count ? countChoice(x.expr) : null;
      if (cc && countKey(cc.n) === count) { text += form === 'one' ? cc.one : cc.other; continue; }
      if (count && countKey(x.expr) === count) { text += '{count}'; continue; }
      const src = x.expr.getText();
      let nm = names.get(src);
      if (!nm) {
        const base = nameOf(x.expr);
        nm = base;
        for (let k = 2; used.has(nm); k++) nm = `${base}${k}`;
        used.add(nm);
        names.set(src, nm);
        props.push(nm === src ? nm : `${nm}: ${src}`);
      }
      text += `{${nm}}`;
    }
    return collapse ? text.replace(/[ \t\r\f]*\n[ \t\r\n\f]*/g, ' ') : text;
  };
  const other = textFor('other');
  if (!hasWord(other.replace(/\{\w+\}/g, ''))) return null;
  let call;
  if (count) {
    const one = textFor('one');
    // The count printed escaped in the English (`${escText(n)}`): Number() keeps anything but a number out of the HTML.
    const escaped = body2.some((x) => x.expr && !countChoice(x.expr) && countKey(x.expr) === count && ts.isCallExpression(strip(x.expr)));
    const nSrc = choices.find((c) => countKey(c.n) === count).n.getText();
    const nExpr = escaped && !/^Number\(/.test(nSrc) ? `Number(${nSrc})` : nSrc;
    call = `tCount(${nExpr}, '${keyFor(ctx.group, { one, other }, ctx.store)}'${props.length ? `, { ${props.join(', ')} }` : ''})`;
    ctx.counted++;
  } else if (ctx.rowLabel) {
    // v0.89.4 review: a modifier row's label goes to one shared group (SR2E.Card.Mod), so the same English is the same key
    // in every file (labels are matched between a dialog's preview and the roll), and texts that differ only in their
    // placeholders' names share a key: this call's names are renamed to the existing key's, in order.
    const canon = (x) => x.replace(/\{\w+\}/g, '{}');
    const mine = [...other.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
    const g = (STORES.Card.Mod ??= {});
    let key = null;
    let theirs = null;
    for (const [k, v] of Object.entries(g)) {
      if (typeof v !== 'string' || canon(v) !== canon(other)) continue;
      const names = [...v.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
      if (names.length === mine.length && new Set(names).size === names.length && new Set(mine).size === mine.length) { key = `SR2E.Card.Mod.${k}`; theirs = names; break; }
    }
    if (!key) key = keyFor('Mod', other, 'Card');
    const rename = new Map(theirs ? mine.map((n, i) => [n, theirs[i]]) : []);
    const props2 = props.map((pr) => {
      const i = pr.indexOf(': ');
      const nm = i < 0 ? pr : pr.slice(0, i);
      const src = i < 0 ? pr : pr.slice(i + 2);
      const to = rename.get(nm) ?? nm;
      return to === src ? to : `${to}: ${src}`;
    });
    call = `${ALIAS}('${key}'${props2.length ? `, { ${props2.join(', ')} }` : ''})`;
  } else call = `${ALIAS}('${keyFor(ctx.group, other, ctx.store)}'${props.length ? `, { ${props.join(', ')} }` : ''})`;
  ctx.count++;
  void verbatim;
  return asExpr ? call : `${lead}\${${call}}${trail}`;
}

/** Convert an HTML-building literal or template: the new source text, or null when nothing changes. */
function htmlNode(e, ctx) {
  const items = [...stream(piecesOf(e))];
  let out = '';
  let changed = false;
  let i = 0;
  let rawTag = null;
  let inCode = false;
  const valueSrc = (x) => '${' + x.expr.getText() + '}';
  while (i < items.length) {
    const it = items[i];
    if (it.ch !== undefined && it.cooked === '<' && items[i + 1]?.ch !== undefined && /[A-Za-z/!]/.test(items[i + 1].cooked)) {
      let j = i + 1;
      let tagName = '';
      while (j < items.length && items[j].ch !== undefined && /[A-Za-z0-9/!-]/.test(items[j].cooked)) { tagName += items[j].cooked; j++; }
      out += items.slice(i, j).map((x) => x.ch).join('');
      const tn = tagName.toLowerCase();
      if (tn === '!--') {
        while (j < items.length && !(items[j].cooked === '>' && items[j - 1]?.cooked === '-' && items[j - 2]?.cooked === '-')) { out += items[j].ch ?? valueSrc(items[j]); j++; }
        if (j < items.length) { out += items[j].ch; j++; }
        i = j;
        continue;
      }
      let pendingName = '';
      while (j < items.length) {
        const x = items[j];
        if (x.expr) { out += valueSrc(x); j++; continue; }
        if (x.cooked === '>') { out += x.ch; j++; break; }
        if (x.cooked === '"' || x.cooked === "'") {
          const quote = x.cooked;
          const attrName = pendingName.replace(/=\s*$/, '').trim().toLowerCase();
          out += x.ch;
          j++;
          const val = [];
          while (j < items.length && !(items[j].ch !== undefined && items[j].cooked === quote)) { val.push(items[j]); j++; }
          const conv = ATTRS.has(attrName) ? convertRun(val, ctx, { collapse: false, asExpr: false }) : null;
          if (conv !== null) { out += conv; changed = true; } else out += val.map((y) => (y.ch !== undefined ? y.ch : valueSrc(y))).join('');
          if (j < items.length) { out += items[j].ch; j++; }
          pendingName = '';
          continue;
        }
        if (/\s/.test(x.cooked)) pendingName = '';
        else pendingName += x.cooked;
        out += x.ch;
        j++;
      }
      if (tn === 'textarea' || tn === 'pre') rawTag = tn;
      else if (tn === '/textarea' || tn === '/pre') rawTag = null;
      if (tn === 'code') inCode = true;
      else if (tn === '/code') inCode = false;
      i = j;
      continue;
    }
    const list = [];
    while (i < items.length) {
      const x = items[i];
      if (x.ch !== undefined && x.cooked === '<' && items[i + 1]?.ch !== undefined && /[A-Za-z/!]/.test(items[i + 1].cooked)) break;
      list.push(x);
      i++;
    }
    // v0.89.4: a code sample (`<code>RULES</code>`, a path, a JSON example) stays as it is
    const conv = inCode ? null : convertRun(list, ctx, { collapse: !rawTag, asExpr: false });
    if (conv !== null) { out += conv; changed = true; } else out += list.map((x) => (x.ch !== undefined ? x.ch : valueSrc(x))).join('');
  }
  return changed ? '`' + out + '`' : null;
}
/** Convert plain text (no tags): a tx()/tCount() call, or null. */
function plainNode(e, ctx) {
  const items = [...stream(piecesOf(e))];
  return convertRun(items, ctx, { collapse: false, asExpr: true });
}

// ---------------------------------------------------------------- the files
function walk(dir, out = []) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) { if (f !== '__tests__') walk(p, out); }
    else if (f.endsWith('.ts')) out.push(p);
  }
  return out;
}
/** v0.89.4: a modifier row's label (`{ label: …, value }`), directly or through ?: / ?? / || / a template value. */
function isRowLabel(n) {
  let x = n;
  for (let g = 0; g < 8; g++) {
    const p = x.parent;
    if (!p) return false;
    if (ts.isParenthesizedExpression(p) || ts.isAsExpression(p) || (ts.isConditionalExpression(p) && p.condition !== x) || (ts.isBinaryExpression(p) && [ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.BarBarToken].includes(p.operatorToken.kind))) { x = p; continue; }
    if (ts.isPropertyAssignment(p) && p.initializer === x && p.name.getText() === 'label' && ts.isObjectLiteralExpression(p.parent)) return p.parent.properties.some((q) => q.name?.getText() === 'value') && !p.parent.properties.some((q) => q.name?.getText() === 'action');
    return false;
  }
  return false;
}
/** Up through parentheses and casts. */
const climb = (e) => { let n = e; while (ts.isParenthesizedExpression(n.parent) || ts.isAsExpression(n.parent) || ts.isNonNullExpression(n.parent)) n = n.parent; return n; };
const staticText = (e) => (ts.isTemplateExpression(e) ? e.head.text + e.templateSpans.map((s) => s.literal.text).join('') : e.text);
/** Inside a function body (run later), not at module load (top level, static fields and blocks). */
function inFunction(n) {
  for (let p = n.parent; p; p = p.parent) {
    if (ts.isFunctionLike(p)) return true;
    if (ts.isPropertyDeclaration(p) && p.modifiers?.some((m) => m.kind === ts.SyntaxKind.StaticKeyword)) return false;
    if (ts.isClassStaticBlockDeclaration?.(p)) return false;
    if (ts.isSourceFile(p)) return false;
  }
  return false;
}
/** A literal that is a translation key's own argument, an import, a property name, a type: never text. */
function skipLiteral(e) {
  // v0.89.3 review: text evaluated when the module loads (a top-level constant, a static field) would be translated
  // before Foundry has its languages: never converted.
  if (!inFunction(e)) return true;
  const p = e.parent;
  if (ts.isExpressionStatement(p)) return true; // a directive ('use strict')
  if (ts.isImportDeclaration(p) || ts.isExportDeclaration(p) || ts.isLiteralTypeNode(p) || ts.isExternalModuleReference?.(p)) return true;
  if ((ts.isPropertyAssignment(p) || ts.isPropertyDeclaration(p) || ts.isMethodDeclaration(p)) && p.name === e) return true;
  if (ts.isElementAccessExpression(p) && p.argumentExpression === e) return true;
  if (ts.isCallExpression(p) && ts.isIdentifier(p.expression) && /^(tx|tCount|t|tHtml)$/.test(p.expression.text) && p.arguments[0] === e) return true;
  return false;
}

/** Whether any other source file (not the tests) names this function or method. */
const ALL_SOURCES = (() => { const out = []; const w = (d) => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) w(p); else if (f.endsWith('.ts')) out.push(p); } }; w(SRC); return out.map((p) => ({ rel: path.relative(SRC, p).split(path.sep).join('/'), src: fs.readFileSync(p, 'utf8') })); })();
function usedElsewhere(rel, name) {
  const re = new RegExp(`(^|[^\\w$#])${name.replace(/[$]/g, '\\$')}\\b`);
  return ALL_SOURCES.some((f) => f.rel !== rel && !f.rel.startsWith('__tests__/') && re.test(f.src));
}
/**
 * The other files' calls of a public index.ts method (gathered after they were converted, for the second round):
 * every use of the name there is a call whose result is shown. False before the first round is done.
 */
const EXTERNAL = { ready: false, uses: new Map() };
function externalShown(rel, name) {
  if (rel !== 'documents/index.ts' || !EXTERNAL.ready) return false;
  const list = EXTERNAL.uses.get(name);
  return !!list && list.length > 0 && list.every((u) => u.call && u.flow.shown(u.call));
}
function gatherExternal(files) {
  EXTERNAL.uses = new Map();
  for (const f of files) {
    const r = path.relative(SRC, f.file).split(path.sep).join('/');
    const { checker, sf } = programFor(f.file, f.src);
    const fl = makeFlow(sf, checker, r);
    const v = (n) => {
      if (ts.isIdentifier(n) && FOREIGN.methods.has(n.text) && ts.isPropertyAccessExpression(n.parent) && n.parent.name === n) {
        const pa = n.parent;
        const call = ts.isCallExpression(pa.parent) && pa.parent.expression === pa ? pa.parent : null;
        let l = EXTERNAL.uses.get(n.text);
        if (!l) EXTERNAL.uses.set(n.text, (l = []));
        l.push({ call, flow: fl });
      }
      ts.forEachChild(n, v);
    };
    v(sf);
  }
  EXTERNAL.ready = true;
}
/** documents/index.ts, once converted: its methods (by name, only names declared once) and its flow, for other files' calls. */
const FOREIGN = { flow: null, methods: new Map() };
/** Method names too common to tell an actor's from anything else's. */
const COMMON = new Set('update create delete render close get set has add remove find filter map toggle setFlag getFlag unsetFlag toObject prepareData prepareDerivedData roll apply reset test use run start stop open'.split(' '));
let total = 0;
let counted = 0;
let changedFiles = 0;
function programFor(file, src) {
  const host = ts.createCompilerHost({ noLib: true, noResolve: true, target: ts.ScriptTarget.ES2022 });
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
  host.getSourceFile = (f) => (path.resolve(f) === path.resolve(file) ? sf : undefined);
  host.fileExists = (f) => path.resolve(f) === path.resolve(file);
  host.readFile = (f) => (path.resolve(f) === path.resolve(file) ? src : undefined);
  const program = ts.createProgram([file], { noLib: true, noResolve: true, target: ts.ScriptTarget.ES2022, types: [] }, host);
  return { checker: program.getTypeChecker(), sf: program.getSourceFile(file) ?? sf };
}
function setForeign(file, src) {
  const { checker, sf } = programFor(file, src);
  FOREIGN.flow = makeFlow(sf, checker, 'documents/index.ts');
  const count = new Map();
  const v = (n) => { if (ts.isMethodDeclaration(n) && n.name && ts.isIdentifier(n.name) && n.body) { const k = n.name.text; count.set(k, (count.get(k) ?? 0) + 1); FOREIGN.methods.set(k, n); } ts.forEachChild(n, v); };
  v(sf);
  for (const [k, c] of count) if (c > 1 || COMMON.has(k)) FOREIGN.methods.delete(k);
}
function convertSource(file, src) {
  const rel = path.relative(SRC, file).split(path.sep).join('/');
  const { checker, sf: sf2 } = programFor(file, src);
  const flow = makeFlow(sf2, checker, rel);
  const ctx = { rel, sf: sf2, group: groupOf(rel), store: UI_FILES.has(rel) ? 'App' : 'Card', count: 0, counted: 0 };
  const edits = [];
  const v = (n) => {
    // Wording chosen by a count on its own (`n === 1 ? 'die' : 'dice'`, not inside a template): one counted text.
    if (ts.isConditionalExpression(n) && inFunction(n) && countChoice(n) && !ts.isTemplateSpan(climb(n).parent) && hasWord(staticText(strip(n.whenTrue)) + ' ' + staticText(strip(n.whenFalse))) && !/^(s|es|ies|y|)$/.test(countChoice(n).one + countChoice(n).other) && !(/^(s|es|ies|y|)$/.test(countChoice(n).one) && /^(s|es|ies|y|)$/.test(countChoice(n).other)) && !isPattern(n)) {
      if (flow.shown(n)) {
        const c = convertRun([{ expr: n }], ctx, { collapse: false, asExpr: true });
        if (c !== null) { edits.push([n.getStart(), n.getEnd(), c]); return; }
      }
    }
    // A count's branch inside a template is the template's (one counted text with it).
    if (isLit(n) && ts.isConditionalExpression(climb(n).parent) && countChoice(climb(n).parent) && climb(n).parent.condition !== climb(n)) return;
    if ((ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateExpression(n)) && !skipLiteral(n)) {
      const st = staticText(n) + (ts.isTemplateExpression(n) ? n.templateSpans.map((sp) => { const cc = countChoice(sp.expression); return cc ? ` ${cc.one} ${cc.other}` : ''; }).join('') : '');
      if (hasWord(st) && !/^SR2E\./.test(st) && !isPattern(n)) {
        flow.lastStop = '';
        if (flow.shown(n)) {
          ctx.rowLabel = isRowLabel(n);
          const c = /<[A-Za-z!/]/.test(st) ? htmlNode(n, ctx) : plainNode(n, ctx);
          ctx.rowLabel = false;
          if (c !== null) { edits.push([n.getStart(), n.getEnd(), c]); return; }
        } else if (WHY && /[A-Za-z]{2,}[^A-Za-z]+[A-Za-z]{2,}/.test(st.replace(/<[^>]*>/g, ' '))) why.push(`${rel}:${lineOf(sf2, n)} ${n.getText().slice(0, 90).replace(/\s+/g, ' ')}  ⟂ ${flow.lastStop}`);
      }
    }
    ts.forEachChild(n, v);
  };
  v(sf2);
  // An edit inside another is left for the next pass.
  const kept = edits.sort((x, y) => x[0] - y[0] || y[1] - x[1]).filter((x, i, arr) => !arr.slice(0, i).some((y) => y[0] <= x[0] && x[1] <= y[1]));
  if (!kept.length) return null;
  let clash = false;
  const idv = (n) => { if (ts.isIdentifier(n) && n.text === ALIAS && !(ts.isImportSpecifier(n.parent) && n.parent.propertyName?.text === 't')) clash = true; ts.forEachChild(n, idv); };
  if (!/\bt as tx\b/.test(src)) idv(sf2);
  if (clash) { notes.push(`${rel}: '${ALIAS}' is already used in this file: skipped`); return null; }
  let out = applyEdits(src, 0, kept);
  const need = [];
  if (/\btx\(/.test(out) && !/\bt as tx\b/.test(out)) need.push('t as tx');
  if (/\btCount\(/.test(out) && !/import \{[^}]*\btCount\b[^}]*\} from/.test(out)) need.push('tCount');
  if (need.length) {
    let imp = path.relative(path.dirname(file), I18N).split(path.sep).join('/');
    if (!imp.startsWith('.')) imp = `./${imp}`;
    const existing = new RegExp(`import \\{([^}]*)\\} from ["']${imp.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}["'];`);
    if (existing.test(out)) out = out.replace(existing, (_m, names) => `import {${names.trimEnd()}, ${need.join(', ')} } from '${imp}';`);
    else {
      const imports = [...out.matchAll(/^import [^;]*;[^\n]*\n/gm)];
      const doc = /^\s*\/\*[\s\S]*?\*\/\n/.exec(out);
      const at = imports.length ? imports[imports.length - 1].index + imports[imports.length - 1][0].length : doc ? doc[0].length : 0;
      out = out.slice(0, at) + `import { ${need.join(', ')} } from '${imp}';\n` + out.slice(at);
    }
  }
  total += ctx.count;
  counted += ctx.counted;
  return out;
}

const INDEX = path.join(SRC, 'documents', 'index.ts');
// v0.89.4: every source file (modifier rows and options are everywhere); a file with nothing shown converts nothing.
const FILES = [INDEX, ...walk(SRC).filter((f) => f !== INDEX)].map((file) => ({ file, src: fs.readFileSync(file, 'utf8') }));
for (const f of FILES) f.cur = f.src;
// Round 1: index.ts first (other files' calls into it are judged there), then the rest. Round 2 and on: index.ts again
// with the other files' call sites of its public methods, then the rest again, until nothing changes.
for (let round = 0; round < 4; round++) {
  let any = false;
  for (const f of FILES) {
    for (let pass = 0; pass < 30; pass++) { const next = convertSource(f.file, f.cur); if (next === null || next === f.cur) break; f.cur = next; any = true; }
    if (f.file === INDEX) setForeign(f.file, f.cur);
  }
  gatherExternal(FILES.filter((f) => f.file !== INDEX).map((f) => ({ file: f.file, src: f.cur })));
  if (!any && round > 0) break;
}
for (const f of FILES) {
  if (f.cur === f.src) continue;
  changedFiles++;
  if (!CHECK) fs.writeFileSync(f.file, f.cur);
}
if (!CHECK) {
  const code = walk(SRC).map((f) => fs.readFileSync(f, 'utf8')).join('\n');
  for (const [store, S] of Object.entries(STORES)) for (const [g, o] of Object.entries(S)) {
    for (const k of Object.keys(o)) if (!code.includes(`'SR2E.${store}.${g}.${k}'`)) { delete o[k]; added++; }
    if (!Object.keys(o).length) delete S[g];
  }
  for (const store of Object.keys(STORES)) if (!Object.keys(STORES[store]).length) delete lang.SR2E[store];
}
if (!CHECK && added) fs.writeFileSync(LANG, JSON.stringify(lang, null, 2) + '\n');
for (const l of [...new Set(notes)]) console.log(l);
if (WHY) for (const l of why) console.log('stays: ' + l);
console.log(`${CHECK ? 'would convert' : 'converted'} ${total} strings (${counted} counted) in ${changedFiles} files; ${new Set(notes).size} notes`);
if (CHECK && total) process.exit(1);
