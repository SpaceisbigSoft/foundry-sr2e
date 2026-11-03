import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { RULES } from '../config.ts';
import { CHARACTERS_V73 } from '../config73/characters.ts';
import {
  skillRollMemoryFields, negotiationAttribute, lifestyleStanding, lifestyleStatusText, creationLifestylePatch, outrightPurchase,
  lifestyleLevelChangePatch, timedNewSkillSystem, skillBandAttribute, racialNatural, racialFloorProblems, racialFloorWarnings,
  racialFloorRow, attributeRaiseBase, npcRatings, npcStartingKarmaPool, metatypeIds, metatypeKnown, metatypeOptions, canonicalSkillName,
  canonicalSkillNames, sameSkillName, exceptionalAttributeBonus, attributeMaximumsWith, attributeLimitsWith, surplusFlawBonus,
  attributeKarmaCost,
} from '../charfix.ts';

const R = RULES as any;
const M = CHARACTERS_V73 as any;
/** Set a dotted path on an object for the length of fn. */
const withOn = (root: any, path: string, value: unknown, fn: () => void) => {
  const keys = path.split('.');
  const last = keys.pop()!;
  const o = keys.reduce((x, k) => x[k], root);
  const old = o[last];
  o[last] = value;
  try { fn(); } finally { o[last] = old; }
};
const withRule = (path: string, value: unknown, fn: () => void) => withOn(M, path, value, fn);
const DAY = 86400;
const MONTH = RULES.UPKEEP.monthDays * DAY;

describe('v0.73.0 O29: the skill dialog does not remember the complementary skill', () => {
  test('only Use specialization / concentration by default', () => {
    assert.deepEqual(skillRollMemoryFields(), ['useSpec', 'useConc']);
  });
  test('the old way brings comp back; helpers never', () => {
    withRule('rollMemory.rememberComplementary', true, () => assert.deepEqual(skillRollMemoryFields(), ['useSpec', 'useConc', 'comp']));
    withRule('rollMemory.skillFields', ['useSpec', 'helper', 'comp'], () => assert.deepEqual(skillRollMemoryFields(), ['useSpec']));
  });
});

describe('v0.73.0 O30: Negotiation reads the opposed-attribute house rule', () => {
  test('the house-rule key is used (willpower by default)', () => {
    assert.equal(negotiationAttribute(), RULES.CHARACTERS_V58.negotiation.opposedAttribute);
    withOn(R.CHARACTERS_V58.negotiation, 'opposedAttribute', 'intelligence', () => assert.equal(negotiationAttribute(), 'intelligence'));
  });
  test('switch off or a bad value: the SOCIAL table (Willpower since the v0.77.0 book check)', () => {
    withRule('negotiation.useOpposedAttribute', false, () => assert.equal(negotiationAttribute(), 'willpower'));
    withOn(R.CHARACTERS_V58.negotiation, 'opposedAttribute', 'strength', () => assert.equal(negotiationAttribute(), 'willpower'));
  });
});

