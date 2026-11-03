/**
 * v0.80.0: the "SR2E Unified Rules Revamp" rules source, drones-security area (rules/urr80-drones-security.ts): each
 * function under the Revamp (urrMode) and under the book (the shipped values).
 */
import { test, describe } from 'node:test';
import assert from '../../__tests__/helpers/assert-rows.ts';
import { RULES } from '../config.ts';
import {
  dsInterceptPlan, dsDecryptPassed, dsRadioDecrypt, dsCasingModifiers, dsLockToolStep, dsDeviceStepWords, dsSequencerSeconds,
  dsMadScanOn, dsHighestDie, dsMadFinds, dsDisorientation, dsDeviceEccm,
} from '../urr80-drones-security.ts';
import { URR_V80_DRONES_SECURITY, URR80_PATCH_DRONES_SECURITY } from '../config80-drones-security.ts';
import { urrMode } from './urrmode.ts';

describe('v0.80.0 drones-security: shipped values are the book', () => {
  test('every switch ships off', () => {
    const u = URR_V80_DRONES_SECURITY;
    assert.deepEqual([u.dsLinkIntercept, u.dsRadioDecrypt, u.dsLockCasing, u.dsPasskey, u.dsSequencer, u.dsMadScan], ['book', 'book', 'book', 'book', 'book', 'book']);
    assert.equal(u.dsDumpDisorient, false);
    assert.equal(u.dsCommsEccm, 0);
    assert.equal(RULES.URR_V80.dsLinkIntercept, 'book');
  });
  test('the patch keeps every lock type id and only raises the retinal scanner', () => {
    const p = URR80_PATCH_DRONES_SECURITY['SECURITY_V57.lockTypes'] as Array<{ id: string; tn: number; tools: readonly string[] }>;
    const book = RULES.SECURITY_V57.lockTypes;
    assert.deepEqual(p.map((l) => l.id), book.map((l) => l.id));
    for (const l of p) {
      const b = book.find((x) => x.id === l.id)!;
      assert.deepEqual([...l.tools], [...b.tools], l.id);
      assert.equal(l.tn, l.id === 'retina' ? 4 : b.tn, l.id);
    }
  });
});

describe('v0.80.0 drone-link interception (dsLinkIntercept)', () => {
  test('book: no plan', () => {
    assert.equal(dsInterceptPlan({ ownRcd: 4, targetRcd: 3, pilot: 2, encryption: 4, hasEwSkill: true }), null);
  });
  test('Revamp: deck rating vs target deck + 3; encryption first (vs encryption + 4, half the deck rounded up)', (t) => {
    t.after(urrMode());
    const p = dsInterceptPlan({ ownRcd: 4, targetRcd: 3, pilot: 2, encryption: 5, hasEwSkill: true })!;
    assert.deepEqual(p.intercept, { dice: 4, baseTn: 3, modifiers: [{ label: 'Interception', value: 3 }], from: 'remote control deck 3' });
    assert.deepEqual(p.decrypt, { skill: 'Electronic Warfare', baseTn: 5, modifiers: [{ label: 'Decryption', value: 4 }], need: 2 });
    const e = dsInterceptPlan({ ownRcd: 4, targetRcd: 0, pilot: 2, encryption: 2, hasEwSkill: false })!;
    assert.equal(e.decrypt!.skill, 'Electronics');
    assert.deepEqual(e.decrypt!.modifiers.map((m) => m.value), [4, 2]);
    assert.equal(e.decrypt!.need, 1);
    assert.equal(e.intercept.baseTn, 2);
    assert.match(e.intercept.from, /Pilot 2/);
    assert.equal(dsInterceptPlan({ ownRcd: 4, targetRcd: 3, pilot: 2, encryption: 0, hasEwSkill: true })!.decrypt, null);
  });
  test('decryption needs the successes', () => {
    assert.equal(dsDecryptPassed(1, 2), false);
    assert.equal(dsDecryptPassed(2, 2), true);
    assert.equal(dsDecryptPassed(0, 0), false);
  });
});

describe('v0.80.0 radio decryption (dsRadioDecrypt)', () => {
  test('book: no change', () => {
    assert.equal(dsRadioDecrypt({ encryption: 6 }), null);
  });
  test('Revamp: encryption + 3, half the encryption (rounded down, at least 1); unencrypted stays the book test', (t) => {
    t.after(urrMode());
    assert.deepEqual(dsRadioDecrypt({ encryption: 5 }), { baseTn: 5, modifiers: [{ label: 'Decryption', value: 3 }], need: 2 });
    assert.equal(dsRadioDecrypt({ encryption: 1 })!.need, 1);
    assert.equal(dsRadioDecrypt({ encryption: 0 }), null);
  });
});

