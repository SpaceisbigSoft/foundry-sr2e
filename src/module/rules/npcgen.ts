/**
 * NPC generator (v0.52.0): pure functions that roll people, groups, organisations, contacts,
 * spirits, critters, fixers' jobs and street names at a Threat Level from 0 (no threat) to 5 (very,
 * very threatening). Nothing here is book data: archetypes are generic roles, and every number is a
 * table convenience in `RULES.NPCGEN` (VERIFY / house rules). The output is a plan (shown in the
 * preview), and `npcActorData` / `spiritActorData` turn a plan into actor and item data; the
 * cyberware, spells and powers go through the stat-block importer's tables (`statBlockItems`).
 */
import { RULES } from './config.ts';
import { parseStatBlock, statBlockItems, statBlockWarningCode, type StatBlockWarningCode } from './statblock.ts';
import * as D from './npcdata.ts';
import { generateSheaf } from './sheafgen.ts';
import { npcRatings } from './charfix.ts';
import { escHtml } from './html.ts';
import { own } from './util.ts';
import { t as tx, tCount } from '../helpers/i18n.ts';

type AttributeKey = 'body' | 'quickness' | 'strength' | 'charisma' | 'intelligence' | 'willpower';
const ATTRS: AttributeKey[] = ['body', 'quickness', 'strength', 'charisma', 'intelligence', 'willpower'];

// ---------------------------------------------------------------- Random numbers

/** A seeded random source returning [0, 1) (mulberry32), so a preview can be rolled again the same way. */
export type Rng = () => number;
export function makeRng(seed: number): Rng {
  let a = (Math.floor(seed) >>> 0) || 0x9e3779b9;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const int = (r: Rng, lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));
const pick = <T>(list: readonly T[], r: Rng): T => D.pick(list, r);
const chance = (r: Rng, p: number) => r() < p;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const clampThreat = (t: number) => clamp(Math.round(Number(t) || 0), 0, 5);
export const threatRow = (t: number) => RULES.NPCGEN.threat[clampThreat(t)]!;

/** A weighted pick from {id: weight}. */
export function weighted(weights: Record<string, number>, r: Rng): string {
  const entries = Object.entries(weights).filter(([, w]) => w > 0);
  const total = entries.reduce((a, [, w]) => a + w, 0);
  let x = r() * total;
  for (const [id, w] of entries) { if ((x -= w) < 0) return id; }
  return entries.at(-1)?.[0] ?? 'human';
}

// ---------------------------------------------------------------- Archetypes

export type MagicKind = 'none' | 'hermetic' | 'shamanic' | 'adept';
type SkillSpec = [name: string, attribute: AttributeKey, offset: number, specialization?: string];

export interface Archetype {
  id: string;
  label: string;
  /** Attribute offsets from the Threat Level's base. */
  attrs: Partial<Record<AttributeKey, number>>;
  /** Active skills: offset from the Threat Level's skill rating. */
  skills: SkillSpec[];
  /** Knowledge skills (offset from the skill rating). */
  knowledge?: SkillSpec[];
  /** Weapon and armor item-template ids by gear tier 0–5. */
  weapons: string[][];
  armor: string[][];
  /** Cyberware in stat-block words, by cyber tier 0–4 (before mages drop it). */
  cyber: string[][];
  magic: MagicKind | 'chance';
  /** Spell themes for magicians. */
  spellThemes?: Array<'combat' | 'defense' | 'detection' | 'illusion' | 'manipulation'>;
  gear?: string[];
  /** Uses a street name. */
  street: boolean;
  /** Has a deck / a control rig (extra gear). */
  decker?: boolean;
  rigger?: boolean;
}

const SAM_CYBER = [[], ['Cybereyes (low-light)'], ['Smartlink', 'Cybereyes (low-light)'], ['Wired Reflexes 1', 'Smartlink', 'Cybereyes (low-light)'], ['Wired Reflexes 2', 'Smartlink', 'Dermal Plating 1', 'Cybereyes (low-light, thermographic)']];
const LIGHT_CYBER = [[], [], ['Cybereyes (low-light)'], ['Smartlink'], ['Smartlink', 'Boosted Reflexes 1']];

