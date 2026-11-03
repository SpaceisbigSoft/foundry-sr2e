/**
 * v0.67.0: the look, Foundry side. Each player picks a theme (Street, Corp, High contrast), a colour
 * preset, the window opacity, the text size and reduced motion (client settings). The palette's CSS
 * variables come from `rules/look.ts` (so the contrast test checks what players see) and are keyed on
 * body classes; the stylesheet's "v0.67.0" section reads only those variables.
 *
 * Only SR2e's own windows take the look: our sheets and windows (class `sr2e`), the dialogs our code
 * opens (class `sr2e-dialog`, added when the call comes from the system), our settings windows
 * (ids `sr2e-…`) and our chat cards (class `sr2e-card`). Foundry's sidebar, chat log and tracker keep
 * Foundry's look.
 *
 * Portraits found by name: a world setting names a folder; a character named "Rook" takes
 * `<folder>/Rook.webp` (or .png, .jpg…) for its picture and prototype token while those are Foundry's
 * stand-ins (a picture set by hand is kept).
 */
import { SYSTEM } from '../config/system.ts';
import {
  THEME_LABELS, PRESET_LABELS, OPACITY_RANGE, TEXT_SCALE_RANGE, LOOK_DEFAULTS, normalizeLook, lookBody, palette, paletteCss,
  cardArea, cardKindLabel, portraitFor, portraitReplaceable, cleanFolder,
} from '../rules/index.ts';
import type { LookSettings } from '../rules/index.ts';
import { isLeadGm } from './leader.ts';
import { t as tx, tCount } from '../helpers/i18n.ts';

const ID = SYSTEM.id;
const STYLE_ID = 'sr2e-palette';
const BODY_PREFIXES = ['sr2e-theme-', 'sr2e-preset-'];
const BODY_FLAGS = ['sr2e-reduced-motion', 'sr2e-see-through'];

function setting<T>(key: string, fallback: T): T {
  try { const v = game.settings.get(ID, key); return (v ?? fallback) as T; } catch { return fallback; }
}

/** The current player's look (cleaned). */
export function readLook(): LookSettings {
  return normalizeLook({
    theme: setting('lookTheme', LOOK_DEFAULTS.theme), preset: setting('lookPreset', LOOK_DEFAULTS.preset),
    opacity: setting('windowOpacity', LOOK_DEFAULTS.opacity), textScale: setting('textScale', LOOK_DEFAULTS.textScale),
    reducedMotion: setting('reducedMotion', LOOK_DEFAULTS.reducedMotion),
  });
}

/** Foundry's colour scheme for its own controls inside our windows. */
export function lookScheme(v: LookSettings = readLook()): 'dark' | 'light' {
  return palette(v.theme, v.preset).scheme;
}

function ensurePaletteStyle(): void {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = paletteCss();
  document.head.appendChild(style);
}

/** One of our windows takes the theme's scheme (Foundry's inputs and checkboxes key on theme-dark / theme-light). */
export function themeWindow(root: HTMLElement, scheme: 'dark' | 'light' = lookScheme()): void {
  root.classList.add('sr2e-look', 'themed');
  root.classList.remove(scheme === 'dark' ? 'theme-light' : 'theme-dark');
  root.classList.add(`theme-${scheme}`);
}

/** Whether a rendered application is one of SR2e's own windows. */
export function isOurWindow(app: any, root: HTMLElement | null): boolean {
  if (!root?.classList) return false;
  if (root.classList.contains('sr2e') || root.classList.contains('sr2e-dialog') || root.classList.contains('sr2e-look')) return true;
  if (String(root.id ?? '').startsWith('sr2e-')) return true;
  const cls: unknown = app?.options?.classes;
  return Array.isArray(cls) && (cls.includes('sr2e') || cls.includes('sr2e-dialog'));
}

