/**
 * v0.81.0 fixRA: regression tests for the RA review fixes (RV/RA.md RA-1 … RA-16). Each test failed before its fix.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { RULES } from '../config.ts';
import { skillGearBonus } from '../kit.ts';
import { tracerModifier, carriedLoad } from '../gear.ts';
import { activeManeuvers, maneuverEntry, loadingDue, loadingDone, type Maneuver } from '../datawar.ts';
import { traceDue, traceComplete, smokeCloud, smokeActive } from '../matrix.ts';
import { effectEnds, effectEnded, careCost } from '../hazards.ts';
import { doseDrug, overdoseTest, type ActiveDrug } from '../vitals.ts';
import { generateSheaf, SHEAF_GEN } from '../sheafgen.ts';
import { bioEffect } from '../bioware.ts';
import { attributeMaximums, checkAttributeLimits } from '../core.ts';
import { localDateKey } from '../flow.ts';
import { indirectFire } from '../fieldsfire.ts';
import { weaponArmorKind } from '../tactics.ts';
import { bearingDiff, sameCombatRound } from '../util.ts';
import { recoveryCareCost } from '../afflictions.ts';
import { inArc } from '../netrig.ts';

const R = RULES as any;
/** Set a RULES value for the length of `fn`. */
function withRule(obj: any, key: string, value: unknown, fn: () => void): void {
  const old = obj[key];
  obj[key] = value;
  try { fn(); } finally { obj[key] = old; }
}

describe('RA-1: skill gear in best mode keeps penalties', () => {
  test('a TN penalty from one item is not hidden by a TN bonus from another', () => {
    const coat = { name: 'Bulky coat', mods: [{ skill: 'Stealth', tn: 2 }] };
    const suit = { name: 'Chameleon', mods: [{ skill: 'Stealth', tn: -1 }] };
    const r = skillGearBonus([coat, suit], { name: 'Stealth' });
    assert.deepEqual(r.modifiers, [{ label: 'Chameleon', value: -1 }, { label: 'Bulky coat', value: 2 }]);
    assert.deepEqual(r.names.sort(), ['Bulky coat', 'Chameleon']);
  });
  test('a dice penalty adds to the best dice bonus', () => {
    const pack = { name: 'Heavy pack', mods: [{ skill: 'Athletics', dice: -2 }] };
    const gear = { name: 'Climbing gear', mods: [{ skill: 'Athletics', dice: 2 }] };
    assert.equal(skillGearBonus([pack, gear], { name: 'Athletics' }).dice, 0);
  });
  test('within one item, a dice-only row does not wipe out a TN penalty row', () => {
    const item = { name: 'Rig', mods: [{ skill: 'Stealth', dice: 1 }, { skill: 'Stealth', tn: 2 }] };
    assert.deepEqual(skillGearBonus([item], { name: 'Stealth' }), { dice: 1, modifiers: [{ label: 'Rig', value: 2 }], names: ['Rig'] });
  });
  test('bonuses still compete: only the best counts', () => {
    const a = { name: 'A', mods: [{ skill: 'Stealth', dice: 1, tn: -1 }] };
    const b = { name: 'B', mods: [{ skill: 'Stealth', dice: 3, tn: -2 }] };
    assert.deepEqual(skillGearBonus([a, b], { name: 'Stealth' }), { dice: 3, modifiers: [{ label: 'B', value: -2 }], names: ['B'] });
  });
});

describe('RA-3: tracers count only whole earlier bursts', () => {
  test('1-2 earlier rounds (a single shot) give nothing', () => {
    assert.equal(tracerModifier({ ammo: 'tracer', mode: 'BF', earlierRounds: 1 }), 0);
    assert.equal(tracerModifier({ ammo: 'tracer', mode: 'FA', earlierRounds: 2 }), 0);
    assert.equal(tracerModifier({ ammo: 'tracer', mode: 'BF', earlierRounds: 3 }), -1);
    assert.equal(tracerModifier({ ammo: 'tracer', mode: 'FA', earlierRounds: 30 }), -3);
  });
  test('a positive house-rule step is capped at the size of maxTn (RA-14)', () => {
    withRule(R.COMBAT.tracer, 'tnPerBurst', 1, () => {
      assert.equal(tracerModifier({ ammo: 'tracer', mode: 'FA', earlierRounds: 30 }), 3);
    });
  });
  test('unrelated gear is unchanged', () => {
    assert.equal(carriedLoad(0, 3).penalty, 0);
  });
});

