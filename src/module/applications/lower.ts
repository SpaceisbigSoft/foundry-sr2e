/**
 * v0.93.0 (the owner's decision 7, plan item 4): right-click lowers a value by one, on the controls a click raises or sets:
 * condition-monitor boxes (Physical, Stun, Overflow, a vehicle's damage, an IC's monitor), pool pips, the − / + pairs (a
 * track's steps, the GM panel's boxes), number fields with − / + (quantity and the other play numbers) and a weapon's
 * rounds. The − / + buttons and the click stay as the other way. Shift + right-click keeps the browser's own menu.
 *
 * It works through the controls that are already there (it clicks the box or button that lowers the value), so every
 * permission and undo path stays the click's. Only the rounds have no such control: they are written here, on the
 * sheet's own actor, by its owner.
 */

/** What a right-click on `target` does: click a control, step a number field down, take one round, or nothing. */
export type LowerStep =
  | { kind: 'click'; el: HTMLElement }
  | { kind: 'input'; el: HTMLInputElement }
  | { kind: 'ammo'; itemId: string }
  | null;

/** The containers a box's track lives in (the sheet's tracks, the vehicle's damage row, the monitor groups). */
const TRACK_HOLDERS = '.sr2e-cm-track, .sr2e-track, .sr2e-cm';

const valueOf = (el: Element): number => Number((el as HTMLElement).dataset?.['value'] ?? NaN);

/** The filled control with the highest value among `all`, or null when none is filled. */
function lastFilled(all: readonly HTMLElement[]): HTMLElement | null {
  let best: HTMLElement | null = null;
  for (const el of all) {
    if (!el.classList.contains('filled') || !Number.isFinite(valueOf(el))) continue;
    if (!best || valueOf(el) > valueOf(best)) best = el;
  }
  return best;
}

/**
 * Pure over the DOM (v0.93.0): what a right-click on `target` lowers. A box or pip: the last filled one in its track or pool
 * (clicking the last filled one clears it, so the value goes down by one). A control with `data-delta`: its pair's −1. A
 * number field in a stepper, or the stepper's button, or one matching `fields`: the field. A weapon's rounds (`data-sr2e-lower="ammo"`): that weapon.
 */
export function lowerStep(target: Element | null | undefined, fields = ''): LowerStep {
  const t = target as HTMLElement | null;
  if (!t?.closest) return null;
  const ammo = t.closest<HTMLElement>('[data-sr2e-lower="ammo"][data-item-id]');
  if (ammo) return { kind: 'ammo', itemId: String(ammo.dataset['itemId'] ?? '') };
  const box = t.closest<HTMLElement>('.sr2e-box[data-action][data-value], .sr2e-pip[data-action][data-value]');
  if (box) {
    // Review 1: the whole monitor first (the Overflow row is a track of its own, with data-track="physical"), so a box
    // in the main row finds the last filled Overflow box too; the data-track filter keeps Stun apart.
    const holder = box.classList.contains('sr2e-pip') ? box.closest('.sr2e-strip-pool') : (box.closest('.sr2e-cm') ?? box.closest(TRACK_HOLDERS));
    const action = box.dataset['action'] ?? '';
    const track = box.dataset['track'], pool = box.dataset['pool'];
    const all = Array.from(holder?.querySelectorAll<HTMLElement>(`[data-action="${cssWord(action)}"][data-value]`) ?? [box])
      .filter((b) => b.dataset['track'] === track && b.dataset['pool'] === pool);
    const last = lastFilled(all);
    return last ? { kind: 'click', el: last } : null;
  }
  const delta = t.closest<HTMLElement>('[data-action][data-delta]');
  if (delta) {
    if (Number(delta.dataset['delta']) < 0) return { kind: 'click', el: delta };
    const action = delta.dataset['action'] ?? '';
    const down = Array.from(delta.parentElement?.querySelectorAll<HTMLElement>(`[data-action="${cssWord(action)}"][data-delta]`) ?? [])
      .find((b) => Number(b.dataset['delta']) < 0 && b.dataset['track'] === delta.dataset['track'] && b.dataset['uuid'] === delta.dataset['uuid']);
    return down ? { kind: 'click', el: down } : null;
  }
  const stepper = t.closest<HTMLElement>('.sr2e-stepper');
  // A field without − / + (the steppers setting is off) still lowers when it is one of the play numbers (`fields`).
  const inStepper = (stepper?.querySelector('input[type="number"]') ?? null) as HTMLInputElement | null;
  const listed = fields && t.tagName === 'INPUT' && (t as HTMLInputElement).type === 'number' && t.matches(fields) ? t as HTMLInputElement : null;
  const input = inStepper ?? listed;
  return input ? { kind: 'input', el: input } : null;
}

/** An action or pool name as it may sit in a selector (they are plain words; anything else matches nothing). */
function cssWord(s: string): string {
  return /^[A-Za-z][\w-]{0,60}$/.test(s) ? s : '__none__';
}

/** Pure (v0.93.0): a number field's value one step down (its step, never under its min); null when it can't go lower. */
export function stepDown(value: string, o: { step?: string; min?: string }): string | null {
  const step = o.step && o.step !== 'any' && Number(o.step) > 0 ? Number(o.step) : 1;
  const min = o.min === undefined || o.min === '' ? null : Number(o.min);
  const v = Number(value);
  if (!Number.isFinite(v)) return null;
  let next = Math.round((v - step) * 1e6) / 1e6;
  if (min !== null && Number.isFinite(min) && next < min) next = min;
  return next < v ? String(next) : null;
}

/** Pure (v0.93.0): a weapon's rounds after one is taken; null when there is none to take (or the weapon tracks none). */
export function ammoDown(sys: { ammo?: unknown; ammoMax?: unknown } | null | undefined): number | null {
  const ammo = Math.floor(Number(sys?.ammo ?? 0)), max = Number(sys?.ammoMax ?? 0);
  return max > 0 && ammo > 0 ? ammo - 1 : null;
}

/** Do one step. Returns whether anything was lowered (the browser's menu is then kept shut). */
export async function doLower(step: LowerStep, actor: any): Promise<boolean> {
  if (!step) return false;
  if (step.kind === 'click') { step.el.click(); return true; }
  if (step.kind === 'input') {
    const el = step.el;
    if (el.readOnly || el.disabled) return false;
    const down = el.closest('.sr2e-stepper')?.querySelector<HTMLElement>('.sr2e-step-down');
    if (down) { down.click(); return true; }
    const next = stepDown(el.value, { step: el.step, min: el.min });
    if (next === null) return true;
    el.value = next;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }
  const item: any = actor?.items?.get?.(step.itemId);
  if (!item || !(item.isOwner ?? actor?.isOwner)) return false;
  const next = ammoDown(item.system);
  if (next !== null) await item.update({ 'system.ammo': next });
  return true;
}

/**
 * Bind right-click on a rendered window body (once). `actor` = the sheet's actor (for the rounds), or null; `fields` = the
 * number fields that lower without − / + buttons.
 */
export function bindLower(scope: HTMLElement | null | undefined, actor: any = null, fields = ''): void {
  if (!scope || scope.dataset['sr2eLower']) return;
  scope.dataset['sr2eLower'] = '1';
  scope.addEventListener('contextmenu', (ev: MouseEvent) => {
    if (ev.shiftKey) return;
    const step = lowerStep(ev.target as Element, fields);
    if (!step) return;
    ev.preventDefault();
    ev.stopPropagation();
    void doLower(step, actor).catch((err) => console.warn('sr2e | right-click to lower', err));
  });
}
