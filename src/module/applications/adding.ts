/**
 * v0.63.0: adding things to sheets and the sheet tools.
 * - The Add window (a + on every list heading): a tab per item type, search, the GM's world templates,
 *   the built-in templates, world items and compendium items; tick several, set a number, then add
 *   them free, buy them (nuyen, with a ledger line) or learn them with Good Karma (spells).
 * - The skill picker (a + on each skill list): kind, name, linked attribute, rating, specialization;
 *   free or learned with Karma.
 * - Sheet tools, applied after each render: an Edit / Play switch, a search box, folding sections
 *   (remembered per browser), row number edits, pins and the setup warnings' jump links.
 * The rules (prices, Karma, warnings) are in `rules/catalogue.ts`.
 */
import { SYSTEM } from '../config/system.ts';
import {
  ADD_TYPES, typeLabel, paymentChoices, amountLocked, amountMax, systemWithAmount, RULES, PAYMENT_LABELS, rowAmount, entrySummary, entryPrice, entryAvailability, basketPlan, 
  newSkillKarma, skillAttributeFor, itemAcquireHours, copiesOf, COMMON_SKILLS, SKILL_KIND_LABELS, togglePin, copyName, matchesSearch, specializationTrade,
  type AddPayment, type BasketLine, type SkillKind,
  skillBandAttribute, canonicalSkillNames, canonicalSkillName, sameSkillName, timedNewSkillSystem,
} from '../rules/index.ts';
import { magicKindOf } from '../rules/advancement.ts';
import { ITEM_TYPES_FOR, arrivalReset } from './drops.ts';
import { openCompactTab } from './interface.ts';
import { readyNote, readyPatch, createFromBasket, remember, store, sheetMode, applyMode, toggleFold, foldedPart } from './sheettools.ts';
import { approvalNeeded, fileRequest, registerRequestRunner, inCreation } from './approvals.ts';
import { kits } from './setup.ts';
import { kitSummary, kitPrice, kitLinesFor } from '../rules/setup.ts';
import { escHtml } from '../rules/html.ts';
import { shopLegalTitle } from '../rules/legalbuy.ts';
import { t as tx, tKey } from '../helpers/i18n.ts';
import { headingName } from '../helpers/heading.ts';
import { SR2Codex } from './codex.ts';
import { askFindThrough } from './through.ts';
import { buyFormula } from './formulas.ts';
import { formulasRequired } from '../rules/formulas.ts';
import { SR2NewEntry, entryKindFor } from './newentry.ts';
import { entriesFor, entryData, entryShown, shopSettings, toggleShopMark, kitShopKeys, shopTab, setShopAdder, vehicleListChange, vehicleForSale, type Entry } from './shop.ts';
import { buysByFinding, shopRowInfo, retryFlagKey, retryHoursLeft, timeLabel, soldInShop, shopGroupOf, shopGroupRank, shopGroupsFor, passesGroups, SHOP_GROUP_KEYS, isCodexType, parseShopKey } from '../rules/index.ts';

const { HandlebarsApplicationMixin, ApplicationV2, DialogV2 } = foundry.applications.api;

/** A-15: the shared escape helper (rules/html.ts). */
const esc = escHtml;

/** Types the Add window offers on an actor (skills have their own picker but keep a tab that opens it). */
export function addTypesFor(actorType: string): string[] {
  const ok = ITEM_TYPES_FOR[actorType] ?? [];
  return ADD_TYPES.map((t) => t.type).filter((t) => ok.includes(t));
}

/** v0.66.0: the window's tabs: the item types, plus Kits when the world has any this actor can use. */
function windowTypesFor(actorType: string): string[] {
  // v0.91.4: a character can get vehicles and drones (actors of their own, not items on the sheet).
  const types = actorType === 'character' ? [...addTypesFor(actorType), 'vehicle'] : addTypesFor(actorType);
  const ok = ITEM_TYPES_FOR[actorType] ?? [];
  return types.length && kits().some((k) => kitLinesFor(k, ok).lines.length) ? [...types, 'kit'] : types;
}
const tabLabel = (t: string, plural = true) => (t === 'kit' ? (plural ? 'Kits' : 'kit') : typeLabel(t, plural));

/**
 * v0.91.1: whose shop the Shop button opens: a player's assigned character, else a selected token's character they
 * own, else the character they own by name (not only through everyone's default ownership); the GM's selected token.
 * `pick` lists the characters to choose from when that leaves several.
 */
export function shopActor(): { actor: any | null; pick: any[] } {
  const user: any = (game as any).user;
  const owned = (a: any) => a && a.isOwner && ['character', 'npc'].includes(a.type);
  // One selected token of an actor you own (several selected say nothing about which one shops).
  const sel: any[] = [...new Set(((globalThis as any).canvas?.tokens?.controlled ?? []).map((t: any) => t.actor).filter(owned))];
  const token: any = sel.length === 1 ? sel[0] : null;
  if (user?.isGM) return { actor: token, pick: [] };
  if (owned(user?.character)) return { actor: user.character, pick: [] };
  if (token) return { actor: token, pick: [] };
  const mine = [...((game as any).actors ?? [])].filter((a: any) => a.type === 'character' && a.isOwner);
  const named = mine.filter((a: any) => Number(a.ownership?.[user?.id] ?? 0) >= 3);
  const list = named.length ? named : mine;
  return list.length === 1 ? { actor: list[0], pick: [] } : { actor: null, pick: list };
}

/**
 * v0.91.1: open the shop (the Add window, set to buy) for an actor, or for `shopActor()` (asking which when several).
 * v0.91.3: `type` and `query` open it on a tab with a search (a Catalogue page's Buy); `shop: false` opens the plain
 * Add window (a spell or an adept power is learned, not bought).
 */
export async function openShop(actor?: any, o: { type?: string; query?: string; shop?: boolean; payment?: AddPayment } = {}): Promise<SR2AddWindow | null> {
  let a = actor;
  if (!a) {
    const r = shopActor();
    a = r.actor;
    if (!a && r.pick.length) {
      const id = await DialogV2.prompt({
        window: { title: tx('SR2E.Dialog.Shop.whoShops') },
        content: `<div class="form-group"><label>${tx('SR2E.Dialog.Shop.character')}</label><select name="who">${r.pick.map((x: any) => `<option value="${esc(x.id)}">${esc(x.name)}</option>`).join('')}</select></div>`,
        ok: { label: tx('SR2E.Dialog.Shop.open'), callback: (_e: Event, b: any) => String(b.form.elements.who.value ?? '') },
        rejectClose: false,
      } as any);
      a = id ? r.pick.find((x: any) => x.id === id) : null;
      if (!a) return null;
    }
  }
  if (!a) { ui.notifications?.warn?.((game as any).user?.isGM ? tx('SR2E.Notify.Shop.gmSelectToken') : tx('SR2E.Notify.Shop.noCharacter')); return null; }
  const types = windowTypesFor(a.type);
  const shop = o.shop !== false;
  const type = o.type && types.includes(o.type) ? o.type : types.includes('weapon') ? 'weapon' : types[0];
  if (o.type && !types.includes(o.type)) { ui.notifications?.warn?.(tx('SR2E.Notify.Codex.cannotHold', { name: esc(a.name) })); return null; }
  return SR2AddWindow.show(a, type, { shop, ...(typeof o.query === 'string' ? { query: o.query } : {}), ...(o.payment ? { payment: o.payment } : {}) });
}

/** v0.91.1: a Shop button in the title bar of a character sheet its owner sees (beside Print and the Guide). */
export function addShopButton(app: any, el: unknown): boolean {
  const root: HTMLElement | null = el instanceof HTMLElement ? el : app?.element ?? null;
  const doc: any = app?.document;
  if (!root?.classList?.contains('sr2e') || doc?.documentName !== 'Actor' || doc.type !== 'character' || !doc.isOwner) return false;
  const header = root.querySelector<HTMLElement>(':scope > .window-header');
  if (!header || header.querySelector('.sr2e-shop-button')) return false;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'header-control icon fa-solid fa-store sr2e-shop-button';
  button.dataset['tooltip'] = tx('SR2E.App.Shop.shopButton');
  button.setAttribute('aria-label', tx('SR2E.App.Shop.shopButtonFor', { name: doc.name }));
  button.addEventListener('click', (ev) => { ev.preventDefault(); ev.stopPropagation(); void openShop(doc); });
  const before = header.querySelector('.sr2e-print-button, .sr2e-guide-button, [data-action="toggleControls"], [data-action="close"]');
  if (before?.parentElement) before.parentElement.insertBefore(button, before);
  else header.appendChild(button);
  return true;
}

export function registerShopButton(): void {
  Hooks.on('renderApplicationV2', (app: any, el: unknown) => {
    try { addShopButton(app, el); } catch (err) { console.warn('sr2e | shop button', err); }
  });
}

