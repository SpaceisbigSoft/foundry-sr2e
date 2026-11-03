/**
 * v0.91.0: the shop's Foundry glue. The Add window is the shop: its entries (the GM's templates, the built-in
 * templates, world items, compendium items and kits) are read here, filtered for players by the shop list
 * (the world settings `shopList` and `shopForbidden`), and a shop key is turned back into item data when a
 * find card's Buy is pressed (`resolveShopKey`), so nothing a card or a request carries is trusted.
 *
 * The rules are pure (`rules/shop.ts`); the find and the purchase are actor methods (`findFromShop`,
 * `buyFromShop` in documents/index.ts), which call `buyShopLine` here.
 */
import { SYSTEM } from '../config/system.ts';
import {
  templatesFor, shopShows, shopListMode, soldInShop, parseShopKey, shopSourceOf, basketPlan, BOUGHT_TYPES, CODEX_TYPES, RULES,
  type ItemTemplate, type ShopListMode, type BasketLine,
} from '../rules/index.ts';
import { kitLinesFor, normalizeKit, type StarterKit } from '../rules/setup.ts';
import { t as tx } from '../helpers/i18n.ts';
import { escHtml } from '../rules/html.ts';
import { permitsBought } from '../rules/legalbuy.ts';

/** Fields a compendium index is asked for, so the list can show a summary and a price without loading every item. */
export const INDEX_FIELDS = ['system.cost', 'system.availability', 'system.streetIndex', 'system.grade', 'system.bioware', 'system.cultured', 'system.damagePower', 'system.damageLevel',
  'system.damageType', 'system.strengthPower', 'system.modes', 'system.melee', 'system.reach', 'system.blast', 'system.skill', 'system.ballistic', 'system.impact', 'system.adds',
  'system.essenceCost', 'system.bodyIndex', 'system.rating', 'system.learnedForce', 'system.category', 'system.spellType', 'system.drainLevel', 'system.focusType', 'system.mpcp',
  'system.kind', 'system.quantity', 'system.level', 'system.attribute', 'system.special', 'system.medkitRating', 'system.toxin.kind', 'system.legality', 'flags.sr2e.shop',
  // v0.91.2 review (R1): what the shop's categories read (rules/shopfilters.ts), so compendium rows sort like the rest.
  'system.specialization', 'system.shotgun', 'system.heavy', 'system.antiVehicle', 'system.areaKind', 'system.concealability', 'system.parry', 'system.ammoType',
  'system.optics', 'system.radio', 'system.rcdRating', 'system.jammer', 'system.scanner', 'system.signal', 'system.suite', 'system.explosive', 'system.patch',
  'system.chip', 'system.material', 'system.lowLight', 'system.thermographic', 'system.magnification', 'system.hearingAmp', 'system.ultrasound', 'system.controlRig',
  'system.limb', 'system.weapon', 'system.toxin'];

/** v0.91.4: what a vehicle compendium's index is asked for (the row's summary, price and category). */
export const VEHICLE_INDEX_FIELDS = ['system.cost', 'system.availability', 'system.streetIndex', 'system.legality', 'system.category', 'system.drone', 'system.handling',
  'system.handlingOffroad', 'system.speed', 'system.accel', 'system.body', 'system.armor', 'system.signature', 'system.autonav', 'system.pilot', 'system.sensor', 'flags.sr2e.shop'];

/** v0.91.4 review (R5): does a vehicle's update change what the shop and the Catalogue show of it? */
const VEHICLE_SHOWN = ['name', 'img', 'folder', 'ownership', 'flags', 'system.notes', ...VEHICLE_INDEX_FIELDS.filter((f) => f.startsWith('system.'))];
export function vehicleListChange(changes: Record<string, unknown>): boolean {
  const flat = Object.keys(foundry.utils.flattenObject(changes ?? {}));
  return flat.some((k) => VEHICLE_SHOWN.some((p) => k === p || k.startsWith(`${p}.`)));
}

