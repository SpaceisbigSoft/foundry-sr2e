import { RULES, type CyberGrade } from './config.ts';
import type { Attributes } from './stats.ts';
import { urrCoreEssenceRound } from './urr80-core.ts';
import { round2, own } from './util.ts';
import { t as tx } from '../helpers/i18n.ts';

export type AttributeBonuses = Partial<Record<keyof Attributes, number>>;

export interface Augmentation {
  /** Essence cost before grade. */
  essenceCost: number;
  grade: CyberGrade;
  /** Uninstalled items (in a stash, switched off) contribute nothing. */
  installed: boolean;
  /** v0.54.0: whether its Essence is gone (true from implant, while it still heals in; defaults to `installed`). */
  essenceCounted?: boolean;
  attributes?: AttributeBonuses;
  reaction?: number;
  initiativeDice?: number;
  /** v0.29.0: the reflex system it is (wired, boosted, enhancer), its name (to guess that), and whether it is damaged. */
  reflexes?: string;
  name?: string;
  damaged?: boolean;
}

/** Essence actually lost to one item after its grade multiplier. */
export function essenceLoss(item: Pick<Augmentation, 'essenceCost' | 'grade'>): number {
  return round2(Math.max(0, item.essenceCost) * RULES.GRADE_ESSENCE_MULTIPLIER[item.grade]);
}

export function totalEssenceLoss(items: readonly Augmentation[]): number {
  return round2(items.filter((i) => i.essenceCounted ?? i.installed).reduce((sum, i) => sum + essenceLoss(i), 0));
}

/** Current Essence: starting Essence minus losses, never below 0. */
export function currentEssence(baseEssence: number, items: readonly Augmentation[]): number {
  return Math.max(0, round2(baseEssence - totalEssenceLoss(items)));
}

/**
 * Magic after Essence loss. Non-magical characters (Magic 0) stay at 0. 'cap' (default): at most
 * current Essence rounded up; 'reduce': minus every point (or part of one) of Essence lost from `baseEssence`.
 */
export function effectiveMagic(baseMagic: number, essence: number, baseEssence = 6): number {
  if (baseMagic <= 0) return 0;
  if (!RULES.MAGIC_CAPPED_BY_ESSENCE) return baseMagic;
  if (RULES.MAGIC_ESSENCE_MODE === 'reduce') return Math.max(0, baseMagic - Math.ceil(Math.max(0, round2(baseEssence - essence))));
  // v0.80.0 (RULES.URR_V80.coreEssenceFloor): Essence rounded down caps Magic (book: rounded up).
  return Math.min(baseMagic, urrCoreEssenceRound(essence));
}

export interface AugmentationBonuses {
  attributes: Required<AttributeBonuses>;
  reaction: number;
  initiativeDice: number;
}

/** Sum the bonuses of all installed items. */
export function sumBonuses(items: readonly Augmentation[]): AugmentationBonuses {
  const total: AugmentationBonuses = {
    attributes: { body: 0, quickness: 0, strength: 0, charisma: 0, intelligence: 0, willpower: 0 },
    reaction: 0,
    initiativeDice: 0,
  };
  for (const item of items) {
    if (!item.installed || item.damaged) continue;
    for (const key of Object.keys(total.attributes) as (keyof typeof total.attributes)[]) {
      total.attributes[key] += item.attributes?.[key] ?? 0;
    }
    total.reaction += item.reaction ?? 0;
    total.initiativeDice += item.initiativeDice ?? 0;
  }
  return total;
}

// ---------------------------------------------------------------- Cyberware depth (v0.29.0)

const CW = () => RULES.CYBERWARE;

/** The reflex system an item is: its own field, else guessed from its name. */
export function reflexTypeOf(item: { reflexes?: string; name?: string }): string {
  if (item.reflexes) return item.reflexes;
  const n = String(item.name ?? '').toLowerCase();
  if (/wired\s*reflex/.test(n)) return 'wired';
  if (/boosted\s*reflex/.test(n)) return 'boosted';
  if (/reaction\s*enhanc/.test(n)) return 'enhancer';
  return '';
}

/**
 * Stacking: of the installed reflex systems in RULES.CYBERWARE.stacking.exclusive, only the one with
 * the most initiative dice keeps its Reaction and dice; with `adeptExclusive`, adept reflex powers
 * compete with it too (the better one counts). Returns adjusted copies and a note per dropped item.
 */
export function stackAugmentations(cyber: readonly Augmentation[], adept: readonly Augmentation[]): { cyber: Augmentation[]; adept: Augmentation[]; notes: string[] } {
  const st = CW().stacking;
  const live = (a: Augmentation) => a.installed && !a.damaged;
  const ex = cyber.filter((a) => live(a) && st.exclusive.includes(reflexTypeOf(a)) && ((a.initiativeDice ?? 0) > 0 || (a.reaction ?? 0) > 0));
  const score = (a: Augmentation) => (a.initiativeDice ?? 0) * 100 + (a.reaction ?? 0);
  const best = [...ex].sort((x, y) => score(y) - score(x))[0] ?? null;
  const notes: string[] = [];
  const strip = (a: Augmentation): Augmentation => ({ ...a, reaction: 0, initiativeDice: 0 });
  let outCyber = cyber.map((a) => (ex.includes(a) && a !== best ? (notes.push(tx('SR2E.Text.Cyberware.doesNotStackWith', { name: a.name ?? tx('SR2E.Text.Cyberware.reflexes'), best: best?.name ?? tx('SR2E.Text.Cyberware.anotherReflexSystem') })), strip(a)) : a));
  let outAdept = [...adept];
  const adeptDice = adept.reduce((n, a) => n + (a.installed ? a.initiativeDice ?? 0 : 0), 0);
  if (st.adeptExclusive && best && adeptDice > 0) {
    if ((best.initiativeDice ?? 0) >= adeptDice) {
      outAdept = adept.map((a) => ((a.initiativeDice ?? 0) > 0 ? strip(a) : a));
      notes.push(tx('SR2E.Text.Cyberware.adeptReflexesDoNotStack', { name: best.name ?? tx('SR2E.Text.Cyberware.cyberReflexes') }));
    } else {
      outCyber = outCyber.map((a) => (a === best ? strip(a) : a));
      notes.push(tx('SR2E.Text.Cyberware.doNotStackWithAdept', { name: best.name ?? tx('SR2E.Text.Cyberware.cyberReflexesCap') }));
    }
  }
  return { cyber: outCyber, adept: outAdept, notes };
}

