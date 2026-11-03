/**
 * v0.67.0: the look. Pure data and maths, no Foundry: the colour palettes of every theme and preset
 * (the stylesheet only reads CSS variables; the variables come from here, so the contrast test checks
 * exactly what players see), WCAG contrast, the condition monitor's wound groups and overflow row,
 * the area colour of a chat card, and portraits found by a character's name.
 */
import { RULES } from './config.ts';
import type { DamageLevel } from './config.ts';
import { deathBoxExtra } from './urr80-health-social.ts';
import { own } from './util.ts';
import { isDefaultArt } from './tokenart.ts';
import { t as tx } from '../helpers/i18n.ts';

// ---------------------------------------------------------------- Themes, presets, areas

export const THEMES = ['street', 'corp', 'contrast'] as const;
export type ThemeId = typeof THEMES[number];
/** v0.89.4: keys (lang/en.json); the settings' choices are translated by Foundry. */
export const THEME_LABELS: Record<ThemeId, string> = {
  street: 'SR2E.Settings.lookTheme.Choices.street', corp: 'SR2E.Settings.lookTheme.Choices.corp', contrast: 'SR2E.Settings.lookTheme.Choices.contrast',
};
export const PRESETS = ['cyan', 'green', 'magenta', 'amber'] as const;
export type PresetId = typeof PRESETS[number];
export const PRESET_LABELS: Record<PresetId, string> = {
  cyan: 'SR2E.Settings.lookPreset.Choices.cyan', green: 'SR2E.Settings.lookPreset.Choices.green', magenta: 'SR2E.Settings.lookPreset.Choices.magenta', amber: 'SR2E.Settings.lookPreset.Choices.amber',
};
export const AREAS = ['combat', 'magic', 'matrix', 'rigging', 'street', 'health'] as const;
export type AreaId = typeof AREAS[number];

/** One area colour: base (borders, filled boxes), text (headings on the window), tint (card header strip), ink (text on the tint). */
export interface AreaColours { base: string; text: string; tint: string; ink: string }

export interface Palette {
  page: string; window: string; header: string; headerText: string; headerAccent: string;
  raised: string; chip: string; sunk: string; line: string; lineStrong: string; boxLine: string;
  text: string; muted: string;
  accent: string; accentTint: string; accentInk: string;
  hitBg: string; hitInk: string; oneInk: string; oneLine: string;
  danger: string; dangerTint: string; dangerInk: string;
  /** Whether Foundry's own controls inside our windows should use its dark or light theme. */
  scheme: 'dark' | 'light';
  areas: Record<AreaId, AreaColours>;
}

type Base = Omit<Palette, 'areas' | 'accent' | 'accentTint' | 'accentInk' | 'hitBg' | 'hitInk' | 'headerAccent'>;
type Accent = Pick<Palette, 'accent' | 'accentTint' | 'accentInk' | 'hitBg' | 'hitInk'>;

