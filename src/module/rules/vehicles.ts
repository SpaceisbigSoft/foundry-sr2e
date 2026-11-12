import { RULES, type DamageLevel } from './config.ts';
import type { TargetNumberModifier } from './dice.ts';
import { stageDown, woundModifier, resistanceTargetNumber } from './damage.ts';
import { crashVehicleLevel, ramLevels, impactLevel } from './docs79-vehicles.ts';
import { VEHICLES_V923_OLD, REVAMP_VEHICLE_RULES } from './config923/vehicles.ts';
import { t as tx } from '../helpers/i18n.ts';

type V923 = typeof RULES.VEHICLES_V923;
/**
 * v0.92.3: a RULES.VEHICLES_V923 switch. Under the Unified Rules Revamp (RULES.URR_V80.active) a switch for a rule the
 * Revamp changes itself (REVAMP_VEHICLE_RULES) reads its v0.92.2 choice, so the Revamp's own URR_V80 switch decides
 * there as before; any other switch (a book correction the Revamp is silent on) reads the same under either source.
 */
export function veh923<K extends keyof V923>(k: K): V923[K] {
  if (RULES.URR_V80.active && REVAMP_VEHICLE_RULES.has(k) && Object.hasOwn(VEHICLES_V923_OLD, k)) return VEHICLES_V923_OLD[k] as V923[K];
  return RULES.VEHICLES_V923[k];
}

/** v0.92.3: the Driving Test's situational rows: RULES.VEHICLES.drivingModifiers (Rigger 2 p. 20), or the v0.92.2 rows. */
export function drivingRows(): ReadonlyArray<{ id: string; label: string; value: number }> {
  // Under the Revamp its patch sets RULES.VEHICLES.drivingModifiers itself.
  return RULES.URR_V80.active || RULES.VEHICLES_V923.drivingRows !== 'old' ? RULES.VEHICLES.drivingModifiers : RULES.VEHICLES_V923.oldDrivingRows;
}

/**
 * v0.92.3: the kind of vehicle test, for the rows that differ between the Driving Test and the combat maneuvers
 * (Rigger 2 pp. 20, 45–48, 52): 'driving' an ordinary Driving Test; 'maneuver' accelerating, braking, positioning;
 * 'ram' a ramming test; 'crash' a Crash Test; 'evasion' an evasive-driving defence (the old way only).
 */
export type DriveKind = 'driving' | 'maneuver' | 'ram' | 'crash' | 'evasion';

/** v0.92.3 (VEHICLES_V923.vcrTn 'byTest'): how many times the control rig's per-level TN counts on this kind of test. */
export function vcrTnFactor(kind: DriveKind | 'gunnery' | 'sensor'): number {
  if (veh923('vcrTn') !== 'byTest') return 1;
  return kind === 'driving' ? 2 : kind === 'maneuver' || kind === 'ram' ? 1 : 0;
}

/** v0.92.3 (VEHICLES_V923.crashMods 'book', Rigger 2 p. 52): the Crash Test's speed row against the driver's Reaction (null: none). */
export function crashSpeedModifier(speed: number, reaction: number): TargetNumberModifier | null {
  const c = RULES.VEHICLES_V923.crashSpeed;
  const sp = Math.max(0, Number(speed) || 0), r = Math.max(0, Number(reaction) || 0);
  if (!(sp > 0)) return null;
  const row = c.steps.find((x) => sp < r * x.below);
  const value = row ? row.value : c.above;
  return value ? { id: 'crashSpeed', label: tx('SR2E.Card.Mod.crashSpeed', { reaction: r }), value } : null;
}

/** v0.92.3 (VEHICLES_V923.damageInit 'book', Rigger 2 p. 49): the Initiative penalty from a vehicle's damage (1 / 2 / 3). */
export function vehicleDamageInitiative(boxes: number): number {
  if (veh923('damageInit') !== 'book') return 0;
  return vehicleDamageModifier(boxes);
}

/** Vehicles and rigging (v0.24.0). Pure rules, no Foundry dependency. All values in RULES.VEHICLES / RULES.RIGGING. */

export type ControlMode = 'autopilot' | 'manual' | 'jumped';
export const CONTROL_MODES: readonly ControlMode[] = ['autopilot', 'manual', 'jumped'];

