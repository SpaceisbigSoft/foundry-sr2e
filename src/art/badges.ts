/**
 * v0.83.0: archetype badges, the small emblems composited onto people's portrait tokens (the disc at the lower
 * right; see `TokenSpec.badge` in frame.ts). The system's own art, drawn by Claude (AI): generic shapes only,
 * no text, no logos, no real-world emblems. Each body is drawn in a 64 × 64 box and is shown at ~10-20 screen
 * pixels on the map, so every emblem is one bold silhouette in the rim colour with at most a highlight.
 */
import { token, RIM, STEEL, mix, n, type ArtFile } from './frame.ts';

export const BADGE_IDS = ['samurai', 'merc', 'ganger', 'security', 'decker', 'rigger', 'mage', 'shaman', 'adept', 'talisman', 'face', 'suit', 'fixer', 'medic', 'tech'] as const;
export type BadgeId = typeof BADGE_IDS[number];

/** The badge disc's own fill (as frame.ts paints it), for cut-outs that should read as holes. */
const hole = (rim: string): string => mix(rim, STEEL.deep, 0.82);
const INK = STEEL.ink;

/** A star polygon of `k` points around (32, 32). */
function star(k: number, ro: number, ri: number): string {
  const pts: string[] = [];
  for (let i = 0; i < k * 2; i++) {
    const a = (Math.PI * i) / k - Math.PI / 2;
    const r = i % 2 ? ri : ro;
    pts.push(`${n(32 + r * Math.cos(a))},${n(32 + r * Math.sin(a))}`);
  }
  return pts.join(' ');
}

