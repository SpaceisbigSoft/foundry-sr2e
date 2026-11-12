import { RULES, type DamageLevel } from './config.ts';
import { cyberCost } from './cyberware.ts';
import type { Monitor } from './damage.ts';
import { bioEffectSpecV72 } from './vitals.ts';
import { own } from './util.ts';
import { bioBookEffect, culturedPriceApplies, gearBook, surgeryTnBook } from './gear923.ts';
import { t as tx } from '../helpers/i18n.ts';

/** Bioware depth (v0.30.0). Pure rules, no Foundry dependency. Values in RULES.BIOWARE. */

const B = () => RULES.BIOWARE;

export interface BioItem {
  name: string;
  bioKind: string;
  rating: number;
  installed: boolean;
  damaged?: boolean;
  /** Adrenal pumps: switched on. */
  active?: boolean;
  cultured?: boolean;
}

export interface BioEffect {
  attributes: Record<string, number>;
  reaction: number;
  initiativeDice: number;
  reflexes: string;
  ballistic: number;
  impact: number;
  toxinDice: number;
  inhalantDice: number;
  boxesOff: number;
  ignoreBoxes: number;
  /** v0.45.0: dice on physical skills, Stun boxes off each hit, Stun wounds ignored, Perception TN. */
  physicalSkillDice: number;
  stunBoxesOff: number;
  ignoreStunWounds: boolean;
  perceptionTn: number;
  /** v0.78.0 (RULES.BOOK_V78.toxinBioware 'power'): Power taken off toxins, by vector (toxin extractor, tracheal filter). */
  powerOff: Record<string, number>;
  /** v0.92.3 (RULES.GEAR_V923.bioware 'book'): dice on every Active Skill, Task Pool dice, and Quickness that doesn't raise Reaction. */
  allActiveDice?: number;
  taskPool?: number;
  quicknessNoReaction?: number;
}

/** What one bioware item does at its rating (nothing when uninstalled, damaged, or an inactive adrenal pump). */
export function bioEffect(item: BioItem): BioEffect {
  const out: BioEffect = { attributes: {}, reaction: 0, initiativeDice: 0, reflexes: '', ballistic: 0, impact: 0, toxinDice: 0, inhalantDice: 0, boxesOff: 0, ignoreBoxes: 0, physicalSkillDice: 0, stunBoxesOff: 0, ignoreStunWounds: false, perceptionTn: 0, powerOff: {} };
  // v0.72.0 (O9): Shadowtech kinds from RULES.HEALTH_V72.bioware (suprathyroid's attributes and Reaction).
  const base = B().effects[item.bioKind];
  const e = base ?? (bioEffectSpecV72(item.bioKind) as unknown as typeof base);
  const r = Math.max(0, Math.floor(item.rating || 0));
  if (!e || !item.installed || item.damaged || !(r > 0)) return out;
  if (e.whileActive && !item.active) return out;
  // v0.81.0: one rule for every number: scaled by the rating unless `perRating: false` (boxesOff used to
  // scale only with `perRating: true`, and Reaction, dice and armor ignored `perRating: false`).
  const k = e.perRating === false ? 1 : r;
  const scale = (v: number | undefined) => Math.floor((Number(v) || 0) * k);
  for (const [key, v] of Object.entries(e.attributes ?? {})) out.attributes[key] = scale(v);
  out.reaction = scale(e.reaction);
  out.initiativeDice = scale(e.initiativeDice);
  out.reflexes = e.reflexes ?? '';
  out.ballistic = scale(e.ballistic);
  out.impact = scale(e.impact);
  out.toxinDice = scale(e.toxinDice);
  out.inhalantDice = scale(e.inhalantDice);
  // v0.78.0 (RULES.BOOK_V78.toxinBioware 'power', Shadowtech): the toxin extractor takes floor(level ÷ 2) off injected
  // toxins' Power and the tracheal filter the same off inhaled ones, instead of dice.
  if (RULES.BOOK_V78.toxinBioware === 'power' && (item.bioKind === 'toxinExtractor' || item.bioKind === 'trachealFilter')) {
    const vector = item.bioKind === 'toxinExtractor' ? 'injection' : RULES.TOXINS.inhalantVector;
    out.toxinDice = 0;
    out.inhalantDice = 0;
    out.powerOff[vector] = Math.floor(r / 2);
  }
  out.boxesOff = scale(e.boxesOff);
  out.ignoreBoxes = scale(e.ignoreBoxes);
  out.physicalSkillDice = scale(e.physicalSkillDice);
  out.stunBoxesOff = scale(e.stunBoxesOff);
  out.ignoreStunWounds = Boolean(e.ignoreStunWounds);
  // The Perception TN never scales.
  out.perceptionTn = Math.floor(e.perceptionTn ?? 0);
  // v0.92.3 (RULES.GEAR_V923.bioware 'book', Shadowtech): the book's effects where they differ.
  const bk = bioBookEffect(item.bioKind, r);
  if (bk) {
    if (bk.attributes) out.attributes = { ...bk.attributes };
    if (bk.reaction !== undefined) out.reaction = bk.reaction;
    if (bk.impact !== undefined) out.impact = bk.impact;
    if (bk.ballistic !== undefined) out.ballistic = bk.ballistic;
    if (bk.physicalSkillDice !== undefined) out.physicalSkillDice = bk.physicalSkillDice;
    if (bk.allActiveDice !== undefined) out.allActiveDice = bk.allActiveDice;
    if (bk.perceptionTn !== undefined) out.perceptionTn = bk.perceptionTn;
    if (bk.taskPool !== undefined) out.taskPool = bk.taskPool;
    if (bk.reactionFromQuickness === false) out.quicknessNoReaction = Number(bk.attributes?.['quickness'] ?? 0);
  }
  return out;
}

