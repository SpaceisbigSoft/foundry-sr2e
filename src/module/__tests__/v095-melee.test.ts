/**
 * v0.95.0 rules completeness (melee, actions, Dice Pools): the pure rules (rules/melee95.ts, RULES.MELEE_V95).
 */
import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RULES } from '../rules/config.ts';
import { MELEE_V95, HOUSE_MELEE_V95 } from '../rules/config95/melee.ts';
import { actionBar, type ActionFacts } from '../rules/actions935.ts';
import * as M from '../rules/melee95.ts';

const ROOT = join(import.meta.dirname, '..', '..', '..');
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), 'utf8');
const saved = JSON.parse(JSON.stringify(RULES.MELEE_V95));
const savedUrr = RULES.URR_V80.active;
const savedRefresh = RULES.COMBAT_V923.poolRefresh;
afterEach(() => { Object.assign(RULES.MELEE_V95, JSON.parse(JSON.stringify(saved))); (RULES.URR_V80 as any).active = savedUrr; RULES.COMBAT_V923.poolRefresh = savedRefresh; });
const set = (o: Partial<typeof RULES.MELEE_V95>) => Object.assign(RULES.MELEE_V95, o);

describe('v0.95.0 melee: the switches', () => {
  test('RULES.MELEE_V95 is the config object; the book is the default', () => {
    assert.equal(RULES.MELEE_V95, MELEE_V95);
    assert.deepEqual({ r: MELEE_V95.reactionOut, q: MELEE_V95.quickDraw, s: MELEE_V95.totalSurprise, d: MELEE_V95.subdue, c: MELEE_V95.subdueControl, w: MELEE_V95.wall, i: MELEE_V95.interception, p: MELEE_V95.otherPools },
      { r: 'book', q: 'test', s: 'book', d: 'stunOnly', c: 'book', w: 'book', i: 'offer', p: 'action' });
    assert.deepEqual([MELEE_V95.quickDrawTn, MELEE_V95.quickDrawNoHolsterTn, MELEE_V95.quickDrawSecondTn, MELEE_V95.quickDrawConceal, MELEE_V95.wallTn, MELEE_V95.wallMetres, MELEE_V95.interceptMetres, MELEE_V95.subdueReleaseSeconds, MELEE_V95.subdueResistTn], [4, 2, 2, 4, 2, 1, 1, 60, 2]);
  });
  test('every house-rule row names a real switch, its first choice the default', () => {
    for (const row of HOUSE_MELEE_V95) {
      const key = row.path.replace('MELEE_V95.', '') as keyof typeof MELEE_V95;
      assert.ok(key in MELEE_V95, row.path);
      if (row.type === 'select') assert.equal(row.choices?.[0], MELEE_V95[key], row.path);
      else assert.equal(typeof MELEE_V95[key], 'number', row.path);
    }
    for (const k of ['reactionOut', 'quickDraw', 'totalSurprise', 'subdue', 'subdueControl', 'wall', 'interception', 'otherPools']) assert.ok(HOUSE_MELEE_V95.some((r) => r.path === `MELEE_V95.${k}`), k);
  });
});

