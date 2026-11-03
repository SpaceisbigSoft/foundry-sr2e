/**
 * v0.89.5: `node:assert/strict` for the rules tests written before modifier rows carried ids. Since v0.89.5 every
 * fixed-text modifier row has an `id` (rules/dice.ts modKey). `deepEqual` / `deepStrictEqual` here drop a row's `id`
 * from the actual value only where the expected row doesn't name one, so the older expectations keep checking labels
 * and values, and a test that names an id still checks it.
 */
import strict from 'node:assert/strict';

const isRow = (o: any) => o && typeof o === 'object' && !Array.isArray(o) && typeof o.label === 'string' && 'value' in o;

const plain = (o: any) => o && typeof o === 'object' && (Object.getPrototypeOf(o) === Object.prototype || Object.getPrototypeOf(o) === null);

export function alignRowIds(actual: any, expected: any, seen: WeakSet<object> = new WeakSet()): any {
  if (actual && typeof actual === 'object') { if (seen.has(actual)) return actual; seen.add(actual); }
  if (Array.isArray(actual) && Array.isArray(expected)) return actual.map((a, i) => alignRowIds(a, expected[i], seen));
  if (plain(actual) && plain(expected)) {
    const out: any = {};
    for (const [k, v] of Object.entries(actual)) {
      if (k === 'id' && isRow(actual) && !Object.hasOwn(expected, 'id')) continue;
      out[k] = Object.hasOwn(expected, k) ? alignRowIds(v, expected[k], seen) : v;
    }
    return out;
  }
  return actual;
}

const assert: typeof strict = Object.assign(
  ((value: unknown, message?: string | Error) => strict(value, message)) as typeof strict,
  strict,
  {
    deepEqual: (a: unknown, e: unknown, m?: string | Error) => strict.deepEqual(alignRowIds(a, e), e, m),
    deepStrictEqual: (a: unknown, e: unknown, m?: string | Error) => strict.deepStrictEqual(alignRowIds(a, e), e, m),
  },
);
export default assert;
