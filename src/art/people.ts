/**
 * v0.83.0: the people portraits (metatype × figure), the system's own art (AI-drawn). A front-facing bust in the
 * house style: a duotone figure lit from behind by the rim colour. Metatypes differ in build and features
 * (an elf's long ears, a dwarf's breadth and beard or braids, an ork's tusks, a troll's horns and bulk); the two
 * figures differ in hair, jaw and shoulders. Every portrait also comes with each archetype badge (badges.ts).
 */
import { token, STEEL, RIM, mix, n } from './frame.ts';
import type { ArtFile } from './frame.ts';
import { BADGES, BADGE_IDS } from './badges.ts';
import type { BadgeId } from './badges.ts';

export const METAS = ['human', 'elf', 'dwarf', 'ork', 'troll'] as const;
export type Meta = typeof METAS[number];
export const FIGURES = ['masc', 'fem'] as const;
export type Figure = typeof FIGURES[number];

const SKIN_LIGHT = '#8a939e';
const SKIN_DARK = '#4a525d';
const HAIR = '#16191e';
const HAIR_HI = '#2e343c';

/** The head's shape: centre x, top, temple width, brow height, jaw width and height, chin width and height. */
interface Head { top: number; w: number; brow: number; jw: number; jaw: number; cw: number; chin: number }

const HEADS: Record<Meta, Record<Figure, Head>> = {
  human: { masc: { top: 52, w: 33, brow: 92, jw: 29, jaw: 128, cw: 12, chin: 146 }, fem: { top: 54, w: 31, brow: 93, jw: 25, jaw: 126, cw: 9, chin: 143 } },
  elf: { masc: { top: 50, w: 29, brow: 92, jw: 24, jaw: 130, cw: 9, chin: 149 }, fem: { top: 52, w: 28, brow: 93, jw: 21, jaw: 128, cw: 7, chin: 146 } },
  dwarf: { masc: { top: 62, w: 37, brow: 98, jw: 35, jaw: 128, cw: 16, chin: 142 }, fem: { top: 62, w: 35, brow: 99, jw: 31, jaw: 127, cw: 13, chin: 140 } },
  ork: { masc: { top: 54, w: 36, brow: 94, jw: 37, jaw: 130, cw: 20, chin: 150 }, fem: { top: 55, w: 33, brow: 95, jw: 31, jaw: 128, cw: 14, chin: 146 } },
  troll: { masc: { top: 60, w: 40, brow: 100, jw: 42, jaw: 136, cw: 24, chin: 156 }, fem: { top: 61, w: 37, brow: 101, jw: 36, jaw: 133, cw: 18, chin: 151 } },
};

const CX = 128;

/** The head outline as a closed path (the right half traced down, the left half traced back up). */
function headPath(h: Head): string {
  const { top, w, brow, jw, jaw, cw, chin } = h;
  const R = (dx: number) => n(CX + dx);
  const L = (dx: number) => n(CX - dx);
  return `M${n(CX)} ${n(top)}`
    + `C${R(w * 0.62)} ${n(top)} ${R(w)} ${n(top + (brow - top) * 0.42)} ${R(w)} ${n(brow)}`
    + `C${R(w)} ${n(brow + (jaw - brow) * 0.55)} ${R(jw + (w - jw) * 0.25)} ${n(jaw - 6)} ${R(jw)} ${n(jaw)}`
    + `C${R(jw * 0.72)} ${n(jaw + (chin - jaw) * 0.75)} ${R(cw)} ${n(chin)} ${n(CX)} ${n(chin)}`
    + `C${L(cw)} ${n(chin)} ${L(jw * 0.72)} ${n(jaw + (chin - jaw) * 0.75)} ${L(jw)} ${n(jaw)}`
    + `C${L(jw + (w - jw) * 0.25)} ${n(jaw - 6)} ${L(w)} ${n(brow + (jaw - brow) * 0.55)} ${L(w)} ${n(brow)}`
    + `C${L(w)} ${n(top + (brow - top) * 0.42)} ${L(w * 0.62)} ${n(top)} ${n(CX)} ${n(top)}Z`;
}

