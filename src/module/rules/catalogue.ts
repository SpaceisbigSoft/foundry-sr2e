/**
 * v0.63.0: adding things to a sheet. The Add window lists templates, world items and compendium items
 * by type; this file holds the Foundry-free parts: labels, a short summary per entry, prices, Karma
 * for learning a skill or spell, how each type can be paid for, the row-edit fields, the setup
 * warnings banner, and the sheet search's match.
 */
import { newSkillCost } from './core923.ts';
import { itemPrice, skillCost, parseAvailability } from './upkeep.ts';
import { wareCost } from './bioware.ts';
import { gradedAvailability } from './implants.ts';
import { spellKarmaCost } from './thaumaturgy.ts';
import { damageLabel } from './weapons.ts';
import { itemWarnings } from './items.ts';
import { guessSkillAttribute } from './statblock.ts';
import { RULES } from './config.ts';
import { own } from './util.ts';
import { t as tx, tCount } from '../helpers/i18n.ts';

export type AddPayment = 'free' | 'buy' | 'karma';
import type { SkillKind } from './remnants.ts';

/** Item types, in the Add window's tab order, with their labels. */
export const ADD_TYPES: ReadonlyArray<{ type: string; label: string; one: string }> = [
  { type: 'weapon', label: 'Weapons', one: 'weapon' },
  { type: 'armor', label: 'Armor', one: 'armor' },
  { type: 'gear', label: 'Gear', one: 'gear' },
  { type: 'cyberware', label: 'Cyber/bioware', one: 'cyberware' },
  { type: 'spell', label: 'Spells', one: 'spell' },
  { type: 'adeptpower', label: 'Adept powers', one: 'adept power' },
  { type: 'focus', label: 'Foci', one: 'focus' },
  { type: 'power', label: 'Powers', one: 'power' },
  { type: 'cyberdeck', label: 'Cyberdecks', one: 'cyberdeck' },
  { type: 'program', label: 'Programs', one: 'program' },
  { type: 'skill', label: 'Skills', one: 'skill' },
  // v0.91.4: vehicles and drones (actors, not items: bought in the shop, given by the GM; never on a sheet).
  { type: 'vehicle', label: 'Vehicles', one: 'vehicle' },
];

export function typeLabel(type: string, plural = true): string {
  const t = ADD_TYPES.find((x) => x.type === type);
  return t ? (plural ? t.label : t.one) : type;
}

/** The types bought with nuyen (the rest are learned or simply written down). */
export const BOUGHT_TYPES = ['weapon', 'armor', 'gear', 'cyberware', 'focus', 'cyberdeck', 'program', 'vehicle'];
/** The types learned with Good Karma. */
export const LEARNED_TYPES = ['skill', 'spell'];

/** How an item of this type can be paid for on this kind of actor (Free is always possible). */
export function paymentChoices(type: string, actorType: string): AddPayment[] {
  const out: AddPayment[] = ['free'];
  if (actorType !== 'character') return out;
  if (BOUGHT_TYPES.includes(type)) out.push('buy');
  if (LEARNED_TYPES.includes(type)) out.push('karma');
  return out;
}

export const PAYMENT_LABELS: Record<AddPayment, string> = { free: 'Free (creation, GM gift, loot)', buy: 'Buy now (nuyen)', karma: 'Learn with Good Karma' };

/** What the Add window's per-row number means for a type: copies, or a rating/Force/level set on the new item. */
export function rowAmount(type: string): { kind: 'copies' | 'value'; label: string; field?: string } {
  if (type === 'gear') return { kind: 'value', label: tx('SR2E.Text.Catalogue.qty'), field: 'quantity' };
  if (type === 'spell') return { kind: 'value', label: tx('SR2E.Text.Catalogue.force'), field: 'learnedForce' };
  if (type === 'adeptpower') return { kind: 'value', label: tx('SR2E.Text.Catalogue.level'), field: 'level' };
  if (type === 'focus' || type === 'program' || type === 'power') return { kind: 'value', label: tx('SR2E.Text.Catalogue.rating'), field: 'rating' };
  return { kind: 'copies', label: tx('SR2E.Text.Catalogue.copies') };
}

const num = (v: unknown, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };

