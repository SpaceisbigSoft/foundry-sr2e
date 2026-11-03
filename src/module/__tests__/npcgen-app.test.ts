/** v0.52.0 NPC generator window glue, with small stubs of Foundry (no canvas). */
import { test, describe, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const g = globalThis as any;
const created: any[] = [];
const chat: any[] = [];
const journals: any[] = [];
const folders: any[] = [];
const registry = new Map<string, any>();

before(() => {
  g.foundry = { applications: { api: { HandlebarsApplicationMixin: (c: any) => c, ApplicationV2: class {}, DialogV2: {} } }, utils: { randomID: () => `id${Math.random().toString(36).slice(2, 8)}` } };
  g.CONFIG = { Actor: { documentClass: {
    createDocuments: async (list: any[]) => list.map((d) => { created.push(d); return { ...d, getTokenDocument: async () => ({ toObject: () => ({}) }) }; }),
    create: async (d: any) => { created.push(d); return d; },
    setMoraleGroup: async () => 'm',
  } } };
  g.game = { user: { isGM: true }, users: [{ id: 'gm1', isGM: true }], folders, actors: [], scenes: { viewed: null } };
  g.Folder = { create: async (d: any) => { const f = { id: `f${folders.length}`, ...d }; folders.push(f); return f; } };
  g.JournalEntry = { create: async (d: any) => { journals.push(d); return d; } };
  g.ChatMessage = { create: async (d: any) => { chat.push(d); return d; } };
  g.ui = { notifications: { info: () => {}, warn: () => {}, error: () => {} } };
  g.fromUuid = async (u: string) => registry.get(u) ?? null;
  g.canvas = null;
});
beforeEach(() => { created.length = 0; chat.length = 0; journals.length = 0; });

describe('v0.52.0 NPC generator window', () => {
  test('the same choices roll the same preview; a new seed another', async () => {
    const { planFor, previewHtml, DEFAULT_STATE } = await import('../applications/npcgen.ts');
    const s = { ...DEFAULT_STATE, seed: 11, kind: 'npc' as const, threat: 3 };
    assert.equal(previewHtml(planFor(s)), previewHtml(planFor(s)));
    assert.notEqual(previewHtml(planFor(s)), previewHtml(planFor({ ...s, seed: 12 })));
    for (const kind of ['npc', 'group', 'org', 'contact', 'spirit', 'critter', 'job', 'names'] as const) {
      const html = previewHtml(planFor({ ...s, kind }));
      assert.ok(html.length > 20, kind);
      assert.doesNotMatch(html, /undefined|NaN/, kind);
    }
  });

  test('Create: a person becomes one actor with its items, in the Generated folder, no tokens without a scene', async () => {
    const { planFor, createFromPlan, DEFAULT_STATE } = await import('../applications/npcgen.ts');
    const s = { ...DEFAULT_STATE, seed: 3, kind: 'npc' as const, threat: 3, archetype: 'guard', magic: 'none' as const };
    const msg = await createFromPlan(planFor(s), s);
    assert.match(msg, /^Created /);
    assert.equal(created.length, 1);
    assert.equal(created[0].type, 'npc');
    assert.ok(created[0].items.some((i: any) => i.type === 'weapon'));
    assert.equal(created[0].folder, folders.find((f) => f.type === 'Actor').id);
    // The folder is made once.
    await createFromPlan(planFor({ ...s, seed: 4 }), s);
    assert.equal(folders.filter((f) => f.type === 'Actor').length, 1);
  });

  test('Create: a critter uses its own data (natural weapon, racial modifiers off)', async () => {
    const { planFor, createFromPlan, DEFAULT_STATE } = await import('../applications/npcgen.ts');
    const s = { ...DEFAULT_STATE, seed: 3, kind: 'critter' as const, threat: 1, critter: 'dog', critterCount: 4 };
    await createFromPlan(planFor(s), s);
    assert.equal(created[0].system.racialModifiers, false);
    assert.equal(created[0].system.grunts.size, 4);
    assert.ok(created[0].items.some((i: any) => i.name === 'Bite'));
  });

  test('Create: a group makes the leader, the grunt sheet and specialists, each named for the group', async () => {
    const { planFor, createFromPlan, DEFAULT_STATE } = await import('../applications/npcgen.ts');
    const s = { ...DEFAULT_STATE, seed: 5, kind: 'group' as const, threat: 4, groupKind: 'security' as const };
    const plan: any = planFor(s);
    await createFromPlan(plan, s);
    assert.equal(created.length, 2 + plan.extras.length);
    assert.ok(created.every((a: any) => a.name.endsWith(`(${plan.name})`) || a.name.startsWith(plan.name)));
    assert.ok(created.every((a: any) => !a.name.includes(`(${plan.name}) (${plan.name})`) && (a.name.match(new RegExp(plan.name, 'g')) ?? []).length === 1));
    assert.ok(created.some((a: any) => a.system.grunts.size > 1));
  });

  test('Create: a contact is added to the character with loyalty, knowledge and fee', async () => {
    const { planFor, createFromPlan, DEFAULT_STATE } = await import('../applications/npcgen.ts');
    let saved: any = null;
    registry.set('Actor.pc', { name: 'PC', system: { contacts: [{ id: 'old', name: 'Old' }] }, update: async (u: any) => { saved = u; } });
    const s = { ...DEFAULT_STATE, seed: 6, kind: 'contact' as const, threat: 4, contactFor: 'Actor.pc', makeContactActor: false };
    const plan: any = planFor(s);
    const msg = await createFromPlan(plan, s);
    assert.match(msg, /now a contact of PC/);
    assert.equal(created.length, 0);
    const list = saved['system.contacts'];
    assert.equal(list.length, 2);
    assert.deepEqual([list[1].name, list[1].level, list[1].loyalty, list[1].fee], [plan.npc.name, plan.level, plan.loyalty, plan.fee]);
  });

  test('Create: an organisation and a job are GM-only journal entries; people and a host on request', async () => {
    const { planFor, createFromPlan, DEFAULT_STATE } = await import('../applications/npcgen.ts');
    const s = { ...DEFAULT_STATE, seed: 7, kind: 'org' as const, threat: 3, makePeople: true, makeHost: true };
    const org: any = planFor(s);
    await createFromPlan(org, s);
    assert.equal(journals.length, 1);
    assert.equal(journals[0].ownership.default, 0);
    assert.equal(journals[0].pages[0].type, 'text');
    assert.equal(created.filter((a: any) => a.type === 'npc').length, 3);
    const host = created.find((a: any) => a.type === 'host');
    assert.deepEqual([host.system.securityCode, host.system.securityValue], [org.host.code, org.host.value]);
    journals.length = 0; created.length = 0;
    await createFromPlan(planFor({ ...s, kind: 'job', makePeople: false }), { ...s, kind: 'job', makePeople: false });
    assert.equal(journals.length, 1);
    assert.equal(created.length, 0);
  });

  test('Names and Post to GM are whispered to the GMs', async () => {
    const { planFor, createFromPlan, DEFAULT_STATE } = await import('../applications/npcgen.ts');
    const s = { ...DEFAULT_STATE, seed: 8, kind: 'names' as const, names: 5 };
    await createFromPlan(planFor(s), s);
    assert.deepEqual(chat[0].whisper, ['gm1']);
    assert.equal((chat[0].content.match(/<tr>/g) ?? []).length, 6);
  });

  test('review: an unknown kind is a person; two creates at once make one folder; a spirit borrows a template\'s powers', async () => {
    const { planFor, createFromPlan, genKind, DEFAULT_STATE } = await import('../applications/npcgen.ts');
    assert.equal(genKind('foo'), 'npc');
    assert.equal(planFor({ ...DEFAULT_STATE, kind: 'foo' as any }).kind, 'npc');
    folders.length = 0;
    const s = { ...DEFAULT_STATE, seed: 9, kind: 'npc' as const, tokens: false };
    await Promise.all([createFromPlan(planFor(s), s), createFromPlan(planFor({ ...s, seed: 10 }), s)]);
    assert.equal(folders.filter((f) => f.type === 'Actor').length, 1);
    created.length = 0;
    g.CONFIG.Actor.documentClass.spiritTemplateFor = () => ({ name: 'Fire template', system: { offsets: { body: 2 } }, items: [{ type: 'power', toObject: () => ({ _id: 'x', name: 'Engulf', type: 'power', system: {} }) }] });
    const sp = { ...DEFAULT_STATE, seed: 2, kind: 'spirit' as const, spiritKind: 'elemental' as const, tokens: false };
    const msg = await createFromPlan(planFor(sp), sp);
    assert.match(msg, /Fire template's powers/);
    assert.equal(created[0].system.offsets.body, 2);
    assert.equal(created[0].items[0].name, 'Engulf');
    assert.equal(created[0].items[0]._id, undefined);
    delete g.CONFIG.Actor.documentClass.spiritTemplateFor;
  });
});

