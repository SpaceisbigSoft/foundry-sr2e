import { RULES } from './config.ts';
import type { TargetNumberModifier } from './dice.ts';
import { num, round2 } from './util.ts';
import { t as tx } from '../helpers/i18n.ts';

/**
 * v0.58.0: gear rules (Essence holes, filtration, bone lacing, surveillance, optics, legality,
 * token visibility). Pure functions over RULES.GEAR_V58; no Foundry dependency.
 */

const G = () => RULES.GEAR_V58;

// ---------------------------------------------------------------- Essence holes

/** v0.58.0: the Essence hole after removing an item that cost `removedLoss` Essence (the loss stays lost). */
export function essenceHoleAfterRemoval(hole: number, removedLoss: number): number {
  return round2(Math.max(0, num(hole)) + Math.max(0, num(removedLoss)));
}

/**
 * v0.58.0: installing an item that costs `addedLoss` Essence fills the hole first.
 * `fromHole` is the part of the new item's loss the hole covers; `hole` is what is left of the hole.
 */
export function essenceHoleAfterInstall(hole: number, addedLoss: number): { hole: number; fromHole: number } {
  const h = Math.max(0, num(hole));
  const add = Math.max(0, num(addedLoss));
  const fromHole = round2(Math.min(h, add));
  return { hole: round2(h - fromHole), fromHole };
}

/**
 * v0.58.0: current Essence with a hole: base minus installed losses minus the hole (when
 * essenceHoles is enabled; otherwise the hole is ignored). Never below 0.
 */
export function essenceWithHole(baseEssence: number, installedLoss: number, hole: number): number {
  const loss = Math.max(0, num(installedLoss));
  const h = G().essenceHoles.enabled ? Math.max(0, num(hole)) : 0;
  return Math.max(0, round2(num(baseEssence) - loss - h));
}

// ---------------------------------------------------------------- Filtration

/**
 * v0.58.0: dice from filtration systems against a toxin of `vector`: the highest rating among
 * working filters (working defaults to true) whose kind covers the vector. Filters don't stack.
 */
export function filtrationDice(filters: ReadonlyArray<{ kind: string; rating: number; working?: boolean }>, vector: string): number {
  const kinds = G().filtration.kinds;
  let best = 0;
  for (const f of filters ?? []) {
    if (f.working === false) continue;
    const k = kinds.find((x) => x.id === f.kind);
    if (!k || !k.vectors.includes(vector)) continue;
    best = Math.max(best, Math.max(0, num(f.rating)));
  }
  return best;
}

// ---------------------------------------------------------------- Bone lacing

export interface BoneLacing { soakDice: number; unarmedPower: number; weight: number; label: string }

/** v0.58.0: the bone-lacing row for a kind, or zeros and '' when unknown or blank. */
export function boneLacing(kind: string): BoneLacing {
  const k = G().boneLacing.kinds.find((x) => x.id === kind);
  return k ? { soakDice: k.soakDice, unarmedPower: k.unarmedPower, weight: k.weight, label: k.label } : { soakDice: 0, unarmedPower: 0, weight: 0, label: '' };
}

/** v0.58.0: lacings don't stack: only the best working one (most soak dice) counts. */
export function boneLacingTotals(items: ReadonlyArray<{ kind: string; working?: boolean }>): BoneLacing {
  let best = boneLacing('');
  for (const i of items ?? []) {
    if (i.working === false) continue;
    const row = boneLacing(i.kind);
    if (row.soakDice > best.soakDice || (row.soakDice === best.soakDice && row.unarmedPower > best.unarmedPower)) best = row;
  }
  return best;
}

// ---------------------------------------------------------------- Surveillance

export type SurveillanceKind = (typeof RULES.GEAR_V58.surveillance.kinds)[number];

/** v0.58.0: the surveillance-gear row for an id, or null. */
export function surveillanceKind(id: string): SurveillanceKind | null {
  return G().surveillance.kinds.find((k) => k.id === id) ?? null;
}

/**
 * v0.58.0: a listening test (bug, tap, microphone): rating dice against listenTn plus an active
 * white-noise generator's rating and any `extra`. `baseTn` is listenTn; `modifiers` lists the rest;
 * `tn` is the final TN (never below RULES.MIN_TARGET_NUMBER).
 */
export function listenTest(o: { rating: number; whiteNoise?: number; extra?: number }): { dice: number; baseTn: number; tn: number; modifiers: TargetNumberModifier[] } {
  const baseTn = G().surveillance.listenTn;
  const modifiers: TargetNumberModifier[] = [];
  const noise = Math.max(0, num(o.whiteNoise));
  if (noise > 0) modifiers.push({ label: tx('SR2E.Card.Mod.whiteNoise', { noise }), value: noise });
  const extra = num(o.extra);
  if (extra !== 0) modifiers.push({ id: 'other', label: tx('SR2E.Card.Mod.other'), value: extra });
  const tn = Math.max(RULES.MIN_TARGET_NUMBER, baseTn + modifiers.reduce((s, m) => s + m.value, 0));
  return { dice: Math.max(0, num(o.rating)), baseTn, tn, modifiers };
}

/** v0.58.0: what a listening test with `successes` picks up ('Nothing usable.' for 0). */
export function listenReveal(successes: number): string {
  const s = Math.floor(num(successes));
  let text = tx('SR2E.Text.Outfit.nothingUsable');
  for (const r of G().surveillance.reveals) if (s >= r.successes) text = r.text;
  return text;
}

