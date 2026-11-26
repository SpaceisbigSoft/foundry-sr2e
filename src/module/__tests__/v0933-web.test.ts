/**
 * v0.93.3: the default Skill Web (rules/skillweb-default.ts), the SR2 Core p. 69 diagram as links and circle counts.
 * It parses with no stray lines, it is the setting's default, a set of distances read off the diagram, and the
 * book's arrows (one way, and attributes only as a start).
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_SKILL_WEB, DEFAULT_SKILL_WEB_COMPLETE } from '../rules/skillweb-default.ts';
import { parseSkillWeb, webDistance } from '../rules/skills.ts';

const links = parseSkillWeb(DEFAULT_SKILL_WEB);
const linkLines = DEFAULT_SKILL_WEB.split(/\r?\n/).map((l) => l.replace(/#.*$/, '').trim()).filter(Boolean);
/** Needed skill, what the character has: circles passed (null = no path). */
const dist = (needed: string, had: string) => webDistance(links, needed, had);

describe('v0.93.3 default Skill Web (SR2 Core p. 69)', () => {
  test('parses: one link per line, none left unread, and cites the page', () => {
    assert.ok(links.length > 150);
    assert.equal(links.length, linkLines.length);
    assert.ok(DEFAULT_SKILL_WEB_COMPLETE);
    assert.match(DEFAULT_SKILL_WEB, /SR2 Core p\. 69/);
  });
  test('it is the world setting\'s default (an empty text still means no web)', () => {
    const s = readFileSync(join(process.cwd(), 'src', 'module', 'settings.ts'), 'utf8');
    assert.match(s, /register\(SYSTEM\.id, "skillWeb", \{[\s\S]{0,300}default: DEFAULT_SKILL_WEB/);
  });
  test('distances read off the diagram', () => {
    assert.equal(dist('Gunnery', 'Firearms'), 1);
    assert.equal(dist('Throwing Weapons', 'Projectile Weapons'), 1);
    assert.equal(dist('Firearms B/R', 'Firearms'), 1);
    assert.equal(dist('Stealth', 'Athletics'), 3);
    assert.equal(dist('Computer', 'Electronics'), 1);
    assert.equal(dist('Computer Theory', 'Computer'), 1);
    assert.equal(dist('Cybertechnology', 'Biology'), 1);
    assert.equal(dist('Car', 'Bike'), 1);
    assert.equal(dist('Car', 'Motorboat'), 4);
    assert.equal(dist('Negotiation', 'Etiquette'), 1);
    assert.equal(dist('Sorcery', 'Conjuring'), 2);
    assert.equal(dist('Sorcery', 'Magical Theory'), 2);
  });
  test('attributes: traced from the attribute to the skill, never through one', () => {
    assert.equal(dist('Athletics', 'Quickness'), 1);
    assert.equal(dist('Stealth', 'Quickness'), 2);
    assert.equal(dist('Unarmed Combat', 'Body'), 3);
    assert.equal(dist('Demolitions', 'Intelligence'), 3);
    assert.equal(dist('Etiquette', 'Charisma'), 2);
    assert.equal(dist('Psychology', 'Willpower'), 3);
    assert.equal(dist('Rotorcraft', 'Reaction'), 3);
    // Sorcery reaches Willpower only through Magical Theory's name (3 + 2 circles).
    assert.equal(dist('Sorcery', 'Willpower'), 5);
    // No skill-to-skill path goes through an attribute: Athletics and Car aren't joined through Quickness and Reaction.
    assert.equal(dist('Car', 'Athletics'), null);
  });
  test('the book\'s arrows: one way only', () => {
    // The Quickness trunk's arrow into the combat skills: a gun can be fired with Armed Combat, not the other way.
    assert.equal(dist('Firearms', 'Armed Combat'), 3);
    assert.equal(dist('Armed Combat', 'Firearms'), null);
    // Psychology's arrow into the Charisma skills.
    assert.equal(dist('Psychology', 'Etiquette'), 3);
    assert.equal(dist('Etiquette', 'Psychology'), null);
    // Demolitions: the arrow points at it.
    assert.equal(dist('Demolitions', 'Physical Sciences'), null);
    for (const l of links) if (/^(Body|Quickness|Strength|Charisma|Intelligence|Willpower|Reaction)$/.test(l.a)) assert.ok(l.oneWay, `${l.a} > ${l.b}`);
  });
});
