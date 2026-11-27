/**
 * v0.95.0 rules completeness (area: ranged combat): pure functions for RULES.FIRE_V95 (config95/fire.ts). No Foundry
 * globals. The Unified Rules Revamp has no rule of its own for any of these, so every switch reads the same under
 * either rules source. Glue: documents/fire95.ts (the actor's side), applications/fire95.ts (canvas, dialogs, cards).
 */
import { RULES, type DamageLevel } from './config.ts';
import { blastLoss } from './weapons.ts';

const V = () => RULES.FIRE_V95;
const num = (x: unknown): number => (Number.isFinite(Number(x)) ? Number(x) : 0);
const int = (x: unknown, lo: number, hi: number): number => Math.min(hi, Math.max(lo, Math.floor(num(x))));

// ---------------------------------------------------------------- laser sights (Core p. 90)

/**
 * Why a laser sight gives nothing in this air: 'weather' (mist, fog, rain: the scene's weather id is in
 * `laserWeather`), 'smoke' (smoke on the line of fire), or '' (it works, or the rule is off).
 */
export function laserCancelled(o: { weather?: string | null; smoke?: boolean }): '' | 'weather' | 'smoke' {
  if (V().laser !== 'book') return '';
  if (o.smoke) return 'smoke';
  return V().laserWeather.includes(String(o.weather ?? '')) ? 'weather' : '';
}

// ---------------------------------------------------------------- two firearms (Core p. 90)

/** What each gun fired this Combat Phase: its rounds, the recoil modifier its last shot was left with. */
export interface TwoGunState { phase: string; guns: Record<string, { rounds: number; recoil: number; firstSingle?: boolean }> }

/** Whether the shared-recoil rule is in play for an attack ("Using a second firearm" ticked). */
export function sharedRecoilOn(situational: readonly string[] | null | undefined): boolean {
  return V().sharedRecoil === 'book' && (situational ?? []).includes('secondWeapon');
}

/**
 * Firing `weaponId` as one of two guns: the rounds the other guns fired this phase (not this gun's recoil), the
 * uncompensated recoil they were left with (added to this gun's), and whether this gun's own first shot was single.
 */
export function twoGunShare(state: TwoGunState | null | undefined, phase: string | null, weaponId: string): { otherRounds: number; shared: number; ownRounds: number; firstSingle?: boolean } {
  const out: { otherRounds: number; shared: number; ownRounds: number; firstSingle?: boolean } = { otherRounds: 0, shared: 0, ownRounds: 0 };
  if (!phase || !state || state.phase !== phase || !state.guns || typeof state.guns !== 'object') return out;
  for (const [id, g] of Object.entries(state.guns)) {
    if (id === weaponId) {
      out.ownRounds = int(g?.rounds, 0, 999);
      if (out.ownRounds > 0 && typeof g?.firstSingle === 'boolean') out.firstSingle = g.firstSingle;
    } else { out.otherRounds += int(g?.rounds, 0, 999); out.shared += int(g?.recoil, 0, 99); }
  }
  return out;
}

/** The state after `weaponId` fired: its rounds this phase so far and the recoil its shot was left with. */
export function twoGunRecord(state: TwoGunState | null | undefined, phase: string, weaponId: string, shot: { ownEarlier: number; rounds: number; recoil: number; firstSingle?: boolean }): TwoGunState {
  const guns = state && state.phase === phase && state.guns && typeof state.guns === 'object' ? { ...state.guns } : {};
  const before = guns[weaponId];
  const first = before && int(before.rounds, 0, 999) > 0 && typeof before.firstSingle === 'boolean' ? before.firstSingle : shot.firstSingle;
  guns[weaponId] = { rounds: int(shot.ownEarlier, 0, 999) + int(shot.rounds, 0, 999), recoil: int(shot.recoil, 0, 99), ...(typeof first === 'boolean' ? { firstSingle: first } : {}) };
  return { phase, guns };
}

// ---------------------------------------------------------------- Take Aim and pool dice (Core p. 82)

/** An aim's first Combat Phase, kept beside the aim: the phase it began in while it is held, else this phase. */
export function aimStartPhase(prev: { phase95?: unknown; actions?: unknown } | null | undefined, heldActions: number, phaseNow: string | null): string {
  const kept = heldActions > 1 && prev && typeof prev.phase95 === 'string' ? prev.phase95 : '';
  return kept || String(phaseNow ?? '');
}

