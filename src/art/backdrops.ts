/**
 * The built-in scene backdrops' drawings. The system's own art, drawn by Claude (AI) for this system: no book art,
 * no logos, no brand marks, no text. Never imported by the shipped code: `scripts/build-backdrops.ts` writes these
 * to `public/backdrops/<id>.svg`.
 *
 * Every wall, window, door and obstacle is drawn from the shipped geometry (`rules/backdrops.ts`: its plan lines and
 * parts), so the Scene builder's walls match the picture; each map's painter adds only floors and flat decoration
 * (paint, puddles, texture, glow). The style is the token art's "neon noir": steel duotone, rain-wet, warm lamp pools
 * and a few neon accents. Everything is drawn in metres inside `<g transform="scale(100)">` (100 px a metre).
 */
import { readFileSync } from 'node:fs';
import { BACKDROPS, backdropPlan, linePieces, type Backdrop, type BackdropLine, type BackdropPart, type BackdropSeg } from '../module/rules/backdrops.ts';
import { palette } from '../module/rules/look.ts';
import { STEEL, mix } from './frame.ts';

const AREA = palette('street', 'cyan').areas;
const GREEN = AREA.matrix.base;
const VIOLET = AREA.magic.base;
const CYAN = '#50d6de';
const MAGENTA = '#e04fb0';
const AMBER = '#ebca6e';
const DOOR = '#c98a3c';

const EN: Record<string, { label: string; hint: string }> = JSON.parse(readFileSync(new URL('../../scripts/backdrops-en.json', import.meta.url), 'utf8'));

/** A number for SVG in metres, at most two decimals. */
const f = (v: number): string => String(Math.round(v * 100) / 100);

/** A small seeded PRNG (mulberry32): the same picture every build. */
function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const seedOf = (s: string): number => [...s].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);

interface R { x: number; y: number; w: number; h: number }

/** The picture being drawn: its defs and body (both SVG text), its seeded random numbers. */
class Pic {
  defs: string[] = [];
  out: string[] = [];
  rnd: () => number;
  private n = 0;
  constructor(readonly b: Backdrop) { this.rnd = prng(seedOf(b.id)); }
  add(s: string): void { this.out.push(s); }
  def(s: string): void { this.defs.push(s); }
  uid(name: string): string { return `${name}${++this.n}`; }
  r(a: number, b: number): number { return a + (b - a) * this.rnd(); }
  pick<T>(xs: readonly T[]): T { return xs[Math.floor(this.rnd() * xs.length)]!; }

  rect(r: R, fill: string, more = ''): void {
    this.add(`<rect x="${f(r.x)}" y="${f(r.y)}" width="${f(r.w)}" height="${f(r.h)}" fill="${fill}"${more ? ' ' + more : ''}/>`);
  }
  /** A speckled texture tile (asphalt, concrete, gravel, soil): returns the fill. */
  speckle(base: string, tile: number, count: number, tones: string[], size: [number, number], opacity = 0.5): string {
    const id = this.uid('tex');
    const dots: string[] = [];
    for (let i = 0; i < count; i++) {
      const s = this.r(size[0], size[1]);
      dots.push(`<rect x="${f(this.r(0, tile - s))}" y="${f(this.r(0, tile - s))}" width="${f(s)}" height="${f(s * this.r(0.6, 1.4))}" fill="${this.pick(tones)}"/>`);
    }
    this.def(`<pattern id="${id}" patternUnits="userSpaceOnUse" width="${tile}" height="${tile}"><rect width="${tile}" height="${tile}" fill="${base}"/><g opacity="${opacity}">${dots.join('')}</g></pattern>`);
    return `url(#${id})`;
  }
  /** Slabs or tiles: a speckled base with seams every `cell` metres. */
  slabs(base: string, cell: number, seam: string, seamW = 0.03, specks = 30): string {
    const tile = cell * 2;
    const id = this.uid('slab');
    const dots: string[] = [];
    for (let i = 0; i < specks; i++) {
      const s = this.r(0.02, 0.07);
      dots.push(`<rect x="${f(this.r(0, tile))}" y="${f(this.r(0, tile))}" width="${f(s)}" height="${f(s)}" fill="${this.pick([mix(base, '#000000', 0.25), mix(base, '#ffffff', 0.08)])}"/>`);
    }
    const tint = (x: number, y: number) => `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" fill="${mix(base, this.pick(['#000000', '#ffffff']), this.r(0.01, 0.05))}"/>`;
    this.def(`<pattern id="${id}" patternUnits="userSpaceOnUse" width="${tile}" height="${tile}"><rect width="${tile}" height="${tile}" fill="${base}"/>`
      + tint(0, 0) + tint(cell, 0) + tint(0, cell) + tint(cell, cell)
      + `<g opacity=".6">${dots.join('')}</g><path d="M0 0H${tile}M0 ${cell}H${tile}M0 0V${tile}M${cell} 0V${tile}" stroke="${seam}" stroke-width="${seamW}" fill="none"/></pattern>`);
    return `url(#${id})`;
  }
  /** A radial glow fill in one colour. */
  glow(color: string, opacity = 0.3): string {
    const id = this.uid('glow');
    this.def(`<radialGradient id="${id}"><stop offset="0" stop-color="${color}" stop-opacity="${opacity}"/><stop offset=".45" stop-color="${color}" stop-opacity="${f(opacity * 0.4)}"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient>`);
    return `url(#${id})`;
  }
  blur(sd: number): string {
    const id = this.uid('blur');
    this.def(`<filter id="${id}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${sd}"/></filter>`);
    return `url(#${id})`;
  }
  /** Soft blotches (stains, damp, haze) over an area, kept inside it. */
  blotches(area: R, n: number, colors: string[], rad: [number, number], opacity: number, sd = 0.6): void {
    const fl = this.blur(sd);
    const cid = this.uid('clip');
    this.def(`<clipPath id="${cid}"><rect x="${f(area.x)}" y="${f(area.y)}" width="${f(area.w)}" height="${f(area.h)}"/></clipPath>`);
    const xs: string[] = [];
    for (let i = 0; i < n; i++) {
      const rx = this.r(rad[0], rad[1]);
      xs.push(`<ellipse cx="${f(this.r(area.x, area.x + area.w))}" cy="${f(this.r(area.y, area.y + area.h))}" rx="${f(rx)}" ry="${f(rx * this.r(0.4, 1))}" fill="${this.pick(colors)}"/>`);
    }
    this.add(`<g clip-path="url(#${cid})"><g filter="${fl}" opacity="${opacity}">${xs.join('')}</g></g>`);
  }
  /** Rain puddles: dark wet patches with a sheen of the nearest neon. */
  puddles(spots: Array<[number, number, number, string?]>): void {
    for (const [x, y, s, c] of spots) {
      const tint = c ?? '#9fb4c8';
      const pts: string[] = [];
      const k = 7;
      for (let i = 0; i < k; i++) {
        const a = (i / k) * Math.PI * 2;
        const rr = s * this.r(0.7, 1.1);
        pts.push(`${f(x + Math.cos(a) * rr * 1.5)} ${f(y + Math.sin(a) * rr * 0.8)}`);
      }
      const g = this.glow(tint, 0.22);
      this.add(`<path d="M${pts.join('L')}Z" fill="#0d1116" fill-opacity=".32" stroke="${mix(tint, '#ffffff', 0.4)}" stroke-opacity=".14" stroke-width=".03" stroke-linejoin="round"/>`
        + `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(s * 1.2)}" ry="${f(s * 0.5)}" fill="${g}"/>`
        + `<path d="M${f(x - s * 0.6)} ${f(y - s * 0.15)}q${f(s * 0.6)} ${f(-s * 0.25)} ${f(s * 1.2)} 0" stroke="#ffffff" stroke-opacity=".12" stroke-width=".03" fill="none"/>`);
    }
  }
  /** Lamp pools under every light of the map (Foundry adds its own light on top; this is the painted ambience). */
  pools(strength = 0.22): void {
    for (const l of this.b.lights) {
      const g = this.glow(l.color ?? '#ffd59a', strength);
      this.add(`<circle cx="${f(l.x)}" cy="${f(l.y)}" r="${f(l.dim * 0.8)}" fill="${g}"/>`);
    }
  }
  /** Ceiling tubes or lamp heads at the lights (indoors). */
  fixtures(shape: 'tube' | 'dot' = 'tube'): void {
    const fl = this.blur(0.12);
    for (const l of this.b.lights) {
      const c = l.color ?? '#ffe2b0';
      if (shape === 'tube') {
        this.add(`<rect x="${f(l.x - 0.6)}" y="${f(l.y - 0.08)}" width="1.2" height=".16" rx=".05" fill="${c}" filter="${fl}" opacity=".8"/>`
          + `<rect x="${f(l.x - 0.55)}" y="${f(l.y - 0.04)}" width="1.1" height=".08" rx=".03" fill="${mix(c, '#ffffff', 0.6)}"/>`);
      } else {
        this.add(`<circle cx="${f(l.x)}" cy="${f(l.y)}" r=".22" fill="${c}" filter="${fl}" opacity=".85"/><circle cx="${f(l.x)}" cy="${f(l.y)}" r=".08" fill="${mix(c, '#ffffff', 0.6)}"/>`);
      }
    }
  }
}

// ---------------------------------------------------------------- Walls, windows, doors (from the geometry)

const segPath = (segs: BackdropSeg[]): string => segs.map(([a, b, c, d]) => `M${f(a)} ${f(b)}L${f(c)} ${f(d)}`).join('');

const WALL_LOOK: Record<string, { body: string; w: number }> = {
  concrete: { body: '#7f8996', w: 0.3 },
  facade: { body: '#8a94a0', w: 0.4 },
  brick: { body: mix(STEEL.pale, '#9a6a55', 0.35), w: 0.36 },
  timber: { body: '#7a6650', w: 0.2 },
};

function drawWalls(p: Pic, lines: BackdropLine[]): void {
  const by = new Map<string, BackdropSeg[]>();
  for (const l of lines) if (l.kind === 'wall') {
    const runs = linePieces(l).runs;
    by.set(l.look, [...(by.get(l.look) ?? []), ...runs]);
  }
  for (const [look, segs] of by) {
    const s = WALL_LOOK[look] ?? WALL_LOOK['concrete']!;
    const d = segPath(segs);
    if (look === 'timber') {
      // Weathered planks: a dark edge, the boards, and a few broken ends.
      p.add(`<path d="${d}" stroke="${STEEL.void}" stroke-width="${s.w + 0.1}" stroke-linecap="square" fill="none"/>`
        + `<path d="${d}" stroke="${s.body}" stroke-width="${s.w}" stroke-linecap="square" fill="none"/>`
        + `<path d="${d}" stroke="${mix(s.body, '#000000', 0.45)}" stroke-width="${s.w}" stroke-dasharray=".06 .34" fill="none"/>`);
      continue;
    }
    p.add(`<path d="${d}" stroke="#000000" stroke-opacity=".45" stroke-width="${s.w + 0.35}" stroke-linecap="square" fill="none" transform="translate(.08 .1)"/>`
      + `<path d="${d}" stroke="${STEEL.void}" stroke-width="${s.w + 0.1}" stroke-linecap="square" fill="none"/>`
      + `<path d="${d}" stroke="${s.body}" stroke-width="${s.w}" stroke-linecap="square" fill="none"/>`
      + `<path d="${d}" stroke="${mix(s.body, '#ffffff', 0.35)}" stroke-width="${f(s.w * 0.22)}" stroke-linecap="square" fill="none"/>`);
    if (look === 'brick') p.add(`<path d="${d}" stroke="${mix(s.body, '#000000', 0.4)}" stroke-width="${s.w}" stroke-dasharray=".04 .26" fill="none"/>`);
  }
}

function drawLowLines(p: Pic, lines: BackdropLine[]): void {
  const by = new Map<string, BackdropSeg[]>();
  const panes: BackdropSeg[] = [];
  for (const l of lines) {
    const pc = linePieces(l);
    panes.push(...pc.panes);
    if (l.kind === 'window') by.set(l.look, [...(by.get(l.look) ?? []), ...pc.runs]);
  }
  const glass = [...panes, ...(by.get('glass') ?? [])];
  by.delete('glass');
  if (glass.length) {
    const d = segPath(glass);
    const fl = p.blur(0.12);
    p.add(`<path d="${d}" stroke="${STEEL.void}" stroke-width=".22" fill="none"/>`
      + `<path d="${d}" stroke="${CYAN}" stroke-opacity=".5" stroke-width=".3" fill="none" filter="${fl}"/>`
      + `<path d="${d}" stroke="#bfeff3" stroke-width=".08" fill="none"/>`
      + `<path d="${d}" stroke="${STEEL.pale}" stroke-width=".22" stroke-dasharray=".08 1.42" fill="none"/>`);
  }
  for (const [look, segs] of by) {
    const d = segPath(segs);
    if (look === 'parapet') {
      p.add(`<path d="${d}" stroke="#000000" stroke-opacity=".4" stroke-width=".7" stroke-linecap="square" fill="none" transform="translate(.1 .12)"/>`
        + `<path d="${d}" stroke="${STEEL.void}" stroke-width=".42" stroke-linecap="square" fill="none"/>`
        + `<path d="${d}" stroke="#6b7582" stroke-width=".34" stroke-linecap="square" fill="none"/>`
        + `<path d="${d}" stroke="#9aa5b1" stroke-width=".06" stroke-linecap="square" fill="none"/>`
        + `<path d="${d}" stroke="${STEEL.dark}" stroke-width=".34" stroke-dasharray=".03 .97" fill="none"/>`);
    } else if (look === 'fence') {
      const id = p.uid('mesh');
      p.def(`<pattern id="${id}" patternUnits="userSpaceOnUse" width=".2" height=".2"><path d="M0 0L.2 .2M.2 0L0 .2" stroke="#b7c2cd" stroke-width=".02"/></pattern>`);
      const posts: string[] = [];
      for (const [a, b, c, e] of segs) {
        const len = Math.hypot(c - a, e - b);
        const k = Math.max(1, Math.round(len / 2));
        for (let i = 0; i <= k; i++) posts.push(`<circle cx="${f(a + ((c - a) * i) / k)}" cy="${f(b + ((e - b) * i) / k)}" r=".08" fill="#9aa6b3" stroke="${STEEL.void}" stroke-width=".03"/>`);
      }
      p.add(`<path d="${d}" stroke="url(#${id})" stroke-width=".16" fill="none"/><path d="${d}" stroke="#aab5c0" stroke-width=".035" fill="none"/>${posts.join('')}`);
    } else if (look === 'partition') {
      p.add(`<path d="${d}" stroke="${STEEL.void}" stroke-width=".18" stroke-linecap="square" fill="none"/>`
        + `<path d="${d}" stroke="#5d6b80" stroke-width=".12" stroke-linecap="square" fill="none"/>`
        + `<path d="${d}" stroke="#8ea0b8" stroke-width=".03" fill="none"/>`);
    } else if (look === 'stage') {
      const fl = p.blur(0.1);
      p.add(`<path d="${d}" stroke="${STEEL.void}" stroke-width=".22" stroke-linecap="square" fill="none"/>`
        + `<path d="${d}" stroke="${CYAN}" stroke-width=".22" fill="none" filter="${fl}" opacity=".8"/>`
        + `<path d="${d}" stroke="#c8f6f9" stroke-width=".06" fill="none"/>`);
    } else if (look === 'curb') {
      p.add(`<path d="${d}" stroke="${STEEL.void}" stroke-width=".4" stroke-linecap="square" fill="none"/>`
        + `<path d="${d}" stroke="${mix(AMBER, STEEL.mid, 0.25)}" stroke-width=".3" stroke-linecap="square" fill="none"/>`
        + `<path d="${d}" stroke="${STEEL.deep}" stroke-width=".3" stroke-dasharray=".5 .5" fill="none"/>`);
    } else if (look === 'edge') {
      const fl = p.blur(0.15);
      p.add(`<path d="${d}" stroke="${GREEN}" stroke-width=".36" fill="none" filter="${fl}" opacity=".7"/>`
        + `<path d="${d}" stroke="${mix(GREEN, '#ffffff', 0.45)}" stroke-width=".1" stroke-linecap="square" fill="none"/>`);
    } else {
      p.add(`<path d="${d}" stroke="${STEEL.pale}" stroke-width=".15" fill="none"/>`);
    }
  }
}

