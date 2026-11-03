/**
 * Magic and critters, plan 3 step 4 (v0.45.0): the rest of metamagic (cleansing, divining,
 * invoking, possessing, reflecting), initiation ordeals and group initiation, spell design,
 * magical groups, toxic and insect shamans, sustained critter powers, noticing a ritual, paying
 * for libraries, circles and lodges, ghouls' and vampires' diet, and fire spreading on a scene.
 * Pure rules; no Foundry. Values in RULES.OCCULT, RULES.FIRE and RULES.CRITTERS.diet.
 */
import { RULES, type DamageLevel } from './config.ts';
import { isShamanic, isHermetic } from './arcana.ts';
import { bestSite, type BackgroundSource, type MagicSite, type SiteKind } from './mysticism.ts';
import { urrMagSiteCost } from './urr80-magic.ts';
import { t as tx, tCount, tList } from '../helpers/i18n.ts';

const O = () => RULES.OCCULT;
const LEVELS: readonly DamageLevel[] = ['L', 'M', 'S', 'D'];

// ---------------------------------------------------------------- Cleansing

/** The cleansing test's TN against a background count (a toxic one is harder). */
export function cleansingTn(count: number, toxic = false): number {
  const c = O().metamagic.cleansing;
  return Math.max(2, Math.max(0, Math.floor(count)) * c.tnPerPoint + (toxic ? c.toxicTn : 0));
}

/** Points of background count a cleansing takes off. */
export function cleansingPoints(successes: number): number {
  const per = Math.max(1, O().metamagic.cleansing.successesPerPoint);
  return Math.max(0, Math.floor(Math.max(0, successes) / per));
}

/**
 * Take `points` off the scene's background count: the plain count first, then the strongest
 * source that is not aligned to the cleanser (sources at 0 are dropped).
 */
export function applyCleansing(plain: number, sources: readonly BackgroundSource[], points: number, align: readonly string[] = []): { plain: number; sources: BackgroundSource[]; removed: number } {
  const mine = align.map((a) => a.toLowerCase());
  let left = Math.max(0, Math.floor(points));
  let p = Math.max(0, Math.floor(plain));
  const list = sources.map((s) => ({ ...s, aspect: [...s.aspect] }));
  let removed = 0;
  const take = Math.min(left, p);
  p -= take; left -= take; removed += take;
  while (left > 0) {
    const cands = list.filter((s) => s.rating > 0 && !(s.aspect.length && s.aspect.some((a) => mine.includes(a))));
    if (!cands.length) break;
    const top = cands.reduce((a, b) => (b.rating > a.rating ? b : a));
    top.rating -= 1; left -= 1; removed += 1;
  }
  return { plain: p, sources: list.filter((s) => s.rating > 0), removed };
}

// ---------------------------------------------------------------- Divining

/** The divining TN for a kind of question asked some weeks ahead. */
export function diviningTn(question: string, weeksAhead = 0): { tn: number; label: string } {
  const d = O().metamagic.divining;
  const q = d.tns.find((x) => x.id === question) ?? d.tns[0]!;
  return { tn: Math.max(2, q.tn + Math.max(0, Math.floor(weeksAhead)) * d.tnPerWeek), label: q.label };
}

/** How clear the answer is, by successes. */
export function diviningAnswer(successes: number): string {
  const a = O().metamagic.divining.answers;
  return a[Math.min(a.length - 1, Math.max(0, Math.floor(successes)))] ?? '';
}

// ---------------------------------------------------------------- Invoking

/** The invoking test's TN against a spirit of this Force. */
export function invokingTn(force: number): number {
  return Math.max(2, Math.max(1, Math.floor(force)) + O().metamagic.invoking.tnModifier);
}

/** Who can be invoked: the initiate's own nature spirit or elemental, not already great, owing a service. */
export function invokeProblem(spirit: { kind: string; summonerUuid: string; services: number; greatForm?: boolean }, initiateUuid: string): string | null {
  if (!['nature', 'elemental'].includes(spirit.kind)) return tx('SR2E.Text.Occult.onlyNatureSpiritsAndElementals');
  if (spirit.summonerUuid !== initiateUuid) return tx('SR2E.Text.Occult.itIsNotThisInitiates');
  if (spirit.greatForm) return tx('SR2E.Text.Occult.itIsAlreadyAGreat');
  const cost = O().metamagic.invoking.servicesCost;
  if (cost > 0 && spirit.services < cost) return tCount(cost, 'SR2E.Text.Occult.invokingCostsServices');
  return null;
}

