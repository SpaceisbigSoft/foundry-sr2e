#!/usr/bin/env node
/**
 * v0.89.1: move the text of `ui.notifications.*` calls into lang/en.json (`SR2E.Notify.<File>.<key>`).
 *
 *   ui.notifications?.warn?.(`${escHtml(this.name)} has no ${track} damage.`)
 *   →  ui.notifications?.warn?.(tx('SR2E.Notify.Actor.nameHasNoTrackDamage', { name: escHtml(this.name), track }))
 *
 * - The first argument is rewritten when it is a string literal, a template literal, or a conditional of those.
 *   `${expr}` becomes `{name}` with `name: expr`; the value keeps its escHtml wrapper, so the English output is the
 *   same as before (en.json holds the text exactly as the code wrote it).
 * - English inside a value (a ternary's branches, a `?? 'default'`, a nested template, an escHtml argument) gets
 *   its own key, so it is translatable too. One-letter plural suffixes ('s') stay as values (see REVIEW-v0.89.1).
 * - `t` is shadowed all over the code (tokens, types), so the import is `import { t as tx }`.
 * - One key per English text in each group; the group is the file (documents/index.ts → Actor).
 *
 *   node scripts/i18n-notify.mjs           convert every file, add the keys
 *   node scripts/i18n-notify.mjs --check   report what is left (exit 1 when a call still holds English)
 */
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'src', 'module');
const LANG = path.join(ROOT, 'public', 'lang', 'en.json');
const I18N = path.join(SRC, 'helpers', 'i18n.ts');
const CHECK = process.argv.includes('--check');
const ALIAS = 'tx';

const GROUP_OF = { 'documents/index.ts': 'Actor', 'applications/chat.ts': 'Chat', 'applications/sheets.ts': 'Sheet' };
const groupOf = (rel) => GROUP_OF[rel] ?? path.basename(rel, '.ts').replace(/(^|[-_])(\w)/g, (_m, _a, c) => c.toUpperCase());

const lang = JSON.parse(fs.readFileSync(LANG, 'utf8'));
lang.SR2E ??= {};
lang.SR2E.Notify ??= {};
const NOTIFY = lang.SR2E.Notify;

function slug(text) {
  const words = text.replace(/\{[^}]*\}/g, ' ').replace(/[^A-Za-z0-9 ]+/g, ' ').trim().split(/\s+/).filter(Boolean).slice(0, 6);
  const s = words.map((w, i) => (i ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w.toLowerCase())).join('').slice(0, 40);
  return /^[0-9]/.test(s) ? `n${s}` : s || 'text';
}
function keyFor(group, english) {
  const g = (NOTIFY[group] ??= {});
  for (const [k, v] of Object.entries(g)) if (v === english) return `SR2E.Notify.${group}.${k}`;
  const base = slug(english);
  let k = base;
  for (let n = 2; Object.hasOwn(g, k); n++) k = `${base}${n}`;
  g[k] = english;
  return `SR2E.Notify.${group}.${k}`;
}

const RESERVED = new Set('break case catch class const continue debugger default delete do else enum export extends false finally for function if import in instanceof new null return super switch this throw true try typeof var void while with yield let static implements interface package private protected public await'.split(' '));
const WRAPPERS = /^(escHtml|escText|esc|String|Number|cap|Math\.\w+|safeInt|signed|fmt\w*)$/;
const DROP = new Set(['this', 'sys', 'system', 'flags', 'data', 'game', 'ctx', 'snap', 'opts', 'o', 'r', 'a', 'b', 'c', 'x', 'f', 's', 'e', 'i', 'n', 'p', 'v', 'g', 'm', 'd', 'k', 'it', 'parent']);

function strip(e) {
  while (ts.isParenthesizedExpression(e) || ts.isAsExpression(e) || ts.isNonNullExpression(e) || (ts.isSatisfiesExpression?.(e))) e = e.expression;
  return e;
}
const isLit = (e) => ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e);
const hasWord = (s) => /[A-Za-z]{2,}/.test(s);
const isSuffix = (s) => /^(s|es|ies|y|en|ren|)$/.test(s);

