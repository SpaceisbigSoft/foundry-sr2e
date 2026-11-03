/**
 * v0.73.0: Matrix and rigging fixes from the v0.69.0 review (O22–O27). Pure, Foundry-free functions; the rule
 * values and switches are NETRIG_V73 (rules/config73/netrig.ts), read at call time through RULES.NETRIG_V73
 * once it is wired into RULES (the same object), else the module's own: Graceful Logoff and black IC holds
 * (O22), persona damage on Matrix initiative (O23), the hosts a player's character knows (O24), the rammer's
 * share after the defense and for its passengers (O25), the control rig on gunnery and evasion (O26), and
 * sensor locks that lapse with time and range (O27).
 */
import { RULES } from './config.ts';
import type { TargetNumberModifier } from './dice.ts';
import { matrixWoundModifiers } from './datawar.ts';
import { initiativeWoundPenalty } from './initiative.ts';
import { numberMatches } from './netrig.ts';
import { NETRIG_V73 } from './config73/netrig.ts';
import { combatStamp, sameCombatRound } from './util.ts';
import { t as tx, tCount } from '../helpers/i18n.ts';

type Cfg = typeof NETRIG_V73;
/** The live block: RULES.NETRIG_V73 once wired into RULES (the same object), else the module's own. */
const V = (): Cfg => ((RULES as any).NETRIG_V73 ?? NETRIG_V73) as Cfg;
const str = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v));
const whole = (v: unknown) => Math.max(0, Math.floor(Number(v) || 0));
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// ---------------------------------------------------------------- O22: Graceful Logoff and a black IC hold

/**
 * O22: whether Graceful Logoff is refused because black IC holds the decker (`hold` = SR2Actor.blackIcHold(),
 * null when nothing holds them). A frame's or agent's logoff is never held; `force` (the GM's force flag) and,
 * with `gmOverride`, the GM's own click go through. Off: never refused (the old way).
 */
export function logoffHoldCheck(o: {
  hold: { name: string } | null | undefined; deckerName?: string; frame?: boolean; isGM?: boolean; force?: boolean;
}): { block: boolean; note: string } {
  const c = V().logoffHold;
  if (!c.enabled || !o.hold || o.frame || o.force || (o.isGM && c.gmOverride)) return { block: false, note: '' };
  const who = str(o.deckerName) || tx('SR2E.Text.Gridwork.theDecker');
  return {
    block: true,
    note: tx('SR2E.Text.Gridwork.isHoldingGracefulLogoff', { name: o.hold.name, who }),
  };
}

// ---------------------------------------------------------------- O23: persona damage on Matrix initiative

/** O23: the initiative penalty from `boxes` of persona (Matrix) damage: its wound modifier (MATRIX_V57.wounds bands); 0 when off. */
export function personaInitiativePenalty(matrixBoxes: number): number {
  if (!V().personaInitiative.enabled || !RULES.INITIATIVE_WOUNDS.enabled) return 0;
  const sum = matrixWoundModifiers(whole(matrixBoxes)).reduce((n, m) => n + (Number(m.value) || 0), 0);
  return initiativeWoundPenalty(sum);
}

/**
 * O23: what a jacked-in decker's initiative loses: the body's wound penalty (`bodyPenalty`, already through
 * initiativeWoundPenalty) and the persona's, added ('add') or the worse of the two ('max'). Off: the body's only.
 */
export function jackedInInitiativeMinus(bodyPenalty: number, matrixBoxes: number): number {
  const body = whole(bodyPenalty);
  const persona = personaInitiativePenalty(matrixBoxes);
  if (!persona) return body;
  return V().personaInitiative.combine === 'max' ? Math.max(body, persona) : body + persona;
}

/**
 * O23: the "wound modifier" a combatant's score is kept against for mid-turn drops (the token hook's
 * before/after values for midTurnWoundDrop): the body's, plus the persona's while jacked in.
 */
export function initiativeWoundScore(o: { woundModifier: number; jackedIn: boolean; matrixBoxes: number }): number {
  const body = whole(o.woundModifier);
  return o.jackedIn ? jackedInInitiativeMinus(body, o.matrixBoxes) : body;
}

// ---------------------------------------------------------------- O24: the hosts a character knows

export type HostKnowledge = 'none' | 'located' | 'analyzed';
/** One known host on a character (system.matrix.knownHosts). */
export interface KnownHost { uuid: string; analyzed: boolean }
export interface HostNode {
  uuid: string; name?: string; gridKind?: string; parentUuid?: string; ltgNumber?: string;
  securityCode?: string; securityValue?: number;
}
export interface HostKnowledgeContext {
  known: readonly KnownHost[];
  /** LTG numbers the decker knows (system.matrix.numbers). */
  numbers?: readonly string[];
  /** The node the decker is in, and its parent grid. */
  currentUuid?: string; currentParentUuid?: string;
  isGM?: boolean;
}

