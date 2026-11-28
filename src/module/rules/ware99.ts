/**
 * v0.99.0 rules completeness, cyberware and bioware effects (RULES.WARE_V99, rules/config99/ware.ts). Pure rules, no
 * Foundry: boosted reflexes against wired reflexes and a control rig (SSC p. 87), cyberlimb Strength and Quickness
 * (Cybertechnology pp. 49–51), recovery after bioware surgery (Shadowtech p. 6), the trauma damper on Stun (Shadowtech
 * p. 29), orthoskin against dermal plating (Shadowtech p. 17). Refusals and notes are language keys (SR2E.Ware99.*).
 */
import { RULES } from './config.ts';
import { reflexTypeOf } from './cyberware.ts';
import { bioEffect } from './bioware.ts';
import { gearBook, isDermalPlating, dermalRating, isNeuralBio } from './gear923.ts';
import { num, round2 } from './util.ts';
import { tKey } from '../helpers/i18n.ts';

type W = typeof RULES.WARE_V99;
type Switch = { [K in keyof W]: W[K] extends 'book' | 'v980' ? K : never }[keyof W];

/** Whether a WARE_V99 switch is at the book's way. */
export function w99(key: Switch): boolean {
  return (RULES as any).WARE_V99?.[key] === 'book';
}
const V = (): W => RULES.WARE_V99;
const whole = (x: unknown): number => Math.max(0, Math.floor(num(x)));

/** A cyberware item as these rules read it (an item document or plain data). */
export interface Ware99 { id?: string; name?: string; type?: string; system?: Record<string, any> }

// ---------------------------------------------------------------- What an item is

export type WareClass99 = 'boosted' | 'wired' | 'vcr' | 'orthoskin' | 'plating' | '';

const VCR_RE = /control\s*rig|\bvcr\b/i;
const ORTHO_RE = /orthoskin/i;

/** Which of the exclusive kinds an item is ('' none): a control rig by its level or name, reflexes by their type. */
export function wareClass(i: Ware99): WareClass99 {
  if (i?.type && i.type !== 'cyberware') return '';
  const s = i?.system ?? {};
  const name = String(i?.name ?? '');
  if (s['bioware']) return s['bioKind'] === 'orthoskin' || ORTHO_RE.test(name) ? 'orthoskin' : '';
  if (isDermalPlating({ name, bioware: false, kind: String(s['kind'] ?? '') })) return 'plating';
  if (num(s['controlRig']) > 0 || VCR_RE.test(name)) return 'vcr';
  const r = reflexTypeOf({ reflexes: String(s['reflexes'] ?? ''), name });
  return r === 'boosted' || r === 'wired' ? r : '';
}

/** The pairs that may not be installed together, each under its switch. */
const PAIRS: ReadonlyArray<{ a: WareClass99; b: WareClass99; sw: Switch; key: string }> = [
  { a: 'boosted', b: 'wired', sw: 'boosted', key: 'boostedWired' },
  { a: 'boosted', b: 'vcr', sw: 'boosted', key: 'boostedVcr' },
  { a: 'orthoskin', b: 'plating', sw: 'orthoskin', key: 'orthoPlating' },
];
const PAIR_KEY = (k: string): string => `SR2E.Ware99.Refuse.${k}`;
const NOTE_KEY = (k: string): string => `SR2E.Ware99.Note.${k}`;

/**
 * Installing `item` beside the other installed cyberware and bioware `others`: the refusal (a language key and the
 * other item's name), or null when it may go in.
 */
export function installClash(item: Ware99, others: readonly Ware99[]): { why: string; other: string } | null {
  const c = wareClass(item);
  if (!c) return null;
  for (const p of PAIRS) {
    if (!w99(p.sw) || (c !== p.a && c !== p.b)) continue;
    const want = c === p.a ? p.b : p.a;
    const o = others.find((x) => x !== item && (!item.id || x.id !== item.id) && Boolean(x.system?.['installed']) && wareClass(x) === want);
    if (o) return { why: PAIR_KEY(p.key), other: String(o.name ?? '') };
  }
  return null;
}

/** Sheet notes for pairs a character already has installed (language key + names); none under 'v980'. */
export function pairNotes(items: readonly Ware99[]): Array<{ key: string; a: string; b: string }> {
  const on = items.filter((i) => Boolean(i.system?.['installed']));
  const out: Array<{ key: string; a: string; b: string }> = [];
  for (const p of PAIRS) {
    if (!w99(p.sw) || p.sw === 'orthoskin') continue;
    const a = on.find((i) => wareClass(i) === p.a);
    const b = on.find((i) => wareClass(i) === p.b);
    if (a && b) out.push({ key: NOTE_KEY(p.key), a: String(a.name ?? ''), b: String(b.name ?? '') });
  }
  return out;
}