function drawDoors(p: Pic, lines: BackdropLine[]): void {
  const led = p.blur(0.06);
  for (const l of lines) for (const d of l.doors ?? []) {
    const horiz = l.c[1] === l.c[3];
    const [a, b] = d.at;
    const len = b - a;
    const look = d.look ?? 'swing';
    // In the line's own frame: along = x, across = y, drawn rotated for vertical lines.
    // Local -y is north for a horizontal line, east for a vertical one; the arc and the maglock pad go on the side
    // toward the middle of the map (the floor side of an outer wall).
    const inward = horiz ? l.c[1] > p.b.height / 2 : l.c[0] < p.b.width / 2;
    const at = (horiz ? `translate(${f(a)} ${f(l.c[1])})` : `translate(${f(l.c[0])} ${f(a)}) rotate(90)`) + (inward ? '' : ` scale(1 -1)`);
    let g = '';
    const frame = `<rect x="-.08" y="-.2" width=".16" height=".4" fill="${STEEL.light}" stroke="${STEEL.void}" stroke-width=".04"/><rect x="${f(len - 0.08)}" y="-.2" width=".16" height=".4" fill="${STEEL.light}" stroke="${STEEL.void}" stroke-width=".04"/>`;
    if (look === 'roll') {
      const ribs: string[] = [];
      for (let x = 0.2; x < len; x += 0.2) ribs.push(`M${f(x)} -.14V.14`);
      const hz: string[] = [];
      for (let x = 0; x < len; x += 0.3) hz.push(`<rect x="${f(x)}" y=".14" width=".15" height=".1" fill="${STEEL.void}"/>`);
      g = `<rect x="0" y="-.14" width="${f(len)}" height=".38" fill="${AMBER}"/>${hz.join('')}`
        + `<rect x="0" y="-.14" width="${f(len)}" height=".28" fill="#8d969f" stroke="${STEEL.void}" stroke-width=".04"/><path d="${ribs.join('')}" stroke="${STEEL.base}" stroke-width=".04"/>` + frame;
    } else if (look === 'glass') {
      const fl = p.blur(0.08);
      g = `<rect x="0" y="-.12" width="${f(len)}" height=".24" fill="${CYAN}" opacity=".5" filter="${fl}"/><rect x=".05" y="-.07" width="${f(len - 0.1)}" height=".14" fill="#2a4a55" stroke="#bfeff3" stroke-width=".04"/>`
        + `<circle cx="${f(len / 2 - 0.15)}" cy="0" r=".04" fill="#e6f8fa"/><circle cx="${f(len / 2 + 0.15)}" cy="0" r=".04" fill="#e6f8fa"/>`
        + `<path d="M${f(len / 2)} -.1V.1" stroke="${STEEL.pale}" stroke-width=".05"/>` + frame;
    } else if (look === 'elevator') {
      g = `<rect x="0" y="-.12" width="${f(len)}" height=".24" fill="#aab5c0" stroke="${STEEL.void}" stroke-width=".04"/><path d="M${f(len / 2)} -.12V.12" stroke="${STEEL.void}" stroke-width=".05"/>`
        + `<rect x="${f(len / 2 - 0.5)}" y="-.32" width="1" height=".12" fill="${STEEL.void}"/>` + frame;
    } else {
      const leaves = look === 'double' ? [[0, len / 2], [len / 2, len]] : [[0, len]];
      g = leaves.map(([s, e]) => `<rect x="${f(s! + 0.03)}" y="-.09" width="${f(e! - s! - 0.06)}" height=".18" fill="${DOOR}" stroke="${STEEL.void}" stroke-width=".04"/>`
        + `<circle cx="${f(e! - 0.18)}" cy="0" r=".045" fill="#f3e2c4"/>`).join('') + frame;
      // A faint swing arc on one side so it reads as a hinged door.
      g = leaves.map(([s, e]) => `<path d="M${f(e!)} 0A${f(e! - s!)} ${f(e! - s!)} 0 0 0 ${f(s!)} ${f(-(e! - s!))}" stroke="${DOOR}" stroke-opacity=".35" stroke-width=".03" stroke-dasharray=".08 .06" fill="none" transform="${look === 'double' && s! > 0 ? `translate(${f(e! + s!)} 0) scale(-1 1)` : ''}"/>`).join('') + g;
    }
    if (d.secure) {
      g += `<rect x="${f(len + 0.14)}" y="-.42" width=".26" height=".22" rx=".03" fill="${STEEL.deep}" stroke="${STEEL.pale}" stroke-width=".03"/>`
        + `<circle cx="${f(len + 0.27)}" cy="-.31" r=".09" fill="#ff4a3a" filter="${led}"/><circle cx="${f(len + 0.27)}" cy="-.31" r=".035" fill="#ffd0c8"/>`;
    }
    p.add(`<g transform="${at}">${g}</g>`);
  }
}

// ---------------------------------------------------------------- Parts (obstacles and furniture)

const shadow = (r: R, k = 0.15): string => `<rect x="${f(r.x + k)}" y="${f(r.y + k * 1.3)}" width="${f(r.w)}" height="${f(r.h)}" fill="#000000" opacity=".4" rx=".08"/>`;

const CAR_COLOURS = ['#3d4b63', '#5a3a3f', '#4a5560', '#2f4a4a', '#5b5240', '#3a3a48'];