const RANK: Record<HostKnowledge, number> = { none: 0, located: 1, analyzed: 2 };
const best = (a: HostKnowledge, b: HostKnowledge): HostKnowledge => (RANK[b] > RANK[a] ? b : a);

/** O24: what this character (or the GM) knows of a host: nothing, that it's there (located), or its code (analyzed). */
export function hostKnowledge(host: HostNode, ctx: HostKnowledgeContext): HostKnowledge {
  const c = V().knownHosts;
  if (!c.enabled || (ctx.isGM && c.gmSeesAll)) return 'analyzed';
  let k: HostKnowledge = 'none';
  const own = ctx.known.find((h) => h.uuid === host.uuid);
  if (own) k = best(k, own.analyzed ? 'analyzed' : 'located');
  const kind = str(host.gridKind) || 'host';
  if (kind !== 'host' && c.grids !== 'hidden') k = best(k, c.grids);
  if (ctx.currentUuid && host.uuid === ctx.currentUuid) k = best(k, 'located');
  if (c.parentKnown && ctx.currentParentUuid && host.uuid === ctx.currentParentUuid) k = best(k, 'located');
  if (c.byNumber && host.ltgNumber && (ctx.numbers ?? []).some((n) => numberMatches(n, host.ltgNumber))) k = best(k, 'located');
  return k;
}

/** O24: add a host to a known list (never downgrades an analyzed host); returns a new list. */
export function learnHost(known: readonly KnownHost[], uuid: string, level: 'located' | 'analyzed'): KnownHost[] {
  const out = known.map((h) => ({ uuid: h.uuid, analyzed: Boolean(h.analyzed) }));
  if (!uuid) return out;
  const i = out.findIndex((h) => h.uuid === uuid);
  if (i < 0) out.push({ uuid, analyzed: level === 'analyzed' });
  else if (level === 'analyzed') out[i] = { uuid, analyzed: true };
  return out;
}

/** O24: what logging on to a host (or the GM's Move into it) teaches (NETRIG_V73.knownHosts.onEntry). */
export function hostEntryKnowledge(): 'located' | 'analyzed' {
  return V().knownHosts.onEntry === 'analyzed' ? 'analyzed' : 'located';
}

/** O24: the tag after a host's name in a list: "HOST Orange-6" when analyzed, "HOST, code unknown" when only located. */
export function hostTag(host: HostNode, knowledge: HostKnowledge): string {
  const kind = (str(host.gridKind) || 'host').toUpperCase();
  if (knowledge === 'analyzed') return `${kind} ${cap(str(host.securityCode))}-${Number(host.securityValue ?? 0)}`;
  return tx('SR2E.Text.Gridwork.codeUnknown', { kind });
}

/**
 * O24: the hosts to list for this character (or the GM) in the log-on, Move and agent-search dialogs, in the
 * given order, each with what is known and its label ("Name (HOST Orange-6)"); unknown hosts are left out.
 */
export function hostChoices<T extends HostNode>(hosts: readonly T[], ctx: HostKnowledgeContext): Array<{ host: T; knowledge: HostKnowledge; label: string }> {
  const out: Array<{ host: T; knowledge: HostKnowledge; label: string }> = [];
  for (const h of hosts) {
    const knowledge = hostKnowledge(h, ctx);
    if (knowledge === 'none') continue;
    out.push({ host: h, knowledge, label: `${str(h.name)} (${hostTag(h, knowledge)})` });
  }
  return out;
}

// ---------------------------------------------------------------- O25: ramming

/** O25: whether the attack card itself offers the rammer's damage (the old way: any success). */
export function ramSelfOnAttackCard(attackSuccesses: number): boolean {
  return !V().ram.afterDefense && Number(attackSuccesses) > 0;
}

/**
 * O25: on the target's defense card: whether the rammer's damage is offered now (the ram connected after the
 * defense) and a line for the card. Nothing when the rule is off (the attack card had it) or this wasn't a ram.
 */
export function ramSelfAfterDefense(o: { hit: boolean; ram: { power: number; level: string | null } | null | undefined; vehicleName?: string }): { offer: boolean; note: string } {
  if (!V().ram.afterDefense || !o.ram || !o.ram.level) return { offer: false, note: '' };
  if (!o.hit) return { offer: false, note: tx('SR2E.Text.Gridwork.theRamMissedTakesNo', { name: str(o.vehicleName) || tx('SR2E.Text.Gridwork.theRammer') }) };
  return { offer: true, note: '' };
}

/** O25: whether damage on a vehicle carries through to the people aboard: attacks do, crashes don't, the rammer's share does with `ram.passengers`. */
export function ramPassengersHurt(o: { crash?: boolean; ramSelf?: boolean }): boolean {
  if (!o.crash) return true;
  return Boolean(o.ramSelf) && V().ram.passengers;
}

// ---------------------------------------------------------------- O26: the control rig on every vehicle test