// ---------------------------------------------------------------- Orthoskin and dermal plating (Shadowtech p. 17)

/** Orthoskin's armor (impact + ballistic) at its level, as bioEffect works it out. */
export function orthoskinArmor(i: Ware99): number {
  const s = i.system ?? {};
  const e = bioEffect({ name: String(i.name ?? ''), bioKind: 'orthoskin', rating: num(s['rating']), installed: true, damaged: false });
  return e.impact + e.ballistic;
}

/**
 * Orthoskin and dermal plating both working (installed, not damaged, not healing in): only the better counts. The
 * plating's Body counts against both kinds of damage (2 × rating); orthoskin's armor is its impact + ballistic; the
 * plating wins a tie. Null when the rule is off, the plating is armor (GEAR_V923.dermal 'armor'), or not both are in.
 */
export function orthoPlating(items: readonly Ware99[], healing: ReadonlySet<string> = new Set()): { drop: Set<string>; better: string; worse: string; key: string } | null {
  if (!w99('orthoskin') || !gearBook('dermal')) return null;
  const live = items.filter((i) => Boolean(i.system?.['installed']) && !i.system?.['damaged'] && !(i.id && healing.has(i.id)));
  const ortho = live.filter((i) => wareClass(i) === 'orthoskin');
  const plating = live.filter((i) => wareClass(i) === 'plating');
  if (!ortho.length || !plating.length) return null;
  const bestOrtho = [...ortho].sort((a, b) => orthoskinArmor(b) - orthoskinArmor(a))[0]!;
  const bestPlate = [...plating].sort((a, b) => dermalRating(b.system ?? {}) - dermalRating(a.system ?? {}))[0]!;
  const plateWins = 2 * dermalRating(bestPlate.system ?? {}) >= orthoskinArmor(bestOrtho);
  const losers = plateWins ? ortho : plating;
  return {
    drop: new Set(losers.map((i) => String(i.id ?? i.name ?? ''))),
    better: String((plateWins ? bestPlate : bestOrtho).name ?? ''),
    worse: String((plateWins ? bestOrtho : bestPlate).name ?? ''),
    key: NOTE_KEY('orthoPlating'),
  };
}

/** Whether `i` is the losing side of orthoPlating's result. */
export function droppedBy(o: ReturnType<typeof orthoPlating>, i: Ware99): boolean {
  return Boolean(o && o.drop.has(String(i.id ?? i.name ?? '')));
}

// ---------------------------------------------------------------- Cyberlimbs (Cybertechnology pp. 49–51)

const PARTIAL_RE = /hand|foot|feet|fore\s*-?arm|lower\s*(?:arm|leg)|partial/i;
const FULL_LOCATIONS = ['leftArm', 'rightArm', 'leftLeg', 'rightLeg'] as const;

export const isTroll = (metatype: unknown): boolean => String(metatype ?? '').toLowerCase() === 'troll';
export const isPartialLimb = (name: unknown): boolean => PARTIAL_RE.test(String(name ?? ''));

/** A cyberlimb's built-in Strength and Quickness for this metatype (p. 49; trolls p. 51). */
export function limbBase(metatype: unknown): { strength: number; quickness: number } {
  return { strength: whole(isTroll(metatype) ? V().limbStrengthTroll : V().limbStrength), quickness: whole(V().limbQuickness) };
}

/**
 * A cyberlimb's own Strength and Quickness and the Essence its enhancements cost (the limb's fields as entered under
 * 'v980', no Essence). Book: at least the built-in ratings; a full limb's points past the free ones cost Essence.
 */
export function limbStats(limb: Ware99, metatype: unknown): { strength: number; quickness: number; essence: number } {
  const l = limb.system?.['limb'] ?? {};
  const fs = num(l.strength);
  const fq = num(l.quickness);
  if (!w99('limbs')) return { strength: l.strength ?? 0, quickness: l.quickness ?? 0, essence: 0 };
  const base = limbBase(metatype);
  const strength = Math.max(base.strength, whole(fs));
  const quickness = Math.max(base.quickness, whole(fq));
  if (isPartialLimb(limb.name)) return { strength, quickness, essence: 0 };
  const freeS = whole(isTroll(metatype) ? V().limbFreePointsTroll : V().limbFreePoints);
  const freeQ = whole(V().limbFreePoints);
  const essence = round2(Math.max(0, strength - base.strength - freeS) * Math.max(0, num(V().limbStrengthEssence))
    + Math.max(0, quickness - base.quickness - freeQ) * Math.max(0, num(V().limbQuicknessEssence)));
  return { strength, quickness, essence };
}

