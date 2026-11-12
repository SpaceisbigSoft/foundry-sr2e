import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { skillTestDice, parseSkillWeb, webDistance, relatedDefaultTn, martialAttack } from '../skills.ts';
import { buildCheck } from '../creation.ts';
import { RULES } from '../config.ts';
import { oldWay } from './oldway.ts';

describe('skills and creation (v0.38.0)', () => {
  test('concentrations sit between the skill and the specialization', () => {
    assert.deepEqual(skillTestDice({ rating: 4, concentrationRating: 5, useConcentration: true, attributeRating: 3 }), { dice: 5, modifier: null, using: 'concentration' });
    assert.equal(skillTestDice({ rating: 4, concentrationRating: 5, specializationRating: 6, useConcentration: true, useSpecialization: true, attributeRating: 3 }).dice, 6);
    assert.equal(skillTestDice({ rating: 4, concentrationRating: 5, attributeRating: 3 }).dice, 4);
    assert.equal(skillTestDice({ rating: 0, attributeRating: 3, related: { name: 'Gunnery', rating: 4 }, relatedTn: 6 }).modifier?.value, 6);
  });
  test('the Skill Web', () => {
    const links = parseSkillWeb('Firearms - Gunnery: 1\nGunnery - Car: 2\n# a comment\nNegotiation – Etiquette\nbad line');
    assert.equal(links.length, 3);
    assert.equal(webDistance(links, 'firearms', 'Car'), 3);
    assert.equal(webDistance(links, 'Firearms', 'Etiquette'), null);
    assert.equal(relatedDefaultTn(links, 'Firearms', 'Gunnery'), 2);
    assert.equal(relatedDefaultTn(links, 'Firearms', 'Car'), 6);
    assert.equal(relatedDefaultTn(links, 'Firearms', 'Etiquette'), null);
    (RULES.SKILLS.web as any).unlinked = 'flat';
    try { assert.equal(relatedDefaultTn(links, 'Firearms', 'Etiquette'), RULES.SKILL_DEFAULT_TN_MOD); } finally { (RULES.SKILLS.web as any).unlinked = 'attribute'; }
    assert.equal(relatedDefaultTn([], 'A', 'B'), RULES.SKILL_DEFAULT_TN_MOD);
  });
  test('martial arts', () => {
    assert.deepEqual(martialAttack({ power: 4, level: 'M', reach: 0 }, { power: 1, stage: 1, reach: 0, defense: 0 }), { power: 5, level: 'S', reach: 0 });
    assert.deepEqual(martialAttack({ power: 4, level: 'S', reach: 0 }, null), { power: 4, level: 'S', reach: 0 });
  });
  test('the priority-table build check', (tt) => {
    // v0.92.3: the old (v0.92.2) rule this test pins (RULES.CORE_V923 / book alignment).
    tt.after(oldWay({ 'CORE_V923.priorities': 'old' }));
    const rows = buildCheck({
      priorities: { race: 'D', magic: 'A', attributes: 'B', skills: 'C', resources: 'E' },
      metatype: 'ork', magic: 'full', attributes: { body: 6, quickness: 5, strength: 5, charisma: 3, intelligence: 4, willpower: 4 }, intelligence: 4,
      activeSkills: [{ name: 'Sorcery', rating: 6 }, { name: 'Conjuring', rating: 7 }], knowledgeSkills: [{ name: 'Magic Theory', rating: 4 }],
      gearCost: 3000, nuyen: 2500, essence: 6,
    });
    const by = Object.fromEntries(rows.map((r) => [r.label, r]));
    assert.equal(by['Priorities']!.ok, true);
    assert.equal(by['Race']!.ok, true);
    assert.equal(by['Magic']!.ok, true);
    assert.deepEqual([by['Attributes']!.used, by['Attributes']!.ok], ['27 points', true]);
    assert.equal(by['Skills']!.ok, false);                 // Conjuring 7 is above 6
    assert.match(String(by['Skills']!.note), /Conjuring/);
    assert.equal(by['Resources']!.ok, false);              // ¥5,500 of ¥5,000
    const dup = buildCheck({ priorities: { race: 'E', magic: 'E' }, metatype: 'troll', magic: 'none', attributes: {}, intelligence: 1, activeSkills: [], knowledgeSkills: [], gearCost: 0, nuyen: 0, essence: 6 });
    assert.equal(dup.find((r) => r.label === 'Priorities')!.ok, false);
    assert.equal(dup.find((r) => r.label === 'Race')!.ok, false);    // trolls need C
  });
});