/** Initiative dice after the cap (RULES.CYBERWARE.stacking.maxInitiativeDice). */
export function capInitiativeDice(dice: number): { dice: number; capped: boolean } {
  const max = CW().stacking.maxInitiativeDice;
  return dice > max ? { dice: max, capped: true } : { dice, capped: false };
}

/** The smartlink TN modifier for a smartlink level (0 = none). */
export function smartlinkModifier(level: number): number {
  if (!(level > 0)) return 0;
  const t = CW().smartlink;
  // `?? -2`: a guard for an override missing the rows (the shipped smartlink table always has them).
  return t[Math.min(2, Math.floor(level))] ?? t[1] ?? -2;
}

const BANDS = ['short', 'medium', 'long', 'extreme'] as const;
/** Vision magnification: the range band moves closer by its level (never past short). */
export function magnifiedRange<T extends string>(band: T, level: number): T {
  const i = (BANDS as readonly string[]).indexOf(band);
  if (i < 0 || !(level > 0)) return band;
  const steps = Math.min(CW().magnification.maxLevel, Math.floor(level)) * CW().magnification.bandsPerLevel;
  return BANDS[Math.max(0, i - steps)] as unknown as T;
}

/** Tailored pheromones: extra dice for a social skill. */
export function pheromoneDice(skillName: string, rating: number): number {
  if (!(rating > 0)) return 0;
  const p = CW().pheromones;
  const n = String(skillName ?? '').toLowerCase();
  return p.skills.some((s) => n.startsWith(s.toLowerCase())) ? Math.floor(rating * p.dicePerRating) : 0;
}

/** Whether decking or rigging may go ahead without a datajack: 'ok', 'warn' or 'block'. */
export function datajackCheck(what: 'decking' | 'rigging', hasDatajack: boolean): 'ok' | 'warn' | 'block' {
  if (hasDatajack) return 'ok';
  const m = CW().datajack[what];
  return m === 'off' ? 'ok' : m;
}

/** A cyberlimb's capacity used by the items housed in it (their Essence costs after grade). */
export function limbCapacity(capacity: number, housed: ReadonlyArray<Pick<Augmentation, 'essenceCost' | 'grade'>>): { used: number; capacity: number; over: boolean } {
  const used = round2(housed.reduce((n, h) => n + essenceLoss(h), 0));
  return { used, capacity, over: used > capacity };
}

/** Nuyen cost after the grade multiplier. */
export function cyberCost(cost: number, grade: string): number {
  return Math.round(Math.max(0, cost) * (own(CW().gradeCost, grade) ?? 1));
}

/** A skillsoft (chip) as the wearer can use it. */
export interface Skillsoft { name: string; kind: string; skill: string; rating: number; slotted: boolean }
export interface SoftWiring { skillwires: number; chipjack: boolean; datajack: boolean }

/** The rating a slotted chip actually gives, and why not if it gives none. */
export function softRating(chip: Skillsoft, w: SoftWiring): { rating: number; reason: string } {
  if (!chip.slotted) return { rating: 0, reason: tx('SR2E.Text.Cyberware.notSlotted') };
  if (!(w.chipjack || w.datajack)) return { rating: 0, reason: tx('SR2E.Text.Cyberware.noChipjackOrDatajack') };
  if (chip.kind === 'activesoft') {
    if (!(w.skillwires > 0)) return { rating: 0, reason: tx('SR2E.Text.Cyberware.noSkillwires') };
    return { rating: Math.min(chip.rating, w.skillwires), reason: chip.rating > w.skillwires ? tx('SR2E.Text.Cyberware.cappedAtSkillwires', { skillwires: w.skillwires }) : '' };
  }
  return { rating: Math.max(0, chip.rating), reason: '' };
}

/**
 * v0.78.0 (RULES.BOOK_V78.senseAllowance, Core Rules): the Essence of cybereyes or cyberears with enhancements
 * built in. Cybereyes take enhancements up to `eyesFree` Essence at no further cost; cyberears take `earsFeatures`
 * feature(s) of at most `earsMaxEach` Essence free (the largest that fit). Without the replacement eyes or ears
 * (`host` false: retinal or ear modifications), every option costs in full.
 */
export function sensoryEssence(kind: 'eyes' | 'ears', o: { base: number; options: readonly number[]; host: boolean }): number {
  const A = RULES.BOOK_V78.senseAllowance;
  const opts = (o.options ?? []).map((x) => Math.max(0, Number(x) || 0));
  const sum = opts.reduce((n, x) => n + x, 0);
  const base = Math.max(0, Number(o.base) || 0);
  let cost = base + sum;
  if (A.enabled && o.host) {
    if (kind === 'eyes') cost = base + Math.max(0, sum - A.eyesFree);
    else {
      const free = opts.filter((x) => x <= A.earsMaxEach + 1e-9).sort((a, b) => b - a).slice(0, Math.max(0, A.earsFeatures));
      cost = base + sum - free.reduce((n, x) => n + x, 0);
    }
  }
  return Math.round(cost * 100) / 100;
}
