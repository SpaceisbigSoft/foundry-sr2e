/**
 * v0.63.0: the sheet tools that need no window class (importable by the glue tests): creating a
 * basket's items, the tools' template context (pins, setup warnings, Edit/Play), and what runs after
 * each sheet render (toolbar, search, folding, row edits, Play mode). The Add window and the skill
 * picker are in `adding.ts`.
 */
import { SYSTEM } from '../config/system.ts';
import {
  systemWithAmount, copiesOf, gearStackKey, setupWarnings, pinAction, cleanPins, foldKey, matchesSearch,
  type BasketLine, type SetupWarning,
} from '../rules/index.ts';
import { arrivalReset } from './drops.ts';
import { refuseLockedRaises } from './advancement.ts';
import { headingName } from '../helpers/heading.ts';
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

export function sheetMode(actor: any): 'edit' | 'play' {
  const m = remember<Record<string, string>>('sheetMode', {});
  return m[actor?.uuid] === 'play' ? 'play' : 'edit';
}

/** What the templates need for the tools: pins (with their actions), a pin lookup, the setup warnings. */
export function sheetToolsContext(actor: any, extra: { build?: Array<{ label: string; used: any; allowed: any; ok: boolean; note?: string }> } = {}): any {
  const items: any[] = [...(actor.items ?? [])];
  const byId = new Map(items.map((i: any) => [i.id, i]));
  const pinIds = cleanPins(actor.getFlag?.(SYSTEM.id, 'pins'), (id) => byId.has(id) && Boolean(pinAction(byId.get(id).type)));
  const pins = pinIds.map((id) => { const i = byId.get(id); const a = pinAction(i.type)!; return { id, name: i.name, ...a }; });
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
    skills: items.filter((i: any) => i.type === 'skill').map((i: any) => ({ name: i.name, attribute: String(i.system?.attribute ?? '') })),
    items: items.map((i: any) => ({ id: i.id, type: i.type, name: i.name, system: i.system })),
    build: extra.build ?? [],
  }) : [];
  return {
    pins, pinSet: Object.fromEntries(pinIds.map((id) => [id, true])),
    warnings: warnings.slice(0, 30), warnMore: Math.max(0, warnings.length - 30),
    warnCount: warnings.filter((w) => w.level === 'warn').length, noteCount: warnings.filter((w) => w.level === 'note').length,
    mode: sheetMode(actor),
  };
}

const PLAY_LOCK = ['.sr2e-header input', '.sr2e-header select', '.sr2e-attributes input', '.sr2e-statgrid input', '.sr2e-rowedit'].map((x) => `${x}:not(.sr2e-play-ok)`).join(', ');

export function applyMode(sheet: any, root: HTMLElement | null): void {
  if (!root) return;
  const actor = sheet.document;
  const play = sheetMode(actor) === 'play';
  const body = root.querySelector<HTMLElement>('.sr2e-sheet') ?? root;
  body.classList.toggle('sr2e-play', play);
  for (const el of Array.from(root.querySelectorAll<HTMLInputElement | HTMLSelectElement>(PLAY_LOCK))) {
    const box = el instanceof HTMLSelectElement || (el as HTMLInputElement).type === 'checkbox';
    if (play) { el.dataset['sr2eLocked'] = '1'; if (box) el.disabled = true; else (el as HTMLInputElement).readOnly = true; }
    else if (el.dataset['sr2eLocked']) { delete el.dataset['sr2eLocked']; if (box) el.disabled = !(sheet.isEditable ?? actor.isOwner); else (el as HTMLInputElement).readOnly = !(sheet.isEditable ?? actor.isOwner); }
  }
  const btn = root.querySelector<HTMLElement>('[data-action="sheetMode"]');
  if (btn) {
    btn.innerHTML = play ? `<i class="fa-solid fa-lock"></i> ${tx('SR2E.App.Sheettools.play')}` : `<i class="fa-solid fa-pen-to-square"></i> ${tx('SR2E.App.Sheettools.edit')}`;
    btn.title = play ? tx('SR2E.App.Sheettools.playModeSetupControlsHidden') : tx('SR2E.App.Sheettools.editModeAddDeleteAnd');
  }
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
    bar.innerHTML = `<input type="search" class="sr2e-sheet-search" placeholder="Find on this sheet…" aria-label="Find on this sheet">${actor.isOwner ? '<button type="button" class="sr2e-mode-btn" data-action="sheetMode"></button>' : ''}`;
    // v0.68.0: after the stuck strip and tabs (.sr2e-stuck) where the sheet has them.
    const after = body.querySelector(':scope > .sr2e-stuck') ?? body.querySelector(':scope > .sr2e-tabs') ?? body.querySelector(':scope > .sr2e-summary') ?? body.querySelector(':scope > .sr2e-header');
    if (after) after.insertAdjacentElement('afterend', bar); else body.prepend(bar);
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
  applyMode(sheet, root);
  if (sheet._sr2eQuery) runSearch(root, sheet._sr2eQuery);
}

