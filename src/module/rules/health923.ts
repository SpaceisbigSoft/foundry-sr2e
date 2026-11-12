/**
 * v0.92.3 book alignment, damage, health and hazards: the switches in RULES.HEALTH_V923 (config923/health.ts) as small
 * pure helpers. Where the Unified Rules Revamp already has the same rule as a switch (RULES.URR_V80.hs…, magLossLe),
 * the Revamp's switch is honoured under either rules source, and the HEALTH_V923 switch adds the book's way under the
 * Book Rules source only, so the Revamp behaves exactly as before. This file imports only the config (damage.ts and
 * the Revamp's helpers import it).
 */
import { RULES, type DamageLevel } from './config.ts';

const U = () => RULES.URR_V80;
const H = () => RULES.HEALTH_V923;

/** Whether the world plays the Book Rules (the Revamp's patch is not laid over RULES). */
export function bookSource(): boolean {
  return !U().active;
}

// ---------------------------------------------------------------- Death and bleeding

/** Dead only one box past a full Overflow row (Core p. 111; the Revamp's hsDeathPastOverflow). */
export function deathPastBody(): boolean {
  return Boolean(U().hsDeathPastOverflow) || (bookSource() && H().death === 'natural');
}

/** The Body the Overflow row and the death check count: the natural Body by the book (Core p. 111), else the total. */
export function deathBody(total: number, natural: number | null | undefined): number {
  const t = Math.max(0, Math.floor(Number(total) || 0));
  if (!(bookSource() && H().death === 'natural')) return t;
  const n = Number(natural);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : t;
}

/** Minutes of game time per box while dying unattended (Core p. 111), or 0 for the (Body) Combat Turns rule. */
export function bleedMinutes(): number {
  const urr = Number(U().hsBleedMinutes) || 0;
  if (urr > 0) return urr;
  return bookSource() && H().bleed === 'tenMinutes' ? Math.max(0, Number(H().bleedMinutes) || 0) : 0;
}

// ---------------------------------------------------------------- Stun recovery and first aid

/** The Stun recovery base TN when it is the higher of Body and Willpower vs 2 + injury modifiers (Core p. 112); null for the old way. */
export function stunRecoveryBaseTn(): number | null {
  if (U().hsStunRecovery === 'urr') return Math.max(2, Math.floor(Number(U().hsStunRecoveryTn) || 2));
  if (bookSource() && H().stunRecovery === 'book') return Math.max(2, Math.floor(Number(H().stunRecoveryTn) || 2));
  return null;
}

/** First aid lowers the wound one level (Core p. 115). */
export function firstAidByLevelOn(): boolean {
  return U().hsFirstAid === 'level' || (bookSource() && H().firstAid === 'level');
}

/** Whether first aid may treat the Stun track (the book: Physical only, Core p. 115). */
export function firstAidOnStun(): boolean {
  return H().firstAidStun === 'both';
}

/** The First Aid Table's treatment minutes by level, when the card shows them (Core p. 115); null when hidden. */
export function firstAidMinutesTable(): Record<'L' | 'M' | 'S', number> | null {
  if (U().hsFirstAidTime) return U().hsFirstAidMinutes;
  return bookSource() && H().firstAidTime === 'shown' ? H().firstAidMinutes : null;
}

/** A better healer may try first aid again (Core p. 115). */
export function firstAidRetryOn(): boolean {
  return Boolean(U().hsFirstAidRetry) || (bookSource() && H().firstAidRetry === 'better');
}

/** The self-stabilisation TN after failed first aid on the dying (Core p. 115); null when there is no such test. */
export function selfStabiliseTnNow(): number | null {
  if (U().hsSelfStabilise) return Math.max(2, Math.floor(Number(U().hsSelfStabiliseTn) || 10));
  if (bookSource() && H().selfStabilise === 'test') return Math.max(2, Math.floor(Number(H().selfStabiliseTn) || 10));
  return null;
}

/** The trauma patch's Body test base TN (Core p. 115); null when the patch stabilises outright. */
export function traumaPatchTnNow(): number | null {
  if (U().hsTraumaPatch === 'bodyTest') return Math.max(2, Math.floor(Number(U().hsTraumaPatchTn) || 4));
  if (bookSource() && H().traumaPatch === 'bodyTest') return Math.max(2, Math.floor(Number(H().traumaPatchTn) || 4));
  return null;
}

// ---------------------------------------------------------------- Magic loss

/** A Magic loss roll equal to the Magic loses too (Core p. 115; the Revamp's magLossLe). */
export function magicLossAtOrBelow(): boolean {
  return Boolean(U().magLossLe) || (bookSource() && H().magicLoss === 'atOrBelow');
}

