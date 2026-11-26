/**
 * v0.94.1: the Foundry-free parts of two dice features.
 *
 * - A Karma Pool re-roll (and Avoid Disaster, Buy a success) updates the same chat card (report item 24; the owner:
 *   "A re-roll updates the same card, keeping the replaced dice greyed"). Here: whether a card may be updated in place,
 *   the dice a re-roll replaces (kept on the snapshot so the card shows them greyed), and which of the card's own flag
 *   keys a new resolution leaves stale (the use marks set later, such as "defended", are never among them).
 * - Typed physical-dice results (report item 30; the owner: "Typed physical dice are allowed: marked on the card, and
 *   the GM applies"): who may type, the typed number clamped to the dice pool, the result a typed test stands for (no
 *   dice faces), and the one-shot "next test" hand-over from the roll window to the test.
 */
import type { DieResult, SuccessTestResult, TargetNumberModifier } from './dice.ts';
import { finalTargetNumber } from './dice.ts';

/** The most dice a card keeps as replaced (a long chain of re-rolls stays a short card). */
export const MAX_REPLACED_DICE = 60;

/** The most dice one test may roll (documents/index.ts MAX_TEST_DICE); a typed count is never above its pool either. */
export const MAX_TYPED_DICE = 200;

// ---------------------------------------------------------------- Re-roll in place

/** A die from a card's flags, as numbers and booleans only (the card prints it), or null when it isn't one. */
export function cleanDie(d: unknown): DieResult | null {
  if (!d || typeof d !== 'object') return null;
  const x = d as Record<string, unknown>;
  const faces = (Array.isArray(x['faces']) ? x['faces'] : []).slice(0, 20).map((f) => Math.max(0, Math.min(6, Math.floor(Number(f) || 0))));
  if (!faces.length) return null;
  const out: DieResult = { faces, total: faces.reduce((a, b) => a + b, 0), success: Boolean(x['success']) };
  if (x['pool']) out.pool = true;
  if (typeof x['poolKind'] === 'string' && /^[a-z]{1,12}$/.test(x['poolKind'])) out.poolKind = x['poolKind'];
  if (x['karma']) out.karma = true;
  return out;
}

/** A list of dice from a card's flags, cleaned and capped (the newest kept). */
export function cleanDice(list: unknown, cap = MAX_REPLACED_DICE): DieResult[] {
  if (!Array.isArray(list)) return [];
  const out = list.map(cleanDie).filter((d): d is DieResult => d !== null);
  return out.length > cap ? out.slice(out.length - cap) : out;
}

/**
 * The dice a Karma re-roll replaces: every failed die of the test as it stands (`rules/dice.ts rerollFailures` keeps
 * the successes and rolls the failures again). Appended to those an earlier re-roll on the same card replaced.
 * Each keeps its pool and Karma marks (its colour on the card).
 */
export function withReplaced(earlier: unknown, current: readonly DieResult[]): DieResult[] {
  return cleanDice([...cleanDice(earlier), ...current.filter((d) => !d.success).map((d) => ({ ...d, faces: [...d.faces] }))]);
}

/** What decides whether a re-roll updates its own card. Every field comes from the acting client, never a card's data. */
export interface InPlaceFacts {
  /** The world setting `rerollInPlace` (off: the older behaviour, a new card that replaces the old one). */
  setting: boolean;
  /** The card the button was on. */
  hasMessage: boolean;
  /** The card's own test is the one being re-rolled (the same testId). */
  sameTest: boolean;
  /** The card was posted by this version (it lists its resolution's flag keys); older cards get a new card as before. */
  newFormat: boolean;
  /** A GM's TN change replaced the card. */
  superseded: boolean;
  /** This resolution may write the card: its author (a player re-rolling their own card) or a GM acting for them. */
  canWrite: boolean;
}

/** Whether a re-roll updates the card it came from (else it posts a new card, as before v0.94.1). */
export function rerollInPlace(f: InPlaceFacts): boolean {
  return f.setting && f.hasMessage && f.sameTest && f.newFormat && !f.superseded && f.canWrite;
}

/** Flag keys an update in place never removes: the test itself, its key list, and the GM's replacement mark. */
const KEEP_KEYS = new Set(['test', 'resolvedKeys', 'supersededBy', 'retargetOf', 'typedDice']);

