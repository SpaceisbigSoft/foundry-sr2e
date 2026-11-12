import { RULES } from './config.ts';
import { t as tx } from '../helpers/i18n.ts';
import { delayCarries } from './combat923.ts';

/** Combat flow at the table (v0.35.0): delaying, full defense, buying successes, disasters, Karma refresh. */

/** A delayed action: whether it is still good (same combat, round and pass; `carry`: a held delay, see COMBAT_V923.delay). */
export function delayValid(flag: { combatId: string; round: number; pass: number } | null | undefined, now: { combatId: string | null; round: number; pass: number }, carry = false): boolean {
  if (!flag || !now.combatId || flag.combatId !== now.combatId) return false;
  // v0.92.3 (COMBAT_V923.delay 'book', Core p. 80): a delay still held at the end of a Combat Turn carries into the next.
  if (flag.round !== now.round) return carry && delayCarries(flag.round, now.round);
  return RULES.DELAY.lostAtPassEnd ? flag.pass === now.pass : flag.pass <= now.pass;
}

/** What declaring full defense costs: nothing outside combat, the action in your own phase, else initiative. */
export function fullDefenseCost(o: { inCombat: boolean; ownPhase: boolean }): 'none' | 'action' | 'initiative' {
  if (!o.inCombat) return 'none';
  return o.ownPhase ? 'action' : 'initiative';
}

/**
 * Whether full defense is still up: same combat and round, and the defender's next action has not
 * come (it lasts until their turn in the next pass, or the end of the Combat Turn).
 */
export function fullDefenseActive(flag: { combatId: string; round: number; pass: number } | null | undefined, now: { combatId: string | null; round: number; pass: number; reachedOwnTurn: boolean }): boolean {
  if (!flag || !now.combatId || flag.combatId !== now.combatId || flag.round !== now.round) return false;
  if (now.pass <= flag.pass) return true;
  return now.pass === flag.pass + 1 && !now.reachedOwnTurn;
}

/** Buying a success with Karma Pool: allowed, and why not. */
export function canBuySuccess(o: { successes: number; poolLeft: number; botch: boolean }): { ok: boolean; cost: number; reason: string } {
  const k = RULES.KARMA;
  if (o.botch) return { ok: false, cost: k.buyCost, reason: tx('SR2E.Text.Flow.aDisasterHasNoSuccesses') };
  if (k.buyNeedsSuccess && o.successes < 1) return { ok: false, cost: k.buyCost, reason: tx('SR2E.Text.Flow.theTestNeedsAtLeast') };
  if (o.poolLeft < k.buyCost) return { ok: false, cost: k.buyCost, reason: tx('SR2E.Text.Flow.itCostsKarmaPool', { cost: k.buyCost }) };
  return { ok: true, cost: k.buyCost, reason: '' };
}

/** The GM's suggested consequence for a disaster on a test of this kind. */
export function disasterSuggestion(kind: string): string {
  const s = RULES.DISASTERS.suggestions;
  return s[kind] ?? s['plain']!;
}

/** Session refresh: due when the date (YYYY-MM-DD) differs from the last refresh. */
export function sessionRefreshDue(last: string, today: string): boolean {
  return RULES.KARMA.refresh === 'session' && Boolean(today) && last !== today;
}

/**
 * v0.81.0: a date as YYYY-MM-DD in the local time zone, for sessionRefreshDue (a UTC date from
 * toISOString() changes at UTC midnight, which can fall in the middle of a session).
 */
export function localDateKey(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
