import { t as tx, tKey } from '../helpers/i18n.ts';
import { startsLikeLabel } from './charimport.ts';

/**
 * v0.94.0: futurekill's SR2 system (futurekill/sr2e-foundryvtt) → SR2e's character write-up text.
 *
 * futurekill's "Export Data" file is a Foundry Actor export: `{ name, type, system, items, _stats }`. This module
 * turns one into the write-up that charimport.ts (`parseCharacterSheet` → `characterImportPlan`) reads, so a player
 * brings a character over through the existing import, its preview and its re-import by name. Pure: no Foundry
 * globals. Never throws: what it cannot read is skipped with a warning.
 *
 * What an export holds is the actor's SOURCE data, not its prepared data: futurekill derives `racial`, `value`,
 * Reaction, Essence, initiative and the pools at prepare time, so in the file those are defaults or stale. Read here:
 * - Attributes: natural = `base` + the race's modifier (the metavariant's own modifiers when it has one; futurekill's
 *   table otherwise) + Bonus Attribute Point edges. Augmented = natural + the stored `mod` + the `attributeMods` of
 *   installed cyberware, bioware (× rating) and a physical adept's powers (× level), as futurekill adds them. Written
 *   "Body 5 (7)" when they differ: charimport takes 5 as the natural rating and makes the modifier 7 − 5 less what
 *   SR2e's own items for the imported ware add, so the total stays what futurekill showed.
 * - Not written (SR2e works them out from the attributes and the imported items): Essence, Reaction, initiative,
 *   pools, condition monitors, Body Index.
 * - Items: skills, weapons, armor, gear and ammo, foci, cyberware, bioware, spells, adept powers, contacts, edges and
 *   flaws, the lifestyle. Programs, vehicle mods and other types are counted in one warning. Item notes (mostly
 *   catalogue text) are not carried; the actor's biography and notes are, as plain text.
 * An SR2e export (this system: `shadowrun2e_unified`, or an old SR2e world's `sr2e` with SR2e's own data shape) is
 * told apart and answered with a warning to use Foundry's own Import Data.
 */

export interface ConvertResult {
  text: string;
  name: string;
  warnings: string[];
  edition?: string;
  source: 'nullsheen' | 'futurekill';
  key: string;
}

type Rec = Record<string, unknown>;
type AttrKey = 'body' | 'quickness' | 'strength' | 'charisma' | 'intelligence' | 'willpower';
const ATTRS: readonly AttrKey[] = ['body', 'quickness', 'strength', 'charisma', 'intelligence', 'willpower'];
const ATTR_LABEL: Record<AttrKey, string> = { body: 'Body', quickness: 'Quickness', strength: 'Strength', charisma: 'Charisma', intelligence: 'Intelligence', willpower: 'Willpower' };

/** futurekill's racial modifiers (its config: SR2 core p. 45), for the five metatypes. */
const RACE_MODS: Record<string, Partial<Record<AttrKey, number>>> = {
  human: {},
  dwarf: { body: 1, quickness: -1, strength: 2, willpower: 1 },
  elf: { quickness: 1, charisma: 2 },
  ork: { body: 3, strength: 2, charisma: -1, intelligence: -1 },
  troll: { body: 5, quickness: -1, strength: 4, charisma: -2, intelligence: -2, willpower: -1 },
};
const RACE_LABEL: Record<string, string> = { human: 'Human', dwarf: 'Dwarf', elf: 'Elf', ork: 'Ork', troll: 'Troll' };
/** futurekill's cyberware grades (Essence multiplier). */
const GRADE_ESSENCE: Record<string, number> = { standard: 1, alpha: 0.8, beta: 0.6, delta: 0.5 };

/** Item types that futurekill keeps but the write-up has no place for (or that only fed the sheet). */
const SILENT_TYPES = new Set(['race', 'tradition']);
/** v0.94.0: the most entries per list and characters per name or text, so a huge file cannot stall the import. */
export const FK_MAX_ENTRIES = 500;
const MAX_NAME = 200;
const MAX_TEXT = 30_000;
const MAX_LINE = 2_000;

// ===================================================================== Reading helpers

