import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { RULES } from '../config.ts';
import { DRONES_V73 } from '../config73/drones.ts';
import {
  droneLinkOf, droneLinkKind, linkEncryption, linkGearOk, droneInterceptTest, droneSpoofTest, spoofOutcome,
  droneLinkUpdate, droneCommandBlock,
  mountPointFor, mountCapacity, mountUsage, mountCheck,
  missileLockOn,
} from '../dronelink.ts';

const V = DRONES_V73 as any;
/** Change one switch for the length of a test (path inside DRONES_V73). */
const withRule = (path: string, value: unknown, fn: () => void) => {
  const keys = path.split('.');
  const last = keys.pop()!;
  const o = keys.reduce((x, k) => x[k], V);
  const old = o[last];
  o[last] = value;
  try { fn(); } finally { o[last] = old; }
};
const total = (t: { baseTn: number; modifiers: Array<{ value: number }> }) => t.baseTn + t.modifiers.reduce((n, m) => n + m.value, 0);

describe('v0.73.0 O28 (5-A9): drone link interception and spoofing', () => {
  test('an old vehicle without the field reads as an open, clean link', () => {
    const l = droneLinkOf({});
    assert.equal(l.encryption, 0);
    assert.equal(l.intercepted.byUuid, '');
    assert.equal(l.spoofed.active, false);
  });

  test('which drones have a remote link', () => {
    assert.equal(droneLinkKind({ controlMode: 'manual', controllerAboard: true, hasController: true }).linked, false);
    assert.equal(droneLinkKind({ controlMode: 'jumped', controllerAboard: true, hasController: true }).linked, false);
    const remote = droneLinkKind({ controlMode: 'jumped', controllerAboard: false, hasController: true });
    assert.deepEqual([remote.linked, remote.remoteJumped], [true, true]);
    const auto = droneLinkKind({ controlMode: 'autopilot', controllerAboard: false, hasController: false });
    assert.deepEqual([auto.linked, auto.remoteJumped], [true, false]);
  });

  test('encryption is the better of the drone and the deck; gear needs', () => {
    assert.equal(linkEncryption({ drone: 2, rcd: 5 }), 5);
    assert.equal(linkEncryption({}), 0);
    assert.equal(linkGearOk('rcd', { radio: 4 }), false);
    assert.equal(linkGearOk('rcdOrRadio', { radio: 4 }), true);
    assert.equal(linkGearOk('none', {}), true);
  });

  test('intercept: the radio rule against the encryption (base 4, raised by encryption above it)', () => {
    const open = droneInterceptTest({ dice: 5, encryption: 0, signal: 6 });
    assert.equal(open.allowed, true);
    assert.equal(open.tn, RULES.STREET_V61.radio.baseInterceptTn);
    const enc = droneInterceptTest({ dice: 5, encryption: 7, signal: 6 });
    assert.equal(enc.tn, 7);
    assert.equal(total(enc), enc.tn);
  });

  test('intercept: signal mode, and ECCM adding when switched on', () => {
    withRule('link.intercept.tnFrom', 'signal', () => {
      const t = droneInterceptTest({ dice: 5, encryption: 2, signal: 6 });
      assert.equal(t.baseTn, 6);
      assert.equal(t.tn, 8);
    });
    withRule('link.intercept.eccmAddsTn', true, () => {
      assert.equal(droneInterceptTest({ dice: 5, encryption: 0, signal: 6, eccm: 2 }).tn, RULES.STREET_V61.radio.baseInterceptTn + 2);
    });
    assert.equal(droneInterceptTest({ dice: 5, encryption: 0, signal: 6, linked: false }).allowed, false);
  });

  test('spoof: needs an intercepted link and a remote link', () => {
    const base = { dice: 6, rcd: 4, pilot: 3, eccm: 0, encryption: 0, linked: true, remoteJumped: false };
    assert.equal(droneSpoofTest({ ...base, intercepted: false }).allowed, false);
    assert.equal(droneSpoofTest({ ...base, intercepted: true, linked: false }).allowed, false);
    const ok = droneSpoofTest({ ...base, intercepted: true });
    assert.equal(ok.allowed, true);
    assert.equal(ok.baseTn, 4);
    assert.equal(ok.tn, 4);
  });

  test('spoof: Pilot when nobody is subscribed, ECCM adds, encryption adds when interception is not needed', () => {
    const t = droneSpoofTest({ dice: 6, rcd: 0, pilot: 3, eccm: 2, encryption: 0, intercepted: true, linked: true, remoteJumped: false });
    assert.equal(t.baseTn, 3);
    assert.equal(t.tn, 5);
    withRule('link.spoof.needsIntercept', false, () => {
      const u = droneSpoofTest({ dice: 6, rcd: 4, pilot: 3, eccm: 0, encryption: 3, intercepted: false, linked: true, remoteJumped: false });
      assert.equal(u.allowed, true);
      assert.equal(u.tn, 7);
    });
  });

  test('spoof: a rigger jumped in by remote: immune, harder or normal', () => {
    const o = { dice: 6, rcd: 4, pilot: 3, intercepted: true, linked: true, remoteJumped: true };
    assert.equal(droneSpoofTest(o).allowed, false);
    withRule('link.spoof.jumpedIn', 'harder', () => assert.equal(droneSpoofTest(o).tn, 4 + V.link.spoof.jumpedInTn));
    withRule('link.spoof.jumpedIn', 'normal', () => assert.equal(droneSpoofTest(o).tn, 4));
  });

  test('spoof outcome: one command by default; takeover pushes a remote rigger out', () => {
    assert.equal(spoofOutcome(0, { remoteJumped: false }).spoofed, false);
    const cmd = spoofOutcome(2, { remoteJumped: true });
    assert.deepEqual([cmd.spoofed, cmd.effect, cmd.pushOut], [true, 'command', false]);
    withRule('link.spoof.effect', 'takeover', () => {
      const t = spoofOutcome(1, { remoteJumped: true });
      assert.deepEqual([t.spoofed, t.effect, t.pushOut], [true, 'takeover', true]);
    });
  });

  test('link updates and the command block', () => {
    assert.deepEqual(droneLinkUpdate('intercept', { uuid: 'A', name: 'Dodger' }), { 'system.link.intercepted': { byUuid: 'A', by: 'Dodger' } });
    assert.deepEqual(droneLinkUpdate('spoof', { uuid: 'A', name: 'Dodger' }), { 'system.link.spoofed': { active: true, byUuid: 'A', by: 'Dodger' } });
    const c = droneLinkUpdate('clear') as any;
    assert.equal(c['system.link.spoofed'].active, false);
    assert.equal(droneCommandBlock({}).blocked, false);
    assert.equal(droneCommandBlock({ jammed: { active: true, by: 'X' } }).blocked, true);
    assert.match(droneCommandBlock({ link: { spoofed: { active: true, by: 'Dodger' } } }).reason, /spoofed by Dodger/);
  });
});

