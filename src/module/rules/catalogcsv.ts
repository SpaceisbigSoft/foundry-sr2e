import { RULES } from './config.ts';
import { FOCUS_TYPES, SPELL_DURATIONS } from './arcana.ts';
import { POWER_DICE_SOURCES, POWER_TN_SOURCES, POWER_RESIST } from './powers.ts';
import { ADEPT_SPECIALS, ALLERGY_SEVERITIES, POWER_SPECIALS } from './critters.ts';
import { MATERIAL_KINDS } from './thaumaturgy.ts';
import { UTILITY_KINDS } from './matrix.ts';
import type { ItemTemplate } from './items.ts';
import { own } from './util.ts';
import { KIT_STATE_FIELDS } from './setup.ts';

// ===================================================================== Catalogue tools (v0.66.0)
/*
 * The GM's catalogue tools: paste rows copied from a spreadsheet (CSV, or tab-separated as Excel and
 * Google Sheets copy them) to make many world item templates at once, export templates back to CSV,
 * and move the whole catalogue (templates and starter kits) between worlds as JSON.
 *
 * The system ships no book data: every entry here is the user's own. Nothing in this file knows any
 * real item's statistics; it only knows the item data models' field names.
 */

// ---------------------------------------------------------------- Delimited text

type Delimiter = ',' | '\t' | ';';

interface DelimitedRecord { cells: string[]; row: number }

/** Count the delimiter candidates on the first line (outside quotes) and pick one: tab first, then comma or semicolon. */
function detectDelimiter(text: string): Delimiter {
  let inQuote = false;
  const count = { ',': 0, '\t': 0, ';': 0 };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (ch === '"') inQuote = !inQuote;
    else if (!inQuote && (ch === '\n' || ch === '\r')) break;
    else if (!inQuote && (ch === ',' || ch === '\t' || ch === ';')) count[ch]++;
  }
  if (count['\t'] > 0) return '\t';
  return count[';'] > count[','] ? ';' : ',';
}

/**
 * Split delimited text into records, each with its 1-based spreadsheet row (empty rows still count). `onUnclosed`
 * gets the row where a quote opened and never closed (v0.81.0, RC-16: it swallows every row after it).
 * Quoted fields use "" for a quote inside one and may hold line breaks; CRLF or LF line ends; cells are trimmed and
 * rows with nothing in them are dropped. v0.81.1 (RC2-9): a cell `templatesToCsv` guarded against formulas
 * ('=…, '+…, '-…, '@…) loses that one leading quote.
 */
function parseRecords(input: string, delimiter: Delimiter, onUnclosed?: (row: number) => void): DelimitedRecord[] {
  const text = input.replace(/^﻿/, '');
  const out: DelimitedRecord[] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false; // inside a quoted section
  let rowNumber = 1;
  let quoteRow = 0;
  const endCell = () => { const c = cell.trim(); row.push(/^'[=+\-@]/.test(c) ? c.slice(1) : c); cell = ''; };
  const endRow = () => { endCell(); out.push({ cells: row, row: rowNumber }); rowNumber++; row = []; };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; } else quoted = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"' && cell.trim() === '') { cell = ''; quoted = true; quoteRow = rowNumber; continue; }
    if (ch === delimiter) { endCell(); continue; }
    if (ch === '\r') { if (text[i + 1] === '\n') i++; endRow(); continue; }
    if (ch === '\n') { endRow(); continue; }
    cell += ch;
  }
  if (quoted) onUnclosed?.(quoteRow);
  if (cell !== '' || row.length > 0) endRow();
  return out.filter((r) => r.cells.some((c) => c !== ''));
}


// ---------------------------------------------------------------- Column vocabulary

/** The item types the catalogue tools handle. */
export const CATALOGUE_TYPES = ['skill', 'weapon', 'armor', 'gear', 'cyberware', 'spell', 'power', 'focus', 'adeptpower', 'cyberdeck', 'program'] as const;
export type CatalogueType = (typeof CATALOGUE_TYPES)[number];

/** One spreadsheet column an item type understands. */
export interface CatalogueColumn {
  /** Where it goes in the item's system data (dotted for nested fields). */
  path: string;
  /** Other headers that mean this column (matched ignoring case, spaces and punctuation). */
  aliases: string[];
  kind: 'number' | 'integer' | 'boolean' | 'string' | 'choice';
  /** The allowed values of a choice column. */
  choices?: string[];
  /** Other words accepted for a choice (word → value). */
  synonyms?: Record<string, string>;
  min?: number;
  max?: number;
  /** A plain-English line for the help panel. */
  help: string;
}

type Col = CatalogueColumn;
type Extra = Partial<Pick<Col, 'min' | 'max' | 'synonyms'>>;
const num = (path: string, aliases: string[], help: string, o: Extra = {}): Col => ({ path, aliases, kind: 'number', help, ...o });
const int = (path: string, aliases: string[], help: string, o: Extra = {}): Col => ({ path, aliases, kind: 'integer', help, ...o });
const bool = (path: string, aliases: string[], help: string): Col => ({ path, aliases, kind: 'boolean', help });
const str = (path: string, aliases: string[], help: string): Col => ({ path, aliases, kind: 'string', help });
type Live<T> = T | (() => T);
/**
 * A choice column. v0.81.0 (RC-8): choices and synonyms may be a function, read each time they are used, so a list
 * from RULES (ammo, toxins, legality...) follows the house rules instead of the values at module load.
 */
const choice = (path: string, choices: Live<readonly string[]>, aliases: string[], help: string, synonyms?: Live<Record<string, string>>): Col => {
  const col: Col = { path, aliases, kind: 'choice', help };
  Object.defineProperty(col, 'choices', { enumerable: true, get: () => [...(typeof choices === 'function' ? choices() : choices)] });
  if (synonyms) Object.defineProperty(col, 'synonyms', { enumerable: true, get: () => (typeof synonyms === 'function' ? synonyms() : synonyms) });
  return col;
};

const ATTRS = ['body', 'quickness', 'strength', 'charisma', 'intelligence', 'willpower'] as const;
const LEVELS = ['L', 'M', 'S', 'D'];
const LEVEL_WORDS: Record<string, string> = { light: 'L', moderate: 'M', serious: 'S', deadly: 'D' };
const DAMAGE_TYPES = ['physical', 'stun'];
const R: any = RULES;
const ids = (list: any, blank = false): string[] => {
  const xs = (Array.isArray(list) ? list : []).map((x: any) => String(typeof x === 'object' && x ? x.id : x));
  return blank && !xs.includes('') ? ['', ...xs] : xs;
};
const LEGALITY = (): string[] => ids(R.GEAR_V58?.legality?.categories);
const LEGALITY_WORDS = (): Record<string, string> => Object.fromEntries(
  (R.GEAR_V58?.legality?.categories ?? []).map((c: any) => [norm(String(c.label ?? '')), String(c.id)]).filter(([k]: [string]) => k),
);

const attributeBonuses = (prefix: string, what: string): Col[] => ATTRS.map((k) =>
  int(`${prefix}${k}`, [k, k.slice(0, 3), `${k}bonus`], `${what} ${k[0]!.toUpperCase()}${k.slice(1)}.`));

const description = (aliases = ['desc', 'notes', 'note', 'text']): Col => str('description', aliases, 'Description shown on the item (plain text is fine).');

/** Cost, Availability, Street Index and legality, as the weapon, armor, gear and cyberware models have them. */
const buying = (): Col[] => [
  int('cost', ['price', 'nuyen', 'yen', 'costnuyen', 'pricenuyen'], 'Cost in nuyen (¥ signs and thousands separators are fine).', { min: 0 }),
  str('availability', ['avail', 'availability', 'availabilitytn'], 'Availability as text, e.g. "6/14 days".'),
  num('streetIndex', ['streetindex', 'si', 'index', 'street'], 'Street Index (multiplies the cost).', { min: 0 }),
  choice('legality', LEGALITY, ['legal', 'law', 'legalstatus'], 'Legality category.', LEGALITY_WORDS),
  bool('permit', ['haspermit', 'permitheld'], 'A permit is held for it.'),
];

const carried = (): Col[] => [
  num('weight', ['wt', 'mass', 'kg'], 'Weight in kilograms.', { min: 0 }),
  int('concealability', ['conceal', 'conc', 'cnc', 'concealment'], 'Concealability (0 = can\'t be hidden).', { min: 0 }),
  num('cf', ['cargofactor', 'cargo'], 'Bulk in Cargo Factor units.', { min: 0 }),
];

/**
 * Every column each item type understands, by hand from the item data models (the common, useful
 * fields). Headers match the path, its last part, or an alias, ignoring case, spaces and punctuation.
 */