/** A cyberlimb item's Essence cost with its enhancements (the cost as entered for anything else, or under 'v980'). */
export function limbEssenceCost(cost: number, i: Ware99, metatype: unknown): number {
  if (!w99('limbs') || i.system?.['kind'] !== 'cyberlimb' || i.system?.['bioware']) return cost;
  const extra = limbStats(i, metatype).essence;
  return extra > 0 ? round2(num(cost) + extra) : cost;
}

/** The four limbs' average of a rating, round down: a full cyberlimb's own at its place, else the natural one. */
export function fourLimbAverage(limbs: ReadonlyArray<{ name?: string; location?: string; strength?: number; quickness?: number }>, natural: number, key: 'strength' | 'quickness'): number {
  let sum = 0;
  for (const loc of FULL_LOCATIONS) {
    const l = limbs.find((x) => x.location === loc && !isPartialLimb(x.name));
    sum += l ? whole(l[key]) : whole(natural);
  }
  return Math.floor(sum / FULL_LOCATIONS.length);
}

/**
 * The cap on the four limbs' average augmented ratings (pp. 50–51): Strength at most twice the natural Body or Body + 4,
 * Quickness at most twice the natural Quickness or Quickness + 4, whichever is lower. Notes (key, rating, average, cap).
 */
export function limbCapNotes(limbs: ReadonlyArray<{ name?: string; location?: string; strength?: number; quickness?: number }>, o: { strength: number; quickness: number; body: number; naturalQuickness: number }): Array<{ key: string; average: number; cap: number }> {
  if (!w99('limbs') || !limbs.some((l) => !isPartialLimb(l.name) && (FULL_LOCATIONS as readonly string[]).includes(String(l.location)))) return [];
  const cap = (r: number) => Math.min(2 * whole(r), whole(r) + 4);
  const out: Array<{ key: string; average: number; cap: number }> = [];
  const s = fourLimbAverage(limbs, o.strength, 'strength');
  if (s > cap(o.body)) out.push({ key: NOTE_KEY('limbStrengthCap'), average: s, cap: cap(o.body) });
  const q = fourLimbAverage(limbs, o.quickness, 'quickness');
  if (q > cap(o.naturalQuickness)) out.push({ key: NOTE_KEY('limbQuicknessCap'), average: q, cap: cap(o.naturalQuickness) });
  return out;
}

/** Leading with a cyberlimb in melee (p. 50): + (its Strength − the four limbs' average) TN; 0 under 'v980'. */
export function limbLeadTn(limbStrength: number, average: number): number {
  if (!w99('limbLead')) return 0;
  return Math.max(0, whole(limbStrength) - whole(average));
}

// ---------------------------------------------------------------- Bioware recovery (Shadowtech p. 6)

/** Recovery days after surgery for this item: bioware × 3, cultured (or neural, always cultured) × 2, rounded up. */
export function bioRecoveryDays(base: number | null, item: { bioware?: boolean; cultured?: boolean; bioKind?: string } | null | undefined, name = ''): number | null {
  if (base === null || !w99('bioRecovery') || !item?.bioware) return base;
  const cultured = Boolean(item.cultured) || (gearBook('cultured') && isNeuralBio(String(item.bioKind ?? ''), name));
  const f = Math.max(1, num(cultured ? V().bioRecoveryCultured : V().bioRecoveryFactor));
  return Math.max(1, Math.ceil(base * f - 1e-9));
}

// ---------------------------------------------------------------- Trauma damper on Stun (Shadowtech p. 29)

/**
 * The boxes a trauma damper takes off a Stun wound. 'v980': `old` (the rating-scaled boxes). Book: 1 with a working
 * damper, none with a pain editor, none while a damage compensator's boxes are not yet exceeded on both tracks.
 */
export function damperStunCut(old: number, o: { damper: boolean; painEditor: boolean; compensatorBoxes?: number; after: { physical: number; stun: number } }): number {
  if (!w99('damper')) return old;
  if (!o.damper || o.painEditor) return 0;
  const comp = whole(o.compensatorBoxes);
  if (comp > 0 && !(num(o.after.physical) > comp && num(o.after.stun) > comp)) return 0;
  return 1;
}

// ---------------------------------------------------------------- Sheet notes

/** The sheet's warnings for ware installed together that may not be (boosted reflexes, orthoskin and plating). */
export function wareNotes(items: readonly Ware99[], healing: ReadonlySet<string> = new Set()): string[] {
  const out = pairNotes(items).map((n) => tKey(n.key, { a: n.a, b: n.b }));
  const op = orthoPlating(items, healing);
  if (op) out.push(tKey(op.key, { better: op.better, worse: op.worse }));
  return out;
}

/** The sheet's warnings for the four limbs' averages over the cap. */
export function limbCapText(limbs: Parameters<typeof limbCapNotes>[0], o: Parameters<typeof limbCapNotes>[1]): string[] {
  return limbCapNotes(limbs, o).map((n) => tKey(n.key, { average: n.average, cap: n.cap }));
}
