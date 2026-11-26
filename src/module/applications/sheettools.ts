/**
 * v0.63.0: the sheet tools that need no window class (importable by the glue tests): creating a
 * basket's items, the tools' template context (pins, setup warnings, Edit/Play), and what runs after
 * each sheet render (toolbar, search, folding, row edits, Play mode). The Add window and the skill
 * picker are in `adding.ts`.
 */
import { SYSTEM } from '../config/system.ts';
import {
  systemWithAmount, copiesOf, gearStackKey, setupWarnings, pinAction, foldKey, matchesSearch,
  type BasketLine, type SetupWarning,
} from '../rules/index.ts';
import { arrivalReset } from './drops.ts';
import { refuseLockedRaises } from './advancement.ts';
import { creationRecordOf } from './approvals.ts';
import { sortRows, nextSort, isSortMode, rowsHaveValue, LIST_FILTER_MIN, LIST_SORT_MIN } from '../rules/lists0934.ts';
import type { SortMode, SortRow } from '../rules/lists0934.ts';
import { headingName } from '../helpers/heading.ts';
import { pinButtons, type PinEffect } from '../rules/pins935.ts';
import { t as tx } from '../helpers/i18n.ts';

/** What "ready to use" means for a type ('' = nothing to set). */
export function readyNote(type: string): string {
  return ({ cyberware: 'installed', focus: 'bonded', armor: 'worn', program: 'loaded' } as Record<string, string>)[type] ?? '';
}

export function readyPatch(type: string, ready: boolean, system: any): Record<string, unknown> {
  if (!ready) return arrivalReset(type, system);
  return ({ cyberware: { installed: true }, focus: { bonded: true }, armor: { worn: true }, program: { loaded: true } } as Record<string, Record<string, unknown>>)[type] ?? {};
}

/** What a basket made: names for the card, the lines that worked, and how to take it all back. */
export interface BasketResult { made: string[]; done: Array<BasketLine & { data: any }>; failed: string[]; rollback: () => Promise<void> }

/**
 * Create the items of a basket on an actor, one line at a time (a line that fails is reported, not
 * charged). Gear stacks on a piece that is the same thing (`gearStackKey`: name and what it does),
 * already on the sheet or made earlier in the same basket.
 */
export async function createFromBasket(actor: any, lines: Array<BasketLine & { data: any }>, o: { ready: boolean }): Promise<BasketResult> {
  const made: string[] = [];
  const done: Array<BasketLine & { data: any }> = [];
  const failed: string[] = [];
  const createdIds: string[] = [];
  const stacked: Array<{ item: any; before: number }> = [];
  const pendingGear = new Map<string, any>();
  for (const l of lines) {
    try {
      const system = systemWithAmount(l.type, { ...(l.data.system ?? {}) }, l.amount);
      Object.assign(system, readyPatch(l.type, o.ready, system));
      // v0.71.0 review (F13): a program to arrive loaded goes in through Swap Memory (the active-memory check) once made.
      const loadAfter = l.type === 'program' && o.ready && typeof actor.swapProgram === 'function';
      if (loadAfter) system.loaded = false;
      if (l.type === 'gear') {
        const key = gearStackKey(l.data.name, system);
        const same: any = pendingGear.get(key) ?? [...actor.items].find((i: any) => i.type === 'gear' && gearStackKey(i.name, i.system) === key);
        if (same) {
          const before = Number(same.system.quantity ?? 1);
          const q = before + Math.max(1, Number(system.quantity ?? 1));
          if (!stacked.some((x) => x.item === same) && !createdIds.includes(same.id)) stacked.push({ item: same, before });
          await same.update({ 'system.quantity': q });
          made.push(`${same.name} (now ×${q})`);
          done.push(l);
          continue;
        }
      }
      const n = copiesOf(l.type, l.amount);
      const docs: any[] = (await actor.createEmbeddedDocuments('Item', Array.from({ length: n }, () => ({ ...l.data, system: foundry.utils.deepClone(system) })))) ?? [];
      if (docs.length < n) {
        failed.push(l.name);
        // A part of a line isn't kept (or charged).
        const ids = docs.map((d: any) => d?.id).filter(Boolean);
        if (ids.length) { try { await actor.deleteEmbeddedDocuments('Item', ids); } catch (err) { console.warn('sr2e | add partial', err); } }
        continue;
      }
      for (const d of docs) if (d?.id) createdIds.push(d.id);
      if (loadAfter) for (const d of docs) if (d?.id) { try { await actor.swapProgram(d.id, true); } catch (err) { console.warn('sr2e | load program', err); } }
      if (l.type === 'gear' && docs[0]) pendingGear.set(gearStackKey(l.data.name, system), docs[0]);
      made.push(`${l.data.name}${n > 1 ? ` ×${n}` : l.type === 'gear' && Number(system.quantity) > 1 ? ` ×${system.quantity}` : ''}`);
      done.push(l);
    } catch (err) {
      console.warn('sr2e | add item', err);
      failed.push(l.name);
    }
  }
  const rollback = async () => {
    const ids = createdIds.filter((id) => actor.items.get?.(id));
    if (ids.length) { try { await actor.deleteEmbeddedDocuments('Item', ids); } catch (err) { console.warn('sr2e | add rollback', err); } }
    for (const s of stacked) { try { await s.item.update({ 'system.quantity': s.before }); } catch { /* gone */ } }
  };
  return { made, done, failed, rollback };
}