describe('v0.95.0 no actions (Core pp. 86, 112)', () => {
  test('Reaction at 0 or less by the wound modifier', () => {
    assert.equal(M.reactionOut({ base: 3, minus: 3 }), true);
    assert.equal(M.reactionOut({ base: 2, minus: 3 }), true);
    assert.equal(M.reactionOut({ base: 4, minus: 3 }), false);
    assert.equal(M.reactionOut({ base: 0, minus: 0 }), false, 'no wound, no rule');
    assert.equal(M.reactionOut(null), false);
    set({ reactionOut: 'off' });
    assert.equal(M.reactionOut({ base: 1, minus: 3 }), false);
  });
  test('the reason: only in a fight; surprise first', () => {
    assert.equal(M.noActionsWhy({ inFight: false, reactionOut: true, surprised: true }), '');
    assert.equal(M.noActionsWhy({ inFight: true, reactionOut: true, surprised: false }), M.NO_ACTIONS.reaction);
    assert.equal(M.noActionsWhy({ inFight: true, reactionOut: true, surprised: true }), M.NO_ACTIONS.surprised);
    assert.equal(M.noActionsWhy({ inFight: true, reactionOut: false, surprised: false }), '');
    set({ totalSurprise: 'off', reactionOut: 'off' });
    assert.equal(M.noActionsWhy({ inFight: true, reactionOut: true, surprised: true }), '');
    assert.equal(M.isNoActionsWhy(M.NO_ACTIONS.reaction), true);
    assert.equal(M.isNoActionsWhy('SR2E.App.Sheets.whyNoSpells'), false);
  });
  test('the action bar greys everything but Initiative, with the reason', () => {
    const f: ActionFacts = {
      actorType: 'character', combat: true, combatStarted: true, acting: true, delaying: false, actingNow: false, fullDefenseUp: false, spells: 2, caster: true, conjuring: true, astral: false,
      ammoWeapons: 1, jammed: [{ id: 'w', name: 'Gun' }], rigger: false, vehicle: false, jammer: false, droneLink: false, decks: 0, deckActive: false, jackedIn: false, riding: false, hitchAvailable: false,
      onFire: false, held: false, prone: true, bypass: false, rallySkill: false, morale: false,
    };
    const free = actionBar(f);
    assert.ok(free.find((a) => a.action === 'quickAttack')?.enabled);
    const bar = actionBar({ ...f, noActions: M.NO_ACTIONS.reaction });
    assert.deepEqual(bar.map((a) => a.action), free.map((a) => a.action), 'nothing moves');
    for (const a of bar) {
      if (a.action === 'rollInit') assert.equal(a.enabled, true);
      else { assert.equal(a.enabled, false, a.action); assert.ok(a.why, a.action); }
    }
    assert.equal(bar.find((a) => a.action === 'quickAttack')?.why, M.NO_ACTIONS.reaction);
    assert.equal(bar.find((a) => a.action === 'assense')?.why, 'SR2E.App.Sheets.whyNotAstral', 'an action greyed for its own reason keeps it');
    assert.deepEqual(actionBar({ ...f, noActions: '' }), free);
  });
});

describe('v0.95.0 surprise (Core p. 86)', () => {
  const e = (id: string, side: string, successes: number) => ({ id, side, successes });
  test('completely surprised: beats no opponent, beaten by one', () => {
    const list = [e('a', '1', 0), e('b', '1', 3), e('x', '-1', 2), e('y', '-1', 1)];
    assert.deepEqual(M.totallySurprised(list), ['a']);
    assert.deepEqual(M.totallySurprised([e('a', '1', 2), e('x', '-1', 2)]), [], 'a tie with everyone: nobody beat them');
    assert.deepEqual(M.totallySurprised([e('a', '1', 1), e('x', '-1', 1), e('y', '-1', 3)]), ['a'], 'ties one opponent, beaten by another');
    assert.deepEqual(M.totallySurprised([e('a', '1', 0), e('b', '1', 5)]), ['a'], 'one side only: everyone else is an opponent');
    assert.deepEqual(M.totallySurprised([e('a', '1', 0)]), []);
  });
  test('an ally who rolled better is no opponent', () => {
    assert.deepEqual(M.totallySurprised([e('a', '1', 1), e('b', '1', 4), e('x', '-1', 0)]), ['x']);
  });
  test('off, and under the Revamp, there is none', () => {
    const list = [e('a', '1', 0), e('x', '-1', 2)];
    set({ totalSurprise: 'off' });
    assert.deepEqual(M.totallySurprised(list), []);
    set({ totalSurprise: 'book' });
    (RULES.URR_V80 as any).active = true;
    assert.deepEqual(M.totallySurprised(list), []);
    assert.equal(M.totalSurpriseOn(), false);
    assert.equal(M.reactionOutOn(), true, 'the Revamp is silent on Reaction 0');
  });
  test('the target limit leaves allies alone when sides can be told', () => {
    const blocked = [{ id: 'ally', s: '1' }, { id: 'foe', s: '-1' }];
    assert.deepEqual(M.blockedOpponents('1', blocked, (t) => t.s, ['1', '1', '-1']).map((t) => t.id), ['foe']);
    assert.deepEqual(M.blockedOpponents('1', blocked, (t) => t.s, ['1', '1']).map((t) => t.id), ['ally', 'foe'], 'one disposition for all: as before');
    set({ totalSurprise: 'off' });
    assert.deepEqual(M.blockedOpponents('1', blocked, (t) => t.s, ['1', '-1']).map((t) => t.id), ['ally', 'foe']);
  });
  test('sides: player characters with the friendly disposition', () => {
    assert.equal(M.sideOf({ playerOwned: true, disposition: -1 }), '1');
    assert.equal(M.sideOf({ playerOwned: false, disposition: -1 }), '-1');
    assert.equal(M.sideOf({ playerOwned: false, disposition: undefined }), '0');
  });
});

