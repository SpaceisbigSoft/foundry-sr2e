/**
 * v0.98.0 rules completeness, vehicles: driving, vehicle combat and chases. The Foundry glue for RULES.VDRIVE_V98 (pure
 * logic: rules/vdrive98.ts): the maneuver rows on driving tests, the ram's range, Stress, the passenger safety gear and
 * the Crash Test's Control Pool carry-over, a Deadly hit on a passenger, the called-shot thresholds, and the GM's
 * "Vehicle chase" tool (the Maneuver Scores, Hiding, Relocating, hitting a wall).
 *
 * Security: the chase record (every vehicle's Maneuver Score, Driver Points, positioning carried over, who is hidden
 * from whom, the GM's vehicle types, the chase turns whose positioning was recorded) lives on the combat, written only
 * by a GM's client. A player's vehicle is player-writable, so what the GM's client reads from one is checked or bounded
 * there (v0.98.0 review): its Speed at most the books' largest and its current speed at most 1.5 × the Speed again;
 * its driver counts only when on the vehicle's side (`onSide`) or pointing back at it; its vehicle type is the GM's
 * (shown on each score row, changeable in the tool; by category noted unconfirmed); its passengers (`occupants`) count
 * for the passenger limit and the hidden-contact refusal only when on its side (a GM is warned, never refused); a
 * pursuer counts only with a combatant in the combat and while the GM's scores dialog has it ticked. A card's
 * positioning successes are recorded by a GM's button (gmMay; the author's side recounted from the card's dice faces,
 * at most the dice and at least the TN the GM's client works out; once per pair and per vehicle and turn on the
 * record), the side the author doesn't own rolled on the GM's client. Passengers' extra resistance dice count only from
 * a GM's card or a crash card whose author owns that vehicle, bounded (`trustDice`). The Light hit on a vehicle goes
 * through gmMay unless the card's author owns the vehicle, once per card on a GM-written world setting (`lightDone`). Each GM
 * write step runs under the GM lock (inline inside a card's re-run), after its dialog; each GM button has an in-flight
 * guard. Every value put into HTML is escaped.
 */
import { SYSTEM_ID } from '../config/system.ts';
import { RULES, type DamageLevel } from '../rules/config.ts';
import { escHtml } from '../rules/html.ts';
import { t as tx, tKey } from '../helpers/i18n.ts';
import { replaceFlag } from '../helpers/flags.ts';
import { finalTargetNumber, successTest, type SuccessTestResult, type TargetNumberModifier } from '../rules/dice.ts';
import * as X from '../rules/vdrive98.ts';
import { CHASE98 } from '../rules/config98/vdrive.ts';
import { allActors } from '../helpers/actors.ts';
import { measureTokens } from './canvas.ts';
import { authorIsGm, authorOwns, gmMay } from './trust.ts';
import { withGmLock } from './gmlock.ts';
import { chaseSpeedModifier } from '../rules/vehicles.ts';

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
const OWNER = 'OWNER';

/** The non-GM users who own a document. */
function playerOwners(doc: any): string[] {
  return [...(G()?.users ?? [])].filter((u: any) => !u?.isGM && Boolean(doc?.testUserPermission?.(u, OWNER))).map((u: any) => String(u.id));
}

/**
 * Whether `who` counts as aboard (or at the controls of) `vehicle` when the vehicle lists them (S3, S4, S8): a vehicle
 * no player owns is GM-written; a player's vehicle only for someone a player who owns the vehicle owns too.
 */
export function onSide(vehicle: any, who: any): boolean {
  if (!vehicle || !who) return false;
  const vo = playerOwners(vehicle);
  if (!vo.length) return true;
  return playerOwners(who).some((u) => vo.includes(u));
}

/** The vehicle's controller when it counts (on its side, or its rigging points back at the vehicle), else null. */
export function ctlOf(vehicle: any): any | null {
  let ctl: any = null;
  try { ctl = vehicle?.system?.controllerUuid ? vehicle.controller?.() ?? null : null; } catch { ctl = null; }
  if (!ctl) return null;
  return onSide(vehicle, ctl) || ctl.system?.rigging?.vehicleUuid === vehicle.uuid ? ctl : null;
}

/** The Control Pool dice a Crash Test card may carry to the passengers (S8): the counted controller's skill, at most 30. */
export function cpBound(vehicle: any): number {
  const ctl = ctlOf(vehicle);
  return ctl ? int(ctl.vehicleSkillRating?.(vehicle), 0, 30, 0) : 0;
}

/** A GM-side step under the GM lock (inline inside a card's re-run, which holds it: brief rule 5). */
async function locked<T>(fn: () => Promise<T>): Promise<T> {
  const cls = actorClass();
  return cls?.actingAuthor || cls?.inAuthorRun ? fn() : withGmLock(fn);
}

