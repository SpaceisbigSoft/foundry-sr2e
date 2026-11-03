import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  totemHelpsSpirit, totemConjuringDice, controlServices, banishHelp, trueNameOutcome, adeptBudget,
  rapidHealingDice, spellResistanceDice, distanceStrikeMetres, ADEPT_SENSES, improvedSenses,
  critterImmunities, immunityArmorFromEssence, TN_POWER_SPECIALS, powerModifierBundle,
  movementWithFactor, powerModifierLabel,
} from '../bestiary.ts';
import { RULES } from '../config.ts';

const R = RULES as any;

describe('v0.56.0 totems and spirits', () => {
  test('no totem spirits or no spirit: helps every summoning', () => {
    assert.equal(totemHelpsSpirit('', { type: 'Forest spirit' }), true);
    assert.equal(totemHelpsSpirit(null, { type: 'Forest spirit' }), true);
    assert.equal(totemHelpsSpirit(undefined, null), true);
    assert.equal(totemHelpsSpirit('forest', null), true);
  });
  test('a tag matches the type, domain or kind', () => {
    assert.equal(totemHelpsSpirit('forest, mountain', { type: 'Forest spirit' }), true);
    assert.equal(totemHelpsSpirit('City', { domain: 'city' }), true);
    assert.equal(totemHelpsSpirit('hearth', { kind: 'nature', type: 'Hearth spirit' }), true);
    assert.equal(totemHelpsSpirit('nature', { kind: 'nature', type: 'Sky spirit' }), true);
    assert.equal(totemHelpsSpirit('elementals', { kind: 'elemental', type: 'Fire elemental' }), true);
    assert.equal(totemHelpsSpirit('elemental', { kind: 'elemental' }), true);
  });
  test('no match, and no match inside a word', () => {
    assert.equal(totemHelpsSpirit('forest', { kind: 'nature', type: 'Sky spirit', domain: 'sky' }), false);
    assert.equal(totemHelpsSpirit('city', { type: 'Velocity spirit' }), false);
    assert.equal(totemHelpsSpirit('nature', { kind: 'elemental' }), false);
    assert.equal(totemHelpsSpirit('forest', {}), false);
  });
  test('conjuring dice only for favoured spirits and shamans', () => {
    const totem = { name: 'Bear', conjuring: 2, spirits: 'forest' };
    assert.equal(totemConjuringDice('shamanic', totem, { type: 'Forest spirit' }), 2);
    assert.equal(totemConjuringDice('shamanic', totem, { type: 'River spirit' }), 0);
    assert.equal(totemConjuringDice('hermetic', totem, { type: 'Forest spirit' }), 0);
    assert.equal(totemConjuringDice('shamanic', { name: 'Dog', conjuring: 1 }, { type: 'Field spirit' }), 1);
    assert.equal(totemConjuringDice('shamanic', undefined, null), 0);
  });
});

describe('v0.56.0 controlling, banishing, true names', () => {
  test('control services: net by default, keep owed when set', () => {
    assert.equal(controlServices(3, 5), 3);
    assert.equal(controlServices(0, 5), 0);
    assert.equal(controlServices(-2, 5), 0);
    R.MAGIC_V56.control.services = 'keep';
    try {
      assert.equal(controlServices(2, 5), 5);
      assert.equal(controlServices(2, 0), 1);
      assert.equal(controlServices(0, 5), 0);
    } finally { R.MAGIC_V56.control.services = 'net'; }
  });
  test('the summoner helps a bound spirit resist banishing', () => {
    assert.equal(banishHelp(3), 3);
    assert.equal(banishHelp(-1), 0);
    R.MAGIC_V56.control.summonerHelps = false;
    try { assert.equal(banishHelp(3), 0); } finally { R.MAGIC_V56.control.summonerHelps = true; }
  });
  test('true name binding', () => {
    assert.deepEqual(trueNameOutcome(5, 2, 6), { net: 3, bound: true, services: 3, karma: 6 });
    assert.deepEqual(trueNameOutcome(2, 2, 6), { net: 0, bound: false, services: 0, karma: 0 });
    assert.deepEqual(trueNameOutcome(1, 4, 6), { net: 0, bound: false, services: 0, karma: 0 });
    R.MAGIC_V56.trueName.karmaPerForce = 2;
    try { assert.equal(trueNameOutcome(3, 1, 4).karma, 8); } finally { R.MAGIC_V56.trueName.karmaPerForce = 1; }
  });
});

