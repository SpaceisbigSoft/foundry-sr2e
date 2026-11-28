/**
 * v0.98.0 rules completeness, vehicles: driving, vehicle combat and chases. The Foundry glue for RULES.VDRIVE_V98 (pure
 * logic: rules/vdrive98.ts): the maneuver rows on driving tests, the ram's range, Stress, the passenger safety gear and
 * the Crash Test's Control Pool carry-over, a Deadly hit on a passenger, the called-shot thresholds, and the GM's
 * "Vehicle chase" tool (the Maneuver Scores, Hiding, Relocating, hitting a wall).
 *
 * Security: the chase record (every vehicle's Maneuver Score, Driver Points, positioning carried over, who is hidden
 * from whom) lives on the combat, written only by a GM's client from tests that client rolled itself; nothing on a
 * vehicle (player-writable) feeds it. A card button reads its flags only as bounded numbers and uuids; the Light hit on
 * a vehicle goes through gmMay unless the card's author owns the vehicle. Every value put into HTML is escaped.
 */
import { SYSTEM_ID } from '../config/system.ts';
import { RULES, type DamageLevel } from '../rules/config.ts';
import { escHtml } from '../rules/html.ts';
import { t as tx, tKey } from '../helpers/i18n.ts';
import { replaceFlag } from '../helpers/flags.ts';
import { successTest, type SuccessTestResult, type TargetNumberModifier } from '../rules/dice.ts';
import * as X from '../rules/vdrive98.ts';
import { CHASE98 } from '../rules/config98/vdrive.ts';
import { allActors } from '../helpers/actors.ts';
import { measureTokens } from './canvas.ts';
import { authorOwns, gmMay } from './trust.ts';

const G = (): any => (globalThis as any).game;
const isGm = (): boolean => Boolean(G()?.user?.isGM);
const warn = (text: string): void => { (globalThis as any).ui?.notifications?.warn?.(escHtml(text)); };
const post = (content: string, extra: Record<string, unknown> = {}): Promise<any> => (globalThis as any).ChatMessage.create({ content, ...extra });
const speaker = (actor: any): any => { try { return (globalThis as any).ChatMessage.getSpeaker({ actor }); } catch { return {}; } };
const name = (a: any): string => escHtml(String(a?.name ?? ''));
const int = (v: unknown, min: number, max: number, d = min): number => { const n = Math.floor(Number(v)); return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : d; };
const uuidOk = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 400;
const sync = (uuid: unknown): any => { try { return uuidOk(uuid) ? (globalThis as any).fromUuidSync?.(uuid) ?? null : null; } catch { return null; } };
const actorClass = (): any => (globalThis as any).CONFIG?.Actor?.documentClass;
const dialogs = (): any => (globalThis as any).foundry?.applications?.api?.DialogV2;
const VEHICLE = 'vehicle';

/** The combat flag holding the chase record (GM-written). */
export const CHASE_FLAG = 'vdrive98';

/** Dice rolled with Foundry (shown by Dice So Nice through the card's rolls). */
function roller(sink: any[]): (count: number) => Promise<number[]> {
  return async (count: number) => {
    const roll = await new (globalThis as any).Roll(`${count}d6`).evaluate();
    sink.push(roll);
    return (roll.dice ?? []).flatMap((term: any) => term.results.map((r: any) => Number(r.result)));
  };
}

// ---------------------------------------------------------------- The chase record (on the combat)

/** The started combat, its record and its turn; null outside a started combat. */
export function chaseNow(): { combat: any; st: X.Chase98; id: string; round: number } | null {
  const combat: any = G()?.combat;
  if (!combat?.started) return null;
  const raw = typeof combat.getFlag === 'function' ? combat.getFlag(SYSTEM_ID, CHASE_FLAG) : combat.flags?.[SYSTEM_ID]?.[CHASE_FLAG];
  return { combat, st: X.chaseState(raw), id: String(combat.id ?? ''), round: Number(combat.round ?? 0) };
}

/** This vehicle's Maneuver Score this turn (from the combat's record), or null. */
export function scoreNow(vehicle: any): X.Score98 | null {
  const c = chaseNow();
  return c && vehicle?.uuid ? X.scoreOf(c.st, String(vehicle.uuid), c.id, c.round) : null;
}

async function writeChase(combat: any, st: X.Chase98): Promise<boolean> {
  if (!isGm() || !combat) return false;
  await replaceFlag(combat, CHASE_FLAG, st as unknown as Record<string, unknown>);
  return true;
}

const vehicles = (): any[] => { try { return allActors().filter((a: any) => a?.type === VEHICLE); } catch { return []; } };
/** The vehicles chasing this one. */
const pursuersOf = (v: any): any[] => vehicles().filter((a: any) => a.uuid !== v?.uuid && a.system?.chase?.quarryUuid === v?.uuid);
/** Everyone this vehicle is in a chase with (its pursuers and its quarry). */
export function opponentsOf(v: any): any[] {
  const out = pursuersOf(v);
  const q = sync(v?.system?.chase?.quarryUuid);
  if (q?.type === VEHICLE && !out.some((a) => a.uuid === q.uuid)) out.push(q);
  return out;
}

