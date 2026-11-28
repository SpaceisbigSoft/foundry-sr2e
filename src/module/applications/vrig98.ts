/**
 * v0.98.0 rules completeness, rigging, drones, sensors and electronic warfare. The Foundry glue for RULES.VRIG_V98
 * (pure logic: rules/vrig98.ts): the ECM and ED tests of a Sensor Test, the Sensor Test results line, missile fire
 * modes, the TN rows a drone or a remote rigger's driving gets from degradation and a continuous-lock launch, network
 * drones acting in their rigger's phase, Comprehension Tests, the captain's chair, the Flux of a remote link, MIJI with
 * the Signal Monitor, and the GM's rigging tool (the scene's Flux conditions).
 *
 * Security: a player rigger owns their drones and their own actor, so the Signal Monitor, the captain's chair, a
 * continuous-lock launch and the subscriber list are player-writable. They only count on that player's own side: a
 * rigger's network (degradation on its drones' tests, the phase rule) is honoured only for drones with exactly the
 * rigger's owners. Degradation on someone else's network is written by a GM: at once on a GM's client, else from a
 * MIJI card a GM applies, which counts only the card's intruder dice again against TNs read now from the documents
 * (and only for an intruder the card's author owns) and rolls the defender's test on the GM's own client; the cards
 * applied are remembered on the target network (`vrig98MijiApplied`, GM-written), by card id and by dice signature,
 * never on the player's card. The GM's write runs under the GM lock (inline inside a card's re-run). The scene's Flux
 * conditions are a scene flag (GM-written). A vehicle's ECM, ECCM, ED, ECD and Sensor count at most
 * rules/vrig98.ts EW_MAX. Every value put into HTML is escaped.
 */
import { SYSTEM_ID } from '../config/system.ts';
import { RULES } from '../rules/config.ts';
import { escHtml } from '../rules/html.ts';
import { t as tx, tKey } from '../helpers/i18n.ts';
import { successTest, type SuccessTestResult, type TargetNumberModifier } from '../rules/dice.ts';
import { signalCheck, type SignalCheck } from '../rules/netrig.ts';
import { droneLinkOf, linkEncryption } from '../rules/dronelink.ts';
import * as X from '../rules/vrig98.ts';
import { authorOwns, gmMay } from './trust.ts';
import { allActors } from '../helpers/actors.ts';
import { withGmLock } from './gmlock.ts';

const G = (): any => (globalThis as any).game;
const isGm = (): boolean => Boolean(G()?.user?.isGM);
const warn = (text: string): void => { (globalThis as any).ui?.notifications?.warn?.(escHtml(text)); };
const post = (content: string, extra: Record<string, unknown> = {}): Promise<any> => (globalThis as any).ChatMessage.create({ content, ...extra });
const speaker = (actor: any): any => { try { return (globalThis as any).ChatMessage.getSpeaker({ actor }); } catch { return {}; } };
const name = (a: any): string => escHtml(String(a?.name ?? ''));
const raw = (a: any): string => String(a?.name ?? '');
const int = (v: unknown, min: number, max: number, d = min): number => { const n = Math.floor(Number(v)); return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : d; };
const uuidOk = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 400;
const sync = (uuid: unknown): any => { try { return uuidOk(uuid) ? (globalThis as any).fromUuidSync?.(uuid) ?? null : null; } catch { return null; } };
const actorClass = (): any => (globalThis as any).CONFIG?.Actor?.documentClass;
const users = (): any[] => [...(G()?.users ?? [])];
const gmIds = (): string[] => users().filter((u: any) => u.isGM).map((u: any) => u.id);
const flag = (a: any, k: string): unknown => (typeof a?.getFlag === 'function' ? a.getFlag(SYSTEM_ID, k) : a?.flags?.[SYSTEM_ID]?.[k]);
const now = (): { round: number | null; worldTime: number; combatId: string | null } => actorClass()?.matrixNow?.() ?? { round: null, worldTime: 0, combatId: null };
const canWrite = (doc: any): boolean => Boolean(doc?.isOwner);
/** A GM write step: under the GM lock, inline inside a card's re-run (which already holds it, applications/core95.ts gmRun). */
const gmLocked = <T>(fn: () => Promise<T>): Promise<T> => {
  const cls = actorClass();
  return cls?.actingAuthor || cls?.inAuthorRun ? fn() : withGmLock(fn);
};

/** The flags this file keeps: a rigger's network Signal Monitor, the captain's chair, a vehicle's continuous-lock launch; the scene's Flux conditions. */
export const SIGNAL_FLAG = 'vrig98Signal';
export const CHAIR_FLAG = 'vrig98Chair';
export const LOCK_FLAG = 'vrig98Lock';
export const FLUX_FLAG = 'vrig98Flux';
/** The MIJI cards a GM applied against a network (on the target rigger, written by the GM: rules/vrig98.ts appliedList). */
export const APPLIED_FLAG = 'vrig98MijiApplied';

/** Dice rolled with Foundry (shown by Dice So Nice through the card's rolls). */
function roller(sink: any[]): (count: number) => Promise<number[]> {
  return async (count: number) => {
    const roll = await new (globalThis as any).Roll(`${count}d6`).evaluate();
    sink.push(roll);
    return (roll.dice ?? []).flatMap((term: any) => term.results.map((r: any) => Number(r.result)));
  };
}
/** A test rolled here (its Roll objects go into `sink`). */
async function rollTest(dice: number, tn: number, sink: any[], modifiers: TargetNumberModifier[] = []): Promise<SuccessTestResult> {
  return successTest({ dice: Math.max(0, dice), targetNumber: tn, modifiers, roll: roller(sink) });
}
const diceText = (r: SuccessTestResult): string => r.dice.map((d) => Number(d.total)).join(', ');
/** A rolled test's card line; `label` is the caller's translated text (escaped here). */
function rollHtml(label: string, r: SuccessTestResult): string {
  return `<p>${escHtml(label)}: ${tx('SR2E.VRig98.roll', { dice: escHtml(diceText(r) || '-'), tn: r.targetNumber, successes: r.successes })}</p>`;
}