describe('RA-14: walking indirect fire in, positive house-rule step', () => {
  test('capped at the size of adjustMax either way', () => {
    const cfg = { ...R.COMBAT_V72.indirect, enabled: true, adjustTnPerShot: 1, adjustMax: -3 };
    const plan = indirectFire({ link: 'voice', adjustShots: 10 }, cfg);
    const walk = plan.modifiers.find((m) => /Walking fire/.test(m.label));
    assert.equal(walk?.value, 3);
    const book = indirectFire({ link: 'voice', adjustShots: 10 }, { ...cfg, adjustTnPerShot: -1 });
    assert.equal(book.modifiers.find((m) => /Walking fire/.test(m.label))?.value, -3);
  });
});

describe('RA-4: round timers belong to one combat', () => {
  const A = { round: 5, worldTime: 1000, combatId: 'A' };
  test('a maneuver from combat A is not in force in combat B by round; world time decides', () => {
    const m = maneuverEntry('position', 'ic1', 2, A);
    assert.equal(m.combatId, 'A');
    assert.equal(activeManeuvers([m], { round: 5, worldTime: 1000, combatId: 'A' }).length, 1);
    assert.equal(activeManeuvers([m], { round: 2, worldTime: 99999, combatId: 'B' }).length, 0);
    // Old data without a combat id: world time.
    const old: Maneuver = { kind: 'position', targetUuid: 'ic1', net: 2, round: 5, worldTime: 1003 };
    assert.equal(activeManeuvers([old], { round: 2, worldTime: 99999, combatId: 'B' }).length, 0);
    // A caller that names no combat keeps the old behaviour (rounds compared).
    assert.equal(activeManeuvers([old], { round: 2, worldTime: 99999 }).length, 1);
  });
  test('a trace due at round 5 of combat A does not complete at round 9 of combat B', () => {
    const due = traceDue({ ...A, turns: 3 });
    assert.deepEqual(due, { round: 8, worldTime: 1000 + 3 * RULES.MATRIX.trace.secondsPerTurn, combatId: 'A' });
    assert.equal(traceComplete(due, { round: 9, worldTime: 1001, combatId: 'B' }), false);
    assert.equal(traceComplete(due, { round: 9, worldTime: 1001, combatId: 'A' }), true);
    assert.equal(traceComplete(due, { round: null, worldTime: due.worldTime, combatId: null }), true);
    const c = smokeCloud(4, 'x', A);
    assert.equal(smokeActive(c, { round: 99, worldTime: 1001, combatId: 'B' }), true);
    assert.equal(smokeActive(c, { round: 99, worldTime: 1001, combatId: 'A' }), false);
  });
  test('timed effects and loads compare rounds only in the same combat', () => {
    const e = effectEnds({ ...A, seconds: 30 });
    assert.equal(effectEnded(e, { round: 50, worldTime: 1001, combatId: 'B' }), false);
    assert.equal(effectEnded(e, { round: 50, worldTime: 1001, combatId: 'A' }), true);
    const l = loadingDue(A, 2);
    assert.equal(loadingDone(l, { round: 50, worldTime: 1001, combatId: 'B' }), false);
    assert.equal(loadingDone(l, { round: 50, worldTime: 1001, combatId: 'A' }), true);
    assert.equal(loadingDone(l, { round: 1, worldTime: l.worldTime, combatId: 'B' }), true);
  });
  test('no combat: no combat id stamped, same output as before', () => {
    assert.deepEqual(effectEnds({ round: null, worldTime: 0, seconds: 30 }), { round: -1, worldTime: 30 });
    assert.equal(sameCombatRound({ round: 5 }, { round: 5, combatId: '' }), false);
  });
  test('extending a drug dose: a round from another combat is not reused', () => {
    const H = R.HEALTH_V72.drugs;
    withRule(H, 'doses', 'extend', () => {
      const d = (over: Partial<ActiveDrug>): ActiveDrug => ({ name: 'Jazz', round: -1, worldTime: 600, ...over });
      // First dose in combat A, ending at its round 40; second dose in combat B at round 3, 300 s before it wears off.
      const r = doseDrug([d({ round: 40, worldTime: 600, combatId: 'A' })], d({ round: 13, worldTime: 330, combatId: 'B' }), { seconds: 30, now: 300, round: 3, combatId: 'B' });
      const turns = Math.ceil(30 / RULES.TOXINS.secondsPerTurn);
      const left = Math.ceil(300 / RULES.TOXINS.secondsPerTurn);
      assert.equal(r.list[0]!.round, 3 + left + turns);
      assert.equal(r.list[0]!.combatId, 'B');
      // Same combat: the first dose's round counts (as before).
      const s = doseDrug([d({ round: 40, worldTime: 600, combatId: 'B' })], d({ round: 13, worldTime: 330, combatId: 'B' }), { seconds: 30, now: 300, round: 3, combatId: 'B' });
      assert.equal(s.list[0]!.round, 40 + turns);
    });
  });
});

