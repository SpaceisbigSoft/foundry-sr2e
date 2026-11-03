import { test, describe } from 'node:test';
import assert from '../../__tests__/helpers/assert-rows.ts';
import { RULES } from '../config.ts';
import {
  tallyKeyFor, advanceDeckerTally, highestTally, deckerTallyOf,
  loadSpeedOf, loadTurns, loadingDue, loadingDone, swapMemoryPlan,
  matrixWoundModifiers, holdingIc, jackOutTest, shutdownDue,
  dumpShockLevel, icInitiative, icAttackDiceFor,
  perceptionTarget, perceptionDice, analyzeReveals,
  maneuverSides, maneuverOutcome, maneuverEntry, activeManeuvers, positionBonus, parryPenalty, evadedBy, consumePosition,
  slowEffect, restorePlan, validatedDf, bombBlast, touchesFile,
  placeCall, tapCall, rerouteCall, endCall, realityFilterTest, realityFilterEffect,
  hitcherRoom, chipPlayable, chipBehaviour,
  type HoldingIc, type Maneuver,
} from '../datawar.ts';
import type { SheafStep } from '../matrix.ts';

const V = (RULES as any).MATRIX_V57;

/** Set a MATRIX_V57 sub-value for the duration of fn. */
function withRule(path: string[], value: unknown, fn: () => void): void {
  let o = V;
  for (const k of path.slice(0, -1)) o = o[k];
  const last = path[path.length - 1]!;
  const old = o[last];
  o[last] = value;
  try { fn(); } finally { o[last] = old; }
}

const sheaf: SheafStep[] = [
  { step: 4, event: 'passive', alert: 'passive' },
  { step: 8, event: 'active', alert: 'active' },
];

describe('per-decker tally', () => {
  test('tallyKeyFor', () => {
    assert.equal(tallyKeyFor({ deckerUuid: 'D' }), 'D');
    assert.equal(tallyKeyFor({ deckerUuid: 'D', frame: null }), 'D');
    assert.equal(tallyKeyFor({ deckerUuid: 'D', frame: { uuid: 'F', kind: 'frame', ownerUuid: 'O' } }), 'O');
    assert.equal(tallyKeyFor({ deckerUuid: 'D', frame: { uuid: 'A', kind: 'agent', ownerUuid: 'O' } }), 'A');
    withRule(['tally', 'agentTally'], 'owner', () => {
      assert.equal(tallyKeyFor({ deckerUuid: 'D', frame: { uuid: 'A', kind: 'agent', ownerUuid: 'O' } }), 'O');
    });
  });
  test('advanceDeckerTally creates, advances and triggers per key', () => {
    const r1 = advanceDeckerTally([], 'a', 'Alice', 5, sheaf);
    assert.deepEqual(r1.tallies, [{ key: 'a', name: 'Alice', tally: 5 }]);
    assert.equal(r1.before, 0);
    assert.equal(r1.after, 5);
    assert.deepEqual(r1.triggered.map((s) => s.step), [4]);
    const r2 = advanceDeckerTally(r1.tallies, 'b', 'Bob', 2, sheaf);
    assert.deepEqual(r2.triggered, []);
    assert.equal(r2.highest, 5);
    const r3 = advanceDeckerTally(r2.tallies, 'b', 'Bob', 7, sheaf);
    assert.equal(r3.before, 2);
    assert.equal(r3.after, 9);
    assert.deepEqual(r3.triggered.map((s) => s.step), [4, 8]);
    assert.equal(r3.highest, 9);
    assert.equal(r1.tallies.length, 1, 'input not mutated');
  });
  test('zero successes change nothing', () => {
    const t = [{ key: 'a', name: 'A', tally: 3 }];
    const r = advanceDeckerTally(t, 'a', 'A', 0, sheaf);
    assert.equal(r.after, 3);
    assert.deepEqual(r.triggered, []);
    assert.equal(r.highest, 3);
    assert.notEqual(r.tallies, t);
  });
  test('highestTally and deckerTallyOf', () => {
    assert.equal(highestTally([]), 0);
    assert.equal(highestTally([{ key: 'a', name: '', tally: 2 }, { key: 'b', name: '', tally: 6 }]), 6);
    assert.equal(deckerTallyOf([{ key: 'a', name: '', tally: 2 }], 'a'), 2);
    assert.equal(deckerTallyOf([], 'x'), 0);
  });
});