// ---------------------------------------------------------------- sheet tools

/** Per-browser memory (folded sections, Edit/Play per actor), safe when storage is blocked. */
export function remember<T>(key: string, fallback: T): T {
  try { const v = globalThis.localStorage?.getItem(`sr2e.${key}`); return v ? (JSON.parse(v) as T) : fallback; } catch { return fallback; }
}
export function store(key: string, value: unknown): void {
  try { globalThis.localStorage?.setItem(`sr2e.${key}`, JSON.stringify(value)); } catch { /* storage blocked */ }
}

/**
 * v0.93.4: the mode a sheet opens in before its player has chosen one: Play for a character whose creation is
 * finished (it has a creation record), Edit otherwise. An item follows the actor it belongs to.
 */
export function defaultSheetMode(doc: any): 'edit' | 'play' {
  if (doc?.documentName === 'Item' || doc?.parent?.documentName === 'Actor') return doc?.parent ? sheetMode(doc.parent) : 'edit';
  if (doc?.type === 'character') { try { return creationRecordOf(doc) ? 'play' : 'edit'; } catch { return 'edit'; } }
  return 'edit';
}

export function sheetMode(actor: any): 'edit' | 'play' {
  const m = remember<Record<string, string>>('sheetMode', {});
  const v = m[actor?.uuid];
  return v === 'play' || v === 'edit' ? v : defaultSheetMode(actor);
}

/** v0.93.4: sets a sheet's mode for this browser (the last 200 sheets are kept). */
export function setSheetMode(doc: any, mode: 'edit' | 'play'): void {
  const m = remember<Record<string, string>>('sheetMode', {});
  delete m[doc.uuid];
  m[doc.uuid] = mode;
  const keys = Object.keys(m);
  if (keys.length > 200) for (const k of keys.slice(0, keys.length - 200)) delete m[k];
  store('sheetMode', m);
}

