/**
 * v0.80.0, the "SR2E Unified Rules Revamp" rules source (area: vehicles): pure functions. Each reads its switch in
 * RULES.URR_V80 (config80-vehicles.ts) and behaves the book way while the switch is at its shipped value.
 */
import { RULES, type DamageLevel } from './config.ts';
import type { TargetNumberModifier } from './dice.ts';
import { stageDown, resistanceTargetNumber } from './damage.ts';
import { crashDamage, ramDamage, passengerDamage, riggerFeedback, vehicleIncomingDamage, vehicleFireModifiers } from './vehicles.ts';
import { impactLevel } from './docs79-vehicles.ts';
import { t as tx } from '../helpers/i18n.ts';

const U = () => RULES.URR_V80;
const num = (x: unknown): number => { const v = Number(x); return Number.isFinite(v) ? v : 0; };

/** The damage level a vehicle's condition track is at (null when undamaged). */
export function veh80ConditionLevel(boxes: number): DamageLevel | null {
  const b = Math.max(0, Math.floor(num(boxes)));
  const per = RULES.BOXES_PER_LEVEL;
  if (b >= per.D) return 'D';
  if (b >= per.S) return 'S';
  if (b >= per.M) return 'M';
  if (b >= per.L) return 'L';
  return null;
}

// ---------------------------------------------------------------- Control Pool (URR)

/** Control Pool dice on a driving test: at most the skill dice rolled under 'skill'; as asked under 'none' (book). */
export function veh80PoolCap(asked: number, skillDice: number): number {
  if (U().vehCpCap !== 'skill') return asked;
  return Math.min(Math.max(0, Math.floor(num(asked))), Math.max(0, Math.floor(num(skillDice))));
}

/** The pool a mounted weapon's firer rolls: a jumped-in driver uses the Combat Pool under 'combat' (book: the Control Pool). */
export function veh80GunneryPool(bookPool: 'control' | 'combat', role: string | null | undefined): 'control' | 'combat' {
  if (bookPool === 'control' && role === 'driver' && U().vehCpGunnery === 'combat') return 'combat';
  return bookPool;
}

/** Control Pool dice a jumped-in rigger adds to the vehicle's damage resistance (0 unless vehCpResist). */
export function veh80ResistPool(asked: number, left: number): number {
  if (!U().vehCpResist) return 0;
  return Math.max(0, Math.min(Math.floor(num(asked)), Math.floor(num(left))));
}

// ---------------------------------------------------------------- rigger feedback (URR)

export interface Veh80Feedback { tn: number; level: DamageLevel; type: 'stun' | 'physical'; attribute?: 'body' | 'willpower' }

/** Feedback to a jumped-in rigger. 'urr': a Serious hit 6M, a Deadly hit 6S, Body, Physical; nothing below. 'book': riggerFeedback. */
export function veh80Feedback(o: { level: DamageLevel | null; power: number }): Veh80Feedback | null {
  const f = U().vehFeedback;
  if (f.mode !== 'urr') return riggerFeedback(o);
  const row = o.level === 'D' ? f.deadly : o.level === 'S' ? f.serious : null;
  if (!row) return null;
  return { tn: Math.max(RULES.MIN_TARGET_NUMBER, num(row.tn)), level: row.level, type: f.type, attribute: f.attribute };
}

// ---------------------------------------------------------------- damage to vehicles (URR)

/** How a hit on a vehicle came about (carried on the damage as `vehHit` under the Revamp). */
export interface Veh80Hit { impact?: boolean; spell?: boolean; basePower?: number }

/** Levels staged down automatically by the vehicle's Body. */
export function veh80AutoStage(body: number): number {
  const d = U().vehDamage;
  const b = Math.max(0, Math.floor(num(body)));
  for (const row of d.autoStage) if (b <= row.maxBody) return row.steps;
  return d.autoStageAbove;
}

export interface Veh80IncomingInput {
  power: number; level: DamageLevel; armor: number; antiVehicle?: boolean; crash?: boolean; damageType?: string;
  /** The Revamp's inputs: the vehicle's Body and its full Armor, whether ammo already cut the armor, the hit's kind. */
  body?: number; rawArmor?: number; armorMultiplied?: boolean; ignoreArmor?: boolean; hit?: Veh80Hit | null;
}

/**
 * Damage coming in on a vehicle, before its Body test. 'book': vehicleIncomingDamage. 'urr': impacts at their Power
 * (no armor); combat spells Power − half the armor, no automatic staging, never stopped; weapons Power − (Body + Armor)
 * (at least minPower), armor halved by anti-vehicle or armor-piercing rounds, a base Power not above the armor stops it,
 * the level staged down by Body (not for anti-vehicle; one step less for a high-Power weapon), below Light nothing.
 */
