/**
 * v0.91.1: making a new entry (an item, spell, power… the catalogue lacks) from the user's own book. Pure.
 *
 * - A kind of entry (`ENTRY_KINDS`) has the fields its stat line has (`entryFields`): catalogue columns
 *   (rules/catalogcsv.ts CATALOGUE_COLUMNS, with their help lines as hints) and shorthand codes (Damage "9M",
 *   Ammo "15 (c)", Drain "(F/2)+1S", Persona "3/3/3/3").
 * - `parseStatLine` reads a pasted stat line: only the name, numbers and codes. Words it doesn't know are listed
 *   for the user to see and are never kept, so no book text ends up in a world from the paste.
 * - `buildEntry` turns the form's values (strings, as typed) into an item template's type, name and system data,
 *   with the problems found. A player's request carries only those strings; the GM's client builds it again.
 * The description is the user's own words, kept as plain text.
 */
import { CATALOGUE_COLUMNS, CATALOGUE_SHORTHANDS, VEHICLE_COLUMNS, VEHICLE_SHORTHANDS, readCell, parseCatalogueDamage, parseCatalogueDrain, type CatalogueColumn, type CatalogueShorthand, type CatalogueType } from './catalogcsv.ts';
import { escHtml } from './html.ts';
import { t as tx } from '../helpers/i18n.ts';

export const ENTRY_KINDS = ['weapon', 'armor', 'gear', 'cyberware', 'bioware', 'spell', 'adeptpower', 'focus', 'program', 'cyberdeck', 'vehicle', 'drone'] as const;
export type EntryKind = (typeof ENTRY_KINDS)[number];

export const isEntryKind = (k: unknown): k is EntryKind => (ENTRY_KINDS as readonly string[]).includes(String(k));

/** v0.91.4: the kinds that make a vehicle actor, not an item template. */
export const isVehicleKind = (k: unknown): k is 'vehicle' | 'drone' => k === 'vehicle' || k === 'drone';

/** The item type an entry kind makes (bioware is cyberware marked bioware; v0.91.4: a vehicle or drone is a vehicle actor). */
export function entryItemType(kind: EntryKind): CatalogueType | 'vehicle' {
  return kind === 'bioware' ? 'cyberware' : kind === 'drone' ? 'vehicle' : kind;
}

/** The kind an item type's tab starts on (the shop's tab → the form's kind). */
export function entryKindForType(type: string): EntryKind {
  return isEntryKind(type) ? type : 'gear';
}

/** Fields by id: a catalogue column's path, or `sh<Shorthand name>` (shDamage). In the order the form shows them. */
const FIELDS: Record<EntryKind, readonly string[]> = {
  weapon: ['skill', 'specialization', 'melee', 'shDamage', 'modes', 'shAmmo', 'reach', 'shRange', 'recoilComp', 'concealability', 'weight', 'availability', 'cost', 'streetIndex', 'legality'],
  armor: ['ballistic', 'impact', 'adds', 'concealability', 'weight', 'availability', 'cost', 'streetIndex', 'legality'],
  gear: ['quantity', 'concealability', 'weight', 'availability', 'cost', 'streetIndex', 'legality'],
  cyberware: ['essenceCost', 'rating', 'grade', 'concealability', 'availability', 'cost', 'streetIndex', 'legality'],
  bioware: ['bodyIndex', 'rating', 'bioKind', 'cultured', 'availability', 'cost', 'streetIndex', 'legality'],
  spell: ['category', 'spellType', 'duration', 'range', 'area', 'shDamage', 'shDrain', 'targetNumber', 'resist'],
  adeptpower: ['cost', 'level', 'skill', 'skillDice'],
  focus: ['focusType', 'rating', 'category', 'target', 'availability', 'cost', 'streetIndex', 'legality'],
  program: ['kind', 'rating', 'size', 'damageLevel', 'availability', 'cost', 'streetIndex', 'legality'],
  cyberdeck: ['mpcp', 'shPersona', 'hardening', 'activeMemory', 'storageMemory', 'ioSpeed', 'responseIncrease', 'availability', 'cost', 'streetIndex', 'legality'],
  // v0.91.4 (rules/catalogcsv.ts VEHICLE_COLUMNS).
  vehicle: ['category', 'shHandling', 'speed', 'accel', 'body', 'armor', 'signature', 'autonav', 'sensor', 'seating', 'load', 'availability', 'cost', 'streetIndex', 'legality'],
  drone: ['category', 'shHandling', 'speed', 'accel', 'body', 'armor', 'signature', 'pilot', 'sensor', 'load', 'availability', 'cost', 'streetIndex', 'legality'],
};

