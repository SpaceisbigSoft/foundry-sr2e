/**
 * v0.94.2 (plan items 39 and 44): items nested in other items on the same actor. One parent link, two kinds:
 *  - 'mounted': an accessory (a gear item with an accessory kind) on a weapon, a program on a cyberdeck;
 *  - 'inside': a weapon, armor or gear item inside a container (a gear item marked as one): a bag, a boot, a stash.
 *
 * The link is a flag on the child (`flags.<system>.nest942 = { parent, kind, conv? }`). It counts only while the parent
 * is on the same actor, still fits the kind and no loop forms; anything else (a child given away alone, a parent deleted,
 * a container unmarked) is a dangling link, and the item is simply free. Nothing here writes: the glue is in
 * helpers/nesting942.ts (derived data) and applications/nesting942.ts (the sheets, drops and conversions).
 *
 * Pure (no Foundry): the link, which kinds fit, the family tree, the accessory merge (one function, `mergeAccessories`),
 * the field-to-item conversion and its reverse, a container's load, and whether a program may load.
 */
import { SYSTEM_ID } from '../config/system.ts';

export const NEST_FLAG = 'nest942';
export const LINK_KINDS = ['mounted', 'inside'] as const;
export type LinkKind = typeof LINK_KINDS[number];
/** The deepest chain followed (a bag in a bag in a boot...); deeper links are treated as dangling. */
export const MAX_DEPTH = 8;

export interface NestLink { parent: string; kind: LinkKind; conv?: boolean }
export interface NestItem { id: string; type: string; name?: string; system?: any; flags?: any; _source?: any }
export type Lookup = (id: string) => NestItem | null | undefined;

/** The item types that can go inside a container. */
export const CONTAINABLE_TYPES = ['weapon', 'armor', 'gear'] as const;

/** The accessory kinds a gear item can be, and the weapon fields each one fills. */
export const ACCESSORY_KINDS = ['laserSight', 'scope', 'shockPad', 'support', 'muzzle', 'smartGrenade', 'gyro', 'recoilComp', 'smartgun', 'quickDraw'] as const;
export type AccessoryKind = typeof ACCESSORY_KINDS[number];
/** Kinds that are a plain yes (no rating, no option). */
const BOOL_KINDS = new Set<string>(['laserSight', 'shockPad', 'smartGrenade', 'smartgun', 'quickDraw']);
/** Kinds with a rating, and its cap. */
export const RATED_KINDS: Readonly<Record<string, number>> = { scope: 3, gyro: 20, recoilComp: 20 };
/** Choice fields, worst to best: an effective value is the best of the stored one and every attached item's. */
export const RANKED: Readonly<Record<string, readonly string[]>> = {
  support: ['none', 'bipod', 'tripod'],
  muzzle: ['', 'silencer', 'suppressor'],
  scopeVision: ['', 'lowLight', 'thermographic'],
};
/** The option list an accessory kind offers (the scope's is its vision mode). */
export const KIND_OPTIONS: Readonly<Record<string, readonly string[]>> = {
  scope: RANKED['scopeVision']!, support: ['bipod', 'tripod'], muzzle: ['silencer', 'suppressor'],
};
/** Every weapon field an accessory can give, with its default (models/index.ts WeaponDataModel). */
export const ACCESSORY_FIELD_DEFAULTS: Readonly<Record<string, unknown>> = {
  laserSight: false, scope: 0, scopeVision: '', shockPad: false, support: 'none', muzzle: '', smartGrenade: false,
  gyro: 0, recoilComp: 0, smartgun: false, quickDraw: false,
};
/** The language keys of each kind's name (literal, so the translation checks see them). */
export const ACCESSORY_KIND_KEYS: Readonly<Record<string, string>> = {
  laserSight: 'SR2E.Gear942.kind.laserSight', scope: 'SR2E.Gear942.kind.scope', shockPad: 'SR2E.Gear942.kind.shockPad',
  support: 'SR2E.Gear942.kind.support', muzzle: 'SR2E.Gear942.kind.muzzle', smartGrenade: 'SR2E.Gear942.kind.smartGrenade',
  gyro: 'SR2E.Gear942.kind.gyro', recoilComp: 'SR2E.Gear942.kind.recoilComp', smartgun: 'SR2E.Gear942.kind.smartgun',
  quickDraw: 'SR2E.Gear942.kind.quickDraw',
};
export const OPTION_KEYS: Readonly<Record<string, string>> = {
  lowLight: 'SR2E.Gear942.option.lowLight', thermographic: 'SR2E.Gear942.option.thermographic', bipod: 'SR2E.Gear942.option.bipod',
  tripod: 'SR2E.Gear942.option.tripod', silencer: 'SR2E.Gear942.option.silencer', suppressor: 'SR2E.Gear942.option.suppressor',
};