describe('v0.56.0 adepts', () => {
  test('budget within Magic: nothing over', () => {
    const p = [{ id: 'a', cost: 0.25 }, { id: 'b', cost: 0.5, active: true }, { id: 'c', cost: 2, active: false }];
    assert.deepEqual(adeptBudget(p, 1), { spent: 0.75, available: 1, over: [] });
    assert.deepEqual(adeptBudget([], 3), { spent: 0, available: 3, over: [] });
  });
  test('float sums are rounded and compared with an epsilon', () => {
    const p = [{ id: 'a', cost: 0.1 }, { id: 'b', cost: 0.2 }, { id: 'c', cost: 0.3 }];
    assert.deepEqual(adeptBudget(p, 0.6), { spent: 0.6, available: 0.6, over: [] });
  });
  test('over budget: active powers from the end go off, returned in list order', () => {
    const p = [
      { id: 'a', cost: 1 }, { id: 'b', cost: 1 }, { id: 'x', cost: 1, active: false },
      { id: 'c', cost: 0.5 }, { id: 'd', cost: 0.5 },
    ];
    assert.deepEqual(adeptBudget(p, 2), { spent: 3, available: 2, over: ['c', 'd'] });
    assert.deepEqual(adeptBudget(p, 1.5), { spent: 3, available: 1.5, over: ['b', 'c', 'd'] });
    assert.deepEqual(adeptBudget(p, 0), { spent: 3, available: 0, over: ['a', 'b', 'c', 'd'] });
  });
  test('warn mode still reports what is over', () => {
    R.CRITTERS_V56.adeptBudget = 'warn';
    try { assert.deepEqual(adeptBudget([{ id: 'a', cost: 2 }], 1).over, ['a']); } finally { R.CRITTERS_V56.adeptBudget = 'off'; }
  });
  test('rapid healing and spell resistance dice', () => {
    assert.equal(rapidHealingDice(3), 3);
    assert.equal(rapidHealingDice(-1), 0);
    assert.equal(spellResistanceDice(2), 2);
    assert.equal(spellResistanceDice(0), 0);
    R.CRITTERS_V56.rapidHealing.dicePerLevel = 2;
    R.CRITTERS_V56.spellResistance.dicePerLevel = 3;
    try {
      assert.equal(rapidHealingDice(2), 4);
      assert.equal(spellResistanceDice(2), 6);
    } finally {
      R.CRITTERS_V56.rapidHealing.dicePerLevel = 1;
      R.CRITTERS_V56.spellResistance.dicePerLevel = 1;
    }
  });
  test('distance strike reaches Magic metres', () => {
    assert.equal(distanceStrikeMetres(1, 6), 6);
    assert.equal(distanceStrikeMetres(0, 6), 0);
    assert.equal(distanceStrikeMetres(1, -2), 0);
    R.CRITTERS_V56.distanceStrike.metresPerMagic = 2;
    try { assert.equal(distanceStrikeMetres(1, 5), 10); } finally { R.CRITTERS_V56.distanceStrike.metresPerMagic = 1; }
  });
  test('improved senses from active powers only', () => {
    assert.deepEqual([...ADEPT_SENSES], ['', 'lowLight', 'thermographic', 'ultrasound', 'hearing']);
    assert.deepEqual(improvedSenses([]), { lowLight: false, thermographic: false, ultrasound: false, hearing: false });
    assert.deepEqual(improvedSenses([
      { special: 'improvedSenses', sense: 'lowLight' },
      { special: 'improvedSenses', sense: 'thermographic', active: false },
      { special: 'improvedSenses', sense: 'hearing', active: true },
      { special: 'killingHands', sense: 'ultrasound' },
      { special: 'improvedSenses', sense: '' },
    ]), { lowLight: true, thermographic: false, ultrasound: false, hearing: true });
  });
});