/** Generic roles (no book stat blocks): the generator's people. */
export const ARCHETYPES: Archetype[] = [
  { id: 'ganger', label: 'Ganger', street: true, magic: 'chance', attrs: { quickness: 1, strength: 0, charisma: -1, intelligence: -1, willpower: -1 },
    skills: [['Firearms', 'quickness', 0, 'Pistols'], ['Edged Weapons', 'strength', 0], ['Unarmed Combat', 'strength', 0], ['Bike', 'reaction' as any, -1], ['Etiquette', 'charisma', -1, 'Street'], ['Stealth', 'quickness', -1]],
    knowledge: [['Gang Turf', 'intelligence', 0]],
    weapons: [['club'], ['knife', 'lightPistol'], ['knife', 'heavyPistol'], ['knife', 'smg'], ['sword', 'heavyPistol', 'offensiveGrenade'], ['sword', 'assaultRifle', 'heavyPistol']],
    armor: [[], ['armorClothing'], ['armorClothing'], ['armorVest'], ['armorJacket'], ['armorJacket']],
    cyber: [[], ['Retractable spurs'], ['Cybereyes (low-light)', 'Retractable spurs'], ['Smartlink', 'Retractable spurs'], ['Wired Reflexes 1', 'Smartlink', 'Retractable spurs']] },
  { id: 'thug', label: 'Street muscle', street: true, magic: 'chance', attrs: { body: 1, strength: 1, charisma: -1, intelligence: -1 },
    skills: [['Unarmed Combat', 'strength', 1], ['Clubs', 'strength', 0], ['Firearms', 'quickness', -1, 'Pistols'], ['Etiquette', 'charisma', -1, 'Street']],
    weapons: [['club'], ['club', 'holdout'], ['club', 'lightPistol'], ['stunBaton', 'heavyPistol'], ['stunBaton', 'shotgun'], ['sword', 'shotgun', 'heavyPistol']],
    armor: [[], ['armorClothing'], ['armorVest'], ['armorVest'], ['armorJacket'], ['armorJacket']],
    cyber: [[], [], ['Dermal Plating 1'], ['Dermal Plating 1', 'Muscle Replacement 1'], ['Dermal Plating 2', 'Muscle Replacement 2', 'Boosted Reflexes 1']] },
  { id: 'guard', label: 'Corporate security guard', street: false, magic: 'chance', attrs: { body: 1, willpower: 0, charisma: -1 },
    skills: [['Firearms', 'quickness', 0, 'Pistols'], ['Clubs', 'strength', 0], ['Unarmed Combat', 'strength', -1], ['Etiquette', 'charisma', -2, 'Corporate']],
    knowledge: [['Security Procedures', 'intelligence', 0]],
    weapons: [['club'], ['lightPistol', 'club'], ['heavyPistol', 'stunBaton'], ['smg', 'stunBaton'], ['assaultRifle', 'heavyPistol', 'stunBaton'], ['assaultRifle', 'heavyPistol', 'flashGrenade']],
    armor: [['armorClothing'], ['armorVest'], ['armorVest', 'helmet'], ['armorJacket', 'helmet'], ['armorJacket', 'helmet'], ['formFitting', 'armorJacket', 'helmet']],
    cyber: LIGHT_CYBER },
  { id: 'elite', label: 'Elite security operative', street: false, magic: 'chance', attrs: { body: 1, quickness: 1, strength: 0, willpower: 1 },
    skills: [['Firearms', 'quickness', 1, 'Assault rifles'], ['Unarmed Combat', 'strength', 0], ['Throwing Weapons', 'quickness', -1], ['Stealth', 'quickness', -1], ['Athletics', 'body' as any, -1]],
    knowledge: [['Small Unit Tactics', 'intelligence', 0]],
    weapons: [['heavyPistol'], ['smg'], ['smg', 'heavyPistol'], ['assaultRifle', 'heavyPistol', 'flashGrenade'], ['assaultRifle', 'heavyPistol', 'offensiveGrenade'], ['assaultRifle', 'sniperRifle', 'heavyPistol', 'offensiveGrenade']],
    armor: [['armorVest'], ['armorJacket'], ['armorJacket', 'helmet'], ['formFitting', 'armorJacket', 'helmet'], ['formFitting', 'armorJacket', 'helmet'], ['formFitting', 'armorJacket', 'helmet']],
    cyber: SAM_CYBER },
  { id: 'merc', label: 'Mercenary soldier', street: true, magic: 'chance', attrs: { body: 1, quickness: 1, willpower: 0 },
    skills: [['Firearms', 'quickness', 1, 'Assault rifles'], ['Gunnery', 'quickness', -1], ['Throwing Weapons', 'quickness', 0], ['Unarmed Combat', 'strength', 0], ['Demolitions', 'intelligence', -2], ['Stealth', 'quickness', -1]],
    knowledge: [['Military Theory', 'intelligence', -1]],
    weapons: [['lightPistol'], ['smg'], ['assaultRifle'], ['assaultRifle', 'heavyPistol', 'offensiveGrenade'], ['assaultRifle', 'lmg', 'offensiveGrenade'], ['assaultRifle', 'missileLauncher', 'heavyPistol', 'offensiveGrenade']],
    armor: [['armorVest'], ['armorJacket'], ['armorJacket', 'helmet'], ['armorJacket', 'helmet'], ['formFitting', 'armorJacket', 'helmet'], ['formFitting', 'armorJacket', 'helmet']],
    cyber: SAM_CYBER },
  { id: 'decker', label: 'Decker', street: true, magic: 'none', decker: true, attrs: { intelligence: 2, willpower: 1, strength: -1, body: -1 },
    skills: [['Computer', 'intelligence', 1], ['Electronics', 'intelligence', 0], ['Firearms', 'quickness', -2, 'Pistols'], ['Etiquette', 'charisma', -2, 'Matrix']],
    knowledge: [['Matrix Systems', 'intelligence', 0]],
    weapons: [[], ['holdout'], ['lightPistol'], ['lightPistol'], ['heavyPistol'], ['heavyPistol']],
    armor: [[], ['armorClothing'], ['armorClothing'], ['armorClothing'], ['armorVest'], ['armorVest']],
    cyber: [['Datajack'], ['Datajack'], ['Datajack', 'Headware Memory 50'], ['Datajack', 'Encephalon 1'], ['Datajack', 'Encephalon 1', 'Boosted Reflexes 1']] },
  { id: 'rigger', label: 'Rigger', street: true, magic: 'none', rigger: true, attrs: { quickness: 1, intelligence: 1, strength: -1 },
    skills: [['Car', 'reaction' as any, 1], ['Rotor Aircraft', 'reaction' as any, -1], ['Gunnery', 'quickness', 0], ['Electronics', 'intelligence', 0], ['Firearms', 'quickness', -2, 'Pistols']],
    knowledge: [['Vehicle Tuning', 'intelligence', 0]],
    weapons: [[], ['lightPistol'], ['lightPistol'], ['heavyPistol'], ['heavyPistol', 'smg'], ['heavyPistol', 'smg']],
    armor: [[], ['armorClothing'], ['armorVest'], ['armorVest'], ['armorJacket'], ['armorJacket']],
    cyber: [['Datajack'], ['Datajack', 'Control Rig 1'], ['Datajack', 'Control Rig 1'], ['Datajack', 'Control Rig 2'], ['Datajack', 'Control Rig 3', 'Smartlink']] },
  { id: 'mage', label: 'Street mage', street: true, magic: 'hermetic', spellThemes: ['combat', 'combat', 'defense', 'detection', 'illusion', 'manipulation'], attrs: { intelligence: 1, willpower: 2, charisma: 0, strength: -1 },
    skills: [['Sorcery', 'willpower', 1], ['Conjuring', 'willpower', -1], ['Firearms', 'quickness', -2, 'Pistols'], ['Etiquette', 'charisma', -1, 'Street']],
    knowledge: [['Magical Theory', 'intelligence', 0]],
    weapons: [[], ['holdout'], ['lightPistol'], ['lightPistol'], ['heavyPistol'], ['heavyPistol']],
    armor: [[], ['armorClothing'], ['armorClothing'], ['armorVest'], ['armorJacket'], ['armorJacket']], cyber: [[], [], [], [], []] },
  { id: 'shaman', label: 'Street shaman', street: true, magic: 'shamanic', spellThemes: ['combat', 'defense', 'detection', 'illusion', 'manipulation'], attrs: { charisma: 2, willpower: 1, intelligence: 0, quickness: -1 },
    skills: [['Conjuring', 'charisma', 1], ['Sorcery', 'willpower', 0], ['Edged Weapons', 'strength', -1], ['Etiquette', 'charisma', 0, 'Street']],
    knowledge: [['Magical Theory', 'intelligence', -1]],
    weapons: [['knife'], ['knife'], ['knife', 'lightPistol'], ['knife', 'lightPistol'], ['knife', 'heavyPistol'], ['knife', 'heavyPistol']],
    armor: [[], ['armorClothing'], ['armorClothing'], ['armorVest'], ['armorVest'], ['armorJacket']], cyber: [[], [], [], [], []] },
  { id: 'adept', label: 'Physical adept', street: true, magic: 'adept', attrs: { quickness: 2, body: 1, strength: 1, willpower: 0, charisma: -1 },
    skills: [['Unarmed Combat', 'strength', 1], ['Edged Weapons', 'strength', 0], ['Athletics', 'body' as any, 0], ['Stealth', 'quickness', 0], ['Throwing Weapons', 'quickness', -1]],
    weapons: [[], ['knife'], ['sword'], ['sword', 'throwingKnife'], ['sword', 'throwingKnife', 'heavyPistol'], ['sword', 'throwingKnife', 'heavyPistol']],
    armor: [[], ['armorClothing'], ['armorClothing'], ['armorVest'], ['armorVest'], ['armorJacket']], cyber: [[], [], [], [], []] },
  { id: 'face', label: 'Face', street: true, magic: 'chance', attrs: { charisma: 2, intelligence: 1, body: -1, strength: -1 },
    skills: [['Negotiation', 'charisma', 1], ['Etiquette', 'charisma', 1, 'Street'], ['Leadership', 'charisma', 0], ['Firearms', 'quickness', -1, 'Pistols'], ['Stealth', 'quickness', -1]],
    knowledge: [['Corporate Politics', 'intelligence', 0]],
    weapons: [[], ['holdout'], ['lightPistol'], ['heavyPistol'], ['heavyPistol'], ['heavyPistol', 'taser']],
    armor: [[], ['armorClothing'], ['armorClothing'], ['armorClothing'], ['armorVest'], ['armorVest']],
    cyber: [[], [], ['Tailored Pheromones 1'], ['Tailored Pheromones 1', 'Datajack'], ['Tailored Pheromones 2', 'Datajack', 'Cybereyes (low-light)']] },
  { id: 'suit', label: 'Corporate executive', street: false, magic: 'none', attrs: { charisma: 1, intelligence: 1, body: -1, quickness: -1, strength: -1 },
    skills: [['Negotiation', 'charisma', 1], ['Etiquette', 'charisma', 1, 'Corporate'], ['Leadership', 'charisma', 0], ['Computer', 'intelligence', -1]],
    knowledge: [['Corporate Finance', 'intelligence', 1], ['Corporate Politics', 'intelligence', 0]],
    weapons: [[], [], ['holdout'], ['holdout'], ['lightPistol'], ['lightPistol']],
    armor: [['armorClothing'], ['armorClothing'], ['armorClothing'], ['armorClothing'], ['armorClothing'], ['armorClothing']],
    cyber: [[], ['Datajack'], ['Datajack', 'Headware Memory 50'], ['Datajack', 'Tailored Pheromones 1'], ['Datajack', 'Tailored Pheromones 2', 'Encephalon 1']] },
  { id: 'cop', label: 'City cop', street: false, magic: 'chance', attrs: { body: 1, willpower: 1 },
    skills: [['Firearms', 'quickness', 0, 'Pistols'], ['Clubs', 'strength', 0], ['Unarmed Combat', 'strength', 0], ['Car', 'reaction' as any, -1], ['Interrogation', 'charisma', -1], ['Etiquette', 'charisma', -1, 'Street']],
    knowledge: [['Law Enforcement', 'intelligence', 0]],
    weapons: [['club'], ['heavyPistol', 'club'], ['heavyPistol', 'stunBaton'], ['heavyPistol', 'stunBaton', 'shotgun'], ['smg', 'heavyPistol', 'stunBaton'], ['assaultRifle', 'heavyPistol', 'flashGrenade']],
    armor: [['armorClothing'], ['armorVest'], ['armorVest', 'helmet'], ['armorJacket', 'helmet'], ['armorJacket', 'helmet'], ['formFitting', 'armorJacket', 'helmet']],
    cyber: LIGHT_CYBER },
  { id: 'tech', label: 'Technician', street: true, magic: 'none', attrs: { intelligence: 2, quickness: 0, charisma: -1 },
    skills: [['Electronics', 'intelligence', 1], ['Computer', 'intelligence', 0], ['Car B/R', 'intelligence', 0], ['Firearms', 'quickness', -2, 'Pistols']],
    knowledge: [['Security Systems', 'intelligence', 0]],
    weapons: [[], [], ['lightPistol'], ['lightPistol'], ['heavyPistol'], ['heavyPistol']],
    armor: [[], [], ['armorClothing'], ['armorClothing'], ['armorVest'], ['armorVest']],
    cyber: [[], ['Datajack'], ['Datajack', 'Cybereyes (low-light)'], ['Datajack', 'Cybereyes (low-light, flare compensation)'], ['Datajack', 'Encephalon 1', 'Cybereyes (low-light, thermographic)']] },
  { id: 'doc', label: 'Street doc', street: true, magic: 'chance', attrs: { intelligence: 2, willpower: 1, strength: -1 },
    skills: [['Biotech', 'intelligence', 1], ['Computer', 'intelligence', -1], ['Negotiation', 'charisma', -1], ['Firearms', 'quickness', -2, 'Pistols']],
    knowledge: [['Cybersurgery', 'intelligence', 1]], gear: ['medkit'],
    weapons: [[], [], ['holdout'], ['lightPistol'], ['lightPistol'], ['heavyPistol']],
    armor: [[], [], ['armorClothing'], ['armorClothing'], ['armorClothing'], ['armorVest']],
    cyber: [[], [], ['Cybereyes (low-light)'], ['Datajack', 'Cybereyes (low-light)'], ['Datajack', 'Encephalon 1', 'Cybereyes (low-light)']] },
  { id: 'fixer', label: 'Fixer', street: true, magic: 'none', attrs: { charisma: 1, intelligence: 2, body: -1 },
    skills: [['Negotiation', 'charisma', 2], ['Etiquette', 'charisma', 1, 'Street'], ['Firearms', 'quickness', -1, 'Pistols'], ['Computer', 'intelligence', -1]],
    knowledge: [['Shadow Jobs', 'intelligence', 1], ['Street Prices', 'intelligence', 0]],
    weapons: [[], ['holdout'], ['lightPistol'], ['heavyPistol'], ['heavyPistol'], ['heavyPistol']],
    armor: [[], ['armorClothing'], ['armorClothing'], ['armorVest'], ['armorVest'], ['armorJacket']],
    cyber: [[], ['Datajack'], ['Datajack', 'Headware Memory 50'], ['Datajack', 'Encephalon 1'], ['Datajack', 'Encephalon 1', 'Tailored Pheromones 1']] },
  { id: 'smuggler', label: 'Smuggler', street: true, magic: 'chance', attrs: { quickness: 1, intelligence: 1 },
    skills: [['Car', 'reaction' as any, 1], ['Firearms', 'quickness', 0, 'SMGs'], ['Negotiation', 'charisma', 0], ['Stealth', 'quickness', -1]],
    knowledge: [['Smuggling Routes', 'intelligence', 1]],
    weapons: [['knife'], ['lightPistol'], ['heavyPistol'], ['smg'], ['smg', 'heavyPistol'], ['assaultRifle', 'heavyPistol']],
    armor: [[], ['armorClothing'], ['armorVest'], ['armorVest'], ['armorJacket'], ['armorJacket']],
    cyber: [[], [], ['Datajack'], ['Datajack', 'Control Rig 1'], ['Datajack', 'Control Rig 2', 'Smartlink']], rigger: false },
  { id: 'bartender', label: 'Bartender', street: true, magic: 'none', attrs: { charisma: 1, body: 0 },
    skills: [['Etiquette', 'charisma', 1, 'Street'], ['Negotiation', 'charisma', 0], ['Clubs', 'strength', -1], ['Firearms', 'quickness', -2, 'Shotguns']],
    knowledge: [['Local Rumours', 'intelligence', 1]],
    weapons: [[], ['club'], ['club', 'shotgun'], ['club', 'shotgun'], ['club', 'shotgun'], ['club', 'shotgun']],
    armor: [[], [], ['armorClothing'], ['armorClothing'], ['armorVest'], ['armorVest']], cyber: [[], [], [], ['Cybereyes (low-light)'], ['Cybereyes (low-light)', 'Dermal Plating 1']] },
  { id: 'talismonger', label: 'Talismonger', street: true, magic: 'shamanic', spellThemes: ['detection', 'defense', 'illusion'], attrs: { intelligence: 1, charisma: 1, willpower: 1, strength: -1 },
    skills: [['Negotiation', 'charisma', 0], ['Sorcery', 'willpower', -1], ['Enchanting', 'intelligence', 1]],
    knowledge: [['Magical Theory', 'intelligence', 1], ['Talismans', 'intelligence', 1]],
    weapons: [[], ['knife'], ['knife'], ['knife', 'lightPistol'], ['knife', 'lightPistol'], ['knife', 'heavyPistol']],
    armor: [[], [], ['armorClothing'], ['armorClothing'], ['armorClothing'], ['armorVest']], cyber: [[], [], [], [], []] },
];
export const archetype = (id: string): Archetype => ARCHETYPES.find((a) => a.id === id) ?? ARCHETYPES[0]!;

