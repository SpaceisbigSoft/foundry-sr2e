/**
 * v0.80.0: the "SR2E Unified Rules Revamp" rules source, a layer between the shipped RULES and the house rules.
 */
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';

const g = globalThis as any;
let mod: any;
let R: any;

before(async () => {
  g.foundry ??= { applications: { api: { ApplicationV2: class {} } } };
  mod = await import('../settings.ts');
  R = await import('../rules/index.ts');
});

describe('v0.80.0 rules source', () => {
  test('every patched path is a rule, with a value of the same kind as the book value', () => {
    for (const [path, v] of Object.entries(R.URR_V80_PATCH)) {
      const def = mod.getPath(mod.RULE_DEFAULTS, path);
      assert.notEqual(def, undefined, `${path} is not a rule`);
      assert.equal(Array.isArray(v), Array.isArray(def), `${path}: array vs not`);
      assert.equal(typeof v, typeof def, `${path}: ${typeof v} vs ${typeof def}`);
    }
  });

  test('no two areas patch the same path', () => {
    const seen = new Map<string, string>();
    for (const [area, patch] of Object.entries(R.URR80_PATCHES as Record<string, Record<string, unknown>>)) {
      for (const path of Object.keys(patch)) {
        assert.ok(!seen.has(path), `${path} is patched by ${seen.get(path)} and ${area}`);
        seen.set(path, area);
      }
    }
  });

  test('book is the default; the Revamp layers under the house rules, which still win', () => {
    assert.equal(mod.currentRulesSource(), 'book');
    assert.equal(R.RULES.URR_V80.active, false);
    try {
      mod.setRulesSource('urr');
      assert.deepEqual(mod.applyHouseRules({}), []);
      assert.equal(R.RULES.URR_V80.active, true);
      for (const [path, v] of Object.entries(R.URR_V80_PATCH)) assert.deepEqual(mod.getPath(R.RULES, path), v, path);
      // a house value over a patched path wins; one equal to the book value is still a change under the Revamp
      const [path, v] = Object.entries(R.URR_V80_PATCH).find(([, x]) => typeof x === 'number' || typeof x === 'string' || typeof x === 'boolean') ?? ['URR_V80.active', true];
      const book = mod.getPath(mod.RULE_DEFAULTS, path);
      if (book !== v) {
        mod.applyHouseRules({ values: { [path]: book } });
        assert.deepEqual(mod.getPath(R.RULES, path), book);
      }
      mod.applyHouseRules({});
      assert.deepEqual(mod.changedRules(), [], 'the Revamp itself is not a house-rule change');
      assert.equal(mod.baseRule('URR_V80.active'), true);
    } finally {
      mod.setRulesSource('book');
      mod.applyHouseRules({});
    }
    assert.equal(R.RULES.URR_V80.active, false);
    for (const [path] of Object.entries(R.URR_V80_PATCH)) assert.deepEqual(mod.getPath(R.RULES, path), mod.getPath(mod.RULE_DEFAULTS, path), path);
  });

  test('review #1: a house value the GM did not touch survives a save under the other source', () => {
    // stored under the book: an override that equals the Revamp's value; saved again under the Revamp, untouched
    const [path, urrV] = Object.entries(R.URR_V80_PATCH).find(([p, v]) => p !== 'URR_V80.active' && typeof v !== 'object') as [string, unknown];
    const book = mod.getPath(mod.RULE_DEFAULTS, path);
    assert.equal(mod.keepHouseValue(path, urrV, { [path]: urrV }, 'urr'), true, 'untouched: kept');
    assert.equal(mod.keepHouseValue(path, urrV, {}, 'urr'), false, 'the Revamp value itself is not stored');
    assert.equal(mod.keepHouseValue(path, book, {}, 'urr'), true, 'the book value under the Revamp is an override');
    assert.equal(mod.keepHouseValue(path, book, { [path]: urrV }, 'book'), false, 'changed back to the base: dropped');
    assert.equal(mod.keepHouseValue(path, book, { [path]: book }, 'book'), true);
  });

  test("an unknown source falls back to the book (inherited names too)", () => {
    assert.equal(mod.setRulesSource('toString'), 'book');
    assert.equal(mod.setRulesSource('constructor'), 'book');
    assert.equal(mod.setRulesSource('nope'), 'book');
    assert.equal(mod.setRulesSource('urr'), 'urr');
    mod.setRulesSource('book');
  });

  test('the patch does not alias the shipped tables (objects are copied)', () => {
    try {
      mod.setRulesSource('urr');
      mod.applyHouseRules({});
      for (const [path, v] of Object.entries(R.URR_V80_PATCH)) if (v && typeof v === 'object') assert.notEqual(mod.getPath(R.RULES, path), v, path);
    } finally { mod.setRulesSource('book'); mod.applyHouseRules({}); }
  });
});
