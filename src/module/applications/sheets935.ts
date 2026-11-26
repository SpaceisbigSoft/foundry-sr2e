/**
 * v0.93.5 "interface polish": what runs after each actor sheet render for
 * - greyed actions (plan item 48): a button marked `data-sr2e-unavailable` (aria-disabled, its reason in Foundry's
 *   tooltip) does nothing when clicked, so the reason is all it gives;
 * - the action bar's More… (the visual review): in a narrow window the rest of the bar opens as a small panel under
 *   the button (Enter / Space opens it, the arrow keys move along it, Esc or a click outside closes it);
 * - pins by dragging (plan item 51): drag a skill, weapon, spell, power or effect row onto the pinned bar to pin it, a pin along
 *   the bar to move it, off the bar (or its ✕) to unpin it; Alt+← / Alt+→ move a pin from the keyboard. Owners only.
 * The rules are in rules/actions935.ts and rules/pins935.ts.
 */
import { SYSTEM } from '../config/system.ts';
import { PIN_DRAG_TYPE, pinKeyOfDrop, placePin, unpin, isEffectPin } from '../rules/pins935.ts';
import { pinAction } from '../rules/catalogue.ts';
import { t as tx } from '../helpers/i18n.ts';
import { escHtml } from '../rules/html.ts';

function dragData(ev: DragEvent): any {
  try { return JSON.parse(ev.dataTransfer?.getData('text/plain') ?? ''); } catch { return null; }
}

/** The pins as stored; an item key whose item is gone is tidied away on the next change. */
function storedPins(actor: any): string[] {
  const p = actor.getFlag?.(SYSTEM.id, 'pins');
  return Array.isArray(p) ? p.map(String) : [];
}
function gone(actor: any): (k: string) => boolean {
  return (k) => !isEffectPin(k) && !actor.items?.get?.(k);
}
/** v0.93.5 review: the keys the pinned bar shows now (the ones that count towards the limit). */
export function shownPins(root: ParentNode | null | undefined): (k: string) => boolean {
  const keys = new Set(Array.from(root?.querySelectorAll<HTMLElement>('.sr2e-pinbar .sr2e-pin-chip') ?? []).map((c) => c.dataset['pinKey'] ?? ''));
  return (k) => keys.has(k);
}

async function savePins(actor: any, pins: string[]): Promise<void> {
  if (!actor.isOwner) return;
  await actor.setFlag(SYSTEM.id, 'pins', pins);
}

/** Greyed buttons: a click (or Enter / Space, which click) stops before the sheet's action handler. */
function blockUnavailable(body: HTMLElement): void {
  if (body.dataset['sr2eUnavailBound']) return;
  body.dataset['sr2eUnavailBound'] = '1';
  body.addEventListener('click', (ev) => {
    const el = (ev.target as HTMLElement | null)?.closest?.('[data-sr2e-unavailable]');
    if (!el) return;
    ev.preventDefault();
    ev.stopImmediatePropagation();
  }, true);
}

/** The More… panel of the action bar (it only shows in a narrow window; the wide bar shows every button). */
function actionBarMenu(body: HTMLElement): void {
  const bar = body.querySelector<HTMLElement>('.sr2e-actionbar');
  const wrap = bar?.querySelector<HTMLElement>('.sr2e-qa-more-wrap');
  const btn = wrap?.querySelector<HTMLButtonElement>('.sr2e-qa-more-btn');
  const panel = wrap?.querySelector<HTMLElement>('.sr2e-qa-rest');
  if (!bar || !wrap || !btn || !panel || wrap.dataset['sr2eBound']) return;
  wrap.dataset['sr2eBound'] = '1';
  const items = () => Array.from(panel.querySelectorAll<HTMLElement>('button'));
  bar.classList.toggle('sr2e-qa-nomore', !items().length);
  const isOpen = () => wrap.classList.contains('sr2e-qa-open');
  const set = (open: boolean, focus: 'first' | 'button' | null = null) => {
    wrap.classList.toggle('sr2e-qa-open', open);
    btn.setAttribute('aria-expanded', String(open));
    if (open && focus === 'first') items()[0]?.focus();
    if (!open && focus === 'button') btn.focus();
  };
  btn.addEventListener('click', (ev) => { ev.preventDefault(); ev.stopPropagation(); set(!isOpen(), isOpen() ? null : 'first'); });
  wrap.addEventListener('keydown', (ev) => {
    if (!isOpen()) return;
    if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); set(false, 'button'); return; }
    if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp' || ev.key === 'ArrowRight' || ev.key === 'ArrowLeft' || ev.key === 'Home' || ev.key === 'End') {
      const list = items();
      if (!list.length) return;
      const at = list.indexOf(document.activeElement as HTMLElement);
      const next = ev.key === 'Home' ? 0 : ev.key === 'End' ? list.length - 1 : (at + ((ev.key === 'ArrowDown' || ev.key === 'ArrowRight') ? 1 : -1) + list.length) % list.length;
      ev.preventDefault();
      list[next]?.focus();
    }
  });
  // Leaving it (Tab, a click elsewhere) closes it; a button in it closes it once used.
  wrap.addEventListener('focusout', (ev) => { const to = ev.relatedTarget as Node | null; if (isOpen() && to && !wrap.contains(to)) set(false); });
  body.addEventListener('pointerdown', (ev) => { if (isOpen() && !wrap.contains(ev.target as Node)) set(false); });
  panel.addEventListener('click', (ev) => { if ((ev.target as HTMLElement).closest('button:not([data-sr2e-unavailable])')) setTimeout(() => set(false), 0); });
}

