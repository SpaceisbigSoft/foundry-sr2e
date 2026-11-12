import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  RULES, splitList, parseSkillList, parseGearList, qualityKarmaCost, contactDigSuccesses, callFavour, clampFavours,
  currentHeat, hotFencePrice, fencePrice, mixedMoraleRating, lifestyleDown, lifestyleOverdue, lifestyleAvailabilityMods, homeCareLifestyle,
  otakuCap, channelRaiseCost, complexFormCost, channelEffect, programOptions, sizeWithOptions, programPlan, programDesign, suiteBonus,
  turretCheck, modInstallPlan, guardsNotice, maskEffect, forcedDevice, deckPartPlan, memoryUse, programSize,
  cargoLoad, concealmentFromName, concealmentEffect,
} from '../index.ts';
// v0.92.3: these tests pin the v0.92.2 Matrix rules (the book's defaults: v0923-matrix.test.ts).
import { before as before922, after as after922 } from 'node:test';
import { matrix922 } from '../../__tests__/helpers/matrix922.ts';
let undo922: () => void = () => {};
before922(() => { undo922 = matrix922(); });
after922(() => undo922());

const withRule = (obj: any, key: string, value: unknown, fn: () => void) => { const old = obj[key]; obj[key] = value; try { fn(); } finally { obj[key] = old; } };
const DAY = 86400;

describe('v0.49.0 builder: skill and gear lists', () => {
  test('lists split on commas, new lines and semicolons, not inside brackets', () => {
    assert.deepEqual(splitList('A 1, B (x, y) 2\nC 3; D 4'), ['A 1', 'B (x, y) 2', 'C 3', 'D 4']);
    assert.deepEqual(splitList('  '), []);
  });
  test('skills: rating, specialization (with or without its own rating), B/R as Build/Repair, duplicates', () => {
    const r = parseSkillList('Firearms 5, Stealth 3 (Urban 5), Etiquette 2 (Street), Computer B/R 2, Firearms 6, junk');
    assert.deepEqual(r.skills.map((s) => [s.name, s.rating, s.kind]), [['Stealth', 3, 'active'], ['Etiquette', 2, 'active'], ['Computer B/R', 2, 'buildRepair'], ['Firearms', 6, 'active']]);
    assert.equal(r.skills[0]!.specialization, 'Urban');
    assert.equal(r.skills[0]!.specializationRating, 5);
    assert.equal(r.skills[1]!.specializationRating, 4);
    assert.equal(r.warnings.length, 2);
    assert.ok(r.warnings.some((w) => /twice/.test(w)) && r.warnings.some((w) => /junk/.test(w)));
    assert.equal(parseSkillList('Japanese 4', 'language').skills[0]!.kind, 'language');
    const pre = parseSkillList('Firearms (Pistols) 5').skills[0]!;
    assert.deepEqual([pre.name, pre.specialization, pre.specializationRating], ['Firearms', 'Pistols', 7]);
    assert.equal(parseSkillList('Corp politics 3', 'knowledge').skills[0]!.kind, 'knowledge');
  });
  test('gear: template names take their type and price; prices and quantities in several forms; unknown names need a price', () => {
    const t = RULES.ITEM_TEMPLATES;
    const r = parseGearList('Heavy pistol, Armor jacket ¥800, medkit ×3, Fake SIN 5,000¥, Rope (¥20) x2, Mystery box', t);
    const by = (n: string) => r.items.find((i) => i.name.toLowerCase() === n.toLowerCase())!;
    assert.equal(by('Heavy pistol').type, 'weapon');
    assert.equal(by('Heavy pistol').cost, 450);
    assert.equal(by('Heavy pistol').system['damagePower'], 9);
    assert.equal(by('Armor jacket').cost, 800);
    assert.equal(by('Armor jacket').type, 'armor');
    assert.equal(by('Medkit').qty, 3);
    assert.equal(by('Medkit').system['quantity'], 3);
    assert.equal(by('Fake SIN').cost, 5000);
    assert.equal(by('Fake SIN').type, 'gear');
    assert.equal(by('Rope').qty, 2);
    assert.equal(by('Rope').cost, 20);
    assert.equal(by('Mystery box').cost, 0);
    assert.ok(r.warnings.some((w) => /Mystery box: no price/.test(w)));
    assert.equal(r.total, 450 + 800 + 200 * 3 + 5000 + 40);
    // The template is copied, not shared.
    by('Heavy pistol').system['damagePower'] = 1;
    assert.equal((t.find((x) => x.name === 'Heavy pistol')!.system as any).damagePower, 9);
  });
});

