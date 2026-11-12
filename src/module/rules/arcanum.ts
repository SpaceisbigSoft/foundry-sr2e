/**
 * v0.56.0: magic holes (pure rules; numbers in RULES.MAGIC_V56, all VERIFY): stat-changing spell
 * effects, healing drain by the wound and the Treat window, touch spells, learning spells, permanent
 * spells, wards, detection range, assensing, centering and nature spirits leaving at dawn or dusk.
 */
import { RULES, type DamageLevel } from './config.ts';
import { EFFECT_NUMBER_KEYS, emptyBundle, type EffectBundle } from './effects.ts';
import { urrMagWardDrain } from './urr80-magic.ts';
import { learnTnFactor, bookWardDrain, bookCenteringCut } from './sorcery923.ts';
import { t as tx, tCount, tNoun } from '../helpers/i18n.ts';

const M = () => RULES.MAGIC_V56;

const MINUS = '−';

/** "+2" / "−1" with a real minus sign. */
function signed(n: number): string {
  return n < 0 ? `${MINUS}${Math.abs(n)}` : `+${n}`;
}

/** A number with at most `places` decimals, trailing zeros trimmed. */
function trim(n: number, places = 2): string {
  return String(Number(n.toFixed(places)));
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ---------------------------------------------------------------- Effect bundles

/** True when the bundle changes anything at all. */
export function bundleHasEffect(b: Partial<EffectBundle> | null | undefined): boolean {
  if (!b) return false;
  for (const v of Object.values(b.attributes ?? {})) if (num(v) !== 0) return true;
  for (const k of EFFECT_NUMBER_KEYS) if (num(b[k]) !== 0) return true;
  return b.movementFactor != null && b.movementFactor !== 1;
}

/** A spell's Effects scaled by its successes (each `step` successes one more when per success, capped at `capAt`). */
export function scaleBundle(
  base: Partial<EffectBundle>,
  o: { perSuccess: boolean; successes: number; step?: number; capAt?: number | null },
): EffectBundle {
  const out = emptyBundle();
  if (!(o.successes > 0)) return out;
  let mult = 1;
  let cap = Infinity;
  if (o.perSuccess) {
    const step = Math.max(1, Math.floor(num(o.step ?? M().spellEffects.step)) || 1);
    mult = Math.floor(o.successes / step);
    if (typeof o.capAt === 'number' && o.capAt > 0) cap = o.capAt;
  }
  const scale = (v: unknown): number => {
    const x = num(v) * mult;
    const c = Math.min(Math.abs(x), cap);
    return x < 0 ? -c : c;
  };
  for (const [k, v] of Object.entries(base.attributes ?? {})) {
    const x = scale(v);
    if (x !== 0) (out.attributes as Record<string, number>)[k] = x;
  }
  for (const k of EFFECT_NUMBER_KEYS) out[k] = scale(base[k]) || 0;
  out.movementFactor = base.movementFactor ?? 1;
  return out;
}

/** Several bundles summed (movement factors multiply). */
export function sumBundles(list: ReadonlyArray<Partial<EffectBundle> | null | undefined>): EffectBundle {
  const out = emptyBundle();
  const attrs = out.attributes as Record<string, number>;
  for (const b of list) {
    if (!b) continue;
    for (const [k, v] of Object.entries(b.attributes ?? {})) attrs[k] = (attrs[k] ?? 0) + num(v);
    for (const k of EFFECT_NUMBER_KEYS) out[k] += num(b[k]);
    out.movementFactor *= b.movementFactor ?? 1;
  }
  for (const k of Object.keys(attrs)) if (attrs[k] === 0) delete attrs[k];
  return out;
}

/** A bundle in plain English ("Quickness +2, +1 initiative die, movement ×2"; "no change"). */
export function describeBundle(b: Partial<EffectBundle>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(b.attributes ?? {})) {
    const n = num(v);
    if (n) parts.push(`${capitalise(k)} ${signed(n)}`);
  }
  const reaction = num(b.reaction);
  if (reaction) parts.push(tx('SR2E.Text.Arcanum.reaction', { value: signed(reaction) }));
  const dice = num(b.initiativeDice);
  if (dice) parts.push(tCount(Math.abs(dice), 'SR2E.Text.Arcanum.initiativeDice', { value: signed(dice) }));
  const bal = num(b.ballistic);
  const imp = num(b.impact);
  if (bal || imp) parts.push(tx('SR2E.Text.Arcanum.armor', { ballistic: signed(bal), impact: signed(imp) }));
  const tests = num(b.testsTn);
  if (tests) parts.push(tx('SR2E.Text.Arcanum.tnOnAllTests', { value: signed(tests) }));
  const perceived = num(b.perceivedTn);
  if (perceived) parts.push(tx('SR2E.Text.Arcanum.tnToPerceive', { value: signed(perceived) }));
  const attacked = num(b.attackedTn);
  if (attacked) parts.push(tx('SR2E.Text.Arcanum.tnToAttack', { value: signed(attacked) }));
  const f = b.movementFactor;
  if (f != null && f !== 1 && Number.isFinite(f)) {
    if (f > 0 && f < 1 && Number.isInteger(Number((1 / f).toFixed(6)))) parts.push(tx('SR2E.Text.Arcanum.movementDivided', { value: trim(1 / f) }));
    else parts.push(tx('SR2E.Text.Arcanum.movementTimes', { value: trim(f) }));
  }
  return parts.length ? parts.join(', ') : tx('SR2E.Text.Arcanum.noChange');
}

