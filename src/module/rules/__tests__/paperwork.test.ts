import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { RULES } from '../config.ts';
import {
  radioJammed, commsStatus, interceptTest, idCheckTest, idCheckOutcome, licenceCovers, legalWithLicences,
  spellPointAllowance, spellPointsUsed, spellPointCheck, leftoverCash, lifestyleOutright, starterSkillsMissing,
  workshopToolsLevel,
} from '../paperwork.ts';
import { guessSkillAttribute } from '../statblock.ts';

const ORIGINAL = structuredClone(RULES.STREET_V61);
afterEach(() => { (RULES as any).STREET_V61 = structuredClone(ORIGINAL); });
const S = () => RULES.STREET_V61 as any;

describe('v0.61.0 radios and jamming', () => {
  test('jammer ties jam by default; greater needs strictly more', () => {
    assert.equal(radioJammed({ signal: 4, jammer: 4 }), true);
    assert.equal(radioJammed({ signal: 5, jammer: 4 }), false);
    assert.equal(radioJammed({ signal: 0, jammer: 0 }), false);
    assert.equal(radioJammed({ signal: 3, jammer: NaN }), false);
    S().radio.jamBeats = 'greater';
    assert.equal(radioJammed({ signal: 4, jammer: 4 }), false);
    assert.equal(radioJammed({ signal: 4, jammer: 5 }), true);
  });
  test('commsStatus picks the strongest radio and the strongest jammer', () => {
    const r = commsStatus({
      radios: [{ name: 'Earbud', signal: 2, encryption: 0 }, { name: 'Headset', signal: 5, encryption: 3 }, { name: 'Spare', signal: 5, encryption: 1 }],
      jammers: [{ name: 'Small', rating: 3 }, { name: 'Big', rating: 6 }],
    });
    assert.deepEqual(r.best, { name: 'Headset', signal: 5, encryption: 3 });
    assert.equal(r.ok, false);
    assert.equal(r.jammedBy, 'Big');
    const ok = commsStatus({ radios: [{ name: 'Headset', signal: 5, encryption: 0 }], jammers: [{ name: 'Small', rating: 3 }] });
    assert.equal(ok.ok, true);
    assert.equal(ok.jammedBy, null);
    assert.match(ok.note, /unencrypted/);
    assert.match(ok.note, /too weak/);
  });
  test('no radios, bad input', () => {
    assert.deepEqual(commsStatus({ radios: [], jammers: [] }), { ok: false, best: null, jammedBy: null, note: 'No radio.' });
    assert.equal(commsStatus({ radios: undefined as any, jammers: undefined as any }).ok, false);
    const r = commsStatus({ radios: [{ name: 'X', signal: NaN, encryption: -2 }], jammers: [{ name: 'Off', rating: 0 }] });
    assert.deepEqual(r.best, { name: 'X', signal: 0, encryption: 0 });
    assert.equal(r.ok, true);
  });
  test('intercept TN: encryption rating, at least the base', () => {
    assert.deepEqual(interceptTest({ dice: 5, encryption: 0 }), { dice: 5, tn: 4, skill: 'Electronics', modifiers: [] });
    assert.deepEqual(interceptTest({ dice: 5, encryption: 3 }).tn, 4);
    assert.deepEqual(interceptTest({ dice: 5, encryption: 7 }), { dice: 5, tn: 7, skill: 'Electronics', modifiers: [{ label: 'Encryption 7', value: 3 }] });
    assert.equal(interceptTest({ dice: -3, encryption: NaN }).dice, 0);
  });
  test('intercept TN house rule: base + encryption', () => {
    S().radio.decryptTnFrom = 'base+encryption';
    assert.deepEqual(interceptTest({ dice: 4, encryption: 3 }), { dice: 4, tn: 7, skill: 'Electronics', modifiers: [{ label: 'Encryption 3', value: 3 }] });
    S().radio.baseInterceptTn = 0;
    assert.equal(interceptTest({ dice: 4, encryption: 0 }).tn, RULES.MIN_TARGET_NUMBER);
  });
});

