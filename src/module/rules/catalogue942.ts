/**
 * v0.94.2 (improvement plan item 32): the GM's catalogue lives in a world compendium, not in one big world setting.
 * The pure part: a compendium item as a catalogue template and back, what a save changes in the compendium, and what
 * the one-time move from the old setting (`itemTemplates`) copies. The Foundry side is applications/catalogue942.ts.
 *
 * - The compendium is `world.sr2e-item-templates`, the one "Templates to a compendium" wrote to since v0.66.0: an
 *   export made then is picked up as it is.
 * - A template's id (what shop keys and kits name: `tpl:w:<id>`) rides on the item as `flags.<system>.templateId`; an
 *   item the GM put in the compendium by hand has none and is known as `p-<its id>`.
 * - A template keeps only what differs from an empty item of its type (`sparseSystem`), as the setting held it, so the
 *   CSV export and the merge rules see what the GM typed, not every default.
 */
import type { ItemTemplate } from './items.ts';

/** The world compendium's name (its collection is `world.<name>`). */
export const CATALOGUE_PACK_NAME = 'sr2e-item-templates';
/** The id prefix of a compendium item that carries no template id. */
export const PACK_ID_PREFIX = 'p-';

const isObj = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === 'object' && !Array.isArray(v);

export function stableJson(v: unknown): string {
  if (Array.isArray(v)) return '[' + v.map(stableJson).join(',') + ']';
  if (isObj(v)) return '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + stableJson(v[k])).join(',') + '}';
  return JSON.stringify(v ?? null);
}

function clone<T>(v: T): T {
  try { return structuredClone(v); } catch { return JSON.parse(JSON.stringify(v ?? null)); }
}

/**
 * Pure: the parts of `full` that differ from `initial` (an empty item's system data), nested objects walked, lists
 * compared whole. With no `initial` (unknown type) everything is kept.
 */
export function sparseSystem(full: unknown, initial: unknown): Record<string, unknown> {
  if (!isObj(full)) return {};
  if (!isObj(initial)) return clone(full);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(full)) {
    if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
    const base = initial[k];
    if (isObj(v) && isObj(base)) {
      const sub = sparseSystem(v, base);
      if (Object.keys(sub).length) out[k] = sub;
    } else if (stableJson(v) !== stableJson(base)) out[k] = clone(v);
  }
  return out;
}

/** A compendium item as this file reads it. */
export interface PackItem { _id: string; name: string; type: string; system: Record<string, unknown>; flags?: Record<string, any> }

/** Pure: a compendium item as a catalogue template (`scope` is the system's flag scope). */
export function templateFromPackItem(d: PackItem, initial: unknown, scope: string): ItemTemplate {
  const f = d.flags?.[scope] ?? {};
  const tid = typeof f.templateId === 'string' && f.templateId ? f.templateId : `${PACK_ID_PREFIX}${d._id}`;
  return { id: tid, type: d.type, name: d.name, system: sparseSystem(d.system, initial), ...(f.shop === true ? { shop: true } : {}) };
}

/** Pure: the item data a template makes in the compendium. */
export function packDataFromTemplate(t: ItemTemplate, scope: string): { name: string; type: string; system: Record<string, unknown>; flags: Record<string, any> } {
  const own: Record<string, unknown> = {};
  if (!t.id.startsWith(PACK_ID_PREFIX)) own['templateId'] = t.id;
  if (t.shop) own['shop'] = true;
  return { name: t.name, type: t.type, system: clone(t.system ?? {}), flags: { [scope]: own } };
}

/** Pure: what makes two templates the same entry as saved (the "from the list" `world` mark is the reader's, not data). */
export function templateSignature(t: ItemTemplate): string {
  return stableJson({ name: t.name, type: t.type, system: t.system ?? {}, shop: Boolean(t.shop) });
}

/** A template as it is in the compendium: the item's id there and the template read from it. */
export interface Stored { docId: string; template: ItemTemplate }

/** What a save does to the compendium. */
export interface CatalogueSyncPlan {
  create: ItemTemplate[];
  update: Array<{ docId: string; template: ItemTemplate }>;
  remove: string[];
}

/**
 * Pure: the compendium changes that make it hold `next` (the list a catalogue tool saves). Matched by template id
 * (a hand-placed item by its `p-` id); changed ones are updated, new ones created, the rest removed (unless
 * `keepOthers`: the move from the old setting never removes anything).
 */
export function catalogueSyncPlan(stored: readonly Stored[], next: readonly ItemTemplate[], o: { keepOthers?: boolean } = {}): CatalogueSyncPlan {
  const plan: CatalogueSyncPlan = { create: [], update: [], remove: [] };
  const byId = new Map(stored.map((s) => [s.template.id, s]));
  const seen = new Set<string>();
  for (const raw of next) {
    if (!raw || typeof raw.id !== 'string' || !raw.id || seen.has(raw.id)) continue;
    const { world: _w, ...t } = raw as ItemTemplate & { world?: boolean };
    seen.add(t.id);
    const s = byId.get(t.id);
    if (!s) plan.create.push(t);
    else if (templateSignature(s.template) !== templateSignature(t)) plan.update.push({ docId: s.docId, template: t });
  }
  if (!o.keepOthers) for (const s of stored) if (!seen.has(s.template.id)) plan.remove.push(s.docId);
  return plan;
}

/**
 * Pure: the one-time move. The old setting's templates go into the compendium (the setting wins over an older export
 * of the same template); nothing in the compendium is removed and the setting itself is left alone.
 */
export function migrationPlan(stored: readonly Stored[], old: readonly ItemTemplate[]): CatalogueSyncPlan {
  // An export from before v0.94.2 matched by type and name and tagged the item with the template id: match by id first,
  // then by type and name for an export of a template whose id changed since.
  const byId = new Set(stored.map((s) => s.template.id));
  const oldIds = new Set(old.map((t) => t.id));
  const byName = new Map(stored.map((s) => [`${s.template.type}|${s.template.name}`, s]));
  const renamed: Stored[] = [];
  for (const t of old) {
    if (byId.has(t.id)) continue;
    const s = byName.get(`${t.type}|${t.name}`);
    if (s && !oldIds.has(s.template.id) && !renamed.some((r) => r.docId === s.docId)) renamed.push({ docId: s.docId, template: { ...s.template, id: t.id } });
  }
  const view = stored.map((s) => renamed.find((r) => r.docId === s.docId) ?? s);
  const plan = catalogueSyncPlan(view, old, { keepOthers: true });
  // A hand-placed item matched by name takes the old template's id (an update that writes it).
  for (const r of renamed) if (!plan.update.some((u) => u.docId === r.docId)) plan.update.push({ docId: r.docId, template: old.find((t) => t.id === r.template.id)! });
  return plan;
}

/** Pure: whether every old template is in the compendium now (the old copy may then be removed). */
export function oldCopyCovered(stored: readonly Stored[], old: readonly ItemTemplate[]): { covered: boolean; missing: string[] } {
  const ids = new Set(stored.map((s) => s.template.id));
  const missing = old.filter((t) => !ids.has(t.id)).map((t) => t.name);
  return { covered: missing.length === 0, missing };
}