describe('v0.95.0 quick draw (Core p. 82)', () => {
  test('which weapons: a pistol-sized firearm fired with a Simple Action', () => {
    const pistol = { melee: false, concealability: 5, mode: 'SA' };
    assert.equal(M.quickDrawEligible(pistol), true);
    assert.equal(M.quickDrawEligible({ ...pistol, concealability: 4, mode: 'BF' }), true);
    assert.equal(M.quickDrawEligible({ ...pistol, concealability: 3 }), false, 'too big');
    assert.equal(M.quickDrawEligible({ ...pistol, mode: 'FA' }), false, 'full auto is a Complex Action');
    assert.equal(M.quickDrawEligible({ ...pistol, melee: true }), false);
    assert.equal(M.quickDrawEligible({ ...pistol, blast: true }), false);
    assert.equal(M.quickDrawEligible({ ...pistol, concealability: 0 }), false, 'no Concealability set');
    set({ quickDraw: 'holster' });
    assert.equal(M.quickDrawEligible(pistol), false);
  });
  test('the test: Reaction vs 4, +2 no holster, +2 a second firearm', () => {
    assert.deepEqual(M.quickDrawPlan({ holster: true }), { attribute: 'reaction', tn: 4, modifiers: [] });
    assert.equal(M.quickDrawPlan({ holster: false }).tn, 6);
    assert.equal(M.quickDrawPlan({ holster: false, second: true }).tn, 8);
    assert.deepEqual(M.quickDrawPlan({ holster: true, second: true }).modifiers, [{ id: 'secondWeapon', value: 2 }]);
    assert.equal(M.quickDrawCleared(1), true);
    assert.equal(M.quickDrawCleared(0), false);
  });
  test('the Revamp: Quickness vs 4, no modifiers', () => {
    (RULES.URR_V80 as any).active = true;
    assert.deepEqual(M.quickDrawPlan({ holster: false, second: true }), { attribute: 'quickness', tn: 4, modifiers: [] });
  });
  test('a quick-draw holster draws for free only the old way', () => {
    assert.equal(M.freeDraw({ quickDraw: true }), false);
    set({ quickDraw: 'holster' });
    assert.equal(M.freeDraw({ quickDraw: true }), true);
    assert.equal(M.freeDraw({ quickDraw: false }), false);
    assert.equal(M.freeDraw(null), false);
  });
  test('the card note is swapped', () => {
    assert.equal(M.swapNote('aimed, drawn', 'drawn', 'quick'), 'aimed, quick');
    assert.equal(M.swapNote(undefined, 'drawn', 'quick'), 'quick');
  });
});

