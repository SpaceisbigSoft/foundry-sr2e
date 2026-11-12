import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { RULES } from '../config.ts';
import { oldWay } from './oldway.ts';
import {
  noticeTest, noticeReveal, timeTaken, toolsModifier, bestTools, gearRepairPlan, contactLevelCost, contactsCost, lifestyleCost,
  nativeLanguageRating, readWriteRating, languageReveal, freeLanguagePoints, trainingDays, instructionResult, trainingReadyAt,
  negotiatedPay, karmaAwardTotal, recognitionTn, naturalReaction, skillAttributeRating, vehicleSkillAttribute,
} from '../everyday.ts';
import { buildPlan, streetCred } from '../street.ts';
import { buildCheck, type BuildInput } from '../creation.ts';

const withRule = (obj: any, key: string, value: unknown, fn: () => void) => { const old = obj[key]; obj[key] = value; try { fn(); } finally { obj[key] = old; } };
const V = RULES.CHARACTERS_V58 as any;

describe('v0.58.0 plain Perception', () => {
  test('dice, base TN and the obviousness row', (t) => {
    t.after(oldWay({ 'DOCS_V79.perceptionSightBook': 'scale' })); // v0.79.0: the old scale (a house rule)
    assert.deepEqual(noticeTest({ intelligence: 4, obviousness: 'hidden' }), { dice: 4, tn: 4, modifiers: [{ label: 'Obviousness: Hidden', value: 4 }] });
    assert.deepEqual(noticeTest({ intelligence: 4, obviousness: 'obvious' }).modifiers, [{ label: 'Obviousness: Obvious', value: -2 }]);
  });
  test('normal and unknown obviousness add nothing; extra dice; never negative dice', () => {
    assert.deepEqual(noticeTest({ intelligence: 3 }).modifiers, []);
    assert.deepEqual(noticeTest({ intelligence: 3, obviousness: 'bogus' }).modifiers, []);
    assert.equal(noticeTest({ intelligence: 3, extra: 2 }).dice, 5);
    assert.equal(noticeTest({ intelligence: -2 }).dice, 0);
    withRule(V.notice, 'baseTn', 5, () => assert.equal(noticeTest({ intelligence: 3 }).tn, 5));
  });
  test('what successes reveal', () => {
    assert.equal(noticeReveal(0), 'Notices nothing.');
    assert.equal(noticeReveal(-1), 'Notices nothing.');
    // v0.79.0 docs check: the SR2 p. 185 Perception Success Table.
    assert.equal(noticeReveal(1), 'Something is there, but little else.');
    assert.equal(noticeReveal(2), 'Something is definitely there; suspects the kind of thing it is.');
    assert.equal(noticeReveal(3), 'Knows what kind of thing it is and suspects its exact nature.');
    assert.equal(noticeReveal(9), 'Knows what it is, but no specifics without further information or examination.');
  });
});

describe('v0.58.0 time ÷ successes', () => {
  test('divides and labels', (tt) => {
    // v0.92.3: the old (v0.92.2) rule this test pins (RULES.CORE_V923 / book alignment).
    tt.after(oldWay({ 'CORE_V923.timeRounding': 'tenth' }));
    assert.deepEqual(timeTaken(5, 'hours', 2), { ok: true, value: 2.5, unit: 'hours', label: '2.5 hours (5 hours ÷ 2)', seconds: 9000 });
    assert.equal(timeTaken(10, 'turns', 1).label, '10 Combat Turns (10 Combat Turns ÷ 1)');
  });
  test('rounds up to roundTo without float noise', (tt) => {
    // v0.92.3: the old (v0.92.2) rule this test pins (RULES.CORE_V923 / book alignment).
    tt.after(oldWay({ 'CORE_V923.timeRounding': 'tenth' }));
    assert.equal(timeTaken(1, 'hours', 3).value, 0.4);           // 0.333… → 0.4
    assert.equal(timeTaken(0.9, 'hours', 3).value, 0.3);         // not 0.30000000000000004
    assert.equal(timeTaken(0.9, 'hours', 3).seconds, 1080);
    withRule(V.time, 'roundTo', 1, () => assert.equal(timeTaken(5, 'hours', 2).value, 3));
  });
  test('no successes, zero/negative base, unknown unit', () => {
    assert.deepEqual(timeTaken(5, 'hours', 0), { ok: false, value: 0, unit: 'hours', label: 'Not done (no successes)', seconds: 0 });
    assert.equal(timeTaken(5, 'hours', -1).ok, false);
    assert.equal(timeTaken(-5, 'hours', 2).value, 0);
    assert.equal(timeTaken(4, 'eons', 2).unit, 'hours');
  });
});

