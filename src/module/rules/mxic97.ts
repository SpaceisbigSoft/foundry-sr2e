/**
 * v0.97.0 rules completeness, the Matrix: IC and cybercombat. Pure functions over RULES.MXIC_V97
 * (rules/config97/mxic.ts), from Virtual Realities 2.0 (VR2). Each behaves the book's way at the shipped value of its
 * switch; at the other value ('v965') the caller keeps the v0.96.5 code. No Foundry dependency. A refusal is a
 * language key (`why`), never text.
 */
import { RULES, type DamageLevel } from './config.ts';

const V = () => RULES.MXIC_V97;
const num = (v: unknown, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const whole = (v: unknown) => Math.max(0, Math.floor(num(v)));
const minTn = (n: number) => Math.max(RULES.MIN_TARGET_NUMBER, Math.floor(num(n)));
const str = (v: unknown, max = 400) => (typeof v === 'string' ? v.slice(0, max) : '');
const WHY = 'SR2E.MxIc97.Why.';
/** At most this many entries in any list this file keeps on an actor (a bound on what a player could stuff in). */
export const LIST_CAP = 40;

export type MxIc97Switch = keyof typeof RULES.MXIC_V97;
/** Whether a switch is at the book's way. */
export const on = (key: MxIc97Switch): boolean => (V() as any)[key] === 'book';

// ---------------------------------------------------------------- Suppressing IC (VR2 pp. 40, 120)

/** An IC (or data bomb) a decker suppresses: where, and the tally points releasing it puts back. */
export interface Suppressed { id: string; hostUuid: string; name: string; points: number }

/** The suppressed list as stored on a decker (anything malformed is dropped). */
export function suppressedList(raw: unknown): Suppressed[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x) => x && typeof x === 'object' && str((x as any).id) && str((x as any).hostUuid))
    .slice(0, LIST_CAP)
    .map((x: any) => ({ id: str(x.id), hostUuid: str(x.hostUuid), name: str(x.name, 120), points: Math.min(30, whole(x.points)) }));
}

/** Detection Factor points lost to suppression in this host (VR2 p. 40: 1 per suppressed IC); 0 under 'v965'. */
export function suppressedDfLoss(raw: unknown, hostUuid: string): number {
  if (!on('suppress') || !hostUuid) return 0;
  return suppressedList(raw).filter((s) => s.hostUuid === hostUuid).length;
}

/** The Detection Factor after suppression (never below the minimum TN). */
export function suppressedDf(df: number, raw: unknown, hostUuid: string): number {
  const loss = suppressedDfLoss(raw, hostUuid);
  return loss > 0 ? minTn(num(df) - loss) : num(df);
}

/**
 * The list after suppressing `entry`: entries of other hosts go (the reduction lasts while the decker stays in the
 * system), one entry per IC. Null when it is already suppressed.
 */
export function suppressAfter(raw: unknown, entry: Suppressed): Suppressed[] | null {
  const list = suppressedList(raw).filter((s) => s.hostUuid === entry.hostUuid);
  if (list.some((s) => s.id === entry.id)) return null;
  return [...list, { ...entry, name: str(entry.name, 120), points: Math.min(30, whole(entry.points)) }].slice(-LIST_CAP);
}

/** Releasing a suppressed IC: the list without it, and what it puts on the tally (null when it is not suppressed). */
export function releaseSuppressed(raw: unknown, id: string): { list: Suppressed[]; entry: Suppressed } | null {
  const list = suppressedList(raw);
  const entry = list.find((s) => s.id === id);
  return entry ? { list: list.filter((s) => s !== entry), entry } : null;
}

// ---------------------------------------------------------------- Black IC's last shot (VR2 p. 48)

/**
 * Whether this resistance test leaves the decker killed (lethal black IC) or knocked out (non-lethal): then black IC
 * makes its shot at the MPCP with double its rating. Null when no shot is due (or 'v965').
 */
export function blackIcFinalShot(o: { lethal: boolean; before: string; after: string; rating: number }): { rating: number } | null {
  if (!on('blackIcKill')) return null;
  const down = (s: string) => (o.lethal ? s === 'dead' : s !== 'ok' && s !== '');
  if (!down(o.after) || down(o.before)) return null;
  return { rating: whole(o.rating) * 2 };
}

