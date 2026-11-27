/**
 * v0.95.0 rules completeness (area: ranged combat): the pure rules of RULES.FIRE_V95 (rules/fire95.ts), each the
 * book's way (the shipped default, or switched on for the two optional rules) and the v0.94.2 way.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { RULES } from '../rules/index.ts';
import * as R95 from '../rules/fire95.ts';
import { oldWay } from '../rules/__tests__/oldway.ts';
import { urrMode } from '../rules/__tests__/urrmode.ts';
import { HOUSE_FIRE_V95 } from '../rules/config95/fire.ts';
import { t as tx } from '../helpers/i18n.ts';

describe('v0.95.0 fire: the switches', () => {
  test('book rules ship on, the two optional rules ship off; every switch has a house-rule row with a label', () => {
    const F = RULES.FIRE_V95;
    assert.deepEqual([F.laser, F.sharedRecoil, F.aimPool, F.misfire, F.shotScreen, F.rebound], ['book', 'book', 'book', 'book', 'book', 'book']);
    assert.deepEqual([F.stray, F.suppression], ['off', 'house']);
    assert.equal(HOUSE_FIRE_V95.length, 8);
    for (const row of HOUSE_FIRE_V95) {
      const key = row.path.split('.')[1] as keyof typeof F;
      assert.ok(row.choices!.includes(String(F[key])), row.path);
      // the first choice is the book's way
      assert.ok(['book', 'fof'].includes(row.choices![0]!), row.path);
      const label = `SR2E.HouseRules.Rule.${row.path.replace('.', '__')}`;
      assert.notEqual(tx(label), label);
    }
  });
});

describe('v0.95.0 fire: laser sight in bad air (Core p. 90)', () => {
  test('book: mist, fog and rain cancel it, and so does smoke on the line; clear air does not', () => {
    for (const w of ['mist', 'lightRain', 'heavyRain', 'fog', 'heavyFog', 'storm']) assert.equal(R95.laserCancelled({ weather: w }), 'weather', w);
    assert.equal(R95.laserCancelled({ weather: 'clear' }), '');
    assert.equal(R95.laserCancelled({}), '');
    assert.equal(R95.laserCancelled({ weather: 'clear', smoke: true }), 'smoke');
  });
  test('off: never by itself; the Revamp source changes nothing', (t) => {
    const undo = urrMode();
    assert.equal(R95.laserCancelled({ weather: 'fog' }), 'weather');
    undo();
    t.after(oldWay({ 'FIRE_V95.laser': 'off' }));
    assert.equal(R95.laserCancelled({ weather: 'fog', smoke: true }), '');
  });
});

describe('v0.95.0 fire: two firearms (Core p. 90)', () => {
  test('in play only with the second-firearm tick', (t) => {
    assert.equal(R95.sharedRecoilOn(['secondWeapon']), true);
    assert.equal(R95.sharedRecoilOn(['smartlink']), false);
    assert.equal(R95.sharedRecoilOn(null), false);
    t.after(oldWay({ 'FIRE_V95.sharedRecoil': 'off' }));
    assert.equal(R95.sharedRecoilOn(['secondWeapon']), false);
  });
  test('each gun keeps its own rounds; the other gun\'s rounds and left-over recoil are shared', () => {
    let s = R95.twoGunRecord(null, 'p1', 'a', { ownEarlier: 0, rounds: 3, recoil: 1, firstSingle: false });
    assert.deepEqual(R95.twoGunShare(s, 'p1', 'b'), { otherRounds: 3, shared: 1, ownRounds: 0 });
    s = R95.twoGunRecord(s, 'p1', 'b', { ownEarlier: 0, rounds: 1, recoil: 1, firstSingle: true });
    assert.deepEqual(R95.twoGunShare(s, 'p1', 'a'), { otherRounds: 1, shared: 1, ownRounds: 3, firstSingle: false });
    s = R95.twoGunRecord(s, 'p1', 'a', { ownEarlier: 3, rounds: 3, recoil: 4, firstSingle: true });
    assert.deepEqual(s.guns['a'], { rounds: 6, recoil: 4, firstSingle: false });        // the first shot's mark stays
  });
  test('another Combat Phase starts clean; odd flag data is bounded', () => {
    const s = R95.twoGunRecord(null, 'p1', 'a', { ownEarlier: 0, rounds: 3, recoil: 2 });
    assert.deepEqual(R95.twoGunShare(s, 'p2', 'b'), { otherRounds: 0, shared: 0, ownRounds: 0 });
    assert.deepEqual(R95.twoGunRecord(s, 'p2', 'b', { ownEarlier: 0, rounds: 1, recoil: 0 }).guns, { b: { rounds: 1, recoil: 0 } });
    assert.deepEqual(R95.twoGunShare({ phase: 'p1', guns: { x: { rounds: 1e9, recoil: -5 } } } as any, 'p1', 'b'), { otherRounds: 999, shared: 0, ownRounds: 0 });
    assert.deepEqual(R95.twoGunShare({ phase: 'p1', guns: null } as any, 'p1', 'b'), { otherRounds: 0, shared: 0, ownRounds: 0 });
  });
});

describe('v0.95.0 fire: an aim over several phases and pool dice (Core p. 82)', () => {
  test('the aim remembers the phase it began in while it is held', () => {
    assert.equal(R95.aimStartPhase(null, 1, 'p1'), 'p1');
    assert.equal(R95.aimStartPhase({ phase95: 'p1', actions: 1 }, 2, 'p2'), 'p1');
    assert.equal(R95.aimStartPhase({ phase95: 'p1', actions: 3 }, 1, 'p2'), 'p2');      // a fresh aim
    assert.equal(R95.aimStartPhase({ actions: 1 }, 2, 'p2'), 'p2');                      // an aim saved before v0.95.0
  });
  test('book: pool dice lose an aim begun in an earlier phase, not one begun in this phase', () => {
    assert.equal(R95.aimLostToPool({ phase95: 'p1', actions: 2 }, 'p2', 1), true);
    assert.equal(R95.aimLostToPool({ phase95: 'p2', actions: 1 }, 'p2', 3), false);
    assert.equal(R95.aimLostToPool({ phase95: 'p1', actions: 2 }, 'p2', 0), false);
    assert.equal(R95.aimLostToPool({ actions: 2 }, 'p2', 2), false);
    assert.equal(R95.aimLostToPool(null, 'p2', 2), false);
    assert.equal(R95.aimLostToPool({ phase95: 'p1', actions: 2 }, null, 2), false);      // out of combat
  });
  test('off: pool dice don\'t matter', (t) => {
    t.after(oldWay({ 'FIRE_V95.aimPool': 'off' }));
    assert.equal(R95.aimLostToPool({ phase95: 'p1', actions: 2 }, 'p2', 1), false);
  });
});

describe('v0.95.0 fire: explosive rounds (Core p. 93)', () => {
  test('book: all ones with explosive rounds misfires; other rounds, melee and blasts never', () => {
    assert.equal(R95.misfires({ ammoId: 'explosive', botch: true }), true);
    assert.equal(R95.misfires({ ammoId: 'explosive', botch: false }), false);
    assert.equal(R95.misfires({ ammoId: 'standard', botch: true }), false);
    assert.equal(R95.misfires({ ammoId: '', botch: true }), false);
    assert.equal(R95.misfires({ ammoId: 'explosive', botch: true, melee: true }), false);
    assert.equal(R95.misfires({ ammoId: 'explosive', botch: true, blast: true }), false);
  });
  test('the hit on the shooter: the normal round, 1D6 attack successes', () => {
    assert.deepEqual(R95.misfireHit({ power: 9, level: 'M', die: 4 }), { power: 9, level: 'M', successes: 4 });
    assert.equal(R95.misfireHit({ power: 9, level: 'M', die: 99 }).successes, 6);
    assert.equal(R95.misfireHit({ power: 9, level: 'M', die: 0 }).successes, 1);
  });
  test('off: no misfire', (t) => {
    t.after(oldWay({ 'FIRE_V95.misfire': 'off' }));
    assert.equal(R95.misfires({ ammoId: 'explosive', botch: true }), false);
  });
});

describe('v0.95.0 fire: shotgun shot (Core p. 95)', () => {
  test('book: one extra die per other target closer to the gun', () => {
    assert.deepEqual(R95.shotScreens([{ id: 'a', metres: 4 }, { id: 'b', metres: 9 }, { id: 'c', metres: 6 }, { id: 'd', metres: 9 }]), { b: 2, c: 1, d: 2 });
    assert.deepEqual(R95.shotScreens([{ id: 'a', metres: 4 }]), {});
    assert.equal(R95.shotScreenDice(3), 3);
    assert.equal(R95.shotScreenDice(1e6), 10);
    assert.equal(R95.shotScreenDice('x'), 0);
  });
  test('off: none', (t) => {
    t.after(oldWay({ 'FIRE_V95.shotScreen': 'off' }));
    assert.deepEqual(R95.shotScreens([{ id: 'a', metres: 4 }, { id: 'b', metres: 9 }]), {});
    assert.equal(R95.shotScreenDice(3), 0);
  });
});

describe('v0.95.0 fire: blast in a confined space (Core p. 98)', () => {
  const block = () => oldWay({ 'COMBAT_V72.blastBarriers.mode': 'block' });               // every wall holds
  test('book: a wave of 6 passing, back at 2 from the wall behind the target: 2 more', (t) => {
    t.after(block());
    // Power 10, −1 per metre: target at 4 m (6 passing), a wall 2 m past it: back after 8 m with 2.
    assert.deepEqual(R95.reboundPower({ power: 10, perMetre: 1, metres: 4, ahead: { metres: 6, rating: 8 } }), { extra: 2, passes: [2] });
  });
  test('book: a small room: the wave comes back off both walls until it has no Power', (t) => {
    t.after(block());
    // Target 1 m from the blast, walls 2 m past the blast on both sides (a 4 m room): passes after 3, 5, 7 and 9 m.
    const r = R95.reboundPower({ power: 10, perMetre: 1, metres: 1, ahead: { metres: 2, rating: 8 }, behind: { metres: 2, rating: 8 } })!;
    assert.deepEqual(r.passes, [7, 5, 3, 1]);
    assert.equal(r.extra, 16);
  });
  test('book: no wall, or the wave spent before the wall or before it is back: nothing', (t) => {
    t.after(block());
    assert.deepEqual(R95.reboundPower({ power: 10, perMetre: 1, metres: 4 }), { extra: 0, passes: [] });
    assert.deepEqual(R95.reboundPower({ power: 6, perMetre: 1, metres: 2, ahead: { metres: 6, rating: 8 } }), { extra: 0, passes: [] });
    assert.deepEqual(R95.reboundPower({ power: 10, perMetre: 2, metres: 1, ahead: { metres: 3, rating: 8 } }), { extra: 0, passes: [] });
  });
  test('book: a wall the blast breaks sends nothing back; one that holds does (the blast-through-walls test)', () => {
    assert.equal(RULES.COMBAT_V72.blastBarriers.mode, 'rating');
    const hold = Number(RULES.COMBAT_V72.blastBarriers.holdMultiplier);
    assert.equal(R95.wallHolds(4, { metres: 6, rating: 4 / hold }), true);
    assert.equal(R95.wallHolds(4, { metres: 6, rating: 4 / hold - 1 }), false);
    // Power 4 at the wall (6 m): a weak wall breaks, a strong one sends 2 back to the target at 4 m.
    assert.deepEqual(R95.reboundPower({ power: 10, perMetre: 1, metres: 4, ahead: { metres: 6, rating: 4 / hold - 1 } }), { extra: 0, passes: [] });
    assert.deepEqual(R95.reboundPower({ power: 10, perMetre: 1, metres: 4, ahead: { metres: 6, rating: 4 / hold } }), { extra: 2, passes: [2] });
  });
  test('the passes are bounded; the old way and the confined switch give null', (t) => {
    const undo = block();
    const r = R95.reboundPower({ power: 100, perMetre: 0, metres: 1, ahead: { metres: 2, rating: 8 }, behind: { metres: 2, rating: 8 } })!;
    assert.equal(r.passes.length, RULES.FIRE_V95.reboundPasses);
    undo();
    const off = oldWay({ 'COMBAT.confined.enabled': false });
    assert.equal(R95.reboundPower({ power: 10, perMetre: 1, metres: 4, ahead: { metres: 6, rating: 99 } }), null);
    off();
    t.after(oldWay({ 'FIRE_V95.rebound': 'nearest' }));
    assert.equal(R95.reboundBook(), false);
    assert.equal(R95.reboundPower({ power: 10, perMetre: 1, metres: 4, ahead: { metres: 6, rating: 99 } }), null);
  });
});

describe('v0.95.0 fire: stray shots (Core p. 93, optional)', () => {
  test('ships off: no stray rounds', () => {
    assert.equal(R95.strayOn(), false);
    assert.equal(R95.strayRounds(4, false), 0);
  });
  test('book: one stray round per round wasted, none from a smartlinked smartgun; a hit adds 1D6 successes', (t) => {
    t.after(oldWay({ 'FIRE_V95.stray': 'book' }));
    assert.equal(R95.strayRounds(4, false), 4);
    assert.equal(R95.strayRounds(4, true), 0);
    assert.deepEqual(R95.strayHit(0, 6), { hit: false, successes: 0 });
    assert.deepEqual(R95.strayHit(1, 4), { hit: true, successes: 5 });
    assert.deepEqual(R95.strayHit(2, 9), { hit: true, successes: 8 });
  });
  test('the order is random and keeps everyone; the arc between two targets', () => {
    const seq = [0.9, 0.1, 0.5];
    const out = R95.strayOrder(['a', 'b', 'c', 'd'], () => seq.shift() ?? 0);
    assert.deepEqual([...out].sort(), ['a', 'b', 'c', 'd']);
    assert.notDeepEqual(out, ['a', 'b', 'c', 'd']);
    const deg = (d: number) => (d * Math.PI) / 180;
    assert.equal(R95.inSweep(deg(10), deg(50), deg(30)), true);
    assert.equal(R95.inSweep(deg(50), deg(10), deg(30)), true);
    assert.equal(R95.inSweep(deg(10), deg(50), deg(60)), false);
    assert.equal(R95.inSweep(deg(10), deg(50), deg(55), deg(6)), true);
    assert.equal(R95.inSweep(deg(170), deg(-170), deg(180)), true);                      // across the ±180° seam, the short way
    assert.equal(R95.inSweep(deg(170), deg(-170), deg(0)), false);
  });
});

describe('v0.95.0 fire: suppressive fire (Fields of Fire p. 78, optional)', () => {
  test('ships the house way', () => { assert.equal(R95.suppressionFof(), false); });
  test('the area: a round a metre at least, the rounds spread evenly', () => {
    assert.deepEqual(R95.fofArea(10, 5), { rounds: 10, metres: 5, perMetre: 2, phases: 10, even: true });
    assert.deepEqual(R95.fofArea(10, 3), { rounds: 10, metres: 3, perMetre: 3, phases: 10, even: false });   // refused by the dialog
    assert.deepEqual(R95.fofArea(4, 9), { rounds: 4, metres: 4, perMetre: 1, phases: 10, even: true });
    assert.deepEqual(R95.fofArea(0, 3), { rounds: 0, metres: 0, perMetre: 0, phases: 10, even: false });
  });
  test('the test: a die per round on the metre against 4 + cover + the shooter\'s wounds; a hit per 2 successes', () => {
    assert.deepEqual(R95.fofTest({ perMetre: 5 }), { dice: 5, tn: 4 });
    assert.deepEqual(R95.fofTest({ perMetre: 5, cover: 4, wounds: 2 }), { dice: 5, tn: 10 });
    assert.equal(R95.fofHits(5, 5), 2);
    assert.equal(R95.fofHits(1, 5), 0);
    assert.equal(R95.fofHits(9, 3), 3);                                                  // at most the rounds there
  });
  test('the 10 Combat Phases: turns counted from where it was laid, in the same combat only', () => {
    const at = { combatId: 'c', round: 1, pass: 0, turn: 1 };
    assert.equal(R95.phasesSince(at, { combatId: 'c', round: 1, pass: 0, turn: 3 }, 4), 2);
    assert.equal(R95.phasesSince(at, { combatId: 'c', round: 1, pass: 1, turn: 0 }, 4), 3);
    assert.equal(R95.phasesSince(at, { combatId: 'c', round: 2, pass: 0, turn: 0 }, 4), 3);       // the rest of the turn
    assert.equal(R95.phasesSince(at, { combatId: 'c', round: 3, pass: 1, turn: 2 }, 4), 3 + 4 + 4 + 2);
    assert.equal(R95.phasesSince(at, { combatId: 'c', round: 0, pass: 0, turn: 0 }, 4), 0);
    assert.equal(R95.phasesSince(at, { combatId: 'd', round: 1, pass: 0, turn: 3 }, 4), null);
    assert.equal(R95.phasesSince(null, { combatId: 'c', round: 1, pass: 0, turn: 3 }, 4), null);
    assert.equal(R95.fofActive(at, { combatId: 'c', round: 3, pass: 0, turn: 2 }, 4), true);       // 9
    assert.equal(R95.fofActive(at, { combatId: 'c', round: 3, pass: 0, turn: 3 }, 4), false);      // 10
    assert.equal(R95.fofActive(at, null, 4), false);
  });
});

describe('v0.95.0 fire: review fixes (pure)', () => {
  test('rebound: no wave comes back when walls don\'t stop blasts', (t) => {
    t.after(oldWay({ 'COMBAT.wallsBlock': false, 'COMBAT_V72.blastBarriers.mode': 'block' }));
    assert.equal(R95.reboundPower({ power: 10, perMetre: 1, metres: 4, ahead: { metres: 6, rating: 8 } }), null);
  });
  test('rebound: a wall rated 0 (damaged through) doesn\'t hold', () => {
    assert.equal(R95.wallHolds(4, { metres: 6, rating: 0 }), false);
    assert.deepEqual(R95.reboundPower({ power: 10, perMetre: 1, metres: 4, ahead: { metres: 6, rating: 0 } }), { extra: 0, passes: [] });
  });
});
