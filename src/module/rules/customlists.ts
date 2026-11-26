/**
 * v0.93.3: the GM's world lists (report item 36, "the missing middle level of house-rule support"):
 * - custom skills: a name, a linked attribute, a kind and an optional short note; they join every skill picker;
 * - hidden skills: book skill names left out of the pickers (never taken off an actor that has them);
 * - attribute labels: a display label and a short abbreviation per attribute key.
 *
 * Only names and labels change. The attribute KEYS (body, quickness, ...) and every rule that reads them stay as
 * they are, and no attribute can be added (the rules are wired to the fixed keys). Pure logic, no Foundry: the
 * settings glue (applications/customlists.ts) parses the GM's text with these helpers and keeps the module-level
 * store below current, so the pickers read it without touching game.settings (like setSkillWeb/getSkillWeb).
 */
import type { SkillKind } from './remnants.ts';
import { tKey } from '../helpers/i18n.ts';

/** v0.93.3: the attribute keys a custom skill may link to (the skill picker's list). */
export const SKILL_LINK_ATTRIBUTES = ['body', 'quickness', 'strength', 'charisma', 'intelligence', 'willpower', 'reaction'] as const;
export type SkillLinkAttribute = (typeof SKILL_LINK_ATTRIBUTES)[number];

/** v0.93.3: the attribute keys whose label and abbreviation the GM may rename (the keys themselves never change). */
export const LABELLED_ATTRIBUTES = ['body', 'quickness', 'strength', 'charisma', 'intelligence', 'willpower', 'reaction', 'magic', 'essence'] as const;
export type LabelledAttribute = (typeof LABELLED_ATTRIBUTES)[number];

export const SKILL_KINDS: readonly SkillKind[] = ['active', 'knowledge', 'language', 'buildRepair'];

/** v0.93.3: caps, so a pasted list can't make a picker or a setting unbounded. */
export const LIST_LIMITS = { skills: 200, hidden: 300, name: 60, note: 120, label: 30, abbr: 6 } as const;

export interface CustomSkill { name: string; attribute: SkillLinkAttribute; kind: SkillKind; note?: string }
export interface AttributeOverride { label?: string; abbr?: string }
export interface CustomLists {
  skills: CustomSkill[];
  hidden: string[];
  attributes: Partial<Record<LabelledAttribute, AttributeOverride>>;
}

export const EMPTY_LISTS: CustomLists = Object.freeze({ skills: [], hidden: [], attributes: {} }) as CustomLists;

/** v0.93.3: one problem found while reading the GM's lists (shown in the window; the line is skipped). */
export interface ListProblem { line: number; text: string; reason: 'name' | 'attribute' | 'kind' | 'duplicate' | 'book' | 'limit' }

const lower = (s: string) => s.toLowerCase();
/** v0.93.3: trimmed, inner whitespace collapsed, control characters dropped. */
export function cleanText(v: unknown): string {
  // eslint-disable-next-line no-control-regex
  return String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
}

function validName(name: string): boolean {
  return name.length > 0 && name.length <= LIST_LIMITS.name && !name.includes('|');
}

const KIND_ALIASES: Record<string, SkillKind> = {
  active: 'active', a: 'active',
  knowledge: 'knowledge', k: 'knowledge', know: 'knowledge',
  language: 'language', l: 'language', lang: 'language',
  buildrepair: 'buildRepair', 'build/repair': 'buildRepair', br: 'buildRepair', 'b/r': 'buildRepair', build: 'buildRepair',
};

/** v0.93.3: a kind as typed ("Knowledge", "B/R", "lang") or null. Blank is active. */
export function parseKind(v: unknown): SkillKind | null {
  const s = lower(cleanText(v)).replace(/\s+/g, '');
  if (!s) return 'active';
  return Object.hasOwn(KIND_ALIASES, s) ? KIND_ALIASES[s]! : null;
}

/** v0.93.3: an attribute key as typed ("Quickness", "qui", "REA") or null; matched by key or by its first three letters. */
export function parseAttributeKey(v: unknown): SkillLinkAttribute | null {
  const s = lower(cleanText(v));
  if (!s) return null;
  const hit = SKILL_LINK_ATTRIBUTES.find((k) => k === s || (s.length >= 3 && k.startsWith(s)));
  return hit ?? null;
}

/** v0.93.3: the attribute a kind's skill links to when the line names none (knowledge and language: Intelligence). */
function defaultAttribute(kind: SkillKind): SkillLinkAttribute {
  return kind === 'active' ? 'quickness' : 'intelligence';
}

/**
 * v0.93.3: one custom skill per line, `Name | attribute | kind | note` (only the name is needed; `#` starts a
 * comment line). Knowledge and language skills always link to Intelligence (as the picker makes them). A name the
 * book list has already (case-insensitive) or a repeated name is skipped with a problem; past LIST_LIMITS.skills too.
 */
