/**
 * v0.94.2 (improvement plan item 28): give, stash and loot without Item Piles. The pure transfer core: who may move
 * what and by which route, the checks on the request, the quantity split, the stack merge on the receiving side and
 * the nuyen. No Foundry here: applications/trade942.ts reads the documents into the shapes below, asks this file, and
 * carries out the plan (directly, on the GM's client from a GM-apply card, or through the GM relay for "free for all"
 * loot).
 *
 * - Give: a player hands one of their own character's items (or nuyen) to another actor.
 * - Stash: the same move into a safehouse or another actor the player owns.
 * - Loot: a player takes from an actor the GM has marked lootable (flag `loot`), into one of their own actors.
 *
 * Hook points for item nesting (another part of 0.94.2 links accessories, programs, ammo and container contents to a
 * parent item through a flag on the child): `PlanOptions.childrenOf` gives an item's children (they move with it when
 * the whole item moves) and `PlanOptions.clearFlags` names the `flags.<system>` keys cleared on the moved item (its
 * own parent link: it leaves the container it sat in). `PlanOptions.relink` rewrites a child's link when its parent
 * had to take a new id on the receiving side. All three default to doing nothing.
 */
import { gearStackKey } from './catalogue.ts';
import { normalizeTweaks, tweakText } from './tweaks.ts';

export type TransferKind = 'give' | 'stash' | 'loot';
export const TRANSFER_KINDS: readonly TransferKind[] = ['give', 'stash', 'loot'];

/** The most nuyen one transfer moves (a bound for untrusted input; far above any table's wallet). */
export const MAX_TRANSFER_NUYEN = 10_000_000;
/** The most of one stack one transfer moves. */
export const MAX_TRANSFER_QTY = 100_000;

/** What a transfer asks for: one item (with a count) or an amount of nuyen, from one actor to another. */
export interface TransferRequest {
  kind: TransferKind;
  fromUuid: string;
  toUuid: string;
  /** The item's id on the source actor (absent for nuyen). */
  itemId?: string;
  /** How many of the stack (1 when the item has no count). */
  qty?: number;
  /** Nuyen instead of an item. */
  nuyen?: number;
}

/** An item as the core sees it: `data` is its plain data (`toObject()`), `system` its current system data. */
export interface TradeItem {
  id: string;
  type: string;
  name: string;
  system: Record<string, any>;
  data: Record<string, any>;
}

/** An actor as the core sees it. `nuyen` is null when the actor has no nuyen field (a safehouse, a vehicle). */
export interface TradeActor {
  uuid: string;
  type: string;
  name?: string;
  items: readonly TradeItem[];
  nuyen: number | null;
  /** The GM's loot mark (flag `loot`), or null. */
  loot?: LootMark | null;
}

/** The GM's loot mark on an actor: lootable, and whether players take without asking. */
export interface LootMark { on: boolean; free: boolean }

/** Who is asking, as the route and the checks need it (read from the documents, never from a card). */
export interface TradeAuthority { isGm: boolean; ownsFrom: boolean; ownsTo: boolean }

/** Pure: the loot mark from a flag value (null, an old shape or junk: not lootable). */
export function lootMarkOf(flag: unknown): LootMark | null {
  if (!flag || typeof flag !== 'object' || Array.isArray(flag)) return null;
  const f = flag as Record<string, unknown>;
  if (f['on'] !== true) return null;
  return { on: true, free: f['free'] === true };
}

/** Item types that change hands (moved, never copied). The same list as applications/drops.ts PHYSICAL_ITEM_TYPES. */
export const TRADE_ITEM_TYPES: readonly string[] = ['weapon', 'armor', 'gear', 'cyberware', 'focus', 'cyberdeck'];

/** Pure: a stack's size (its quantity; 1 when it has none). */
export function tradeStackSize(system: any): number {
  const q = Number(system?.quantity ?? 1);
  return Number.isFinite(q) ? Math.max(0, Math.floor(q)) : 1;
}

/** Pure: whether an item may change hands at all (physical, and not installed in someone). */
export function tradeable(item: Pick<TradeItem, 'type' | 'system'> | null | undefined): boolean {
  if (!item || !TRADE_ITEM_TYPES.includes(item.type)) return false;
  if (item.type === 'cyberware' && item.system?.installed === true) return false;
  return true;
}

