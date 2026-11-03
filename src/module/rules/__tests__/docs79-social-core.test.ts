/**
 * v0.79.0 (social_core): the documents' social tests and skill Karma (RULES.DOCS_V79.socialDesired,
 * socialInfluence, skillKarma). The documents' way is the default; the old way is checked through oldWay().
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { RULES } from '../config.ts';
import { oldWay } from './oldway.ts';
import {
  socialDesiredPick, socialDesiredRows, socialDesiredModifiers, socialOneSided, socialInfluenceOutcome, socialInfluenceLine,
  skillKarmaMultiplier, docsSkillCost,
} from '../docs79-social-core.ts';

describe('v0.79.0 desired result (DOCS_V79.socialDesired)', () => {
  test("the Social Skill Table's scale: one pick, −2 / 0 / +2 / +4 / +6", () => {
    assert.equal(socialDesiredPick(), true);
    assert.deepEqual(socialDesiredRows().map((r) => r.value), [-2, 0, 2, 4, 6]);
    assert.deepEqual(socialDesiredModifiers(['harmful']), [{ label: 'Desired result: Harmful to them', value: 4 }]);
    assert.deepEqual(socialDesiredModifiers(['disastrous', 'advantageous']).map((m) => m.value), [6], 'one scale: the first pick only');
    assert.deepEqual(socialDesiredModifiers(['none']), []);
    assert.deepEqual(socialDesiredModifiers(['against']), [], 'an old row id means nothing on the new scale');
  });
  test('the old way: the house checkboxes, each ticked row counts', (t) => {
    t.after(oldWay({ 'DOCS_V79.socialDesired.mode': 'old' }));
    assert.equal(socialDesiredPick(), false);
    assert.equal(socialDesiredRows(), RULES.STREET.social.situations);
    assert.deepEqual(socialDesiredModifiers(['advantage', 'bribe']).map((m) => m.value), [-2, -1]);
  });
});

describe('v0.79.0 attitude (STREET.social.attitudes, plain value)', () => {
  test('the documents keep friendly −2, neutral 0, hostile +4, enemy +6 (suspicious is the lead\'s config edit)', () => {
    const v = (id: string) => RULES.STREET.social.attitudes.find((a) => a.id === id)?.value;
    assert.deepEqual([v('friendly'), v('neutral'), v('hostile'), v('enemy')], [-2, 0, 4, 6]);
  });
});

describe('v0.79.0 social influence tests (DOCS_V79.socialInfluence)', () => {
  test('Etiquette, Leadership and Negotiation are one-sided; negotiating pay and the other skills stay opposed', () => {
    assert.equal(socialOneSided('Etiquette'), true);
    assert.equal(socialOneSided('leadership'), true);
    assert.equal(socialOneSided('Negotiation (Bribe)'), true);
    assert.equal(socialOneSided('Negotiation', { pay: true }), false);
    assert.equal(socialOneSided('Interrogation'), false);
    assert.equal(socialOneSided('Intimidation'), false);
    assert.equal(socialOneSided('Instruction'), false);
    assert.equal(socialOneSided('Etiquetteless'), false);
  });
  test('one success passes; more are extra', () => {
    assert.deepEqual(socialInfluenceOutcome(0), { passed: false, extra: 0, winner: 'none', net: 0 });
    assert.deepEqual(socialInfluenceOutcome(1), { passed: true, extra: 0, winner: 'initiator', net: 1 });
    assert.deepEqual(socialInfluenceOutcome(3), { passed: true, extra: 2, winner: 'initiator', net: 3 });
    assert.match(socialInfluenceLine(0, 'Mr. Johnson'), /Mr\. Johnson isn't swayed/);
    assert.match(socialInfluenceLine(2), /1 extra success for a better result/);
  });
  test('the old way: every social test is opposed', (t) => {
    t.after(oldWay({ 'DOCS_V79.socialInfluence.mode': 'opposed' }));
    assert.equal(socialOneSided('Etiquette'), false);
    assert.equal(socialOneSided('Negotiation'), false);
  });
});

describe('v0.79.0 skill Karma (DOCS_V79.skillKarma)', () => {
  test('the book table: general × 2, concentration × 1.5, specialization × 1, no attribute bands', () => {
    assert.equal(docsSkillCost({ to: 4, kind: 'active' }), 8);
    assert.equal(docsSkillCost({ to: 8, kind: 'active' }), 16);
    assert.equal(docsSkillCost({ to: 3, kind: 'buildRepair' }), 6);
    assert.equal(docsSkillCost({ to: 5, kind: 'active', concentration: true }), 8); // 7.5 rounded up
    assert.equal(docsSkillCost({ to: 6, kind: 'active', concentration: true }), 9);
    assert.equal(docsSkillCost({ to: 5, kind: 'active', specialization: true }), 5);
  });
  test('knowledge and language skills keep the old bands', () => {
    assert.equal(skillKarmaMultiplier({ kind: 'knowledge' }), null);
    assert.equal(docsSkillCost({ to: 3, kind: 'language' }), null);
  });
  test('the old way: the bands', (t) => {
    t.after(oldWay({ 'DOCS_V79.skillKarma.mode': 'bands' }));
    assert.equal(skillKarmaMultiplier({ kind: 'active' }), null);
    assert.equal(docsSkillCost({ to: 4, kind: 'active' }), null);
  });
});
