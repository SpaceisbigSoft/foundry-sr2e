/**
 * v0.80.0: run a test under the "SR2E Unified Rules Revamp" rules source: lay the whole URR_V80_PATCH over RULES
 * (plus any extra paths), and get a function that puts the values back. Use as
 * `test('…', (t) => { t.after(urrMode()); … })` or `t.after(urrMode({ 'URR_V80.someSwitch': 'book' }))`.
 */
import { URR_V80_PATCH } from '../config80.ts';
import { oldWay } from './oldway.ts';

export function urrMode(extra: Record<string, unknown> = {}): () => void {
  const patch: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(URR_V80_PATCH)) patch[k] = structuredClone(v);
  return oldWay({ ...patch, ...extra });
}