describe('loading utilities', () => {
  test('loadSpeedOf', () => {
    assert.equal(loadSpeedOf({ loadSpeed: 20, ioSpeed: 50 }), 20);
    assert.equal(loadSpeedOf({ loadSpeed: 0, ioSpeed: 50 }), 50);
    assert.equal(loadSpeedOf({}), 0);
    withRule(['loading', 'fromIo'], false, () => assert.equal(loadSpeedOf({ ioSpeed: 50 }), 0));
  });
  test('loadTurns', () => {
    assert.equal(loadTurns(0, 10), 0);
    assert.equal(loadTurns(25, 10), 3);
    assert.equal(loadTurns(20, 10), 2);
    assert.equal(loadTurns(1, 100), 1);
    assert.equal(loadTurns(25, 0), 1);
  });
  test('loadingDue and loadingDone', () => {
    assert.deepEqual(loadingDue({ round: 2, worldTime: 100 }, 3), { round: 5, worldTime: 109 });
    assert.deepEqual(loadingDue({ round: null, worldTime: 100 }, 3), { round: -1, worldTime: 109 });
    assert.equal(loadingDone({ round: -1, worldTime: -1 }, {}), true);
    assert.equal(loadingDone({ round: 5, worldTime: 109 }, { round: 4, worldTime: 200 }), false);
    assert.equal(loadingDone({ round: 5, worldTime: 109 }, { round: 5, worldTime: 0 }), true);
    assert.equal(loadingDone({ round: -1, worldTime: 109 }, { round: 9, worldTime: 108 }), false);
    assert.equal(loadingDone({ round: -1, worldTime: 109 }, { round: null, worldTime: 109 }), true);
  });
  test('swapMemoryPlan', () => {
    const now = { round: 1, worldTime: 0 };
    assert.deepEqual(swapMemoryPlan({ jackedIn: true, load: false, size: 30, loadSpeed: 10, now }), { instant: true, turns: 0, due: null, action: 'free' });
    assert.equal(swapMemoryPlan({ jackedIn: false, load: true, size: 30, loadSpeed: 10, now }).instant, true);
    const p = swapMemoryPlan({ jackedIn: true, load: true, size: 30, loadSpeed: 10, now });
    assert.deepEqual(p, { instant: false, turns: 3, due: { round: 4, worldTime: 9 }, action: 'simple' });
    withRule(['loading', 'freeOffline'], false, () => assert.equal(swapMemoryPlan({ jackedIn: false, load: true, size: 30, loadSpeed: 10, now }).instant, false));
    withRule(['loading', 'enabled'], false, () => assert.equal(swapMemoryPlan({ jackedIn: true, load: true, size: 30, loadSpeed: 10, now }).instant, true));
    withRule(['loading', 'action'], 'complex', () => assert.equal(swapMemoryPlan({ jackedIn: true, load: true, size: 30, loadSpeed: 10, now }).action, 'complex'));
  });
});

describe('Matrix wounds', () => {
  test('bands', () => {
    assert.deepEqual(matrixWoundModifiers(0), []);
    assert.deepEqual(matrixWoundModifiers(1), [{ label: 'Matrix damage', value: 1 }]);
    assert.deepEqual(matrixWoundModifiers(4, { who: 'Ace' }), [{ label: "Ace's Matrix damage", value: 2 }]);
    assert.deepEqual(matrixWoundModifiers(10), [{ label: 'Matrix damage', value: 3 }]);
    assert.deepEqual(matrixWoundModifiers(3, { ic: true }), [{ label: 'Matrix damage', value: 2 }]);
  });
  test('switches', () => {
    withRule(['wounds', 'ic'], false, () => {
      assert.deepEqual(matrixWoundModifiers(3, { ic: true }), []);
      assert.equal(matrixWoundModifiers(3).length, 1);
    });
    withRule(['wounds', 'enabled'], false, () => assert.deepEqual(matrixWoundModifiers(6), []));
  });
});

