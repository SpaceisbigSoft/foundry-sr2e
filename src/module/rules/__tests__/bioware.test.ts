import { test, describe } from 'node:test';
import { oldWay } from './oldway.ts';
import assert from 'node:assert/strict';
import {
  bioEffect, culturedWarnings, bioCost, bioConflicts, bioArmorAfterConflict, compensatedMonitor, plateletBoxes,
  bodyIndexHealingTn, bodyIndexToxinPenalty, adrenalCrash, surgeryTarget, recoveryDays, type BioItem,
} from '../bioware.ts';
import { stackAugmentations, sumBonuses } from '../cyberware.ts';

const bio = (bioKind: string, rating: number, extra: Partial<BioItem> = {}): BioItem => ({ name: bioKind, bioKind, rating, installed: true, ...extra });

describe('bioware depth (v0.30.0)', () => {
  test('each kind does its thing at its rating', (t) => {
    t.after(oldWay({"BOOK_V78.toxinBioware": "dice"})); // v0.78.0: the old rule (a house rule)
    assert.deepEqual(bioEffect(bio('muscleAugmentation', 3)).attributes, { strength: 3 });
    assert.deepEqual(bioEffect(bio('cerebralBooster', 2)).attributes, { intelligence: 2 });
    const syn = bioEffect(bio('synapticAccelerator', 2));
    assert.deepEqual({ d: syn.initiativeDice, r: syn.reflexes }, { d: 2, r: 'synaptic' });
    const ortho = bioEffect(bio('orthoskin', 3));
    assert.deepEqual({ b: ortho.ballistic, i: ortho.impact }, { b: 1, i: 3 });
    assert.equal(bioEffect(bio('toxinExtractor', 4)).toxinDice, 4);
    assert.equal(bioEffect(bio('trachealFilter', 2)).inhalantDice, 2);
    assert.equal(bioEffect(bio('plateletFactory', 1)).boxesOff, 1);
    assert.equal(bioEffect(bio('damageCompensator', 3)).ignoreBoxes, 3);
    assert.deepEqual(bioEffect(bio('other', 3)).attributes, {});
    assert.deepEqual(bioEffect(bio('muscleAugmentation', 3, { installed: false })).attributes, {});
    assert.deepEqual(bioEffect(bio('muscleAugmentation', 3, { damaged: true })).attributes, {});
  });

  test('adrenal pumps work only while active, and crash when switched off', () => {
    assert.deepEqual(bioEffect(bio('adrenalPump', 2)).attributes, {});
    assert.deepEqual(bioEffect(bio('adrenalPump', 2, { active: true })).attributes, { quickness: 2, strength: 2, willpower: 2 });
    assert.deepEqual(adrenalCrash(1), { attribute: 'body', tn: 6, level: 'M' });
    assert.equal(adrenalCrash(2).level, 'S');
    assert.equal(adrenalCrash(5).level, 'S');
  });

  test('synaptic accelerators do not stack with wired reflexes', () => {
    const wired = { name: 'Wired Reflexes 1', essenceCost: 2, grade: 'standard' as const, installed: true, reaction: 2, initiativeDice: 1 };
    const syn = { name: 'Synaptic Accelerator 2', essenceCost: 0, grade: 'standard' as const, installed: true, initiativeDice: 2, reflexes: 'synaptic' };
    assert.equal(sumBonuses(stackAugmentations([wired, syn], []).cyber).initiativeDice, 2);
  });

  test('cultured bioware, conflicts with cyberware, and armor that does not stack', () => {
    assert.deepEqual(culturedWarnings([bio('cerebralBooster', 1), bio('cerebralBooster', 1, { cultured: true }), bio('muscleAugmentation', 2)]), ['cerebralBooster should be cultured bioware']);
    assert.equal(bioCost(10000, true), 40000);
    assert.equal(bioCost(10000, false), 10000);
    const c = bioConflicts([bio('orthoskin', 2), bio('muscleAugmentation', 1)], ['Dermal Plating 2', 'Muscle Replacement 1']);
    assert.equal(c.armorConflict, true);
    assert.equal(c.warnings.length, 2);
    assert.equal(bioConflicts([bio('orthoskin', 2)], ['Cybereyes']).armorConflict, false);
    assert.equal(bioArmorAfterConflict(3, 2, true), 1);
    assert.equal(bioArmorAfterConflict(1, 2, true), 0);
    assert.equal(bioArmorAfterConflict(3, 2, false), 3);
  });

  test('damage compensators, platelet factories, Body Index side effects, surgery', () => {
    assert.deepEqual(compensatedMonitor({ physical: 4, stun: 1 }, 2), { physical: 2, stun: 0 });
    assert.equal(plateletBoxes(6, 1), 5);
    assert.equal(plateletBoxes(1, 1), 1);
    assert.equal(plateletBoxes(0, 1), 0);
    assert.equal(bodyIndexHealingTn(3.5), 1);
    assert.equal(bodyIndexHealingTn(4), 2);
    assert.equal(bodyIndexToxinPenalty(2.4), 1);
    assert.equal(surgeryTarget('beta'), 6);
    assert.equal(surgeryTarget('weird'), 4);
    assert.equal(recoveryDays(1.5, 2), 8);
    assert.equal(recoveryDays(0.1, 5), 1);
    assert.equal(recoveryDays(2, 0), null);
  });
});
