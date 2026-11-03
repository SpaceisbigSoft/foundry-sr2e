/**
 * v0.89.0: the templates read their text from lang/en.json (`{{sr2eT "SR2E.UI.key" name=value}}`). Tests that look
 * for English in a template read it through this: each call is put back as its English, with `{{value}}` for each
 * placeholder, the way the template was written before (scripts/i18n-templates.mjs makes the same round trip).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

let ui: Record<string, string> | null = null;
function dict(): Record<string, string> {
  ui ??= JSON.parse(readFileSync(join(process.cwd(), 'public', 'lang', 'en.json'), 'utf8')).SR2E.UI ?? {};
  return ui!;
}

export function englishTemplate(src: string): string {
  const d = dict();
  return src.replace(/\{\{sr2eT "SR2E\.UI\.(\w+)"((?: \w+=[^\s}]+)*)\}\}/g, (_m, k: string, h: string) => {
    const map = Object.fromEntries([...h.matchAll(/ (\w+)=([^\s}]+)/g)].map((x) => [x[1], x[2]]));
    const english = d[k];
    if (english === undefined) throw new Error(`SR2E.UI.${k} is not in lang/en.json`);
    return english.replace(/\{(\w+)\}/g, (_x, n: string) => `{{${map[n]}}}`)
      .replace(/–/g, '&ndash;').replace(/ /g, '&nbsp;');
  });
}

/**
 * Read a file; a template comes back in English. v0.89.5: without the language-independent ids
 * scripts/i18n-headings.mjs adds (`data-heading`, `data-sr2e-gm`), so the older tests' markup still matches.
 */
export function readEnglish(path: string): string {
  const s = readFileSync(path, 'utf8');
  return path.endsWith('.hbs') ? englishTemplate(s.replace(/ data-heading="[^"]*"/g, '').replace(/ data-sr2e-gm(?=[\s>])/g, '')) : s;
}
