import { RULES, type DamageLevel } from './config.ts';
import type { TargetNumberModifier } from './dice.ts';
import type { Status } from './damage.ts';
import { urrCoreMaxAdjust } from './urr80-core.ts';
import { racialExtra } from './core923.ts';
import { firstAidLevelBoxes, bleedTurnsPerBox } from './urr80-health-social.ts';
import { own } from './util.ts';
import { t as tx } from '../helpers/i18n.ts';

/** Core character rules added in v0.22.0: metatypes, healing, conditions, actions, surprise. No Foundry dependency. */

export type AttrKey = 'body' | 'quickness' | 'strength' | 'charisma' | 'intelligence' | 'willpower';

export function metatype(id: string | null | undefined) {
  const t = RULES.METATYPES.types;
  return own(t, id ?? 'human') ?? t['human']!;
}

/** The racial modifier for one attribute. */
export function racialModifier(id: string | null | undefined, key: AttrKey): number {
  // v0.92.3 (RULES.CORE_V923.racialMods 'book', Core p. 45): the dwarf's Quickness −1 and the troll's Willpower −1.
  const t = RULES.METATYPES.types;
  const extra = own(t, id ?? 'human') ? racialExtra(id, key) : 0;
  return (own(metatype(id).mods as Record<string, number | undefined>, key) ?? 0) + extra;
}

/**
 * Natural and augmented maximums for one attribute. v0.81.0: `naturalBonus` raises the natural maximum (the
 * Exceptional Attribute edge: charfix.ts exceptionalAttributeBonus); the augmented one follows from it.
 */
export function attributeMaximums(id: string | null | undefined, key: AttrKey, naturalBonus = 0): { natural: number; augmented: number } {
  // v0.80.0 (RULES.URR_V80.coreMetaMax): the URR's maximums table (0 in the book).
  const natural = Math.max(1, RULES.METATYPES.naturalMax + racialModifier(id, key) + (Number(naturalBonus) || 0) + urrCoreMaxAdjust(id, key));
  return { natural, augmented: Math.floor(natural * RULES.METATYPES.augmentedMultiplier) };
}

/**
 * Warnings for attributes over their maximums, and (with `enforce: 'clamp'`) the capped totals. v0.81.0:
 * `naturalBonus` per attribute as in attributeMaximums (missing attributes in `values` are skipped).
 */
export function checkAttributeLimits(id: string | null | undefined, values: Partial<Record<AttrKey, { natural: number; total: number }>>, naturalBonus: Partial<Record<AttrKey, number>> = {}): { warnings: string[]; capped: Partial<Record<AttrKey, number>> } {
  const warnings: string[] = [];
  const capped: Partial<Record<AttrKey, number>> = {};
  for (const key of Object.keys(values) as AttrKey[]) {
    const v = values[key];
    if (!v) continue;
    const max = attributeMaximums(id, key, naturalBonus[key] ?? 0);
    const name = key.charAt(0).toUpperCase() + key.slice(1);
    if (v.natural > max.natural) warnings.push(tx('SR2E.Text.Core.isAboveTheNaturalMaximum', { name, value: v.natural, max: max.natural }));
    if (v.total > max.augmented) {
      warnings.push(tx('SR2E.Text.Core.isAboveTheAugmentedMaximum', { name, value: v.total, max: max.augmented }));
      if (RULES.METATYPES.enforce === 'clamp') capped[key] = max.augmented;
    }
  }
  return { warnings, capped };
}

/** The worst wound level on a track (null if unhurt): 1–2 boxes Light, 3–5 Moderate, 6–9 Serious, 10+ Deadly. */
export function woundLevel(boxes: number): DamageLevel | null {
  const b = RULES.BOXES_PER_LEVEL;
  if (boxes >= b.D) return 'D';
  if (boxes >= b.S) return 'S';
  if (boxes >= b.M) return 'M';
  if (boxes >= b.L) return 'L';
  return null;
}

/**
 * First aid: TN for the patient's wound, and the most boxes it can heal. v0.80.0 (RULES.URR_V80.hsFirstAid 'level'):
 * the wound drops one level (a Deadly Physical wound can only be stabilised); `track` only matters there.
 */
export function firstAidTarget(boxes: number, track: 'physical' | 'stun' = 'physical'): { tn: number; maxBoxes: number; level: DamageLevel | null } {
  const f = RULES.HEALING.firstAid;
  const level = woundLevel(boxes);
  if (!level) return { tn: f.tnByLevel.L, maxBoxes: 0, level };
  const byLevel = firstAidLevelBoxes(boxes, track);
  return { tn: f.tnByLevel[level], maxBoxes: byLevel ?? Math.max(1, Math.floor(boxes * f.maxFraction)), level };
}

/** Boxes healed by a first-aid test (v0.80.0 'level': any success heals the whole level). */
export function firstAidBoxes(successes: number, boxes: number, track: 'physical' | 'stun' = 'physical'): number {
  const t = firstAidTarget(boxes, track);
  if (firstAidLevelBoxes(boxes, track) !== null) return successes > 0 ? t.maxBoxes : 0;
  return Math.max(0, Math.min(t.maxBoxes, boxes, successes * RULES.HEALING.firstAid.boxesPerSuccess));
}

