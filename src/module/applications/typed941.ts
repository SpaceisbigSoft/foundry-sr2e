/**
 * v0.94.1 (report item 30): typed physical-dice results in the roll windows. A player who rolls real dice at the table
 * ticks "I rolled the dice myself" and types the successes (and whether every die came up 1); the test then takes that
 * number instead of rolling (`withTypedDice` / `armTypedDice` here, taken by documents/index.ts `#runTest`). The
 * card is marked as typed and nothing applies from it by itself: the GM applies (applications/chat.ts).
 * No imports from the documents, so they can use it without a cycle.
 */
import { SYSTEM } from '../config/system.ts';
import { t as tx } from '../helpers/i18n.ts';
import { typedDiceMode, mayTypeDice, readTyped, typedFor, clampTyped, MAX_TYPED_DICE, type TypedDice, type TypedDiceMode, type TypedPending } from '../rules/dice941.ts';

/** The world setting `typedDice` ('off' | 'gm' | 'all'). */
export function typedDiceSetting(): TypedDiceMode {
  try { return typedDiceMode((globalThis as any).game?.settings?.get?.(SYSTEM.id, 'typedDice')); } catch { return 'all'; }
}

/** Whether this user may type a result for a test of `actor` (the setting, and owning the actor, as for rolling). */
export function mayTypeFor(actor: any): boolean {
  const user: any = (globalThis as any).game?.user;
  return mayTypeDice(typedDiceSetting(), { isGM: Boolean(user?.isGM), ownsRoller: Boolean(actor?.isOwner) });
}

/** The roll window's "I rolled the dice myself" row (folded), or '' when this user may not type for `actor`. */
export function typedDiceRow(actor: any): string {
  if (!mayTypeFor(actor)) return '';
  return `<details class="sr2e-typed-dice"><summary>${tx('SR2E.Dialog.Dice941.typedSummary')}</summary>
    <label class="sr2e-check"><input type="checkbox" name="typedOn"> ${tx('SR2E.Dialog.Dice941.typedOn')}</label>
    <div class="form-group"><label>${tx('SR2E.Dialog.Dice941.typedSuccesses')}</label><input name="typedSuccesses" type="number" min="0" step="1" value="0"></div>
    <label class="sr2e-check"><input type="checkbox" name="typedOnes"> ${tx('SR2E.Dialog.Dice941.typedOnes')}</label>
    <p class="hint">${tx('SR2E.Dialog.Dice941.typedHint')}</p></details>`;
}

/** The typed result a roll window's form holds (null when its box isn't ticked or the window has no such row). */
export function readTypedDice(form: any): TypedDice | null {
  const el: any = form?.elements;
  if (!el?.typedOn) return null;
  return readTyped(el.typedOn.checked, el.typedSuccesses?.value, el.typedOnes?.checked);
}

/** A typed result waiting for its actor's next test (one at a time, on this client). */
let pending: TypedPending | null = null;

/** Hold a roll window's typed result for `actor`'s next test (null clears it). */
export function armTypedDice(actor: any, typed: TypedDice | null): void {
  pending = actor && typed ? { successes: clampTyped(typed.successes, MAX_TYPED_DICE), allOnes: Boolean(typed.allOnes), actorUuid: String(actor.uuid ?? ''), at: Date.now() } : null;
}

/** Run a roll window's test with its typed result (if any); one its test didn't take is dropped after. */
export async function withTypedDice<T>(actor: any, typed: TypedDice | null, fn: () => Promise<T>): Promise<T> {
  if (!typed) return fn();
  armTypedDice(actor, typed);
  try { return await fn(); } finally { pending = null; }
}

/** A sheet action whose window may arm a typed result: whatever its test did with it, it is dropped when it ends. */
export function typedScoped<A extends unknown[], R>(fn: (this: any, ...args: A) => Promise<R>): (this: any, ...args: A) => Promise<R> {
  return async function (this: any, ...args: A): Promise<R> {
    try { return await fn.apply(this, args); } finally { pending = null; }
  };
}

/**
 * The typed result for this test of `actorUuid`, taken once (null: roll as usual). A resistance test (Drain, a soak)
 * leaves it for the test it was typed for; a stale one is dropped.
 */
export function takeTypedPending(actorUuid: string, kind: string): TypedDice | null {
  const use = typedFor(pending, { actorUuid, kind, now: Date.now() });
  if (use === 'keep') return null;
  const p = pending;
  pending = null;
  return use === 'use' && p ? { successes: p.successes, allOnes: p.allOnes } : null;
}