/** Whether MPCP damage destroys the MPCP (VR2 p. 48): it reaches the chip's rating. */
export function mpcpDestroyed(rating: number, damage: number): boolean {
  return whole(rating) > 0 && whole(damage) >= whole(rating);
}

/**
 * The deck's files after the wipe (VR2 p. 48: all data downloaded during the run): the files that were on the deck
 * when the decker jacked in (`runStart`, a count) stay. Without a count, the files downloaded from a host (a `source`)
 * go (VERIFY: the run's start wasn't recorded).
 */
export function wipeRunFiles<T extends { source?: string }>(files: readonly T[], runStart: number | null): T[] {
  const list = [...(files ?? [])];
  if (runStart != null && Number.isFinite(runStart)) return list.slice(0, Math.min(list.length, whole(runStart)));
  return list.filter((f) => !str(f?.source));
}

// ---------------------------------------------------------------- Improvised attacks (VR2 pp. 120, 123)

/** What an improvised attack needs (VR2 p. 123): Power = the points taken from Evasion and Bod, at most the MPCP. */
export function improvisedPlan(o: { evasion: number; bod: number; fromEvasion: number; fromBod: number; mpcp: number }): { power: number; tn: number; why?: string } {
  const e = whole(o.fromEvasion), b = whole(o.fromBod);
  const power = e + b;
  if (!on('improvised')) return { power: 0, tn: 0, why: `${WHY}improviseOff` };
  if (power <= 0) return { power, tn: 0, why: `${WHY}improviseNone` };
  if (e > whole(o.evasion) || b > whole(o.bod)) return { power, tn: 0, why: `${WHY}improviseMore` };
  if (power > whole(o.mpcp)) return { power, tn: 0, why: `${WHY}improviseMpcp` };
  return { power, tn: minTn(power) };
}

/** The improvised program's Damage Level (VR2 p. 123): 1 success L, 2 M, 3 S, 4 or more D; null without one. */
export function improvisedLevel(successes: number): DamageLevel | null {
  const s = whole(successes);
  return s >= 4 ? 'D' : s === 3 ? 'S' : s === 2 ? 'M' : s === 1 ? 'L' : null;
}

/** An improvised attack waiting to be used, as stored on the decker. */
export interface Improvised { power: number; level: DamageLevel | ''; evasion: number; bod: number; hostUuid: string }

/** The stored improvised attack (null when none or malformed). */
export function improvisedOf(raw: unknown): Improvised | null {
  if (!raw || typeof raw !== 'object') return null;
  const r: any = raw;
  const level = ['L', 'M', 'S', 'D'].includes(r.level) ? r.level as DamageLevel : '';
  return { power: Math.min(30, whole(r.power)), level, evasion: Math.min(30, whole(r.evasion)), bod: Math.min(30, whole(r.bod)), hostUuid: str(r.hostUuid) };
}

/** The persona's crippled points after giving back an improvised attack's points (never below 0). */
export function giveBack(crippled: Record<string, number>, imp: { evasion: number; bod: number }): Record<string, number> {
  const c = { bod: 0, evasion: 0, masking: 0, sensors: 0, ...(crippled ?? {}) };
  return { ...c, evasion: Math.max(0, whole(c.evasion) - whole(imp.evasion)), bod: Math.max(0, whole(c.bod) - whole(imp.bod)) };
}

// ---------------------------------------------------------------- Combat maneuvers (VR2 pp. 121–122)

/** A book maneuver in force (on the decker who made it): `vs` the opponent. */
export interface MxEntry { id: string; vs: string; net: number; hostUuid: string }
/** A decker's book maneuvers: their parries and positions, and the opponents' positions won against them. */
export interface MxState { parry: MxEntry[]; pos: MxEntry[]; exposed: MxEntry[]; evade: Array<{ vs: string; tallyAt: number; hostUuid: string }> }
export const NO_MX: MxState = { parry: [], pos: [], exposed: [], evade: [] };