/** Whether a kept aim has run over more than one Combat Phase (it began in another phase than this one). */
export function aimSpansPhases(aim: { phase95?: unknown; actions?: unknown } | null | undefined, phaseNow: string | null): boolean {
  if (!aim || !num(aim.actions)) return false;
  const began = typeof aim.phase95 === 'string' ? aim.phase95 : '';
  return Boolean(began) && Boolean(phaseNow) && began !== phaseNow;
}

/** Whether pool dice lose the aim: the rule on, the aim held over several phases, and any pool dice used. */
export function aimLostToPool(aim: { phase95?: unknown; actions?: unknown } | null | undefined, phaseNow: string | null, poolDice: number): boolean {
  return V().aimPool === 'book' && num(poolDice) > 0 && aimSpansPhases(aim, phaseNow);
}

// ---------------------------------------------------------------- explosive rounds (Core p. 93)

/** Whether the round goes off in the gun: explosive ammunition and every die of the Attack Test a 1. */
export function misfires(o: { ammoId?: string | null; botch: boolean; melee?: boolean; blast?: boolean }): boolean {
  return V().misfire === 'book' && !o.melee && !o.blast && Boolean(o.botch) && V().misfireAmmo.includes(String(o.ammoId ?? ''));
}

/** The misfire's attack on the shooter: the weapon's normal round, `die` (1D6) attack successes, no Combat Pool. */
export function misfireHit(o: { power: number; level: DamageLevel; die: number }): { power: number; level: DamageLevel; successes: number } {
  return { power: Math.max(0, Math.floor(num(o.power))), level: o.level, successes: int(o.die, 1, 6) };
}

// ---------------------------------------------------------------- shotgun shot (Core p. 95)

/**
 * Extra resistance dice in a shot spread: for each target, how many of the others stand between it and the gun
 * (closer along the line of fire). Keyed by `id`; nothing when the rule is off.
 */
export function shotScreens(targets: ReadonlyArray<{ id: string; metres: number }>): Record<string, number> {
  const out: Record<string, number> = {};
  if (V().shotScreen !== 'book') return out;
  for (const t of targets) {
    const n = targets.filter((o) => o.id !== t.id && num(o.metres) < num(t.metres)).length;
    if (n > 0) out[t.id] = Math.min(n, int(V().shotScreenMax, 0, 99));
  }
  return out;
}

/** The extra dice a damage card may claim (bounded: the number comes from card data). */
export function shotScreenDice(n: unknown): number {
  return V().shotScreen === 'book' ? int(n, 0, int(V().shotScreenMax, 0, 99)) : 0;
}

// ---------------------------------------------------------------- blast in a confined space (Core p. 98)

/** A wall on the line through the blast and a target: metres from the blast, its barrier rating (null: unrated). */
export interface ReboundWall { metres: number; rating: number | null }

/** Whether the per-target rebound is in play (else RULES.COMBAT.confined's nearest-wall share). */
export function reboundBook(): boolean { return V().rebound === 'book'; }

/** Whether a wall stands against a wave of `powerAt` (the same test as blasts through walls, RULES.COMBAT_V72.blastBarriers). */
export function wallHolds(powerAt: number, wall: ReboundWall): boolean {
  const cfg = RULES.COMBAT_V72.blastBarriers;
  const unrated = wall.rating == null || !Number.isFinite(Number(wall.rating));
  if (cfg.mode === 'block' || (unrated && cfg.unratedWalls === 'block')) return true;
  if (cfg.mode === 'armor') return false;
  const rating = Math.max(0, unrated ? num(RULES.COMBAT.barriers.defaultWallRating) : Number(wall.rating));
  return powerAt <= rating * num(cfg.holdMultiplier);
}

/**
 * The rebounding wave for one target, on the line through the blast point and the target: `ahead` is the first
 * wall past the target, `behind` the first wall on the other side of the blast. Each wave runs to its wall; a wall
 * that holds sends it back the way it came, and each time it passes the target with Power left that Power is added
 * (`passes`, in the order they arrive; `extra` their sum). Null when the rule is off.
 */
