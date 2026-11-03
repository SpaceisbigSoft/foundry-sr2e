/**
 * Default token art: critters, Matrix IC and hosts, and a few map markers (barrier, secured site, safehouse).
 * Original drawings in the "neon noir" house style (see frame.ts): faceted duotone silhouettes in the STEEL
 * tones, rim-lit from behind, with a few glowing details. No text, logos or book art.
 */
import { token, STEEL, RIM, mix, n, type ArtFile, type TokenSpec } from './frame.ts';

type Pt = [number, number];

/** A closed path through the points. */
const P = (pts: Pt[]): string => 'M' + pts.map(([x, y]) => `${n(x)} ${n(y)}`).join('L') + 'Z';
/** An open path through the points. */
const L = (pts: Pt[]): string => 'M' + pts.map(([x, y]) => `${n(x)} ${n(y)}`).join('L');
/** Mirrors left-half points (top to bottom) across x = 128 into a closed symmetric outline. */
function sym(left: Pt[]): Pt[] {
  const right = left.filter(([x]) => x !== 128).map(([x, y]) => [256 - x, y] as Pt).reverse();
  return [...left, ...right];
}
/** Mirror of a shape (for paired features: eyes, ears). */
const mir = (pts: Pt[]): Pt[] => pts.map(([x, y]) => [256 - x, y] as Pt);
const path = (d: string, fill: string, extra = ''): string => `<path d="${d}" fill="${fill}"${extra}/>`;
/** A paired feature: the shape and its mirror. */
const pair = (pts: Pt[], fill: string, extra = ''): string => path(P(pts), fill, extra) + path(P(mir(pts)), fill, extra);

/** A silhouette rim-lit from behind: a glow, a rim offset up-left, and the shape itself with a faint edge. */
function lit(id: string, rim: string, d: string, fill: string, dx = -3, dy = -3, halo = true): string {
  return (halo ? `<path d="${d}" fill="${rim}" opacity=".45" filter="url(#${id}-glow)"/>` : '')
    + `<path d="${d}" fill="${rim}" transform="translate(${dx} ${dy})"/>`
    + `<path d="${d}" fill="${fill}" stroke="${rim}" stroke-opacity=".35" stroke-width="1.5" stroke-linejoin="round"/>`;
}
/** A glowing detail: blurred copy plus the crisp shape. */
function glow(id: string, shape: string): string {
  return `<g filter="url(#${id}-glow)">${shape}</g>${shape}`;
}

// ---------------------------------------------------------------- critters

function wolf(id: string, awakened: boolean): string {
  const rim = RIM.critter;
  const hi = awakened ? RIM.magic : rim;
  const head = sym([[128, 84], [108, 80], [90, 30], [76, 62], [70, 88], [56, 100], [42, 126], [56, 134], [44, 156], [66, 160], [82, 178], [104, 188], [116, 206], [128, 208]]);
  const body = sym([[128, 150], [80, 158], [38, 188], [16, 250], [128, 256]]);
  let s = '';
  if (awakened) s += `<circle cx="128" cy="132" r="96" fill="${RIM.magic}" opacity=".18" filter="url(#${id}-glow)"/>`;
  s += lit(id, hi, P(body), STEEL.deep, -3, -2);
  // Shoulder ruff planes.
  s += pair([[80, 158], [38, 188], [26, 222], [70, 196], [100, 172]], STEEL.dark);
  s += lit(id, hi, P(head), STEEL.mid);
  // Outer ruff (darker), forehead and muzzle planes.
  s += pair([[70, 88], [56, 100], [42, 126], [56, 134], [44, 156], [66, 160], [82, 178], [92, 150], [86, 112]], STEEL.dark);
  s += path(P(sym([[128, 84], [108, 80], [96, 108], [114, 122], [128, 118]])), STEEL.base);
  s += path(P(sym([[128, 120], [118, 128], [114, 182], [128, 192]])), STEEL.light);
  s += pair([[104, 82], [91, 42], [82, 78]], STEEL.void);
  // Nose and mouth.
  s += path(P([[116, 189], [140, 189], [136, 199], [128, 204], [120, 199]]), STEEL.void);
  // Eyes (slanted).
  const eye: Pt[] = [[96, 124], [112, 121], [117, 130], [104, 132]];
  s += glow(id, pair(eye, awakened ? RIM.magic : mix(rim, '#ffffff', 0.35)));
  if (awakened) {
    const m = `stroke="${RIM.magic}" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity=".85"`;
    const marks = `<path d="${L([[110, 94], [128, 110], [146, 94]])}M128 70V100${L([[100, 138], [94, 152], [98, 168]])}${L([[156, 138], [162, 152], [158, 168]])}${L([[72, 112], [80, 124], [74, 138]])}${L([[184, 112], [176, 124], [182, 138]])}" ${m}/>`;
    s += glow(id, marks);
    // Extra spines on the ruff.
    s += pair([[56, 134], [30, 140], [46, 156]], STEEL.dark);
  }
  return awakened ? `<g transform="translate(128 150) scale(1.1) translate(-128 -150)">${s}</g>` : s;
}

