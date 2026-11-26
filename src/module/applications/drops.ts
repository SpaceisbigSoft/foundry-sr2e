/**
 * v0.59.0: items dropped on an actor's sheet.
 * - They arrive not installed, not bonded and not loaded: cyberware needs surgery (or the Installed box),
 *   a focus needs bonding (Good Karma), a program needs loading. A GM holding Shift drops it as it is.
 * - Gear dragged from one actor to another moves (the giver loses it); hold Alt to copy. Skills, spells,
 *   powers and programs are knowledge and always copy.
 * - v0.93.0: a stack (quantity over 1) asks how many move; the rest stay with the giver, and the moved ones join a
 *   matching stack the receiver already has.
 * - Each actor type takes only the item types it can use.
 */
import { SYSTEM_ID } from "../config/system.ts";
import { approvalNeeded, fileRequest } from "./approvals.ts";
import { rowAmount } from "../rules/catalogue.ts";
import { escHtml } from "../rules/html.ts";
import { t as tx } from '../helpers/i18n.ts';
import { giveByDrop } from './trade942.ts';

export const ALL_ITEM_TYPES = ['skill', 'weapon', 'armor', 'gear', 'cyberware', 'spell', 'power', 'focus', 'adeptpower', 'cyberdeck', 'program'] as const;

/** Item types each actor type takes. */
export const ITEM_TYPES_FOR: Record<string, readonly string[]> = {
  character: ALL_ITEM_TYPES,
  npc: ALL_ITEM_TYPES,
  spirit: ['skill', 'weapon', 'armor', 'gear', 'spell', 'power', 'focus'],
  vehicle: ['weapon', 'gear', 'program'],
  ic: ['program'],
  // v0.94.2 (item 28): a safehouse holds physical items (its stash).
  host: [], barrier: [], site: [], safehouse: ['weapon', 'armor', 'gear', 'cyberware', 'focus', 'cyberdeck'],
};

/** Physical things that change hands (moved, not copied, between actors). */
export const PHYSICAL_ITEM_TYPES = ['weapon', 'armor', 'gear', 'cyberware', 'focus', 'cyberdeck'];

/** Pure: why an item type can't go on an actor type, or null. */
export function itemTypeProblem(actorType: string, itemType: string): string | null {
  const ok = ITEM_TYPES_FOR[actorType];
  if (!ok) return null;
  if (ok.includes(itemType)) return null;
  const label = actorType === 'npc' ? tx('SR2E.App.Drops.anNpc') : tx('SR2E.App.Drops.a', { actorType });
  return ok.length ? tx('SR2E.App.Drops.cantHoldAItTakes', { label, itemType, takes: ok.join(', ') }) : tx('SR2E.App.Drops.doesntHoldItems', { label });
}

/**
 * Pure: the system changes an item gets when it arrives on an actor by a drop: cyberware out, a focus
 * unbonded, a program unloaded (and not mid-load), armor not worn. Returns {} when nothing changes.
 */
export function arrivalReset(itemType: string, system: any): Record<string, unknown> {
  const s = system ?? {};
  const out: Record<string, unknown> = {};
  if (itemType === 'cyberware' && s.installed !== false) out['installed'] = false;
  if (itemType === 'focus' && s.bonded !== false) out['bonded'] = false;
  if (itemType === 'program' && s.loaded !== false) { out['loaded'] = false; out['loading'] = { round: -1, worldTime: -1 }; }
  if (itemType === 'armor' && s.worn !== false) out['worn'] = false;
  return out;
}

/** Pure: whether a drop from `source` should take the item away from it. */
export function dropMoves(itemType: string, o: { fromActor: boolean; sameActor: boolean; copyKey: boolean }): boolean {
  return o.fromActor && !o.sameActor && !o.copyKey && PHYSICAL_ITEM_TYPES.includes(itemType);
}

/** Pure (v0.93.0): a stack's size (its quantity, 1 when it has none). */
export function stackSize(system: any): number {
  const q = Number(system?.quantity ?? 1);
  return Number.isFinite(q) ? Math.max(0, Math.floor(q)) : 1;
}

