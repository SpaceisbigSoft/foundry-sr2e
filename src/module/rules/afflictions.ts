/**
 * Health, magic and critters leftovers, plan 4 step 2 (v0.48.0): fire burning through walls and
 * along fuel, smoke from fires, contagion between characters and from a ghoul's bite, long-term
 * radiation sickness, weather on driving and movement, care during recovery from surgery, a
 * possessed body's skills, ally spirits by ritual and the rest of the initiation ordeals.
 * Pure rules; no Foundry. Values in RULES.FIRE, RULES.HEALTH, RULES.BIOWARE.recovery,
 * RULES.CRITTERS.infection and RULES.OCCULT.
 */
import { allyKarmaBook, allyMagicCost } from './spirits923.ts';
import { RULES, type DamageLevel } from './config.ts';
import type { SceneFire } from './occult.ts';
import { levelIndex, own } from './util.ts';
import { t as tx } from '../helpers/i18n.ts';

export interface Pt { x: number; y: number }

// ---------------------------------------------------------------- Fire: walls, fuel, smoke

/** Distance (same units as the points) from point `c` to the segment a–b. */
export function segmentPointDistance(a: Pt, b: Pt, c: Pt): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 > 0 ? Math.max(0, Math.min(1, ((c.x - a.x) * dx + (c.y - a.y) * dy) / len2)) : 0;
  return Math.hypot(c.x - (a.x + t * dx), c.y - (a.y + t * dy));
}

/**
 * How far a fire's smoke reaches (metres): its radius plus the smoke beyond. The same for a burnt-out fire:
 * its smoke lingers over the burnt area (smokeOnLine counts it as smoke, not flames).
 */
export function smokeRadius(fire: Pick<SceneFire, 'radius'>): number {
  const s = RULES.FIRE.smoke;
  return Math.max(0, fire.radius) + Math.max(0, s.extraMetres);
}

export type SmokeKind = 'none' | 'smoke' | 'thermal';
const SMOKE_RANK: Record<SmokeKind, number> = { none: 0, smoke: 1, thermal: 2 };

/**
 * The worst smoke a line passes through (including its ends): the flames of a burning fire count as
 * RULES.FIRE.smoke.flamesKind, the smoke around them (and a burnt-out fire's lingering smoke) as
 * `kind`. `ppm` is pixels per metre.
 */
export function smokeOnLine(a: Pt, b: Pt, fires: readonly SceneFire[], ppm: number): { kind: SmokeKind; source: string; flames: boolean } {
  const s = RULES.FIRE.smoke;
  let best: { kind: SmokeKind; source: string; flames: boolean } = { kind: 'none', source: '', flames: false };
  if (!s.enabled || !(ppm > 0)) return best;
  for (const f of fires) {
    const d = segmentPointDistance(a, b, f) / ppm;
    const flames = !f.burntOut && d <= f.radius + 1e-6;
    const inSmoke = d <= smokeRadius(f) + 1e-6;
    if (!inSmoke) continue;
    const kind: SmokeKind = flames ? s.flamesKind : s.kind;
    if (SMOKE_RANK[kind] > SMOKE_RANK[best.kind]) best = { kind, source: f.source, flames };
  }
  return best;
}

/** Barrier rating a burning wall loses each time the fire spreads, by the fire's intensity. */
export function wallBurn(intensity: string): number {
  return Math.max(0, Math.floor(own(RULES.FIRE.walls.burnPerTurn, intensity) ?? 0));
}

/** A burnable wall's rating after one spread of the fire (0 = burnt through). */
export function burnWall(rating: number, intensity: string): { left: number; loss: number; burntThrough: boolean } {
  const r = Math.max(0, Math.floor(rating));
  const loss = Math.min(r, wallBurn(intensity));
  const left = r - loss;
  return { left, loss, burntThrough: r > 0 && left === 0 };
}