/** The highest score among the opponents (Rigger 2 p. 45: against several, the highest), or null. */
function bestOf(c: { st: X.Chase98; id: string; round: number }, list: any[]): number | null {
  const s = list.map((a) => X.scoreOf(c.st, String(a.uuid), c.id, c.round)).filter((x): x is X.Score98 => Boolean(x)).map((x) => x.score);
  return s.length ? Math.max(...s) : null;
}

const overSpeed = (v: any): boolean => {
  const sp = Number(v?.derived?.working?.speed ?? v?.speed ?? 0);
  return sp > 0 && Number(v?.currentSpeed ?? 0) > sp;
};

// ---------------------------------------------------------------- The maneuver rows (driving tests)

/**
 * The rows RULES.VDRIVE_V98 adds to a vehicle test (#driveSetup): the active autonav on a combat maneuver, and under
 * the book chase the Maneuver Score difference (from the combat's record), more than one opponent, and a Hiding Test
 * above the Speed (+2 in all with the driving table's +1).
 */
export function driveMods(vehicle: any, o: { kind: string; mode: string; push: boolean; targetUuid?: string | null }): TargetNumberModifier[] {
  const out: TargetNumberModifier[] = [];
  const v = vehicle?.system ?? {};
  const k: X.Maneuver98 | null = o.kind === 'ram' ? 'ram' : o.kind === 'hide' ? 'hide' : o.kind === 'maneuver' ? (o.push ? 'accel' : 'position') : null;
  if (!k) return out;
  if (o.mode !== 'autopilot' && !v.drone) {
    const nav = X.autonavManeuver(k, Number(v.autonav ?? 0), Boolean(v.autonavOff98));
    if (nav) out.push(nav);
  }
  if (!X.on('chase')) return out;
  if (k === 'hide' && overSpeed(v)) out.push({ id: 'overSpeedHide98', label: tx('SR2E.VDrive98.Mod.overSpeedHide'), value: CHASE98.overSpeed['hide']! - 1 });
  const c = chaseNow();
  if (!c || k === 'position') return out;
  const mine = X.scoreOf(c.st, String(vehicle.uuid), c.id, c.round);
  const list = k === 'ram' ? [sync(o.targetUuid)].filter((a) => a?.type === VEHICLE) : opponentsOf(vehicle);
  const theirs = bestOf(c, list);
  if (mine && theirs !== null) {
    const d = X.scoreDiff(k === 'ram' ? 'ram' : k === 'hide' ? 'hide' : 'accel', mine.score, theirs);
    if (d) out.push({ id: 'score98', label: tx('SR2E.VDrive98.Mod.score', { mine: mine.score, theirs }), value: d });
  }
  const extra = k === 'accel' ? X.extraOpponents(pursuersOf(vehicle).length) : k === 'hide' ? X.extraOpponents(list.length) : 0;
  if (extra) out.push({ id: 'opponents98', label: tx('SR2E.VDrive98.Mod.opponents'), value: extra });
  return out;
}

/** Whether the vehicle's autonav adds its dice (switched off, it doesn't). */
export const autonavDice = (v: any): boolean => X.autonavDiceOn(Boolean(v?.autonavOff98));

/** A rigger defaulting while jumped in (Rigger 2 p. 12): the defaulting modifier, halved where the book says. */
export function defaultMod(mod: TargetNumberModifier | null | undefined, o: { jumped: boolean; using: string; attribute: string; relatedName: string }): TargetNumberModifier | null {
  if (!mod) return null;
  const from = o.using === 'attribute' && o.attribute === 'reaction' ? 'reaction' : o.using === 'related' && X.isVehicleSkill(o.relatedName) ? 'vehicleSkill' : 'other';
  const value = X.riggerDefault(Number(mod.value) || 0, { jumped: o.jumped, from });
  return value === mod.value ? mod : { ...mod, value, label: tx('SR2E.VDrive98.Mod.riggerDefault', { label: String(mod.label ?? '') }) };
}

/** The datajack driver's Reaction bonus (Rigger 2 p. 124). */
export function datajackPlus(driver: any, mode: string, situational: readonly string[] | undefined): number {
  return X.datajackReaction({ manual: mode === 'manual', ticked: (situational ?? []).includes('datajack'), datajack: Boolean(driver?.system?.derived?.cyber?.datajack) });
}

// ---------------------------------------------------------------- The ram's range (Rigger 2 p. 47)

