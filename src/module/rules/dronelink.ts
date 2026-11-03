/**
 * v0.73.0: rare vehicle and drone items (O28 of the v0.69.0 review; pure rules, no Foundry). Values and
 * switches in RULES.DRONES_V73 (rules/config73/drones.ts), all VERIFY:
 * intercepting and spoofing a drone's remote-control link [5-A9], firmpoints and hardpoints for
 * mounted weapons [5-A10], and guided missiles locking on to the target's Signature [5-A11].
 */
import { RULES } from './config.ts';
import { escRegExp } from './html.ts';
import type { TargetNumberModifier } from './dice.ts';
import { interceptTest } from './paperwork.ts';
import { DRONES_V73, type LinkGear, type SpoofEffect, type MountPoint } from './config73/drones.ts';
import { t as tx, tCount, tList } from '../helpers/i18n.ts';

export type { LinkGear, SpoofEffect, MountPoint };

type Cfg = typeof DRONES_V73;
/** The live block: RULES.DRONES_V73 once wired into RULES (the same object), else the module's own. */
const V = (): Cfg => ((RULES as any).DRONES_V73 ?? DRONES_V73) as Cfg;

/** A finite number or 0. */
const num = (n: unknown): number => (Number.isFinite(Number(n)) ? Number(n) : 0);
/** A whole number at least 0. */
const whole = (n: unknown): number => Math.max(0, Math.floor(num(n)));
const sum = (mods: readonly TargetNumberModifier[]): number => mods.reduce((n, m) => n + m.value, 0);
const finalTn = (base: number, mods: readonly TargetNumberModifier[]): number => Math.max(RULES.MIN_TARGET_NUMBER, base + sum(mods));

// ---------------------------------------------------------------- 5-A9: drone link interception and spoofing

/** What is stored on a vehicle's `system.link` (v0.73.0). */
export interface DroneLinkState {
  encryption: number;
  intercepted: { byUuid: string; by: string };
  spoofed: { active: boolean; byUuid: string; by: string };
}

/** A vehicle's link state with defaults (an old vehicle without the field reads as an open, clean link). */
export function droneLinkOf(sys: any): DroneLinkState {
  const l = sys?.link ?? {};
  return {
    encryption: whole(l.encryption),
    intercepted: { byUuid: String(l.intercepted?.byUuid ?? ''), by: String(l.intercepted?.by ?? '') },
    spoofed: { active: Boolean(l.spoofed?.active), byUuid: String(l.spoofed?.byUuid ?? ''), by: String(l.spoofed?.by ?? '') },
  };
}

/** Whether a drone has a remote link to attack, and whether a rigger is jumped in over it. */
export function droneLinkKind(o: { controlMode: string; controllerAboard: boolean; hasController: boolean }): { linked: boolean; remoteJumped: boolean; note: string } {
  if (o.hasController && o.controlMode === 'manual') return { linked: false, remoteJumped: false, note: tx('SR2E.Text.Dronelink.drivenByHandThereIs') };
  if (o.hasController && o.controlMode === 'jumped' && o.controllerAboard) return { linked: false, remoteJumped: false, note: tx('SR2E.Text.Dronelink.itsRiggerIsJumpedIn') };
  if (o.hasController && o.controlMode === 'jumped') return { linked: true, remoteJumped: true, note: tx('SR2E.Text.Dronelink.aRiggerIsJumpedIn') };
  return { linked: true, remoteJumped: false, note: tx('SR2E.Text.Dronelink.onItsAutopilot') };
}

/** The link's encryption: the better of the drone's own and its rigger's deck's. */
export function linkEncryption(o: { drone?: number; rcd?: number }): number {
  return Math.max(whole(o?.drone), whole(o?.rcd));
}

/** Whether the would-be interceptor or spoofer has the gear the rule asks for. */
export function linkGearOk(need: LinkGear, have: { rcd?: number; radio?: number }): boolean {
  if (need === 'none') return true;
  if (need === 'rcd') return whole(have?.rcd) > 0;
  return whole(have?.rcd) > 0 || whole(have?.radio) > 0;
}