/** Natural healing: TN, hours per box from the successes, and the boxes healed in the hours rested. */
export function naturalHealing(opts: { track: 'physical' | 'stun'; boxes: number; successes: number; hours: number; timeFactor?: number }): { tn: number; hoursPerBox: number | null; boxes: number } {
  const n = RULES.HEALING.natural;
  const level = woundLevel(opts.boxes);
  const tn = level ? n.tnByLevel[level] : n.tnByLevel.L;
  if (opts.successes <= 0 || !level) return { tn, hoursPerBox: null, boxes: 0 };
  // v0.78.0: symbiotes shorten the time (RULES.BOOK_V78.symbiotes; a factor between 0.1 and 1).
  const factor = Math.min(1, Math.max(0.1, Number(opts.timeFactor ?? 1) || 1));
  const hoursPerBox = n.periodHours[opts.track] * factor / opts.successes;
  return { tn, hoursPerBox: Math.round(hoursPerBox * 100) / 100, boxes: Math.min(opts.boxes, Math.floor(Math.max(0, opts.hours) / hoursPerBox + 1e-9)) };
}

export function careModifiers(id: string): TargetNumberModifier[] {
  const c = RULES.HEALING.natural.care.find((x) => x.id === id);
  return c && c.tn ? [{ label: c.label, value: c.tn }] : [];
}

/** Whether a status stops a character acting. */
export function incapacitated(status: Status | string | undefined): boolean {
  // v0.59.0: a disrupted or banished spirit is gone from the fight too.
  return status === 'unconscious' || status === 'dying' || status === 'dead' || status === 'disrupted' || status === 'banished';
}

/** Foundry status ids for a condition (a disrupted or banished spirit shows as gone). */
export function conditionStatuses(status: Status | string | undefined): { unconscious: boolean; bleeding: boolean; dead: boolean } {
  return { unconscious: status === 'unconscious' || status === 'dying', bleeding: status === 'dying', dead: status === 'dead' || status === 'disrupted' || status === 'banished' };
}

/**
 * v0.59.0: a spirit's condition. It never bleeds out: a full Physical track disrupts it. A full Stun track
 * disrupts it too with RULES.SPIRITS_V59.disruptOn 'either'; otherwise it knocks it 'unconscious'. VERIFY
 */
export function spiritStatus(monitor: { physical: number; stun: number }, current: string): string {
  if (current === 'banished') return current;
  const full = RULES.MONITOR_BOXES;
  const on = RULES.SPIRITS_V59.disruptOn;
  if (monitor.physical >= full || (on === 'either' && monitor.stun >= full)) return 'disrupted';
  return monitor.stun >= full ? 'unconscious' : 'ok';
}

/** Whether a dying character takes another box this Combat Turn (every Body turns since dying began). */
export function dyingTick(roundsSince: number, body: number): boolean {
  // v0.80.0 (RULES.URR_V80.hsBleedMinutes): the Revamp's minutes of game time per box; 0 = the book's (Body) turns.
  const per = bleedTurnsPerBox(body);
  return roundsSince > 0 && roundsSince % per === 0;
}

export type ActionCost = 'free' | 'simple' | 'complex';

export function actionCost(kind: string): ActionCost {
  return own(RULES.ACTIONS.costs, kind) ?? 'simple';
}

/** Simple-action units: a complex action is two. */
export function actionUnits(cost: ActionCost): number {
  return cost === 'complex' ? 2 : cost === 'simple' ? 1 : 0;
}

/** Spending an action this phase: whether it fits, and how much is used after. */
export function spendAction(used: number, cost: ActionCost): { ok: boolean; used: number; left: number } {
  const per = RULES.ACTIONS.perPhase;
  const next = used + actionUnits(cost);
  return { ok: next <= per, used: next, left: Math.max(0, per - next) };
}

/** Describe what is left of a phase's actions. */
export function actionsLeftLabel(used: number): string {
  const left = Math.max(0, RULES.ACTIONS.perPhase - used);
  return left >= 2 ? tx('SR2E.Text.Core.aComplexActionOrTwo') : left === 1 ? tx('SR2E.Text.Core.oneSimpleAction') : tx('SR2E.Text.Core.noActionsFreeActions');
}

/** Initiative ordering: score, then the tie-break values in order, highest first. */
export function compareInitiative(a: { initiative: number | null; ties: number[] }, b: { initiative: number | null; ties: number[] }): number {
  const ia = a.initiative ?? -Infinity, ib = b.initiative ?? -Infinity;
  if (ia !== ib) return ib - ia;
  for (let i = 0; i < Math.max(a.ties.length, b.ties.length); i++) {
    const d = (b.ties[i] ?? 0) - (a.ties[i] ?? 0);
    if (d) return d;
  }
  return 0;
}

/** Surprise: given each combatant's successes and side, who is surprised. */
export function surprised(entries: ReadonlyArray<{ id: string; side: string; successes: number }>): string[] {
  return entries.filter((e) => {
    const best = Math.max(-1, ...entries.filter((o) => o.side !== e.side).map((o) => o.successes));
    return best >= 0 && e.successes < best;
  }).map((e) => e.id);
}