/** Sets the body classes and variables for the player's look, and re-themes open windows. */
export function applyLook(): void {
  if (typeof document === 'undefined' || !document.body) return;
  ensurePaletteStyle();
  const v = readLook();
  const { classes, style } = lookBody(v);
  const body = document.body;
  for (const c of Array.from(body.classList)) if (BODY_PREFIXES.some((p) => c.startsWith(p)) || BODY_FLAGS.includes(c)) body.classList.remove(c);
  body.classList.add(...classes);
  for (const [k, val] of Object.entries(style)) body.style.setProperty(k, val);
  const scheme = lookScheme(v);
  const instances: any = (foundry as any).applications?.instances;
  const apps: any[] = instances?.values ? [...instances.values()] : Object.values(instances ?? {});
  for (const app of apps) {
    const el: HTMLElement | null = app?.element ?? null;
    if (el && isOurWindow(app, el)) themeWindow(el, scheme);
  }
}

// ---------------------------------------------------------------- Our dialogs

const DIALOG_METHODS = ['wait', 'prompt', 'confirm', 'input'] as const;

/** Adds our class to a dialog's configuration (no duplicates). */
export function withDialogClass(cfg: any): any {
  const c = cfg && typeof cfg === 'object' ? cfg : {};
  const classes = Array.isArray(c.classes) ? c.classes : [];
  return classes.includes('sr2e-dialog') ? c : { ...c, classes: [...classes, 'sr2e-dialog'] };
}

/**
 * Whether the frame that called the wrapper is the system's own code (its file is under systems/sr2e/).
 * v0.81.0 (A-16): this finds the wrapper by its function name in the stack (`sr2eDialogWrap` here, `sr2eNoteWrap` in
 * interface.ts). v0.90.0: the build is minified, so each wrapper is an object method: a minifier never renames a
 * property key, and every browser names the stack frame after it (a renamed variable with its name set afterwards,
 * as keepNames does, shows the new name in Firefox's stacks). The v0.90.0 test checks the built index.mjs.
 */
export function calledFromSystem(stack: string, wrapperName = 'sr2eDialogWrap'): boolean {
  const lines = String(stack ?? '').split('\n');
  const at = lines.findIndex((l) => l.includes(wrapperName));
  const caller = at >= 0 ? lines[at + 1] : undefined;
  return !!caller && /systems\/sr2e\//.test(caller);
}

/**
 * Dialogs opened by the system's own code get the class `sr2e-dialog` (and so the look); dialogs other
 * modules open are left alone. The 170-odd dialog calls stay as they are.
 */
export function markSystemDialogs(D: any = (foundry as any)?.applications?.api?.DialogV2): void {
  if (!D) return;
  for (const m of DIALOG_METHODS) {
    const orig = D[m];
    if (typeof orig !== 'function' || orig.__sr2eWrapped) continue;
    const sr2eDialogWrap = ({
      sr2eDialogWrap(this: any, cfg: any, ...rest: any[]) {
        let c = cfg;
        try { if (calledFromSystem(new Error().stack ?? '')) c = withDialogClass(cfg); } catch { /* keep it */ }
        return orig.call(this, c, ...rest);
      },
    }).sr2eDialogWrap;
    (sr2eDialogWrap as any).__sr2eWrapped = true;
    try { D[m] = sr2eDialogWrap; } catch { /* read-only */ }
  }
}

// ---------------------------------------------------------------- Chat cards

/** Whether a chat message is one of ours. */
export function isOurCard(message: any, html: HTMLElement): boolean {
  if (message?.flags?.[ID]) return true;
  if (html.querySelector?.('.sr2e-roll, .sr2e-banner, .sr2e-item-card')) return true;
  return plainSystemCard(message);
}

/**
 * v0.74.0: the system's plain notices ("X starts: …", "… is done", "goes into …", "is no longer …") carry no
 * flags, so they showed Foundry's own parchment bubble. A message counts as ours when its content is HTML
 * (typed chat is plain text), it has no dice rolls of Foundry's own, and no other package flagged it.
 */
export function plainSystemCard(message: any): boolean {
  const content = String(message?.content ?? '').trim();
  if (!content.startsWith('<')) return false;
  if ((message?.rolls?.length ?? 0) > 0 || content.includes('inline-roll')) return false;
  // Typed chat (out of character, in character, emotes) has a style; the system's notices are "other" (0).
  if (Number(message?.style ?? 0) !== 0) return false;
  // Any other package's flags, or Foundry's own beyond the harmless pop-out one (roll tables, initiative), are not ours.
  const flags = message?.flags ?? {};
  if (Object.keys(flags).some((k) => k !== ID && k !== 'core')) return false;
  return Object.keys(flags.core ?? {}).every((k) => k === 'canPopout');
}