/** The GM buttons running now, by message id (a double click acts once: P5). */
const busy = new Set<string>();
async function once(message: any, fn: () => Promise<void>): Promise<void> {
  const id = String(message?.id ?? '');
  if (!id || busy.has(id)) return;
  busy.add(id);
  try { await fn(); } finally { busy.delete(id); }
}

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
/**
 * Whether a vehicle has a combatant in the started combat (on the combat's scene when both say): a chase record set on
 * a player's own vehicle makes it a pursuer only then (S9).
 */
function inCombat(a: any): boolean {
  const combat: any = G()?.combat;
  if (!combat?.started || !a) return false;
  const scene = String(combat.scene?.id ?? combat.sceneId ?? '');
  return [...(combat.combatants ?? [])].some((cb: any) => {
    const act = cb?.actor ?? null;
    const same = (act && act.uuid === a.uuid) || (cb?.actorId && cb.actorId === a.id && !a.isToken);
    return Boolean(same) && (!scene || !cb?.sceneId || String(cb.sceneId) === scene);
  });
}
/**
 * The vehicles chasing this one (with a combatant in the combat), less those the GM unticked in the scores dialog (fix2
 * R7: the record's `off`; `all` keeps them, for the dialog's list).
 */
const pursuersOf = (v: any, all = false): any[] => {
  const off = all ? [] : chaseNow()?.st.off ?? [];
  return vehicles().filter((a: any) => a.uuid !== v?.uuid && a.system?.chase?.quarryUuid === v?.uuid && inCombat(a) && !off.includes(String(a.uuid)));
};
/** Everyone this vehicle is in a chase with (its pursuers and its quarry). */
export function opponentsOf(v: any, all = false): any[] {
  const out = pursuersOf(v, all);
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
  const v = vehicles().find((a: any) => (a.system?.occupants ?? []).includes(actor.uuid) && onSide(a, actor));
  return v && v.system?.controllerUuid !== actor.uuid ? v : null;
}
/** The vehicle a character is in (riding or driving), or null. */
function inVehicle(actor: any): any | null {
  if (!actor) return null;
  if (actor.type === VEHICLE) return actor;
  return vehicles().find((a: any) => ((a.system?.occupants ?? []).includes(actor.uuid) || a.system?.controllerUuid === actor.uuid) && onSide(a, actor)) ?? null;
}

/**
 * Whether an offensive action is refused (warned): a passenger acting in a Combat Phase above the vehicle's Driver
 * Points (Rigger 2 p. 49), or a target whose vehicle has broken contact with the attacker's (Rigger 2 p. 48). Both from
 * the combat's record. Who rides where counts only on the vehicle's side (`onSide`). A GM acting for themselves is
 * warned, never refused (the GM's override); inside a card's re-run the author is judged.
 */
