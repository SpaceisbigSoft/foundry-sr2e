/**
 * Default token art: vehicles and drones (top-down, nose toward the bottom of the image, since Foundry's
 * rotation 0 faces south). Original, generic 2050s designs drawn for this system; no real models, no marks.
 */
import { token, STEEL, RIM, mix, n, type ArtFile } from './frame.ts';

const RG = RIM.rigging;
const GLASS = '#121820';

/** A point; a third element `true` makes it a sharp corner (otherwise the corner is rounded). */
type P = [number, number, boolean?];

/** Right half (x ≥ 128, top centre to bottom centre) mirrored into the whole outline. */
function sym(half: P[]): P[] {
  const back: P[] = [];
  for (let i = half.length - 1; i >= 0; i--) {
    const p = half[i]!;
    if (Math.abs(p[0] - 128) < 0.01) continue;
    back.push([256 - p[0], p[1], p[2]]);
  }
  return [...half, ...back];
}

/** A closed outline, its corners rounded through the edge midpoints (sharp ones kept). */
function outline(pts: P[]): string {
  const m = (a: P, b: P) => `${n((a[0] + b[0]) / 2)} ${n((a[1] + b[1]) / 2)}`;
  const len = pts.length;
  const at = (i: number) => pts[(i + len) % len]!;
  let d = `M${m(at(-1), at(0))}`;
  for (let i = 0; i < len; i++) {
    const p = at(i);
    d += p[2] ? `L${n(p[0])} ${n(p[1])}L${m(p, at(i + 1))}` : `Q${n(p[0])} ${n(p[1])} ${m(p, at(i + 1))}`;
  }
  return d + 'Z';
}

const S = (half: P[]) => outline(sym(half));
const path = (d: string, fill: string, extra = '') => `<path d="${d}" fill="${fill}"${extra}/>`;

/** A silhouette lit from the upper left by the rim light (an offset rim-coloured copy behind it), with a soft halo. */
function lit(d: string, fill: string, halo = true): string {
  return (halo ? path(d, RG, ' opacity=".3" filter="url(#ID-glow)"') : '')
    + path(d, RG, ' transform="translate(-2.5 -2.5)"')
    + path(d, fill);
}

/** A glowing detail: the shape blurred, then crisp on top. */
const glow = (el: string) => el.replace('/>', ' filter="url(#ID-glow)"/>') + el;
const circ = (cx: number, cy: number, r: number, fill: string, extra = '') => `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" fill="${fill}"${extra}/>`;
const rect = (x: number, y: number, w: number, h: number, fill: string, rx = 0, extra = '') =>
  `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}"${rx ? ` rx="${n(rx)}"` : ''} fill="${fill}"${extra}/>`;
const line = (d: string, color: string, w: number, extra = '', cap = 'round') => `<path d="${d}" fill="none" stroke="${color}" stroke-width="${n(w)}" stroke-linecap="${cap}"${extra}/>`;
/** Mirror a right-hand path about the centre line too. */
const both = (el: string) => el + `<g transform="matrix(-1 0 0 1 256 0)">${el}</g>`;

// ---------------------------------------------------------------- ground vehicles

function car(): string {
  const body = S([[128, 38], [156, 39], [167, 46], [170, 62], [171, 112], [170, 182], [167, 206], [158, 216], [144, 220], [128, 221]]);
  return both(rect(165, 60, 11, 30, STEEL.void, 3) + rect(165, 166, 11, 30, STEEL.void, 3))
    + lit(body, STEEL.base)
    + path(S([[128, 50], [152, 52], [160, 62], [160, 92], [128, 90]]), STEEL.mid)
    + path(S([[128, 64], [150, 66], [156, 86], [128, 84]]), GLASS)
    + path(S([[128, 92], [152, 92], [156, 98], [156, 134], [152, 140], [128, 140]]), STEEL.light)
    + path(S([[128, 98], [146, 98], [148, 102], [148, 128], [128, 128]]), mix(STEEL.light, STEEL.pale, 0.35))
    + path(S([[128, 140], [154, 142], [161, 178], [128, 176]]), GLASS)
    + line('M136 146L154 147', RG, 1.5, ' opacity=".6"')
    + line('M140 186L154 206M116 186L102 206', STEEL.mid, 1.5)
    + both(path('M165 136l9 2v7l-9 -1z', STEEL.light))
    + both(glow(path('M146 213L162 205L161 210L150 216Z', STEEL.ink)) + rect(150, 41, 14, 4, RG, 2))
    + glow(rect(112, 41, 32, 2, RG));
}

