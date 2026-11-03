/**
 * v0.59.0: Foundry integration helpers (drops, migrations, unlinked-token lookups, the GM relay's
 * auto-apply list). Pure functions and small stubs only.
 */
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { shown } from './helpers/shown.ts';

const g = globalThis as any;
let drops: typeof import('../applications/drops.ts');
let mig: typeof import('../migrations.ts');
let actors: typeof import('../helpers/actors.ts');

before(async () => {
  g.Hooks ??= { on: () => {}, once: () => {}, callAll: () => {} };
  drops = await import('../applications/drops.ts');
  mig = await import('../migrations.ts');
  actors = await import('../helpers/actors.ts');
});

describe('v0.59.0 dropped items', () => {
  test('arrive not installed, not bonded, not loaded, not worn', () => {
    assert.deepEqual(drops.arrivalReset('cyberware', { installed: true }), { installed: false });
    assert.deepEqual(drops.arrivalReset('focus', { bonded: true }), { bonded: false });
    assert.deepEqual(drops.arrivalReset('program', { loaded: true }), { loaded: false, loading: { round: -1, worldTime: -1 } });
    assert.deepEqual(drops.arrivalReset('armor', { worn: true }), { worn: false });
    assert.deepEqual(drops.arrivalReset('cyberware', { installed: false }), {});
    assert.deepEqual(drops.arrivalReset('weapon', { ammo: 10 }), {});
    assert.deepEqual(drops.arrivalReset('skill', undefined), {});
  });
  test('gear moves between actors (Alt copies); knowledge always copies', () => {
    assert.equal(drops.dropMoves('weapon', { fromActor: true, sameActor: false, copyKey: false }), true);
    assert.equal(drops.dropMoves('weapon', { fromActor: true, sameActor: false, copyKey: true }), false);
    assert.equal(drops.dropMoves('weapon', { fromActor: false, sameActor: false, copyKey: false }), false);
    assert.equal(drops.dropMoves('spell', { fromActor: true, sameActor: false, copyKey: false }), false);
    assert.equal(drops.dropMoves('program', { fromActor: true, sameActor: false, copyKey: false }), false);
    assert.equal(drops.dropMoves('cyberware', { fromActor: true, sameActor: true, copyKey: false }), false);
  });
  test('each actor type takes only the item types it uses', () => {
    assert.equal(drops.itemTypeProblem('character', 'cyberdeck'), null);
    assert.equal(drops.itemTypeProblem('vehicle', 'weapon'), null);
    assert.match(String(drops.itemTypeProblem('vehicle', 'spell')), /can't hold a spell/);
    assert.match(String(drops.itemTypeProblem('host', 'program')), /doesn't hold items/);
    assert.equal(drops.itemTypeProblem('ic', 'program'), null);                 // frames and agents carry utilities
    assert.match(String(drops.itemTypeProblem('ic', 'weapon')), /can't hold/);
    assert.equal(drops.itemTypeProblem('spirit', 'power'), null);
    assert.match(String(drops.itemTypeProblem('spirit', 'cyberware')), /can't hold/);
    assert.equal(drops.itemTypeProblem('someModuleType', 'spell'), null);
  });
  test('the drop: a vehicle refuses a spell; gear handed over is taken from the giver', async () => {
    const warned: string[] = []; const info: string[] = [];
    g.ui = { notifications: { warn: (m: string) => warned.push(m), info: (m: string) => info.push(m) } };
    g.game = { ...(g.game ?? {}), user: { isGM: false } };
    const made: any[] = [];
    g.Item = { implementation: { create: async (d: any, o: any) => { made.push({ d, o }); return { name: d.name }; } } };
    const deleted: string[] = [];
    const giver = { uuid: 'Actor.g', name: 'Giver', documentName: 'Actor', isOwner: true, deleteEmbeddedDocuments: async (_t: string, ids: string[]) => { deleted.push(...ids); } };
    const vehicle = { actor: { uuid: 'Actor.v', type: 'vehicle', isOwner: true, items: new Map() } };
    const spell = { id: 's1', type: 'spell', name: 'Fireball', parent: giver, toObject: () => ({ name: 'Fireball', type: 'spell', system: {} }) };
    assert.equal(await drops.dropItemOnActor(vehicle, {}, spell, async () => 'sorted'), null);
    assert.match(shown(warned.at(-1)), /can't hold a spell/);
    const char = { actor: { uuid: 'Actor.c', type: 'character', isOwner: true, name: 'Taker', items: new Map() } };
    const ware = { id: 'w1', type: 'cyberware', name: 'Wired Reflexes', parent: giver, toObject: () => ({ name: 'Wired Reflexes', type: 'cyberware', system: { installed: true, essence: 2 } }) };
    await drops.dropItemOnActor(char, {}, ware, async () => 'sorted');
    assert.equal(made.at(-1).d.system.installed, false);
    assert.equal(made.at(-1).d.system.essence, 2);
    assert.deepEqual(deleted, ['w1']);
    assert.match(info.at(-1)!, /Giver hands Wired Reflexes to Taker: not installed/);
    // Same actor: Foundry's sort.
    const own = { ...ware, parent: char.actor };
    assert.equal(await drops.dropItemOnActor(char, {}, own, async () => 'sorted'), 'sorted');
    // A player can't take gear from someone they don't own.
    const stranger = { ...giver, isOwner: false };
    assert.equal(await drops.dropItemOnActor(char, {}, { ...ware, parent: stranger }, async () => null), null);
    assert.match(warned.at(-1)!, /only their owner or the GM/);
    // A GM's Shift-drop keeps it as it was; Alt copies.
    g.game.user = { isGM: true }; deleted.length = 0;
    await drops.dropItemOnActor(char, { shiftKey: true, altKey: true }, ware, async () => null);
    assert.equal(made.at(-1).d.system.installed, true);
    assert.deepEqual(deleted, []);
  });
});

describe('v0.59.0 migration of v0.58.0 data', () => {
  test('bone lacing and filtration typed by name; vehicle skills to Reaction', () => {
    assert.deepEqual(mig.itemMigrationUpdate({ type: 'cyberware', name: 'Titanium Bone Lacing', system: { kind: 'other' } }), { 'system.kind': 'boneLacing', 'system.lacing': 'titanium' });
    assert.deepEqual(mig.itemMigrationUpdate({ type: 'cyberware', name: 'Bone lacing (aluminium)', system: { kind: 'boneLacing', lacing: '' } }), { 'system.kind': 'boneLacing', 'system.lacing': 'aluminum' });
    assert.equal(mig.itemMigrationUpdate({ type: 'cyberware', name: 'Plastic Bone Lacing', system: { kind: 'boneLacing', lacing: 'plastic' } }), null);
    assert.deepEqual(mig.itemMigrationUpdate({ type: 'cyberware', name: 'Blood Filtration 3', system: { kind: 'other' } }), { 'system.kind': 'filtration', 'system.filterKind': 'blood' });
    assert.deepEqual(mig.itemMigrationUpdate({ type: 'cyberware', name: 'Air Filtration', system: { kind: 'other' } }), { 'system.kind': 'filtration', 'system.filterKind': 'air' });
    assert.equal(mig.itemMigrationUpdate({ type: 'cyberware', name: 'Air Filtration', system: { kind: 'eyes' } }), null);
    assert.deepEqual(mig.itemMigrationUpdate({ type: 'skill', name: 'Car', system: { attribute: 'quickness' } }), { 'system.attribute': 'reaction' });
    assert.equal(mig.itemMigrationUpdate({ type: 'skill', name: 'Car', system: { attribute: 'reaction' } }), null);
    assert.equal(mig.itemMigrationUpdate({ type: 'skill', name: 'Car', system: { attribute: 'intelligence' } }), null);
    assert.equal(mig.itemMigrationUpdate({ type: 'skill', name: 'Pistols', system: { attribute: 'quickness' } }), null);
    // v0.81.1 (RB2-6): the house-rule cleanup for removed rules runs too.
    assert.deepEqual(mig.pendingMigrations('0.58.0'), ['0.59.0', '0.77.0', '0.81.1']);
    // v0.77.0: Killing Hands saved under M/S/D moves up one level (L/M/S/D); other items and level 4 are left alone.
    assert.deepEqual(mig.killingHandsMigrationUpdate({ type: 'adeptpower', system: { special: 'killingHands', level: 1 } }), { 'system.level': 2 });
    assert.deepEqual(mig.killingHandsMigrationUpdate({ type: 'adeptpower', system: { special: 'killingHands', level: 3 } }), { 'system.level': 4 });
    assert.equal(mig.killingHandsMigrationUpdate({ type: 'adeptpower', system: { special: 'killingHands', level: 4 } }), null);
    assert.equal(mig.killingHandsMigrationUpdate({ type: 'adeptpower', system: { special: 'killingHands', level: 0 } }), null);
    assert.equal(mig.killingHandsMigrationUpdate({ type: 'adeptpower', system: { special: 'combatSense', level: 1 } }), null);
    assert.equal(mig.killingHandsMigrationUpdate({ type: 'weapon', system: { special: 'killingHands', level: 1 } }), null);
  });
});

describe('v0.59.0 unlinked tokens in lookups', () => {
  test('allActors adds every unlinked token actor once, and labels them', () => {
    const w = { uuid: 'Actor.d', name: 'Drone' };
    const t1 = { actorLink: false, actor: { uuid: 'Scene.s.Token.t1.Actor.d', name: 'Drone', isToken: true, token: { parent: { name: 'Docks' } } } };
    const t2 = { actorLink: true, actor: w };
    g.game = { ...(g.game ?? {}), actors: [w], scenes: [{ tokens: [t1, t2, t1] }], user: { isGM: true } };
    const all = actors.allActors();
    assert.deepEqual(all.map((a: any) => a.uuid), ['Actor.d', 'Scene.s.Token.t1.Actor.d']);
    assert.equal(actors.actorLabel(all[1]), 'Drone (token on Docks)');
    assert.equal(actors.actorLabel(w), 'Drone');
    g.game.user = { isGM: false };
    assert.equal(actors.actorLabel(all[1]), 'Drone (token)');                     // players aren't told the scene
  });
});

describe('v0.59.0 token statuses and the Effects view', () => {
  test('state statuses follow the state; Foundry\'s own Fear and Burning are taken off only if we put them on', async () => {
    const { stateStatusChanges, prunedStatusEffects } = await import('../rules/index.ts');
    let ch = stateStatusChanges({ fullDefense: true, onFire: true }, new Set(), []);
    assert.deepEqual(ch.on.sort(), ['burning', 'sr2eFullDefense']);
    assert.deepEqual(ch.ours.sort(), ['burning', 'sr2eFullDefense']);
    ch = stateStatusChanges({}, new Set(['burning', 'sr2eFullDefense']), ['burning', 'sr2eFullDefense']);
    assert.deepEqual(ch.off.sort(), ['burning', 'sr2eFullDefense']);
    assert.deepEqual(ch.ours, []);
    // The GM's own Fear (not ours) stays when morale isn't broken, and isn't claimed when it is.
    ch = stateStatusChanges({}, new Set(['fear']), []);
    assert.deepEqual(ch.off, []);
    ch = stateStatusChanges({ broken: true }, new Set(['fear']), []);
    assert.deepEqual({ on: ch.on, ours: ch.ours }, { on: [], ours: [] });
    // Our own icons always follow the state.
    ch = stateStatusChanges({}, new Set(['sr2eJackedIn']), []);
    assert.deepEqual(ch.off, ['sr2eJackedIn']);
    const list = [{ id: 'dead' }, { id: 'stun' }, { id: 'deaf' }, { id: 'curse' }, { id: 'myModuleThing' }];
    assert.deepEqual(prunedStatusEffects(list, ['dead', 'deaf']).map((s) => s.id), ['dead', 'deaf', 'myModuleThing']);
  });

  test('time labels and the rows of the Effects view', async () => {
    const fx = await import('../applications/effects.ts');
    assert.equal(fx.timeLeftLabel(40), '40 s');
    assert.equal(fx.timeLeftLabel(7500), '2 h 5 min');
    assert.equal(fx.timeLeftLabel(3 * 86400), '3 days');
    assert.equal(fx.untilLabel({ round: 5, worldTime: -1 }, { round: 3, worldTime: 0 }), '2 Combat Turns');
    assert.equal(fx.untilLabel({ round: -1, worldTime: 100 }, { round: null, worldTime: 40 }), '1 min');
    assert.equal(fx.untilLabel({ round: -1, worldTime: 10 }, { round: null, worldTime: 40 }), 'ends now');
    g.game = { ...(g.game ?? {}), combat: null, time: { worldTime: 0 }, i18n: { localize: (k: string) => k } };
    g.CONFIG = { statusEffects: [{ id: 'deaf', name: 'Deaf' }] };
    const actor = {
      statuses: new Set(['deaf', 'sr2eJackedIn', 'sr2eWoundM']),
      getFlag: (_s: string, k: string) => (k === 'statusUntil' ? { deaf: { round: -1, worldTime: 120 } } : undefined),
      sustained: () => [{ spellName: 'Armor', force: 4 }],
      isJackedIn: () => true,
      system: { derived: { status: 'ok', woundModifier: 2, powerEffects: [] }, drugs: [{ name: 'Jazz', round: -1, worldTime: 3600 }], diseases: [], addictions: [], recovering: [], rigging: {} },
    };
    const ctx = fx.effectsContext(actor);
    const names = ctx.groups.flatMap((gr) => gr.rows.map((r) => `${gr.name}:${r.name}`));
    assert.deepEqual(names, ['Condition:Wounds', 'Statuses:Deaf', 'Magic:Sustaining Armor', 'Health:Jazz', 'Matrix and rigging:Jacked in']);
    const deaf = ctx.groups[1]!.rows[0]!;
    assert.equal(deaf.until, '2 min');
    assert.equal(deaf.statusId, 'deaf');
    delete g.CONFIG;
  });

  test('rich text: with no editor the fields are still shown; with no cleaner as escaped text (v0.81.1)', async () => {
    const { enrichFields } = await import('../applications/richtext.ts');
    // v0.81.1: a player's HTML is never shown raw. Foundry's cleanHTML is missing in this stub, so it is escaped.
    assert.deepEqual(await enrichFields({ system: { notes: '<p>x</p>', biography: '', rating: 3 } }), { notes: '&lt;p&gt;x&lt;/p&gt;', biography: '' });
  });
});

describe('v0.59.0 quality of life', () => {
  test('floating damage texts, the ruler bands and which dialogs a quick roll may submit', async () => {
    const hk = await import('../applications/hotkeys.ts');
    assert.deepEqual(hk.damageTexts({ physical: 2, stun: 5 }, { physical: 5, stun: 3 }), [{ text: '−3 Physical', damage: true }, { text: '+2 Stun', damage: false }]);
    assert.deepEqual(hk.damageTexts({ condition: 1 }, { condition: 4 }), [{ text: '−3 Condition', damage: true }]);
    assert.deepEqual(hk.damageTexts({ physical: 2 }, { physical: 2 }), []);
    const form = (sel: string[]) => ({ querySelector: (s: string) => sel.some((x) => s.includes(x)) ? {} : null });
    assert.equal(hk.isTestDialog(form(['name="mod"'])), true);
    assert.equal(hk.isTestDialog(form(['.sr2e-preview'])), true);
    assert.equal(hk.isTestDialog(form([])), false);
    assert.equal(hk.isTestDialog(null), false);
    const { movementBand, movementColour, RULES } = await import('../rules/index.ts');
    assert.equal(movementBand(5, { walk: 6, run: 18 }), 'walk');
    assert.equal(movementBand(12, { walk: 6, run: 18 }), 'run');
    assert.equal(movementBand(19, { walk: 6, run: 18 }), 'over');
    assert.equal(movementBand(3, null), null);
    assert.equal(movementColour('run'), RULES.TOKENS.ruler.run);
  });
  test('area templates: expiry and the circle region data', async () => {
    g.canvas = { grid: { size: 100, distance: 1 }, scene: { grid: { units: 'm' } } };
    const cv = await import('../applications/canvas.ts');
    const rounds = new Map([['c', 3], ['other', 1]]);
    assert.equal(cv.areaExpired({ round: 3, combatId: 'c' }, { rounds, ms: 0 }), false);
    assert.equal(cv.areaExpired({ round: 3, combatId: 'c' }, { rounds: new Map([['c', 4]]), ms: 0 }), true);
    assert.equal(cv.areaExpired({ round: 3, combatId: 'c' }, { rounds: new Map([['other', 1]]), ms: 0 }), true);   // its combat is gone
    assert.equal(cv.areaExpired({ round: 1, combatId: 'other' }, { rounds, ms: 0 }), false);                      // another combat's area stays
    assert.equal(cv.areaExpired({ round: null, combatId: null, at: 5000 }, { rounds, ms: 4000 }), false);
    assert.equal(cv.areaExpired({ round: null, combatId: null, at: 5000 }, { rounds, ms: 6000 }), true);
    const d: any = cv.areaRegionData({ x: 10.4, y: 20 }, 5, { name: 'Blast' });
    assert.deepEqual(d.shapes[0], { type: 'circle', x: 10, y: 20, radius: 500 });
    assert.equal(d.flags.sr2e.area, true);
    assert.deepEqual(cv.tokenCentre({ x: 100, y: 200, width: 2, height: 1 }, 100), { x: 200, y: 250 });
    delete g.canvas;
  });
});
