/**
 * v0.92.3 book alignment (conjuring, spirits, astral, initiation, allies and critters): pure functions. Each reads its
 * switch in RULES.SPIRITS_V923 (rules/config923/spirits.ts) and behaves the book way at the shipped value; the other
 * choice gives the v0.92.2 result.
 */
import { RULES, type DamageLevel } from './config.ts';
import { t as tx } from '../helpers/i18n.ts';

const S = () => RULES.SPIRITS_V923;
const whole = (v: unknown) => { const n = Math.floor(Number(v)); return Number.isFinite(n) ? n : 0; };
const LEVELS: readonly DamageLevel[] = ['L', 'M', 'S', 'D'];

// ---------------------------------------------------------------- Spirits and normal weapons

/**
 * Whether a manifest spirit's immunity to normal weapons counts against this weapon (Core p. 142): firearms, other
 * ranged weapons and explosions yes; melee, bows (not crossbows) and throwing weapons no. Always yes under 'v922'.
 */
export function spiritImmunityApplies(w: { melee?: boolean; blast?: boolean; thrown?: boolean; skill?: string; name?: string }): boolean {
  if (S().immunityScope !== 'book') return true;
  if (w.blast) return true;
  if (w.melee) return false;
  const skill = String(w.skill ?? '');
  if (w.thrown || /throw/i.test(skill)) return false;
  const bow = /(?:\b|long|short)bows?\b/i;
  const text = `${skill} ${String(w.name ?? '')}`;
  if (/crossbow/i.test(text)) return true;
  return !bow.test(text);
}

/**
 * A mundane attack on a manifest spirit (Core p. 142): the attacker rolls Willpower instead of the combat skill and
 * may add no Combat Pool, unless the weapon is magical (a focus, killing hands) or the spirit is vulnerable to it.
 * Spirits and critters attacking are not "characters" here (spirits fight spirits Force against Force).
 */
export function mundaneVsSpirit(o: { attackerType: string; targetType: string; materialized?: boolean; magical?: boolean; vulnerable?: boolean }): boolean {
  if (S().mundaneVsSpirits !== 'willpower') return false;
  if (o.targetType !== 'spirit' || o.materialized === false) return false;
  if (o.attackerType !== 'character' && o.attackerType !== 'npc') return false;
  return !o.magical && !o.vulnerable;
}

/** Conjuring in place of the resisting attribute against a spirit's attack (Core p. 143): the dice to roll, or 0. */
export function conjuringDefenseDice(o: { attackerType: string; conjuring: number; attribute: number; magic: number }): number {
  if (S().conjuringDefense !== 'on' || o.attackerType !== 'spirit' || !(o.magic > 0)) return 0;
  const c = Math.max(0, whole(o.conjuring));
  return c > Math.max(0, whole(o.attribute)) ? c : 0;
}

// ---------------------------------------------------------------- Banishing

/** Points taken off per net success band: the book 1 per 2 net successes (Core p. 143); v0.92.2 1 per net success. */
export function banishLoss(net: number): number {
  const per = Math.max(1, whole(S().banishPerPoint) || 1);
  return Math.floor(Math.max(0, whole(net)) / per);
}

/**
 * The spirit winning a banishing round (Core p. 143): the banisher loses 1 Magic per 2 net successes beyond theirs
 * ('book'); nothing under 'v922'.
 */
export function banishBackfire(banisherSuccesses: number, spiritSuccesses: number): number {
  if (S().banishBackfire !== 'book') return 0;
  const net = whole(spiritSuccesses) - whole(banisherSuccesses);
  return net > 0 ? Math.floor(net / 2) : 0;
}

/**
 * Lost Force or Magic from banishing comes back at 1 point per hour (Core p. 143): how many points have come back
 * after `hours`. Never under 'v922' (lost for good).
 */
export function banishRecovered(lost: number, hours: number): number {
  if (S().banishRecovery !== 'hourly') return 0;
  return Math.min(Math.max(0, whole(lost)), Math.max(0, Math.floor(Number(hours) || 0)));
}

// ---------------------------------------------------------------- Control contests