// v0.58.0: vehicle skills link to Reaction (the sheet takes it now); anything else unknown falls to Body.
const linkAttr = (a: string): AttributeKey | 'reaction' => (ATTRS.includes(a as AttributeKey) ? (a as AttributeKey) : a === 'reaction' ? 'reaction' : 'body');

// ---------------------------------------------------------------- Spells and adept powers (names the importer knows)

const SPELLS: Record<string, string[]> = {
  combat: ['Manabolt', 'Stunbolt', 'Powerbolt', 'Stunball', 'Manaball', 'Fireball', 'Lightning Bolt', 'Sleep'],
  defense: ['Armor', 'Heal', 'Treat', 'Increase Reflexes', 'Stabilize'],
  detection: ['Detect Enemies', 'Clairvoyance', 'Mind Probe', 'Analyze Truth', 'Combat Sense', 'Detect Life'],
  illusion: ['Invisibility', 'Confusion', 'Silence', 'Mask', 'Chaos', 'Stealth'],
  manipulation: ['Levitate', 'Magic Fingers', 'Physical Barrier', 'Control Thoughts', 'Light', 'Shadow'],
};
const ADEPT_POWERS: Array<[name: string, cost: number, rated: boolean]> = [
  ['Improved Reflexes', 1, true], ['Killing Hands', 1, false], ['Combat Sense', 1, true], ['Pain Resistance', 0.5, true],
  ['Enhanced Perception', 0.5, true], ['Mystic Armor', 0.5, true], ['Rapid Healing', 0.5, true], ['Missile Parry', 1, false],
  ['Quick Draw', 0.5, false], ['Great Leap', 0.5, false], ['Astral Perception', 2, false], ['Distance Strike', 1, false],
];

/** An adept power's power point cost as the stat-block importer sets it (the cost the sheet shows). */
export function adeptPowerCost(name: string, rating: number): number {
  const parsed = parseStatBlock(`B Q S C I W\n1 1 1 1 1 1\nAdept Powers: ${name}${rating ? ` ${rating}` : ''}`);
  const item = statBlockItems(parsed, { adept: true }).items.find((i) => i.type === 'adeptpower');
  const cost = Number(item?.system['cost'] ?? NaN);
  return Number.isFinite(cost) ? cost : (ADEPT_POWERS.find((p) => p[0] === name)?.[1] ?? 1) * Math.max(1, rating);
}

// ---------------------------------------------------------------- People

export interface PlanSkill { name: string; rating: number; attribute: AttributeKey | 'reaction'; kind: 'active' | 'knowledge' | 'language' | 'buildRepair'; specialization?: string; specializationRating?: number }

/** One generated person: what the preview shows and what Create makes. */
export interface NpcPlan {
  kind: 'npc';
  /** v0.73.0 (O35): Threat Rating (adds to Combat Pool); 0 or absent = none. */
  threatRating?: number;
  name: string;
  streetName: string;
  realName: string;
  archetype: string;
  role: string;
  threat: number;
  metatype: string;
  attributes: Record<AttributeKey, number>;
  magic: number;
  tradition: 'none' | 'hermetic' | 'shamanic' | 'adept';
  skills: PlanSkill[];
  weapons: string[];
  armor: string[];
  gear: string[];
  cyber: string[];
  spells: Array<{ name: string; force: number }>;
  adeptPowers: Array<{ name: string; rating: number }>;
  professionalRating: number;
  karmaPool: number;
  nuyen: number;
  /** >1: a grunt group on one sheet. */
  grunts: number;
  description: string;
  notes: string;
  deck?: { mpcp: number; programs: number };
  controlRig?: number;
  /** v0.61.0: a shamanic NPC's totem (the character sheet's totem fields). */
  totem?: PlanTotem;
  /** v0.61.0: a rigger's (or anyone with a control rig's) vehicles and drones. */
  vehicles?: PlanVehicle[];
}

/** v0.61.0: a generated totem: dice by spell category and conjuring, environment, berserk, daylight TN. */
export interface PlanTotem {
  name: string; combat: number; detection: number; health: number; illusion: number; manipulation: number; conjuring: number;
  environment: string; inEnvironment: number; outEnvironment: number; spirits: string; berserk: '' | 'wounded' | 'combat'; daylightTn: number;
}

/** v0.61.0: a generated vehicle or drone (VehicleDataModel's stat names). */
export interface PlanVehicle {
  name: string; category: string; drone: boolean; handling: number; speed: number; accel: number; body: number; armor: number;
  signature: number; autonav: number; pilot: number; sensor: number;
}

export interface NpcOptions {
  threat: number;
  archetype?: string;
  metatype?: string;
  magic?: 'auto' | 'none' | 'yes';
  /** Name as a role ("Security guard") rather than a person. */
  role?: string;
  grunts?: number;
}

/** A person's name: first, street name, surname (one of them may be left out by the archetype). */
export function rollName(r: Rng, street: boolean): { name: string; streetName: string; realName: string } {
  const realName = `${pick(D.FIRST_NAMES, r)} ${pick(D.SURNAMES, r)}`;
  const streetName = street ? pick(D.STREET_NAMES, r) : '';
  if (!streetName) return { name: realName, streetName: '', realName };
  const [first, ...rest] = realName.split(' ');
  return { name: `${first} “${streetName}” ${rest.join(' ')}`, streetName, realName };
}

/** A one-paragraph description and private notes (motivation, secret). */
export function rollDescription(r: Rng, metatypeLabel: string, roleLabel: string): { description: string; notes: string } {
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  return {
    description: tx('SR2E.Text.Npcgen.description', { metatype: cap(metatypeLabel), role: roleLabel, appearance: cap(pick(D.APPEARANCE, r)), clothing: pick(D.CLOTHING, r), distinctive: cap(pick(D.DISTINCTIVE, r)), mannerism: cap(pick(D.MANNERISM, r)) }),
    notes: tx('SR2E.Text.Npcgen.wantsSecret', { motivation: pick(D.MOTIVATION, r), secret: pick(D.SECRET, r) }),
  };
}