// ---------------------------------------------------------------- Possessing

/** Opposed possession: the possessor needs more successes than the target. */
export function possessionOutcome(possessorSuccesses: number, targetSuccesses: number): { possessed: boolean; net: number } {
  const net = possessorSuccesses - targetSuccesses;
  return { possessed: possessorSuccesses > 0 && net > 0, net };
}

/** The possessed body's attributes: the possessor's mental ones replace its own. */
export function possessedAttributes<T extends Record<string, number>>(body: T, possessor: Record<string, number>): T {
  const out: Record<string, number> = { ...body };
  for (const k of O().metamagic.possessing.mental) if (typeof possessor[k] === 'number') out[k] = possessor[k]!;
  return out as T;
}

// ---------------------------------------------------------------- Reflecting

/** Successes a reflecting initiate bounces back at the caster (0 = nothing reflected). */
export function reflectedSuccesses(casterSuccesses: number, resistSuccesses: number, spellDefense = 0): number {
  if (O().metamagic.reflecting.needsSpellDefense && !(spellDefense > 0)) return 0;
  return Math.max(0, resistSuccesses - Math.max(0, casterSuccesses));
}

// ---------------------------------------------------------------- Initiation

export interface Ordeal { id: string; label: string; effect: '' | 'attribute' | 'geas' | 'quest' | 'deed' | 'familiar' | 'meditation' | 'oath' | 'thesis' }

export function ordealById(id: string | null | undefined): Ordeal | null {
  return (O().initiation.ordeals.find((o) => o.id === id) as Ordeal | undefined) ?? null;
}

/** Initiation's Good Karma: (base + grade) × the multiplier (alone or in a group, less an ordeal). */
export function initiationCost(newGrade: number, o: { group?: boolean; ordeal?: boolean } = {}): { cost: number; multiplier: number } {
  const i = O().initiation;
  const k = RULES.MAGIC_EXTRA.karmaCosts;
  const base = o.group ? i.multipliers.group : i.multipliers.self;
  const multiplier = Math.max(i.minMultiplier, base - (o.ordeal ? i.ordealReduction : 0));
  return { cost: Math.max(0, Math.ceil((k.initiationBase + Math.max(1, Math.floor(newGrade))) * multiplier)), multiplier };
}

/** What a magician lacks to initiate to this grade (a library, or a lodge of the totem). */
export function initiationSiteMissing(tradition: string, sites: readonly MagicSite[], grade: number, totem = ''): string[] {
  if (O().initiation.site === 'off') return [];
  const out: string[] = [];
  const need = (kind: SiteKind, tag: string, what: string) => {
    const s = bestSite(sites, kind, tag);
    if (!s) out.push(what);
    else if (s.rating < grade) out.push(tx('SR2E.Text.Occult.siteOfRatingOrMore', { what, grade, name: s.name, rating: s.rating }));
  };
  if (isHermetic(tradition)) need('library', '', tx('SR2E.Text.Occult.aLibrary'));
  else if (isShamanic(tradition)) need('lodge', totem, totem ? tx('SR2E.Text.Occult.aLodgeTotem', { totem }) : tx('SR2E.Text.Occult.aLodge'));
  return out;
}

// ---------------------------------------------------------------- Spell design

export interface SpellDesign {
  category: string; spellType: 'mana' | 'physical'; area?: boolean; duration?: string; elemental?: boolean;
  touch?: boolean; damageType?: 'physical' | 'stun'; damageLevel?: DamageLevel; resisted?: boolean;
  /** v0.48.0: a very restricted target, a detection spell's extended range, a one-sense illusion; exclusive and fetish (flags on the spell). */
  restricted?: boolean; extendedRange?: boolean; singleSense?: boolean; exclusive?: boolean; fetish?: boolean;
}