/** The category entry for a vehicle (falls back to 'other'). */
export function vehicleCategory(id: string | null | undefined): { id: string; label: string; skill: string } {
  const list = RULES.VEHICLES.categories;
  return list.find((c) => c.id === id) ?? list.find((c) => c.id === 'other') ?? { id: 'other', label: 'Other', skill: '' };
}

/** The best installed control rig rating among cyberware (capped at RULES.RIGGING.maxVcr). */
export function controlRigRating(ware: ReadonlyArray<{ installed?: boolean; controlRig?: number }>): number {
  const best = ware.filter((w) => w.installed !== false).reduce((n, w) => Math.max(n, Math.floor(w.controlRig ?? 0)), 0);
  return Math.max(0, Math.min(RULES.RIGGING.maxVcr, best));
}

/**
 * A rigger's Reaction and initiative dice while jumped in: natural Reaction (+ cyber reflexes only if
 * RULES.RIGGING.cyberReflexesWhileRigging) + the rig's bonus per level.
 */
export function riggedStats(o: { reaction: number; cyberReaction: number; cyberDice: number; vcr: number }): { reaction: number; initiativeDice: number } {
  const r = RULES.RIGGING;
  const keep = r.cyberReflexesWhileRigging;
  const reaction = Math.max(0, o.reaction - (keep ? 0 : o.cyberReaction)) + r.vcr.reactionPerLevel * o.vcr;
  const dice = RULES.BASE_INITIATIVE_DICE + (keep ? o.cyberDice : 0) + r.vcr.initiativeDicePerLevel * o.vcr;
  return { reaction, initiativeDice: dice };
}

/** Control Pool size (0 without a control rig). */
export function controlPool(o: { reaction: number; riggedReaction: number; vcr: number }): number {
  if (o.vcr <= 0) return 0;
  return Math.max(0, RULES.RIGGING.controlPool.from === 'reaction' ? o.reaction : o.riggedReaction);
}

/** Autopilot Reaction and initiative dice for a vehicle driving itself. */
export function autopilotStats(rating: number): { reaction: number; initiativeDice: number } {
  const a = RULES.VEHICLES.autopilot;
  return { reaction: Math.max(0, rating) * a.reactionPerRating, initiativeDice: a.initiativeDice };
}

/** TN modifier from damage on the vehicle's condition track (same thresholds as wounds). */
export function vehicleDamageModifier(boxes: number): number {
  if (!RULES.VEHICLES.damageTnMods) return 0;
  return woundModifier({ physical: Math.max(0, Math.min(boxes, RULES.VEHICLES.conditionBoxes)), stun: 0 });
}

export function vehicleDestroyed(boxes: number): boolean {
  return boxes >= RULES.VEHICLES.conditionBoxes;
}

/** Handling (the base TN of a driving test): off-road uses the second Handling if the vehicle has one. */
export function handlingFor(v: { handling: number; handlingOffroad?: number }, offroad: boolean): number {
  return offroad && (v.handlingOffroad ?? 0) > 0 ? (v.handlingOffroad as number) : v.handling;
}

/** TN modifiers for a driving test (the base TN is the Handling). */
export function drivingModifiers(o: {
  terrain?: string; situational?: readonly string[]; damageBoxes?: number; mode: ControlMode; vcr?: number;
  /** v0.92.3: the kind of test (default an ordinary Driving Test). */
  kind?: DriveKind;
}): TargetNumberModifier[] {
  const v = RULES.VEHICLES;
  const kind: DriveKind = o.kind ?? 'driving';
  const out: TargetNumberModifier[] = [];
  const t = v.terrain.find((x) => x.id === (o.terrain ?? 'normal'));
  // v0.92.3: the Crash Test's and the Ramming Test's own terrain rows (Rigger 2 pp. 52, 48).
  const own = t && kind === 'crash' && veh923('crashMods') === 'book' ? RULES.VEHICLES_V923.crashTerrain[t.id]
    : t && kind === 'ram' && veh923('ram') === 'book' ? RULES.VEHICLES_V923.ramTerrain[t.id] : undefined;
  const tv = t ? (typeof own === 'number' ? own : t.value) : 0;
  if (t && tv) out.push({ label: t.label, value: tv });
  const rows = drivingRows();
  for (const id of o.situational ?? []) {
    const m = rows.find((x) => x.id === id);
    if (m && m.value) out.push({ label: m.label, value: m.value });
  }
  const dmg = vehicleDamageModifier(o.damageBoxes ?? 0);
  if (dmg) out.push({ id: 'vehicleDamage', label: tx('SR2E.Card.Mod.vehicleDamage'), value: dmg });
  // v0.92.3 (VEHICLES_V923.vcrTn 'byTest'): twice on a Driving Test, once on a maneuver, none on a crash test (Rigger 2 pp. 20, 45–48, 52).
  const f = vcrTnFactor(kind);
  if (o.mode === 'jumped' && (o.vcr ?? 0) > 0 && RULES.RIGGING.vcr.tnPerLevel && f) {
    out.push({ label: tx('SR2E.Card.Mod.controlRig', { vcr: o.vcr }), value: RULES.RIGGING.vcr.tnPerLevel * (o.vcr as number) * f });
  }
  return out;
}