/** Bioware that should be cultured but isn't. */
export function culturedWarnings(items: readonly BioItem[]): string[] {
  // v0.92.3 (RULES.GEAR_V923.cultured 'book'): neural bioware is always cultured (its price and Body Cost count it), so no warning.
  if (gearBook('cultured')) return [];
  return items.filter((i) => i.installed && B().cultured.required.includes(i.bioKind) && !i.cultured).map((i) => tx('SR2E.Text.Bioware.shouldBeCulturedBioware', { name: i.name }));
}

/** Bioware cost: cultured costs more. */
export function bioCost(cost: number, cultured: boolean, kind = '', name = ''): number {
  // v0.92.3 (RULES.GEAR_V923.cultured 'book', Shadowtech p. 6): neural bioware's listed price already counts culturing.
  return Math.round(Math.max(0, cost) * (culturedPriceApplies(cultured, kind, name) ? B().cultured.costMultiplier : 1));
}

/** Conflicts with cyberware: warnings, and whether bio armor only counts above the cyber armor. */
export function bioConflicts(bio: readonly BioItem[], cyberNames: readonly string[]): { warnings: string[]; armorConflict: boolean } {
  const warnings: string[] = [];
  let armorConflict = false;
  for (const c of B().conflicts) {
    const b = bio.find((i) => i.installed && i.bioKind === c.bio);
    const cy = cyberNames.find((n) => n.toLowerCase().includes(c.cyber.toLowerCase()));
    if (!b || !cy) continue;
    if (c.rule === 'armor') {
      armorConflict = true;
      warnings.push(tx('SR2E.Text.Bioware.andDontStackOnly', { name: b.name, cyber: cy }));
    } else warnings.push(tx('SR2E.Text.Bioware.conflictsWith', { name: b.name, cyber: cy }));
  }
  return { warnings, armorConflict };
}

/** Bio armor when it conflicts with cyber armor: only what is above the cyber armor counts. */
export function bioArmorAfterConflict(bio: number, cyber: number, conflict: boolean): number {
  return conflict ? Math.max(0, bio - cyber) : bio;
}

/** Wound modifiers with a damage compensator: the first boxes on each track are ignored. */
export function compensatedMonitor(m: Monitor, ignoreBoxes: number): Monitor {
  const n = Math.max(0, ignoreBoxes);
  return { physical: Math.max(0, m.physical - n), stun: Math.max(0, m.stun - n) };
}

/** A Physical hit after platelet factories: `boxesOff` fewer boxes, never below 1. */
export function plateletBoxes(boxes: number, boxesOff: number): number {
  if (!(boxes > 0)) return boxes;
  return Math.max(1, boxes - Math.max(0, boxesOff));
}

/** Body Index's extra TN on healing the patient. */
export function bodyIndexHealingTn(bodyIndex: number): number {
  return Math.floor(Math.max(0, bodyIndex) * B().bodyIndex.healingTnPerPoint);
}

/** Dice Body Index takes off toxin resistance. */
export function bodyIndexToxinPenalty(bodyIndex: number): number {
  return Math.floor(Math.max(0, bodyIndex) * B().bodyIndex.toxinDicePerPoint);
}

/** The adrenal pump's crash when it is switched off: TN and Stun level. */
export function adrenalCrash(rating: number): { attribute: string; tn: number; level: DamageLevel } {
  const c = B().adrenalCrash;
  return { attribute: c.attribute, tn: c.tn, level: c.levelByRating[Math.min(2, Math.max(1, Math.floor(rating)))] ?? 'M' };
}

/** Surgery: the TN for the grade. */
export function surgeryTarget(grade: string, essenceAfter?: number | null): number {
  // v0.92.3 (RULES.GEAR_V923.surgery 'book', Cybertechnology p. 53): 10 − the Essence left (cyberware only).
  if (gearBook('surgery') && essenceAfter != null && Number.isFinite(essenceAfter)) return surgeryTnBook(essenceAfter);
  const s = B().surgery;
  return s.tn + (own(s.gradeTn, grade) ?? 0);
}
/** Recovery days after surgery: points installed × surgery.daysPerPoint ÷ the surgery successes, rounded up, at least 1 (null: the surgery failed). */
export function recoveryDays(points: number, successes: number): number | null {
  if (!(successes > 0)) return null;
  return Math.max(1, Math.ceil(Math.max(0, points) * B().surgery.daysPerPoint / successes));
}

/**
 * v0.54.0: one price for cyberware and bioware everywhere (sheet, Find, fence, build check):
 * cyberware by its grade, bioware by cultured or not (bioware has no grade).
 */
export function wareCost(sys: { cost?: number; grade?: string; bioware?: boolean; cultured?: boolean; bioKind?: string }, name = ''): number {
  const c = Math.max(0, Number(sys.cost ?? 0) || 0);
  return sys.bioware ? bioCost(c, Boolean(sys.cultured), String(sys.bioKind ?? ''), name) : cyberCost(c, String(sys.grade ?? 'standard'));
}