export const CATALOGUE_COLUMNS: Record<CatalogueType, CatalogueColumn[]> = {
  skill: [
    int('rating', ['rank', 'level', 'skillrating'], 'Skill rating.', { min: 0 }),
    choice('attribute', [...ATTRS, 'reaction'], ['attr', 'linkedattribute', 'linked'], 'Linked attribute.'),
    choice('kind', ['active', 'knowledge', 'language', 'buildRepair'], ['skillkind', 'skilltype', 'category'], 'Active, knowledge, language or build/repair.',
      { br: 'buildRepair', buildandrepair: 'buildRepair', know: 'knowledge', lang: 'language' }),
    str('specialization', ['spec', 'specialisation'], 'Specialization name.'),
    int('specializationRating', ['specrating', 'specialisationrating'], 'Specialization rating (0 = none).', { min: 0 }),
    str('concentration', ['conc'], 'Concentration name.'),
    int('concentrationRating', ['concrating'], 'Concentration rating (0 = none).', { min: 0 }),
    bool('native', ['nativelanguage', 'mothertongue'], 'A native language.'),
    description(),
  ],
  weapon: [
    str('skill', ['weaponskill', 'attackskill'], 'Skill used to attack, matched by name.'),
    str('specialization', ['spec', 'specialisation'], 'Specialization it falls under.'),
    bool('melee', ['meleeweapon', 'handtohand'], 'A melee weapon.'),
    int('damagePower', ['power', 'dmgpower', 'pow'], 'Power, or the bonus added to Strength for a Strength weapon.'),
    choice('damageLevel', LEVELS, ['level', 'dmglevel', 'woundlevel', 'wound'], 'Damage level: L, M, S or D.', LEVEL_WORDS),
    choice('damageType', DAMAGE_TYPES, ['dmgtype'], 'Physical or stun damage.'),
    bool('strengthPower', ['strpower', 'powerfromstrength', 'strengthbased', 'strbased'], 'Power is Strength plus the Power column.'),
    int('strengthCap', ['strcap', 'maxstr', 'maxstrength'], 'Bows: highest Strength it can use (0 = no cap).', { min: 0 }),
    int('range.short', ['short', 'shortrange'], 'Short range limit in metres.', { min: 0 }),
    int('range.medium', ['medium', 'mediumrange', 'med'], 'Medium range limit in metres.', { min: 0 }),
    int('range.long', ['long', 'longrange'], 'Long range limit in metres.', { min: 0 }),
    int('range.extreme', ['extreme', 'extremerange', 'ext'], 'Extreme range limit in metres.', { min: 0 }),
    bool('strengthRange', ['thrown', 'strrange', 'rangefromstrength'], 'Ranges are multiples of Strength (thrown weapons, bows).'),
    num('minRange', ['minimumrange', 'armingrange'], 'Minimum arming range in metres.', { min: 0 }),
    int('reach', ['rch'], 'Melee reach.', { min: 0 }),
    int('ammoMax', ['capacity', 'clip', 'magazine', 'mag', 'ammocapacity', 'clipsize'], 'Magazine capacity (0 = ammo not tracked).', { min: 0 }),
    int('ammo', ['loaded', 'roundsloaded', 'currentammo'], 'Rounds loaded now (header "Loaded": an "Ammo" header is the capacity shorthand).', { min: 0 }),
    choice('feed', ['clip', 'belt', 'cylinder', 'internal', 'break'], ['feedtype', 'loading'], 'How it is loaded.',
      { c: 'clip', b: 'belt', cy: 'cylinder', m: 'internal', magazine: 'internal', internalmagazine: 'internal', bk: 'break', breakaction: 'break' }),
    choice('ammoType', () => ids(R.COMBAT?.ammo), ['ammunitiontype', 'loadedammo'], 'Kind of round loaded.'),
    str('modes', ['mode', 'firingmodes', 'firingmode', 'fire'], 'Firing modes, e.g. "SA/BF".'),
    int('recoilComp', ['rc', 'recoil', 'recoilcompensation'], 'Recoil compensation.', { min: 0 }),
    bool('smartgun', ['smart', 'smartlink', 'smartgunlink'], 'Smartgun-equipped.'),
    bool('heavy', ['heavyweapon'], 'A heavy weapon (recoil multiplied).'),
    int('gyro', ['gyromount', 'gyrorating'], 'Gyro mount rating.', { min: 0 }),
    bool('laserSight', ['laser'], 'Laser sight fitted.'),
    int('scope', ['scopemagnification', 'magnification'], 'Scope magnification (0–3).', { min: 0, max: 3 }),
    choice('scopeVision', ['', 'lowLight', 'thermographic'], ['scopemode'], 'The scope\'s vision mode.', { ll: 'lowLight', thermo: 'thermographic', thermal: 'thermographic' }),
    bool('shockPad', ['shock'], 'Shock pad fitted.'),
    choice('support', ['none', 'bipod', 'tripod'], ['mountsupport'], 'Bipod or tripod.'),
    choice('muzzle', ['', 'silencer', 'suppressor'], ['muzzledevice'], 'Silencer or sound suppressor.'),
    bool('blast', ['explosive', 'grenade', 'area'], 'An explosive or grenade (Power drops per metre).'),
    choice('blastKind', () => ids(R.COMBAT?.grenades), ['grenadetype', 'grenadekind', 'blasttype'], 'Kind of grenade or explosive.'),
    num('blastPerMetre', ['falloff', 'permetre', 'permeter', 'powerpermetre', 'blastfalloff'], 'Power lost per metre from the blast point.', { min: 0 }),
    choice('fuse', ['', 'impact', 'airburst'], ['fusetype'], 'Grenade fuse.'),
    bool('smartGrenade', ['smartguidance'], 'Smart grenade guidance.'),
    bool('shotgun', ['shot'], 'A shotgun.'),
    int('choke', ['chokesetting'], 'Shotgun choke.', { min: 1 }),
    choice('areaKind', ['', 'flame'], ['areaeffect'], 'Flamethrower.', { flamethrower: 'flame' }),
    int('guidance', ['missileintelligence', 'intelligence'], 'A missile\'s Intelligence.', { min: 0 }),
    bool('stunWeapon', ['taser', 'stunbaton', 'stun'], 'A stun weapon (half impact armor).'),
    bool('antiVehicle', ['av', 'antivehicleweapon'], 'An anti-vehicle weapon.'),
    choice('armorKind', ['auto', 'ballistic', 'impact'], ['armortype', 'vsarmor'], 'Which armor stops it.'),
    bool('magical', ['magic', 'enchanted'], 'A magical weapon.'),
    str('material', ['madeof'], 'What it is made of or loaded with (silver, wood...).'),
    choice('mount', () => ids(R.VEHICLES?.mounts), ['vehiclemount', 'mounting'], 'How it is mounted on a vehicle.'),
    bool('selfHit', ['canhitwielder'], 'It can hit its wielder.'),
    ...carried(),
    ...buying(),
    description(),
  ],
  armor: [
    int('ballistic', ['bal', 'ballisticrating', 'b'], 'Ballistic rating.', { min: 0 }),
    int('impact', ['imp', 'impactrating', 'i'], 'Impact rating.', { min: 0 }),
    bool('adds', ['stacks', 'addstootherarmor', 'additive'], 'Adds to other armor (helmets, shields, form-fitting).'),
    int('parry', ['parryrating'], 'A shield\'s Parry rating.', { min: 0 }),
    bool('worn', ['wearing'], 'Worn when added.'),
    ...carried(),
    ...buying(),
    description(),
  ],
  gear: [
    int('quantity', ['qty', 'count', 'amount', 'number'], 'How many.', { min: 0 }),
    ...carried(),
    ...buying(),
    choice('material', [...MATERIAL_KINDS], ['enchantingmaterial', 'materials'], 'Enchanting material: raw, refined, radical or fetish.'),
    choice('ammoType', () => ['', ...ids(R.COMBAT?.ammo)], ['ammunitiontype', 'ammo', 'ammunition'], 'Ammunition: the kind of round.'),
    int('rounds', ['roundsperclip', 'roundcount'], 'Ammunition: rounds per clip (0 = fills the weapon).', { min: 0 }),
    int('medkitRating', ['medkit'], 'A medkit\'s rating.', { min: 0 }),
    int('rcdRating', ['rcd', 'remotecontroldeck'], 'A remote control deck\'s rating.', { min: 0 }),
    int('signal', ['signalrating'], 'A remote control deck\'s signal rating.', { min: 0 }),
    int('jammer', ['jammerrating'], 'A jammer\'s rating.', { min: 0 }),
    int('suite', ['programmingsuite'], 'A programming suite\'s rating.', { min: 0 }),
    choice('patch.kind', () => ids(R.PATCHES?.kinds, true), ['patch', 'patchkind', 'slappatch'], 'A slap patch: stim, tranq, trauma or antidote.'),
    int('patch.rating', ['patchrating'], 'The patch\'s rating.', { min: 0 }),
    choice('scanner.kind', () => ids(R.GEAR?.scannerKinds, true), ['scanner', 'scannerkind', 'detector'], 'A scanner: weapon, cyber or explosive.', { cyberware: 'cyber' }),
    int('scanner.rating', ['scannerrating'], 'The scanner\'s rating.', { min: 0 }),
    choice('chip.kind', () => ids(R.CYBERWARE?.skillsofts?.kinds, true), ['chip', 'chipkind', 'skillsoft'], 'A skillsoft: activesoft, knowsoft or linguasoft.'),
    str('chip.skill', ['chipskill', 'softskill'], 'The skillsoft\'s skill.'),
    int('chip.rating', ['chiprating', 'softrating'], 'The skillsoft\'s rating.', { min: 0 }),
    int('explosive.power', ['explosivepower', 'chargepower'], 'An explosive: Power per charge (0 = not one).', { min: 0 }),
    num('explosive.perMetre', ['explosivefalloff', 'explosivepermetre'], 'An explosive: Power lost per metre.', { min: 0 }),
    bool('explosive.shaped', ['shaped', 'shapedcharge'], 'A shaped charge.'),
    choice('toxin.kind', () => ids(R.TOXINS?.kinds, true), ['toxin', 'toxinkind', 'drug'], 'A toxin, drug or disease.'),
    choice('toxin.vector', () => ids(R.TOXINS?.vectors), ['vector'], 'How the toxin gets in.'),
    int('toxin.power', ['toxinpower'], 'The toxin\'s Power.', { min: 0 }),
    choice('toxin.level', LEVELS, ['toxinlevel'], 'The toxin\'s damage level.', LEVEL_WORDS),
    choice('toxin.damageType', DAMAGE_TYPES, ['toxindamagetype'], 'The toxin\'s damage type.'),
    choice('toxin.speed', () => ids(R.TOXINS?.speeds), ['speed', 'toxinspeed'], 'How fast the toxin acts.'),
    int('toxin.addiction', ['addiction'], 'A drug\'s addiction rating.', { min: 0 }),
    choice('protection.kind', () => ids(R.HEALTH?.protection?.kinds, true), ['protection', 'protectionkind'], 'Protective gear against toxins.'),
    int('protection.rating', ['protectionrating'], 'The protection\'s rating.', { min: 0 }),
    int('radio.rating', ['radio', 'radiorating'], 'A radio\'s signal rating.', { min: 0 }),
    int('radio.encryption', ['encryption'], 'A radio\'s encryption rating.', { min: 0 }),
    bool('optics.lowLight', ['lowlight'], 'Vision gear: low-light.'),
    bool('optics.thermographic', ['thermographic', 'thermo'], 'Vision gear: thermographic.'),
    bool('optics.flareComp', ['flarecomp', 'flarecompensation'], 'Vision gear: flare compensation.'),
    int('optics.magnification', ['magnification', 'mag'], 'Vision gear: magnification (0–3).', { min: 0, max: 3 }),
    description(),
  ],
  cyberware: [
    num('essenceCost', ['essence', 'ess', 'essencecost', 'esscost'], 'Essence cost (standard grade).', { min: 0 }),
    choice('grade', () => Object.keys(R.GRADE_ESSENCE_MULTIPLIER ?? { standard: 1 }), ['cybergrade', 'waregrade'], 'Grade: standard, alpha, beta or delta.',
      { std: 'standard', alphaware: 'alpha', betaware: 'beta', deltaware: 'delta', normal: 'standard' }),
    choice('kind', () => ids(R.CYBERWARE?.kinds), ['cyberkind', 'warekind'], 'What it is (cyberlimb, datajack, skillwires...).'),
    int('rating', ['level', 'rtg'], 'Rating, where it has one.', { min: 0 }),
    bool('bioware', ['bio', 'isbioware'], 'Bioware (costs Body Index, not Essence).'),
    num('bodyIndex', ['bi', 'bodyindexcost'], 'Bioware: Body Index cost.', { min: 0 }),
    choice('bioKind', () => ids(R.BIOWARE?.kinds), ['biowarekind', 'biokind'], 'Bioware kind.'),
    bool('cultured', ['culturedbioware'], 'Cultured bioware.'),
    bool('installed', ['implanted'], 'Installed when added.'),
    ...attributeBonuses('attributes.', 'Bonus to'),
    int('reaction', ['rea', 'reactionbonus'], 'Bonus to Reaction.'),
    int('initiativeDice', ['initiative', 'init', 'initdice'], 'Extra initiative dice.', { min: 0 }),
    int('armorBallistic', ['ballistic', 'bal'], 'Ballistic armor while installed.', { min: 0 }),
    int('armorImpact', ['impact', 'imp'], 'Impact armor while installed.', { min: 0 }),
    choice('reflexes', () => ids(R.CYBERWARE?.reflexTypes, true), ['reflextype'], 'Reflex system type (wired and boosted don\'t stack).'),
    int('controlRig', ['vcr', 'controlriglevel', 'rig'], 'Vehicle control rig level.', { min: 0 }),
    bool('smartlink', ['smart'], 'A smartlink.'),
    int('smartlinkLevel', ['smartlinklevel'], 'Smartlink level (0–2).', { min: 0, max: 2 }),
    bool('lowLight', ['lowlightvision'], 'Low-light vision.'),
    bool('thermographic', ['thermo', 'thermographicvision'], 'Thermographic vision.'),
    bool('flareComp', ['flarecompensation'], 'Flare compensation.'),
    int('magnification', ['mag', 'opticalmagnification'], 'Magnification (0–3).', { min: 0, max: 3 }),
    bool('ultrasound', ['ultrasoundvision'], 'Ultrasound.'),
    int('hearingAmp', ['hearingamplification'], 'Hearing amplification (0–3).', { min: 0, max: 3 }),
    int('pheromones', ['pheromonerating'], 'Tailored pheromones rating.', { min: 0 }),
    choice('limb.location', () => ids(R.CYBERWARE?.limbs?.locations), ['limb', 'location', 'limblocation'], 'A cyberlimb: where it is.'),
    int('limb.strength', ['limbstrength', 'limbstr'], 'A cyberlimb\'s Strength.', { min: 0 }),
    int('limb.quickness', ['limbquickness', 'limbqui'], 'A cyberlimb\'s Quickness.', { min: 0 }),
    num('limb.capacity', ['capacity', 'limbcapacity'], 'A cyberlimb\'s capacity.', { min: 0 }),
    str('weapon.skill', ['weaponskill'], 'A cyberweapon\'s skill.'),
    int('weapon.damagePower', ['power', 'damagepower'], 'A cyberweapon\'s Power (or bonus to Strength).'),
    choice('weapon.damageLevel', LEVELS, ['damagelevel'], 'A cyberweapon\'s damage level.', LEVEL_WORDS),
    choice('weapon.damageType', DAMAGE_TYPES, ['damagetype'], 'A cyberweapon\'s damage type.'),
    bool('weapon.strengthPower', ['strpower', 'strengthbased'], 'A cyberweapon\'s Power is Strength plus Power.'),
    int('weapon.reach', ['reach'], 'A cyberweapon\'s reach.'),
    int('concealability', ['conceal', 'conc', 'cnc'], 'Concealability to the eye (0 = internal).', { min: 0 }),
    ...buying(),
    description(),
  ],
  spell: [
    choice('category', ['combat', 'detection', 'health', 'illusion', 'manipulation'], ['spellcategory', 'class'], 'Spell category.'),
    choice('spellType', ['mana', 'physical'], ['spelltype', 'mp', 'manaphysical'], 'Mana or physical.'),
    int('learnedForce', ['force', 'f', 'learnedforce', 'rating'], 'Force it is learned at.', { min: 1 }),
    choice('duration', [...SPELL_DURATIONS], ['dur'], 'Instant, sustained or permanent.'),
    choice('range', ['los', 'touch'], ['spellrange'], 'Line of sight or touch.', { lineofsight: 'los', t: 'touch' }),
    bool('area', ['areaeffect', 'aoe'], 'An area spell.'),
    int('drainModifier', ['drainmod', 'drainmodifier', 'drainbonus'], 'Drain TN modifier added to Force ÷ 2.'),
    choice('drainLevel', LEVELS, ['drainlevel'], 'Drain level.', LEVEL_WORDS),
    choice('damageLevel', LEVELS, ['damagelevel', 'level'], 'Combat spells: base damage level.', LEVEL_WORDS),
    choice('damageType', DAMAGE_TYPES, ['damagetype'], 'Combat spells: physical or stun.'),
    int('targetNumber', ['tn', 'target'], 'Non-combat spells: the TN.', { min: 2 }),
    choice('resist', ['none', ...ATTRS], ['resistedby', 'resistance', 'resistattribute'], 'Attribute an unwilling target resists with.'),
    bool('elemental', ['elementalmanipulation'], 'An elemental manipulation.'),
    str('element', ['elementtype'], 'The spell\'s element.'),
    bool('heals', ['healing'], 'A health spell that heals damage.'),
    choice('healTrack', DAMAGE_TYPES, ['healstrack'], 'Which track it heals.'),
    bool('exclusive', ['exclusivespell'], 'Exclusive (lower drain).'),
    bool('fetish', ['fetishlimited', 'fetishspell'], 'Fetish-limited (lower drain).'),
    bool('extendedRange', ['extended'], 'Detection spells: extended range.'),
    description(),
  ],
  power: [
    bool('active', ['activepower'], 'An active power (it is rolled).'),
    choice('dice', [...POWER_DICE_SOURCES], ['dicefrom', 'dicesource'], 'Where its dice come from.'),
    int('rating', ['level', 'rtg'], 'Rating (when its dice come from the rating).', { min: 0 }),
    choice('tnSource', [...POWER_TN_SOURCES], ['tnfrom', 'tnsource'], 'Fixed TN or the target\'s attribute.'),
    int('targetNumber', ['tn', 'target'], 'Fixed TN.', { min: 2 }),
    choice('resist', [...POWER_RESIST], ['resistedby', 'resistance'], 'Attribute the target resists with.'),
    choice('effect', ['effect', 'damage'], ['result'], 'Damage or just an effect.'),
    bool('area', ['areaeffect', 'aoe'], 'Several targets at once.'),
    bool('repeating', ['repeat'], 'Offered again (e.g. each turn).'),
    choice('damageLevel', LEVELS, ['damagelevel'], 'Damage level.', LEVEL_WORDS),
    choice('damageType', DAMAGE_TYPES, ['damagetype'], 'Physical or stun.'),
    bool('sustained', ['sustain'], 'Its effect lasts until dropped.'),
    choice('special', [...POWER_SPECIALS], ['specialeffect', 'builtin'], 'A built-in effect (allergy, regeneration...).'),
    str('substance', ['allergen', 'vulnerableto'], 'An allergy or vulnerability\'s substance.'),
    choice('severity', [...ALLERGY_SEVERITIES], ['allergyseverity'], 'An allergy\'s severity.'),
    str('notes', ['rangeduration', 'details'], 'Range, action type, duration: free text.'),
    description(['desc', 'text']),
  ],
  focus: [
    choice('focusType', [...FOCUS_TYPES], ['focustype', 'focuskind'], 'Spell, sustaining, spirit, power or weapon focus.'),
    int('rating', ['force', 'f', 'level'], 'Rating (Force).', { min: 0 }),
    bool('bonded', ['bond'], 'Bonded.'),
    bool('active', ['on'], 'Active.'),
    str('category', ['spellcategory'], 'Spell category it serves (empty = any).'),
    str('target', ['spell', 'spirit', 'for'], 'Specific spell, spirit or weapon (empty = any).'),
    // v0.91.1: a focus can be bought in the shop (cost, Availability, Street Index, legality).
    ...buying(),
    description(),
  ],
  adeptpower: [
    num('cost', ['pp', 'powerpoints', 'ppcost', 'pointcost', 'points'], 'Power point cost.', { min: 0 }),
    int('level', ['rating', 'levels'], 'Level bought.', { min: 0 }),
    bool('active', ['on'], 'Active.'),
    ...attributeBonuses('attributes.', 'Bonus to'),
    int('reaction', ['rea'], 'Bonus to Reaction.'),
    int('initiativeDice', ['initiative', 'init', 'initdice'], 'Extra initiative dice.', { min: 0 }),
    str('skill', ['improvedskill'], 'Skill it improves.'),
    int('skillDice', ['dice', 'skillbonus'], 'Dice added to that skill.'),
    int('ballistic', ['bal'], 'Ballistic armor.', { min: 0 }),
    int('impact', ['imp'], 'Impact armor.', { min: 0 }),
    choice('special', [...ADEPT_SPECIALS], ['specialeffect', 'builtin'], 'A built-in effect (killing hands, combat sense...).'),
    choice('sense', ['', 'lowLight', 'thermographic', 'ultrasound', 'hearing'], ['improvedsense'], 'Improved senses: the sense it gives.'),
    description(),
  ],
  cyberdeck: [
    int('mpcp', ['mpcprating'], 'MPCP rating.', { min: 0 }),
    int('bod', ['body'], 'Bod persona rating.', { min: 0 }),
    int('evasion', ['eva'], 'Evasion persona rating.', { min: 0 }),
    int('masking', ['mask'], 'Masking persona rating.', { min: 0 }),
    int('sensors', ['sensor', 'sens'], 'Sensors persona rating.', { min: 0 }),
    int('hardening', ['hard'], 'Hardening.', { min: 0 }),
    int('responseIncrease', ['response', 'ri'], 'Response increase.', { min: 0 }),
    int('activeMemory', ['active', 'activemem', 'am'], 'Active memory (Mp).', { min: 0 }),
    int('storageMemory', ['storage', 'storagemem', 'sm'], 'Storage memory (Mp).', { min: 0 }),
    int('ioSpeed', ['io', 'iospeed'], 'I/O speed.', { min: 0 }),
    int('loadSpeed', ['load'], 'Load speed (0 = its I/O speed).', { min: 0 }),
    int('signal', ['signalrating'], 'Wireless signal rating.', { min: 0 }),
    int('hitchers', ['hitcherjacks'], 'Hitcher jacks.', { min: 0 }),
    bool('tortoise', ['noasist'], 'A tortoise (no ASIST).'),
    bool('realityFilter', ['filter'], 'A reality filter.'),
    bool('living', ['livingpersona', 'otaku'], 'An otaku\'s living persona.'),
    int('cost', ['price', 'nuyen', 'yen', 'costnuyen'], 'What it cost in nuyen.', { min: 0 }),
    // v0.91.1: Availability, Street Index and legality, so a deck can be found in the shop (its cost is above).
    ...buying().filter((c) => c.path !== 'cost'),
    description(),
  ],
  program: [
    choice('kind', [...UTILITY_KINDS], ['utility', 'programkind', 'programtype'], 'Utility kind.'),
    int('rating', ['level', 'rtg'], 'Rating.', { min: 0 }),
    int('size', ['mp', 'memory', 'sizemp'], 'Memory in Mp.', { min: 0 }),
    choice('damageLevel', LEVELS, ['damagelevel'], 'Attack utilities: damage level.', LEVEL_WORDS),
    bool('complexForm', ['complex', 'otaku'], 'An otaku\'s complex form.'),
    bool('loaded', ['inmemory'], 'Loaded when added.'),
    // v0.91.1: a program can be bought in the shop.
    ...buying(),
    description(),
  ],
};