/**
 * A contest for a controlled spirit (Core p. 143), book way: the challenger rolls Conjuring vs Force + 2, the holder
 * Conjuring vs Force; the challenger wins with more successes and keeps the spirit's services. Taking an uncontrolled
 * spirit: as banishing, every 2 net successes one service. Null under 'v922' (the old banishing-style contest).
 */
export function controlChallengeTn(force: number, held: boolean): number | null {
  if (S().controlContest !== 'book') return null;
  return Math.max(RULES.MIN_TARGET_NUMBER, whole(force) + (held ? 2 : 0));
}

export function controlOutcome(o: { challenger: number; defender: number; held: boolean; servicesBefore: number }): { won: boolean; services: number } | null {
  if (S().controlContest !== 'book') return null;
  const net = whole(o.challenger) - whole(o.defender);
  if (o.held) return { won: net > 0, services: net > 0 ? Math.max(0, whole(o.servicesBefore)) : 0 };
  const services = net > 0 ? Math.floor(net / 2) : 0;
  return { won: services > 0, services };
}

// ---------------------------------------------------------------- True names

/**
 * Binding a free spirit by its true name (Grimoire pp. 78–79), book way: Conjuring vs Force + Spirit Energy, not
 * opposed; a single success binds it, it serves without counting services and costs no Karma. Null under 'v922'.
 */
export function trueNameBook(): boolean { return S().trueName === 'book'; }
export function trueNameTn(force: number, energy: number): number {
  return Math.max(RULES.MIN_TARGET_NUMBER, whole(force) + Math.max(0, whole(energy)));
}

// ---------------------------------------------------------------- Astral

/** The Astral Combat Pool (Core p. 147): (Intelligence + Willpower + Charisma) ÷ 2, + grade (Grimoire p. 91). */
export function astralCombatPool(o: { intelligence: number; willpower: number; charisma: number; grade?: number }): number {
  const base = Math.floor((whole(o.intelligence) + whole(o.willpower) + whole(o.charisma)) / 2);
  return Math.max(0, base + (S().astralGrade === 'book' ? Math.max(0, whole(o.grade)) : 0));
}

/** Initiates add their grade to their astral Reaction (Grimoire pp. 38, 91); 0 under 'v922'. */
export function astralGradeBonus(grade: number): number {
  return S().astralGrade === 'book' ? Math.max(0, whole(grade)) : 0;
}

/**
 * A magician's astral attack Damage Code (Astral Attack Table, Core p. 147), book way: unarmed (Charisma)L; with an
 * active weapon focus (Charisma + rating ÷ 2)M. Null under 'v922' (Charisma M, a focus adding dice only).
 */
export function astralMagicianDamage(o: { charisma: number; focusRating: number }): { power: number; level: DamageLevel; focus: boolean } | null {
  if (S().astralDamage !== 'book') return null;
  const f = Math.max(0, whole(o.focusRating));
  return f > 0 ? { power: whole(o.charisma) + Math.floor(f / 2), level: 'M', focus: true } : { power: whole(o.charisma), level: 'L', focus: false };
}

/**
 * A barrier that wins against an astral intruder hurts it (Core p. 148): (rating)L, +1 level per 2 net successes,
 * resisted with astral Body vs the rating. Null when the barrier didn't win or under 'v922'.
 */
export function barrierBacklash(o: { rating: number; barrierSuccesses: number; attackerSuccesses: number }): { power: number; level: DamageLevel } | null {
  if (S().barrierBacklash !== 'book') return null;
  const net = whole(o.barrierSuccesses) - whole(o.attackerSuccesses);
  if (net <= 0 || whole(o.rating) <= 0) return null;
  const step = Math.min(3, Math.floor(net / 2));
  return { power: whole(o.rating), level: LEVELS[step]! };
}

/** Astral tracking (Core p. 149): −2 TN when the Force is at most the tracker's Sorcery, +2 when higher; [] under 'v922'. */
export function trackingMods(force: number, sorcery: number): Array<{ id: string; label: string; value: number }> {
  if (S().tracking !== 'book' || !(whole(force) > 0)) return [];
  return whole(force) <= whole(sorcery)
    ? [{ id: 'forceWithinYourSorcery', label: tx('SR2E.Card.Mod.forceWithinYourSorcery'), value: -2 }]
    : [{ id: 'forceOverYourSorcery', label: tx('SR2E.Card.Mod.forceOverYourSorcery'), value: 2 }];
}

