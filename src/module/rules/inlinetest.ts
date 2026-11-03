/**
 * v0.60.0: inline success tests (`@SR2Test[...]` in journals, descriptions and chat, and the
 * `/sr2 ...` chat command). Pure: parses the spec, labels it and picks the skill it names.
 *
 * Grammar (case and spacing don't matter, keywords in any order after the subject):
 *   <what> [tn N] [mod ±M] [pool N] [label text...]
 *   <what>  = an attribute (body, quickness, strength, charisma, intelligence, willpower, reaction,
 *             magic, essence, or their short forms bod/qui/str/cha/int/wil/rea/mag/ess),
 *             `perception`, a skill name (bare words or quoted, with an optional "(specialization)"),
 *             or a number of dice (`6`, `6d6`, `6 dice`).
 *   tn N    = target number (also `vs N`, `target N`, `tn=N`, `tn:N`, `tn5`); default 4.
 *   mod ±M  = a TN modifier (also `modifier`, `mod=-1`, `mod-1`, or a bare signed number `-1`);
 *             several add up.
 *   pool N  = dice from a dice pool (Combat Pool for attribute and skill tests; extra dice for a bare number).
 *   label   = the rest of the spec is the card's label (`label "Climb the fence"` or `label Climb the fence`).
 */
import { own } from './util.ts';
import { t as tx, tCount, tKey } from '../helpers/i18n.ts';

export const INLINE_ATTRIBUTES = ['body', 'quickness', 'strength', 'charisma', 'intelligence', 'willpower', 'reaction', 'magic', 'essence'] as const;
export type InlineAttribute = (typeof INLINE_ATTRIBUTES)[number];

/** The six physical and mental attributes the actor's `rollAttribute` takes; the rest are derived values. */
export const ROLLABLE_ATTRIBUTES: readonly InlineAttribute[] = ['body', 'quickness', 'strength', 'charisma', 'intelligence', 'willpower'];

const ATTRIBUTE_ALIASES: Record<string, InlineAttribute> = {
  bod: 'body', qui: 'quickness', quick: 'quickness', qck: 'quickness', str: 'strength', cha: 'charisma', chr: 'charisma',
  int: 'intelligence', wil: 'willpower', will: 'willpower', wp: 'willpower', rea: 'reaction', mag: 'magic', ess: 'essence',
};

const PERCEPTION_WORDS = new Set(['perception', 'notice', 'perceive']);

interface InlineBase {
  /** Target number (default 4). */
  tn: number;
  /** Sum of the TN modifiers given (0 for none). */
  mod: number;
  /** Dice pool dice to add (0 for none). */
  pool: number;
  /** A label given in the spec, or null. */
  label: string | null;
}

export type InlineTest =
  | (InlineBase & { kind: 'attribute'; attribute: InlineAttribute })
  | (InlineBase & { kind: 'skill'; skill: string; specialization: string | null })
  | (InlineBase & { kind: 'perception' })
  | (InlineBase & { kind: 'dice'; dice: number });

interface Token { text: string; quoted: boolean }

const MINUS = /[−–—]/g;

function tokenize(spec: string): Token[] | string {
  const out: Token[] = [];
  const s = spec.replace(/[“”„]/g, '"').replace(/[‘’]/g, "'").replace(MINUS, '-');
  let i = 0;
  while (i < s.length) {
    const c = s[i] as string;
    if (/\s/.test(c)) { i++; continue; }
    if (c === '"' || c === "'") {
      const end = s.indexOf(c, i + 1);
      if (end < 0) return tx('SR2E.Text.Inlinetest.unclosedQuote', { spec: spec.trim() });
      out.push({ text: s.slice(i + 1, end).trim(), quoted: true });
      i = end + 1;
      continue;
    }
    let j = i;
    while (j < s.length && !/\s/.test(s[j] as string)) j++;
    out.push({ text: s.slice(i, j), quoted: false });
    i = j;
  }
  return out;
}

const norm = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();

