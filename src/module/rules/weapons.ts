import { RULES, type DamageLevel } from './config.ts';
import type { TargetNumberModifier } from './dice.ts';
import { stageUp } from './damage.ts';
import { netSuccesses } from './dice.ts';
import { stageForNetSuccesses } from './damage.ts';
import type { RangeLimits } from './combat.ts';
import { ammoTable, findAmmo, ammoDamageFrom } from './fieldsfire.ts';
import type { AmmoRow } from './config72/combat.ts';
import { strengthRangeMultipliers } from './docs79-ranged.ts';
import { visibilityV79, smokeV79, smokeKindOld, reachV79, type V79SmokeKind } from './docs79-melee-vision.ts';
import { t as tx } from '../helpers/i18n.ts';

/** Melee and ranged combat additions (v0.20.0). No Foundry dependency. All VERIFY. */

const C = () => RULES.COMBAT;

/** What the rules need to know about a weapon (a subset of the weapon item's data). */
export interface WeaponStats {
  melee: boolean;
  damagePower: number;
  damageLevel: DamageLevel;
  /** Power is Strength + damagePower (e.g. "(STR+2)M"). */
  strengthPower?: boolean;
  /** Bows: the Strength rating the weapon can use (0 = no cap). */
  strengthCap?: number;
  /** Thrown weapons and bows: range limits are these multiples of Strength. */
  strengthRange?: boolean;
  strengthRangeMultipliers?: RangeLimits;
  range: RangeLimits;
}

/** The Strength a weapon actually uses: the wielder's, capped by a bow's rating. */
export function effectiveStrength(strength: number, cap = 0): number {
  const s = Math.max(0, strength || 0);
  return cap > 0 ? Math.min(s, cap) : s;
}

/** A weapon's Power for this wielder. */
export function weaponPower(w: WeaponStats, strength: number): number {
  return w.strengthPower ? Math.max(0, effectiveStrength(strength, w.strengthCap) + (w.damagePower || 0)) : Math.max(0, w.damagePower || 0);
}

/** A weapon's range limits in metres for this wielder (Strength-based for thrown weapons and bows). */
export function weaponRange(w: WeaponStats, strength: number, name?: string | null): RangeLimits {
  if (!w.strengthRange) return w.range;
  const s = effectiveStrength(strength, w.strengthCap);
  // v0.79.0 (RULES.DOCS_V79.rangedStrengthRange 'book', SRII Weapon / Grenade Range Tables): the book row by name.
  const m = strengthRangeMultipliers(w, name, C().strengthRange);
  const r = (k: keyof RangeLimits) => Math.round(s * m[k] * 10) / 10;
  return { short: r('short'), medium: r('medium'), long: r('long'), extreme: r('extreme') };
}

/** Damage code for display: "(STR+2)M", "9M". */
export function damageLabel(w: Pick<WeaponStats, 'strengthPower' | 'damagePower' | 'damageLevel'>): string {
  if (!w.strengthPower) return `${w.damagePower}${w.damageLevel}`;
  const b = w.damagePower || 0;
  return `(STR${b > 0 ? `+${b}` : b < 0 ? `${b}` : ''})${w.damageLevel}`;
}

/** The built-in unarmed attack, as weapon data. */
export function unarmedWeapon(): WeaponStats & { name: string; skill: string; damageType: 'physical' | 'stun'; reach: number } {
  const u = C().unarmed;
  return {
    name: u.name, skill: u.skill, melee: true, strengthPower: true, damagePower: u.powerBonus, damageLevel: u.level,
    damageType: u.damageType, reach: u.reach, range: { short: 0, medium: 0, long: 0, extreme: 0 },
  };
}

/** Recoil after the heavy-weapon multiplier. */
export function heavyRecoil(recoil: number, heavy: boolean): number {
  return heavy ? recoil * C().heavyRecoilMultiplier : recoil;
}

/** v0.72.0 (O6): an ammunition row: RULES.COMBAT.ammo plus the house-rule rows (RULES.COMBAT_V72.ammo.extra). */
export type AmmoType = AmmoRow;

export function ammoType(id: string | null | undefined): AmmoType {
  return findAmmo(id, ammoTable());
}

