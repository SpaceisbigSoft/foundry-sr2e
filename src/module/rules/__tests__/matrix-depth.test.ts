import { test, describe } from 'node:test';
import assert from '../../__tests__/helpers/assert-rows.ts';
import {
  behaviorFromName, icActionKind, icActionTarget, personaAttributeLoss, traceTurns, traceDue, traceComplete,
  mpcpDamage, effectivePersona, repairDeck, utilitySize, programSize, medicTarget, medicRepair, operation,
  locateFiles, downloadTurns, paydataCount, paydataFile, guardingIc, memoryUse, loadedUtility, NO_DECK_DAMAGE,
  type DataFile, type Deck,
} from '../matrix.ts';
import { RULES } from '../config.ts';

const persona = { evasion: 5, masking: 4, detectionFactor: 5, bod: 4, sensors: 3 };
const deck: Deck = { mpcp: 6, bod: 4, evasion: 5, masking: 5, sensors: 4, hardening: 2, responseIncrease: 1, activeMemory: 300 };

describe('matrix depth (v0.27.0)', () => {
  test('IC behaviors are guessed from their type names', () => {
    assert.equal(behaviorFromName('Trace and Dump'), 'trace');
    assert.equal(behaviorFromName('Tar Baby'), 'tarBaby');
    assert.equal(behaviorFromName('tar-pit'), 'tarPit');
    assert.equal(behaviorFromName('Killer'), 'killer');
    assert.equal(behaviorFromName('Access'), 'barrier');
    assert.equal(behaviorFromName('Psychotropic'), 'psychotropic');   // modeled since v0.40.0
    assert.equal(behaviorFromName('Party cluster'), null);
    assert.equal(behaviorFromName(''), null);
  });

  test('each behavior acts its own way, against its own TN', () => {
    assert.equal(icActionKind('killer'), 'damage');
    assert.equal(icActionKind('probe'), 'tally');
    assert.equal(icActionKind('ripper'), 'attribute');
    assert.equal(icActionKind('tarPit'), 'utility');
    assert.equal(icActionKind('trace'), 'trace');
    assert.equal(icActionKind('barrier'), 'passive');
    assert.equal(icActionKind('other'), 'report');
    assert.deepEqual(icActionTarget('killer', persona), { tn: 5, label: "the persona's Evasion" });
    assert.equal(icActionTarget('crippler', persona, { attribute: 'sensors' }).tn, 3);
    assert.equal(icActionTarget('crippler', persona, { attribute: 'nonsense' }).tn, 5);  // falls back to Evasion
    assert.equal(icActionTarget('tarBaby', persona, { utilityRating: 6 }).tn, 6);
    assert.equal(icActionTarget('tarBaby', persona, { utilityRating: 1 }).tn, 2);       // TN minimum
    assert.equal(icActionTarget('probe', persona).tn, 5);
  });

  test('cripplers and rippers take 1 point per 2 net successes, at least 1 on a hit', () => {
    assert.equal(personaAttributeLoss(0), 0);
    assert.equal(personaAttributeLoss(1), 1);
    assert.equal(personaAttributeLoss(4), 2);
    assert.equal(personaAttributeLoss(5), 2);
  });

  test('a trace completes after 10 / net successes Combat Turns, by round in combat or by world time', () => {
    assert.equal(traceTurns(0), null);
    assert.equal(traceTurns(1), 10);
    assert.equal(traceTurns(3), 4);
    assert.equal(traceTurns(20), 1);
    assert.deepEqual(traceDue({ round: 2, worldTime: 100, turns: 4 }), { round: 6, worldTime: 112 });
    assert.deepEqual(traceDue({ round: null, worldTime: 100, turns: 4 }), { round: -1, worldTime: 112 });
    assert.equal(traceComplete({ round: 6, worldTime: 112 }, { round: 5, worldTime: 110 }), false);
    assert.equal(traceComplete({ round: 6, worldTime: 112 }, { round: 6 }), true);
    assert.equal(traceComplete({ round: -1, worldTime: 112 }, { worldTime: 112 }), true);
  });

  test('MPCP damage: 1 point per 2 IC successes', () => {
    assert.equal(mpcpDamage(1), 0);
    assert.equal(mpcpDamage(2), 1);
    assert.equal(mpcpDamage(5), 2);
  });

  test('deck damage and crippling lower the working persona; repairs fix MPCP first', () => {
    const e = effectivePersona(deck, { mpcp: 1, evasion: 2 }, { evasion: 1, masking: 9 });
    assert.deepEqual({ m: e.mpcp, e: e.evasion, mk: e.masking, b: e.bod, d: e.damaged }, { m: 5, e: 2, mk: 0, b: 4, d: true });
    assert.equal(effectivePersona(deck).damaged, false);
    const r = repairDeck({ ...NO_DECK_DAMAGE, mpcp: 2, sensors: 1 }, 2);
    assert.deepEqual(r, { after: { ...NO_DECK_DAMAGE, sensors: 1 }, repaired: 2 });
    assert.equal(repairDeck({ ...NO_DECK_DAMAGE, bod: 1 }, 5).repaired, 1);
  });

  test('utility sizes are rating² × the kind multiplier; a program with Size 0 uses it for memory', () => {
    assert.equal(utilitySize('attack', 5, 'M'), 75);
    assert.equal(utilitySize('attack', 4, 'D'), 80);
    assert.equal(utilitySize('sleaze', 4), 48);
    assert.equal(utilitySize('browse', 6), 36);
    assert.equal(utilitySize('nonsense', 6), 0);
    assert.equal(programSize({ kind: 'sleaze', rating: 4, size: 0 }), 48);
    assert.equal(programSize({ kind: 'sleaze', rating: 4, size: 96 }), 96);
    const progs = [
      { kind: 'sleaze', rating: 4, size: 0, loaded: true },
      { kind: 'medic', rating: 3, size: 0, loaded: true, erased: true },
    ];
    assert.equal(memoryUse(progs, 100).used, 48);                 // erased programs take no memory
    assert.equal(loadedUtility(progs, 'medic'), null);            // and cannot be used
  });

  test('Medic: TN by the persona damage level, 1 box per success', () => {
    assert.deepEqual(medicTarget(1), { tn: 4, level: 'L' });
    assert.deepEqual(medicTarget(6), { tn: 6, level: 'S' });
    assert.equal(medicTarget(0).level, null);
    assert.deepEqual(medicRepair(5, 2), { after: 3, repaired: 2 });
    assert.deepEqual(medicRepair(1, 4), { after: 0, repaired: 1 });
  });

  test('the operations catalog names a subsystem, utility and action for each operation', () => {
    const op = operation('locateFile')!;
    assert.deepEqual({ s: op.subsystem, u: op.utility, a: op.action }, { s: 'index', u: 'browse', a: 'complex' });
    assert.equal(operation('decryptFile')!.tn, 'target');
    assert.equal(operation('nope'), null);
    for (const o of RULES.MATRIX.operations) assert.ok(RULES.MATRIX.subsystems.includes(o.subsystem), o.id);
  });

  test('locating files: one new file per success; Locate Paydata finds only paydata', () => {
    const files: DataFile[] = [
      { id: 'a', name: 'Memo', size: 10, value: 0, paydata: false, encrypted: 0, scramble: 0, foundBy: [] },
      { id: 'b', name: 'R&D', size: 60, value: 6000, paydata: true, encrypted: 0, scramble: 0, foundBy: ['D1'] },
      { id: 'c', name: 'Payroll', size: 40, value: 4000, paydata: true, encrypted: 6, scramble: 0, foundBy: [] },
    ];
    assert.deepEqual(locateFiles(files, 'D1', 1, false), ['a']);
    assert.deepEqual(locateFiles(files, 'D1', 5, false), ['a', 'c']);
    assert.deepEqual(locateFiles(files, 'D1', 5, true), ['c']);
    assert.deepEqual(locateFiles(files, 'D2', 1, true), ['b']);
    assert.deepEqual(locateFiles(files, 'D1', 0, false), []);
  });

  test('downloads take size ÷ I/O speed Combat Turns, rounded up', () => {
    assert.equal(downloadTurns(60, 20), 3);
    assert.equal(downloadTurns(61, 20), 4);
    assert.equal(downloadTurns(5, 100), 1);
    assert.equal(downloadTurns(50, 0), 50);
  });

  test('paydata by security code: count, size, value and defenses', () => {
    assert.equal(paydataCount('blue', [3]), 2);
    assert.equal(paydataCount('blue', [1]), 0);
    assert.equal(paydataCount('red', [4, 5]), 11);
    assert.equal(paydataCount('mystery', [3, 3]), 6);              // unknown codes read as orange
    assert.deepEqual(paydataFile('red', 6, [3, 4], 2, 1), { name: 'Paydata 1', size: 140, value: 21000, paydata: true, encrypted: 0, scramble: 0 });
    assert.equal(paydataFile('red', 6, [3, 4], 4, 2).encrypted, 6);
    assert.deepEqual([paydataFile('red', 6, [3, 4], 6, 2).encrypted, paydataFile('red', 6, [3, 4], 6, 2).scramble], [0, 6]);
  });

  test('a live barrier IC guards its subsystem until crashed or passed', () => {
    const ic = [
      { uuid: 'I1', behavior: 'barrier', guards: 'files', crashed: false },
      { uuid: 'I2', behavior: 'killer', guards: 'files', crashed: false },
    ];
    assert.equal(guardingIc(ic, 'files', [])?.uuid, 'I1');
    assert.equal(guardingIc(ic, 'files', ['I1']), null);
    assert.equal(guardingIc(ic, 'index', []), null);
    assert.equal(guardingIc([{ ...ic[0]!, crashed: true }], 'files', []), null);
  });
});