function draw(id: BadgeId, c: string): string {
  const h = hole(c);
  switch (id) {
    case 'samurai': // a katana, point up-right
      return `<path d="M15 42L48 10Q57 4 56 14L24 51Z" fill="${c}"/>`
        + `<path d="M20 41L50 11" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/>`
        + `<path d="M13 37L27 51" stroke="${c}" stroke-width="6" stroke-linecap="round"/>`
        + `<path d="M18 46L8 56" stroke="${c}" stroke-width="7" stroke-linecap="round"/>`
        + `<path d="M15 49l2 2M11.5 52.5l2 2" stroke="${h}" stroke-width="2"/>`;
    case 'merc': // a reticle
      return `<circle cx="32" cy="32" r="17" fill="none" stroke="${c}" stroke-width="5"/>`
        + `<path d="M32 5V21M32 43V59M5 32H21M43 32H59" stroke="${c}" stroke-width="5" stroke-linecap="round"/>`
        + `<circle cx="32" cy="32" r="4" fill="${INK}"/>`;
    case 'ganger': // a spiked knuckle-duster
      return `<path d="M15 26L18 12L23 26M26 26L29 12L34 26M37 26L40 12L45 26M48 26L51 12L54 26" fill="${c}"/>`
        + `<path d="M9 30Q9 24 15 24H51Q57 24 57 30V36Q57 42 51 42H42Q40 54 32 56Q24 54 22 42H15Q9 42 9 36Z" fill="${c}"/>`
        + `<circle cx="17" cy="33" r="4" fill="${h}"/><circle cx="27.5" cy="33" r="4" fill="${h}"/>`
        + `<circle cx="38" cy="33" r="4" fill="${h}"/><circle cx="48.5" cy="33" r="4" fill="${h}"/>`;
    case 'security': // a plain shield
      return `<path d="M32 5L54 12V29C54 44 44 53 32 59C20 53 10 44 10 29V12Z" fill="${c}"/>`
        + `<path d="M32 12L47 17V29C47 39 41 46 32 51Z" fill="${mix(c, '#ffffff', 0.35)}"/>`
        + `<path d="M20 25L32 33L44 25" fill="none" stroke="${h}" stroke-width="5" stroke-linejoin="round"/>`;
    case 'decker': // a datajack plug and its cable
      return `<path d="M32 44C32 54 22 50 16 56" fill="none" stroke="${c}" stroke-width="5" stroke-linecap="round"/>`
        + `<rect x="22" y="18" width="20" height="26" rx="4" fill="${c}"/>`
        + `<rect x="28" y="5" width="8" height="15" rx="1.5" fill="${c}"/>`
        + `<path d="M22 29H42" stroke="${h}" stroke-width="3"/>`
        + `<circle cx="32" cy="37" r="3" fill="${INK}"/>`;
    case 'rigger': // a quad-rotor drone from above
      return `<path d="M17 17L47 47M47 17L17 47" stroke="${c}" stroke-width="5"/>`
        + [[15, 15], [49, 15], [15, 49], [49, 49]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="9" fill="none" stroke="${c}" stroke-width="4"/>`).join('')
        + `<rect x="24" y="24" width="16" height="16" rx="4" fill="${c}"/><circle cx="32" cy="32" r="3" fill="${INK}"/>`;
    case 'mage': // an eight-point star in a ring
      return `<circle cx="32" cy="32" r="26" fill="none" stroke="${c}" stroke-width="4"/>`
        + `<polygon points="${star(8, 21, 9)}" fill="${c}"/><circle cx="32" cy="32" r="4" fill="${INK}"/>`;
    case 'shaman': // a feather
      return `<path d="M12 54C14 32 32 12 56 7C52 30 34 48 12 54Z" fill="${c}"/>`
        + `<path d="M6 59L46 18" stroke="${h}" stroke-width="3" stroke-linecap="round"/>`
        + `<path d="M6 59L14 51" stroke="${c}" stroke-width="4" stroke-linecap="round"/>`
        + `<path d="M28 36L23 30M37 27L33 20M30 34L37 38" stroke="${h}" stroke-width="3"/>`;
    case 'adept': // a raised fist
      return `<path d="M21 46H43V59H21Z" fill="${c}"/>`
        + [16, 24, 32, 40].map((x) => `<rect x="${x}" y="10" width="8" height="22" rx="4" fill="${c}" stroke="${h}" stroke-width="2"/>`).join('')
        + `<path d="M15 24H49V40Q49 48 41 48H23Q15 48 15 40Z" fill="${c}"/>`
        + `<path d="M24 20V27M32 20V27M40 20V27" stroke="${h}" stroke-width="2"/>`
        + `<rect x="13" y="29" width="25" height="9" rx="4.5" fill="${c}" stroke="${h}" stroke-width="2"/>`;
    case 'talisman': // a teardrop charm on a chain
      return `<path d="M12 5L32 26L52 5" fill="none" stroke="${c}" stroke-width="4" stroke-linejoin="round"/>`
        + `<path d="M32 24C40 33 47 39 47 46A15 15 0 0 1 17 46C17 39 24 33 32 24Z" fill="${c}"/>`
        + `<circle cx="32" cy="46" r="6" fill="${h}"/><circle cx="32" cy="46" r="2.5" fill="${INK}"/>`;
    case 'face': // a domino mask
      return `<path d="M5 25C13 17 26 19 32 24C38 19 51 17 59 25C61 37 54 45 44 43C38 42 35 37 32 37C29 37 26 42 20 43C10 45 3 37 5 25Z" fill="${c}"/>`
        + `<path d="M13 31Q19 25 26 31Q19 35 13 31ZM38 31Q45 25 51 31Q45 35 38 31Z" fill="${h}"/>`;
    case 'suit': // a necktie under a collar
      return `<path d="M12 5L31 15L25 23ZM52 5L33 15L39 23Z" fill="${INK}"/>`
        + `<path d="M25 13H39L36 23H28Z" fill="${c}"/>`
        + `<path d="M28 25H36L44 49L32 60L20 49Z" fill="${c}"/>`
        + `<path d="M25 39L39 31M23 47L41 37" stroke="${h}" stroke-width="2.5"/>`;
    case 'fixer': { // a stack of credit chips
      let s = '';
      for (let i = 0; i < 4; i++) {
        const y = 48 - i * 9;
        s += `<path d="M12 ${y}V${y - 7}H52V${y}A20 6 0 0 1 12 ${y}Z" fill="${c}" stroke="${h}" stroke-width="1.5"/>`;
      }
      return s + `<ellipse cx="32" cy="14" rx="20" ry="6" fill="${mix(c, '#ffffff', 0.4)}" stroke="${h}" stroke-width="1.5"/>`
        + `<ellipse cx="32" cy="14" rx="9" ry="2.5" fill="none" stroke="${c}" stroke-width="2"/>`;
    }
    case 'medic': // a syringe
      return `<g transform="rotate(-45 32 32)">`
        + `<path d="M3 32L17 30V34Z" fill="${INK}"/>`
        + `<rect x="17" y="24" width="24" height="16" rx="2" fill="${c}"/>`
        + `<path d="M23 24V31M29 24V31M35 24V31" stroke="${h}" stroke-width="2.5"/>`
        + `<rect x="41" y="28" width="11" height="8" fill="${c}"/><rect x="52" y="21" width="6" height="22" rx="2" fill="${c}"/>`
        + `<rect x="38" y="19" width="5" height="26" rx="2" fill="${c}"/></g>`;
    case 'tech': // a wrench
      return `<path d="M17 47L41 23" stroke="${c}" stroke-width="10" stroke-linecap="round"/>`
        + `<circle cx="44" cy="20" r="14" fill="${c}"/>`
        + `<path d="M47 5L59 17L50 26L38 14Z" fill="${h}"/>`
        + `<circle cx="14" cy="50" r="2.5" fill="${h}"/>`;
  }
}

const META: Record<BadgeId, { rim: string; title: string }> = {
  samurai: { rim: RIM.combat, title: 'Street samurai' },
  merc: { rim: RIM.combat, title: 'Mercenary' },
  ganger: { rim: RIM.combat, title: 'Ganger' },
  security: { rim: RIM.security, title: 'Security' },
  decker: { rim: RIM.matrix, title: 'Decker' },
  rigger: { rim: RIM.rigging, title: 'Rigger' },
  mage: { rim: RIM.magic, title: 'Mage' },
  shaman: { rim: RIM.magic, title: 'Shaman' },
  adept: { rim: RIM.magic, title: 'Physical adept' },
  talisman: { rim: RIM.magic, title: 'Talismonger' },
  face: { rim: RIM.street, title: 'Face' },
  suit: { rim: RIM.street, title: 'Corporate suit' },
  fixer: { rim: RIM.street, title: 'Fixer' },
  medic: { rim: RIM.health, title: 'Street doc' },
  tech: { rim: RIM.rigging, title: 'Technician' },
};

export const BADGES = Object.fromEntries(
  BADGE_IDS.map((id) => [id, { ...META[id], body: draw(id, META[id].rim) }]),
) as Record<BadgeId, { rim: string; title: string; body: string }>;

/** One token per badge (no portrait), for the contact sheet only. */
export function previewFiles(): ArtFile[] {
  return BADGE_IDS.map((id) => ({
    file: `badge-${id}.svg`,
    svg: token({ id: 'badge-' + id, title: BADGES[id].title, rim: RIM.plain, body: '', badge: BADGES[id] }),
  }));
}