function drawPart(p: Pic, q: BackdropPart): void {
  const { x, y, w, h } = q;
  const r = { x, y, w, h };
  const along = w >= h; // long axis is x
  const S = shadow(r);
  switch (q.kind) {
    case 'car': {
      const c = p.pick(CAR_COLOURS);
      // Drawn in a frame where the car points along +x, then placed.
      const L = along ? w : h; const W = along ? h : w;
      const tr = along ? `translate(${f(x)} ${f(y)})` : `translate(${f(x + w)} ${f(y)}) rotate(90)`;
      const flip = p.rnd() < 0.5;
      const body = `<rect x=".05" y=".1" width="${f(L - 0.1)}" height="${f(W - 0.2)}" rx=".45" fill="${c}" stroke="${STEEL.void}" stroke-width=".05"/>`
        + `<rect x="${f(L * 0.3)}" y=".3" width="${f(L * 0.42)}" height="${f(W - 0.6)}" rx=".2" fill="${mix(c, '#000000', 0.35)}"/>`
        + `<path d="M${f(L * 0.72)} .32L${f(L * 0.8)} .42V${f(W - 0.42)}L${f(L * 0.72)} ${f(W - 0.32)}Z" fill="#1a2430" stroke="#6f8aa3" stroke-width=".03"/>`
        + `<path d="M${f(L * 0.3)} .32L${f(L * 0.24)} .44V${f(W - 0.44)}L${f(L * 0.3)} ${f(W - 0.32)}Z" fill="#1a2430" stroke="#6f8aa3" stroke-width=".03"/>`
        + `<path d="M${f(L * 0.08)} ${f(W / 2)}H${f(L * 0.22)}" stroke="${mix(c, '#ffffff', 0.25)}" stroke-width=".04" opacity=".6"/>`
        + `<rect x="${f(L - 0.18)}" y=".3" width=".1" height=".3" rx=".03" fill="#f4f0d8"/><rect x="${f(L - 0.18)}" y="${f(W - 0.6)}" width=".1" height=".3" rx=".03" fill="#f4f0d8"/>`
        + `<rect x=".08" y=".3" width=".08" height=".3" fill="#d23a3a"/><rect x=".08" y="${f(W - 0.6)}" width=".08" height=".3" fill="#d23a3a"/>`
        + `<path d="M${f(L * 0.35)} .38H${f(L * 0.65)}" stroke="#ffffff" stroke-opacity=".18" stroke-width=".06"/>`;
      const inner = flip ? `<g transform="translate(${f(L)} ${f(W)}) rotate(180)">${body}</g>` : body;
      p.add(S + `<g transform="${tr}">${inner}</g>`);
      break;
    }
    case 'dumpster': {
      const c = '#3e5246';
      const lid = along ? `M${f(x + w / 2)} ${f(y + 0.08)}V${f(y + h - 0.08)}` : `M${f(x + 0.08)} ${f(y + h / 2)}H${f(x + w - 0.08)}`;
      p.add(S + `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx=".06" fill="${c}" stroke="${STEEL.void}" stroke-width=".06"/>`
        + `<rect x="${f(x + 0.1)}" y="${f(y + 0.1)}" width="${f(w - 0.2)}" height="${f(h - 0.2)}" fill="${mix(c, '#ffffff', 0.08)}" stroke="${mix(c, '#000000', 0.4)}" stroke-width=".04"/>`
        + `<path d="${lid}" stroke="${mix(c, '#000000', 0.5)}" stroke-width=".06"/>`);
      break;
    }
    case 'bins': {
      p.add(S + [[0.3, 0.3], [0.72, 0.68]].map(([a, b]) => `<circle cx="${f(x + a! * w)}" cy="${f(y + b! * h)}" r="${f(w * 0.28)}" fill="#3a4452" stroke="${STEEL.void}" stroke-width=".05"/><circle cx="${f(x + a! * w)}" cy="${f(y + b! * h)}" r="${f(w * 0.14)}" fill="none" stroke="#5c6878" stroke-width=".03"/>`).join(''));
      break;
    }
    case 'pallets': case 'crates': case 'drums': {
      if (q.kind === 'drums') {
        const n = Math.max(1, Math.round(w / 0.7)); const m = Math.max(1, Math.round(h / 0.7));
        let s = S;
        for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
          const cx = x + (i + 0.5) * (w / n); const cy = y + (j + 0.5) * (h / m); const rr = Math.min(w / n, h / m) * 0.45;
          const c = p.pick(['#6a3b2e', '#2f4f5c', '#5a5a3a']);
          s += `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(rr)}" fill="${c}" stroke="${STEEL.void}" stroke-width=".04"/><circle cx="${f(cx)}" cy="${f(cy)}" r="${f(rr * 0.6)}" fill="none" stroke="${mix(c, '#ffffff', 0.2)}" stroke-width=".03"/><circle cx="${f(cx + rr * 0.35)}" cy="${f(cy - rr * 0.3)}" r=".05" fill="${STEEL.void}"/>`;
        }
        p.add(s);
        break;
      }
      const isP = q.kind === 'pallets';
      const cell = isP ? Math.min(w, h, 1.2) : 1;
      const nx = Math.max(1, Math.round(w / cell)); const ny = Math.max(1, Math.round(h / cell));
      let s = S;
      for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
        const cx = x + (i * w) / nx; const cy = y + (j * h) / ny; const cw = w / nx; const ch = h / ny;
        const c = isP ? '#6b5a44' : p.pick(['#6e5a40', '#7a6447', '#5f4f3a', '#56606b']);
        s += `<rect x="${f(cx + 0.03)}" y="${f(cy + 0.03)}" width="${f(cw - 0.06)}" height="${f(ch - 0.06)}" fill="${c}" stroke="${STEEL.void}" stroke-width=".05"/>`;
        if (isP) {
          const sl: string[] = [];
          for (let k = 1; k < 5; k++) sl.push(`M${f(cx + 0.06)} ${f(cy + (ch * k) / 5)}H${f(cx + cw - 0.06)}`);
          s += `<path d="${sl.join('')}" stroke="${mix(c, '#000000', 0.5)}" stroke-width=".05"/>`;
        } else {
          s += `<rect x="${f(cx + 0.12)}" y="${f(cy + 0.12)}" width="${f(cw - 0.24)}" height="${f(ch - 0.24)}" fill="none" stroke="${mix(c, '#000000', 0.4)}" stroke-width=".04"/>`
            + `<path d="M${f(cx + 0.12)} ${f(cy + 0.12)}L${f(cx + cw - 0.12)} ${f(cy + ch - 0.12)}" stroke="${mix(c, '#000000', 0.35)}" stroke-width=".05"/>`
            + `<path d="M${f(cx + 0.05)} ${f(cy + 0.07)}H${f(cx + cw - 0.05)}" stroke="${mix(c, '#ffffff', 0.25)}" stroke-width=".03"/>`;
        }
      }
      p.add(s);
      break;
    }
    case 'shelf': {
      let s = S + `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" fill="#2a3038" stroke="${STEEL.void}" stroke-width=".06"/>`;
      const n = Math.round((along ? w : h) / 1.4);
      for (let i = 0; i < n; i++) {
        const a = (along ? x : y) + 0.1 + (i * ((along ? w : h) - 0.2)) / n;
        const len = ((along ? w : h) - 0.2) / n - 0.1;
        const c = p.pick(['#6e5a40', '#7a6447', '#5a6470', '#4d5a4a', '#6a5d4d']);
        s += along ? `<rect x="${f(a)}" y="${f(y + 0.12)}" width="${f(len)}" height="${f(h - 0.24)}" fill="${c}"/><path d="M${f(a)} ${f(y + h / 2)}h${f(len)}" stroke="${mix(c, '#000000', 0.4)}" stroke-width=".03"/>`
          : `<rect x="${f(x + 0.12)}" y="${f(a)}" width="${f(w - 0.24)}" height="${f(len)}" fill="${c}"/>`;
      }
      const ups: string[] = [];
      for (let i = 0; i <= Math.round((along ? w : h) / 2.8); i++) {
        const a = (along ? x : y) + Math.min(i * 2.8, along ? w : h);
        ups.push(along ? `<rect x="${f(a - 0.06)}" y="${f(y - 0.02)}" width=".12" height="${f(h + 0.04)}" fill="${mix(AMBER, '#5a4a20', 0.3)}"/>` : '');
      }
      p.add(s + ups.join('') + `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" fill="none" stroke="${mix(AMBER, '#5a4a20', 0.3)}" stroke-width=".06"/>`);
      break;
    }
    case 'forklift': {
      const fy = y; // forks at the top
      p.add(S + `<rect x="${f(x + 0.3)}" y="${f(fy)}" width=".18" height="1" fill="#9aa3ad"/><rect x="${f(x + w - 0.48)}" y="${f(fy)}" width=".18" height="1" fill="#9aa3ad"/>`
        + `<rect x="${f(x)}" y="${f(fy + 0.9)}" width="${f(w)}" height="${f(h - 0.9)}" rx=".15" fill="#c79a2e" stroke="${STEEL.void}" stroke-width=".06"/>`
        + `<rect x="${f(x + 0.2)}" y="${f(fy + 1.2)}" width="${f(w - 0.4)}" height=".9" rx=".08" fill="#2a3038" stroke="${STEEL.void}" stroke-width=".04"/>`
        + `<circle cx="${f(x + w / 2)}" cy="${f(fy + 1.65)}" r=".2" fill="#3a424d"/>`
        + `<rect x="${f(x + 0.1)}" y="${f(y + h - 0.55)}" width="${f(w - 0.2)}" height=".45" fill="#8a6a22"/>`);
      break;
    }
    case 'desk': case 'cabinet': case 'bench': {
      const c = q.kind === 'desk' ? '#4a4038' : q.kind === 'bench' ? '#4a5058' : '#46505c';
      let s = S + `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx=".05" fill="${c}" stroke="${STEEL.void}" stroke-width=".05"/>`
        + `<rect x="${f(x + 0.06)}" y="${f(y + 0.06)}" width="${f(w - 0.12)}" height="${f(h - 0.12)}" fill="none" stroke="${mix(c, '#ffffff', 0.18)}" stroke-width=".03"/>`;
      if (q.kind === 'desk') {
        const fl = p.blur(0.08);
        s += `<rect x="${f(x + w / 2 - 0.35)}" y="${f(y + 0.12)}" width=".7" height=".1" fill="${CYAN}" filter="${fl}"/><rect x="${f(x + w / 2 - 0.3)}" y="${f(y + 0.12)}" width=".6" height=".06" fill="#bff3f6"/>`
          + `<rect x="${f(x + 0.3)}" y="${f(y + h - 0.45)}" width=".35" height=".25" fill="#d8d2c4" opacity=".7"/>`
          + `<circle cx="${f(x + w / 2)}" cy="${f(y + h + 0.45)}" r=".3" fill="#2a2f38" stroke="${STEEL.void}" stroke-width=".04"/>`;
      } else if (q.kind === 'cabinet') {
        s += `<path d="M${f(x + 0.08)} ${f(y + h / 2)}H${f(x + w - 0.08)}" stroke="${STEEL.void}" stroke-width=".04"/>`;
      } else {
        s += `<rect x="${f(x + 0.3)}" y="${f(y + 0.2)}" width=".6" height=".4" fill="#8a7a5a"/><circle cx="${f(x + w - 0.6)}" cy="${f(y + h / 2)}" r=".2" fill="#6a7380"/>`;
      }
      p.add(s);
      break;
    }
    case 'counter': case 'bar': {
      const c = q.kind === 'bar' ? '#3a2e3a' : '#3d4652';
      const fl = p.blur(0.1);
      let s = S + `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx=".08" fill="${c}" stroke="${STEEL.void}" stroke-width=".06"/>`
        + `<rect x="${f(x + 0.08)}" y="${f(y + 0.08)}" width="${f(w - 0.16)}" height="${f(h - 0.16)}" rx=".05" fill="${mix(c, '#ffffff', 0.12)}"/>`;
      if (q.kind === 'bar') {
        s += `<path d="M${f(x + w)} ${f(y + 0.1)}V${f(y + h - 0.1)}" stroke="${MAGENTA}" stroke-width=".12" filter="${fl}"/><path d="M${f(x + w)} ${f(y + 0.1)}V${f(y + h - 0.1)}" stroke="#ffc6ea" stroke-width=".03"/>`;
        for (let i = 0; i < 7; i++) s += `<circle cx="${f(x + w / 2)}" cy="${f(y + 0.8 + i * 1.6)}" r=".09" fill="${p.pick(['#e0b070', '#bfe6ea', '#c8a0d8'])}" opacity=".8"/>`;
      } else {
        s += `<rect x="${f(x + 0.4)}" y="${f(y + 0.18)}" width=".7" height=".12" fill="${CYAN}" filter="${fl}"/><rect x="${f(x + 1.4)}" y="${f(y + 0.18)}" width=".7" height=".12" fill="${CYAN}" filter="${fl}"/>`;
      }
      p.add(s);
      break;
    }
    case 'table': {
      const c = '#3e3a36';
      let s = '';
      const chairs = Math.max(2, Math.round((along ? w : h) / 1.2));
      for (let i = 0; i < chairs; i++) {
        const t = (i + 0.5) / chairs;
        const cx = along ? x + t * w : x - 0.35; const cy = along ? y - 0.35 : y + t * h;
        const dx = along ? 0 : w + 0.7; const dy = along ? h + 0.7 : 0;
        s += `<circle cx="${f(cx)}" cy="${f(cy)}" r=".24" fill="#2a2f38" stroke="${STEEL.void}" stroke-width=".04"/><circle cx="${f(cx + dx)}" cy="${f(cy + dy)}" r=".24" fill="#2a2f38" stroke="${STEEL.void}" stroke-width=".04"/>`;
      }
      p.add(s + S + `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx=".3" fill="${c}" stroke="${STEEL.void}" stroke-width=".05"/>`
        + `<rect x="${f(x + 0.15)}" y="${f(y + 0.15)}" width="${f(w - 0.3)}" height="${f(h - 0.3)}" rx=".2" fill="${mix(c, '#ffffff', 0.08)}"/>`);
      break;
    }
    case 'sofa': {
      const c = '#4a3a4a';
      p.add(S + `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx=".2" fill="${c}" stroke="${STEEL.void}" stroke-width=".05"/>`
        + (along ? `<rect x="${f(x + 0.12)}" y="${f(y + 0.3)}" width="${f(w - 0.24)}" height="${f(h - 0.4)}" rx=".12" fill="${mix(c, '#ffffff', 0.12)}"/>`
          : `<rect x="${f(x + 0.1)}" y="${f(y + 0.12)}" width="${f(w - 0.4)}" height="${f(h - 0.24)}" rx=".12" fill="${mix(c, '#ffffff', 0.12)}"/>`));
      break;
    }
    case 'rack': {
      let s = S + `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" fill="#14181d" stroke="${STEEL.void}" stroke-width=".06"/>`;
      const n = Math.round(w / 0.6);
      for (let i = 0; i < n; i++) {
        s += `<rect x="${f(x + i * (w / n) + 0.04)}" y="${f(y + 0.05)}" width="${f(w / n - 0.08)}" height="${f(h - 0.1)}" fill="#1f252c" stroke="#2f3843" stroke-width=".02"/>`;
        for (let k = 0; k < 3; k++) s += `<circle cx="${f(x + i * (w / n) + 0.12 + k * 0.12)}" cy="${f(y + h * p.r(0.3, 0.7))}" r=".03" fill="${p.pick([GREEN, GREEN, CYAN, AMBER])}"/>`;
      }
      p.add(s);
      break;
    }
    case 'booth': {
      const c = '#5a2f4a';
      p.add(S + `<path d="M${f(x)} ${f(y)}H${f(x + w)}V${f(y + h)}H${f(x)}V${f(y + h - 0.5)}H${f(x + w - 0.5)}V${f(y + 0.5)}H${f(x)}Z" fill="${c}" stroke="${STEEL.void}" stroke-width=".05"/>`
        + `<rect x="${f(x + 0.4)}" y="${f(y + 0.75)}" width="${f(w - 1.1)}" height="${f(h - 1.5)}" rx=".15" fill="#3a3540" stroke="${STEEL.void}" stroke-width=".04"/>`
        + `<circle cx="${f(x + 0.4 + (w - 1.1) / 2)}" cy="${f(y + h / 2)}" r=".08" fill="${AMBER}"/>`);
      break;
    }
    case 'dj': {
      const fl = p.blur(0.1);
      p.add(S + `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx=".1" fill="#22202a" stroke="${STEEL.void}" stroke-width=".05"/>`
        + `<circle cx="${f(x + 0.9)}" cy="${f(y + h / 2)}" r=".4" fill="#111" stroke="${STEEL.light}" stroke-width=".03"/><circle cx="${f(x + w - 0.9)}" cy="${f(y + h / 2)}" r=".4" fill="#111" stroke="${STEEL.light}" stroke-width=".03"/>`
        + `<rect x="${f(x + w / 2 - 0.4)}" y="${f(y + 0.3)}" width=".8" height="${f(h - 0.6)}" fill="#2c2a36"/><path d="M${f(x + 0.1)} ${f(y + h)}H${f(x + w - 0.1)}" stroke="${MAGENTA}" stroke-width=".1" filter="${fl}"/>`);
      break;
    }
    case 'stool': {
      p.add(`<circle cx="${f(x + w / 2 + 0.08)}" cy="${f(y + h / 2 + 0.1)}" r="${f(w * 0.45)}" fill="#000" opacity=".4"/><circle cx="${f(x + w / 2)}" cy="${f(y + h / 2)}" r="${f(w * 0.45)}" fill="#3a3540" stroke="${STEEL.void}" stroke-width=".05"/>`
        + `<circle cx="${f(x + w / 2)}" cy="${f(y + h / 2)}" r="${f(w * 0.3)}" fill="#4a4452"/><circle cx="${f(x + w / 2)}" cy="${f(y + h / 2)}" r=".07" fill="${CYAN}" opacity=".6"/>`);
      break;
    }
    case 'ac': {
      const c = '#5a636e';
      const fan = Math.min(w, h) * 0.32;
      p.add(shadow(r, 0.25) + `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx=".06" fill="${c}" stroke="${STEEL.void}" stroke-width=".06"/>`
        + `<rect x="${f(x + 0.1)}" y="${f(y + 0.1)}" width="${f(w - 0.2)}" height="${f(h - 0.2)}" fill="${mix(c, '#ffffff', 0.1)}"/>`
        + [0.3, 0.7].map((t) => `<circle cx="${f(x + w * t)}" cy="${f(y + h / 2)}" r="${f(fan)}" fill="#20262d" stroke="${STEEL.void}" stroke-width=".04"/><path d="M${f(x + w * t - fan)} ${f(y + h / 2)}h${f(fan * 2)}M${f(x + w * t)} ${f(y + h / 2 - fan)}v${f(fan * 2)}" stroke="#6a737e" stroke-width=".04"/><circle cx="${f(x + w * t)}" cy="${f(y + h / 2)}" r=".1" fill="#6a737e"/>`).join(''));
      break;
    }
    case 'vent': case 'mast': {
      const cx = x + w / 2; const cy = y + h / 2;
      p.add(`<circle cx="${f(cx + 0.15)}" cy="${f(cy + 0.2)}" r="${f(w * 0.48)}" fill="#000" opacity=".45"/>`
        + `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx=".1" fill="#4a535e" stroke="${STEEL.void}" stroke-width=".05"/>`
        + (q.kind === 'vent' ? `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(w * 0.34)}" fill="#6a737e" stroke="${STEEL.void}" stroke-width=".04"/><circle cx="${f(cx)}" cy="${f(cy)}" r="${f(w * 0.12)}" fill="#2a3038"/>`
          : `<circle cx="${f(cx)}" cy="${f(cy)}" r=".18" fill="#7a838e"/><path d="M${f(x + 0.1)} ${f(y + 0.1)}L${f(x + w - 0.1)} ${f(y + h - 0.1)}M${f(x + w - 0.1)} ${f(y + 0.1)}L${f(x + 0.1)} ${f(y + h - 0.1)}" stroke="#7a838e" stroke-width=".05"/>`));
      break;
    }
    case 'skylight': {
      let s = shadow(r, 0.1) + `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" fill="#5a636e" stroke="${STEEL.void}" stroke-width=".06"/>`;
      const nx = Math.round(w); const ny = Math.round(h / 1.5);
      for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
        s += `<rect x="${f(x + 0.12 + (i * (w - 0.24)) / nx)}" y="${f(y + 0.12 + (j * (h - 0.24)) / ny)}" width="${f((w - 0.24) / nx - 0.06)}" height="${f((h - 0.24) / ny - 0.06)}" fill="#22384a" opacity=".9"/>`;
      }
      const g = p.glow('#ffd59a', 0.4);
      p.add(s + `<rect x="${f(x + 0.12)}" y="${f(y + 0.12)}" width="${f(w - 0.24)}" height="${f(h - 0.24)}" fill="${g}"/><path d="M${f(x + 0.3)} ${f(y + h - 0.3)}L${f(x + w * 0.45)} ${f(y + 0.3)}" stroke="#ffffff" stroke-opacity=".15" stroke-width=".1"/>`);
      break;
    }
    case 'hatch': {
      p.add(shadow(r, 0.1) + `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" fill="#4a535e" stroke="${STEEL.void}" stroke-width=".05"/><rect x="${f(x + 0.15)}" y="${f(y + 0.15)}" width="${f(w - 0.3)}" height="${f(h - 0.3)}" fill="#3a424d" stroke="#6a737e" stroke-width=".03"/>`
        + `<rect x="${f(x + w / 2 - 0.2)}" y="${f(y + h - 0.35)}" width=".4" height=".08" fill="#8a96a3"/>`);
      break;
    }
    case 'pillar': {
      p.add(shadow(r, 0.2) + `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" fill="#8a929c" stroke="${STEEL.void}" stroke-width=".06"/>`
        + `<rect x="${f(x + 0.12)}" y="${f(y + 0.12)}" width="${f(w - 0.24)}" height="${f(h - 0.24)}" fill="#9aa2ac"/>`
        + `<rect x="${f(x - 0.05)}" y="${f(y - 0.05)}" width="${f(w + 0.1)}" height="${f(h + 0.1)}" fill="none" stroke="${AMBER}" stroke-width=".1" stroke-dasharray=".2 .2"/>`);
      break;
    }
    case 'containers': {
      // A block of shipping containers (2.5 m wide each, across the short side).
      const across = along ? h : w; const n = Math.max(1, Math.round(across / 2.5));
      const lenAll = along ? w : h; const m = Math.max(1, Math.round(lenAll / 6));
      let s = shadow(r, 0.3);
      for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
        const c = p.pick(['#7a4a36', '#2f5f63', '#3e5370', '#5a5f3a', '#6a3a40', '#4c5560']);
        const cx = along ? x + (j * w) / m : x + (i * w) / n; const cy = along ? y + (i * h) / n : y + (j * h) / m;
        const cw = along ? w / m : w / n; const ch = along ? h / n : h / m;
        const ribs: string[] = [];
        if (along) for (let k = cx + 0.3; k < cx + cw - 0.2; k += 0.3) ribs.push(`M${f(k)} ${f(cy + 0.1)}V${f(cy + ch - 0.1)}`);
        else for (let k = cy + 0.3; k < cy + ch - 0.2; k += 0.3) ribs.push(`M${f(cx + 0.1)} ${f(k)}H${f(cx + cw - 0.1)}`);
        s += `<rect x="${f(cx + 0.03)}" y="${f(cy + 0.03)}" width="${f(cw - 0.06)}" height="${f(ch - 0.06)}" fill="${c}" stroke="${STEEL.void}" stroke-width=".06"/>`
          + `<path d="${ribs.join('')}" stroke="${mix(c, '#000000', 0.35)}" stroke-width=".06"/>`
          + `<rect x="${f(cx + 0.03)}" y="${f(cy + 0.03)}" width="${f(cw - 0.06)}" height="${f(ch - 0.06)}" fill="none" stroke="${mix(c, '#ffffff', 0.2)}" stroke-width=".05"/>`;
      }
      p.add(s);
      break;
    }
    case 'crane': {
      p.add(shadow(r, 0.2) + `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" fill="#a8862e" stroke="${STEEL.void}" stroke-width=".06"/>`
        + `<path d="M${f(x + 0.1)} ${f(y + 0.1)}L${f(x + w - 0.1)} ${f(y + h - 0.1)}M${f(x + w - 0.1)} ${f(y + 0.1)}L${f(x + 0.1)} ${f(y + h - 0.1)}" stroke="#5a4a1a" stroke-width=".08"/>`);
      break;
    }
    case 'bollard': {
      const cx = x + w / 2; const cy = y + h / 2;
      p.add(`<circle cx="${f(cx + 0.06)}" cy="${f(cy + 0.08)}" r=".24" fill="#000" opacity=".45"/><circle cx="${f(cx)}" cy="${f(cy)}" r=".23" fill="#2e343c" stroke="${STEEL.void}" stroke-width=".04"/><circle cx="${f(cx - 0.05)}" cy="${f(cy - 0.05)}" r=".1" fill="#4a535e"/>`);
      break;
    }
    case 'tree': {
      // The trunk (the solid square in the geometry), its canopy drawn later over everything.
      const cx = x + w / 2; const cy = y + h / 2;
      p.add(`<circle cx="${f(cx + 0.1)}" cy="${f(cy + 0.12)}" r=".55" fill="#000" opacity=".45"/><circle cx="${f(cx)}" cy="${f(cy)}" r=".5" fill="#4a3b2e" stroke="${STEEL.void}" stroke-width=".06"/>`
        + `<circle cx="${f(cx)}" cy="${f(cy)}" r=".3" fill="none" stroke="#6a5644" stroke-width=".04"/><circle cx="${f(cx)}" cy="${f(cy)}" r=".12" fill="#6a5644"/>`);
      break;
    }
    case 'log': {
      p.add(shadow(r, 0.12) + `<rect x="${f(x)}" y="${f(y + 0.05)}" width="${f(w)}" height="${f(h - 0.1)}" rx="${f(h / 2)}" fill="#4a3b2e" stroke="${STEEL.void}" stroke-width=".06"/>`
        + `<path d="M${f(x + 0.4)} ${f(y + 0.35)}H${f(x + w - 0.8)}M${f(x + 0.8)} ${f(y + h - 0.35)}H${f(x + w - 0.4)}" stroke="#2e241b" stroke-width=".05"/>`
        + `<ellipse cx="${f(x + w - 0.15)}" cy="${f(y + h / 2)}" rx=".14" ry="${f(h / 2 - 0.08)}" fill="#7a6446"/><path d="M${f(x + 1.2)} ${f(y + 0.2)}l.3 -.3M${f(x + 3.2)} ${f(y + h - 0.15)}l.25 .3" stroke="#3a2e22" stroke-width=".08"/>`);
      break;
    }
    case 'rock': case 'debris': {
      const pts: string[] = [];
      const k = 8;
      for (let i = 0; i < k; i++) {
        const a = (i / k) * Math.PI * 2;
        pts.push(`${f(x + w / 2 + Math.cos(a) * (w / 2) * p.r(0.82, 1))} ${f(y + h / 2 + Math.sin(a) * (h / 2) * p.r(0.82, 1))}`);
      }
      const c = q.kind === 'rock' ? '#5a5f66' : '#4a4640';
      p.add(`<path d="M${pts.join('L')}Z" fill="#000" opacity=".4" transform="translate(.12 .15)"/><path d="M${pts.join('L')}Z" fill="${c}" stroke="${STEEL.void}" stroke-width=".06" stroke-linejoin="round"/>`
        + `<path d="M${f(x + w * 0.3)} ${f(y + h * 0.3)}L${f(x + w * 0.55)} ${f(y + h * 0.5)}L${f(x + w * 0.5)} ${f(y + h * 0.75)}" stroke="${mix(c, '#ffffff', 0.25)}" stroke-width=".05" fill="none"/>`);
      break;
    }
    default:
      // Platforms and other flat parts are painted by their map; anything else gets a plain block.
      if (q.edge !== 'flat') p.add(S + `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" fill="#4a535e" stroke="${STEEL.void}" stroke-width=".06"/>`);
  }
}