function dog(id: string): string {
  const rim = RIM.critter;
  const body = sym([[128, 168], [84, 174], [48, 198], [24, 250], [128, 256]]);
  const head = sym([[128, 64], [104, 64], [84, 72], [74, 90], [70, 118], [72, 148], [80, 170], [96, 186], [112, 194], [128, 196]]);
  const ear: Pt[] = [[88, 70], [62, 74], [50, 90], [56, 128], [70, 118], [76, 92]];
  let s = lit(id, rim, P(body), STEEL.deep, -3, -2);
  s += pair([[84, 174], [48, 198], [36, 226], [80, 200]], STEEL.dark);
  s += lit(id, rim, P(ear), STEEL.dark, -3, -3, false) + lit(id, rim, P(mir(ear)), STEEL.dark, -3, -3, false);
  s += lit(id, rim, P(head), STEEL.mid);
  s += path(P(sym([[128, 66], [104, 67], [94, 96], [112, 108], [128, 104]])), STEEL.base);
  // Jowls, muzzle block, nose.
  s += path(P(sym([[96, 146], [80, 170], [96, 186], [112, 194], [128, 196], [128, 186], [114, 182], [100, 172]])), STEEL.dark);
  s += path(P(sym([[128, 124], [108, 128], [98, 146], [100, 172], [114, 182], [128, 184]])), STEEL.light);
  s += path(P(sym([[114, 136], [128, 134]]).concat([[138, 150], [128, 156], [118, 150]] as Pt[])), STEEL.void);
  s += path(P(sym([[104, 164], [128, 168]]).concat([[146, 180], [128, 184], [110, 180]] as Pt[])), STEEL.void);
  s += pair([[108, 165], [115, 167], [112, 178]], STEEL.ink);
  // Heavy brows and a furrow.
  s += pair([[86, 102], [100, 102], [122, 112], [92, 112]], STEEL.dark);
  s += `<path d="M124 90L125 106M132 90L131 106" stroke="${STEEL.dark}" stroke-width="2.5" stroke-linecap="round"/>`;
  s += glow(id, pair([[96, 114], [110, 113], [112, 119], [100, 121]], mix(rim, '#ffffff', 0.35)));
  // Studded collar.
  s += lit(id, rim, P([[62, 194], [128, 206], [194, 194], [198, 212], [128, 226], [58, 212]]), STEEL.void, 0, -3);
  let studs = '';
  for (const t of [-0.8, -0.4, 0, 0.4, 0.8]) studs += `<circle cx="${n(128 + t * 66)}" cy="${n(216 - Math.abs(t) * 12)}" r="3.5" fill="${rim}"/>`;
  s += glow(id, studs);
  return s;
}

