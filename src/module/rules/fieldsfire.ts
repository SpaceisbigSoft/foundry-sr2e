/**
 * v0.72.0: combat and gear items O1–O7 from the v0.69.0 review (pure rules, no Foundry). Values and
 * switches in RULES.COMBAT_V72 (rules/config72/combat.ts), all VERIFY:
 * blasts through barriers (O1), Take Aim across Combat Turns and capped by the rating rolled (O2),
 * immunity to normal weapons stopping weak attacks (O3), called shots at a gap bypassing worn armor
 * only (O4), smoke in melee (O5), a data-driven ammunition list (O6), and indirect fire (O7).
 */
import { blastLoss } from './weapons.ts';
import { RULES, type DamageLevel } from './config.ts';
import type { TargetNumberModifier } from './dice.ts';
import { stageUp } from './damage.ts';
import { aimCap, type AimState } from './tactics.ts';
import { specializationMatches } from './skills.ts';
import type { COMBAT_V72, AmmoRow, GapArmorPart, SpotterLink } from './config72/combat.ts';
import { own } from './util.ts';
import { t as tx, tCount } from '../helpers/i18n.ts';

export type { AmmoRow, GapArmorPart, SpotterLink };

type Cfg = typeof COMBAT_V72;
/** The live block, read at call time (house rules mutate RULES). */
const V = (): Cfg => RULES.COMBAT_V72;

// ---------------------------------------------------------------- O1: blasts through barriers

/** A wall between a blast point and a target: metres from the blast point, and its rating (null = none set). */
export interface BlastWall { metres: number; rating: number | null }

export interface BlastWallStep { metres: number; rating: number; powerAt: number; holds: boolean; unrated: boolean }

export interface BlastBarrierResult {
  /** The blast doesn't reach the target at all. */
  blocked: boolean;
  /** Power lost to walls it went through ('rating' mode). */
  loss: number;
  /** Armor the walls add ('armor' mode). */
  extraArmor: number;
  /** Each wall in order from the blast point. */
  walls: BlastWallStep[];
  /** A short reason for the card ('' when no wall is in the way). */
  note: string;
}

/**
 * O1: what the walls between a blast and a target do to it. `power` is the blast's Power at the blast
 * point (with any confined-space bonus); Power at a wall is `power − floor(metres) × perMetre` less what
 * earlier walls took off. Modes in RULES.COMBAT_V72.blastBarriers.
 */
export function blastThroughWalls(
  o: { power: number; perMetre: number; walls: readonly BlastWall[] },
  cfg: Cfg['blastBarriers'] = V().blastBarriers,
  defaultRating: number = RULES.COMBAT.barriers.defaultWallRating,
): BlastBarrierResult {
  const out: BlastBarrierResult = { blocked: false, loss: 0, extraArmor: 0, walls: [], note: '' };
  const sorted = [...o.walls].sort((a, b) => a.metres - b.metres);
  for (const w of sorted) {
    const unrated = w.rating == null || !Number.isFinite(Number(w.rating));
    const rating = Math.max(0, unrated ? Number(defaultRating) || 0 : Number(w.rating));
    const powerAt = o.power - blastLoss(w.metres, o.perMetre) - out.loss;
    const step: BlastWallStep = { metres: w.metres, rating, powerAt, holds: false, unrated };
    out.walls.push(step);
    if (cfg.mode === 'block' || (unrated && cfg.unratedWalls === 'block')) {
      step.holds = true;
      out.blocked = true;
      out.note = tx('SR2E.Text.Fieldsfire.aWallShieldsIt');
      return out;
    }
    if (cfg.mode === 'armor') { out.extraArmor += rating; continue; }
    if (powerAt <= rating * cfg.holdMultiplier) {
      step.holds = true;
      out.blocked = true;
      out.note = tx('SR2E.Text.Fieldsfire.aWallRatingHolds', { rating, power: Math.max(0, powerAt) });
      return out;
    }
    out.loss += Math.floor(rating * cfg.reduceMultiplier);
  }
  if (out.walls.length) {
    out.note = cfg.mode === 'armor'
      ? (out.extraArmor ? tx('SR2E.Text.Fieldsfire.wallsAddArmor', { armor: out.extraArmor }) : '')
      : out.loss ? tCount(out.walls.length, 'SR2E.Text.Fieldsfire.throughWallsLoss', { loss: out.loss }) : tCount(out.walls.length, 'SR2E.Text.Fieldsfire.throughWalls');
  }
  return out;
}

