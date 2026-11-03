/**
 * v0.60.0: scene regions, turn pings, hover cards, sounds, compendium templates and module hooks (Foundry glue
 * with small stubs; the real Foundry calls are checked in the live run).
 */
import { test, describe, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const g = globalThis as any;
let regions: typeof import('../applications/regions.ts');
let qol: typeof import('../applications/qol.ts');
const hooks = new Map<string, Array<(...a: any[]) => any>>();
const chat: any[] = [];
const notes: string[] = [];
const uuids = new Map<string, any>();

function fire(name: string, ...args: any[]): any[] {
  return (hooks.get(name) ?? []).map((fn) => fn(...args));
}

function region(id: string, env: any, shapes: any[], extra: any = {}) {
  return { id, uuid: `Scene.s.Region.${id}`, name: `Region ${id}`, shapes, flags: { sr2e: { env } }, behaviors: [], ...extra };
}

function scene(regs: any[], tokens: any[] = []) {
  const s: any = { id: 's', grid: { size: 100 }, regions: Object.assign([...regs], { get: (id: string) => regs.find((r) => r.id === id) }), tokens };
  for (const t of tokens) t.parent = s;
  return s;
}

before(async () => {
  g.Hooks = {
    on: (n: string, fn: any) => { (hooks.get(n) ?? hooks.set(n, []).get(n)!).push(fn); },
    once: (n: string, fn: any) => { (hooks.get(n) ?? hooks.set(n, []).get(n)!).push(fn); },
    callAll: (n: string, ...a: any[]) => { fire(n, ...a); return true; },
    call: (n: string, ...a: any[]) => !fire(n, ...a).includes(false),
  };
  g.ui = { notifications: { warn: (m: string) => notes.push(`warn:${m}`), info: (m: string) => notes.push(`info:${m}`), error: (m: string) => notes.push(`error:${m}`) } };
  g.ChatMessage = { create: async (d: any) => { chat.push(d); return d; } };
  g.fromUuidSync = (u: string) => uuids.get(u) ?? null;
  g.fromUuid = async (u: string) => uuids.get(u) ?? null;
  g.CONFIG = { Actor: { documentClass: { tokenFor: (a: any) => a?._token ?? null } }, Item: { dataModels: { weapon: {}, gear: {} } } };
  g.foundry = { utils: { deepClone: (x: any) => structuredClone(x), randomID: () => Math.random().toString(36).slice(2, 10) } };
  regions = await import('../applications/regions.ts');
  qol = await import('../applications/qol.ts');
  regions.registerRegionHooks();
  qol.registerQualityOfLife();
});

let settings: Record<string, any> = {};
beforeEach(() => {
  chat.length = 0; notes.length = 0; uuids.clear(); settings = {};
  g.game = {
    user: { id: 'u1', isGM: false },
    users: Object.assign([], { activeGM: { isSelf: true } }),
    settings: { get: (_s: string, k: string) => settings[k], set: async (_s: string, k: string, v: any) => { settings[k] = v; } },
    actors: [],
    packs: new Map(),
  };
});

describe('v0.60.0 regions (glue)', () => {
  test('a token stands in the regions whose shapes hold its centre (innermost first for overrides)', () => {
    const big = region('big', { weather: 'storm', backgroundCount: 2 }, [{ type: 'rectangle', x: 0, y: 0, width: 2000, height: 2000 }]);
    const room = region('room', { weather: 'clear', light: 'darkness' }, [{ type: 'rectangle', x: 100, y: 100, width: 300, height: 300 }]);
    const plain = region('plain', {}, [{ type: 'rectangle', x: 0, y: 0, width: 4000, height: 4000 }]);
    const sc = scene([big, room, plain]);
    const tok = { x: 150, y: 150, width: 1, height: 1, elevation: 0, parent: sc };
    const hits = regions.regionsAtToken(tok);
    assert.deepEqual(hits.map((h) => h.id).sort(), ['big', 'room']);              // the plain region has no SR2 environment
    assert.deepEqual(regions.regionsAt(sc, { x: 1500, y: 1500 }).map((h) => h.id), ['big']);
    // Foundry's own test wins when the document has one.
    const odd = region('odd', { smoke: 'smoke' }, [], { testPoint: () => true });
    assert.deepEqual(regions.regionsAt(scene([odd]), { x: 9999, y: 9999 }).map((h) => h.id), ['odd']);
    assert.deepEqual(regions.tokenPoint(tok), { x: 200, y: 200, elevation: 0 });
  });

  test('light: a region sets it; Foundry darkness behaviours change the darkness', () => {
    const dark = region('d', { light: 'darkness' }, [{ type: 'circle', x: 0, y: 0, radius: 500 }]);
    const dim = region('b', {}, [{ type: 'circle', x: 2000, y: 0, radius: 500 }], { behaviors: [{ type: 'adjustDarknessLevel', disabled: false, system: { mode: 0, modifier: 0.9 } }] });
    const sc = scene([dark, dim]);
    assert.deepEqual(regions.regionLightAt({ center: { x: 10, y: 10 }, document: { elevation: 0, parent: sc } }, 0), { light: 'darkness', darkness: 0, from: 'Region d' });
    assert.deepEqual(regions.regionLightAt({ center: { x: 2000, y: 10 }, document: { elevation: 0, parent: sc } }, 0.1), { light: null, darkness: 0.9, from: 'Region b' });
    assert.deepEqual(regions.regionLightAt({ center: { x: 5000, y: 10 }, document: { elevation: 0, parent: sc } }, 0.1), { light: null, darkness: 0.1, from: '' });
  });

  test('smoke regions on a line of sight; ward edges between two tokens', () => {
    const smoke = region('sm', { smoke: 'thermal' }, [{ type: 'rectangle', x: 400, y: 0, width: 100, height: 100 }]);
    const wardR = region('w', { wardUuid: 'Actor.ward' }, [{ type: 'circle', x: 0, y: 50, radius: 300 }]);
    const sc = scene([smoke, wardR]);
    const at = (x: number) => ({ center: { x, y: 50 }, document: { elevation: 0, parent: sc } });
    assert.deepEqual(regions.regionSmokeBetween(at(0), at(1000)), { kind: 'thermal', source: 'Region sm' });
    assert.deepEqual(regions.regionSmokeBetween(at(0), at(300)), { kind: 'none', source: '' });
    uuids.set('Actor.ward', { uuid: 'Actor.ward', type: 'barrier', name: 'Ward', system: { rating: 4 } });
    assert.deepEqual(regions.wardsBetween(at(0), at(1000)).map((b: any) => b.name), ['Ward']);
    assert.deepEqual(regions.wardsBetween(at(0), at(100)), []);                    // both inside
    // In one side and out the other: the ends are both outside, the line still crosses it.
    assert.deepEqual(regions.wardsBetween({ center: { x: -600, y: 50 }, document: { elevation: 0, parent: sc } }, at(600)).map((b: any) => b.name), ['Ward']);
    uuids.set('Actor.ward', { uuid: 'Actor.ward', type: 'barrier', name: 'Ward', system: { rating: 0 } });
    assert.deepEqual(regions.wardsBetween(at(0), at(1000)), []);                   // a broken ward stops nothing
  });

  test('a ward stops a projecting magician at its edge, warns the GM, lets bodies through', () => {
    settings.wardsStopAstral = 'block';
    uuids.set('Actor.ward', { uuid: 'Actor.ward', type: 'barrier', name: 'Ward', system: { rating: 5 } });
    const sc = scene([region('w', { wardUuid: 'Actor.ward' }, [{ type: 'circle', x: 0, y: 0, radius: 300 }])]);
    const doc: any = { name: 'Mage', x: -50, y: -50, width: 1, height: 1, elevation: 0, parent: sc, actor: { type: 'character', system: { derived: { astralMode: 'projecting' } } } };
    const move = (change: any) => fire('preUpdateToken', doc, change, {}, 'u1')[0];
    assert.equal(move({ x: 1000 }), false);
    assert.match(notes.at(-1)!, /can't pass Ward/);
    assert.equal(move({ x: 100 }), undefined);                                    // still inside
    doc.actor.system.derived.astralMode = 'physical';
    assert.equal(move({ x: 1000 }), undefined);
    doc.actor = { type: 'spirit', system: { materialized: false } };
    g.game.user.isGM = true;
    assert.equal(move({ x: 1000 }), undefined);
    assert.match(notes.at(-1)!, /crosses Ward/);
    settings.wardsStopAstral = 'off';
    g.game.user.isGM = false;
    assert.equal(move({ x: 1000 }), undefined);
    assert.equal(regions.astralForm({ type: 'spirit', system: { materialized: true } }), false);
  });

  test('a camera region tells the GM who walks in (once), or rolls detection', async () => {
    const detected: any[] = [];
    const site = { uuid: 'Actor.site', type: 'site', name: 'Lab', system: { guards: ['Actor.guard'], riggerUuid: '', devices: [{ id: 'cam', name: 'Lobby cam', kind: 'camera', rating: 4, active: true, bypassed: false, sense: 'visual' }] },
      detect: async (...a: any[]) => { detected.push(a); return { detected: true }; } };
    uuids.set('Actor.site', site);
    const cam = region('c', { siteUuid: 'Actor.site', deviceId: 'cam' }, [{ type: 'rectangle', x: 1000, y: 0, width: 500, height: 500 }]);
    const runner: any = { uuid: 'Scene.s.Token.t1', name: 'Runner', x: 0, y: 0, width: 1, height: 1, elevation: 0, hidden: false, actor: { uuid: 'Actor.runner', id: 'runner', isToken: false, system: {} } };
    const sc = scene([cam], [runner]);
    settings.regionDetect = 'prompt';
    fire('createToken', runner);
    runner.x = 1100; runner.y = 100;
    fire('updateToken', runner, { x: 1100, y: 100 });
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(chat.length, 1);
    assert.match(chat[0].content, /Lobby cam.*Runner walks in/);
    assert.deepEqual(chat[0].flags.sr2e.regionDetect, { siteUuid: 'Actor.site', deviceId: 'cam', intruderUuid: 'Actor.runner' });
    // Moving inside the view isn't walking in again.
    runner.x = 1200;
    fire('updateToken', runner, { x: 1200 });
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(chat.length, 1);
    // Out and back in, with automatic detection.
    settings.regionDetect = 'auto';
    runner.x = 0; fire('updateToken', runner, { x: 0 });
    runner.x = 1100; fire('updateToken', runner, { x: 1100 });
    await new Promise((r) => setTimeout(r, 10));
    assert.deepEqual(detected.map((d) => d.slice(0, 2)), [['cam', 'Actor.runner']]);
    // A guard, or a bypassed camera, is not noticed.
    const guard: any = { uuid: 'Scene.s.Token.t2', name: 'Guard', x: 0, y: 0, width: 1, height: 1, elevation: 0, actor: { uuid: 'Actor.guard', id: 'guard', system: {} }, parent: sc };
    fire('createToken', guard);
    guard.x = 1100; fire('updateToken', guard, { x: 1100 });
    site.system.devices[0]!.bypassed = true;
    runner.x = 0; fire('updateToken', runner, { x: 0 });
    runner.x = 1100; fire('updateToken', runner, { x: 1100 });
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(detected.length, 1);
    // After a reload the GM has no record of a token: the mover's own "before" (from preUpdateToken) is used, else no false entry.
    const late: any = { uuid: 'Scene.s.Token.t3', name: 'Late', x: 1100, y: 100, width: 1, height: 1, elevation: 0, actor: { uuid: 'Actor.late', id: 'late', system: {} }, parent: sc };
    site.system.devices[0]!.bypassed = false;
    late.x = 1150; fire('updateToken', late, { x: 1150 }, {});
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(detected.length, 1);
    const late2: any = { ...late, uuid: 'Scene.s.Token.t4', actor: { uuid: 'Actor.late2', id: 'late2', system: {} } };
    fire('updateToken', late2, { x: 1150 }, { sr2eWatchedBefore: [] });
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(detected.length, 2);
    site.system.devices[0]!.bypassed = true;
    // Only the active GM's client watches.
    g.game.users.activeGM = { isSelf: false };
    site.system.devices[0]!.bypassed = false;
    runner.x = 0; fire('updateToken', runner, { x: 0 });
    runner.x = 1100; fire('updateToken', runner, { x: 1100 });
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(detected.length, 2);
  });

  test('saving a region keeps its environment tidy; the config fields carry the current values', () => {
    const doc = { flags: { sr2e: { env: { backgroundCount: 2, light: 'partial' } } } };
    const change: any = { flags: { sr2e: { env: { backgroundCount: '4', smoke: 'oops' } } } };
    fire('preUpdateRegion', doc, change);
    assert.equal(change.flags.sr2e.env.backgroundCount, 4);
    assert.equal(change.flags.sr2e.env.light, 'partial');
    assert.equal(change.flags.sr2e.env.smoke, '');
    const html = regions.regionEnvFields(regions.regionsAt(scene([]), { x: 0, y: 0 })[0]?.env ?? (globalThis as any).structuredClone({ backgroundCount: 3, backgroundAspect: 'bear', backgroundToxic: true, environment: 'forest', weather: 'fog', light: 'minimal', smoke: 'smoke', wardUuid: 'Actor.w', siteUuid: 'Actor.s', deviceId: 'd' }),
      { barriers: [{ uuid: 'Actor.w', name: 'Ward (4)' }], devices: [{ siteUuid: 'Actor.s', deviceId: 'd', name: 'Lab: cam' }] });
    assert.match(html, /name="flags\.sr2e\.env\.backgroundCount" value="3"/);
    assert.match(html, /<option value="fog" selected>/);
    assert.match(html, /<option value="minimal" selected>/);
    assert.match(html, /<option value="Actor\.w" selected>/);
    assert.match(html, /<option value="Actor\.s#d" selected>/);
    assert.match(html, /name="flags\.sr2e\.env\.backgroundToxic" checked/);
    assert.doesNotMatch(html, /name="sr2eRegionDevice"/);                          // the picker isn't saved itself
  });
});

describe('v0.60.0 quality of life (glue)', () => {
  test('hover card: owners and the GM see pools and state; others see nothing', () => {
    const actor: any = { type: 'character', name: 'Pell', isOwner: true, system: { derived: { combatPool: 5, combatPoolLeft: 5 }, monitor: { physical: 2, stun: 0 }, matrix: { monitor: 0 }, karma: { pool: 0 } }, fullDefenseUp: () => false, isDelaying: () => true };
    const lines = qol.tokenHoverLines({ id: 't', actor, document: { id: 't' } });
    assert.deepEqual(lines, ['Combat 5/5', 'Physical 2/10 · Stun 0/10', 'delaying']);
    actor.isOwner = false;
    assert.deepEqual(qol.tokenHoverLines({ id: 't', actor }), []);
    g.game.user.isGM = true;
    assert.equal(qol.tokenHoverLines({ id: 't', actor }).length, 3);
  });

  test('sound cues play only when switched on, with the chosen file and volume', () => {
    const played: any[] = [];
    g.foundry.audio = { AudioHelper: { play: (d: any) => { played.push(d); } } };
    qol.playCue('turn');
    assert.equal(played.length, 0);
    settings.soundCues = true; settings.soundVolume = 0.3; settings['sound.turn'] = 'sounds/x.ogg';
    qol.playCue('turn');
    assert.deepEqual(played[0], { src: 'sounds/x.ogg', volume: 0.3, autoplay: true, loop: false });
    settings['sound.turn'] = '';
    qol.playCue('turn');
    qol.playCue('nope');
    assert.equal(played.length, 1);
    delete g.foundry.audio;
  });

  test('turn pings tell the acting combatant\'s players', async () => {
    const played: any[] = [];
    settings.soundCues = true; settings['sound.turn'] = 'sounds/notify.wav';
    g.foundry.audio = { AudioHelper: { play: (d: any) => { played.push(d); } } };
    const me = { id: 'u1', active: true, isGM: false };
    g.game.users = Object.assign([me, { id: 'gm', active: true, isGM: true }], { activeGM: { isSelf: false } });
    const combat: any = { id: 'c1', started: true, combatant: { name: 'Pell', actor: { testUserPermission: (u: any) => u.id === 'u1' }, token: null } };
    g.game.combat = combat;
    fire('updateCombat', combat, { turn: 1 }, {}, 'gm');
    await new Promise((r) => setTimeout(r, 200));
    assert.ok(notes.includes('info:Your turn: Pell.'));
    assert.equal(played.length, 1);
    fire('updateCombat', combat, { flags: { sr2e: { surprise: {} } } }, {}, 'gm');
    await new Promise((r) => setTimeout(r, 200));
    assert.equal(played.length, 1);
    delete g.foundry.audio;
  });

  test('module hooks: preDamage can stop a monitor change; damageTaken, alert and testPosted follow', () => {
    const got: any[] = [];
    g.Hooks.on('sr2e.preDamage', (_a: any, d: any) => (d.after.physical > 9 ? false : undefined));
    g.Hooks.on('sr2e.damageTaken', (_a: any, d: any) => got.push(['damage', d.after.physical]));
    g.Hooks.on('sr2e.alert', (_a: any, d: any) => got.push(['alert', d.from, d.to]));
    g.Hooks.on('sr2e.testPosted', (_a: any, snap: any) => got.push(['test', snap.kind]));
    const actor: any = { type: 'character', system: { monitor: { physical: 1, stun: 0 } } };
    assert.ok(fire('preUpdateActor', actor, { system: { monitor: { physical: 10 } } }, {}).includes(false));
    assert.ok(!fire('preUpdateActor', actor, { system: { monitor: { physical: 3 } } }, {}).includes(false));
    actor.system.monitor.physical = 3;
    fire('updateActor', actor, { system: { monitor: { physical: 3 } } }, { sr2ePrevMonitor: { physical: 1, stun: 0 } }, 'u1');
    const site: any = { type: 'site', system: { alert: '' } };
    const opts: any = {};
    fire('preUpdateActor', site, { system: { alert: 'active' } }, opts);
    site.system.alert = 'active';
    fire('updateActor', site, { system: { alert: 'active' } }, opts, 'u1');
    fire('createChatMessage', { getFlag: (_s: string, k: string) => (k === 'test' ? { kind: 'attack', actorUuid: 'Actor.x' } : undefined) }, {}, 'u1');
    assert.deepEqual(got, [['damage', 3], ['alert', '', 'active'], ['test', 'attack']]);
  });

  test('item templates go into a world compendium and come back', async () => {
    g.game.user.isGM = true;
    settings.itemTemplates = [{ id: 'w-1', type: 'weapon', name: 'Ares Predator', system: { power: 9 } }, { id: 'w-2', type: 'gear', name: 'Medkit', system: { rating: 3 } }];
    const created: any[] = []; const updated: any[] = [];
    const pack: any = { collection: 'world.sr2e-item-templates', locked: false, documentName: 'Item', metadata: { label: 'SR2e item templates' },
      getIndex: async () => [{ _id: 'x1', name: 'Medkit', type: 'gear' }],
      getDocuments: async () => [{ type: 'weapon', name: 'Ares Predator', system: { power: 10, installed: true } }, { type: 'spell', name: 'Nope', system: {} }] };
    g.foundry.documents = { collections: { CompendiumCollection: { createCompendium: async (m: any) => { pack.made = m; g.game.packs.set(pack.collection, pack); return pack; } } } };
    g.CONFIG.Item.documentClass = { createDocuments: async (d: any[], o: any) => { created.push(...d.map((x) => [x.name, o.pack])); }, updateDocuments: async (d: any[]) => { updated.push(...d.map((x) => [x._id, x.name])); } };
    assert.equal(await qol.exportTemplatesToCompendium(), 2);
    assert.deepEqual(pack.made, { type: 'Item', label: 'SR2e item templates', name: 'sr2e-item-templates', package: 'world' });
    assert.deepEqual(created, [['Ares Predator', 'world.sr2e-item-templates']]);
    assert.deepEqual(updated, [['x1', 'Medkit']]);
    assert.equal(await qol.importTemplatesFromCompendium('world.sr2e-item-templates'), 1);   // the spell type isn't an item type here
    const list = settings.itemTemplates as any[];
    assert.equal(list.length, 2);
    const ares = list.find((t: any) => t.name === 'Ares Predator');
    assert.equal(ares.system.power, 10);
    assert.equal(ares.system.installed, undefined);
    g.game.user.isGM = false;
    assert.equal(await qol.exportTemplatesToCompendium(), 0);
  });
});
