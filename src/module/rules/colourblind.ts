/**
 * v0.84.1: how far apart two colours look, with normal colour vision and with each of the three kinds of
 * colour blindness. Pure maths, no Foundry. The palette test (`src/module/__tests__/v0841.test.ts`) uses it to keep
 * the sheets' area colours and the token rims apart, the way `contrastPairs` in look.ts keeps text readable.
 *
 * Colour blindness is simulated with the Machado, Oliveira and Fernandes (2009) matrices at full severity
 * (protanopia, deuteranopia, tritanopia), applied to linear sRGB. The distance is CIEDE2000 in CIELAB (D65).
 * A distance of about 2 is barely visible side by side; the system asks for at least `CVD_MIN` between any two
 * colours that mean different things.
 */

export const CVD_KINDS = ['normal', 'protan', 'deutan', 'tritan'] as const;
export type CvdKind = typeof CVD_KINDS[number];

/** The smallest distance the palettes keep between two colours that mean different things. */
export const CVD_MIN = 11.5;
/** The floor for the area heading colours (text under its own tab, never compared side by side). */
export const CVD_TEXT_MIN = 6;
/** A lower floor for the rare preset swap (the Matrix area's cyan on the Phosphor green preset of High contrast). */
export const CVD_MIN_SWAP = 8.5;

type Vec = [number, number, number];

const MACHADO: Record<Exclude<CvdKind, 'normal'>, [Vec, Vec, Vec]> = {
  protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
  tritan: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.303900]],
};

function toLinear(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function rgb(hex: string): Vec {
  // Only #rgb and #rrggbb: anything else (a colour name, a typo) would otherwise read as black and pass or fail for the wrong reason.
  if (!/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex)) throw new Error(`Not a #rrggbb colour: ${hex}`);
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const v = parseInt(full, 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

/** The colour in linear sRGB as someone with that kind of vision sees it. */
export function simulate(hex: string, kind: CvdKind): Vec {
  const l = rgb(hex).map(toLinear) as Vec;
  if (kind === 'normal') return l;
  const m = MACHADO[kind];
  return m.map((row) => Math.min(1, Math.max(0, row[0] * l[0] + row[1] * l[1] + row[2] * l[2]))) as Vec;
}

function lab([r, g, b]: Vec): Vec {
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const [fx, fy, fz] = [f(x), f(y), f(z)];
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/** CIEDE2000 colour difference of two CIELAB colours. */
export function deltaE2000(a: Vec, b: Vec): number {
  const [L1, a1, b1] = a; const [L2, a2, b2] = b;
  const Cb = (Math.hypot(a1, b1) + Math.hypot(a2, b2)) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)));
  const a1p = (1 + G) * a1; const a2p = (1 + G) * a2;
  const C1p = Math.hypot(a1p, b1); const C2p = Math.hypot(a2p, b2);
  const h1 = (deg(Math.atan2(b1, a1p)) + 360) % 360; const h2 = (deg(Math.atan2(b2, a2p)) + 360) % 360;
  const dL = L2 - L1; const dC = C2p - C1p;
  let dh = 0;
  if (C1p * C2p !== 0) dh = Math.abs(h2 - h1) <= 180 ? h2 - h1 : (h2 > h1 ? h2 - h1 - 360 : h2 - h1 + 360);
  const dH = 2 * Math.sqrt(C1p * C2p) * Math.sin(rad(dh / 2));
  const Lb = (L1 + L2) / 2; const Cbp = (C1p + C2p) / 2;
  let hb = h1 + h2;
  if (C1p * C2p !== 0) hb = Math.abs(h1 - h2) <= 180 ? (h1 + h2) / 2 : (h1 + h2 < 360 ? (h1 + h2 + 360) / 2 : (h1 + h2 - 360) / 2);
  const T = 1 - 0.17 * Math.cos(rad(hb - 30)) + 0.24 * Math.cos(rad(2 * hb)) + 0.32 * Math.cos(rad(3 * hb + 6)) - 0.2 * Math.cos(rad(4 * hb - 63));
  const dt = 30 * Math.exp(-(((hb - 275) / 25) ** 2));
  const Rc = 2 * Math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7));
  const Sl = 1 + (0.015 * (Lb - 50) ** 2) / Math.sqrt(20 + (Lb - 50) ** 2);
  const Sc = 1 + 0.045 * Cbp; const Sh = 1 + 0.015 * Cbp * T;
  const Rt = -Math.sin(rad(2 * dt)) * Rc;
  return Math.sqrt((dL / Sl) ** 2 + (dC / Sc) ** 2 + (dH / Sh) ** 2 + Rt * (dC / Sc) * (dH / Sh));
}

/** How far apart two colours look with one kind of vision. */
export function distanceFor(a: string, b: string, kind: CvdKind): number {
  return deltaE2000(lab(simulate(a, kind)), lab(simulate(b, kind)));
}

/** The smallest distance over normal vision and the three kinds of colour blindness, and which kind gave it. */
export function cvdDistance(a: string, b: string): { distance: number; kind: CvdKind } {
  let best = { distance: Infinity, kind: 'normal' as CvdKind };
  for (const kind of CVD_KINDS) {
    const d = distanceFor(a, b, kind);
    if (d < best.distance) best = { distance: d, kind };
  }
  return best;
}

export interface CvdClash { a: string; b: string; distance: number; kind: CvdKind }

/** Every pair of named colours closer than `min` for some kind of vision (empty when the set passes). */
export function cvdClashes(colours: Record<string, string>, min = CVD_MIN, skip: Array<[string, string]> = []): CvdClash[] {
  const names = Object.keys(colours);
  const skipped = (x: string, y: string) => skip.some(([p, q]) => (p === x && q === y) || (p === y && q === x));
  const out: CvdClash[] = [];
  for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
    const [a, b] = [names[i]!, names[j]!];
    if (skipped(a, b)) continue;
    const { distance, kind } = cvdDistance(colours[a]!, colours[b]!);
    if (distance < min) out.push({ a, b, distance, kind });
  }
  return out;
}
