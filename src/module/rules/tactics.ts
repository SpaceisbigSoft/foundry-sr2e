/**
 * v0.55.0: combat and health holes from the v0.53.0 review (pure rules; numbers in RULES.COMBAT,
 * RULES.PATCHES and RULES.BIOWARE.surgery.trauma, all VERIFY): Take Aim, several targets in one phase,
 * reloading by feed, armor against thrown weapons and bows, shotgun spread TN, combined blasts,
 * slap patches, holds and surgical trauma.
 */
import { RULES, type DamageLevel } from './config.ts';
import type { TargetNumberModifier } from './dice.ts';
import { own } from './util.ts';
import { t as tx } from '../helpers/i18n.ts';
import { surgeryBandLevel } from './health923.ts';

const C = () => RULES.COMBAT;

// ---------------------------------------------------------------- Take Aim

/** The most Take Aim can give with a skill of this rating (at least 1 when allowed at all). */
export function aimCap(skillRating: number): number {
  const a = C().aim;
  const fromSkill = a.maxFromSkill > 0 ? Math.max(1, Math.floor(Math.max(0, skillRating) * a.maxFromSkill)) : Infinity;
  const fixed = a.max > 0 ? a.max : Infinity;
  const cap = Math.min(fromSkill, fixed);
  return Number.isFinite(cap) ? cap : 99;
}

/** An aim kept on the actor: at one target with one weapon, this Combat Turn. */
export interface AimState { targetUuid: string; weaponId: string; actions: number; round: number; combatId: string }

// v0.81.0: aimModifier / nextAim removed; the glue uses fieldsfire.ts aimModifierV72 / nextAimV72.

// ---------------------------------------------------------------- Several targets in one phase

/** Ranged: + TN for each different target already attacked earlier in this Combat Phase. */
export function multipleTargetModifier(earlierTargets: readonly string[], targetUuid: string): TargetNumberModifier[] {
  const others = [...new Set(earlierTargets.filter((u) => u && u !== targetUuid))];
  const v = others.length * C().multipleTargets.tnPerTarget;
  return v ? [{ label: tx('SR2E.Card.Mod.anotherTargetThisPhase', { othersLength: others.length }), value: v }] : [];
}

// ---------------------------------------------------------------- Reloading

export const FEEDS = ['clip', 'belt', 'cylinder', 'internal', 'break'] as const;

/** Rounds one reload action puts in by feed (a clip or belt fills it). */
export function reloadAmount(feed: string, ammo: number, ammoMax: number): number {
  const room = Math.max(0, Math.floor(ammoMax) - Math.max(0, Math.floor(ammo)));
  const per = own(C().reloadFeed, feed) ?? 'all';
  return per === 'all' ? room : Math.min(room, Math.max(1, Math.floor(Number(per) || 1)));
}

// ---------------------------------------------------------------- Armor kind per weapon

/** Which armor stops a weapon: its own setting, else melee impact, thrown and bows by RULES.COMBAT.armorFor, else ballistic. */
export function weaponArmorKind(w: { armorKind?: string; melee?: boolean; thrown?: boolean; skill?: string; name?: string }): 'impact' | 'ballistic' {
  if (w.armorKind === 'impact' || w.armorKind === 'ballistic') return w.armorKind;
  if (w.melee) return 'impact';
  if (w.thrown || /throw/i.test(String(w.skill ?? ''))) return C().armorFor.thrown;
  // v0.81.0: 'bow' as a word (bow, bows, crossbow, longbow, shortbow), so "Elbow" or "Rainbow" doesn't match.
  const bow = /(?:\b|cross|long|short)bows?\b/i;
  if (bow.test(String(w.skill ?? '')) || bow.test(String(w.name ?? ''))) return C().armorFor.bow;
  return 'ballistic';
}

// ---------------------------------------------------------------- Shotgun spread TN

