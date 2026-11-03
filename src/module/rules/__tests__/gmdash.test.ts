/** v0.68.0: the GM dashboard's pure parts: party cards, mook stat lines, the tracker's groups and pass banner. */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  poolChips, partyCard, mookLine, readMookCards, writeMookCards, MOOK_CARDS_KEY, trackerGroups, passBanner,
} from '../gmdash.ts';
import * as rules from '../index.ts';

describe('party cards', () => {
  test('pool chips: only pools the character has, in order, clamped', () => {
    const chips = poolChips({ karma: [1, 3], combat: [2, 7], spell: [0, 0], hacking: [9, 4], control: undefined });
    assert.deepEqual(chips.map((c) => `${c.label} ${c.text}`), ['Combat 2/7', 'Hacking 4/4', 'Karma 1/3']);
    assert.equal(chips[0]!.title, 'Combat Pool: 2 of 7 left');
    assert.equal(poolChips({ combat: [0, 5] })[0]!.empty, true);
    assert.deepEqual(poolChips({}), []);
  });

  test('the view: status, wound TN, money, state and chips without repeats', () => {
    const v = partyCard({
      name: 'Rook', img: '', player: 'Pell', status: 'unconscious', wound: 2, pools: { combat: [3, 6] }, goodKarma: 4, nuyen: 12345,
      astral: 'astral: projecting', matrix: '', chips: ['full defense', 'Full Defense', '', 'astral: projecting'], initiative: 14, inCombat: true, acting: true,
    });
    assert.equal(v.hurt, true);
    assert.equal(v.statusText, 'Unconscious');
    assert.equal(v.woundText, '+2 TN');
    assert.equal(v.nuyenText, '12,345¥');
    assert.equal(v.karmaText, '4 Good Karma');
    assert.deepEqual(v.state, ['astral: projecting']);
    assert.deepEqual(v.chips, ['full defense']);
    assert.equal(v.initiative, '14');
    assert.equal(v.img, 'icons/svg/mystery-man.svg');
    assert.equal(v.acting, true);
  });

  test('ok and out of combat: no status text, no wound, no initiative', () => {
    const v = partyCard({ name: 'Ace', status: 'ok', wound: 0, initiative: 9, inCombat: false });
    assert.equal(v.hurt, false);
    assert.equal(v.statusText, '');
    assert.equal(v.woundText, '');
    assert.equal(v.initiative, '');
    assert.equal(partyCard({ name: 'X', inCombat: true, initiative: null }).initiative, '');
    assert.equal(partyCard({ name: 'X', inCombat: true, initiative: 0 }).initiative, '0');
  });
});

describe('mook stat line', () => {
  test('attributes, Reaction, armor, initiative, Professional Rating, group and two weapons', () => {
    const m = mookLine({
      attributes: { body: 4, quickness: 5, strength: 4, charisma: 2, intelligence: 3, willpower: 3 }, reaction: 4, initiativeDice: 2,
      ballistic: 5, impact: 3, professionalRating: 3, grunts: { size: 6, down: 2 },
      weapons: [
        { name: 'Ares Predator', system: { damagePower: 9, damageLevel: 'M', damageType: 'physical' } },
        { name: 'Stun baton', system: { damagePower: 6, damageLevel: 'S', damageType: 'stun' } },
        { name: 'Knife', system: { damagePower: 1, damageLevel: 'L', strengthPower: true } },
      ],
    });
    assert.deepEqual(m.attrs.map((a) => `${a.k}${a.v}`), ['B4', 'Q5', 'S4', 'C2', 'I3', 'W3', 'R4']);
    assert.equal(m.armor, '5/3');
    assert.equal(m.init, '4 + 2D6');
    assert.equal(m.pr, 'PR 3');
    assert.equal(m.group, '4/6 grunts');
    assert.deepEqual(m.weapons, [{ name: 'Ares Predator', damage: '9M' }, { name: 'Stun baton', damage: '6S Stun' }]);
    assert.equal(m.text, 'B 4 Q 5 S 4 C 2 I 3 W 3 R 4 · Armor 5/3 · Init 4 + 2D6 · PR 3 · 4/6 grunts · Ares Predator 9M · Stun baton 6S Stun');
  });

  test('bare NPC: zeros, one die, no PR or group; Strength weapons; a spirit\'s initiative bonus', () => {
    const m = mookLine({ weapons: [{ name: 'Claws', system: { damagePower: 2, damageLevel: 'M', strengthPower: true } }], maxWeapons: 1 });
    assert.equal(m.init, '0 + 1D6');
    assert.equal(m.armor, '0/0');
    assert.equal(m.pr, '');
    assert.equal(m.group, '');
    assert.deepEqual(m.weapons, [{ name: 'Claws', damage: '(STR+2)M' }]);
    assert.equal(mookLine({ reaction: 5, initiativeBonus: 10, initiativeDice: 1 }).init, '15 + 1D6');
    assert.equal(mookLine({ grunts: { size: 1 } }).group, '');
  });

  test('the toggle: default on, kept as true/false, a blocked store reads as on', () => {
    const mem = new Map<string, string>();
    const store = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };
    assert.equal(MOOK_CARDS_KEY, 'sr2e.gmMookCards');
    assert.equal(readMookCards(store), true);
    writeMookCards(store, false);
    assert.equal(mem.get('sr2e.gmMookCards'), 'false');
    assert.equal(readMookCards(store), false);
    writeMookCards(store, true);
    assert.equal(readMookCards(store), true);
    const blocked = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
    assert.equal(readMookCards(blocked), true);
    assert.doesNotThrow(() => writeMookCards(blocked, false));
    assert.equal(readMookCards(null), true);
  });
});

describe('combat tracker', () => {
  test('delaying and acting-on-a-delay go last in their order; full defense stays put but is counted', () => {
    const g = trackerGroups([
      { id: 'a' }, { id: 'b', delaying: true }, { id: 'c', fullDefense: true }, { id: 'd', actingNow: true }, { id: 'e' }, { id: 'a' }, { id: '' },
    ]);
    assert.deepEqual(g.order, ['a', 'c', 'e', 'b', 'd']);
    assert.deepEqual(g.main, ['a', 'c', 'e']);
    assert.deepEqual(g.delayed, ['b', 'd']);
    assert.deepEqual(g.fullDefense, ['c']);
    assert.deepEqual(g.counts, { delayed: 2, fullDefense: 1 });
    assert.deepEqual(trackerGroups([]).order, []);
  });

  test('the pass banner', () => {
    assert.equal(passBanner({ started: false, round: 1, pass: 1 }), null);
    assert.deepEqual(passBanner({ started: true, round: 2, pass: 1, acting: 'Rook', fullDefense: 1, delayed: 2 }),
      { title: 'Combat Turn 2 · Pass 1', acting: 'Acting: Rook', notes: ['Full defense: 1', 'Delaying: 2'] });
    assert.deepEqual(passBanner({ started: true, round: 0, pass: 0 }), { title: 'Combat Turn 1 · Pass 1', acting: '', notes: [] });
  });

  test('exported from the rules index', () => {
    for (const k of ['partyCard', 'mookLine', 'trackerGroups', 'passBanner', 'poolChips', 'readMookCards', 'writeMookCards']) assert.equal(typeof (rules as any)[k], 'function', k);
  });
});