function bike(): string {
  return '<g transform="translate(-12.8 -12.8) scale(1.1)">' + rect(117, 24, 22, 60, STEEL.void, 9) + rect(118, 174, 20, 54, STEEL.void, 9)
    + lit(S([[128, 60], [140, 62], [146, 90], [154, 122], [158, 160], [150, 194], [138, 212], [128, 214]]), STEEL.base)
    + path(S([[128, 150], [146, 154], [144, 182], [128, 192]]), STEEL.light)
    + path(S([[128, 172], [140, 176], [136, 196], [128, 202]]), GLASS)
    + lit(S([[128, 158], [174, 154], [178, 160], [174, 166], [128, 168]]), STEEL.mid, false)
    + both(rect(168, 152, 10, 6, STEEL.light, 3))
    + both(line('M148 122L170 156', STEEL.dark, 7))
    + lit(S([[128, 76], [146, 80], [156, 108], [152, 132], [128, 136]]), STEEL.dark, false)
    + path(S([[128, 86], [140, 90], [146, 110], [128, 116]]), STEEL.mid)
    + lit(`M115 140a13 13 0 1 0 26 0a13 13 0 1 0 -26 0Z`, STEEL.mid, false)
    + path('M118 144Q128 156 138 144Q128 150 118 144Z', GLASS)
    + glow(path(S([[128, 206], [136, 203], [134, 212], [128, 215]]), STEEL.ink))
    + glow(rect(121, 58, 14, 3, RG, 1.5))
    + line('M128 20V40', RG, 3, ' opacity=".35" filter="url(#ID-glow)"') + '</g>';
}

function truck(): string {
  const box = outline([[78, 40], [178, 40], [178, 160], [78, 160]].map((p) => [p[0]!, p[1]!, true] as P));
  const cab = S([[128, 164], [168, 164], [174, 170], [175, 206], [170, 218], [156, 223], [128, 224]]);
  let ribs = '';
  for (let y = 54; y < 160; y += 14) ribs += `M84 ${y}H172`;
  return both(rect(172, 52, 11, 26, STEEL.void, 3) + rect(172, 120, 11, 26, STEEL.void, 3) + rect(170, 176, 10, 26, STEEL.void, 3))
    + lit(cab, STEEL.base)
    + lit(box, STEEL.mid)
    + path(outline([[84, 46, true], [172, 46, true], [172, 154, true], [84, 154, true]]), STEEL.base)
    + line(ribs, STEEL.mid, 3, '', 'butt')
    + line('M84 47H172', STEEL.light, 1.5)
    + path(S([[128, 170], [164, 170], [168, 176], [168, 188], [128, 188]]), STEEL.light)
    + path(S([[128, 192], [164, 192], [168, 210], [128, 212]]), GLASS)
    + line('M140 196L162 197', RG, 1.5, ' opacity=".6"')
    + both(path('M174 186l8 1v8l-8 -1z', STEEL.light))
    + both(glow(path('M150 219L168 213L167 218L156 222Z', STEEL.ink)) + rect(160, 156, 14, 3, RG, 1.5))
    + glow(rect(104, 163, 48, 2, RG));
}

function other(): string {
  const hull = S([[128, 32], [158, 32, true], [176, 48, true], [178, 188, true], [166, 212, true], [146, 222, true], [128, 222]]);
  return both(rect(172, 54, 16, 32, STEEL.void, 3) + rect(172, 102, 16, 32, STEEL.void, 3) + rect(172, 150, 16, 32, STEEL.void, 3)
    + line('M176 58v24M182 58v24M176 106v24M182 106v24M176 154v24M182 154v24', STEEL.dark, 2))
    + lit(hull, STEEL.mid)
    + path(S([[128, 42], [154, 42, true], [166, 54, true], [168, 184, true], [158, 202, true], [128, 206]]), STEEL.base)
    + line('M106 50H150M106 58H150M106 66H150', STEEL.dark, 3)
    + path(S([[128, 150], [160, 152, true], [160, 176, true], [150, 190, true], [128, 192]]), STEEL.light)
    + rect(100, 182, 56, 6, GLASS, 1)
    + glow(rect(106, 183.5, 44, 2.5, RG, 1.2))
    + circ(128, 108, 26, STEEL.dark) + circ(128, 108, 22, STEEL.light) + circ(128, 108, 15, STEEL.base)
    + rect(124, 116, 8, 30, STEEL.dark, 2) + circ(128, 108, 5, RG, ' filter="url(#ID-glow)"')
    + both(path('M146 222L170 214L172 220L148 228Z', STEEL.dark) + glow(rect(158, 207, 8, 4, STEEL.ink, 2)))
    + both(rect(148, 34, 12, 3, RG, 1.5))
    + both(path('M176 48L178 188', 'none', ` stroke="${RG}" stroke-width="1.5" opacity=".5"`));
}

