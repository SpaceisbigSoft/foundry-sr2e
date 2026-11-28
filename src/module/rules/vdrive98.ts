/**
 * v0.98.0 rules completeness, vehicles: driving, vehicle combat and chases. Pure functions over RULES.VDRIVE_V98
 * (rules/config98/vdrive.ts), from Rigger 2. Each behaves the book's way at the shipped value of its switch; at the
 * other value ('v971') the caller keeps the v0.97.1 code (these return the neutral value: no modifier, no change). No
 * Foundry dependency. A refusal is a language key (`why`), never text.
 */
import { RULES, type DamageLevel } from './config.ts';
import type { TargetNumberModifier } from './dice.ts';
import { CHASE98 } from './config98/vdrive.ts';
import { stageDown } from './damage.ts';
import { impactLevel } from './docs79-vehicles.ts';
import { t as tx } from '../helpers/i18n.ts';

const V = () => RULES.VDRIVE_V98;
const num = (v: unknown, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const whole = (v: unknown) => Math.max(0, Math.floor(num(v)));
const str = (v: unknown, max = 400) => (typeof v === 'string' ? v.slice(0, max) : '');
/** At most this many entries in any list this file keeps (a bound on a malformed record). */
export const LIST_CAP = 60;

export type VDrive98Switch = { [K in keyof typeof RULES.VDRIVE_V98]: (typeof RULES.VDRIVE_V98)[K] extends string ? K : never }[keyof typeof RULES.VDRIVE_V98];
/** The switches the Unified Rules Revamp's own chase rules replace (read 'v971' under the Revamp). */
const REVAMP_OWN = new Set<string>(['chase', 'passengerPhase', 'gunneryRows']);
/** Whether a switch is at the book's way (the Revamp's own chase rules win under its source). */
export const on = (key: VDrive98Switch): boolean => (V() as any)[key] === 'book' && !(REVAMP_OWN.has(key) && RULES.URR_V80.active);

// ---------------------------------------------------------------- Off-road Speed (Rigger 2 pp. 22, 125)

/** The ground vehicles (wheeled or tracked) the off-road rule is for. */
export const GROUND = new Set(['car', 'bike', 'truck']);

/** A vehicle's Speed now: halved (round down) off-road unless it has off-road suspension (Rigger 2 p. 22). */
export function offroadSpeed(speed: number, o: { offroad: boolean; suspension: boolean; category: string }): number {
  const s = whole(speed);
  if (!on('offRoad') || !o.offroad || o.suspension || !GROUND.has(String(o.category))) return s;
  return Math.floor(s / 2);
}

// ---------------------------------------------------------------- Exceeding the Speed and Stress (Rigger 2 pp. 22, 25–26, 45)

/** The fastest a vehicle may go (Rigger 2 p. 22: 1.5 × its Speed, round down); null under 'v971' (no cap) or no Speed. */
export function maxSpeed(speed: number): number | null {
  const s = whole(speed);
  if (!on('speedCap') || !(s > 0)) return null;
  return Math.floor(s * CHASE98.maxSpeedFactor);
}

/**
 * A speed change: capped at the most allowed (`speedCap`), and whether it costs a Stress Point (`stress`: speeding up
 * to above the Speed, Rigger 2 pp. 25, 45).
 */
export function speedChange(o: { from: number; to: number; speed: number }): { to: number; capped: boolean; stress: number } {
  const want = whole(o.to);
  const cap = maxSpeed(o.speed);
  const to = cap !== null && want > cap ? cap : want;
  const stress = on('stress') && whole(o.speed) > 0 && to > whole(o.from) && to > whole(o.speed) ? 1 : 0;
  return { to, capped: to !== want, stress };
}

/** The Stress Rule of One (Rigger 2 p. 26): as many 1s on a Driving Test as the driver's skill (at least one 1). */
export function ruleOfOne(ones: number, skill: number): boolean {
  return on('stress') && whole(ones) > 0 && whole(ones) >= Math.max(1, whole(skill));
}

/** A Stress Test (Rigger 2 p. 25): 2D6 below the vehicle's Stress means a system fails. */
export function stressTestFails(total: number, stress: number): boolean {
  return on('stress') && whole(total) < whole(stress);
}

/** Stress at twice the Body or more (Rigger 2 p. 25): a major system fails. */
export function stressBreaks(stress: number, body: number): boolean {
  return on('stress') && whole(stress) > 0 && whole(stress) >= 2 * Math.max(1, whole(body));
}

// ---------------------------------------------------------------- Rigger defaulting (Rigger 2 p. 12)

/**
 * The defaulting TN for a rigger jumped in (Rigger 2 p. 12: +1 per dot, not +2): half the modifier (round up) when the
 * default comes from Reaction or another vehicle skill. Other defaults, or 'v971': the modifier as it was.
 */
export function riggerDefault(value: number, o: { jumped: boolean; from: 'reaction' | 'vehicleSkill' | 'other' }): number {
  const v = num(value);
  if (!on('riggerDefault') || !o.jumped || o.from === 'other' || !(v > 0)) return v;
  return Math.ceil(v / 2);
}

/** The vehicle skills (RULES.VEHICLES.categories), for telling a vehicle-skill default from another. */
export function isVehicleSkill(name: string): boolean {
  const n = String(name ?? '').trim().toLowerCase();
  return Boolean(n) && RULES.VEHICLES.categories.some((c) => c.skill && c.skill.toLowerCase() === n);
}

// ---------------------------------------------------------------- The autonav in combat maneuvers (Rigger 2 pp. 45–49)

export type Maneuver98 = 'accel' | 'position' | 'ram' | 'hide' | 'relocate';

/** Whether the vehicle's autonav adds its dice (off, it doesn't; 'v971': always). */
export function autonavDiceOn(off: boolean): boolean {
  return !(on('autonavCombat') && off);
}

/** The active autonav's row on a combat maneuver (Rigger 2 pp. 45–49), or null (off, no rating, 'v971'). */
export function autonavManeuver(kind: Maneuver98, rating: number, off: boolean): TargetNumberModifier | null {
  const r = whole(rating);
  if (!on('autonavCombat') || off || !(r > 0)) return null;
  const value = kind === 'ram' ? r + CHASE98.ramAutonavPlus : kind === 'relocate' ? -r : r;
  return { id: 'autonav98', label: tx('SR2E.VDrive98.Mod.autonav', { rating: r }), value };
}

// ---------------------------------------------------------------- The ram's range (Rigger 2 p. 47)

/** Whether a vehicle may ram now (Rigger 2 p. 47: closer than its Acceleration); an unknown distance doesn't refuse. */
export function ramInRange(distance: number | null, accel: number): { ok: boolean; why?: string } {
  if (!on('ramRange') || distance === null || !Number.isFinite(distance)) return { ok: true };
  return distance < whole(accel) ? { ok: true } : { ok: false, why: 'SR2E.VDrive98.Why.ramTooFar' };
}

// ---------------------------------------------------------------- Walls and barriers (Rigger 2 pp. 50–52)

export interface WallHit { through: boolean; speedAfter: number; power: number; level: DamageLevel | null }

/**
 * A vehicle hitting a wall (Rigger 2 pp. 51–52): at or below Barrier × 20 it stops (`through` false: the standard crash
 * at its speed); faster, it breaks through, loses Barrier × 20 of its speed and takes the Barrier Rating as Power at the
 * level of the speed lost. Null under 'v971'.
 */
export function wallCollision(speed: number, barrier: number): WallHit | null {
  if (!on('walls')) return null;
  const s = whole(speed), b = whole(barrier), stop = b * CHASE98.barrierSpeed;
  if (s <= stop) return { through: false, speedAfter: 0, power: 0, level: null };
  return { through: true, speedAfter: s - stop, power: b, level: stop > 0 ? impactLevel(stop) : null };
}

// ---------------------------------------------------------------- The Maneuver Score (Rigger 2 pp. 41–42)

/** The vehicle types of the Vehicle Points table (Rigger 2 p. 41). */
export const VEHICLE_TYPES = Object.keys(CHASE98.vehiclePoints);

/** Vehicle Points (Rigger 2 p. 41): the vehicle's own type, else its category's. */
export function vehiclePoints(type: string, category: string): number {
  const t = VEHICLE_TYPES.includes(type) ? type : (CHASE98.byCategory[category] ?? 'car');
  return num(CHASE98.vehiclePoints[t]);
}

/** Terrain Points (Rigger 2 p. 41). */
export function terrainPoints(terrain: string): number {
  return num(CHASE98.terrainPoints[terrain] ?? CHASE98.terrainPoints['normal']);
}

/** Speed Points (Rigger 2 p. 41): the speed ÷ 10, round down. */
export function speedPoints(speed: number): number {
  return Math.floor(whole(speed) / CHASE98.speedPerPoint);
}

/** The partial score (Rigger 2 p. 42, step 2): Vehicle + Terrain + Speed Points. */
export function partialScore(o: { type: string; category: string; terrain: string; speed: number }): number {
  return vehiclePoints(o.type, o.category) + terrainPoints(o.terrain) + speedPoints(o.speed);
}

/**
 * An Open Test (Rigger 2 p. 42): the highest single die, each 6 re-rolled and added (Rule of Six). `roll(n)` gives n
 * d6 faces. Returns the result and the faces per die.
 */
export async function openTest(dice: number, roll: (count: number) => Promise<number[]>): Promise<{ result: number; dice: number[][] }> {
  const n = Math.min(60, whole(dice));
  if (!n) return { result: 0, dice: [] };
  const first = await roll(n);
  const out: number[][] = [];
  for (const f of first.slice(0, n)) {
    const faces = [whole(f)];
    let guard = 0;
    while (faces[faces.length - 1] === 6 && guard++ < 20) faces.push(whole((await roll(1))[0]));
    out.push(faces);
  }
  return { result: Math.max(0, ...out.map((f) => f.reduce((a, b) => a + b, 0))), dice: out };
}

/** The score-difference row of a maneuver (Rigger 2 pp. 45–49), or 0: `near` (10 or less) / `far` (11 or more). */
export function scoreDiff(kind: 'accel' | 'ram' | 'hide' | 'relocate', mine: number, theirs: number): number {
  const t = CHASE98.diff[kind];
  if (!t) return 0;
  const d = Math.floor(num(mine)) - Math.floor(num(theirs));
  if (d === 0) return 0;
  const row = d > 0 ? t.ahead : t.behind;
  return Math.abs(d) <= CHASE98.near ? row[0] : row[1];
}

/** The row for an opponent beyond the first (fleeing, escaping: Rigger 2 pp. 45, 48). */
export function extraOpponents(count: number): number {
  return Math.max(0, whole(count) - 1) * CHASE98.perExtraOpponent;
}

/** Whether a passenger may take an offensive action in this Combat Phase (Rigger 2 p. 49): not above the Driver Points. */
export function passengerMayAct(phase: number | null, driverPoints: number | null): boolean {
  if (!on('passengerPhase') || phase === null || driverPoints === null || !Number.isFinite(phase)) return true;
  return num(phase) <= num(driverPoints);
}

/** Relative motion in a chase (Rigger 2 p. 57): the pursuer faster, they close (toward); slower, they part (away). */
export function relativeMotion(pursuerSpeed: number, quarrySpeed: number): 'toward' | 'away' | null {
  const a = whole(pursuerSpeed), b = whole(quarrySpeed);
  return a > b ? 'toward' : a < b ? 'away' : null;
}

/** The manual gunnery rows (Rigger 2 p. 57): relative motion ±1, Maneuver Score more than 10 apart ±1. */
export function gunneryRows(o: { mine: number | null; theirs: number | null; motion: 'toward' | 'away' | null }): TargetNumberModifier[] {
  if (!on('gunneryRows')) return [];
  const out: TargetNumberModifier[] = [];
  if (o.motion === 'toward') out.push({ id: 'relativeMotion98', label: tx('SR2E.VDrive98.Mod.movingToward'), value: -1 });
  if (o.motion === 'away') out.push({ id: 'relativeMotion98', label: tx('SR2E.VDrive98.Mod.movingAway'), value: 1 });
  if (o.mine !== null && o.theirs !== null) {
    const d = Math.floor(num(o.mine)) - Math.floor(num(o.theirs));
    const g = CHASE98.gunnery;
    if (d > g.over) out.push({ id: 'scoreAhead98', label: tx('SR2E.VDrive98.Mod.scoreAhead'), value: -g.value });
    else if (-d > g.over) out.push({ id: 'scoreBehind98', label: tx('SR2E.VDrive98.Mod.scoreBehind'), value: g.value });
  }
  return out;
}

// ---------------------------------------------------------------- The chase record (on the combat, GM-written)

export interface Score98 { v: string; score: number; driver: number; partial: number }
export interface Carry98 { v: string; pos: number }
export interface Hide98 { hider: string; from: string[]; successes: number; round: number }
export interface Chase98 { combatId: string; round: number; scores: Score98[]; carry: Carry98[]; hides: Hide98[] }
export const NO_CHASE: Chase98 = { combatId: '', round: -1, scores: [], carry: [], hides: [] };

const uuidOk = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 400;

/** The stored chase record (anything malformed is dropped). */
export function chaseState(raw: unknown): Chase98 {
  const r: any = raw && typeof raw === 'object' ? raw : {};
  const list = (x: unknown): any[] => (Array.isArray(x) ? x : []).filter((e) => e && typeof e === 'object').slice(0, LIST_CAP);
  return {
    combatId: str(r.combatId, 100),
    round: Number.isFinite(Number(r.round)) ? Math.floor(Number(r.round)) : -1,
    scores: list(r.scores).filter((e) => uuidOk(e.v)).map((e) => ({ v: e.v, score: Math.max(-200, Math.min(500, Math.floor(num(e.score)))), driver: Math.min(300, whole(e.driver)), partial: Math.max(-200, Math.min(300, Math.floor(num(e.partial)))) })),
    carry: list(r.carry).filter((e) => uuidOk(e.v)).map((e) => ({ v: e.v, pos: Math.min(60, whole(e.pos)) })),
    hides: list(r.hides).filter((e) => uuidOk(e.hider)).map((e) => ({ hider: e.hider, from: (Array.isArray(e.from) ? e.from : []).filter(uuidOk).slice(0, 20), successes: Math.min(60, whole(e.successes)), round: Math.floor(num(e.round, -1)) })),
  };
}

/** This vehicle's score this turn (null when the record isn't this combat's turn, or has none for it). */
export function scoreOf(st: Chase98, uuid: string, combatId: string, round: number): Score98 | null {
  if (!on('chase') || st.combatId !== combatId || st.round !== round) return null;
  return st.scores.find((s) => s.v === uuid) ?? null;
}

/** The Escape Bonus a hiding vehicle carries (Rigger 2 p. 48: its Hiding successes, until relocated). */
export function escapeBonus(st: Chase98, uuid: string): number {
  return st.hides.filter((h) => h.hider === uuid).reduce((n, h) => Math.max(n, h.successes), 0);
}

/** Whether `hider` is hidden from `from` (contact broken, Rigger 2 p. 48). */
export function hiddenFrom(st: Chase98, hider: string, from: string): Hide98 | null {
  if (!on('chase')) return null;
  return st.hides.find((h) => h.hider === hider && h.from.includes(from)) ?? null;
}

/** The record after a new turn's scores: last turn's positioning successes spent, hides kept. */
export function withScores(st: Chase98, o: { combatId: string; round: number; scores: Score98[] }): Chase98 {
  const kept = st.combatId === o.combatId ? st.hides : [];
  return { combatId: o.combatId, round: o.round, scores: o.scores.slice(0, LIST_CAP), carry: [], hides: kept };
}

/** The record with a positioning result for the next turn's Driver Points (Rigger 2 p. 46). */
export function withPositioning(st: Chase98, uuid: string, successes: number): Chase98 {
  const carry = st.carry.filter((c) => c.v !== uuid);
  if (whole(successes) > 0) carry.push({ v: uuid, pos: Math.min(60, whole(successes)) });
  return { ...st, carry: carry.slice(0, LIST_CAP) };
}

/** The record with a successful hide (Rigger 2 p. 48). */
export function withHide(st: Chase98, hider: string, from: string[], successes: number, round: number): Chase98 {
  const hides = st.hides.filter((h) => h.hider !== hider);
  if (whole(successes) > 0 && from.length) hides.push({ hider, from: from.filter(uuidOk).slice(0, 20), successes: Math.min(60, whole(successes)), round });
  return { ...st, hides: hides.slice(0, LIST_CAP) };
}

/** The record after `finder` relocates `hider` (Rigger 2 p. 49): it is no longer hidden from them; no one left, no bonus. */
export function withRelocated(st: Chase98, hider: string, finder: string): Chase98 {
  const hides = st.hides.map((h) => (h.hider === hider ? { ...h, from: h.from.filter((f) => f !== finder) } : h)).filter((h) => h.from.length);
  return { ...st, hides };
}

/** Driver Points (Rigger 2 pp. 41–42, 46, 48): the Open Test + last turn's positioning successes + the Escape Bonus. */
export function driverPoints(open: number, st: Chase98, uuid: string): number {
  const pos = st.carry.find((c) => c.v === uuid)?.pos ?? 0;
  return whole(open) + whole(pos) + escapeBonus(st, uuid);
}

/** The Relocating Test's TN rows (Rigger 2 p. 49), against the hiding vehicle's Signature. */
export function relocateMods(o: { mine: number | null; theirs: number | null; overSpeed: boolean; autonav: number; autonavOff: boolean; hideSuccesses: number; terrain: string }): TargetNumberModifier[] {
  const out: TargetNumberModifier[] = [];
  if (o.mine !== null && o.theirs !== null) {
    const d = scoreDiff('relocate', o.mine, o.theirs);
    if (d) out.push({ id: 'score98', label: tx('SR2E.VDrive98.Mod.score', { mine: o.mine, theirs: o.theirs }), value: d });
  }
  if (o.overSpeed) out.push({ id: 'overSpeed98', label: tx('SR2E.VDrive98.Mod.overSpeed'), value: CHASE98.overSpeed['relocate']! });
  const nav = autonavManeuver('relocate', o.autonav, o.autonavOff);
  if (nav) out.push(nav);
  if (whole(o.hideSuccesses)) out.push({ id: 'hidden98', label: tx('SR2E.VDrive98.Mod.hidden'), value: whole(o.hideSuccesses) });
  const t = num(CHASE98.relocateTerrain[o.terrain]);
  if (t) out.push({ id: 'terrain98', label: tx('SR2E.VDrive98.Mod.terrain', { terrain: o.terrain }), value: t });
  return out;
}

/** The Hiding Test's own terrain row (Rigger 2 p. 48), in place of the Driving Test's. */
export function hideTerrain(terrain: string): number {
  return num(CHASE98.hideTerrain[terrain]);
}

// ---------------------------------------------------------------- Passengers in a crash (Rigger 2 pp. 50, 53, 128)

/**
 * A passenger's crash or collision damage after the vehicle's safety gear (Rigger 2 pp. 50, 128): a seat belt stages it
 * down a level, APPS halves the Power (round up), a crash cage adds 6 dice; `cp` the rigger's Crash Test Control Pool
 * dice (`cpCarry`). Null when the belt stages it away.
 */
export function passengerSafety(o: { power: number; level: DamageLevel; belted: boolean; apps: boolean; cage: boolean; cp?: number }): { power: number; level: DamageLevel; dice: number } | null {
  let power = whole(o.power);
  let level: DamageLevel | null = o.level;
  let dice = 0;
  if (on('passengerSafety')) {
    if (o.belted) level = stageDown(level, 1);
    if (o.apps) power = Math.ceil(power / 2);
    if (o.cage) dice += CHASE98.crashCageDice;
  }
  if (on('cpCarry')) dice += Math.min(30, whole(o.cp));
  return level ? { power, level, dice } : null;
}

/** Whether the people aboard are hurt when the vehicle breaks through a wall (Rigger 2 p. 52: not when restrained). */
export function wallHurtsPassengers(belted: boolean): boolean {
  return !(on('walls') && on('passengerSafety') && belted);
}

/** Whether a hit on a passenger also does Light to the vehicle (Rigger 2 p. 53: a Deadly attack). */
export function deadlyPassengerHit(level: unknown): boolean {
  return on('deadlyPassenger') && level === 'D';
}

// ---------------------------------------------------------------- Called shots (Rigger 2 p. 53)

const ORDER: DamageLevel[] = ['L', 'M', 'S', 'D'];
/** Whether a called shot's damage to the vehicle knocks the part out (Rigger 2 p. 53); 'v971': any damage. */
export function partKnockedOut(part: string, level: DamageLevel | null, turret = false): boolean {
  if (!level) return false;
  if (!on('calledThreshold')) return true;
  const key = part === 'mount' && turret ? 'turret' : part;
  const need = (V().partThreshold as Record<string, DamageLevel>)[key] ?? 'M';
  return ORDER.indexOf(level) >= ORDER.indexOf(need);
}

// ---------------------------------------------------------------- Driving by datajack (Rigger 2 pp. 16, 124)

/** The Reaction a datajack driver gains (Rigger 2 p. 124: +1 driving by hand through a datajack). */
export function datajackReaction(o: { manual: boolean; ticked: boolean; datajack: boolean }): number {
  return on('datajackReaction') && o.manual && o.ticked && o.datajack ? 1 : 0;
}

// ---------------------------------------------------------------- The vehicle's fields (models/index.ts)

/**
 * v0.98.0: the new vehicle fields (`fields` is foundry.data.fields): off-road suspension, the autonav switched off,
 * Stress Points, seat belts worn by everyone aboard, APPS, a crash cage, and the Maneuver Score's vehicle type.
 */
export function vdrive98Fields(fields: any): Record<string, any> {
  return {
    offroadSuspension98: new fields.BooleanField({ required: true, initial: false }),
    autonavOff98: new fields.BooleanField({ required: true, initial: false }),
    stress98: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
    belted98: new fields.BooleanField({ required: true, initial: false }),
    apps98: new fields.BooleanField({ required: true, initial: false }),
    crashCage98: new fields.BooleanField({ required: true, initial: false }),
    vehicleType98: new fields.StringField({ required: true, blank: true, initial: '', choices: ['', ...VEHICLE_TYPES] }),
  };
}

/** The working Speed after the off-road rule (mutates `working`, adds its note). */
export function vdrive98Working(working: { speed: number; notes: string[] }, sys: any): void {
  const before = whole(working.speed);
  const after = offroadSpeed(before, { offroad: Boolean(sys?.offroad), suspension: Boolean(sys?.offroadSuspension98), category: String(sys?.category ?? '') });
  if (after !== before) { working.speed = after; working.notes.push(tx('SR2E.VDrive98.Text.offroadHalf', { speed: after })); }
}