/**
 * Damage coming in on a vehicle, before its Body test: normal (non anti-vehicle) weapons have their
 * Power and level lowered; armor at or above the Power stops it outright.
 */
export function vehicleIncomingDamage(o: { power: number; level: DamageLevel; armor: number; antiVehicle?: boolean; crash?: boolean; damageType?: string }): {
  power: number; level: DamageLevel | null; armor: number; stopped: boolean; tn: number; notes: string[];
} {
  const d = RULES.VEHICLES.damage;
  // v0.59.0: Stun damage (gel rounds, stun spells, stun batons) does nothing to a vehicle.
  if (o.damageType === 'stun' && !o.crash) return { power: o.power, level: null, armor: Math.max(0, o.armor), stopped: true, tn: RULES.MIN_TARGET_NUMBER, notes: [tx('SR2E.Text.Vehicles.stunDamageDoesNotHurt')] };
  let power = o.power;
  let level: DamageLevel | null = o.level;
  const notes: string[] = [];
  if (!o.antiVehicle && !o.crash) {
    const p = Math.floor(power * d.normalWeapons.powerMultiplier);
    const l = d.normalWeapons.levelDrop > 0 ? stageDown(o.level, d.normalWeapons.levelDrop) : o.level;
    if (p !== power || l !== level) notes.push(tx('SR2E.Text.Vehicles.notAntiVehicle'));
    power = p;
    level = l;
  }
  // v0.92.3 (VEHICLES_V923.avArmor 'half', Rigger 2 p. 53; Core p. 108): anti-vehicle fire loses only half the armor
  // (rounded down) and is never stopped by it.
  if (o.antiVehicle && !o.crash && veh923('avArmor') === 'half') {
    const half = Math.floor(Math.max(0, o.armor) / 2);
    if (half) notes.push(tx('SR2E.Text.Vehicles.antiVehicleHalfArmor', { half }));
    return { power, level, armor: half, stopped: level === null, tn: resistanceTargetNumber(power, half), notes };
  }
  const armor = Math.max(0, o.armor);
  const stopped = level === null || power <= 0 || (d.armorStops && armor > 0 && power <= armor);
  if (stopped && level !== null && power > 0) notes.push(tx('SR2E.Text.Vehicles.armorStopsPower', { armor, power }));
  return { power, level, armor, stopped, tn: resistanceTargetNumber(power, armor), notes };
}

/** Boxes on the vehicle's condition track after damage, and whether it was destroyed. */
export function applyVehicleDamage(before: number, level: DamageLevel | null): { after: number; boxes: number; destroyed: boolean } {
  const max = RULES.VEHICLES.conditionBoxes;
  const boxes = level ? RULES.BOXES_PER_LEVEL[level] : 0;
  const after = Math.min(max, Math.max(0, before) + boxes);
  return { after, boxes, destroyed: after >= max };
}

/** Crash damage from the vehicle's speed: for the vehicle and for everyone aboard. */
export function crashDamage(speed: number): { power: number; vehicleLevel: DamageLevel; passengerLevel: DamageLevel } {
  const c = RULES.VEHICLES.crash;
  // v0.92.3 (VEHICLES_V923.crashPower 'up', Rigger 2 p. 50): speed ÷ 10 rounded up, no minimum.
  const power = veh923('crashPower') === 'up' ? Math.ceil(Math.max(0, speed) / Math.max(1, c.speedPerPower))
    : Math.max(c.minPower, Math.floor(Math.max(0, speed) / Math.max(1, c.speedPerPower)));
  // v0.79.0 (RULES.DOCS_V79.vehCrashLevel 'speed', Rigger 2 Impact Damage Levels table): the vehicle's level by its speed.
  return { power, vehicleLevel: crashVehicleLevel(speed), passengerLevel: c.passengerLevel };
}