/** A gear requirement in words, for a refusal. */
export function linkGearLabel(need: LinkGear): string {
  return need === 'rcd' ? tx('SR2E.Text.Dronelink.aRemoteControlDeck') : need === 'rcdOrRadio' ? tx('SR2E.Text.Dronelink.aRemoteControlDeckOr') : tx('SR2E.Text.Dronelink.nothing');
}

export interface LinkTest { allowed: boolean; reason: string; dice: number; baseTn: number; modifiers: TargetNumberModifier[]; tn: number }

/**
 * 5-A9: intercepting (picking up and decrypting) a drone's link: `dice` from the link skill against
 * the link's encryption ('encryption': the radio rule's base TN raised by it) or its signal plus the
 * encryption ('signal'). `baseTn` + `modifiers` = `tn` (pass both to the test so the card explains it).
 */
export function droneInterceptTest(
  o: { dice: number; encryption: number; signal: number; eccm?: number; linked?: boolean },
  cfg: Cfg['link']['intercept'] = V().link.intercept,
): LinkTest {
  const dice = whole(o?.dice);
  const enc = whole(o?.encryption);
  if (o?.linked === false) return { allowed: false, reason: tx('SR2E.Text.Dronelink.thereIsNoRemoteLinkIntercept'), dice, baseTn: 0, modifiers: [], tn: 0 };
  let baseTn: number;
  const modifiers: TargetNumberModifier[] = [];
  if (cfg.tnFrom === 'signal') {
    baseTn = whole(o?.signal);
    if (enc) modifiers.push({ label: tx('SR2E.Card.Mod.encryption', { enc }), value: enc });
  } else {
    const t = interceptTest({ dice, encryption: enc });
    baseTn = num(RULES.STREET_V61.radio.baseInterceptTn);
    modifiers.push(...t.modifiers);
  }
  const eccm = whole(o?.eccm);
  if (cfg.eccmAddsTn && eccm) modifiers.push({ label: tx('SR2E.Card.Mod.eccm', { eccm }), value: eccm });
  return { allowed: true, reason: '', dice, baseTn, modifiers, tn: finalTn(baseTn, modifiers) };
}

/**
 * 5-A9: spoofing a command to a drone. Refused with a reason when there is no remote link, when the
 * link must be intercepted first, or when a rigger jumped in by remote makes it immune. TN from the
 * controlling deck's rating (`rcd`, 0 = nobody subscribed: the drone's Pilot) or the Pilot.
 */
export function droneSpoofTest(
  o: { dice: number; rcd: number; pilot: number; eccm?: number; encryption?: number; intercepted: boolean; linked: boolean; remoteJumped: boolean },
  cfg: Cfg['link']['spoof'] = V().link.spoof,
): LinkTest {
  const dice = whole(o?.dice);
  const no = (reason: string): LinkTest => ({ allowed: false, reason, dice, baseTn: 0, modifiers: [], tn: 0 });
  if (!o?.linked) return no(tx('SR2E.Text.Dronelink.thereIsNoRemoteLinkSpoof'));
  if (cfg.needsIntercept && !o.intercepted) return no(tx('SR2E.Text.Dronelink.interceptTheLinkFirst'));
  if (o.remoteJumped && cfg.jumpedIn === 'immune') return no(tx('SR2E.Text.Dronelink.aRiggerIsJumpedInOverride'));
  const rcd = whole(o.rcd);
  const fromRcd = cfg.tnFrom === 'rcd' && rcd > 0;
  const baseTn = fromRcd ? rcd : whole(o.pilot);
  const modifiers: TargetNumberModifier[] = [];
  if (num(cfg.tnMod)) modifiers.push({ id: 'spoofing', label: tx('SR2E.Card.Mod.spoofing'), value: num(cfg.tnMod) });
  const eccm = whole(o.eccm);
  if (cfg.eccmAddsTn && eccm) modifiers.push({ label: tx('SR2E.Card.Mod.eccm', { eccm }), value: eccm });
  const enc = whole(o.encryption);
  if (!o.intercepted && enc) modifiers.push({ label: tx('SR2E.Card.Mod.encryptionNotIntercepted', { enc }), value: enc });
  if (o.remoteJumped && cfg.jumpedIn === 'harder' && num(cfg.jumpedInTn)) modifiers.push({ id: 'riggerJumpedIn', label: tx('SR2E.Card.Mod.riggerJumpedIn'), value: num(cfg.jumpedInTn) });
  return { allowed: true, reason: fromRcd ? tx('SR2E.Text.Dronelink.remoteControlDeck', { rcd }) : tx('SR2E.Text.Dronelink.pilot', { pilot: whole(o.pilot) }), dice, baseTn, modifiers, tn: finalTn(baseTn, modifiers) };
}