function cat(id: string): string {
  const rim = RIM.critter;
  const body = sym([[128, 160], [86, 168], [48, 196], [32, 250], [128, 256]]);
  const head = sym([[128, 70], [108, 68], [96, 68], [90, 56], [78, 52], [68, 60], [66, 78], [56, 100], [50, 126], [58, 152], [70, 172], [88, 188], [108, 198], [128, 202]]);
  let s = lit(id, rim, P(body), STEEL.deep, -3, -2);
  s += pair([[86, 168], [48, 196], [38, 228], [86, 194]], STEEL.dark);
  s += lit(id, rim, P(head), STEEL.mid);
  s += pair([[66, 78], [56, 100], [50, 126], [58, 152], [70, 172], [88, 188], [92, 160], [86, 118], [80, 92]], STEEL.dark);
  s += pair([[90, 66], [86, 58], [76, 58], [72, 74]], STEEL.void);
  s += path(P(sym([[128, 72], [106, 70], [98, 96], [114, 106], [128, 104]])), STEEL.base);
  s += path(P(sym([[128, 106], [116, 112], [112, 146], [128, 150]])), STEEL.light);
  // Rosettes.
  let ros = '';
  for (const [x, y] of [[112, 82], [128, 90], [100, 72], [68, 120], [74, 142], [62, 104], [82, 160], [60, 196], [80, 214]] as Pt[]) {
    ros += `M${x - 4} ${y}a4 4 0 1 0 8 0a4 4 0 1 0-8 0M${252 - x} ${y}a4 4 0 1 0 8 0a4 4 0 1 0-8 0`;
  }
  s += `<path d="${ros}" fill="none" stroke="${STEEL.void}" stroke-width="2.2" opacity=".55"/>`;
  // Muzzle pads, broad nose, snarl with fangs.
  s += `<ellipse cx="110" cy="166" rx="18" ry="11" fill="${STEEL.light}"/><ellipse cx="146" cy="166" rx="18" ry="11" fill="${STEEL.light}"/>`;
  s += path(P([[112, 144], [144, 144], [136, 156], [128, 159], [120, 156]]), STEEL.void);
  s += path(P([[104, 176], [152, 176], [142, 198], [114, 198]]), STEEL.void);
  s += pair([[107, 176], [118, 176], [114, 196]], STEEL.ink);
  s += `<path d="M94 164L56 156M94 170L54 176M162 164L200 156M162 170L202 176" stroke="${STEEL.pale}" stroke-width="1.2" opacity=".6"/>`;
  // Heavy brow over narrow, slanted eyes with slit pupils.
  s += pair([[80, 104], [100, 100], [118, 108], [100, 106]], STEEL.dark);
  const eye: Pt[] = [[84, 114], [100, 106], [115, 112], [105, 120], [92, 120]];
  s += glow(id, pair(eye, mix(rim, '#e8f070', 0.4)));
  s += pair([[99, 108], [102, 108], [102, 120], [99, 120]], STEEL.void);
  return s;
}

function bear(id: string): string {
  const rim = RIM.critter;
  const body = sym([[128, 132], [72, 132], [30, 168], [10, 250], [128, 256]]);
  const head = sym([[128, 70], [104, 70], [84, 80], [66, 100], [56, 126], [60, 152], [76, 172], [100, 186], [128, 192]]);
  let s = lit(id, rim, P(body), STEEL.deep, -3, -2);
  s += pair([[72, 132], [30, 168], [20, 210], [64, 170], [96, 150]], STEEL.dark);
  s += lit(id, rim, 'M58 80a20 20 0 1 0 40 0a20 20 0 1 0-40 0ZM158 80a20 20 0 1 0 40 0a20 20 0 1 0-40 0Z', STEEL.dark);
  s += `<circle cx="78" cy="80" r="9" fill="${STEEL.void}"/><circle cx="178" cy="80" r="9" fill="${STEEL.void}"/>`;
  s += lit(id, rim, P(head), STEEL.mid);
  s += pair([[66, 100], [56, 126], [60, 152], [76, 172], [92, 150], [86, 112]], STEEL.dark);
  s += path(P(sym([[128, 72], [104, 72], [96, 96], [110, 106], [128, 102]])), STEEL.base);
  // Long, pale, protruding muzzle with the nose on top.
  s += path(P(sym([[128, 106], [112, 110], [100, 132], [98, 160], [108, 180], [128, 188]])), mix(STEEL.light, rim, 0.22));
  s += path(P(sym([[128, 106], [116, 110], [114, 120], [128, 118]])), STEEL.pale);
  s += path(P([[110, 120], [146, 120], [142, 134], [128, 140], [114, 134]]), STEEL.void);
  s += `<path d="M128 140V152" stroke="${STEEL.void}" stroke-width="3"/>`;
  s += path(P([[108, 154], [148, 154], [140, 176], [116, 176]]), STEEL.void);
  s += pair([[110, 154], [118, 154], [114, 166]], STEEL.ink) + pair([[112, 176], [119, 176], [116, 167]], STEEL.ink);
  s += pair([[86, 96], [108, 96], [112, 104], [90, 104]], STEEL.dark);
  s += glow(id, `<circle cx="100" cy="106" r="4" fill="${mix(rim, '#ffffff', 0.35)}"/><circle cx="156" cy="106" r="4" fill="${mix(rim, '#ffffff', 0.35)}"/>`);
  return s;
}