/** Every wall, window, door and part of the map's plan. */
function drawGeometry(p: Pic, after?: () => void): void {
  const plan = backdropPlan(p.b.id);
  for (const q of plan.parts) drawPart(p, q);
  drawLowLines(p, plan.lines);
  after?.();
  drawWalls(p, plan.lines);
  drawDoors(p, plan.lines);
}

// ---------------------------------------------------------------- Shared painters

const W = (p: Pic) => p.b.width;
const Hh = (p: Pic) => p.b.height;

/** Dark building roofs (not walkable): tar, a few roof boxes, a rim. */
function roofs(p: Pic, areas: R[]): void {
  const fill = p.speckle('#16191e', 3, 120, ['#0f1114', '#1d2127', '#22272e'], [0.04, 0.12], 0.7);
  for (const a of areas) {
    p.rect(a, fill);
    p.add(`<rect x="${f(a.x + 0.4)}" y="${f(a.y + 0.4)}" width="${f(Math.max(0, a.w - 0.8))}" height="${f(Math.max(0, a.h - 0.8))}" fill="none" stroke="#252a31" stroke-width=".12"/>`);
    const n = Math.floor((a.w * a.h) / 40);
    for (let i = 0; i < n; i++) {
      const bw = p.r(0.8, 2); const bh = p.r(0.8, 1.6);
      if (a.w < bw + 1.6 || a.h < bh + 1.6) continue;
      const bx = p.r(a.x + 0.8, a.x + a.w - bw - 0.8); const by = p.r(a.y + 0.8, a.y + a.h - bh - 0.8);
      p.add(`<rect x="${f(bx)}" y="${f(by)}" width="${f(bw)}" height="${f(bh)}" fill="#1f242a" stroke="#0b0d10" stroke-width=".05"/>`);
    }
  }
}

/** A wet sheen (one soft diagonal highlight) over an area. */
function sheen(p: Pic, a: R, color = '#9fb4c8', opacity = 0.06): void {
  const id = p.uid('sheen');
  p.def(`<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${color}" stop-opacity="0"/><stop offset=".5" stop-color="${color}" stop-opacity="${opacity}"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient>`);
  p.rect(a, `url(#${id})`);
}

/** Lamp reflections on wet ground: soft streaks under the outdoor lamps. */
function streaks(p: Pic, opacity = 0.18): void {
  const fl = p.blur(0.25);
  for (const l of p.b.lights) {
    p.add(`<ellipse cx="${f(l.x)}" cy="${f(l.y + l.dim * 0.15)}" rx="${f(l.bright * 0.35)}" ry="${f(l.dim * 0.35)}" fill="${l.color ?? '#ffd59a'}" opacity="${opacity}" filter="${fl}"/>`);
  }
}

/** Streetlamp posts: a pole and an arm with a bright head (outdoor lights). */
function lampPosts(p: Pic, which: number[], armDir: Array<[number, number]>): void {
  const fl = p.blur(0.15);
  which.forEach((i, k) => {
    const l = p.b.lights[i]!;
    const [dx, dy] = armDir[k] ?? [0, 0];
    const bx = l.x - dx; const by = l.y - dy;
    p.add(`<circle cx="${f(bx + 0.08)}" cy="${f(by + 0.1)}" r=".18" fill="#000" opacity=".5"/><circle cx="${f(bx)}" cy="${f(by)}" r=".16" fill="#5a636e" stroke="${STEEL.void}" stroke-width=".05"/>`
      + `<path d="M${f(bx)} ${f(by)}L${f(l.x)} ${f(l.y)}" stroke="#5a636e" stroke-width=".1"/>`
      + `<ellipse cx="${f(l.x)}" cy="${f(l.y)}" rx=".35" ry=".22" fill="${l.color ?? '#ffd59a'}" filter="${fl}"/><ellipse cx="${f(l.x)}" cy="${f(l.y)}" rx=".16" ry=".1" fill="#fff6e0"/>`);
  });
}

/** A strip of neon light (a glow and a hot core) along a path. */
function neon(p: Pic, d: string, color: string, w = 0.1): void {
  const fl = p.blur(w * 1.6);
  p.add(`<path d="${d}" stroke="${color}" stroke-width="${f(w * 3)}" fill="none" filter="${fl}" opacity=".85" stroke-linecap="round"/><path d="${d}" stroke="${mix(color, '#ffffff', 0.55)}" stroke-width="${f(w * 0.6)}" fill="none" stroke-linecap="round"/>`);
}

/** A light spill on the floor from a window or a door (a soft rectangle fading away from the wall). */
function spill(p: Pic, r: R, color: string, toward: 'down' | 'up' | 'left' | 'right', opacity = 0.25): void {
  const id = p.uid('spill');
  const [x1, y1, x2, y2] = toward === 'down' ? [0, 0, 0, 1] : toward === 'up' ? [0, 1, 0, 0] : toward === 'right' ? [0, 0, 1, 0] : [1, 0, 0, 0];
  p.def(`<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="${color}" stop-opacity="${opacity}"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient>`);
  p.rect(r, `url(#${id})`);
}

/** Cracks: thin dark branching lines over an area. */
function cracks(p: Pic, a: R, n: number, color = '#15181c'): void {
  const ds: string[] = [];
  for (let i = 0; i < n; i++) {
    let x = p.r(a.x + 0.5, a.x + a.w - 0.5); let y = p.r(a.y + 0.5, a.y + a.h - 0.5);
    let d = `M${f(x)} ${f(y)}`;
    let ang = p.r(0, Math.PI * 2);
    for (let k = 0; k < 5; k++) {
      ang += p.r(-0.8, 0.8);
      x = Math.min(a.x + a.w, Math.max(a.x, x + Math.cos(ang) * p.r(0.3, 0.8)));
      y = Math.min(a.y + a.h, Math.max(a.y, y + Math.sin(ang) * p.r(0.3, 0.8)));
      d += `L${f(x)} ${f(y)}`;
    }
    ds.push(d);
  }
  p.add(`<path d="${ds.join('')}" stroke="${color}" stroke-width=".04" fill="none" opacity=".8" stroke-linejoin="round"/>`);
}

/** Litter: small flat bits (paper, cans, leaves) that read as floor clutter, never as walls. */
function litter(p: Pic, a: R, n: number, colors: string[]): void {
  const xs: string[] = [];
  for (let i = 0; i < n; i++) {
    const s = p.r(0.08, 0.2);
    xs.push(`<rect x="${f(p.r(a.x, a.x + a.w - s))}" y="${f(p.r(a.y, a.y + a.h - s))}" width="${f(s)}" height="${f(s * p.r(0.4, 1))}" fill="${p.pick(colors)}" transform="rotate(${Math.round(p.r(0, 90))} ${f(a.x + a.w / 2)} ${f(a.y + a.h / 2)})" opacity=".7"/>`);
  }
  p.add(`<g>${xs.join('')}</g>`);
}

// ---------------------------------------------------------------- The maps

const ASPHALT = '#2b3038';
const SIDEWALK = '#3b424c';

