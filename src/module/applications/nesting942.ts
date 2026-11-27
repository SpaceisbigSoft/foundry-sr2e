/**
 * v0.94.2 (plan items 39 and 44): the Foundry side of nested items (rules/nesting942.ts).
 *  - Attaching: drop an item's row onto another row of the same sheet, or onto the parent item's own sheet, or use the
 *    "Put in…" control on the row. Accessories go on weapons, programs on decks, weapons/armor/gear into containers;
 *    an ammunition clip dropped on a gun loads it (the reload's own action and clip count).
 *  - The sheets: children are shown nested under their parent's row (containers fold), with a detach control; the
 *    item sheet lists what is attached or inside, sets an item up as a container or accessory, and converts a weapon's
 *    accessory fields into items and back. Safehouses get a stash list.
 *  - Bookkeeping: a deleted parent's children are detached (free items), a parent moved to another actor by a drop
 *    takes its children along, a duplicated weapon copies its accessories. Packing a weapon holsters it and packing
 *    armor takes it off; drawing or wearing it takes it out again.
 *  - API (game.sr2e.api.nesting): helpers for macros and the trading code (children, family, detach all, attach,
 *    conversions for many weapons). Nothing converts by itself: the conversion runs only when asked.
 */
import { SYSTEM, SYSTEM_ID } from '../config/system.ts';
import { t as tx, tKey } from '../helpers/i18n.ts';
import { clearFlagUpdate } from '../helpers/flags.ts';
import { escHtml } from '../rules/html.ts';
import { madeHere } from './leader.ts';
import { isCarried } from '../rules/tweaks.ts';
import { reloadActionKind, reloadActionLabel } from '../rules/docs79-ranged.ts';
import {
  NEST_FLAG, ACCESSORY_KINDS, ACCESSORY_KIND_KEYS, OPTION_KEYS, KIND_OPTIONS, RATED_KINDS,
  readLink, linkValue, resolveParent, lookupOf, childrenOf, descendantsOf, linkedTo, canNest, parentChoices,
  accessoryOf, isContainer, isAmmoClip, containerLoad, conversionPlan, conversionClears, revertUpdate, remapLinks, withoutLink,
  nestData, type LinkKind, type NestItem,
} from '../rules/nesting942.ts';

const NS = SYSTEM_ID;
const itemsOf = (actor: any): any[] => [...(actor?.items ?? [])];
const notify = (kind: 'info' | 'warn', text: string): void => { try { (ui as any).notifications?.[kind]?.(text); } catch { /* no UI */ } };
/** The drag data type the sheets' rows use. */
const PLAIN_TEXT = 'text' + '/plain';
const fa = (icon: string): string => `<i class="fa-solid ${icon}" inert></i>`;

/** The client setting `nestOnDrop`: dropping a row onto another row of the same sheet attaches it (else it sorts, as before). */
export function nestOnDrop(): boolean {
  try { return (game as any).settings.get(SYSTEM_ID, 'nestOnDrop') !== false; } catch { return true; }
}

// ---------------------------------------------------------------------------------------------------------------------
// Small helpers (also the API the trading code uses)
// ---------------------------------------------------------------------------------------------------------------------

/** An item's children whose link holds (on its own actor). */
export function listChildren(item: any, kind?: LinkKind): any[] {
  return item?.parent ? childrenOf(item.id, itemsOf(item.parent), kind) : [];
}

/** An item and everything under it (children, their children...), parent first. */
export function familyOf(item: any): any[] {
  return item?.parent ? [item, ...descendantsOf(item.id, itemsOf(item.parent))] : item ? [item] : [];
}

/** The parent an item sits on now (null: free, or its link dangles). */
export function parentOf(item: any): { parent: any; kind: LinkKind } | null {
  return item?.parent ? resolveParent(item, lookupOf(item.parent.items)) : null;
}

/** The update entries that clear an item's link (merge into a larger update). */
export function detachUpdate(item: any): Record<string, unknown> {
  return clearFlagUpdate(item, NEST_FLAG);
}

/** Make an item free again. */
export async function detach(item: any): Promise<boolean> {
  if (!item?.isOwner || !readLink(item)) return false;
  await item.update(detachUpdate(item));
  return true;
}

/** Detach everything linked to an item (valid or dangling links). Returns how many. */
export async function detachAll(item: any): Promise<number> {
  const actor = item?.parent;
  if (!actor?.isOwner) return 0;
  const kids = linkedTo(item.id, itemsOf(actor)).filter((c: any) => actor.items.has(c.id));
  if (!kids.length) return 0;
  await actor.updateEmbeddedDocuments('Item', kids.map((c: any) => ({ _id: c.id, ...detachUpdate(c) })));
  return kids.length;
}

/** Put `child` on `parent` (same actor). Packing a weapon holsters it, packing armor takes it off. */
export async function attach(child: any, parent: any, o: { quiet?: boolean } = {}): Promise<boolean> {
  const actor = child?.parent;
  if (!actor || parent?.parent !== actor || !child.isOwner) return false;
  const kind = canNest(child, parent, itemsOf(actor));
  if (!kind) { if (!o.quiet) notify('warn', tx('SR2E.Gear942.cantGoThere', { child: child.name, parent: parent.name })); return false; }
  const update: Record<string, unknown> = { [`flags.${NS}.${NEST_FLAG}`]: linkValue(parent.id, kind) };
  if (kind === 'inside' && child.type === 'weapon' && child._source?.system?.ready) update['system.ready'] = false;
  if (kind === 'inside' && child.type === 'armor' && child._source?.system?.worn) update['system.worn'] = false;
  await child.update(update);
  if (o.quiet) return true;
  notify('info', kind === 'inside' ? tx('SR2E.Gear942.putIn', { child: child.name, parent: parent.name }) : tx('SR2E.Gear942.mountedOn', { child: child.name, parent: parent.name }));
  if (kind === 'inside') {
    const load = containerLoad(parent, itemsOf(actor));
    if (load.over) notify('warn', tx('SR2E.Gear942.overCapacity', { name: parent.name, kg: load.kg, capacity: load.capacity }));
  }
  return true;
}