/** Feedback to a jumped-in rigger when the vehicle takes damage (null when none). */
export function riggerFeedback(o: { level: DamageLevel | null; power: number }): { tn: number; level: DamageLevel; type: 'stun' | 'physical'; attribute?: 'body' | 'willpower' } | null {
  const f = RULES.RIGGING.feedback;
  if (!f.enabled || !o.level) return null;
  // v0.92.3 (VEHICLES_V923.feedback 'book', Rigger 2 p. 49): only when the vehicle is left at Serious (6M Physical) or
  // Destroyed (6S Physical), resisted with Body (the numbers are the Revamp's URR_V80.vehFeedback rows, the same as the book's).
  if (veh923('feedback') === 'book') {
    const u = RULES.URR_V80.vehFeedback;
    const row = o.level === 'D' ? u.deadly : o.level === 'S' ? u.serious : null;
    return row ? { tn: Math.max(RULES.MIN_TARGET_NUMBER, Number(row.tn) || 0), level: row.level, type: 'physical', attribute: 'body' } : null;
  }
  const tn = Math.max(RULES.MIN_TARGET_NUMBER, f.tnFrom === 'power' ? o.power : f.fixedTn);
  return { tn, level: o.level, type: f.type };
}

/** Whether a speed is over the vehicle's Speed rating (pre-ticks the over-speed modifier). */
export function overSpeed(current: number, speed: number): boolean {
  return speed > 0 && current > speed;
}

/* ---- v0.25.0: vehicle combat, sensors, remote decks, chases ---- */

export type MountKind = 'none' | 'fixed' | 'turret' | 'pintle' | 'ring';
export type FirerRole = 'driver' | 'gunner' | 'autopilot' | 'security';

/** Who may fire a mounted weapon: fixed = driver or autopilot; turret = also a gunner aboard; pintle = a gunner only. A security rigger counts as the driver. */
export function canFireMount(mount: string, role: FirerRole): boolean {
  if (!mount || mount === 'none') return false;
  if (role === 'security') role = 'driver';
  // v0.79.0: a ring mount, like a pintle, can't be fired remotely: a gunner aboard only (Rigger 2 p131).
  if (mount === 'pintle' || mount === 'ring') return role === 'gunner';
  if (mount === 'fixed') return role !== 'gunner';
  return true;
}

/** The skill a mounted weapon is fired with: its own, or Gunnery. */
export function mountedSkill(weaponSkill: string | null | undefined): string {
  return (weaponSkill ?? '').trim() || RULES.VEHICLES.gunnerySkill;
}

/** TN modifiers for firing from (or at) a moving vehicle, the firing vehicle's damage and a sensor lock. */
export function vehicleFireModifiers(o: {
  firing?: { speed: number; currentSpeed: number; damageBoxes?: number; mounted?: boolean } | null;
  targetMoving?: boolean; sensorLock?: boolean;
}): TargetNumberModifier[] {
  const f = RULES.VEHICLES.firing;
  const out: TargetNumberModifier[] = [];
  const v = o.firing;
  if (v && v.currentSpeed > 0) {
    const fast = v.speed > 0 && v.currentSpeed > v.speed / 2;
    const value = fast ? f.fast : f.moving;
    if (value) out.push({ label: fast ? tx('SR2E.Card.Mod.firingFromAFastVehicle') : tx('SR2E.Card.Mod.firingFromAMovingVehicle'), value });
  }
  if (v?.mounted) {
    const dmg = vehicleDamageModifier(v.damageBoxes ?? 0);
    if (dmg) out.push({ id: 'vehicleDamage', label: tx('SR2E.Card.Mod.vehicleDamage'), value: dmg });
  }
  if (o.targetMoving && f.targetMoving) out.push({ id: 'targetInAMovingVehicle', label: tx('SR2E.Card.Mod.targetInAMovingVehicle'), value: f.targetMoving });
  if (o.sensorLock && RULES.VEHICLES.sensorLock.tn) out.push({ id: 'sensorLock', label: tx('SR2E.Card.Mod.sensorLock'), value: RULES.VEHICLES.sensorLock.tn });
  return out;
}

/**
 * v0.92.3 (RULES.VEHICLES_V923.gunneryMods 'book', Rigger 2 p. 57): manual gunnery from or at a vehicle: the relative
 * speed of firer and target, the target's size (a vehicle by its kind, a drone), a weapon fired from a vehicle out of a
 * mount, the firing vehicle's damage (a mounted weapon) and a sensor lock as before. Not sensor-enhanced fire.
 */