/** v0.91.4: the world's catalogue folder of actors (applications/catalogue.ts makes it). */
export const CATALOGUE_ACTOR_FOLDER = 'Catalogue (SR2e)';

/** v0.91.4: is a world actor in the "Catalogue (SR2e)" folder (or one of its subfolders)? */
export function inCatalogueFolder(doc: any): boolean {
  let f: any = doc?.folder ?? null;
  for (let i = 0; f && i < 20; i++) {
    if (f.name === CATALOGUE_ACTOR_FOLDER) return true;
    f = f.folder ?? null;
  }
  return false;
}

/**
 * v0.91.4: is a world vehicle or drone for sale: in the catalogue folder, or marked "in the shop" by the GM; never one a
 * player owns (a character's car, a bought copy).
 */
export function vehicleForSale(doc: any): boolean {
  if (!doc || doc.documentName !== 'Actor' || doc.type !== 'vehicle' || doc.inCompendium || doc.parent) return false;
  if (doc.hasPlayerOwner) return false;
  return inCatalogueFolder(doc) || Boolean(doc.flags?.[SYSTEM.id]?.shop);
}

/** The system data of a vehicle's live state (who drives it, damage, chases, jamming): a bought copy starts without it. */
const VEHICLE_STATE_KEYS = ['condition', 'currentSpeed', 'offroad', 'controllerUuid', 'controlMode', 'occupants', 'locks', 'chase', 'speedTurn', 'position', 'jammed', 'systems'];

/** v0.91.4: a vehicle's data for a new, bought copy: no ids, folder, owners or shop mark, and none of its live state. */
export function vehicleCopyData(src: any): any {
  const data: any = foundry.utils.deepClone(src ?? {});
  // v0.91.4 review (N2): the compendium it came from stays known.
  const from = data._stats?.compendiumSource ?? null;
  delete data._id; delete data.folder; delete data.sort; delete data.ownership; delete data._stats;
  if (from) data._stats = { compendiumSource: from };
  // v0.91.4 review (N3): of this system's flags only the token art's is kept (no shop mark, buyer, orders or requests).
  if (data.flags?.[SYSTEM.id]) data.flags[SYSTEM.id] = data.flags[SYSTEM.id].artAuto === undefined ? {} : { artAuto: data.flags[SYSTEM.id].artAuto };
  const sys: any = data.system ?? {};
  for (const k of VEHICLE_STATE_KEYS) delete sys[k];
  // v0.91.5 review (R2): a bought copy has no permit yet (with bought permits).
  if (permitsBought()) sys.permit = false;
  if (sys.link && typeof sys.link === 'object') sys.link = { encryption: Number(sys.link.encryption ?? 0) || 0 };
  data.system = sys;
  if (Array.isArray(data.items)) for (const i of data.items) { delete i.folder; delete i.sort; delete i.ownership; }
  data.prototypeToken = { ...(data.prototypeToken ?? {}), actorLink: true };
  return data;
}

/** v0.91.4: the actor folder bought vehicles go in (found by its flag, made when missing). */
async function ownedVehiclesFolder(): Promise<any> {
  const folders = [...((game as any).folders ?? [])].filter((f: any) => f.type === 'Actor');
  const found = folders.find((f: any) => f.getFlag?.(SYSTEM.id, 'ownedVehicles'));
  if (found) return found;
  try { return await (CONFIG as any).Folder.documentClass.create({ name: tx('SR2E.App.VehicleShop.folder'), type: 'Actor', sorting: 'a', flags: { [SYSTEM.id]: { ownedVehicles: true } } }); } catch (err) { console.warn('sr2e | owned vehicles folder', err); return null; }
}

/**
 * v0.91.4 (the GM's client): the buyer's own copy of a vehicle or drone (data from `vehicleCopyData`): owned by the players
 * who own the buyer by name, and by the player who bought it; in the "Owned vehicles" folder; marked with who bought it
 * (the Rigging tab lists it). A chat line says it arrived. Null when it couldn't be made.
 */