/** The drain code a design gives: TN modifier (on Force ÷ 2) and level, with the reasons. */
export function designDrain(d: SpellDesign): { drainModifier: number; drainLevel: DamageLevel; notes: string[] } {
  const g = O().design;
  const m = g.modifiers;
  const combat = d.category === 'combat';
  let level: DamageLevel = combat ? (d.damageLevel ?? 'M') : (g.baseLevel[d.category] ?? 'M');
  let mod = 0;
  const notes: string[] = [];
  const add = (on: boolean | undefined, n: number, why: string) => { if (on && n) { mod += n; notes.push(tx('SR2E.Text.Occult.designNote', { why, value: `${n > 0 ? '+' : ''}${n}` })); } };
  add(d.spellType === 'physical', m.physical, tx('SR2E.Text.Occult.physical'));
  add(d.area, m.area, tx('SR2E.Text.Occult.area'));
  add(d.duration === 'sustained', m.sustained, tx('SR2E.Text.Occult.sustained'));
  add(d.duration === 'permanent', m.permanent, tx('SR2E.Text.Occult.permanent'));
  add(d.touch, m.touch, tx('SR2E.Text.Occult.touch'));
  add(combat && d.damageType === 'stun', m.stun, tx('SR2E.Text.Occult.stunDamage'));
  add(!combat && d.resisted, m.resisted, tx('SR2E.Text.Occult.resisted'));
  add(d.restricted, m.restricted, tx('SR2E.Text.Occult.veryRestrictedTarget'));
  add(d.category === 'detection' && d.extendedRange, m.extendedRange, tx('SR2E.Text.Occult.extendedRange'));
  add(d.category === 'illusion' && d.singleSense, m.singleSense, tx('SR2E.Text.Occult.oneSense'));
  // Exclusive and fetish spells keep their own drain TN changes, applied when cast (RULES.SPELLCRAFT).
  if (d.exclusive) notes.push(tx('SR2E.Text.Occult.exclusiveWhenCast', { mod: RULES.SPELLCRAFT.exclusiveDrainMod }));
  if (d.fetish) notes.push(tx('SR2E.Text.Occult.fetishWhenCast', { mod: RULES.SPELLCRAFT.fetishDrainMod }));
  if (d.elemental && m.elemental) {
    const i = LEVELS.indexOf(level);
    level = LEVELS[Math.min(LEVELS.length - 1, i + m.elemental)]!;
    notes.push(tx('SR2E.Text.Occult.elementalLevel', { elemental: m.elemental }));
  }
  return { drainModifier: mod, drainLevel: level, notes };
}

/** The design test: TN, and dice a library or lodge adds. */
export function designTest(force: number, siteRating = 0): { tn: number; siteDice: number } {
  const g = O().design;
  return { tn: Math.max(2, Math.max(1, Math.floor(force)) + g.tnModifier), siteDice: Math.max(0, Math.floor(siteRating)) * g.siteDicePerRating };
}

/** Days to design a spell (null = the design failed). */
export function designDays(force: number, successes: number): number | null {
  if (!(successes > 0)) return null;
  return Math.max(1, Math.ceil(Math.max(1, force) * O().design.daysPerForce / successes));
}

// ---------------------------------------------------------------- Magical groups

export interface Stricture { id: string; text: string }
export interface Breach { uuid: string; strictureId: string; at: number }
export interface GrimoireSpell { name: string; system: Record<string, unknown> }
export interface MagicGroup {
  id: string; name: string; tradition: string; members: string[]; strictures: Stricture[];
  sites: MagicSite[]; grimoire: GrimoireSpell[]; breaches: Breach[]; notes: string;
}

/** A group with blanks filled in (world settings may hold older shapes). */
export function normalizeGroup(g: Partial<MagicGroup> & { id?: string }): MagicGroup {
  return {
    id: String(g.id ?? ''), name: String(g.name ?? 'Magical group'), tradition: String(g.tradition ?? ''),
    members: [...(g.members ?? [])].map(String), strictures: [...(g.strictures ?? [])].map((s: any) => ({ id: String(s.id ?? ''), text: String(s.text ?? '') })),
    sites: [...(g.sites ?? [])].map((s: any) => ({ name: String(s.name ?? ''), kind: (s.kind ?? '') as SiteKind, rating: Math.max(0, Number(s.rating) || 0), tag: String(s.tag ?? '') })),
    grimoire: [...(g.grimoire ?? [])].map((s: any) => ({ name: String(s.name ?? ''), system: { ...(s.system ?? {}) } })),
    breaches: [...(g.breaches ?? [])].map((b: any) => ({ uuid: String(b.uuid ?? ''), strictureId: String(b.strictureId ?? ''), at: Number(b.at) || 0 })),
    notes: String(g.notes ?? ''),
  };
}

/** The groups an actor belongs to (by UUID; a synthetic token actor matches its base actor's UUID too). */
export function groupsOf(groups: readonly MagicGroup[], uuids: readonly string[]): MagicGroup[] {
  return groups.filter((g) => g.members.some((m) => uuids.includes(m)));
}

