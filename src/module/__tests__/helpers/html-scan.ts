/**
 * v0.81.1 HTML-escaping scanner (test helper). Rewritten after the SEC1-13 and SEC2b-5 reviews, which fooled the
 * v0.81.0 version with names, casts, text prefixes and sinks it never looked at.
 *
 * It type-checks `src/` (tests excluded, plus any extra files a test passes) with the project's own `typescript`
 * package and judges two kinds of site:
 * - every `${…}` inside an HTML-building template literal, and every operand of an HTML-building `+` chain;
 * - every value that reaches an HTML sink, whatever its shape: `innerHTML =`, `outerHTML =`, `insertAdjacentHTML`,
 *   `content:`/`flavor:` properties, `dataset.tooltip =`, `setAttribute('data-tooltip', …)` and `ui.notifications.*`.
 *
 * A value is:
 * - escaped: a call that resolves BY SYMBOL (imports, `const` aliases, one-line wrappers) to `escHtml` in
 *   `rules/html.ts`. A name never counts, and a `.replace(…)` never escapes. A wrapper that undoes the quote escapes
 *   (`escContent`) escapes element content only: in an attribute it is a `fix`.
 * - safe: a number/boolean type (looking through `as`, `!`, `satisfies` and parentheses), a string-literal type,
 *   a `RULES.…`/`CONFIG.SR2E.…` property chain, `game.i18n.localize('literal')`, or an HTML fragment whose every part
 *   is itself safe or scanned where it is written (variables, arrays, local functions, parameters followed through
 *   their callers);
 * - `fix`: anything else (`string`, `string | undefined`, `string[]`, `any`, `unknown` that isn't resolved as safe).
 * - v0.89.1, translations (`helpers/i18n.ts`, by symbol): `tHtml(…)` escapes. `t('key', { … })` is judged by the
 *   values it fills in, each like any other value (the text itself is the system's own, from lang/en.json); a key
 *   that isn't a literal, or data that isn't an object literal, is a `fix`.
 * - v0.89.2: a translation written into an HTML template (`${tx('key', { v })}`) is judged value by value, each row
 *   under its own expression, so a reviewed allow-list entry still matches after its text moved into lang/en.json.
 *
 * An escaped value is still a `fix` in an unquoted attribute, inside a tag outside any attribute, or at the start of
 * a URL attribute (`href`, `src`, `action`, `formaction`, `xlink:href`) whose value has no literal scheme or path
 * before it: `escHtml` escapes neither spaces nor `javascript:`.
 *
 * Number- or literal-typed values that read card flags (`getFlag(…)`, `.flags.…`, or a `snap`/`ctx`/`flags`
 * parameter) without `Number(…)`, `safeInt(…)`, `Math.*` or a bounding helper are marked `flag` on their row
 * (SEC2b-2): TypeScript's type is only what the code hopes a forged card holds.
 *
 * `scanHbs` lists the Handlebars triple-stashes (`{{{…}}}`, `{{&…}}`), which bypass Handlebars' own escaping.
 */
import ts from 'typescript';
import fs from 'node:fs';
import path from 'node:path';

export interface HtmlScanRow {
  /** Path relative to the repo root, with forward slashes. */
  file: string;
  line: number;
  /** The nearest named function or class member around the site (`Class.method`, `fn`, or `(top)`). */
  fn: string;
  /** The judged expression's source text (whitespace collapsed, at most 160 chars). */
  expr: string;
  /** `fix (…)` or `safe-because …`. */
  verdict: string;
  /** Attribute name when the value sits inside a tag. */
  attr: string;
  /** Set for a sink row: `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `content`, `flavor`, `data-tooltip`, `notification`. */
  sink?: string;
  /** v0.85.0: the judged expression's [start, end) offsets in its file (for tools that fix the site). */
  span?: [number, number];
  /** A number/literal-typed value read from card flags without a bounding call (SEC2b-2). */
  flag?: boolean;
}

export interface HtmlScanOptions {
  /** Extra files or directories (absolute, or relative to the root) to scan with `src/`, e.g. test fixtures. */
  extra?: string[];
  /** Scan only the extra files (the rest of `src/` is still type-checked, so imports resolve). */
  onlyExtra?: boolean;
}

