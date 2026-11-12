import { RULES, type DamageLevel } from './config.ts';
import type { TargetNumberModifier } from './dice.ts';
import type { LightLevel, Vision } from './weapons.ts';
import { lightModifier } from './situation.ts';
import { dsCasingModifiers, dsLockToolStep } from './urr80-drones-security.ts';
import { finiteNum, levelIndex, sameCombatRound } from './util.ts';
import { veh923 } from './vehicles.ts';
import { t as tx } from '../helpers/i18n.ts';

/**
 * v0.57.0 roadwork: acceleration, crash tests after damage, called shots at vehicles, Rigger 2
 * maneuver scores, sensor-enhanced gunnery, vehicle design and maglock bypassing. Pure rules; all
 * values read from RULES.VEHICLES_V57 / RULES.SECURITY_V57 at call time.
 */

const V = () => RULES.VEHICLES_V57;
const S = () => RULES.SECURITY_V57;
/** A real finite number or 0 (numeric strings count as 0). */
const n = finiteNum;

// --- Acceleration

/** The most a vehicle's speed may change in one Combat Turn (braking: × brakeMultiplier). */
export function speedChangeLimit(o: { accel: number; from: number; to: number; extra?: number }): { allowed: boolean; max: number; braking: boolean; change: number } {
  const a = V().accel;
  const change = n(o.to) - n(o.from);
  const braking = change < 0;
  const base = Math.max(0, n(o.accel)) + Math.max(0, n(o.extra));
  // v0.92.3 (RULES.VEHICLES_V923.accel 'book', Rigger 2 p. 22): safe braking up to Acceleration × 4 in a Combat Turn.
  const mult = veh923('accel') === 'book' ? n(RULES.VEHICLES_V923.brakeMultiplier) : a.brakeMultiplier;
  const max = braking ? base * mult : base;
  return { allowed: Math.abs(change) <= max, max, braking, change };
}

/** Clamp a requested speed to what this Combat Turn allows from turnStart (never below 0). */
export function clampSpeed(o: { accel: number; turnStart: number; to: number; extra?: number }): { speed: number; clamped: boolean; limit: number } {
  const from = n(o.turnStart);
  const to = n(o.to);
  const limit = speedChangeLimit({ accel: o.accel, from, to, extra: o.extra }).max;
  const speed = Math.max(0, Math.min(from + limit, Math.max(from - limit, to)));
  return { speed, clamped: speed !== to, limit };
}

/** A push test: extra = successes × perSuccess × accel; crash on a disaster. */
export function pushResult(successes: number, disaster: boolean, accel: number): { extra: number; crash: boolean } {
  const s = Math.max(0, Math.floor(n(successes)));
  return { extra: s > 0 ? s * V().accel.perSuccess * Math.max(0, n(accel)) : 0, crash: !!disaster };
}

/** Whether a speed change is limited at all (in combat, or always when outsideCombat is 'limited'). */
export function speedLimited(inCombat: boolean): boolean {
  const a = V().accel;
  return !!a.enabled && (!!inCombat || a.outsideCombat === 'limited');
}

// --- Crash test after damage

/** Whether damage of `level` to a moving, intact vehicle calls for a crash test. */
export function crashTestAfterDamage(level: DamageLevel | null, moving: boolean, destroyed: boolean): boolean {
  const c = V().crashAfterDamage;
  if (!c.enabled || !level || !moving || destroyed) return false;
  const at = levelIndex(c.at);
  return at >= 0 && levelIndex(level) >= at;
}

// --- Called shots at vehicles

type PartRow = { id: string; label: string; crashTn?: number; handling?: number; sensor?: number; speedFactor?: number; tn?: number; armorCounts?: boolean };

/** The calledShots.parts row, or null. */
export function vehiclePart(id: string | null | undefined): PartRow | null {
  if (!id) return null;
  return V().calledShots.parts.find((p) => p.id === id) ?? null;
}

/** The TN modifier for a called shot at part of a vehicle. */
export function vehicleCalledShotModifier(id: string): { label: string; value: number } {
  const c = V().calledShots;
  const p = vehiclePart(id);
  return { label: tx('SR2E.Card.Mod.calledShot', { label: p?.label ?? id }), value: n(c.tn) + n(p?.tn) };
}

