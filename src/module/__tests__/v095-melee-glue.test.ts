/**
 * v0.95.0 rules completeness (melee, actions, Dice Pools): the Foundry side (applications/melee95.ts), with stubs.
 */
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { RULES } from '../rules/config.ts';
import { SYSTEM_ID as NS } from '../config/system.ts';
import * as M from '../rules/melee95.ts';
import {
  noActionsKey, noActionsText, noActionsRefusal, takesNoTurn, trackerNotes, totallySurprisedIn, surpriseOpponents, surpriseNote, quickDraw, subdueBoxAttr, subdueHold,
  onRelease95, staggered, wallMods, watchMove, onIntercept95, refreshActionPools, _resetOffers,
} from '../applications/melee95.ts';

const G: any = globalThis;
const saved = JSON.parse(JSON.stringify(RULES.MELEE_V95));
const savedUrr = RULES.URR_V80.active;
let posted: any[] = [];
let warned: string[] = [];
let faces: number[] = [];
let docs = new Map<string, any>();
let held: any[] = [];
let sheetRuns: any[] = [];

/** An actor stub: a character with a monitor, attributes, flags and statuses. */
function actor(id: string, o: any = {}): any {
  const a: any = {
    id, uuid: `Actor.${id}`, name: o.name ?? id, type: o.type ?? 'character', isOwner: o.isOwner ?? true, hasPlayerOwner: Boolean(o.player),
    system: {
      derived: { reaction: o.reaction ?? 4, woundModifier: o.wound ?? 0, status: o.status ?? 'ok', initiativeDice: 1 },
      attributes: { strength: { total: o.strength ?? 4 }, quickness: { total: o.quickness ?? 4 } },
      monitor: { stun: o.stun ?? 0, physical: 0 }, poolSpent: o.poolSpent ?? null, spellDefense: o.spellDefense ?? 0,
    },
    flags: { [NS]: {} }, statuses: new Set<string>(o.statuses ?? []), items: o.items ?? [], used: [] as string[], acting: o.acting ?? true,
    getFlag(ns: string, k: string) { return this.flags[ns]?.[k]; },
    async setFlag(ns: string, k: string, v: any) { (this.flags[ns] ??= {})[k] = v; },
    async unsetFlag(ns: string, k: string) { delete this.flags[ns]?.[k]; },
    async update(u: Record<string, any>) { for (const [k, v] of Object.entries(u)) { const parts = k.split('.'); let n: any = this; for (const p of parts.slice(0, -1)) n = (n[p] ??= {}); n[parts.at(-1)!] = v; } },
    testUserPermission(u: any) { return Boolean(u?.isGM) || (this.owners ?? []).includes(u?.id); },
    owners: o.owners ?? [],
    findSkill(name: string) { return name === 'Unarmed Combat' && o.unarmed ? { system: { rating: o.unarmed } } : undefined; },
    woundModifiers() { return o.wound ? [{ id: 'wounds', label: 'Wounds', value: o.wound }] : []; },
    previewModifiers(t: any) { return [...(t.modifiers ?? []), ...this.woundModifiers()]; },
    isActing() { return this.acting; },
    async useAction(kind: string) { this.used.push(kind); return true; },
    async toggleStatusEffect(sid: string, t: any) { if (t.active) this.statuses.add(sid); else this.statuses.delete(sid); },
    getActiveTokens() { return this.tokenObj ? [this.tokenObj] : []; },
    helplessStatus() { return ''; }, astralOnly() { return ''; },
    documentName: 'Actor',
  };
  docs.set(a.uuid, a);
  return a;
}
const combatant = (id: string, a: any, o: any = {}): any => ({ id, name: a.name, actor: a, token: o.token ?? { disposition: o.disposition ?? 0 }, hidden: Boolean(o.hidden), isDefeated: false });
function combat(list: any[], o: any = {}): any {
  const c: any = { id: 'c1', started: o.started !== false, round: 1, pass: 0, combatants: Object.assign([...list], { get: (id: string) => list.find((x) => x.id === id) }), surprised: o.surprised ?? [], surprisedNow() { return this.surprised; }, scene: o.scene ?? null };
  G.game.combat = c;
  return c;
}
const text = (m: any): string => String(m?.content ?? '');