/** A refusal (translated) when the target is too far to ram, else null. */
export function ramRefusal(vehicle: any, target: any): string | null {
  if (!X.on('ramRange') || !vehicle || !target) return null;
  let gap: number | null = null;
  try { gap = actorClass()?.chaseGap?.(vehicle, target) ?? null; } catch { gap = null; }
  if (gap === null) {
    try {
      const a = actorClass()?.tokenFor?.(vehicle), b = actorClass()?.tokenFor?.(target);
      const m = a && b ? measureTokens(a, b) : null;
      gap = m ? m.metres : null;
    } catch { gap = null; }
  }
  const r = X.ramInRange(gap, Number(vehicle.system?.accel ?? 0));
  return r.ok ? null : tx('SR2E.VDrive98.Why.ramTooFar', { name: String(vehicle.name ?? ''), target: String(target.name ?? ''), gap: Math.round(Number(gap) * 10) / 10, accel: Number(vehicle.system?.accel ?? 0) });
}

// ---------------------------------------------------------------- Passengers (Rigger 2 pp. 49–50, 53)

/** The vehicle a character rides in as a passenger (not its driver), or null. */
function rideOf(actor: any): any | null {
  if (!actor || actor.type === VEHICLE) return null;
  const v = vehicles().find((a: any) => (a.system?.occupants ?? []).includes(actor.uuid));
  return v && v.system?.controllerUuid !== actor.uuid ? v : null;
}
/** The vehicle a character is in (riding or driving), or null. */
function inVehicle(actor: any): any | null {
  if (!actor) return null;
  if (actor.type === VEHICLE) return actor;
  return vehicles().find((a: any) => (a.system?.occupants ?? []).includes(actor.uuid) || a.system?.controllerUuid === actor.uuid) ?? null;
}

/**
 * Whether an offensive action is refused (warned): a passenger acting in a Combat Phase above the vehicle's Driver
 * Points (Rigger 2 p. 49), or a target whose vehicle has broken contact with the attacker's (Rigger 2 p. 48). Both from
 * the combat's record.
 */
export function offenceRefused(actor: any, targetUuid?: string | null): boolean {
  const c = chaseNow();
  if (!c || !X.on('chase')) return false;
  const ride = rideOf(actor);
  if (ride && X.on('passengerPhase')) {
    const sc = X.scoreOf(c.st, String(ride.uuid), c.id, c.round);
    const phase = Number(actor?.myCombatant?.()?.initiative);
    if (sc && Number.isFinite(phase) && !X.passengerMayAct(phase, sc.driver)) {
      warn(tx('SR2E.VDrive98.Why.passengerPhase', { name: String(actor.name ?? ''), phase, points: sc.driver, vehicle: String(ride.name ?? '') }));
      return true;
    }
  }
  const mine = inVehicle(actor);
  const t = sync(targetUuid);
  const theirs = t ? inVehicle(t) : null;
  if (mine && theirs && mine.uuid !== theirs.uuid && X.hiddenFrom(c.st, String(theirs.uuid), String(mine.uuid))) {
    warn(tx('SR2E.VDrive98.Why.hidden', { target: String(theirs.name ?? ''), vehicle: String(mine.name ?? '') }));
    return true;
  }
  return false;
}

/** The manual gunnery rows (Rigger 2 p. 57) between the firer's and the target's vehicles. */
export function gunnery(ride: any, targetRide: any, still: boolean): TargetNumberModifier[] {
  if (!X.on('gunneryRows') || !ride || !targetRide || ride === targetRide || still) return [];
  const c = chaseNow();
  const mine = c ? X.scoreOf(c.st, String(ride.uuid), c.id, c.round) : null;
  const theirs = c ? X.scoreOf(c.st, String(targetRide.uuid), c.id, c.round) : null;
  const pursuer = ride.system?.chase?.quarryUuid === targetRide.uuid ? ride : targetRide.system?.chase?.quarryUuid === ride.uuid ? targetRide : null;
  const quarry = pursuer === ride ? targetRide : pursuer ? ride : null;
  const motion = pursuer && quarry ? X.relativeMotion(Number(pursuer.system?.currentSpeed ?? 0), Number(quarry.system?.currentSpeed ?? 0)) : null;
  return X.gunneryRows({ mine: mine ? mine.score : null, theirs: theirs ? theirs.score : null, motion });
}

/** Whether the v0.57.0 position modifier is replaced (the book's gunnery rows). */
export const replacesPosition = (): boolean => X.on('gunneryRows');

/** The Control Pool dice a Crash Test card used (its pool dice), bounded. */
export function crashPoolDice(snap: any): number {
  const dice: any[] = Array.isArray(snap?.dice) ? snap.dice : [];
  return Math.min(30, dice.filter((d) => d && d.pool).length);
}

/**
 * The people aboard after the vehicle's safety gear and the Crash Test's Control Pool dice (Rigger 2 pp. 50, 128):
 * each damage (Power, level, extra dice in `vdrive98Dice`); a seat belt can stage one away.
 */
