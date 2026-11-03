// v0.89.1 scanner probe for translations: lines marked BAD must give a `fix` row, lines marked OK must not.
// Scanned only by v0891.test.ts (fixtures are outside the normal scan).
import { escHtml } from '../../rules/html.ts';
import { t as tx, tHtml, tCount } from '../../helpers/i18n.ts';

declare const ui: { notifications: { warn(m: string): void; info(m: string): void } };
declare const raw: string;
declare const n: number;
declare const anyN: any;
declare const key: string;
declare const data: Record<string, unknown>;
declare const el: HTMLElement;

export function probes(): void {
  ui.notifications.warn(tx('SR2E.Notify.X.a', { name: raw })); // BAD raw value
  ui.notifications.warn(tx('SR2E.Notify.X.a', { name: escHtml(raw) })); // OK escaped
  ui.notifications.warn(tx('SR2E.Notify.X.a', { n })); // OK number (shorthand)
  ui.notifications.warn(tx('SR2E.Notify.X.a', { n: anyN })); // BAD any
  ui.notifications.warn(tx(key)); // BAD key not a literal
  ui.notifications.warn(tx('SR2E.Notify.X.a', data)); // BAD data not a literal
  ui.notifications.warn(tx('SR2E.Notify.X.a', { part: n ? tx('SR2E.Notify.X.b', { who: raw }) : '' })); // BAD raw value in a nested translation
  ui.notifications.warn(tx('SR2E.Notify.X.a', { part: n ? tx('SR2E.Notify.X.b', { who: escHtml(raw) }) : '' })); // OK nested, escaped
  ui.notifications.warn(tHtml('SR2E.Notify.X.a', { name: raw })); // OK tHtml escapes its values
  ui.notifications.warn(tHtml(raw)); // BAD tHtml with a key that isn't a literal gives the key back unescaped
  ui.notifications.warn(`<b>${tHtml(key)}</b>`); // BAD the same inside a template
  ui.notifications.info(tx('SR2E.Notify.X.a', { c: tCount(n, 'SR2E.Count.row') })); // OK counted
  ui.notifications.info(tx('SR2E.Notify.X.a', { c: tCount(anyN, 'SR2E.Count.row') })); // BAD any count
  ui.notifications.info(tx('SR2E.Notify.X.a', { c: tCount(n, 'SR2E.Count.row', { w: raw }) })); // BAD raw extra value

  // v0.89.2: a translation written into HTML: each value is judged as its own row (under its own expression)
  el.innerHTML = `<p>${tx('SR2E.Dialog.X.a', { name: raw })}</p>`; // HTML-BAD raw
  el.innerHTML = `<p>${tx('SR2E.Dialog.X.a', { name: escHtml(raw) })}</p>`; // HTML-OK escaped
  el.innerHTML = `<p title="${tx('SR2E.Dialog.X.a', { n })}">${tx('SR2E.Dialog.X.b')}</p>`; // HTML-OK number in an attribute
  el.innerHTML = `<p>${n ? tx('SR2E.Dialog.X.a') : raw}</p>`; // HTML-BAD2 raw in the other branch
  el.innerHTML = `<p>${raw ?? tx('SR2E.Dialog.X.a')}</p>`; // HTML-BAD3 raw before a ?? default
}
