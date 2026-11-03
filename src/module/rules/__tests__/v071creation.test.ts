import { test, describe, afterEach } from 'node:test';
import { oldWay } from './oldway.ts';
import assert from 'node:assert/strict';
import { RULES } from '../config.ts';
import { buildCheck, paidSkillRating, specializationRow, specializationTrade, type BuildInput } from '../creation.ts';
import { guessSkillAttribute } from '../statblock.ts';
import { skillAttributeFor, setupWarnings, type SetupInput } from '../catalogue.ts';
import { starterSkillsMissing, spellPointCheck, focusSpellPoints } from '../paperwork.ts';

/** v0.71.0: creation fixes R3 (specializations traded from the skill), R4 (Athletics is Body), R21 (foci from spell points). */

const ORIGINAL = structuredClone(RULES.FIXES_V71);
afterEach(() => { Object.assign(RULES.FIXES_V71, structuredClone(ORIGINAL)); });
const F = () => RULES.FIXES_V71 as any;

const baseInput = (over: Partial<BuildInput> = {}): BuildInput => ({
  priorities: { race: 'E', magic: 'D', attributes: 'C', skills: 'B', resources: 'A' }, metatype: 'human', magic: 'none',
  attributes: { body: 4 }, intelligence: 4, activeSkills: [], knowledgeSkills: [], gearCost: 1000, nuyen: 500, essence: 6, ...over,
});
const row = (rows: ReturnType<typeof buildCheck>, label: string) => rows.find((r) => r.label === label);