// ---------------------------------------------------------------- water

function hovercraft(): string {
  const skirt = outline([[128, 46], [190, 46], [196, 52], [196, 208], [190, 214], [66, 214], [60, 208], [60, 52], [66, 46]]
    .map((p) => p as P));
  const fan = (cx: number) => circ(cx, 84, 25, STEEL.dark) + circ(cx, 84, 22, STEEL.void)
    + circ(cx, 84, 21, 'none', ` stroke="${RG}" stroke-width="1.5" opacity=".7"`)
    + line(`M${cx - 18} 84H${cx + 18}M${cx} 66V102M${cx - 12} 72L${cx + 12} 96M${cx + 12} 72L${cx - 12} 96`, STEEL.mid, 3)
    + circ(cx, 84, 6, STEEL.light) + glow(circ(cx, 84, 3, RG));
  return lit(skirt, STEEL.dark)
    + path(outline([[128, 56], [176, 56], [184, 64], [184, 196], [176, 204], [80, 204], [72, 196], [72, 64], [80, 56]]), STEEL.base)
    + line('M66 54V206M190 54V206', STEEL.void, 2, ' opacity=".6"')
    + fan(100) + fan(156)
    + both(rect(152, 112, 8, 16, STEEL.mid, 2))
    + lit(S([[128, 132], [156, 132], [164, 140], [164, 186], [156, 196], [128, 198]]), STEEL.light, false)
    + path(S([[128, 140], [152, 140], [156, 146], [156, 160], [128, 160]]), STEEL.pale)
    + path(S([[128, 168], [158, 168], [158, 186], [152, 192], [128, 192]]), GLASS)
    + line('M134 174H152', RG, 1.5, ' opacity=".6"')
    + both(glow(rect(170, 204, 14, 4, STEEL.ink, 2)) + rect(170, 48, 12, 3, RG, 1.5));
}

function boat(): string {
  const hull = S([[128, 48], [156, 48], [162, 56], [164, 104], [160, 146], [150, 176], [138, 200], [128, 218, true]]);
  return line('M120 40L96 16M136 40L160 16', RG, 3, ' opacity=".35"')
    + line('M124 40L112 20M132 40L144 20', STEEL.pale, 2, ' opacity=".35"')
    + lit(hull, STEEL.base)
    + path(S([[128, 54], [152, 54], [156, 62], [157, 104], [153, 140], [128, 142]]), STEEL.mid)
    + both(rect(134, 92, 14, 22, STEEL.light, 4))
    + rect(110, 66, 36, 14, STEEL.dark, 4)
    + path(S([[128, 132], [150, 130], [155, 144], [128, 148]]), GLASS)
    + line('M134 138L150 136', RG, 1.5, ' opacity=".6"')
    + path(S([[128, 148], [154, 146], [148, 172], [138, 192], [128, 208, true]]), STEEL.light)
    + line('M128 152V204', STEEL.pale, 2)
    + rect(118, 34, 20, 18, STEEL.dark, 4) + rect(121, 37, 14, 6, STEEL.mid, 2)
    + glow(rect(122, 31, 12, 3, RG, 1.5))
    + both(glow(circ(144, 186, 2.5, STEEL.ink)));
}