/** Damage after the ammunition: Power change and damage-level stages (v0.72.0: or a set level). */
export function ammoDamage(power: number, level: DamageLevel, ammoId: string): { power: number; level: DamageLevel } {
  return ammoDamageFrom(power, level, ammoType(ammoId));
}

/** Armor that counts after an ammunition multiplier (rounded down). */
export function armorAfterAmmo(armor: number, multiplier = 1): number {
  return Math.max(0, Math.floor(armor * multiplier));
}

export type CalledShotEffect = 'none' | 'damage' | 'armor';

/** A called shot's payoff: stage the damage up, or ignore armor. */
export function calledShotDamage(level: DamageLevel, effect: CalledShotEffect): { level: DamageLevel; ignoreArmor: boolean } {
  if (effect === 'damage') return { level: stageUp(level, C().calledShot.damageStages), ignoreArmor: false };
  if (effect === 'armor' && C().calledShot.ignoresArmor) return { level, ignoreArmor: true };
  return { level, ignoreArmor: false };
}

/** Blast Power at a distance (metres) from the blast point; 0 or less = unhurt. */
export function blastPower(power: number, metres: number, perMetre: number = C().blast.powerPerMetre): number {
  return power - blastLoss(metres, perMetre);
}

/**
 * v0.78.0: Power a blast loses over `metres` (whole metres × `perMetre`, rounded down), so a fractional falloff such
 * as the anti-vehicle rocket's −1 per 4 m (0.25) or −1 per 2 m (0.5) loses whole points of Power.
 */
export function blastLoss(metres: number, perMetre: number): number {
  return Math.floor(Math.floor(Math.max(0, Number(metres) || 0)) * Math.max(0, Number(perMetre) || 0) + 1e-9);
}

/**
 * How far a blast reaches: the last whole metre with Power above 0 (ceil(power / perMetre) − 1). No falloff
 * (perMetre 0 or less) = Infinity.
 */
export function blastRadius(power: number, perMetre: number = C().blast.powerPerMetre): number {
  return perMetre > 0 ? Math.max(0, Math.ceil(power / perMetre) - 1) : Infinity;
}

/** Scatter of a missed grenade: distance in metres from the d6 rolls, direction from a 1-6 roll (60° steps). */
export function scatter(distanceDice: readonly number[], directionDie: number): { metres: number; angleDeg: number } {
  return { metres: distanceDice.reduce((a, b) => a + b, 0), angleDeg: ((Math.max(1, Math.min(6, directionDie)) - 1) * 60) % 360 };
}

/** Shotgun spread across (metres) at a distance, and the Power after spreading. */
export function shotgunSpread(metres: number, choke: number, power: number): { width: number; power: number; loss: number } {
  const c = Math.max(C().shotgun.minChoke, choke || 0);
  const width = Math.max(0, metres) / c;
  const loss = Math.floor(width) * C().shotgun.powerPerMetre;
  return { width: Math.round(width * 10) / 10, power: Math.max(0, power - loss), loss };
}

/** Split full-auto rounds across targets as evenly as possible (earlier targets get the extra rounds). */
export function splitRounds(rounds: number, targets: number): number[] {
  const n = Math.max(1, Math.floor(targets));
  const base = Math.floor(rounds / n);
  return Array.from({ length: n }, (_, i) => base + (i < rounds % n ? 1 : 0));
}

/** TN for spreading fire over extra targets. */
export function spreadFireModifiers(extraTargets: number): TargetNumberModifier[] {
  const v = Math.max(0, extraTargets) * C().spreadFire.extraTargetTn;
  return v ? [{ label: tx('SR2E.Card.Mod.spreadOverTargets', { value: extraTargets + 1 }), value: v }] : [];
}

/**
 * Reach on the defender's melee test. With `reach.appliesTo: 'longer'` only a defender with the
 * longer weapon benefits (the attacker's own advantage was applied to the attack); with 'defender'
 * the whole difference moves the defender's TN.
 */