/** Whether a circle (centre, radius in pixels) touches a rectangle (pixels). */
export function circleTouchesRect(c: Pt, r: number, rect: { x: number; y: number; width: number; height: number }): boolean {
  const nx = Math.max(rect.x, Math.min(c.x, rect.x + rect.width));
  const ny = Math.max(rect.y, Math.min(c.y, rect.y + rect.height));
  return Math.hypot(c.x - nx, c.y - ny) <= r + 1e-6;
}

/** The point of a rectangle nearest to `c`. */
export function nearestRectPoint(c: Pt, rect: { x: number; y: number; width: number; height: number }): Pt {
  return { x: Math.max(rect.x, Math.min(c.x, rect.x + rect.width)), y: Math.max(rect.y, Math.min(c.y, rect.y + rect.height)) };
}

/** How far a fire at a fuel area's centre must grow to cover it (metres, half its diagonal). */
export function fuelSpan(rect: { width: number; height: number }, ppm: number): number {
  return ppm > 0 ? Math.round((Math.hypot(rect.width, rect.height) / 2 / ppm) * 10) / 10 : 0;
}

/** Smoke inhalation at a fire's intensity: Power, level, type (null when off). */
export function smokeInhalation(intensity: string): { power: number; level: DamageLevel; type: 'physical' | 'stun' } | null {
  const i = RULES.FIRE.smoke.inhalation;
  if (!RULES.FIRE.smoke.enabled || !i.enabled) return null;
  const ids = RULES.HAZARDS.fire.intensities.map((x) => x.id);
  const step = Math.max(0, ids.indexOf(intensity));
  return { power: Math.max(1, i.power + step * i.powerPerIntensity), level: i.level, type: i.type };
}

// ---------------------------------------------------------------- Contagion

export const CONTAGION_VECTORS = ['', 'airborne', 'contact', 'blood'] as const;
export type ContagionVector = (typeof CONTAGION_VECTORS)[number];

/** The toxin vector a contagion travels by (gas masks stop airborne ones, chemsuits help with contact). */
export function contagionToxinVector(v: string): string {
  return v === 'airborne' ? 'inhalation' : v === 'contact' ? 'contact' : 'injection';
}

/** Who a carrier can pass a disease to: everyone near (airborne), or chosen people (contact, blood). */
export function contagionReach(v: string): 'nearby' | 'targets' | null {
  return v === 'airborne' ? 'nearby' : v === 'contact' || v === 'blood' ? 'targets' : null;
}

export interface DiseaseEntry {
  name: string; power: number; level: string; damageType: string; intervalHours: number; nextAt: number;
  recovered: number; needed: number; pending: boolean; treated: boolean;
  contagious?: string; vector?: string; incubationHours?: number; infectedAt?: number; source?: string;
}

/** Why a carrier can't pass this disease on now ('' = they can). */
export function contagionProblem(d: DiseaseEntry | null | undefined, now: number): string {
  const c = RULES.HEALTH.contagion;
  if (!c.enabled) return tx('SR2E.Text.Afflictions.contagionIsOff');
  if (!d) return tx('SR2E.Text.Afflictions.thatDiseaseIsGone');
  if (!contagionReach(d.contagious ?? '')) return tx('SR2E.Text.Afflictions.isNotContagious', { name: d.name });
  const incubating = Number.isFinite(d.infectedAt) && d.incubationHours !== undefined && now < Number(d.infectedAt) + Number(d.incubationHours) * 3600;
  if (incubating && !c.duringIncubation) return tx('SR2E.Text.Afflictions.isStillIncubating', { name: d.name });
  return '';
}