/** What a spoof test's successes do: nothing, one false command, or a takeover (a remote rigger pushed out). */
export function spoofOutcome(successes: number, o: { remoteJumped: boolean }, cfg: Cfg['link']['spoof'] = V().link.spoof): { spoofed: boolean; effect: SpoofEffect; pushOut: boolean; note: string } {
  const effect = cfg.effect;
  if (!(num(successes) > 0)) return { spoofed: false, effect, pushOut: false, note: tx('SR2E.Text.Dronelink.theDroneIgnoresTheSpoofed') };
  if (effect === 'takeover') {
    return { spoofed: true, effect, pushOut: Boolean(o?.remoteJumped), note: o?.remoteJumped ? tx('SR2E.Text.Dronelink.theDroneTakesTheSpoofedPushed') : tx('SR2E.Text.Dronelink.theDroneTakesTheSpoofed') };
  }
  return { spoofed: true, effect, pushOut: false, note: tx('SR2E.Text.Dronelink.theDroneCarriesOutThe') };
}

/** The `system.link` update for a drone: intercepted by someone, spoofed (takeover), or cleared. */
export function droneLinkUpdate(kind: 'intercept' | 'spoof' | 'clear', by: { uuid?: string; name?: string } = {}): Record<string, unknown> {
  const who = { byUuid: String(by.uuid ?? ''), by: String(by.name ?? '') };
  if (kind === 'intercept') return { 'system.link.intercepted': who };
  if (kind === 'spoof') return { 'system.link.spoofed': { active: true, ...who } };
  return { 'system.link.intercepted': { byUuid: '', by: '' }, 'system.link.spoofed': { active: false, byUuid: '', by: '' } };
}

/** Whether the drone's own rigger can command it (or jump in by remote): not jammed, not taken over by a spoofer. */
export function droneCommandBlock(sys: any): { blocked: boolean; reason: string } {
  if (sys?.jammed?.active) return { blocked: true, reason: sys.jammed.by ? tx('SR2E.Text.Dronelink.itsLinkIsJammedBy', { by: sys.jammed.by }) : tx('SR2E.Text.Dronelink.itsLinkIsJammed') };
  const l = droneLinkOf(sys);
  if (l.spoofed.active) return { blocked: true, reason: l.spoofed.by ? tx('SR2E.Text.Dronelink.itsLinkHasBeenSpoofedBy', { by: l.spoofed.by }) : tx('SR2E.Text.Dronelink.itsLinkHasBeenSpoofed') };
  return { blocked: false, reason: '' };
}

// ---------------------------------------------------------------- 5-A10: firmpoints and hardpoints

/** A weapon as the mount check sees it. */
export interface MountWeapon { name: string; mount: string; mountPoint?: string; antiVehicle?: boolean; guidance?: number }