/** A shorthand column that fills several fields from one cell (e.g. "Damage" 9M). */
export interface CatalogueShorthand {
  name: string;
  aliases: string[];
  /** The fields it fills, for display. */
  fills: string;
  help: string;
  apply: (cell: string, set: (path: string, value: unknown) => void) => string | null;
}

/** "9M", "6S Stun", "(STR+2)M", "STR+1 L", "M": the parts of a damage code, or null if it isn't one. */
export function parseCatalogueDamage(text: string): { power: number | null; level: string; stun: boolean | null; strength: boolean } | null {
  // v0.81.1 (RC2-1, SEC2b-3): one space per run of blanks first, so the Strength pattern can't backtrack over a run.
  let t = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (!t) return null;
  const stun = /stun/i.test(t) ? true : /phys/i.test(t) ? false : null;
  t = t.replace(/\(?\s*\b(stun|physical|phys)\b\s*\)?/gi, ' ').trim();
  t = t.replace(/\b(light|moderate|serious|deadly)\b/gi, (w) => LEVEL_WORDS[w.toLowerCase()] ?? w);
  let m = /^\(?\s*str(?:ength)?\s*(?:([+-])\s*(\d+))?\s*\)?\s*([LMSD])$/i.exec(t);
  if (m) return { power: (m[1] === '-' ? -1 : 1) * Number(m[2] ?? 0), level: m[3]!.toUpperCase(), stun, strength: true };
  m = /^([+-]?\d+)\s*([LMSD])$/i.exec(t);
  if (m) return { power: Number(m[1]), level: m[2]!.toUpperCase(), stun, strength: false };
  m = /^([LMSD])$/i.exec(t);
  if (m) return { power: null, level: m[1]!.toUpperCase(), stun, strength: false };
  return null;
}