const ID_RE = /^[A-Za-z0-9]{1,32}$/;
const num = (v: unknown): number => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

/** The parent link an item carries (null: none, or not a valid one; `null` flags on unlinked tokens are "not set"). */
export function readLink(item: { flags?: any } | null | undefined): NestLink | null {
  const raw = item?.flags?.[SYSTEM_ID]?.[NEST_FLAG];
  if (!raw || typeof raw !== 'object') return null;
  const parent = String(raw.parent ?? '');
  const kind = String(raw.kind ?? '') as LinkKind;
  if (!ID_RE.test(parent) || !(LINK_KINDS as readonly string[]).includes(kind)) return null;
  return raw.conv ? { parent, kind, conv: true } : { parent, kind };
}

/** The flag value for a link (what the glue writes under `flags.<system>.nest942`). */
export function linkValue(parent: string, kind: LinkKind, conv = false): NestLink {
  return conv ? { parent, kind, conv: true } : { parent, kind };
}

/** A gear item's nesting data (`system.nest942`), cleaned. */
export function nestData(item: { type?: string; system?: any } | null | undefined): { container: boolean; capacity: number; accessory: AccessoryKind | ''; rating: number; option: string } {
  const n = item?.type === 'gear' ? item.system?.nest942 ?? {} : {};
  const accessory = (ACCESSORY_KINDS as readonly string[]).includes(String(n.accessory ?? '')) ? String(n.accessory) as AccessoryKind : '';
  return { container: Boolean(n.container), capacity: Math.max(0, num(n.capacity)), accessory, rating: Math.max(0, Math.floor(num(n.rating))), option: String(n.option ?? '') };
}

export const isContainer = (item: { type?: string; system?: any } | null | undefined): boolean => nestData(item).container;

/** An accessory's spec (null when the item isn't one). */
export interface AccessorySpec { kind: AccessoryKind; rating: number; option: string }
export function accessoryOf(item: { type?: string; system?: any } | null | undefined): AccessorySpec | null {
  const d = nestData(item);
  return d.accessory ? { kind: d.accessory, rating: d.rating, option: d.option } : null;
}

/** An ammunition clip (gear with a round type that is neither an accessory nor a container): dropped on a gun, it loads. */
export function isAmmoClip(item: { type?: string; system?: any } | null | undefined): boolean {
  return item?.type === 'gear' && Boolean(item.system?.ammoType) && !accessoryOf(item) && !isContainer(item);
}

/** The link kind a child would have on a parent (null: it can't go there). */
export function linkKindFor(child: NestItem | null | undefined, parent: NestItem | null | undefined): LinkKind | null {
  if (!child || !parent || child.id === parent.id) return null;
  if (parent.type === 'weapon' && child.type === 'gear' && accessoryOf(child)) return 'mounted';
  if (parent.type === 'cyberdeck' && child.type === 'program') return 'mounted';
  if (isContainer(parent) && (CONTAINABLE_TYPES as readonly string[]).includes(child.type)) return 'inside';
  return null;
}

/** A lookup over a list of items, or over a collection with `get` (an actor's items). */
export function lookupOf(items: Iterable<NestItem> | { get(id: string): any } | null | undefined): Lookup {
  if (!items) return () => null;
  if (typeof (items as any).get === 'function' && !(items instanceof Map)) return (id) => (items as any).get(id) ?? null;
  const m = new Map<string, NestItem>();
  for (const i of (items instanceof Map ? items.values() : items) as Iterable<NestItem>) if (i?.id) m.set(i.id, i);
  return (id) => m.get(id) ?? null;
}

/** The lookup of the actor an item sits on (null for an item that isn't on an actor). */
export function lookupFromItem(item: any): Lookup | null {
  const coll = item?.parent?.items;
  return coll && typeof coll.get === 'function' ? (id) => coll.get(id) ?? null : null;
}

/**
 * The item's parent, when its link holds: the parent is on the same actor (the lookup), still takes this kind, and
 * following the chain up never comes back to the child nor goes deeper than MAX_DEPTH. Null: the item is free.
 */
