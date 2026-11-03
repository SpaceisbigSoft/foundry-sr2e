// SEC2 second pass: patterns the ratchet scanner should flag. Each `actor.name`-like value is player text.
import { escHtml } from '../../rules/html.ts';
declare const actor: any;
declare const el: HTMLElement;
declare const RULES: any;
interface A { name: string; nick?: string; tags: string[] }
declare const a: A;
const e = (x: unknown) => String(x);                 // not an escaper, but named like one
const attr = (x: unknown) => String(x);
const escHtmlLoose = (x: unknown) => String(x);

export function p01() { el.innerHTML = actor.name; }                                   // bare sink, no template
export function p02() { el.innerHTML = ['<b>', a.name, '</b>'].join(''); }             // array-built HTML
export function p03() { el.innerHTML = '<b>'.concat(a.name, '</b>'); }                 // String#concat
export function p04() { const open = '<b>', close = '</b>'; el.innerHTML = `${open}${a.name}${close}`; } // markup only in vars
export function p05() { return `<p>${'' + a.name}</p>`; }                              // starts with a quote -> "constant"
export function p06() { const nm = a.nick; return `<p>${nm}</p>`; }                    // string | undefined, neutral name
export function p07() { return `<p>${e(a.name)}</p>`; }                                // fake escaper named e
export function p08() { return `<p>${attr(a.name)}</p>`; }                             // fake escaper named attr
export function p09() { return `<p>${escHtmlLoose(a.name)}</p>`; }                     // name contains escHtml
export function p10() { return `<p>${a.name.replace(/"/g, '&quot;')}</p>`; }           // quote-only "escape" in text
export function p11() { return `<p>${RULES.X ?? a.name}</p>`; }                        // starts with RULES
export function p12() { return `<p>${a.name.toLocaleString()}</p>`; }                  // toLocaleString => "number"
export function p13() { const xs = a.tags; return `<p>${xs}</p>`; }                    // string[] neutral name
export function p14() { return `<p>${a.name as unknown as number}</p>`; }              // cast to number
export function p15() { el.insertAdjacentHTML('beforeend', a.name); }                  // sink with plain arg
export function p16() { const q = `${a.name}`; el.innerHTML = `<i>${q}</i>`; }          // no-markup template var: should be followed
export function p17() { ui.notifications.warn(`${a.name} is gone`); }                  // notification with name (no markup)
export function p18() { const s = String(a.name); return `<p>${s}</p>`; }              // String() wrapper
export function p19() { return `<p>${a.tags.join(', ')}</p>`; }                        // join of names
export function p20() { const t = a.name.trim(); return `<p>${t}</p>`; }               // trimmed
export function p21() { return `<p>${`${a.name}`}</p>`; }                              // nested no-markup template
export function p22() { return `<p>${[a.name].map(String).join('')}</p>`; }            // map(String)
export function p23() { return `<p>${a.name || 'x'}</p>`; }
export function p24() { return `<p title=${escHtml(a.name)}>x</p>`; }                  // unquoted attribute with escHtml
export function p25() { return `<a href="${escHtml(a.name)}">x</a>`; }                 // javascript: URL survives escaping
declare const ui: any;
