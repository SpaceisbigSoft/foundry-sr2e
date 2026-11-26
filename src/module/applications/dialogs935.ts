/**
 * v0.93.5 ("interface polish", agent A): roll-dialog helpers the sheets' dialogs call (applications/sheets.ts).
 *
 * - `wireFireModeRows`: the attack window's rows for one firing mode only (the full-auto rounds, the full-auto spray
 *   list) show only while that mode is chosen; hidden rows keep what was entered in them.
 * - `senseChecksHtml`: the Perception modifier boxes (Sneak, Perceive) grouped by sense with headings, the rarely
 *   used groups folded (open when a box in them is ticked), the box and its label aligned.
 */
import { t as tx, tKey } from '../helpers/i18n.ts';
import { escHtml } from '../rules/html.ts';
import { fireRowShown, groupSenseRows, stripSenseLead, type SenseGroup } from '../rules/cards935.ts';

/** The attribute that marks a row for some firing modes only (`data-sr2e-fire-modes="FA"`). */
export const FIRE_MODES_ATTR = 'data-sr2e-fire-modes';

/** v0.93.5: show the rows for the chosen firing mode, hide the others (their values stay). */
export function applyFireModeRows(root: ParentNode, mode: string | null | undefined): void {
  root.querySelectorAll<HTMLElement>(`[${FIRE_MODES_ATTR}]`).forEach((el) => {
    el.hidden = !fireRowShown(el.getAttribute(FIRE_MODES_ATTR), mode);
  });
}

/**
 * v0.93.5: wire a dialog's firing-mode select (`select[name]`, default "mode") to its mode-only rows. Call it once
 * the form has its remembered choices (after applyPrefs), so the rows match the mode shown.
 */
export function wireFireModeRows(root: ParentNode | null | undefined, selectName = 'mode'): void {
  if (!root) return;
  const select = root.querySelector<HTMLSelectElement>(`select[name="${selectName}"]`);
  if (!select) { applyFireModeRows(root, null); return; }
  const sync = () => applyFireModeRows(root, select.value);
  sync();
  if (select.dataset['sr2eFireWired']) return;
  select.dataset['sr2eFireWired'] = '1';
  select.addEventListener('change', sync);
}

const GROUP_KEY: Readonly<Record<SenseGroup, string>> = {
  observer: 'SR2E.Dialog.Sense.observer', sound: 'SR2E.Dialog.Sense.sound', smell: 'SR2E.Dialog.Sense.smell',
  touch: 'SR2E.Dialog.Sense.touch', taste: 'SR2E.Dialog.Sense.taste', other: 'SR2E.Dialog.Sense.other',
};

/**
 * v0.93.5: the Perception modifier boxes by sense, named `<prefix>-<id>` like tableChecks's (so checkedIds reads
 * them the same way). `ticked` pre-ticks rows (and opens their group).
 */
export function senseChecksHtml(table: ReadonlyArray<{ id: string; label: string; value: number }>, prefix: string, ticked: ReadonlySet<string> = new Set()): string {
  const box = (m: { id: string; label: string; value: number }) =>
    `<label class="sr2e-check sr2e-sense-row"><input type="checkbox" name="${escHtml(prefix)}-${escHtml(m.id)}"${ticked.has(m.id) ? ' checked' : ''}> <span>${escHtml(stripSenseLead(m.label))} (${m.value > 0 ? '+' : ''}${escHtml(m.value)})</span></label>`;
  const groups = groupSenseRows(table, ticked).map((g) => {
    const rows = `<div class="sr2e-sense-rows">${g.rows.map(box).join('')}</div>`;
    if (!g.collapsible) return `<div class="sr2e-sense-group" data-sense="${g.group}"><h4 class="sr2e-sense-head">${escHtml(tKey(GROUP_KEY[g.group]))}</h4>${rows}</div>`;
    return `<details class="sr2e-sense-group" data-sense="${g.group}"${g.open ? ' open' : ''}><summary class="sr2e-sense-head">${escHtml(tKey(GROUP_KEY[g.group]))} <span class="sr2e-sense-count">(${g.rows.length})</span></summary>${rows}</details>`;
  }).join('');
  return `<fieldset class="sr2e-situational sr2e-senses"><legend>${tx('SR2E.Dialog.Sheet.modifiers')}</legend>${groups}</fieldset>`;
}