export function parseCustomSkills(text: string, book: readonly string[] = []): { skills: CustomSkill[]; problems: ListProblem[] } {
  const skills: CustomSkill[] = [];
  const problems: ListProblem[] = [];
  const bookSet = new Set(book.map((n) => lower(cleanText(n))));
  const seen = new Set<string>();
  String(text ?? '').split(/\r?\n/).forEach((raw, i) => {
    const line = i + 1;
    const src = raw.trim();
    if (!src || src.startsWith('#')) return;
    const [n = '', a = '', k = '', ...rest] = src.split('|');
    const name = cleanText(n);
    const p = (reason: ListProblem['reason']) => problems.push({ line, text: src.slice(0, 80), reason });
    if (!validName(name)) return void p('name');
    const kind = parseKind(k);
    if (!kind) return void p('kind');
    let attribute: SkillLinkAttribute;
    if (kind === 'knowledge' || kind === 'language') attribute = 'intelligence';
    else if (cleanText(a)) {
      const got = parseAttributeKey(a);
      if (!got) return void p('attribute');
      attribute = got;
    } else attribute = defaultAttribute(kind);
    const key = lower(name);
    if (bookSet.has(key)) return void p('book');
    if (seen.has(key)) return void p('duplicate');
    if (skills.length >= LIST_LIMITS.skills) return void p('limit');
    seen.add(key);
    const note = cleanText(rest.join('|')).slice(0, LIST_LIMITS.note);
    skills.push({ name, attribute, kind, ...(note ? { note } : {}) });
  });
  return { skills, problems };
}

/** v0.93.3: the custom skills back as the window's text (one line each; round-trips through parseCustomSkills). */
export function formatCustomSkills(skills: readonly CustomSkill[]): string {
  return skills.map((s) => [s.name, s.attribute, s.kind, s.note ?? ''].join(' | ').replace(/\s*\|\s*$/, '')).join('\n');
}

/** v0.93.3: hidden skill names, one per line (deduplicated case-insensitively; `#` starts a comment line). */
export function parseHidden(text: string): { hidden: string[]; problems: ListProblem[] } {
  const hidden: string[] = [];
  const problems: ListProblem[] = [];
  const seen = new Set<string>();
  String(text ?? '').split(/\r?\n/).forEach((raw, i) => {
    const src = raw.trim();
    if (!src || src.startsWith('#')) return;
    const name = cleanText(src);
    const p = (reason: ListProblem['reason']) => problems.push({ line: i + 1, text: src.slice(0, 80), reason });
    if (!validName(name)) return void p('name');
    if (seen.has(lower(name))) return void p('duplicate');
    if (hidden.length >= LIST_LIMITS.hidden) return void p('limit');
    seen.add(lower(name));
    hidden.push(name);
  });
  return { hidden, problems };
}

/** v0.93.3: one attribute's label and abbreviation, cleaned and capped; blanks are dropped (the default stays). */
export function cleanOverride(o: unknown): AttributeOverride | null {
  const r: any = o && typeof o === 'object' ? o : {};
  const label = cleanText(r.label).slice(0, LIST_LIMITS.label);
  const abbr = cleanText(r.abbr).replace(/\s+/g, '').slice(0, LIST_LIMITS.abbr);
  if (!label && !abbr) return null;
  return { ...(label ? { label } : {}), ...(abbr ? { abbr } : {}) };
}

/**
 * v0.93.3: a stored setting value made safe (it may be old, hand-edited or from another world): every field
 * re-validated, unknown attribute keys dropped, the caps applied. `book` dedupes the custom skills again.
 */
export function normalizeLists(raw: unknown, book: readonly string[] = []): CustomLists {
  const r: any = raw && typeof raw === 'object' ? raw : {};
  const skillsIn: any[] = Array.isArray(r.skills) ? r.skills : [];
  const skills = parseCustomSkills(formatCustomSkills(skillsIn.filter((s) => s && typeof s === 'object').map((s) => ({
    name: cleanText(s.name).replace(/\|/g, ' '), attribute: s.attribute, kind: SKILL_KINDS.includes(s.kind) ? s.kind : ('?' as SkillKind), note: cleanText(s.note).replace(/\|/g, ' '),
  }))), book).skills;
  const hidden = parseHidden((Array.isArray(r.hidden) ? r.hidden : []).map((h: unknown) => cleanText(h)).join('\n')).hidden;
  const attributes: CustomLists['attributes'] = {};
  const at = r.attributes && typeof r.attributes === 'object' ? r.attributes : {};
  for (const k of LABELLED_ATTRIBUTES) {
    if (!Object.hasOwn(at, k)) continue;
    const o = cleanOverride(at[k]);
    if (o) attributes[k] = o;
  }
  return { skills, hidden, attributes };
}

/**
 * v0.93.3: the names a skill picker offers: the book's names less the hidden ones, plus the custom skills (of
 * `kind` when given), case-insensitively deduplicated (the book's spelling wins) and sorted.
 */
