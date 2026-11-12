import { test, describe } from 'node:test';
import { oldWay } from './oldway.ts';
import assert from 'node:assert/strict';
import {
  RULES, cleansingTn, cleansingPoints, applyCleansing, diviningTn, diviningAnswer, invokingTn, invokeProblem, possessionOutcome, possessedAttributes,
  reflectedSuccesses, ordealById, initiationCost, initiationSiteMissing, designDrain, designTest, designDays, normalizeGroup, groupsOf, inBreach, groupSites,
  optionalTraditionOn, traditionKindWarning, hiveMissing, powerAttributeChanges, hasAttributeChange, ritualNoticeTn, siteRaiseCost, hunger,
  newFire, fireIntensity, fireTurn, fireTurnsElapsed, backgroundFor, totemDice, isShamanic, traditionSpiritWarning, METAMAGIC, TRADITIONS, SPIRIT_KINDS,
  missingSites, parseGroupSites, formatGroupSites,
  bioEffect, painEditedMonitor, dampedStunBoxes, physicalSkill, rejectionTn, rejectionCandidate, nextRejectionAt, recovering, recoveringItemIds, recoveryTn,
  encephalonDice, chipSlots, chipsRunning, gradedAvailability,
} from '../index.ts';

const withRule = (obj: any, key: string, value: unknown, fn: () => void) => { const old = obj[key]; obj[key] = value; try { fn(); } finally { obj[key] = old; } };

describe('v0.45.0 lists', () => {
  test('new metamagic, traditions and spirit kinds', () => {
    for (const k of ['cleansing', 'divining', 'invoking', 'possessing', 'reflecting']) assert.ok((METAMAGIC as readonly string[]).includes(k), k);
    assert.ok((TRADITIONS as readonly string[]).includes('toxic') && (TRADITIONS as readonly string[]).includes('insect'));
    assert.ok((SPIRIT_KINDS as readonly string[]).includes('toxic') && (SPIRIT_KINDS as readonly string[]).includes('insect'));
    assert.ok(isShamanic('toxic') && isShamanic('insect') && isShamanic('shamanist') && !isShamanic('hermetic'));
    assert.equal(totemDice('toxic' as any, { combat: 2 } as any, 'combat'), 2);
  });
});

describe('v0.45.0 metamagic', () => {
  test('cleansing: TN by count (toxic harder), points per 2 successes, plain count first then the strongest unaligned source', () => {
    assert.equal(cleansingTn(3), 6);
    assert.equal(cleansingTn(3, true), 8);
    assert.equal(cleansingTn(0), 2);
    assert.equal(cleansingPoints(5), 2);
    const sources = [{ name: 'Old battlefield', rating: 3, aspect: [], toxic: true }, { name: 'Bear lodge', rating: 4, aspect: ['bear'], toxic: false }];
    const r = applyCleansing(1, sources, 3, ['bear']);
    assert.equal(r.plain, 0);
    assert.equal(r.removed, 3);
    assert.deepEqual(r.sources.map((s) => [s.name, s.rating]), [['Old battlefield', 1], ['Bear lodge', 4]]);
    const all = applyCleansing(0, [{ name: 'A', rating: 1, aspect: [], toxic: false }], 5);
    assert.deepEqual(all, { plain: 0, sources: [], removed: 1 });
  });

  test('divining: TN by question and weeks ahead; answers by successes', () => {
    assert.equal(diviningTn('specific', 2).tn, 8);
    assert.equal(diviningTn('nope').tn, 4);
    assert.equal(diviningAnswer(0), 'No answer comes.');
    assert.equal(diviningAnswer(9), RULES.OCCULT.metamagic.divining.answers.at(-1));
  });

  test('invoking: TN, who can be invoked', () => {
    assert.equal(invokingTn(5), 5);
    assert.equal(invokeProblem({ kind: 'elemental', summonerUuid: 'A', services: 2 }, 'A'), null);
    assert.match(invokeProblem({ kind: 'watcher', summonerUuid: 'A', services: 2 }, 'A')!, /only nature/);
    assert.match(invokeProblem({ kind: 'nature', summonerUuid: 'B', services: 2 }, 'A')!, /not this/);
    assert.match(invokeProblem({ kind: 'nature', summonerUuid: 'A', services: 0 }, 'A')!, /service/);
    assert.match(invokeProblem({ kind: 'nature', summonerUuid: 'A', services: 3, greatForm: true }, 'A')!, /already/);
  });

  test('possessing and reflecting', () => {
    assert.deepEqual(possessionOutcome(3, 2), { possessed: true, net: 1 });
    assert.equal(possessionOutcome(2, 2).possessed, false);
    assert.equal(possessionOutcome(0, 0).possessed, false);
    assert.deepEqual(possessedAttributes({ body: 5, quickness: 4, strength: 5, charisma: 1, intelligence: 2, willpower: 2 }, { charisma: 6, intelligence: 5, willpower: 6, body: 1 }),
      { body: 5, quickness: 4, strength: 5, charisma: 6, intelligence: 5, willpower: 6 });
    assert.equal(reflectedSuccesses(2, 5), 3);
    assert.equal(reflectedSuccesses(4, 3), 0);
    withRule(RULES.OCCULT.metamagic.reflecting, 'needsSpellDefense', true, () => {
      assert.equal(reflectedSuccesses(2, 5, 0), 0);
      assert.equal(reflectedSuccesses(2, 5, 2), 3);
    });
  });
});

