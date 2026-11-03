/**
 * v0.83.0: the default token art. Pure, no Foundry: which of the system's own pictures (drawn by Claude, an AI,
 * for this system; under `public/tokens/`, built from `src/art/` by `npm run tokens`) an actor gets.
 *
 * - People (characters and NPCs): a portrait by metatype and figure, with an archetype badge. The archetype is
 *   the one set on the sheet, else the NPC generator's, else worked out from what the character has (tradition,
 *   a control rig, a cyberdeck, wired reflexes or cyberweapons, a face's Charisma).
 * - Critters, spirits (by kind, element or nature domain), vehicles and drones (by category), IC by category,
 *   hosts, barriers, sites and safehouses.
 * `__tests__/v083.test.ts` checks that every file this can return exists, and that the lists here match the drawings.
 */
import { own } from './util.ts';

/** Where the files are, as Foundry paths. */
export const ART_ROOT = 'systems/sr2e/tokens/';

export const ART_METAS = ['human', 'elf', 'dwarf', 'ork', 'troll'] as const;
export const ART_FIGURES = ['masc', 'fem'] as const;
export type ArtFigure = typeof ART_FIGURES[number];
export const FIGURE_LABELS: Record<ArtFigure, string> = { masc: 'Masculine', fem: 'Feminine' };

/** The archetype badges (same ids as `src/art/badges.ts`). */
export const ART_ARCHETYPES = ['samurai', 'merc', 'ganger', 'security', 'decker', 'rigger', 'mage', 'shaman', 'adept', 'talisman', 'face', 'suit', 'fixer', 'medic', 'tech'] as const;
export type ArtArchetype = typeof ART_ARCHETYPES[number];
export const ARCHETYPE_LABELS: Record<ArtArchetype, string> = {
  samurai: 'Street samurai', merc: 'Mercenary', ganger: 'Ganger', security: 'Security', decker: 'Decker', rigger: 'Rigger',
  mage: 'Mage', shaman: 'Shaman', adept: 'Physical adept', talisman: 'Talismonger', face: 'Face', suit: 'Corporate suit',
  fixer: 'Fixer', medic: 'Street doc', tech: 'Technician',
};

/** The NPC generator's archetypes (rules/npcgen.ts ARCHETYPES) → badges. */
const GENERATED: Record<string, ArtArchetype> = {
  ganger: 'ganger', thug: 'ganger', guard: 'security', cop: 'security', elite: 'merc', merc: 'merc', decker: 'decker',
  rigger: 'rigger', mage: 'mage', shaman: 'shaman', adept: 'adept', face: 'face', suit: 'suit', tech: 'tech', doc: 'medic',
  fixer: 'fixer', smuggler: 'fixer', bartender: 'fixer', talismonger: 'talisman',
};

export const ART_CRITTERS = ['dog', 'wolf', 'cat', 'bear', 'awakenedWolf'] as const;
export const ART_VEHICLES = ['car', 'bike', 'truck', 'hovercraft', 'boat', 'ship', 'rotor', 'fixedWing', 'vectorThrust', 'lta', 'other'] as const;
/** Which drone body each vehicle category gets. */
const DRONE_BODY: Record<string, 'ground' | 'rotor' | 'wing' | 'water'> = {
  car: 'ground', bike: 'ground', truck: 'ground', other: 'ground', rotor: 'rotor', fixedWing: 'wing', vectorThrust: 'wing', lta: 'wing',
  hovercraft: 'water', boat: 'water', ship: 'water',
};
export const ART_SPIRITS = ['elemental-fire', 'elemental-water', 'elemental-air', 'elemental-earth', 'nature-man', 'nature-land', 'nature-water', 'nature-sky',
  'watcher', 'ally', 'free', 'spirit', 'toxic', 'insect'] as const;

/** Everything about an actor the choice depends on (the glue reads it off the document). */
export interface ArtInfo {
  type: string;
  name?: string;
  metatype?: string;
  /** The sheet's choices ('' = not chosen). */
  figure?: string;
  archetype?: string;
  /** The NPC generator's archetype (flags.sr2e.generated.archetype), e.g. 'guard' or 'critter:wolf'. */
  generated?: string;
  /** A critter (flags.sr2e.critter). */
  critter?: boolean;
  tradition?: string;
  hasDeck?: boolean;
  hasControlRig?: boolean;
  /** Wired/boosted/synaptic reflexes (or ware named for them, a reflex enhancer or muscle replacement), or cyberweapons. */
  combatWare?: boolean;
  /** Attribute ratings, for the face (Charisma the highest, at least 4). */
  attributes?: Record<string, number>;
  /** Spirits. */
  spiritKind?: string;
  spiritType?: string;
  element?: string;
  /** Vehicles. */
  category?: string;
  drone?: boolean;
  /** IC. */
  icCategory?: string;
}

/** A stable choice of figure from a name (for actors made before the figure was stored). */
export function figureFromName(name: string | undefined): ArtFigure {
  let h = 0;
  for (const ch of String(name ?? '')) h = (h * 31 + ch.codePointAt(0)!) >>> 0;
  return h % 2 ? 'fem' : 'masc';
}

export function isArtFigure(v: unknown): v is ArtFigure { return (ART_FIGURES as readonly string[]).includes(String(v)); }
export function isArtArchetype(v: unknown): v is ArtArchetype { return (ART_ARCHETYPES as readonly string[]).includes(String(v)); }