const HTMLISH = /<\/?[a-zA-Z][a-zA-Z0-9-]*[\s>/]|<[a-zA-Z][a-zA-Z0-9-]*$|&[a-z#0-9]+;/;
/** Calls whose callback results or receiver flow straight into the surrounding HTML. */
const PASS_THROUGH = /^(join|map|flatMap|filter|concat|slice|trim|replace|replaceAll|String)$/;
const URL_ATTRS = /^(href|src|action|formaction|xlink:href|srcset|poster|data)$/;
/** Placeholder for an earlier interpolation in the text before a site (never appears in real templates). */
const HOLE = '\u0000';
/** Calls that turn flag data into a bounded number (SEC2b-2). */
const BOUNDING = /^(Number|parseInt|parseFloat|safeInt|boundLevel|intIn|clamp|clampInt|toInt|num|Math\.\w+)$/;
/** Parameters that conventionally carry a card snapshot. */
const FLAG_PARAMS = /^(snap|snapshot|ctx|flags?|flagData)$/;
const HTML_TS = '/src/module/rules/html.ts';
/** v0.89.1: `t()` / `tHtml()` (translations) resolve to this file by symbol. */
const I18N_TS = '/src/module/helpers/i18n.ts';

/** `tHtml` (v0.89.1) is only resolved to `full` at a call with a literal key (escKind). */
type EscKind = 'full' | 'content' | 'tHtml' | null;

function strip(e: ts.Expression): ts.Expression {
  while (ts.isParenthesizedExpression(e) || ts.isAsExpression(e) || ts.isNonNullExpression(e) || ts.isSatisfiesExpression(e) || ts.isTypeAssertionExpression(e)) e = e.expression;
  return e;
}
function calleeName(call: ts.CallExpression): string {
  const e = strip(call.expression);
  if (ts.isIdentifier(e)) return e.text;
  if (ts.isPropertyAccessExpression(e)) return e.name.text.replace(/^#/, '');
  return '';
}
function isStr(e: ts.Node): e is ts.StringLiteral | ts.NoSubstitutionTemplateLiteral {
  return ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e);
}
interface AttrCtx { name: string; quote: string; value: string }
/** The attribute a value sits in, from the HTML text before it (earlier values are `HOLE`). */
function attrContext(before: string): AttrCtx | null {
  const lt = before.lastIndexOf('<'), gt = before.lastIndexOf('>');
  if (lt <= gt) return null;
  const tag = before.slice(lt);
  const dq = (tag.match(/"/g) || []).length, sq = (tag.match(/'/g) || []).length;
  const m = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(["']?)([^"'\s>]*)$/.exec(tag);
  if (m && (m[2] || !(dq % 2 || sq % 2))) return { name: m[1]!.toLowerCase(), quote: m[2] ?? '', value: m[3] ?? '' };
  if (dq % 2) { const mm = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*"([^"]*)$/.exec(tag); return { name: mm ? mm[1]!.toLowerCase() : '?', quote: '"', value: mm ? mm[2]! : '' }; }
  if (sq % 2) { const mm = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*'([^']*)$/.exec(tag); return { name: mm ? mm[1]!.toLowerCase() : '?', quote: "'", value: mm ? mm[2]! : '' }; }
  return { name: '(in-tag)', quote: '', value: '' };
}
/** A URL attribute value that already starts with a literal scheme, path, fragment or query. */
function urlHasLiteralStart(value: string): boolean {
  return /^([a-z][a-z0-9+.-]*:|[/.#?]|[\w-]+\/)/i.test(value);
}

function walkFiles(dir: string, out: string[], test: (f: string) => boolean): void {
  let ents: fs.Dirent[];
  try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const d of ents) {
    if (d.name === 'node_modules' || d.name.startsWith('.')) continue;
    const p = path.join(dir, d.name);
    if (d.isDirectory()) walkFiles(p, out, test);
    else if (test(p)) out.push(p);
  }
}

/** Scan `<root>/src` (and any extra files) and return every judged site with its verdict. */
export function scanHtml(root: string, opts: HtmlScanOptions = {}): HtmlScanRow[] {
  const cfg = ts.getParsedCommandLineOfConfigFile(path.join(root, 'tsconfig.json'), {}, { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => {} });
  if (!cfg) throw new Error('tsconfig.json not readable');
  const extra: string[] = [];
  for (const x of opts.extra ?? []) {
    const p = path.resolve(root, x);
    if (fs.statSync(p).isDirectory()) walkFiles(p, extra, (f) => /\.(ts|mts)$/.test(f) && !f.endsWith('.d.ts'));
    else extra.push(p);
  }
  // v0.83.0: `src/art/` is the build-time token-art generator (scripts/build-tokens.ts): never shipped or run in
  // Foundry, no user input, its SVG strings are constants; v083.test.ts checks the files it writes instead.
  const srcFiles = cfg.fileNames.filter((f) => f.includes('/src/') && !f.includes('__tests__') && !f.includes('/src/art/'));
  const files = [...srcFiles, ...extra];
  /** Files whose declarations the resolver may follow. */
  const fileSet = new Set(files.map((f) => path.resolve(f)));
  /** Files whose sites are reported. */
  const reportSet = opts.onlyExtra ? new Set(extra.map((f) => path.resolve(f))) : fileSet;
  const program = ts.createProgram(files, cfg.options);
  const checker = program.getTypeChecker();
  const inSrc = (d: ts.Node): boolean => fileSet.has(path.resolve(d.getSourceFile().fileName));

  function symbolOf(e: ts.Node): ts.Symbol | undefined {
    let s: ts.Symbol | undefined;
    try { s = checker.getSymbolAtLocation(e); } catch { return undefined; }
    if (s && s.flags & ts.SymbolFlags.Alias) { try { s = checker.getAliasedSymbol(s); } catch { /* keep */ } }
    return s;
  }
  const isConstDecl = (d: ts.VariableDeclaration): boolean => ts.isVariableDeclarationList(d.parent) && !!(d.parent.flags & ts.NodeFlags.Const);

  // ---- types ----
  function typeFlags(t: ts.Type): 'number' | 'literal' | 'any' | 'other' {
    const parts = t.isUnion() ? t.types : [t];
    let allNum = true, allLit = true;
    for (const p of parts) {
      const f = p.flags;
      if (f & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) return 'any';
      if (!(f & (ts.TypeFlags.NumberLike | ts.TypeFlags.BooleanLike | ts.TypeFlags.BigIntLike | ts.TypeFlags.Undefined | ts.TypeFlags.Null | ts.TypeFlags.Void))) allNum = false;
      if (!(f & (ts.TypeFlags.StringLiteral | ts.TypeFlags.NumberLike | ts.TypeFlags.BooleanLike | ts.TypeFlags.BigIntLike | ts.TypeFlags.Undefined | ts.TypeFlags.Null | ts.TypeFlags.Void))) allLit = false;
    }
    return allNum ? 'number' : allLit ? 'literal' : 'other';
  }
  /** `number`, `literal`, `any` or the printed type, judged on the expression inside any cast. */
  function typeKind(expr: ts.Expression): string {
    const e = strip(expr);
    // .toLocaleString()/.toFixed()/.toPrecision(): a number only when the receiver is one.
    if (ts.isCallExpression(e) && ts.isPropertyAccessExpression(e.expression) && /^(toLocaleString|toFixed|toPrecision|toString)$/.test(e.expression.name.text)) {
      const r = typeKind(e.expression.expression);
      if (r === 'number') return 'number';
      if (r === 'literal' && e.expression.name.text === 'toString') return 'literal';
      return r === 'any' ? 'any' : 'string';
    }
    try {
      const t = checker.getTypeAtLocation(e);
      const k = typeFlags(t);
      if (k !== 'other') return k;
      // number[] / literal[] (joined by `${…}`)
      if (checker.isArrayType(t)) {
        const el = checker.getTypeArguments(t as ts.TypeReference)[0];
        if (el) { const ek = typeFlags(el); if (ek === 'number' || ek === 'literal') return ek; }
      }
      return checker.typeToString(t).slice(0, 40);
    } catch { return '?'; }
  }

  // ---- escaping, by symbol ----
  const escMemo = new Map<ts.Symbol, EscKind>();
  function escKindOfSymbol(sym: ts.Symbol | undefined, depth: number): EscKind {
    if (!sym || depth > 6) return null;
    if (escMemo.has(sym)) return escMemo.get(sym)!;
    escMemo.set(sym, null); // cycle guard
    let k: EscKind = null;
    const d = sym.valueDeclaration ?? sym.declarations?.[0];
    if (d) {
      const file = path.resolve(d.getSourceFile().fileName).split(path.sep).join('/');
      if (ts.isFunctionDeclaration(d) && d.name?.text === 'escHtml' && file.endsWith(HTML_TS)) k = 'full';
      else if (ts.isFunctionDeclaration(d) && d.name?.text === 'tHtml' && file.endsWith(I18N_TS)) k = 'tHtml'; // v0.89.1: escapes its values; the key must be a literal (see escKind)
      else if (inSrc(d) && ts.isVariableDeclaration(d) && d.initializer && isConstDecl(d) && (ts.isIdentifier(strip(d.initializer)) || ts.isPropertyAccessExpression(strip(d.initializer)))) {
        k = escKindOfSymbol(symbolOf(strip(d.initializer)), depth + 1); // const esc = escHtml
      } else {
        const fn = functionDecl(sym);
        if (fn) k = wrapperKind(fn, depth + 1);
      }
    }
    escMemo.set(sym, k);
    return k;
  }
  /**
   * A one-line wrapper `(t) => escHtml(t)` escapes like `escHtml`. One that then puts back quotes
   * (`.replace(/&quot;/g, '"')`, as `escContent` does) escapes element content only.
   */
  function wrapperKind(fn: ts.SignatureDeclaration, depth: number): EscKind {
    const rs = returnsOf(fn);
    const p0 = fn.parameters[0];
    if (!rs || rs.length !== 1 || !p0 || !ts.isIdentifier(p0.name)) return null;
    const psym = symbolOf(p0.name);
    let r = strip(rs[0]!);
    let content = false;
    while (ts.isCallExpression(r) && ts.isPropertyAccessExpression(r.expression) && /^(replace|replaceAll)$/.test(r.expression.name.text)) {
      const rep = r.arguments[1];
      if (!rep || !isStr(rep) || /[<>&]/.test(rep.text)) return null;
      content = true;
      r = strip(r.expression.expression);
    }
    if (!ts.isCallExpression(r) || !r.arguments[0]) return null;
    const k = escKindOfSymbol(symbolOf(strip(r.expression)), depth + 1);
    if (!k || k === 'tHtml') return null; // a wrapper passing its parameter as tHtml's key escapes nothing
    let a = strip(r.arguments[0]);
    if (ts.isBinaryExpression(a) && (a.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken || a.operatorToken.kind === ts.SyntaxKind.BarBarToken) && isStr(strip(a.right))) a = strip(a.left);
    if (!ts.isIdentifier(a) || symbolOf(a) !== psym) return null;
    return content || k === 'content' ? 'content' : 'full';
  }
  /**
   * v0.89.1: a call of `t` (plain translation) or `tCount` (a counted noun) from helpers/i18n.ts: its text is the system's own (lang/en.json),
   * its filled-in values are not escaped, so each must be judged. Returns the call, or null for anything else.
   */
  function i18nT(e: ts.Expression): ts.CallExpression | null {
    e = strip(e);
    if (!ts.isCallExpression(e)) return null;
    const d = symbolOf(strip(e.expression))?.declarations?.[0];
    if (!d || !ts.isFunctionDeclaration(d) || (d.name?.text !== 't' && d.name?.text !== 'tCount')) return null;
    return path.resolve(d.getSourceFile().fileName).split(path.sep).join('/').endsWith(I18N_TS) ? e : null;
  }
  /** The values a `t()` call fills in, or null when they can't be listed (a key or data object that isn't literal). */
  function i18nValues(call: ts.CallExpression): ts.Expression[] | null {
    // t(key, data); tCount(n, key, data), whose count is a number by its type
    const counted = !!symbolOf(strip(call.expression))?.declarations?.some((d) => ts.isFunctionDeclaration(d) && d.name?.text === 'tCount');
    const at = counted ? 1 : 0;
    const key = call.arguments[at];
    if (!key || !isStr(strip(key))) return null;
    const pre: ts.Expression[] = counted && call.arguments[0] ? [call.arguments[0]] : [];
    const data = call.arguments[at + 1];
    if (!data) return pre;
    const o = strip(data);
    if (!ts.isObjectLiteralExpression(o)) return null;
    const out: ts.Expression[] = [...pre];
    for (const p of o.properties) {
      if (ts.isPropertyAssignment(p)) out.push(p.initializer);
      else if (ts.isShorthandPropertyAssignment(p)) out.push(p.name);
      else return null;
    }
    return out;
  }
  function escKind(e: ts.Expression): EscKind {
    e = strip(e);
    if (!ts.isCallExpression(e)) return null;
    const k = escKindOfSymbol(symbolOf(strip(e.expression)), 0);
    // tHtml escapes the values it fills in, not its key: an unknown key comes back as itself, unescaped (v0.89.1 review).
    if (k === 'tHtml') return e.arguments[0] && isStr(strip(e.arguments[0])) ? 'full' : null;
    return k;
  }

  // ---- constants ----
  function isLocalizeLiteral(e: ts.Expression): boolean {
    return ts.isCallExpression(e) && /^game\.i18n\.localize$/.test(e.expression.getText().replace(/\?\./g, '.')) && !!e.arguments[0] && isStr(strip(e.arguments[0]));
  }
  /** A `RULES.…` chain (RULES imported from rules/config.ts) or a `CONFIG.SR2E.…` chain: nothing else is a constant. */
  function isConst(expr: ts.Expression): boolean {
    const e = strip(expr);
    if (isLocalizeLiteral(e)) return true;
    let x: ts.Expression = e;
    const names: string[] = [];
    while (ts.isPropertyAccessExpression(x) || ts.isElementAccessExpression(x)) {
      if (ts.isPropertyAccessExpression(x)) names.unshift(x.name.text);
      else names.unshift('[]');
      x = strip(x.expression);
    }
    if (x === e || !ts.isIdentifier(x)) return false;
    if (x.text === 'RULES') {
      const d = symbolOf(x)?.declarations?.[0];
      return !!d && path.resolve(d.getSourceFile().fileName).split(path.sep).join('/').endsWith('/src/module/rules/config.ts');
    }
    return x.text === 'CONFIG' && names[0] === 'SR2E';
  }

  // ---- fragment resolution ----
  const memo = new Map<ts.Node, boolean>();
  const fnMemo = new Map<ts.Node, boolean>();
  const symMemo = new Map<ts.Symbol, boolean>();
  /** Every return value of a function-like declaration, without entering nested functions. */
  function returnsOf(fn: ts.SignatureDeclaration): ts.Expression[] | null {
    const body = (fn as ts.FunctionLikeDeclaration).body;
    if (!body) return null;
    if (!ts.isBlock(body)) return [body];
    const out: ts.Expression[] = [];
    const v = (n: ts.Node): void => { if (ts.isReturnStatement(n) && n.expression) out.push(n.expression); if (!ts.isFunctionLike(n)) ts.forEachChild(n, v); };
    ts.forEachChild(body, v);
    return out;
  }
  function functionDecl(sym: ts.Symbol | undefined): ts.SignatureDeclaration | null {
    const d = sym?.declarations?.[0];
    if (!d || !inSrc(d)) return null;
    if (ts.isFunctionDeclaration(d) || ts.isMethodDeclaration(d) || ts.isArrowFunction(d) || ts.isFunctionExpression(d)) return d;
    if ((ts.isVariableDeclaration(d) || ts.isPropertyAssignment(d) || ts.isPropertyDeclaration(d)) && d.initializer) {
      const i = strip(d.initializer);
      if (ts.isArrowFunction(i) || ts.isFunctionExpression(i)) return i;
    }
    return null;
  }
  /** Every identifier in the program's scanned files by its text (built once, lazily). */
  let names: Map<string, ts.Node[]> | null = null;
  function nameIndex(): Map<string, ts.Node[]> {
    if (!names) {
      const m = new Map<string, ts.Node[]>();
      const v = (n: ts.Node): void => {
        if (ts.isIdentifier(n) || ts.isPrivateIdentifier(n)) { const l = m.get(n.text); if (l) l.push(n); else m.set(n.text, [n]); }
        ts.forEachChild(n, v);
      };
      for (const f of program.getSourceFiles()) if (fileSet.has(path.resolve(f.fileName))) v(f);
      names = m;
    }
    return names;
  }
  function refsOf(sym: ts.Symbol): ts.Node[] {
    return (nameIndex().get(sym.name) ?? []).filter((n) => symbolOf(n) === sym);
  }
  /** `x.name` accesses that the checker can't tie to any symbol (an `any` receiver): they may call a method of that name. */
  function untypedAccesses(name: string): ts.Node[] {
    return (nameIndex().get(name) ?? []).filter((n) => ts.isPropertyAccessExpression(n.parent) && n.parent.name === n && !symbolOf(n));
  }
  /** All the values a local variable (or array) can hold: initializer, assignments, `+=`, push/unshift arguments. */
  function valuesOf(sym: ts.Symbol): ts.Expression[] | null {
    const d = sym.declarations?.[0];
    if (!d || !ts.isVariableDeclaration(d) || !ts.isIdentifier(d.name) || !inSrc(d)) return null;
    const out: ts.Expression[] = [];
    if (d.initializer) {
      const i = strip(d.initializer);
      if (ts.isArrayLiteralExpression(i)) { for (const el of i.elements) { if (ts.isSpreadElement(el)) return null; out.push(el); } }
      else out.push(d.initializer);
    }
    for (const n of refsOf(sym)) {
      if (n === d.name) continue;
      const p = n.parent;
      if (ts.isBinaryExpression(p) && p.left === n) {
        if (p.operatorToken.kind === ts.SyntaxKind.EqualsToken || p.operatorToken.kind === ts.SyntaxKind.PlusEqualsToken) out.push(p.right);
      } else if (ts.isPropertyAccessExpression(p) && p.expression === n && /^(push|unshift)$/.test(p.name.text) && ts.isCallExpression(p.parent)) {
        for (const a of p.parent.arguments) { if (ts.isSpreadElement(a)) return null; out.push(a); }
      } else if (ts.isElementAccessExpression(p) && p.expression === n && ts.isBinaryExpression(p.parent) && p.parent.left === p) {
        return null;
      } else if (ts.isPropertyAccessExpression(p) && p.expression === n && /^(splice|fill)$/.test(p.name.text)) {
        return null;
      }
    }
    return out;
  }
  /**
   * The values a parameter can take: the argument at its position in every call of its function, and its default.
   * Null when the function is also used as a value (a callback, an export called elsewhere), so its callers are unknown.
   */
  function paramValues(param: ts.ParameterDeclaration): ts.Expression[] | null {
    const fn = param.parent;
    if (param.dotDotDotToken || !ts.isIdentifier(param.name)) return null;
    const idx = fn.parameters.indexOf(param);
    let nameNode: ts.Node | undefined;
    if ((ts.isFunctionDeclaration(fn) || ts.isMethodDeclaration(fn)) && fn.name) nameNode = fn.name;
    else if ((ts.isArrowFunction(fn) || ts.isFunctionExpression(fn)) && (ts.isVariableDeclaration(fn.parent) || ts.isPropertyAssignment(fn.parent) || ts.isPropertyDeclaration(fn.parent))) nameNode = fn.parent.name;
    if (!nameNode) return null;
    const fsym = symbolOf(nameNode);
    if (!fsym) return null;
    const out: ts.Expression[] = param.initializer ? [param.initializer] : [];
    let calls = 0;
    // A method is also reachable through untyped receivers (`actor: any` → `actor.postBlast(…)`): count those calls too.
    const isMember = ts.isMethodDeclaration(fn) || ts.isPropertyDeclaration(fn.parent) || ts.isPropertyAssignment(fn.parent);
    const refs = isMember ? [...refsOf(fsym), ...untypedAccesses(fsym.name)] : refsOf(fsym);
    for (const r of refs) {
      if (r === nameNode || ts.isImportSpecifier(r.parent) || ts.isExportSpecifier(r.parent) || ts.isImportClause(r.parent)) continue;
      const callee = ts.isPropertyAccessExpression(r.parent) && r.parent.name === r ? r.parent : r;
      const call = callee.parent;
      if (!call || !ts.isCallExpression(call) || call.expression !== callee) return null;
      calls++;
      for (let i = 0; i <= idx && i < call.arguments.length; i++) if (ts.isSpreadElement(call.arguments[i]!)) return null;
      const a = call.arguments[idx];
      if (a) out.push(a);
    }
    return calls ? out : null;
  }
  /** `call(…).prop` or `const { prop } = call(…)`: the `prop` of every object literal the callee returns. */
  function propOfCall(call: ts.Expression, prop: string, d: number): boolean {
    call = strip(call);
    if (ts.isAwaitExpression(call)) call = strip(call.expression);
    if (!ts.isCallExpression(call)) return false;
    const fd = functionDecl(symbolOf(strip(call.expression)));
    const rs = fd && returnsOf(fd);
    if (!rs || !rs.length) return false;
    return rs.every((r) => {
      r = strip(r);
      if (!ts.isObjectLiteralExpression(r)) return false;
      const pa = r.properties.find((x) => x.name && x.name.getText() === prop);
      if (!pa) return false;
      if (ts.isPropertyAssignment(pa)) return safeFragment(pa.initializer, d);
      if (ts.isShorthandPropertyAssignment(pa)) { const vs = checker.getShorthandAssignmentValueSymbol(pa); return !!vs && safeSymbol(vs, d); }
      return false;
    });
  }
  /** Whether anything assigns to a property symbol (`obj.prop = …`). */
  function propertyWritten(sym: ts.Symbol): boolean {
    return refsOf(sym).some((n) => {
      const pa = n.parent;
      return ts.isPropertyAccessExpression(pa) && pa.name === n && ts.isBinaryExpression(pa.parent) && pa.parent.left === pa && pa.parent.operatorToken.kind >= ts.SyntaxKind.FirstAssignment && pa.parent.operatorToken.kind <= ts.SyntaxKind.LastAssignment;
    });
  }
  /** The object literal a `const` holds (its initializer, through casts), when it is only read. */
  function constObjectLiteral(e: ts.Expression): ts.ObjectLiteralExpression | null {
    e = strip(e);
    if (!ts.isIdentifier(e)) return null;
    const sym = symbolOf(e);
    const d = sym?.declarations?.[0];
    if (!sym || !d || !inSrc(d) || !ts.isVariableDeclaration(d) || !isConstDecl(d) || !d.initializer) return null;
    const i = strip(d.initializer);
    if (!ts.isObjectLiteralExpression(i)) return null;
    // element writes (`X[k] = …`) or passing it to Object.assign make it mutable
    for (const n of refsOf(sym)) {
      const p = n.parent;
      if (ts.isElementAccessExpression(p) && p.expression === n && ts.isBinaryExpression(p.parent) && p.parent.left === p) return null;
      if (ts.isCallExpression(p) && /Object\.assign|mergeObject/.test(p.expression.getText()) && p.arguments[0] === n) return null;
    }
    return i;
  }
  function safeSymbol(sym: ts.Symbol, d: number): boolean {
    const decl = sym.declarations?.[0];
    if (!decl || !inSrc(decl)) return false;
    if (symMemo.has(sym)) return symMemo.get(sym)!;
    symMemo.set(sym, false); // cycle guard
    let ok = false;
    if (ts.isParameter(decl)) { const vals = paramValues(decl); ok = !!vals && vals.length > 0 && vals.every((x) => safeFragment(x, d)); }
    else if (ts.isBindingElement(decl) && ts.isObjectBindingPattern(decl.parent) && !decl.dotDotDotToken && ts.isVariableDeclaration(decl.parent.parent) && decl.parent.parent.initializer) {
      ok = propOfCall(decl.parent.parent.initializer, (decl.propertyName ?? decl.name).getText(), d);
    } else if ((ts.isPropertyAssignment(decl) || ts.isPropertyDeclaration(decl)) && decl.initializer) {
      // a property of a const object literal (or a readonly class field) that nothing writes
      const readonlyField = ts.isPropertyDeclaration(decl) && !!ts.getCombinedModifierFlags(decl) && (ts.getCombinedModifierFlags(decl) & ts.ModifierFlags.Readonly);
      const holder = ts.isPropertyAssignment(decl) ? decl.parent : null;
      const constHolder = holder && ts.isObjectLiteralExpression(holder) && ts.isVariableDeclaration(holder.parent) && isConstDecl(holder.parent);
      const nestedConst = holder && ts.isObjectLiteralExpression(holder) && ts.isPropertyAssignment(holder.parent);
      if ((readonlyField || constHolder || nestedConst) && !propertyWritten(sym)) ok = safeFragment(decl.initializer, d);
    } else { const vals = valuesOf(sym); ok = !!vals && vals.length > 0 && vals.every((x) => safeFragment(x, d)); }
    symMemo.set(sym, ok);
    return ok;
  }
  function safeLeaf(e: ts.Expression): boolean {
    e = strip(e);
    if (isStr(e) || ts.isNumericLiteral(e)) return true;
    if (escKind(e) === 'full') return true;
    const k = typeKind(e);
    return k === 'number' || k === 'literal' || isConst(e);
  }
  function safeFragment(e: ts.Expression, depth = 0): boolean {
    e = strip(e);
    if (safeLeaf(e)) return true;
    if (depth > 8) return false;
    if (memo.has(e)) return memo.get(e)!;
    memo.set(e, false); // cycle guard
    const r = safeFragmentInner(e, depth);
    memo.set(e, r);
    return r;
  }
  function plusOperands(b: ts.Expression): ts.Expression[] {
    const ops: ts.Expression[] = [];
    const flat = (x: ts.Expression): void => { if (ts.isBinaryExpression(x) && x.operatorToken.kind === ts.SyntaxKind.PlusToken) { flat(x.left); flat(x.right); } else ops.push(x); };
    flat(b);
    return ops;
  }
  function safeFragmentInner(e: ts.Expression, depth: number): boolean {
    const d = depth + 1;
    if (ts.isTemplateExpression(e)) {
      if (scanned.has(e)) return true; // its own ${…} are judged where it is written
      return e.templateSpans.every((s) => safeFragment(s.expression, d));
    }
    if (ts.isConditionalExpression(e)) return safeFragment(e.whenTrue, d) && safeFragment(e.whenFalse, d);
    if (ts.isAwaitExpression(e)) return safeFragment(e.expression, d);
    { const tc = i18nT(e); if (tc) { const vs = i18nValues(tc); return !!vs && vs.every((v) => safeFragment(v, d)); } }
    if (ts.isBinaryExpression(e)) {
      const k = e.operatorToken.kind;
      if (k === ts.SyntaxKind.AmpersandAmpersandToken) return safeFragment(e.right, d);
      if (k === ts.SyntaxKind.BarBarToken || k === ts.SyntaxKind.QuestionQuestionToken) return safeFragment(e.left, d) && safeFragment(e.right, d);
      if (k === ts.SyntaxKind.PlusToken) {
        if (scanned.has(e)) return true; // an HTML `+` chain, judged where it is written
        return plusOperands(e).every((o) => safeFragment(o, d));
      }
      if (k === ts.SyntaxKind.CommaToken) return safeFragment(e.right, d);
      return false;
    }
    if (ts.isIdentifier(e)) {
      // `{ content }`: the variable, not the property
      const sym = ts.isShorthandPropertyAssignment(e.parent) && e.parent.name === e ? checker.getShorthandAssignmentValueSymbol(e.parent) : symbolOf(e);
      return !!sym && safeSymbol(sym, d);
    }
    if (ts.isPropertyAccessExpression(e)) {
      if (ts.isCallExpression(strip(e.expression)) || ts.isAwaitExpression(strip(e.expression))) return propOfCall(e.expression, e.name.text, d);
      const sym = symbolOf(e.name);
      return !!sym && safeSymbol(sym, d);
    }
    if (ts.isElementAccessExpression(e)) {
      // a lookup in a const table whose every value is safe (the key only picks one)
      const obj = constObjectLiteral(e.expression);
      return !!obj && obj.properties.length > 0 && obj.properties.every((p) => ts.isPropertyAssignment(p) && safeFragment(p.initializer, d));
    }
    if (ts.isCallExpression(e)) {
      const n = calleeName(e);
      const callee = strip(e.expression);
      // String(x) is judged by x
      if (ts.isIdentifier(callee) && callee.text === 'String' && !inSrcSym(callee)) return !e.arguments[0] || safeFragment(e.arguments[0], d);
      // game.i18n.format('KEY', { … }) is safe when the key is a literal and every data value is safe
      if (/^game\.i18n\.format$/.test(callee.getText().replace(/\?\./g, '.'))) {
        const [k, data] = e.arguments;
        if (!k || !isStr(strip(k))) return false;
        if (!data) return true;
        const o = strip(data);
        return ts.isObjectLiteralExpression(o) && o.properties.every((p) => (ts.isPropertyAssignment(p) && safeFragment(p.initializer, d)) || (ts.isShorthandPropertyAssignment(p) && safeFragment(p.name, d)));
      }
      if (ts.isPropertyAccessExpression(callee)) {
        const obj = callee.expression;
        // array pipelines: x.map(cb).filter(..).join(sep)
        if (n === 'join' || n === 'filter' || n === 'slice' || n === 'concat' || n === 'reverse' || n === 'sort' || n === 'trim' || n === 'toString') {
          if (n === 'concat' && !e.arguments.every((a) => safeFragment(a, d))) return false;
          if (n === 'join' && e.arguments[0] && !safeFragment(e.arguments[0], d)) return false;
          return safeFragment(obj, d);
        }
        if (n === 'replace' || n === 'replaceAll') return safeFragment(obj, d) && (!e.arguments[1] || ts.isFunctionLike(strip(e.arguments[1])) ? false : safeFragment(e.arguments[1], d));
        if (n === 'map' || n === 'flatMap') {
          const cb = e.arguments[0] && strip(e.arguments[0]);
          if (!cb) return false;
          if (ts.isArrowFunction(cb) || ts.isFunctionExpression(cb)) { const rs = returnsOf(cb); return !!rs && rs.length > 0 && rs.every((x) => safeFragment(x, d)); }
          if (escKindOfSymbol(symbolOf(cb), 0) === 'full') return true; // .map(esc)
          const fd = functionDecl(symbolOf(cb));
          if (fd) { const rs = returnsOf(fd); return !!rs && rs.length > 0 && rs.every((x) => safeFragment(x, d)); }
          return false;
        }
      }
      const fd = ts.isArrowFunction(callee) || ts.isFunctionExpression(callee) ? callee : functionDecl(symbolOf(callee)); // an IIFE, or a named function
      if (!fd) return false;
      if (fnMemo.has(fd)) return fnMemo.get(fd)!;
      fnMemo.set(fd, false);
      const rs = returnsOf(fd);
      const ok = !!rs && rs.length > 0 && rs.every((x) => safeFragment(x, d));
      fnMemo.set(fd, ok);
      return ok;
    }
    if (ts.isArrayLiteralExpression(e)) return e.elements.every((x) => !ts.isSpreadElement(x) && safeFragment(x, d));
    return false;
  }
  function inSrcSym(id: ts.Identifier): boolean {
    const d = symbolOf(id)?.declarations?.[0];
    return !!d && inSrc(d);
  }

  // ---- flag data (SEC2b-2) ----
  const flagMemo = new Map<ts.Symbol, boolean>();
  function readsFlags(e: ts.Expression, depth = 0): boolean {
    if (depth > 6) return false;
    e = strip(e);
    if (ts.isCallExpression(e)) {
      const callee = strip(e.expression);
      const ct = callee.getText().replace(/\?\./g, '.');
      if (BOUNDING.test(ct) || BOUNDING.test(calleeName(e))) return false;
      if (calleeName(e) === 'getFlag') return true;
      if (ts.isPropertyAccessExpression(callee)) return readsFlags(callee.expression, depth + 1); // ctx.hits.toFixed()
      return false;
    }
    if (ts.isPropertyAccessExpression(e)) return e.name.text === 'flags' || readsFlags(e.expression, depth + 1);
    if (ts.isElementAccessExpression(e)) return readsFlags(e.expression, depth + 1);
    if (ts.isIdentifier(e)) {
      const sym = symbolOf(e);
      const decl = sym?.declarations?.[0];
      if (!sym || !decl || !inSrc(decl)) return false;
      if (flagMemo.has(sym)) return flagMemo.get(sym)!;
      flagMemo.set(sym, false);
      let r = false;
      if (ts.isParameter(decl)) r = ts.isIdentifier(decl.name) && FLAG_PARAMS.test(decl.name.text);
      else if (ts.isVariableDeclaration(decl) && decl.initializer) r = readsFlags(ts.isAwaitExpression(strip(decl.initializer)) ? (strip(decl.initializer) as ts.AwaitExpression).expression : decl.initializer, depth + 1);
      else if (ts.isBindingElement(decl)) {
        let p: ts.Node = decl.parent;
        while (p && !ts.isVariableDeclaration(p) && !ts.isParameter(p)) p = p.parent;
        if (p && ts.isVariableDeclaration(p) && p.initializer) r = readsFlags(p.initializer, depth + 1);
        else if (p && ts.isParameter(p) && ts.isIdentifier(p.name)) r = FLAG_PARAMS.test(p.name.text);
      }
      flagMemo.set(sym, r);
      return r;
    }
    if (ts.isBinaryExpression(e)) return readsFlags(e.left, depth + 1) || readsFlags(e.right, depth + 1);
    if (ts.isConditionalExpression(e)) return readsFlags(e.whenTrue, depth + 1) || readsFlags(e.whenFalse, depth + 1);
    if (ts.isPrefixUnaryExpression(e)) return false; // -x, +x coerce to a number
    return false;
  }

  // ---- naming the site ----
  /** `Class.member`, `fn`, or `outer>inner` for a named local function inside one; `(top)` outside any. */
  function enclosingName(n: ts.Node): string {
    const chain: string[] = [];
    for (let p: ts.Node | undefined = n.parent; p; p = p.parent) {
      let name: string | undefined;
      if ((ts.isFunctionDeclaration(p) || ts.isMethodDeclaration(p) || ts.isGetAccessorDeclaration(p) || ts.isSetAccessorDeclaration(p) || ts.isPropertyDeclaration(p)) && p.name) name = p.name.getText();
      else if (ts.isConstructorDeclaration(p)) name = 'constructor';
      else if ((ts.isArrowFunction(p) || ts.isFunctionExpression(p)) && (ts.isVariableDeclaration(p.parent) || ts.isPropertyAssignment(p.parent)) && ts.isIdentifier(p.parent.name)) { name = p.parent.name.text; p = p.parent; }
      else if (ts.isVariableDeclaration(p) && ts.isIdentifier(p.name) && ts.isVariableStatement(p.parent.parent) && ts.isSourceFile(p.parent.parent.parent)) name = p.name.text;
      if (!name) continue;
      if (ts.isClassElement(p) && p.parent && (ts.isClassDeclaration(p.parent) || ts.isClassExpression(p.parent)) && p.parent.name) { chain.unshift(`${p.parent.name.text}.${name}`); break; }
      if (chain[0] !== name) chain.unshift(name);
      if (ts.isFunctionDeclaration(p) && ts.isSourceFile(p.parent)) break;
    }
    return chain.length ? chain.join('>') : '(top)';
  }

  // ---- visit: collect every interpolation first, so fragment resolution knows which templates are scanned ----
  const scanned = new Set<ts.Node>();
  interface Site { sf: ts.SourceFile; rel: string; expr: ts.Expression; before: string | null; sink?: string }
  const pending: Site[] = [];
  const sinkSites: Site[] = [];
  const reportFiles = program.getSourceFiles().filter((sf) => reportSet.has(path.resolve(sf.fileName)));
  for (const sf of reportFiles) {
    const rel = path.relative(root, sf.fileName).split(path.sep).join('/');
    const emit = (expr: ts.Expression, before: string): void => { pending.push({ sf, rel, expr, before }); };
    const handleTemplate = (t: ts.TemplateExpression, inHtml: boolean): boolean => {
      const text = t.head.text + t.templateSpans.map((s) => s.literal.text).join('');
      if (!HTMLISH.test(text) && !inHtml) return false;
      scanned.add(t);
      let before = t.head.text;
      for (const s of t.templateSpans) { emit(s.expression, before); before += HOLE + s.literal.text; }
      return true;
    };
    const handleConcat = (b: ts.BinaryExpression): void => {
      const ops = plusOperands(b);
      const lits = ops.filter(isStr);
      if (!lits.length || !HTMLISH.test(lits.map((l) => l.text).join(''))) return;
      scanned.add(b);
      let before = '';
      for (const o of ops) {
        if (isStr(o)) before += o.text;
        else if (ts.isTemplateExpression(o) && HTMLISH.test(o.head.text + o.templateSpans.map((s) => s.literal.text).join(''))) before += HOLE;
        else { emit(o, before); before += HOLE; }
      }
    };
    const visit = (node: ts.Node, inHtml: boolean): void => {
      let next = inHtml;
      if (ts.isTemplateExpression(node)) next = handleTemplate(node, inHtml);
      else if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken && !(ts.isBinaryExpression(node.parent) && node.parent.operatorToken.kind === ts.SyntaxKind.PlusToken)) handleConcat(node);
      else if (ts.isCallExpression(node) && escKind(node)) next = false;
      else if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) next = false;
      // The arguments of an ordinary call are not HTML by position: the call's result is what lands in the HTML,
      // and `safeFragment` judges that by the callee's own returns. Array pipelines pass their pieces through.
      else if (ts.isCallExpression(node) && !PASS_THROUGH.test(calleeName(node))) {
        visit(node.expression, inHtml);
        for (const a of node.arguments) visit(a, false);
        return;
      }
      ts.forEachChild(node, (c) => visit(c, next));
    };
    visit(sf, false);

    // sinks
    const sink = (e: ts.Expression, kind: string): void => { sinkSites.push({ sf, rel, expr: e, before: null, sink: kind }); };
    const isAssign = (n: ts.Node): n is ts.BinaryExpression => ts.isBinaryExpression(n) && (n.operatorToken.kind === ts.SyntaxKind.EqualsToken || n.operatorToken.kind === ts.SyntaxKind.PlusEqualsToken);
    const sv = (n: ts.Node): void => {
      if (isAssign(n)) {
        const l = n.left;
        if (ts.isPropertyAccessExpression(l) && /^(innerHTML|outerHTML)$/.test(l.name.text)) sink(n.right, l.name.text);
        else if (ts.isPropertyAccessExpression(l) && l.name.text === 'tooltip' && /dataset$/.test(l.expression.getText())) sink(n.right, 'data-tooltip');
        else if (ts.isElementAccessExpression(l) && /dataset$/.test(l.expression.getText()) && /^['"`]tooltip['"`]$/.test(l.argumentExpression.getText())) sink(n.right, 'data-tooltip');
      }
      if (ts.isCallExpression(n)) {
        const t = n.expression.getText().replace(/\?\./g, '.');
        if (/\.insertAdjacentHTML$/.test(t) && n.arguments[1]) sink(n.arguments[1], 'insertAdjacentHTML');
        else if (/\bnotifications\.(info|warn|error|notify|success)$/.test(t) && n.arguments[0]) sink(n.arguments[0], 'notification');
        else if (/\.setAttribute$/.test(t) && n.arguments[0] && /^['"`]data-tooltip['"`]$/.test(n.arguments[0].getText()) && n.arguments[1]) sink(n.arguments[1], 'data-tooltip');
      }
      if (ts.isPropertyAssignment(n) && /^(content|flavor)$/.test(n.name.getText().replace(/['"]/g, '')) && ts.isObjectLiteralExpression(n.parent)) sink(n.initializer, n.name.getText().replace(/['"]/g, ''));
      if (ts.isShorthandPropertyAssignment(n) && /^(content|flavor)$/.test(n.name.text)) sink(n.name, n.name.text);
      ts.forEachChild(n, sv);
    };
    sv(sf);
  }

  // ---- judging ----
  const rows: HtmlScanRow[] = [];
  const push = (s: Site, e: ts.Expression, verdict: string, attr: string, flag = false): void => {
    const row: HtmlScanRow = { file: s.rel, line: s.sf.getLineAndCharacterOfPosition(e.getStart()).line + 1, fn: enclosingName(e), expr: e.getText().replace(/\s+/g, ' ').slice(0, 160), verdict, attr };
    if (s.sink) row.sink = s.sink;
    row.span = [e.getStart(), e.getEnd()];
    if (flag) row.flag = true;
    rows.push(row);
  };
  /** The verdict for one value at one place in the HTML. */
  function judge(expr: ts.Expression, attr: AttrCtx | null): { verdict: string; flag: boolean } {
    const inAttr = !!attr;
    const ek = escKind(expr);
    if (ek) {
      if (!attr) return { verdict: ek === 'full' ? 'escaped' : 'escaped (content)', flag: false };
      if (ek === 'content') return { verdict: 'fix (quote-keeping escape inside an attribute)', flag: false };
      if (attr.name === '(in-tag)') return { verdict: 'fix (escaped value inside a tag, outside any attribute)', flag: false };
      if (!attr.quote) return { verdict: 'fix (escaped value in an unquoted attribute)', flag: false };
      if (URL_ATTRS.test(attr.name) && !urlHasLiteralStart(attr.value)) return { verdict: `fix (escaped value starts a ${attr.name} URL; escHtml keeps javascript:)`, flag: false };
      return { verdict: 'escaped', flag: false };
    }
    const kind = typeKind(expr);
    let verdict: string;
    if (kind === 'number') verdict = 'safe-because number/boolean type';
    else if (kind === 'literal') verdict = 'safe-because string-literal type';
    else if (isConst(expr)) verdict = 'safe-because system constant';
    else if (safeFragment(expr)) verdict = 'safe-because HTML fragment whose parts are judged';
    else verdict = `fix (unescaped ${kind === 'any' ? 'any' : 'text'} into HTML)`;
    if (inAttr && attr.name !== '(in-tag)' && !attr.quote && verdict.startsWith('fix')) verdict += '; unquoted attribute';
    const flag = (kind === 'number' || kind === 'literal') && readsFlags(expr);
    return { verdict, flag };
  }
  /** v0.89.2: a translation written into HTML (`${tx('key', { v })}`) is judged value by value, each as its own row. */
  const judgeParts = (s: Site, e: ts.Expression, attr: AttrCtx | null): void => {
    const tc = i18nT(e);
    if (tc) {
      const vs = i18nValues(tc);
      if (!vs) { push(s, e, `fix (translation with a key or values that can't be checked into HTML)`, attr ? attr.name : ''); return; }
      for (const v of vs) judgeParts(s, v, attr);
      return;
    }
    const x = strip(e);
    if (ts.isConditionalExpression(x) && (i18nT(x.whenTrue) || i18nT(x.whenFalse))) { judgeParts(s, x.whenTrue, attr); judgeParts(s, x.whenFalse, attr); return; }
    if (ts.isBinaryExpression(x) && (x.operatorToken.kind === ts.SyntaxKind.BarBarToken || x.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken) && (i18nT(x.left) || i18nT(x.right))) { judgeParts(s, x.left, attr); judgeParts(s, x.right, attr); return; }
    if (isStr(x)) return;
    const { verdict, flag } = judge(e, attr);
    if (verdict === 'escaped' || verdict === 'escaped (content)') return;
    push(s, e, verdict, attr ? attr.name : '', flag);
  };
  for (const s of pending) {
    const attr = s.before === null ? null : attrContext(s.before);
    if (i18nT(s.expr) || (() => { const x = strip(s.expr); return (ts.isConditionalExpression(x) && (!!i18nT(x.whenTrue) || !!i18nT(x.whenFalse))) || (ts.isBinaryExpression(x) && (!!i18nT(x.left) || !!i18nT(x.right))); })()) { judgeParts(s, s.expr, attr); continue; }
    const { verdict, flag } = judge(s.expr, attr);
    if (verdict === 'escaped' || verdict === 'escaped (content)') continue;
    push(s, s.expr, verdict, attr ? attr.name : '', flag);
  }
  // Every value reaching a sink, whatever its shape (SEC2b-5): no-markup templates and `+` chains are split into
  // their parts, conditionals into their branches.
  const judgeSink = (s: Site, e: ts.Expression): void => {
    const x = strip(e);
    if (scanned.has(x)) return; // an HTML template or `+` chain: judged part by part already
    if (isStr(x)) return;
    if (ts.isTemplateExpression(x)) { for (const sp of x.templateSpans) judgeSink(s, sp.expression); return; }
    if (ts.isConditionalExpression(x)) { judgeSink(s, x.whenTrue); judgeSink(s, x.whenFalse); return; }
    if (ts.isAwaitExpression(x)) { judgeSink(s, x.expression); return; }
    { // v0.89.1: a translation: each filled-in value is judged where it is passed
      const tc = i18nT(x);
      if (tc) {
        const vs = i18nValues(tc);
        if (!vs) { push(s, x, `fix (translation with a key or values that can't be checked into ${s.sink})`, ''); return; }
        for (const v of vs) judgeSink(s, v);
        return;
      }
    }
    if (ts.isBinaryExpression(x) && (x.operatorToken.kind === ts.SyntaxKind.BarBarToken || x.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken)) { judgeSink(s, x.left); judgeSink(s, x.right); return; }
    if (ts.isBinaryExpression(x) && x.operatorToken.kind === ts.SyntaxKind.PlusToken) { for (const o of plusOperands(x)) judgeSink(s, o); return; }
    const { verdict, flag } = judge(x, null);
    if (verdict === 'escaped' || verdict === 'escaped (content)') return;
    push(s, x, verdict.startsWith('fix') ? verdict.replace('into HTML', `into ${s.sink}`) : verdict, '', flag);
  };
  for (const s of sinkSites) judgeSink(s, s.expr);
  return rows;
}

export interface HbsRow { file: string; line: number; expr: string }
/** Every Handlebars triple-stash (`{{{x}}}`) or `{{&x}}` under the root: these skip Handlebars' escaping. */
export function scanHbs(root: string): HbsRow[] {
  const files: string[] = [];
  walkFiles(root, files, (f) => f.endsWith('.hbs') || f.endsWith('.handlebars'));
  const out: HbsRow[] = [];
  for (const f of files.sort()) {
    const lines = fs.readFileSync(f, 'utf8').split('\n');
    lines.forEach((l, i) => {
      for (const m of l.matchAll(/\{\{~?\{\s*([^}]*?)\s*\}~?\}\}|\{\{~?&\s*([^}]*?)\s*~?\}\}/g)) {
        out.push({ file: path.relative(root, f).split(path.sep).join('/'), line: i + 1, expr: (m[1] ?? m[2] ?? '').trim() });
      }
    });
  }
  return out;
}