describe('v0.49.0 edges and flaws with Karma; contacts; heat', () => {
  test('edges and flaws cost points × their rate', () => {
    assert.equal(qualityKarmaCost('edge', 3), 3 * RULES.STREET.qualities.karma.edgePerPoint);
    assert.equal(qualityKarmaCost('flaw', 2), 2 * RULES.STREET.qualities.karma.flawPerPoint);
    assert.equal(qualityKarmaCost('edge', -1), 0);
  });
  test('a contact digging: best, add, instead or off', () => {
    const c = RULES.STREET.contacts as any;
    assert.equal(contactDigSuccesses(2, 3).successes, 3);
    assert.equal(contactDigSuccesses(2, null).successes, 2);
    withRule(c, 'ownDice', 'add', () => assert.equal(contactDigSuccesses(2, 3).successes, 5));
    withRule(c, 'ownDice', 'instead', () => assert.equal(contactDigSuccesses(4, 1).successes, 1));
    withRule(c, 'ownDice', 'off', () => assert.equal(contactDigSuccesses(4, 9).successes, 4));
  });
  test('favours: dice and a waived fee; asking with none owed goes into debt, refused at the limit', () => {
    const f = callFavour(1);
    assert.equal(f.dice, RULES.STREET.contacts.favourDice);
    assert.equal(f.after, 0);
    assert.ok(f.waiveFee && !f.debt && !f.refused);
    const g = callFavour(0);
    assert.equal(g.after, -1);
    assert.ok(g.debt);
    assert.ok(callFavour(-RULES.STREET.contacts.maxFavours).refused);
    assert.equal(clampFavours(99), RULES.STREET.contacts.maxFavours);
    assert.equal(clampFavours(-99), -RULES.STREET.contacts.maxFavours);
  });
  test('heat cools a point every coolDays; never set means it stays', () => {
    const cd = RULES.STREET.heat.coolDays;
    assert.equal(currentHeat(5, 0, (cd * 2 + 1) * DAY), 3);
    assert.equal(currentHeat(5, 0, cd * 10 * DAY), 0);
    assert.equal(currentHeat(5, -1, 999 * DAY), 5);
    assert.equal(currentHeat(99, -1, 0), RULES.STREET.heat.max);
  });
  test('hot goods sell for less; too hot is refused; off ignores heat', () => {
    const cold = fencePrice(1000, 0);
    const hot = hotFencePrice(1000, 0, 2);
    assert.equal(hot.percent, cold.percent - 2 * RULES.STREET.heat.percentPerPoint);
    assert.equal(hot.price, Math.round(1000 * hot.percent / 100));
    assert.ok(hotFencePrice(1000, 0, RULES.STREET.heat.refuseAbove + 1).refused);
    assert.equal(hotFencePrice(1000, 0, 99).price, 0);
    // Never below 0%.
    assert.equal(hotFencePrice(1000, -10, RULES.STREET.heat.refuseAbove).percent, 0);
    withRule(RULES.STREET.heat, 'enabled', false, () => assert.equal(hotFencePrice(1000, 0, 5).percent, cold.percent));
  });
});

describe('v0.49.0 mixed morale and lifestyle', () => {
  test('a mixed group tests on the highest, average, lowest or the leader\'s rating', () => {
    assert.equal(mixedMoraleRating([2, 5, 3], 2), 5);
    assert.equal(mixedMoraleRating([2, 5, 3], 2, 'average'), 3);
    assert.equal(mixedMoraleRating([2, 5, 3], 2, 'lowest'), 2);
    assert.equal(mixedMoraleRating([2, 5, 3], 4, 'leader'), 4);
    assert.equal(mixedMoraleRating([], 3), 3);
  });
  test('lifestyle: one step down, overdue past grace, availability and home care', () => {
    assert.equal(lifestyleDown('middle'), 'low');
    assert.equal(lifestyleDown('street'), 'street');
    const g = RULES.UPKEEP.effects.graceDays;
    assert.deepEqual(lifestyleOverdue(5, 'low'), { overdue: false, evict: false, daysLate: 0 });
    assert.equal(lifestyleOverdue(null, 'low').overdue, false);
    assert.equal(lifestyleOverdue(-(g - 1), 'low').evict, false);
    assert.equal(lifestyleOverdue(-(g + 1), 'low').evict, true);
    assert.equal(lifestyleOverdue(-(g + 1), 'street').overdue, false);
    withRule(RULES.UPKEEP.effects, 'overdue', 'off', () => assert.equal(lifestyleOverdue(-(g + 9), 'low').evict, false));
    assert.deepEqual(lifestyleAvailabilityMods('street'), [{ label: 'Street lifestyle', value: 2 }]);
    assert.deepEqual(lifestyleAvailabilityMods('middle'), []);
    assert.equal(lifestyleAvailabilityMods('luxury')[0]!.value, -2);
    assert.equal(homeCareLifestyle('high', -1), 'high');                 // within the grace days
    assert.equal(homeCareLifestyle('high', -(g + 1)), 'street');
    assert.equal(homeCareLifestyle('high', 3), 'high');
    assert.equal(homeCareLifestyle('high', null), 'high');
  });
});

