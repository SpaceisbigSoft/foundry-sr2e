import { test, describe } from 'node:test';
import assert from '../../__tests__/helpers/assert-rows.ts';
import {
  RULES, behaviorFromName, icActionKind, psychotropicKindFromName, psychotropicEffect, activePsyche, psycheModifiers,
  mirrorsTn, smokeTn, smokeTurns, smokeCloud, smokeActive, matrixSoakTn, carryLimit, agentDice, agentDetectionFactor,
  gridHops, travelTurns, utilitySize, type GridNode,
} from '../index.ts';
// v0.92.3: these tests pin the v0.92.2 Matrix rules (the book's defaults: v0923-matrix.test.ts).
import { before as before922, after as after922 } from 'node:test';
import { matrix922 } from '../../__tests__/helpers/matrix922.ts';
let undo922: () => void = () => {};
before922(() => { undo922 = matrix922(); });
after922(() => undo922());

describe('v0.40.0 Matrix leftovers (rules)', () => {
  test('psychotropic IC: guessed from the name, a damaging black IC, payload from the name', () => {
    assert.equal(behaviorFromName('Psychotropic Black IC'), 'psychotropic');
    assert.equal(behaviorFromName('Judas-6'), 'psychotropic');
    assert.equal(behaviorFromName('Cyberphobia'), 'psychotropic');
    assert.equal(icActionKind('psychotropic'), 'damage');
    assert.equal(psychotropicKindFromName('Psychotropic (Judas) 6'), 'judas');
    assert.equal(psychotropicKindFromName('Frenzy IC'), 'frenzy');
    assert.equal(psychotropicKindFromName('Positive Conditioning'), 'conditioning');
    assert.equal(psychotropicKindFromName('Black IC'), 'cyberphobia');
  });

  test('psychotropic effects last rating days (frenzy the run); cyberphobia adds to Matrix TNs while it lasts', () => {
    const e = psychotropicEffect('cyberphobia', 'Psycho-5', 5, 1000);
    assert.equal(e.until, 1000 + 5 * 86400);
    assert.equal(psychotropicEffect('frenzy', 'X', 5, 1000).until, -1);
    assert.deepEqual(psycheModifiers([e], 2000), [{ label: 'Cyberphobia', value: RULES.MATRIX.psychotropic.cyberphobiaTn }]);
    assert.deepEqual(psycheModifiers([e], e.until + 1), []);
    assert.equal(activePsyche([e, { kind: 'frenzy', icName: 'X', rating: 4, until: -1 }], e.until + 1).length, 1);
    assert.deepEqual(psycheModifiers([{ kind: 'judas', icName: 'X', rating: 4, until: -1 }], 0), []);
  });

  test('mirrors and smoke: half the rating, at least 1; smoke lasts rating Combat Turns', () => {
    assert.equal(mirrorsTn(0), 0);
    assert.equal(mirrorsTn(1), 1);
    assert.equal(mirrorsTn(5), 2);
    assert.equal(smokeTn(6), 3);
    assert.equal(smokeTurns(4), 4);
    const inCombat = smokeCloud(4, 'Dex', { round: 3, worldTime: 100 });
    assert.deepEqual({ r: inCombat.round, t: inCombat.worldTime, tn: inCombat.tn }, { r: 7, t: 112, tn: 2 });
    assert.equal(smokeActive(inCombat, { round: 6 }), true);
    assert.equal(smokeActive(inCombat, { round: 7 }), false);
    const outside = smokeCloud(4, 'Dex', { round: null, worldTime: 100 });
    assert.equal(outside.round, -1);
    assert.equal(smokeActive(outside, { round: null, worldTime: 111 }), true);
    assert.equal(smokeActive(outside, { round: null, worldTime: 112 }), false);
    assert.equal(smokeActive(null, { worldTime: 0 }), false);
  });

  test('Armor and Shield come off the Power with Hardening (TN at least 2)', () => {
    assert.equal(matrixSoakTn(8, 2, 3), 3);
    assert.equal(matrixSoakTn(5, 2, 4), 2);
    assert.equal(matrixSoakTn(6, 0, 0), 6);
  });

  test('frames and agents: what they carry, an agent\'s dice and Detection Factor, agent program size', () => {
    assert.equal(carryLimit(4), 4);
    assert.deepEqual(agentDice(5), { dice: 5, pool: 2 });
    assert.equal(agentDetectionFactor(5, 4), 5);               // (5 + 4) / 2 rounded up
    assert.equal(agentDetectionFactor(3, 0), 2);               // minimum 2
    assert.equal(utilitySize('agent', 4), 16 * 6);
  });

  test('grid travel: only hops between grids count', () => {
    const rtg: GridNode = { uuid: 'R', gridKind: 'rtg', parentUuid: '' };
    const rtg2: GridNode = { uuid: 'R2', gridKind: 'rtg', parentUuid: '' };
    const l1: GridNode = { uuid: 'L1', gridKind: 'ltg', parentUuid: 'R' };
    const l2: GridNode = { uuid: 'L2', gridKind: 'ltg', parentUuid: 'R' };
    const l3: GridNode = { uuid: 'L3', gridKind: 'ltg', parentUuid: 'R2' };
    const h1: GridNode = { uuid: 'H1', gridKind: 'host', parentUuid: 'L1' };
    const h2: GridNode = { uuid: 'H2', gridKind: 'host', parentUuid: 'L2' };
    const all = [rtg, rtg2, l1, l2, l3, h1, h2];
    assert.equal(gridHops(null, l1, all), 0);                   // a jackpoint into an LTG
    assert.equal(gridHops(l1, h1, all), 0);                     // into a host from its own grid
    assert.equal(gridHops(h1, l1, all), 0);
    assert.equal(gridHops(l1, rtg, all), 1);
    assert.equal(gridHops(l1, l2, all), 2);                     // LTG → RTG → LTG
    assert.equal(gridHops(h1, h2, all), 2);
    assert.equal(gridHops(l1, l3, all), 3);                     // LTG → RTG, RTG → RTG2, RTG2 → LTG
    assert.equal(travelTurns(2), 2 * RULES.MATRIX.travel.turnsPerHop);
  });
});