/** The non-GM users who own a document. */
function playerOwners(doc: any): string[] {
  return users().filter((u: any) => !u.isGM && Boolean(doc?.testUserPermission?.(u, 'OWNER'))).map((u: any) => String(u.id)).sort();
}
/** Whether two documents have exactly the same player owners (both GM-only counts): one side of the table. */
export function sameSide(a: any, b: any): boolean {
  if (!a || !b) return false;
  return playerOwners(a).join(',') === playerOwners(b).join(',');
}

// ================================================================ Sensor Tests: ECM, ED, results (Rigger 2 pp. 28, 31–32)

/**
 * Before a Sensor Test (documents/index.ts sensorTest): under ecmTest 'book' the ECM Test (and the ECCM Test), and with
 * the optional ED rule the ED and ECD Tests, rolled here and posted on their own card; the Signature they add comes back
 * as TN modifiers. Null under 'v971' (the caller keeps the ECM − ECCM row).
 */
export async function sensorEw(scanner: any, target: any): Promise<TargetNumberModifier[] | null> {
  if (!X.on('ecmTest')) return null;
  if (target?.type !== 'vehicle') return [];
  const s = scanner?.system ?? {}, t = target.system ?? {};
  const sensor = Number(s.derived?.working?.sensor ?? s.sensor ?? 0);
  const out: TargetNumberModifier[] = [];
  const lines: string[] = [];
  const rolls: any[] = [];
  const plan = X.ecmPlan({ ecm: Number(t.ecm ?? 0), sensor, eccm: Number(s.eccm ?? 0), ecd: Number(s.ecd ?? 0) });
  if (plan) {
    const j = await rollTest(plan.jammer.dice, plan.jammer.tn, rolls);
    const sc = await rollTest(plan.scanner.dice, plan.scanner.tn, rolls);
    lines.push(rollHtml(tx('SR2E.VRig98.Ecm.jammer', { name: raw(target) }), j), rollHtml(tx('SR2E.VRig98.Ecm.scanner', { name: raw(scanner) }), sc));
    let cc = 0, cj = 0;
    if (plan.eccm && j.successes > sc.successes) {
      const c = await rollTest(plan.eccm.counter.dice, plan.eccm.counter.tn, rolls);
      const cjr = await rollTest(plan.eccm.jammer.dice, plan.eccm.jammer.tn, rolls);
      cc = c.successes; cj = cjr.successes;
      lines.push(rollHtml(tx('SR2E.VRig98.Ecm.eccm', { name: raw(scanner) }), c), rollHtml(tx('SR2E.VRig98.Ecm.ecmVsEccm', { name: raw(target) }), cjr));
    }
    const inc = X.ecmSignature({ jammer: j.successes, scanner: sc.successes, counter: cc, counterJammer: cj });
    lines.push(`<p><strong>${inc ? tx('SR2E.VRig98.Ecm.jammed', { name: name(target), n: inc }) : tx('SR2E.VRig98.Ecm.clear', { name: name(target) })}</strong></p>`);
    if (inc) out.push({ id: 'ecm98', label: tx('SR2E.VRig98.Ecm.mod', { n: inc }), value: inc });
  }
  const ed = X.edPlan({ ed: Number(t.ed ?? 0), sensor, ecd: Number(s.ecd ?? 0) });
  if (ed) {
    const e = await rollTest(ed.ed.dice, ed.ed.tn, rolls);
    const d = ed.ecd ? await rollTest(ed.ecd.dice, ed.ecd.tn, rolls) : null;
    lines.push(rollHtml(tx('SR2E.VRig98.Ed.ed', { name: raw(target) }), e));
    if (d) lines.push(rollHtml(tx('SR2E.VRig98.Ed.ecd', { name: raw(scanner) }), d));
    const inc = X.edSignature(e.successes, d?.successes ?? 0);
    if (inc && isGm()) out.push({ id: 'ed98', label: tx('SR2E.VRig98.Ed.mod', { n: inc }), value: inc });
    else if (inc) {
      // A player's own Sensor card: ED's effect is on the GMs' card only, so no ED row: one electronic warfare row with
      // the ECM's increase folded in (the TN still counts it; VERIFY known limit).
      const ecmRow = out.findIndex((m) => m.id === 'ecm98');
      const total = inc + (ecmRow >= 0 ? Number(out[ecmRow]!.value) : 0);
      if (ecmRow >= 0) out.splice(ecmRow, 1);
      out.push({ id: 'ew98', label: tx('SR2E.VRig98.Ew.mod', { n: total }), value: total });
    }
  }
  if (lines.length) {
    // ED's effect is the GM's secret (Rigger 2 p. 32): that card goes to the GMs only.
    await post(`<p><strong>${tx('SR2E.VRig98.Ecm.title', { name: name(scanner), target: name(target) })}</strong></p>${lines.join('')}`, { speaker: speaker(target), rolls, ...(ed ? { whisper: gmIds() } : {}) });
  }
  return out;
}

/** Whether the v0.25.0 ECD "notices the scan" roll still runs (not with the optional ED rule on: ECD is counter-deception, p. 32). */
export function ecdNoticeRoll(): boolean {
  return !X.edOn();
}

/** The Sensor Test Results Table's line for a test's successes (Rigger 2 p. 28); '' under 'v971'. */
export function sensorResultHtml(successes: number): string {
  if (!X.on('sensorResults')) return '';
  const key = `SR2E.VRig98.Sensor.${X.sensorResult(successes)}`;
  return `<p class="sr2e-hint">${escHtml(tKey(key))}</p>`;
}

// ================================================================ Missiles (Rigger 2 p. 59)

/**
 * A guided missile fired from a vehicle (documents/index.ts planAttack, the attack's dice): continuous lock mode's extra
 * dice (half the vehicle's Sensor) and the timing line. Writes nothing (planAttack also runs for a preview and before
 * the attack's refusals): the launch is noted by noteLaunch once the attack rolled.
 */