/** Treatment without the magician +2 calls for a Magic loss test (Core p. 115; the Revamp's hsMagicLossUntreated). */
export function magicLossUntreatedOn(): boolean {
  return Boolean(U().hsMagicLossUntreated) || (bookSource() && H().magicLossUntreated === 'test');
}

/** How many Magic loss tests a treatment without the +2 calls for: twice for a Deadly wound by the book (Core p. 115). */
export function magicLossUntreatedTests(deadly: boolean): number {
  return deadly && bookSource() && H().magicLossUntreated === 'test' ? 2 : 1;
}

/** Drastic invasive surgery (Core p. 114; Shadowtech bionetics): 1+ Essence of cyberware, or more than 1.5 Body Index of bioware. */
export function drasticSurgery(points: number, bioware: boolean): boolean {
  const p = Math.max(0, Number(points) || 0);
  return bioware ? p > 1.5 : p >= 1;
}

/** Whether a magician's surgery of this size calls for a Magic loss test after healing. */
export function surgeryMagicLossDue(points: number, bioware: boolean): boolean {
  return H().surgeryMagicLoss === 'drastic' && drasticSurgery(points, bioware);
}

/**
 * The surgery wound by the book's bands (Core p. 114 for cyberware by Essence; Shadowtech bionetics for bioware by Body
 * Index); null under 'table' or the Revamp (the caller uses RULES.BIOWARE.surgery.trauma.levels).
 */
export function surgeryBandLevel(points: number, bioware: boolean): DamageLevel | null {
  // The Revamp patches RULES.BIOWARE.surgery.trauma.levels with its own bands: under it, those count.
  if (H().surgeryBands !== 'book' || !bookSource()) return null;
  const p = Math.max(0, Number(points) || 0);
  if (bioware) return p <= 0.25 ? 'L' : p <= 0.75 ? 'M' : p <= 1.5 ? 'S' : 'D';
  return p <= 0 ? 'L' : p <= 0.4 ? 'M' : p < 1 ? 'S' : 'D';
}

// ---------------------------------------------------------------- Magical healing

/** A healing spell's base TN: Treat 8, Heal (and any other) RULES.SPELLCRAFT.healing.base (Core p. 155). */
export function healingSpellBase(treat: boolean): number {
  const base = Number(RULES.SPELLCRAFT.healing.base) || 10;
  return treat && H().treatTn === 'book' ? Number(H().treatBase) || 8 : base;
}

/** Where ½ the Body Index adds to the TN: 'magical' healing only (the book), or first aid and natural healing (old). */
export function bodyIndexOn(what: 'spell' | 'firstAid' | 'natural'): boolean {
  return H().bodyIndexHealing === 'magical' ? what === 'spell' : what !== 'spell';
}

/** Whether a healing spell may recover Stun (the book: no, Core p. 112). */
export function spellsHealStun(): boolean {
  return H().spellsHealStun === 'yes';
}

// ---------------------------------------------------------------- Permanent damage (Core p. 114)

export interface PermanentDamageOutcome { kind: 'none' | 'limb' | 'attribute'; result: string }

/** The Deadly-wound Body test's TN: 4, +2 after a trauma patch; null when the rule is off. */
export function permanentDamageTn(traumaPatch: boolean): number | null {
  if (H().permanentDamage !== 'test') return null;
  const p = H().permanentDamageTest;
  return Math.max(2, Math.floor(Number(p.tn) || 4) + (traumaPatch ? Math.floor(Number(p.traumaPatchTn) || 0) : 0));
}

const ATTRIBUTE_LOSS = ['body', 'strength', 'quickness', 'intelligence', 'willpower', 'reaction'] as const;
const LIMB_LOSS = ['rightArm', 'leftArm', 'rightLeg', 'leftLeg', 'ear', 'eye'] as const;

/** What the permanent damage test means: 0 successes an attribute (1D6), 1 a limb or eye (1D6; ear/eye side by a second 1D6), 2+ nothing. */
export function permanentDamageOutcome(successes: number, d6: number, side = 1): PermanentDamageOutcome {
  const s = Math.max(0, Math.floor(Number(successes) || 0));
  if (s >= 2) return { kind: 'none', result: '' };
  const i = Math.min(5, Math.max(0, Math.floor(Number(d6) || 1) - 1));
  if (s === 0) return { kind: 'attribute', result: ATTRIBUTE_LOSS[i]! };
  const limb = LIMB_LOSS[i]!;
  const right = Math.floor(Number(side) || 1) <= 3;
  return { kind: 'limb', result: limb === 'ear' || limb === 'eye' ? `${right ? 'right' : 'left'}${limb === 'ear' ? 'Ear' : 'Eye'}` : limb };
}

