/**
 * v0.59.0: rich text. The HTML fields (biography, notes, powers, weaknesses, descriptions) are edited with
 * Foundry's ProseMirror editor and shown enriched (@UUID links, inline rolls, secrets for owners).
 */
import { SYSTEM_ID } from "../config/system.ts";
import { escHtml } from '../rules/html.ts';

/** The HTML fields a sheet may show, by their key under `system`. */
export const RICH_FIELDS = ['biography', 'notes', 'powers', 'weaknesses', 'description'] as const;

function textEditor(): any {
  return (globalThis as any).foundry?.applications?.ux?.TextEditor?.implementation ?? null;
}

/**
 * Elements a cleaned rich-text field never keeps: scripts and embeds, and (v0.81.1, SEC2b-4, design 7) every form
 * control (an `<input name="ownership.default">` in a biography joined the sheet's own form, which the GM's next edit
 * submitted with GM rights) and the SVG elements that set attributes or pull in other content (`<animate>`/`<set>`
 * can turn a link's href into `javascript:` after cleaning).
 */
const DROPPED_ELEMENTS = 'script, iframe, frame, frameset, object, embed, applet, link, meta, style, base, form, input, select, textarea, button, option, optgroup, datalist, fieldset, output, keygen, animate, set, animateMotion, animateTransform, animatecolor, foreignObject, use, discard, handler, listener';

/** The same, by tag name (lower case), for the walk below. */
const DROPPED_TAGS = new Set(DROPPED_ELEMENTS.split(',').map((t) => t.trim().toLowerCase()));

/** Attributes that hold a URL. */
const URL_ATTRS = new Set(['href', 'src', 'xlink:href', 'action', 'formaction', 'data', 'background', 'poster', 'srcset', 'cite', 'ping', 'lowsrc', 'dynsrc', 'codebase', 'longdesc', 'manifest', 'to', 'from', 'values', 'by']);

/**
 * v0.81.1 (SEC2b-4c): whether a URL runs script or carries a document. Control characters and whitespace are taken out
 * first (the browser ignores a tab or newline inside "java\tscript:"). A plain raster image (`data:image/png` and the
 * like) is allowed; an SVG one is not.
 */
export function unsafeUrl(v: unknown): boolean {
  const n = String(v ?? '').replace(/[\u0000-\u0020\u007f-\u009f\u00a0\u1680\u2000-\u200f\u2028\u2029\u202f\u205f\u3000\ufeff]/g, '').toLowerCase();
  if (/^data:image\/(png|gif|jpe?g|webp|avif|bmp);/.test(n)) return false;
  return /^(javascript|vbscript|data|livescript|mocha):/.test(n);
}

/**
 * v0.81.1 (live-confirmed, critical): clean a player-written HTML field before it is shown. Foundry v14 stores an
 * actor's or item's HTML fields as written (a player's `<img onerror>` in a biography is kept) and `enrichHTML` doesn't
 * clean them, so a sheet showing `{{{enriched.biography}}}` ran the player's script on the GM's client. Here:
 * `foundry.utils.cleanHTML` (scripts, event handlers, `javascript:` links), then, in an inert <template>, remove every
 * `style`, `data-action` and `data-sr2e-*` attribute (a forged full-screen action button), any `on*` attribute left,
 * URLs that run script, and the elements in DROPPED_ELEMENTS. With no cleaner (or no DOM) available, the text is
 * escaped instead (shown as text, never as HTML). `enrichFields` runs it again on the enriched result (design 7).
 */
export function cleanRichHtml(html: unknown): string {
  const raw = String(html ?? '');
  if (!raw) return '';
  const clean: any = (globalThis as any).foundry?.utils?.cleanHTML;
  if (typeof clean !== 'function') {
    // SEC2b-11: say so once, so a renamed API shows up as more than a sheet full of markup.
    if (!warnedNoCleaner) { warnedNoCleaner = true; console.warn('sr2e | foundry.utils.cleanHTML is missing: rich text is shown as plain text'); }
    return escHtml(raw);
  }
  let s: string;
  try { s = String(clean(raw) ?? ''); } catch { return escHtml(raw); }
  const doc: any = (globalThis as any).document;
  if (!doc?.createElement) return escHtml(s);
  const t = doc.createElement('template');
  t.innerHTML = s;
  const root: any = t.content ?? t;
  for (const bad of Array.from(root.querySelectorAll(DROPPED_ELEMENTS)) as any[]) bad.remove();
  for (const el of Array.from(root.querySelectorAll('*')) as any[]) {
    // Also by tag name: a selector can miss an SVG element's mixed-case name in some parsers.
    if (DROPPED_TAGS.has(String(el.localName ?? el.tagName ?? '').toLowerCase())) { el.remove(); continue; }
    for (const a of Array.from(el.attributes ?? []) as any[]) {
      const n = String(a.name).toLowerCase();
      if (n === 'style' || n === 'data-action' || n.startsWith('data-sr2e') || n.startsWith('on') || n === 'form' || n === 'formaction') el.removeAttribute(a.name);
      else if ((URL_ATTRS.has(n) || n.endsWith(':href')) && unsafeUrl(a.value)) el.removeAttribute(a.name);
    }
  }
  return t.innerHTML;
}
let warnedNoCleaner = false;