const isRec = (v: unknown): v is Rec => !!v && typeof v === 'object' && !Array.isArray(v);
const rec = (v: unknown): Rec => (isRec(v) ? v : {});
const str = (v: unknown): string => (typeof v === 'string' ? v : typeof v === 'number' && Number.isFinite(v) ? String(v) : '');
/** A number from a number or a string ("12", "0.5", "2/36hrs" → 2); NaN when there is none. */
function num(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : NaN;
  if (typeof v === 'string') {
    const m = /^\s*([+-]?\d+(?:[.,]\d+)?)/.exec(v);
    return m ? Number((m[1] as string).replace(',', '.')) : NaN;
  }
  return NaN;
}
const int = (v: unknown, dflt = 0): number => {
  const n = num(v);
  return Number.isFinite(n) ? Math.round(n) : dflt;
};
const bool = (v: unknown): boolean => v === true || v === 'true' || v === 1;
const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * A name made safe for one write-up entry: no commas or semicolons (they split lists), no brackets (they hold the
 * entry's values), no colon or equals sign (they start a label), no line breaks; a capital first letter (a line in
 * lower case continues the entry before it) and no leading bullet.
 */
function cleanName(v: unknown, keepParens = false): string {
  let s = str(v).replace(/[\r\n\t]+/g, ' ').replace(/[,;]/g, ' ').replace(/[:=]/g, ' ').replace(/[{}]/g, ' ');
  if (keepParens) {
    // Keep one balanced "(option)" group (adept powers read it); drop the rest.
    const m = /^([^()[\]]*)\(([^()[\]]*)\)\s*$/.exec(s);
    s = m ? `${(m[1] as string).trim()} (${(m[2] as string).trim()})` : s.replace(/[()[\]]/g, ' ');
  } else s = s.replace(/[()[\]]/g, ' ');
  s = s.replace(/[|]/g, '/').replace(/\s+/g, ' ').replace(/^[-*•·–\s]+/, '').trim();
  // " - " and " / " separate a contact's name from its role; keep them out of every name.
  s = s.replace(/\s+[—–-]{1,2}\s+/g, ' ').replace(/\s+\/\s+/g, '/');
  if (s.length > MAX_NAME) s = s.slice(0, MAX_NAME).trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** HTML (futurekill's biography and notes) → plain text with paragraphs. */
function htmlToText(v: unknown): string {
  let s = str(v);
  if (!s) return '';
  if (s.length > MAX_TEXT * 2) s = s.slice(0, MAX_TEXT * 2);
  s = s.replace(/<\s*br\s*\/?>/gi, '\n').replace(/<\/\s*(p|div|h[1-6]|li|tr|blockquote)\s*>/gi, '\n\n').replace(/<\s*li[^<>]*>/gi, '- ');
  // v0.94.0 review: [^<>] keeps these linear on a crafted text full of "<".
  s = s.replace(/<[^<>]*>/g, '').replace(/[<>]/g, ' ');
  s = s.replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0*39;|&apos;/g, "'")
    .replace(/&#(\d{1,6});/g, (_m, d: string) => { const c = Number(d); return c > 31 && c < 0x110000 ? String.fromCodePoint(c) : ' '; })
    .replace(/&amp;/g, '&');
  return s.replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, MAX_TEXT);
}

/**
 * Free text made safe for a Background/Notes section: a line that would read as a label ("Contacts: …") or a stray
 * divider keeps its words but loses the colon; long lines are cut into shorter ones at spaces.
 */
function safeTextLines(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.split('\n')) {
    let line = raw.replace(/\s+/g, ' ').trim();
    if (!line) {
      if (out.length && out[out.length - 1] !== '') out.push('');
      continue;
    }
    const pieces: string[] = [];
    while (line.length > MAX_LINE) {
      const cut = line.lastIndexOf(' ', MAX_LINE);
      const at = cut > MAX_LINE / 2 ? cut : MAX_LINE;
      pieces.push(line.slice(0, at).trim());
      line = line.slice(at).trim();
    }
    pieces.push(line);
    for (let p of pieces) {
      p = p.replace(/^([-*•]?\s*[A-Za-z][A-Za-z /&\x27.-]{0,40}?)\s*[:=]/, '$1 -').replace(/[:=](?=\S)/g, ' ').replace(/\s{2,}/g, ' ');
      if (/^[-=_*#~]{3,}$/.test(p)) continue;
      out.push(p);
    }
  }
  while (out.length && out[out.length - 1] === '') out.pop();
  return out;
}

/** "((F / 2) + 3)D", "(F / 2)S", "+3(D)" → "Drain +3 D" for the statblock; '' for a wound-level or unreadable code. */
function drainOf(code: unknown): string {
  const s = str(code).replace(/[–—−]/g, '-');
  const withMod = /\(\s*F\s*\/\s*2\s*\)\s*([+-])\s*(\d+)\s*\)\s*([LMSD])/i.exec(s) ?? /^\s*([+-])(\d+)\s*\(\s*([LMSD])\s*\)/i.exec(s);
  if (withMod) return ['Drain', `${withMod[1]}${withMod[2]}`, (withMod[3] as string).toUpperCase()].join(' ');
  const plain = /\(\s*F\s*\/\s*2\s*\)\s*([LMSD])\b/i.exec(s);
  return plain ? ['Drain', (plain[1] as string).toUpperCase()].join(' ') : '';
}

/** futurekill's damage code ("6M", "10S2", "(Str+2)M") → the write-up's ("6M", "(STR+2)M"); null if none. */
function damageOf(code: unknown): string | null {
  const s = str(code).replace(/\s+/g, '').replace(/[–—−]/g, '-');
  const n = /^(\d+)([LMSD])\d*$/i.exec(s);
  if (n) return `${n[1]}${(n[2] as string).toUpperCase()}`;
  const st = /^\(?str(?:ength)?([+-]\d+)?\)?([LMSD])\d*$/i.exec(s);
  if (st) return `(STR${st[1] ?? ''})${(st[2] as string).toUpperCase()}`;
  return null;
}

// ===================================================================== Detection

const FK_ONLY_ITEM_TYPES = new Set(['adept_power', 'race', 'tradition', 'quality', 'vehicle_mod', 'lifestyle', 'contact']);

/** An SR2e export (this system's own shape): `system.attributes.body`, or `system.metatype` without `system.race`. */
export function looksLikeSr2eExport(data: unknown): boolean {
  if (!isRec(data)) return false;
  const stats = rec(data._stats);
  const sys = rec(data.system);
  if (stats.systemId === 'shadowrun2e_unified') return true;
  const attrs = rec(sys.attributes);
  if (ATTRS.some((k) => isRec(attrs[k]) && 'base' in (attrs[k] as Rec))) return true;
  if (typeof sys.metatype === 'string' && !('race' in sys) && !isRec(sys.body)) return true;
  const items = Array.isArray(data.items) ? (data.items as unknown[]) : [];
  return items.some((i) => isRec(i) && (i.type === 'adeptpower' || i.type === 'cyberdeck')) && !isRec(sys.body);
}

/**
 * A Foundry actor export from futurekill's system (or from SR2e itself, which futurekillToWriteUp answers with a
 * warning): `_stats.systemId` 'sr2e' / 'shadowrun2e_unified', or futurekill's own shape (`system.body.base`,
 * `system.conditionMonitor`, `system.dicePools`, futurekill-only item types). Cheap; never throws.
 */
export function looksLikeFuturekill(data: unknown): boolean {
  try {
    if (!isRec(data) || !isRec(data.system)) return false;
    const id = rec(data._stats).systemId;
    if (id === 'sr2e' || id === 'shadowrun2e_unified') return true;
    if (looksLikeSr2eExport(data)) return true;
    const sys = data.system as Rec;
    if (isRec(sys.body) && 'base' in (sys.body as Rec) && (isRec(sys.conditionMonitor) || isRec(sys.dicePools) || typeof sys.race === 'string')) return true;
    const items = Array.isArray(data.items) ? (data.items as unknown[]) : [];
    return items.slice(0, FK_MAX_ENTRIES).some((i) => isRec(i) && FK_ONLY_ITEM_TYPES.has(String(i.type)));
  } catch {
    return false;
  }
}

// ===================================================================== Conversion

/** The re-import key: the exported actor's id (from `_stats.exportSource.uuid`, else `_id`), else its name. */
function keyOf(data: Rec, name: string): string {
  const uuid = str(rec(rec(data._stats).exportSource).uuid);
  const fromUuid = /Actor\.([A-Za-z0-9]{8,32})$/.exec(uuid)?.[1];
  const id = fromUuid ?? (/^[A-Za-z0-9]{8,32}$/.test(str(data._id)) ? str(data._id) : '');
  return `futurekill:${id || name.toLowerCase().replace(/\s+/g, ' ').trim()}`;
}

/** "Name [a, b]" (or just the name). */
const withOpts = (name: string, opts: string[]): string => (opts.length ? `${name} [${opts.join(', ')}]` : name);
/** "3x " for a quantity over 1. */
const qtyOf = (n: number): string => (n > 1 ? `${n}x ` : '');

interface Item { name: string; raw: string; type: string; system: Rec }

/**
 * Convert a futurekill actor export into SR2e's character write-up. Never throws; a file that is not a futurekill
 * character gives empty text and a warning.
 */
export function futurekillToWriteUp(data: unknown): ConvertResult {
  const warnings: string[] = [];
  const W = (key: string, vars: Rec = {}) => warnings.push(tKey(`SR2E.Import.Futurekill.${key}`, vars));
  const empty = (name: string, key: string): ConvertResult => ({ text: '', name, warnings, source: 'futurekill', key });
  try {
    if (!isRec(data) || !isRec(data.system)) {
      W('notAnActor');
      return empty('', '');
    }
    const name = cleanName(data.name) || '';
    const key = keyOf(data, name);
    if (looksLikeSr2eExport(data)) {
      W('sr2eExport', { name });
      return empty(name, key);
    }
    const type = str(data.type) || 'character';
    if (type !== 'character' && type !== 'npc') {
      W('notACharacter', { name, type });
      return empty(name, key);
    }
    return { ...convert(data, data.system as Rec, name, type === 'npc', W), name, warnings, edition: 'SR2', source: 'futurekill', key };
  } catch {
    W('unreadable');
    return empty(isRec(data) ? cleanName(data.name) : '', '');
  }
}

function convert(data: Rec, sys: Rec, name: string, npc: boolean, W: (key: string, vars?: Rec) => void): { text: string } {
  const out: string[] = [];
  const notes: string[] = [];
  // v0.94.0 review: an entry that reads as an attribute or colonless label line ("Nuyen 9999", "Body 5") would be read as
  // one at the start of a line: it goes after another entry on the same line (or on the label's line).
  const section = (label: string, entries: string[]) => {
    if (!entries.length) return;
    const isRisky = (e: string) => startsLikeLabel(e) || /^\s*(?:body|quickness|strength|charisma|intelligence|willpower|essence|magic|reaction|initiative)\b\s*[:=]?\s*\d/i.test(e);
    const safe = entries.filter((e) => !isRisky(e));
    const risky = entries.filter(isRisky);
    if (!safe.length) { out.push(`${label}: ${risky.join(', ')}`, ''); return; }
    const lines = [...safe];
    lines[0] = [lines[0], ...risky].join(', ');
    out.push(`${label}:`, ...lines, '');
  };

  // ---- Items, by type (capped).
  const rawItems = Array.isArray(data.items) ? (data.items as unknown[]) : [];
  if (rawItems.length > FK_MAX_ENTRIES) W('tooManyItems', { max: FK_MAX_ENTRIES, count: rawItems.length });
  const items: Item[] = [];
  let unnamed = 0;
  for (const raw of rawItems.slice(0, FK_MAX_ENTRIES)) {
    const it = rec(raw);
    const nm = cleanName(it.name);
    const ty = str(it.type);
    if (!nm || !ty) { unnamed++; continue; }
    items.push({ name: nm, raw: str(it.name), type: ty, system: rec(it.system) });
  }
  if (unnamed) W('unnamedItems', { count: unnamed });
  const ofType = (...types: string[]) => items.filter((i) => types.includes(i.type));
  const skipped = new Map<string, number>();
  const skip = (ty: string) => skipped.set(ty, (skipped.get(ty) ?? 0) + 1);

  // ---- Name and metatype
  out.push(['Name:', name || tx('SR2E.Import.Futurekill.unnamed')].join(' '));
  const realName = cleanName(sys.realName);
  if (realName && realName !== name) notes.push(tx('SR2E.Import.Futurekill.realName', { name: realName }));
  const race = str(sys.race).toLowerCase().trim() || 'human';
  const mv = rec(sys.metavariant);
  const variant = str(mv.name) && str(mv.base).toLowerCase() === race ? cleanName(mv.name) : '';
  let raceMods: Partial<Record<AttrKey, number>> = {};
  if ((Object.hasOwn(RACE_LABEL, race) ? RACE_LABEL[race] : undefined)) {
    out.push(['Metatype:', (Object.hasOwn(RACE_LABEL, race) ? RACE_LABEL[race] : undefined)].join(' '));
    raceMods = (Object.hasOwn(RACE_MODS, race) ? RACE_MODS[race] : undefined) ?? {};
    if (variant) {
      const vm = rec(mv.attributeMods);
      raceMods = Object.fromEntries(ATTRS.map((k) => [k, int(vm[k])]));
      notes.push(tx('SR2E.Import.Futurekill.metavariantNote', { name: variant }));
      W('metavariant', { name, variant, race: (Object.hasOwn(RACE_LABEL, race) ? RACE_LABEL[race] : undefined) });
    }
  } else if (!npc) {
    W(race === 'shapeshifter' ? 'shapeshifter' : 'unknownRace', { name, race: cleanName(race) });
    // An unknown race: whatever racial modifier the file kept.
    raceMods = Object.fromEntries(ATTRS.map((k) => [k, int(rec(sys[k]).racial)]));
  }
  if (npc) W('npc', { name });

  // ---- Attributes: natural (base + racial + edge points) and augmented (natural + mod + ware).
  const edgeAttr: Partial<Record<AttrKey, number>> = {};
  for (const q of ofType('quality')) {
    const a = str(q.system.attribute) as AttrKey;
    if (ATTRS.includes(a) && str(q.system.kind) !== 'flaw') edgeAttr[a] = (edgeAttr[a] ?? 0) + Math.max(0, int(q.system.attributeBonus));
  }
  const ware: Partial<Record<AttrKey, number>> = {};
  const addWare = (mods: unknown, times: number) => {
    const m = rec(mods);
    for (const k of ATTRS) {
      const v = int(m[k]);
      if (v) ware[k] = (ware[k] ?? 0) + v * times;
    }
  };
  const installed = (i: Item) => i.system.installed === undefined || bool(i.system.installed);
  const magicSys = rec(sys.magic);
  const magicType = str(magicSys.type) || 'none';
  if (!npc) {
    for (const c of ofType('cyberware')) if (installed(c) && !bool(c.system.secondhandFailed)) addWare(c.system.attributeMods, 1);
    for (const b of ofType('bioware')) if (installed(b) && !bool(b.system.destroyed)) addWare(b.system.attributeMods, Math.max(1, int(b.system.rating, 1)));
    if (magicType === 'physical_adept') for (const p of ofType('adept_power')) addWare(p.system.attributeMods, Math.max(1, int(p.system.level, 1)));
  }
  const attrLines: string[] = [];
  for (const k of ATTRS) {
    const a = rec(sys[k]);
    const base = int(a.base, NaN);
    if (!Number.isFinite(base)) continue;
    const natural = npc ? base : base + (raceMods[k] ?? 0) + (edgeAttr[k] ?? 0);
    const aug = natural + int(a.mod) + (ware[k] ?? 0);
    attrLines.push(aug !== natural ? `${(Object.hasOwn(ATTR_LABEL, k) ? ATTR_LABEL[k] : undefined)} ${natural} (${aug})` : `${(Object.hasOwn(ATTR_LABEL, k) ? ATTR_LABEL[k] : undefined)} ${natural}`);
  }
  if (attrLines.length) out.push('', ...attrLines);

  // ---- Magic
  const tradition = str(magicSys.tradition);
  const magicSkill = str(magicSys.skill);
  const tradWord = magicType === 'physical_adept' ? 'Adept'
    : magicType === 'shamanic_adept' ? 'Shamanist'
      : magicType === 'magical_adept' ? (magicSkill === 'sorcery' ? 'Sorcerer' : magicSkill === 'conjuring' ? 'Conjurer' : (tradition === 'shamanic' ? 'Shamanic' : 'Hermetic'))
        : magicType === 'full_magician' || (npc && tradition && tradition !== 'none') ? (tradition === 'shamanic' ? 'Shamanic' : tradition === 'hermetic' ? 'Hermetic' : '')
          : '';
  // v0.94.0 review: futurekill keeps magic.value unclamped in its data (it lowers Magic for lost Essence only when the
  // sheet loads), and the write-up's Magic is the one shown after the loss: so no more than the whole Essence left.
  let essLoss = 0;
  for (const c of ofType('cyberware')) {
    if (!installed(c)) continue;
    const g = str(c.system.grade).toLowerCase();
    const mult = (Object.hasOwn(GRADE_ESSENCE, g) ? GRADE_ESSENCE[g] : undefined) ?? 1;
    const e = Math.max(0, num(c.system.essenceCost));
    if (Number.isFinite(e)) essLoss += mult === 1 ? e : e * mult;
  }
  const magic = Math.min(int(magicSys.value, 0), Math.max(0, Math.floor(6 - essLoss + 1e-9)));
  const magicLines: string[] = [];
  if (magicType !== 'none' || magic > 0) magicLines.push(['Magic', String(Math.max(0, magic))].join(' '));
  if (tradWord) magicLines.push(['Tradition:', tradWord].join(' '));
  if (magicType === 'magical_adept' && !['sorcery', 'conjuring'].includes(magicSkill)) notes.push(tx('SR2E.Import.Futurekill.magicTypeNote', { type: magicType }));
  const totem = cleanName(magicSys.totem);
  if (totem) magicLines.push(['Totem:', totem].join(' '));
  const grade = int(magicSys.initiateGrade, 0);
  if (grade > 0) magicLines.push(['Grade:', String(grade)].join(' '));
  if (magicLines.length) out.push(...magicLines);
  out.push('');

  // ---- Skills
  const skillLists: Record<string, string[]> = { Skills: [], Knowledge: [], Language: [], 'B/R': [] };
  for (const s of ofType('skill')) {
    const cat = str(s.system.category);
    const label = cat === 'knowledge' ? 'Knowledge' : cat === 'language' ? 'Language' : cat === 'build_repair' ? 'B/R' : 'Skills';
    let rating = Math.max(0, int(s.system.rating, 0));
    const spec = rec(s.system.specialization);
    const conc = rec(s.system.concentration);
    const specName = cleanName(spec.name);
    const concName = cleanName(conc.name);
    const pick = specName ? { n: specName, r: int(spec.rating) } : concName ? { n: concName, r: int(conc.rating) } : null;
    // v0.94.0 review: a character still in futurekill's creation keeps its points in `allocated` until the ratings are
    // finalized; work them out its way (specialization: skill -2 and +2; concentration: -1 and +1).
    const allocated = int(s.system.allocated, 0);
    if (s.system.ratingsFinalized === false && allocated > 0) {
      rating = specName ? Math.max(0, allocated - 2) : concName ? Math.max(0, allocated - 1) : allocated;
      if (pick) pick.r = specName ? allocated + 2 : allocated + 1;
    }
    if (specName && concName) W('concentrationDropped', { name: s.name, concentration: concName, specialization: specName });
    let entry = `${s.name} ${rating}`;
    if (pick) entry += pick.r > 0 ? ` (${pick.n} ${pick.r})` : ` (${pick.n})`;
    if (label === 'Language' && str(s.system.freeLanguage) === 'native') entry += pick ? ' native' : ' (native)';
    (skillLists[label] as string[]).push(entry);
  }
  for (const [label, list] of Object.entries(skillLists)) section(label, list);

  // ---- Cyberware and bioware
  const notInstalled: string[] = [];
  const cyber: string[] = [];
  for (const c of ofType('cyberware')) {
    if (!installed(c)) { notInstalled.push(c.name); continue; }
    const g = str(c.system.grade).toLowerCase();
    const mult = (Object.hasOwn(GRADE_ESSENCE, g) ? GRADE_ESSENCE[g] : undefined) ?? 1;
    const baseEss = Math.max(0, num(c.system.essenceCost));
    const ess = Number.isFinite(baseEss) ? (mult === 1 || baseEss === 0 ? baseEss : Math.max(0.05, Math.ceil(baseEss * mult * 100 - 1e-9) / 100)) : NaN;
    const rating = int(c.system.rating, 0);
    const rated = (Array.isArray(c.system.ratingStats) && (c.system.ratingStats as unknown[]).length > 0) || rating > 1;
    const opts: string[] = [];
    if (rated && rating > 0) opts.push(['Rating', String(rating)].join(' '));
    if (Number.isFinite(ess)) opts.push(['Essence', String(round2(ess))].join(' '));
    const gradeWord = g === 'alpha' || g === 'beta' || g === 'delta' ? `${g.charAt(0).toUpperCase()}${g.slice(1)} ` : '';
    cyber.push(gradeWord + withOpts(c.name, opts));
  }
  section('Cyberware', cyber);
  const bio: string[] = [];
  for (const b of ofType('bioware')) {
    if (!installed(b)) { notInstalled.push(b.name); continue; }
    const rating = int(b.system.rating, 0);
    const rated = (Array.isArray(b.system.ratingStats) && (b.system.ratingStats as unknown[]).length > 0) || rating > 1;
    const bi = num(b.system.bodyCost);
    const opts: string[] = [];
    if (rated && rating > 0) opts.push(['Rating', String(rating)].join(' '));
    if (Number.isFinite(bi) && bi >= 0) opts.push(['BI', String(round2(bi))].join(' '));
    if (str(b.system.grade) === 'cultured') opts.push('cultured');
    bio.push(withOpts(b.name, opts));
  }
  section('Bioware', bio);
  if (notInstalled.length) W('notInstalled', { list: notInstalled.join(', ') });

  // ---- Spells and adept powers
  const spells: string[] = [];
  for (const s of ofType('spell')) {
    const force = Math.max(1, int(s.system.force, 1));
    const opts: string[] = [];
    const drain = drainOf(s.system.drainCode);
    if (drain) opts.push(drain);
    const restriction = str(s.system.restriction);
    if (restriction === 'exclusive') opts.push('Exclusive');
    if (restriction.startsWith('fetish') || str(rec(s.system.fetish).label)) opts.push('Fetish');
    spells.push(withOpts(`${s.name} ${force}`, opts));
  }
  section('Spells', spells);
  const powers: string[] = [];
  for (const p of ofType('adept_power')) {
    const improved = cleanName(p.system.improvedSkill);
    let nm = improved && !/\(/.test(p.raw) ? `${p.name} (${improved})` : cleanName(p.raw, true) || p.name;
    nm = nm.replace(/\s+\d+$/, '');
    const level = Math.max(1, int(p.system.level, 1));
    const leveled = level > 1 || int(p.system.maxLevel, 1) > 1;
    powers.push(leveled ? `${nm} ${level}` : nm);
  }
  section('Powers', powers);

  // ---- Weapons, armor, foci, gear
  const weapons: string[] = [];
  const gear: string[] = [];
  for (const w of ofType('weapon')) {
    const dmg = damageOf(w.system.damageCode);
    const qty = Math.max(1, int(w.system.quantity, 1));
    const pre = qtyOf(qty);
    if (!dmg) {
      W('weaponNoDamage', { name: w.name, code: cleanName(w.system.damageCode) || '-' });
      gear.push(`${pre}${w.name}`);
      continue;
    }
    const parts = [dmg];
    const fm = rec(w.system.firingModes);
    const modes = (['ss', 'sa', 'bf', 'fa'] as const).filter((m) => bool(fm[m])).map((m) => m.toUpperCase());
    if (modes.length) parts.push(modes.join('/'));
    const ammo = int(rec(w.system.ammo).max, 0);
    if (ammo > 0) parts.push(`${ammo} (c)`);
    const reach = int(w.system.reach, 0);
    if (reach > 0) parts.push(['Reach', String(reach)].join(' '));
    if (str(w.system.damageType) === 'stun') parts.push('Stun');
    if (bool(w.system.smartgunCompatible)) parts.push('smart');
    weapons.push(`${pre}${w.name} [${parts.join(', ')}]`);
  }
  const armor: string[] = [];
  for (const a of ofType('armor')) armor.push(`${a.name} ${Math.max(0, int(a.system.ballistic))}/${Math.max(0, int(a.system.impact))}`);
  const foci: string[] = [];
  for (const f of ofType('focus')) {
    const ft = str(f.system.focusType);
    const type = ft === 'spell_lock' ? 'sustaining' : ['spell', 'spirit', 'power', 'weapon'].includes(ft) ? ft : 'spell';
    const named = new RegExp(`\\b${type}\\b`, 'i').test(f.name) && /\bfoc(?:us|i)\b/i.test(f.name);
    foci.push(`${named ? f.name : [f.name, type, 'focus'].join(' ')} ${Math.max(1, int(f.system.force, 1))}`);
  }
  for (const g of ofType('gear')) {
    const qty = Math.max(1, int(g.system.quantity, 1));
    const rating = Math.max(0, int(g.system.rating, 0));
    gear.push(qtyOf(qty) + g.name + (rating > 0 ? ` (${['Rating', String(rating)].join(' ')})` : ''));
  }
  for (const a of ofType('ammo')) {
    const qty = Math.max(1, int(a.system.quantity, 1));
    gear.push(qtyOf(qty) + a.name);
  }
  section('Weapons', weapons);
  section('Armor', armor);
  section('Foci', foci);
  section('Gear', gear);

  // ---- Contacts, edges and flaws
  const contacts: string[] = [];
  for (const c of ofType('contact')) {
    const ct = str(c.system.contactType);
    if (ct === 'enemy') {
      notes.push(tx('SR2E.Import.Futurekill.enemyNote', { name: c.name }));
      W('enemy', { name: c.name });
      continue;
    }
    const level = ct === 'friend' ? 3 : ct === 'buddy' ? 2 : 1;
    const loyalty = int(c.system.loyalty, 0);
    const role = cleanName(c.system.archetype) || (Array.isArray(c.system.archetypes) ? (c.system.archetypes as unknown[]).map((x) => cleanName(x)).filter(Boolean).join('/') : '');
    const parts: string[] = [];
    if (role) parts.push(role);
    parts.push(['level', String(level)].join(' '));
    if (loyalty > 0) parts.push(['loyalty', String(Math.min(6, loyalty))].join(' '));
    if (ct === 'follower' || ct === 'gang') parts.push(ct);
    contacts.push(`${c.name} (${parts.join(', ')})`);
  }
  section('Contacts', contacts);
  const edges: string[] = [];
  const flaws: string[] = [];
  for (const q of ofType('quality')) {
    const pts = int(q.system.pointValue, 0);
    const flaw = str(q.system.kind) === 'flaw' || (str(q.system.kind) !== 'edge' && pts < 0);
    (flaw ? flaws : edges).push(`${q.name} ${flaw ? '-' : '+'}${Math.abs(pts)}`);
  }
  section('Edges', edges);
  section('Flaws', flaws);

  // ---- Money, Karma, lifestyle
  const nuyen = num(sys.nuyen);
  if (Number.isFinite(nuyen) && nuyen >= 0) out.push(['Nuyen:', String(Math.round(nuyen))].join(' '));
  const karma = rec(sys.karma);
  const good = int(karma.current, NaN);
  const total = int(karma.total, NaN);
  if (Number.isFinite(good) || Number.isFinite(total)) {
    const k = ['Karma:', String(Math.max(0, Number.isFinite(good) ? good : 0))];
    if (Number.isFinite(total)) k.push(`(total ${Math.max(0, total)})`);
    out.push(k.join(' '));
  }
  const life = ofType('lifestyle')[0];
  const level = life ? str(life.system.level) : str(sys.lifestyle);
  const LIFE: Record<string, string> = { streets: 'Street', street: 'Street', squatter: 'Squatter', low: 'Low', middle: 'Middle', high: 'High', luxury: 'Luxury' };
  const lifeWord = Object.hasOwn(LIFE, level.toLowerCase()) ? LIFE[level.toLowerCase()] : undefined;
  if (lifeWord) {
    const months = life ? int(life.system.monthsPaid, -1) : -1;
    out.push(months >= 0 ? ['Lifestyle:', lifeWord, `(${months}`, 'months)'].join(' ') : ['Lifestyle:', lifeWord].join(' '));
  }
  if (ofType('lifestyle').length > 1) W('extraLifestyles', { count: ofType('lifestyle').length - 1 });
  out.push('');

  // ---- What is not carried
  const handled = new Set(['skill', 'cyberware', 'bioware', 'spell', 'adept_power', 'weapon', 'armor', 'focus', 'gear', 'ammo', 'contact', 'quality', 'lifestyle']);
  for (const i of items) if (!handled.has(i.type) && !SILENT_TYPES.has(i.type)) skip(i.type);
  if (skipped.size) W('notImported', { list: [...skipped].map(([ty, n]) => `${n} × ${ty.replace(/_/g, ' ')}`).join(', ') });

  // ---- Text
  const bioText = htmlToText(sys.biography);
  if (bioText) out.push('Background:', ...safeTextLines(bioText), '');
  const fkNotes = htmlToText(sys.notes);
  const noteText = [tx('SR2E.Import.Futurekill.notesHeading'), ...notes, fkNotes].filter(Boolean).join('\n\n');
  out.push('Notes:', ...safeTextLines(noteText));

  if (!attrLines.length && !items.length) W('nothingFound', { name });
  return { text: out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n' };
}
