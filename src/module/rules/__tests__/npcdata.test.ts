import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as D from '../npcdata.ts';

const MINIMUMS: Record<string, number> = {
  FIRST_NAMES: 150, SURNAMES: 150, STREET_NAMES: 150,
  GANG_ADJECTIVES: 40, GANG_NOUNS: 40, GANG_THEMES: 25, GANG_COLOURS: 20,
  APPEARANCE: 40, CLOTHING: 40, DISTINCTIVE: 40, MANNERISM: 40, MOTIVATION: 40, SECRET: 40,
  CORP_PREFIXES: 40, CORP_SUFFIXES: 20, INDUSTRIES: 25, ORG_KINDS: 15, ORG_QUIRKS: 30, ORG_GOALS: 30, ORG_HQS: 30,
  JOB_TYPES: 25, JOB_TARGETS: 30, JOB_LOCATIONS: 30, JOB_COMPLICATIONS: 40, JOB_TWISTS: 30, MEETING_PLACES: 25, EMPLOYERS: 25,
  SPIRIT_FLAVOUR: 20, CRITTER_FLAVOUR: 15,
};

const tables = D as unknown as Record<string, readonly string[]>;

describe('npcdata string tables', () => {
  test('TABLE_NAMES covers every required table', () => {
    assert.deepEqual([...D.TABLE_NAMES].sort(), Object.keys(MINIMUMS).sort());
  });
  for (const name of Object.keys(MINIMUMS)) {
    test(`${name}: size, non-empty, unique`, () => {
      const list = tables[name];
      assert.ok(Array.isArray(list), `${name} exported`);
      assert.ok(list.length >= MINIMUMS[name]!, `${name} has ${list.length} < ${MINIMUMS[name]}`);
      const seen = new Set<string>();
      for (const s of list) {
        assert.equal(typeof s, 'string');
        assert.ok(s.trim().length > 0, `${name} has blank entry`);
        const k = s.trim().toLowerCase();
        assert.ok(!seen.has(k), `${name} duplicate: ${s}`);
        seen.add(k);
      }
    });
  }
  test('STREET_NAMES are one or two words', () => {
    for (const s of D.STREET_NAMES) assert.ok(s.trim().split(/\s+/).length <= 2, s);
  });
});

describe('CONTACT_ROLES', () => {
  const allowed = ['ganger', 'thug', 'guard', 'elite', 'merc', 'decker', 'rigger', 'mage', 'shaman', 'adept',
    'face', 'suit', 'cop', 'tech', 'doc', 'fixer', 'smuggler', 'bartender', 'talismonger'];
  test('at least 25, unique ids', () => {
    assert.ok(D.CONTACT_ROLES.length >= 25);
    assert.equal(new Set(D.CONTACT_ROLES.map((c) => c.id)).size, D.CONTACT_ROLES.length);
  });
  test('valid archetypes, fees, labels, skills', () => {
    for (const c of D.CONTACT_ROLES) {
      assert.ok(allowed.includes(c.archetype), `${c.id} archetype ${c.archetype}`);
      assert.ok(Number.isFinite(c.fee) && c.fee >= 50 && c.fee <= 2000, `${c.id} fee ${c.fee}`);
      assert.ok(c.label.trim().length > 0 && c.id.trim().length > 0);
      for (const part of c.skills.split(',')) assert.match(part.trim(), /^[A-Za-z][A-Za-z' -]* \d+$/, `${c.id}: ${part}`);
    }
  });
});

describe('pick', () => {
  test('uses rnd deterministically and clamps', () => {
    const list = ['a', 'b', 'c', 'd'] as const;
    assert.equal(D.pick(list, () => 0), 'a');
    assert.equal(D.pick(list, () => 0.5), 'c');
    assert.equal(D.pick(list, () => 0.9999), 'd');
    assert.equal(D.pick(list, () => 1), 'd');
    assert.throws(() => D.pick([], () => 0));
  });
});

describe('content hygiene', () => {
  test('no banned setting-specific names in module text', () => {
    const text = fs.readFileSync(new URL('../npcdata.ts', import.meta.url), 'utf8').toLowerCase();
    const banned = ['Renraku', 'Ares', 'Aztechnology', 'Saeder', 'Mitsuhama', 'Fuchi', 'Shiawase', 'Yamatetsu',
      'Wuxing', 'Lone Star', 'Knight Errant', 'DocWagon', 'Barrens'];
    // Whole words only: ordinary words ("stares", "wares") contain some of these letters.
    for (const w of banned) assert.ok(!new RegExp(`\\b${w.toLowerCase()}\\b`).test(text), `banned word found: ${w}`);
  });
});
