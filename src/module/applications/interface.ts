/**
 * v0.68.0: the second interface pass, Foundry side.
 *
 * - Sheet layouts, a per-player choice (client setting `sheetLayout`): Tabs (the default), Combat column
 *   (the tabs plus an always-open combat column) and Compact (one folding column). One set of templates:
 *   the sheet root carries `sr2e-layout-<layout>`, the CSS arranges it, the combat column is a partial.
 * - The always-visible status strip (`stripContext`, template `status-strip.hbs`) and the "your turn"
 *   helper: in the actor's action phase, buttons whose action no longer fits the phase are greyed.
 * - Roll dialogs: the TN breakdown in a column on the right, the choices on the left, one big Roll button,
 *   and the last choices remembered (a `data-sr2e-remember` marker names the key and the fields).
 * - − / + steppers and the scroll wheel on numbers; the condition monitor's boxes take the keyboard and
 *   show what a click will do.
 * - Section and tab icons, GM-only parts marked with a striped edge, grouped notifications, window size
 *   and position remembered per player, and the system's settings in sections.
 */
import { SYSTEM } from '../config/system.ts';
import {
  RULES, LAYOUT_LABELS, LAYOUT_TYPES, layoutFor, compactFoldKey, compactFolded, sectionIcon, tabIcon, statusStrip, readiedWeapon,
  buttonCost, affordable, ASTRAL_BLOCKED_ACTIONS, memoryFields, rememberRoll, restoredNumber, stepValue, groupNotes, repeatedText, NOTE_GROUP,
  rememberWindow, placeWindow, emptyWinMemory, settingSection, SETTING_SECTIONS, parseFiringModes,
  type SheetLayout, type RollMemory, type WinMemory,
} from '../rules/index.ts';
import { calledFromSystem, isOurWindow } from './look.ts';
import { quickRollArmed } from './hotkeys.ts';
import { t as tx, tCount } from '../helpers/i18n.ts';
import { remember, store } from './sheettools.ts';
import { escHtml } from '../rules/html.ts';
import { initiativeFormula } from '../helpers/initiative.ts';
import { headingName } from '../helpers/heading.ts';

const ID = SYSTEM.id;

// ---------------------------------------------------------------- small helpers

function setting<T>(key: string, fallback: T): T {
  try { const v = (game as any).settings.get(ID, key); return (v ?? fallback) as T; } catch { return fallback; }
}
// A-14, A-15: the per-browser memory and the escape helper are the shared ones.
const mem = remember;
const save = store;
const esc = (t: string): string => escHtml(t);
function openApps(): any[] {
  const inst: any = (foundry as any).applications?.instances;
  return inst?.values ? [...inst.values()] : Object.values(inst ?? {});
}

/** Re-render the open actor sheets (all, or those `which` picks). */
export function rerenderActorSheets(which?: (actor: any) => boolean): void {
  for (const app of openApps()) {
    const doc = app?.document;
    if (!doc || doc.documentName !== 'Actor' || !app.rendered) continue;
    if (which && !which(doc)) continue;
    // Never under someone's hands: a field or a rich-text editor being typed in waits for the next render.
    const el: HTMLElement | null = app.element ?? null;
    const focus = globalThis.document?.activeElement as HTMLElement | null;
    if (el && (el.querySelector('prose-mirror.active') || (focus && el.contains(focus) && /^(INPUT|TEXTAREA|SELECT)$/.test(focus.tagName) && !(focus as HTMLInputElement).readOnly))) continue;
    try { void app.render(); } catch { /* closing */ }
  }
}

// ---------------------------------------------------------------- settings

export function registerInterfaceSettings(): void {
  const s: any = (game as any).settings;
  s.register(ID, 'sheetLayout', {
    name: 'SR2E.Settings.sheetLayout.Name', hint: 'SR2E.Settings.sheetLayout.Hint',
    scope: 'client', config: true, type: String, default: 'tabs', choices: { ...LAYOUT_LABELS }, onChange: () => rerenderActorSheets(),
  });
  s.register(ID, 'numberSteppers', {
    name: 'SR2E.Settings.numberSteppers.Name', hint: 'SR2E.Settings.numberSteppers.Hint',
    scope: 'client', config: true, type: Boolean, default: true, onChange: () => rerenderActorSheets(),
  });
  s.register(ID, 'rememberRolls', {
    name: 'SR2E.Settings.rememberRolls.Name', hint: 'SR2E.Settings.rememberRolls.Hint',
    scope: 'client', config: true, type: Boolean, default: true,
  });
  s.register(ID, 'rememberWindows', {
    name: 'SR2E.Settings.rememberWindows.Name', hint: 'SR2E.Settings.rememberWindows.Hint',
    scope: 'client', config: true, type: Boolean, default: true,
  });
  s.register(ID, 'groupNotes', {
    name: 'SR2E.Settings.groupNotes.Name', hint: 'SR2E.Settings.groupNotes.Hint',
    scope: 'client', config: true, type: Boolean, default: true,
  });
}