/** A spell's drain code ("[(F/2)+1]S", "(F/2)-1 M", "+2D", "S") as the modifier added to Force ÷ 2 and a level. */
export function parseCatalogueDrain(text: string): { modifier: number; level: string } | null {
  let t = String(text ?? '').trim().toUpperCase().replace(/\b(LIGHT|MODERATE|SERIOUS|DEADLY)\b/g, (w) => LEVEL_WORDS[w.toLowerCase()] ?? w).replace(/\s+/g, '');
  const lv = /([LMSD])$/.exec(t);
  if (!lv) return null;
  t = t.slice(0, -1).replace(/\(?F[/÷]2\)?/, '').replace(/[[\]()]/g, '');
  if (t === '') return { modifier: 0, level: lv[1]! };
  if (!/^[+-]?\d+$/.test(t)) return null;
  return { modifier: Number(t), level: lv[1]! };
}

/** Split "5/20/40/60" (or "0-5/6-20/...", taking the upper end of each) into whole numbers. */
function splitNumbers(text: string): number[] | null {
  const parts = String(text).trim().split(/\s*[/|]\s*|\s+/).filter(Boolean);
  const out: number[] = [];
  for (const p of parts) {
    const m = /^(?:\d+\s*[-–]\s*)?(\d+)$/.exec(p);
    if (!m) return null;
    out.push(Number(m[1]));
  }
  return out;
}

const damageShorthand = (prefix: string, o: { needPower: boolean; allowPower: boolean; withType: boolean }): CatalogueShorthand => ({
  name: 'Damage',
  aliases: ['damage', 'dmg', 'damagecode', 'dam'],
  fills: o.allowPower ? `${prefix}damagePower, ${prefix}damageLevel, ${prefix}damageType, ${prefix}strengthPower` : `${prefix}damageLevel${o.withType ? `, ${prefix}damageType` : ''}`,
  help: o.allowPower ? 'Damage code: "9M", "6S Stun", "(STR+2)M".' : o.withType ? 'Damage level, with "Stun" if it is: "M", "S Stun".' : 'Damage level: L, M, S or D.',
  apply(cell, set) {
    const d = parseCatalogueDamage(cell);
    if (!d) return `"${cell}" is not a damage code (like ${o.allowPower ? '9M, 6S Stun or (STR+2)M' : 'M or S Stun'})`;
    if (!o.allowPower && d.power !== null) return `"${cell}": give just the level (L, M, S or D)`;
    if (!o.allowPower && d.strength) return `"${cell}": give just the level (L, M, S or D)`;
    if (o.needPower && d.power === null) return `"${cell}" needs a Power, like 9M or (STR+1)M`;
    if (o.allowPower) { set(`${prefix}damagePower`, d.power ?? 0); set(`${prefix}strengthPower`, d.strength); }
    set(`${prefix}damageLevel`, d.level);
    if (o.withType) set(`${prefix}damageType`, d.stun ? 'stun' : 'physical');
    else if (d.stun) return `"${cell}": this damage is always one type`;
    return null;
  },
});

/**
 * `withBi`: accept the usual "B/I" header. v0.81.0 (RC-5, R2-REST 2): off only where the type has its own `bi`
 * column (cyberware's Body Index).
 */
const armorShorthand = (ballistic: string, impact: string, withBi = true): CatalogueShorthand => ({
  name: 'Armor',
  aliases: ['armor', 'armour', 'ballisticimpact', 'armorrating', 'armourrating', 'balimp', ...(withBi ? ['bi'] : [])],
  fills: `${ballistic}, ${impact}`,
  help: 'Ballistic/Impact, e.g. "5/3".',
  apply(cell, set) {
    const ns = splitNumbers(cell);
    if (!ns || ns.length !== 2) return `"${cell}" is not Ballistic/Impact (like 5/3)`;
    set(ballistic, ns[0]); set(impact, ns[1]);
    return null;
  },
});

const FEED_WORDS: Record<string, string> = { c: 'clip', clip: 'clip', b: 'belt', belt: 'belt', cy: 'cylinder', cylinder: 'cylinder', m: 'internal', magazine: 'internal', internal: 'internal', bk: 'break', break: 'break' };

/** Shorthand columns per item type: one cell filling several fields. */
export const CATALOGUE_SHORTHANDS: Partial<Record<CatalogueType, CatalogueShorthand[]>> = {
  weapon: [
    damageShorthand('', { needPower: true, allowPower: true, withType: true }),
    {
      name: 'Range', aliases: ['range', 'ranges', 'rangebands'], fills: 'range.short, range.medium, range.long, range.extreme',
      help: 'Short/Medium/Long/Extreme in metres, e.g. "5/20/40/60".',
      apply(cell, set) {
        const ns = splitNumbers(cell);
        if (!ns || ns.length !== 4) return `"${cell}" is not four range bands (like 5/20/40/60)`;
        (['short', 'medium', 'long', 'extreme'] as const).forEach((k, i) => set(`range.${k}`, ns[i]));
        return null;
      },
    },
    {
      name: 'Ammo', aliases: ['ammo', 'ammunition', 'ammocap'], fills: 'ammoMax, ammo, feed',
      help: 'Capacity and how it loads, e.g. "15 (c)" (c clip, b belt, cy cylinder, m internal); it comes loaded.',
      apply(cell, set) {
        const m = /^(\d+)\s*(?:\(?\s*([a-z]+)\s*\)?)?$/i.exec(cell.trim());
        const feed = m?.[2] ? own(FEED_WORDS, m[2].toLowerCase()) : undefined;
        if (!m || (m[2] && !feed)) return `"${cell}" is not an ammo capacity (like 15 or 15 (c))`;
        set('ammoMax', Number(m[1])); set('ammo', Number(m[1]));
        if (feed) set('feed', feed);
        return null;
      },
    },
  ],
  armor: [armorShorthand('ballistic', 'impact')],
  cyberware: [damageShorthand('weapon.', { needPower: false, allowPower: true, withType: true }), armorShorthand('armorBallistic', 'armorImpact', false)],
  adeptpower: [armorShorthand('ballistic', 'impact')],
  spell: [
    damageShorthand('', { needPower: false, allowPower: false, withType: true }),
    {
      name: 'Drain', aliases: ['drain', 'draincode', 'drainvalue'], fills: 'drainModifier, drainLevel',
      help: 'Drain code, e.g. "[(F/2)+1]S" or "+1S".',
      apply(cell, set) {
        const d = parseCatalogueDrain(cell);
        if (!d) return `"${cell}" is not a drain code (like (F/2)+1S)`;
        set('drainModifier', d.modifier); set('drainLevel', d.level);
        return null;
      },
    },
  ],
  power: [damageShorthand('', { needPower: false, allowPower: false, withType: true })],
  program: [damageShorthand('', { needPower: false, allowPower: false, withType: false })],
  cyberdeck: [{
    name: 'Persona', aliases: ['persona', 'bems', 'personaprograms', 'personarating'], fills: 'bod, evasion, masking, sensors',
    help: 'Bod/Evasion/Masking/Sensors, e.g. "3/3/3/3".',
    apply(cell, set) {
      const ns = splitNumbers(cell);
      if (!ns || ns.length !== 4) return `"${cell}" is not four persona ratings (like 3/3/3/3)`;
      (['bod', 'evasion', 'masking', 'sensors'] as const).forEach((k, i) => set(k, ns[i]));
      return null;
    },
  }],
};

/**
 * v0.91.4: a vehicle's or drone's columns (the new-entry form's vehicle and drone kinds; vehicles are actors, so they
 * are not a catalogue item type).
 */