// ---------------------------------------------------------------------------------------------------------------------
// Ammunition: a clip dropped on a gun
// ---------------------------------------------------------------------------------------------------------------------

/** Load a clip into a gun (the sheet's Reload with that clip: its action, the jam cleared, one clip used). */
export async function loadClip(actor: any, weapon: any, clip: any): Promise<boolean> {
  if (!actor?.isOwner || weapon?.type !== 'weapon' || !isAmmoClip(clip)) return false;
  const ws = weapon.system ?? {};
  if (!(Number(ws.ammoMax) > 0)) { notify('warn', tx('SR2E.Gear942.noMagazine', { name: weapon.name })); return false; }
  const feed = String(ws.feed ?? 'clip');
  if (feed !== 'clip' && feed !== 'belt') { notify('warn', tx('SR2E.Gear942.notAClipFeed', { name: weapon.name })); return false; }
  if (!(Number(clip.system.quantity ?? 0) > 0)) { notify('warn', tx('SR2E.Gear942.noClipsLeft', { name: clip.name })); return false; }
  if (!isCarried(clip)) { notify('warn', tx('SR2E.Gear942.clipLeftBehind', { name: clip.name })); return false; }
  const kind = reloadActionKind(feed, { smartgun: Boolean(ws.smartgun && actor.system?.derived?.smartlink) });
  if (typeof actor.useAction === 'function' && !(await actor.useAction(kind, tx('SR2E.Card.Sheet.reloading', { weaponName: weapon.name, reloadActionLabel: reloadActionLabel(kind) })))) return false;
  const rounds = Number(clip.system.rounds) > 0 ? Math.min(Number(ws.ammoMax), Number(clip.system.rounds)) : Number(ws.ammoMax);
  await weapon.update({ 'system.ammo': rounds, 'system.ammoType': clip.system.ammoType, ...(ws.jammed ? { 'system.jammed': false } : {}) });
  await clip.update({ 'system.quantity': Math.max(0, Number(clip.system.quantity) - 1) });
  notify('info', tx('SR2E.Gear942.loaded', { weapon: weapon.name, clip: clip.name, rounds }));
  return true;
}

// ---------------------------------------------------------------------------------------------------------------------
// Accessory fields ⇄ accessory items
// ---------------------------------------------------------------------------------------------------------------------

/** An accessory item's name (its kind, with its rating or option). */
export function accessoryName(step: { kind: string; rating: number; option: string }): string {
  const base = tKey(ACCESSORY_KIND_KEYS[step.kind] ?? '');
  const extra = [step.rating > 0 ? String(step.rating) : '', step.option ? tKey(OPTION_KEYS[step.option] ?? '') : ''].filter(Boolean).join(', ');
  return extra ? tx('SR2E.Gear942.nameWith', { name: base, extra }) : base;
}

/**
 * "Make accessory items": the weapon's accessory fields become attached gear items (made first), then the fields are
 * cleared, so its effective values never change. Returns how many items were made. Undo: `accessoryItemsToFields`.
 */
export async function makeAccessoryItems(weapon: any, o: { quiet?: boolean } = {}): Promise<number> {
  return onceAtATime(weapon, () => makeAccessoryItemsNow(weapon, o));
}

/**
 * v0.94.2 (lead, test plan): weapons being converted or reverted right now on this client (by uuid). A second click while
 * the first is still writing does nothing, and the work reads the weapon again from its actor once it has the slot.
 */
const converting = new Set<string>();
async function onceAtATime(weapon: any, fn: () => Promise<number>): Promise<number> {
  const key = String(weapon?.uuid ?? weapon?.id ?? '');
  if (!key || converting.has(key)) return 0;
  converting.add(key);
  try { return await fn(); } finally { converting.delete(key); }
}

async function makeAccessoryItemsNow(weaponIn: any, o: { quiet?: boolean }): Promise<number> {
  const weapon = weaponIn?.parent?.items?.get?.(weaponIn.id) ?? weaponIn;
  const actor = weapon?.parent;
  if (weapon?.type !== 'weapon' || !actor || !weapon.isOwner) return 0;
  const plan = conversionPlan(weapon._source?.system ?? weapon.system);
  if (!plan.length) { if (!o.quiet) notify('info', tx('SR2E.Gear942.nothingToConvert', { name: weapon.name })); return 0; }
  const data = plan.map((step) => ({
    name: accessoryName(step), type: 'gear',
    system: { quantity: 1, weight: 0, carried: true, nest942: { container: false, capacity: 0, accessory: step.kind, rating: step.rating, option: step.option } },
    flags: { [NS]: { [NEST_FLAG]: linkValue(weapon.id, 'mounted', true) } },
  }));
  const made: any[] = (await actor.createEmbeddedDocuments('Item', data)) ?? [];
  if (made.length !== data.length) return made.length;
  await weapon.update(conversionClears(plan));
  if (!o.quiet) notify('info', tx('SR2E.Gear942.converted', { name: weapon.name, n: made.length }));
  return made.length;
}

/** "Back to fields": the accessory items a conversion made go back into the weapon's fields and are deleted. */
export async function accessoryItemsToFields(weapon: any, o: { quiet?: boolean } = {}): Promise<number> {
  return onceAtATime(weapon, () => accessoryItemsToFieldsNow(weapon, o));
}