/** What the templates need for the tools: pins (with their actions), a pin lookup, the setup warnings. */
export function sheetToolsContext(actor: any, extra: { build?: Array<{ label: string; used: any; allowed: any; ok: boolean; note?: string }>; effects?: PinEffect[] } = {}): any {
  const items: any[] = [...(actor.items ?? [])];
  // v0.93.5 (plan item 51): pins of pinnable items (as before) and of Effects-view rows (`fx:` keys).
  const pins = pinButtons(actor.getFlag?.(SYSTEM.id, 'pins'), items.map((i: any) => ({ id: String(i.id), type: String(i.type), name: String(i.name) })), extra.effects ?? [],
    (type) => pinAction(type));
  const pinIds = pins.map((p) => p.key);
  const canPin = Boolean(actor.isOwner) && ['character', 'npc'].includes(String(actor.type));
  const sys = actor.system ?? {};
  const d = sys.derived ?? {};
  const warnings: SetupWarning[] = ['character', 'npc'].includes(actor.type) ? setupWarnings({
    actorType: actor.type,
    attributes: Object.entries(sys.attributes ?? {}).map(([key, a]: [string, any]) => ({ key, label: game.i18n?.localize?.(`SR2E.Attribute.${key}`) ?? key, base: Number(a?.base ?? 0) })),
    attributeWarnings: d.attributeWarnings ?? [],
    essence: Number(d.essence ?? 6),
    cyberWarnings: d.cyberWarnings ?? [],
    adeptOver: (d.adeptOver ?? []).map((o: any) => o.name),
    magic: Number(d.magic ?? 0),
    skills: items.filter((i: any) => i.type === 'skill').map((i: any) => ({ name: i.name, attribute: String(i.system?.attribute ?? ''), specialization: String(i.system?.specialization ?? ''), concentration: String(i.system?.concentration ?? '') })),
    items: items.map((i: any) => ({ id: i.id, type: i.type, name: i.name, system: i.system })),
    build: extra.build ?? [],
  }) : [];
  return {
    pins, pinSet: Object.fromEntries(pinIds.map((id) => [id, true])), canPin, showPinbar: pins.length > 0 || canPin,
    warnings: warnings.slice(0, 30), warnMore: Math.max(0, warnings.length - 30),
    warnCount: warnings.filter((w) => w.level === 'warn').length, noteCount: warnings.filter((w) => w.level === 'note').length,
    mode: sheetMode(actor),
  };
}

const PLAY_LOCK = ['.sr2e-header input', '.sr2e-header select', '.sr2e-attributes input', '.sr2e-statgrid input', '.sr2e-rowedit',
  // v0.93.4: the Karma Pool's size and the career Karma are set at creation or by the GM, not in play.
  'input[name="system.karma.pool"]', 'input[name="system.karma.career"]'].map((x) => `${x}:not(.sr2e-play-ok)`).join(', ');
/** v0.93.4: on an item sheet Play locks every field but the ones used in play (`.sr2e-play-ok`, carried, drawn, rounds, notes). */
const ITEM_PLAY_OK = ['system.carried', 'system.ready', 'system.active', 'system.loaded', 'system.ammo', 'system.ammoType', 'system.rounds',
  'system.quantity', 'system.notes', 'system.sustained', 'system.worn', 'system.optics.worn', 'system.protection.worn', 'system.stealth.worn',
  'system.chip.slotted', 'system.damaged', 'system.degraded', 'system.surveillance.active', 'system.simchip.minutes',
  // v0.93.4 review: the turret's facing, being exposed, an erased program, a set-up support, a deck's damage.
  'system.turret.facing', 'system.exposed', 'system.erased', 'system.supportSetUp', 'system.damage.mpcp', 'system.damage.bod',
  'system.damage.evasion', 'system.damage.masking', 'system.damage.sensors'];
const ITEM_PLAY_LOCK = 'form input[name], form select[name], form textarea[name]';

/** v0.93.4: the Edit | Play switch (two buttons, the current one pressed). */
export function modeSwitchHtml(mode: 'edit' | 'play'): string {
  const b = (m: 'edit' | 'play', icon: string, label: string, tip: string) =>
    `<button type="button" class="sr2e-mode-btn${mode === m ? ' active' : ''}" data-action="sheetMode" data-mode="${m}" aria-pressed="${mode === m}" data-tooltip="${tip}"><i class="fa-solid fa-${icon}" aria-hidden="true"></i> ${label}</button>`;
  return `<span class="sr2e-mode-switch" role="group" aria-label="${tx('SR2E.App.Sheettools.modeGroup')}">${b('edit', 'pen-to-square', tx('SR2E.App.Sheettools.edit'), tx('SR2E.App.Sheettools.editModeTip'))}${b('play', 'lock', tx('SR2E.App.Sheettools.play'), tx('SR2E.App.Sheettools.playModeTip'))}</span>`;
}