function paintStreet(p: Pic): void {
  const road = { x: 0, y: 10, w: 40, h: 8 };
  p.rect(road, p.speckle(ASPHALT, 4, 260, ['#22262d', '#343a43', '#1d2127', '#3a4049'], [0.03, 0.1], 0.6));
  p.blotches(road, 18, ['#1a1e23', '#323841'], [1, 3], 0.6, 0.8);
  const walk = p.slabs(SIDEWALK, 2, '#2a3038', 0.04);
  p.rect({ x: 0, y: 6, w: 40, h: 4 }, walk);
  p.rect({ x: 0, y: 18, w: 40, h: 4 }, walk);
  p.rect({ x: 30, y: 0, w: 3, h: 6 }, p.speckle('#2a2f36', 3, 80, ['#22262d', '#343a43'], [0.03, 0.1], 0.6));
  roofs(p, [{ x: 0, y: 0, w: 30, h: 6 }, { x: 33, y: 0, w: 7, h: 6 }, { x: 0, y: 22, w: 40, h: 6 }]);
  // Curbs, lane marks, a crossing.
  p.add(`<path d="M0 10H40M0 18H40" stroke="#5c6672" stroke-width=".14"/><path d="M0 10.1H40M0 17.9H40" stroke="#1a1e23" stroke-width=".05"/>`);
  p.add(`<path d="M0 14H40" stroke="${mix(AMBER, ASPHALT, 0.45)}" stroke-width=".12" stroke-dasharray="2 1.5" opacity=".8"/>`);
  p.add(`<path d="M0 10.6H40M0 17.4H40" stroke="#8a929c" stroke-width=".07" opacity=".45"/>`);
  const zebra: string[] = [];
  for (let y = 10.8; y < 17.4; y += 0.9) zebra.push(`M10.2 ${f(y)}H12.6`);
  p.add(`<path d="${zebra.join('')}" stroke="#aeb6bf" stroke-width=".45" opacity=".28"/>`);
  // Drains and a manhole.
  for (const [x, y] of [[5, 10.25], [19, 17.75], [33, 10.25]] as const) p.add(`<rect x="${f(x - 0.4)}" y="${f(y - 0.15)}" width=".8" height=".3" fill="#14171b" stroke="#4a535e" stroke-width=".03"/><path d="M${f(x - 0.3)} ${f(y)}h.6" stroke="#4a535e" stroke-width=".02" stroke-dasharray=".05 .05"/>`);
  p.add(`<circle cx="26" cy="12.5" r=".45" fill="#262b31" stroke="#4a535e" stroke-width=".05"/><circle cx="26" cy="12.5" r=".3" fill="none" stroke="#3a424d" stroke-width=".03"/>`);
  cracks(p, road, 14);
  sheen(p, road);
  // Light from the shop window (cyan) and the bar window (magenta).
  spill(p, { x: 11, y: 6, w: 8, h: 3 }, CYAN, 'down', 0.22);
  spill(p, { x: 20, y: 19, w: 8, h: 3 }, MAGENTA, 'up', 0.25);
  neon(p, 'M20.3 21.75H27.7', MAGENTA, 0.07);
  neon(p, 'M11.3 6.25H18.7', CYAN, 0.06);
  // Projecting signs (abstract neon shapes, no writing) and a bar's tube outline.
  neon(p, 'M9 4.8Q9.5 4 10 4.8T11 4.8T12 4.8', MAGENTA, 0.06);
  neon(p, 'M35.5 3Q35.7 4.1 36.6 4.3Q35.7 4.5 35.5 5.6Q35.3 4.5 34.4 4.3Q35.3 4.1 35.5 3Z', AMBER, 0.05);
  neon(p, 'M17 23H19.6L18.3 24.4ZM18.3 24.4V25.4M17.6 25.4H19', CYAN, 0.06);
  p.puddles([[9, 16.5, 0.6, MAGENTA], [17, 12, 0.5], [31, 16.2, 0.7, MAGENTA], [36.5, 11.5, 0.45, CYAN], [2.5, 8.5, 0.35], [31.5, 3, 0.45, CYAN], [21, 7.5, 0.4]]);
  streaks(p);
  litter(p, { x: 30.2, y: 0.5, w: 2.6, h: 5 }, 14, ['#4a4640', '#6a6a60', '#3a3f46']);
  litter(p, { x: 0, y: 18.2, w: 40, h: 3.6 }, 12, ['#4a4640', '#5a5a52']);
}

function paintAlley(p: Pic): void {
  const floor = { x: 8, y: 0, w: 8, h: 32 };
  p.rect(floor, p.speckle('#2c3138', 4, 240, ['#23272d', '#363c44', '#1c2025'], [0.03, 0.12], 0.6));
  p.rect({ x: 16, y: 24, w: 3, h: 4 }, p.slabs('#343a42', 1, '#262b31', 0.03));
  p.blotches(floor, 20, ['#181b1f', '#30363e', '#1f2a2a'], [0.8, 2.2], 0.65, 0.7);
  roofs(p, [{ x: 0, y: 0, w: 8, h: 32 }, { x: 16, y: 0, w: 8, h: 24 }, { x: 16, y: 28, w: 8, h: 4 }, { x: 19, y: 24, w: 5, h: 4 }]);
  // A gutter down the middle, cracks, stains.
  p.add(`<path d="M12 0V32" stroke="#1a1e23" stroke-width=".3"/><path d="M12 0V32" stroke="#3a424d" stroke-width=".05" stroke-dasharray=".4 .3"/>`);
  cracks(p, floor, 16);
  // Hazard paint in the loading niche.
  p.add(`<g opacity=".45"><path d="M16.1 24.3H18.9" stroke="${AMBER}" stroke-width=".5"/><path d="M16.1 27.7H18.9" stroke="${AMBER}" stroke-width=".5"/></g>`);
  spill(p, { x: 8, y: 30, w: 8, h: 2 }, '#ffd59a', 'up', 0.22);
  p.pools(0.2);
  p.puddles([[11, 15, 0.7], [13.5, 25.5, 0.6, CYAN], [10, 2, 0.5], [14, 8.5, 0.45, AMBER], [11.5, 21.5, 0.5]]);
  litter(p, { x: 8.3, y: 0.3, w: 7.4, h: 31.4 }, 50, ['#4a4640', '#6a6a60', '#3a3f46', '#5a4a3a']);
  sheen(p, floor, '#9fb4c8', 0.07);
  // Neon tube over the loading door.
  neon(p, 'M18.75 25.2V26.8', CYAN, 0.06);
}

/** Fire escapes: overhead grated landings (no walls: you walk under them). */
function fireEscapes(p: Pic, spots: R[]): void {
  const id = p.uid('grate');
  p.def(`<pattern id="${id}" patternUnits="userSpaceOnUse" width=".2" height=".2"><path d="M0 .1H.2M.1 0V.2" stroke="#8a96a3" stroke-width=".025"/></pattern>`);
  for (const r of spots) {
    p.add(`<g opacity=".55"><rect x="${f(r.x)}" y="${f(r.y)}" width="${f(r.w)}" height="${f(r.h)}" fill="url(#${id})" stroke="#8a96a3" stroke-width=".05" stroke-dasharray=".25 .1"/>`
      + `<path d="M${f(r.x + 0.15)} ${f(r.y + r.h * 0.55)}L${f(r.x + r.w - 0.15)} ${f(r.y + r.h * 0.9)}" stroke="#aab5c0" stroke-width=".05" stroke-dasharray=".05 .12"/></g>`);
  }
}

function paintRooftop(p: Pic): void {
  // The street far below: deep dark with blurred light lines.
  p.rect({ x: 0, y: 0, w: W(p), h: Hh(p) }, '#0b0d10');
  const fl = p.blur(0.4);
  p.add(`<g filter="${fl}" opacity=".5"><path d="M0 27.3H36M25.8 0V28" stroke="${mix(AMBER, '#0b0d10', 0.55)}" stroke-width=".5"/><path d="M0 .7H36" stroke="${mix(MAGENTA, '#0b0d10', 0.6)}" stroke-width=".4"/><path d="M35.6 0V28" stroke="${mix(CYAN, '#0b0d10', 0.6)}" stroke-width=".4"/></g>`);
  const roof = { x: 1.5, y: 1.5, w: 23.5, h: 25 };
  p.rect(roof, p.speckle('#353b43', 3, 260, ['#2c3138', '#40474f', '#262a30', '#4a525b'], [0.03, 0.1], 0.6));
  const seams: string[] = [];
  for (let y = 5.5; y < 26; y += 4) seams.push(`M1.7 ${y}H24.8`);
  p.add(`<path d="${seams.join('')}" stroke="#2a2f36" stroke-width=".06" opacity=".8"/>`);
  p.blotches(roof, 14, ['#262a30', '#3d444d'], [1, 3], 0.55, 0.9);
  const low = { x: 26.5, y: 5, w: 8.5, h: 19 };
  p.rect(low, p.speckle('#2b3037', 3, 200, ['#23272d', '#343a42'], [0.03, 0.1], 0.6));
  // The taller roof's shadow on the lower one.
  spill(p, { x: 26.5, y: 5, w: 3, h: 19 }, '#000000', 'right', 0.45);
  // Stair hut inside: stairs going down.
  p.rect({ x: 4, y: 4, w: 4, h: 4 }, '#2a2f36');
  const st: string[] = [];
  for (let x = 4.6; x < 7.6; x += 0.3) st.push(`M${f(x)} 4.4V6.6`);
  p.add(`<rect x="4.4" y="4.4" width="3.2" height="2.2" fill="#3a424d"/><path d="${st.join('')}" stroke="#20252b" stroke-width=".06"/>`);
  spill(p, { x: 4, y: 4.4, w: 4, h: 2.2 }, '#000000', 'right', 0.4);
  // Cables, drains, puddles.
  p.add(`<path d="M16 6.2C16 9 12 10 11.5 15M18.5 6.2C19 12 21 14 20.5 20" stroke="#15181c" stroke-width=".08" fill="none"/>`);
  for (const [x, y] of [[3, 25], [23.5, 3], [33.5, 22.5]] as const) p.add(`<circle cx="${x}" cy="${y}" r=".25" fill="#16191d" stroke="#5a636e" stroke-width=".04"/>`);
  p.puddles([[9, 12, 0.6], [17, 17, 0.8, CYAN], [22, 9, 0.45], [5, 22, 0.5], [30, 16, 0.6, CYAN]]);
  p.pools(0.2);
  sheen(p, roof, '#9fb4c8', 0.05);
  litter(p, roof, 25, ['#4a4640', '#5a5a52', '#3a3f46']);
  lampPosts(p, [1], [[0, 0.6]]);
}

function paintWarehouse(p: Pic): void {
  p.rect({ x: 0, y: 0, w: W(p), h: Hh(p) }, '#121418');
  const floor = { x: 0.5, y: 0.5, w: 39, h: 27 };
  p.rect(floor, p.slabs('#363c44', 5, '#2a2f36', 0.04, 60));
  p.blotches(floor, 22, ['#24282e', '#2c2f2a', '#41474f'], [0.6, 2], 0.35, 0.6);
  p.rect({ x: 30, y: 0.5, w: 9.5, h: 7.5 }, p.slabs('#3b4048', 0.5, '#33383f', 0.02, 10));
  // Painted aisle lines and the loading zone hatch.
  p.add(`<path d="M11.5 9V19M26.5 9V19M11.5 20H27" stroke="${AMBER}" stroke-width=".08" stroke-dasharray=".6 .3" opacity=".55"/>`);
  const hz: string[] = [];
  for (let x = 4.6; x < 10.6; x += 0.5) hz.push(`M${f(x)} 27.3L${f(x + 1)} 25.3`);
  p.def(`<clipPath id="whz"><rect x="4.5" y="25.3" width="6" height="2"/></clipPath>`);
  p.add(`<g clip-path="url(#whz)" opacity=".5"><path d="${hz.join('')}" stroke="${AMBER}" stroke-width=".18"/></g><rect x="4.5" y="25.3" width="6" height="2" fill="none" stroke="${AMBER}" stroke-width=".06" opacity=".5"/>`);
  // Tyre marks from the forklift, oil stains.
  p.add(`<path d="M7 26C10 22 16 21 24.5 21.5M7.6 26C10.4 22.6 16 21.8 25 22.4" stroke="#1d2126" stroke-width=".12" fill="none" opacity=".7"/>`);
  for (const [x, y, s] of [[20, 25, 0.6], [9, 15, 0.4], [33, 20, 0.5]] as const) p.add(`<ellipse cx="${x}" cy="${y}" rx="${s * 1.4}" ry="${s}" fill="#15181c" opacity=".6"/>`);
  spill(p, { x: 5, y: 24.5, w: 5, h: 3 }, '#6a7a8a', 'up', 0.25);
  p.pools(0.2);
  p.fixtures('tube');
  litter(p, floor, 30, ['#5a4a3a', '#4a4640', '#6a6a60']);
}

function paintOffice(p: Pic): void {
  p.rect({ x: 0, y: 0, w: W(p), h: Hh(p) }, '#0e1114');
  // City glow outside the north windows.
  const fl = p.blur(0.25);
  p.add(`<g filter="${fl}" opacity=".7"><rect x="2" y="0" width="25" height=".35" fill="${mix(CYAN, '#0e1114', 0.5)}"/><rect x="29" y="0" width="10" height=".35" fill="${mix(AMBER, '#0e1114', 0.5)}"/></g>`);
  const all = { x: 0.5, y: 0.5, w: 39, h: 29 };
  p.rect(all, p.slabs('#2f3641', 0.5, '#2a303a', 0.015, 20));
  p.rect({ x: 0.5, y: 18, w: 13.5, h: 11.5 }, p.slabs('#3e4550', 1, '#333944', 0.025, 30));
  p.rect({ x: 14, y: 22, w: 10, h: 7.5 }, p.slabs('#2c3240', 0.5, '#272d39', 0.015, 10));
  p.rect({ x: 30, y: 22, w: 9.5, h: 7.5 }, p.slabs('#262b31', 0.6, '#353c44', 0.03, 10));
  p.rect({ x: 28, y: 0.5, w: 11.5, h: 6.5 }, p.slabs('#3a3833', 0.5, '#34322e', 0.02, 15));
  p.rect({ x: 0.5, y: 10, w: 2.5, h: 7 }, p.slabs('#4a525c', 0.5, '#3a424d', 0.02, 5));
  p.rect({ x: 24, y: 22, w: 6, h: 7.5 }, p.slabs('#3a3f46', 0.5, '#33383f', 0.02, 10));
  // A lobby rug and the entrance mat.
  p.add(`<rect x="2" y="23" width="9" height="5" rx=".2" fill="#2a3350" opacity=".55"/><rect x="2.3" y="23.3" width="8.4" height="4.4" rx=".15" fill="none" stroke="${CYAN}" stroke-opacity=".25" stroke-width=".05"/><rect x="5" y="28.5" width="2.5" height=".9" fill="#1d2127"/>`);
  spill(p, { x: 1.5, y: 27.5, w: 12, h: 2 }, '#9fb4c8', 'up', 0.14);
  // Cubicle desks (along the partitions: furniture, inside each cluster) and chairs.
  for (const [cx, cy] of [[8, 5.5], [15, 5.5], [22, 5.5], [8, 12.5], [15, 12.5], [22, 12.5]] as const) {
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
      const dx = sx < 0 ? cx - 2.3 : cx + 0.1; const dy = sy < 0 ? cy - 0.8 : cy + 0.1;
      const mx = sx < 0 ? cx - 0.8 : cx + 0.1;
      const my = sy < 0 ? cy - 2.3 : cy + 0.1;
      p.add(`<rect x="${f(dx)}" y="${f(dy)}" width="2.2" height=".7" fill="#463e36" stroke="${STEEL.void}" stroke-width=".03"/><rect x="${f(mx)}" y="${f(my)}" width=".7" height="1.5" fill="#463e36" stroke="${STEEL.void}" stroke-width=".03"/>`
        + `<rect x="${f(sx < 0 ? cx - 0.5 : cx + 0.15)}" y="${f(sy < 0 ? cy - 0.6 : cy + 0.25)}" width=".35" height=".25" fill="#1a2430" stroke="${CYAN}" stroke-opacity=".6" stroke-width=".03"/>`
        + `<circle cx="${f(cx + sx * 1.3)}" cy="${f(cy + sy * 1.3)}" r=".28" fill="#252a32" stroke="${STEEL.void}" stroke-width=".03"/>`);
    }
  }
  // Plants.
  for (const [x, y] of [[1.3, 18.8], [13.2, 18.8], [27.3, 1.3], [1.3, 1.3], [13.2, 28.7], [24.7, 21.3], [38.7, 21.3]] as const) {
    p.add(`<circle cx="${x}" cy="${y}" r=".4" fill="#3a424d" stroke="${STEEL.void}" stroke-width=".03"/><circle cx="${x}" cy="${y}" r=".32" fill="#2d4a35"/><path d="M${x - 0.25} ${y}h.5M${x} ${y - 0.25}v.5" stroke="#4a7a55" stroke-width=".05"/>`);
  }
  p.pools(0.2);
  p.fixtures('tube');
}