/** + TN for a shotgun's spread at the target (RULES.COMBAT.shotgunTnPerMetre; 0 = none). */
export function shotgunTnModifier(spreadWidthMetres: number): TargetNumberModifier[] {
  const v = Math.floor(Math.max(0, spreadWidthMetres) * C().shotgunTnPerMetre);
  return v ? [{ id: 'shotgunSpread', label: tx('SR2E.Card.Mod.shotgunSpread'), value: v }] : [];
}

// ---------------------------------------------------------------- Combining blasts

/** Two (or more) blasts at one spot: the strongest Power plus a fraction of each other's. */
export function combinedBlastPower(powers: readonly number[]): number {
  const p = powers.filter((x) => Number.isFinite(x) && x > 0).sort((a, b) => b - a);
  if (!p.length) return 0;
  return p[0]! + p.slice(1).reduce((n, x) => n + Math.floor(x * C().blastCombine.fraction), 0);
}

// ---------------------------------------------------------------- Holds

/** A hold attempt: whoever gets more successes wins; ties go to the defender. */
export function holdOutcome(attackerSuccesses: number, defenderSuccesses: number): 'held' | 'free' {
  return attackerSuccesses > defenderSuccesses ? 'held' : 'free';
}

// ---------------------------------------------------------------- Slap patches

/** A stim patch: the Stun boxes it takes off now, and when (hours) and how many come back. */
export function stimEffect(stun: number, rating: number, minutes?: number): { off: number; backHours: number; backSeconds: number; back: number } {
  const r = Math.max(0, Math.floor(rating));
  const off = Math.min(Math.max(0, stun), r);
  const s = RULES.PATCHES.stim;
  // v0.78.0 (RULES.BOOK_V78.patches.stim 'book'): it wears off in 2D6 minutes (`minutes`, rolled by the caller).
  const book = RULES.BOOK_V78.patches.stim === 'book' && minutes !== undefined;
  const backHours = book ? Math.max(0, minutes!) / 60 : r * s.hoursPerRating;
  return { off, backHours, backSeconds: Math.round(backHours * 3600), back: off > 0 ? off + s.backlash : 0 };
}

/** A tranq patch: Stun boxes after the target's Body successes (TN = rating) (the old way, BOOK_V78.patches.tranq 'body'). */
export function tranqBoxes(rating: number, bodySuccesses: number): number {
  return Math.max(0, Math.floor(rating) - Math.max(0, bodySuccesses));
}
/** v0.78.0 (BOOK_V78.patches.tranq 'opposed', the book): each net success of the patch (rating vs Body) over the patient's (Body vs rating) is a Stun box. */
export function tranqOpposed(patchSuccesses: number, bodySuccesses: number): number {
  return Math.max(0, Math.max(0, patchSuccesses) - Math.max(0, bodySuccesses));
}

/** An antidote patch: dice against the next toxin, and for how many hours. */
export function antidoteEffect(rating: number): { dice: number; hours: number } {
  const r = Math.max(0, Math.floor(rating));
  return { dice: r, hours: r * RULES.PATCHES.antidote.hoursPerRating };
}

// ---------------------------------------------------------------- Surgical trauma

/**
 * The wound a surgery leaves by its size (Essence or Body Index points), when the house rule is on.
 * v0.92.3 (RULES.HEALTH_V923.surgeryBands 'book'): the book's bands, cyberware by Essence (Core p. 114), bioware by
 * Body Index (Shadowtech bionetics); 'table' uses `levels`.
 */
export function surgicalTrauma(points: number, bioware = false): { level: DamageLevel; type: 'physical' | 'stun' } | null {
  const t = RULES.BIOWARE.surgery.trauma;
  if (!t.enabled || !(points > 0)) return null;
  const band = surgeryBandLevel(points, bioware);
  if (band) return { level: band, type: t.type };
  const row = t.levels.find((l) => points <= l.upTo) ?? t.levels[t.levels.length - 1];
  return row ? { level: row.level, type: t.type } : null;
}
