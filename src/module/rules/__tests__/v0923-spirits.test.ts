/**
 * v0.92.3 book alignment, conjuring, spirits, astral, initiation, allies and critters: the pure functions. Each change
 * is checked at the shipped (book) value and with its switch put back (the v0.92.2 result). The Foundry glue is
 * __tests__/v0923-spirits.test.ts.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { RULES } from '../config.ts';
import { oldWay } from './oldway.ts';
import { SPIRITS_V922_WAY } from './spirits922.ts';
import { URR_V80_PATCH } from '../config80.ts';
import { conjuringDrainLevel, conjuringDrainType, resolveBanishing } from '../conjuring.ts';
import { astralForm } from '../astral.ts';
import { projectionOverstay } from '../thaumaturgy.ts';
import { initiationCost } from '../occult.ts';
import { allyCosts } from '../afflictions.ts';
import { wardPlan } from '../arcanum.ts';
import { elementalSustainUntil } from '../mysticism.ts';
import { trueNameOutcome } from '../bestiary.ts';
import * as S from '../spirits923.ts';

const urr = () => oldWay(Object.fromEntries(Object.entries(URR_V80_PATCH).map(([k, v]) => [k, structuredClone(v)])));
const A = { body: 5, quickness: 6, strength: 4, charisma: 3, intelligence: 5, willpower: 4 };

describe('v0.92.3 spirits: the switches ship at the book way', () => {
  test('every switch and moved default', () => {
    const s = RULES.SPIRITS_V923;
    assert.equal(s.conjDrain, 'book');
    assert.equal(s.banishPerPoint, 2);
    assert.equal(RULES.ASTRAL.initiativeBonus, 15);
    assert.equal(RULES.TRACKING.baseHours, 12);
    assert.equal(RULES.OCCULT.initiation.ordealReduction, 0.5);
    assert.equal(RULES.MAGIC_V39.domains.enforce, 'block');
    assert.equal(RULES.MAGIC_V56.ward.nuyenPerForce, 1000);
    // The v0.92.2 patch names only rules that exist (oldWay throws otherwise) and puts them back.
    const back = oldWay(SPIRITS_V922_WAY);
    try { assert.equal(RULES.SPIRITS_V923.conjDrain, 'v922'); assert.equal(RULES.ASTRAL.initiativeBonus, 20); } finally { back(); }
    assert.equal(RULES.SPIRITS_V923.conjDrain, 'book');
  });
});

describe('v0.92.3 conjuring drain (Core p. 140)', () => {
  test('book: L below half Charisma, M up to it, S above, D above twice; S and D Physical', () => {
    // Charisma 6: 2 L, 3 M (not below half), 6 M, 7 S, 12 S, 13 D
    assert.deepEqual([2, 3, 6, 7, 12, 13].map((f) => conjuringDrainLevel(f, 6)), ['L', 'M', 'M', 'S', 'S', 'D']);
    assert.equal(conjuringDrainType(6, 3, 6), 'stun');      // Force over Magic but not over Charisma: Stun
    assert.equal(conjuringDrainType(7, 9, 6), 'physical');  // Force over Charisma: Physical
  });
  test('v0.92.2: ≤ half L, ≤ 1.5 × S, Physical over Magic', (t) => {
    t.after(oldWay({ 'SPIRITS_V923.conjDrain': 'v922' }));
    assert.deepEqual([3, 6, 9, 10].map((f) => conjuringDrainLevel(f, 6)), ['L', 'M', 'S', 'D']);
    assert.equal(conjuringDrainType(6, 3, 6), 'physical');
    assert.equal(conjuringDrainType(7, 9, 6), 'stun');
  });
  test('the Revamp keeps its own Charisma table', (t) => {
    t.after(urr());
    assert.deepEqual([2, 3, 7, 13].map((f) => conjuringDrainLevel(f, 6)), ['L', 'M', 'S', 'D']);
    assert.equal(conjuringDrainType(7, 9, 6), 'physical');
  });
});

describe('v0.92.3 spirits and normal weapons (Core p. 142)', () => {
  test('immunity counts against firearms, crossbows and explosions, not melee, bows or thrown weapons', () => {
    assert.equal(S.spiritImmunityApplies({ melee: false, skill: 'Pistols', name: 'Ares Predator' }), true);
    assert.equal(S.spiritImmunityApplies({ melee: true }), false);
    assert.equal(S.spiritImmunityApplies({ skill: 'Projectile Weapons', name: 'Longbow' }), false);
    assert.equal(S.spiritImmunityApplies({ skill: 'Projectile Weapons', name: 'Light Crossbow' }), true);
    assert.equal(S.spiritImmunityApplies({ thrown: true, name: 'Throwing knife' }), false);
    assert.equal(S.spiritImmunityApplies({ thrown: true, blast: true, name: 'Grenade' }), true);
  });
  test('v0.92.2: every non-magical attack', (t) => {
    t.after(oldWay({ 'SPIRITS_V923.immunityScope': 'v922' }));
    assert.equal(S.spiritImmunityApplies({ melee: true }), true);
  });
  test('a mundane weapon rolls Willpower; a focus, a vulnerability or a spirit attacker does not', (t) => {
    const base = { attackerType: 'character', targetType: 'spirit', materialized: true };
    assert.equal(S.mundaneVsSpirit(base), true);
    assert.equal(S.mundaneVsSpirit({ ...base, magical: true }), false);
    assert.equal(S.mundaneVsSpirit({ ...base, vulnerable: true }), false);
    assert.equal(S.mundaneVsSpirit({ ...base, attackerType: 'spirit' }), false);
    assert.equal(S.mundaneVsSpirit({ ...base, targetType: 'npc' }), false);
    t.after(oldWay({ 'SPIRITS_V923.mundaneVsSpirits': 'v922' }));
    assert.equal(S.mundaneVsSpirit(base), false);
  });
  test('Conjuring in place of Body against a spirit, when better (Core p. 143)', (t) => {
    assert.equal(S.conjuringDefenseDice({ attackerType: 'spirit', conjuring: 6, attribute: 4, magic: 6 }), 6);
    assert.equal(S.conjuringDefenseDice({ attackerType: 'spirit', conjuring: 3, attribute: 4, magic: 6 }), 0);
    assert.equal(S.conjuringDefenseDice({ attackerType: 'npc', conjuring: 6, attribute: 4, magic: 6 }), 0);
    assert.equal(S.conjuringDefenseDice({ attackerType: 'spirit', conjuring: 6, attribute: 4, magic: 0 }), 0);
    t.after(oldWay({ 'SPIRITS_V923.conjuringDefense': 'off' }));
    assert.equal(S.conjuringDefenseDice({ attackerType: 'spirit', conjuring: 6, attribute: 4, magic: 6 }), 0);
  });
});

describe('v0.92.3 banishing and control (Core p. 143)', () => {
  test('book: 1 Force per 2 net successes; the spirit winning costs 1 Magic per 2; points back at 1 an hour', () => {
    assert.deepEqual(resolveBanishing({ banisherSuccesses: 5, spiritSuccesses: 1, force: 5 }), { netSuccesses: 4, force: 3, banished: false });
    assert.deepEqual(resolveBanishing({ banisherSuccesses: 2, spiritSuccesses: 1, force: 5 }), { netSuccesses: 1, force: 5, banished: false });
    assert.equal(S.banishBackfire(1, 5), 2);
    assert.equal(S.banishBackfire(1, 2), 0);
    assert.equal(S.banishRecovered(3, 2.5), 2);
    assert.equal(S.banishRecovered(3, 10), 3);
  });
  test('v0.92.2: 1 per net success, no backfire, no recovery', (t) => {
    t.after(oldWay({ 'SPIRITS_V923.banishPerPoint': 1, 'SPIRITS_V923.banishBackfire': 'v922', 'SPIRITS_V923.banishRecovery': 'v922' }));
    assert.equal(resolveBanishing({ banisherSuccesses: 5, spiritSuccesses: 1, force: 5 }).force, 1);
    assert.equal(S.banishBackfire(1, 5), 0);
    assert.equal(S.banishRecovered(3, 10), 0);
  });
  test('control contests: a holder against Force + 2; an uncontrolled spirit 1 service per 2 net', (t) => {
    assert.equal(S.controlChallengeTn(4, true), 6);
    assert.equal(S.controlChallengeTn(4, false), 4);
    assert.deepEqual(S.controlOutcome({ challenger: 3, defender: 2, held: true, servicesBefore: 3 }), { won: true, services: 3 });
    assert.deepEqual(S.controlOutcome({ challenger: 2, defender: 2, held: true, servicesBefore: 3 }), { won: false, services: 0 });
    assert.deepEqual(S.controlOutcome({ challenger: 5, defender: 1, held: false, servicesBefore: 0 }), { won: true, services: 2 });
    assert.deepEqual(S.controlOutcome({ challenger: 2, defender: 1, held: false, servicesBefore: 0 }), { won: false, services: 0 });
    t.after(oldWay({ 'SPIRITS_V923.controlContest': 'v922' }));
    assert.equal(S.controlChallengeTn(4, true), null);
    assert.equal(S.controlOutcome({ challenger: 3, defender: 2, held: true, servicesBefore: 3 }), null);
  });
  test('true names: Force + Spirit Energy, no Karma (Grimoire p. 79)', (t) => {
    assert.equal(S.trueNameTn(5, 2), 7);
    assert.equal(trueNameOutcome(1, 0, 5).karma, 0);
    t.after(oldWay({ 'SPIRITS_V923.trueName': 'v922' }));
    assert.equal(trueNameOutcome(1, 0, 5).karma, 5);
  });
});

describe('v0.92.3 astral (Core pp. 146–148; Grimoire pp. 38, 91)', () => {
  test('initiative: astral Reaction + 15, + grade', (t) => {
    assert.deepEqual([astralForm(A).initiativeBase, astralForm(A, 2).initiativeBase], [20, 22]);
    t.after(oldWay({ 'ASTRAL.initiativeBonus': 20, 'SPIRITS_V923.astralGrade': 'v922' }));
    assert.deepEqual([astralForm(A).initiativeBase, astralForm(A, 2).initiativeBase], [25, 25]);
  });
  test('the Astral Combat Pool: (Int + Wil + Cha) ÷ 2 + grade', (t) => {
    assert.equal(S.astralCombatPool({ intelligence: 5, willpower: 4, charisma: 4 }), 6);
    assert.equal(S.astralCombatPool({ intelligence: 5, willpower: 4, charisma: 4, grade: 2 }), 8);
    t.after(oldWay({ 'SPIRITS_V923.astralGrade': 'v922' }));
    assert.equal(S.astralCombatPool({ intelligence: 5, willpower: 4, charisma: 4, grade: 2 }), 6);
  });
  test("a magician's damage: (Cha)L unarmed, (Cha + focus ÷ 2)M with a weapon focus", (t) => {
    assert.deepEqual(S.astralMagicianDamage({ charisma: 5, focusRating: 0 }), { power: 5, level: 'L', focus: false });
    assert.deepEqual(S.astralMagicianDamage({ charisma: 5, focusRating: 3 }), { power: 6, level: 'M', focus: true });
    t.after(oldWay({ 'SPIRITS_V923.astralDamage': 'v922' }));
    assert.equal(S.astralMagicianDamage({ charisma: 5, focusRating: 3 }), null);
  });
  test('projection: 1 Essence every full hour from the start', (t) => {
    assert.deepEqual(projectionOverstay(2.5, 6), { limit: 0, over: 2.5, essenceLoss: 2 });
    assert.deepEqual(projectionOverstay(0.5, 6), { limit: 0, over: 0.5, essenceLoss: 0 });
    t.after(oldWay({ 'SPIRITS_V923.projection': 'v922', 'MAGIC_EXTRA.projection.hoursPerEssence': 2 }));
    assert.deepEqual(projectionOverstay(2.5, 6), { limit: 12, over: 0, essenceLoss: 0 });
  });
  test('the Revamp keeps its projection, initiative and astral damage', (t) => {
    t.after(urr());
    assert.deepEqual(projectionOverstay(2.5, 6), { limit: 0, over: 2.5, essenceLoss: 2 });
    assert.equal(astralForm(A).initiativeBase, 25); // 2 × Int 5 + 15
  });
  test('a barrier that wins hurts the intruder: (rating)L, +1 level per 2 net', (t) => {
    assert.deepEqual(S.barrierBacklash({ rating: 4, barrierSuccesses: 3, attackerSuccesses: 2 }), { power: 4, level: 'L' });
    assert.deepEqual(S.barrierBacklash({ rating: 4, barrierSuccesses: 5, attackerSuccesses: 1 }), { power: 4, level: 'S' });
    assert.equal(S.barrierBacklash({ rating: 4, barrierSuccesses: 2, attackerSuccesses: 2 }), null);
    t.after(oldWay({ 'SPIRITS_V923.barrierBacklash': 'v922' }));
    assert.equal(S.barrierBacklash({ rating: 4, barrierSuccesses: 5, attackerSuccesses: 1 }), null);
  });
  test('tracking: −2 within the Sorcery, +2 over it', (t) => {
    assert.equal(S.trackingMods(3, 5)[0]?.value, -2);
    assert.equal(S.trackingMods(6, 5)[0]?.value, 2);
    t.after(oldWay({ 'SPIRITS_V923.tracking': 'v922' }));
    assert.deepEqual(S.trackingMods(6, 5), []);
  });
});

describe('v0.92.3 initiation through the v0.92.2 patch (the rule is RULES.SORCERY_V923.initiation)', () => {
  test('SPIRITS_V922_WAY puts back the first initiation at Grade 1, an ordeal −1, rounded up', (t) => {
    t.after(oldWay(SPIRITS_V922_WAY));
    assert.deepEqual(initiationCost(1), { cost: 21, multiplier: 3 });
    assert.deepEqual(initiationCost(1, { ordeal: true }), { cost: 14, multiplier: 2 });
  });
});

describe('v0.92.3 allies (Grimoire pp. 67–71)', () => {
  test('book: 5 × current Force per point above 1, the design Karma, a Magic point; Force ÷ successes days; daily fatigue', () => {
    assert.equal(S.allyKarmaBook(4), 30);            // 5 × (1 + 2 + 3)
    assert.equal(S.allyKarmaBook(4, 17), 47);        // the book's example: 2 + 30 + 15
    assert.deepEqual(allyCosts(4), { tn: 4, nuyen: 4000, days: 4, karma: 30, magic: 1 });
    assert.equal(allyCosts(4, { familiar: true }).magic, 0);
    assert.equal(S.allyRitualDays(4, 2), 2);
    assert.equal(S.allyRitualDays(4, 0), 4);
    assert.deepEqual(S.allyDailyDrain(4, 2), [{ tn: 5, level: 'L' }, { tn: 6, level: 'L' }]);
  });
  test('v0.92.2: Karma × Force, no Magic, no fatigue', (t) => {
    t.after(oldWay({ 'SPIRITS_V923.allyCost': 'v922' }));
    assert.deepEqual(allyCosts(4), { tn: 4, nuyen: 4000, days: 4, karma: 4, magic: 0 });
    assert.deepEqual(S.allyDailyDrain(4, 2), []);
  });
});

describe('v0.92.3 wards through the v0.92.2 patch (the rule is RULES.SORCERY_V923.ward)', () => {
  test('v0.92.2: hours ÷ successes, drain at Force ÷ 2 M, no materials', (t) => {
    t.after(oldWay(SPIRITS_V922_WAY));
    assert.deepEqual(wardPlan(4, 3), { tn: 4, baseHours: 4, hours: 2, nuyen: 0, drainTn: 2, drainLevel: 'M' });
  });
  test('the Revamp keeps its drain and time', (t) => {
    t.after(urr());
    assert.deepEqual(wardPlan(4, 3), { tn: 4, baseHours: 4, hours: 2, nuyen: 400, drainTn: 7, drainLevel: 'L' });
  });
});

describe('v0.92.3 elementals, the Spirit Table', () => {
  test('an elemental sustains a spell Force Combat Turns (Core p. 142)', (t) => {
    assert.equal(elementalSustainUntil(100, 4), 112);
    t.after(oldWay({ 'SPIRITS_V923.elementalSustain': 'v922' }));
    assert.equal(elementalSustainUntil(100, 4), 100 + 4 * 3600);
  });
  test('the Spirit Table (Core p. 144)', (t) => {
    assert.deepEqual(S.spiritTableOffsets('Fire Elemental'), { body: 1, quickness: 2, strength: -2, reactionBonus: 0 });
    assert.deepEqual(S.spiritTableOffsets('', 'air'), { body: -2, quickness: 3, strength: -3, reactionBonus: 1 });
    assert.deepEqual(S.spiritTableOffsets('Forest Spirit'), { body: 4, quickness: -2, strength: 4, reactionBonus: -1 });
    assert.deepEqual(S.spiritTableOffsets('Hearth Spirit'), { body: 1, quickness: 2, strength: -2, reactionBonus: 0 });
    assert.deepEqual(S.spiritTableOffsets('Sea Spirit'), { body: 2, quickness: 0, strength: 0, reactionBonus: -1 });
    assert.equal(S.spiritTableOffsets('Ghost'), null);
    t.after(oldWay({ 'SPIRITS_V923.spiritTable': 'v922' }));
    assert.equal(S.spiritTableOffsets('Fire Elemental'), null);
  });
});

describe('v0.92.3 reading an aura (Core p. 145; Grimoire p. 90)', () => {
  const subject = {
    name: 'Kim', physical: 3, stun: 1, status: 'ok', essence: 5.25, magic: 6, awakened: true, tradition: 'hermetic',
    cyberware: ['datajack'], foci: ['power focus 2'], sustained: ['Armor'], emotion: 'anxious', signatures: ['Fireball'],
  };
  const me = { essence: 6, magic: 4 };
  test('book: the basics at a glance, emotions at 2, cyberware at 4, never exact numbers', async (t) => {
    const { assensingReveals } = await import('../arcanum.ts');
    const none = assensingReveals(0, subject as any, me);
    assert.ok(none.includes('Awakened (hermetic)') && none.includes('Essence: lower than yours') && none.includes('Magic: higher than yours'));
    assert.ok(!none.some((x: string) => /Mood/.test(x)));
    assert.ok(assensingReveals(2, subject as any, me).some((x: string) => /Mood: anxious/.test(x)));
    const four = assensingReveals(4, subject as any, me);
    assert.ok(four.includes('Cyberware: datajack'));
    assert.ok(!four.includes('Essence 5.25') && !four.includes('Magic 6'));
    t.after(oldWay({ 'SPIRITS_V923.assensing': 'v922' }));
    assert.deepEqual(assensingReveals(0, subject as any, me), []);
  });
});

