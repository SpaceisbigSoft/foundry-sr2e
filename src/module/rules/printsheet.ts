/**
 * v0.87.0: the printable character sheet (pure: no Foundry). `applications/print.ts` gathers a `PrintSheet` from an
 * actor and prints the page this file builds, in a sandboxed frame (no scripts) or as its own browser page.
 *
 * The page is light on ink: black text on white, thin grey rules, no backgrounds; filled monitor boxes are a light
 * grey with a slash (readable in black and white). Every value is escaped here; `notes[].html` is the only HTML that
 * goes in as it is, and the glue passes it already cleaned (`cleanRichHtml`, the same cleaner the sheets use).
 */
import { escHtml } from './html.ts';
import { t as tx } from '../helpers/i18n.ts';

const esc = escHtml;

/** One condition-monitor track as the print shows it (the sheet's wound groups). */
export interface PrintTrack {
  label: string;
  filled: number;
  boxes: number;
  groups: Array<{ label: string; boxes: Array<{ value: number; filled: boolean; dead?: boolean }> }>;
}

/** A table: a heading, its column names and its rows (plain text cells). */
export interface PrintTable { title: string; columns: string[]; rows: string[][]; note?: string }

export interface PrintSheet {
  /** The character's name. */
  name: string;
  /** "Character" / "NPC" and the metatype, tradition and so on. */
  kind: string;
  /** Short label/value facts under the name (metatype, player, lifestyle, Karma…). */
  facts: Array<[string, string]>;
  /** The six attributes: label, total, the base when it differs. */
  attributes: Array<{ label: string; total: number | string; base?: number | string }>;
  /** Derived values (Essence, Magic, Reaction, Initiative, pools, armor, movement). */
  derived: Array<[string, string]>;
  /** The condition monitor; empty boxes when `blank`. */
  monitor: { physical: PrintTrack; stun: PrintTrack; overflow?: PrintTrack | null; woundNote?: string } | null;
  /** The lists: skills, weapons, armor, cyberware, spells, powers, foci, gear, contacts, qualities… (empty ones are left out). */
  tables: PrintTable[];
  /** Rich text fields (biography, notes…), already cleaned. */
  notes: Array<{ title: string; html: string }>;
  /** The footer line: the system, its version, the date. */
  footer: string;
}

export interface PrintOptions {
  /** Leave the condition monitor empty (a fresh sheet for play at the table). */
  blank?: boolean;
  /** Leave out the notes and biography. */
  noNotes?: boolean;
  /** Text for the page title (the browser shows it, and uses it as the PDF's file name). */
  title?: string;
  /**
   * Foundry's address ("http://host:30000/"), so pictures in the notes stored as Foundry paths load when the page is
   * opened on its own (a blob page or a saved file). Only an http(s) origin ending in "/" is used.
   */
  base?: string;
}