describe('RA-5: generated sheaf spacing', () => {
  test('the shutdown is exactly afterActive trigger steps after the active alert (or at maxTriggers)', () => {
    for (const code of ['orange', 'red', 'black'] as const) for (let s = 1; s <= 30; s++) {
      const sheaf = generateSheaf({ securityCode: code, securityValue: 6, seed: s });
      const passive = sheaf.findIndex((x) => x.alert === 'passive');
      const active = sheaf.findIndex((x) => x.alert === 'active');
      const shut = sheaf.findIndex((x) => x.alert === 'shutdown');
      assert.ok(passive >= 0 && active > passive && shut > active, `${code}/${s}`);
      assert.ok(passive + 1 <= SHEAF_GEN.passiveBy, `${code}/${s} passive by`);
      assert.ok(active - passive <= SHEAF_GEN.activeAfter, `${code}/${s} active after`);
      const gap = shut - active;
      if (shut === SHEAF_GEN.maxTriggers - 1) assert.ok(gap <= SHEAF_GEN.afterActive[code], `${code}/${s} gap ${gap}`);
      else assert.equal(gap, SHEAF_GEN.afterActive[code], `${code}/${s}`);
    }
  });
});

describe('RA-7: bioEffect perRating means the same for every field', () => {
  const kinds = R.BIOWARE.effects;
  test('perRating false: Reaction and initiative dice do not scale', () => {
    withRule(kinds, 'testFlat', { reaction: 1, initiativeDice: 1, ballistic: 1, perRating: false }, () => {
      const e = bioEffect({ name: 'x', bioKind: 'testFlat', rating: 3, installed: true });
      assert.equal(e.reaction, 1);
      assert.equal(e.initiativeDice, 1);
      assert.equal(e.ballistic, 1);
    });
  });
  test('no flag: boxesOff scales like everything else', () => {
    withRule(kinds, 'testScaled', { boxesOff: 1 }, () => {
      assert.equal(bioEffect({ name: 'x', bioKind: 'testScaled', rating: 3, installed: true }).boxesOff, 3);
    });
  });
  test('shipped kinds unchanged', () => {
    assert.equal(bioEffect({ name: 'p', bioKind: 'plateletFactory', rating: 3, installed: true }).boxesOff, 1);
    assert.equal(bioEffect({ name: 'm', bioKind: 'muscleAugmentation', rating: 2, installed: true }).attributes.strength, 2);
    assert.equal(bioEffect({ name: 'o', bioKind: 'orthoskin', rating: 3, installed: true }).ballistic, 1);
  });
});

describe('RA-10: shared helpers', () => {
  test('attribute limits take a natural bonus (Exceptional Attribute)', () => {
    const base = attributeMaximums('human', 'body');
    assert.equal(attributeMaximums('human', 'body', 1).natural, base.natural + 1);
    const v = { body: { natural: base.natural + 1, total: base.natural + 1 } };
    assert.equal(checkAttributeLimits('human', v).warnings.length, 1);
    assert.equal(checkAttributeLimits('human', v, { body: 1 }).warnings.length, 0);
  });
  test('careCost is recoveryCareCost per started day', () => {
    assert.equal(careCost('hospital', 25), recoveryCareCost('hospital', 2));
    assert.equal(careCost('hospital', 0), recoveryCareCost('hospital', 1));
  });
  test('the session date is the local date', () => {
    assert.equal(localDateKey(new Date(2026, 0, 2, 23, 59)), '2026-01-02');
  });
  test('bearings', () => {
    assert.equal(bearingDiff(350, 10), 20);
    assert.equal(bearingDiff(10, 190), 180);
    assert.equal(inArc('', 0, 0).inside, true);
  });
});

describe('RA-11: vitals reads RULES.HEALTH_V72 at call time', () => {
  test('a replaced block is seen', () => {
    const old = R.HEALTH_V72;
    R.HEALTH_V72 = structuredClone(old);
    R.HEALTH_V72.drugs.overdose.enabled = false;
    try {
      assert.equal(overdoseTest({ name: 'Jazz', power: 5 }, 1), null);
    } finally { R.HEALTH_V72 = old; }
    assert.ok(overdoseTest({ name: 'Jazz', power: 5 }, 1));
  });
});

describe('RA-16: bow armour only for bows', () => {
  test('Elbow and Rainbow are not bows; crossbows and longbows are', () => {
    withRule(R.COMBAT.armorFor, 'bow', 'impact', () => {
      assert.equal(weaponArmorKind({ name: 'Rainbow Laser' }), 'ballistic');
      assert.equal(weaponArmorKind({ name: 'Elbow gun' }), 'ballistic');
      assert.equal(weaponArmorKind({ name: 'Ares crossbow' }), 'impact');
      assert.equal(weaponArmorKind({ name: 'Longbow' }), 'impact');
      assert.equal(weaponArmorKind({ skill: 'Bows' }), 'impact');
    });
  });
});
