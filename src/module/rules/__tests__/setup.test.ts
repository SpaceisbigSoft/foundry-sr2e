import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  kitSystem, kitAmountOf, normalizeKit, kitFromItems, addToKit, kitSummary, kitLinesFor, kitPrice, mergeKits,
  defaultChecklist, normalizeChecklist, toggleChecklistLine, newSession, addChecklistLine, removeChecklistLine, checklistProgress,
  tokenSetupPlan, placedTokenPlan, TOKEN_SETUP_DEFAULTS, assignmentPlan, type StarterKit,
} from '../setup.ts';

let n = 0;
const id = () => `k${++n}`;
const C = { FRIENDLY: 1, NEUTRAL: 0, HOSTILE: -1, OWNER_HOVER: 20, HOVER: 30, OWNER: 40, ALWAYS: 50 };

describe('v0.66.0 starter kits', () => {
  test('state fields never travel in a kit', () => {
    assert.deepEqual(kitSystem({ installed: true, worn: true, bonded: true, loaded: true, essence: 0.2, rating: 2 }), { essence: 0.2, rating: 2 });
    assert.deepEqual(kitSystem(null), {});
  });
  test('the amount is the quantity/rating/Force for value types, else one copy', () => {
    assert.equal(kitAmountOf('gear', { quantity: 5 }), 5);
    assert.equal(kitAmountOf('spell', { learnedForce: 4 }), 4);
    assert.equal(kitAmountOf('weapon', { damagePower: 9 }), 1);
  });
  test('kit from items: copies of one thing become one line', () => {
    const k = kitFromItems(' Samurai ', [
      { type: 'weapon', name: 'ZZ Pistol', system: { damagePower: 9 } },
      { type: 'weapon', name: 'ZZ Pistol', system: { damagePower: 9, jammed: true } },
      { type: 'gear', name: 'ZZ Medkit', system: { quantity: 3, rating: 3 } },
      { type: 'cyberware', name: 'ZZ Jack', system: { installed: true, essence: 0.2 } },
    ], id);
    assert.equal(k.name, 'Samurai');
    assert.equal(k.lines.length, 3);
    assert.equal(k.lines[0]!.amount, 2);
    assert.equal(k.lines[1]!.amount, 3);
    assert.equal('installed' in k.lines[2]!.system, false);
    assert.equal(kitSummary(k), 'ZZ Pistol ×2, ZZ Medkit ×3, ZZ Jack');
  });
  test('adding the same gear adds its quantity; a new thing is a new line', () => {
    let k: StarterKit = { id: 'a', name: 'A', notes: '', lines: [] };
    k = addToKit(k, { type: 'gear', name: 'Rope', system: { quantity: 2 } });
    k = addToKit(k, { type: 'gear', name: 'Rope', system: { quantity: 3 } });
    k = addToKit(k, { type: 'spell', name: 'Bolt', system: { learnedForce: 3 } });
    k = addToKit(k, { type: 'spell', name: 'Bolt', system: { learnedForce: 3 } });
    assert.equal(k.lines.length, 3);
    assert.equal(k.lines[0]!.amount, 5);
    assert.equal(kitSummary(k), 'Rope ×5, Bolt Force 3, Bolt Force 3');
  });
  test('normalize: drops non-items, keeps ids, clamps numbers, filters types', () => {
    const k = normalizeKit({ name: 'X', lines: [{ type: 'weapon', name: 'W', amount: 99 }, { type: '', name: 'bad' }, 5, { type: 'gear', name: 'G', system: { quantity: 4 } }] }, id)!;
    assert.ok(k.id.startsWith('k'));
    assert.equal(k.lines.length, 2);
    assert.equal(k.lines[0]!.amount, 20);
    assert.equal(k.lines[1]!.amount, 4);
    assert.equal(normalizeKit({ lines: [] }, id), null);
    assert.equal(normalizeKit({ id: 'keep', name: 'Y', lines: [] }, id)!.id, 'keep');
    assert.equal(normalizeKit({ name: 'Z', lines: [{ type: 'spell', name: 'S' }] }, id, ['weapon'])!.lines.length, 0);
  });
  test('lines an actor type can hold; how it can be paid', () => {
    const k = normalizeKit({ name: 'Mixed', lines: [{ type: 'weapon', name: 'W', system: { cost: 100 } }, { type: 'spell', name: 'S' }] }, id)!;
    const r = kitLinesFor(k, ['weapon', 'gear']);
    assert.equal(r.lines.length, 1);
    assert.equal(r.skipped.length, 1);
    const gearOnly = normalizeKit({ name: 'Gear', lines: [{ type: 'weapon', name: 'W', system: { cost: 100 }, amount: 2 }, { type: 'gear', name: 'G', system: { cost: 10, quantity: 3 } }] }, id)!;
    assert.equal(kitPrice(gearOnly).nuyen, 230);
    assert.deepEqual(kitPrice(normalizeKit({ name: 'N', lines: [{ type: 'weapon', name: 'Free gun' }] }, id)!).unpriced, ['Free gun']);
  });
  test('merge kits by name', () => {
    const a = [{ id: '1', name: 'Alpha', notes: '', lines: [] }];
    const b = [{ id: '9', name: 'alpha', notes: 'new', lines: [] }, { id: '8', name: 'Beta', notes: '', lines: [] }];
    const r = mergeKits(a, b, 'replace');
    assert.equal(r.list.length, 2); assert.equal(r.list[0]!.id, '1'); assert.equal(r.list[0]!.notes, 'new'); assert.equal(r.replaced, 1); assert.equal(r.added, 1);
    assert.equal(mergeKits(a, b, 'skip').skipped, 1);
  });
});

