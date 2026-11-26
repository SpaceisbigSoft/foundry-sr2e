/**
 * v0.93.4 ("readability", report item 15): the Foundry-free parts of the size and 1024×768 fixes.
 *
 * - The creation wizard's step marks in three states (not ready, needs attention, done), its Totals checklist for the
 *   priorities and the contacts sentence.
 * - The combat tracker's pool line in short words, and the wound chip that labels the coloured wound dot.
 * - Window sizes that fit the screen: at most about 80% of its height (with a cap), so the hotbar stays clear.
 */
import { t as tx, tCount, tKey } from '../helpers/i18n.ts';
import { WIZARD_STEPS, type WizardStep } from './advancement.ts';
import { BUILD_COLUMNS, type BuildColumn, type Priority } from './creation.ts';

// ---------------------------------------------------------------- The creation wizard

/** A step tab's mark: 'wait' (not ready: a step it depends on isn't done), 'bad' (needs attention), 'ok' (done), '' (nothing yet). */
export type StepMark = '' | 'ok' | 'bad' | 'wait';

/** v0.93.4: which steps each step depends on (every step after the first needs the priorities). */
export const STEP_NEEDS: Readonly<Record<WizardStep, readonly WizardStep[]>> = {
  priorities: [], metatype: ['priorities'], attributes: ['priorities'], magic: ['priorities'], skills: ['priorities'],
  resources: ['priorities'], contacts: ['priorities'], review: ['priorities'],
};

/**
 * v0.93.4: the step tabs' marks from the build check's per-step states. A step whose dependencies aren't done is
 * 'wait' (grey, no mark), even where its own rows pass: Resources and Contacts can't be done while the priorities
 * are unset. `done` overrides whether a step counts as done (the priorities: every row has a different letter).
 */
export function wizardStepMarks(states: Partial<Record<WizardStep, '' | 'ok' | 'bad'>>, done: Partial<Record<WizardStep, boolean>> = {}): Record<WizardStep, StepMark> {
  const isDone = (s: WizardStep): boolean => (done[s] ?? (states[s] === 'ok'));
  const out = {} as Record<WizardStep, StepMark>;
  for (const { id } of WIZARD_STEPS) {
    const ready = (STEP_NEEDS[id] ?? []).every(isDone);
    out[id] = ready ? (states[id] ?? '') : 'wait';
  }
  return out;
}

/** v0.93.4: the Totals panel's priority checklist: one row per build row (Race, Magic, …) with its letter or ''. */
export function priorityChecklist(pr: Partial<Record<BuildColumn, Priority | string | null>>, labelOf: (k: BuildColumn) => string): Array<{ key: BuildColumn; label: string; letter: string; set: boolean }> {
  return BUILD_COLUMNS.map((k) => {
    const v = String(pr?.[k] ?? '');
    const letter = /^[A-E]$/.test(v) ? v : '';
    return { key: k, label: labelOf(k), letter, set: Boolean(letter) };
  });
}

/** v0.93.4: the contacts line in plain words ("Contacts: 0 chosen; the first 2 are free."). */
export function contactsSentence(chosen: number, free: number): string {
  const n = Math.max(0, Math.floor(Number(chosen) || 0));
  const f = Math.max(0, Math.floor(Number(free) || 0));
  if (!f) return tx('SR2E.App.Creation.contactsNoneFree', { chosen: n });
  return tCount(f, 'SR2E.App.Creation.contactsSentence', { chosen: n });
}

// ---------------------------------------------------------------- The combat tracker

/** v0.93.4: the pools under a combatant's name in short words ("Combat 7/7 · Control 0/7 · Karma 3/3"). */
export function trackerPoolParts(d: Record<string, any> | null | undefined, karmaPool: unknown): string[] {
  const x = d ?? {};
  const n = (v: unknown) => Math.max(0, Math.floor(Number(v) || 0));
  const rows: Array<[string, unknown, unknown]> = [
    ['SR2E.App.Tokens.poolCombat', x['combatPoolLeft'], x['combatPool']],
    ['SR2E.App.Tokens.poolSpell', x['spellPoolLeft'], x['spellPool']],
    ['SR2E.App.Tokens.poolHacking', x['hackingPoolLeft'], x['hackingPool']],
    ['SR2E.App.Tokens.poolControl', x['controlPoolLeft'], x['controlPool']],
    ['SR2E.App.Tokens.poolKarma', x['karmaPoolLeft'], karmaPool],
  ];
  return rows.filter(([, , max]) => n(max) > 0).map(([key, left, max]) => tKey(key, { left: n(left), max: n(max) }));
}

const WOUND_WORD: Record<string, string> = { L: 'SR2E.Text.Look.light', M: 'SR2E.Text.Look.moderate', S: 'SR2E.Text.Look.serious', D: 'SR2E.Text.Look.deadly' };

/** v0.93.4: the wound level a status icon's path shows (the system's wound-l / -m / -s / -d icons), or null. */
export function woundLetterOf(src: unknown): 'L' | 'M' | 'S' | 'D' | null {
  const m = /\/wound-([lmsd])\.svg(?:[?#].*)?$/i.exec(String(src ?? ''));
  return m ? (m[1]!.toUpperCase() as 'L' | 'M' | 'S' | 'D') : null;
}

/**
 * v0.93.4: the text chip that labels the tracker's wound dot: "Light +1" with the hover text
 * "Light wound: +1 to every target number". `mod` is the combatant's wound modifier (left out when 0 or unknown).
 */
export function trackerWoundChip(level: string | null | undefined, mod?: unknown): { level: string; text: string; title: string } | null {
  const l = String(level ?? '').toUpperCase();
  const key = WOUND_WORD[l];
  if (!key) return null;
  const word = tKey(key);
  const m = Math.floor(Number(mod) || 0);
  return {
    level: l,
    text: m > 0 ? tx('SR2E.App.Tokens.woundChip', { word, mod: m }) : word,
    title: m > 0 ? tx('SR2E.Text.Look.woundTitle', { word, mod: m }) : tx('SR2E.App.Tokens.woundChipTitle', { word }),
  };
}

// ---------------------------------------------------------------- Window sizes

/** v0.93.4: the tallest a window starts: 80% of the screen's height, and never over this many pixels. */
export const FIT_HEIGHT_SHARE = 0.8;
export const FIT_HEIGHT_CAP = 1000;

/**
 * v0.93.4: a window's starting size fitted to the screen: its height at most 80% of the screen (and FIT_HEIGHT_CAP),
 * its width at most the screen less a margin. Sizes that already fit are kept; 'auto' and missing values stay as they are.
 */
export function fitWindowSize<T extends { width?: number | string; height?: number | string }>(pos: T, viewport: { width?: number; height?: number }): T {
  const out: any = { ...pos };
  const vh = Math.floor(Number(viewport?.height) || 0);
  const vw = Math.floor(Number(viewport?.width) || 0);
  if (vh > 0 && typeof pos.height === 'number' && Number.isFinite(pos.height)) {
    const max = Math.max(320, Math.min(FIT_HEIGHT_CAP, Math.floor(vh * FIT_HEIGHT_SHARE)));
    out.height = Math.min(pos.height, max);
  }
  if (vw > 0 && typeof pos.width === 'number' && Number.isFinite(pos.width)) {
    out.width = Math.min(pos.width, Math.max(320, vw - 40));
  }
  return out as T;
}
