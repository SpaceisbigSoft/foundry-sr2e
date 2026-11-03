#!/usr/bin/env node
/**
 * v0.89.2: check that a localization slice changed no output. Compares every top-level statement and class member of
 * src/module in two copies of the system, with each `tx('key', { … })` / `tCount(n, 'key')` call inlined back into
 * the template it stands for (from the newer copy's lang/en.json), nested templates flattened and whitespace inside
 * text collapsed. Plural suffixes chosen in code (`n === 1 ? '' : 's'`) and tCount compare equal.
 *
 *   node scripts/i18n-equiv.mjs <old copy> <new copy>          (set COUNTS=1 to ignore escHtml/Number around counts)
 *
 * v0.89.3: a counted card text (`tCount(n, 'SR2E.Card.…', { … })` with whole `one` / `other` texts) and the wording it
 * replaces (`n === 1 ? 'a' : 'b'` values) are both expanded into their two forms, and the forms are compared.
 *
 * It can't see a code value being translated (the English looks the same): check those by reading.
 */
import fs from 'node:fs'; import path from 'node:path';
import ts from 'typescript';
const [BASE, WORK] = process.argv.slice(2);
const flat = {}; const walkJ = (o, p) => { for (const [k, v] of Object.entries(o)) typeof v === 'string' ? flat[p + k] = v : walkJ(v, p + k + '.'); };
walkJ(JSON.parse(fs.readFileSync(path.join(WORK, 'public/lang/en.json'), 'utf8')), '');
const cook = (raw) => new Function(`return \`${raw}\`;`)();
function ser(n) {
  const t = tpl(n);
  if (t) return 'T' + JSON.stringify(norm(t));
  if (ts.isIdentifier(n) || ts.isPrivateIdentifier(n)) return 'I:' + n.text;
  if (ts.isNumericLiteral(n)) return 'N:' + n.text;
  if (ts.isRegularExpressionLiteral(n)) return 'R:' + n.text;
  const kids = []; ts.forEachChild(n, (c) => { kids.push(ser(c)); });
  // tokens that forEachChild skips (operators are children of BinaryExpression; keywords appear as kinds)
  return ts.SyntaxKind[n.kind] + '(' + kids.join(',') + ')';
}
function tpl(n) {
  while (ts.isParenthesizedExpression(n)) n = n.expression;
  if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) return [{ s: n.text }];
  if (ts.isTemplateExpression(n)) {
    const parts = [{ s: n.head.text }];
    for (const sp of n.templateSpans) { const x = unwrap(sp.expression); const cc = countChoice(x); if (cc) parts.push(cc); else if (isSuf(x)) parts.push({ e: 'SUFFIX' }); else { const c = tpl(sp.expression); if (c) parts.push(...c); else parts.push({ e: ser(unwrapCount(sp.expression)) }); } parts.push({ s: sp.literal.text }); }
    return parts;
  }
  if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'tCount' && n.arguments[1] && ts.isStringLiteral(n.arguments[1]) && /^SR2E\.(Card|Count|App)\./.test(n.arguments[1].text)) {
    // v0.89.3: whole counted texts (card texts, and the shared counted nouns), as their two forms
    const k = n.arguments[1].text;
    const N = n.arguments[0];
    const form = (f) => { const text = flat[`${k}.${f}`]; return text === undefined ? [{ s: `<<MISSING ${k}.${f}>>` }] : fill(text, n.arguments[2], N); };
    return [{ pl: ser(unwrapCount(N)), one: form('one'), other: form('other') }];
  }
  if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'tCount' && n.arguments[1] && ts.isStringLiteral(n.arguments[1])) {
    const ck = n.arguments[1].text.replace('SR2E.Notify.Count.', 'SR2E.Count.'); const one = flat[ck + '.one'].replace('{count} ', ''), other = flat[ck + '.other'].replace('{count} ', '');
    let k = 0; while (k < one.length && one[k] === other[k]) k++;
    return [{ e: ser(unwrapCount(n.arguments[0])) }, { s: ' ' + one.slice(0, k) }, ...(one === other ? [] : [{ e: 'SUFFIX' }])];
  }
  if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'tx' && n.arguments[0] && ts.isStringLiteral(n.arguments[0])) {
    const text = flat[n.arguments[0].text];
    if (text === undefined) return [{ s: `<<MISSING ${n.arguments[0].text}>>` }];
    return fill(text, n.arguments[1], null);
  }
  return null;
}
/** A translation's text with its placeholders filled from the call's data object (`{count}` from N). */
function fill(text, o, N) {
  const data = {};
  if (o && ts.isObjectLiteralExpression(o)) for (const p of o.properties) {
    if (ts.isPropertyAssignment(p)) data[p.name.getText()] = p.initializer;
    else if (ts.isShorthandPropertyAssignment(p)) data[p.name.text] = p.name;
  }
  if (N) data.count = N;
  const parts = [];
  let last = 0;
  for (const m of text.matchAll(/\{([A-Za-z_]\w*)\}/g)) {
    parts.push({ s: text.slice(last, m.index) });
    const v = data[m[1]];
    if (!v) parts.push({ s: '<<NOVALUE ' + m[1] + '>>' });
    else { const cc = countChoice(unwrap(v)); if (cc) parts.push(cc); else if (isSuf(unwrap(v))) parts.push({ e: 'SUFFIX' }); else { const c = tpl(v); if (c) parts.push(...c); else parts.push({ e: ser(unwrapCount(v)) }); } }
    last = m.index + m[0].length;
  }
  parts.push({ s: text.slice(last) });
  return parts;
}
/** v0.89.3: `n === 1 ? 'a' : 'b'` (literal branches): the wording chosen by a count, as its two forms. */
function countChoice(e) {
  if (!ts.isConditionalExpression(e)) return null;
  const a = unwrap(e.whenTrue), b = unwrap(e.whenFalse);
  if (!isLitS(a) || !isLitS(b)) return null;
  const c = unwrap(e.condition);
  if (!ts.isBinaryExpression(c)) return null;
  const k = c.operatorToken.kind;
  const eq = k === ts.SyntaxKind.EqualsEqualsEqualsToken || k === ts.SyntaxKind.EqualsEqualsToken;
  const ne = k === ts.SyntaxKind.ExclamationEqualsEqualsToken || k === ts.SyntaxKind.ExclamationEqualsToken;
  if (!eq && !ne) return null;
  const one1 = (x) => ts.isNumericLiteral(unwrap(x)) && unwrap(x).text === '1';
  const N = one1(c.right) ? c.left : one1(c.left) ? c.right : null;
  if (!N) return null;
  return { pl: ser(unwrapCount(N)), one: [{ s: eq ? a.text : b.text }], other: [{ s: eq ? b.text : a.text }] };
}
function unwrap(e) { while (ts.isParenthesizedExpression(e)) e = e.expression; return e; }
const isLitS = (e) => ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e);
function isSuf(e) { return ts.isConditionalExpression(e) && [e.whenTrue, e.whenFalse].map(unwrap).every((b) => isLitS(b) && /^(s|es|ies|y|)$/.test(b.text)); }
function unwrapCount(e) { e = unwrap(e); if (process.env.COUNTS && ts.isCallExpression(e) && ts.isIdentifier(e.expression) && /^(escHtml|escText|esc|Number)$/.test(e.expression.text) && e.arguments[0]) return unwrapCount(e.arguments[0]); return e; }
// the 'one' text without the suffix: a y/ies noun keeps the stem before y
function norm(parts) {
  // v0.89.3: expand count-chosen wording into every combination of its counts' forms
  const keys = [];
  const gather = (ps) => { for (const p of ps) if (p.pl !== undefined) { if (!keys.includes(p.pl)) keys.push(p.pl); gather(p.one); gather(p.other); } };
  gather(parts);
  if (keys.length) {
    const variants = [];
    for (let mask = 0; mask < 1 << keys.length; mask++) {
      const pick = (ps) => ps.flatMap((p) => (p.pl !== undefined ? pick(mask & (1 << keys.indexOf(p.pl)) ? p.one : p.other) : [p]));
      variants.push(JSON.stringify(norm(pick(parts))));
    }
    return [{ e: 'PLURAL(' + keys.join('|') + ')[' + variants.join(' / ') + ']' }];
  }
  const out = [];
  for (const p of parts) {
    if (p.s !== undefined) { if (out.length && out[out.length - 1].s !== undefined) out[out.length - 1].s += p.s; else out.push({ s: p.s }); }
    else out.push(p);
  }
  return out.map((p) => (p.s !== undefined ? { s: p.s.replace(/\s+/g, ' ') } : p)).filter((p) => p.s !== '');
}
function stmts(file) {
  const sf = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  // v0.89.4: each statement's name (a function, class member or const), to pair them when a slice adds or removes some
  const nameOf = (s) => (s.name?.getText?.() ?? (ts.isVariableStatement(s) ? s.declarationList.declarations.map((d) => d.name.getText()).join(',') : null));
  const qual = (s) => { const n = nameOf(s); return n && ts.isClassDeclaration(s.parent) ? `${s.parent.name?.getText() ?? 'class'}.${n}` : n; };
  return sf.statements.filter((s) => !ts.isImportDeclaration(s)).flatMap((s) => (ts.isClassDeclaration(s) ? [...s.members] : [s])).map((s) => ({ ser: ser(s), name: qual(s), line: sf.getLineAndCharacterOfPosition(s.getStart()).line + 1 }));
}
const files = []; const w = (d) => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); fs.statSync(p).isDirectory() ? (f !== '__tests__' && w(p)) : f.endsWith('.ts') && files.push(path.relative(WORK, p)); } };
w(path.join(WORK, 'src/module'));
let bad = 0, same = 0;
for (const f of files) {
  if (!fs.existsSync(path.join(BASE, f))) { console.log(`${f}: new file`); continue; }
  const a = stmts(path.join(BASE, f)), b = stmts(path.join(WORK, f));
  if (a.length !== b.length) {
    // pair by name; report the statements only one side has
    const byName = new Map(a.filter((x) => x.name).map((x) => [x.name, x]));
    const names = new Set(b.filter((x) => x.name).map((x) => x.name));
    for (const x of a) if (x.name && !names.has(x.name)) { console.log(`${f}:${x.line} removed: ${x.name}`); bad++; }
    // unnamed statements (a Hooks.on(…), an IIFE): paired by position among themselves
    const ua = a.filter((x) => !x.name), ub = b.filter((y) => !y.name);
    if (ua.length !== ub.length) { console.log(`${f}: unnamed statements ${ua.length} vs ${ub.length}`); bad++; }
    else ua.forEach((x, i) => { if (x.ser === ub[i].ser) same++; else { bad++; console.log(`${f}:${ub[i].line} differs (unnamed)`); } });
    const dup = b.filter((y, i) => y.name && b.findIndex((z) => z.name === y.name) !== i);
    for (const y of dup) { console.log(`${f}:${y.line} two statements named ${y.name}: compared by position only`); bad++; }
    for (const y of b) {
      if (!y.name) continue;
      const x = byName.get(y.name);
      if (!x) { console.log(`${f}:${y.line} added: ${y.name}`); bad++; continue; }
      if (x.ser === y.ser) { same++; continue; }
      bad++;
      let k = 0; while (k < x.ser.length && x.ser[k] === y.ser[k]) k++;
      console.log(`${f}:${y.line} differs\n  base: …${x.ser.slice(Math.max(0, k - 120), k + 160)}\n  work: …${y.ser.slice(Math.max(0, k - 120), k + 160)}`);
    }
    continue;
  }
  for (let i = 0; i < a.length; i++) {
    if (a[i].ser === b[i].ser) { same++; continue; }
    bad++;
    // first differing position
    let k = 0; while (k < a[i].ser.length && a[i].ser[k] === b[i].ser[k]) k++;
    console.log(`${f}:${b[i].line} differs\n  base: …${a[i].ser.slice(Math.max(0, k - 120), k + 160)}\n  work: …${b[i].ser.slice(Math.max(0, k - 120), k + 160)}`);
  }
}
console.log(`same ${same}, differ ${bad}`);
