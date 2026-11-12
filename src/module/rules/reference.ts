/**
 * v0.92.1: the reference pane beside the sheet (the owner's choice, 2 Nov 2026, after a friend's view: a quick reference
 * library next to a flexible sheet). One search over the Catalogue's entries (what the user's shop shows), the guide's
 * topics (the rules notes) and the rules interpretations. Pure: the ranking; the window is applications/reference.ts.
 */
import { matchesSearch } from './catalogue.ts';

export type ReferenceKind = 'entry' | 'guide' | 'interp';

export interface ReferenceItem {
  kind: ReferenceKind;
  /** The Catalogue key, the guide topic id or the interpretation id. */
  id: string;
  /** For an entry: its item or actor type (the Catalogue tab). */
  type?: string;
  name: string;
  /** One short line under the name (an entry's summary, a topic's category). */
  detail: string;
  /** Searched too, not shown (a topic's headings and text, an interpretation's summary). */
  text?: string;
}

const lower = (s: unknown): string => String(s ?? '').toLowerCase();

/**
 * The results for a search: every word must be found (as in the Catalogue and the guide); a name that starts with the
 * search comes first, then a name holding it, then the rest; within each, entries before topics before interpretations,
 * then by name. At most `limit`, and nothing for an empty search (the pane shows its hint).
 */
export function referenceResults(query: string, items: readonly ReferenceItem[], o: { kinds?: ReadonlySet<ReferenceKind>; limit?: number } = {}): { results: ReferenceItem[]; total: number } {
  const q = lower(query).trim();
  if (!q) return { results: [], total: 0 };
  const order: Record<ReferenceKind, number> = { entry: 0, guide: 1, interp: 2 };
  const hits = items.filter((i) => (!o.kinds || o.kinds.has(i.kind)) && matchesSearch(`${i.name} ${i.detail} ${i.text ?? ''}`, q));
  const rank = (i: ReferenceItem): number => { const n = lower(i.name); return n.startsWith(q) ? 0 : n.includes(q) ? 1 : 2; };
  hits.sort((a, b) => rank(a) - rank(b) || order[a.kind] - order[b.kind] || a.name.localeCompare(b.name));
  const limit = Math.max(1, Math.floor(o.limit ?? 60));
  return { results: hits.slice(0, limit), total: hits.length };
}

/** Where the pane goes beside a sheet: to its right when it fits, else to its left, else over its right edge. */
export function referencePlace(sheet: { left: number; top: number; width: number; height: number }, screen: { width: number; height: number }, width = 340): { left: number; top: number; width: number; height: number } {
  const gap = 6;
  const right = sheet.left + sheet.width + gap;
  const left = right + width <= screen.width ? right : sheet.left - gap - width >= 0 ? sheet.left - gap - width : Math.max(0, screen.width - width);
  const height = Math.max(320, Math.min(sheet.height || 600, screen.height - Math.max(0, sheet.top)));
  return { left: Math.round(left), top: Math.round(Math.max(0, sheet.top)), width, height: Math.round(height) };
}

/** The drag data a Catalogue entry carries out of the pane (a sheet's drop opens the shop with it ticked). */
export const REFERENCE_DRAG_TYPE = 'SR2E.CatalogueEntry';
export function referenceDragData(e: { id: string; type?: string; name: string }): { type: string; key: string; entryType: string; name: string } {
  return { type: REFERENCE_DRAG_TYPE, key: String(e.id), entryType: String(e.type ?? ''), name: String(e.name ?? '') };
}