function critter(id: string): string {
  const rim = RIM.critter;
  let slash = '';
  for (const o of [-30, 0, 30]) {
    const cx = 128 + o * 0.8; const cy = 124 + o * 0.6; const w = 4;
    slash += P([[cx - 0.6 * 110, cy + 0.8 * 110], [cx + 0.8 * w, cy + 0.6 * w], [cx + 0.6 * 110, cy - 0.8 * 110], [cx - 0.8 * w, cy - 0.6 * w]]);
  }
  let s = glow(id, path(slash, rim, ' opacity=".5"'));
  const pad = 'M128 132C150 132 176 156 178 180C180 200 162 206 146 200C136 196 120 196 110 200C94 206 76 200 78 180C80 156 106 132 128 132Z';
  s += lit(id, rim, pad, STEEL.mid);
  const toes: Array<[number, number, number]> = [[78, 120, -28], [106, 88, -10], [150, 88, 10], [178, 120, 28]];
  for (const [x, y, a] of toes) {
    const t = `translate(${x} ${y}) rotate(${a})`;
    s += `<g transform="${t}"><path d="M-4 -26L0 -40L4 -26Z" fill="${rim}"/>`
      + `<ellipse cx="-2" cy="-2" rx="15" ry="21" fill="${rim}"/>`
      + `<ellipse rx="15" ry="21" fill="${STEEL.mid}" stroke="${rim}" stroke-opacity=".35" stroke-width="1.5"/>`
      + `<ellipse cx="3" cy="4" rx="8" ry="12" fill="${STEEL.base}"/></g>`;
  }
  s += path('M128 142C146 142 164 160 166 176C150 172 140 168 128 168Z', STEEL.base);
  return s;
}

// ---------------------------------------------------------------- matrix

function icWhite(id: string, rim: string): string {
  let s = `<ellipse cx="128" cy="128" rx="98" ry="24" fill="none" stroke="${rim}" stroke-width="2" opacity=".5" transform="rotate(-14 128 128)"/>`;
  const outline: Pt[] = [[128, 28], [178, 96], [162, 188], [128, 224], [94, 188], [78, 96]];
  s += lit(id, rim, P(outline), STEEL.mid);
  s += path(P([[128, 28], [78, 96], [128, 112]]), STEEL.light);
  s += path(P([[128, 28], [178, 96], [128, 112]]), STEEL.base);
  s += path(P([[78, 96], [94, 188], [128, 224], [128, 112]]), STEEL.mid);
  s += path(P([[178, 96], [162, 188], [128, 224], [128, 112]]), STEEL.dark);
  s += `<path d="M128 112V224M78 96L128 112L178 96" stroke="${rim}" stroke-width="1.5" opacity=".5" fill="none"/>`;
  // Side shields.
  s += lit(id, rim, P([[50, 104], [64, 96], [70, 160], [56, 172]]), STEEL.dark) + lit(id, rim, P(mir([[50, 104], [64, 96], [70, 160], [56, 172]])), STEEL.dark, 3, -3);
  // Front arc of the ring and the eye.
  s += `<path d="M30 128A98 24 0 0 0 226 128" stroke="${rim}" stroke-width="2.5" fill="none" transform="rotate(-14 128 128)"/>`;
  s += glow(id, `<circle cx="128" cy="124" r="13" fill="none" stroke="${rim}" stroke-width="3"/><circle cx="128" cy="124" r="6" fill="${STEEL.ink}"/>`);
  return s;
}