function intOf(text: string | undefined): number | null {
  if (text === undefined || !/^[+-]?\d+$/.test(text)) return null;
  return Number(text);
}

/** Parse an inline test spec; an error message (string) when it can't be read. */
export function parseInlineTest(spec: string): InlineTest | string {
  const toks = tokenize(String(spec ?? ''));
  if (typeof toks === 'string') return toks;
  if (!toks.length) return tx('SR2E.Text.Inlinetest.emptyTest');

  const what: Token[] = [];
  let tn: number | null = null;
  let pool: number | null = null;
  let mod = 0;
  let label: string | null = null;
  let options = false;

  for (let i = 0; i < toks.length; i++) {
    const t = toks[i] as Token;
    const value = (inline: string | undefined, name: string, signed: boolean): number | string => {
      let raw = inline;
      if (raw === undefined || raw === '') {
        const next = toks[i + 1];
        if (!next || next.quoted || intOf(next.text) === null) return tx('SR2E.Text.Inlinetest.needsANumber', { name });
        raw = next.text;
        i++;
      }
      const n = intOf(raw);
      if (n === null) return tx('SR2E.Text.Inlinetest.needsAWholeNumber', { name, raw });
      if (!signed && /^[+-]/.test(raw) && n < 0) return tx('SR2E.Text.Inlinetest.cantBeNegative', { name });
      return n;
    };
    // A keyword opening the spec with no number after it starts a skill's name ("Target Designation").
    const next = toks[i + 1];
    const bareWord = (inline: string | undefined) => (inline === undefined || inline === '') && !options && !what.length && next !== undefined && (next.quoted || intOf(next.text) === null);
    if (!t.quoted) {
      let m: RegExpExecArray | null;
      if ((m = /^(tn|vs|target)(?:[=:]?([+-]?\d+)|[=:])?$/i.exec(t.text)) && !(bareWord(m[2]) && !/[=:]$/.test(t.text))) {
        if (tn !== null) return tx('SR2E.Text.Inlinetest.targetNumberTwice');
        const v = value(m[2], 'tn', false);
        if (typeof v === 'string') return v;
        if (v < 1 || v > 99) return tx('SR2E.Text.Inlinetest.targetNumberOutOfRange', { value: v });
        tn = v; options = true; continue;
      }
      if ((m = /^(mods?|modifiers?)(?:[=:]?([+-]?\d+)|[=:])?$/i.exec(t.text)) && !(bareWord(m[2]) && !/[=:]$/.test(t.text))) {
        const v = value(m[2], 'mod', true);
        if (typeof v === 'string') return v;
        mod += v; options = true;
        if (Math.abs(mod) > 50) return tx('SR2E.Text.Inlinetest.modifierOutOfRange', { value: mod });
        continue;
      }
      if ((m = /^(pools?)(?:[=:]?([+-]?\d+)|[=:])?$/i.exec(t.text)) && !(bareWord(m[2]) && !/[=:]$/.test(t.text))) {
        if (pool !== null) return tx('SR2E.Text.Inlinetest.poolDiceTwice');
        const v = value(m[2], 'pool', false);
        if (typeof v === 'string') return v;
        if (v < 0 || v > 50) return tx('SR2E.Text.Inlinetest.poolDiceOutOfRange', { value: v });
        pool = v; options = true; continue;
      }
      if ((m = /^label(?:[=:](.*))?$/i.exec(t.text))) {
        const rest = [...(m[1] ? [m[1]] : []), ...toks.slice(i + 1).map((x) => x.text)].join(' ').trim();
        if (!rest) return tx('SR2E.Text.Inlinetest.labelNeedsText');
        label = rest;
        options = true;
        break;
      }
      if (what.length && /^[+-]\d+$/.test(t.text)) {
        mod += Number(t.text); options = true;
        if (Math.abs(mod) > 50) return tx('SR2E.Text.Inlinetest.modifierOutOfRange', { value: mod });
        continue;
      }
    }
    if (options) return tx('SR2E.Text.Inlinetest.unexpected', { text: t.text });
    what.push(t);
  }

  if (!what.length) return tx('SR2E.Text.Inlinetest.sayWhatToRoll');
  const base: InlineBase = { tn: tn ?? 4, mod, pool: pool ?? 0, label };
  const subject = what.map((w) => w.text).join(' ').trim().replace(/\s+/g, ' ');
  if (!subject) return tx('SR2E.Text.Inlinetest.sayWhatToRoll');

  // A number of dice: 6, 6d6, 6d, "6 dice".
  const dm = /^(\d+)\s*(?:d6?|dice|die)?$/i.exec(subject);
  if (dm && !what[0]?.quoted) {
    const dice = Number(dm[1]);
    if (dice < 1 || dice > 100) return tx('SR2E.Text.Inlinetest.diceOutOfRange', { dice });
    return { kind: 'dice', dice, ...base };
  }
  if (/^\d/.test(subject) && !what[0]?.quoted) return tx('SR2E.Text.Inlinetest.cantReadDice', { subject });

  const key = norm(subject).replace(/\s/g, '');
  const attr = (INLINE_ATTRIBUTES as readonly string[]).includes(key) ? (key as InlineAttribute) : own(ATTRIBUTE_ALIASES, key);
  if (attr && !what[0]?.quoted) return { kind: 'attribute', attribute: attr, ...base };
  if (PERCEPTION_WORDS.has(key) && !what[0]?.quoted) return { kind: 'perception', ...base };

  if (!/[a-z]/i.test(subject)) return tx('SR2E.Text.Inlinetest.cantReadAttributeOrSkill', { subject });
  const sm = /^(.*?)\s*\(([^()]*)\)\s*$/.exec(subject);
  if (sm && (sm[1] as string).trim()) {
    const spec = (sm[2] as string).trim();
    return { kind: 'skill', skill: (sm[1] as string).trim(), specialization: spec || null, ...base };
  }
  if (/[()]/.test(subject)) return tx('SR2E.Text.Inlinetest.cantReadSpecialization', { subject });
  return { kind: 'skill', skill: subject, specialization: null, ...base };
}