/** Mirrors a right-side path fragment builder into both sides. */
function both(f: (s: 1 | -1) => string): string { return f(1) + f(-1); }

function ears(meta: Meta, h: Head): string {
  const y = h.brow + 6;
  return both((s) => {
    const x = (dx: number) => n(CX + s * dx);
    const base = h.w - 3;
    if (meta === 'elf') {
      // Long, swept ears with a pale inner edge.
      return `<path d="M${x(base)} ${n(y - 8)}L${x(h.w + 30)} ${n(y - 40)}L${x(h.w + 8)} ${n(y + 2)}L${x(base)} ${n(y + 22)}Z" fill="url(#EAR)"/>`
        + `<path d="M${x(h.w + 2)} ${n(y - 6)}L${x(h.w + 22)} ${n(y - 32)}" stroke="${SKIN_DARK}" stroke-width="2" fill="none"/>`;
    }
    if (meta === 'ork' || meta === 'troll') {
      const tip = meta === 'ork' ? 16 : 12;
      return `<path d="M${x(base)} ${n(y - 6)}L${x(h.w + tip)} ${n(y - 18)}L${x(h.w + 6)} ${n(y + 10)}L${x(base)} ${n(y + 20)}Z" fill="url(#EAR)"/>`;
    }
    return `<ellipse cx="${x(h.w + 1)}" cy="${n(y + 6)}" rx="7" ry="12" fill="url(#EAR)"/>`;
  });
}