describe('v0.95.0 subduing (Core p. 103)', () => {
  test('only Stun weapons subdue by the book', () => {
    assert.equal(M.subdueAllowed({ damageType: 'stun' }), true);
    assert.equal(M.subdueAllowed({ damageType: 'physical', stunWeapon: true }), true);
    assert.equal(M.subdueAllowed({ damageType: 'physical' }), false);
    assert.equal(M.subdueAllowed(null), false);
    set({ subdue: 'any' });
    assert.equal(M.subdueAllowed({ damageType: 'physical' }), true);
  });
  test('the maintenance test: the best of three against the other\'s lowest', () => {
    const p = M.maintainPlan({ unarmed: 2, strength: 6, quickness: 4 }, { unarmed: 0, strength: 3, quickness: 5 });
    assert.deepEqual(p.holder, { kind: 'strength', dice: 6, tn: 2 }, 'their lowest is 0: the minimum TN');
    assert.deepEqual(p.held, { kind: 'quickness', dice: 5, tn: 2, plus: 2 });
    assert.deepEqual(M.bestRating({ unarmed: 4, strength: 4, quickness: 4 }), { kind: 'unarmed', dice: 4 });
    assert.equal(M.lowestRating({ unarmed: 5, strength: 4, quickness: 6 }), 4);
  });
  test('the Stun wears off a box a minute', () => {
    const s = { by: 'Actor.h', boxes: 10, at: 1000 };
    assert.deepEqual(M.subdueWearOff(s, 1059, 10), { off: 0, left: s });
    assert.deepEqual(M.subdueWearOff(s, 1060, 10), { off: 1, left: { by: 'Actor.h', boxes: 9, at: 1060 } });
    assert.deepEqual(M.subdueWearOff(s, 1000 + 60 * 3 + 30, 10), { off: 3, left: { by: 'Actor.h', boxes: 7, at: 1180 } });
    assert.deepEqual(M.subdueWearOff(s, 1000 + 60 * 50, 10), { off: 10, left: null });
    assert.deepEqual(M.subdueWearOff({ ...s, boxes: 4 }, 1000 + 600, 2), { off: 2, left: null }, 'never more than the Stun there is');
  });
  test('each net success puts back a box that wore off', () => {
    const state = { by: 'Actor.h', boxes: 6, at: 1000 };
    assert.deepEqual(M.maintainOutcome({ holder: 3, held: 1, state, total: 10, now: 2000, stun: 6 }), { net: 2, restored: 2, state: { by: 'Actor.h', boxes: 8, at: 2000 } });
    assert.deepEqual(M.maintainOutcome({ holder: 9, held: 0, state, total: 10, now: 2000, stun: 6 }).restored, 4, 'never past what the subduing did');
    assert.deepEqual(M.maintainOutcome({ holder: 1, held: 2, state, total: 10, now: 2000, stun: 6 }), { net: 0, restored: 0, state }, 'no net successes: the clock runs on');
    assert.equal(M.maintainOutcome({ holder: 3, held: 0, state: { ...state, boxes: 10 }, total: 10, now: 2000, stun: 10 }).state.at, 2000, 'nothing to restore still keeps control');
  });
  test('a stored state is cleaned', () => {
    assert.equal(M.subduedOf(null), null);
    assert.equal(M.subduedOf({ boxes: 3 }), null);
    assert.deepEqual(M.subduedOf({ by: 'Actor.h', boxes: 99, at: '5', extra: 1 }), { by: 'Actor.h', boxes: 10, at: 5 });
  });
});