describe('v0.61.0 fake IDs', () => {
  test('checker rating vs fake rating; real auto-passes', () => {
    assert.deepEqual(idCheckTest({ checkerRating: 4, rating: 5, fake: true }), { dice: 4, tn: 5, auto: null });
    assert.deepEqual(idCheckTest({ checkerRating: 4, rating: 5, fake: false }), { dice: 4, tn: 5, auto: 'pass' });
    assert.deepEqual(idCheckTest({ checkerRating: NaN, rating: 0, fake: true }), { dice: 0, tn: 2, auto: null });
    S().identity.realAlwaysPasses = false;
    assert.equal(idCheckTest({ checkerRating: 4, rating: 5, fake: false }).auto, null);
    S().identity.tnFrom = 'fixed';
    assert.equal(idCheckTest({ checkerRating: 4, rating: 9, fake: true }).tn, 4);
  });
  test('outcome: any success spots by default', () => {
    assert.equal(idCheckOutcome(0).spotted, false);
    assert.equal(idCheckOutcome(-2).spotted, false);
    assert.equal(idCheckOutcome(1).spotted, true);
    assert.equal(idCheckOutcome(NaN).spotted, false);
    assert.equal(idCheckOutcome(1, 3).spotted, true);
  });
  test('outcome: net successes house rule', () => {
    S().identity.spottedOn = 'netSuccess';
    assert.equal(idCheckOutcome(2, 2).spotted, false);
    assert.equal(idCheckOutcome(3, 2).spotted, true);
    assert.equal(idCheckOutcome(1).spotted, true);
    assert.match(idCheckOutcome(2, 2).note, /Passes/);
  });
  test('licenceCovers: categories, words, wildcard, SIN', () => {
    const pistol = { name: 'Ares Predator heavy pistol', legality: 'permit' };
    const rifle = { name: 'Assault rifle', legality: 'restricted' };
    assert.equal(licenceCovers({ covers: 'permit' }, pistol), true);
    assert.equal(licenceCovers({ covers: 'permit' }, rifle), false);
    assert.equal(licenceCovers({ covers: 'restricted' }, rifle), true);
    assert.equal(licenceCovers({ covers: 'restricted' }, pistol), true); // stricter covers milder
    assert.equal(licenceCovers({ covers: ' Pistol , shotgun' }, pistol), true);
    assert.equal(licenceCovers({ covers: 'shotgun' }, pistol), false);
    assert.equal(licenceCovers({ covers: '*' }, rifle), true);
    assert.equal(licenceCovers({ covers: 'all', kind: 'sin' }, rifle), false);
    assert.equal(licenceCovers({ covers: '' }, pistol), false);
    assert.equal(licenceCovers({ covers: undefined as any }, { name: undefined as any, legality: undefined as any }), false);
    S().identity.categoryCoversLower = false;
    assert.equal(licenceCovers({ covers: 'restricted' }, pistol), false);
  });
  test('legalWithLicences: permits, licences (real preferred), forbidden', () => {
    const items = [
      { name: 'Knife', legality: 'legal', permit: false },
      { name: 'Heavy pistol', legality: 'permit', permit: true },
      { name: 'Light pistol', legality: 'permit', permit: false },
      { name: 'Assault rifle', legality: 'restricted', permit: false },
      { name: 'Grenade', legality: 'forbidden', permit: false },
    ];
    const licences = [
      { name: 'Fake gun licence', covers: 'pistol', fake: true, rating: 4 },
      { name: 'Real gun licence', covers: 'pistol', fake: false, rating: 1 },
      { name: 'Grenade licence', covers: 'grenade', fake: true, rating: 6 },
    ];
    assert.deepEqual(legalWithLicences(items, licences), [
      { name: 'Light pistol', problem: '', coveredBy: 'Real gun licence', fake: false },
      { name: 'Assault rifle', problem: 'Restricted: no permit (fine ¥5,000)', coveredBy: null, fake: false },
      { name: 'Grenade', problem: 'Forbidden: forbidden (fine ¥25,000)', coveredBy: null, fake: false },
    ]);
    const fakes = legalWithLicences([{ name: 'Light pistol', legality: 'permit', permit: false }], [
      { name: 'Weak fake', covers: 'pistol', fake: true, rating: 2 }, { name: 'Good fake', covers: 'permit', fake: true, rating: 5 },
    ]);
    assert.deepEqual(fakes, [{ name: 'Light pistol', problem: '', coveredBy: 'Good fake', fake: true }]);
    assert.deepEqual(legalWithLicences(undefined as any, undefined as any), []);
  });
});