const entries = (raw: unknown): MxEntry[] => (Array.isArray(raw) ? raw : [])
  .filter((x) => x && typeof x === 'object' && str((x as any).id) && str((x as any).vs))
  .slice(0, LIST_CAP)
  .map((x: any) => ({ id: str(x.id, 60), vs: str(x.vs), net: Math.min(30, whole(x.net)), hostUuid: str(x.hostUuid) }));

/** The stored maneuver state (anything malformed is dropped). */
export function mxState(raw: unknown): MxState {
  const r: any = raw && typeof raw === 'object' ? raw : {};
  const evade = (Array.isArray(r.evade) ? r.evade : []).filter((x: any) => x && typeof x === 'object' && str(x.vs)).slice(0, LIST_CAP)
    .map((x: any) => ({ vs: str(x.vs), tallyAt: Math.min(9999, whole(x.tallyAt)), hostUuid: str(x.hostUuid) }));
  return { parry: entries(r.parry), pos: entries(r.pos), exposed: entries(r.exposed), evade };
}

/** Which side a maneuver favours (VR2p. 121: more successes; a tie fails), and by how much. */
export function maneuverWinner(mine: number, theirs: number): { who: 'me' | 'them' | null; net: number } {
  const d = whole(mine) - whole(theirs);
  return d > 0 ? { who: 'me', net: d } : d < 0 ? { who: 'them', net: -d } : { who: null, net: 0 };
}

/**
 * The state after a maneuver's opposed test (book). `replaces`: the id this card left before (a re-roll takes it back).
 * Position: the winner's bonus (an `exposed` entry when the opponent wins: it backfires). Parry: a parry entry. Evade:
 * the parries against that opponent are lost (VR2 p. 122), and the tally is noted for the re-find time.
 */
export function maneuverAfter(raw: unknown, o: { kind: 'position' | 'parry' | 'evade'; vs: string; hostUuid: string; mine: number; theirs: number; id: string; replaces?: string | null; tally?: number }): { state: MxState; entryId: string | null; who: 'me' | 'them' | null; net: number } {
  const s = mxState(raw);
  const drop = (l: MxEntry[]) => l.filter((e) => e.id !== o.replaces);
  const st: MxState = { parry: drop(s.parry), pos: drop(s.pos), exposed: drop(s.exposed), evade: s.evade.filter((e) => e.vs !== o.vs || o.kind !== 'evade') };
  const w = maneuverWinner(o.mine, o.theirs);
  const entry: MxEntry = { id: o.id, vs: o.vs, net: w.net, hostUuid: o.hostUuid };
  const put = (l: MxEntry[]) => [...l.filter((e) => e.vs !== o.vs), entry].slice(-LIST_CAP);
  let entryId: string | null = null;
  if (o.kind === 'position' && w.who === 'me') { st.pos = put(st.pos); entryId = o.id; }
  if (o.kind === 'position' && w.who === 'them') { st.exposed = put(st.exposed); entryId = o.id; }
  if (o.kind === 'parry' && w.who === 'me') { st.parry = put(st.parry); entryId = o.id; }
  if (o.kind === 'evade' && w.who === 'me') {
    st.parry = st.parry.filter((e) => e.vs !== o.vs);
    st.evade = [...st.evade, { vs: o.vs, tallyAt: whole(o.tally), hostUuid: o.hostUuid }].slice(-LIST_CAP);
  }
  return { state: st, entryId, who: w.who, net: w.net };
}

/** The best entry of a list against `vs` in this host that the opponent has not used up yet (`used`: their ids). */
export function bestEntry(list: readonly MxEntry[], vs: string, hostUuid: string, used: readonly string[] = []): MxEntry | null {
  return list.filter((e) => e.vs === vs && e.hostUuid === hostUuid && e.net > 0 && !used.includes(e.id))
    .reduce<MxEntry | null>((b, e) => (!b || e.net > b.net ? e : b), null);
}

