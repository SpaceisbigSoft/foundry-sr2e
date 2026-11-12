/**
 * v0.92.3 book alignment, the Matrix (RULES.MATRIX_V923; Virtual Realities 2.0 replaces the Core Matrix rules): each
 * default is the book's, and each switch (or moved value) puts the v0.92.2 result back. Pure rules; the Foundry glue
 * is in src/module/__tests__/v0923-matrix-glue.test.ts.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { RULES } from '../config.ts';
import { oldWay } from './oldway.ts';
import { matrix922 } from '../../__tests__/helpers/matrix922.ts';
import * as M from '../matrix923.ts';
import {
  icInitiativeDice, operation, traceTurns, connectionModifiers, psycheModifiers, personaWarnings, downloadTurns, UTILITY_KINDS, utilitySize,
  personaAttributeLoss, frameDice,
} from '../matrix.ts';
import { actionCost } from '../core.ts';
import { deckPartPlan, otakuPersona, iccmDice } from '../netrig.ts';
import { loadSpeedOf, dumpShockLevel, icAttackDiceFor, validatedDf } from '../datawar.ts';
import { programDesign } from '../netrig.ts';
import { HOUSE_MATRIX_V923 } from '../config923/matrix.ts';

const V = () => RULES.MATRIX_V923 as any;

describe('v0.92.3 Matrix: system tests and hosts (VR2 pp. 19, 53, 61, 110, 161)', () => {
  test('a system test is opposed: more successes than the host (switch: 1+ successes)', () => {
    assert.deepEqual(M.systemTestOutcome(2, 2), { ok: false, net: 0 });
    assert.deepEqual(M.systemTestOutcome(3, 1), { ok: true, net: 2 });
    assert.deepEqual(M.systemTestOutcome(1, 0), { ok: true, net: 1 });
    assert.deepEqual(M.systemTestOutcome(0, 0), { ok: false, net: 0 });
    const undo = oldWay({ 'MATRIX_V923.systemTests': 'success' });
    try { assert.deepEqual(M.systemTestOutcome(1, 4), { ok: true, net: 1 }); } finally { undo(); }
  });
  test('a passive alert raises every subsystem by 2 (and stays at active); 0 = none', () => {
    assert.equal(M.alertSubsystemBonus('none'), 0);
    assert.equal(M.alertSubsystemBonus('passive'), 2);
    assert.equal(M.alertSubsystemBonus('active'), 2);
    const undo = oldWay({ 'MATRIX_V923.passiveAlert': 0 });
    try { assert.equal(M.alertSubsystemBonus('passive'), 0); } finally { undo(); }
  });
  test('Locate File adds up net successes: a file every 5', () => {
    assert.deepEqual(M.locateFileProgress(0, 3), { total: 3, files: 0 });
    assert.deepEqual(M.locateFileProgress(3, 4), { total: 7, files: 1 });
    assert.deepEqual(M.locateFileProgress(7, 8), { total: 15, files: 2 });
  });
  test('the operations table is VR2\'s; the switch puts the old values back and drops the new rows', () => {
    assert.equal(operation('analyzeHost')!.action, 'complex');
    assert.equal(operation('analyzeIc')!.action, 'free');
    assert.equal(operation('downloadData')!.action, 'simple');
    assert.equal(operation('gracefulLogoff')!.action, 'complex');
    assert.equal(operation('validatePasscode')!.subsystem, 'control');
    assert.equal(operation('crashHost')!.utility, 'crash');
    assert.equal(operation('redirectDatatrail')!.utility, 'camo');
    assert.equal(operation('locateSlave')!.utility, 'analyze');
    assert.deepEqual([operation('makeComcall')!.subsystem, operation('makeComcall')!.utility], ['files', 'commlink']);
    assert.deepEqual([operation('nullOperation')!.subsystem, operation('nullOperation')!.utility, operation('nullOperation')!.action], ['control', 'deception', 'complex']);
    assert.ok(operation('relocateTrace'));
    const undo = oldWay({ 'MATRIX_V923.operations': 'v922' });
    try {
      assert.equal(operation('analyzeHost')!.action, 'simple');
      assert.equal(operation('downloadData')!.action, 'complex');
      assert.equal(operation('validatePasscode')!.subsystem, 'access');
      assert.equal(operation('crashHost')!.utility, '');
      assert.equal(operation('redirectDatatrail')!.utility, 'relocate');
      assert.deepEqual([operation('nullOperation')!.subsystem, operation('nullOperation')!.action], ['access', 'simple']);
      assert.equal(operation('relocateTrace'), null);
    } finally { undo(); }
  });
  test('a Free operation costs no action', () => {
    assert.equal(actionCost('matrix:free'), 'free');
  });
  test('host shutdown: 1D6 per 2 points (or part) of the Security Value; null with the fixed turns', () => {
    assert.equal(M.shutdownDice(1), 1);
    assert.equal(M.shutdownDice(4), 2);
    assert.equal(M.shutdownDice(9), 5);
    const undo = oldWay({ 'MATRIX_V923.shutdown': 'fixed' });
    try { assert.equal(M.shutdownDice(9), null); } finally { undo(); }
  });
  test('I/O speed is Mp per second: × 3 a Combat Turn for downloads and loading (was × 1)', () => {
    assert.equal(downloadTurns(300, 100), 1);
    assert.equal(loadSpeedOf({ ioSpeed: 50 }), 150);
    const undo = oldWay({ 'MATRIX.download.ioPerTurn': 1 });
    try { assert.equal(downloadTurns(300, 100), 3); assert.equal(loadSpeedOf({ ioSpeed: 50 }), 50); } finally { undo(); }
  });
  test('a validated passcode no longer changes the Detection Factor (it gives Legitimate status)', () => {
    assert.equal(validatedDf(5, true), 5);
    const undo = oldWay({ 'MATRIX_V57.utilities.validate.dfBonus': 2 });
    try { assert.equal(validatedDf(5, true), 7); } finally { undo(); }
  });
});

describe('v0.92.3 Matrix: persona speed (VR2 pp. 85, 87, 120, 145)', () => {
  test('the decker\'s own Reaction + 2 per Response Increase, at most MPCP ÷ 4; hot DNI is one more level', () => {
    assert.deepEqual(M.personaSpeed({ reaction: 5, responseIncrease: 2, mpcp: 8, sim: 'cold', tortoise: false }), { reaction: 9, dice: 3, counted: 2 });
    assert.deepEqual(M.personaSpeed({ reaction: 5, responseIncrease: 2, mpcp: 6, sim: 'cold', tortoise: false }), { reaction: 7, dice: 2, counted: 1 });
    assert.deepEqual(M.personaSpeed({ reaction: 5, responseIncrease: 3, mpcp: 3, sim: 'hot', tortoise: false }), { reaction: 7, dice: 2, counted: 0 });
    assert.ok(personaWarnings({ mpcp: 6, bod: 4, evasion: 4, masking: 4, sensors: 4, hardening: 0, responseIncrease: 2, activeMemory: 0 }).some((w) => /only 1 counts/.test(w)));
  });
  test('a tortoise halves Reaction (min 1) and gets only Response Increase\'s dice; an otaku (I + W) ÷ 2 and 3D6', () => {
    assert.deepEqual(M.personaSpeed({ reaction: 5, responseIncrease: 1, mpcp: 8, sim: 'hot', tortoise: true }), { reaction: 2, dice: 2, counted: 1 });
    assert.equal(M.personaSpeed({ reaction: 1, responseIncrease: 0, mpcp: 8, sim: 'cold', tortoise: true })!.reaction, 1);
    assert.deepEqual(M.personaSpeed({ reaction: 4, responseIncrease: 0, mpcp: 6, sim: 'hot', tortoise: false, otaku: { intelligence: 6, willpower: 5 } }), { reaction: 6, dice: 3, counted: 0 });
  });
  test('the switch keeps the v0.92.2 formulas (null)', () => {
    const undo = matrix922();
    try {
      assert.equal(M.personaSpeed({ reaction: 5, responseIncrease: 2, mpcp: 8, sim: 'cold', tortoise: false }), null);
      assert.ok(!personaWarnings({ mpcp: 6, bod: 4, evasion: 4, masking: 4, sensors: 4, hardening: 0, responseIncrease: 2, activeMemory: 0 }).some((w) => /counts/.test(w)));
    } finally { undo(); }
  });
  test('IC initiative: rating + 1/2/3/4 D6 Blue to Red (switch: 1/1/2/2/3)', () => {
    assert.deepEqual(['blue', 'green', 'orange', 'red'].map(icInitiativeDice), [1, 2, 3, 4]);
    const undo = oldWay({ 'MATRIX_V923.icInitiative': 'v922' });
    try { assert.deepEqual(['blue', 'green', 'orange', 'red', 'black'].map(icInitiativeDice), [1, 1, 2, 2, 3]); } finally { undo(); }
  });
  test('party IC roll their own initiative', () => {
    assert.equal(RULES.MATRIX.party.sharedInitiative, false);
  });
});

describe('v0.92.3 Matrix: cybercombat (VR2 pp. 40, 52, 120–124)', () => {
  test('the Cybercombat Target Numbers Table by code and status', () => {
    assert.deepEqual(['blue', 'green', 'orange', 'red'].map((c) => M.cybercombatTn(c, false)), [6, 5, 4, 3]);
    assert.deepEqual(['blue', 'green', 'orange', 'red'].map((c) => M.cybercombatTn(c, true)), [3, 4, 5, 6]);
    const undo = oldWay({ 'MATRIX_V923.cybercombat': 'v922' });
    try { assert.equal(M.cybercombatBook(), false); assert.equal(M.partyTn(3), 0); } finally { undo(); }
  });
  test('IC roll the Security Value; no dodge; attacks and maneuvers are Simple', () => {
    assert.equal(RULES.MATRIX_V57.icAttackDice, 'securityValue');
    assert.deepEqual(icAttackDiceFor({ rating: 5, securityValue: 9 }).dice, 9);
    assert.equal(RULES.MATRIX.defense.persona, 'none');
    assert.equal(actionCost('matrixAttack'), 'simple');
    assert.equal(actionCost('matrixManeuver'), 'simple');
    const undo = oldWay({ 'MATRIX_V923.actions': 'v922' });
    try { assert.equal(actionCost('matrixAttack'), 'complex'); assert.equal(actionCost('matrixManeuver'), 'complex'); } finally { undo(); }
  });
  test('crashing IC: its rating onto the tally, or half (round up), or nothing', () => {
    assert.equal(M.crashTallyPoints(6), 6);
    let undo = oldWay({ 'MATRIX_V923.crashTally': 'half' });
    try { assert.equal(M.crashTallyPoints(5), 3); } finally { undo(); }
    undo = oldWay({ 'MATRIX_V923.crashTally': 'none' });
    try { assert.equal(M.crashTallyPoints(5), 0); } finally { undo(); }
  });
  test('party IC: +1 TN per member', () => {
    assert.equal(M.partyTn(3), 3);
    assert.equal(M.partyTn(1), 0);
  });
  test('the IC damage level by code (switch: its own)', () => {
    assert.deepEqual(['blue', 'green', 'orange', 'red'].map((c) => M.icDamageLevelFor(c, 'D')), ['M', 'M', 'S', 'S']);
    const undo = oldWay({ 'MATRIX_V923.icDamageLevel': 'own' });
    try { assert.equal(M.icDamageLevelFor('blue', 'D'), 'D'); } finally { undo(); }
  });
  test('cripplers: 1 point per 2 net successes, nothing for 1 (was at least 1)', () => {
    assert.equal(personaAttributeLoss(1), 0);
    assert.equal(personaAttributeLoss(4), 2);
    const undo = oldWay({ 'MATRIX.attributeDamage.minOnHit': 1 });
    try { assert.equal(personaAttributeLoss(1), 1); } finally { undo(); }
  });
});

describe('v0.92.3 Matrix: damage to the decker (VR2 pp. 17, 43–50, 86, 124)', () => {
  test('dump shock: level by code, Stun; a cool deck and an ICCM each −2 Power and −1 level', () => {
    assert.equal(dumpShockLevel('blue'), 'L');
    assert.equal(dumpShockLevel('red'), 'D');
    assert.equal(RULES.MATRIX.sim.hot.dumpShockType, 'stun');
    assert.deepEqual(M.dumpShockCode({ power: 8, level: 'S', cool: false, iccm: false }), { power: 8, level: 'S', note: '' });
    assert.deepEqual(M.dumpShockCode({ power: 8, level: 'S', cool: true, iccm: true }).level, 'L');
    assert.equal(M.dumpShockCode({ power: 8, level: 'S', cool: true, iccm: true }).power, 4);
    assert.equal(M.dumpShockCode({ power: 5, level: 'L', cool: true, iccm: false }).level, null);
    const undo = matrix922();
    try {
      assert.equal(dumpShockLevel('blue'), RULES.MATRIX.dumpShockLevel);
      assert.deepEqual(M.dumpShockCode({ power: 8, level: 'S', cool: true, iccm: true }), { power: 8, level: 'S', note: '' });
    } finally { undo(); }
  });
  test('simsense overload: TN 2/3/5 by level, +2 hot DNI, −2 ICCM; none on a cool deck or for Deadly', () => {
    assert.equal(M.overloadTnFor('L', { hot: true }), 4);
    assert.equal(M.overloadTnFor('S', { hot: true, iccm: true }), 5);
    assert.equal(M.overloadTnFor('M', { hot: false }), null);
    assert.equal(M.overloadTnFor('D', { hot: true }), null);
  });
  test('black IC: Body against lethal, Willpower against non-lethal, Hardening off the Power; cool decks turn lethal to Stun', () => {
    assert.deepEqual(M.blackIcResistance({ damageType: 'physical', power: 10, hardening: 1 }), { attribute: 'body', tn: 9 });
    assert.deepEqual(M.blackIcResistance({ damageType: 'stun', power: 6, hardening: 2 }), { attribute: 'willpower', tn: 4 });
    assert.equal(RULES.MATRIX.sim.cold.coldBlackIcStun, true);
    assert.equal(RULES.MATRIX.iccm.blackIcStun, false);
    assert.equal(iccmDice(4), 0);
  });
  test('gray IC: Blaster vs MPCP + Hardening, Sparky vs MPCP + 2 + Hardening; sparky damage stages up (switch: MPCP)', () => {
    assert.equal(M.grayIcTn({ mpcp: 6, hardening: 2, sparky: false }), 8);
    assert.equal(M.grayIcTn({ mpcp: 6, hardening: 2, sparky: true }), 10);
    assert.deepEqual(M.sparkyDamage({ rating: 6, successes: 2, hardening: 1 }), { tn: 5, level: 'S' });
    assert.deepEqual(M.sparkyDamage({ rating: 8, successes: 5, hardening: 0 }), { tn: 8, level: 'D' });
    const undo = oldWay({ 'MATRIX_V923.grayIc': 'v922' });
    try { assert.equal(M.grayIcTn({ mpcp: 6, hardening: 2, sparky: true }), 6); } finally { undo(); }
  });
  test('psychotropic: cyberphobia adds the IC\'s rating (switch: +2)', () => {
    const list = [{ kind: 'cyberphobia', icName: 'X', rating: 7, until: M.PSYCHE_UNTIL_RECOVERED }];
    assert.equal(psycheModifiers(list, 1000)[0]!.value, 7);
    assert.equal(RULES.MATRIX.psychotropic.shieldDice, false);
    const undo = oldWay({ 'MATRIX_V923.psychotropic': 'v922' });
    try { assert.equal(psycheModifiers(list, 1000)[0]!.value, RULES.MATRIX.psychotropic.cyberphobiaTn); } finally { undo(); }
  });
});

describe('v0.92.3 Matrix: trace and jackpoints (VR2 pp. 28, 45–47)', () => {
  test('the Trace Factor (the book\'s example: 9 − 8 + 2 + 4 = 7 before bandwidth)', () => {
    assert.equal(M.traceFactor({ evasion: 9, rating: 8, camo: 4, redirects: 2, jackpoint: 0 }), 7);
    assert.equal(M.traceFactor({ evasion: 4, rating: 8, camo: 0, redirects: 0, jackpoint: -2 }), RULES.MIN_TARGET_NUMBER);
  });
  test('the location cycle: 10 ÷ successes, rounded down (switch: rounded up)', () => {
    assert.equal(traceTurns(6), 1);
    assert.equal(traceTurns(3), 3);
    const undo = oldWay({ 'MATRIX_V923.trace': 'v922' });
    try { assert.equal(traceTurns(6), 2); assert.equal(traceTurns(3), 4); } finally { undo(); }
  });
  test('after a jack-out the datatrail stays 1D6 − 1 turns (min 1)', () => {
    assert.deepEqual(M.datatrailHolds(1, 1), { turns: 1, completes: true });
    assert.deepEqual(M.datatrailHolds(4, 5), { turns: 3, completes: false });
    assert.deepEqual(M.datatrailHolds(6, 5), { turns: 5, completes: true });
  });
  test('the jackpoint modifies Access tests only (switch: the connection TN on every test)', () => {
    assert.deepEqual(connectionModifiers('legal', false, { access: true }).map((m) => m.value), [-2]);
    assert.deepEqual(connectionModifiers('legal', false).map((m) => m.value), []);
    assert.deepEqual(connectionModifiers('satellite', false, { access: true }).map((m) => m.value), [2]);
    assert.deepEqual(M.jackpointMods('device'), { access: 4, trace: 4, reaction: 0 });
    assert.equal(M.jackpointMods('satellite').reaction, -2);
    const undo = oldWay({ 'MATRIX_V923.connections': 'v922' });
    try { assert.deepEqual(connectionModifiers('satellite', false).map((m) => m.value), [2]); } finally { undo(); }
  });
  test('Graceful Logoff and travel', () => {
    assert.equal(RULES.MATRIX.travel.turnsPerHop, 0);
  });
});

describe('v0.92.3 Matrix: programs, frames, decks, otaku, paydata (VR2 pp. 65, 83–87, 99–105, 145)', () => {
  test('new utility kinds and the book\'s size multipliers', () => {
    for (const k of ['camo', 'crash', 'commlink', 'scanner', 'defuse']) assert.ok((UTILITY_KINDS as readonly string[]).includes(k), k);
    assert.equal(utilitySize('camo', 4), 48);
    assert.equal(utilitySize('smoke', 3), 18);
    assert.equal(utilitySize('frame', 3), 18);
    assert.equal(utilitySize('smart-frame', 3), 27);
  });
  test('programming takes size × 2 days (was × 1)', () => {
    assert.equal(programDesign({ kind: 'browse', rating: 4 }).baseDays, 32);
    const undo = oldWay({ 'MATRIX.programming.daysPerMp': 1 });
    try { assert.equal(programDesign({ kind: 'browse', rating: 4 }).baseDays, 16); } finally { undo(); }
  });
  test('frames: a dumb frame rolls its owner\'s Computer, a smart one its rating; carried ratings total ≤ its rating', () => {
    assert.deepEqual(M.frameDice923({ rating: 4, smart: false, ownerComputer: 6 }), { dice: 6, pool: 0 });
    assert.deepEqual(M.frameDice923({ rating: 4, smart: true, ownerComputer: 6 }), { dice: 4, pool: 0 });
    assert.deepEqual(frameDice(4, true), { dice: 4, pool: 0 });
    assert.equal(M.frameCarryOk([2, 3], 5), true);
    assert.equal(M.frameCarryOk([3, 3], 5), false);
    const undo = matrix922();
    try { assert.equal(M.frameDice923({ rating: 4, smart: false, ownerComputer: 6 }), null); assert.equal(M.frameCarryOk([3, 3], 5), null); assert.deepEqual(frameDice(4, true), { dice: 4, pool: 2 }); } finally { undo(); }
  });
  test('deck parts: the book\'s design sizes and TNs (switch: the old table)', () => {
    assert.deepEqual([deckPartPlan('mpcp', 6, 6)!.size, deckPartPlan('mpcp', 6, 6)!.tn], [288, 6]);
    assert.equal(deckPartPlan('bod', 4, 6)!.size, 48);
    assert.equal(deckPartPlan('masking', 4, 6)!.size, 32);
    assert.deepEqual([deckPartPlan('hardening', 4, 6)!.size, deckPartPlan('hardening', 4, 6)!.tn], [144, 6]);
    assert.deepEqual([deckPartPlan('responseIncrease', 2, 6)!.size, deckPartPlan('responseIncrease', 2, 6)!.tn], [144, 4]);
    const undo = oldWay({ 'MATRIX_V923.deckBuilding': 'v922' });
    try { assert.deepEqual([deckPartPlan('mpcp', 6, 6)!.size, deckPartPlan('hardening', 4, 6)!.size], [72, 16]); } finally { undo(); }
  });
  test('otaku: MPCP and Masking rounded up, Hardening Willpower ÷ 2', () => {
    const a = { intelligence: 6, willpower: 5, charisma: 4, body: 1, quickness: 1, strength: 1 };
    assert.equal(otakuPersona(a).mpcp, 5);
    assert.deepEqual(M.otakuPersona923(a), { mpcp: 5, masking: 5, hardening: 3 });
    const undo = oldWay({ 'MATRIX_V923.otaku': 'v922' });
    try { assert.equal(otakuPersona(a).mpcp, 5); assert.equal(otakuPersona({ ...a, charisma: 3 }).mpcp, 4); assert.equal(M.otakuPersona923(a), null); } finally { undo(); }
  });
  test('paydata: a 5,000¥ point, 2D6 × 20/15/10/5 Mp, defenses by code (switch: the old table)', () => {
    assert.deepEqual(M.paydataFile923('blue', 6, [3, 4], 6, 1), { name: 'Paydata 1', size: 140, value: 5000, paydata: true, encrypted: 0, scramble: 0, bomb: 0 });
    assert.equal(M.paydataFile923('red', 8, [3, 4], 1, 1)!.size, 35);
    assert.deepEqual(['green', 'green', 'green'].map((c, i) => { const f = M.paydataFile923(c, 7, [1, 1], [4, 5, 6][i]!, 1)!; return [f.bomb, f.scramble]; }), [[0, 0], [7, 0], [0, 7]]);
    assert.deepEqual([M.paydataFile923('red', 7, [1, 1], 6, 1)!.bomb, M.paydataFile923('red', 7, [1, 1], 6, 1)!.scramble], [7, 7]);
    const undo = oldWay({ 'MATRIX_V923.paydata': 'v922' });
    try { assert.equal(M.paydataFile923('blue', 6, [3, 4], 6, 1), null); } finally { undo(); }
  });
});

describe('v0.92.3 Matrix: the house-rules rows', () => {
  test('every switch has a row whose first choice is the default', () => {
    for (const r of HOUSE_MATRIX_V923) {
      const v = r.path.split('.').reduce((o: any, k) => o?.[k], RULES as any);
      assert.notEqual(v, undefined, r.path);
      if (r.type === 'select') assert.equal(v, r.choices![0], r.path);
    }
    assert.equal(V().systemTests, 'opposed');
  });
});
