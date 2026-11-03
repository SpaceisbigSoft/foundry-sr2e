/**
 * v0.91.1: make a new entry (the owner, 25 Oct 2026): an item, spell, adept power, focus, program or cyberdeck the
 * catalogue lacks, typed from the user's own book (or with no catalogue loaded at all).
 *  - A form per kind with the fields its stat line has, each with a hint; "Paste the stat line" fills them from the
 *    numbers and codes (rules/newentry.ts parseStatLine), shown before anything is saved.
 *  - The GM saves it as a world template (ticked "in the shop" or not) and/or gives it to a character.
 *  - A player sends it to the GM as a request ('entry'); the GM's Requests tab has Review… (this window, filled in
 *    from the request, to check and edit) beside Approve and Decline.
 * Opened from the shop (the Add window), the SR2e tools window, the GM panel's Setup tab and the API.
 * The system ships no book data: the paste keeps only the name, numbers and codes, and the description is the user's
 * own words (kept as plain text).
 */
import { SYSTEM } from '../config/system.ts';
import {
  ENTRY_KINDS, entryFields, entryItemType, entryKindForType, isEntryKind, parseStatLine, buildEntry, entryRequestData, entrySummary, entryPrice, entryAvailability,
  ENTRY_KIND_KEYS, STAT_LINE_MAX, ENTRY_DESCRIPTION_MAX, ENTRY_NAME_MAX, shopListMode, legalityOf, isVehicleKind, RULES, type EntryKind, type ItemTemplate,
} from '../rules/index.ts';
import { vehicleForSale, makeOwnedVehicle } from './shop.ts';
import { catalogueFolderFor } from './catalogue.ts';
import { fileRequest, registerRequestRunner, requestsOf, finishRequest } from './approvals.ts';
import { addLines } from './adding.ts';
import { escHtml } from '../rules/html.ts';
import { t as tx, tKey } from '../helpers/i18n.ts';

const { HandlebarsApplicationMixin, ApplicationV2, DialogV2 } = foundry.applications.api;

const isGm = (): boolean => Boolean((game as any).user?.isGM);
const label = (key: string): string => tKey(key);
const kindLabel = (k: EntryKind): string => tKey(ENTRY_KIND_KEYS[k]);

function worldTemplates(): ItemTemplate[] {
  try { return [...(((game.settings.get(SYSTEM.id, 'itemTemplates') as ItemTemplate[]) ?? []))]; } catch { return []; }
}

/** The character a player's entry is filed on: the one the window was opened for, else theirs, else one they own. */
function requestActor(actorUuid: string): any | null {
  const a: any = actorUuid ? fromUuidSync(actorUuid) : null;
  if (a?.type === 'character' && a.isOwner) return a;
  const mine: any = (game as any).user?.character;
  if (mine?.type === 'character' && mine.isOwner) return mine;
  return [...((game as any).actors ?? [])].find((x: any) => x.type === 'character' && x.isOwner && !x.isToken) ?? null;
}

/**
 * GM: save a built entry as a world template. A template of the same kind and name is replaced (after a yes), keeping
 * its id and shop mark unless `inShop` says otherwise. Returns the template, or null.
 */
export async function saveEntryTemplate(e: { type: string; name: string; system: Record<string, unknown> }, o: { inShop: boolean; confirm?: boolean }): Promise<ItemTemplate | null> {
  if (!isGm()) { ui.notifications?.warn?.(tx('SR2E.Notify.NewEntry.onlyTheGmSaves')); return null; }
  const list = worldTemplates();
  const old = list.find((t) => t.type === e.type && t.name.toLowerCase() === e.name.toLowerCase());
  if (old && o.confirm !== false) {
    const ok = await DialogV2.confirm({ window: { title: tx('SR2E.Dialog.NewEntry.replaceTitle') }, content: `<p>${tx('SR2E.Dialog.NewEntry.replaceText', { name: escHtml(old.name) })}</p>`, rejectClose: false } as any);
    if (!ok) return null;
  }
  // v0.91.1 review (B6): a replaced template keeps its "in the shop" mark (the shop window's Shop column takes it off).
  const t: ItemTemplate = { id: old?.id ?? `w-${foundry.utils.randomID()}`, type: e.type, name: e.name, system: foundry.utils.deepClone(e.system), ...(o.inShop || old?.shop ? { shop: true } : {}) };
  await game.settings.set(SYSTEM.id, 'itemTemplates', [...list.filter((x) => x !== old), t].map(({ world: _w, ...x }: any) => x));
  return t;
}