/**
 * The flag keys of the card's previous resolution that the new one doesn't set (a missed attack has no `attack` flag;
 * a hit has). Only keys the card itself lists as its resolution's (`resolvedKeys`): the use marks set later (Defend,
 * Resist, Apply) are never removed, so a button already used stays used.
 */
export function staleFlagKeys(previous: unknown, now: readonly string[]): string[] {
  if (!Array.isArray(previous)) return [];
  const keep = new Set(now);
  const out = new Set<string>();
  for (const k of previous.slice(0, 100)) {
    if (typeof k !== 'string' || !/^[A-Za-z][\w]{0,40}$/.test(k) || keep.has(k) || KEEP_KEYS.has(k)) continue;
    out.add(k);
  }
  return [...out];
}

// ---------------------------------------------------------------- Typed physical-dice results

/** The world setting `typedDice`: nobody, the GM only, or everyone may type a physical-dice result. */
export type TypedDiceMode = 'off' | 'gm' | 'all';
export const TYPED_DICE_MODES: readonly TypedDiceMode[] = ['off', 'gm', 'all'];

/** A setting's value as a mode ('all', the default, for anything unknown). */
export function typedDiceMode(v: unknown): TypedDiceMode {
  return (TYPED_DICE_MODES as readonly unknown[]).includes(v) ? (v as TypedDiceMode) : 'all';
}

/** Whether this user may type a result: the setting allows them, and (as for rolling) they own the roller. */
export function mayTypeDice(mode: TypedDiceMode, o: { isGM: boolean; ownsRoller: boolean }): boolean {
  if (!o.ownsRoller) return false;
  return mode === 'all' || (mode === 'gm' && o.isGM);
}

/** What the roll window hands to the test: the successes typed, and whether every die came up 1. */
export interface TypedDice { successes: number; allOnes: boolean }

/** A typed count as a whole number from 0 to the dice pool. */
export function clampTyped(n: unknown, pool: number): number {
  const max = Math.max(0, Math.min(MAX_TYPED_DICE, Math.floor(Number(pool) || 0)));
  const v = Math.floor(Number(n));
  return Number.isFinite(v) ? Math.max(0, Math.min(max, v)) : 0;
}

/**
 * The result a typed test stands for: no dice faces (none were rolled here), the successes typed (at most the pool),
 * and a disaster when every die came up 1 (Rule of One: no successes then). No dice at all is never a disaster.
 */
export function typedResult(o: { successes: unknown; allOnes: boolean; pool: number; baseTargetNumber: number; modifiers: TargetNumberModifier[] }): SuccessTestResult {
  const pool = Math.max(0, Math.min(MAX_TYPED_DICE, Math.floor(Number(o.pool) || 0)));
  const { targetNumber, clamped } = finalTargetNumber(o.baseTargetNumber, o.modifiers);
  const botch = Boolean(o.allOnes) && pool > 0;
  return {
    baseTargetNumber: o.baseTargetNumber, modifiers: o.modifiers, targetNumber, targetNumberClamped: clamped,
    totalDice: pool, dice: [], successes: botch ? 0 : clampTyped(o.successes, pool), botch,
  };
}

/** A typed result waiting for the next test of one actor (set by a roll window when its Roll button is pressed). */
export interface TypedPending extends TypedDice { actorUuid: string; at: number }

/** How long a typed result waits for its test before it is dropped (a window whose test never rolled). */
export const TYPED_WAIT_MS = 120_000;

/**
 * Whether a waiting typed result is this test's: the same actor, still fresh, and not a resistance test (a spell's
 * Drain or a damage soak comes after the test the player typed for, and is rolled as usual).
 */
export function typedFor(p: TypedPending | null, o: { actorUuid: string; kind: string; now: number }): 'use' | 'keep' | 'drop' {
  if (!p) return 'keep';
  if (!(o.now - p.at >= 0 && o.now - p.at <= TYPED_WAIT_MS)) return 'drop';
  if (p.actorUuid !== o.actorUuid || o.kind === 'soak') return 'keep';
  return 'use';
}

/** A roll window's typed fields, read as a typed result (null when the box isn't ticked). */
export function readTyped(on: unknown, successes: unknown, allOnes: unknown): TypedDice | null {
  if (!on) return null;
  return { successes: clampTyped(successes, MAX_TYPED_DICE), allOnes: Boolean(allOnes) };
}