export async function makeOwnedVehicle(buyer: any, data: any, purchaserId = ''): Promise<any | null> {
  if (!game.user?.isGM || !buyer || !data) return null;
  const ownership: Record<string, number> = { default: 0 };
  // v0.91.4 review (R4): every player who owns the buyer (by name or through its default), never everyone by default.
  for (const u of ((game as any).users ?? [])) if (!u.isGM && buyer.testUserPermission?.(u, 'OWNER')) ownership[u.id] = 3;
  const p: any = purchaserId ? (game as any).users?.get?.(purchaserId) : null;
  if (p && !p.isGM) ownership[p.id] = 3;
  const folder = await ownedVehiclesFolder();
  const copy = vehicleCopyData(data);
  const made: any = await (CONFIG as any).Actor.documentClass.create({
    ...copy, type: 'vehicle', name: String(copy.name || tx('SR2E.App.VehicleShop.unnamed')).slice(0, 200), ownership, ...(folder ? { folder: folder.id } : {}),
    flags: { ...(copy.flags ?? {}), [SYSTEM.id]: { ...(copy.flags?.[SYSTEM.id] ?? {}), boughtBy: buyer.uuid } },
  });
  if (!made) return null;
  try {
    await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: buyer }), content: `<p>${tx('SR2E.Card.VehicleShop.delivered', { buyer: `<strong>${escHtml(buyer.name)}</strong>`, vehicle: `@UUID[${escHtml(made.uuid)}]{${escHtml(String(made.name).replace(/[[\]{}]/g, ''))}}` })}</p>` });
  } catch (err) { console.warn('sr2e | vehicle card', err); }
  return made;
}

/** v0.91.4 review (R3): `makeOwnedVehicle`, a thrown error read as "not made" (so the payment is given back). */
export async function safeMakeOwnedVehicle(buyer: any, data: any, purchaserId = ''): Promise<any | null> {
  try { return await makeOwnedVehicle(buyer, data, purchaserId); } catch (err) { console.warn('sr2e | vehicle', err); return null; }
}

/** v0.91.4 review (B1): a vehicle order as the GM's client records it (world setting `vehicleOrders`, keyed by its id). */
export interface VehicleOrder { actorUuid: string; key: string; purchaserId: string; paid: number; name: string }

/** GM: record an order (its id), or null when it couldn't be written. */
export async function recordVehicleOrder(o: VehicleOrder): Promise<string | null> {
  if (!game.user?.isGM) return null;
  const id = foundry.utils.randomID();
  try {
    const all = { ...((game.settings.get(SYSTEM.id, 'vehicleOrders') as Record<string, VehicleOrder>) ?? {}) };
    all[id] = { actorUuid: o.actorUuid, key: o.key, purchaserId: o.purchaserId, paid: Math.max(0, Math.round(o.paid)), name: String(o.name).slice(0, 200) };
    await game.settings.set(SYSTEM.id, 'vehicleOrders', all);
    return id;
  } catch (err) { console.warn('sr2e | vehicle order', err); return null; }
}

/** GM: take an order off the record (it is delivered or given up once); null when there is none for this actor. */
export async function takeVehicleOrder(id: string, actorUuid: string): Promise<VehicleOrder | null> {
  if (!game.user?.isGM || !id) return null;
  try {
    const all = { ...((game.settings.get(SYSTEM.id, 'vehicleOrders') as Record<string, VehicleOrder>) ?? {}) };
    const o = Object.prototype.hasOwnProperty.call(all, id) ? all[id] : null;
    if (!o || o.actorUuid !== actorUuid) return null;
    delete all[id];
    await game.settings.set(SYSTEM.id, 'vehicleOrders', all);
    return o;
  } catch (err) { console.warn('sr2e | vehicle order', err); return null; }
}

/** One row of the Add window (the shop). `marked`: the GM put it "in the shop". */
export interface Entry { key: string; type: string; name: string; img: string; system: any; source: string; uuid?: string; template?: boolean; kit?: StarterKit; marked?: boolean }