/**
 * v0.91.4 (GM): save a built vehicle or drone in the catalogue: a world actor in its "Catalogue (SR2e)" subfolder (in the
 * shop when `inShop`). One of the GM's catalogue vehicles with the same name is updated instead (after a yes), keeping
 * its live state, owners and shop mark. Returns the actor, or null.
 */
export async function saveEntryVehicle(e: { name: string; system: Record<string, unknown> }, o: { inShop: boolean; confirm?: boolean }): Promise<any | null> {
  if (!isGm()) { ui.notifications?.warn?.(tx('SR2E.Notify.NewEntry.onlyTheGmSaves')); return null; }
  const old: any = catalogueVehicleNamed(e.name);
  if (old && o.confirm !== false) {
    const ok = await DialogV2.confirm({ window: { title: tx('SR2E.Dialog.NewEntry.replaceTitle') }, content: `<p>${tx('SR2E.Dialog.NewEntry.replaceText', { name: escHtml(old.name) })}</p>`, rejectClose: false } as any);
    if (!ok) return null;
  }
  const system = foundry.utils.deepClone(e.system);
  if (old) {
    await old.update({ system, ...(o.inShop ? { [`flags.${SYSTEM.id}.shop`]: true } : {}) });
    return old;
  }
  const folder = await catalogueFolderFor({ type: 'vehicle', system });
  // v0.91.4 review (R8): outside the catalogue folder only the shop mark puts it on sale, so it gets one.
  const inShop = o.inShop || !folder;
  return (CONFIG as any).Actor.documentClass.create({ name: e.name, type: 'vehicle', system, ...(folder ? { folder: folder.id } : {}), ...(inShop ? { flags: { [SYSTEM.id]: { shop: true } } } : {}) });
}

/** v0.91.4: one of the GM's catalogue vehicles (for sale, not a player's) with this name, ignoring case. */
function catalogueVehicleNamed(name: string): any | null {
  const n = name.trim().toLowerCase();
  return [...((game as any).actors ?? [])].find((a: any) => vehicleForSale(a) && String(a.name ?? '').trim().toLowerCase() === n) ?? null;
}

/** GM: give a built entry to an actor (free, ready to use, as the GM's free add). */
async function giveEntry(actor: any, e: { type: string; name: string; system: Record<string, unknown> }): Promise<boolean> {
  // v0.91.4: a vehicle or drone is the character's own new actor.
  if (e.type === 'vehicle') return Boolean(await makeOwnedVehicle(actor, { name: e.name, type: 'vehicle', system: foundry.utils.deepClone(e.system) }, ''));
  const data = { name: e.name, type: e.type, system: foundry.utils.deepClone(e.system) };
  const made = await addLines(actor, [{ type: e.type, name: e.name, system: data.system, amount: 1, data, key: e.name }], 'free', true);
  return made.length > 0;
}

/** The make-a-new-entry window. */
export class SR2NewEntry extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS: Record<string, any> = {
    classes: ['sr2e', 'sr2e-new-entry'],
    window: { title: 'SR2E.Window.NewEntry.title', resizable: true, icon: 'fa-solid fa-file-circle-plus' },
    position: { width: 560, height: 720 },
    actions: { readLine: SR2NewEntry.#onRead, saveEntry: SR2NewEntry.#onSave, sendEntry: SR2NewEntry.#onSend, cancelEntry: SR2NewEntry.#onCancel },
  };
  static PARTS: Record<string, any> = { main: { template: `${SYSTEM.PATH.TEMPLATES}/new-entry.hbs`, scrollable: ['.sr2e-ne-body'] } };

  /** Open the form: `kind` (or an item type), the actor it is for, or a player's request to review (GM). */
  static open(o: { actorUuid?: string; kind?: string; type?: string; review?: { actorUuid: string; requestId: string } } = {}): SR2NewEntry | null {
    const w = new SR2NewEntry(o as any);
    if (o.review && !w.loadReview()) return null;
    void w.render({ force: true });
    return w;
  }

  kind: EntryKind = 'gear';
  name = '';
  values: Record<string, string> = {};
  description = '';
  statLine = '';
  readNote = '';
  skippedNote = '';
  inShop = false;
  saveToCatalogue = true;
  give = false;
  actorUuid = '';
  review: { actorUuid: string; requestId: string } | null = null;
  #busy = false;

