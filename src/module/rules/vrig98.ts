/**
 * v0.98.0 rules completeness, rigging, drones, sensors and electronic warfare. Pure functions over RULES.VRIG_V98
 * (rules/config98/vrig.ts), from Rigger 2. Each behaves the book's way at the shipped value of its switch; at the other
 * value ('v971') it returns what leaves the v0.97.1 code as it was. No Foundry dependency. A refusal is a language key
 * (`why`), never text.
 */
import { RULES } from './config.ts';
import { SYSTEM_ID } from '../config/system.ts';
import type { TargetNumberModifier } from './dice.ts';

const V = () => RULES.VRIG_V98;
const num = (v: unknown, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const whole = (v: unknown) => Math.max(0, Math.floor(num(v)));
const str = (v: unknown, max = 400) => (typeof v === 'string' ? v.slice(0, max) : '');
const WHY = 'SR2E.VRig98.Why.';

export type VRig98Switch = Exclude<keyof typeof RULES.VRIG_V98, 'comprehensionTn' | 'ed'>;
/** Whether a switch is at the book's way. */
export const on = (key: VRig98Switch): boolean => (V() as any)[key] === 'book';
/** Whether the optional electronic deception rule is on (Rigger 2 p. 32). */
export const edOn = (): boolean => V().ed === 'book';

// ---------------------------------------------------------------- The control rig and other cyberware (Rigger 2 pp. 16–17)

/** A move-by-wire system (Cybertechnology p. 39) is told by its name; there is no cyberware kind for it. */
export const MOVE_BY_WIRE = /move[\s-]*by[\s-]*wire/i;

/**
 * The best installed move-by-wire level (0 without one): its rating, else its Initiative dice, else half its Reaction
 * bonus (Cybertechnology p. 39: +2 Reaction and +1D6 per level), at most 4.
 */
export function moveByWireLevel(ware: ReadonlyArray<{ name?: string; installed?: boolean; damaged?: boolean; rating?: number; initiativeDice?: number; reaction?: number }>): number {
  let best = 0;
  for (const w of ware ?? []) {
    if (!w || w.installed === false || w.damaged || !MOVE_BY_WIRE.test(String(w.name ?? ''))) continue;
    const lvl = whole(w.rating) || whole(w.initiativeDice) || Math.floor(whole(w.reaction) / 2);
    best = Math.max(best, Math.min(4, lvl));
  }
  return best;
}

/**
 * What other cyberware changes on the control rig's numbers (Rigger 2 p. 17): move-by-wire takes its level off the rig's
 * effective level for the Reaction and Initiative bonuses (never below none) and 1 die per level off the Control Pool;
 * an encephalon's Intelligence bonus (`encInt`) raises Reaction ((Quickness + Intelligence) ÷ 2, round down) and so the
 * rigged Reaction and the Control Pool (p. 16). All 0 under 'v971' or without a control rig.
 */
export function rigWareAdjust(o: { vcr: number; mbw: number; encInt: number; quickness: number; intelligence: number }): { reaction: number; dice: number; pool: number; lost: number; encReaction: number } {
  const none = { reaction: 0, dice: 0, pool: 0, lost: 0, encReaction: 0 };
  const vcr = whole(o.vcr);
  if (!on('rigWare') || vcr <= 0) return none;
  const mbw = whole(o.mbw);
  const lost = Math.min(mbw, vcr);
  const q = whole(o.quickness), i = whole(o.intelligence);
  const encReaction = Math.floor((q + i + whole(o.encInt)) / 2) - Math.floor((q + i) / 2);
  const r = RULES.RIGGING.vcr;
  return {
    reaction: -num(r.reactionPerLevel) * lost + encReaction,
    dice: -num(r.initiativeDicePerLevel) * lost,
    pool: -mbw + encReaction,
    lost, encReaction,
  };
}

// ---------------------------------------------------------------- The captain's chair (Rigger 2 p. 65)

/**
 * A rigger in the captain's chair (their `vrig98Chair` flag, a remote control deck and a control rig, not jumped in,
 * not in the Matrix) keeps the rig's Initiative: its rigged Reaction and dice (Rigger 2 p. 65). Null otherwise or under
 * 'v971'.
 */
export function captainInitiative(actor: any): { base: number; dice: number } | null {
  if (!on('captainsChair') || actor?.type === 'vehicle') return null;
  const r = actor?.system?.derived?.rigging;
  const sit = actor?.flags?.[SYSTEM_ID]?.vrig98Chair;
  if (sit !== true || !r || r.jumpedIn || !(whole(r.rcd) > 0) || !(whole(r.vcr) > 0) || actor?.system?.derived?.matrix?.jackedIn) return null;
  return { base: num(r.reaction), dice: whole(r.initiativeDice) };
}

// ---------------------------------------------------------------- Flux (Rigger 2 p. 30)

/** A sensor's or an ECM suite's Flux Rating: its rating × 1.5, rounded up (Rigger 2 p. 30, Flux Rating Table). */
export function deviceFlux(rating: number): number {
  return Math.ceil(whole(rating) * 1.5);
}

/** The scene conditions of the Situational Range Modifiers Table (Rigger 2 p. 30) a GM can set. */
export const FLUX_CONDITIONS: Readonly<Record<string, number>> = { elevation: 4, storm: -2, humid: -0.5, urban: -1 };

/** The scene's conditions as stored (known ids only; humid air never with an electrical storm, p. 30). */
export function fluxConditions(raw: unknown): string[] {
  const ids = (Array.isArray(raw) ? raw : []).filter((x): x is string => typeof x === 'string' && Object.hasOwn(FLUX_CONDITIONS, x));
  const set = [...new Set(ids)];
  return set.includes('storm') ? set.filter((x) => x !== 'humid') : set;
}

/**
 * A transmitter's Flux after the situational range modifiers (Rigger 2 p. 30): the scene's conditions, encryption in
 * use −0.5, ECCM in use −half its level; rounded down to the nearest half, never below 0. `mods` are the rows that
 * applied (ids, for the card). Under 'v971' the Flux as it is.
 */
export function modifiedFlux(o: { flux: number; conditions?: readonly string[]; encryption?: boolean; eccm?: number }): { flux: number; mods: Array<{ id: string; value: number }> } {
  const base = Math.max(0, num(o.flux));
  if (!on('flux')) return { flux: base, mods: [] };
  const mods: Array<{ id: string; value: number }> = [];
  for (const id of fluxConditions(o.conditions)) mods.push({ id, value: FLUX_CONDITIONS[id]! });
  if (o.encryption) mods.push({ id: 'encryption', value: -0.5 });
  const eccm = whole(o.eccm);
  if (eccm) mods.push({ id: 'eccm', value: -eccm / 2 });
  const raw = base + mods.reduce((n, m) => n + m.value, 0);
  return { flux: Math.max(0, Math.floor(raw * 2) / 2), mods };
}

/** The range of a whole Flux Rating (Rigger 2 p. 30 table: RULES.SIGNAL.rangeKm, past it 2 × Flux + 10 km). */
function wholeRange(flux: number): number {
  const t = RULES.SIGNAL.rangeKm;
  const f = whole(flux);
  return f < t.length ? num(t[f]) : 2 * f + 10;
}

/** The range of a Flux that may end in a half: halfway between the table's two ranges (VERIFY: the book doesn't say). */
export function fluxRangeKm(flux: number): number {
  const f = Math.max(0, num(flux));
  const lo = Math.floor(f);
  return f === lo ? wholeRange(lo) : (wholeRange(lo) + wholeRange(lo + 1)) / 2;
}

// ---------------------------------------------------------------- ECM, ECCM, ED and ECD (Rigger 2 pp. 31–32)

export interface Side { dice: number; tn: number }
const side = (dice: number, tn: number): Side => ({ dice: whole(dice), tn: Math.max(RULES.MIN_TARGET_NUMBER, whole(tn)) });

/**
 * The opposed tests a Sensor Test against an ECM-equipped vehicle calls for (Rigger 2 p. 31). The ECM Test: the jammer
 * its ECM's Flux vs the scanner's Sensor Rating, the scanner its sensors' Flux (less its ECD while it runs, p. 32) vs the
 * ECM Rating. The ECCM Test (when the scanner has ECCM): the scanner's ECCM vs the ECM Rating, the jammer's ECM Rating vs
 * the ECCM. Null when the target has no ECM or under 'v971'.
 */
export function ecmPlan(o: { ecm: number; sensor: number; eccm?: number; ecd?: number }): { jammer: Side; scanner: Side; eccm: { counter: Side; jammer: Side } | null } | null {
  const ecm = whole(o.ecm), sensor = whole(o.sensor), eccm = whole(o.eccm);
  if (!on('ecmTest') || ecm <= 0) return null;
  const drain = edOn() ? whole(o.ecd) : 0;
  return {
    jammer: side(deviceFlux(ecm), sensor),
    scanner: side(Math.max(0, deviceFlux(sensor) - drain), ecm),
    eccm: eccm > 0 ? { counter: side(eccm, ecm), jammer: side(ecm, eccm) } : null,
  };
}

/**
 * The target's Signature increase from the ECM Test (Rigger 2 p. 31): the jammer's successes when it wins (more than
 * the scanner's), less the ECCM Test's net successes (VERIFY: the book says each counterjammer success, its example
 * counts the net). Never below 0.
 */
export function ecmSignature(o: { jammer: number; scanner: number; counter?: number; counterJammer?: number }): number {
  const j = whole(o.jammer), s = whole(o.scanner);
  if (j <= s) return 0;
  const net = Math.max(0, whole(o.counter) - whole(o.counterJammer));
  return Math.max(0, j - net);
}

/**
 * Electronic deception (Rigger 2 p. 32, optional): the target's ED dice vs the scanner's Sensor Rating (+1 Signature per
 * success); the scanner's ECD dice vs the ED Rating (each success negates one). Null when off or without ED.
 */
export function edPlan(o: { ed: number; sensor: number; ecd?: number }): { ed: Side; ecd: Side | null } | null {
  const ed = whole(o.ed);
  if (!edOn() || ed <= 0) return null;
  return { ed: side(ed, whole(o.sensor)), ecd: whole(o.ecd) > 0 ? side(whole(o.ecd), ed) : null };
}

/** The Signature increase from ED (Rigger 2 p. 32): its successes less the ECD's, never below 0. */
export function edSignature(ed: number, ecd = 0): number {
  return Math.max(0, whole(ed) - whole(ecd));
}

// ---------------------------------------------------------------- Sensor Test results (Rigger 2 p. 28)

/** What a Sensor Test's successes tell (Rigger 2 p. 28, Sensor Test Results Table): the language key's last part. */
export function sensorResult(successes: number): 'r0' | 'r1' | 'r2' | 'r3' | 'r4' {
  const s = whole(successes);
  return s >= 4 ? 'r4' : s === 3 ? 'r3' : s === 2 ? 'r2' : s === 1 ? 'r1' : 'r0';
}

// ---------------------------------------------------------------- Missiles (Rigger 2 p. 59)

export type MissileMode = 'forget' | 'continuous';
/** The +TN on the firing vehicle's other Driving Tests in the turn of a continuous-lock launch (Rigger 2 p. 59). */
export const CONTINUOUS_DRIVING_TN = 2;

/** Extra Intelligence dice for a missile fired in continuous lock mode (Rigger 2 p. 59): half the Sensor, round down. */
export function continuousDice(mode: unknown, sensor: number): number {
  return on('missiles') && mode === 'continuous' ? Math.floor(whole(sensor) / 2) : 0;
}

/** A launch record on the firing vehicle (the turn it was in) and whether it still counts now. */
export function continuousLockNow(raw: unknown, now: { round: number | null; combatId: string | null }): boolean {
  if (!on('missiles') || !raw || typeof raw !== 'object' || now.round === null) return false;
  const r: any = raw;
  return Number(r.round) === now.round && str(r.combatId, 60) === String(now.combatId ?? '');
}

// ---------------------------------------------------------------- Shared mount points (Rigger 2 pp. 22, 131)

/**
 * The shared budget (Rigger 2 p. 22: a hardpoint takes 2 Body points, a firmpoint 1, at most the Body). With the sheet's
 * points set, those are the vehicle's mounts (over when they need more than the Body; the weapons are then checked
 * against them as before); else the weapons fill it, a hardpoint weapon 2 points, a firmpoint one 1. Null under 'v971'.
 */
export function mountBudget(o: { body: number; firmpoints: number; hardpoints: number; firmNeeded: number; hardNeeded: number }): { budget: number; used: number; over: boolean; fromSheet: boolean; sheetOver: boolean } | null {
  if (!on('mountBudget')) return null;
  const budget = whole(o.body);
  const f = whole(o.firmpoints), h = whole(o.hardpoints);
  const fromSheet = f + h > 0;
  const need = 2 * whole(o.hardNeeded) + whole(o.firmNeeded);
  const sheetOver = fromSheet && 2 * h + f > budget;
  return { budget, used: fromSheet ? 2 * h + f : need, over: fromSheet ? sheetOver : need > budget, fromSheet, sheetOver };
}

// ---------------------------------------------------------------- Comprehension Tests (Rigger 2 pp. 65–66)

/**
 * A drone's Comprehension Test (Rigger 2 p. 66): its Pilot in dice, plus the rigger's Non-Matrix Programming
 * specialization (at most the Pilot), against the command's TN; +2 when the rigger is running a primary drone (p. 65);
 * the command channel's degradation (p. 70). Null under 'v971'.
 */
export function comprehensionPlan(o: { pilot: number; tn?: number | null; primaryJumped: boolean; programming?: number; degradation?: number }): { dice: number; extra: number; tn: number; modifiers: Array<{ id: string; value: number }> } | null {
  if (!on('comprehension')) return null;
  const pilot = whole(o.pilot);
  const extra = Math.min(pilot, whole(o.programming));
  const tn = Math.max(RULES.MIN_TARGET_NUMBER, whole(o.tn ?? V().comprehensionTn) || RULES.MIN_TARGET_NUMBER);
  const modifiers: Array<{ id: string; value: number }> = [];
  if (o.primaryJumped) modifiers.push({ id: 'primary', value: 2 });
  if (whole(o.degradation)) modifiers.push({ id: 'degradation', value: whole(o.degradation) });
  return { dice: pilot + extra, extra, tn, modifiers };
}

// ---------------------------------------------------------------- Network drones act in the rigger's phase (Rigger 2 p. 66)

/** Whether `drone` is one of `rigger`'s network drones for the phase rule: subscribed and not driven by hand or from aboard. */
export function inNetwork(o: { subscribed: readonly string[]; droneUuid: string; droneDestroyed?: boolean; controlMode?: string; controllerUuid?: string; riggerUuid: string; riggerAboard?: boolean }): boolean {
  if (!on('dronePhase') || !o.droneUuid || !(o.subscribed ?? []).includes(o.droneUuid) || o.droneDestroyed) return false;
  if (o.controllerUuid && o.controllerUuid !== o.riggerUuid) return false;
  if (o.controllerUuid === o.riggerUuid && (o.controlMode === 'manual' || o.riggerAboard)) return false;
  return true;
}

/** Initiative order between a rigger and a drone of theirs at the same score: the rigger first (Rigger 2 p. 66). */
export function networkSort(aIsRiggerOfB: boolean, bIsRiggerOfA: boolean): number {
  return aIsRiggerOfB ? -1 : bIsRiggerOfA ? 1 : 0;
}

// ---------------------------------------------------------------- MIJI and the Signal Monitor (Rigger 2 pp. 68–72)

export const CHANNELS = ['command', 'simsense', 'system'] as const;
export type Channel = typeof CHANNELS[number];
export const OPS = ['meaconing', 'intrusion', 'jamming', 'interference'] as const;
export type MijiOp = typeof OPS[number];
/** The boxes on each channel of a Signal Monitor (Rigger 2 p. 70: filled, the channel is disengaged). */
export const SIGNAL_BOXES = 10;
/** The channels each operation can hit (Rigger 2 pp. 70–71). */
export const OP_CHANNELS: Readonly<Record<MijiOp, readonly Channel[]>> = {
  meaconing: ['command', 'system'], intrusion: ['command', 'simsense', 'system'], jamming: ['command', 'simsense', 'system'], interference: ['system'],
};

export interface ChannelState { boxes: number; ops: MijiOp[] }
export interface SignalMonitor { command: ChannelState; simsense: ChannelState; system: ChannelState; by: { rating: number; uuid: string } }
export const NO_SIGNAL: SignalMonitor = { command: { boxes: 0, ops: [] }, simsense: { boxes: 0, ops: [] }, system: { boxes: 0, ops: [] }, by: { rating: 0, uuid: '' } };

/** A network's Signal Monitor as stored (anything malformed reads as clear). */
export function signalMonitor(raw: unknown): SignalMonitor {
  const r: any = raw && typeof raw === 'object' ? raw : {};
  const ch = (c: any): ChannelState => ({
    boxes: Math.min(SIGNAL_BOXES, whole(c?.boxes)),
    ops: [...new Set((Array.isArray(c?.ops) ? c.ops : []).filter((x: unknown): x is MijiOp => typeof x === 'string' && (OPS as readonly string[]).includes(x)))] as MijiOp[],
  });
  return { command: ch(r.command), simsense: ch(r.simsense), system: ch(r.system), by: { rating: Math.min(30, whole(r.by?.rating)), uuid: str(r.by?.uuid) } };
}

/** The TN modifier of a channel's degradation (Rigger 2 p. 70: Light at 1 box +1, Moderate at 3 +2, Serious at 6 +3). */
export function degradationTn(boxes: number): number {
  const b = whole(boxes);
  return b >= 6 ? 3 : b >= 3 ? 2 : b >= 1 ? 1 : 0;
}

/** Whether a channel is lost (all its boxes filled: the carrier is gone, p. 70). */
export const channelLost = (m: SignalMonitor, c: Channel): boolean => m[c].boxes >= SIGNAL_BOXES;

/**
 * Where a network's degradation bites (Rigger 2 pp. 70–71): `comprehension` the command channel (not from meaconing,
 * p. 70); `pilot` the drones' Pilot tests, from meaconed channels (command or system); `remote` a rigger rigging a drone
 * through the deck, the simsense channel. 0 under 'v971'.
 */
export function degradationFor(m: SignalMonitor, use: 'comprehension' | 'pilot' | 'remote'): number {
  if (!on('miji')) return 0;
  if (use === 'remote') return degradationTn(m.simsense.boxes);
  if (use === 'comprehension') return m.command.ops.some((o) => o !== 'meaconing') ? degradationTn(m.command.boxes) : 0;
  return Math.max(0, ...(['command', 'system'] as const).filter((c) => m[c].ops.includes('meaconing')).map((c) => degradationTn(m[c].boxes)));
}

/**
 * The MIJI Test (Rigger 2 p. 69): the intruder its deck's Flux vs the target deck's rating; the defender its deck's
 * Flux vs the intruder's protocol emulation module (jamming: vs the intruder's ECM). Refused (a key in `why`) without a
 * remote control deck, without a protocol emulation module (meaconing, intrusion, interference) or ECM (jamming), or
 * at a channel the operation can't hit.
 */
export function mijiPlan(o: { op: MijiOp; channel: Channel; intruderRcd: number; intruderFlux: number; pem: number; intruderEcm: number; targetRcd: number; targetFlux: number }): { intruder: Side; defender: Side; why?: string } {
  const intruder = side(o.intruderFlux, o.targetRcd);
  const vs = o.op === 'jamming' ? whole(o.intruderEcm) : whole(o.pem);
  const defender = side(o.targetFlux, vs);
  const no = (why: string) => ({ intruder, defender, why: `${WHY}${why}` });
  if (!on('miji')) return no('mijiOff');
  if (!(OPS as readonly string[]).includes(o.op) || !OP_CHANNELS[o.op].includes(o.channel)) return no('channel');
  if (whole(o.intruderRcd) <= 0) return no('noRcd');
  if (whole(o.targetRcd) <= 0) return no('noNetwork');
  if (o.op === 'jamming' ? whole(o.intruderEcm) <= 0 : whole(o.pem) <= 0) return no(o.op === 'jamming' ? 'noEcm' : 'noPem');
  return { intruder, defender };
}

/**
 * The MIJI Test's result (Rigger 2 pp. 69–71): the intruder winning puts the net successes as boxes on the target's
 * channel; an interference attempt the intruder loses puts the defender's net on the intruder's own system channel.
 */
export function mijiOutcome(op: MijiOp, mine: number, theirs: number): { target: number; self: number } {
  const d = whole(mine) - whole(theirs);
  return { target: Math.max(0, d), self: op === 'interference' ? Math.max(0, -d) : 0 };
}

/** A monitor with `boxes` more on `channel` from `op` (at most 10), and the intruder's device rating for regeneration. */
export function degrade(raw: unknown, channel: Channel, boxes: number, op: MijiOp, by: { rating: number; uuid: string }): SignalMonitor {
  const m = signalMonitor(raw);
  const b = whole(boxes);
  if (!b || !(CHANNELS as readonly string[]).includes(channel)) return m;
  const c = m[channel];
  return { ...m, [channel]: { boxes: Math.min(SIGNAL_BOXES, c.boxes + b), ops: [...new Set([...c.ops, op])] }, by: { rating: Math.min(30, whole(by.rating)), uuid: str(by.uuid) } };
}

/** The ECCM Test to regenerate a channel (Rigger 2 p. 72): ECCM dice vs the intruder's deck or ECM (the higher) + 3. */
export function regenPlan(o: { eccm: number; intruderRating: number }): Side & { why?: string } {
  const s = side(o.eccm, whole(o.intruderRating) + 3);
  if (!on('miji')) return { ...s, why: `${WHY}mijiOff` };
  return whole(o.eccm) > 0 ? s : { ...s, why: `${WHY}noEccm` };
}

/** A channel after an ECCM Test: 1 box off per 2 successes (Rigger 2 p. 72); a cleared channel forgets what hit it. */
export function regenerate(raw: unknown, channel: Channel, successes: number): SignalMonitor {
  const m = signalMonitor(raw);
  if (!(CHANNELS as readonly string[]).includes(channel)) return m;
  const boxes = Math.max(0, m[channel].boxes - Math.floor(whole(successes) / 2));
  return { ...m, [channel]: { boxes, ops: boxes ? m[channel].ops : [] } };
}

/** The TN modifier rows for a degraded channel (empty without degradation). */
export function degradationMods(value: number, label: string): TargetNumberModifier[] {
  return whole(value) ? [{ id: 'signalDegradation', label, value: whole(value) }] : [];
}
