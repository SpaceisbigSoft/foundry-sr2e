import { RULES, type DamageLevel } from './config.ts';
import type { Attributes } from './stats.ts';
import { SPELL_CATEGORIES, type SpellCategory } from './magic.ts';
import { POWER_SPECIALS, ALLERGY_SEVERITIES, ADEPT_SPECIALS } from './critters.ts';
import { SPELL_DURATIONS } from './arcana.ts';
import { bioEffect } from './bioware.ts';
import { bioIndexV72 } from './vitals.ts';
import { sensoryEssence } from './cyberware.ts';
import { gearBook, gradeEssenceFactor, isDermalPlating, dermalRating, boneLacingBook, cyberReplacements, limbPairsBody } from './gear923.ts';
import { own } from './util.ts';
import { t as tx } from '../helpers/i18n.ts';

/**
 * Best-effort parser for SR2-style NPC stat blocks pasted as text, e.g.
 *
 *   B  Q  S  C  I  W  E  M  R  Armor
 *   4  5  4  2  3  3  5.2 -  5 (7)  5/3
 *   Initiative: 7 + 2D6
 *   Karma Pool/Professional Rating: 1/3
 *   Skills: Firearms 5, Unarmed Combat 4 (Martial Arts 6), Stealth 3
 *   Gear: Lined coat, Heavy pistol [9M], Stun baton [6S Stun]
 *
 * Anything it cannot read is reported in `warnings` rather than guessed silently.
 */

type AttributeKey = keyof Attributes;

const HEADER_TO_FIELD: Record<string, AttributeKey | 'essence' | 'magic' | 'reaction' | 'armor'> = {
  B: 'body', Q: 'quickness', S: 'strength', C: 'charisma', I: 'intelligence', W: 'willpower',
  E: 'essence', M: 'magic', R: 'reaction', ARMOR: 'armor', A: 'armor',
};

export interface ParsedAttribute {
  /** Natural rating. */
  base: number;
  /** Augmented rating if the block shows one, e.g. "4 (6)". */
  augmented?: number;
}

export interface ParsedSkill {
  name: string;
  rating: number;
  specialization?: string;
  /** Best guess at the linked attribute; check it. */
  attribute: AttributeKey | 'reaction';
}

export interface ParsedWeapon {
  name: string;
  power: number;
  level: DamageLevel;
  damageType: 'physical' | 'stun';
  melee: boolean;
  /** Name of the parsed skill this weapon most likely uses, or '' if none matched. */
  skill: string;
  /** "(STR+2)M": `power` is the bonus added to Strength. */
  strengthPower?: boolean;
  reach?: number;
}

export interface ParsedStatBlock {
  attributes: Partial<Record<AttributeKey, ParsedAttribute>>;
  essence?: number;
  magic?: number;
  reaction?: ParsedAttribute;
  armor?: { ballistic: number; impact: number };
  /** Total initiative dice, e.g. 2 for "7 + 2D6". */
  initiativeDice?: number;
  karmaPool?: number;
  professionalRating?: number;
  skills: ParsedSkill[];
  weapons: ParsedWeapon[];
  /** Cyberware and bioware ("Cyberware:", "Cyber:", "Bioware:"). */
  cyberware: ParsedCyberware[];
  /** "Spells:". */
  spells: ParsedSpell[];
  /** "Powers:", "Critter Powers:", "Adept Powers:", "Weaknesses:". */
  powers: ParsedPower[];
  warnings: string[];
}

const DASH = /^[-–—]$/;

/**
 * v0.89.6: the warnings the importers filter by kind carry a code (the text is translated, so it can't be matched):
 * kept beside the list (keyed by the warnings array, then the text), so the lists stay plain strings.
 */
const WARNING_CODES = new WeakMap<string[], Map<string, StatBlockWarningCode>>();
export type StatBlockWarningCode = 'noAttributeHeader' | 'attributeHeaderNoValues' | 'powerNoAttribute' | 'critterPowerAttributes' | 'essenceGuessed' | 'essenceUnknown' | 'drainNotGiven';
/** Review (v0.89.6): every coded text ever written, so a copy of a list (spread, filter, clone) still finds its codes. */
const CODED_TEXTS = new Map<string, StatBlockWarningCode>();
function warnCoded(list: string[], code: StatBlockWarningCode, text: string): void {
  list.push(text);
  let m = WARNING_CODES.get(list);
  if (!m) WARNING_CODES.set(list, (m = new Map()));
  m.set(text, code);
  if (CODED_TEXTS.size < 5000) CODED_TEXTS.set(text, code);
}
/** The code of a warning in a list `parseStatBlock` or `statBlockItems` returned ('' for one without a code). */
export function statBlockWarningCode(list: readonly string[], text: string): StatBlockWarningCode | '' {
  return WARNING_CODES.get(list as string[])?.get(text) ?? CODED_TEXTS.get(text) ?? '';
}

/** "4", "4(6)", "4 (6)", "-" → rating; null if unreadable. */
function parseRatingCell(cell: string): ParsedAttribute | null {
  const c = cell.trim();
  if (DASH.test(c)) return { base: 0 };
  const m = /^(-?\d+(?:\.\d+)?)\s*(?:\(\s*(-?\d+(?:\.\d+)?)\s*\))?$/.exec(c);
  if (!m) return null;
  const base = Number(m[1]);
  return m[2] !== undefined ? { base, augmented: Number(m[2]) } : { base };
}

/**
 * Split a value row into cells. Values are separated by whitespace, but an augmented value in
 * parentheses belongs to the cell before it, so "5 (7)" is one cell.
 */
function splitValueRow(line: string): string[] {
  const raw = line.trim().split(/\s+/);
  const cells: string[] = [];
  for (const tok of raw) {
    if (/^\(.*\)$/.test(tok) && cells.length > 0) cells[cells.length - 1] += ` ${tok}`;
    else cells.push(tok);
  }
  return cells;
}

function isHeaderRow(tokens: string[]): boolean {
  const known = tokens.filter((t) => t.toUpperCase() in HEADER_TO_FIELD);
  const core = tokens.filter((t) => ['B', 'Q', 'S', 'C', 'I', 'W'].includes(t.toUpperCase()));
  return core.length >= 4 && known.length === tokens.length;
}

const SKILL_ATTRIBUTE_HINTS: Array<[RegExp, AttributeKey | 'reaction']> = [
  [/\bB\/R$/i, 'intelligence'],
  [/armed|edged|club|unarmed|martial|polearm|whip|cyber-implant/i, 'strength'],
  // v0.58.0: vehicle skills link to Reaction (SR2).
  [/\b(car|bike|hovercraft|motorboat|ship|submarine|aircraft|rotorcraft|drive|driving|pilot)\b/i, 'reaction'],
  // v0.71.0 (R4): Athletics is a Body skill in SR2 (as RULES.STREET.athletics.attribute).
  [/athlet/i, 'body'],
  [/firearm|pistol|rifle|shotgun|smg|gun|throw|projectile|bow|stealth|launch/i, 'quickness'],
  [/etiquette|negotiat|leader|interrogat|instruct|con\b/i, 'charisma'],
  [/conjur|sorcer|magic/i, 'willpower'],
];

export function guessSkillAttribute(name: string): AttributeKey | 'reaction' {
  for (const [re, attr] of SKILL_ATTRIBUTE_HINTS) if (re.test(name)) return attr;
  return 'intelligence';
}

const MELEE_HINT = /knife|blade|sword|katana|club|baton|axe|staff|unarmed|fist|claw|bite|spur|reach|whip|melee|sap/i;
const RANGED_SKILL = /firearm|pistol|rifle|shotgun|smg|gun|projectile|bow|throw/i;
const MELEE_SKILL = /armed|edged|club|unarmed|martial|melee|polearm|whip/i;

/** Text after "Label:" up to the next "Label:" line (lists often wrap onto several lines). */
function sectionText(lines: string[], label: RegExp): string | null {
  const start = lines.findIndex((l) => label.test(l));
  if (start < 0) return null;
  const first = (lines[start] as string).replace(label, '').replace(/^\s*:?\s*/, '');
  const parts = [first];
  for (let i = start + 1; i < lines.length; i++) {
    const l = lines[i] as string;
    if (/^\s*[A-Za-z][A-Za-z /]*:/.test(l) || l.trim() === '') break;
    parts.push(l.trim());
  }
  return parts.join(' ').trim();
}

/**
 * Split on commas (and semicolons with `semicolons`) that are not inside brackets, parentheses or braces, trimmed,
 * empty parts dropped. v0.81.0 (RC-14): the one bracket-aware splitter (charimport's copy differed: it tracked braces,
 * so "Foo {a, b}" survived its split and was then cut here).
 */
export function splitTopLevel(text: string, o: { semicolons?: boolean } = {}): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of text) {
    if (ch === '[' || ch === '(' || ch === '{') depth++;
    if (ch === ']' || ch === ')' || ch === '}') depth = Math.max(0, depth - 1);
    if ((ch === ',' || (o.semicolons && ch === ';')) && depth === 0) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim()).filter(Boolean);
}

