#!/usr/bin/env node
/**
 * v0.89.5: give the templates' headings an id that doesn't change with the language. A heading whose text starts with
 * `{{sr2eT "KEY" …}}` gets `data-heading="<the English text of KEY>"`. The guide's "?" links, the section icons, the
 * fold keys and the setup warnings' jumps read `data-heading` (helpers/heading.ts) instead of the shown text, so they
 * work the same in every language, and a section folded in English stays folded in another.
 * A control whose tooltip is a key whose English says "(GM)" gets `data-sr2e-gm` (the striped GM-only edge,
 * applications/interface.ts markGmOnly), so the edge doesn't depend on a translation keeping "(GM)".
 *
 *   node scripts/i18n-headings.mjs           add or refresh the attributes
 *   node scripts/i18n-headings.mjs --check   exit 1 when a heading lacks its attribute or it is out of date
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DIR = path.join(ROOT, 'public', 'templates');
const CHECK = process.argv.includes('--check');
const flat = {};
const walk = (o, p) => { for (const [k, v] of Object.entries(o)) typeof v === 'string' ? (flat[p + k] = v) : walk(v, p + k + '.'); };
walk(JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'lang', 'en.json'), 'utf8')), '');

/** Pure: the id a heading's English text gives (placeholders, tags and a trailing "?" or ":" dropped; quotes made safe). */
export function headingId(english) {
  return String(english)
    .replace(/<[^>]*>/g, ' ').replace(/\{[A-Za-z_]\w*\}/g, ' ').replace(/&[a-z]+;|&#\d+;/g, ' ')
    .replace(/["<>]/g, ' ').replace(/\s+/g, ' ').trim().replace(/[?:]$/, '').trim();
}

const OPEN = /<(h[1-4]|legend|summary)(\s[^>]*)?>(\s*)\{\{sr2eT "(SR2E\.[\w.]+)"/g;
let changed = 0, missing = 0;
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith('.hbs'))) {
  const p = path.join(DIR, f);
  const src = fs.readFileSync(p, 'utf8');
  const out = src.replace(OPEN, (all, tag, attrs = '', ws, key) => {
    const english = flat[key];
    if (english === undefined) return all;
    const has = /\sdata-heading="([^"]*)"/.exec(attrs);
    // A heading filled from data ("Group: {name}" in a list) has no fixed id: it keeps its shown text, so each one
    // folds on its own (review #1). Any id it was given earlier is taken off.
    if (/\{[A-Za-z_]\w*\}/.test(english)) {
      if (!has) return all;
      missing++;
      return `<${tag}${attrs.replace(has[0], '')}>${ws}{{sr2eT "${key}"`;
    }
    const id = headingId(english);
    if (!id) return all;
    if (has && has[1] === id) return all;
    missing++;
    const rest = has ? attrs.replace(has[0], '') : attrs;
    return `<${tag}${rest} data-heading="${id}">${ws}{{sr2eT "${key}"`;
  });
  if (out !== src) { changed++; if (!CHECK) fs.writeFileSync(p, out); }
}
// GM-only controls: `title="{{sr2eT "KEY"}}"` with "(GM)" in the English of KEY.
const GM_TITLE = /<([a-z][\w-]*)((?:\s(?!data-sr2e-gm[\s>=])[^>]*?)?)\stitle="\{\{sr2eT "(SR2E\.[\w.]+)"([^>]*)>/g;
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith('.hbs'))) {
  const p = path.join(DIR, f);
  const src = fs.readFileSync(p, 'utf8');
  const out = src.replace(GM_TITLE, (all, tag, before, key, after) => {
    if (!String(flat[key] ?? '').includes('(GM)') || /\sdata-sr2e-gm\b/.test(all)) return all;
    missing++;
    return `<${tag}${before} data-sr2e-gm title="{{sr2eT "${key}"${after}>`;
  });
  if (out !== src) { changed++; if (!CHECK) fs.writeFileSync(p, out); }
}
if (CHECK) {
  if (missing) { console.error(`${missing} heading(s) without an up-to-date data-heading: run node scripts/i18n-headings.mjs`); process.exit(1); }
  console.log('headings: ok');
} else console.log(`headings: ${missing} attribute(s) in ${changed} template(s)`);