const VEHICLE_CATEGORIES = (): string[] => ids(R.VEHICLES?.categories);
const VEHICLE_CATEGORY_WORDS = (): Record<string, string> => Object.fromEntries(
  (R.VEHICLES?.categories ?? []).map((c: any) => [norm(String(c.label ?? '')), String(c.id)]).filter(([k]: [string]) => k),
);
export const VEHICLE_COLUMNS: CatalogueColumn[] = [
  choice('category', VEHICLE_CATEGORIES, ['class', 'vehicletype', 'kind'], 'Kind of vehicle (car, bike, truck, boat, rotorcraft…).', VEHICLE_CATEGORY_WORDS),
  bool('drone', ['isdrone', 'remote'], 'A drone (driven by its Pilot or a rigger).'),
  int('handling', ['hand', 'hdl'], 'Handling (on-road).', { min: 0 }),
  int('handlingOffroad', ['offroad', 'offroadhandling'], 'Off-road Handling (0 = the same as on-road).', { min: 0 }),
  int('speed', ['spd', 'cruise'], 'Speed.', { min: 0 }),
  int('accel', ['acceleration', 'acc'], 'Acceleration.', { min: 0 }),
  int('body', ['bod'], 'Body.', { min: 0 }),
  int('armor', ['armour', 'arm'], 'Armor.', { min: 0 }),
  int('signature', ['sig'], 'Signature.', { min: 0 }),
  int('autonav', ['nav', 'autopilot'], 'Autonav.', { min: 0 }),
  int('pilot', ['pil', 'dronepilot'], 'Pilot (drones).', { min: 0 }),
  int('sensor', ['sensors', 'sen'], 'Sensor.', { min: 0 }),
  str('seating', ['seats'], 'Seating, e.g. "1+3".'),
  num('load', ['cargoload', 'loadkg'], 'Load in kilograms (0 = not tracked).', { min: 0 }),
  ...buying(),
];

/** v0.91.4: a vehicle's shorthand: Handling "4/8" (on-road/off-road). */
export const VEHICLE_SHORTHANDS: CatalogueShorthand[] = [{
  name: 'Handling', aliases: ['handling', 'hand'], fills: 'handling, handlingOffroad',
  help: 'Handling, on-road/off-road, e.g. "4/8" (one number: both the same).',
  apply(cell, set) {
    const ns = splitNumbers(cell);
    if (!ns || ns.length < 1 || ns.length > 2) return `"${cell}" is not a Handling (like 4 or 4/8)`;
    set('handling', ns[0]);
    if (ns.length === 2) set('handlingOffroad', ns[1]);
    return null;
  },
}];

/** The column a "Type" header means when its cells aren't item types (spell Type M/P, program Type Attack...). */
const TYPE_COLUMN_FALLBACK: Partial<Record<CatalogueType, string>> = { spell: 'spellType', focus: 'focusType', program: 'kind', cyberware: 'kind', skill: 'kind' };

// ---------------------------------------------------------------- Cells

/** A header or word with case, spaces and punctuation dropped ("Street Index" → "streetindex"; "¥" → "nuyen"). */
function norm(s: string): string {
  return String(s ?? '').toLowerCase().replace(/[¥￥]/g, 'nuyen').replace(/[^a-z0-9]/g, '');
}

const EMPTY_MARKS = new Set(['-', '–', '—', 'n/a', 'na']);

/**
 * A number from a cell: "1,500", "¥1.500" (dots as thousands for whole-number columns), "1 500",
 * "0,5" (a decimal comma), "+2", "1500 nuyen". NaN when it isn't one.
 */
export function parseNumberCell(text: string, integer = false): number {
  let t = String(text ?? '').trim().replace(/[¥￥]|nuyen|nuy\b|\bny\b/gi, '').replace(/[\s  ']/g, '');
  if (/^[+-]?\d{1,3}(,\d{3})+(\.\d+)?$/.test(t)) t = t.replace(/,/g, '');
  else if (/^[+-]?\d{1,3}(\.\d{3})+(,\d+)?$/.test(t) && (integer || t.includes(','))) t = t.replace(/\./g, '').replace(',', '.');
  else if (/^[+-]?\d*,\d+$/.test(t)) t = t.replace(',', '.');
  if (!/^[+-]?(\d+\.?\d*|\.\d+)$/.test(t)) return NaN;
  return Number(t);
}

const TRUE_WORDS = new Set(['yes', 'y', 'true', 't', 'x', '1', 'on', '✓', '✔', '☑', '✅']);
const FALSE_WORDS = new Set(['no', 'n', 'false', 'f', '0', 'off', '✗', '✘', '☐', '❌']);

/** A yes/no from a cell (yes/no, true/false, x, 1/0, ✓); null when it isn't one. */
export function parseBooleanCell(text: string): boolean | null {
  const t = String(text ?? '').trim().toLowerCase();
  if (TRUE_WORDS.has(t)) return true;
  if (FALSE_WORDS.has(t)) return false;
  return null;
}

/** A choice from a cell: the value itself, a synonym, or the start of one value (ignoring case and punctuation). */
function parseChoice(text: string, spec: CatalogueColumn): { value: string } | { error: string } {
  const choices = spec.choices ?? [];
  const n = norm(text);
  const exact = choices.find((c) => norm(c) === n);
  if (exact !== undefined) return { value: exact };
  const syn = own(spec.synonyms, n);
  if (syn !== undefined && choices.includes(syn)) return { value: syn };
  if (n === 'none' && choices.includes('')) return { value: '' };
  if (n) {
    const pre = choices.filter((c) => c && norm(c).startsWith(n));
    if (pre.length === 1) return { value: pre[0]! };
  }
  const shown = choices.filter(Boolean);
  return { error: `"${text}" is not one of ${shown.length > 12 ? `${shown.slice(0, 12).join(', ')}...` : shown.join(', ')}` };
}

/** Read one cell for a column: the value, or an error naming what is wrong. */
export function readCell(text: string, spec: CatalogueColumn): { value: unknown } | { error: string } {
  if (spec.kind === 'string') return { value: text };
  if (spec.kind === 'boolean') {
    const b = parseBooleanCell(text);
    return b === null ? { error: `"${text}" is not yes or no` } : { value: b };
  }
  if (spec.kind === 'choice') return parseChoice(text, spec);
  const v = parseNumberCell(text, spec.kind === 'integer');
  if (!Number.isFinite(v)) return { error: `"${text}" is not a number` };
  if (spec.kind === 'integer' && !Number.isInteger(v)) return { error: `"${text}" is not a whole number` };
  if (spec.min !== undefined && v < spec.min) return { error: `${v} is below the minimum ${spec.min}` };
  if (spec.max !== undefined && v > spec.max) return { error: `${v} is above the maximum ${spec.max}` };
  return { value: v };
}

/** A raw "system.x.y" cell: true/false, a number, null, JSON, or else text. */
function inferRaw(text: string): unknown {
  const t = text.trim();
  if (t === 'true') return true;
  if (t === 'false') return false;
  if (t === 'null') return null;
  if (/^-?\d+(\.\d+)?(e[+-]?\d+)?$/i.test(t)) return Number(t);
  if (/^["[{]/.test(t)) { try { return JSON.parse(t, dropUnsafeKeys); } catch { /* text */ } }
  return text;
}

const UNSAFE_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

/**
 * v0.81.1 (SEC2b-9): a JSON.parse reviver that drops '__proto__', 'prototype' and 'constructor' keys. JSON.parse makes
 * them own keys, which a later for…in copy (foundry.utils.deepClone) assigns as the clone's prototype.
 */
function dropUnsafeKeys(k: string, v: unknown): unknown {
  return UNSAFE_KEYS.has(k) ? undefined : v;
}

function setPath(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.');
  // Never write through an object's prototype (a pasted "system.__proto__.x" header).
  if (parts.some((p) => UNSAFE_KEYS.has(p))) return;
  let o: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i]!;
    const next = o[k];
    if (!next || typeof next !== 'object' || Array.isArray(next)) o[k] = {};
    o = o[k] as Record<string, unknown>;
  }
  o[parts[parts.length - 1]!] = value;
}

// ---------------------------------------------------------------- Headers

type Resolution = { kind: 'column'; spec: CatalogueColumn } | { kind: 'shorthand'; shorthand: CatalogueShorthand } | { kind: 'raw'; path: string };

interface HeaderIndex { exact: Map<string, CatalogueColumn>; alias: Map<string, CatalogueColumn>; last: Map<string, CatalogueColumn | null>; short: Map<string, CatalogueShorthand> }
const indexCache = new Map<string, HeaderIndex>();

function headerIndex(type: CatalogueType): HeaderIndex {
  const hit = indexCache.get(type);
  if (hit) return hit;
  const ix: HeaderIndex = { exact: new Map(), alias: new Map(), last: new Map(), short: new Map() };
  for (const spec of CATALOGUE_COLUMNS[type]) {
    ix.exact.set(norm(spec.path), spec);
    for (const a of spec.aliases) if (!ix.alias.has(norm(a))) ix.alias.set(norm(a), spec);
    const last = norm(spec.path.split('.').pop() ?? '');
    ix.last.set(last, ix.last.has(last) ? null : spec);
  }
  for (const s of CATALOGUE_SHORTHANDS[type] ?? []) for (const a of s.aliases) ix.short.set(norm(a), s);
  indexCache.set(type, ix);
  return ix;
}

/** What a header means for an item type: a column, a shorthand, a raw "system.path", or null. */
function resolveHeader(type: CatalogueType, header: string): Resolution | null {
  const raw = /^system\.(.+)$/i.exec(header.trim());
  if (raw) return /^[A-Za-z0-9_]+(\.[A-Za-z0-9_]+)*$/.test(raw[1]!) && !raw[1]!.split('.').some((k) => UNSAFE_KEYS.has(k)) ? { kind: 'raw', path: raw[1]! } : null;
  const ix = headerIndex(type);
  const tryKey = (h: string): Resolution | null => {
    if (!h) return null;
    const s = ix.short.get(h); if (s) return { kind: 'shorthand', shorthand: s };
    const e = ix.exact.get(h) ?? ix.alias.get(h) ?? ix.last.get(h);
    return e ? { kind: 'column', spec: e } : null;
  };
  return tryKey(norm(header)) ?? tryKey(norm(header.replace(/\([^)]*\)|\[[^\]]*\]/g, '')));
}

function isCatalogueType(t: string): t is CatalogueType { return (CATALOGUE_TYPES as readonly string[]).includes(t); }