export function missileFire(mv: any, guidance: number, mode: unknown): { dice: number; note: string } {
  if (!X.on('missiles') || !(Number(guidance) > 0)) return { dice: 0, note: '' };
  const sensor = Number(mv?.system?.derived?.working?.sensor ?? mv?.system?.sensor ?? 0);
  const dice = mv ? X.continuousDice(mode, sensor) : 0;
  const n = now();
  const timing = n.round !== null ? tx('SR2E.VRig98.Missile.phase0') : '';
  const lock = mode === 'continuous' ? tx('SR2E.VRig98.Missile.continuous', { dice }) : '';
  return { dice, note: [lock, timing].filter(Boolean).join(' ') };
}

/**
 * After a mounted attack rolled (documents/index.ts #attackWith): a guided missile fired in continuous lock mode is noted
 * on the firing vehicle for its other Driving Tests this turn (Rigger 2 p. 59). Awaited; nothing under 'v971'.
 */
export async function noteLaunch(mounted: { vehicleUuid?: string } | null | undefined, guidance: number, mode: unknown): Promise<void> {
  if (!X.on('missiles') || mode !== 'continuous' || !(Number(guidance) > 0) || !mounted) return;
  const mv: any = sync(mounted.vehicleUuid);
  const n = now();
  if (!mv || n.round === null || !canWrite(mv)) return;
  await mv.setFlag?.(SYSTEM_ID, LOCK_FLAG, { round: n.round, combatId: String(n.combatId ?? '') });
}

/** The fire-mode row of the mounted-fire dialog for a guided missile ('' when it isn't one or under 'v971'). */
export function missileModeRow(weapon: any): string {
  if (!X.on('missiles') || !(Number(weapon?.system?.guidance ?? 0) > 0)) return '';
  return `<div class="form-group"><label>${tx('SR2E.VRig98.Missile.mode')}</label><select name="missileMode98"><option value="forget">${tx('SR2E.VRig98.Missile.forget')}</option><option value="continuous">${tx('SR2E.VRig98.Missile.continuousOption')}</option></select></div>`;
}

// ================================================================ Driving: degradation and a continuous-lock launch

/** The rigger whose network a drone is in: subscribed, and on the drone's side of the table (sameSide). */
export function networkRigger(drone: any): any | null {
  if (drone?.type !== 'vehicle') return null;
  return allActors().find((a: any) => a?.type !== 'vehicle' && (a.system?.rigging?.subscribed ?? []).includes(drone.uuid) && sameSide(a, drone)) ?? null;
}

/** A rigger's network Signal Monitor (rules/vrig98.ts signalMonitor). */
export const monitorOf = (rigger: any): X.SignalMonitor => X.signalMonitor(flag(rigger, SIGNAL_FLAG));

/**
 * TN rows for a driving test (documents/index.ts #driveSetup): a vehicle that launched a missile in continuous lock mode
 * this turn (+2, Rigger 2 p. 59); a drone on its Pilot, its network's meaconing degradation; a rigger rigging it through
 * the deck, the simsense channel's (Rigger 2 pp. 70–71).
 */
export function driveMods(driver: any, vehicle: any, mode: string, remote: boolean): TargetNumberModifier[] {
  const out: TargetNumberModifier[] = [];
  if (X.continuousLockNow(flag(vehicle, LOCK_FLAG), now())) out.push({ id: 'continuousLock98', label: tx('SR2E.VRig98.Missile.drivingMod'), value: X.CONTINUOUS_DRIVING_TN });
  if (!X.on('miji')) return out;
  if (mode === 'autopilot') {
    const r = networkRigger(vehicle);
    if (r) out.push(...X.degradationMods(X.degradationFor(monitorOf(r), 'pilot'), tx('SR2E.VRig98.Miji.degradedMod')));
  } else if (mode === 'jumped' && remote) {
    out.push(...X.degradationMods(X.degradationFor(monitorOf(driver), 'remote'), tx('SR2E.VRig98.Miji.degradedMod')));
  }
  return out;
}

/** Why a rigger can't send commands now (the command channel is lost, Rigger 2 p. 70); '' when they can. */
export function commandLost(rigger: any): string {
  return X.on('miji') && X.channelLost(monitorOf(rigger), 'command') ? tx('SR2E.VRig98.Miji.commandLost', { name: String(rigger?.name ?? '') }) : '';
}

/** A group command refused for a lost command channel: one warning for the whole network (true: refused). */
export function commandRefused(rigger: any): boolean {
  const lost = commandLost(rigger);
  if (lost) warn(lost);
  return Boolean(lost);
}

/** Why a rigger can't rig a drone through the deck now (the simsense carrier is lost, Rigger 2 p. 70); '' when they can. */
export function simsenseLost(rigger: any): string {
  return X.on('miji') && X.channelLost(monitorOf(rigger), 'simsense') ? tx('SR2E.VRig98.Miji.simsenseLost', { name: String(rigger?.name ?? '') }) : '';
}

// ================================================================ Network drones in the rigger's phase (Rigger 2 p. 66)

/** Whether `rigger` runs `drone` as a network drone (rules/vrig98.ts inNetwork, and the same side of the table). */
export function runsDrone(rigger: any, drone: any): boolean {
  if (!rigger || drone?.type !== 'vehicle' || rigger.type === 'vehicle') return false;
  const v = drone.system ?? {};
  return X.inNetwork({
    subscribed: rigger.system?.rigging?.subscribed ?? [], droneUuid: String(drone.uuid ?? ''), droneDestroyed: Boolean(v.derived?.destroyed),
    controlMode: String(v.controlMode ?? ''), controllerUuid: String(v.controllerUuid ?? ''), riggerUuid: String(rigger.uuid ?? ''),
    riggerAboard: Boolean(drone.isAboard?.(rigger)),
  }) && sameSide(rigger, drone);
}

/**
 * After initiative is rolled (documents/index.ts SR2Combat.rollInitiative): each network drone takes its rigger's score
 * (it acts in the rigger's phase, the rigger first: networkOrder). Only combatants this client may update. Foundry has
 * already fixed `turn` by then: on a GM's client the acting combatant stays the acting one (as SR2Combat.alignParties).
 */