/**
 * The world's starter kits (as applications/setup.ts reads them; read here so this file pulls in no window code:
 * documents/index.ts imports it).
 */
function kits(): StarterKit[] {
  let raw: unknown[] = [];
  try { raw = ((game.settings.get(SYSTEM.id, 'starterKits') as unknown[]) ?? []); } catch { raw = []; }
  return raw.map((k) => normalizeKit(k, () => 'kit')).filter((k): k is StarterKit => Boolean(k));
}

/** What makes a bought line's items (the Add window's `addLines`, registered by applications/adding.ts). */
type Adder = (actor: any, lines: Array<BasketLine & { key?: string; data: any }>, payment: 'buy', ready: boolean, shop: { price: number; hours: number }) => Promise<string[]>;
let adder: Adder | null = null;
export function setShopAdder(fn: Adder): void { adder = fn; }

export function worldTemplates(): ItemTemplate[] {
  try { return ((game.settings.get(SYSTEM.id, 'itemTemplates') as ItemTemplate[]) ?? []); } catch { return []; }
}

/** The shop list's settings (what players see). */
export function shopSettings(): { mode: ShopListMode; allowForbidden: boolean } {
  let mode: unknown = 'all', allow: unknown = false;
  try { mode = game.settings.get(SYSTEM.id, 'shopList'); } catch { /* not registered (tests) */ }
  try { allow = game.settings.get(SYSTEM.id, 'shopForbidden'); } catch { /* not registered */ }
  return { mode: shopListMode(mode), allowForbidden: Boolean(allow) };
}

/** Does this client's user see the entry in the shop? */
export function entryShown(e: Pick<Entry, 'key' | 'type' | 'system' | 'marked'>, isGM = Boolean(game.user?.isGM)): boolean {
  const s = shopSettings();
  return shopShows({ key: e.key, type: e.type, legality: e.system?.legality, marked: e.marked, mode: s.mode, isGM, allowForbidden: s.allowForbidden });
}

/** Every entry for one type: world templates, built-in templates, world items, compendium items. */
export async function entriesFor(type: string): Promise<Entry[]> {
  const out: Entry[] = [];
  // v0.91.4: vehicles and drones are actors: the GM's (in the catalogue folder, or marked) and vehicle compendiums.
  if (type === 'vehicle') {
    for (const a of ((game as any).actors ?? [])) {
      if (!vehicleForSale(a)) continue;
      out.push({ key: `actor:${a.uuid}`, type, name: a.name, img: a.img ?? '', system: a.system?.toObject?.() ?? a._source?.system ?? {}, source: tx('SR2E.App.Adding.worldTemplate'), uuid: a.uuid, marked: Boolean(a.flags?.[SYSTEM.id]?.shop) });
    }
    for (const pack of ((game as any).packs ?? [])) {
      if (pack.documentName !== 'Actor' || pack.visible === false) continue;
      let index: any;
      try { index = await pack.getIndex({ fields: VEHICLE_INDEX_FIELDS }); } catch { continue; }
      for (const e of index ?? []) {
        if (e.type !== 'vehicle') continue;
        const uuid = e.uuid ?? `Compendium.${pack.collection}.Actor.${e._id}`;
        out.push({ key: `pack:${uuid}`, type, name: e.name, img: e.img ?? '', system: e.system ?? {}, source: pack.title ?? pack.metadata?.label ?? tx('SR2E.App.Adding.compendium'), uuid });
      }
    }
    return out;
  }
  for (const t of templatesFor(type, worldTemplates())) {
    out.push({ key: `tpl:${(t as any).world ? 'w' : 'b'}:${t.id}`, type, name: t.name, img: '', system: t.system ?? {}, source: (t as any).world ? tx('SR2E.App.Adding.worldTemplate') : tx('SR2E.App.Adding.template'), template: true, marked: Boolean((t as any).world && (t as any).shop) });
  }
  for (const i of ((game as any).items ?? [])) {
    if (i.type !== type || !(i.visible ?? true)) continue;
    out.push({ key: `world:${i.uuid}`, type, name: i.name, img: i.img ?? '', system: i.system?.toObject?.() ?? i.system ?? {}, source: tx('SR2E.App.Adding.worldItem'), uuid: i.uuid, marked: Boolean(i.flags?.[SYSTEM.id]?.shop) });
  }
  for (const pack of ((game as any).packs ?? [])) {
    if (pack.documentName !== 'Item' || pack.visible === false) continue;
    let index: any;
    try { index = await pack.getIndex({ fields: INDEX_FIELDS }); } catch { continue; }
    for (const e of index ?? []) {
      if (e.type !== type) continue;
      out.push({ key: `pack:${e.uuid ?? `Compendium.${pack.collection}.Item.${e._id}`}`, type, name: e.name, img: e.img ?? '', system: e.system ?? {}, source: pack.title ?? pack.metadata?.label ?? tx('SR2E.App.Adding.compendium'), uuid: e.uuid ?? `Compendium.${pack.collection}.Item.${e._id}` });
    }
  }
  return out;
}

