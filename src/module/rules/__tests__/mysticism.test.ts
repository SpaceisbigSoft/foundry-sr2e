import { test, describe } from 'node:test';
import { oldWay } from './oldway.ts';
import assert from 'node:assert/strict';
import {
  elementEffect, shockOutcome, elementalSustainUntil, outsideDomain, addictionTn, bestSite, missingSites,
  ritualMaterialsCost, ritualPrepLeft, cleaningSeconds, parseBackgroundSources, formatBackgroundSources, backgroundFor,
} from '../mysticism.ts';
import {
  adeptSpecialLevel, killingHandsLevel, allergyTn, allergyContact, vulnerabilityTo, vulnerableLevel, essenceDrained,
  essenceLossPeriods, regenerate,
} from '../critters.ts';
import { RULES } from '../config.ts';

describe('magic leftovers (v0.39.0)', () => {
  test('elemental effects and shock', () => {
    assert.equal(elementEffect('Fire'), 'fire');
    assert.equal(elementEffect('lightning'), 'shock');
    assert.equal(elementEffect('acid'), 'corrode');
    assert.equal(elementEffect('water'), 'knockdown');
    assert.equal(elementEffect(''), 'none');
    assert.deepEqual(shockOutcome(0), { stunned: true, initiativeLoss: 10 });
    assert.deepEqual(shockOutcome(2), { stunned: false, initiativeLoss: 0 });
  });
  test('sustain limit, domains, addiction (v0.92.2 sustain hours)', (t) => {
    t.after(oldWay({ 'SPIRITS_V923.elementalSustain': 'v922' }));
    assert.equal(elementalSustainUntil(100, 4), 100 + 4 * 3600);
    (RULES.MAGIC_V39.sustainLimit as any).hoursPerForce = 0;
    try { assert.equal(elementalSustainUntil(100, 4), -1); } finally { (RULES.MAGIC_V39.sustainLimit as any).hoursPerForce = 1; }
    assert.equal(outsideDomain('forest', ['urban', 'city']), true);
    assert.equal(outsideDomain('Forest', ['forest', 'wilderness']), false);
    assert.equal(outsideDomain('forest', []), false);           // scene has no tags: no check
    assert.equal(outsideDomain('', ['urban']), false);
    assert.equal(addictionTn(5, 6), null);
    assert.equal(addictionTn(8, 6), 8);
    (RULES.MAGIC_V39.addiction as any).tnFrom = 'excess';
    try { assert.equal(addictionTn(8, 6), 2); assert.equal(addictionTn(11, 6), 5); } finally { (RULES.MAGIC_V39.addiction as any).tnFrom = 'total'; }
  });
  test('libraries, circles and lodges', (t) => {
    // v0.92.3: the v0.92.2 rule (RULES.SORCERY_V923).
    t.after(oldWay({ 'SORCERY_V923.ritualTeam': 'v922' }));
    const sites = [
      { name: 'Conjuring library', kind: 'library' as const, rating: 6, tag: 'conjuring' },
      { name: 'Fire circle', kind: 'circle' as const, rating: 4, tag: 'fire' },
      { name: 'Bear lodge', kind: 'lodge' as const, rating: 5, tag: 'bear' },
    ];
    assert.equal(bestSite(sites, 'circle', 'fire')?.name, 'Fire circle');
    assert.equal(bestSite(sites, 'circle', 'water'), null);
    assert.deepEqual(missingSites('elemental', 'hermetic', sites, { force: 4, element: 'fire' }), []);
    assert.equal(missingSites('elemental', 'hermetic', sites, { force: 5, element: 'fire' }).length, 1);
    assert.equal(missingSites('elemental', 'hermetic', sites, { force: 3, element: 'water' })[0], 'a hermetic circle (water)');
    assert.deepEqual(missingSites('elemental', 'shamanic', [], { force: 6 }), []);   // shamans conjure nature spirits
    assert.deepEqual(missingSites('ritual', 'shamanic', sites, { force: 5, totem: 'Bear' }), []);
    assert.equal(missingSites('ritual', 'hermetic', sites, { force: 3 })[0], 'a sorcery library');
  });
  test('ritual stages and signature cleaning', (t) => {
    // v0.92.3: the v0.92.2 rule (RULES.SORCERY_V923).
    t.after(oldWay({ 'SORCERY_V923.ritualMaterials': 'v922' }));
    assert.equal(ritualMaterialsCost(5), 0);
    (RULES.MAGIC_V39.ritualStages as any).materialsPerForce = 500;
    try { assert.equal(ritualMaterialsCost(5), 2500); } finally { (RULES.MAGIC_V39.ritualStages as any).materialsPerForce = 0; }
    assert.equal(ritualPrepLeft(0, 3600, 4), 3);
    assert.equal(ritualPrepLeft(0, 99999, 4), 0);
    assert.equal(cleaningSeconds(3), 3 * 3600);
  });
  test('background count sources', () => {
    const list = parseBackgroundSources('Old church: 3 aspected to christian\nToxic dump: 4; toxic\nbad line\nGrove: 2 aspected to bear, forest; toxic');
    assert.equal(list.length, 3);
    assert.deepEqual(list[0], { name: 'Old church', rating: 3, aspect: ['christian'], toxic: false });
    assert.deepEqual(list[1], { name: 'Toxic dump', rating: 4, aspect: [], toxic: true });
    assert.deepEqual(list[2]!.aspect, ['bear', 'forest']);
    assert.equal(list[2]!.toxic, true);
    assert.deepEqual(parseBackgroundSources(formatBackgroundSources(list)), list);
    const hermetic = backgroundFor(list, 1, ['hermetic']);
    assert.equal(hermetic.penalty, 4);
    assert.equal(hermetic.toxic, true);
    const bear = backgroundFor(list.slice(2), 0, ['shamanic', 'bear']);
    assert.deepEqual([bear.penalty, bear.bonusDice, bear.toxic], [0, 2, false]);
    (RULES.MAGIC_V39.background as any).aspected = 'ignore';
    try { assert.deepEqual([backgroundFor(list.slice(2), 0, ['bear']).penalty, backgroundFor(list.slice(2), 0, ['bear']).bonusDice], [0, 0]); }
    finally { (RULES.MAGIC_V39.background as any).aspected = 'bonus'; }
  });
});

