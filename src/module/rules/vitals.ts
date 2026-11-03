import { RULES, type DamageLevel } from './config.ts';
import { reflexTypeOf, type Augmentation } from './cyberware.ts';
import { stageUp } from './damage.ts';
import type { Monitor } from './damage.ts';
import { overdoseStats } from './urr80-health-social.ts';
import { DAMAGE_LEVELS as LEVELS, sameCombatRound } from './util.ts';
import { t as tx, tCount } from '../helpers/i18n.ts';

/**
 * v0.72.0 health, cyberware and bioware (REVIEW-v0.69 O8–O12). Pure rules, no Foundry. Values in
 * RULES.HEALTH_V72 (rules/config72/health.ts); every function honours its switch so the old behaviour comes back.
 */

// v0.81.0: read through RULES (not the imported block), so a test or override that replaces RULES.HEALTH_V72 is seen.
const H = () => RULES.HEALTH_V72;
const asLevel = (v: unknown, fallback: DamageLevel): DamageLevel => (LEVELS.includes(v as DamageLevel) ? (v as DamageLevel) : fallback);

// ---------------------------------------------------------------- O8: drug doses and overdoses

/** One active drug on an actor (system.drugs), with the v0.72.0 dose count. */
export interface ActiveDrug {
  name: string;
  attributes?: Record<string, number>;
  reaction?: number;
  initiativeDice?: number;
  extra?: Record<string, unknown>;
  round: number;
  worldTime: number;
  /** v0.81.0: the combat `round` belongs to (absent: unknown, so the round is compared only by callers that don't name a combat). */
  combatId?: string;
  crashPower?: number;
  crashLevel?: string;
  /** v0.72.0: doses taken while this one was active (1 = a single dose). */
  doses?: number;
}

export interface OverdoseTest { name: string; power: number; level: DamageLevel; damageType: 'physical' | 'stun'; vector: string; dosesBefore: number; label: string }

/**
 * The overdose toxin for a dose taken while `dosesBefore` doses of the same drug are still active (null when the
 * overdose rule is off or nothing is active). `drug`: the drug item's toxin stats.
 */
export function overdoseTest(drug: { name: string; power?: number; level?: string; crashPower?: number; vector?: string }, dosesBefore: number): OverdoseTest | null {
  const o = H().drugs.overdose;
  const n = Math.max(0, Math.floor(Number(dosesBefore) || 0));
  if (!o.enabled || n <= 0) return null;
  const base = o.powerFrom === 'fixed' ? o.basePower
    : o.powerFrom === 'crash' ? (Number(drug.crashPower) > 0 ? Number(drug.crashPower) : o.basePower)
    : (Number(drug.power) > 0 ? Number(drug.power) : o.basePower);
  // v0.80.0 (RULES.URR_V80.hsOverdose 'urr', the URR): the second dose stages the level up one; each dose after +1 Power.
  const urrOd = overdoseStats(base, asLevel(o.level || drug.level, 'M'), n);
  const power = urrOd ? urrOd.power : Math.max(RULES.MIN_TARGET_NUMBER, Math.floor(base + o.powerPerExtraDose * n));
  let level = urrOd ? urrOd.level : asLevel(o.level || drug.level, 'M');
  if (!urrOd && o.stageUpEvery > 0) level = stageUp(level, Math.floor(n / o.stageUpEvery));
  return { name: `${drug.name} overdose`, power, level, damageType: o.type, vector: String(drug.vector || 'ingestion'), dosesBefore: n,
    label: tx('SR2E.Text.Vitals.resistOverdose', { name: drug.name, dose: n + 1 }) };
}

/**
 * A dose of a drug: what goes into system.drugs. `entry` is the new dose as takeDrug builds it today (its
 * `round` / `worldTime` are when a fresh dose would end); `seconds` its duration; `now` the world time and
 * `round` the combat round (null out of combat), v0.81.0 `combatId` that combat's id. With doses 'stack' (the old way) it is appended. Otherwise the
 * drug's active entry (same name) is replaced by one entry: the new dose's bonuses (tolerance may have
 * lowered them), `doses` + 1, ending at the later of the old end and the new end ('refresh') or the old end plus
 * a full duration ('extend'). `overdose` is the toxin to resist (null on a first dose or with the rule off);
 * `mode` says which happened.
 */