async function accessoryItemsToFieldsNow(weaponIn: any, o: { quiet?: boolean }): Promise<number> {
  const weapon = weaponIn?.parent?.items?.get?.(weaponIn.id) ?? weaponIn;
  const actor = weapon?.parent;
  if (weapon?.type !== 'weapon' || !actor || !weapon.isOwner) return 0;
  // v0.94.2 review (finding 13): only what the weapon gets from them now (nestDerived942 skips damaged or used-up
  // accessories): those stay items, so "Back to fields" never gives the gun a part it doesn't have.
  const kids = listChildren(weapon, 'mounted').filter((c: any) => readLink(c)?.conv && accessoryOf(c) && !c.system?.damaged && Number(c.system?.quantity ?? 1) > 0);
  if (!kids.length) return 0;
  const update = revertUpdate(weapon._source?.system ?? {}, kids.map((c: any) => accessoryOf(c)));
  if (Object.keys(update).length) await weapon.update(update);
  await actor.deleteEmbeddedDocuments('Item', kids.map((c: any) => c.id));
  if (!o.quiet) notify('info', tx('SR2E.Gear942.reverted', { name: weapon.name, n: kids.length }));
  return kids.length;
}

/** The weapons to convert: those of the actors given (default: every actor in the world), owned by this user. */
function weaponsOf(actors?: any[] | null): any[] {
  const list = actors?.length ? actors : [...((game as any).actors ?? [])];
  return list.flatMap((a: any) => itemsOf(a).filter((i: any) => i.type === 'weapon' && i.isOwner));
}

/** Convert many weapons (GM): `game.sr2e.api.nesting.convertAccessories(actors?)`. Returns { weapons, items }. */
export async function convertAccessories(actors?: any[] | null): Promise<{ weapons: number; items: number }> {
  if (!(game as any).user?.isGM) { notify('warn', tx('SR2E.Gear942.gmOnly')); return { weapons: 0, items: 0 }; }
  let weapons = 0; let items = 0;
  for (const w of weaponsOf(actors)) {
    const n = await makeAccessoryItems(w, { quiet: true });
    if (n) { weapons++; items += n; }
  }
  notify('info', tx('SR2E.Gear942.convertedMany', { weapons, items }));
  return { weapons, items };
}

/** The conversion's undo for many weapons (GM): `game.sr2e.api.nesting.revertAccessories(actors?)`. */
export async function revertAccessories(actors?: any[] | null): Promise<{ weapons: number; items: number }> {
  if (!(game as any).user?.isGM) { notify('warn', tx('SR2E.Gear942.gmOnly')); return { weapons: 0, items: 0 }; }
  let weapons = 0; let items = 0;
  for (const w of weaponsOf(actors)) {
    const n = await accessoryItemsToFields(w, { quiet: true });
    if (n) { weapons++; items += n; }
  }
  notify('info', tx('SR2E.Gear942.revertedMany', { weapons, items }));
  return { weapons, items };
}

/** The GM tool: convert every world actor's weapons, or take the conversion back (asks first). */
export async function openConversionTool(): Promise<void> {
  if (!(game as any).user?.isGM) return;
  const DialogV2: any = (foundry as any).applications.api.DialogV2;
  const pending = weaponsOf(null).filter((w: any) => conversionPlan(w._source?.system ?? w.system).length).length;
  const made = weaponsOf(null).filter((w: any) => listChildren(w, 'mounted').some((c: any) => readLink(c)?.conv)).length;
  const r = await DialogV2.wait({
    window: { title: tx('SR2E.Gear942.toolTitle') },
    content: `<p>${escHtml(tx('SR2E.Gear942.toolBody', { pending, made }))}</p><p class="hint">${escHtml(tx('SR2E.Gear942.toolHint'))}</p>`,
    buttons: [
      { action: 'convert', label: tx('SR2E.Gear942.toolConvert'), default: true },
      { action: 'revert', label: tx('SR2E.Gear942.toolRevert') },
      { action: 'cancel', label: tx('SR2E.Gear942.cancel') },
    ],
    rejectClose: false,
  });
  if (r === 'convert') await convertAccessories(null);
  else if (r === 'revert') await revertAccessories(null);
}

// ---------------------------------------------------------------------------------------------------------------------
// Moving and duplicating
// ---------------------------------------------------------------------------------------------------------------------

/**
 * A parent moved to another actor takes its children along (accessories stay on the gun, the bag keeps its contents):
 * copies are made on `target` under `newParentId` (ids kept where free) and the originals removed from `source`.
 * Returns how many moved.
 */
export async function carryChildren(source: any, oldParentId: string, target: any, newParentId: string, reset?: (type: string, system: any) => Record<string, unknown>): Promise<number> {
  const c = await copyChildren(source, oldParentId, target, newParentId, reset);
  // v0.94.2 review (finding 1): only the children whose copies were made leave the giver (a refused one stays, and is
  // detached when its parent goes).
  const gone = c.sourceIds.filter((id: string) => source.items.has(id));
  if (gone.length) await source.deleteEmbeddedDocuments('Item', gone);
  return c.made.length;
}

/**
 * The first half of `carryChildren`: copies of a parent's children made on `target` under `newParentId`, nothing removed
 * from `source`. `kids` are the children found (on the source), `made` the copies, `sourceIds` the originals whose copy
 * was made (the caller removes them from the source once the parent itself has left it).
 */