/** v0.81.0 (SEC2-7): the most text one parse reads (a large NPC stat block is a few thousand characters). */
export const MAX_STAT_BLOCK_CHARS = 100_000;

/** The text's lines, each with its runs of blanks (spaces, tabs, NBSP…) collapsed to one space. */
export function collapseLines(text: string): string[] {
  return text.replace(/\r/g, '').split('\n').map((l) => l.replace(/[^\S\n]+/g, ' '));
}

export function parseStatBlock(text: string): ParsedStatBlock {
  const result: ParsedStatBlock = { attributes: {}, skills: [], weapons: [], cyberware: [], spells: [], powers: [], warnings: [] };
  text = String(text ?? '');
  if (text.length > MAX_STAT_BLOCK_CHARS) {
    result.warnings.push(tx('SR2E.Text.Statblock.theTextIsOverCharacters', { max: MAX_STAT_BLOCK_CHARS.toLocaleString('en') }));
    text = text.slice(0, MAX_STAT_BLOCK_CHARS);
  }
  // v0.81.1 (RC2-1, SEC2b-3): collapse every run of blanks once, here, so no pattern below can backtrack over a long
  // run of spaces (the Strength damage code was cubic in it).
  const lines = collapseLines(text);

  // Attribute header + value row
  const headerIdx = lines.findIndex((l) => isHeaderRow(l.trim().split(/\s+/).filter(Boolean)));
  if (headerIdx < 0) {
    warnCoded(result.warnings, 'noAttributeHeader', tx('SR2E.Text.Statblock.noAttributeHeaderRowB'));
  } else {
    const headers = (lines[headerIdx] as string).trim().split(/\s+/);
    const valueLine = lines.slice(headerIdx + 1).find((l) => l.trim() !== '');
    if (!valueLine) {
      warnCoded(result.warnings, 'attributeHeaderNoValues', tx('SR2E.Text.Statblock.attributeHeaderFoundButNo'));
    } else {
      const cells = splitValueRow(valueLine);
      if (cells.length !== headers.length) {
        result.warnings.push(tx('SR2E.Text.Statblock.headerHasColumnsButThe', { headers: headers.length, cells: cells.length }));
      }
      headers.forEach((h, i) => {
        const field = HEADER_TO_FIELD[h.toUpperCase()];
        const cell = cells[i];
        if (!field || cell === undefined) return;
        if (field === 'armor') {
          const m = /^(\d+)\s*\/\s*(\d+)$/.exec(cell.trim());
          if (m) result.armor = { ballistic: Number(m[1]), impact: Number(m[2]) };
          else if (DASH.test(cell.trim())) result.armor = { ballistic: 0, impact: 0 };
          else result.warnings.push(tx('SR2E.Text.Statblock.couldNotReadArmor', { cell }));
          return;
        }
        const v = parseRatingCell(cell);
        if (!v) {
          result.warnings.push(tx('SR2E.Text.Statblock.couldNotReadValue', { h, cell }));
          return;
        }
        if (field === 'essence') result.essence = v.augmented ?? v.base;
        else if (field === 'magic') result.magic = v.base;
        else if (field === 'reaction') result.reaction = v;
        else result.attributes[field] = v;
      });
    }
  }

  // Initiative: "7 + 2D6"
  const init = lines.map((l) => /init(?:iative)?\s*:?\s*(\d+)\s*\+\s*(\d+)\s*d6/i.exec(l)).find(Boolean);
  if (init) result.initiativeDice = Number(init[2]);

  // Karma Pool / Professional Rating
  for (const l of lines) {
    const both = /karma\s*pool\s*\/\s*professional\s*rating\s*:?\s*(\d+)\s*\/\s*(\d+)/i.exec(l);
    if (both) {
      result.karmaPool = Number(both[1]);
      result.professionalRating = Number(both[2]);
      continue;
    }
    const pr = /professional\s*rating\s*:?\s*(\d+)/i.exec(l);
    if (pr) result.professionalRating = Number(pr[1]);
    const kp = /karma\s*pool\s*:?\s*(\d+)/i.exec(l);
    if (kp) result.karmaPool = Number(kp[1]);
  }

  // Skills
  const skillsText = sectionText(lines, /^\s*skills\b/i);
  if (skillsText) {
    for (const entry of splitTopLevel(skillsText)) {
      const m = /^(.+?)\s+(\d+)(?:\s*\((.+?)\))?\s*$/.exec(entry);
      if (!m) {
        result.warnings.push(tx('SR2E.Text.Statblock.couldNotReadSkill', { entry }));
        continue;
      }
      // "Etiquette (Corporate) 2" puts the specialization in the name; pull it out.
      const named = /^(.+?)\s*\((.+)\)$/.exec((m[1] as string).trim());
      const name = (named ? named[1] : m[1]) as string;
      const skill: ParsedSkill = { name: name.trim(), rating: Number(m[2]), attribute: guessSkillAttribute(name) };
      const spec = m[3] ?? named?.[2];
      if (spec) skill.specialization = spec.trim();
      result.skills.push(skill);
    }
  }

  // Weapons: any gear entry whose brackets/parens contain a damage code
  const gearText = sectionText(lines, /^\s*(gear|weapons?|equipment|attacks?)\b/i);
  if (gearText) {
    for (const entry of splitTopLevel(gearText)) {
      const bracket = /^(.*?)[[(](.*)[\])]\s*$/.exec(entry);
      if (!bracket) continue;
      const inside = bracket[2] as string;
      // "(STR+2)M", "STR M Stun", "(Str-1)L": Power from Strength.
      const str = /\(?\s*str(?:ength)?\s*(?:([+-])\s*(\d+))?\s*\)?\s*([LMSD])\b/i.exec(inside);
      const code = str ? null : /\b(\d+)\s*([LMSD])\b/.exec(inside);
      if (!code && !str) continue;
      const name = (bracket[1] as string).trim() || 'Weapon';
      const melee = Boolean(str) || MELEE_HINT.test(name) || MELEE_HINT.test(inside);
      const skillRe = melee ? MELEE_SKILL : RANGED_SKILL;
      const reach = /reach\s*:?\s*(\d+)/i.exec(inside);
      result.weapons.push({
        name,
        power: str ? (str[1] === '-' ? -1 : 1) * Number(str[2] ?? 0) : Number(code![1]),
        level: ((str ? str[3] : code![2]) as string).toUpperCase() as DamageLevel,
        damageType: /stun/i.test(inside) ? 'stun' : 'physical',
        melee,
        skill: result.skills.find((s) => skillRe.test(s.name))?.name ?? '',
        ...(str ? { strengthPower: true } : {}),
        ...(reach ? { reach: Number(reach[1]) } : {}),
      });
    }
  }

  parseItemSections(lines, result);

  return result;
}

// ===================================================================== Cyberware, spells, powers
/*
 * Stat block importer, part 2: cyberware, bioware, spells and powers (and `statBlockItems`, which
 * turns them into item creation data for the cyberware, spell, power and adeptpower models).
 *
 * WHAT IS GUESSED. Every table below is from memory of SR2 (core book, Shadowtech, the Grimoire)
 * and is VERIFY; nothing is copied from a book:
 * - CYBER_RULES: which RULES.CYBERWARE.kinds a cyberware name is, its effect fields (Reaction,
 *   initiative dice, armor, vision, smartlink, limb...) and its standard-grade Essence cost when
 *   the block does not give one.
 * - BIO_RULES: which RULES.BIOWARE.kinds a bioware name is, and its Body Index cost.
 * - SPELL_TABLE: category, mana/physical, area, duration, resisting attribute, element. Unknown
 *   spells get a category from keywords in the name, else manipulation (warned). Drain is set only
 *   when the block states it ("[Drain +1 S]").
 * - ADEPT_RULES: power point cost and how each adept power is expressed on the adeptpower model.
 * - CRITTER_RULES: which critter powers are passive, their `special`, and a few resist/effect hints.
 * statBlockItems() lists every item whose Essence, Body Index or power point cost was guessed.
 */

export type CyberGradeName = 'standard' | 'alpha' | 'beta' | 'delta';
type SpellDuration = (typeof SPELL_DURATIONS)[number];
type ResistKey = 'none' | AttributeKey;

export interface ParsedCyberware {
  name: string;
  /** 0 when the block gives none. */
  rating: number;
  grade: CyberGradeName;
  /** Essence as written in the block (already for its grade), if given. */
  essence?: number;
  /** Body Index as written in the block, if given (bioware). */
  bodyIndex?: number;
  /** Other text in parentheses/brackets, e.g. "low-light, thermographic". */
  options: string;
  bioware: boolean;
}