beforeEach(() => {
  _resetOffers();
  posted = []; warned = []; faces = []; docs = new Map(); held = []; sheetRuns = [];
  G.game = {
    user: { id: 'gm', isGM: true, name: 'GM' }, users: [{ id: 'gm', isGM: true }, { id: 'p1', isGM: false }], combat: null, time: { worldTime: 1000 }, actors: [], scenes: [], messages: { contents: [] },
    i18n: { lang: 'en' }, settings: { get: () => undefined },
    sr2e: { runSheetAction: async (...a: any[]) => { sheetRuns.push(a); return true; } },
  };
  G.ChatMessage = { create: async (d: any) => { posted.push(d); return d; }, getSpeaker: (o: any) => ({ alias: o?.actor?.name }), getWhisperRecipients: () => [{ id: 'gm' }] };
  G.ui = { notifications: { warn: (s: string) => { warned.push(s); }, info: () => {} } };
  G.fromUuidSync = (u: string) => docs.get(u) ?? null;
  G.Roll = class { n: number; dice: any[] = []; constructor(f: string) { this.n = Number(f.split('d')[0]); } async evaluate() { this.dice = [{ results: Array.from({ length: this.n }, () => ({ result: faces.length ? faces.shift() : 1 })) }]; return this; } };
  G.CONFIG = { Actor: { documentClass: { setHeld: async (t: any, by: string, on: boolean) => { held.push([t.uuid, by, on]); } } }, Canvas: { polygonBackends: { move: { testCollision: () => false } } }, statusEffects: [] };
  G.canvas = { grid: { size: 100, distance: 1, units: 'm' }, scene: { id: 's1', grid: { units: 'm', size: 100, distance: 1 } }, tokens: { get: () => null } };
  G.foundry = { applications: { api: {} } };
});
afterEach(() => { Object.assign(RULES.MELEE_V95, JSON.parse(JSON.stringify(saved))); (RULES.URR_V80 as any).active = savedUrr; });

describe('v0.95.0 glue: no actions', () => {
  test('wounds taking Reaction to 0: no turn, the reason, the refusal', () => {
    const hurt = actor('a', { reaction: 3, wound: 3 }), fine = actor('b', { reaction: 4, wound: 3 });
    assert.equal(takesNoTurn(hurt), true);
    assert.equal(takesNoTurn(fine), false);
    assert.equal(takesNoTurn(actor('v', { type: 'vehicle', reaction: 0, wound: 3 })), false, 'people only');
    assert.equal(noActionsKey(hurt), '', 'no fight: nothing');
    combat([combatant('ca', hurt), combatant('cb', fine)]);
    assert.equal(noActionsKey(hurt), M.NO_ACTIONS.reaction);
    assert.equal(noActionsKey(fine), '');
    assert.equal(noActionsKey(actor('z', { reaction: 1, wound: 3 })), '', 'not in this fight');
    assert.ok(noActionsText(noActionsKey(hurt)).length > 10);
    assert.ok(noActionsRefusal(hurt, 'attack').includes('a'));
    assert.equal(noActionsRefusal(hurt, 'physical test'), '', 'a test the GM calls for still rolls');
    assert.equal(noActionsRefusal(fine, 'attack'), '');
    RULES.MELEE_V95.reactionOut = 'off';
    assert.equal(noActionsKey(hurt), '');
  });
  test('the completely surprised take no actions; the tracker names both', () => {
    const a = actor('a'), b = actor('b', { reaction: 2, wound: 3, name: 'Bee' });
    const c = combat([combatant('ca', a), combatant('cb', b), combatant('cc', actor('h', { reaction: 1, wound: 2 }), { hidden: true })], { surprised: ['ca'] });
    assert.equal(noActionsKey(a), M.NO_ACTIONS.surprised);
    assert.equal(trackerNotes(c).length, 3, 'the GM sees the hidden one too');
    G.game.user = { id: 'p1', isGM: false };
    const notes = trackerNotes(c);
    assert.equal(notes.length, 2);
    assert.ok(notes[1]!.startsWith('Bee'));
    RULES.MELEE_V95.totalSurprise = 'off';
    assert.equal(noActionsKey(a), '');
  });
});