/** An attacker's used-up entry ids after this attack (newest kept). */
export function usedAfter(raw: unknown, ids: readonly string[]): string[] {
  const prev = (Array.isArray(raw) ? raw : []).filter((x) => typeof x === 'string').map((x) => str(x, 60));
  return [...new Set([...prev, ...ids.filter(Boolean)])].slice(-LIST_CAP);
}

/** A position bonus used as −TN or +Power (VR2 p. 122: the attacker's choice). */
export function positionUse(net: number, as: string): { tn: number; power: number } {
  const n = whole(net);
  return as === 'power' ? { tn: 0, power: n } : { tn: -n, power: 0 };
}

/**
 * Evade detection (VR2 p. 121): the round (in combat) or world time up to which IC can't find the icon again: net
 * Combat Turns, 1 less per point added to the icon's tally since (`gain`).
 */
export function evadeEnd(o: { round: number | null; worldTime: number; net: number; gain: number; secondsPerTurn?: number }): { round: number; worldTime: number } {
  const turns = whole(o.net) - whole(o.gain);
  const sec = whole(o.secondsPerTurn ?? 3) || 3;
  return { round: o.round != null && o.round >= 0 ? o.round + turns : -1, worldTime: num(o.worldTime) + turns * sec };
}

/**
 * Whether a stored evade (the old list's entry: its round or world time is when it was made + net) still holds after
 * `gain` tally points. The tally shortens the period, but the IC shows up at the end of a turn (VR2 p. 121, the book's
 * example): never before the end of the turn after the evade.
 */
export function evadeHolds(m: { round: number; worldTime: number; net?: number; combatId?: string }, now: { round?: number | null; worldTime: number; combatId?: string | null }, gain: number): boolean {
  const g = whole(gain);
  const n = whole(m.net ?? 0);
  const sameCombat = m.round >= 0 && now.round != null && String(m.combatId ?? '') === String(now.combatId ?? '');
  if (sameCombat) return now.round! <= Math.max(m.round - g, Math.min(m.round, m.round - n + 1));
  const wt = num(m.worldTime);
  return num(now.worldTime) <= Math.max(wt - g * 3, Math.min(wt, wt - (n - 1) * 3));
}

// ---------------------------------------------------------------- Ripper IC (VR2 p. 43)

/** The Ripper Test's TN (VR2 p. 43): the MPCP, Hardening raising it. */
export function ripperTn(mpcp: number, hardening: number): number {
  return minTn(whole(mpcp) + whole(hardening));
}

/** Points off the persona chip (VR2 p. 43): 1 per success, no more than the chip has. */
export function ripperChipLoss(successes: number, chipLeft: number): number {
  return Math.min(whole(successes), whole(chipLeft));
}

// ---------------------------------------------------------------- Tar baby and tar pit (VR2 pp. 42–43)

/** Utilities tar IC leaves alone (VR2 p. 42: completely passive ones such as armor and sleaze). */
export const TAR_PASSIVE = ['armor', 'sleaze'] as const;

/** Whether tar IC may go after a utility of this kind. */
export function tarTargets(kind: string): boolean {
  return !on('tar') || !(TAR_PASSIVE as readonly string[]).includes(String(kind ?? ''));
}

/** The Tar Baby (Tar Pit) Test's TN (VR2 p. 42): the utility's rating, −2 in a construct, party or trap. */
export function tarTn(utilityRating: number, grouped: boolean): number {
  return minTn(whole(utilityRating) - (grouped ? 2 : 0));
}

/** The utility's side of the opposed test: its rating as dice against the tar's rating. */
export function tarDefense(utilityRating: number, tarRating: number): { dice: number; tn: number } {
  return { dice: whole(utilityRating), tn: minTn(tarRating) };
}

/** Whether a Tar Pit Test corrupts every copy (VR2 p. 43: any success); its TN the MPCP + Hardening. */
export function tarPitCorrupts(successes: number): boolean {
  return whole(successes) > 0;
}

// ---------------------------------------------------------------- Scramble IC (VR2 p. 42)

/** Whether a scrambled file is poison scramble (it has no data bomb: an exploding one sets the bomb off instead). */
export function poisonScramble(file: { scramble?: number; bomb?: number } | null | undefined): boolean {
  return on('scramble') && whole(file?.scramble) > 0 && !(whole(file?.bomb) > 0);
}