/**
 * Where along a→b a wall segment [x1, y1, x2, y2] is crossed, as a fraction 0–1 of the way (null if not
 * crossed). Metres to the wall = fraction × the a→b distance in metres.
 */
export function crossingFraction(a: { x: number; y: number }, b: { x: number; y: number }, c: readonly number[]): number | null {
  const [x1, y1, x2, y2] = c as [number, number, number, number];
  if ([x1, y1, x2, y2].some((n) => !Number.isFinite(n))) return null;
  const rx = b.x - a.x, ry = b.y - a.y, sx = x2 - x1, sy = y2 - y1;
  const d = rx * sy - ry * sx;
  if (Math.abs(d) < 1e-9) return null;
  const t = ((x1 - a.x) * sy - (y1 - a.y) * sx) / d;
  const u = ((x1 - a.x) * ry - (y1 - a.y) * rx) / d;
  return t > 0 && t < 1 && u >= 0 && u <= 1 ? t : null;
}

// ---------------------------------------------------------------- O2: Take Aim

export interface AimNow { targetUuid: string; weaponId: string; round: number; combatId: string }

/** Whether a kept aim still counts: same target, weapon and combat; same Combat Turn unless `keepAcrossTurns`. */
export function aimHeld(aim: AimState | null | undefined, now: AimNow, cfg: Cfg['aim'] = V().aim): boolean {
  if (!aim || !aim.actions) return false;
  if (aim.targetUuid !== now.targetUuid || aim.weaponId !== now.weaponId || aim.combatId !== now.combatId) return false;
  return cfg.keepAcrossTurns ? now.round >= aim.round : aim.round === now.round;
}

/** The TN modifier from a kept aim (replaced tactics.aimModifier, removed in v0.81.0). `rating`: from aimRating(). */
export function aimModifierV72(aim: AimState | null | undefined, now: AimNow, rating: number, cfg: Cfg['aim'] = V().aim): TargetNumberModifier[] {
  if (!aimHeld(aim, now, cfg)) return [];
  const n = Math.min(aim!.actions, aimCap(rating));
  return n > 0 ? [{ label: tCount(n, 'SR2E.Card.Fieldsfire.aimedActions'), value: n * RULES.COMBAT.aim.tnPerAction }] : [];
}

/** Another aim action (replaced tactics.nextAim, removed in v0.81.0): one more when the aim is held, else a fresh one. */
export function nextAimV72(aim: AimState | null | undefined, now: AimNow, cfg: Cfg['aim'] = V().aim): AimState {
  return { ...now, actions: aimHeld(aim, now, cfg) ? aim!.actions + 1 : 1 };
}

export interface AimSkill {
  rating: number; specializationRating?: number; concentrationRating?: number;
  useSpecialization?: boolean; useConcentration?: boolean;
  /** Defaulting to a related skill: its rating. */
  relatedRating?: number;
}

/** O2: the rating the aim cap is read from: the one rolled ('rolled', as skillTestDice picks) or the base skill ('base'). */
export function aimRating(s: AimSkill, cfg: Cfg['aim'] = V().aim): number {
  const base = Math.max(0, Number(s.rating) || 0);
  if (cfg.capBy === 'base') return base;
  if (base > 0) {
    const spec = Math.max(0, Number(s.specializationRating) || 0);
    if (s.useSpecialization && spec > 0) return spec;
    const conc = Math.max(0, Number(s.concentrationRating) || 0);
    if (s.useConcentration && conc > 0) return conc;
    return base;
  }
  return Math.max(0, Number(s.relatedRating) || 0);
}

/**
 * For Take Aim's own card (no attack chosen yet): the rating the attack with this weapon would most
 * likely roll: the specialization or concentration when it names the weapon's specialization.
 */