describe('v0.95.0 glue: surprise sides', () => {
  test('player characters and friendly tokens are one side', () => {
    const pc = actor('pc', { player: true }), friend = actor('fr'), foe = actor('foe'), foe2 = actor('foe2');
    const c = combat([combatant('1', pc, { disposition: -1 }), combatant('2', friend, { disposition: 1 }), combatant('3', foe, { disposition: -1 }), combatant('4', foe2, { disposition: -1 })]);
    assert.deepEqual(totallySurprisedIn(c, [{ id: '1', successes: 0 }, { id: '2', successes: 3 }, { id: '3', successes: 1 }, { id: '4', successes: 2 }]), ['1']);
    assert.deepEqual(surpriseOpponents(c, pc, [friend, foe]).map((x) => x.id), ['foe']);
    assert.ok(surpriseNote(c, ['1']).includes('pc'));
    assert.equal(surpriseNote(c, []), '');
  });
  test('a name on the card is escaped', () => {
    const x = actor('x', { name: '<b>x</b>' });
    const c = combat([combatant('1', x)]);
    assert.equal(surpriseNote(c, ['1']).includes('<b>x'), false);
  });
});

describe('v0.95.0 glue: quick draw', () => {
  const gun = (o: any = {}) => ({ id: 'g', name: 'Pistol', system: { melee: false, modes: 'SA', concealability: 5, quickDraw: true, ready: false, ...o } });
  test('not this rule\'s case: draw as before', async () => {
    const a = actor('a');
    assert.equal(await quickDraw(a, gun(), { quickDraw95: true }), 'draw', 'no fight');
    combat([combatant('1', a)]);
    assert.equal(await quickDraw(a, gun({ concealability: 2 }), { quickDraw95: true }), 'draw', 'a rifle');
    assert.equal(await quickDraw(a, gun({ modes: 'SA/BF/FA' }), { quickDraw95: true, mode: 'FA' }), 'draw', 'full auto');
    assert.equal(await quickDraw(a, gun(), { quickDraw95: false }), 'draw', 'the player draws first');
    assert.equal(await quickDraw(a, gun(), {}), 'draw', 'no window to ask in');
    a.acting = false;
    assert.equal(await quickDraw(a, gun(), { quickDraw95: true }), 'draw', 'not their action');
    RULES.MELEE_V95.quickDraw = 'holster';
    a.acting = true;
    assert.equal(await quickDraw(a, gun(), { quickDraw95: true }), 'draw');
    assert.equal(posted.length, 0);
  });
  test('a success draws and fires; a failure spends the action', async () => {
    const a = actor('a', { reaction: 3 });
    combat([combatant('1', a)]);
    faces = [4, 1, 1];
    assert.equal(await quickDraw(a, gun(), { quickDraw95: true }), 'quick');
    assert.deepEqual(a.used, []);
    assert.equal(posted.length, 1);
    faces = [5, 5, 5];
    assert.equal(await quickDraw(a, gun({ quickDraw: false }), { quickDraw95: true }), 'failed', 'no holster: TN 6');
    assert.deepEqual(a.used, ['draw']);
    assert.ok(text(posted[1]).includes('vs 6'));
  });
  test('the window: quick, draw first, or closed', async () => {
    const a = actor('a', { reaction: 2 });
    combat([combatant('1', a)]);
    let answer: any = 'draw';
    let asked: any = null;
    G.foundry.applications.api.DialogV2 = { wait: async (o: any) => { asked = o; return answer; } };
    assert.equal(await quickDraw(a, gun({ name: '<i>x</i>' }), {}), 'draw');
    assert.equal(String(asked.content).includes('<i>'), false, 'the weapon name is escaped');
    answer = null;
    assert.equal(await quickDraw(a, gun(), {}), 'cancel');
    answer = 'quick'; faces = [6, 6, 1, 1];
    assert.equal(await quickDraw(a, gun(), {}), 'quick');
  });
  test('wounds and a second firearm raise the TN; the Revamp rolls Quickness', async () => {
    const a = actor('a', { reaction: 1, wound: 1, quickness: 2 });
    combat([combatant('1', a)]);
    faces = [5];
    assert.equal(await quickDraw(a, gun(), { quickDraw95: true, situational: ['secondWeapon'] }), 'failed', '4 + 2 + 1 = 7');
    assert.ok(text(posted[0]).includes('vs 7'));
    (RULES.URR_V80 as any).active = true;
    faces = [4, 1];
    assert.equal(await quickDraw(a, gun({ quickDraw: false }), { quickDraw95: true }), 'failed', 'Quickness 2 dice vs 4 + the wound');
    assert.ok(text(posted[1]).includes('2 dice'));
  });
});