/** v0.91.0: the line under the shop's list saying what players see (for the GM) or that the GM chose (for a player). */
function shopNoteFor(isGM: boolean): string {
  const s = shopSettings();
  if (isGM) {
    const what = s.mode === 'catalogue' ? tx('SR2E.App.Shop.gmSees.catalogue') : s.mode === 'marked' ? tx('SR2E.App.Shop.gmSees.marked') : tx('SR2E.App.Shop.gmSees.all');
    return s.allowForbidden ? what : `${what} ${tx('SR2E.App.Shop.gmSeesForbidden')}`;
  }
  return s.mode === 'catalogue' ? tx('SR2E.App.Shop.playerSees.catalogue') : s.mode === 'marked' ? tx('SR2E.App.Shop.playerSees.marked') : '';
}

/** The Add window. One per actor (opening it again brings it forward on the asked tab). */
export class SR2AddWindow extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS: Record<string, any> = {
    classes: ['sr2e', 'sr2e-add'],
    window: { title: 'SR2E.Window.Adding.add', resizable: true, icon: 'fa-solid fa-plus' },
    position: { width: 640, height: 640 },
    actions: {
      addTab: SR2AddWindow.#onTab,
      addSelected: SR2AddWindow.#onAdd,
      blankNew: SR2AddWindow.#onBlank,
      // v0.91.0: the GM puts an entry in the shop or takes it out.
      shopMark: SR2AddWindow.#onShopMark,
      // v0.91.1: "Not in the list? Make a new entry".
      newEntry: SR2AddWindow.#onNewEntry,
      // v0.91.3: a row's page in the Catalogue.
      codexOpen: SR2AddWindow.#onCodexOpen,
      // v0.91.8: a spell row's "Buy a formula…".
      buyFormula: SR2AddWindow.#onBuyFormula,
      openSkillPicker: SR2AddWindow.#onSkillPicker,
    },
  };
  static PARTS: Record<string, any> = { main: { template: `${SYSTEM.PATH.TEMPLATES}/add-window.hbs`, scrollable: [''] } };

  static #open = new Map<string, SR2AddWindow>();
  static #hooked = false;

  /** Open (or bring forward) the window for an actor on a type's tab. */
  static show(actor: any, type?: string, o: { shop?: boolean; query?: string; payment?: AddPayment } = {}): SR2AddWindow | null {
    if (!actor?.isOwner) { ui.notifications?.warn?.(tx('SR2E.Notify.Adding.onlyTheOwnerCanAddThings')); return null; }
    // v0.91.2: as the shop (the Shop button) it shows only the tabs that sell things.
    const types = windowTypesFor(actor.type).filter((t) => !o.shop || soldInShop(t) || (t === 'spell' && formulasRequired()));
    if (!types.length) { ui.notifications?.warn?.(tx('SR2E.Notify.Adding.doesnTHoldItems', { actorName: escHtml(actor.name) })); return null; }
    if (!SR2AddWindow.#hooked) {
      SR2AddWindow.#hooked = true;
      // The footer's nuyen and Karma follow the actor.
      Hooks.on('updateActor', (a: any) => { const win = SR2AddWindow.#open.get(a?.uuid); if (win) win.refreshMoney(); });
      // v0.91.4: a vehicle for sale changed (put in or out of the shop, priced, made or removed): the shops read their lists again.
      // v0.91.4 review (R5): only changes the list shows (not a chase's speed or damage), only the Vehicles tab.
      const vehicles = (a: any, ch?: any) => {
        if (a?.type !== 'vehicle' || (ch && typeof ch === 'object' && !vehicleListChange(ch))) return;
        for (const win of SR2AddWindow.#open.values()) { win.clearCache('vehicle'); if (win.type === 'vehicle') void win.render(); }
      };
      Hooks.on('updateActor', (a: any, ch: any) => vehicles(a, ch)); Hooks.on('createActor', (a: any) => vehicles(a)); Hooks.on('deleteActor', (a: any) => vehicles(a));
      // The catalogue folder renamed, moved or removed changes what is for sale.
      const folders = (f: any) => { if (f?.type !== 'Actor') return; for (const win of SR2AddWindow.#open.values()) { win.clearCache('vehicle'); if (win.type === 'vehicle') void win.render(); } };
      Hooks.on('updateFolder', folders); Hooks.on('deleteFolder', folders);
      // v0.91.0 review: a world item put in or taken out of the shop re-reads every open shop.
      Hooks.on('updateItem', (i: any, ch: any) => {
        if (i?.parent || ch?.flags?.[SYSTEM.id]?.shop === undefined) return;
        for (const win of SR2AddWindow.#open.values()) { win.clearCache(); void win.render(); }
      });
    }
    let w = SR2AddWindow.#open.get(actor.uuid);
    if (!w) { w = new SR2AddWindow({ actorUuid: actor.uuid } as any); SR2AddWindow.#open.set(actor.uuid, w); }
    w.shopMode = Boolean(o.shop);
    const next = type && types.includes(type) ? type : (types.includes(w.type) ? w.type : types[0]!);
    // Another tab: its ticks, search and categories don't carry over.
    if (next !== w.type) { w.type = next; w.query = ''; w.ticked.clear(); w.groups.clear(); w.readyTouched = false; }
    // v0.91.1: opened as the shop (the Shop button): set to buy (Find & buy where the buyer finds first).
    if (o.shop) { w.payment = w.finds ? 'find' : 'buy'; w.readyTouched = false; }
    // v0.91.3: opened from a Catalogue page: that entry searched for (and no category hiding it).
    if (typeof o.query === 'string') { w.query = o.query.slice(0, 100); w.groups.clear(); }
    // v0.91.3 review (R5): Learn… from a Catalogue page starts on Learn with Good Karma (the window keeps it only where it is offered).
    if (o.payment) { w.payment = o.payment; w.readyTouched = false; }
    // v0.91.2 review (R3): the title follows the mode (an open window's render alone keeps its old title).
    void w.render({ force: true, window: { title: w.title } } as any);
    return w;
  }

  actorUuid: string;
  type = 'weapon';
  query = '';
  /** v0.91.0: 'find' = Find & buy (the shop's Availability test first; a player character out of creation). */
  payment: AddPayment | 'find' = 'free';
  ready = true;
  readyTouched = false;
  /** key → number (ticked rows only). */
  ticked = new Map<string, number>();
  /** v0.91.2: opened as the shop (the Shop button): only the tabs that sell things, only ways to buy. */
  shopMode = false;
  /** v0.91.2: the categories ticked on this tab (none = every row). */
  groups = new Set<string>();
  #entries: Entry[] = [];
  /** Entries by type, read once per window (compendium indexes can be big). */
  #cache = new Map<string, Entry[]>();
  #busy = false;

  constructor(options: any = {}) {
    super(options);
    this.actorUuid = String(options.actorUuid ?? '');
  }

  get actor(): any { return fromUuidSync(this.actorUuid); }

  /** v0.91.0: forget the read entries (the GM changed the shop or the catalogue): the next render reads them again. */
  clearCache(type?: string): void { if (type) this.#cache.delete(type); else this.#cache.clear(); }

  /** v0.91.0: does this window's buyer find things before buying (rules/shop.ts buysByFinding)? */
  get finds(): boolean {
    const a = this.actor;
    return Boolean(a) && buysByFinding({ isGM: Boolean(game.user?.isGM), actorType: String(a.type ?? ''), inCreation: inCreation(a) });
  }

  /** The payment the rules price by (Find & buy is priced as a purchase). */
  get pay(): AddPayment { return this.payment === 'find' ? 'buy' : this.payment; }

  /** Update the footer's money line (no re-render: ticks and typing stay). */
  refreshMoney(): void {
    const a = this.actor;
    const el = ((this as any).element as HTMLElement | null)?.querySelector<HTMLElement>('[data-money]');
    if (el && a?.type === 'character') el.textContent = tx('SR2E.App.Adding.goodKarma', { nuyen: Number(a.system.nuyen ?? 0).toLocaleString(), karma: Number(a.system.karma?.good ?? 0) });
    const root: HTMLElement | null = (this as any).element ?? null;
    if (root) this.#total(root);
  }

  // v0.91.1: set to buy, it is the shop.
  get title(): string { const name = this.actor?.name ?? tx('SR2E.Window.Adding.sheet'); return this.shopMode ? tx('SR2E.Window.Adding.shopFor', { name }) : tx('SR2E.Window.Adding.addTo', { name }); }

  async close(options?: any): Promise<any> {
    SR2AddWindow.#open.delete(this.actorUuid);
    return super.close(options);
  }

  async _prepareContext(_options: any): Promise<any> {
    const actor = this.actor;
    // v0.91.8: with formulas on, the shop has the Spells tab too (a row's Buy a formula…).
    const types = windowTypesFor(actor?.type ?? 'character').filter((t) => !this.shopMode || soldInShop(t) || (t === 'spell' && formulasRequired()));
    if (!types.includes(this.type)) this.type = types[0] ?? 'weapon';
    const isKit = this.type === 'kit';
    // v0.64.0: in the creation wizard nothing is learned with Karma (spells come from spell points).
    // v0.66.0: kits are added free or bought (a kit holding things that can't be bought says so on Add).
    const base = (isKit ? paymentChoices('gear', actor?.type ?? 'npc').filter((p) => p !== 'karma') : paymentChoices(this.type, actor?.type ?? 'npc')).filter((p) => p !== 'karma' || !inCreation(actor));
    // v0.91.0 (RULES.SHOP_V91.buying 'find'): out of creation a player character finds things before buying them.
    const finds = this.finds;
    const all: Array<AddPayment | 'find'> = finds ? base.map((p) => (p === 'buy' ? 'find' : p)) : base;
    // v0.91.2: the shop only buys: a player gets Find & buy (or Buy now), the GM Buy now and Free (a gift).
    const buying = all.filter((p) => p === 'find' || p === 'buy');
    // v0.91.2 review (R4): in character creation the shop keeps every way to pay (Free too).
    const pays: Array<AddPayment | 'find'> = this.shopMode && buying.length && !inCreation(actor) ? (Boolean(game.user?.isGM) ? all.filter((p) => p !== 'karma') : buying)
      // v0.91.8 review (R7): the shop's Spells tab (formulas on) only learns for a player (Learn uses a held formula); a row's scroll buys one.
      : this.shopMode && this.type === 'spell' && !inCreation(actor) && !Boolean(game.user?.isGM) && all.includes('karma') ? ['karma'] : all;
    if (!pays.includes(this.payment)) this.payment = (this.payment === 'karma' || this.payment === 'buy' || this.payment === 'find') && pays.includes(finds ? 'find' : 'buy') ? (finds ? 'find' : 'buy') : pays[0]!;
    // v0.71.0 (R21): in creation a focus (free or bought with nuyen) arrives bonded with spell points.
    // v0.71.0 review (F4): only a magician with starting spell points bonds that way; anyone else's focus arrives unbonded.
    const inCreationFocus = this.type === 'focus' && Boolean(actor) && inCreation(actor) && RULES.FIXES_V71.creationFoci === 'spellPoints';
    const kind = actor ? magicKindOf(String(actor.system?.tradition ?? 'none'), Number(actor.system?.magic ?? 0)) : 'none';
    const creationFocus = inCreationFocus && kind !== 'none' && kind !== 'adept';
    if (!this.readyTouched) this.ready = inCreationFocus ? creationFocus : this.payment === 'free';
    const isSkill = this.type === 'skill';
    if (isKit) this.#entries = kits().filter((k) => kitLinesFor(k, ITEM_TYPES_FOR[actor?.type ?? 'npc'] ?? []).lines.length)
      .map((k) => ({ key: `kit:${k.id}`, type: 'kit', name: k.name, img: '', system: {}, source: k.notes || tx('SR2E.App.Adding.starterKit'), kit: k }));
    else {
      if (!isSkill && !this.#cache.has(this.type)) this.#cache.set(this.type, await entriesFor(this.type));
      // v0.91.0: players see the shop list the GM chose (rules/shop.ts shopShows); the GM sees everything.
      this.#entries = isSkill ? [] : (this.#cache.get(this.type) ?? []).filter((e) => entryShown(e));
    }
    const amt = rowAmount(this.type);
    const isGM = Boolean(game.user?.isGM);
    const now = Number((game as any).time?.worldTime ?? 0);
    const retries: Record<string, any> = (actor?.flags?.[SYSTEM.id]?.findRetry as Record<string, any> | undefined) ?? {};
    // v0.91.2: each row's category; sorted by category, then name.
    // v0.91.2 review (R5): each entry classified once.
    const groupOf = new Map<Entry, string>(this.#entries.map((e) => [e, shopGroupOf(e.type, e.name, e.system)]));
    const sorted = [...this.#entries].sort((a, b) => shopGroupRank(a.type, groupOf.get(a)!) - shopGroupRank(b.type, groupOf.get(b)!) || a.name.localeCompare(b.name));
    const entries = sorted.map((e) => {
      if (e.kit) {
        const pr = kitPrice(e.kit, actor?.type ?? 'character');
        const summary = kitSummary(e.kit, 8);
        return { ...e, summary, price: pr.nuyen ? `¥${pr.nuyen.toLocaleString()}` : '', avail: '', ticked: this.ticked.has(e.key), amount: 1, locked: true, max: 1,
          search: `${e.name} ${summary} ${e.source}`.toLowerCase(), hidden: !matchesSearch(`${e.name} ${summary} ${e.source}`, this.query), legal: '', legalTitle: '', priceTitle: '', retry: '' };
      }
      const av = entryAvailability(e.type, e.system);
      // v0.91.0: the shop's row: the price with its Street Index, legality, a failed find's wait, the GM's shop mark.
      const info = shopRowInfo(e.type, e.system);
      const left = actor ? retryHoursLeft(retries[retryFlagKey(e.key)], now, isGM) : 0;
      const price = entryPrice(e.type, e.system, 1);
      const defAmount = amt.kind === 'value' && amt.field ? Math.max(1, Number(e.system?.[amt.field] ?? 1) || 1) : 1;
      const locked = amountLocked(e.type, this.pay);
      return { ...e, summary: entrySummary(e.type, e.system), price: price ? `¥${price.toLocaleString()}` : '', avail: av.label, ticked: this.ticked.has(e.key), amount: locked ? defAmount : this.ticked.get(e.key) ?? defAmount, locked, max: amountMax(e.type),
        legal: info.legalityLabel, legalTitle: shopLegalTitle(info.legality), forbidden: info.forbidden, priceTitle: price && info.streetIndex !== 1 ? tx('SR2E.App.Shop.streetIndexTitle', { si: info.streetIndex }) : '',
        retry: left > 0 ? tx('SR2E.App.Shop.tryAgainIn', { time: timeLabel(left) }) : '',
        markable: isGM && shopTab(e.type) && (e.key.startsWith('tpl:w:') || e.key.startsWith('world:') || e.key.startsWith('actor:')),
        group: groupOf.get(e) ?? '',
        codex: isCodexType(e.type),
        formula: e.type === 'spell' && formulasRequired() && Boolean(actor),
        search: `${e.name} ${entrySummary(e.type, e.system)} ${e.source}`.toLowerCase(),
        hidden: !matchesSearch(`${e.name} ${entrySummary(e.type, e.system)} ${e.source}`, this.query) || !passesGroups(groupOf.get(e) ?? '', this.groups) };
    });
    // v0.91.2: a check box per category on this tab that has rows (with how many).
    const counts = new Map<string, number>();
    for (const e of entries as any[]) if (e.group) counts.set(e.group, (counts.get(e.group) ?? 0) + 1);
    for (const g of [...this.groups]) if (!counts.has(g)) this.groups.delete(g);
    const groups = shopGroupsFor(this.type).filter((g) => counts.has(g)).map((g) => ({ id: g, label: tKey(SHOP_GROUP_KEYS[g] ?? ''), count: counts.get(g), checked: this.groups.has(g) }));
    return {
      actorName: actor?.name ?? '',
      tabs: types.map((t) => ({ type: t, label: tabLabel(t), active: t === this.type })),
      type: this.type, one: tabLabel(this.type, false), plural: tabLabel(this.type), isSkill, isKit, isVehicle: this.type === 'vehicle',
      query: this.query, entries, amountLabel: amt.label,
      groups: groups.length > 1 ? groups : [], shopMode: this.shopMode,
      hasLegal: (entries as any[]).some((e) => e.legal),
      payments: pays.map((p) => ({ id: p, label: p === 'find' ? tx('SR2E.App.Shop.findAndBuy') : PAYMENT_LABELS[p], selected: p === this.payment })),
      finding: this.payment === 'find',
      shopTab: shopTab(this.type), isGM,
      shopNote: shopTab(this.type) ? shopNoteFor(isGM) : '',
      findNote: this.payment === 'find' ? tx('SR2E.App.Shop.findNote', { skill: RULES.UPKEEP.availability.skill }) : '',
      readyNote: isKit ? tx('SR2E.App.Adding.readyToUseInstalledWornBonded') : readyNote(this.type), ready: this.ready,
      approvalNote: actor && approvalNeeded(actor) && this.payment === 'find' ? tx('SR2E.App.Shop.queueOnFind') : actor && approvalNeeded(actor) && this.payment !== 'free' ? tx('SR2E.App.Adding.theApprovalQueueIsOnThis') : actor && approvalNeeded(actor) ? tx('SR2E.App.Adding.theApprovalQueueIsOnFree') : '',
      creationNote: actor && inCreation(actor) ? (creationFocus ? tx('SR2E.App.Adding.inCharacterCreationFocus') : tx('SR2E.App.Adding.inCharacterCreation')) : '',
      karmaNote: this.payment === 'karma' && this.type === 'spell' ? `${RULES.MAGIC_V56.learning.enabled ? tx('SR2E.App.Adding.learningTestsAreOn', { skill: RULES.MAGIC_V56.learning.skill }) : tx('SR2E.App.Adding.eachSpellCostsItsForce')}${formulasRequired() && actor?.type === 'character' && !inCreation(actor) ? ` ${tx('SR2E.App.Formula.learnNeedsFormula')}` : ''}` : '',
      formulaNote: this.type === 'spell' && formulasRequired() ? tx('SR2E.App.Formula.rowHint') : '',
      money: actor?.type === 'character' ? { nuyen: Number(actor.system.nuyen ?? 0).toLocaleString(), karma: Number(actor.system.karma?.good ?? 0) } : null,
      packCount: [...((game as any).packs ?? [])].filter((p: any) => p.documentName === 'Item').length,
    };
  }

  /** Ticks, numbers, the search and the payment work without a re-render; the total follows them. */
  async _onRender(context: any, options: any): Promise<void> {
    await (super._onRender as any)?.(context, options);
    const root: HTMLElement | null = (this as any).element ?? null;
    if (!root) return;
    const search = root.querySelector<HTMLInputElement>('.sr2e-add-search');
    search?.addEventListener('input', () => {
      this.query = search.value;
      for (const tr of Array.from(root.querySelectorAll<HTMLElement>('tr[data-key]'))) tr.hidden = !matchesSearch(tr.dataset['search'] ?? '', this.query) || !passesGroups(tr.dataset['group'] ?? '', this.groups);
      this.#total(root);
    });
    if (search && options?.isFirstRender !== false) search.focus();
    for (const tr of Array.from(root.querySelectorAll<HTMLElement>('tr[data-key]'))) {
      const key = tr.dataset['key']!;
      const box = tr.querySelector<HTMLInputElement>('.sr2e-add-tick');
      const num = tr.querySelector<HTMLInputElement>('.sr2e-add-amount');
      const sync = () => {
        if (num) num.value = String(Math.min(Number(num.max) || 99, Math.max(1, Math.floor(Number(num.value) || 1))));
        if (box?.checked) this.ticked.set(key, Math.max(1, Math.floor(Number(num?.value) || 1)));
        else this.ticked.delete(key);
        this.#total(root);
      };
      box?.addEventListener('change', sync);
      num?.addEventListener('change', () => { if (box && !box.checked) box.checked = true; sync(); });
      // v0.91.3 review (B1): the Catalogue link in the name cell doesn't tick the row.
      tr.querySelector('.sr2e-add-name')?.addEventListener('click', (ev) => { if ((ev.target as HTMLElement | null)?.closest?.('[data-action]')) return; if (box) { box.checked = !box.checked; sync(); } });
    }
    // v0.91.2: the category check boxes filter the rows (with the search), no re-render.
    for (const box of Array.from(root.querySelectorAll<HTMLInputElement>('.sr2e-add-group'))) {
      box.addEventListener('change', () => {
        const g = box.value;
        if (box.checked) this.groups.add(g); else this.groups.delete(g);
        for (const tr of Array.from(root.querySelectorAll<HTMLElement>('tr[data-key]'))) tr.hidden = !matchesSearch(tr.dataset['search'] ?? '', this.query) || !passesGroups(tr.dataset['group'] ?? '', this.groups);
        this.#total(root);
      });
    }
    root.querySelector<HTMLSelectElement>('.sr2e-add-payment')?.addEventListener('change', (ev) => { this.payment = (ev.target as HTMLSelectElement).value as AddPayment | 'find'; this.readyTouched = false; void this.render(); });
    root.querySelector<HTMLInputElement>('.sr2e-add-ready')?.addEventListener('change', (ev) => { this.ready = (ev.target as HTMLInputElement).checked; this.readyTouched = true; });
    this.#total(root);
  }

  #basket(): Array<BasketLine & { key: string }> {
    const out: Array<BasketLine & { key: string }> = [];
    for (const [key, amount] of this.ticked) {
      const e = this.#entries.find((x) => x.key === key);
      if (e?.kit) {
        // v0.66.0: a kit is its lines (those this actor can hold).
        const { lines } = kitLinesFor(e.kit, ITEM_TYPES_FOR[this.actor?.type ?? 'npc'] ?? []);
        lines.forEach((l, i) => out.push({ key: `${key}#${i}`, type: l.type, name: l.name, system: l.system, amount: amountLocked(l.type, this.pay) ? 0 : l.amount, kitData: { name: l.name, type: l.type, system: l.system } } as any));
      } else if (e) out.push({ key, type: e.type, name: e.name, system: e.system, amount: amountLocked(e.type, this.pay) ? 0 : amount });
    }
    return out;
  }

  #plan(lines: BasketLine[] = this.#basket()) {
    const a = this.actor;
    // v0.91.0: a find pays nothing yet (the card's Buy does), so it can't cost more than the buyer has.
    return basketPlan(lines, { payment: this.pay, actorType: a?.type ?? 'npc', nuyen: this.payment === 'find' ? Number.MAX_SAFE_INTEGER : Number(a?.system?.nuyen ?? 0), karma: Number(a?.system?.karma?.good ?? 0) });
  }

  #total(root: HTMLElement): void {
    const out = root.querySelector<HTMLElement>('.sr2e-add-total');
    const go = root.querySelector<HTMLButtonElement>('[data-action="addSelected"]');
    const n = this.ticked.size;
    const p = this.#plan();
    if (out) {
      const cost = this.payment === 'buy' || this.payment === 'find' ? ` · ¥${p.nuyen.toLocaleString()}` : this.payment === 'karma' ? ` · ${tx('SR2E.App.Adding.karma', { karma: p.karma })}` : '';
      const hidden = [...this.ticked.keys()].filter((k) => { const tr = root.querySelector<HTMLElement>(`tr[data-key="${CSS.escape(k)}"]`); return tr?.hidden; }).length;
      out.textContent = n ? `${hidden ? tx('SR2E.App.Adding.tickedHidden', { n, hidden }) : tx('SR2E.App.Adding.ticked', { n })}${cost}` : tx('SR2E.App.Adding.tickWhatToAdd');
      out.classList.toggle('sr2e-warn', p.problems.length > 0);
      out.title = p.problems.join('\n');
    }
    if (go) go.disabled = !n || this.#busy;
  }

  static async #onTab(this: SR2AddWindow, _e: Event, t: HTMLElement) {
    const type = t.dataset['type'];
    if (!type || type === this.type) return;
    this.type = type; this.query = ''; this.ticked.clear(); this.groups.clear(); this.readyTouched = false;
    await this.render();
  }

  static async #onSkillPicker(this: SR2AddWindow) {
    const a = this.actor;
    if (a) await openSkillPicker(a, 'active');
  }

  static async #onBlank(this: SR2AddWindow) {
    const a = this.actor;
    if (!a || this.#busy) return;
    if (this.type === 'skill') { await openSkillPicker(a, 'active'); return; }
    // v0.64.0: a blank item can be filled with anything: with the approval queue on, the GM makes those.
    if (approvalNeeded(a)) { ui.notifications?.warn?.(tx('SR2E.Notify.Adding.theApprovalQueueIsOnAsk')); return; }
    this.#busy = true;
    try {
      const [made] = await a.createEmbeddedDocuments('Item', [{ name: `New ${typeLabel(this.type, false)}`, type: this.type }]);
      made?.sheet?.render(true);
    } finally { this.#busy = false; }
  }

  /**
   * v0.91.0: Find & buy: each ticked row (each line of a ticked kit) gets its own find card (the Availability test);
   * Buy or Haggle on the card pays, and the item arrives after the time it took to find (Under way).
   */
  async #find(): Promise<void> {
    const actor = this.actor;
    if (!actor || this.#busy) return;
    this.#busy = true;
    const root: HTMLElement | null = (this as any).element ?? null;
    if (root) this.#total(root);
    try {
      const jobs: Array<{ key: string; qty: number }> = [];
      for (const [key, amount] of this.ticked) {
        const e = this.#entries.find((x) => x.key === key);
        if (!e) continue;
        if (e.kit) { for (const k of kitShopKeys(e.kit, ITEM_TYPES_FOR[actor.type] ?? [])) { const line = e.kit.lines[Number(k.split('#')[1])]; jobs.push({ key: k, qty: Math.max(1, Number(line?.amount ?? 1) || 1) }); } }
        else jobs.push({ key, qty: amountLocked(e.type, 'buy') ? 1 : Math.max(1, Math.floor(amount) || 1) });
      }
      if (!jobs.length) return;
      // v0.91.6 (RULES.SHOP_V916.through): on their own, helped by a contact, or a fixer's find (closing it finds nothing).
      const through = await askFindThrough(actor, { count: Math.min(20, jobs.length) });
      if (through === false) return;
      // v0.91.0 review: only the rows that got a card are unticked (a refused one, waiting to retry, stays ticked).
      const done = new Set<string>();
      for (const j of jobs.slice(0, 20)) {
        const r = await actor.findFromShop(j.key, { quantity: j.qty, through });
        if (r) done.add(j.key.startsWith('kit:') ? j.key.split('#')[0]! : j.key);
      }
      if (jobs.length > 20) ui.notifications?.warn?.(tx('SR2E.Notify.Shop.tooManyAtOnce', { n: 20 }));
      if (done.size) { for (const k of done) this.ticked.delete(k); await this.render(); }
    } finally {
      this.#busy = false;
      const r: HTMLElement | null = (this as any).element ?? null;
      if (r) this.#total(r);
    }
  }

  /** v0.91.8 (RULES.FORMULA_V918): buy a spell's formula (the Force and tradition asked first). */
  static async #onBuyFormula(this: SR2AddWindow, _e: Event, t: HTMLElement) {
    const key = t.dataset['key'] ?? '';
    const e = this.#entries.find((x) => x.key === key);
    const actor = this.actor;
    if (!e || e.type !== 'spell' || !actor || this.#busy) return;
    this.#busy = true;
    try { await buyFormula(actor, key, { name: e.name, category: String(e.system?.category ?? ''), force: this.ticked.get(key) ?? Number(e.system?.learnedForce ?? 1) }); }
    finally { this.#busy = false; }
  }

  /** v0.91.3: the Catalogue at this tab (a row's link: at that row's page). */
  static #onCodexOpen(this: SR2AddWindow, _e: Event, t: HTMLElement) {
    SR2Codex.open({ type: this.type, key: t.dataset['key'] ?? '' });
  }

  /** v0.91.1: the new-entry form for this tab's kind, for this actor. */
  static #onNewEntry(this: SR2AddWindow) {
    SR2NewEntry.open({ actorUuid: this.actorUuid, kind: entryKindFor(this.type) });
  }

  /** v0.91.0: the GM's "in the shop" tick on a world template or world item row. */
  static async #onShopMark(this: SR2AddWindow, _e: Event, t: HTMLElement) {
    const key = t.dataset['key'] ?? '';
    if (!key || !game.user?.isGM) return;
    const on = await toggleShopMark(key);
    if (on === null) return;
    this.#cache.delete(this.type);
    await this.render();
  }

  static async #onAdd(this: SR2AddWindow) {
    const actor = this.actor;
    if (!actor || this.#busy || !this.ticked.size) return;
    const first = this.#plan();
    // v0.92.1 (RULES.SHEET_V921.wizard 'advise'): in creation, gear over the budget is added anyway (the cash follows the
    // Resources priority, and the build check shows the overspend); only a shortfall of nuyen is let through.
    let payment = this.payment;
    if (first.problems.length && this.payment === 'buy' && RULES.SHEET_V921.wizard === 'advise' && inCreation(actor)) {
      const rest = basketPlan(this.#basket(), { payment: 'buy', actorType: actor.type ?? 'npc', nuyen: Number.MAX_SAFE_INTEGER, karma: Number(actor.system?.karma?.good ?? 0) });
      if (!rest.problems.length) { ui.notifications?.info?.(tx('SR2E.Notify.Adding.overBudgetInCreation')); payment = 'free'; first.problems.length = 0; }
    }
    if (first.problems.length) { for (const p of first.problems) ui.notifications?.warn?.(escHtml(p)); return; }
    if (this.payment === 'find') return this.#find();
    this.#busy = true;
    const root: HTMLElement | null = (this as any).element ?? null;
    if (root) this.#total(root);
    try {
      const lines: Array<BasketLine & { key: string; data: any }> = [];
      for (const l of this.#basket()) {
        const e = this.#entries.find((x) => x.key === l.key);
        const data = (l as any).kitData ? foundry.utils.deepClone((l as any).kitData) : e ? await entryData(e) : null;
        if (!data) { ui.notifications?.warn?.(tx('SR2E.Notify.Adding.couldnTBeReadDeletedOr', { lName: escHtml(l.name) })); continue; }
        lines.push({ ...l, data });
      }
      if (!lines.length) return;
      const ready = this.ready && (this.type === 'kit' || Boolean(readyNote(this.type)));
      // v0.64.0: with the approval queue on, a player's add waits for the GM (the item data travels with it).
      if (approvalNeeded(actor)) {
        const named = lines.map((l) => `${l.name}${l.amount > 1 ? ` ×${l.amount}` : ''}`).join(', ');
        const label = this.payment === 'buy' ? tx('SR2E.App.Adding.buy', { named }) : this.payment === 'karma' ? tx('SR2E.App.Adding.learn', { named }) : tx('SR2E.App.Adding.addFree', { named });
        if (await fileRequest(actor, { kind: 'add', label, karma: first.karma, nuyen: first.nuyen,
          // v0.91.4: a vehicle line keeps its shop key (what is bought is read again from it when the GM approves).
          data: { payment: this.payment, ready, lines: lines.map(({ key: k, ...l }) => (l.type === 'vehicle' ? { ...l, key: k } : l)) } })) { this.ticked.clear(); await this.render(); }
        return;
      }
      const made = await addLines(actor, lines.map(({ kitData: _k, ...l }: any) => l), payment as AddPayment, ready);
      // A kit's lines are keyed "kit:<id>#<n>": any made unticks the kit.
      for (const k of made) this.ticked.delete(String(k).split('#')[0]!);
      await this.render();
    } finally {
      this.#busy = false;
      const r: HTMLElement | null = (this as any).element ?? null;
      if (r) this.#total(r);
    }
  }
}

/**
 * v0.64.0: add read lines to an actor: learn spells with Karma (each through the actor's own path), or make
 * the items and charge only for what was made (taking them back if the charge fails). Returns the lines'
 * keys (or names) that went through. The Add window and an approved request both use it.
 */
export async function addLines(actor: any, lines: Array<BasketLine & { key?: string; data: any }>, payment: AddPayment, ready: boolean, shop?: { price: number; hours: number }): Promise<string[]> {
  const done: string[] = [];
  // v0.91.0: a shop purchase (one line, from a find card): the price agreed on the card (checked by buyFromShop) and
  // the time the find took; the items arrive unready, as bought things do. Requests never pass this.
  if (shop && (payment !== 'buy' || lines.length !== 1)) return done;
  // v0.91.4: vehicles and drones are bought or given as actors of their own (SR2Actor.shopVehicle: the GM's client makes them).
  const vehicles = lines.filter((l) => l.type === 'vehicle');
  if (vehicles.length) {
    if (payment === 'karma') return done;
    for (const l of vehicles) {
      if (typeof l.key !== 'string' || !l.key) continue;
      if (await actor.shopVehicle(payment === 'free' ? 'free' : 'buy', l.key, shop ? shop.price : undefined, shop ? shop.hours : 0)) done.push(l.key);
    }
    lines = lines.filter((l) => l.type !== 'vehicle');
    if (!lines.length) return done;
  }
  if (payment === 'karma') {
    const learned: string[] = [];
    for (const l of lines) {
      if (await actor.learnFormula(l.data.name, systemWithAmount(l.type, l.data.system ?? {}, l.amount), 'study', { origin: 'shop' })) { learned.push(l.data.name); done.push(l.key ?? l.name); }
    }
    if (learned.length) ui.notifications?.info?.(tx('SR2E.Notify.Adding.learns', { actorName: escHtml(actor.name), learned: escHtml(learned.join(', ')) }));
    return done;
  }
  // v0.65.0: bought things with an Availability time are ordered: paid now, they arrive when it has passed.
  if (payment === 'buy' && actor?.waitsFor?.('gear')) {
    const timed = lines.filter((l) => (shop ? shop.hours : itemAcquireHours(l.type, l.data?.system ?? l.system)) > 0);
    if (timed.length) {
      const priced = timed.map((l) => ({ l, nuyen: shop ? Math.max(0, Math.round(shop.price)) : basketPlan([{ ...l, system: l.data.system ?? l.system }], { payment, actorType: actor.type, nuyen: Number.MAX_SAFE_INTEGER, karma: 0 }).nuyen, hours: shop ? shop.hours : itemAcquireHours(l.type, l.data?.system ?? l.system) }));
      const total = priced.reduce((n, x) => n + x.nuyen, 0);
      // v0.89.6: stays English: the advancement log reads "Bought …" ledger lines by their words (rules/advancement.ts)
      if (total > 0 && !(await actor.adjustNuyen(-total, `Bought ${timed.map((l) => l.name).join(', ')} (on order)`))) return done;
      for (const x of priced) {
        const system = systemWithAmount(x.l.type, { ...(x.l.data.system ?? {}) }, x.l.amount);
        Object.assign(system, readyPatch(x.l.type, ready, system));
        const n = copiesOf(x.l.type, x.l.amount);
        const creates = Array.from({ length: n }, () => ({ ...x.l.data, system: foundry.utils.deepClone(system) }));
        const shown = n > 1 ? n : x.l.type === 'gear' ? Math.max(1, Number(system.quantity ?? 1)) : 1;
        await actor.startProject({ kind: 'order', area: 'gear', label: shown > 1 ? `${x.l.name} ×${shown} on order` : `${x.l.name} on order`, // v0.89.6: stays English: a refund's ledger line is matched by it (rules/bookkeeping.ts refundedName)
        hours: x.hours, paid: { nuyen: x.nuyen }, effect: { creates } });
        done.push(x.l.key ?? x.l.name);
      }
      lines = lines.filter((l) => !timed.includes(l));
      if (!lines.length) return done;
    }
  }
  const res = await createFromBasket(actor, lines, { ready });
  for (const f of res.failed) ui.notifications?.warn?.(tx('SR2E.Notify.Adding.couldnTBeAdded', { f: escHtml(f) }));
  if (!res.done.length) return done;
  // Priced from the data the items were made from (a template may have changed since the list was read).
  const listed = basketPlan(res.done.map((l: any) => ({ ...l, system: l.data.system ?? l.system })), { payment, actorType: actor?.type ?? 'npc', nuyen: Number(actor?.system?.nuyen ?? 0), karma: Number(actor?.system?.karma?.good ?? 0) });
  const plan = shop ? { ...listed, nuyen: Math.max(0, Math.round(shop.price)) } : listed;
  if (payment === 'buy' && plan.nuyen > 0) {
    let paid = false;
    try { paid = await actor.adjustNuyen(-plan.nuyen, `Bought ${res.done.map((l: any) => l.name).join(', ')}`); } catch (err) { console.warn('sr2e | add payment', err); }
    if (!paid) { await res.rollback(); return done; }
  }
  // Paid for now: a failing chat card mustn't make it look undone.
  try { await addedCard(actor, res.made, payment, plan); } catch (err) { console.warn('sr2e | add card', err); }
  ui.notifications?.info?.(tx('SR2E.Notify.Adding.addedTo', { actorName: escHtml(actor.name), resMade: escHtml(res.made.join(', ')) }));
  for (const l of res.done as any[]) done.push(l.key ?? l.name);
  return done;
}

// v0.91.0: the shop's purchases make their items through the same path.
setShopAdder(addLines);

/** v0.81.0 (SEC1-10): an approved add's item data: no ownership, ids, folders or stats from the request. */
function requestLineData(d: any): any {
  if (!d || typeof d !== 'object') return d;
  const { ownership: _o, _id: _i, _stats: _s, folder: _f, sort: _so, ...rest } = d;
  return rest;
}

registerRequestRunner('add', async (actor, data) => {
  const lines = Array.isArray(data['lines']) ? (data['lines'] as any[]).filter((l) => l && typeof l === 'object').map((l) => ({ ...l, data: requestLineData(l.data) })) : [];
  if (!lines.length) return false;
  const made = await addLines(actor, lines, String(data['payment'] ?? 'free') as AddPayment, Boolean(data['ready']));
  return made.length > 0;
}, (actor, r) => {
  // v0.81.0 (SEC1-10): what the lines cost now, worked out from the data, must be what was filed (and shown).
  const d: any = r.data ?? {};
  const out: string[] = [];
  const payment = String(d.payment ?? '');
  if (!['buy', 'karma', 'free'].includes(payment)) return [tx('SR2E.App.Adding.anUnknownPayment')];
  const lines = Array.isArray(d.lines) ? d.lines.filter((l: any) => l && typeof l === 'object') : [];
  if (!lines.length || lines.length > 100) return [tx('SR2E.App.Adding.noLinesOrTooMany')];
  if (payment === 'free') { if (r.nuyen || r.karma) out.push(tx('SR2E.App.Adding.filedWithACostButIts')); return out; }
  // v0.91.0 review (R1): a character who finds before buying can't skip the find (and the shop list) with a Buy now request.
  if (payment === 'buy' && buysByFinding({ isGM: false, actorType: String(actor?.type ?? ''), inCreation: inCreation(actor) })) out.push(tx('SR2E.App.Shop.findFirstRequest'));
  if (payment === 'buy' && !shopSettings().allowForbidden && lines.some((l: any) => String(l?.data?.system?.legality ?? l?.system?.legality ?? '') === 'forbidden')) out.push(tx('SR2E.App.Shop.forbiddenRequest'));
  // v0.91.4 review (R7): a vehicle is charged its own list price (read from its key when approved), so the check reads it
  // from there too: a world vehicle for sale now (a compendium's is read when approved); a line without a key can't be bought.
  const vehicleSystem = (l: any): any => {
    const k = parseShopKey(l?.key);
    const doc: any = k?.source === 'worldActor' ? fromUuidSync(k.id) : null;
    return doc && vehicleForSale(doc) ? (doc.system?.toObject?.() ?? doc.system) : (l.data?.system ?? l.system);
  };
  if (lines.some((l: any) => l?.type === 'vehicle' && !parseShopKey(l?.key))) out.push(tx('SR2E.App.Adding.vehicleNoKey'));
  const plan = basketPlan(lines.map((l: any) => ({ ...l, system: l?.type === 'vehicle' ? vehicleSystem(l) : l.data?.system ?? l.system })), { payment: payment as AddPayment, actorType: actor?.type ?? 'character', nuyen: Number.MAX_SAFE_INTEGER, karma: Number.MAX_SAFE_INTEGER });
  if (payment === 'buy' && plan.nuyen !== Number(r.nuyen)) out.push(tx('SR2E.App.Adding.itCostsNowWasFiled', { now: plan.nuyen.toLocaleString(), filed: Number(r.nuyen).toLocaleString() }));
  if (payment === 'karma' && plan.karma !== Number(r.karma)) out.push(tx('SR2E.App.Adding.itCostsKarmaNowWas', { now: plan.karma, filed: Number(r.karma) }));
  return out;
});

/** The chat line for an add: public when bought or learned; a free add by a player is whispered to the GMs. */
async function addedCard(actor: any, made: string[], payment: AddPayment, plan: { nuyen: number; karma: number }): Promise<void> {
  if (!made.length) return;
  const list = made.map(esc).join(', ');
  if (payment === 'buy') await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: `<p><strong>${esc(actor.name)}</strong> ${tx('SR2E.Card.Adding.buysFor', { list, planNuyen: plan.nuyen.toLocaleString() })}</p>` });
  else if (payment === 'karma') await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: `<p><strong>${esc(actor.name)}</strong> ${tx('SR2E.Card.Adding.learnsForGoodKarma', { list, planKarma: plan.karma })}</p>` });
  else if (!game.user?.isGM) await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), whisper: ChatMessage.getWhisperRecipients?.('GM')?.map((u: any) => u.id) ?? [], content: `<p><strong>${esc(game.user?.name)}</strong> ${tx('SR2E.Card.Adding.addsToFree', { actorName: esc(actor.name), list })}</p>` });
}