export async function networkPhase(combat: any): Promise<void> {
  if (!X.on('dronePhase')) return;
  const list: any[] = [...(combat?.combatants ?? [])];
  const updates: Array<{ _id: string; initiative: number }> = [];
  for (const c of list) {
    if (c?.actor?.type !== 'vehicle' || !c.canUserModify?.(G()?.user, 'update')) continue;
    const r = list.find((o: any) => o !== c && o.initiative !== null && o.initiative !== undefined && runsDrone(o.actor, c.actor));
    if (r && Number(c.initiative) !== Number(r.initiative)) updates.push({ _id: String(c.id), initiative: Number(r.initiative) });
  }
  if (!updates.length) return;
  const current: string | null = combat?.started ? (combat.combatant?.id ?? null) : null;
  await combat.updateEmbeddedDocuments('Combatant', updates);
  if (current && isGm() && typeof combat.update === 'function') {
    const i = [...(combat.turns ?? [])].findIndex((c: any) => c?.id === current);
    if (i >= 0 && i !== combat.turn) await combat.update({ turn: i });
  }
}

/** The initiative order between two combatants at the same score: a rigger before their network drones (0: no say). */
export function networkOrder(a: any, b: any): number {
  if (!X.on('dronePhase') || a?.initiative === null || a?.initiative === undefined || Number(a.initiative) !== Number(b?.initiative)) return 0;
  return X.networkSort(runsDrone(a?.actor, b?.actor), runsDrone(b?.actor, a?.actor));
}

// ================================================================ Comprehension Tests (Rigger 2 pp. 65–66)

/** The rigger's Non-Matrix Programming specialization (Rigger 2 p. 66), 0 without one. */
function programming(rigger: any): number {
  return [...(rigger?.items ?? [])].filter((i: any) => i.type === 'skill' && /non[\s-]*matrix/i.test(String(i.system?.specialization ?? '')))
    .reduce((n: number, i: any) => Math.max(n, Number(i.system?.specializationRating ?? 0) || 0), 0);
}

/**
 * A drone told to act by a group command (documents/index.ts groupDrive / groupAttack): its Comprehension Test, on its
 * own card. True when it understood (or the rule is off).
 */
export async function comprehends(rigger: any, drone: any, tn?: number | null): Promise<boolean> {
  const jumped = Boolean(rigger?.system?.rigging?.jumpedIn) && String(rigger?.system?.rigging?.vehicleUuid ?? '') !== String(drone?.uuid ?? '');
  const plan = X.comprehensionPlan({ pilot: Number(drone?.system?.derived?.autopilotRating ?? 0), tn: tn ?? null, primaryJumped: jumped, programming: programming(rigger), degradation: X.degradationFor(monitorOf(rigger), 'comprehension') });
  if (!plan) return true;
  const rolls: any[] = [];
  const mods: TargetNumberModifier[] = plan.modifiers.map((m) => ({ id: `comprehension98:${m.id}`, label: m.id === 'primary' ? tx('SR2E.VRig98.Comprehension.primary') : tx('SR2E.VRig98.Miji.degradedMod'), value: m.value }));
  const r = await rollTest(plan.dice, plan.tn, rolls, mods);
  const ok = r.successes > 0;
  await post(`${rollHtml(tx('SR2E.VRig98.Comprehension.test', { name: raw(drone), dice: plan.dice, extra: plan.extra }), r)}<p><strong>${ok ? tx('SR2E.VRig98.Comprehension.ok', { name: name(drone), successes: r.successes }) : tx('SR2E.VRig98.Comprehension.fail', { name: name(drone) })}</strong></p>`, { speaker: speaker(drone), rolls });
  return ok;
}

// ================================================================ The captain's chair (Rigger 2 p. 65)

/** The sheet's captain's chair button (null when it doesn't apply). */
export function chairContext(actor: any): { on: boolean } | null {
  // Rigger 2 p. 65: the chair keeps the control rig's Initiative, so it needs a rig as well as the deck.
  const r = actor?.system?.derived?.rigging;
  if (!X.on('captainsChair') || !(Number(r?.rcd ?? 0) > 0) || !(Number(r?.vcr ?? 0) > 0)) return null;
  return { on: Boolean(flag(actor, CHAIR_FLAG)) };
}

/** Sit in the captain's chair, or get up (the rigger's own flag: only their own Initiative reads it). */
export async function toggleChair(actor: any): Promise<void> {
  if (!actor || !canWrite(actor) || !chairContext(actor)) return;
  const sit = !flag(actor, CHAIR_FLAG);
  await actor.setFlag(SYSTEM_ID, CHAIR_FLAG, sit);
  await post(`<p>${sit ? tx('SR2E.VRig98.Chair.sits', { name: name(actor) }) : tx('SR2E.VRig98.Chair.leaves', { name: name(actor) })}</p>`, { speaker: speaker(actor) });
}

// ================================================================ Flux and range (Rigger 2 p. 30)

/** The scene's Flux conditions (a GM-written scene flag). */
export function sceneConditions(scene: any): string[] {
  return X.fluxConditions(flag(scene, FLUX_FLAG));
}

/** The range check for a Flux that may end in a half (rules/netrig.ts signalCheck, with the half-step range). */
export function fluxCheck(flux: number, km: number): SignalCheck {
  const whole = Math.floor(flux);
  const base = signalCheck(whole, km);
  if (flux === whole) return base;
  const rangeKm = X.fluxRangeKm(flux);
  if (!base.checked) return { ...base, rangeKm };
  const s = RULES.SIGNAL;
  const d = base.km;
  const inRange = d <= rangeKm;
  const far = inRange && rangeKm > 0 && d > rangeKm * s.farFraction;
  const fmt = (n: number) => (n < 1 ? tx('SR2E.VRig98.Flux.metres', { n: Math.round(n * 1000) }) : tx('SR2E.VRig98.Flux.km', { n: Math.round(n * 10) / 10 }));
  const note = inRange ? (far ? tx('SR2E.Text.Netrig.ofSignalNearTheEdge', { distance: fmt(d), range: fmt(rangeKm), rating: flux }) : tx('SR2E.Text.Netrig.ofSignal', { distance: fmt(d), range: fmt(rangeKm), rating: flux })) : tx('SR2E.Text.Netrig.outOfRangeSignal', { distance: fmt(d), range: fmt(rangeKm), rating: flux });
  return { checked: true, inRange, far, rangeKm, km: d, modifiers: far && s.farTn ? [{ id: 'weakSignal', label: tx('SR2E.Card.Mod.weakSignal'), value: s.farTn }] : [], note };
}