export function reboundPower(o: { power: number; perMetre: number; metres: number; ahead?: ReboundWall | null; behind?: ReboundWall | null }): { extra: number; passes: number[] } | null {
  if (!reboundBook() || !RULES.COMBAT.confined.enabled) return null;
  const power = num(o.power), d = Math.max(0, num(o.metres));
  const a = o.ahead && num(o.ahead.metres) >= d ? { pos: num(o.ahead.metres), wall: o.ahead } : null;
  const b = o.behind && num(o.behind.metres) >= 0 ? { pos: -num(o.behind.metres), wall: o.behind } : null;
  const max = int(V().reboundPasses, 0, 99);
  const found: Array<{ path: number; p: number }> = [];
  for (const first of [1, -1]) {
    let dir = first, pos = 0, path = 0;
    for (let guard = 0; guard < max + 2; guard++) {
      const side = dir > 0 ? a : b;
      if (!side) break;
      path += Math.abs(side.pos - pos);
      const at = power - blastLoss(path, o.perMetre);
      if (at <= 0 || !wallHolds(at, side.wall)) break;
      pos = side.pos;
      dir = -dir;
      const p = power - blastLoss(path + Math.abs(pos - d), o.perMetre);
      if (p <= 0) break;
      found.push({ path: path + Math.abs(pos - d), p });
    }
  }
  const passes = found.sort((x, y) => x.path - y.path).slice(0, max).map((f) => f.p);
  return { extra: passes.reduce((s, p) => s + p, 0), passes };
}

// ---------------------------------------------------------------- stray shots (Core p. 93, optional)

/** Whether stray shots are on (an optional rule, off as shipped). */
export function strayOn(): boolean { return V().stray === 'book'; }

/**
 * Stray rounds from walking full auto between targets: the rounds wasted on the way (one per metre), none from a
 * smartgun used with a smartlink, none when the rule is off.
 */
export function strayRounds(wasted: number, smartlinked: boolean): number {
  return strayOn() && !smartlinked ? int(wasted, 0, 99) : 0;
}

/** The order the people near the line are checked in: random (`rnd` gives 0 ≤ x < 1). */
export function strayOrder<T>(list: readonly T[], rnd: () => number = Math.random): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.max(0, Math.floor(rnd() * (i + 1))));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** A stray round's hit: any success hits, and the attack then counts the test's successes plus `die` (1D6). */
export function strayHit(successes: number, die: number): { hit: boolean; successes: number } {
  const s = int(successes, 0, 99);
  return s > 0 ? { hit: true, successes: s + int(die, 1, 6) } : { hit: false, successes: 0 };
}

// ---------------------------------------------------------------- suppressive fire (Fields of Fire p. 78, optional)

/** Whether suppressive fire runs the Fields of Fire way. */
export function suppressionFof(): boolean { return V().suppression === 'fof'; }

/**
 * Rounds laid over an area `metres` wide: each round covers one metre, so at least one round per metre (the area
 * shrinks to the rounds fired); the rounds are spread evenly and `perMetre` (rounded down) is each metre's share.
 */
export function fofArea(rounds: number, metres: number): { rounds: number; metres: number; perMetre: number; phases: number } {
  const r = int(rounds, 0, 999);
  const m = r > 0 ? int(metres, 1, r) : 0;
  return { rounds: r, metres: m, perMetre: m > 0 ? Math.floor(r / m) : 0, phases: int(V().fofPhases, 0, 99) };
}

/** The test against someone who shows themselves: one die per round on their metre, TN base + cover + the shooter's wounds. */
export function fofTest(o: { perMetre: number; cover?: number; wounds?: number }): { dice: number; tn: number } {
  return { dice: int(o.perMetre, 0, 999), tn: Math.max(RULES.MIN_TARGET_NUMBER, num(V().fofTn) + Math.max(0, num(o.cover)) + Math.max(0, num(o.wounds))) };
}

/** Rounds that hit: one per `fofPerHit` successes, at most the rounds on that metre. */
export function fofHits(successes: number, perMetre: number): number {
  return Math.min(int(perMetre, 0, 999), Math.floor(int(successes, 0, 999) / Math.max(1, int(V().fofPerHit, 1, 99))));
}

/**
 * Whether a bearing lies in the arc swept walking fire from one target to the next (the shorter way round), widened
 * by `margin` on both sides. Bearings in radians.
 */
export function inSweep(from: number, to: number, bearing: number, margin = 0): boolean {
  const norm = (x: number): number => { let v = x % (2 * Math.PI); if (v > Math.PI) v -= 2 * Math.PI; if (v <= -Math.PI) v += 2 * Math.PI; return v; };
  const span = norm(num(to) - num(from)), off = norm(num(bearing) - num(from));
  const m = Math.max(0, num(margin));
  return span >= 0 ? off >= -m && off <= span + m : off <= m && off >= span - m;
}