/** Roll one person. */
export function generateNpc(opts: NpcOptions, r: Rng): NpcPlan {
  // The name and looks come from their own stream, rolled first: changing the Threat Level (which
  // changes how many spells or powers are rolled) keeps the same person.
  const looks = makeRng(Math.floor(r() * 4294967296));
  const t = clampThreat(opts.threat);
  const row = threatRow(t);
  const arch = archetype(opts.archetype ?? pick(ARCHETYPES.filter((a) => !['bartender', 'talismonger'].includes(a.id)), r).id);
  const metatype = opts.metatype && opts.metatype !== 'random' && RULES.METATYPES.types[opts.metatype] ? opts.metatype : weighted(RULES.NPCGEN.metatypes, r);
  // House rules can be any number: the generator works in whole points.
  const spread = Math.max(0, Math.floor(Number(RULES.NPCGEN.spread) || 0));
  const maxAttr = Math.max(1, Math.floor(Number(RULES.NPCGEN.maxAttribute) || 6));
  const maxSkill = Math.max(1, Math.floor(Number(RULES.NPCGEN.maxSkill) || 8));
  // Racial modifiers are added on the sheet: keep every total at 1 or more (a troll's Charisma).
  const racial = (k: AttributeKey) => Number((RULES.METATYPES.types[metatype]?.mods as Record<string, number> | undefined)?.[k] ?? 0);
  const attributes = Object.fromEntries(ATTRS.map((k) => [k, clamp(Math.round(row.attribute + (arch.attrs[k] ?? 0)) + int(r, -spread, spread), Math.max(1, 1 - racial(k)), Math.max(maxAttr, 1 - racial(k)))])) as Record<AttributeKey, number>;

  // Magic: the archetype's, or a chance for anyone who could be Awakened.
  let tradition: NpcPlan['tradition'] = 'none';
  if (opts.magic !== 'none') {
    if (arch.magic !== 'none' && arch.magic !== 'chance') tradition = arch.magic;
    else if (arch.magic === 'chance' && (opts.magic === 'yes' || chance(r, row.magicChance))) tradition = pick(['adept', 'adept', 'shamanic', 'hermetic'] as const, r);
  }
  const magic = tradition === 'none' ? 0 : clamp(row.magic + int(r, -spread, 0), 1, 6);

  // Skills.
  const skills: PlanSkill[] = [];
  const add = ([name, attr, off, spec]: SkillSpec, kind: PlanSkill['kind']) => {
    const rating = clamp(Math.round(row.skill + off) + int(r, -spread, spread), 1, maxSkill);
    const s: PlanSkill = { name, rating, attribute: linkAttr(attr), kind: /B\/R$/.test(name) ? 'buildRepair' : kind };
    if (spec && t >= 2) { s.specialization = spec; s.specializationRating = rating + 2; }
    skills.push(s);
  };
  for (const s of arch.skills) add(s, 'active');
  for (const s of arch.knowledge ?? []) add(s, 'knowledge');
  if (tradition !== 'none' && !arch.skills.some((s) => ['Sorcery', 'Conjuring'].includes(s[0]))) {
    if (tradition === 'adept') { if (!skills.some((s) => s.name === 'Unarmed Combat')) add(['Unarmed Combat', 'strength', 0], 'active'); }
    else { add(['Sorcery', 'willpower', 0], 'active'); add(['Conjuring', 'charisma', -1], 'active'); }
  }
  skills.push({ name: 'English', rating: clamp(row.skill + 1, 2, 6), attribute: 'intelligence', kind: 'language' });

  // Gear and cyberware by tier; magicians keep their Essence.
  const weapons = [...(arch.weapons[clamp(row.gear, 0, arch.weapons.length - 1)] ?? [])];
  const armor = [...(arch.armor[clamp(row.gear, 0, arch.armor.length - 1)] ?? [])];
  const cyberTier = clamp(row.cyber + int(r, -1, 0), 0, 4);
  // Magicians keep their Essence (and their Magic, under either Essence house rule): no cyberware.
  let cyber = tradition === 'none' ? [...(arch.cyber[cyberTier] ?? [])] : [];
  if (metatype !== 'human') cyber = cyber.filter((c) => !/cybereyes \(low-light\)$/i.test(c) || !(RULES.METATYPES.types[metatype]?.vision.lowLight));
  const gear = [...(arch.gear ?? [])];
  // Every weapon carried has its skill (at the archetype's weakest level), so nobody attacks by defaulting.
  for (const id of weapons) {
    const need = String(TEMPLATE(id)?.system['skill'] ?? '');
    if (!need || skills.some((s) => s.name === need)) continue;
    const low = Math.min(0, ...arch.skills.map((s) => s[2]));
    add([need, WEAPON_SKILL_ATTR[need] ?? 'quickness', low - 1], 'active');
  }

  // Spells and adept powers.
  const spells: NpcPlan['spells'] = [];
  const adeptPowers: NpcPlan['adeptPowers'] = [];
  if (tradition === 'hermetic' || tradition === 'shamanic') {
    const themes = arch.spellThemes ?? ['combat', 'defense', 'detection'];
    const used = new Set<string>();
    for (let i = 0; i < row.spells && i < 12; i++) {
      const pool = SPELLS[themes[i % themes.length]!]!.filter((s) => !used.has(s));
      if (!pool.length) continue;
      const name = pick(pool, r);
      used.add(name);
      spells.push({ name, force: clamp(row.force + int(r, -1, 0), 1, 8) });
    }
  } else if (tradition === 'adept') {
    let points = magic;
    const order = [...ADEPT_POWERS];
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [order[i], order[j]] = [order[j]!, order[i]!]; }
    for (const [name, , rated] of order) {
      // The importer's own power point costs, so the sheet agrees with the plan.
      let rating = rated ? clamp(Math.floor(points / Math.max(0.25, adeptPowerCost(name, 1)) / 2), 1, name === 'Improved Reflexes' ? 3 : 4) : 0;
      while (rating > 1 && adeptPowerCost(name, rating) > points) rating--;
      const spend = adeptPowerCost(name, rating);
      if (spend > points + 1e-9) continue;
      adeptPowers.push({ name, rating });
      points -= spend;
      if (points <= 0) break;
    }
  }

  const { name, streetName, realName } = rollName(looks, arch.street);
  const mt = RULES.METATYPES.types[metatype]?.label ?? tx('SR2E.Text.Npcgen.human');
  const roleLabel = opts.role || (tradition !== 'none' && arch.magic === 'chance' ? (tradition === 'adept' ? tx('SR2E.Text.Npcgen.roleAdept', { label: arch.label }) : tx('SR2E.Text.Npcgen.roleMagician', { label: arch.label })) : arch.label);
  const desc = rollDescription(looks, mt, roleLabel);
  // v0.61.0: totems and vehicles come from a stream of their own, derived after everything else,
  // so earlier seeded results are unchanged.
  const kit = makeRng(Math.floor(looks() * 4294967296));
  const plan: NpcPlan = {
    kind: 'npc', name, streetName, realName, archetype: arch.id, role: roleLabel, threat: t, metatype, attributes, magic, tradition,
    skills, weapons, armor, gear, cyber, spells, adeptPowers,
    // v0.73.0 (O35): Threat Rating, PR 1–4, no Karma Pool for grunts (RULES.CHARACTERS_V73.npcs).
    ...npcRatings({ threat: t, grunts: opts.grunts, tablePr: row.professionalRating, tableKarmaPool: row.karmaPool }), nuyen: Math.round(row.nuyen * (0.5 + r())),
    grunts: Math.max(1, Math.floor(opts.grunts ?? 1)), description: desc.description, notes: desc.notes,
  };
  if (arch.decker) plan.deck = { mpcp: clamp(3 + t, 3, 8), programs: clamp(2 + t, 2, 8) };
  if (arch.rigger || cyber.some((c) => /control rig/i.test(c))) plan.controlRig = Number(/control rig (\d)/i.exec(cyber.join(' '))?.[1] ?? 0);
  if (tradition === 'shamanic') { const totem = rollTotem(kit); if (totem) plan.totem = totem; }
  if (plan.controlRig !== undefined) { const vehicles = rollRiggerVehicles(t, kit); if (vehicles.length) plan.vehicles = vehicles; }
  return plan;
}

const NPC61 = () => RULES.SECURITY_V61.npc;
/** A finite number or 0. */
const num = (n: unknown): number => (Number.isFinite(Number(n)) ? Number(n) : 0);
const whole = (n: unknown, lo = 0): number => Math.max(lo, Math.floor(num(n)));

/** v0.61.0: a random totem from SECURITY_V61.npc.totems (null when the table is empty), sanitised. */
export function rollTotem(r: Rng): PlanTotem | null {
  const rows = (NPC61().totems ?? []).filter((t) => t && String(t.name ?? '').trim());
  if (!rows.length) return null;
  const t = pick(rows, r);
  const dice = (n: unknown) => Math.round(num(n));
  return {
    name: String(t.name).trim(), combat: dice(t.combat), detection: dice(t.detection), health: dice(t.health), illusion: dice(t.illusion),
    manipulation: dice(t.manipulation), conjuring: dice(t.conjuring), environment: String(t.environment ?? ''), inEnvironment: dice(t.inEnvironment),
    outEnvironment: dice(t.outEnvironment), spirits: String(t.spirits ?? ''), berserk: t.berserk === 'wounded' || t.berserk === 'combat' ? t.berserk : '',
    daylightTn: whole(t.daylightTn),
  };
}

/**
 * v0.61.0: a rigger's vehicles and drones at a Threat Level: SECURITY_V61.npc.riggerVehicles /
 * riggerDrones give how many, picked from the vehicles that Threat Level can own (minThreat).
 * Categories unknown to RULES.VEHICLES fall back to 'other'.
 */
export function rollRiggerVehicles(threat: number, r: Rng): PlanVehicle[] {
  const t = clampThreat(threat);
  const cfg = NPC61();
  const all = (cfg.vehicles ?? []).filter((v) => v && String(v.name ?? '').trim());
  const out: PlanVehicle[] = [];
  for (const drone of [false, true]) {
    const n = Math.min(12, whole((drone ? cfg.riggerDrones : cfg.riggerVehicles)?.[t]));
    const owned = all.filter((v) => Boolean(v.drone) === drone && num(v.minThreat) <= t);
    const pool = owned.length ? owned : all.filter((v) => Boolean(v.drone) === drone);
    for (let i = 0; i < n && pool.length; i++) out.push(planVehicle(pick(pool, r)));
  }
  return out;
}

