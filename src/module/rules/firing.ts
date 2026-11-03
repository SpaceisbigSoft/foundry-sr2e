import { RULES, type DamageLevel } from './config.ts';
import type { TargetNumberModifier } from './dice.ts';
import { stageUp } from './damage.ts';
import { recoilFreeRounds } from './docs79-ranged.ts';

export const FIRING_MODES = ['SS', 'SA', 'BF', 'FA'] as const;
export type FiringMode = (typeof FIRING_MODES)[number];

/** "SA/BF", "sa, fa", "SS" → the modes listed, in canonical order. Empty or unknown → single shot. */
export function parseFiringModes(text: string): FiringMode[] {
  const found = new Set(
    String(text ?? '')
      .toUpperCase()
      .split(/[^A-Z]+/)
      .filter((t): t is FiringMode => (FIRING_MODES as readonly string[]).includes(t)),
  );
  const modes = FIRING_MODES.filter((m) => found.has(m));
  return modes.length ? modes : ['SS'];
}

/** Rounds fired by one action in a mode; full auto is clamped to the allowed range. */
export function roundsForMode(mode: FiringMode, fullAutoRounds: number = RULES.FIRING.fullAutoMin): number {
  if (mode === 'FA') {
    const n = Math.floor(Number.isFinite(fullAutoRounds) ? fullAutoRounds : RULES.FIRING.fullAutoMin);
    return Math.min(RULES.FIRING.fullAutoMax, Math.max(RULES.FIRING.fullAutoMin, n));
  }
  return RULES.FIRING.roundsPerMode[mode];
}

/**
 * Uncompensated recoil as a TN modifier: every round fired this phase (including this action)
 * beyond the free ones adds +1, less the weapon's recoil compensation. Never negative.
 * v0.79.0 (RULES.DOCS_V79.rangedRecoil 'book', SRII Ranged Combat Modifiers Table): only a single first shot is free
 * (`firstShotSingle`: whether the phase's first shot was one round; unknown = worked out, see recoilFreeRounds);
 * 'freeFirst': RULES.FIRING.recoilFreeRounds always (old).
 */
export function recoilModifier(opts: { rounds: number; earlierRoundsThisPhase?: number; recoilComp?: number; firstShotSingle?: boolean }): number {
  const total = Math.max(0, opts.rounds) + Math.max(0, opts.earlierRoundsThisPhase ?? 0);
  const raw = total - recoilFreeRounds(opts);
  return Math.max(0, raw - Math.max(0, opts.recoilComp ?? 0));
}

/** Weapon damage after the firing mode: bursts and full auto raise Power and stage the level up. */
export function damageForMode(
  power: number,
  level: DamageLevel,
  mode: FiringMode,
  rounds: number,
): { power: number; level: DamageLevel } {
  if (mode === 'BF') {
    return { power: power + RULES.FIRING.burst.power, level: stageUp(level, RULES.FIRING.burst.stages) };
  }
  if (mode === 'FA') {
    const { powerPerRound, roundsPerStage } = RULES.FIRING.fullAuto;
    return { power: power + rounds * powerPerRound, level: stageUp(level, Math.floor(rounds / roundsPerStage)) };
  }
  return { power, level };
}

/** Turn the dialog's ticked situational ids and visibility choice into labeled TN modifiers. Unknown ids are ignored. */
export function situationalModifiers(ids: readonly string[], visibility = 'normal'): TargetNumberModifier[] {
  const picked = RULES.SITUATIONAL_MODIFIERS.filter((m) => ids.includes(m.id)).map((m) => ({ label: m.label, value: m.value }));
  const vis = RULES.VISIBILITY.find((v) => v.id === visibility);
  if (vis && vis.value !== 0) picked.push({ label: vis.label, value: vis.value });
  return picked;
}

/** Rounds an actor has fired, tagged with the combat phase they were fired in. */
export interface RecoilRecord {
  phase: string;
  rounds: number;
}

/**
 * Identifies one combat phase: a combatant's turn within an initiative pass of a Combat Turn.
 * Returns null outside a started combat, where recoil is not carried over.
 */
export function combatPhaseKey(opts: {
  combatId?: string | null; started?: boolean; round?: number; pass?: number; combatantId?: string | null;
}): string | null {
  if (!opts.combatId || !opts.started || !opts.combatantId) return null;
  return `${opts.combatId}:${opts.round ?? 0}:${opts.pass ?? 0}:${opts.combatantId}`;
}

/** Rounds already fired in this phase according to the record (0 if it's from another phase or there is none). */
export function trackedRounds(record: RecoilRecord | null | undefined, phase: string | null): number {
  if (!phase || !record || record.phase !== phase) return 0;
  return Math.max(0, Math.floor(record.rounds) || 0);
}

/** Record after firing: `earlier` (what this attack counted as already fired) plus the rounds just fired. */
export function recordRounds(phase: string, earlier: number, rounds: number): RecoilRecord {
  return { phase, rounds: Math.max(0, earlier) + Math.max(0, rounds) };
}