function lockField(el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, play: boolean, editable: boolean): void {
  const box = el instanceof HTMLSelectElement || (el as HTMLInputElement).type === 'checkbox' || (el as HTMLInputElement).type === 'radio';
  const d = el.dataset;
  if (play) {
    if (d['sr2eLocked']) return;
    d['sr2eLocked'] = '1';
    // v0.93.4 review: what the template gave the field is kept, and Edit puts back exactly that (a GM-only box stays off).
    d['sr2eWasOff'] = box ? String((el as HTMLInputElement).disabled) : String((el as HTMLInputElement).readOnly);
    if (box) (el as HTMLInputElement).disabled = true; else (el as HTMLInputElement).readOnly = true;
    // Say why it can't be changed (Foundry's tooltip). The field's own hint (a title, or tooltip attributes) comes back in Edit.
    const title = el.getAttribute('title');
    if (title !== null) { d['sr2eTitleWas'] = title; el.removeAttribute('title'); }
    if (d['tooltip'] !== undefined) d['sr2eTipWas'] = d['tooltip'];
    if (d['tooltipText'] !== undefined) d['sr2eTipTextWas'] = d['tooltipText'];
    const why = tx('SR2E.App.Sheettools.lockedInPlay');
    d['tooltip'] = why;
    d['tooltipText'] = why;
  } else if (d['sr2eLocked']) {
    delete d['sr2eLocked'];
    const wasOff = d['sr2eWasOff'] === 'true';
    delete d['sr2eWasOff'];
    if (box) (el as HTMLInputElement).disabled = wasOff || !editable; else (el as HTMLInputElement).readOnly = wasOff || !editable;
    delete d['tooltip']; delete d['tooltipText'];
    if (d['sr2eTipWas'] !== undefined) { d['tooltip'] = d['sr2eTipWas']; delete d['sr2eTipWas']; }
    if (d['sr2eTipTextWas'] !== undefined) { d['tooltipText'] = d['sr2eTipTextWas']; delete d['sr2eTipTextWas']; }
    if (d['sr2eTitleWas'] !== undefined) { el.setAttribute('title', d['sr2eTitleWas']); delete d['sr2eTitleWas']; }
  }
}

/** v0.93.4 review: the switch is updated in place (the pressed button keeps the keyboard focus). */
function updateSwitch(sw: HTMLElement, mode: 'edit' | 'play'): void {
  for (const b of Array.from(sw.querySelectorAll<HTMLElement>('button[data-mode]'))) {
    const on = b.dataset['mode'] === mode;
    b.classList.toggle('active', on);
    b.setAttribute('aria-pressed', String(on));
  }
}

/**
 * v0.93.4: an item sheet gets the Edit | Play switch too (at the top). Play keeps the fields used in play and hides the
 * template bar; an item on an actor starts in that actor's mode.
 */
export function decorateItemSheet(sheet: any): void {
  const root: HTMLElement | null = sheet.element ?? null;
  const item: any = sheet.document;
  const body = root?.querySelector<HTMLElement>('.sr2e-sheet');
  if (!root || !item || !body || !item.isOwner) return;
  if (!body.querySelector(':scope > .sr2e-sheet-tools')) {
    const bar = document.createElement('div');
    bar.className = 'sr2e-sheet-tools sr2e-item-tools';
    bar.innerHTML = modeSwitchHtml(sheetMode(item));
    const head = body.querySelector(':scope > .sr2e-header');
    if (head) head.insertAdjacentElement('afterend', bar); else body.prepend(bar);
  }
  applyMode(sheet, root);
}