/** v0.74.0: the card's outcome as a class on the message, so the whole card reads at a glance. */
export function cardOutcome(content: HTMLElement): 'good' | 'bad' | 'disaster' | 'counter' | 'neutral' | '' {
  const b = content.querySelector<HTMLElement>('.sr2e-banner');
  if (b) {
    const has = (...c: string[]) => c.some((x) => b.classList.contains(`sr2e-banner-${x}`));
    if (has('disaster')) return 'disaster';
    if (has('miss', 'hit', 'taken')) return 'bad';
    if (has('ok', 'dodged')) return 'good';
    if (has('counter')) return 'counter';
    return 'neutral';
  }
  if (content.querySelector('.sr2e-contest-result')) return 'neutral';
  return '';
}

/**
 * Our chat cards: the area colour (from the kind of test), the kind word over the title, the outcome
 * bar moved under the dice, and dice that rolled a 1 marked. Only the rendered page changes, not the
 * stored message, so old cards take the new look too.
 */
export function decorateLookCard(message: any, html: HTMLElement): void {
  if (!html?.classList) return;
  // v0.74.0: every other message (typed chat, Foundry's own rolls, other packages' cards) gets the same themed
  // shell, so no parchment bubble shows up in the stream; only our own cards get the outcome decorations.
  if (!isOurCard(message, html)) { html.classList.add('sr2e-card', 'sr2e-area-neutral', 'sr2e-card-chat'); return; }
  const snap = message?.flags?.[ID]?.test ?? null;
  // v0.81.1 (RC2-5): the area comes from a card's flags (a forged kind of 'constructor' gave a class name with
  // spaces and brackets, and classList.add threw): only a plain word becomes a class.
  const raw = String(cardArea(snap) ?? '');
  const area = /^[a-z][a-z-]{0,30}$/.test(raw) ? raw : 'neutral';
  html.classList.add('sr2e-card', `sr2e-area-${area}`);
  const content = html.querySelector<HTMLElement>('.message-content') ?? html;
  const roll = content.querySelector<HTMLElement>(':scope > .sr2e-roll');
  const title = roll?.querySelector<HTMLElement>(':scope > h3');
  const word = cardKindLabel(snap?.kind);
  if (title && typeof word === 'string' && word && !title.dataset['kind']) title.dataset['kind'] = word;
  const banner = content.querySelector<HTMLElement>(':scope > .sr2e-banner');
  if (banner && roll && banner.nextElementSibling === roll) roll.after(banner);
  content.querySelectorAll<HTMLElement>('.sr2e-die').forEach((d) => {
    if (/^1(\s|$)/.test(String(d.textContent ?? '').trim()) && !d.classList.contains('hit')) d.classList.add('one');
  });
  html.querySelectorAll<HTMLButtonElement>('button[data-sr2e-action="karmaReroll"]').forEach((b) => b.classList.add('sr2e-ghost'));
  // v0.74.0: zero successes in the "bad" colour, any success in the "good" one. A contest (two or more rolls, no
  // banner) compares the counts instead: the most successes good, fewer bad, a tie neutral; its result line is boxed.
  const counts = Array.from(content.querySelectorAll<HTMLElement>('.sr2e-count')).map((c) => ({ c, n: c.classList.contains('sr2e-count-botch') ? -1 : Number(c.querySelector('b')?.textContent ?? NaN) }));
  const contest = counts.length >= 2 && !content.querySelector('.sr2e-banner');
  const best = Math.max(...counts.map((x) => (Number.isFinite(x.n) ? x.n : -1)));
  const tied = counts.filter((x) => x.n === best).length > 1;
  for (const { c, n } of counts) {
    if (!Number.isFinite(n) || n < 0) continue;
    if (contest) c.classList.add(n === best ? (tied ? 'sr2e-count-tie' : 'sr2e-count-good') : 'sr2e-count-zero');
    else c.classList.add(n > 0 ? 'sr2e-count-good' : 'sr2e-count-zero');
  }
  if (contest) {
    // v0.89.5: the verdict line carries a mark; a card posted before v0.89.5 is found by its English words.
    const line = content.querySelector<HTMLElement>(':scope > p[data-sr2e-contest-result]')
      ?? Array.from(content.querySelectorAll<HTMLElement>(':scope > p')).reverse().find((p) => /wins|holds out|stand-off|beats|loses/i.test(p.querySelector('strong')?.textContent ?? ''));
    line?.classList.add('sr2e-contest-result');
  }
  const out = cardOutcome(content);
  if (out) html.classList.add(`sr2e-outcome-${out}`);
  if (!content.querySelector('.sr2e-roll, .sr2e-banner, .sr2e-item-card, .sr2e-count')) html.classList.add('sr2e-card-note');
}