const TYPE_WORDS: Record<string, { type: CatalogueType; preset?: Record<string, unknown> }> = (() => {
  const m: Record<string, { type: CatalogueType; preset?: Record<string, unknown> }> = {};
  for (const t of CATALOGUE_TYPES) { m[t] = { type: t }; m[`${t}s`] = { type: t }; }
  const add = (words: string[], type: CatalogueType, preset?: Record<string, unknown>) => { for (const w of words) m[w] = preset ? { type, preset } : { type }; };
  add(['armour', 'armours'], 'armor');
  add(['gun', 'guns', 'firearm', 'firearms'], 'weapon');
  add(['meleeweapon', 'meleeweapons', 'melee'], 'weapon', { melee: true });
  add(['equipment', 'item', 'items'], 'gear');
  add(['cyber'], 'cyberware');
  add(['bioware', 'bio'], 'cyberware', { bioware: true });
  add(['foci'], 'focus');
  add(['critterpower', 'critterpowers', 'spiritpower', 'spiritpowers'], 'power');
  add(['adept', 'adeptpowers'], 'adeptpower');
  add(['deck', 'decks'], 'cyberdeck');
  add(['utility', 'utilities'], 'program');
  add(['activeskill', 'activeskills'], 'skill', { kind: 'active' });
  add(['knowledgeskill', 'knowledgeskills', 'knowledge'], 'skill', { kind: 'knowledge' });
  add(['languageskill', 'language', 'languages'], 'skill', { kind: 'language' });
  return m;
})();

/** The item type a "Type" cell names (with "Bioware", "Knowledge"... also presetting a field), or null. */
export function catalogueTypeOf(text: string): { type: CatalogueType; preset?: Record<string, unknown> } | null {
  return own(TYPE_WORDS, norm(text)) ?? null;
}

const NAME_HEADERS = new Set(['name', 'itemname', 'item', 'title']);
const TYPE_HEADERS = new Set(['type', 'itemtype']);

// ---------------------------------------------------------------- Rows to templates

export interface CatalogueImport {
  templates: ItemTemplate[];
  errors: Array<{ row: number; message: string }>;
  warnings: string[];
  unknownColumns: string[];
  columns: Array<{ header: string; path: string | null }>;
}

/** v0.81.1 (RC2-7): the most spreadsheet text one import reads (a large catalogue is a few hundred kilobytes). */
export const MAX_CSV_CHARS = 1_000_000;

const key = (type: string, name: string) => `${type}\u0000${name.trim().toLowerCase()}`;

/**
 * Turn pasted spreadsheet rows into item templates. The first row is the header; a "Type" column gives
 * each row's item type (else `defaultType`), "Name" its name, and the other columns fill fields (see
 * CATALOGUE_COLUMNS and CATALOGUE_SHORTHANDS). Rows with a bad cell are left out and reported (rows
 * numbered as in the spreadsheet, counting the header as the first); columns nobody understands are listed once
 * and ignored. A row naming an existing template of the same type keeps its id, so it updates it.
 */
export function rowsToTemplates(text: string, opts: { defaultType?: string; existing?: ItemTemplate[]; makeId: () => string }): CatalogueImport {
  const result: CatalogueImport = { templates: [], errors: [], warnings: [], unknownColumns: [], columns: [] };
  text = String(text ?? '');
  // v0.81.1 (RC2-7): bounded input, as the character and stat block importers are.
  if (text.length > MAX_CSV_CHARS) {
    result.warnings.push(`The text is over ${MAX_CSV_CHARS.toLocaleString('en')} characters; only the first ${MAX_CSV_CHARS.toLocaleString('en')} were read.`);
    text = text.slice(0, MAX_CSV_CHARS);
  }
  const delimiter = detectDelimiter(text.replace(/^﻿/, ''));
  const records = parseRecords(text, delimiter, (row) =>
    result.errors.push({ row, message: 'A quote (") opened here is never closed, so every row after it was read as one cell.' }));
  const head = records[0];
  if (!head) { result.warnings.push('Nothing to import.'); return result; }
  const headers = head.cells;
  const body = records.slice(1);
  const defaultType = opts.defaultType ? catalogueTypeOf(opts.defaultType) : null;
  if (opts.defaultType && !defaultType) result.errors.push({ row: 1, message: `"${opts.defaultType}" is not an item type.` });

  const nameCol = headers.findIndex((h) => NAME_HEADERS.has(norm(h)));
  let typeCol = headers.findIndex((h) => TYPE_HEADERS.has(norm(h)));
  if (nameCol < 0) { result.errors.push({ row: head.row, message: 'There is no "Name" column.' }); return result; }

  // A "Type" column whose cells aren't item types may be the default type's own Type (spell M/P...).
  let typeAsColumn = false;
  if (typeCol >= 0 && defaultType) {
    const cells = body.map((r) => r.cells[typeCol] ?? '').filter(Boolean);
    const fallback = TYPE_COLUMN_FALLBACK[defaultType.type];
    const spec = fallback ? CATALOGUE_COLUMNS[defaultType.type].find((c) => c.path === fallback) : undefined;
    if (spec && cells.some((c) => !catalogueTypeOf(c)) && cells.every((c) => 'value' in readCell(c, spec))) {
      typeAsColumn = true;
      result.warnings.push(`The "${headers[typeCol]}" column is read as the ${defaultType.type}'s ${fallback}, since its cells aren't item types.`);
    }
  }
  const typeColumnFor = (type: CatalogueType, h: string): Resolution | null => {
    if (typeAsColumn && type === defaultType?.type) {
      const spec = CATALOGUE_COLUMNS[type].find((c) => c.path === TYPE_COLUMN_FALLBACK[type]);
      return spec ? { kind: 'column', spec } : null;
    }
    return resolveHeader(type, h);
  };
  const typeAsColumnIndex = typeAsColumn ? typeCol : -1;
  if (typeAsColumn) typeCol = -1;
  const resolveAt = (type: CatalogueType, i: number): Resolution | null => (i === typeAsColumnIndex ? typeColumnFor(type, headers[i] ?? '') : resolveHeader(type, headers[i] ?? ''));

  // Each row's type.
  const rowTypes = body.map((r) => {
    const cell = typeCol >= 0 ? (r.cells[typeCol] ?? '') : '';
    if (cell) return { cell, ...(catalogueTypeOf(cell) ?? { type: null }) };
    return { cell, ...(defaultType ?? { type: null }) };
  });
  const present: CatalogueType[] = [];
  for (const t of rowTypes) if (t.type && !present.includes(t.type)) present.push(t.type);
  const lookIn: CatalogueType[] = present.length ? present : defaultType ? [defaultType.type] : [...CATALOGUE_TYPES];

  // Columns.
  const resolvers = headers.map((h, i) => {
    if (i === nameCol || i === typeCol) return { header: h, path: i === nameCol ? 'name' : 'type', known: true };
    if (!h) return { header: h, path: null, known: false };
    for (const t of lookIn) {
      const r = resolveAt(t, i);
      if (r) return { header: h, path: r.kind === 'column' ? r.spec.path : r.kind === 'raw' ? r.path : r.shorthand.fills, known: true };
    }
    return { header: h, path: null, known: false };
  });
  result.columns = resolvers.map((r) => ({ header: r.header, path: r.path }));
  for (const r of resolvers) if (!r.known && r.header && !result.unknownColumns.includes(r.header)) result.unknownColumns.push(r.header);

  const existing = opts.existing ?? [];
  const byKey = new Map<string, number>();
  const notApplying = new Set<string>();

  body.forEach((rec, ri) => {
    const rt = rowTypes[ri]!;
    const name = rec.cells[nameCol] ?? '';
    const rowErrors: string[] = [];
    if (!rt.type) rowErrors.push(rt.cell ? `"${rt.cell}" is not an item type.` : 'No item type (add a Type column or choose a default type).');
    if (!name) rowErrors.push('No name.');
    const system: Record<string, unknown> = {};
    if (rt.type) {
      if (rt.preset) for (const [k, v] of Object.entries(rt.preset)) setPath(system, k, v);
      const type = rt.type;
      headers.forEach((h, i) => {
        if (i === nameCol || i === typeCol) return;
        const cell = rec.cells[i] ?? '';
        if (!cell || !resolvers[i]?.known) return;
        const res = resolveAt(type, i);
        if (!res) {
          const k = `${type}:${h}`;
          if (!notApplying.has(k)) { notApplying.add(k); result.warnings.push(`The "${h}" column means nothing for a ${type}; ignored on those rows.`); }
          return;
        }
        if (res.kind === 'raw') { setPath(system, res.path, inferRaw(cell)); return; }
        if (res.kind === 'shorthand') {
          const err = res.shorthand.apply(cell, (p, v) => setPath(system, p, v));
          if (err) rowErrors.push(`${h}: ${err}.`);
          return;
        }
        if (res.spec.kind !== 'string' && EMPTY_MARKS.has(cell.toLowerCase())) return;
        const read = readCell(cell, res.spec);
        if ('error' in read) rowErrors.push(`${h}: ${read.error}.`);
        else setPath(system, res.spec.path, read.value);
      });
    }
    if (rowErrors.length || !rt.type) {
      for (const message of rowErrors) result.errors.push({ row: rec.row, message });
      return;
    }
    const k = key(rt.type, name);
    const old = existing.find((t) => key(t.type, t.name) === k);
    const tpl: ItemTemplate = { id: old?.id ?? opts.makeId(), type: rt.type, name, system };
    const dup = byKey.get(k);
    if (dup !== undefined) {
      result.warnings.push(`Row ${rec.row}: "${name}" (${rt.type}) appears twice; the later row wins.`);
      tpl.id = result.templates[dup]!.id;
      result.templates[dup] = tpl;
      return;
    }
    if (old) result.warnings.push(`Row ${rec.row}: "${name}" replaces the existing ${rt.type} template.`);
    byKey.set(k, result.templates.length);
    result.templates.push(tpl);
  });
  return result;
}

// ---------------------------------------------------------------- Templates to CSV

function leaves(obj: unknown, prefix: string, out: Map<string, unknown>): void {
  if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) leaves(v, prefix ? `${prefix}.${k}` : k, out);
  } else if (prefix) out.set(prefix, obj);
}