export function applyMode(sheet: any, root: HTMLElement | null): void {
  if (!root) return;
  const actor = sheet.document;
  const play = sheetMode(actor) === 'play';
  const body = root.querySelector<HTMLElement>('.sr2e-sheet') ?? root;
  body.classList.toggle('sr2e-play', play);
  body.classList.toggle('sr2e-edit', !play);
  const editable = Boolean(sheet.isEditable ?? actor.isOwner);
  const isItem = actor?.documentName === 'Item';
  const fields = isItem
    ? Array.from(root.querySelectorAll<HTMLInputElement>(ITEM_PLAY_LOCK)).filter((el) => !el.classList.contains('sr2e-play-ok') && !ITEM_PLAY_OK.includes(el.name) && !el.closest('.sr2e-play-ok, .editor, prose-mirror'))
    : Array.from(root.querySelectorAll<HTMLInputElement | HTMLSelectElement>(PLAY_LOCK));
  for (const el of fields) lockField(el, play, editable);
  const sw = root.querySelector<HTMLElement>('.sr2e-mode-switch');
  if (sw) updateSwitch(sw, play ? 'play' : 'edit');
}

function tabOf(el: HTMLElement): string { return el.closest<HTMLElement>('[data-tab].sr2e-tab')?.dataset['tab'] ?? 'all'; }
function headingText(h: HTMLElement): string {
  const c = h.cloneNode(true) as HTMLElement;
  c.querySelectorAll('a, button, .sr2e-status, select, input, label, i').forEach((x) => x.remove());
  return (c.textContent ?? '').trim();
}

/** The siblings a heading folds: up to the next heading of its level or higher. */
export function foldedPart(h: HTMLElement): HTMLElement[] {
  const level = h.tagName === 'H2' ? 2 : 3;
  const out: HTMLElement[] = [];
  let n = h.nextElementSibling as HTMLElement | null;
  while (n) {
    if (n.tagName === 'H2' || (level === 3 && n.tagName === 'H3')) break;
    out.push(n);
    n = n.nextElementSibling as HTMLElement | null;
  }
  return out;
}

export function toggleFold(_sheet: any, h: HTMLElement, set?: boolean): void {
  const fold = set ?? !h.classList.contains('sr2e-folded');
  h.classList.toggle('sr2e-folded', fold);
  if (h.hasAttribute('data-sr2e-kb')) h.setAttribute('aria-expanded', String(!fold));
  h.querySelector(':scope > .sr2e-caret[data-sr2e-kb]')?.setAttribute('aria-expanded', String(!fold));
  for (const el of foldedPart(h)) el.classList.toggle('sr2e-fold-away', fold);
  const key = h.dataset['foldKey'];
  if (!key || set !== undefined) return;
  const list = new Set(remember<string[]>('folded', []));
  if (fold) list.add(key); else list.delete(key);
  store('folded', [...list].slice(-300));
}

function runSearch(root: HTMLElement, q: string): void {
  const body = root.querySelector<HTMLElement>('.sr2e-sheet') ?? root;
  body.classList.toggle('sr2e-searching', Boolean(q.trim()));
  const hits: Record<string, number> = {};
  const rows = Array.from(body.querySelectorAll<HTMLElement>('li, .sr2e-chips > .sr2e-chip'))
    .filter((r) => !r.closest('.sr2e-summary, .sr2e-header, .sr2e-setup, .sr2e-rich, .sr2e-ledger'));
  for (const r of rows) {
    const ok = matchesSearch(r.textContent ?? '', q);
    r.classList.toggle('sr2e-nomatch', !ok);
    if (ok && q.trim()) { const t = tabOf(r); hits[t] = (hits[t] ?? 0) + 1; }
  }
  for (const a of Array.from(root.querySelectorAll<HTMLElement>('.sr2e-tabs [data-tab]'))) {
    a.querySelector('.sr2e-tab-hits')?.remove();
    const n = hits[a.dataset['tab'] ?? ''] ?? 0;
    if (q.trim() && n) a.insertAdjacentHTML('beforeend', ` <span class="sr2e-tab-hits">${n}</span>`);
  }
}

// ---------------------------------------------------------------- v0.93.4: list sort and filter