function planVehicle(v: { name: string; category: string; drone: boolean; handling: number; speed: number; accel: number; body: number; armor: number; signature: number; autonav: number; pilot: number; sensor: number }): PlanVehicle {
  const category = RULES.VEHICLES.categories.some((c) => c.id === v.category) ? v.category : 'other';
  return {
    name: String(v.name ?? '').trim() || (v.drone ? 'Drone' : 'Vehicle'), category, drone: Boolean(v.drone),
    handling: whole(v.handling), speed: whole(v.speed), accel: whole(v.accel), body: whole(v.body), armor: whole(v.armor),
    signature: whole(v.signature), autonav: whole(v.autonav), pilot: whole(v.pilot), sensor: whole(v.sensor),
  };
}

/** v0.61.0: actor data (type vehicle) for a generated vehicle or drone, with VehicleDataModel's field names. */
export function vehicleActorData(v: PlanVehicle): { name: string; type: 'vehicle'; system: Record<string, unknown> } {
  const p = planVehicle((v ?? {}) as PlanVehicle);
  return {
    name: p.name, type: 'vehicle',
    system: { category: p.category, drone: p.drone, handling: p.handling, speed: p.speed, accel: p.accel, body: p.body, armor: p.armor,
      signature: p.signature, autonav: p.autonav, pilot: p.pilot, sensor: p.sensor },
  };
}

/** The plan as an SR2-style stat block (what the preview shows; the importer reads it back). */
export function statBlockText(p: NpcPlan): string {
  const mods = RULES.METATYPES.types[p.metatype]?.mods ?? {};
  const total = (k: AttributeKey) => p.attributes[k] + ((mods as any)[k] ?? 0);
  const head = ['B', 'Q', 'S', 'C', 'I', 'W', ...(p.magic ? ['M'] : [])];
  const vals = [...ATTRS.map((k) => String(total(k))), ...(p.magic ? [String(p.magic)] : [])];
  const width = (i: number) => Math.max(head[i]!.length, vals[i]!.length);
  const row = (cells: string[]) => cells.map((c, i) => c.padEnd(width(i))).join(' ');
  const active = p.skills.filter((s) => s.kind !== 'knowledge' && s.kind !== 'language');
  const skill = (s: PlanSkill) => `${s.name} ${s.rating}${s.specialization ? ` (${s.specialization} ${s.specializationRating})` : ''}`;
  const lines = [
    `${p.name}${p.grunts > 1 ? ` ×${p.grunts}` : ''}: ${p.role}${p.archetype.startsWith('critter:') ? '' : `, ${RULES.METATYPES.types[p.metatype]?.label ?? p.metatype}`}, Threat Level ${p.threat}`,
    row(head), row(vals),
    `Professional Rating: ${p.professionalRating}${p.threatRating ? ` · Threat Rating: ${p.threatRating}` : ''}${p.karmaPool ? ` · Karma Pool: ${p.karmaPool}` : ''}`,
    `Skills: ${active.map(skill).join(', ')}`,
  ];
  const know = p.skills.filter((s) => s.kind === 'knowledge' || s.kind === 'language');
  if (know.length) lines.push(`Knowledge: ${know.map(skill).join(', ')}`);
  if (p.cyber.length) lines.push(`Cyberware: ${p.cyber.join(', ')}`);
  if (p.spells.length) lines.push(`Spells: ${p.spells.map((s) => `${s.name} ${s.force}`).join(', ')}`);
  if (p.adeptPowers.length) lines.push(`Adept Powers: ${p.adeptPowers.map((s) => `${s.name}${s.rating ? ` ${s.rating}` : ''}`).join(', ')}`);
  const gear = [...p.weapons.map(templateName), ...p.armor.map(templateName), ...p.gear.map(templateName), ...(p.deck ? [`Cyberdeck (MPCP ${p.deck.mpcp}) with Attack and Sleaze ${p.deck.programs}`] : [])];
  if (gear.length) lines.push(`Gear: ${gear.join(', ')}`);
  if (p.tradition !== 'none') lines.push(`Tradition: ${p.tradition}`);
  if (p.totem) lines.push(`Totem: ${p.totem.name}`);
  if (p.vehicles?.length) lines.push(`Vehicles: ${p.vehicles.map((v) => `${v.name}${v.drone ? ' (drone)' : ''}`).join(', ')}`);
  lines.push(`Nuyen: ${p.nuyen.toLocaleString('en')}¥`);
  return lines.join('\n');
}

const TEMPLATE = (id: string) => RULES.ITEM_TEMPLATES.find((t) => t.id === id);
/** The highest RCD rating a generated NPC gets. */
const NPC_RCD_MAX_RATING = 4;
const WEAPON_SKILL_ATTR: Record<string, AttributeKey> = { 'Edged Weapons': 'strength', Clubs: 'strength', 'Polearms/Staffs': 'strength', 'Unarmed Combat': 'strength' };
export const templateName = (id: string): string => TEMPLATE(id)?.name ?? id;

export interface ActorItem { name: string; type: string; system: Record<string, unknown> }

/** The stat-block warnings `npcActorData` leaves out: the placeholder attribute row, Essence guesses, default drain. */
const QUIET_WARNINGS = new Set<StatBlockWarningCode | ''>(['noAttributeHeader', 'attributeHeaderNoValues', 'powerNoAttribute', 'critterPowerAttributes', 'essenceGuessed', 'essenceUnknown', 'drainNotGiven']);

/**
 * The actor and its items for a person (type npc). Cyberware, spells and adept powers go through
 * the stat-block importer's tables; weapons, armor and gear are copies of the item templates.
 */
export function npcActorData(p: NpcPlan): { actor: { name: string; type: string; system: Record<string, unknown>; prototypeToken: Record<string, unknown>; flags: Record<string, any> }; items: ActorItem[]; warnings: string[] } {
  const system: Record<string, unknown> = {
    metatype: p.metatype, racialModifiers: true, magic: p.magic, tradition: p.tradition,
    professionalRating: p.professionalRating, threatRating: p.threatRating ?? 0, nuyen: p.nuyen,
    karma: { good: 0, pool: p.karmaPool, poolSpent: 0, career: 0 },
    grunts: { size: Math.max(1, p.grunts), down: 0 },
    biography: `<p>${escHtml(p.description)}</p>`, notes: `<p>${escHtml(p.notes)}</p><p><em>${tx('SR2E.Text.Npcgen.generatedThreatLevel', { role: escHtml(p.role), threat: escHtml(p.threat) })}</em></p>`,
  };
  system['attributes'] = Object.fromEntries(ATTRS.map((k) => [k, { base: p.attributes[k], mod: 0 }]));
  if (p.totem) system['totem'] = { ...p.totem };
  const items: ActorItem[] = [];
  for (const s of p.skills) {
    items.push({ name: s.name, type: 'skill', system: { rating: s.rating, attribute: s.attribute, kind: s.kind,
      ...(s.specialization ? { specialization: s.specialization, specializationRating: s.specializationRating ?? s.rating + 2 } : {}) } });
  }
  for (const id of [...p.weapons, ...p.armor, ...p.gear]) {
    const tpl = TEMPLATE(id);
    if (tpl) items.push({ name: tpl.name, type: tpl.type, system: structuredClone(tpl.system) as Record<string, unknown> });
  }
  if (p.deck) {
    items.push({ name: `Cyberdeck (MPCP ${p.deck.mpcp})`, type: 'cyberdeck', system: { active: true, mpcp: p.deck.mpcp, bod: Math.ceil(p.deck.mpcp / 2), evasion: Math.ceil(p.deck.mpcp / 2), masking: Math.ceil(p.deck.mpcp / 2), sensors: Math.floor(p.deck.mpcp / 2), hardening: Math.floor(p.deck.mpcp / 3) } });
    for (const id of ['attackUtility', 'sleaze']) {
      const tpl = TEMPLATE(id);
      if (tpl) items.push({ name: tpl.name, type: tpl.type, system: { ...(structuredClone(tpl.system) as Record<string, unknown>), rating: p.deck.programs } });
    }
  }
  // A remote control deck for a control rig, or for drones (v0.81.0, RC-4: a low-Threat rigger has drones but no rig).
  const droneCount = (p.vehicles ?? []).filter((v) => v.drone).length;
  const rcdTpl = TEMPLATE('rcd');
  if (rcdTpl && (p.controlRig || droneCount)) {
    // v0.77.0: rating enough for the drones (one port per drone).
    const r = clamp(Math.max(p.controlRig ?? 0, Math.ceil(droneCount / Math.max(1, RULES.RIGGING.remote.dronesPerRating))), 1, NPC_RCD_MAX_RATING);
    // v0.81.0 (RC-13): cost per rating point from the RCD template. v0.92.3 (Rigger 2 p. 97): 5,000¥ × Rating, and the weight
    // is the template's whatever the rating (3).
    const sys = structuredClone(rcdTpl.system) as Record<string, unknown>;
    const base = Math.max(1, Number(sys['rcdRating']) || 1);
    items.push({ name: rcdTpl.name, type: rcdTpl.type, system: { ...sys, rcdRating: r, cost: Math.round((Number(sys['cost']) || 0) / base * r), weight: Number(sys['weight']) || 0 } });
  }
  // Cyberware, spells and powers in the importer's words.
  const block = ['B Q S C I W', '1 1 1 1 1 1',
    ...(p.cyber.length ? [`Cyberware: ${p.cyber.join(', ')}`] : []),
    ...(p.spells.length ? [`Spells: ${p.spells.map((s) => `${s.name} ${s.force}`).join(', ')}`] : []),
    ...(p.adeptPowers.length ? [`Adept Powers: ${p.adeptPowers.map((s) => `${s.name}${s.rating ? ` ${s.rating}` : ''}`).join(', ')}`] : [])].join('\n');
  const parsed = parseStatBlock(block);
  const extra = statBlockItems(parsed, { adept: p.tradition === 'adept' });
  items.push(...extra.items.map((i) => {
    // Adept powers the importer has no cost for get the generator's (what it planned against Magic).
    if (i.type === 'adeptpower' && !Number.isFinite(Number(i.system['cost']))) {
      const plan = p.adeptPowers.find((a) => a.name.toLowerCase() === i.name.toLowerCase());
      return { name: i.name, type: i.type, system: { ...i.system, cost: adeptPowerCost(i.name, plan?.rating ?? 0) } };
    }
    return { name: i.name, type: i.type, system: i.system };
  }));
  return {
    actor: { name: p.grunts > 1 ? `${p.name} (×${p.grunts})` : p.name, type: 'npc', system,
      prototypeToken: { name: p.grunts > 1 || p.archetype.startsWith('critter:') ? p.name : p.streetName || p.realName || p.name, actorLink: false },
      flags: { sr2e: { generated: { role: p.role, threat: p.threat, archetype: p.archetype } } } },
    // The block's placeholder attributes and the spells' default drain aren't worth a warning here (v0.89.6: by code).
    items, warnings: [...parsed.warnings.filter((w) => !QUIET_WARNINGS.has(statBlockWarningCode(parsed.warnings, w))),
      ...extra.warnings.filter((w) => !QUIET_WARNINGS.has(statBlockWarningCode(extra.warnings, w)))],
  };
}