export function safePassengers<T extends { power: number; level: DamageLevel }>(vehicle: any, list: T[], cp = 0): T[] {
  const v = vehicle?.system ?? {};
  const out: T[] = [];
  for (const d of list) {
    const r = X.passengerSafety({ power: d.power, level: d.level, belted: Boolean(v.belted98), apps: Boolean(v.apps98), cage: Boolean(v.crashCage98), cp });
    if (!r) continue;
    out.push({ ...d, power: r.power, level: r.level, ...(r.dice ? { vdrive98Dice: r.dice } : {}) });
  }
  return out;
}

/** The extra resistance dice a passenger's damage carries (bounded). */
export const extraDice = (damage: any): number => int(damage?.vdrive98Dice, 0, 40, 0);

/**
 * A Deadly hit on a passenger (Rigger 2 p. 53): Light to the vehicle, not resisted. Applied here when this client may
 * write the vehicle, else a card for the GM.
 */
export async function deadlyPassenger(actor: any, damage: any): Promise<void> {
  if (!damage?.occupantShot || !X.deadlyPassengerHit(damage.level)) return;
  const v = inVehicle(actor);
  if (!v || v.uuid === actor?.uuid) return;
  if (v.isOwner) { await lightTo(v); return; }
  await post(`<p>${tx('SR2E.VDrive98.Passenger.deadly', { name: name(actor), vehicle: name(v) })} <button type="button" data-sr2e-action="vdrive98Light">${tx('SR2E.VDrive98.Passenger.apply')}</button></p>`,
    { speaker: speaker(actor), flags: { [SYSTEM_ID]: { vdrive98Light: { vehicleUuid: String(v.uuid), passengerUuid: String(actor.uuid) } } } });
}

async function lightTo(v: any): Promise<void> {
  const max = RULES.VEHICLES.conditionBoxes;
  const after = Math.min(max, Number(v.system?.condition ?? 0) + Number(RULES.BOXES_PER_LEVEL.L ?? 1));
  await v.update({ 'system.condition': after });
  await post(`<p>${tx('SR2E.VDrive98.Passenger.applied', { vehicle: name(v), after, max })}</p>`, { speaker: speaker(v) });
}

/** The card buttons (chat.ts dispatches `vdrive98…`). */
export async function onCard(message: any, button: HTMLButtonElement, action: string): Promise<void> {
  if (action !== 'vdrive98Light') return;
  const c: any = message?.flags?.[SYSTEM_ID]?.vdrive98Light;
  const v: any = uuidOk(c?.vehicleUuid) ? await (globalThis as any).fromUuid(c.vehicleUuid) : null;
  if (v?.type !== VEHICLE) return;
  if (!isGm() && !v.isOwner) { warn(tx('SR2E.VDrive98.ownerOnly', { name: String(v.name ?? '') })); return; }
  if (message?.getFlag?.(SYSTEM_ID, 'vdrive98Done')) { warn(tx('SR2E.VDrive98.alreadyDone')); return; }
  if (!authorOwns(message, v) && !(await gmMay(message, { title: tx('SR2E.VDrive98.Passenger.title'), lines: [tx('SR2E.VDrive98.Passenger.line', { vehicle: String(v.name ?? '') })], target: String(v.uuid), sources: [c?.passengerUuid] }))) return;
  button.disabled = true;
  await lightTo(v);
  try { await message.setFlag(SYSTEM_ID, 'vdrive98Done', true); } catch { /* the author's card */ }
}

// ---------------------------------------------------------------- Called shots (Rigger 2 p. 53)

/** Whether a called shot knocks the part out at this level (a turret mount needs Serious). */
export function partHits(vehicle: any, part: string, level: DamageLevel | null, weaponId?: string | null): boolean {
  const w: any = weaponId ? vehicle?.items?.get?.(weaponId) : null;
  return X.partKnockedOut(part, level, String(w?.system?.mount ?? '') === 'turret');
}

// ---------------------------------------------------------------- Exceeding the Speed and Stress (Rigger 2 pp. 22, 25–26)

/**
 * _preUpdate: a new current speed capped at 1.5 × the Speed, and a Stress Point for speeding up past the Speed. Mutates
 * `changed` (flat or nested); returns a note when capped.
 */
export function speedUpdate(vehicle: any, changed: any): string {
  const flat = changed?.['system.currentSpeed'];
  const want = flat ?? changed?.system?.currentSpeed;
  if (want === undefined || vehicle?.type !== VEHICLE) return '';
  const sys = vehicle.system ?? {};
  const speed = Number(sys.derived?.working?.speed ?? sys.speed ?? 0);
  const r = X.speedChange({ from: Number(sys.currentSpeed ?? 0), to: Number(want), speed });
  if (r.to !== Number(want)) { if (flat !== undefined) changed['system.currentSpeed'] = r.to; else changed.system.currentSpeed = r.to; }
  if (r.stress) { const n = Number(sys.stress98 ?? 0) + r.stress; if (flat !== undefined) changed['system.stress98'] = n; else changed.system.stress98 = n; }
  return r.capped ? tx('SR2E.VDrive98.Text.speedCapped', { name: String(vehicle.name ?? ''), max: r.to }) : '';
}