export function bookFireModifiers(o: {
  firing?: { speed: number; currentSpeed: number; damageBoxes?: number; mounted?: boolean } | null;
  sensorLock?: boolean; mounted?: boolean; targetSpeed?: number | null; target?: { vehicle: boolean; category?: string; drone?: boolean } | null;
}): TargetNumberModifier[] {
  const out = vehicleFireModifiers({ firing: o.firing ? { ...o.firing, currentSpeed: 0 } : null, targetMoving: false, ...(o.sensorLock !== undefined ? { sensorLock: o.sensorLock } : {}) });
  const inPlay = Boolean(o.firing) || (o.targetSpeed !== null && o.targetSpeed !== undefined) || Boolean(o.target?.vehicle);
  if (!inPlay) return out;
  const g = RULES.VEHICLES_V923.gunnerySpeed;
  const a = Math.max(0, Number(o.firing?.currentSpeed ?? 0) || 0), b = Math.max(0, Number(o.targetSpeed ?? 0) || 0);
  const floor = Math.max(1, Number(g.floor) || 1);
  if (a >= floor || b >= floor) {
    const hi = Math.max(a, b, floor), lo = Math.max(Math.min(a, b), floor);
    const ratio = hi / lo;
    if (ratio > g.equalRatio) {
      const row = g.steps.find((x) => ratio <= x.upTo);
      const value = row ? row.value : g.above;
      if (value) out.push({ id: 'relativeSpeed', label: tx('SR2E.Card.Mod.relativeSpeed', { ratio: Math.round(ratio * 10) / 10 }), value });
    }
  }
  if (o.target?.vehicle) {
    const u = RULES.URR_V80.vehGunnery;
    const value = o.target.drone ? Number(u.drone) || 0 : Number(u.sizes[String(o.target.category ?? 'other')] ?? u.sizes['other'] ?? 0) || 0;
    if (value) out.push({ id: 'targetSize', label: o.target.drone ? tx('SR2E.Card.Mod.targetSizeDrone') : tx('SR2E.Card.Mod.targetSize'), value });
  }
  if (o.firing && !o.mounted && g.unmounted) out.push({ id: 'unmountedWeapon', label: tx('SR2E.Card.Mod.unmountedWeapon'), value: g.unmounted });
  return out;
}

/** Damage passed on to the people aboard a vehicle that was hit (null when nothing gets through). */
export function passengerDamage(o: { power: number; level: DamageLevel | null; vehicleArmor: number }): { power: number; level: DamageLevel } | null {
  const p = RULES.VEHICLES.passengers;
  if (!p.enabled || !o.level) return null;
  const power = Math.max(0, o.power - Math.max(0, o.vehicleArmor));
  const level = stageDown(o.level, p.levelDrop);
  if (power <= 0 || !level) return null;
  return { power, level };
}

/** Ramming: the Power and level dealt, and the share the rammer takes. */
export function ramDamage(o: { body: number; currentSpeed: number; speed: number; otherSpeed?: number | null; pedestrian?: boolean }): { power: number; level: DamageLevel; selfPower: number; selfLevel: DamageLevel | null; bodyPerSuccess?: number; rammingSpeed?: number } {
  const r = RULES.VEHICLES.ram;
  // v0.92.3 (VEHICLES_V923.ram 'book', Rigger 2 pp. 47, 50, 52): the difference in speed ÷ 10 (rounded up), the level by
  // that difference; the rammer takes the same less Body × its test's successes (applied when the ram resolves). A
  // pedestrian: the rammer's speed ÷ 10 at one level higher (Destroyed: + half the Power), the vehicle one level lower.
  if (veh923('ram') === 'book') {
    const mine = Math.max(0, Number(o.currentSpeed) || 0);
    const diff = o.pedestrian || o.otherSpeed === null || o.otherSpeed === undefined ? mine : Math.abs(mine - Math.max(0, Number(o.otherSpeed) || 0));
    const per = Math.max(1, r.speedPerPower);
    if (o.pedestrian) {
      const base = Math.max(1, Math.ceil(diff / per));
      const tableLevel = impactLevel(diff);
      const up: Record<DamageLevel, DamageLevel> = { L: 'M', M: 'S', S: 'D', D: 'D' };
      const power = tableLevel === 'D' ? base + Math.floor(base / 2) : base;
      const selfLevel = stageDown(tableLevel, 1);
      return { power, level: up[tableLevel], selfPower: selfLevel ? base : 0, selfLevel, rammingSpeed: diff };
    }
    const power = Math.max(1, Math.ceil(diff / per));
    const level = impactLevel(diff);
    return { power, level, selfPower: power, selfLevel: level, bodyPerSuccess: Math.max(0, Math.floor(Number(o.body) || 0)), rammingSpeed: diff };
  }
  const power = Math.max(1, o.body + Math.floor(Math.max(0, o.currentSpeed) / Math.max(1, r.speedPerPower)));
  // v0.79.0 (RULES.DOCS_V79.vehRamLevel 'speed', Rigger 2 Impact Damage Levels table): the level by the rammer's speed, the
  // rammer at the same level; 'half': the old M / S above half Speed, the rammer a level lower.
  const { level, selfLevel } = ramLevels({ currentSpeed: o.currentSpeed, speed: o.speed });
  return { power, level, selfPower: Math.floor(power * r.selfFraction), selfLevel };
}