/** The exposure a carrier passes on: the disease as a toxin to resist (Power + the contagion modifier). */
export function caughtFrom(d: DiseaseEntry, carrierName: string): {
  name: string; kind: 'disease'; vector: string; power: number; level: DamageLevel; damageType: 'physical' | 'stun';
  incubationHours: number; intervalHours: number; recoveries: number; contagious: string; label: string;
} {
  return {
    name: d.name, kind: 'disease', vector: contagionToxinVector(d.contagious ?? ''),
    power: Math.max(1, Math.floor(d.power) + RULES.HEALTH.contagion.powerModifier),
    level: (levelIndex(d.level) >= 0 ? d.level : 'M') as DamageLevel,
    damageType: d.damageType === 'stun' ? 'stun' : 'physical',
    // 24 h: a guard for disease entries saved without these fields (new entries always carry them).
    incubationHours: Math.max(0, Number(d.incubationHours ?? 24)), intervalHours: Math.max(1, Number(d.intervalHours ?? 24)),
    recoveries: Math.max(1, Number(d.needed ?? RULES.HEALTH.disease.recoveries)), contagious: d.contagious ?? '',
    label: tx('SR2E.Text.Afflictions.caughtFromResist', { name: d.name, carrierName }),
  };
}

// ---------------------------------------------------------------- Infection (a ghoul's bite)

/** The disease an Infection power passes on (the power's Substance, rating and level, else the defaults). */
export function infectionFrom(p: { name?: string; substance?: string; rating?: number; damageLevel?: string }): {
  name: string; kind: 'disease'; vector: string; power: number; level: DamageLevel; damageType: 'physical' | 'stun';
  incubationHours: number; intervalHours: number; recoveries: number; contagious: string; label: string;
} {
  const i = RULES.CRITTERS.infection;
  const name = String(p.substance ?? '').trim() || i.name;
  return {
    name, kind: 'disease', vector: i.vector, power: Math.max(1, Math.floor(Number(p.rating) || i.power)),
    level: (levelIndex(p.damageLevel) >= 0 ? p.damageLevel : 'M') as DamageLevel,
    damageType: i.damageType, incubationHours: i.incubationHours, intervalHours: i.intervalHours, recoveries: i.recoveries,
    contagious: i.contagious, label: tx('SR2E.Text.Afflictions.bittenResist', { name }),
  };
}

/** Whether a bite's damage is enough to pass the infection on. */
export function infects(boxes: number, type: string): boolean {
  const i = RULES.CRITTERS.infection;
  return i.enabled && type === 'physical' && Math.max(0, boxes) >= Math.max(1, i.minBoxes);
}

// ---------------------------------------------------------------- Radiation sickness

/** Radiation dose from an exposure: rating × hours. */
export function radiationDose(rating: number, hours: number): number {
  return Math.max(0, Number(rating) || 0) * Math.max(0, Number(hours) || 0);
}

/** The dose after `days` days of decay. */
export function decayedDose(dose: number, days: number): number {
  const per = Math.max(0, RULES.HEALTH.radiationSickness.decayPerDay);
  return Math.max(0, Math.round((Math.max(0, dose) - per * Math.max(0, days)) * 10) / 10);
}

/** The radiation sickness stage at this dose (index into the stages), or -1 for none. */
export function sicknessStage(dose: number): number {
  const r = RULES.HEALTH.radiationSickness;
  if (!r.enabled) return -1;
  let idx = -1;
  r.stages.forEach((st, i) => { if (dose >= st.dose) idx = i; });
  return idx;
}

/** A radiation sickness disease entry for a stage (tests start after one interval). */
export function sicknessEntry(stage: number, now: number): DiseaseEntry | null {
  const r = RULES.HEALTH.radiationSickness;
  const st = r.stages[stage];
  if (!st) return null;
  return {
    name: st.name, power: st.power, level: st.level, damageType: r.damageType, intervalHours: r.intervalHours,
    nextAt: now + r.intervalHours * 3600, recovered: 0, needed: Math.max(1, r.recoveries), pending: false, treated: false,
    contagious: '', infectedAt: now, incubationHours: 0, source: 'radiation',
  };
}