// ---------------------------------------------------------------- Hazards

/** Falling by the book (Fields of Fire p. 76): Deadly, Power ½ the metres (round down) − ½ impact armor − Athletics successes. Null under 'old'. */
export function fallingBook(metres: number, impactArmor: number, athleticsSuccesses = 0): { power: number; level: DamageLevel; armor: number; cut: number } | null {
  if (H().falling !== 'book') return null;
  const m = Math.max(0, Number(metres) || 0);
  const cut = Math.max(0, Math.floor(Number(athleticsSuccesses) || 0));
  return { power: Math.max(0, Math.floor(m / 2) - cut), level: 'D', armor: Math.floor(Math.max(0, Number(impactArmor) || 0) / 2), cut };
}

/** Seconds of held breath per point of Body (Fields of Fire p. 76; the Revamp's hsBreathHold); 0 = none. */
export function breathSecondsPerBody(): number {
  if (U().hsBreathHold) return Math.max(0, Number(U().hsBreathSecondsPerBody) || 0);
  return bookSource() && H().breathHold === 'body' ? Math.max(0, Number(H().breathSecondsPerBody) || 0) : 0;
}

/** Drowning by the book (Cyberpirates): unresisted Stun boxes, one an action phase without air. Null under 'test'. */
export function drowningBoxes(turnsWithoutAir: number, phasesPerTurn = 1): number | null {
  if (H().drowning !== 'boxes') return null;
  return Math.max(0, Math.floor(Number(turnsWithoutAir) || 0)) * Math.max(1, Math.floor(Number(phasesPerTurn) || 1));
}

/** Burning clothes (Grimoire p. 113): the damage at the end of the nth Combat Turn on fire (1 = the first). Null under 'flat'. */
export function burningDamage(turn: number): { power: number; level: DamageLevel } | null {
  if (H().burning !== 'rising') return null;
  const b = H().burningDamage;
  const n = Math.max(1, Math.floor(Number(turn) || 1));
  return { power: Math.max(0, Math.floor(Number(b.power) || 0) + (n - 1) * Math.floor(Number(b.powerPerTurn) || 0)), level: b.level };
}

/** Shock weapons (Core p. 103): the Combat Turns disoriented, Power − ½ impact armor (round down) − successes; null when off. */
export function shockTurns(power: number, impactArmor: number, successes: number): number | null {
  if (H().shock !== 'disorient') return null;
  return Math.max(0, Math.floor(Number(power) || 0) - Math.floor(Math.max(0, Number(impactArmor) || 0) / 2) - Math.max(0, Math.floor(Number(successes) || 0)));
}

// ---------------------------------------------------------------- Edges, flaws, gear

/** Low Pain Tolerance by the book (Companion): a damaged track counts as the next wound level's lowest box (at most Serious). */
export function lowPainBoxes(boxes: number): number {
  const b = Math.max(0, Math.floor(Number(boxes) || 0));
  if (b <= 0) return 0;
  const L = RULES.BOXES_PER_LEVEL;
  if (b < L.M) return L.M;
  if (b < L.S) return L.S;
  return b;
}

/** Whether Low Pain Tolerance raises the level (the book) rather than adding boxes. */
export function lowPainByLevel(): boolean {
  return H().lowPainTolerance === 'level';
}

/** Whether a dwarf's extra dice count against this kind ('disease' only by the book). */
export function dwarfDiceAgainst(kind: string | undefined): boolean {
  return H().dwarfResistance === 'both' || kind === 'disease';
}

/** Whether a respirator makes its wearer immune to inhaled toxins (Core p. 244). */
export function respiratorImmune(): boolean {
  return H().respirator === 'immune';
}

// ---------------------------------------------------------------- Addiction (Shadowtech pp. 87–89)

/** An addiction entry as the book model reads it (the old fields are left alone). */
export interface BookAddiction {
  rating: number; type: string; lastDose: number; addicted: boolean;
  /** Points the character's Addiction and Tolerance ratings stand above the drug's (Strength rating rises). */
  rise?: number;
  /** World time the recovery process began (a kick test succeeded); −1 or absent = not recovering. */
  recovering?: number;
  /** The rise when the recovery began (it drops 1 every 3 days from there). */
  riseAtKick?: number;
  strength?: number; tolerance?: number; doses?: number; immune?: boolean;
}

/** Whether addiction follows Shadowtech (RULES.HEALTH_V923.addiction 'book'). */
export function addictionBook(): boolean {
  return H().addiction === 'book';
}

const DAY = 86400;

/** Whether the book's recovery process is under way. */
export function isRecovering(a: BookAddiction): boolean {
  return Number.isFinite(Number(a.recovering)) && Number(a.recovering) >= 0;
}