describe('v0.73.0 O28 (5-A10): firmpoints and hardpoints', () => {
  test('which point a weapon takes', () => {
    assert.equal(mountPointFor({ name: 'LMG', mount: 'none' }), 'none');
    assert.equal(mountPointFor({ name: 'Light machine gun', mount: 'fixed' }), 'firm');
    assert.equal(mountPointFor({ name: 'Heavy machine gun', mount: 'turret' }), 'hard');
    assert.equal(mountPointFor({ name: 'Ares HMG', mount: 'fixed' }), 'hard');
    assert.equal(mountPointFor({ name: 'Missile launcher', mount: 'fixed', guidance: 4 }), 'hard');
    assert.equal(mountPointFor({ name: 'Panther', mount: 'fixed', antiVehicle: true }), 'hard');
    assert.equal(mountPointFor({ name: 'Assault cannon', mount: 'fixed', mountPoint: 'firm' }), 'firm');
    // "smg" must not match "mmg"; "mmg" must match as a word only.
    assert.equal(mountPointFor({ name: 'Uzi SMG', mount: 'pintle' }), 'firm');
    withRule('mounts.turretNeedsHard', true, () => assert.equal(mountPointFor({ name: 'SMG', mount: 'turret' }), 'hard'));
  });

  test('capacity: untracked when both are 0; from Body when asked', () => {
    assert.deepEqual(mountCapacity({ body: 4, firmpoints: 0, hardpoints: 0 }), { tracked: false, firm: 0, hard: 0 });
    withRule('mounts.capacityFrom', 'body', () => assert.deepEqual(mountCapacity({ body: 4, firmpoints: 0, hardpoints: 0 }), { tracked: true, firm: 4, hard: 2 }));
    withRule('mounts.capacityFrom', 'body', () => assert.deepEqual(mountCapacity({ body: 4, firmpoints: 1, hardpoints: 0 }), { tracked: true, firm: 1, hard: 2 }));
  });

  test('usage: firmpoint weapons overflow to spare hardpoints', () => {
    const cap = { tracked: true, firm: 1, hard: 1 };
    const u = mountUsage(cap, [{ name: 'SMG', mount: 'fixed' }, { name: 'LMG', mount: 'turret' }]);
    assert.equal(u.over, false);
    assert.equal(u.onSpareHard, 1);
    const v = mountUsage(cap, [{ name: 'SMG', mount: 'fixed' }, { name: 'LMG', mount: 'turret' }, { name: 'HMG', mount: 'fixed' }]);
    assert.equal(v.over, true);
    assert.equal(v.overFirm, 1);
    withRule('mounts.hardTakesFirm', false, () => assert.equal(mountUsage(cap, [{ name: 'SMG', mount: 'fixed' }, { name: 'LMG', mount: 'turret' }]).over, true));
  });

  test('check: warn by default, block when asked, off and untracked as before', () => {
    const o = { body: 4, firmpoints: 1, hardpoints: 0, weapons: [{ name: 'SMG', mount: 'fixed' }], adding: { name: 'Missile launcher', mount: 'fixed', guidance: 4 } };
    const w = mountCheck(o);
    assert.equal(w.ok, false);
    assert.equal(w.refuse, false);
    assert.match(w.note, /hardpoint/);
    withRule('mounts.mode', 'block', () => assert.equal(mountCheck(o).refuse, true));
    withRule('mounts.mode', 'off', () => assert.equal(mountCheck(o).ok, true));
    assert.equal(mountCheck({ ...o, firmpoints: 0 }).ok, true);
    assert.equal(mountCheck({ ...o, adding: { name: 'Missile launcher', mount: 'none' } }).ok, true);
  });
});

