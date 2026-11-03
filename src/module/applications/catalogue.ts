/**
 * v0.66.0 catalogue tools and the character stat-block import (GM panel, Setup tab; Bio tab).
 * - Paste spreadsheet rows (CSV or tab-separated, as copied from a spreadsheet) to make many world item
 *   templates at once, with a preview of what each column becomes.
 * - Export the templates as CSV; save and load a catalogue file (templates and kits) between worlds.
 * - Manage (delete) world templates.
 * - Make a character from a pasted write-up, or fill an existing one.
 * The parsing is pure: `rules/catalogcsv.ts` and `rules/charimport.ts`.
 */
import { SYSTEM } from '../config/system.ts';
import {
  catalogueFolderPath, CATALOGUE_FOLDER_NAMES,
  rowsToTemplates, templatesToCsv, catalogueToJson, parseCatalogueJson, mergeTemplates, missingValues, fillablePaths, MAX_CATALOGUE_CHARS, CATALOGUE_TYPES, typeLabel, normalizeKit, mergeKits,
  parseCharacterSheet, characterImportPlan,
  type ItemTemplate, type StarterKit, type CatalogueActor,
} from '../rules/index.ts';
import { kits, changeKits, refreshSetup, once } from './setup.ts';
import { recordCreation } from './advancement.ts';
import { creationRecordOf, approvalNeeded } from './approvals.ts';
import { escHtml } from '../rules/html.ts';
import { itemTypeProblem } from './drops.ts';
import { t as tx, tKey, tCount, tNoun, type CountNoun } from '../helpers/i18n.ts';

const { DialogV2 } = foundry.applications.api;
/** A-15: the shared escape helper (rules/html.ts). */
const esc = escHtml;
const randomId = () => `w-${(foundry.utils as any).randomID?.() ?? Math.random().toString(36).slice(2, 12)}`;
/** v0.89.5: a counted noun in the user's language (`SR2E.Count`), named by its English word. */
const plural = (n: number, noun: CountNoun) => tNoun(n, noun);

function worldTemplates(): ItemTemplate[] {
  try { return [...(((game.settings.get(SYSTEM.id, 'itemTemplates') as ItemTemplate[]) ?? []))]; } catch { return []; }
}
async function saveTemplates(list: ItemTemplate[]): Promise<void> {
  await game.settings.set(SYSTEM.id, 'itemTemplates', list.map(({ world: _w, ...t }: any) => t));
}

