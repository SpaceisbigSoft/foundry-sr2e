/**
 * v0.86.0: keyboard and screen-reader support for the system's own windows and chat cards.
 *
 * Most of the sheets' small controls are `<a data-action>` links without an address: a browser neither lets the Tab key
 * reach them nor lets Enter press them. Rather than rewrite some 330 of them by hand, every render of an SR2e window
 * or chat card passes through `enhance`, which:
 *   - gives each such control `tabindex="0"`, `role="button"` and the marker `data-sr2e-kb`;
 *   - names a control that has no text of its own (an icon) from its tooltip (`aria-label`), and hides its icon from
 *     screen readers;
 *   - makes the condition monitor's boxes and the status strip's pool pips one Tab stop per track, moved with the
 *     arrow keys (a "roving" tab stop), and says which boxes are filled;
 *   - marks foldable headings with `aria-expanded`.
 * One keydown listener presses a marked control on Enter or Space (Shift+Enter is a Shift-click: a quick roll), and
 * stops the key there, so Space never reaches Foundry's own Pause key while a control has the focus.
 *
 * Sheets re-render after nearly every change, which throws the keyboard focus away. `rememberFocus` notes which control
 * was pressed (by its data attributes, `focusKey`), and the next render of the same window or chat card puts the
 * focus back on it, as long as the focus was lost meanwhile (a dialog that opened keeps it). A dialog hands the focus
 * back to the control that opened it when it closes.
 *
 * The Foundry-free parts are pure functions, tested in `__tests__/v086.test.ts`.
 */

import { t as tx } from '../helpers/i18n.ts';

/** The controls the system wires up itself (Foundry's `data-action`, our chat-card buttons, and a few made in code). */
export const KB_SELECTOR = [
  '[data-action]', '[data-sr2e-action]', '[data-sr2e-jump]', '[data-sr2e-help]',
  'a.sr2e-pan', 'a.sr2e-inline-test', 'a.sr2e-ic-act', '.sr2e-hr-fold',
].join(', ');

/** Anything inside an element that is a control of its own (so the element must not become a button around it). */
const INNER_CONTROLS = 'button, input, select, textarea, a[href], [data-action], [data-sr2e-action], [data-sr2e-help], [data-sr2e-jump], a.sr2e-inline-test, a.sr2e-pan, [role="button"], [tabindex]';