/** The player's layout for a sheet of this actor type. */
export function currentLayout(actorType: string): SheetLayout {
  return layoutFor(actorType, setting('sheetLayout', 'tabs'));
}

// ---------------------------------------------------------------- the status strip

/** The strip's view: condition, wounds, initiative, pools left (with pips), the readied weapon, your turn. */
export function stripContext(actor: any, pools: Array<{ key: string; label: string; left: number; total: number }>): any {
  const sys = actor?.system ?? {}, d = sys.derived ?? {};
  const c: any = (game as any).combat;
  const combatant = c?.started ? [...(c.combatants ?? [])].find((x: any) => x.actor === actor || x.actor?.uuid === actor.uuid) : null;
  const items: any[] = [...(actor?.items ?? [])];
  const weapons = items.filter((i) => i.type === 'weapon').map((i) => ({
    id: i.id, name: i.name, melee: Boolean(i.system?.melee), ammo: Number(i.system?.ammo ?? 0), ammoMax: Number(i.system?.ammoMax ?? 0),
    mode: '', jammed: Boolean(i.system?.jammed), ready: i.system?.ready !== false,
  }));
  const prefs = (actor?.getFlag?.(ID, 'attackPrefs') ?? {}) as Record<string, any>;
  const w = readiedWeapon(weapons, { last: actor?.getFlag?.(ID, 'lastWeapon') ?? null, pins: (actor?.getFlag?.(ID, 'pins') as string[] | undefined) ?? [] });
  if (w && !w.melee) {
    const modes = parseFiringModes(String(actor.items.get?.(w.id)?.system?.modes ?? '')) as string[];
    const p = prefs[w.id]?.mode;
    w.mode = p && modes.includes(p) ? p : modes[0] ?? '';
  }
  const init = initiativeFormula(actor);
  const view: any = statusStrip({
    wound: Number(d.woundModifier ?? 0), status: String(d.status ?? 'ok'), stabilised: Boolean(sys.care?.stabilised),
    // v0.71.0 (R15): the same formula the combatant rolls (Matrix, rigged, astral, spirits, wounds).
    initiative: combatant?.initiative ?? null, reaction: init.base - init.minus, initiativeDice: init.dice,
    pools, karmaPool: null, weapon: w, acting: Boolean(c?.started && actor?.isActing?.()), actionsUsed: Number(actor?.actionsUsed?.() ?? 0),
    enforce: String(RULES.ACTIONS.enforce),
  });
  view.pools = view.pools.map((p: any) => ({ ...p, pips: Array.from({ length: Math.max(0, Math.min(p.total, 30)) }, (_, i) => ({ value: i + 1, filled: i < p.left })) }));
  return view;
}

// ---------------------------------------------------------------- after each sheet render

/** v0.68.0: what runs after each actor sheet render (after the v0.63.0 tools). */
export function decorateInterface(sheet: any): void {
  const root: HTMLElement | null = sheet?.element ?? null;
  const actor: any = sheet?.document;
  const body = root?.querySelector<HTMLElement>('.sr2e-sheet');
  if (!root || !actor || !body) return;
  const layout = currentLayout(actor.type);
  for (const l of ['tabs', 'combat', 'compact']) root.classList.toggle(`sr2e-win-${l}`, l === layout);
  try { layoutPicker(body, actor, layout); } catch (err) { console.warn('sr2e | layout picker', err); }
  if (layout === 'compact') { try { compactTabs(sheet, body); } catch (err) { console.warn('sr2e | compact', err); } }
  try { sectionIcons(body); } catch (err) { console.warn('sr2e | icons', err); }
  try { markGmOnly(body); } catch { /* none */ }
  try { astralHelper(actor, body); } catch (err) { console.warn('sr2e | astral buttons', err); }
  try { turnHelper(actor, body); } catch (err) { console.warn('sr2e | your turn', err); }
  try { monitorTrack(body); } catch (err) { console.warn('sr2e | monitor', err); }
  try { if (setting('numberSteppers', true)) addSteppers(body, SHEET_STEP_FIELDS); } catch (err) { console.warn('sr2e | steppers', err); }
  bindWheel(body);
}