// ---------------------------------------------------------------- Portraits by name

let listing: { folder: string; at: number; files: string[] } | null = null;

async function folderFiles(folder: string, fresh = false): Promise<string[]> {
  if (!folder) return [];
  if (!fresh && listing && listing.folder === folder && Date.now() - listing.at < 60_000) return listing.files;
  const FP: any = (foundry as any)?.applications?.apps?.FilePicker?.implementation ?? (globalThis as any).FilePicker;
  if (!FP?.browse) return [];
  try {
    const res = await FP.browse('data', folder);
    const files = Array.isArray(res?.files) ? res.files.map(String) : [];
    listing = { folder, at: Date.now(), files };
    return files;
  } catch (err) {
    console.warn(`sr2e | portraits: can't list ${folder}`, err);
    listing = { folder, at: Date.now(), files: [] };
    return [];
  }
}

/** The world's portrait folder ('' when off). */
export function portraitFolder(): string { return cleanFolder(setting('portraitFolder', '')); }

/**
 * Gives an actor the picture named after it, for its sheet and (world setting portraitTokens) its
 * prototype token and placed tokens, wherever those are still stand-ins or the picture this put there
 * before. Returns true when something changed.
 */
export async function applyPortrait(actor: any, o: { fresh?: boolean } = {}): Promise<boolean> {
  const folder = portraitFolder();
  if (!folder || !actor?.name || !actor.isOwner) return false;
  const match = portraitFor(actor.name, await folderFiles(folder, o.fresh));
  if (!match) return false;
  const auto = actor.getFlag?.(ID, 'portraitAuto') ?? null;
  const defaults = [String((globalThis as any).CONFIG?.Actor?.documentClass?.DEFAULT_ICON ?? ''), String((globalThis as any).CONST?.DEFAULT_TOKEN ?? '')].filter(Boolean);
  const upd: Record<string, unknown> = {};
  if (actor.img !== match && portraitReplaceable(actor.img, auto, defaults)) upd['img'] = match;
  const tokens = setting('portraitTokens', true);
  const proto = actor.prototypeToken?.texture?.src ?? '';
  if (tokens && proto !== match && portraitReplaceable(proto, auto, defaults)) upd['prototypeToken.texture.src'] = match;
  if (!Object.keys(upd).length) return false;
  // Foundry itself copies a new actor picture onto a prototype token that still shows the old one:
  // with "Portraits for tokens too" off, keep the token's picture as it is.
  // (Foundry's _preUpdate only skips that copy when the update names the token's picture, and an unchanged value
  // is dropped by the diff, so this update goes without the diff.)
  const pin = !tokens && 'img' in upd && !!proto;
  if (pin) upd['prototypeToken.texture.src'] = proto;
  upd[`flags.${ID}.portraitAuto`] = match;
  await actor.update(upd, { sr2eNoAdvance: true, sr2ePortrait: true, ...(pin ? { diff: false } : {}) });
  if (tokens && game.user?.isGM) {
    for (const scene of (game as any).scenes ?? []) {
      const mine = (scene.tokens ?? []).filter((t: any) => t.actorId === actor.id && t.actorLink && portraitReplaceable(t.texture?.src, auto, defaults) && t.texture?.src !== match);
      if (mine.length) await scene.updateEmbeddedDocuments('Token', mine.map((t: any) => ({ _id: t.id, 'texture.src': match })));
    }
  }
  return true;
}