/** A named specialization's rating: as given when above the skill, else the skill + 1. */
function specRatingOf(rating: number, spec: string, given: number): number {
  if (!String(spec ?? '').trim()) return 0;
  return given > rating ? given : rating + 1;
}

/**
 * v0.71.0 (R3): the picked skill's ratings. In creation with the trade on (RULES.FIXES_V71.specialization),
 * the rating typed is the one paid with skill points and a named specialization lowers the skill
 * (`specializationTrade`: paid 5 → skill 4, specialization 6). Otherwise the old way (`specRatingOf`).
 */
function pickedRatings(trade: boolean, rating: number, spec: string, given: number): { rating: number; specRating: number; note: string } {
  if (!trade || !String(spec ?? '').trim()) return { rating, specRating: specRatingOf(rating, spec, given), note: '' };
  return specializationTrade(rating, given, RULES.FIXES_V71.specialization.ratio);
}

/** The natural rating of a skill's linked attribute (Reaction from the derived value). */
function attributeRating(actor: any, key: string): number {
  // v0.73.0 (O33): the same rating Spend Karma uses (RULES.CHARACTERS_V73.skillCost; off: augmented Reaction, the old picker).
  return skillBandAttribute(key, actor.system?.attributes ?? {}, { derivedReaction: Number(actor.system?.derived?.reaction ?? 1), caller: 'picker' } as any);
}