function layoutPicker(body: HTMLElement, actor: any, layout: SheetLayout): void {
  if (!(LAYOUT_TYPES as readonly string[]).includes(actor.type)) return;
  const bar = body.querySelector<HTMLElement>('.sr2e-sheet-tools');
  if (!bar || bar.querySelector('.sr2e-layout-pick')) return;
  const sel = document.createElement('select');
  sel.className = 'sr2e-layout-pick';
  sel.title = tx('SR2E.App.Interface.sheetLayoutYourChoiceFor');
  sel.setAttribute('aria-label', tx('SR2E.App.Interface.sheetLayout'));
  const names = { tabs: tx('SR2E.App.Interface.tabs'), combat: tx('SR2E.App.Interface.combatColumn'), compact: tx('SR2E.App.Interface.compact') };
  sel.innerHTML = (['tabs', 'combat', 'compact'] as const).map((l) => `<option value="${l}"${l === layout ? ' selected' : ''}>${names[l]}</option>`).join('');
  // Not part of the actor's form data.
  sel.addEventListener('change', (ev) => { ev.stopPropagation(); void (game as any).settings.set(ID, 'sheetLayout', sel.value); });
  sel.addEventListener('input', (ev) => ev.stopPropagation());
  bar.appendChild(sel);
}

/** Compact: every tab becomes a folding section with a header row (open ones remembered per player). */
function compactTabs(sheet: any, body: HTMLElement): void {
  const actor = sheet.document;
  const nav = Array.from(body.querySelectorAll<HTMLElement>('.sr2e-tabs [data-tab]'));
  const stored = mem<Record<string, boolean>>('compactFolded', {});
  for (const sec of Array.from(body.querySelectorAll<HTMLElement>(':scope > section.sr2e-tab[data-tab]'))) {
    const tab = sec.dataset['tab'] ?? '';
    const key = compactFoldKey(actor.type, tab);
    let head = sec.querySelector<HTMLElement>(':scope > .sr2e-tab-head');
    if (!head) {
      const label = (nav.find((a) => a.dataset['tab'] === tab)?.textContent ?? tab).trim();
      head = document.createElement('div');
      head.className = 'sr2e-tab-head';
      head.tabIndex = 0;
      head.setAttribute('role', 'button');
      head.innerHTML = `<i class="sr2e-caret fa-solid fa-chevron-down" aria-hidden="true"></i><i class="${esc(tabIcon(tab))}" aria-hidden="true"></i> ${esc(label)}`;
      sec.prepend(head);
      const toggle = () => {
        const folded = !sec.classList.contains('sr2e-tab-folded');
        sec.classList.toggle('sr2e-tab-folded', folded);
        head!.setAttribute('aria-expanded', String(!folded));
        const all = mem<Record<string, boolean>>('compactFolded', {});
        all[key] = folded;
        save('compactFolded', all);
      };
      head.addEventListener('click', toggle);
      head.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); toggle(); } });
    }
    const folded = compactFolded(tab, key, stored);
    sec.classList.toggle('sr2e-tab-folded', folded);
    head.setAttribute('aria-expanded', String(!folded));
  }
}

/** Compact: open a tab's section (the setup warnings' links jump into it). */
export function openCompactTab(root: HTMLElement | null, tab: string): void {
  root?.querySelector<HTMLElement>(`.sr2e-layout-compact > section.sr2e-tab[data-tab="${tab}"]`)?.classList.remove('sr2e-tab-folded');
}

function plainHeading(h: HTMLElement): string {
  const c = h.cloneNode(true) as HTMLElement;
  c.querySelectorAll('a, button, .sr2e-status, select, input, label, i, span').forEach((x) => x.remove());
  return (c.textContent ?? '').trim();
}

/** The same icon for the same section on every sheet. */
function sectionIcons(body: HTMLElement): void {
  for (const h of Array.from(body.querySelectorAll<HTMLElement>('h2, h3'))) {
    if (h.closest('.sr2e-rich, .sr2e-summary, .sr2e-header, .sr2e-combat-col, details > summary') || h.querySelector('.sr2e-sec-icon')) continue;
    const icon = sectionIcon(headingName(h, plainHeading));
    if (!icon) continue;
    const i = document.createElement('i');
    i.className = `sr2e-sec-icon ${icon}`;
    i.setAttribute('aria-hidden', 'true');
    const caret = h.querySelector(':scope > .sr2e-caret');
    if (caret) caret.after(i); else h.prepend(i);
  }
}

/**
 * GM-only controls get the striped edge. v0.89.5: the templates mark them (`data-sr2e-gm`, scripts/i18n-headings.mjs);
 * a tooltip ending in "(GM)" (code-built controls, English) still counts.
 */
function markGmOnly(root: HTMLElement): void {
  for (const el of Array.from(root.querySelectorAll<HTMLElement>('[data-sr2e-gm], [title*="(GM)"]'))) el.classList.add('sr2e-gm-only');
}

