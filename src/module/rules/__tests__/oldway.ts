/**
 * v0.78.0: run a test under the old rules (a house rule put back): set RULES paths, and get a function that puts
 * the shipped values back. Use as `test('…', (t) => { t.after(oldWay({ 'BOOK_V78.legwork.mode': 'tn' })); … })`.
 */
import { RULES } from '../config.ts';

export function oldWay(patch: Record<string, unknown>): () => void {
  const saved: Array<[any, string, unknown]> = [];
  for (const [path, value] of Object.entries(patch)) {
    const keys = path.split('.');
    let o: any = RULES;
    for (const k of keys.slice(0, -1)) o = o[k];
    const last = keys[keys.length - 1]!;
    if (!(last in o)) throw new Error(`oldWay: no rule ${path}`);
    saved.push([o, last, o[last]]);
    o[last] = value;
  }
  return () => { for (const [o, k, v] of saved.reverse()) o[k] = v; };
}