/** The working stats of a vehicle with damaged systems, with one note per damaged system. */
export function vehicleSystemsEffect(systems: { tires?: boolean; sensors?: boolean; engine?: boolean }, base: { handling: number; handlingOffroad: number; sensor: number; speed: number }): { handling: number; handlingOffroad: number; sensor: number; speed: number; notes: string[] } {
  const out = { handling: n(base.handling), handlingOffroad: n(base.handlingOffroad), sensor: n(base.sensor), speed: n(base.speed), notes: [] as string[] };
  const tires = systems.tires ? vehiclePart('tires') : null;
  if (tires) {
    const h = n(tires.handling);
    out.handling += h;
    if (out.handlingOffroad > 0) out.handlingOffroad += h;
    out.notes.push(tx('SR2E.Text.Roadwork.tiresShotOut', { h }));
  }
  const sensors = systems.sensors ? vehiclePart('sensors') : null;
  if (sensors) {
    const s = n(sensors.sensor);
    out.sensor = Math.max(0, out.sensor - s);
    out.notes.push(tx('SR2E.Text.Roadwork.sensorsDamaged', { s }));
  }
  const engine = systems.engine ? vehiclePart('engine') : null;
  if (engine) {
    const f = engine.speedFactor ?? 1;
    out.speed = Math.floor(out.speed * f);
    out.notes.push(tx('SR2E.Text.Roadwork.engineDamaged', { f }));
  }
  return out;
}

// --- Rigger 2 maneuver scores

/** A maneuver score: successes + speed points (speed / speedPerPoint, at most maxSpeedPoints). */
export function maneuverScore(o: { successes: number; speed: number }): number {
  const m = V().maneuver;
  const per = n(m.speedPerPoint);
  const pts = per > 0 ? Math.min(n(m.maxSpeedPoints), Math.floor(Math.max(0, n(o.speed)) / per)) : 0;
  return Math.max(0, n(o.successes)) + pts;
}

/** Compare two maneuver scores: winner, net, and the TN shift it earns. */
export function maneuverPosition(a: number, b: number): { winner: 'a' | 'b' | 'none'; net: number; tn: number } {
  const m = V().maneuver;
  const net = Math.abs(n(a) - n(b));
  const winner = n(a) > n(b) ? 'a' : n(b) > n(a) ? 'b' : 'none';
  const per = n(m.netPerTn);
  const tn = winner !== 'none' && per > 0 ? Math.min(n(m.maxTn), Math.floor(net / per)) : 0;
  return { winner, net, tn };
}

/** v0.81.1 (RA2-4): `combatId` the combat whose round `round` is ('' or missing on positions from before v0.81.1). */
export interface VehiclePosition { winnerUuid: string; loserUuid: string; tn: number; round: number; combatId?: string }

/**
 * The maneuver-position TN modifier for firer's vehicle firing at target's this Combat Turn, or null. v0.81.1 (RA2-4):
 * with `combatId` (the combat `round` belongs to), a position won in another combat's round of the same number doesn't
 * count; without it, rounds are compared as before.
 */
export function positionModifier(pos: VehiclePosition | null | undefined, firerUuid: string, targetUuid: string, round: number | null, combatId?: string | null): TargetNumberModifier | null {
  if (V().maneuver.mode !== 'score' || !pos || round == null || pos.round !== round || !(pos.tn > 0)) return null;
  if (!sameCombatRound({ round: pos.round, combatId: pos.combatId }, { round, combatId })) return null;
  if (firerUuid === pos.winnerUuid && targetUuid === pos.loserUuid) return { id: 'maneuverPosition', label: tx('SR2E.Card.Mod.maneuverPosition'), value: -pos.tn };
  if (firerUuid === pos.loserUuid && targetUuid === pos.winnerUuid) return { id: 'outManeuvered', label: tx('SR2E.Card.Mod.outManeuvered'), value: pos.tn };
  return null;
}

// --- Sensor-enhanced gunnery

