/**
 * v0.80.0 (core): the "SR2E Unified Rules Revamp" pure functions (rules/urr80-core.ts), under the Revamp (urrMode)
 * and with the shipped values (the SR2E Book Rules). The wiring into existing functions is checked in
 * src/module/__tests__/v080-core.test.ts.
 */
import { test, describe } from 'node:test';
import assert from '../../__tests__/helpers/assert-rows.ts';
import { RULES } from '../config.ts';
import { urrMode } from './urrmode.ts';
import { oldWay } from './oldway.ts';
import { URR_V80_CORE, URR80_PATCH_CORE } from '../config80-core.ts';
import { skillTestDice, type WebLink } from '../skills.ts';
import {
  urrCoreCriticals, urrCoreCriticalNote, urrCoreTnPresets, urrCoreTnPresetRow, urrCoreKnowledgeCard, urrCoreKnowledgeText, urrCoreOpposed,
  urrCoreKarmaDice, urrCoreKarmaDiceRow, urrCoreStartPool, urrCoreKarmaAward, urrCoreMaxAdjust, urrCoreEssenceRound, urrCoreSkillTestDice,
  urrCoreAttributeTn, urrCoreNativeBonus, urrCoreSkillCost, urrCoreTrainingDays, urrCoreInstruction, urrCoreInstructExtra, urrCoreInstructorRule,
  urrCoreFindMods, urrCoreHaggleSellerTn,
} from '../urr80-core.ts';

const die = (total: number) => ({ faces: [total], total, success: false });

describe('v0.80.0 core: the switches ship at the book way', () => {
  test('every core switch is off, and the patch turns it on', () => {
    const V = RULES.URR_V80 as any;
    for (const [k, v] of Object.entries(URR_V80_CORE)) assert.deepEqual(V[k], v, k);
    assert.equal(V.coreTies, 'none');
    assert.equal(V.coreKarmaGrowth, 'career');
    assert.equal(V.coreTraining, 'book');
    assert.equal(V.coreNativeBonus, 0);
    assert.equal(V.coreFindTn, 0);
    for (const k of Object.keys(URR80_PATCH_CORE)) assert.ok(k.startsWith('URR_V80.core') || !k.startsWith('URR_V80.'), `${k} has the core prefix`);
  });
});

