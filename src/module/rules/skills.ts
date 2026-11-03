import { RULES } from './config.ts';
import type { TargetNumberModifier } from './dice.ts';
import { t as tx } from '../helpers/i18n.ts';

export interface SkillDiceInput {
  /** The skill's rating; 0 means the character doesn't have it and must default. */
  rating: number;
  /** Specialization rating (0 = no specialization). */
  specializationRating?: number;
  /** Roll the specialization instead of the general skill (only if it has one). */
  useSpecialization?: boolean;
  /** v0.38.0: a concentration rating (0 = none), and whether to roll it. */
  concentrationRating?: number;
  useConcentration?: boolean;
  /** v0.38.0: the defaulting TN for the related skill (Skill Web); RULES.SKILL_DEFAULT_TN_MOD when absent. */
  relatedTn?: number;
  /** Linked attribute, for defaulting to an attribute. */
  attributeRating: number;
  /** A related skill to default to instead of the attribute (only used when `rating` is 0). */
  related?: { name: string; rating: number } | null;
}

export interface SkillDice {
  dice: number;
  modifier: TargetNumberModifier | null;
  /** What was actually rolled, for the card title. */
  using: 'skill' | 'specialization' | 'concentration' | 'related' | 'attribute';
}

/**
 * Dice for a skill test. A specialization replaces the skill's rating when it applies.
 * Without the skill, default to a related skill (+2 TN) if one is chosen and rated,
 * otherwise to the linked attribute (+4 TN). VERIFY the penalties.
 */
export function skillTestDice(input: SkillDiceInput): SkillDice {
  const spec = Math.max(0, input.specializationRating ?? 0);
  if (input.rating > 0) {
    if (input.useSpecialization && spec > 0) return { dice: spec, modifier: null, using: 'specialization' };
    const conc = Math.max(0, input.concentrationRating ?? 0);
    if (input.useConcentration && conc > 0) return { dice: conc, modifier: null, using: 'concentration' };
    return { dice: input.rating, modifier: null, using: 'skill' };
  }
  if (input.related && input.related.rating > 0) {
    return {
      dice: input.related.rating,
      modifier: { label: tx('SR2E.Card.Mod.defaultingTo', { relatedName: input.related.name }), value: input.relatedTn ?? RULES.SKILL_DEFAULT_TN_MOD },
      using: 'related',
    };
  }
  return {
    dice: Math.max(0, input.attributeRating),
    modifier: { id: 'defaultingToAttribute', label: tx('SR2E.Card.Mod.defaultingToAttribute'), value: RULES.ATTRIBUTE_DEFAULT_TN_MOD },
    using: 'attribute',
  };
}

/** Split an imported specialization such as "Martial Arts 6" into name and rating. */
export function splitSpecialization(text: string): { name: string; rating: number } {
  const m = /^(.*?)\s+(\d+)\s*$/.exec(text.trim());
  return m ? { name: (m[1] as string).trim(), rating: Number(m[2]) } : { name: text.trim(), rating: 0 };
}

/** Does a weapon's specialization text match the skill's specialization? Case and spacing are ignored. */
export function specializationMatches(skillSpec: string, weaponSpec: string): boolean {
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
  return norm(skillSpec) !== '' && norm(skillSpec) === norm(weaponSpec);
}

/* ---- v0.38.0: the Skill Web ---- */

let SKILL_WEB: WebLink[] = [];
/** The GM's Skill Web (set from the world setting). */
export function setSkillWeb(links: WebLink[]): void { SKILL_WEB = [...links]; }
export function getSkillWeb(): WebLink[] { return SKILL_WEB; }

export interface WebLink { a: string; b: string; steps: number; /** v0.80.0: written "A > B" (one-way under RULES.URR_V80.coreWebArrows). */ oneWay?: boolean }

const norm = (s: string) => s.trim().toLowerCase();

/** Parse the GM's Skill Web text: one link per line, "Firearms - Gunnery: 1" (steps default 1). */
export function parseSkillWeb(text: string): WebLink[] {
  const out: WebLink[] = [];
  for (const raw of String(text ?? '').split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim();
    if (!line) continue;
    const m = /^(.+?)\s*(-|–|—|<->|>)\s*(.+?)(?:\s*:\s*(\d+))?$/.exec(line);
    if (!m) continue;
    out.push({ a: m[1]!.trim(), b: m[3]!.trim(), steps: Math.max(1, Number(m[4] ?? 1)), ...(m[2] === '>' ? { oneWay: true } : {}) });
  }
  return out;
}

/** Steps along the shortest path between two skills (null = not linked within maxSteps). */
export function webDistance(links: readonly WebLink[], from: string, to: string): number | null {
  const a = norm(from), b = norm(to);
  if (!a || !b) return null;
  if (a === b) return 0;
  const max = RULES.SKILLS.web.maxSteps;
  const best = new Map<string, number>([[a, 0]]);
  const queue: string[] = [a];
  while (queue.length) {
    const cur = queue.shift()!;
    const d = best.get(cur)!;
    for (const l of links) {
      const x = norm(l.a), y = norm(l.b);
      const next = x === cur ? y : y === cur ? x : null;
      if (!next) continue;
      // v0.80.0 (RULES.URR_V80.coreWebArrows): "A > B" defaults from A to B only (the search runs from the needed skill back).
      if (l.oneWay && x === cur && RULES.URR_V80.coreWebArrows) continue;
      const nd = d + Math.max(1, l.steps);
      if (nd > max) continue;
      if (nd < (best.get(next) ?? Infinity)) { best.set(next, nd); queue.push(next); }
    }
  }
  return best.has(b) ? best.get(b)! : null;
}

/** The defaulting TN modifier from one skill to another (null = can't default to it). */
export function relatedDefaultTn(links: readonly WebLink[], skill: string, related: string): number | null {
  const w = RULES.SKILLS.web;
  if (!links.length) return RULES.SKILL_DEFAULT_TN_MOD;
  const d = webDistance(links, skill, related);
  if (d !== null && d > 0) return d * w.perStep;
  return w.unlinked === 'flat' ? RULES.SKILL_DEFAULT_TN_MOD : null;
}

/* ---- v0.38.0: martial arts ---- */

export interface MartialStyle { power: number; stage: number; reach: number; defense: number }

/** An unarmed attack with a martial art: Power, level and reach after the style. */
export function martialAttack(base: { power: number; level: 'L' | 'M' | 'S' | 'D'; reach: number }, style: MartialStyle | null): { power: number; level: 'L' | 'M' | 'S' | 'D'; reach: number } {
  if (!style) return base;
  const order = ['L', 'M', 'S', 'D'] as const;
  const i = Math.max(0, Math.min(3, order.indexOf(base.level) + Math.max(0, style.stage)));
  return { power: base.power + style.power, level: order[i]!, reach: base.reach + style.reach };
}