/** Elements the browser already lets the keyboard reach and press. */
const NATIVE_TAGS = new Set(['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'OPTION', 'SUMMARY']);
/** Things that are never a control even with an action attribute (the window's own form, whole sections). */
const NEVER_TAGS = new Set(['FORM', 'SECTION', 'ARTICLE', 'BODY', 'HTML', 'NAV', 'UL', 'OL', 'TABLE', 'TBODY', 'FIELDSET']);

/** A minimal element shape, so the pure helpers can be tested without a DOM. */
export interface ElLike {
  tagName: string;
  getAttribute(name: string): string | null;
  hasAttribute(name: string): boolean;
  textContent: string | null;
  querySelector?(sel: string): unknown;
}

/** Pure: whether the element needs the keyboard shim (it isn't natively focusable and pressable). */
export function needsKeyboard(el: ElLike): boolean {
  const tag = String(el.tagName ?? '').toUpperCase();
  if (NATIVE_TAGS.has(tag) || NEVER_TAGS.has(tag)) return false;
  if (tag === 'A' && el.hasAttribute('href')) return false;
  if (el.hasAttribute('contenteditable')) return false;
  // A container that holds its own controls would nest buttons: leave it to its children.
  if (/^H[1-6]$/.test(tag)) return false; // a heading stays a heading (its fold arrow is the button)
  if (el.querySelector?.(INNER_CONTROLS)) return false;
  return true;
}

/** Pure: the text a screen reader would already read for the element (its label, else its own text). */
export function accessibleName(el: ElLike): string {
  const label = el.getAttribute('aria-label');
  if (label && label.trim()) return label.trim();
  if (el.hasAttribute('aria-labelledby')) return '(labelled)';
  if (String(el.tagName).toUpperCase() === 'IMG') return String(el.getAttribute('alt') ?? '').trim();
  return String(el.textContent ?? '').replace(/\s+/g, ' ').trim();
}

/** Pure: plain text from a tooltip that may hold a little HTML (Foundry's `data-tooltip`). */
export function plainText(s: string | null | undefined): string {
  return String(s ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ').trim();
}

/** Pure: the label for a control with no name of its own (from its tooltip or title), or null when it has one. */
export function labelFor(el: ElLike): string | null {
  if (accessibleName(el)) return null;
  const from = plainText(el.getAttribute('data-tooltip')) || plainText(el.getAttribute('title'));
  return from || null;
}

/** The data attributes that identify a control within its window (enough to find it again after a re-render). */
const KEY_ATTRS = ['data-action', 'data-sr2e-action', 'data-sr2e-jump', 'data-item-id', 'data-id', 'data-track', 'data-value', 'data-pool',
  'data-index', 'data-type', 'data-kind', 'data-attribute', 'data-tab', 'data-delta', 'data-key', 'data-uuid', 'data-fold-key', 'data-spec'];

/** CSS.escape where the browser has it (a newline or bracket in a player-written value can't break the selector). */
function cssEscape(v: string): string {
  const css = (globalThis as any).CSS;
  if (css?.escape) return css.escape(v);
  return v.replace(/["\\]/g, '\\$&').replace(/[\n\r\f]/g, (c) => `\\${c.charCodeAt(0).toString(16)} `);
}

/** Pure: a CSS selector that finds the same control again after its window re-renders, or null for an anonymous one. */
export function focusKey(el: ElLike): string | null {
  const parts: string[] = [];
  for (const a of KEY_ATTRS) {
    const v = el.getAttribute(a);
    if (v !== null) parts.push(`[${a}="${cssEscape(String(v))}"]`);
  }
  if (!parts.length) return null;
  return `${String(el.tagName).toLowerCase()}${parts.join('')}`;
}

/** Pure: which item of a roving group takes the Tab stop: the last filled one, else the first. */
export function rovingStop(filled: boolean[]): number {
  if (!filled.length) return -1;
  const last = filled.lastIndexOf(true);
  return last >= 0 ? last : 0;
}

/** Pure: where an arrow key (or Home/End) moves the focus in a roving group of n items, or null for other keys. */
export function rovingMove(key: string, i: number, n: number): number | null {
  if (n <= 0) return null;
  switch (key) {
    case 'ArrowRight': case 'ArrowDown': return Math.min(n - 1, i + 1);
    case 'ArrowLeft': case 'ArrowUp': return Math.max(0, i - 1);
    case 'Home': return 0;
    case 'End': return n - 1;
    default: return null;
  }
}

/** Groups whose items share one Tab stop: the container and its items. */
const ROVING: Array<{ group: string; item: string; on: string; say: boolean }> = [
  { group: '.sr2e-cm-track', item: '.sr2e-box[data-track]', on: 'filled', say: true },
  { group: '.sr2e-strip-pool', item: '.sr2e-pip', on: 'filled', say: true },
  // A window's tab row: one Tab stop (the open tab), the arrow keys move along it, Enter or Space opens one.
  { group: '[role="tablist"][data-sr2e-tabs]', item: '[role="tab"]', on: 'active', say: false },
];

/** Tab rows: Foundry's `data-action="tab"` links and the GM panel's own tabs. */
const TAB_ITEMS = 'a[data-action="tab"], a[data-action="gmTab"], button[data-action="gmTab"]';

// ---------------------------------------------------------------- glue

/** Make one rendered root (a window, a chat card) usable from the keyboard and readable by a screen reader. */
export function enhance(root: HTMLElement | null | undefined): void {
  if (!root?.querySelectorAll) return;
  for (const tab of Array.from(root.querySelectorAll<HTMLElement>(TAB_ITEMS))) {
    const nav = tab.parentElement;
    if (nav && (!nav.hasAttribute('role') || nav.hasAttribute('data-sr2e-tabs'))) { nav.setAttribute('role', 'tablist'); nav.setAttribute('data-sr2e-tabs', ''); }
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-selected', String(tab.classList.contains('active')));
  }
  const list: HTMLElement[] = Array.from(root.querySelectorAll<HTMLElement>(KB_SELECTOR));
  if (root.matches?.(KB_SELECTOR)) list.unshift(root);
  for (const el of list) {
    if (needsKeyboard(el as unknown as ElLike)) {
      if (!el.hasAttribute('tabindex')) el.tabIndex = 0;
      if (!el.hasAttribute('role')) el.setAttribute('role', 'button');
      el.setAttribute('data-sr2e-kb', '');
    }
    // Native buttons and links too: an icon-only one gets its tooltip as its name.
    const label = labelFor(el as unknown as ElLike);
    if (label) el.setAttribute('aria-label', label);
    for (const icon of Array.from(el.querySelectorAll<HTMLElement>('i[class*="fa-"]'))) {
      if (!icon.hasAttribute('aria-hidden')) icon.setAttribute('aria-hidden', 'true');
    }
  }
  // Header and other icon buttons that Foundry or our code made without a name.
  for (const b of Array.from(root.querySelectorAll<HTMLElement>('button, a[href]'))) {
    const label = labelFor(b as unknown as ElLike);
    if (label) b.setAttribute('aria-label', label);
  }
  for (const { group, item, on, say } of ROVING) {
    const groups: HTMLElement[] = Array.from(root.querySelectorAll<HTMLElement>(group));
    if (root.matches?.(group)) groups.unshift(root);
    for (const g of groups) {
      const items = Array.from(g.querySelectorAll<HTMLElement>(item));
      if (!items.length) continue;
      const stop = rovingStop(items.map((x) => x.classList.contains(on)));
      items.forEach((x, i) => {
        x.tabIndex = i === stop ? 0 : -1;
        x.setAttribute('data-sr2e-roving', '');
        if (!say) return;
        const filled = x.classList.contains(on);
        const base = x.getAttribute('data-sr2e-label') ?? accessibleName(x as unknown as ElLike) ?? '';
        if (!x.hasAttribute('data-sr2e-label')) x.setAttribute('data-sr2e-label', base);
        x.setAttribute('aria-label', `${base}${filled ? ' (filled)' : ''}`);
      });
    }
  }
  for (const h of Array.from(root.querySelectorAll<HTMLElement>('.sr2e-foldable, .sr2e-hr-fold'))) {
    const folded = h.classList.contains('sr2e-folded') || Boolean(h.parentElement?.classList.contains('sr2e-folded') && h.tagName === 'LEGEND');
    if (h.hasAttribute('data-sr2e-kb')) { h.setAttribute('aria-expanded', String(!folded)); continue; }
    // A foldable heading stays a heading (and may hold its own buttons, the ? link): its caret is the fold button.
    const caret = h.querySelector<HTMLElement>(':scope > .sr2e-caret');
    if (!caret) continue;
    caret.removeAttribute('aria-hidden');
    caret.tabIndex = 0;
    caret.setAttribute('role', 'button');
    caret.setAttribute('data-sr2e-kb', '');
    caret.setAttribute('aria-expanded', String(!folded));
    caret.setAttribute('aria-label', tx('SR2E.Dialog.A11y.foldOrUnfold', { heading: String(h.textContent ?? '').replace(/\s+/g, ' ').replace(/\?$/, '').trim() }));
  }
}

/** Where the focus should go back to after the next render. */
interface Pending { key: string | null; el: HTMLElement; appId: string | null; messageId: string | null; until: number; at: number }
let pending: Pending | null = null;
/** The control that opened each open dialog (by the dialog's id). */
const openers = new Map<string, Pending>();

const FOCUS_HOLD_MS = 4000;

/** Note the control being pressed, so the next re-render can give it the focus back. */
export function rememberFocus(el: HTMLElement): void {
  pending = {
    key: focusKey(el as unknown as ElLike),
    el,
    appId: el.closest<HTMLElement>('.application')?.id ?? null,
    messageId: el.closest<HTMLElement>('[data-message-id]')?.dataset['messageId'] ?? null,
    until: Date.now() + FOCUS_HOLD_MS,
    at: Date.now(),
  };
}

/** Whether the keyboard focus is lost (on the page itself, or on an element a re-render removed). */
function focusLost(): boolean {
  const a = document.activeElement as HTMLElement | null;
  // A button disabled after its press keeps no focus in some browsers and a stale one in others.
  return !a || a === document.body || a === document.documentElement || !a.isConnected || Boolean((a as HTMLButtonElement).disabled);
}

/** Put the focus back on the remembered control inside this root, if the focus was lost meanwhile. */
function restoreInto(root: HTMLElement | null | undefined, p: Pending | null): boolean {
  if (!root || !p || Date.now() > p.until || !focusLost()) return false;
  // In order of preference (querySelector with a list would take document order: the message's Delete link first).
  const picks = ['.message-content button:not([disabled])', '.window-content button:not([disabled])', '.message-content [data-sr2e-kb][tabindex="0"]',
    '.window-content [data-sr2e-kb][tabindex="0"]', 'button:not([disabled]):not(.header-control)'];
  let target: HTMLElement | null = p.el.isConnected && root.contains(p.el) ? p.el : null;
  if (!target && p.key) {
    try { target = root.querySelector<HTMLElement>(p.key); } catch { target = null; }
  }
  if (!target || (target as HTMLButtonElement).disabled) {
    // The control is gone (a used chat button): the nearest control in the same card or window.
    target = null;
    for (const sel of picks) { target = root.querySelector<HTMLElement>(sel); if (target) break; }
  }
  if (!target) return false;
  try { target.focus({ preventScroll: false }); } catch { return false; }
  return document.activeElement === target;
}

/** After every other render hook (the help links, the HUD and tracker buttons are added by hooks of their own). */
function later(fn: () => void): void {
  queueMicrotask(() => { try { fn(); } catch (err) { console.warn('sr2e | accessibility', err); } });
}

function onWindowRender(root: HTMLElement): void {
  enhance(root);
  const p = pending;
  if (p && p.appId && root.id === p.appId) {
    // After Foundry has put the new parts in place.
    setTimeout(() => { restoreInto(document.getElementById(p.appId!), p); }, 0);
  }
}

/**
 * Pure: whether a rendered card may take back the focus after a key press on a chat card: the pressed card itself, or
 * a card this user posted after the press (a re-roll, a Defend card). Never someone else's card (it could be planted).
 */
export function cardTakesFocus(p: { messageId: string | null; at: number; until: number } | null, message: { id?: string; isAuthor?: boolean; timestamp?: number } | null | undefined, now: number): boolean {
  if (!p?.messageId || !message?.id || now > p.until) return false;
  if (message.id === p.messageId) return true;
  return Boolean(message.isAuthor) && Number(message.timestamp ?? 0) >= p.at - 1000;
}

function onCardRender(message: any, html: HTMLElement): void {
  enhance(html);
  const p = pending;
  const messageId: string | undefined = message?.id;
  // The pressed card's own update, or a new card of yours the press posted, when the pressed button went dead.
  if (p && messageId && cardTakesFocus(p, message, Date.now())) {
    setTimeout(() => {
      const card = document.querySelector<HTMLElement>(`#chat .chat-log [data-message-id="${messageId}"], .chat-log [data-message-id="${messageId}"], [data-message-id="${messageId}"]`);
      restoreInto(card, p);
    }, 50);
  }
}

function safeMatches(el: Element, sel: string): boolean {
  try { return el.matches(sel); } catch { return false; }
}

/** Mark the tab as the selected one of its row, and the row's one Tab stop. */
function syncTabs(tab: HTMLElement): void {
  for (const t of Array.from(tab.parentElement?.querySelectorAll<HTMLElement>(':scope > [role="tab"]') ?? [])) {
    const on = t === tab;
    t.tabIndex = on ? 0 : -1;
    t.setAttribute('aria-selected', String(on));
  }
}

/**
 * A Foundry window that only shows some of our content (the chat log's cards, the combat tracker's buttons, a journal
 * with inline tests): only those parts are enhanced, never Foundry's own tabs and controls around them.
 */
function enhanceParts(root: HTMLElement): void {
  const parts = Array.from(root.querySelectorAll<HTMLElement>('.sr2e-card, [class*="sr2e"], [data-sr2e-action]'));
  let last: HTMLElement | null = null;
  for (const part of parts) {
    if (last && last.contains(part)) continue;
    last = part;
    enhance(part);
  }
}

/** Whether a rendered window belongs to the system (our classes, or a dialog showing our content). */
export function isOurWindow(root: { classList?: { contains(c: string): boolean }; querySelector?(s: string): unknown } | null | undefined): boolean {
  if (!root?.classList) return false;
  if (['sr2e', 'sr2e-gm-panel', 'sr2e-look', 'sr2e-dialog'].some((c) => root.classList!.contains(c))) return true;
  return Boolean(root.querySelector?.('[class*="sr2e"], [data-sr2e-action], [data-sr2e-jump]'));
}

/** The first field a keyboard user wants in a freshly opened dialog: an input, else the default button. */
function focusDialog(root: HTMLElement): void {
  if (root.contains(document.activeElement)) return;
  const field = root.querySelector<HTMLElement>('.window-content input:not([type="hidden"]):not([disabled]), .window-content select:not([disabled]), .window-content textarea:not([disabled])');
  const button = root.querySelector<HTMLElement>('footer button[autofocus], footer button.default, footer button[data-action="ok"], footer button');
  (field ?? button)?.focus?.();
}

let registered = false;

export function registerAccessibility(): void {
  if (registered) return;
  registered = true;
  Hooks.on('renderApplicationV2', (app: any, el: unknown) => {
    const root: HTMLElement | null = el instanceof HTMLElement ? el : app?.element ?? null;
    if (!root) return;
    // A dialog that just opened from one of our controls: remember the control, and give the dialog the focus.
    const isDialog = app instanceof (foundry as any).applications.api.DialogV2;
    if (isDialog && root.id && !openers.has(root.id)) {
      const a = document.activeElement as HTMLElement | null;
      // Only after keyboard use: a pending press (made by a key), or a focused control that shows its focus ring
      // (:focus-visible; a button merely clicked with the mouse doesn't), so mouse users' focus is never moved.
      const from: Pending | null = pending && Date.now() <= pending.until ? pending
        : a && a !== document.body && !root.contains(a) && a.closest(SCOPE) && safeMatches(a, ':focus-visible') ? {
          key: focusKey(a as unknown as ElLike), el: a, appId: a.closest<HTMLElement>('.application')?.id ?? null,
          messageId: a.closest<HTMLElement>('[data-message-id]')?.dataset['messageId'] ?? null, until: 0, at: Date.now(),
        } : null;
      if (from) {
        openers.set(root.id, from);
        setTimeout(() => { try { focusDialog(root); } catch { /* closed */ } }, 0);
      }
    }
    later(() => {
      if (isOurWindow(root)) onWindowRender(root);
      else enhanceParts(root);
    });
  });
  Hooks.on('closeApplicationV2', (app: any) => {
    const id = app?.id ?? app?.element?.id;
    const from = id ? openers.get(id) : undefined;
    if (!from) return;
    openers.delete(id);
    // Back to the control that opened the dialog, and keep watching: the roll usually re-renders its window.
    pending = { ...from, until: Date.now() + FOCUS_HOLD_MS };
    setTimeout(() => {
      if (!focusLost()) return;
      const root = from.appId ? document.getElementById(from.appId)
        : from.messageId ? document.querySelector<HTMLElement>(`.chat-log [data-message-id="${from.messageId}"]`) : null;
      if (from.el.isConnected) { try { from.el.focus(); return; } catch { /* gone */ } }
      restoreInto(root, pending);
    }, 0);
  });
  Hooks.on('renderChatMessageHTML', (message: any, html: HTMLElement) => {
    // Checked after the other hooks: the target links and inline tests are added by them.
    later(() => { if (html?.querySelector?.('[data-sr2e-action], [class*="sr2e"]')) onCardRender(message, html); });
  });
  document.addEventListener('keydown', onKeydown);
  // A mouse or touch press ends any keyboard focus bookkeeping: nothing moves a mouse user's focus.
  document.addEventListener('pointerdown', () => { pending = null; }, true);
  // Tab rows follow a switch made either way (a click, or Enter on a tab).
  document.addEventListener('click', (ev) => {
    const tab = (ev.target as HTMLElement | null)?.closest?.('[data-sr2e-tabs] > [role="tab"]') as HTMLElement | null;
    if (tab) syncTabs(tab);
  });
}

/** The scope where Space and the arrow keys belong to our controls, not to Foundry's canvas keys. */
const SCOPE = '.sr2e, .sr2e-gm-panel, .sr2e-look, .chat-message, #token-hud';

/** Pure: whether a key press on this element is typing (text fields keep every key). */
export function isTyping(el: { tagName?: string; isContentEditable?: boolean; getAttribute?(n: string): string | null } | null | undefined): boolean {
  if (!el) return false;
  const tag = String(el.tagName ?? '').toUpperCase();
  if (tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable) return true;
  if (tag !== 'INPUT') return false;
  const type = String(el.getAttribute?.('type') ?? 'text').toLowerCase();
  return !['button', 'submit', 'reset', 'checkbox', 'radio', 'range', 'color', 'file', 'image'].includes(type);
}

function onKeydown(ev: KeyboardEvent): void {
  const target = ev.target as HTMLElement | null;
  if (!target?.closest || ev.altKey || ev.ctrlKey || ev.metaKey || ev.isComposing || isTyping(target)) return;
  // Only where the keyboard put the focus (the ring shows): a control that has it from a mouse click (now focusable,
  // so it keeps it) leaves Space to Foundry's Pause and the arrow keys to the canvas, as before.
  if (!safeMatches(target, ':focus-visible')) return;
  if (ev.defaultPrevented) {
    // A control with its own key handler (a folding heading) took the key: Space still mustn't pause the game.
    if ((ev.key === ' ' || ev.key === 'Enter') && target.closest(SCOPE)) ev.stopPropagation();
    return;
  }
  // Roving groups: the arrow keys move along the track.
  if (target.hasAttribute('data-sr2e-roving')) {
    const group = target.parentElement?.closest<HTMLElement>(ROVING.map((r) => r.group).join(', '));
    const spec = ROVING.find((r) => group?.matches(r.group));
    if (group && spec) {
      const items = Array.from(group.querySelectorAll<HTMLElement>(spec.item));
      const to = rovingMove(ev.key, items.indexOf(target), items.length);
      if (to !== null) {
        ev.preventDefault();
        ev.stopPropagation();
        items.forEach((x, i) => { x.tabIndex = i === to ? 0 : -1; });
        items[to]?.focus();
        return;
      }
    }
  }
  if (ev.key !== 'Enter' && ev.key !== ' ' && ev.key !== 'Spacebar') return;
  if (target.hasAttribute('data-sr2e-kb')) {
    ev.preventDefault();
    ev.stopPropagation();
    if (ev.repeat) return;
    rememberFocus(target);
    target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, shiftKey: ev.shiftKey, view: window }));
    return;
  }
  // A native button or link of ours that the keyboard reached (its focus ring shows): the browser presses it; keep
  // Space away from Foundry's Pause key, and remember it. A button that has the focus only from a mouse click is left
  // alone, so Space still pauses the game as before.
  if (target.matches('button, a[href]') && target.closest(SCOPE) && safeMatches(target, ':focus-visible')) {
    if (ev.key !== 'Enter') ev.stopPropagation();
    rememberFocus(target);
  }
}