// ---------------------------------------------------------------- Healing

/** The wound level a number of boxes on the track reaches (null below the first). */
export function woundLevelForBoxes(boxes: number): DamageLevel | null {
  let level: DamageLevel | null = null;
  // v0.81.1 (RB2-9): lowest threshold first, so a house-rule table listed high-first still gives the highest level reached.
  const rows = [...(M().healing.woundLevels as ReadonlyArray<readonly [number, DamageLevel]>)].sort((a, b) => a[0] - b[0]);
  for (const [threshold, l] of rows) {
    if (threshold <= boxes) level = l;
  }
  return level;
}

/** Drain "by the wound": the level of the wound healed, else the spell's own level. */
export function healDrainLevel(boxesBefore: number, fallback: DamageLevel): DamageLevel {
  return woundLevelForBoxes(boxesBefore) ?? fallback;
}

/** Why Treat can't be cast on a wound this old (null when it can, or no window applies). */
export function treatWindowProblem(damagedAt: number | null | undefined, now: number): string | null {
  const hours = num(M().healing.treatHours);
  if (hours <= 0 || typeof damagedAt !== 'number' || !Number.isFinite(damagedAt)) return null;
  const age = now - damagedAt;
  if (age <= hours * 3600) return null;
  const ageH = Number((age / 3600).toFixed(1));
  return tCount(hours, 'SR2E.Text.Arcanum.treatOnlyWorksWithin', { hours: trim(hours), ago: tNoun(ageH, 'hour') });
}

// ---------------------------------------------------------------- Touch

/** Whether the caster's token is close enough to touch ('unknown' without a distance). */
export function touchReach(distanceMetres: number | null | undefined): 'ok' | 'far' | 'unknown' {
  if (distanceMetres == null || Number.isNaN(distanceMetres)) return 'unknown';
  return distanceMetres <= num(M().touch.reachMetres) ? 'ok' : 'far';
}

/** Whether the touch lands (opposed: more successes than the defender; else any success). */
export function touchContact(casterSuccesses: number, defenderSuccesses: number): boolean {
  return M().touch.opposed ? casterSuccesses > defenderSuccesses : casterSuccesses > 0;
}

// ---------------------------------------------------------------- Learning and permanent spells

/** Learning a spell: TN, base days and days taken with these successes (null: failed). */
export function learningPlan(force: number, successes: number): { tn: number; baseDays: number; days: number | null } {
  // v0.80.0 (RULES.URR_V80.magLearning 'theory', URR): TN = 2 × Force.
  // v0.92.3 (RULES.SORCERY_V923.learning 'book', Core p. 132): the same 2 × Force.
  const tn = Math.max(RULES.MIN_TARGET_NUMBER, Math.floor(force) * learnTnFactor());
  const baseDays = force * num(M().learning.daysPerForce);
  return { tn, baseDays, days: successes > 0 ? Math.ceil(baseDays / successes) : null };
}

/** Combat Turns a permanent spell must be sustained (null without successes). */
export function permanentTurns(force: number, successes: number): number | null {
  if (!(successes > 0)) return null;
  return Math.max(1, Math.ceil((force * num(M().permanent.turnsPerForce)) / successes));
}

/** World time at which a permanent spell takes (null without successes). */
export function permanentUntil(now: number, force: number, successes: number, secondsPerTurn?: number): number | null {
  const turns = permanentTurns(force, successes);
  // Seconds per turn: the caller's when given (non-zero), else the config's permanent.secondsPerTurn, else
  // RULES.COMBAT_TURN_SECONDS. (The caller, documents/index.ts, passes the config's value first, then Foundry's round time.)
  const spt = num(secondsPerTurn ?? 0) || num(M().permanent.secondsPerTurn) || RULES.COMBAT_TURN_SECONDS;
  return turns == null ? null : now + turns * spt;
}