describe('v0.95.0 glue: subduing', () => {
  test('the Attack window\'s tick is disabled for a Physical weapon', () => {
    assert.equal(subdueBoxAttr({ damageType: 'stun' }), '');
    assert.ok(subdueBoxAttr({ damageType: 'physical' }).startsWith(' disabled title="'));
    RULES.MELEE_V95.subdue = 'any';
    assert.equal(subdueBoxAttr({ damageType: 'physical' }), '');
  });
  test('Hold on someone with a full Stun track takes control', async () => {
    const h = actor('h'), t = actor('t', { stun: 10 });
    assert.equal(await subdueHold(h, actor('u', { stun: 9 })), undefined, 'not subdued: the old hold');
    assert.equal(await subdueHold(h, t), 'held');
    assert.deepEqual(t.flags[NS].subdued95, { by: 'Actor.h', boxes: 10, total: 10, at: 1000 });
    assert.deepEqual(held, [['Actor.t', 'Actor.h', true]]);
    assert.ok(text(posted[0]).includes('release95'));
    assert.deepEqual(posted[0].flags[NS].subdue95, { holderUuid: 'Actor.h', targetUuid: 'Actor.t' });
    assert.equal(await subdueHold(actor('x'), t), undefined, 'someone else\'s captive: the old hold');
    RULES.MELEE_V95.subdueControl = 'off';
    assert.equal(await subdueHold(h, t), undefined);
  });
  test('Hold again is the maintenance test', async () => {
    const h = actor('h', { strength: 5, quickness: 3, unarmed: 2 }), t = actor('t', { stun: 7, strength: 3, quickness: 4, wound: 2 });
    t.flags[NS].subdued95 = { by: 'Actor.h', boxes: 7, total: 10, at: 400 };
    // The holder: 5 dice vs 2 (the held one's lowest: no Unarmed Combat); the held: 4 dice vs 2 + 2 wounds + 2.
    faces = [2, 2, 2, 1, 1, 6, 1, 1, 1, 3];
    assert.equal(await subdueHold(h, t), 'held');
    assert.deepEqual(h.used, ['hold']);
    assert.equal(t.system.monitor.stun, 9, '3 successes against 1: 2 boxes back');
    assert.deepEqual(t.flags[NS].subdued95, { by: 'Actor.h', boxes: 9, total: 10, at: 1000 });
    assert.ok(text(posted[0]).includes('vs 6'));
  });
  test('a player who can\'t write the held actor is refused without a GM', async () => {
    const h = actor('h'), t = actor('t', { stun: 10, isOwner: false });
    G.game.user = { id: 'p1', isGM: false };
    G.game.socket = { emit: () => {} };
    G.game.users = Object.assign([{ id: 'p1', isGM: false, active: true }], { get: () => null });
    assert.equal(await subdueHold(h, t), null);
    assert.equal(t.flags[NS].subdued95, undefined);
    assert.equal(warned.length, 1);
  });
  test('Let go: only the holder the actor\'s own state names', async () => {
    const h = actor('h'), other = actor('o', { isOwner: true }), t = actor('t', { stun: 8 });
    t.flags[NS].subdued95 = { by: 'Actor.h', boxes: 6, total: 10, at: 400 };
    const button: any = { disabled: false };
    // A card naming another holder changes nothing: the state on the held actor decides.
    h.isOwner = false;
    await onRelease95({ getFlag: () => ({ holderUuid: other.uuid, targetUuid: t.uuid }) }, button);
    assert.equal(t.system.monitor.stun, 8);
    assert.equal(warned.length, 1);
    h.isOwner = true;
    await onRelease95({ getFlag: () => ({ holderUuid: other.uuid, targetUuid: t.uuid }) }, button);
    assert.equal(t.system.monitor.stun, 2, 'the subduing Stun comes off');
    assert.equal(t.flags[NS].subdued95 ?? null, null);
    assert.deepEqual(held.at(-1), ['Actor.t', '', false]);
    await onRelease95({ getFlag: () => ({ targetUuid: t.uuid }) }, button);
    assert.equal(warned.length, 2, 'nobody held any more');
  });
});

