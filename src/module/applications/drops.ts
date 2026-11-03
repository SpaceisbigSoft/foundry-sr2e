/**
 * v0.59.0: items dropped on an actor's sheet.
 * - They arrive not installed, not bonded and not loaded: cyberware needs surgery (or the Installed box),
 *   a focus needs bonding (Good Karma), a program needs loading. A GM holding Shift drops it as it is.
 * - Gear dragged from one actor to another moves (the giver loses it); hold Alt to copy. Skills, spells,
 *   powers and programs are knowledge and always copy.
 * - Each actor type takes only the item types it can use.
 */
import { SYSTEM_ID } from "../config/system.ts";
import { approvalNeeded, fileRequest } from "./approvals.ts";
import { rowAmount } from "../rules/catalogue.ts";
import { escHtml } from "../rules/html.ts";
import { t as tx } from '../helpers/i18n.ts';

export const ALL_ITEM_TYPES = ['skill', 'weapon', 'armor', 'gear', 'cyberware', 'spell', 'power', 'focus', 'adeptpower', 'cyberdeck', 'program'] as const;

/** Item types each actor type takes. */
export const ITEM_TYPES_FOR: Record<string, readonly string[]> = {
  character: ALL_ITEM_TYPES,
  npc: ALL_ITEM_TYPES,
  spirit: ['skill', 'weapon', 'armor', 'gear', 'spell', 'power', 'focus'],
  vehicle: ['weapon', 'gear', 'program'],
  ic: ['program'],
  host: [], barrier: [], site: [], safehouse: [],
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
  if (!actor?.isOwner || !item) return null;
  const source: any = item.parent ?? null;
  if (source?.uuid === actor.uuid) return fallback();
  const problem = itemTypeProblem(actor.type, item.type);
  if (problem) { ui.notifications?.warn?.(escHtml(problem)); return null; }
  const gm = Boolean((game as any).user?.isGM);
  const fromActor = Boolean(source && source.documentName === 'Actor');
  const moves = dropMoves(item.type, { fromActor, sameActor: false, copyKey: Boolean(event?.altKey) });
  if (moves && !source.isOwner) { ui.notifications?.warn?.(tx('SR2E.Notify.Drops.isSOnlyTheirOwnerOr', { itemName: escHtml(item.name), sourceName: escHtml(source.name) })); return null; }
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
  const made = await (Item as any).implementation.create(data, { parent: actor, keepId, sr2eComplexFormFrom: item.uuid });
  if (!made) return null;
  if (moves) {
    try { await source.deleteEmbeddedDocuments('Item', [item.id]); } catch (err) { console.warn('sr2e | move item', err); }
  }
  const note = describe(reset);
  const what = moves ? tx('SR2E.Notify.Drops.handsTo', { source: source.name, made: made.name, actor: actor.name }) : tx('SR2E.Notify.Drops.addedTo', { made: made.name, actor: actor.name });
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
