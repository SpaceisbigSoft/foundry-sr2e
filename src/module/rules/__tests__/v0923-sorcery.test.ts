/**
 * v0.92.3 book alignment (sorcery): every RULES.SORCERY_V923 switch and the defaults moved in place. Each change is
 * checked at its default (the book's way) and with the switch back at its v0.92.2 way; the Revamp's own switches
 * still give the Revamp's results.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { RULES } from '../config.ts';
import { SORCERY_V923, HOUSE_SORCERY_V923 } from '../config923/sorcery.ts';
import { oldWay } from './oldway.ts';
import { urrMode } from './urrmode.ts';
import { SORCERY_V922 } from './sorcery922.ts';
import { effectiveMagic } from '../cyberware.ts';
import { resolveCombatSpell } from '../magic.ts';
import { healingTargetNumber, spellOptionDrainMods, magicLossOutcome, focusKarmaCost } from '../spellcraft.ts';
import { learningPlan, wardPlan, centeringCut, centeringMode } from '../arcanum.ts';
import { initiateMagic, shieldingDice, centeringModifiers, availableSustainingFocus } from '../arcana.ts';
import { initiationCost, designDrain, siteRaiseCost } from '../occult.ts';
import { ritualMaterialsCost, missingSites } from '../mysticism.ts';
import { geasaPenalty } from '../tracking.ts';
import { gmApplyShapeOk } from '../trust.ts';
import * as S from '../sorcery923.ts';

describe('v0.92.3 sorcery: the switches', () => {
  test('every switch ships at the book way and has a house-rules row', () => {
    for (const [k, v] of Object.entries(SORCERY_V923)) {
      if (typeof v === 'string') assert.equal(v, 'book', k);
      if (typeof v !== 'object') assert.ok(HOUSE_SORCERY_V923.some((r) => r.path === `SORCERY_V923.${k}`), k);
    }
    for (const r of HOUSE_SORCERY_V923) if (r.type === 'select') assert.equal(r.choices?.[0], 'book', r.path);
    assert.equal(SORCERY_V923.ruleOfOneDrain, 2);
    assert.equal(SORCERY_V923.elementalTn, 4);
    assert.equal(SORCERY_V923.treatTn, 8);
    assert.equal(SORCERY_V923.formulaAloneTn, 2);
    assert.equal(SORCERY_V923.weaponFocusKarma, 6);
    assert.equal(RULES.OCCULT.initiation.ordealReduction, 0.5);
    assert.equal(RULES.MAGIC_V56.ward.nuyenPerForce, 1000);
  });
});

describe('v0.92.3 Magic and Essence (Core p. 47; Ka-Ge 7 Q21)', () => {
  test('book: every point or part of Essence lost takes a point of Magic', () => {
    assert.equal(effectiveMagic(6, 3.75), 3);
    assert.equal(effectiveMagic(6, 4.5), 4);
    assert.equal(effectiveMagic(1, 5.8), 0);
    assert.equal(effectiveMagic(4, 5.8), 3);
    assert.equal(effectiveMagic(6, 6), 6);
    assert.equal(effectiveMagic(0, 6), 0);
  });
  test('v922: capped at Essence rounded up', (t) => {
    t.after(oldWay({ 'SORCERY_V923.magicFromEssence': 'v922' }));
    assert.equal(effectiveMagic(6, 3.75), 4);
    assert.equal(effectiveMagic(1, 5.8), 1);
  });
  test('the Revamp keeps its own rule (Essence rounded down caps Magic)', (t) => {
    t.after(urrMode());
    assert.equal(effectiveMagic(6, 3.75), 3);
    assert.equal(effectiveMagic(1, 5.8), 1);
  });
});

describe('v0.92.3 casting (Core pp. 128–133)', () => {
  test('a tie goes to the caster at the minimum effect; v922 no effect', (t) => {
    assert.deepEqual(resolveCombatSpell({ casterSuccesses: 2, resistSuccesses: 2, level: 'M' }), { hit: true, netSuccesses: 0, level: 'M' });
    assert.equal(resolveCombatSpell({ casterSuccesses: 0, resistSuccesses: 0, level: 'M' }).hit, false);
    assert.equal(resolveCombatSpell({ casterSuccesses: 4, resistSuccesses: 1, level: 'L' }).level, 'M');
    t.after(oldWay({ 'SORCERY_V923.spellTie': 'v922' }));
    assert.equal(resolveCombatSpell({ casterSuccesses: 2, resistSuccesses: 2, level: 'M' }).hit, false);
  });
  test('the Revamp tie is still L', (t) => {
    t.after(urrMode());
    assert.equal(resolveCombatSpell({ casterSuccesses: 2, resistSuccesses: 2, level: 'S' }).level, 'L');
  });
  test('all ones: Drain TN +2; v922 none; the Revamp +2', (t) => {
    assert.deepEqual(S.ruleOfOneDrainMods(true).map((m) => m.value), [2]);
    assert.deepEqual(S.ruleOfOneDrainMods(false), []);
    const undo = oldWay({ 'SORCERY_V923.ruleOfOneDrain': 0 });
    assert.deepEqual(S.ruleOfOneDrainMods(true), []);
    undo();
    t.after(urrMode({ 'SORCERY_V923.ruleOfOneDrain': 0 }));
    assert.deepEqual(S.ruleOfOneDrainMods(true).map((m) => m.value), [2]);
  });
  test('exclusive and fetish spells: higher effective Force, no Drain change; v922 Drain TN −2 / −1', (t) => {
    assert.equal(S.spellForceBonus({ exclusive: true }), 2);
    assert.equal(S.spellForceBonus({ fetish: true }), 1);
    assert.equal(S.spellForceBonus({ fetish: true, expendable: true }), 2);
    assert.equal(S.spellForceBonus({ exclusive: true, fetish: true, expendable: true }), 4);
    assert.deepEqual(spellOptionDrainMods({ exclusive: true, fetish: true }), []);
    t.after(oldWay({ 'SORCERY_V923.restrictedSpells': 'v922' }));
    assert.equal(S.spellForceBonus({ exclusive: true, fetish: true }), 0);
    assert.deepEqual(spellOptionDrainMods({ exclusive: true, fetish: true }).map((m) => m.value), [-2, -1]);
  });
  test('the Revamp: exclusive +2, fetish +1, no Drain change (as before)', (t) => {
    t.after(urrMode({ 'SORCERY_V923.restrictedSpells': 'v922' }));
    assert.equal(S.spellForceBonus({ exclusive: true, fetish: true }), 3);
    assert.deepEqual(spellOptionDrainMods({ exclusive: true, fetish: true }).map((m) => m.value), [0, 0]);
  });
  test('sustained spells: at most the Sorcery rating; foci, quickened and spirit-held ones do not count', (t) => {
    const two = [{ focusId: '' }, { focusId: '' }];
    assert.match(S.sustainCapProblem(two, 2) ?? '', /at most 2/);
    assert.equal(S.sustainCapProblem([...two.slice(1), { focusId: 'f' }, { quickened: true }, { spiritUuid: 's' }], 2), null);
    t.after(oldWay({ 'SORCERY_V923.sustainCap': 'v922' }));
    assert.equal(S.sustainCapProblem(two, 2), null);
  });
  test('no sustaining while projecting: casting refused, own spells drop', (t) => {
    assert.ok(S.sustainWhileProjectingProblem({ lasting: true, projecting: true, held: false }));
    assert.equal(S.sustainWhileProjectingProblem({ lasting: true, projecting: false, held: false }), null);
    assert.equal(S.sustainWhileProjectingProblem({ lasting: false, projecting: true, held: false }), null);
    const list = [{ spellName: 'A', focusId: '' }, { spellName: 'B', focusId: 'lock' }, { spellName: 'C', quickened: true }];
    assert.deepEqual(S.dropOnProjecting(list).dropped.map((s) => s.spellName), ['A']);
    t.after(oldWay({ 'SORCERY_V923.sustainProjecting': 'v922' }));
    assert.equal(S.sustainWhileProjectingProblem({ lasting: true, projecting: true, held: false }), null);
    assert.deepEqual(S.dropOnProjecting(list).dropped, []);
  });
  test('area spells: one roll, each target its own TN', () => {
    const dice = [2, 3, 4, 5, 6, 9].map((total) => ({ total }));
    // The card rolled at TN 4 (lowest attribute 3 + 1 for wounds): a Willpower 5 target counts at TN 6.
    assert.equal(S.areaTargetSuccesses({ dice, cardTn: 4, cardBase: 3, ownBase: 5 }), 2);
    assert.equal(S.areaTargetSuccesses({ dice, cardTn: 4, cardBase: 3, ownBase: 3 }), 4);
    assert.equal(S.areaTargetSuccesses({ dice, cardTn: 4, cardBase: 3, ownBase: 3, bought: 1 }), 5);
    assert.equal(S.areaTargetSuccesses({ dice, cardTn: 4, cardBase: 3, ownBase: 3, botch: true }), 0);
    assert.equal(S.successesAt([1, 1, 1], 2), 0);
  });
  test('the elemental TN is 4; v922 the spell\'s own', (t) => {
    assert.equal(S.elementalBaseTn(), 4);
    t.after(oldWay({ 'SORCERY_V923.elementalTn': 0 }));
    assert.equal(S.elementalBaseTn(), null);
  });
  test('Treat is 8 − Essence, Heal 10 − Essence; v922 both 10', (t) => {
    assert.equal(healingTargetNumber(5, 4, true), 3);
    assert.equal(healingTargetNumber(5, 4, false), 5);
    assert.equal(healingTargetNumber(6, 4, true), 2);
    t.after(oldWay({ 'SORCERY_V923.treatTn': 0 }));
    assert.equal(healingTargetNumber(5, 4, true), 5);
  });
});

describe('v0.92.3 learning and design', () => {
  test('learning: Sorcery + Magical Theory vs 2 × Force (Core p. 132); v922 Sorcery vs Force', (t) => {
    assert.equal(learningPlan(4, 2).tn, 8);
    assert.equal(S.learnExtraDice(3), 3);
    t.after(oldWay({ 'SORCERY_V923.learning': 'v922' }));
    assert.equal(learningPlan(4, 2).tn, 4);
    assert.equal(S.learnExtraDice(3), 0);
  });
  test('learning from a formula with no teacher: +2 TN (Grimoire p. 114)', (t) => {
    assert.deepEqual(S.formulaAloneMods({ teacher: false, formula: true }).map((m) => m.value), [2]);
    assert.deepEqual(S.formulaAloneMods({ teacher: true, formula: false }), []);
    t.after(oldWay({ 'SORCERY_V923.formulaAloneTn': 0 }));
    assert.deepEqual(S.formulaAloneMods({ teacher: false, formula: true }), []);
  });
  test('design drain: detection base M, area +1 level (not TN), touch −1 TN and −1 level, sustained health +1 TN', (t) => {
    assert.equal(designDrain({ category: 'detection', spellType: 'mana' }).drainLevel, 'M');
    const fb = designDrain({ category: 'combat', spellType: 'physical', area: true, damageLevel: 'M' });
    assert.deepEqual([fb.drainModifier, fb.drainLevel], [1, 'S']);
    const touch = designDrain({ category: 'combat', spellType: 'mana', touch: true, damageLevel: 'M' });
    assert.deepEqual([touch.drainModifier, touch.drainLevel], [-1, 'L']);
    assert.equal(designDrain({ category: 'health', spellType: 'mana', duration: 'sustained' }).drainModifier, 1);
    assert.equal(designDrain({ category: 'manipulation', spellType: 'mana', duration: 'sustained' }).drainModifier, 0);
    t.after(oldWay({ 'SORCERY_V923.design': 'v922' }));
    assert.equal(designDrain({ category: 'detection', spellType: 'mana' }).drainLevel, 'L');
    assert.deepEqual(Object.values(designDrain({ category: 'combat', spellType: 'physical', area: true, damageLevel: 'M' })).slice(0, 2), [2, 'M']);
  });
  test('design test: Magical Theory capped by the site, 2 × Force − Magic + drain, days by level (Grimoire p. 115)', (t) => {
    assert.deepEqual(S.bookDesignTest({ force: 4, magic: 6, theory: 5, siteRating: 7, drainModifier: 1, drainLevel: 'M' }), { dice: 6, tn: 3, baseDays: 27 });
    assert.deepEqual(S.bookDesignTest({ force: 6, magic: 5, theory: 5, siteRating: 3, drainModifier: 0, drainLevel: 'S' }), { dice: 3, tn: 7, baseDays: 30 });
    assert.equal(S.bookDesignTest({ force: 1, magic: 6, theory: 4, siteRating: 4, drainModifier: -1, drainLevel: 'L' })!.tn, 2);
    assert.equal(S.bookDesignDays(18, 4), 5);
    assert.equal(S.bookDesignDays(18, 0), null);
    t.after(oldWay({ 'SORCERY_V923.design': 'v922' }));
    assert.equal(S.bookDesignTest({ force: 4, magic: 6, theory: 5, siteRating: 7, drainModifier: 1, drainLevel: 'M' }), null);
  });
});

describe('v0.92.3 foci and enchanting', () => {
  const foci = [
    { focusType: 'spell', active: true, rating: 3, target: 'Manabolt' },
    { focusType: 'spell', active: true, rating: 2, category: 'combat' },
    { focusType: 'spell', active: false, rating: 5, category: 'combat' },
  ];
  test('spell foci help Drain (both) and resisting (category); v922 none', (t) => {
    assert.equal(S.spellFocusDiceFor(foci, { name: 'Manabolt', category: 'combat' }, 'drain'), 3);
    assert.equal(S.spellFocusDiceFor(foci, { name: 'Powerbolt', category: 'combat' }, 'drain'), 2);
    assert.equal(S.spellFocusDiceFor(foci, { name: 'Manabolt', category: 'combat' }, 'resist'), 2);
    assert.equal(S.spellFocusDiceFor(foci, { category: 'health' }, 'resist'), 0);
    t.after(oldWay({ 'SORCERY_V923.spellFocus': 'v922' }));
    assert.equal(S.spellFocusDiceFor(foci, { name: 'Manabolt', category: 'combat' }, 'drain'), 0);
  });
  test('a spell lock holds a spell of any Force; v922 up to its rating', (t) => {
    const lock = [{ id: 'l', name: 'Lock', focusType: 'sustaining', active: true, rating: 1, category: '' }] as any[];
    assert.equal(availableSustainingFocus(lock, [], { force: 5, category: 'health' })?.id, 'l');
    t.after(oldWay({ 'SORCERY_V923.spellLock': 'v922' }));
    assert.equal(availableSustainingFocus(lock, [], { force: 5, category: 'health' }), null);
  });
  test('a weapon focus bonds at 6 × rating (Grimoire p. 27); v922 small 4 / large 5', (t) => {
    assert.equal(focusKarmaCost('weapon', 3, { size: 'small' }), 18);
    assert.equal(focusKarmaCost('weapon', 3, { size: 'large' }), 18);
    assert.equal(focusKarmaCost('power', 2), 10);
    t.after(oldWay({ 'SORCERY_V923.weaponFocusKarma': 0 }));
    assert.equal(focusKarmaCost('weapon', 3, { size: 'small' }), 12);
  });
  test('focus addiction: 2D6 ≤ Magic loses a point; the second point lost brings the geas; Magic 1 loses no more', () => {
    assert.deepEqual(S.focusAddictionLoss({ roll: 5, magic: 5, lostBefore: 0 }), { lost: 1, geas: false });
    assert.deepEqual(S.focusAddictionLoss({ roll: 6, magic: 5, lostBefore: 0 }), { lost: 0, geas: false });
    assert.deepEqual(S.focusAddictionLoss({ roll: 3, magic: 4, lostBefore: 1 }), { lost: 1, geas: true });
    assert.deepEqual(S.focusAddictionLoss({ roll: 1, magic: 1, lostBefore: 0 }), { lost: 0, geas: false });
  });
  test('making a focus: TN by type + rating, spell lock 5, 30 days (Grimoire pp. 25–26); v922 the task\'s', (t) => {
    assert.equal(S.enchantFocusTn('power', 2, false), 10);
    assert.equal(S.enchantFocusTn('spell', 3, true), 7);
    assert.equal(S.enchantFocusTn('spell', 3, false), 9);
    assert.equal(S.enchantFocusTn('sustaining', 1, false), 5);
    assert.equal(S.enchantFocusTn('weapon', 1, false), 7);
    assert.equal(S.enchantFocusDays(), 30);
    t.after(oldWay({ 'SORCERY_V923.enchanting': 'v922' }));
    assert.equal(S.enchantFocusTn('power', 2, false), null);
    assert.equal(S.enchantFocusDays(), null);
  });
});

describe('v0.92.3 ritual sorcery, wards and sites', () => {
  test('ritual: pooled Magic Pools, no combat spells, team cap, a hermetic circle; v922 none', (t) => {
    assert.equal(S.ritualPoolDice([5, 4, 0]), 9);
    assert.match(S.ritualProblem({ category: 'combat', sorcery: [6, 6] }) ?? '', /combat/i);
    assert.ok(S.ritualProblem({ category: 'health', sorcery: [6, 2, 4] }));
    assert.equal(S.ritualProblem({ category: 'health', sorcery: [6, 3, 4] }), null);
    const lib = [{ name: 'Library', kind: 'library' as const, rating: 6, tag: 'sorcery' }];
    assert.equal(missingSites('ritual', 'hermetic', lib, { force: 4 }).length, 1);
    t.after(oldWay({ 'SORCERY_V923.ritualPool': 'v922', 'SORCERY_V923.ritualTeam': 'v922' }));
    assert.equal(S.ritualPoolDice([5, 4]), null);
    assert.equal(S.ritualProblem({ category: 'combat', sorcery: [6, 1] }), null);
    assert.deepEqual(missingSites('ritual', 'hermetic', lib, { force: 4 }), []);
  });
  test('ritual materials by category, resistance vs the leader\'s Sorcery, the spotter drains', (t) => {
    assert.equal(ritualMaterialsCost(4, 'health'), 2000);
    assert.equal(ritualMaterialsCost(4, 'manipulation'), 4000);
    assert.equal(ritualMaterialsCost(3, 'detection'), 300);
    assert.deepEqual(S.ritualResistTn(4, 6), { resistTn: 6 });
    assert.deepEqual(S.ritualResistTn(6, 4), {});
    assert.equal(S.spotterDrains(), true);
    t.after(oldWay({ 'SORCERY_V923.ritualMaterials': 'v922', 'SORCERY_V923.ritualResist': 'v922', 'SORCERY_V923.ritualSpotter': 'v922' }));
    assert.equal(ritualMaterialsCost(4, 'health'), 0);
    assert.deepEqual(S.ritualResistTn(4, 6), {});
    assert.equal(S.spotterDrains(), false);
  });
  test('wards: Drain (Force × successes) L Stun, Force hours, 1,000¥ per Force, Force at most 2 × Magic', (t) => {
    assert.deepEqual(wardPlan(4, 3), { tn: 4, baseHours: 4, hours: 4, nuyen: 4000, drainTn: 12, drainLevel: 'L' });
    assert.deepEqual(S.bookWardDrain(4, 3), { drainTn: 12, level: 'L', type: 'stun' });
    assert.ok(S.bookWardForceProblem(9, 4));
    assert.equal(S.bookWardForceProblem(8, 4), null);
    t.after(oldWay({ 'SORCERY_V923.ward': 'v922', 'MAGIC_V56.ward.nuyenPerForce': 0 }));
    assert.deepEqual(wardPlan(4, 3), { tn: 4, baseHours: 4, hours: 2, nuyen: 0, drainTn: 2, drainLevel: 'M' });
    assert.equal(S.bookWardForceProblem(9, 4), null);
  });
  test('the Revamp ward drain still wins while it is on', (t) => {
    t.after(urrMode());
    assert.equal(wardPlan(4, 3).drainTn, 7);
  });
  test('sites: a library costs rating² × its price, a circle an hour per rating', (t) => {
    assert.deepEqual(siteRaiseCost('library', 0, 3), { nuyen: 9000, days: 0 * 1 + 3 });
    assert.equal(siteRaiseCost('circle', 0, 6).days, 0.25);
    t.after(oldWay({ 'SORCERY_V923.siteCost': 'v922' }));
    assert.deepEqual(siteRaiseCost('library', 0, 3), { nuyen: 3000, days: 3 });
  });
});

describe('v0.92.3 initiation and metamagic (Grimoire pp. 37–52)', () => {
  test('the first initiation is Grade 0: 18 Karma, 15 with an ordeal, 12 / 9 in a group; no Magic', () => {
    assert.equal(initiationCost(1).cost, 18);
    assert.equal(initiationCost(1, { ordeal: true }).cost, 15);
    assert.equal(initiationCost(1, { group: true }).cost, 12);
    assert.equal(initiationCost(1, { group: true, ordeal: true }).cost, 9);
    assert.equal(initiationCost(2).cost, 21);
    assert.equal(initiationCost(2, { ordeal: true }).cost, 17);
    assert.equal(initiationCost(2, { group: true, ordeal: true }).cost, 10);
    assert.equal(initiateMagic(6, 1), 6);
    assert.equal(initiateMagic(6, 3), 8);
    assert.equal(initiateMagic(0, 3), 0);
    assert.equal(S.bookGrade(1), 0);
  });
  test('v922: the first initiation is grade 1', (t) => {
    t.after(oldWay({ 'SORCERY_V923.initiation': 'v922', 'OCCULT.initiation.ordealReduction': 1 }));
    assert.equal(initiationCost(1).cost, 21);
    assert.equal(initiateMagic(6, 1), 7);
    assert.equal(S.bookGrade(1), 1);
  });
  test('grade bonuses count from the book\'s grade', () => {
    assert.equal(shieldingDice(1, ['shielding']), 0);
    assert.equal(shieldingDice(3, ['shielding']), 2);
    const pen = [{ id: 'wounds', label: 'Wounds', value: 3 }];
    // auto centering (the v922 centering) with the book's grade
    const undo = oldWay({ 'SORCERY_V923.centering': 'v922' });
    try { assert.deepEqual(centeringModifiers(3, ['centering'], pen).map((m) => m.value), [-2]); } finally { undo(); }
  });
  test('dispelling: Force up to the grade, TN the higher of Force and the quickening Karma, 2 successes a Force', (t) => {
    assert.ok(S.dispelGradeProblem(3, 3));
    assert.equal(S.dispelGradeProblem(2, 3), null);
    assert.equal(S.dispelTn(3, 6), 6);
    assert.equal(S.dispelTn(4, 0), 4);
    assert.deepEqual(S.dispelForce(4, 5), { remaining: 2, dispelled: false });
    assert.deepEqual(S.dispelForce(2, 4), { remaining: 0, dispelled: true });
    t.after(oldWay({ 'SORCERY_V923.dispelling': 'v922' }));
    assert.equal(S.dispelGradeProblem(3, 1), null);
    assert.equal(S.dispelTn(3, 6), 3);
  });
  test('centering: always a test, 2 successes take 1 off the penalties', (t) => {
    assert.equal(centeringMode(''), 'test');
    assert.equal(centeringCut(5, 1, 6), 2);
    assert.equal(centeringCut(5, 1, 1), 1);
    t.after(oldWay({ 'SORCERY_V923.centering': 'v922' }));
    assert.equal(centeringMode(''), 'auto');
    assert.equal(centeringCut(5, 1, 6), 1);
  });
  test('geasa: a broken geas is +2 TN each, no Magic lost; v922 the Magic it protects', (t) => {
    const geasa = [{ text: 'a', magic: 1, met: false, checkOnCast: true }, { text: 'b', magic: 1, met: false, checkOnCast: true }, { text: 'c', magic: 1, met: true, checkOnCast: true }];
    assert.equal(geasaPenalty(geasa), 0);
    assert.deepEqual(S.brokenGeasaMods(geasa).map((m) => m.value), [4]);
    t.after(oldWay({ 'SORCERY_V923.geasa': 'v922' }));
    assert.equal(geasaPenalty(geasa), 2);
    assert.deepEqual(S.brokenGeasaMods(geasa), []);
  });
  test('Magic loss: 2D6 at or below Magic loses a point; v922 below', (t) => {
    assert.equal(magicLossOutcome(5, 5).lost, 1);
    assert.equal(magicLossOutcome(6, 5).lost, 0);
    t.after(oldWay({ 'SORCERY_V923.magicLoss': 'v922' }));
    assert.equal(magicLossOutcome(5, 5).lost, 0);
  });
  test('a dispel that wears down the Force passes the GM change check', () => {
    const card = (dispel: any) => ({ actorUpdate: { uuid: 'Actor.x', dispel } });
    assert.ok(gmApplyShapeOk('applyActorUpdate', card({ spellName: 'Armor', force: 4, from: 4, to: 2, mode: 'force' })));
    assert.ok(gmApplyShapeOk('applyActorUpdate', card({ spellName: 'Armor', force: 4, from: 3, to: 1 })));
    assert.ok(!gmApplyShapeOk('applyActorUpdate', card({ spellName: 'Armor', force: 4, from: 4, to: 2, mode: 'other' })));
  });
});

describe('v0.92.3 elementals and detection range', () => {
  test('elemental aid: a pool of Force dice used up, one service when it starts', () => {
    assert.deepEqual(S.elementalAidUse({ force: 5, left: 0 }), { dice: 5, left: 0, service: true, spent: true });
    assert.deepEqual(S.elementalAidUse({ force: 5, left: 0, want: 2 }), { dice: 2, left: 3, service: true, spent: false });
    assert.deepEqual(S.elementalAidUse({ force: 5, left: 3, want: 2 }), { dice: 2, left: 1, service: false, spent: false });
    assert.deepEqual(S.elementalAidUse({ force: 5, left: 1, want: 4 }), { dice: 1, left: 0, service: false, spent: true });
  });
  test('a sense spell reaches successes × Magic metres', () => {
    assert.equal(S.detectionRangeFromTest(3, 5), 15);
    assert.equal(S.detectionRangeFromTest(0, 5), 0);
  });
});

describe('v0.92.3 the Revamp behaves as before', () => {
  test('under the Revamp the book switches change nothing the Revamp sets', (t) => {
    const probe = () => [
      S.ruleOfOneDrainMods(true).map((m) => m.value), S.spellForceBonus({ exclusive: true, fetish: true }), S.learnTnFactor(), S.learnExtraDice(4),
      S.ritualProblem({ category: 'combat', sorcery: [6, 6] }), ritualMaterialsCost(4, 'health'), S.ritualResistTn(3, 5), S.spotterDrains(),
      magicLossOutcome(5, 5).lost, wardPlan(4, 3).drainTn, siteRaiseCost('library', 0, 3).nuyen, resolveCombatSpell({ casterSuccesses: 2, resistSuccesses: 2, level: 'S' }).level,
      S.sustainCapProblem([{}, {}], 2), spellOptionDrainMods({ exclusive: true }).map((m) => m.value), effectiveMagic(6, 3.75),
    ];
    const undo = urrMode();
    const atBook = JSON.stringify(probe());
    undo();
    t.after(urrMode(SORCERY_V922));
    assert.equal(JSON.stringify(probe()), atBook);
  });
});
