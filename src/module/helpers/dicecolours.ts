/**
 * Dice colours on cards: a body class the stylesheet keys on (`sr2e-dice-<value>`). v0.81.0 (A-14): one copy, used
 * by the client setting's onChange (settings.ts) and on ready (applications/ui.ts re-exports it).
 */
import { SYSTEM } from '../config/system.ts';

export function applyDiceColours(value?: string): void {
  let v = value;
  if (!v) { try { v = String(game.settings.get(SYSTEM.id, 'diceColours') ?? 'default'); } catch { v = 'default'; } }
  const body = (globalThis as any).document?.body;
  if (!body) return;
  for (const c of Array.from(body.classList as Iterable<string>)) if (c.startsWith('sr2e-dice-')) body.classList.remove(c);
  body.classList.add(`sr2e-dice-${v}`);
}