export function doseDrug<T extends ActiveDrug>(list: readonly T[], entry: T, o: { seconds: number; now: number; round: number | null; combatId?: string | null; drug?: { power?: number; level?: string; crashPower?: number; vector?: string } }): {
  list: T[]; index: number; doses: number; mode: 'new' | 'refresh' | 'extend' | 'stack'; overdose: OverdoseTest | null;
} {
  const mode = H().drugs.doses;
  const out = [...list];
  const idx = out.map((d) => d.name).lastIndexOf(entry.name);
  const active = idx >= 0 ? out[idx]! : null;
  const before = active ? Math.max(1, Math.floor(Number(active.doses) || 1)) : 0;
  const overdose = active ? overdoseTest({ name: entry.name, ...(o.drug ?? {}) }, before) : null;
  if (!active || mode === 'stack') {
    out.push({ ...entry, doses: 1 });
    // Review fix: 'stack' is the old way: no overdose either.
    return { list: out, index: out.length - 1, doses: active ? before + 1 : 1, mode: active ? 'stack' : 'new', overdose: null };
  }
  const secs = Math.max(0, Number(o.seconds) || 0);
  const turns = Math.max(1, Math.ceil(secs / Math.max(1, RULES.TOXINS.secondsPerTurn)));
  let worldTime: number;
  let round: number;
  let combatId: string | undefined;
  const perTurn = Math.max(1, RULES.TOXINS.secondsPerTurn);
  if (mode === 'extend') {
    worldTime = (active.worldTime >= 0 ? Math.max(active.worldTime, o.now) : o.now) + secs;
    // Review fix: in combat, the round limit follows the time still left on the first dose (taken in or out of combat).
    const leftTurns = active.worldTime >= 0 ? Math.max(0, Math.ceil((active.worldTime - o.now) / perTurn)) : 0;
    // v0.81.0: the first dose's round counts only if it was set in this same combat (util.ts sameCombatRound).
    const inCombat = o.round !== null && o.round !== undefined;
    round = inCombat
      ? (sameCombatRound(active, { round: o.round, combatId: o.combatId }) ? Math.max(active.round, o.round!) : o.round! + leftTurns) + turns
      : active.round >= 0 ? active.round + turns : entry.round;
    combatId = inCombat ? (o.combatId || undefined) : active.combatId;
  } else {
    worldTime = Math.max(active.worldTime, entry.worldTime);
    // Review fix: renewing in a combat counts from this round (not a round number left from an earlier combat).
    // v0.81.1 (RA2-9): and ends at the later of the two, as the world time does: the active dose's round when it was
    // set in this combat, else this round plus the turns its world time still has to run.
    const activeLeft = active.worldTime >= 0 ? Math.max(0, Math.ceil((active.worldTime - o.now) / perTurn)) : 0;
    const activeRound = sameCombatRound(active, { round: o.round, combatId: o.combatId }) ? active.round : (o.round ?? 0) + activeLeft;
    round = entry.round >= 0 ? Math.max(entry.round, activeRound) : active.round;
    combatId = entry.round >= 0 ? entry.combatId : active.combatId;
  }
  const merged = { ...active, ...entry, round, worldTime, doses: before + 1 } as T;
  if (combatId) merged.combatId = combatId; else delete merged.combatId;
  out[idx] = merged;
  return { list: out, index: idx, doses: before + 1, mode, overdose };
}

/**
 * The drug entries whose bonuses count: with doses 'stack' all of them (the old way); otherwise one per drug
 * name (the last), so entries doubled up before v0.72.0 stop adding twice.
 */
export function drugsForBonuses<T extends { name: string }>(list: readonly T[]): T[] {
  if (H().drugs.doses === 'stack') return [...list];
  const last = new Map<string, number>();
  list.forEach((d, i) => last.set(d.name, i));
  return list.filter((d, i) => last.get(d.name) === i);
}

// ---------------------------------------------------------------- O9: Shadowtech bioware

/** The bioware kinds v0.72.0 adds (always, for the item's choices: a saved item stays valid with the switch off). */
export function bioKindsV72(): string[] {
  return [...H().bioware.kinds];
}

/** The RULES.BIOWARE.effects-shaped spec for a v0.72.0 kind (undefined when off or not one of them). */
export function bioEffectSpecV72(kind: string): { attributes?: Record<string, number>; reaction?: number; initiativeDice?: number; perRating?: boolean } | undefined {
  const b = H().bioware;
  if (!b.enabled || !b.kinds.includes(kind)) return undefined;
  return b.effects[kind] ?? {};
}

