/**
 * v0.93.4: sorting and filtering a sheet's lists (skills, weapons, spells, gear…). Pure: the sheet passes each row's
 * name and number (its rating, Force or quantity, when it has one) and gets the order back. "Sheet" is the order the
 * sheet drew; the other orders keep it among equal rows.
 */
export const SORT_MODES = ['sheet', 'name', 'nameDesc', 'value'] as const;
export type SortMode = typeof SORT_MODES[number];

export interface SortRow { name: string; value: number | null }

export function isSortMode(v: unknown): v is SortMode { return (SORT_MODES as readonly string[]).includes(String(v)); }

/** The next order on a click: sheet → A–Z → Z–A → highest number first (only when the rows have numbers) → sheet. */
export function nextSort(mode: SortMode, hasValue: boolean): SortMode {
  if (mode === 'sheet') return 'name';
  if (mode === 'name') return 'nameDesc';
  if (mode === 'nameDesc') return hasValue ? 'value' : 'sheet';
  return 'sheet';
}

const collator = typeof Intl !== 'undefined' ? new Intl.Collator(undefined, { sensitivity: 'base', numeric: true }) : null;
function cmpName(a: string, b: string): number {
  return collator ? collator.compare(a.trim(), b.trim()) : a.trim().toLowerCase().localeCompare(b.trim().toLowerCase());
}

/** The rows' indices in the given order (stable: equal rows keep the sheet's order). */
export function sortRows(rows: SortRow[], mode: SortMode): number[] {
  const idx = rows.map((_, i) => i);
  if (mode === 'sheet') return idx;
  return idx.sort((i, j) => {
    const a = rows[i]!, b = rows[j]!;
    let c = 0;
    if (mode === 'name') c = cmpName(a.name, b.name);
    else if (mode === 'nameDesc') c = cmpName(b.name, a.name);
    else {
      // Highest first; rows without a number go last.
      const av = a.value ?? Number.NEGATIVE_INFINITY, bv = b.value ?? Number.NEGATIVE_INFINITY;
      c = bv === av ? cmpName(a.name, b.name) : bv > av ? 1 : -1;
    }
    return c || i - j;
  });
}

/** Whether any row has a number to sort by. */
export function rowsHaveValue(rows: SortRow[]): boolean { return rows.some((r) => r.value !== null && Number.isFinite(r.value)); }

/** A list long enough to get its own filter box. */
export const LIST_FILTER_MIN = 10;
/** A list long enough to get the sort button. */
export const LIST_SORT_MIN = 3;