export function veh80Incoming(o: Veh80IncomingInput): ReturnType<typeof vehicleIncomingDamage> {
  const d = U().vehDamage;
  const book = vehicleIncomingDamage({ power: o.power, level: o.level, armor: o.armor, ...(o.antiVehicle ? { antiVehicle: true } : {}), ...(o.crash ? { crash: true } : {}), ...(o.damageType ? { damageType: o.damageType } : {}) });
  if (d.mode !== 'urr') return book;
  if (o.damageType === 'stun' && !o.crash) return book;
  const hit = o.hit ?? {};
  const power = Math.floor(num(o.power));
  const notes: string[] = [];
  if (o.crash || hit.impact) {
    const stopped = power <= 0;
    return { power, level: o.level, armor: 0, stopped, tn: resistanceTargetNumber(Math.max(0, power), 0), notes: [tx('SR2E.Text.Urr80Vehicles.impactArmorDoesNotCount')] };
  }
  const raw = Math.max(0, Math.floor(num(o.rawArmor ?? o.armor)));
  const half = Math.floor(raw * d.armorFactor);
  if (hit.spell) {
    const p = power - half;
    if (half) notes.push(tx('SR2E.Text.Urr80Vehicles.halfArmor', { half }));
    return { power: Math.max(d.minPower, p), level: o.level, armor: 0, stopped: false, tn: resistanceTargetNumber(Math.max(d.minPower, p), 0), notes };
  }
  const armor = o.ignoreArmor ? 0 : o.antiVehicle || o.armorMultiplied ? half : raw;
  const body = Math.max(0, Math.floor(num(o.body)));
  const base = hit.basePower !== undefined ? Math.floor(num(hit.basePower)) : power;
  if (armor > 0 && base <= armor) {
    return { power, level: null, armor, stopped: true, tn: resistanceTargetNumber(power, 0), notes: [tx('SR2E.Text.Urr80Vehicles.armorStopsPower', { armor, power: base })] };
  }
  const reduced = power - (body + armor);
  const p = reduced > 0 ? reduced : d.minPower;
  notes.push(armor ? tx('SR2E.Text.Urr80Vehicles.powerMinusBodyArmor', { body, armor }) : tx('SR2E.Text.Urr80Vehicles.powerMinusBody', { body }));
  let steps = o.antiVehicle ? 0 : veh80AutoStage(body);
  if (steps && base >= d.highPower) steps -= 1;
  const level = steps > 0 ? stageDown(o.level, steps) : o.level;
  if (steps > 0) notes.push(tx('SR2E.Text.Urr80Vehicles.stagedDownByBody', { steps }));
  return { power: p, level, armor: 0, stopped: level === null, tn: resistanceTargetNumber(p, 0), notes };
}

// ---------------------------------------------------------------- passengers (URR)

/** What a hit on the vehicle does to the people aboard. 'urr': only an impact, at the vehicle's Power and level. */
export function veh80PassengerDamage(o: { power: number; level: DamageLevel | null; vehicleArmor: number; impact?: boolean }): { power: number; level: DamageLevel } | null {
  if (U().vehPassengers !== 'urr') return passengerDamage({ power: o.power, level: o.level, vehicleArmor: o.vehicleArmor });
  if (!o.impact || !o.level) return null;
  const power = Math.floor(num(o.power));
  return power > 0 ? { power, level: o.level } : null;
}

/** The level a crash does to the people aboard: the vehicle's under 'urr', the book's fixed level otherwise. */
export function veh80CrashPassengerLevel(bookLevel: DamageLevel, vehicleLevel: DamageLevel): DamageLevel {
  return U().vehPassengers === 'urr' ? vehicleLevel : bookLevel;
}

/** The vehicle's protection for someone shot inside it: its Armor (book), or the higher of Body and Armor. */
export function veh80OccupantArmor(o: { body: number; armor: number }): number {
  const armor = Math.max(0, num(o.armor));
  return U().vehOccupantArmor === 'higher' ? Math.max(armor, Math.max(0, num(o.body))) : armor;
}

// ---------------------------------------------------------------- impacts: crashes and rams (URR)

/** Crash damage: the book's, with the Power rounded up under 'urr'. */
export function veh80CrashDamage(speed: number): ReturnType<typeof crashDamage> {
  const c = crashDamage(speed);
  if (U().vehImpact !== 'urr') return c;
  const r = RULES.VEHICLES.crash;
  return { ...c, power: Math.max(r.minPower, Math.ceil(Math.max(0, num(speed)) / Math.max(1, r.speedPerPower))) };
}

/** A vehicle's Body + half its Armor (round down). */
export function veh80BodyArmorFactor(body: number, armor: number): number {
  return Math.max(0, Math.floor(num(body))) + Math.floor(Math.max(0, num(armor)) / 2);
}

/**
 * Ramming. 'book': ramDamage. 'urr': the ramming speed (the rammer's, or in a chase between the two the difference of
 * their speeds) ÷ 10, round up; the level by the speed table; the rammer takes the same less its Body-Armor factor.
 */
