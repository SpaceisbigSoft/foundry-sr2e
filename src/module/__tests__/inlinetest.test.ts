/**
 * v0.60.0: inline success tests (@SR2Test[...] and /sr2): the spec parser, labels, the skill matcher
 * and the chat command reader. Pure.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseInlineTest, inlineTestLabel, inlineTestSummary, inlineTestSubject, matchInlineSkill, chatCommandSpec,
  signedText, INLINE_TEST_PATTERN, type InlineTest,
} from '../rules/inlinetest.ts';

const ok = (spec: string): InlineTest => {
  const r = parseInlineTest(spec);
  assert.notEqual(typeof r, 'string', `expected "${spec}" to parse, got: ${String(r)}`);
  return r as InlineTest;
};
const bad = (spec: string): string => {
  const r = parseInlineTest(spec);
  assert.equal(typeof r, 'string', `expected "${spec}" to fail`);
  return r as string;
};

describe('parseInlineTest: subjects', () => {
  test('attributes by full name, any case and spacing', () => {
    for (const a of ['body', 'quickness', 'strength', 'charisma', 'intelligence', 'willpower', 'reaction', 'magic', 'essence']) {
      assert.deepEqual(ok(a), { kind: 'attribute', attribute: a, tn: 4, mod: 0, pool: 0, label: null });
    }
    assert.equal((ok('  BODY  ') as any).attribute, 'body');
    assert.equal((ok('WillPower') as any).attribute, 'willpower');
  });

  test('attribute short forms', () => {
    const cases: Record<string, string> = { bod: 'body', qui: 'quickness', quick: 'quickness', str: 'strength', cha: 'charisma', int: 'intelligence', wil: 'willpower', will: 'willpower', rea: 'reaction', mag: 'magic', ess: 'essence' };
    for (const [k, v] of Object.entries(cases)) assert.equal((ok(k) as any).attribute, v, k);
  });

  test('perception', () => {
    assert.equal(ok('perception').kind, 'perception');
    assert.equal(ok('Perception tn 6').tn, 6);
    assert.equal(ok('notice').kind, 'perception');
  });

  test('a number of dice', () => {
    assert.deepEqual(ok('6'), { kind: 'dice', dice: 6, tn: 4, mod: 0, pool: 0, label: null });
    assert.equal((ok('6d6') as any).dice, 6);
    assert.equal((ok('6d') as any).dice, 6);
    assert.equal((ok('6 dice') as any).dice, 6);
    assert.equal((ok('1 die') as any).dice, 1);
    assert.equal((ok('8 vs 5') as any).tn, 5);
    assert.match(bad('0'), /out of range/);
    assert.match(bad('101'), /out of range/);
    assert.match(bad('6d8'), /number of dice/);
  });

  test('skills, bare or quoted, with or without a specialization', () => {
    assert.deepEqual(ok('Firearms'), { kind: 'skill', skill: 'Firearms', specialization: null, tn: 4, mod: 0, pool: 0, label: null });
    assert.deepEqual(ok('"Etiquette (Street)"'), { kind: 'skill', skill: 'Etiquette', specialization: 'Street', tn: 4, mod: 0, pool: 0, label: null });
    assert.deepEqual(ok('Etiquette (Street) tn 5'), { kind: 'skill', skill: 'Etiquette', specialization: 'Street', tn: 5, mod: 0, pool: 0, label: null });
    assert.deepEqual(ok("'Car  B/R'"), { kind: 'skill', skill: 'Car B/R', specialization: null, tn: 4, mod: 0, pool: 0, label: null });
    assert.equal((ok('Unarmed   Combat') as any).skill, 'Unarmed Combat');
    assert.equal((ok('Etiquette (Corporate Culture)') as any).specialization, 'Corporate Culture');
    assert.equal((ok('Etiquette ()') as any).specialization, null);
  });

  test('a quoted word that looks like an attribute or number is a skill', () => {
    assert.equal(ok('"Body"').kind, 'skill');
    assert.match(bad('"6"'), /attribute or skill/);
  });

  test('a keyword word with no number after it is part of a skill name', () => {
    assert.equal((ok('Target Designation tn 5') as any).skill, 'Target Designation');
    assert.equal(ok('Target Designation tn 5').tn, 5);
  });

  test('curly quotes from rich text editors', () => {
    assert.equal((ok('“Etiquette (Street)” mod −1') as any).specialization, 'Street');
    assert.equal(ok('“Etiquette (Street)” mod −1').mod, -1);
  });
});

describe('parseInlineTest: options', () => {
  test('tn in its many spellings', () => {
    for (const s of ['body tn 5', 'body TN 5', 'body tn5', 'body tn=5', 'body tn: 5', 'body tn:5', 'body vs 5', 'body target 5']) assert.equal(ok(s).tn, 5, s);
    assert.equal(ok('body').tn, 4);
  });

  test('modifiers, signed or not, several add up', () => {
    assert.equal(ok('Firearms tn 5 mod -1').mod, -1);
    assert.equal(ok('Firearms mod +2').mod, 2);
    assert.equal(ok('Firearms mod 2').mod, 2);
    assert.equal(ok('Firearms mod-1').mod, -1);
    assert.equal(ok('Firearms mod=-1').mod, -1);
    assert.equal(ok('Firearms modifier -3').mod, -3);
    assert.equal(ok('Firearms -1').mod, -1);
    assert.equal(ok('Firearms +2 mod -1').mod, 1);
    assert.equal(ok('Firearms mod −2').mod, -2);
    assert.equal(ok('Firearms mod –2').mod, -2);
  });

  test('pool dice', () => {
    assert.equal(ok('Firearms pool 3').pool, 3);
    assert.equal(ok('Firearms pool=3').pool, 3);
    assert.equal(ok('6 pool 2').pool, 2);
  });

  test('options in any order', () => {
    const t = ok('Firearms pool 2 mod -1 tn 6');
    assert.deepEqual([t.tn, t.mod, t.pool], [6, -1, 2]);
  });

  test('label: the rest of the spec, quoted or not', () => {
    assert.equal(ok('body tn 5 label Climb the fence').label, 'Climb the fence');
    assert.equal(ok('body label "Climb the fence"').label, 'Climb the fence');
    assert.equal(ok('body label:Climb').label, 'Climb');
    assert.match(bad('body label'), /needs some text/);
  });

  test('errors', () => {
    assert.match(bad(''), /Empty/);
    assert.match(bad('   '), /Empty/);
    assert.match(bad('body tn'), /needs a number/);
    assert.match(bad('body tn x'), /needs a number/);
    assert.match(bad('body tn 0'), /out of range/);
    assert.match(bad('body tn 100'), /out of range/);
    assert.match(bad('body tn 4 tn 5'), /twice/);
    assert.match(bad('body pool -1'), /negative/);
    assert.match(bad('body pool 2 pool 3'), /twice/);
    assert.match(bad('body mod 60'), /out of range/);
    assert.match(bad('body tn 5 extra'), /Unexpected "extra"/);
    assert.match(bad('tn 5'), /Say what to roll/);
    assert.match(bad('"Etiquette'), /Unclosed quote/);
    assert.match(bad('Etiquette (Street'), /specialization/);
    assert.match(bad('body tn 4 label  '), /needs some text/);
    assert.match(bad('---'), /attribute or skill/);
  });
});

describe('labels', () => {
  test('summaries', () => {
    assert.equal(inlineTestSummary(ok('body')), 'Body (TN 4)');
    assert.equal(inlineTestSummary(ok('Firearms tn 5 mod -1')), 'Firearms (TN 5, −1)');
    assert.equal(inlineTestSummary(ok('Firearms tn 5 mod 2 pool 3')), 'Firearms (TN 5, +2, +3 pool)');
    assert.equal(inlineTestSummary(ok('6')), '6 dice vs 4');
    assert.equal(inlineTestSummary(ok('1')), '1 die vs 4');
    assert.equal(inlineTestSummary(ok('6 tn 5 mod -1')), '6 dice vs 5 (−1)');
    assert.equal(inlineTestSummary(ok('"Etiquette (Street)"')), 'Etiquette (Street) (TN 4)');
    assert.equal(inlineTestSummary(ok('perception tn 6')), 'Perception (TN 6)');
    assert.equal(inlineTestSummary(ok('int')), 'Intelligence (TN 4)');
  });

  test('the spec label wins in inlineTestLabel, not in the summary', () => {
    const t = ok('body tn 5 label Climb the fence');
    assert.equal(inlineTestLabel(t), 'Climb the fence');
    assert.equal(inlineTestSummary(t), 'Body (TN 5)');
    assert.equal(inlineTestLabel(ok('body')), 'Body (TN 4)');
  });

  test('subjects and signs', () => {
    assert.equal(inlineTestSubject(ok('wil')), 'Willpower');
    assert.equal(signedText(-2), '−2');
    assert.equal(signedText(3), '+3');
    assert.equal(signedText(0), '+0');
  });
});

describe('matchInlineSkill', () => {
  const skills = [
    { name: 'Firearms', specialization: 'Pistols', specializationRating: 6 },
    { name: 'Etiquette', specialization: 'Street', specializationRating: 5 },
    { name: 'Etiquette (Corporate)', specialization: '', specializationRating: 0 },
    { name: 'Car B/R', specialization: '', specializationRating: 0 },
    { name: 'Stealth', specialization: 'Urban', specializationRating: 0 },
  ];
  const m = (spec: string) => matchInlineSkill(skills, ok(spec) as any);

  test('by name, case and spacing ignored', () => {
    assert.equal(m('firearms')?.skill.name, 'Firearms');
    assert.equal(m('firearms')?.useSpecialization, false);
    assert.equal(m('"car  b/r"')?.skill.name, 'Car B/R');
  });

  test('with a specialization the skill has: roll the specialization', () => {
    const r = m('"Etiquette (street)"');
    assert.equal(r?.skill.name, 'Etiquette');
    assert.equal(r?.useSpecialization, true);
    assert.equal(r?.specializationMissing, false);
  });

  test('an item named with the specialization in it', () => {
    const r = m('Etiquette (Corporate)');
    assert.equal(r?.skill.name, 'Etiquette (Corporate)');
    assert.equal(r?.useSpecialization, false);
  });

  test('a specialization it lacks: the plain skill, flagged', () => {
    const r = m('Firearms (Rifles)');
    assert.equal(r?.skill.name, 'Firearms');
    assert.equal(r?.useSpecialization, false);
    assert.equal(r?.specializationMissing, true);
    // A specialization with no rating doesn't count.
    assert.equal(m('Stealth (Urban)')?.specializationMissing, true);
  });

  test('a specialization named alone', () => {
    const r = m('pistols');
    assert.equal(r?.skill.name, 'Firearms');
    assert.equal(r?.useSpecialization, true);
    assert.equal(m('urban'), null);
  });

  test('a name without the parenthetical', () => {
    const only = [{ name: 'Etiquette (Corporate)' }];
    assert.equal(matchInlineSkill(only, ok('etiquette') as any)?.skill.name, 'Etiquette (Corporate)');
  });

  test('nothing fits', () => {
    assert.equal(m('Sorcery'), null);
    assert.equal(m('Sorcery (Combat)'), null);
  });

  test('with a view over item-shaped objects', () => {
    const items = [{ id: 'a', name: 'Firearms', system: { specialization: 'Pistols', specializationRating: 6 } }];
    const r = matchInlineSkill(items, { skill: 'firearms', specialization: 'pistols' }, (i) => ({ name: i.name, specialization: i.system.specialization, specializationRating: i.system.specializationRating }));
    assert.equal(r?.skill.id, 'a');
    assert.equal(r?.useSpecialization, true);
  });
});

describe('the enricher pattern and the chat command', () => {
  test('pattern finds specs and labels', () => {
    const text = 'Roll @SR2Test[body tn 5]{Resist the toxin} then @SR2Test["Etiquette (Street)" mod -1] or @sr2test[6].';
    const found = [...text.matchAll(new RegExp(INLINE_TEST_PATTERN.source, INLINE_TEST_PATTERN.flags))].map((x) => [x[1], x[2]]);
    assert.deepEqual(found, [['body tn 5', 'Resist the toxin'], ['"Etiquette (Street)" mod -1', undefined], ['6', undefined]]);
    assert.ok(INLINE_TEST_PATTERN.global);
  });

  test('chat command', () => {
    assert.equal(chatCommandSpec('/sr2 body tn 5'), 'body tn 5');
    assert.equal(chatCommandSpec('/SR2E   Firearms'), 'Firearms');
    assert.equal(chatCommandSpec('/sr2'), '');
    assert.equal(chatCommandSpec('  /sr2  '), '');
    assert.equal(chatCommandSpec('/sr2x body'), null);
    assert.equal(chatCommandSpec('/roll 1d6'), null);
    assert.equal(chatCommandSpec('hello /sr2 body'), null);
  });
});