describe('v0.45.0 initiation and design', () => {
  test('ordeals and group initiation lower the multiplier; the old cost is the self rate (v0.92.2)', (t) => {
    t.after(oldWay({ 'SPIRITS_V923.gradeZero': 'v922', 'SPIRITS_V923.initiationRounding': 'up', 'OCCULT.initiation.ordealReduction': 1 }));
    assert.deepEqual(initiationCost(1), { cost: 21, multiplier: 3 });
    assert.deepEqual(initiationCost(2, { ordeal: true }), { cost: 16, multiplier: 2 });
    assert.deepEqual(initiationCost(2, { group: true, ordeal: true }), { cost: 8, multiplier: 1 });
    assert.equal(ordealById('asceticism')!.effect, 'attribute');
    assert.equal(ordealById('nope'), null);
  });

  test('initiation needs a library or lodge rated at least the grade', () => {
    const lib = [{ name: 'Library', kind: 'library' as const, rating: 2, tag: 'sorcery' }];
    assert.deepEqual(initiationSiteMissing('hermetic', lib, 2), []);
    assert.match(initiationSiteMissing('hermetic', lib, 3)[0]!, /rating 3/);
    assert.deepEqual(initiationSiteMissing('shamanic', [], 1, 'Bear'), ['a lodge (Bear)']);
    assert.deepEqual(initiationSiteMissing('adept', [], 1), []);
    withRule(RULES.OCCULT.initiation, 'site', 'off', () => assert.deepEqual(initiationSiteMissing('hermetic', [], 3), []));
  });

  test('spell design: drain code from the formula, test and days', () => {
    assert.deepEqual(designDrain({ category: 'combat', spellType: 'mana', damageLevel: 'S' }), { drainModifier: 0, drainLevel: 'S', notes: [] });
    const fb = designDrain({ category: 'combat', spellType: 'physical', area: true, elemental: true, damageLevel: 'M' });
    assert.equal(fb.drainModifier, 2);
    assert.equal(fb.drainLevel, 'S');
    const stun = designDrain({ category: 'combat', spellType: 'mana', damageType: 'stun', damageLevel: 'M', touch: true });
    assert.equal(stun.drainModifier, -2);
    const det = designDrain({ category: 'detection', spellType: 'mana', duration: 'sustained' });
    assert.equal(det.drainLevel, 'L');
    assert.equal(designDrain({ category: 'manipulation', spellType: 'mana', resisted: true }).drainModifier, 1);
    assert.equal(designDrain({ category: 'combat', spellType: 'physical', elemental: true, damageLevel: 'D' }).drainLevel, 'D');
    assert.deepEqual(designTest(5, 3), { tn: 5, siteDice: 3 });
    assert.equal(designDays(6, 4), 2);
    assert.equal(designDays(6, 0), null);
  });
});

