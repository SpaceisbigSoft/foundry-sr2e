/**
 * v0.91.3: the Catalogue (the owner, 25 Oct 2026: "an easily browseable compendium of all the things the players can
 * acquire using the system's current database (either the one imported or created by users in the world) ... the items
 * at the shop can open a link to the compendium page for it"). The owner's choices: its own window; players see what
 * the shop shows them; built before vehicles.
 *
 *  - The tabs are what a character can get (rules/codex.ts CODEX_TYPES); each lists the entries the shop reads
 *    (applications/shop.ts `entriesFor`: the GM's catalogue templates, the built-in ones, world items, compendium
 *    items), filtered by the shop list for players (`entryShown`), with the shop's categories and search.
 *  - A page per entry: its picture, kind and category, price line (price, Street Index, Availability, legality), stats
 *    (rules/codex.ts `codexStats`) and description. The page reads the entry through `resolveCatalogueKey` (the user's
 *    own shop rules: a key a player's shop doesn't show is not read), and its description is cleaned and enriched as
 *    an item's chat card is (applications/richtext.ts).
 *  - Buy… opens the shop on that entry (Learn… for a spell or an adept power: the Add window); the GM can open the item
 *    and put a catalogue entry in the shop. Each shop row has a link to its page (applications/adding.ts).
 * Opened from the tools window and toolbar, the shop, and `game.sr2e.api.openCatalogue({ type, key })`.
 */
import { SYSTEM } from '../config/system.ts';
import {
  CODEX_TYPES, RULES, codexStats, codexTarget, typeLabel, entrySummary, entryPrice, matchesSearch, shopGroupOf, shopGroupRank,
  shopGroupsFor, passesGroups, SHOP_GROUP_KEYS, shopRowInfo, soldInShop, parseShopKey, codexKind, ENTRY_KIND_KEYS,
} from '../rules/index.ts';
import { entriesFor, entryShown, resolveCatalogueKey, toggleShopMark, shopTab, shopSettings, vehicleListChange, type Entry } from './shop.ts';
import { cleanRichHtml, safeImgSrc } from './richtext.ts';
import { openShop } from './adding.ts';
import { t as tx, tKey } from '../helpers/i18n.ts';
import { shopLegalTitle } from '../rules/legalbuy.ts';

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

/** A Font Awesome icon per tab (an entry with no picture shows it). */
const TYPE_ICONS: Record<string, string> = {
  weapon: 'fa-solid fa-gun', armor: 'fa-solid fa-shirt', gear: 'fa-solid fa-toolbox', cyberware: 'fa-solid fa-microchip',
  focus: 'fa-solid fa-gem', program: 'fa-solid fa-code', cyberdeck: 'fa-solid fa-laptop-code', spell: 'fa-solid fa-hat-wizard',
  adeptpower: 'fa-solid fa-hand-fist', vehicle: 'fa-solid fa-car',
};

/** v0.91.3 review (R1): an HTML text without its `<section class="secret">` blocks (the GM's own notes). */
export function withoutSecrets(html: string): string {
  if (!html || !/secret/i.test(html)) return html;
  // Parsed inert (DOMParser runs no scripts and loads nothing), the already cleaned text.
  const doc = new DOMParser().parseFromString(html, 'text/html');
  for (const el of Array.from(doc.body.querySelectorAll('section.secret, .secret'))) el.remove();
  return doc.body.innerHTML;
}

/** The line under the page saying what the shop list shows (the GM: what players see; a player: when it's limited). */
function codexNote(isGM: boolean): string {
  const s = shopSettings();
  if (isGM) {
    const what = s.mode === 'catalogue' ? tx('SR2E.App.Shop.gmSees.catalogue') : s.mode === 'marked' ? tx('SR2E.App.Shop.gmSees.marked') : tx('SR2E.App.Shop.gmSees.all');
    return s.allowForbidden ? what : `${what} ${tx('SR2E.App.Shop.gmSeesForbidden')}`;
  }
  return s.mode === 'catalogue' ? tx('SR2E.App.Shop.playerSees.catalogue') : s.mode === 'marked' ? tx('SR2E.App.Shop.playerSees.marked') : '';
}

/** A page, read once per entry while the window is open. */
interface Page { key: string; type: string; name: string; img: string; icon: string; kind: string; category: string; source: string;
  summary: string; hasBuying: boolean; price: string; priceTitle: string; avail: string; streetIndex: string; legal: string; legalNote: string; forbidden: boolean;
  stats: Array<{ label: string; value: string }>; description: string; buyable: boolean; learnable: boolean;
  uuid: string; markable: boolean; marked: boolean }