/** A placeholder name for a value. */
function nameOf(expr) {
  let e = strip(expr);
  for (let guard = 0; guard < 8; guard++) {
    e = strip(e);
    if (ts.isCallExpression(e)) {
      const callee = e.expression.getText().replace(/\?\./g, '.');
      if (WRAPPERS.test(callee) && e.arguments[0]) { e = e.arguments[0]; continue; }
      if (ts.isPropertyAccessExpression(e.expression) && /^(toLocaleString|toString|toFixed|toLowerCase|toUpperCase|trim|join|toUpperCase)$/.test(e.expression.name.text)) { e = e.expression.expression; continue; }
      const last = callee.split('.').pop() ?? 'value';
      return clean(last.replace(/^(get|describe|format|label|fmt)(?=[A-Z])/, '').replace(/^./, (c) => c.toLowerCase()));
    }
    if (ts.isBinaryExpression(e) && [ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.BarBarToken].includes(e.operatorToken.kind)) { e = e.left; continue; }
    break;
  }
  if (ts.isConditionalExpression(e)) {
    const lits = [e.whenTrue, e.whenFalse].map(strip);
    if (lits.every((l) => isLit(l) && l.text.length <= 3)) return 'plural';
    return 'part';
  }
  if (ts.isElementAccessExpression(e)) return nameOf(e.expression);
  const parts = [];
  let x = e;
  while (ts.isPropertyAccessExpression(x)) { parts.unshift(x.name.text.replace(/^#/, '')); x = strip(x.expression); }
  if (ts.isIdentifier(x)) parts.unshift(x.text);
  const kept = parts.filter((p) => !DROP.has(p));
  if (!kept.length) return parts.length ? clean(parts[parts.length - 1]) : 'value';
  const two = kept.slice(-2);
  return clean(two.map((w, i) => (i ? w.charAt(0).toUpperCase() + w.slice(1) : w)).join(''));
}
function clean(n) {
  n = String(n).replace(/[^A-Za-z0-9_]/g, '');
  if (!n || /^[0-9]/.test(n)) n = `v${n}`;
  if (RESERVED.has(n)) n = `${n}Value`;
  return n.charAt(0).toLowerCase() + n.slice(1);
}

const leftovers = [];

/**
 * The source text of an expression in a value position, with the English literals and templates inside it
 * (ternary branches, defaults, escHtml arguments, nested templates) turned into tx() calls.
 */
function valueText(node, ctx) {
  const e = strip(node);
  const conv = convertNode(e, ctx, true);
  if (conv !== null) return replaceInside(node, e, conv);
  const edits = [];
  const visit = (n) => {
    const s = strip(n);
    if (ts.isConditionalExpression(s)) { sub(s.whenTrue); sub(s.whenFalse); return; }
    if (ts.isBinaryExpression(s) && [ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.BarBarToken].includes(s.operatorToken.kind)) { sub(s.left); sub(s.right); return; }
    if (ts.isCallExpression(s) && WRAPPERS.test(s.expression.getText().replace(/\?\./g, '.')) && s.arguments[0]) { sub(s.arguments[0]); return; }
    if (ts.isCallExpression(s) && ts.isPropertyAccessExpression(s.expression) && /^(toLowerCase|toUpperCase|trim)$/.test(s.expression.name.text)) { sub(s.expression.expression); return; }
    // anything else: look for English that stays behind, for the report
    const ownText = (m) => (isLit(m) ? m.text : [m.head.text, ...m.templateSpans.map((x) => x.literal.text)].join(' '));
    const look = (m) => { if ((isLit(m) || ts.isTemplateExpression(m)) && hasWord(ownText(m)) && !/^['"`][\w.\-/#:]*['"`]$/.test(m.getText())) leftovers.push(`${ctx.rel}:${line(ctx, m)} value literal left: ${m.getText().slice(0, 80)}`); ts.forEachChild(m, look); };
    look(s);
  };
  const sub = (n) => {
    const s = strip(n);
    const c = convertNode(s, ctx, true);
    if (c !== null) edits.push([s.getStart(), s.getEnd(), c]);
    else visit(n);
  };
  visit(node);
  return applyEdits(node.getText(), node.getStart(), edits);
}
function replaceInside(outer, inner, text) {
  return applyEdits(outer.getText(), outer.getStart(), [[inner.getStart(), inner.getEnd(), text]]);
}
function applyEdits(src, base, edits) {
  let out = src;
  for (const [s, e, t] of [...edits].sort((a, b) => b[0] - a[0])) out = out.slice(0, s - base) + t + out.slice(e - base);
  return out;
}
const line = (ctx, n) => ctx.sf.getLineAndCharacterOfPosition(n.getStart()).line + 1;

/** A tx() call for a literal or template (null when it holds no English, or can't be converted). */
function convertNode(e, ctx, nested) {
  if (isLit(e)) {
    if (!hasWord(e.text) || (nested && isSuffix(e.text))) return null;
    if (/[{}]/.test(e.text)) { leftovers.push(`${ctx.rel}:${line(ctx, e)} braces in text: ${e.getText().slice(0, 80)}`); return null; }
    ctx.count++;
    return `${ALIAS}('${keyFor(ctx.group, e.text)}')`;
  }
  if (ts.isTemplateExpression(e)) {
    let text = e.head.text;
    const names = new Map(); // expr source → name
    const used = new Set();
    const props = [];
    for (const span of e.templateSpans) {
      const src = span.expression.getText();
      let nm = names.get(src);
      if (!nm) {
        const base = nameOf(span.expression);
        nm = base;
        for (let i = 2; used.has(nm); i++) nm = `${base}${i}`;
        used.add(nm);
        names.set(src, nm);
        const v = valueText(span.expression, ctx);
        props.push(v === nm ? nm : `${nm}: ${v}`);
      }
      text += `{${nm}}` + span.literal.text;
    }
    const plain = text.replace(/\{\w+\}/g, '');
    if (!hasWord(plain)) {
      // no words of its own (`${a}: ${b}`): keep the template, but convert English inside its values
      const edits = [];
      for (const span of e.templateSpans) {
        const v = valueText(span.expression, ctx);
        if (v !== span.expression.getText()) edits.push([span.expression.getStart(), span.expression.getEnd(), v]);
      }
      return edits.length ? applyEdits(e.getText(), e.getStart(), edits) : null;
    }
    if (/[{}]/.test(plain)) { leftovers.push(`${ctx.rel}:${line(ctx, e)} braces in text: ${e.getText().slice(0, 80)}`); return null; }
    ctx.count++;
    return `${ALIAS}('${keyFor(ctx.group, text)}', { ${props.join(', ')} })`;
  }
  return null;
}

/** Plural suffixes chosen in code (`n === 1 ? '' : 's'`) inside a call's values: tCount's job, so --check fails on them. */
function suffixTernaries(node, ctx) {
  const v = (n) => {
    if (ts.isConditionalExpression(n) && [n.whenTrue, n.whenFalse].map(strip).every((b) => isLit(b) && isSuffix(b.text)) && [n.whenTrue, n.whenFalse].map(strip).some((b) => b.text)) {
      leftovers.push(`${ctx.rel}:${line(ctx, n)} plural suffix in code (use tCount): ${n.getText().slice(0, 80)}`);
      suffixes++;
    }
    ts.forEachChild(n, v);
  };
  v(node);
}

function convertArg(arg, ctx) {
  suffixTernaries(arg, ctx);
  const e = strip(arg);
  const c = convertNode(e, ctx, false);
  if (c !== null) return [[e.getStart(), e.getEnd(), c]];
  if (ts.isConditionalExpression(e) || ts.isBinaryExpression(e) || ts.isCallExpression(e)) {
    const v = valueText(arg, ctx);
    return v !== arg.getText() ? [[arg.getStart(), arg.getEnd(), v]] : [];
  }
  if (!ts.isIdentifier(e) && !ts.isPropertyAccessExpression(e)) leftovers.push(`${ctx.rel}:${line(ctx, e)} not converted: ${e.getText().slice(0, 80)}`);
  return [];
}

function walk(dir, out = []) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) { if (f !== '__tests__') walk(p, out); }
    else if (f.endsWith('.ts')) out.push(p);
  }
  return out;
}

let total = 0;
let suffixes = 0;
let changedFiles = 0;
for (const file of walk(SRC)) {
  const src = fs.readFileSync(file, 'utf8');
  if (!/notifications/.test(src)) continue;
  const rel = path.relative(SRC, file).split(path.sep).join('/');
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const ctx = { rel, sf, group: groupOf(rel), count: 0 };
  const edits = [];
  const visit = (n) => {
    if (ts.isCallExpression(n) && n.arguments[0]) {
      const callee = n.expression.getText().replace(/\?\./g, '.');
      if (/\bnotifications\.(info|warn|error|notify|success)$/.test(callee)) {
        edits.push(...convertArg(n.arguments[0], ctx));
        return; // nested notifications inside an argument don't happen
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  if (!edits.length) continue;
  // the alias must not clash with a name the file already uses
  let clash = false;
  const idv = (n) => {
    if (ts.isIdentifier(n) && n.text === ALIAS && !(ts.isImportSpecifier(n.parent) && n.parent.propertyName?.text === 't')) clash = true;
    ts.forEachChild(n, idv);
  };
  idv(sf);
  if (clash) {
    leftovers.push(`${rel}: '${ALIAS}' is already used in this file: skipped`);
    continue;
  }
  let out = applyEdits(src, 0, edits);
  if (!/\bt as tx\b/.test(out)) {
    let imp = path.relative(path.dirname(file), I18N).split(path.sep).join('/');
    if (!imp.startsWith('.')) imp = `./${imp}`;
    const existing = new RegExp(`import \\{([^}]*)\\} from ["']${imp.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}["'];`);
    if (existing.test(out)) out = out.replace(existing, (_m, names) => `import {${names.trimEnd()}, t as tx } from '${imp}';`);
    else {
      const imports = [...out.matchAll(/^import [^;]*;[^\n]*\n/gm)];
      // after the last top-level import, else after the file's leading doc comment
      const doc = /^\s*\/\*[\s\S]*?\*\/\n/.exec(out);
      const at = imports.length ? imports[imports.length - 1].index + imports[imports.length - 1][0].length : doc ? doc[0].length : 0;
      out = out.slice(0, at) + `import { t as tx } from '${imp}';\n` + out.slice(at);
    }
  }
  total += ctx.count;
  changedFiles++;
  if (!CHECK) fs.writeFileSync(file, out);
}
if (!CHECK) fs.writeFileSync(LANG, JSON.stringify(lang, null, 2) + '\n');
for (const l of leftovers) console.log(l);
console.log(`${CHECK ? 'would convert' : 'converted'} ${total} strings in ${changedFiles} files; ${suffixes} plural suffixes; ${leftovers.length} notes`);
// --check fails only when text could still be converted; the notes (`{name}: {reason}` frames whose reason comes
// from rules/, tables like REPLACED_TEXT, list joins) are for the slices that own that text.
if (CHECK && (total || suffixes)) process.exit(1);
