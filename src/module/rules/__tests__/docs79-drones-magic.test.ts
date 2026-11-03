/**
 * v0.79.0 (drones_magic): the verified fixes for rigging and sorcery (RULES.DOCS_V79). Each switch defaults to
 * the documents' way; the old way is checked through oldWay().
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { RULES } from '../config.ts';
import { oldWay } from './oldway.ts';
import {
  riggerDumpShock, baseFlux, rcdFlux, fluxRangeKm, magicPoolBase, sorceryRating, castingPoolDice, castingPoolMax,
} from '../docs79-drones-magic.ts';

describe('v0.79.0 rigger dump shock (DOCS_V79.riggerDumpShock)', () => {
  test('Rigger 2 p64: (RCD rating + 4)S Stun, resisted with Body', () => {
    assert.deepEqual(riggerDumpShock({ rcdRating: 3 }), { attribute: 'body', tn: 7, level: 'S', type: 'stun' });
    assert.deepEqual(riggerDumpShock({ rcdRating: 6 }), { attribute: 'body', tn: 10, level: 'S', type: 'stun' });
  });
  test('no deck (jumped in aboard): the old values', () => {
    const old = RULES.RIGGING.dumpShock;
    assert.deepEqual(riggerDumpShock({ rcdRating: 0 }), { attribute: 'willpower', tn: old.tn, level: old.level, type: old.type });
    assert.deepEqual(riggerDumpShock(), { attribute: 'willpower', tn: 6, level: 'M', type: 'stun' });
  });
  test('the old way: Willpower vs 6, M Stun, whatever the deck', (t) => {
    t.after(oldWay({ 'DOCS_V79.riggerDumpShock.mode': 'willpower' }));
    assert.deepEqual(riggerDumpShock({ rcdRating: 4 }), { attribute: 'willpower', tn: 6, level: 'M', type: 'stun' });
  });
});

describe('v0.79.0 flux (DOCS_V79.signalFlux)', () => {
  test('base flux by device (Rigger 2 flux rating table)', () => {
    assert.equal(baseFlux('rcd', 6), 2);
    assert.equal(baseFlux('sensor', 3), 5);                   // 4.5 rounds up
    assert.equal(baseFlux('ecm', 4), 6);
    assert.equal(baseFlux('cyberware', 5), 0);
    assert.equal(baseFlux('other', 5), 5);
  });
  test('a deck with its own signal keeps it; without one it is flux 2', () => {
    assert.equal(rcdFlux({ signal: 4, rcdRating: 6 }), 4);
    assert.equal(rcdFlux({ signal: 0, rcdRating: 6 }), 2);
  });
  test('the old way: every device at its rating', (t) => {
    t.after(oldWay({ 'DOCS_V79.signalFlux.base': 'rating' }));
    assert.equal(baseFlux('rcd', 6), 6);
    assert.equal(baseFlux('sensor', 3), 3);
    assert.equal(baseFlux('cyberware', 5), 5);
    assert.equal(rcdFlux({ rcdRating: 6 }), 6);
  });
  test('range past the table: (2 × flux) + 10 km', () => {
    const n = RULES.SIGNAL.rangeKm.length;
    assert.equal(fluxRangeKm(n), 2 * n + 10);
    assert.equal(fluxRangeKm(12), RULES.SIGNAL.rangeKm.length <= 12 ? 34 : RULES.SIGNAL.rangeKm[12]);
    assert.equal(fluxRangeKm(-1), RULES.SIGNAL.rangeKm[0]);
  });
  test('the book table (Rigger 2 flux range table), once RULES.SIGNAL.rangeKm carries it', (t) => {
    t.after(oldWay({ 'SIGNAL.rangeKm': [0.25, 1, 2, 4, 6, 9, 12, 16, 20, 25] }));
    assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15].map(fluxRangeKm), [0.25, 1, 2, 4, 6, 9, 12, 16, 20, 25, 30, 40]);
  });
  test('perFlux and plusKm 0: the last entry (old)', (t) => {
    t.after(oldWay({ 'SIGNAL.rangeKm': [0, 1, 3, 10, 30, 100, 300, 1000, 3000, 10000], 'DOCS_V79.signalFlux.perFlux': 0, 'DOCS_V79.signalFlux.plusKm': 0 }));
    assert.equal(fluxRangeKm(3), 10);
    assert.equal(fluxRangeKm(99), 10000);
  });
});

describe('v0.79.0 Spell (Magic) Pool (DOCS_V79.magicPool)', () => {
  const who = { sorcery: 5, intelligence: 4, willpower: 5, magic: 6 };
  test('SR2 p85: the Sorcery rating; nothing without Magic', () => {
    assert.equal(magicPoolBase(who), 5);
    assert.equal(magicPoolBase({ ...who, sorcery: 0 }), 0);
    assert.equal(magicPoolBase({ ...who, magic: 0 }), 0);
  });
  test('the old way: (Intelligence + Willpower + Magic) ÷ 3', (t) => {
    t.after(oldWay({ 'DOCS_V79.magicPool.size': 'attributes' }));
    assert.equal(magicPoolBase(who), 5);
    assert.equal(magicPoolBase({ ...who, sorcery: 0 }), 5);
    assert.equal(magicPoolBase({ sorcery: 6, intelligence: 4, willpower: 4, magic: 4 }), 4);
    assert.equal(magicPoolBase({ ...who, magic: 0 }), 0);
  });
  test('the Sorcery rating among the items', () => {
    assert.equal(sorceryRating([{ type: 'skill', name: 'Conjuring', system: { rating: 6 } }, { type: 'skill', name: ' sorcery ', system: { rating: 4 } }]), 4);
    assert.equal(sorceryRating([{ type: 'spell', name: 'Sorcery', system: { rating: 6 } }]), 0);
    assert.equal(sorceryRating(null), 0);
  });
  test('SR2 p85: pool dice on the casting test capped at Magic', () => {
    assert.equal(castingPoolDice(7, 4), 4);
    assert.equal(castingPoolDice(3, 4), 3);
    assert.equal(castingPoolMax(6, 5), 5);
  });
  test('the old way: no cap', (t) => {
    t.after(oldWay({ 'DOCS_V79.magicPool.castingCap': 'none' }));
    assert.equal(castingPoolDice(7, 4), 7);
    assert.equal(castingPoolMax(6, 5), 6);
  });
});

test('v0.79.0: a decker\'s Matrix link keeps the old signal table; rigging uses the Rigger 2 flux table', async () => {
  const { signalCheck } = await import('../netrig.ts');
  assert.equal(signalCheck(3, 5, 'matrix').inRange, true);   // old table: signal 3 reaches 10 km
  assert.equal(signalCheck(3, 5).inRange, false);            // flux 3 reaches 4 km
});