describe('v0.95.0 knocked back into a wall (Core p. 102)', () => {
  test('the point straight back from the attacker', () => {
    assert.deepEqual(M.backPoint({ x: 0, y: 0 }, { x: 100, y: 0 }, 1, 50), { x: 150, y: 0 });
    const d = M.backPoint({ x: 0, y: 0 }, { x: 30, y: 40 }, 2, 50)!;
    assert.ok(Math.abs(d.x - 90) < 1e-9 && Math.abs(d.y - 120) < 1e-9);
    assert.equal(M.backPoint({ x: 5, y: 5 }, { x: 5, y: 5 }, 1, 50), null);
    assert.equal(M.wallReach(1), 1);
    assert.equal(M.wallReach(3), 3);
  });
  test('+2 while against the wall', () => {
    assert.deepEqual(M.wallModifiers(true, 'Wall'), [{ id: 'againstWall95', label: 'Wall', value: 2 }]);
    assert.deepEqual(M.wallModifiers(false, 'Wall'), []);
    set({ wall: 'off' });
    assert.deepEqual(M.wallModifiers(true, 'Wall'), []);
  });
});

describe('v0.95.0 interception (Core p. 83)', () => {
  const foe = (x: number, y: number, o: Partial<M.Bystander> = {}): M.Bystander => ({ id: 'foe', x, y, side: '-1', canMelee: true, bodyMetres: 1, ...o });
  const move = (others: M.Bystander[], to = { x: 1000, y: 0 }, o: Record<string, unknown> = {}) => M.interceptors({ from: { x: 0, y: 0 }, to, moverSide: '1', pxPerMetre: 100, others, sidesTold: true, ...o });
  test('the distance from a point to the path', () => {
    assert.equal(M.distanceToPath({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 3 }), 3);
    assert.equal(M.distanceToPath({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 14, y: 3 }), 5);
    assert.equal(M.distanceToPath({ x: 2, y: 2 }, { x: 2, y: 2 }, { x: 2, y: 6 }), 4);
  });
  test('passing within 1 m of an opponent (bodies counted)', () => {
    assert.deepEqual(move([foe(500, 200)]), ['foe'], '2 m centre to centre: 1 m between the bodies');
    assert.deepEqual(move([foe(500, 201)]), []);
    assert.deepEqual(move([foe(500, 100, { side: '1' })]), [], 'an ally');
    assert.deepEqual(move([foe(500, 100, { canMelee: false })]), [], 'can\'t attack');
    assert.deepEqual(M.interceptors({ from: { x: 0, y: 0 }, to: { x: 1000, y: 0 }, moverSide: '1', pxPerMetre: 100, others: [foe(500, 100, { side: '1' })], sidesTold: false }), ['foe'], 'sides unknown: everyone');
  });
  test('stopping beside them is not passing; leaving them is', () => {
    assert.deepEqual(move([foe(1000, 100)]), [], 'the move ends beside them');
    assert.deepEqual(move([foe(0, 100)]), ['foe'], 'the move starts beside them');
    assert.deepEqual(move([foe(500, 100)], { x: 600, y: 0 }, { end: { x: 600, y: 900 } }), ['foe'], 'a leg of a longer move');
    assert.deepEqual(move([foe(500, 100)], { x: 0, y: 0 }), [], 'no move');
  });
  test('off: nobody', () => {
    set({ interception: 'off' });
    assert.deepEqual(move([foe(500, 100)]), []);
  });
  test('one offer per mover, interceptor and phase', () => {
    assert.equal(M.offerKey({ moverId: 'm', interceptorId: 'i', round: 2, pass: 1 }), 'm|i|2|1');
  });
});