function download(text: string, type: string, name: string): void {
  const save: any = (foundry.utils as any).saveDataToFile ?? (globalThis as any).saveDataToFile;
  if (typeof save === 'function') return void save(text, type, name);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** The dialog's own element, whichever way this Foundry passes it to a render callback. */
function dialogRoot(a: any, b: any): HTMLElement | null {
  const d = b ?? a;
  return (d?.element instanceof HTMLElement ? d.element : d instanceof HTMLElement ? d : d?.[0] instanceof HTMLElement ? d[0] : null);
}

// ---------------------------------------------------------------- paste rows

/** Turn pasted rows into world templates (GM). Returns how many were saved. */
export async function pasteCatalogueRows(text?: string, defaultType = ''): Promise<number> {
  if (!(game as any).user?.isGM) { ui.notifications.warn(tx('SR2E.Notify.Catalogue.onlyTheGmCanChangeThe')); return 0; }
  if (text !== undefined) return saveRows(text, defaultType);
  const types = CATALOGUE_TYPES.map((t) => `<option value="${t}">${esc(typeLabel(t))}</option>`).join('');
  const r = await DialogV2.wait({
    window: { title: tx('SR2E.Dialog.Catalogue.pasteSpreadsheetRows'), icon: 'fa-solid fa-table' },
    position: { width: 720 },
    content: `<p class="hint">${tx('SR2E.Dialog.Catalogue.copyRowsFromASpreadsheetHeader')}</p>
      <div class="form-group"><label>${tx('SR2E.Dialog.Catalogue.typeForRowsWithoutAType')}</label><select name="type"><option value="">${tx('SR2E.Dialog.Catalogue.theTypeColumn')}</option>${types}</select></div>
      <textarea name="rows" rows="10" style="width:100%;font-family:monospace" placeholder="${tx('SR2E.Dialog.Catalogue.nameTypeDamageCostZzPistol')}"></textarea>
      <div class="sr2e-cat-preview hint">${tx('SR2E.Dialog.Catalogue.pasteRowsToSeeWhatThey')}</div>`,
    buttons: [
      { action: 'save', label: tx('SR2E.Dialog.Catalogue.makeTheTemplates'), default: true, callback: (_e: Event, b: any) => ({ rows: String(b.form.elements.rows.value ?? ''), type: String(b.form.elements.type.value ?? '') }) },
      { action: 'cancel', label: tx('SR2E.Dialog.Catalogue.cancel') },
    ],
    render: (a: any, b: any) => {
      const root = dialogRoot(a, b);
      const area = root?.querySelector<HTMLTextAreaElement>('textarea[name="rows"]');
      const sel = root?.querySelector<HTMLSelectElement>('select[name="type"]');
      const out = root?.querySelector<HTMLElement>('.sr2e-cat-preview');
      const show = () => { if (out && area) out.innerHTML = previewHtml(area.value, sel?.value ?? ''); };
      // v0.81.1 (RC2-7): parsed 200 ms after the typing stops (as the character import does), not on every keystroke.
      let timer: ReturnType<typeof setTimeout> | null = null;
      const later = () => { if (timer) clearTimeout(timer); timer = setTimeout(() => { timer = null; show(); }, PREVIEW_DELAY_MS); };
      area?.addEventListener('input', later);
      sel?.addEventListener('change', show);
    },
    rejectClose: false,
  });
  if (!r || typeof r !== 'object' || !(r as any).rows?.trim()) return 0;
  return saveRows((r as any).rows, (r as any).type);
}

/** v0.81.1 (RC2-7): how long the CSV preview waits after the last keystroke. */
const PREVIEW_DELAY_MS = 200;

/**
 * v0.81.1 (RC review): an item name as the character import's plan matches it (rules/charimport.ts `norm`: lower
 * case, inner blanks collapsed), so an item flagged "replace" is found and updated, not created a second time.
 */
export function importNameKey(name: unknown): string {
  return String(name ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function previewHtml(text: string, defaultType: string): string {
  if (!text.trim()) return tx('SR2E.App.Catalogue.pasteRowsToSeeWhatThey');
  const p = rowsToTemplates(text, { ...(defaultType ? { defaultType } : {}), existing: worldTemplates(), makeId: randomId });
  const cols = p.columns.map((c) => `<span class="sr2e-chip${c.path ? '' : ' sr2e-warn'}" title="${esc(c.path ?? tx('SR2E.Dialog.Catalogue.ignored'))}">${esc(c.header)} → ${esc(c.path ?? tx('SR2E.Dialog.Catalogue.ignored'))}</span>`).join(' ');
  const names = p.templates.slice(0, 12).map((t) => `${esc(t.name)} (${esc(typeLabel(t.type, false))})`).join(', ');
  return `<p><strong>${esc(plural(p.templates.length, 'template'))}</strong>${p.templates.length ? `: ${names}${p.templates.length > 12 ? '…' : ''}` : ''}</p>
    <p>${cols}</p>
    ${p.errors.length ? `<ul class="sr2e-warn">${p.errors.slice(0, 10).map((e) => `<li>${tx('SR2E.Dialog.Catalogue.row', { row: e.row, message: esc(e.message) })}</li>`).join('')}${p.errors.length > 10 ? `<li>${tx('SR2E.Dialog.Catalogue.andMore', { value: p.errors.length - 10 })}</li>` : ''}</ul>` : ''}
    ${p.warnings.length ? `<ul>${p.warnings.slice(0, 6).map((w) => `<li>${esc(w)}</li>`).join('')}</ul>` : ''}`;
}

async function saveRows(text: string, defaultType: string): Promise<number> {
  const existing = worldTemplates();
  const p = rowsToTemplates(text, { ...(defaultType ? { defaultType } : {}), existing, makeId: randomId });
  for (const e of p.errors.slice(0, 5)) ui.notifications.warn(tx('SR2E.Notify.Catalogue.row', { row: e.row, message: escHtml(e.message) }));
  if (!p.templates.length) { ui.notifications.warn(tx('SR2E.Notify.Catalogue.noTemplatesMadeSeeTheMessages')); return 0; }
  const m = mergeTemplates(existing, p.templates, 'replace', randomId);
  await saveTemplates(m.list);
  refreshSetup();
  ui.notifications.info(tx('SR2E.Notify.Catalogue.catalogueNewReplaced', { added: m.added, replaced: m.replaced, part: p.errors.length ? tx('SR2E.Notify.Catalogue.leftOut', { plural: tCount(p.errors.length, 'SR2E.Count.row') }) : '' }));
  return m.added + m.replaced;
}

// ---------------------------------------------------------------- export, catalogue files, manage

function exportCsv(): void {
  const list = worldTemplates();
  if (!list.length) return void ui.notifications.info(tx('SR2E.Notify.Catalogue.noWorldTemplatesToExportYet'));
  download(templatesToCsv(list), 'text/csv', `sr2e-templates-${(game as any).world?.id ?? 'world'}.csv`);
  // v0.91.1 (the owner: "free of copyright infringement problems"): what was typed from a book stays at the table.
  ui.notifications.info(tx('SR2E.Notify.Catalogue.bookTextWarning'), { permanent: true });
}

function exportCatalogue(): void {
  const t = worldTemplates();
  const k = kits();
  if (!t.length && !k.length) return void ui.notifications.info(tx('SR2E.Notify.Catalogue.noTemplatesOrKitsToSave'));
  download(catalogueToJson({ templates: t, kits: k, exportedAt: new Date().toISOString(), systemVersion: String((game as any).system?.version ?? '') }), 'application/json',
    `sr2e-catalogue-${(game as any).world?.id ?? 'world'}.json`);
  ui.notifications.info(tx('SR2E.Notify.Catalogue.bookTextWarning'), { permanent: true });
}

/** What a catalogue load did. */
export interface CatalogueLoadResult {
  templates: number; kits: number; actorsCreated: number; actorsFilled: number; itemsFilled: number; valuesFilled: number;
  errors: string[];
}

/** v0.84.0: a document type's default system data (what an empty one holds), for telling missing values apart. */
function initialSystem(doc: 'Actor' | 'Item', type: string): Record<string, unknown> {
  try {
    const Cls: any = (CONFIG as any)[doc].documentClass;
    return new Cls({ name: 'x', type }).system.toObject();
  } catch { return {}; }
}

/** Every world item and every item on a world actor (not unlinked tokens' copies), grouped by type and name. */
function worldItemsByKey(): Map<string, any[]> {
  const out = new Map<string, any[]>();
  const add = (i: any) => { const k = `${i.type}|${importNameKey(i.name)}`; const l = out.get(k) ?? []; l.push(i); out.set(k, l); };
  for (const i of (game as any).items ?? []) add(i);
  for (const a of (game as any).actors ?? []) for (const i of a.items ?? []) add(i);
  return out;
}

/** The world actor of a type and name (case and spacing ignored), if there is one. */
function worldActor(type: string, name: string): any {
  const k = importNameKey(name);
  return [...((game as any).actors ?? [])].find((a: any) => a.type === type && importNameKey(a.name) === k) ?? null;
}

/** What loading a parsed file would do, for the confirm (nothing is changed). */
export function catalogueLoadPreview(p: ReturnType<typeof parseCatalogueJson>): { templates: number; kits: number; actorsNew: number; actorsExisting: number; actorsKept: number; worldItems: number } {
  const byKey = worldItemsByKey();
  let worldItems = 0;
  for (const t of p.templates) worldItems += byKey.get(`${t.type}|${importNameKey(t.name)}`)?.length ?? 0;
  const there = p.actors.filter((a) => worldActor(a.type, a.name));
  // An NPC from a stat block that is already in the world is left as it is (never filled).
  const kept = there.filter((a) => a.statBlock).length;
  return { templates: p.templates.length, kits: p.kits.length, actorsNew: p.actors.length - there.length, actorsExisting: there.length - kept, actorsKept: kept, worldItems };
}

/** v0.84.0: why an update would be refused by the data model (null when it is fine), so one bad value is reported, not sent. */
function updateProblem(doc: any, flat: Record<string, unknown>): string | null {
  try {
    doc.validate?.({ changes: (foundry.utils as any).expandObject(flat), clean: true, strict: true });
    return null;
  } catch (e) { return String((e as Error).message ?? e).replace(/\s+/g, ' ').slice(0, 200); }
}

/** The system data of a patch as update keys. */
const asSystem = (patch: Record<string, unknown>) => Object.fromEntries(Object.entries(patch).map(([k, v]) => [`system.${k}`, v]));

const CATALOGUE_FOLDER = 'Catalogue (SR2e)';
const emptyLoadResult = (): CatalogueLoadResult => ({ templates: 0, kits: 0, actorsCreated: 0, actorsFilled: 0, itemsFilled: 0, valuesFilled: 0, errors: [] });
const parentOf = (f: any): string | null => f?.folder?.id ?? f?.folder ?? null;
const actorFolders = (): any[] => [...((game as any).folders ?? [])].filter((x: any) => x.type === 'Actor');

/** v0.90.2: the "Catalogue (SR2e)" actor folder: a top-level one first, else one anywhere (the load and the sort agree). */
function catalogueRoot(): any {
  const all = actorFolders().filter((x: any) => x.name === CATALOGUE_FOLDER);
  return all.find((x: any) => !parentOf(x)) ?? all[0] ?? null;
}

/**
 * v0.90.2: the subfolder under "Catalogue (SR2e)" for a path of folder ids (rules/catalogcsv.ts catalogueFolderPath),
 * made when missing (sorted by name, flagged with its id). Found by that flag first, then by its name in this language
 * or in English, so the folders the owner's sorting macro made before carry on and a translated world makes no second
 * set. A folder that could not be made is not tried again in the same run.
 */
async function catalogueSubfolder(root: any, path: readonly string[], cache: Map<string, any>, res: CatalogueLoadResult): Promise<any> {
  const F: any = (CONFIG as any).Folder.documentClass;
  let parent = root;
  for (const id of path) {
    const key = `${parent.id}/${id}`;
    if (cache.has(key)) { const c = cache.get(key); if (!c) return parent; parent = c; continue; }
    const nameKey = CATALOGUE_FOLDER_NAMES[id] ?? CATALOGUE_FOLDER_NAMES['other']!;
    const name = tKey(nameKey);
    const english = englishText(nameKey) ?? name;
    const here = actorFolders().filter((x: any) => parentOf(x) === parent.id);
    let f = here.find((x: any) => x.getFlag?.(SYSTEM.id, 'catalogueFolder') === id) ?? here.find((x: any) => x.name === name) ?? here.find((x: any) => x.name === english);
    if (!f) {
      try { f = await F.create({ name, type: 'Actor', folder: parent.id, sorting: 'a', flags: { [SYSTEM.id]: { catalogueFolder: id } } }); } catch (e) {
        res.errors.push(tx('SR2E.App.Catalogue.theFolder', { name, message: (e as Error).message }));
        cache.set(key, null);
        return parent;
      }
    }
    cache.set(key, f);
    parent = f;
  }
  return parent;
}

/** A key's English text (Foundry's fallback language), to find folders made before in another language. */
function englishText(key: string): string | null {
  try { const v = (foundry.utils as any).getProperty((game as any).i18n?._fallback ?? {}, key); return typeof v === 'string' ? v : null; } catch { return null; }
}

let sortRunning: Promise<number> = Promise.resolve(0);

/**
 * v0.90.2: sort the catalogue folder (the owner's macro, built in; also run after every catalogue load): actors that sit
 * directly in "Catalogue (SR2e)", or directly in its Drones folder (where the macro's first version put drones), move
 * into their subfolder. Anything moved elsewhere by hand stays; nothing but the folder changes. GM only. Runs one at a
 * time. Gives how many moved, or null when there is no catalogue folder (or the user isn't the GM).
 */
export function sortCatalogueFolder(res: CatalogueLoadResult = emptyLoadResult()): Promise<number | null> {
  const run = sortRunning.then(() => sortNow(res), () => sortNow(res));
  sortRunning = run.then((n) => n ?? 0, () => 0);
  return run;
}

async function sortNow(res: CatalogueLoadResult): Promise<number | null> {
  if (!(game as any).user?.isGM) return null;
  const root = catalogueRoot();
  if (!root) return null;
  const dronesName = [tKey(CATALOGUE_FOLDER_NAMES['drones']!), englishText(CATALOGUE_FOLDER_NAMES['drones']!)];
  const from = new Set<string>([root.id, ...actorFolders().filter((f: any) => parentOf(f) === root.id && (f.getFlag?.(SYSTEM.id, 'catalogueFolder') === 'drones' || dronesName.includes(f.name))).map((f: any) => f.id)]);
  const cache = new Map<string, any>();
  const updates: any[] = [];
  for (const a of [...((game as any).actors ?? [])]) {
    const at = a.folder?.id ?? a.folder;
    if (!from.has(at)) continue;
    const target = await catalogueSubfolder(root, catalogueFolderPath({ type: a.type, system: a.system, critter: Boolean(a.getFlag?.(SYSTEM.id, 'critter')) }), cache, res);
    if (target && target.id !== at) updates.push({ _id: a.id, folder: target.id });
  }
  if (updates.length) {
    try { await (CONFIG as any).Actor.documentClass.updateDocuments(updates); } catch (e) { res.errors.push(tx('SR2E.App.Catalogue.sortFailed', { message: (e as Error).message })); return 0; }
  }
  if (root.sorting !== 'a') { try { await root.update({ sorting: 'a' }); } catch { /* keep it */ } }
  return updates.length;
}

/** v0.90.2: the API's sort (game.sr2e.api.sortCatalogue()): the sort with a notification, as the owner's macro gave. */
export async function sortCatalogueWithNotice(): Promise<number> {
  if (!(game as any).user?.isGM) { ui.notifications.warn(tx('SR2E.Notify.Catalogue.onlyTheGmSorts')); return 0; }
  const res = emptyLoadResult();
  const n = await sortCatalogueFolder(res);
  if (n === null) { ui.notifications.warn(tx('SR2E.Notify.Catalogue.noCatalogueFolder', { name: CATALOGUE_FOLDER })); return 0; }
  for (const e of res.errors.slice(0, 3)) ui.notifications.error(escHtml(e));
  ui.notifications.info(tCount(n, 'SR2E.Notify.Catalogue.catalogueSorted'));
  return n;
}

/** The folder new catalogue actors go in (each into its subfolder: catalogueSubfolder). */
async function catalogueFolder(res: CatalogueLoadResult): Promise<any> {
  const name = CATALOGUE_FOLDER;
  const f = catalogueRoot();
  if (f) return f;
  try { return await (CONFIG as any).Folder.documentClass.create({ name, type: 'Actor' }); } catch (e) { res.errors.push(tx('SR2E.App.Catalogue.theFolder', { name, message: (e as Error).message })); return null; }
}

/**
 * v0.91.4: the catalogue folder a new actor of the GM's goes in (a new entry's vehicle or drone): its subfolder under
 * "Catalogue (SR2e)", made when missing. Null when it couldn't be made (the actor then goes at the top).
 */
export async function catalogueFolderFor(a: { type: string; system: Record<string, unknown> }): Promise<any | null> {
  const res = emptyLoadResult();
  const root = await catalogueFolder(res);
  if (!root) return null;
  return catalogueSubfolder(root, catalogueFolderPath({ type: a.type, system: a.system, critter: false }), new Map(), res);
}

/**
 * Load a catalogue file's text into the world (GM): templates and kits (same name: replace, keep mine, or keep both),
 * new actors in the "Catalogue (SR2e)" folder (NPCs with a stat block go through the character import), and, with
 * `fill`, the missing values (fields still at their default) of world items and actors with the same type and name.
 * Values someone set are never changed, and actors already in the world are never replaced.
 */
export async function loadCatalogue(text: string, mode: 'replace' | 'skip' | 'copy', o: { fill?: boolean; parsed?: ReturnType<typeof parseCatalogueJson> } = {}): Promise<CatalogueLoadResult> {
  const p = o.parsed ?? parseCatalogueJson(text);
  const res: CatalogueLoadResult = { templates: 0, kits: 0, actorsCreated: 0, actorsFilled: 0, itemsFilled: 0, valuesFilled: 0, errors: [...p.errors] };
  if (!(game as any).user?.isGM) { res.errors.push(tx('SR2E.App.Catalogue.onlyTheGmCanLoadA')); return res; }
  if (!p.templates.length && !p.kits.length && !p.actors.length) return res;
  const m = mergeTemplates(worldTemplates(), p.templates, mode, randomId);
  await saveTemplates(m.list);
  res.templates = m.added + m.replaced;
  const incoming = p.kits.map((k) => normalizeKit(k, () => randomId())).filter((k): k is StarterKit => Boolean(k));
  let mk = { added: 0, replaced: 0 };
  if (incoming.length) await changeKits((now) => { const r = mergeKits(now, incoming, mode === 'replace' ? 'replace' : 'skip', () => randomId()); mk = r; return r.list; });
  res.kits = mk.added + mk.replaced;
  if (p.actors.length) await loadActors(p.actors, o.fill !== false, res);
  if (o.fill !== false && p.templates.length) await fillWorldItems(p.templates, res);
  return res;
}

async function loadActors(list: readonly CatalogueActor[], fill: boolean, res: CatalogueLoadResult): Promise<void> {
  const ActorCls: any = (CONFIG as any).Actor.documentClass;
  const fresh: any[] = [];
  const blocks: CatalogueActor[] = [];
  // Items an actor of this type can't carry (cyberware on a vehicle…) are left out and reported, as a drop would be.
  const itemsFor = (a: CatalogueActor) => a.items.filter((i) => {
    const why = itemTypeProblem(a.type, i.type);
    if (why) res.errors.push(tx('SR2E.App.Catalogue.leftOut', { actor: a.name, item: i.name, why }));
    return !why;
  }).map((i) => ({ name: i.name, type: i.type, system: i.system }));
  for (const a of list) {
    const old = worldActor(a.type, a.name);
    if (old) {
      // NPCs from a stat block are left as they are (the import would change what is there).
      if (fill && !a.statBlock) await fillActor(old, a, res);
      continue;
    }
    if (a.statBlock) { blocks.push(a); continue; }
    fresh.push({ name: a.name, type: a.type, system: a.system, items: itemsFor(a), ...(a.critter ? { flags: { [SYSTEM.id]: { critter: true } } } : {}) });
  }
  if (!fresh.length && !blocks.length) { await sortCatalogueFolder(res); return; }
  const folder = await catalogueFolder(res);
  // v0.90.2: each new actor straight into its subfolder (vehicles and drones by category, spirits by kind, critters, NPCs).
  const cache = new Map<string, any>();
  // The path from the actor as it will be made (a vehicle with no category is a car, a spirit with no kind a nature spirit).
  const asMade = (d: { name?: string; type: string; system?: any }): any => { try { return new ActorCls({ name: d.name ?? '-', type: d.type, system: d.system ?? {} }).system; } catch { return d.system; } };
  const subfolder = async (d: { name?: string; type: string; system?: any; critter?: boolean }) => (folder ? await catalogueSubfolder(folder, catalogueFolderPath({ type: d.type, system: asMade(d), critter: d.critter }), cache, res) : null);
  for (const d of fresh) { const sf = await subfolder({ name: d.name, type: d.type, system: d.system, critter: Boolean(d.flags?.[SYSTEM.id]?.critter) }); if (sf) d.folder = sf.id; }
  // Created in batches, and one by one when a batch fails, so one bad entry doesn't stop the rest.
  for (let i = 0; i < fresh.length; i += 50) {
    const chunk = fresh.slice(i, i + 50);
    try { res.actorsCreated += (await ActorCls.createDocuments(chunk))?.length ?? 0; } catch {
      for (const d of chunk) {
        try { if (await ActorCls.create(d)) res.actorsCreated++; else res.errors.push(tx('SR2E.App.Catalogue.notCreatedSeeTheConsole', { name: d.name })); } catch (e) { res.errors.push(`${d.name}: ${(e as Error).message}`); }
      }
    }
  }
  // NPCs from a stat block: an empty NPC, then the character import fills it (a failed import removes it again).
  let done = 0;
  for (const a of blocks) {
    if (++done % 25 === 0) ui.notifications.info(tx('SR2E.Notify.Catalogue.catalogueNpcsFromStatBlocksOf', { done, blocksLength: blocks.length }));
    let actor: any = null;
    try {
      const sf = await subfolder({ name: a.name, type: 'npc', system: a.system, critter: a.critter });
      actor = await ActorCls.create({ name: a.name, type: 'npc', ...(sf ? { folder: sf.id } : {}), system: a.system, ...(a.critter ? { flags: { [SYSTEM.id]: { critter: true } } } : {}) });
      if (!actor) { res.errors.push(tx('SR2E.App.Catalogue.notCreatedSeeTheConsole', { name: a.name })); continue; }
      const r = await importCharacter(actor, a.statBlock);
      // The catalogue's name stays (the block's own Name line may differ), so loading the file again finds it.
      if (actor.name !== a.name) await actor.update({ name: a.name, 'prototypeToken.name': a.name });
      res.actorsCreated++;
      for (const w of r.warnings.slice(0, 2)) res.errors.push(`${a.name}: ${w}`);
    } catch (e) {
      res.errors.push(`${a.name}: ${(e as Error).message}`);
      try { await actor?.delete(); } catch { /* gone */ }
      continue;
    }
    // Extra items the entry lists, unless the import already put one of that name there; a failure keeps the NPC.
    const extra = itemsFor(a).filter((i) => ![...(actor.items ?? [])].some((x: any) => x.type === i.type && importNameKey(x.name) === importNameKey(i.name)));
    if (extra.length) { try { await actor.createEmbeddedDocuments('Item', extra); } catch (e) { res.errors.push(tx('SR2E.App.Catalogue.extraItems', { name: a.name, message: (e as Error).message })); } }
  }
  // Older loads (and anything the importer left at the top): into their subfolders too.
  await sortCatalogueFolder(res);
}

/**
 * An actor already in the world: its own data is left as it is (much of it is game state, links and choices where
 * 0 means none); only its items that the entry also has get their missing values.
 */
async function fillActor(actor: any, a: CatalogueActor, res: CatalogueLoadResult): Promise<void> {
  try {
    const updates: any[] = [];
    let values = 0;
    for (const it of a.items) {
      const ex = [...(actor.items ?? [])].find((i: any) => i.type === it.type && importNameKey(i.name) === importNameKey(it.name));
      if (!ex) continue;
      const ip = asSystem(missingValues(ex.system?.toObject?.() ?? ex.system, it.system, initialSystem('Item', ex.type), fillablePaths(ex.type)));
      if (!Object.keys(ip).length) continue;
      const why = updateProblem(ex, ip);
      if (why) { res.errors.push(tx('SR2E.App.Catalogue.notFilledIn', { actor: actor.name, item: ex.name, why })); continue; }
      updates.push({ _id: ex.id, ...ip }); values += Object.keys(ip).length;
    }
    if (updates.length) { await actor.updateEmbeddedDocuments('Item', updates); res.itemsFilled += updates.length; res.valuesFilled += values; res.actorsFilled++; }
  } catch (e) { res.errors.push(`${actor.name}: ${(e as Error).message}`); }
}

/** Fill the missing values of world items (and items on world actors) with the same type and name as a template. */
async function fillWorldItems(templates: readonly ItemTemplate[], res: CatalogueLoadResult): Promise<void> {
  const byKey = worldItemsByKey();
  const initial = new Map<string, Record<string, unknown>>();
  const perParent = new Map<any, Array<{ upd: Record<string, unknown>; n: number }>>();
  for (const t of templates) {
    for (const item of byKey.get(`${t.type}|${importNameKey(t.name)}`) ?? []) {
      if (!initial.has(item.type)) initial.set(item.type, initialSystem('Item', item.type));
      const patch = asSystem(missingValues(item.system?.toObject?.() ?? item.system, t.system, initial.get(item.type), fillablePaths(item.type)));
      const n = Object.keys(patch).length;
      if (!n) continue;
      const why = updateProblem(item, patch);
      if (why) { res.errors.push(item.parent?.name ? tx('SR2E.App.Catalogue.notFilledIn', { actor: item.parent.name, item: item.name, why }) : tx('SR2E.App.Catalogue.notFilledIn2', { item: item.name, why })); continue; }
      const parent = item.parent ?? null;
      const l = perParent.get(parent) ?? []; l.push({ upd: { _id: item.id, ...patch }, n }); perParent.set(parent, l);
    }
  }
  for (const [parent, ups] of perParent) {
    try {
      if (parent) await parent.updateEmbeddedDocuments('Item', ups.map((u) => u.upd));
      else await (CONFIG as any).Item.documentClass.updateDocuments(ups.map((u) => u.upd));
      res.itemsFilled += ups.length;
      res.valuesFilled += ups.reduce((x, u) => x + u.n, 0);
    } catch (e) { res.errors.push(`${parent?.name ?? 'World items'}: ${(e as Error).message}`); }
  }
}

async function importCatalogueDialog(): Promise<void> {
  const r = await DialogV2.prompt({
    window: { title: tx('SR2E.Dialog.Catalogue.loadACatalogueFile') },
    content: `<div class="form-group"><label>${tx('SR2E.Dialog.Catalogue.file')}</label><input type="file" name="file" accept=".json,application/json"></div>
      <div class="form-group"><label>${tx('SR2E.Dialog.Catalogue.sameNameAlreadyHere')}</label><select name="mode">
        <option value="replace">${tx('SR2E.Dialog.Catalogue.replaceIt')}</option><option value="skip">${tx('SR2E.Dialog.Catalogue.keepMine')}</option><option value="copy">${tx('SR2E.Dialog.Catalogue.keepBothTemplatesGet2Kits')}</option></select></div>
      <label class="sr2e-check"><input type="checkbox" name="fill" checked> ${tx('SR2E.Dialog.Catalogue.fillInMissingValuesOfMatching')}</label>
      <p class="hint">${tx('SR2E.Dialog.Catalogue.templatesAndKitsFollowTheChoice')}</p>`,
    ok: { label: tx('SR2E.Dialog.Catalogue.next'), callback: (_e: Event, b: any) => ({ file: b.form.elements.file.files?.[0] ?? null, mode: String(b.form.elements.mode.value), fill: Boolean(b.form.elements.fill.checked) }) },
    rejectClose: false,
  });
  if (!r?.file) return;
  if (Number(r.file.size ?? 0) > MAX_CATALOGUE_CHARS) return void ui.notifications.warn(tx('SR2E.Notify.Catalogue.thatFileIsTooLargeFor'));
  const text = await r.file.text();
  const parsed = parseCatalogueJson(text);
  if (!parsed.templates.length && !parsed.kits.length && !parsed.actors.length) {
    for (const e of parsed.errors.slice(0, 5)) ui.notifications.warn(tx('SR2E.Notify.Catalogue.catalogueFile', { e: esc(e) }));
    if (!parsed.errors.length) ui.notifications.info(tx('SR2E.Notify.Catalogue.theFileHasNothingToLoad'));
    return;
  }
  const pv = catalogueLoadPreview(parsed);
  const ok = await DialogV2.confirm({
    window: { title: tx('SR2E.Dialog.Catalogue.loadACatalogueFile') }, classes: ['sr2e-dialog'],
    content: `<p>${tx('SR2E.Dialog.Catalogue.thisFileHas')}</p><ul>
      <li>${esc(plural(pv.templates, 'item template'))}${pv.worldItems && r.fill ? tCount(pv.worldItems, 'SR2E.Card.Catalogue.inTheWorldMissingValues') : ''}</li>
      <li>${esc(plural(pv.kits, 'starter kit'))}</li>
      <li>${esc(plural(pv.actorsNew, 'new actor'))}${pv.actorsExisting ? tx('SR2E.Dialog.Catalogue.alreadyInTheWorld', { plural: esc(plural(pv.actorsExisting, 'actor')), part: r.fill ? tx('SR2E.Dialog.Catalogue.theirItemsMissingValuesFilledIn') : tx('SR2E.Dialog.Catalogue.leftAsTheyAre') }) : ''}${pv.actorsKept ? tx('SR2E.Dialog.Catalogue.fromAStatBlockAlreadyIn', { plural: esc(plural(pv.actorsKept, 'NPC')) }) : ''}</li></ul>
      ${parsed.errors.length ? `<p class="hint">${tx('SR2E.Dialog.Catalogue.canTBeReadAndWill', { plural: esc(plural(parsed.errors.length, 'entry')) })}</p>` : ''}
      <p>${tx('SR2E.Dialog.Catalogue.loadItABigFileTakes')}</p>`,
  });
  if (!ok) return;
  ui.notifications.info(tx('SR2E.Notify.Catalogue.loadingTheCatalogue'));
  const res = await loadCatalogue(text, r.mode as any, { fill: r.fill, parsed });
  for (const e of res.errors.slice(0, 5)) ui.notifications.warn(tx('SR2E.Notify.Catalogue.catalogueFile', { e: esc(e) }));
  if (res.errors.length) console.warn('sr2e | catalogue load:', res.errors);
  ui.notifications.info(tx('SR2E.Notify.Catalogue.loadedSummary', {
    templates: tCount(res.templates, 'SR2E.Count.template'), kits: tCount(res.kits, 'SR2E.Count.kit'), actors: tCount(res.actorsCreated, 'SR2E.Count.newActor'),
    filled: res.valuesFilled ? tx('SR2E.Notify.Catalogue.loadedFilled', { values: tCount(res.valuesFilled, 'SR2E.Count.missingValue'), items: tCount(res.itemsFilled + res.actorsFilled, 'SR2E.Count.itemOrActor') }) : '',
    problems: res.errors.length ? tx('SR2E.Notify.Catalogue.loadedProblems', { problems: tCount(res.errors.length, 'SR2E.Count.problem') }) : '',
  }));
  refreshSetup();
}

async function manageTemplates(): Promise<void> {
  const list = worldTemplates();
  if (!list.length) return void ui.notifications.info(tx('SR2E.Notify.Catalogue.noWorldTemplatesYetSaveOne'));
  const sorted = [...list].sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name));
  const ids = await DialogV2.prompt({
    window: { title: tx('SR2E.Dialog.Catalogue.worldItemTemplates') },
    position: { width: 520, height: 600 },
    content: `<p class="hint">${tx('SR2E.Dialog.Catalogue.tickTheOnesToDeleteTo')}</p>
      <fieldset class="sr2e-pick-list">${sorted.map((t) => `<label class="sr2e-check"><input type="checkbox" name="del" value="${esc(t.id)}"> ${esc(t.name)} <span class="hint">${esc(typeLabel(t.type, false))}</span></label>`).join('')}</fieldset>`,
    ok: { label: tx('SR2E.Dialog.Catalogue.deleteTheTicked'), callback: (_e: Event, b: any) => [...b.form.querySelectorAll('input[name="del"]:checked')].map((i: any) => String(i.value)) },
    rejectClose: false,
  });
  if (!ids?.length) return;
  await saveTemplates(list.filter((t) => !ids.includes(t.id)));
  ui.notifications.info(tx('SR2E.Notify.Catalogue.deleted', { plural: tCount(Number(ids.length), 'SR2E.Count.template') }));
}

// ---------------------------------------------------------------- character stat-block import

/**
 * Fill a character from a pasted write-up: attributes, skills, cyberware, spells, gear, contacts, nuyen,
 * Karma, lifestyle and notes. Items with the same type and name are updated. Returns the summary lines.
 */
export async function importCharacter(actor: any, text: string): Promise<{ lines: string[]; warnings: string[] }> {
  if (!actor?.isOwner) throw new Error(tx('SR2E.App.Catalogue.onlyTheOwnerCanImportInto'));
  // A player fills only a character that isn't finished, and not past the approval queue (the GM can).
  if (!(game as any).user?.isGM) {
    if (creationRecordOf(actor)) throw new Error(tx('SR2E.App.Catalogue.sCreationIsFinishedAskThe', { name: actor.name }));
    if (approvalNeeded(actor)) throw new Error(tx('SR2E.App.Catalogue.theApprovalQueueIsOnAsk'));
  }
  const parsed = parseCharacterSheet(text);
  const sys = actor.system ?? {};
  const plan = characterImportPlan(parsed, {
    itemNames: [...actor.items].map((i: any) => ({ type: i.type, name: i.name })),
    contacts: [...(sys.contacts ?? [])].map((c: any) => (typeof c?.toObject === 'function' ? c.toObject() : { ...c })),
    qualities: [...(sys.qualities ?? [])].map((q: any) => (typeof q?.toObject === 'function' ? q.toObject() : { ...q })),
    biography: String(sys.biography ?? ''), notes: String(sys.notes ?? ''),
    makeId: () => (foundry.utils as any).randomID?.() ?? Math.random().toString(36).slice(2, 12),
  } as any);
  const byName = (type: string, name: string) => [...actor.items].find((i: any) => i.type === type && importNameKey(i.name) === importNameKey(name));
  const creates: any[] = [];
  const updates: any[] = [];
  for (const it of plan.items) {
    const ex: any = it.replace ? byName(it.type, it.name) : null;
    if (ex) updates.push({ _id: ex.id, system: it.system });
    else creates.push({ name: it.name, type: it.type, system: it.system });
  }
  // Items first, so attribute bonuses from cyberware are counted once (the plan allows for them).
  if (creates.length) await actor.createEmbeddedDocuments('Item', creates);
  if (updates.length) await actor.updateEmbeddedDocuments('Item', updates);
  const first: Record<string, unknown> = { ...plan.actorUpdate };
  // The token takes the new name too.
  if (typeof first['name'] === 'string') first['prototypeToken.name'] = first['name'];
  if ((plan as any).contacts) first['system.contacts'] = (plan as any).contacts;
  if ((plan as any).qualities) first['system.qualities'] = (plan as any).qualities;
  if (Object.keys(first).length) await actor.update(first);
  // Values that need the actor's derived numbers once the items are on it (as the NPC import does).
  const after: any = plan.after ?? {};
  const second: Record<string, unknown> = {};
  const d = actor.system?.derived ?? {};
  if (typeof after.essenceShown === 'number') second['system.essence'] = Math.round((after.essenceShown + Number(d.essenceLoss ?? 0)) * 100) / 100;
  if (typeof after.reactionShown === 'number') second['system.reactionBonus'] = after.reactionShown - (Number(d.reaction ?? 0) - Number(actor.system?.reactionBonus ?? 0));
  if (typeof after.initiativeDice === 'number') second['system.initiativeDiceBonus'] = Math.max(0, after.initiativeDice - (Number(d.initiativeDice ?? 1) - Number(actor.system?.initiativeDiceBonus ?? 0)));
  if (typeof after.lifestyleSeconds === 'number' && after.lifestyleSeconds > 0) second['system.lifestyle.paidUntil'] = Number((game as any).time?.worldTime ?? 0) + after.lifestyleSeconds;
  if (Object.keys(second).length) await actor.update(second);
  return { lines: plan.summary, warnings: [...plan.warnings] };
}

const IMPORT_HINT = (): string => `<p class="hint">${tx('SR2E.App.Catalogue.pasteACharacterWriteUp')}</p>`;

async function importDialog(title: string, withRecord: boolean): Promise<{ text: string; record: boolean } | null> {
  const r = await DialogV2.wait({
    window: { title, icon: 'fa-solid fa-file-import' },
    position: { width: 680 },
    content: `${IMPORT_HINT()}<textarea name="text" rows="14" style="width:100%;font-family:monospace"></textarea>
      <div class="sr2e-cat-preview hint"></div>
      ${withRecord ? `<label class="sr2e-check"><input type="checkbox" name="record"> ${tx('SR2E.Dialog.Catalogue.recordItAsTheCharacterS')}</label>` : ''}`,
    buttons: [
      { action: 'ok', label: tx('SR2E.Dialog.Catalogue.import'), default: true, callback: (_e: Event, b: any) => ({ text: String(b.form.elements.text.value ?? ''), record: Boolean(b.form.elements.record?.checked) }) },
      { action: 'cancel', label: tx('SR2E.Dialog.Catalogue.cancel') },
    ],
    render: (a: any, b: any) => {
      const root = dialogRoot(a, b);
      const area = root?.querySelector<HTMLTextAreaElement>('textarea[name="text"]');
      const out = root?.querySelector<HTMLElement>('.sr2e-cat-preview');
      // v0.81.0 (RC-9): re-parse 200 ms after the last keystroke, not on every one.
      let timer: ReturnType<typeof setTimeout> | undefined;
      area?.addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          if (!out || !area) return;
          if (!area.value.trim()) { out.innerHTML = ''; return; }
          try {
            const p = characterImportPlan(parseCharacterSheet(area.value));
            out.innerHTML = `<ul>${p.summary.map((l: string) => `<li>${esc(l)}</li>`).join('')}</ul>${p.warnings.length ? `<ul class="sr2e-warn">${p.warnings.slice(0, 8).map((w: string) => `<li>${esc(w)}</li>`).join('')}</ul>` : ''}`;
          } catch (err) { out.textContent = String(err); }
        }, 200);
      });
    },
    rejectClose: false,
  });
  return r && typeof r === 'object' && (r as any).text?.trim() ? (r as any) : null;
}

