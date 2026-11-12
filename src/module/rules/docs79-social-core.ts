import { RULES } from './config.ts';
import type { TargetNumberModifier } from './dice.ts';
import { t as tx, tCount } from '../helpers/i18n.ts';

/**
 * v0.79.0 (social_core): the book's social tests and skill Karma (RULES.DOCS_V79.socialDesired, socialInfluence,
 * skillKarma; notes in config79-social-core.ts). Pure rules.
 */

type Row = { id: string; label: string; value: number };
const D = () => RULES.DOCS_V79;

/** Whether the desired-result scale is one pick (the book's table) rather than the old checkboxes. */
export function socialDesiredPick(): boolean {
  return D().socialDesired.mode === 'docs';
}

/** The rows the Social dialog offers under "desired result": the book's scale, or the old house rows. */
export function socialDesiredRows(): ReadonlyArray<Row> {
  return socialDesiredPick() ? D().socialDesired.rows : RULES.STREET.social.situations;
}

/**
 * The TN modifiers for the picked rows: under the book's scale only the first picked row counts (it is one
 * scale) and it reads "Desired result: …"; under the old rows every ticked row counts. Zero rows add nothing.
 */
export function socialDesiredModifiers(ids: readonly string[]): TargetNumberModifier[] {
  const rows = socialDesiredRows();
  if (socialDesiredPick()) {
    const row = rows.find((r) => r.id === ids[0]);
    return row && row.value ? [{ label: tx('SR2E.Card.Mod.desiredResult', { rowLabel: row.label }), value: row.value }] : [];
  }
  return rows.filter((r) => ids.includes(r.id) && r.value).map((r) => ({ label: r.label, value: r.value }));
}

/**
 * Whether a social test with this skill is one-sided (the speaker rolls against the target's attribute; the
 * target doesn't roll): Etiquette, Leadership and Negotiation under 'oneSided', except when negotiating pay.
 */
export function socialOneSided(skill: string, o: { pay?: boolean } = {}): boolean {
  const s = D().socialInfluence;
  if (s.mode !== 'oneSided' || o.pay) return false;
  const n = String(skill ?? '').trim().toLowerCase();
  // v0.92.3 (RULES.CORE_V923.interrogation 'book', Core p. 73): Interrogation is the interrogator's test vs the subject's Willpower.
  const list = RULES.CORE_V923.interrogation === 'book' ? [...s.skills, 'Interrogation'] : s.skills;
  return list.some((k) => { const l = k.toLowerCase(); return n === l || n.startsWith(`${l} `); });
}

/**
 * A one-sided social test's outcome: it passes with `successes` success(es) or more; `extra` are the successes
 * beyond that (a better result). `winner`/`net` keep the shape of an opposed test's result (net = successes).
 */
export function socialInfluenceOutcome(successes: number): { passed: boolean; extra: number; winner: 'initiator' | 'none'; net: number } {
  const need = Math.max(1, D().socialInfluence.successes);
  const s = Math.max(0, Math.floor(successes || 0));
  const passed = s >= need;
  return { passed, extra: passed ? s - need : 0, winner: passed ? 'initiator' : 'none', net: s };
}

/** The line a one-sided social test's card ends with (plain text). */
export function socialInfluenceLine(successes: number, targetName = tx('SR2E.Text.Docs79SocialCore.theTarget')): string {
  const o = socialInfluenceOutcome(successes);
  if (!o.passed) return tx('SR2E.Text.Docs79SocialCore.noLuckIsntSwayed', { targetName });
  return o.extra ? tCount(o.extra, 'SR2E.Text.Docs79SocialCore.itWorksExtra') : tx('SR2E.Text.Docs79SocialCore.itWorks');
}

/**
 * The book's Karma multiplier for raising a skill (new rating × this), or null when the old bands apply
 * (switch 'bands', or a knowledge or language skill, which the v0.79.0 fixes leave alone).
 */
export function skillKarmaMultiplier(o: { kind: 'active' | 'knowledge' | 'language' | 'buildRepair'; specialization?: boolean; concentration?: boolean }): number | null {
  const k = D().skillKarma;
  if (k.mode !== 'flat') return null;
  if (o.kind !== 'active' && o.kind !== 'buildRepair') return null;
  return o.specialization ? k.specialization : o.concentration ? k.concentration : k.general;
}

/** The book's Karma to raise a skill to `to`, or null when the old bands apply (see skillKarmaMultiplier). */
export function docsSkillCost(o: { to: number; kind: 'active' | 'knowledge' | 'language' | 'buildRepair'; specialization?: boolean; concentration?: boolean }): number | null {
  const m = skillKarmaMultiplier(o);
  return m == null ? null : Math.ceil(Math.max(0, o.to) * m);
}