function paintClub(p: Pic): void {
  p.rect({ x: 0, y: 0, w: W(p), h: Hh(p) }, '#0f0d13');
  const floor = { x: 0.5, y: 0.5, w: 35, h: 27 };
  p.rect(floor, p.speckle('#28252f', 3, 160, ['#201d26', '#302c38', '#1b1920'], [0.03, 0.08], 0.6));
  p.rect({ x: 11, y: 0.5, w: 14, h: 4.5 }, p.slabs('#2e2a36', 1, '#24212b', 0.02, 10));
  p.rect({ x: 28, y: 0.5, w: 7.5, h: 6 }, p.slabs('#33283a', 0.5, '#2c2333', 0.02, 10));
  p.rect({ x: 0.5, y: 21, w: 6.5, h: 6.5 }, p.slabs('#3a3f46', 0.5, '#2e3238', 0.02, 5));
  p.rect({ x: 0.5, y: 0.5, w: 3.5, h: 20.5 }, p.slabs('#2a2630', 0.5, '#232028', 0.02, 5));
  // Dance floor: 1 m light tiles.
  const tiles: string[] = [];
  for (let x = 12; x < 24; x++) for (let y = 8; y < 18; y++) {
    const c = p.pick([MAGENTA, CYAN, VIOLET, '#2a2733', '#2a2733']);
    tiles.push(`<rect x="${x + 0.05}" y="${y + 0.05}" width=".9" height=".9" fill="${c}" opacity="${c.startsWith('#2a') ? 1 : f(p.r(0.18, 0.4))}"/>`);
  }
  p.add(`<rect x="12" y="8" width="12" height="10" fill="#141218"/>${tiles.join('')}`);
  neon(p, 'M12 8H24V18H12Z', MAGENTA, 0.05);
  // Neon tubes along the walls, and the bar's back shelf of bottles.
  neon(p, 'M8 0.8H10.5M25.5 0.8H27.5', CYAN, 0.05);
  neon(p, 'M35.2 8V20', VIOLET, 0.05);
  const bottles: string[] = [];
  for (let y = 5.3; y < 16.8; y += 0.35) bottles.push(`<circle cx="${f(0.85 + (Math.round(y * 3) % 2) * 0.15)}" cy="${f(y)}" r=".09" fill="${p.pick(['#e0b070', '#bfe6ea', '#c8a0d8', '#9ad0a0'])}" opacity=".8"/>`);
  p.add(`<rect x=".55" y="5" width=".6" height="12" fill="#1a171f"/>${bottles.join('')}`);
  neon(p, 'M1.3 5.2V16.8', AMBER, 0.04);
  // Stage steps (in the gap of the stage edge), speakers on the stage, a rope line at the door.
  p.add(`<path d="M22.7 5.2H24.8M22.7 5.5H24.8M22.7 5.8H24.8" stroke="#3a3644" stroke-width=".18"/>`);
  for (const x of [11.4, 23.9]) p.add(`<rect x="${x}" y="0.9" width=".7" height=".7" fill="#16141a" stroke="${STEEL.void}" stroke-width=".04"/><circle cx="${f(x + 0.35)}" cy="1.25" r=".25" fill="#26232c" stroke="${STEEL.light}" stroke-width=".02"/>`);
  p.add(`<path d="M15 25.5H16M20 25.5H21" stroke="#b0303a" stroke-width=".08"/><circle cx="15" cy="25.5" r=".1" fill="${AMBER}"/><circle cx="21" cy="25.5" r=".1" fill="${AMBER}"/>`);
  p.pools(0.25);
  // A haze of coloured light over the dance floor.
  p.blotches({ x: 9, y: 5, w: 18, h: 16 }, 8, [MAGENTA, CYAN, VIOLET], [1.5, 3], 0.12, 1.2);
}

function paintSewer(p: Pic): void {
  // The rock and brickwork round the tunnels.
  p.rect({ x: 0, y: 0, w: W(p), h: Hh(p) }, p.speckle('#121417', 3, 120, ['#0d0f11', '#191c20', '#1d1a18'], [0.05, 0.2], 0.7));
  const walk = p.slabs('#363b40', 1, '#2b2f34', 0.03, 30);
  const tunnels: R[] = [{ x: 0, y: 9, w: 40, h: 10 }, { x: 18, y: 0, w: 8, h: 9 }, { x: 18, y: 19, w: 8, h: 9 }];
  for (const t of tunnels) p.rect(t, walk);
  p.rect({ x: 30, y: 19, w: 8, h: 7 }, p.slabs('#3a3f45', 0.5, '#30353b', 0.02, 10));
  // The water channel (a cross at the junction).
  const water = p.speckle('#1a2826', 2, 60, ['#20322f', '#15211f', '#2a3d38'], [0.05, 0.25], 0.5);
  const ch: R[] = [{ x: 0, y: 12.5, w: 40, h: 3 }, { x: 20.5, y: 0, w: 3, h: 28 }];
  for (const c of ch) p.rect(c, water);
  const flow: string[] = [];
  for (let i = 0; i < 40; i++) { const x = p.r(0, 38); const y = p.r(12.8, 15.2); flow.push(`M${f(x)} ${f(y)}h${f(p.r(0.6, 1.6))}`); }
  for (let i = 0; i < 30; i++) { const y = p.r(0, 26.5); const x = p.r(20.8, 23.2); flow.push(`M${f(x)} ${f(y)}v${f(p.r(0.6, 1.6))}`); }
  p.add(`<path d="${flow.join('')}" stroke="#5a8a7a" stroke-width=".04" opacity=".45" stroke-linecap="round"/>`);
  p.add(`<path d="M0 12.5H20.5M23.5 12.5H40M0 15.5H20.5M23.5 15.5H40M20.5 0V12.5M23.5 0V12.5M20.5 15.5V28M23.5 15.5V28" stroke="#4a5158" stroke-width=".08" opacity=".9"/>`);
  // Grated foot bridges over the channel.
  const id = p.uid('grate');
  p.def(`<pattern id="${id}" patternUnits="userSpaceOnUse" width=".25" height=".25"><rect width=".25" height=".25" fill="#2a3036"/><path d="M0 .125H.25" stroke="#7a848e" stroke-width=".05"/></pattern>`);
  for (const r of [{ x: 8, y: 12.4, w: 1.5, h: 3.2 }, { x: 33, y: 12.4, w: 1.5, h: 3.2 }]) p.add(`<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="url(#${id})" stroke="#8a96a3" stroke-width=".05"/>`);
  p.add(`<rect x="20.4" y="21" width="3.2" height="1.5" fill="url(#${id})" stroke="#8a96a3" stroke-width=".05"/><rect x="20.4" y="5" width="3.2" height="1.5" fill="url(#${id})" stroke="#8a96a3" stroke-width=".05"/>`);
  // Damp, slime and puddles on the walkways.
  for (const t of tunnels) p.blotches(t, 10, ['#1d2a24', '#262b2e'], [0.6, 1.6], 0.55, 0.6);
  // The ladder up the shaft at the north end, and pipes in the maintenance room.
  const rungs: string[] = [];
  for (let y = 0.4; y < 2.6; y += 0.3) rungs.push(`M24.9 ${f(y)}H25.7`);
  p.add(`<path d="M24.9 0.2V2.7M25.7 0.2V2.7" stroke="#8a96a3" stroke-width=".07"/><path d="${rungs.join('')}" stroke="#8a96a3" stroke-width=".05"/>`);
  p.add(`<path d="M30.5 19.4H37.6M30.5 19.75H37.6" stroke="#5a6470" stroke-width=".14"/><path d="M37.6 19.3V25.6" stroke="#6a5a3a" stroke-width=".16"/>`);
  cracks(p, { x: 0, y: 9, w: 40, h: 10 }, 12);
  p.pools(0.22);
  p.fixtures('dot');
  litter(p, { x: 0.5, y: 15.6, w: 39, h: 3.3 }, 20, ['#4a4640', '#3a3f36']);
  litter(p, { x: 0.5, y: 9.1, w: 39, h: 3.3 }, 20, ['#4a4640', '#3a3f36']);
}

function paintGarage(p: Pic): void {
  p.rect({ x: 0, y: 0, w: W(p), h: Hh(p) }, '#101215');
  const floor = { x: 0.5, y: 0.5, w: 39, h: 31 };
  p.rect(floor, p.speckle('#353a41', 4, 240, ['#2c3137', '#3e444c', '#272b31'], [0.03, 0.1], 0.6));
  p.blotches(floor, 22, ['#23272c', '#40464e'], [0.8, 2.4], 0.55, 0.8);
  // Ramp: darker, grooved, with chevrons.
  const ramp = { x: 34, y: 0.5, w: 5.5, h: 17.5 };
  p.rect(ramp, '#2a2e34');
  spill(p, { x: 34, y: 0, w: 5.5, h: 8 }, '#000000', 'down', 0.6);
  const gr: string[] = [];
  for (let y = 1; y < 18; y += 0.4) gr.push(`M34.2 ${f(y)}H39.3`);
  p.add(`<path d="${gr.join('')}" stroke="#23272c" stroke-width=".06"/>`);
  for (let y = 6; y < 17; y += 4) p.add(`<path d="M35.6 ${y + 1}L36.75 ${y}L37.9 ${y + 1}" stroke="#aeb6bf" stroke-width=".15" fill="none" opacity=".35"/>`);
  // Bay lines (white) for the four rows.
  const lines: string[] = [];
  const bayX = (from: number, to: number) => { const xs: number[] = []; for (let x = from; x <= to + 0.01; x += 3) xs.push(x); return xs; };
  const rows: Array<[number, number, number[]]> = [
    [0.5, 5.5, [...bayX(0.5, 9.5), ...bayX(10.5, 19.5), ...bayX(20.5, 29.5), ...bayX(30.5, 33.5)]],
    [11.5, 16, [...bayX(0.5, 9.5), ...bayX(10.5, 19.5), ...bayX(20.5, 29.5), ...bayX(30.5, 33.5)]],
    [17, 21.5, [...bayX(0.5, 9.5), ...bayX(10.5, 19.5), ...bayX(20.5, 29.5), ...bayX(30.5, 33.5)]],
    [26.5, 31.5, [...bayX(5.5, 8.5), ...bayX(10.5, 19.5), ...bayX(20.5, 29.5), ...bayX(30.5, 33.5)]],
  ];
  for (const [y1, y2, xs] of rows) for (const x of xs) lines.push(`M${f(x)} ${f(y1)}V${f(y2)}`);
  lines.push('M0.5 16.5H33.5');
  p.add(`<path d="${lines.join('')}" stroke="#c9ced4" stroke-width=".1" opacity=".55"/>`);
  // Aisle arrows and a walkway to the stairs.
  for (const [x, y, dir] of [[10.5, 8.5, 1], [20.5, 8.5, 1], [30.5, 8.5, 1], [11, 24, -1], [21, 24, -1]] as const) {
    p.add(`<path d="M${x - dir * 0.8} ${y - 0.6}L${x + dir * 0.4} ${y}L${x - dir * 0.8} ${y + 0.6}M${x - dir * 2} ${y}H${x + dir * 0.3}" stroke="#c9ced4" stroke-width=".14" fill="none" opacity=".35" stroke-linejoin="round"/>`);
  }
  const zb: string[] = [];
  for (let x = 1; x < 5; x += 0.6) zb.push(`M${f(x)} 22V24.3`);
  p.add(`<path d="${zb.join('')}" stroke="${AMBER}" stroke-width=".3" opacity=".3"/>`);
  // Stairwell stairs and the utility room's panel.
  p.rect({ x: 0.5, y: 24.5, w: 4.5, h: 7 }, '#2d3238');
  const st: string[] = [];
  for (let y = 26.5; y < 31; y += 0.3) st.push(`M1 ${f(y)}H2.6M3 ${f(y)}H4.6`);
  p.add(`<path d="${st.join('')}" stroke="#20252b" stroke-width=".07"/><path d="M2.8 26.3V31.2" stroke="#4a535e" stroke-width=".12"/>`);
  p.rect({ x: 35, y: 26, w: 4.5, h: 5.5 }, p.slabs('#30353b', 0.5, '#2a2f34', 0.02, 5));
  p.add(`<rect x="38.6" y="27" width=".6" height="2" fill="#2a3038" stroke="${STEEL.light}" stroke-width=".04"/><circle cx="38.9" cy="27.5" r=".06" fill="${GREEN}"/><circle cx="38.9" cy="27.8" r=".06" fill="${AMBER}"/>`);
  // Oil stains in the bays.
  for (let i = 0; i < 12; i++) p.add(`<ellipse cx="${f(p.r(2, 33))}" cy="${f(p.pick([3, 13.5, 19, 29]))}" rx="${f(p.r(0.3, 0.7))}" ry="${f(p.r(0.2, 0.4))}" fill="#16191d" opacity=".55"/>`);
  p.pools(0.2);
  p.fixtures('tube');
}