describe('v0.66.0 session checklist', () => {
  test('defaults have start and end lines with actions', () => {
    const c = defaultChecklist();
    assert.ok(c.start.length >= 4 && c.end.length >= 4);
    assert.ok(c.start.some((l) => l.action === 'tokenSetup'));
    assert.equal(checklistProgress(c).start, `0/${c.start.length}`);
  });
  test('normalize repairs or falls back', () => {
    assert.deepEqual(normalizeChecklist(null), defaultChecklist());
    const c = normalizeChecklist({ start: [{ text: 'Hi', action: 'nope' }, { text: '' }], end: [], session: 'x' });
    assert.equal(c.start.length, 1); assert.equal(c.start[0]!.action, ''); assert.equal(c.session, 1); assert.equal(c.start[0]!.id, 'start-0');
  });
  test('tick, new session, add and remove', () => {
    let c = defaultChecklist();
    c = toggleChecklistLine(c, 's-karma');
    assert.equal(c.start.find((l) => l.id === 's-karma')!.done, true);
    c = newSession(c, 1000);
    assert.equal(c.session, 2); assert.equal(c.startedAt, 1000);
    assert.equal(c.start.some((l) => l.done), false);
    c = addChecklistLine(c, 'end', '  Snacks  ');
    c = addChecklistLine(c, 'end', 'More');
    const ids = c.end.map((l) => l.id);
    assert.equal(new Set(ids).size, ids.length);
    assert.equal(c.end.at(-2)!.text, 'Snacks');
    assert.equal(addChecklistLine(c, 'end', '   '), c);
    c = removeChecklistLine(c, ids.at(-1)!);
    assert.equal(c.end.at(-1)!.text, 'Snacks');
  });
});

describe('v0.66.0 token setup', () => {
  test('a player character: linked, Physical/Stun bars, sight, friendly', () => {
    const p = tokenSetupPlan({ type: 'character', playerOwned: true }, TOKEN_SETUP_DEFAULTS, C);
    assert.equal(p['actorLink'], true);
    assert.equal(p['bar1.attribute'], 'derived.bars.physical');
    assert.equal(p['bar2.attribute'], 'derived.bars.stun');
    assert.equal(p['displayBars'], 20);
    assert.equal(p['sight.enabled'], true);
    assert.equal(p['disposition'], 1);
  });
  test('NPCs hostile, vehicles on the condition track, options respected', () => {
    const npc = tokenSetupPlan({ type: 'npc', playerOwned: false }, { ...TOKEN_SETUP_DEFAULTS, link: false, show: 'always' }, C);
    assert.equal(npc['actorLink'], undefined);
    assert.equal(tokenSetupPlan({ type: 'npc', playerOwned: false }, TOKEN_SETUP_DEFAULTS, C)['actorLink'], undefined, 'NPCs never linked');
    assert.equal(npc['disposition'], -1);
    assert.equal(npc['displayName'], 50);
    const v = tokenSetupPlan({ type: 'vehicle', playerOwned: false }, { ...TOKEN_SETUP_DEFAULTS, disposition: 'friendly' }, C);
    assert.equal(v['bar1.attribute'], 'derived.bars.condition');
    assert.equal(v['bar2.attribute'], null);
    assert.equal(v['disposition'], 1);
    const host = tokenSetupPlan({ type: 'host', playerOwned: false }, TOKEN_SETUP_DEFAULTS, C);
    assert.equal(host['sight.enabled'], undefined);
    assert.equal(host['bar1.attribute'], undefined);
  });
  test('placed unlinked tokens are not relinked', () => {
    assert.equal(placedTokenPlan({ actorLink: true, x: 1 }, false)['actorLink'], undefined);
    assert.equal(placedTokenPlan({ actorLink: true }, true)['actorLink'], true);
  });
});