// Street (dark): option A of the mock-up, gunmetal panels. Each preset tints the panels a little.
const STREET_BASE: Record<PresetId, Base> = {
  cyan: { page: '#0f1215', window: '#1b1f25', header: '#232931', headerText: '#e6e9ed', raised: '#232931', chip: '#252a31', sunk: '#15181c',
    line: '#343b45', lineStrong: '#3a424d', boxLine: '#6a7480', text: '#e6e9ed', muted: '#a3adb9', oneInk: '#f0a49a', oneLine: '#8a4a42',
    danger: '#ef6b5f', dangerTint: '#3a1d19', dangerInk: '#ffd2cb', scheme: 'dark' },
  green: { page: '#0d110f', window: '#1a201d', header: '#212925', headerText: '#e4ece7', raised: '#212925', chip: '#232b27', sunk: '#121815',
    line: '#33403a', lineStrong: '#3a4842', boxLine: '#6a7a72', text: '#e4ece7', muted: '#a4b3ab', oneInk: '#f0a49a', oneLine: '#8a4a42',
    danger: '#ef6b5f', dangerTint: '#3a1d19', dangerInk: '#ffd2cb', scheme: 'dark' },
  magenta: { page: '#0f0f14', window: '#1c1c24', header: '#24242e', headerText: '#e9e8f0', raised: '#24242e', chip: '#25262f', sunk: '#14141a',
    line: '#363847', lineStrong: '#3d3f50', boxLine: '#6c6e84', text: '#e9e8f0', muted: '#a7a9bd', oneInk: '#f0a49a', oneLine: '#8a4a42',
    danger: '#ef6b5f', dangerTint: '#3a1d19', dangerInk: '#ffd2cb', scheme: 'dark' },
  amber: { page: '#12100e', window: '#1c1916', header: '#26221d', headerText: '#eee6da', raised: '#26221d', chip: '#29251f', sunk: '#141210',
    line: '#3b352d', lineStrong: '#433c33', boxLine: '#7a7062', text: '#eee6da', muted: '#b8ad9c', oneInk: '#f0a49a', oneLine: '#8a4a42',
    danger: '#ef6b5f', dangerTint: '#3a1d19', dangerInk: '#ffd2cb', scheme: 'dark' },
};
const STREET_ACCENT: Record<PresetId, Accent> = {
  cyan: { accent: '#4fd1d9', accentTint: '#1a3236', accentInk: '#dff8fa', hitBg: '#14373b', hitInk: '#e9fdff' },
  green: { accent: '#5fd68f', accentTint: '#17311f', accentInk: '#e3fbe9', hitBg: '#163a24', hitInk: '#effff4' },
  magenta: { accent: '#ec6fc5', accentTint: '#3a1730', accentInk: '#ffe6f6', hitBg: '#3d1734', hitInk: '#fff0fa' },
  amber: { accent: '#f0b35a', accentTint: '#3a2c16', accentInk: '#fff1da', hitBg: '#3d2d12', hitInk: '#fff6e6' },
};
const STREET_AREAS: Record<AreaId, AreaColours> = {
  combat: { base: '#ce5642', text: '#ea6f5a', tint: '#3a1d18', ink: '#ffcabf' },
  magic: { base: '#9576d1', text: '#aa8be8', tint: '#271d3a', ink: '#ddd0ff' },
  matrix: { base: '#39daad', text: '#59f1c3', tint: '#0d3126', ink: '#c4f6e2' },
  rigging: { base: '#e0892c', text: '#f89f47', tint: '#372310', ink: '#ffdcbe' },
  street: { base: '#ebca6e', text: '#ffe293', tint: '#322a12', ink: '#f9e5b0' },
  health: { base: '#21aa9c', text: '#42c0b2', tint: '#12302c', ink: '#c3f2ea' },
};
/** On the Phosphor green preset the Matrix area turns cyan, so it doesn't vanish into the accent. */
const STREET_MATRIX_CYAN: AreaColours = { base: '#50d6de', text: '#6bedf5', tint: '#123236', ink: '#d0f7f9' };

// Corp: option F, the same layout in daylight, shaded (never flat white), with the dark title bar kept.
const CORP_BASE: Base = {
  page: '#a9b1ba', window: '#d6dbe1', header: '#232931', headerText: '#e6e9ed', raised: '#c9d0d7', chip: '#cad1d8', sunk: '#dde2e7',
  line: '#a9b2bc', lineStrong: '#97a1ac', boxLine: '#6b7682', text: '#151b22', muted: '#3f4955', oneInk: '#86281a', oneLine: '#a86a60',
  danger: '#9e2418', dangerTint: '#e0c9c4', dangerInk: '#5e1d13', scheme: 'light',
};
const CORP_ACCENT: Record<PresetId, Accent> = {
  cyan: { accent: '#085a63', accentTint: '#b4d4d8', accentInk: '#06363c', hitBg: '#a6ced3', hitInk: '#052c31' },
  green: { accent: '#175c34', accentTint: '#bcdcc6', accentInk: '#0a3a1e', hitBg: '#a9d4b6', hitInk: '#062a14' },
  magenta: { accent: '#8e2470', accentTint: '#e2bfd6', accentInk: '#4d0f3a', hitBg: '#dcb0cd', hitInk: '#3d0b2e' },
  amber: { accent: '#6e4800', accentTint: '#e6d2a8', accentInk: '#3d2800', hitBg: '#dcc48f', hitInk: '#2e1e00' },
};
/** The light theme keeps a dark title bar, so its accent line there is the dark theme's accent. */
const CORP_HEADER_ACCENT: Record<PresetId, string> = { cyan: '#4fd1d9', green: '#5fd68f', magenta: '#ec6fc5', amber: '#f0b35a' };
const CORP_AREAS: Record<AreaId, AreaColours> = {
  combat: { base: '#7f0c0a', text: '#620002', tint: '#ddc2bd', ink: '#5e1c17' },
  magic: { base: '#5e3fb4', text: '#4c289d', tint: '#cbc7ea', ink: '#2c1b59' },
  matrix: { base: '#215b40', text: '#07482e', tint: '#c2dccd', ink: '#0d3d28' },
  rigging: { base: '#964e00', text: '#793f05', tint: '#e8ccb8', ink: '#4c2704' },
  street: { base: '#8d7350', text: '#69512f', tint: '#efd1a9', ink: '#442b02' },
  health: { base: '#137c71', text: '#0b5f57', tint: '#bcdcd7', ink: '#063a34' },
};
const CORP_MATRIX_CYAN: AreaColours = { base: '#13575e', text: '#004349', tint: '#b4d4d8', ink: '#06363c' };

