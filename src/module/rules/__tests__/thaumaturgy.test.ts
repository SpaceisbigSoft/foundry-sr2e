import { test, describe } from 'node:test';
import { oldWay } from './oldway.ts';
import assert from '../../__tests__/helpers/assert-rows.ts';
import {
  elementalArmor, elementMatches, elementalAidDice, projectionOverstay, areaRadius, maskingModifiers, domainConflict,
  bindingCost, aspectRestriction, tags, totemEnvironmentDice, focusAddiction, ignoresImmunity,
  castingPlaneProblem, barrierSpellDice, spellKarmaCost, ritualCanReach, materialStep, focusMaterialNeed,
} from '../thaumaturgy.ts';
import { sustainingModifiers, sorceryFocusDice, totemDice } from '../arcana.ts';

describe('thaumaturgy', () => {
  test('elemental spells: half impact armor; elementals match by element and aid with their Force', () => {
    assert.equal(elementalArmor({ ballistic: 5, impact: 3 }), 1);
    assert.equal(elementalArmor({ ballistic: 5, impact: 6 }), 3);
    assert.equal(elementMatches('Fire', 'fire'), true);
    assert.equal(elementMatches('water', 'fire'), false);
    assert.equal(elementMatches('', ''), false);
    assert.equal(elementalAidDice(5), 5);
  });

  test('an elemental or focus sustaining a spell takes away the TN penalty', () => {
    assert.deepEqual(sustainingModifiers([{ spellName: 'Armor', force: 4, category: 'manipulation', focusId: '', spiritUuid: 'Actor.x' }]), []);
    assert.equal(sustainingModifiers([{ spellName: 'Armor', force: 4, category: 'manipulation', focusId: '' }])[0]?.value, 2);
  });

  test('projection lasts 2 x Essence hours; each hour or part over costs a point of Essence (v0.92.2 way)', (t) => {
    t.after(oldWay({ 'SPIRITS_V923.projection': 'v922' }));
    assert.deepEqual(projectionOverstay(10, 6), { limit: 12, over: 0, essenceLoss: 0 });
    assert.deepEqual(projectionOverstay(13.5, 6), { limit: 12, over: 1.5, essenceLoss: 2 });
    assert.deepEqual(projectionOverstay(5, 2.8), { limit: 4, over: 1, essenceLoss: 1 });
  });

  test('area radius, masking, domains, binding cost', () => {
    assert.equal(areaRadius(6, 4), 4); // v0.77.0: the caster's Magic
    assert.deepEqual(maskingModifiers(2, ['masking']), [{ label: 'Masking', value: 2 }]);
    assert.deepEqual(maskingModifiers(2, ['centering']), []);
    assert.match(domainConflict(['Forest', 'City'], 'forest') ?? '', /only one per domain/);
    assert.equal(domainConflict(['Forest'], 'Lake'), null);
    assert.equal(domainConflict(['Forest'], ''), null);
    assert.deepEqual(bindingCost(4), { nuyen: 4000, hours: 4 });
  });

  test('elementalists cast their element\'s category and summon their elementals; shamanists follow the totem', () => {
    assert.equal(aspectRestriction('elementalist', 'cast', { aspectElement: 'fire', category: 'combat' }), null);
    assert.match(aspectRestriction('elementalist', 'cast', { aspectElement: 'fire', category: 'health' }) ?? '', /casts only combat/);
    assert.equal(aspectRestriction('elementalist', 'cast', { aspectElement: 'fire', category: 'manipulation', spellElement: 'fire' }), null);
    assert.match(aspectRestriction('elementalist', 'cast', { category: 'combat' }) ?? '', /Set the elementalist/);
    assert.equal(aspectRestriction('elementalist', 'conjure', { aspectElement: 'water', spiritKind: 'elemental', spiritElement: 'water' }), null);
    assert.match(aspectRestriction('elementalist', 'conjure', { aspectElement: 'water', spiritKind: 'nature' }) ?? '', /only water elementals/);
    assert.match(aspectRestriction('elementalist', 'conjure', { aspectElement: 'water', spiritKind: 'elemental', spiritElement: 'fire' }) ?? '', /only water elementals/);
    const totem = { combat: 2, health: 0 };
    assert.equal(aspectRestriction('shamanist', 'cast', { category: 'combat', totem }), null);
    assert.match(aspectRestriction('shamanist', 'cast', { category: 'health', totem }) ?? '', /totem favours/);
    assert.match(aspectRestriction('shamanist', 'conjure', { spiritKind: 'elemental' }) ?? '', /only nature spirits/);
    assert.equal(aspectRestriction('hermetic', 'cast', {}), null);
    assert.equal(totemDice('shamanist', { combat: 2 }, 'combat'), 2);
  });

  test('totem environment dice from the scene\'s tags', () => {
    assert.deepEqual(tags('Forest, wilderness ;urban'), ['forest', 'wilderness', 'urban']);
    const t = { environment: 'forest, wilderness', inEnvironment: 2, outEnvironment: -1 };
    assert.equal(totemEnvironmentDice('shamanic', t, ['urban', 'forest']).dice, 2);
    assert.equal(totemEnvironmentDice('shamanic', t, ['urban']).dice, -1);
    assert.equal(totemEnvironmentDice('hermetic', t, ['forest']).dice, 0);
    assert.equal(totemEnvironmentDice('shamanic', { environment: '' }, ['forest']).dice, 0);
  });

  test('foci: only bonded ones work; addiction risk above Magic', (t) => {
    t.after(oldWay({"BOOK_V78.powerFocus": "dice"})); // v0.78.0: the old rule (a house rule)
    const foci = [
      { focusType: 'spell' as const, rating: 3, active: true, bonded: false, category: '', target: '' },
      { focusType: 'power' as const, rating: 4, active: true, bonded: true, category: '', target: '' },
      { focusType: 'spirit' as const, rating: 3, active: true, bonded: true, category: '', target: '' },
    ];
    assert.equal(sorceryFocusDice(foci, { name: 'x', category: 'combat' }).dice, 4);   // unbonded spell focus ignored
    assert.deepEqual(focusAddiction(foci, 6), { total: 7, risk: true });
    assert.deepEqual(focusAddiction(foci, 7), { total: 7, risk: false });
  });

  test('magic weapons ignore immunity; casting across planes; barriers; Karma costs; rituals', () => {
    assert.equal(ignoresImmunity(true, false), true);
    assert.equal(ignoresImmunity(false, true), true);
    assert.equal(ignoresImmunity(false, false), false);
    assert.match(castingPlaneProblem({ mode: 'projecting' }, { astralOnly: false, name: 'Guard' }, 'mana') ?? '', /only cast at astral targets/);
    assert.equal(castingPlaneProblem({ mode: 'projecting' }, { astralOnly: true, name: 'Spirit' }, 'mana'), null);
    assert.match(castingPlaneProblem({ mode: 'physical' }, { astralOnly: true, name: 'Spirit' }, 'mana') ?? '', /perceive or project/);
    assert.match(castingPlaneProblem({ mode: 'perceiving' }, { astralOnly: true, name: 'Spirit' }, 'physical') ?? '', /only mana spells/);
    assert.equal(castingPlaneProblem({ mode: 'physical' }, { astralOnly: false, name: 'Guard' }, 'physical'), null);
    assert.equal(barrierSpellDice(5), 5);
    assert.equal(spellKarmaCost(5), 5);
    assert.equal(ritualCanReach({ materialLink: false, spotter: true }), true);
    assert.equal(ritualCanReach({ materialLink: false, spotter: false }), false);
  });

  test('materials move from raw to refined to radicals; fetishes and foci use refined', () => {
    const stock = { raw: 2, refined: 1, radical: 0 };
    assert.deepEqual(materialStep('gather', 3, stock), { consume: null, produce: { kind: 'raw', n: 3 }, short: null });
    assert.deepEqual(materialStep('refine', 3, stock), { consume: { kind: 'raw', n: 2 }, produce: { kind: 'refined', n: 2 }, short: null });
    assert.deepEqual(materialStep('alchemy', 3, stock), { consume: { kind: 'refined', n: 1 }, produce: { kind: 'radical', n: 1 }, short: null });
    assert.deepEqual(materialStep('fetish', 1, stock), { consume: { kind: 'refined', n: 1 }, produce: { kind: 'fetish', n: 1 }, short: null });
    assert.match(materialStep('refine', 2, { raw: 0, refined: 0, radical: 0 }).short ?? '', /No raw materials/);
    assert.equal(materialStep('gather', 0, stock).produce, null);
    assert.deepEqual(focusMaterialNeed(3), { kind: 'refined', n: 3 });
  });
});