/** Pure (v0.93.0): a "how many?" answer as a count from 1 to `have`; null when it isn't one. */
export function howManyAnswer(raw: unknown, have: number): number | null {
  const n = Math.floor(Number(raw));
  return Number.isFinite(n) && n >= 1 && n <= have ? n : null;
}

/**
 * Pure (v0.93.0): whether a moved stack can join one the receiver has: the same type and name, and the same data apart
 * from the quantity (so a damaged or modified copy stays apart).
 */
export function sameStack(a: { type?: string; name?: string; system?: any } | null | undefined, b: { type?: string; name?: string; system?: any } | null | undefined): boolean {
  if (!a || !b || a.type !== b.type || a.name !== b.name) return false;
  const strip = (sys: any) => { const { quantity: _q, ...rest } = sys ?? {}; return rest; };
  return stableJson(strip(a.system)) === stableJson(strip(b.system));
}

function stableJson(v: unknown): string {
  if (Array.isArray(v)) return '[' + v.map(stableJson).join(',') + ']';
  if (v && typeof v === 'object') return '{' + Object.keys(v as object).sort().map((k) => JSON.stringify(k) + ':' + stableJson((v as any)[k])).join(',') + '}';
  return JSON.stringify(v ?? null);
}

/** v0.93.0: ask how many of a stack move (all by default). Null = cancelled. */
export async function askHowMany(name: string, have: number): Promise<number | null> {
  const D: any = (foundry as any)?.applications?.api?.DialogV2;
  if (!D?.wait) return have;
  const r = await D.wait({
    window: { title: tx('SR2E.Dialog.Drops.howManyTitle', { name }) },
    content: `<div class="form-group"><label>${tx('SR2E.Dialog.Drops.howManyLabel', { have })}</label><input type="number" name="count" value="${have}" min="1" max="${have}" step="1" autofocus></div>`,
    buttons: [
      { action: 'ok', label: tx('SR2E.Dialog.Drops.howManyMove'), default: true, callback: (_e: any, button: any) => button?.form?.elements?.count?.value },
      { action: 'cancel', label: tx('SR2E.Dialog.Drops.howManyCancel') },
    ],
    rejectClose: false,
  });
  if (r === 'cancel' || r === null || r === undefined) return null;
  const n = howManyAnswer(r, have);
  if (n === null) ui.notifications?.warn?.(tx('SR2E.Notify.Drops.howManyBad', { have }));
  return n;
}

function describe(reset: Record<string, unknown>): string {
  const parts: string[] = [];
  if (reset['installed'] === false) parts.push(tx('SR2E.Card.Drops.notInstalledTickInstalledAfterSurgery'));
  if (reset['bonded'] === false) parts.push(tx('SR2E.Card.Drops.notBondedBondItForGood'));
  if (reset['loaded'] === false) parts.push(tx('SR2E.Card.Drops.notLoaded'));
  if (reset['worn'] === false) parts.push(tx('SR2E.Card.Drops.notWorn'));
  return parts.join(', ');
}

/**
 * The drop itself, for every actor sheet's `_onDropItem`. `fallback` is Foundry's own (used for sorting
 * an item within the same actor).
 */
