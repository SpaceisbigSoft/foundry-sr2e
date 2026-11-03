import { test, describe, afterEach, before, after } from 'node:test';
import { oldWay } from './oldway.ts';
import assert from '../../__tests__/helpers/assert-rows.ts';
import { RULES } from '../config.ts';
import {
  invisibilityResistTest, seesThrough, effectiveConcealment, spiritInitiative, totemDrawback, berserkTest, berserkTurns,
  berserkTriggered, isDaylight, daylightModifier, HOLD_SPECIALS, holdEffect, breakFreeTest, spellAttributesAfterCyber,
  linkTrackTest, exclusiveBlock, repeatDue, spiritOnMasterDeath, fleshBonus, fleshFormAttributes, insectForm,
} from '../glamour.ts';

const R = RULES as any;
const saved = structuredClone(RULES.MAGIC_V61);
const savedNs = structuredClone(RULES.MAGIC_V56.natureSpirits);
afterEach(() => { R.MAGIC_V61 = structuredClone(saved); R.MAGIC_V56.natureSpirits = structuredClone(savedNs); });
const V = () => R.MAGIC_V61;
const H = 3600;

describe('v0.61.0 invisibility', () => {
  test('resist test: Intelligence vs Force', () => {
    assert.deepEqual(invisibilityResistTest({ intelligence: 5, force: 4 }), { dice: 5, tn: 4 });
  });
  test('bad input: no negative dice, TN at least 2', () => {
    assert.deepEqual(invisibilityResistTest({ intelligence: NaN, force: -3 } as any), { dice: 0, tn: 2 });
    assert.deepEqual(invisibilityResistTest(null as any), { dice: 0, tn: 2 });
  });
  test('sees through only on more successes; zero never', (t) => {
    t.after(oldWay({"BOOK_V78.invisibility.mode": "resist"})); // v0.78.0: the old rule (a house rule)
    assert.equal(seesThrough(3, 2), true);
    assert.equal(seesThrough(2, 2), false);
    assert.equal(seesThrough(0, 0), false);
    assert.equal(seesThrough(NaN, 1), false);
  });
  test('house rule: ties go to observer; resist off', () => {
    V().invisibility.beat = 'greaterOrEqual';
    assert.equal(seesThrough(2, 2), true);
    V().invisibility.resist = false;
    assert.equal(seesThrough(5, 0), false);
  });
  test('effective concealment', () => {
    assert.equal(effectiveConcealment({ kind: 'invisibility', rating: 4, observerAstral: false, seenThrough: false }), 4);
    assert.equal(effectiveConcealment({ kind: 'invisibility', rating: 4, observerAstral: false, seenThrough: true }), 0);
    assert.equal(effectiveConcealment({ kind: 'invisibility', rating: 4, observerAstral: true, seenThrough: false }), 0);
    assert.equal(effectiveConcealment({ kind: 'improvedInvisibility', rating: 6, observerAstral: true, seenThrough: false }), 0);
    assert.equal(effectiveConcealment({ kind: 'smoke', rating: 3, observerAstral: true, seenThrough: true }), 3);
    assert.equal(effectiveConcealment({ kind: 'invisibility', rating: NaN, observerAstral: false, seenThrough: false } as any), 0);
  });
  test('house rule: astral does not see physical invisibility', () => {
    V().invisibility.astralSeesPhysical = false;
    assert.equal(effectiveConcealment({ kind: 'improvedInvisibility', rating: 6, observerAstral: true, seenThrough: false }), 6);
    assert.equal(effectiveConcealment({ kind: 'invisibility', rating: 6, observerAstral: true, seenThrough: false }), 0);
  });
});

