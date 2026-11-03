/**
 * v0.89.0: the localization ratchet. Counts the English text still written in the code (string and template
 * literals of two words or more), per file. The count may only go down as slices move text into lang/en.json.
 * It is a rough measure: CSS selectors, class lists, console messages, keys and paths are left out; single words
 * ("Print", "Off") are not counted. Template literals over several lines count as one string.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
/** What comes just before a literal that makes it code, not text for a person (a selector, a log, an import). */
const CODE_BEFORE = /(console\.(log|warn|error|debug|info)\([^)]*|querySelector(All)?\(|closest\(|matches\(|classList\.\w+\(|dataset\[|import |from |require\(|registerHelper\(|addEventListener\()\s*$/;
const LITERAL = /'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g;

/** Pure: the file without its comments (literals kept), so a word in a comment is never counted. */
export function stripComments(src: string): string {
  let out = '';
  let i = 0;
  while (i < src.length) {
    const c = src[i]!;
    if (c === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (c === '/' && src[i + 1] === '*') { const e = src.indexOf('*/', i + 2); i = e < 0 ? src.length : e + 2; continue; }
    if (c === '"' || c === "'" || c === '`') {
      let j = i + 1;
      while (j < src.length && src[j] !== c) { if (src[j] === '\\') j++; j++; }
      out += src.slice(i, j + 1); i = j + 1; continue;
    }
    out += c; i++;
  }
  return out;
}

/** Pure: whether a literal's text reads as English for a person (two words, not a key, path, selector or class list). */
export function looksEnglish(text: string): boolean {
  // v0.89.5: a piece of code the literal pattern cut out between nested template literals (it calls a translation)
  if (/\b(tx|tCount|tKey|tHtml|tNoun)\('SR2E\./.test(text)) return false;
  const s = text.replace(/\$\{[^}]*\}/g, ' ').replace(/<[^>]*>/g, ' ').trim();
  if (!/[A-Za-z]{2,}[^A-Za-z]+[A-Za-z]{2,}/.test(s)) return false;
  if (/^SR2E\./.test(s) || /^(fa-|sr2e-|systems\/|icons\/|https?:)/.test(s)) return false;
  // v0.89.4: a CONSTANT_CASE name (a table's name) or a dotted rule path (`COMBAT.prone.targetMelee`) is code
  if (/^[A-Z][A-Z0-9_]*$/.test(s) || /^[A-Z][A-Z0-9_]*(\.[A-Za-z0-9_]+)+$/.test(s)) return false;
  if (/^[\w.-]+(\s+[\w.-]+)*$/.test(s) && !/[A-Z]/.test(s.charAt(0)) && !/\s(the|a|to|of|and|or|is|on|in|for|you)\s/i.test(` ${s} `)) return false;
  if (/^[\[.#:][\w-]/.test(s) || /\[data-|:scope|>\s*\.|,\s*\./.test(s)) return false;
  return true;
}

export function englishCounts(): Record<string, number> {
  const out: Record<string, number> = {};
  const walk = (d: string) => {
    for (const f of readdirSync(d)) {
      const p = join(d, f);
      if (statSync(p).isDirectory()) { if (f !== '__tests__') walk(p); continue; }
      if (!f.endsWith('.ts')) continue;
      let n = 0;
      // The whole file at once, so a template literal over several lines (dialog and card HTML) is one string.
      const src = stripComments(readFileSync(p, 'utf8'));
      for (const m of src.matchAll(LITERAL)) {
        const before = src.slice(Math.max(0, (m.index ?? 0) - 60), m.index);
        if (CODE_BEFORE.test(before)) continue;
        if (looksEnglish(m[1] ?? m[2] ?? m[3] ?? '')) n++;
      }
      if (n) out[relative(ROOT, p)] = n;
    }
  };
  walk(join(ROOT, 'src', 'module'));
  return out;
}
