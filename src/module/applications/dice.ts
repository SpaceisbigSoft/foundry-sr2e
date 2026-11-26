/** Dice So Nice colours (v0.41.0); no other imports, so the documents can use it without a cycle. */
import { SYSTEM } from '../config/system.ts';

/** Dice So Nice: the SR2e colour sets (base dice, and Rule of Six re-rolls in gold). */
export const DSN_COLORSETS = [
  { name: 'sr2e-base', description: 'SR2e: dice', category: 'SR2e', foreground: '#ffffff', background: '#1f3b57', outline: '#000000', edge: '#0f1f2e', texture: 'none', material: 'plastic' },
  { name: 'sr2e-six', description: 'SR2e: Rule of Six re-rolls', category: 'SR2e', foreground: '#1a1a1a', background: '#e6a800', outline: '#000000', edge: '#a87b00', texture: 'none', material: 'metal' },
  // v0.93.3 (report item 38): pool dice in their own colours, and Karma Pool dice.
  { name: 'sr2e-pool-combat', description: 'SR2e: Combat Pool dice', category: 'SR2e', foreground: '#ffffff', background: '#8b1e1e', outline: '#000000', edge: '#4d0f0f', texture: 'none', material: 'plastic' },
  { name: 'sr2e-pool-spell', description: 'SR2e: Spell Pool dice', category: 'SR2e', foreground: '#ffffff', background: '#5b2a86', outline: '#000000', edge: '#33174d', texture: 'none', material: 'plastic' },
  { name: 'sr2e-pool-hacking', description: 'SR2e: Hacking Pool dice', category: 'SR2e', foreground: '#ffffff', background: '#1d6b3a', outline: '#000000', edge: '#0f3d20', texture: 'none', material: 'plastic' },
  { name: 'sr2e-pool-control', description: 'SR2e: Control Pool dice', category: 'SR2e', foreground: '#1a1a1a', background: '#e07b00', outline: '#000000', edge: '#8a4b00', texture: 'none', material: 'plastic' },
  { name: 'sr2e-pool-task', description: 'SR2e: Task Pool dice', category: 'SR2e', foreground: '#ffffff', background: '#4a5560', outline: '#000000', edge: '#2a3037', texture: 'none', material: 'plastic' },
  { name: 'sr2e-karma', description: 'SR2e: Karma Pool dice', category: 'SR2e', foreground: '#ffffff', background: '#0e7c86', outline: '#000000', edge: '#07444a', texture: 'none', material: 'glass' },
];

/** v0.93.3: the pools with a colour set of their own (others, and an NPC's Threat dice, use the Combat Pool's). */
export const POOL_COLOURED = ['combat', 'spell', 'hacking', 'control', 'task'] as const;

/** v0.93.3: the colour set for a pool's dice. */
export function dsnPoolColorset(pool: string): string {
  return (POOL_COLOURED as readonly string[]).includes(pool) ? `sr2e-pool-${pool}` : 'sr2e-pool-combat';
}

/**
 * v0.93.3: a test's first wave split into coloured groups (base, Karma, pool, threat), dropping empty ones. Rule of Six
 * re-rolls stay one gold wave. Pure.
 */
export function dsnFirstWave(o: { base: number; karma: number; pool: number; threat: number; poolKind: string }): Array<{ n: number; colorset: string }> {
  return [
    { n: o.base, colorset: 'sr2e-base' },
    { n: o.karma, colorset: 'sr2e-karma' },
    { n: o.pool, colorset: dsnPoolColorset(o.poolKind) },
    { n: o.threat, colorset: 'sr2e-pool-combat' },
  ].map((g) => ({ ...g, n: Math.max(0, Math.floor(g.n)) })).filter((g) => g.n > 0);
}

/** Whether Dice So Nice is active and the SR2e colours are wanted. */
export function dsnColoursOn(): boolean {
  try {
    return Boolean((game as any).modules?.get?.('dice-so-nice')?.active) && Boolean(game.settings.get(SYSTEM.id, 'dsnColours'));
  } catch { return false; }
}

/** The colour set for a wave of dice in one test: the first wave, or a Rule of Six re-roll. */
export function dsnColorsetFor(wave: number): string {
  return wave > 0 ? 'sr2e-six' : 'sr2e-base';
}