/** Sensor-enhanced gunnery by sensorGunnery mode ('flat' TN bonus or 'signature' replacing range). */
export function sensorGunnery(o: { lock: boolean; signature: number; rangeTn: number; sensor: number; gunneryDice: number }): { modifiers: TargetNumberModifier[]; dice: number; replaceRange: boolean; note: string } {
  const dice = n(o.gunneryDice);
  if (!o.lock) return { modifiers: [], dice, replaceRange: false, note: '' };
  if (V().sensorGunnery !== 'signature') {
    const tn = n(RULES.VEHICLES.sensorLock.tn);
    return { modifiers: tn ? [{ id: 'sensorLock', label: tx('SR2E.Card.Mod.sensorLock'), value: tn }] : [], dice, replaceRange: false, note: tx('SR2E.Text.Roadwork.sensorLock') };
  }
  const diff = n(o.signature) - n(o.rangeTn);
  const sensor = n(o.sensor);
  const capped = sensor > 0 && sensor < dice;
  return {
    modifiers: diff ? [{ label: tx('SR2E.Card.Mod.sensorLockSignatureInsteadOfRange', { num: o.signature, num2: o.rangeTn }), value: diff }] : [],
    dice: sensor > 0 ? Math.min(dice, sensor) : dice,
    replaceRange: true,
    note: capped ? tx('SR2E.Text.Roadwork.sensorLockSignatureCapped', { sensor }) : tx('SR2E.Text.Roadwork.sensorLockSignature'),
  };
}

// --- Vehicle design

type DesignStats = { body: number; handling: number; speed: number; accel: number; armor: number; signature: number; cf: number; mounts: number };

/** Build a vehicle from a chassis, a powerplant and design points spent on stats; null if unknown. */
export function designVehicle(o: { chassis: string; powerplant: string; spend: Record<string, number> }): { stats: DesignStats; points: { total: number; spent: number; left: number }; cost: number; warnings: string[] } | null {
  const d = V().design;
  const ch = d.chassis.find((c) => c.id === o.chassis);
  const pp = d.powerplants.find((p) => p.id === o.powerplant);
  if (!ch || !pp) return null;
  const costs = d.pointCosts;
  const steps = (k: string) => (costs[k] ? Math.max(0, Math.floor(n(o.spend?.[k]))) : 0);
  const add = (k: string) => steps(k) * n(costs[k]?.step);
  const stats: DesignStats = {
    body: ch.body + add('body'),
    handling: Math.max(1, ch.handling + add('handling')),
    speed: Math.floor(ch.speed * pp.speed) + add('speed'),
    accel: Math.floor(ch.accel * pp.accel) + add('accel'),
    armor: ch.armor + add('armor'),
    signature: ch.signature + add('signature'),
    cf: ch.cf + add('cf'),
    mounts: add('mounts'),
  };
  let spent = 0;
  let cost = ch.cost + pp.cost;
  for (const k of Object.keys(costs)) {
    spent += steps(k) * n(costs[k]?.points);
    cost += steps(k) * n(costs[k]?.nuyen);
  }
  const left = ch.points - spent;
  const warnings: string[] = [];
  if (left < 0) warnings.push(tx('SR2E.Text.Roadwork.overTheDesignPoints'));
  if (stats.armor > stats.body * n(d.maxArmorPerBody)) warnings.push(tx('SR2E.Text.Roadwork.armorAboveBody', { max: d.maxArmorPerBody }));
  return { stats, points: { total: ch.points, spent, left }, cost, warnings };
}

// --- Maglocks

type LockRow = { id: string; label: string; tn: number; tools: readonly string[] };
type ToolRow = { id: string; label: string; mode: 'dice' | 'replace' | 'tn' | 'deception'; kit: boolean };

/** The SECURITY_V57.lockTypes row (unknown → the '' row). */
export function lockTypeOf(id: string | null | undefined): LockRow {
  const list = S().lockTypes;
  return list.find((l) => l.id === (id ?? '')) ?? list.find((l) => l.id === '') ?? { id: '', label: tx('SR2E.Text.Roadwork.notSet'), tn: 0, tools: [] };
}

/** The SECURITY_V57.tools row or null. */
export function bypassTool(kind: string | null | undefined): ToolRow | null {
  if (!kind) return null;
  return S().tools.find((t) => t.id === kind) ?? null;
}

/** The light modifier at a lock, scaled by SECURITY_V57.light.factor (rounded up); null when none. */
function lockLight(light: LightLevel | null, vision: Vision): TargetNumberModifier | null {
  const l = S().light;
  if (!l.enabled) return null;
  const m = lightModifier(light, vision);
  if (!m || !(m.value > 0)) return null;
  const value = Math.ceil(m.value * n(l.factor));
  return value ? { label: m.label, value } : null;
}

