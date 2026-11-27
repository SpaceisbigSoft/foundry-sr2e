/**
 * v0.94.2 (improvement plan item 32): the GM's catalogue in a world compendium (`world.sr2e-item-templates`).
 *
 * - `catalogueTemplates()` is what every catalogue reader uses (the shop and the Add window, the Catalogue, the Setup
 *   tab, the new-entry form, the CSV and file tools): the templates read from the compendium, kept in memory and read
 *   again when an item in it changes. Until the compendium is read (and in a world whose catalogue hasn't moved yet) it
 *   gives the old world setting `itemTemplates`, so nothing goes missing on the way.
 * - `saveCatalogueTemplates(list)` (GM) writes a whole list, as the setting was written: new templates become items in
 *   the compendium, changed ones are updated, removed ones deleted.
 * - On the GM's first load the compendium is made if it is missing (Observer for players: the shop reads it) and the
 *   old setting is copied into it once (setting `catalogueMoved942`). The setting is left as it was: the GM removes the
 *   old copy with "Remove the old copy" on the Setup tab once the catalogue looks right (`removeOldCatalogueCopy`).
 * - The GM can also drop items straight into the compendium or edit them there: they show in the shop.
 * Pure parts: rules/catalogue942.ts. This file pulls in no window code (the shop's glue, which documents/index.ts
 * imports, reads it).
 */
import { SYSTEM_ID } from '../config/system.ts';
import { t as tx, tCount } from '../helpers/i18n.ts';
import { escHtml } from '../rules/html.ts';
import type { ItemTemplate } from '../rules/items.ts';
import {
  CATALOGUE_PACK_NAME, templateFromPackItem, packDataFromTemplate, catalogueSyncPlan, migrationPlan, oldCopyCovered,
  type Stored, type CatalogueSyncPlan,
} from '../rules/catalogue942.ts';

/** The world setting that marks the one-time move done. */
export const CATALOGUE_MOVED = 'catalogueMoved942';
export const catalogueCollection = (): string => `world.${CATALOGUE_PACK_NAME}`;

let stored: Stored[] | null = null;
let writing: Promise<unknown> = Promise.resolve();
let reloadTimer: ReturnType<typeof setTimeout> | null = null;
/** True while this client writes to the compendium itself (its own hooks then don't read it again item by item). */
let selfWrite = 0;

const isGm = (): boolean => Boolean((game as any).user?.isGM);
const settingOr = <T>(key: string, fallback: T): T => { try { return ((game as any).settings.get(SYSTEM_ID, key) as T) ?? fallback; } catch { return fallback; } };

/** The old world setting's templates (what the catalogue was before v0.94.2). */
export function legacyTemplates(): ItemTemplate[] {
  return [...settingOr<ItemTemplate[]>('itemTemplates', [])];
}

/** The catalogue compendium, or null when it doesn't exist (or this user can't see it). */
export function cataloguePack(): any | null {
  return (game as any).packs?.get?.(catalogueCollection()) ?? null;
}

/** Whether the compendium is the catalogue's home now (read, and the old setting moved into it). */
export function catalogueInPack(): boolean {
  return stored !== null && settingOr<boolean>(CATALOGUE_MOVED, false) === true;
}

/** The GM's catalogue templates (see the file comment). A fresh array each call. */
export function catalogueTemplates(): ItemTemplate[] {
  if (catalogueInPack()) return stored!.map((s) => ({ ...s.template }));
  return legacyTemplates();
}

/** An empty item's system data of a type (what `sparseSystem` compares against); {} for an unknown type. */
function initialSystem(type: string): Record<string, unknown> {
  try { const Cls: any = (CONFIG as any).Item.documentClass; return new Cls({ name: 'x', type }).system.toObject(); } catch { return {}; }
}

/** Read the compendium into memory (every client). Null when there is none. */
export async function loadCatalogue942(): Promise<Stored[] | null> {
  const pack = cataloguePack();
  if (!pack) { stored = null; return null; }
  let docs: any[] = [];
  try { docs = await pack.getDocuments(); } catch (err) { console.warn('sr2e | catalogue compendium', err); stored = null; return null; }
  const types = Object.keys((CONFIG as any).Item?.dataModels ?? {});
  const initial = new Map<string, Record<string, unknown>>();
  stored = docs.filter((d: any) => !types.length || types.includes(d.type)).map((d: any) => {
    if (!initial.has(d.type)) initial.set(d.type, initialSystem(d.type));
    const src = typeof d.toObject === 'function' ? d.toObject() : d;
    return { docId: String(d.id ?? src._id), template: templateFromPackItem({ _id: String(d.id ?? src._id), name: String(src.name), type: String(src.type), system: src.system ?? {}, flags: src.flags ?? {} }, initial.get(d.type), SYSTEM_ID) };
  });
  return stored;
}