/** A list row's name (its item link) and number (rating, Force, quantity: the first number field or `data-sort-value`). */
function rowOf(li: HTMLElement): SortRow {
  // v0.93.4: the first link with words (a row can start with an icon-only link, such as Carried).
  const links = Array.from(li.querySelectorAll<HTMLElement>('[data-action="editItem"], [data-action="rollSkill"], a[data-item-id]'));
  const link = links.find((a) => (a.textContent ?? '').trim());
  const name = (link?.textContent ?? li.textContent ?? '').trim();
  const tagged = li.querySelector<HTMLElement>('[data-sort-value]')?.dataset['sortValue'];
  const input = li.querySelector<HTMLInputElement>('input[type="number"].sr2e-rowedit');
  const raw = tagged ?? input?.value ?? '';
  const n = raw === '' ? NaN : Number(raw);
  return { name, value: Number.isFinite(n) ? n : null };
}

const SORT_ICON: Record<SortMode, string> = { sheet: 'arrow-down-short-wide', name: 'arrow-down-a-z', nameDesc: 'arrow-down-z-a', value: 'arrow-down-9-1' };
function sortTip(mode: SortMode): string {
  if (mode === 'name') return tx('SR2E.App.Sheettools.sortName');
  if (mode === 'nameDesc') return tx('SR2E.App.Sheettools.sortNameDesc');
  if (mode === 'value') return tx('SR2E.App.Sheettools.sortValue');
  return tx('SR2E.App.Sheettools.sortSheet');
}

function sortedRows(ul: HTMLElement): HTMLElement[] {
  return Array.from(ul.children).filter((c): c is HTMLElement => c instanceof HTMLElement && c.tagName === 'LI' && !c.classList.contains('sr2e-empty'));
}

function applySort(ul: HTMLElement, mode: SortMode): void {
  const rows = sortedRows(ul);
  // The sheet's own order is kept on the rows, so "Sheet order" can put it back.
  rows.forEach((li, i) => { if (li.dataset['sr2eOrder'] === undefined) li.dataset['sr2eOrder'] = String(i); });
  const base = [...rows].sort((a, b) => Number(a.dataset['sr2eOrder']) - Number(b.dataset['sr2eOrder']));
  const order = sortRows(base.map(rowOf), mode);
  const tail = rows.length ? rows[rows.length - 1]!.nextSibling : null;
  for (const i of order) ul.insertBefore(base[i]!, tail);
}

function sortButton(mode: SortMode): string {
  return `<a class="sr2e-sort${mode === 'sheet' ? '' : ' on'}" role="button" tabindex="0" data-sort="${mode}" data-tooltip="${sortTip(mode)}" aria-label="${sortTip(mode)}"><i class="fa-solid fa-${SORT_ICON[mode]}" aria-hidden="true"></i></a>`;
}