/** v0.70.0: a projecting magician or an unmaterialized spirit can't take physical actions: grey those buttons. */
function astralHelper(actor: any, body: HTMLElement): void {
  if (!RULES.FIXES_V70.astralBlocksPhysical) return;
  const why: string = actor.astralOnly?.() ?? '';
  if (!why) return;
  const block = !(game as any).user?.isGM;
  for (const el of Array.from(body.querySelectorAll<HTMLElement>('[data-action]'))) {
    if (!ASTRAL_BLOCKED_ACTIONS.has(el.dataset['action'] ?? '')) continue;
    el.classList.add('sr2e-cant');
    el.setAttribute('aria-disabled', 'true');
    el.title = `${el.title ? `${el.title} · ` : ''}${tx('SR2E.App.Interface.notInThePhysicalWorld', { name: actor.name, why })}`;
    if (block && el instanceof HTMLButtonElement) el.disabled = true;
  }
}

/** In the actor's action phase: buttons that need more actions than are left are greyed (blocked in "block" mode). */
function turnHelper(actor: any, body: HTMLElement): void {
  const c: any = (game as any).combat;
  if (!c?.started || RULES.ACTIONS.enforce === 'off' || !actor.isActing?.()) return;
  const used = Number(actor.actionsUsed?.() ?? 0);
  const block = RULES.ACTIONS.enforce === 'block' && !(game as any).user?.isGM;
  const prefs = (actor.getFlag?.(ID, 'attackPrefs') ?? {}) as Record<string, any>;
  const cyber: any[] = actor.cyberWeapons?.() ?? [];
  for (const el of Array.from(body.querySelectorAll<HTMLElement>('[data-action]'))) {
    const action = el.dataset['action'] ?? '';
    let weapon: any = null;
    if (action === 'attackWeapon') {
      const id = el.dataset['itemId'] ?? '';
      const item: any = id === 'unarmed' ? { system: { melee: true } } : actor.items.get(id) ?? cyber.find((x: any) => x.id === id);
      if (!item) continue;
      const modes = parseFiringModes(String(item.system?.modes ?? '')) as string[];
      const own = el.dataset['mode'];
      const want = own ?? prefs[id]?.mode;
      weapon = { melee: Boolean(item.system?.melee), blast: Boolean(item.system?.blast), strengthRange: Boolean(item.system?.strengthRange), mode: want && modes.includes(want) ? want : modes[0], modes, explicit: Boolean(own) };
    }
    // Drawing costs an action only by that rule, and never for a quick-draw weapon.
    if (action === 'drawWeapon') {
      const w: any = actor.items.get(el.dataset['itemId'] ?? '');
      if (RULES.COMBAT.ready.rule !== 'action' || w?.system?.quickDraw || w?.system?.ready) continue;
    }
    const cost = buttonCost(action, weapon);
    if (!cost || affordable(cost, used)) continue;
    el.classList.add('sr2e-cant');
    el.setAttribute('aria-disabled', 'true');
    el.title = `${el.title ? `${el.title} · ` : ''}${tx('SR2E.App.Interface.needsAActionNotEnough', { cost })}`;
    if (block && el instanceof HTMLButtonElement) el.disabled = true;
  }
}

/** The condition monitor: hovering shows which boxes a click fills or clears (the keys: applications/a11y.ts). */
function monitorTrack(body: HTMLElement): void {
  for (const box of Array.from(body.querySelectorAll<HTMLElement>('.sr2e-cm .sr2e-box[data-track]'))) {
    if (box.dataset['sr2eCm']) continue;
    box.dataset['sr2eCm'] = '1';
    // v0.86.0: Enter and Space on a box are handled by applications/a11y.ts (with the arrow keys and the focus kept).
    const same = () => Array.from(box.closest('.sr2e-cm')?.querySelectorAll<HTMLElement>(`.sr2e-box[data-track="${box.dataset['track']}"]`) ?? []);
    const show = () => {
      const all = same();
      const v = Number(box.dataset['value']);
      const current = Math.max(0, ...all.filter((b) => b.classList.contains('filled')).map((b) => Number(b.dataset['value']) || 0));
      const to = current === v ? v - 1 : v;
      for (const b of all) {
        const n = Number(b.dataset['value']);
        b.classList.toggle('sr2e-would-fill', n <= to && !b.classList.contains('filled'));
        b.classList.toggle('sr2e-would-clear', n > to && b.classList.contains('filled'));
      }
      const label = box.dataset['track'] === 'stun' ? tx('SR2E.App.Interface.stun') : box.dataset['track'] === 'matrix' ? tx('SR2E.App.Interface.persona') : tx('SR2E.App.Interface.physical');
      box.title = tCount(to, 'SR2E.App.Interface.clickToSetBox', { label });
    };
    const hide = () => { for (const b of same()) b.classList.remove('sr2e-would-fill', 'sr2e-would-clear'); };
    box.addEventListener('mouseenter', show);
    box.addEventListener('focus', show);
    box.addEventListener('mouseleave', hide);
    box.addEventListener('blur', hide);
  }
}