describe('v0.61.0 spirit initiative', () => {
  test('kind defaults', () => {
    const n = spiritInitiative({ kind: 'nature', reaction: 5, materialized: true });
    assert.deepEqual({ ...n, label: undefined }, { reactionBonus: 10, diceBonus: 0, astral: false, label: undefined });
    assert.match(n.label, /15/);
    assert.equal(spiritInitiative({ kind: 'ally', reaction: 5, materialized: true }).reactionBonus, 10); // v0.77.0: every spirit +10 manifest
    assert.equal(spiritInitiative({ kind: 'watcher', reaction: 5, materialized: true }).reactionBonus, 10);
  });
  test('template non-zero values replace the default', () => {
    const r = spiritInitiative({ kind: 'elemental', reaction: 4, materialized: true, template: { reactionBonus: 0, initiativeDiceBonus: 2 } });
    assert.equal(r.reactionBonus, 10);
    assert.equal(r.diceBonus, 2);
    assert.equal(spiritInitiative({ kind: 'elemental', reaction: 4, materialized: true, template: { reactionBonus: 5 } }).reactionBonus, 5);
  });
  test('astral when unmaterialized', () => {
    const r = spiritInitiative({ kind: 'nature', reaction: 4, materialized: false });
    assert.equal(r.astral, true);
    assert.equal(r.reactionBonus, 20); // v0.77.0: +20 in astral form
    assert.match(r.label, /astral/);
    V().spiritInitiative.astralWhenUnmaterialized = false;
    assert.equal(spiritInitiative({ kind: 'nature', reaction: 4, materialized: false }).astral, false);
  });
  test('bad input never throws', () => {
    const r = spiritInitiative({ kind: undefined, reaction: NaN, materialized: true, template: null } as any);
    assert.equal(r.reactionBonus, 10); // v0.77.0: the 'other' row
    assert.equal(r.diceBonus, 0);
  });
  test('house rule: kind table override', () => {
    V().spiritInitiative.byKind.ally = { reaction: 5, dice: 1 };
    assert.deepEqual([spiritInitiative({ kind: 'ally', reaction: 3, materialized: true }).reactionBonus, spiritInitiative({ kind: 'ally', reaction: 3, materialized: true }).diceBonus], [5, 1]);
  });
});

describe('v0.61.0 totem drawbacks', () => {
  test('presets by name, case-insensitive', () => {
    assert.deepEqual(totemDrawback({ name: 'bear' }), { berserk: 'wounded', daylightTn: 0 });
    assert.deepEqual(totemDrawback({ name: ' WOLF ' }), { berserk: 'combat', daylightTn: 0 });
    assert.deepEqual(totemDrawback({ name: 'Owl' }), { berserk: '', daylightTn: 2 });
    assert.deepEqual(totemDrawback({ name: 'Raccoon' }), { berserk: '', daylightTn: 0 });
  });
  test('explicit fields win', () => {
    assert.deepEqual(totemDrawback({ name: 'Bear', berserk: 'combat', daylightTn: 1 }), { berserk: 'combat', daylightTn: 1 });
    assert.deepEqual(totemDrawback({ name: 'Raccoon', berserk: 'wounded' }), { berserk: 'wounded', daylightTn: 0 });
  });
  test('bad input', () => {
    assert.deepEqual(totemDrawback(null as any), { berserk: '', daylightTn: 0 });
    assert.deepEqual(totemDrawback({ name: 'Owl', berserk: 'nonsense', daylightTn: -4 }), { berserk: '', daylightTn: 2 });
  });
  test('berserk test and turns', () => {
    assert.deepEqual(berserkTest({ willpower: 4 }), { dice: 4, tn: 4 });
    assert.deepEqual(berserkTest({ willpower: -1 }), { dice: 0, tn: 4 });
    assert.equal(berserkTurns(1), 2);
    assert.equal(berserkTurns(5), 0);
    assert.equal(berserkTurns(NaN), 3);
    V().totems.berserk.turnsBase = 6;
    V().totems.berserk.tn = 5;
    assert.equal(berserkTurns(1), 5);
    assert.equal(berserkTest({ willpower: 4 }).tn, 5);
  });
  test('berserk triggers', () => {
    const w = { berserk: 'wounded' as const, daylightTn: 0 };
    const c = { berserk: 'combat' as const, daylightTn: 0 };
    assert.equal(berserkTriggered(w, { damaged: true, inCombat: false }), true);
    assert.equal(berserkTriggered(w, { damaged: false, inCombat: true }), false);
    assert.equal(berserkTriggered(c, { damaged: false, inCombat: true }), true);
    assert.equal(berserkTriggered({ berserk: '', daylightTn: 0 }, { damaged: true, inCombat: true }), false);
    assert.equal(berserkTriggered(null, null as any), false);
  });
  test('daylight from arcanum sunrise/sunset', () => {
    assert.equal(isDaylight(12 * H), true);
    assert.equal(isDaylight(6 * H), true);
    assert.equal(isDaylight(18 * H), false);
    assert.equal(isDaylight(2 * H), false);
    assert.equal(isDaylight(NaN), false);
    assert.deepEqual(daylightModifier({ daylightTn: 2 }, 12 * H), { label: 'Totem: daylight', value: 2 });
    assert.equal(daylightModifier({ daylightTn: 2 }, 23 * H), null);
    assert.equal(daylightModifier({ daylightTn: 0 }, 12 * H), null);
    assert.equal(daylightModifier(null, 12 * H), null);
  });
  test('daylight follows MAGIC_V56 and the hours override', () => {
    R.MAGIC_V56.natureSpirits.sunrise = 8;
    assert.equal(isDaylight(7 * H), false);
    V().totems.daylight = { source: 'hours', fromHour: 20, toHour: 4 };
    assert.equal(isDaylight(22 * H), true);
    assert.equal(isDaylight(12 * H), false);
  });
});