describe('v0.95.0 glue: against a wall', () => {
  const tokenAt = (x: number, y: number) => ({ center: { x, y } });
  function hit(target: any, attacker: any): void {
    G.game.messages.contents = [{ getFlag: (_n: string, k: string) => (k === 'attack' ? { attackerUuid: attacker.uuid, targetUuid: target.uuid, melee: true } : undefined) }];
  }
  test('a wall straight behind: the status and +2', async () => {
    const a = actor('a'), t = actor('t');
    a.tokenObj = tokenAt(0, 0); t.tokenObj = tokenAt(100, 0);
    hit(t, a);
    let tested: any = null;
    G.CONFIG.Canvas.polygonBackends.move.testCollision = (p: any, q: any) => { tested = [p, q]; return true; };
    assert.equal(await staggered(t, 1), true);
    assert.deepEqual(tested, [{ x: 100, y: 0 }, { x: 200, y: 0 }], '1 m straight back from the attacker');
    assert.ok(t.statuses.has(M.WALL_STATUS));
    assert.deepEqual(wallMods(t).map((m) => m.value), [2]);
    assert.equal(posted.length, 1);
    assert.equal(await staggered(t, 1), false, 'already against it');
  });
  test('no wall, no attacker, or the rule off: nothing', async () => {
    const a = actor('a'), t = actor('t');
    a.tokenObj = tokenAt(0, 0); t.tokenObj = tokenAt(100, 0);
    assert.equal(await staggered(t, 1), false, 'nobody hit them');
    hit(t, a);
    assert.equal(await staggered(t, 1), false, 'open ground');
    G.CONFIG.Canvas.polygonBackends.move.testCollision = () => true;
    RULES.MELEE_V95.wall = 'off';
    assert.equal(await staggered(t, 1), false);
    assert.deepEqual(wallMods(t), []);
  });
  test('a counterattack: the one who attacked is knocked away from the defender', async () => {
    const a = actor('a'), t = actor('t');
    a.tokenObj = tokenAt(0, 0); t.tokenObj = tokenAt(100, 0);
    hit(t, a);
    let q: any = null;
    G.CONFIG.Canvas.polygonBackends.move.testCollision = (_p: any, to: any) => { q = to; return true; };
    assert.equal(await staggered(a, 1), true);
    assert.deepEqual(q, { x: -100, y: 0 });
  });
});