  constructor(options: any = {}) {
    super(options);
    this.actorUuid = String(options.actorUuid ?? '');
    this.kind = isEntryKind(options.kind) ? options.kind : entryKindForType(String(options.type ?? 'gear'));
    this.review = options.review ?? null;
    // The shop shows only what the GM marks: a new entry goes in it unless the GM unticks it.
    try { this.inShop = shopListMode(game.settings.get(SYSTEM.id, 'shopList')) === 'marked'; } catch { this.inShop = false; }
  }

  get title(): string { return this.review ? tx('SR2E.Window.NewEntry.review') : tx('SR2E.Window.NewEntry.title'); }

  /** GM: fill the form from a player's request (false when it is gone or not an entry). */
  loadReview(): boolean {
    if (!isGm() || !this.review) return false;
    const actor: any = fromUuidSync(this.review.actorUuid);
    const r = actor ? requestsOf(actor).find((x) => x.id === this.review!.requestId) : null;
    const d = r?.kind === 'entry' ? entryRequestData(r.data) : null;
    if (!d) { ui.notifications?.warn?.(tx('SR2E.Notify.NewEntry.requestGone')); return false; }
    this.kind = d.kind; this.name = d.name; this.values = { ...d.values }; this.description = d.description;
    this.actorUuid = this.review.actorUuid;
    return true;
  }

  async _prepareContext(_options: any): Promise<any> {
    const gm = isGm();
    const actor: any = this.actorUuid ? fromUuidSync(this.actorUuid) : null;
    const target = gm ? null : requestActor(this.actorUuid);
    const fields = entryFields(this.kind).map((f) => ({
      id: f.id, label: label(f.labelKey), help: f.help, value: this.values[f.id] ?? '',
      isCheck: f.input === 'check', isSelect: f.input === 'select', isText: f.input === 'text' || f.input === 'number',
      checked: /^(yes|y|x|true|on|1)$/i.test(this.values[f.id] ?? ''),
      options: f.input === 'select' ? ['', ...f.choices.filter((c) => c !== '')].map((c) => ({ value: c, label: f.id === 'legality' && c ? legalityOf(c).label : f.id === 'category' && isVehicleKind(this.kind) && c ? String(RULES.VEHICLES.categories.find((x) => x.id === c)?.label ?? c) : c, selected: c === (this.values[f.id] ?? '') })) : [],
      inputmode: f.input === 'number' ? 'decimal' : 'text',
    }));
    return {
      uid: (this as any).id ?? 'ne',
      kinds: ENTRY_KINDS.map((k) => ({ id: k, label: kindLabel(k), selected: k === this.kind })),
      fields, name: this.name, description: this.description, statLine: this.statLine, readNote: this.readNote, skippedNote: this.skippedNote,
      statMax: STAT_LINE_MAX, nameMax: ENTRY_NAME_MAX, descMax: ENTRY_DESCRIPTION_MAX,
      gm, review: Boolean(this.review), inShop: this.inShop, saveToCatalogue: this.saveToCatalogue, give: this.give,
      giveTo: gm && actor && actor.documentName === 'Actor' ? actor.name : '',
      target: target?.name ?? '', noTarget: !gm && !target,
      shopNote: gm ? '' : tx('SR2E.App.NewEntry.playerNote'),
    };
  }