/** A signed number for display, with a real minus sign: "+2", "−1". */
export function signedText(n: number): string {
  return n < 0 ? `−${Math.abs(n)}` : `+${n}`;
}

/** An attribute's name in the user's language. */
const attributeName = (a: InlineAttribute): string => {
  if ((ROLLABLE_ATTRIBUTES as readonly string[]).includes(a)) return tKey(`SR2E.Attribute.${a}`);
  if (a === 'reaction') return tx('SR2E.Text.Inlinetest.reaction');
  if (a === 'magic') return tx('SR2E.Text.Inlinetest.magic');
  if (a === 'essence') return tx('SR2E.Text.Inlinetest.essence');
  return a.charAt(0).toUpperCase() + a.slice(1);
};

/** What is rolled, by name: "Body", "Etiquette (Street)", "Perception", "6 dice". */
export function inlineTestSubject(t: InlineTest): string {
  switch (t.kind) {
    case 'attribute': return attributeName(t.attribute);
    case 'perception': return tx('SR2E.Text.Inlinetest.perception');
    case 'skill': return t.specialization ? `${t.skill} (${t.specialization})` : t.skill;
    case 'dice': return tCount(t.dice, 'SR2E.Text.Inlinetest.dice');
  }
}

/** The test spelled out, ignoring any label: "Body (TN 4)", "Firearms (TN 5, −1)", "6 dice vs 4". */
export function inlineTestSummary(t: InlineTest): string {
  const extras = [...(t.mod ? [signedText(t.mod)] : []), ...(t.pool ? [tx('SR2E.Text.Inlinetest.poolExtra', { pool: t.pool })] : [])];
  const subject = inlineTestSubject(t);
  if (t.kind === 'dice') return extras.length ? tx('SR2E.Text.Inlinetest.diceVsExtras', { subject, tn: t.tn, extras: extras.join(', ') }) : tx('SR2E.Text.Inlinetest.diceVs', { subject, tn: t.tn });
  return extras.length ? tx('SR2E.Text.Inlinetest.testTnExtras', { subject, tn: t.tn, extras: extras.join(', ') }) : tx('SR2E.Text.Inlinetest.testTn', { subject, tn: t.tn });

}

