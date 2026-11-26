/**
 * v0.93.4 (report item 49): Foundry's own tooltips in SR2e's windows and cards, in place of the browser's. The
 * templates keep their `title` attributes (about a thousand of them); the moment the pointer or the keyboard reaches
 * one inside SR2e's windows, its text moves to Foundry's tooltip attributes, before Foundry's tooltip manager looks.
 * - `data-tooltip-text` carries the plain text; `data-tooltip` an escaped copy (whichever Foundry reads, it is
 *   shown as text, never as markup: titles can hold item and actor names).
 * - An icon with no words of its own keeps the text as its `aria-label`.
 * - Popped-out windows keep the browser's tooltips (Foundry's tooltip lives in the main page only).
 */
import { escHtml } from '../rules/html.ts';
import { isPoppedOut } from '../helpers/docs.ts';

/** Where the titles move: SR2e's windows, dialogs, chat cards and hover cards. */
export const TOOLTIP_SCOPE = '.sr2e, .sr2e-look, .sr2e-dialog, .sr2e-card, .sr2e-hover-card, .sr2e-gm-panel';

export interface TipEl {
  getAttribute(n: string): string | null;
  setAttribute(n: string, v: string): void;
  removeAttribute(n: string): void;
  textContent: string | null;
}

/** Moves one element's title into Foundry's tooltip attributes (pure enough for the tests). Returns whether it moved. */
export function moveTitle(el: TipEl): boolean {
  const title = el.getAttribute('title');
  if (title === null) return false;
  el.removeAttribute('title');
  const text = title.trim();
  if (!text) return false;
  el.setAttribute('data-tooltip-text', text);
  el.setAttribute('data-tooltip', escHtml(text));
  if (!el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby') && !(el.textContent ?? '').trim()) el.setAttribute('aria-label', text);
  return true;
}

function onReach(ev: Event): void {
  const t = ev.target as HTMLElement | null;
  const el = t?.closest?.('[title]') as HTMLElement | null;
  if (!el || isPoppedOut(el) || !el.closest(TOOLTIP_SCOPE)) return;
  // Foundry's window header and its own controls keep what they have.
  if (el.closest('.window-header') && !el.closest('.window-content')) return;
  moveTitle(el);
}

let registered = false;

/** In the main page: pointerover comes before pointerenter (Foundry's tooltip manager listens to the latter). */
export function registerFoundryTooltips(): void {
  if (registered || typeof document === 'undefined') return;
  registered = true;
  document.addEventListener('pointerover', onReach, true);
  document.addEventListener('focusin', onReach, true);
}