/** One line saying what an entry is ("9M · SA · Firearms", "B5/I3", "Essence 0.2"). */
export function entrySummary(type: string, s: any): string {
  const sy = s ?? {};
  const parts: string[] = [];
  switch (type) {
    case 'weapon':
      { const damage = damageLabel({ strengthPower: Boolean(sy.strengthPower), damagePower: num(sy.damagePower), damageLevel: String(sy.damageLevel ?? 'M') as any });
        parts.push(sy.damageType === 'stun' ? tx('SR2E.Text.Catalogue.damageStun', { damage }) : `${damage}`); }
      if (sy.melee) parts.push(num(sy.reach) ? tx('SR2E.Text.Catalogue.meleeReach', { reach: sy.reach }) : tx('SR2E.Text.Catalogue.melee'));
      else if (sy.modes) parts.push(String(sy.modes));
      if (sy.blast) parts.push(tx('SR2E.Text.Catalogue.blast'));
      if (sy.skill) parts.push(String(sy.skill));
      break;
    case 'armor': parts.push(sy.adds ? tx('SR2E.Text.Catalogue.armorAdds', { ballistic: num(sy.ballistic), impact: num(sy.impact) }) : tx('SR2E.Text.Catalogue.armor', { ballistic: num(sy.ballistic), impact: num(sy.impact) })); break;
    case 'gear': if (num(sy.medkitRating)) parts.push(tx('SR2E.Text.Catalogue.medkit', { rating: sy.medkitRating })); if (sy.toxin?.kind) parts.push(String(sy.toxin.kind)); break;
    case 'cyberware': parts.push(sy.bioware ? tx('SR2E.Text.Catalogue.bodyIndex', { value: num(sy.bodyIndex) }) : tx('SR2E.Text.Catalogue.essence', { value: num(sy.essenceCost) })); if (num(sy.rating)) parts.push(tx('SR2E.Text.Catalogue.ratingValue', { rating: sy.rating })); if (sy.grade && sy.grade !== 'standard') parts.push(String(sy.grade)); break;
    case 'spell': parts.push(`${sy.category ?? ''} (${sy.spellType ?? 'mana'})`); parts.push(tx('SR2E.Text.Catalogue.drain', { level: sy.drainLevel ?? '?' })); break;
    case 'adeptpower': parts.push(tCount(num(sy.cost), 'SR2E.Text.Catalogue.powerPoints')); break;
    case 'focus': parts.push(`${sy.focusType ?? 'focus'} ${num(sy.rating)}`); break;
    case 'power': if (sy.special) parts.push(String(sy.special)); break;
    case 'cyberdeck': parts.push(`MPCP ${num(sy.mpcp)}`); break;
    case 'program': parts.push(`${sy.kind ?? 'utility'} ${num(sy.rating)}`); break;
    case 'skill': parts.push(`${sy.kind ?? 'active'}, ${sy.attribute ?? ''}`); break;
    // v0.91.4: a vehicle or drone: Handling (on-road/off-road), Speed, Body and Armor; a drone's Pilot.
    case 'vehicle': parts.push(tx('SR2E.Text.Catalogue.vehicleLine', { handling: num(sy.handlingOffroad) ? `${num(sy.handling)}/${num(sy.handlingOffroad)}` : num(sy.handling), speed: num(sy.speed), body: num(sy.body), armor: num(sy.armor) }));
      if (sy.drone) parts.push(tx('SR2E.Text.Catalogue.dronePilot', { pilot: num(sy.pilot) }));
      break;
  }
  return parts.filter(Boolean).join(' · ');
}

/** The price of `qty` of an entry (cyberware by grade and culturing; street index applied). */
export function entryPrice(type: string, s: any, qty = 1): number {
  const sy = s ?? {};
  const base = type === 'cyberware' ? wareCost(sy) : num(sy.cost);
  return itemPrice({ cost: base, streetIndex: num(sy.streetIndex, 1) || 1, quantity: Math.max(1, Math.floor(qty) || 1) });
}

/** The Availability shown in the list ("" when always available), and its TN. */
export function entryAvailability(type: string, s: any): { label: string; tn: number } {
  const sy = s ?? {};
  const text = String(sy.availability ?? '');
  if (!text.trim()) return { label: '', tn: 0 };
  if (type === 'cyberware') { const g = gradedAvailability(text, { grade: sy.grade, cultured: Boolean(sy.bioware && sy.cultured) }); return { label: g.label || text, tn: g.tn }; }
  return { label: text, tn: parseAvailability(text).tn };
}