/** The item data an entry makes (full data from a world or compendium item). */
export async function entryData(e: Entry): Promise<any | null> {
  if (e.template) return { name: e.name, type: e.type, system: foundry.utils.deepClone(e.system ?? {}) };
  // v0.91.4: a vehicle row's data is only shown and priced; what is bought is read again from its key (vehicleShopAsGm).
  if (e.type === 'vehicle') return { name: e.name, type: 'vehicle', system: foundry.utils.deepClone(e.system ?? {}) };
  if (!e.uuid) return null;
  const doc: any = await fromUuid(e.uuid);
  if (!doc || doc.documentName !== 'Item' || doc.parent) return null;
  const data: any = doc.inCompendium ? (game as any).items.fromCompendium(doc, { clearFolder: true }) : doc.toObject();
  delete data._id; delete data.folder; delete data.sort; delete data.ownership;
  if (data.flags?.[SYSTEM.id]) delete data.flags[SYSTEM.id].shop;
  return data;
}

/** Can this user see a document (a world item or compendium pack) at all? */
function userSees(doc: any, user: any): boolean {
  if (!user || user.isGM) return true;
  // A compendium pack (its documentName is its documents' type, so it is told apart by its metadata).
  const isPack = Boolean(doc?.metadata) || typeof doc?.getIndex === 'function';
  // v0.91.0 review (B1): a compendium item's access is its pack's (its own ownership is usually none).
  if (!isPack && doc?.inCompendium && doc.compendium) return userSees(doc.compendium, user);
  // R3: a pack needs Observer, as its listing in the window does (`pack.visible`).
  if (isPack) {
    // A filer this client never saw (no user document): what any player may see.
    if (typeof user.id !== 'string') { const pl = String(doc?.ownership?.PLAYER ?? ''); return pl === 'OBSERVER' || pl === 'OWNER'; }
    try { return typeof doc.getUserLevel === 'function' ? Number(doc.getUserLevel(user) ?? 0) >= 2 : doc.visible !== false; } catch { return false; }
  }
  if (typeof user.id !== 'string') return Number(doc?.ownership?.default ?? 0) >= 1;
  try {
    if (typeof doc?.testUserPermission === 'function') return Boolean(doc.testUserPermission(user, 'LIMITED'));
  } catch { return false; }
  return doc?.visible !== false;
}

/** A shop key read back into the item it sells: its type, name and full item data. */
export interface ShopThing { key: string; type: string; name: string; system: any; data: any; marked: boolean }

/**
 * v0.91.0: a shop key turned back into item data (from the source, never from a card or request). `user`: whose
 * shop it is (the buyer; the GM approving a request passes the player who filed it): a key that user's shop
 * doesn't show (a hidden compendium, an unmarked template, a forbidden item) is null.
 */
export async function resolveShopKey(key: unknown, user: any = game.user): Promise<ShopThing | null> {
  return resolveKey(key, user, BOUGHT_TYPES);
}