export interface ParsedSpell {
  name: string;
  /** Force it is known at (0 if the block gives none). */
  force: number;
  category: SpellCategory;
  spellType: 'mana' | 'physical';
  area: boolean;
  elemental: boolean;
  /** 'fire', 'lightning', 'acid'... ('' if not elemental). */
  element: string;
  exclusive: boolean;
  fetish: boolean;
  duration: SpellDuration;
  /** Non-combat spells: the attribute an unwilling target resists with. */
  resist: ResistKey;
  /** Health spells that heal damage. */
  heals: boolean;
  /** Combat spells: Physical or Stun damage. */
  damageType?: 'physical' | 'stun';
  /** A damage level given in the block, e.g. "Manabolt 5 (S)". */
  damageLevel?: DamageLevel;
  /** Drain stated in the block, e.g. "[Drain +1 S]". */
  drain?: { modifier: number; level: DamageLevel };
  /** v0.78.0: from the spell table: range and a fixed TN. */
  range?: 'los' | 'touch';
  targetNumber?: number;
  /** In the spell table (false: category guessed from the name). */
  known: boolean;
  options: string;
}

export interface ParsedPower {
  name: string;
  /** Rating or level (0 if none). */
  rating: number;
  /** Text in parentheses, e.g. "sunlight, severe" or "Firearms". */
  options: string;
  /** An adept power (listed as "Adept Powers", or guessed for an adept). */
  adept: boolean;
  /** A weakness (listed under "Weaknesses", or an allergy, vulnerability or Essence loss). */
  weakness: boolean;
  /** Which label it was listed under. */
  section: 'powers' | 'critter' | 'adept' | 'weaknesses';
  /** A damage level in parentheses, e.g. "Killing Hands (S)". */
  level?: DamageLevel;
}

export interface StatBlockItem {
  name: string;
  type: string;
  system: Record<string, unknown>;
}

// ---------------------------------------------------------------- Entry parsing

interface EntryParts {
  name: string;
  rating: number;
  hasRating: boolean;
  grade: CyberGradeName;
  essence?: number;
  bodyIndex?: number;
  level?: DamageLevel;
  drain?: { modifier: number; level: DamageLevel };
  options: string[];
}

const NUM = String.raw`(\d*\.?\d+)`;
const ESSENCE_RES = [new RegExp(String.raw`^(?:essence|ess\.?|e)\s*:?\s*${NUM}$`, 'i'), new RegExp(String.raw`^${NUM}\s*(?:essence|ess\.?|e)$`, 'i')];
const BODY_INDEX_RES = [new RegExp(String.raw`^(?:body\s*index|b\.?\s*i\.?)\s*:?\s*${NUM}$`, 'i'), new RegExp(String.raw`^${NUM}\s*(?:body\s*index|b\.?\s*i\.?)$`, 'i')];
const GRADE_TOKEN = /^(standard|alpha|beta|delta)(?:[-\s]*grade)?$/i;
/**
 * "Drain [(F/2)+1]M" and the like. v0.81.0 (SEC2-7): matched against the token with ALL whitespace removed, because the
 * old pattern's run of adjacent optional `\s*` groups backtracked exponentially (100 spaces froze the importer).
 */
const DRAIN_TOKEN = /^drain:?\[?(?:\(?f\/2\)?)?([+-]\d+)?\]?([LMSD])$/i;
const RATING_TOKEN = /^(?:rating|level|lvl|force|r|f)?\s*:?\s*\+?(\d+)$/i;

/** Text outside top-level brackets, and the contents of each top-level (...) or [...]. */
function entryGroups(entry: string): { rest: string; groups: string[] } {
  let depth = 0;
  let rest = '';
  let cur = '';
  const groups: string[] = [];
  for (const ch of entry) {
    if (ch === '(' || ch === '[') {
      if (depth === 0) {
        depth = 1;
        cur = '';
        continue;
      }
      depth++;
    } else if ((ch === ')' || ch === ']') && depth > 0) {
      depth--;
      if (depth === 0) {
        groups.push(cur);
        rest += ' ';
        continue;
      }
    }
    if (depth > 0) cur += ch;
    else rest += ch;
  }
  if (depth > 0 && cur.trim()) groups.push(cur);
  return { rest: rest.replace(/\s+/g, ' ').trim(), groups };
}

/** "Alpha Wired Reflexes 2 [Essence 2.4]", "Heal (4)", "Improved Ability (Firearms) 2", "Killing Hands (S)". */
function parseEntry(entry: string): EntryParts {
  const { rest, groups } = entryGroups(entry);
  const out: EntryParts = { name: '', rating: 0, hasRating: false, grade: 'standard', options: [] };
  let name = rest;
  const pre = /^(alpha|beta|delta)(?:[-\s]*grade)?\s+(.+)$/i.exec(name);
  if (pre) {
    out.grade = (pre[1] as string).toLowerCase() as CyberGradeName;
    name = pre[2] as string;
  }
  const post = /^(.+?)[\s,-]+(alpha|beta|delta)(?:[-\s]*grade)?$/i.exec(name);
  if (post) {
    out.grade = (post[2] as string).toLowerCase() as CyberGradeName;
    name = post[1] as string;
  }
  const r = /^(.*?\S)\s+(?:(?:rating|level|lvl|force)\s*:?\s*)?\+?(\d+)\s*(?:mp)?$/i.exec(name);
  if (r) {
    name = r[1] as string;
    out.rating = Number(r[2]);
    out.hasRating = true;
  }
  out.name = name.replace(/[\s:,-]+$/, '').trim();
  for (const group of groups) {
    for (const rawTok of splitTopLevel(group.replace(/;/g, ','))) {
      // v0.81.0 (SEC2-7): one space at most between words, so no token pattern can backtrack over a long blank run.
      const tok = rawTok.replace(/\s+/g, ' ');
      const ess = ESSENCE_RES.map((re) => re.exec(tok)).find(Boolean);
      const bi = BODY_INDEX_RES.map((re) => re.exec(tok)).find(Boolean);
      const grade = GRADE_TOKEN.exec(tok);
      const drain = /^drain/i.test(tok) ? DRAIN_TOKEN.exec(tok.replace(/ /g, '')) : null;
      const rating = RATING_TOKEN.exec(tok);
      if (ess) out.essence = Number(ess[1]);
      else if (bi) out.bodyIndex = Number(bi[1]);
      else if (grade) out.grade = (grade[1] as string).toLowerCase() as CyberGradeName;
      else if (drain) out.drain = { modifier: Number(drain[1] ?? '0'), level: (drain[2] as string).toUpperCase() as DamageLevel };
      else if (/^[LMSD]$/i.test(tok)) out.level = tok.toUpperCase() as DamageLevel;
      else if (rating && !out.hasRating) {
        out.rating = Number(rating[1]);
        out.hasRating = true;
      } else if (rating) continue;
      else out.options.push(tok);
    }
  }
  return out;
}