/** The point a weapon takes on a vehicle: 'none' (not mounted, or a mount kind that takes no point), 'firm' or 'hard'. */
export function mountPointFor(w: MountWeapon, cfg: Cfg['mounts'] = V().mounts): 'none' | 'firm' | 'hard' {
  const mount = String(w?.mount ?? 'none');
  if (!mount || mount === 'none' || !cfg.counts.includes(mount)) return 'none';
  if (mount === 'turret' && cfg.turretNeedsHard) return 'hard';
  const own = String(w?.mountPoint ?? '');
  if (own === 'hard' || own === 'firm') return own;
  if (cfg.antiVehicleHard && w?.antiVehicle) return 'hard';
  if (cfg.guidedHard && num(w?.guidance) > 0) return 'hard';
  const name = String(w?.name ?? '').toLowerCase();
  const word = (k: string) => new RegExp(`(^|[^a-z])${escRegExp(k.toLowerCase())}([^a-z]|$)`).test(name);
  return cfg.hardNames.some((k) => k && word(k)) ? 'hard' : 'firm';
}

/** A vehicle's points (`tracked` false when both are 0: the old, unlimited way). */
export function mountCapacity(o: { body: number; firmpoints: number; hardpoints: number }, cfg: Cfg['mounts'] = V().mounts): { tracked: boolean; firm: number; hard: number } {
  let firm = whole(o?.firmpoints);
  let hard = whole(o?.hardpoints);
  if (cfg.capacityFrom === 'body') {
    if (!firm) firm = Math.floor(whole(o?.body) * Math.max(0, num(cfg.firmPerBody)));
    if (!hard) hard = Math.floor(whole(o?.body) * Math.max(0, num(cfg.hardPerBody)));
  }
  return { tracked: firm + hard > 0, firm, hard };
}

export interface MountUsage {
  tracked: boolean; firm: number; hard: number;
  firmNeeded: number; hardNeeded: number;
  /** Firmpoint weapons sitting on spare hardpoints. */
  onSpareHard: number;
  overFirm: number; overHard: number; over: boolean;
  label: string;
}

/** How the mounted weapons fill the points (hardpoint weapons first; firmpoint ones may overflow to spare hardpoints). */
export function mountUsage(cap0: { tracked: boolean; firm: number; hard: number }, weapons: readonly MountWeapon[], cfg: Cfg['mounts'] = V().mounts): MountUsage {
  // Mode 'off' never checks, so nothing is shown either (review fix).
  const cap = { ...cap0, tracked: cap0.tracked && cfg.mode !== 'off' };
  let firmNeeded = 0, hardNeeded = 0;
  for (const w of weapons ?? []) {
    const p = mountPointFor(w, cfg);
    if (p === 'firm') firmNeeded++;
    else if (p === 'hard') hardNeeded++;
  }
  const overHard = Math.max(0, hardNeeded - cap.hard);
  const spareHard = Math.max(0, cap.hard - hardNeeded);
  const firmLeftOver = Math.max(0, firmNeeded - cap.firm);
  const onSpareHard = cfg.hardTakesFirm ? Math.min(spareHard, firmLeftOver) : 0;
  const overFirm = firmLeftOver - onSpareHard;
  const over = cap.tracked && overHard + overFirm > 0;
  const label = cap.tracked
    ? (over
      ? tx('SR2E.Text.Dronelink.firmpointsHardpointsTooMany', { firmUsed: Math.min(firmNeeded, cap.firm), firm: cap.firm, hardUsed: Math.min(cap.hard, hardNeeded + onSpareHard), hard: cap.hard, over: tList([overHard ? tCount(overHard, 'SR2E.Text.Dronelink.hardpointWeapon') : '', overFirm ? tCount(overFirm, 'SR2E.Text.Dronelink.firmpointWeapon') : '']) })
      : tx('SR2E.Text.Dronelink.firmpointsHardpoints', { firmUsed: Math.min(firmNeeded, cap.firm), firm: cap.firm, hardUsed: Math.min(cap.hard, hardNeeded + onSpareHard), hard: cap.hard }))
    : '';
  return { tracked: cap.tracked, firm: cap.firm, hard: cap.hard, firmNeeded, hardNeeded, onSpareHard, overFirm: cap.tracked ? overFirm : 0, overHard: cap.tracked ? overHard : 0, over, label };
}

