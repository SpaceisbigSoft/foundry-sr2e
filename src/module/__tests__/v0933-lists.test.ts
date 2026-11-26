/**
 * v0.93.3: the GM's world lists (report item 36): custom skills, hidden book skills, attribute labels.
 * Pure rules (rules/customlists.ts), the settings window with a stub Foundry (applications/customlists.ts), and
 * source checks that the pickers read the lists.
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  parseCustomSkills, parseHidden, formatCustomSkills, normalizeLists, skillChoices, attributeLabel, attributeAbbr,
  setCustomLists, getCustomLists, worldSkillChoices, customSkillAttribute, attrAbbr, attributeDisplayLabel,
  starterChoices, parseKind, parseAttributeKey, LIST_LIMITS, EMPTY_LISTS, defaultAttributeLabel, isHiddenSkill,
} from '../rules/customlists.ts';

const read = (f: string) => fs.readFileSync(f, 'utf8');
const BOOK = ['Firearms', 'Stealth', 'Etiquette', 'Car'];

describe('v0.93.3 custom skills: parsing', () => {
  test('a full line, a name only, kinds and attributes as typed', () => {
    const r = parseCustomSkills('Pilot Hoverbike | rea | active | a house skill\nCooking\nLocal Lore | quickness | knowledge\nTrade Pidgin||lang\nDrone B/R | int | B/R', BOOK);
    assert.deepEqual(r.problems, []);
    assert.deepEqual(r.skills, [
      { name: 'Pilot Hoverbike', attribute: 'reaction', kind: 'active', note: 'a house skill' },
      { name: 'Cooking', attribute: 'quickness', kind: 'active' },
      { name: 'Local Lore', attribute: 'intelligence', kind: 'knowledge' },
      { name: 'Trade Pidgin', attribute: 'intelligence', kind: 'language' },
      { name: 'Drone B/R', attribute: 'intelligence', kind: 'buildRepair' },
    ]);
  });

  test('bad lines are skipped with a reason; comments and blanks are ignored', () => {
    const r = parseCustomSkills(`# comment\n\nfirearms | qui\nJuggling | luck\nJuggling2 | body | weird\n${'x'.repeat(LIST_LIMITS.name + 1)}\nKnots\nKNOTS`, BOOK);
    assert.deepEqual(r.skills.map((s) => s.name), ['Knots']);
    assert.deepEqual(r.problems.map((p) => [p.line, p.reason]), [[3, 'book'], [4, 'attribute'], [5, 'kind'], [6, 'name'], [8, 'duplicate']]);
  });

  test('magic and essence are not link attributes; reaction is', () => {
    assert.equal(parseAttributeKey('magic'), null);
    assert.equal(parseAttributeKey('Essence'), null);
    assert.equal(parseAttributeKey('REA'), 'reaction');
    assert.equal(parseAttributeKey('q'), null, 'one letter is too short to tell');
    assert.equal(parseKind(''), 'active');
    assert.equal(parseKind('nonsense'), null);
  });

  test('the count is capped', () => {
    const text = Array.from({ length: LIST_LIMITS.skills + 5 }, (_, i) => `Skill ${i}`).join('\n');
    const r = parseCustomSkills(text);
    assert.equal(r.skills.length, LIST_LIMITS.skills);
    assert.equal(r.problems.filter((p) => p.reason === 'limit').length, 5);
  });

  test('control characters are dropped and spaces collapsed', () => {
    const r = parseCustomSkills('  Odd\u0007   Name  | body');
    assert.equal(r.skills[0]!.name, 'Odd Name');
  });

  test('format round-trips', () => {
    const r = parseCustomSkills('A | body | active | n\nB | int | knowledge\nC');
    assert.deepEqual(parseCustomSkills(formatCustomSkills(r.skills)).skills, r.skills);
  });
});

describe('v0.93.3 hidden skills and the merged list', () => {
  test('hidden names dedupe case-insensitively', () => {
    const h = parseHidden('Car\ncar\n\n# c\nStealth');
    assert.deepEqual(h.hidden, ['Car', 'Stealth']);
    assert.deepEqual(h.problems.map((p) => p.reason), ['duplicate']);
  });

  test('skillChoices: book less hidden, plus custom of the kind, sorted', () => {
    const custom = parseCustomSkills('Cooking\nLocal Lore | | knowledge').skills;
    assert.deepEqual(skillChoices(BOOK, custom, ['stealth', 'CAR']), ['Cooking', 'Etiquette', 'Firearms', 'Local Lore']);
    assert.deepEqual(skillChoices(BOOK, custom, [], 'active'), ['Car', 'Cooking', 'Etiquette', 'Firearms', 'Stealth']);
    assert.deepEqual(skillChoices(BOOK, custom, [], 'knowledge'), ['Car', 'Etiquette', 'Firearms', 'Local Lore', 'Stealth']);
    assert.ok(isHiddenSkill(' stealth ', ['Stealth']));
  });

  test('normalizeLists re-validates a hand-edited setting', () => {
    const l = normalizeLists({
      skills: [{ name: 'Cooking', attribute: 'body', kind: 'active' }, { name: 'Firearms', attribute: 'body', kind: 'active' }, { name: 'X', attribute: 'magic', kind: 'active' }, { name: 'Y|Z', attribute: 'body', kind: 'nope' }, null, 'str'],
      hidden: ['Car', 'car', 42],
      attributes: { body: { label: '  Brawn ', abbr: 'B R N' }, quickness: { label: '' }, luck: { label: 'Luck' }, __proto__: { label: 'x' } },
    }, BOOK);
    assert.deepEqual(l.skills, [{ name: 'Cooking', attribute: 'body', kind: 'active' }]);
    assert.deepEqual(l.hidden, ['Car', '42']);
    assert.deepEqual(l.attributes, { body: { label: 'Brawn', abbr: 'BRN' } });
    assert.deepEqual(normalizeLists(null), { skills: [], hidden: [], attributes: {} });
    assert.deepEqual(normalizeLists('junk'), { skills: [], hidden: [], attributes: {} });
  });

  test('starterChoices: hidden starters out, owned out, custom skills appended', () => {
    const starters = [{ name: 'Firearms', attribute: 'quickness', kind: 'active' }, { name: 'Car', attribute: 'reaction', kind: 'active' }, { name: 'Stealth', attribute: 'quickness', kind: 'active' }];
    const lists = { skills: parseCustomSkills('Cooking | body\nKnots').skills, hidden: ['Car'], attributes: {} };
    assert.deepEqual(starterChoices(starters, ['knots'], lists).map((s) => s.name), ['Firearms', 'Stealth', 'Cooking']);
    assert.deepEqual(starterChoices(starters, [], lists, 1).map((s) => s.name), ['Firearms', 'Cooking', 'Knots']);
  });
});

describe('v0.93.3 attribute labels', () => {
  test('override or default; abbreviations default to the first letter', () => {
    const o = { body: { label: 'Brawn', abbr: 'BRN' }, quickness: { abbr: 'AGI' } };
    assert.equal(attributeLabel('body', o, 'Body'), 'Brawn');
    assert.equal(attributeLabel('quickness', o, 'Quickness'), 'Quickness');
    assert.equal(attributeAbbr('quickness', o), 'AGI');
    assert.equal(attributeAbbr('willpower', o), 'W');
  });

  test('the default labels are the translated ones', () => {
    assert.equal(defaultAttributeLabel('body'), 'Body');
    assert.equal(defaultAttributeLabel('reaction'), 'Reaction');
    assert.equal(defaultAttributeLabel('essence'), 'Essence');
    assert.equal(defaultAttributeLabel('magic'), 'Magic');
  });
});

describe('v0.93.3 the store', () => {
  after(() => setCustomLists(EMPTY_LISTS));
  test('set/get feed the world helpers', () => {
    setCustomLists({ skills: parseCustomSkills('Cooking | strength').skills, hidden: ['Stealth'], attributes: { body: { label: 'Brawn', abbr: 'BR' } } });
    assert.deepEqual(worldSkillChoices(BOOK, 'active'), ['Car', 'Cooking', 'Etiquette', 'Firearms']);
    assert.equal(customSkillAttribute('cooking'), 'strength');
    assert.equal(customSkillAttribute('Firearms'), null);
    assert.equal(attributeDisplayLabel('body'), 'Brawn');
    assert.equal(attributeDisplayLabel('willpower'), 'Willpower');
    assert.equal(attrAbbr('body'), 'BR');
    assert.equal(getCustomLists().hidden.length, 1);
  });
});

describe('v0.93.3 the settings window (stub Foundry)', () => {
  const saved: Record<string, unknown> = {};
  const registered: Record<string, any> = {};
  const menus: Record<string, any> = {};
  const notes: string[] = [];
  let mod: any;
  before(async () => {
    const g: any = globalThis;
    g.foundry ??= {};
    g.foundry.applications ??= {};
    g.foundry.applications.api ??= {};
    g.foundry.applications.api.ApplicationV2 ??= class {};
    g.foundry.applications.instances ??= new Map();
    g.game ??= {};
    g.game.i18n ??= { localize: (k: string) => k };
    g.game.settings = {
      register: (_ns: string, k: string, o: any) => { registered[k] = o; },
      registerMenu: (_ns: string, k: string, o: any) => { menus[k] = o; },
      get: (_ns: string, k: string) => saved[k] ?? registered[k]?.default,
      set: async (_ns: string, k: string, v: unknown) => { saved[k] = v; registered[k]?.onChange?.(v); return v; },
    };
    g.ui ??= {};
    g.ui.notifications = { warn: (s: string) => notes.push(`warn ${s}`), info: (s: string) => notes.push(`info ${s}`) };
    mod = await import('../applications/customlists.ts');
  });
  after(() => setCustomLists(EMPTY_LISTS));

  test('registers a restricted world setting and a GM menu', () => {
    mod.registerCustomListSettings();
    assert.equal(registered['customLists'].scope, 'world');
    assert.equal(registered['customLists'].config, false);
    assert.equal(menus['customListsMenu'].restricted, true);
    assert.equal(menus['customListsMenu'].type, mod.CustomListsConfig);
  });

  test('the book list covers the picker, the starters and the aliases', () => {
    const b: string[] = mod.bookSkillNames().map((s: string) => s.toLowerCase());
    for (const n of ['firearms', 'etiquette', 'firearms b/r', 'rotor aircraft']) assert.ok(b.includes(n), n);
  });

  test('saving stores validated lists, updates the store and reports skipped lines', async () => {
    const field = (value: string) => ({ value });
    const form: any = { elements: { skills: field('Cooking | body\nFirearms\n<b>Odd</b> | int'), hidden: field('Stealth'), 'label-body': field('Brawn'), 'abbr-body': field('BRN'), 'label-luck': field('x') } };
    const handler = (mod.CustomListsConfig as any).DEFAULT_OPTIONS.form.handler;
    await handler.call({}, {}, form);
    assert.deepEqual((saved['customLists'] as any).skills.map((s: any) => s.name), ['Cooking', '<b>Odd</b>']);
    assert.deepEqual(getCustomLists().hidden, ['Stealth']);
    assert.equal(attributeDisplayLabel('body'), 'Brawn');
    assert.ok(notes.at(-1)!.startsWith('warn '), 'the skipped book-skill line is reported');
  });

  test('the window escapes every stored value', async () => {
    setCustomLists({ skills: [{ name: '<img src=x onerror=1>', attribute: 'body', kind: 'active' }], hidden: ['"><script>'], attributes: { body: { label: '"><i>', abbr: '<u>' } } });
    const html: string = mod.customListsHtml(getCustomLists());
    assert.ok(!html.includes('<img') && !html.includes('<script>') && !html.includes('"><i>') && !html.includes('<u>'));
    assert.ok(html.includes('&lt;img src=x onerror=1&gt;'));
    assert.ok(html.includes('name="label-essence"') && html.includes('name="abbr-reaction"'));
  });
});

describe('v0.93.3 the pickers read the lists (source)', () => {
  test('the skill picker merges the lists and takes a custom skill\'s attribute', () => {
    const a = read('src/module/applications/adding.ts');
    assert.match(a, /worldSkillChoices\(canonicalSkillNames\(COMMON_SKILLS\[k\]\), k\)/);
    assert.match(a, /customSkillAttribute\(/);
    assert.match(a, /attributeDisplayLabel\(a\)/);
  });
  test('the creation wizard offers custom skills and hides hidden starters', () => {
    const c = read('src/module/applications/creation.ts');
    assert.equal((c.match(/starterChoices\(starterSkillsMissing\(names\)/g) ?? []).length, 2);
    assert.match(c, /label: attributeDisplayLabel\(k\)/);
  });
  test('the window has no proper nouns of any setting in its example', () => {
    const w = read('src/module/applications/customlists.ts');
    assert.match(w, /Name \| quickness \| active \| note/);
  });
});