function paintDocks(p: Pic): void {
  // Water: dark, rippled, with light reflections.
  p.rect({ x: 0, y: 0, w: W(p), h: 12 }, p.speckle('#0f1820', 5, 120, ['#142230', '#0b121a', '#16263a'], [0.03, 0.12], 0.4));
  p.blotches({ x: 0, y: 0, w: W(p), h: 12 }, 16, ['#0a1118', '#18283a'], [1.5, 4], 0.6, 1);
  const waves: string[] = [];
  for (let i = 0; i < 90; i++) { const x = p.r(0, 43); const y = p.r(0.2, 11.6); const l = p.r(0.4, 1.4); waves.push(`M${f(x)} ${f(y)}q${f(l / 2)} -.12 ${f(l)} 0`); }
  p.add(`<path d="${waves.join('')}" stroke="#4a6a85" stroke-width=".05" fill="none" opacity=".45"/>`);
  const fl = p.blur(0.35);
  p.add(`<g filter="${fl}" opacity=".35"><ellipse cx="13" cy="9" rx=".6" ry="2.6" fill="#ffc27a"/><ellipse cx="29" cy="0.8" rx=".5" ry="1" fill="#dfe9ff"/><ellipse cx="38" cy="6" rx=".4" ry="2" fill="${CYAN}"/><ellipse cx="6" cy="5" rx=".4" ry="2" fill="${MAGENTA}"/></g>`);
  // The quay and the pier.
  const quay = { x: 0, y: 12, w: 44, h: 20 };
  p.rect(quay, p.slabs('#353b42', 4, '#2a2f35', 0.04, 60));
  p.blotches(quay, 20, ['#262a30', '#3e444c', '#2a2a26'], [0.8, 2.6], 0.55, 0.8);
  const pier = { x: 26, y: 2, w: 6, h: 10 };
  p.rect(pier, '#3a352f');
  const pl: string[] = [];
  for (let y = 2.5; y < 12; y += 0.5) pl.push(`M26 ${y}H32`);
  p.add(`<path d="${pl.join('')}" stroke="#2a2621" stroke-width=".05"/><path d="M26 2V12M32 2V12M26 2H32" stroke="#1a1d21" stroke-width=".12"/>`);
  // The quay edge stripe and the crane rails.
  p.add(`<path d="M0 12.1H26M32 12.1H44M26.1 2V12M31.9 2V12M26 2.1H32" stroke="${AMBER}" stroke-width=".12" opacity=".55"/>`);
  p.add(`<path d="M0 13.7H44M0 13.3H44M0 20.3H44M0 20.7H44" stroke="#6a737e" stroke-width=".07" opacity=".7"/>`);
  // The crane's overhead girders between its legs (above head height: drawn faint, no walls).
  p.add(`<g opacity=".35"><rect x="23.2" y="13" width=".6" height="8" fill="none" stroke="#c9a640" stroke-width=".06"/><rect x="30.2" y="13" width=".6" height="8" fill="none" stroke="#c9a640" stroke-width=".06"/><path d="M23.2 13L23.8 21M30.2 13L30.8 21" stroke="#c9a640" stroke-width=".04"/></g>`);
  roofs(p, [{ x: 26, y: 27, w: 18, h: 5 }]);
  spill(p, { x: 31, y: 24.5, w: 4, h: 2.5 }, '#ffb347', 'up', 0.2);
  p.puddles([[9, 22.5, 0.6], [17, 26, 0.7, AMBER], [33, 14.5, 0.5], [41, 19, 0.6, CYAN], [25, 24, 0.5], [6, 29.5, 0.6]]);
  litter(p, quay, 30, ['#4a4640', '#6a6a60', '#3a3f46']);
  sheen(p, quay, '#9fb4c8', 0.05);
  lampPosts(p, [0, 2], [[0, 0.5], [0.6, 0]]);
  p.pools(0.2);
  streaks(p, 0.12);
  p.fixtures('dot');
}

function paintForest(p: Pic): void {
  p.rect({ x: 0, y: 0, w: W(p), h: Hh(p) }, p.speckle('#1f271f', 3, 220, ['#283226', '#1a2019', '#2e2a20', '#33402f'], [0.05, 0.16], 0.7));
  p.blotches({ x: 0, y: 0, w: 40, h: 30 }, 26, ['#2a3626', '#161c15', '#2f2b20'], [1.5, 4], 0.6, 1);
  // The clearing (lighter grass) and the dirt track.
  const g = p.glow('#4a5a3a', 0.55);
  p.add(`<ellipse cx="16" cy="14" rx="8" ry="6.5" fill="${g}"/>`);
  const track = 'M-1 14C4 13.6 8 14.4 12 15.5S20 17.5 24 15.6S30 14.2 34 15.6S40 17.2 41 17';
  p.add(`<path d="${track}" stroke="#2f2a22" stroke-width="3" fill="none" stroke-linecap="round" opacity=".8"/><path d="${track}" stroke="#3d362b" stroke-width="2.2" fill="none" stroke-linecap="round"/>`
    + `<path d="${track}" stroke="#2c271f" stroke-width=".12" fill="none" stroke-dasharray=".5 .4" transform="translate(0 -.5)"/><path d="${track}" stroke="#2c271f" stroke-width=".12" fill="none" stroke-dasharray=".5 .4" transform="translate(0 .5)"/>`);
  // A path to the shack door.
  p.add(`<path d="M27.75 10.2C27.8 12 26 14 25 15.5" stroke="#3a3429" stroke-width="1.1" fill="none" stroke-linecap="round" opacity=".8"/>`);
  // The shack's floor (its roof is gone), with fallen boards.
  p.rect({ x: 25, y: 4, w: 6, h: 6 }, '#3a3128');
  const bd: string[] = [];
  for (let x = 25.4; x < 31; x += 0.4) bd.push(`M${f(x)} 4V10`);
  p.add(`<path d="${bd.join('')}" stroke="#2a231c" stroke-width=".05"/><path d="M26 5.5L28.5 6.2M29 8.5L30.5 7" stroke="#5a4a3a" stroke-width=".16"/>`);
  // Campfire: a ring of stones and embers.
  const fl = p.blur(0.15);
  let fire = '';
  for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; fire += `<circle cx="${f(15 + Math.cos(a) * 0.55)}" cy="${f(12 + Math.sin(a) * 0.55)}" r=".14" fill="#5a5f66" stroke="${STEEL.void}" stroke-width=".03"/>`; }
  p.add(fire + `<circle cx="15" cy="12" r=".4" fill="#ff7a2a" filter="${fl}"/><circle cx="15" cy="12" r=".18" fill="#ffd28a"/><path d="M14.7 11.8L15.3 12.2M14.75 12.25L15.25 11.75" stroke="#2a1d12" stroke-width=".08"/>`);
  // Undergrowth (low and flat: tufts and ferns, kept off the track, the clearing and the zones).
  const tufts: string[] = [];
  const z = p.b.zones;
  const inZone = (x: number, y: number) => [z.pcs, z.npcs].some((r) => x > r.x - 0.5 && x < r.x + r.w + 0.5 && y > r.y - 0.5 && y < r.y + r.h + 0.5);
  for (let i = 0; i < 140; i++) {
    const x = p.r(0.3, 39.7); const y = p.r(0.3, 29.7);
    if (Math.hypot((x - 16) / 8, (y - 14) / 6.5) < 1 || inZone(x, y) || (x > 24.5 && x < 31.5 && y > 3.5 && y < 10.5)) continue;
    const s = p.r(0.2, 0.5);
    tufts.push(`<path d="M${f(x)} ${f(y)}l${f(-s)} ${f(-s * 0.5)}M${f(x)} ${f(y)}l${f(s * 0.2)} ${f(-s)}M${f(x)} ${f(y)}l${f(s)} ${f(-s * 0.4)}M${f(x)} ${f(y)}l${f(-s * 0.5)} ${f(s * 0.5)}" stroke="${p.pick(['#3f5a36', '#2f4a2e', '#4a5a3a'])}" stroke-width=".05" fill="none"/>`);
  }
  p.add(`<g opacity=".8">${tufts.join('')}</g>`);
  litter(p, { x: 0, y: 0, w: 40, h: 30 }, 60, ['#4a3a24', '#5a4a2a', '#3a2e1e']);
}

/** Tree canopies over the trunks (translucent, so the ground and tokens still read). */
function canopies(p: Pic): void {
  const fl = p.blur(0.12);
  const xs: string[] = [];
  for (const q of backdropPlan(p.b.id).parts) if (q.kind === 'tree') {
    const cx = q.x + q.w / 2; const cy = q.y + q.h / 2; const r = p.r(1.6, 2.3);
    let d = '';
    const k = 9;
    for (let i = 0; i < k; i++) {
      const a = (i / k) * Math.PI * 2;
      const rr = r * p.r(0.82, 1.05);
      d += `${i ? 'L' : 'M'}${f(cx + Math.cos(a) * rr)} ${f(cy + Math.sin(a) * rr)}`;
    }
    xs.push(`<path d="${d}Z" fill="${p.pick(['#1d3324', '#22392a', '#1a2e22'])}" fill-opacity=".5" stroke="#3a5a40" stroke-opacity=".45" stroke-width=".08" stroke-linejoin="round" filter="${fl}"/>`);
    xs.push(`<circle cx="${f(cx)}" cy="${f(cy)}" r=".5" fill="#4a3b2e"/><circle cx="${f(cx)}" cy="${f(cy)}" r=".2" fill="#6a5644"/>`);
  }
  p.add(xs.join(''));
}

function paintAstral(p: Pic, city: boolean): void {
  const w = W(p); const h = Hh(p);
  const bg = p.uid('abg');
  p.def(`<radialGradient id="${bg}" cx="50%" cy="45%" r="75%"><stop offset="0" stop-color="${mix('#221a3a', VIOLET, 0.12)}"/><stop offset="1" stop-color="#0a0812"/></radialGradient>`);
  p.rect({ x: 0, y: 0, w, h }, `url(#${bg})`);
  p.blotches({ x: 0, y: 0, w, h }, city ? 18 : 30, [VIOLET, '#5a6ad0', '#3a2a6a', '#7a4ab0', '#2a4a7a'], [2, 6], city ? 0.22 : 0.32, 1.6);
  // Flowing currents of mana.
  const flows: string[] = [];
  for (let i = 0; i < (city ? 6 : 12); i++) {
    const y0 = p.r(0, h); let d = `M-1 ${f(y0)}`;
    for (let x = 4; x <= w + 4; x += 8) d += `S${f(x - 2)} ${f(y0 + p.r(-3, 3))} ${f(x)} ${f(y0 + p.r(-2, 2))}`;
    flows.push(d);
  }
  const fl = p.blur(0.25);
  p.add(`<path d="${flows.join('')}" stroke="#b49cf0" stroke-width=".12" fill="none" opacity=".18" filter="${fl}"/>`);
  if (city) {
    // Ghostly streets and buildings: the astral reflection of a block (no walls: astral forms pass through).
    p.add(`<rect x="0" y="12" width="${w}" height="6" fill="#2a2440" opacity=".45"/><rect x="17" y="0" width="6" height="${h}" fill="#2a2440" opacity=".45"/>`);
    p.add(`<path d="M0 12H17M23 12H${w}M0 18H17M23 18H26M17 0V12M23 0V12M17 18V${h}M23 18V${h}" stroke="#8a80aa" stroke-width=".08" opacity=".45" stroke-dasharray=".6 .3"/>`);
    p.add(`<path d="M0 15H${w}M20 0V${h}" stroke="#8a80aa" stroke-width=".06" opacity=".25" stroke-dasharray="1.5 1.5"/>`);
    const blocks: R[] = [
      { x: 1, y: 1, w: 7, h: 9.5 }, { x: 9, y: 1, w: 7, h: 6 }, { x: 9, y: 8, w: 7, h: 2.5 }, { x: 24, y: 1, w: 9, h: 9.5 }, { x: 34, y: 1, w: 5, h: 9.5 },
      { x: 1, y: 19.5, w: 6, h: 9.5 }, { x: 8, y: 19.5, w: 8, h: 4 }, { x: 8, y: 25, w: 8, h: 4 },
    ];
    for (const b of blocks) {
      p.add(`<rect x="${f(b.x)}" y="${f(b.y)}" width="${f(b.w)}" height="${f(b.h)}" fill="#1a1528" fill-opacity=".55" stroke="#a69ac8" stroke-opacity=".55" stroke-width=".1"/>`
        + `<rect x="${f(b.x + 0.5)}" y="${f(b.y + 0.5)}" width="${f(b.w - 1)}" height="${f(b.h - 1)}" fill="none" stroke="#a69ac8" stroke-opacity=".2" stroke-width=".06" stroke-dasharray=".3 .3"/>`
        + `<path d="M${f(b.x)} ${f(b.y)}L${f(b.x + b.w)} ${f(b.y + b.h)}" stroke="#a69ac8" stroke-opacity=".08" stroke-width=".05"/>`);
    }
    // A park: living trees glow green.
    p.add(`<rect x="26" y="20" width="13" height="9" rx=".5" fill="#1a2a28" opacity=".5" stroke="#8fd9b0" stroke-opacity=".25" stroke-width=".08"/>`);
    for (const [x, y] of [[28, 22], [31, 23.5], [35, 21.5], [37.5, 26.5], [29.5, 27], [33.5, 27.5]] as const) {
      const g = p.glow('#8fd9b0', 0.5);
      p.add(`<circle cx="${x}" cy="${y}" r="1.6" fill="${g}"/><circle cx="${x}" cy="${y}" r=".25" fill="#c8f6dc" opacity=".7"/>`);
    }
    // People: small bright auras on the sidewalks and in the buildings.
    const auras = [[3, 11.3], [12, 11.2], [26, 18.7], [30, 11.4], [15.5, 19.2], [24, 6], [5, 5], [12, 4], [36, 6], [10, 27], [4, 24], [29, 4]];
    for (const [x, y] of auras) {
      const c = p.pick(['#ffd98a', '#b8f0c8', '#a8c8ff', '#f0b0d8']);
      const g = p.glow(c, 0.6);
      p.add(`<circle cx="${f(x!)}" cy="${f(y!)}" r=".9" fill="${g}"/><circle cx="${f(x!)}" cy="${f(y!)}" r=".14" fill="#ffffff" opacity=".8"/>`);
    }
  } else {
    // Faint aura rings and drifting glows (abstract, no structures).
    for (let i = 0; i < 9; i++) {
      const x = p.r(2, w - 2); const y = p.r(2, h - 2); const r = p.r(1.2, 3);
      const c = p.pick(['#b49cf0', '#8fb0f0', '#d0a0f0', '#90d8d0']);
      const g = p.glow(c, 0.35);
      p.add(`<circle cx="${f(x)}" cy="${f(y)}" r="${f(r * 1.6)}" fill="${g}"/><circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="none" stroke="${c}" stroke-opacity=".25" stroke-width=".08" filter="${fl}"/>`);
    }
  }
  // Drifting motes.
  const motes: string[] = [];
  for (let i = 0; i < (city ? 120 : 220); i++) {
    motes.push(`<circle cx="${f(p.r(0, w))}" cy="${f(p.r(0, h))}" r="${f(p.r(0.03, 0.09))}" fill="${p.pick(['#e8dcff', '#c8b8ff', '#b8e8ff'])}" opacity="${f(p.r(0.3, 0.9))}"/>`);
  }
  const mf = p.blur(0.04);
  p.add(`<g filter="${mf}">${motes.join('')}</g>`);
  p.pools(0.25);
}

