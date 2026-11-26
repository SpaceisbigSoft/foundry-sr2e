import { t as tx } from '../helpers/i18n.ts';

/**
 * v0.94.0: Nullsheen import. Nullsheen is a web character generator for SR2 and SR3 that saves a character as one
 * JSON object. This file turns such a file into the character write-up text that the system's own character import
 * reads (rules/charimport.ts: parseCharacterSheet, characterImportPlan; docs/DATA-FORMATS.md section 4), so there is
 * one importer, one preview and one update-by-name re-import.
 *
 * How Nullsheen's attributes are read (worked out from its files, see the 0.94.0 notes):
 * - `attributes.Body` … `attributes.Willpower` are the points the player put into each attribute BEFORE the
 *   metatype's modifiers (in a sample file they add up to the Attributes priority's points, and a troll's Charisma
 *   there is above a troll's maximum). `raceBonuses` holds the metatype's modifiers.
 *   Natural rating = attribute + race bonus (at least 1).
 * - `cyberAttributeBonuses` (from cyberware and bioware) and `magicalAttributeBonuses` (from adept powers) are added on
 *   top: augmented rating = natural + cyber + magical. The import takes the natural rating as the base and the
 *   difference as a modifier, less what the imported ware and powers add themselves, so nothing counts twice.
 * - `attributes.Reaction` is not trusted (it does not follow from the other values in sample files): Reaction is
 *   left to the system, and written only when ware or powers change it or the initiative dice; then natural Reaction
 *   = (natural Quickness + natural Intelligence) / 2, rounded down, plus the Reaction bonuses for the augmented one.
 *   `attributes.Initative` (sic) is the base initiative dice, plus the bonuses' `Initative`.
 * - `attributes.Essence` may be 6 even with cyberware: Essence = 6 minus the cyberware's Essence costs, or the file's
 *   value when that is lower.
 *
 * Pure: no Foundry globals. Never throws.
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

/** The most entries read from one list, and the longest name and free text written. */
export const NULLSHEEN_MAX_LIST = 500;
const MAX_NAME = 200;
const MAX_TEXT = 4000;
const MAX_OUT = 100_000;

/** An entry with its details in brackets, when it has any. */
const withDetails = (base: string, toks: string[]) => (toks.length ? `${base} [${toks.join(', ')}]` : base);
const UNNAMED = 'unnamed';
const keyOf = (name: string) => `nullsheen:${name || UNNAMED}`;

const isRec = (v: unknown): v is Rec => !!v && typeof v === 'object' && !Array.isArray(v);

/** A field by name, case ignored (an exact match first). Own properties only. */
function field(o: unknown, ...keys: string[]): unknown {
  if (!isRec(o)) return undefined;
  for (const k of keys) if (Object.hasOwn(o, k)) return o[k];
  const lower = new Map<string, string>();
  for (const k of Object.keys(o)) lower.set(k.toLowerCase(), k);
  for (const k of keys) {
    const real = lower.get(k.toLowerCase());
    if (real !== undefined) return o[real];
  }
  return undefined;
}

/** A string or number as trimmed text; anything else is ''. */
function str(v: unknown): string {
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return '';
}

