/**
 * v0.94.0 ("imports", report items 8 and 22): what the character import window was given. Plain text is a write-up
 * (rules/charimport.ts reads it). A JSON file is a player's own character from another tool: a Nullsheen generator
 * export (rules/nullsheen.ts) or an actor exported from the futurekill SR2 system (rules/fkimport.ts); either one is
 * turned into a write-up first, so the same import, preview and update-by-name re-import run on it.
 *
 * Pure: no Foundry globals.
 */
import { looksLikeNullsheen, nullsheenToWriteUp } from './nullsheen.ts';
import { looksLikeFuturekill, futurekillToWriteUp } from './fkimport.ts';
import { t as tx } from '../helpers/i18n.ts';

/** The largest JSON file read (a character export is a few hundred KB at most). */
export const MAX_IMPORT_JSON = 5_000_000;

export type ImportSource = 'writeup' | 'nullsheen' | 'futurekill';

export interface ImportInput {
  /** The write-up text the character import reads. */
  text: string;
  source: ImportSource;
  /** Notes about the conversion (shown before the import's own warnings). */
  warnings: string[];
  /** The character's name from the file ('' for a write-up: the import reads it). */
  name: string;
  /** A stable id of the character in the other tool (re-importing the same file finds the same character). */
  key: string;
  /** Nullsheen: 'SR2' or 'SR3'. */
  edition?: string;
}

/** Whether the text looks like JSON (an object), not a write-up. */
export function looksLikeJson(raw: string): boolean {
  return /^\s*\{/.test(String(raw ?? ''));
}

/** v0.94.0: turn what was pasted or loaded into the write-up the import reads. Never throws. */
export function importInput(raw: string): ImportInput {
  const s = String(raw ?? '');
  if (!looksLikeJson(s)) return { text: s, source: 'writeup', warnings: [], name: '', key: '' };
  if (s.length > MAX_IMPORT_JSON) return { text: '', source: 'writeup', warnings: [tx('SR2E.Import.tooBig', { max: Math.round(MAX_IMPORT_JSON / 1_000_000) })], name: '', key: '' };
  let data: unknown;
  try { data = JSON.parse(s); } catch { return { text: '', source: 'writeup', warnings: [tx('SR2E.Import.notJson')], name: '', key: '' }; }
  const out = (r: { text: string; name: string; warnings: string[]; edition?: string; key: string }, source: ImportSource): ImportInput =>
    ({ text: String(r.text ?? ''), source, warnings: [...(r.warnings ?? [])].map(String), name: String(r.name ?? ''), key: String(r.key ?? ''), ...(r.edition ? { edition: String(r.edition) } : {}) });
  try {
    if (looksLikeNullsheen(data)) return out(nullsheenToWriteUp(data), 'nullsheen');
    if (looksLikeFuturekill(data)) return out(futurekillToWriteUp(data), 'futurekill');
  } catch {
    // The converters don't throw; if one ever does, say so rather than stop the window.
    return { text: '', source: 'writeup', warnings: [tx('SR2E.Import.unreadable')], name: '', key: '' };
  }
  return { text: '', source: 'writeup', warnings: [tx('SR2E.Import.unknownJson')], name: '', key: '' };
}

/** The flag an imported character carries, so a re-import of the same file finds it. */
export interface ImportMark { source: ImportSource; key: string }

/** v0.94.0: whether an actor's import flag says it came from this file's character. */
export function sameImport(mark: unknown, input: Pick<ImportInput, 'source' | 'key'>): boolean {
  if (!input.key || input.source === 'writeup' || !mark || typeof mark !== 'object') return false;
  const m = mark as Partial<ImportMark>;
  return m.source === input.source && String(m.key ?? '') === input.key;
}