/** Plan a maglock bypass: the casing first when it has one and is closed, then the circuit with the best tool. */
export function bypassPlan(o: { rating: number; lockType: string; casing: number; casingOpen: boolean; skillDice: number; tools: ReadonlyArray<{ kind: string; rating: number; name: string }>; light: LightLevel | null; vision: Vision; tamper?: number }): { step: 'casing' | 'circuit' | 'voice'; tn: number; dice: number; modifiers: TargetNumberModifier[]; tool: { name: string; kind: string; rating: number; mode: ToolRow['mode'] } | null; note: string; tamperOnStep: boolean } {
  const sec = S();
  const skill = Math.max(0, n(o.skillDice));
  const light = lockLight(o.light, o.vision);
  // v0.78.0 (RULES.BOOK_V78.voiceLocks 'deception', Corporate Security Handbook): no physical bypass of a voice lock:
  // the best voice-deception device rolls its rating against the lock's (the lock's own roll comes after).
  if (o.lockType === 'voice' && RULES.BOOK_V78.voiceLocks === 'deception') {
    const devices = (o.tools ?? []).filter((t) => t.kind === 'voiceDeception' && n(t.rating) > 0);
    const dev = devices.reduce((b: { kind: string; rating: number; name: string } | null, t) => (!b || n(t.rating) > n(b.rating) ? t : b), null);
    return {
      step: 'voice', tn: Math.max(RULES.MIN_TARGET_NUMBER, n(o.rating)), dice: dev ? n(dev.rating) : 0, modifiers: [],
      tool: dev ? { name: dev.name, kind: 'voiceDeception', rating: n(dev.rating), mode: 'deception' } : null,
      note: dev ? tx('SR2E.Text.Roadwork.foolTheVoiceLockWith', { name: dev.name, rating: n(dev.rating) }) : tx('SR2E.Text.Roadwork.aVoiceLockNeedsA'), tamperOnStep: false,
    };
  }
  // v0.78.0 (RULES.BOOK_V78.tamper 'tn', Corporate Security Handbook): an anti-tamper alarm adds its rating to the casing
  // test's TN (to the circuit's when the lock has no casing and `noCasing` is 'circuit'); 0 successes trips it.
  const T = RULES.BOOK_V78.tamper;
  const tamper = T.mode === 'tn' ? Math.max(0, n(o.tamper)) : 0;
  const tamperRow = tamper > 0 ? [{ label: tx('SR2E.Card.Mod.antiTamperAlarm', { tamper }), value: tamper }] : [];
  // v0.92.3 (RULES.VEHICLES_V923.passkey 'book', CSH p. 100): a passkey goes in the reader's slot, so the casing stays shut.
  if (o.lockType === 'card' && veh923('passkey') === 'book') {
    const key = dsLockToolStep({ lockType: o.lockType, rating: n(o.rating), skillDice: skill, tools: o.tools ?? [] });
    if (key && key.tool.kind === 'passkey') return { ...key, tamperOnStep: false };
  }
  if (n(o.casing) > 0 && !o.casingOpen) {
    // v0.80.0 (RULES.URR_V80.dsLockCasing 'byType', URR): a card reader's casing counts double, a print or retinal scanner's +2.
    return { step: 'casing', tn: Math.max(RULES.MIN_TARGET_NUMBER, n(o.casing)), dice: skill, modifiers: [...dsCasingModifiers(o.lockType, o.casing), ...(light ? [light] : []), ...tamperRow], tool: null, note: tx('SR2E.Text.Roadwork.openTheCasingFirst', { casing: o.casing }), tamperOnStep: tamper > 0 };
  }
  const tamperOnCircuit = tamper > 0 && !(n(o.casing) > 0) && T.noCasing === 'circuit';
  const rating = n(o.rating);
  const lock = lockTypeOf(o.lockType);
  const modifiers: TargetNumberModifier[] = [];
  // v0.80.0 (RULES.URR_V80.dsPasskey 'rating' / dsSequencer 'opposed', URR): null under the book.
  const urrTool = dsLockToolStep({ lockType: o.lockType, rating, skillDice: skill, tools: o.tools ?? [] });
  if (urrTool) {
    const onCircuit = urrTool.step === 'circuit' && tamperOnCircuit;
    return { ...urrTool, modifiers: onCircuit ? [...urrTool.modifiers, ...tamperRow] : urrTool.modifiers, tamperOnStep: onCircuit };
  }
  if (lock.tn > 0) modifiers.push({ label: lock.label, value: lock.tn });
  const maxOff = n(sec.maxTnOff);
  const benefit = (mode: ToolRow['mode'], r: number) => (mode === 'replace' ? Math.max(r - skill, 0) : mode === 'dice' ? r : Math.min(r, maxOff));
  let best: { name: string; kind: string; rating: number; mode: ToolRow['mode'] } | null = null;
  let bestBenefit = -1;
  let anyTools = false;
  for (const t of o.tools ?? []) {
    const row = bypassTool(t.kind);
    if (!row || row.mode === 'deception') continue;
    const works = lock.tools.includes(row.id) || (row.kit && row.mode === 'tn');
    if (row.kit || works) anyTools = true;
    if (!works) continue;
    const r = Math.max(0, n(t.rating));
    const b = benefit(row.mode, r);
    if (b > bestBenefit) { best = { name: t.name, kind: row.id, rating: r, mode: row.mode }; bestBenefit = b; }
  }
  let dice = skill;
  if (best?.mode === 'replace') dice = Math.max(skill, best.rating);
  else if (best?.mode === 'dice') dice = skill + best.rating;
  else if (best?.mode === 'tn') {
    const off = Math.min(best.rating, maxOff);
    if (off) modifiers.push({ label: `${best.name} ${best.rating}`, value: -off });
  }
  if (!best && !anyTools && n(sec.noToolsTn)) modifiers.push({ id: 'noTools', label: tx('SR2E.Card.Mod.noTools'), value: n(sec.noToolsTn) });
  if (light) modifiers.push(light);
  if (tamperOnCircuit) modifiers.push(...tamperRow);
  const note = best ? tx('SR2E.Text.Roadwork.bypassTheCircuitWith', { name: best.name, rating: best.rating }) : anyTools ? tx('SR2E.Text.Roadwork.bypassTheCircuitNoTool') : tx('SR2E.Text.Roadwork.bypassTheCircuitWithout');
  return { step: 'circuit', tn: Math.max(RULES.MIN_TARGET_NUMBER, rating), dice, modifiers, tool: best, note, tamperOnStep: tamperOnCircuit };
}