function ship(): string {
  const hull = S([[128, 26], [150, 26], [158, 34], [160, 60], [160, 168], [154, 194], [142, 216], [128, 236, true]]);
  const cols = [102, 129];
  let boxes = '';
  const tones = [STEEL.light, STEEL.base, STEEL.pale, STEEL.mid];
  let k = 0;
  for (let y = 88; y < 176; y += 22) {
    for (const x of cols) { boxes += rect(x, y, 25, 19, tones[k % 4]!, 1.5); k++; }
  }
  return line('M118 22L108 4M138 22L148 4', RG, 2.5, ' opacity=".3"')
    + lit(hull, STEEL.dark)
    + path(S([[128, 32], [148, 32], [154, 38], [155, 62], [155, 168], [149, 192], [139, 210], [128, 226, true]]), STEEL.mid)
    + boxes
    + line('M104 112H152M104 134H152M104 156H152', STEEL.dark, 1, ' opacity=".5"')
    + lit(S([[128, 36], [150, 36], [152, 40], [152, 78], [128, 78]]), STEEL.light, false)
    + path(S([[128, 42], [144, 42], [146, 46], [146, 66], [128, 66]]), STEEL.pale)
    + rect(120, 46, 16, 12, STEEL.dark, 3) + rect(123, 48, 10, 3, RG, 1.5, ' opacity=".7"')
    + rect(100, 74, 56, 5, GLASS) + glow(rect(104, 75, 48, 2.5, RG, 1))
    + path(S([[128, 186], [146, 186], [142, 204], [128, 218, true]]), STEEL.base)
    + both(circ(136, 194, 3.5, STEEL.dark))
    + line('M128 180V210', STEEL.light, 1.5)
    + glow(circ(128, 226, 2.5, STEEL.ink)) + both(glow(circ(156, 40, 2.5, RG)));
}

// ---------------------------------------------------------------- air

function rotor(): string {
  const blade = (deg: number) => `<path d="M128 136L131 134L224 128L226 134L131 140Z" fill="${STEEL.light}" transform="rotate(${deg} 128 136)"/>`
    + `<path d="M131 134L224 128L224 130L131 135Z" fill="${RG}" opacity=".8" transform="rotate(${deg} 128 136)"/>`;
  return circ(128, 136, 96, RG, ' opacity=".05"') + circ(128, 136, 96, 'none', ` stroke="${RG}" stroke-width="1.5" opacity=".3"`)
    + both(rect(146, 112, 4, 70, STEEL.dark, 2) + line('M146 120h-8M146 172h-8', STEEL.dark, 2.5))
    + lit('M123 40H133L134 104H122Z', STEEL.base)
    + lit(outline([[112, 58], [144, 58], [144, 64], [112, 64]]), STEEL.base, false)
    + lit(outline([[133, 30], [137, 30], [137, 54], [133, 54]]), STEEL.light, false)
    + lit(S([[128, 92], [142, 96], [151, 118], [153, 150], [147, 176], [136, 192], [128, 195]]), STEEL.base)
    + path(S([[128, 102], [140, 106], [144, 124], [128, 128]]), STEEL.mid)
    + path(S([[128, 156], [144, 160], [142, 178], [134, 188], [128, 190]]), GLASS)
    + line('M134 164L140 176', RG, 1.5, ' opacity=".6"')
    + blade(-62) + blade(28) + blade(118) + blade(208)
    + circ(128, 136, 9, STEEL.dark) + circ(128, 136, 5, STEEL.pale)
    + glow(circ(128, 194, 2.5, STEEL.ink)) + glow(circ(128, 40, 2.5, RG));
}

function fixedWing(): string {
  const wings = S([[128, 112], [140, 114, true], [224, 90, true], [227, 104, true], [140, 162, true], [128, 162]]);
  const tail = S([[128, 40], [138, 42, true], [174, 32, true], [175, 42, true], [138, 66, true], [128, 66]]);
  return lit(wings, STEEL.mid) + lit(tail, STEEL.mid, false)
    + both(path('M150 125L220 101L221 106L150 133Z', STEEL.base))
    + both(rect(162, 114, 11, 36, STEEL.dark, 5) + glow(rect(163.5, 110, 8, 4, RG, 2)))
    + lit(S([[128, 26], [134, 28], [138, 48], [140, 168], [136, 198], [128, 224, true]]), STEEL.base)
    + line('M128 34V150', STEEL.light, 2)
    + path(S([[128, 172], [134, 180], [134, 198], [128, 208]]), GLASS)
    + line('M131 182V196', RG, 1.5, ' opacity=".6"')
    + both(glow(circ(222, 97, 2.5, RG)))
    + glow(circ(128, 24, 2.5, RG));
}