describe('v0.58.0 Build/Repair tools', () => {
  test('enough tools: no modifier', () => {
    assert.equal(toolsModifier('kit', 'shop').modifier, null);
    assert.equal(toolsModifier('none', 'none').modifier, null);
    assert.equal(toolsModifier('shop', 'shop').blocked, false);
  });
  test('short by steps', () => {
    assert.deepEqual(toolsModifier('facility', 'kit').modifier, { label: 'Tools: Kit (needs Facility)', value: 4 });
    assert.deepEqual(toolsModifier('shop', 'kit').modifier, { label: 'Tools: Kit (needs Shop)', value: 2 });
  });
  test('no tools: noneTn or blocked; unknown ids are none', (tt) => {
    // v0.92.3: the old (v0.92.2) rule this test pins (RULES.CORE_V923 / book alignment).
    tt.after(oldWay({ 'CHARACTERS_V58.tools.none': 'tn' }));
    assert.deepEqual(toolsModifier('kit', 'none').modifier, { label: 'No tools (needs Kit)', value: 4 });
    assert.deepEqual(toolsModifier('shop', 'wrench').modifier, { label: 'No tools (needs Shop)', value: 4 });
    assert.equal(toolsModifier('bogus', 'none').modifier, null);
    withRule(V.tools, 'none', 'block', () => {
      const r = toolsModifier('kit', 'none');
      assert.equal(r.blocked, true);
      assert.equal(r.modifier, null);
    });
  });
  test('best tools for a skill', () => {
    const owned = [{ level: 'kit' }, { level: 'facility', skill: 'Car B/R' }, { level: 'shop', skill: 'firearms b/r' }, { level: 'nope' }];
    assert.equal(bestTools(owned, 'Firearms B/R'), 'shop');
    assert.equal(bestTools(owned, 'car b/r'), 'facility');
    assert.equal(bestTools(owned, 'Electronics B/R'), 'kit');
    assert.equal(bestTools([], 'x'), 'none');
    assert.equal(bestTools([{ level: 'shop', skill: 'Car B/R' }], 'Bike B/R'), 'none');
  });
  test('gear repair plan', () => {
    assert.deepEqual(gearRepairPlan({ kind: 'weapon', weaponSkill: 'Firearms' }), { skill: 'Firearms B/R', fallbackAttribute: 'intelligence', tn: 4, baseHours: 2, needs: 'kit' });
    assert.equal(gearRepairPlan({ kind: 'weapon', weaponSkill: 'Firearms B/R' }).skill, 'Firearms B/R');
    assert.equal(gearRepairPlan({ kind: 'weapon', weaponSkill: '  ' }).skill, 'Electronics B/R');
    assert.equal(gearRepairPlan({ kind: 'gear', weaponSkill: 'Firearms' }).skill, 'Electronics B/R');
  });
});