/**
 * Pure: how a transfer goes.
 * - 'direct': the asking client makes it itself (a GM, or a player who owns both actors).
 * - 'card': a GM-apply card (give or stash to an actor the player doesn't own; loot the GM approves).
 * - 'relay': the GM's client makes it at once through the GM relay (loot from an actor marked "free for all").
 * - 'refused': the player may not ask for it (not their item; not lootable; not into their own actor).
 */
export type TradeRoute = 'direct' | 'card' | 'relay' | 'refused';

export function transferRoute(kind: TransferKind, who: TradeAuthority, loot: LootMark | null | undefined): TradeRoute {
  if (who.isGm) return 'direct';
  if (who.ownsFrom && who.ownsTo) return 'direct';
  if (kind === 'loot') {
    if (!loot?.on || !who.ownsTo) return 'refused';
    return loot.free ? 'relay' : 'card';
  }
  return who.ownsFrom ? 'card' : 'refused';
}

/**
 * Pure: whether the GM's client may carry out a transfer asked for by someone else (the card's author, the relay's
 * sender). Read from the documents: the author's ownership and the source's loot mark now, never the card's word.
 * - give/stash: the author owns the source actor.
 * - loot: the source is lootable and the author owns the receiving actor; through the relay only when it is free.
 * A GM author may do anything.
 */
export function gmMayTransfer(kind: TransferKind, who: TradeAuthority, loot: LootMark | null | undefined, via: 'card' | 'relay'): boolean {
  if (who.isGm) return true;
  if (kind === 'give' || kind === 'stash') return via === 'card' && who.ownsFrom;
  if (kind === 'loot') return Boolean(loot?.on) && who.ownsTo && (via === 'card' || loot!.free);
  return false;
}

/** Problem codes (text: `SR2E.Trade.Problem.<code>`). */
export type TradeProblem =
  | 'badRequest' | 'noSource' | 'noTarget' | 'sameActor' | 'noItem' | 'notTradeable' | 'targetRefuses'
  | 'badQty' | 'notEnough' | 'noNuyenField' | 'notEnoughNuyen' | 'childRefused' | 'hiddenSource';

const isUuid = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length < 400;
const isWhole = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;

/**
 * Pure: whether a request has the shape the system posts (for a card's flag or a relay payload: untrusted). Exactly
 * one of an item (with a count) or nuyen.
 */
export function transferShapeOk(r: unknown): r is TransferRequest {
  if (!r || typeof r !== 'object' || Array.isArray(r)) return false;
  const o = r as Record<string, unknown>;
  const allowed = new Set(['kind', 'fromUuid', 'toUuid', 'itemId', 'qty', 'nuyen', 'name', 'sourceUuid']);
  if (!Object.keys(o).every((k) => allowed.has(k))) return false;
  if (!TRANSFER_KINDS.includes(o['kind'] as TransferKind) || !isUuid(o['fromUuid']) || !isUuid(o['toUuid'])) return false;
  if (o['name'] !== undefined && !(typeof o['name'] === 'string' && o['name'].length < 200)) return false;
  if (o['sourceUuid'] !== undefined && !isUuid(o['sourceUuid'])) return false;
  const item = o['itemId'] !== undefined;
  const money = o['nuyen'] !== undefined;
  if (item === money) return false;
  if (item) return typeof o['itemId'] === 'string' && o['itemId'].length > 0 && o['itemId'].length < 64 && (o['qty'] === undefined || isWhole(o['qty'], 1, MAX_TRANSFER_QTY));
  return o['qty'] === undefined && isWhole(o['nuyen'], 1, MAX_TRANSFER_NUYEN);
}

/**
 * Pure: what is wrong with a transfer as the documents stand now (empty when it can go). `typesFor` is the item types
 * each actor type holds (applications/drops.ts ITEM_TYPES_FOR); an actor type it doesn't name holds anything.
 */