export async function copyChildren(source: any, oldParentId: string, target: any, newParentId: string, reset?: (type: string, system: any) => Record<string, unknown>, given?: any[]): Promise<{ kids: any[]; made: any[]; sourceIds: string[] }> {
  if (!source?.isOwner || !target || source === target) return { kids: [], made: [], sourceIds: [] };
  const kids = given ?? descendantsOf(oldParentId, itemsOf(source));
  if (!kids.length) return { kids, made: [], sourceIds: [] };
  const idMap = new Map<string, string>([[oldParentId, newParentId]]);
  const randomID = (foundry as any).utils.randomID as () => string;
  const data = kids.map((k: any) => {
    const d: any = k.toObject();
    const id = target.items.has(d._id) ? randomID() : d._id;
    idMap.set(d._id, id);
    d._id = id;
    if (reset) d.system = { ...(d.system ?? {}), ...reset(k.type, d.system) };
    return d;
  });
  const made: any[] = (await target.createEmbeddedDocuments('Item', remapLinks(data, idMap), { keepId: true })) ?? [];
  const madeIds = new Set(made.map((d: any) => String(d?.id ?? d?._id ?? '')));
  return { kids, made, sourceIds: kids.map((k: any) => String(k.id)).filter((id: string) => madeIds.has(idMap.get(id) ?? id)) };
}

/** A copy's data before it is made: a copy of an attached accessory or program arrives free (a copy in a bag stays in it). */
export function duplicateData<T extends { flags?: any }>(data: T): T {
  return readLink(data)?.kind === 'mounted' ? withoutLink(data) : data;
}

/** After a weapon (or deck) is duplicated: its attached accessories (or programs) are copied onto the copy. */
export async function duplicateChildren(actor: any, original: any, copy: any): Promise<number> {
  if (!actor?.isOwner || !original || !copy) return 0;
  const kids = listChildren(original, 'mounted');
  if (!kids.length) return 0;
  const data = kids.map((k: any) => { const d: any = k.toObject(); delete d._id; return d; });
  const made = await actor.createEmbeddedDocuments('Item', remapLinks(data, new Map([[original.id, copy.id]])));
  return made?.length ?? 0;
}

// ---------------------------------------------------------------------------------------------------------------------
// Drops
// ---------------------------------------------------------------------------------------------------------------------

/** The item a drop landed on: the row (li) under the pointer, by its own item link. */
function rowItemAt(actor: any, target: any): any {
  const li = target?.closest?.('li');
  if (!li) return null;
  const a = li.querySelector(':scope > a[data-action="editItem"][data-item-id], :scope > a[data-sr2e-nest-edit][data-item-id]') as HTMLElement | null;
  const id = a?.dataset?.['itemId'];
  return id ? actor?.items?.get?.(id) ?? null : null;
}

/**
 * A drop of an item of this same actor onto another row (actor sheets: drops.ts calls this first). True when it was
 * handled (attached or loaded), false to let the drop sort as before.
 */
export async function nestDropOnRow(sheet: any, event: any, item: any): Promise<boolean> {
  try {
    const actor = sheet?.actor ?? sheet?.document;
    if (!nestOnDrop() || !actor || item?.parent !== actor) return false;
    const target = rowItemAt(actor, event?.target);
    if (!target || target.id === item.id) return false;
    if (target.type === 'weapon' && isAmmoClip(item)) { await loadClip(actor, target, item); return true; }
    if (canNest(item, target, itemsOf(actor))) { await attach(item, target); return true; }
    return false;
  } catch (err) { console.warn('sr2e | nesting drop', err); return false; }
}

/** After an item from elsewhere is dropped onto a row: attach the new copy there when it fits. */
export async function nestAfterForeignDrop(sheet: any, event: any, made: any): Promise<void> {
  try {
    const actor = sheet?.actor ?? sheet?.document;
    if (!nestOnDrop() || !actor || made?.parent !== actor) return;
    const target = rowItemAt(actor, event?.target);
    if (target && target.id !== made.id && canNest(made, target, itemsOf(actor))) await attach(made, target);
  } catch (err) { console.warn('sr2e | nesting drop', err); }
}

/** A drop on an item's own sheet: an item of the same actor goes on it. */
async function dropOnItemSheet(parent: any, event: DragEvent): Promise<void> {
  const TE: any = (foundry as any).applications?.ux?.TextEditor?.implementation;
  let data: any = null;
  try { data = TE?.getDragEventData?.(event) ?? null; } catch { data = null; }
  if (data?.type !== 'Item' || !data.uuid) return;
  const child: any = await (globalThis as any).fromUuid?.(data.uuid);
  if (!child || child.id === parent.id) return;
  if (!parent.parent || child.parent !== parent.parent) { notify('warn', tx('SR2E.Gear942.sameActorOnly')); return; }
  if (parent.type === 'weapon' && isAmmoClip(child)) { await loadClip(parent.parent, parent, child); return; }
  await attach(child, parent);
}

/** The "Put in… / Mount on…" picker for an item (or take it out). */
export async function putInDialog(item: any): Promise<void> {
  const actor = item?.parent;
  if (!actor?.isOwner) return;
  const choices = parentChoices(item, itemsOf(actor));
  const now = parentOf(item);
  const DialogV2: any = (foundry as any).applications.api.DialogV2;
  const pick = await DialogV2.prompt({
    window: { title: tx('SR2E.Gear942.putInTitle', { name: item.name }) },
    content: `<div class="form-group"><label>${escHtml(tx('SR2E.Gear942.putInLabel'))}</label><select name="parent"><option value="">${escHtml(tx('SR2E.Gear942.free'))}</option>${choices.map((c) => `<option value="${escHtml(c.item.id)}"${now?.parent?.id === c.item.id ? ' selected' : ''}>${escHtml(c.item.name)} (${escHtml(c.kind === 'inside' ? tx('SR2E.Gear942.kindInside') : tx('SR2E.Gear942.kindMounted'))})</option>`).join('')}</select></div>`,
    ok: { label: tx('SR2E.Gear942.ok'), callback: (_e: Event, b: any) => String(b.form.elements.parent.value ?? '') },
    rejectClose: false,
  });
  if (pick === null || pick === undefined) return;
  if (!pick) { if (await detach(item)) notify('info', tx('SR2E.Gear942.detached', { name: item.name })); return; }
  const parent = actor.items.get(pick);
  if (parent && parent.id !== now?.parent?.id) await attach(item, parent);
}

