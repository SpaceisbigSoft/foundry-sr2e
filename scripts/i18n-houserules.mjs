#!/usr/bin/env node
/**
 * v0.89.4: move the house-rules registry's text (src/module/settings.ts `HOUSE_RULES`) into lang/en.json.
 *
 * Each entry `{ section: "Tests and dice", path: "MIN_TARGET_NUMBER", label: "Minimum target number", type: … }`
 * becomes `{ section: "testsAndDice", path: "MIN_TARGET_NUMBER", type: … }`: the section is an id
 * (`SR2E.HouseRules.Section.<id>`), and the label's key comes from the path (`SR2E.HouseRules.Rule.<path, dots as
 * __>`, see `houseRuleKey` in settings.ts). The window looks both up when it draws them.
 *
 *   node scripts/i18n-houserules.mjs           convert, add the keys
 *   node scripts/i18n-houserules.mjs --check   exit 1 when an entry still holds a label or an English section
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const FILE = path.join(ROOT, 'src', 'module', 'settings.ts');
const LANG = path.join(ROOT, 'public', 'lang', 'en.json');
const CHECK = process.argv.includes('--check');

const src = fs.readFileSync(FILE, 'utf8');
const lang = JSON.parse(fs.readFileSync(LANG, 'utf8'));
const HR = ((lang.SR2E ??= {}).HouseRules ??= {});
const SECTIONS = (HR.Section ??= {});
const RULES = (HR.Rule ??= {});

const slug = (text) => {
  const words = text.replace(/[^A-Za-z0-9 ]+/g, ' ').trim().split(/\s+/).filter(Boolean);
  return words.map((w, i) => (i ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w.toLowerCase())).join('');
};
/** The key part for a rule path (dots as `__`, so no path is a prefix of another key). */
export const ruleKeyPart = (p) => p.replace(/\./g, '__');

const start = src.indexOf('export const HOUSE_RULES: HouseRuleDef[] = [');
const end = src.indexOf('\n];', start);
if (start < 0 || end < 0) throw new Error('HOUSE_RULES not found');
const head = src.slice(0, start);
const block = src.slice(start, end);
const tail = src.slice(end);
const ENTRY = /^(\s*)\{ section: "((?:[^"\\]|\\.)*)", path: "([^"]+)", label: "((?:[^"\\]|\\.)*)", (type: .*)$/;
let converted = 0;
const sectionIdOf = new Map(Object.entries(SECTIONS).map(([id, text]) => [text, id]));
const out = block.split('\n').map((line) => {
  const m = ENTRY.exec(line);
  if (!m) return line;
  const [, indent, secRaw, rulePath, labelRaw, rest] = m;
  const section = JSON.parse(`"${secRaw}"`);
  const label = JSON.parse(`"${labelRaw}"`);
  let id = sectionIdOf.get(section);
  if (!id) {
    id = slug(section);
    for (let n = 2; Object.hasOwn(SECTIONS, id); n++) id = `${slug(section)}${n}`;
    SECTIONS[id] = section;
    sectionIdOf.set(section, id);
  }
  const k = ruleKeyPart(rulePath);
  if (Object.hasOwn(RULES, k) && RULES[k] !== label) throw new Error(`two labels for ${rulePath}`);
  RULES[k] = label;
  converted++;
  return `${indent}{ section: "${id}", path: "${rulePath}", ${rest}`;
});
const left = out.filter((l) => /\blabel: "/.test(l)).length;
console.log(`${CHECK ? 'would convert' : 'converted'} ${converted} house rules; ${Object.keys(SECTIONS).length} sections; ${left} entries left with a label`);
if (CHECK) process.exit(converted || left ? 1 : 0);
fs.writeFileSync(FILE, head + out.join('\n') + tail);
fs.writeFileSync(LANG, JSON.stringify(lang, null, 2) + '\n');
