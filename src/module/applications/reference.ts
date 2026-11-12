/**
 * v0.92.1: the reference pane beside the sheet (the owner's choice, 2 Nov 2026: "a quick-search pane (the Catalogue and
 * the guide's rules notes) opened from the sheet, with entries dragged onto it"). One window per sheet, placed beside it.
 *
 *  - One search over the Catalogue's entries (what the user's shop shows them: applications/shop.ts `entryShown`), the
 *    guide's topics (a player never sees a GM topic) and the rules interpretations; the ranking is rules/reference.ts.
 *  - Clicking a result opens its Catalogue page, guide topic or interpretation.
 *  - A Catalogue entry can be dragged onto the character sheet: the drop opens the shop with it ticked (the owner's choice,
 *    12 Nov 2026), so a player still finds and buys it under the shop rules and the GM can pick Free; spells and adept
 *    powers open Learn.
 * Opened by the title bar's book button on a character or NPC sheet its owner sees, and `game.sr2e.api.reference(actor)`.
 */
import { SYSTEM } from '../config/system.ts';
import {
  CODEX_TYPES, GUIDE_TOPICS, GUIDE_CATEGORIES, entrySummary, typeLabel, soldInShop,
  referenceResults, referencePlace, referenceDragData, REFERENCE_DRAG_TYPE, type ReferenceItem, type ReferenceKind,
} from '../rules/index.ts';
import { INTERPRETATIONS, interpText } from '../rules/interpretations.ts';
import { entriesFor, entryShown } from './shop.ts';
import { SR2Codex } from './codex.ts';
import { openHelp } from './help.ts';
import { SR2Interpretations } from './interpretations.ts';
import { openShop } from './adding.ts';
import { escHtml } from '../rules/html.ts';
import { t as tx, tKey } from '../helpers/i18n.ts';

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

const KIND_KEYS: Record<ReferenceKind, string> = { entry: 'SR2E.App.Reference.kind.entry', guide: 'SR2E.App.Reference.kind.guide', interp: 'SR2E.App.Reference.kind.interp' };
const KIND_ICONS: Record<ReferenceKind, string> = { entry: 'fa-solid fa-book-atlas', guide: 'fa-solid fa-circle-question', interp: 'fa-solid fa-scale-balanced' };

