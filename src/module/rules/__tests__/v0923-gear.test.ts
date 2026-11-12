/**
 * v0.92.3 book alignment, gear, cyberware and bioware (RULES.GEAR_V923): the pure rules. Each switch's default is the
 * book's way; the other choice gives the old (v0.92.2) result. The Foundry glue is in __tests__/v0923-gear.test.ts.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { RULES } from '../config.ts';
import { oldWay } from './oldway.ts';
import { essenceLoss, cyberCost } from '../cyberware.ts';
import { bioEffect, bioCost, culturedWarnings, surgeryTarget } from '../bioware.ts';
import { rejectionTn } from '../implants.ts';
import { cyberDamageDue } from '../armory.ts';
import { statBlockItems, parseStatBlock } from '../statblock.ts';
import {
  gearBook, gradedEssence, essenceKills, isDermalPlating, dermalRating, limbPairsBody, housedEssenceCost, boneLacingBook,
  cyberReplacements, awakenedBioEssence, systemShockTn, bodyIndexHealsTn, culturedBodyCost, culturedPriceApplies,
  adrenalCrashBook, bookLoad, isHeavyArmor, heavyArmorPoolPenalty, surgeryTnBook, surgeryEssenceFactor, surgeryEssenceCost,
  surgeryTraumaLevel, systemsHit, systemDamage, gradeResistTn, systemStops,
} from '../gear923.ts';

const bio = (bioKind: string, rating: number, more: any = {}) => ({ name: bioKind, bioKind, rating, installed: true, ...more });

describe('v0.92.3 gear: the defaults are the book', () => {
  test('every switch starts at the book way', () => {
    for (const k of Object.keys(RULES.GEAR_V923) as Array<keyof typeof RULES.GEAR_V923>) assert.equal(gearBook(k), true, k);
  });
  test('under the Revamp source every switch reads as the old way', (t) => {
    t.after(oldWay({ 'URR_V80.active': true }));
    for (const k of Object.keys(RULES.GEAR_V923) as Array<keyof typeof RULES.GEAR_V923>) assert.equal(gearBook(k), false, k);
    assert.equal(essenceLoss({ essenceCost: 2, grade: 'beta' }), 1.4);
  });
});

describe('ware grades (SSC; Cybertechnology p. 44)', () => {
  test('beta × .6, rounded up, never below .05; nuyen × 3 / 7 / 10', () => {
    assert.equal(essenceLoss({ essenceCost: 2, grade: 'alpha' }), 1.6);
    assert.equal(essenceLoss({ essenceCost: 2, grade: 'beta' }), 1.2);
    assert.equal(essenceLoss({ essenceCost: 2, grade: 'delta' }), 1);
    assert.equal(essenceLoss({ essenceCost: 0.15, grade: 'delta' }), 0.08); // 0.075 rounded up
    assert.equal(essenceLoss({ essenceCost: 0.05, grade: 'delta' }), 0.05); // never below .05
    assert.equal(gradedEssence(0.03, 'beta'), 0.03); // a cost already under .05 keeps its own
    assert.equal(cyberCost(1000, 'alpha'), 3000);
    assert.equal(cyberCost(1000, 'beta'), 7000);
    assert.equal(cyberCost(1000, 'delta'), 10000);
  });
  test('old: beta × .7, nuyen × 2 / 4 / 8, no rounding up', (t) => {
    t.after(oldWay({ 'GEAR_V923.grades': 'old' }));
    assert.equal(essenceLoss({ essenceCost: 2, grade: 'beta' }), 1.4);
    assert.equal(essenceLoss({ essenceCost: 0.15, grade: 'delta' }), 0.08);
    assert.equal(essenceLoss({ essenceCost: 0.05, grade: 'delta' }), 0.03);
    assert.equal(cyberCost(1000, 'delta'), 8000);
  });
});

describe('Essence 0 (Core p. 246)', () => {
  test('only below 0 kills; old: 0 kills', (t) => {
    assert.equal(essenceKills(0), false);
    assert.equal(essenceKills(-0.1), true);
    t.after(oldWay({ 'GEAR_V923.essenceZero': 'dead' }));
    assert.equal(essenceKills(0), true);
  });
});

describe('dermal plating and cyberlimbs (Core pp. 248–249; Cybertechnology p. 49)', () => {
  test('plating is found by name and rated', () => {
    assert.equal(isDermalPlating({ name: 'Dermal plating 2', kind: 'other' }), true);
    assert.equal(isDermalPlating({ name: 'Dermal plating', kind: 'other', bioware: true }), false);
    assert.equal(dermalRating({ rating: 0, armorBallistic: 2, armorImpact: 2 }), 2);
    assert.equal(dermalRating({ rating: 3 }), 3);
  });
  test('pairs of full cyberlimbs add Body; hands do not; off gives nothing', (t) => {
    const arms = [{ name: 'Cyberarm', location: 'leftArm' }, { name: 'Cyberarm', location: 'rightArm' }];
    assert.equal(limbPairsBody(arms), 1);
    assert.equal(limbPairsBody([...arms, { name: 'Cyberleg', location: 'leftLeg' }, { name: 'Cyberleg', location: 'rightLeg' }]), 2);
    assert.equal(limbPairsBody([{ name: 'Cyberarm', location: 'leftArm' }, { name: 'Cyberhand', location: 'rightArm' }]), 0);
    t.after(oldWay({ 'GEAR_V923.limbPairs': 'off' }));
    assert.equal(limbPairsBody(arms), 0);
  });
  test('housed ware: only the short list costs less; capacity: none', (t) => {
    assert.equal(housedEssenceCost({ name: 'Smartlink', essenceCost: 0.5 }), 0.25);
    assert.equal(housedEssenceCost({ name: 'Retractable spur', essenceCost: 0.3 }), 0);
    assert.equal(housedEssenceCost({ name: 'Fingertip compartment', essenceCost: 0.1 }), 0);
    assert.equal(housedEssenceCost({ name: 'Tactical computer', essenceCost: 3 }), 2.25);
    assert.equal(housedEssenceCost({ name: 'Cyber gun', essenceCost: 0.4 }), 0.4);
    t.after(oldWay({ 'GEAR_V923.limbHoused': 'capacity' }));
    assert.equal(housedEssenceCost({ name: 'Cyber gun', essenceCost: 0.4 }), null);
  });
});

describe('bone lacing (Shadowtech p. 42; Cybertechnology pp. 49–50)', () => {
  test('Body and armor by material; cyber replacements weaken it', (t) => {
    assert.deepEqual(boneLacingBook('plastic'), { body: 1, impact: 0, ballistic: 0 });
    assert.deepEqual(boneLacingBook('aluminum'), { body: 1, impact: 1, ballistic: 0 });
    assert.deepEqual(boneLacingBook('titanium'), { body: 2, impact: 1, ballistic: 1 });
    assert.deepEqual(boneLacingBook('titanium', 3), { body: 2, impact: 0, ballistic: 0 });
    assert.deepEqual(boneLacingBook('titanium', 4), { body: 0, impact: 0, ballistic: 0 });
    assert.equal(cyberReplacements([{ kind: 'cyberlimb' }, { kind: 'other', name: 'Cyberskull' }, { kind: 'other', name: 'Datajack' }]), 2);
    t.after(oldWay({ 'GEAR_V923.boneLacing': 'dice' }));
    assert.deepEqual(boneLacingBook('titanium'), { body: 0, impact: 0, ballistic: 0 });
  });
});

describe('bioware (Shadowtech)', () => {
  test('muscle augmentation, adrenal pump, cerebral booster, orthoskin, enhanced articulation, pain editor', () => {
    assert.deepEqual(bioEffect(bio('muscleAugmentation', 2)).attributes, { strength: 2, quickness: 2 });
    const pump = bioEffect(bio('adrenalPump', 2, { active: true }));
    assert.deepEqual([pump.attributes, pump.reaction, pump.quicknessNoReaction], [{ quickness: 2, strength: 2, willpower: 2 }, 4, 2]);
    assert.equal(bioEffect(bio('cerebralBooster', 2)).taskPool, 1);
    assert.equal(bioEffect(bio('cerebralBooster', 1)).taskPool, 0);
    assert.deepEqual([1, 2, 3].map((r) => { const e = bioEffect(bio('orthoskin', r)); return [e.impact, e.ballistic]; }), [[1, 0], [1, 1], [2, 1]]);
    const art = bioEffect(bio('enhancedArticulation', 1));
    assert.deepEqual([art.physicalSkillDice, art.allActiveDice, art.reaction], [0, 1, 1]);
    const pe = bioEffect(bio('painEditor', 1));
    assert.deepEqual([pe.attributes, pe.perceptionTn, pe.ignoreStunWounds], [{ willpower: 1, intelligence: -1 }, 0, true]);
  });
  test('old: the v0.92.2 effects', (t) => {
    t.after(oldWay({ 'GEAR_V923.bioware': 'old' }));
    assert.deepEqual(bioEffect(bio('muscleAugmentation', 2)).attributes, { strength: 2 });
    assert.equal(bioEffect(bio('adrenalPump', 2, { active: true })).reaction, 0);
    assert.deepEqual([bioEffect(bio('orthoskin', 2)).impact, bioEffect(bio('orthoskin', 2)).ballistic], [2, 1]);
    assert.equal(bioEffect(bio('enhancedArticulation', 1)).physicalSkillDice, 1);
    assert.equal(bioEffect(bio('painEditor', 1)).perceptionTn, 1);
  });
  test('the Awakened pay Essence for bioware; old: none (Magic by Body Index)', (t) => {
    assert.equal(awakenedBioEssence(0.8, true), 0.8);
    assert.equal(awakenedBioEssence(0.8, false), 0);
    t.after(oldWay({ 'GEAR_V923.awakenedBioware': 'magic' }));
    assert.equal(awakenedBioEssence(0.8, true), 0);
  });
  test('system shock over the Body Index; old: the rejection test', (t) => {
    assert.equal(systemShockTn(4.3, 4), 1);
    assert.equal(systemShockTn(5.5, 4), 2);
    assert.equal(systemShockTn(3, 4), 0);
    assert.equal(rejectionTn(5, 4), null);
    t.after(oldWay({ 'GEAR_V923.overBodyIndex': 'rejection' }));
    assert.equal(systemShockTn(5.5, 4), 0);
    assert.equal(rejectionTn(5, 4), 5);
  });
  test('Body Index and healing: magical only; all: first aid and natural', (t) => {
    assert.deepEqual([bodyIndexHealsTn('magical'), bodyIndexHealsTn('other')], [true, false]);
    t.after(oldWay({ 'GEAR_V923.bioHealing': 'all' }));
    assert.deepEqual([bodyIndexHealsTn('magical'), bodyIndexHealsTn('other')], [false, true]);
  });
  test('cultured: Body Cost × .75, neural ware already counted; old: ×4 everywhere', (t) => {
    assert.equal(culturedBodyCost(0.8, true, 'muscleAugmentation'), 0.6);
    assert.equal(culturedBodyCost(0.8, true, 'cerebralBooster'), 0.8);
    assert.equal(culturedBodyCost(0.8, false, 'muscleAugmentation'), 0.8);
    assert.equal(bioCost(10000, true, 'muscleAugmentation'), 40000);
    assert.equal(bioCost(10000, true, 'cerebralBooster'), 10000);
    assert.equal(culturedPriceApplies(true, 'synapticAccelerator'), false);
    assert.deepEqual(culturedWarnings([bio('cerebralBooster', 1)]), []);
    t.after(oldWay({ 'GEAR_V923.cultured': 'old' }));
    assert.equal(culturedBodyCost(0.8, true, 'muscleAugmentation'), 0.8);
    assert.equal(bioCost(10000, true, 'cerebralBooster'), 40000);
    assert.equal(culturedWarnings([bio('cerebralBooster', 1)]).length, 1);
  });
  test('adrenal crash: Deadly Stun at half the turns', () => {
    assert.deepEqual(adrenalCrashBook(4), { attribute: 'body', tn: 2, level: 'D' });
    assert.equal(adrenalCrashBook(1).tn, 1);
  });
});

describe('carrying and heavy armor (Core pp. 84, 185)', () => {
  test('Strength × 5 free, then Light, Moderate, Serious, passing out', () => {
    assert.deepEqual([bookLoad(20, 4).step, bookLoad(20, 4).level, bookLoad(20, 4).limit], [0, '', 20]);
    const l = bookLoad(30, 4);
    assert.deepEqual([l.level, l.boxes, l.move, l.run, l.penalty], ['L', 1, 1, true, 0]);
    const m = bookLoad(50, 4);
    assert.deepEqual([m.level, m.boxes, m.move, m.run], ['M', 3, 0.5, false]);
    const s = bookLoad(70, 4);
    assert.deepEqual([s.level, s.boxes, s.move, s.passOut], ['S', 6, 0.25, false]);
    assert.equal(bookLoad(81, 4).passOut, true);
  });
  test('only heavy armor costs Combat Pool dice, ballistic over Quickness', () => {
    assert.equal(isHeavyArmor('Heavy armor (partial suit)'), true);
    assert.equal(isHeavyArmor('Armor jacket'), false);
    assert.equal(heavyArmorPoolPenalty([{ name: 'Armor jacket', ballistic: 5 }], 3), 0);
    assert.equal(heavyArmorPoolPenalty([{ name: 'Full heavy armor', ballistic: 8 }, { name: 'Helmet', ballistic: 1, adds: true }], 5), 4);
  });
});

describe('surgery (Cybertechnology pp. 53–54; Core pp. 114–115; Shadowtech p. 5)', () => {
  test('TN 10 − Essence left; successes change the Essence cost', (t) => {
    assert.equal(surgeryTnBook(2.3), 8);
    assert.equal(surgeryTnBook(9), 2);
    assert.equal(surgeryTarget('alpha', 2.3), 8);
    assert.equal(surgeryTarget('alpha', null), 5);
    assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 9].map(surgeryEssenceFactor), [1.15, 1.1, 1, 1, 0.9, 0.9, 0.8, 0.8]);
    assert.equal(surgeryEssenceCost(0.5, 0), 0.58); // .575 rounded up
    assert.equal(surgeryEssenceCost(2, 6), 1.6);
    t.after(oldWay({ 'GEAR_V923.surgery': 'old' }));
    assert.equal(surgeryTarget('alpha', 2.3), 5);
  });
  test('the surgery wound by size, cyberware or bioware; old: the single table', (t) => {
    assert.deepEqual([0, 0.3, 0.5, 1].map((p) => surgeryTraumaLevel(p, false)), ['L', 'M', 'S', 'D']);
    assert.deepEqual([0.2, 0.5, 1.2, 2].map((p) => surgeryTraumaLevel(p, true)), ['L', 'M', 'S', 'D']);
    t.after(oldWay({ 'GEAR_V923.surgeryTrauma': 'old' }));
    assert.equal(surgeryTraumaLevel(0.3, false), null);
  });
});

describe('system damage (Shadowtech p. 36; Cybertechnology p. 44)', () => {
  test('Serious and Deadly wounds; systems hit; damage by die; graded resistance', (t) => {
    assert.deepEqual([cyberDamageDue('S', 'physical'), cyberDamageDue('M', 'physical'), cyberDamageDue('D', 'stun')], [true, false, false]);
    assert.deepEqual([systemsHit('S', 6), systemsHit('S', 4), systemsHit('D', 5), systemsHit('M', 6)], [2, 0, 3, 0]);
    assert.deepEqual([0, 1, 3, 5, 6, 7].map(systemDamage), ['', 'L', 'M', 'S', 'D', 'X']);
    assert.deepEqual([gradeResistTn('alpha', 'S'), gradeResistTn('beta', 'D'), gradeResistTn('delta', 'S'), gradeResistTn('standard', 'S')], [5, 5, 3, null]);
    assert.deepEqual(['L', 'M', 'X'].map(systemStops), [false, true, true]);
    t.after(oldWay({ 'GEAR_V923.cyberDamage': 'old' }));
    assert.equal(cyberDamageDue('S', 'physical'), false);
  });
});

describe('the importer\'s tables (wareTables)', () => {
  test('book Essence and Body Cost; old guesses', (t) => {
    const sys = (s: string) => statBlockItems(parseStatBlock(`Cyberware: ${s}`)).items[0]!.system;
    assert.equal(sys('Boosted Reflexes 1').reaction, 0);
    assert.equal(sys('Boosted Reflexes 3').reaction, 2);
    assert.equal(sys('Cyberhand').essenceCost, 0.35);
    assert.equal(sys('Skillwires 2').essenceCost, 0.2);
    assert.equal(sys('Skillwires 5').essenceCost, 1);
    assert.equal(sys('Ingested Filtration 5').essenceCost, 1);
    assert.equal(sys('Encephalon 1').essenceCost, 0.5);
    assert.equal(sys('Muscle Augmentation 2').bodyIndex, 1.6);
    assert.equal(sys('Adrenal Pump 1').bodyIndex, 1.25);
    assert.equal(sys('Suprathyroid Gland').bodyIndex, 1.4);
    assert.deepEqual([sys('Tailored Pheromones 1').bioware, sys('Tailored Pheromones 1').bodyIndex], [true, 0.4]);
    t.after(oldWay({ 'GEAR_V923.wareTables': 'old' }));
    assert.equal(sys('Boosted Reflexes 1').reaction, 1);
    assert.equal(sys('Cyberhand').essenceCost, 0.25);
    assert.equal(sys('Muscle Augmentation 2').bodyIndex, 0.4);
    assert.equal(sys('Tailored Pheromones 1').essenceCost, 0.4);
  });
});

describe('templates (book numbers)', () => {
  const T = (id: string) => (RULES.ITEM_TEMPLATES as any[]).find((x) => x.id === id);
  test('Concealability, weight, Availability and Street Index from the books; the lined coat; dermal plating rated', () => {
    assert.deepEqual([T('armorJacket').system.concealability, T('armorJacket').system.weight, T('armorJacket').system.availability, T('armorJacket').system.streetIndex], [6, 2, '3/36 hrs', 0.75]);
    assert.deepEqual([T('holdout').system.concealability, T('holdout').system.availability], [8, '2/12 hrs']);
    assert.deepEqual([T('linedCoat').system.ballistic, T('linedCoat').system.impact, T('linedCoat').system.cost], [4, 2, 700]);
    assert.equal(T('dermalPlating1').system.rating, 1);
    assert.deepEqual([T('weaponScanner').system.cost, T('cyberScanner').system.cost, T('cyberScanner').system.scanner.rating], [20000, 5000, 3]);
  });
});