/** Bare numbers on a stat line, in the order a book's table gives them (after the codes are read). */
const POSITIONAL: Record<EntryKind, readonly string[]> = {
  weapon: ['concealability', 'weight', 'cost', 'streetIndex'],
  armor: ['concealability', 'ballistic', 'impact', 'weight', 'cost', 'streetIndex'],
  gear: ['concealability', 'weight', 'cost', 'streetIndex'],
  cyberware: ['essenceCost', 'cost', 'streetIndex'],
  bioware: ['bodyIndex', 'cost', 'streetIndex'],
  spell: [],
  adeptpower: ['cost'],
  focus: ['rating', 'cost', 'streetIndex'],
  program: ['rating', 'size', 'cost', 'streetIndex'],
  cyberdeck: ['mpcp', 'hardening', 'activeMemory', 'storageMemory', 'ioSpeed', 'responseIncrease', 'cost', 'streetIndex'],
  // v0.91.4: after the Handling code, the numbers in the order of the vehicle table (Speed, Accel, Body, Armor, Signature,
  // Autonav or Pilot, Sensor), then Cost and Street Index. Shown before saving, so a book that orders them otherwise is fixed by hand.
  // v0.91.4 review (B3): a single Handling number is the first column ("4/8" is read by its shape first).
  vehicle: ['shHandling', 'speed', 'accel', 'body', 'armor', 'signature', 'autonav', 'sensor', 'cost', 'streetIndex'],
  drone: ['shHandling', 'speed', 'accel', 'body', 'armor', 'signature', 'pilot', 'sensor', 'cost', 'streetIndex'],
};
const MELEE_POSITIONAL = ['concealability', 'reach', 'weight', 'cost', 'streetIndex'];

/** One field of the form. */
export interface EntryField {
  id: string;
  /** 'number' | 'check' | 'select' | 'text' (a shorthand code is text). */
  input: 'number' | 'check' | 'select' | 'text';
  choices: string[];
  /** The line under the field (the catalogue column's help, in the reader's language). */
  help: string;
  /** Its label's key: SR2E.App.NewEntry.field.<id, dots as __>. */
  labelKey: string;
  column?: CatalogueColumn;
  shorthand?: CatalogueShorthand;
  step?: string;
}