/** The rigger's best working remote control deck (as documents/index.ts #droneLinkFacts picks it). */
function deckOf(rigger: any): any | null {
  return [...(rigger?.items ?? [])].filter((i: any) => i.type === 'gear' && Number(i.system?.rcdRating ?? 0) > 0 && !i.system?.damaged && i.system?.carried !== false)
    .sort((a: any, b: any) => Number(b.system.rcdRating) - Number(a.system.rcdRating))[0] ?? null;
}

/**
 * A rigger's remote link to a vehicle (documents/index.ts remoteLink): the deck's Flux after the scene's conditions,
 * the link's encryption (the better of the drone's and the deck's, rules/dronelink.ts linkEncryption) and the
 * network's ECCM (eccmOf: the vehicle the deck rides in, or ECCM gear). Null under 'v971'.
 */
export function linkFlux(rigger: any, vehicle: any, flux: number, km: number): { flux: number; check: SignalCheck } | null {
  if (!X.on('flux')) return null;
  const scene = vehicle?.sceneHere?.() ?? (globalThis as any).canvas?.scene ?? null;
  const encryption = linkEncryption({ drone: droneLinkOf(vehicle?.system).encryption, rcd: Number(deckOf(rigger)?.system?.radio?.encryption ?? 0) });
  const f = X.modifiedFlux({ flux, conditions: sceneConditions(scene), encryption: encryption > 0, eccm: eccmOf(rigger) });
  return { flux: f.flux, check: fluxCheck(f.flux, km) };
}

/** GM: the rigging tool: the current scene's Flux conditions (Rigger 2 p. 30, Situational Range Modifiers). */
export async function openRiggingTool(): Promise<void> {
  if (!isGm()) return;
  const scene: any = G()?.scenes?.viewed ?? (globalThis as any).canvas?.scene ?? null;
  if (!scene) { warn(tx('SR2E.VRig98.Tool.noScene')); return; }
  const have = new Set(sceneConditions(scene));
  const label = (id: string): string => tKey(`SR2E.VRig98.Flux.${id}`);
  const rows = Object.entries(X.FLUX_CONDITIONS).map(([id, v]) => `<label class="sr2e-check"><input type="checkbox" name="flux98" value="${escHtml(id)}"${have.has(id) ? CHECKED : ''}> ${escHtml(label(id))} (${v > 0 ? '+' : ''}${v})</label>`).join('');
  const pick = await (globalThis as any).foundry?.applications?.api?.DialogV2?.prompt?.({
    window: { title: tx('SR2E.VRig98.Tool.title') },
    content: `<p>${tx('SR2E.VRig98.Tool.scene', { name: name(scene) })}</p>${rows}<p class="hint">${tx('SR2E.VRig98.Tool.hint')}</p>`,
    ok: { label: tx('SR2E.VRig98.Tool.save'), callback: (_e: Event, b: any) => [...(b.form ? b.form.querySelectorAll('input[name="flux98"]:checked') : [])].map((x: any) => String(x.value)) },
    rejectClose: false,
  }) as string[] | null;
  if (!pick) return;
  await scene.setFlag(SYSTEM_ID, FLUX_FLAG, X.fluxConditions(pick));
}

// ================================================================ MIJI and the Signal Monitor (Rigger 2 pp. 68–72)

/** A carried gear's rating read from its name ("Protocol Emulation Module 4"): the device has no field of its own. */
function ratedGear(actor: any, re: RegExp): number {
  return [...(actor?.items ?? [])].filter((i: any) => i.type === 'gear' && re.test(String(i.name ?? '')) && i.system?.carried !== false)
    .reduce((n: number, i: any) => Math.max(n, int(/(\d+)/.exec(String(i.name ?? ''))?.[1], 0, 20, 0)), 0);
}
const CHECKED = ' checked';
const PEM = /protocol\s*emulation/i;
const ECCM = /\beccm\b/i;

/** What the MIJI Test reads from the two riggers now (Rigger 2 p. 69). */
function mijiValues(intruder: any, target: any): { intruderRcd: number; intruderFlux: number; pem: number; intruderEcm: number; targetRcd: number; targetFlux: number } {
  return {
    intruderRcd: Number(intruder?.system?.derived?.rigging?.rcd ?? 0), intruderFlux: Number(intruder?.rcdSignal?.() ?? 0),
    pem: ratedGear(intruder, PEM), intruderEcm: Number(intruder?.jammerRating?.() ?? 0),
    targetRcd: Number(target?.system?.derived?.rigging?.rcd ?? 0), targetFlux: Number(target?.rcdSignal?.() ?? 0),
  };
}

/** Whether the intruder has intercepted the target network (a link of one of its drones, Rigger 2 p. 68). */
function intercepted(intruder: any, target: any): boolean {
  return [...(target?.system?.rigging?.subscribed ?? [])].some((u: string) => droneLinkOf(sync(u)?.system).intercepted.byUuid === intruder?.uuid);
}

const opLabel = (op: string): string => tKey(`SR2E.VRig98.Miji.op.${op}`);
const chLabel = (c: string): string => tKey(`SR2E.VRig98.Miji.ch.${c}`);
const lostEffect = (c: string): string => tKey(`SR2E.VRig98.Miji.lostEffect.${c}`);