export async function dropItemOnActor(sheet: any, event: DragEvent | any, item: any, fallback: () => Promise<any>): Promise<any> {
  const actor: any = sheet.actor;
  // v0.94.2 (item 28): the user's own item dropped on someone else's sheet is offered as a gift (applications/trade942.ts).
  if (actor && item && !actor.isOwner) return giveByDrop(item, actor);
  if (!actor?.isOwner || !item) return null;
  const source: any = item.parent ?? null;
  if (source?.uuid === actor.uuid) return fallback();
  const problem = itemTypeProblem(actor.type, item.type);
  if (problem) { ui.notifications?.warn?.(escHtml(problem)); return null; }
  const gm = Boolean((game as any).user?.isGM);
  const fromActor = Boolean(source && source.documentName === 'Actor');
  const moves = dropMoves(item.type, { fromActor, sameActor: false, copyKey: Boolean(event?.altKey) });
  if (moves && !source.isOwner) { ui.notifications?.warn?.(tx('SR2E.Notify.Drops.isSOnlyTheirOwnerOr', { itemName: escHtml(item.name), sourceName: escHtml(source.name) })); return null; }
  // v0.93.0: a stack asks how many move (Alt copies, and copies take the whole stack as before).
  let have = stackSize(item.system);
  let take = have;
  if (moves && have > 1) {
    const n = await askHowMany(item.name, have);
    if (n === null) return null;
    // Review 3: the stack may have changed while the dialog was open (spent, deleted, or moved from another sheet).
    const now: any = source.items?.get?.(item.id);
    if (!now) { ui.notifications?.warn?.(tx('SR2E.Notify.Drops.stackGone', { itemName: escHtml(item.name) })); return null; }
    have = stackSize(now.system);
    take = Math.min(n, have);
    if (take < 1) return null;
  }
  const keepId = !actor.items.has(item.id);
  const data: any = item.inCompendium ? (game as any).items.fromCompendium(item, { clearFolder: true, keepId }) : item.toObject();
  const asIs = gm && Boolean(event?.shiftKey);
  const reset = asIs ? {} : arrivalReset(item.type, data.system);
  if (Object.keys(reset).length) data.system = { ...(data.system ?? {}), ...reset };
  // v0.64.0: with the approval queue on, anything that isn't handed over by another character (the sidebar,
  // a compendium, a copy from another sheet) waits for the GM, as a free add from the Add window does.
  if (!moves && approvalNeeded(actor)) {
    delete data._id; delete data.folder; delete data.sort; delete data.ownership;
    await fileRequest(actor, { kind: 'add', label: tx('SR2E.App.Adding.addFree', { named: item.name }), data: { payment: 'free', ready: false, lines: [{ type: item.type, name: item.name, system: data.system ?? {}, amount: (() => { const r = rowAmount(item.type); return r.kind === 'value' && r.field ? Math.max(1, Number(data.system?.[r.field] ?? 1) || 1) : 1; })(), data }] } });
    return null;
  }
  if (take !== have) data.system = { ...(data.system ?? {}), quantity: take };
  // v0.93.0: moved items join a matching stack the receiver has (same data apart from the count).
  // Review 5: compared on the stored data (_source), as the moved copy is plain data; any item with a count merges.
  const counted = data.system && Object.hasOwn(data.system, 'quantity');
  const stack: any = moves && counted ? [...actor.items].find((i: any) => sameStack({ type: i.type, name: i.name, system: i._source?.system ?? i.system }, { type: item.type, name: item.name, system: data.system })) : null;
  const before = stack ? stackSize(stack.system) : 0;
  const made = stack
    ? (await stack.update({ 'system.quantity': before + take }), stack)
    : await (Item as any).implementation.create(data, { parent: actor, keepId, sr2eComplexFormFrom: item.uuid });
  if (!made) return null;
  if (moves) {
    // Part of a stack: the giver keeps the rest. Review 4: if the giver can't be changed, the receiver's side is undone.
    try { if (take < have) await item.update({ 'system.quantity': have - take }); else await source.deleteEmbeddedDocuments('Item', [item.id]); }
    catch (err) {
      console.warn('sr2e | move item', err);
      try { if (stack) await stack.update({ 'system.quantity': before }); else await made.delete(); } catch (err2) { console.warn('sr2e | move item undo', err2); }
      ui.notifications?.error?.(tx('SR2E.Notify.Drops.moveFailed', { itemName: escHtml(item.name) }));
      return null;
    }
  }
  const note = describe(reset);
  const what = moves ? tx('SR2E.Notify.Drops.handsTo', { source: source.name, made: take > 1 ? `${made.name} ×${take}` : made.name, actor: actor.name }) : tx('SR2E.Notify.Drops.addedTo', { made: made.name, actor: actor.name });
  ui.notifications?.info?.(`${escHtml(what)}${note ? `: ${note}` : ''}.`);
  return made;
}

/** Item creation on an actor that can't hold that type is refused, however it is made. */
export function registerItemTypeGuard(): void {
  Hooks.on('preCreateItem', (item: any, _data: any, options: any) => {
    const actor = item?.parent;
    if (!actor || actor.documentName !== 'Actor' || options?.[`${SYSTEM_ID}AnyType`]) return;
    const problem = itemTypeProblem(actor.type, item.type);
    if (!problem) return;
    ui.notifications?.warn?.(escHtml(problem));
    return false;
  });
}