/** Where a drop on the bar goes: before the pin under the pointer (its right half: after it), else at the end. */
function dropBefore(bar: HTMLElement, ev: DragEvent): string | null {
  const chip = (ev.target as HTMLElement | null)?.closest?.<HTMLElement>('.sr2e-pin-chip');
  if (!chip || !bar.contains(chip)) return null;
  const r = chip.getBoundingClientRect();
  const after = r.width > 0 && ev.clientX > r.left + r.width / 2;
  if (!after) return chip.dataset['pinKey'] ?? null;
  const next = chip.nextElementSibling as HTMLElement | null;
  return next?.classList.contains('sr2e-pin-chip') ? next.dataset['pinKey'] ?? null : null;
}

function pinDrag(sheet: any, body: HTMLElement): void {
  const actor: any = sheet.document;
  const bar = body.querySelector<HTMLElement>('[data-sr2e-pinbar]');
  if (!bar || !actor?.isOwner) return;
  const uuid = String(actor.uuid ?? '');
  // The empty bar shows while one of this sheet's rows is dragged.
  if (!body.dataset['sr2ePinDragBound']) {
    body.dataset['sr2ePinDragBound'] = '1';
    body.addEventListener('dragstart', () => body.classList.add('sr2e-pin-dragging'));
    body.addEventListener('dragend', () => { body.classList.remove('sr2e-pin-dragging'); bar.classList.remove('sr2e-pin-over'); });
  }
  // Effects-view rows: dragged as a pin (they aren't documents).
  for (const li of Array.from(body.querySelectorAll<HTMLElement>('.sr2e-effects li[data-pin-key]'))) {
    const key = li.dataset['pinKey'];
    if (!key || li.draggable) continue;
    li.draggable = true;
    li.addEventListener('dragstart', (ev) => { ev.dataTransfer?.setData('text/plain', JSON.stringify({ type: PIN_DRAG_TYPE, actorUuid: uuid, key })); });
    // v0.93.5 review: a pin toggle on the row too, so an effect can be pinned without dragging (keyboard users).
    const pinned = storedPins(actor).includes(key);
    const name = li.querySelector('strong')?.textContent ?? '';
    const tog = document.createElement('a');
    tog.className = 'sr2e-fx-pin';
    tog.setAttribute('role', 'button');
    tog.tabIndex = 0;
    tog.setAttribute('aria-pressed', String(pinned));
    const tip = pinned ? tx('SR2E.UI.unpinNamed', { name }) : tx('SR2E.UI.pinItToTheTopOf');
    tog.setAttribute('aria-label', tip);
    tog.dataset['tooltip'] = escHtml(tip);
    tog.innerHTML = '<i class="fa-solid fa-thumbtack" aria-hidden="true"></i>';
    const go = (ev: Event) => {
      ev.preventDefault(); ev.stopPropagation();
      if (storedPins(actor).includes(key)) { void savePins(actor, unpin(storedPins(actor), key)); return; }
      const r = placePin(storedPins(actor), key, null, gone(actor), shownPins(body));
      if (r.full) { ui.notifications?.warn?.(tx('SR2E.Notify.Sheet.pinsFull')); return; }
      void savePins(actor, r.pins);
    };
    tog.addEventListener('click', go);
    tog.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') go(ev); });
    li.appendChild(tog);
  }
  // The pins: dragged along the bar, or off it.
  for (const chip of Array.from(bar.querySelectorAll<HTMLElement>('.sr2e-pin-chip'))) {
    const key = chip.dataset['pinKey'];
    if (!key) continue;
    chip.draggable = true;
    chip.addEventListener('dragstart', (ev) => {
      ev.stopPropagation();
      body.classList.add('sr2e-pin-dragging');
      ev.dataTransfer?.setData('text/plain', JSON.stringify({ type: PIN_DRAG_TYPE, actorUuid: uuid, key, fromBar: true }));
      if (ev.dataTransfer) ev.dataTransfer.effectAllowed = 'move';
    });
    // Alt+← / Alt+→ on a pin moves it (the keyboard's way of dragging).
    chip.addEventListener('keydown', (ev) => {
      if (!ev.altKey || (ev.key !== 'ArrowLeft' && ev.key !== 'ArrowRight')) return;
      ev.preventDefault();
      const keys = Array.from(bar.querySelectorAll<HTMLElement>('.sr2e-pin-chip')).map((c) => c.dataset['pinKey'] ?? '');
      const at = keys.indexOf(key);
      const before = ev.key === 'ArrowLeft' ? keys[at - 1] ?? keys[0] ?? null : keys[at + 2] ?? null;
      if (ev.key === 'ArrowLeft' && at <= 0) return;
      if (ev.key === 'ArrowRight' && at >= keys.length - 1) return;
      sheet._sr2eFocusPin = key;
      void savePins(actor, placePin(storedPins(actor), key, before, gone(actor), shownPins(body)).pins);
    });
  }
  if (sheet._sr2eFocusPin) {
    bar.querySelector<HTMLElement>(`.sr2e-pin-chip[data-pin-key="${CSS.escape(String(sheet._sr2eFocusPin))}"] > button`)?.focus();
    sheet._sr2eFocusPin = null;
  }
  // The ✕.
  for (const x of Array.from(bar.querySelectorAll<HTMLElement>('[data-sr2e-unpin]'))) {
    const go = (ev: Event) => { ev.preventDefault(); ev.stopPropagation(); void savePins(actor, unpin(storedPins(actor), x.dataset['sr2eUnpin'] ?? '')); };
    x.addEventListener('click', go);
    x.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') go(ev); });
  }
  // A pinned effect: the Effects tab opens (jumpTo), then its row is shown.
  for (const b of Array.from(bar.querySelectorAll<HTMLElement>('[data-sr2e-pin-effect]'))) {
    b.addEventListener('click', () => {
      const key = b.dataset['sr2ePinEffect'] ?? '';
      setTimeout(() => {
        const row = (sheet.element as HTMLElement | null)?.querySelector<HTMLElement>(`.sr2e-effects li[data-pin-key="${CSS.escape(key)}"]`);
        if (!row) return;
        row.scrollIntoView({ block: 'center', behavior: 'smooth' });
        row.classList.add('sr2e-flash');
        setTimeout(() => row.classList.remove('sr2e-flash'), 1600);
      }, 50);
    });
  }
  bar.addEventListener('dragover', (ev) => { ev.preventDefault(); bar.classList.add('sr2e-pin-over'); if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'copy'; });
  bar.addEventListener('dragleave', (ev) => { if (!bar.contains(ev.relatedTarget as Node | null)) bar.classList.remove('sr2e-pin-over'); });
  bar.addEventListener('drop', (ev) => {
    bar.classList.remove('sr2e-pin-over');
    body.classList.remove('sr2e-pin-dragging');
    const hit = pinKeyOfDrop(dragData(ev), uuid, (id) => Boolean(pinAction(String(actor.items?.get?.(id)?.type ?? ''))));
    // Not one of this actor's rows (an item from elsewhere): the sheet's own drop goes on.
    if (!hit) return;
    ev.preventDefault();
    ev.stopPropagation();
    const r = placePin(storedPins(actor), hit.key, dropBefore(bar, ev), gone(actor), shownPins(body));
    if (r.full) { ui.notifications?.warn?.(tx('SR2E.Notify.Sheet.pinsFull')); return; }
    void savePins(actor, r.pins);
  });
}

/**
 * The sheet's own drop (sheets.ts `_onDrop`): a pin dragged off the bar onto the rest of its own sheet is unpinned.
 * Returns whether the drop was a pin's (the sheet then does nothing else with it).
 */
export async function pinDropOnSheet(sheet: any, data: any): Promise<boolean> {
  if (data?.type !== PIN_DRAG_TYPE) return false;
  const actor: any = sheet.document;
  if (!actor?.isOwner || String(data.actorUuid ?? '') !== String(actor.uuid) || !data.fromBar) return true;
  await savePins(actor, unpin(storedPins(actor), String(data.key ?? '')));
  return true;
}

/** After each actor sheet render (character, NPC, spirit, vehicle). */
export function decorateSheet935(sheet: any): void {
  const root: HTMLElement | null = sheet?.element ?? null;
  const body = root?.querySelector<HTMLElement>('.sr2e-sheet');
  if (!root || !body) return;
  try { blockUnavailable(body); } catch (err) { console.warn('sr2e | greyed actions', err); }
  try { actionBarMenu(body); } catch (err) { console.warn('sr2e | action bar', err); }
  try { pinDrag(sheet, body); } catch (err) { console.warn('sr2e | pins', err); }
}