/**
 * O26: the control rig's TN modifier for a jumped-in rigger's gunnery or Control-Pool evasion
 * (RULES.RIGGING.vcr.tnPerLevel × level), [] when not jumped in, no rig, or the switch for that test is off.
 * Driving and sensor tests already have it (drivingModifiers, sensorSituation).
 */
export function controlRigTn(o: { test: 'gunnery' | 'evasion'; vcr: number; jumpedIn: boolean }): TargetNumberModifier[] {
  const per = Number(RULES.RIGGING.vcr.tnPerLevel) || 0;
  const vcr = whole(o.vcr);
  if (!o.jumpedIn || vcr <= 0 || !per || !V().controlRig[o.test]) return [];
  return [{ label: tx('SR2E.Card.Mod.controlRig', { vcr }), value: per * vcr }];
}

// ---------------------------------------------------------------- O27: sensor locks lapse

/** v0.81.1 (RA2-4 sibling): `combatId` the combat `round` belongs to (undefined = not said: rounds compare as before). */
export interface LockNow { round: number | null; worldTime: number; combatId?: string | null }
export interface SensorLock { targetUuid: string; targetName: string; successes: number; round?: number; worldTime?: number; combatId?: string }

/** O27: when a lock was made or refreshed, to store on it (round -1 outside combat; v0.81.1: and its combat). */
export function sensorLockStamp(now: LockNow): { round: number; worldTime: number; combatId?: string } {
  return { round: now.round == null ? -1 : Math.floor(Number(now.round)), worldTime: Number(now.worldTime) || 0, ...combatStamp(now) };
}

/**
 * O27: whether a lock has lapsed. `metres`: the distance to the target (null = the target isn't on the
 * vehicle's scene; undefined = unknown, e.g. no canvas). A lock with no stamp (made before v0.73.0) never
 * lapses by time. Off: never.
 */
export function sensorLockLapse(lock: Pick<SensorLock, 'round' | 'worldTime' | 'combatId'>, o: {
  now: LockNow; metres?: number | null; sensorRating: number; sensorsOut?: boolean;
}): { lapsed: boolean; why: string } {
  const c = V().sensorLocks;
  if (!c.enabled) return { lapsed: false, why: '' };
  if (c.sensorsOut && o.sensorsOut) return { lapsed: true, why: 'sensors shot out' };
  if (o.metres === null && c.offScene) return { lapsed: true, why: 'target gone' };
  if (c.range && typeof o.metres === 'number' && Number.isFinite(o.metres)) {
    const max = Math.max(1, whole(o.sensorRating)) * Math.max(0, Number(c.maxMetresPerRating) || 0);
    if (max > 0 && o.metres > max) return { lapsed: true, why: tx('SR2E.Text.Gridwork.outOfSensorRange', { metres: Math.round(o.metres), max }) };
  }
  const turns = whole(c.turns);
  if (turns > 0) {
    const r = lock.round, w = lock.worldTime;
    // Review fix: a round count lower than the stamp is another combat; fall back to world time then. v0.81.1: so is a
    // round set in another combat (or before v0.81.1, with no combat id) when `now` names its combat (util.ts sameCombatRound).
    if (o.now.round != null && typeof r === 'number' && r >= 0 && o.now.round >= r && sameCombatRound({ round: r, combatId: lock.combatId }, o.now)) {
      if (o.now.round - r >= turns) return { lapsed: true, why: tCount(turns, 'SR2E.Text.Gridwork.noSensorTestFor') };
    } else if (typeof w === 'number' && w >= 0) {
      const secs = turns * Math.max(1, Number(c.secondsPerTurn) || 3);
      if (Number(o.now.worldTime) - w >= secs) return { lapsed: true, why: tCount(turns, 'SR2E.Text.Gridwork.noSensorTestFor') };
    }
  }
  return { lapsed: false, why: '' };
}

/**
 * O27: a vehicle's locks after a sweep: the ones still held, and the ones that lapsed (with why).
 * `metres` maps target uuid → distance (null = not on the scene; missing = unknown).
 */
export function sweepSensorLocks<L extends SensorLock>(locks: readonly L[], o: {
  now: LockNow; metres?: Readonly<Record<string, number | null | undefined>>; sensorRating: number; sensorsOut?: boolean;
}): { keep: L[]; dropped: Array<{ targetUuid: string; targetName: string; why: string }> } {
  const keep: L[] = [];
  const dropped: Array<{ targetUuid: string; targetName: string; why: string }> = [];
  for (const l of locks) {
    const metres = o.metres && Object.prototype.hasOwnProperty.call(o.metres, l.targetUuid) ? o.metres[l.targetUuid] : undefined;
    const r = sensorLockLapse(l, { now: o.now, metres, sensorRating: o.sensorRating, sensorsOut: o.sensorsOut });
    if (r.lapsed) dropped.push({ targetUuid: l.targetUuid, targetName: l.targetName, why: r.why });
    else keep.push(l);
  }
  return { keep, dropped };
}
