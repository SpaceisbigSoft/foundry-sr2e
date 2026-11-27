/**
 * v0.96.0 rules completeness, conjuring, spirits, astral space, adepts and critter powers: pure functions over
 * RULES.SPIRITS_V96 (rules/config96/spirits.ts). Each behaves the book's way at the shipped value of its switch; at the
 * other value ('v951') the caller keeps the v0.95.1 code. No Foundry dependency. A refusal is a language key (`why`),
 * never text.
 */
import { RULES, type DamageLevel } from './config.ts';

const V = () => RULES.SPIRITS_V96;
const num = (v: unknown, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const whole = (v: unknown) => Math.max(0, Math.floor(num(v)));
const DAY = 86400;
const HOUR = 3600;
const WHY = 'SR2E.Spirits96.Why.';

export type Spirits96Switch = Exclude<keyof typeof RULES.SPIRITS_V96, 'disruptionDays' | 'watcherHours'>;
/** Whether a switch is at the book's way. */
export const on = (key: Spirits96Switch): boolean => (V() as any)[key] === 'book';

// ---------------------------------------------------------------- An elemental's day of waiting (Core p. 141)

/**
 * The services a called elemental has used up by waiting (Core p. 141): one for every full 24 hours since it was
 * called (`since`, world seconds) up to `now`. 0 under 'v951' or for a bad time.
 */
export function waitingServices(since: number, now: number): number {
  if (!on('elementalWaiting') || !Number.isFinite(since) || !Number.isFinite(now) || now <= since) return 0;
  return Math.floor((now - since) / DAY);
}

// ---------------------------------------------------------------- Aid Sorcery in spell defense (Core p. 141)

/** The aid dice a defender may add from an aid already started (`left`), up to the dice asked for. */
export function aidDefenseDice(left: number, asked: number): { dice: number; left: number } {
  if (!on('aidDefense')) return { dice: 0, left: whole(left) };
  const l = whole(left);
  const d = Math.min(l, whole(asked));
  return { dice: d, left: l - d };
}

// ---------------------------------------------------------------- Technological melee enhancements (Awakenings p. 101)

/**
 * The Power a melee blow loses against a manifest spirit (Awakenings p. 101): what the weapon's own tweaks add (its
 * technological enhancements). 0 under 'v951', for a ranged attack, a non-spirit or an astral spirit.
 */
export function techPowerLost(o: { melee: boolean; targetType: string; materialized?: boolean; weaponTweakPower: number }): number {
  if (!on('techVsSpirits') || !o.melee || o.targetType !== 'spirit' || o.materialized === false) return 0;
  return Math.max(0, Math.floor(num(o.weaponTweakPower)));
}

// ---------------------------------------------------------------- Spirit against spirit (Core p. 143)

/**
 * A Force against Force round (Core p. 143): `a` and `b` are the spirits' successes. The winner takes the difference
 * off the loser's Force; at 0 the loser is destroyed. Null on a tie.
 */
export function spiritDuel(o: { aForce: number; bForce: number; aSuccesses: number; bSuccesses: number }): { loser: 'a' | 'b'; loss: number; force: number; destroyed: boolean } | null {
  const diff = whole(o.aSuccesses) - whole(o.bSuccesses);
  if (diff === 0) return null;
  const loser: 'a' | 'b' = diff > 0 ? 'b' : 'a';
  const before = whole(loser === 'a' ? o.aForce : o.bForce);
  const loss = Math.min(before, Math.abs(diff));
  return { loser, loss, force: before - loss, destroyed: before - loss <= 0 };
}

/** A duel's target numbers: each rolls its Force against the other's Force (never below the minimum TN). */
export function duelTns(aForce: number, bForce: number): { a: number; b: number } {
  return { a: Math.max(RULES.MIN_TARGET_NUMBER, whole(bForce)), b: Math.max(RULES.MIN_TARGET_NUMBER, whole(aForce)) };
}

// ---------------------------------------------------------------- Disruption (Grimoire p. 64)

/** Days a disrupted spirit stays away (Grimoire p. 64): 28 − Force, at least 1 (24 hours). */
export function disruptionDays(force: number): number {
  return Math.max(1, whole(V().disruptionDays) - whole(force));
}

/** The world time a spirit disrupted at `now` may appear again; null under 'v951'. */
export function disruptedUntil(now: number, force: number): number | null {
  if (!on('disruption')) return null;
  return num(now) + disruptionDays(force) * DAY;
}

// ---------------------------------------------------------------- A free spirit's true name (Grimoire p. 77)

/** Whether a name is the spirit's recorded true name (case and spaces ignored; an empty name never matches). */
export function trueNameMatches(truth: string, name: string): boolean {
  const t = String(truth ?? '').trim().toLowerCase();
  return t.length > 0 && t === String(name ?? '').trim().toLowerCase();
}

/**
 * Banishing a free spirit (Grimoire p. 77): only with its true name. The key of the refusal, or null when the banishing
 * may go ahead (not a free spirit, the name is known, or 'v951').
 */
export function freeSpiritBanishRefusal(o: { spiritKind: string; knowsName: boolean }): string | null {
  if (!on('freeSpiritBanish') || o.spiritKind !== 'free' || o.knowsName) return null;
  return `${WHY}trueName`;
}

// ---------------------------------------------------------------- Watchers (Grimoire p. 73)

/** The hours a watcher serves (at least 1; the default from the switch). */
export function watcherHours(asked?: number | null): number {
  const h = whole(asked);
  return h > 0 ? h : Math.max(1, whole(V().watcherHours));
}

/** The Conjuring test's TN for a watcher (Grimoire p. 73): the hours it is to serve. */
export function watcherTn(hours: number): number {
  return Math.max(RULES.MIN_TARGET_NUMBER, watcherHours(hours));
}

/** A watcher's Force (Grimoire p. 73): 1 per 2 successes; the summoner may take less (`wanted` > 0). */
export function watcherForce(successes: number, wanted = 0): number {
  const most = Math.floor(whole(successes) / 2);
  const w = whole(wanted);
  return w > 0 ? Math.min(most, w) : most;
}

/** A watcher's Drain (Grimoire p. 73): (Force × hours)L, always Stun. */
export function watcherDrain(force: number, hours: number): { tn: number; level: DamageLevel; type: 'stun' } {
  return { tn: Math.max(RULES.MIN_TARGET_NUMBER, whole(force) * watcherHours(hours)), level: 'L', type: 'stun' };
}

/** When a watcher summoned at `now` for `hours` dissolves. */
export function watcherDissolvesAt(now: number, hours: number): number {
  return num(now) + watcherHours(hours) * HOUR;
}

// ---------------------------------------------------------------- The astral attack skill (Core p. 147)

/**
 * Which skill a magician attacks with in astral combat (Core p. 147): Unarmed Combat, or Armed Combat with an active
 * weapon focus, or Sorcery in place of either: the better rating (Sorcery on a tie). Null under 'v951'.
 */
export function astralAttackSkill(o: { sorcery: number; unarmed: number; armed: number; focus: boolean }): 'sorcery' | 'unarmed' | 'armed' | null {
  if (!on('astralSkill')) return null;
  const melee: 'unarmed' | 'armed' = o.focus ? 'armed' : 'unarmed';
  const m = whole(o.focus ? o.armed : o.unarmed);
  return m > whole(o.sorcery) ? melee : 'sorcery';
}

// ---------------------------------------------------------------- Reading an aura again (Grimoire p. 90)

/**
 * A further attempt to read the same aura (Grimoire p. 90): +2 TN per earlier attempt; refused once that TN is above
 * the magician's Magic (the first attempt is always allowed). Under 'v951' the TN stays and nothing is refused.
 */
export function assenseAttempt(o: { tries: number; baseTn: number; magic: number }): { tn: number; extra: number; why?: string } {
  const base = Math.max(RULES.MIN_TARGET_NUMBER, whole(o.baseTn));
  if (!on('assenseRepeat')) return { tn: base, extra: 0 };
  const tries = whole(o.tries);
  const extra = 2 * tries;
  const tn = base + extra;
  if (tries > 0 && tn > whole(o.magic)) return { tn, extra, why: `${WHY}assenseAgain` };
  return { tn, extra };
}

/**
 * The attempts on file: `{ sceneId, tries: [[subject, count], …] }` for one scene (a list, so a Foundry update
 * replaces it whole; anything else reads as none).
 */
export function assenseTriesOf(raw: unknown, sceneId: string, subject: string): number {
  const r: any = raw && typeof raw === 'object' ? raw : {};
  if (String(r.sceneId ?? '') !== String(sceneId ?? '') || !Array.isArray(r.tries)) return 0;
  const row = r.tries.find((x: unknown) => Array.isArray(x) && x[0] === subject);
  return row ? Math.min(50, whole(row[1])) : 0;
}

/** The record after one more attempt on `subject` in `sceneId` (another scene starts afresh). */
export function assenseTriesAfter(raw: unknown, sceneId: string, subject: string): { sceneId: string; tries: Array<[string, number]> } {
  const r: any = raw && typeof raw === 'object' ? raw : {};
  const same = String(r.sceneId ?? '') === String(sceneId ?? '');
  const tries: Array<[string, number]> = same && Array.isArray(r.tries)
    ? r.tries.filter((x: unknown) => Array.isArray(x) && typeof x[0] === 'string' && x[0].length <= 200 && x[0] !== subject).slice(0, 99).map((x: any) => [String(x[0]), Math.min(50, whole(x[1]))] as [string, number])
    : [];
  tries.push([subject, Math.min(50, assenseTriesOf(raw, sceneId, subject) + 1)]);
  return { sceneId: String(sceneId ?? ''), tries };
}

// ---------------------------------------------------------------- Reflecting (Awakenings p. 99)

/**
 * Reflecting the book's way (Awakenings p. 99): only the shielding dice's successes count against the caster's. More,
 * and the spell rebounds with a Force of the difference (at most its own Force). A spell already reflected once that
 * is reflected again at Force 1 dissipates instead. Null when nothing comes back.
 */
export function reflectBook(o: { shieldSuccesses: number; casterSuccesses: number; force: number; reflected?: boolean }): { force: number } | { dissipates: true } | null {
  const net = whole(o.shieldSuccesses) - whole(o.casterSuccesses);
  if (net <= 0) return null;
  if (o.reflected && whole(o.force) <= 1) return { dissipates: true };
  return { force: Math.max(1, Math.min(net, whole(o.force))) };
}

/**
 * Which of a resistance test's dice were the shielding dice: the roll lists the attribute (and other own) dice first,
 * then the pool dice, then the spell defense dice, then the shielding dice. Their successes at `tn`.
 */
export function shieldSuccesses(dice: ReadonlyArray<{ total: number } | number>, o: { from: number; count: number; tn: number }): number {
  const t = Math.max(RULES.MIN_TARGET_NUMBER, whole(o.tn));
  return dice.slice(whole(o.from), whole(o.from) + whole(o.count)).filter((d) => (typeof d === 'number' ? d : Number(d?.total ?? 0)) >= t).length;
}

// ---------------------------------------------------------------- Cleansing (Awakenings p. 100)

/** Cleansing a background count (Awakenings p. 100): refused above the initiate's grade. The refusal key, or null. */
export function cleanseRefusal(count: number, grade: number): string | null {
  if (!on('cleansing')) return null;
  return whole(count) > whole(grade) ? `${WHY}cleanseGrade` : null;
}

/** Cleansing's Drain (Awakenings p. 100): (count)D resisted with Willpower; null under 'v951' or for no count. */
export function cleanseDrain(count: number): { tn: number; level: DamageLevel } | null {
  if (!on('cleansing') || whole(count) <= 0) return null;
  return { tn: Math.max(RULES.MIN_TARGET_NUMBER, whole(count)), level: 'D' };
}

// ---------------------------------------------------------------- Adept power costs (Core pp. 125–126; Awakenings p. 116)

/**
 * Improved Physical Attributes (Core p. 125): each point raised costs by the band the new rating falls in: up to half
 * the racial maximum .5, up to the maximum 1, up to 1.5 × the maximum 1.5 (beyond that the table ends: 1.5 too, VERIFY).
 */
export function improvedAttributeCost(base: number, levels: number, racialMax: number): number {
  const max = Math.max(1, whole(racialMax));
  let cost = 0;
  for (let r = whole(base) + 1; r <= whole(base) + whole(levels); r++) cost += r <= max / 2 ? 0.5 : r <= max ? 1 : 1.5;
  return Math.round(cost * 100) / 100;
}

/** Improved Ability's cost per die by skill (Core p. 125): athletics and stealth .25; armed, unarmed, throwing, projectile .5; firearms and gunnery 1; null for another skill. */
export function improvedAbilityPerDie(skill: string): number | null {
  const s = String(skill ?? '').trim().toLowerCase();
  if (/^(?:athletics|stealth)\b/.test(s)) return 0.25;
  if (/^(?:armed combat|unarmed combat|throwing|projectile|edged|clubs|pole ?arms|cyber-implant)/.test(s)) return 0.5;
  if (/^(?:firearms|gunnery|pistols?|rifles?|shotguns?|smgs?|submachine|assault|heavy weapons|launch)/.test(s)) return 1;
  return null;
}

/** Distance Strike or Killing Hands bought beside the other costs double (Awakenings p. 116). */
export function pairedStrikeCost(cost: number, hasOther: boolean): number {
  return on('adeptCosts') && hasOther ? Math.round(num(cost) * 2 * 100) / 100 : num(cost);
}

/**
 * The book's power point cost of an imported adept power item (Core pp. 125–126; Awakenings p. 116), or null to keep
 * the importer's own guess (another power, or 'v951'). `natural(key)` is the attribute's rating before the power,
 * `racialMax(key)` its racial maximum.
 */
export function adeptItemCost(system: Record<string, any>, o: { natural: (key: string) => number; racialMax: (key: string) => number; others: ReadonlyArray<Record<string, any>> }): number | null {
  if (!on('adeptCosts') || !system) return null;
  const attrs = system.attributes && typeof system.attributes === 'object' ? Object.entries(system.attributes as Record<string, unknown>).filter(([, v]) => whole(v) > 0) : [];
  if (attrs.length === 1 && ['body', 'quickness', 'strength'].includes(attrs[0]![0])) {
    const [key, lv] = attrs[0]!;
    return improvedAttributeCost(o.natural(key), whole(lv), o.racialMax(key));
  }
  if (system.skill && whole(system.skillDice) > 0) {
    const per = improvedAbilityPerDie(String(system.skill));
    return per === null ? null : Math.round(per * whole(system.skillDice) * 100) / 100;
  }
  if (system.special === 'distanceStrike') return pairedStrikeCost(num(system.cost, 2), o.others.some((x) => x?.special === 'killingHands'));
  return null;
}

// ---------------------------------------------------------------- Confusion, Fear, Engulf (Predator and Prey pp. 89–92)

/** The opposed powers (Predator and Prey pp. 89–92): their Special ids. */
export const OPPOSED_SPECIALS = ['confusion', 'fear'] as const;

/** Whether a power is one of the opposed ones (by Special, or an Engulf power by name). */
export function opposedPower(special: string, name: string): 'confusion' | 'fear' | 'engulf' | null {
  if (!on('critterOpposed')) return null;
  if ((OPPOSED_SPECIALS as readonly string[]).includes(String(special ?? ''))) return special as 'confusion' | 'fear';
  return /^\s*engulf\b/i.test(String(name ?? '')) ? 'engulf' : null;
}

/** Confusion's target number modifier (Predator and Prey p. 89): half the net successes, round down. */
export function confusionTn(net: number): number {
  return Math.floor(whole(net) / 2);
}

/** Fear's severity by net successes (Predator and Prey p. 92): its id, or null for none. */
export function fearSeverity(net: number): 'runs' | 'stays' | 'sweats' | 'phobia' | null {
  const n = whole(net);
  return n >= 6 ? 'phobia' : n >= 4 ? 'sweats' : n >= 2 ? 'stays' : n >= 1 ? 'runs' : null;
}

/** Engulf (Predator and Prey p. 90): 1 net success takes the victim in at its walking rate, more at running speed. */
export function engulfEntry(net: number): 'walk' | 'run' | null {
  const n = whole(net);
  return n >= 2 ? 'run' : n >= 1 ? 'walk' : null;
}

// ---------------------------------------------------------------- The Astral Combat Pool while perceiving (Core p. 147)

/** Whether an astral action of this magician draws on the Astral Combat Pool's own count (perceiving, book way). */
export function astralPoolWhilePerceiving(o: { astral: string; type: string; tradition: string; magic: number }): boolean {
  return on('astralPerceiving') && o.type !== 'spirit' && o.tradition !== 'adept' && num(o.magic) > 0 && o.astral === 'perceiving';
}