export function reachModifiers(attackerReach: number, defenderReach: number): TargetNumberModifier[] {
  // v0.79.0: longer −1 and shorter +1 per point, each on its own test (RULES.DOCS_V79.meleeReachShorter).
  const v79 = reachV79(defenderReach, attackerReach);
  if (v79) return v79;
  const diff = (attackerReach || 0) - (defenderReach || 0);
  if (!diff) return [];
  const per = C().melee.reachTnPerPoint;
  if (C().reach.appliesTo === 'longer') return diff < 0 ? [{ label: tx('SR2E.Card.Mod.reach', { diff: -diff }), value: diff * per }] : [];
  return [{ label: diff > 0 ? tx('SR2E.Card.Mod.attackerSReach', { diff }) : tx('SR2E.Card.Mod.reach', { diff: -diff }), value: diff * per }];
}

/** Reach on the attacker's melee test, against the target's longest melee weapon. */
export function attackerReachModifiers(attackerReach: number, targetReach: number): TargetNumberModifier[] {
  // v0.79.0: the shorter side +1 per point too (RULES.DOCS_V79.meleeReachShorter).
  const v79 = reachV79(attackerReach, targetReach);
  if (v79) return v79;
  const diff = (attackerReach || 0) - (targetReach || 0);
  if (C().reach.appliesTo !== 'longer' || diff <= 0) return [];
  return [{ label: tx('SR2E.Card.Mod.reach', { diff }), value: -diff * C().melee.reachTnPerPoint }];
}

export type MeleeWinner = 'attacker' | 'defender' | 'none';

/** Opposed melee: who wins, by how much, and the damage they deal (staged from their weapon's level). */
export function resolveMelee(opts: {
  attackerSuccesses: number; defenderSuccesses: number;
  attacker: { power: number; level: DamageLevel };
  defender?: { power: number; level: DamageLevel } | null;
}): { winner: MeleeWinner; net: number; power: number; level: DamageLevel | null } {
  const a = opts.attackerSuccesses, d = opts.defenderSuccesses;
  const m = C().melee;
  let winner: MeleeWinner;
  if (a > d) winner = 'attacker';
  else if (d > a) winner = m.counterattack && opts.defender ? 'defender' : 'none';
  else winner = m.tie === 'attacker' && a > 0 ? 'attacker' : m.tie === 'defender' && d > 0 && m.counterattack && opts.defender ? 'defender' : 'none';
  if (winner === 'none') return { winner, net: 0, power: 0, level: null };
  const net = winner === 'attacker' ? netSuccesses(a, d) : netSuccesses(d, a);
  const w = winner === 'attacker' ? opts.attacker : opts.defender!;
  return { winner, net, power: w.power, level: net > 0 ? stageForNetSuccesses(w.level, net) : w.level };
}

export type LightLevel = 'normal' | 'partial' | 'minimal' | 'darkness';

/** Light level from a scene darkness level (0 = daylight, 1 = darkest). */
export function lightFromDarkness(darkness: number): LightLevel {
  const l = C().light;
  const d = Math.max(0, Math.min(1, darkness || 0));
  return d <= l.normal ? 'normal' : d <= l.partial ? 'partial' : d <= l.minimal ? 'minimal' : 'darkness';
}

/** v0.79.0: `lowLightNatural` / `thermographicNatural` say the eyes are natural (RULES.DOCS_V79.visionCyberNatural). */
export interface Vision { lowLight?: boolean; thermographic?: boolean; ultrasound?: boolean; lowLightNatural?: boolean; thermographicNatural?: boolean }
export type VisionKind = 'normal' | 'lowLight' | 'thermographic' | 'ultrasound';

/** The visibility TN for a light level with the best vision the attacker has (ultrasound: RULES.CYBERWARE.ultrasound). */
export function visibilityModifier(light: LightLevel, vision: Vision = {}): { value: number; using: VisionKind } {
  // v0.79.0: the book's cybernetic / natural columns (RULES.DOCS_V79.visionCyberNatural).
  const v79 = visibilityV79(light, vision);
  if (v79) return v79;
  const t = C().vision;
  const table = (o: VisionKind) => (o === 'ultrasound' ? RULES.CYBERWARE.ultrasound.vision : t[o])[light];
  const options: VisionKind[] = ['normal'];
  if (vision.lowLight) options.push('lowLight');
  if (vision.thermographic) options.push('thermographic');
  if (vision.ultrasound) options.push('ultrasound');
  let best: VisionKind = 'normal';
  for (const o of options) if (table(o) < table(best)) best = o;
  return { value: table(best), using: best };
}

