import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { higherAlert, alertAtLeast, siteTally, detectionTargets, detectionOutcome, bypassOutcome, responseDue, hostAlertFor, siteAlertForHost } from '../security.ts';

describe('building security (v0.26.0)', () => {
  test('alerts only rise', () => {
    assert.equal(higherAlert('active', 'passive'), 'active');
    assert.equal(higherAlert('none', 'lockdown'), 'lockdown');
    assert.equal(higherAlert('nonsense', ''), 'none');
    assert.equal(alertAtLeast('active', 'active'), true);
    assert.equal(alertAtLeast('passive', 'active'), false);
  });

  test('the tally crosses steps and raises the alert', () => {
    const steps = [{ step: 3, event: 'Guard checks', alert: 'passive' as const }, { step: 6, event: 'Lockdown', alert: 'lockdown' as const }, { step: 9, event: 'x', alert: '' as const }];
    const r = siteTally({ tally: 2, add: 4, alert: 'none', steps });
    assert.equal(r.tally, 6);
    assert.deepEqual(r.triggered.map((s) => s.step), [3, 6]);
    assert.equal(r.alert, 'lockdown');
    assert.equal(siteTally({ tally: 0, add: 1, alert: 'none', steps, minAlert: 'active' }).alert, 'active');
  });

  test('detection: opposed, net successes go on the tally and raise the alert', () => {
    assert.deepEqual(detectionTargets({ deviceRating: 5, stealthRating: 0 }), { deviceTn: 2, intruderTn: 5 });
    assert.deepEqual(detectionTargets({ deviceRating: 1, stealthRating: 6 }), { deviceTn: 6, intruderTn: 2 });
    assert.deepEqual(detectionOutcome(3, 1), { detected: true, net: 2, tally: 2, minAlert: 'active' });
    assert.deepEqual(detectionOutcome(1, 1), { detected: false, net: 0, tally: 0, minAlert: '' });
  });

  test('bypassing a lock', () => {
    assert.deepEqual(bypassOutcome(1, false), { opened: true, tally: 0, minAlert: '' });
    assert.deepEqual(bypassOutcome(0, false), { opened: false, tally: 2, minAlert: '' });
    assert.deepEqual(bypassOutcome(0, true), { opened: false, tally: 2, minAlert: 'active' });
  });

  test('response time and host alert mapping', () => {
    assert.deepEqual(responseDue({ round: 4, worldTime: 100 }), { round: 7, worldTime: 400, turns: 3, minutes: 5 });
    // v0.71.0 (R6): a site's own response time wins where set.
    assert.deepEqual(responseDue({ round: 4, worldTime: 100, own: { turns: 1, minutes: 20 } }), { round: 5, worldTime: 1300, turns: 1, minutes: 20 });
    assert.deepEqual(responseDue({ round: 4, worldTime: 100, own: { turns: 0, minutes: 0 } }), { round: 7, worldTime: 400, turns: 3, minutes: 5 });
    assert.deepEqual(responseDue({ round: null, worldTime: 0 }), { round: null, worldTime: 300, turns: 3, minutes: 5 });
    // v0.70.0: a lockdown raises a linked host to active, not shutdown (REVIEW-v0.69 B14).
    assert.equal(hostAlertFor('lockdown'), 'active');
    assert.equal(siteAlertForHost('shutdown'), 'none');   // a host shutdown no longer locks the building down
    assert.equal(siteAlertForHost('active'), 'active');
  });
});