  /** The form's state from its inputs (no re-render: typing stays). */
  #readForm(root: HTMLElement): void {
    const f: any = root.querySelector('form') ?? root;
    const get = (n: string): any => f.querySelector?.(`[name="${n}"]`);
    this.name = String(get('name')?.value ?? this.name).slice(0, ENTRY_NAME_MAX);
    this.description = String(get('description')?.value ?? this.description).slice(0, ENTRY_DESCRIPTION_MAX);
    this.statLine = String(get('statLine')?.value ?? this.statLine).slice(0, STAT_LINE_MAX);
    for (const fd of entryFields(this.kind)) {
      const el: any = get(`field.${fd.id}`);
      if (!el) continue;
      this.values[fd.id] = fd.input === 'check' ? (el.checked ? 'yes' : '') : String(el.value ?? '');
    }
    for (const k of ['inShop', 'saveToCatalogue', 'give'] as const) { const el: any = get(k); if (el) (this as any)[k] = Boolean(el.checked); }
  }

  /** The entry as the form stands, and the preview line. */
  #built() {
    return buildEntry(this.kind, this.name, this.values, this.description, label);
  }

  #preview(root: HTMLElement): void {
    const b = this.#built();
    const out = root.querySelector<HTMLElement>('.sr2e-ne-preview');
    const probs = root.querySelector<HTMLElement>('.sr2e-ne-problems');
    if (out) {
      const price = entryPrice(b.type, b.system, 1);
      const av = entryAvailability(b.type, b.system).label;
      // Nothing typed yet: no summary (an empty weapon would read "0M").
      const typed = Object.values(this.values).some((v) => String(v ?? '').trim());
      const parts = typed ? [entrySummary(b.type, b.system), price ? `¥${price.toLocaleString()}` : '', av].filter(Boolean) : [];
      out.textContent = parts.length ? tx('SR2E.App.NewEntry.previewLine', { name: b.name || '…', kind: kindLabel(this.kind), what: parts.join(' · ') }) : tx('SR2E.App.NewEntry.previewName', { name: b.name || '…', kind: kindLabel(this.kind) });
    }
    if (probs) { probs.textContent = b.problems.join(' · '); probs.hidden = !b.problems.length; }
  }

  async _onRender(context: any, options: any): Promise<void> {
    await (super._onRender as any)?.(context, options);
    const root: HTMLElement | null = (this as any).element ?? null;
    if (!root) return;
    (root.querySelector('select[name="kind"]') as HTMLSelectElement | null)?.addEventListener('change', (ev) => {
      this.#readForm(root);
      const k = (ev.target as HTMLSelectElement).value;
      if (isEntryKind(k) && k !== this.kind) {
        // Values of fields the new kind also has stay (cost, Availability…).
        const keep = new Set(entryFields(k).map((f) => f.id));
        // v0.91.1 review (R6): an adept power's cost is power points, not nuyen: it never carries over.
        if (k === 'adeptpower' || this.kind === 'adeptpower') keep.delete('cost');
        this.values = Object.fromEntries(Object.entries(this.values).filter(([id]) => keep.has(id)));
        this.kind = k; this.readNote = ''; this.skippedNote = '';
        void this.render();
      }
    });
    root.querySelector('form')?.addEventListener('input', () => { this.#readForm(root); this.#preview(root); });
    root.querySelector('form')?.addEventListener('change', () => { this.#readForm(root); this.#preview(root); });
    root.querySelector('form')?.addEventListener('submit', (ev) => ev.preventDefault());
    this.#preview(root);
  }

  static async #onRead(this: SR2NewEntry) {
    const root: HTMLElement | null = (this as any).element ?? null;
    if (!root) return;
    this.#readForm(root);
    const text = this.statLine.trim();
    if (!text) { ui.notifications?.warn?.(tx('SR2E.Notify.NewEntry.pasteFirst')); return; }
    const r = parseStatLine(this.kind, text);
    if (r.tooLong) { ui.notifications?.warn?.(tx('SR2E.Notify.NewEntry.tooLong', { max: STAT_LINE_MAX })); return; }
    if (r.name) this.name = r.name;
    Object.assign(this.values, r.values);
    const byId = new Map(entryFields(this.kind).map((f) => [f.id, label(f.labelKey)]));
    this.readNote = r.read.length ? tx('SR2E.App.NewEntry.readFields', { fields: r.read.map((id) => byId.get(id) ?? id).join(', ') }) : tx('SR2E.App.NewEntry.readNothing');
    this.skippedNote = r.skipped.length ? tx('SR2E.App.NewEntry.notRead', { words: r.skipped.join(' ') }) : '';
    // The pasted line itself is not kept once read.
    this.statLine = '';
    await this.render();
  }

  static async #onSave(this: SR2NewEntry) {
    const root: HTMLElement | null = (this as any).element ?? null;
    if (!root || this.#busy || !isGm()) return;
    this.#readForm(root);
    const b = this.#built();
    if (b.problems.length) { for (const p of b.problems) ui.notifications?.warn?.(escHtml(p)); return; }
    const actor: any = this.actorUuid ? fromUuidSync(this.actorUuid) : null;
    const give = this.give && actor?.documentName === 'Actor';
    if (!this.saveToCatalogue && !give) { ui.notifications?.warn?.(tx('SR2E.Notify.NewEntry.nothingTicked')); return; }
    this.#busy = true;
    try {
      // A reviewed request must still be there (another GM may have decided it).
      if (this.review) {
        const a: any = fromUuidSync(this.review.actorUuid);
        if (!a || !requestsOf(a).some((x) => x.id === this.review!.requestId)) { ui.notifications?.warn?.(tx('SR2E.Notify.NewEntry.requestGone')); return; }
      }
      let saved: unknown = null;
      if (this.saveToCatalogue) {
        saved = isVehicleKind(b.kind) ? await saveEntryVehicle(b, { inShop: this.inShop }) : await saveEntryTemplate(b, { inShop: this.inShop });
        if (!saved) return;
      }
      if (give && !(await giveEntry(actor, b))) { ui.notifications?.warn?.(tx('SR2E.Notify.NewEntry.notGiven', { name: escHtml(b.name), actorName: escHtml(actor?.name ?? '') })); return; }
      // v0.91.1 review (R5): decided elsewhere in the meantime: the template stands, the player hears from that decision.
      if (this.review && !(await finishRequest(fromUuidSync(this.review.actorUuid), this.review.requestId))) ui.notifications?.warn?.(tx('SR2E.Notify.NewEntry.requestGoneSaved'));
      ui.notifications?.info?.(saved ? (this.inShop ? tx('SR2E.Notify.NewEntry.savedInShop', { name: escHtml(b.name) }) : tx('SR2E.Notify.NewEntry.saved', { name: escHtml(b.name) })) : tx('SR2E.Notify.NewEntry.given', { name: escHtml(b.name), actorName: escHtml(actor?.name ?? '') }));
      await this.close();
    } finally { this.#busy = false; }
  }

  static async #onSend(this: SR2NewEntry) {
    const root: HTMLElement | null = (this as any).element ?? null;
    if (!root || this.#busy) return;
    this.#readForm(root);
    const actor = requestActor(this.actorUuid);
    if (!actor) { ui.notifications?.warn?.(tx('SR2E.Notify.NewEntry.noCharacter')); return; }
    const b = this.#built();
    if (b.problems.length) { for (const p of b.problems) ui.notifications?.warn?.(escHtml(p)); return; }
    this.#busy = true;
    try {
      const ok = await fileRequest(actor, { kind: 'entry', label: tx('SR2E.Text.NewEntry.requestLabel', { name: b.name, kind: kindLabel(this.kind) }), keepOthers: true,
        data: { kind: this.kind, name: b.name, values: { ...this.values }, description: this.description } });
      if (ok) await this.close();
    } finally { this.#busy = false; }
  }

  static async #onCancel(this: SR2NewEntry) { await this.close(); }
}

/**
 * The runner a plain Approve uses (the Review window is the usual way): the entry is built again from the request's
 * strings and saved as a world template, marked "in the shop" when the shop shows only marked entries.
 */
registerRequestRunner('entry', async (_actor, data) => {
  const d = entryRequestData(data);
  if (!d) return false;
  const b = buildEntry(d.kind, d.name, d.values, d.description, label);
  if (b.problems.length) return false;
  let marked = false;
  try { marked = shopListMode(game.settings.get(SYSTEM.id, 'shopList')) === 'marked'; } catch { marked = false; }
  if (isVehicleKind(b.kind)) return Boolean(await saveEntryVehicle(b, { inShop: marked, confirm: false }));
  return Boolean(await saveEntryTemplate(b, { inShop: marked, confirm: false }));
}, (_actor, r) => {
  const d = entryRequestData(r.data);
  if (!d) return [tx('SR2E.App.NewEntry.notAnEntry')];
  const b = buildEntry(d.kind, d.name, d.values, d.description, label);
  const out = [...b.problems];
  // v0.91.1 review (B1): a plain Approve never replaces a template the GM has: Review… shows both and asks first.
  if (isVehicleKind(b.kind) ? Boolean(catalogueVehicleNamed(b.name)) : worldTemplates().some((t) => t.type === b.type && t.name.toLowerCase() === b.name.toLowerCase())) out.push(tx('SR2E.App.NewEntry.nameTaken', { name: b.name }));
  if (r.karma || r.nuyen) out.push(tx('SR2E.App.Adding.filedWithACostButIts'));
  return out;
});

/** For the item types a shop tab shows: the kind the form starts on. */
export const entryKindFor = (type: string): EntryKind => entryKindForType(type === 'kit' ? 'gear' : type);
export { entryItemType };