function face(meta: Meta, fig: Figure, h: Head, rim: string): string {
  const eyeY = h.brow + 12;
  const sp = h.w * 0.43;
  const out: string[] = [];
  // Brow ridge shading (heavier on orks and trolls).
  const ridge = meta === 'troll' ? 7 : meta === 'ork' ? 5 : meta === 'dwarf' ? 4 : 2.5;
  out.push(`<path d="M${n(CX - h.w * 0.78)} ${n(eyeY - 7)}Q${n(CX)} ${n(eyeY - 9 - ridge)} ${n(CX + h.w * 0.78)} ${n(eyeY - 7)}" stroke="${SKIN_DARK}" stroke-width="${n(ridge + 1)}" stroke-linecap="round" fill="none" opacity=".75"/>`);
  // Brows.
  out.push(both((s) => `<path d="M${n(CX + s * (sp - 9))} ${n(eyeY - 9)}L${n(CX + s * (sp + 9))} ${n(eyeY - (fig === 'fem' ? 11 : 8))}" stroke="${HAIR}" stroke-width="${fig === 'fem' ? 2.5 : 3.5}" stroke-linecap="round"/>`));
  // Eyes: the right one (the viewer's left) is a cybereye with a glow.
  const eyeW = meta === 'elf' ? 8 : 7;
  out.push(`<path d="M${n(CX + sp - eyeW)} ${n(eyeY)}Q${n(CX + sp)} ${n(eyeY - 5)} ${n(CX + sp + eyeW)} ${n(eyeY)}Q${n(CX + sp)} ${n(eyeY + 3)} ${n(CX + sp - eyeW)} ${n(eyeY)}Z" fill="${STEEL.ink}" opacity=".85"/>`);
  out.push(`<circle cx="${n(CX + sp)}" cy="${n(eyeY - 0.5)}" r="2.2" fill="${HAIR}"/>`);
  out.push(`<circle cx="${n(CX - sp)}" cy="${n(eyeY - 0.5)}" r="6" fill="${rim}" opacity=".55" filter="url(#GLOW)"/>`);
  out.push(`<path d="M${n(CX - sp - eyeW)} ${n(eyeY)}Q${n(CX - sp)} ${n(eyeY - 5)} ${n(CX - sp + eyeW)} ${n(eyeY)}Q${n(CX - sp)} ${n(eyeY + 3)} ${n(CX - sp - eyeW)} ${n(eyeY)}Z" fill="${rim}"/>`);
  out.push(`<circle cx="${n(CX - sp)}" cy="${n(eyeY - 0.5)}" r="1.8" fill="${STEEL.ink}"/>`);
  // Nose and mouth.
  const noseY = eyeY + (h.jaw - eyeY) * 0.5;
  const nw = meta === 'troll' || meta === 'ork' ? 8 : meta === 'dwarf' ? 7 : 5;
  out.push(`<path d="M${n(CX + 2)} ${n(eyeY + 4)}L${n(CX + 4)} ${n(noseY)}Q${n(CX)} ${n(noseY + 4)} ${n(CX - nw)} ${n(noseY)}" stroke="${SKIN_DARK}" stroke-width="2.5" fill="none" stroke-linecap="round"/>`);
  const mouthY = noseY + (h.chin - noseY) * 0.42;
  const mw = h.jw * (fig === 'fem' ? 0.38 : 0.42);
  if (meta === 'dwarf' && fig === 'masc') return out.join('');
  out.push(`<path d="M${n(CX - mw)} ${n(mouthY)}Q${n(CX)} ${n(mouthY + (fig === 'fem' ? 3 : 1.5))} ${n(CX + mw)} ${n(mouthY)}" stroke="${fig === 'fem' ? '#3a2f36' : SKIN_DARK}" stroke-width="${fig === 'fem' ? 3.5 : 3}" fill="none" stroke-linecap="round"/>`);
  if (meta === 'ork' || meta === 'troll') {
    // Lower tusks rising past the upper lip.
    const tw = mw * 0.75; const len = meta === 'troll' ? 16 : (fig === 'fem' ? 9 : 12);
    out.push(both((s) => `<path d="M${n(CX + s * (tw - 3))} ${n(mouthY + 2)}Q${n(CX + s * (tw + 1))} ${n(mouthY - len * 0.5)} ${n(CX + s * (tw + 3))} ${n(mouthY - len)}Q${n(CX + s * (tw + 4))} ${n(mouthY - len * 0.3)} ${n(CX + s * (tw + 4))} ${n(mouthY + 2)}Z" fill="#d9d2c3" stroke="${STEEL.mid}" stroke-width="1"/>`));
  }
  if (meta === 'troll') {
    // Dermal bumps on the cheeks and brow.
    for (const [dx, dy, r] of [[0.62, 0.32, 3], [0.7, 0.45, 2.5], [0.55, 0.52, 2], [0.3, -0.1, 2.5]] as const) {
      out.push(both((s) => `<circle cx="${n(CX + s * h.w * dx)}" cy="${n(eyeY + (h.jaw - eyeY) * dy)}" r="${r}" fill="${SKIN_DARK}" opacity=".6"/>`));
    }
  }
  // Datajack on the temple (the viewer's right).
  out.push(`<circle cx="${n(CX + h.w * 0.9)}" cy="${n(eyeY + 4)}" r="3.2" fill="${STEEL.deep}" stroke="${rim}" stroke-width="1.5"/>`);
  return out.join('');
}