const norm = (s: string) => s.toLowerCase().replace(/[’`]/g, "'").replace(/\s+/g, ' ').trim();
const round2 = (n: number) => Math.round(n * 100) / 100;
/** Value for a rating from a 1-based table (clamped to its ends). */
const byRating = (table: readonly number[], r: number): number => table[Math.min(table.length, Math.max(1, r)) - 1] ?? 0;
/** v0.92.3 (RULES.GEAR_V923.wareTables): the book's number, or the old guess. */
const bk = <T,>(book: T, old: T): T => (gearBook('wareTables') ? book : old);

// ---------------------------------------------------------------- Cyberware and bioware tables (VERIFY)

interface CyberCtx { r: number; text: string }
interface CyberRule {
  re: RegExp;
  kind: string;
  /** Standard-grade Essence (null = unknown). VERIFY: from memory of SR2. */
  essence: (c: CyberCtx) => number | null;
  /** Effect fields on the cyberware item. */
  effects?: (c: CyberCtx) => Record<string, unknown>;
  /** Needs a rating to mean anything (assumed 1, warned, when missing). */
  needsRating?: boolean;
  /** A cyberweapon: its Strength-based damage level. */
  weaponLevel?: DamageLevel;
}

const EYE_OPTIONS: Array<[RegExp, number]> = [
  // VERIFY: Essence per cybereye option.
  [/low.?light/i, 0.2], [/thermo/i, 0.2], [/flare/i, 0.1], [/image\s*link/i, 0.2], [/camera/i, 0.4],
];
const EAR_OPTIONS: Array<[RegExp, number]> = [
  // VERIFY: Essence per cyberear option.
  [/hi(?:gh)?.?freq/i, 0.2], [/low.?freq/i, 0.2], [/damp(?:er|ener)/i, 0.1], [/recorder/i, 0.3],
  // v0.78.0: hearing amplification (Core Rules: +0.2 Essence).
  [/amplif|hearing\s*amp/i, 0.2],
];
function magnificationOf(text: string): number {
  const m = /(?:magnification|\bmag)\s*(?:x\s*)?(\d)?/i.exec(text);
  return m ? Math.min(3, Math.max(1, Number(m[1] ?? 1))) : 0;
}

const CYBER_RULES: CyberRule[] = [
  { re: /wired\s*reflex/i, kind: 'reflexes', needsRating: true, essence: (c) => byRating([2, 3, 5], c.r),
    effects: (c) => ({ reaction: 2 * Math.min(3, c.r), initiativeDice: Math.min(3, c.r), reflexes: 'wired' }) },
  { re: /boosted\s*reflex/i, kind: 'reflexes', needsRating: true, essence: (c) => byRating([0.5, 1.25, 2.8], c.r),
    // v0.92.3: Reaction —/+1/+2 (SSC p. 87; was +1/+2/+3).
    effects: (c) => ({ reaction: bk(byRating([0, 1, 2], c.r), Math.min(3, c.r)), initiativeDice: byRating([1, 1, 2], c.r), reflexes: 'boosted' }) },
  { re: /reaction\s*enhanc/i, kind: 'reflexes', needsRating: true, essence: (c) => round2(0.3 * c.r),
    effects: (c) => ({ reaction: c.r, reflexes: 'enhancer' }) },
  { re: /control\s*rig|\bvcr\b/i, kind: 'other', needsRating: true, essence: (c) => byRating([2, 3, 5], c.r),
    effects: (c) => ({ controlRig: Math.min(3, c.r) }) },
  { re: /smart\s*-?(?:gun\s*)?link/i, kind: 'other', essence: () => 0.5,
    effects: (c) => ({ smartlink: true, smartlinkLevel: c.r >= 2 || /\bii\b/i.test(c.text) ? 2 : 1 }) },
  { re: /data\s*-?jack/i, kind: 'datajack', essence: () => 0.2 },
  { re: /chip\s*-?jack/i, kind: 'chipjack', essence: () => 0.2 },
  // v0.92.3: .1/.2/.3 × rating by band (Core p. 249; FoF p. 103; was .2 × rating).
  { re: /skill\s*-?wires?/i, kind: 'skillwires', needsRating: true, essence: (c) => bk(round2((c.r <= 3 ? 0.1 : c.r <= 6 ? 0.2 : 0.3) * c.r), round2(0.2 * c.r)) },
  // v0.92.3: levels 1–4 .5/.75/1.5/1.75 (Shadowtech p. 49; was .75/1.5 for 1–2).
  { re: /encephalon/i, kind: 'encephalon', needsRating: true, essence: (c) => bk(byRating([0.5, 0.75, 1.5, 1.75], c.r), byRating([0.75, 1.5], c.r)) },
  { re: /headware\s*memory|\bmemory\b/i, kind: 'memory', essence: (c) => (c.r > 0 ? round2(0.01 * c.r) : null) },
  { re: /\bradio\b/i, kind: 'other', essence: () => 0.75 },
  { re: /(?:tele)?phone/i, kind: 'other', essence: () => 0.5 },
  { re: /dermal\s*plat/i, kind: 'other', needsRating: true, essence: (c) => byRating([0.5, 1, 1.5], c.r),
    effects: (c) => ({ armorBallistic: Math.min(3, c.r), armorImpact: Math.min(3, c.r) }) },
  { re: /muscle\s*replace/i, kind: 'other', needsRating: true, essence: (c) => c.r,
    effects: (c) => ({ attributes: attrs({ strength: c.r, quickness: c.r }) }) },
  { re: /cyber\s*-?eyes?|\beyes?\b|low.?light|thermo|flare\s*comp|magnif|image\s*link|eye\s*camera/i, kind: 'eyes',
    // v0.78.0 (RULES.BOOK_V78.senseAllowance): enhancements inside cybereyes are free up to 0.5 Essence.
        // v0.92.3: vision magnification is a flat .2 (optical) or .1 (electronic) at any level (SSC p. 85; was .1 × level).
    essence: (c) => { const host = /cyber\s*-?eye|\beyes?\b/i.test(c.text); const mag = magnificationOf(c.text); return sensoryEssence('eyes', { base: host ? 0.2 : 0, host, options: [...EYE_OPTIONS.filter(([re]) => re.test(c.text)).map(([, e]) => e), ...(mag ? [bk(/electronic/i.test(c.text) ? 0.1 : 0.2, 0.1 * mag)] : [])] }); },
    effects: (c) => ({
      ...(/low.?light/i.test(c.text) ? { lowLight: true } : {}),
      ...(/thermo/i.test(c.text) ? { thermographic: true } : {}),
      ...(/flare/i.test(c.text) ? { flareComp: true } : {}),
      ...(/ultra\s*sound/i.test(c.text) ? { ultrasound: true } : {}),
      ...(magnificationOf(c.text) ? { magnification: magnificationOf(c.text) } : {}),
    }) },
  { re: /cyber\s*-?ears?|\bears?\b|hi(?:gh)?.?freq|low.?freq|dampener/i, kind: 'ears',
    // v0.78.0 (RULES.BOOK_V78.senseAllowance): one feature of 0.2 Essence or less inside cyberears is free.
    essence: (c) => { const host = /cyber\s*-?ear|\bears?\b/i.test(c.text); return sensoryEssence('ears', { base: host ? 0.3 : 0, host, options: EAR_OPTIONS.filter(([re]) => re.test(c.text)).map(([, e]) => e) }); },
    effects: (c) => ({
      ...(/amplif|hearing\s*amp/i.test(c.text) ? { hearingAmp: 1 } : {}),
      ...(/damp(?:er|ener)/i.test(c.text) ? { dampener: true } : {}),
    }) },
  // v0.92.3: a cyberhand or foot .35, a forearm or lower leg .65 (Cybertechnology p. 98; was .25 for a hand or foot).
  { re: /cyber\s*-?(?:arm|leg|hand|foot)/i, kind: 'cyberlimb', essence: (c) => (/hand|foot/i.test(c.text) ? bk(0.35, 0.25) : bk(/fore\s*-?arm|lower\s*leg/i.test(c.text) ? 0.65 : 1, 1)),
    effects: (c) => {
      const leg = /leg|foot/i.test(c.text);
      const left = /\bleft\b/i.test(c.text);
      const str = /(?:strength|\bstr)\s*:?\s*(\d+)/i.exec(c.text);
      const qui = /(?:quickness|\bqui?)\s*:?\s*(\d+)/i.exec(c.text);
      return { limb: {
        location: /hand|foot/i.test(c.text) ? 'other' : `${left ? 'left' : 'right'}${leg ? 'Leg' : 'Arm'}`,
        ...(str ? { strength: Number(str[1]) } : {}), ...(qui ? { quickness: Number(qui[1]) } : {}),
      } };
    } },
  { re: /retractable\s*spurs?/i, kind: 'cyberweapon', essence: () => 0.3, weaponLevel: 'M' },
  { re: /\bspurs?\b/i, kind: 'cyberweapon', essence: () => 0.1, weaponLevel: 'M' },
  { re: /retractable\s*(?:hand\s*)?razors?/i, kind: 'cyberweapon', essence: () => 0.2, weaponLevel: 'L' },
  { re: /razors?/i, kind: 'cyberweapon', essence: () => 0.1, weaponLevel: 'L' },
  // v0.92.3: tailored pheromones are bioware, Body Cost .4/.6 (Shadowtech p. 18; was cyberware at that Essence).
  { re: /pheromones?/i, kind: 'pheromones', needsRating: true, essence: (c) => bk(0, byRating([0.4, 0.6], c.r)), effects: (c) => ({ pheromones: c.r, ...(gearBook('wareTables') ? { bioware: true, bodyIndex: byRating([0.4, 0.6], c.r) } : {}) }) },
  // v0.58.0: bone lacing and filtration get their own kinds (and what they do).
  { re: /bone\s*lacing/i, kind: 'boneLacing', effects: (c) => ({ lacing: /titanium/i.test(c.text) ? 'titanium' : /alumin/i.test(c.text) ? 'aluminum' : 'plastic' }), essence: (c) => (/titanium/i.test(c.text) ? 2.25 : /alumin/i.test(c.text) ? 1.15 : /plastic/i.test(c.text) ? 0.5 : null) },
  { re: /voice\s*mod/i, kind: 'other', essence: () => 0.2 },
  { re: /\biccm\b|biofeedback\s*filter/i, kind: 'iccm', essence: () => null },
  { re: /(air|blood|ingested)\s*(?:filtration|filter)/i, kind: 'filtration', needsRating: true, effects: (c) => ({ filterKind: /blood/i.test(c.text) ? 'blood' : /ingest/i.test(c.text) ? 'ingested' : 'air' }), essence: (c) => round2((/blood/i.test(c.text) || (gearBook('wareTables') && /ingest/i.test(c.text)) ? 0.2 : 0.1) * c.r) }, // v0.92.3: ingested-toxin filters rating ÷ 5 (Core p. 248; FoF p. 102; was ÷ 10)
];

interface BioRule {
  re: RegExp;
  bioKind: string;
  /** Body Index (null = unknown). VERIFY: from memory of SR2 Shadowtech. */
  bodyIndex: (r: number) => number | null;
  /** The rating changes what it does (assumed 1, warned, when missing). */
  scales?: boolean;
  /** Its effects are not modelled by the system. */
  unmodelled?: boolean;
}

const BIO_RULES: BioRule[] = [
  // v0.92.3 (RULES.GEAR_V923.wareTables 'book'): Shadowtech's Body Costs (FoF pp. 103–104).
  { re: /muscle\s*aug/i, bioKind: 'muscleAugmentation', scales: true, bodyIndex: (r) => bk(round2(0.8 * Math.min(4, r)), round2(0.2 * r)) },
  { re: /cerebral\s*boost/i, bioKind: 'cerebralBooster', scales: true, bodyIndex: (r) => bk(byRating([0.4, 0.8], r), byRating([0.2, 0.4], r)) },
  { re: /synaptic\s*acc/i, bioKind: 'synapticAccelerator', scales: true, bodyIndex: (r) => bk(byRating([0.3, 1.6], r), byRating([0.4, 1], r)) },
  { re: /adrenal\s*pump/i, bioKind: 'adrenalPump', scales: true, bodyIndex: (r) => bk(byRating([1.25, 2.5], r), byRating([0.25, 0.75], r)) },
  { re: /orthoskin/i, bioKind: 'orthoskin', scales: true, bodyIndex: (r) => bk(byRating([0.5, 1, 1.5], r), byRating([0.25, 0.5, 0.75], r)) },
  { re: /toxin\s*extract/i, bioKind: 'toxinExtractor', scales: true, bodyIndex: (r) => round2(0.2 * r) },
  { re: /trache(?:a)?l\s*filter/i, bioKind: 'trachealFilter', scales: true, bodyIndex: (r) => round2(0.2 * r) },
  { re: /platelet\s*fact/i, bioKind: 'plateletFactory', bodyIndex: () => 0.4 },
  { re: /damage\s*compensat/i, bioKind: 'damageCompensator', scales: true, bodyIndex: (r) => round2(0.2 * r) },
  { re: /enhanced\s*articul/i, bioKind: 'enhancedArticulation', bodyIndex: () => 0.6 },
  { re: /trauma\s*damper/i, bioKind: 'traumaDamper', scales: true, bodyIndex: () => 0.4 },
  { re: /pain\s*editor/i, bioKind: 'painEditor', bodyIndex: () => 0.6 },
  { re: /suprathyroid/i, bioKind: 'suprathyroid', bodyIndex: () => bk(1.4, 0.7) },
  { re: /reflex\s*recorder/i, bioKind: 'other', unmodelled: true, bodyIndex: () => 0.25 },
  { re: /mnemonic\s*enhanc/i, bioKind: 'other', unmodelled: true, bodyIndex: (r) => bk(round2(0.2 * Math.max(1, r)), round2(0.1 * Math.max(1, r))) },
  { re: /nephritic\s*screen/i, bioKind: 'nephriticScreen', bodyIndex: () => 0.4 },
  { re: /extended\s*volume/i, bioKind: 'extendedVolume', scales: true, bodyIndex: (r) => bk(byRating([0.2, 0.3, 0.4], r), round2(0.2 * Math.max(1, r))) },
  // v0.72.0 (O9): Shadowtech symbiotes (rules/vitals.ts). VERIFY Body Index.
  { re: /symbiote/i, bioKind: 'symbiotes', scales: true, bodyIndex: (r) => bioIndexV72('symbiotes', r) ?? round2(0.2 * Math.max(1, r)) },
];

const isBiowareName = (name: string) => BIO_RULES.some((b) => b.re.test(name));

function attrs(bonus: Partial<Record<AttributeKey, number>>): Record<AttributeKey, number> {
  return { body: 0, quickness: 0, strength: 0, charisma: 0, intelligence: 0, willpower: 0, ...bonus };
}

// ---------------------------------------------------------------- Spell table (VERIFY)

interface SpellInfo {
  category: SpellCategory;
  spellType: 'mana' | 'physical';
  area?: boolean;
  damageType?: 'physical' | 'stun';
  duration?: SpellDuration;
  resist?: ResistKey;
  heals?: boolean;
  element?: string;
  /** v0.78.0: range, a fixed TN and the drain code, when the book gives them (Hibernate). */
  range?: 'los' | 'touch';
  targetNumber?: number;
  drain?: { modifier: number; level: DamageLevel };
}

const sp = (category: SpellCategory, spellType: 'mana' | 'physical', x: Omit<SpellInfo, 'category' | 'spellType'> = {}): SpellInfo => ({ category, spellType, ...x });
const AREA = { area: true };

/** VERIFY: well-known SR2 spells, from memory. */
const SPELL_TABLE: Record<string, SpellInfo> = {
  // Combat
  manabolt: sp('combat', 'mana', { damageType: 'physical' }), manaball: sp('combat', 'mana', { damageType: 'physical', ...AREA }),
  powerbolt: sp('combat', 'physical', { damageType: 'physical' }), powerball: sp('combat', 'physical', { damageType: 'physical', ...AREA }),
  stunbolt: sp('combat', 'mana', { damageType: 'stun' }), stunball: sp('combat', 'mana', { damageType: 'stun', ...AREA }),
  'death touch': sp('combat', 'mana', { damageType: 'physical' }), sleep: sp('combat', 'mana', { damageType: 'stun', ...AREA }),
  // Detection
  clairvoyance: sp('detection', 'mana'), clairaudience: sp('detection', 'mana'),
  'detect enemies': sp('detection', 'mana'), 'detect life': sp('detection', 'mana'), 'detect magic': sp('detection', 'mana'),
  'detect individual': sp('detection', 'mana'), 'analyze truth': sp('detection', 'mana', { resist: 'willpower' }),
  'analyze device': sp('detection', 'physical'), 'mind probe': sp('detection', 'mana', { resist: 'willpower' }),
  'combat sense': sp('detection', 'physical') /* v0.77.0 */, telepathy: sp('detection', 'mana'), mindlink: sp('detection', 'mana'),
  // Health
  heal: sp('health', 'mana', { heals: true, duration: 'permanent' }), treat: sp('health', 'mana', { heals: true, duration: 'permanent' }),
  antidote: sp('health', 'physical', { duration: 'permanent' }), 'cure disease': sp('health', 'physical', { duration: 'permanent' }), // v0.77.0 book check: Physical
  detox: sp('health', 'physical', { duration: 'permanent' }), 'resist pain': sp('health', 'mana'), stabilize: sp('health', 'physical', { duration: 'permanent' }),
  prophylaxis: sp('health', 'physical'),
  // v0.78.0 owner's decision: the spell page (Core Rules): Physical, touch, TN 4, sustained, (F/2)S drain, on a voluntary or
  // unconscious subject (no resistance); a Manipulation (Control) spell in the book (was health/physical, LOS).
  hibernate: sp('manipulation', 'physical', { range: 'touch', targetNumber: 4, duration: 'sustained', resist: 'none', drain: { modifier: 0, level: 'S' } }), 'increase reflexes': sp('health', 'mana'),
  // Illusion
  invisibility: sp('illusion', 'mana'), 'improved invisibility': sp('illusion', 'physical'),
  mask: sp('illusion', 'mana'), 'physical mask': sp('illusion', 'physical'),
  confusion: sp('illusion', 'mana', { resist: 'willpower' }), 'mass confusion': sp('illusion', 'mana', { resist: 'willpower', ...AREA }),
  chaos: sp('illusion', 'physical', { resist: 'intelligence' }), 'chaotic world': sp('illusion', 'physical', { resist: 'intelligence', ...AREA }),
  silence: sp('illusion', 'physical', AREA), stealth: sp('illusion', 'physical'),
  entertainment: sp('illusion', 'mana', AREA), phantasm: sp('illusion', 'mana', AREA), 'trid phantasm': sp('illusion', 'physical', AREA),
  // Manipulation
  armor: sp('manipulation', 'physical'), levitate: sp('manipulation', 'physical'), 'magic fingers': sp('manipulation', 'physical'),
  barrier: sp('manipulation', 'physical'), 'physical barrier': sp('manipulation', 'physical'), 'mana barrier': sp('manipulation', 'mana'),
  shapechange: sp('manipulation', 'physical') /* v0.77.0 book check: a voluntary subject, not resisted */, 'control thoughts': sp('manipulation', 'mana', { resist: 'willpower' }),
  'control actions': sp('manipulation', 'mana', { resist: 'willpower' }), influence: sp('manipulation', 'mana', { resist: 'willpower', duration: 'permanent' }),
  light: sp('manipulation', 'physical'), shadow: sp('manipulation', 'physical'), ignite: sp('manipulation', 'physical', { duration: 'permanent' }),
  clout: sp('manipulation', 'physical', { duration: 'instant' }), 'turn to goo': sp('manipulation', 'physical', { resist: 'body' }),
  petrify: sp('manipulation', 'physical', { resist: 'body' }),
  // Elemental manipulations
  flamethrower: sp('manipulation', 'physical', { element: 'fire' }), fireball: sp('manipulation', 'physical', { element: 'fire', ...AREA }),
  'lightning bolt': sp('manipulation', 'physical', { element: 'lightning' }), 'ball lightning': sp('manipulation', 'physical', { element: 'lightning', ...AREA }),
  'acid stream': sp('manipulation', 'physical', { element: 'acid' }), 'toxic wave': sp('manipulation', 'physical', { element: 'acid', ...AREA }),
};

const ATTR_WORD = /(body|quickness|strength|charisma|intelligence|willpower)/;
const DEFAULT_DURATION: Record<SpellCategory, SpellDuration> = {
  combat: 'instant', detection: 'sustained', health: 'sustained', illusion: 'sustained', manipulation: 'sustained',
};

/** Spell info from the table, an "Increase/Decrease [Attribute]" form, or keywords (`known` false). */
function spellInfo(name: string): { info: SpellInfo; known: boolean } {
  const key = norm(name).replace(/\s+spell$/, '');
  const hit = own(SPELL_TABLE, key);
  if (hit) return { info: hit, known: true };
  const inc = new RegExp(`^increase\\s+${ATTR_WORD.source}$`).exec(key);
  if (inc) return { info: sp('health', 'mana'), known: true };
  const dec = new RegExp(`^decrease\\s+${ATTR_WORD.source}$`).exec(key);
  if (dec) return { info: sp('health', 'mana', { resist: dec[1] as AttributeKey }), known: true };
  const stun = /stun/.test(key);
  const type: 'mana' | 'physical' = /power|physical|stun?bolt/.test(key) && !stun ? 'physical' : 'mana';
  if (/bolt|ball|blast|death|kill|slay/.test(key)) return { info: sp('combat', stun ? 'mana' : type, { damageType: stun ? 'stun' : 'physical' }), known: false };
  if (/detect|analy[sz]e|clairvoy|clairaud|sense|probe|telepath|mindlink|scan/.test(key)) return { info: sp('detection', type), known: false };
  if (/heal|treat|increase|decrease|cure|antidote|stabili|detox|reflexes|resist/.test(key)) return { info: sp('health', 'mana'), known: false };
  if (/invisib|mask|illusion|phantasm|confus|chaos|silence|stealth/.test(key)) return { info: sp('illusion', type), known: false };
  return { info: sp('manipulation', type), known: false };
}

// ---------------------------------------------------------------- Power tables (VERIFY)

interface AdeptRule {
  re: RegExp;
  /** Power point cost at a level (null = unknown). VERIFY: from memory of SR2. */
  cost: (level: number) => number | null;
  system: (p: ParsedPower, level: number, warnings: string[]) => Record<string, unknown>;
}

const ADEPT_RULES: AdeptRule[] = [
  { re: /^(?:improved|increased) reflexes$/, cost: (l) => byRating([1, 4, 6], l), // v0.77.0 book check: 1/4/6 points, initiative dice only (was 2/3/5, +2 Reaction per level)
    system: (_p, l) => ({ initiativeDice: l }) },
  { re: new RegExp(`^(?:increased|improved|enhanced) ${ATTR_WORD.source}$`), cost: (l) => 0.5 * l,
    system: (p, l) => ({ attributes: attrs({ [new RegExp(ATTR_WORD.source).exec(norm(p.name))![1] as AttributeKey]: l }) }) },
  { re: /^(?:improved|increased) (?:physical )?attributes?$/, cost: (l) => 0.5 * l,
    system: (p, l, w) => {
      const a = ATTR_WORD.exec(norm(p.options));
      if (!a) warnCoded(w, 'powerNoAttribute', tx('SR2E.Text.Statblock.noAttributeNamedIn', { name: p.name, options: p.options }));
      return a ? { attributes: attrs({ [a[1] as AttributeKey]: l }) } : {};
    } },
  { re: /^improved (?:ability|skill)$/, cost: (l) => 0.5 * l,
    system: (p, l, w) => {
      if (!p.options) w.push(tx('SR2E.Text.Statblock.noSkillNamedNoDice', { name: p.name }));
      return p.options ? { skill: p.options, skillDice: l } : {};
    } },
  { re: /^killing hands?$/, cost: (l) => byRating([0.5, 1, 2, 4], l) /* v0.77.0: L/M/S/D */, system: () => ({ special: 'killingHands' }) },
  { re: /^combat sense$/, cost: (l) => byRating([2, 3, 4], l) /* v0.77.0 book check (was 1 per level) */, system: () => ({ special: 'combatSense' }) },
  { re: /^pain resistance$/, cost: (l) => 0.5 * l, system: () => ({ special: 'painResistance' }) },
  { re: /^enhanced perception$/, cost: (l) => 0.5 * l, system: () => ({ special: 'enhancedPerception' }) },
  { re: /^astral perception$/, cost: () => 2, system: () => ({ special: 'astralPerception' }) },
  { re: /^mystic armou?r$/, cost: (l) => l, system: (_p, l) => ({ impact: l }) }, // v0.77.0 book check: 1 per point, impact only (was 0.5, both)
  { re: /^rapid healing$/, cost: (l) => 0.5 * l, system: () => ({ special: 'rapidHealing' }) },
  { re: /^missile parry$/, cost: () => 1, system: () => ({}) },
  { re: /^distance strike$/, cost: () => 2, system: () => ({ special: 'distanceStrike' }) },
  // v0.56.0: spell resistance and improved senses have effects.
  { re: /^(?:spell|magic(?:al)?) resistance$/, cost: (l) => l /* v0.77.0 book check (was 0.5) */, system: () => ({ special: 'spellResistance' }) },
  { re: /^(?:improved|enhanced) (?:senses?|sight|vision)$|^low[- ]light vision$|^thermographic vision$/, cost: () => 0.25, system: (p) => ({ special: 'improvedSenses', sense: /thermo/i.test(`${p.name} ${p.options ?? ''}`) ? 'thermographic' : /hear|ultra/i.test(`${p.name} ${p.options ?? ''}`) ? 'hearing' : 'lowLight' }) },
  { re: /^(?:smashing blow|body control|freefall|sustenance|traceless walk|magic sense|voice control|empathic sense|quick draw|great leap|blind fighting|cat'?s eyes?|nerve strike|side ?step)$/, cost: () => null, system: () => ({}) },
];

const isAdeptPowerName = (name: string) => ADEPT_RULES.some((r) => r.re.test(norm(name)));

interface CritterRule {
  re: RegExp;
  active: boolean;
  special?: string;
  extra?: Record<string, unknown>;
}

/** VERIFY: SR2 critter powers and weaknesses, from memory. */
const CRITTER_RULES: CritterRule[] = [
  { re: /^allerg/, active: false, special: 'allergy' },
  { re: /^vulnerab/, active: false, special: 'vulnerability' },
  { re: /^essence loss/, active: false, special: 'essenceLoss' },
  { re: /^essence drain/, active: true, special: 'essenceDrain' },
  { re: /^regenerat/, active: false, special: 'regeneration' },
  { re: /^dual[- ]?natured?/, active: false, special: 'dualNatured' },
  { re: /^infect/, active: true, special: 'infection' },
  // v0.56.0: immunities and the powers that put a TN or movement change on a target.
  { re: /^immunity/, active: false, special: 'immunity' },
  { re: /^concealment/, active: true, special: 'concealment' },
  { re: /^confusion/, active: true, special: 'confusion' },
  { re: /^movement/, active: true, special: 'movement' },
  { re: /^fear/, active: true, special: 'fear' },
  { re: /^(?:magical )?guard/, active: true, special: 'guard' },
  { re: /^(?:engulf|flame (?:aura|projection)|corrosive (?:saliva|secretions?)|sonic projection|elemental attack)/, active: true,
    extra: { effect: 'damage', resist: 'body', damageType: 'physical' } },
  { re: /^(?:venom|noxious breath|paralyzing (?:touch|howl)|pestilence|petrification)/, active: true, extra: { resist: 'body' } },
  { re: /^(?:fear|confusion|compulsion|influence|concealment|accident|alienation|binding|movement|psychokinesis|search|guard|magical guard|animal control|weather control|desire reflection|hypnotic song|energy drain|mimicry)/, active: true },
  { re: /^(?:immunity|enhanced (?:senses|physical attributes?|reactions?|reflexes)|improved reflexes|increased |armou?r$|hardened armou?r|astral perception|manifestation|materiali[sz]ation|reduced senses|sapience|natural weapon|silent|magical resistance|dietary requirement|uncouth|uneducated)/, active: false },
];

// ---------------------------------------------------------------- Section parsing

const SECTION_LABELS = {
  cyber: /^\s*(?:cyberware|cyber)\s*:/i,
  bio: /^\s*bioware\s*:/i,
  spells: /^\s*spells(?:\s+known)?\s*:/i,
  powers: /^\s*powers\s*:/i,
  critter: /^\s*critter\s+powers\s*:/i,
  adept: /^\s*adept\s+powers\s*:/i,
  weaknesses: /^\s*weaknesses\s*:/i,
};

function parseItemSections(lines: string[], result: ParsedStatBlock): void {
  const warn = (w: string) => result.warnings.push(w);

  // Cyberware and bioware
  for (const [label, section] of [[SECTION_LABELS.cyber, 'cyberware'], [SECTION_LABELS.bio, 'bioware']] as const) {
    const text = sectionText(lines, label);
    if (!text) continue;
    for (const entry of splitTopLevel(text)) {
      const e = parseEntry(entry);
      if (!e.name) {
        warn(section === 'bioware' ? tx('SR2E.Text.Statblock.couldNotReadBioware', { entry }) : tx('SR2E.Text.Statblock.couldNotReadCyberware', { entry }));
        continue;
      }
      result.cyberware.push({
        name: e.name, rating: e.rating, grade: e.grade, options: e.options.join(', '),
        bioware: section === 'bioware' || isBiowareName(e.name),
        ...(e.essence !== undefined ? { essence: e.essence } : {}),
        ...(e.bodyIndex !== undefined ? { bodyIndex: e.bodyIndex } : {}),
      });
    }
  }

  // Spells
  const spellsText = sectionText(lines, SECTION_LABELS.spells);
  if (spellsText) {
    for (const entry of splitTopLevel(spellsText)) {
      const e = parseEntry(entry);
      if (!e.name) {
        warn(tx('SR2E.Text.Statblock.couldNotReadSpell', { entry }));
        continue;
      }
      const { info, known } = spellInfo(e.name);
      if (!known) warn(tx('SR2E.Text.Statblock.spellIsNotInThe', { name: e.name, category: info.category, spellType: info.spellType }));
      if (!e.hasRating) warn(tx('SR2E.Text.Statblock.spellHasNoForce', { name: e.name }));
      const opt = e.options.join(', ');
      const spell: ParsedSpell = {
        name: e.name, force: e.rating, category: info.category, spellType: info.spellType,
        area: info.area ?? /ball$|storm|cloud|wave|\bmass\b|\barea\b|extended/i.test(e.name),
        elemental: Boolean(info.element), element: info.element ?? '',
        exclusive: /exclusive/i.test(opt), fetish: /fetish/i.test(opt),
        duration: info.duration ?? (info.element ? 'instant' : info.heals ? 'permanent' : DEFAULT_DURATION[info.category]),
        resist: info.resist ?? 'none', heals: Boolean(info.heals), known,
        options: e.options.filter((o) => !/^(?:exclusive|fetish)$/i.test(o)).join(', '),
        ...(info.category === 'combat' ? { damageType: info.damageType ?? 'physical' } : {}),
        ...(e.level ? { damageLevel: e.level } : {}),
        ...(e.drain ? { drain: e.drain } : info.drain ? { drain: info.drain } : {}),
        ...(info.range ? { range: info.range } : {}),
        ...(info.targetNumber ? { targetNumber: info.targetNumber } : {}),
      };
      result.spells.push(spell);
    }
  }

  // Powers. In a plain "Powers:" list, an adept (Magic, no Sorcery or Conjuring) has adept powers.
  const magician = result.skills.some((s) => /sorcery|conjuring/i.test(s.name));
  const adeptish = (result.magic ?? 0) > 0 && !magician;
  const sections = [
    [SECTION_LABELS.powers, 'powers'], [SECTION_LABELS.critter, 'critter'],
    [SECTION_LABELS.adept, 'adept'], [SECTION_LABELS.weaknesses, 'weaknesses'],
  ] as const;
  for (const [label, section] of sections) {
    const text = sectionText(lines, label);
    if (!text) continue;
    for (const entry of splitTopLevel(text)) {
      const e = parseEntry(entry);
      if (!e.name) {
        warn(tx('SR2E.Text.Statblock.couldNotReadPower', { entry }));
        continue;
      }
      const adept = section === 'adept' || (section === 'powers' && adeptish && isAdeptPowerName(e.name));
      result.powers.push({
        name: e.name, rating: e.rating, options: e.options.join(', '), adept, section,
        weakness: section === 'weaknesses' || /^(?:allerg|vulnerab|essence loss)/i.test(e.name),
        ...(e.level ? { level: e.level } : {}),
      });
    }
  }
}

// ---------------------------------------------------------------- Item creation data

// v0.77.0 book check: four levels L/M/S/D (RULES.ADEPT.killingHands.levels).
const LEVEL_TO_KILLING_HANDS: Partial<Record<DamageLevel, number>> = { L: 1, M: 2, S: 3, D: 4 };

function cyberwareItem(c: ParsedCyberware, p: ParsedStatBlock, notes: { essence: string[]; unknownEssence: string[]; bodyIndex: string[]; warnings: string[] }): StatBlockItem {
  const text = `${c.name} ${c.options}`;
  const system: Record<string, unknown> = { installed: true, grade: c.grade, bioware: c.bioware };
  let rating = c.rating;

  if (c.bioware) {
    const rule = BIO_RULES.find((b) => b.re.test(c.name));
    if (!rule) notes.warnings.push(tx('SR2E.Text.Statblock.biowareNotRecognisedCreatedWith', { name: c.name }));
    if (rule?.scales && rating <= 0) notes.warnings.push(tx('SR2E.Text.Statblock.noRatingGivenAssumed1', { name: c.name }));
    if (rule?.unmodelled) notes.warnings.push(tx('SR2E.Text.Statblock.itsEffectsAreNotApplied', { name: c.name }));
    // A bioware effect only applies at rating 1 or more (RULES.BIOWARE.effects).
    rating = Math.max(1, rating);
    let bi = c.bodyIndex;
    if (bi === undefined) {
      const guess = rule?.bodyIndex(rating) ?? null;
      if (guess === null) notes.warnings.push(tx('SR2E.Text.Statblock.bodyIndexUnknownSetTo', { name: c.name }));
      else notes.bodyIndex.push(`${c.name} (${guess})`);
      bi = guess ?? 0;
    }
    Object.assign(system, {
      kind: 'other', bioKind: rule?.bioKind ?? 'other', rating, essenceCost: 0, bodyIndex: bi,
      ...(/cultured/i.test(c.options) ? { cultured: true } : {}),
    });
    return { name: c.name, type: 'cyberware', system };
  }

  const rule = CYBER_RULES.find((r) => r.re.test(c.name));
  if (!rule) notes.warnings.push(tx('SR2E.Text.Statblock.cyberwareNotRecognisedCreatedAs', { name: c.name }));
  if (rule?.needsRating && rating <= 0) {
    notes.warnings.push(tx('SR2E.Text.Statblock.noRatingGivenAssumed1', { name: c.name }));
    rating = 1;
  }
  const ctx: CyberCtx = { r: rating, text };
  system.kind = rule?.kind ?? 'other';
  system.rating = rating;
  Object.assign(system, rule?.effects?.(ctx) ?? {});
  if (rule?.weaponLevel) {
    // A cyberweapon listed in Gear too already has a weapon item: don't add a second attack.
    const asWeapon = p.weapons.some((w) => norm(w.name).includes(norm(c.name)) || norm(c.name).includes(norm(w.name)));
    if (asWeapon) {
      system.kind = 'other';
      notes.warnings.push(tx('SR2E.Text.Statblock.isAlsoAWeaponIn', { name: c.name }));
    } else {
      const skill = p.skills.find((s) => /cyber.?implant/i.test(s.name)) ?? p.skills.find((s) => /unarmed/i.test(s.name));
      system.weapon = { strengthPower: true, damagePower: 0, damageLevel: rule.weaponLevel, damageType: 'physical', reach: 0, ...(skill ? { skill: skill.name } : {}) };
    }
  }
  // v0.92.3: the grade's factor as RULES.GEAR_V923.grades has it.
  const mult = gradeEssenceFactor(String(c.grade ?? 'standard'));
  if (c.essence !== undefined) {
    // The block's Essence is for its grade; the item stores the standard cost (the grade multiplies it).
    system.essenceCost = round2(c.essence / mult);
  } else {
    const guess = rule ? rule.essence(ctx) : null;
    if (guess === null) notes.unknownEssence.push(c.name);
    else notes.essence.push(`${c.name} (${round2(guess * mult)})`);
    system.essenceCost = guess ?? 0;
  }
  return { name: c.name, type: 'cyberware', system };
}

function spellItem(s: ParsedSpell): StatBlockItem {
  const system: Record<string, unknown> = {
    category: s.category, spellType: s.spellType, area: s.area, duration: s.duration, resist: s.resist,
    exclusive: s.exclusive, fetish: s.fetish, elemental: s.elemental, element: s.element, heals: s.heals,
  };
  if (s.force > 0) system.learnedForce = s.force;
  if (s.heals) system.healTrack = 'physical';
  if (s.damageType) system.damageType = s.damageType;
  if (s.damageLevel) system.damageLevel = s.damageLevel;
  if (s.drain) Object.assign(system, { drainModifier: s.drain.modifier, drainLevel: s.drain.level });
  if (s.range) system.range = s.range;
  if (s.targetNumber) system.targetNumber = s.targetNumber;
  return { name: s.name, type: 'spell', system };
}

function adeptItem(pw: ParsedPower, warnings: string[], guessedCost: string[]): StatBlockItem {
  const key = norm(pw.name);
  const rule = ADEPT_RULES.find((r) => r.re.test(key));
  let level = Math.max(1, pw.rating);
  if (/^killing hands?$/.test(key) && pw.level) {
    const l = LEVEL_TO_KILLING_HANDS[pw.level];
    if (l) level = l;
    else warnings.push(tx('SR2E.Text.Statblock.killingHandsStartsAtM', { name: pw.name, level: pw.level }));
  }
  const system: Record<string, unknown> = { active: true, level };
  if (!rule) {
    warnings.push(tx('SR2E.Text.Statblock.adeptPowerNotRecognisedCreated', { name: pw.name }));
    return { name: pw.name, type: 'adeptpower', system };
  }
  Object.assign(system, rule.system(pw, level, warnings));
  const cost = rule.cost(level);
  if (cost === null) warnings.push(tx('SR2E.Text.Statblock.powerPointCostUnknownThe', { name: pw.name }));
  else {
    system.cost = round2(cost);
    guessedCost.push(`${pw.name} (${round2(cost)})`);
  }
  return { name: pw.name, type: 'adeptpower', system };
}

function critterItem(pw: ParsedPower, warnings: string[]): StatBlockItem {
  const key = norm(pw.name);
  const rule = CRITTER_RULES.find((r) => r.re.test(key));
  const system: Record<string, unknown> = { active: rule?.active ?? !pw.weakness };
  if (pw.rating > 0) Object.assign(system, { rating: pw.rating, dice: 'rating' });
  if (rule?.extra) Object.assign(system, rule.extra);
  if (rule?.special) system.special = rule.special;
  const opts = splitTopLevel(pw.options);
  if (rule?.special === 'allergy' || rule?.special === 'vulnerability') {
    const severity = opts.map((o) => o.toLowerCase()).find((o) => (ALLERGY_SEVERITIES as readonly string[]).includes(o));
    const fromName = /^(?:allergy|vulnerability)\s+(?:to\s+)?(.+)$/i.exec(pw.name)?.[1];
    const substance = [fromName, ...opts.filter((o) => o.toLowerCase() !== severity)].filter(Boolean).join(', ');
    if (substance) system.substance = substance;
    else warnings.push(tx('SR2E.Text.Statblock.noSubstanceGiven', { name: pw.name }));
    if (rule.special === 'allergy') {
      if (severity) system.severity = severity;
      else warnings.push(tx('SR2E.Text.Statblock.noSeverityGivenTheItem', { name: pw.name }));
    }
  } else if (pw.options || pw.level) {
    system.notes = [pw.options, pw.level ? tx('SR2E.Text.Statblock.levelLevel', { level: pw.level }) : ''].filter(Boolean).join('; ');
  }
  if (rule?.special === 'immunity') {
    // v0.56.0: what it is immune to, from the name ("Immunity to Normal Weapons") and options.
    const fromName = /^immunit(?:y|ies)\s+(?:to\s+)?(.+)$/i.exec(pw.name)?.[1];
    // "Immunity to Age, Pathogens and Toxins": split the list on "and" too.
    const substance = [fromName, ...opts].filter(Boolean).join(', ').replace(/\s+and\s+/gi, ', ');
    system.substance = substance || 'normal weapons';
  } else if (/^(?:improved|increased|enhanced) (?:reflexes|reactions?|body|quickness|strength|physical)/.test(key)) {
    warnCoded(warnings, 'critterPowerAttributes', tx('SR2E.Text.Statblock.aCritterPowerItemDoes', { name: pw.name }));
  }
  if (!rule) {
    const name = pw.name;
    warnings.push(pw.weakness
      ? (system.active ? tx('SR2E.Text.Statblock.weaknessNotRecognisedActive', { name }) : tx('SR2E.Text.Statblock.weaknessNotRecognisedPassive', { name }))
      : (system.active ? tx('SR2E.Text.Statblock.powerNotRecognisedActive', { name }) : tx('SR2E.Text.Statblock.powerNotRecognisedPassive', { name })));
  }
  return { name: pw.name, type: 'power', system };
}

/**
 * Item creation data (cyberware, spell, power, adeptpower) for the parsed cyberware, spells and
 * powers, using the item models' field names and choices. Pure: no Foundry globals.
 * `ctx.adept` overrides the parser's guess for entries listed under a plain "Powers:" label
 * (true = adept powers, false = critter powers); "Adept Powers", "Critter Powers" and
 * "Weaknesses" lists keep their kind.
 */
export function statBlockItems(p: ParsedStatBlock, ctx: { adept?: boolean } = {}): { items: StatBlockItem[]; warnings: string[] } {
  const warnings: string[] = [];
  const notes = { essence: [] as string[], unknownEssence: [] as string[], bodyIndex: [] as string[], warnings };
  const items: StatBlockItem[] = [];
  for (const c of p.cyberware ?? []) items.push(cyberwareItem(c, p, notes));

  const undrained: string[] = [];
  for (const s of p.spells ?? []) {
    items.push(spellItem(s));
    if (!s.drain) undrained.push(s.name);
  }

  const guessedCost: string[] = [];
  for (const pw of p.powers ?? []) {
    const adept = pw.section === 'powers' && ctx.adept !== undefined ? ctx.adept : pw.adept;
    items.push(adept && !pw.weakness ? adeptItem(pw, warnings, guessedCost) : critterItem(pw, warnings));
  }

  if (notes.essence.length) warnCoded(warnings, 'essenceGuessed', tx('SR2E.Text.Statblock.essenceGuessedFromStandardSr2', { list: notes.essence.join(', ') }));
  if (notes.unknownEssence.length) warnCoded(warnings, 'essenceUnknown', tx('SR2E.Text.Statblock.essenceUnknownSetTo0', { list: notes.unknownEssence.join(', ') }));
  if (notes.bodyIndex.length) warnings.push(tx('SR2E.Text.Statblock.bodyIndexGuessedVerify', { list: notes.bodyIndex.join(', ') }));
  if (guessedCost.length) warnings.push(tx('SR2E.Text.Statblock.adeptPowerPointCostsGuessed', { list: guessedCost.join(', ') }));
  if (undrained.length) warnCoded(warnings, 'drainNotGiven', tx('SR2E.Text.Statblock.drainNotGivenForThe', { list: undrained.join(', ') }));
  return { items, warnings };
}

/**
 * Attribute bonuses the items from statBlockItems will add once on the actor (cyberware, bioware at
 * its rating, adept powers). A stat block shows augmented attributes, so subtract these from the
 * manual modifier to avoid counting them twice.
 */
export function statBlockAttributeBonuses(items: readonly StatBlockItem[]): Partial<Record<AttributeKey, number>> {
  const out: Partial<Record<AttributeKey, number>> = {};
  const add = (a: Record<string, unknown> | undefined) => {
    for (const [k, v] of Object.entries(a ?? {})) if (typeof v === 'number' && v) out[k as AttributeKey] = (out[k as AttributeKey] ?? 0) + v;
  };
  // v0.92.3 review fix: the Body the data model now adds from ware (RULES.GEAR_V923 dermal, boneLacing, limbPairs)
  // is in the shown Body too, so it comes off here as well (else the import counts it twice).
  const cyber = items.filter((i) => i.type === 'cyberware' && !i.system.bioware);
  const replacements = cyberReplacements(cyber.map((i) => ({ name: i.name, kind: String(i.system.kind ?? '') })));
  for (const i of items) {
    const s = i.system;
    if (i.type === 'cyberware' && s.bioware) {
      add(bioEffect({ name: i.name, bioKind: String(s.bioKind ?? 'other'), rating: Number(s.rating ?? 0), installed: true, damaged: false, active: false, cultured: Boolean(s.cultured) }).attributes);
    } else if (i.type === 'cyberware' || i.type === 'adeptpower') add(s.attributes as Record<string, unknown> | undefined);
    if (i.type === 'cyberware' && !s.bioware) {
      if (gearBook('dermal') && isDermalPlating({ name: i.name, bioware: false, kind: String(s.kind ?? '') })) add({ body: dermalRating(s as any) });
      if (s.kind === 'boneLacing') add({ body: boneLacingBook(String(s.lacing ?? ''), replacements).body });
    }
  }
  add({ body: limbPairsBody(cyber.filter((i) => i.system.kind === 'cyberlimb').map((i) => ({ name: i.name, location: String((i.system.limb as any)?.location ?? 'other') }))) });
  return out;
}

/** The choice lists the item data above is checked against (tests). */
export const STAT_BLOCK_ITEM_CHOICES = {
  cyberwareKinds: RULES.CYBERWARE.kinds, reflexTypes: RULES.CYBERWARE.reflexTypes, bioKinds: RULES.BIOWARE.kinds,
  grades: Object.keys(RULES.GRADE_ESSENCE_MULTIPLIER), spellCategories: SPELL_CATEGORIES, spellDurations: SPELL_DURATIONS,
  powerSpecials: POWER_SPECIALS, allergySeverities: ALLERGY_SEVERITIES, adeptSpecials: ADEPT_SPECIALS,
} as const;