// ---------------------------------------------------------------- Groups

export type GroupKind = 'gang' | 'security' | 'squad' | 'police' | 'bodyguards';
export const GROUP_KINDS: Array<{ id: GroupKind; label: string; grunt: string; leader: string }> = [
  { id: 'gang', label: 'Gang', grunt: 'ganger', leader: 'ganger' },
  { id: 'security', label: 'Security team', grunt: 'guard', leader: 'guard' },
  { id: 'squad', label: 'Mercenary squad', grunt: 'merc', leader: 'merc' },
  { id: 'police', label: 'Police patrol', grunt: 'cop', leader: 'cop' },
  { id: 'bodyguards', label: 'Bodyguard detail', grunt: 'elite', leader: 'elite' },
];

export interface GroupPlan {
  kind: 'group';
  groupKind: GroupKind;
  name: string;
  threat: number;
  size: number;
  description: string;
  leader: NpcPlan;
  /** The rank and file: one plan (a grunt group sheet), or one each. */
  grunts: NpcPlan[];
  /** Specialists (a magician, a decker, a heavy gunner, the person being guarded). */
  extras: NpcPlan[];
  /** Rank and file share one sheet. */
  oneSheet: boolean;
}

/** Roll a group: a leader a step tougher, the rank and file, and specialists by Threat Level. */
export function generateGroup(opts: { threat: number; groupKind: GroupKind; oneSheet?: boolean; metatype?: string }, r: Rng): GroupPlan {
  const t = clampThreat(opts.threat);
  const gk = GROUP_KINDS.find((g) => g.id === opts.groupKind) ?? GROUP_KINDS[0]!;
  const extraMax = own(RULES.NPCGEN.groupExtra, gk.id) ?? 2;
  const size = clamp(threatRow(t).group + int(r, 0, extraMax) - (gk.id === 'bodyguards' ? 3 : 0), 2, RULES.GRUNTS?.maxSize ?? 12);
  let name = gk.label;
  let description = '';
  if (gk.id === 'gang') {
    name = `The ${pick(D.GANG_ADJECTIVES, r)} ${pick(D.GANG_NOUNS, r)}`;
    description = tx('SR2E.Text.Npcgen.gangDescription', { theme: pick(D.GANG_THEMES, r), colours: pick(D.GANG_COLOURS, r) });
  } else description = tx('SR2E.Text.Npcgen.groupDescription', { label: gk.label, threat: t, level: threatRow(t).label.toLowerCase() });
  const meta = opts.metatype ?? 'random';
  const leader = generateNpc({ threat: Math.min(5, t + 1), archetype: gk.leader, metatype: meta, magic: 'auto', role: tx('SR2E.Text.Npcgen.groupLeader', { label: gk.label }) }, r);
  const extras: NpcPlan[] = [];
  const extra = (archetypeId: string, role: string, threat = t) => extras.push(generateNpc({ threat, archetype: archetypeId, metatype: meta, magic: archetypeId === 'mage' || archetypeId === 'shaman' || archetypeId === 'adept' ? 'auto' : 'none', role }, r));
  if (gk.id === 'gang') { if (t >= 2 && chance(r, 0.5)) extra('shaman', tx('SR2E.Text.Npcgen.gangShaman')); if (t >= 3 && chance(r, 0.5)) extra('adept', tx('SR2E.Text.Npcgen.gangEnforcer')); if (t >= 4) extra('decker', tx('SR2E.Text.Npcgen.gangDecker')); }
  if (gk.id === 'security') { if (t >= 2 && chance(r, 0.4 + 0.1 * t)) extra('mage', tx('SR2E.Text.Npcgen.securityMage')); if (t >= 3) extra('decker', tx('SR2E.Text.Npcgen.securityDecker')); if (t >= 4) extra('elite', tx('SR2E.Text.Npcgen.responseTeamSpecialist')); }
  if (gk.id === 'squad') { if (t >= 2 && chance(r, 0.5)) extra('mage', tx('SR2E.Text.Npcgen.combatMage')); if (t >= 3) extras.push({ ...generateNpc({ threat: t, archetype: 'merc', metatype: meta, magic: 'none', role: tx('SR2E.Text.Npcgen.heavyGunner') }, r), weapons: ['lmg', 'heavyPistol'] }); if (t >= 4) extra('rigger', tx('SR2E.Text.Npcgen.droneRigger')); }
  if (gk.id === 'police') { if (t >= 3 && chance(r, 0.5)) extra('mage', tx('SR2E.Text.Npcgen.policeMage')); }
  if (gk.id === 'bodyguards') extra('suit', 'The principal (protected)', Math.max(0, t - 2));
  // The leader and the rank and file make the group's size (at least two in the ranks); specialists come on top.
  const ranks = Math.max(2, size - 1);
  const oneSheet = opts.oneSheet !== false;
  const grunts = oneSheet
    ? [{ ...generateNpc({ threat: t, archetype: gk.grunt, metatype: meta, magic: 'none', role: tx('SR2E.Text.Npcgen.groupMember', { label: gk.label }) }, r), grunts: ranks }]
    : Array.from({ length: ranks }, () => generateNpc({ threat: t, archetype: gk.grunt, metatype: meta, magic: 'none', role: tx('SR2E.Text.Npcgen.groupMember', { label: gk.label }) }, r));
  if (oneSheet) grunts[0]!.name = `${name}: ${gk.id === 'gang' ? 'gangers' : 'members'}`;
  return { kind: 'group', groupKind: gk.id, name, threat: t, size: ranks + 1 + extras.filter((e) => !/principal/i.test(e.role)).length, description, leader, grunts, extras, oneSheet };
}

// ---------------------------------------------------------------- Organisations

export interface OrgPlan {
  kind: 'org';
  name: string;
  orgKind: string;
  corporation: boolean;
  industry: string;
  threat: number;
  scale: string;
  quirk: string;
  goal: string;
  hq: string;
  security: string;
  host: { code: string; value: number };
  people: NpcPlan[];
  contact: ContactPlan;
}

export const CORP_SCALE = ['a one-office local business', 'a small firm with a few dozen staff', 'a regional company', 'a national corporation', 'a multinational', 'a megacorporation'];
export const ORG_SCALE = ['a handful of people', 'a dozen or so members', 'a few dozen members and friends', 'a hundred or more across the city', 'a network across several cities', 'an organisation with reach everywhere'];
export const SECURITY = ['a lock and a bored doorman', 'a guard on each shift and cameras', 'guards, cameras, maglocks and a watcher spirit', 'a trained security team, a mage on call and a host with grey IC', 'elite response teams, wards, drones and black IC', 'everything money buys: elite teams, initiates, black IC and a response in minutes'];

