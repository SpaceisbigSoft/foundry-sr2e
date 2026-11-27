/**
 * v0.96.0 rules completeness, damage, health and hazards: pure functions over RULES.HEALTH_V96
 * (rules/config96/health.ts). Each behaves the book's way at the shipped value of its switch; at the other value it
 * returns null (or the value it was given) and the caller keeps the v0.95.1 code. No Foundry dependency.
 */
import { RULES, type DamageLevel } from './config.ts';

const V = () => RULES.HEALTH_V96;
const num = (v: unknown, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const whole = (v: unknown) => Math.max(0, Math.floor(num(v)));
const DAY = 86400;
const LEVELS: readonly DamageLevel[] = ['L', 'M', 'S', 'D'];

/** The wound level of a number of boxes (null when unhurt). */
export function levelOf(boxes: number): DamageLevel | null {
  const b = whole(boxes);
  const L = RULES.BOXES_PER_LEVEL;
  if (b <= 0) return null;
  if (b >= L.D) return 'D';
  if (b >= L.S) return 'S';
  if (b >= L.M) return 'M';
  return 'L';
}

// ---------------------------------------------------------------- Interrupted Stun rest (Core p. 112)

export const stunRestOn = (): boolean => V().stunRestInterrupted === 'book';

/** The kept first roll of a Stun rest in progress, from the stored flag (null = none). */
export function stunRestKept(flag: unknown): number | null {
  const f: any = flag && typeof flag === 'object' ? flag : null;
  if (!f || !Number.isFinite(Number(f.successes))) return null;
  return Math.min(40, whole(f.successes));
}

/** The successes a Stun rest counts: never more than the first roll's (`cap`), when a rest is in progress. */
export function restSuccesses(successes: number, cap: number | null | undefined): number {
  const s = whole(successes);
  return cap == null || !Number.isFinite(Number(cap)) ? s : Math.min(s, whole(cap));
}

/** What the rest-in-progress flag becomes after a Stun rest: cleared when the track is clear, set by a first roll, else kept. */
export function stunRestNext(o: { first: boolean; successes: number; after: number }): { set: { successes: number } | null; clear: boolean } {
  if (whole(o.after) <= 0) return { set: null, clear: true };
  return o.first ? { set: { successes: whole(o.successes) }, clear: false } : { set: null, clear: false };
}

// ---------------------------------------------------------------- Minimum lifestyle while healing (Core p. 113)

/** Lifestyles from worst to best, then hospitalized. */
export function lifestyleRank(id: string): number {
  if (id === 'hospital') return RULES.UPKEEP.lifestyles.length;
  const i = RULES.UPKEEP.lifestyles.findIndex((l) => l.id === id);
  return i < 0 ? 0 : i;
}

/** The lifestyle a rest counts: a hospital or intensive care is hospitalized, else the character's own. */
export function restLifestyle(care: string, own: string): string {
  return care === 'hospital' || care === 'intensive' ? 'hospital' : String(own || 'street');
}

/** The Healing Table's minimum lifestyle the rest falls short of (null when it is met, or the rule is off). */
export function lifestyleShort(boxes: number, care: string, own: string): string | null {
  if (V().healingLifestyle !== 'book') return null;
  const lvl = levelOf(boxes);
  if (!lvl) return null;
  const need = String(V().healingMinLifestyle[lvl] ?? '');
  if (!need) return null;
  return lifestyleRank(restLifestyle(care, own)) < lifestyleRank(need) ? need : null;
}

// ---------------------------------------------------------------- Medical costs (Core p. 113)

export const medicalCostsOn = (): boolean => V().medicalCosts === 'book';

/** The paramedic's first aid fee for a wound (0 when off or unhurt). */
export function paramedicFee(boxes: number): number {
  const lvl = levelOf(boxes);
  return medicalCostsOn() && lvl ? whole(V().medicalCostsTable.paramedic[lvl]) : 0;
}

/** The extended care discount of a paid-up DocWagon contract (Core p. 250): 0..1. */
export function extendedCareDiscount(tier: string | null | undefined): number {
  if (V().docwagonExtendedCare !== 'book' || !tier) return 0;
  return Math.min(1, Math.max(0, num(V().extendedCareDiscount[String(tier)])));
}

/** The care rows with a doctor outside a hospital: the Doctoring Table's doctor rows (DOCS_V79.doctoring 'table'), else none. */
export const DOCTOR_ROWS: readonly string[] = ['medkit', 'home', 'poor', 'terrible'];
export function doctorInvolved(care: string): boolean {
  return RULES.DOCS_V79.doctoring === 'table' && DOCTOR_ROWS.includes(String(care));
}

/** What a day of this care costs by the Medical Costs Table for a wound (before any discount); null when off. */
export function careDayCost(care: string, boxes: number): number | null {
  if (!medicalCostsOn()) return null;
  const t = V().medicalCostsTable;
  const lvl = levelOf(boxes);
  return care === 'hospital' ? whole(t.hospitalPerDay) : care === 'intensive' ? whole(t.intensivePerDay) : doctorInvolved(care) && lvl ? whole(t.doctorPerDay[lvl]) : 0;
}

/**
 * What a Physical rest costs by the Medical Costs Table (Core p. 113: a bill when a doctor is involved): per started
 * day, a hospital (doctor included) or intensive care, or the doctor's fee for the wound when a doctor treats outside a
 * hospital (the Doctoring Table's doctor rows); less a DocWagon extended care discount. Null when the rule is off (the
 * caller keeps RULES.HEALTH.careCosts).
 */
export function restCareCost(o: { care: string; hours: number; boxes: number; tier?: string | null }): number | null {
  const perDay = careDayCost(o.care, o.boxes);
  if (perDay == null) return null;
  const days = Math.max(1, Math.ceil(Math.max(0, num(o.hours)) / 24));
  return Math.round(perDay * days * (1 - extendedCareDiscount(o.tier)));
}

/** A cost under the old care costs, less the extended care discount (the discount alone, with medicalCosts off). */
export function discounted(cost: number, tier: string | null | undefined): number {
  return Math.round(Math.max(0, num(cost)) * (1 - extendedCareDiscount(tier)));
}

// ---------------------------------------------------------------- Healing spells (Core p. 155)

export const healingSpellTimeOn = (): boolean => V().healingSpellTime === 'book';

/** A healing spell's successes split between boxes and time: boxes first (as many as the wound has), or `toTime` asked for. */
export function healSplit(successes: number, before: number, toTime?: number): { boxes: number; time: number } {
  const s = whole(successes);
  const per = Math.max(1, whole(RULES.SPELLCRAFT.healing.boxesPerSuccess) || 1);
  if (toTime != null && Number.isFinite(Number(toTime))) {
    const time = Math.min(s, whole(toTime));
    return { boxes: s - time, time };
  }
  const boxes = Math.min(s, Math.ceil(whole(before) / per));
  return { boxes, time: s - boxes };
}

/** The Combat Turns a healing spell must be sustained: the table's base for the wound ÷ the successes put to time. */
export function healSpellTurns(before: number, timeSuccesses: number): number | null {
  if (!healingSpellTimeOn()) return null;
  const lvl = levelOf(before) ?? 'L';
  const base = whole(V().healingSpellTurns[lvl]) || 1;
  const t = whole(timeSuccesses);
  return Math.max(1, Math.ceil(base / Math.max(1, t)));
}

/** The world time a healing spell takes (null when the rule is off or the spell failed). */
export function healSpellUntil(now: number, before: number, successes: number, secondsPerTurn: number): number | null {
  if (!healingSpellTimeOn() || whole(successes) <= 0) return null;
  const turns = healSpellTurns(before, healSplit(successes, before).time);
  return turns == null ? null : num(now) + turns * Math.max(1, num(secondsPerTurn) || num(RULES.COMBAT_TURN_SECONDS) || 3);
}

// ---------------------------------------------------------------- Slap patches (Core pp. 186, 250; Awakenings p. 99)

type ItemLike = { type?: string; name?: string; system?: Record<string, any> };

const installed = (it: ItemLike) => it?.type === 'cyberware' && it.system?.['installed'] !== false;

/** The dermal armor rating and whether blood filtration is installed (as the trauma patch's inhibitors read them). */
export function patchInhibitors(items: Iterable<ItemLike> | null | undefined): { armor: number; bloodFilter: boolean } {
  let armor = 0;
  let bloodFilter = false;
  for (const it of items ?? []) {
    if (!installed(it)) continue;
    const s = it.system ?? {};
    if (s['kind'] === 'filtration' && s['filterKind'] === 'blood' && num(s['rating']) > 0) bloodFilter = true;
    else if (!s['bioware'] && s['kind'] !== 'cyberlimb' && num(s['armorBallistic']) > 0) armor = Math.max(armor, whole(s['armorBallistic']));
  }
  return { armor, bloodFilter };
}

/** A patch's rating after the wearer's implants (Core p. 250); null when the rule is off or it is the trauma patch. */
export function patchAfterImplants(kind: string, rating: number, items: Iterable<ItemLike> | null | undefined): { rating: number; blocked: boolean; armor: number } | null {
  if (V().patchImplants !== 'book' || kind === 'trauma') return null;
  const inh = patchInhibitors(items);
  if (inh.bloodFilter) return { rating: 0, blocked: true, armor: inh.armor };
  return { rating: Math.max(0, whole(rating) - inh.armor), blocked: false, armor: inh.armor };
}

/**
 * Whether an antidote patch on this patient asks the GM about professional attention (Core p. 186): it counts as
 * professional help (Core p. 115), which allows another Biotech test and the patient's Body test.
 */
export function antidoteAttentionDue(status: string, stabilised: boolean): boolean {
  return V().antidoteAttention === 'book' && status === 'dying' && !stabilised;
}

export interface StimUse { t: number; rating: number }

/**
 * A magician's Magic test after a stim patch: 'core' against its rating (Core p. 250), 'awakenings' against the total
 * of the last 24 hours (Awakenings p. 99). Null when off. `history`: what to keep for next time.
 */
export function stimMagicTest(rating: number, history: unknown, now: number): { tn: number; history: StimUse[] } | null {
  const mode = V().stimMagic;
  if (mode === 'off') return null;
  const r = whole(rating);
  // A patch brought to 0 by dermal armor does nothing, so there is nothing to test.
  if (r <= 0) return null;
  const prev = Array.isArray(history) ? history.filter((h: any) => h && Number.isFinite(Number(h.t)) && num(now) - Number(h.t) < DAY).map((h: any) => ({ t: Number(h.t), rating: whole(h.rating) })) : [];
  const kept = [...prev, { t: num(now), rating: r }].slice(-50);
  const tn = mode === 'awakenings' ? kept.reduce((n, h) => n + h.rating, 0) : r;
  return { tn: Math.max(RULES.MIN_TARGET_NUMBER, tn), history: kept };
}

// ---------------------------------------------------------------- Bioware (Shadowtech pp. 26, 29, 30)

/**
 * Whether a working implant of this bioware kind is installed, read as bioEffect and bioVitals read it: installed, not
 * damaged, rating above 0, not still healing in after surgery (`healingIds`), and a Shadowtech kind of
 * RULES.HEALTH_V72.bioware only while that is enabled.
 */
export function hasBio(items: Iterable<ItemLike & { id?: string }> | null | undefined, kind: string, healingIds: Iterable<string> = []): boolean {
  const b: any = (RULES as any).HEALTH_V72?.bioware;
  if (b && (b.kinds as readonly string[] | undefined)?.includes(kind) && !b.enabled) return false;
  const healing = new Set(healingIds);
  for (const it of items ?? []) {
    if (!installed(it) || it.system?.['bioKind'] !== kind || it.system?.['damaged'] || !(num(it.system?.['rating']) > 0)) continue;
    if (it.id && healing.has(String(it.id))) continue;
    return true;
  }
  return false;
}

/** The Power a nephritic screen takes off a pathogen or a blood-vectored toxin (0 when it doesn't apply). */
export function nephriticCut(o: { kind?: string; vector: string; screen: boolean }): number {
  if (V().nephriticPower !== 'book' || !o.screen) return 0;
  const blood = o.kind === 'disease' || (V().nephriticVectors as readonly string[]).includes(String(o.vector));
  return blood ? whole(V().nephriticPowerCut) : 0;
}

/**
 * A trauma damper on a Physical hit: one of the new boxes moves onto the Stun track. Not with a pain editor; with a
 * damage compensator only once its boxes are exceeded on both tracks (Shadowtech p. 29); never a box past the track
 * (the Overflow) and never onto a full Stun track. Null when nothing moves.
 */
export function damperShift(before: { physical: number; stun: number }, after: { physical: number; stun: number }, o: { damper: boolean; painEditor: boolean; compensatorBoxes?: number }): { physical: number; stun: number } | null {
  if (V().traumaDamper !== 'book' || !o.damper || o.painEditor) return null;
  if (!(num(after.physical) > num(before.physical))) return null;
  if (num(after.physical) > RULES.MONITOR_BOXES) return null;
  if (num(after.stun) >= RULES.MONITOR_BOXES) return null;
  const comp = whole(o.compensatorBoxes);
  if (comp > 0 && !(num(after.physical) > comp && num(after.stun) > comp)) return null;
  return { physical: num(after.physical) - 1, stun: num(after.stun) + 1 };
}

/** A pain editor: Stun can't knock its wearer out (Shadowtech p. 26). */
export function painEditorStatus<T extends string>(status: T, editor: boolean): T | 'ok' {
  return V().painEditor === 'book' && editor && status === 'unconscious' ? 'ok' : status;
}

// ---------------------------------------------------------------- Addiction (Shadowtech pp. 87–88)

export const bothOn = (): boolean => V().addictionBoth === 'book';
export const testsAtWearOff = (): boolean => V().addictionTiming === 'wearOff';

/** The attributes a dose's addiction test is rolled with: both for a drug both physically and mentally addictive. */
export function doseTestAttributes(type: string): Array<'body' | 'willpower'> {
  if (type === 'both' && bothOn()) return ['body', 'willpower'];
  return [type === 'physical' ? 'body' : 'willpower'];
}

/** Hours between doses for a drug both physically and mentally addictive: the shorter clock. Null for one kind. */
export function bothIntervalHours(type: string, who: { body: number; willpower: number }, perPoint: number): number | null {
  if (type !== 'both' || !bothOn()) return null;
  return Math.min(whole(who.body), whole(who.willpower)) * Math.max(0, num(perPoint));
}

/** The rest after a recovery: until when (the drug's base Addiction rating in days). Null when off. */
export function restUntil(now: number, rating: number): number | null {
  if (V().addictionRest !== 'book') return null;
  return num(now) + whole(rating) * DAY;
}

/** The rest's TN penalty: +1 (+2 concentration) while it lasts; null otherwise. */
export function restTn(a: { restUntil96?: number }, now: number, concentration = false): number | null {
  if (V().addictionRest !== 'book') return null;
  const until = Number(a?.restUntil96);
  return Number.isFinite(until) && num(now) < until ? (concentration ? 2 : 1) : null;
}

/** The rest is over (time to say so and clear it). */
export function restOver(a: { restUntil96?: number }, now: number): boolean {
  const until = Number(a?.restUntil96);
  return Number.isFinite(until) && until > 0 && num(now) >= until;
}

/** Forced withdrawal's fall: the rise less 1 per 24 hours since withdrawal began without a dose. */
export function fallenRise(a: { addicted?: boolean; lastDose?: number; withdrawalAt96?: number }, rise: number, now: number): number {
  const r = whole(rise);
  if (V().addictionFall !== 'book' || !a?.addicted) return r;
  const at = Number(a.withdrawalAt96);
  if (!Number.isFinite(at) || at <= 0 || num(a.lastDose) >= at || num(now) <= at) return r;
  return Math.max(0, r - Math.floor((num(now) - at) / DAY));
}

/** The weekly attrition: whether a card is due, and when the next one is. */
export function attritionStep(a: { addicted?: boolean; recovering?: number; attritionAt96?: number }, now: number): { due: boolean; next: number | null } {
  const WEEK = 7 * DAY;
  if (V().addictionAttrition !== 'card' || !a?.addicted || (Number.isFinite(Number(a.recovering)) && Number(a.recovering) >= 0)) return { due: false, next: null };
  const at = Number(a.attritionAt96);
  if (!Number.isFinite(at) || at <= 0) return { due: false, next: num(now) + WEEK };
  return num(now) >= at ? { due: true, next: at + WEEK * Math.max(1, Math.ceil((num(now) - at + 1) / WEEK)) } : { due: false, next: at };
}

// ---------------------------------------------------------------- DocWagon (Neo-Anarchist's Guide p. 95; Core p. 250)

export const docwagonResponseOn = (): boolean => V().docwagonResponse === 'book';

/** The unit sent (1D6): air on 5–6 (an HTR team on 4–6). */
export function docwagonAir(d6: number, htr = false): boolean {
  return whole(d6) >= (htr ? 4 : 5);
}

/** The response time in minutes: 3D6 + air − 2 (+ HTR dispatched at once −1) + the GM's modifier, at least 4. */
export function docwagonMinutes(threeD6: number, air: boolean, modifier = 0, htr = false): number {
  return Math.max(whole(V().docwagonResponseMin), Math.floor(num(threeD6) + (air ? num(V().docwagonAirModifier) : 0) + (htr ? -1 : 0) + num(modifier)));
}

/** The HTR charge for a contract (Core p. 250); null when off (the tier's own fee). A tier whose HTR is included pays nothing. */
export function htrCharge(tier: string, included = false): number | null {
  if (V().docwagonHtr !== 'book') return null;
  if (included) return 0;
  const d = Math.min(1, Math.max(0, num(V().htrDiscount[String(tier)])));
  return Math.round(whole(V().htrFee) * (1 - d));
}

// ---------------------------------------------------------------- Neuro-stun (Core p. 186) and the medkit (Core p. 250)

const NEURO = /neuro[\s-]*stun|^n-s\b/i;

/** The disorientation after a neuro-stun exposure (seconds and TN); null when off or another toxin. */
export function neuroStunEffect(name: string): { seconds: number; tn: number } | null {
  if (V().neuroStun !== 'book' || !NEURO.test(String(name ?? ''))) return null;
  return { seconds: whole(V().neuroStunMinutes) * 60, tn: whole(V().neuroStunTn) };
}

/**
 * The Biotech dice first aid with a medkit rolls by its advice: the kit's rating when it beats the healer's own dice,
 * or when the healer would default (the kit advises, so no defaulting). Null: the healer's own, or off.
 */
export function medkitAdviceDice(ownDice: number, defaulting: boolean, medkit: boolean): number | null {
  if (V().medkitAdvice !== 'book' || !medkit) return null;
  const kit = whole(V().medkitBiotech);
  return kit > whole(ownDice) || (defaulting && kit > 0) ? kit : null;
}

export const LEVEL_IDS = LEVELS;
