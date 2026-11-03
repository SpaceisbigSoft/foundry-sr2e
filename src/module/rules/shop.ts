/**
 * v0.91.0: the shop (the Add window as the place to buy things). Pure rules: which entries players see, a row's
 * price, Availability and legality, who buys by finding first, and the wait before a failed find may be tried
 * again. The window is `applications/adding.ts`, the shop's Foundry glue `applications/shop.ts`, and the find and
 * buy themselves `SR2Actor.findFromShop` / `buyFromShop` (documents/index.ts). Values in RULES.SHOP_V91.
 */
import { RULES } from './config.ts';
import { BOUGHT_TYPES, entryPrice, entryAvailability, rowAmount, copiesOf } from './catalogue.ts';
import { legalityOf } from './outfit.ts';
import { itemAcquireHours } from './waiting.ts';
import type { ShopListMode } from './config91.ts';

/** Where a shop entry comes from, read from its key (the Add window's entry keys). */
export type ShopSource = 'builtin' | 'world' | 'worldItem' | 'worldActor' | 'pack' | 'kit' | 'unknown';

/**
 * A shop key: `tpl:b:<id>` (built-in template), `tpl:w:<id>` (the GM's template), `world:<uuid>`, `pack:<uuid>`, `kit:<id>#<line>`;
 * v0.91.4: `actor:<uuid>` (a world vehicle or drone: in the catalogue folder, or marked "in the shop").
 */
export function shopSourceOf(key: unknown): ShopSource {
  const k = String(key ?? '');
  if (k.startsWith('tpl:b:')) return 'builtin';
  if (k.startsWith('tpl:w:')) return 'world';
  if (k.startsWith('world:')) return 'worldItem';
  if (k.startsWith('actor:')) return 'worldActor';
  if (k.startsWith('pack:')) return 'pack';
  if (k.startsWith('kit:')) return 'kit';
  return 'unknown';
}

/** A shop key's parts; null when it isn't one (or is too long to be real). */
export function parseShopKey(key: unknown): { source: Exclude<ShopSource, 'unknown'>; id: string; line?: number } | null {
  const k = String(key ?? '');
  if (!k || k.length > 300) return null;
  const source = shopSourceOf(k);
  if (source === 'unknown') return null;
  if (source === 'kit') {
    const m = /^kit:([^#]+)#(\d{1,3})$/.exec(k);
    return m ? { source, id: m[1]!, line: Number(m[2]) } : null;
  }
  const id = source === 'builtin' || source === 'world' || source === 'worldItem' || source === 'worldActor' ? k.slice(6) : k.slice(5);
  return id ? { source, id } : null;
}

const MODES: readonly ShopListMode[] = ['all', 'catalogue', 'marked'];
/** The world setting's value, read safely ('all' when unknown). */
export function shopListMode(v: unknown): ShopListMode {
  return (MODES as readonly string[]).includes(String(v)) ? (v as ShopListMode) : 'all';
}

/** Is a type sold in the shop (and so filtered by the shop list)? Spells, powers and skills are not (yet). */
export function soldInShop(type: string): boolean {
  return type === 'kit' || BOUGHT_TYPES.includes(type);
}

/**
 * Does a player see this entry? The GM sees everything. Things the shop doesn't sell are never filtered.
 * A forbidden item is hidden unless the GM allows them; then the shop list: everything, the GM's catalogue
 * (their templates, world items and kits), or only what the GM marked "in the shop" (and kits).
 */
export function shopShows(o: { key: string; type: string; legality?: unknown; marked?: boolean; mode: ShopListMode; isGM: boolean; allowForbidden: boolean }): boolean {
  if (o.isGM) return true;
  if (!soldInShop(o.type)) return true;
  if (!o.allowForbidden && String(o.legality ?? '') === 'forbidden') return false;
  const src = shopSourceOf(o.key);
  if (o.mode === 'all') return src !== 'unknown';
  if (src === 'kit') return true;
  // v0.91.4: the GM's vehicles (world actors) are their catalogue too.
  if (o.mode === 'catalogue') return src === 'world' || src === 'worldItem' || src === 'worldActor';
  return (src === 'world' || src === 'worldItem' || src === 'worldActor') && Boolean(o.marked);
}

/** Does this buyer find things before buying (RULES.SHOP_V91.buying)? Player characters out of creation. */
export function buysByFinding(o: { isGM: boolean; actorType: string; inCreation: boolean }): boolean {
  return RULES.SHOP_V91.buying === 'find' && !o.isGM && o.actorType === 'character' && !o.inCreation;
}

/** A shop row's numbers: the price (Street Index counted), Availability, its base time, and legality. */
export function shopRowInfo(type: string, system: any): { price: number; streetIndex: number; avail: string; tn: number; baseHours: number; legality: string; legalityLabel: string; forbidden: boolean } {
  const s = system ?? {};
  const av = entryAvailability(type, s);
  const legality = String(s.legality ?? '');
  const row = legalityOf(legality);
  const si = Number(s.streetIndex);
  return {
    price: entryPrice(type, s, 1),
    streetIndex: Number.isFinite(si) && si > 0 ? si : 1,
    avail: av.label, tn: av.tn,
    baseHours: itemAcquireHours(type, s, 0) / Math.max(0.0001, Number(RULES.WAITING.orderFactor) || 1),
    legality, legalityLabel: legality ? row.label : '', forbidden: legality === 'forbidden',
  };
}

/**
 * The flag key a failed find is kept under (flag keys may not hold dots: Foundry would split them). The key's
 * letters, plus a short hash of the whole key so two keys that clean up alike stay apart.
 */
export function retryFlagKey(key: string): string {
  const k = String(key ?? '');
  let h = 2166136261;
  for (let i = 0; i < k.length; i++) { h ^= k.charCodeAt(i); h = Math.imul(h, 16777619); }
  return `${k.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 80)}_${(h >>> 0).toString(36)}`;
}

/** When a failed find may be tried again (world seconds): now + the base time. */
export function retryReadyAt(now: number, baseHours: number): number {
  return Math.round((Number(now) || 0) + Math.max(0, Number(baseHours) || 0) * 3600);
}

/** Hours until a failed find may be tried again (0 = it may). The GM is never held back; RULES.SHOP_V91.retry 'any' never waits. */
export function retryHoursLeft(entry: { at?: unknown } | null | undefined, now: number, isGM = false): number {
  if (isGM || RULES.SHOP_V91.retry !== 'wait' || !entry || typeof entry !== 'object') return 0;
  const at = Number(entry.at);
  if (!Number.isFinite(at)) return 0;
  return Math.max(0, (at - (Number(now) || 0)) / 3600);
}

/** Is a project an order (something bought, on its way)? */
export function isOrder(p: { kind?: unknown } | null | undefined): boolean {
  return String(p?.kind ?? '') === 'order';
}

/**
 * How many of a thing one purchase is: copies (capped as the Add window caps them), a gear quantity (1–1000), or 1
 * for things bought at their listed rating (a focus, a program).
 */
export function copiesOrQuantity(type: string, qty: unknown): number {
  const n = Math.max(1, Math.floor(Number(qty)) || 1);
  if (type === 'gear') return Math.min(1000, n);
  return rowAmount(type).kind === 'copies' ? copiesOf(type, n) : 1;
}