export function skillChoices(book: readonly string[], custom: readonly CustomSkill[], hidden: readonly string[], kind?: SkillKind): string[] {
  const hide = new Set(hidden.map((h) => lower(cleanText(h))));
  const out = new Map<string, string>();
  for (const n of book) { const k = lower(cleanText(n)); if (k && !hide.has(k) && !out.has(k)) out.set(k, n); }
  for (const s of custom) { if (kind && s.kind !== kind) continue; const k = lower(s.name); if (!hide.has(k) && !out.has(k)) out.set(k, s.name); }
  return [...out.values()].sort((a, b) => a.localeCompare(b));
}

/** v0.93.3: whether a name is hidden from the pickers. */
export function isHiddenSkill(name: string, hidden: readonly string[]): boolean {
  const k = lower(cleanText(name));
  return hidden.some((h) => lower(cleanText(h)) === k);
}

/** v0.93.3: the custom skill of that name (case-insensitive), or null. */
export function findCustomSkill(name: string, custom: readonly CustomSkill[]): CustomSkill | null {
  const k = lower(cleanText(name));
  return custom.find((s) => lower(s.name) === k) ?? null;
}

/** v0.93.3: an attribute's display label: the GM's override, else `fallback` (the translated default). */
export function attributeLabel(key: string, overrides: CustomLists['attributes'], fallback: string): string {
  return (overrides as any)?.[key]?.label || fallback;
}

/** v0.93.3: an attribute's abbreviation: the GM's override, else the key's first letter in capitals (the sheet's default). */
export function attributeAbbr(key: string, overrides: CustomLists['attributes']): string {
  return (overrides as any)?.[key]?.abbr || String(key ?? '').charAt(0).toUpperCase();
}

// ---------------------------------------------------------------------------------------------------------------
// v0.93.3: the module-level store (set by the world setting's onChange and at ready; read by the pickers).
let LISTS: CustomLists = EMPTY_LISTS;

export function setCustomLists(lists: CustomLists): void {
  LISTS = { skills: [...lists.skills], hidden: [...lists.hidden], attributes: { ...lists.attributes } };
}
export function getCustomLists(): CustomLists { return LISTS; }

/** v0.93.3: skillChoices with the store's custom and hidden lists. */
export function worldSkillChoices(book: readonly string[], kind?: SkillKind): string[] {
  return skillChoices(book, LISTS.skills, LISTS.hidden, kind);
}

/** v0.93.3: the linked attribute of a custom skill of that name in the store, or null (then the usual guess applies). */
export function customSkillAttribute(name: string): SkillLinkAttribute | null {
  return findCustomSkill(name, LISTS.skills)?.attribute ?? null;
}

/** v0.93.3: attributeLabel / attributeAbbr with the store's overrides. */
export function attrLabel(key: string, fallback: string): string { return attributeLabel(key, LISTS.attributes, fallback); }
export function attrAbbr(key: string): string { return attributeAbbr(key, LISTS.attributes); }

/** v0.93.3: the translated default label of an attribute key (the six from SR2E.Attribute.*, then the derived three). */
const DEFAULT_LABEL_KEYS: Record<string, string> = { reaction: 'SR2E.UI.reaction', magic: 'SR2E.UI.magic2', essence: 'SR2E.UI.essence' };
export function defaultAttributeLabel(key: string): string {
  const k = String(key ?? '');
  if (Object.hasOwn(DEFAULT_LABEL_KEYS, k)) return tKey(DEFAULT_LABEL_KEYS[k]!);
  if ((LABELLED_ATTRIBUTES as readonly string[]).includes(k)) return tKey(`SR2E.Attribute.${k}`);
  return k.charAt(0).toUpperCase() + k.slice(1);
}

/** v0.93.3: the label every display site should show for an attribute key: the GM's override, else the translated default. */
export function attributeDisplayLabel(key: string): string { return attrLabel(key, defaultAttributeLabel(key)); }

/**
 * v0.93.3: the creation wizard's "common skills not taken yet": the starters less the hidden ones and those the
 * character has (at most `maxStarters`), then every custom skill the character doesn't have (case-insensitive).
 */
export function starterChoices<T extends { name: string; attribute: string; kind: string }>(starters: readonly T[], existing: readonly string[], lists: CustomLists = LISTS, maxStarters = Infinity): Array<{ name: string; attribute: string; kind: string }> {
  const have = new Set(existing.map((n) => lower(cleanText(n))));
  const out: Array<{ name: string; attribute: string; kind: string }> = starters.filter((s) => !isHiddenSkill(s.name, lists.hidden) && !have.has(lower(cleanText(s.name)))).slice(0, maxStarters).map((s) => ({ name: s.name, attribute: s.attribute, kind: s.kind }));
  const seen = new Set(out.map((s) => lower(s.name)));
  for (const c of lists.skills) {
    const k = lower(c.name);
    if (have.has(k) || seen.has(k) || isHiddenSkill(c.name, lists.hidden)) continue;
    seen.add(k);
    out.push({ name: c.name, attribute: c.attribute, kind: c.kind });
  }
  return out;
}