describe('v0.61.0 creation extras', () => {
  test('spell point allowance by Magic priority', () => {
    assert.equal(spellPointAllowance({ priority: 'A' }), 25);
    assert.equal(spellPointAllowance({ priority: 'b' }), 25);
    assert.equal(spellPointAllowance({ priority: 'C' }), 0);
    assert.equal(spellPointAllowance({ priority: 'Z' }), 0);
    assert.equal(spellPointAllowance({ priority: undefined as any }), 0);
    assert.equal(spellPointAllowance({ priority: 'A', adept: true }), 0);
    assert.equal(spellPointAllowance({ priority: 'A', tradition: 'none' }), 0);
    assert.equal(spellPointAllowance({ priority: 'A', tradition: 'hermetic' }), 25);
    S().creation.adeptGetsNone = false;
    S().creation.spellPointsByPriority = { A: 30, B: 20 };
    assert.equal(spellPointAllowance({ priority: 'B', adept: true }), 20);
    assert.equal(spellPointAllowance({ priority: 'A' }), 30);
  });
  test('spell points used and checked', () => {
    assert.equal(spellPointsUsed([{ force: 5 }, { force: 6, learnedForce: 3 }, { force: NaN }, { force: -2 }]), 8);
    assert.equal(spellPointsUsed(undefined as any), 0);
    assert.deepEqual(spellPointCheck({ allowance: 25, spells: [{ force: 20 }] }), { used: 20, allowance: 25, ok: true, extraNuyen: 0, note: '5 unspent' });
    assert.deepEqual(spellPointCheck({ allowance: 25, spells: [{ force: 25 }] }).note, '');
    assert.deepEqual(spellPointCheck({ allowance: 10, spells: [{ force: 12 }] }), { used: 12, allowance: 10, ok: false, extraNuyen: 0, note: '2 over the allowance' });
    S().creation.nuyenPerSpellPoint = 1000;
    assert.deepEqual(spellPointCheck({ allowance: 10, spells: [{ force: 12 }] }), { used: 12, allowance: 10, ok: true, extraNuyen: 2000, note: '2 extra bought for ¥2,000' });
  });
  test('leftover cash modes', () => {
    assert.deepEqual(leftoverCash(12000), { kept: 12000, lost: 0, note: '' });
    assert.deepEqual(leftoverCash(NaN), { kept: 0, lost: 0, note: '' });
    S().creation.leftoverCash = { mode: 'cap', cap: 5000 };
    assert.equal(leftoverCash(12000).kept, 5000);
    assert.equal(leftoverCash(12000).lost, 7000);
    assert.equal(leftoverCash(3000).lost, 0);
    S().creation.leftoverCash = { mode: 'lose', cap: 5000 };
    assert.deepEqual(leftoverCash(800).kept, 0);
    assert.match(leftoverCash(800).note, /lost/);
  });
  test('lifestyle bought outright', () => {
    assert.deepEqual(lifestyleOutright({ lifestyle: 'low' }), { months: 100, cost: 100000, permanent: true });
    assert.equal(lifestyleOutright({ lifestyle: 'middle' }).cost, 500000);
    assert.equal(lifestyleOutright({ lifestyle: 'bogus' }).cost, 0); // unknown → first row (street, ¥0)
    S().creation.lifestyleOutright = { months: 50 };
    assert.equal(lifestyleOutright({ lifestyle: 'low' }).cost, 50000);
  });
});

describe('v0.61.0 starter skills', () => {
  test('missing skills, case-insensitive', () => {
    const all = starterSkillsMissing([]);
    assert.ok(all.length >= 25);
    const some = starterSkillsMissing(['firearms', ' STEALTH ', 'Car B/R']);
    assert.equal(some.length, all.length - 3);
    assert.ok(!some.some((s) => ['Firearms', 'Stealth', 'Car B/R'].includes(s.name)));
    assert.equal(starterSkillsMissing(undefined as any).length, all.length);
  });
  test('names are unique and attributes match the statblock guesser', () => {
    const all = starterSkillsMissing([]);
    assert.equal(new Set(all.map((s) => s.name.toLowerCase())).size, all.length);
    for (const s of all) {
      assert.equal(s.attribute, guessSkillAttribute(s.name), s.name);
      assert.equal(s.kind, s.name.endsWith(' B/R') ? 'buildRepair' : 'active', s.name);
    }
  });
  test('house rule list', () => {
    S().starterSkills = [{ name: 'Swimming', attribute: 'body', kind: 'active' }];
    assert.deepEqual(starterSkillsMissing([]), [{ name: 'Swimming', attribute: 'body', kind: 'active' }]);
    assert.deepEqual(starterSkillsMissing(['swimming']), []);
  });
});

describe('v0.61.0 workshop tools', () => {
  test('rating or negative TN maps to a tools level', () => {
    assert.equal(workshopToolsLevel(0), '');
    assert.equal(workshopToolsLevel(NaN), '');
    assert.equal(workshopToolsLevel(-1), 'shop');
    assert.equal(workshopToolsLevel(2), 'shop');
    assert.equal(workshopToolsLevel(-3), 'facility');
    assert.equal(workshopToolsLevel(9), 'facility');
    assert.equal(workshopToolsLevel(0.5), '');
    S().workshop.levelAt = [{ min: 1, level: 'kit' }, { min: 2, level: 'shop' }];
    assert.equal(workshopToolsLevel(-2), 'shop');
    assert.equal(workshopToolsLevel(1), 'kit');
  });
  test('restore leaves the original values', () => {
    assert.deepEqual(RULES.STREET_V61, ORIGINAL);
  });
});