/** Each field's label key (literal, so the language file's keys can be checked against the code). */
const FIELD_KEYS: Record<string, string> = {
  skill: 'SR2E.App.NewEntry.field.skill',
  specialization: 'SR2E.App.NewEntry.field.specialization',
  melee: 'SR2E.App.NewEntry.field.melee',
  modes: 'SR2E.App.NewEntry.field.modes',
  reach: 'SR2E.App.NewEntry.field.reach',
  recoilComp: 'SR2E.App.NewEntry.field.recoilComp',
  concealability: 'SR2E.App.NewEntry.field.concealability',
  weight: 'SR2E.App.NewEntry.field.weight',
  availability: 'SR2E.App.NewEntry.field.availability',
  cost: 'SR2E.App.NewEntry.field.cost',
  ppCost: 'SR2E.App.NewEntry.field.ppCost',
  streetIndex: 'SR2E.App.NewEntry.field.streetIndex',
  legality: 'SR2E.App.NewEntry.field.legality',
  ballistic: 'SR2E.App.NewEntry.field.ballistic',
  impact: 'SR2E.App.NewEntry.field.impact',
  adds: 'SR2E.App.NewEntry.field.adds',
  quantity: 'SR2E.App.NewEntry.field.quantity',
  essenceCost: 'SR2E.App.NewEntry.field.essenceCost',
  rating: 'SR2E.App.NewEntry.field.rating',
  grade: 'SR2E.App.NewEntry.field.grade',
  bodyIndex: 'SR2E.App.NewEntry.field.bodyIndex',
  bioKind: 'SR2E.App.NewEntry.field.bioKind',
  cultured: 'SR2E.App.NewEntry.field.cultured',
  category: 'SR2E.App.NewEntry.field.category',
  spellType: 'SR2E.App.NewEntry.field.spellType',
  duration: 'SR2E.App.NewEntry.field.duration',
  range: 'SR2E.App.NewEntry.field.range',
  area: 'SR2E.App.NewEntry.field.area',
  targetNumber: 'SR2E.App.NewEntry.field.targetNumber',
  resist: 'SR2E.App.NewEntry.field.resist',
  level: 'SR2E.App.NewEntry.field.level',
  skillDice: 'SR2E.App.NewEntry.field.skillDice',
  focusType: 'SR2E.App.NewEntry.field.focusType',
  target: 'SR2E.App.NewEntry.field.target',
  kind: 'SR2E.App.NewEntry.field.kind',
  size: 'SR2E.App.NewEntry.field.size',
  damageLevel: 'SR2E.App.NewEntry.field.damageLevel',
  mpcp: 'SR2E.App.NewEntry.field.mpcp',
  hardening: 'SR2E.App.NewEntry.field.hardening',
  activeMemory: 'SR2E.App.NewEntry.field.activeMemory',
  storageMemory: 'SR2E.App.NewEntry.field.storageMemory',
  ioSpeed: 'SR2E.App.NewEntry.field.ioSpeed',
  responseIncrease: 'SR2E.App.NewEntry.field.responseIncrease',
  shDamage: 'SR2E.App.NewEntry.field.shDamage',
  shAmmo: 'SR2E.App.NewEntry.field.shAmmo',
  shRange: 'SR2E.App.NewEntry.field.shRange',
  shDrain: 'SR2E.App.NewEntry.field.shDrain',
  shPersona: 'SR2E.App.NewEntry.field.shPersona',
  shHandling: 'SR2E.App.NewEntry.field.shHandling',
  vehCategory: 'SR2E.App.NewEntry.field.vehCategory',
  speed: 'SR2E.App.NewEntry.field.speed',
  accel: 'SR2E.App.NewEntry.field.accel',
  body: 'SR2E.App.NewEntry.field.body',
  armor: 'SR2E.App.NewEntry.field.armor',
  signature: 'SR2E.App.NewEntry.field.signature',
  autonav: 'SR2E.App.NewEntry.field.autonav',
  pilot: 'SR2E.App.NewEntry.field.pilot',
  sensor: 'SR2E.App.NewEntry.field.sensor',
  seating: 'SR2E.App.NewEntry.field.seating',
  load: 'SR2E.App.NewEntry.field.load',
};
export const entryFieldKey = (id: string): string => FIELD_KEYS[id] ?? `SR2E.App.NewEntry.field.${id.replace(/\./g, '__')}`;

/** Each kind's label key. */
export const ENTRY_KIND_KEYS: Record<EntryKind, string> = {
  weapon: 'SR2E.App.NewEntry.kind.weapon',
  armor: 'SR2E.App.NewEntry.kind.armor',
  gear: 'SR2E.App.NewEntry.kind.gear',
  cyberware: 'SR2E.App.NewEntry.kind.cyberware',
  bioware: 'SR2E.App.NewEntry.kind.bioware',
  spell: 'SR2E.App.NewEntry.kind.spell',
  adeptpower: 'SR2E.App.NewEntry.kind.adeptpower',
  focus: 'SR2E.App.NewEntry.kind.focus',
  program: 'SR2E.App.NewEntry.kind.program',
  cyberdeck: 'SR2E.App.NewEntry.kind.cyberdeck',
  vehicle: 'SR2E.App.NewEntry.kind.vehicle',
  drone: 'SR2E.App.NewEntry.kind.drone',
};