/** Cover from walls: how many sight lines to the target are blocked. */
export function coverFromSightLines(blocked: number, total: number): 'none' | 'partial' | 'blind' {
  if (total <= 0 || blocked <= 0) return 'none';
  return blocked >= total ? 'blind' : 'partial';
}

/** Movement this Combat Turn as the attacker modifier: none, walking or running. */
export function movementState(metres: number, quickness: number): 'none' | 'walking' | 'running' {
  if (!(metres > 0.05)) return 'none';
  return metres <= Math.max(0, quickness) * C().movement.walk ? 'walking' : 'running';
}

/** Whether damage taken calls for a knockdown test. */
export function knockdownTriggered(opts: { power: number; body: number; level: DamageLevel | null }): boolean {
  const k = C().knockdown;
  if (!k.enabled || !opts.level) return false;
  if (k.trigger === 'serious') return opts.level === 'S' || opts.level === 'D';
  return opts.power > opts.body;
}

/** Body Index used by bioware, its limit, and the Magic it costs. */
export function bodyIndex(items: ReadonlyArray<{ bioware?: boolean; installed?: boolean; bodyIndex?: number }>, limits: { body: number; essence: number }): { used: number; max: number; over: boolean; magicLoss: number } {
  const used = Math.round(items.filter((i) => i.bioware && i.installed).reduce((s, i) => s + Math.max(0, i.bodyIndex ?? 0), 0) * 100) / 100;
  const max = C().bioware.maxFrom === 'essence' ? limits.essence : limits.body;
  return { used, max, over: used > max, magicLoss: Math.floor(used * C().bioware.magicPerBodyIndex) };
}

/* ---- v0.21.0 ---- */

/** Scatter dice for a blast at a range band. */
export function scatterDiceFor(range: string | undefined): number {
  const t = C().scatter.diceByRange as Record<string, number>;
  return t[range ?? 'short'] ?? t['short'] ?? 1;
}

/** How far a blast lands from its target point: the dice, less a few metres per attack success. */
export function scatterMetres(dice: readonly number[], successes: number): number {
  return Math.max(0, dice.reduce((a, b) => a + b, 0) - Math.max(0, successes) * C().scatter.metresPerSuccess);
}

/**
 * Confined space: `wallDistances` are the metres to the first wall along 8 rays from the blast
 * point (Infinity = none within the radius). Enough walls close by reflect the blast.
 */
export function confinedBlast(power: number, perMetre: number, wallDistances: readonly number[]): { confined: boolean; bonus: number } {
  const radius = blastRadius(power, perMetre);
  const near = wallDistances.filter((d) => Number.isFinite(d) && d <= radius);
  if (!C().confined.enabled || near.length < C().confined.rays) return { confined: false, bonus: 0 };
  // v0.47.0: the nearest wall, or the walls' average distance.
  const at = C().confined.mode === 'average' ? near.reduce((a, b) => a + b, 0) / near.length : Math.min(...near);
  return { confined: true, bonus: Math.max(0, Math.floor(blastPower(power, at, perMetre) * C().confined.bonus)) };
}

export type GrenadeKind = (typeof RULES.COMBAT.grenades)[number];

export function grenadeKind(id: string | null | undefined): GrenadeKind {
  return C().grenades.find((g) => g.id === id) ?? C().grenades[0]!;
}

/** Power lost per metre: the grenade kind's, or the weapon's own for custom. */
export function blastFalloff(kindId: string | null | undefined, weaponPerMetre: number): number {
  return grenadeKind(kindId).perMetre ?? weaponPerMetre;
}

/** Whether a token is inside a shotgun's cone: within the spread at its own distance along the line, out to the target. */
export function inShotgunCone(opts: { along: number; perpendicular: number; targetDistance: number; choke: number; tolerance?: number }): boolean {
  const tol = opts.tolerance ?? 0.5;
  if (opts.along <= 0 || opts.along > opts.targetDistance + tol) return false;
  const half = (opts.along / Math.max(C().shotgun.minChoke, opts.choke || 0)) / 2;
  return opts.perpendicular <= half + tol;
}

/** Rounds wasted walking full-auto fire between targets (metres between each pair). */
export function wastedRounds(gaps: readonly number[]): number {
  return gaps.reduce((n, m) => n + Math.floor(Math.max(0, m)) * C().spreadFire.wastedRoundsPerMetre, 0);
}