/** Import into an existing character (its Bio tab). */
export async function importIntoCharacter(actor: any): Promise<void> {
  await once(`import:${actor?.uuid}`, async () => {
  const r = await importDialog(tx('SR2E.Dialog.Catalogue.importAStatBlock', { actorName: actor.name }), Boolean((game as any).user?.isGM));
  if (!r) return;
  await runImport(actor, r.text, r.record);
  });
}

async function runImport(actor: any, text: string, record: boolean): Promise<boolean> {
  try {
    const res = await importCharacter(actor, text);
    for (const w of res.warnings.slice(0, 8)) ui.notifications.warn(tx('SR2E.Notify.Catalogue.import', { w: escHtml(w) }));
    ui.notifications.info(tx('SR2E.Notify.Catalogue.importedInto', { actorName: escHtml(actor.name), resLines: escHtml(res.lines.join('; ')) }));
    if (record) {
      await recordCreation(actor, { how: 'asIs' });
    }
    actor.sheet?.render(true);
    return true;
  } catch (err) {
    console.error('sr2e | character import', err);
    ui.notifications.error(tx('SR2E.Notify.Catalogue.theImportStopped', { errMessage: escHtml((err as Error)?.message ?? err) }));
    return false;
  }
}

/** GM: a new character from a stat block. */
async function newCharacterFromBlock(): Promise<void> {
  const r = await importDialog(tx('SR2E.Dialog.Catalogue.newCharacterFromAStatBlock'), true);
  if (!r) return;
  const parsed = parseCharacterSheet(r.text);
  const name = (parsed as any).name || 'Imported character';
  const ActorCls: any = (CONFIG as any).Actor.documentClass;
  const actor = await ActorCls.create({ name, type: 'character' });
  if (!actor) return;
  // A failed import leaves no empty character behind.
  if (!(await runImport(actor, r.text, r.record))) { try { await actor.delete(); } catch { /* gone */ } }
}

// ---------------------------------------------------------------- the actions

export const CATALOGUE_ACTIONS: Record<string, (this: any, ev: Event, t: HTMLElement) => unknown> = {
  catPaste: () => once('catPaste', () => pasteCatalogueRows()),
  catCsv: () => exportCsv(),
  catExport: () => exportCatalogue(),
  catImport: () => once('catImport', importCatalogueDialog),
  catList: () => manageTemplates(),
  charImportNew: () => once('charImportNew', newCharacterFromBlock),
};