/** Roll an organisation or corporation, with its leader, a face and a contact who knows it. */
export function generateOrg(opts: { threat: number; corporation?: boolean }, r: Rng): OrgPlan {
  const t = clampThreat(opts.threat);
  const corporation = opts.corporation ?? chance(r, 0.6);
  const industry = pick(D.INDUSTRIES, r);
  const name = corporation ? `${pick(D.CORP_PREFIXES, r)} ${pick(D.CORP_SUFFIXES, r)}` : `${pick(D.GANG_ADJECTIVES, r)} ${pick(D.GANG_NOUNS, r).replace(/s$/, '')} ${pick(['Network', 'Circle', 'Collective', 'Syndicate', 'Society', 'Union', 'Club'], r)}`;
  const leader = generateNpc({ threat: t, archetype: corporation ? 'suit' : pick(['fixer', 'face', 'smuggler'], r), magic: 'auto', role: corporation ? tx('SR2E.Text.Npcgen.executiveInCharge') : tx('SR2E.Text.Npcgen.leader') }, r);
  const face = generateNpc({ threat: Math.max(0, t - 1), archetype: corporation ? 'face' : 'fixer', magic: 'auto', role: corporation ? tx('SR2E.Text.Npcgen.fixerTheCompanyUses') : tx('SR2E.Text.Npcgen.goBetween') }, r);
  const head = generateNpc({ threat: Math.min(5, t + 1), archetype: t >= 3 ? 'elite' : 'guard', magic: 'auto', role: tx('SR2E.Text.Npcgen.headOfSecurity') }, r);
  return {
    kind: 'org', name, orgKind: corporation ? tx('SR2E.Text.Npcgen.corporationIndustry', { industry }) : pick(D.ORG_KINDS, r), corporation, industry, threat: t,
    scale: (corporation ? CORP_SCALE : ORG_SCALE)[t]!, quirk: pick(D.ORG_QUIRKS, r), goal: pick(D.ORG_GOALS, r), hq: pick(D.ORG_HQS, r),
    security: SECURITY[t]!, host: { code: RULES.NPCGEN.hostCode[t] ?? 'green', value: RULES.NPCGEN.hostValue[t] ?? 4 },
    people: [leader, face, head], contact: generateContact({ threat: t }, r),
  };
}

/** An organisation's host: security code and value, and subsystems that scale with the value (VERIFY). */
export function hostActorData(o: OrgPlan): { name: string; type: string; system: Record<string, unknown> } {
  const subs = Object.fromEntries(RULES.MATRIX.subsystems.map((k: string, i: number) => [k, clamp(Math.round(o.host.value * 1.6) + ((i % 3) - 1), 2, 20)]));
  // v0.71.0 (R9): a generated security sheaf (RULES.FIXES_V71.sheafOnGenerated), the same for the same organisation.
  const sheaf = RULES.FIXES_V71.sheafOnGenerated ? { sheaf: generateSheaf({ securityCode: o.host.code, securityValue: o.host.value, seed: `${o.name}|${o.host.code}|${o.host.value}` }) } : {};
  return { name: `${o.name} host`, type: 'host', system: { securityCode: o.host.code, securityValue: o.host.value, subsystems: subs, ...sheaf } };
}

// ---------------------------------------------------------------- Contacts

export interface ContactPlan {
  kind: 'contact';
  roleId: string;
  role: string;
  level: number;
  loyalty: number;
  skills: string;
  fee: number;
  npc: NpcPlan;
}

export function generateContact(opts: { threat: number; roleId?: string }, r: Rng): ContactPlan {
  const t = clampThreat(opts.threat);
  const role = D.CONTACT_ROLES.find((c) => c.id === opts.roleId) ?? pick(D.CONTACT_ROLES, r);
  const known = ARCHETYPES.some((a) => a.id === role.archetype);
  const npc = generateNpc({ threat: t, archetype: known ? role.archetype : 'face', magic: 'auto', role: role.label }, r);
  return {
    kind: 'contact', roleId: role.id, role: role.label, level: RULES.NPCGEN.contactLevel[t] ?? 1,
    loyalty: clamp(int(r, 1, 3) + Math.floor(t / 2), 1, 6), skills: role.skills, fee: Math.round(role.fee * (0.5 + t * 0.3)), npc,
  };
}

// ---------------------------------------------------------------- Spirits and critters

export interface SpiritPlan { kind: 'spirit'; name: string; spiritKind: 'nature' | 'elemental'; spiritType: string; element: string; force: number; threat: number; description: string }

const NATURE = ['hearth spirit', 'city spirit', 'field spirit', 'forest spirit', 'mountain spirit', 'desert spirit', 'river spirit', 'lake spirit', 'sea spirit', 'swamp spirit', 'storm spirit', 'wind spirit', 'mist spirit'];
const ELEMENTS = ['fire', 'water', 'air', 'earth'];

export function generateSpirit(opts: { threat: number; spiritKind?: 'nature' | 'elemental' }, r: Rng): SpiritPlan {
  const t = clampThreat(opts.threat);
  const spiritKind = opts.spiritKind ?? (chance(r, 0.5) ? 'nature' : 'elemental');
  const element = spiritKind === 'elemental' ? pick(ELEMENTS, r) : '';
  const spiritType = spiritKind === 'elemental' ? `${element} elemental` : pick(NATURE, r);
  const force = RULES.NPCGEN.spiritForce[t] ?? 3;
  const cap = spiritType.charAt(0).toUpperCase() + spiritType.slice(1);
  return { kind: 'spirit', name: `${cap} (Force ${force})`, spiritKind, spiritType, element, force, threat: t, description: tx('SR2E.Text.Npcgen.spiritDescription', { type: cap, flavour: pick(D.SPIRIT_FLAVOUR, r) }) };
}

export function spiritActorData(p: SpiritPlan): { actor: { name: string; type: string; system: Record<string, unknown>; prototypeToken: Record<string, unknown>; flags: Record<string, unknown> } } {
  return { actor: { name: p.name, type: 'spirit', system: { force: p.force, spiritKind: p.spiritKind, spiritType: p.spiritType, element: p.element, services: 0, materialized: true },
    prototypeToken: { name: p.spiritType, actorLink: false }, flags: { sr2e: { generated: { description: p.description, threat: p.threat } } } } };
}

/** Generic animals (no book critters): attributes before Threat Level, natural weapons, senses. */
export const CRITTERS: Array<{ id: string; label: string; attrs: Record<AttributeKey, number>; weapon: [string, number, string]; powers: string[]; minThreat: number; vision?: { lowLight?: boolean; thermographic?: boolean } }> = [
  { id: 'dog', label: 'Guard dog', attrs: { body: 3, quickness: 4, strength: 3, charisma: 1, intelligence: 2, willpower: 2 }, weapon: ['Bite', 0, 'M'], powers: ['Enhanced Senses (smell, hearing)'], minThreat: 0 },
  { id: 'wolf', label: 'Wolf', attrs: { body: 4, quickness: 5, strength: 4, charisma: 1, intelligence: 2, willpower: 3 }, weapon: ['Bite', 1, 'M'], powers: ['Enhanced Senses (smell, low-light vision)'], minThreat: 1, vision: { lowLight: true } },
  { id: 'cat', label: 'Big cat', attrs: { body: 5, quickness: 6, strength: 5, charisma: 1, intelligence: 2, willpower: 3 }, weapon: ['Claws', 2, 'M'], powers: ['Enhanced Senses (low-light vision, hearing)'], minThreat: 2, vision: { lowLight: true } },
  { id: 'bear', label: 'Bear', attrs: { body: 8, quickness: 4, strength: 8, charisma: 1, intelligence: 2, willpower: 4 }, weapon: ['Claws', 2, 'S'], powers: ['Enhanced Senses (smell)'], minThreat: 3 },
  { id: 'awakenedWolf', label: 'Awakened wolf', attrs: { body: 5, quickness: 6, strength: 5, charisma: 2, intelligence: 3, willpower: 4 }, weapon: ['Bite', 2, 'S'], powers: ['Enhanced Senses (smell, low-light vision)', 'Fear', 'Dual Natured'], minThreat: 4, vision: { lowLight: true } },
];

export function generateCritter(opts: { threat: number; critter?: string; grunts?: number }, r: Rng): NpcPlan {
  const t = clampThreat(opts.threat);
  const fits = CRITTERS.filter((c) => c.minThreat <= t);
  const c = CRITTERS.find((x) => x.id === opts.critter) ?? pick(fits.length ? fits : CRITTERS, r);
  const bonus = Math.max(0, t - c.minThreat);
  const attributes = Object.fromEntries(ATTRS.map((k) => [k, clamp(c.attrs[k] + (['body', 'quickness', 'strength'].includes(k) ? Math.floor(bonus / 2) : 0), 1, 12)])) as Record<AttributeKey, number>;
  return {
    kind: 'npc', name: c.label, streetName: '', realName: c.label, archetype: `critter:${c.id}`, role: c.label, threat: t, metatype: 'human',
    attributes, magic: 0, tradition: 'none',
    skills: [{ name: 'Unarmed Combat', rating: clamp(3 + Math.floor(t / 2), 2, 8), attribute: 'strength', kind: 'active' }],
    weapons: [], armor: [], gear: [], cyber: [], spells: [], adeptPowers: [],
    ...npcRatings({ threat: t, grunts: opts.grunts, tablePr: Math.min(5, 1 + t), tableKarmaPool: 0 }), nuyen: 0, grunts: Math.max(1, opts.grunts ?? 1),
    description: tx('SR2E.Text.Npcgen.critterDescription', { label: c.label, flavour: pick(D.CRITTER_FLAVOUR, r) }), notes: tx('SR2E.Text.Npcgen.naturalWeaponStrPowers', { weapon: c.weapon[0], power: c.weapon[1], level: c.weapon[2], powers: c.powers.join(', ') }),
  };
}

/** A critter's own items: its natural weapon and its powers (racial modifiers off: an animal). */
export function critterActorData(p: NpcPlan): ReturnType<typeof npcActorData> {
  const base = npcActorData(p);
  base.actor.system['racialModifiers'] = false;
  // A critter has no metatype: no racial modifiers or (meta)human maximums (see `usesMetatype`).
  base.actor.flags['sr2e'] = { ...(base.actor.flags['sr2e'] ?? {}), critter: true };
  const c = CRITTERS.find((x) => `critter:${x.id}` === p.archetype);
  if (c?.vision) base.actor.system['vision'] = { lowLight: Boolean(c.vision.lowLight), thermographic: Boolean(c.vision.thermographic) };
  if (c) {
    base.items.push({ name: c.weapon[0], type: 'weapon', system: { skill: 'Unarmed Combat', melee: true, reach: 0, damagePower: c.weapon[1], damageLevel: c.weapon[2], damageType: 'physical', strengthPower: true } });
    const parsed = parseStatBlock(`B Q S C I W\n1 1 1 1 1 1\nPowers: ${c.powers.join(', ')}`);
    base.items.push(...statBlockItems(parsed, {}).items.map((i) => ({ name: i.name, type: i.type, system: i.system })));
  }
  return base;
}