/** The MIJI dialog (documents' drone-link dialog under miji 'book'): the target network, the operation, the channel. */
export async function mijiDialog(intruder: any): Promise<void> {
  const seen = new Set<string>();
  const nets = allActors().filter((a: any) => a && a.uuid !== intruder?.uuid && a.type !== 'vehicle' && Number(a.system?.derived?.rigging?.rcd ?? 0) > 0)
    .filter((a: any) => (seen.has(a.uuid) ? false : (seen.add(a.uuid), true)));
  if (!nets.length) { warn(tx('SR2E.VRig98.Miji.noNetworks')); return; }
  const ops = X.OPS.map((o) => `<option value="${o}">${escHtml(opLabel(o))}</option>`).join('');
  const chs = X.CHANNELS.map((c) => `<option value="${c}">${escHtml(chLabel(c))}</option>`).join('');
  const choice = await (globalThis as any).foundry?.applications?.api?.DialogV2?.prompt?.({
    window: { title: tx('SR2E.VRig98.Miji.title', { name: String(intruder?.name ?? '') }) },
    content: `<div class="form-group"><label>${tx('SR2E.VRig98.Miji.network')}</label><select name="target">${nets.map((a: any) => `<option value="${escHtml(a.uuid)}">${name(a)}</option>`).join('')}</select></div>
      <div class="form-group"><label>${tx('SR2E.VRig98.Miji.operation')}</label><select name="op"><option value="intercept">${tx('SR2E.VRig98.Miji.intercept')}</option>${ops}</select></div>
      <div class="form-group"><label>${tx('SR2E.VRig98.Miji.channel')}</label><select name="channel">${chs}</select></div>
      <div class="form-group"><label>${tx('SR2E.VRig98.Miji.mod')}</label><input name="mod" type="number" value="0" min="0"></div>
      <p class="hint">${tx('SR2E.VRig98.Miji.hint')}</p>`,
    ok: { label: tx('SR2E.VRig98.Miji.roll'), callback: (_e: Event, b: any) => ({ target: String(b.form.elements.target.value), op: String(b.form.elements.op.value), channel: String(b.form.elements.channel.value), mod: int(b.form.elements.mod.value, 0, 12, 0) }) },
    rejectClose: false,
  }) as { target: string; op: string; channel: string; mod: number } | null;
  if (!choice) return;
  const target: any = sync(choice.target);
  if (choice.op === 'intercept') {
    // Signal interception (Rigger 2 p. 68) is a drone link's (the existing interception, VEHICLES_V923.interception).
    const drone = [...(target?.system?.rigging?.subscribed ?? [])].map((u: string) => sync(u)).find((d: any) => d?.type === 'vehicle');
    if (!drone) { warn(tx('SR2E.VRig98.Miji.noDrone', { name: String(target?.name ?? '') })); return; }
    await intruder.interceptDroneLink?.(drone.uuid);
    return;
  }
  await mijiTest(intruder, target, choice.op as X.MijiOp, choice.channel as X.Channel, choice.mod);
}

/**
 * The MIJI Test (Rigger 2 p. 69). On a GM's client both sides are rolled on one card and the degradation goes on the
 * target network's Signal Monitor at once (an interference attempt lost degrades the intruder's own system channel). On
 * a player's client only the intruder's side is rolled: the card's Apply (GM) button rolls the defender's side on the
 * GM's client and writes the result (applyMiji). Returns the outcome when both sides were rolled here, else
 * `{ target: 0, self: 0, pending: true }`.
 */
export async function mijiTest(intruder: any, target: any, op: X.MijiOp, channel: X.Channel, mod = 0): Promise<{ target: number; self: number; pending?: boolean } | null> {
  if (!intruder || !target) return null;
  const plan = X.mijiPlan({ op, channel, ...mijiValues(intruder, target) });
  if (plan.why) { warn(tKey(plan.why)); return null; }
  // A GM's intruder isn't held up by the target's drones' link state (a player's drones are the player's to write).
  if (!isGm() && !intercepted(intruder, target)) { warn(tx('SR2E.VRig98.Why.intercept', { name: String(target.name ?? '') })); return null; }
  if (intruder.useAction && !(await intruder.useAction('droneCommand', tx('SR2E.VRig98.Miji.action', { op: opLabel(op) })))) return null;
  const extra = int(mod, 0, 12, 0);
  const v = mijiValues(intruder, target);
  const rolls: any[] = [];
  const mods: TargetNumberModifier[] = extra ? [{ id: 'other', label: tx('SR2E.Card.Mod.other'), value: extra }] : [];
  const mine = await rollTest(plan.intruder.dice, plan.intruder.tn, rolls, mods);
  const head = `<p><strong>${tx('SR2E.VRig98.Miji.card', { name: name(intruder), op: escHtml(opLabel(op)), channel: escHtml(chLabel(channel)), target: name(target) })}</strong></p>`;
  const mineHtml = rollHtml(tx('SR2E.VRig98.Miji.intruderRoll', { name: raw(intruder) }), mine);
  const flags = { [SYSTEM_ID]: { vrig98Miji: { intruderUuid: String(intruder.uuid), targetUuid: String(target.uuid), op, channel, mod: extra } } };
  if (!isGm()) {
    // The defender's dice are the GM side's: rolled on the GM's client at Apply, never taken from this card.
    const button = `<p><button type="button" data-sr2e-action="vrig98Apply">${tx('SR2E.VRig98.Miji.apply')}</button></p>`;
    await post(`${head}${mineHtml}<p>${tx('SR2E.VRig98.Miji.pending', { target: name(target) })}</p>${button}`, { speaker: speaker(intruder), rolls, flags });
    return { target: 0, self: 0, pending: true };
  }
  const theirs = await rollTest(plan.defender.dice, plan.defender.tn, rolls);
  const res = X.mijiOutcome(op, mine.successes, theirs.successes);
  await post(`${head}${mineHtml}${outcomeHtml(intruder, target, channel, res, theirs)}`, { speaker: speaker(intruder), rolls, flags });
  await gmLocked(() => writeOutcome(intruder, target, op, channel, res, v));
  return res;
}

/** The defender's roll and the outcome lines of a MIJI card. */
function outcomeHtml(intruder: any, target: any, channel: X.Channel, res: { target: number; self: number }, theirs: SuccessTestResult): string {
  const self = res.self ? `<p>${tx('SR2E.VRig98.Miji.backfire', { name: name(intruder), boxes: res.self })}</p>` : '';
  return `${rollHtml(tx('SR2E.VRig98.Miji.defenderRoll', { name: raw(target) }), theirs)}<p><strong>${res.target ? tx('SR2E.VRig98.Miji.hit', { boxes: res.target, channel: escHtml(chLabel(channel)), target: name(target) }) : tx('SR2E.VRig98.Miji.held', { target: name(target) })}</strong></p>${self}`;
}