/** v0.58.0: a bug sweep: the scanner's rating in dice against the bug's rating as the TN. */
export function bugSweep(o: { scannerRating: number; bugRating: number }): { dice: number; tn: number } {
  return { dice: Math.max(0, num(o.scannerRating)), tn: Math.max(RULES.MIN_TARGET_NUMBER, num(o.bugRating)) };
}

/** v0.58.0: whether a comm jammer of `jammerRating` blocks a signal (bug, tap, comcall) of `signalRating`. */
export function jammed(jammerRating: number, signalRating: number): boolean {
  const j = num(jammerRating);
  const s = num(signalRating);
  if (j <= 0) return false;
  return G().surveillance.jamBeats === 'greater' ? j > s : j >= s;
}

/** v0.58.0: the highest rating among active items (active defaults to true) of `kind`; 0 if none. */
export function strongestActive(items: ReadonlyArray<{ kind: string; rating: number; active?: boolean }>, kind: string): number {
  let best = 0;
  for (const i of items ?? []) if (i.kind === kind && i.active !== false) best = Math.max(best, num(i.rating));
  return best;
}

// ---------------------------------------------------------------- Optics

export interface Optics { lowLight: boolean; thermographic: boolean; flareComp: boolean; magnification: number }

/** v0.58.0: vision from worn, undamaged gear (magnification is the best, capped at optics.magnificationMax). */
export function opticsOf(items: ReadonlyArray<{ worn?: boolean; lowLight?: boolean; thermographic?: boolean; flareComp?: boolean; magnification?: number; damaged?: boolean }>): Optics {
  const out: Optics = { lowLight: false, thermographic: false, flareComp: false, magnification: 0 };
  for (const i of items ?? []) {
    if (!i.worn || i.damaged) continue;
    out.lowLight ||= Boolean(i.lowLight);
    out.thermographic ||= Boolean(i.thermographic);
    out.flareComp ||= Boolean(i.flareComp);
    out.magnification = Math.max(out.magnification, num(i.magnification));
  }
  out.magnification = Math.min(G().optics.magnificationMax, out.magnification);
  return out;
}

/** v0.58.0: combine two vision sources (cybereyes and gear): OR of the senses, best magnification. */
export function mergeVision(a: Partial<Optics> | null | undefined, b: Partial<Optics> | null | undefined): Optics {
  return {
    lowLight: Boolean(a?.lowLight || b?.lowLight),
    thermographic: Boolean(a?.thermographic || b?.thermographic),
    flareComp: Boolean(a?.flareComp || b?.flareComp),
    magnification: Math.max(0, num(a?.magnification), num(b?.magnification)),
  };
}

// ---------------------------------------------------------------- Legality

export type LegalityCategory = (typeof RULES.GEAR_V58.legality.categories)[number];

/** v0.58.0: the legality row for a category (unknown → the '' row). */
export function legalityOf(category: string): LegalityCategory {
  const cats = G().legality.categories;
  return cats.find((c) => c.id === (category ?? '')) ?? cats.find((c) => c.id === '') ?? { id: '', label: '', permit: false, fine: 0 };
}

/**
 * v0.58.0: whether carrying an item is legal. Legal and unset are fine; permit categories are fine
 * with a permit; otherwise not, with the category's fine (× rating when fineTimesRating and rating > 0).
 */
export function legalCheck(o: { category: string; permit?: boolean; rating?: number }): { ok: boolean; label: string; fine: number; note: string } {
  const row = legalityOf(o.category);
  if (row.fine <= 0 && !row.permit) return { ok: true, label: row.label, fine: 0, note: '' };
  if (row.permit && o.permit) return { ok: true, label: row.label, fine: 0, note: tx('SR2E.Text.Outfit.coveredByAPermit') };
  const rating = num(o.rating);
  const fine = G().legality.fineTimesRating && rating > 0 ? row.fine * rating : row.fine;
  return { ok: false, label: row.label, fine, note: row.permit ? tx('SR2E.Text.Outfit.noPermit') : tx('SR2E.Text.Outfit.forbidden') };
}

/** v0.58.0: the items that are illegal to carry, and the total fine. */
export function legalSummary(items: ReadonlyArray<{ name: string; category: string; permit?: boolean; rating?: number }>): { problems: Array<{ name: string; label: string; fine: number }>; totalFine: number } {
  const problems: Array<{ name: string; label: string; fine: number }> = [];
  for (const i of items ?? []) {
    const c = legalCheck(i);
    if (!c.ok) problems.push({ name: i.name, label: c.label, fine: c.fine });
  }
  return { problems, totalFine: problems.reduce((s, p) => s + p.fine, 0) };
}

// ---------------------------------------------------------------- Token visibility

export const CONCEAL_LABELS: Record<string, string> = { invisibility: 'Invisibility', improvedInvisibility: 'Improved invisibility' };

/** v0.58.0: whether a token should be invisible: astral projection, or an invisibility spell on it. */
export function tokenInvisible(o: { astralMode?: string; concealment?: ReadonlyArray<{ kind: string }> }): { invisible: boolean; why: string } {
  const v = G().visibility;
  if (!v.enabled) return { invisible: false, why: '' };
  if (o.astralMode === 'projecting') return { invisible: true, why: 'astral form' };
  const hit = (o.concealment ?? []).find((c) => v.concealKinds.includes(c.kind));
  if (hit) return { invisible: true, why: CONCEAL_LABELS[hit.kind] ?? hit.kind };
  return { invisible: false, why: '' };
}