// High contrast: built from A, black panels, bright lines and white text.
const CONTRAST_BASE: Base = {
  page: '#000000', window: '#0a0c0f', header: '#000000', headerText: '#ffffff', raised: '#14171b', chip: '#14171b', sunk: '#000000',
  line: '#7d8894', lineStrong: '#c3ccd5', boxLine: '#c3ccd5', text: '#ffffff', muted: '#dfe5eb', oneInk: '#ffb3a8', oneLine: '#ff8a7a',
  danger: '#ff8a7a', dangerTint: '#4a130b', dangerInk: '#ffffff', scheme: 'dark',
};
const CONTRAST_ACCENT: Record<PresetId, Accent> = {
  cyan: { accent: '#6ff0f7', accentTint: '#00383c', accentInk: '#ffffff', hitBg: '#00494f', hitInk: '#ffffff' },
  green: { accent: '#7dffb0', accentTint: '#003d1c', accentInk: '#ffffff', hitBg: '#004a22', hitInk: '#ffffff' },
  magenta: { accent: '#ff8ee0', accentTint: '#4a0638', accentInk: '#ffffff', hitBg: '#5a0944', hitInk: '#ffffff' },
  amber: { accent: '#ffcf70', accentTint: '#4a3000', accentInk: '#ffffff', hitBg: '#573900', hitInk: '#ffffff' },
};
const CONTRAST_AREAS: Record<AreaId, AreaColours> = {
  combat: { base: '#fb7c67', text: '#ff8b77', tint: '#4a130b', ink: '#ffffff' },
  magic: { base: '#c8aefb', text: '#d0baff', tint: '#311853', ink: '#ffffff' },
  matrix: { base: '#68ca99', text: '#72d4a2', tint: '#003d25', ink: '#ffffff' },
  rigging: { base: '#ffb424', text: '#ffc260', tint: '#432b00', ink: '#ffffff' },
  street: { base: '#fde99a', text: '#fff3c4', tint: '#3d3200', ink: '#ffffff' },
  health: { base: '#5ffaea', text: '#8ffff1', tint: '#003d38', ink: '#ffffff' },
};
const CONTRAST_MATRIX_CYAN: AreaColours = { base: '#65cfd3', text: '#6fd9dd', tint: '#00383c', ink: '#ffffff' };

export function isTheme(v: unknown): v is ThemeId { return (THEMES as readonly string[]).includes(String(v)); }
export function isPreset(v: unknown): v is PresetId { return (PRESETS as readonly string[]).includes(String(v)); }

/** The full palette of a theme and colour preset (unknown values fall back to Street / Gunmetal cyan). */
export function palette(theme: string, preset: string): Palette {
  const t: ThemeId = isTheme(theme) ? theme : 'street';
  const p: PresetId = isPreset(preset) ? preset : 'cyan';
  if (t === 'corp') {
    const areas = { ...CORP_AREAS, ...(p === 'green' ? { matrix: CORP_MATRIX_CYAN } : {}) };
    return { ...CORP_BASE, ...CORP_ACCENT[p], headerAccent: CORP_HEADER_ACCENT[p], areas };
  }
  if (t === 'contrast') {
    const areas = { ...CONTRAST_AREAS, ...(p === 'green' ? { matrix: CONTRAST_MATRIX_CYAN } : {}) };
    return { ...CONTRAST_BASE, ...CONTRAST_ACCENT[p], headerAccent: CONTRAST_ACCENT[p].accent, areas };
  }
  const areas = { ...STREET_AREAS, ...(p === 'green' ? { matrix: STREET_MATRIX_CYAN } : {}) };
  return { ...STREET_BASE[p], ...STREET_ACCENT[p], headerAccent: STREET_ACCENT[p].accent, areas };
}