describe('v0.73.0 O31: a lifestyle bought outright is owned for good', () => {
  test('outright never lapses, even decades later', () => {
    const st = lifestyleStanding({ paidUntil: 0, now: 30 * 365 * DAY, outright: true });
    assert.deepEqual(st, { days: null, permanent: true, overdue: false });
    assert.match(lifestyleStatusText(st), /Owned outright/);
  });
  test('rented: days left or overdue as before; switch off ignores the flag', () => {
    assert.deepEqual(lifestyleStanding({ paidUntil: 10 * DAY, now: 0 }), { days: 10, permanent: false, overdue: false });
    assert.equal(lifestyleStanding({ paidUntil: 0, now: 3 * DAY }).days, -3);
    assert.equal(lifestyleStanding({ paidUntil: -1, now: 0 }).days, null);
    withRule('lifestyle.outrightPermanent', false, () => assert.equal(lifestyleStanding({ paidUntil: 0, now: 3 * DAY, outright: true }).overdue, true));
    assert.equal(lifestyleStatusText({ days: -1 }), '1 day overdue');
    assert.equal(lifestyleStatusText({ days: null }), 'Not paid yet');
  });
  test('finishing creation: outright sets the flag; months pay ahead; old way 100 months', () => {
    assert.deepEqual(creationLifestylePatch({ outright: true, months: 1, now: 500 }), { 'system.lifestyle.outright': true, 'system.lifestyle.paidUntil': 500 });
    assert.deepEqual(creationLifestylePatch({ outright: false, months: 2, now: 0 }), { 'system.lifestyle.outright': false, 'system.lifestyle.paidUntil': 2 * MONTH });
    withRule('lifestyle.outrightPermanent', false, () => {
      const months = RULES.STREET_V61.creation.lifestyleOutright.months;
      assert.equal(creationLifestylePatch({ outright: true, months: 1, now: 0 })['system.lifestyle.paidUntil'], months * MONTH);
    });
  });
  test('buying outright after creation at the creation price', () => {
    const life = RULES.UPKEEP.lifestyles.find((l) => l.id === 'middle') ?? RULES.UPKEEP.lifestyles[2]!;
    const price = RULES.STREET_V61.creation.lifestyleOutright.months * life.cost;
    const ok = outrightPurchase({ lifestyle: life.id, paidUntil: 3 * MONTH, now: 0, nuyen: price });
    assert.equal(ok.ok, true);
    assert.equal(ok.cost, price);
    assert.equal(outrightPurchase({ lifestyle: life.id, paidUntil: 0, now: 0, nuyen: price - 1 }).ok, false);
    assert.equal(outrightPurchase({ lifestyle: life.id, outright: true, paidUntil: 0, now: 0, nuyen: price }).ok, false);
    withRule('lifestyle.creditPaidMonths', true, () => assert.equal(outrightPurchase({ lifestyle: life.id, paidUntil: 3 * MONTH, now: 0, nuyen: price }).cost, price - 3 * life.cost));
    withRule('lifestyle.buyLater', false, () => assert.equal(outrightPurchase({ lifestyle: life.id, paidUntil: 0, now: 0, nuyen: price }).ok, false));
  });
  test('a new lifestyle level is rented, unpaid from now', () => {
    assert.deepEqual(lifestyleLevelChangePatch({ from: 'middle', to: 'high', outright: true, now: 7 }), { 'system.lifestyle.outright': false, 'system.lifestyle.paidUntil': 7 });
    assert.deepEqual(lifestyleLevelChangePatch({ from: 'middle', to: 'middle', outright: true, now: 7 }), {});
    assert.deepEqual(lifestyleLevelChangePatch({ from: 'middle', to: 'high', outright: false, now: 7 }), {});
    withRule('lifestyle.keepOnLevelChange', true, () => assert.deepEqual(lifestyleLevelChangePatch({ from: 'middle', to: 'high', outright: true, now: 7 }), {}));
  });
});