/** A MIJI result on the two monitors (a GM's client; the intruder's own monitor also on its owner's). */
async function writeOutcome(intruder: any, target: any, op: X.MijiOp, channel: X.Channel, res: { target: number; self: number }, v: ReturnType<typeof mijiValues>): Promise<void> {
  if (res.target) await degradeNetwork(target, channel, res.target, op, { rating: Math.max(v.intruderRcd, v.intruderEcm), uuid: String(intruder.uuid) });
  if (res.self) await degradeNetwork(intruder, 'system', res.self, op, { rating: v.targetRcd, uuid: String(target.uuid) });
}

/** Write boxes on a network's monitor (a GM's client, or the network's own owner), with its card line when the channel is lost. */
async function degradeNetwork(rigger: any, channel: X.Channel, boxes: number, op: X.MijiOp, by: { rating: number; uuid: string }): Promise<boolean> {
  if (!canWrite(rigger)) return false;
  const before = monitorOf(rigger);
  const after = X.degrade(flag(rigger, SIGNAL_FLAG), channel, boxes, op, by);
  await rigger.setFlag(SYSTEM_ID, SIGNAL_FLAG, after);
  if (!X.channelLost(before, channel) && X.channelLost(after, channel)) {
    await post(`<p><strong>${tx('SR2E.VRig98.Miji.lost', { name: name(rigger), channel: escHtml(chLabel(channel)) })}</strong> ${escHtml(lostEffect(channel))}</p>`, { speaker: speaker(rigger) });
  }
  return true;
}

/** The dice faces a card's rolls show, in the order they were rolled. */
const cardFaces = (card: any): number[] => (Array.isArray(card?.rolls) ? card.rolls : [])
  .flatMap((r: any) => (r?.dice ?? []).flatMap((term: any) => (term?.results ?? []).map((x: any) => int(x?.result, 1, 6, 1)))).slice(0, 400);

/** Replay a card's faces through a test (the same order they were rolled in); null when the card hasn't enough. */
async function replay(faces: number[], dice: number, tn: number, mods: TargetNumberModifier[]): Promise<SuccessTestResult | null> {
  try {
    return await successTest({ dice, targetNumber: tn, modifiers: mods, roll: async (n: number) => { if (faces.length < n) throw new Error('short'); return faces.splice(0, n); } });
  } catch { return null; }
}

/** The applied-card keys of a MIJI card: its id and its dice signature (rules/vrig98.ts mijiSignature). */
function appliedKeys(card: any, c: any, faces: readonly number[]): { id: string; sig: string } {
  return { id: `id|${String(card?.id ?? '').slice(0, 64)}`, sig: X.mijiSignature({ intruderUuid: String(c.intruderUuid ?? ''), targetUuid: String(c.targetUuid ?? ''), op: String(c.op ?? ''), channel: String(c.channel ?? ''), mod: int(c.mod, 0, 12, 0), faces }) };
}
/** Whether the target network's GM-written record already holds a key ('id' or 'sig'), or ''. */
function appliedBefore(target: any, keys: { id: string; sig: string }): '' | 'id' | 'sig' {
  const list = X.appliedList(flag(target, APPLIED_FLAG));
  return list.includes(keys.id) ? 'id' : list.includes(keys.sig) ? 'sig' : '';
}
const refuseApplied = (why: '' | 'id' | 'sig', target: any): boolean => {
  if (why === 'id') warn(tx('SR2E.VRig98.alreadyDone'));
  else if (why === 'sig') warn(tx('SR2E.VRig98.Miji.sameDice', { target: String(target?.name ?? '') }));
  return Boolean(why);
};

/**
 * GM side: a MIJI card's Apply. Only a card whose author owns the intruder; the plan is made again from the documents
 * now (the same dice and TNs, the player's own TN modifier counted only upward), only the intruder's dice are counted
 * again from the card, the defender's test is rolled here on the GM's client, both shown in the GM's dialog, and the
 * result is written on the monitors under the GM lock. Once per card and once per dice signature, remembered on the
 * target network (APPLIED_FLAG, GM-written), never on the card. True when the result was written.
 */
export async function applyMiji(card: any): Promise<boolean> {
  if (!isGm()) { warn(tx('SR2E.VRig98.gmOnly')); return false; }
  const c: any = card?.flags?.[SYSTEM_ID]?.vrig98Miji;
  if (!c || typeof c !== 'object') { warn(tx('SR2E.VRig98.refused')); return false; }
  const intruder: any = sync(c.intruderUuid), target: any = sync(c.targetUuid);
  const op = (X.OPS as readonly string[]).includes(c.op) ? c.op as X.MijiOp : null;
  const channel = (X.CHANNELS as readonly string[]).includes(c.channel) ? c.channel as X.Channel : null;
  // The interception is checked again here: the target network's drones are the GM side's (a player's card targets an NPC's).
  if (!intruder || !target || !op || !channel || !authorOwns(card, intruder) || !intercepted(intruder, target)) { warn(tx('SR2E.VRig98.refused')); return false; }
  const v = mijiValues(intruder, target);
  const plan = X.mijiPlan({ op, channel, ...v });
  if (plan.why) { warn(tKey(plan.why)); return false; }
  const extra = int(c.mod, 0, 12, 0);
  const faces = cardFaces(card);
  const keys = appliedKeys(card, c, faces);
  if (refuseApplied(appliedBefore(target, keys), target)) return false;
  const mine = await replay(faces, plan.intruder.dice, plan.intruder.tn, extra ? [{ id: 'other', label: '', value: extra }] : []);
  if (!mine) { warn(tx('SR2E.VRig98.refused')); return false; }
  const rolls: any[] = [];
  const theirs = await rollTest(plan.defender.dice, plan.defender.tn, rolls);
  const res = X.mijiOutcome(op, mine.successes, theirs.successes);
  const lines = [
    tx('SR2E.VRig98.Miji.gmIntruder', { name: raw(intruder), dice: plan.intruder.dice, tn: mine.targetNumber, faces: diceText(mine) || '-', successes: mine.successes }),
    tx('SR2E.VRig98.Miji.gmDefender', { name: raw(target), dice: plan.defender.dice, tn: theirs.targetNumber, faces: diceText(theirs) || '-', successes: theirs.successes }),
    tx('SR2E.VRig98.Miji.gmGear', { pem: v.pem, ecm: v.intruderEcm, target: raw(target), eccm: eccmOf(target) }),
    res.target ? tx('SR2E.VRig98.Miji.gmResult', { boxes: res.target, channel: chLabel(channel), target: raw(target) }) : tx('SR2E.VRig98.Miji.gmHeld', { target: raw(target) }),
    ...(res.self ? [tx('SR2E.VRig98.Miji.gmBackfire', { boxes: res.self, name: raw(intruder) })] : []),
  ];
  // The GM's dialog before the lock (never a dialog while holding it).
  const ok = await gmMay(card, { title: tx('SR2E.VRig98.Miji.gmTitle'), lines, target: String(target.uuid), sources: [String(intruder.uuid)], always: true });
  if (!ok) return false;
  return gmLocked(async () => {
    // Again under the lock: another click (or GM) may have applied it meanwhile.
    if (refuseApplied(appliedBefore(target, keys), target)) return false;
    await target.setFlag(SYSTEM_ID, APPLIED_FLAG, X.withApplied(flag(target, APPLIED_FLAG), [keys.id, keys.sig]));
    // The acting-author guard cancels a write quietly: only a record that landed counts as applied.
    if (appliedBefore(target, keys) !== 'id') { warn(tx('SR2E.VRig98.refused')); return false; }
    await post(`<p><strong>${tx('SR2E.VRig98.Miji.appliedCard', { name: name(intruder), op: escHtml(opLabel(op)), channel: escHtml(chLabel(channel)), target: name(target) })}</strong></p>${rollHtml(tx('SR2E.VRig98.Miji.intruderRoll', { name: raw(intruder) }), mine)}${outcomeHtml(intruder, target, channel, res, theirs)}`, { speaker: speaker(target), rolls });
    await writeOutcome(intruder, target, op, channel, res, v);
    return true;
  });
}

