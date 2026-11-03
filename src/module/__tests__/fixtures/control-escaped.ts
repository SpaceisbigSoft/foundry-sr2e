// v0.81.1 scanner control: every pattern here is correctly escaped or safe, so the scanner must report no `fix` row.
// Scanned only by v0811-scan.test.ts (fixtures are outside the normal scan).
import { escHtml } from '../../rules/html.ts';
import { escHtml as escAlias } from '../../rules/html.ts';
import { RULES } from '../../rules/config.ts';

const esc = escHtml;
const wrap = (t: unknown): string => escHtml(t);
function wrapDefault(t: unknown): string { return escHtml(t ?? ''); }
const LABELS = { a: 'Alpha', b: '<b>Beta</b>' };
interface A { name: string; nick?: string; tags: string[]; count: number; ratio: number }
declare const a: A;
declare const el: HTMLElement;
declare const game: { i18n: { localize(k: string): string; format(k: string, d?: Record<string, unknown>): string } };
declare const ui: { notifications: { warn(m: string): void; info(m: string): void } };
declare const ChatMessage: { create(d: Record<string, unknown>): Promise<unknown> };

function row(label: string, value: number): string { return `<tr><td>${escHtml(label)}</td><td>${value}</td></tr>`; }

export function c01() { return `<p>${escHtml(a.name)}</p>`; }
export function c02() { return `<p>${esc(a.name)} ${escAlias(a.nick)}</p>`; }
export function c03() { return `<p>${wrap(a.name)} ${wrapDefault(a.nick)}</p>`; }
export function c04() { return `<p>${a.count} ${a.ratio.toFixed(1)} ${a.count.toLocaleString()} ${Math.round(a.ratio)}</p>`; }
export function c05() { return `<p title="${escHtml(a.name)}">${RULES.MAGIC_V56.learning.skill}</p>`; }
export function c06() { return `<p>${game.i18n.localize('SR2E.Armor')} ${game.i18n.format('SR2E.X', { n: a.count })}</p>`; }
export function c07() { return `<a href="#${escHtml(a.name)}">x</a><img src="systems/sr2e/${escHtml(a.nick)}.webp">`; }
export function c08() { el.innerHTML = `<b>${escHtml(a.name)}</b>`; }
export function c09() { el.insertAdjacentHTML('beforeend', `${escHtml(a.name)} was here`); }
export function c10() { const parts = a.tags.map((t) => `<li>${escHtml(t)}</li>`); return `<ul>${parts.join('')}</ul>`; }
export function c11() { return `<table>${row(a.name, a.count)}</table>`; }
export function c12() { ui.notifications.warn(`${escHtml(a.name)} is gone (${a.count})`); }
export function c13() { return `<p>${a.tags.map(escHtml).join(', ')}</p>`; }
export function c14() { return '<b>' + escHtml(a.name) + '</b>' + a.count; }
export function c15() { return `<p>${RULES.MAGIC_V56.learning.enabled ? `<i>${escHtml(a.name)}</i>` : ''}</p>`; }
export function c16() { const k: 'a' | 'b' = a.count ? 'a' : 'b'; return `<p>${LABELS[k]} ${LABELS.a}</p>`; }
export function c17() { const note = `<em>${escHtml(a.nick)}</em>`; return ChatMessage.create({ content: `<p>${note}</p>`, flavor: escHtml(a.name) }); }
export function c18() { const s = String(a.count); return `<p>${s} ${'' + a.count} ${`${a.count}`}</p>`; }
