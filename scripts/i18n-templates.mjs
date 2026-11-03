/**
 * v0.89.0: move the templates' English text into lang/en.json.
 *
 *   node scripts/i18n-templates.mjs            rewrite public/templates/*.hbs and add the keys to public/lang/en.json
 *   node scripts/i18n-templates.mjs --check    only report what would change (exit 1 if anything is left)
 *
 * Each run of text between tags (with the simple `{{path}}` values inside it) becomes one string, and each static
 * title / placeholder / aria-label / data-tooltip / alt value too:
 *   Raise to {{improve.to}}: {{improve.cost}} Karma  →  {{sr2eT "SR2E.UI.raiseToKarma" to=improve.to cost=improve.cost}}
 * with "Raise to {to}: {cost} Karma" in en.json. `sr2eT` (helpers/i18n.ts) is Foundry's format with empty values for
 * missing data. Block helpers, triple-stash values, comments and tags are boundaries and stay as they are. The same
 * English text gets the same key everywhere. A round-trip check (each string put back) must give the original text.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const TPL = path.join(ROOT, 'public', 'templates');
const LANG = path.join(ROOT, 'public', 'lang', 'en.json');
const CHECK = process.argv.includes('--check');
const ATTRS = ['title', 'placeholder', 'aria-label', 'data-tooltip', 'alt'];

const SIMPLE = /^\{\{\s*((?:\.\.\/)*@?[A-Za-z_][\w.@]*|this)\s*\}\}$/;
const KEYWORDS = new Set(['else', 'this']);

/** Split a piece of template (no tags) into text, simple values and other mustaches. */
export function lex(s) {
  const out = [];
  let i = 0;
  while (i < s.length) {
    const j = s.indexOf('{{', i);
    if (j < 0) { out.push({ t: 'text', v: s.slice(i) }); break; }
    if (j > i) out.push({ t: 'text', v: s.slice(i, j) });
    let end;
    if (s.startsWith('{{!--', j)) end = s.indexOf('--}}', j) + 4;
    else if (s.startsWith('{{{', j)) end = s.indexOf('}}}', j) + 3;
    else end = s.indexOf('}}', j) + 2;
    if (end < j + 2) throw new Error(`unclosed mustache at ${j}`);
    const m = s.slice(j, end);
    const simple = SIMPLE.exec(m);
    out.push({ t: simple && !KEYWORDS.has(simple[1]) ? 'var' : simple && simple[1] === 'this' ? 'var' : 'stache', v: m, path: simple?.[1] });
    i = end;
  }
  return out;
}