/**
 * Mounting a weapon on a vehicle (a new weapon, or a change to one: pass the others in `weapons` and the
 * new version as `adding`). `refuse` only in 'block' mode; `note` is '' when it fits or nothing is checked.
 */
export function mountCheck(
  o: { body: number; firmpoints: number; hardpoints: number; weapons: readonly MountWeapon[]; adding: MountWeapon },
  cfg: Cfg['mounts'] = V().mounts,
): { ok: boolean; refuse: boolean; note: string; usage: MountUsage | null } {
  if (cfg.mode === 'off') return { ok: true, refuse: false, note: '', usage: null };
  const point = mountPointFor(o.adding, cfg);
  const cap = mountCapacity(o, cfg);
  if (point === 'none' || !cap.tracked) return { ok: true, refuse: false, note: '', usage: null };
  const usage = mountUsage(cap, [...(o.weapons ?? []), o.adding], cfg);
  if (!usage.over) return { ok: true, refuse: false, note: '', usage };
  const name = o.adding.name || tx('SR2E.Text.Dronelink.thisWeapon');
  const note = point === 'hard' ? tx('SR2E.Text.Dronelink.needsAHardpoint', { name, label: usage.label }) : cfg.hardTakesFirm ? tx('SR2E.Text.Dronelink.needsAFirmpointOrSpare', { name, label: usage.label }) : tx('SR2E.Text.Dronelink.needsAFirmpoint', { name, label: usage.label });
  return { ok: false, refuse: cfg.mode === 'block', note, usage };
}

// ---------------------------------------------------------------- 5-A11: guided missiles and Signature

/**
 * A guided missile (Intelligence `guidance` > 0) locking on: the target's Signature replaces the range
 * TN (`modifiers` hold the difference, as sensor gunnery does), plus the target's ECM above the firer's
 * ECCM. `unguided`: it needed a lock it doesn't have, so it gets no Intelligence dice (and the range TN).
 * `applies` false: nothing changes (switch off, not a missile, or a person with `vsPeople` 'range').
 */
export function missileLockOn(
  o: { guidance: number; melee?: boolean; targetIsVehicle: boolean; signature: number; rangeTn: number; targetEcm?: number; firerEccm?: number; fromVehicle?: boolean; hasLock?: boolean },
  cfg: Cfg['missiles'] = V().missiles,
): { applies: boolean; unguided: boolean; modifiers: TargetNumberModifier[]; note: string } {
  const none = { applies: false, unguided: false, modifiers: [] as TargetNumberModifier[], note: '' };
  if (o?.melee || !(num(o?.guidance) > 0) || !cfg.signature) return none;
  if (cfg.needsLock && o.fromVehicle && !o.hasLock) return { applies: false, unguided: true, modifiers: [], note: tx('SR2E.Text.Dronelink.noSensorLockTheMissile') };
  if (!o.targetIsVehicle && cfg.vsPeople !== 'signature') return none;
  const sig = o.targetIsVehicle ? whole(o.signature) : whole(RULES.VEHICLES.sensors.personSignature);
  const modifiers: TargetNumberModifier[] = [];
  const diff = sig - num(o.rangeTn);
  if (diff) modifiers.push({ label: tx('SR2E.Card.Mod.missileLockSignatureInsteadOfRange', { sig, num: num(o.rangeTn) }), value: diff });
  const ecm = o.targetIsVehicle && cfg.ecm ? Math.max(0, whole(o.targetEcm) - whole(o.firerEccm)) : 0;
  if (ecm) modifiers.push({ label: tx('SR2E.Card.Mod.targetEcm', { whole: whole(o.targetEcm), part: whole(o.firerEccm) ? tx('SR2E.Card.Dronelink.eccm', { whole: whole(o.firerEccm) }) : '' }), value: ecm });
  return { applies: true, unguided: false, modifiers, note: tx('SR2E.Text.Dronelink.missileLocksOnSignature', { sig }) };
}
