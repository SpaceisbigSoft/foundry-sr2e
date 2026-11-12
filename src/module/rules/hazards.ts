import { RULES, type DamageLevel } from './config.ts';
import { weatherV79 } from './docs79-melee-vision.ts';
import { combatStamp, sameCombatRound, type ClockDue, own } from './util.ts';
import { recoveryCareCost } from './afflictions.ts';
import { t as tx, tCount } from '../helpers/i18n.ts';
import { respiratorImmune, addictionBook, isRecovering, recoveryDone, bookWithdrawalTn, type BookAddiction } from './health923.ts';

/** Toxins, drugs, disease, hazards, stun weapons and timed statuses (v0.31.0). Pure rules. */

/** Dice to resist a toxin: the attribute, plus toxin dice (may be negative), plus inhalant dice for inhaled ones. */
export function toxinResistDice(o: { attribute: number; toxinDice: number; inhalantDice: number; vector: string }): number {
  const inhaled = o.vector === RULES.TOXINS.inhalantVector ? Math.max(0, o.inhalantDice) : 0;
  return Math.max(0, o.attribute + (o.toxinDice || 0) + inhaled);
}

/** v0.78.0: a toxin's Power after bioware that lowers it for its vector (toxin extractor, tracheal filter). */
export function toxinPower(power: number, powerOff: Record<string, number> | undefined, vector: string): number {
  return Math.max(0, (Number(power) || 0) - Math.max(0, Number(powerOff?.[vector] ?? 0) || 0));
}

/** The speed entry for an id (immediate when unknown). */
export function toxinSpeed(id: string): { id: string; label: string; seconds: number } {
  return RULES.TOXINS.speeds.find((s) => s.id === id) ?? RULES.TOXINS.speeds[0]!;
}

/** When a timed effect ends: a Combat Turn in combat (and v0.81.0 the combat's id), a world time either way. */
export function effectEnds(o: { round: number | null; worldTime: number; seconds: number; combatId?: string | null }): ClockDue {
  const turns = Math.max(1, Math.ceil(o.seconds / RULES.TOXINS.secondsPerTurn));
  return { round: o.round != null ? o.round + turns : -1, worldTime: o.worldTime + Math.max(0, o.seconds), ...combatStamp(o) };
}

/** Whether a timed effect has ended (by Combat Turn in the combat it started in, or by world time). */
export function effectEnded(e: { round: number; worldTime: number; combatId?: string }, now: { round?: number | null; worldTime?: number; combatId?: string | null }): boolean {
  return (sameCombatRound(e, now) && now.round! >= e.round) || (e.worldTime >= 0 && now.worldTime != null && now.worldTime >= e.worldTime);
}

/** Falling: Power from the metres fallen, its level, and how much armor counts. */
export function fallingDamage(metres: number, armor: { impact: number; ballistic: number }): { power: number; level: DamageLevel; armor: number } {
  const f = RULES.HAZARDS.falling;
  return { power: Math.max(0, Math.floor(Math.max(0, metres) * f.powerPerMetre)), level: f.level, armor: Math.floor(armor[f.armorKind] * f.armorFraction) };
}

/** Fire: Power and level by intensity, and how much armor counts. */
export function fireDamage(intensity: string, armor: { impact: number; ballistic: number }): { power: number; level: DamageLevel; armor: number; label: string } {
  const f = RULES.HAZARDS.fire;
  const i = f.intensities.find((x) => x.id === intensity) ?? f.intensities[0]!;
  return { power: i.power, level: i.level, armor: Math.floor(armor[f.armorKind] * f.armorFraction), label: i.label };
}

/** Drowning, cold and fatigue: the TN, level and damage type of the Body test. */
export function exposureTest(kind: 'drowning' | 'cold' | 'fatigue', amount: number | string): { tn: number; level: DamageLevel; type: 'physical' | 'stun'; label: string } {
  const h = RULES.HAZARDS;
  if (kind === 'drowning') return { tn: h.drowning.tn + Math.max(0, Number(amount) || 0) * h.drowning.tnPerTurn, level: h.drowning.level, type: h.drowning.type, label: tCount(Number(amount), 'SR2E.Text.Hazards.drowningTurnsUnder', { amount }) };
  if (kind === 'cold') {
    const sv = h.cold.severities.find((x) => x.id === amount) ?? h.cold.severities[0]!;
    return { tn: sv.tn, level: h.cold.level, type: h.cold.type, label: tx('SR2E.Text.Hazards.cold', { label: sv.label }) };
  }
  const hours = Math.max(1, Number(amount) || 1);
  return { tn: h.fatigue.tn + (hours - 1) * h.fatigue.tnPerHour, level: h.fatigue.level, type: h.fatigue.type, label: tCount(hours, 'SR2E.Text.Hazards.fatigueHours') };
}

/**
 * v0.78.0 (RULES.BOOK_V78.flash 'book'): a flash grenade's TN modifier at `metres` from where it went off:
 * `baseTn` − 1 per `metresPerPoint` m, nothing beyond `maxMetres`; flare compensation halves it (round down).
 */