// ---------------------------------------------------------------- Contrast (WCAG 2.x)

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** The WCAG contrast ratio of two colours (1 to 21). */
export function contrast(a: string, b: string): number {
  const la = luminance(a); const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

export interface ContrastPair { fg: string; bg: string; min: number; what: string }

/**
 * Every text/background pair the stylesheet uses, with its minimum ratio: 4.5 for text (WCAG AA),
 * 3 for the parts of controls you need to see (box outlines, filled boxes, the accent edge).
 */
export function contrastPairs(p: Palette): ContrastPair[] {
  const t = (fg: keyof Palette, bg: keyof Palette, what: string, min = 4.5): ContrastPair =>
    ({ fg: p[fg] as string, bg: p[bg] as string, min, what: `${what} (${String(fg)} on ${String(bg)})` });
  const pairs: ContrastPair[] = [
    t('text', 'window', 'body text'), t('text', 'raised', 'text in a panel'), t('text', 'chip', 'text in a chip'), t('text', 'sunk', 'text in a field'),
    t('headerText', 'header', 'window and card titles'),
    t('muted', 'window', 'labels and hints'), t('muted', 'raised', 'labels in a panel'), t('muted', 'chip', 'die faces and chip labels'),
    t('accent', 'window', 'links and the active tab'), t('accent', 'raised', 'links in a panel'),
    t('accentInk', 'accentTint', 'accent buttons'), t('hitInk', 'hitBg', 'dice that hit'),
    t('oneInk', 'chip', 'dice that rolled a 1'), t('danger', 'window', 'warnings'), t('danger', 'raised', 'warnings in a panel'),
    t('dangerInk', 'dangerTint', 'disaster and danger strips'),
    t('accent', 'window', 'the window edge and focus ring', 3), t('boxLine', 'sunk', 'empty monitor boxes', 3),
    t('boxLine', 'window', 'monitor box outlines', 3), t('headerAccent', 'header', 'the accent line on the title bar', 3),
  ];
  for (const a of AREAS) {
    const c = p.areas[a];
    pairs.push({ fg: c.text, bg: p.window, min: 4.5, what: `${a} headings` });
    pairs.push({ fg: c.text, bg: p.raised, min: 4.5, what: `${a} headings in a panel` });
    pairs.push({ fg: c.ink, bg: c.tint, min: 4.5, what: `${a} card header strip` });
    pairs.push({ fg: c.base, bg: p.window, min: 3, what: `${a} filled boxes and borders` });
    pairs.push({ fg: c.base, bg: p.sunk, min: 3, what: `${a} filled box against an empty one` });
  }
  return pairs;
}

/** The pairs that miss their minimum (empty when the palette passes). */
export function contrastProblems(p: Palette): Array<ContrastPair & { ratio: number }> {
  return contrastPairs(p).map((x) => ({ ...x, ratio: contrast(x.fg, x.bg) })).filter((x) => x.ratio < x.min);
}

// ---------------------------------------------------------------- CSS variables

function rgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** The CSS custom properties of one palette (`--sr2e-…`). */
export function paletteVars(p: Palette): Record<string, string> {
  const v: Record<string, string> = {
    '--sr2e-page': p.page, '--sr2e-window': p.window, '--sr2e-header': p.header, '--sr2e-header-text': p.headerText,
    '--sr2e-header-accent': p.headerAccent, '--sr2e-raised': p.raised, '--sr2e-chip': p.chip, '--sr2e-sunk': p.sunk,
    '--sr2e-rule': p.line, '--sr2e-rule-strong': p.lineStrong, '--sr2e-box-line': p.boxLine,
    '--sr2e-ink': p.text, '--sr2e-muted': p.muted, '--sr2e-accent': p.accent, '--sr2e-accent-tint': p.accentTint,
    '--sr2e-accent-ink': p.accentInk, '--sr2e-hit-bg': p.hitBg, '--sr2e-hit-ink': p.hitInk, '--sr2e-hit-line': p.accent,
    '--sr2e-one-ink': p.oneInk, '--sr2e-one-line': p.oneLine, '--sr2e-danger': p.danger, '--sr2e-danger-tint': p.dangerTint,
    '--sr2e-danger-ink': p.dangerInk, '--sr2e-edge': rgba(p.accent, 0.45), '--sr2e-glow': rgba(p.accent, p.scheme === 'light' ? 0.1 : 0.14),
    '--sr2e-edge-soft': rgba(p.accent, 0.12), '--sr2e-hit-glow': rgba(p.accent, p.scheme === 'light' ? 0 : 0.35),
    '--sr2e-accent-wash': rgba(p.accent, 0.16), '--sr2e-scheme': p.scheme,
    // v0.74.0: outcome colours for the success count (text on the card's own background).
    '--sr2e-good': p.scheme === 'light' ? '#17692f' : '#4cd982', '--sr2e-bad': p.danger,
    // Solid outcome fills (white text on each is at least 4.5:1) and the colourblind set (Okabe-Ito).
    // Edges and outlines use the text colours above (≥ 3:1 on the window); the light palette gets darker lines.
    '--sr2e-good-fill': '#1b7a3d', '--sr2e-bad-fill': '#b3261e', '--sr2e-counter-fill': '#6a3fb8',
    '--sr2e-neutral-line': p.scheme === 'light' ? '#7a5600' : '#d99a00', '--sr2e-neutral-text': p.scheme === 'light' ? '#6b4b00' : '#f0b429',
    '--sr2e-on-fill': '#ffffff', '--sr2e-disaster-bg': '#111111', '--sr2e-disaster-ink': '#ff8a80',
    '--sr2e-cb-good': '#0072b2', '--sr2e-cb-bad': '#d55e00',
    '--sr2e-cb-good-text': p.scheme === 'light' ? '#005a8c' : '#56b4e9', '--sr2e-cb-bad-text': p.scheme === 'light' ? '#8f4500' : '#e69f00',
  };
  for (const a of AREAS) {
    const c = p.areas[a];
    v[`--sr2e-${a}`] = c.base; v[`--sr2e-${a}-text`] = c.text; v[`--sr2e-${a}-tint`] = c.tint; v[`--sr2e-${a}-ink`] = c.ink;
  }
  return v;
}

/**
 * The stylesheet block for every theme × preset, keyed on body classes (`sr2e-theme-<id>` and
 * `sr2e-preset-<id>`) and set only on our windows and cards (LOOK_SCOPE), in the system cascade layer.
 * Elsewhere the variables follow Foundry's interface scheme (Street on dark, Corp on light).
 */
export const LOOK_SCOPE = ':is(.sr2e-look, .sr2e-card, .sr2e-hover-card)';

export function paletteCss(): string {
  const block = (sel: string, p: Palette) => `${sel} {\n${Object.entries(paletteVars(p)).map(([k, v]) => `  ${k}: ${v};`).join('\n')}\n}`;
  // Outside our windows and cards (a plain chat message, a journal's inline test), the old SR2e classes follow
  // Foundry's own interface scheme: Street on its dark theme, Corp on its light theme.
  const parts = [
    block(':root, body.theme-dark', palette('street', 'cyan')),
    block('body.theme-light', palette('corp', 'cyan')),
  ];
  // Inside them, the player's own theme and preset.
  for (const t of THEMES) for (const pr of PRESETS) parts.push(block(`body.sr2e-theme-${t}.sr2e-preset-${pr} ${LOOK_SCOPE}`, palette(t, pr)));
  return `@layer system {\n${parts.join('\n')}\n}`;
}

// ---------------------------------------------------------------- Player look settings

export interface LookSettings { theme: ThemeId; preset: PresetId; opacity: number; textScale: number; reducedMotion: boolean }
export const LOOK_DEFAULTS: LookSettings = { theme: 'street', preset: 'cyan', opacity: 100, textScale: 100, reducedMotion: false };
export const OPACITY_RANGE = { min: 50, max: 100, step: 5 } as const;
export const TEXT_SCALE_RANGE = { min: 90, max: 130, step: 5 } as const;

function clampStep(v: unknown, r: { min: number; max: number; step: number }, fallback: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  const c = Math.min(r.max, Math.max(r.min, n));
  return Math.round(c / r.step) * r.step;
}

/** Cleans settings read back from storage. */
export function normalizeLook(v: Partial<Record<keyof LookSettings, unknown>> | null | undefined): LookSettings {
  const s = v ?? {};
  return {
    theme: isTheme(s.theme) ? s.theme : LOOK_DEFAULTS.theme,
    preset: isPreset(s.preset) ? s.preset : LOOK_DEFAULTS.preset,
    opacity: clampStep(s.opacity, OPACITY_RANGE, LOOK_DEFAULTS.opacity),
    textScale: clampStep(s.textScale, TEXT_SCALE_RANGE, LOOK_DEFAULTS.textScale),
    reducedMotion: Boolean(s.reducedMotion),
  };
}

/** The body classes and style properties for a player's look. */
export function lookBody(v: LookSettings): { classes: string[]; style: Record<string, string> } {
  const classes = [`sr2e-theme-${v.theme}`, `sr2e-preset-${v.preset}`];
  if (v.reducedMotion) classes.push('sr2e-reduced-motion');
  if (v.opacity < 100) classes.push('sr2e-see-through');
  return { classes, style: { '--sr2e-window-alpha': String(v.opacity / 100), '--sr2e-text-scale': String(v.textScale / 100) } };
}

// ---------------------------------------------------------------- Condition monitor: wound groups and overflow

export type TrackKind = 'physical' | 'stun' | 'matrix';

export interface MonitorBox { value: number; filled: boolean; dead?: boolean }
export interface WoundGroup { label: string; title: string; size: number; boxes: MonitorBox[]; now: boolean; last: boolean }
export interface TrackView {
  track: TrackKind; label: string; filled: number; boxes: number; groups: WoundGroup[];
  /** The label of the group the damage has reached ('' when none). */
  reached: string;
}
export interface OverflowView { body: number; filled: number; idle: boolean; boxes: MonitorBox[]; title: string }

/** A wound level's word (v0.89.6: translated where it is used). */
const levelWord = (level: string): string | undefined => (level === 'L' ? tx('SR2E.Text.Look.light') : level === 'M' ? tx('SR2E.Text.Look.moderate')
  : level === 'S' ? tx('SR2E.Text.Look.serious') : level === 'D' ? tx('SR2E.Text.Look.deadly') : undefined);

function woundModFor(box: number): number {
  for (const [min, mod] of RULES.WOUND_MODIFIERS) if (box >= min) return mod;
  return 0;
}

/**
 * The groups of a 10-box track, from the healing table's wound levels ([[1,L],[3,M],[6,S],[10,D]]):
 * boxes 1–2 "+1", 3–5 "+2", 6–9 "+3", 10 "D" (Physical), "KO" (Stun) or "Crash" (Matrix). Never hard-coded:
 * a house rule that moves the levels or the wound modifiers moves the dividers and labels with them.
 */
export function woundGroupRanges(track: TrackKind, boxes: number = RULES.MONITOR_BOXES,
  levels: ReadonlyArray<readonly [number, DamageLevel | string]> = (RULES as any).MAGIC_V56?.healing?.woundLevels ?? [[1, 'L'], [3, 'M'], [6, 'S'], [10, 'D']]):
  Array<{ from: number; to: number; label: string; title: string }> {
  const sorted = [...levels].map(([n, l]) => [Math.floor(Number(n)), String(l)] as const)
    .filter(([n]) => n >= 1 && n <= boxes).sort((a, b) => a[0] - b[0]);
  const out: Array<{ from: number; to: number; label: string; title: string }> = [];
  if (!sorted.length || sorted[0]![0] > 1) out.push({ from: 1, to: (sorted[0]?.[0] ?? boxes + 1) - 1, label: '', title: tx('SR2E.Text.Look.noWoundModifier') });
  sorted.forEach(([from, level], i) => {
    const to = i + 1 < sorted.length ? sorted[i + 1]![0] - 1 : boxes;
    if (to < from) return;
    const final = to === boxes && level === 'D';
    const mod = woundModFor(from);
    const label = final ? (track === 'stun' ? tx('SR2E.Text.Look.ko') : track === 'matrix' ? tx('SR2E.Text.Look.crash') : tx('SR2E.Text.Look.deadlyShort')) : mod ? `+${mod}` : level;
    const word = levelWord(level) ?? level;
    const title = final
      ? (track === 'stun' ? tx('SR2E.Text.Look.unconscious') : track === 'matrix' ? tx('SR2E.Text.Look.crashed') : tx('SR2E.Text.Look.deadlyDying'))
      : tx('SR2E.Text.Look.woundTitle', { word, mod });
    out.push({ from, to, label, title });
  });
  return out;
}

const trackLabel = (track: TrackKind): string => (track === 'physical' ? tx('SR2E.Text.Look.physical') : track === 'stun' ? tx('SR2E.Text.Look.stun') : tx('SR2E.Text.Look.persona'));

/** A track's boxes in wound groups, for the sheets, the summary and the GM panel. */
export function trackView(track: TrackKind, filled: number, opts: { boxes?: number; label?: string } = {}): TrackView {
  const n = opts.boxes ?? RULES.MONITOR_BOXES;
  const f = Math.max(0, Math.floor(Number(filled) || 0));
  const ranges = woundGroupRanges(track, n);
  let reached = '';
  const groups: WoundGroup[] = ranges.map((r, i) => {
    const boxes: MonitorBox[] = [];
    for (let v = r.from; v <= r.to; v++) boxes.push({ value: v, filled: f >= v });
    if (f >= r.from) reached = r.label;
    return { label: r.label, title: r.title, size: boxes.length, boxes, now: false, last: i === ranges.length - 1 };
  });
  const nowIdx = ranges.map((r) => f >= r.from).lastIndexOf(true);
  if (nowIdx >= 0) groups[nowIdx]!.now = true;
  return { track, label: opts.label ?? trackLabel(track), filled: Math.min(f, n), boxes: n, groups, reached };
}

/** v0.81.1 (SEC2b-1): the most Overflow boxes drawn (far above any real Body). */
export const MAX_OVERFLOW_BOXES = 100;

/**
 * The Overflow row after Physical box 10: one box per point of Body (the same Body the death check
 * uses: `monitorStatus(m, body)` is dead when Physical − 10 ≥ Body). Greyed (idle) until the Physical
 * track is full; the last box is death.
 */
export function overflowView(physical: number, body: number): OverflowView {
  const b = Math.max(0, Math.floor(Number(body) || 0));
  const over = Math.max(0, Math.floor(Number(physical) || 0) - RULES.MONITOR_BOXES);
  // v0.80.0 (RULES.URR_V80.hsDeathPastOverflow): one more box, the death box, past the Body boxes. v0.81.1 (SEC2b-1):
  // at most MAX_OVERFLOW_BOXES, so a huge Body (a player writes their own) can't build millions of boxes on the GM's client.
  const n = Math.min(MAX_OVERFLOW_BOXES, b + deathBoxExtra());
  const boxes: MonitorBox[] = Array.from({ length: n }, (_, i) => ({
    value: RULES.MONITOR_BOXES + i + 1, filled: over >= i + 1, dead: i === n - 1,
  }));
  return {
    body: b, filled: Math.min(over, n), idle: physical < RULES.MONITOR_BOXES, boxes,
    title: tx('SR2E.Text.Look.overflowTitle', { body: b }),
  };
}

/** Both tracks of a character, NPC or spirit, with the overflow row where the rules have one (not spirits). */
export function monitorView(monitor: { physical?: number; stun?: number } | null | undefined, body: number,
  opts: { overflow?: boolean } = {}): {
    physical: TrackView; stun: TrackView; overflow: OverflowView | null; extraStun: number;
    /** Both tracks with a one-letter name, for the small read-only monitor. */
    tracks: Array<TrackView & { short: string }>;
  } {
  const p = Number(monitor?.physical ?? 0) || 0;
  const s = Number(monitor?.stun ?? 0) || 0;
  const physical = trackView('physical', p);
  const stun = trackView('stun', s);
  return {
    physical, stun,
    overflow: opts.overflow === false ? null : overflowView(p, body),
    extraStun: Math.max(0, s - RULES.MONITOR_BOXES),
    tracks: [{ ...physical, short: tx('SR2E.Text.Look.physicalShort') }, { ...stun, short: tx('SR2E.Text.Look.stunShort') }],
  };
}

// ---------------------------------------------------------------- Chat cards: the area colour

const KIND_AREA: Record<string, AreaId> = {
  attack: 'combat', defend: 'combat',
  spell: 'magic', conjure: 'magic', banish: 'magic', dispel: 'magic', barrier: 'magic', track: 'magic', enchant: 'magic', quest: 'magic',
  cleanse: 'magic', divine: 'magic', invoke: 'magic', design: 'magic', learn: 'magic', ward: 'magic', bindName: 'magic',
  centering: 'magic', assense: 'magic',
  system: 'matrix', code: 'matrix', psyche: 'matrix', jackOut: 'matrix', mperceive: 'matrix', maneuver: 'matrix', mutility: 'matrix', repair: 'matrix',
  drive: 'rigging', sensor: 'rigging', install: 'rigging',
  bypass: 'street', notice: 'street',
  heal: 'health', medic: 'health', surgery: 'health', cyberRepair: 'health', addiction: 'health', disease: 'health', rejection: 'health',
};

/** The area a test card belongs to (its header strip colour), or 'neutral' for the accent colour. */
export function cardArea(snap: { kind?: string; soak?: { noun?: string; track?: string } | null; spell?: unknown } | null | undefined): AreaId | 'neutral' {
  if (!snap?.kind) return 'neutral';
  if (snap.kind === 'soak') {
    if (snap.soak?.noun === 'drain') return 'magic';
    if (snap.soak?.track === 'vehicle') return 'rigging';
    return 'health';
  }
  return own(KIND_AREA, snap.kind) ?? 'neutral';
}

/** The card header's title word for a kind of test. */
export function cardKindLabel(kind: string | undefined): string {
  const words: Record<string, () => string> = {
    attack: () => tx('SR2E.Text.Look.attack'), defend: () => tx('SR2E.Text.Look.defense'), soak: () => tx('SR2E.Text.Look.resist'),
    spell: () => tx('SR2E.Text.Look.spell'), conjure: () => tx('SR2E.Text.Look.conjuring'), banish: () => tx('SR2E.Text.Look.banishing'),
    dispel: () => tx('SR2E.Text.Look.dispelling'), heal: () => tx('SR2E.Text.Look.healing'), medic: () => tx('SR2E.Text.Look.firstAid'),
    surgery: () => tx('SR2E.Text.Look.surgery'), system: () => tx('SR2E.Text.Look.matrix'), code: () => tx('SR2E.Text.Look.programming'),
    drive: () => tx('SR2E.Text.Look.driving'), sensor: () => tx('SR2E.Text.Look.sensors'), bypass: () => tx('SR2E.Text.Look.security'),
    notice: () => tx('SR2E.Text.Look.perception'), plain: () => tx('SR2E.Text.Look.test'),
  };
  return own(words, kind)?.() ?? '';

}

// ---------------------------------------------------------------- Portraits found by name

export const PORTRAIT_EXTS = ['webp', 'png', 'jpg', 'jpeg', 'avif'] as const;

/** A name as a loose key: lower case, accents and anything but letters and digits dropped. */
export function portraitKey(s: string): string {
  return String(s ?? '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function stemAndExt(path: string): { stem: string; ext: string } {
  let file = String(path).split(/[\\/]/).pop() ?? '';
  try { file = decodeURIComponent(file); } catch { /* keep it */ }
  const dot = file.lastIndexOf('.');
  return dot > 0 ? { stem: file.slice(0, dot), ext: file.slice(dot + 1).toLowerCase() } : { stem: file, ext: '' };
}

/**
 * The picture in a folder listing that belongs to a name: "Rook" takes `avatars/Rook.webp` (then .png, .jpg…).
 * An exact (case-blind) file name wins over a loose one ("Mr. Johnson" → `mr_johnson.png`). Null when none.
 */
export function portraitFor(name: string, files: readonly string[]): string | null {
  const want = String(name ?? '').trim();
  if (!want) return null;
  const rank = (ext: string) => (PORTRAIT_EXTS as readonly string[]).indexOf(ext);
  const usable = files.map((f) => ({ f, ...stemAndExt(f) })).filter((x) => rank(x.ext) >= 0);
  const pick = (list: typeof usable) => list.sort((a, b) => rank(a.ext) - rank(b.ext))[0]?.f ?? null;
  const exact = usable.filter((x) => x.stem.toLowerCase() === want.toLowerCase());
  if (exact.length) return pick(exact);
  const key = portraitKey(want);
  if (!key) return null;
  return pick(usable.filter((x) => portraitKey(x.stem) === key));
}

/** Foundry's and the system's stand-in pictures: a portrait set by hand is never one of these. */
export const DEFAULT_PORTRAITS = ['icons/svg/mystery-man.svg', 'icons/svg/mystery-man-black.svg'] as const;
export function isDefaultPortrait(src: string | null | undefined, extra: readonly string[] = []): boolean {
  const s = String(src ?? '').trim();
  // Only Foundry's stand-in (and any default the caller names): other icons/svg/ pictures were chosen by someone.
  // v0.83.0: the system's own default token art counts as a stand-in too (a portrait found by name replaces it).
  return !s || (DEFAULT_PORTRAITS as readonly string[]).includes(s) || extra.includes(s) || isDefaultArt(s);
}

/** Whether the name lookup may (re)place this picture: a stand-in, or the picture it put there itself before. */
export function portraitReplaceable(src: string | null | undefined, autoSrc: string | null | undefined, extraDefaults: readonly string[] = []): boolean {
  return isDefaultPortrait(src, extraDefaults) || (!!autoSrc && String(src ?? '') === String(autoSrc));
}

/** A folder setting cleaned up: no leading or trailing slashes, no `..`. */
export function cleanFolder(v: unknown): string {
  const s = String(v ?? '').trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  if (s.split('/').some((p) => p === '..')) return '';
  return s;
}