export function veh80RamDamage(o: { body: number; armor?: number; currentSpeed: number; speed: number; otherSpeed?: number | null }): ReturnType<typeof ramDamage> & { rammingSpeed?: number } {
  if (U().vehImpact !== 'urr') return ramDamage({ body: o.body, currentSpeed: o.currentSpeed, speed: o.speed });
  const mine = Math.max(0, num(o.currentSpeed));
  const rs = o.otherSpeed === null || o.otherSpeed === undefined ? mine : Math.abs(mine - Math.max(0, num(o.otherSpeed)));
  const power = Math.max(1, Math.ceil(rs / Math.max(1, RULES.VEHICLES.ram.speedPerPower)));
  const level = impactLevel(rs);
  const selfPower = Math.max(0, power - veh80BodyArmorFactor(o.body, o.armor ?? 0));
  return { power, level, selfPower, selfLevel: selfPower > 0 ? level : null, rammingSpeed: rs };
}

// ---------------------------------------------------------------- damage slows a vehicle (house rule for the Revamp, not in the URR)

/** The working Speed after damage: Moderate × moderate, Serious or worse × serious (round down) under 'urr'. */
export function veh80DamagedSpeed(speed: number, boxes: number): { speed: number; note: string } {
  const s = Math.max(0, num(speed));
  const d = U().vehDamageSpeed;
  if (d.mode !== 'urr') return { speed: s, note: '' };
  const lv = veh80ConditionLevel(boxes);
  const f = lv === 'S' || lv === 'D' ? d.serious : lv === 'M' ? d.moderate : 1;
  if (f === 1) return { speed: s, note: '' };
  const out = Math.floor(s * f);
  return { speed: out, note: tx('SR2E.Text.Urr80Vehicles.damageSpeed', { f }) };
}

// ---------------------------------------------------------------- manual gunnery (URR)

/** The speed-difference modifier between a firing vehicle and its target (0 when roughly equal). */
export function veh80SpeedDifference(firer: number, target: number): TargetNumberModifier | null {
  const g = U().vehGunnery;
  const a = Math.max(0, num(firer)), b = Math.max(0, num(target));
  const hi = Math.max(a, b), lo = Math.min(a, b);
  if (hi <= 0) return null;
  const ratio = lo > 0 ? hi / lo : Infinity;
  if (ratio <= g.equalRatio) return null;
  const row = g.steps.find((s) => ratio <= s.upTo);
  const value = row ? row.value : g.above;
  return value ? { label: tx('SR2E.Card.Mod.speedDifference', { part: lo > 0 ? `×${Math.round(ratio * 10) / 10}` : tx('SR2E.Card.Urr80Vehicles.oneStopped') }), value } : null;
}

/** The target-size modifier: a drone, or a vehicle by its category; anything else 0. */
export function veh80TargetSize(t: { vehicle: boolean; category?: string; drone?: boolean } | null | undefined): TargetNumberModifier | null {
  if (!t?.vehicle) return null;
  const g = U().vehGunnery;
  const value = t.drone ? g.drone : num(g.sizes[String(t.category ?? 'other')] ?? g.sizes['other'] ?? 0);
  return value ? { label: t.drone ? tx('SR2E.Card.Mod.targetSizeDrone') : tx('SR2E.Card.Mod.targetSize'), value } : null;
}

export type Veh80FireInput = Parameters<typeof vehicleFireModifiers>[0] & {
  mounted?: boolean; still?: boolean; targetSpeed?: number | null; target?: { vehicle: boolean; category?: string; drone?: boolean } | null;
};

/**
 * Fire modifiers for vehicles. 'book' (or not a mounted weapon, or sensor-enhanced): vehicleFireModifiers. 'urr', a
 * mounted weapon at a target in or that is a vehicle: the speed difference replaces the moving modifiers, plus the
 * target's size; the firing vehicle's damage and a flat sensor lock as before.
 */
export function veh80FireModifiers(o: Veh80FireInput): TargetNumberModifier[] {
  const base = { firing: o.firing ?? null, ...(o.targetMoving !== undefined ? { targetMoving: o.targetMoving } : {}), ...(o.sensorLock !== undefined ? { sensorLock: o.sensorLock } : {}) };
  if (U().vehGunnery.mode !== 'urr' || !o.mounted || o.still || o.targetSpeed === null || o.targetSpeed === undefined) return vehicleFireModifiers(base);
  const out = vehicleFireModifiers({ ...base, firing: o.firing ? { ...o.firing, currentSpeed: 0 } : null, targetMoving: false });
  const sd = veh80SpeedDifference(num(o.firing?.currentSpeed), num(o.targetSpeed));
  if (sd) out.push(sd);
  const size = veh80TargetSize(o.target);
  if (size) out.push(size);
  return out;
}

/** Whether a heavy weapon's recoil is doubled: not on a vehicle mount under 'ignore'. */
export function veh80HeavyRecoil(heavy: boolean, mounted: boolean): boolean {
  return Boolean(heavy) && !(mounted && U().vehMountHeavy === 'ignore');
}

// ---------------------------------------------------------------- repair (URR)

/** The repair test's TN: by the worst damage stage under 'stage' (L/M/S/D), else the book's flat TN. */
export function veh80RepairTn(boxes: number, bookTn: number): number {
  const r = U().vehRepairTn;
  if (r.mode !== 'stage') return bookTn;
  const lv = veh80ConditionLevel(boxes);
  return lv ? Math.max(RULES.MIN_TARGET_NUMBER, num(r.tn[lv])) : bookTn;
}