// ---------------------------------------------------------------- Initiation

/**
 * The grade the next initiation reaches. Book (Grimoire p. 38): the first initiation makes a Grade 0 initiate (no
 * Magic added: Magic + grade); the next Grade 1, and so on. 'v922': the first is Grade 1. `initiated` = already
 * an initiate (a Grade 0 initiate stores grade 0 and the `initiated` flag).
 */
export function nextInitiationGrade(grade: number, initiated: boolean): number {
  const g = Math.max(0, whole(grade));
  return S().gradeZero === 'book' && g === 0 && !initiated ? 0 : g + 1;
}

/**
 * Initiation's Good Karma (Grimoire p. 38): (6 + the new grade) × 3 alone or × 2 in a group, an ordeal taking
 * RULES.OCCULT.initiation.ordealReduction (0.5) off the multiplier; rounded down ('down') or up ('up', v0.92.2).
 */
export function roundInitiationKarma(raw: number): number {
  return Math.max(0, S().initiationRounding === 'down' ? Math.floor(raw + 1e-9) : Math.ceil(raw - 1e-9));
}

// ---------------------------------------------------------------- Allies

/**
 * An ally's Good Karma (Grimoire p. 70), book way: the first point of Force is bought with a Magic point; each
 * further point costs 5 × the current Force (5 × (1 + 2 + … + (Force − 1))), plus whatever the design adds
 * (attributes, skills, forms, sense link). Null under 'v922' (RULES.OCCULT.ally.karmaPerForce × Force).
 */
export function allyKarmaBook(force: number, designKarma = 0): number | null {
  if (S().allyCost !== 'book') return null;
  const f = Math.max(1, whole(force));
  return 5 * ((f - 1) * f) / 2 + Math.max(0, whole(designKarma));
}

/** Magic the creator gives up for an ally (Grimoire pp. 67, 71): 1, none for the familiar ordeal (Grimoire p. 40). */
export function allyMagicCost(familiar: boolean): number {
  return S().allyCost === 'book' && !familiar ? 1 : 0;
}

/** The ally ritual's days (Grimoire p. 71): Force ÷ successes (the full Force with none). */
export function allyRitualDays(force: number, successes: number): number {
  const f = Math.max(1, whole(force));
  const s = whole(successes);
  return s > 0 ? Math.max(1, Math.ceil(f / s)) : f;
}

/** Each ritual day's fatigue (Grimoire p. 71): (Force + days so far)L Stun; [] under 'v922'. */
export function allyDailyDrain(force: number, days: number): Array<{ tn: number; level: DamageLevel }> {
  if (S().allyCost !== 'book') return [];
  const f = Math.max(1, whole(force));
  return Array.from({ length: Math.max(0, whole(days)) }, (_, i) => ({ tn: f + i + 1, level: 'L' as DamageLevel }));
}

// ---------------------------------------------------------------- Wards

/** A ward's drain (Grimoire p. 92): (Force × days)L, days = the successes kept, never Physical. Null under 'v922'. */
export function wardDrainBook(force: number, successes: number): { tn: number; level: DamageLevel; type: 'stun' } | null {
  if (S().ward !== 'book') return null;
  return { tn: Math.max(RULES.MIN_TARGET_NUMBER, Math.max(1, whole(force)) * Math.max(1, whole(successes))), level: 'L', type: 'stun' };
}

/** A ward's highest Force (Grimoire p. 92): wardMaxForcePerMagic × Magic; Infinity at 0. */
export function wardMaxForce(magic: number): number {
  const per = Number(S().wardMaxForcePerMagic) || 0;
  return per > 0 ? Math.floor(per * Math.max(0, whole(magic))) : Infinity;
}

// ---------------------------------------------------------------- Geasa

/** A broken geas (Grimoire p. 52): +2 TN per broken geas on the magician's magical tests ('book'); 0 under 'v922'. */
export function geasaTn(geasa: ReadonlyArray<{ met?: boolean }>): number {
  if (S().geasa !== 'book') return 0;
  return (geasa ?? []).filter((g) => g && g.met === false).length * 2;
}