describe('v0.45.0 magical groups and traditions', () => {
  const g = normalizeGroup({ id: 'g1', name: 'Circle of Thorns', members: ['A', 'B'], sites: [{ name: 'Lodge', kind: 'lodge', rating: 4, tag: '' }], breaches: [{ uuid: 'B', strictureId: 's', at: 0 }] } as any);
  test('membership, breaches and shared sites', () => {
    assert.equal(groupsOf([g], ['A']).length, 1);
    assert.equal(groupsOf([g], ['C']).length, 0);
    assert.equal(inBreach(g, ['B']), true);
    assert.deepEqual(groupSites([g], ['A']).map((s) => s.name), ['Lodge (Circle of Thorns)']);
    assert.deepEqual(groupSites([g], ['B']), []);
    withRule(RULES.OCCULT.groups, 'shareSites', false, () => assert.deepEqual(groupSites([g], ['A']), []));
    assert.equal(normalizeGroup({}).name, 'Magical group');
    const sites = parseGroupSites('Old Library: library 5 sorcery\nnonsense\nThe Lodge: Lodge 3');
    assert.deepEqual(sites, [{ name: 'Old Library', kind: 'library', rating: 5, tag: 'sorcery' }, { name: 'The Lodge', kind: 'lodge', rating: 3, tag: '' }]);
    assert.equal(formatGroupSites(sites), 'Old Library: library 5 sorcery\nThe Lodge: lodge 3');
  });

  test('toxic and insect shamans', () => {
    assert.equal(optionalTraditionOn('hermetic'), true);
    assert.equal(optionalTraditionOn('toxic'), false);
    withRule(RULES.OCCULT.traditions, 'enabled', true, () => assert.equal(optionalTraditionOn('insect'), true));
    assert.equal(traditionKindWarning('toxic', 'toxic'), null);
    assert.match(traditionKindWarning('insect', 'nature')!, /insect spirits/);
    assert.equal(traditionKindWarning('hermetic', 'nature'), null);
    assert.match(traditionSpiritWarning('hermetic' as any, 'insect')!, /insects/);
    assert.equal(hiveMissing('insect', []), true);
    assert.equal(hiveMissing('insect', [{ name: 'Hive', kind: 'lodge', rating: 3, tag: '' }]), false);
    assert.deepEqual(missingSites('ritual', 'toxic', [], { force: 2, totem: 'Pollution' }), ['a lodge (Pollution)']);
    const bg = backgroundFor([{ name: 'Sludge', rating: 4, aspect: [], toxic: true }], 0, ['toxic']);
    assert.deepEqual([bg.penalty, bg.bonusDice, bg.toxic], [0, 4, false]);
    const other = backgroundFor([{ name: 'Sludge', rating: 4, aspect: [], toxic: true }], 0, ['hermetic']);
    assert.deepEqual([other.penalty, other.toxic], [4, true]);
  });
});

describe('v0.45.0 powers, rituals, sites, diet', () => {
  test('sustained powers: changes, per success capped', () => {
    assert.deepEqual(powerAttributeChanges({ strength: 2, quickness: 0 }, false, 5), { strength: 2 });
    assert.deepEqual(powerAttributeChanges({ quickness: -1 }, true, 5), { quickness: -3 });
    assert.deepEqual(powerAttributeChanges({ quickness: -1 }, true, 2), { quickness: -2 });
    assert.equal(hasAttributeChange({ body: 0 }), false);
    assert.equal(hasAttributeChange({ body: 1 }), true);
  });

  test('noticing a ritual', () => {
    assert.equal(ritualNoticeTn({ awakened: true, astral: false }), 6);
    assert.equal(ritualNoticeTn({ awakened: true, astral: true }), 4);
    assert.equal(ritualNoticeTn({ awakened: false, astral: false }), null);
    withRule(RULES.OCCULT.ritualNotice, 'mundanes', true, () => assert.equal(ritualNoticeTn({ awakened: false, astral: false }), 6));
  });

  test('raising a site costs the difference', () => {
    assert.deepEqual(siteRaiseCost('library', 2, 5), { nuyen: 3000, days: 3 });
    assert.deepEqual(siteRaiseCost('lodge', 0, 4), { nuyen: 2000, days: 4 });
    assert.deepEqual(siteRaiseCost('circle', 5, 3), { nuyen: 0, days: 0 });
  });

  test('hunger', () => {
    assert.deepEqual(hunger(0, 8 * 86400), { days: 8, hungry: true, tn: 1 });
    assert.deepEqual(hunger(0, 2 * 86400), { days: 2, hungry: false, tn: 0 });
    assert.equal(hunger(NaN, 100).hungry, false);
  });
});

describe('v0.45.0 fire', () => {
  test('a fire grows, gets hotter and burns out', () => {
    let f = newFire({ id: 'f', x: 0, y: 0, source: 'test', now: 0 });
    assert.equal(f.radius, 1);
    assert.equal(f.intensity, 'small');
    for (let i = 0; i < 3; i++) f = fireTurn(f).fire;
    assert.equal(f.radius, 4);
    assert.equal(f.intensity, 'burning');
    assert.equal(fireIntensity(99), 'blaze');
    for (let i = 0; i < 2; i++) f = fireTurn(f).fire;
    const last = fireTurn(f);
    assert.equal(last.out, true);
    assert.equal(last.fire.radius, 6);
    assert.equal(fireTurnsElapsed(0, 10), 3);
  });
});

