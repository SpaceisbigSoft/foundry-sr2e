import { RULES } from './config.ts';

/** Perception and stealth, social tests, grunt groups and morale (v0.32.0). Pure rules. */

/** Opposed perception TNs: the observer vs the sneaker's Stealth, the sneaker vs the observer's attribute. */
export function perceptionTargets(o: { stealthRating: number; observerAttribute: number }): { observerTn: number; sneakerTn: number } {
  const p = RULES.PERCEPTION;
  return {
    observerTn: o.stealthRating > 0 ? Math.max(p.minTn, o.stealthRating) : p.noStealthTn,
    sneakerTn: Math.max(RULES.MIN_TARGET_NUMBER, o.observerAttribute),
  };
}

/** An opposed test's outcome: who won and by how many (ties go to the defender: nobody wins). */
export function opposedOutcome(initiator: number, defender: number): { winner: 'initiator' | 'defender' | 'none'; net: number } {
  const n = initiator - defender;
  if (n > 0) return { winner: 'initiator', net: n };
  if (n < 0) return { winner: 'defender', net: -n };
  return { winner: 'none', net: 0 };
}

/** The attribute a social skill is opposed by (TN = the other side's rating), or null if not a social skill. */
export function socialAttribute(skill: string): 'charisma' | 'willpower' | 'intelligence' | null {
  const n = String(skill ?? '').trim().toLowerCase();
  const hit = Object.entries(RULES.SOCIAL.skills).find(([k]) => n === k.toLowerCase() || n.startsWith(`${k.toLowerCase()} `));
  return hit ? hit[1] : null;
}

/** A grunt group's state: standing members (the one in front included). */
export function gruntsStanding(size: number, down: number): number {
  return Math.max(0, Math.max(1, Math.floor(size || 1)) - Math.max(0, Math.floor(down || 0)));
}

/** Whether the next grunt steps in when the one in front goes down. */
export function nextGruntSteps(size: number, down: number, status: string): boolean {
  return ['unconscious', 'dying', 'dead'].includes(status) && gruntsStanding(size, down) > 1;
}

/** Morale test: Professional Rating dice vs a TN rising with casualties; no successes breaks the group. */
export function moraleTarget(o: { casualties: number; hurt: boolean }): number {
  const m = RULES.MORALE;
  return m.tn + Math.max(0, o.casualties) * m.tnPerCasualty + (o.hurt ? m.tnHurt : 0);
}
export function moraleBroken(successes: number): boolean {
  return !(successes > 0);
}
