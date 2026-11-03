/**
 * v0.83.0: default token art for spirits (elementals, nature spirits, watchers, allies, free, toxic, insect).
 * Original drawings in the shared "neon noir" frame (see ./frame.ts); spirits are drawn more luminous and
 * translucent than the other sets. No text, no logos, no book art.
 */
import { token, STEEL, RIM, mix, n, type ArtFile } from './frame.ts';

/** A point; a third value of 1 makes it a sharp corner. */
type P = [number, number, number?];

/** A smooth closed (or open) path through the points (Catmull-Rom as cubic Béziers). */
function smooth(pts: P[], closed = true): string {
  const m = pts.length;
  const at = (i: number): P => (closed ? pts[(i + m) % m]! : pts[Math.max(0, Math.min(m - 1, i))]!);
  let d = `M${n(pts[0]![0])} ${n(pts[0]![1])}`;
  const segs = closed ? m : m - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    const c1 = p1[2] ? p1 : [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = p2[2] ? p2 : [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${n(c1[0]!)} ${n(c1[1]!)} ${n(c2[0]!)} ${n(c2[1]!)} ${n(p2[0])} ${n(p2[1])}`;
  }
  return closed ? d + 'Z' : d;
}

/** Mirrors a right half (top centre, down the right side, to bottom centre) into a full outline. */
function mirror(half: P[]): P[] {
  const back = half.slice(1, -1).reverse().map(([x, y, s]): P => [256 - x, y, s]);
  return [...half, ...back];
}
const sym = (half: P[]): string => smooth(mirror(half));

/** A straight polygon path. */
const poly = (pts: number[][]): string => 'M' + pts.map(([x, y]) => `${n(x!)} ${n(y!)}`).join('L') + 'Z';

/** A shape glowing at its edge: a blurred rim halo, then the fill with a thin rim line. */
function lit(id: string, key: string, d: string, rim: string, fill: string, glow = 7): string {
  return `<defs><path id="${id}-${key}" d="${d}"/></defs><use href="#${id}-${key}" fill="none" stroke="${rim}" stroke-width="${glow}" filter="url(#${id}-glow)"/>`
    + `<use href="#${id}-${key}" fill="${fill}" stroke="${rim}" stroke-width="1.6"/>`;
}
/** A vertical gradient. */
const vgrad = (id: string, stops: Array<[number, string, number?]>): string =>
  `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">${stops.map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}"${a === undefined ? '' : ` stop-opacity="${a}"`}/>`).join('')}</linearGradient>`;
/** A pair of glowing eyes. */
function eyes(id: string, cx: number, cy: number, gap: number, rx: number, ry: number, col: string, tilt = 12): string {
  const e = (s: number) => `<ellipse cx="${n(cx + s * gap)}" cy="${n(cy)}" rx="${rx}" ry="${ry}" transform="rotate(${-s * tilt} ${n(cx + s * gap)} ${n(cy)})"/>`;
  return `<g fill="${col}"><g filter="url(#${id}-glow)">${e(-1)}${e(1)}</g>${e(-1)}${e(1)}</g>`;
}
const glowDup = (id: string, svg: string): string => `<g filter="url(#${id}-glow)">${svg}</g>${svg}`;

// ---------------------------------------------------------------------------------------------- elementals

function fire(id: string, rim: string): string {
  const hot = mix(rim, '#ffe08a', 0.65);
  const flame = sym([[128, 14, 1], [144, 40], [156, 64], [170, 44, 1], [178, 80], [198, 62, 1], [204, 104], [212, 140], [230, 122, 1], [224, 178], [244, 214], [128, 252]]);
  const inner = sym([[128, 44, 1], [138, 62], [148, 84], [158, 74, 1], [164, 104], [182, 100, 1], [184, 140], [196, 170, 1], [194, 210], [128, 250]]);
  const body = sym([[128, 60], [146, 66], [151, 86], [143, 106], [137, 114], [166, 124], [182, 142], [178, 200], [190, 250], [128, 250]]);
  const lick = (x: number, y: number, h: number, w: number) => `M${x} ${y}c${w} ${-h * 0.4} ${w * 0.4} ${-h * 0.8} 0 ${-h}c${w * 0.2} ${h * 0.5} ${-w * 0.9} ${h * 0.6} 0 ${h}Z`;
  return `<defs>${vgrad(`${id}-f`, [[0, hot], [0.5, rim], [1, mix(rim, '#000000', 0.5)]])}</defs>`
    + lit(id, 'o', flame, rim, `url(#${id}-f)`, 10)
    + `<path d="${inner}" fill="${hot}" fill-opacity=".55"/>`
    + `<path d="${body}" fill="${STEEL.deep}" fill-opacity=".88" stroke="${hot}" stroke-width="2"/>`
    + `<path d="${lick(128, 238, 70, 22)}${lick(108, 236, 46, -14)}${lick(150, 236, 50, 14)}" fill="${rim}" fill-opacity=".85"/>`
    + glowDup(id, `<path d="${lick(128, 232, 40, 12)}" fill="${hot}"/>`)
    + eyes(id, 128, 86, 9, 5, 2.6, hot);
}

function water(id: string, rim: string): string {
  const pale = mix(rim, '#ffffff', 0.55);
  const body = smooth([[128, 40], [150, 46], [158, 70], [150, 96], [142, 106], [176, 116], [196, 138], [204, 172], [214, 206], [234, 214], [236, 250], [20, 250], [22, 214], [42, 206], [52, 172], [60, 138], [80, 116], [114, 106], [106, 96], [98, 70], [106, 46]]);
  const crest = (x: number, y: number, s: number) => `M${x} ${y}c${18 * s} -26 ${50 * s} -24 ${56 * s} 2c${-12 * s} -10 ${-30 * s} -6 ${-28 * s} 10`;
  return `<defs>${vgrad(`${id}-w`, [[0, mix(rim, STEEL.deep, 0.35), 0.95], [0.6, mix(rim, STEEL.deep, 0.72), 0.95], [1, STEEL.void, 0.9]])}</defs>`
    + lit(id, 'b', body, rim, `url(#${id}-w)`, 8)
    + `<g fill="none" stroke="${pale}" stroke-linecap="round" stroke-width="2.5" stroke-opacity=".75">`
    + `<path d="M112 52c-10 8-12 24-6 36M84 132c-8 20-8 44 0 64M172 132c8 20 8 44 0 64M120 140c10 10 26 10 34 0M110 172c14 10 34 10 46-2"/></g>`
    + `<path d="M0 222c30-18 52-18 78 0s48 18 74 0 52-18 78 0 30 10 26 0V256H0Z" fill="${mix(rim, STEEL.deep, 0.45)}" fill-opacity=".9" stroke="${rim}" stroke-width="2"/>`
    + glowDup(id, `<path d="${crest(56, 220, 1)}${crest(200, 220, -1)}" fill="none" stroke="${pale}" stroke-width="3" stroke-linecap="round"/>`)
    + `<g fill="${pale}"><circle cx="208" cy="96" r="4"/><circle cx="220" cy="120" r="2.5"/><circle cx="46" cy="104" r="3.5"/><circle cx="36" cy="128" r="2"/></g>`
    + eyes(id, 128, 74, 10, 5, 3, pale);
}

function air(id: string, rim: string): string {
  const pale = mix(rim, '#ffffff', 0.5);
  let rings = '';
  for (let i = 0; i < 9; i++) {
    const y = 108 + i * 15, rx = 74 - i * 7.2, cx = 128 + Math.sin(i * 0.9) * 8;
    const a = (0.9 - i * 0.05).toFixed(2);
    rings += `<path d="M${n(cx - rx)} ${n(y)}a${n(rx)} ${n(rx * 0.22)} 0 1 0 ${n(rx * 2)} 0" stroke-opacity="${a}" stroke-width="${n(5 - i * 0.3)}"/>`;
  }
  const head = `M104 62C116 44 150 44 158 70S146 108 120 104M100 84C98 102 112 110 128 108M150 60C140 52 120 52 112 62`;
  const streak = `M30 92c30-14 54-10 68 2M226 92c-30-14-54-10-68 2M24 150c20-8 34-6 44 4M232 150c-20-8-34-6-44 4M60 210c16 8 30 8 42 0M196 210c-16 8-30 8-42 0`;
  return `<ellipse cx="128" cy="150" rx="80" ry="90" fill="${rim}" fill-opacity=".08" filter="url(#${id}-glow)"/>`
    + `<path d="M54 110L128 244 202 110Z" fill="${STEEL.deep}" fill-opacity=".55"/>`
    + `<circle cx="128" cy="76" r="30" fill="${STEEL.deep}" fill-opacity=".7"/>`
    + glowDup(id, `<g fill="none" stroke="${pale}" stroke-linecap="round">${rings}<path d="${head}" stroke-width="5"/></g>`)
    + `<path d="${streak}" fill="none" stroke="${rim}" stroke-width="3" stroke-linecap="round" stroke-opacity=".7"/>`
    + eyes(id, 128, 76, 9, 4.5, 2.4, '#ffffff');
}

function earth(id: string, rim: string): string {
  const hot = mix(rim, '#ffc070', 0.6);
  const S = STEEL;
  const rock = (d: number[][], f: string) => `<path d="${poly(d)}" fill="${f}" stroke="${mix(rim, S.deep, 0.3)}" stroke-width="2" stroke-linejoin="round"/>`;
  const shape = poly([[106, 50], [128, 40], [152, 50], [158, 78], [150, 98], [196, 108], [222, 140], [228, 196], [214, 250], [42, 250], [28, 196], [34, 140], [60, 108], [106, 98], [98, 78]]);
  return `<path d="${shape}" fill="none" stroke="${rim}" stroke-width="10" stroke-linejoin="round" filter="url(#${id}-glow)"/>`
    + rock([[60, 108], [112, 100], [104, 150], [34, 150]], S.base)
    + rock([[196, 108], [144, 100], [152, 150], [222, 140]], S.mid)
    + rock([[34, 150], [104, 150], [96, 210], [42, 250], [28, 196]], S.mid)
    + rock([[222, 140], [152, 150], [160, 210], [214, 250], [228, 196]], S.dark)
    + rock([[104, 104], [152, 104], [160, 150], [154, 214], [128, 240], [100, 214], [96, 150]], S.dark)
    + rock([[96, 210], [128, 240], [160, 210], [214, 250], [42, 250]], S.deep)
    + rock([[106, 50], [128, 40], [152, 50], [158, 78], [128, 104], [98, 78]], S.base)
    + rock([[128, 40], [152, 50], [158, 78], [128, 104]], S.mid)
    + glowDup(id, `<path d="M128 112l-8 22 14 14-10 24 8 16M60 128l20 8 8 12M196 126l-18 10-6 14M54 190l18-6M200 192l-18-6" fill="none" stroke="${hot}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/><path d="M118 130l10 8 10-8-4 14h-12Z" fill="${hot}"/>`)
    + eyes(id, 128, 76, 11, 5, 2.4, hot, 0);
}

// ----------------------------------------------------------------------------------------- nature spirits

function natureMan(id: string, rim: string): string {
  const S = STEEL; const fireC = '#f0a040'; const lamp = '#ffe9b0';
  const body = sym([[128, 54], [146, 58], [153, 78], [147, 98], [140, 108], [174, 116], [200, 134], [212, 170], [216, 250], [128, 250]]);
  const arch = 'M102 250V184c0-18 12-28 26-28s26 10 26 28V250Z';
  return `<defs><pattern id="${id}-k" width="28" height="28" patternUnits="userSpaceOnUse"><path d="M0 1H28M0 15H28M8 1v14M22 15v14" stroke="${S.deep}" stroke-width="2"/></pattern>${vgrad(`${id}-l`, [[0, lamp, 0.5], [1, lamp, 0]])}</defs>`
    + `<path d="M186 50L124 150H244Z" fill="url(#${id}-l)"/>`
    + `<path d="M214 250V64C214 42 200 36 186 40" fill="none" stroke="${S.mid}" stroke-width="7"/><path d="M172 40h28l6 10h-40Z" fill="${S.base}" stroke="${rim}" stroke-width="2"/>`
    + glowDup(id, `<ellipse cx="186" cy="52" rx="10" ry="4" fill="${lamp}"/>`)
    + lit(id, 'b', body, rim, S.dark, 8)
    + `<path d="${body}" fill="url(#${id}-k)"/>`
    + `<path d="M108 66c4-10 14-14 26-10" fill="none" stroke="${lamp}" stroke-opacity=".5" stroke-width="2.5" stroke-linecap="round"/>`
    + `<path d="${arch}" fill="${S.void}" stroke="${rim}" stroke-width="2"/>`
    + glowDup(id, `<path d="M128 248c-20 0-24-16-16-28 2 8 6 10 8 8-4-14 2-24 10-32-2 10 4 14 6 10 6 6 14 20 10 28-2 8-8 14-18 14Z" fill="${fireC}"/>`)
    + `<path d="M128 246c-8 0-10-8-4-14 2 4 4 4 4 2 0-6 2-10 6-12 0 6 4 8 4 14 0 6-4 10-10 10Z" fill="${lamp}"/>`
    + eyes(id, 128, 80, 9, 5, 2.6, fireC, 8)
    + `<g fill="${lamp}" fill-opacity=".9"><rect x="64" y="148" width="12" height="9"/><rect x="180" y="148" width="12" height="9"/><rect x="72" y="190" width="12" height="9"/></g>`;
}

function natureLand(id: string, rim: string): string {
  const S = STEEL; const leaf = mix(rim, '#7fd08a', 0.5);
  const head = sym([[128, 64], [146, 70], [152, 92], [146, 116], [136, 132], [128, 136]]);
  const body = sym([[128, 120], [146, 128], [176, 132], [202, 150], [214, 190], [218, 250], [128, 250]]);
  const antler = (s: number) => {
    const x = (v: number) => n(128 + s * v);
    return `M${x(14)} 74C${x(30)} 60 ${x(42)} 40 ${x(40)} 18M${x(36)} 50C${x(50)} 46 ${x(62)} 36 ${x(66)} 22M${x(28)} 62C${x(44)} 62 ${x(64)} 58 ${x(80)} 46M${x(54)} 58C${x(66)} 64 ${x(78)} 70 ${x(90)} 70M${x(39)} 32C${x(30)} 26 ${x(26)} 20 ${x(26)} 12`;
  };
  const lf = (x: number, y: number, r: number) => `<path d="M0 0C6-8 18-8 24 0C18 8 6 8 0 0Z" transform="translate(${x} ${y}) rotate(${r})"/>`;
  const leaves = [[60, 150, 200], [70, 170, 210], [196, 150, -20], [186, 170, -30], [92, 136, 230], [164, 136, -50], [80, 196, 190], [176, 196, -10], [108, 180, 260], [148, 180, -80], [128, 210, -90]].map(([x, y, r]) => lf(x!, y!, r!)).join('');
  return glowDup(id, `<path d="${antler(1)}${antler(-1)}" fill="none" stroke="${rim}" stroke-width="5" stroke-linecap="round"/>`)
    + `<path d="${antler(1)}${antler(-1)}" fill="none" stroke="${S.dark}" stroke-width="3" stroke-linecap="round"/>`
    + lit(id, 'b', body, rim, S.dark, 8)
    + `<g fill="${leaf}" fill-opacity=".8" stroke="${S.deep}" stroke-width="1">${leaves}</g>`
    + lit(id, 'h', head, rim, S.mid, 6)
    + `<path d="M128 116v30" stroke="${leaf}" stroke-width="2"/>`
    + eyes(id, 128, 96, 10, 4.5, 2.4, mix(rim, '#ffffff', 0.5), 18);
}

function natureWater(id: string, rim: string): string {
  const S = STEEL; const pale = mix(rim, '#bfe8ff', 0.5);
  const fig = sym([[128, 50], [146, 56], [152, 78], [146, 98], [140, 108], [170, 118], [182, 140], [180, 180], [196, 220], [128, 230]]);
  const hair = 'M108 58C86 66 80 96 92 118S74 150 56 146C74 162 98 140 104 120S100 84 112 62ZM148 58C170 66 176 96 164 118S182 150 200 146C182 162 158 140 152 120S156 84 144 62Z';
  const wave = (y: number, a: number, c: string, o: string) => {
    let d = `M0 ${y}`;
    for (let x = 0; x < 256; x += 64) d += `c16 ${-a} 32 ${-a} 32 0s16 ${a} 32 0`;
    return `<path d="${d}V256H0Z" fill="${c}" fill-opacity="${o}" stroke="${rim}" stroke-width="2"/>`;
  };
  const curl = (x: number, y: number) => `M${x} ${y}c4-18 26-24 36-10-10-4-18 0-18 10`;
  return lit(id, 'f', fig, rim, S.dark, 8)
    + `<path d="${hair}" fill="${mix(rim, S.deep, 0.5)}" stroke="${rim}" stroke-width="1.5"/>`
    + wave(196, 14, mix(rim, S.deep, 0.6), '.9')
    + wave(216, 12, mix(rim, S.deep, 0.45), '.9')
    + wave(236, 10, mix(rim, S.deep, 0.3), '.95')
    + glowDup(id, `<path d="${curl(40, 196)}${curl(168, 196)}${curl(100, 216)}" fill="none" stroke="${pale}" stroke-width="3" stroke-linecap="round"/>`)
    + `<path d="M118 140c6 6 14 6 20 0M114 160c8 6 20 6 28 0" fill="none" stroke="${pale}" stroke-width="2" stroke-opacity=".6" stroke-linecap="round"/>`
    + eyes(id, 128, 80, 9, 4.5, 2.4, pale, 4);
}

function natureSky(id: string, rim: string): string {
  const S = STEEL; const bolt = '#fff3b0';
  const cloud = `M48 150c-22 0-28-34-4-40-4-26 26-38 42-22 6-30 46-40 62-14 18-16 50-6 50 22 26 0 32 38 6 46-4 16-26 18-40 10-12 12-40 12-52 0-16 10-46 10-64-2Z`;
  const b = (pts: number[][]) => `<polyline points="${pts.map(([x, y]) => `${x},${y}`).join(' ')}"/>`;
  const bolts = b([[110, 160], [96, 192], [114, 192], [98, 236]]) + b([[160, 160], [168, 186], [154, 188], [166, 220]]) + b([[66, 156], [56, 178], [68, 180], [58, 200]]);
  return `<ellipse cx="128" cy="120" rx="96" ry="60" fill="${rim}" fill-opacity=".14" filter="url(#${id}-glow)"/>`
    + lit(id, 'c', cloud, rim, S.mid, 9)
    + `<path d="M64 132c10-10 24-10 34 0M124 98c12-12 30-10 38 4M160 140c12-6 24-4 32 6" fill="none" stroke="${mix(rim, '#ffffff', 0.3)}" stroke-width="3" stroke-linecap="round" stroke-opacity=".7"/>`
    + glowDup(id, `<g fill="none" stroke="${bolt}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round">${bolts}</g>`)
    + `<g fill="none" stroke="#ffffff" stroke-width="2" stroke-linejoin="round">${bolts}</g>`
    + eyes(id, 128, 122, 16, 8, 3, bolt, 16);
}

// ---------------------------------------------------------------------------------------- other spirits

function watcher(id: string, rim: string): string {
  const pale = mix(rim, '#ffffff', 0.5);
  const wisp = smooth([[128, 70], [166, 82], [180, 120], [168, 156], [148, 174], [150, 200], [168, 226, 1], [132, 206], [120, 182], [96, 168], [78, 132], [90, 88]]);
  return `<circle cx="128" cy="124" r="70" fill="${rim}" fill-opacity=".14" filter="url(#${id}-glow)"/>`
    + lit(id, 'w', wisp, rim, mix(rim, STEEL.deep, 0.7), 10)
    + `<path d="M98 112c8-18 24-26 44-24" fill="none" stroke="${pale}" stroke-width="3" stroke-linecap="round" stroke-opacity=".6"/>`
    + `<ellipse cx="128" cy="124" rx="30" ry="20" fill="${STEEL.void}" stroke="${pale}" stroke-width="2.5"/>`
    + glowDup(id, `<circle cx="128" cy="124" r="13" fill="${rim}"/>`)
    + `<circle cx="128" cy="124" r="5" fill="${STEEL.void}"/><circle cx="133" cy="119" r="3" fill="#ffffff"/>`
    + `<g fill="${pale}"><circle cx="64" cy="80" r="3"/><circle cx="196" cy="168" r="2.5"/><circle cx="190" cy="74" r="2"/></g>`;
}

/** A glowing humanoid (head, shoulders, tapering wisp tail). */
function figure(top: number, w: number, tail: number): P[] {
  return [[128, top], [128 + 0.2 * w, top + 6], [128 + 0.25 * w, top + 26], [128 + 0.18 * w, top + 46], [128 + 0.12 * w, top + 56],
    [128 + 0.55 * w, top + 70], [128 + 0.7 * w, top + 96], [128 + 0.45 * w, top + 130], [128 + 0.2 * w, tail - 30], [138, tail, 1], [128, tail - 10]];
}

function ally(id: string, rim: string): string {
  const pale = mix(rim, '#ffffff', 0.55);
  const body = sym(figure(56, 80, 214));
  let ticks = '';
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2, r1 = 96, r2 = i % 3 ? 90 : 84;
    ticks += `M${n(128 + Math.cos(a) * r1)} ${n(128 + Math.sin(a) * r1)}L${n(128 + Math.cos(a) * r2)} ${n(128 + Math.sin(a) * r2)}`;
  }
  const sq = poly([[128, 32], [224, 128], [128, 224], [32, 128]]);
  return `<circle cx="128" cy="128" r="90" fill="${rim}" fill-opacity=".1"/>`
    + glowDup(id, `<g fill="none" stroke="${rim}" stroke-width="3"><circle cx="128" cy="128" r="96"/><path d="${ticks}" stroke-width="2.5"/><path d="${sq}" stroke-width="1.6" stroke-opacity=".6"/><circle cx="128" cy="128" r="68" stroke-width="1.6" stroke-opacity=".45"/></g>`)
    + lit(id, 'b', body, rim, mix(rim, STEEL.deep, 0.62), 10)
    + `<path d="M110 120c10 8 26 8 36 0M128 128v40" fill="none" stroke="${pale}" stroke-width="2.5" stroke-linecap="round" stroke-opacity=".6"/>`
    + glowDup(id, `<circle cx="128" cy="140" r="7" fill="${pale}"/>`)
    + eyes(id, 128, 84, 8, 4, 2.2, '#ffffff', 4)
    + `<g fill="${pale}">${[0, 1, 2, 3].map((k) => { const a = k * 1.5708 - 0.785; return `<circle cx="${n(128 + Math.cos(a) * 96)}" cy="${n(128 + Math.sin(a) * 96)}" r="5"/>`; }).join('')}</g>`;
}

function free(id: string, rim: string): string {
  const pale = mix(rim, '#ffffff', 0.55); const gold = '#f2d68a';
  const body = sym([[128, 44], [144, 50], [148, 70], [142, 88], [136, 96], [164, 104], [178, 120], [184, 150], [192, 200], [206, 252], [128, 252]]);
  const crown = 'M106 52L102 22 116 38 128 14 140 38 154 22 150 52Z';
  const arc = (a0: number, a1: number, r: number, dx: number, dy: number) => {
    const p = (a: number) => `${n(128 + dx + Math.cos(a) * r)} ${n(128 + dy + Math.sin(a) * r)}`;
    return `M${p(a0)}A${r} ${r} 0 0 1 ${p(a1)}`;
  };
  const ring = arc(-2.9, -1.9, 90, -4, -4) + arc(-1.2, -0.3, 90, 4, -4) + arc(0.2, 1.1, 90, 6, 4) + arc(2.0, 2.7, 90, -6, 4)
    + arc(-1.75, -1.35, 94, 0, -6) + arc(1.35, 1.75, 92, 0, 6);
  return `<ellipse cx="128" cy="140" rx="70" ry="110" fill="${rim}" fill-opacity=".12" filter="url(#${id}-glow)"/>`
    + lit(id, 'b', body, rim, `url(#${id}-g)`, 10)
    + `<defs>${vgrad(`${id}-g`, [[0, mix(rim, STEEL.deep, 0.35)], [1, mix(rim, STEEL.void, 0.8)]])}</defs>`
    + `<path d="M128 100L112 252M128 100L144 252" stroke="${pale}" stroke-width="2" stroke-opacity=".45"/>`
    + glowDup(id, `<path d="${crown}" fill="${gold}"/>`)
    + glowDup(id, `<circle cx="128" cy="124" r="6" fill="${pale}"/>`)
    + glowDup(id, `<path d="${ring}" fill="none" stroke="${gold}" stroke-width="4" stroke-linecap="round"/>`)
    + `<g fill="${gold}"><path d="M40 70l8-4-2 9ZM218 76l-6-6 9-1ZM30 168l9 2-6 6ZM222 180l-4 8-4-7Z"/></g>`
    + eyes(id, 128, 70, 8, 4, 2.2, '#ffffff', 10);
}

function spirit(id: string, rim: string): string {
  const pale = mix(rim, '#ffffff', 0.55);
  const wisp = smooth([[128, 36, 1], [150, 70], [174, 104], [182, 142], [168, 176], [140, 194], [124, 216], [138, 238, 1], [104, 222], [86, 186], [76, 146], [88, 104], [112, 84], [118, 62]]);
  const inner = smooth([[130, 80, 1], [150, 112], [160, 144], [146, 172], [122, 178], [104, 156], [108, 124], [124, 106]]);
  return `<circle cx="128" cy="140" r="76" fill="${rim}" fill-opacity=".16" filter="url(#${id}-glow)"/>`
    + lit(id, 'w', wisp, rim, mix(rim, STEEL.deep, 0.6), 12)
    + `<path d="${inner}" fill="${rim}" fill-opacity=".6"/>`
    + glowDup(id, `<circle cx="130" cy="148" r="16" fill="${pale}"/>`)
    + `<circle cx="130" cy="148" r="8" fill="#ffffff"/>`
    + `<path d="M96 196c-16-20-20-50-6-76M166 104c14 18 18 44 6 66" fill="none" stroke="${pale}" stroke-width="3" stroke-linecap="round" stroke-opacity=".6"/>`
    + `<g fill="${pale}"><circle cx="62" cy="96" r="4"/><circle cx="196" cy="190" r="3.5"/><circle cx="200" cy="80" r="2.5"/><circle cx="54" cy="188" r="2.5"/></g>`;
}

function toxic(id: string, rim: string): string {
  const S = STEEL; const ooze = mix(rim, S.deep, 0.45);
  const blob = smooth([[114, 48], [150, 50], [170, 74], [166, 98], [196, 112], [216, 138], [202, 150], [198, 196], [214, 236], [200, 252], [56, 252], [40, 230], [56, 196], [52, 150], [38, 136], [62, 112], [90, 100], [84, 70]]);
  const drip = (x: number, y: number, l: number, w: number) => `M${x - w} ${y}Q${n(x - w * 0.2)} ${n(y + l * 0.6)} ${n(x - w * 0.8)} ${y + l}a${n(w * 0.8)} ${n(w * 0.8)} 0 1 0 ${n(w * 1.6)} 0Q${n(x + w * 0.2)} ${n(y + l * 0.6)} ${x + w} ${y}Z`;
  const drips = drip(56, 136, 46, 7) + drip(74, 124, 24, 5) + drip(206, 140, 52, 7) + drip(186, 124, 28, 5) + drip(128, 116, 30, 5) + drip(160, 100, 16, 4) + drip(94, 104, 18, 4);
  return lit(id, 'b', blob, rim, `url(#${id}-t)`, 9)
    + `<defs>${vgrad(`${id}-t`, [[0, ooze], [0.5, S.dark], [1, S.void]])}</defs>`
    + glowDup(id, `<path d="${drips}" fill="${rim}" fill-opacity=".9"/>`)
    + `<g fill="none" stroke="${rim}" stroke-width="2" stroke-opacity=".8"><circle cx="96" cy="200" r="8"/><circle cx="156" cy="150" r="6"/><circle cx="168" cy="216" r="10"/><circle cx="112" cy="166" r="4"/></g><path d="M40 252c20-14 50-10 70-2s60 8 80-2 30-4 40 4Z" fill="${ooze}" stroke="${rim}" stroke-width="2"/>`
    + ``
    + glowDup(id, `<circle cx="108" cy="80" r="9" fill="${rim}"/><circle cx="146" cy="88" r="5" fill="${rim}"/>`)
    + `<circle cx="108" cy="80" r="4" fill="${S.void}"/><circle cx="146" cy="88" r="2.2" fill="${S.void}"/>`
    + `<path d="M104 116c10 6 24 8 40 0l-6 10-6-6-6 8-6-8-6 6Z" fill="${S.void}" stroke="${rim}" stroke-width="1.5"/>`;
}

function insect(id: string, rim: string): string {
  const S = STEEL;
  const head = 'M128 112L96 70C94 56 104 46 128 50 152 46 162 56 160 70Z';
  const thorax = sym([[128, 112], [146, 118], [176, 128], [190, 146], [170, 160], [154, 184], [160, 250], [128, 250]]);
  const arm = (s: number) => {
    const x = (v: number) => n(128 + s * v);
    return `M${x(50)} 134L${x(84)} 96 ${x(92)} 40 ${x(98)} 44 ${x(94)} 98 ${x(60)} 142Z M${x(92)} 40L${x(64)} 72 ${x(70)} 76 ${x(96)} 50Z`;
  };
  const wing = (s: number) => `M${n(128 + s * 30)} 140C${n(128 + s * 90)} 120 ${n(128 + s * 110)} 170 ${n(128 + s * 100)} 236C${n(128 + s * 70)} 220 ${n(128 + s * 40)} 190 ${n(128 + s * 30)} 160Z`;
  return glowDup(id, `<path d="${wing(1)}${wing(-1)}" fill="${rim}" fill-opacity=".18" stroke="${rim}" stroke-width="1.5"/>`)
    + `<path d="M128 150C166 156 190 196 200 230M128 150C90 156 66 196 56 230" fill="none" stroke="${rim}" stroke-opacity=".35" stroke-width="1.5"/>`
    + lit(id, 't', thorax, rim, S.dark, 7)
    + `<path d="M108 168h40M106 190h44M108 212h40M110 234h36" stroke="${S.void}" stroke-width="3"/>`
    + lit(id, 'a', arm(1) + arm(-1), rim, S.mid, 6)
    + glowDup(id, `<path d="M112 52C104 32 92 22 76 18M144 52C152 32 164 22 180 18" fill="none" stroke="${rim}" stroke-width="2.5" stroke-linecap="round"/>`)
    + lit(id, 'h', head, rim, S.base, 6)
    + glowDup(id, `<path d="M100 64C104 56 116 58 122 72 116 80 104 78 100 64ZM156 64C152 56 140 58 134 72 140 80 152 78 156 64Z" fill="${rim}"/>`)
    + `<path d="M122 102l6 10 6-10" fill="none" stroke="${S.void}" stroke-width="3"/>`;
}

// ---------------------------------------------------------------------------------------------- the set

/**
 * [file name, title, the subject's own colour, drawing]. Every spirit's rim is the Magic colour (v0.84.1); the
 * elementals, toxic and insect spirits keep their own colour for the subject, so the picture tells the type.
 */
const SET: Array<[string, string, string, (id: string, colour: string) => string]> = [
  ['elemental-fire', 'Fire elemental', '#e8724a', fire],
  ['elemental-water', 'Water elemental', '#4aa8e8', water],
  ['elemental-air', 'Air elemental', '#cfd8e6', air],
  ['elemental-earth', 'Earth elemental', '#b08a5a', earth],
  ['nature-man', 'Spirit of man', RIM.magic, natureMan],
  ['nature-land', 'Spirit of the land', RIM.magic, natureLand],
  ['nature-water', 'Spirit of the waters', RIM.magic, natureWater],
  ['nature-sky', 'Spirit of the sky', RIM.magic, natureSky],
  ['watcher', 'Watcher', RIM.magic, watcher],
  ['ally', 'Ally spirit', RIM.magic, ally],
  ['free', 'Free spirit', RIM.magic, free],
  ['spirit', 'Spirit', RIM.magic, spirit],
  ['toxic', 'Toxic spirit', '#9bc53d', toxic],
  ['insect', 'Insect spirit', '#c7d36f', insect],
];

export function files(): ArtFile[] {
  return SET.map(([name, title, colour, draw]) => {
    const file = `spirits/${name}.svg`;
    const id = file.replace(/\.svg$/, '').replace(/[^a-zA-Z0-9]/g, '-');
    return { file, svg: token({ id, title: `${title} (default token)`, rim: RIM.magic, bg: 'astral', body: draw(id, colour) }) };
  });
}