const LIGHT_ORDER: readonly LightLevel[] = ['normal', 'partial', 'minimal', 'darkness'];

/** The brighter of two light levels. */
export function brighter(a: LightLevel, b: LightLevel): LightLevel {
  return LIGHT_ORDER.indexOf(a) <= LIGHT_ORDER.indexOf(b) ? a : b;
}

/** Light from a light source on the target: bright = normal light, dim = partial light. */
export function lightFromSource(inBright: boolean, inDim: boolean): LightLevel | null {
  return inBright ? 'normal' : inDim ? 'partial' : null;
}

/** Smoke TN for the attacker's best vision. */
export function smokeModifier(kindIn: V79SmokeKind, vision: Vision = {}): { value: number; using: VisionKind } {
  // v0.79.0: the book's smoke rows (RULES.DOCS_V79.visionSmokeRows); the old rows have no heavy smoke.
  const v79 = smokeV79(kindIn, vision);
  if (v79) return v79;
  const kind = smokeKindOld(kindIn);
  if (kind === 'none') return { value: 0, using: 'normal' };
  const t = C().smoke[kind];
  let best: VisionKind = 'normal';
  let value = t.normal;
  if (vision.lowLight && t.lowLight < value) { best = 'lowLight'; value = t.lowLight; }
  if (vision.thermographic && t.thermographic < value) { best = 'thermographic'; value = t.thermographic; }
  const u = RULES.CYBERWARE.ultrasound.smoke[kind];
  if (vision.ultrasound && u < value) { best = 'ultrasound'; value = u; }
  return { value, using: best };
}

/** Prone modifiers for an attack. */
export function proneModifiers(opts: { melee: boolean; targetProne: boolean; attackerProne: boolean }): TargetNumberModifier[] {
  const p = C().prone;
  const out: TargetNumberModifier[] = [];
  if (opts.targetProne) {
    const v = opts.melee ? p.targetMelee : p.targetRanged;
    if (v) out.push({ id: 'targetProne', label: tx('SR2E.Card.Mod.targetProne'), value: v });
  }
  if (opts.attackerProne) {
    const v = opts.melee ? p.attackerMelee : p.attackerRanged;
    if (v) out.push({ id: 'attackerProne', label: tx('SR2E.Card.Mod.attackerProne'), value: v });
  }
  return out;
}

/** Friends in melee: other allies engaged with the same target. */
export function friendsModifiers(friends: number): TargetNumberModifier[] {
  const n = Math.min(C().friendsInMelee.max, Math.max(0, Math.floor(friends)));
  return n ? [{ label: tx('SR2E.Card.Mod.friendsInMelee', { n }), value: n * C().friendsInMelee.tnPerFriend }] : [];
}

/** Charging into melee. */
export function chargeModifiers(charging: boolean): TargetNumberModifier[] {
  return charging && C().charging.tn ? [{ id: 'charging', label: tx('SR2E.Card.Mod.charging'), value: C().charging.tn }] : [];
}

/** Armor encumbrance: Quickness lost when worn armor exceeds it. */
export function encumbrancePenalty(ballistic: number, impact: number, quickness: number): number {
  const e = C().encumbrance;
  if (!e.enabled) return 0;
  return Math.max(0, Math.max(ballistic || 0, impact || 0) - Math.max(0, quickness || 0)) * e.penaltyPerPoint;
}

/** Gyro mount: its rating cancels recoil first, then (if allowed) movement penalties. */
export function gyroOffset(opts: { recoil: number; movement: number; gyro: number }): { recoil: number; movement: number; used: number } {
  let g = Math.max(0, opts.gyro || 0);
  const recoil = Math.max(0, opts.recoil - g);
  g -= Math.max(0, opts.recoil) - recoil;
  const movement = C().gyro.offsetsMovement ? Math.max(0, opts.movement - g) : opts.movement;
  return { recoil, movement, used: (opts.recoil - recoil) + (opts.movement - movement) };
}

/** Armor added by barriers between the shooter and the target. */
export function barrierArmor(ratings: readonly number[]): number {
  return C().barriers.addsToArmor ? ratings.reduce((a, r) => a + Math.max(0, r || 0), 0) : 0;
}