/** The skill picker: a new skill, free or learned with Good Karma. Returns the new skill or null. */
const pickerOpen = new Set<string>();

export async function openSkillPicker(actor: any, kind: SkillKind = 'active'): Promise<any | null> {
  if (!actor?.isOwner) { ui.notifications?.warn?.(tx('SR2E.Notify.Adding.onlyTheOwnerCanAddSkills')); return null; }
  if (pickerOpen.has(actor.uuid)) { ui.notifications?.info?.(tx('SR2E.Notify.Adding.theSkillPickerForIsAlready', { actorName: escHtml(actor.name) })); return null; }
  pickerOpen.add(actor.uuid);
  try { return await skillPicker(actor, kind); } finally { pickerOpen.delete(actor.uuid); }
}

async function skillPicker(actor: any, kind: SkillKind): Promise<any | null> {
  const listId = `sr2e-skill-names-${foundry.utils.randomID?.() ?? Date.now()}`;
  // v0.64.0: in the creation wizard skills come from the skill points (no Karma).
  const isChar = actor.type === 'character' && !inCreation(actor);
  // v0.71.0 (R3): in creation a specialization is traded from the skill.
  const trade = actor.type === 'character' && inCreation(actor) && Boolean(RULES.FIXES_V71.specialization?.tradeAtCreation);
  const picked = (f: any) => pickedRatings(trade, Math.max(0, Math.floor(Number(f.rating.value) || 0)), String(f.spec.value ?? ''), Math.max(0, Math.floor(Number(f.specRating.value) || 0)));
  const timed = RULES.CHARACTERS_V58.training.mode === 'timed';
  const kinds = (Object.keys(SKILL_KIND_LABELS) as SkillKind[]);
  const attrs = ['body', 'quickness', 'strength', 'charisma', 'intelligence', 'willpower', 'reaction'];
  // v0.73.0 (O37): one name per skill (the vehicle tests' names; RULES.CHARACTERS_V73.skillNames).
  const list = (k: SkillKind) => canonicalSkillNames(COMMON_SKILLS[k]).map((n) => `<option value="${esc(n)}"></option>`).join('');
  const have = new Set([...actor.items].filter((i: any) => i.type === 'skill').map((i: any) => i.name.toLowerCase()));
  const cost = (f: any) => {
    const k = f.kind.value as SkillKind;
    return newSkillKarma({ rating: Number(f.rating.value) || 0, attribute: attributeRating(actor, k === 'active' ? f.attribute.value : 'intelligence'), kind: k,
      specialization: Boolean(String(f.spec.value).trim()), specializationRating: specRatingOf(Number(f.rating.value) || 0, String(f.spec.value), Number(f.specRating.value) || 0) });
  };
  const result = await DialogV2.wait({
    window: { title: tx('SR2E.Dialog.Adding.addASkill', { actorName: actor.name }), icon: 'fa-solid fa-graduation-cap' },
    position: { width: 460 },
    content: `<div class="sr2e-skill-picker">
      <div class="form-group"><label>${tx('SR2E.Dialog.Adding.kind')}</label><select name="kind">${kinds.map((k) => `<option value="${k}" ${k === kind ? 'selected' : ''}>${esc(SKILL_KIND_LABELS[k])}</option>`).join('')}</select></div>
      <div class="form-group"><label>${tx('SR2E.Dialog.Adding.name')}</label><input name="name" type="text" list="${esc(listId)}" autofocus placeholder="${tx('SR2E.Dialog.Adding.typeOrPickASkill')}"><datalist id="${esc(listId)}">${list(kind)}</datalist></div>
      <div class="form-group"><label>${tx('SR2E.Dialog.Adding.linkedAttribute')}</label><select name="attribute">${attrs.map((a) => `<option value="${esc(a)}">${esc(a.charAt(0).toUpperCase() + a.slice(1))}</option>`).join('')}</select></div>
      <div class="form-group"><label>${tx('SR2E.Dialog.Adding.rating')}</label><input name="rating" type="number" min="0" max="12" value="1"${trade ? ` title="${tx('SR2E.Dialog.Adding.theRatingPaidWithSkillPoints')}"` : ''}></div>
      <div class="form-group"><label>${tx('SR2E.Dialog.Adding.specialization')}</label><input name="spec" type="text" placeholder="${tx('SR2E.Dialog.Adding.optionalEGPistols')}"></div>
      <div class="form-group"><label>${tx('SR2E.Dialog.Adding.specializationRating')}</label><input name="specRating" type="number" min="0" max="14" value="0" title="${tx('SR2E.Dialog.Adding.n0TheRating1WhenA')}"></div>
      <div class="form-group"><label>${tx('SR2E.Dialog.Adding.pay')}</label><select name="pay"><option value="free">${esc(PAYMENT_LABELS.free)}</option>${isChar ? `<option value="karma">${esc(PAYMENT_LABELS.karma)}</option>` : ''}</select></div>
      <p class="hint" data-skill-cost></p>
    </div>`,
    buttons: [
      { action: 'add', label: tx('SR2E.Dialog.Adding.addSkill'), icon: 'fa-solid fa-plus', default: true, callback: (_e: Event, b: any) => {
        const f: any = b.form.elements;
        const pr = picked(f);
        const spec = pr.specRating > 0 ? String(f.spec.value ?? '').trim() : '';
        return { kind: f.kind.value as SkillKind, name: String(f.name.value ?? '').trim(), attribute: String(f.attribute.value), rating: pr.rating,
          spec, specRating: pr.specRating, pay: String(f.pay.value), karma: cost(f) };
      } },
      { action: 'cancel', label: tx('SR2E.Dialog.Adding.cancel') },
    ],
    render: (_e: Event, dialog: any) => {
      const form: HTMLFormElement | null = dialog.element?.querySelector?.('form') ?? null;
      if (!form) return;
      const f: any = form.elements;
      let attrTouched = false;
      const upd = () => {
        const k = f.kind.value as SkillKind;
        if (!attrTouched) f.attribute.value = skillAttributeFor(String(f.name.value ?? ''), k);
        f.attribute.disabled = k === 'knowledge' || k === 'language';
        const out = form.querySelector('[data-skill-cost]');
        const name = String(f.name.value ?? '').trim();
        const dupe = name && have.has(name.toLowerCase()) ? tx('SR2E.Dialog.Adding.isAlreadyOnTheSheet', { name }) : '';
        const karmaText = timed ? tx('SR2E.Dialog.Adding.trainingTimeIsOnTheSkill', { newSkillKarma: newSkillKarma({ rating: 1, attribute: attributeRating(actor, k === 'active' ? f.attribute.value : 'intelligence'), kind: k }), karmaGood: actor.system.karma?.good ?? 0, part: String(f.spec?.value ?? '').trim() ? ` ${timedNewSkillSystem({ kind: k, attribute: f.attribute.value, spec: String(f.spec.value) }).note}` : '' })
          : tx('SR2E.Dialog.Adding.costsGoodKarmaToSpend', { cost: cost(f), karmaGood: actor.system.karma?.good ?? 0 });
        const tradeNote = trade && String(f.spec.value ?? '').trim() ? ` ${picked(f).note}` : '';
        if (out) out.textContent = `${f.pay.value === 'karma' ? karmaText : tx('SR2E.Dialog.Adding.addedFree')}${tradeNote}${dupe}`;
      };
      f.kind.addEventListener('change', () => { const dl = form.querySelector(`#${CSS.escape(listId)}`); if (dl) dl.innerHTML = list(f.kind.value as SkillKind); upd(); });
      f.attribute.addEventListener('change', () => { attrTouched = true; upd(); });
      for (const n of ['name', 'rating', 'spec', 'specRating', 'pay']) f[n]?.addEventListener('input', upd);
      f.pay.addEventListener('change', upd);
      upd();
    },
    rejectClose: false,
  } as any);
  if (!result || result === 'cancel' || typeof result !== 'object') return null;
  const r: any = result;
  if (!r.name) { ui.notifications?.warn?.(tx('SR2E.Notify.Adding.giveTheSkillAName')); return null; }
  // v0.73.0 (O37): "Rotorcraft" is saved as "Rotor Aircraft" (and an old alias counts as the same skill).
  r.name = canonicalSkillName(r.name);
  if (have.has(r.name.toLowerCase()) || [...actor.items].some((i: any) => i.type === 'skill' && sameSkillName(i.name, r.name))) { ui.notifications?.warn?.(tx('SR2E.Notify.Adding.alreadyHasRaiseItWithIts', { actorName: escHtml(actor.name), name: escHtml(r.name) })); return null; }
  // With training time on, only rating 1 is paid now.
  if (r.pay === 'karma' && timed) r.karma = newSkillKarma({ rating: 1, attribute: attributeRating(actor, r.kind === 'active' ? r.attribute : 'intelligence'), kind: r.kind });
  if (r.pay === 'karma' && Number(actor.system.karma?.good ?? 0) < r.karma) { ui.notifications?.warn?.(tx('SR2E.Notify.Adding.hasGoodKarmaNeeds', { actorName: escHtml(actor.name), karmaGood: escHtml(actor.system.karma?.good ?? 0), karma: escHtml(r.karma) })); return null; }
  if ([...actor.items].some((i: any) => i.type === 'skill' && i.name.toLowerCase() === r.name.toLowerCase())) { ui.notifications?.warn?.(tx('SR2E.Notify.Adding.alreadyHas', { actorName: escHtml(actor.name), name: escHtml(r.name) })); return null; }
  // v0.64.0: with the approval queue on, a player's new skill waits for the GM.
  if (approvalNeeded(actor)) {
    await fileRequest(actor, { kind: 'skill', label: ((named: string) => (r.pay === 'karma' ? tx('SR2E.App.Adding.learn', { named }) : tx('SR2E.App.Adding.addFree', { named })))(`${r.name} ${timed && r.pay === 'karma' ? 0 : r.rating}${r.spec ? ` (${r.spec})` : ''}`), karma: r.pay === 'karma' ? r.karma : 0, data: { ...r } });
    return null;
  }
  return makeSkill(actor, r);
}