/**
 * v0.91.3: a Catalogue page's entry (rules/codex.ts CODEX_TYPES: what is bought, and spells and adept powers), read
 * the same way as a shop key: only what this user's shop shows; never a kit line.
 */
export async function resolveCatalogueKey(key: unknown, user: any = game.user): Promise<ShopThing | null> {
  if (shopSourceOf(key) === 'kit') return null;
  return resolveKey(key, user, CODEX_TYPES);
}

/** A world or compendium item as the shop thing it sells (null when it isn't one this user may see). */
async function itemThing(doc: any, k: string, user: any): Promise<ShopThing | null> {
  if (!doc || doc.documentName !== 'Item' || doc.parent) return null;
  if (shopSourceOf(k) === 'worldItem' ? doc.inCompendium : !doc.inCompendium) return null;
  if (!userSees(doc, user)) return null;
  const data = await entryData({ key: k, type: doc.type, name: doc.name, img: '', system: {}, source: '', uuid: doc.uuid ?? parseShopKey(k)?.id });
  if (!data) return null;
  return { key: k, type: doc.type, name: doc.name, system: data.system ?? {}, data, marked: Boolean(doc.flags?.[SYSTEM.id]?.shop) };
}

async function resolveKey(key: unknown, user: any, types: readonly string[]): Promise<ShopThing | null> {
  const p = parseShopKey(key);
  if (!p) return null;
  const k = String(key);
  let thing: ShopThing | null = null;
  if (p.source === 'builtin' || p.source === 'world') {
    const t: any = p.source === 'world' ? worldTemplates().find((x) => x.id === p.id) : RULES.ITEM_TEMPLATES.find((x: any) => x.id === p.id);
    if (!t || typeof t.type !== 'string') return null;
    thing = { key: k, type: t.type, name: String(t.name ?? ''), system: foundry.utils.deepClone(t.system ?? {}), data: { name: t.name, type: t.type, system: foundry.utils.deepClone(t.system ?? {}) }, marked: p.source === 'world' && Boolean((t as any).shop) };
  } else if (p.source === 'worldActor' || p.source === 'pack') {
    let doc: any = null;
    try { doc = await fromUuid(p.id); } catch { return null; }
    if (!doc) return null;
    if (doc.documentName === 'Actor') {
      // v0.91.4: a vehicle or drone: a world one for sale, or one in a compendium this user can see.
      if (doc.type !== 'vehicle' || doc.parent) return null;
      if (p.source === 'worldActor' ? !vehicleForSale(doc) : !doc.inCompendium || !userSees(doc, user)) return null;
      const raw: any = doc.inCompendium ? (game as any).actors.fromCompendium(doc, { clearFolder: true }) : doc.toObject();
      const data = vehicleCopyData(raw);
      thing = { key: k, type: 'vehicle', name: doc.name, system: data.system ?? {}, data, marked: Boolean(doc.flags?.[SYSTEM.id]?.shop) };
      // v0.91.4 review (N1): a pack is told by what its document is, not by its id's text.
    } else if (p.source === 'pack') thing = await itemThing(doc, k, user);
    else return null;
  } else if (p.source === 'worldItem') {
    let doc: any = null;
    try { doc = await fromUuid(p.id); } catch { return null; }
    thing = await itemThing(doc, k, user);
    if (!thing) return null;
  } else if (p.source === 'kit') {
    const kit = kits().find((x) => x.id === p.id);
    const line = kit?.lines?.[p.line ?? -1];
    // v0.91.4: a kit line is an item (never a vehicle).
    if (!line || line.type === 'vehicle') return null;
    thing = { key: k, type: line.type, name: line.name, system: foundry.utils.deepClone(line.system ?? {}), data: { name: line.name, type: line.type, system: foundry.utils.deepClone(line.system ?? {}) }, marked: true };
  }
  if (!thing || !types.includes(thing.type)) return null;
  const s = shopSettings();
  if (!shopShows({ key: k, type: thing.type, legality: thing.system?.legality, marked: thing.marked, mode: s.mode, isGM: Boolean(user?.isGM), allowForbidden: s.allowForbidden })) return null;
  return thing;
}