/**
 * After a Driving Test (the 'drive' card): the Stress Rule of One (+1D6 Stress), and on a failed test the Stress Test
 * (2D6 below the Stress: a system fails, a Crash Test). Once per card (`stress98` on the snapshot). Writes the vehicle
 * when this client may; otherwise the card asks the GM.
 */
export async function driveStress(actor: any, snap: any): Promise<{ html: string; flags: Record<string, unknown>; mark: boolean }> {
  const none = { html: '', flags: {}, mark: false };
  const d = snap?.drive;
  if (!X.on('stress') || !d || d.stress98) return none;
  const v: any = sync(d.vehicleUuid);
  if (v?.type !== VEHICLE) return none;
  const dice: any[] = Array.isArray(snap.dice) ? snap.dice : [];
  const ones = dice.filter((x) => Array.isArray(x?.faces) && x.faces[0] === 1 && !x.pool).length;
  const skill = actor?.type === VEHICLE ? Number(v.system?.derived?.autopilotRating ?? 0) : Number(actor?.vehicleSkillRating?.(v) ?? 0);
  let stress = Number(v.system?.stress98 ?? 0);
  const lines: string[] = [];
  let fails = false;
  const rolls: any[] = [];
  if (X.ruleOfOne(ones, skill)) {
    const add = (await roller(rolls)(1))[0] ?? 1;
    stress += add;
    lines.push(tx('SR2E.VDrive98.Stress.ruleOfOne', { ones, add, stress }));
    if (X.stressBreaks(stress, Number(v.system?.body ?? 0))) { fails = true; lines.push(tx('SR2E.VDrive98.Stress.breaks', { stress })); }
  }
  if (!(Number(snap.successes) > 0) && !d.crashTest && !fails && stress > 0) {
    const two = await roller(rolls)(2);
    const total = two.reduce((a, b) => a + b, 0);
    if (X.stressTestFails(total, stress)) { fails = true; lines.push(tx('SR2E.VDrive98.Stress.testFails', { total, stress })); }
    else lines.push(tx('SR2E.VDrive98.Stress.testHolds', { total, stress }));
  }
  if (!lines.length) return none;
  if (stress !== Number(v.system?.stress98 ?? 0)) {
    if (v.isOwner) { try { await v.update({ 'system.stress98': stress }); } catch { lines.push(tx('SR2E.VDrive98.Stress.gmSet', { stress })); } }
    else lines.push(tx('SR2E.VDrive98.Stress.gmSet', { stress }));
  }
  let html = `<p>${lines.map((l) => escHtml(l)).join(' ')}</p>`;
  let flags: Record<string, unknown> = {};
  if (fails && Number(v.system?.currentSpeed ?? 0) > 0) {
    html += `<p><button type="button" data-sr2e-action="vehicleCrashTest">${tx('SR2E.VDrive98.Stress.crashTest', { name: name(v) })}</button></p>`;
    flags = { crashTest: { vehicleUuid: String(v.uuid), tn: 0, why: tx('SR2E.VDrive98.Stress.why') } };
  }
  return { html, flags, mark: true };
}

// ---------------------------------------------------------------- The positioning chase turn (Rigger 2 p. 46)

/** Under the book chase, the chase turn moves the gap by speed only (the positioning successes are next turn's). */
export const speedOnlyGap = (): boolean => X.on('chase');

/** After a chase turn's positioning tests: their successes go to next turn's Driver Points (the GM's client records). */
export async function afterPositioning(pursuer: any, quarry: any, pr: SuccessTestResult | null, qr: SuccessTestResult | null): Promise<string> {
  if (!X.on('chase')) return '';
  const c = chaseNow();
  if (!c) return `<p>${tx('SR2E.VDrive98.Chase.noCombat')}</p>`;
  if (!isGm()) return `<p>${tx('SR2E.VDrive98.Chase.gmRecords')}</p>`;
  let st = X.withPositioning(c.st, String(pursuer.uuid), Number(pr?.successes ?? 0));
  st = X.withPositioning(st, String(quarry.uuid), Number(qr?.successes ?? 0));
  await writeChase(c.combat, st);
  return `<p>${tx('SR2E.VDrive98.Chase.positioned', { a: name(pursuer), as: Number(pr?.successes ?? 0), b: name(quarry), bs: Number(qr?.successes ?? 0) })}</p>`;
}

// ---------------------------------------------------------------- The GM's "Vehicle chase" tool

const controlled = (): any[] => {
  const toks: any[] = [...((globalThis as any).canvas?.tokens?.controlled ?? [])];
  return toks.map((t: any) => t.actor).filter((a: any) => a?.type === VEHICLE);
};
const sceneTerrain = (v: any): string => {
  try { return String(actorClass()?.sceneTerrain?.(v?.sceneHere?.() ?? null) ?? 'normal'); } catch { return 'normal'; }
};