export interface BioVitalItem { bioKind: string; rating: number; installed: boolean; damaged?: boolean }
export interface BioVitals { healingDice: number; /** v0.78.0: natural-healing time × (symbiotes, BOOK_V78.symbiotes 'time'); 1 = none. */ healingTimeFactor: number; bloodToxinDice: number; toxinVectors: string[]; breathTurns: number; lifestyleMultiplier: number; notes: string[] }

/** What installed, working symbiotes, nephritic screens and extended-volume lungs add up to (zeros when off). */
export function bioVitals(items: readonly BioVitalItem[]): BioVitals {
  const b = H().bioware;
  const out: BioVitals = { healingDice: 0, healingTimeFactor: 1, bloodToxinDice: 0, toxinVectors: [...b.vitals.nephriticScreen.vectors], breathTurns: 0, lifestyleMultiplier: 1, notes: [] };
  if (!b.enabled) return out;
  for (const i of items) {
    if (!i.installed || i.damaged) continue;
    const max = b.maxRating[i.bioKind] ?? 6;
    // Review fix: rating 0 does nothing, like every other bioware effect (bioEffect).
    const r = Math.min(max, Math.max(0, Math.floor(Number(i.rating) || 0)));
    if (r <= 0) continue;
    // v0.78.0 (RULES.BOOK_V78.symbiotes 'time', Shadowtech): symbiotes cut the healing time (90 / 70 / 50 %), not dice.
    if (i.bioKind === 'symbiotes' && RULES.BOOK_V78.symbiotes.mode === 'time') {
      const f = RULES.BOOK_V78.symbiotes.healingTimeFactor;
      out.healingTimeFactor = Math.min(out.healingTimeFactor, Number(f[Math.min(f.length, r) - 1] ?? 1));
    } else if (i.bioKind === 'symbiotes') out.healingDice += Math.floor(b.vitals.symbiotes.healingDice * r);
    else if (i.bioKind === 'nephriticScreen') out.bloodToxinDice += Math.floor(b.vitals.nephriticScreen.toxinDice * r);
    else if (i.bioKind === 'extendedVolume') out.breathTurns += Math.floor(b.vitals.extendedVolume.breathTurns * r);
    const lc = b.lifestyleCost[i.bioKind];
    if (lc && lc > 0) { out.lifestyleMultiplier *= lc; out.notes.push(`${i.bioKind}: lifestyle × ${lc}`); }
  }
  return out;
}

/** Nephritic-screen dice against a toxin of this vector (0 for other vectors). */
export function nephriticDice(v: Pick<BioVitals, 'bloodToxinDice' | 'toxinVectors'>, vector: string): number {
  return v.toxinVectors.includes(String(vector)) ? Math.max(0, v.bloodToxinDice) : 0;
}

/** Drowning or suffocation: Combat Turns that count after extended-volume lungs hold the breath longer. */
export function turnsWithoutAir(turns: number, breathTurns: number): number {
  return Math.max(0, Math.floor(Number(turns) || 0) - Math.max(0, Math.floor(Number(breathTurns) || 0)));
}

/** Body Index of a v0.72.0 bioware kind at a rating (null when not one of them). */
export function bioIndexV72(kind: string, rating: number): number | null {
  const b = H().bioware;
  const v = b.bodyIndex[kind];
  if (v === undefined) return null;
  const r = Math.max(1, Math.floor(Number(rating) || 1));
  if (Array.isArray(v)) return (v as readonly number[])[Math.min(v.length, r) - 1] ?? null;
  const n = Number(v);
  return Math.round((b.perRating.includes(kind) ? n * r : n) * 100) / 100;
}

// ---------------------------------------------------------------- O10: incompatible reflex systems

/**
 * After RULES.CYBERWARE.stacking (stackAugmentations): a working reflex system of a `drop` type gives no
 * Reaction or initiative dice while a working `with` type is installed (reaction enhancers with boosted
 * reflexes). Returns adjusted copies and a note per item. An item stacking already stripped doesn't count.
 */