function vectorThrust(): string {
  const duct = (cx: number, cy: number, r: number) => circ(cx - 2, cy - 2, r, RG) + circ(cx, cy, r, STEEL.light)
    + circ(cx, cy, r - 5, STEEL.void)
    + line(`M${n(cx - r * 0.6)} ${n(cy - r * 0.6)}L${n(cx + r * 0.6)} ${n(cy + r * 0.6)}M${n(cx + r * 0.6)} ${n(cy - r * 0.6)}L${n(cx - r * 0.6)} ${n(cy + r * 0.6)}`, STEEL.mid, 3)
    + circ(cx, cy, r * 0.25, STEEL.base) + (r > 20 ? glow(circ(cx, cy, 4, RG)) : circ(cx, cy, 2.5, RG));
  return lit(S([[128, 78], [176, 78, true], [178, 104, true], [140, 116, true], [128, 116]]), STEEL.mid)
    + path(S([[128, 160], [158, 164, true], [158, 176, true], [128, 182]]), STEEL.mid)
    + lit(S([[128, 38], [140, 42], [146, 66], [148, 160], [142, 196], [128, 214, true]]), STEEL.base)
    + line('M128 50V150', STEEL.light, 2)
    + both(rect(132, 54, 10, 22, STEEL.dark, 3))
    + path(S([[128, 168], [138, 174], [138, 196], [128, 206]]), GLASS)
    + duct(184, 90, 30) + duct(72, 90, 30) + duct(166, 172, 18) + duct(90, 172, 18)
    + glow(rect(122, 36, 12, 4, RG, 2));
}

function lta(): string {
  const env = S([[128, 26], [150, 30], [168, 50], [180, 90], [182, 128], [178, 170], [164, 206], [146, 226], [128, 230]]);
  return both(lit('M160 54L190 42L194 48L192 74L170 94Z', STEEL.mid, false))
    + lit(env, STEEL.base)
    + path(S([[128, 34], [144, 38], [156, 58], [164, 96], [165, 128], [162, 166], [152, 198], [140, 216], [128, 220]]), STEEL.light)
    + path(S([[128, 44], [136, 48], [142, 70], [145, 128], [142, 186], [136, 208], [128, 212]]), mix(STEEL.light, STEEL.pale, 0.4))
    + line('M128 22V70', STEEL.mid, 6) + line('M126 24V68', RG, 1.5)
    + both(line('M171 104Q174 128 171 152', RG, 3, ' filter="url(#ID-glow)"') + line('M171 104Q174 128 171 152', RG, 2))
    + glow(circ(128, 226, 3, STEEL.ink)) + both(glow(circ(192, 46, 2.5, RG)));
}

// ---------------------------------------------------------------- drones

const eye = (cx: number, cy: number, r: number) => circ(cx, cy, r + 3, STEEL.void)
  + circ(cx, cy, r + 2, RG, ' filter="url(#ID-glow)"') + circ(cx, cy, r, RG) + circ(cx - r * 0.3, cy - r * 0.3, r * 0.35, STEEL.ink);

function droneGround(): string {
  let treads = '';
  for (let y = 62; y < 198; y += 8) treads += `M150 ${y}H176`;
  return both(lit(outline([[148, 56], [178, 56], [178, 200], [148, 200]]), STEEL.mid, false)
    + line(treads, STEEL.dark, 3, '', 'butt') + rect(156, 64, 14, 128, STEEL.base, 6))
    + lit(S([[128, 66], [150, 66, true], [152, 180, true], [140, 194, true], [128, 194]]), STEEL.base)
    + path(S([[128, 74], [142, 74, true], [142, 124, true], [128, 124]]), STEEL.mid)
    + line('M118 84H138M118 93H138M118 102H138M118 111H138', STEEL.dark, 3)
    + line('M140 72L156 46', STEEL.light, 2) + glow(circ(156, 46, 3, RG))
    + circ(128, 158, 24, STEEL.dark) + lit('M108 158a20 20 0 1 0 40 0a20 20 0 1 0 -40 0Z', STEEL.light, false)
    + rect(118, 166, 20, 18, STEEL.dark, 4)
    + eye(128, 178, 7);
}