/** The readable label for a link or card: the spec's own label if it has one, else the summary. */
export function inlineTestLabel(t: InlineTest): string {
  return t.label?.trim() ? t.label.trim() : inlineTestSummary(t);
}

/** A skill as the matcher sees it (an actor's skill item has these under `name` and `system`). */
export interface InlineSkillCandidate { name: string; specialization?: string | null; specializationRating?: number | null }

export interface InlineSkillMatch<T> {
  skill: T;
  /** Roll the specialization rating instead of the skill. */
  useSpecialization: boolean;
  /** A specialization was asked for but this skill has a different one (or none): rolled as the plain skill. */
  specializationMissing: boolean;
}

/**
 * Pick the skill an inline test names from a list (case and spacing ignored): an exact name
 * ("Etiquette (Street)" as an item's whole name, or "Etiquette" with the specialization Street),
 * then a specialization named alone ("Pistols" finds Firearms (Pistols)), then an item whose name
 * has a parenthetical the spec left out. Null when nothing fits.
 */
export function matchInlineSkill<T>(skills: readonly T[], t: { skill: string; specialization: string | null }, view: (s: T) => InlineSkillCandidate = (s) => s as unknown as InlineSkillCandidate): InlineSkillMatch<T> | null {
  const list = skills.map((s) => ({ s, v: view(s) }));
  const name = norm(t.skill);
  const spec = t.specialization ? norm(t.specialization) : '';
  const specOf = (v: InlineSkillCandidate) => norm(String(v.specialization ?? ''));
  const hasSpec = (v: InlineSkillCandidate) => specOf(v) !== '' && Number(v.specializationRating ?? 0) > 0;
  const stripParen = (s: string) => norm(s.replace(/\([^()]*\)\s*$/, ''));
  if (!name) return null;

  if (spec) {
    const whole = list.find(({ v }) => norm(v.name) === `${name} (${spec})`);
    if (whole) return { skill: whole.s, useSpecialization: false, specializationMissing: false };
    const named = list.filter(({ v }) => norm(v.name) === name);
    const withSpec = named.find(({ v }) => specOf(v) === spec && hasSpec(v));
    if (withSpec) return { skill: withSpec.s, useSpecialization: true, specializationMissing: false };
    if (named[0]) return { skill: named[0].s, useSpecialization: false, specializationMissing: true };
    const loose = list.find(({ v }) => stripParen(v.name) === name);
    if (loose) return { skill: loose.s, useSpecialization: false, specializationMissing: true };
    return null;
  }

  const exact = list.find(({ v }) => norm(v.name) === name);
  if (exact) return { skill: exact.s, useSpecialization: false, specializationMissing: false };
  const bySpec = list.find(({ v }) => specOf(v) === name && hasSpec(v));
  if (bySpec) return { skill: bySpec.s, useSpecialization: true, specializationMissing: false };
  const loose = list.find(({ v }) => stripParen(v.name) === name);
  if (loose) return { skill: loose.s, useSpecialization: false, specializationMissing: false };
  return null;
}

/** The enricher's pattern: `@SR2Test[spec]` with an optional `{label}` after it. */
export const INLINE_TEST_PATTERN = /@SR2Test\[([^\]\n]+)\](?:\{([^}\n]*)\})?/gi;

/** The `/sr2 spec` (or `/sr2e spec`) chat command: the spec, '' for the bare command, null for other text. */
export function chatCommandSpec(message: string): string | null {
  const m = /^\/sr2e?(?:\s+([\s\S]*))?$/i.exec(String(message ?? '').trim());
  if (!m) return null;
  return (m[1] ?? '').trim();
}

/** The /sr2 usage line (v0.89.6: translated when shown; the syntax words in it stay as they are typed). */
export const inlineTestUsage = (): string => tx('SR2E.Text.Inlinetest.usage');
