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

/**
 * Detection Factor points this decker loses to suppression (VR2 p. 40: 1 per suppressed IC), from the host's own
 * record (`hostRaw`: the host's mxic97 flag, written by the GM side); 0 under 'v965'.
 */
export function suppressedDfLoss(hostRaw: unknown, deckerUuid: string, run = ''): number {
  if (!on('suppress') || !deckerUuid) return 0;
  // Only this run's (`run`: the decker's jack-in stamp): the reduction ends when the decker leaves the system (VR2 p. 40).
  return hostMx(hostRaw).suppressed.filter((s) => s.decker === deckerUuid && s.run === String(run ?? '')).length;
}

/** The Detection Factor after suppression (never below the minimum TN). */
export function suppressedDf(df: number, hostRaw: unknown, deckerUuid: string, run = ''): number {
  const loss = suppressedDfLoss(hostRaw, deckerUuid, run);
  return loss > 0 ? minTn(num(df) - loss) : num(df);
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

/** Running a hot deck cool (VR2 p. 85, `hotCool`: a hot ASIST deck run cool): 1D6 less (at least 1D6, VERIFY). */
export function coolDice(dice: number, hotCool: boolean): number {
  if (!on('coolInit') || !hotCool) return dice;
  return Math.max(1, Math.floor(num(dice)) - 1);
}

/** Whether a reality filter's level counts (book): the deck has one, and no sculpted host's MPCP Test failed (`ok` 0). */
export function filterLevel(o: { realityFilter: boolean; ok: number | null }): number {
  if (!filterBook() || !o.realityFilter) return 0;
  return o.ok === 0 ? 0 : 1;
}

/** The MPCP a reality filter leaves (VR2 p. 84: −1; at least 1). */
export function filterMpcp(mpcp: number, realityFilter: boolean): number {
  if (!filterBook() || !realityFilter) return mpcp;
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
export function speed97(o: { reaction: number; responseIncrease: number; mpcp: number; sim: string; filter?: number; hotCool?: boolean }, per: number, baseDice: number, hotDice: number): { reaction: number; dice: number; counted: number } | null {
  const f = whole(o.filter) > 0 && filterBook() ? 1 : 0;
  const cool = on('coolInit') && o.sim === 'cold' && Boolean(o.hotCool);
  if (!f && !cool) return null;
  const ri = Math.max(0, Math.min(RULES.MATRIX.maxResponseIncrease, Math.floor(whole(o.mpcp) / 4), Math.floor(num(o.responseIncrease))));
  const hot = o.sim === 'hot' ? 1 : 0;
  const levels = Math.min(MAX_RESPONSE, ri + hot + f);
  const extra = levels - ri - hot;
  const dice = baseDice + ri + hot * hotDice + extra;
  return { reaction: Math.max(0, num(o.reaction)) + per * levels, dice: coolDice(dice, cool), counted: ri };
}

/** The operations table with Defuse Data Bomb augmented by the Defuse utility (VR2 pp. 41, 96); unchanged under 'v965'. */
export function defuseOp97<T extends { id: string; utility?: string }>(o: T): T {
  return o.id === 'defuseBomb' && on('dataBomb') ? { ...o, utility: 'defuse' } : o;
}

// ---------------------------------------------------------------- The host's record (GM-owned, VR2 pp. 40, 121–122)

/**
 * What the GM side keeps on the host (its mxic97 flag): the deckers' parries (`decker` parries `vs`), their evades (when
 * they end, and the decker's tally then) and the IC they suppress. Only the GM side writes it (applications/mxic97.ts
 * applyMx97, from a host change); a player's own actor flags never count for these.
 */
export interface HostMx {
  parry: Array<{ decker: string; vs: string; net: number; id: string }>;
  evade: Array<{ decker: string; vs: string; net: number; tallyAt: number; round: number; worldTime: number; combatId: string }>;
  suppressed: Array<{ decker: string; id: string; name: string; points: number; run: string }>;
  /** Positions won against a decker (`vs` gets `net` off its next attack on `decker`; VR2 p. 122: a backfire). */
  exposed: Array<{ decker: string; vs: string; net: number; id: string }>;
  /** IC whose crash choice the GM side has offered (one choice per crash, VR2 p. 40). */
  offered: string[];
  /** The newest request applied per kind, decker and opponent (`k`), so an older one that arrives later is ignored. */
  seen: Array<{ k: string; seq: number }>;
}

const rows = (raw: unknown): any[] => (Array.isArray(raw) ? raw.filter((x) => x && typeof x === 'object').slice(0, LIST_CAP * 4) : []);
/** The host's record as stored (anything malformed is dropped). */
export function hostMx(raw: unknown): HostMx {
  const r: any = raw && typeof raw === 'object' ? raw : {};
  return {
    parry: rows(r.parry).filter((x) => str(x.decker) && str(x.vs) && str(x.id)).map((x) => ({ decker: str(x.decker), vs: str(x.vs), net: Math.min(30, whole(x.net)), id: str(x.id, 60) })),
    evade: rows(r.evade).filter((x) => str(x.decker) && str(x.vs)).map((x) => ({ decker: str(x.decker), vs: str(x.vs), net: Math.min(30, whole(x.net)), tallyAt: Math.min(9999, whole(x.tallyAt)),
      round: Number.isFinite(Number(x.round)) ? Math.floor(Number(x.round)) : -1, worldTime: num(x.worldTime), combatId: str(x.combatId, 60) })),
    suppressed: rows(r.suppressed).filter((x) => str(x.decker) && str(x.id)).map((x) => ({ decker: str(x.decker), id: str(x.id), name: str(x.name, 120), points: Math.min(30, whole(x.points)), run: str(x.run, 60) })),
    exposed: rows(r.exposed).filter((x) => str(x.decker) && str(x.vs) && str(x.id)).map((x) => ({ decker: str(x.decker), vs: str(x.vs), net: Math.min(30, whole(x.net)), id: str(x.id, 60) })),
    seen: rows(r.seen).filter((x) => str(x.k, 900)).map((x) => ({ k: str(x.k, 900), seq: Math.min(SEQ_MAX, whole(x.seq)) })),
    offered: (Array.isArray(r.offered) ? r.offered : []).filter((x: unknown) => typeof x === 'string' && x).slice(-LIST_CAP * 4).map((x: string) => x.slice(0, 400)),
  };
}

/** A decker's request to the GM side (the `mx97` key of a host change): what to record, never how much is trusted. */
export interface Mx97Change { op: typeof MX97_OPS[number]; deckerUuid: string; vs?: string; id?: string; net?: number; cardId?: string; seq?: number }
/** The largest request sequence kept (a millisecond time stamp fits). */
export const SEQ_MAX = 9e15;

/**
 * Whether a maneuver request is not older than the newest already applied for the same kind, decker and opponent (a
 * Karma re-roll's request applied before the first one's): the record after taking it, or null to ignore it.
 */
export function takeSeq(rec: HostMx, kind: string, decker: string, vs: string, seq: number | undefined): HostMx | null {
  const k = `${kind}|${decker}|${vs}`;
  const before = rec.seen.find((x) => x.k === k);
  if (seq === undefined) return rec;
  if (before && before.seq > seq) return null;
  return { ...rec, seen: [...rec.seen.filter((x) => x.k !== k), { k, seq }].slice(-LIST_CAP * 4) };
}
/** The requests a host change may carry (a crash's choice is the GM side's own, never a request). */
export const MX97_OPS = ['parry', 'unparry', 'evade', 'unevade', 'exposed', 'unexposed', 'pos', 'unpos', 'bomb', 'count', 'suppress', 'release', 'improvise', 'unimprovise'] as const;
/**
 * v0.97.1: the combat maneuvers' requests (parries, evades, positions won and lost, and their take-backs): the ones a
 * GM may let apply without asking (rules/trust.ts safeAutoApply). Never the tally's or a suppression's.
 */
export const MX97_MANEUVER_OPS = ['parry', 'unparry', 'evade', 'unevade', 'exposed', 'unexposed', 'pos', 'unpos'] as const satisfies ReadonlyArray<typeof MX97_OPS[number]>;

/** Whether a bomb request names the bomb the same host change sets off (`bombOff`): else it is no blast at all. */
export function bombMatches(id: string | undefined, bombOff: { fileId?: string; subsystem?: string } | null | undefined): boolean {
  if (!id || !bombOff) return false;
  return id.startsWith('f:') ? Boolean(bombOff.fileId) && id.slice(2) === bombOff.fileId : !bombOff.fileId && id.slice(2) === String(bombOff.subsystem ?? '');
}

/** The host's position entry won by `vs` against `decker` (none used up by that attacker). */
export function hostExposed(raw: unknown, decker: string, vs: string, used: readonly string[] = []): { net: number; id: string } | null {
  const e = hostMx(raw).exposed.filter((x) => x.decker === decker && x.vs === vs && x.net > 0 && !used.includes(x.id)).sort((a, b) => b.net - a.net)[0];
  return e ? { net: e.net, id: e.id } : null;
}

/** A host change's `mx97` key cleaned (bounded strings and numbers), or null. */
export function cleanMx97(raw: unknown): Mx97Change | null {
  const r: any = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : null;
  if (!r || !(MX97_OPS as readonly string[]).includes(String(r.op)) || !str(r.deckerUuid)) return null;
  return {
    op: r.op, deckerUuid: str(r.deckerUuid),
    ...(str(r.vs) ? { vs: str(r.vs) } : {}), ...(str(r.id) ? { id: str(r.id) } : {}), ...(str(r.cardId, 60) ? { cardId: str(r.cardId, 60) } : {}),
    ...(r.net !== undefined ? { net: Math.min(30, whole(r.net)) } : {}),
    ...(r.seq !== undefined && Number.isFinite(Number(r.seq)) ? { seq: Math.min(SEQ_MAX, whole(r.seq)) } : {}),
  };
}

/** The most net successes the GM side records for a maneuver: at most the decker's dice for it (and 30). */
export function maneuverCap(net: number, dice: number): number {
  return Math.max(0, Math.min(whole(net), whole(dice), 30));
}

/** The host's parry entry for `decker` against `vs` (none used up by that attacker). */
export function hostParry(raw: unknown, decker: string, vs: string, used: readonly string[] = []): { net: number; id: string } | null {
  const e = hostMx(raw).parry.filter((x) => x.decker === decker && x.vs === vs && x.net > 0 && !used.includes(x.id)).sort((a, b) => b.net - a.net)[0];
  return e ? { net: e.net, id: e.id } : null;
}

/** The deck damage card's IC rating, bounded: black IC's last shot is double the rating (VR2 p. 48). */
export function deckDamageRating(raw: unknown, lastShot: boolean): number {
  const n = Math.floor(Number(raw));
  return Number.isFinite(n) ? Math.max(0, Math.min(lastShot ? 60 : 20, n)) : 0;
}

/** Whether the reality filter runs the book's way: it needs the book persona speed (RULES.MATRIX_V923.initiative 'book'). */
export function filterBook(): boolean {
  return on('realityFilter') && RULES.MATRIX_V923.initiative === 'book';
}