export function transferProblems(r: TransferRequest, from: TradeActor | null, to: TradeActor | null, typesFor: Readonly<Record<string, readonly string[]>> = {}, o: Pick<PlanOptions, 'childrenOf'> = {}): TradeProblem[] {
  if (!transferShapeOk(r)) return ['badRequest'];
  if (!from) return ['noSource'];
  if (!to) return ['noTarget'];
  if (from.uuid === to.uuid) return ['sameActor'];
  if (r.nuyen !== undefined) {
    const out: TradeProblem[] = [];
    if (from.nuyen === null || to.nuyen === null) out.push('noNuyenField');
    else if (from.nuyen < r.nuyen) out.push('notEnoughNuyen');
    return out;
  }
  const item = from.items.find((i) => i.id === r.itemId) ?? null;
  if (!item) return ['noItem'];
  const out: TradeProblem[] = [];
  if (!tradeable(item)) out.push('notTradeable');
  const takes = typesFor[to.type];
  if (takes && !takes.includes(item.type)) out.push('targetRefuses');
  const want = r.qty ?? 1;
  if (!isWhole(want, 1, MAX_TRANSFER_QTY)) out.push('badQty');
  else if (tradeStackSize(item.system) < want) out.push('notEnough');
  // v0.94.2 review (finding 1): every child that would go along must fit the receiver too, or nothing moves (the
  // receiver's type guard would refuse it and the giver would lose it).
  else if (refusedChildren(r, from, to, typesFor, o).length) out.push('childRefused');
  return out;
}

/**
 * Pure: the items that move with a request: the item, and its children when the whole stack moves (as `planTransfer`
 * takes them). Empty when the item isn't there; nuyen moves no item.
 */
export function transferFamily(r: TransferRequest, from: TradeActor | null, o: Pick<PlanOptions, 'childrenOf'> = {}): TradeItem[] {
  if (!from || r.nuyen !== undefined) return [];
  const item = from.items.find((i) => i.id === r.itemId);
  if (!item) return [];
  const whole = Math.floor(r.qty ?? tradeStackSize(item.system)) >= tradeStackSize(item.system);
  const kids = whole && o.childrenOf ? [...o.childrenOf(item, from.items)].filter((c) => c.id !== item.id) : [];
  return [item, ...kids];
}

/** Pure (review finding 1): the children going along that the receiver's type can't hold (their names; empty: all fit). */
export function refusedChildren(r: TransferRequest, from: TradeActor | null, to: TradeActor | null, typesFor: Readonly<Record<string, readonly string[]>> = {}, o: Pick<PlanOptions, 'childrenOf'> = {}): string[] {
  const takes = to ? typesFor[to.type] : undefined;
  if (!takes) return [];
  return transferFamily(r, from, o).slice(1).filter((c) => !takes.includes(c.type)).map((c) => c.name);
}

/** What an item carries beyond its plain data: its custom tweaks and its Active Effects (review finding 2). */
export interface ItemExtras {
  name: string;
  tweaks: string[];
  effects: Array<{ name: string; disabled: boolean; changes: string[] }>;
}

/** Pure: an item's tweaks (as the sheets word them) and Active Effects (each change as `key mode value`); null when it has neither. */
export function itemExtras(item: Pick<TradeItem, 'name' | 'type' | 'system' | 'data'>): ItemExtras | null {
  const tweaks = normalizeTweaks(item.system?.tweaks ?? item.data?.['system']?.tweaks, () => 'x').map((t) => (t.label ? `${t.label}: ` : '') + tweakText(t, item.type));
  const raw = Array.isArray(item.data?.['effects']) ? item.data['effects'] as any[] : [];
  const effects = raw.slice(0, 20).map((e: any) => ({
    name: String(e?.name ?? '').slice(0, 80),
    disabled: Boolean(e?.disabled),
    changes: (Array.isArray(e?.changes) ? e.changes : []).slice(0, 12).map((c: any) => `${String(c?.key ?? '').slice(0, 80)} ${String(c?.mode ?? '')} ${String(c?.value ?? '').slice(0, 40)}`.trim()),
  }));
  if (!tweaks.length && !raw.length) return null;
  return { name: item.name, tweaks, effects };
}

/**
 * Pure (review finding 2): whether a transfer moves only plain items (no tweaks, no Active Effects on the item or any
 * child going along). Nuyen is plain; an item that isn't there is not (nothing to vouch for).
 */
export function transferIsPlain(r: TransferRequest, from: TradeActor | null, o: Pick<PlanOptions, 'childrenOf'> = {}): boolean {
  if (r.nuyen !== undefined) return true;
  const fam = transferFamily(r, from, o);
  return fam.length > 0 && fam.every((i) => itemExtras(i) === null);
}

/**
 * Pure (review finding 11): whether players may loot an actor by its tokens: a synthetic token's own `hidden`, or for a
 * world actor any of its linked tokens shown. An actor with no token at all isn't on any scene to loot from.
 */
