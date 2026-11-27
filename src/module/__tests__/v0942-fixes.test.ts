/**
 * v0.94.2 (report item 29, the small-fixes bundle): the GM's Fold dice default, actors in combat without tokens,
 * clearing targets at the end of your turn, a warning for a tweak naming no skill, the attacker left out of their
 * own area, a shared login shopping for the selected runner, and the canvas's two hard-coded strings.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { foldDiceFolded, foldDiceChoice, addToCombatRows, addedActorIds, turnWasMine, ADD_TO_COMBAT_TYPES } from '../rules/fixes942.ts';
import { setupWarnings, type SetupInput } from '../rules/catalogue.ts';

const ROOT = join(import.meta.dirname, '..', '..', '..');
const mod = (...p: string[]) => readFileSync(join(ROOT, 'src', 'module', ...p), 'utf8');
const lang = JSON.parse(readFileSync(join(ROOT, 'public', 'lang', 'en.json'), 'utf8'));
const has = (key: string) => key.split('.').reduce((a: any, k) => (a == null ? undefined : a[k]), lang) !== undefined;

describe('v0.94.2 fold dice: a world default with a per-user override', () => {
  test('a user who follows the table gets the table default', () => {
    assert.equal(foldDiceFolded('default', true), true);
    assert.equal(foldDiceFolded('default', false), false);
    assert.equal(foldDiceFolded(null, false), false);
    assert.equal(foldDiceFolded(undefined, true), true);
    assert.equal(foldDiceFolded('', false), false);
  });
  test('review (5): "on" folds even when the table unfolds, "off" the other way', () => {
    assert.equal(foldDiceFolded('on', false), true);
    assert.equal(foldDiceFolded('off', true), false);
  });
  test('review (5): an old stored Boolean (or its string) reads as on or off', () => {
    assert.equal(foldDiceChoice(true), 'on');
    assert.equal(foldDiceChoice('true'), 'on');
    assert.equal(foldDiceChoice(false), 'off');
    assert.equal(foldDiceChoice('false'), 'off');
    assert.equal(foldDiceChoice('nonsense'), 'default');
    assert.equal(foldDiceFolded(true, false), true);
    assert.equal(foldDiceFolded('false', true), false);
  });
  test('review (5): a three-way String setting, no raw client-storage read; the Automation window reads old values', () => {
    const set = mod('settings.ts');
    assert.match(set, /"foldDice", \{[\s\S]{0,200}type: String, default: "default",[\s\S]{0,100}choices: \{ default: "SR2E\.Settings\.foldDice\.Choices\.default", on: "SR2E\.Settings\.foldDice\.Choices\.on", off: "SR2E\.Settings\.foldDice\.Choices\.off" \}/);
    assert.doesNotMatch(mod('applications', 'fixes942.ts'), /storage/);
    assert.match(mod('applications', 'automation941.ts'), /key === FOLD_DICE_KEY \? foldDiceChoice\(v\) : v/);
    for (const k of ['Name', 'Hint', 'Choices.default', 'Choices.on', 'Choices.off']) assert.ok(has(`SR2E.Settings.foldDice.${k}`), k);
  });
  test('chat cards ask foldDiceOn(), not the client setting alone', () => {
    const chat = mod('applications', 'chat.ts');
    assert.match(chat, /if \(!foldDiceOn\(\)\)/);
    assert.doesNotMatch(chat, /get\(SYSTEM_ID, 'foldDice'\) === false/);
  });
});

describe('v0.94.2 add to combat without tokens', () => {
  const actors = [
    { id: 'n1', name: 'Zed Ganger', type: 'npc' },
    { id: 'c2', name: 'Bravo', type: 'character', hasPlayerOwner: true },
    { id: 'c1', name: 'Alpha', type: 'character', hasPlayerOwner: true },
    { id: 'c3', name: 'Contact', type: 'character', hasPlayerOwner: false },
    { id: 'h1', name: 'Host', type: 'host' },
    { id: 's1', name: 'Spirit', type: 'spirit' },
  ];
  test('player characters first and ticked, others after, unticked; hosts and those already in left out', () => {
    const rows = addToCombatRows(actors, new Set(['s1']));
    assert.deepEqual(rows.map((r) => r.id), ['c1', 'c2', 'c3', 'n1']);
    assert.deepEqual(rows.map((r) => r.checked), [true, true, false, false]);
  });
  test('only fighting kinds', () => {
    assert.ok(!ADD_TO_COMBAT_TYPES.includes('host'));
    assert.deepEqual(addToCombatRows([{ id: 'x', name: 'x', type: 'ic' }], new Set()), []);
  });
  test('review (16): only tokenless or linked combatants count as their actor being in', () => {
    assert.deepEqual(addedActorIds([{ actorId: 'a' }, { actorId: 'b', tokenId: 't1', linked: false }, { actorId: 'c', tokenId: 't2', linked: true }, { actorId: '' }]), ['a', 'c']);
    assert.match(mod('applications', 'fixes942.ts'), /addedActorIds\(/);
  });
  test('combatants are made with the actor only (no token)', () => {
    const src = mod('applications', 'fixes942.ts');
    assert.match(src, /createEmbeddedDocuments\('Combatant', ids\.map\(\(id\) => \(\{ actorId: id \}\)\)\)/);
    assert.match(mod('sr2e-system.ts'), /registerFixes942\(\);/);
  });
});

describe('v0.94.2 clear my targets at the end of my turn', () => {
  test('a player: a combatant they own', () => {
    assert.equal(turnWasMine({ isOwner: true, hasPlayerOwner: true }, false), true);
    assert.equal(turnWasMine({ isOwner: false, hasPlayerOwner: true }, false), false);
  });
  test('the GM: a combatant no player owns', () => {
    assert.equal(turnWasMine({ isOwner: true, hasPlayerOwner: false }, true), true);
    assert.equal(turnWasMine({ isOwner: true, hasPlayerOwner: true }, true), false);
    assert.equal(turnWasMine(null, true), false);
  });
});

describe('v0.94.2 a tweak naming no skill is warned about', () => {
  const base: SetupInput = {
    actorType: 'character', attributes: [], attributeWarnings: [], essence: 6, cyberWarnings: [], adeptOver: [], magic: 0,
    skills: [{ name: 'Firearms', concentration: 'Pistols', specialization: 'Ares Predator' }, { name: 'Stealth' }], items: [], build: [],
  };
  const gear = (tweaks: unknown[]) => ({ id: 'g1', type: 'gear', name: 'Goggles', system: { tweaks } });
  test('a misspelled skill gives a warning naming the item and the skill', () => {
    const w = setupWarnings({ ...base, items: [gear([{ id: 't1', target: 'skillDice', key: 'Stelth', value: 1 }])] });
    assert.equal(w.length, 1);
    assert.equal(w[0]!.level, 'warn');
    assert.match(w[0]!.text, /Goggles/);
    assert.match(w[0]!.text, /Stelth/);
  });
  test('a skill, concentration or specialization name matches (any case); other targets and blanks are fine', () => {
    for (const key of ['stealth', 'Pistols', 'ares predator']) assert.deepEqual(setupWarnings({ ...base, items: [gear([{ id: 't1', target: 'skillTn', key, value: -1 }])] }), [], key);
    assert.deepEqual(setupWarnings({ ...base, items: [gear([{ id: 't1', target: 'attribute', key: 'body', value: 1 }])] }), []);
    assert.deepEqual(setupWarnings({ ...base, items: [gear([{ id: 't1', target: 'skillDice', key: '', value: 1 }])] }), []);
  });
  test('review (11): a tweak switched off is not warned about; the wording says what is missing', () => {
    assert.deepEqual(setupWarnings({ ...base, items: [gear([{ id: 't1', target: 'skillDice', key: 'Stelth', value: 1, on: false }])] }), []);
    const w = setupWarnings({ ...base, items: [gear([{ id: 't1', target: 'skillDice', key: 'Stelth', value: 1 }])] });
    assert.match(w[0]!.text, /no skill by that name on this sheet/);
    assert.doesNotMatch(w[0]!.text, /does nothing/);
  });
  test('no warning before the sheet has any skills', () => {
    assert.deepEqual(setupWarnings({ ...base, skills: [], items: [gear([{ id: 't1', target: 'skillDice', key: 'Stelth', value: 1 }])] }).filter((x) => /Stelth/.test(x.text)), []);
  });
});

describe('v0.94.2 areas, the shop and strings', () => {
  test('a placed area leaves the attacker out (setting), and the sheet passes the attacker', () => {
    const canvas = mod('applications', 'canvas.ts');
    assert.match(canvas, /export function attackerTokenTest/);
    assert.match(canvas, /'areaSkipsAttacker'/);
    assert.match(mod('applications', 'sheets.ts'), /placeArea\(radius, `\$\{item\.name\} area`, \{ attacker: actor \}\)/);
  });
  test('a single selected owned token wins over the assigned character in the shop', () => {
    const src = mod('applications', 'adding.ts');
    assert.ok(src.indexOf('if (token) return { actor: token, pick: [] };') < src.indexOf('if (owned(user?.character)) return { actor: user.character, pick: [] };'));
    // review (15): the doc comment says so.
    assert.match(src, /one selected token of a character or NPC they own \(v0\.94\.2:\s*\n?\s*\*?\s*it wins over the assigned character/);
  });
  test('the canvas optgroups read the language file', () => {
    const canvas = mod('applications', 'canvas.ts');
    assert.doesNotMatch(canvas, /label="On this scene"|label="Not on this scene"/);
    for (const k of ['SR2E.Dialog.Canvas.onThisScene', 'SR2E.Dialog.Canvas.notOnThisScene']) assert.ok(has(k), k);
  });
  test('every new setting has its strings', () => {
    for (const k of ['foldDiceDefault', 'areaSkipsAttacker', 'clearTargetsEndTurn']) {
      assert.ok(has(`SR2E.Settings.${k}.Name`) && has(`SR2E.Settings.${k}.Hint`), k);
      assert.match(mod('settings.ts'), new RegExp(`"${k}"`));
    }
  });
});

describe('v0.94.2 add to combat: one window at a time (glue with stubs)', () => {
  test('a double click opens one window; actors added meanwhile are not added twice', async () => {
    const g = globalThis as any;
    let resolve: (v: string[]) => void = () => {};
    let prompts = 0;
    const made: any[] = [];
    const combat: any = { combatants: [] as any[], createEmbeddedDocuments: async (_t: string, d: any[]) => { made.push(...d); } };
    const actors = [{ id: 'c1', name: 'Alpha', type: 'character', hasPlayerOwner: true }, { id: 'c2', name: 'Bravo', type: 'character', hasPlayerOwner: true }];
    g.game = { user: { isGM: true }, combat, actors: Object.assign([...actors], { get: (id: string) => actors.find((a) => a.id === id) }) };
    g.ui = { notifications: { info: () => {}, warn: () => {} } };
    g.foundry = { applications: { api: { DialogV2: { prompt: () => { prompts++; return new Promise((r) => { resolve = r; }); } } } } };
    const { openAddToCombat } = await import('../applications/fixes942.ts');
    const first = openAddToCombat();
    assert.equal(await openAddToCombat(), 0, 'the second click does nothing');
    assert.equal(prompts, 1);
    // Meanwhile Alpha went in (tokenless).
    combat.combatants.push({ actorId: 'c1' });
    resolve(['c1', 'c2', 'c2']);
    assert.equal(await first, 1);
    assert.deepEqual(made, [{ actorId: 'c2' }]);
    // Closed: a new click opens again.
    const again = openAddToCombat();
    assert.equal(prompts, 2);
    resolve([]);
    assert.equal(await again, 0);
  });
});
