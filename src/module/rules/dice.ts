import { RULES } from './config.ts';

/**
 * Rolls `count` six-sided dice and returns the faces. Injected so the engine stays
 * pure: tests pass a scripted roller; Foundry passes an adapter around `Roll`
 * (so Dice So Nice and the roll log still work).
 */
export type DiceRoller = (count: number) => number[] | Promise<number[]>;

export interface TargetNumberModifier {
  label: string;
  value: number;
  /** v0.89.4: a stable id for a modifier the code looks for (the label is shown, in the roller's language). */
  id?: string;
}

/**
 * v0.89.4: whether a modifier row is the one with this id. Rows saved on cards before v0.89.4 have no id: their English
 * label (`legacy`, a string or a pattern) is matched instead.
 */
export function modifierIs(m: { id?: unknown; label?: unknown } | null | undefined, id: string, legacy: string | RegExp): boolean {
  if (!m) return false;
  if (typeof m.id === 'string' && m.id) return m.id === id;
  const l = String(m.label ?? '');
  return typeof legacy === 'string' ? l === legacy : legacy.test(l);
}

/**
 * v0.89.5: the key a modifier row is switched off, picked or deduplicated by: `#<id>` for a row with an id (the same in
 * every language and code path), else its label (rows built from a name or a table's own label).
 */
export function modKey(m: { id?: unknown; label?: unknown } | null | undefined): string {
  if (!m) return '';
  return typeof m.id === 'string' && m.id ? `#${m.id}` : String(m.label ?? '');
}

/**
 * v0.89.5: whether a row is in a list of keys (`modKey`). Lists saved before v0.89.5 (a "Use again" button, an old
 * dialog) hold labels: a row's label still matches them.
 */
export function modIn(keys: ReadonlySet<string> | readonly string[] | null | undefined, m: { id?: unknown; label?: unknown } | null | undefined): boolean {
  if (!keys || !m) return false;
  const has = (k: string) => (keys instanceof Set ? keys.has(k) : (keys as readonly string[]).includes(k));
  return has(modKey(m)) || has(String(m.label ?? ''));
}

export interface SuccessTestInput {
  /** Dice from the skill/attribute rating. */
  dice: number;
  /** Extra dice spent from a pool (Combat Pool etc.). Declared before the roll. */
  poolDice?: number;
  /** Base target number before modifiers. */
  targetNumber: number;
  /** Situational, wound, range, etc. modifiers added to the base TN. */
  modifiers?: TargetNumberModifier[];
  roll: DiceRoller;
}

export interface DieResult {
  /** Every face rolled for this die; length > 1 means the Rule of Six re-rolled it. */
  faces: number[];
  /** Sum of the faces: the value compared against the target number. */
  total: number;
  success: boolean;
  /** v0.78.0: a die that came from a dice pool (Combat Pool etc.), so a rule can tell pool successes apart. */
  pool?: boolean;
}

export interface SuccessTestResult {
  baseTargetNumber: number;
  modifiers: TargetNumberModifier[];
  /** Final TN after modifiers, never below RULES.MIN_TARGET_NUMBER. */
  targetNumber: number;
  /** True if the raw modifier total pushed the TN below the minimum and it was clamped. */
  targetNumberClamped: boolean;
  totalDice: number;
  dice: DieResult[];
  successes: number;
  /** Rule of One: every die in the initial roll came up 1. Always a failure. */
  botch: boolean;
}

/** The TN after its modifiers, never below RULES.MIN_TARGET_NUMBER (`clamped`: it was raised to that floor). */
export function finalTargetNumber(
  base: number,
  modifiers: readonly TargetNumberModifier[] = [],
): { targetNumber: number; clamped: boolean } {
  const raw = base + modifiers.reduce((sum, m) => sum + m.value, 0);
  const clamped = raw < RULES.MIN_TARGET_NUMBER;
  return { targetNumber: clamped ? RULES.MIN_TARGET_NUMBER : raw, clamped };
}

/**
 * Roll `count` dice with the Rule of Six: any 6 is re-rolled and added to the die's
 * total, repeating while 6s keep coming. Re-rolls are batched in waves so the
 * adapter makes one roll call per wave (keeps Foundry's dice animation sane).
 */
