/**
 * v0.79.0 (drones_magic): the verified fixes' pure rules for rigging and sorcery (RULES.DOCS_V79; notes in
 * config79-drones-magic.ts). Each reads its switch; the second choice gives the old behaviour.
 */
import { RULES } from './config.ts';
import { spellPool as attributeSpellPool } from './stats.ts';

const D = () => RULES.DOCS_V79;
const whole = (n: unknown) => Math.max(0, Math.floor(Number(n) || 0));

// ---------------------------------------------------------------- Rigger dump shock

export interface DumpShock {
  /** The resisting attribute: Body (ordinary damage resistance) or Willpower (old). */
  attribute: 'body' | 'willpower';
  /** TN (= the Power under 'rcd'). */
  tn: number;
  level: 'L' | 'M' | 'S' | 'D';
  type: 'stun' | 'physical';
}

/**
 * The dump shock a rigger resists (Rigger 2 p64): (RCD rating + 4)S Stun, ordinary resistance (Body vs the
 * Power). `rcdRating` 0 (no deck: jumped in aboard, or no deck found) keeps the old RULES.RIGGING.dumpShock,
 * as does the 'willpower' switch.
 */
export function riggerDumpShock(o: { rcdRating?: number } = {}): DumpShock {
  const s = D().riggerDumpShock;
  const old = RULES.RIGGING.dumpShock;
  const rcd = whole(o.rcdRating);
  if (s.mode !== 'rcd' || rcd <= 0) return { attribute: 'willpower', tn: old.tn, level: old.level, type: old.type };
  return { attribute: s.attribute, tn: rcd + s.rcdPlus, level: s.level, type: s.type };
}

// ---------------------------------------------------------------- Flux (signal) rating and range

export type FluxDevice = 'rcd' | 'sensor' | 'ecm' | 'cyberware' | 'other';

/**
 * A device's base flux (Rigger 2 flux rating table): remote control deck 2, sensors and ECM rating × 1.5
 * (round up), cyberware 0, other transmitters their rating. 'rating' (old): the device's rating.
 */
export function baseFlux(kind: FluxDevice, rating: number): number {
  const s = D().signalFlux;
  const r = whole(rating);
  if (s.base !== 'table') return r;
  if (kind === 'rcd') return s.rcd;
  if (kind === 'sensor' || kind === 'ecm') return Math.ceil(r * s.sensorFactor);
  if (kind === 'cyberware') return s.cyberware;
  return r;
}

/** A remote control deck's flux: its own signal when set (> 0), else its base flux. */
export function rcdFlux(o: { signal?: number; rcdRating?: number }): number {
  const sig = whole(o.signal);
  return sig > 0 ? sig : baseFlux('rcd', whole(o.rcdRating));
}

/**
 * How far a flux (signal) rating reaches, in km (Rigger 2 flux range table): RULES.SIGNAL.rangeKm[flux],
 * and past the table (perFlux × flux) + plusKm (10+: 2 × Flux + 10 km). perFlux and plusKm both 0: the
 * table's last entry (old).
 */
export function fluxRangeKm(rating: number): number {
  const t = RULES.SIGNAL.rangeKm;
  const r = whole(rating);
  if (!t.length) return 0;
  if (r < t.length) return t[r] ?? 0;
  const s = D().signalFlux;
  if (!s.perFlux && !s.plusKm) return t[t.length - 1] ?? 0;
  return s.perFlux * r + s.plusKm;
}

// ---------------------------------------------------------------- Magic (Spell) Pool

/**
 * The Spell (Magic) Pool before a power focus (SR2 p85): the Sorcery skill's rating ('sorcery'), or
 * (Intelligence + Willpower + Magic) ÷ 3 (old, 'attributes'). No Magic (or a physical adept without the
 * house rule, passed as magic 0): none.
 */
export function magicPoolBase(o: { sorcery: number; intelligence: number; willpower: number; magic: number }): number {
  if (!(Number(o.magic) > 0)) return 0;
  if (D().magicPool.size === 'sorcery') return whole(o.sorcery);
  return attributeSpellPool({ intelligence: Number(o.intelligence) || 0, willpower: Number(o.willpower) || 0 }, Number(o.magic) || 0);
}

/** The Sorcery skill's rating among an actor's items (exact name, any case; 0 without one). */
export function sorceryRating(items: Iterable<any> | null | undefined): number {
  let best = 0;
  for (const i of items ?? []) {
    if (i?.type === 'skill' && String(i.name ?? '').trim().toLowerCase() === 'sorcery') best = Math.max(best, whole(i.system?.rating));
  }
  return best;
}

/**
 * Spell Pool dice a caster may put on a spell's success test (SR2 p85): at most the Magic rating ('magic');
 * 'none' (old): what was asked. The dice left in the pool are checked by the test itself.
 */
export function castingPoolDice(asked: number, magic: number): number {
  const n = whole(asked);
  return D().magicPool.castingCap === 'magic' ? Math.min(n, whole(magic)) : n;
}

/** The most Spell Pool dice a casting dialog should offer: the dice left, capped at Magic under 'magic'. */
export function castingPoolMax(left: number, magic: number): number {
  return castingPoolDice(left, magic);
}
