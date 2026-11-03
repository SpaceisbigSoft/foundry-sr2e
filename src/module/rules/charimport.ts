import { RULES } from './config.ts';
import { type AttrKey } from './core.ts';
import { metatypeKnown, metatypeIds, attributeLimitsWith } from './charfix.ts';
import type { Quality } from './street.ts';
import {
  parseStatBlock, statBlockItems, statBlockAttributeBonuses, splitTopLevel, statBlockWarningCode,
  type ParsedStatBlock, type ParsedSkill, type ParsedWeapon, type ParsedAttribute,
} from './statblock.ts';
import { splitSpecialization } from './skills.ts';
import { TRADITIONS, FOCUS_TYPES, type Tradition, type FocusType } from './arcana.ts';
import { SPELL_CATEGORIES } from './magic.ts';
import { escHtml, escRegExp } from './html.ts';
import { t as tx, tCount } from '../helpers/i18n.ts';

/**
 * v0.66.0: character stat-block import. A player-character write-up pasted as text (typed up from a
 * paper sheet, a forum post or an old SR2 character generator) is read into a ParsedCharacter, and
 * characterImportPlan() turns that into an actor update, item creation data, contacts and edges/flaws
 * for the Foundry glue to apply to a `character` actor.
 *
 * What it reads (case-insensitive; "Label: value" lines; list sections run until a blank line or the
 * next known label; entries split on commas, semicolons or new lines):
 * - Name / Street name / Real name / Player; Metatype or Race (metavariants map to their base
 *   metatype, with a warning); Archetype (notes); Tradition, Totem, Initiate grade.
 * - Attributes as the statblock's "B Q S C I W E M R" header row, or as lines like "Body 5",
 *   "Quickness: 4 (6)", "Str 3", "Essence 5.2", "Reaction 4 (8)", "Initiative 4 + 1D6".
 * - Skills (active), Knowledge, Language ("native" marks the native language) and Build/Repair skills.
 * - Cyberware, Bioware, Spells, Adept powers (through parseStatBlock / statBlockItems).
 * - Gear / Equipment / Weapons / Armor / Foci: weapons by damage code, armor by "B/I", foci by name,
 *   everything else is gear with a quantity ("2x", "x50") and a rating where the model has one.
 * - Contacts, Edges and flaws, Nuyen, Karma, Lifestyle, Street Cred / Notoriety / Public Awareness.
 * - Background / Description / Age, Height... (biography) and Notes (notes). Unknown lines are warned
 *   about and kept in the notes.
 *
 * Pure: no Foundry globals.
 */

type AttributeKey = AttrKey;
export type CharSkillKind = 'active' | 'knowledge' | 'language' | 'buildRepair';

export interface CharSkill extends ParsedSkill {
  kind: CharSkillKind;
  /** A native language. */
  native?: boolean;
}

export interface CharWeapon extends ParsedWeapon {
  /** Firing modes, e.g. "SA/BF". */
  modes?: string;
  /** Magazine size, e.g. 15 for "15 (c)". */
  ammoMax?: number;
  smartgun?: boolean;
  /** Other text from the entry, kept as the description. */
  notes?: string;
  quantity?: number;
}

export interface ParsedGear {
  name: string;
  kind: 'gear' | 'armor' | 'focus';
  quantity: number;
  /** "Rating 3", "R3", "(3)" for a medkit... 0 = none. */
  rating: number;
  /** Armor. */
  ballistic?: number;
  impact?: number;
  /** Armor that adds to other armor (helmets). */
  adds?: boolean;
  /** Focus. */
  focusType?: FocusType;
  /** Focus: spell category, or a specific spell/spirit/weapon. */
  category?: string;
  target?: string;
  /** Text not otherwise used. */
  notes: string;
}

export interface ParsedContact {
  name: string;
  role: string;
  /** 1 contact, 2 buddy, 3 friend for life. */
  level: number;
  loyalty?: number;
  notes: string;
}

export interface ParsedQuality {
  name: string;
  kind: 'edge' | 'flaw';
  points: number;
  notes: string;
}

export interface ParsedCharacter extends ParsedStatBlock {
  /** The actor name: street name if given, else name. */
  name?: string;
  realName?: string;
  streetName?: string;
  player?: string;
  /** Metatype id (RULES.METATYPES.types), validated. */
  metatype?: string;
  archetype?: string;
  tradition?: Tradition;
  totem?: string;
  initiateGrade?: number;
  /** All skills, with their kind. */
  skills: CharSkill[];
  weapons: CharWeapon[];
  gear: ParsedGear[];
  contacts: ParsedContact[];
  qualities: ParsedQuality[];
  nuyen?: number;
  karma: { good?: number; total?: number; pool?: number };
  /** `level` is a RULES.UPKEEP.lifestyles id. */
  lifestyle?: { name: string; level: string; months?: number };
  reputation: { streetCred?: number; notoriety?: number; publicAwareness?: number };
  /** Plain text (paragraphs separated by blank lines). */
  biography: string;
  notes: string;
  /** Lines that matched nothing (also in `warnings`). */
  unknown: string[];
}

export interface CharacterImportCurrent {
  /** Items already on the actor: an imported item of the same type and name replaces it. */
  itemNames?: Array<{ type: string; name: string }>;
  /** Contacts already on the actor: kept, and one of the same name is updated in place. */
  contacts?: Array<Record<string, unknown>>;
  /** Edges and flaws already on the actor (system.qualities), merged the same way. */
  qualities?: Array<Record<string, unknown>>;
  /** Existing HTML: the imported text is appended to it instead of replacing it. */
  biography?: string;
  notes?: string;
  /** Id maker for new contact/quality rows (default: random 16 characters). */
  makeId?: () => string;
}

export interface CharacterImportItem {
  type: string;
  name: string;
  system: Record<string, unknown>;
  /** An item of this type and name is already on the actor: update it instead of creating one. */
  replace?: boolean;
}

export interface CharacterImportPlan {
  /** Dotted paths ("system.attributes.body.base", "name"...) for one actor.update(). */
  actorUpdate: Record<string, unknown>;
  items: CharacterImportItem[];
  /** The full system.contacts array to write (existing ones kept), when the write-up has contacts. */
  contacts?: Array<Record<string, unknown>>;
  /** The full system.qualities array to write (existing ones kept), when the write-up has edges or flaws. */
  qualities?: Array<Record<string, unknown>>;
  /**
   * Values that need the actor's derived data once the items exist (like applyStatBlock's second
   * update): system.essence = essenceShown + derived.essenceLoss; system.reactionBonus = reactionShown
   * − (derived.reaction − reactionBonus); system.initiativeDiceBonus = max(0, initiativeDice −
   * (derived.initiativeDice − initiativeDiceBonus)); system.lifestyle.paidUntil = world time +
   * lifestyleSeconds. `lifestyleMonths` is informational (the months behind lifestyleSeconds); the glue reads only
   * lifestyleSeconds.
   */
  after: { essenceShown?: number; reactionShown?: number; initiativeDice?: number; lifestyleMonths?: number; lifestyleSeconds?: number };
  summary: string[];
  warnings: string[];
}

// ===================================================================== Small helpers