/** A number from a number or text ("12", "0.5", ".8", "2/36hrs" → 2); undefined if none. */
function num(v: unknown): number | undefined {
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  if (typeof v !== 'string') return undefined;
  const m = /^\s*([+-]?(?:\d+(?:[.,]\d+)?|[.,]\d+))/.exec(v);
  if (!m) return undefined;
  const n = Number((m[1] as string).replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
}

function list(v: unknown): unknown[] {
  if (Array.isArray(v)) return v.slice(0, NULLSHEEN_MAX_LIST);
  if (isRec(v)) return Object.values(v).slice(0, NULLSHEEN_MAX_LIST);
  return [];
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const fmt = (n: number) => String(round2(n));

/** Plain one-line text: control characters and new lines become spaces, "|" becomes "/", blanks collapse. */
function clean(v: unknown, max = MAX_TEXT): string {
  // eslint-disable-next-line no-control-regex
  const s = str(v).replace(/[\u0000-\u001f\u007f\u2028\u2029]+/g, ' ').replace(/\|/g, '/').replace(/\s+/g, ' ').trim();
  return s.length > max ? s.slice(0, max).trim() : s;
}

/**
 * A name safe inside a list entry: commas and semicolons (which split entries) become "/", colons and "=" (which
 * read as labels) become " - ", "(x)" becomes " - x" (brackets are read as an entry's details), other brackets go.
 * A lower-case first letter is raised (a line starting in lower case continues the entry before it).
 */
function entryName(v: unknown, opts: { dashes?: boolean } = {}): string {
  const dash = opts.dashes === false ? ' ' : ' - ';
  let s = clean(v, MAX_NAME * 2)
    .replace(/\s*[,;]\s*/g, '/')
    .replace(/\s*[:=]\s*/g, dash)
    .replace(/\s*[([{]\s*([^()[\]{}]*?)\s*[)\]}]/g, (_m, inner: string) => (inner ? `${dash}${inner}` : ''))
    .replace(/[()[\]{}<>]/g, ' ');
  if (opts.dashes === false) s = s.replace(/\s+[—–-]+\s+/g, ' ');
  s = s.replace(/\s+/g, ' ').replace(/^[\s\-*•·–—/]+|[\s\-–—/]+$/g, '').trim();
  if (s.length > MAX_NAME) s = s.slice(0, MAX_NAME).trim();
  return s.charAt(0).toLowerCase() === s.charAt(0) && /[a-z]/.test(s.charAt(0)) ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}


// ===================================================================== Detection

/** Cheap check of parsed JSON: an object with Nullsheen's attribute block and one of its own fields. */
export function looksLikeNullsheen(data: unknown): boolean {
  try {
    if (!isRec(data)) return false;
    const attrs = field(data, 'attributes');
    if (!isRec(attrs)) return false;
    if (field(attrs, 'Body') === undefined && field(attrs, 'Quickness') === undefined) return false;
    // A Foundry actor export has `system` and `_stats`; Nullsheen has neither.
    if (Object.hasOwn(data, '_stats') || Object.hasOwn(data, 'system')) return false;
    const marks = ['street_name', 'raceBonuses', 'cyberAttributeBonuses', 'magicalAttributeBonuses', 'magicalChoice', 'priorities', 'cgmethod'];
    if (marks.some((m) => Object.hasOwn(data, m))) return true;
    return /^SR[23]$/i.test(str(field(data, 'edition')));
  } catch {
    return false;
  }
}

// ===================================================================== Pieces

const ATTRS: Array<[string, string]> = [
  ['Body', 'Body'], ['Quickness', 'Quickness'], ['Strength', 'Strength'],
  ['Charisma', 'Charisma'], ['Intelligence', 'Intelligence'], ['Willpower', 'Willpower'],
];

interface Sections {
  skills: string[]; knowledge: string[]; language: string[]; buildRepair: string[];
  cyber: string[]; bio: string[]; spells: string[]; powers: string[];
  gear: string[]; armor: string[]; foci: string[]; contacts: string[]; edges: string[]; flaws: string[];
}

/** The first concentration and specialization a Nullsheen skill selected, and how many more there were. */
function skillChoice(s: unknown): { conc: string; spec: string; extra: string[] } {
  const out = { conc: '', spec: '', extra: [] as string[] };
  const names: Array<{ conc: string; spec: string }> = [];
  for (const e of list(field(s, 'selectedConcentrations'))) {
    if (typeof e === 'string') {
      if (e.trim()) names.push({ conc: e, spec: '' });
      continue;
    }
    if (!isRec(e)) continue;
    const conc = str(field(e, 'name', 'concentration'));
    let spec = str(field(e, 'specialization', 'selectedSpecialization'));
    const specs = list(field(e, 'selectedSpecializations'));
    if (!spec && specs.length) spec = typeof specs[0] === 'string' ? specs[0] : str(field(specs[0], 'name', 'specialization'));
    if (conc || spec) names.push({ conc, spec });
  }
  // SR3 files: a specialization on the skill itself.
  const own = str(field(s, 'specialization', 'selectedSpecialization', 'specialisation'));
  if (!names.length && own) names.push({ conc: own, spec: '' });
  if (names.length) {
    out.conc = names[0]!.conc;
    out.spec = names[0]!.spec;
    out.extra = names.slice(1).map((n) => n.spec || n.conc);
  }
  return out;
}

function damageOf(raw: unknown): { code: string; stun: boolean } | null {
  const s = clean(raw, 100);
  if (!s) return null;
  const stun = /stun|\(\s*s\s*\)\s*$/i.test(s);
  const strM = /\(?\s*str(?:ength)?\s*([+-]\s*\d+)?\s*\)?\s*([LMSD])\b/i.exec(s);
  if (strM) return { code: `(STR${(strM[1] ?? '').replace(/\s+/g, '')})${(strM[2] as string).toUpperCase()}`, stun };
  const n = /(\d+)\s*([LMSD])\b/i.exec(s);
  if (n) return { code: `${n[1]}${(n[2] as string).toUpperCase()}`, stun };
  return null;
}

function modesOf(raw: unknown): string {
  const seen: string[] = [];
  for (const m of clean(raw, 100).toUpperCase().matchAll(/\b(SS|SA|BF|FA)\b/g)) if (!seen.includes(m[1] as string)) seen.push(m[1] as string);
  return seen.join('/');
}

function ammoOf(raw: unknown): string {
  const s = clean(raw, 100);
  const typed = /(\d+)\s*\(?\s*(cl|cy|c|b|m)\s*\)?(?![a-z])/i.exec(s);
  if (typed) return `${typed[1]} (${(typed[2] as string).toLowerCase()})`;
  const n = /(\d+)/.exec(s);
  return n && Number(n[1]) > 0 ? `${n[1]} rounds` : '';
}

/** The start of an attribute line as the import reads one (charimport.ts ATTR_LINE). */
const ATTR_START = /^\s*(?:body|bod|quickness|quick|qui|qck|strength|str|charisma|cha|intelligence|int|willpower|will|wil|wp|essence|ess|magic|mag|reaction|rea|initiative|init)\b\s*[:=]?\s*\d/i;
const MELEE_TYPE = /edged|club|pole|whip|melee|unarmed|blade|staff|cyber.?implant|armed/i;

/** A weapon entry for the Gear list, or null when the entry has no damage code. */
function weaponEntry(w: unknown, name: string, amount: number): string | null {
  const dmg = damageOf(field(w, 'Damage', 'damage'));
  if (!dmg) return null;
  const toks = [dmg.stun ? `${dmg.code} Stun` : dmg.code];
  const modes = modesOf(field(w, 'Mode', 'mode'));
  if (modes) toks.push(modes);
  const ammo = ammoOf(field(w, 'Ammo', 'Ammunition', 'ammo'));
  if (ammo) toks.push(ammo);
  const reach = num(field(w, 'Reach', 'reach'));
  const type = str(field(w, 'Type', 'Category', 'type'));
  if (reach !== undefined && reach > 0) toks.push(`Reach ${Math.round(reach)}`);
  else if (MELEE_TYPE.test(type) && !/STR/.test(dmg.code)) toks.push('Reach 0');
  return `${amount > 1 ? `${amount}x ` : ''}${name} [${toks.join(', ')}]`;
}

function drainOf(raw: unknown): string | null {
  const s = str(raw).replace(/\s+/g, '');
  if (!s) return null;
  const m = /^\[?\(?F\/2\)?([+-]\d+)?\]?([LMSD])$/i.exec(s) ?? /^\[?([+-]\d+)?\]?([LMSD])$/i.exec(s);
  if (!m) return null;
  const mod = m[1] && Number(m[1]) !== 0 ? `${Number(m[1]) > 0 ? '+' : '-'}${Math.abs(Number(m[1]))} ` : '';
  return `Drain ${mod}${(m[2] as string).toUpperCase()}`;
}

// ===================================================================== Converter

/** Turn a parsed Nullsheen file into write-up text for the character import. Never throws. */
export function nullsheenToWriteUp(data: unknown): ConvertResult {
  const warnings: string[] = [];
  const result = (text: string, name: string, key: string, edition?: string): ConvertResult => ({
    text, name, key, source: 'nullsheen', warnings: [...new Set(warnings)], ...(edition ? { edition } : {}),
  });
  try {
    if (!isRec(data)) {
      warnings.push(tx('SR2E.Import.Nullsheen.notAnObject'));
      return result('', '', keyOf(''));
    }
    return convert(data, warnings, result);
  } catch (err) {
    warnings.push(tx('SR2E.Import.Nullsheen.failed', { error: String((err as Error)?.message ?? err).slice(0, 200) }));
    return result('', '', keyOf(''));
  }
}

function convert(d: Rec, warnings: string[], result: (text: string, name: string, key: string, edition?: string) => ConvertResult): ConvertResult {
  const warn = (w: string) => warnings.push(w);
  if (!looksLikeNullsheen(d)) warn(tx('SR2E.Import.Nullsheen.notNullsheen'));

  const lines: string[] = [];
  const notes: string[] = [];
  const sec: Sections = { skills: [], knowledge: [], language: [], buildRepair: [], cyber: [], bio: [], spells: [], powers: [], gear: [], armor: [], foci: [], contacts: [], edges: [], flaws: [] };

  // ---- Edition
  const editionRaw = str(field(d, 'edition')).toUpperCase().replace(/\s+/g, '');
  let edition: string | undefined;
  if (/^SR?3/.test(editionRaw) || editionRaw === '3') {
    edition = 'SR3';
    warn(tx('SR2E.Import.Nullsheen.sr3'));
  } else if (/^SR?2/.test(editionRaw) || editionRaw === '2') edition = 'SR2';
  else if (editionRaw) {
    edition = clean(editionRaw, 20);
    warn(tx('SR2E.Import.Nullsheen.editionUnknown', { edition }));
  }

  // ---- Name and metatype
  const street = clean(field(d, 'street_name', 'streetName', 'alias'), MAX_NAME);
  const real = clean(field(d, 'name'), MAX_NAME);
  if (real && real !== street) lines.push(`Name: ${real}`);
  if (street) lines.push(`Alias: ${street}`);
  const name = street || real;
  if (!name) warn(tx('SR2E.Import.Nullsheen.noName'));
  const key = keyOf(name.toLowerCase().replace(/\s+/g, ' '));

  const variant = field(d, 'isMetaVariant') === true ? clean(field(d, 'metaVariantType'), 60) : '';
  const race = variant || clean(field(d, 'race', 'metatype'), 60);
  if (race) lines.push(`Metatype: ${race}`);

  const choice = clean(field(d, 'magicalChoice'), 80);
  const mundaneChoice = !choice || /^(?:none|mundane|no magic)$/i.test(choice);
  if (!mundaneChoice) lines.push(`Archetype: ${choice}`);

  // ---- Attributes
  const attrs = field(d, 'attributes');
  const raceB = field(d, 'raceBonuses');
  const cyberB = field(d, 'cyberAttributeBonuses');
  const magB = field(d, 'magicalAttributeBonuses');
  const bonus = (o: unknown, k: string) => num(field(o, k)) ?? 0;
  const natural: Record<string, number> = {};
  const augmented: Record<string, number> = {};
  if (isRec(attrs)) {
    for (const [k, label] of ATTRS) {
      const base = num(field(attrs, k));
      if (base === undefined) continue;
      let nat = Math.round(base + bonus(raceB, k));
      if (nat < 1) {
        warn(tx('SR2E.Import.Nullsheen.attributeBelowOne', { attribute: label, value: nat }));
        nat = 1;
      }
      const aug = nat + Math.round(bonus(cyberB, k) + bonus(magB, k));
      natural[k] = nat;
      augmented[k] = aug;
      lines.push(aug !== nat ? `${label}: ${nat} (${aug})` : `${label}: ${nat}`);
    }
    if (!Object.keys(natural).length) warn(tx('SR2E.Import.Nullsheen.noAttributes'));
  } else warn(tx('SR2E.Import.Nullsheen.noAttributes'));

  // Essence: 6 less the cyberware (worked out below with the cyberware).
  let essenceLoss = 0;
  const noEssence: string[] = [];
  for (const c of list(field(d, 'cyberware'))) {
    const e = num(field(c, 'EssCost', 'Essence', 'essCost', 'essence'));
    const amount = Math.max(1, Math.round(num(field(c, 'Amount')) ?? 1));
    if (e === undefined) {
      const n = entryName(field(c, 'Name', 'name'));
      if (n) noEssence.push(n);
    } else essenceLoss += Math.max(0, e) * amount;
  }
  const fileEssence = isRec(attrs) ? num(field(attrs, 'Essence')) : undefined;
  const computed = round2(Math.max(0, 6 - essenceLoss));
  let essence = computed;
  if (fileEssence !== undefined && fileEssence < 6 && Math.abs(fileEssence - computed) > 0.005) {
    essence = round2(Math.max(0, Math.min(fileEssence, computed)));
    warn(tx('SR2E.Import.Nullsheen.essenceDiffers', { file: fmt(fileEssence), computed: fmt(computed), used: fmt(essence) }));
  }
  if (isRec(attrs) || essenceLoss > 0) lines.push(`Essence: ${fmt(essence)}`);

  const magic = isRec(attrs) ? num(field(attrs, 'Magic')) : undefined;
  const magical = field(d, 'magical') === true || (magic ?? 0) > 0 || !mundaneChoice;
  if (magical && magic !== undefined) lines.push(`Magic: ${Math.max(0, Math.round(magic))}`);

  // Reaction and initiative only when ware or powers change them.
  const reactionBonus = Math.round(bonus(cyberB, 'Reaction') + bonus(magB, 'Reaction'));
  const baseDice = isRec(attrs) ? num(field(attrs, 'Initative', 'Initiative')) : undefined;
  const dice = Math.max(1, Math.round((baseDice ?? 1) + bonus(cyberB, 'Initative') + bonus(cyberB, 'Initiative') + bonus(magB, 'Initative') + bonus(magB, 'Initiative')));
  if ((reactionBonus || dice > 1) && natural.Quickness !== undefined && natural.Intelligence !== undefined) {
    const nat = Math.floor((natural.Quickness + natural.Intelligence) / 2);
    const aug = nat + reactionBonus;
    lines.push(aug !== nat ? `Reaction: ${nat} (${aug})` : `Reaction: ${nat}`);
    lines.push(`Initiative: ${aug} + ${dice}D6`);
  }

  // ---- Magic
  if (magical) {
    const tradRaw = field(d, 'magicalTradition');
    const tradName = clean(typeof tradRaw === 'string' ? tradRaw : field(tradRaw, 'name'), 60);
    let tradition = '';
    if (/shamanist|elementalist|sorcer|conjur/i.test(choice)) tradition = choice;
    else if (/adept/i.test(choice)) tradition = 'Adept';
    else tradition = tradName || (mundaneChoice ? '' : choice);
    if (tradition) lines.push(`Tradition: ${tradition}`);
    const totemRaw = field(d, 'magicalTotem', 'totem');
    const totem = clean(typeof totemRaw === 'string' ? totemRaw : field(totemRaw, 'name'), 60);
    if (totem) lines.push(`Totem: ${totem}`);
    const grade = num(field(d, 'initiateGrade', 'initiationGrade', 'grade'));
    if (grade !== undefined && grade > 0) lines.push(`Initiation: ${Math.round(grade)}`);
  }

  // ---- Skills
  const nativeName = clean(field(d, 'nativeLanguage'), MAX_NAME).toLowerCase();
  let skillsSkipped = 0;
  for (const s of list(field(d, 'skills'))) {
    if (!isRec(s)) {
      skillsSkipped++;
      continue;
    }
    let sname = entryName(field(s, 'name', 'Name'));
    const rating = num(field(s, 'rating', 'Rating'));
    if (!sname || rating === undefined) {
      skillsSkipped++;
      continue;
    }
    const r = Math.max(0, Math.round(rating));
    const type = str(field(s, 'type', 'category')).toLowerCase();
    const ch = skillChoice(s);
    const isLanguage = /language/.test(type) || /^language$/i.test(sname);
    if (isLanguage) {
      if (/^language$/i.test(sname) && ch.conc) sname = entryName(ch.conc);
      const native = field(s, 'native') === true || field(s, 'isNative') === true || (nativeName !== '' && nativeName === sname.toLowerCase());
      sec.language.push(`${sname} ${r}${native ? ' (native)' : ''}`);
      continue;
    }
    let entry = `${sname} ${r}`;
    const conc = ch.conc ? entryName(ch.conc) : '';
    const spec = ch.spec ? entryName(ch.spec) : '';
    // SR2: a concentration takes the skill down 1 and is 1 above it; a specialization takes it down 2 and is 2 above.
    if (spec) entry = `${sname} ${Math.max(0, r - 2)} (${spec} ${r + 2})`;
    else if (conc) entry = `${sname} ${Math.max(0, r - 1)} (${conc} ${r + 1})`;
    if (spec && conc) warn(tx('SR2E.Import.Nullsheen.skillConcentrationDropped', { skill: sname, concentration: conc, specialization: spec }));
    if (ch.extra.length) warn(tx('SR2E.Import.Nullsheen.skillExtraChoices', { skill: sname, list: ch.extra.map((x) => entryName(x)).join(', ') }));
    if (/\bB\/R$/i.test(sname) || /build|repair/.test(type)) sec.buildRepair.push(entry);
    else if (/knowledge/.test(type)) sec.knowledge.push(entry);
    else sec.skills.push(entry);
  }
  if (skillsSkipped) warn(tx('SR2E.Import.Nullsheen.skillsSkipped', { count: skillsSkipped }));

  // ---- Cyberware and bioware
  const gradeOf = (v: unknown, n: string): string => {
    const g = str(v).toLowerCase();
    if (!g || /^(?:standard|normal|basic|-)$/.test(g)) return '';
    const m = /alpha|beta|delta/.exec(g);
    if (m) return m[0];
    if (/cultured/.test(g)) return 'cultured';
    warn(tx('SR2E.Import.Nullsheen.gradeUnknown', { name: n, grade: clean(v, 40) }));
    return '';
  };
  for (const c of list(field(d, 'cyberware'))) {
    const n = entryName(field(c, 'Name', 'name'));
    if (!n) continue;
    const toks: string[] = [];
    const e = num(field(c, 'EssCost', 'Essence', 'essCost', 'essence'));
    if (e !== undefined) toks.push(`Essence ${fmt(Math.max(0, e))}`);
    const g = gradeOf(field(c, 'Grade', 'grade'), n);
    if (g && g !== 'cultured') toks.push(g);
    const mods = entryName(field(c, 'Mods', 'mods'));
    if (mods) toks.push(mods);
    const rating = num(field(c, 'Level', 'Rating', 'level', 'rating'));
    const rt = rating !== undefined && rating > 0 && !/\d$/.test(n) ? ` ${Math.round(rating)}` : '';
    sec.cyber.push(withDetails(`${n}${rt}`, toks));
    const note = clean(field(c, 'Notes', 'notes'), 400);
    if (note) notes.push(`${n} - ${note}`);
  }
  if (noEssence.length) warn(tx('SR2E.Import.Nullsheen.essenceMissing', { list: noEssence.join(', ') }));
  for (const b of list(field(d, 'bioware'))) {
    const n = entryName(field(b, 'Name', 'name'));
    if (!n) continue;
    const toks: string[] = [];
    const bi = num(field(b, 'BioIndex', 'BodyIndex', 'bioIndex', 'EssCost'));
    if (bi !== undefined) toks.push(`BI ${fmt(Math.max(0, bi))}`);
    const g = gradeOf(field(b, 'Grade', 'grade'), n);
    if (g === 'cultured') toks.push('cultured');
    const rating = num(field(b, 'Level', 'Rating', 'level', 'rating'));
    const rt = rating !== undefined && rating > 0 && !/\d$/.test(n) ? ` ${Math.round(rating)}` : '';
    sec.bio.push(withDetails(`${n}${rt}`, toks));
    const note = clean(field(b, 'Notes', 'notes'), 400);
    if (note) notes.push(`${n} - ${note}`);
  }

  // ---- Spells
  for (const s of list(field(d, 'spells'))) {
    const n = entryName(field(s, 'Name', 'name'));
    if (!n) continue;
    const force = num(field(s, 'Rating', 'Force', 'force', 'rating'));
    const toks: string[] = [];
    const drainRaw = field(s, 'Drain', 'drain');
    const drain = drainOf(drainRaw);
    if (drain) toks.push(drain);
    else if (str(drainRaw)) warn(tx('SR2E.Import.Nullsheen.drainUnread', { name: n, drain: clean(drainRaw, 40) }));
    if (field(s, 'Exclusive', 'exclusive') === true) toks.push('Exclusive');
    if (field(s, 'Fetish', 'fetish') === true) toks.push('Fetish');
    const ft = force !== undefined && force > 0 && !/\d$/.test(n) ? ` ${Math.round(force)}` : '';
    sec.spells.push(withDetails(`${n}${ft}`, toks));
  }

  // ---- Adept powers
  for (const p of list(field(d, 'powers'))) {
    const n = entryName(field(p, 'Name', 'name'));
    if (!n) continue;
    const level = num(field(p, 'Level', 'Rating', 'level', 'rating'));
    const hasLevels = field(p, 'HasLevels', 'hasLevels') === true;
    const opt = entryName(field(p, 'Mods', 'Notes', 'mods', 'notes'), { dashes: false });
    const lv = level !== undefined && level > 0 && (hasLevels || level > 1) ? ` ${Math.round(level)}` : '';
    sec.powers.push(`${n}${opt ? ` (${opt})` : ''}${lv}`);
  }

  // ---- Weapons, gear, armor, foci, lifestyle
  let lifestyle = '';
  const gearOf = (g: unknown, fromWeapons: boolean) => {
    const n = entryName(field(g, 'Name', 'name'));
    if (!n) return;
    const amount = Math.max(1, Math.min(10000, Math.round(num(field(g, 'Amount', 'amount', 'quantity')) ?? 1)));
    const type = str(field(g, 'Type', 'type', 'Category'));
    const note = clean(field(g, 'Notes', 'notes'), 400);
    if (note) notes.push(`${n} - ${note}`);
    if (!fromWeapons && (/lifestyle/i.test(type) || /lifestyle/i.test(n))) {
      if (lifestyle) warn(tx('SR2E.Import.Nullsheen.lifestyleExtra', { name: n }));
      else lifestyle = `${n.replace(/\s*lifestyle\s*/i, ' ').trim() || n} (${amount} months)`;
      return;
    }
    const w = weaponEntry(g, n, amount);
    if (w) {
      sec.gear.push(w);
      return;
    }
    if (fromWeapons) warn(tx('SR2E.Import.Nullsheen.weaponNoDamage', { name: n }));
    const bal = num(field(g, 'Ballistic', 'ballistic'));
    const imp = num(field(g, 'Impact', 'impact'));
    const qty = amount > 1 ? `${amount}x ` : '';
    if ((bal !== undefined || imp !== undefined) && ((bal ?? 0) > 0 || (imp ?? 0) > 0 || /armou?r/i.test(type))) {
      sec.armor.push(`${qty}${n} ${Math.round(bal ?? 0)}/${Math.round(imp ?? 0)}`);
      return;
    }
    const rating = num(field(g, 'Rating', 'Force', 'rating', 'force', 'Level'));
    const rt = rating !== undefined && rating > 0 ? ` Rating ${Math.round(rating)}` : '';
    if (/\bfoc(?:us|i)\b/i.test(`${n} ${type}`)) {
      sec.foci.push(`${n}${rt}`);
      return;
    }
    sec.gear.push(`${qty}${n}${rt}`);
  };
  for (const w of list(field(d, 'weapons'))) gearOf(w, true);
  for (const g of list(field(d, 'gear'))) gearOf(g, false);
  for (const f of list(field(d, 'foci'))) {
    const n = entryName(field(f, 'Name', 'name'));
    if (!n) continue;
    const rating = num(field(f, 'Rating', 'Force', 'Level', 'rating', 'force', 'level'));
    const fname = /\bfoc(?:us|i)\b/i.test(n) ? n : `${n} focus`;
    sec.foci.push(rating !== undefined && rating > 0 ? `${fname} Rating ${Math.round(rating)}` : fname);
  }

  // ---- Contacts
  for (const c of list(field(d, 'contacts'))) {
    const n = entryName(field(c, 'Name', 'name'), { dashes: false });
    if (!n) continue;
    const role = entryName(field(c, 'Archtype', 'Archetype', 'archetype', 'role'), { dashes: false }).replace(/\//g, ' ');
    const level = num(field(c, 'Level', 'level'));
    const loyalty = num(field(c, 'Loyalty', 'loyalty'));
    const info = clean(field(c, 'GeneralInfo', 'Notes', 'notes'), 400).replace(/[()[\]{}]/g, ' ').replace(/\s+/g, ' ').trim();
    const parts = [role, `level ${Math.max(1, Math.round(level ?? 1))}`, loyalty !== undefined ? `loyalty ${Math.round(loyalty)}` : '', info].filter(Boolean);
    sec.contacts.push(`${n} (${parts.join(', ')})`);
  }

  // ---- Edges and flaws (SR3 files)
  const quality = (q: unknown, kind: 'edge' | 'flaw') => {
    const n = entryName(typeof q === 'string' ? q : field(q, 'name', 'Name'));
    if (!n) return;
    const pts = num(field(q, 'cost', 'Cost', 'points', 'value'));
    const p = pts !== undefined ? ` ${kind === 'edge' ? '+' : '-'}${Math.abs(Math.round(pts))}` : '';
    (kind === 'edge' ? sec.edges : sec.flaws).push(`${n}${p}`);
  };
  for (const q of list(field(d, 'edges'))) quality(q, 'edge');
  for (const q of list(field(d, 'flaws'))) quality(q, 'flaw');

  // ---- What the write-up can't carry
  const skipped: string[] = [];
  const skippedNames: string[] = [];
  const kinds: Array<[string, (count: number) => string]> = [
    ['vehicles', (count) => tx('SR2E.Import.Nullsheen.countVehicles', { count })],
    ['drones', (count) => tx('SR2E.Import.Nullsheen.countDrones', { count })],
    ['decks', (count) => tx('SR2E.Import.Nullsheen.countDecks', { count })],
    ['complexForms', (count) => tx('SR2E.Import.Nullsheen.countComplexForms', { count })],
    ['mods', (count) => tx('SR2E.Import.Nullsheen.countMods', { count })],
    ['inventory', (count) => tx('SR2E.Import.Nullsheen.countInventory', { count })],
  ];
  for (const [f, count] of kinds) {
    const items = list(field(d, f));
    if (!items.length) continue;
    skipped.push(count(items.length));
    for (const it of items) {
      const n = clean(typeof it === 'string' ? it : field(it, 'Name', 'name'), MAX_NAME);
      if (n) skippedNames.push(n);
    }
  }
  if (skipped.length) {
    warn(tx('SR2E.Import.Nullsheen.notImported', { list: skipped.join(', ') }));
    if (skippedNames.length) notes.push(tx('SR2E.Import.Nullsheen.notesNotImported', { list: skippedNames.slice(0, 100).join(', ') }));
  }

  // ---- Write the sections
  // An entry that starts like an attribute line ("Magic 8 Ball") would be read as one at the start of a line: it goes
  // after another entry on the same line (or on the label's line when the list has nothing else).
  const section = (label: string, entries: string[]) => {
    if (!entries.length) return;
    const safe = entries.filter((e) => !ATTR_START.test(e));
    const risky = entries.filter((e) => ATTR_START.test(e));
    if (!safe.length) {
      lines.push('', `${label}: ${risky.join(', ')}`);
      return;
    }
    const out = [...safe];
    out[0] = [out[0], ...risky].join(', ');
    lines.push('', `${label}:`, ...out);
  };
  section('Skills', sec.skills);
  section('Knowledge', sec.knowledge);
  section('Languages', sec.language);
  section('B/R', sec.buildRepair);
  section('Cyberware', sec.cyber);
  section('Bioware', sec.bio);
  section('Spells', sec.spells);
  section('Powers', sec.powers);
  section('Gear', sec.gear);
  section('Armor', sec.armor);
  section('Foci', sec.foci);
  section('Contacts', sec.contacts);
  section('Edges', sec.edges);
  section('Flaws', sec.flaws);
  lines.push('');

  // ---- Money, Karma, lifestyle
  const cash = num(field(d, 'cash'));
  const start = num(field(d, 'chargenCash'));
  const spent = num(field(d, 'cashSpent'));
  if (cash !== undefined || start !== undefined) {
    const left = start !== undefined ? Math.max(0, start - (spent ?? 0)) : 0;
    const nuyen = Math.max(0, Math.round(left + (cash ?? 0)));
    lines.push(`Nuyen: ${nuyen}`);
    if (start !== undefined) warn(tx('SR2E.Import.Nullsheen.nuyenWorkedOut', { start: Math.round(start), spent: Math.round(spent ?? 0), cash: Math.round(cash ?? 0), nuyen }));
  }
  const karma = num(field(d, 'karma'));
  const karmaSpent = num(field(d, 'karmaSpent'));
  const pool = num(field(d, 'karmaPool'));
  if (karma !== undefined || pool !== undefined) {
    const total = Math.max(0, Math.round(karma ?? 0));
    const good = Math.max(0, total - Math.max(0, Math.round(karmaSpent ?? 0)));
    const extra = [`total ${total}`, ...(pool !== undefined ? [`pool ${Math.max(0, Math.round(pool))}`] : [])];
    lines.push(`Karma: ${good} (${extra.join(', ')})`);
  }
  if (lifestyle) lines.push(`Lifestyle: ${lifestyle}`);

  // ---- Text
  const age = clean(field(d, 'age'), 40);
  if (age) lines.push(`Age: ${age}`);
  for (const [f, label] of [['sex', 'Sex'], ['gender', 'Gender'], ['height', 'Height'], ['weight', 'Weight'], ['hair', 'Hair'], ['eyes', 'Eyes'], ['skin', 'Skin']] as const) {
    const v = clean(field(d, f), 100);
    if (v) lines.push(`${label}: ${v}`);
  }
  const desc = clean(field(d, 'description'));
  if (desc) lines.push(`Background: ${desc}`);
  const pr = field(d, 'priorities');
  if (isRec(pr)) {
    const parts = Object.keys(pr).slice(0, 10).map((k) => `${clean(k, 20)} ${clean(pr[k], 5)}`.trim()).filter((x) => /\S\s\S/.test(x));
    if (parts.length) notes.unshift(tx('SR2E.Import.Nullsheen.notesPriorities', { list: parts.join(', ') }));
  }
  const ownNotes = clean(field(d, 'notes'));
  if (ownNotes) lines.push(`Notes: ${ownNotes}`);
  if (notes.length) lines.push(`Notes: ${clean(notes.join(' / '))}`);

  let text = lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  if (text.length > MAX_OUT) {
    text = text.slice(0, MAX_OUT);
    warn(tx('SR2E.Import.Nullsheen.textCut', { max: MAX_OUT }));
  }
  return result(text, name, key, edition);
}