describe('v0.73.0 O28 (5-A11): guided missiles lock on to Signature', () => {
  test('against a vehicle: Signature replaces range, ECM above ECCM adds', () => {
    const r = missileLockOn({ guidance: 4, targetIsVehicle: true, signature: 2, rangeTn: 6, targetEcm: 3, firerEccm: 1 });
    assert.equal(r.applies, true);
    assert.equal(6 + r.modifiers.reduce((n, m) => n + m.value, 0), 2 + 2);
  });

  test('not a missile, melee, a person (by default) or switched off: nothing changes', () => {
    assert.equal(missileLockOn({ guidance: 0, targetIsVehicle: true, signature: 2, rangeTn: 6 }).applies, false);
    assert.equal(missileLockOn({ guidance: 4, melee: true, targetIsVehicle: true, signature: 2, rangeTn: 6 }).applies, false);
    assert.equal(missileLockOn({ guidance: 4, targetIsVehicle: false, signature: 0, rangeTn: 6 }).applies, false);
    withRule('missiles.signature', false, () => assert.equal(missileLockOn({ guidance: 4, targetIsVehicle: true, signature: 2, rangeTn: 6 }).applies, false));
    withRule('missiles.vsPeople', 'signature', () => {
      const p = missileLockOn({ guidance: 4, targetIsVehicle: false, signature: 0, rangeTn: 4 });
      assert.equal(4 + p.modifiers.reduce((n, m) => n + m.value, 0), RULES.VEHICLES.sensors.personSignature);
    });
  });

  test('needsLock: a vehicle without a lock fires it unguided; hand-fired missiles need none', () => {
    withRule('missiles.needsLock', true, () => {
      assert.equal(missileLockOn({ guidance: 4, targetIsVehicle: true, signature: 2, rangeTn: 6, fromVehicle: true, hasLock: false }).unguided, true);
      assert.equal(missileLockOn({ guidance: 4, targetIsVehicle: true, signature: 2, rangeTn: 6, fromVehicle: true, hasLock: true }).applies, true);
      assert.equal(missileLockOn({ guidance: 4, targetIsVehicle: true, signature: 2, rangeTn: 6, fromVehicle: false }).applies, true);
    });
  });
});

describe('v0.73.0 review fixes (drones)', () => {
  test("mounts mode 'off' shows nothing (not tracked)", () => {
    const cfg = { ...V.mounts, mode: 'off', capacityFrom: 'body' };
    const u = mountUsage({ tracked: true, firm: 4, hard: 2 }, [{ name: 'Minigun', mount: 'fixed', mountPoint: 'hard', antiVehicle: false, guidance: 0 }] as any, cfg);
    assert.equal(u.tracked, false);
    assert.equal(u.over, false);
    assert.equal(u.label, '');
  });
});