/** Good Karma to learn a new skill at a rating (each step from 1 paid for), by its linked attribute's natural rating. */
export function newSkillKarma(o: { rating: number; attribute: number; kind: SkillKind; specializationRating?: number; specialization?: boolean }): number {
  const rating = Math.max(0, Math.floor(o.rating) || 0);
  let total = 0;
  // v0.92.3 (RULES.CORE_V923.newSkill 'book', Core p. 190): the first point of a new skill costs 1 Good Karma.
  for (let to = 1; to <= rating; to++) total += newSkillCost(to - 1, to) ?? skillCost({ to, attribute: o.attribute, kind: o.kind });
  const sr = Math.floor(o.specializationRating ?? 0);
  if (o.specialization && sr > rating) for (let to = rating + 1; to <= sr; to++) total += skillCost({ to, attribute: o.attribute, kind: o.kind, specialization: true });
  return total;
}

/** Good Karma to learn a spell at a Force. */
export function newSpellKarma(force: number): number {
  return spellKarmaCost(Math.max(1, Math.floor(force) || 1));
}

/** The linked attribute a new skill gets by its name and kind. */
export function skillAttributeFor(name: string, kind: SkillKind): string {
  if (kind === 'knowledge' || kind === 'language') return 'intelligence';
  if (kind === 'buildRepair') return 'intelligence';
  // v0.71.0 (R4): the athletics skill follows the system's own athletics test (SR2: Body).
  const ath = RULES.STREET?.athletics;
  if (ath?.skill && String(name ?? '').trim().toLowerCase() === String(ath.skill).toLowerCase()) return ath.attribute;
  return guessSkillAttribute(name);
}

/** Skill names offered by the skill picker (the player can type any name). */
export const COMMON_SKILLS: Record<SkillKind, readonly string[]> = {
  active: ['Armed Combat', 'Athletics', 'Biotech', 'Bike', 'Car', 'Clubs', 'Computer', 'Conjuring', 'Demolitions', 'Edged Weapons', 'Electronics', 'Etiquette', 'Firearms',
    'Fixed-wing Aircraft', 'Gunnery', 'Hovercraft', 'Interrogation', 'Launch Weapons', 'Leadership', 'Motorboat', 'Negotiation', 'Polearms/Staffs', 'Projectile Weapons',
    'Rotorcraft', 'Ship', 'Sorcery', 'Stealth', 'Throwing Weapons', 'Unarmed Combat', 'Vectored Thrust', 'Whips'],
  knowledge: ['Corporate Politics', 'Gang Identification', 'Magical Theory', 'Matrix Lore', 'Psychology', 'Security Procedures', 'Street Lore (home city)', 'Small Unit Tactics'],
  language: ['English', 'Japanese', 'Spanish', 'Elvish', 'Orkish', 'City slang'],
  buildRepair: ['Bike B/R', 'Car B/R', 'Computer B/R', 'Electronics B/R', 'Firearms B/R'],
};

export const SKILL_KIND_LABELS: Record<SkillKind, string> = { active: 'Active skill', knowledge: 'Knowledge skill', language: 'Language skill', buildRepair: 'Build/Repair skill' };

/** One line of the Add window's basket. */
export interface BasketLine { type: string; name: string; system: any; amount: number }

/**
 * What adding a basket costs and whether it can go through: nuyen for Buy, Good Karma for learning;
 * lines that can't be paid that way are refused with a reason.
 */