const ENTITIES = { '&ndash;': '–', '&mdash;': '—', '&nbsp;': ' ', '&amp;': '&', '&hellip;': '…', '&times;': '×', '&minus;': '−', '&rarr;': '→', '&middot;': '·', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };
const decode = (s) => s.replace(/&[a-z#0-9]+;/gi, (e) => ENTITIES[e] ?? e);

/** A key from the words of the text. */
function slug(text) {
  const words = text.replace(/\{[^}]*\}/g, ' ').replace(/[^A-Za-z0-9 ]+/g, ' ').trim().split(/\s+/).filter(Boolean).slice(0, 6);
  const s = words.map((w, i) => (i ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w.toLowerCase())).join('').slice(0, 40);
  return s || 'text';
}

const lang = JSON.parse(fs.readFileSync(LANG, 'utf8'));
lang.SR2E ??= {};
lang.SR2E.UI ??= {};
const UI = lang.SR2E.UI;
const byText = new Map(Object.entries(UI).map(([k, v]) => [v, k]));

function keyFor(english) {
  if (byText.has(english)) return `SR2E.UI.${byText.get(english)}`;
  let base = slug(english);
  let k = base;
  for (let n = 2; Object.hasOwn(UI, k); n++) k = `${base}${n}`;
  UI[k] = english;
  byText.set(english, k);
  return `SR2E.UI.${k}`;
}

/** Turn a run of text and simple values into one sr2eT call (or leave it when it holds no words). */
function convertRun(tokens) {
  const raw = tokens.map((t) => t.v).join('');
  const lead = /^\s*/.exec(raw)[0];
  const trail = /\s*$/.exec(raw)[0];
  const textOnly = tokens.filter((t) => t.t === 'text').map((t) => t.v).join('');
  if (!/[A-Za-z]{2,}/.test(decode(textOnly)) || /[{}]/.test(textOnly)) return raw;
  const names = new Map();
  let english = '';
  const hash = [];
  for (const t of tokens) {
    if (t.t === 'text') { english += t.v; continue; }
    const p = t.path === 'this' ? 'value' : t.path.split(/[./]/).filter((x) => x && x !== '..').pop().replace(/^@/, '');
    let name = p;
    if (names.has(t.path)) name = names.get(t.path);
    else {
      for (let n = 2; [...names.values()].includes(name); n++) name = `${p}${n}`;
      names.set(t.path, name);
      hash.push(`${name}=${t.path}`);
    }
    english += `{${name}}`;
  }
  // Collapse ordinary whitespace only: a non-breaking space (from &nbsp;) is kept.
  english = decode(english).replace(/[ \t\r\n\f]+/g, ' ').replace(/^[ \t\r\n\f]+|[ \t\r\n\f]+$/g, '');
  const key = keyFor(english);
  return `${lead}{{sr2eT "${key}"${hash.length ? ' ' + hash.join(' ') : ''}}}${trail}`;
}

/** Convert a tag-free piece (text between tags, or an attribute value). */
function convertPiece(s) {
  const toks = lex(s);
  let out = '';
  let run = [];
  const flush = () => { if (run.length) out += convertRun(run); run = []; };
  for (const t of toks) {
    if (t.t === 'text' || t.t === 'var') run.push(t);
    else { flush(); out += t.v; }
  }
  flush();
  return out;
}

/** Convert a tag's localizable attribute values (a value may hold mustaches with quotes inside). */
function convertTag(tag) {
  let out = '';
  let i = 0;
  const re = new RegExp(`\\s(?:${ATTRS.join('|')})="`, 'g');
  let m;
  while ((m = re.exec(tag))) {
    const start = m.index + m[0].length;
    if (start < i) continue;
    // The closing quote, skipping mustaches.
    let j = start;
    while (j < tag.length) {
      if (tag.startsWith('{{', j)) { j = tag.indexOf('}}', j) + 2; continue; }
      if (tag[j] === '"') break;
      j++;
    }
    out += tag.slice(i, start) + convertPiece(tag.slice(start, j));
    i = j;
    re.lastIndex = j + 1;
  }
  return out + tag.slice(i);
}

/** Split a template into tags and the rest (a tag may hold mustaches and quoted values). */
function splitTags(s) {
  const out = [];
  let i = 0;
  let skipUntil = '';
  while (i < s.length) {
    const lt = s.indexOf('<', i);
    if (lt < 0) { out.push({ k: 'body', v: s.slice(i) }); break; }
    // A '<' inside a mustache or comment is not a tag.
    const before = s.slice(i, lt);
    const openC = before.lastIndexOf('{{');
    const closeC = before.lastIndexOf('}}');
    if (openC > closeC) {
      const end = s.startsWith('{{!--', i + openC) ? s.indexOf('--}}', i + openC) + 4 : s.indexOf('}}', lt) + 2;
      out.push({ k: 'body', v: s.slice(i, end) });
      i = end;
      continue;
    }
    if (lt > i) out.push({ k: 'body', v: s.slice(i, lt) });
    // Find the tag's end, skipping quoted values and mustaches.
    let j = lt + 1;
    let q = '';
    while (j < s.length) {
      const c = s[j];
      if (s.startsWith('{{', j)) { j = s.indexOf('}}', j) + 2; continue; }
      if (q) { if (c === q) q = ''; }
      else if (c === '"' || c === "'") q = c;
      else if (c === '>') break;
      j++;
    }
    const tag = s.slice(lt, j + 1);
    out.push({ k: 'tag', v: tag });
    i = j + 1;
    const name = /^<\s*([a-z0-9-]+)/i.exec(tag)?.[1]?.toLowerCase();
    if (name === 'style' || name === 'script' || name === 'textarea' || name === 'pre') {
      const close = s.toLowerCase().indexOf(`</${name}`, i);
      out.push({ k: 'raw', v: s.slice(i, close) });
      i = close;
    }
    void skipUntil;
  }
  return out;
}

export function convertTemplate(src) {
  return splitTags(src).map((p) => (p.k === 'tag' ? convertTag(p.v) : p.k === 'body' ? convertPiece(p.v) : p.v)).join('');
}

/** Put every sr2eT call back as its English with {{values}}: must give the original (whitespace collapsed). */
export function unconvert(src, dict) {
  return src.replace(/\{\{sr2eT "SR2E\.UI\.([\w]+)"((?: [\w]+=[^\s}]+)*)\}\}/g, (_m, k, h) => {
    const map = Object.fromEntries([...h.matchAll(/ ([\w]+)=([^\s}]+)/g)].map((x) => [x[1], x[2]]));
    return String(dict[k]).replace(/\{([\w]+)\}/g, (_x, n) => `{{${map[n]}}}`);
  });
}

const norm = (s) => decode(s).replace(/\s+/g, ' ').trim();

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  let changed = 0;
  for (const f of fs.readdirSync(TPL).filter((x) => x.endsWith('.hbs')).sort()) {
    const p = path.join(TPL, f);
    const src = fs.readFileSync(p, 'utf8');
    const out = convertTemplate(src);
    if (out === src) continue;
    const back = unconvert(out, UI);
    if (norm(back) !== norm(src)) {
      // Find the first difference for the report.
      const a = norm(back), b = norm(src);
      let i = 0; while (i < a.length && a[i] === b[i]) i++;
      throw new Error(`${f}: the round trip differs at ${i}:\n  got  ${a.slice(Math.max(0, i - 60), i + 60)}\n  want ${b.slice(Math.max(0, i - 60), i + 60)}`);
    }
    changed++;
    if (!CHECK) fs.writeFileSync(p, out);
    console.log(`${CHECK ? 'would change' : 'changed'} ${f}`);
  }
  if (!CHECK) fs.writeFileSync(LANG, JSON.stringify(lang, null, 2) + '\n');
  console.log(`${changed} templates; ${Object.keys(UI).length} strings in SR2E.UI`);
  if (CHECK && changed) process.exit(1);
}