/** Whether a member has an open stricture breach. */
export function inBreach(group: MagicGroup, uuids: readonly string[]): boolean {
  return group.breaches.some((b) => uuids.includes(b.uuid));
}

/** Sites a member may use: the groups' own, unless in breach (RULES.OCCULT.groups.shareSites). */
export function groupSites(groups: readonly MagicGroup[], uuids: readonly string[]): MagicSite[] {
  if (!O().groups.shareSites) return [];
  return groupsOf(groups, uuids).filter((g) => !inBreach(g, uuids)).flatMap((g) => g.sites.map((s) => ({ ...s, name: `${s.name} (${g.name})` })));
}

// ---------------------------------------------------------------- Toxic and insect shamans

/** Whether the optional traditions are in play. */
export function optionalTraditionOn(tradition: string): boolean {
  return !['toxic', 'insect'].includes(tradition) || O().traditions.enabled;
}

/** A tradition limited to some spirit kinds: a warning for any other kind, or null. */
export function traditionKindWarning(tradition: string, spiritKind: string): string | null {
  const only = O().traditions.spirits[tradition];
  if (!only?.length || only.includes(spiritKind)) return null;
  const kinds = tList(only.map((k) => tx('SR2E.Text.Occult.kindSpirits', { kind: k })), 'disjunction');
  return tradition === 'toxic' ? tx('SR2E.Text.Occult.toxicShamansSummonOnly', { kinds }) : tx('SR2E.Text.Occult.insectShamansSummonOnly', { kinds });
}

/** Insect shamans summoning without a hive (a lodge). */
export function hiveMissing(tradition: string, sites: readonly MagicSite[]): boolean {
  return tradition === 'insect' && O().traditions.insectNeedsHive && !sites.some((s) => s.kind === 'lodge');
}

// ---------------------------------------------------------------- Sustained and attribute-changing powers

/** A sustained power's attribute changes at this many net successes. */
export function powerAttributeChanges(attributes: Record<string, number>, perSuccess: boolean, net: number): Record<string, number> {
  const n = Math.max(0, Math.floor(net));
  const cap = O().powers.maxPerSuccess;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(attributes ?? {})) {
    const d = Math.trunc(Number(v) || 0);
    if (!d) continue;
    out[k] = perSuccess ? d * Math.min(n, cap > 0 ? cap : n) : d;
  }
  return out;
}

/** Whether any attribute changes. */
export function hasAttributeChange(attributes: Record<string, number> | undefined): boolean {
  return Object.values(attributes ?? {}).some((v) => Math.trunc(Number(v) || 0) !== 0);
}

// ---------------------------------------------------------------- Noticing a ritual

/** The TN for a ritual's target to notice it, or null if they can't (mundanes, house rule off). */
export function ritualNoticeTn(o: { awakened: boolean; astral: boolean }): number | null {
  const r = O().ritualNotice;
  if (!r.enabled) return null;
  if (!o.awakened && !r.mundanes) return null;
  return Math.max(2, r.tn - (o.astral ? r.astralBonus : 0));
}

// ---------------------------------------------------------------- Libraries, circles and lodges

/** Raising a site from one rating to another: nuyen and days. */
export function siteRaiseCost(kind: string, from: number, to: number): { nuyen: number; days: number } {
  const s = O().sites;
  const per = s.nuyenPerRating[kind] ?? RULES.MAGIC_V39.sites.nuyenPerRating;
  const diff = Math.max(0, Math.floor(to) - Math.max(0, Math.floor(from)));
  // v0.80.0 (RULES.URR_V80.magSiteCost 'urr', URR): a library costs rating² × the price; a circle takes hours.
  const urr = urrMagSiteCost(kind, from, to, per, s.daysPerRating);
  if (urr) return urr;
  return { nuyen: diff * per, days: diff * s.daysPerRating };
}

// ---------------------------------------------------------------- Ghouls' and vampires' diet

/** Days since the last meal, and whether the critter is going hungry. */
export function hunger(lastFed: number, now: number): { days: number; hungry: boolean; tn: number } {
  const d = RULES.CRITTERS.diet;
  const days = Number.isFinite(lastFed) ? Math.max(0, (now - lastFed) / 86400) : 0;
  const hungry = Number.isFinite(lastFed) && d.hungerDays > 0 && days >= d.hungerDays;
  return { days: Math.floor(days), hungry, tn: hungry ? d.hungerTn : 0 };
}

// ---------------------------------------------------------------- Fire on the scene