function csvCell(v: string): string {
  // v0.81.1 (RC2-9): a cell a spreadsheet would run as a formula (=, +, -, @ first; plain numbers aside) gets a
  // leading ' so it opens as text. parseRecords takes the quote off again.
  if (/^[=+\-@]/.test(v) && !/^[+-]?\d+(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(v)) v = `'${v}`;
  return /[",\r\n;\t]|^\s|\s$/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/**
 * Templates as comma-separated text (of one type, or all): Type, Name, then a column per field found
 * (the known columns first, in their usual order, then the rest alphabetically as "system.path").
 * Reading the result back with rowsToTemplates gives the same templates.
 */
export function templatesToCsv(templates: readonly ItemTemplate[], type?: string): string {
  const list = templates.filter((t) => !type || t.type === type);
  const flat = list.map((t) => { const m = new Map<string, unknown>(); leaves(t.system, '', m); return m; });
  const pathsByType = new Map<string, Set<string>>();
  list.forEach((t, i) => {
    const s = pathsByType.get(t.type) ?? new Set<string>();
    for (const p of flat[i]!.keys()) s.add(p);
    pathsByType.set(t.type, s);
  });
  const all = new Set<string>();
  for (const s of pathsByType.values()) for (const p of s) all.add(p);

  const vocabOrder: string[] = [];
  for (const t of CATALOGUE_TYPES) if (pathsByType.has(t)) for (const c of CATALOGUE_COLUMNS[t]) if (all.has(c.path) && !vocabOrder.includes(c.path)) vocabOrder.push(c.path);
  const others = [...all].filter((p) => !vocabOrder.includes(p)).sort();

  // A known column's header must mean that path for every type that has it, and its values must be plain.
  const plain = (p: string) => flat.every((m) => { const v = m.get(p); return v === undefined || ['string', 'number', 'boolean'].includes(typeof v); });
  const headerFor = (p: string): { header: string; raw: boolean } => {
    const types = [...pathsByType.entries()].filter(([, s]) => s.has(p)).map(([t]) => t);
    if (plain(p) && types.every(isCatalogueType)) {
      const specs = types.map((t) => CATALOGUE_COLUMNS[t as CatalogueType].find((c) => c.path === p));
      if (specs.every(Boolean)) {
        for (const cand of [p, ...specs[0]!.aliases]) {
          if (types.every((t) => { const r = resolveHeader(t as CatalogueType, cand); return r?.kind === 'column' && r.spec.path === p; })) return { header: cand, raw: false };
        }
      }
    }
    return { header: `system.${p}`, raw: true };
  };
  const cols = [...vocabOrder, ...others].map((p) => ({ path: p, ...headerFor(p) }));

  const fmt = (v: unknown, raw: boolean): string => {
    if (v === undefined) return '';
    if (raw) {
      if (typeof v === 'string') { const back = inferRaw(v); return back === v && v.trim() === v ? v : JSON.stringify(v); }
      return JSON.stringify(v);
    }
    if (typeof v === 'boolean') return v ? 'yes' : 'no';
    return String(v);
  };
  const lines = [['Type', 'Name', ...cols.map((c) => c.header)].map(csvCell).join(',')];
  list.forEach((t, i) => {
    lines.push([t.type, t.name, ...cols.map((c) => fmt(flat[i]!.get(c.path), c.raw))].map(csvCell).join(','));
  });
  return lines.join('\r\n') + '\r\n';
}

// ---------------------------------------------------------------- Catalogue JSON

/** The format tag of an exported catalogue. */
export const CATALOGUE_FORMAT = 'sr2e-catalogue';
/**
 * The version of the catalogue file format. v0.84.0: version 2 adds `actors` (vehicles and drones, NPCs and critters,
 * spirits, and NPCs as stat-block text); version 1 files (templates and kits) still load.
 */
export const CATALOGUE_VERSION = 2;
const READABLE_VERSIONS = [1, 2];

/** v0.84.0: the actor types a catalogue file can carry (never player characters). */
export const CATALOGUE_ACTOR_TYPES = ['npc', 'vehicle', 'spirit'] as const;
export type CatalogueActorType = (typeof CATALOGUE_ACTOR_TYPES)[number];

/** One actor in a catalogue file: its own data and items, or (NPCs) a stat block for the character import. */
export interface CatalogueActor {
  type: CatalogueActorType;
  name: string;
  system: Record<string, unknown>;
  items: Array<{ type: CatalogueType; name: string; system: Record<string, unknown> }>;
  /** NPCs: a write-up in the character import's format ("Body 5", "Skills: …", "Gear: …"); '' for none. */
  statBlock: string;
  /** An animal (no metatype: no racial modifiers or maximums). */
  critter: boolean;
}

/** The longest catalogue file read (characters), and the longest stat block in it. */
export const MAX_CATALOGUE_CHARS = 30_000_000;
export const MAX_STATBLOCK_CHARS = 20_000;
/** The most entries read from one file (far above any real catalogue); the rest are left out and reported. */
export const MAX_CATALOGUE_ENTRIES = { templates: 20_000, actors: 5_000, itemsPerActor: 500 } as const;

/** The whole catalogue (world templates, starter kits and, v0.84.0, actors) as pretty JSON for another world. */
export function catalogueToJson(c: { templates: readonly ItemTemplate[]; kits: readonly unknown[]; actors?: readonly CatalogueActor[]; exportedAt: string | number; systemVersion: string }): string {
  return JSON.stringify({
    format: CATALOGUE_FORMAT,
    version: CATALOGUE_VERSION,
    systemVersion: c.systemVersion,
    exportedAt: c.exportedAt,
    // v0.91.0: the GM's "in the shop" mark travels with the template.
    templates: c.templates.map((t) => ({ id: t.id, type: t.type, name: t.name, system: t.system, ...(t.shop ? { shop: true } : {}) })),
    kits: [...c.kits],
    ...(c.actors?.length ? { actors: c.actors.map((a) => ({ type: a.type, name: a.name, system: a.system, items: a.items, statBlock: a.statBlock || undefined, critter: a.critter || undefined })) } : {}),
  }, null, 2);
}

const isPlainObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/**
 * Read an exported catalogue. Templates must have a known item type, a name and system data; kits an
 * object with a name and an array of lines (kits are otherwise passed through as they are); actors (v0.84.0) a
 * known actor type, a name, and system data or a stat block. Bad entries are left out and listed in `errors`.
 */
export function parseCatalogueJson(text: string): { templates: ItemTemplate[]; kits: unknown[]; actors: CatalogueActor[]; errors: string[] } {
  const out = { templates: [] as ItemTemplate[], kits: [] as unknown[], actors: [] as CatalogueActor[], errors: [] as string[] };
  const raw = String(text ?? '');
  if (raw.length > MAX_CATALOGUE_CHARS) { out.errors.push(`The file is too large (over ${MAX_CATALOGUE_CHARS.toLocaleString('en')} characters).`); return out; }
  let data: unknown;
  try { data = JSON.parse(raw, dropUnsafeKeys); } catch (e) { out.errors.push(`Not valid JSON: ${(e as Error).message}`); return out; }
  if (!isPlainObject(data)) { out.errors.push('Not a catalogue file.'); return out; }
  if (data.format !== CATALOGUE_FORMAT) { out.errors.push(`Not a catalogue file (format should be "${CATALOGUE_FORMAT}").`); return out; }
  if (!READABLE_VERSIONS.includes(data.version as number)) {
    out.errors.push(typeof data.version === 'number' && data.version > CATALOGUE_VERSION
      ? `Catalogue version ${data.version} is from a newer version of the system.` : `Unknown catalogue version ${String(data.version)}.`);
    return out;
  }
  if (data.templates !== undefined && !Array.isArray(data.templates)) out.errors.push('"templates" is not a list.');
  if (Array.isArray(data.templates)) {
    if (data.templates.length > MAX_CATALOGUE_ENTRIES.templates) out.errors.push(`Only the first ${MAX_CATALOGUE_ENTRIES.templates} templates are read.`);
    data.templates.slice(0, MAX_CATALOGUE_ENTRIES.templates).forEach((t: unknown, i: number) => {
      const label = `Template ${i + 1}${isPlainObject(t) && typeof t.name === 'string' ? ` ("${t.name}")` : ''}`;
      const ok = checkItem(t, label, out.errors);
      if (ok) out.templates.push({ id: isPlainObject(t) && typeof t.id === 'string' ? t.id : '', ...ok, ...(isPlainObject(t) && t.shop === true ? { shop: true } : {}) });
    });
  }
  if (data.kits !== undefined && !Array.isArray(data.kits)) out.errors.push('"kits" is not a list.');
  if (Array.isArray(data.kits)) {
    data.kits.forEach((k: unknown, i: number) => {
      if (!isPlainObject(k) || typeof k.name !== 'string' || !Array.isArray(k.lines)) { out.errors.push(`Kit ${i + 1}: needs a name and a list of lines.`); return; }
      out.kits.push(k);
    });
  }
  if (data.actors !== undefined && !Array.isArray(data.actors)) out.errors.push('"actors" is not a list.');
  if (Array.isArray(data.actors)) {
    if (data.actors.length > MAX_CATALOGUE_ENTRIES.actors) out.errors.push(`Only the first ${MAX_CATALOGUE_ENTRIES.actors} actors are read.`);
    const seen = new Set<string>();
    data.actors.slice(0, MAX_CATALOGUE_ENTRIES.actors).forEach((a: unknown, i: number) => {
      const label = `Actor ${i + 1}${isPlainObject(a) && typeof a.name === 'string' ? ` ("${a.name}")` : ''}`;
      if (!isPlainObject(a)) { out.errors.push(`${label}: not an object.`); return; }
      if (typeof a.type !== 'string' || !(CATALOGUE_ACTOR_TYPES as readonly string[]).includes(a.type)) { out.errors.push(`${label}: unknown actor type ${JSON.stringify(a.type)} (npc, vehicle or spirit).`); return; }
      if (typeof a.name !== 'string' || !a.name.trim()) { out.errors.push(`${label}: no name.`); return; }
      if (a.system !== undefined && !isPlainObject(a.system)) { out.errors.push(`${label}: "system" is not an object.`); return; }
      const statBlock = typeof a.statBlock === 'string' ? a.statBlock : '';
      if (statBlock.length > MAX_STATBLOCK_CHARS) { out.errors.push(`${label}: the stat block is too long.`); return; }
      if (statBlock && a.type !== 'npc') { out.errors.push(`${label}: only an NPC can have a stat block.`); return; }
      const items: CatalogueActor['items'] = [];
      if (a.items !== undefined && !Array.isArray(a.items)) out.errors.push(`${label}: "items" is not a list.`);
      if (Array.isArray(a.items)) {
        if (a.items.length > MAX_CATALOGUE_ENTRIES.itemsPerActor) out.errors.push(`${label}: only the first ${MAX_CATALOGUE_ENTRIES.itemsPerActor} items are read.`);
        a.items.slice(0, MAX_CATALOGUE_ENTRIES.itemsPerActor).forEach((it: unknown, j: number) => { const ok = checkItem(it, `${label}, item ${j + 1}`, out.errors); if (ok) items.push(ok); });
      }
      // Two entries with the same type and name: the first is kept (a second would be a duplicate actor).
      const key = `${a.type}|${a.name.trim().toLowerCase().replace(/\s+/g, ' ')}`;
      if (seen.has(key)) { out.errors.push(`${label}: a second ${a.type} with this name (left out).`); return; }
      seen.add(key);
      out.actors.push({ type: a.type as CatalogueActorType, name: a.name.trim(), system: isPlainObject(a.system) ? a.system : {}, items, statBlock, critter: a.critter === true });
    });
  }
  return out;
}

/** An item entry (template, or an actor's item): a known item type, a name and system data. */
function checkItem(t: unknown, label: string, errors: string[]): { type: CatalogueType; name: string; system: Record<string, unknown> } | null {
  if (!isPlainObject(t)) { errors.push(`${label}: not an object.`); return null; }
  if (typeof t.type !== 'string' || !isCatalogueType(t.type)) { errors.push(`${label}: unknown item type ${JSON.stringify(t.type)}.`); return null; }
  if (typeof t.name !== 'string' || !t.name.trim()) { errors.push(`${label}: no name.`); return null; }
  if (!isPlainObject(t.system)) { errors.push(`${label}: no system data.`); return null; }
  return { type: t.type, name: t.name.trim(), system: t.system };
}

// ---------------------------------------------------------------- v0.84.0: filling in missing values

const sameValue = (a: unknown, b: unknown): boolean => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

function getPath(obj: unknown, path: string): { found: boolean; value: unknown } {
  let cur: unknown = obj;
  for (const k of path.split('.')) {
    if (!isPlainObject(cur) || !Object.prototype.hasOwnProperty.call(cur, k)) return { found: false, value: undefined };
    cur = cur[k];
  }
  return { found: true, value: cur };
}

/**
 * Fields that belong to one copy of a thing, not to what it is: never filled from a catalogue (an emptied gun, a
 * stack of one, a player's skill rating, ware switched off). The kit-state switches are booleans and never filled
 * anyway; they are listed for clarity.
 */
export const FILL_NEVER = new Set(['quantity', 'ammo', 'rating', 'level', 'force', 'heat', 'heatAt', 'karmaBonded', 'poolSpent', 'services', ...KIT_STATE_FIELDS]);

/**
 * v0.84.0 (second review): catalogue columns that are one copy's setup or a choice where empty or 0 means "none"
 * (a silencer taken off, no scope, a deliberate 0 Concealability, no smartlink, reflexes or bonus). Never filled.
 */
export const FILL_SETUP = new Set(['muzzle', 'scope', 'scopeVision', 'gyro', 'recoilComp', 'fuse', 'guidance', 'mountPoint', 'arc', 'facing', 'traverse',
  'limit', 'concealability', 'smartlinkLevel', 'reflexes', 'filterKind', 'lacing', 'hearingAmp', 'magnification', 'pheromones', 'controlRig', 'laserSight',
  'shockPad', 'support', 'ammoType', 'initiativeDice', 'reaction', 'housedIn', 'plantedOn', 'plantedName', ...ATTRS]);

/**
 * The fields of an item type that filling in may set: the catalogue's own columns (what the item is: cost,
 * Availability, damage code, ranges, modes, Essence…), less FILL_NEVER, FILL_SETUP and anything that is a link or a
 * time (…Id, …Uuid, …At). An allow-list, so a field added to a model later is never filled by accident.
 */
export function fillablePaths(type: string): Set<string> {
  const cols = isCatalogueType(type) ? CATALOGUE_COLUMNS[type] : [];
  return new Set(cols.map((c) => c.path).filter((p) => !p.split('.').some((k) => FILL_NEVER.has(k) || FILL_SETUP.has(k) || /(?:Id|Uuid|At)$/.test(k))));
}

const isEmptyDefault = (v: unknown): boolean => v === '' || v === 0 || (Array.isArray(v) && v.length === 0);

/**
 * The values an item is missing that a catalogue template has: for each of the type's fillable fields
 * (`fillablePaths`) that the data model has (it is in `initial`), where the model's default is empty (a blank text, 0
 * or an empty list), the item still holds it, and the template has something else of the same shape. A value someone
 * set is never changed, nor a default that is a real value (a rating of 1, a damage code of 6M). Returns { path: value }.
 */
export function missingValues(current: unknown, incoming: unknown, initial: unknown, allowed: ReadonlySet<string>): Record<string, unknown> {
  const flat = new Map<string, unknown>();
  leaves(incoming, '', flat);
  const out: Record<string, unknown> = {};
  for (const [path, value] of flat) {
    if (value === undefined || value === null || !allowed.has(path) || path.split('.').some((k) => UNSAFE_KEYS.has(k))) continue;
    const ini = getPath(initial, path);
    if (!ini.found || !isEmptyDefault(ini.value)) continue;
    // The value must have the field's shape: text for text, a number for a number, a list for a list.
    if (Array.isArray(ini.value) ? !Array.isArray(value) : typeof value !== typeof ini.value) continue;
    const cur = getPath(current, path);
    const now = cur.found ? cur.value : ini.value;
    if (sameValue(now, ini.value) && !sameValue(value, ini.value)) out[path] = value;
  }
  return out;
}

/**
 * Add incoming templates to a list. When one has the same type and name as one already there:
 * 'replace' overwrites it (keeping the old id), 'skip' keeps the old one, 'copy' adds it as "Name (2)".
 * New ones keep their own id unless it is empty or already taken.
 */
export function mergeTemplates(existing: readonly ItemTemplate[], incoming: readonly ItemTemplate[], mode: 'replace' | 'skip' | 'copy', makeId: () => string):
  { list: ItemTemplate[]; added: number; replaced: number; skipped: number } {
  const clone = (t: ItemTemplate): ItemTemplate => ({ ...t, system: JSON.parse(JSON.stringify(t.system ?? {})) });
  const list = existing.map(clone);
  let added = 0, replaced = 0, skipped = 0;
  const freeId = (id: string) => (id && !list.some((t) => t.id === id) ? id : makeId());
  for (const inc of incoming) {
    const idx = list.findIndex((t) => key(t.type, t.name) === key(inc.type, inc.name));
    if (idx < 0) { list.push({ ...clone(inc), id: freeId(inc.id) }); added++; continue; }
    // v0.91.0 review (R8): a replaced template keeps the GM's "in the shop" mark unless the file says otherwise.
    if (mode === 'replace') { list[idx] = { ...clone(inc), id: list[idx]!.id, ...(list[idx]!.shop && inc.shop === undefined ? { shop: true } : {}) }; replaced++; continue; }
    if (mode === 'skip') { skipped++; continue; }
    const base = inc.name.replace(/\s*\(\d+\)\s*$/, '').trim() || inc.name;
    let n = 2;
    while (list.some((t) => key(t.type, t.name) === key(inc.type, `${base} (${n})`))) n++;
    list.push({ ...clone(inc), id: freeId(inc.id), name: `${base} (${n})` });
    added++;
  }
  return { list, added, replaced, skipped };
}

// ---------------------------------------------------------------- v0.90.2: the catalogue folder's subfolders

/**
 * v0.90.2: where a catalogue actor goes under the Catalogue (SR2e) actor folder (built in from the sorting macro the owner used):
 * vehicles and drones by category, spirits by kind, critters apart from other NPCs. A path of folder ids; their names
 * are SR2E.App.Catalogue.folder.(id) (two vehicle categories may share a folder, as boats and ships do).
 */
const VEHICLE_FOLDER: Record<string, string> = {
  bike: 'bikes', car: 'cars', truck: 'trucks', hovercraft: 'hovercraft', boat: 'boats', ship: 'boats', rotor: 'rotorcraft',
  fixedWing: 'fixedWing', vectorThrust: 'vectorThrust', lta: 'airships', other: 'otherVehicles',
};
const DRONE_FOLDER: Record<string, string> = {
  car: 'groundDrones', bike: 'groundDrones', truck: 'groundDrones', hovercraft: 'hoverDrones', boat: 'waterDrones', ship: 'waterDrones',
  rotor: 'rotorDrones', fixedWing: 'fixedWingDrones', vectorThrust: 'vectorThrustDrones', lta: 'blimpDrones', other: 'otherDrones',
};
const SPIRIT_FOLDER: Record<string, string> = { elemental: 'elementals', nature: 'natureSpirits' };

/** The folders' names: keys (shown with tKey), one per folder id the sorting uses. */
export const CATALOGUE_FOLDER_NAMES: Readonly<Record<string, string>> = {
  vehicles: 'SR2E.App.Catalogue.folder.vehicles',
  drones: 'SR2E.App.Catalogue.folder.drones',
  spirits: 'SR2E.App.Catalogue.folder.spirits',
  critters: 'SR2E.App.Catalogue.folder.critters',
  npcs: 'SR2E.App.Catalogue.folder.npcs',
  other: 'SR2E.App.Catalogue.folder.other',
  bikes: 'SR2E.App.Catalogue.folder.bikes',
  cars: 'SR2E.App.Catalogue.folder.cars',
  trucks: 'SR2E.App.Catalogue.folder.trucks',
  hovercraft: 'SR2E.App.Catalogue.folder.hovercraft',
  boats: 'SR2E.App.Catalogue.folder.boats',
  rotorcraft: 'SR2E.App.Catalogue.folder.rotorcraft',
  fixedWing: 'SR2E.App.Catalogue.folder.fixedWing',
  vectorThrust: 'SR2E.App.Catalogue.folder.vectorThrust',
  airships: 'SR2E.App.Catalogue.folder.airships',
  otherVehicles: 'SR2E.App.Catalogue.folder.otherVehicles',
  groundDrones: 'SR2E.App.Catalogue.folder.groundDrones',
  hoverDrones: 'SR2E.App.Catalogue.folder.hoverDrones',
  waterDrones: 'SR2E.App.Catalogue.folder.waterDrones',
  rotorDrones: 'SR2E.App.Catalogue.folder.rotorDrones',
  fixedWingDrones: 'SR2E.App.Catalogue.folder.fixedWingDrones',
  vectorThrustDrones: 'SR2E.App.Catalogue.folder.vectorThrustDrones',
  blimpDrones: 'SR2E.App.Catalogue.folder.blimpDrones',
  otherDrones: 'SR2E.App.Catalogue.folder.otherDrones',
  elementals: 'SR2E.App.Catalogue.folder.elementals',
  natureSpirits: 'SR2E.App.Catalogue.folder.natureSpirits',
  otherSpirits: 'SR2E.App.Catalogue.folder.otherSpirits',
};

export function catalogueFolderPath(a: { type: string; system?: Record<string, unknown> | null; critter?: boolean }): string[] {
  const s = (a.system ?? {}) as Record<string, unknown>;
  if (a.type === 'vehicle') {
    const cat = String(s['category'] ?? '');
    return s['drone'] ? ['drones', DRONE_FOLDER[cat] ?? 'otherDrones'] : ['vehicles', VEHICLE_FOLDER[cat] ?? 'otherVehicles'];
  }
  if (a.type === 'spirit') return ['spirits', SPIRIT_FOLDER[String(s['spiritKind'] ?? '')] ?? 'otherSpirits'];
  if (a.type === 'npc') return a.critter ? ['critters'] : ['npcs'];
  return ['other'];
}
