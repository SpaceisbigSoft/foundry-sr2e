/**
 * v0.93.5 (plan item 51, UI-1.2): pins by dragging, Foundry-free. The actor's `pins` flag keeps item ids (as since
 * v0.63.0) and, new, effect keys (`fx:…`: a row of the Effects view). A row dragged onto the pinned bar pins it there;
 * a pin dragged along the bar moves; a pin dragged off the bar (or its ✕) unpins it.
 */

export const PIN_MAX = 12;
/** The drag data type of an effect row or a pin (items keep Foundry's own `{ type: 'Item', uuid }`). */
export const PIN_DRAG_TYPE = 'sr2ePin';
const FX = 'fx:';

export function isEffectPin(key: string): boolean { return String(key ?? '').startsWith(FX); }

/** An Effects-view row's pin key: a token status by its id, anything else by its group and name. */
export function effectPinKey(row: { group?: string; name?: string; statusId?: string }): string {
  if (row.statusId) return `${FX}s:${String(row.statusId).slice(0, 60)}`;
  const part = (s: unknown) => String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 60);
  return `${FX}${part(row.group)}:${part(row.name)}`;
}

function listOf(pins: unknown): string[] {
  return Array.isArray(pins) ? [...new Set(pins.map(String).filter(Boolean))] : [];
}

/**
 * Pin `key` before `before` (null: at the end). A pin already there moves; a new one past PIN_MAX is refused
 * (`full`). `drop` says which keys no longer exist (an item deleted) and are tidied away on the way.
 */
export function placePin(pins: unknown, key: string, before: string | null, drop: (k: string) => boolean = () => false, shown: (k: string) => boolean = () => true): { pins: string[]; full: boolean } {
  let list = listOf(pins).filter((k) => !drop(k));
  if (!key) return { pins: list, full: false };
  const had = list.includes(key);
  // v0.93.5 review: only the pins on show count towards PIN_MAX (an effect that has ended keeps its key, unseen, so
  // it shows again when it comes back); past twice that, the oldest unseen keys make room.
  if (!had && list.filter(shown).length >= PIN_MAX) return { pins: list, full: true };
  while (!had && list.length >= PIN_MAX * 2) {
    const old = list.findIndex((k) => !shown(k));
    if (old < 0) return { pins: list, full: true };
    list = list.filter((_, i) => i !== old);
  }
  // Dropped on itself: it stays where it is.
  if (had && before === key) return { pins: list, full: false };
  const rest = list.filter((k) => k !== key);
  const at = before ? rest.indexOf(before) : -1;
  if (at < 0) rest.push(key); else rest.splice(at, 0, key);
  return { pins: rest, full: false };
}

export function unpin(pins: unknown, key: string): string[] {
  return listOf(pins).filter((k) => k !== key);
}

/**
 * What a drop on this actor's sheet means for its pins: the key it pins, or null (not one of this actor's own
 * rows: the sheet's normal drop goes on). Items come as Foundry's drag data (their uuid inside this actor);
 * `pinnable` says whether this actor has that item and it can be pinned.
 */
export function pinKeyOfDrop(data: any, actorUuid: string, pinnable: (id: string) => boolean): { key: string; fromBar: boolean } | null {
  if (!data || typeof data !== 'object' || !actorUuid) return null;
  if (data.type === PIN_DRAG_TYPE) {
    if (String(data.actorUuid ?? '') !== actorUuid) return null;
    const key = String(data.key ?? '');
    return key ? { key, fromBar: Boolean(data.fromBar) } : null;
  }
  if (data.type === 'Item' && typeof data.uuid === 'string') {
    const prefix = `${actorUuid}.Item.`;
    if (!data.uuid.startsWith(prefix)) return null;
    const id = data.uuid.slice(prefix.length);
    if (!/^[A-Za-z0-9]{1,32}$/.test(id) || !pinnable(id)) return null;
    return { key: id, fromBar: Boolean(data.sr2ePinBar) };
  }
  return null;
}

export interface PinItem { id: string; type: string; name: string }
export interface PinEffect { key: string; name: string; detail?: string }
export interface PinAct { action: string; verb: string; icon: string }

/**
 * The pinned bar's buttons, in the pins' order: an item by its action (`act`: the v0.63.0 pin actions; an item with
 * none isn't pinnable), an effect row by its name (it jumps to the Effects view). Keys whose item or effect is gone
 * aren't shown (an effect that comes back, such as Full Defense, shows again).
 */
export function pinButtons(pins: unknown, items: PinItem[], effects: PinEffect[], act: (type: string) => PinAct | null): Array<{ key: string; kind: 'item' | 'effect'; id: string; name: string; action: string; verb: string; icon: string; detail: string }> {
  const byId = new Map(items.map((i) => [i.id, i]));
  const byKey = new Map(effects.map((e) => [e.key, e]));
  const out: ReturnType<typeof pinButtons> = [];
  for (const key of listOf(pins).slice(0, PIN_MAX)) {
    if (isEffectPin(key)) {
      const e = byKey.get(key);
      if (e) out.push({ key, kind: 'effect', id: '', name: e.name, action: 'jumpTo', verb: '', icon: 'fa-solid fa-flask', detail: String(e.detail ?? '') });
      continue;
    }
    const i = byId.get(key);
    const a = i ? act(i.type) : null;
    if (!i || !a) continue;
    out.push({ key, kind: 'item', id: i.id, name: i.name, action: a.action, verb: a.verb, icon: a.icon, detail: '' });
  }
  return out;
}