export async function rollOpenEnded(count: number, roll: DiceRoller): Promise<DieResult[]> {
  const faces: number[][] = [];
  let active: number[] = [];

  const first = await roll(count);
  assertFaces(first, count);
  first.forEach((face, i) => {
    faces.push([face]);
    if (face === 6) active.push(i);
  });

  for (let wave = 0; wave < RULES.MAX_EXPLOSION_WAVES && active.length > 0; wave++) {
    const next = await roll(active.length);
    assertFaces(next, active.length);
    const stillSix: number[] = [];
    next.forEach((face, j) => {
      const idx = active[j] as number;
      (faces[idx] as number[]).push(face);
      if (face === 6) stillSix.push(idx);
    });
    active = stillSix;
  }

  return faces.map((f) => ({ faces: f, total: f.reduce((a, b) => a + b, 0), success: false }));
}

function assertFaces(faces: number[], expected: number): void {
  if (faces.length !== expected) {
    throw new Error(`Dice roller returned ${faces.length} dice, expected ${expected}`);
  }
  for (const f of faces) {
    if (!Number.isInteger(f) || f < 1 || f > 6) throw new Error(`Invalid d6 face: ${f}`);
  }
}

/** Standard SR2 success test: roll dice, count those meeting the TN, apply Rules of Six and One. */
export async function successTest(input: SuccessTestInput): Promise<SuccessTestResult> {
  const modifiers = input.modifiers ?? [];
  const { targetNumber, clamped } = finalTargetNumber(input.targetNumber, modifiers);
  const totalDice = Math.max(0, Math.floor(input.dice) + Math.floor(input.poolDice ?? 0));

  // No dice means no roll: an automatic failure, not a botch.
  if (totalDice === 0) {
    return {
      baseTargetNumber: input.targetNumber,
      modifiers,
      targetNumber,
      targetNumberClamped: clamped,
      totalDice,
      dice: [],
      successes: 0,
      botch: false,
    };
  }

  const dice = await rollOpenEnded(totalDice, input.roll);
  for (const d of dice) d.success = d.total >= targetNumber;
  // v0.78.0: the last `poolDice` dice are the pool's (for the monofilament whip's backlash rule).
  const poolN = Math.min(totalDice, Math.max(0, Math.floor(input.poolDice ?? 0)));
  for (let i = totalDice - poolN; i < totalDice; i++) dice[i]!.pool = true;

  // Rule of One looks only at the initial roll, before any 6s were re-rolled.
  const botch = dice.every((d) => d.faces[0] === 1);
  const successes = botch ? 0 : dice.filter((d) => d.success).length;

  return {
    baseTargetNumber: input.targetNumber,
    modifiers,
    targetNumber,
    targetNumberClamped: clamped,
    totalDice,
    dice,
    successes,
    botch,
  };
}

/** Net successes of an opposed test: attacker minus defender, never negative. */
export function netSuccesses(attackerSuccesses: number, defenderSuccesses: number): number {
  return Math.max(0, attackerSuccesses - defenderSuccesses);
}

/**
 * Karma Pool re-roll: re-roll every failed die once (without Rule of One).
 * Returns a new result; the original is unchanged.
 */
export async function rerollFailures(
  result: SuccessTestResult,
  roll: DiceRoller,
): Promise<SuccessTestResult> {
  const failed = result.dice.filter((d) => !d.success).length;
  if (failed === 0) return result;
  const rerolled = await rollOpenEnded(failed, roll);
  for (const d of rerolled) d.success = d.total >= result.targetNumber;
  // v0.78.0: a re-rolled pool die stays a pool die.
  result.dice.filter((d) => !d.success).forEach((d, i) => { if (d.pool && rerolled[i]) rerolled[i]!.pool = true; });
  const kept = result.dice.filter((d) => d.success);
  const dice = [...kept, ...rerolled];
  return { ...result, dice, successes: dice.filter((d) => d.success).length, botch: false };
}

/**
 * v0.50.0: score the dice already rolled against a new TN (the GM's retroactive change). No die is
 * rolled: each die's total (Rule of Six re-rolls included, which always happen) is compared again.
 * A disaster (all ones) stays one; successes bought with Karma are kept.
 */
export function rescoreResult(result: SuccessTestResult, o: { baseTargetNumber: number; modifiers: TargetNumberModifier[]; bought?: number }): SuccessTestResult {
  const modifiers = [...o.modifiers];
  const { targetNumber, clamped } = finalTargetNumber(o.baseTargetNumber, modifiers);
  const dice = result.dice.map((d) => ({ ...d, faces: [...d.faces], success: d.total >= targetNumber }));
  const successes = result.botch ? 0 : dice.filter((d) => d.success).length + Math.max(0, Math.floor(o.bought ?? 0));
  return { ...result, baseTargetNumber: o.baseTargetNumber, modifiers, targetNumber, targetNumberClamped: clamped, dice, successes };
}