export function aimRatingForWeapon(
  skill: { rating?: number; specialization?: string; specializationRating?: number; concentration?: string; concentrationRating?: number } | null | undefined,
  weaponSpecialization: string,
  cfg: Cfg['aim'] = V().aim,
): number {
  if (!skill) return 0;
  return aimRating({
    rating: Number(skill.rating) || 0,
    specializationRating: Number(skill.specializationRating) || 0,
    concentrationRating: Number(skill.concentrationRating) || 0,
    useSpecialization: specializationMatches(skill.specialization ?? '', weaponSpecialization ?? ''),
    useConcentration: specializationMatches(skill.concentration ?? '', weaponSpecialization ?? ''),
  }, cfg);
}

// ---------------------------------------------------------------- O3: immunity to normal weapons

/**
 * O3: whether immunity to normal weapons stops an attack outright: its modified Power doesn't exceed the
 * immunity armor (with the other armor when `compare` is 'allArmor'). `immunity` is the armor from
 * immunity alone (0 = none, or the weapon ignores it); `armorMultiplier` the ammo's (APDS 0.5).
 */
export function immunityStops(
  o: { power: number; immunity: number; otherArmor?: number; armorMultiplier?: number },
  cfg: Cfg['immunity'] = V().immunity,
): { stops: boolean; against: number } {
  const imm = Math.max(0, Number(o.immunity) || 0);
  if (!cfg.stopsWeak || imm <= 0) return { stops: false, against: 0 };
  const mult = cfg.ammoCounts ? Math.max(0, o.armorMultiplier ?? 1) : 1;
  const raw = imm + (cfg.compare === 'allArmor' ? Math.max(0, Number(o.otherArmor) || 0) : 0);
  const against = Math.floor(raw * mult);
  return { stops: o.power <= against, against };
}

// ---------------------------------------------------------------- O4: called shot at a gap

export interface ArmorParts { worn: number; adept: number; cyber: number; limb: number; effect: number; immunity: number }

/**
 * O4: total armor from its parts. With `gap` (a called shot at a gap in the armor), the parts in
 * RULES.COMBAT_V72.calledShotGap.bypasses count 0. Immunity always counts (the caller drops it for
 * weapons that ignore it).
 */
export function armorFromParts(p: Partial<ArmorParts>, gap: boolean, cfg: Cfg['calledShotGap'] = V().calledShotGap): number {
  const skip = new Set<string>(gap ? cfg.bypasses : []);
  const part = (k: GapArmorPart) => (skip.has(k) ? 0 : Math.max(0, Number(p[k]) || 0));
  return part('worn') + part('adept') + part('cyber') + part('limb') + part('effect') + Math.max(0, Number(p.immunity) || 0);
}

// ---------------------------------------------------------------- O5: smoke in melee

/** O5: whether smoke counts for this attack (always at range; in melee with `meleeSmoke`). */
export function smokeCounts(melee: boolean, cfg: Cfg = V()): boolean {
  return !melee || Boolean(cfg.meleeSmoke);
}

/** O5: the smoke modifier to use (null when it doesn't count). */
export function sightSmoke<T>(melee: boolean, smoke: T | null | undefined, cfg: Cfg = V()): T | null {
  return smokeCounts(melee, cfg) ? smoke ?? null : null;
}

// ---------------------------------------------------------------- O6: data-driven ammunition

/** O6: the ammunition list: RULES.COMBAT.ammo, plus (when data-driven) the extra rows (same id replaces). */
export function ammoTable(base: readonly AmmoRow[] = RULES.COMBAT.ammo as readonly AmmoRow[], cfg: Cfg['ammo'] = V().ammo): AmmoRow[] {
  const rows = [...base];
  if (!cfg.dataDriven) return rows;
  for (const r of cfg.extra ?? []) {
    if (!r || typeof r.id !== 'string' || !r.id) continue;
    const row: AmmoRow = { ...r, label: String(r.label ?? r.id), power: Number(r.power) || 0, stages: Number(r.stages) || 0, armorMultiplier: Number.isFinite(Number(r.armorMultiplier)) ? Number(r.armorMultiplier) : 1 };
    const i = rows.findIndex((x) => x.id === row.id);
    if (i >= 0) rows[i] = row; else rows.push(row);
  }
  return rows;
}

