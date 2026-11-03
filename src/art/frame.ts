/**
 * v0.83.0: the default token art's shared frame. The system's own art, drawn by Claude (AI) for this system:
 * no book art, no logos, no brand marks, no text. Never imported by the shipped code: `scripts/build-tokens.ts`
 * turns these drawings into the SVG files under `public/tokens/`.
 *
 * The style ("neon noir"): a round gunmetal token with a coloured rim; the subject a duotone silhouette
 * (the STEEL tones) lit from behind by a rim light in the rim colour, with a few glowing details.
 * Every drawing works in a 256 × 256 box; the token circle is centred at (128, 128), radius 120,
 * and the subject is clipped to the inner circle (radius 112).
 */
import { palette } from '../module/rules/look.ts';

/** Steel tones for the subject, darkest first. */
export const STEEL = {
  void: '#0b0d10', deep: '#15181c', dark: '#1f242b', mid: '#2c333c', base: '#3a424d', light: '#55606d', pale: '#8a96a3', ink: '#e6e9ed',
} as const;

/**
 * Rim colours: one colour per area, everywhere (v0.84.1). The six areas are the Street theme's own area colours
 * (rules/look.ts), so a vehicle's token matches the vehicle sheet and the Rigging tab, a spirit's matches the
 * Magic tab, and so on. Security (guards and secured sites) has its own blue; plain portraits and mundane
 * critters are neutral. The rim says what kind of thing a token is; the subject keeps its own colours (a fire
 * elemental's flames, black IC's red eyes). `src/module/__tests__/v0841.test.ts` keeps every pair apart with each
 * kind of colour blindness.
 */
const AREA = palette('street', 'cyan').areas;
export const RIM = {
  combat: AREA.combat.base, magic: AREA.magic.base, matrix: AREA.matrix.base, rigging: AREA.rigging.base,
  street: AREA.street.base, health: AREA.health.base,
  security: '#94b6ff', plain: '#b4beca', critter: '#b99b7a',
} as const;
export type RimId = keyof typeof RIM;

export const SIZE = 256;
export const C = 128;
export const R_OUTER = 120;
export const R_INNER = 112;

/** Mixes two #rrggbb colours (t = 0 gives a, 1 gives b). */
export function mix(a: string, b: string, t: number): string {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return '#' + x.map((v, i) => Math.round(v + (y[i]! - v) * t).toString(16).padStart(2, '0')).join('');
}

/** A number for SVG, at most one decimal. */
export const n = (v: number): string => String(Math.round(v * 10) / 10);

export interface TokenSpec {
  /** File-safe id, used as the gradient-id prefix too. */
  id: string;
  /** What it shows, for the SVG <title> (screen readers, hover in a file browser). */
  title: string;
  /** Rim colour: a RIM value (the token's category). */
  rim: string;
  /** The subject: SVG markup drawn in the 256 box (clipped to the inner circle). May use `url(#<id>-glow)` (blur filter). */
  body: string;
  /** Optional badge: an emblem drawn in a 64 × 64 box, placed in a small disc at the lower right. */
  badge?: { rim: string; body: string };
  /** Background: 'steel' (default), 'astral' (purple haze), 'grid' (Matrix green grid), 'night' (blue-black). */
  bg?: 'steel' | 'astral' | 'grid' | 'night';
}

function background(id: string, rim: string, kind: TokenSpec['bg']): string {
  const inner = kind === 'astral' ? mix('#1c1630', rim, 0.12) : kind === 'grid' ? '#0f1d17' : kind === 'night' ? '#121722' : '#232931';
  const outer = kind === 'astral' ? '#0b0912' : kind === 'grid' ? '#070d0a' : kind === 'night' ? '#07090e' : '#0d1013';
  let extra = '';
  if (kind === 'grid') {
    const lines: string[] = [];
    for (let v = 32; v < 256; v += 32) lines.push(`M${v} 0V256M0 ${v}H256`);
    extra = `<path d="${lines.join('')}" stroke="${rim}" stroke-opacity=".14" stroke-width="1" fill="none"/>`;
  } else {
    // Faint horizontal scan lines, the system's "screen" texture.
    const lines: string[] = [];
    for (let v = 20; v < 256; v += 12) lines.push(`M0 ${v}H256`);
    extra = `<path d="${lines.join('')}" stroke="${rim}" stroke-opacity=".05" stroke-width="2" fill="none"/>`;
  }
  return `<radialGradient id="${id}-bg" cx="50%" cy="38%" r="65%"><stop offset="0" stop-color="${inner}"/><stop offset="1" stop-color="${outer}"/></radialGradient>`
    + `|<circle cx="${C}" cy="${C}" r="${R_INNER}" fill="url(#${id}-bg)"/>${extra}`;
}

/** The finished SVG file text of one token. */
export function token(spec: TokenSpec): string {
  const { id, rim } = spec;
  const [bgDef, bgBody] = background(id, rim, spec.bg ?? 'steel').split('|');
  const defs = [
    `<clipPath id="${id}-clip"><circle cx="${C}" cy="${C}" r="${R_INNER}"/></clipPath>`,
    `<filter id="${id}-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter>`,
    `<linearGradient id="${id}-rim" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${mix(rim, '#ffffff', 0.25)}"/><stop offset=".5" stop-color="${rim}"/><stop offset="1" stop-color="${mix(rim, '#000000', 0.45)}"/></linearGradient>`,
    bgDef,
  ];
  let badge = '';
  if (spec.badge) {
    const bx = 196; const by = 196; const br = 38;
    badge = `<g><circle cx="${bx}" cy="${by}" r="${br + 4}" fill="${STEEL.void}"/>`
      + `<circle cx="${bx}" cy="${by}" r="${br}" fill="${mix(spec.badge.rim, STEEL.deep, 0.82)}" stroke="${spec.badge.rim}" stroke-width="4"/>`
      + `<g transform="translate(${bx - 26} ${by - 26}) scale(${n(52 / 64)})">${spec.badge.body}</g></g>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}">`
    + `<title>${esc(spec.title)}</title><defs>${defs.join('')}</defs>`
    + `<circle cx="${C}" cy="${C}" r="${R_OUTER + 4}" fill="${STEEL.void}"/>`
    + `<g clip-path="url(#${id}-clip)">${bgBody}${spec.body}</g>`
    + `<circle cx="${C}" cy="${C}" r="${R_OUTER - 4}" fill="none" stroke="url(#${id}-rim)" stroke-width="8"/>`
    + `<circle cx="${C}" cy="${C}" r="${R_INNER}" fill="none" stroke="${STEEL.void}" stroke-opacity=".6" stroke-width="2"/>`
    + badge + `</svg>`;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** One entry the build script writes: `public/tokens/<file>`. */
export interface ArtFile { file: string; svg: string }
