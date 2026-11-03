import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  paymentChoices, rowAmount, entrySummary, entryPrice, entryAvailability, newSkillKarma, newSpellKarma, skillAttributeFor, basketPlan, systemWithAmount, copiesOf,
  matchesSearch, setupWarnings, tabForType, findForType, pinAction, cleanPins, togglePin, copyName, foldKey, ADD_TYPES, skillCost, RULES, amountLocked, amountMax, gearStackKey, type SetupInput,
} from '../index.ts';

const base: SetupInput = {
  actorType: 'character',
  attributes: [{ key: 'body', label: 'Body', base: 3 }, { key: 'quickness', label: 'Quickness', base: 4 }],
  attributeWarnings: [], essence: 6, cyberWarnings: [], adeptOver: [], magic: 0,
  skills: [{ name: 'Firearms' }], items: [], build: [],
};

describe('v0.63.0 catalogue: payment, prices, Karma', () => {
  test('characters can buy physical things and learn skills and spells; others add free only', () => {
    assert.deepEqual(paymentChoices('weapon', 'character'), ['free', 'buy']);
    assert.deepEqual(paymentChoices('spell', 'character'), ['free', 'karma']);
    assert.deepEqual(paymentChoices('skill', 'character'), ['free', 'karma']);
    assert.deepEqual(paymentChoices('power', 'character'), ['free']);
    assert.deepEqual(paymentChoices('weapon', 'npc'), ['free']);
  });

  test('the row number: copies for weapons, a value for gear, spells, foci', () => {
    assert.equal(rowAmount('weapon').kind, 'copies');
    assert.deepEqual(rowAmount('gear'), { kind: 'value', label: 'Qty', field: 'quantity' });
    assert.equal(rowAmount('spell').field, 'learnedForce');
    assert.equal(rowAmount('adeptpower').field, 'level');
    assert.equal(copiesOf('weapon', 3), 3);
    assert.equal(copiesOf('weapon', 0), 1);
    assert.equal(copiesOf('weapon', 500), 20, 'capped');
    assert.equal(copiesOf('gear', 5), 1);
    assert.deepEqual(systemWithAmount('spell', { learnedForce: 4, category: 'combat' }, 6), { learnedForce: 6, category: 'combat' });
    assert.deepEqual(systemWithAmount('weapon', { cost: 5 }, 3), { cost: 5 });
  });

  test('prices: cost × street index × quantity; cyberware by grade', () => {
    assert.equal(entryPrice('weapon', { cost: 450 }), 450);
    assert.equal(entryPrice('gear', { cost: 200, streetIndex: 1.5 }, 2), 600);
    assert.equal(entryPrice('cyberware', { cost: 1000, grade: 'standard' }), 1000);
    assert.ok(entryPrice('cyberware', { cost: 1000, grade: 'alpha' }) > 1000, 'alphaware costs more');
    assert.equal(entryPrice('weapon', {}), 0);
  });

  test('Availability label and TN', () => {
    assert.deepEqual(entryAvailability('weapon', { availability: '' }), { label: '', tn: 0 });
    assert.equal(entryAvailability('weapon', { availability: '6/14 days' }).tn, 6);
  });

  test('a new skill costs each step from 1, by the linked attribute', () => {
    const want = skillCost({ to: 1, attribute: 4, kind: 'active' }) + skillCost({ to: 2, attribute: 4, kind: 'active' }) + skillCost({ to: 3, attribute: 4, kind: 'active' });
    assert.equal(newSkillKarma({ rating: 3, attribute: 4, kind: 'active' }), want);
    assert.equal(newSkillKarma({ rating: 0, attribute: 4, kind: 'active' }), 0);
    assert.ok(newSkillKarma({ rating: 3, attribute: 4, kind: 'active', specialization: true, specializationRating: 4 }) > want, 'a specialization above the rating adds');
    assert.ok(newSkillKarma({ rating: 3, attribute: 4, kind: 'knowledge' }) <= want, 'knowledge skills cost no more');
  });

  test('a new spell costs its Force in Karma (the house-rule rate)', () => {
    assert.equal(newSpellKarma(5), 5 * (RULES.MAGIC_EXTRA as any).karmaCosts.spellPerForce);
    assert.equal(newSpellKarma(0), newSpellKarma(1));
  });

  test('a skill\'s linked attribute from its name', () => {
    assert.equal(skillAttributeFor('Firearms', 'active'), 'quickness');
    assert.equal(skillAttributeFor('Etiquette', 'active'), 'charisma');
    assert.equal(skillAttributeFor('Car', 'active'), 'reaction');
    assert.equal(skillAttributeFor('Firearms', 'knowledge'), 'intelligence');
    assert.equal(skillAttributeFor('Car B/R', 'buildRepair'), 'intelligence');
  });
});