/** The network's ECCM for regenerating (Rigger 2 p. 72): the vehicle the deck rides in, else ECCM gear ("ECCM 4"). */
function eccmOf(rigger: any): number {
  return Math.min(X.EW_MAX, Math.max(Number(rigger?.vehicleAboard?.()?.system?.eccm ?? 0) || 0, ratedGear(rigger, ECCM)));
}

/** Regenerate one channel (Rigger 2 p. 72): the network's owner, a Complex Action, ECCM vs the intruder's rating + 3. */
export async function regenDialog(rigger: any): Promise<void> {
  if (!rigger || !canWrite(rigger)) return;
  const m = monitorOf(rigger);
  const worst = X.CHANNELS.filter((c) => m[c].boxes > 0);
  if (!worst.length) { warn(tx('SR2E.VRig98.Miji.clean', { name: String(rigger.name ?? '') })); return; }
  const channel = await (globalThis as any).foundry?.applications?.api?.DialogV2?.prompt?.({
    window: { title: tx('SR2E.VRig98.Miji.regenTitle', { name: String(rigger.name ?? '') }) },
    content: `<div class="form-group"><label>${tx('SR2E.VRig98.Miji.channel')}</label><select name="channel">${worst.map((c) => `<option value="${c}">${escHtml(chLabel(c))} (${m[c].boxes})</option>`).join('')}</select></div>`,
    ok: { label: tx('SR2E.VRig98.Miji.roll'), callback: (_e: Event, b: any) => String(b.form.elements.channel.value) },
    rejectClose: false,
  }) as string | null;
  if (!channel || !(X.CHANNELS as readonly string[]).includes(channel)) return;
  await regenerate(rigger, channel as X.Channel);
}

/** The ECCM Test and its boxes off (the owner's own monitor). */
export async function regenerate(rigger: any, channel: X.Channel): Promise<number | null> {
  const m = monitorOf(rigger);
  const plan = X.regenPlan({ eccm: eccmOf(rigger), intruderRating: m.by.rating });
  if (plan.why) { warn(tKey(plan.why)); return null; }
  if (rigger.useAction && !(await rigger.useAction('droneCommand', tx('SR2E.VRig98.Miji.regenAction')))) return null;
  const rolls: any[] = [];
  const r = await rollTest(plan.dice, plan.tn, rolls);
  const after = X.regenerate(flag(rigger, SIGNAL_FLAG), channel, r.successes);
  await rigger.setFlag(SYSTEM_ID, SIGNAL_FLAG, after);
  const off = m[channel].boxes - after[channel].boxes;
  await post(`${rollHtml(tx('SR2E.VRig98.Miji.regenRoll', { name: raw(rigger), channel: chLabel(channel) }), r)}<p><strong>${tx('SR2E.VRig98.Miji.regenDone', { boxes: off, left: after[channel].boxes })}</strong></p>`, { speaker: speaker(rigger), rolls });
  return off;
}

/** The sheet's Signal Monitor line and buttons (null when the rule is off or the actor has no deck). */
export function signalContext(actor: any): { text: string; any: boolean } | null {
  if (!X.on('miji') || !(Number(actor?.system?.derived?.rigging?.rcd ?? 0) > 0)) return null;
  const m = monitorOf(actor);
  const text = X.CHANNELS.map((c) => tx('SR2E.VRig98.Miji.monitorPart', { channel: chLabel(c), boxes: m[c].boxes, max: X.SIGNAL_BOXES, tn: X.degradationTn(m[c].boxes) })).join(' · ');
  return { text, any: X.CHANNELS.some((c) => m[c].boxes > 0) };
}

/** The chat card buttons of this file. */
/** The MIJI cards whose Apply is running on this client (a double click is one Apply). */
const busy = new Set<string>();

export async function onCard(message: any, button: HTMLButtonElement, action: string): Promise<void> {
  if (action === 'vrig98Apply') {
    const id = String(message?.id ?? '');
    if (busy.has(id)) return;
    busy.add(id);
    if (button) button.disabled = true;
    try {
      const done = await applyMiji(message);
      // Refused or cancelled: the GM can press it again (an applied card stays refused by the GM-side record).
      if (!done && button) button.disabled = false;
    } finally { busy.delete(id); }
  }
}
