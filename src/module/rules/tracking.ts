import { RULES } from './config.ts';
import type { TargetNumberModifier } from './dice.ts';
import { t as tx } from '../helpers/i18n.ts';

export interface Signature {
  id: string;
  sceneId: string;
  kind: string;
  label: string;
  force: number;
  /** World time (seconds) when it was left. */
  worldTime: number;
}

/** Hours since the signature was left (never negative). */
export function signatureAgeHours(sig: Pick<Signature, 'worldTime'>, now: number): number {
  return Math.max(0, (now - sig.worldTime) / 3600);
}

/** How long a signature lasts, in hours. VERIFY */
export function signatureLifeHours(force: number): number {
  return Math.max(0, force) * RULES.TRACKING.signatureHoursPerForce;
}

/** Hours left before it fades (0 = gone). */
export function signatureHoursLeft(sig: Pick<Signature, 'worldTime' | 'force'>, now: number): number {
  return Math.max(0, signatureLifeHours(sig.force) - signatureAgeHours(sig, now));
}

/** Keep only signatures that have not faded, sorted newest last, at most `keep` (0 keeps none). */
export function pruneSignatures<T extends Signature>(sigs: readonly T[], now: number, keep: number = RULES.TRACKING.keepPerActor): T[] {
  // v0.81.0 (RB-3): `.slice(-0)` kept everything; a keep of 0 (or less) now keeps none.
  const k = Math.max(0, Math.floor(Number(keep) || 0));
  const live = sigs.filter((s) => signatureHoursLeft(s, now) > 0).sort((a, b) => a.worldTime - b.worldTime);
  return k ? live.slice(-k) : [];
}

/** TN modifier for how old a trail is. VERIFY */
export function freshnessModifier(ageHours: number): TargetNumberModifier[] {
  // v0.81.0 (RB-18): rows scanned shortest first, whatever order an override lists them in.
  const row = [...RULES.TRACKING.freshness].sort((a, b) => a[0] - b[0]).find(([max]) => ageHours <= max);
  const value = row ? row[1] : RULES.TRACKING.staleModifier;
  return value ? [{ label: tx('SR2E.Card.Mod.trailHOld', { value: Math.round(ageHours * 10) / 10 }), value }] : [];
}

/** Hours to follow a trail: base time divided by successes; null if the trail is lost. VERIFY */
export function trackingHours(successes: number, baseHours: number = RULES.TRACKING.baseHours): number | null {
  return successes > 0 ? Math.round((baseHours / successes) * 100) / 100 : null;
}

export interface Geas {
  text: string;
  /** Points of Magic the geas protects; lost while it is not met. */
  magic: number;
  met: boolean;
  /** Warn when casting or summoning while this geas is not met. */
  checkOnCast: boolean;
}

/** Magic lost to unmet geasa. */
export function geasaPenalty(geasa: readonly Geas[]): number {
  // v0.92.3 (RULES.SPIRITS_V923.geasa 'book', Grimoire p. 52): a broken geas adds +2 TN to magical tests instead.
  if (RULES.SPIRITS_V923.geasa === 'book') return 0;
  return geasa.filter((g) => !g.met).reduce((s, g) => s + Math.max(0, g.magic), 0);
}

/** Geasa to warn about before casting or summoning. */
export function unmetCastingGeasa(geasa: readonly Geas[]): Geas[] {
  return RULES.GEASA.warnOnCast ? geasa.filter((g) => !g.met && g.checkOnCast) : [];
}
