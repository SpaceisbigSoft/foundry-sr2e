/**
 * v0.84.0: the one-file data import. The catalogue file's version 2 (actors: vehicles, NPCs and critters, spirits,
 * NPCs as stat blocks), filling in missing values (`missingValues`), and the loader's glue with small stubs: new
 * actors in the catalogue folder, actors already in the world never replaced, world items' defaults filled only.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseCatalogueJson, catalogueToJson, missingValues, fillablePaths, CATALOGUE_FORMAT, CATALOGUE_VERSION, MAX_STATBLOCK_CHARS } from '../rules/catalogcsv.ts';

const g = globalThis as any;
const file = (o: Record<string, unknown>) => JSON.stringify({ format: CATALOGUE_FORMAT, version: 2, templates: [], ...o });

describe('v0.84.0 the catalogue file, version 2', () => {
  test('actors are read: vehicles, NPCs with items, critters, spirits, stat blocks', () => {
    const p = parseCatalogueJson(file({ actors: [
      { type: 'vehicle', name: ' ZZ Van ', system: { category: 'truck', speed: 90 } },
      { type: 'npc', name: 'ZZ Wolf', critter: true, system: { essence: 6 }, items: [{ type: 'power', name: 'Fear', system: {} }] },
      { type: 'spirit', name: 'ZZ Air', system: { spiritKind: 'elemental', element: 'air' } },
      { type: 'npc', name: 'ZZ Guard', statBlock: 'Name: ZZ Guard\nBody: 4' },
    ] }));
    assert.deepEqual(p.errors, []);
    assert.equal(p.actors.length, 4);
    assert.deepEqual(p.actors[0], { type: 'vehicle', name: 'ZZ Van', system: { category: 'truck', speed: 90 }, items: [], statBlock: '', critter: false });
    assert.equal(p.actors[1]!.critter, true);
    assert.equal(p.actors[1]!.items[0]!.name, 'Fear');
    assert.equal(p.actors[3]!.statBlock, 'Name: ZZ Guard\nBody: 4');
    assert.deepEqual(p.actors[3]!.system, {});
  });
  test('bad actors are left out and listed', () => {
    const p = parseCatalogueJson(file({ actors: [
      { type: 'character', name: 'PC' }, { type: 'npc', name: '' }, 'nope', { type: 'npc', name: 'X', system: 5 },
      { type: 'vehicle', name: 'V', statBlock: 'Body 4' }, { type: 'npc', name: 'Long', statBlock: 'x'.repeat(MAX_STATBLOCK_CHARS + 1) },
      { type: 'npc', name: 'Items', items: [{ type: 'widget', name: 'W', system: {} }, { type: 'gear', name: 'Rope', system: { cost: 5 } }] },
    ] }));
    assert.equal(p.actors.length, 1);
    assert.deepEqual(p.actors[0]!.items.map((i) => i.name), ['Rope']);
    assert.equal(p.errors.length, 7);
    assert.match(p.errors[0]!, /unknown actor type "character"/);
    assert.match(p.errors.join('\n'), /only an NPC can have a stat block/);
    assert.match(p.errors.join('\n'), /stat block is too long/);
    assert.match(p.errors.join('\n'), /item 1: unknown item type "widget"/);
    assert.match(parseCatalogueJson(file({ actors: 3 })).errors[0]!, /"actors" is not a list/);
    // Review: two entries with the same type and name in one file: the first is kept.
    const dup = parseCatalogueJson(file({ actors: [{ type: 'npc', name: 'Guard' }, { type: 'npc', name: 'guard ' }, { type: 'vehicle', name: 'Guard' }] }));
    assert.deepEqual(dup.actors.map((a) => a.type), ['npc', 'vehicle']);
    assert.match(dup.errors[0]!, /a second npc with this name/);
  });
  test('version 1 files still load; newer ones are refused; unsafe keys are dropped', () => {
    const v1 = parseCatalogueJson(JSON.stringify({ format: CATALOGUE_FORMAT, version: 1, templates: [{ type: 'gear', name: 'Rope', system: { cost: 5 } }] }));
    assert.deepEqual(v1.errors, []);
    assert.equal(v1.templates.length, 1);
    assert.deepEqual(v1.actors, []);
    assert.match(parseCatalogueJson(JSON.stringify({ format: CATALOGUE_FORMAT, version: CATALOGUE_VERSION + 1 })).errors[0]!, /newer/);
    const evil = parseCatalogueJson(file({ actors: [{ type: 'vehicle', name: 'V', system: { constructor: { x: 1 }, speed: 3 } }] }).replace('"speed":3', '"speed":3,"__proto__":{"polluted":1}'));
    assert.deepEqual(evil.actors[0]!.system, { speed: 3 });
    assert.equal(({} as any).polluted, undefined);
  });
  test('actors round-trip through the export', () => {
    const actors = parseCatalogueJson(file({ actors: [{ type: 'vehicle', name: 'V', system: { speed: 3 } }, { type: 'npc', name: 'N', statBlock: 'Body 3', critter: true }] })).actors;
    const text = catalogueToJson({ templates: [], kits: [], actors, exportedAt: 'now', systemVersion: '0.84.0' });
    const data = JSON.parse(text);
    assert.equal(data.version, CATALOGUE_VERSION);
    assert.equal(data.actors[0].statBlock, undefined, 'no empty stat block written');
    assert.deepEqual(parseCatalogueJson(text).actors, actors);
  });
});

describe('v0.84.0 missing values', () => {
  const initial = { cost: 0, availability: '', range: { short: 0, long: 0 }, modes: '', melee: false, list: [] as unknown[], damageLevel: 'M', rating: 0 };
  const any = new Set(['cost', 'availability', 'range.short', 'range.long', 'modes', 'melee', 'list', 'damageLevel', 'rating', 'made']);
  test('only allowed fields whose default is empty and still empty are filled', () => {
    const current = { cost: 250, availability: '', range: { short: 5, long: 0 }, modes: '', melee: false, list: [], damageLevel: 'M' };
    const incoming = { cost: 600, availability: '4/48 hrs', range: { short: 7, long: 40 }, modes: 'SA', melee: true, list: ['x'], damageLevel: 'S', made: 'up' };
    assert.deepEqual(missingValues(current, incoming, initial, any), { availability: '4/48 hrs', 'range.long': 40, modes: 'SA', list: ['x'] });
    assert.deepEqual(missingValues(current, incoming, initial, new Set(['modes'])), { modes: 'SA' }, 'only the allowed paths');
  });
  test('review: a default that is a real value is never "missing"', () => {
    const all = new Set(['rating', 'attributes.body.base', 'metatype', 'speed', 'installed', 'ammo', 'quantity', 'level', 'force', 'cost']);
    assert.deepEqual(missingValues({ rating: 1 }, { rating: 3 }, { rating: 1 }, all), {});
    assert.deepEqual(missingValues({ attributes: { body: { base: 3 } }, metatype: 'human' }, { attributes: { body: { base: 8 } }, metatype: 'troll' },
      { attributes: { body: { base: 3 } }, metatype: 'human' }, all), {});
    assert.deepEqual(missingValues({ speed: 90 }, { speed: 120 }, { speed: 90 }, all), {});
    assert.deepEqual(missingValues({ installed: true }, { installed: false }, { installed: true }, all), {});
    // Per-copy fields, even with an empty default and even if allowed: ammo, quantity, rating, level, force.
    assert.deepEqual(missingValues({ ammo: 0, quantity: 0, rating: 0, level: 0, force: 0, cost: 0 }, { ammo: 15, quantity: 10, rating: 4, level: 2, force: 3, cost: 9 },
      { ammo: 0, quantity: 0, rating: 0, level: 0, force: 0, cost: 0 }, fillablePaths('weapon')), { cost: 9 });
  });
  test('second review: setup, "none" choices, links and times are not fillable', () => {
    const w = fillablePaths('weapon');
    for (const p of ['cost', 'availability', 'damagePower', 'range.short', 'modes', 'ammoMax', 'streetIndex', 'legality', 'description']) assert.ok(w.has(p), p);
    for (const p of ['muzzle', 'scope', 'gyro', 'recoilComp', 'concealability', 'ammo', 'quantity', 'mountPoint', 'toxinId', 'implantId']) assert.ok(!w.has(p), p);
    const c = fillablePaths('cyberware');
    for (const p of ['essenceCost', 'cost', 'availability']) assert.ok(c.has(p), p);
    for (const p of ['smartlinkLevel', 'reflexes', 'controlRig', 'housedIn', 'installed']) assert.ok(!c.has(p), p);
    assert.ok(![...c].some((p) => /^attributes\.|\.(?:body|quickness|strength|charisma|intelligence|willpower)$/.test(p)), 'no attribute bonuses');
    assert.ok(![...fillablePaths('gear')].some((p) => /plant/i.test(p)));
    assert.deepEqual([...fillablePaths('nope')], []);
    assert.deepEqual(missingValues({ muzzle: '', concealability: 0 }, { muzzle: 'silencer', concealability: 6, cost: 5 }, { muzzle: '', concealability: 0, cost: 0 }, w), { cost: 5 });
  });
  test('a value of the wrong shape is left out', () => {
    assert.deepEqual(missingValues({}, { range: 40, cost: '12', availability: 5, list: 'x' }, initial, any), {});
    assert.deepEqual(missingValues({}, { range: [1, 2] }, initial, new Set(['range'])), {});
  });
  test('the default itself, nulls, unknown fields and unsafe keys are never written', () => {
    assert.deepEqual(missingValues({ cost: 0 }, { cost: 0, availability: null, nope: 3 }, initial, any), {});
    assert.deepEqual(missingValues({}, { cost: 12 }, initial, any), { cost: 12 }, 'a field the document lacks counts as the default');
    assert.deepEqual(missingValues({}, JSON.parse('{"__proto__":{"cost":1},"constructor":{"x":1}}'), { constructor: { x: 0 } }, new Set(['constructor.x', 'cost'])), {});
  });
});

// ---------------------------------------------------------------- The loader, with stubs

let w_created: any[] = [];
function stubWorld() {
  w_created = [];
  const settings: Record<string, unknown> = { itemTemplates: [], starterKits: [] };
  const created: any[] = [];
  const updates: any[] = [];
  const mkItem = (parent: any, id: string, type: string, name: string, system: any) => ({
    id, type, name, parent, system: { ...system, toObject() { const { toObject: _t, ...rest } = this as any; return rest; } },
  });
  const pc: any = { id: 'pc', type: 'character', name: 'Rook', items: [] as any[], async updateEmbeddedDocuments(_t: string, u: any[]) { updates.push({ who: 'Rook', u }); } };
  pc.items.push(mkItem(pc, 'i1', 'weapon', 'ZZ Pistol', { cost: 0, damagePower: 9, availability: '' }));
  pc.items.push(mkItem(pc, 'i2', 'weapon', 'Other Gun', { cost: 0 }));
  const van: any = { id: 'v1', type: 'vehicle', name: 'ZZ Van', items: [], system: { speed: 0, armor: 4, toObject() { return { speed: 0, armor: 4 }; } },
    async update(u: any) { updates.push({ who: 'ZZ Van', u }); }, async updateEmbeddedDocuments() {} };
  const actors: any[] = [pc, van];
  class ActorCls {
    system: any; constructor(d: any) { this.system = { toObject: () => (d.type === 'vehicle' ? { speed: 0, armor: 0, handling: 0 } : { essence: 6 }) }; }
    static async createDocuments(list: any[]) { created.push(...list); return list; }
    static async create(d: any) {
      created.push(d);
      const a: any = { ...d, items: [] as any[], system: { derived: {} }, isOwner: true, updates: [] as any[],
        async createEmbeddedDocuments(_t: string, list: any[]) { a.items.push(...list); return list; },
        async update(u: any) { a.updates.push(u); if (typeof u.name === 'string') a.name = u.name; }, async updateEmbeddedDocuments() {}, async delete() { a.deleted = true; } };
      w_created.push(a);
      return a;
    }
  }
  class ItemCls { system: any; constructor(_d: any) { this.system = { toObject: () => ({ cost: 0, damagePower: 0, availability: '' }) }; } static async updateDocuments(u: any[]) { updates.push({ who: 'world', u }); } }
  g.CONFIG = { Actor: { documentClass: ActorCls }, Item: { documentClass: ItemCls }, Folder: { documentClass: { create: async (d: any) => ({ id: 'f1', ...d }) } } };
  g.game = {
    user: { id: 'gm', isGM: true }, actors, items: [], folders: [],
    settings: { get: (_m: string, k: string) => settings[k], set: async (_m: string, k: string, v: unknown) => { settings[k] = v; } },
    time: { worldTime: 0 },
  };
  g.ui = { notifications: { info() {}, warn() {} } };
  g.foundry = { utils: { randomID: () => Math.random().toString(36).slice(2, 10),
    expandObject: (o: Record<string, unknown>) => { const out: any = {}; for (const [k, v] of Object.entries(o)) { const ks = k.split('.'); let c = out; ks.slice(0, -1).forEach((x) => { c = c[x] ??= {}; }); c[ks[ks.length - 1]!] = v; } return out; } }, applications: { api: { DialogV2: {} } } };
  return { settings, created, updates };
}

describe('v0.84.0 loading a catalogue file', () => {
  test('templates, new actors in the folder, existing actors filled not replaced, world items filled', async () => {
    const w = stubWorld();
    const cat = await import('../applications/catalogue.ts');
    const text = file({
      templates: [{ type: 'weapon', name: 'zz  pistol', system: { cost: 450, damagePower: 4, availability: '4/24 hrs' } }],
      actors: [
        { type: 'vehicle', name: 'ZZ Van', system: { speed: 90, armor: 9, handling: 4 } },
        { type: 'vehicle', name: 'ZZ Bike', system: { speed: 120 } },
        { type: 'npc', name: 'ZZ Wolf', critter: true, system: { essence: 6 } },
      ],
    });
    const pv = cat.catalogueLoadPreview(parseCatalogueJson(text));
    assert.deepEqual(pv, { templates: 1, kits: 0, actorsNew: 2, actorsExisting: 1, actorsKept: 0, worldItems: 1 });
    const r = await cat.loadCatalogue(text, 'replace');
    assert.deepEqual(r.errors, []);
    assert.equal(r.templates, 1);
    assert.equal(r.actorsCreated, 2);
    assert.deepEqual(w.created.map((d) => [d.name, d.folder, d.flags?.sr2e?.critter ?? false]), [['ZZ Bike', 'f1', false], ['ZZ Wolf', 'f1', true]]);
    // Second review: the van already in the world is never changed itself (only its matching items would be).
    assert.equal(w.updates.find((u) => u.who === 'ZZ Van'), undefined);
    // The character's pistol: cost and availability filled, its own Power 9 kept; the other gun untouched.
    const rook = w.updates.find((u) => u.who === 'Rook');
    assert.deepEqual(rook.u, [{ _id: 'i1', 'system.cost': 450, 'system.availability': '4/24 hrs' }]);
    assert.equal(r.valuesFilled, 2);
    assert.equal(r.itemsFilled, 1);
  });
  test('without filling in, nothing already in the world changes; players can\'t load', async () => {
    const w = stubWorld();
    const cat = await import('../applications/catalogue.ts');
    const text = file({ templates: [{ type: 'weapon', name: 'ZZ Pistol', system: { cost: 450 } }], actors: [{ type: 'vehicle', name: 'ZZ Van', system: { speed: 90 } }] });
    const r = await cat.loadCatalogue(text, 'replace', { fill: false });
    assert.equal(r.actorsCreated, 0);
    assert.deepEqual(w.updates, []);
    g.game.user = { id: 'p', isGM: false };
    const p = await cat.loadCatalogue(text, 'replace');
    assert.match(p.errors.join(' '), /Only the GM/);
  });
  test('the dialog asks with a preview before loading, and offers the fill-in choice', () => {
    const src = readFileSync(join(process.cwd(), 'src', 'module', 'applications', 'catalogue.ts'), 'utf8');
    assert.match(src, /name="fill" checked/);
    assert.match(src, /catalogueLoadPreview\(parsed\)/);
    assert.match(src, /DialogV2\.confirm/);
  });
});

describe('v0.84.0 found by the data check', () => {
  test('a choice field whose default is blank allows blank (Foundry v14 refuses it otherwise: a focus could not be created)', () => {
    const src = readFileSync(join(process.cwd(), 'src', 'module', 'models', 'index.ts'), 'utf8');
    const bad = src.split('\n').map((l, i) => [i + 1, l] as const)
      .filter(([, l]) => /StringField\(\{[^}]*choices/.test(l) && /initial: ''/.test(l) && !/blank: true/.test(l));
    assert.deepEqual(bad, []);
  });
});

describe('v0.84.0 review fixes in the loader', () => {
  test('a stat-block NPC keeps the catalogue name; items an actor type can\'t carry are left out', async () => {
    stubWorld();
    const cat = await import('../applications/catalogue.ts');
    const text = file({ actors: [
      { type: 'npc', name: 'ZZ Bouncer', statBlock: 'Name: Big Al\nBody: 6\nQuickness: 3', items: [{ type: 'gear', name: 'ZZ Rope', system: {} }] },
      { type: 'vehicle', name: 'ZZ Van', system: {}, items: [{ type: 'cyberware', name: 'ZZ Wired', system: {} }, { type: 'weapon', name: 'ZZ Gun', system: {} }] },
    ] });
    // The world already has a vehicle "ZZ Van" in stubWorld: use another name for the new one.
    const r = await cat.loadCatalogue(text.replace('ZZ Van', 'ZZ Truck'), 'replace');
    const npc = w_created.find((a) => a.type === 'npc');
    assert.equal(npc.name, 'ZZ Bouncer', 'the block\'s own name is put back');
    assert.ok(npc.items.some((i: any) => i.name === 'ZZ Rope'), 'extra items added');
    assert.equal(r.actorsCreated, 2);
    assert.match(r.errors.join('\n'), /ZZ Truck: ZZ Wired left out/);
  });
});

describe('v0.84.0 second review: refused values are reported, not sent', () => {
  test('an update the data model refuses goes to the errors', async () => {
    const w = stubWorld();
    const cat = await import('../applications/catalogue.ts');
    const gun = (g.game.actors[0].items as any[]).find((i: any) => i.name === 'ZZ Pistol');
    gun.validate = () => { throw new Error('availability: not allowed'); };
    const r = await cat.loadCatalogue(file({ templates: [{ type: 'weapon', name: 'ZZ Pistol', system: { cost: 450 } }] }), 'replace');
    assert.deepEqual(w.updates, []);
    assert.equal(r.valuesFilled, 0);
    assert.match(r.errors.join('\n'), /Rook: ZZ Pistol not filled in \(availability: not allowed\)/);
  });
  test('the preview counts stat-block NPCs already in the world apart', async () => {
    stubWorld();
    g.game.actors.push({ id: 'n1', type: 'npc', name: 'ZZ Guard', items: [] });
    const cat = await import('../applications/catalogue.ts');
    const pv = cat.catalogueLoadPreview(parseCatalogueJson(file({ actors: [{ type: 'npc', name: 'zz guard', statBlock: 'Body 4' }, { type: 'npc', name: 'ZZ New', statBlock: 'Body 4' }] })));
    assert.deepEqual([pv.actorsNew, pv.actorsExisting, pv.actorsKept], [1, 0, 1]);
  });
});