describe('v0.61.0 hold powers', () => {
  test('list', () => assert.deepEqual([...HOLD_SPECIALS], ['paralysis', 'petrification', 'binding']));
  test('paralysis turns = successes, min 1', () => {
    assert.deepEqual(holdEffect('paralysis', { force: 5, successes: 3 }), { status: 'paralysis', turns: 3, blocksActions: true, armorBonus: 0, breakTest: null });
    assert.equal(holdEffect('paralysis', { force: 5, successes: 0 })!.turns, 1);
    V().holdPowers.paralysis.turnsPer = 'force';
    assert.equal(holdEffect('paralysis', { force: 5, successes: 0 })!.turns, 5);
  });
  test('petrification until dropped', () => {
    assert.deepEqual(holdEffect('petrification', { force: 4, successes: 2 }), { status: 'sr2ePetrified', turns: 0, blocksActions: true, armorBonus: 0, breakTest: null });
    V().holdPowers.petrification.armorBonus = 4;
    assert.equal(holdEffect('petrification', { force: 4, successes: 2 })!.armorBonus, 4);
  });
  test('binding break test vs Force', () => {
    assert.deepEqual(holdEffect('binding', { force: 6, successes: 1 }), { status: 'restrain', turns: 0, blocksActions: false, armorBonus: 0, breakTest: { attribute: 'strength', tn: 6 } });
    assert.deepEqual(breakFreeTest({ attribute: 5, force: 6 }), { dice: 5, tn: 6 });
    assert.deepEqual(breakFreeTest({ attribute: NaN, force: 0 } as any), { dice: 0, tn: 2 });
  });
  test('other specials and bad input', () => {
    assert.equal(holdEffect('fear', { force: 4, successes: 2 }), null);
    assert.equal(holdEffect(undefined as any, null as any), null);
    assert.equal(holdEffect('binding', null as any)!.breakTest!.tn, 2);
  });
});

describe('v0.61.0 Increase [Attribute] vs cyberware', () => {
  test('switched off (house rule; on by default since v0.77.0): spell passes through', () => {
    V().attributeSpells.exclusiveWithCyber = false;
    assert.deepEqual(spellAttributesAfterCyber({ strength: 2, quickness: 1 }, { strength: 2 }), { attributes: { strength: 2, quickness: 1 }, dropped: [] });
  });
  test('house rule on: cyber-raised attributes dropped', () => {
    V().attributeSpells.exclusiveWithCyber = true;
    assert.deepEqual(spellAttributesAfterCyber({ strength: 2, quickness: 1, body: 0 }, { strength: 2, quickness: 0, body: 1 }), { attributes: { strength: 0, quickness: 1, body: 0 }, dropped: ['strength'] });
  });
  test('bad input', () => {
    V().attributeSpells.exclusiveWithCyber = true;
    assert.deepEqual(spellAttributesAfterCyber(null as any, null as any), { attributes: {}, dropped: [] });
    assert.deepEqual(spellAttributesAfterCyber({ strength: 'x' as any }, { strength: 1 }), { attributes: { strength: 0 }, dropped: [] });
  });
});

describe('v0.61.0 magical links', () => {
  test('test and label', () => {
    assert.deepEqual(linkTrackTest({ dice: 6, kind: 'spirit', force: 4 }), { dice: 6, tn: 4, modifiers: [], label: 'Follow link: Bound spirit' });
    assert.equal(linkTrackTest({ dice: 6, kind: 'odd', force: 4 }).label, 'Follow link: Magical link');
    assert.equal(linkTrackTest(null as any).dice, 0);
  });
  test('house rule: Force modifier', () => {
    V().links.forceModifier = -1;
    assert.deepEqual(linkTrackTest({ dice: 6, kind: 'spell', force: 3 }).modifiers, [{ label: 'Link Force 3', value: -3 }]);
  });
});

