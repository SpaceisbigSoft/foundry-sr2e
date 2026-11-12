import { test, describe } from 'node:test';
import assert from '../../__tests__/helpers/assert-rows.ts';
import {
  RULES, partyInitiative, partyInitiativeUpdates, constructBehaviors, normalizeNumber, numberMatches, learnNumbers,
  signalRangeKm, signalCheck, wirelessConnection, programDesign, workDays, deckPartPlan, tortoisePool, iccmDice, otakuPersona,
  jamTarget, sensorModeEffect, bearingDeg, inArc, cargoLoad, autosoftDice, modificationDef, modificationEffect, applyStatDelta,
  concealmentEffect, concealmentFromName, tamperTn, tamperTrips, bypassTime, chasePlacement, utilitySize, operation,
} from '../index.ts';
// v0.92.3: these tests pin the v0.92.2 Matrix rules (the book's defaults: v0923-matrix.test.ts).
import { before as before922, after as after922 } from 'node:test';
import { matrix922 } from '../../__tests__/helpers/matrix922.ts';
let undo922: () => void = () => {};
before922(() => { undo922 = matrix922(); });
after922(() => undo922());

const withRule = (obj: any, key: string, value: unknown, fn: () => void) => { const old = obj[key]; obj[key] = value; try { fn(); } finally { obj[key] = old; } };

describe('v0.46.0 party and construct IC', () => {
  test('a party acts on its best member\'s score; members without a party are left alone', () => {
    assert.equal(partyInitiative([12, null, 19, 7]), 19);
    assert.equal(partyInitiative([null, undefined]), null);
    const ups = partyInitiativeUpdates([
      { id: 'a', party: 'P', initiative: 12 }, { id: 'b', party: 'P', initiative: 19 }, { id: 'c', party: ' P ', initiative: null },
      { id: 'd', party: '', initiative: 3 }, { id: 'e', party: 'Q', initiative: 5 },
    ]);
    assert.deepEqual(ups, [{ _id: 'a', initiative: 19 }, { _id: 'c', initiative: 19 }]);
    withRule(RULES.MATRIX.party, 'sharedInitiative', false, () => assert.deepEqual(partyInitiativeUpdates([{ id: 'a', party: 'P', initiative: 1 }, { id: 'b', party: 'P', initiative: 9 }]), []));
  });
  test('a construct acts as its own behavior first, then its components, unique and capped', () => {
    assert.deepEqual(constructBehaviors('killer', ['trace', 'killer', 'bogus', 'probe']), ['killer', 'trace', 'probe']);
    withRule(RULES.MATRIX.construct, 'maxComponents', 2, () => assert.deepEqual(constructBehaviors('killer', ['trace', 'probe']), ['killer', 'trace']));
    assert.deepEqual(constructBehaviors('barrier', []), ['barrier']);
  });
});

describe('v0.46.0 LTG numbers and signal range', () => {
  test('numbers compare by letters and digits; learning keeps them unique', () => {
    assert.equal(normalizeNumber('na/ucas-sea 2206'), 'NAUCASSEA2206');
    assert.ok(numberMatches('NA/UCAS-SEA-2206', 'na ucas sea 2206'));
    assert.ok(!numberMatches('', ''));
    assert.deepEqual(learnNumbers(['NA/UCAS-SEA-2206'], ['na-ucas-sea-2206', ' 1-206 ', '--']), ['NA/UCAS-SEA-2206', '1-206']);
  });
  test('range by signal rating; near the edge adds TN; out of range; 0 km is not checked', () => {
    // v0.79.0: the Rigger 2 flux range table (250 m … 25 km; 10+: 2 × Flux + 10 km).
    assert.equal(signalRangeKm(0), 0.25);
    assert.equal(signalRangeKm(3), 4);
    assert.equal(signalRangeKm(99), 2 * 99 + 10);
    const near = signalCheck(3, 3.5);
    assert.ok(near.checked && near.inRange && near.far);
    assert.deepEqual(near.modifiers, [{ label: 'Weak signal', value: 1 }]);
    const ok = signalCheck(3, 2);
    assert.ok(ok.inRange && !ok.far && ok.modifiers.length === 0);
    const out = signalCheck(2, 5);
    assert.ok(out.checked && !out.inRange);
    assert.match(out.note, /out of range \(signal 2 reaches 2 km\)/);
    assert.equal(signalCheck(0, 0).checked, false);
    assert.match(signalCheck(1, 0.2).note, /200 m of 1 km/);
    assert.ok(wirelessConnection('cellular') && wirelessConnection('remote') && !wirelessConnection('jackpoint') && !wirelessConnection('satellite'));
  });
});