export function incompatibleReflexes(cyber: readonly Augmentation[]): { cyber: Augmentation[]; notes: string[] } {
  const pairs = H().reflexes.incompatible ?? [];
  const live = (a: Augmentation) => a.installed && !a.damaged && ((a.reaction ?? 0) > 0 || (a.initiativeDice ?? 0) > 0);
  const notes: string[] = [];
  let out = [...cyber];
  for (const p of pairs) {
    const other = out.find((a) => live(a) && reflexTypeOf(a) === p.with);
    if (!other) continue;
    out = out.map((a) => {
      if (a === other || !live(a) || reflexTypeOf(a) !== p.drop) return a;
      notes.push(`${a.name ?? p.drop} does not work with ${other.name ?? p.with}`);
      return { ...a, reaction: 0, initiativeDice: 0 };
    });
  }
  return { cyber: out, notes };
}

// ---------------------------------------------------------------- O11: Companion edges and flaws

export interface HealthQuality { name: string; kind?: string; points?: number }
export interface QualityVitals {
  overflowBoxes: number;
  painIgnoreBoxes: number;
  painExtraBoxes: number;
  toughnessDice: number;
  toughnessOnStun: boolean;
  toughnessOnToxins: boolean;
  essenceMultiplier: number;
  bodyIndexMultiplier: number;
  sensitive: boolean;
  labels: string[];
}

const norm = (s: string) => String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
const matches = (name: string, list: readonly string[]) => list.some((m) => norm(name).includes(norm(m)));

/**
 * What a character's health edges and flaws do (all zero / ×1 when off). `qualitiesOn`: whether
 * RULES.STREET.qualities.enabled (they only work then, with `needsQualitiesOn`).
 */
export function qualityVitals(list: readonly HealthQuality[] | null | undefined, qualitiesOn = true): QualityVitals {
  const q = H().qualities;
  const out: QualityVitals = { overflowBoxes: 0, painIgnoreBoxes: 0, painExtraBoxes: 0, toughnessDice: 0, toughnessOnStun: q.toughness.onStun, toughnessOnToxins: q.toughness.onToxins, essenceMultiplier: 1, bodyIndexMultiplier: 1, sensitive: false, labels: [] };
  if (!q.enabled || (q.needsQualitiesOn && !qualitiesOn)) return out;
  const levels = (pts: unknown, per: number, max: number) => Math.min(Math.max(1, max), Math.max(1, Math.floor((Number(pts) || 0) / Math.max(1, per))));
  for (const x of list ?? []) {
    const name = String(x?.name ?? '');
    if (!name) continue;
    if (matches(name, q.willToLive.match)) {
      const n = levels(x.points, q.willToLive.pointsPerLevel, q.willToLive.maxLevels) * q.willToLive.boxesPerLevel;
      out.overflowBoxes += n; out.labels.push(tx('SR2E.Text.Vitals.willToLive', { n }));
    } else if (matches(name, q.lowPainTolerance.match)) {
      out.painExtraBoxes += q.lowPainTolerance.extraBoxes; out.labels.push(tx('SR2E.Text.Vitals.lowPainTolerance', { boxes: q.lowPainTolerance.extraBoxes }));
    } else if (matches(name, q.highPainTolerance.match)) {
      const n = levels(x.points, q.highPainTolerance.pointsPerLevel, q.highPainTolerance.maxLevels) * q.highPainTolerance.boxesPerLevel;
      out.painIgnoreBoxes += n; out.labels.push(tCount(n, 'SR2E.Text.Vitals.painToleranceIgnores'));
    } else if (matches(name, q.toughness.match)) {
      out.toughnessDice += q.toughness.dice; out.labels.push(tx('SR2E.Text.Vitals.toughness', { dice: q.toughness.dice }));
    } else if (matches(name, q.sensitiveSystem.match)) {
      out.sensitive = true;
      out.essenceMultiplier = Math.max(out.essenceMultiplier, q.sensitiveSystem.essenceMultiplier);
      out.bodyIndexMultiplier = Math.max(out.bodyIndexMultiplier, q.sensitiveSystem.bodyIndexMultiplier);
      out.labels.push(tx('SR2E.Text.Vitals.sensitiveSystem', { multiplier: q.sensitiveSystem.essenceMultiplier }));
    }
  }
  return out;
}

/** The Body that counts for the Overflow row and the death check: Body + Will to Live boxes. */
export function overflowBody(body: number, v: Pick<QualityVitals, 'overflowBoxes'>): number {
  return Math.max(0, Math.floor(Number(body) || 0)) + Math.max(0, v.overflowBoxes);
}

/**
 * The monitor as wound modifiers see it after pain tolerance: High Pain Tolerance boxes off each track (as a
 * damage compensator), and Low Pain Tolerance boxes added to each track that has any damage.
 */