function droneRotor(): string {
  const pos: Array<[number, number]> = [[78, 78], [178, 78], [78, 178], [178, 178]];
  let out = line('M78 78L178 178M178 78L78 178', RG, 14, ' opacity=".3" filter="url(#ID-glow)"')
    + line('M78 78L178 178M178 78L78 178', STEEL.base, 10);
  for (const [x, y] of pos) {
    out += circ(x, y, 30, RG, ' opacity=".08"') + circ(x, y, 30, 'none', ` stroke="${RG}" stroke-width="1.5" opacity=".45"`)
      + line(`M${x - 26} ${y + 8}L${x + 26} ${y - 8}`, STEEL.pale, 3, ' opacity=".8"')
      + circ(x - 1.5, y - 1.5, 8, RG) + circ(x, y, 8, STEEL.light) + circ(x, y, 3, STEEL.dark);
  }
  return out + lit(outline([[128, 98], [154, 108], [158, 128], [152, 150], [128, 160], [104, 150], [98, 128], [102, 108]]), STEEL.base)
    + path(outline([[128, 106], [146, 114], [148, 128], [128, 132], [108, 128], [110, 114]]), STEEL.light)
    + eye(128, 146, 7);
}

function droneWing(): string {
  return circ(128, 52, 16, RG, ' opacity=".08"') + line('M110 52H146', STEEL.pale, 3, ' opacity=".8"')
    + lit(S([[128, 108], [134, 108, true], [214, 104, true], [218, 112, true], [214, 122, true], [134, 132, true], [128, 132]]), STEEL.mid)
    + both(path('M210 105L216 112L210 121Z', RG, ' opacity=".9"'))
    + lit(S([[128, 66], [134, 66, true], [160, 46, true], [164, 52, true], [136, 80, true], [128, 80]]), STEEL.mid, false)
    + lit(S([[128, 56], [134, 60], [137, 90], [138, 160], [134, 190], [128, 204]]), STEEL.base)
    + rect(124, 54, 8, 6, STEEL.dark, 2) + line('M128 70V150', STEEL.light, 2)
    + eye(128, 188, 6);
}

function droneWater(): string {
  return line('M96 214Q128 196 160 214M84 196Q128 168 172 196', RG, 2, ' opacity=".25"')
    + both(lit('M140 62L166 52L166 62L144 82Z', STEEL.mid, false))
    + lit(S([[128, 50], [140, 54], [148, 80], [150, 150], [144, 182], [128, 198]]), STEEL.base)
    + lit(outline([[110, 40, true], [146, 40, true], [146, 52, true], [110, 52, true]]), STEEL.dark, false)
    + line('M114 46H142', RG, 1.5, ' opacity=".5"')
    + path(S([[128, 62], [138, 66], [142, 86], [143, 150], [138, 172], [128, 178]]), STEEL.light)
    + rect(121, 104, 14, 30, STEEL.mid, 7) + line('M128 110V128', STEEL.dark, 3)
    + both(glow(circ(150, 128, 2, RG)))
    + eye(128, 180, 7);
}

// ---------------------------------------------------------------- files

const LIST: Array<[string, string, () => string, boolean]> = [
  ['car', 'Car', car, false], ['bike', 'Motorcycle', bike, false], ['truck', 'Truck', truck, false],
  ['hovercraft', 'Hovercraft', hovercraft, false], ['boat', 'Boat', boat, false], ['ship', 'Ship', ship, false],
  ['rotor', 'Rotorcraft', rotor, false], ['fixedWing', 'Fixed-wing aircraft', fixedWing, false],
  ['vectorThrust', 'Vectored-thrust aircraft', vectorThrust, false], ['lta', 'Airship', lta, false],
  ['other', 'Vehicle', other, false],
  ['drone-ground', 'Ground drone', droneGround, true], ['drone-rotor', 'Rotor drone', droneRotor, true],
  ['drone-wing', 'Wing drone', droneWing, true], ['drone-water', 'Water drone', droneWater, true],
];

export function files(): ArtFile[] {
  return LIST.map(([name, title, draw, drone]) => {
    const file = `vehicles/${name}.svg`;
    const id = file.replace(/\.svg$/, '').replace(/[^A-Za-z0-9]/g, '-');
    return {
      file,
      svg: token({ id, title: `${title} (default token)`, rim: RG, bg: drone ? 'steel' : 'night', body: draw().replace(/#ID-/g, `#${id}-`) }),
    };
  });
}
