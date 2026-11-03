import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { RULES, vehicleIncomingDamage, spiritStatus, incapacitated, conditionStatuses, actionCost } from '../index.ts';

describe('v0.59.0 rules-side integration fixes', () => {
  test('Stun damage does nothing to a vehicle (a crash still hurts)', () => {
    const gel = vehicleIncomingDamage({ power: 10, level: 'S', armor: 0, antiVehicle: true, damageType: 'stun' });
    assert.equal(gel.level, null);
    assert.equal(gel.stopped, true);
    assert.match(gel.notes.join(' '), /Stun/);
    const crash = vehicleIncomingDamage({ power: 6, level: 'M', armor: 0, crash: true, damageType: 'stun' });
    assert.equal(crash.level, 'M');
    const phys = vehicleIncomingDamage({ power: 12, level: 'D', armor: 6, antiVehicle: true, damageType: 'physical' });
    assert.equal(phys.level, 'D');
  });

  test('spirits are disrupted, not dying or unconscious', () => {
    const full = RULES.MONITOR_BOXES;
    assert.equal(spiritStatus({ physical: full, stun: 0 }, 'dying'), 'disrupted');
    assert.equal(spiritStatus({ physical: full + 3, stun: 0 }, 'dead'), 'disrupted');
    assert.equal(spiritStatus({ physical: 0, stun: full }, 'unconscious'), 'disrupted');
    assert.equal(spiritStatus({ physical: 3, stun: 2 }, 'ok'), 'ok');
    assert.equal(spiritStatus({ physical: full, stun: 0 }, 'banished'), 'banished');
    const was = RULES.SPIRITS_V59.disruptOn;
    (RULES.SPIRITS_V59 as any).disruptOn = 'physical';
    try { assert.equal(spiritStatus({ physical: 0, stun: full }, 'ok'), 'unconscious'); } finally { (RULES.SPIRITS_V59 as any).disruptOn = was; }
    assert.equal(incapacitated('disrupted'), true);
    assert.equal(incapacitated('banished'), true);
    assert.deepEqual(conditionStatuses('disrupted'), { unconscious: false, bleeding: false, dead: true });
  });

  test('jacking in or out, taking controls, jumping in or out, sensor tests and drone commands cost an action', () => {
    for (const k of ['jackIn', 'jackOut', 'takeControls', 'jumpIn', 'jumpOut', 'sensor']) assert.equal(actionCost(k), 'simple', k);
    assert.equal(actionCost('droneCommand'), 'complex'); // v0.77.0 book check
    assert.equal(RULES.COMBAT_TURN_SECONDS, 3);
    assert.equal(RULES.ADEPT.killingHands.magical, true);
  });
});