describe('v0.58.0 creation costs', () => {
  test('contact cost by level: nearest lower, below 1 is 1', () => {
    assert.equal(contactLevelCost(1), 5000);
    assert.equal(contactLevelCost(3), 200000);
    assert.equal(contactLevelCost(5), 200000);
    assert.equal(contactLevelCost(0), 5000);
    assert.equal(contactLevelCost(-3), 5000);
    assert.equal(contactLevelCost(2.7), 10000);
  });
  test('two free Level 1 contacts; the rest are paid (a dearer one in a free slot pays the difference)', () => {
    assert.deepEqual(contactsCost([]), { free: 0, paid: 0, cost: 0 });
    assert.deepEqual(contactsCost([{ level: 1 }, { level: 1 }]), { free: 2, paid: 0, cost: 0 });
    assert.deepEqual(contactsCost([{ level: 1 }, { level: 3 }, { level: 2 }, { level: 1 }]), { free: 2, paid: 2, cost: 210000 });
    assert.deepEqual(contactsCost([{ level: 3 }, { level: 3 }]), { free: 2, paid: 0, cost: 390000 });
    withRule(V.creation, 'freeContacts', 0, () => assert.deepEqual(contactsCost([{ level: 2 }]), { free: 0, paid: 1, cost: 10000 }));
  });
  test('lifestyle months', () => {
    assert.equal(lifestyleCost('middle', 2), 10000);
    assert.equal(lifestyleCost('middle', 0), 0);
    assert.equal(lifestyleCost('middle', -1), 0);
    assert.equal(lifestyleCost('nowhere', 3), 0);    // unknown → the first lifestyle (Street, ¥0)
    withRule(V.creation, 'lifestyleMonthsPaid', false, () => assert.equal(lifestyleCost('middle', 2), 0));
  });
  test('buildPlan pays the lifestyle and extra contacts', () => {
    const plan = buildPlan({ resources: 'B', magic: 'none', gearCost: 100000, contacts: [{ level: 1 }, { level: 1 }, { level: 2 }] });
    assert.equal(plan.lifestyleCost, 5000);
    assert.equal(plan.contactsCost, 10000);
    assert.equal(plan.nuyen, 400000 - 100000 - 5000 - 10000);
    withRule(V.creation, 'lifestyleMonthsPaid', false, () => assert.equal(buildPlan({ resources: 'B', magic: 'none', gearCost: 0 }).nuyen, 400000));
    assert.equal(buildPlan({ resources: 'E', magic: 'none', gearCost: 0, contacts: [{ level: 3 }, { level: 3 }, { level: 3 }] }).nuyen, 0);
  });
});

const baseInput = (over: Partial<BuildInput> = {}): BuildInput => ({
  priorities: { race: 'E', magic: 'D', attributes: 'C', skills: 'B', resources: 'A' }, metatype: 'human', magic: 'none',
  attributes: { body: 4 }, intelligence: 4, activeSkills: [], knowledgeSkills: [], gearCost: 1000, nuyen: 500, essence: 6, ...over,
});
const row = (rows: ReturnType<typeof buildCheck>, label: string) => rows.find((r) => r.label === label);

describe('v0.58.0 build check rows', () => {
  test('Resources: old string unchanged without contacts or lifestyle; no Contacts row', () => {
    const rows = buildCheck(baseInput());
    assert.equal(row(rows, 'Resources')!.used, '¥1,500 (gear ¥1,000 + cash ¥500)');
    assert.equal(row(rows, 'Contacts'), undefined);
  });
  test('Resources counts contacts and lifestyle; Contacts row', () => {
    const rows = buildCheck(baseInput({ contacts: [{ level: 1 }, { level: 1 }, { level: 2 }], lifestyle: 'middle', lifestyleMonths: 2 }));
    assert.equal(row(rows, 'Resources')!.used, '¥21,500 (gear ¥1,000 + contacts ¥10,000 + lifestyle ¥10,000 + cash ¥500)');
    assert.deepEqual([row(rows, 'Contacts')!.used, row(rows, 'Contacts')!.allowed, row(rows, 'Contacts')!.ok], ['3 (2 free)', 'first 2 free', true]);
    const def = buildCheck(baseInput({ lifestyle: 'low' }));
    assert.match(row(def, 'Resources')!.used, /lifestyle ¥1,000/);
    const over = buildCheck(baseInput({ priorities: { resources: 'E' }, gearCost: 0, nuyen: 0, lifestyle: 'high' }));
    assert.equal(row(over, 'Resources')!.ok, false);
  });
  test('native language: free up to Intelligence, the excess counts as knowledge', (tt) => {
    // v0.92.3: the old (v0.92.2) rule this test pins (RULES.CORE_V923 / book alignment).
    tt.after(oldWay({ 'CORE_V923.nativeLanguage': 'old' }));
    const none = buildCheck(baseInput());
    const at = buildCheck(baseInput({ nativeLanguage: { name: 'English', rating: 4 } }));
    assert.equal(row(at, 'Skills')!.used, `${row(none, 'Skills')!.used.split(' ')[0]} points (+4 free native language)`);
    // Intelligence 4 gives 4 × knowledgePerInt free knowledge; push past it so the excess shows in the pool.
    const free = 4 * RULES.CREATION.knowledgePerInt;
    const k = [{ name: 'Lore', rating: free }];
    const over = buildCheck(baseInput({ knowledgeSkills: k, nativeLanguage: { name: 'English', rating: 6 } }));
    assert.match(row(over, 'Skills')!.used, /^2 points .*\(\+4 free native language\)/);
    withRule(V.languages, 'nativeAtIntelligence', false, () => {
      const r = buildCheck(baseInput({ knowledgeSkills: k, nativeLanguage: { name: 'English', rating: 3 } }));
      assert.match(row(r, 'Skills')!.used, /^3 points/);
      assert.doesNotMatch(row(r, 'Skills')!.used, /native/);
    });
  });
});