describe('v0.56.0 critter immunities', () => {
  test('substance tags and synonyms', () => {
    assert.deepEqual(critterImmunities([{ special: 'immunity', substance: 'Normal Weapons, flame; toxins' }]),
      { normalWeapons: true, fire: true, poisons: true, pathogens: false, age: false });
    assert.deepEqual(critterImmunities([{ special: 'immunity', substance: 'disease' }, { special: 'immunity', substance: 'ageing' }]),
      { normalWeapons: false, fire: false, poisons: false, pathogens: true, age: true });
    assert.deepEqual(critterImmunities([{ special: 'immunity', substance: 'mundane weapons, heat, drugs, pathogen, aging' }]),
      { normalWeapons: true, fire: true, poisons: true, pathogens: true, age: true });
  });
  test('empty substance means normal weapons; other traits and unknown tags ignored', () => {
    assert.equal(critterImmunities([{ special: 'immunity' }]).normalWeapons, true);
    assert.equal(critterImmunities([{ special: 'immunity', substance: '' }]).normalWeapons, true);
    assert.deepEqual(critterImmunities([{ special: 'fear', substance: 'fire' }, { special: 'immunity', substance: 'cold' }]),
      { normalWeapons: false, fire: false, poisons: false, pathogens: false, age: false });
  });
  test('armor from Essence', () => {
    assert.equal(immunityArmorFromEssence(6), 12);
    assert.equal(immunityArmorFromEssence(2.7), 5);
    assert.equal(immunityArmorFromEssence(-1), 0);
    R.CRITTERS_V56.immunity.armorPerEssence = 1;
    try { assert.equal(immunityArmorFromEssence(5.9), 5); } finally { R.CRITTERS_V56.immunity.armorPerEssence = 2; }
  });
});

describe('v0.56.0 TN-changing powers', () => {
  test('specials list', () => {
    assert.deepEqual([...TN_POWER_SPECIALS], ['concealment', 'confusion', 'movement', 'fear', 'guard']);
  });
  test('bundles by special', () => {
    assert.deepEqual(powerModifierBundle('concealment', { force: 4.7, successes: 2 }), { perceivedTn: 4 });
    assert.deepEqual(powerModifierBundle('confusion', { force: 4, successes: 3 }), { testsTn: 4 }); // v0.77.0: the being's Essence (rating)
    assert.deepEqual(powerModifierBundle('fear', { force: 4, successes: -2 }), { testsTn: 0 });
    assert.deepEqual(powerModifierBundle('guard', { force: 5, successes: 0 }), { attackedTn: 0 }); // v0.77.0: Guard prevents accidents only
    assert.deepEqual(powerModifierBundle('movement', { force: 3, successes: 0 }), { movementFactor: 3 });
    assert.deepEqual(powerModifierBundle('movement', { force: 0, successes: 0 }), { movementFactor: 1 });
    assert.deepEqual(powerModifierBundle('nope', { force: 3, successes: 3 }), {});
  });
  test('number values and config overrides', () => {
    const old = R.CRITTERS_V56.powerMods.guard;
    R.CRITTERS_V56.powerMods.guard = { attackedTn: 2, testsTn: 'successes', movementFactor: 0.5 };
    try {
      assert.deepEqual(powerModifierBundle('guard', { force: 6, successes: 1 }), { attackedTn: 2, testsTn: 1, movementFactor: 0.5 });
    } finally { R.CRITTERS_V56.powerMods.guard = old; }
    R.CRITTERS_V56.powerMods.movement = { movementFactor: 0 };
    try { assert.deepEqual(powerModifierBundle('movement', { force: 4, successes: 0 }), { movementFactor: 1 }); } finally { R.CRITTERS_V56.powerMods.movement = { movementFactor: 'force' }; }
  });
  test('movement with a factor', () => {
    assert.deepEqual(movementWithFactor({ walk: 10, run: 30 }, 2), { walk: 20, run: 60 });
    assert.deepEqual(movementWithFactor({ walk: 10, run: 25 }, 0.25), { walk: 3, run: 6 });
    assert.deepEqual(movementWithFactor({ walk: 10, run: 30 }, 0), { walk: 10, run: 30 });
    assert.deepEqual(movementWithFactor({ walk: 10, run: 30 }, -1), { walk: 10, run: 30 });
    assert.deepEqual(movementWithFactor({ walk: 10, run: 30 }, NaN), { walk: 10, run: 30 });
    assert.deepEqual(movementWithFactor({ walk: -4, run: 30 }, 1), { walk: 0, run: 30 });
  });
  test('labels', () => {
    assert.equal(powerModifierLabel('concealment'), 'Concealment');
    assert.equal(powerModifierLabel('fear'), 'Fear');
    assert.equal(powerModifierLabel('guard'), 'Guard');
    assert.equal(powerModifierLabel('paralyzingHowl'), 'ParalyzingHowl');
    assert.equal(powerModifierLabel(''), '');
  });
});

describe('v0.56.0 adept budget: free powers', () => {
  test('a power that costs nothing is never switched off', () => {
    const r = adeptBudget([{ id: 'a', cost: 2 }, { id: 'b', cost: 2 }, { id: 'free', cost: 0 }], 3);
    assert.deepEqual(r.over, ['b']);
  });
});