/** The vehicles in the chases on this combat: the selected ones and everyone in a chase with them (else every chase). */
function chaseVehicles(): any[] {
  const sel = controlled();
  const base = sel.length ? sel : vehicles().filter((v: any) => v.system?.chase?.quarryUuid || pursuersOf(v).length);
  const out: any[] = [];
  for (const v of base) for (const a of [v, ...opponentsOf(v)]) if (a && !out.some((o) => o.uuid === a.uuid)) out.push(a);
  return out.filter((v) => !v.system?.derived?.destroyed).slice(0, X.LIST_CAP);
}

/** Who drives (the controller, else the vehicle's autopilot) and the Open Test's dice before pool. */
function driverOf(v: any): { who: any; dice: number; jumped: boolean } {
  const ctl: any = v.system?.controllerUuid ? v.controller?.() : null;
  if (ctl) return { who: ctl, dice: Number(ctl.vehicleSkillRating?.(v) ?? 0), jumped: v.system?.controlMode === 'jumped' && Boolean(ctl.system?.rigging?.jumpedIn) };
  return { who: v, dice: Number(v.system?.derived?.autopilotRating ?? 0), jumped: false };
}

/** Step 2–4 of the turn (Rigger 2 p. 42): every chase vehicle's score, rolled here and recorded on the combat. */
export async function rollScores(pool: Record<string, number> = {}): Promise<boolean> {
  if (!isGm() || !X.on('chase')) return false;
  const c = chaseNow();
  if (!c) { warn(tx('SR2E.VDrive98.Chase.noCombat')); return false; }
  const list = chaseVehicles();
  if (!list.length) { warn(tx('SR2E.VDrive98.Chase.noVehicles')); return false; }
  const rolls: any[] = [];
  const scores: X.Score98[] = [];
  const rows: string[] = [];
  for (const v of list) {
    const sys = v.system ?? {};
    const partial = X.partialScore({ type: String(sys.vehicleType98 ?? ''), category: String(sys.category ?? ''), terrain: sceneTerrain(v), speed: Number(sys.currentSpeed ?? 0) });
    const dr = driverOf(v);
    // The Control Pool dice the GM puts on the Open Test for a jumped-in rigger (at most the skill, Rigger 2 p. 20).
    const left = dr.jumped ? Number(dr.who.system?.derived?.controlPoolLeft ?? 0) : 0;
    const cp = Math.max(0, Math.min(int(pool[v.uuid], 0, 60, 0), left, dr.dice));
    if (cp > 0) { try { await dr.who.update({ 'system.poolSpent.control': Number(dr.who.system?.poolSpent?.control ?? 0) + cp }); } catch { /* not spent */ } }
    const open = await X.openTest(dr.dice + cp, roller(rolls));
    const driver = X.driverPoints(open.result, c.st, String(v.uuid));
    scores.push({ v: String(v.uuid), score: partial + driver, driver, partial });
    rows.push(`<li>${tx('SR2E.VDrive98.Chase.scoreRow', { name: name(v), partial, open: open.result, driver, score: partial + driver, cp })}</li>`);
  }
  await writeChase(c.combat, X.withScores(c.st, { combatId: c.id, round: c.round, scores }));
  await post(`<div class="sr2e-roll"><h3>${tx('SR2E.VDrive98.Chase.scoresTitle', { round: c.round })}</h3><ul>${rows.join('')}</ul><p class="hint">${tx('SR2E.VDrive98.Chase.scoresHint')}</p></div>`, { rolls });
  return true;
}

/** A Hiding Test (Rigger 2 p. 48), rolled here: success breaks contact with every opponent and gives the Escape Bonus. */
export async function hide(v: any, poolDice = 0): Promise<boolean> {
  if (!isGm() || !X.on('chase') || v?.type !== VEHICLE) return false;
  const c = chaseNow();
  if (!c) { warn(tx('SR2E.VDrive98.Chase.noCombat')); return false; }
  const from = opponentsOf(v);
  if (!from.length) { warn(tx('SR2E.VDrive98.Chase.noOpponents', { name: String(v.name ?? '') })); return false; }
  const r: SuccessTestResult | null = await v.driveTest({ kind: 'hide', label: tx('SR2E.VDrive98.Chase.hideLabel'), poolDice: Math.max(0, Math.floor(poolDice)) });
  if (!r) return false;
  const now = chaseNow() ?? c;
  if (r.successes > 0) {
    await writeChase(now.combat, X.withHide(now.st, String(v.uuid), from.map((a) => String(a.uuid)), r.successes, now.round));
    await post(`<p>${tx('SR2E.VDrive98.Chase.hidden', { name: name(v), from: escHtml(from.map((a) => String(a.name ?? '')).join(', ')), bonus: r.successes })}</p>`, { speaker: speaker(v) });
  }
  return true;
}