describe('v0.49.0 otaku, programming and deck parts', () => {
  test('channels and complex forms: caps and Karma costs', () => {
    assert.equal(otakuCap(5.9), 5);
    assert.equal(channelRaiseCost(4), 4 * RULES.MATRIX.otaku.channels.karmaPerRating);
    assert.equal(complexFormCost(3), 3 * RULES.MATRIX.otaku.complexForms.karmaPerRating);
  });
  test('a channel works as a utility (the better counts) or as dice', () => {
    assert.deepEqual(channelEffect(5, 3), { utility: 5, dice: 0, note: 'channel 5' });
    assert.equal(channelEffect(2, 4).utility, 4);
    assert.equal(channelEffect(0, 4).utility, 4);
    withRule(RULES.MATRIX.otaku.channels, 'mode', 'dice', () => assert.deepEqual(channelEffect(3, 4), { utility: 4, dice: 3, note: 'channel +3 dice' }));
  });
  test('complex forms use no memory; options shrink a program', () => {
    const progs = [{ kind: 'attack', rating: 4, size: 0, loaded: true, damageLevel: 'M' }, { kind: 'sleaze', rating: 4, size: 0, loaded: true, complexForm: true }];
    assert.equal(memoryUse(progs, 200).used, 48);
    withRule(RULES.MATRIX.otaku.complexForms, 'noMemory', false, () => assert.equal(memoryUse(progs, 200).used, 96));
    assert.equal(programSize({ kind: 'sleaze', rating: 4, size: 0, options: ['squeeze'] }), 24);
    assert.equal(programSize({ kind: 'sleaze', rating: 4, size: 10, options: ['squeeze'] }), 10);
    assert.equal(sizeWithOptions(48, ['optimization', 'squeeze', 'bogus']), 18);
    assert.equal(sizeWithOptions(0, ['squeeze']), 0);
    assert.deepEqual(programOptions(['squeeze', 'squeeze', 'x']).map((o) => o.id), ['squeeze']);
  });
  test('writing with options changes size, TN and days', () => {
    const base = programDesign({ kind: 'sleaze', rating: 4 });
    const p = programPlan({ kind: 'sleaze', rating: 4, options: ['squeeze'] });
    assert.equal(p.size, Math.ceil(base.size * 0.5));
    assert.equal(p.tn, base.tn + 2);
    assert.equal(p.baseDays, Math.ceil(p.size * RULES.MATRIX.programming.daysPerMp * 1.5));
    assert.deepEqual(programPlan({ kind: 'sleaze', rating: 4 }), { size: base.size, tn: base.tn, baseDays: base.baseDays, labels: [] });
  });
  test('a programming suite: dice capped at Computer, or a TN cut', () => {
    assert.equal(suiteBonus(5, 3).dice, 3);
    assert.equal(suiteBonus(2, 6).dice, 2);
    assert.equal(suiteBonus(4, 0).dice, 0);
    withRule(RULES.MATRIX.programming.suites, 'capAtSkill', false, () => assert.equal(suiteBonus(5, 3).dice, 5));
    withRule(RULES.MATRIX.programming.suites, 'mode', 'tn', () => assert.deepEqual(suiteBonus(2, 6).modifiers, [{ label: 'Programming suite 2', value: -2 }]));
  });
  test('deck parts by design size and materials; memory parts by Mp', () => {
    const m = deckPartPlan('mpcp', 4, 0)!;
    assert.equal(m.size, 32);
    assert.equal(m.baseDays, 32);
    assert.equal(m.cost, 32 * 500);
    assert.equal(m.tn, 4);
    const b = deckPartPlan('bod', 5, 4)!;
    assert.equal(b.size, 10);
    assert.equal(b.cost, 2500);
    assert.ok(b.warnings.length === 1);
    const mem = deckPartPlan('activeMemory', 250, 4)!;
    assert.ok(mem.memory);
    assert.equal(mem.size, 3);
    assert.equal(mem.cost, 250 * 20);
    assert.equal(mem.tn, 4);
    assert.equal(deckPartPlan('nope', 1, 1), null);
  });
});