export interface SceneFire {
  id: string; x: number; y: number; radius: number; turns: number; intensity: string;
  source: string; startedAt: number; lastTick: number; drawingId?: string;
  /** v0.48.0: the fuel it burns on (RULES.FIRE.fuel.kinds), how far that fuel lets it grow (metres), the fuel drawing. */
  fuel?: string; maxRadius?: number; fuelId?: string;
  /** v0.48.0: burnt out, only smoke left for `smokeLeft` more Combat Turns. */
  burntOut?: boolean; smokeLeft?: number;
}

/** A fuel kind's numbers (none for an unknown kind). */
export function fuelKind(id: string | null | undefined): { label: string; metresPerTurn: number; extraTurns: number; intensitySteps: number } | null {
  return (id && RULES.FIRE.fuel.kinds[id]) || null;
}

/** A new fire at a point (pixels); on fuel it starts hotter and can grow over the fuel (v0.48.0). */
export function newFire(o: { id: string; x: number; y: number; source: string; now: number; radius?: number; fuel?: string; maxRadius?: number; fuelId?: string }): SceneFire {
  const f = RULES.FIRE;
  const fk = fuelKind(o.fuel);
  return {
    id: o.id, x: o.x, y: o.y, radius: Math.max(0.5, o.radius ?? f.startRadius), turns: 0, intensity: fireIntensity(0, o.fuel), source: o.source, startedAt: o.now, lastTick: o.now,
    ...(fk ? { fuel: o.fuel } : {}), ...(o.maxRadius ? { maxRadius: Math.max(0.5, o.maxRadius) } : {}), ...(o.fuelId ? { fuelId: o.fuelId } : {}),
  };
}

/** The intensity after this many Combat Turns burning (fuel starts it hotter, v0.48.0). */
export function fireIntensity(turns: number, fuel?: string): string {
  const f = RULES.FIRE;
  const ids = RULES.HAZARDS.fire.intensities.map((i) => i.id);
  const top = ids.indexOf(f.maxIntensity) >= 0 ? ids.indexOf(f.maxIntensity) : ids.length - 1;
  const start = Math.min(Math.max(0, ids.indexOf(f.intensity)) + Math.max(0, fuelKind(fuel)?.intensitySteps ?? 0), ids.length - 1);
  const steps = f.escalateTurns > 0 ? Math.floor(Math.max(0, turns) / f.escalateTurns) : 0;
  return ids[Math.min(Math.max(start, top), start + steps)] ?? f.intensity;
}

/** One Combat Turn later: bigger and hotter, or burnt out (fuel makes it grow faster and last longer). */
export function fireTurn(fire: SceneFire): { fire: SceneFire; out: boolean } {
  const f = RULES.FIRE;
  const fk = fuelKind(fire.fuel);
  const turns = fire.turns + 1;
  const lasts = f.turns > 0 ? f.turns + (fk?.extraTurns ?? 0) : 0;
  const out = lasts > 0 && turns >= lasts;
  const cap = Math.max(fire.radius, f.maxRadius, fire.maxRadius ?? 0);
  return { fire: { ...fire, turns, radius: Math.min(cap, fire.radius + f.metresPerTurn + (fk?.metresPerTurn ?? 0)), intensity: fireIntensity(turns, fire.fuel) }, out };
}

/** Combat Turns' worth of world time since the last tick (outside combat). */
export function fireTurnsElapsed(lastTick: number, now: number): number {
  const s = RULES.FIRE.secondsPerTurn;
  return s > 0 ? Math.max(0, Math.floor((now - lastTick) / s)) : 0;
}

/** A group's sites from text, one per line: `Name: library 4 sorcery` (kind, rating, optional tag). */
export function parseGroupSites(text: string): MagicSite[] {
  const out: MagicSite[] = [];
  for (const raw of String(text ?? '').split(/\r?\n/)) {
    const m = /^(.+?):\s*(library|circle|lodge)\s+(\d+)\s*(.*)$/i.exec(raw.trim());
    if (m) out.push({ name: m[1]!.trim(), kind: m[2]!.toLowerCase() as SiteKind, rating: Number(m[3]), tag: (m[4] ?? '').trim() });
  }
  return out;
}

/** A group's sites written back as text. */
export function formatGroupSites(list: readonly MagicSite[]): string {
  return list.map((s) => `${s.name}: ${s.kind} ${s.rating}${s.tag ? ` ${s.tag}` : ''}`).join('\n');
}