// ---------------------------------------------------------------------------------------------------------------------
// Actor sheets: nested rows
// ---------------------------------------------------------------------------------------------------------------------

/** Containers folded on this client (by item uuid). */
const folded = new Set<string>();
const wired = new WeakSet<HTMLElement>();

/** The item rows of a rendered actor sheet: id → its li (the first row whose own edit link names the item). */
function itemRows(actor: any, root: HTMLElement): Map<string, HTMLElement> {
  const rows = new Map<string, HTMLElement>();
  for (const a of Array.from(root.querySelectorAll('a[data-action="editItem"][data-item-id], a[data-sr2e-nest-edit][data-item-id]')) as HTMLElement[]) {
    const li = a.parentElement;
    const id = a.dataset['itemId'] ?? '';
    if (!li || li.tagName !== 'LI' || rows.has(id) || !actor.items.get(id)) continue;
    rows.set(id, li);
  }
  return rows;
}

function rowControl(li: HTMLElement, html: string): void {
  const del = li.querySelector(':scope > a[data-action="deleteItem"], :scope > span > a[data-action="deleteItem"]');
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  if (del?.parentElement) del.parentElement.insertBefore(tpl.content, del);
  else li.appendChild(tpl.content);
}

/** Nest the rows of a rendered actor sheet, and add the controls. */
export function decorateActorSheet(app: any, root: HTMLElement): void {
  const actor: any = app?.document;
  if (!actor?.items || !root) return;
  const items = itemsOf(actor);
  const lookup = lookupOf(actor.items);
  // A part rendered again brings fresh rows: a row nested by an earlier render that has a fresh copy goes.
  for (const old of Array.from(root.querySelectorAll('li.sr2e-nest942-child')) as HTMLElement[]) {
    const id = (old.querySelector(':scope > a[data-action="editItem"], :scope > a[data-sr2e-nest-edit]') as HTMLElement | null)?.dataset['itemId'];
    const fresh = id ? Array.from(root.querySelectorAll(`li > a[data-item-id="${id}"]`)).some((a) => !(a.parentElement as HTMLElement).classList.contains('sr2e-nest942-child') && (a as HTMLElement).dataset['action'] === 'editItem') : false;
    if (fresh) old.remove();
  }
  const rows = itemRows(actor, root);
  const editable = Boolean(actor.isOwner);
  // Rows can be dragged (vehicles and the stash too).
  for (const [id, li] of rows) {
    if (li.draggable) continue;
    const item = actor.items.get(id);
    li.draggable = true;
    li.addEventListener('dragstart', (ev: DragEvent) => { ev.dataTransfer?.setData(PLAIN_TEXT, JSON.stringify(item.toDragData?.() ?? { type: 'Item', uuid: item.uuid })); });
  }
  for (const item of items) {
    const li = rows.get(item.id);
    if (!li || li.querySelector(':scope > .sr2e-nest942-ctl')) continue;
    const up = resolveParent(item, lookup);
    const ctl: string[] = [];
    if (up && editable) ctl.push(`<a class="sr2e-nest942-ctl" data-sr2e-nest="detach" data-item-id="${escHtml(item.id)}" title="${escHtml(up.kind === 'inside' ? tx('SR2E.Gear942.takeOut') : tx('SR2E.Gear942.detach'))}">${fa('fa-link-slash')}</a>`);
    if (editable && parentChoices(item, items).length) ctl.push(`<a class="sr2e-nest942-ctl" data-sr2e-nest="put" data-item-id="${escHtml(item.id)}" title="${escHtml(tx('SR2E.Gear942.putInControl'))}">${fa('fa-box-open')}</a>`);
    if (isContainer(item)) {
      const load = containerLoad(item, items);
      const label = load.capacity ? tx('SR2E.Gear942.loadOf', { kg: load.kg, capacity: load.capacity }) : tx('SR2E.Gear942.load', { kg: load.kg });
      ctl.unshift(`<span class="sr2e-nest942-ctl sr2e-nest942-load${load.over ? ' sr2e-warn' : ''}" title="${escHtml(tx('SR2E.Gear942.contentsCount', { n: load.count }))}">${fa('fa-box')} ${escHtml(label)}</span>`);
    }
    if (ctl.length) rowControl(li, ctl.join(' '));
  }
  // Children under their parents (deepest chains work: a moved row takes its own nested list along).
  for (const item of items) {
    const up = resolveParent(item, lookup);
    if (!up) continue;
    const li = rows.get(item.id);
    const pli = rows.get(up.parent.id);
    if (!li || !pli || li === pli || li.contains(pli)) continue;
    let ul = pli.querySelector(':scope > ul.sr2e-nest942') as HTMLElement | null;
    if (!ul) {
      ul = document.createElement('ul');
      ul.className = 'sr2e-nest942';
      // A nested row's drag is its own (the parent row must not take it over).
      ul.addEventListener('dragstart', (ev) => ev.stopPropagation());
      pli.appendChild(ul);
      pli.classList.add('sr2e-nest942-parent');
      const uuid = String((up.parent as any).uuid ?? up.parent.id);
      if (folded.has(uuid)) pli.classList.add('sr2e-nest942-folded');
      const caret = document.createElement('a');
      caret.className = 'sr2e-nest942-fold';
      caret.dataset['sr2eNest'] = 'fold';
      caret.dataset['uuid'] = uuid;
      caret.setAttribute('role', 'button');
      caret.setAttribute('aria-expanded', folded.has(uuid) ? 'false' : 'true');
      caret.title = tx('SR2E.Gear942.fold');
      caret.innerHTML = fa('fa-caret-down');
      pli.insertBefore(caret, pli.firstChild);
    }
    li.classList.add('sr2e-nest942-child', `sr2e-nest942-${up.kind}`);
    ul.appendChild(li);
  }
  if (!wired.has(root)) {
    wired.add(root);
    root.addEventListener('click', (ev) => void onNestClick(app, ev));
    root.addEventListener('dragover', (ev) => { const li = (ev.target as HTMLElement)?.closest?.('li'); if (li && li.draggable) li.classList.add('sr2e-nest942-over'); });
    root.addEventListener('dragleave', (ev) => { (ev.target as HTMLElement)?.closest?.('li')?.classList.remove('sr2e-nest942-over'); });
    root.addEventListener('drop', () => { for (const el of Array.from(root.querySelectorAll('.sr2e-nest942-over'))) el.classList.remove('sr2e-nest942-over'); });
  }
}

