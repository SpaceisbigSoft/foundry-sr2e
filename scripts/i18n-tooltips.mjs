#!/usr/bin/env node
/**
 * v0.89.4: move the sheet fields' tooltips (src/module/config/tooltips.ts `FIELD_TOOLTIPS`) into lang/en.json.
 *
 * `'weapon:system.skill': 'The skill it attacks with …'` becomes `'weapon:system.skill': 'SR2E.Tooltip.weapon.system__skill'`
 * (the type, or `any`, then the field's name with its dots as `__`); `applyFieldTooltips` looks the key up.
 *
 *   node scripts/i18n-tooltips.mjs           convert, add the keys
 *   node scripts/i18n-tooltips.mjs --check   exit 1 when a tooltip is still English in the code
 */
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const ROOT = process.cwd();
const FILE = path.join(ROOT, 'src', 'module', 'config', 'tooltips.ts');
const LANG = path.join(ROOT, 'public', 'lang', 'en.json');
const CHECK = process.argv.includes('--check');
const src = fs.readFileSync(FILE, 'utf8');
const lang = JSON.parse(fs.readFileSync(LANG, 'utf8'));
const TIPS = ((lang.SR2E ??= {}).Tooltip ??= {});

export const tooltipKey = (field) => {
  const i = field.indexOf(':');
  const type = i >= 0 ? field.slice(0, i) : 'any';
  const name = (i >= 0 ? field.slice(i + 1) : field).replace(/\./g, '__');
  return { group: type, key: name, full: `SR2E.Tooltip.${type}.${name}` };
};

const sf = ts.createSourceFile(FILE, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
let table = null;
const v = (n) => { if (ts.isVariableDeclaration(n) && n.name.getText() === 'FIELD_TOOLTIPS' && n.initializer && ts.isObjectLiteralExpression(n.initializer)) table = n.initializer; ts.forEachChild(n, v); };
v(sf);
if (!table) throw new Error('FIELD_TOOLTIPS not found');
const edits = [];
let left = 0;
for (const p of table.properties) {
  if (!ts.isPropertyAssignment(p)) continue;
  const field = ts.isStringLiteral(p.name) ? p.name.text : p.name.getText();
  const init = p.initializer;
  if (!ts.isStringLiteral(init) && !ts.isNoSubstitutionTemplateLiteral(init)) { left++; continue; }
  if (init.text.startsWith('SR2E.')) continue;
  const k = tooltipKey(field);
  const g = (TIPS[k.group] ??= {});
  if (Object.hasOwn(g, k.key) && g[k.key] !== init.text) throw new Error(`two tooltips for ${field}`);
  g[k.key] = init.text;
  edits.push([init.getStart(), init.getEnd(), `'${k.full}'`]);
}
console.log(`${CHECK ? 'would convert' : 'converted'} ${edits.length} tooltips; ${left} not plain text`);
if (CHECK) process.exit(edits.length || left ? 1 : 0);
let out = src;
for (const [s, e, t] of edits.sort((a, b) => b[0] - a[0])) out = out.slice(0, s) + t + out.slice(e);
fs.writeFileSync(FILE, out);
fs.writeFileSync(LANG, JSON.stringify(lang, null, 2) + '\n');