/** The Poison Test (VR2 p. 42): the scramble's rating against the decker's Computer skill; any success destroys the data. */
export function poisonTest(rating: number, computer: number): { dice: number; tn: number } {
  return { dice: whole(rating), tn: minTn(computer) };
}

// ---------------------------------------------------------------- Data bombs and Defuse (VR2 pp. 41, 96)

/** The subsystem whose rating is the defuse test's TN (VR2 p. 41): the file's (Files) or the bomb's own. */
export function defuseSubsystem(o: { fileBomb: boolean; bombSubsystem?: string | null }): string {
  return o.fileBomb ? 'files' : String(o.bombSubsystem || 'files');
}

/** Whether a failed defuse sets the bomb off (VR2 p. 41: all the dice came up 1). */
export function defuseBlows(dice: ReadonlyArray<{ total?: number; result?: number }>): boolean {
  const d = (dice ?? []).map((x) => num(x?.total ?? x?.result));
  return on('dataBomb') && d.length > 0 && d.every((v) => v === 1);
}

// ---------------------------------------------------------------- Persona speed (VR2 pp. 84–87; Mapping Matrices p. 69)

/** The absolute Response Increase limit with a reality filter and hot DNI (VR2 p. 87). */
export const MAX_RESPONSE = 5;

/** Running cool (VR2 p. 85): 1D6 less (at least 1D6, VERIFY). */
export function coolDice(dice: number, sim: string): number {
  if (!on('coolInit') || sim !== 'cold') return dice;
  return Math.max(1, Math.floor(num(dice)) - 1);
}

/** Whether a reality filter's level counts (book): the deck has one, and no sculpted host's MPCP Test failed (`ok` 0). */
export function filterLevel(o: { realityFilter: boolean; ok: number | null }): number {
  if (!on('realityFilter') || !o.realityFilter) return 0;
  return o.ok === 0 ? 0 : 1;
}

/** The MPCP a reality filter leaves (VR2 p. 84: −1; at least 1). */
export function filterMpcp(mpcp: number, realityFilter: boolean): number {
  if (!on('realityFilter') || !realityFilter) return mpcp;
  return Math.max(1, Math.floor(num(mpcp)) - 1);
}

/** Non-combat actions per turn (VR2 p. 120): Reaction ÷ 10 round up, +1 per Initiative die beyond the first. */
export function nonCombatActions(reaction: number, dice: number): number | null {
  if (!on('nonCombat')) return null;
  return Math.max(1, Math.ceil(whole(reaction) / 10)) + Math.max(0, whole(dice) - 1);
}

/**
 * The book persona speed with a reality filter's level and running cool (VR2 pp. 84–87), for matrix923.personaSpeed:
 * null when neither changes anything (the caller's own formula stands).
 */
export function speed97(o: { reaction: number; responseIncrease: number; mpcp: number; sim: string; filter?: number }, per: number, baseDice: number, hotDice: number): { reaction: number; dice: number; counted: number } | null {
  const f = whole(o.filter) > 0 && on('realityFilter') ? 1 : 0;
  const cool = on('coolInit') && o.sim === 'cold';
  if (!f && !cool) return null;
  const ri = Math.max(0, Math.min(RULES.MATRIX.maxResponseIncrease, Math.floor(whole(o.mpcp) / 4), Math.floor(num(o.responseIncrease))));
  const hot = o.sim === 'hot' ? 1 : 0;
  const levels = Math.min(MAX_RESPONSE, ri + hot + f);
  const extra = levels - ri - hot;
  const dice = baseDice + ri + hot * hotDice + extra;
  return { reaction: Math.max(0, num(o.reaction)) + per * levels, dice: coolDice(dice, o.sim), counted: ri };
}

/** The operations table with Defuse Data Bomb augmented by the Defuse utility (VR2 pp. 41, 96); unchanged under 'v965'. */
export function defuseOp97<T extends { id: string; utility?: string }>(o: T): T {
  return o.id === 'defuseBomb' && on('dataBomb') ? { ...o, utility: 'defuse' } : o;
}