// ---------------------------------------------------------------- Wards

/** Raising a ward: TN, time, cost and the team's drain. */
export function wardPlan(force: number, successes: number): {
  tn: number; baseHours: number; hours: number | null; nuyen: number; drainTn: number; drainLevel: DamageLevel;
} {
  const w = M().ward;
  const baseHours = force * num(w.hoursPerForce);
  // v0.92.3 (RULES.SORCERY_V923.ward 'book', Grimoire p. 92 with the Grimoire II errata): the ritual takes Force hours
  // (not ÷ successes); Drain (Force × successes)L. The Revamp's own drain (URR_V80.magWardDrain) wins while it is on.
  const urr = urrMagWardDrain(force, successes);
  const bk = urr ? null : bookWardDrain(force, successes);
  return {
    tn: Math.max(RULES.MIN_TARGET_NUMBER, force),
    baseHours,
    hours: successes > 0 ? (bk ? baseHours : Math.ceil(baseHours / successes)) : null,
    nuyen: force * num(w.nuyenPerForce),
    // v0.80.0 (RULES.URR_V80.magWardDrain 'urr', URR): drain TN = Force + the successes.
    drainTn: urr?.drainTn ?? bk?.drainTn ?? Math.max(RULES.MIN_TARGET_NUMBER, Math.floor(force / 2) + num(w.drainModifier)),
    drainLevel: (bk?.level ?? w.drainLevel) as DamageLevel,
  };
}

// ---------------------------------------------------------------- Detection range

/** How far a detection spell reaches, in metres. */
export function detectionRangeMetres(magic: number, force: number, extended: boolean): number {
  const d = M().detectionRange;
  return Math.max(0, magic) * Math.max(0, force) * num(d.factor) * (extended ? num(d.extendedFactor) : 1);
}

/** Why a target is out of a detection spell's reach (null when in reach or the distance is unknown). */
export function detectionRangeProblem(distanceMetres: number | null | undefined, magic: number, force: number, extended: boolean): string | null {
  if (distanceMetres == null || !Number.isFinite(distanceMetres)) return null;
  const range = detectionRangeMetres(magic, force, extended);
  if (distanceMetres <= range) return null;
  const d = M().detectionRange;
  let how = tx('SR2E.Text.Arcanum.magicTimesForce', { magic, force });
  if (num(d.factor) !== 1) how += ` × ${trim(num(d.factor))}`;
  if (extended) how += tx('SR2E.Text.Arcanum.timesExtended', { factor: trim(num(d.extendedFactor)) });
  return tx('SR2E.Text.Arcanum.isMAwayTheSpell', { metres: Math.round(distanceMetres), range: trim(range, 1), how });
}

// ---------------------------------------------------------------- Assensing

export interface AssenseSubject {
  name: string;
  physical: number;
  stun: number;
  status: string;
  essence: number;
  magic: number;
  awakened: boolean;
  tradition?: string;
  cyberware: string[];
  foci: string[];
  sustained: string[];
  emotion?: string;
  signatures?: string[];
}

function compare(theirs: number, yours: number): string {
  if (Math.abs(theirs - yours) <= 0.5) return tx('SR2E.Text.Arcanum.aboutTheSameAsYours');
  return theirs > yours ? tx('SR2E.Text.Arcanum.higherThanYours') : tx('SR2E.Text.Arcanum.lowerThanYours');
}

function boxes(n: number): string {
  return tNoun(n, 'box');
}

/** One line per thing these assensing successes reveal (cumulative, in table order). */
export function assensingReveals(successes: number, subject: AssenseSubject, assenser: { essence: number; magic: number }): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const row of M().assensing as ReadonlyArray<{ successes: number; reveals: readonly string[] }>) {
    if (!(row.successes <= successes) || successes <= 0) continue;
    for (const key of row.reveals) {
      if (seen.has(key)) continue;
      seen.add(key);
      const line = revealLine(key, subject, assenser);
      if (line) out.push(line);
    }
  }
  return out;
}