/** v0.78.0 (BOOK_V78.voiceLocks 'deception'): the device's successes against the lock's: more opens it, a tie repeats, fewer holds. */
export function voiceOutcome(deviceSuccesses: number, lockSuccesses: number): 'open' | 'tie' | 'hold' {
  const d = Math.max(0, n(deviceSuccesses)), l = Math.max(0, n(lockSuccesses));
  return d > l ? 'open' : d === l ? 'tie' : 'hold';
}

// ---------------------------------------------------------------- v0.71.0 (R18): vehicle repair

/**
 * v0.71.0 (R18): what a vehicle repair test's successes fix. Each success fixes one shot-out part (tires, engine,
 * sensors) and then `boxesPerSuccess` boxes (parts first with `partsFirst`, else boxes first). A destroyed
 * vehicle (with destroyed 'rebuild') is rebuilt whole on any success: every box and part, at `rebuildFactor` × the hours.
 */
export function vehicleRepairPlan(o: {
  successes: number; condition: number; systems: { tires?: boolean; engine?: boolean; sensors?: boolean };
  destroyed: boolean; boxesPerSuccess: number; hoursPerBox: number; partsFirst: boolean; rebuild: boolean; rebuildFactor: number;
}): { boxes: number; parts: string[]; rebuild: boolean; hours: number } {
  const succ = Math.max(0, Math.floor(o.successes) || 0);
  const broken = (['tires', 'engine', 'sensors'] as const).filter((k) => Boolean(o.systems?.[k]));
  const perBox = Math.max(1, Math.floor(o.boxesPerSuccess) || 1);
  const hpb = Math.max(0, Number(o.hoursPerBox) || 0);
  if (o.destroyed && o.rebuild) {
    if (succ <= 0) return { boxes: 0, parts: [], rebuild: false, hours: 0 };
    const boxes = Math.max(0, Math.floor(o.condition) || 0);
    return { boxes, parts: broken, rebuild: true, hours: Math.round((boxes + broken.length) * hpb * Math.max(1, Number(o.rebuildFactor) || 1) * 10) / 10 };
  }
  let left = succ;
  const parts: string[] = [];
  let boxes = 0;
  const takeParts = () => { while (left > 0 && parts.length < broken.length) { parts.push(broken[parts.length]!); left--; } };
  const takeBoxes = () => { const want = Math.max(0, Math.floor(o.condition) || 0) - boxes; const can = Math.min(want, left * perBox); boxes += can; left -= Math.ceil(can / perBox); };
  if (o.partsFirst) { takeParts(); takeBoxes(); } else { takeBoxes(); takeParts(); }
  return { boxes, parts, rebuild: false, hours: Math.round((boxes + parts.length) * hpb * 10) / 10 };
}