// ---------------------------------------------------------------- Dispelling

/**
 * Dispelling (Grimoire p. 45), book way: only a spell of Force ≤ grade; TN = the higher of Force and the Karma that
 * quickened it; every 2 successes take 1 off the spell's Force. Null under 'v922'.
 */
export function dispelBook(): boolean { return S().dispelling === 'book'; }
export function dispelTn(force: number, quickenKarma = 0): number {
  return Math.max(RULES.MIN_TARGET_NUMBER, whole(force), whole(quickenKarma));
}
export function dispelForceAfter(force: number, successes: number): number {
  return Math.max(0, whole(force) - Math.floor(Math.max(0, whole(successes)) / 2));
}

// ---------------------------------------------------------------- Elemental services

/** An elemental sustaining a spell (Core p. 142): Force Combat Turns ('book'), or Force hours ('v922'), in seconds. */
export function elementalSustainSeconds(force: number): number {
  const f = Math.max(0, whole(force));
  if (S().elementalSustain === 'book') return f * 3;
  return f * Math.max(0, Number(RULES.MAGIC_V39.sustainLimit.hoursPerForce) || 0) * 3600;
}

// ---------------------------------------------------------------- The Spirit Table

/**
 * The Spirit Table (Core p. 144): attribute offsets from Force by kind of spirit (Charisma, Intelligence and Willpower
 * are the Force), and the Reaction it lists, as a bonus over the derived (Quickness + Intelligence) ÷ 2. Used for a
 * summoned spirit that has no template actor ('book'); 'v922' leaves every offset at 0.
 */
const TABLE: Record<string, { body: number; quickness: number; strength: number; reactionBonus: number }> = {
  air: { body: -2, quickness: 3, strength: -3, reactionBonus: 1 },
  earth: { body: 4, quickness: -2, strength: 4, reactionBonus: -1 },
  fire: { body: 1, quickness: 2, strength: -2, reactionBonus: 0 },
  water: { body: 2, quickness: 0, strength: 0, reactionBonus: -1 },
};
const NATURE: Record<string, keyof typeof TABLE> = {
  city: 'fire', hearth: 'fire', field: 'fire',
  desert: 'earth', forest: 'earth', mountain: 'earth', prairie: 'earth',
  mist: 'air', storm: 'air',
  lake: 'water', river: 'water', sea: 'water', swamp: 'water',
};

/** The Spirit Table's offsets for a spirit type ("Fire Elemental", "Forest Spirit", an element), or null. */
export function spiritTableOffsets(type: string, element = ''): { body: number; quickness: number; strength: number; reactionBonus: number } | null {
  if (S().spiritTable !== 'book') return null;
  const ty = String(type ?? '').toLowerCase();
  const el = String(element ?? '').toLowerCase().trim();
  const elem = (['air', 'earth', 'fire', 'water'] as const).find((x) => el === x || (/elemental/.test(ty) && new RegExp(`\\b${x}\\b`).test(ty)));
  if (elem && !/spirit/.test(ty)) return { ...TABLE[elem]! };
  const n = Object.keys(NATURE).find((k) => new RegExp(`\\b${k}\\b`).test(ty));
  return n ? { ...TABLE[NATURE[n]!]! } : null;
}

// ---------------------------------------------------------------- Assensing

/**
 * What reading an aura gives by successes (Core p. 145; Grimoire p. 90), book way: the basics at a glance (awakened,
 * health, foci, spells on it, Essence and Magic compared with the reader's own), emotions at 2, the cause and cybered
 * attributes at 4 (signatures at 4 too); never exact Essence or Magic. Null under 'v922' (MAGIC_V56.assensing).
 */
export function assensingBookTable(): ReadonlyArray<{ successes: number; reveals: readonly string[] }> | null {
  if (S().assensing !== 'book') return null;
  return [
    { successes: 0, reveals: ['awakened', 'health', 'foci', 'sustained', 'essenceCompare', 'magicCompare'] },
    { successes: 2, reveals: ['emotion'] },
    { successes: 4, reveals: ['cyberware', 'cyberwareList', 'signature'] },
  ];
}