export class SR2Codex extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS: Record<string, any> = {
    id: 'sr2e-codex',
    classes: ['sr2e', 'sr2e-codex'],
    window: { title: 'SR2E.Window.Codex.title', resizable: true, icon: 'fa-solid fa-book-atlas' },
    position: { width: 900, height: 660 },
    actions: {
      codexTab: SR2Codex.#onTab,
      codexPick: SR2Codex.#onPick,
      codexBuy: SR2Codex.#onBuy,
      codexOpenItem: SR2Codex.#onOpenItem,
      codexMark: SR2Codex.#onMark,
    },
  };
  static PARTS: Record<string, any> = { main: { template: `${SYSTEM.PATH.TEMPLATES}/codex.hbs`, scrollable: ['.sr2e-codex-list', '.sr2e-codex-page'] } };

  static #hooked = false;
  /** v0.91.3 review (R2): the one window, kept from its creation (not found among rendered windows: its first render waits on the compendium indexes). */
  static #instance: SR2Codex | null = null;

  /** Open the Catalogue (one window), on a tab and an entry's page when asked. */
  static open(o: { type?: unknown; key?: unknown } | null = {}): SR2Codex {
    o = o ?? {};
    if (!SR2Codex.#hooked) {
      SR2Codex.#hooked = true;
      // A world item made, changed or removed: the open window reads its lists again.
      const again = (i: any) => { if (i?.parent) return; const w = SR2Codex.#current(); if (w) { w.clearCache(); void w.render(); } };
      Hooks.on('createItem', again); Hooks.on('updateItem', again); Hooks.on('deleteItem', again);
      // v0.91.4: vehicles and drones are actors.
      // v0.91.4 review (R5): only changes the pages show (not a chase's speed or damage).
      const actorAgain = (a: any, ch?: any) => { if (a?.type === 'vehicle' && !a.parent && (!ch || typeof ch !== 'object' || vehicleListChange(ch))) { const w = SR2Codex.#current(); if (w) { w.clearCache(); void w.render(); } } };
      Hooks.on('createActor', (a: any) => actorAgain(a)); Hooks.on('updateActor', (a: any, ch: any) => actorAgain(a, ch)); Hooks.on('deleteActor', (a: any) => actorAgain(a));
      const folderAgain = (f: any) => { if (f?.type === 'Actor') { const w = SR2Codex.#current(); if (w) { w.clearCache(); void w.render(); } } };
      Hooks.on('updateFolder', folderAgain); Hooks.on('deleteFolder', folderAgain);
      // v0.91.3 review (R3): the GM showing or hiding a compendium: the Catalogue and the shops read their lists again.
      Hooks.on('updateSetting', (setting: any) => {
        if (setting?.key !== 'core.compendiumConfiguration') return;
        for (const app of ((foundry as any).applications?.instances?.values?.() ?? [])) {
          const c = (app as any)?.options?.classes;
          if (c?.includes?.('sr2e-codex') || c?.includes?.('sr2e-add')) { (app as any).clearCache?.(); void (app as any).render?.(); }
        }
      });
    }
    const t = codexTarget(o);
    const w = SR2Codex.#current() ?? new SR2Codex();
    if (o.type !== undefined || o.key !== undefined) {
      if (t.type !== w.type) { w.type = t.type; w.query = ''; w.groups.clear(); }
      if (t.key) w.selected = t.key;
    }
    void w.render({ force: true });
    return w;
  }

  static #current(): SR2Codex | null { return SR2Codex.#instance; }

  constructor(options: any = {}) {
    super(options);
    SR2Codex.#instance = this;
  }

  async close(options?: any): Promise<any> {
    if (SR2Codex.#instance === this) SR2Codex.#instance = null;
    return super.close(options);
  }

  type = 'weapon';
  query = '';
  groups = new Set<string>();
  /** The entry whose page is shown. */
  selected = '';
  #cache = new Map<string, Entry[]>();
  #pages = new Map<string, Page | null>();
  /** v0.91.3 review (R4): bumped by every clear, so a page read before it isn't cached after it. */
  #gen = 0;
  /** The page scrolls back to its top when another entry is picked. */
  #pageToTop = false;

  clearCache(): void { this.#cache.clear(); this.#pages.clear(); this.#gen++; }

  async _prepareContext(_options: any): Promise<any> {
    if (!(CODEX_TYPES as readonly string[]).includes(this.type)) this.type = 'weapon';
    if (!this.#cache.has(this.type)) this.#cache.set(this.type, await entriesFor(this.type));
    // Players see what their shop shows (the GM's shop list); the GM sees everything.
    const list = (this.#cache.get(this.type) ?? []).filter((e) => entryShown(e));
    const groupOf = new Map<Entry, string>(list.map((e) => [e, shopGroupOf(e.type, e.name, e.system)]));
    const lang = String((game as any).i18n?.lang ?? 'en');
    const sorted = [...list].sort((a, b) => shopGroupRank(a.type, groupOf.get(a)!) - shopGroupRank(b.type, groupOf.get(b)!) || a.name.localeCompare(b.name, lang));
    if (this.selected && !list.some((e) => e.key === this.selected)) this.selected = '';
    const rows = sorted.map((e) => {
      const summary = entrySummary(e.type, e.system);
      const price = entryPrice(e.type, e.system, 1);
      const search = `${e.name} ${summary} ${e.source}`;
      return { key: e.key, name: e.name, summary, price: price ? `¥${price.toLocaleString()}` : '', source: e.source, group: groupOf.get(e) ?? '',
        search: search.toLowerCase(), selected: e.key === this.selected,
        hidden: !matchesSearch(search, this.query) || !passesGroups(groupOf.get(e) ?? '', this.groups) };
    });
    const counts = new Map<string, number>();
    for (const r of rows) if (r.group) counts.set(r.group, (counts.get(r.group) ?? 0) + 1);
    for (const g of [...this.groups]) if (!counts.has(g)) this.groups.delete(g);
    const groups = shopGroupsFor(this.type).filter((g) => counts.has(g)).map((g) => ({ id: g, label: tKey(SHOP_GROUP_KEYS[g] ?? ''), count: counts.get(g), checked: this.groups.has(g) }));
    const entry = this.selected ? list.find((e) => e.key === this.selected) ?? null : null;
    const page = entry ? await this.#page(entry, groupOf.get(entry) ?? '') : null;
    const isGM = Boolean(game.user?.isGM);
    return {
      tabs: CODEX_TYPES.map((t) => ({ type: t, label: typeLabel(t), icon: TYPE_ICONS[t] ?? 'fa-solid fa-box', active: t === this.type })),
      plural: typeLabel(this.type), query: this.query, rows, groups: groups.length > 1 ? groups : [], page,
      missing: Boolean(this.selected) && !page, isGM, count: rows.length,
      shopNote: shopTab(this.type) ? codexNote(isGM) : '',
    };
  }

  /** An entry's page: read through the user's own shop rules (`resolveCatalogueKey`), then cleaned and enriched. */
  async #page(e: Entry, group: string): Promise<Page | null> {
    if (this.#pages.has(e.key)) return this.#pages.get(e.key)!;
    const gen = this.#gen;
    const thing = await resolveCatalogueKey(e.key);
    if (!thing) { if (gen === this.#gen) this.#pages.set(e.key, null); return null; }
    const s = thing.system ?? {};
    const info = shopRowInfo(thing.type, s);
    const price = entryPrice(thing.type, s, 1);
    const TE: any = (foundry as any).applications?.ux?.TextEditor?.implementation;
    // v0.91.3 review (R1): the GM's secret sections are taken out first, so no path (enrichHTML failing too) shows them.
    // v0.91.4: a vehicle's text is its notes.
    const raw = withoutSecrets(cleanRichHtml(String((thing.type === 'vehicle' ? s.notes : s.description) ?? '')));
    let description = raw;
    // The same cleaning as an item's chat card: links and rolls kept, secrets never shown, the result cleaned again.
    // Relative links resolve against the item itself (as on its chat card), for a world or compendium item.
    const src = parseShopKey(e.key);
    let relativeTo: any;
    try { if (src?.source === 'worldItem' || src?.source === 'worldActor' || src?.source === 'pack') relativeTo = await fromUuid(src.id); } catch { relativeTo = undefined; }
    try { if (raw && TE?.enrichHTML) description = cleanRichHtml(await TE.enrichHTML(raw, { secrets: false, ...(relativeTo ? { relativeTo } : {}) })); } catch { description = raw; }
    const p = parseShopKey(e.key);
    const img = String(thing.data?.img ?? e.img ?? '').trim();
    const isGM = Boolean(game.user?.isGM);
    const page: Page = {
      key: e.key, type: thing.type, name: thing.name, img: img ? safeImgSrc(img) : '', icon: TYPE_ICONS[thing.type] ?? 'fa-solid fa-box',
      kind: tKey(ENTRY_KIND_KEYS[codexKind(thing.type, s)]), summary: entrySummary(thing.type, s), category: group ? tKey(SHOP_GROUP_KEYS[group] ?? '') : '', source: e.source,
      price: price ? `¥${price.toLocaleString()}` : '', priceTitle: price && info.streetIndex !== 1 ? tx('SR2E.App.Shop.streetIndexTitle', { si: info.streetIndex }) : '',
      avail: info.avail, streetIndex: info.streetIndex !== 1 ? String(info.streetIndex) : '', legal: info.legalityLabel, legalNote: shopLegalTitle(info.legality), forbidden: info.forbidden,
      // v0.91.4: a vehicle's category by its label (the house rules' list).
      stats: codexStats(thing.type, s).map((x) => ({ label: tKey(x.labelKey), value: x.yes ? tx('SR2E.App.Codex.yes') : thing.type === 'vehicle' && x.id === 'category' ? String(RULES.VEHICLES.categories.find((c) => c.id === x.value)?.label ?? x.value) : x.value })),
      hasBuying: Boolean(price || info.avail || info.legalityLabel),
      description, buyable: soldInShop(thing.type), learnable: !soldInShop(thing.type),
      uuid: isGM && (p?.source === 'worldItem' || p?.source === 'worldActor' || p?.source === 'pack') ? p.id : '',
      markable: isGM && shopTab(thing.type) && (p?.source === 'world' || p?.source === 'worldItem' || p?.source === 'worldActor'), marked: thing.marked,
    };
    if (gen === this.#gen) this.#pages.set(e.key, page);
    return page;
  }

  /** The search and the category boxes work without a re-render. */
  async _onRender(context: any, options: any): Promise<void> {
    await (super._onRender as any)?.(context, options);
    const root: HTMLElement | null = (this as any).element ?? null;
    if (!root) return;
    const apply = () => {
      let shown = 0;
      for (const li of Array.from(root.querySelectorAll<HTMLElement>('[data-codex-row]'))) {
        li.hidden = !matchesSearch(li.dataset['search'] ?? '', this.query) || !passesGroups(li.dataset['group'] ?? '', this.groups);
        if (!li.hidden) shown++;
      }
      const c = root.querySelector<HTMLElement>('.sr2e-codex-shown');
      if (c) c.textContent = tx('SR2E.App.Codex.shown', { shown, total: context.count ?? 0 });
    };
    if (this.#pageToTop) { this.#pageToTop = false; const pg = root.querySelector<HTMLElement>('.sr2e-codex-page'); if (pg) pg.scrollTop = 0; }
    const search = root.querySelector<HTMLInputElement>('.sr2e-codex-search');
    search?.addEventListener('input', () => { this.query = search.value; apply(); });
    for (const box of Array.from(root.querySelectorAll<HTMLInputElement>('.sr2e-add-group'))) {
      box.addEventListener('change', () => { if (box.checked) this.groups.add(box.value); else this.groups.delete(box.value); apply(); });
    }
    apply();
  }

  static #onTab(this: SR2Codex, _e: Event, t: HTMLElement) {
    const type = t.dataset['type'] ?? '';
    if (!(CODEX_TYPES as readonly string[]).includes(type) || type === this.type) return;
    this.type = type; this.query = ''; this.groups.clear(); this.selected = '';
    void this.render();
  }

  static #onPick(this: SR2Codex, _e: Event, t: HTMLElement) {
    const key = t.dataset['key'] ?? '';
    if (!key || key === this.selected) return;
    this.selected = key;
    this.#pageToTop = true;
    void this.render();
  }

  /** Buy…: the shop on this tab, searching for the entry (Learn…: the Add window, for a spell or an adept power). */
  static async #onBuy(this: SR2Codex, _e: Event, t: HTMLElement) {
    const page = this.#pages.get(this.selected);
    if (!page) return;
    const learn = t.dataset['learn'] === 'true';
    await openShop(undefined, { type: page.type, query: page.name, shop: !learn, ...(learn ? { payment: 'karma' as const } : {}) });
  }

  /** GM: the world or compendium item's own sheet. */
  static async #onOpenItem(this: SR2Codex) {
    const page = this.#pages.get(this.selected);
    if (!page?.uuid || !game.user?.isGM) return;
    const doc: any = await fromUuid(page.uuid);
    doc?.sheet?.render?.(true);
  }

  /** GM: put a catalogue template or world item in the shop, or take it out. */
  static async #onMark(this: SR2Codex) {
    const page = this.#pages.get(this.selected);
    if (!page?.markable || !game.user?.isGM) return;
    // The setting or item change refreshes the open windows (settings.ts refreshShops, the item hooks above).
    await toggleShopMark(page.key);
  }
}