// ---------------------------------------------------------------- steppers and the wheel

/** The numbers on a sheet that get − / + (the ones changed in play). */
const SHEET_STEP_FIELDS = [
  'input[type="number"].sr2e-rowedit',
  '.sr2e-attributes input[type="number"]',
  '.sr2e-monitor .sr2e-row input[type="number"]',
  '.sr2e-statgrid input[type="number"]',
  'input[type="number"][name="system.karma.pool"]',
  'input[type="number"][name="system.poolSpent.combat"]',
  'input[type="number"][name="system.grunts.down"]',
  'input[type="number"][name="system.services"]',
].join(', ');

function stepOpts(input: HTMLInputElement) {
  const num = (v: string) => (v === '' || v == null ? null : Number(v));
  return { step: input.step && input.step !== 'any' ? Number(input.step) : 1, min: num(input.min), max: num(input.max) };
}

function bump(input: HTMLInputElement, dir: number, commit = true): boolean {
  if (input.readOnly || input.disabled) return false;
  const v = String(stepValue(input.value, dir, stepOpts(input)));
  if (v === input.value) return false;
  input.value = v;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  if (commit) input.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}

/** Wrap number fields in − / + buttons (no name: never part of a form's data). */
export function addSteppers(scope: HTMLElement, selector: string): void {
  for (const input of Array.from(scope.querySelectorAll<HTMLInputElement>(selector))) {
    if (input.type !== 'number' || input.closest('.sr2e-stepper') || input.hidden) continue;
    const wrap = document.createElement('span');
    wrap.className = 'sr2e-stepper';
    input.parentNode?.insertBefore(wrap, input);
    const mk = (dir: number) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.tabIndex = -1;
      b.className = `sr2e-step sr2e-step-${dir < 0 ? 'down' : 'up'}`;
      b.textContent = dir < 0 ? '−' : '+';
      b.setAttribute('aria-label', dir < 0 ? tx('SR2E.App.Interface.oneLess') : tx('SR2E.App.Interface.oneMore'));
      b.addEventListener('mousedown', (ev) => ev.preventDefault());
      b.addEventListener('click', (ev) => { ev.preventDefault(); ev.stopPropagation(); bump(input, dir); });
      return b;
    };
    wrap.append(mk(-1), input, mk(1));
  }
}

/** The scroll wheel changes a number field that has the cursor (one change event when the wheel stops). */
export function bindWheel(scope: HTMLElement): void {
  if (!setting('numberSteppers', true) || scope.dataset['sr2eWheel']) return;
  scope.dataset['sr2eWheel'] = '1';
  let timer: ReturnType<typeof setTimeout> | null = null;
  scope.addEventListener('wheel', (ev: WheelEvent) => {
    const t = ev.target as HTMLInputElement | null;
    if (!t || t.tagName !== 'INPUT' || t.type !== 'number' || document.activeElement !== t || t.readOnly || t.disabled) return;
    ev.preventDefault();
    if (!bump(t, ev.deltaY < 0 ? 1 : -1, false)) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { timer = null; t.dispatchEvent(new Event('change', { bubbles: true })); }, 450);
  }, { passive: false });
}

// ---------------------------------------------------------------- roll dialogs

/** The marker a dialog's content carries to remember its choices: key (actor + what), fields. */
export function rememberMarker(key: string, fields: string[]): string {
  return `<span hidden data-sr2e-remember="${esc(key)}" data-fields="${esc(fields.join(','))}"></span>`;
}

function fieldValue(el: any): string | boolean | null {
  if (!el) return null;
  if (el instanceof RadioNodeList) return el.value;
  if (el.type === 'checkbox') return Boolean(el.checked);
  return String(el.value ?? '');
}

function restoreField(el: any, saved: unknown): boolean {
  if (!el || saved === undefined || saved === null) return false;
  if (el instanceof RadioNodeList) {
    const v = String(saved);
    const opt = Array.from(el as unknown as ArrayLike<HTMLInputElement>).find((x) => x.value === v);
    if (!opt || opt.checked) return false;
    opt.checked = true;
    return true;
  }
  if (el.disabled) return false;
  if (el.type === 'checkbox') { const b = Boolean(saved); if (el.checked === b) return false; el.checked = b; return true; }
  if (el.type === 'number') {
    const v = restoredNumber(saved, { min: el.min === '' ? null : Number(el.min), max: el.max === '' ? null : Number(el.max) });
    if (v === null || v === el.value) return false;
    el.value = v;
    return true;
  }
  if (el.tagName === 'SELECT') {
    const v = String(saved);
    if (![...el.options].some((o: any) => o.value === v) || el.value === v) return false;
    el.value = v;
    return true;
  }
  if (typeof saved === 'string' && el.value !== saved) { el.value = saved; return true; }
  return false;
}