export function offenceRefused(actor: any, targetUuid?: string | null): boolean {
  const c = chaseNow();
  if (!c || !X.on('chase')) return false;
  const gmOverride = isGm() && !actorClass()?.actingAuthor;
  const refuse = (text: string): boolean => {
    if (gmOverride) { warn(tx('SR2E.VDrive98.Why.gmWarned', { text })); return false; }
    warn(text);
    return true;
  };
  const ride = rideOf(actor);
  if (ride && X.on('passengerPhase')) {
    const sc = X.scoreOf(c.st, String(ride.uuid), c.id, c.round);
    const phase = Number(actor?.myCombatant?.()?.initiative);
    if (sc && Number.isFinite(phase) && !X.passengerMayAct(phase, sc.driver)) {
      if (refuse(tx('SR2E.VDrive98.Why.passengerPhase', { name: String(actor.name ?? ''), phase, points: sc.driver, vehicle: String(ride.name ?? '') }))) return true;
    }
  }
  const mine = inVehicle(actor);
  const t = sync(targetUuid);
  const theirs = t ? inVehicle(t) : null;
  if (mine && theirs && mine.uuid !== theirs.uuid && X.hiddenFrom(c.st, String(theirs.uuid), String(mine.uuid))) {
    if (refuse(tx('SR2E.VDrive98.Why.hidden', { target: String(theirs.name ?? ''), vehicle: String(mine.name ?? '') }))) return true;
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
 * each damage (Power, level, extra dice in `vdrive98Dice`, with the vehicle's uuid in `vdrive98Veh`); a seat belt can
 * stage one away. The pool dice are bounded by the counted controller's skill (`cpBound`).
 */
export function safePassengers<T extends { power: number; level: DamageLevel }>(vehicle: any, list: T[], cp = 0): T[] {
  const v = vehicle?.system ?? {};
  const out: T[] = [];
  const pool = Math.min(int(cp, 0, 30, 0), cpBound(vehicle));
  for (const d of list) {
    const r = X.passengerSafety({ power: d.power, level: d.level, belted: Boolean(v.belted98), apps: Boolean(v.apps98), cage: Boolean(v.crashCage98), cp: pool });
    if (!r) continue;
    out.push({ ...d, power: r.power, level: r.level, ...(r.dice ? { vdrive98Dice: r.dice, vdrive98Veh: String(vehicle?.uuid ?? '') } : {}) });
  }
  return out;
}

/** The extra resistance dice a passenger's damage carries (bounded; chat.ts has judged the card first: `trustDice`). */
export const extraDice = (damage: any): number => int(damage?.vdrive98Dice, 0, 40, 0);

/**
 * A card's damage entry with its passengers' extra dice judged (Lead/C): kept from a GM's card; from a player's only
 * when the entry names the vehicle (`vdrive98Veh`), the card's author owns it, and then at most its crash cage's dice and
 * its counted controller's skill. Anything else loses them. Returns the entry unchanged when it has none.
 */
export function trustDice<T>(message: any, d: T): T {
  const e: any = d;
  if (!e || typeof e !== 'object' || e.vdrive98Dice === undefined) return d;
  if (authorIsGm(message)) return d;
  const v: any = sync(e.vdrive98Veh);
  const { vdrive98Dice: _drop, ...rest } = e;
  if (v?.type !== VEHICLE || !authorOwns(message, v)) return rest as T;
  const most = (X.on('passengerSafety') && v.system?.crashCage98 ? CHASE98.crashCageDice : 0) + (X.on('cpCarry') ? cpBound(v) : 0);
  const n = Math.min(extraDice(e), most);
  return (n > 0 ? { ...rest, vdrive98Dice: n } : rest) as T;
}

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

/**
 * The world setting (a list of card ids, newest last, at most LIGHT_KEEP) holding the Light hits applied (fix2 R8: one
 * GM-written record; a world setting only a GM's client can write). Registered in settings.ts.
 */
export const LIGHT_SETTING = 'vdrive98Lights';
export const LIGHT_KEEP = 200;
const lightIds = (): string[] => {
  let raw: unknown = [];
  try { raw = G()?.settings?.get?.(SYSTEM_ID, LIGHT_SETTING); } catch { raw = []; }
  return (Array.isArray(raw) ? raw : []).filter((x: unknown): x is string => typeof x === 'string' && x.length > 0 && x.length <= 100).slice(-LIGHT_KEEP);
};
/** Ids applied on this client since it loaded (until the setting's write lands). */
const lightsHere = new Set<string>();
/** Whether this card's Light hit was applied (the GM-written record only; the card's own flags are the author's). */
export function lightDone(message: any, _v?: any): boolean {
  const id = String(message?.id ?? '');
  return Boolean(id) && (lightsHere.has(id) || lightIds().includes(id));
}
async function markLight(message: any): Promise<void> {
  const id = String(message?.id ?? '');
  if (!id) return;
  lightsHere.add(id);
  if (!isGm()) return;
  try { await G()?.settings?.set?.(SYSTEM_ID, LIGHT_SETTING, [...lightIds().filter((x) => x !== id), id].slice(-LIGHT_KEEP)); } catch { /* kept in memory */ }
}

/** The card buttons (chat.ts dispatches `vdrive98…`). */
export async function onCard(message: any, button: HTMLButtonElement, action: string): Promise<void> {
  if (action === 'vdrive98Pos') return once(message, () => recordPositioning(message, button));
  if (action !== 'vdrive98Light') return;
  await once(message, () => applyLight(message, button));
}

async function applyLight(message: any, button: HTMLButtonElement): Promise<void> {
  const c: any = message?.flags?.[SYSTEM_ID]?.vdrive98Light;
  const v: any = uuidOk(c?.vehicleUuid) ? await (globalThis as any).fromUuid(c.vehicleUuid) : null;
  if (v?.type !== VEHICLE) return;
  if (!isGm() && !v.isOwner) { warn(tx('SR2E.VDrive98.ownerOnly', { name: String(v.name ?? '') })); return; }
  // A GM reads only the GM-written record; the vehicle's owner (hurting only their own vehicle) the card too.
  if (lightDone(message, v) || (!isGm() && message?.getFlag?.(SYSTEM_ID, 'vdrive98Done'))) { warn(tx('SR2E.VDrive98.alreadyDone')); return; }
  if (!authorOwns(message, v) && !(await gmMay(message, { title: tx('SR2E.VDrive98.Passenger.title'), lines: [tx('SR2E.VDrive98.Passenger.line', { vehicle: String(v.name ?? '') })], target: String(v.uuid), sources: [c?.passengerUuid] }))) return;
  button.disabled = true;
  const write = async (): Promise<void> => {
    if (lightDone(message, v)) { warn(tx('SR2E.VDrive98.alreadyDone')); return; }
    await markLight(message);
    await lightTo(v);
  };
  await (isGm() ? locked(write) : write());
  try { await message.setFlag(SYSTEM_ID, 'vdrive98Done', true); } catch { /* the author's card */ }
}

// ---------------------------------------------------------------- Called shots (Rigger 2 p. 53)

/** Whether a called shot knocks the part out at this level (a turret mount needs Serious). */
export function partHits(vehicle: any, part: string, level: DamageLevel | null, weaponId?: string | null): boolean {
  return X.partKnockedOut(part, level, String(mountHit(vehicle, weaponId)?.system?.mount ?? '') === 'turret');
}

/**
 * The weapon a called shot at the mount hits (C12): the one the shot named, else the vehicle's first mounted weapon
 * that isn't jammed (the one #resolveVehicleSoak knocks out), so a turret needs Serious either way.
 */
function mountHit(vehicle: any, weaponId?: string | null): any | null {
  const named: any = weaponId ? vehicle?.items?.get?.(weaponId) : null;
  if (named) return named;
  return [...(vehicle?.items ?? [])].find((i: any) => i?.type === 'weapon' && (i.system?.mount ?? 'none') !== 'none' && !i.system?.jammed) ?? null;
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
 * After a Driving Test (the 'drive' card): on a failed test the Stress Test (2D6 below the Stress: a system fails, a
 * Crash Test), against the Stress before this test's Rule of One adds (C7: Rigger 2 p. 26's example rolls it first);
 * then the Stress Rule of One (+1D6 Stress; twice the Body: a system fails). Once per card (`stress98` on the
 * snapshot). Writes the vehicle when this client may; otherwise the card asks the GM.
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
  if (!(Number(snap.successes) > 0) && !d.crashTest && stress > 0) {
    const two = await roller(rolls)(2);
    const total = two.reduce((a, b) => a + b, 0);
    if (X.stressTestFails(total, stress)) { fails = true; lines.push(tx('SR2E.VDrive98.Stress.testFails', { total, stress })); }
    else lines.push(tx('SR2E.VDrive98.Stress.testHolds', { total, stress }));
  }
  if (X.ruleOfOne(ones, skill)) {
    const add = (await roller(rolls)(1))[0] ?? 1;
    stress += add;
    lines.push(tx('SR2E.VDrive98.Stress.ruleOfOne', { ones, add, stress }));
    if (!fails && X.stressBreaks(stress, Number(v.system?.body ?? 0))) { fails = true; lines.push(tx('SR2E.VDrive98.Stress.breaks', { stress })); }
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

/** A test's successes for the record, bounded by its dice. */
const succ = (r: SuccessTestResult | null | undefined): number => Math.min(int(r?.successes, 0, 60, 0), int(r?.totalDice, 0, 60, 0));
/** A test's dice faces for the card (one list per die), at most LIST_CAP dice. */
const facesOf = (r: SuccessTestResult | null | undefined): number[][] => (Array.isArray(r?.dice) ? r!.dice : []).slice(0, X.LIST_CAP).map((d) => (Array.isArray(d?.faces) ? d.faces.slice(0, 20).map((f) => int(f, 0, 6, 0)) : []));

/** The record's keys a chase turn's positioning marks: the sorted pair and each vehicle, this Combat Turn (fix2 R5). */
const posKeys = (round: number, a: any, b: any): { pair: string; va: string; vb: string } => ({ pair: X.posKey(round, String(a.uuid), String(b.uuid)), va: X.posVehKey(round, String(a.uuid)), vb: X.posVehKey(round, String(b.uuid)) });

/**
 * The record with a chase turn's positioning (Rigger 2 p. 46), once per pair and per vehicle in the Combat Turn: a
 * vehicle whose positioning this turn is already recorded keeps it. Null when the pair's turn is already recorded or
 * neither vehicle is left to record.
 */
function withTurn(st: X.Chase98, round: number, a: any, as: number, b: any, bs: number): X.Chase98 | null {
  const k = posKeys(round, a, b);
  if (st.pos.includes(k.pair)) return null;
  const doA = !st.pos.includes(k.va), doB = !st.pos.includes(k.vb);
  if (!doA && !doB) return null;
  let next = X.withPosKey(st, k.pair);
  if (doA) next = X.withPosKey(X.withPositioning(next, String(a.uuid), as), k.va);
  if (doB) next = X.withPosKey(X.withPositioning(next, String(b.uuid), bs), k.vb);
  return next;
}

/**
 * After a chase turn's positioning tests: their successes go to next turn's Driver Points. A GM's client records them at
 * once (once per pair and per vehicle in the Combat Turn); a player's card carries them for a GM's button
 * (`vdrive98Pos`, C4 / P2), so the GM never runs the turn again (which would move the gap twice). Returns the card's
 * line; `positionFlags` its flags.
 */
export async function afterPositioning(pursuer: any, quarry: any, pr: SuccessTestResult | null, qr: SuccessTestResult | null): Promise<string> {
  if (!X.on('chase')) return '';
  const c = chaseNow();
  if (!c) return `<p>${tx('SR2E.VDrive98.Chase.noCombat')}</p>`;
  const ps = succ(pr), qs = succ(qr);
  if (!isGm()) return `<p>${tx('SR2E.VDrive98.Chase.gmButton')} <button type="button" data-sr2e-action="vdrive98Pos">${tx('SR2E.VDrive98.Chase.record')}</button></p>`;
  const done = await locked(async () => {
    const now = chaseNow() ?? c;
    const next = withTurn(now.st, now.round, pursuer, ps, quarry, qs);
    if (!next) return true;
    await writeChase(now.combat, next);
    return false;
  });
  if (done) return `<p>${tx('SR2E.VDrive98.Chase.already')}</p>`;
  return `<p>${tx('SR2E.VDrive98.Chase.positioned', { a: name(pursuer), as: ps, b: name(quarry), bs: qs })}</p>`;
}

/**
 * The chase-turn card's flags for the GM's button (a player's client under the book chase), else null: each side's
 * successes, dice, TN and dice faces (fix2 R5: the GM recounts the author's side from them).
 */
export function positionFlags(pursuer: any, quarry: any, pr: SuccessTestResult | null, qr: SuccessTestResult | null): Record<string, unknown> | null {
  const c = X.on('chase') && !isGm() ? chaseNow() : null;
  if (!c) return null;
  return { vdrive98Pos: {
    pursuerUuid: String(pursuer.uuid), quarryUuid: String(quarry.uuid), combatId: c.id, round: c.round,
    ps: succ(pr), pd: int(pr?.totalDice, 0, 60, 0), pt: int(pr?.targetNumber, 0, 100, 0), pf: facesOf(pr),
    qs: succ(qr), qd: int(qr?.totalDice, 0, 60, 0), qt: int(qr?.targetNumber, 0, 100, 0), qf: facesOf(qr),
  } };
}

/**
 * The most dice and the least TN a vehicle's positioning test can have, worked out on the GM's client (fix2 R5): the
 * driver as the chase turn finds it (a controller only when it counts: `ctlOf`; else the autopilot), with or without a
 * specialization, + the Control Pool jumped in (at most the skill dice), and the faster vehicle's modifier.
 */
export function positionBound(v: any, other: any): { dice: number; tn: number } {
  const m = chaseSpeedModifier(Number(v?.system?.currentSpeed ?? 0), Number(other?.system?.currentSpeed ?? 0));
  const faster: TargetNumberModifier[] = m ? [{ id: 'faster', label: tx('SR2E.Card.Mod.faster'), value: m }] : [];
  const ctl: any = ctlOf(v);
  const who: any = ctl ?? (v?.system?.controllerUuid ? null : v);
  const looks: any[] = [];
  for (const spec of [false, true]) {
    try { const pv = who?.previewDrive?.({ vehicle: v, kind: 'maneuver', useSpecialization: spec }); if (pv) looks.push(pv); } catch { /* none */ }
  }
  if (!looks.length) return { dice: int(v?.system?.derived?.autopilotRating, 0, 60, 0), tn: RULES.MIN_TARGET_NUMBER };
  const dice = Math.max(...looks.map((pv) => int(pv.dice, 0, 60, 0)));
  const jumped = Boolean(ctl) && v.system?.controlMode === 'jumped' && Boolean(ctl.system?.rigging?.jumpedIn);
  const pool = jumped ? Math.min(dice, int(ctl.system?.derived?.controlPool, 0, 60, 0)) : 0;
  const tn = Math.min(...looks.map((pv) => finalTargetNumber(Number(pv.base ?? 0), [...(pv.modifiers ?? []), ...faster]).targetNumber));
  return { dice: Math.min(60, dice + pool), tn };
}

/**
 * The GM's button on a player's chase-turn card (C4 / P2; fix2 R5): records the card's positioning successes for next
 * turn's Driver Points, once per pair and per vehicle in the Combat Turn (on the combat's record). The card must be
 * this turn's, and its author must own one of the vehicles; that side's successes are recounted from the card's own
 * dice faces (exactly its dice, at most the dice the GM's client works out, against at least the TN it works out:
 * `positionBound`), else refused. A vehicle the author doesn't own makes its positioning test now, on the GM's client.
 * The gap was moved by the player's turn: it isn't moved again.
 */
async function recordPositioning(message: any, button: HTMLButtonElement): Promise<void> {
  if (!isGm()) { warn(tx('SR2E.VDrive98.gmOnly')); return; }
  if (!X.on('chase')) return;
  const f: any = message?.flags?.[SYSTEM_ID]?.vdrive98Pos;
  const p: any = sync(f?.pursuerUuid), q: any = sync(f?.quarryUuid);
  if (p?.type !== VEHICLE || q?.type !== VEHICLE || p.uuid === q.uuid) { warn(tx('SR2E.VDrive98.Chase.gone')); return; }
  const c = chaseNow();
  if (!c) { warn(tx('SR2E.VDrive98.Chase.noCombat')); return; }
  if (String(f.combatId ?? '') !== c.id || int(f.round, -1, 100000, -1) !== c.round) { warn(tx('SR2E.VDrive98.Chase.stale')); return; }
  if (!authorOwns(message, p) && !authorOwns(message, q)) { warn(tx('SR2E.VDrive98.Chase.notChaseCard')); return; }
  // Lead fix (re-review L1): the two must be a chase pair (one is the other's quarry), and neither unticked by the GM.
  const paired = p.system?.chase?.quarryUuid === q.uuid || q.system?.chase?.quarryUuid === p.uuid;
  const offList: string[] = c.st.off ?? [];
  if (!paired || offList.includes(String(p.uuid)) || offList.includes(String(q.uuid))) { warn(tx('SR2E.VDrive98.Chase.notPair')); return; }
  const k = posKeys(c.round, p, q);
  if (c.st.pos.includes(k.pair)) { warn(tx('SR2E.VDrive98.alreadyDone')); return; }
  const sides = [
    { v: p, other: q, key: k.va, d: int(f.pd, 0, 60, 0), tn: int(f.pt, 0, 100, 0), faces: f.pf, s: 0, skip: c.st.pos.includes(k.va) },
    { v: q, other: p, key: k.vb, d: int(f.qd, 0, 60, 0), tn: int(f.qt, 0, 100, 0), faces: f.qf, s: 0, skip: c.st.pos.includes(k.vb) },
  ];
  if (sides.every((x) => x.skip)) { warn(tx('SR2E.VDrive98.alreadyDone')); return; }
  const lines: string[] = [];
  for (const x of sides) {
    const nm = String(x.v.name ?? '');
    if (x.skip) { lines.push(tx('SR2E.VDrive98.Chase.vehDone', { name: nm })); continue; }
    if (!authorOwns(message, x.v)) { lines.push(tx('SR2E.VDrive98.Chase.rollLine', { name: nm })); continue; }
    const b = positionBound(x.v, x.other);
    const tn = Math.max(x.tn, b.tn);
    const got = x.d <= b.dice ? X.replayFaces(x.faces, x.d, tn) : null;
    if (got === null) { warn(tx('SR2E.VDrive98.Chase.mismatch', { name: nm, dice: x.d, most: b.dice })); return; }
    x.s = got;
    lines.push(tx('SR2E.VDrive98.Chase.replayLine', { name: nm, successes: got, dice: x.d, most: b.dice, tn: x.tn, gmTn: b.tn }));
  }
  if (!(await gmMay(message, { title: tx('SR2E.VDrive98.Chase.recordTitle'), lines, sources: [p.uuid, q.uuid] }))) return;
  button.disabled = true;
  // The side the author doesn't own rolls its positioning test here (before the lock: the test posts its own card).
  for (const x of sides) {
    if (x.skip || authorOwns(message, x.v)) continue;
    const m = chaseSpeedModifier(Number(x.v.system?.currentSpeed ?? 0), Number(x.other.system?.currentSpeed ?? 0));
    const r: SuccessTestResult | null = await x.v.driveTest({ kind: 'maneuver', label: tx('SR2E.Card.Actor.positioningChase'), ...(m ? { modifiers: [{ id: 'faster', label: tx('SR2E.Card.Mod.faster'), value: m }] } : {}) });
    x.s = succ(r);
  }
  const wrote = await locked(async () => {
    const now = chaseNow();
    if (!now || now.id !== c.id || now.round !== c.round) return false;
    const next = withTurn(now.st, now.round, p, sides[0]!.s, q, sides[1]!.s);
    if (!next) return false;
    await writeChase(now.combat, next);
    return true;
  });
  if (!wrote) { warn(tx('SR2E.VDrive98.alreadyDone')); return; }
  await post(`<p>${tx('SR2E.VDrive98.Chase.positioned', { a: name(p), as: sides[0]!.s, b: name(q), bs: sides[1]!.s })}</p>`, { speaker: speaker(p) });
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
  const base = sel.length ? sel : vehicles().filter((v: any) => v.system?.chase?.quarryUuid || pursuersOf(v, true).length);
  const out: any[] = [];
  for (const v of base) for (const a of [v, ...opponentsOf(v, true)]) if (a && !out.some((o) => o.uuid === a.uuid)) out.push(a);
  return out.filter((v) => !v.system?.derived?.destroyed).slice(0, X.LIST_CAP);
}

/**
 * Who drives (the controller when it counts: `ctlOf`, else the vehicle's autopilot) and the Open Test's dice before
 * pool (S4).
 */
function driverOf(v: any): { who: any; dice: number; jumped: boolean } {
  const ctl: any = ctlOf(v);
  if (ctl) return { who: ctl, dice: Number(ctl.vehicleSkillRating?.(v) ?? 0), jumped: v.system?.controlMode === 'jumped' && Boolean(ctl.system?.rigging?.jumpedIn) };
  return { who: v, dice: Number(v.system?.derived?.autopilotRating ?? 0), jumped: false };
}

/**
 * The vehicle type a vehicle's Vehicle Points use (S4): the GM's (this roll's, else the record's), else the vehicle's
 * own field when no player owns it; a player's vehicle by its category ('') until the GM picks one in the tool.
 */
function typeFor(v: any, st: X.Chase98, types: Record<string, string>): string {
  const pick = types[String(v.uuid)];
  if (typeof pick === 'string' && (pick === '' || X.VEHICLE_TYPES.includes(pick))) return pick;
  const kept = X.typeOn(st, String(v.uuid));
  if (kept) return kept;
  const own = String(v.system?.vehicleType98 ?? '');
  return X.VEHICLE_TYPES.includes(own) && !playerOwners(v).length ? own : '';
}

/**
 * The speed the score counts (S4): the vehicle's current speed, capped again here at 1.5 × its Speed (`speedCap`); the
 * Speed read at most the books' largest (fix2 R6: `CHASE98.speedMax`, Rigger 2 p. 154) and the speed at most 1.5 × that.
 */
function scoreSpeed(v: any): number {
  const sys = v.system ?? {};
  const most = Math.floor(CHASE98.speedMax * CHASE98.maxSpeedFactor);
  const now = int(sys.currentSpeed, 0, most, 0);
  const cap = X.maxSpeed(Math.min(CHASE98.speedMax, Number(sys.derived?.working?.speed ?? sys.speed ?? 0)));
  return cap === null ? now : Math.min(now, cap);
}

/**
 * Step 2–4 of the turn (Rigger 2 p. 42): every chase vehicle's score, rolled here and recorded on the combat. `types`:
 * the GM's vehicle type per vehicle ('' = by category), kept on the record. Rolled again in the same Combat Turn, the
 * positioning successes the first roll spent count again (P11).
 */
export async function rollScores(pool: Record<string, number> = {}, types: Record<string, string> = {}, counts: Record<string, boolean> = {}): Promise<boolean> {
  if (!isGm() || !X.on('chase')) return false;
  const c = chaseNow();
  if (!c) { warn(tx('SR2E.VDrive98.Chase.noCombat')); return false; }
  const list = chaseVehicles();
  if (!list.length) { warn(tx('SR2E.VDrive98.Chase.noVehicles')); return false; }
  const rolls: any[] = [];
  const scores: X.Score98[] = [];
  const rows: string[] = [];
  const kept: X.Type98[] = c.st.types.filter((t) => !list.some((v) => String(v.uuid) === t.v));
  const carry = X.turnCarry(c.st, c.id, c.round);
  // fix2 R7: the pursuers the GM unticked are out of the chase (no score; not counted as an opponent).
  const off = new Set(c.st.off);
  for (const v of list) { const u = String(v.uuid); if (counts[u] === false) off.add(u); else if (counts[u] === true) off.delete(u); }
  for (const v of list) {
    if (off.has(String(v.uuid))) continue;
    const sys = v.system ?? {};
    const type = typeFor(v, c.st, types);
    if (type) kept.push({ v: String(v.uuid), type });
    const speed = scoreSpeed(v);
    const partial = X.partialScore({ type, category: String(sys.category ?? ''), terrain: sceneTerrain(v), speed });
    const dr = driverOf(v);
    // The Control Pool dice the GM puts on the Open Test for a jumped-in rigger (at most the skill, Rigger 2 p. 20).
    const left = dr.jumped ? Number(dr.who.system?.derived?.controlPoolLeft ?? 0) : 0;
    const cp = Math.max(0, Math.min(int(pool[v.uuid], 0, 60, 0), left, dr.dice));
    if (cp > 0) { try { await dr.who.update({ 'system.poolSpent.control': Number(dr.who.system?.poolSpent?.control ?? 0) + cp }); } catch { /* not spent */ } }
    const open = await X.openTest(dr.dice + cp, roller(rolls));
    const driver = X.driverPoints(open.result, c.st, String(v.uuid), carry);
    scores.push({ v: String(v.uuid), score: partial + driver, driver, partial });
    const typeLabel = escHtml(tKey(`SR2E.VDrive98.Type.${X.vehicleTypeOf(type, String(sys.category ?? ''))}`));
    rows.push(`<li>${tx('SR2E.VDrive98.Chase.scoreRow98', { name: name(v), type: typeLabel, speed, driverName: name(dr.who), partial, open: open.result, driver, score: partial + driver, cp })}</li>`);
  }
  await locked(async () => {
    const now = chaseNow() ?? c;
    await writeChase(now.combat, X.withScores(now.st, { combatId: c.id, round: c.round, scores, types: kept, off: [...off] }));
  });
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
  const ctl: any = ctlOf(finder);
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

const SELECTED = ' selected';
const CHECKED = ' checked';
/** A vehicle-type picker for the GM's dialog (`picked` preselected; '' = by category). */
function typeSelect(i: number, picked: string): string {
  const keys = ['', ...X.VEHICLE_TYPES];
  const label = (k: string): string => escHtml(k ? tKey(`SR2E.VDrive98.Type.${k}`) : tx('SR2E.VDrive98.Type.byCategory'));
  const option = (k: string): string => `<option value="${escHtml(k)}"${k === picked ? SELECTED : ''}>${label(k)}</option>`;
  const options = keys.map(option).join('');
  return `<select name="type${i}">${options}</select>`;
}

/** A pursuer's tick box for the GM's dialog (fix2 R7): ticked unless the record has it out; a player's vehicle noted. */
function countBox(i: number, v: any, st: X.Chase98): string {
  if (!v.system?.chase?.quarryUuid) return '';
  const ticked = st.off.includes(String(v.uuid)) ? '' : CHECKED;
  const whose = playerOwners(v).length ? ` ${tx('SR2E.VDrive98.Tool.players')}` : '';
  return ` <input type="checkbox" name="in${i}"${ticked}> ${tx('SR2E.VDrive98.Tool.counts')}${whose}`;
}

/**
 * The GM's questions before the scores (Rigger 2 p. 42, step 3; S4): each chase vehicle's type for its Vehicle Points
 * (the record's, else the vehicle's own field; fix2 R6: a player's vehicle by its category is noted unconfirmed), the
 * Control Pool dice each jumped-in rigger puts on the Open Test, and (fix2 R7) whether each pursuer is in the chase.
 * Null when the GM cancels.
 */
async function askScores(): Promise<{ pool: Record<string, number>; types: Record<string, string>; counts: Record<string, boolean> } | null> {
  const list = chaseVehicles();
  if (!list.length) return { pool: {}, types: {}, counts: {} };
  const c = chaseNow();
  const st = c ? c.st : X.NO_CHASE;
  const rows = list.map((v, i) => {
    const dr = driverOf(v);
    const type = typeFor(v, st, {});
    const unsure = !type && playerOwners(v).length ? ` ${tx('SR2E.VDrive98.Tool.typeUnconfirmed')}` : '';
    const cp = dr.jumped ? ` ${tx('SR2E.VDrive98.Tool.cp')} <input type="number" name="cp${i}" min="0" value="0">` : '';
    return `<label>${name(v)} (${name(dr.who)}, ${tx('SR2E.VDrive98.Tool.speed', { speed: scoreSpeed(v) })}) ${typeSelect(i, type)}${unsure}${cp}${countBox(i, v, st)}</label>`;
  }).join('<br>');
  const field = (b: any, key: string): any => b?.form?.elements?.[key] ?? null;
  const got = await dialogs()?.prompt?.({ window: { title: tx('SR2E.VDrive98.Tool.scores') }, content: `<p class="hint">${tx('SR2E.VDrive98.Tool.typeHint')}</p><p class="hint">${tx('SR2E.VDrive98.Tool.poolHint')}</p><p class="hint">${tx('SR2E.VDrive98.Tool.countsHint')}</p>${rows}`,
    ok: { callback: (_e: any, b: any) => list.map((_v, i) => { const box = field(b, `in${i}`); return [field(b, `cp${i}`)?.value, field(b, `type${i}`)?.value, box ? Boolean(box.checked) : null]; }) }, rejectClose: false });
  if (!Array.isArray(got)) return null;
  const pool: Record<string, number> = {}, types: Record<string, string> = {}, counts: Record<string, boolean> = {};
  list.forEach((v, i) => {
    const [cp, type, ticked] = Array.isArray(got[i]) ? got[i] : [];
    pool[String(v.uuid)] = int(cp, 0, 60, 0);
    if (typeof type === 'string' && (type === '' || X.VEHICLE_TYPES.includes(type))) types[String(v.uuid)] = type;
    if (typeof ticked === 'boolean') counts[String(v.uuid)] = ticked;
  });
  return { pool, types, counts };
}

let scoring = false;
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
  if (pick === 'scores') {
    // P5: one roll of the scores at a time (a second press waits for none and does nothing).
    if (scoring) return;
    scoring = true;
    try { const a = await askScores(); if (a) await rollScores(a.pool, a.types, a.counts); } finally { scoring = false; }
    return;
  }
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
export function sheetContext(actor: any): { show: boolean; types: Array<{ key: string; label: string }>; stress: boolean; safety: boolean; autonav: boolean; offroad: boolean; chase: boolean; score: number | null; hasScore: boolean } {
  const types = [{ key: '', label: tx('SR2E.VDrive98.Type.byCategory') }, ...X.VEHICLE_TYPES.map((k) => ({ key: k, label: tKey(`SR2E.VDrive98.Type.${k}`) }))];
  const show = X.on('offRoad') || X.on('autonavCombat') || X.on('stress') || X.on('passengerSafety') || X.on('chase');
  const sc = actor?.type === VEHICLE ? scoreNow(actor) : null;
  return { show, types, stress: X.on('stress'), safety: X.on('passengerSafety'), autonav: X.on('autonavCombat'), offroad: X.on('offRoad'), chase: X.on('chase'), score: sc ? sc.score : null, hasScore: Boolean(sc) };
}

/** The Crash Test card's flag for the carried-over Control Pool dice (only under `cpCarry` 'book'). */
export function crashCarry(snap: any): { cp98?: number } {
  const n = X.on('cpCarry') ? crashPoolDice(snap) : 0;
  return n > 0 ? { cp98: n } : {};
}