/** A kit's lines as shop keys (for finding a kit line by line): only the lines this actor type can hold. */
export function kitShopKeys(kit: StarterKit, allowedTypes: readonly string[]): string[] {
  const allowed = new Set(kitLinesFor(kit, allowedTypes).lines);
  return kit.lines.map((l, i) => (allowed.has(l) && BOUGHT_TYPES.includes(l.type) ? `kit:${kit.id}#${i}` : '')).filter(Boolean);
}

/** The basket line a shop purchase is, and its street price for `qty` (copies, or a gear quantity). */
export function shopLine(t: ShopThing, qty: number): BasketLine & { data: any } {
  // v0.91.5 review (R2): with bought permits, a permit never comes with the thing (it is the buyer's to get).
  if (permitsBought() && (t.system?.permit || t.data?.system?.permit)) {
    const system = { ...(t.system ?? {}), permit: false };
    const data = t.data && typeof t.data === 'object' ? { ...t.data, system: { ...(t.data.system ?? {}), permit: false } } : t.data;
    return { type: t.type, name: t.name, system, amount: Math.max(1, Math.floor(qty) || 1), data };
  }
  return { type: t.type, name: t.name, system: t.system, amount: Math.max(1, Math.floor(qty) || 1), data: t.data };
}
export function shopListPrice(t: ShopThing, qty: number, actorType = 'character'): number {
  return basketPlan([shopLine(t, qty)], { payment: 'buy', actorType, nuyen: Number.MAX_SAFE_INTEGER, karma: 0 }).nuyen;
}

/** GM: put an entry in the shop or take it out (a world template's `shop`, a world item's flag). */
export async function toggleShopMark(key: string): Promise<boolean | null> {
  if (!game.user?.isGM) { ui.notifications?.warn?.(tx('SR2E.Notify.Shop.onlyTheGm')); return null; }
  const p = parseShopKey(key);
  if (p?.source === 'world') {
    const list = worldTemplates().map((t) => ({ ...t }));
    const t: any = list.find((x) => x.id === p.id);
    if (!t) return null;
    t.shop = !t.shop;
    if (!t.shop) delete t.shop;
    await game.settings.set(SYSTEM.id, 'itemTemplates', list.map(({ world: _w, ...x }: any) => x));
    return Boolean(t.shop);
  }
  // v0.91.4: a world vehicle in or out of the shop.
  if (p?.source === 'worldActor') {
    const doc: any = await fromUuid(p.id);
    if (!doc || doc.documentName !== 'Actor' || doc.type !== 'vehicle' || doc.inCompendium || doc.hasPlayerOwner) return null;
    const on = !doc.flags?.[SYSTEM.id]?.shop;
    await doc.update({ [`flags.${SYSTEM.id}.shop`]: on });
    return on;
  }
  if (p?.source === 'worldItem') {
    const doc: any = await fromUuid(p.id);
    if (!doc || doc.documentName !== 'Item' || doc.parent || doc.inCompendium) return null;
    const on = !doc.flags?.[SYSTEM.id]?.shop;
    await doc.update({ [`flags.${SYSTEM.id}.shop`]: on });
    return on;
  }
  return null;
}

/** Is a type's tab one the shop list filters (so the GM sees the shop marks there)? */
export const shopTab = (type: string): boolean => soldInShop(type);

/**
 * v0.91.0: what a shop purchase does once paid for: the item made on the actor, or (waiting on, with a time)
 * ordered: the money is held and the item arrives under Under way. The actor's `buyFromShop` checks the price and
 * the queue first. Returns true when it went through.
 */
export async function buyShopLine(actor: any, t: ShopThing, o: { price: number; hours: number; qty: number }): Promise<boolean> {
  if (!adder) return false;
  const done = await adder(actor, [{ ...shopLine(t, o.qty), key: t.key }], 'buy', false, { price: o.price, hours: o.hours });
  return done.length > 0;
}