/**
 * Enrich a document's HTML fields: `{ biography: '<p>…</p>', … }`, cleaned before and (v0.81.1, design 7, SEC2b-4a)
 * after enriching: enrichers (content-link labels, inline-roll flavours, other modules' enrichers) build HTML from the
 * cleaned text, so what they return is cleaned again before a sheet shows it.
 */
export async function enrichFields(doc: any): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const TE = textEditor();
  for (const k of RICH_FIELDS) {
    const raw = doc?.system?.[k];
    if (typeof raw !== 'string') continue;
    const safe = cleanRichHtml(raw);
    out[k] = safe && TE?.enrichHTML ? cleanRichHtml(await TE.enrichHTML(safe, { secrets: Boolean(doc.isOwner), relativeTo: doc, rollData: doc.getRollData?.() ?? {} })) : safe;
  }
  return out;
}

/**
 * v0.81.1 (live-confirmed, SEC2b-4d): the cleaned source of each HTML field, for the editor's `value`. Foundry's
 * ProseMirror editor parses its `value` into the live page when the sheet's editor is toggled, so the raw stored field
 * (a player's `<img onerror>` in a biography) ran its script on the GM's client the moment the GM clicked Edit. The
 * editor now starts from the same cleaned HTML the sheet shows (not enriched), so saving it keeps links and rolls as
 * written. Inline `style` is not kept (the cleaner removes it everywhere).
 */
export function cleanFields(doc: any): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of RICH_FIELDS) {
    const raw = doc?.system?.[k];
    if (typeof raw === 'string') out[k] = cleanRichHtml(raw);
  }
  return out;
}

/** Give a sheet class's context `enriched` (its HTML fields enriched) and `richSource` (cleaned, for the editor). Wrap base classes only. */
export function withRichText(cls: any): void {
  const orig = cls?.prototype?._prepareContext;
  if (typeof orig !== 'function' || cls.prototype[`${SYSTEM_ID}RichText`]) return;
  cls.prototype[`${SYSTEM_ID}RichText`] = true;
  cls.prototype._prepareContext = async function (this: any, options: any) {
    const context = await orig.call(this, options);
    try { context.enriched = await enrichFields(this.document); } catch (err) { console.warn('sr2e | enrich', err); context.enriched = {}; }
    context.richSource = cleanFields(this.document);
    return context;
  };
}

/**
 * v0.81.1 (scanner OPEN row): an item's picture for a chat card. It is owner-editable and starts the `src` URL, so
 * only a relative path (Foundry's own `icons/…`, `systems/…`, uploaded files) or an http(s) URL is kept; anything else
 * (another scheme, a protocol-relative `//host`) gets the default bag icon.
 */
export function safeImgSrc(v: unknown): string {
  const img = String(v ?? '').trim();
  const ok = img && !img.startsWith('//') && !unsafeUrl(img) && (/^https?:\/\//i.test(img) || !/^[a-z][\w+.-]*:/i.test(img));
  return ok ? img : 'icons/svg/item-bag.svg';
}

/** v0.59.0: post an item to chat: its name, picture, type and enriched description. */
export async function postItemToChat(item: any): Promise<void> {
  if (!item) return;
  const TE = textEditor();
  const desc = String(item.system?.description ?? '');
  const safe = cleanRichHtml(desc);
  // v0.81.1 (design 7): the enriched result is cleaned again too.
  const body = safe && TE?.enrichHTML ? cleanRichHtml(await TE.enrichHTML(safe, { secrets: false, relativeTo: item })) : safe;
  const esc = escHtml;
  const imgSrc = safeImgSrc(item.img);
  const label = String((globalThis as any).game?.i18n?.localize?.(`TYPES.Item.${item.type}`) ?? item.type);
  await (globalThis as any).ChatMessage.create({
    speaker: item.parent ? (globalThis as any).ChatMessage.getSpeaker({ actor: item.parent }) : {},
    content: `<div class="sr2e-item-card"><header><img src="${esc(imgSrc)}" width="36" height="36" alt=""> <h3>@UUID[${esc(item.uuid)}]{${esc(item.name)}}</h3></header><p class="hint">${esc(label)}</p>${body ? `<div class="sr2e-item-desc">${body}</div>` : ''}</div>`,
  });
}