export function basketPlan(lines: readonly BasketLine[], o: { payment: AddPayment; actorType: string; nuyen: number; karma: number; attributeFor?: (line: BasketLine) => number }): { nuyen: number; karma: number; problems: string[]; per: Array<{ name: string; nuyen: number; karma: number }> } {
  const per: Array<{ name: string; nuyen: number; karma: number }> = [];
  const problems: string[] = [];
  let ny = 0, ka = 0;
  for (const l of lines) {
    const ok = paymentChoices(l.type, o.actorType).includes(o.payment);
    if (!ok) {
      const type = typeLabel(l.type, false);
      problems.push(o.payment === 'buy' ? tx('SR2E.Text.Catalogue.cantBeBought', { name: l.name, type }) : o.payment === 'karma' ? tx('SR2E.Text.Catalogue.cantBeLearned', { name: l.name, type }) : tx('SR2E.Text.Catalogue.cantBeAdded', { name: l.name, type }));

      continue;
    }
    const amt = rowAmount(l.type);
    let n = 0, k = 0;
    // Copies are capped (copiesOf) and priced as made; gear by quantity; other numbered types are bought at their listed rating.
    if (o.payment === 'buy') n = amt.kind === 'copies' ? entryPrice(l.type, l.system, 1) * copiesOf(l.type, l.amount) : entryPrice(l.type, l.system, l.type === 'gear' ? Math.max(1, Math.floor(l.amount) || 1) : 1);
    if (o.payment === 'karma') {
      if (l.type === 'spell') k = newSpellKarma(l.amount || num(l.system?.learnedForce, 1));
      else if (l.type === 'skill') k = newSkillKarma({ rating: l.amount || num(l.system?.rating, 1), attribute: o.attributeFor?.(l) ?? 3, kind: (l.system?.kind ?? 'active') as SkillKind });
    }
    if (o.payment === 'buy' && n <= 0) problems.push(tx('SR2E.Text.Catalogue.noPrice', { name: l.name }));
    per.push({ name: l.name, nuyen: n, karma: k });
    ny += n; ka += k;
  }
  if (o.payment === 'buy' && ny > o.nuyen) problems.push(tx('SR2E.Text.Catalogue.costsNuyen', { cost: ny.toLocaleString(), have: Math.max(0, o.nuyen).toLocaleString() }));
  if (o.payment === 'karma' && ka > o.karma) problems.push(tx('SR2E.Text.Catalogue.costsKarma', { cost: ka, have: Math.max(0, o.karma) }));
  return { nuyen: ny, karma: ka, problems, per };
}

/** The system data a new item gets from an entry and the row's number. */
export function systemWithAmount(type: string, system: any, amount: number): any {
  const out = { ...(system ?? {}) };
  const a = rowAmount(type);
  if (a.kind === 'value' && a.field && amount > 0) out[a.field] = Math.floor(amount);
  return out;
}

/**
 * Whether the row number is fixed for this payment: something bought (other than gear) is bought at its
 * listed rating, since the price is the entry's own (change the rating after, or add it free).
 */
export function amountLocked(type: string, payment: AddPayment): boolean {
  // v0.91.4: one vehicle per row (each is an actor of its own).
  if (type === 'vehicle') return true;
  return payment === 'buy' && rowAmount(type).kind === 'value' && type !== 'gear';
}

/** The largest number a row takes (copies are capped at 20). */
export function amountMax(type: string): number {
  return rowAmount(type).kind === 'copies' ? 20 : 99;
}

/**
 * v0.81.1 (RC2-2): the gear fields (under `system`) that never make two pieces different things: how many, the text,
 * and stolen goods' Heat. Every other field of the gear model is in GEAR_STACK_FIELDS (a test walks the schema).
 */
// v0.91.8: a formula's spell data follows its spell's name (formula.spell is compared).
export const GEAR_STACK_IGNORED: readonly string[] = ['quantity', 'description', 'heat', 'heatAt', 'formula.data'];

/**
 * v0.81.0 (RC-3): the gear fields (under `system`) that make two pieces of gear different things, for stacking: the
 * sheet's `gearStackKey` and Item Piles' ITEM_SIMILARITIES both read this list, so the two can't drift apart.
 * v0.81.1 (RC2-2): every gear field but GEAR_STACK_IGNORED, per-piece state included (damaged, worn, slotted, planted,
 * a fake SIN's covers), so a new purchase never merges into a broken, worn or planted piece. A field under a gated
 * sub-part (GATED_PARTS) counts only when that part is in use.
 */