describe('black IC hold', () => {
  const ic = (uuid: string, rating: number, over: Partial<HoldingIc> = {}): HoldingIc => ({ uuid, name: uuid, rating, black: true, crashed: false, hostUuid: 'H', ...over });
  const ics = [ic('a', 4), ic('b', 6), ic('c', 8, { crashed: true }), ic('d', 9, { black: false }), ic('e', 10, { hostUuid: 'X' })];
  test('holdingIc picks the highest live one', () => {
    assert.equal(holdingIc(['a', 'b', 'c', 'd', 'e'], ics, 'H', [])?.uuid, 'b');
    assert.equal(holdingIc(['a', 'b'], ics, 'H', ['b'])?.uuid, 'a');
    assert.equal(holdingIc(['c', 'd', 'e'], ics, 'H', []), null);
    assert.equal(holdingIc([], ics, 'H', []), null);
    withRule(['blackIcHold', 'enabled'], false, () => assert.equal(holdingIc(['a', 'b'], ics, 'H', []), null));
  });
  test('jackOutTest', () => {
    assert.deepEqual(jackOutTest(ic('b', 6), 5), { dice: 5, tn: 6, needed: 1, label: 'Break free of Black IC 6 (Willpower vs 6)' });
    assert.equal(jackOutTest(ic('z', 1), 5).tn, 2);
    withRule(['blackIcHold', 'attribute'], 'intelligence', () => assert.match(jackOutTest(ic('b', 6), 5).label, /Intelligence vs 6/));
  });
});

describe('shutdown and book-value options', () => {
  test('shutdownDue', () => {
    assert.deepEqual(shutdownDue({ round: 2, worldTime: 10 }), { round: 5, worldTime: 19 });
    assert.deepEqual(shutdownDue({ round: 2, worldTime: 10 }, 0), { round: 2, worldTime: 10 });
    assert.deepEqual(shutdownDue({ round: null, worldTime: 10 }, 0), { round: -1, worldTime: 10 });
    assert.deepEqual(shutdownDue({ round: null, worldTime: 10 }, 2), { round: -1, worldTime: 16 });
  });
  test('dumpShockLevel', () => {
    assert.equal(dumpShockLevel('red'), RULES.MATRIX.dumpShockLevel);
    withRule(['dumpShock', 'levelBy'], 'code', () => {
      assert.equal(dumpShockLevel('blue'), 'L');
      assert.equal(dumpShockLevel('black'), 'D');
      assert.equal(dumpShockLevel('weird'), RULES.MATRIX.dumpShockLevel);
    });
  });
  test('icInitiative', () => {
    assert.deepEqual(icInitiative({ rating: 6, securityValue: 8, code: 'orange', ownDice: 0 }), { base: 6, dice: 2, note: 'rating 6 + 2d6' });
    assert.equal(icInitiative({ rating: 6, securityValue: 8, code: 'orange', ownDice: 4 }).dice, 4);
    withRule(['icInitiative', 'from'], 'securityValue', () => {
      assert.deepEqual(icInitiative({ rating: 6, securityValue: 8, code: 'orange', ownDice: 0 }), { base: 8, dice: 3, note: 'Security Value 8 + 3d6' });
      assert.equal(icInitiative({ rating: 6, securityValue: 8, code: 'nope', ownDice: 0 }).dice, 1);
    });
  });
  test('icAttackDiceFor', () => {
    assert.deepEqual(icAttackDiceFor({ rating: 5, securityValue: 9 }), { dice: 5, note: '' });
    withRule(['icAttackDice'], 'securityValue', () => {
      assert.deepEqual(icAttackDiceFor({ rating: 5, securityValue: 9 }), { dice: 9, note: 'Security Value 9' });
      assert.deepEqual(icAttackDiceFor({ rating: 5, securityValue: 0 }), { dice: 5, note: '' });
    });
  });
});

describe('Matrix perception', () => {
  test('perceptionTarget', () => {
    const p = { kind: 'persona' as const, name: 'Ace', detectionFactor: 5, masking: 4 };
    assert.deepEqual(perceptionTarget('locateDecker', p), { tn: 5, label: "Ace's Detection Factor", modifiers: [] });
    assert.equal(perceptionTarget('analyzeIcon', p).tn, 4);
    assert.equal(perceptionTarget('locateIc', { kind: 'ic', name: 'Killer', rating: 6 }).tn, 6);
    const l = perceptionTarget('locateDecker', p, 2);
    assert.equal(l.tn, 5);
    assert.deepEqual(l.modifiers, [{ label: 'Lock-On 2', value: -2 }]);
    assert.equal(perceptionTarget('locateIc', { kind: 'agent', name: 'A', rating: 1 }).tn, 2);
  });
  test('perceptionDice', () => {
    assert.deepEqual(perceptionDice({ sensors: 4, computer: 6 }), { dice: 4, label: 'Sensors 4' });
    withRule(['perception', 'dice'], 'computer', () => assert.deepEqual(perceptionDice({ sensors: 4, computer: 6 }), { dice: 6, label: 'Computer 6' }));
  });
  test('analyzeReveals', () => {
    assert.deepEqual(analyzeReveals(0), []);
    assert.deepEqual(analyzeReveals(2), ['kind', 'rating', 'state']);
    assert.deepEqual(analyzeReveals(9), ['kind', 'rating', 'state', 'details']);
    withRule(['perception', 'analyze'], [{ successes: 1, reveals: ['a', 'b'] }, { successes: 1, reveals: ['b', 'c'] }], () => assert.deepEqual(analyzeReveals(1), ['a', 'b', 'c']));
  });
});