async function onNestClick(app: any, ev: Event): Promise<void> {
  const el = (ev.target as HTMLElement)?.closest?.('[data-sr2e-nest], [data-sr2e-nest-edit]') as HTMLElement | null;
  if (!el) return;
  const doc: any = app?.document;
  const actor = doc?.documentName === 'Item' ? doc.parent : doc;
  const what = el.dataset['sr2eNest'] ?? (el.dataset['sr2eNestEdit'] !== undefined ? 'edit' : '');
  ev.preventDefault(); ev.stopPropagation();
  if (what === 'fold') {
    const uuid = el.dataset['uuid'] ?? '';
    const li = el.closest('li');
    if (folded.has(uuid)) folded.delete(uuid); else folded.add(uuid);
    li?.classList.toggle('sr2e-nest942-folded', folded.has(uuid));
    el.setAttribute('aria-expanded', folded.has(uuid) ? 'false' : 'true');
    return;
  }
  const item = actor?.items?.get?.(el.dataset['itemId'] ?? '');
  if (!item) return;
  if (what === 'edit') { item.sheet?.render?.(true); return; }
  if (what === 'detach') { if (await detach(item)) notify('info', tx('SR2E.Gear942.detached', { name: item.name })); return; }
  if (what === 'put') { await putInDialog(item); return; }
  if (what === 'delete' && actor.isOwner) {
    const DialogV2: any = (foundry as any).applications.api.DialogV2;
    const ok = await DialogV2.confirm({ window: { title: tx('SR2E.Gear942.deleteTitle') }, content: `<p>${escHtml(tx('SR2E.Gear942.deleteBody', { name: item.name }))}</p>`, rejectClose: false });
    if (ok) await item.delete();
    return;
  }
  if (what === 'convert') { await makeAccessoryItems(item); return; }
  if (what === 'revert') { await accessoryItemsToFields(item); return; }
}

/** Safehouses: a stash list (weapons, armor and gear kept there), nested like the other sheets. */
export function decorateSafehouseSheet(app: any, root: HTMLElement): void {
  const actor: any = app?.document;
  if (actor?.type !== 'safehouse' || !root) return;
  root.querySelector(':scope .sr2e-stash942')?.remove();
  const host = (root.querySelector('.window-content .sr2e-sheet') ?? root.querySelector('.window-content') ?? root) as HTMLElement;
  const items = itemsOf(actor).filter((i: any) => ['weapon', 'armor', 'gear'].includes(i.type));
  const row = (i: any): string => {
    const qty = Number(i.system?.quantity ?? 1) !== 1 ? `×${escHtml(i.system?.quantity)} · ` : '';
    const kg = escHtml(tx('SR2E.Gear942.kg', { kg: Number(i.system?.weight ?? 0) }));
    const del = actor.isOwner ? ` <a data-sr2e-nest="delete" data-item-id="${escHtml(i.id)}" title="${escHtml(tx('SR2E.Gear942.delete'))}">${fa('fa-trash')}</a>` : '';
    return `<li><a data-sr2e-nest-edit data-item-id="${escHtml(i.id)}">${escHtml(i.name)}</a> <span>${qty}${kg}</span>${del}</li>`;
  };
  const rows = items.map(row).join('');
  const section = document.createElement('section');
  section.className = 'sr2e-stash942';
  section.innerHTML = `<h3>${escHtml(tx('SR2E.Gear942.stash'))}</h3><p class="hint">${escHtml(tx('SR2E.Gear942.stashHint'))}</p><ul class="sr2e-list">${rows || `<li class="sr2e-empty"><em>${escHtml(tx('SR2E.Gear942.stashEmpty'))}</em></li>`}</ul>`;
  host.appendChild(section);
}

// ---------------------------------------------------------------------------------------------------------------------
// Item sheets
// ---------------------------------------------------------------------------------------------------------------------