describe('v0.61.0 exclusive spells', () => {
  const ex = [{ spellName: 'Shapechange', exclusive: true }];
  const plain = [{ spellName: 'Armor' }];
  test('casting while sustaining exclusive', () => {
    assert.match(exclusiveBlock({ sustaining: ex, action: 'cast' })!, /Shapechange/);
    assert.equal(exclusiveBlock({ sustaining: plain, action: 'cast' }), null);
    assert.equal(exclusiveBlock({ sustaining: [], action: 'cast', newSpellExclusive: true }), null);
  });
  test('casting exclusive while sustaining others', () => {
    assert.match(exclusiveBlock({ sustaining: plain, action: 'cast', newSpellExclusive: true })!, /Armor/);
    V().exclusive.blocksSustainingOthers = false;
    assert.equal(exclusiveBlock({ sustaining: plain, action: 'cast', newSpellExclusive: true }), null);
  });
  test('other tests only with blocksAllTests', () => {
    assert.equal(exclusiveBlock({ sustaining: ex, action: 'test' }), null);
    V().exclusive.blocksAllTests = true;
    assert.match(exclusiveBlock({ sustaining: ex, action: 'test' })!, /no other tests/);
    V().exclusive.blocksCasting = false;
    assert.equal(exclusiveBlock({ sustaining: ex, action: 'cast' }), null);
  });
  test('bad input', () => {
    assert.equal(exclusiveBlock(null as any), null);
    assert.equal(exclusiveBlock({ sustaining: [null, { exclusive: true }] as any, action: 'cast' }), "Sustaining exclusive spell a spell: can't cast.");
  });
});

describe('v0.61.0 repeating powers', () => {
  test('due rules', () => {
    assert.equal(repeatDue(null, { combatId: 'a', round: 1 }), true);
    assert.equal(repeatDue({ combatId: 'a', round: 1 }, { combatId: 'a', round: 1 }), false);
    assert.equal(repeatDue({ combatId: 'a', round: 1 }, { combatId: 'a', round: 2 }), true);
    assert.equal(repeatDue({ combatId: 'a', round: 3 }, { combatId: 'b', round: 1 }), true);
    assert.equal(repeatDue({}, { combatId: 'a', round: 1 }), true);
  });
  test('autoPrompt off', () => {
    V().repeating.autoPrompt = false;
    assert.equal(repeatDue(null, { combatId: 'a', round: 1 }), false);
  });
});

describe('v0.61.0 bound spirits on master death', () => {
  test('default: goes free', () => {
    assert.deepEqual(spiritOnMasterDeath('elemental'), { action: 'free', update: { 'system.summonerUuid': '', 'system.spiritKind': 'free', 'system.services': 0 }, note: 'Master dead: the spirit goes free.' });
  });
  test('free spirits unaffected', () => assert.equal(spiritOnMasterDeath('free').action, 'none'));
  test('mode argument and config override', () => {
    assert.equal(spiritOnMasterDeath('nature', 'depart').action, 'depart');
    assert.deepEqual(spiritOnMasterDeath('nature', 'none').update, {});
    assert.equal(spiritOnMasterDeath('nature', 'garbage').action, 'none');
    V().masterDies = 'depart';
    assert.equal(spiritOnMasterDeath('ally').action, 'depart');
  });
  test('bad input', () => assert.equal(spiritOnMasterDeath(undefined as any).action, 'free'));
});

describe('v0.61.0 insect spirits', () => {
  // v0.78.0: these pin the old half-Force rule (BOOK_V78.insectFlesh 'halfForce', a house rule).
  let restore: () => void = () => {};
  before(() => { restore = oldWay({ 'BOOK_V78.insectFlesh.mode': 'halfForce' }); });
  after(() => restore());
  test('flesh form adds half Force', () => {
    assert.equal(fleshBonus(5), 2);
    assert.deepEqual(fleshFormAttributes({ body: 4, quickness: 3, strength: 5 }, 6), { body: 7, quickness: 6, strength: 8 });
  });
  test('house rule bonus', () => {
    V().insect.fleshAttributeBonus = 'force';
    assert.equal(fleshBonus(5), 5);
    V().insect.fleshAttributeBonus = 'none';
    assert.deepEqual(fleshFormAttributes({ body: 4, quickness: 3, strength: 5 }, 6), { body: 4, quickness: 3, strength: 5 });
  });
  test('bad input', () => {
    assert.deepEqual(fleshFormAttributes(null as any, NaN), { body: 0, quickness: 0, strength: 0 });
    assert.equal(insectForm(null as any), 'true');
  });
  test('form from host', () => {
    assert.equal(insectForm({ hostUuid: 'Actor.abc' }), 'flesh');
    assert.equal(insectForm({ hostUuid: '  ' }), 'true');
  });
});