/** The sort button on each list heading (three rows or more), and a filter box on long lists (ten rows or more). */
export function decorateLists(body: HTMLElement, sheet: any = {}): void {
  const filters: Record<string, string> = (sheet._sr2eListFilter ??= {});
  const sorts = remember<Record<string, string>>('listSort', {});
  for (const h of Array.from(body.querySelectorAll<HTMLElement>('h2[data-fold-key], h3[data-fold-key]'))) {
    const ul = h.nextElementSibling as HTMLElement | null;
    if (!ul || ul.tagName !== 'UL') continue;
    const rows = sortedRows(ul);
    if (rows.length < LIST_SORT_MIN || !rows.some((li) => li.querySelector('a[data-item-id]'))) continue;
    const key = h.dataset['foldKey'] ?? '';
    const saved = sorts[key];
    const mode: SortMode = isSortMode(saved) ? saved : 'sheet';
    if (!h.querySelector(':scope > .sr2e-sort')) {
      const add = h.querySelector(':scope > a.sr2e-add');
      if (add) add.insertAdjacentHTML('beforebegin', sortButton(mode)); else h.insertAdjacentHTML('beforeend', sortButton(mode));
      const btn = () => h.querySelector<HTMLElement>(':scope > .sr2e-sort');
      const go = (ev: Event) => {
        ev.preventDefault(); ev.stopPropagation();
        const cur = btn()?.dataset['sort'];
        const next = nextSort(isSortMode(cur) ? cur : 'sheet', rowsHaveValue(sortedRows(ul).map(rowOf)));
        const all = remember<Record<string, string>>('listSort', {});
        if (next === 'sheet') delete all[key]; else all[key] = next;
        store('listSort', all);
        btn()!.outerHTML = sortButton(next);
        bind();
        applySort(ul, next);
      };
      const bind = () => {
        const b = btn();
        if (!b) return;
        b.addEventListener('click', go);
        b.addEventListener('keydown', (ev) => { if ((ev as KeyboardEvent).key === 'Enter' || (ev as KeyboardEvent).key === ' ') go(ev); });
      };
      bind();
    }
    if (mode !== 'sheet') applySort(ul, mode);
    if (rows.length >= LIST_FILTER_MIN && !(ul.previousElementSibling?.classList.contains('sr2e-list-filter'))) {
      const box = document.createElement('input');
      box.type = 'search';
      box.className = 'sr2e-list-filter';
      box.placeholder = tx('SR2E.App.Sheettools.filterList');
      box.setAttribute('aria-label', tx('SR2E.App.Sheettools.filterListNamed', { list: (h.dataset['heading'] ?? h.textContent ?? '').trim() }));
      ul.insertAdjacentElement('beforebegin', box);
      // Not part of the sheet's form data; Escape clears it.
      box.addEventListener('change', (ev) => ev.stopPropagation());
      box.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') ev.preventDefault(); if (ev.key === 'Escape' && box.value) { ev.stopPropagation(); box.value = ''; filters[key] = ''; filterList(ul, ''); } });
      box.addEventListener('input', () => { filters[key] = box.value; filterList(ul, box.value); });
      // A re-render keeps what was typed.
      if (filters[key]) { box.value = filters[key]!; filterList(ul, box.value); }
    }
  }
}

function filterList(ul: HTMLElement, q: string): void {
  for (const li of sortedRows(ul)) li.classList.toggle('sr2e-filtered', Boolean(q.trim()) && !matchesSearch(li.textContent ?? '', q));
}