describe('v0.49.0 rigging', () => {
  test('turrets: within traverse, too far (TN per step, or refused), outside the limit', () => {
    const near = turretCheck({ facing: 0 }, 60);
    assert.equal(near.turn, 60);
    assert.equal(near.steps, 0);
    assert.deepEqual(near.modifiers, []);
    assert.equal(near.newFacing, 60);
    const far = turretCheck({ facing: 0, traverse: 45 }, 180);
    assert.equal(far.steps, 3);
    assert.equal(far.modifiers[0]!.value, 3 * RULES.VEHICLES.turrets.tnPerStep);
    withRule(RULES.VEHICLES.turrets, 'overTraverse', 'block', () => assert.ok(turretCheck({ facing: 0, traverse: 45 }, 180).refused));
    const lim = turretCheck({ facing: 0, limit: 180 }, 120);
    assert.ok(!lim.inLimit);
    assert.equal(lim.limitOffBy, 30);
    assert.ok(turretCheck({ facing: 0, limit: 180 }, 270).inLimit);
    assert.ok(turretCheck({ facing: 300 }, -30).turn === 30);
    // Fired past its limit anyway, it stops at the edge.
    assert.equal(turretCheck({ facing: 0, limit: 180 }, 120).newFacing, 90);
    assert.equal(turretCheck({ facing: 0, limit: 180 }, 250).newFacing, 270);
  });
  test('installing a modification: TN by rating, hours', () => {
    const i = RULES.VEHICLES.install;
    assert.deepEqual(modInstallPlan(2), { tn: i.tn + 2 * i.tnPerRating, baseHours: 2 * i.hoursPerRating });
    assert.equal(modInstallPlan(0).baseHours, i.hoursPerRating);
  });
  test('cargo by volume as well as weight', () => {
    const c = cargoLoad({ itemsKg: 10, people: 1, load: 0, itemsCf: 3, cargoFactor: 5 });
    assert.equal(c.cf, 3 + RULES.VEHICLES.cargo.personCf);
    assert.ok(c.overCf && c.over && c.tracked && !c.overKg);
    assert.ok(!cargoLoad({ itemsKg: 10, people: 0, load: 0, itemsCf: 3, cargoFactor: 0 }).tracked);
    assert.ok(cargoLoad({ itemsKg: 500, people: 0, load: 100 }).overKg);
  });
});

describe('v0.49.0 security', () => {
  test('guards noticing add tally per guard and raise the alert', () => {
    assert.equal(guardsNotice(0), null);
    assert.deepEqual(guardsNotice(2), { add: 2 * RULES.SECURITY.guards.tallyPerGuard, minAlert: RULES.SECURITY.guards.alert });
  });
  test('masking spells: names, silence against acoustic sensors, physical masks against identifying devices', () => {
    assert.equal(concealmentFromName('Silence'), 'silence');
    assert.equal(concealmentFromName('Improved Silence'), 'silence');
    assert.equal(concealmentFromName('Physical Mask'), 'physicalMask');
    assert.equal(concealmentFromName('Mask'), 'mask');
    assert.equal(concealmentFromName('Thermal masking suit'), 'thermal');
    assert.ok(concealmentEffect('acoustic', 'silence', 3).blind);
    assert.ok(!concealmentEffect('visual', 'silence', 3).blind);
    assert.deepEqual(maskEffect('physicalMask', 3, true), [{ label: 'Physical mask 3', value: 3 }]);
    assert.deepEqual(maskEffect('physicalMask', 3, false), []);
    assert.deepEqual(maskEffect('mask', 3, true), []);
    assert.deepEqual(maskEffect('chameleon', 3, true), []);
  });
  test('forcing a device: tamper alarms trip with no roll; others go dead on the board', () => {
    const t = RULES.SECURITY.tamper;
    assert.deepEqual(forcedDevice(3, 'breach'), { trips: true, add: t.tally, minAlert: t.alert, note: 'its tamper alarm trips' });
    assert.equal(forcedDevice(0, 'force').add, t.deadTally);
    assert.equal(forcedDevice(0, 'breach').add, 0);
    withRule(t, 'onBreach', false, () => assert.equal(forcedDevice(3, 'breach').trips, false));
  });
});