function icGray(id: string, rim: string): string {
  const blade = 'M128 84Q166 40 214 46Q176 62 158 104Z';
  let blades = '';
  for (const a of [0, 90, 180, 270]) blades += `<path d="${blade}" transform="rotate(${a} 128 128)"/>`;
  let s = `<g fill="${rim}" opacity=".45" filter="url(#${id}-glow)">${blades}</g>`;
  s += `<g fill="${rim}" transform="translate(-3 -3)">${blades}</g>`;
  s += `<g fill="${STEEL.base}" stroke="${rim}" stroke-opacity=".4" stroke-width="1.5">${blades}</g>`;
  // Inner edge highlight of each blade.
  let edges = '';
  for (const a of [0, 90, 180, 270]) edges += `<path d="M132 88Q168 50 206 50" transform="rotate(${a} 128 128)"/>`;
  s += `<g stroke="${STEEL.pale}" stroke-width="2" fill="none" opacity=".7">${edges}</g>`;
  // Hexagonal core.
  const hex: Pt[] = [];
  for (let i = 0; i < 6; i++) { const t = Math.PI / 6 + (i * Math.PI) / 3; hex.push([128 + 46 * Math.cos(t), 128 + 46 * Math.sin(t)]); }
  s += lit(id, rim, P(hex), STEEL.mid);
  s += path(P([hex[3]!, hex[4]!, hex[5]!, [128, 128]]), STEEL.light);
  s += path(P([hex[0]!, hex[1]!, hex[2]!, [128, 128]]), STEEL.dark);
  s += path(P([hex[5]!, hex[0]!, [128, 128]]), STEEL.base);
  // Narrow, angry eye slit.
  s += glow(id, path(P([[100, 118], [156, 118], [148, 132], [108, 132]]), STEEL.void, ` stroke="${rim}" stroke-width="2"`) + path(P([[110, 122], [146, 122], [128, 130]]), STEEL.ink));
  return s;
}

function icBlack(id: string, rim: string): string {
  // Spider legs behind the mask.
  const leg = (pts: Pt[]) => L(pts) + L(mir(pts));
  const legs = leg([[92, 110], [44, 64], [24, 96]]) + leg([[86, 140], [30, 130], [14, 168]]) + leg([[96, 170], [48, 186], [40, 226]]);
  let s = `<path d="${legs}" fill="none" stroke="${rim}" stroke-width="9" stroke-linejoin="round" stroke-linecap="round" opacity=".5" transform="translate(-2 -2)"/>`;
  s += `<path d="${legs}" fill="none" stroke="${STEEL.dark}" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"/>`;
  const skull = sym([[128, 34], [92, 46], [66, 82], [62, 124], [76, 150], [84, 176], [104, 196], [128, 200]]);
  s += lit(id, rim, P(skull), STEEL.dark);
  s += path(P(sym([[128, 36], [92, 48], [76, 76], [100, 96], [128, 92]])), STEEL.base);
  s += pair([[66, 82], [62, 124], [76, 150], [90, 140], [78, 100]], STEEL.deep);
  s += pair([[100, 96], [76, 76], [78, 100], [92, 140], [108, 146]], STEEL.mid);
  // Jaw and teeth.
  s += path(P(sym([[84, 176], [104, 196], [128, 200], [128, 166], [100, 162]])), STEEL.deep);
  s += `<path d="M104 166L106 188M116 167L117 194M128 167V198M140 167L139 194M152 166L150 188" stroke="${rim}" stroke-width="1.5" opacity=".7"/>`;
  s += path(P([[128, 134], [118, 156], [138, 156]]), STEEL.void);
  // Eye sockets with burning points.
  const sock: Pt[] = [[78, 106], [118, 114], [110, 140], [86, 134]];
  s += pair(sock, STEEL.void);
  s += glow(id, `<circle cx="100" cy="124" r="6" fill="${rim}"/><circle cx="156" cy="124" r="6" fill="${rim}"/>`);
  s += `<circle cx="100" cy="124" r="2.5" fill="${STEEL.ink}"/><circle cx="156" cy="124" r="2.5" fill="${STEEL.ink}"/>`;
  return s;
}