export function resolveParent(item: NestItem | null | undefined, lookup: Lookup | null): { parent: NestItem; kind: LinkKind } | null {
  if (!item || !lookup) return null;
  const link = readLink(item);
  if (!link) return null;
  const parent = lookup(link.parent);
  if (!parent || linkKindFor(item, parent) !== link.kind) return null;
  // Walk up: a loop (A in B in A) or an over-deep chain makes the link dangling.
  const seen = new Set<string>([item.id]);
  let cur: NestItem | null | undefined = parent;
  for (let depth = 0; cur; depth++) {
    if (seen.has(cur.id) || depth >= MAX_DEPTH) return null;
    seen.add(cur.id);
    const up = readLink(cur);
    if (!up) break;
    const next = lookup(up.parent);
    if (!next || linkKindFor(cur, next) !== up.kind) break;
    cur = next;
  }
  return { parent, kind: link.kind };
}

/** The chain of parents above an item, nearest first (with each link's kind). */
export function ancestorsOf(item: NestItem | null | undefined, lookup: Lookup | null): Array<{ item: NestItem; kind: LinkKind }> {
  const out: Array<{ item: NestItem; kind: LinkKind }> = [];
  let cur = item;
  for (let i = 0; cur && i < MAX_DEPTH; i++) {
    const r = resolveParent(cur, lookup);
    if (!r) break;
    out.push({ item: r.parent, kind: r.kind });
    cur = r.parent;
  }
  return out;
}

/** Whether the item is packed away: inside a container, or mounted on something that is. */
export function isStowed(item: NestItem | null | undefined, lookup: Lookup | null): boolean {
  return ancestorsOf(item, lookup).some((a) => a.kind === 'inside');
}

/** The items whose link holds to this parent (optionally one kind). */
export function childrenOf(parentId: string, items: Iterable<NestItem>, kind?: LinkKind): NestItem[] {
  const list = [...items];
  const lookup = lookupOf(list);
  return list.filter((i) => { const r = resolveParent(i, lookup); return r && r.parent.id === parentId && (!kind || r.kind === kind); });
}

/** Every item under a parent, breadth first (children, then theirs). */
export function descendantsOf(parentId: string, items: Iterable<NestItem>): NestItem[] {
  const list = [...items];
  const out: NestItem[] = [];
  const seen = new Set<string>([parentId]);
  let frontier = [parentId];
  while (frontier.length && out.length < 1000) {
    const next: string[] = [];
    for (const pid of frontier) {
      for (const c of childrenOf(pid, list)) {
        if (seen.has(c.id)) continue;
        seen.add(c.id); out.push(c); next.push(c.id);
      }
    }
    frontier = next;
  }
  return out;
}

/** Items with a link at all (valid or not) naming this parent: what to clear when the parent goes. */
export function linkedTo(parentId: string, items: Iterable<NestItem>): NestItem[] {
  return [...items].filter((i) => readLink(i)?.parent === parentId);
}

/** Whether `child` may be put on `parent` now (fits the kind, and no loop: the parent isn't under the child). */
export function canNest(child: NestItem | null | undefined, parent: NestItem | null | undefined, items: Iterable<NestItem>): LinkKind | null {
  const kind = linkKindFor(child, parent);
  if (!kind || !child || !parent) return null;
  const list = [...items];
  if (descendantsOf(child.id, list).some((d) => d.id === parent.id)) return null;
  if (ancestorsOf(parent, lookupOf(list)).length + 1 >= MAX_DEPTH) return null;
  return kind;
}

