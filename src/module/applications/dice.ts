/** Dice So Nice colours (v0.41.0); no other imports, so the documents can use it without a cycle. */
import { SYSTEM } from '../config/system.ts';

/** Dice So Nice: the SR2e colour sets (base dice, and Rule of Six re-rolls in gold). */
export const DSN_COLORSETS = [
  { name: 'sr2e-base', description: 'SR2e: dice', category: 'SR2e', foreground: '#ffffff', background: '#1f3b57', outline: '#000000', edge: '#0f1f2e', texture: 'none', material: 'plastic' },
  { name: 'sr2e-six', description: 'SR2e: Rule of Six re-rolls', category: 'SR2e', foreground: '#1a1a1a', background: '#e6a800', outline: '#000000', edge: '#a87b00', texture: 'none', material: 'metal' },
];

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