describe('v0.58.0 languages', () => {
  test('native rating and read/write', (tt) => {
    // v0.92.3: the old (v0.92.2) rule this test pins (RULES.CORE_V923 / book alignment).
    tt.after(oldWay({ 'CORE_V923.nativeLanguage': 'old' }));
    assert.equal(nativeLanguageRating(5), 5);
    assert.equal(nativeLanguageRating(-1), 0);
    withRule(V.languages, 'nativeAtIntelligence', false, () => assert.equal(nativeLanguageRating(5), 0));
    assert.equal(readWriteRating(5), 3);
    assert.equal(readWriteRating(4), 2);
    assert.equal(readWriteRating(0), 0);
    assert.equal(readWriteRating(-3), 0);
    withRule(V.languages, 'readWrite', 'same', () => assert.equal(readWriteRating(5), 5));
  });
  test('what a language test reveals', () => {
    assert.equal(languageReveal(0), 'Understands nothing.');
    assert.equal(languageReveal(2), 'Understands most of it.');
    assert.equal(languageReveal(7), 'Understands it all, nuance included.');
  });
  test('free native points', (tt) => {
    // v0.92.3: the old (v0.92.2) rule this test pins (RULES.CORE_V923 / book alignment).
    tt.after(oldWay({ 'CORE_V923.nativeLanguage': 'old' }));
    assert.equal(freeLanguagePoints(4, 6), 4);
    assert.equal(freeLanguagePoints(4, 2), 2);
    assert.equal(freeLanguagePoints(4, -1), 0);
    assert.equal(freeLanguagePoints(0, 3), 0);
  });
});

describe('v0.58.0 training', () => {
  test('days by kind and rating, minimum and unknown kind', () => {
    assert.equal(trainingDays({ kind: 'knowledge', newRating: 4 }), 12);
    assert.equal(trainingDays({ kind: 'attribute', newRating: 5 }), 70);
    assert.equal(trainingDays({ kind: 'mystery', newRating: 2 }), 14);
    assert.equal(trainingDays({ kind: 'active', newRating: 0 }), 1);
    assert.equal(trainingDays({ kind: 'active', newRating: -2 }), 1);
  });
  test('instruction divides time when the instructor is good enough', () => {
    assert.deepEqual(instructionResult({ days: 28, successes: 3, instructorRating: 5, newRating: 4 }).days, 10);
    assert.equal(instructionResult({ days: 2, successes: 5, instructorRating: 5, newRating: 4 }).days, 1);
    const low = instructionResult({ days: 28, successes: 3, instructorRating: 3, newRating: 4 });
    assert.deepEqual([low.days, low.usable], [28, false]);
    assert.match(low.note, /below/);
    const none = instructionResult({ days: 28, successes: 0, instructorRating: 4, newRating: 4 });
    assert.deepEqual([none.days, none.usable], [28, true]);
    withRule(V.training, 'minimumDays', 3, () => assert.equal(instructionResult({ days: 7, successes: 7, instructorRating: 5, newRating: 1 }).days, 3));
  });
  test('ready at', () => {
    assert.equal(trainingReadyAt(1000, 2), 1000 + 172800);
    assert.equal(trainingReadyAt(1000, -2), 1000);
  });
});