const ATTRS: readonly AttributeKey[] = ['body', 'quickness', 'strength', 'charisma', 'intelligence', 'willpower'];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const normLabel = (s: string) => s.toLowerCase().replace(/[_.]/g, ' ').replace(/\s*([/&])\s*/g, ' $1 ').replace(/\s+/g, ' ').trim();
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
/** Plain text → HTML paragraphs (blank lines separate paragraphs). */
function toHtml(text: string): string {
  return text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean).map((p) => `<p>${escHtml(p).replace(/\n/g, '<br>')}</p>`).join('');
}
function randomId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let s = '';
  for (let i = 0; i < 16; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

/** Split on commas and semicolons that are not inside brackets, parentheses or braces; list bullets dropped. */
function splitEntries(text: string): string[] {
  return splitTopLevel(text, { semicolons: true }).map((s) => s.replace(/^[-*•·–]\s+/, '').trim()).filter(Boolean);
}

/** Text outside top-level brackets, and the contents of each top-level (...) or [...]. */
function groupsOf(entry: string): { rest: string; groups: string[] } {
  let depth = 0;
  let rest = '';
  let cur = '';
  const groups: string[] = [];
  for (const ch of entry) {
    if (ch === '(' || ch === '[') {
      if (depth++ === 0) {
        cur = '';
        continue;
      }
    } else if ((ch === ')' || ch === ']') && depth > 0) {
      if (--depth === 0) {
        groups.push(cur.trim());
        rest += ' ';
        continue;
      }
    }
    if (depth > 0) cur += ch;
    else rest += ch;
  }
  if (depth > 0 && cur.trim()) groups.push(cur.trim());
  return { rest: rest.replace(/\s+/g, ' ').trim(), groups };
}

/** Depth of unclosed brackets at the end of a string. */
function openDepth(s: string): number {
  let d = 0;
  for (const ch of s) {
    if (ch === '(' || ch === '[') d++;
    else if ((ch === ')' || ch === ']') && d > 0) d--;
  }
  return d;
}

// ===================================================================== Labels

type Key =
  | 'name' | 'street' | 'realName' | 'player' | 'metatype' | 'archetype' | 'attr'
  | 'skills' | 'knowledge' | 'language' | 'buildRepair'
  | 'cyber' | 'bioware' | 'spells' | 'powers' | 'gear' | 'armor' | 'foci'
  | 'contacts' | 'qualities' | 'edges' | 'flaws'
  | 'nuyen' | 'karma' | 'lifestyle' | 'tradition' | 'totem' | 'grade'
  | 'streetCred' | 'notoriety' | 'publicAwareness'
  | 'background' | 'physical' | 'notes' | 'ignore';

const LIST_KEYS: ReadonlySet<Key> = new Set<Key>(['skills', 'knowledge', 'language', 'buildRepair', 'cyber', 'bioware', 'spells', 'powers', 'gear', 'armor', 'foci', 'contacts', 'qualities', 'edges', 'flaws']);
const TEXT_KEYS: ReadonlySet<Key> = new Set<Key>(['background', 'notes']);

const ATTR_WORD_SRC = String.raw`body|bod|quickness|quick|qui|qck|strength|str|charisma|cha|intelligence|int|willpower|will|wil|wp|essence|ess|magic|mag|reaction|rea|initiative|init`;

const LABELS: Array<[RegExp, Key]> = [
  [/^(?:character )?name$/, 'name'],
  [/^(?:street ?name|alias|handle|aka|runner name)$/, 'street'],
  [/^(?:real|legal|full) name$/, 'realName'],
  [/^player(?: name)?$/, 'player'],
  [/^(?:metatype|meta ?type|race|metarace|meta-race|species|metavariant)$/, 'metatype'],
  [/^(?:archetype|role|concept|occupation|profession|type)$/, 'archetype'],
  [/^(?:attributes?|stats|physical attributes|mental attributes)$/, 'attr'],
  [new RegExp(`^(?:${ATTR_WORD_SRC})$`), 'attr'],
  [/^(?:active )?skills?$|^active$/, 'skills'],
  [/^knowledge(?: skills?)?$/, 'knowledge'],
  [/^(?:language(?: skills?)?|languages)$/, 'language'],
  [/^(?:build \/ repair|b \/ r|build & repair|build and repair|build-repair|build repair)(?: skills?)?$/, 'buildRepair'],
  [/^(?:cyberware|cyber|implants|cyberware \/ bioware|cyberware & bioware|cyberware and bioware|augmentations?)$/, 'cyber'],
  [/^bioware$/, 'bioware'],
  [/^(?:spells?|spells known)$/, 'spells'],
  [/^(?:(?:physical )?adept )?powers$|^adept powers?$/, 'powers'],
  [/^(?:gear|equipment|weapons?|possessions|other gear|cyberdecks?|electronics|vehicles?|items)$/, 'gear'],
  [/^(?:armou?r|worn armou?r)$/, 'armor'],
  [/^(?:foci|focus|focuses)$/, 'foci'],
  [/^contacts?$/, 'contacts'],
  [/^(?:edges? (?:and|&|\/) flaws?|qualities)$/, 'qualities'],
  [/^edges?$/, 'edges'],
  [/^flaws?$/, 'flaws'],
  [/^(?:nuyen|cash|money|funds|credstick|credit|nuyen left|savings|resources left)$/, 'nuyen'],
  [/^(?:karma|good karma|karma pool|total karma|career karma|karma total|unspent karma)$/, 'karma'],
  [/^lifestyle$/, 'lifestyle'],
  [/^(?:tradition|magical tradition|magic tradition|magic type|path)$/, 'tradition'],
  [/^(?:totem|totem spirit|mentor|patron)$/, 'totem'],
  [/^(?:initiate grade|grade|initiation)$/, 'grade'],
  [/^street ?cred$/, 'streetCred'],
  [/^notoriety$/, 'notoriety'],
  [/^public awareness$/, 'publicAwareness'],
  [/^(?:background|biography|bio|history|description|appearance|personality|story)$/, 'background'],
  [/^(?:age|sex|gender|height|weight|hair|eyes|skin|ethnicity|nationality)$/, 'physical'],
  [/^(?:notes?|comments?|misc|gm notes)$/, 'notes'],
  [/^(?:dice pools?|pools?|combat pool|spell pool|hacking pool|control pool|task pool|astral pool|magic pool|condition monitor|movement|threat rating|professional rating)$/, 'ignore'],
];

function labelKey(label: string): Key | null {
  const n = normLabel(label);
  for (const [re, k] of LABELS) if (re.test(n)) return k;
  return null;
}

const LABEL_LINE = /^\s*[-*•]?\s*([A-Za-z][A-Za-z /&'.-]{0,40}?)\s*[:=]\s*(.*)$/;
const ATTR_LINE = new RegExp(String.raw`^\s*(?:${ATTR_WORD_SRC})\b\s*[:=]?\s*\d`, 'i');

/** "Name: Ghost    Metatype: Elf" → two lines (2+ spaces, a tab or "|" before a known label). */
function splitMultiLabel(line: string): string[] {
  // v0.81.0 (RC-9): long blank runs (a tab-aligned sheet) made the pattern below quadratic; 3+ blanks keep the
  // "2+ spaces" signal as two.
  line = line.replace(/\s{3,}/g, '  ');
  const re = /(?:\s{2,}|\t|\s*\|\s*)([A-Za-z][A-Za-z /&'.-]{0,30}?)\s*:/g;
  const cuts: number[] = [];
  for (let m = re.exec(line); m; m = re.exec(line)) {
    const k = labelKey(m[1] as string);
    if (k && k !== 'attr') cuts.push(m.index);
  }
  if (!cuts.length) return [line];
  const out: string[] = [];
  let at = 0;
  for (const c of cuts) {
    out.push(line.slice(at, c));
    at = c;
  }
  out.push(line.slice(at));
  return out.map((s) => s.replace(/^\s*\|\s*/, '').trim()).filter(Boolean);
}

const COLONLESS_KEYS: ReadonlySet<Key> = new Set<Key>(['karma', 'nuyen', 'streetCred', 'notoriety', 'publicAwareness', 'grade', 'lifestyle', 'metatype']);
/** "Karma Pool 2", "Good Karma 5", "Nuyen 12,500¥", "Lifestyle Middle": a value label without a colon. */
function colonless(line: string): { key: Key; label: string; value: string } | null {
  const words = line.trim().split(/\s+/);
  for (let n = Math.min(3, words.length - 1); n >= 1; n--) {
    const label = words.slice(0, n).join(' ');
    const key = labelKey(label);
    const value = words.slice(n).join(' ');
    if (!key || !COLONLESS_KEYS.has(key)) continue;
    if (key === 'lifestyle' || key === 'metatype' ? /^[A-Za-z]/.test(value) : /^[¥\d]/.test(value)) return { key, label, value };
  }
  return null;
}

/** v0.81.1 (RC2-3): colonless labels that end a one-per-line list (see the section pass). */
const STRONG_IN_LIST = /^(?:nuyen|karma|good karma|karma pool|total karma|career karma|unspent karma|street ?cred|notoriety|public awareness|lifestyle)$/i;

const HEADER_TOKENS = new Set(['B', 'Q', 'S', 'C', 'I', 'W', 'E', 'M', 'R', 'A', 'ARMOR']);
function isHeaderRow(line: string): boolean {
  const tokens = line.trim().split(/\s+/).filter(Boolean);
  const core = tokens.filter((t) => ['B', 'Q', 'S', 'C', 'I', 'W'].includes(t.toUpperCase()));
  return core.length >= 4 && tokens.every((t) => HEADER_TOKENS.has(t.toUpperCase()));
}

// ===================================================================== Attribute lines

const ATTR_FIELD: Record<string, AttributeKey | 'essence' | 'magic' | 'reaction' | 'initiative'> = {
  body: 'body', bod: 'body', quickness: 'quickness', quick: 'quickness', qui: 'quickness', qck: 'quickness',
  strength: 'strength', str: 'strength', charisma: 'charisma', cha: 'charisma', intelligence: 'intelligence', int: 'intelligence',
  willpower: 'willpower', will: 'willpower', wil: 'willpower', wp: 'willpower', essence: 'essence', ess: 'essence',
  magic: 'magic', mag: 'magic', reaction: 'reaction', rea: 'reaction', initiative: 'initiative', init: 'initiative',
};
const NUM = String.raw`(\d+(?:[.,]\d+)?)`;
const ATTR_SCAN = new RegExp(String.raw`\b(${ATTR_WORD_SRC})\b\s*[:=]?\s*${NUM}(?:\s*[(/]\s*${NUM}\s*\)?)?(?:\s*\+\s*(\d+)\s*d6)?(?:\s*\(\s*${NUM}\s*\+\s*(\d+)\s*d6\s*\))?`, 'gi');

function readAttributeLine(line: string, p: ParsedCharacter): void {
  const num = (s: string | undefined) => (s === undefined ? undefined : Number(s.replace(',', '.')));
  for (const m of line.matchAll(ATTR_SCAN)) {
    const field = ATTR_FIELD[(m[1] as string).toLowerCase()];
    const base = num(m[2]) as number;
    const aug = num(m[3]);
    if (!field) continue;
    if (field === 'initiative') {
      // "Initiative 4 + 1D6 (8 + 3D6)": the augmented one in parentheses wins.
      const dice = m[6] !== undefined ? Number(m[6]) : m[4] !== undefined ? Number(m[4]) : undefined;
      const shown = num(m[5]) ?? base;
      if (dice !== undefined) p.initiativeDice = dice;
      if (!p.reaction) p.reaction = shown !== base ? { base, augmented: shown } : { base };
      continue;
    }
    const v: ParsedAttribute = aug !== undefined && aug !== base ? { base, augmented: aug } : { base };
    if (field === 'essence') p.essence = v.augmented ?? v.base;
    else if (field === 'magic') p.magic = Math.round(v.base);
    else if (field === 'reaction') {
      p.reaction = v;
      if (m[4] !== undefined) p.initiativeDice = Number(m[4]);
    } else p.attributes[field] = { base: Math.round(v.base), ...(v.augmented !== undefined ? { augmented: Math.round(v.augmented) } : {}) };
  }
}

// ===================================================================== Metatype, tradition, totem

const METATYPE_WORDS: Array<[RegExp, string, boolean]> = [
  [/night\s*ones?|wakyambi|dryads?/i, 'elf', true],
  [/gnomes?|harumen|koborokuru|menehune/i, 'dwarf', true],
  [/hobgoblins?|ogres?|\boni\b|satyrs?/i, 'ork', true],
  [/cyclops|fomori|giants?|minotaurs?/i, 'troll', true],
  [/\bhumans?\b|\bnorms?\b|homo sapiens sapiens/i, 'human', false],
  [/\belf\b|\belves\b|\belven\b|nobilis/i, 'elf', false],
  [/\bdwarf\b|\bdwarves\b|\bdwarfs\b|\bdwarven\b|pumilionis/i, 'dwarf', false],
  [/\borks?\b|\borcs?\b|\bork(?:ish)?\b|robustus/i, 'ork', false],
  [/\btrolls?\b|ingentis/i, 'troll', false],
];

/** A metatype id for a written metatype ("Elf", "orc", "Night One"), and whether it was a metavariant. */
export function metatypeFromText(text: string): { id: string; variant: boolean } | null {
  for (const [re, id, variant] of METATYPE_WORDS) {
    if (re.test(text) && metatypeKnown(id)) return { id, variant };
  }
  // v0.73.0 (O36): a house-rule metatype, by its id or its label.
  for (const id of metatypeIds()) {
    const label = String((RULES.METATYPES.types as any)[id]?.label ?? id);
    if (new RegExp(`\\b(?:${escRegExp(id)}|${escRegExp(label)})s?\\b`, 'i').test(text)) return { id, variant: false };
  }
  return null;
}

const TRADITION_WORDS: Array<[RegExp, Tradition]> = [
  [/toxic/i, 'toxic'], [/insect/i, 'insect'], [/shamanist/i, 'shamanist'], [/elementalist/i, 'elementalist'],
  [/sorcer(?:er|y)\s*adept|\bsorcerer\b/i, 'sorcerer'], [/conjur(?:er|ing)\s*adept|\bconjurer\b/i, 'conjurer'],
  [/physical\s*adept|\badept\b/i, 'adept'], [/shaman/i, 'shamanic'],
  [/hermetic|\bmage\b|magician|wizard|thaumaturg|mage\b/i, 'hermetic'],
  [/mundane|\bnone\b/i, 'none'],
];
function traditionFromText(text: string): Tradition | null {
  for (const [re, t] of TRADITION_WORDS) if (re.test(text) && (TRADITIONS as readonly string[]).includes(t)) return t;
  return null;
}

// ===================================================================== Values

/** "12,500¥", "¥12.500", "12 500 nuyen", "12.5k" → 12500; null if no number. */
export function parseNuyen(text: string): number | null {
  const s = text.replace(/[¥]|nuyen|\bny\b/gi, ' ');
  const m = /(\d{1,3}(?:[ ,.'’]\d{3})+|\d+(?:[.,]\d+)?)\s*(k|m(?:il(?:lion)?)?)?\b/i.exec(s);
  if (!m) return null;
  const raw = m[1] as string;
  let n: number;
  if (/^\d{1,3}(?:[ ,.'’]\d{3})+$/.test(raw)) n = Number(raw.replace(/[ ,.'’]/g, ''));
  else n = Number(raw.replace(',', '.'));
  const mult = m[2] ? (/^k$/i.test(m[2]) ? 1000 : 1000000) : 1;
  return Number.isFinite(n) ? Math.round(n * mult) : null;
}

/** Karma from a whole line (label included): "Karma: 5 (total 23)", "Good Karma 5", "Karma Pool 2", "Karma 5/23". */
export function parseKarmaText(text: string, into: { good?: number; total?: number; pool?: number } = {}): { good?: number; total?: number; pool?: number } {
  let rest = text.toLowerCase().replace(/(\d),(\d{3})/g, '$1$2');
  const take = (...res: RegExp[]): number | undefined => {
    for (const re of res) {
      const m = re.exec(rest);
      if (m) {
        rest = rest.replace(m[0], ' ');
        return Number(m[1]);
      }
    }
    return undefined;
  };
  const pool = take(/(?:karma\s*)?pool\s*(?:karma\s*)?[:=]?\s*(\d+)/, /(\d+)\s*(?:in\s*(?:the\s*)?)?(?:karma\s*)?pool/);
  const total = take(/(?:total|career|earned|lifetime)\s*(?:karma\s*)?(?:earned\s*)?[:=]?\s*(\d+)/, /(\d+)\s*(?:total|career|earned|lifetime)/);
  let good = take(/(?:good|unspent|available|current|spare)\s*(?:karma\s*)?[:=]?\s*(\d+)/, /(\d+)\s*(?:good|unspent|available|left|spare|to spend)/);
  let tot = total;
  const slash = /(\d+)\s*\/\s*(\d+)/.exec(rest);
  if (slash && good === undefined && tot === undefined) {
    good = Number(slash[1]);
    tot = Number(slash[2]);
    rest = rest.replace(slash[0], ' ');
  }
  if (good === undefined) {
    const bare = /(\d+)/.exec(rest);
    if (bare) good = Number(bare[1]);
  }
  if (pool !== undefined) into.pool = pool;
  if (tot !== undefined) into.total = tot;
  if (good !== undefined) into.good = good;
  return into;
}

const LIFESTYLE_WORDS: Array<[RegExp, string]> = [
  [/luxury/i, 'luxury'], [/high/i, 'high'], [/middle|medium|\bmid\b/i, 'middle'], [/\blow\b/i, 'low'],
  [/squat/i, 'squatter'], [/street|homeless|\bnone\b/i, 'street'],
];
/** "Middle (2 months)", "Low lifestyle, 1 year prepaid" → level id and months. */
export function parseLifestyle(text: string): { name: string; level: string; months?: number } | null {
  const ids = RULES.UPKEEP.lifestyles.map((l) => l.id);
  const hit = LIFESTYLE_WORDS.find(([re, id]) => re.test(text) && ids.includes(id));
  if (!hit) return null;
  const mo = /(\d+)\s*(?:months?|mos?\b\.?)/i.exec(text);
  const yr = /(\d+)\s*(?:years?|yrs?\b)/i.exec(text);
  const months = mo ? Number(mo[1]) : yr ? Number(yr[1]) * 12 : undefined;
  const label = RULES.UPKEEP.lifestyles.find((l) => l.id === hit[1])?.label ?? cap(hit[1]);
  return { name: label, level: hit[1], ...(months !== undefined ? { months } : {}) };
}

// ===================================================================== Gear

const QTY_RES: Array<[RegExp, 'pre' | 'post']> = [
  [/^(\d+)\s*[x×*]\s*(.+)$/i, 'pre'],
  [/^(.+?)\s*[x×*]\s*(\d+)$/i, 'post'],
  [/^(.+?)\s*\(\s*(?:x\s*|qty\.?\s*:?\s*|quantity\s*:?\s*)(\d+)\s*\)$/i, 'post'],
  [/^(\d+)\s+(?!(?:mm|cm|m|kg|g|lbs?)\b)([A-Za-z].+)$/, 'pre'],
];
function splitQuantity(entry: string): { name: string; quantity: number } {
  for (const [re, side] of QTY_RES) {
    const m = re.exec(entry.trim());
    if (!m) continue;
    const q = Number(side === 'pre' ? m[1] : m[2]);
    const name = (side === 'pre' ? m[2] : m[1]) as string;
    if (q >= 1 && q <= 10000 && name.trim()) return { name: name.trim(), quantity: q };
  }
  return { name: entry.trim(), quantity: 1 };
}

/** VERIFY: well-known SR2 armor (ballistic/impact), from memory; used only when an entry gives none. */
const ARMOR_TABLE: Array<[RegExp, number, number, boolean?]> = [
  [/armou?r\s*clothing/i, 3, 0], [/armou?r\s*vest/i, 2, 1], [/armou?r\s*jacket/i, 5, 3], [/lined\s*coat/i, 4, 2],
  [/partial\s*heavy/i, 6, 4], [/full\s*heavy/i, 8, 6], [/helmet/i, 1, 1, true],
];
const ARMOR_NAME = /armou?r|jacket|\bvest\b|coat|duster|helmet|clothing|body\s*suit|form.?fitting|plate|shield|lined/i;
/**
 * A damage code: "(STR+2)M", "(str+1)m", "9M". v0.81.0 (RC-7): after a bare number the level letter is upper case
 * only, so "Rope 100m" is not a weapon; after a STR group either case is a level. No two `\s*` sit next to each
 * other (SEC2-7).
 */
const DAMAGE_TOKEN = /(\(?\s*[Ss][Tt][Rr](?:[Ee][Nn][Gg][Tt][Hh])?\s*(?:[+-]\s*\d+\s*)?(?:\)\s*)?[LMSDlmsd]\b|\b\d+[LMSD]\b)/;

/**
 * v0.81.1 (RC2-10): what makes a bare "20L" outside brackets a damage code and not litres: a weapon-like word or
 * maker in the entry, a firing mode, an ammo count, or Stun/Phys. VERIFY: the makers are from memory of SR2 gear.
 * Round 2 (V-REST 4): shuriken, throwing, glove, knuckle, star, spur, claw, sap and net count as weapon words too.
 */
const WEAPON_SIGNAL = /pistol|rifle|gun|\bsmg\b|shotgun|carbine|launcher|\bbow\b|crossbow|knife|blade|sword|katana|club|baton|axe|whip|spear|staff|grenade|taser|dart|narcoject|shuriken|throwing|glove|knuckle|\bstar\b|\bspurs?\b|claw|\bsap\b|\bnet\b|\b(?:SS|SA|BF|FA)\b|\(\s*(?:c|cl|b|m|cy)\s*\)|\bclip\b|\bammo\b|\bstun\b|\bphys|ares|colt|ruger|browning|beretta|ceska|ingram|\buzi\b|\bhk\b|heckler|remington|walther|fichetti|streetline|defiance|enfield|savalette|yamaha|\bfn\b|steyr|sandler|seco|raecor|morrissey|manhunter|predator|warhawk|mossberg|franchi|sako|barret|panther|cougar/i;

/**
 * A gear entry rewritten for the statblock weapon parser, or null if it has no damage code. `why` says why a code-like
 * token was not read as damage (the caller warns).
 */
function weaponForm(entry: string, why?: (w: string) => void): string | null {
  if (!DAMAGE_TOKEN.test(entry)) {
    // "Stun baton [6s Stun]": a lower-case level after a bare number in brackets isn't read; say so.
    const { groups } = groupsOf(entry);
    if (groups.some((g) => /^\d+\s?[lmsd]\b/.test(g))) why?.(tx('SR2E.Text.Charimport.hasADamageLikeCode', { entry }));
    return null;
  }
  const { groups } = groupsOf(entry);
  if (/[\])]\s*$/.test(entry) && groups.some((g) => DAMAGE_TOKEN.test(g))) return entry;
  const m = DAMAGE_TOKEN.exec(entry);
  if (!m) return null;
  // v0.81.1 (RC2-10): "Jerrycan of fuel 20L" is 20 litres, not 20 Light damage.
  if (/^\d+L$/.test(m[0]) && !WEAPON_SIGNAL.test(entry)) {
    why?.(tx('SR2E.Text.Charimport.wasReadAsASize', { entry, code: m[0] }));
    return null;
  }
  const name = entry.slice(0, m.index).replace(/[\s,:;-]+$/, '').trim();
  const rest = entry.slice(m.index).trim();
  return name ? `${name} [${rest}]` : null;
}

function weaponExtras(text: string, w: CharWeapon): void {
  const modes = /\b(SS|SA|BF|FA)((?:\s*\/\s*(?:SS|SA|BF|FA))*)\b/.exec(text);
  if (modes) w.modes = `${modes[1]}${(modes[2] ?? '').replace(/\s+/g, '')}`;
  const ammo = /(\d+)\s*\(\s*(?:c|cl|b|m|cy)\s*\)|\b(\d+)\s*(?:c|rounds?|rds?|shots?)\b|\b(?:clip|mag(?:azine)?|ammo)\s*:?\s*(\d+)/i.exec(text);
  if (ammo) w.ammoMax = Number(ammo[1] ?? ammo[2] ?? ammo[3]);
  if (/smart/i.test(text)) w.smartgun = true;
}

function parseGearEntry(raw: string, section: 'gear' | 'armor' | 'foci', warn: (w: string) => void): ParsedGear | null {
  const { name: qName, quantity } = splitQuantity(raw);
  const { rest, groups } = groupsOf(qName);
  let name = rest;
  let rating = 0;
  const notes: string[] = [];
  let ballistic: number | undefined;
  let impact: number | undefined;
  let qty = quantity;
  const bi = (s: string) => /^(\d+)\s*\/\s*(\d+)$/.exec(s.trim());
  // "Armor jacket 5/3", "Medkit Rating 3", "Medkit R3", "Power focus 2"
  const tailBI = /^(.*?\S)\s+(\d+)\s*\/\s*(\d+)$/.exec(name);
  if (tailBI) {
    name = tailBI[1] as string;
    ballistic = Number(tailBI[2]);
    impact = Number(tailBI[3]);
  }
  const tailRating = /^(.*?\S)\s+(?:rating\s*:?\s*|r\s*|level\s*)?(\d+)$/i.exec(name);
  if (tailRating && !/cyber-?$|-$/i.test(tailRating[1] as string) && !/\d$/.test(tailRating[1] as string)) {
    name = tailRating[1] as string;
    rating = Number(tailRating[2]);
  }
  for (const g of groups) {
    for (const tok of splitEntries(g)) {
      const b = bi(tok);
      const r = /^(?:rating|r|level|force|f)\s*:?\s*(\d+)$/i.exec(tok) ?? /^(\d+)$/.exec(tok);
      const q = /^(?:x\s*(\d+)|(\d+)\s*(?:rounds?|rds?|doses?|pcs?|pieces?|units?)|(?:qty|quantity)\s*:?\s*(\d+))$/i.exec(tok);
      if (b && ballistic === undefined) {
        ballistic = Number(b[1]);
        impact = Number(b[2]);
      } else if (q) qty = Number(q[1] ?? q[2] ?? q[3]);
      else if (r && !rating) rating = Number(r[1]);
      else notes.push(tok);
    }
  }
  name = name.replace(/[\s,:;-]+$/, '').trim();
  if (!name) {
    warn(tx('SR2E.Text.Charimport.couldNotReadGear', { raw }));
    return null;
  }

  // Focus
  const focus = /\bfoc(?:us|i)\b/i.test(name) || section === 'foci';
  if (focus) {
    const ft = (FOCUS_TYPES as readonly string[]).find((t) => new RegExp(`\\b${escRegExp(t)}\\b`, 'i').test(name)) as FocusType | undefined;
    const g: ParsedGear = { name, kind: 'focus', quantity: qty, rating: rating || 1, notes: '', focusType: ft ?? 'spell' };
    if (!ft) warn(tx('SR2E.Text.Charimport.focusTypeNotRecognisedSpell', { name }));
    if (!rating) warn(tx('SR2E.Text.Charimport.noFocusRating1Assumed', { name }));
    for (const n of notes) {
      const cat = (SPELL_CATEGORIES as readonly string[]).find((c) => c === n.toLowerCase());
      if (cat && !g.category) g.category = cat;
      else if (!g.target) g.target = n;
      else g.notes = [g.notes, n].filter(Boolean).join(', ');
    }
    return g;
  }

  // Armor
  const row = ARMOR_TABLE.find(([re]) => re.test(name));
  const armorish = section === 'armor' || (ballistic !== undefined && ARMOR_NAME.test(name)) || (ballistic === undefined && Boolean(row));
  if (armorish) {
    if (ballistic === undefined) {
      if (row) {
        ballistic = row[1];
        impact = row[2];
        warn(tx('SR2E.Text.Charimport.noBallisticImpactGivenUsed', { name, ballistic, impact }));
      } else {
        ballistic = 0;
        impact = 0;
        warn(tx('SR2E.Text.Charimport.noBallisticImpactGivenSet', { name }));
      }
    }
    return { name, kind: 'armor', quantity: qty, rating, ballistic, impact: impact ?? 0, notes: notes.join(', '), ...(row?.[3] ? { adds: true } : {}) };
  }

  if (ballistic !== undefined) notes.unshift(`${ballistic}/${impact}`);
  return { name, kind: 'gear', quantity: qty, rating, notes: notes.join(', ') };
}

// ===================================================================== Contacts, edges and flaws

const CONTACT_ROLE = /fixer|bartender|street\s*doc|\bdoc\b|decker|rigger|johnson|\bcop\b|detective|secretary|gang|talismonger|smuggler|bouncer|reporter|journalist|\bfence\b|mechanic|armou?rer|shaman|\bmage\b|wage\s*mage|club\s*owner|cabbie|taxi|lawyer|bodyguard|merc(?:enary)?|snitch|informant|bartender|dealer|yakuza|mafia|triad|technician|medic|pilot|guard|clerk|banker|professor|mr\.?\s*johnson/i;
/** v0.81.1 (RC2-4): a bracket token that is a role and nothing else ("Fixer", "the bartender", "Street doc"). */
const ROLE_TOKEN = new RegExp(`^(?:the\\s+|a\\s+|an\\s+)?(?:${CONTACT_ROLE.source})(?:\\s+\\w+)?$`, 'i');
const LEVEL_WORD: Array<[RegExp, number]> = [[/^(?:friend\s*for\s*life|friend)$/i, 3], [/^buddy$/i, 2], [/^contact$/i, 1]];

function contactLevelToken(tok: string): { level?: number; loyalty?: number } | null {
  const t = tok.trim();
  const lvl = /^(?:level|lvl|lv|l|rating|r)\s*[:#]?\s*(\d+)$/i.exec(t) ?? /^(\d+)$/.exec(t);
  if (lvl) return { level: Number(lvl[1]) };
  const loy = /^loyalty\s*[:#]?\s*(\d+)$/i.exec(t);
  if (loy) return { loyalty: Number(loy[1]) };
  for (const [re, n] of LEVEL_WORD) if (re.test(t)) return { level: n };
  return null;
}

export function parseContactEntry(entry: string): ParsedContact | null {
  const { rest, groups } = groupsOf(entry);
  let text = rest;
  let level: number | undefined;
  let loyalty: number | undefined;
  const notes: string[] = [];
  let roleTok = '';
  for (const g of groups) {
    for (const tok of splitEntries(g)) {
      const lv = contactLevelToken(tok);
      if (lv?.level !== undefined && level === undefined) level = lv.level;
      else if (lv?.loyalty !== undefined) loyalty = lv.loyalty;
      // v0.81.0 (RC-10): "Bob (Fixer)". v0.81.1 (RC2-4): only a token that is a role as a whole, so a note that
      // merely mentions a guard or a gang stays a note.
      else if (!roleTok && tok.split(/\s+/).length <= 3 && ROLE_TOKEN.test(tok)) roleTok = tok;
      else notes.push(tok);
    }
  }
  // Trailing "level 2", "Lvl 1", "loyalty 3", ", buddy" in the text itself.
  for (;;) {
    const m = /[\s,;:—–-]+((?:level|lvl|lv|loyalty)\s*[:#]?\s*\d+|buddy|friend\s*for\s*life|contact)\s*$/i.exec(text);
    if (!m) break;
    const lv = contactLevelToken(m[1] as string);
    if (lv?.level !== undefined && level === undefined) level = lv.level;
    if (lv?.loyalty !== undefined) loyalty = lv.loyalty;
    text = text.slice(0, m.index).trim();
  }
  const sep = /\s+[—–-]{1,2}\s+|\s*:\s+|\s+\/\s+/.exec(text);
  let name = text;
  let role = '';
  if (sep) {
    name = text.slice(0, sep.index).trim();
    role = text.slice(sep.index + sep[0].length).trim();
  }
  name = name.replace(/[\s,;:-]+$/, '').trim();
  if (!name) return null;
  if (!role && roleTok) role = roleTok;
  else if (roleTok) notes.unshift(roleTok); // v0.81.1 (RC2-4): the role came from a separator; keep the token
  if (!role && CONTACT_ROLE.test(name)) role = name;
  return { name, role, level: level ?? 1, ...(loyalty !== undefined ? { loyalty } : {}), notes: notes.join(', ') };
}

const FLAW_HINT = /allerg|addict|bad\s*luck|phobia|enem(?:y|ies)|\bsinner\b|compulsive|vindictive|amnesia|blind|deaf|bio-?rejection|combat\s*paralysis|dark\s*secret|day\s*job|flashback|gremlin|hunted|incompeten|infirm|insomnia|\bmute\b|oblivious|poor\s*link|reduced\s*sense|uneducated|weak\s*immune|wanted|code\s*of\s*honou?r|honou?r\s*bound|guilt|hemophilia|paraplegic|records\s*on\s*file|sensitive\s*system|spirit\s*bane|bad\s*rep|liability|dependent|police\s*record|distinctive/i;

export function parseQualityEntry(entry: string, section: 'edges' | 'flaws' | 'qualities', warn: (w: string) => void): ParsedQuality | null {
  let raw = entry.trim();
  let kind: 'edge' | 'flaw' | undefined = section === 'edges' ? 'edge' : section === 'flaws' ? 'flaw' : undefined;
  const pre = /^(edge|flaw)\s*[:-]\s*(.+)$/i.exec(raw);
  if (pre) {
    kind = (pre[1] as string).toLowerCase() as 'edge' | 'flaw';
    raw = pre[2] as string;
  }
  const { rest, groups } = groupsOf(raw);
  let name = rest;
  let points: number | undefined;
  let sign: '+' | '-' | undefined;
  const notes: string[] = [];
  const POINTS = /^([+\-−–])?\s*(\d+)\s*(?:pts?|points?)?$/i;
  const tail = /^(.*?\S)\s+([+\-−–])?\s*(\d+)\s*(?:pts?|points?)?$/i.exec(name);
  if (tail) {
    name = tail[1] as string;
    points = Number(tail[3]);
    if (tail[2]) sign = tail[2] === '+' ? '+' : '-';
  }
  for (const g of groups) {
    for (const tok of splitEntries(g)) {
      const m = POINTS.exec(tok);
      if (m && points === undefined) {
        points = Number(m[2]);
        if (m[1]) sign = m[1] === '+' ? '+' : '-';
      } else notes.push(tok);
    }
  }
  name = name.replace(/[\s,:;-]+$/, '').trim();
  if (!name) return null;
  if (!kind) {
    if (sign === '-') kind = 'flaw';
    else if (sign === '+') kind = 'edge';
    else if (FLAW_HINT.test(name)) kind = 'flaw';
    else {
      kind = 'edge';
      warn(tx('SR2E.Text.Charimport.notMarkedAsAnEdge', { name }));
    }
  }
  const signed = points;
  if (signed === undefined) warn(tx('SR2E.Text.Charimport.noPointValue1Assumed', { name }));
  return { name, kind, points: Math.max(0, signed ?? 1), notes: notes.join(', ') };
}

// ===================================================================== Parser

interface Section { key: Key; label: string; parts: string[] }

/** v0.81.0 (SEC2-7): the most text, and the longest line, the character import reads. */
export const MAX_SHEET_CHARS = 100_000;
export const MAX_SHEET_LINE = 10_000;

/**
 * Read a player-character write-up. Never throws; whatever it cannot read goes into `warnings` (and
 * `unknown` for whole lines).
 */
export function parseCharacterSheet(text: string): ParsedCharacter {
  const p: ParsedCharacter = {
    attributes: {}, skills: [], weapons: [], cyberware: [], spells: [], powers: [], warnings: [],
    gear: [], contacts: [], qualities: [], karma: {}, reputation: {}, biography: '', notes: '', unknown: [],
  };
  const warn = (w: string) => p.warnings.push(w);
  // v0.81.0 (SEC2-7): bounded input, so a pasted file cannot stall the client.
  let src = String(text ?? '');
  if (src.length > MAX_SHEET_CHARS) {
    warn(tx('SR2E.Text.Charimport.theTextIsOverCharacters', { max: MAX_SHEET_CHARS.toLocaleString('en') }));
    src = src.slice(0, MAX_SHEET_CHARS);
  }
  const rawLines = src.replace(/\r/g, '').replace(/\t/g, '    ').split('\n').map((l) => {
    if (l.length <= MAX_SHEET_LINE) return l;
    warn(tx('SR2E.Text.Charimport.aLineOverCharactersWas', { max: MAX_SHEET_LINE.toLocaleString('en'), start: l.slice(0, 40).trim() }));
    return l.slice(0, MAX_SHEET_LINE);
  });

  // ---- Pass 1: sections
  const sections: Section[] = [];
  const headerRows: string[] = [];
  const bio: string[] = [];
  const notes: string[] = [];
  let cur: Section | null = null;
  let firstLine: string | null = null;
  let sawLabel = false;
  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i] as string;
    const trimmed = line.trim();
    if (!trimmed) {
      if (cur && LIST_KEYS.has(cur.key) && cur.parts.some((x) => x.trim())) cur = null;
      else if (cur && TEXT_KEYS.has(cur.key)) cur.parts.push('');
      continue;
    }
    if (/^[-=_*#~]{3,}$/.test(trimmed)) continue;
    if (isHeaderRow(trimmed)) {
      const next = rawLines.slice(i + 1).findIndex((l) => l.trim() !== '');
      const valueLine = next >= 0 ? (rawLines[i + 1 + next] as string) : '';
      // v0.81.1 (RC2-1): blanks collapsed, as splitMultiLabel does (the row goes on to the stat block parser).
      headerRows.push(trimmed, valueLine.replace(/\s+/g, ' ').trim());
      if (next >= 0) i = i + 1 + next;
      cur = null;
      sawLabel = true;
      continue;
    }
    for (const piece of splitMultiLabel(trimmed)) {
      const lm = LABEL_LINE.exec(piece);
      const key = lm ? labelKey(lm[1] as string) : null;
      const inText = cur && TEXT_KEYS.has(cur.key);
      if (lm && key) {
        sawLabel = true;
        if (key === 'attr') {
          readAttributeLine(piece, p);
          cur = null;
          continue;
        }
        cur = { key, label: (lm[1] as string).trim(), parts: [(lm[2] as string).trim()] };
        sections.push(cur);
        continue;
      }
      // v0.81.0 (RC-1): inside a list ("Gear:"), "Credstick 1500" or "Grade 2 rations" is an entry, not a value label.
      // Only for a list laid out one entry per line: the line is indented, or the header had no inline value. After
      // "Gear: A, B" an unindented "Karma 12" ends the list as before (R2-REST 1).
      const inList = cur && LIST_KEYS.has(cur.key) && (/^\s/.test(line) || cur.parts[0] === '');
      const bareLabel = !lm || !key ? colonless(piece) : null;
      // v0.81.1 (RC2-3): inside such a list, "Nuyen 5,000", "Karma 3" or "Lifestyle Middle" still ends it: a label
      // that can't be gear, with a bare amount. "Credstick 1500" and "Grade 2 rations" stay entries.
      const strongValue = !!bareLabel && STRONG_IN_LIST.test(bareLabel.label)
        && (bareLabel.key === 'lifestyle' || /^[¥\d][\d.,' ]*(?:¥|nuyen)?(?:\s*\(.*\))?$/i.test(bareLabel.value));
      if (!inText && (!inList || strongValue) && bareLabel) {
        sawLabel = true;
        cur = { key: bareLabel.key, label: bareLabel.label, parts: [bareLabel.value] };
        sections.push(cur);
        cur = null;
        continue;
      }
      if (!inText && ATTR_LINE.test(piece)) {
        sawLabel = true;
        readAttributeLine(piece, p);
        cur = null;
        continue;
      }
      if (cur && (LIST_KEYS.has(cur.key) || TEXT_KEYS.has(cur.key))) {
        cur.parts.push(TEXT_KEYS.has(cur.key) ? line.replace(/\s+$/, '') : piece);
        continue;
      }
      if (!sawLabel && firstLine === null) {
        firstLine = piece;
        continue;
      }
      p.unknown.push(piece);
    }
  }

  // ---- Pass 2: values
  const listText = (s: Section): string[] => {
    // Join continuation lines: a line after one ending in "," or inside open brackets, or starting in
    // lower case, continues the entry; otherwise each line is an entry.
    let acc = '';
    for (const part of s.parts) {
      const t = part.trim().replace(/^[-*•·–]\s+/, '');
      if (!t) continue;
      if (!acc) acc = t;
      else if (/[,;]\s*$/.test(acc) || openDepth(acc) > 0 || /^[a-z(]/.test(t)) acc += ` ${t}`;
      else acc += `, ${t}`;
    }
    return splitEntries(acc);
  };
  const textOf = (s: Section) => s.parts.join('\n').replace(/^\n+|\n+$/g, '').trim();
  const byKey = (k: Key) => sections.filter((s) => s.key === k);
  const one = (k: Key): Section | undefined => {
    const all = byKey(k);
    return all[all.length - 1];
  };

  const nameS = one('name');
  const streetS = one('street');
  if (nameS && textOf(nameS)) p.realName = textOf(nameS);
  if (streetS && textOf(streetS)) p.streetName = textOf(streetS);
  const realS = one('realName');
  if (realS && textOf(realS)) p.realName = textOf(realS);
  const playerS = one('player');
  if (playerS && textOf(playerS)) p.player = textOf(playerS);

  let metaText = one('metatype') ? textOf(one('metatype') as Section) : '';
  const archS = one('archetype');
  if (archS && textOf(archS)) p.archetype = textOf(archS);
  // An unlabelled first line: the name, perhaps with "— Elf Street Samurai".
  if (firstLine) {
    const parts = firstLine.split(/\s+[—–-]+\s+|\s*,\s*|\s*\(\s*/);
    const head = (parts[0] ?? '').replace(/[)"]+$/, '').trim();
    const tail = firstLine.slice(head.length).replace(/^[\s—–,(-]+|\)\s*$/g, '').trim();
    if (!p.streetName && !p.realName && head) p.streetName = head;
    else notes.push(firstLine);
    if (tail) {
      if (!metaText && metatypeFromText(tail)) metaText = tail;
      if (!p.archetype) p.archetype = tail;
    }
  }
  p.name = p.streetName ?? p.realName;
  if (p.streetName && p.realName && p.streetName !== p.realName) notes.push(tx('SR2E.Text.Charimport.realName', { name: p.realName }));
  if (p.player) notes.push(tx('SR2E.Text.Charimport.player', { player: p.player }));
  if (p.archetype) notes.push(tx('SR2E.Text.Charimport.archetype', { archetype: p.archetype }));

  if (metaText) {
    const mt = metatypeFromText(metaText);
    if (!mt) warn(tx('SR2E.Text.Charimport.metatypeNotRecognised', { text: metaText, ids: metatypeIds().join(', ') }));
    else {
      p.metatype = mt.id;
      if (mt.variant) warn(tx('SR2E.Text.Charimport.isAMetavariantImportedAs', { text: metaText, metatype: RULES.METATYPES.types[mt.id]?.label ?? mt.id }));
    }
  }

  // Tradition and totem
  const tradS = one('tradition');
  if (tradS && textOf(tradS)) {
    const t = traditionFromText(textOf(tradS));
    if (t) p.tradition = t;
    else warn(tx('SR2E.Text.Charimport.traditionNotRecognised', { text: textOf(tradS), list: TRADITIONS.join(', ') }));
  }
  const totemS = one('totem');
  if (totemS && textOf(totemS)) p.totem = textOf(totemS).replace(/\s*\(.*\)\s*$/, '').trim();
  const gradeS = one('grade');
  if (gradeS) {
    const g = /(\d+)/.exec(textOf(gradeS));
    if (g) p.initiateGrade = Number(g[1]);
  }

  // Money, Karma, lifestyle, reputation
  for (const s of byKey('nuyen')) {
    const n = parseNuyen(textOf(s));
    if (n === null) warn(tx('SR2E.Text.Charimport.couldNotReadNuyen', { text: textOf(s) }));
    else p.nuyen = n;
  }
  for (const s of byKey('karma')) parseKarmaText(`${s.label} ${textOf(s)}`, p.karma);
  if (p.karma.pool !== undefined) p.karmaPool = p.karma.pool;
  const lifeS = one('lifestyle');
  if (lifeS) {
    const l = parseLifestyle(textOf(lifeS));
    if (l) p.lifestyle = l;
    else warn(tx('SR2E.Text.Charimport.lifestyleNotRecognised', { text: textOf(lifeS), list: RULES.UPKEEP.lifestyles.map((x) => x.label).join(', ') }));
  }
  for (const [k, field] of [['streetCred', 'streetCred'], ['notoriety', 'notoriety'], ['publicAwareness', 'publicAwareness']] as const) {
    const s = one(k);
    const n = s ? /(\d+)/.exec(textOf(s)) : null;
    if (n) p.reputation[field] = Number(n[1]);
  }

  // Text
  for (const s of sections) {
    if (s.key === 'background') bio.push(`${/^(?:background|biography|bio)$/i.test(s.label) ? '' : `${cap(s.label.toLowerCase())}: `}${textOf(s)}`);
    else if (s.key === 'physical') bio.push(`${cap(s.label.toLowerCase())}: ${textOf(s)}`);
    else if (s.key === 'notes') notes.push(textOf(s));
    else if (s.key === 'ignore') warn(tx('SR2E.Text.Charimport.isWorkedOutByThe', { label: s.label, text: textOf(s) }));
  }

  // ---- The attribute header row first (a native language takes its rating from Intelligence).
  if (headerRows.length) {
    const hdr = parseStatBlock(headerRows.join('\n'));
    p.warnings.push(...hdr.warnings);
    for (const [k, v] of Object.entries(hdr.attributes) as Array<[AttributeKey, ParsedAttribute | undefined]>) if (v && !p.attributes[k]) p.attributes[k] = v;
    if (hdr.essence !== undefined && p.essence === undefined) p.essence = hdr.essence;
    if (hdr.magic !== undefined && p.magic === undefined) p.magic = hdr.magic;
    if (hdr.reaction && !p.reaction) p.reaction = hdr.reaction;
    if (hdr.armor) p.armor = hdr.armor;
  }

  // ---- Skills (through the statblock parser)
  const native = new Set<string>();
  const skillEntries = (k: Key, kind: CharSkillKind): string[] => {
    const out: string[] = [];
    for (const s of byKey(k)) {
      for (let e of listText(s)) {
        let isNative = false;
        if (/\bnative\b|\(\s*n\s*\)|\s[Nn]$/.test(e) && (kind === 'language' || /native/i.test(e))) {
          isNative = true;
          e = e.replace(/\(\s*native(?:\s+language)?\s*\)|\bnative(?:\s+language)?\s*:?|\(\s*n\s*\)|\s[Nn]$/gi, ' ').replace(/\s+/g, ' ').trim();
        }
        // Read/write ratings are worked out by the system.
        if (/\b(?:r\/w|read\/write|read & write)\b/i.test(e)) {
          // v0.81.0 (SEC2-7): blanks collapsed first; the pattern's adjacent `\s*` groups were cubic on a long blank run.
          e = e.replace(/\s+/g, ' ').replace(/[,;]? ?\(? ?(?:r\/w|read\/write|read & write) ?:? ?\d* ?\)?/gi, ' ').replace(/\s+/g, ' ').trim();
          warn(tx('SR2E.Text.Charimport.theReadWriteRatingIs', { skill: e }));
        }
        e = e.replace(/\s*[([]\s*[KkLl]\s*[)\]]/g, '');
        if (isNative && !/\d\s*(?:\(|$)/.test(e)) {
          const int = p.attributes.intelligence;
          const r = int ? int.base : 0;
          if (!r) warn(tx('SR2E.Text.Charimport.nativeLanguageWithNoRating', { skill: e }));
          e = `${e} ${r}`;
        }
        if (isNative) native.add(norm(e.replace(/\s+\d+.*$/, '')));
        out.push(e);
      }
    }
    return out;
  };
  const activeEntries = skillEntries('skills', 'active');
  const kinds: Array<[Key, CharSkillKind]> = [['knowledge', 'knowledge'], ['language', 'language'], ['buildRepair', 'buildRepair']];
  const others = kinds.map(([k, kind]) => [kind, skillEntries(k, kind)] as const);

  // ---- Gear
  const weaponEntries: Array<{ form: string; raw: string; quantity: number }> = [];
  for (const k of ['gear', 'armor', 'foci'] as const) {
    for (const s of byKey(k)) {
      for (const entry of listText(s)) {
        if (k === 'gear') {
          const { name, quantity } = splitQuantity(entry);
          const form = weaponForm(name, warn);
          if (form) {
            weaponEntries.push({ form, raw: name, quantity });
            continue;
          }
          if (/cyberdeck|\bdeck\b|\bmpcp\b|fuchi|sony\s*cia|cyber-\d/i.test(entry)) {
            const g = parseGearEntry(entry, 'gear', warn);
            if (g) {
              g.notes = [g.notes, tx('SR2E.Text.Charimport.cyberdeckCreateACyberdeckItem')].filter(Boolean).join('; ');
              p.gear.push(g);
              warn(tx('SR2E.Text.Charimport.importedAsPlainGearCreate', { name: g.name }));
            }
            continue;
          }
        }
        const g = parseGearEntry(entry, k, warn);
        if (!g) continue;
        const dup = p.gear.find((x) => x.kind === g.kind && norm(x.name) === norm(g.name) && x.rating === g.rating && g.kind === 'gear');
        if (dup) dup.quantity += g.quantity;
        else p.gear.push(g);
      }
    }
  }

  // ---- One statblock parse for attributes (header row), active skills, cyberware, spells, powers.
  const blocks: string[] = [];
  if (activeEntries.length) blocks.push(`Skills: ${activeEntries.join(', ')}`);
  const listOf = (k: Key) => byKey(k).flatMap(listText);
  const cyber = listOf('cyber');
  const biow = listOf('bioware');
  const spells = listOf('spells');
  const powers = listOf('powers');
  if (cyber.length) blocks.push(`Cyberware: ${cyber.join(', ')}`);
  if (biow.length) blocks.push(`Bioware: ${biow.join(', ')}`);
  if (spells.length) blocks.push(`Spells: ${spells.join(', ')}`);
  if (powers.length) blocks.push(`Adept Powers: ${powers.join(', ')}`);
  const sb = parseStatBlock(blocks.join('\n\n'));
  for (const w of sb.warnings) if (statBlockWarningCode(sb.warnings, w) !== 'noAttributeHeader') warn(w);
  p.cyberware = sb.cyberware;
  p.spells = sb.spells;
  p.powers = sb.powers;
  for (const s of sb.skills) p.skills.push({ ...s, kind: /\bB\/R$/i.test(s.name) ? 'buildRepair' : 'active' });

  for (const [kind, entries] of others) {
    if (!entries.length) continue;
    const r = parseStatBlock(`Skills: ${entries.join(', ')}`);
    for (const w of r.warnings) if (statBlockWarningCode(r.warnings, w) !== 'noAttributeHeader') warn(w);
    for (const s of r.skills) {
      const name = kind === 'buildRepair' && !/\bB\/R$/i.test(s.name) ? `${s.name} B/R` : s.name;
      p.skills.push({ ...s, name, attribute: 'intelligence', kind, ...(kind === 'language' && native.has(norm(s.name)) ? { native: true } : {}) });
    }
  }

  // Weapons, with the active skills to link them to.
  const skillLine = activeEntries.length ? `Skills: ${activeEntries.join(', ')}\n\n` : '';
  for (const we of weaponEntries) {
    const r = parseStatBlock(`${skillLine}Gear: ${we.form}`);
    const w = r.weapons[0] as CharWeapon | undefined;
    if (!w) {
      const g = parseGearEntry(we.raw, 'gear', warn);
      // v0.81.0 (RC-7): we.raw is the name after "2x" was split off; keep that quantity.
      if (g) {
        g.quantity = Math.max(g.quantity, we.quantity);
        p.gear.push(g);
      }
      continue;
    }
    weaponExtras(we.form, w);
    const extra = groupsOf(we.form).groups.join(', ');
    if (extra) w.notes = extra;
    if (we.quantity > 1) {
      w.quantity = we.quantity;
      warn(tx('SR2E.Text.Charimport.oneWeaponItemIsCreated', { quantity: we.quantity, name: w.name }));
    }
    p.weapons.push(w);
  }

  // Contacts, edges and flaws
  for (const s of byKey('contacts')) {
    // "Bartender, level 1": a level split off by the comma belongs to the entry before it.
    const entries: string[] = [];
    for (const e of listText(s)) {
      const bare = /^\((.*)\)$/.exec(e)?.[1] ?? e;
      if (entries.length && !/[()]/.test(bare) && contactLevelToken(bare)) entries[entries.length - 1] += ` (${bare})`;
      else entries.push(e);
    }
    for (const e of entries) {
      const c = parseContactEntry(e);
      if (c) p.contacts.push(c);
      else warn(tx('SR2E.Text.Charimport.couldNotReadContact', { entry: e }));
    }
  }
  for (const k of ['qualities', 'edges', 'flaws'] as const) {
    for (const s of byKey(k)) {
      // "Edges: A, B; Flaws: C" on one line. v0.81.0 (RC-2): each line stays its own line, so one edge or flaw per
      // line is not run together.
      const runs: Array<[typeof k, string[]]> = [[k, []]];
      for (const part of s.parts) {
        const segs = part.split(/\b(edges?|flaws?)\s*:/i);
        runs[runs.length - 1]![1].push(segs[0] ?? '');
        for (let i = 1; i + 1 < segs.length; i += 2) runs.push([/^edge/i.test(segs[i] as string) ? 'edges' : 'flaws', [segs[i + 1] as string]]);
      }
      for (const [sec, parts] of runs) {
        const fake: Section = { key: sec, label: sec, parts };
        for (const e of listText(fake)) {
          if (/^(?:none|n\/a|-)$/i.test(e)) continue;
          const q = parseQualityEntry(e, sec, warn);
          if (q) p.qualities.push(q);
        }
      }
    }
  }

  // Tradition from the archetype, the totem, spells or powers.
  if (!p.tradition) {
    const fromArch = p.archetype ? traditionFromText(p.archetype) : null;
    if (fromArch && fromArch !== 'none') p.tradition = fromArch;
    else if (p.totem) p.tradition = 'shamanic';
    else if (p.powers.length && !p.spells.length && (p.magic ?? 0) > 0) p.tradition = 'adept';
    else if (p.spells.length || p.skills.some((s) => /^(?:sorcery|conjuring)$/i.test(s.name))) warn(tx('SR2E.Text.Charimport.spellsOrMagicalSkillsBut'));
  }

  for (const u of p.unknown) warn(tx('SR2E.Text.Charimport.lineNotRecognised', { line: u }));
  p.biography = bio.filter(Boolean).join('\n\n');
  const unknownBlock = p.unknown.length ? [tx('SR2E.Text.Charimport.notImported', { lines: p.unknown.join('\n') })] : [];
  p.notes = [...notes.filter(Boolean), ...unknownBlock].join('\n\n');
  return p;
}

// ===================================================================== Plan

const fmtAttr = (label: string, v: ParsedAttribute | undefined) => (v ? (v.augmented !== undefined ? tx('SR2E.Text.Charimport.attributeAugmented', { label, base: v.base, augmented: v.augmented }) : tx('SR2E.Text.Charimport.attributeValue', { label, base: v.base })) : '');
/** v0.89.6: an attribute's name for the import summary and warnings. */
const attrName = (k: AttributeKey): string => {
  switch (k) {
    case 'body': return tx('SR2E.Text.Charimport.body');
    case 'quickness': return tx('SR2E.Text.Charimport.quickness');
    case 'strength': return tx('SR2E.Text.Charimport.strength');
    case 'charisma': return tx('SR2E.Text.Charimport.charisma');
    case 'intelligence': return tx('SR2E.Text.Charimport.intelligence');
    case 'willpower': return tx('SR2E.Text.Charimport.willpower');
  }
};

/**
 * Turn a parsed write-up into what the Foundry glue applies: one actor update (dotted paths), item
 * creation data (replace: true for items already on the actor by type and name), the contacts and
 * edges/flaws arrays, values to set after the items exist (`after`), a summary and warnings.
 * Attribute mods leave out the bonuses the imported cyberware, bioware and adept powers add
 * (statBlockAttributeBonuses), as applyStatBlock does, so nothing counts twice.
 */
export function characterImportPlan(p: ParsedCharacter, current: CharacterImportCurrent = {}): CharacterImportPlan {
  const warnings: string[] = [...p.warnings];
  const actorUpdate: Record<string, unknown> = {};
  const items: CharacterImportItem[] = [];
  const after: CharacterImportPlan['after'] = {};
  const summary: string[] = [];
  const makeId = current.makeId ?? randomId;

  if (p.name) actorUpdate['name'] = p.name;
  const metatypeId = p.metatype && metatypeKnown(p.metatype) ? p.metatype : undefined;
  if (p.metatype && !metatypeId) warnings.push(tx('SR2E.Text.Charimport.metatypeIsNotOneOf', { metatype: p.metatype, ids: metatypeIds().join(', ') }));
  if (metatypeId) actorUpdate['system.metatype'] = metatypeId;
  if (p.name || metatypeId) {
    const name = p.name ?? tx('SR2E.Text.Charimport.unnamed');
    const metatype = metatypeId ? RULES.METATYPES.types[metatypeId]?.label ?? metatypeId : '';
    summary.push(metatypeId
      ? (p.archetype ? tx('SR2E.Text.Charimport.nameMetatypeArchetype', { name, metatype, archetype: p.archetype }) : tx('SR2E.Text.Charimport.nameMetatype', { name, metatype }))
      : (p.archetype ? tx('SR2E.Text.Charimport.nameArchetype', { name, archetype: p.archetype }) : name));
  }

  // ---- Items first: the attribute mods depend on them.
  const extra = statBlockItems(p, { adept: true });
  warnings.push(...extra.warnings);
  for (const it of extra.items) items.push({ type: it.type, name: it.name, system: it.system });

  for (const s of p.skills) {
    const rating = Math.max(0, Math.round(s.rating));
    if (rating > 12) warnings.push(tx('SR2E.Text.Charimport.unusuallyHighSkillRating', { name: s.name, rating }));
    const spec = s.specialization ? splitSpecialization(s.specialization) : null;
    items.push({ type: 'skill', name: s.name, system: {
      rating, attribute: s.kind === 'active' ? s.attribute : 'intelligence', kind: s.kind,
      ...(spec ? { specialization: spec.name, specializationRating: spec.rating } : {}),
      ...(s.native ? { native: true } : {}),
    } });
  }
  for (const w of p.weapons) {
    items.push({ type: 'weapon', name: w.name, system: {
      damagePower: w.power, damageLevel: w.level, damageType: w.damageType, melee: w.melee, skill: w.skill,
      ...(w.strengthPower ? { strengthPower: true } : {}), ...(w.reach !== undefined ? { reach: w.reach } : {}),
      ...(w.modes ? { modes: w.modes } : {}),
      ...(w.ammoMax ? { ammoMax: w.ammoMax, ammo: w.ammoMax } : {}),
      ...(w.smartgun ? { smartgun: true } : {}),
      ...(w.notes ? { description: toHtml(w.notes) } : {}),
    } });
  }
  const armorItems = p.gear.filter((g) => g.kind === 'armor');
  for (const g of p.gear) {
    const description = g.notes ? toHtml(g.notes) : '';
    if (g.kind === 'armor') {
      items.push({ type: 'armor', name: g.name, system: { ballistic: g.ballistic ?? 0, impact: g.impact ?? 0, worn: true, ...(g.adds ? { adds: true } : {}), ...(description ? { description } : {}) } });
      if (g.quantity > 1) warnings.push(tx('SR2E.Text.Charimport.oneArmorItemIsCreated', { quantity: g.quantity, name: g.name }));
    } else if (g.kind === 'focus') {
      items.push({ type: 'focus', name: g.name, system: { focusType: g.focusType ?? 'spell', rating: g.rating, bonded: true, active: true, ...(g.category ? { category: g.category } : {}), ...(g.target ? { target: g.target } : {}), ...(description ? { description } : {}) } });
    } else {
      const system: Record<string, unknown> = { quantity: g.quantity };
      const patch = /\b(stim|tranq|trauma|antidote)\b.*\bpatch|\bpatch\b.*\b(stim|tranq|trauma|antidote)\b/i.exec(g.name);
      const ratingNote: string[] = [];
      if (/med\s*-?kit/i.test(g.name)) system.medkitRating = g.rating;
      else if (patch && (RULES.PATCHES.kinds as readonly string[]).includes(((patch[1] ?? patch[2]) as string).toLowerCase())) {
        system.patch = { kind: ((patch[1] ?? patch[2]) as string).toLowerCase(), rating: g.rating };
      } else if (g.rating) ratingNote.push(tx('SR2E.Text.Charimport.rating', { rating: g.rating }));
      const desc = [...ratingNote, g.notes].filter(Boolean).join('; ');
      if (desc) system.description = toHtml(desc);
      items.push({ type: 'gear', name: g.name, system });
    }
  }
  if (p.armor && (p.armor.ballistic > 0 || p.armor.impact > 0) && !armorItems.length) {
    items.push({ type: 'armor', name: 'Armor (imported)', system: { ballistic: p.armor.ballistic, impact: p.armor.impact, worn: true } });
  }

  // Items already on the actor
  const have = new Set((current.itemNames ?? []).map((i) => `${i.type}|${norm(i.name)}`));
  const seen = new Set<string>();
  for (const it of items) {
    const key = `${it.type}|${norm(it.name)}`;
    if (have.has(key)) it.replace = true;
    if (seen.has(key)) warnings.push(tx('SR2E.Text.Charimport.isListedTwiceTheSecond', { name: it.name, type: it.type }));
    seen.add(key);
  }
  // Only the last of each listed-twice item is made.
  for (let i = items.length - 1, kept = new Set<string>(); i >= 0; i--) {
    const key = `${items[i]!.type}|${norm(items[i]!.name)}`;
    if (kept.has(key)) items.splice(i, 1); else kept.add(key);
  }

  // ---- Attributes
  const bonus = statBlockAttributeBonuses(extra.items.filter((i) => i.type !== 'skill')) as Record<string, number>;
  const attrKeys = ATTRS.filter((k) => p.attributes[k]);
  if (attrKeys.length) {
    // Written-up attributes already include the racial modifiers.
    actorUpdate['system.racialModifiers'] = false;
    const limits: Partial<Record<AttributeKey, { natural: number; total: number }>> = {};
    for (const k of attrKeys) {
      const v = p.attributes[k] as ParsedAttribute;
      let base = Math.round(v.base);
      if (base < 1) {
        warnings.push(tx('SR2E.Text.Charimport.below1SetTo1', { attribute: attrName(k), value: v.base }));
        base = 1;
      }
      if (base > 20) {
        warnings.push(tx('SR2E.Text.Charimport.implausiblyHighSetTo20', { attribute: attrName(k), value: v.base }));
        base = 20;
      }
      const shown = v.augmented !== undefined ? Math.round(v.augmented) : base;
      actorUpdate[`system.attributes.${k}.base`] = base;
      actorUpdate[`system.attributes.${k}.mod`] = shown - base - (bonus[k] ?? 0);
      limits[k] = { natural: base, total: shown };
    }
    // v0.81.0: the actor's Exceptional Attribute edges raise the maximums (parsed qualities carry no target attribute).
    if (metatypeId) warnings.push(...attributeLimitsWith(metatypeId, limits as Record<AttributeKey, { natural: number; total: number }>, (current.qualities ?? []) as unknown as Quality[]).warnings.map((w) => tx('SR2E.Text.Charimport.forAMetatype', { warning: w, metatype: RULES.METATYPES.types[metatypeId]?.label ?? metatypeId })));
    const shownRow = attrKeys.map((k) => fmtAttr(attrName(k), p.attributes[k])).filter(Boolean);
    summary.push(shownRow.join(', '));
  }
  const derivedRow: string[] = [];
  if (p.essence !== undefined) {
    let e = Math.round(p.essence * 100) / 100;
    if (e > 6) {
      warnings.push(tx('SR2E.Text.Charimport.essenceIsAbove66', { essence: p.essence }));
      e = 6;
    }
    if (e < 0) {
      warnings.push(tx('SR2E.Text.Charimport.essenceIsBelow00', { essence: p.essence }));
      e = 0;
    }
    after.essenceShown = e;
    derivedRow.push(tx('SR2E.Text.Charimport.essence', { value: e }));
  }
  if (p.magic !== undefined) {
    let m = Math.max(0, Math.round(p.magic));
    const maxMagic = 6 + (p.initiateGrade ?? 0);
    if (m > maxMagic) {
      warnings.push(p.initiateGrade ? tx('SR2E.Text.Charimport.magicIsAboveInitiate', { magic: m, max: maxMagic, grade: p.initiateGrade }) : tx('SR2E.Text.Charimport.magicIsAboveCheckIt', { magic: m, max: maxMagic }));
      if (m > 20) m = 20;
    }
    if (p.essence !== undefined && m > Math.ceil(p.essence) + (p.initiateGrade ?? 0)) warnings.push(tx('SR2E.Text.Charimport.magicIsHigherThanEssence', { magic: m, essence: p.essence }));
    actorUpdate['system.magic'] = m;
    derivedRow.push(tx('SR2E.Text.Charimport.magic', { value: m }));
  }
  if (p.reaction) {
    after.reactionShown = Math.round(p.reaction.augmented ?? p.reaction.base);
    derivedRow.push(fmtAttr(tx('SR2E.Text.Charimport.reaction'), p.reaction));
  }
  if (p.initiativeDice !== undefined) {
    const d = clamp(Math.round(p.initiativeDice), 1, 5);
    if (d !== p.initiativeDice) warnings.push(tx('SR2E.Text.Charimport.initiativeD6D6Used', { dice: p.initiativeDice, used: d }));
    after.initiativeDice = d;
    derivedRow.push(tx('SR2E.Text.Charimport.initiativeD6', { dice: d }));
  }
  if (derivedRow.length) summary.push(derivedRow.join(', '));

  // ---- Magic
  if (p.tradition) {
    actorUpdate['system.tradition'] = p.tradition;
    summary.push(p.totem ? tx('SR2E.Text.Charimport.traditionTotem', { tradition: p.tradition, totem: p.totem }) : tx('SR2E.Text.Charimport.tradition', { tradition: p.tradition }));
    if (p.tradition !== 'none' && p.magic === undefined) warnings.push(tx('SR2E.Text.Charimport.aWithNoMagicRating', { tradition: p.tradition }));
  }
  if (p.totem) {
    actorUpdate['system.totem.name'] = p.totem;
    const row = (RULES.SECURITY_V61.npc.totems ?? []).find((t) => norm(t.name) === norm(p.totem as string));
    if (row) {
      for (const f of ['combat', 'detection', 'health', 'illusion', 'manipulation', 'conjuring', 'inEnvironment', 'outEnvironment'] as const) actorUpdate[`system.totem.${f}`] = row[f];
      actorUpdate['system.totem.environment'] = row.environment;
      actorUpdate['system.totem.spirits'] = row.spirits;
      warnings.push(tx('SR2E.Text.Charimport.totemItsDiceAreTaken', { name: row.name }));
    } else warnings.push(tx('SR2E.Text.Charimport.totemIsNotInThe', { totem: p.totem }));
    if (p.tradition && p.tradition !== 'shamanic' && p.tradition !== 'shamanist') warnings.push(tx('SR2E.Text.Charimport.aTotemWithTradition', { tradition: p.tradition }));
  }
  if (p.initiateGrade !== undefined) {
    actorUpdate['system.initiateGrade'] = clamp(p.initiateGrade, 0, 20);
    summary.push(tx('SR2E.Text.Charimport.initiateGrade', { grade: p.initiateGrade }));
  }

  // ---- Money, Karma, lifestyle, reputation
  if (p.nuyen !== undefined) {
    actorUpdate['system.nuyen'] = Math.max(0, Math.round(p.nuyen));
    summary.push(tx('SR2E.Text.Charimport.nuyen', { nuyen: Math.round(p.nuyen).toLocaleString('en-US') }));
  }
  const k = p.karma;
  if (k.good !== undefined) actorUpdate['system.karma.good'] = Math.max(0, k.good);
  if (k.total !== undefined) actorUpdate['system.karma.career'] = Math.max(0, k.total);
  if (k.pool !== undefined) actorUpdate['system.karma.pool'] = Math.max(0, k.pool);
  if (k.good !== undefined && k.total !== undefined && k.total < k.good) warnings.push(tx('SR2E.Text.Charimport.karmaGoodButOnlyTotal', { good: k.good, total: k.total }));
  if (k.good !== undefined || k.total !== undefined || k.pool !== undefined) {
    summary.push(tx('SR2E.Text.Charimport.karma', { list: [k.good !== undefined ? tx('SR2E.Text.Charimport.karmaGood', { good: k.good }) : '', k.total !== undefined ? tx('SR2E.Text.Charimport.karmaTotal', { total: k.total }) : '', k.pool !== undefined ? tx('SR2E.Text.Charimport.karmaPool', { pool: k.pool }) : ''].filter(Boolean).join(', ') }));
  }
  if (p.lifestyle) {
    actorUpdate['system.lifestyle.level'] = p.lifestyle.level;
    if (p.lifestyle.months !== undefined) {
      const months = clamp(p.lifestyle.months, 0, 120);
      if (months !== p.lifestyle.months) warnings.push(tx('SR2E.Text.Charimport.lifestylePaidMonthsAhead', { months: p.lifestyle.months, used: months }));
      after.lifestyleMonths = months;
      after.lifestyleSeconds = months * RULES.UPKEEP.monthDays * 86400;
    }
    summary.push(p.lifestyle.months !== undefined ? tCount(p.lifestyle.months, 'SR2E.Text.Charimport.lifestyleMonthsPaid', { name: p.lifestyle.name }) : tx('SR2E.Text.Charimport.lifestyle', { name: p.lifestyle.name }));
  }
  const rep = p.reputation;
  if (rep.streetCred !== undefined) actorUpdate['system.reputation.streetCred'] = rep.streetCred;
  if (rep.notoriety !== undefined) actorUpdate['system.reputation.notoriety'] = rep.notoriety;
  if (rep.publicAwareness !== undefined) actorUpdate['system.reputation.publicAwareness'] = rep.publicAwareness;

  // ---- Text
  const appendHtml = (existing: string | undefined, add: string) => (existing && existing.trim() ? `${existing}<hr>${add}` : add);
  if (p.biography) actorUpdate['system.biography'] = appendHtml(current.biography, toHtml(p.biography));
  if (p.notes) actorUpdate['system.notes'] = appendHtml(current.notes, toHtml(p.notes));

  // ---- Contacts
  let contacts: Array<Record<string, unknown>> | undefined;
  if (p.contacts.length) {
    contacts = (current.contacts ?? []).map((c) => ({ ...c }));
    for (const c of p.contacts) {
      const level = clamp(Math.round(c.level), 1, 3);
      if (level !== c.level) warnings.push(tx('SR2E.Text.Charimport.contactLevelIsOutside13', { name: c.name, level: c.level, used: level }));
      const loyalty = c.loyalty !== undefined ? clamp(Math.round(c.loyalty), 1, 6) : undefined;
      if (loyalty !== undefined && loyalty !== c.loyalty) warnings.push(tx('SR2E.Text.Charimport.contactLoyaltyIsOutside16', { name: c.name, loyalty: c.loyalty, used: loyalty }));
      const row = { name: c.name, level, role: c.role, ...(c.notes ? { notes: c.notes } : {}), ...(loyalty !== undefined ? { loyalty } : {}) };
      const ex = contacts.find((x) => norm(String(x['name'] ?? '')) === norm(c.name));
      if (ex) Object.assign(ex, row);
      else contacts.push({ id: makeId(), notes: '', loyalty: 1, skills: '', fee: 0, dice: 0, favours: 0, ...row });
    }
  }

  // ---- Edges and flaws
  let qualities: Array<Record<string, unknown>> | undefined;
  if (p.qualities.length) {
    qualities = (current.qualities ?? []).map((q) => ({ ...q }));
    for (const q of p.qualities) {
      const points = clamp(Math.round(q.points), 0, 10);
      if (points !== q.points) warnings.push(tx('SR2E.Text.Charimport.pointsIsUnusualUsed', { name: q.name, points: q.points, used: points }));
      const row = { name: q.name, kind: q.kind, points, ...(q.notes ? { notes: q.notes } : {}) };
      const ex = qualities.find((x) => norm(String(x['name'] ?? '')) === norm(q.name) && x['kind'] === q.kind);
      if (ex) Object.assign(ex, row);
      else qualities.push({ id: makeId(), target: '', tn: 0, notes: '', ...row });
    }
  }

  // ---- Summary
  const count = (type: string) => items.filter((i) => i.type === type).length;
  if (p.skills.length) {
    const by = (kind: CharSkillKind) => p.skills.filter((s) => s.kind === kind).length;
    const parts = [by('active') ? tx('SR2E.Text.Charimport.nActive', { n: by('active') }) : '', by('knowledge') ? tx('SR2E.Text.Charimport.nKnowledge', { n: by('knowledge') }) : '', by('language') ? tx('SR2E.Text.Charimport.nLanguage', { n: by('language') }) : '', by('buildRepair') ? tx('SR2E.Text.Charimport.nBuildRepair', { n: by('buildRepair') }) : ''].filter(Boolean);
    summary.push(tCount(p.skills.length, 'SR2E.Text.Charimport.skillsParts', { parts: parts.join(', ') }));
  }
  const ware = p.cyberware.filter((c) => !c.bioware).length;
  const bioN = p.cyberware.length - ware;
  const itemParts = [
    count('weapon') ? tCount(count('weapon'), 'SR2E.Text.Charimport.weapons') : '', count('armor') ? tx('SR2E.Text.Charimport.nArmor', { n: count('armor') }) : '',
    count('gear') ? tx('SR2E.Text.Charimport.nGear', { n: count('gear') }) : '', count('focus') ? tCount(count('focus'), 'SR2E.Text.Charimport.foci') : '',
    ware ? tx('SR2E.Text.Charimport.nCyberware', { n: ware }) : '', bioN ? tx('SR2E.Text.Charimport.nBioware', { n: bioN }) : '',
    count('spell') ? tCount(count('spell'), 'SR2E.Text.Charimport.spells') : '', count('adeptpower') ? tCount(count('adeptpower'), 'SR2E.Text.Charimport.adeptPowers') : '',
    count('power') ? tCount(count('power'), 'SR2E.Text.Charimport.powers') : '',
  ].filter(Boolean);
  if (itemParts.length) summary.push(itemParts.join(', '));
  if (p.contacts.length) summary.push(tCount(p.contacts.length, 'SR2E.Text.Charimport.contacts'));
  if (p.qualities.length) {
    const e = p.qualities.filter((q) => q.kind === 'edge').length;
    const f = p.qualities.length - e;
    summary.push([e ? tCount(e, 'SR2E.Text.Charimport.edges') : '', f ? tCount(f, 'SR2E.Text.Charimport.flaws') : ''].filter(Boolean).join(', '));
  }
  const replaced = items.filter((i) => i.replace).length;
  if (replaced) summary.push(tCount(replaced, 'SR2E.Text.Charimport.itemsAlreadyOnTheActor'));
  if (!summary.length) warnings.push(tx('SR2E.Text.Charimport.nothingWasRecognisedInThe'));

  return { actorUpdate, items, ...(contacts ? { contacts } : {}), ...(qualities ? { qualities } : {}), after, summary, warnings };
}
