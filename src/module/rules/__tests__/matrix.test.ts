import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  hackingPool, matrixReaction, matrixInitiativeDice, personaWarnings, memoryUse, loadedUtility, detectionFactor,
  utilityModifiers, applyMatrixDamage, matrixCrashed, advanceTally, raiseAlert, nextSheafStep, icInitiativeDice,
  type Deck, type SheafStep,
} from '../matrix.ts';

const deck: Deck = { mpcp: 6, bod: 4, evasion: 5, masking: 5, sensors: 4, hardening: 2, responseIncrease: 1, activeMemory: 300 };

describe('matrix', () => {
  test('Hacking Pool is (Intelligence + MPCP) / 3, rounded down', () => {
    assert.equal(hackingPool(6, 6), 4);
    assert.equal(hackingPool(5, 6), 3);
    assert.equal(hackingPool(0, 0), 0);
  });

  test('Matrix Reaction is Intelligence + 2 per Response Increase level; dice 1 + level, capped at 3', () => {
    assert.equal(matrixReaction(6, 0), 6);
    assert.equal(matrixReaction(6, 2), 10);
    assert.equal(matrixInitiativeDice(0), 1);
    assert.equal(matrixInitiativeDice(2), 3);
    assert.equal(matrixInitiativeDice(5), 4);
    assert.equal(matrixReaction(6, 5), 12);
  });

  test('persona programs are limited by MPCP, singly and in total', () => {
    assert.deepEqual(personaWarnings(deck), []);
    const w = personaWarnings({ ...deck, mpcp: 4, bod: 5, evasion: 4, masking: 4, sensors: 4, responseIncrease: 4 });
    assert.equal(w.length, 3);
    assert.match(w[0]!, /Bod 5 is above MPCP 4/);
    assert.match(w[1]!, /Persona total 17 is above 12/);
    assert.match(w[2]!, /Response Increase/);
  });

  test('active memory and loaded utilities', () => {
    const progs = [
      { kind: 'sleaze', rating: 4, size: 96, loaded: true },
      { kind: 'sleaze', rating: 6, size: 216, loaded: false },
      { kind: 'attack', rating: 5, size: 150, loaded: true },
    ];
    assert.deepEqual(memoryUse(progs, 300), { used: 246, free: 54, over: false });
    assert.equal(memoryUse(progs, 200).over, true);
    assert.equal(loadedUtility(progs, 'sleaze')?.rating, 4);
    assert.equal(loadedUtility(progs, 'browse'), null);
  });

  test('Detection Factor is (Masking + Sleaze) / 2 rounded up, minimum 2', () => {
    assert.equal(detectionFactor(5, 4), 5);
    assert.equal(detectionFactor(5, 0), 3);
    assert.equal(detectionFactor(0, 0), 2);
  });

  test('a loaded utility lowers the system test TN by its rating', () => {
    assert.deepEqual(utilityModifiers({ name: 'Deception 4', rating: 4 }), [{ label: 'Deception 4', value: -4 }]);
    assert.deepEqual(utilityModifiers(null), []);
    assert.deepEqual(utilityModifiers({ name: 'x', rating: 0 }), []);
  });

  test('Matrix damage fills a 10-box monitor and crashes at 10', () => {
    assert.deepEqual(applyMatrixDamage(0, 'M'), { after: 3, boxes: 3, crashed: false });
    assert.deepEqual(applyMatrixDamage(7, 'S'), { after: 10, boxes: 6, crashed: true });
    assert.deepEqual(applyMatrixDamage(4, null), { after: 4, boxes: 0, crashed: false });
    assert.equal(matrixCrashed(10), true);
    assert.equal(matrixCrashed(9), false);
  });

  test('the security tally triggers each sheaf step it passes, in order; alerts only rise', () => {
    const sheaf: SheafStep[] = [
      { step: 8, event: 'Killer IC', alert: '' },
      { step: 4, event: 'Probe IC', alert: '' },
      { step: 12, event: 'Passive alert', alert: 'passive' },
      { step: 15, event: 'Active alert', alert: 'active' },
    ];
    const a = advanceTally(3, 6, sheaf);
    assert.equal(a.tally, 9);
    assert.deepEqual(a.triggered.map((s) => s.event), ['Probe IC', 'Killer IC']);
    assert.deepEqual(advanceTally(9, 0, sheaf).triggered, []);
    const b = advanceTally(9, 7, sheaf);
    assert.equal(raiseAlert('none', b.triggered), 'active');
    assert.equal(raiseAlert('active', [{ step: 1, event: '', alert: 'passive' }]), 'active');
    assert.equal(nextSheafStep(9, sheaf)?.step, 12);
    assert.equal(nextSheafStep(20, sheaf), null);
  });

  test('IC initiative dice by security code', () => {
    assert.equal(icInitiativeDice('blue'), 1);
    assert.equal(icInitiativeDice('red'), 2);
    assert.equal(icInitiativeDice('black'), 3);
    assert.equal(icInitiativeDice('unknown'), 1);
  });
});