describe('v0.71.0 (R3) paidSkillRating', () => {
  test('ratio 1: paid = (general + specialization) / 2', () => {
    const p = paidSkillRating({ rating: 4, specializationRating: 6 }, 1, 6);
    assert.equal(p.paid, 5);
    assert.equal(p.steps, 1);
    assert.equal(p.invalid, '');
    assert.equal(p.narrowKind, 'specialization');
    assert.equal(paidSkillRating({ rating: 3, specializationRating: 7 }, 1, 6).paid, 5);
  });
  test('no narrower rating: paid is the rating', () => {
    assert.deepEqual(paidSkillRating({ rating: 4 }, 1, 6), { paid: 4, general: 4, narrow: 0, narrowKind: '', steps: 0, invalid: '', suggest: null });
    assert.match(paidSkillRating({ rating: 7 }, 1, 6).invalid, /above 6/);
  });
  test('ratio 2: each point up lowers the skill by 2', () => {
    const p = paidSkillRating({ rating: 3, specializationRating: 6 }, 2, 6);
    assert.equal(p.paid, 5);
    assert.equal(p.invalid, '');
    assert.equal(paidSkillRating({ rating: 1, specializationRating: 7 }, 2, 6).paid, 5);
    assert.match(paidSkillRating({ rating: 4, specializationRating: 6 }, 2, 6).invalid, /legal trade/);
  });
  test('illegal trades', () => {
    const odd = paidSkillRating({ rating: 6, specializationRating: 9 }, 1, 6);
    assert.match(odd.invalid, /isn't a legal trade/);
    assert.equal(odd.paid, 8);                         // 7.5 rounded up
    assert.deepEqual(odd.suggest, { general: 5, narrow: 7, paid: 6 });
    assert.match(paidSkillRating({ rating: 5, specializationRating: 5 }, 1, 6).invalid, /must be above the skill/);
    assert.match(paidSkillRating({ rating: 6, specializationRating: 8 }, 1, 6).invalid, /paid rating 7 is above 6/);
    assert.match(paidSkillRating({ rating: 0, specializationRating: 2 }, 1, 6).invalid, /below 1/);
  });
  test('concentrations', () => {
    const c = paidSkillRating({ rating: 4, concentrationRating: 6 }, 1, 6);
    assert.equal(c.paid, 5);
    assert.equal(c.narrowKind, 'concentration');
    assert.equal(paidSkillRating({ rating: 4, concentrationRating: 5, specializationRating: 6 }, 1, 6).invalid, '');
    assert.match(paidSkillRating({ rating: 4, concentrationRating: 7, specializationRating: 6 }, 1, 6).invalid, /concentration/);
    assert.match(paidSkillRating({ rating: 4, concentrationRating: 4, specializationRating: 6 }, 1, 6).invalid, /concentration/);
  });
  test('bad input', () => {
    assert.equal(paidSkillRating({ rating: NaN, specializationRating: undefined }, 1, 6).paid, 0);
    assert.equal(paidSkillRating(null as any).paid, 0);
  });
});

describe('v0.71.0 (R3) the build check', () => {
  test('review F8: a character out of creation is asked no trade', () => {
    const rows = buildCheck({ ...baseInput({ activeSkills: [{ name: 'Firearms', rating: 6, specialization: 'Pistols', specializationRating: 9 }] }), inCreation: false });
    assert.equal(row(rows, 'Skills: specializations'), undefined);
  });
  test('switch on: the paid rating counts; a legal trade passes', () => {
    const rows = buildCheck(baseInput({ activeSkills: [{ name: 'Firearms', rating: 4, specialization: 'Pistols', specializationRating: 6 }] }));
    assert.equal(row(rows, 'Skills')!.used, '5 points');
    const spec = row(rows, 'Skills: specializations')!;
    assert.equal(spec.ok, true);
    assert.match(spec.used, /Firearms 4 \(Pistols 6\): 5/);
  });
  test('switch on: Firearms 6 (Pistols 9) fails with a clear row', () => {
    const rows = buildCheck(baseInput({ activeSkills: [{ name: 'Firearms', rating: 6, specialization: 'Pistols', specializationRating: 9 }] }));
    const spec = row(rows, 'Skills: specializations')!;
    assert.equal(spec.ok, false);
    assert.match(String(spec.note), /Firearms 6 \(Pistols 9\): a specialization is paid for by lowering the general skill/);
    assert.match(String(spec.note), /Firearms 5 → Pistols 7 costs 6 points/);
    const skills = row(rows, 'Skills')!;
    assert.equal(skills.ok, false);                    // paid 8 is above 6
    assert.match(String(skills.note), /paid rating/);
  });
  test('switch on: no specializations, no extra row; knowledge skills trade too', () => {
    assert.equal(row(buildCheck(baseInput({ activeSkills: [{ name: 'Firearms', rating: 5 }] })), 'Skills: specializations'), undefined);
    const rows = buildCheck(baseInput({ knowledgeSkills: [{ name: 'Street Lore', rating: 2, specialization: 'Redmond', specializationRating: 4 }] }));
    assert.equal(row(rows, 'Skills')!.used, '3 points');   // paid 3 (CREATION.knowledgePerInt is 0)
  });
  test('switch off: the old behaviour (rating only, no row)', () => {
    F().specialization.tradeAtCreation = false;
    const rows = buildCheck(baseInput({ activeSkills: [{ name: 'Firearms', rating: 6, specialization: 'Pistols', specializationRating: 9 }] }));
    assert.equal(row(rows, 'Skills')!.used, '6 points');
    assert.equal(row(rows, 'Skills')!.ok, true);
    assert.equal(row(rows, 'Skills: specializations'), undefined);
  });
  test('ratio from the switch', () => {
    F().specialization.ratio = 2;
    const rows = buildCheck(baseInput({ activeSkills: [{ name: 'Firearms', rating: 3, specialization: 'Pistols', specializationRating: 6 }] }));
    assert.equal(row(rows, 'Skills')!.used, '5 points');
    assert.equal(row(rows, 'Skills: specializations')!.ok, true);
  });
  test('specializationRow: null with nothing to show', () => {
    assert.equal(specializationRow([], 1, 6), null);
    assert.equal(specializationRow([{ name: 'X', rating: 3 }], 1, 6), null);
  });
});

describe('v0.71.0 (R3) the skill picker trade', () => {
  test('paid 5 → skill 4, specialization 6', () => {
    assert.deepEqual(specializationTrade(5, 0, 1), { rating: 4, specRating: 6, note: '5 skill points: the skill 4, the specialization 6.' });
  });
  test('a given specialization rating above the paid one trades more points', () => {
    assert.deepEqual(specializationTrade(5, 7, 1).rating, 3);
    assert.deepEqual(specializationTrade(5, 7, 1).specRating, 7);
    assert.deepEqual(specializationTrade(5, 0, 2), { rating: 3, specRating: 6, note: '5 skill points: the skill 3, the specialization 6.' });
  });
  test('the skill stays at least 1', () => {
    assert.deepEqual(specializationTrade(3, 9, 1), { rating: 1, specRating: 5, note: '3 skill points: the skill 1, the specialization 5.' });
    const none = specializationTrade(1, 0, 1);
    assert.equal(none.specRating, 0);
    assert.equal(none.rating, 1);
    assert.match(none.note, /nothing to trade/);
  });
  test('a picked trade passes the build check at its paid rating', () => {
    const t = specializationTrade(6, 0, 1);
    const p = paidSkillRating({ rating: t.rating, specializationRating: t.specRating }, 1, 6);
    assert.equal(p.paid, 6);
    assert.equal(p.invalid, '');
  });
});

describe('v0.71.0 (R4) Athletics is a Body skill', () => {
  test('the attribute guess, the picker and the starter list', () => {
    assert.equal(guessSkillAttribute('Athletics'), 'body');
    assert.equal(guessSkillAttribute('athletics (climbing)'), 'body');
    assert.equal(guessSkillAttribute('Stealth'), 'quickness');
    assert.equal(skillAttributeFor('Athletics', 'active'), 'body');
    assert.equal(skillAttributeFor('Athletics', 'knowledge'), 'intelligence');
    assert.equal(starterSkillsMissing([]).find((s) => s.name === 'Athletics')!.attribute, 'body');
  });
  test('the picker follows the athletics test attribute', () => {
    const before = RULES.STREET.athletics.attribute;
    try {
      (RULES.STREET.athletics as any).attribute = 'strength';
      assert.equal(skillAttributeFor('Athletics', 'active'), 'strength');
    } finally { (RULES.STREET.athletics as any).attribute = before; }
  });
  const base: SetupInput = { actorType: 'character', attributes: [], attributeWarnings: [], essence: 6, cyberWarnings: [], adeptOver: [], magic: 0, skills: [{ name: 'Firearms' }], items: [], build: [] };
  test('a setup warning for Athletics linked to Quickness', () => {
    const w = setupWarnings({ ...base, skills: [{ name: 'Athletics', attribute: 'quickness' }] });
    assert.ok(w.some((x) => x.text === 'Athletics is linked to Quickness; SR2 links it to Body.' && x.level === 'warn'));
    assert.equal(setupWarnings({ ...base, skills: [{ name: 'Athletics', attribute: 'body' }] }).length, 0);
    assert.equal(setupWarnings({ ...base, skills: [{ name: 'Athletics' }] }).length, 0);
  });
});

describe('v0.71.0 (R21) foci bonded from spell points', () => {
  const foci = [{ name: 'Power focus', focusType: 'power', rating: 2, bonded: true }, { name: 'Spell lock', focusType: 'spell', rating: 3, bonded: true }, { name: 'Spare', focusType: 'spell', rating: 4, bonded: false }];
  test('spellPoints: bonded foci count their bonding Karma', (t) => {
    t.after(oldWay({"BOOK_V78.focusKarma.mode": "flat"})); // v0.78.0: the old rule (a house rule)
    const per = RULES.ENCHANTING.focusKarma;
    const want = 2 * (per['power'] ?? 1) + 3 * (per['spell'] ?? 1);
    assert.equal(focusSpellPoints(foci), want);
    const r = spellPointCheck({ allowance: 25, spells: [{ force: 5 }], foci });
    assert.equal(r.used, 5 + want);
    assert.equal(r.foci, want);
    assert.match(r.note, new RegExp(`spells 5 \\+ foci ${want}`));
    const over = spellPointCheck({ allowance: 10, spells: [{ force: 5 }], foci });
    assert.equal(over.ok, false);
    assert.match(over.note, /over the allowance/);
  });
  test('free: the old behaviour (spells only, the old result shape)', () => {
    F().creationFoci = 'free';
    assert.equal(focusSpellPoints(foci), 0);
    assert.deepEqual(spellPointCheck({ allowance: 25, spells: [{ force: 20 }], foci }), { used: 20, allowance: 25, ok: true, extraNuyen: 0, note: '5 unspent' });
  });
  test('no foci: the old result shape', () => {
    assert.deepEqual(spellPointCheck({ allowance: 25, spells: [{ force: 20 }] }), { used: 20, allowance: 25, ok: true, extraNuyen: 0, note: '5 unspent' });
    assert.equal(focusSpellPoints(null), 0);
  });
});