function host(id: string, rim: string): string {
  let s = `<path d="M60 40V190M84 20V180M172 24V180M196 44V190" stroke="${rim}" stroke-width="2" stroke-dasharray="6 10" opacity=".35"/>`;
  s += `<ellipse cx="128" cy="204" rx="92" ry="22" fill="${rim}" opacity=".35" filter="url(#${id}-glow)"/>`;
  s += `<ellipse cx="128" cy="204" rx="86" ry="20" fill="${STEEL.deep}" stroke="${rim}" stroke-width="2"/>`;
  const tiers: Array<[number, number, number]> = [[100, 196, 150], [74, 146, 104], [48, 100, 66]];
  for (const [w, b, t] of tiers) {
    const h = w / 2; const q = w / 4;
    s += `<path d="${P([[128 - h, t], [128, t + q], [128, b + q], [128 - h, b]])}" fill="${rim}" transform="translate(-3 0)"/>`;
    s += path(P([[128 - h, t], [128, t + q], [128, b + q], [128 - h, b]]), STEEL.base);
    s += path(P([[128 + h, t], [128, t + q], [128, b + q], [128 + h, b]]), STEEL.dark);
    s += path(P([[128 - h, t], [128, t - q], [128 + h, t], [128, t + q]]), STEEL.light, ` stroke="${rim}" stroke-width="1.5"`);
    // Glowing data seams on the faces.
    let seams = '';
    for (let y = t + 12; y < b - 4; y += 12) seams += `M${n(128 - h + 6)} ${n(y + 3)}L${n(128 - 6)} ${n(y + q - 3)}M${n(128 + 6)} ${n(y + q - 3)}L${n(128 + h - 10)} ${n(y + 5)}`;
    s += `<path d="${seams}" stroke="${rim}" stroke-width="2" opacity=".75"/>`;
  }
  s += lit(id, rim, P([[128, 22], [138, 62], [128, 70], [118, 62]]), STEEL.light);
  s += glow(id, `<circle cx="128" cy="22" r="5" fill="${STEEL.ink}"/><path d="M128 70V230" stroke="${rim}" stroke-width="2.5"/>`);
  return s;
}

// ---------------------------------------------------------------- misc

function barrier(id: string): string {
  const rim = RIM.magic;
  const cx = 128; const cy = 182; const r = 92;
  const els = [0, 24, 48, 70, 90];
  const azs = [-90, -60, -30, 0, 30, 60, 90];
  const pt = (az: number, el: number): Pt => {
    const a = (az * Math.PI) / 180; const e = (el * Math.PI) / 180;
    return [cx + r * Math.cos(e) * Math.sin(a), cy - r * Math.sin(e) + 10 * Math.cos(e) * Math.cos(a)];
  };
  let mesh = '';
  for (let i = 0; i < els.length - 1; i++) {
    for (let j = 0; j < azs.length; j++) {
      const off = i % 2 ? 15 : 0;
      const p = pt(azs[j]! + off, els[i]!);
      const q = pt(Math.min(90, azs[j]! + off + 30), els[i]!);
      const u = pt(azs[j]! + (i % 2 ? 0 : 15), els[i + 1]!);
      if (azs[j]! + off <= 90) mesh += L([p, q]) + L([p, u]);
    }
  }
  for (const az of azs) mesh += L(els.map((e) => pt(az, e)));
  let s = `<ellipse cx="${cx}" cy="${cy + 8}" rx="108" ry="20" fill="${rim}" opacity=".35" filter="url(#${id}-glow)"/>`;
  s += `<path d="M${cx - r} ${cy + 10}A${r} ${r + 10} 0 0 1 ${cx + r} ${cy + 10}Z" fill="${rim}" opacity=".14"/>`;
  s += `<path d="M${cx - r} ${cy + 10}A${r} ${r + 10} 0 0 1 ${cx + r} ${cy + 10}" fill="none" stroke="${rim}" stroke-width="6" opacity=".6" filter="url(#${id}-glow)"/>`;
  s += `<path d="${mesh}" fill="none" stroke="${mix(rim, '#ffffff', 0.3)}" stroke-width="1.8" opacity=".75"/>`;
  s += `<path d="M${cx - r} ${cy + 10}A${r} ${r + 10} 0 0 1 ${cx + r} ${cy + 10}" fill="none" stroke="${mix(rim, '#ffffff', 0.5)}" stroke-width="3"/>`;
  s += `<ellipse cx="${cx}" cy="${cy + 10}" rx="${r}" ry="12" fill="none" stroke="${rim}" stroke-width="3"/>`;
  // A gleam on the upper left of the dome.
  s += `<path d="M62 138A80 80 0 0 1 112 96" stroke="${STEEL.ink}" stroke-width="4" stroke-linecap="round" fill="none" opacity=".7" filter="url(#${id}-glow)"/>`;
  s += `<path d="M66 134A76 76 0 0 1 108 100" stroke="${STEEL.ink}" stroke-width="2" stroke-linecap="round" fill="none"/>`;
  return s;
}