export function lootSourceVisible(tokens: ReadonlyArray<{ hidden?: boolean } | null | undefined>): boolean {
  return tokens.some((t) => t && !t.hidden);
}

/** Pure (review finding 1): the ids a plan creates on the receiver that weren't made (empty: all of them were). */
export function missingCreates(plan: Pick<TransferPlan, 'target'>, madeIds: Iterable<string>): string[] {
  const made = new Set([...madeIds].map(String));
  return plan.target.create.map((d) => String(d['_id'] ?? '')).filter((id) => !made.has(id));
}

/** The hook points for item nesting (see the file comment). */
export interface PlanOptions {
  /** An item's children on the same actor (accessories, loaded programs, ammo, a container's contents). Default none. */
  childrenOf?: (item: TradeItem, all: readonly TradeItem[]) => readonly TradeItem[];
  /** `flags.<system>` keys cleared on the moved item itself (its parent link). Default none. */
  clearFlags?: readonly string[];
  /** A child's data with its parent link pointed at the parent's new id (when the id had to change). Default unchanged. */
  relink?: (child: Record<string, any>, oldParentId: string, newParentId: string) => Record<string, any>;
  /** The system's flag scope (`flags.<scope>`). */
  scope?: string;
  /** System changes an item gets on arrival (applications/drops.ts arrivalReset: not worn, not installed, unbonded). */
  arrival?: (type: string, system: any) => Record<string, unknown>;
  /** A fresh document id (when the receiver already has the item's id). */
  makeId?: () => string;
}

/** What carrying out a transfer does: on the source, then on the target, and the nuyen. */
export interface TransferPlan {
  source: { deleteIds: string[]; updates: Array<{ _id: string; 'system.quantity': number }> };
  target: { create: Array<Record<string, any>>; updates: Array<{ _id: string; 'system.quantity': number }>; keepIds: boolean };
  nuyen: { from: number; to: number } | null;
  /** How many moved (of the item), and whether it merged into a stack the receiver had. */
  moved: number;
  merged: boolean;
  /** The children that went along (their ids on the source). */
  children: string[];
}

function clone<T>(v: T): T {
  try { return structuredClone(v); } catch { return JSON.parse(JSON.stringify(v ?? null)); }
}

function stableJson(v: unknown): string {
  if (Array.isArray(v)) return '[' + v.map(stableJson).join(',') + ']';
  if (v && typeof v === 'object') return '{' + Object.keys(v as object).sort().map((k) => JSON.stringify(k) + ':' + stableJson((v as any)[k])).join(',') + '}';
  return JSON.stringify(v ?? null);
}

/**
 * Pure: the key two stacks merge on. Gear uses the gear stack key (rules/catalogue.ts `gearStackKey`: the name and
 * every field that makes two pieces different things, not the count or the text); any other counted type merges only
 * with the same name and the very same data apart from the count and the description.
 */
export function tradeStackKey(type: string, name: string, system: any): string {
  if (type === 'gear') return `gear|${gearStackKey(name, system)}`;
  const { quantity: _q, description: _d, ...rest } = system ?? {};
  return `${type}|${String(name ?? '').trim().toLowerCase()}|${stableJson(rest)}`;
}

/**
 * Pure: the plan for a checked transfer (call `transferProblems` first: this assumes it found nothing).
 * - Nuyen: the source pays, the target receives.
 * - An item: `qty` of the stack moves (all of it by default). The whole stack moving takes its children along and
 *   keeps its id when the receiver has no item with it (so the children's links still hold); part of a stack leaves
 *   the children with the rest. The moved part joins a stack the receiver has (`tradeStackKey`), unless either side
 *   has children (a container never merges).
 */