/** Whether a disease entry is radiation sickness (any stage). */
export function isRadiationSickness(d: { name?: string; source?: string }): boolean {
  return d.source === 'radiation' || RULES.HEALTH.radiationSickness.stages.some((s) => s.name === d.name);
}

// ---------------------------------------------------------------- Weather on driving and movement

/** The weather's TN modifier on driving tests (null when none). */
export function weatherDriving(id: string): { label: string; value: number } | null {
  if (!RULES.HEALTH.weatherOn.driving) return null;
  const w = RULES.HEALTH.weather.find((x) => x.id === id);
  return w && w.driving ? { label: tx('SR2E.Card.Mod.driving', { label: w.label }), value: w.driving } : null;
}

/** The weather's multiplier on walking and running (1 = none). */
export function weatherMovement(id: string): number {
  if (!RULES.HEALTH.weatherOn.movement) return 1;
  const w = RULES.HEALTH.weather.find((x) => x.id === id);
  return w && w.movement > 0 ? w.movement : 1;
}

/** Walking and running rates under the weather (metres per Combat Turn, rounded down to 0.5). */
export function movementInWeather(rates: { walk: number; run: number }, id: string): { walk: number; run: number; factor: number } {
  const f = weatherMovement(id);
  const r = (n: number) => Math.floor(Math.max(0, n) * f * 2) / 2;
  return { walk: r(rates.walk), run: r(rates.run), factor: f };
}

// ---------------------------------------------------------------- Care while recovering from surgery

/** How much a patient's care stretches or shortens recovery (home care by lifestyle). */
export function careFactor(care: string, lifestyle = ''): number {
  const c = RULES.BIOWARE.recovery;
  // Floors (0.25, 0.1): guards so a house-rule value can't make recovery instant or negative.
  if (care === 'home') return Math.max(0.25, 1 + c.homePerTn * (own(RULES.HEALTH.homeCare, lifestyle) ?? 0));
  return Math.max(0.1, own(c.care, care) ?? 1);
}

/** Recovery days under a care (rounded up, at least 1). */
export function recoveryWithCare(days: number, care: string, lifestyle = ''): number {
  return Math.max(1, Math.ceil(Math.max(0, days) * careFactor(care, lifestyle)));
}

/** A recovery's new end when its care changes: the time left is rescaled. */
export function rescaleRecovery(until: number, fromFactor: number, toFactor: number, now: number): number {
  const left = Math.max(0, until - now);
  if (!left || !(fromFactor > 0)) return until;
  return Math.round(now + left * (toFactor / fromFactor));
}

/** Nuyen for `days` days of paid care (hospital, intensive), else 0. */
export function recoveryCareCost(care: string, days: number): number {
  return Math.max(0, Math.ceil(days)) * Math.max(0, own(RULES.HEALTH.careCosts, care) ?? 0);
}

// ---------------------------------------------------------------- A possessed body's skills

export interface SkillCopy {
  name: string; rating: number; attribute: string; kind: string;
  specialization: string; specializationRating: number; concentration: string; concentrationRating: number;
}

/** A skill item's data as a possessor carries it into a body. */
export function skillCopy(i: { name: string; system: any }): SkillCopy {
  const s = i.system ?? {};
  return {
    name: String(i.name), rating: Number(s.rating ?? 0), attribute: String(s.attribute ?? 'intelligence'), kind: String(s.kind ?? 'active'),
    specialization: String(s.specialization ?? ''), specializationRating: Number(s.specializationRating ?? 0),
    concentration: String(s.concentration ?? ''), concentrationRating: Number(s.concentrationRating ?? 0),
  };
}

const MENTAL = ['charisma', 'intelligence', 'willpower'];

/**
 * Which skill a possessed body tests with (RULES.OCCULT.metamagic.possessing.skills): the
 * possessor's copy, the body's own, or none (the possessor lacks it and the body's don't count).
 */