describe('v0.80.0 maglocks (dsLockCasing, dsPasskey, dsSequencer)', () => {
  const tools = [{ kind: 'passkey', rating: 5, name: 'Key' }, { kind: 'sequencer', rating: 4, name: 'Seq' }];
  test('book: no casing modifier, no tool step', () => {
    assert.deepEqual(dsCasingModifiers('card', 3), []);
    assert.equal(dsLockToolStep({ lockType: 'card', rating: 4, skillDice: 2, tools }), null);
    assert.equal(dsLockToolStep({ lockType: 'keypad', rating: 4, skillDice: 2, tools }), null);
  });
  test('Revamp: card casing doubles, scanners +2', (t) => {
    t.after(urrMode());
    assert.deepEqual(dsCasingModifiers('card', 3), [{ label: 'Card reader casing', value: 3 }]);
    assert.deepEqual(dsCasingModifiers('retina', 3), [{ label: 'Scanner casing', value: 2 }]);
    assert.deepEqual(dsCasingModifiers('print', 1), [{ label: 'Scanner casing', value: 2 }]);
    assert.deepEqual(dsCasingModifiers('keypad', 3), []);
  });
  test('Revamp: passkey rating vs the reader; sequencer opposed on a keypad; not when the skill is better', (t) => {
    t.after(urrMode());
    const k = dsLockToolStep({ lockType: 'card', rating: 4, skillDice: 2, tools })!;
    assert.deepEqual({ step: k.step, tn: k.tn, dice: k.dice, mods: k.modifiers, kind: k.tool.kind }, { step: 'circuit', tn: 4, dice: 5, mods: [], kind: 'passkey' });
    const s = dsLockToolStep({ lockType: 'keypad', rating: 6, skillDice: 2, tools })!;
    assert.deepEqual({ step: s.step, tn: s.tn, dice: s.dice, kind: s.tool.kind }, { step: 'voice', tn: 6, dice: 4, kind: 'sequencer' });
    assert.equal(dsLockToolStep({ lockType: 'keypad', rating: 6, skillDice: 5, tools }), null);
    assert.equal(dsLockToolStep({ lockType: 'print', rating: 6, skillDice: 1, tools }), null);
    assert.equal(dsLockToolStep({ lockType: 'card', rating: 4, skillDice: 2, tools: [] }), null);
  });
  test('device step words', () => {
    assert.equal(dsDeviceStepWords('voice').accepts, 'accepts the voice');
    assert.equal(dsDeviceStepWords('keypad').accepts, 'accepts the code');
    assert.equal(dsDeviceStepWords('voice').noun, 'voice');
    assert.deepEqual([dsSequencerSeconds(0), dsSequencerSeconds(1), dsSequencerSeconds(3)], [0, 10, 4]);
  });
});

describe('v0.80.0 weapon detectors (dsMadScan)', () => {
  test('book: off', () => {
    assert.equal(dsMadScanOn('scanner', 'weapon'), false);
  });
  test('Revamp: weapon scanners only; found when the TN is at most the highest die', (t) => {
    t.after(urrMode());
    assert.equal(dsMadScanOn('scanner', 'weapon'), true);
    assert.equal(dsMadScanOn('scanner', 'cyber'), false);
    assert.equal(dsMadScanOn('look', 'weapon'), false);
    assert.equal(dsHighestDie([2, 5, 3]), 5);
    assert.equal(dsHighestDie([]), 0);
    assert.deepEqual(dsMadFinds(5, 5), { found: true, need: 5 });
    assert.deepEqual(dsMadFinds(5, 4, [{ label: 'Group', value: 2 }]), { found: false, need: 6 });
  });
});

describe('v0.80.0 dump shock disorientation (dsDumpDisorient)', () => {
  test('10 turns ÷ successes, rounded down; none: the full 10', () => {
    assert.deepEqual(dsDisorientation(0), { tn: 2, testTn: 4, turns: 10 });
    assert.equal(dsDisorientation(3).turns, 3);
    assert.equal(dsDisorientation(11).turns, 0);
  });
});

describe('v0.80.0 device ECCM (dsCommsEccm)', () => {
  test('book: its own ECCM', () => {
    assert.equal(dsDeviceEccm(0), 0);
    assert.equal(dsDeviceEccm(undefined), 0);
    assert.equal(dsDeviceEccm(3), 3);
  });
  test('Revamp: at least 1', (t) => {
    t.after(urrMode());
    assert.equal(dsDeviceEccm(0), 1);
    assert.equal(dsDeviceEccm(3), 3);
  });
});