/** The parents an item could go on (for the "Put in…" picker), in list order. */
export function parentChoices(child: NestItem, items: Iterable<NestItem>): Array<{ item: NestItem; kind: LinkKind }> {
  const list = [...items];
  const out: Array<{ item: NestItem; kind: LinkKind }> = [];
  for (const p of list) { const k = canNest(child, p, list); if (k) out.push({ item: p, kind: k }); }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------------
// Accessories
// ---------------------------------------------------------------------------------------------------------------------

/** The weapon fields one accessory gives (nothing for a zero rating or an unknown option). */
export function accessoryEffects(spec: AccessorySpec | null | undefined): Record<string, unknown> {
  if (!spec) return {};
  const k = spec.kind;
  if (BOOL_KINDS.has(k)) return { [k]: true };
  if (k === 'scope') {
    const out: Record<string, unknown> = {};
    const r = Math.min(RATED_KINDS['scope']!, Math.max(0, Math.floor(num(spec.rating))));
    if (r > 0) out['scope'] = r;
    if (spec.option && RANKED['scopeVision']!.includes(spec.option)) out['scopeVision'] = spec.option;
    return out;
  }
  if (k === 'gyro' || k === 'recoilComp') {
    const r = Math.min(RATED_KINDS[k]!, Math.max(0, Math.floor(num(spec.rating))));
    return r > 0 ? { [k]: r } : {};
  }
  if (k === 'support' || k === 'muzzle') return KIND_OPTIONS[k]!.includes(spec.option) ? { [k]: spec.option } : {};
  return {};
}

const rank = (field: string, v: unknown): number => RANKED[field]!.indexOf(String(v ?? ''));

/**
 * THE merge: a weapon's effective accessory values from its stored fields and its attached accessories. Yes/no fields
 * are OR'd, ratings take the highest, choices take the best (RANKED). Every accessory field is returned (the stored value
 * where nothing beats it), so derived data can be rebuilt from the stored values each time. `from` names, per field,
 * the attached items that gave or matched the winning value.
 */
export function mergeAccessories(stored: Record<string, unknown> | null | undefined, attached: ReadonlyArray<{ name: string; spec: AccessorySpec | null }>): { values: Record<string, unknown>; from: Record<string, string[]> } {
  const s = stored ?? {};
  const values: Record<string, unknown> = {};
  for (const [f, def] of Object.entries(ACCESSORY_FIELD_DEFAULTS)) values[f] = s[f] ?? def;
  const from: Record<string, string[]> = {};
  for (const a of attached ?? []) {
    for (const [f, v] of Object.entries(accessoryEffects(a.spec))) {
      const cur = values[f];
      let better = false; let same = false;
      if (typeof ACCESSORY_FIELD_DEFAULTS[f] === 'boolean') { better = !cur && Boolean(v); same = Boolean(cur) && Boolean(v); }
      else if (typeof ACCESSORY_FIELD_DEFAULTS[f] === 'number') { better = num(v) > num(cur); same = num(v) === num(cur); }
      else if (RANKED[f]) { better = rank(f, v) > rank(f, cur); same = rank(f, v) === rank(f, cur); }
      if (better) { values[f] = v; from[f] = [a.name]; }
      else if (same && from[f]) from[f]!.push(a.name);
    }
  }
  return { values, from };
}

/** One accessory item to make from a weapon's fields, and the fields it takes over (with their stored values). */
export interface ConversionStep { kind: AccessoryKind; rating: number; option: string; clears: Record<string, unknown> }

/** The accessory items a weapon's stored fields become ("Make accessory items"); empty when every field is at its default. */
export function conversionPlan(system: Record<string, unknown> | null | undefined): ConversionStep[] {
  const s = system ?? {};
  const out: ConversionStep[] = [];
  for (const k of BOOL_KINDS) if (s[k] === true) out.push({ kind: k as AccessoryKind, rating: 0, option: '', clears: { [k]: true } });
  const scope = Math.max(0, Math.floor(num(s['scope'])));
  const vision = RANKED['scopeVision']!.includes(String(s['scopeVision'] ?? '')) ? String(s['scopeVision'] ?? '') : '';
  if (scope > 0 || vision) out.push({ kind: 'scope', rating: scope, option: vision, clears: { scope, scopeVision: vision } });
  for (const k of ['support', 'muzzle'] as const) {
    const v = String(s[k] ?? '');
    if (KIND_OPTIONS[k]!.includes(v)) out.push({ kind: k, rating: 0, option: v, clears: { [k]: v } });
  }
  for (const k of ['gyro', 'recoilComp'] as const) {
    const r = Math.max(0, Math.floor(num(s[k])));
    if (r > 0) out.push({ kind: k, rating: r, option: '', clears: { [k]: r } });
  }
  return out;
}

/** The weapon update that clears what a conversion took over (`system.<field>` → its default). */
export function conversionClears(plan: readonly ConversionStep[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const step of plan) for (const f of Object.keys(step.clears)) out[`system.${f}`] = ACCESSORY_FIELD_DEFAULTS[f];
  return out;
}

/**
 * The weapon update that puts attached accessories back into its fields ("Back to fields", the conversion's undo): the
 * stored values merged with what the items give now (so an item edited since keeps its edit). Only changed fields.
 */
export function revertUpdate(stored: Record<string, unknown> | null | undefined, specs: ReadonlyArray<AccessorySpec | null>): Record<string, unknown> {
  const merged = mergeAccessories(stored, specs.map((spec) => ({ name: '', spec }))).values;
  const s = stored ?? {};
  const out: Record<string, unknown> = {};
  for (const [f, v] of Object.entries(merged)) if ((s[f] ?? ACCESSORY_FIELD_DEFAULTS[f]) !== v) out[`system.${f}`] = v;
  return out;
}

// ---------------------------------------------------------------------------------------------------------------------
// Containers and decks
// ---------------------------------------------------------------------------------------------------------------------

/** A container's load: the weight (kg) and count of everything under it, against its capacity (0 = no limit). */
export function containerLoad(container: NestItem, items: Iterable<NestItem>): { kg: number; count: number; capacity: number; over: boolean } {
  const under = descendantsOf(container.id, items);
  const kg = Math.round(under.reduce((n, i) => n + Math.max(0, num(i.system?.weight)) * Math.max(0, num(i.system?.quantity ?? 1)), 0) * 100) / 100;
  const capacity = nestData(container).capacity;
  return { kg, count: under.length, capacity, over: capacity > 0 && kg > capacity };
}

/** The deck a program is stored on (null: a free program, stored on whichever deck is in use, as before). */
export function programDeck(program: NestItem | null | undefined, lookup: Lookup | null): NestItem | null {
  const r = resolveParent(program, lookup);
  return r && r.kind === 'mounted' && r.parent.type === 'cyberdeck' ? r.parent : null;
}

/** Whether a program may be loaded: a free one always (as before); one stored on a deck only while that deck is in use. */
export function programMayLoad(program: NestItem | null | undefined, lookup: Lookup | null): boolean {
  const deck = programDeck(program, lookup);
  return !deck || Boolean(deck.system?.active);
}

// ---------------------------------------------------------------------------------------------------------------------
// Moving and copying
// ---------------------------------------------------------------------------------------------------------------------

/**
 * Item data (plain, as `toObject()` gives) with each link pointed at the new ids (`idMap`: old id → new id). A link to
 * an id outside the map is left as it is (it dangles on the new actor and is ignored there).
 */
export function remapLinks<T extends { flags?: any }>(data: T[], idMap: ReadonlyMap<string, string> | Record<string, string>): T[] {
  const get = (id: string): string | undefined => (idMap instanceof Map ? idMap.get(id) : (idMap as Record<string, string>)[id]);
  return data.map((d) => {
    const link = readLink(d);
    const to = link ? get(link.parent) : undefined;
    if (!link || !to) return d;
    return { ...d, flags: { ...(d.flags ?? {}), [SYSTEM_ID]: { ...(d.flags?.[SYSTEM_ID] ?? {}), [NEST_FLAG]: linkValue(to, link.kind, Boolean(link.conv)) } } };
  });
}

/** Item data without its link (a copy that should arrive free). */
export function withoutLink<T extends { flags?: any }>(d: T): T {
  if (!d?.flags?.[SYSTEM_ID] || !(NEST_FLAG in d.flags[SYSTEM_ID])) return d;
  const sys = { ...d.flags[SYSTEM_ID] };
  delete sys[NEST_FLAG];
  return { ...d, flags: { ...d.flags, [SYSTEM_ID]: sys } };
}

/**
 * v0.94.2 (lead): the nesting hooks for a give, stash or loot (rules/trade942.ts PlanOptions): the whole family moves
 * with a whole item, the moved item leaves its own parent, children follow a parent whose id changed.
 * Items are rules/trade942.ts TradeItem (their full data in `data`).
 */
export const TRADE_NEST_HOOKS: {
  childrenOf: <T extends { id: string; type: string; system?: any; data?: Record<string, any> }>(item: T, all: readonly T[]) => T[];
  clearFlags: readonly string[];
  relink: (child: Record<string, any>, oldParentId: string, newParentId: string) => Record<string, any>;
} = {
  childrenOf: (item, all) => {
    const byId = new Map(all.map((t) => [t.id, t]));
    return descendantsOf(item.id, all.map((t) => ({ id: t.id, type: t.type, system: t.system, flags: t.data?.['flags'] })))
      .map((n) => byId.get(n.id)).filter((t): t is NonNullable<typeof t> => Boolean(t));
  },
  clearFlags: [NEST_FLAG],
  relink: (child, oldParentId, newParentId) => remapLinks([child], new Map([[oldParentId, newParentId]]))[0] ?? child,
};