/** The nesting part of an item sheet: where it sits, what is on or in it, and (gear) container or accessory set-up. */
export function itemSheetSection(item: any): string {
  const actor = item?.parent;
  const editable = Boolean(item?.isOwner);
  const parts: string[] = [];
  const up = parentOf(item);
  if (up) {
    parts.push(`<p class="sr2e-nest942-where">${escHtml(up.kind === 'inside' ? tx('SR2E.Gear942.isInside', { name: up.parent.name }) : tx('SR2E.Gear942.isMountedOn', { name: up.parent.name }))}${editable ? ` <button type="button" data-sr2e-nest="detach" data-item-id="${escHtml(item.id)}">${escHtml(up.kind === 'inside' ? tx('SR2E.Gear942.takeOut') : tx('SR2E.Gear942.detach'))}</button>` : ''}</p>`);
  } else if (actor && editable && parentChoices(item, itemsOf(actor)).length) {
    parts.push(`<p><button type="button" data-sr2e-nest="put" data-item-id="${escHtml(item.id)}">${fa('fa-box-open')} ${escHtml(tx('SR2E.Gear942.putInControl'))}</button></p>`);
  }
  if (item?.type === 'gear') {
    const d = nestData({ type: 'gear', system: item._source?.system ?? item.system });
    const kindOpts = ['', ...ACCESSORY_KINDS].map((k) => `<option value="${escHtml(k)}"${d.accessory === k ? ' selected' : ''}>${escHtml(k ? tKey(ACCESSORY_KIND_KEYS[k] ?? '') : tx('SR2E.Gear942.notAnAccessory'))}</option>`).join('');
    const opts = KIND_OPTIONS[d.accessory] ?? [];
    const optSel = opts.length ? `<label>${escHtml(tx('SR2E.Gear942.optionLabel'))} <select name="system.nest942.option">${opts.map((o) => `<option value="${escHtml(o)}"${d.option === o ? ' selected' : ''}>${escHtml(o ? tKey(OPTION_KEYS[o] ?? '') : tx('SR2E.Gear942.none'))}</option>`).join('')}</select></label>` : '';
    const rated = d.accessory && RATED_KINDS[d.accessory] ? `<label>${escHtml(tx('SR2E.Gear942.rating'))} <input type="number" name="system.nest942.rating" value="${escHtml(d.rating)}" min="0" max="${RATED_KINDS[d.accessory]}"></label>` : '';
    parts.push(`<div class="sr2e-row"><label title="${escHtml(tx('SR2E.Gear942.containerHint'))}">${escHtml(tx('SR2E.Gear942.container'))} <input type="checkbox" name="system.nest942.container"${d.container ? ' checked' : ''}></label>${d.container ? ` <label>${escHtml(tx('SR2E.Gear942.capacity'))} <input type="number" name="system.nest942.capacity" value="${escHtml(d.capacity)}" min="0" step="0.5"></label>` : ''}</div>`);
    parts.push(`<div class="sr2e-row"><label title="${escHtml(tx('SR2E.Gear942.accessoryHint'))}">${escHtml(tx('SR2E.Gear942.accessory'))} <select name="system.nest942.accessory">${kindOpts}</select></label> ${rated} ${optSel}</div>`);
  }
  const kids = listChildren(item);
  if (kids.length || isContainer(item) || item?.type === 'weapon' || item?.type === 'cyberdeck') {
    const head = isContainer(item) ? tx('SR2E.Gear942.contents') : item?.type === 'cyberdeck' ? tx('SR2E.Gear942.programsStored') : tx('SR2E.Gear942.attached');
    const list = kids.map((c: any) => `<li><a data-sr2e-nest-edit data-item-id="${escHtml(c.id)}">${escHtml(c.name)}</a>${editable ? ` <a data-sr2e-nest="detach" data-item-id="${escHtml(c.id)}" title="${escHtml(tx('SR2E.Gear942.detach'))}">${fa('fa-link-slash')}</a>` : ''}</li>`).join('');
    let extra = '';
    if (isContainer(item) && actor) {
      const load = containerLoad(item, itemsOf(actor));
      extra = `<p class="hint${load.over ? ' sr2e-warn' : ''}">${escHtml(load.capacity ? tx('SR2E.Gear942.loadOf', { kg: load.kg, capacity: load.capacity }) : tx('SR2E.Gear942.load', { kg: load.kg }))}</p>`;
    }
    if (item?.type === 'weapon' && editable && actor) {
      const canConvert = conversionPlan(item._source?.system ?? item.system).length > 0;
      const canRevert = kids.some((c: any) => readLink(c)?.conv);
      if (canConvert) extra += `<button type="button" data-sr2e-nest="convert" data-item-id="${escHtml(item.id)}" title="${escHtml(tx('SR2E.Gear942.convertHint'))}">${escHtml(tx('SR2E.Gear942.convert'))}</button> `;
      if (canRevert) extra += `<button type="button" data-sr2e-nest="revert" data-item-id="${escHtml(item.id)}" title="${escHtml(tx('SR2E.Gear942.revertHint'))}">${escHtml(tx('SR2E.Gear942.revert'))}</button>`;
      const from = item.system?.nest942Derived?.from ?? {};
      const gives = Object.keys(from).map((f) => `${escHtml(f)}: ${escHtml((from[f] ?? []).join(', '))}`).join('; ');
      if (gives) extra += `<p class="hint">${escHtml(tx('SR2E.Gear942.effective'))} ${gives}</p>`;
    }
    const hint = actor ? `<p class="hint">${escHtml(tx('SR2E.Gear942.dropHint'))}</p>` : '';
    parts.push(`<h4>${escHtml(head)}</h4><ul class="sr2e-list">${list || `<li class="sr2e-empty"><em>${escHtml(tx('SR2E.Gear942.nothing'))}</em></li>`}</ul>${extra}${hint}`);
  }
  if (!parts.length) return '';
  return `<fieldset class="sr2e-nest942-box"><legend>${escHtml(tx('SR2E.Gear942.legend'))}</legend>${parts.join('')}</fieldset>`;
}