/**
 * v0.92.3 (RULES.VEHICLES_V923.ram 'book', Rigger 2 p. 47): the rammer's own Power after its Body × the ramming test's
 * successes come off (never below the minimum TN, as the book's example). Without `bodyPerSuccess` (the old way, or the
 * Revamp) the Power as it was.
 */
export function ramSelfPower(ram: { power: number; bodyPerSuccess?: number }, successes: number): number {
  if (ram.bodyPerSuccess === undefined) return ram.power;
  return Math.max(RULES.MIN_TARGET_NUMBER, Math.floor(Number(ram.power) || 0) - Math.max(0, Math.floor(Number(ram.bodyPerSuccess) || 0)) * Math.max(0, Math.floor(Number(successes) || 0)));
}

/** Sensor test TN against a target: its Signature plus its ECM beyond the scanner's ECCM. */
export function sensorTarget(o: { signature: number; targetEcm?: number; scannerEccm?: number }): { tn: number; modifiers: TargetNumberModifier[] } {
  const ecm = Math.max(0, (o.targetEcm ?? 0) - (o.scannerEccm ?? 0));
  return { tn: Math.max(RULES.MIN_TARGET_NUMBER, o.signature), modifiers: ecm ? [{ label: tx('SR2E.Card.Mod.ecm', { num: o.targetEcm, part: o.scannerEccm ? tx('SR2E.Card.Vehicles.eccm', { scannerEccm: o.scannerEccm }) : '' }), value: ecm }] : [] };
}

/** How many drones a remote control deck holds. */
export function rcdCapacity(rating: number): number {
  return Math.max(0, Math.floor(rating)) * RULES.RIGGING.remote.dronesPerRating;
}

/** Positioning TN modifier for having more current speed than the other vehicle. */
export function chaseSpeedModifier(mine: number, theirs: number): number {
  const c = RULES.VEHICLES.chase;
  const steps = Math.floor(Math.max(0, mine - theirs) / Math.max(1, c.speedStep));
  if (!steps || !c.speedTnPerStep) return 0;
  const v = steps * c.speedTnPerStep;
  // v0.50.0: capped at the size of maxSpeedTn either way (a house rule with a positive step used to flip it).
  const cap = Math.abs(c.maxSpeedTn);
  return c.speedTnPerStep < 0 ? Math.max(-cap, v) : Math.min(cap, v);
}

/**
 * One chase turn: the gap changes with relative speed, then the positioning tests' net successes
 * move it in the winner's favour (the pursuer closes, the quarry pulls away). Never below 0.
 */
export function chaseTurn(o: { metres: number; pursuerSpeed: number; quarrySpeed: number; pursuerSuccesses: number; quarrySuccesses: number }): { metres: number; drift: number; shift: number; winner: 'pursuer' | 'quarry' | 'none' } {
  const c = RULES.VEHICLES.chase;
  const drift = (o.quarrySpeed - o.pursuerSpeed) * c.metresPerSpeed;
  const net = o.pursuerSuccesses - o.quarrySuccesses;
  const shift = -net * c.metresPerNet;
  return { metres: Math.max(0, Math.round((o.metres + drift + shift) * 10) / 10), drift, shift, winner: net > 0 ? 'pursuer' : net < 0 ? 'quarry' : 'none' };
}