/**
 * The character's rise over the drug's base rating now: while recovering, the rise at the kick less 1 every 3 days;
 * not addicted, the rise less 1 every (30 − Strength) clean days (Shadowtech p. 88); else the rise.
 */
export function currentRise(a: BookAddiction, now: number): number {
  const rise = Math.max(0, Math.floor(Number(a.rise) || 0));
  if (isRecovering(a)) {
    const per = Math.max(1, Number(H().addictionBook.recoveryDaysPerPoint) || 3);
    return Math.max(0, Math.floor(Number(a.riseAtKick) || 0) - Math.floor(Math.max(0, now - Number(a.recovering)) / (per * DAY)));
  }
  const strength = Math.floor(Number(a.strength) || 0);
  if (a.addicted || !(strength > 0 && strength < 30)) return rise;
  return Math.max(0, rise - Math.floor(Math.max(0, now - Number(a.lastDose || 0)) / ((30 - strength) * DAY)));
}

/** The character's current Addiction rating for this drug. */
export function addictionRatingNow(a: BookAddiction, now: number): number {
  return Math.max(0, Math.floor(Number(a.rating) || 0)) + currentRise(a, now);
}

/** Hours an addict can go between doses: Body × 4 (physical) or Willpower × 4 (mental) (Shadowtech p. 87). */
export function doseIntervalHours(type: string, who: { body: number; willpower: number }): number {
  const per = Math.max(0, Number(H().addictionBook.hoursPerPoint) || 4);
  return Math.max(0, Math.floor(Number(type === 'physical' ? who.body : who.willpower) || 0)) * per;
}

/** The recovery process is over: the rating is back at the drug's base. */
export function recoveryDone(a: BookAddiction, now: number): boolean {
  return isRecovering(a) && currentRise(a, now) <= 0;
}

/** The kick-the-habit test's TN: Willpower vs the current rating +1 (mental), +3 (physical), +4 (both) (Shadowtech p. 88). */
export function kickTn(a: BookAddiction, now: number): number {
  const k = H().addictionBook.kickTn;
  const add = a.type === 'physical' ? k.physical : a.type === 'both' ? k.both : k.mental;
  return Math.max(RULES.MIN_TARGET_NUMBER, addictionRatingNow(a, now) + Math.floor(Number(add) || 0));
}

/** The book's withdrawal penalty for one addiction: forced +3 (+6 concentration), recovery +2 (+4); null when none. */
export function bookWithdrawalTn(a: BookAddiction, now: number, who: { body: number; willpower: number }, concentration = false): { kind: 'forced' | 'recovery'; tn: number } | null {
  const b = H().addictionBook;
  const mult = concentration ? 2 : 1;
  if (isRecovering(a)) return recoveryDone(a, now) ? null : { kind: 'recovery', tn: Math.floor(Number(b.recoveryTn) || 0) * mult };
  if (!a.addicted) return null;
  const clean = Math.max(0, now - Number(a.lastDose || 0));
  return clean >= doseIntervalHours(a.type, who) * 3600 ? { kind: 'forced', tn: Math.floor(Number(b.forcedWithdrawalTn) || 0) * mult } : null;
}

/** The book's bookkeeping for a dose: decayed rise, a relapse (+1), easing forced withdrawal (+1), every Strength-th dose (+1). */
export function bookDose(a: BookAddiction, now: number, inWithdrawal: boolean): { rise: number; doses: number; relapse: boolean } {
  let rise = currentRise(a, now);
  const relapse = isRecovering(a);
  if (relapse || (a.addicted && inWithdrawal)) rise += 1;
  const doses = Math.max(0, Math.floor(Number(a.doses) || 0)) + 1;
  const strength = Math.floor(Number(a.strength) || 0);
  if (strength > 0 && doses % strength === 0) rise += 1;
  return { rise, doses, relapse };
}

/** The Stun track's own wound modifier (the highest band its boxes reach). */
export function stunTrackTn(stun: number): number {
  const b = Math.max(0, Math.floor(Number(stun) || 0));
  for (const [min, mod] of RULES.WOUND_MODIFIERS) if (b >= min) return mod;
  return 0;
}

/** The addict's numbers the book's withdrawal reads, from an actor's system data. */
export function addictWho(sys: any, concentration = false): { body: number; willpower: number; stunWoundTn: number; concentration: boolean } {
  return {
    body: Number(sys?.attributes?.body?.total ?? 0), willpower: Number(sys?.attributes?.willpower?.total ?? 0),
    stunWoundTn: stunTrackTn(Number(sys?.monitor?.stun ?? 0)), concentration,
  };
}