export function painToleranceMonitor(m: Monitor, v: Pick<QualityVitals, 'painIgnoreBoxes' | 'painExtraBoxes'>): Monitor {
  const t = (n: number) => {
    const b = Math.max(0, Number(n) || 0);
    return b > 0 ? Math.max(0, b + Math.max(0, v.painExtraBoxes) - Math.max(0, v.painIgnoreBoxes)) : 0;
  };
  return { physical: t(m.physical), stun: t(m.stun) };
}

/** Toughness dice for a resistance test: 'physical' / 'stun' damage, or a 'toxin'. */
export function toughnessDice(v: Pick<QualityVitals, 'toughnessDice' | 'toughnessOnStun' | 'toughnessOnToxins'>, what: 'physical' | 'stun' | 'toxin'): number {
  if (!(v.toughnessDice > 0)) return 0;
  if (what === 'stun' && !v.toughnessOnStun) return 0;
  if (what === 'toxin' && !v.toughnessOnToxins) return 0;
  return v.toughnessDice;
}

/** A cyberware item's Essence cost before grade with Sensitive System (bioware and housed items are left alone). */
export function sensitiveEssence(cost: number, v: Pick<QualityVitals, 'essenceMultiplier'>): number {
  return Math.round(Math.max(0, Number(cost) || 0) * Math.max(1, v.essenceMultiplier) * 100) / 100;
}

/** A bioware item's Body Index with Sensitive System. */
export function sensitiveBodyIndex(index: number, v: Pick<QualityVitals, 'bodyIndexMultiplier'>): number {
  return Math.round(Math.max(0, Number(index) || 0) * Math.max(1, v.bodyIndexMultiplier) * 100) / 100;
}

/**
 * The rejection TN with Sensitive System: `normal` (implants.rejectionTn: null under the limit) when it is set,
 * else, with `rejectionAlways` and any bioware, RULES.BIOWARE.rejection.tn + `rejectionTnBonus`.
 */
export function sensitiveRejectionTn(normal: number | null, bodyIndexUsed: number, v: Pick<QualityVitals, 'sensitive'>): number | null {
  const s = H().qualities.sensitiveSystem;
  if (!v.sensitive || !s.rejectionAlways || !RULES.BIOWARE.rejection.enabled || !(bodyIndexUsed > 0)) return normal;
  const tn = Math.max(2, RULES.BIOWARE.rejection.tn + s.rejectionTnBonus);
  return normal === null ? tn : Math.max(normal, tn);
}

// ---------------------------------------------------------------- O12: heat and electricity

/** Heat exposure: Body vs the severity's TN, Stun by default (null when switched off). */
export function heatTest(severity: string): { tn: number; level: DamageLevel; type: 'physical' | 'stun'; label: string; attribute: 'body' | 'willpower' } | null {
  const h = H().hazards.heat;
  if (!h.enabled) return null;
  const sv = h.severities.find((x) => x.id === severity) ?? h.severities[0]!;
  return { tn: sv.tn, level: h.level, type: h.type, label: `Heat: ${sv.label}`, attribute: h.attribute };
}

/** Whether fire immunity stops heat exposure too. */
export function heatStoppedByFireImmunity(): boolean {
  return Boolean(H().hazards.heat.fireImmune);
}

/**
 * An electric shock: Power, level and type by source (or `custom` Power / level / type), the armor that counts
 * (armorKind × armorFraction, + insulation), and whether the elemental shock test follows. Null when off.
 */
export function electricShock(source: string, armor: { impact: number; ballistic: number }, o: { insulation?: number; custom?: { power: number; level: DamageLevel; type?: 'physical' | 'stun' } } = {}): {
  power: number; level: DamageLevel; type: 'physical' | 'stun'; armor: number; label: string; shock: boolean;
} | null {
  const e = H().hazards.electricity;
  if (!e.enabled) return null;
  const s = o.custom ? { label: tx('SR2E.Text.Vitals.electricShock'), power: o.custom.power, level: o.custom.level, type: o.custom.type ?? 'stun' } : (e.sources.find((x) => x.id === source) ?? e.sources[0]!);
  const worn = Math.floor(Math.max(0, Number(armor[e.armorKind]) || 0) * e.armorFraction);
  return { power: Math.max(0, Math.floor(s.power)), level: asLevel(s.level, 'M'), type: s.type, armor: worn + Math.max(0, Math.floor(Number(o.insulation) || 0)), label: s.label, shock: Boolean(e.shockEffect) };
}