export class SR2Reference extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS: Record<string, any> = {
    classes: ['sr2e', 'sr2e-reference'],
    window: { title: 'SR2E.Window.Reference.title', resizable: true, icon: 'fa-solid fa-book-open-reader' },
    position: { width: 340, height: 600 },
    actions: {
      refOpen: SR2Reference.#onOpen,
      refKind: SR2Reference.#onKind,
      refReload: SR2Reference.#onReload,
    },
  };
  static PARTS: Record<string, any> = { main: { template: `${SYSTEM.PATH.TEMPLATES}/reference.hbs`, scrollable: ['.sr2e-ref-list'] } };

  static #open = new Map<string, SR2Reference>();

  /** Open (or bring up) the pane for a sheet's actor, beside the sheet. */
  static show(actor: any, sheet?: any): SR2Reference | null {
    if (!actor?.uuid) return null;
    let w = SR2Reference.#open.get(actor.uuid);
    if (!w) { w = new SR2Reference({ actorUuid: actor.uuid } as any); SR2Reference.#open.set(actor.uuid, w); }
    const pos = sheet?.position;
    if (pos && Number.isFinite(Number(pos.left)) && Number.isFinite(Number(pos.width))) {
      const p = referencePlace({ left: Number(pos.left), top: Number(pos.top), width: Number(pos.width), height: Number(pos.height) || 600 }, { width: window.innerWidth, height: window.innerHeight });
      void w.render({ force: true, position: p } as any);
    } else void w.render({ force: true });
    return w;
  }

  actorUuid: string;
  query = '';
  kinds = new Set<ReferenceKind>(['entry', 'guide', 'interp']);
  #items: ReferenceItem[] | null = null;
  constructor(options: any = {}) { super(options); this.actorUuid = String(options.actorUuid ?? ''); }
  get actor(): any { return fromUuidSync(this.actorUuid); }
  get title(): string { return tx('SR2E.Window.Reference.titleFor', { name: this.actor?.name ?? '' }); }

  async close(options?: any): Promise<any> {
    SR2Reference.#open.delete(this.actorUuid);
    return super.close(options);
  }

  /** Everything the pane searches (read once; Reload reads it again). */
  async #all(): Promise<ReferenceItem[]> {
    if (this.#items) return this.#items;
    const gm = Boolean(game.user?.isGM);
    const out: ReferenceItem[] = [];
    for (const type of CODEX_TYPES) {
      let list: any[] = [];
      try { list = await entriesFor(type); } catch (err) { console.warn('sr2e | reference entries', type, err); }
      for (const e of list) {
        if (!entryShown(e)) continue;
        out.push({ kind: 'entry', id: e.key, type: e.type, name: e.name, detail: `${typeLabel(e.type, false)}${entrySummary(e.type, e.system) ? ` · ${entrySummary(e.type, e.system)}` : ''}` });
      }
    }
    const catOf = new Map<string, string>();
    for (const c of GUIDE_CATEGORIES) for (const id of c.topics) catOf.set(id, c.label);
    for (const t of GUIDE_TOPICS) {
      if (!gm && t.audience === 'gm') continue;
      out.push({ kind: 'guide', id: t.id, name: t.title, detail: tx('SR2E.App.Reference.guideTopic', { category: catOf.get(t.id) ?? '' }), text: `${t.headings.join(' ')} ${t.body.replace(/<[^>]+>/g, ' ')}` });
    }
    for (const i of INTERPRETATIONS) {
      const x = interpText(i.id);
      out.push({ kind: 'interp', id: i.id, name: x.title, detail: tx('SR2E.App.Reference.interpretation'), text: `${x.summary} ${x.gap} ${x.resolution}` });
    }
    this.#items = out;
    return out;
  }

  async _prepareContext(_o: any): Promise<any> {
    const all = await this.#all();
    const { results, total } = referenceResults(this.query, all, { kinds: this.kinds, limit: 60 });
    const counts = { entry: all.filter((i) => i.kind === 'entry').length, guide: all.filter((i) => i.kind === 'guide').length, interp: all.filter((i) => i.kind === 'interp').length };
    return {
      query: this.query,
      kinds: (['entry', 'guide', 'interp'] as ReferenceKind[]).map((k) => ({ id: k, label: tKey(KIND_KEYS[k]), on: this.kinds.has(k), count: counts[k] })),
      results: results.map((r) => ({ ...r, icon: KIND_ICONS[r.kind], draggable: r.kind === 'entry' })),
      shown: results.length, total,
      more: total > results.length,
      empty: !String(this.query).trim(),
    };
  }

  async _onRender(context: any, options: any): Promise<void> {
    await (super._onRender as any)?.(context, options);
    const root: HTMLElement | null = (this as any).element ?? null;
    if (!root) return;
    const search = root.querySelector<HTMLInputElement>('.sr2e-ref-search');
    if (search) {
      let timer: ReturnType<typeof setTimeout> | null = null;
      search.addEventListener('input', () => {
        this.query = search.value;
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => { void this.render().then(() => { const s = (this as any).element?.querySelector?.('.sr2e-ref-search') as HTMLInputElement | null; if (s) { s.focus(); s.setSelectionRange(s.value.length, s.value.length); } }); }, 180);
      });
    }
    for (const li of Array.from(root.querySelectorAll<HTMLElement>('[data-ref-drag]'))) {
      li.addEventListener('dragstart', (ev: DragEvent) => {
        const d = referenceDragData({ id: li.dataset['id'] ?? '', type: li.dataset['type'] ?? '', name: li.dataset['name'] ?? '' });
        ev.dataTransfer?.setData('text/plain', JSON.stringify(d));
      });
    }
  }

  static #onOpen(this: SR2Reference, _e: Event, t: HTMLElement) {
    const id = t.dataset['id'] ?? '';
    const kind = t.dataset['kind'] as ReferenceKind;
    if (!id) return;
    if (kind === 'entry') SR2Codex.open({ type: t.dataset['type'] ?? '', key: id });
    else if (kind === 'guide') openHelp(id);
    else if (kind === 'interp') SR2Interpretations.open(id);
  }

  static #onKind(this: SR2Reference, _e: Event, t: HTMLElement) {
    const k = t.dataset['kind'] as ReferenceKind;
    if (!k) return;
    if (this.kinds.has(k)) { if (this.kinds.size > 1) this.kinds.delete(k); } else this.kinds.add(k);
    void this.render();
  }

  static #onReload(this: SR2Reference) { this.#items = null; void this.render(); }
}