/** GM: looks up a portrait for every actor in the world. Returns how many changed. */
export async function findAllPortraits(): Promise<number> {
  if (!game.user?.isGM) { ui.notifications?.warn(tx('SR2E.Notify.Look.onlyTheGmCanLookUp')); return 0; }
  if (!portraitFolder()) { ui.notifications?.warn(tx('SR2E.Notify.Look.setAPortraitFolderFirstConfigure')); return 0; }
  await folderFiles(portraitFolder(), true);
  let n = 0;
  for (const a of (game as any).actors ?? []) { if (await applyPortrait(a)) n++; }
  ui.notifications?.info(n ? tx('SR2E.Notify.Look.portraitsFoundForActor', { n: tCount(n, 'SR2E.Count.actor') }) : tx('SR2E.Notify.Look.noNewPortraitsFound'));
  return n;
}

function handlesPortraitFor(userId: string): boolean {
  const gm = (game as any).users?.activeGM;
  return gm ? isLeadGm() : userId === game.user?.id;
}

// ---------------------------------------------------------------- Registration

export function registerLookSettings(): void {
  const s = game.settings;
  s.register(ID, 'lookTheme', {
    name: "SR2E.Settings.lookTheme.Name", hint: "SR2E.Settings.lookTheme.Hint",
    scope: 'client', config: true, type: String, default: LOOK_DEFAULTS.theme, choices: { ...THEME_LABELS }, onChange: () => applyLook(),
  });
  s.register(ID, 'lookPreset', {
    name: "SR2E.Settings.lookPreset.Name", hint: "SR2E.Settings.lookPreset.Hint",
    scope: 'client', config: true, type: String, default: LOOK_DEFAULTS.preset, choices: { ...PRESET_LABELS }, onChange: () => applyLook(),
  });
  s.register(ID, 'windowOpacity', {
    name: "SR2E.Settings.windowOpacity.Name", hint: "SR2E.Settings.windowOpacity.Hint",
    scope: 'client', config: true, type: Number, default: LOOK_DEFAULTS.opacity, range: { ...OPACITY_RANGE }, onChange: () => applyLook(),
  });
  s.register(ID, 'textScale', {
    name: "SR2E.Settings.textScale.Name", hint: "SR2E.Settings.textScale.Hint",
    scope: 'client', config: true, type: Number, default: LOOK_DEFAULTS.textScale, range: { ...TEXT_SCALE_RANGE }, onChange: () => applyLook(),
  });
  s.register(ID, 'reducedMotion', {
    name: "SR2E.Settings.reducedMotion.Name", hint: "SR2E.Settings.reducedMotion.Hint",
    scope: 'client', config: true, type: Boolean, default: LOOK_DEFAULTS.reducedMotion, onChange: () => applyLook(),
  });
  s.register(ID, 'portraitFolder', {
    name: "SR2E.Settings.portraitFolder.Name", hint: "SR2E.Settings.portraitFolder.Hint",
    scope: 'world', config: true, type: String, default: '', filePicker: 'folder', restricted: true,
  } as any);
  s.register(ID, 'portraitTokens', {
    name: "SR2E.Settings.portraitTokens.Name", hint: "SR2E.Settings.portraitTokens.Hint",
    scope: 'world', config: true, type: Boolean, default: true, restricted: true,
  } as any);
}

export function registerLook(): void {
  markSystemDialogs();
  Hooks.on('renderApplicationV2', (app: any, el: HTMLElement) => {
    const root: HTMLElement | null = el instanceof HTMLElement ? el : app?.element ?? null;
    if (root && isOurWindow(app, root)) themeWindow(root);
  });
  Hooks.on('renderChatMessageHTML', (message: any, html: HTMLElement) => {
    try { decorateLookCard(message, html); } catch (err) { console.warn('sr2e | card look', err); }
  });
  Hooks.once('setup', () => applyLook());
  Hooks.once('ready', () => applyLook());
  Hooks.on('createActor', (actor: any, _o: any, userId: string) => {
    if (!portraitFolder() || !handlesPortraitFor(userId)) return;
    // v0.84.0: not for an actor deleted in the meantime (a catalogue NPC whose import failed).
    setTimeout(() => { if ((game as any).actors?.get?.(actor.id) === actor) applyPortrait(actor).catch((err) => console.warn('sr2e | portraits:', err)); }, 50);
  });
  Hooks.on('updateActor', (actor: any, change: any, o: any, userId: string) => {
    if (o?.sr2ePortrait || !('name' in (change ?? {})) || !portraitFolder() || !handlesPortraitFor(userId)) return;
    void applyPortrait(actor);
  });
}