/** Pure: the base address if it is a plain http(s) origin (or origin + path) ending in "/", else ''. */
export function safeBase(v: unknown): string {
  const s = String(v ?? '');
  return /^https?:\/\/[^\s"'<>\\]+\/$/.test(s) ? s : '';
}

/** Pure: the print stylesheet (A4 and Letter both fit: 12 mm margins, two columns of tables where there is room). */
export const PRINT_CSS = `
@page { margin: 12mm; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #fff; color: #000; }
body { font: 9.5pt/1.3 "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 0; }
main { max-width: 190mm; margin: 0 auto; padding: 6mm 0; }
h1 { font-size: 18pt; margin: 0 0 1mm; letter-spacing: 0.02em; }
h2 { font-size: 10.5pt; text-transform: uppercase; letter-spacing: 0.08em; margin: 4mm 0 1.5mm; padding-bottom: 0.5mm; border-bottom: 0.6pt solid #000; break-after: avoid; }
.kind { font-size: 10pt; color: #333; margin: 0 0 2mm; }
.facts { display: flex; flex-wrap: wrap; gap: 1mm 5mm; margin: 0 0 2mm; }
.facts span b { font-weight: 600; }
.top { display: grid; grid-template-columns: 52mm 1fr; gap: 5mm; align-items: start; }
table { width: 100%; border-collapse: collapse; break-inside: auto; }
th, td { text-align: left; padding: 0.6mm 1.2mm; border-bottom: 0.3pt solid #999; vertical-align: top; }
th { font-size: 8pt; text-transform: uppercase; letter-spacing: 0.05em; color: #333; border-bottom: 0.6pt solid #000; }
tr { break-inside: avoid; }
td.n, th.n { text-align: right; font-variant-numeric: tabular-nums; }
.attrs td.n { font-size: 12pt; font-weight: 700; }
.attrs small { font-weight: 400; color: #444; font-size: 8pt; }
.derived { display: grid; grid-template-columns: repeat(auto-fill, minmax(42mm, 1fr)); gap: 0.6mm 4mm; }
.derived div { display: flex; justify-content: space-between; border-bottom: 0.3pt solid #999; padding: 0.4mm 0; }
.derived b { font-variant-numeric: tabular-nums; }
.cm { display: flex; flex-wrap: wrap; gap: 3mm 6mm; }
.track { break-inside: avoid; }
.track > b { display: block; font-size: 8pt; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.6mm; }
.groups { display: flex; gap: 1.6mm; }
.group { display: flex; flex-direction: column; align-items: center; }
.group i { font-style: normal; font-size: 7pt; color: #333; }
.boxes { display: flex; gap: 0.6mm; }
.box { width: 4.6mm; height: 4.6mm; border: 0.6pt solid #000; position: relative; }
.box.filled { background: #ddd; }
.box.filled::after { content: ""; position: absolute; inset: 0; background: linear-gradient(to top right, transparent 46%, #000 47%, #000 53%, transparent 54%); }
.box.dead { border-width: 1.2pt; }
.note { font-size: 8pt; color: #333; margin: 0.6mm 0 0; }
.tables { columns: 2 92mm; column-gap: 6mm; }
.tables section { break-inside: avoid-column; margin-bottom: 1mm; }
.tables section.wide { column-span: all; }
.rich { font-size: 9pt; }
.rich img { max-width: 60mm; max-height: 60mm; }
.rich a { color: #000; text-decoration: none; }
footer { margin-top: 5mm; font-size: 7.5pt; color: #444; border-top: 0.3pt solid #999; padding-top: 1mm; }
@media screen { body { background: #eee; } main { background: #fff; padding: 12mm; margin: 8mm auto; box-shadow: 0 0 4mm #0003; } }
@media print { a[href]::after { content: none; } }
`;

/** Tables wide enough that they get the page's full width (many columns, long text). */
const WIDE_TABLES = 4;

function trackHtml(t: PrintTrack, blank: boolean): string {
  const groups = t.groups.map((g) => `<span class="group"><span class="boxes">${g.boxes.map((b) =>
    `<span class="box${!blank && b.filled ? ' filled' : ''}${b.dead ? ' dead' : ''}" title="${esc(`${t.label} ${b.value}`)}"></span>`).join('')}</span><i>${esc(g.label)}</i></span>`).join('');
  const count = blank ? `${t.boxes}` : `${t.filled} / ${t.boxes}`;
  return `<div class="track"><b>${esc(t.label)} (${esc(count)})</b><span class="groups">${groups}</span></div>`;
}

function tableHtml(t: PrintTable): string {
  if (!t.rows.length) return '';
  // A column of numbers (blanks allowed, but at least one number) is right-aligned.
  const cell = (r: string[], i: number) => String(r[i] ?? '').trim();
  const numeric = t.columns.map((_c, i) => t.rows.some((r) => cell(r, i) !== '') && t.rows.every((r) => /^[-−+]?\d+(\.\d+)?$/.test(cell(r, i)) || cell(r, i) === ''));
  const head = t.columns.map((c, i) => `<th${numeric[i] ? ' class="n"' : ''}>${esc(c)}</th>`).join('');
  const body = t.rows.map((r) => `<tr>${t.columns.map((_c, i) => `<td${numeric[i] ? ' class="n"' : ''}>${esc(r[i] ?? '')}</td>`).join('')}</tr>`).join('');
  const wide = t.columns.length > WIDE_TABLES ? ' class="wide"' : '';
  return `<section${wide}><h2>${esc(t.title)}</h2><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>${t.note ? `<p class="note">${esc(t.note)}</p>` : ''}</section>`;
}

/** Pure: the whole printable page for a sheet. */
export function printHtml(s: PrintSheet, opts: PrintOptions = {}): string {
  const blank = Boolean(opts.blank);
  const facts = s.facts.filter(([, v]) => String(v ?? '').trim()).map(([k, v]) => `<span>${esc(k)}: <b>${esc(v)}</b></span>`).join('');
  const attrs = s.attributes.map((a) => `<tr><td>${esc(a.label)}</td><td class="n">${esc(a.total)}${a.base !== undefined && String(a.base) !== String(a.total) ? ` <small>(${esc(a.base)})</small>` : ''}</td></tr>`).join('');
  const derived = s.derived.filter(([, v]) => String(v ?? '').trim()).map(([k, v]) => `<div><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('');
  const cm = s.monitor ? `<h2>${tx('SR2E.Text.Printsheet.conditionMonitor')}</h2><div class="cm">${trackHtml(s.monitor.physical, blank)}${s.monitor.overflow ? trackHtml(s.monitor.overflow, blank) : ''}${trackHtml(s.monitor.stun, blank)}</div>${!blank && s.monitor.woundNote ? `<p class="note">${esc(s.monitor.woundNote)}</p>` : ''}` : '';
  const tables = s.tables.map(tableHtml).filter(Boolean).join('');
  const notes = opts.noNotes ? '' : s.notes.filter((n) => String(n.html ?? '').replace(/<[^>]*>/g, '').trim() || /<img\b/i.test(n.html ?? ''))
    .map((n) => `<section><h2>${esc(n.title)}</h2><div class="rich">${n.html}</div></section>`).join('');
  const title = opts.title ?? s.name;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${esc(title)}</title>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src * data: blob:; style-src 'unsafe-inline'; font-src * data:">
${safeBase(opts.base) ? `<base href="${esc(safeBase(opts.base))}">` : ''}
<style>${PRINT_CSS}</style></head>
<body><main>
<h1>${esc(s.name)}</h1>
<p class="kind">${esc(s.kind)}</p>
${facts ? `<div class="facts">${facts}</div>` : ''}
<div class="top">
<section><h2>${tx('SR2E.Text.Printsheet.attributes')}</h2><table class="attrs"><tbody>${attrs}</tbody></table></section>
<section><h2>${tx('SR2E.Text.Printsheet.derived')}</h2><div class="derived">${derived}</div>${cm}</section>
</div>
${tables ? `<div class="tables">${tables}</div>` : ''}
${notes}
<footer>${esc(s.footer)}</footer>
</main></body></html>`;
}

/** Pure: a file-name-safe title ("Jane Doe (SR2e)"). */
export function printTitle(name: string): string {
  const clean = String(name ?? '').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
  return tx('SR2E.Text.Printsheet.printTitle', { name: clean || tx('SR2E.Text.Printsheet.character') });
}

/** Pure: a PrintTrack from the sheet's TrackView/OverflowView shapes (rules/look.ts). */
export function printTrack(view: any, label?: string): PrintTrack | null {
  if (!view) return null;
  const groups = Array.isArray(view.groups)
    ? view.groups.map((g: any) => ({ label: String(g.label ?? ''), boxes: (g.boxes ?? []).map((b: any) => ({ value: Number(b.value) || 0, filled: Boolean(b.filled), dead: Boolean(b.dead) })) }))
    : [{ label: tx('SR2E.Text.Printsheet.body', { body: view.body ?? '' }).trim(), boxes:
 (view.boxes ?? []).map((b: any) => ({ value: Number(b.value) || 0, filled: Boolean(b.filled), dead: Boolean(b.dead) })) }];
  const all = groups.flatMap((g: any) => g.boxes);
  return {
    label: label ?? String(view.label ?? ''),
    filled: Number(view.filled ?? all.filter((b: any) => b.filled).length) || 0,
    boxes: Array.isArray(view.boxes) ? view.boxes.length : (Number(view.boxes ?? view.body) || all.length),
    groups,
  };
}