describe('v0.46.0 programming and deck building', () => {
  test('a program\'s size, TN and base time', () => {
    const p = programDesign({ kind: 'attack', rating: 4, damageLevel: 'S' });
    assert.equal(p.size, utilitySize('attack', 4, 'S'));
    assert.equal(p.tn, 4);
    assert.equal(p.baseDays, p.size);
    assert.equal(programDesign({ kind: 'browse', rating: 1 }).tn, 2);
    assert.equal(workDays(64, 3), 22);
    assert.equal(workDays(64, 0), null);
    assert.equal(workDays(1, 5), 1);
  });
  test('deck parts: TN, time and cost (MPCP squared), warnings above MPCP', () => {
    const m = deckPartPlan('mpcp', 6, 0)!;
    assert.deepEqual([m.tn, m.baseDays, m.cost], [6, 72, 36000]);
    const e = deckPartPlan('evasion', 5, 4)!;
    assert.deepEqual([e.tn, e.baseDays, e.cost], [5, 10, 2500]);
    assert.deepEqual(e.warnings, ['Evasion 5 is above the deck\'s MPCP 4']);
    const h = deckPartPlan('hardening', 2, 6)!;
    assert.equal(h.tn, 4);
    assert.match(deckPartPlan('responseIncrease', 4, 8)!.warnings[0]!, /only up to 3/);
    assert.equal(deckPartPlan('nope', 1, 1), null);
  });
});

describe('v0.46.0 tortoises, ICCM, otaku', () => {
  test('tortoise pool, ICCM dice, an otaku persona from attributes', () => {
    assert.equal(tortoisePool(7), 3);
    assert.equal(iccmDice(2), 2);
    assert.equal(iccmDice(0), 0);
    const o = otakuPersona({ intelligence: 6, willpower: 5, charisma: 4 });
    assert.deepEqual(o, { mpcp: 5, bod: 5, evasion: 5, masking: 4, sensors: 5, hardening: 0, responseIncrease: 0, activeMemory: 500 });
  });
});

describe('v0.46.0 jamming, sensors, arcs, cargo, autosofts, modifications', () => {
  test('jamming TN from the signal and ECCM', () => {
    assert.equal(jamTarget({ signal: 4, eccm: 2 }), 6);
    withRule(RULES.RIGGING.jamming, 'eccmAddsTn', false, () => assert.equal(jamTarget({ signal: 4, eccm: 2 }), 4));
    assert.equal(jamTarget({ signal: 0 }), 2);
  });
  test('passive sensors: +TN and unnoticed', () => {
    assert.deepEqual(sensorModeEffect('active'), { modifiers: [], noticeable: true });
    assert.deepEqual(sensorModeEffect('passive'), { modifiers: [{ label: 'Passive sensors', value: 2 }], noticeable: false });
  });
  test('bearings and arcs from the token rotation', () => {
    assert.equal(bearingDeg(0, -10), 0);
    assert.equal(bearingDeg(10, 0), 90);
    assert.equal(bearingDeg(0, 10), 180);
    assert.equal(bearingDeg(-10, 0), 270);
    assert.deepEqual(inArc('front', 0, 30), { inside: true, offBy: 0 });
    assert.deepEqual(inArc('front', 0, 90), { inside: false, offBy: 45 });
    assert.ok(inArc('rear', 0, 180).inside);
    assert.ok(inArc('left', 90, 0).inside);
    assert.ok(inArc('front', 350, 20).inside);
    assert.ok(inArc('', 0, 180).inside);
    withRule(RULES.VEHICLES.arcs, 'facingOffset', 180, () => assert.ok(inArc('front', 0, 180).inside));
  });
  test('cargo and load', () => {
    assert.deepEqual(cargoLoad({ itemsKg: 150, people: 2, load: 300 }), { kg: 350, load: 300, over: true, tracked: true, cf: 2 * RULES.VEHICLES.cargo.personCf, cargoFactor: 0, overCf: false, overKg: true });
    assert.equal(cargoLoad({ itemsKg: 500, people: 0, load: 0 }).over, false);
  });
  test('autosofts capped at the Pilot', () => {
    assert.equal(autosoftDice(4, 2), 2);
    withRule(RULES.VEHICLES.autosofts, 'capAtPilot', false, () => assert.equal(autosoftDice(4, 2), 4));
  });
  test('modifications: stat change and cost (some by Body); Handling never below 1', () => {
    assert.equal(modificationDef('armor')!.stat, 'armor');
    assert.deepEqual(modificationEffect('armor', 2, 3), { stat: 'armor', delta: 2, cost: 6000, label: 'Extra armor' });
    assert.deepEqual(modificationEffect('handling', 1, 3), { stat: 'handling', delta: -1, cost: 5000, label: 'Handling upgrade' });
    assert.equal(modificationEffect('adaptation', 1, 4).stat, '');
    assert.equal(applyStatDelta('handling', 2, -3), 1);
    assert.equal(applyStatDelta('armor', 1, -3), 0);
  });
});