/** O6: an ammunition row by id (unknown ids fall back to 'standard', else the first row). */
export function findAmmo(id: string | null | undefined, table: readonly AmmoRow[] = ammoTable()): AmmoRow {
  return table.find((a) => a.id === id) ?? table.find((a) => a.id === 'standard') ?? table[0] ?? { id: 'standard', label: 'Standard', power: 0, stages: 0, armorMultiplier: 1 };
}

/** O6: whether an id is in the list (for the sheet's "unknown ammunition" warning). */
export function isKnownAmmo(id: string | null | undefined, table: readonly AmmoRow[] = ammoTable()): boolean {
  return table.some((a) => a.id === id);
}

/** O6: damage after an ammunition row: Power change, stages up, then a fixed level if it sets one. */
export function ammoDamageFrom(power: number, level: DamageLevel, row: AmmoRow): { power: number; level: DamageLevel } {
  let lv = row.stages > 0 ? stageUp(level, row.stages) : level;
  if (row.setLevel) lv = row.setLevel;
  return { power: Math.max(0, power + (Number(row.power) || 0)), level: lv };
}

/** O6: the attack's extras from an ammunition row (what planAttack puts on the AttackState). */
export function ammoExtras(row: AmmoRow): { armorMultiplier?: number; armorKind?: 'ballistic' | 'impact'; damageType?: 'physical' | 'stun'; antiVehicle?: boolean } {
  return {
    ...(row.armorMultiplier !== 1 ? { armorMultiplier: row.armorMultiplier } : {}),
    ...(row.armorKind ? { armorKind: row.armorKind } : {}),
    ...(row.damageType ? { damageType: row.damageType } : {}),
    ...(row.antiVehicle ? { antiVehicle: true } : {}),
  };
}

/**
 * O6: options for an ammunition select. A loaded id no longer in the list (a house rule row removed) is
 * kept at the end, marked, so saving the sheet doesn't silently change it.
 */
export function ammoChoices(current: string | null | undefined, table: readonly AmmoRow[] = ammoTable(), blank = false): Array<{ id: string; label: string; selected: boolean }> {
  const cur = current ?? '';
  const rows = [...(blank ? [{ id: '', label: tx('SR2E.Text.Fieldsfire.notAmmunition') }] : []), ...table.map((a) => ({ id: a.id, label: a.label }))];
  if (cur && !rows.some((r) => r.id === cur)) rows.push({ id: cur, label: tx('SR2E.Text.Fieldsfire.notInTheAmmunitionList', { cur }) });
  return rows.map((r) => ({ ...r, selected: r.id === cur || (!cur && !blank && r.id === 'standard') }));
}

// ---------------------------------------------------------------- O7: indirect fire

/** O7: whether a weapon can fire indirect: a blast weapon flagged `indirect`, or fired with one of the listed skills. */
export function canFireIndirect(w: { blast?: boolean; indirect?: boolean; skill?: string; melee?: boolean }, cfg: Cfg['indirect'] = V().indirect): boolean {
  if (!cfg.enabled || w.melee || !w.blast) return false;
  if (w.indirect) return true;
  const sk = String(w.skill ?? '').trim().toLowerCase();
  return Boolean(sk) && cfg.skills.some((s) => s.trim().toLowerCase() === sk);
}

export interface IndirectPlan {
  allowed: boolean;
  reason: string;
  /** TN modifiers replacing the firer's own visibility group (blind fire, light, smoke). */
  modifiers: TargetNumberModifier[];
  /** The skill to fire with ('' = the weapon's own). */
  skill: string;
}

/**
 * O7: indirect fire's TN: the spotter's link (or blind fire with none), and walking fire in (earlier
 * shots at the same spot this combat). The firer's own light, smoke and blind fire don't count; the
 * spotter's view of the target can be added by the caller.
 */