function revealLine(key: string, s: AssenseSubject, a: { essence: number; magic: number }): string | null {
  switch (key) {
    case 'health': {
      const p = Math.max(0, num(s.physical));
      const st = Math.max(0, num(s.stun));
      let words = p || st ? tx('SR2E.Text.Arcanum.physicalStun', { physical: boxes(p), stun: boxes(st) }) : tx('SR2E.Text.Arcanum.unhurt');
      if (s.status && s.status !== 'ok') words += ` (${s.status})`;
      return tx('SR2E.Text.Arcanum.health', { words });
    }
    case 'emotion': return tx('SR2E.Text.Arcanum.mood', { emotion: s.emotion?.trim() || tx('SR2E.Text.Arcanum.calm') });
    case 'awakened': return s.awakened ? (s.tradition?.trim() ? tx('SR2E.Text.Arcanum.awakenedTradition', { tradition: s.tradition.trim() }) : tx('SR2E.Text.Arcanum.awakened')) : tx('SR2E.Text.Arcanum.mundane');
    case 'cyberware': return s.cyberware.length ? tx('SR2E.Text.Arcanum.cyberwareYes') : tx('SR2E.Text.Arcanum.cyberwareNone');
    case 'essenceCompare': return tx('SR2E.Text.Arcanum.essenceCompare', { compare: compare(s.essence, a.essence) });
    case 'magicCompare': return s.awakened ? tx('SR2E.Text.Arcanum.magicCompare', { compare: compare(s.magic, a.magic) }) : null;
    case 'essence': return tx('SR2E.Text.Arcanum.essence', { essence: trim(s.essence) });
    case 'magic': return s.awakened ? tx('SR2E.Text.Arcanum.magic', { magic: trim(s.magic) }) : null;
    case 'cyberwareList': return s.cyberware.length ? tx('SR2E.Text.Arcanum.cyberwareList', { list: s.cyberware.join(', ') }) : null;
    case 'foci': return s.foci.length ? tx('SR2E.Text.Arcanum.activeFoci', { list: s.foci.join(', ') }) : null;
    case 'sustained': return s.sustained.length ? tx('SR2E.Text.Arcanum.sustaining', { list: s.sustained.join(', ') }) : null;
    case 'signature': return s.signatures?.length ? tx('SR2E.Text.Arcanum.recognisesSignatures', { list: s.signatures.join(', ') }) : null;
    default: return null;
  }
}

// ---------------------------------------------------------------- Centering

/** Penalty points a centering test takes off: successes, up to grade × centeringPerGrade and the penalties. */
export function centeringCut(successes: number, grade: number, penaltyTotal: number): number {
  // v0.92.3 (RULES.SORCERY_V923.centering 'book', Grimoire p. 44): every 2 successes take 1 off, no grade cap.
  if (RULES.SORCERY_V923.centering === 'book') return bookCenteringCut(successes, penaltyTotal);
  return Math.min(Math.max(0, successes), Math.max(0, grade) * RULES.MAGIC.centeringPerGrade, Math.max(0, penaltyTotal));
}

/** Whether centering is automatic or a test for this character. */
export function centeringMode(skillName: string | null | undefined): 'auto' | 'test' {
  // v0.92.3 (RULES.SORCERY_V923.centering 'book', Grimoire p. 43): centering is always a test.
  if (RULES.SORCERY_V923.centering === 'book') return 'test';
  const mode = M().centering.mode;
  if (mode === 'auto') return 'auto';
  if (mode === 'test') return 'test';
  return String(skillName ?? '').trim() ? 'test' : 'auto';
}

// ---------------------------------------------------------------- Nature spirits and time of day

const DAY = 86400;

/** The time of day (hours, 0 to under 24) at a world time. */
export function timeOfDayHours(now: number): number {
  const h = (((now / 3600 + num(M().natureSpirits.dayStartHour)) % 24) + 24) % 24;
  return h >= 24 ? 0 : h;
}

/** The next sunrise or sunset strictly after `now` (world time seconds). */
export function nextDawnOrDusk(now: number): { at: number; which: 'sunrise' | 'sunset' } {
  const n = M().natureSpirits;
  const offset = Math.round(num(n.dayStartHour) * 3600);
  const clock = now + offset;
  const dayStart = Math.floor(clock / DAY) * DAY;
  const mod = (s: number) => ((s % DAY) + DAY) % DAY;
  let best: { at: number; which: 'sunrise' | 'sunset' } | null = null;
  for (const which of ['sunrise', 'sunset'] as const) {
    const s = mod(Math.round(num(n[which]) * 3600));
    for (let k = 0; k <= 1; k++) {
      const t = dayStart + k * DAY + s;
      if (t > clock) {
        if (!best || t - offset < best.at) best = { at: t - offset, which };
        break;
      }
    }
  }
  return best!;
}