describe('v0.46.0 security: senses, tamper alarms, bypass time; chases', () => {
  test('concealment against senses', () => {
    assert.deepEqual(concealmentEffect('visual', 'improvedInvisibility', 3), { blind: true, modifiers: [] });
    assert.deepEqual(concealmentEffect('visual', 'invisibility', 3), { blind: false, modifiers: [] });
    assert.deepEqual(concealmentEffect('visual', 'chameleon', 4), { blind: false, modifiers: [{ label: 'Chameleon suit 4', value: 4 }] });
    assert.deepEqual(concealmentEffect('thermal', 'thermal', 2).modifiers, [{ label: 'Thermal masking 2', value: 2 }]);
    assert.deepEqual(concealmentEffect('ultrasound', 'improvedInvisibility', 6), { blind: false, modifiers: [] });
    assert.deepEqual(concealmentEffect('', 'improvedInvisibility', 6), { blind: false, modifiers: [] });
    assert.equal(concealmentEffect('visual', 'improvedInvisibility', 0).blind, false);
    assert.equal(concealmentFromName('Improved Invisibility'), 'improvedInvisibility');
    assert.equal(concealmentFromName('Invisibility'), 'invisibility');
    assert.equal(concealmentFromName('Ruthenium suit'), 'chameleon');
    assert.equal(concealmentFromName('Fireball'), '');
  });
  test('tamper alarms and bypass time', () => {
    assert.equal(tamperTn(5), 5);
    assert.equal(tamperTn(0), 2);
    withRule(RULES.SECURITY.tamper, 'tnFrom', 'fixed', () => assert.equal(tamperTn(6), 4));
    assert.ok(tamperTrips(2, 2) && !tamperTrips(1, 2) && !tamperTrips(0, 0));
    assert.deepEqual(bypassTime('maglock', 3), { turns: 7, seconds: 21 }); // v0.77.0: the circuit 60 s base
    assert.deepEqual(bypassTime('casing', 2), { turns: 10, seconds: 30 }); // v0.77.0: the casing step, 60 s base
    assert.deepEqual(bypassTime('weird', 10), { turns: 1, seconds: 3 });
    assert.equal(bypassTime('maglock', 0), null);
  });
  test('the pursuer goes the gap behind the quarry on the line between them', () => {
    assert.deepEqual(chasePlacement({ x: 0, y: 0 }, { x: 300, y: 0 }, 2, 100), { x: 200, y: 0 });
    assert.deepEqual(chasePlacement({ x: 0, y: 0 }, { x: 0, y: 0 }, 1, 100), { x: 0, y: 100 });
  });
  test('the operations catalog has upload and locate number', () => {
    assert.equal(operation('uploadData')!.effect, 'upload');
    assert.equal(operation('locateNumber')!.subsystem, 'index');
  });
});