describe('v0.73.0 O32: a skill trained with time keeps its specialization', () => {
  test('kept by name at rating 0', () => {
    const r = timedNewSkillSystem({ kind: 'active', attribute: 'quickness', spec: 'Pistols' });
    assert.deepEqual(r.system, { kind: 'active', attribute: 'quickness', rating: 0, specialization: 'Pistols', specializationRating: 0 });
    assert.match(r.note, /Pistols/);
    assert.equal(timedNewSkillSystem({ kind: 'active', attribute: 'quickness', spec: ' ' }).note, '');
  });
  test('switch off: dropped (the old way), with a note', () => {
    withRule('training.keepSpecialization', false, () => {
      const r = timedNewSkillSystem({ kind: 'active', attribute: 'quickness', spec: 'Pistols' });
      assert.equal('specialization' in r.system, false);
      assert.match(r.note, /isn't kept/);
    });
  });
});

describe('v0.73.0 O33: the picker and Spend Karma read the same Reaction', () => {
  const attrs = { quickness: { natural: 4, total: 6 }, intelligence: { natural: 4, total: 4 }, body: { natural: 5, total: 7 } };
  test('natural for both by default', () => {
    assert.equal(skillBandAttribute('reaction', attrs, { derivedReaction: 9, caller: 'picker' }), 4);
    assert.equal(skillBandAttribute('reaction', attrs, { derivedReaction: 9, caller: 'improve' }), 4);
    assert.equal(skillBandAttribute('body', attrs, { caller: 'picker' }), 5);
  });
  test('augmented basis: derived Reaction and totals for both', () => {
    withRule('skillCost.basis', 'augmented', () => {
      assert.equal(skillBandAttribute('reaction', attrs, { derivedReaction: 9, caller: 'improve' }), 9);
      assert.equal(skillBandAttribute('body', attrs, { caller: 'improve' }), 7);
    });
  });
  test('old way: the picker reads derived Reaction, improve() natural', () => {
    withRule('skillCost.agree', false, () => {
      assert.equal(skillBandAttribute('reaction', attrs, { derivedReaction: 9, caller: 'picker' }), 9);
      assert.equal(skillBandAttribute('reaction', attrs, { derivedReaction: 9, caller: 'improve' }), 4);
    });
  });
});

describe('v0.73.0 O34: racial modifiers cannot take an attribute below 1', () => {
  test('a troll with base Charisma 1: natural 1 (floor), a warning and a failed build row', () => {
    assert.deepEqual(racialNatural(1, -2), { natural: 1, floored: true });
    assert.deepEqual(racialNatural(4, -2), { natural: 2, floored: false });
    const p = racialFloorProblems('troll', { charisma: 1, intelligence: 3, body: 1 });
    assert.deepEqual(p.map((x) => [x.key, x.needBase]), [['charisma', 3]]);
    assert.match(racialFloorWarnings('troll', { charisma: 1 })[0]!, /at least 3/);
    const row = racialFloorRow('troll', { charisma: 1 });
    assert.equal(row?.ok, false);
    assert.equal(racialFloorRow('troll', { charisma: 3 }), null);
    assert.deepEqual(racialFloorProblems('troll', { charisma: 1 }, false), []);
  });
  test('raising a floored attribute with Karma reaches the new rating for real', () => {
    assert.equal(attributeRaiseBase(1, -1, 2), 4);
    assert.equal(attributeRaiseBase(4, 2, 3), 5);
    assert.equal(attributeRaiseBase(4, 5, 6), 5);
  });
  test("'warn' warns without flooring; 'off' is the old way", () => {
    withRule('racialFloor.mode', 'warn', () => {
      assert.deepEqual(racialNatural(1, -2), { natural: -1, floored: false });
      assert.equal(racialFloorProblems('troll', { charisma: 1 }).length, 1);
    });
    withRule('racialFloor.mode', 'off', () => {
      assert.equal(racialNatural(1, -2).natural, -1);
      assert.equal(racialFloorRow('troll', { charisma: 1 }), null);
    });
  });
});

describe('v0.73.0 O35: generated NPCs: Threat Rating, Professional Rating 1–4, no grunt Karma Pool', () => {
  test('Threat Level 0 and 5', () => {
    assert.deepEqual(npcRatings({ threat: 0, grunts: 3, tablePr: 0, tableKarmaPool: 0 }), { threatRating: 0, professionalRating: 1, karmaPool: 0 });
    assert.deepEqual(npcRatings({ threat: 5, grunts: 1, tablePr: 5, tableKarmaPool: 5 }), { threatRating: 5, professionalRating: 4, karmaPool: 0 });
    assert.equal(npcRatings({ threat: 9, tablePr: 5, tableKarmaPool: 5 }).professionalRating, 4);
  });
  test('switches: singles, all, table PR, no Threat Rating (the old way)', () => {
    withRule('npcs.karmaPool', 'singles', () => {
      assert.equal(npcRatings({ threat: 3, grunts: 1, tablePr: 3, tableKarmaPool: 2 }).karmaPool, 2);
      assert.equal(npcRatings({ threat: 3, grunts: 4, tablePr: 3, tableKarmaPool: 2 }).karmaPool, 0);
    });
    withRule('npcs.karmaPool', 'all', () => assert.equal(npcRatings({ threat: 3, grunts: 4, tablePr: 3, tableKarmaPool: 2 }).karmaPool, 2));
    withRule('npcs.professionalFromTable', true, () => assert.equal(npcRatings({ threat: 0, tablePr: 0, tableKarmaPool: 0 }).professionalRating, 0));
    withRule('npcs.threatRating', false, () => assert.equal(npcRatings({ threat: 4, tablePr: 4, tableKarmaPool: 0 }).threatRating, 0));
  });
  test('a hand-made NPC starts with Karma Pool 0 unless given one', () => {
    assert.equal(npcStartingKarmaPool('npc', { name: 'Guard' }), 0);
    assert.equal(npcStartingKarmaPool('npc', { system: { karma: { pool: 3 } } }), null);
    assert.equal(npcStartingKarmaPool('character', {}), null);
    withRule('npcs.handMadeKarmaPool', null, () => assert.equal(npcStartingKarmaPool('npc', {}), null));
  });
});

describe('v0.73.0 O36: metatypes read at call time', () => {
  test('a house-rule metatype is listed and known; an unknown id is kept on the select', () => {
    const types = R.METATYPES.types;
    types.gnome = { label: 'Gnome', mods: { willpower: 1 }, vision: {}, reach: 0, dermal: 0, toxinDice: 0, run: 3 };
    try {
      assert.ok(metatypeIds().includes('gnome'));
      assert.equal(metatypeKnown('gnome'), true);
      assert.ok(metatypeOptions('gnome').some((o) => o.key === 'gnome' && o.label === 'Gnome'));
    } finally { delete types.gnome; }
    assert.equal(metatypeKnown('gnome'), false);
    assert.equal(metatypeKnown('toString'), false);
    const opts = metatypeOptions('gnome');
    assert.match(opts.find((o) => o.key === 'gnome')!.label, /not in the metatype list/);
    withRule('metatypes.open', false, () => assert.equal(metatypeOptions('gnome').some((o) => o.key === 'gnome'), false));
  });
});

describe('v0.73.0 O37: one name per skill', () => {
  test('aliases go to the vehicle tests’ names', () => {
    assert.equal(canonicalSkillName('Rotorcraft'), 'Rotor Aircraft');
    assert.equal(canonicalSkillName('Vectored Thrust'), 'Vector Thrust Aircraft');
    assert.equal(canonicalSkillName('fixed wing aircraft'), 'Fixed-Wing Aircraft');
    assert.equal(canonicalSkillName('Car'), 'Car');
    const rotor = RULES.VEHICLES.categories.find((c) => c.id === 'rotor')!.skill;
    assert.equal(canonicalSkillName('Rotorcraft'), rotor);
    const vt = RULES.VEHICLES.categories.find((c) => c.id === 'vectorThrust')!.skill;
    assert.equal(canonicalSkillName('Vectored Thrust'), vt);
  });
  test('lists dedupe, and an old skill still matches', () => {
    assert.deepEqual(canonicalSkillNames(['Car', 'Rotorcraft', 'Rotor Aircraft']), ['Car', 'Rotor Aircraft']);
    assert.equal(sameSkillName('Rotorcraft', 'rotor aircraft'), true);
    assert.equal(sameSkillName('Car', 'Bike'), false);
    withRule('skillNames.canonical', false, () => {
      assert.equal(canonicalSkillName('Rotorcraft'), 'Rotorcraft');
      assert.equal(sameSkillName('Rotorcraft', 'Rotor Aircraft'), false);
    });
  });
});

describe('v0.73.0 O38: Exceptional Attribute, surplus flaws, a dearer Karma band', () => {
  const edge = [{ name: 'Exceptional Attribute', kind: 'edge' as const, points: 2, target: 'Strength' }];
  test('Exceptional Attribute raises the racial maximum by 1 (with edges and flaws on)', () => {
    withOn(R.STREET.qualities, 'enabled', true, () => {
      assert.equal(exceptionalAttributeBonus(edge, 'strength'), 1);
      assert.equal(exceptionalAttributeBonus(edge, 'body'), 0);
      assert.deepEqual(attributeMaximumsWith('human', 'strength', edge), { natural: 7, augmented: Math.floor(7 * RULES.METATYPES.augmentedMultiplier) });
      assert.equal(attributeLimitsWith('human', { strength: { natural: 7, total: 7 } }, edge).warnings.length, 0);
      assert.equal(attributeLimitsWith('human', { strength: { natural: 7, total: 7 } }, []).warnings.length, 1);
      withRule('qualities.exceptionalAttribute.enabled', false, () => assert.equal(exceptionalAttributeBonus(edge, 'strength'), 0));
    });
    assert.equal(exceptionalAttributeBonus(edge, 'strength'), RULES.STREET.qualities.enabled ? 1 : 0);
  });
  test('surplus flaw points: none by default; skills when the house rule is on', () => {
    const list = [{ name: 'Bad Rep', kind: 'flaw' as const, points: 3 }, { name: 'Ambidextrous', kind: 'edge' as const, points: 1 }];
    withOn(R.STREET.qualities, 'enabled', true, () => {
      assert.deepEqual(surplusFlawBonus(list), { points: 0, attributes: 0, skills: 0, nuyen: 0 });
      withRule('qualities.surplusFlaws.use', 'skills', () => assert.deepEqual(surplusFlawBonus(list), { points: 2, attributes: 0, skills: 2, nuyen: 0 }));
      withRule('qualities.surplusFlaws.use', 'nuyen', () => assert.equal(surplusFlawBonus(list).nuyen, 2 * M.qualities.surplusFlaws.nuyenPerPoint));
    });
  });
  test('Karma above the racial maximum: refused by default (SR2), the dearer band as a house rule', () => {
    assert.deepEqual(attributeKarmaCost({ to: 5, max: 6 }), { cost: Math.ceil(5 * RULES.UPKEEP.karma.attributeMultiplier), ok: true, reason: '', band: 'normal' });
    assert.equal(attributeKarmaCost({ to: 7, max: 6 }).ok, false);
    withRule('qualities.karmaAboveRacial.enabled', true, () => {
      assert.deepEqual(attributeKarmaCost({ to: 7, max: 6, augmented: 9 }), { cost: 21, ok: true, reason: '', band: 'aboveRacial' });
      assert.equal(attributeKarmaCost({ to: 10, max: 6, augmented: 9 }).ok, false);
    });
  });
});

describe('v0.73.0 review fixes (lifestyle)', () => {
  test('a level change with outrightPermanent off leaves the rent alone (the old way)', () => {
    const was = M.lifestyle.outrightPermanent;
    M.lifestyle.outrightPermanent = false;
    try { assert.deepEqual(lifestyleLevelChangePatch({ from: 'middle', to: 'high', outright: true, now: 7 }), {}); }
    finally { M.lifestyle.outrightPermanent = was; }
  });
});