/**
 * A Catalogue entry dropped on a sheet (from the pane): the shop opens on its tab, searching for it, with it ticked
 * (Learn for a spell or an adept power). Nothing is added by the drop itself. True when the data was such an entry.
 */
export async function dropReferenceEntry(actor: any, data: any): Promise<boolean> {
  if (data?.type !== REFERENCE_DRAG_TYPE || !actor?.isOwner) return false;
  const key = String(data.key ?? '');
  const type = String(data.entryType ?? '');
  if (!key || !(CODEX_TYPES as readonly string[]).includes(type)) return true;
  const learn = !soldInShop(type);
  const w: any = await openShop(actor, { type, query: String(data.name ?? ''), shop: !learn, ...(learn ? { payment: 'karma' as const } : {}) });
  if (w?.ticked) { w.ticked.set(key, 1); void w.render(); }
  return true;
}

/** v0.92.1: a book button in the title bar of a character or NPC sheet its owner sees (beside the Shop button). */
export function addReferenceButton(app: any, el: unknown): boolean {
  const root: HTMLElement | null = el instanceof HTMLElement ? el : app?.element ?? null;
  const doc: any = app?.document;
  if (!root?.classList?.contains('sr2e') || doc?.documentName !== 'Actor' || !['character', 'npc'].includes(doc.type) || !doc.isOwner) return false;
  const header = root.querySelector<HTMLElement>(':scope > .window-header');
  if (!header || header.querySelector('.sr2e-reference-button')) return false;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'header-control icon fa-solid fa-book-open-reader sr2e-reference-button';
  button.dataset['tooltip'] = tx('SR2E.App.Reference.button');
  button.setAttribute('aria-label', tx('SR2E.App.Reference.buttonFor', { name: doc.name }));
  button.addEventListener('click', (ev) => { ev.preventDefault(); ev.stopPropagation(); SR2Reference.show(doc, app); });
  const before = header.querySelector('.sr2e-shop-button, .sr2e-print-button, .sr2e-guide-button, [data-action="toggleControls"], [data-action="close"]');
  if (before?.parentElement) before.parentElement.insertBefore(button, before);
  else header.appendChild(button);
  return true;
}

export function registerReference(): void {
  Hooks.on('renderApplicationV2', (app: any, el: unknown) => {
    try { addReferenceButton(app, el); } catch (err) { console.warn('sr2e | reference button', err); }
  });
}

/** For the API: open the pane for an actor (its sheet if open). */
export function openReference(actor: any): SR2Reference | null {
  if (!actor) { ui.notifications?.warn?.(tx('SR2E.Notify.Reference.noActor')); return null; }
  if (!actor.isOwner) { ui.notifications?.warn?.(tx('SR2E.Notify.Reference.notOwner', { name: escHtml(actor.name) })); return null; }
  return SR2Reference.show(actor, actor.sheet?.rendered ? actor.sheet : undefined);
}