/** Put a dialog's remembered choices back, and remember them again when it is rolled. */
function rollMemory(form: HTMLFormElement, marker: HTMLElement, okButton: HTMLElement | null): void {
  const key = marker.dataset['sr2eRemember'] ?? '';
  const fields = memoryFields(marker.dataset['fields']);
  if (!key || !fields.length) return;
  const saved = mem<RollMemory>('rollMemory', {})[key]?.v;
  if (saved) {
    for (const f of fields) {
      const el: any = form.elements.namedItem(f);
      if (!restoreField(el, saved[f])) continue;
      const target: HTMLElement | null = el instanceof RadioNodeList ? null : el;
      target?.dispatchEvent(new Event('input', { bubbles: true }));
      target?.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }
  let done = false;
  const keep = () => {
    if (done) return;
    done = true;
    const v: Record<string, string | boolean> = {};
    for (const f of fields) { const x = fieldValue(form.elements.namedItem(f)); if (x !== null) v[f] = x; }
    save('rollMemory', rememberRoll(mem<RollMemory>('rollMemory', {}), key, v));
  };
  okButton?.addEventListener('click', keep, { capture: true });
  // Enter in a field submits as the OK button; any other button (Cancel, No) doesn't keep the choices.
  form.addEventListener('submit', (ev: Event) => { const by = (ev as SubmitEvent).submitter; if (!by || by === okButton) keep(); }, { capture: true });
}

/**
 * A system dialog with a TN preview becomes a roll dialog: choices on the left, the TN breakdown on the
 * right, and one big Roll button. Numbers get − / +; a remember marker brings the last choices back.
 */
export function enhanceRollDialog(app: any, root: HTMLElement | null): void {
  if (!root?.classList?.contains('sr2e-dialog')) return;
  const form = (root.tagName === 'FORM' ? root : root.querySelector('form')) as HTMLFormElement | null;
  if (!form) return;
  const content = form.querySelector<HTMLElement>('.dialog-content') ?? form;
  const ok = form.querySelector<HTMLElement>('footer button[data-action="ok"], footer button.default, footer button[autofocus]') ?? form.querySelector<HTMLElement>('footer button');
  if (setting('numberSteppers', true)) { addSteppers(content, 'input[type="number"]'); bindWheel(content); }
  const marker = content.querySelector<HTMLElement>('[data-sr2e-remember]');
  if (marker && setting('rememberRolls', true) && !quickRollArmed(app)) rollMemory(form, marker, ok);
  const preview = content.querySelector<HTMLElement>('.sr2e-preview');
  if (!preview || content.querySelector('.sr2e-roll-grid')) return;
  root.classList.add('sr2e-roll-dialog');
  for (const name of ['pool', 'drainPool', 'hackingPool', 'controlPool', 'poolDice']) {
    content.querySelector<HTMLElement>(`[name="${name}"]`)?.closest('.form-group')?.classList.add('sr2e-pool-field');
  }
  const grid = document.createElement('div');
  grid.className = 'sr2e-roll-grid';
  const main = document.createElement('div');
  main.className = 'sr2e-roll-main';
  const side = document.createElement('div');
  side.className = 'sr2e-roll-side';
  for (const n of Array.from(content.childNodes)) if (n !== preview) main.appendChild(n);
  side.appendChild(preview);
  grid.append(main, side);
  content.appendChild(grid);
  if (ok) {
    ok.classList.add('sr2e-roll-go');
    // The dice icon in place of Foundry's own (a check mark) on the Roll button.
    const icon = ok.querySelector('i');
    if (icon) icon.className = 'fa-solid fa-dice';
    else ok.insertAdjacentHTML('afterbegin', '<i class="fa-solid fa-dice" aria-hidden="true"></i> ');
  }
  // Room for two columns when the screen has it (the CSS falls back to one column in a narrow window).
  try {
    const vw = globalThis.innerWidth || 0;
    const w = Number(app?.position?.width) || root.offsetWidth || 480;
    if (vw >= 760 && w < 680) {
      const left = Number(app?.position?.left);
      app.setPosition?.({ width: 680, ...(Number.isFinite(left) ? { left: Math.max(0, Math.min(left - (680 - w) / 2, vw - 690)) } : {}) });
    }
  } catch { /* no position */ }
}

// ---------------------------------------------------------------- grouped notifications

type NoteType = 'info' | 'warn' | 'error';
const recentNotes = new Map<string, { count: number; at: number; text: string }>();
let noteQueue: Array<{ type: NoteType; message: string; options: any }> = [];
let noteTimer: ReturnType<typeof setTimeout> | null = null;

/** Change a shown notification's text to "… (×N)"; false when it has gone. */
function bumpShownNote(text: string, count: number): boolean {
  const list = Array.from(document.querySelectorAll<HTMLElement>('#notifications .notification'));
  const el = list.reverse().find((n) => (n.textContent ?? '').includes(text));
  if (!el) return false;
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = n.nodeValue ?? '';
    if (t.includes(text)) { n.nodeValue = t.replace(/ \(×\d+\)$/, '').replace(text, repeatedText(text, count)); return true; }
  }
  return false;
}

