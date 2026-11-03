import { test, describe } from 'node:test';
import { oldWay } from './oldway.ts';
import assert from 'node:assert/strict';
import { armorTotal, carriedLoad, muzzleCheck, tracerModifier, barrierDamage, chargePower, throwBackScatter } from '../gear.ts';
import { RULES } from '../config.ts';

describe('gear and combat leftovers (v0.37.0)', () => {
  test('armor layering', () => {
    const jacket = { ballistic: 5, impact: 3 }, vest = { ballistic: 4, impact: 1 }, helmet = { ballistic: 1, impact: 1, adds: true };
    assert.equal(armorTotal([jacket, vest, helmet], 'ballistic'), 6);           // best 5 + helmet 1
    assert.equal(armorTotal([{ ...jacket, degraded: 2 }, vest], 'ballistic'), 4); // degraded jacket 3 < vest 4
    (RULES.COMBAT as any).armorLayering = 'sum';
    try { assert.equal(armorTotal([jacket, vest, helmet], 'ballistic'), 10); } finally { (RULES.COMBAT as any).armorLayering = 'highest'; }
    (RULES.COMBAT as any).armorLayering = 'highestPlusHalf';
    try { assert.equal(armorTotal([jacket, vest, helmet], 'ballistic'), 8); } finally { (RULES.COMBAT as any).armorLayering = 'highest'; }
  });
  test('load, muzzle devices, tracers', () => {
    assert.deepEqual(carriedLoad(30, 4), { kg: 30, limit: 40, penalty: 0 });
    assert.deepEqual(carriedLoad(61, 4), { kg: 61, limit: 40, penalty: 2 });      // 21 over, steps of 20
    assert.equal(muzzleCheck('silencer', 'BF').ok, false);
    assert.deepEqual(muzzleCheck('silencer', 'SA'), { ok: true, perceptionTn: 4, reason: '' });
    assert.equal(muzzleCheck('suppressor', 'FA').ok, true);
    assert.equal(tracerModifier({ ammo: 'tracer', mode: 'BF', earlierRounds: 3 }), -1);
    assert.equal(tracerModifier({ ammo: 'tracer', mode: 'FA', earlierRounds: 30 }), -3);
    assert.equal(tracerModifier({ ammo: 'standard', mode: 'BF', earlierRounds: 6 }), 0);
  });
  test('barriers, charges, throwing back', (t) => {
    t.after(oldWay({"BOOK_V78.barriers.mode": "subtract"})); // v0.78.0: the old rule (a house rule)
    assert.deepEqual(barrierDamage({ rating: 8, power: 10 }), { damage: 2, left: 6, breached: false, holes: 0, adjusted: 8 });
    assert.deepEqual(barrierDamage({ rating: 8, power: 8, shaped: true }), { damage: 8, left: 0, breached: true, holes: 0, adjusted: 8 });
    assert.equal(barrierDamage({ rating: 8, power: 6 }).damage, 0);
    assert.equal(chargePower(10, 3), 13);
    assert.equal(throwBackScatter(4, 2), 2);
    assert.equal(throwBackScatter(2, 5), 0);
  });
});