export const GEAR_STACK_FIELDS: readonly string[] = [
  'cost', 'medkitRating', 'rcdRating', 'radio.rating', 'radio.encryption', 'explosive.power', 'explosive.perMetre', 'explosive.shaped',
  'ammoType', 'rounds', 'material', 'signal', 'jammer', 'suite', 'simrig', 'damaged', 'skillMods',
  'weight', 'concealability', 'cf', 'availability', 'streetIndex', 'legality', 'permit',
  'patch.kind', 'patch.rating', 'stealth.kind', 'stealth.rating', 'stealth.worn',
  'toxin.kind', 'toxin.vector', 'toxin.power', 'toxin.level', 'toxin.damageType', 'toxin.speed', 'toxin.effect',
  ...['body', 'quickness', 'strength', 'charisma', 'intelligence', 'willpower'].map((k) => `toxin.attributes.${k}`),
  'toxin.reaction', 'toxin.initiativeDice',
  ...['ballistic', 'impact', 'testsTn', 'perceivedTn', 'attackedTn', 'movementFactor', 'ignoreWounds', 'stunIgnoreBoxes'].map((k) => `toxin.extra.${k}`),
  'toxin.durationMinutes', 'toxin.crashPower', 'toxin.crashLevel', 'toxin.addiction', 'toxin.addictionType',
  'toxin.incubationHours', 'toxin.intervalHours', 'toxin.recoveries', 'toxin.contagious',
  'protection.kind', 'protection.rating', 'protection.worn', 'site.kind', 'site.rating', 'site.tag',
  'scanner.kind', 'scanner.rating', 'chip.kind', 'chip.skill', 'chip.rating', 'chip.slotted',
  'bypassTool.kind', 'bypassTool.rating', 'simchip.kind', 'simchip.rating', 'simchip.minutes', 'tools.level', 'tools.skill',
  'optics.lowLight', 'optics.thermographic', 'optics.flareComp', 'optics.magnification', 'optics.worn',
  'surveillance.kind', 'surveillance.rating', 'surveillance.active', 'surveillance.plantedOn', 'surveillance.plantedName',
  'identity.kind', 'identity.rating', 'identity.fake', 'identity.covers',
  // v0.91.8: a spell formula (two formulas of different spells, Forces or traditions never stack).
  'formula.spell', 'formula.force', 'formula.tradition', 'formula.category',
  // v0.92.1: carried or left behind, and custom tweaks (a piece left behind or tweaked is its own).
  'carried', 'tweaks',
];

/**
 * v0.81.1 (RC2-2): the gear model's defaults that aren't empty, 0 or false. A template leaves fields out and a saved
 * item has its defaults, so a field at its default counts as not set. A test checks these against the schema.
 */
export const GEAR_STACK_DEFAULTS: Readonly<Record<string, unknown>> = {
  'toxin.vector': 'injection', 'toxin.power': 6, 'toxin.level': 'M', 'toxin.damageType': 'physical', 'toxin.speed': 'immediate',
  'toxin.extra.movementFactor': 1, 'toxin.addictionType': 'mental', 'toxin.incubationHours': 24, 'toxin.intervalHours': 24,
  'explosive.perMetre': 1, 'simchip.minutes': 10, 'tools.level': 'none', 'surveillance.active': true, 'streetIndex': 1,
  'carried': true,
};

/** Sub-parts (and the field saying they are in use) whose other fields keep their defaults while it is unset. */
const GATED_PARTS: Readonly<Record<string, string>> = {
  toxin: 'kind', chip: 'kind', patch: 'kind', protection: 'kind', scanner: 'kind', identity: 'kind', surveillance: 'kind',
  formula: 'spell',
  simchip: 'kind', stealth: 'kind', bypassTool: 'kind', site: 'kind', explosive: 'power', tools: 'level',
};

/**
 * What makes two pieces of gear the same thing for stacking: everything that changes what it does or is per piece
 * (GEAR_STACK_FIELDS), not the quantity. Missing fields and fields at their default count as empty.
 */
export function gearStackKey(name: string, s: any): string {
  const sy = s ?? {};
  const at = (path: string): unknown => path.split('.').reduce<any>((o, k) => (o && typeof o === 'object' && Object.hasOwn(o, k) ? o[k] : undefined), sy);
  // Empty, 0, false and the model's default all mean "not set" (a template leaves fields out; a saved item has its defaults).
  const norm = (path: string): string => {
    const v = at(path);
    if (v === 0 || v === '' || v === false || v == null || (Array.isArray(v) && !v.length)) return '';
    if (Object.hasOwn(GEAR_STACK_DEFAULTS, path) && v === GEAR_STACK_DEFAULTS[path]) return '';
    return typeof v === 'object' ? JSON.stringify(v) : String(v);
  };
  const values = GEAR_STACK_FIELDS.map((f) => {
    const head = f.split('.')[0]!;
    const gate = own(GATED_PARTS, head);
    // A sub-part (toxin, chip...) counts only when it is in use: its other fields keep defaults otherwise.
    if (gate && f !== `${head}.${gate}` && !norm(`${head}.${gate}`)) return '';
    return norm(f);
  });
  return JSON.stringify([String(name ?? '').trim().toLowerCase(), ...values]);
}