/** Hair drawn behind the head (long hair, braids) and in front (fringe, crests). */
function hair(meta: Meta, fig: Figure, h: Head): { back: string; front: string } {
  const t = h.top; const w = h.w;
  const key = `${meta}-${fig}`;
  const crownCap = (lift: number, side: number) =>
    `<path d="M${n(CX - w - side)} ${n(h.brow - 2)}C${n(CX - w - side)} ${n(t - lift)} ${n(CX + w + side)} ${n(t - lift)} ${n(CX + w + side)} ${n(h.brow - 2)}C${n(CX + w * 0.7)} ${n(t + 10)} ${n(CX - w * 0.7)} ${n(t + 10)} ${n(CX - w - side)} ${n(h.brow - 2)}Z" fill="${HAIR}"/>`;
  switch (key) {
    case 'human-masc':
      // Undercut with a swept top.
      return { back: '', front: `<path d="M${n(CX - w + 2)} ${n(h.brow - 10)}C${n(CX - w - 2)} ${n(t - 14)} ${n(CX + w * 0.4)} ${n(t - 22)} ${n(CX + w + 6)} ${n(t + 4)}C${n(CX + w * 0.3)} ${n(t + 2)} ${n(CX - w * 0.2)} ${n(t + 14)} ${n(CX - w + 2)} ${n(h.brow - 10)}Z" fill="${HAIR}"/>`
        + `<path d="M${n(CX - w * 0.4)} ${n(t - 6)}C${n(CX)} ${n(t - 12)} ${n(CX + w * 0.5)} ${n(t - 6)} ${n(CX + w * 0.8)} ${n(t + 2)}" stroke="${HAIR_HI}" stroke-width="3" fill="none"/>` };
    case 'human-fem':
      // A long straight cut with a side fringe.
      return { back: `<path d="M${n(CX - w - 6)} ${n(h.brow - 18)}C${n(CX - w - 14)} ${n(t)} ${n(CX + w + 14)} ${n(t)} ${n(CX + w + 6)} ${n(h.brow - 18)}L${n(CX + w + 12)} ${n(h.chin + 26)}L${n(CX - w - 12)} ${n(h.chin + 26)}Z" fill="${HAIR}"/>`,
        front: `<path d="M${n(CX - w - 2)} ${n(h.brow + 10)}C${n(CX - w - 6)} ${n(t - 12)} ${n(CX + w + 6)} ${n(t - 12)} ${n(CX + w + 2)} ${n(h.brow - 6)}C${n(CX + w * 0.2)} ${n(t + 18)} ${n(CX - w * 0.5)} ${n(h.brow - 16)} ${n(CX - w - 2)} ${n(h.brow + 10)}Z" fill="${HAIR}"/>`
        + `<path d="M${n(CX + w * 0.7)} ${n(t + 6)}C${n(CX + w * 0.1)} ${n(t + 14)} ${n(CX - w * 0.4)} ${n(h.brow - 22)} ${n(CX - w * 0.8)} ${n(h.brow)}" stroke="${HAIR_HI}" stroke-width="2.5" fill="none"/>` };
    case 'elf-masc':
      // Long hair swept back behind the ears, tied low.
      return { back: `<path d="M${n(CX - w - 4)} ${n(h.brow)}C${n(CX - w - 10)} ${n(t - 6)} ${n(CX + w + 10)} ${n(t - 6)} ${n(CX + w + 4)} ${n(h.brow)}L${n(CX + w - 2)} ${n(h.jaw + 18)}L${n(CX - w + 2)} ${n(h.jaw + 18)}Z" fill="${HAIR}"/>`,
        front: crownCap(8, 3) + `<path d="M${n(CX - w * 0.5)} ${n(t)}C${n(CX)} ${n(t - 6)} ${n(CX + w * 0.5)} ${n(t)} ${n(CX + w * 0.9)} ${n(h.brow - 12)}" stroke="${HAIR_HI}" stroke-width="2.5" fill="none"/>` };
    case 'elf-fem':
      // Very long hair, parted in the middle, falling past the shoulders.
      return { back: `<path d="M${n(CX - w - 6)} ${n(h.brow - 10)}C${n(CX - w - 14)} ${n(t - 8)} ${n(CX + w + 14)} ${n(t - 8)} ${n(CX + w + 6)} ${n(h.brow - 10)}C${n(CX + w + 16)} ${n(h.jaw)} ${n(CX + w + 26)} ${n(h.chin + 40)} ${n(CX + w + 18)} ${n(h.chin + 60)}L${n(CX - w - 18)} ${n(h.chin + 60)}C${n(CX - w - 26)} ${n(h.chin + 40)} ${n(CX - w - 16)} ${n(h.jaw)} ${n(CX - w - 6)} ${n(h.brow - 10)}Z" fill="${HAIR}"/>`,
        front: `<path d="M${n(CX - w - 3)} ${n(h.brow + 4)}C${n(CX - w - 4)} ${n(t - 12)} ${n(CX + w + 4)} ${n(t - 12)} ${n(CX + w + 3)} ${n(h.brow + 4)}C${n(CX + w * 0.5)} ${n(t + 12)} ${n(CX + 2)} ${n(t + 6)} ${n(CX)} ${n(t + 10)}C${n(CX - 2)} ${n(t + 6)} ${n(CX - w * 0.5)} ${n(t + 12)} ${n(CX - w - 3)} ${n(h.brow + 4)}Z" fill="${HAIR}"/>` };
    case 'dwarf-masc': {
      // Shaved head with a short crest, a moustache and a big beard bound at the tip.
      const eyeY = h.brow + 12;
      const top = eyeY + (h.jaw - eyeY) * 0.5 + 6; // just under the nose
      const BEARD = '#2b3038';
      const beard = `<path d="M${n(CX - h.jw - 3)} ${n(top - 6)}C${n(CX - h.jw - 8)} ${n(h.chin + 10)} ${n(CX - 20)} ${n(h.chin + 30)} ${n(CX - 7)} ${n(h.chin + 44)}L${n(CX)} ${n(h.chin + 56)}L${n(CX + 7)} ${n(h.chin + 44)}C${n(CX + 20)} ${n(h.chin + 30)} ${n(CX + h.jw + 8)} ${n(h.chin + 10)} ${n(CX + h.jw + 3)} ${n(top - 6)}C${n(CX + h.jw * 0.7)} ${n(top + 6)} ${n(CX + 14)} ${n(top + 8)} ${n(CX)} ${n(top + 6)}C${n(CX - 14)} ${n(top + 8)} ${n(CX - h.jw * 0.7)} ${n(top + 6)} ${n(CX - h.jw - 3)} ${n(top - 6)}Z" fill="${BEARD}"/>`
        // Strands.
        + `<path d="M${n(CX - 22)} ${n(top + 14)}Q${n(CX - 18)} ${n(h.chin + 16)} ${n(CX - 8)} ${n(h.chin + 34)}M${n(CX - 9)} ${n(top + 18)}Q${n(CX - 6)} ${n(h.chin + 20)} ${n(CX - 2)} ${n(h.chin + 40)}M${n(CX + 9)} ${n(top + 18)}Q${n(CX + 6)} ${n(h.chin + 20)} ${n(CX + 2)} ${n(h.chin + 40)}M${n(CX + 22)} ${n(top + 14)}Q${n(CX + 18)} ${n(h.chin + 16)} ${n(CX + 8)} ${n(h.chin + 34)}" stroke="${STEEL.light}" stroke-width="1.6" fill="none" opacity=".7"/>`
        // Moustache.
        + `<path d="M${n(CX)} ${n(top + 1)}C${n(CX - 10)} ${n(top - 5)} ${n(CX - 22)} ${n(top - 2)} ${n(CX - 26)} ${n(top + 10)}C${n(CX - 18)} ${n(top + 6)} ${n(CX - 8)} ${n(top + 8)} ${n(CX)} ${n(top + 6)}C${n(CX + 8)} ${n(top + 8)} ${n(CX + 18)} ${n(top + 6)} ${n(CX + 26)} ${n(top + 10)}C${n(CX + 22)} ${n(top - 2)} ${n(CX + 10)} ${n(top - 5)} ${n(CX)} ${n(top + 1)}Z" fill="${HAIR}"/>`
        + `<rect x="${n(CX - 6)}" y="${n(h.chin + 40)}" width="12" height="6" rx="2" fill="${STEEL.pale}"/>`;
      return { back: '', front: `<path d="M${n(CX - 8)} ${n(t + 2)}C${n(CX - 6)} ${n(t - 6)} ${n(CX + 6)} ${n(t - 6)} ${n(CX + 8)} ${n(t + 2)}L${n(CX + 6)} ${n(h.brow - 18)}L${n(CX - 6)} ${n(h.brow - 18)}Z" fill="${HAIR}"/>` + beard };
    }
    case 'dwarf-fem':
      // Hair pulled back into two thick braids over the shoulders.
      return { back: '', front: crownCap(10, 3) + both((s) => {
        const x = (dx: number) => n(CX + s * dx);
        const segs: string[] = [];
        for (let i = 0; i < 5; i++) {
          const y0 = h.brow + 6 + i * 14;
          segs.push(`<ellipse cx="${x(w + 4 + i * 1.5)}" cy="${n(y0 + 7)}" rx="8" ry="8.5" fill="${i % 2 ? HAIR_HI : HAIR}"/>`);
        }
        return segs.join('') + `<rect x="${n(CX + s * (w + 10) - 5)}" y="${n(h.brow + 76)}" width="10" height="6" rx="2" fill="${STEEL.pale}"/>`;
      }) };
    case 'ork-masc':
      // Shaved sides and a tall crest.
      return { back: '', front: `<path d="M${n(CX - 11)} ${n(t + 6)}C${n(CX - 14)} ${n(t - 26)} ${n(CX - 4)} ${n(t - 34)} ${n(CX + 2)} ${n(t - 36)}C${n(CX + 10)} ${n(t - 28)} ${n(CX + 14)} ${n(t - 18)} ${n(CX + 11)} ${n(t + 6)}L${n(CX + 9)} ${n(h.brow - 14)}L${n(CX - 9)} ${n(h.brow - 14)}Z" fill="${HAIR}"/>`
        + `<path d="M${n(CX - 3)} ${n(t - 28)}L${n(CX - 4)} ${n(t + 4)}" stroke="${HAIR_HI}" stroke-width="2.5"/>` };
    case 'ork-fem':
      // One side shaved, the long top swept over to the other side.
      return { back: `<path d="M${n(CX + w)} ${n(h.brow - 20)}C${n(CX + w + 18)} ${n(h.brow)} ${n(CX + w + 20)} ${n(h.jaw + 10)} ${n(CX + w + 12)} ${n(h.chin + 20)}L${n(CX + w - 6)} ${n(h.chin + 10)}Z" fill="${HAIR}"/>`,
        front: `<path d="M${n(CX - w * 0.55)} ${n(t + 8)}C${n(CX - w * 0.4)} ${n(t - 16)} ${n(CX + w + 10)} ${n(t - 18)} ${n(CX + w + 6)} ${n(h.brow + 6)}C${n(CX + w * 0.6)} ${n(t + 16)} ${n(CX)} ${n(t + 10)} ${n(CX - w * 0.55)} ${n(t + 8)}Z" fill="${HAIR}"/>`
        + `<path d="M${n(CX - w * 0.2)} ${n(t - 4)}C${n(CX + w * 0.4)} ${n(t - 10)} ${n(CX + w * 0.9)} ${n(t)} ${n(CX + w + 2)} ${n(h.brow - 4)}" stroke="${HAIR_HI}" stroke-width="2.5" fill="none"/>` };
    case 'troll-masc':
      return { back: '', front: '' };
    case 'troll-fem':
      // Heavy locs falling to the shoulders.
      return { back: `<path d="M${n(CX - w - 8)} ${n(h.brow - 8)}C${n(CX - w - 12)} ${n(t)} ${n(CX + w + 12)} ${n(t)} ${n(CX + w + 8)} ${n(h.brow - 8)}L${n(CX + w + 16)} ${n(h.chin + 22)}L${n(CX - w - 16)} ${n(h.chin + 22)}Z" fill="${HAIR}"/>`
        + both((s) => [0, 1, 2].map((i) => `<path d="M${n(CX + s * (w + 2 + i * 5))} ${n(h.brow)}L${n(CX + s * (w + 4 + i * 5))} ${n(h.chin + 18)}" stroke="${HAIR_HI}" stroke-width="2"/>`).join('')),
        front: crownCap(6, 4) };
  }
  return { back: '', front: '' };
}

