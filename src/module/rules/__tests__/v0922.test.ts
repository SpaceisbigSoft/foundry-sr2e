/**
 * v0.92.2 (release testing): the accessory reader's ratings in the phrasings the in-Foundry tests found it missing.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readAccessories } from '../accessories.ts';

const read = (d: string) => Object.fromEntries(readAccessories(d).filter((h) => h.field).map((h) => [h.field, h.value]));

describe('v0.92.2 accessory ratings', () => {
  test('gas vents: plural, bracketed, "rating", after a comma', () => {
    assert.deepEqual(read('gas vents (2)'), { recoilComp: 2 });
    assert.deepEqual(read('Gas vents 3'), { recoilComp: 3 });
    assert.deepEqual(read('Gas vent (rating 3)'), { recoilComp: 3 });
    assert.deepEqual(read('gas vent system, rating 2'), { recoilComp: 2 });
    assert.deepEqual(read('Gas vents II'), { recoilComp: 2 });
    assert.deepEqual(read('Gas vent 2'), { recoilComp: 2 });
  });

  test('no rating read from words that only look like one', () => {
    assert.deepEqual(read('gas vent, i.e. a muzzle brake'), {});
    assert.deepEqual(read('gas vent (in the barrel)'), {});
    assert.deepEqual(read('no gas vents'), {});
  });

  test('recoil compensation in brackets', () => {
    assert.deepEqual(read('recoil compensation (3)'), { recoilComp: 3 });
    assert.deepEqual(read('Recoil compensation 2'), { recoilComp: 2 });
  });

  test('a scope\'s bracketed number is its magnification, also after a vision type', () => {
    assert.deepEqual(read('Smartgun link, scope (2)'), { smartgun: true, scope: 2 });
    assert.deepEqual(read('scope (low-light, magnification 2)'), { scopeVision: 'lowLight', scope: 2 });
    assert.deepEqual(read('thermographic scope, 3x'), { scopeVision: 'thermographic', scope: 3 });
    assert.deepEqual(read('low-light scope'), { scopeVision: 'lowLight', scope: 1 });
  });

  test('other accessories next to a rating still read', () => {
    assert.deepEqual(read('Gas vent system 2 and a laser sight'), { recoilComp: 2, laserSight: true });
  });
});

describe('v0.92.2 the HUD leaves out weapons left behind', async () => {
  const { hudActions } = await import('../hudactions.ts');
  const { RULES } = await import('../config.ts');
  const summary = (carried: boolean): any => ({
    type: 'character', name: 'Runner',
    attributes: { body: { total: 4 }, quickness: { total: 5 }, strength: { total: 4 }, charisma: { total: 3 }, intelligence: { total: 4 }, willpower: { total: 4 } },
    derived: { reaction: 4, initiativeDice: 1, magic: 0, essence: 6, astralMode: 'physical' },
    items: [{ id: 'w1', type: 'weapon', name: 'Pistol', system: { ammo: 8, ammoMax: 12, modes: 'SA', damagePower: 9, damageLevel: 'M', carried } }],
    flags: {},
  });
  const weaponIds = (carried: boolean) => hudActions(summary(carried)).filter((a: any) => a.groupId === 'weapons').map((a: any) => a.id);
  test('a carried weapon is offered, one left behind is not (and no reload for it)', () => {
    assert.ok(weaponIds(true).some((id: string) => id.includes('w1')));
    assert.ok(!weaponIds(false).some((id: string) => id.includes('w1')));
    assert.ok(!hudActions(summary(false)).some((a: any) => a.id === 'combat-reload'));
  });
  test('with the Carried house rule off every weapon is offered', () => {
    const S = RULES.SHEET_V921 as any; const prev = S.carried; S.carried = 'off';
    try { assert.ok(weaponIds(false).some((id: string) => id.includes('w1'))); } finally { S.carried = prev; }
  });
});

describe('v0.92.2 the system clock (RULES.CLOCK_V922)', async () => {
  const { cleanClock, systemTime, isBigJump, wholeDays, nextClock, undoesLast, EMPTY_CLOCK } = await import('../clock.ts');
  const DAY = 86400;
  const rules = { bigJump: 'ask' as const, bigJumpDays: 7 };
  test('a big jump is a week or more either way, outside combat, not one the system made', () => {
    assert.equal(isBigJump(7 * DAY, {}, rules), true);
    assert.equal(isBigJump(-7 * DAY, {}, rules), true);
    assert.equal(isBigJump(7 * DAY - 1, {}, rules), false);
    assert.equal(isBigJump(30 * DAY, { inCombat: true }, rules), false);
    assert.equal(isBigJump(30 * DAY, { marked: true }, rules), false);
    assert.equal(isBigJump(30 * DAY, {}, { bigJump: 'count', bigJumpDays: 7 }), false);
  });
  test('only the date: the whole days stay off the system clock, the hours count, the time of day is kept', () => {
    const from = 0; const to = 57 * 365 * DAY + 3600 * 5 + 127;
    const s = nextClock(EMPTY_CLOCK, from, to, 'date');
    assert.equal(s.offset, wholeDays(to - from));
    assert.equal(s.offset % DAY, 0);
    assert.equal(systemTime(to, s), 3600 * 5 + 127, 'the part day counted');
    assert.equal(systemTime(to, s) % DAY, to % DAY, 'same time of day');
  });
  test('counting it changes nothing; the same jump back takes the days off again', () => {
    assert.deepEqual(nextClock(EMPTY_CLOCK, 0, 30 * DAY, 'count'), { offset: 0, last: null });
    const s = nextClock(EMPTY_CLOCK, 100, 100 + 30 * DAY, 'date');
    assert.equal(undoesLast(s, 100 + 30 * DAY, 100), true);
    assert.deepEqual(nextClock(s, 100 + 30 * DAY, 100, 'count'), { offset: 0, last: null });
    const s2 = nextClock(s, 100 + 30 * DAY, 100 + 60 * DAY, 'date');
    assert.equal(s2.offset, 60 * DAY);
  });
  test('a stored state is cleaned (whole days, a bad value reads as none)', () => {
    assert.deepEqual(cleanClock(null), { offset: 0, last: null });
    assert.deepEqual(cleanClock({ offset: 'x' }), { offset: 0, last: null });
    assert.equal(cleanClock({ offset: DAY * 3 + 5 }).offset, DAY * 3);
    assert.equal(cleanClock({ offset: DAY, last: { from: 1, to: 'a', add: 2 } }).last, null);
  });
});

describe('v0.92.2 review: no ratings from ordinary prose', () => {
  test('a bracket that is not a rating reads none', () => {
    for (const d of ['gas vent (i.e. a brake)', "gas vent (I'm told)", 'gas vent (I think)', 'gas vents (V-shaped)', 'gas vent (v.2 model)'])
      assert.deepEqual(read(d), {}, d);
    assert.deepEqual(read('gas vents (iii)'), { recoilComp: 3 });
  });
  test('only a number right after a vision scope is its magnification', () => {
    assert.deepEqual(read('low-light scope and 2 x spare clips'), { scopeVision: 'lowLight', scope: 1 });
    assert.deepEqual(read('thermographic scope (2)'), { scopeVision: 'thermographic', scope: 2 });
    assert.deepEqual(read('thermographic scope, 3x'), { scopeVision: 'thermographic', scope: 3 });
  });
});