describe('v0.95.0 glue: interception', () => {
  function fight(o: any = {}) {
    const scene: any = { id: 's1', grid: { size: 100, distance: 1, units: 'm' } };
    const mk = (id: string, x: number, y: number, a: any, disposition: number, extra: any = {}) => {
      const token: any = { id: `t${id}`, x, y, width: 1, height: 1, parent: scene, disposition, hidden: false, ...extra };
      return combatant(id, a, { token });
    };
    const mover = mk('m', 900, 0, actor('m', { player: true, name: 'Runner' }), 1);
    const guard = mk('g', 400, 100, actor('g', { name: 'Guard', owners: ['p1'], ...o.guard }), -1, o.guardToken ?? {});
    const ally = mk('y', 600, 100, actor('y', { player: true }), 1);
    const c = combat([mover, guard, ally], { scene });
    return { c, mover, guard, scene };
  }
  const moved = (f: any, from = { x: 0, y: 0 }) => watchMove(f.mover.token, { x: f.mover.token.x }, { sr2eFrom95: from });
  test('passing an opponent whispers the offer to their owners and the GM', async () => {
    const f = fight();
    assert.equal(await moved(f), 1);
    assert.deepEqual(posted[0].whisper.sort(), ['gm', 'p1']);
    assert.ok(text(posted[0]).includes('data-sr2e-action="intercept95"'));
    assert.deepEqual(posted[0].flags[NS].intercept95, { interceptorUuid: 'Actor.g', moverUuid: 'Actor.m', tokenId: 'tm', sceneId: 's1' });
    assert.equal(await moved(f), 0, 'once per phase');
    f.c.pass = 1;
    assert.equal(await moved(f), 1);
  });
  test('no offer: not a fight, no start point, a hidden mover, the rule off, someone who can\'t attack', async () => {
    let f = fight();
    f.c.started = false;
    assert.equal(await moved(f), 0);
    f = fight();
    assert.equal(await watchMove(f.mover.token, { x: 900 }, {}), 0, 'nowhere to start from');
    f.mover.token.x = 0;
    assert.equal(await watchMove(f.mover.token, { x: 0 }, {}), 1, 'the start from what this client saw last');
    posted = []; f = fight();
    assert.equal(await watchMove(f.mover.token, { elevation: 2 }, { sr2eFrom95: { x: 0, y: 0 } }), 0);
    f.mover.token.hidden = true;
    assert.equal(await moved(f), 0);
    f = fight({ guard: { status: 'unconscious' } });
    assert.equal(await moved(f), 0);
    f = fight({ guard: { reaction: 2, wound: 3 } });
    assert.equal(await moved(f), 0, 'Reaction 0 from wounds');
    f = fight();
    RULES.MELEE_V95.interception = 'off';
    assert.equal(await moved(f), 0);
    assert.equal(posted.length, 0);
  });
  test('a hidden interceptor is offered to the GM only; stopping beside them is no offer', async () => {
    let f = fight({ guardToken: { hidden: true } });
    assert.equal(await moved(f), 1);
    assert.deepEqual(posted[0].whisper, ['gm']);
    f = fight();
    f.mover.token.x = 400; f.mover.token.y = 0;
    assert.equal(await moved(f, { x: 0, y: 0 }), 0);
  });
  test('the button: a GM\'s card, the interceptor\'s owner, the mover targeted, the melee attack opened', async () => {
    const f = fight();
    const g = f.guard.actor;
    g.items = [{ id: 'gun', type: 'weapon', system: { melee: false } }, { id: 'holstered', type: 'weapon', system: { melee: true, ready: false } }, { id: 'club', type: 'weapon', system: { melee: true, ready: true } }];
    const flags = { interceptorUuid: g.uuid, moverUuid: 'Actor.m', tokenId: 'tm', sceneId: 's1' };
    const msg = (isGM: boolean) => ({ author: { isGM }, getFlag: () => flags });
    const button: any = { disabled: false };
    let targeted = 0;
    G.canvas.tokens.get = (id: string) => (id === 'tm' ? { setTarget: () => { targeted++; } } : null);
    await onIntercept95(msg(false), button);
    assert.equal(sheetRuns.length, 0, 'a player\'s card does nothing');
    g.isOwner = false;
    await onIntercept95(msg(true), button);
    assert.equal(sheetRuns.length, 0, 'not the interceptor\'s owner');
    g.isOwner = true;
    await onIntercept95(msg(true), button);
    assert.equal(targeted, 1);
    assert.deepEqual(sheetRuns[0].slice(1), ['attackWeapon', { itemId: 'club' }]);
    assert.equal(sheetRuns[0][0], g);
    g.items = [];
    await onIntercept95(msg(true), button);
    assert.deepEqual(sheetRuns[1][2], { itemId: 'unarmed' });
    assert.equal(warned.length, 2);
  });
});

describe('v0.95.0 glue: the other pools at each action', () => {
  test('the pools refresh; spell defense going back is said to the owners and the GM', async () => {
    const a = actor('a', { poolSpent: { combat: 2, spell: 3, hacking: 1, task: 0, control: 4 }, spellDefense: 2, owners: ['p1'] });
    await refreshActionPools(a);
    assert.deepEqual(a.system.poolSpent, { combat: 2, spell: 0, hacking: 0, task: 0, control: 4 });
    assert.equal(a.system.spellDefense, 0);
    assert.equal(posted.length, 1);
    assert.deepEqual(posted[0].whisper.sort(), ['gm', 'p1']);
    assert.ok(text(posted[0]).includes('2 spell defense dice'));
    await refreshActionPools(a);
    assert.equal(posted.length, 1, 'nothing spent: nothing said');
  });
  test('the switch at turn: nothing here', async () => {
    RULES.MELEE_V95.otherPools = 'turn';
    const a = actor('a', { poolSpent: { spell: 3 }, spellDefense: 2 });
    await refreshActionPools(a);
    assert.equal(a.system.poolSpent.spell, 3);
    assert.equal(posted.length, 0);
  });
});