/** How many items one basket line makes. */
export function copiesOf(type: string, amount: number): number {
  return rowAmount(type).kind === 'copies' ? Math.max(1, Math.min(20, Math.floor(amount) || 1)) : 1;
}

/** Whether a row's text matches the sheet search (every word, any order, case-insensitive). */
export function matchesSearch(text: string, query: string): boolean {
  const words = String(query ?? '').toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const t = String(text ?? '').toLowerCase();
  return words.every((w) => t.includes(w));
}

/** One setup warning: what's wrong, where to look (tab and the heading to scroll to). */
export interface SetupWarning { text: string; tab: string; find: string; level: 'warn' | 'note' }

/** What the warnings banner needs to know about an actor (gathered by the sheet). */
export interface SetupInput {
  actorType: string;
  attributes: Array<{ key: string; label: string; base: number }>;
  attributeWarnings: string[];
  essence: number;
  cyberWarnings: string[];
  adeptOver: string[];
  magic: number;
  /** v0.71.0 (R4): `attribute` (the linked attribute), when known, for the Athletics check. */
  skills: Array<{ name: string; attribute?: string }>;
  items: Array<{ id: string; type: string; name: string; system: any }>;
  build: Array<{ label: string; used: string | number; allowed: string | number; ok: boolean; note?: string }>;
}

/** The setup warnings, most important first. */
export function setupWarnings(i: SetupInput): SetupWarning[] {
  const out: SetupWarning[] = [];
  const person = ['character', 'npc'].includes(i.actorType);
  const has = (name: string) => i.skills.some((s) => s.name.trim().toLowerCase() === name.trim().toLowerCase());
  if (person) for (const a of i.attributes) if (!(a.base > 0)) out.push({ text: tx('SR2E.Text.Catalogue.attributeIsZero', { label: a.label, base: a.base }), tab: 'main', find: 'Attributes', level: 'warn' });
  for (const w of i.attributeWarnings) out.push({ text: w, tab: 'main', find: 'Attributes', level: 'warn' });
  if (person && i.essence < 0) out.push({ text: tx('SR2E.Text.Catalogue.essenceNegative', { essence: i.essence }), tab: 'gear', find: 'Cyberware', level: 'warn' });
  for (const w of i.cyberWarnings) out.push({ text: w, tab: 'gear', find: 'Cyberware', level: 'warn' });
  for (const n of i.adeptOver) out.push({ text: tx('SR2E.Text.Catalogue.overPowerPoints', { name: n }), tab: 'magic', find: 'Adept powers', level: 'warn' });
  for (const r of i.build.filter((b) => !b.ok)) out.push({ text: r.note ? tx('SR2E.Text.Catalogue.buildOverNote', { label: r.label, used: r.used, allowed: r.allowed, note: r.note }) : tx('SR2E.Text.Catalogue.buildOver', { label: r.label, used: r.used, allowed: r.allowed }), tab: 'bio', find: 'Build', level: 'warn' });
  if (person && !i.skills.length) out.push({ text: tx('SR2E.Text.Catalogue.noSkillsYet'), tab: 'main', find: 'Active skills', level: 'note' });
  // v0.71.0 (R4): older characters may have Athletics linked to Quickness (the old starter list); fix by hand.
  if (RULES.STREET?.athletics?.attribute !== 'quickness') for (const s of i.skills) {
    if (s.name.trim().toLowerCase() === 'athletics' && String(s.attribute ?? '').toLowerCase() === 'quickness') out.push({ text: tx('SR2E.Text.Catalogue.athleticsQuickness'), tab: 'main', find: 'Active skills', level: 'warn' });
  }
  const spells = i.items.filter((x) => x.type === 'spell');
  if (spells.length && !(i.magic > 0)) out.push({ text: tCount(spells.length, 'SR2E.Text.Catalogue.spellsButNoMagic'), tab: 'magic', find: 'Spells', level: 'warn' });
  else if (spells.length && person && !has('Sorcery')) out.push({ text: tx('SR2E.Text.Catalogue.spellsNoSorcery'), tab: 'main', find: 'Active skills', level: 'note' });
  for (const it of i.items) {
    const s = it.system ?? {};
    if (it.type === 'weapon') {
      const skill = String(s.skill ?? '').trim();
      if (person && skill && i.skills.length && !has(skill)) out.push({ text: tx('SR2E.Text.Catalogue.weaponSkillMissing', { name: it.name, skill }), tab: 'combat', find: 'Weapons', level: 'note' });
      if (num(s.ammoMax) > 0 && num(s.ammo) <= 0 && !s.melee) out.push({ text: tx('SR2E.Text.Catalogue.weaponEmpty', { name: it.name }), tab: 'combat', find: 'Weapons', level: 'note' });
    }
    if (it.type === 'cyberware' && s.installed === false) out.push({ text: tx('SR2E.Text.Catalogue.notInstalled', { name: it.name }), tab: 'gear', find: 'Cyberware', level: 'note' });
    if (it.type === 'focus' && s.bonded === false) out.push({ text: tx('SR2E.Text.Catalogue.notBonded', { name: it.name }), tab: 'magic', find: 'Foci', level: 'note' });
    for (const w of itemWarnings(it.type, s)) out.push({ text: `${it.name}: ${w}`, tab: tabForType(it.type), find: findForType(it.type), level: 'warn' });
  }
  return out.sort((a, b) => (a.level === b.level ? 0 : a.level === 'warn' ? -1 : 1));
}

