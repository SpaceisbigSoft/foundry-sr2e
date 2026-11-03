/**
 * v0.66.0: GM setup tools and module support. Glue checks with small stubs (the windows, the tours and
 * the modules themselves are checked in the live run), plus template and stylesheet checks.
 */
import { test, describe, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const g = globalThis as any;
const read = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8');
let setup: typeof import('../applications/setup.ts');
let mods: typeof import('../applications/modules.ts');
let cat: typeof import('../applications/catalogue.ts');

const hooks = new Map<string, Array<(...a: any[]) => any>>();
const notes: string[] = [];
let settings: Record<string, unknown> = {};

function getPath(o: any, path: string) { return path.split('.').reduce((x, p) => (x == null ? undefined : x[p]), o); }
function setPath(o: any, path: string, v: unknown) {
  const parts = path.split('.');
  let x = o;
  for (const p of parts.slice(0, -1)) { x[p] ??= {}; x = x[p]; }
  x[parts.at(-1)!] = v;
}

/** An actor stub that holds items (create / update / delete) and records its updates. */
function actor(type = 'character', name = 'ZZ Runner', extra: any = {}): any {
  const items: any[] = [];
  let n = 0;
  const a: any = {
    type, name, id: `a${Math.random().toString(36).slice(2, 8)}`, uuid: `Actor.${name}`, isOwner: true, hasPlayerOwner: type === 'character', flags: {}, prototypeToken: {},
    system: { nuyen: 0, karma: { good: 0 }, derived: { essenceLoss: 0, reaction: 3, initiativeDice: 1 }, reactionBonus: 0, initiativeDiceBonus: 0, attributes: {}, ...extra },
    items: Object.assign(items, { get: (id: string) => items.find((i) => i.id === id) }),
    updates: [] as any[],
    async createEmbeddedDocuments(_t: string, data: any[]) {
      const made = data.map((d) => ({ ...JSON.parse(JSON.stringify(d)), id: `i${++n}`, async update(u: any) { for (const [k, v] of Object.entries(u)) setPath(this, k, v); } }));
      items.push(...made);
      return made;
    },
    async updateEmbeddedDocuments(_t: string, data: any[]) { for (const u of data) { const i = items.find((x) => x.id === u._id); if (i) Object.assign(i.system, u.system); } return data; },
    async deleteEmbeddedDocuments(_t: string, ids: string[]) { for (const id of ids) { const i = items.findIndex((x) => x.id === id); if (i >= 0) items.splice(i, 1); } },
    async update(u: any) { this.updates.push(u); for (const [k, v] of Object.entries(u)) setPath(this, k, v); },
  };
  return a;
}

before(async () => {
  g.Hooks = { on: (h: string, fn: any) => { if (!hooks.has(h)) hooks.set(h, []); hooks.get(h)!.push(fn); }, once: (h: string, fn: any) => { if (!hooks.has(h)) hooks.set(h, []); hooks.get(h)!.push(fn); }, callAll() {} };
  g.ui = { notifications: { info: (m: string) => notes.push(m), warn: (m: string) => notes.push(m), error: (m: string) => notes.push(m) } };
  g.ChatMessage = { create: async (d: any) => d, getWhisperRecipients: () => [] };
  g.CONST = { TOKEN_DISPLAY_MODES: { OWNER_HOVER: 20, HOVER: 30, OWNER: 40, ALWAYS: 50 }, TOKEN_DISPOSITIONS: { FRIENDLY: 1, NEUTRAL: 0, HOSTILE: -1 }, DOCUMENT_OWNERSHIP_LEVELS: { OWNER: 3 } };
  g.foundry = {
    utils: { randomID: () => Math.random().toString(36).slice(2, 12), deepClone: (o: any) => JSON.parse(JSON.stringify(o)), getProperty: getPath },
    applications: { api: { DialogV2: {}, HandlebarsApplicationMixin: (c: any) => c, ApplicationV2: class {} } },
  };
  g.game = { user: { id: 'gm', name: 'GM', isGM: true }, users: [], settings: { get: (_s: string, k: string) => settings[k], set: async (_s: string, k: string, v: unknown) => { settings[k] = v; } }, time: { worldTime: 0 }, actors: [], scenes: [], system: { version: '0.66.0' }, modules: new Map() };
  g.canvas = { tokens: { controlled: [], placeables: [] } };
  g.fromUuidSync = () => null;
  setup = await import('../applications/setup.ts');
  mods = await import('../applications/modules.ts');
  cat = await import('../applications/catalogue.ts');
});

beforeEach(() => { notes.length = 0; settings = {}; g.game.actors = []; g.game.scenes = []; });

describe('v0.66.0 starter kits (glue)', () => {
  test('kits read from the setting skip broken entries', () => {
    settings['starterKits'] = [{ id: 'k1', name: 'Samurai', lines: [{ type: 'weapon', name: 'ZZ Pistol', system: {} }] }, { lines: [] }, 'x'];
    const k = setup.kits();
    assert.equal(k.length, 1);
    assert.equal(k[0]!.name, 'Samurai');
  });
  test('giving a kit: each actor gets the lines it can hold, gear stacks, ready when asked', async () => {
    const kit = { id: 'k', name: 'Starter', notes: '', lines: [
      { type: 'weapon', name: 'ZZ Pistol', system: { cost: 100 }, amount: 2 },
      { type: 'gear', name: 'ZZ Medkit', system: { quantity: 1 }, amount: 3 },
      { type: 'cyberware', name: 'ZZ Jack', system: { essenceCost: 0.2 }, amount: 1 },
      { type: 'spell', name: 'ZZ Bolt', system: { learnedForce: 3 }, amount: 3 },
    ] };
    const pc = actor('character', 'ZZ PC');
    const car = actor('vehicle', 'ZZ Car');
    const n = await setup.giveKit(kit, [pc, car], { ready: true });
    assert.equal(n, 2);
    assert.deepEqual(pc.items.map((i: any) => i.name).sort(), ['ZZ Bolt', 'ZZ Jack', 'ZZ Medkit', 'ZZ Pistol', 'ZZ Pistol']);
    assert.equal(pc.items.find((i: any) => i.name === 'ZZ Medkit').system.quantity, 3);
    assert.equal(pc.items.find((i: any) => i.name === 'ZZ Jack').system.installed, true, 'ready: installed');
    assert.equal(pc.items.find((i: any) => i.name === 'ZZ Bolt').system.learnedForce, 3);
    assert.deepEqual(car.items.map((i: any) => i.name).sort(), ['ZZ Medkit', 'ZZ Pistol', 'ZZ Pistol']);
    assert.ok(notes.some((m) => m.includes('ZZ Car: ZZ Jack')), 'what was left out is named');
    // Again: the medkits stack on the same row.
    await setup.giveKit(kit, [pc], { ready: false });
    assert.equal(pc.items.filter((i: any) => i.name === 'ZZ Medkit').length, 1);
    assert.equal(pc.items.find((i: any) => i.name === 'ZZ Medkit').system.quantity, 6);
    assert.equal(pc.items.filter((i: any) => i.name === 'ZZ Jack')[1].system.installed, false, 'not ready: arrives as a drop');
  });
  test('dropping an item on a kit adds it (GM only)', async () => {
    settings['starterKits'] = [{ id: 'k1', name: 'Samurai', lines: [] }];
    g.fromUuid = async () => ({ type: 'gear', name: 'Rope', system: { quantity: 2, worn: true } });
    assert.equal(await setup.dropOnKit('k1', { type: 'Item', uuid: 'Item.x' }), true);
    const k = (settings['starterKits'] as any[])[0];
    assert.equal(k.lines[0].name, 'Rope');
    assert.equal(k.lines[0].amount, 2);
    assert.equal('worn' in k.lines[0].system, false);
    g.game.user = { id: 'p', isGM: false };
    assert.equal(await setup.dropOnKit('k1', { type: 'Item', uuid: 'Item.x' }), false);
    g.game.user = { id: 'gm', name: 'GM', isGM: true };
  });
});

describe('v0.66.0 token setup (glue)', () => {
  test('prototype and placed tokens; unlinked placed tokens relinked only when asked', async () => {
    const pc = actor('character', 'ZZ PC');
    const placed: any[] = [];
    const scene = { tokens: [{ id: 't1', actorId: pc.id, actorLink: false }, { id: 't2', actorId: 'other', actorLink: true }],
      async updateEmbeddedDocuments(_t: string, u: any[]) { placed.push(...u); } };
    g.game.scenes = [scene];
    const r = await setup.setUpTokens([pc], { ...setup.tokenOptions(), vision: false }, { placed: true, relink: false });
    assert.deepEqual(r, { actors: 1, tokens: 1 });
    const proto = pc.updates[0];
    assert.equal(proto['prototypeToken.actorLink'], true);
    assert.equal(proto['prototypeToken.bar1.attribute'], 'derived.bars.physical');
    assert.equal(proto['prototypeToken.disposition'], 1);
    assert.equal(placed[0]._id, 't1');
    assert.equal(placed[0].actorLink, undefined, 'not relinked');
    placed.length = 0;
    await setup.setUpTokens([pc], { ...setup.tokenOptions(), vision: false }, { placed: true, relink: true });
    assert.equal(placed[0].actorLink, true);
  });
  test('stored options are read safely', () => {
    settings['tokenSetup'] = { link: false, show: 'nonsense', disposition: 'hostile' };
    const o = setup.tokenOptions();
    assert.equal(o.link, false); assert.equal(o.show, 'owner-hover'); assert.equal(o.disposition, 'hostile');
  });
});

describe('v0.66.0 session checklist (glue)', () => {
  test('a broken setting gives the default list', () => {
    settings['sessionChecklist'] = 'junk';
    assert.ok(setup.checklist().start.length > 3);
  });
});

describe('v0.66.0 module support (glue)', () => {
  test('Health Estimate reads the worse track; sites are left out', () => {
    assert.equal(mods.tokenHealth({ actor: { type: 'character', system: { monitor: { physical: 2, stun: 5 } } } }), 0.5);
    assert.equal(mods.tokenHealth({ actor: { type: 'site', system: {} } }), 1);
    assert.equal(mods.tokenHealth({}), 1);
  });
  test('the integrations hook in at the right moments and patch the provider', () => {
    settings['moduleSupport'] = true;
    mods.registerModuleSupport();
    const calls: any[] = [];
    g.game.itempiles = { API: { addSystemIntegration: (c: any, v: string) => calls.push([c, v]) } };
    for (const fn of hooks.get('item-piles-ready') ?? []) fn();
    assert.equal(calls.length, 1);
    const [cfg, ver] = calls[0];
    assert.equal(ver, '0.66.0');
    assert.equal(cfg.CURRENCIES[0].data.path, 'system.nuyen');
    assert.equal(cfg.ITEM_COST_TRANSFORMER({ type: 'gear', system: { cost: 100, streetIndex: 2 } }), 200);
    const provider: any = { filteredTypes: ['x'], fraction: () => { throw new Error('HP is undefined'); } };
    g.game.healthEstimate = { provider };
    g.game.modules = new Map([['healthEstimate', { active: true }]]);
    for (const fn of hooks.get('ready') ?? []) fn();
    assert.equal(provider.fraction({ actor: { type: 'vehicle', system: { condition: 3 } } }), 0.7);
    assert.ok(provider.filteredTypes.includes('site') && provider.filteredTypes.includes('x'));
  });
  test('item piles are not NPCs', () => {
    assert.equal(mods.isItemPile({ flags: { 'item-piles': { data: { enabled: true } } } }), true);
    assert.equal(mods.isItemPile({ flags: {} }), false);
  });
});

describe('v0.66.0 catalogue (glue)', () => {
  test('pasted rows become world templates; the same name again replaces it', async () => {
    const n = await cat.pasteCatalogueRows('Name\tType\tDamage\tCost\nZZ Pistol\tweapon\t9M\t450\nZZ Rope\tgear\t\t20', '');
    assert.equal(n, 2);
    const list = settings['itemTemplates'] as any[];
    assert.equal(list.length, 2);
    const id = list.find((t) => t.name === 'ZZ Pistol').id;
    await cat.pasteCatalogueRows('Name,Type,Cost\nZZ Pistol,weapon,500', '');
    const after = settings['itemTemplates'] as any[];
    assert.equal(after.length, 2);
    assert.equal(after.find((t) => t.name === 'ZZ Pistol').id, id);
    assert.equal(after.find((t) => t.name === 'ZZ Pistol').system.cost, 500);
  });
  test('players can\'t change the catalogue', async () => {
    g.game.user = { id: 'p', isGM: false };
    assert.equal(await cat.pasteCatalogueRows('Name,Type\nX,gear', ''), 0);
    g.game.user = { id: 'gm', name: 'GM', isGM: true };
  });
  test('a catalogue file brings templates and kits', async () => {
    settings['itemTemplates'] = [{ id: 'w-1', type: 'gear', name: 'Rope', system: { cost: 10 } }];
    settings['starterKits'] = [];
    const file = JSON.stringify({ format: 'sr2e-catalogue', version: 1, templates: [{ id: 'w-9', type: 'gear', name: 'Rope', system: { cost: 99 } }, { id: 'w-8', type: 'weapon', name: 'Knife', system: {} }],
      kits: [{ name: 'Kit A', lines: [{ type: 'gear', name: 'Rope', system: {}, amount: 2 }] }] });
    const r = await cat.loadCatalogue(file, 'skip');
    assert.equal(r.templates, 1);
    assert.equal((settings['itemTemplates'] as any[]).find((t) => t.name === 'Rope').system.cost, 10, 'skip keeps mine');
    assert.equal((settings['starterKits'] as any[]).length, 1);
    const bad = await cat.loadCatalogue('{"nope":1}', 'replace');
    assert.ok(bad.errors.length > 0);
  });
});

describe('v0.66.0 templates and wiring', () => {
  const gm = read('public', 'templates', 'gm-panel.hbs');
  const ui = read('src', 'module', 'applications', 'ui.ts');
  const setupSrc = read('src', 'module', 'applications', 'setup.ts');
  const catSrc = read('src', 'module', 'applications', 'catalogue.ts');
  test('every Setup tab action has a handler', () => {
    const tab = gm.slice(gm.indexOf('{{#if tab.setup}}'));
    const acts = [...tab.matchAll(/data-action="([a-zA-Z]+)"/g)].map((m) => m[1]!);
    assert.ok(acts.length > 10);
    for (const a of new Set(acts)) {
      const found = new RegExp(`\\b${a}\\s*:`).test(ui) || new RegExp(`\\b${a}\\s*:`).test(setupSrc) || new RegExp(`\\b${a}\\s*:`).test(catSrc);
      assert.ok(found, `no handler for ${a}`);
    }
  });
  test('the Setup tab is in the panel and the Add window knows kits', () => {
    assert.match(ui, /id: 'setup'/);
    assert.match(read('src', 'module', 'applications', 'adding.ts'), /windowTypesFor/);
  });
  test('the help template and stylesheet are there', () => {
    assert.match(read('public', 'templates', 'help.hbs'), /data-action="helpTopic"/);
    const css = read('public', 'style', 'sr2e.css');
    assert.match(css, /v0\.66\.0/);
    assert.match(css, /a\.sr2e-help/);
  });
  test('Bio has the stat-block import', () => {
    assert.match(read('public', 'templates', 'actor-character-sheet.hbs'), /data-action="importCharacter"/);
  });
});

describe('v0.66.0 character stat-block import (glue)', () => {
  test('a write-up fills the sheet: attributes, skills, gear, contacts, money, lifestyle paid up', async () => {
    const a = actor('character', 'ZZ Blank', { contacts: [], qualities: [], biography: '', notes: '' });
    g.game.time.worldTime = 1000;
    const res = await cat.importCharacter(a, `Name: ZZ Razor
Metatype: Ork
B Q S C I W E M R
6 5 6 2 4 3 6 0 4
Skills: Firearms 5 (Pistols 7), Athletics 3
Knowledge skills: Gang Lore 4
Gear: ZZ Heavy Pistol [9M], Medkit x2
Contacts: ZZ Fixer (Level 2)
Nuyen: 2,500
Karma: 3 (total 10)
Lifestyle: Low (2 months)`);
    assert.ok(res.lines.length > 0);
    assert.equal(a.name, 'ZZ Razor');
    assert.equal(a.system.metatype, 'ork');
    assert.equal(a.system.attributes.body.base, 6);
    assert.equal(a.system.nuyen, 2500);
    assert.equal(a.system.karma.good, 3);
    const names = a.items.map((i: any) => i.name);
    for (const n of ['Firearms', 'Athletics', 'Gang Lore', 'ZZ Heavy Pistol', 'Medkit']) assert.ok(names.includes(n), `${n} made`);
    assert.equal(a.system.contacts.length, 1);
    assert.ok(a.system.lifestyle.paidUntil > 1000, 'two months paid from now');
    // Again: the same items are updated, not doubled.
    await cat.importCharacter(a, 'Skills: Firearms 6');
    assert.equal(a.items.filter((i: any) => i.name === 'Firearms').length, 1);
    assert.equal(a.items.find((i: any) => i.name === 'Firearms').system.rating, 6);
  });
  test('only the owner imports', async () => {
    const a = actor();
    a.isOwner = false;
    await assert.rejects(() => cat.importCharacter(a, 'Skills: X 1'));
  });
});

describe('v0.66.0 import gates', () => {
  test('a player can\'t import into a finished character, or past the approval queue; the GM can', async () => {
    const a = actor('character', 'ZZ Done', { contacts: [], qualities: [] });
    a.flags = { sr2e: { creation: { v: 1, finishedAt: 'x', attributes: {} } } };
    a.getFlag = (s: string, k: string) => a.flags[s]?.[k];
    g.game.user = { id: 'p', name: 'Corvo', isGM: false };
    await assert.rejects(() => cat.importCharacter(a, 'Skills: Firearms 6'), /finished/);
    const b = actor('character', 'ZZ New', { contacts: [], qualities: [] });
    settings['approvalQueue'] = true;
    await assert.rejects(() => cat.importCharacter(b, 'Skills: Firearms 6'), /approval/);
    g.game.user = { id: 'gm', name: 'GM', isGM: true };
    await cat.importCharacter(a, 'Skills: Firearms 6');
    assert.equal(a.items.find((i: any) => i.name === 'Firearms').system.rating, 6);
  });
});

describe('v0.66.0 review fixes (glue)', () => {
  test('a selected unlinked token is set up itself', async () => {
    const tokUpdates: any[] = [];
    const copy = actor('npc', 'ZZ Goon');
    copy.isToken = true;
    copy.token = { actorLink: false, async update(u: any) { tokUpdates.push(u); } };
    const r = await setup.setUpTokens([copy], { ...setup.tokenOptions(), vision: false }, { placed: true, relink: false });
    assert.deepEqual(r, { actors: 0, tokens: 1 });
    assert.equal(tokUpdates[0]['bar1.attribute'], 'derived.bars.physical');
    assert.equal(tokUpdates[0].actorLink, undefined);
    assert.equal(tokUpdates[0].disposition, -1);
  });
  test('quick kit drops don\'t lose each other', async () => {
    settings['starterKits'] = [{ id: 'k1', name: 'K', lines: [] }];
    let n = 0;
    g.fromUuid = async () => ({ type: 'gear', name: `G${++n}`, system: {} });
    await Promise.all([setup.dropOnKit('k1', { type: 'Item', uuid: 'a' }), setup.dropOnKit('k1', { type: 'Item', uuid: 'b' })]);
    assert.equal((settings['starterKits'] as any[])[0].lines.length, 2);
  });
});

describe('v0.66.0 Item Piles needs a quantity on every physical item', () => {
  test('weapons, armor, cyberware, foci, decks and programs have quantity 1', () => {
    const models = read('src', 'module', 'models', 'index.ts');
    for (const m of ['WeaponDataModel', 'ArmorDataModel', 'CyberwareDataModel', 'FocusDataModel', 'CyberdeckDataModel', 'ProgramDataModel', 'GearDataModel']) {
      const body = models.slice(models.indexOf(`export class ${m}`), models.indexOf('export class', models.indexOf(`export class ${m}`) + 10));
      assert.match(body, /quantity: new fields\.NumberField\(\{ required: true, integer: true, min: 0, initial: 1 \}\)/, m);
    }
  });
});