export function flashTn(o: { metres: number; flareComp?: boolean }): number {
  const F = RULES.BOOK_V78.flash;
  const m = Math.max(0, Number(o.metres) || 0);
  if (m > F.maxMetres) return 0;
  const tn = Math.max(0, F.baseTn - Math.floor(m / Math.max(1, F.metresPerPoint)));
  return o.flareComp ? Math.floor(tn * F.flareFactor) : tn;
}
/** v0.78.0: how many Combat Turns a flash lasts: `turns`, −1 per `successesPerTurn` successes on the Body test. */
export function flashDuration(bodySuccesses: number): number {
  const F = RULES.BOOK_V78.flash;
  return Math.max(0, F.turns - Math.floor(Math.max(0, bodySuccesses) / Math.max(1, F.successesPerTurn)));
}

/** A blinded character's TN modifier for an attack, a spell, or any other test. */
export function blindModifier(what: 'attack' | 'spell' | 'other'): number {
  const b = RULES.STATUSES.blind;
  return what === 'attack' ? b.attackTn : what === 'spell' ? b.spellTn : b.otherTn;
}

// ---------------------------------------------------------------- Health and environment (v0.42.0)

/** A character's addiction to one drug. */
export interface Addiction { drug: string; rating: number; type: string; recent: number[]; lastDose: number; addicted: boolean; dosesAddicted: number }

/** Doses still counted as recent (world times within RULES.HEALTH.addiction.recentDays). */
export function recentDoses(times: readonly number[], now: number): number[] {
  const window = RULES.HEALTH.addiction.recentDays * 86400;
  return times.filter((t) => now - t < window);
}

/** The addiction test's attribute and TN for a dose (the dose itself already in `recent`). */
export function drugAddictionTest(rating: number, type: string, recentCount: number): { attribute: 'body' | 'willpower'; tn: number } {
  const a = RULES.HEALTH.addiction;
  return { attribute: a.attributes[type] ?? 'willpower', tn: Math.max(RULES.MIN_TARGET_NUMBER, rating + a.tnPerRecentDose * Math.max(0, recentCount - 1)) };
}

/** Bonus points lost to tolerance after this many doses while addicted. */
export function toleranceLoss(dosesAddicted: number): number {
  const per = Math.max(1, RULES.HEALTH.addiction.dosesPerPoint);
  return Math.floor(Math.max(0, dosesAddicted) / per);
}

/** A drug's bonuses less tolerance: each positive bonus falls by `loss`, never below 0. */
export function applyTolerance(b: { attributes: Record<string, number>; reaction: number; initiativeDice: number }, loss: number): { attributes: Record<string, number>; reaction: number; initiativeDice: number } {
  const cut = (v: number) => (v > 0 ? Math.max(0, v - loss) : v);
  return { attributes: Object.fromEntries(Object.entries(b.attributes ?? {}).map(([k, v]) => [k, cut(Number(v) || 0)])), reaction: cut(b.reaction ?? 0), initiativeDice: cut(b.initiativeDice ?? 0) };
}

/**
 * Whether an addiction is in withdrawal now, and whether it can be kicked (days clean).
 * v0.92.3 (RULES.HEALTH_V923.addiction 'book', Shadowtech pp. 87–88): forced withdrawal after Body × 4 (physical) or
 * Willpower × 4 (mental) hours without a dose (`who`: the addict's attributes); not while recovering; the habit can be
 * kicked at any time (the GM's call) while addicted and not already recovering.
 */
export function withdrawalState(a: Pick<Addiction, 'addicted' | 'lastDose'> & BookAddiction | Pick<Addiction, 'addicted' | 'lastDose'>, now: number, who?: { body: number; willpower: number }): { withdrawal: boolean; daysClean: number; canKick: boolean; recovering?: boolean } {
  const h = RULES.HEALTH.addiction;
  const clean = Math.max(0, now - a.lastDose);
  const daysClean = Math.floor(clean / 86400);
  if (addictionBook() && who) {
    const b = a as BookAddiction;
    const recovering = isRecovering(b) && !recoveryDone(b, now);
    return { withdrawal: bookWithdrawalTn(b, now, who)?.kind === 'forced', daysClean, canKick: a.addicted && !isRecovering(b), recovering };
  }
  const withdrawal = a.addicted && clean >= h.withdrawalHours * 3600;
  return { withdrawal, daysClean, canKick: a.addicted && daysClean >= h.kickDays };
}

/**
 * TN modifiers from drug withdrawal (the worst one counts).
 * v0.92.3 (RULES.HEALTH_V923.addiction 'book', Shadowtech p. 88): forced withdrawal +3 (+6 on concentration tests such
 * as spellcasting) and the pain of a persistent Moderate Stun wound (its +2 when the Stun track's own is less);
 * recovering +2 (+4). `who`: the addict's attributes and Stun wound modifier; without it the old way.
 */