export function registerGroupedNotes(): void {
  (Hooks as any).once('ready', () => {
    const N: any = (globalThis as any).ui?.notifications;
    if (!N || N.__sr2eGrouped) return;
    N.__sr2eGrouped = true;
    const origs: Partial<Record<NoteType, (m: unknown, o?: any) => any>> = {};
    for (const type of ['info', 'warn', 'error'] as const) {
      if (typeof N[type] !== 'function') continue;
      origs[type] = N[type].bind(N);
      // The name is looked up in the stack (look.ts calledFromSystem): an object method, so the minified build keeps it (A-16).
      const sr2eNoteWrap = ({ sr2eNoteWrap(message: unknown, options?: any) {
        let ours = false;
        try { ours = setting('groupNotes', true) && !options?.permanent && !options?.progress && calledFromSystem(new Error().stack ?? '', 'sr2eNoteWrap'); } catch { ours = false; }
        if (!ours) return origs[type]!(message, options);
        const text = String(message ?? '');
        const key = `${type}|${text}`;
        const r = recentNotes.get(key);
        if (r && Date.now() - r.at < NOTE_GROUP.repeatMs) {
          r.count++;
          r.at = Date.now();
          if (bumpShownNote(text, r.count)) return undefined;
          return origs[type]!(repeatedText(text, r.count), options);
        }
        noteQueue.push({ type, message: text, options });
        if (!noteTimer) noteTimer = setTimeout(flush, NOTE_GROUP.windowMs);
        return undefined;
      } }).sr2eNoteWrap;
      N[type] = sr2eNoteWrap;
    }
    function flush(): void {
      noteTimer = null;
      const batch = noteQueue;
      noteQueue = [];
      const now = Date.now();
      for (const out of groupNotes(batch.map((b) => ({ type: b.type, message: b.message })))) {
        const t = out.type as NoteType;
        const mine = batch.filter((b) => b.type === t);
        try { origs[t]?.(out.message, mine[0]?.options); } catch (err) { console.warn('sr2e | notification', err); }
        const texts = [...new Set(mine.map((b) => b.message))];
        if (texts.length === 1) recentNotes.set(`${t}|${texts[0]}`, { count: out.count, at: now, text: texts[0]! });
      }
      for (const [k, v] of recentNotes) if (now - v.at > NOTE_GROUP.repeatMs * 2) recentNotes.delete(k);
    }
  });
}

// ---------------------------------------------------------------- window size and position

function rememberable(app: any, root: HTMLElement | null): boolean {
  if (!setting('rememberWindows', true) || !root) return false;
  const D: any = (foundry as any).applications?.api?.DialogV2;
  if ((D && app instanceof D) || root.classList.contains('sr2e-dialog') || root.classList.contains('dialog')) return false;
  return isOurWindow(app, root);
}
function kindOf(app: any): string { return String(app?.constructor?.name ?? 'window'); }
/** A window id that means the same window next session (Foundry's counted `app-N` ids don't). */
function stableId(app: any): string { const id = String(app?.id ?? ''); return /^app-\d+$/.test(id) ? '' : id; }
function keepWindow(app: any): void {
  if (app?.minimized) return;
  const pos = app?.position ?? {};
  const id = stableId(app);
  // Without a lasting id only the kind's size is kept.
  save('windows', rememberWindow(mem<WinMemory>('windows', emptyWinMemory()), id || `~${kindOf(app)}`, kindOf(app), id ? pos : { width: pos.width, height: pos.height }));
}

export function registerWindowMemory(): void {
  const firstSeen = new WeakSet<object>();
  Hooks.on('renderApplicationV2', (app: any, el: HTMLElement, _ctx: any, options: any) => {
    const root: HTMLElement | null = el instanceof HTMLElement ? el : app?.element ?? null;
    if (!rememberable(app, root)) return;
    const first = options?.isFirstRender ?? !firstSeen.has(app);
    firstSeen.add(app);
    if (!first) return;
    try {
      const p = placeWindow(mem<WinMemory>('windows', emptyWinMemory()), stableId(app) || `~${kindOf(app)}`, kindOf(app), { width: globalThis.innerWidth || 1280, height: globalThis.innerHeight || 800 });
      if (p) app.setPosition(p);
    } catch (err) { console.warn('sr2e | window place', err); }
    // A drag of the title bar or the resize handle ends with a pointerup.
    let t: ReturnType<typeof setTimeout> | null = null;
    root!.addEventListener('pointerup', () => { if (t) clearTimeout(t); t = setTimeout(() => keepWindow(app), 250); }, { passive: true });
  });
  Hooks.on('closeApplicationV2', (app: any) => {
    try { if (rememberable(app, app?.element ?? null)) keepWindow(app); } catch { /* closing */ }
  });
}