export function indirectFire(o: { link: SpotterLink; adjustShots?: number }, cfg: Cfg['indirect'] = V().indirect): IndirectPlan {
  if (!cfg.enabled) return { allowed: false, reason: tx('SR2E.Text.Fieldsfire.indirectFireIsSwitchedOff'), modifiers: [], skill: '' };
  const mods: TargetNumberModifier[] = [];
  if (o.link === 'none') {
    if (cfg.noSpotter === 'block') return { allowed: false, reason: tx('SR2E.Text.Fieldsfire.indirectFireNeedsASpotter'), modifiers: [], skill: cfg.skill };
    mods.push({ id: 'indirectFireNoSpotterBlind', label: tx('SR2E.Card.Mod.indirectFireNoSpotterBlind'), value: RULES.COMBAT.cover.blindFireTn });
  } else {
    const v = Number(own(cfg.linkTn, o.link) ?? 0);
    const names: Record<string, string> = { voice: tx('SR2E.Card.Fieldsfire.byVoice'), datalink: tx('SR2E.Card.Fieldsfire.byDatalink'), designator: tx('SR2E.Card.Fieldsfire.laserDesignator') };
    if (v) mods.push({ label: tx('SR2E.Card.Mod.indirectFireSpotter', { names: names[o.link] ?? o.link }), value: v });
  }
  const shots = Math.max(0, Math.floor(o.adjustShots ?? 0));
  if (shots > 0 && cfg.adjustTnPerShot) {
    // v0.81.0: capped at the size of adjustMax either way, so a positive house-rule step can't flip the cap.
    const cap = Math.abs(Number(cfg.adjustMax) || 0);
    const v = cfg.adjustTnPerShot < 0 ? Math.max(-cap, shots * cfg.adjustTnPerShot) : Math.min(cap, shots * cfg.adjustTnPerShot);
    if (v) mods.push({ label: tCount(shots, 'SR2E.Card.Fieldsfire.walkingFireInEarlierShots'), value: v });
  }
  return { allowed: true, reason: '', modifiers: mods, skill: cfg.skill };
}

/** O7: scatter dice for an indirect shot (the range band's dice plus the extra). */
export function indirectScatterDice(baseDice: number, cfg: Cfg['indirect'] = V().indirect): number {
  return Math.max(0, Math.floor(baseDice) + Math.max(0, Math.floor(cfg.extraScatterDice)));
}

/**
 * O7: metres an indirect shot lands from the aim point: the dice × `scatterMultiplier`, less the usual
 * metres per attack success (RULES.COMBAT.scatter.metresPerSuccess) and per spotter success.
 */
export function indirectScatterMetres(diceTotal: number, o: { attackSuccesses?: number; spotterSuccesses?: number }, cfg: Cfg['indirect'] = V().indirect): number {
  const raw = Math.max(0, diceTotal) * Math.max(0, cfg.scatterMultiplier);
  const off = Math.max(0, o.attackSuccesses ?? 0) * RULES.COMBAT.scatter.metresPerSuccess + Math.max(0, o.spotterSuccesses ?? 0) * cfg.metresPerSpotterSuccess;
  return Math.max(0, Math.floor(raw - off));
}

/** O7: shots walked onto one spot, kept on the firer (flag) between shots. */
export interface AdjustState { x: number; y: number; shots: number; combatId: string }

/**
 * O7: the next shot at a spot. Within `tolerance` (same units as x/y, e.g. pixels) of the last spot in the
 * same combat it counts as walking fire in. Returns the new state and the earlier shots to count.
 */
export function nextAdjust(prev: AdjustState | null | undefined, now: { x: number; y: number; combatId: string }, tolerance: number): { state: AdjustState; earlierShots: number } {
  const same = Boolean(prev && prev.combatId === now.combatId && Math.hypot(prev.x - now.x, prev.y - now.y) <= Math.max(0, tolerance));
  const earlier = same ? prev!.shots : 0;
  return { state: { x: now.x, y: now.y, combatId: now.combatId, shots: earlier + 1 }, earlierShots: earlier };
}