export function decorateItemSheet(app: any, root: HTMLElement): void {
  const item: any = app?.document;
  if (!item || item.documentName !== 'Item' || !root) return;
  if (!['weapon', 'armor', 'gear', 'program', 'cyberdeck'].includes(item.type)) return;
  root.querySelector('.sr2e-nest942-box')?.remove();
  const html = itemSheetSection(item);
  if (html) {
    const host = (root.querySelector('.sr2e-sheet') ?? root.querySelector('.window-content') ?? root) as HTMLElement;
    const header = host.querySelector(':scope > header');
    const tpl = document.createElement('template');
    tpl.innerHTML = html;
    const after = host.querySelector(':scope > .sr2e-carried-row') ?? header;
    if (after?.nextSibling) host.insertBefore(tpl.content, after.nextSibling); else host.appendChild(tpl.content);
  }
  if (!wired.has(root)) {
    wired.add(root);
    root.addEventListener('click', (ev) => void onNestClick(app, ev));
    root.addEventListener('dragover', (ev) => { if (item.parent) ev.preventDefault(); });
    root.addEventListener('drop', (ev) => { if (!item.parent) return; ev.preventDefault(); void dropOnItemSheet(item, ev as DragEvent); });
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------------------------------------------------

const isOurs = (app: any): boolean => Array.isArray(app?.options?.classes) && app.options.classes.includes('sr2e');
const elementOf = (html: any, app: any): HTMLElement | null => (html instanceof HTMLElement ? html : html?.[0] ?? app?.element ?? null);

function tradeIsOn(): boolean {
  try { return (game as any).settings.get(SYSTEM_ID, 'tradeOn') !== false; } catch { return false; }
}

export function registerNesting942(): void {
  Hooks.on('renderActorSheetV2', (app: any, html: any) => {
    try {
      if (!isOurs(app)) return;
      const root = elementOf(html, app);
      if (!root) return;
      // v0.94.2 (lead): the trade work's stash list (draggable, Give to…) is the one shown; this one only when trading is off.
      if (app.document?.type === 'safehouse' && !tradeIsOn()) decorateSafehouseSheet(app, root);
      decorateActorSheet(app, root);
    } catch (err) { console.warn('sr2e | nested rows', err); }
  });
  Hooks.on('renderItemSheetV2', (app: any, html: any) => {
    try { if (isOurs(app)) { const root = elementOf(html, app); if (root) decorateItemSheet(app, root); } } catch (err) { console.warn('sr2e | nested item sheet', err); }
  });
  // A parent deleted: its children become free items (on the client that deleted it).
  Hooks.on('deleteItem', (item: any, options: any, userId: string) => {
    if (!madeHere(options, userId) || options?.[`${SYSTEM_ID}KeepLinks`]) return;
    const actor = item?.parent;
    if (!actor?.isOwner) return;
    const kids = linkedTo(item.id, itemsOf(actor)).filter((c: any) => actor.items.has(c.id));
    if (!kids.length) return;
    void actor.updateEmbeddedDocuments('Item', kids.map((c: any) => ({ _id: c.id, ...detachUpdate(c) })))
      .then(() => notify('info', tx('SR2E.Gear942.parentGone', { name: item.name, n: kids.length })))
      .catch((err: unknown) => console.warn('sr2e | detaching children', err));
  });
  // Packing holsters a weapon and takes armor off; drawing or wearing it takes it out of its container.
  Hooks.on('preUpdateItem', (item: any, changes: any) => {
    try {
      const fu: any = (foundry as any).utils;
      const flagChange = fu.getProperty(changes, `flags.${NS}.${NEST_FLAG}`);
      const link = flagChange && typeof flagChange === 'object' ? readLink({ flags: { [NS]: { [NEST_FLAG]: { ...(readLink(item) ?? {}), ...flagChange } } } }) : null;
      if (link?.kind === 'inside') {
        if (item.type === 'weapon') fu.setProperty(changes, 'system.ready', false);
        if (item.type === 'armor') fu.setProperty(changes, 'system.worn', false);
        return;
      }
      const own = flagChange === undefined ? readLink(item) : null;
      if (own?.kind !== 'inside' || !item.parent?.items?.get?.(own.parent)) return;
      const out = (item.type === 'weapon' && fu.getProperty(changes, 'system.ready') === true) || (item.type === 'armor' && fu.getProperty(changes, 'system.worn') === true);
      if (out) for (const [k, v] of Object.entries(detachUpdate(item))) fu.setProperty(changes, k, v);
    } catch (err) { console.warn('sr2e | nested update', err); }
  });
  Hooks.on('preCreateItem', (item: any, data: any) => {
    try {
      if (readLink(data)?.kind !== 'inside') return;
      if (item.type === 'weapon' && data?.system?.ready !== false) item.updateSource({ 'system.ready': false });
      if (item.type === 'armor' && data?.system?.worn !== false) item.updateSource({ 'system.worn': false });
    } catch (err) { console.warn('sr2e | nested create', err); }
  });
  // The API for macros and the trading code.
  Hooks.once('sr2e.ready', (api: any) => {
    if (!api || typeof api !== 'object') return;
    api.nesting = {
      listChildren, familyOf, parentOf, attach, detach, detachAll, detachUpdate, carryChildren, copyChildren, loadClip,
      makeAccessoryItems, accessoryItemsToFields, convertAccessories, revertAccessories, openConversionTool,
      flag: `flags.${SYSTEM.id}.${NEST_FLAG}`,
    };
  });
}

export type { NestItem };