// ---------------------------------------------------------------- settings in sections

/** Foundry's settings window: the system's own settings grouped under headings. */
export function decorateSettingsConfig(rootIn: HTMLElement): void {
  const root: HTMLElement | null = (rootIn as any)?.querySelector ? rootIn : (rootIn as any)?.[0] ?? null;
  if (!root) return;
  const keyOf = (g: HTMLElement): string => {
    const id = g.dataset['settingId'] ?? g.querySelector<HTMLElement>('[data-setting-id]')?.dataset['settingId']
      ?? g.querySelector<HTMLInputElement>('[name^="sr2e."]')?.name ?? g.querySelector<HTMLElement>('[data-key^="sr2e."]')?.dataset['key'] ?? '';
    return id.startsWith('sr2e.') ? id : '';
  };
  const groups = Array.from(root.querySelectorAll<HTMLElement>('.form-group')).filter((g) => keyOf(g));
  if (!groups.length) return;
  const parent = groups[0]!.parentElement;
  if (!parent || parent.dataset['sr2eSections']) return;
  if (groups.some((g) => g.parentElement !== parent)) return;
  parent.dataset['sr2eSections'] = '1';
  const order = [...SETTING_SECTIONS.map((s) => s.id), 'other'];
  const labels: Record<string, string> = { ...Object.fromEntries(SETTING_SECTIONS.map((s) => [s.id, s.label])), other: 'Other' };
  const bySection = new Map<string, HTMLElement[]>();
  for (const g of groups) { const s = settingSection(keyOf(g)); bySection.set(s, [...(bySection.get(s) ?? []), g]); }
  const anchor = document.createComment('sr2e settings');
  parent.insertBefore(anchor, groups[0]!);
  let at: Node = anchor;
  for (const id of order) {
    const list = bySection.get(id);
    if (!list?.length) continue;
    const h = document.createElement('h4');
    h.className = 'sr2e-settings-head';
    h.textContent = labels[id] ?? id;
    parent.insertBefore(h, at.nextSibling);
    at = h;
    for (const g of list) { parent.insertBefore(g, at.nextSibling); at = g; }
  }
}

// ---------------------------------------------------------------- registration

export function registerInterface(): void {
  Hooks.on('renderDialogV2', (app: any, html: HTMLElement) => {
    try { enhanceRollDialog(app, (html as any)?.querySelector ? html : app?.element ?? null); } catch (err) { console.warn('sr2e | roll dialog', err); }
  });
  Hooks.on('renderSettingsConfig', (_app: any, html: HTMLElement) => {
    try { decorateSettingsConfig(html); } catch (err) { console.warn('sr2e | settings sections', err); }
  });
  // The strip and "your turn" follow the combat: sheets of the people in it re-render when it moves on.
  let pending: Set<string> | null = null;
  const later = (uuids: string[] | null) => {
    if (!pending) {
      pending = new Set<string>();
      setTimeout(() => {
        const all = pending!;
        pending = null;
        rerenderActorSheets(all.has('*') ? undefined : (a: any) => all.has(a.uuid) || all.has(a.id));
      }, 120);
    }
    for (const u of uuids ?? ['*']) pending.add(u);
  };
  // Only the one who stops acting and the one who starts (not every combatant's sheet on every change).
  const acting = new Map<string, string[]>();
  const who = (c: any) => [c?.actor?.uuid, c?.actorId].filter(Boolean) as string[];
  Hooks.on('updateCombat', (combat: any, change: any) => {
    if (!change || !['turn', 'round', 'active', 'flags'].some((k) => k in change)) return;
    const now = who(combat?.combatant);
    const before = acting.get(combat.id) ?? [];
    acting.set(combat.id, now);
    later([...before, ...now]);
  });
  // The client that moves the combat on knows who acted before; the others learn it from their first update.
  Hooks.on('preUpdateCombat', (combat: any) => { if (combat?.id && !acting.has(combat.id)) acting.set(combat.id, who(combat.combatant)); });
  Hooks.on('updateCombatant', (c: any, change: any) => { if (change && 'initiative' in change) later(who(c)); });
  Hooks.on('deleteCombat', () => later(null));
  registerWindowMemory();
  registerGroupedNotes();
}