describe('v0.63.0 catalogue: the basket', () => {
  const pistol = { type: 'weapon', name: 'Heavy pistol', system: { cost: 450 }, amount: 2 };
  const medkit = { type: 'gear', name: 'Medkit', system: { cost: 200 }, amount: 3 };
  test('buying adds up copies and quantities', () => {
    const p = basketPlan([pistol, medkit], { payment: 'buy', actorType: 'character', nuyen: 5000, karma: 0 });
    assert.equal(p.nuyen, 900 + 600);
    assert.deepEqual(p.problems, []);
  });
  test('not enough nuyen, no price, a type that can\'t be bought', () => {
    const p = basketPlan([pistol], { payment: 'buy', actorType: 'character', nuyen: 100, karma: 0 });
    assert.match(p.problems.join(' '), /only ¥100/);
    assert.match(basketPlan([{ type: 'gear', name: 'Rock', system: {}, amount: 1 }], { payment: 'buy', actorType: 'character', nuyen: 100, karma: 0 }).problems[0]!, /no price/);
    assert.match(basketPlan([{ type: 'spell', name: 'Bolt', system: {}, amount: 4 }], { payment: 'buy', actorType: 'character', nuyen: 100, karma: 0 }).problems[0]!, /can't be bought/);
  });
  test('learning spells with Karma, and running short', () => {
    const p = basketPlan([{ type: 'spell', name: 'Bolt', system: { learnedForce: 3 }, amount: 4 }], { payment: 'karma', actorType: 'character', nuyen: 0, karma: 100 });
    assert.equal(p.karma, newSpellKarma(4));
    assert.match(basketPlan([{ type: 'spell', name: 'Bolt', system: {}, amount: 6 }], { payment: 'karma', actorType: 'character', nuyen: 0, karma: 1 }).problems.join(' '), /Good Karma/);
  });
  test('copies above the cap are neither made nor charged', () => {
    const p = basketPlan([{ type: 'weapon', name: 'Knife', system: { cost: 30 }, amount: 50 }], { payment: 'buy', actorType: 'character', nuyen: 99999, karma: 0 });
    assert.equal(p.nuyen, 30 * 20);
    assert.equal(amountMax('weapon'), 20);
    assert.equal(amountMax('gear'), 99);
  });
  test('bought foci and programs keep their listed rating and price', () => {
    assert.ok(amountLocked('focus', 'buy'));
    assert.ok(amountLocked('program', 'buy'));
    assert.ok(!amountLocked('gear', 'buy'));
    assert.ok(!amountLocked('focus', 'free'));
    assert.ok(!amountLocked('weapon', 'buy'));
    const p = basketPlan([{ type: 'focus', name: 'Power focus', system: { cost: 10000, rating: 1 }, amount: 0 }], { payment: 'buy', actorType: 'character', nuyen: 99999, karma: 0 });
    assert.equal(p.nuyen, 10000);
    assert.deepEqual(systemWithAmount('focus', { rating: 1 }, 0), { rating: 1 }, 'amount 0 leaves the rating alone');
  });
  test('gear stack keys: same name and same thing', () => {
    assert.equal(gearStackKey('Medkit', { medkitRating: 3, quantity: 1 }), gearStackKey('medkit ', { medkitRating: 3, quantity: 7, toxin: { kind: '' } }));
    assert.notEqual(gearStackKey('Medkit', { medkitRating: 3 }), gearStackKey('Medkit', { medkitRating: 6 }));
    assert.notEqual(gearStackKey('Patch', { patch: { kind: 'stim', rating: 3 } }), gearStackKey('Patch', { patch: { kind: 'tranq', rating: 3 } }));
    assert.notEqual(gearStackKey('Knife', {}), gearStackKey('Rope', {}));
    // A saved item carries its schema defaults; a template leaves them out.
    assert.equal(gearStackKey('Medkit', { cost: 200, medkitRating: 3 }), gearStackKey('Medkit', { cost: 200, medkitRating: 3, toxin: { kind: '', power: 6, level: 'M' }, chip: { kind: '', skill: '', rating: 0 }, patch: { kind: '', rating: 0 }, explosive: { power: 0 }, identity: { kind: '', rating: 0 }, material: '' }));
    assert.notEqual(gearStackKey('Dart', { toxin: { kind: 'toxin', power: 6, level: 'M' } }), gearStackKey('Dart', { toxin: { kind: 'toxin', power: 8, level: 'M' } }));
  });
  test('free costs nothing', () => {
    const p = basketPlan([pistol, medkit], { payment: 'free', actorType: 'npc', nuyen: 0, karma: 0 });
    assert.equal(p.nuyen, 0); assert.equal(p.karma, 0); assert.deepEqual(p.problems, []);
  });
});

describe('v0.63.0 catalogue: summaries, search, pins, names', () => {
  test('entry summaries', () => {
    assert.match(entrySummary('weapon', { damagePower: 9, damageLevel: 'M', modes: 'SA', skill: 'Firearms' }), /9M · SA · Firearms/);
    assert.match(entrySummary('weapon', { strengthPower: true, damagePower: 2, damageLevel: 'M', melee: true, reach: 1 }), /melee, reach 1/);
    assert.equal(entrySummary('armor', { ballistic: 5, impact: 3 }), 'B5/I3');
    assert.match(entrySummary('cyberware', { essenceCost: 0.2 }), /Essence 0.2/);
    assert.match(entrySummary('cyberware', { bioware: true, bodyIndex: 0.4 }), /Body Index 0.4/);
  });
  test('search matches every word, any order', () => {
    assert.ok(matchesSearch('Heavy pistol 9M SA', 'pistol heavy'));
    assert.ok(!matchesSearch('Heavy pistol', 'rifle'));
    assert.ok(matchesSearch('anything', '  '));
  });
  test('pins: actions per type, toggling, clean-up', () => {
    assert.equal(pinAction('weapon')!.action, 'attackWeapon');
    assert.equal(pinAction('spell')!.action, 'castSpell');
    assert.equal(pinAction('skill')!.action, 'rollSkill');
    assert.equal(pinAction('armor'), null);
    assert.deepEqual(togglePin(['a'], 'b'), ['a', 'b']);
    assert.deepEqual(togglePin(['a', 'b'], 'a'), ['b']);
    assert.deepEqual(togglePin(undefined, 'x'), ['x']);
    assert.deepEqual(cleanPins(['a', 'gone', 'a', 'b'], (id) => id !== 'gone'), ['a', 'b']);
    assert.equal(cleanPins(Array.from({ length: 20 }, (_, i) => `p${i}`), () => true).length, 12);
  });
  test('copy names never clash', () => {
    assert.equal(copyName('Knife', ['Knife']), 'Knife (copy)');
    assert.equal(copyName('Knife', ['Knife', 'Knife (copy)']), 'Knife (copy 2)');
    assert.equal(copyName('Knife (copy)', ['Knife', 'Knife (copy)']), 'Knife (copy 2)');
  });
  test('fold keys ignore counts and status words\' numbers', () => {
    assert.equal(foldKey('character', 'magic', 'Sustaining +2 TN'), foldKey('character', 'magic', 'Sustaining +4 TN'));
    assert.notEqual(foldKey('character', 'main', 'Skills'), foldKey('npc', 'main', 'Skills'));
  });
  test('every type has a tab and a heading', () => {
    for (const t of ADD_TYPES) {
      assert.ok(tabForType(t.type), t.type);
      assert.ok(findForType(t.type), t.type);
    }
  });
});

describe('v0.63.0 setup warnings', () => {
  test('a complete character has none', () => {
    assert.deepEqual(setupWarnings(base), []);
  });
  test('attributes at 0, no skills, Essence below 0', () => {
    const w = setupWarnings({ ...base, attributes: [{ key: 'body', label: 'Body', base: 0 }], skills: [], essence: -0.4 });
    const text = w.map((x) => x.text).join(' | ');
    assert.match(text, /Body is 0/);
    assert.match(text, /Essence is -0.4/);
    assert.match(text, /No skills yet/);
    assert.equal(w[0]!.level, 'warn', 'warnings before notes');
    assert.equal(w.find((x) => /Body/.test(x.text))!.tab, 'main');
  });
  test('items: a missing weapon skill, an empty gun, uninstalled ware, unbonded focus, item warnings', () => {
    const w = setupWarnings({ ...base, items: [
      { id: '1', type: 'weapon', name: 'Bow', system: { skill: 'Projectile Weapons', damagePower: 0, damageLevel: 'M', strengthPower: true, strengthRange: true } },
      { id: '2', type: 'weapon', name: 'Pistol', system: { skill: 'Firearms', ammoMax: 10, ammo: 0, damagePower: 9, range: { short: 5, medium: 20, long: 40, extreme: 60 } } },
      { id: '3', type: 'cyberware', name: 'Datajack', system: { installed: false, essenceCost: 0.2 } },
      { id: '4', type: 'focus', name: 'Power focus', system: { bonded: false } },
      { id: '5', type: 'armor', name: 'Rag', system: { ballistic: 0, impact: 0 } },
    ] });
    const text = w.map((x) => x.text).join(' | ');
    assert.match(text, /Bow uses Projectile Weapons, which isn't on the sheet/);
    assert.ok(!/Pistol uses/.test(text), 'Firearms is there');
    assert.match(text, /Pistol is empty/);
    assert.match(text, /Datajack isn't installed/);
    assert.match(text, /Power focus isn't bonded/);
    assert.match(text, /Rag: Ballistic and Impact are both 0/);
    assert.equal(w.find((x) => /Rag/.test(x.text))!.find, 'Armor');
  });
  test('spells without Magic or Sorcery; adept over budget; build checks', () => {
    const spell = { id: 's', type: 'spell', name: 'Bolt', system: { learnedForce: 4 } };
    assert.match(setupWarnings({ ...base, items: [spell] }).map((x) => x.text).join(), /but Magic 0/);
    assert.match(setupWarnings({ ...base, magic: 6, items: [spell] }).map((x) => x.text).join(), /no Sorcery/);
    assert.equal(setupWarnings({ ...base, magic: 6, skills: [{ name: 'sorcery' }], items: [spell] }).length, 0);
    assert.match(setupWarnings({ ...base, adeptOver: ['Killing hands'] })[0]!.text, /Killing hands is over/);
    const b = setupWarnings({ ...base, build: [{ label: 'Skills', used: 44, allowed: 40, ok: false }, { label: 'Race', used: 'human', allowed: 'E', ok: true }] });
    assert.equal(b.length, 1);
    assert.match(b[0]!.text, /Build: Skills 44 \(allowed 40\)/);
  });
  test('spirits, vehicles and the like get no person warnings', () => {
    assert.deepEqual(setupWarnings({ ...base, actorType: 'spirit', skills: [], attributes: [{ key: 'body', label: 'Body', base: 0 }] }), []);
  });
});