describe('v0.66.0 assigning characters', () => {
  const users = [
    { id: 'g', name: 'GM', isGM: true, character: null },
    { id: 'u1', name: 'Corvo', isGM: false, character: null },
    { id: 'u2', name: 'Pell', isGM: false, character: 'a2' },
    { id: 'u3', name: 'Matt', isGM: false, character: 'a1' },
  ];
  const actors = [{ id: 'a1', name: 'Rook', owners: ['u3'] }, { id: 'a2', name: 'Vex', owners: [] }];
  test('sets characters and ownership; GMs and unpicked users untouched', () => {
    const r = assignmentPlan(users, actors, { g: 'a1', u1: 'a1', u2: 'a2', u3: '' });
    assert.deepEqual(r.users, [{ id: 'u1', character: 'a1' }, { id: 'u3', character: null }]);
    assert.deepEqual(r.owners, [{ actorId: 'a1', userId: 'u1' }, { actorId: 'a2', userId: 'u2' }]);
    assert.ok(r.lines.includes('Corvo plays Rook'));
    assert.ok(r.lines.includes('Pell now owns Vex'));
    assert.ok(r.lines.includes('Matt has no character now'));
  });
  test('an unknown actor is ignored', () => {
    assert.deepEqual(assignmentPlan(users, actors, { u1: 'zzz' }).users, []);
  });
});

import { healthFraction, itemPilesConfig } from '../setup.ts';
describe('v0.66.0 module support', () => {
  const B = { people: 10, vehicle: 10, matrix: 10 };
  test('health is the worse track; beyond the track is 0; no track is null', () => {
    assert.equal(healthFraction({ type: 'character', system: { monitor: { physical: 3, stun: 6 } } }, B), 0.4);
    assert.equal(healthFraction({ type: 'npc', system: { monitor: { physical: 13, stun: 0 } } }, B), 0);
    assert.equal(healthFraction({ type: 'spirit', system: {} }, B), 1);
    assert.equal(healthFraction({ type: 'vehicle', system: { condition: 5 } }, B), 0.5);
    assert.equal(healthFraction({ type: 'ic', system: { matrix: { monitor: 10 } } }, B), 0);
    assert.equal(healthFraction({ type: 'site', system: {} }, B), null);
  });
  test('Item Piles: nuyen, quantity and the filters', () => {
    const c: any = itemPilesConfig({ version: '1.0.0', nuyenImg: 'x.svg' });
    assert.equal(c.ACTOR_CLASS_TYPE, 'npc');
    assert.equal(c.CURRENCIES[0].data.path, 'system.nuyen');
    for (const f of c.ITEM_FILTERS) assert.equal(typeof f.filters, 'string');
    assert.ok(!c.UNSTACKABLE_ITEM_TYPES.includes('gear'));
  });
});

describe('v0.66.0 review fixes (rules)', () => {
  test('a loaded kit whose id is taken gets a fresh one', () => {
    const r = mergeKits([{ id: 'k1', name: 'Samurai v2', notes: '', lines: [] }], [{ id: 'k1', name: 'Samurai', notes: '', lines: [] }], 'replace', () => 'fresh');
    assert.deepEqual(r.list.map((k) => k.id), ['k1', 'fresh']);
  });
  test('Item Piles keeps different ratings apart', () => {
    const c: any = itemPilesConfig({ version: '1', nuyenImg: '' });
    assert.ok(c.ITEM_SIMILARITIES.includes('system.medkitRating'));
  });
});