/** After each render of an actor sheet: the toolbar (search, Edit/Play), folding, row edits, the setup banner. */
export function decorateSheet(sheet: any): void {
  const root: HTMLElement | null = sheet.element ?? null;
  const actor: any = sheet.document;
  if (!root || !actor) return;
  const body = root.querySelector<HTMLElement>('.sr2e-sheet');
  if (!body) return;
  // The toolbar, after the tabs (or the summary, or the header).
  if (!body.querySelector('.sr2e-sheet-tools')) {
    const bar = document.createElement('div');
    bar.className = 'sr2e-sheet-tools';
    bar.innerHTML = `<input type="search" class="sr2e-sheet-search" placeholder="${tx('SR2E.App.Sheettools.findPlaceholder')}" aria-label="${tx('SR2E.App.Sheettools.findPlaceholder')}">${actor.isOwner ? modeSwitchHtml(sheetMode(actor)) : ''}`;
    // v0.93.4: inside the stuck strip where the sheet has one, so the Edit | Play switch and the find box stay in view.
    const stuck = body.querySelector<HTMLElement>(':scope > .sr2e-stuck');
    const after = body.querySelector(':scope > .sr2e-tabs') ?? body.querySelector(':scope > .sr2e-summary') ?? body.querySelector(':scope > .sr2e-header');
    if (stuck) stuck.appendChild(bar); else if (after) after.insertAdjacentElement('afterend', bar); else body.prepend(bar);
    const input = bar.querySelector<HTMLInputElement>('.sr2e-sheet-search')!;
    input.value = sheet._sr2eQuery ?? '';
    input.addEventListener('input', () => { sheet._sr2eQuery = input.value; runSearch(root, input.value); });
    input.addEventListener('focus', () => { sheet._sr2eSearchFocus = true; });
    // A re-render removes the box (and may blur it): only a blur that leaves the box in the page counts.
    input.addEventListener('blur', () => { setTimeout(() => { if (input.isConnected) sheet._sr2eSearchFocus = false; }, 0); });
    // Typing means the box has focus (focus events don't fire while the browser window itself is unfocused).
    input.addEventListener('input', () => { sheet._sr2eSearchFocus = true; sheet._sr2eSearchCaret = input.selectionStart ?? input.value.length; });
    input.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') ev.preventDefault(); if (ev.key === 'Escape' && input.value) { ev.stopPropagation(); input.value = ''; sheet._sr2eQuery = ''; runSearch(root, ''); } });
    // Not part of the actor's form data.
    input.addEventListener('change', (ev) => ev.stopPropagation());
    if (sheet._sr2eSearchFocus) { input.focus(); const c = Math.min(input.value.length, sheet._sr2eSearchCaret ?? input.value.length); input.setSelectionRange(c, c); }
  }
  // Folding.
  const folded = new Set(remember<string[]>('folded', []));
  for (const h of Array.from(body.querySelectorAll<HTMLElement>('h2, h3'))) {
    if (h.closest('.sr2e-header, .sr2e-summary, .sr2e-rich, .sr2e-setup, summary, dialog')) continue;
    if (!foldedPart(h).length) continue;
    const key = foldKey(actor.type, tabOf(h), headingName(h, headingText));
    h.dataset['foldKey'] = key;
    h.classList.add('sr2e-foldable');
    if (!h.querySelector('.sr2e-caret')) h.insertAdjacentHTML('afterbegin', '<i class="sr2e-caret fa-solid fa-chevron-down" aria-hidden="true"></i>');
    if (folded.has(key)) toggleFold(sheet, h, true);
    if (h.dataset['sr2eFoldBound']) continue;
    h.dataset['sr2eFoldBound'] = '1';
    h.addEventListener('click', (ev) => {
      if ((ev.target as HTMLElement).closest('a, button, input, select, label, [data-action]')) return;
      toggleFold(sheet, h);
    });
  }
  // Row number edits (unnamed inputs: they change the item, not the actor's form).
  for (const input of Array.from(body.querySelectorAll<HTMLInputElement>('input.sr2e-rowedit'))) {
    if (input.dataset['sr2eBound']) continue;
    input.dataset['sr2eBound'] = '1';
    input.addEventListener('change', async (ev) => {
      ev.stopPropagation();
      if (input.readOnly) return;
      const item: any = actor.items.get(input.dataset['itemId']);
      const field = input.dataset['field'];
      if (!item || !field) return;
      const min = Number(input.min || 0);
      const v = Math.max(min, Math.floor(Number(input.value) || 0));
      // v0.64.0: after creation a player raises ratings with Spend Karma (the box goes back).
      const change: Record<string, unknown> = { [field]: v };
      if (refuseLockedRaises(item, 'item', change).length) { input.value = String(foundry.utils.getProperty(item, field) ?? ''); return; }
      input.value = String(v);
      await item.update(change);
    });
    input.addEventListener('click', (ev) => ev.stopPropagation());
    // Selecting the number mustn't drag the row (rows are draggable for the hotbar).
    input.addEventListener('mousedown', () => {
      const li = input.closest<HTMLElement>('[draggable="true"]');
      if (!li) return;
      li.draggable = false;
      input.addEventListener('blur', () => { li.draggable = true; }, { once: true });
    });
  }
  // The setup banner keeps its open state across renders.
  const setup = body.querySelector<HTMLDetailsElement>('details.sr2e-setup');
  if (setup) {
    if (sheet._sr2eSetupOpen) setup.open = true;
    setup.addEventListener('toggle', () => { sheet._sr2eSetupOpen = setup.open; });
  }
  try { decorateLists(body, sheet); } catch (err) { console.warn('sr2e | list tools', err); }
  applyMode(sheet, root);
  if (sheet._sr2eQuery) runSearch(root, sheet._sr2eQuery);
}