describe('v0.58.0 pay negotiation', () => {
  test('raises, lowers, caps, rounds to ¥10, never negative', () => {
    assert.deepEqual(negotiatedPay(10000, 2), { pay: 12000, change: 2000, percent: 20 });
    assert.deepEqual(negotiatedPay(10000, -3), { pay: 7000, change: -3000, percent: -30 });
    assert.deepEqual(negotiatedPay(10000, 9), { pay: 15000, change: 5000, percent: 50 });
    assert.deepEqual(negotiatedPay(10000, 0), { pay: 10000, change: 0, percent: 0 });
    assert.equal(negotiatedPay(1234, 1).pay, 1360);           // 1357.4 → 1360
    assert.equal(negotiatedPay(-500, 2).pay, 0);
    withRule(V.negotiation, 'cap', 1.5, () => assert.equal(negotiatedPay(1000, -15).pay, 0));
  });
});

describe('v0.58.0 Karma award', () => {
  test('totals, clamping, unknown ids and lines', (tt) => {
    // v0.92.3: the old (v0.92.2) rule this test pins (RULES.CORE_V923 / book alignment).
    tt.after(oldWay({ 'CORE_V923.awards': 'old' }));
    const t = karmaAwardTotal({ team: { survival: 1, objectives: 5, threat: -2, bogus: 9 }, individual: { roleplaying: true, courage: false, humor: 3, nope: true } });
    assert.deepEqual(t, { team: 4, individual: 2, total: 6, lines: ['Survived the run +1', 'Objectives met +3', 'Good roleplaying +1', 'Humor +1'] });
    assert.deepEqual(karmaAwardTotal({ team: {}, individual: {} }), { team: 0, individual: 0, total: 0, lines: [] });
  });
});

describe('v0.58.0 notoriety and recognition', () => {
  test('Notoriety comes off Street Cred', () => {
    assert.equal(streetCred({ career: 47, manual: 0 }), 4);
    assert.equal(streetCred({ career: 47, manual: 0, notoriety: 0 }), 4);
    assert.equal(streetCred({ career: 47, manual: 0, notoriety: 1 }), 3);
    assert.equal(streetCred({ career: 47, manual: 0, notoriety: 9 }), 0);
    withRule(RULES.STREET.reputation, 'autoCred', false, () => assert.equal(streetCred({ career: 0, manual: 5, notoriety: 2 }), 3));
    withRule(V.notoriety, 'offCred', false, () => assert.equal(streetCred({ career: 47, manual: 0, notoriety: 2 }), 4));
  });
  test('recognition TN', () => {
    assert.equal(recognitionTn(0), 10);
    assert.equal(recognitionTn(3.7), 7);
    assert.equal(recognitionTn(-4), 10);
    assert.equal(recognitionTn(20), RULES.MIN_TARGET_NUMBER);
  });
});

describe('v0.58.0 Reaction-linked skills', () => {
  test('natural Reaction', () => {
    assert.equal(naturalReaction(5, 4), 4);
    assert.equal(naturalReaction(6, 4), 5);
    assert.equal(naturalReaction(0, 0), 0);
  });
  test('the linked attribute rating', () => {
    const attrs = { quickness: { total: 7, natural: 5 }, intelligence: { total: 4 }, body: undefined };
    assert.equal(skillAttributeRating('reaction', attrs, 8), 8);
    assert.equal(skillAttributeRating('quickness', attrs, 8), 7);
    assert.equal(skillAttributeRating('quickness', attrs, 8, true), 5);
    assert.equal(skillAttributeRating('intelligence', attrs, 8, true), 4);
    assert.equal(skillAttributeRating('body', attrs, 8), 0);
    assert.equal(skillAttributeRating('magic', attrs, 8), 0);
  });
  test('vehicle skills use Reaction, B/R skills do not', () => {
    for (const n of ['Car', 'bike', 'Hovercraft', 'Motorboat', 'Ship', 'Fixed-wing aircraft', 'Fixed Wing Aircraft', 'Rotor aircraft', 'Rotorcraft', 'Vectored thrust aircraft', 'LTA aircraft', 'Winged Aircraft', 'Submarine', 'Remote Drone', ' car '])
      assert.equal(vehicleSkillAttribute(n), 'reaction', n);
    for (const n of ['Car B/R', 'Fixed-wing aircraft B/R', 'Firearms', '', 'Drone B/R'])
      assert.equal(vehicleSkillAttribute(n), null, n);
  });
});
