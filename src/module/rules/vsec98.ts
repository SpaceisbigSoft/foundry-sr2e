/**
 * v0.98.0 rules completeness, building security and vehicle upkeep. Pure functions over RULES.VSEC_V98
 * (rules/config98/vsec.ts), from Rigger 2 and the Corporate Security Handbook (CSH). Each behaves the book's way at the
 * shipped value of its switch; at the other value ('v971') the caller keeps the v0.97.1 code. No Foundry dependency. A
 * refusal is a language key (`why`), never text.
 */
import { RULES, type DamageLevel } from './config.ts';
import { DAMAGE_LEVELS } from './util.ts';
import { VSEC_CHASSIS_98, type Chassis98 } from './config98/vsec.ts';

const V = () => RULES.VSEC_V98;
const num = (v: unknown, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const whole = (v: unknown) => Math.max(0, Math.floor(num(v)));
const minTn = (n: number) => Math.max(RULES.MIN_TARGET_NUMBER, Math.floor(num(n)));
const WHY = 'SR2E.VSec98.Why.';

export type VSec98Switch = Exclude<keyof typeof RULES.VSEC_V98, 'accessAlert' | 'repairPartsPercent'>;
/** Whether a switch is at the book's way. */
export const on = (key: VSec98Switch): boolean => (V() as any)[key] === 'book';

// ---------------------------------------------------------------- CCSS limits (CSH p. 102; Rigger 2 pp. 77–78)

/** What a security rigger can run at once: devices actively operated (Intelligence) and drones commanded (the RC deck's rating). */
export function ccssLimits(o: { intelligence: number; rcDeck: number }): { devices: number; drones: number } | null {
  if (!on('ccss')) return null;
  return { devices: whole(o.intelligence), drones: whole(o.rcDeck) };
}

/** Whether the site's rigger may add Control Pool dice to a device's detection test (Rigger 2 p. 78: not while assuming the body). */
export function riggerPoolOnDetection(): boolean {
  return !on('ccssPools');
}

// ---------------------------------------------------------------- Rigger perception (Rigger 2 p. 77; CSH p. 102)

export const PERCEPTION_TRIGGERS = ['door', 'tamperTry', 'tamperOk', 'destroyed', 'deactivated', 'alarm'] as const;
export type PerceptionTrigger = (typeof PERCEPTION_TRIGGERS)[number];

/**
 * The security rigger's Perception Test TN for a trigger (Rigger 2 p. 77): null = no test needed (an alarm or sensor
 * went off: the rigger knows). −2 while the system is on alert. `why` when the rule is off or the trigger unknown.
 */
export function riggerPerceptionTn(trigger: string, o: { tamperSuccesses?: number; onAlert?: boolean } = {}): { tn: number | null; why?: string } {
  if (!on('perception')) return { tn: null, why: `${WHY}off` };
  const alert = o.onAlert ? -2 : 0;
  switch (trigger) {
    case 'door': return { tn: minTn(5 + alert) };
    case 'tamperTry': return { tn: minTn(3 + alert) };
    case 'tamperOk': return { tn: minTn(3 * Math.max(1, whole(o.tamperSuccesses)) + alert) };
    case 'destroyed': return { tn: minTn(4 + alert) };
    case 'deactivated': return { tn: minTn(6 + alert) };
    case 'alarm': return { tn: null };
    default: return { tn: null, why: `${WHY}trigger` };
  }
}

/** Whether a site's alert counts as "on alert" for the table (VERIFY: any alert above none). */
export function siteOnAlert(alert: string): boolean {
  return String(alert ?? 'none') !== 'none' && RULES.SECURITY.alerts.includes(alert as any);
}

// ---------------------------------------------------------------- Accessing a rigged system (Rigger 2 p. 79)

export const VIGILANCE = { blue: 1, green: 2, amber: 3, red: 4 } as const;
export type Vigilance = keyof typeof VIGILANCE;
export const ACCESS_STEPS = ['tap', 'decrypt', 'protocols'] as const;
export type AccessStep = (typeof ACCESS_STEPS)[number];

/** The site's CCSS values (its vsec98 flag, written by the GM side): Technical Rating 1–10 and Vigilance Code. */
export interface SiteCcss { technical: number; vigilance: Vigilance; levels: Record<string, number>; oslMod: number; access: Record<string, number> }
export const LEVEL_KEYS = ['barriers', 'lighting', 'guards', 'animals', 'alarms', 'surveillance', 'magic', 'matrix', 'personnel'] as const;

/** The stored site values, bounded (anything malformed falls back). */
export function siteCcss(raw: unknown): SiteCcss {
  const r: any = raw && typeof raw === 'object' ? raw : {};
  const vig = Object.keys(VIGILANCE).includes(r.vigilance) ? (r.vigilance as Vigilance) : 'blue';
  const lv: Record<string, number> = {};
  for (const k of LEVEL_KEYS) lv[k] = Math.min(4, whole(r.levels?.[k]));
  const access: Record<string, number> = {};
  for (const [k, v] of Object.entries(r.access && typeof r.access === 'object' ? r.access : {}).slice(0, 40)) {
    if (typeof k === 'string' && k.length <= 400 && !k.includes('.')) access[k] = Math.min(ACCESS_STEPS.length, whole(v));
  }
  return { technical: Math.min(10, Math.max(1, whole(r.technical) || 1)), vigilance: vig, levels: lv, oslMod: Math.max(-5, Math.min(5, Math.floor(num(r.oslMod)))), access };
}

/**
 * An access step's test (Rigger 2 p. 79): the dice (tap rating + Electronics, or the module's rating + Intelligence),
 * the TN (the Technical Rating), the successes needed (the Vigilance Code) and whether a failure puts the site on alert.
 */
export function accessTest(step: string, o: { device: number; electronics: number; intelligence: number; technical: number; vigilance: string }): { dice: number; tn: number; need: number; alertOnFail: boolean; why?: string } {
  if (!on('access')) return { dice: 0, tn: 0, need: 0, alertOnFail: false, why: `${WHY}off` };
  if (!(ACCESS_STEPS as readonly string[]).includes(step)) return { dice: 0, tn: 0, need: 0, alertOnFail: false, why: `${WHY}step` };
  const need = VIGILANCE[(Object.keys(VIGILANCE).includes(o.vigilance) ? o.vigilance : 'blue') as Vigilance];
  const dice = whole(o.device) + (step === 'tap' ? whole(o.electronics) : whole(o.intelligence));
  return { dice, tn: minTn(Math.min(10, Math.max(1, whole(o.technical)))), need, alertOnFail: step !== 'tap' };
}

/** An access step's outcome: done when the successes reach the Vigilance Code's; else an alert for decryption and protocols. */
export function accessOutcome(successes: number, t: { need: number; alertOnFail: boolean }): { done: boolean; alert: string } {
  const done = whole(successes) >= Math.max(1, whole(t.need));
  return { done, alert: !done && t.alertOnFail ? String(V().accessAlert || 'active') : '' };
}

/** The steps an intruder has done on this site (the site's record: 0 none, 1 tapped, 2 decrypted, 3 protocols). */
export function stepIndex(step: string): number {
  return (ACCESS_STEPS as readonly string[]).indexOf(step) + 1;
}

// ---------------------------------------------------------------- Rigger combat (Rigger 2 pp. 79–80; CSH p. 105)

/** One side of rigger combat: Willpower, Body, the Control Pool dice they put in, and whether they are a decker. */
export interface CombatSide { willpower: number; body: number; pool: number; decker?: boolean; emulation?: number }

/** The Control Pool dice a side may use: the decker's is half the emulation utility (round up); the attack at most Willpower. */
export function combatPoolCap(s: CombatSide, use: 'attack' | 'resist'): number {
  const own = s.decker ? Math.ceil(whole(s.emulation) / 2) : whole(s.pool);
  if (use === 'resist' && s.decker) return 0;
  return Math.min(own, use === 'attack' ? whole(s.willpower) : whole(s.body));
}

/** The opposed Willpower Test (Rigger 2 p. 79): each side's dice and TN (the other's Willpower; a decker +2). */
export function combatTests(attacker: CombatSide, defender: CombatSide, attackerPool: number): { attacker: { dice: number; tn: number }; defender: { dice: number; tn: number } } {
  const pool = Math.min(whole(attackerPool), combatPoolCap(attacker, 'attack'));
  return {
    attacker: { dice: whole(attacker.willpower) + pool, tn: minTn(whole(defender.willpower) + (attacker.decker ? 2 : 0)) },
    defender: { dice: whole(defender.willpower), tn: minTn(whole(attacker.willpower) + (defender.decker ? 2 : 0)) },
  };
}

/** Who wins and the damage (Rigger 2 p. 79): (winner's Willpower)L Stun, +1 level per 2 net successes; a tie does nothing. */
export function combatOutcome(attackerSuccesses: number, defenderSuccesses: number, attacker: CombatSide, defender: CombatSide): { winner: 'attacker' | 'defender' | null; net: number; power: number; level: DamageLevel | null } {
  const a = whole(attackerSuccesses), d = whole(defenderSuccesses);
  if (a === d) return { winner: null, net: 0, power: 0, level: null };
  const winner = a > d ? 'attacker' : 'defender';
  const net = Math.abs(a - d);
  const w = winner === 'attacker' ? attacker : defender;
  const level = DAMAGE_LEVELS[Math.min(DAMAGE_LEVELS.length - 1, Math.floor(net / 2))]!;
  return { winner, net, power: whole(w.willpower), level };
}

/** The loser's resistance test (Rigger 2 pp. 79–80): a rigger Body (+ Control Pool ≤ Body), a decker Willpower (non-lethal black IC), a decker +2 TN. */
export function combatResistance(loser: CombatSide, power: number): { attribute: 'body' | 'willpower'; tn: number; poolCap: number } {
  return { attribute: loser.decker ? 'willpower' : 'body', tn: minTn(whole(power) + (loser.decker ? 2 : 0)), poolCap: combatPoolCap(loser, 'resist') };
}

/** A decker's Initiative in rigger combat (Rigger 2 p. 80): −2, no dice from the deck's Response Increase (the card says so). */
export const DECKER_INIT_98 = -2;

// ---------------------------------------------------------------- The rigger's decking penalty (Rigger 2 p. 16)

/**
 * A rigger decking (Rigger 2 p. 16): +1 TN on every Matrix test and the Hacking Pool lowered by the VCR level; none with
 * both a decker's and a rigger's datajack (p. 18: two installed datajacks, VERIFY), and none without a VCR.
 */
export function riggerDeckingPenalty(o: { vcr: number; datajacks: number }): { tn: number; pool: number } {
  if (!on('riggerDecking') || whole(o.vcr) <= 0 || whole(o.datajacks) >= 2) return { tn: 0, pool: 0 };
  return { tn: 1, pool: whole(o.vcr) };
}

/** How many datajacks a list of installed cyberware names holds (a datajack's name contains "datajack"). */
export function datajackCount(names: readonly string[]): number {
  return (names ?? []).filter((n) => /datajack/i.test(String(n ?? ''))).length;
}

// ---------------------------------------------------------------- Motion and vibration sensors (CSH pp. 99–100)

/** Whether a device's sense is tested the book's motion or vibration way. */
export function sensorTestKind(sense: string): 'motion' | 'vibration' | null {
  if (!on('motion')) return null;
  return sense === 'motion' ? 'motion' : sense === 'vibration' ? 'vibration' : null;
}

/**
 * The Stealth Test against a motion or vibration sensor (CSH pp. 99–100): the TN (the device's rating) and its movement
 * modifier for `metres` moved this Combat Turn (null = unknown: none, the GM adds it). Motion: +1 per quarter metre
 * over 1 m (part quarters count, VERIFY). Vibration: over 0.5 m +3, over 1 m it goes off (`auto`).
 */
export function sensorTest(kind: 'motion' | 'vibration', rating: number, metres: number | null): { tn: number; move: number; auto: boolean } {
  const base = Math.max(0, Math.floor(num(rating)));
  const m = metres == null || !Number.isFinite(Number(metres)) ? null : Math.max(0, Number(metres));
  if (kind === 'vibration') {
    if (m != null && m > 1 + 1e-9) return { tn: minTn(base), move: 0, auto: true };
    const move = m != null && m > 0.5 + 1e-9 ? 3 : 0;
    return { tn: minTn(base + move), move, auto: false };
  }
  const move = m != null && m > 1 + 1e-9 ? Math.ceil((m - 1) / 0.25 - 1e-9) : 0;
  return { tn: minTn(base + move), move, auto: false };
}

/** One success gets past it (CSH pp. 99–100). */
export function sensorPassed(successes: number, auto: boolean): boolean {
  return !auto && whole(successes) >= 1;
}

// ---------------------------------------------------------------- Security ratings (CSH pp. 94–100)

/** The Technical Security Ratings Table (CSH p. 100): [low, high] per column by security level 0–4 ([0, 0] = none). */
const R = (a: number, b: number): [number, number] => [a, b];
export const TECH_RATINGS_98: Record<'alarmsInt' | 'alarmsExt' | 'maglocks' | 'cctvExt' | 'cctvInt' | 'ccss', ReadonlyArray<[number, number]>> = {
  alarmsInt: [R(0, 0), R(0, 0), R(2, 3), R(4, 5), R(6, 7)],
  alarmsExt: [R(0, 0), R(0, 0), R(0, 0), R(2, 3), R(4, 5)],
  maglocks: [R(0, 0), R(2, 3), R(4, 5), R(6, 7), R(8, 10)],
  cctvExt: [R(0, 0), R(2, 3), R(4, 5), R(6, 7), R(8, 10)],
  cctvInt: [R(0, 0), R(0, 0), R(2, 3), R(4, 5), R(6, 7)],
  ccss: [R(0, 0), R(0, 0), R(0, 0), R(3, 4), R(5, 6)],
};
/** Biometric maglocks +2 (CSH p. 100). */
export const BIOMETRIC_98 = 2;
const BIOMETRIC_LOCKS = ['print', 'retina', 'voice'];

/** The Overall Security Level (CSH p. 98): the components' levels added, ÷ 6 round down, with the GM's modifier, 0–5. */
export function overallSecurityLevel(levels: Record<string, number>, mod = 0): number | null {
  if (!on('ratings')) return null;
  const sum = LEVEL_KEYS.reduce((n, k) => n + Math.min(4, whole(levels?.[k])), 0);
  return Math.max(0, Math.min(5, Math.floor(sum / 6) + Math.floor(num(mod))));
}

/** A device's rating by the site's levels (CSH p. 100), or null when the table has none for it (or the kind isn't rated). */
export function deviceRating98(d: { kind: string; lockType?: string }, levels: Record<string, number>, o: { exterior?: boolean; high?: boolean } = {}): number | null {
  if (!on('ratings')) return null;
  const al = Math.min(4, whole(levels?.alarms)), sv = Math.min(4, whole(levels?.surveillance));
  const pick = (col: keyof typeof TECH_RATINGS_98, lv: number): number => TECH_RATINGS_98[col][lv]![o.high ? 1 : 0];
  let r = 0;
  if (d.kind === 'camera') r = pick(o.exterior ? 'cctvExt' : 'cctvInt', sv);
  else if (d.kind === 'sensor' || d.kind === 'alarm') r = pick(o.exterior ? 'alarmsExt' : 'alarmsInt', al);
  else if (d.kind === 'maglock' || d.kind === 'door') { r = pick('maglocks', al); if (r > 0 && BIOMETRIC_LOCKS.includes(String(d.lockType ?? ''))) r += BIOMETRIC_98; }
  else return null;
  return r > 0 ? r : null;
}

/** The site's CCSS rating by its surveillance level (CSH p. 100), 0 below level 3. */
export function ccssRating98(levels: Record<string, number>, high = false): number {
  return TECH_RATINGS_98.ccss[Math.min(4, whole(levels?.surveillance))]![high ? 1 : 0];
}

/** Equipment first available at a lower level than the one chosen rates twice the chosen level (CSH p. 94). */
export function lowerLevelRating(chosen: number, firstAvailable: number): number {
  const c = Math.min(4, whole(chosen));
  return whole(firstAvailable) < c ? c * 2 : c;
}

// ---------------------------------------------------------------- Repair parts (Rigger 2 p. 26)

/** A vehicle's total cost: its own plus its installed modifications'. */
export function vehicleTotalCost(sys: { cost?: number; mods?: ReadonlyArray<{ installed?: boolean; cost?: number }> }): number {
  return whole(sys?.cost) + (sys?.mods ?? []).filter((m) => m?.installed).reduce((n, m) => n + whole(m?.cost), 0);
}

/** The replacement parts for `boxes` of damage (Rigger 2 p. 26): 5% of the total cost per box; null when off or nothing to price. */
export function repairPartsCost(boxes: number, totalCost: number): number | null {
  if (!on('repairParts')) return null;
  const b = whole(boxes), c = whole(totalCost);
  if (!b || !c) return null;
  return Math.round(c * b * Math.max(0, num(V().repairPartsPercent)) / 100);
}

// ---------------------------------------------------------------- Modification specifications (Rigger 2 pp. 120–140)

/** Level tables (index 0 = level 1). The ECCM entries for levels 1 and 3 and the military levels' millions are read past the scan (VERIFY). */
const SENSOR = [5000, 15000, 25000, 50000, 75000, 125000, 375000, 1250000, 3000000, 6000000];
const ECM = [25000, 75000, 125000, 250000, 375000, 750000, 1500000, 7500000, 15000000, 30000000];
const ECCM = [10000, 30000, 50000, 100000, 150000, 250000, 750000, 2500000, 6000000, 12000000];
const ECD = [25000, 80000, 200000, 750000, 2000000, 5000000];
const AUTONAV = [500, 1000, 5000, 15000];
const AUTONAV_HOURS = [16, 32, 96, 48];
const PILOT = [0, 5000, 25000, 500000, 2500000];
/** Thermal baffles' parts per +1 Signature, × Body, by the vehicle's category (Rigger 2 p. 130; VERIFY for the unlisted ones). */
const BAFFLES: Record<string, number> = { car: 5000, bike: 6000, truck: 7500, fixedWing: 7500, rotor: 10000, hovercraft: 3750, boat: 2500, ship: 2500, lta: 2500 };
const AIRCRAFT = ['rotor', 'fixedWing', 'vectorThrust', 'lta'];

export type ModSkill98 = 'vehicle' | 'electronics' | 'computer';
/** A modification's Customization Specifications for this vehicle. */
export interface ModSpec98 { cost: number | null; tn: number; hours: number; skill: ModSkill98; max?: number; why?: string }

/** The vehicle's stats a modification's price or test needs. */
export interface ModVehicle { body?: number; handling?: number; armor?: number; sensor?: number; ecm?: number; eccm?: number; ecd?: number; autonav?: number; pilot?: number; signature?: number; category?: string; drone?: boolean; cost?: number }

/**
 * A modification's parts cost, Installation Test TN, base hours and skill (Rigger 2 pp. 120–140) for `rating` levels
 * added to this vehicle, or null when the rule is off or the kind has no book entry here ('other'). A table item
 * (sensor, ECM, ECCM, ECD, autonav, pilot) costs the table's price for the level it reaches (VERIFY: the book prices
 * systems, not upgrades). `cost: null` keeps the old price (engine customization prices from the power plant's cost;
 * the rigger adaptation keeps the owner's price).
 */
export function modSpec98(kind: string, rating: number, v: ModVehicle = {}): ModSpec98 | null {
  if (!on('modSpecs')) return null;
  const r = Math.max(1, whole(rating) || 1);
  const at = (stat: number | undefined) => whole(stat) + r;
  const tab = (t: readonly number[], lv: number): number | null => (lv >= 1 && lv <= t.length ? t[lv - 1]! : null);
  const handlingTn = minTn(8 - whole(v.handling));
  switch (kind) {
    case 'armor': return { cost: 1250 * r, tn: minTn(Math.ceil(at(v.armor) / 3)), hours: 8 * r, skill: 'vehicle' };
    case 'engine': {
      const cat = String(v.category ?? '');
      const plus = AIRCRAFT.includes(cat) ? 5 : v.drone || cat === 'hovercraft' ? 4 : 3;
      return { cost: null, tn: minTn(r + plus), hours: 40 * r, skill: 'vehicle' };
    }
    case 'handling': return { cost: whole(v.cost) > 0 ? Math.round(whole(v.cost) * 0.1 * r) : null, tn: 4, hours: 40 * r, skill: 'vehicle', max: 2 };
    case 'signature': return { cost: (BAFFLES[String(v.category ?? '')] ?? BAFFLES.car!) * Math.max(1, whole(v.body)) * r, tn: 4, hours: 8 * r, skill: 'vehicle', max: 2 };
    case 'sensor': return withLevel(tab(SENSOR, at(v.sensor)), at(v.sensor), SENSOR.length, 'electronics', 16);
    case 'ecm': return withLevel(tab(ECM, at(v.ecm)), at(v.ecm), ECM.length, 'electronics', 16);
    case 'eccm': return withLevel(tab(ECCM, at(v.eccm)), at(v.eccm), ECCM.length, 'electronics', 16);
    case 'ecd': return withLevel(tab(ECD, at(v.ecd)), at(v.ecd), ECD.length, 'electronics', 16);
    case 'autonav': {
      const lv = at(v.autonav);
      const s = withLevel(tab(AUTONAV, lv), lv, AUTONAV.length, 'vehicle', 0);
      return { ...s, tn: handlingTn, hours: AUTONAV_HOURS[Math.min(AUTONAV.length, lv) - 1] ?? 48 };
    }
    case 'pilot': {
      const lv = at(v.pilot);
      const s = withLevel(tab(PILOT, lv), lv, PILOT.length, 'computer', 0);
      return { ...s, tn: handlingTn, hours: 64 };
    }
    case 'remote': return { cost: 2500 * Math.max(1, whole(v.body)), tn: 4, hours: 16, skill: 'vehicle' };
    case 'adaptation': return { cost: null, tn: 4, hours: 40, skill: 'vehicle' };
    default: return null;
  }
}

function withLevel(cost: number | null, level: number, max: number, skill: ModSkill98, perLevel: number): ModSpec98 {
  return { cost, tn: 4, hours: perLevel * Math.max(1, level), skill, max, ...(level > max ? { why: `${WHY}overMax` } : {}) };
}

// ---------------------------------------------------------------- Vehicle design (Rigger 2 pp. 108–114, 170–171)

/** The Mark-Up Factors Table's chassis categories (Rigger 2 pp. 108–114); special vehicles 1–2.5 (the GM picks). */
export const MARKUP_98: Record<string, number> = { bike: 0.5, car: 1, fixedWing: 2.5, hovercraft: 2.5, boat: 1, rotor: 2.5, vectorThrust: 2.5, special: 1 };
/** Special designs' secondary multipliers (low end; the GM may go up to the high end): luxury 1.5–2.5, security 2–3, military 3–5, drone 0.1. */
export const SPECIAL_98: Record<string, [number, number]> = { luxury: [1.5, 2.5], security: [2, 3], military: [3, 5], drone: [0.1, 0.1] };

export function chassis98(id: string): Chassis98 | null {
  return VSEC_CHASSIS_98.find((c) => c.id === id) ?? null;
}

/**
 * The final price (Rigger 2 pp. 108–114): the Design Point Value × the Mark-Up Factor × 100¥; the factor is the category's
 * plus the modifiers, then times each special-design multiplier in turn (not added together).
 */
export function designPrice(o: { dpv: number; category: string; modifiers?: number; specials?: ReadonlyArray<{ id: string; value?: number }> }): { factor: number; price: number } | null {
  if (!on('design')) return null;
  let factor = (MARKUP_98[o.category] ?? 1) + Math.max(0, num(o.modifiers));
  for (const s of o.specials ?? []) {
    const range = SPECIAL_98[s.id];
    if (!range) continue;
    const v = s.value == null ? range[0] : Math.max(range[0], Math.min(range[1], num(s.value, range[0])));
    factor *= v;
  }
  factor = Math.round(factor * 1000) / 1000;
  return { factor, price: Math.round(whole(o.dpv) * factor * 100) };
}

/** The B/R skill names to try first for a modification (Rigger 2 pp. 136–140: Electronics B/R; p. 126: the pilot, Computer B/R). */
export function modSkillNames(kind: string, v: ModVehicle = {}): string[] {
  const s = modSpec98(kind, 1, v)?.skill;
  if (s === 'electronics') return [RULES.SECURITY_V57.casingSkill];
  if (s === 'computer') return [RULES.MATRIX.repair.skills[0]!];
  return [];
}