function site(id: string): string {
  const rim = RIM.security;
  // Neighbouring blocks.
  let s = path(P([[30, 120], [70, 112], [70, 250], [30, 250]]), STEEL.deep) + path(P([[180, 132], [226, 140], [226, 250], [180, 250]]), STEEL.deep);
  const front: Pt[] = [[92, 46], [140, 34], [140, 250], [92, 250]];
  const side: Pt[] = [[140, 34], [172, 50], [172, 250], [140, 250]];
  s += lit(id, rim, P([...front.slice(0, 2), ...side.slice(1, 3), [92, 250]]), STEEL.mid);
  s += path(P(side), STEEL.dark);
  s += path(P([[92, 46], [140, 34], [140, 40], [92, 52]]), STEEL.light);
  // Window grid, a few lit.
  let win = ''; let lit1 = '';
  for (let y = 64; y < 236; y += 14) for (let k = 0; k < 4; k++) {
    const x = 98 + k * 10; const r = `M${x} ${y}h6v7h-6Z`;
    ((y * 7 + k * 13) % 11 === 0) ? (lit1 += r) : (win += r);
  }
  s += path(win, STEEL.base) + glow(id, path(lit1, rim));
  s += `<path d="M146 70L166 80M146 110L166 118M146 150L166 156M146 190L166 194" stroke="${STEEL.mid}" stroke-width="3"/>`;
  // Security camera on a bracket, with its sweep.
  s += `<path d="M92 82L52 150L106 148Z" fill="${rim}" opacity=".18"/>`;
  s += `<path d="M92 70H80V78" stroke="${STEEL.light}" stroke-width="4" fill="none"/>`;
  s += lit(id, rim, P([[64, 74], [92, 78], [88, 94], [60, 88]]), STEEL.light);
  s += path(P([[60, 88], [64, 74], [56, 78], [54, 88]]), STEEL.dark);
  s += glow(id, `<circle cx="58" cy="84" r="3.5" fill="#ff5a4a"/>`);
  // Shield crest at the base.
  const shield = 'M116 176L148 186V206C148 222 132 232 116 238C100 232 84 222 84 206V186Z';
  s += lit(id, rim, shield, STEEL.deep, -2, -2);
  s += `<path d="M116 184L140 192V206C140 218 128 226 116 230Z" fill="${STEEL.mid}"/>`;
  s += glow(id, `<circle cx="116" cy="206" r="6" fill="none" stroke="${rim}" stroke-width="2.5"/><circle cx="116" cy="206" r="2" fill="${rim}"/>`);
  return s;
}

