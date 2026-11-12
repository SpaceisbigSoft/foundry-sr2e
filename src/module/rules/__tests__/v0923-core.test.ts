/**
 * v0.92.3 book alignment, core mechanics and characters (RULES.CORE_V923, rules/core923.ts): each change is the
 * book's by default, and its switch (or the old value) gives the v0.92.2 result back. The Foundry glue is in
 * src/module/__tests__/v0923-core.test.ts.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  RULES, buildCheck, priorityTable, metatypeChoices, magicChoices, attributePoints, buildPlan, spellPointAllowance, leftoverCash,
  racialModifier, attributeMaximums, attributeKarmaCost, karmaAward, skillCost, newSkillKarma, nativeLanguageRating, freeLanguagePoints,
  timeTaken, webDistance, parseSkillWeb, qualityCheck, haggledPrice, generateNpc, makeRng, statBlockText, fencePrice, karmaAwardTotal,
} from '../index.ts';
import * as C from '../core923.ts';
import { urrCoreAttributeTn, urrCoreSkillTestDice } from '../urr80-core.ts';
import { tnCandidates } from '../situation.ts';
import { socialOneSided } from '../docs79-social-core.ts';
import { toolsModifier } from '../everyday.ts';
import { oldWay } from './oldway.ts';
import { urrMode } from './urrmode.ts';

const attrs = (o: Partial<Record<string, number>> = {}) => ({ body: 3, quickness: 3, strength: 3, charisma: 3, intelligence: 3, willpower: 3, ...o });
const build = (o: any) => buildCheck({ priorities: { race: 'E', magic: 'A', attributes: 'B', skills: 'C', resources: 'D' }, metatype: 'human', magic: 'none', attributes: attrs(), intelligence: 3, activeSkills: [], knowledgeSkills: [], gearCost: 0, nuyen: 0, essence: 6, ...o });
const row = (rows: any[], label: string) => rows.find((r) => r.label === label);

describe('v0.92.3 core: the priority table (Core pp. 45–47)', () => {
  test('the book: attributes 30/24/20/17/15, skills 40/30/24/20/17, Resources 1,000,000 … 500', () => {
    assert.deepEqual(['A', 'B', 'C', 'D', 'E'].map((l) => C.priorityRow(l)), [
      { attributes: 30, skills: 40, resources: 1000000 }, { attributes: 24, skills: 30, resources: 400000 }, { attributes: 20, skills: 24, resources: 90000 },
      { attributes: 17, skills: 20, resources: 5000 }, { attributes: 15, skills: 17, resources: 500 }]);
    const t = priorityTable();
    assert.deepEqual(t.map((r) => r.attributes), [30, 24, 20, 17, 15]);
    assert.match(t[0]!.race, /Troll/);
    assert.equal(t[1]!.race, 'Human', 'a metahuman needs A');
    assert.equal(t[0]!.magic, 'Human magician');
    assert.equal(t[1]!.magic, 'Human adept or aspected / Metahuman magician');
    assert.equal(t[2]!.magic, 'Metahuman adept');
    assert.deepEqual(attributePoints({ body: 4 }, 'B'), { used: 4, allowed: 24, left: 20 });
    const plan = buildPlan({ resources: 'E', magic: 'none', gearCost: 0 });
    assert.equal(plan.nuyen, 500 - (plan.lifestyleCost ?? 0), '¥500 less the builder\'s lifestyle');
  });

  test('race: any metahuman needs A; magic by the race (A human magician, B metahuman magician, C metahuman adept)', () => {
    assert.equal(C.raceNeed('troll'), 'A');
    assert.equal(C.raceNeed('elf'), 'A');
    assert.equal(C.raceNeed('human'), 'E');
    assert.equal(row(build({ metatype: 'dwarf', priorities: { race: 'C', magic: 'A', attributes: 'B', skills: 'D', resources: 'E' } }), 'Race').ok, false);
    assert.equal(row(build({ metatype: 'dwarf', priorities: { race: 'A', magic: 'C', attributes: 'B', skills: 'D', resources: 'E' } }), 'Race').ok, true);
    assert.equal(C.magicTier('A', 'human'), 'full');
    assert.equal(C.magicTier('A', 'elf'), 'none');
    assert.equal(C.magicTier('B', 'elf'), 'full');
    assert.equal(C.magicTier('B', 'human'), 'adept');
    assert.equal(C.magicTier('C', 'troll'), 'adept');
    assert.equal(C.magicTier('C', 'human'), 'none');
    assert.deepEqual(magicChoices('B', 'elf').filter((m) => m.allowed).map((m) => m.key), ['none', 'full', 'adept', 'aspected']);
    assert.deepEqual(magicChoices('C', 'troll').filter((m) => m.allowed).map((m) => m.key), ['none', 'adept', 'aspected']);
    assert.equal(row(build({ metatype: 'elf', magic: 'full', priorities: { race: 'A', magic: 'B', attributes: 'C', skills: 'D', resources: 'E' } }), 'Magic').ok, true);
    assert.equal(metatypeChoices('B', { human: { label: 'Human' }, elf: { label: 'Elf' } }).find((m) => m.key === 'elf')!.allowed, false);
  });

  test('More Metahumans (optional): Race C, Magic A / B for everyone, Karma Pool 1', (t) => {
    t.after(oldWay({ 'CORE_V923.moreMetahumans': true }));
    assert.equal(C.raceNeed('ork'), 'C');
    assert.equal(C.magicTier('A', 'ork'), 'full');
    assert.equal(C.magicTier('B', 'ork'), 'adept');
    assert.equal(C.startingPool('ork'), 1);
  });

  test('Force Points by the Resources priority, 50/35/25/15/5, magicians only', () => {
    assert.deepEqual(['A', 'B', 'C', 'D', 'E'].map((l) => spellPointAllowance({ priority: 'A', tradition: 'hermetic', resources: l })), [50, 35, 25, 15, 5]);
    assert.equal(spellPointAllowance({ priority: 'A', tradition: 'none', resources: 'A' }), 0);
    assert.equal(spellPointAllowance({ priority: 'B', adept: true, resources: 'A' }), 0, 'adepts still get none (STREET_V61.creation.adeptGetsNone)');
    assert.equal(spellPointAllowance({ priority: 'A', tradition: 'hermetic' }), 25, 'no Resources letter given: the old table');
  });

  test('the old table back with the switch', (t) => {
    t.after(oldWay({ 'CORE_V923.priorities': 'old' }));
    assert.deepEqual(C.priorityRow('A'), { attributes: 30, skills: 50, resources: 1000000 });
    assert.equal(C.priorityRow('D').resources, 20000);
    assert.equal(C.raceNeed('elf'), 'C');
    assert.equal(C.magicTier('B', 'elf'), 'adept');
    assert.equal(spellPointAllowance({ priority: 'A', tradition: 'hermetic', resources: 'E' }), 25);
    assert.equal(priorityTable()[0]!.magic, 'Full magician');
  });
});

describe('v0.92.3 core: metatypes (Core pp. 43, 45, 83)', () => {
  test('the dwarf has Quickness −1 and the troll Willpower −1; maximums 5', () => {
    assert.equal(racialModifier('dwarf', 'quickness'), -1);
    assert.equal(racialModifier('troll', 'willpower'), -1);
    assert.equal(attributeMaximums('dwarf', 'quickness').natural, 5);
    assert.equal(attributeMaximums('troll', 'willpower').natural, 5);
    assert.deepEqual(C.racialModsOf('dwarf'), { body: 1, strength: 2, willpower: 1, quickness: -1 });
    const plan = generateNpc({ threat: 2, metatype: 'troll' }, makeRng(7));
    assert.ok(plan.attributes.willpower >= 2, 'the generator keeps every total at 1 or more');
    assert.match(statBlockText(plan), /\S/);
  });

  test('the old modifiers with the switch, and under the Revamp\'s own maximums table', (t) => {
    const undo = oldWay({ 'CORE_V923.racialMods': 'old' });
    assert.equal(racialModifier('dwarf', 'quickness'), 0);
    assert.equal(attributeMaximums('dwarf', 'quickness').natural, 6);
    undo();
    t.after(urrMode());
    assert.equal(racialModifier('dwarf', 'quickness'), 0, 'the Revamp keeps its modifiers');
    assert.equal(attributeMaximums('dwarf', 'quickness').natural, 5, 'and its table gives 5 (not 4)');
  });

  test('troll running × 2; dermal armor as Body dice', (t) => {
    assert.equal(RULES.METATYPES.types['troll']!.run, 2);
    assert.equal(C.dermalArmor(1), 0);
    assert.equal(C.dermalSoakDice(1), 1);
    assert.equal(C.dermalSoakDice(1, true), 0, 'not astral');
    t.after(oldWay({ 'CORE_V923.trollDermal': 'armor' }));
    assert.equal(C.dermalArmor(1), 1);
    assert.equal(C.dermalSoakDice(1), 0);
  });
});

describe('v0.92.3 core: money and languages at creation (Core pp. 46–47)', () => {
  test('unspent nuyen at 10:1; 3D6 × 1,000¥; the old leftover rule with the switch', (t) => {
    assert.deepEqual(leftoverCash(15000), { kept: 1500, lost: 13500, note: '¥15,000 unspent is kept at 10:1: ¥1,500' });
    assert.deepEqual(leftoverCash(9), { kept: 0, lost: 9, note: '¥9 unspent is kept at 10:1: ¥0' });
    assert.deepEqual(C.startingCashRoll(), { formula: '3d6', per: 1000 });
    t.after(oldWay({ 'CORE_V923.leftoverCash': 'old', 'CORE_V923.startingCash': 'none' }));
    assert.deepEqual(leftoverCash(15000), { kept: 15000, lost: 0, note: '' });
    assert.equal(C.startingCashRoll(), null);
  });

  test('the native language at Intelligence + 2; a Street lifestyle\'s free dialect', (t) => {
    assert.equal(nativeLanguageRating(5), 7);
    assert.equal(freeLanguagePoints(5, 7), 7);
    assert.equal(C.streetDialectRating(5, 'street'), 2);
    assert.equal(C.streetDialectRating(5, 'low'), 0);
    const knowledge = [{ name: 'City Speak', rating: 2 }, { name: 'Magic Theory', rating: 3 }];
    const skills = (lifestyle: string) => row(build({ intelligence: 5, knowledgeSkills: knowledge, lifestyle }), 'Skills').used;
    assert.equal(skills('street'), '3 points');
    assert.equal(skills('low'), '5 points');
    t.after(oldWay({ 'CORE_V923.nativeLanguage': 'old', 'CORE_V923.streetDialect': 'off' }));
    assert.equal(nativeLanguageRating(5), 5);
    assert.equal(skills('street'), '5 points');
  });

  test('the starting Karma Pool: metahuman 2, human 1; nothing with the switch', (t) => {
    assert.equal(C.startingPool('troll'), 2);
    assert.equal(C.startingPool('human'), 1);
    assert.deepEqual(C.startPoolPatch('elf', 1), { 'system.karma.pool': 2 });
    assert.deepEqual(C.startPoolPatch('elf', 3), {}, 'never lowered');
    t.after(oldWay({ 'CORE_V923.startPool': 'old' }));
    assert.deepEqual(C.startPoolPatch('elf', 1), {});
  });
});

describe('v0.92.3 core: Karma (Core pp. 190–191; Companion p. 76)', () => {
  test('attributes at new rating × 1; past the maximum at double with the GM\'s leave', (t) => {
    assert.equal(RULES.UPKEEP.karma.attributeMultiplier, 1);
    assert.deepEqual(attributeKarmaCost({ to: 6, max: 6, augmented: 9 }), { cost: 6, ok: true, reason: '', band: 'normal' });
    assert.deepEqual(attributeKarmaCost({ to: 7, max: 6, augmented: 9 }), { cost: 14, ok: true, reason: '', band: 'aboveRacial' });
    assert.equal(attributeKarmaCost({ to: 10, max: 6, augmented: 9 }).ok, false);
    t.after(oldWay({ 'CORE_V923.aboveMax': 'refuse', 'UPKEEP.karma.attributeMultiplier': 2 }));
    assert.equal(attributeKarmaCost({ to: 6, max: 6 }).cost, 12);
    assert.equal(attributeKarmaCost({ to: 7, max: 6, augmented: 9 }).ok, false);
  });

  test('under the Revamp the dearer band (× 3) still wins past the maximum', (t) => {
    t.after(urrMode());
    assert.deepEqual(attributeKarmaCost({ to: 7, max: 6, augmented: 9 }), { cost: 21, ok: true, reason: '', band: 'aboveRacial' });
  });

  test('the Karma Pool: 10 to Good Karma, the next to the pool, for everyone', (t) => {
    assert.deepEqual(karmaAward({ careerBefore: 0, amount: 11, metahuman: false }), { good: 10, pool: 1, career: 11 });
    assert.deepEqual(karmaAward({ careerBefore: 0, amount: 11, metahuman: true }), { good: 10, pool: 1, career: 11 });
    assert.deepEqual(karmaAward({ careerBefore: 0, amount: 10, metahuman: true }), { good: 10, pool: 0, career: 10 });
    t.after(oldWay({ 'UPKEEP.karma.poolEvery.human': 10, 'UPKEEP.karma.poolEvery.metahuman': 20 }));
    assert.deepEqual(karmaAward({ careerBefore: 0, amount: 11, metahuman: true }), { good: 11, pool: 0, career: 11 });
  });

  test('languages × 1, knowledge as a general skill, a new skill\'s first point 1', (t) => {
    assert.equal(skillCost({ to: 4, attribute: 5, kind: 'language' }), 4);
    assert.equal(skillCost({ to: 4, attribute: 5, kind: 'knowledge' }), 8);
    assert.equal(skillCost({ to: 4, attribute: 5, kind: 'knowledge', concentration: true }), 6);
    assert.equal(skillCost({ to: 4, attribute: 5, kind: 'knowledge', specialization: true }), 4);
    assert.equal(C.newSkillCost(0, 1), 1);
    assert.equal(C.newSkillCost(1, 2), null);
    assert.equal(newSkillKarma({ rating: 2, attribute: 4, kind: 'active' }), 1 + 4);
    t.after(oldWay({ 'CORE_V923.skillKarma': 'old', 'CORE_V923.newSkill': 'old', 'DOCS_V79.skillKarma.mode': 'bands' }));
    assert.equal(skillCost({ to: 3, attribute: 4, kind: 'knowledge' }), 3, 'the old Intelligence bands');
    assert.equal(C.newSkillCost(0, 1), null);
  });

  test('Karma Pool dice: up to the test\'s own dice; none with the switch; the Revamp\'s no-cap rule wins', (t) => {
    assert.equal(C.karmaDiceFor(5, 3, 2), 2);
    assert.equal(C.karmaDiceFor(1, 3, 4), 1);
    assert.match(C.karmaDiceRow(3, true, 2), /max="2"/);
    assert.equal(C.karmaDiceRow(3, false, 2), '');
    const undo = oldWay({ 'CORE_V923.karmaDice': 'off' });
    assert.equal(C.karmaDiceFor(5, 3, 2), 0);
    assert.equal(C.karmaDiceRow(3, true, 2), '');
    undo();
    t.after(urrMode());
    assert.equal(C.karmaDiceFor(5, 3, 2), 3);
  });

  test('no more Karma after avoiding a disaster; the refresh at the end of a combat; flaws cost 10 × to eliminate', (t) => {
    assert.equal(C.karmaAfterOops(true), false);
    assert.equal(C.karmaAfterOops(false), true);
    assert.equal(RULES.KARMA.refresh, 'combat');
    assert.equal(RULES.STREET.qualities.karma.flawPerPoint, 10);
    t.after(oldWay({ 'CORE_V923.afterOops': 'old' }));
    assert.equal(C.karmaAfterOops(true), true);
  });

  test('training days: the Karma spent × 7, × 15 for knowledge and language (timed training)', (t) => {
    assert.equal(C.trainingDaysByKarma({ kind: 'active', cost: 8 }), 56);
    assert.equal(C.trainingDaysByKarma({ kind: 'knowledge', cost: 4 }), 60);
    assert.equal(C.trainingDaysByKarma({ kind: 'attribute', cost: 6 }), 42);
    assert.equal(C.trainingDaysByKarma({ kind: 'concentration', skillKind: 'language', cost: 2 }), 30);
    t.after(oldWay({ 'CORE_V923.trainingTime': 'rating' }));
    assert.equal(C.trainingDaysByKarma({ kind: 'active', cost: 8 }), null);
  });
});

describe('v0.92.3 core: tests (Core p. 68)', () => {
  test('time ÷ successes to the nearest whole unit', (t) => {
    assert.equal(timeTaken(10, 'hours', 3).value, 3);
    assert.equal(timeTaken(10, 'hours', 4).value, 3, '2.5 → 3');
    assert.equal(timeTaken(8, 'hours', 3).value, 3, '2.66 → 3');
    assert.equal(timeTaken(1, 'hours', 3).value, 1, 'at least one unit');
    assert.equal(timeTaken(0, 'hours', 3).value, 0);
    t.after(oldWay({ 'CORE_V923.timeRounding': 'tenth' }));
    assert.equal(timeTaken(10, 'hours', 4).value, 2.5);
  });

  test('attribute defaulting traces the web (+2 a circle); arrows block; no step cap', (t) => {
    const links = parseSkillWeb('Quickness - Athletics: 1\nIntelligence - Demolitions: 3\nFirearms > Gunnery: 1\nGunnery - Car: 2\nCar - Bike: 1');
    assert.deepEqual(urrCoreAttributeTn(links, 'Athletics', 'quickness'), { attributeTn: 2 });
    assert.deepEqual(urrCoreAttributeTn(links, 'Demolitions', 'intelligence'), { attributeTn: 6 });
    assert.deepEqual(urrCoreSkillTestDice({ rating: 0, attributeRating: 4, attributeTn: 2 }).modifier, { id: 'defaultingToAttributeSkillWeb', label: 'Defaulting to attribute (Skill Web)', value: 2 });
    assert.equal(webDistance(links, 'Firearms', 'Gunnery'), null, 'against the arrow');
    assert.equal(webDistance(links, 'Gunnery', 'Firearms'), 1);
    assert.equal(webDistance(links, 'Bike', 'Firearms'), 4, 'no 3-step cap');
    t.after(oldWay({ 'CORE_V923.attributeDefault': 'flat', 'CORE_V923.webArrows': 'old', 'SKILLS.web.maxSteps': 3 }));
    assert.deepEqual(urrCoreAttributeTn(links, 'Athletics', 'quickness'), {});
    assert.equal(webDistance(links, 'Firearms', 'Gunnery'), 1);
    assert.equal(webDistance(links, 'Bike', 'Firearms'), null);
  });

  test('language TNs 2/4/6/9/11 and a dialect +2', (t) => {
    assert.deepEqual(C.languageTable().map((r) => r.tn), [2, 4, 6, 9, 11]);
    assert.equal(C.dialectModifier()!.value, 2);
    t.after(oldWay({ 'CORE_V923.languageTns': 'old' }));
    assert.deepEqual(C.languageTable().map((r) => r.tn), [3, 4, 6, 8]);
    assert.equal(C.dialectModifier(), null);
  });
});

describe('v0.92.3 core: perception (Core p. 185; Companion p. 90)', () => {
  test('the book: Intelligence vs 4, one success; the Companion: + 1 per Stealth success', (t) => {
    assert.equal(C.perceptionMode(), 'book');
    assert.deepEqual(C.bookPerceptionTargets({ stealthSuccesses: 3 }), { observerTn: 4, sneakerTn: 0 });
    assert.equal(C.bookNoticed(1), true);
    assert.equal(C.bookNoticed(0), false);
    const undo = oldWay({ 'CORE_V923.perception': 'companion' });
    assert.deepEqual(C.bookPerceptionTargets({ stealthSuccesses: 3 }), { observerTn: 7, sneakerTn: 4 });
    assert.deepEqual(C.stealthTnModifier(2), { id: 'stealthSuccesses', label: "The sneaker's Stealth successes", value: 2 });
    undo();
    t.after(oldWay({ 'CORE_V923.perception': 'opposed' }));
    assert.equal(C.perceptionMode(), 'opposed');
  });

  test('the sound, smell, touch and taste rows join the house rows; the Revamp\'s own list is left alone', (t) => {
    const ids = C.perceptionRows().map((r) => r.id);
    assert.ok(ids.includes('noisy') && ids.includes('grenade') && ids.includes('sameFloor'));
    assert.equal(C.perceptionRows().find((r) => r.id === 'floorsAway')!.value, 6);
    assert.ok(tnCandidates('perceive').some((g) => g.rows.some((r) => r.id === 'grenade')), 'the GM\'s TN checklist too');
    const undo = oldWay({ 'CORE_V923.perceptionSounds': 'off' });
    assert.deepEqual(C.perceptionRows(), RULES.STREET.perception);
    undo();
    t.after(urrMode());
    assert.deepEqual(C.perceptionRows(), RULES.STREET.perception, 'the Revamp list has its own sense rows');
  });
});

describe('v0.92.3 core: NPCs, the street and athletics', () => {
  test('Threat dice on every test (book); the Combat Pool way with the switch', (t) => {
    assert.equal(C.threatDice({ npc: true, threatRating: 3 }), 3);
    assert.equal(C.threatDice({ npc: false, threatRating: 3 }), 0);
    t.after(oldWay({ 'CORE_V923.threat': 'pool' }));
    assert.equal(C.threatDice({ npc: true, threatRating: 3 }), 0);
  });

  test('morale: withdraws at the Professional Rating\'s wound (1 L, 2 M, 3 S, 4 never)', (t) => {
    assert.equal(C.moraleWound(1), 'L');
    assert.equal(C.moraleWound(3), 'S');
    assert.equal(C.moraleWound(4), null);
    assert.equal(C.moraleWithdraws(2, 'L', 'M'), true);
    assert.equal(C.moraleWithdraws(2, 'M', 'S'), false, 'only when it first reaches the level');
    assert.equal(C.moraleWithdraws(2, null, 'L'), false);
    assert.equal(C.moraleWithdraws(1, null, 'D'), true);
    t.after(oldWay({ 'CORE_V923.morale': 'old' }));
    assert.equal(C.moraleWithdraws(2, 'L', 'M'), false);
  });

  test('recognition: (1,000 − rep) ÷ 50', (t) => {
    assert.equal(C.recognitionTnBook(0), 20);
    assert.equal(C.recognitionTnBook(500), 10);
    assert.equal(C.recognitionTnBook(990), 2, 'never below 2');
    assert.equal(C.recognitionBook(), true);
    t.after(oldWay({ 'CORE_V923.recognition': 'old' }));
    assert.equal(C.recognitionBook(), false);
  });

  test('climbing ¼ × (the Quickness and Strength average + 2 a success); swimming a fifth of a run; the climb TNs 3/5/8/14', (t) => {
    assert.deepEqual(RULES.STREET.athletics.climb.map((c) => c.tn), [3, 5, 8, 14]);
    assert.equal(C.athleticsDistanceBook('climb', 2, { quickness: 4, strength: 4, runMultiplier: 3 }), 2);
    assert.equal(C.athleticsDistanceBook('climb', 0, { quickness: 5, strength: 6, runMultiplier: 3 }), 1);
    assert.equal(C.athleticsDistanceBook('swim', 1, { quickness: 4, strength: 4, runMultiplier: 3 }), 3);
    assert.equal(C.athleticsDistanceBook('jump', 1, { quickness: 4, strength: 4, runMultiplier: 3 }), null);
    assert.deepEqual(C.climbModifierRows().map((r) => r.value), [2, 4, 2, 4]);
    t.after(oldWay({ 'CORE_V923.athletics': 'old' }));
    assert.equal(C.athleticsDistanceBook('climb', 2, { quickness: 4, strength: 4, runMultiplier: 3 }), null);
    assert.deepEqual(C.climbModifierRows(), []);
  });

  test('edges and flaws come to 0 (no per-side cap); the old caps and balance with the switch', (t) => {
    const on = oldWay({ 'STREET.qualities.enabled': true });
    t.after(on);
    const q = (e: number, f: number) => [{ name: 'E', kind: 'edge' as const, points: e }, { name: 'F', kind: 'flaw' as const, points: f }];
    assert.equal(qualityCheck(q(6, 6))!.ok, true);
    assert.equal(qualityCheck(q(2, 3))!.ok, false, 'surplus flaws only with the house rule');
    assert.equal(qualityCheck(q(3, 2))!.ok, false);
    t.after(oldWay({ 'CORE_V923.qualities': 'old' }));
    assert.equal(qualityCheck(q(6, 6))!.ok, false, 'over the old cap of 5');
    assert.equal(qualityCheck(q(2, 3))!.ok, true);
  });

  test('haggling keeps its cap; the seller\'s TN is the buyer\'s Willpower (book)', (t) => {
    assert.equal(haggledPrice(1000, 10).percent, RULES.STREET.haggle.maxPercent);
    assert.equal(C.haggleBook(), true);
    t.after(oldWay({ 'CORE_V923.haggle': 'old' }));
    assert.equal(C.haggleBook(), false);
  });

  test('fencing: each side vs the other\'s Willpower + 2; a fence pays at least 10%', (t) => {
    assert.deepEqual(C.fenceTns({ fenceWillpower: 4, sellerWillpower: 5, tn: 4 }), { mine: 6, theirs: 7 });
    assert.deepEqual(fencePrice(1000, -10), { price: 100, percent: 10 });
    t.after(oldWay({ 'CORE_V923.fence': 'old' }));
    assert.deepEqual(C.fenceTns({ fenceWillpower: 4, sellerWillpower: 5, tn: 4 }), { mine: 4, theirs: 4 });
    assert.deepEqual(fencePrice(1000, -10), { price: 0, percent: 0 });
  });

  test('the individual Karma awards are the book\'s (Core p. 199)', (t) => {
    assert.deepEqual(C.individualAwardRows().map((r) => r.id), ['roleplaying', 'guts', 'smarts', 'rightPlace', 'surprise', 'humor', 'drama']);
    assert.deepEqual(karmaAwardTotal({ team: { survival: 1 }, individual: { roleplaying: 2, guts: true, drama: true } }).individual, 4);
    t.after(oldWay({ 'CORE_V923.awards': 'old' }));
    assert.ok(C.individualAwardRows().some((r) => r.id === 'courage'));
  });

  test('Interrogation is one-sided: the interrogator vs the subject\'s Willpower (Core p. 73)', (t) => {
    assert.equal(socialOneSided('Interrogation'), true);
    assert.equal(socialOneSided('Intimidation'), false);
    t.after(oldWay({ 'CORE_V923.interrogation': 'old' }));
    assert.equal(socialOneSided('Interrogation'), false);
  });

  test('a Build/Repair job without tools is not allowed (Core p. 183); the +4 TN with the old value', (t) => {
    assert.equal(toolsModifier('kit', 'none').blocked, true);
    assert.equal(toolsModifier('kit', 'none').modifier, null);
    t.after(oldWay({ 'CHARACTERS_V58.tools.none': 'tn' }));
    assert.equal(toolsModifier('kit', 'none').blocked, false);
    assert.equal(toolsModifier('kit', 'none').modifier!.value, 4);
  });
});