describe('cybercombat maneuvers', () => {
  test('maneuverSides', () => {
    const s = maneuverSides({ evasion: 5, cloak: 2, opponent: { ic: true, rating: 6, sensors: 3, lockOn: 1 } });
    assert.deepEqual(s.mine, { dice: 5, tn: 6, modifiers: [{ label: 'Cloak 2', value: -2 }] });
    assert.deepEqual(s.theirs, { dice: 6, tn: 5, modifiers: [{ label: 'Lock-On 1', value: -1 }] });
    const d = maneuverSides({ evasion: 1, cloak: 0, opponent: { ic: false, rating: 6, sensors: 3, lockOn: 0 } });
    assert.deepEqual(d.mine, { dice: 1, tn: 3, modifiers: [] });
    assert.deepEqual(d.theirs, { dice: 3, tn: 2, modifiers: [] });
  });
  test('maneuverOutcome', () => {
    assert.deepEqual(maneuverOutcome('position', 7, 1), { net: 6, won: true, tn: 4, frees: false });
    assert.deepEqual(maneuverOutcome('parry', 2, 2), { net: 0, won: false, tn: 0, frees: false });
    assert.equal(maneuverOutcome('evade', 3, 1).frees, true);
    assert.equal(maneuverOutcome('evade', 1, 3).frees, false);
  });
  test('entries, expiry and effects', () => {
    const now = { round: 3, worldTime: 0 };
    const pos = maneuverEntry('position', 'IC1', 2, now);
    assert.deepEqual(pos, { kind: 'position', targetUuid: 'IC1', net: 2, round: 4, worldTime: 3 });
    assert.equal(maneuverEntry('evade', 'IC1', 1, { round: null, worldTime: 10 }).round, -1);
    const list: Maneuver[] = [pos, maneuverEntry('position', 'IC1', 6, now), maneuverEntry('parry', 'X', 3, now), maneuverEntry('evade', 'IC2', 1, now)];
    assert.equal(activeManeuvers(list, { round: 4, worldTime: 99 }).length, 4);
    assert.equal(activeManeuvers(list, { round: 5, worldTime: 0 }).length, 0);
    assert.deepEqual(positionBonus(list, 'IC1', now), { label: 'Position (maneuver)', value: -4 });
    assert.equal(positionBonus(list, 'X', now), null);
    assert.deepEqual(parryPenalty(list, 'X', 'Ace', now), { label: 'Ace parries', value: 3 });
    assert.equal(parryPenalty(list, 'IC1', 'Ace', now), null);
    assert.equal(evadedBy(list, 'IC2', now), true);
    assert.equal(evadedBy(list, 'IC1', now), false);
    assert.equal(evadedBy(list, 'IC2', { round: 9, worldTime: 0 }), false);
    withRule(['maneuvers', 'evadeBlocks'], false, () => assert.equal(evadedBy(list, 'IC2', now), false));
    const left = consumePosition(list, 'IC1', now);
    assert.deepEqual(left.map((m) => m.kind), ['parry', 'evade']);
    assert.equal(list.length, 4, 'input not mutated');
  });
  test('out of combat uses world time', () => {
    const m = maneuverEntry('parry', 'X', 1, { round: null, worldTime: 10 });
    assert.equal(activeManeuvers([m], { round: null, worldTime: 13 }).length, 1);
    assert.equal(activeManeuvers([m], { round: null, worldTime: 14 }).length, 0);
  });
});