describe('v0.45.0 bioware and cyberware', () => {
  const bio = (bioKind: string, rating = 1) => bioEffect({ name: bioKind, bioKind, rating, installed: true });
  test('new bioware kinds', () => {
    assert.equal(bio('enhancedArticulation', 2).physicalSkillDice, 1);
    assert.equal(bio('traumaDamper', 2).stunBoxesOff, 2);
    const pe = bio('painEditor', 3);
    assert.equal(pe.ignoreStunWounds, true);
    assert.deepEqual(pe.attributes, { willpower: 1 });
    assert.equal(pe.perceptionTn, 1);
    assert.deepEqual(painEditedMonitor({ physical: 3, stun: 5 }, true), { physical: 3, stun: 0 });
    assert.equal(dampedStunBoxes(3, 2), 1);
    assert.equal(dampedStunBoxes(1, 2), 1);
    assert.ok(physicalSkill('quickness') && !physicalSkill('charisma'));
    // platelet factories are still not per rating, muscle augmentation still is.
    assert.equal(bio('plateletFactory', 3).boxesOff, 1);
    assert.deepEqual(bio('muscleAugmentation', 2).attributes, { strength: 2 });
  });

  test('rejection and recovery', () => {
    assert.equal(rejectionTn(4, 5), null);
    assert.equal(rejectionTn(6.5, 5), 6);
    const items = [{ id: 'a', installed: true, sort: 1 }, { id: 'b', installed: true, cultured: true, sort: 5 }, { id: 'c', installed: true, sort: 3 }];
    assert.equal(rejectionCandidate(items)!.id, 'c');
    assert.equal(rejectionCandidate([{ id: 'x', installed: true, cultured: true }]), null);
    assert.equal(nextRejectionAt(0), 7 * 86400);
    const list = [{ itemId: 'a', name: 'A', until: 100 }, { itemId: 'b', name: 'B', until: 10 }];
    assert.deepEqual(recovering(list, 50).map((r) => r.itemId), ['a']);
    assert.deepEqual(recoveringItemIds(list, 50), ['a']);
    assert.equal(recoveryTn(list, 50), 1);
    assert.equal(recoveryTn(list, 200), 0);
  });

  test('encephalons, chip slots, graded availability', (t) => {
    t.after(oldWay({"BOOK_V78.encephalon.mode": "dice"})); // v0.78.0: the old rule (a house rule)
    assert.equal(encephalonDice(2, { attribute: 'intelligence' }), 2);
    assert.equal(encephalonDice(2, { attribute: 'charisma', kind: 'knowledge' }), 2);
    assert.equal(encephalonDice(2, { attribute: 'quickness' }), 0);
    const slots = chipSlots({ chipjacks: 1, datajack: true, memoryMp: 20 });
    assert.deepEqual(slots, { jacks: 2, memory: 20 });
    const chips = [
      { name: 'a', kind: 'activesoft', rating: 3, slotted: true }, { name: 'k1', kind: 'knowsoft', rating: 4, slotted: true },
      { name: 'k2', kind: 'knowsoft', rating: 4, slotted: true }, { name: 'a2', kind: 'activesoft', rating: 2, slotted: true },
      { name: 'k3', kind: 'linguasoft', rating: 4, slotted: true }, { name: 'off', kind: 'knowsoft', rating: 1, slotted: false },
    ];
    const run = chipsRunning(chips, slots);
    assert.deepEqual(run.map((r) => [r.chip.name, r.runs, r.via]), [['a', true, 'jack'], ['k1', true, 'jack'], ['k2', true, 'memory'], ['a2', false, ''], ['k3', false, ''], ['off', false, '']]);
    assert.match(run[3]!.reason, /no free jack/);
    withRule(RULES.CYBERWARE.chips, 'enforce', 'off', () => assert.ok(chipsRunning(chips, { jacks: 0, memory: 0 }).filter((r) => r.chip.slotted).every((r) => r.runs)));
    assert.deepEqual(gradedAvailability('4/48hrs', { grade: 'beta' }), { tn: 9, hours: 96, label: '9/96h (beta)' });
    assert.equal(gradedAvailability('6/4days', { cultured: true }).tn, 8);
    assert.equal(gradedAvailability('', { grade: 'delta' }).tn, 0);
    assert.equal(gradedAvailability('4/48hrs').label, '4/48hrs');
  });
});