function paintMatrixHost(p: Pic): void {
  const w = W(p); const h = Hh(p);
  p.rect({ x: 0, y: 0, w, h }, '#07100c');
  gridLines(p, 1, 0.1, 5, 0.22);
  for (const q of backdropPlan(p.b.id).parts) p.add(`<rect x="${q.x + 0.3}" y="${q.y + 0.4}" width="${q.w}" height="${q.h}" fill="#000" opacity=".6"/>`);
  // Light-paths between the nodes (drawn first, under the platforms' edges).
  const paths = ['M8 15H16', 'M20 11V5.5H30', 'M20 19V24.5H30'];
  for (const d of paths) {
    const fl = p.blur(0.25);
    p.add(`<path d="${d}" stroke="${GREEN}" stroke-width="1.6" fill="none" opacity=".18" filter="${fl}"/><path d="${d}" stroke="${GREEN}" stroke-width=".5" fill="none" opacity=".35"/><path d="${d}" stroke="${mix(GREEN, '#ffffff', 0.5)}" stroke-width=".08" fill="none" stroke-dasharray=".3 .5"/>`);
  }
  for (const [x, y] of [[11, 15], [13.5, 15], [20, 8], [25, 5.5], [20, 22], [26, 24.5]] as const) p.add(`<rect x="${x - 0.12}" y="${y - 0.12}" width=".24" height=".24" fill="#e0fff2"/>`);
  // Platforms: raised plates with corner brackets and an emblem each.
  for (const q of backdropPlan(p.b.id).parts) {
    const g = p.uid('plat');
    const c = q.kind === 'node-data' ? CYAN : GREEN;
    p.def(`<linearGradient id="${g}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${mix(c, '#07100c', 0.78)}"/><stop offset="1" stop-color="${mix(c, '#07100c', 0.9)}"/></linearGradient>`);
    p.add(`<rect x="${q.x}" y="${q.y}" width="${q.w}" height="${q.h}" fill="url(#${g})"/>`);
    p.add(`<rect x="${q.x + 0.5}" y="${q.y + 0.5}" width="${q.w - 1}" height="${q.h - 1}" fill="none" stroke="${c}" stroke-opacity=".25" stroke-width=".05" stroke-dasharray=".5 .25"/>`);
    const cx = q.x + q.w / 2; const cy = q.y + q.h / 2;
    const fl = p.blur(0.15);
    if (q.kind === 'node-cpu') {
      p.add(`<g transform="translate(${cx} ${cy + 1.2})"><rect x="-1.8" y="-1.8" width="3.6" height="3.6" fill="none" stroke="${GREEN}" stroke-opacity=".5" stroke-width=".08" transform="rotate(45)"/><rect x="-1.1" y="-1.1" width="2.2" height="2.2" fill="${mix(GREEN, '#07100c', 0.7)}" stroke="${GREEN}" stroke-width=".08"/>`
        + `<circle r=".7" fill="${GREEN}" filter="${fl}"/><circle r=".35" fill="#e0fff2"/></g>`);
    } else if (q.kind === 'node-io') {
      p.add(`<g transform="translate(${cx} ${cy})" opacity=".85"><circle r="1.8" fill="none" stroke="${GREEN}" stroke-width=".08" stroke-dasharray=".4 .2"/><circle r="1" fill="none" stroke="${GREEN}" stroke-opacity=".6" stroke-width=".06"/>`
        + [0, 90, 180, 270].map((a) => `<path d="M2.3 -.3L1.9 0L2.3 .3" stroke="${GREEN}" stroke-width=".08" fill="none" transform="rotate(${a})"/>`).join('') + `<circle r=".3" fill="${GREEN}" filter="${fl}"/></g>`);
    } else if (q.kind === 'node-data') {
      let s = `<g transform="translate(${cx} ${cy})">`;
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j += 2) s += `<rect x="${i * 1.6 - 0.6}" y="${j * 1 - 0.55}" width="1.2" height="1.1" rx=".5" fill="${mix(CYAN, '#07100c', 0.65)}" stroke="${CYAN}" stroke-width=".06"/><rect x="${i * 1.6 - 0.4}" y="${j * 1 - 0.15}" width=".8" height=".3" rx=".15" fill="${CYAN}" opacity=".5"/>`;
      p.add(s + `</g>`);
    } else if (q.kind === 'node-slave') {
      let d = '';
      for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; const rr = i % 2 ? 1.5 : 1.9; d += `${i ? 'L' : 'M'}${f(Math.cos(a) * rr)} ${f(Math.sin(a) * rr)}`; }
      p.add(`<g transform="translate(${cx} ${cy})"><path d="${d}Z" fill="${mix(GREEN, '#07100c', 0.75)}" stroke="${GREEN}" stroke-width=".07"/><circle r=".8" fill="none" stroke="${GREEN}" stroke-width=".07"/><circle r=".3" fill="${GREEN}" filter="${fl}"/></g>`);
    }
    // Corner brackets.
    const k = 0.8;
    p.add(`<path d="M${q.x + 0.25} ${q.y + 0.25 + k}V${q.y + 0.25}H${q.x + 0.25 + k}M${q.x + q.w - 0.25 - k} ${q.y + 0.25}H${q.x + q.w - 0.25}V${q.y + 0.25 + k}M${q.x + q.w - 0.25} ${q.y + q.h - 0.25 - k}V${q.y + q.h - 0.25}H${q.x + q.w - 0.25 - k}M${q.x + 0.25 + k} ${q.y + q.h - 0.25}H${q.x + 0.25}V${q.y + q.h - 0.25 - k}" stroke="${c}" stroke-width=".08" fill="none" opacity=".8"/>`);
  }
  dataRain(p, 70);
  p.pools(0.25);
}

/** The Matrix grid: thin lines every `step`, brighter every `major`. */
function gridLines(p: Pic, step: number, op: number, major: number, majorOp: number): void {
  const w = W(p); const h = Hh(p);
  const minor: string[] = []; const big: string[] = [];
  for (let x = 0; x <= w; x += step) (x % major === 0 ? big : minor).push(`M${x} 0V${h}`);
  for (let y = 0; y <= h; y += step) (y % major === 0 ? big : minor).push(`M0 ${y}H${w}`);
  p.add(`<path d="${minor.join('')}" stroke="${GREEN}" stroke-opacity="${op}" stroke-width=".03"/><path d="${big.join('')}" stroke="${GREEN}" stroke-opacity="${majorOp}" stroke-width=".06"/>`);
}

/** Short falling streaks of light (data in motion; no glyphs). */
function dataRain(p: Pic, n: number): void {
  const xs: string[] = [];
  for (let i = 0; i < n; i++) {
    const x = Math.round(p.r(0, W(p))); const y = p.r(0, Hh(p)); const l = p.r(0.4, 1.4);
    xs.push(`M${x} ${f(y)}v${f(l)}`);
  }
  p.add(`<path d="${xs.join('')}" stroke="${mix(GREEN, '#ffffff', 0.3)}" stroke-width=".05" opacity=".35" stroke-linecap="round"/>`);
}

function paintMatrixGrid(p: Pic): void {
  const w = W(p); const h = Hh(p);
  const bg = p.uid('mbg');
  p.def(`<radialGradient id="${bg}" cx="50%" cy="50%" r="70%"><stop offset="0" stop-color="#0a1812"/><stop offset="1" stop-color="#040906"/></radialGradient>`);
  p.rect({ x: 0, y: 0, w, h }, `url(#${bg})`);
  gridLines(p, 2, 0.12, 10, 0.3);
  // Datalines: bright runs along some grid lines, with packets.
  const lines = ['M0 10H40', 'M0 20H40', 'M10 0V30', 'M30 0V30', 'M20 0V10H30', 'M0 4H10', 'M30 26H40', 'M20 20V30'];
  const fl = p.blur(0.2);
  for (const d of lines) p.add(`<path d="${d}" stroke="${GREEN}" stroke-width=".5" opacity=".25" fill="none" filter="${fl}"/><path d="${d}" stroke="${mix(GREEN, '#ffffff', 0.35)}" stroke-width=".07" fill="none"/>`);
  for (let i = 0; i < 26; i++) {
    const horiz = p.rnd() < 0.5;
    const at = p.pick(horiz ? [10, 20] : [10, 30]);
    const v = p.r(0.5, horiz ? w - 0.5 : h - 0.5);
    const [x, y] = horiz ? [v, at] : [at, v];
    p.add(`<rect x="${f(x - 0.1)}" y="${f(y - 0.1)}" width=".2" height=".2" fill="#e0fff2" opacity=".85"/>`);
  }
  // Distant host icons: glowing geometric shapes (a pyramid, a cube, a sphere, an octahedron, a ring).
  const icon = (x: number, y: number, c: string, body: string, r: number) => {
    const g = p.glow(c, 0.45);
    p.add(`<circle cx="${x}" cy="${y}" r="${r * 2.2}" fill="${g}"/><g transform="translate(${x} ${y})" stroke="${c}" stroke-width=".1" fill="${mix(c, '#040906', 0.75)}" stroke-linejoin="round">${body}</g>`);
  };
  icon(14, 6, GREEN, `<path d="M-2 -2H2V2H-2Z"/><path d="M-2 -2L2 2M2 -2L-2 2" fill="none"/><circle r=".25" fill="${GREEN}"/>`, 2);
  icon(27, 22, CYAN, `<path d="M-1.8 -1H.8V1.8H-1.8Z"/><path d="M-1.8 -1L-1 -1.8H1.6L.8 -1M.8 1.8L1.6 1V-1.8" fill="${mix(CYAN, '#040906', 0.6)}"/>`, 1.9);
  icon(33, 6, GREEN, `<circle r="1.4"/><ellipse rx="1.4" ry=".5" fill="none"/><ellipse rx=".5" ry="1.4" fill="none"/>`, 1.5);
  icon(9, 24, AMBER, `<path d="M0 -1.7L1.7 0L0 1.7L-1.7 0Z"/><path d="M0 -1.7V1.7M-1.7 0H1.7" fill="none"/>`, 1.7);
  icon(20, 15, MAGENTA, `<circle r="1.2" fill="none" stroke-width=".18"/><circle r=".5"/>`, 1.2);
  dataRain(p, 50);
  p.pools(0.2);
}

// ---------------------------------------------------------------- Files

const PAINT: Record<string, (p: Pic) => void> = {
  street: paintStreet, alley: paintAlley, rooftop: paintRooftop, warehouse: paintWarehouse, office: paintOffice, club: paintClub,
  sewer: paintSewer, garage: paintGarage, docks: paintDocks, forest: paintForest,
  astral: (p) => paintAstral(p, false), 'astral-city': (p) => paintAstral(p, true),
  'matrix-host': paintMatrixHost, 'matrix-grid': paintMatrixGrid,
};

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** The finished SVG text of one backdrop. */
export function backdropSvg(id: string): string {
  const b = BACKDROPS.find((x) => x.id === id);
  if (!b) throw new Error(`No backdrop ${id}`);
  const p = new Pic(b);
  PAINT[id]?.(p);
  if (b.kind === 'real') {
    if (id === 'alley') {
      drawGeometry(p, () => fireEscapes(p, [{ x: 8.1, y: 12.5, w: 1.3, h: 4 }, { x: 14.6, y: 19.5, w: 1.3, h: 4 }]));
      lampPostsWall(p);
    } else drawGeometry(p);
    if (id === 'street') lampPosts(p, [0, 1, 2], [[0, -0.6], [0, 0.6], [0, -0.6]]);
    if (id === 'forest') canopies(p);
  } else {
    drawGeometry(p);
  }
  const W100 = b.width * 100; const H100 = b.height * 100;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W100} ${H100}" width="${W100}" height="${H100}">`
    + `<title>${esc(EN[id]?.label ?? id)}</title><defs>${p.defs.join('')}</defs>`
    + `<rect width="${W100}" height="${H100}" fill="${b.background}"/>`
    + `<g transform="scale(100)">${p.out.join('')}</g></svg>`;
}

/** Wall lamps over the alley's doors (small fittings on the wall, glowing). */
function lampPostsWall(p: Pic): void {
  const fl = p.blur(0.12);
  for (const l of p.b.lights.slice(0, 3)) {
    p.add(`<rect x="${f(l.x - 0.25)}" y="${f(l.y - 0.12)}" width=".5" height=".24" rx=".06" fill="${l.color ?? '#ffd59a'}" filter="${fl}"/><rect x="${f(l.x - 0.15)}" y="${f(l.y - 0.06)}" width=".3" height=".12" rx=".04" fill="#fff6e0"/>`);
  }
}

export interface BackdropFile { file: string; svg: string }
/** Every backdrop file (`public/backdrops/<id>.svg`), in list order. */
export function allBackdrops(): BackdropFile[] {
  return BACKDROPS.map((b) => ({ file: `${b.id}.svg`, svg: backdropSvg(b.id) }));
}