// ---------------------------------------------------------------- Jobs

export interface JobPlan {
  kind: 'job';
  title: string;
  threat: number;
  jobType: string;
  employer: string;
  johnson: NpcPlan;
  target: string;
  location: string;
  meeting: string;
  pay: number;
  complications: string[];
  twist: string;
  opposition: GroupPlan;
}

export type TargetKind = 'person' | 'vehicle' | 'data' | 'thing';

/**
 * v0.89.4 review: the job lists are translated in place (rules/texttables.ts), but targetKind and jobWants read their
 * English words: these copies are taken when the module loads, before any translation, and looked up by position.
 */
const JOB_TYPES_EN: readonly string[] = [...D.JOB_TYPES];
const JOB_TARGETS_EN: readonly string[] = [...D.JOB_TARGETS];
const englishOf = (list: readonly string[], en: readonly string[], s: string): string => en[list.indexOf(s)] ?? s;

/** What a job target is: a person, a vehicle, data or a thing (from its words). */
export function targetKind(target: string): TargetKind {
  const t = target.toLowerCase();
  if (/'s\b/.test(t) && !/\b(child)\b/.test(t)) return /notes|ledger|file|archive/.test(t) ? 'data' : 'thing';
  if (/\b(researcher|leader|exec|councillor|team|witness|mage|chief|child|patient|organiser|cop|politician|journalist|scientist|defector|hostage)\b/.test(t)) return 'person';
  if (/\b(vehicle|limousine|drone|car|truck|van)\b/.test(t)) return 'vehicle';
  if (/datachip|file|archive|database|notes|ledger|core|key|records|data\b/.test(t)) return 'data';
  return 'thing';
}

/** The kind of target a job wants (null: the job names its own, no separate target). */
export function jobWants(jobType: string): TargetKind[] | null {
  const j = jobType.toLowerCase();
  if (/sabotage|destroy|clear out|hunt|break up|squatter|convoy/.test(j)) return null;
  if (/extract|wetwork|bodyguard|rescue|track down|defector|threatening|protect|discredit|kidnap|frame|surveil/.test(j)) return ['person'];
  if (/vehicle/.test(j)) return ['vehicle'];
  if (/datasteal|paydata|records|evidence/.test(j)) return ['data'];
  return ['thing', 'data', 'vehicle'];
}

export function generateJob(opts: { threat: number }, r: Rng): JobPlan {
  const t = clampThreat(opts.threat);
  const [lo, hi] = RULES.NPCGEN.jobPay[t] ?? [1000, 3000];
  const pay = Math.round((lo + r() * (hi - lo)) / 100) * 100;
  const jobType = pick(D.JOB_TYPES, r);
  const johnson = generateNpc({ threat: t, archetype: pick(['suit', 'fixer', 'face'], r), magic: 'none', role: chance(r, 0.5) ? tx('SR2E.Text.Npcgen.mrJohnson') : tx('SR2E.Text.Npcgen.msJohnson') }, r);
  const complications: string[] = [];
  const nComp = clamp(Math.floor(t / 2) + int(r, 0, 1), 1, 3);
  while (complications.length < nComp) { const c = pick(D.JOB_COMPLICATIONS, r); if (!complications.includes(c)) complications.push(c); }
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const wants = jobWants(englishOf(D.JOB_TYPES, JOB_TYPES_EN, jobType));
  const fitting = wants ? D.JOB_TARGETS.filter((x) => wants.includes(targetKind(englishOf(D.JOB_TARGETS, JOB_TARGETS_EN, x)))) : [];
  const target = wants ? pick(fitting.length ? fitting : D.JOB_TARGETS, r) : '';
  return {
    kind: 'job', title: target ? tx('SR2E.Text.Npcgen.jobTitle', { job: cap(jobType), target }) : cap(jobType), threat: t, jobType, employer: pick(D.EMPLOYERS, r), johnson,
    target, location: pick(D.JOB_LOCATIONS, r), meeting: pick(D.MEETING_PLACES, r), pay, complications,
    twist: chance(r, 0.2 + 0.1 * t) ? pick(D.JOB_TWISTS, r) : '',
    opposition: generateGroup({ threat: t, groupKind: pick(['security', 'security', 'gang', 'squad', 'police'] as GroupKind[], r) }, r),
  };
}

// ---------------------------------------------------------------- Names

export function generateNames(n: number, r: Rng): Array<{ name: string; streetName: string; look: string }> {
  return Array.from({ length: clamp(Math.floor(n), 1, 50) }, () => {
    const nm = rollName(r, true);
    return { name: nm.realName, streetName: nm.streetName, look: `${pick(D.APPEARANCE, r)}; ${pick(D.DISTINCTIVE, r)}` };
  });
}

// ---------------------------------------------------------------- Text for journals and cards

/** A plan as HTML for a GM journal page or card (escaped). */
export function planHtml(p: NpcPlan | GroupPlan | OrgPlan | ContactPlan | SpiritPlan | JobPlan): string {
  const block = (n: NpcPlan) => `<pre class="sr2e-statblock">${escHtml(statBlockText(n))}</pre><p>${escHtml(n.description)}</p><p><em>${escHtml(n.notes)}</em></p>`;
  const inAll = (description: string, size: number) => tCount(size, 'SR2E.Text.Npcgen.descriptionInAll', { description });
  switch (p.kind) {
    case 'npc': return block(p);
    case 'group': return `<h2>${escHtml(p.name)}</h2><p>${inAll(escHtml(p.description), p.size)}</p><h3>${tx('SR2E.Text.Npcgen.leader')}</h3>${block(p.leader)}<h3>${tx('SR2E.Text.Npcgen.rankAndFile')}</h3>${p.grunts.map(block).join('')}${p.extras.length ? `<h3>${tx('SR2E.Text.Npcgen.specialists')}</h3>${p.extras.map(block).join('')}` : ''}`;
    case 'org': return `<h2>${escHtml(p.name)}</h2><p>${tx('SR2E.Text.Npcgen.orgSummary', { kind: `<strong>${escHtml(p.orgKind)}</strong>`, scale: escHtml(p.scale), threat: p.threat })}</p><ul><li>${tx('SR2E.Text.Npcgen.goal', { goal: escHtml(p.goal) })}</li><li>${tx('SR2E.Text.Npcgen.knownFor', { quirk: escHtml(p.quirk) })}</li><li>${tx('SR2E.Text.Npcgen.base', { hq: escHtml(p.hq) })}</li><li>${tx('SR2E.Text.Npcgen.security', { security: escHtml(p.security) })}</li><li>${tx('SR2E.Text.Npcgen.matrixHost', { code: escHtml(p.host.code), value: p.host.value })}</li></ul><h3>${tx('SR2E.Text.Npcgen.people')}</h3>${p.people.map((n) => `<h4>${tx('SR2E.Text.Npcgen.roleName', { role: escHtml(n.role), name: escHtml(n.name) })}</h4>${block(n)}`).join('')}<h3>${tx('SR2E.Text.Npcgen.whoKnowsThem')}</h3><p>${tx('SR2E.Text.Npcgen.contactLine', { name: escHtml(p.contact.npc.name), role: escHtml(p.contact.role), level: p.contact.level, loyalty: p.contact.loyalty })}</p>`;
    case 'contact': return `<h2>${tx('SR2E.Text.Npcgen.nameRole', { name: escHtml(p.npc.name), role: escHtml(p.role) })}</h2><p>${tx('SR2E.Text.Npcgen.contactLevelLoyaltyFee', { level: p.level, loyalty: p.loyalty, fee: p.fee, skills: escHtml(p.skills) })}</p>${block(p.npc)}`;
    case 'spirit': return `<h2>${escHtml(p.name)}</h2><p>${escHtml(p.description)}</p>`;
    case 'job': return `<h2>${escHtml(p.title)}</h2><ul><li>${tx('SR2E.Text.Npcgen.employer', { employer: escHtml(p.employer) })}</li><li>${tx('SR2E.Text.Npcgen.meet', { meeting: escHtml(p.meeting) })}</li><li>${p.target ? tx('SR2E.Text.Npcgen.theJobTargetAt', { job: escHtml(p.jobType), target: escHtml(p.target), location: escHtml(p.location) }) : tx('SR2E.Text.Npcgen.theJobAt', { job: escHtml(p.jobType), location: escHtml(p.location) })}</li><li>${tx('SR2E.Text.Npcgen.payEach', { pay: p.pay.toLocaleString('en') })}</li><li>${tx('SR2E.Text.Npcgen.complications', { list: p.complications.map(escHtml).join('; ') })}</li>${p.twist ? `<li>${tx('SR2E.Text.Npcgen.twistGm', { twist: escHtml(p.twist) })}</li>` : ''}</ul><h3>${tx('SR2E.Text.Npcgen.theJohnson')}</h3>${block(p.johnson)}<h3>${tx('SR2E.Text.Npcgen.opposition', { name: escHtml(p.opposition.name) })}</h3><p>${inAll(escHtml(p.opposition.description), p.opposition.size)}</p>`;
  }
}