import { gridReachable, gridPath, simInitiativeDice, simsenseOverload, dumpShockType, blackIcDamageType, frameDice, connectionModifiers, type GridNode } from '../matrix.ts';
// v0.92.3: these tests pin the v0.92.2 Matrix rules (the book's defaults: v0923-matrix.test.ts).
import { before as before922, after as after922 } from 'node:test';
import { matrix922 } from '../../__tests__/helpers/matrix922.ts';
let undo922: () => void = () => {};
before922(() => { undo922 = matrix922(); });
after922(() => undo922());

describe('the grid, sims, frames and connections (v0.28.0)', () => {
  const rtg: GridNode = { uuid: 'R', gridKind: 'rtg', parentUuid: '' };
  const ltg: GridNode = { uuid: 'L', gridKind: 'ltg', parentUuid: 'R' };
  const hostA: GridNode = { uuid: 'A', gridKind: 'host', parentUuid: 'L' };
  const hostB: GridNode = { uuid: 'B', gridKind: 'host', parentUuid: 'L' };
  const lone: GridNode = { uuid: 'X', gridKind: 'host', parentUuid: '' };

  test('logging on: to a parent or child node, any node with no parent, and any LTG or RTG from a jackpoint', () => {
    assert.equal(gridReachable(ltg, hostA), true);    // down
    assert.equal(gridReachable(hostA, ltg), true);    // up
    assert.equal(gridReachable(hostA, hostB), false); // siblings: log off to the LTG first
    assert.equal(gridReachable(hostA, lone), true);
    assert.equal(gridReachable(null, ltg), true);     // jacking in at an LTG's jackpoint
    assert.equal(gridReachable(null, hostA), false);
    assert.deepEqual(gridPath(hostA, [rtg, ltg, hostA, hostB]).map((n) => n.uuid), ['A', 'L', 'R']);
    assert.deepEqual(gridPath({ ...hostA, parentUuid: 'A' }, [hostA]).map((n) => n.uuid), ['A']); // loops stop
  });

  test('hot sim: an extra initiative die, Physical dump shock, overload from Serious damage; cold sim: black IC stun as a house rule', () => {
    assert.equal(simInitiativeDice('hot'), 1);
    assert.equal(simInitiativeDice('cold'), 0);
    assert.equal(simsenseOverload('hot', 'S'), true);
    assert.equal(simsenseOverload('hot', 'M'), false);
    assert.equal(simsenseOverload('cold', 'D'), false);
    assert.equal(simsenseOverload('hot', null), false);
    assert.equal(dumpShockType('hot'), 'physical');
    assert.equal(dumpShockType('cold'), 'stun');
    assert.equal(blackIcDamageType('cold', 'physical'), 'physical');   // cold-sim stun is a house rule, off by default
    (RULES.MATRIX.sim.cold as any).coldBlackIcStun = true;
    try {
      assert.equal(blackIcDamageType('cold', 'physical'), 'stun');
      assert.equal(blackIcDamageType('hot', 'physical'), 'physical');
    } finally { (RULES.MATRIX.sim.cold as any).coldBlackIcStun = false; }
  });

  test('frames roll their rating; smart frames add half their rating in pool dice', () => {
    assert.deepEqual(frameDice(6, false), { dice: 6, pool: 0 });
    assert.deepEqual(frameDice(5, true), { dice: 5, pool: 2 });
  });

  test('connections and moving vehicles add to Matrix TNs', () => {
    assert.deepEqual(connectionModifiers('jackpoint', false), []);
    assert.deepEqual(connectionModifiers('satellite', true), [{ label: 'Satellite uplink', value: 2 }, { label: 'Moving vehicle', value: 1 }]);
    assert.deepEqual(connectionModifiers('nonsense', false), []);
  });
});