/** The form's fields for a kind. */
export function entryFields(kind: EntryKind): EntryField[] {
  const type = entryItemType(kind);
  const out: EntryField[] = [];
  const vehicle = type === 'vehicle';
  for (const id of FIELDS[kind]) {
    if (/^sh[A-Z]/.test(id)) {
      const sh = (vehicle ? VEHICLE_SHORTHANDS : CATALOGUE_SHORTHANDS[type as CatalogueType] ?? []).find((s) => s.name === id.slice(2));
      if (sh) out.push({ id, input: 'text', choices: [], help: sh.help, labelKey: entryFieldKey(id), shorthand: sh });
      continue;
    }
    const col = (vehicle ? VEHICLE_COLUMNS : CATALOGUE_COLUMNS[type as CatalogueType]).find((c) => c.path === id);
    if (!col) continue;
    const input = col.kind === 'boolean' ? 'check' : col.kind === 'choice' ? 'select' : col.kind === 'string' ? 'text' : 'number';
    // An adept power's cost is in power points.
    out.push({ id, input, choices: input === 'select' ? [...(col.choices ?? [])] : [], help: col.help, labelKey: kind === 'adeptpower' && id === 'cost' ? entryFieldKey('ppCost') : vehicle && id === 'category' ? entryFieldKey('vehCategory') : entryFieldKey(id), column: col, ...(col.kind === 'number' ? { step: 'any' } : {}) });
  }
  return out;
}

/** Longest stat line read (a line of numbers and codes, not a paragraph). */
export const STAT_LINE_MAX = 400;
/** The longest name kept, and the longest description. */
export const ENTRY_NAME_MAX = 80;
export const ENTRY_DESCRIPTION_MAX = 2000;

const AVAIL = /(?:\d+\s*\/\s*\d+(?:\.\d+)?(?:\s*[-–]\s*\d+(?:\.\d+)?)?\s*(?:hrs?|hours?|days?|wks?|weeks?|mos?|months?)\b|always\b)/.source;
const COST = String.raw`(?:[¥￥]\s*\d[\d,]*|\d[\d,]*\s*(?:[¥￥]|nuyen\b)|\d{1,3}(?:,\d{3})+)`;
const NUM = String.raw`[+-]?(?:\d+(?:[.,]\d+)?|\.\d+)`;
const DAMAGE = /(?:\(?\s*str(?:ength)?\s*(?:[+-]\s*\d+)?\s*\)?\s*[LMSD]|\d+\s*[LMSD])(?:\s*\(?\s*(?:stun|phys(?:ical)?)\s*\)?)?(?![a-z])/.source;
const DRAIN = String.raw`\[?\s*\(?\s*F\s*[/÷]\s*2\s*\)?\s*(?:[+-]\s*\d+)?\s*\]?\s*[LMSD](?![a-z])`;
const AMMO = /\d+\s*\(\s*(?:c|b|cy|m|bk|clip|belt|cylinder|internal|magazine|break)\s*\)/.source;
const MODES = /(?:SS|SA|BF|FA)(?:\s*\/\s*(?:SS|SA|BF|FA))*(?![a-z])/.source;
const FOUR = String.raw`\d+\s*\/\s*\d+\s*\/\s*\d+\s*\/\s*\d+`;

/** Words for a choice found anywhere on a line (lower case → value), by field. */
const WORDS: Partial<Record<string, Record<string, string>>> = {
  category: { combat: 'combat', detection: 'detection', health: 'health', illusion: 'illusion', manipulation: 'manipulation' },
  range: { los: 'los', touch: 'touch' },
  grade: { alphaware: 'alpha', betaware: 'beta', deltaware: 'delta' },
  legality: { legal: 'legal', restricted: 'restricted', forbidden: 'forbidden', permit: 'permit' },
  focusType: { spell: 'spell', sustaining: 'sustaining', spirit: 'spirit', power: 'power', weapon: 'weapon' },
  duration: { instant: 'instant', sustained: 'sustained', permanent: 'permanent' },
  spellType: { mana: 'mana', physical: 'physical' },
};