/** A Relocating Test (Rigger 2 p. 49), rolled here: Perception (Intelligence) against the hider's Signature. */
export async function relocate(finder: any): Promise<boolean> {
  if (!isGm() || !X.on('chase') || finder?.type !== VEHICLE) return false;
  const c = chaseNow();
  if (!c) { warn(tx('SR2E.VDrive98.Chase.noCombat')); return false; }
  const h = c.st.hides.find((x) => x.from.includes(String(finder.uuid)));
  const hider: any = h ? sync(h.hider) : null;
  if (!h || hider?.type !== VEHICLE) { warn(tx('SR2E.VDrive98.Chase.nobodyHidden', { name: String(finder.name ?? '') })); return false; }
  const fs = finder.system ?? {};
  const ctl: any = fs.controllerUuid ? finder.controller?.() : null;
  // The driver's Perception (Intelligence); an empty vehicle's autopilot rating (VERIFY).
  const dice = ctl ? Number(ctl.system?.attributes?.intelligence?.total ?? 0) : Number(fs.derived?.autopilotRating ?? 0);
  const mine = X.scoreOf(c.st, String(finder.uuid), c.id, c.round), theirs = X.scoreOf(c.st, String(hider.uuid), c.id, c.round);
  const mods = X.relocateMods({ mine: mine ? mine.score : null, theirs: theirs ? theirs.score : null, overSpeed: overSpeed(fs), autonav: ctl && !fs.drone ? Number(fs.autonav ?? 0) : 0, autonavOff: Boolean(fs.autonavOff98), hideSuccesses: h.successes, terrain: sceneTerrain(hider) });
  const rolls: any[] = [];
  const r = await successTest({ dice, targetNumber: Math.max(RULES.MIN_TARGET_NUMBER, Number(hider.system?.signature ?? 0)), modifiers: mods, roll: roller(rolls) });
  if (r.successes > 0) await writeChase(c.combat, X.withRelocated(c.st, String(hider.uuid), String(finder.uuid)));
  const modsText = escHtml(mods.map((m) => `${m.label} ${m.value > 0 ? '+' : ''}${m.value}`).join(', '));
  await post(`<div class="sr2e-roll"><h3>${tx('SR2E.VDrive98.Chase.relocateTitle', { name: name(finder), hider: name(hider) })}</h3><p>${tx('SR2E.VDrive98.Chase.relocateRoll', { dice, tn: r.targetNumber, mods: modsText, successes: r.successes })}</p><p><strong>${r.successes > 0 ? tx('SR2E.VDrive98.Chase.relocated', { name: name(finder), hider: name(hider) }) : tx('SR2E.VDrive98.Chase.notRelocated', { name: name(finder), turns: CHASE98.npcRelocateTurns })}</strong></p></div>`, { speaker: speaker(finder), rolls });
  return true;
}

/** A vehicle hitting a wall (Rigger 2 pp. 51–52): stopped (the standard crash) or through it (its own card). */
export async function hitWall(v: any, barrier: number): Promise<boolean> {
  if (!X.on('walls') || v?.type !== VEHICLE) return false;
  const speed = Number(v.system?.currentSpeed ?? 0);
  const hit = X.wallCollision(speed, barrier);
  if (!hit) return false;
  if (!hit.through) { await post(`<p>${tx('SR2E.VDrive98.Wall.stops', { name: name(v), speed, barrier: Math.floor(barrier) })}</p>`, { speaker: speaker(v) }); await v.crash(speed); return true; }
  try { await v.update({ 'system.currentSpeed': hit.speedAfter }, { sr2eSpeedOk: true }); } catch { /* the GM's tool */ }
  const damages: any[] = hit.level ? [{ targetUuid: String(v.uuid), melee: false, damageType: 'physical', power: hit.power, level: hit.level, crash: true, ignoreArmor: true }] : [];
  const aboard: string[] = [...(v.system?.occupants ?? [])];
  if (v.system?.controllerUuid && v.system?.controlMode === 'manual' && !aboard.includes(v.system.controllerUuid)) aboard.push(v.system.controllerUuid);
  if (hit.level && X.wallHurtsPassengers(Boolean(v.system?.belted98))) {
    const people = aboard.filter((u) => sync(u)).map((u) => ({ targetUuid: u, melee: false, damageType: 'physical', power: hit.power, level: hit.level as DamageLevel, armorKind: 'impact', noPool: true }));
    damages.push(...safePassengers(v, people.map((p) => ({ ...p, level: p.level })), 0));
  }
  const rows = damages.map((d, i) => `<li>${name(sync(d.targetUuid))}: <strong>${Number(d.power)}${escHtml(String(d.level))}</strong> <button type="button" data-sr2e-action="resist" data-index="${i}">${tx('SR2E.Card.Actor.resist')}</button></li>`).join('');
  await post(`<div class="sr2e-roll"><h3>${tx('SR2E.VDrive98.Wall.through', { name: name(v), speed, after: hit.speedAfter, barrier: Math.floor(barrier) })}</h3>${rows ? `<ul class="sr2e-blast">${rows}</ul>` : ''}</div>`,
    { speaker: speaker(v), flags: { [SYSTEM_ID]: { damages, damage: damages[0] ?? null } } });
  return true;
}