describe('v0.80.0 core: dice and tests', () => {
  test('critical successes: one per full 6 over the TN (Revamp); none in the book', (t) => {
    const dice = [die(4), die(10), die(11), die(17), die(2)];
    assert.equal(urrCoreCriticals(dice, 4), 0);
    assert.equal(urrCoreCriticalNote(dice, 4), '');
    t.after(urrMode());
    assert.equal(urrCoreCriticals(dice, 4), 0 + 1 + 1 + 2 + 0);
    assert.match(urrCoreCriticalNote(dice, 4), /^4 critical successes/);
    assert.match(urrCoreCriticalNote([die(10)], 4), /^1 critical success \(/);
    assert.equal(urrCoreCriticalNote(dice, 4, true), '', 'not on a botch');
    assert.equal(urrCoreCriticalNote([die(9)], 4), '');
  });

  test('TN presets: the difficulty table, the knowledge table for knowledge skills; none in the book', (t) => {
    assert.deepEqual(urrCoreTnPresets(), []);
    assert.equal(urrCoreTnPresetRow('knowledge'), '');
    assert.equal(urrCoreKnowledgeCard('knowledge'), false);
    t.after(urrMode());
    assert.deepEqual(urrCoreTnPresets().map((r) => r.tn), [2, 3, 4, 5, 6, 8, 9, 10]);
    assert.deepEqual(urrCoreTnPresets('knowledge').map((r) => r.tn), [3, 5, 8, 12]);
    assert.deepEqual(urrCoreTnPresets('active').map((r) => r.tn), [2, 3, 4, 5, 6, 8, 9, 10]);
    assert.match(urrCoreTnPresetRow(), /name="tnPreset".*Difficulty|Difficulty.*name="tnPreset"/s);
    assert.match(urrCoreTnPresetRow('knowledge'), /Information sought.*value="12"/s);
    assert.equal(urrCoreKnowledgeCard('knowledge'), true);
    assert.equal(urrCoreKnowledgeCard('knowledge', true), false);
    assert.equal(urrCoreKnowledgeCard('active'), false);
    assert.equal(urrCoreKnowledgeText(0), 'Nothing useful.');
    assert.match(urrCoreKnowledgeText(1), /general picture/);
    assert.match(urrCoreKnowledgeText(2), /wrong/);
    assert.match(urrCoreKnowledgeText(3), /unclear or missing/);
    assert.match(urrCoreKnowledgeText(6), /Full and accurate/);
  });

  test('presets one at a time: difficulty off, knowledge on', (t) => {
    t.after(oldWay({ 'URR_V80.coreKnowledgeTest': true }));
    assert.deepEqual(urrCoreTnPresets(), []);
    assert.deepEqual(urrCoreTnPresets('knowledge').map((r) => r.tn), [3, 5, 8, 12]);
  });

  test('opposed ties go to the side that made the test, with a success (Revamp); a stand-off in the book', (t) => {
    assert.deepEqual(urrCoreOpposed(2, 2), { winner: 'none', net: 0 });
    assert.deepEqual(urrCoreOpposed(3, 1), { winner: 'initiator', net: 2 });
    t.after(urrMode());
    assert.deepEqual(urrCoreOpposed(2, 2), { winner: 'initiator', net: 0 });
    assert.deepEqual(urrCoreOpposed(0, 0), { winner: 'none', net: 0 });
    assert.deepEqual(urrCoreOpposed(1, 3), { winner: 'defender', net: 2 });
    assert.deepEqual(urrCoreOpposed(3, 1), { winner: 'initiator', net: 2 });
  });
});

describe('v0.80.0 core: Karma Pool', () => {
  test('buying dice: up to the pool left (Revamp); none in the book', (t) => {
    assert.equal(urrCoreKarmaDice(3, 5), 0);
    assert.equal(urrCoreKarmaDiceRow(5), '');
    t.after(urrMode());
    assert.equal(urrCoreKarmaDice(3, 5), 3);
    assert.equal(urrCoreKarmaDice(3, 2), 2);
    assert.equal(urrCoreKarmaDice(undefined, 2), 0);
    assert.equal(urrCoreKarmaDice(-1, 2), 0);
    assert.match(urrCoreKarmaDiceRow(2), /name="karmaDice".*max="2"/s);
    assert.equal(urrCoreKarmaDiceRow(0), '');
    assert.equal(urrCoreKarmaDiceRow(3, false), '', 'not when defaulting');
  });

  test('starting pool: 2 for a metahuman (Revamp); unchanged in the book', (t) => {
    assert.deepEqual(urrCoreStartPool('troll', 1), {});
    t.after(urrMode());
    assert.deepEqual(urrCoreStartPool('troll', 1), { 'system.karma.pool': 2 });
    assert.deepEqual(urrCoreStartPool('elf', 0), { 'system.karma.pool': 2 });
    assert.deepEqual(urrCoreStartPool('human', 1), {});
    assert.deepEqual(urrCoreStartPool(undefined, 1), {});
    assert.deepEqual(urrCoreStartPool('ork', 3), {}, 'never lowered');
  });

  test('growth: each award, the first point to the pool and the next 10 to Good Karma (Revamp); null in the book', (t) => {
    assert.equal(urrCoreKarmaAward({ careerBefore: 0, amount: 5 }), null);
    t.after(urrMode());
    assert.deepEqual(urrCoreKarmaAward({ careerBefore: 0, amount: 5 }), { good: 4, pool: 1, career: 5 });
    assert.deepEqual(urrCoreKarmaAward({ careerBefore: 30, amount: 11 }), { good: 10, pool: 1, career: 41 });
    assert.deepEqual(urrCoreKarmaAward({ careerBefore: 0, amount: 12 }), { good: 10, pool: 2, career: 12 });
    assert.deepEqual(urrCoreKarmaAward({ careerBefore: 0, amount: 23 }), { good: 20, pool: 3, career: 23 });
    assert.deepEqual(urrCoreKarmaAward({ careerBefore: 0, amount: 0 }), { good: 0, pool: 0, career: 0 });
  });
});

describe('v0.80.0 core: attributes', () => {
  test('natural maximums: dwarf Quickness and troll Willpower −1 (Revamp); 0 in the book', (t) => {
    assert.equal(urrCoreMaxAdjust('dwarf', 'quickness'), 0);
    t.after(urrMode());
    assert.equal(urrCoreMaxAdjust('dwarf', 'quickness'), -1);
    assert.equal(urrCoreMaxAdjust('troll', 'willpower'), -1);
    assert.equal(urrCoreMaxAdjust('troll', 'quickness'), 0);
    assert.equal(urrCoreMaxAdjust('human', 'body'), 0);
    assert.equal(urrCoreMaxAdjust(null, 'body'), 0);
  });

  test('Essence for Magic: rounded down (Revamp), up in the book', (t) => {
    assert.equal(urrCoreEssenceRound(4.2), 5);
    t.after(urrMode());
    assert.equal(urrCoreEssenceRound(4.2), 4);
    assert.equal(urrCoreEssenceRound(5), 5);
  });

  test('the patch: attribute × 1.5, past the maximum allowed, the Skill Web unlimited', (t) => {
    assert.equal(RULES.UPKEEP.karma.attributeMultiplier, 2);
    assert.equal(RULES.CHARACTERS_V73.qualities.karmaAboveRacial.enabled, false);
    assert.equal(RULES.SKILLS.web.maxSteps, 3);
    t.after(urrMode());
    assert.equal(RULES.UPKEEP.karma.attributeMultiplier, 1.5);
    assert.equal(RULES.CHARACTERS_V73.qualities.karmaAboveRacial.enabled, true);
    assert.equal(RULES.CHARACTERS_V73.qualities.karmaAboveRacial.multiplier, 3);
    assert.equal(RULES.SKILLS.web.maxSteps, 99);
  });
});

describe('v0.80.0 core: skills and the Skill Web', () => {
  const base = { rating: 0, attributeRating: 4, concentrationRating: 3, specializationRating: 5 };

  test('defaulting from a concentration (+2) or specialization (+3) (Revamp); the book defaults to the attribute', (t) => {
    assert.deepEqual(urrCoreSkillTestDice(base), skillTestDice(base));
    assert.equal(urrCoreSkillTestDice(base).using, 'attribute');
    t.after(urrMode());
    assert.deepEqual(urrCoreSkillTestDice(base), { dice: 3, modifier: { label: 'Defaulting from the concentration', value: 2 }, using: 'concentration' });
    assert.deepEqual(urrCoreSkillTestDice({ ...base, concentrationRating: 0 }), { dice: 5, modifier: { label: 'Defaulting from the specialization', value: 3 }, using: 'specialization' });
    assert.equal(urrCoreSkillTestDice({ ...base, related: { name: 'Other', rating: 2 } }).using, 'related', 'a chosen related skill still counts');
    assert.equal(urrCoreSkillTestDice({ ...base, rating: 2 }).using, 'skill');
  });

  test('the attribute traced through the web (Revamp); the flat TN in the book', (t) => {
    const links: WebLink[] = [{ a: 'Quickness', b: 'Firearms', steps: 2 }];
    assert.deepEqual(urrCoreAttributeTn(links, 'Firearms', 'quickness'), {});
    const plain = { rating: 0, attributeRating: 4 };
    assert.deepEqual(urrCoreSkillTestDice({ ...plain, attributeTn: 4 }), skillTestDice(plain), 'ignored in the book');
    t.after(urrMode());
    assert.deepEqual(urrCoreAttributeTn(links, 'Firearms', 'quickness'), { attributeTn: 4 });
    assert.deepEqual(urrCoreAttributeTn([{ a: 'Quickness', b: 'Firearms', steps: 1 }], 'Firearms', 'quickness'), { attributeTn: 2 });
    assert.deepEqual(urrCoreAttributeTn(links, 'Firearms', 'strength'), {});
    assert.deepEqual(urrCoreAttributeTn([], 'Firearms', 'quickness'), {});
    assert.deepEqual(urrCoreSkillTestDice({ ...plain, attributeTn: 2 }).modifier, { label: 'Defaulting to attribute (Skill Web)', value: 2 });
    assert.deepEqual(urrCoreSkillTestDice(plain).modifier, { label: 'Defaulting to attribute', value: RULES.ATTRIBUTE_DEFAULT_TN_MOD });
  });

  test('native language +2 and languages at × 1 (Revamp); the book unchanged', (t) => {
    assert.equal(urrCoreNativeBonus(), 0);
    assert.equal(urrCoreSkillCost({ to: 4, kind: 'language' }), null);
    t.after(urrMode());
    assert.equal(urrCoreNativeBonus(), 2);
    assert.equal(urrCoreSkillCost({ to: 4, kind: 'language' }), 4);
    assert.equal(urrCoreSkillCost({ to: 4, kind: 'knowledge' }), null);
    assert.equal(urrCoreSkillCost({ to: 4, kind: 'language', specialization: true }), null);
  });
});

describe('v0.80.0 core: training', () => {
  test('training days: Karma × 8 h at 4 h (or Willpower) a day (Revamp); null in the book', (t) => {
    assert.equal(urrCoreTrainingDays({ cost: 8, willpower: 3 }), null);
    t.after(urrMode());
    assert.equal(urrCoreTrainingDays({ cost: 8, willpower: 3 }), 16);
    assert.equal(urrCoreTrainingDays({ cost: 8, willpower: 6 }), 11);
    assert.equal(urrCoreTrainingDays({ cost: 0 }), RULES.CHARACTERS_V58.training.minimumDays);
  });

  test('instructors: rating + 2, none for attributes, ÷ (1 + successes) (Revamp); null in the book', (t) => {
    assert.equal(urrCoreInstruction({ days: 16, successes: 1, instructorRating: 5, newRating: 4 }), null);
    assert.deepEqual(urrCoreInstructExtra({ attribute: 'body' }), {});
    assert.match(urrCoreInstructorRule(), /must reach the new rating/);
    t.after(urrMode());
    const low = urrCoreInstruction({ days: 16, successes: 3, instructorRating: 5, newRating: 4 })!;
    assert.equal(low.usable, false);
    assert.equal(low.days, 16);
    assert.deepEqual(urrCoreInstruction({ days: 16, successes: 3, instructorRating: 6, newRating: 4 }), { days: 4, usable: true, note: '16 days ÷ (1 + 3 successes) = 4 days.' });
    assert.equal(urrCoreInstruction({ days: 16, successes: 1, instructorRating: 1, newRating: 5, attribute: true })!.days, 8);
    assert.equal(urrCoreInstruction({ days: 16, successes: 0, instructorRating: 9, newRating: 4 })!.days, 16);
    assert.deepEqual(urrCoreInstructExtra({ attribute: 'body' }), { attribute: true });
    assert.deepEqual(urrCoreInstructExtra({ attribute: '' }), { attribute: false });
    assert.match(urrCoreInstructorRule(), /new rating \+ 2/);
  });
});

describe('v0.80.0 core: gear', () => {
  test('finding gear +2 and haggling against the buyer\'s Intelligence (Revamp); the book unchanged', (t) => {
    assert.deepEqual(urrCoreFindMods(), []);
    assert.equal(urrCoreHaggleSellerTn(6), RULES.STREET.haggle.tn);
    t.after(urrMode());
    assert.deepEqual(urrCoreFindMods(), [{ label: 'Acquisition', value: 2 }]);
    assert.equal(urrCoreHaggleSellerTn(6), 6);
    assert.equal(urrCoreHaggleSellerTn(1), Math.max(RULES.MIN_TARGET_NUMBER, 1));
    assert.equal(urrCoreHaggleSellerTn(0), RULES.STREET.haggle.tn);
  });
});