function horns(meta: Meta, fig: Figure, h: Head, rim: string): string {
  if (meta !== 'troll') return '';
  const y = h.top + 14;
  const big = fig === 'masc';
  return both((s) => {
    const x = (dx: number) => n(CX + s * dx);
    // A ram-like horn curling up and out from the temple.
    const d = big
      ? `M${x(h.w * 0.45)} ${n(y + 6)}C${x(h.w * 0.6)} ${n(y - 26)} ${x(h.w + 30)} ${n(y - 40)} ${x(h.w + 36)} ${n(y - 12)}C${x(h.w + 30)} ${n(y - 24)} ${x(h.w + 8)} ${n(y - 18)} ${x(h.w * 0.85)} ${n(y + 14)}Z`
      : `M${x(h.w * 0.5)} ${n(y + 6)}C${x(h.w * 0.6)} ${n(y - 20)} ${x(h.w + 18)} ${n(y - 34)} ${x(h.w + 24)} ${n(y - 20)}C${x(h.w + 16)} ${n(y - 22)} ${x(h.w + 4)} ${n(y - 12)} ${x(h.w * 0.85)} ${n(y + 12)}Z`;
    return `<path d="${d}" fill="#9a9184" stroke="${STEEL.dark}" stroke-width="2"/>`
      + `<path d="M${x(h.w * 0.7)} ${n(y - 6)}Q${x(h.w + 10)} ${n(y - 26)} ${x(h.w + (big ? 28 : 18))} ${n(y - (big ? 22 : 24))}" stroke="${mix(rim, '#ffffff', 0.3)}" stroke-width="2" fill="none" opacity=".7"/>`;
  });
}