/** The Control Pool dice each jumped-in rigger puts on the Open Test (Rigger 2 p. 42, step 3), asked of the GM. */
async function askPools(): Promise<Record<string, number>> {
  const riggers = chaseVehicles().filter((v) => driverOf(v).jumped);
  if (!riggers.length) return {};
  const rows = riggers.map((v, i) => `<label>${name(v)} (${name(driverOf(v).who)}) <input type="number" name="cp${i}" min="0" value="0"></label>`).join('<br>');
  const got = await dialogs()?.prompt?.({ window: { title: tx('SR2E.VDrive98.Tool.scores') }, content: `<p class="hint">${tx('SR2E.VDrive98.Tool.poolHint')}</p>${rows}`,
    ok: { callback: (_e: any, b: any) => riggers.map((_v, i) => b?.form?.elements?.[`cp${i}`]?.value) }, rejectClose: false });
  const out: Record<string, number> = {};
  if (Array.isArray(got)) riggers.forEach((v, i) => { out[String(v.uuid)] = int(got[i], 0, 60, 0); });
  return out;
}

/** The GM's "Vehicle chase" tool: the turn's scores, a hide, a relocate, a wall. */
export async function openChaseTool(): Promise<void> {
  if (!isGm()) return;
  const sel = controlled();
  const names = escHtml(sel.map((a: any) => String(a.name ?? '')).join(', '));
  const pick = await dialogs()?.wait?.({
    window: { title: tx('SR2E.VDrive98.Tool.title') },
    content: `<p>${sel.length ? tx('SR2E.VDrive98.Tool.selected', { names }) : tx('SR2E.VDrive98.Tool.none')}</p><p class="hint">${tx('SR2E.VDrive98.Tool.hint')}</p>`,
    buttons: [
      ...(X.on('chase') ? [{ action: 'scores', label: tx('SR2E.VDrive98.Tool.scores'), callback: () => 'scores' }, { action: 'hide', label: tx('SR2E.VDrive98.Tool.hide'), callback: () => 'hide' }, { action: 'relocate', label: tx('SR2E.VDrive98.Tool.relocate'), callback: () => 'relocate' }] : []),
      ...(X.on('walls') ? [{ action: 'wall', label: tx('SR2E.VDrive98.Tool.wall'), callback: () => 'wall' }] : []),
      { action: 'cancel', label: tx('SR2E.VDrive98.Tool.cancel'), callback: () => null },
    ],
    rejectClose: false,
  });
  if (pick === 'scores') { await rollScores(await askPools()); return; }
  if (!pick || pick === 'cancel') return;
  if (sel.length !== 1) { warn(tx('SR2E.VDrive98.Tool.needOne')); return; }
  const v = sel[0];
  if (pick === 'hide') await hide(v);
  else if (pick === 'relocate') await relocate(v);
  else if (pick === 'wall') {
    const raw = await dialogs()?.prompt?.({ window: { title: tx('SR2E.VDrive98.Tool.wall') }, content: `<label>${tx('SR2E.VDrive98.Tool.barrier')} <input type="number" name="barrier" min="0" value="8"></label>`, ok: { callback: (_e: any, b: any) => b?.form?.elements?.barrier?.value }, rejectClose: false });
    const barrier = int(raw, 0, 100, -1);
    if (barrier >= 0) await hitWall(v, barrier);
  }
}

// ---------------------------------------------------------------- The vehicle sheet

/** The sheet's v0.98.0 row: the fields shown and the vehicle types to pick from. */
export function sheetContext(actor: any): { show: boolean; types: Array<{ key: string; label: string }>; stress: boolean; safety: boolean; autonav: boolean; offroad: boolean; chase: boolean; score: number | null } {
  const types = [{ key: '', label: tx('SR2E.VDrive98.Type.byCategory') }, ...X.VEHICLE_TYPES.map((k) => ({ key: k, label: tKey(`SR2E.VDrive98.Type.${k}`) }))];
  const show = X.on('offRoad') || X.on('autonavCombat') || X.on('stress') || X.on('passengerSafety') || X.on('chase');
  const sc = actor?.type === VEHICLE ? scoreNow(actor) : null;
  return { show, types, stress: X.on('stress'), safety: X.on('passengerSafety'), autonav: X.on('autonavCombat'), offroad: X.on('offRoad'), chase: X.on('chase'), score: sc ? sc.score : null };
}

/** The Crash Test card's flag for the carried-over Control Pool dice (only under `cpCarry` 'book'). */
export function crashCarry(snap: any): { cp98?: number } {
  const n = X.on('cpCarry') ? crashPoolDice(snap) : 0;
  return n > 0 ? { cp98: n } : {};
}