/** The character sheet tab that lists a type. */
export function tabForType(type: string): string {
  return ({ skill: 'main', weapon: 'combat', armor: 'combat', gear: 'gear', cyberware: 'gear', spell: 'magic', power: 'magic', focus: 'magic', adeptpower: 'magic', cyberdeck: 'matrix', program: 'matrix', vehicle: 'rigging' } as Record<string, string>)[type] ?? 'main';
}

/** The heading that lists a type on the character sheet. */
export function findForType(type: string): string {
  return ({ skill: 'Active skills', weapon: 'Weapons', armor: 'Armor', gear: 'Gear', cyberware: 'Cyberware', spell: 'Spells', power: 'Powers', focus: 'Foci', adeptpower: 'Adept powers', cyberdeck: 'Cyberdecks', program: 'Programs', vehicle: 'Rigging' } as Record<string, string>)[type] ?? '';
}

/** The pinned quick action for an item type (the sheet action and its button label), or null. */
export function pinAction(type: string): { action: string; verb: string; icon: string } | null {
  return ({
    weapon: { action: 'attackWeapon', verb: tx('SR2E.Text.Catalogue.attack'), icon: 'fa-solid fa-crosshairs' },
    spell: { action: 'castSpell', verb: tx('SR2E.Text.Catalogue.cast'), icon: 'fa-solid fa-wand-sparkles' },
    skill: { action: 'rollSkill', verb: tx('SR2E.Text.Catalogue.roll'), icon: 'fa-solid fa-dice' },
    power: { action: 'usePower', verb: tx('SR2E.Text.Catalogue.use'), icon: 'fa-solid fa-bolt' },

  } as Record<string, { action: string; verb: string; icon: string }>)[type] ?? null;
}

/** A pin list with gone items and duplicates dropped (at most 12). */
export function cleanPins(pins: unknown, exists: (id: string) => boolean): string[] {
  const list = Array.isArray(pins) ? pins.map(String) : [];
  return [...new Set(list)].filter(exists).slice(0, 12);
}

/** Turn a pin on or off. */
export function togglePin(pins: unknown, id: string): string[] {
  const list = Array.isArray(pins) ? pins.map(String) : [];
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id].slice(-12);
}

/** A copy's name: "Knife (copy)", "Knife (copy 2)"… not taken by `taken`. */
export function copyName(name: string, taken: readonly string[]): string {
  const base = String(name ?? '').replace(/\s*\(copy(?: \d+)?\)$/, '');
  const set = new Set(taken.map((t) => t.toLowerCase()));
  let n = 1, candidate = `${base} (copy)`;
  while (set.has(candidate.toLowerCase())) { n += 1; candidate = `${base} (copy ${n})`; }
  return candidate;
}

/** The key a folded section is remembered by (actor type, tab and heading words; counts and numbers dropped). */
export function foldKey(actorType: string, tab: string, heading: string): string {
  const words = String(heading ?? '').replace(/\d+/g, '').replace(/[^A-Za-z/ ]+/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  return `${actorType}:${tab}:${words}`;
}