/** v0.64.0: make a picked skill and pay for it (the picker and an approved request). */
export async function makeSkill(actor: any, r: any): Promise<any | null> {
  if ([...actor.items].some((i: any) => i.type === 'skill' && i.name.toLowerCase() === String(r.name).toLowerCase())) { ui.notifications?.warn?.(tx('SR2E.Notify.Adding.alreadyHas', { actorName: escHtml(actor.name), name: escHtml(r.name) })); return null; }
  const attribute = r.kind === 'knowledge' || r.kind === 'language' ? 'intelligence' : r.attribute;
  // v0.64.0: with training time on (house rule), a skill learned with Karma starts at 0 and trains to 1.
  if (r.pay === 'karma' && RULES.CHARACTERS_V58.training.mode === 'timed') {
    // v0.73.0 (O32): the specialization typed in the picker is kept by name (RULES.CHARACTERS_V73.training.keepSpecialization).
    const ts = timedNewSkillSystem({ kind: r.kind, attribute, spec: r.spec } as any);
    const [made] = (await actor.createEmbeddedDocuments('Item', [{ name: r.name, type: 'skill', system: ts.system }])) ?? [];
    if (!made) return null;
    if (!(await actor.improve({ skillId: made.id }))) { await made.delete?.(); return null; }
    return made;
  }
  // Make the skill, then pay (and take the skill back if the payment fails).
  const [made] = (await actor.createEmbeddedDocuments('Item', [{ name: r.name, type: 'skill', system: { kind: r.kind, attribute, rating: r.rating, specialization: r.spec, specializationRating: r.spec ? r.specRating : 0 } }])) ?? [];
  if (!made) return null;
  if (r.pay === 'karma' && !(await actor.spendKarma(r.karma, tx('SR2E.App.Adding.learned', { name: r.name, rating: r.rating })))) { await made.delete?.(); return null; }
  if (r.pay === 'karma') await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: `<p><strong>${esc(actor.name)}</strong> ${tx('SR2E.Card.Adding.learnsForGoodKarma2', { name: esc(r.name), rating: esc(r.rating), part: r.spec ? ` (${esc(r.spec)} ${esc(r.specRating)})` : '', karma: esc(r.karma) })}</p>` });
  else await addedCard(actor, [`${r.name} ${r.rating}`], 'free', { nuyen: 0, karma: 0 });
  return made ?? null;
}