/** Choices a name may give (a "Power focus" is a power focus, an "Attack" program an attack utility). */
const NAME_WORDS = new Set(['focusType', 'kind']);

/** Labels a value may follow on a line ("Cost 450", "Conceal: 5", "SI .75"), per field, lower case. */
function labelsFor(f: EntryField): string[] {
  // v0.91.1 review (B4): a focus's target is labelled only "target" or "for" ("Spell focus" isn't a label).
  const own = f.id === 'target' ? ['target', 'for'] : f.shorthand ? [f.shorthand.name, ...f.shorthand.aliases] : [f.column!.path.split('.').pop()!, ...(f.column!.aliases ?? [])];
  const extra: Record<string, string[]> = {
    availability: ['avail', 'availability'], streetIndex: ['street index', 'si'], concealability: ['conceal', 'conc', 'concealability'],
    essenceCost: ['essence', 'ess'], bodyIndex: ['body index', 'bi'], 'shDamage': ['damage', 'dmg'], 'shDrain': ['drain'], spellType: ['type'],
    duration: ['duration', 'dur'], targetNumber: ['target', 'tn'], cost: ['cost', 'price'], 'shAmmo': ['ammo'], modes: ['mode', 'modes'],
    'shPersona': ['persona'], activeMemory: ['active memory', 'active'], storageMemory: ['storage memory', 'storage'], ioSpeed: ['i/o speed', 'i/o', 'io'],
    responseIncrease: ['response increase', 'response'], rating: ['rating', 'level'], level: ['level', 'levels'],
    shHandling: ['handling', 'hand'], signature: ['signature', 'sig'], accel: ['accel', 'acceleration'], autonav: ['autonav', 'autopilot'],
  };
  // "Mp" follows a size ("12 Mp"), it doesn't label one.
  return [...new Set([...own, ...(extra[f.id] ?? [])].map((x) => x.toLowerCase()).filter((x) => x.length >= 2 && x !== 'mp'))];
}

/** The pattern a field's value has on a line. */
function valuePattern(f: EntryField): string {
  if (f.id === 'availability') return AVAIL;
  if (f.id === 'cost') return `(?:${COST}|${NUM})`;
  if (f.id === 'shDamage') return f.shorthand?.fills.includes('damagePower') ? DAMAGE : String.raw`[LMSD](?:\s*\(?\s*stun\s*\)?)?(?![a-z])`;
  if (f.id === 'shDrain') return DRAIN;
  if (f.id === 'shAmmo') return String.raw`\d+(?:\s*\(\s*[a-z]+\s*\))?`;
  if (f.id === 'shRange' || f.id === 'shPersona') return FOUR;
  if (f.id === 'shHandling') return String.raw`\d+(?:\s*\/\s*\d+)?`;
  if (f.id === 'modes') return MODES;
  if (f.input === 'number') return NUM;
  if (f.input === 'check') return /(?:yes|no|y|n|x)(?![a-z])/.source;
  return String.raw`[A-Za-z][\w/-]*`;
}

/** What read text is replaced with (never a separator or part of a value). */
const TAKEN = '\u0001';

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** What a stat line gave: the name, each field's text, what was read, and the words left unread (never kept). */
export interface StatLineResult { name: string; values: Record<string, string>; read: string[]; skipped: string[]; tooLong: boolean }

/**
 * Read a pasted stat line for a kind: labelled values first ("Cost 450"), then codes by their shape (an Availability,
 * a damage or drain code, ammo, firing modes, range bands, persona ratings, B/I), then bare numbers in the order the
 * book's tables give them. The name is the words before the first number or code.
 */
