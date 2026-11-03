import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// A field rendered twice in one actor sheet's form submits as an array and fails validation,
// so every change on that sheet is refused.
test('actor sheets have no duplicate system.* inputs', () => {
  const dir = join(process.cwd(), 'public', 'templates');
  for (const f of readdirSync(dir).filter((f) => f.startsWith('actor-') && f.endsWith('.hbs'))) {
    const s = readFileSync(join(dir, f), 'utf8');
    const seen = new Map<string, number>();
    for (const m of s.matchAll(/name="(system\.[^"{]+)"/g)) { const k = m[1] as string; seen.set(k, (seen.get(k) ?? 0) + 1); }
    const dup = [...seen].filter(([, n]) => n > 1).map(([k]) => k);
    assert.deepEqual(dup, [], `${f} repeats ${dup.join(', ')}`);
  }
});