/** GM: the catalogue compendium, made when missing (null when it couldn't be). */
export async function ensureCataloguePack(): Promise<any | null> {
  const have = cataloguePack();
  if (have || !isGm()) return have;
  const CC: any = (foundry as any).documents?.collections?.CompendiumCollection ?? (globalThis as any).CompendiumCollection;
  try {
    return await CC?.createCompendium?.({ type: 'Item', label: tx('SR2E.Catalogue942.packLabel'), name: CATALOGUE_PACK_NAME, package: 'world', ownership: { PLAYER: 'OBSERVER', ASSISTANT: 'OWNER' } }) ?? null;
  } catch (err) { console.warn('sr2e | catalogue compendium', err); return null; }
}

/** Carry out a sync plan on the compendium (unlocked for the write, locked again after when it was). */
async function applyPlan(pack: any, plan: CatalogueSyncPlan): Promise<void> {
  if (!plan.create.length && !plan.update.length && !plan.remove.length) return;
  const ItemCls: any = (CONFIG as any).Item.documentClass;
  const wasLocked = Boolean(pack.locked);
  selfWrite++;
  try {
    if (wasLocked) await pack.configure?.({ locked: false });
    const o = { pack: pack.collection };
    if (plan.create.length) await ItemCls.createDocuments(plan.create.map((t) => packDataFromTemplate(t, SYSTEM_ID)), o);
    // The whole system object is replaced (a field the GM cleared goes back to its default).
    if (plan.update.length) await ItemCls.updateDocuments(plan.update.map((u) => ({ _id: u.docId, ...packDataFromTemplate(u.template, SYSTEM_ID) })), { ...o, recursive: false });
    if (plan.remove.length) await ItemCls.deleteDocuments(plan.remove, o);
  } finally {
    if (wasLocked) { try { await pack.configure?.({ locked: true }); } catch { /* stays unlocked */ } }
    selfWrite--;
  }
}

/**
 * GM: save the whole catalogue (what every catalogue tool used to write to the setting). Into the compendium once the
 * catalogue lives there; into the old setting before that (a world that couldn't make the compendium).
 */
export function saveCatalogueTemplates(list: readonly ItemTemplate[]): Promise<void> {
  const clean = list.map(({ world: _w, ...t }: any) => t as ItemTemplate);
  // v0.94.2 review (finding 14): the compendium items the caller's list could have been built from (the store as it is
  // now, and only once the catalogue lives there). Only those may be removed by this save.
  const known = new Set(catalogueInPack() ? (stored ?? []).map((s) => s.docId) : []);
  const run = async () => {
    if (!isGm()) return;
    const pack = catalogueInPack() ? cataloguePack() : null;
    if (!pack) { await (game as any).settings.set(SYSTEM_ID, 'itemTemplates', clean); return; }
    await loadCatalogue942();
    await applyPlan(pack, catalogueSyncPlan(stored ?? [], clean, { removable: known }));
    await loadCatalogue942();
    refreshCatalogueWindows();
  };
  return onWriting(run);
}

/** Run a catalogue write after every earlier one (saves and the one-time move share the queue). */
function onWriting<T>(run: () => Promise<T>): Promise<T> {
  const next = writing.then(run, run);
  writing = next.catch(() => undefined);
  return next;
}

/** GM, once per world: make the compendium and copy the old setting into it (nothing is removed anywhere). */
export function migrateCatalogue942(): Promise<number> {
  // v0.94.2 review (finding 14): on the write queue, so a save made meanwhile waits for the move and lands in the compendium.
  return onWriting(migrateNow);
}