export function parseStatLine(kind: EntryKind, input: string): StatLineResult {
  const raw = String(input ?? '');
  const out: StatLineResult = { name: '', values: {}, read: [], skipped: [], tooLong: false };
  if (raw.length > STAT_LINE_MAX) { out.tooLong = true; return out; }
  // One line: tabs, pipes and runs of spaces are separators.
  let line = ` ${raw.replace(/[\r\n\t|;]+/g, '  ').replace(/\s+/g, ' ').trim()} `;
  const fields = entryFields(kind);
  const byId = new Map(fields.map((f) => [f.id, f]));
  const taken: Array<{ at: number; end: number }> = [];
  const put = (id: string, value: string, at: number, end: number) => {
    if (!byId.has(id) || out.values[id] !== undefined) return false;
    out.values[id] = value.replace(/\s+/g, ' ').trim();
    out.read.push(id);
    taken.push({ at, end });
    // v0.91.1 review (B2): read text becomes one mark per character, not spaces (runs of spaces made the code patterns
    // backtrack for seconds on a long line).
    line = `${line.slice(0, at)}${TAKEN.repeat(end - at)}${line.slice(end)}`;
    return true;
  };
  // 1. Labelled values.
  for (const f of fields) {
    for (const label of labelsFor(f)) {
      const re = new RegExp(String.raw`(^|[\s,(])(${esc(label)})\s*[:=]?\s*(${valuePattern(f)})`, 'i');
      const m = re.exec(line);
      if (!m) continue;
      const at = m.index + m[1]!.length;
      if (put(f.id, m[3]!, at, m.index + m[0].length)) break;
    }
  }
  // 2. Codes by their shape.
  const shape = (id: string, pattern: string, flags = 'i', group = 0) => {
    if (!byId.has(id) || out.values[id] !== undefined) return;
    const m = new RegExp(String.raw`(^|[\s,(])(${pattern})(?=$|[\s,)])`, flags).exec(line);
    if (m) put(id, group ? m[group + 1] ?? m[2]! : m[2]!, m.index + m[1]!.length, m.index + m[0].length);
  };
  shape('availability', AVAIL);
  shape('shAmmo', AMMO);
  shape('shDrain', DRAIN);
  if (kind !== 'spell') shape('shDamage', DAMAGE);
  shape('modes', MODES, '');
  shape('shRange', FOUR);
  shape('shPersona', FOUR);
  // v0.91.4: a vehicle's Handling "4/8" (on-road/off-road).
  shape('shHandling', String.raw`\d+\s*\/\s*\d+`);
  shape('cost', COST);
  if (kind === 'armor' && out.values['ballistic'] === undefined && out.values['impact'] === undefined) {
    const m = new RegExp(String.raw`(^|\s)(\d+)\s*\/\s*(\d+)(?=$|\s)`).exec(line);
    if (m) { const at = m.index + m[1]!.length; put('ballistic', m[2]!, at, at); put('impact', m[3]!, at, m.index + m[0].length); }
  }
  // A size in Mp ("12 Mp").
  if (byId.has('size') && out.values['size'] === undefined) {
    const m = /(^|\s)(\d[\d,]*)\s*mp\b/i.exec(line);
    if (m) put('size', m[2]!, m.index + m[1]!.length, m.index + m[0].length);
  }
  // A Strength damage code makes a melee weapon (its bare numbers are then Conceal, Reach, Weight, Cost, SI).
  const melee = kind === 'weapon' && /str/i.test(out.values['shDamage'] ?? '');
  if (melee && out.values['melee'] === undefined) { out.values['melee'] = 'yes'; out.read.push('melee'); }
  // Words for a choice (Combat, Touch, Instant, Restricted…): read before the name, so a spell's name ends at them.
  // v0.91.1 review (B5). Choices a name may give (a "Power focus") come after the name, below.
  const readWords = (inName: boolean) => {
    for (const [id, words] of Object.entries(WORDS)) {
      if (!byId.has(id) || out.values[id] !== undefined || NAME_WORDS.has(id) !== inName) continue;
      for (const [w, v] of Object.entries(words!)) {
        const re = new RegExp(String.raw`(^|[\s,(])(${esc(w)})(?=$|[\s,).])`, 'i');
        const m = re.exec(line);
        if (m && put(id, v, m.index + m[1]!.length, m.index + m[0].length)) break;
        if (inName && re.test(` ${out.name} `)) { out.values[id] = v; out.read.push(id); break; }
      }
    }
  };
  readWords(false);
  // 3. The name: the words before the first number or code.
  const firstTaken = Math.min(line.length, ...taken.map((x) => x.at));
  const firstDigit = (() => { const m = /\s[+-]?[\d.¥￥(\[]/.exec(line); return m ? m.index : line.length; })();
  const nameEnd = Math.min(firstTaken, firstDigit);
  const nameText = line.slice(0, nameEnd).trim();
  const words = nameText.split(' ').filter(Boolean);
  if (words.length && words.length <= 6 && nameText.length <= 60) {
    out.name = nameText.replace(/[,:;]+$/, '');
    line = `${TAKEN.repeat(nameEnd)}${line.slice(nameEnd)}`;
  }
  readWords(true);
  const nameChoice = byId.get('kind');
  if (nameChoice && NAME_WORDS.has('kind') && out.values['kind'] === undefined && kind === 'program') {
    const hit = nameChoice.choices.find((c) => c && new RegExp(String.raw`(^|\s)${esc(c)}(?=$|\s)`, 'i').test(out.name));
    if (hit) { out.values['kind'] = hit; out.read.push('kind'); }
  }
  // 4. Bare numbers, in the book's column order; when fewer are left, the last ones are Cost and Street Index.
  const nums: string[] = [];
  line = line.replace(new RegExp(String.raw`(^|\s)(${NUM})(?=$|\s)`, 'g'), (_m, sp: string, n: string) => { nums.push(n); return `${sp}${TAKEN.repeat(n.length)}`; });
  const order = (melee ? MELEE_POSITIONAL : POSITIONAL[kind]).filter((id) => byId.has(id) && out.values[id] === undefined);
  if (nums.length) {
    if (nums.length >= order.length) order.forEach((id, i) => put(id, nums[i]!, 0, 0));
    else {
      // Fewer numbers than columns: Street Index (a small number) last, the cost before it, the rest from the front.
      const rest = [...nums];
      const tail: Array<[string, string]> = [];
      const last = Number(String(rest[rest.length - 1]).replace(',', '.'));
      if (order.includes('streetIndex') && rest.length >= 2 && last > 0 && last <= 5) tail.unshift(['streetIndex', rest.pop()!]);
      if (order.includes('cost') && rest.length >= 1) tail.unshift(['cost', rest.pop()!]);
      const front = order.filter((id) => !tail.some(([t]) => t === id));
      rest.forEach((n, i) => { if (front[i]) put(front[i]!, n, 0, 0); else out.skipped.push(n); });
      for (const [id, n] of tail) put(id, n, 0, 0);
    }
    if (nums.length > order.length) out.skipped.push(...nums.slice(order.length));
  }
  // What is left: never kept, only shown.
  out.skipped.push(...line.replace(new RegExp(TAKEN, 'g'), ' ').split(/\s+/).map((w) => w.replace(/^[,()[\]]+|[,()[\]]+$/g, '')).filter((w) => w && /[\p{L}\p{N}]/u.test(w)));
  out.skipped = out.skipped.slice(0, 30);
  // v0.91.1 review (B3): a choice read as typed ("Combat", "M", "LOS") becomes its value, so the form's select shows it.
  for (const f of fields) {
    const v = out.values[f.id];
    if (f.input !== 'select' || v === undefined || !f.column) continue;
    const r = readCell(v, f.column);
    if ('value' in r) out.values[f.id] = String(r.value);
  }
  return out;
}

/** Plain text kept as the description: escaped, line breaks kept, at most ENTRY_DESCRIPTION_MAX characters. */
export function entryDescriptionHtml(text: unknown): string {
  const t = String(text ?? '').replace(/\r/g, '').trim().slice(0, ENTRY_DESCRIPTION_MAX);
  if (!t) return '';
  return t.split(/\n{2,}/).map((p) => `<p>${escHtml(p).replace(/\n/g, '<br>')}</p>`).join('');
}

const UNSAFE = new Set(['__proto__', 'prototype', 'constructor']);
function setPath(obj: Record<string, any>, path: string, value: unknown): void {
  const parts = path.split('.');
  if (parts.some((p) => UNSAFE.has(p))) return;
  let o = obj;
  for (const k of parts.slice(0, -1)) { if (!o[k] || typeof o[k] !== 'object') o[k] = {}; o = o[k]; }
  o[parts[parts.length - 1]!] = value;
}

/** A new entry as an item template's parts, and what is wrong with it (empty = it can be saved). */
export interface BuiltEntry { kind: EntryKind; type: CatalogueType | 'vehicle'; name: string; system: Record<string, any>; problems: string[] }

/**
 * The form's values (strings, as typed or read) as item data. Only the kind's own fields are read, so a request
 * carrying anything else gives nothing more. Unreadable values are problems (named by the field's label key).
 */
export function buildEntry(kind: unknown, name: unknown, values: unknown, description: unknown, label: (key: string) => string = (k) => k): BuiltEntry {
  const k: EntryKind = isEntryKind(kind) ? kind : 'gear';
  const type = entryItemType(k);
  const problems: string[] = [];
  const n = String(name ?? '').replace(/\s+/g, ' ').trim().slice(0, ENTRY_NAME_MAX);
  if (!n) problems.push(tx('SR2E.Text.NewEntry.needsAName'));
  const vals: Record<string, unknown> = values && typeof values === 'object' && !Array.isArray(values) ? values as Record<string, unknown> : {};
  const system: Record<string, any> = {};
  if (k === 'bioware') system['bioware'] = true;
  // v0.91.4 review (N7): said either way (a vehicle saved over a drone of the same name is no longer a drone).
  if (isVehicleKind(k)) system['drone'] = k === 'drone';
  for (const f of entryFields(k)) {
    const v = Object.prototype.hasOwnProperty.call(vals, f.id) ? String(vals[f.id] ?? '').trim().slice(0, 100) : '';
    if (!v) continue;
    if (f.shorthand) {
      const err = f.shorthand.apply(v, (path, value) => setPath(system, path, value));
      if (err) problems.push(tx('SR2E.Text.NewEntry.cantRead', { field: label(f.labelKey), value: v }));
      continue;
    }
    const cell = f.input === 'check' ? (/^(yes|y|x|true|on|1)$/i.test(v) ? 'yes' : 'no') : v;
    const r = readCell(cell, f.column!);
    if ('error' in r) problems.push(tx('SR2E.Text.NewEntry.cantRead', { field: label(f.labelKey), value: v }));
    else setPath(system, f.column!.path, r.value);
  }
  // A Strength damage code is a melee weapon's (its Power is Strength plus the number).
  if (k === 'weapon' && system['strengthPower'] && system['melee'] === undefined) system['melee'] = true;
  if (k === 'weapon' && system['ammoMax'] && system['ammo'] === undefined) system['ammo'] = system['ammoMax'];
  const d = entryDescriptionHtml(description);
  // v0.91.4: a vehicle keeps its text in its notes.
  if (d) system[isVehicleKind(k) ? 'notes' : 'description'] = d;
  return { kind: k, type, name: n, system, problems };
}

/** The parts of a player's entry request, read safely (strings only, the kind's own fields only). */
export function entryRequestData(data: unknown): { kind: EntryKind; name: string; values: Record<string, string>; description: string } | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const d = data as Record<string, unknown>;
  if (!isEntryKind(d['kind'])) return null;
  const ids = new Set(entryFields(d['kind']).map((f) => f.id));
  const values: Record<string, string> = {};
  const vin = d['values'];
  if (vin && typeof vin === 'object' && !Array.isArray(vin)) {
    for (const [key, v] of Object.entries(vin as Record<string, unknown>)) if (ids.has(key) && (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')) values[key] = String(v).slice(0, 100);
  }
  return { kind: d['kind'], name: String(d['name'] ?? '').slice(0, ENTRY_NAME_MAX), values, description: String(d['description'] ?? '').slice(0, ENTRY_DESCRIPTION_MAX) };
}

/** Quick look for checking DAMAGE/DRAIN codes elsewhere (the form's live preview). */
export const entryCodeOk = { damage: (s: string) => parseCatalogueDamage(s) !== null, drain: (s: string) => parseCatalogueDrain(s) !== null };
