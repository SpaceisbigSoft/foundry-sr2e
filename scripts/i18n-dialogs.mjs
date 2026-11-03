#!/usr/bin/env node
/**
 * v0.89.2: move the dialogs' text into lang/en.json.
 *
 * What it converts:
 * - every `DialogV2.prompt / confirm / wait / input / query (…)` and `new …DialogV2(…)` config: `window.title`,
 *   `content`, and the button labels (`ok`, `yes`, `no`, `buttons[]`) → `SR2E.Dialog.<File>.<key>`;
 * - `window: { title: … }` anywhere else (render options); in a `static DEFAULT_OPTIONS` a literal title becomes the
 *   key itself (`'SR2E.Window.<File>.<key>'`: Foundry localizes `window.title`);
 * - content built elsewhere is followed: a local `const`/`let` (its initializer, `=` and `+=`), and a function or
 *   method of the same file that returns it (by name).
 *
 * Content is HTML. Tags stay as they are; each run of text between tags (with the `${…}` values inside it) becomes
 * one string, and so does each `title` / `placeholder` / `aria-label` / `data-tooltip` / `alt` value:
 *   `<p>Costs ${escHtml(cost)}.</p>`  →  `<p>${tx('SR2E.Dialog.Ui.costs', { cost: escHtml(cost) })}</p>`
 * The text is kept as HTML source (an entity stays an entity), values keep their escHtml, so the output is the same.
 * Whitespace inside a run that holds a line break becomes one space (as the template slice did; not in <textarea>
 * or <pre>). Titles and labels are plain text and convert like the notifications.
 *
 *   node scripts/i18n-dialogs.mjs           convert, add the keys
 *   node scripts/i18n-dialogs.mjs --check   report what is left (exit 1 when something could still be converted)
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
const ATTRS = new Set(['title', 'placeholder', 'aria-label', 'data-tooltip', 'alt']);

const GROUP_OF = { 'documents/index.ts': 'Actor', 'applications/chat.ts': 'Chat', 'applications/sheets.ts': 'Sheet' };
const groupOf = (rel) => GROUP_OF[rel] ?? path.basename(rel, '.ts').replace(/(^|[-_])(\w)/g, (_m, _a, c) => c.toUpperCase());

const lang = JSON.parse(fs.readFileSync(LANG, 'utf8'));
lang.SR2E ??= {};
const STORES = { Dialog: (lang.SR2E.Dialog ??= {}), Window: (lang.SR2E.Window ??= {}) };

function slug(text) {
  const words = text.replace(/\{[^}]*\}/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/[^A-Za-z0-9 ]+/g, ' ').trim().split(/\s+/).filter(Boolean).slice(0, 6);
  const s = words.map((w, i) => (i ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w.toLowerCase())).join('').slice(0, 40);
  return /^[0-9]/.test(s) ? `n${s}` : s || 'text';
}
let added = 0;
function keyFor(store, group, english) {
  const g = (STORES[store][group] ??= {});
  for (const [k, v] of Object.entries(g)) if (v === english) return `SR2E.${store}.${group}.${k}`;
  const base = slug(english);
  let k = base;
  for (let n = 2; Object.hasOwn(g, k); n++) k = `${base}${n}`;
  g[k] = english;
  added++;
  return `SR2E.${store}.${group}.${k}`;
}

// ---------------------------------------------------------------- shared with i18n-notify.mjs (copied)
const RESERVED = new Set('break case catch class const continue debugger default delete do else enum export extends false finally for function if import in instanceof new null return super switch this throw true try typeof var void while with yield let static implements interface package private protected public await'.split(' '));
const WRAPPERS = /^(escHtml|escText|esc|escContent|String|Number|cap|Math\.\w+|safeInt|signed|fmt\w*)$/;
const DROP = new Set(['this', 'sys', 'system', 'flags', 'data', 'game', 'ctx', 'snap', 'opts', 'o', 'r', 'a', 'b', 'c', 'x', 'f', 's', 'e', 'i', 'n', 'p', 'v', 'g', 'm', 'd', 'k', 't', 'l', 'w', 'q', 'h', 'u', 'y', 'z', 'it', 'parent', 'RULES', 'CONFIG', 'SR2E', 'B', 'L', 'R']);
/** CONSTANT_CASE → constantCase; anything else unchanged. */
const camel = (w) => (/^[A-Z0-9_]+$/.test(w) && /[A-Z]/.test(w) ? w.toLowerCase().replace(/_([a-z0-9])/g, (_m, c) => c.toUpperCase()) : w);
function strip(e) {
  while (ts.isParenthesizedExpression(e) || ts.isAsExpression(e) || ts.isNonNullExpression(e) || (ts.isSatisfiesExpression?.(e))) e = e.expression;
  return e;
}
const isLit = (e) => ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e);
const hasWord = (s) => /[A-Za-z]{2,}/.test(s.replace(/&[a-z#0-9]+;/gi, ' '));
const isSuffix = (s) => /^(s|es|ies|y|en|ren|)$/.test(s);
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
      if (!ts.isIdentifier(e.expression) && !ts.isPropertyAccessExpression(e.expression)) return 'part'; // an IIFE
      const last = callee.split('.').pop() ?? 'value';
      return clean(last.replace(/^#/, '').replace(/^(get|describe|format|label|fmt)(?=[A-Z])/, '').replace(/^./, (c) => c.toLowerCase()));
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
const line = (ctx, n) => ctx.sf.getLineAndCharacterOfPosition(n.getStart()).line + 1;
const leftovers = [];

// ---------------------------------------------------------------- plain text (titles, labels, value literals)
/** Text used to search other text (`s.replace(pattern, …)`, `includes`, `indexOf`…) is code: translating it breaks the match. */
function isPattern(e) {
  let n = e;
  while (n.parent && (ts.isParenthesizedExpression(n.parent) || ts.isTemplateSpan(n.parent) || ts.isTemplateExpression(n.parent) || ts.isConditionalExpression(n.parent) || ts.isBinaryExpression(n.parent))) n = n.parent;
  const c = n.parent;
  return !!c && ts.isCallExpression(c) && c.arguments.includes(n) && ts.isPropertyAccessExpression(c.expression) && /^(replace|replaceAll|includes|indexOf|lastIndexOf|split|startsWith|endsWith|match|matchAll|search)$/.test(c.expression.name.text);
}
/** A modifier row (`{ label, value }`): its label is an identity the roll code compares, so it stays as it is for now. */
const isModifierRow = (o) => ts.isObjectLiteralExpression(o) && o.properties.some((p) => p.name?.getText() === 'value') && o.properties.some((p) => p.name?.getText() === 'label') && !o.properties.some((p) => p.name?.getText() === 'action');

/** A tx() call for a plain literal or template (null when it holds no English). */
function plainNode(e, ctx, nested) {
  if (isPattern(e)) return null;
  if (isLit(e)) {
    if (!hasWord(e.text) || (nested && isSuffix(e.text))) return null;
    if (/^SR2E\./.test(e.text)) return null;
    if (/<[A-Za-z!/]/.test(e.text)) return null; // HTML: htmlNode's job
    if (/[{}]/.test(e.text)) { leftovers.push(`${ctx.rel}:${line(ctx, e)} braces in text: ${e.getText().slice(0, 80)}`); return null; }
    ctx.count++;
    return `${ALIAS}('${keyFor('Dialog', ctx.group, e.text)}')`;
  }
  if (ts.isTemplateExpression(e)) {
    if (/</.test(e.head.text + e.templateSpans.map((s) => s.literal.text).join(''))) return null; // HTML: not plain
    let text = e.head.text;
    const names = new Map();
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
      const edits = [];
      for (const span of e.templateSpans) {
        const v = valueText(span.expression, ctx);
        if (v !== span.expression.getText()) edits.push([span.expression.getStart(), span.expression.getEnd(), v]);
      }
      return edits.length ? applyEdits(e.getText(), e.getStart(), edits) : null;
    }
    if (/[{}]/.test(plain)) { leftovers.push(`${ctx.rel}:${line(ctx, e)} braces in text: ${e.getText().slice(0, 80)}`); return null; }
    ctx.count++;
    return `${ALIAS}('${keyFor('Dialog', ctx.group, text)}', { ${props.join(', ')} })`;
  }
  return null;
}
/** Plain text at a title or label: the literal itself, a conditional of literals, or a value with English inside. */
function plainArg(arg, ctx) {
  const e = strip(arg);
  const c = plainNode(e, ctx, false);
  if (c !== null) return [[e.getStart(), e.getEnd(), c]];
  if (ts.isConditionalExpression(e) || ts.isBinaryExpression(e) || ts.isCallExpression(e)) {
    const v = valueText(arg, ctx);
    return v !== arg.getText() ? [[arg.getStart(), arg.getEnd(), v]] : [];
  }
  return [];
}

/**
 * The source of a value, with English in its value positions turned into tx() calls, and any HTML template inside
 * it converted as content.
 */
function valueText(node, ctx) {
  const e = strip(node);
  const conv = plainNode(e, ctx, true) ?? htmlNode(e, ctx);
  if (conv !== null) return applyEdits(node.getText(), node.getStart(), [[e.getStart(), e.getEnd(), conv]]);
  const edits = [];
  const sub = (n) => {
    const s = strip(n);
    const c = plainNode(s, ctx, true) ?? htmlNode(s, ctx);
    if (c !== null) edits.push([s.getStart(), s.getEnd(), c]);
    else visit(n);
  };
  const visit = (n) => {
    const s = strip(n);
    if (ts.isConditionalExpression(s)) { sub(s.whenTrue); sub(s.whenFalse); return; }
    if (ts.isBinaryExpression(s) && [ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.PlusToken].includes(s.operatorToken.kind)) { sub(s.left); sub(s.right); return; }
    if (ts.isCallExpression(s) && WRAPPERS.test(s.expression.getText().replace(/\?\./g, '.')) && s.arguments[0]) { sub(s.arguments[0]); return; }
    // anything else: HTML templates inside it (a .map callback, an IIFE) are content too
    const deep = (m) => {
      if (m !== s && (ts.isTemplateExpression(m) || ts.isNoSubstitutionTemplateLiteral(m) || ts.isStringLiteral(m)) && /<[A-Za-z!/]/.test(m.getText())) {
        const c = htmlNode(m, ctx);
        if (c !== null) { edits.push([m.getStart(), m.getEnd(), c]); return; }
      }
      if (ts.isIdentifier(m)) follow(m, ctx);
      if (ts.isCallExpression(m)) followCall(m, ctx);
      ts.forEachChild(m, deep);
    };
    deep(s);
  };
  visit(node);
  return applyEdits(node.getText(), node.getStart(), edits);
}

// ---------------------------------------------------------------- HTML content
/** Cook the raw text of a template piece (no `${` in it) into the string it stands for. */
const cook = (raw) => new Function(`return \`${raw}\`;`)();
/** Raw template-literal text for a cooked string. */
const toRaw = (s) => s.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');

/**
 * Convert an HTML-building literal or template. Returns the new source text, or null when nothing changes.
 * Pieces: { raw } static text (template-raw) and { expr } values.
 */
function htmlNode(e, ctx) {
  if (isPattern(e)) return null;
  let pieces;
  if (ts.isStringLiteral(e)) { if (!/<[A-Za-z!/]/.test(e.text)) return null; pieces = [{ raw: toRaw(e.text) }]; }
  else if (ts.isNoSubstitutionTemplateLiteral(e)) { if (!/<[A-Za-z!/]/.test(e.text)) return null; pieces = [{ raw: e.rawText ?? toRaw(e.text) }]; }
  else if (ts.isTemplateExpression(e)) {
    const stat = e.head.text + e.templateSpans.map((s) => s.literal.text).join('');
    if (!/<[A-Za-z!/]/.test(stat)) return null;
    pieces = [{ raw: e.head.rawText ?? toRaw(e.head.text) }];
    for (const s of e.templateSpans) pieces.push({ expr: s.expression }, { raw: s.literal.rawText ?? toRaw(s.literal.text) });
  } else return null;
  if (ctx.done.has(e.getStart())) return null;
  ctx.done.add(e.getStart());
  const out = convertPieces(pieces, ctx);
  if (out === null) return null;
  return '`' + out + '`';
}

/** One item of the stream: a character of static text, or a value. */
function* stream(pieces) {
  for (const p of pieces) {
    if (p.expr) { yield { expr: p.expr }; continue; }
    // walk raw text keeping escape sequences whole
    const r = p.raw;
    for (let i = 0; i < r.length; i++) {
      if (r[i] === '\\' && i + 1 < r.length) {
        let j = i + 2;
        if (r[i + 1] === 'u' && r[i + 2] === '{') j = r.indexOf('}', i) + 1;
        else if (r[i + 1] === 'u') j = i + 6;
        else if (r[i + 1] === 'x') j = i + 4;
        yield { ch: r.slice(i, j), cooked: cook(r.slice(i, j)) };
        i = j - 1;
      } else yield { ch: r[i], cooked: r[i] };
    }
  }
}

function convertPieces(pieces, ctx) {
  const items = [...stream(pieces)];
  let out = '';
  let changed = false;
  let i = 0;
  let rawTag = null; // inside <textarea>/<pre>: no whitespace collapse
  // A value in text is shown: English in its value positions converts too.
  const textValueOut = (expr) => {
    const v = valueText(expr, ctx);
    if (v !== expr.getText()) changed = true;
    return '${' + v + '}';
  };
  // A value inside a tag (an attribute's value, `${sel ? 'selected' : ''}`) is code: only HTML inside it converts.
  const valueOut = (expr) => {
    const es = htmlEdits(expr, ctx);
    const v = es.length ? applyEdits(expr.getText(), expr.getStart(), es) : expr.getText();
    if (v !== expr.getText()) changed = true;
    return '${' + v + '}';
  };
  /** Convert a run of items (text and values); returns the source to put in the template. */
  const run = (list, attr) => {
    const textOnly = list.filter((x) => x.ch !== undefined).map((x) => x.cooked).join('');
    if (!hasWord(textOnly) || /[{}]/.test(textOnly) || /^\s*SR2E\./.test(textOnly)) {
      if (/[{}]/.test(textOnly) && hasWord(textOnly)) leftovers.push(`${ctx.rel}: braces in text: ${textOnly.slice(0, 60)}`);
      return list.map((x) => (x.ch !== undefined ? x.ch : textValueOut(x.expr))).join('');
    }
    // keep leading/trailing whitespace outside the string
    let a = 0;
    let b = list.length;
    while (a < b && list[a].ch !== undefined && /^\s$/.test(list[a].cooked)) a++;
    while (b > a && list[b - 1].ch !== undefined && /^\s$/.test(list[b - 1].cooked)) b--;
    const lead = list.slice(0, a).map((x) => x.ch).join('');
    const trail = list.slice(b).map((x) => x.ch).join('');
    const names = new Map();
    const used = new Set();
    const props = [];
    let text = '';
    for (const x of list.slice(a, b)) {
      if (x.ch !== undefined) { text += x.cooked; continue; }
      const src = x.expr.getText();
      let nm = names.get(src);
      if (!nm) {
        const base = nameOf(x.expr);
        nm = base;
        for (let k = 2; used.has(nm); k++) nm = `${base}${k}`;
        used.add(nm);
        names.set(src, nm);
        const v = valueText(x.expr, ctx);
        props.push(v === nm ? nm : `${nm}: ${v}`);
      }
      text += `{${nm}}`;
    }
    if (!rawTag && !attr) text = text.replace(/[ \t\r\f]*\n[ \t\r\n\f]*/g, ' ');
    changed = true;
    ctx.count++;
    const key = keyFor('Dialog', ctx.group, text);
    return `${lead}\${${ALIAS}('${key}'${props.length ? `, { ${props.join(', ')} }` : ''})}${trail}`;
  };
  while (i < items.length) {
    const it = items[i];
    // a tag: '<' followed by a letter, '/' or '!'
    if (it.ch === '<' && items[i + 1]?.ch !== undefined && /[A-Za-z/!]/.test(items[i + 1].cooked)) {
      let j = i + 1;
      let tagName = '';
      while (j < items.length && items[j].ch !== undefined && /[A-Za-z0-9/!-]/.test(items[j].cooked)) { tagName += items[j].cooked; j++; }
      out += items.slice(i, j).map((x) => x.ch).join('');
      const tn = tagName.toLowerCase();
      if (tn === '!--') {
        // comment: copy to -->
        while (j < items.length && !(items[j].cooked === '>' && items[j - 1]?.cooked === '-' && items[j - 2]?.cooked === '-')) { out += items[j].ch ?? valueOut(items[j].expr); j++; }
        if (j < items.length) { out += items[j].ch; j++; }
        i = j;
        continue;
      }
      // attributes up to '>'
      let quote = null;
      let attrName = '';
      let pendingName = '';
      while (j < items.length) {
        const x = items[j];
        if (x.expr) { out += valueOut(x.expr); j++; continue; }
        if (!quote && x.cooked === '>') { out += x.ch; j++; break; }
        if (!quote && (x.cooked === '"' || x.cooked === "'")) {
          quote = x.cooked;
          attrName = pendingName.replace(/=\s*$/, '').trim().toLowerCase();
          out += x.ch;
          j++;
          // the quoted value
          const val = [];
          while (j < items.length && !(items[j].ch !== undefined && items[j].cooked === quote)) { val.push(items[j]); j++; }
          out += ATTRS.has(attrName) ? run(val, true) : val.map((y) => (y.ch !== undefined ? y.ch : valueOut(y.expr))).join('');
          if (j < items.length) { out += items[j].ch; j++; }
          quote = null;
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
      i = j;
      continue;
    }
    // a run of text and values up to the next tag
    const list = [];
    while (i < items.length) {
      const x = items[i];
      if (x.ch === '<' && items[i + 1]?.ch !== undefined && /[A-Za-z/!]/.test(items[i + 1].cooked)) break;
      list.push(x);
      i++;
    }
    out += run(list, false);
  }
  return changed ? out : null;
}

/**
 * Followed code (a local's values, a helper's returns) may also be used as data, so only its HTML templates are
 * converted, never a bare literal: `return v === 'stun' ? 'stun' : 'physical'` is code, not text.
 */
function htmlEdits(expr, ctx) {
  const e = strip(expr);
  const c = htmlNode(e, ctx);
  if (c !== null) return [[e.getStart(), e.getEnd(), c]];
  if (ts.isConditionalExpression(e)) return [...htmlEdits(e.whenTrue, ctx), ...htmlEdits(e.whenFalse, ctx)];
  if (ts.isBinaryExpression(e) && [ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.PlusToken].includes(e.operatorToken.kind)) return [...htmlEdits(e.left, ctx), ...htmlEdits(e.right, ctx)];
  if (ts.isIdentifier(e)) { follow(e, ctx); return []; }
  const out = [];
  const deep = (m) => {
    if (m !== e && (ts.isTemplateExpression(m) || ts.isNoSubstitutionTemplateLiteral(m) || ts.isStringLiteral(m)) && /<[A-Za-z!/]/.test(m.getText())) {
      const c2 = htmlNode(m, ctx);
      if (c2 !== null) { out.push([m.getStart(), m.getEnd(), c2]); return; }
    }
    if (ts.isIdentifier(m)) follow(m, ctx);
    if (ts.isCallExpression(m)) followCall(m, ctx);
    ts.forEachChild(m, deep);
  };
  deep(e);
  return out;
}

/** Content may be a local variable: convert what it is given (initializer, `=`, `+=`) in the same function. */
function follow(id, ctx) {
  const name = id.text;
  // the nearest enclosing function-like body that declares it
  let scope = id.parent;
  while (scope && !(ts.isFunctionLike(scope) || ts.isSourceFile(scope))) scope = scope.parent;
  if (!scope) return;
  const key = `${scope.pos}:${name}`;
  if (ctx.followed.has(key)) return;
  ctx.followed.add(key);
  // A parameter: the HTML its callers in this file pass (only HTML templates convert, as for any followed code).
  if (ts.isFunctionLike(scope)) {
    const idx = scope.parameters.findIndex((p) => ts.isIdentifier(p.name) && p.name.text === name);
    if (idx >= 0) {
      const fname = (ts.isFunctionDeclaration(scope) || ts.isMethodDeclaration(scope)) && scope.name ? scope.name.getText() : ts.isVariableDeclaration(scope.parent) ? scope.parent.name.getText() : null;
      if (fname) {
        const calls = (c) => {
          if (ts.isCallExpression(c)) {
            const ce = strip(c.expression);
            const nm = ts.isIdentifier(ce) ? ce.text : ts.isPropertyAccessExpression(ce) ? ce.name.getText() : '';
            if (nm === fname && c.arguments[idx]) ctx.edits.push(...htmlEdits(c.arguments[idx], ctx));
          }
          ts.forEachChild(c, calls);
        };
        calls(ctx.sf);
      }
      return;
    }
  }
  // A list of display sentences (`const hints = [ … ]`, shown in the content): its literal elements are text.
  const DISPLAY_LIST = /^(hints|notes|tips|warnings)$/;
  const v = (n) => {
    const listOf = (init) => { let b = strip(init); while (ts.isCallExpression(b) && ts.isPropertyAccessExpression(b.expression) && /^(filter|map|join|flat)$/.test(b.expression.name.text)) b = strip(b.expression.expression); return ts.isArrayLiteralExpression(b) ? b : null; };
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === name && n.initializer && DISPLAY_LIST.test(name) && listOf(n.initializer)) {
      for (const el of listOf(n.initializer).elements) ctx.edits.push(...plainArg(el, ctx), ...htmlEdits(el, ctx));
      ctx.edits.push(...htmlEdits(n.initializer, ctx));
    } else if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === name && n.initializer) ctx.edits.push(...htmlEdits(n.initializer, ctx));
    if (ts.isBinaryExpression(n) && ts.isIdentifier(n.left) && n.left.text === name && [ts.SyntaxKind.EqualsToken, ts.SyntaxKind.PlusEqualsToken].includes(n.operatorToken.kind)) ctx.edits.push(...htmlEdits(n.right, ctx));
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && ts.isIdentifier(n.expression.expression) && n.expression.expression.text === name && /^(push|unshift)$/.test(n.expression.name.text)) for (const a of n.arguments) ctx.edits.push(...htmlEdits(a, ctx));
    if (n !== scope && ts.isFunctionLike(n) && !ts.isArrowFunction(n)) return;
    ts.forEachChild(n, v);
  };
  v(scope);
}
/** Content may come from a function or method of the same file: convert what it returns. */
function followCall(call, ctx) {
  const callee = strip(call.expression);
  const name = ts.isIdentifier(callee) ? callee.text : ts.isPropertyAccessExpression(callee) ? callee.name.getText() : null;
  if (!name || /^(map|join|filter|concat|replace|slice|push|find|some|every|reduce|flatMap|sort|from|keys|values|entries|toLowerCase|toUpperCase|trim|escHtml|escText|esc|cap|String|Number|localize|format|t|tx|tHtml|tCount|get|has|includes|getFlag|querySelector|querySelectorAll)$/.test(name)) return;
  if (ctx.followedFns.has(name)) return;
  ctx.followedFns.add(name);
  const v = (n) => {
    const fnName = (ts.isFunctionDeclaration(n) || ts.isMethodDeclaration(n)) && n.name ? n.name.getText() : ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer && (ts.isArrowFunction(n.initializer) || ts.isFunctionExpression(n.initializer)) ? n.name.text : null;
    if (fnName === name) {
      const fn = ts.isVariableDeclaration(n) ? n.initializer : n;
      const body = fn.body;
      if (body && !ts.isBlock(body)) ctx.edits.push(...htmlEdits(body, ctx));
      else if (body) {
        const r = (m) => { if (ts.isReturnStatement(m) && m.expression) ctx.edits.push(...htmlEdits(m.expression, ctx)); if (!ts.isFunctionLike(m)) ts.forEachChild(m, r); };
        ts.forEachChild(body, r);
        // locals the returns use are followed through the identifiers inside them
      }
      return;
    }
    ts.forEachChild(n, v);
  };
  v(ctx.sf);
}

/** Edits for an expression that is (or builds) dialog content. */
function exprEdits(expr, ctx) {
  const e = strip(expr);
  const c = htmlNode(e, ctx);
  if (c !== null) return [[e.getStart(), e.getEnd(), c]];
  if (isLit(e) || ts.isTemplateExpression(e)) {
    // plain text as content (no tags): convert it as a run
    if (ctx.done.has(e.getStart())) return [];
    const p = plainNode(e, ctx, false);
    if (p !== null) { ctx.done.add(e.getStart()); return [[e.getStart(), e.getEnd(), p]]; }
    return [];
  }
  if (ts.isIdentifier(e)) { follow(e, ctx); return []; }
  const v = valueText(expr, ctx);
  return v !== expr.getText() ? [[expr.getStart(), expr.getEnd(), v]] : [];
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
const prop = (o, name) => o.properties.find((p) => ts.isPropertyAssignment(p) && p.name && p.name.getText().replace(/['"]/g, '') === name);
const inStaticDefaults = (n) => { for (let p = n.parent; p; p = p.parent) if (ts.isPropertyDeclaration(p)) return p.name.getText() === 'DEFAULT_OPTIONS' && !!p.modifiers?.some((m) => m.kind === ts.SyntaxKind.StaticKeyword); return false; };

let total = 0;
let changedFiles = 0;
/** One pass over a file's source: the converted source, or null when nothing changes. */
function convertSource(file, src) {
  const rel = path.relative(SRC, file).split(path.sep).join('/');
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const ctx = { rel, sf, group: groupOf(rel), count: 0, edits: [], done: new Set(), followed: new Set(), followedFns: new Set() };
  const buttonLabels = (o) => {
    for (const b of ['ok', 'yes', 'no']) {
      const p = prop(o, b);
      if (p && ts.isObjectLiteralExpression(p.initializer)) { const l = prop(p.initializer, 'label'); if (l) { ctx.edits.push(...plainArg(l.initializer, ctx)); if (ts.isIdentifier(strip(l.initializer))) paramArgs(l, strip(l.initializer).text, false); } }
    }
    const bs = prop(o, 'buttons');
    if (bs && ts.isArrayLiteralExpression(bs.initializer)) for (const el of bs.initializer.elements) if (ts.isObjectLiteralExpression(el)) { const l = prop(el, 'label'); if (l) ctx.edits.push(...plainArg(l.initializer, ctx)); }
  };
  /** `dlg.confirm(…)` where `const dlg = …DialogV2` in this file. */
  const aliases = new Set();
  const al = (m) => { if (ts.isVariableDeclaration(m) && ts.isIdentifier(m.name) && m.initializer && /DialogV2\s*$/.test(m.initializer.getText())) aliases.add(m.name.text); ts.forEachChild(m, al); };
  al(sf);
  const dialogAlias = (e) => ts.isPropertyAccessExpression(e) && ts.isIdentifier(e.expression) && aliases.has(e.expression.text) && /^(prompt|confirm|wait|input|query)$/.test(e.name.text);
  /** The arguments callers in this file pass for a parameter (text, or HTML). */
  const paramArgs = (m, pname, html) => {
    let fn = m.parent;
    while (fn && !ts.isFunctionLike(fn)) fn = fn.parent;
    const idx = fn ? fn.parameters.findIndex((p) => ts.isIdentifier(p.name) && p.name.text === pname) : -1;
    if (idx < 0) return false;
    const fname = (ts.isFunctionDeclaration(fn) || ts.isMethodDeclaration(fn)) && fn.name ? fn.name.getText() : ts.isVariableDeclaration(fn.parent) ? fn.parent.name.getText() : null;
    if (!fname) return false;
    const calls = (c) => {
      if (ts.isCallExpression(c)) {
        const ce = strip(c.expression);
        const nm = ts.isIdentifier(ce) ? ce.text : ts.isPropertyAccessExpression(ce) ? ce.name.getText() : '';
        if (nm === fname && c.arguments[idx]) ctx.edits.push(...(html ? exprEdits(c.arguments[idx], ctx) : plainArg(c.arguments[idx], ctx)));
      }
      ts.forEachChild(c, calls);
    };
    calls(sf);
    return true;
  };
  const visit = (n) => {
    // gmMay(message, { title, lines }): the GM's confirmation of a card's change
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'gmMay' && n.arguments[1] && ts.isObjectLiteralExpression(n.arguments[1])) {
      const o = n.arguments[1];
      const t = prop(o, 'title');
      if (t) ctx.edits.push(...plainArg(t.initializer, ctx));
      const l = prop(o, 'lines');
      if (l && ts.isArrayLiteralExpression(strip(l.initializer))) for (const el of strip(l.initializer).elements) ctx.edits.push(...plainArg(el, ctx));
      const ls = o.properties.find((p) => ts.isShorthandPropertyAssignment(p) && p.name.text === 'lines');
      const li = ls ? ls.name : l && ts.isIdentifier(strip(l.initializer)) ? strip(l.initializer) : null;
      if (li) displayList(li);
    }
    // window: { title }
    if (ts.isPropertyAssignment(n) && n.name.getText() === 'window' && ts.isObjectLiteralExpression(n.initializer)) {
      const t = prop(n.initializer, 'title');
      if (t) {
        const e = strip(t.initializer);
        if (inStaticDefaults(n) && isLit(e)) {
          if (hasWord(e.text) && !/^SR2E\./.test(e.text)) { ctx.count++; ctx.edits.push([e.getStart(), e.getEnd(), `'${keyFor('Window', ctx.group, e.text)}'`]); }
        } else ctx.edits.push(...plainArg(t.initializer, ctx));
      }
    }
    if ((ts.isCallExpression(n) || ts.isNewExpression(n)) && (/DialogV2(\.(prompt|confirm|wait|input|query))?$/.test(n.expression.getText().replace(/\s/g, '').replace(/\)$/, '')) || dialogAlias(n.expression))) {
      const o = n.arguments?.[0] && strip(n.arguments[0]);
      if (o && ts.isObjectLiteralExpression(o)) {
        const c = prop(o, 'content');
        if (c) ctx.edits.push(...exprEdits(c.initializer, ctx));
        const sc = o.properties.find((p) => ts.isShorthandPropertyAssignment(p) && p.name.text === 'content');
        if (sc) follow(sc.name, ctx);
        buttonLabels(o);
        inConfig(o);
      }
    }
    ts.forEachChild(n, visit);
  };
  /**
   * The rest of a dialog config (its render previews, spread button lists): button objects, HTML templates, text
   * written into the DOM and the preview helpers' text properties. Callback return values that are data (a default
   * name) are left alone: only display positions convert.
   */
  const TEXT_PROPS = new Set(['baseLabel', 'note', 'warn', 'label', 'hint']);
  const inConfig = (o) => {
    const v = (m) => {
      if (ts.isObjectLiteralExpression(m) && prop(m, 'action') && prop(m, 'label')) ctx.edits.push(...plainArg(prop(m, 'label').initializer, ctx));
      else if (ts.isPropertyAssignment(m) && TEXT_PROPS.has(m.name.getText()) && ts.isObjectLiteralExpression(m.parent) && !isModifierRow(m.parent) && (isLit(strip(m.initializer)) || ts.isTemplateExpression(strip(m.initializer)) || ts.isConditionalExpression(strip(m.initializer)))) {
        if (!(m.parent.parent && ts.isCallExpression(m.parent.parent) && /DialogV2/.test(m.parent.parent.expression.getText()))) ctx.edits.push(...plainArg(m.initializer, ctx));
      }
      if (ts.isBinaryExpression(m) && m.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isPropertyAccessExpression(m.left)) {
        const pn = m.left.name.text;
        if (pn === 'innerHTML') ctx.edits.push(...exprEdits(m.right, ctx));
        else if (pn === 'textContent' || pn === 'title' || pn === 'placeholder') { ctx.edits.push(...plainArg(m.right, ctx)); displayLocals(m.right); }
      }
      if ((ts.isTemplateExpression(m) || ts.isNoSubstitutionTemplateLiteral(m) || ts.isStringLiteral(m)) && /<[A-Za-z!/]/.test(m.text ?? m.getText())) {
        const c = htmlNode(m, ctx);
        if (c !== null) { ctx.edits.push([m.getStart(), m.getEnd(), c]); return; }
      }
      ts.forEachChild(m, v);
    };
    ts.forEachChild(o, v);
  };
  /** A local list of display lines given to gmMay: its literal elements and pushes are text. */
  const displayList = (id) => {
    let scope = id.parent;
    while (scope && !(ts.isFunctionLike(scope) || ts.isSourceFile(scope))) scope = scope.parent;
    const f = (m) => {
      if (ts.isVariableDeclaration(m) && ts.isIdentifier(m.name) && m.name.text === id.text && m.initializer && ts.isArrayLiteralExpression(strip(m.initializer))) for (const el of strip(m.initializer).elements) ctx.edits.push(...plainArg(el, ctx));
      if (ts.isCallExpression(m) && ts.isPropertyAccessExpression(m.expression) && ts.isIdentifier(m.expression.expression) && m.expression.expression.text === id.text && m.expression.name.text === 'push') for (const a of m.arguments) ctx.edits.push(...plainArg(a, ctx));
      ts.forEachChild(m, f);
    };
    if (scope) f(scope);
  };
  /** Locals used only once, in text written into the DOM: their literal values are display text. */
  const displayLocals = (expr) => {
    const ids = [];
    const g = (m) => { if (ts.isIdentifier(m) && !(ts.isPropertyAccessExpression(m.parent) && m.parent.name === m)) ids.push(m); ts.forEachChild(m, g); };
    g(expr);
    for (const id of ids) {
      let scope = id.parent;
      while (scope && !(ts.isFunctionLike(scope) || ts.isSourceFile(scope))) scope = scope.parent;
      let decl = null;
      let uses = 0;
      const f = (m) => {
        if (ts.isIdentifier(m) && m.text === id.text) { if (ts.isVariableDeclaration(m.parent) && m.parent.name === m) decl = m.parent; else if (!(ts.isPropertyAccessExpression(m.parent) && m.parent.name === m) && !(ts.isPropertyAssignment(m.parent) && m.parent.name === m)) uses++; }
        ts.forEachChild(m, f);
      };
      if (scope) f(scope);
      if (decl && decl.initializer && uses === 1) { ctx.edits.push(...plainArg(decl.initializer, ctx)); displayLocals(decl.initializer); }
    }
  };
  /**
   * `window: { title }` or `content` (shorthand, or `content: name`) from a parameter: the arguments at the calls of
   * that function in this file (a title as text, content as HTML).
   */
  const titleParams = () => {
    const paramOf = (m, pname, html) => {
      let fn = m.parent;
      while (fn && !ts.isFunctionLike(fn)) fn = fn.parent;
      const idx = fn ? fn.parameters.findIndex((p) => ts.isIdentifier(p.name) && p.name.text === pname) : -1;
      if (idx < 0) return false;
      const fname = (ts.isFunctionDeclaration(fn) || ts.isMethodDeclaration(fn)) && fn.name ? fn.name.getText() : ts.isVariableDeclaration(fn.parent) ? fn.parent.name.getText() : null;
      if (!fname) return false;
      const calls = (c) => {
        if (ts.isCallExpression(c)) {
          const ce = strip(c.expression);
          const nm = ts.isIdentifier(ce) ? ce.text : ts.isPropertyAccessExpression(ce) ? ce.name.getText() : '';
          if (nm === fname && c.arguments[idx]) ctx.edits.push(...(html ? exprEdits(c.arguments[idx], ctx) : plainArg(c.arguments[idx], ctx)));
        }
        ts.forEachChild(c, calls);
      };
      calls(sf);
      return true;
    };
    const v = (m) => {
      const isContent = (ts.isShorthandPropertyAssignment(m) && m.name.text === 'content') || (ts.isPropertyAssignment(m) && m.name.getText() === 'content' && ts.isIdentifier(m.initializer));
      if (isContent && ts.isObjectLiteralExpression(m.parent) && ts.isCallExpression(m.parent.parent) && /DialogV2/.test(m.parent.parent.expression.getText())) paramOf(m, ts.isShorthandPropertyAssignment(m) ? m.name.text : m.initializer.text, true);
      if (ts.isShorthandPropertyAssignment(m) && m.name.text === 'title' && ts.isObjectLiteralExpression(m.parent) && ts.isPropertyAssignment(m.parent.parent) && m.parent.parent.name.getText() === 'window') {
        let fn = m.parent;
        while (fn && !ts.isFunctionLike(fn)) fn = fn.parent;
        const idx = fn ? fn.parameters.findIndex((p) => ts.isIdentifier(p.name) && p.name.text === 'title') : -1;
        const fname = fn && idx >= 0 ? ((ts.isFunctionDeclaration(fn) || ts.isMethodDeclaration(fn)) && fn.name ? fn.name.getText() : ts.isVariableDeclaration(fn.parent) ? fn.parent.name.getText() : null) : null;
        if (fname) {
          const calls = (c) => {
            if (ts.isCallExpression(c)) {
              const ce = strip(c.expression);
              const nm = ts.isIdentifier(ce) ? ce.text : ts.isPropertyAccessExpression(ce) ? ce.name.getText() : '';
              if (nm === fname && c.arguments[idx]) ctx.edits.push(...plainArg(c.arguments[idx], ctx));
            }
            ts.forEachChild(c, calls);
          };
          calls(sf);
        } else leftovers.push(`${rel}:${line(ctx, m)} a title from somewhere this script can't follow`);
      }
      ts.forEachChild(m, v);
    };
    v(sf);
  };
  visit(sf);
  titleParams();
  // An edit inside another is left for the next pass (the outer one was computed from the old source).
  const edits = ctx.edits.sort((x, y) => x[0] - y[0] || y[1] - x[1]).filter((x, i, arr) => !arr.slice(0, i).some((y) => y[0] <= x[0] && x[1] <= y[1]));
  if (!edits.length) return null;
  let clash = false;
  const idv = (n) => { if (ts.isIdentifier(n) && n.text === ALIAS && !(ts.isImportSpecifier(n.parent) && n.parent.propertyName?.text === 't')) clash = true; ts.forEachChild(n, idv); };
  if (!/\bt as tx\b/.test(src)) idv(sf); // a file that already imports `t as tx` uses ours
  if (clash) { leftovers.push(`${rel}: '${ALIAS}' is already used in this file: skipped`); return null; }
  let out = applyEdits(src, 0, edits);
  if (/\btx\(/.test(out) && !/\bt as tx\b/.test(out)) {
    let imp = path.relative(path.dirname(file), I18N).split(path.sep).join('/');
    if (!imp.startsWith('.')) imp = `./${imp}`;
    const existing = new RegExp(`import \\{([^}]*)\\} from ["']${imp.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}["'];`);
    if (existing.test(out)) out = out.replace(existing, (_m, names) => `import {${names.trimEnd()}, t as tx } from '${imp}';`);
    else {
      const imports = [...out.matchAll(/^import [^;]*;[^\n]*\n/gm)];
      const doc = /^\s*\/\*[\s\S]*?\*\/\n/.exec(out);
      const at = imports.length ? imports[imports.length - 1].index + imports[imports.length - 1][0].length : doc ? doc[0].length : 0;
      out = out.slice(0, at) + `import { t as tx } from '${imp}';\n` + out.slice(at);
    }
  }
  total += ctx.count;
  return out;
}

for (const file of walk(SRC)) {
  const src = fs.readFileSync(file, 'utf8');
  if (!/DialogV2|window:\s*\{/.test(src)) continue;
  let cur = src;
  for (let pass = 0; pass < 8; pass++) { const next = convertSource(file, cur); if (next === null || next === cur) break; cur = next; }
  if (cur === src) continue;
  changedFiles++;
  if (!CHECK) fs.writeFileSync(file, cur);
}
// Keys a later pass superseded (an outer conversion recomputed with the inner text) are dropped.
if (!CHECK) {
  const code = walk(SRC).map((f) => fs.readFileSync(f, 'utf8')).join('\n');
  for (const store of Object.keys(STORES)) for (const [g, o] of Object.entries(STORES[store])) {
    for (const k of Object.keys(o)) if (!code.includes(`'SR2E.${store}.${g}.${k}'`)) { delete o[k]; added++; }
    if (!Object.keys(o).length) delete STORES[store][g];
  }
}
if (!CHECK && added) fs.writeFileSync(LANG, JSON.stringify(lang, null, 2) + '\n');
for (const l of leftovers) console.log(l);
console.log(`${CHECK ? 'would convert' : 'converted'} ${total} strings in ${changedFiles} files; ${leftovers.length} notes`);
if (CHECK && total) process.exit(1);
