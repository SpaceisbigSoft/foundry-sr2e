/**
 * v0.94.2 (improvement plan item 27): Foundry combatant groups for grunts (rules/groups942.ts, applications/groups942.ts).
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { groupKeyOf, planGroups, baseName, groupStanding, sharedInitiativeUpdates, sharedRollIds, type GroupMember } from '../rules/groups942.ts';

const ROOT = join(import.meta.dirname, '..', '..', '..');
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), 'utf8');
const m = (id: string, key: string, group = '', x: Partial<GroupMember> = {}): GroupMember => ({ id, key, group, name: `Goon ${id}`, hidden: false, down: false, broken: false, ...x });

describe('v0.94.2 grunt groups: keys (item 27)', () => {
  test('the morale group first, then the split grunt group; null is unset', () => {
    assert.equal(groupKeyOf({ moraleGroup: 'abc', gruntGroup: 'g1' }), 'm:abc');
    assert.equal(groupKeyOf({ moraleGroup: null, gruntGroup: 'g1' }), 'g:g1');
    assert.equal(groupKeyOf({ moraleGroup: null }), '');
    assert.equal(groupKeyOf(null), '');
  });
});

describe('v0.94.2 grunt groups: the plan', () => {
  test('two or more with one key make a group; one alone does not', () => {
    const p = planGroups([m('a', 'm:1'), m('b', 'm:1'), m('c', 'm:2'), m('d', '')], [], 'group');
    assert.deepEqual(p.create, [{ key: 'm:1', memberIds: ['a', 'b'] }]);
    assert.deepEqual(p.assign, []); assert.deepEqual(p.clear, []); assert.deepEqual(p.remove, []);
  });
  test('a newcomer joins the existing system group', () => {
    const p = planGroups([m('a', 'm:1', 'G'), m('b', 'm:1', 'G'), m('c', 'm:1')], [{ id: 'G', key: 'm:1', ours: true }], 'group');
    assert.deepEqual(p.create, []);
    assert.deepEqual(p.assign, [{ id: 'c', group: 'G' }]);
  });
  test('a group left with one member is undone cleanly', () => {
    const p = planGroups([m('a', 'm:1', 'G')], [{ id: 'G', key: 'm:1', ours: true }], 'group');
    assert.deepEqual(p.clear, ['a']); assert.deepEqual(p.remove, ['G']);
  });
  test('the GM\'s own groups and their members are never touched', () => {
    const p = planGroups([m('a', 'm:1', 'H'), m('b', 'm:1', 'H'), m('c', '', 'H')], [{ id: 'H', key: '', ours: false }], 'group');
    assert.deepEqual(p, { create: [], assign: [], clear: [], remove: [] });
    const u = planGroups([m('a', 'm:1', 'H'), m('b', 'm:1', 'G'), m('c', 'm:1', 'G')], [{ id: 'H', key: '', ours: false }, { id: 'G', key: 'm:1', ours: true }], 'ungroup');
    assert.deepEqual(u.clear, ['b', 'c']); assert.deepEqual(u.remove, ['G']);
  });
  test('a member whose key changed leaves its group', () => {
    const p = planGroups([m('a', 'm:1', 'G'), m('b', 'm:1', 'G'), m('c', 'm:9', 'G')], [{ id: 'G', key: 'm:1', ours: true }], 'group');
    assert.deepEqual(p.clear, ['c']); assert.deepEqual(p.remove, []);
  });
});

describe('v0.94.2 grunt groups: names and standing', () => {
  test('a base name from the members', () => {
    assert.equal(baseName(['Goon 1', 'Goon 2', 'Goon 12']), 'Goon');
    assert.equal(baseName(['Lone Star Cop', 'Lone Star Sergeant']), 'Lone Star');
    assert.equal(baseName(['Ann', 'Bob']), 'Ann');
    assert.equal(baseName([]), '');
  });
  test('standing count; none in the name when a member is hidden; broken', () => {
    assert.deepEqual(groupStanding([m('a', ''), m('b', '', '', { down: true })]), { standing: 1, total: 2, countInName: true, broken: false });
    assert.equal(groupStanding([m('a', ''), m('b', '', '', { hidden: true })]).countInName, false);
    assert.equal(groupStanding([m('a', '', '', { broken: true }), m('b', '', '', { broken: true })]).broken, true);
    assert.equal(groupStanding([m('a', '', '', { broken: true }), m('b', '')]).broken, false);
  });
});

describe('v0.94.2 grunt groups: shared initiative (setting)', () => {
  const ours = new Set(['G']);
  const mem = [{ id: 'a', group: 'G' }, { id: 'b', group: 'G' }, { id: 'c', group: '' }, { id: 'd', group: 'H' }, { id: 'e', group: 'H' }];
  test('one roll per system group; others roll as usual', () => {
    assert.deepEqual(sharedRollIds(mem, ['a', 'b', 'c', 'd', 'e'], ours), ['a', 'c', 'd', 'e']);
  });
  test('the rest of the group take the first member\'s score', () => {
    const now = [{ id: 'a', group: 'G', initiative: 14 }, { id: 'b', group: 'G', initiative: null }, { id: 'c', group: '', initiative: 9 }];
    assert.deepEqual(sharedInitiativeUpdates(now, ['a', 'c'], ours), [{ _id: 'b', initiative: 14 }]);
    assert.deepEqual(sharedInitiativeUpdates(now, ['c'], ours), []);
  });
  test('wired: combat roll, registration, settings (each is the default)', () => {
    assert.match(read('src', 'module', 'documents', 'index.ts'), /const shared = sharedRoll942\(this, ids\);/);
    assert.match(read('src', 'module', 'sr2e-system.ts'), /registerGruntGroups\(\);/);
    const s = read('src', 'module', 'settings.ts');
    assert.match(s, /"gruntGroupInitiative", \{[\s\S]{0,200}default: "each"/);
    assert.match(s, /"gruntGroups", \{[\s\S]{0,200}default: "auto"/);
  });
});

describe('v0.94.2 grunt groups: glue with stubs', () => {
  test('sync creates, assigns and names through the combat; unsupported Foundry does nothing', async () => {
    const g = globalThis as any;
    g.game ??= {};
    g.game.user = { id: 'gm', isGM: true };
    g.game.settings = { get: () => 'auto' };
    const mod = await import('../applications/groups942.ts');
    const calls: any[] = [];
    const tok = (k: string) => ({ flags: { shadowrun2e_unified: { moraleGroup: k } } });
    const actor = { type: 'npc', system: { derived: { status: 'ok' } }, getFlag: () => false };
    const combat: any = {
      id: 'C', combatants: [{ id: 'a', name: 'Goon 1', token: tok('x'), actor, group: null }, { id: 'b', name: 'Goon 2', token: tok('x'), actor, group: null }],
      groups: Object.assign([], { get: () => null }),
      createEmbeddedDocuments: async (t: string, d: any[]) => { calls.push(['create', t, d]); return d.map((_x, i) => ({ id: `N${i}` })); },
      updateEmbeddedDocuments: async (t: string, d: any[]) => { calls.push(['update', t, d]); },
      deleteEmbeddedDocuments: async (t: string, d: any[]) => { calls.push(['delete', t, d]); },
    };
    g.CONFIG = undefined;
    assert.equal(mod.groupsSupported(combat), false);
    g.CONFIG = { CombatantGroup: {} };
    assert.equal(mod.groupsSupported(combat), true);
    await mod.groupGrunts(combat, 'group');
    assert.equal(calls[0][0], 'create');
    assert.equal(calls[0][2][0].flags.shadowrun2e_unified.groupKey, 'm:x');
    assert.deepEqual(calls[1], ['update', 'Combatant', [{ _id: 'a', group: 'N0' }, { _id: 'b', group: 'N0' }]]);
    const r = mod.sharedRoll942(combat, ['a']);
    assert.deepEqual(r.ids, ['a'], 'each keeps their own roll by default (the stub answers "auto", not "shared")');
  });
});