export function withdrawalModifiers(list: readonly Addiction[], now: number, who?: { body: number; willpower: number; stunWoundTn?: number; concentration?: boolean }): Array<{ label: string; value: number }> {
  if (addictionBook() && who) {
    const all = list.map((a) => ({ a, w: bookWithdrawalTn(a as Addiction & BookAddiction, now, who, Boolean(who.concentration)) })).filter((x) => x.w);
    if (!all.length) return [];
    const worst = all.reduce((m, x) => (x.w!.tn > m.w!.tn ? x : m));
    const out = [{ label: tx('SR2E.Card.Mod.withdrawal', { w: all.map((x) => x.a.drug).join(', ') }), value: worst.w!.tn }];
    const pain = all.some((x) => x.w!.kind === 'forced') ? Math.max(0, (RULES.WOUND_MODIFIERS.find(([min]) => min === RULES.BOXES_PER_LEVEL.M)?.[1] ?? 2) - Math.max(0, Number(who.stunWoundTn) || 0)) : 0;
    if (pain) out.push({ label: tx('SR2E.Card.Mod.withdrawalPain923'), value: pain });
    return out;
  }
  const w = list.filter((a) => withdrawalState(a, now).withdrawal);
  return w.length ? [{ label: tx('SR2E.Card.Mod.withdrawal', { w: w.map((a) => a.drug).join(', ') }), value: RULES.HEALTH.addiction.withdrawalTn }] : [];
}

/** Radiation: the Body test vs the rad rating, per hour exposed. */
export function radiationTest(rating: number, hours: number): { tn: number; level: DamageLevel; type: 'physical' | 'stun'; tests: number } {
  const r = RULES.HEALTH.radiation;
  return { tn: Math.max(RULES.MIN_TARGET_NUMBER, Math.floor(rating)), level: r.level, type: r.type, tests: Math.max(1, Math.ceil(hours)) };
}

/** Suffocation (as drowning): the TN after so many Combat Turns without air. */
export function suffocationTn(turns: number): number {
  const s = RULES.HEALTH.suffocation;
  return s.tn + Math.max(0, Math.floor(turns)) * s.tnPerTurn;
}

/** What a stay in care costs: per started day (at least one), as afflictions.ts recoveryCareCost. */
export function careCost(care: string, hours: number): number {
  return recoveryCareCost(care, Math.max(1, Math.ceil(Math.max(0, Number(hours) || 0) / 24)));
}

/** Resting at home: the TN modifier for a lifestyle. */
export function homeCareModifier(lifestyle: string): number {
  return own(RULES.HEALTH.homeCare, lifestyle) ?? 0;
}

/** Worn protection against a toxin's vector: immune (gas mask), or extra dice. */
export function protectionFor(gear: ReadonlyArray<{ kind: string; rating: number; worn: boolean; name?: string }>, vector: string): { immune: boolean; dice: number; label: string } {
  const worn = gear.filter((g) => g.worn && g.kind);
  if (vector === 'inhalation') {
    const mask = worn.find((g) => g.kind === 'gasMask');
    if (mask) return { immune: true, dice: 0, label: mask.name ?? tx('SR2E.Text.Hazards.gasMask') };
    const r = worn.filter((g) => g.kind === 'respirator').sort((a, b) => b.rating - a.rating)[0];
    // v0.92.3 (RULES.HEALTH_V923.respirator 'immune', Core p. 244): a respirator is its own air supply.
    if (r && respiratorImmune()) return { immune: true, dice: 0, label: r.name ?? tx('SR2E.Text.Hazards.respirator') };
    return r ? { immune: false, dice: Math.max(0, r.rating), label: tx('SR2E.Text.Hazards.respiratorRating', { name: r.name ?? tx('SR2E.Text.Hazards.respirator'), rating: r.rating }) } : { immune: false, dice: 0, label: '' };
  }
  if (vector === 'contact') {
    const c = worn.filter((g) => g.kind === 'chemsuit').sort((a, b) => b.rating - a.rating)[0];
    return c ? { immune: false, dice: Math.max(0, c.rating), label: `${c.name ?? 'Chemsuit'} ${c.rating}` } : { immune: false, dice: 0, label: '' };
  }
  return { immune: false, dice: 0, label: '' };
}

/** Weather: the TN modifier for whoever looks, by their best vision. */
export function weatherModifier(id: string, vision: { lowLight?: boolean; thermographic?: boolean; lowLightNatural?: boolean; thermographicNatural?: boolean }, opts: { fold?: boolean } = {}): { label: string; value: number } | null {
  // v0.79.0: rain and fog are the Visibility Table's smoke rows (RULES.DOCS_V79.visionWeatherFold), for eyes only:
  // vehicle sensors pass fold false (the Rigger 2 sensor table has its own weather row).
  const v79 = opts.fold === false ? undefined : weatherV79(id, vision);
  if (v79 !== undefined) return v79;
  const w = RULES.HEALTH.weather.find((x) => x.id === id);
  if (!w || w.id === 'clear') return null;
  const v = Math.min(w.normal, vision.lowLight ? w.lowLight : w.normal, vision.thermographic ? w.thermographic : w.normal);
  return v ? { label: w.label, value: v } : null;
}