function safehouse(id: string): string {
  const rim = RIM.street;
  const warm = '#f4b860';
  let s = path(P([[16, 100], [56, 92], [56, 250], [16, 250]]), STEEL.deep) + path(P([[200, 84], [240, 92], [240, 250], [200, 250]]), STEEL.deep);
  const bld: Pt[] = [[52, 92], [204, 92], [204, 230], [52, 230]];
  s += lit(id, rim, P(bld), STEEL.mid);
  s += path(P([[46, 84], [210, 84], [210, 96], [46, 96]]), STEEL.dark, ` stroke="${rim}" stroke-opacity=".5" stroke-width="1.5"`);
  // Brick courses.
  let bricks = '';
  for (let y = 108; y < 230; y += 12) bricks += `M54 ${y}H202`;
  s += `<path d="${bricks}" stroke="${STEEL.dark}" stroke-width="1.5" opacity=".6"/>`;
  // Dark windows and the one lit window.
  s += path('M70 112h34v36h-34Z', STEEL.void);
  s += `<path d="M196 96V230" stroke="${STEEL.light}" stroke-width="3"/>`;
  s += `<path d="M152 112h34v36h-34Z" fill="${warm}" opacity=".5" filter="url(#${id}-glow)"/>`;
  s += path('M152 112h34v36h-34Z', warm);
  s += `<path d="M152 122h34M152 132h34M152 142h34" stroke="${mix(warm, '#7a4a18', 0.5)}" stroke-width="2"/>`;
  s += `<path d="M150 150L188 150L200 196L140 196Z" fill="${warm}" opacity=".12"/>`;
  // Door with a step and a single dim handle.
  s += path('M90 166h40v64h-40Z', STEEL.void, ` stroke="${rim}" stroke-opacity=".6" stroke-width="1.5"`);
  s += path('M94 170h32v56h-32Z', STEEL.deep);
  s += path('M84 230h52v8h-52Z', STEEL.light);
  s += path('M82 158h56l-6 -8h-44Z', STEEL.light, ` stroke="${rim}" stroke-opacity=".5"`);
  s += `<circle cx="121" cy="200" r="2.5" fill="${rim}"/>`;
  s += path('M0 238H256V256H0Z', STEEL.void);
  return s;
}

// ---------------------------------------------------------------- export

/** `rim` is the category (v0.84.1); `colour`, when set, is the subject's own colour (IC by its kind). */
interface Def { file: string; title: string; rim: string; colour?: string; bg: TokenSpec['bg']; draw: (id: string, colour: string) => string }

const DEFS: Def[] = [
  { file: 'critters/dog.svg', title: 'Guard dog (default token)', rim: RIM.critter, bg: 'night', draw: (id) => dog(id) },
  { file: 'critters/wolf.svg', title: 'Wolf (default token)', rim: RIM.critter, bg: 'night', draw: (id) => wolf(id, false) },
  { file: 'critters/cat.svg', title: 'Big cat (default token)', rim: RIM.critter, bg: 'night', draw: (id) => cat(id) },
  { file: 'critters/bear.svg', title: 'Bear (default token)', rim: RIM.critter, bg: 'night', draw: (id) => bear(id) },
  { file: 'critters/awakenedWolf.svg', title: 'Awakened wolf (default token)', rim: RIM.critter, bg: 'night', draw: (id) => wolf(id, true) },
  { file: 'critters/critter.svg', title: 'Critter (default token)', rim: RIM.critter, bg: 'night', draw: (id) => critter(id) },
  { file: 'matrix/ic-white.svg', title: 'White IC (default token)', rim: RIM.matrix, colour: '#d6e3ee', bg: 'grid', draw: icWhite },
  { file: 'matrix/ic-gray.svg', title: 'Gray IC (default token)', rim: RIM.matrix, colour: '#9aa7b4', bg: 'grid', draw: icGray },
  { file: 'matrix/ic-black.svg', title: 'Black IC (default token)', rim: RIM.matrix, colour: RIM.combat, bg: 'grid', draw: icBlack },
  { file: 'matrix/host.svg', title: 'Host (default token)', rim: RIM.matrix, bg: 'grid', draw: host },
  { file: 'misc/barrier.svg', title: 'Magical barrier (default token)', rim: RIM.magic, bg: 'astral', draw: (id) => barrier(id) },
  { file: 'misc/site.svg', title: 'Secured site (default token)', rim: RIM.security, bg: 'night', draw: (id) => site(id) },
  { file: 'misc/safehouse.svg', title: 'Safehouse (default token)', rim: RIM.street, bg: 'night', draw: (id) => safehouse(id) },
];

export function files(): ArtFile[] {
  return DEFS.map((d) => {
    const id = d.file.replace(/\.svg$/, '').replace(/[^a-zA-Z0-9]/g, '-');
    return { file: d.file, svg: token({ id, title: d.title, rim: d.rim, bg: d.bg, body: d.draw(id, d.colour ?? d.rim) }) };
  });
}