describe('adept powers and critters (v0.39.0)', () => {
  test('adept specials', () => {
    const powers = [{ special: 'killingHands', level: 2 }, { special: 'combatSense', level: 1 }, { special: 'combatSense', level: 2, active: false }];
    assert.equal(adeptSpecialLevel(powers, 'killingHands'), 2);
    assert.equal(adeptSpecialLevel(powers, 'combatSense'), 1);
    assert.equal(killingHandsLevel(0), null);
    assert.equal(killingHandsLevel(1), 'L'); // v0.77.0: four levels
    assert.equal(killingHandsLevel(2), 'M');
    assert.equal(killingHandsLevel(5), 'D');
  });
  test('allergies and vulnerabilities', (t) => {
    t.after(oldWay({"BOOK_V78.allergy.mode": "legacy"})); // v0.78.0: the old rule (a house rule)
    const traits = [
      { special: 'allergy', substance: 'sunlight', severity: 'mild', exposed: true },
      { special: 'allergy', substance: 'silver', severity: 'severe', exposed: false },
      { special: 'vulnerability', substance: 'silver, wood' },
    ];
    assert.deepEqual(allergyTn(traits), { value: 1, names: ['sunlight'] });
    assert.equal(allergyContact('severe'), 'M');
    assert.equal(allergyContact('mild'), null);
    assert.equal(vulnerabilityTo(traits, 'Wood')?.substance, 'silver, wood');
    assert.equal(vulnerabilityTo(traits, 'steel'), null);
    assert.equal(vulnerabilityTo(traits, ''), null);
    assert.equal(vulnerableLevel('M'), 'S');
    assert.equal(vulnerableLevel('D'), 'D');
  });
  test('Essence drain and loss, regeneration', () => {
    assert.deepEqual(essenceDrained(2, 6, 5), { taken: 2, gained: 2 });
    assert.deepEqual(essenceDrained(3, 1.5, 11), { taken: 1.5, gained: 1 });   // victim has 1.5; drainer caps at 12
    assert.deepEqual(essenceDrained(0, 6, 5), { taken: 0, gained: 0 });
    assert.equal(essenceLossPeriods(0, 29 * 86400), 0);
    assert.equal(essenceLossPeriods(0, 61 * 86400), 2);
    assert.deepEqual(regenerate({ physical: 6, stun: 0 }, 2), { physical: 2, healed: 4 });
    (RULES.CRITTERS.regeneration as any).boxesPerTurn = 1;
    try { assert.deepEqual(regenerate({ physical: 6, stun: 0 }, 0), { physical: 5, healed: 1 }); } finally { (RULES.CRITTERS.regeneration as any).boxesPerTurn = 0; }
  });
});