/** Neck and shoulders: a high-collared jacket. Wider for dwarves, orks and trolls; the feminine figure narrower. */
function torso(meta: Meta, fig: Figure, h: Head, rim: string): { neck: string; torso: string } {
  const sh = ({ human: 92, elf: 84, dwarf: 104, ork: 104, troll: 118 } as const)[meta] - (fig === 'fem' ? 10 : 0);
  const nw = ({ human: 15, elf: 12, dwarf: 19, ork: 21, troll: 26 } as const)[meta] - (fig === 'fem' ? 3 : 0);
  const ny = h.jaw - 2;
  const sy = h.chin + 26;
  const neck = `<path d="M${n(CX - nw)} ${n(ny)}L${n(CX - nw - 2)} ${n(sy + 6)}L${n(CX + nw + 2)} ${n(sy + 6)}L${n(CX + nw)} ${n(ny)}Z" fill="${SKIN_DARK}"/>`;
  const body = `<path d="M${n(CX - nw - 8)} ${n(sy - 6)}C${n(CX - sh * 0.6)} ${n(sy - 2)} ${n(CX - sh)} ${n(sy + 6)} ${n(CX - sh - 4)} ${n(sy + 46)}L${n(CX - sh - 10)} 260L${n(CX + sh + 10)} 260L${n(CX + sh + 4)} ${n(sy + 46)}C${n(CX + sh)} ${n(sy + 6)} ${n(CX + sh * 0.6)} ${n(sy - 2)} ${n(CX + nw + 8)} ${n(sy - 6)}Z" fill="${STEEL.dark}"/>`;
  // Lapels, a shirt, and a rim-coloured trim line.
  const lap = both((s) => `<path d="M${n(CX + s * (nw + 8))} ${n(sy - 6)}L${n(CX + s * (nw + 18))} ${n(sy + 4)}L${n(CX + s * 8)} ${n(sy + 58)}L${n(CX + s * 2)} ${n(sy + 10)}Z" fill="${STEEL.mid}"/>`
    + `<path d="M${n(CX + s * (nw + 18))} ${n(sy + 4)}L${n(CX + s * 8)} ${n(sy + 58)}" stroke="${rim}" stroke-width="2" opacity=".8"/>`);
  const shirt = `<path d="M${n(CX - nw - 2)} ${n(sy - 4)}L${n(CX)} ${n(sy + 46)}L${n(CX + nw + 2)} ${n(sy - 4)}Z" fill="${STEEL.deep}"/>`;
  const shoulders = both((s) => `<path d="M${n(CX + s * (sh * 0.55))} ${n(sy + 2)}C${n(CX + s * (sh * 0.85))} ${n(sy + 4)} ${n(CX + s * sh)} ${n(sy + 14)} ${n(CX + s * (sh + 2))} ${n(sy + 34)}" stroke="${STEEL.base}" stroke-width="3" fill="none"/>`);
  return { neck, torso: body + shirt + lap + shoulders };
}