describe('utilities', () => {
  test('slowEffect', () => {
    assert.deepEqual(slowEffect(0, 4), { net: 0, initiative: 0 });
    assert.deepEqual(slowEffect(2, 4), { net: 2, initiative: 6 });
    assert.deepEqual(slowEffect(6, 4), { net: 4, initiative: 12 });
  });
  test('restorePlan', () => {
    const z = { mpcp: 0, bod: 0, evasion: 0, masking: 0, sensors: 0 };
    const r = restorePlan({ ...z, bod: 1, sensors: 2, masking: 2 }, { ...z, mpcp: 1 }, 4);
    assert.deepEqual(r.crippled, { ...z, bod: 0, masking: 0, sensors: 1 });
    assert.equal(r.restored, 4);
    const r2 = restorePlan({ ...z, evasion: 1 }, { ...z, mpcp: 1, bod: 2 }, 5);
    assert.equal(r2.restored, 1, 'deck damage off by default');
    assert.deepEqual(r2.deckDamage, { ...z, mpcp: 1, bod: 2 });
    withRule(['utilities', 'restore', 'deckDamage'], true, () => {
      const r3 = restorePlan({ ...z, evasion: 1 }, { ...z, mpcp: 1, bod: 2, sensors: 1 }, 3);
      assert.equal(r3.restored, 3);
      assert.deepEqual(r3.deckDamage, { ...z, bod: 1, sensors: 1 });
    });
  });
  test('validatedDf', () => {
    assert.equal(validatedDf(5, false), 5);
    assert.equal(validatedDf(5, true), 7);
  });
});

describe('bombs, comcalls, filter, hitchers, chips', () => {
  test('bombs', () => {
    assert.deepEqual(bombBlast(6, false), { power: 6, level: 'M', erases: true, alert: 'passive' });
    assert.equal(bombBlast(6, true).erases, false);
    assert.equal(touchesFile('download'), true);
    assert.equal(touchesFile('decryptFile'), true);
    assert.equal(touchesFile('locateFile'), false);
  });
  test('comcalls', () => {
    const a = placeCall([], { id: '1', from: 'A', to: 'B', by: 'D' });
    assert.deepEqual(a, [{ id: '1', from: 'A', to: 'B', by: 'D', tappedBy: [], rerouted: '' }]);
    const b = tapCall(tapCall(a, '1', 'E'), '1', 'E');
    assert.deepEqual(b[0]!.tappedBy, ['E']);
    assert.deepEqual(a[0]!.tappedBy, [], 'input not mutated');
    assert.equal(rerouteCall(b, '1', 'C')[0]!.rerouted, 'C');
    assert.deepEqual(rerouteCall(b, 'zz', 'C'), b);
    assert.deepEqual(endCall(b, '1'), []);
    assert.equal(endCall(b, 'zz').length, 1);
  });
  test('reality filter', () => {
    assert.deepEqual(realityFilterTest(6, 1), { dice: 6, tn: 2 });
    assert.deepEqual(realityFilterEffect(true), { reaction: 1, pool: 1, modifiers: [] });
    assert.deepEqual(realityFilterEffect(false), { reaction: 0, pool: 0, modifiers: [{ label: 'Reality filter fails', value: 1 }] });
    assert.deepEqual(realityFilterEffect(null), { reaction: 0, pool: 0, modifiers: [] });
    withRule(['realityFilter', 'failTn'], 0, () => assert.deepEqual(realityFilterEffect(false).modifiers, []));
  });
  test('hitchers', () => {
    assert.deepEqual(hitcherRoom({ hitchers: 2 }, 1), { capacity: 2, free: 1 });
    assert.deepEqual(hitcherRoom({}, 1), { capacity: 0, free: 0 });
  });
  test('chips', () => {
    assert.deepEqual(chipPlayable({ datajack: true, simrig: true }), { ok: true, via: 'datajack' });
    assert.deepEqual(chipPlayable({}), { ok: false, via: null });
    withRule(['chips', 'needs'], ['simrig'], () => assert.deepEqual(chipPlayable({ datajack: true }), { ok: false, via: null }));
    assert.deepEqual(chipBehaviour('btl'), { burnsOut: true, addictive: true, label: 'BTL' });
    assert.deepEqual(chipBehaviour('moodchip'), { burnsOut: false, addictive: true, label: 'Moodchip' });
    assert.deepEqual(chipBehaviour(''), { burnsOut: false, addictive: false, label: '' });
  });
});