async function migrateNow(): Promise<number> {
  if (!isGm()) return 0;
  // Moved before and the compendium still there: read it. (A compendium the GM deleted is made again from the setting.)
  if (settingOr<boolean>(CATALOGUE_MOVED, false) === true && cataloguePack()) { await loadCatalogue942(); return 0; }
  const pack = await ensureCataloguePack();
  if (!pack) { ui.notifications?.warn?.(tx('SR2E.Catalogue942.noPack')); return 0; }
  const old = legacyTemplates();
  await loadCatalogue942();
  const plan = migrationPlan(stored ?? [], old);
  try { await applyPlan(pack, plan); } catch (err) {
    console.warn('sr2e | catalogue move', err);
    ui.notifications?.error?.(tx('SR2E.Catalogue942.moveFailed'));
    return 0;
  }
  await loadCatalogue942();
  await (game as any).settings.set(SYSTEM_ID, CATALOGUE_MOVED, true);
  if (old.length) {
    ui.notifications?.info?.(tx('SR2E.Catalogue942.moved', { n: tCount(old.length, 'SR2E.Count.template'), pack: escHtml(pack.metadata?.label ?? pack.title ?? CATALOGUE_PACK_NAME) }), { permanent: true });
  }
  return plan.create.length + plan.update.length;
}

/** Whether the old setting still holds a copy (the Setup tab offers to remove it once the catalogue has moved). */
export function oldCatalogueCopy(): number {
  return catalogueInPack() ? legacyTemplates().length : 0;
}

/** GM: remove the old setting's copy, after a confirmation, and only when every old template is in the compendium. */
export async function removeOldCatalogueCopy(): Promise<boolean> {
  if (!isGm() || !catalogueInPack()) return false;
  const old = legacyTemplates();
  if (!old.length) return false;
  await loadCatalogue942();
  const c = oldCopyCovered(stored ?? [], old);
  if (!c.covered) {
    ui.notifications?.warn?.(tx('SR2E.Catalogue942.notAllMoved', { list: escHtml(c.missing.slice(0, 6).join(', ')) }));
    return false;
  }
  const D: any = (foundry as any).applications?.api?.DialogV2;
  const ok = await D?.confirm?.({
    window: { title: tx('SR2E.Catalogue942.removeTitle') }, classes: ['sr2e-dialog'],
    content: `<p>${tx('SR2E.Catalogue942.removeBody', { n: tCount(old.length, 'SR2E.Count.template') })}</p>`,
    rejectClose: false,
  });
  if (!ok) return false;
  await (game as any).settings.set(SYSTEM_ID, 'itemTemplates', []);
  ui.notifications?.info?.(tx('SR2E.Catalogue942.removed'));
  return true;
}

/** GM: open the catalogue compendium (made when missing). */
export async function openCataloguePack(): Promise<void> {
  const pack = await ensureCataloguePack();
  if (!pack) { ui.notifications?.warn?.(tx('SR2E.Catalogue942.noPack')); return; }
  pack.render?.(true);
}

/** Open shop and Catalogue windows read the catalogue again (as the old setting's onChange did, settings.ts). */
function refreshCatalogueWindows(): void {
  try {
    for (const app of ((foundry as any).applications?.instances?.values?.() ?? [])) {
      const cls = (app as any)?.options?.classes;
      if (cls?.includes?.('sr2e-add') || cls?.includes?.('sr2e-codex')) { (app as any).clearCache?.(); void (app as any).render?.(); }
    }
  } catch { /* no windows */ }
}

/** Read the compendium again a moment after its items change (several changes, one read). */
function scheduleReload(): void {
  if (selfWrite > 0) return;
  if (reloadTimer) clearTimeout(reloadTimer);
  reloadTimer = setTimeout(() => { reloadTimer = null; void loadCatalogue942().then(refreshCatalogueWindows); }, 150);
}

/** Settings and hooks (from sr2e-system.ts at init). */
export function registerCatalogue942(): void {
  (game as any).settings.register(SYSTEM_ID, CATALOGUE_MOVED, { scope: 'world', config: false, type: Boolean, default: false });
  const changed = (doc: any) => { if (doc?.pack === catalogueCollection()) scheduleReload(); };
  Hooks.on('createItem', changed);
  Hooks.on('updateItem', changed);
  Hooks.on('deleteItem', changed);
  Hooks.on('updateCompendium', (pack: any) => { if (pack?.collection === catalogueCollection()) scheduleReload(); });
  Hooks.once('ready', () => {
    const lead = (game as any).users?.activeGM;
    if (isGm() && (!lead || lead.isSelf)) void migrateCatalogue942();
    else void loadCatalogue942().then(refreshCatalogueWindows);
  });
}