export function possessedSkillChoice(body: { rating: number; attribute: string; kind?: string } | null, possessor: SkillCopy | null, mode = RULES.OCCULT.metamagic.possessing.skills): 'possessor' | 'body' | 'none' {
  if (mode === 'body') return body ? 'body' : 'none';
  if (mode === 'best') {
    if (possessor && (!body || possessor.rating > body.rating)) return 'possessor';
    return body ? 'body' : 'none';
  }
  if (mode === 'split') {
    const attr = possessor?.attribute ?? body?.attribute ?? '';
    const kind = possessor?.kind ?? body?.kind ?? 'active';
    const mind = MENTAL.includes(attr) || kind === 'knowledge' || kind === 'language';
    if (mind) return possessor ? 'possessor' : 'none';
    return body ? 'body' : 'none';
  }
  return possessor ? 'possessor' : 'none';
}

// ---------------------------------------------------------------- Allies by ritual

/** Why this magician can't make an ally of this Force ('' = they can). */
export function allyProblem(o: { grade: number; magic: number; force: number }): string {
  const a = RULES.OCCULT.ally;
  if (o.grade < a.minGrade) return tx('SR2E.Text.Afflictions.creatingAnAllyNeeds', { minGrade: a.minGrade });
  const max = a.maxForce === 'grade' ? o.grade : o.magic;
  if (!(o.force >= 1)) return tx('SR2E.Text.Afflictions.pickAForceOf');
  if (o.force > max) return a.maxForce === 'grade' ? tx('SR2E.Text.Afflictions.anAllysForceGrade', { max }) : tx('SR2E.Text.Afflictions.anAllysForceMagic', { max });
  return '';
}

/**
 * An ally ritual's TN, materials, days and Karma. v0.92.3 (RULES.SPIRITS_V923.allyCost 'book', Grimoire p. 70): Karma
 * 5 × the current Force for each point above the first (bought with a Magic point), plus the design's own Karma
 * (attributes, skills, forms, sense link); `magic` = the Magic point it costs.
 */
export function allyCosts(force: number, o: { designKarma?: number; familiar?: boolean } = {}): { tn: number; nuyen: number; days: number; karma: number; magic: number } {
  const a = RULES.OCCULT.ally;
  const f = Math.max(1, Math.floor(force));
  const book = allyKarmaBook(f, o.designKarma ?? 0);
  return { tn: Math.max(2, f + a.tnModifier), nuyen: f * a.nuyenPerForce, days: Math.ceil(f * a.daysPerForce), karma: book ?? Math.ceil(f * a.karmaPerForce), magic: allyMagicCost(Boolean(o.familiar)) };
}

// ---------------------------------------------------------------- The rest of the ordeals

/** The meditation ordeal's TN for this grade. */
export function meditationTn(grade: number): number {
  const m = RULES.OCCULT.initiation.meditation;
  return Math.max(2, m.tn + m.tnPerGrade * Math.max(1, Math.floor(grade)));
}

/** The thesis ordeal's TN for this grade. */
export function thesisTn(grade: number): number {
  const t = RULES.OCCULT.initiation.thesis;
  return Math.max(2, t.tn + t.tnPerGrade * Math.max(1, Math.floor(grade)));
}

/** Weeks an ordeal takes at this grade (meditation, thesis), else 0. */
export function ordealWeeks(effect: string, grade: number): number {
  const i = RULES.OCCULT.initiation;
  const per = effect === 'meditation' ? i.meditation.weeksPerGrade : effect === 'thesis' ? i.thesis.weeksPerGrade : 0;
  return Math.max(0, Math.ceil(per * Math.max(1, Math.floor(grade))));
}

/** Whether an ally conjured for the familiar ordeal is still unused (the flag the ritual leaves). */
export function familiarReady(f: { allyUuid?: string; usedForGrade?: number | null } | null | undefined): boolean {
  return Boolean(f?.allyUuid) && !(Number(f?.usedForGrade) > 0);
}