describe('v0.95.0 the other Dice Pools (Core p. 84)', () => {
  const OLD = { 'system.poolSpent.spell': 0, 'system.poolSpent.spellConc': 0, 'system.poolSpent.spellSpec': 0, 'system.poolSpent.hacking': 0, 'system.poolSpent.control': 0, 'system.poolSpent.task': 0, 'system.spellDefense': 0 };
  const full = () => ({ 'system.poolSpent.combat': 0, ...OLD });
  test('the new Combat Turn: the old update when the switch is at turn', () => {
    set({ otherPools: 'turn' });
    assert.deepEqual(M.turnRefresh(full(), false), full());
    assert.deepEqual(M.turnRefresh({ ...OLD }, true), OLD);
  });
  test('per action: only the Control Pool refreshes at the new Combat Turn', () => {
    assert.equal(M.otherPoolsPerAction(), true);
    assert.deepEqual(M.turnRefresh({ ...OLD }, true), { 'system.poolSpent.control': 0 });
    assert.deepEqual(M.turnRefresh(full(), false), full(), 'a plain refresh (no fight running) still clears everything');
  });
  test('it follows the Combat Pool\'s switch, and the Revamp keeps the turn', () => {
    RULES.COMBAT_V923.poolRefresh = 'turn';
    assert.equal(M.otherPoolsPerAction(), false);
    RULES.COMBAT_V923.poolRefresh = 'action';
    (RULES.URR_V80 as any).active = true;
    assert.equal(M.otherPoolsPerAction(), false);
    assert.equal(M.actionRefreshUpdate({ poolSpent: { spell: 3 }, spellDefense: 2 }), null);
  });
  test('the start of an action: the Spell, Hacking and Task Pools, spell defense back to the pool', () => {
    assert.deepEqual(M.actionRefreshUpdate({ poolSpent: { combat: 4, spell: 3, spellConc: 0, spellSpec: 1, hacking: 2, control: 5, task: 1 }, spellDefense: 2 }),
      { update: { 'system.poolSpent.spell': 0, 'system.poolSpent.spellSpec': 0, 'system.poolSpent.hacking': 0, 'system.poolSpent.task': 0, 'system.spellDefense': 0 }, defenseBack: 2 });
    assert.equal(M.actionRefreshUpdate({ poolSpent: { combat: 4, control: 5, spell: 0 }, spellDefense: 0 }), null, 'nothing spent: no write (the Control Pool is left alone)');
    assert.equal(M.actionRefreshUpdate({ poolSpent: null }), null);
    set({ otherPools: 'turn' });
    assert.equal(M.actionRefreshUpdate({ poolSpent: { spell: 3 }, spellDefense: 2 }), null);
  });
});

describe('v0.95.0 melee: wiring', () => {
  const index = read('src', 'module', 'documents', 'index.ts');
  test('the pure file has no Foundry globals', () => {
    const src = read('src', 'module', 'rules', 'melee95.ts');
    for (const word of ['game.', 'canvas', 'Hooks', 'ChatMessage', 'ui.notifications', 'fromUuid']) assert.equal(src.includes(word), false, word);
  });
  test('the documents call into the rule at each place', () => {
    for (const call of ['G95.noActionsRefusal(this, what)', 'G95.wallMods(this)', 'M95.subdueAllowed(', 'G95.quickDraw(this, weapon, opts)', 'G95.subdueHold(this, t)', 'G95.staggered(this, kd80.staggerMetres)',
      'M95.turnRefresh({', 'G95.takesNoTurn(c.actor)', 'G95.surpriseOpponents(this, attacker,', 'G95.totallySurprisedIn(this, entries)', 'G95.refreshActionPools(c.actor)', 'M95.freeDraw(weapon.system)']) {
      assert.ok(index.includes(call), call);
    }
  });
  test('the chat buttons, the relay op and the hooks are registered', () => {
    const chat = read('src', 'module', 'applications', 'chat.ts');
    assert.ok(chat.includes("action === 'intercept95'") && chat.includes("action === 'release95'"));
    assert.ok(read('src', 'module', 'applications', 'socket.ts').includes("'melee95'"));
    assert.ok(read('src', 'module', 'sr2e-system.ts').includes('registerMelee95()'));
    assert.ok(read('src', 'module', 'applications', 'interface.ts').includes('greyNoActions(actor, body)'));
    assert.ok(read('src', 'module', 'applications', 'tokens.ts').includes('trackerNotes95(combat)'));
  });
  test('no flag is unset the old way in the glue', () => {
    const glue = read('src', 'module', 'applications', 'melee95.ts');
    assert.equal(/unsetFlag|\.-=/.test(glue), false);
    assert.ok(glue.includes('authorIsGm(message)'), 'the interception button checks the card\'s author');
  });
});
