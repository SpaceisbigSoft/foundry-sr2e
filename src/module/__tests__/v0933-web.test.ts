/**
 * v0.93.3: the default Skill Web (rules/skillweb-default.ts). It parses with no stray lines, every name in it is a
 * skill (or attribute) the system uses, a few distances along it, and its arrows are one-way.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SKILL_WEB, DEFAULT_SKILL_WEB_COMPLETE } from '../rules/skillweb-default.ts';
import { parseSkillWeb, webDistance, relatedDefaultTn } from '../rules/skills.ts';
import { COMMON_SKILLS } from '../rules/catalogue.ts';
import { RULES } from '../rules/config.ts';
import { gearRepairPlan } from '../rules/everyday.ts';

const links = parseSkillWeb(DEFAULT_SKILL_WEB);

/** The lines parseSkillWeb should read: not blank, not a comment. */
const linkLines = DEFAULT_SKILL_WEB.split(/\r?\n/).map((l) => l.replace(/#.*$/, '').trim()).filter(Boolean);

/** Names the system uses: the skill picker's lists, a B/R skill as "<skill> B/R" (everyday.ts), the attributes. */
const ATTRIBUTES = ['Body', 'Quickness', 'Strength', 'Charisma', 'Intelligence', 'Willpower', 'Reaction', 'Magic'];
const known = new Set<string>([
  ...Object.values(COMMON_SKILLS).flat(),
  ...COMMON_SKILLS.active.map((s) => gearRepairPlan({ kind: 'weapon', weaponSkill: s }).skill),
  'Enchanting',
  ...ATTRIBUTES,
].map((s) => s.toLowerCase()));

describe('v0.93.3 default Skill Web', () => {
  test('parses: one link per link line, no line left unread', () => {
    assert.ok(links.length > 0);
    assert.equal(links.length, linkLines.length, 'every non-comment line is a link');
    assert.equal(links.length, 18);
  });

  test('is marked partial and cites the book page', () => {
    assert.equal(DEFAULT_SKILL_WEB_COMPLETE, false);
    assert.match(DEFAULT_SKILL_WEB, /SR2 Core p\. 69/);
    assert.match(DEFAULT_SKILL_WEB, /# VERIFY/);
  });

  test('every name is a skill or attribute the system knows', () => {
    for (const l of links) for (const n of [l.a, l.b]) assert.ok(known.has(n.toLowerCase()), `unknown name: ${n}`);
  });

  test('steps are whole numbers of at least 1, no link twice', () => {
    const seen = new Set<string>();
    for (const l of links) {
      assert.ok(Number.isInteger(l.steps) && l.steps >= 1, `${l.a}/${l.b}`);
      const k = [l.a, l.b].map((s) => s.toLowerCase()).sort().join('|');
      assert.ok(!seen.has(k), `twice: ${k}`);
      seen.add(k);
    }
  });

  test('known distances', () => {
    assert.equal(webDistance(links, 'Firearms B/R', 'Firearms'), 1);
    assert.equal(webDistance(links, 'Armed Combat', 'Armed Combat B/R'), 1);
    assert.equal(webDistance(links, 'Conjuring', 'Magical Theory'), 1);
    assert.equal(webDistance(links, 'Sorcery', 'Enchanting'), 1);
    assert.equal(webDistance(links, 'Conjuring', 'Willpower'), 2);
    assert.equal(webDistance(links, 'firearms', 'FIREARMS B/R'), 1, 'names match whatever the case');
    // Not linked by this partial web.
    assert.equal(webDistance(links, 'Firearms', 'Computer'), null);
    assert.equal(relatedDefaultTn(links, 'Computer B/R', 'Computer'), 2);
  });

  test('the arrows parse as one-way, from the attribute to the skill', () => {
    const arrows = links.filter((l) => l.oneWay);
    assert.equal(arrows.length, 3);
    for (const l of arrows) {
      assert.equal(l.a, 'Willpower');
      assert.ok(['Sorcery', 'Conjuring', 'Enchanting'].includes(l.b));
    }
    for (const l of links.filter((x) => !x.oneWay)) assert.ok(!ATTRIBUTES.includes(l.a) && !ATTRIBUTES.includes(l.b), 'attributes only on arrows');
  });

  test('with the book arrows on, a skill never paths through an attribute', () => {
    const prev = RULES.URR_V80.coreWebArrows;
    (RULES.URR_V80 as any).coreWebArrows = true;
    try {
      assert.equal(webDistance(links, 'Conjuring', 'Willpower'), 2, 'the needed skill reaches the attribute');
      // Conjuring -> Willpower is fine, but Willpower -> Sorcery runs against the arrow.
      const viaAttr = parseSkillWeb('Willpower > Sorcery: 2\nWillpower > Conjuring: 2');
      assert.equal(webDistance(viaAttr, 'Conjuring', 'Sorcery'), null);
    } finally { (RULES.URR_V80 as any).coreWebArrows = prev; }
  });
});
