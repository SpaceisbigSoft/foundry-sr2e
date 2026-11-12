/**
 * v0.92.0: the rules interpretations (the owner's request, 2 Nov 2026: show players and the GM, subtly, where the rules
 * as written aren't clear and a creator's interpretation was used). Each entry: an id, an area, the house-rule switch
 * that puts another reading in place (a RULES path, or none), and its text in the language file under
 * `SR2E.Interp.List.<id>`: `title`, `summary` (one line, the hover), `gap` (what the rules leave unclear),
 * `resolution` (how the system resolves it), `sources`.
 *
 * Shown as a small † (`interpMark`) beside a value, and as a line of † links on chat cards (`interpLine`); clicking one
 * opens the Interpretations window at that entry (applications/interpretations.ts), which also lists them all (the SR2e
 * tools window, the guide). Seeded from `docs/VERIFY.md` and the creator's calls in v0.91.0–v0.92.0.
 */
import { escHtml } from './html.ts';
import { t as tx, tKey } from '../helpers/i18n.ts';

/** An area of the rules (the window groups by it). */
export type InterpArea = 'magic' | 'street';

/** One interpretation. */
export interface Interpretation { id: string; area: InterpArea; rule: string }

/** Every interpretation, in the window's order. */
export const INTERPRETATIONS: readonly Interpretation[] = [
  { id: 'magicPoolLayers', area: 'magic', rule: 'MAGIC_V920.poolLayers' },
  { id: 'narrowCasting', area: 'magic', rule: 'MAGIC_V920.castNarrow' },
  { id: 'narrowDrain', area: 'magic', rule: 'MAGIC_V920.drainNarrow' },
  { id: 'formulaRequired', area: 'magic', rule: 'FORMULA_V918.required' },
  { id: 'formulaPrice', area: 'magic', rule: 'FORMULA_V918.nuyenPerForce' },
  { id: 'teacher', area: 'magic', rule: 'FORMULA_V918.teacher' },
  { id: 'otherTradition', area: 'magic', rule: 'FORMULA_V918.foreign' },
  { id: 'findRetry', area: 'street', rule: 'SHOP_V91.retry' },
  { id: 'legalityFind', area: 'street', rule: 'SHOP_V915.findByLegality' },
  { id: 'permits', area: 'street', rule: 'SHOP_V915.permits' },
  { id: 'contactHelp', area: 'street', rule: 'SHOP_V916.through' },
  { id: 'fixer', area: 'street', rule: 'SHOP_V916.fixerFee' },
];

/** The ids, for checks. */
export const INTERP_IDS: ReadonlySet<string> = new Set(INTERPRETATIONS.map((i) => i.id));

/** An entry by id (null for an unknown id). */
export function interpretation(id: unknown): Interpretation | null {
  return INTERPRETATIONS.find((i) => i.id === String(id ?? '')) ?? null;
}

/** An entry's text (its language keys). */
export function interpText(id: string): { title: string; summary: string; gap: string; resolution: string; sources: string } {
  const k = (part: string) => tKey(`SR2E.Interp.List.${id}.${part}`);
  return { title: k('title'), summary: k('summary'), gap: k('gap'), resolution: k('resolution'), sources: k('sources') };
}

/** The value a RULES path has now (for the window: what the switch is set to). */
export function ruleValue(rules: any, path: string): unknown {
  return String(path ?? '').split('.').reduce((o: any, p) => (o == null ? undefined : o[p]), rules);
}

/**
 * The small † beside a value: hovering shows the one-line summary; clicking (or Enter) opens the window at the entry.
 * Unknown ids give ''.
 */
export function interpMark(id: string): string {
  if (!INTERP_IDS.has(id)) return '';
  const t = interpText(id);
  return `<a class="sr2e-interp" data-sr2e-interp="${escHtml(id)}" role="button" tabindex="0" data-tooltip="${escHtml(t.summary)}" aria-label="${escHtml(tx('SR2E.Interp.markLabel', { title: t.title }))}">†</a>`;
}

/** A card's line of † links for the interpretations it rests on ('' for none; unknown ids and repeats dropped). */
export function interpLine(ids: Iterable<string>): string {
  const seen = [...new Set([...ids].filter((i) => INTERP_IDS.has(i)))];
  if (!seen.length) return '';
  const links = seen.map((id) => {
    const t = interpText(id);
    return `<a class="sr2e-interp" data-sr2e-interp="${escHtml(id)}" role="button" tabindex="0" data-tooltip="${escHtml(t.summary)}">† ${escHtml(t.title)}</a>`;
  }).join(' · ');
  return `<p class="sr2e-interp-line">${tx('SR2E.Interp.lineHead')} ${links}</p>`;
}

/**
 * The interpretations a test card rests on, read from its snapshot (pure; only fields the system wrote, and only ids
 * the registry has). The switch being back at the old way leaves the entry out where that is known here.
 */
export function interpsForSnapshot(snap: any, rules: any): string[] {
  const out: string[] = [];
  if (!snap || typeof snap !== 'object') return out;
  const l = snap.learn;
  if (l) {
    if (l.foreign) out.push('otherTradition');
    if (Number(l.extraDice ?? 0) > 0) out.push('teacher');
    if (ruleValue(rules, 'FORMULA_V918.required') === 'on' && l.from && !l.spellId) out.push('formulaRequired');
  }
  if (snap.teach) out.push('teacher');
  if (snap.narrow?.layers) out.push('magicPoolLayers');
  if (snap.narrow?.rating) out.push('narrowCasting');
  return out;
}

/** The interpretations a find card rests on: legality counted, a contact's help, a fixer. */
export function interpsForFind(o: { legalityCounts: boolean; through: string; retried?: boolean }): string[] {
  const out: string[] = [];
  if (o.legalityCounts) out.push('legalityFind');
  if (o.through === 'help') out.push('contactHelp');
  if (o.through === 'fixer') out.push('fixer');
  if (o.retried) out.push('findRetry');
  return out;
}