/** The portrait (the token's body) for a metatype and figure, in a rim colour. */
export function portrait(meta: Meta, fig: Figure, rim: string, id: string): string {
  const h = HEADS[meta][fig];
  const hr = hair(meta, fig, h);
  const t = torso(meta, fig, h, rim);
  const skin = `<linearGradient id="${id}-skin" x1="0" y1="0" x2="1" y2="0.3"><stop offset="0" stop-color="${SKIN_LIGHT}"/><stop offset="1" stop-color="${SKIN_DARK}"/></linearGradient>`;
  const ear = `<linearGradient id="${id}-ear" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${mix(SKIN_LIGHT, SKIN_DARK, 0.3)}"/><stop offset="1" stop-color="${SKIN_DARK}"/></linearGradient>`;
  const fix = (s: string): string => s.replace(/url\(#EAR\)/g, `url(#${id}-ear)`).replace(/url\(#GLOW\)/g, `url(#${id}-glow)`);
  // The figure is defined once and used twice: first through a filter that grows its outline and fills it with
  // the rim colour (the rim light, a little higher than the figure), then as itself.
  const fig2 = fix(hr.back + horns(meta, fig, h, rim) + ears(meta, h)) + t.neck + t.torso
    + `<path d="${headPath(h)}" fill="url(#${id}-skin)"/>` + fix(face(meta, fig, h, rim)) + fix(hr.front);
  const rimF = `<filter id="${id}-rimf" x="-10%" y="-10%" width="120%" height="120%">`
    + `<feMorphology in="SourceAlpha" operator="dilate" radius="3.5"/><feOffset dy="-1.5" result="d"/>`
    + `<feFlood flood-color="${rim}"/><feComposite operator="in" in2="d"/></filter>`;
  // A soft backlight glow behind the head.
  const glow = `<circle cx="${CX}" cy="${n(h.brow)}" r="70" fill="${rim}" opacity=".22" filter="url(#${id}-glow)"/><circle cx="${CX}" cy="${n(h.brow)}" r="54" fill="${rim}" opacity=".12"/>`;
  return `<defs>${skin}${ear}${rimF}<g id="${id}-fig">${fig2}</g></defs>`
    + `<g transform="translate(128 164) scale(1.14) translate(-128 -156)">${glow}<use href="#${id}-fig" filter="url(#${id}-rimf)"/><use href="#${id}-fig"/></g>`;
}

export const META_LABEL: Record<Meta, string> = { human: 'Human', elf: 'Elf', dwarf: 'Dwarf', ork: 'Ork', troll: 'Troll' };
export const FIGURE_LABEL: Record<Figure, string> = { masc: 'masculine', fem: 'feminine' };

/** The file of a portrait, plain or with a badge. */
export function peopleFile(meta: Meta, fig: Figure, badge: BadgeId | '' = ''): string {
  return `people/${meta}-${fig}${badge ? `-${badge}` : ''}.svg`;
}

export function files(): ArtFile[] {
  const out: ArtFile[] = [];
  for (const meta of METAS) for (const fig of FIGURES) {
    for (const badge of ['', ...BADGE_IDS] as Array<BadgeId | ''>) {
      const file = peopleFile(meta, fig, badge);
      const id = file.replace(/\.svg$/, '').replace(/[^a-zA-Z0-9]/g, '-');
      const b = badge ? BADGES[badge] : null;
      const rim = b ? b.rim : RIM.plain;
      out.push({ file, svg: token({ id, rim, title: `${META_LABEL[meta]}, ${FIGURE_LABEL[fig]}${b ? `, ${b.title}` : ''} (default token)`, body: portrait(meta, fig, rim, id), ...(b ? { badge: b } : {}) }) });
    }
  }
  return out;
}

/** Only the plain portraits, for the preview. */
export function previewFiles(): ArtFile[] { return files().filter((f) => /^people\/[a-z]+-(masc|fem)\.svg$/.test(f.file)); }