/** The archetype worked out from what a person has ('' = none fits). */
export function inferArchetype(i: ArtInfo): ArtArchetype | '' {
  const trad = String(i.tradition ?? 'none');
  if (['shamanic', 'shamanist', 'toxic', 'insect'].includes(trad)) return 'shaman';
  if (['hermetic', 'sorcerer', 'conjurer', 'elementalist'].includes(trad)) return 'mage';
  if (trad === 'adept') return 'adept';
  if (i.hasControlRig) return 'rigger';
  if (i.hasDeck) return 'decker';
  if (i.combatWare) return 'samurai';
  const a = i.attributes ?? {};
  const cha = Number(a['charisma'] ?? 0);
  const others = ['body', 'quickness', 'strength', 'intelligence', 'willpower'].map((k) => Number(a[k] ?? 0));
  if (cha >= 4 && others.every((v) => cha > v)) return 'face';
  return '';
}

/** The badge a person's token shows ('' = the plain portrait). The sheet's 'none' means no badge. */
export function archetypeFor(i: ArtInfo): ArtArchetype | '' {
  if (i.archetype === 'none') return '';
  if (isArtArchetype(i.archetype)) return i.archetype;
  const g = own(GENERATED, String(i.generated ?? ''));
  if (g) return g;
  return inferArchetype(i);
}

function spiritFile(i: ArtInfo): string {
  const kind = String(i.spiritKind ?? '');
  const text = `${i.spiritType ?? ''} ${i.element ?? ''}`.toLowerCase();
  if (kind === 'elemental') {
    for (const e of ['fire', 'water', 'air', 'earth']) if (text.includes(e)) return `elemental-${e}`;
    return 'spirit';
  }
  if (kind === 'nature') {
    if (/hearth|city|urban|man\b|home/.test(text)) return 'nature-man';
    if (/river|lake|sea|swamp|ocean|water/.test(text)) return 'nature-water';
    if (/storm|wind|mist|sky|cloud|air/.test(text)) return 'nature-sky';
    return 'nature-land'; // forest, field, mountain, desert, prairie… and anything else
  }
  if (['watcher', 'ally', 'free', 'toxic', 'insect'].includes(kind)) return kind;
  return 'spirit';
}

/** The default picture for an actor (a Foundry path), or null for a type with none. */
export function defaultArtFor(i: ArtInfo): string | null {
  const at = (f: string) => `${ART_ROOT}${f}.svg`;
  switch (i.type) {
    case 'character':
    case 'npc': {
      const gen = String(i.generated ?? '');
      if (i.critter || gen.startsWith('critter:')) {
        const c = gen.slice('critter:'.length);
        return at(`critters/${(ART_CRITTERS as readonly string[]).includes(c) ? c : 'critter'}`);
      }
      const meta = (ART_METAS as readonly string[]).includes(String(i.metatype)) ? String(i.metatype) : 'human';
      const fig = isArtFigure(i.figure) ? i.figure : figureFromName(i.name);
      const badge = archetypeFor(i);
      return at(`people/${meta}-${fig}${badge ? `-${badge}` : ''}`);
    }
    case 'spirit': return at(`spirits/${spiritFile(i)}`);
    case 'vehicle': {
      const cat = (ART_VEHICLES as readonly string[]).includes(String(i.category)) ? String(i.category) : 'other';
      return at(i.drone ? `vehicles/drone-${DRONE_BODY[cat] ?? 'ground'}` : `vehicles/${cat}`);
    }
    case 'ic': {
      const c = String(i.icCategory ?? 'white');
      return at(`matrix/ic-${['white', 'gray', 'black'].includes(c) ? c : 'white'}`);
    }
    case 'host': return at('matrix/host');
    case 'barrier': return at('misc/barrier');
    case 'site': return at('misc/site');
    case 'safehouse': return at('misc/safehouse');
    default: return null;
  }
}

/** Whether a picture is one of the system's default token art files (exactly one of them, not just under the folder). */
export function isDefaultArt(src: string | null | undefined): boolean {
  const s = String(src ?? '').trim().replace(/^\/+/, '');
  return s.startsWith(ART_ROOT) && artPathSet().has(s);
}

let ART_SET: Set<string> | null = null;
function artPathSet(): Set<string> { return (ART_SET ??= new Set(allArtPaths())); }

/** Every file `defaultArtFor` can return (for the tests and the deploy check). */
export function allArtPaths(): string[] {
  const out: string[] = [];
  for (const m of ART_METAS) for (const f of ART_FIGURES) for (const b of ['', ...ART_ARCHETYPES]) out.push(`people/${m}-${f}${b ? `-${b}` : ''}`);
  for (const c of [...ART_CRITTERS, 'critter']) out.push(`critters/${c}`);
  for (const s of ART_SPIRITS) out.push(`spirits/${s}`);
  for (const v of ART_VEHICLES) out.push(`vehicles/${v}`);
  for (const d of ['ground', 'rotor', 'wing', 'water']) out.push(`vehicles/drone-${d}`);
  for (const c of ['white', 'gray', 'black']) out.push(`matrix/ic-${c}`);
  out.push('matrix/host', 'misc/barrier', 'misc/site', 'misc/safehouse');
  return out.map((f) => `${ART_ROOT}${f}.svg`);
}