registerRequestRunner('skill', async (actor, data) => Boolean(await makeSkill(actor, data)), (_actor, r) => {
  // v0.81.0 (SEC1-10): the Karma it spends is the Karma filed (and shown); a free add costs nothing.
  const d: any = r.data ?? {};
  if (d.pay === 'karma') return Number(d.karma) === Number(r.karma) && Number(d.karma) >= 0 ? [] : [tx('SR2E.App.Adding.itSpendsKarmaWasFiled', { spends: Number(d.karma), filed: Number(r.karma) })];
  return r.karma || r.nuyen ? [tx('SR2E.App.Adding.filedWithACostButIts')] : [];
});

const dupBusy = new Set<string>();

/** Handlers the actor sheets register (`actions: { ...SHEET_TOOL_ACTIONS }`). `this` is the sheet. */
export const SHEET_TOOL_ACTIONS: Record<string, (this: any, e: Event, t: HTMLElement) => any> = {
  addItem: function (this: any, _e: Event, t: HTMLElement) { SR2AddWindow.show(this.document, t.dataset['type']); },
  addSkill: function (this: any, _e: Event, t: HTMLElement) { void openSkillPicker(this.document, (t.dataset['kind'] as SkillKind) || 'active'); },
  duplicateItem: async function (this: any, _e: Event, t: HTMLElement) {
    const actor: any = this.document;
    const item: any = actor.items.get(t.dataset['itemId']);
    if (!item || !actor.isOwner) return;
    if (dupBusy.has(actor.uuid)) return;
    dupBusy.add(actor.uuid);
    try {
      const data = item.toObject();
      delete data._id;
      data.name = copyName(item.name, [...actor.items].map((i: any) => i.name));
      // A copy arrives as a drop does (cyberware not installed, a focus not bonded...); a GM holding Shift copies it as it is.
      if (!(game.user?.isGM && (_e as MouseEvent)?.shiftKey)) Object.assign(data.system, arrivalReset(item.type, data.system));
      // v0.64.0: with the approval queue on, a copy is a free add the GM approves.
      if (approvalNeeded(actor)) {
        await fileRequest(actor, { kind: 'add', label: tx('SR2E.App.Adding.addFree', { named: data.name }), data: { payment: 'free', ready: false, lines: [{ type: item.type, name: data.name, system: data.system, amount: 1, data }] } });
        return;
      }
      await actor.createEmbeddedDocuments('Item', [data]);
    } finally { dupBusy.delete(actor.uuid); }
  },
  pinItem: async function (this: any, _e: Event, t: HTMLElement) {
    const actor: any = this.document;
    const id = t.dataset['itemId'];
    if (!id || !actor.isOwner) return;
    await actor.setFlag(SYSTEM.id, 'pins', togglePin(actor.getFlag(SYSTEM.id, 'pins'), id));
  },
  sheetMode: function (this: any) {
    const actor: any = this.document;
    const m = remember<Record<string, string>>('sheetMode', {});
    m[actor.uuid] = sheetMode(actor) === 'play' ? 'edit' : 'play';
    const keys = Object.keys(m);
    if (keys.length > 200) for (const k of keys.slice(0, keys.length - 200)) delete m[k];
    store('sheetMode', m);
    applyMode(this, (this as any).element);
  },
  jumpTo: async function (this: any, _e: Event, t: HTMLElement) {
    const tab = t.dataset['tab'] ?? '';
    const find = (t.dataset['find'] ?? '').toLowerCase();
    const root: HTMLElement | null = this.element ?? null;
    if (!root) return;
    const hasTab = tab && root.querySelector(`.sr2e-tab[data-tab="${tab}"]`);
    if (hasTab) {
      // v0.68.0: the Compact layout folds tabs into sections: open this one.
      openCompactTab(root, tab);
      this.tabGroups = { ...(this.tabGroups ?? {}), primary: tab };
      try { this.changeTab?.(tab, 'primary', { force: true }); } catch { /* older Foundry */ }
    }
    const scope: HTMLElement = (hasTab ? root.querySelector<HTMLElement>(`.sr2e-tab[data-tab="${tab}"]`) : null) ?? root;
    const heads = Array.from(scope.querySelectorAll<HTMLElement>('h2, h3'));
    const words = [find, find.split(' ').pop() ?? '', ...(['armor', 'gear', 'cyberware'].includes(find) ? ['other gear'] : [])].filter(Boolean);
    const h: HTMLElement | null = words.map((w) => heads.find((x) => headingName(x, (y) => (y.textContent ?? '').trim()).toLowerCase().includes(w))).find(Boolean)
      ?? (find === 'attributes' ? scope.querySelector<HTMLElement>('.sr2e-statgrid') : null);
    if (!h) return;
    // Unfold it and any folded section around it.
    for (const f of Array.from(root.querySelectorAll<HTMLElement>('.sr2e-folded'))) if (f === h || foldedPart(f).some((el) => el === h || el.contains(h))) toggleFold(this, f);
    h.scrollIntoView({ block: 'start', behavior: 'smooth' });
    h.classList.add('sr2e-flash');
    setTimeout(() => h.classList.remove('sr2e-flash'), 1600);
  },
};