export function planTransfer(r: TransferRequest, from: TradeActor, to: TradeActor, o: PlanOptions = {}): TransferPlan {
  const plan: TransferPlan = { source: { deleteIds: [], updates: [] }, target: { create: [], updates: [], keepIds: true }, nuyen: null, moved: 0, merged: false, children: [] };
  if (r.nuyen !== undefined) {
    plan.nuyen = { from: (from.nuyen ?? 0) - r.nuyen, to: (to.nuyen ?? 0) + r.nuyen };
    return plan;
  }
  const item = from.items.find((i) => i.id === r.itemId);
  if (!item) return plan;
  const have = tradeStackSize(item.system);
  const take = Math.max(1, Math.min(have, Math.floor(r.qty ?? have)));
  const whole = take >= have;
  const childrenOf = o.childrenOf ?? (() => []);
  const kids = whole ? [...childrenOf(item, from.items)].filter((c) => c.id !== item.id) : [];
  const scope = o.scope ?? 'sr2e';
  const takenIds = new Set(to.items.map((i) => i.id));
  const fresh = (id: string): string => {
    if (!takenIds.has(id)) { takenIds.add(id); return id; }
    let n = o.makeId?.() ?? `${id.slice(0, 10)}${takenIds.size.toString(36)}`.slice(0, 16);
    while (takenIds.has(n)) n = o.makeId?.() ?? `${n.slice(0, 12)}${Math.floor(Math.random() * 1e4).toString(36)}`.slice(0, 16);
    takenIds.add(n);
    return n;
  };
  const arrive = (data: Record<string, any>, type: string) => {
    const reset = o.arrival?.(type, data['system'] ?? {}) ?? {};
    if (Object.keys(reset).length) data['system'] = { ...(data['system'] ?? {}), ...reset };
    delete data['folder']; delete data['sort']; delete data['ownership'];
    return data;
  };
  // The moved item: its own parent link cleared (it leaves any container it sat in on the giver's side).
  const data = arrive(clone(item.data), item.type);
  if (data['system'] && typeof data['system'] === 'object') data['system'] = { ...data['system'] };
  const counted = Boolean(data['system'] && Object.hasOwn(data['system'], 'quantity'));
  if (counted) data['system']['quantity'] = take;
  const flags = data['flags']?.[scope];
  if (flags && typeof flags === 'object') for (const k of o.clearFlags ?? []) delete flags[k];
  const hasKids = (i: TradeItem) => childrenOf(i, to.items).length > 0;
  const key = tradeStackKey(item.type, item.name, data['system']);
  const stack = counted && !kids.length ? to.items.find((i) => i.type === item.type && !hasKids(i) && tradeStackKey(i.type, i.name, i.system) === key) : undefined;
  if (stack) {
    plan.target.updates.push({ _id: stack.id, 'system.quantity': tradeStackSize(stack.system) + take });
    plan.merged = true;
  } else {
    const oldId = String(data['_id'] ?? item.id);
    const newId = fresh(oldId);
    data['_id'] = newId;
    plan.target.create.push(data);
    // v0.94.2 (lead): every id that changed is remapped in every child, so a grandchild (a scope on a gun in a bag)
    // follows its own parent's new id too, not only the top item's.
    const moved: Array<{ cd: Record<string, any>; id: string }> = [];
    const changed: Array<[string, string]> = newId !== oldId ? [[oldId, newId]] : [];
    for (const c of kids) {
      const cd = arrive(clone(c.data), c.type);
      const was = String(cd['_id'] ?? c.id);
      cd['_id'] = fresh(was);
      if (cd['_id'] !== was) changed.push([was, cd['_id']]);
      moved.push({ cd, id: c.id });
    }
    for (const m of moved) {
      let cd = m.cd;
      if (o.relink) for (const [a, b] of changed) cd = o.relink(cd, a, b);
      plan.target.create.push(cd);
      plan.children.push(m.id);
    }
  }
  if (whole) plan.source.deleteIds.push(item.id, ...plan.children);
  else plan.source.updates.push({ _id: item.id, 'system.quantity': have - take });
  plan.moved = take;
  return plan;
}

/** Pure: the items of an actor a loot list or a give menu offers (tradeable ones, by type then name). */
export function tradeableItems<T extends Pick<TradeItem, 'type' | 'name' | 'system'>>(items: readonly T[]): T[] {
  const order = (t: string) => { const i = TRADE_ITEM_TYPES.indexOf(t); return i < 0 ? 99 : i; };
  return items.filter((i) => tradeable(i) && tradeStackSize(i.system) > 0).sort((a, b) => order(a.type) - order(b.type) || a.name.localeCompare(b.name));
}

/** Pure: a count answer bounded to 1..have (null when it isn't one). Used for nuyen too (have = the wallet). */
export function countAnswer(raw: unknown, have: number): number | null {
  const n = Math.floor(Number(raw));
  return Number.isFinite(n) && n >= 1 && n <= have ? n : null;
}
