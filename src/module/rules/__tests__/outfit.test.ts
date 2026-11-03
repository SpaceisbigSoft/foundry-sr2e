import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { RULES } from '../config.ts';
import {
  essenceHoleAfterRemoval, essenceHoleAfterInstall, essenceWithHole,
  filtrationDice, boneLacing, boneLacingTotals,
  surveillanceKind, listenTest, listenReveal, bugSweep, jammed, strongestActive,
  opticsOf, mergeVision, legalityOf, legalCheck, legalSummary, tokenInvisible,
} from '../outfit.ts';

const R = RULES as any;
const G = R.GEAR_V58;

describe('v0.58.0 Essence holes', () => {
  test('removal grows the hole, rounded', () => {
    assert.equal(essenceHoleAfterRemoval(0.2, 0.1), 0.3);
    assert.equal(essenceHoleAfterRemoval(0, 1.4), 1.4);
    assert.equal(essenceHoleAfterRemoval(-1, -2), 0);
  });
  test('install fills the hole first', () => {
    assert.deepEqual(essenceHoleAfterInstall(0.3, 0.2), { hole: 0.1, fromHole: 0.2 });
    assert.deepEqual(essenceHoleAfterInstall(0.5, 2), { hole: 0, fromHole: 0.5 });
    assert.deepEqual(essenceHoleAfterInstall(0, 1), { hole: 0, fromHole: 0 });
    assert.deepEqual(essenceHoleAfterInstall(1, 0), { hole: 1, fromHole: 0 });
    assert.deepEqual(essenceHoleAfterInstall(0.7, 0.3), { hole: 0.4, fromHole: 0.3 });
  });
  test('essence counts the hole when enabled', () => {
    assert.equal(essenceWithHole(6, 0.2, 0.1), 5.7);
    assert.equal(essenceWithHole(6, 5, 2), 0);
    G.essenceHoles.enabled = false;
    try { assert.equal(essenceWithHole(6, 0.2, 0.1), 5.8); } finally { G.essenceHoles.enabled = true; }
  });
});

describe('v0.58.0 filtration', () => {
  test('best working filter for the vector', () => {
    const f = [{ kind: 'air', rating: 2 }, { kind: 'air', rating: 4 }, { kind: 'blood', rating: 3 }, { kind: 'blood', rating: 6, working: false }];
    assert.equal(filtrationDice(f, 'inhalation'), 4);
    assert.equal(filtrationDice(f, 'injection'), 3);
    assert.equal(filtrationDice(f, 'contact'), 3);
    assert.equal(filtrationDice(f, 'ingestion'), 0);
    assert.equal(filtrationDice([{ kind: 'nope', rating: 5 }], 'inhalation'), 0);
    assert.equal(filtrationDice([], 'inhalation'), 0);
  });
});

describe('v0.58.0 bone lacing', () => {
  test('rows', () => {
    assert.deepEqual(boneLacing('aluminum'), { soakDice: 2, unarmedPower: 2, weight: 10, label: 'Aluminum' });
    assert.deepEqual(boneLacing(''), { soakDice: 0, unarmedPower: 0, weight: 0, label: '' });
    assert.deepEqual(boneLacing('adamantium'), { soakDice: 0, unarmedPower: 0, weight: 0, label: '' });
  });
  test('only the best working lacing counts', () => {
    assert.equal(boneLacingTotals([{ kind: 'plastic' }, { kind: 'titanium' }]).label, 'Titanium');
    assert.equal(boneLacingTotals([{ kind: 'plastic' }, { kind: 'titanium', working: false }]).soakDice, 1);
    assert.deepEqual(boneLacingTotals([]), { soakDice: 0, unarmedPower: 0, weight: 0, label: '' });
  });
});

describe('v0.58.0 surveillance', () => {
  test('kinds', () => {
    assert.equal(surveillanceKind('bug')?.label, 'Bug');
    assert.equal(surveillanceKind('laserMic')?.transmits, false);
    assert.equal(surveillanceKind('x'), null);
  });
  test('listen tests', () => {
    assert.deepEqual(listenTest({ rating: 3 }), { dice: 3, baseTn: 4, tn: 4, modifiers: [] });
    const t = listenTest({ rating: 5, whiteNoise: 2 });
    assert.equal(t.tn, 6);
    assert.deepEqual(t.modifiers, [{ label: 'White noise 2', value: 2 }]);
    assert.equal(listenTest({ rating: 1, whiteNoise: -3 }).tn, 4);
    assert.equal(listenTest({ rating: 1, extra: -10 }).tn, RULES.MIN_TARGET_NUMBER);
    assert.equal(listenTest({ rating: 1, whiteNoise: 1, extra: 2 }).tn, 7);
  });
  test('reveals', () => {
    assert.equal(listenReveal(0), 'Nothing usable.');
    assert.equal(listenReveal(1), 'Snatches of the conversation.');
    assert.equal(listenReveal(2), 'Most of what is said.');
    assert.equal(listenReveal(9), 'Every word, clearly.');
  });
  test('bug sweep', () => {
    assert.deepEqual(bugSweep({ scannerRating: 4, bugRating: 6 }), { dice: 4, tn: 6 });
    assert.deepEqual(bugSweep({ scannerRating: 4, bugRating: 1 }), { dice: 4, tn: RULES.MIN_TARGET_NUMBER });
  });
  test('jamming', () => {
    assert.equal(jammed(4, 4), true);
    assert.equal(jammed(3, 4), false);
    assert.equal(jammed(0, 0), false);
    G.surveillance.jamBeats = 'greater';
    try {
      assert.equal(jammed(4, 4), false);
      assert.equal(jammed(5, 4), true);
    } finally { G.surveillance.jamBeats = 'greaterOrEqual'; }
  });
  test('strongest active', () => {
    const items = [{ kind: 'whiteNoise', rating: 2 }, { kind: 'whiteNoise', rating: 5, active: false }, { kind: 'whiteNoise', rating: 3 }, { kind: 'commJammer', rating: 6 }];
    assert.equal(strongestActive(items, 'whiteNoise'), 3);
    assert.equal(strongestActive(items, 'commJammer'), 6);
    assert.equal(strongestActive(items, 'bug'), 0);
  });
});

describe('v0.58.0 optics', () => {
  test('worn undamaged gear', () => {
    assert.deepEqual(opticsOf([
      { worn: true, lowLight: true, magnification: 2 },
      { worn: false, thermographic: true },
      { worn: true, thermographic: true, damaged: true, magnification: 3 },
      { worn: true, flareComp: true, magnification: 9 },
    ]), { lowLight: true, thermographic: false, flareComp: true, magnification: 3 });
    assert.deepEqual(opticsOf([]), { lowLight: false, thermographic: false, flareComp: false, magnification: 0 });
  });
  test('merge', () => {
    assert.deepEqual(mergeVision({ lowLight: true, magnification: 1 }, { thermographic: true, magnification: 2 }), { lowLight: true, thermographic: true, flareComp: false, magnification: 2 });
    assert.deepEqual(mergeVision(null, undefined), { lowLight: false, thermographic: false, flareComp: false, magnification: 0 });
  });
});

describe('v0.58.0 legality', () => {
  test('rows', () => {
    assert.equal(legalityOf('restricted').fine, 5000);
    assert.equal(legalityOf('weird').id, '');
  });
  test('checks', () => {
    assert.equal(legalCheck({ category: 'legal' }).ok, true);
    assert.equal(legalCheck({ category: '' }).ok, true);
    assert.deepEqual(legalCheck({ category: 'permit', permit: true }), { ok: true, label: 'Needs a permit', fine: 0, note: 'covered by a permit' });
    assert.deepEqual(legalCheck({ category: 'restricted', rating: 3 }), { ok: false, label: 'Restricted', fine: 5000, note: 'no permit' });
    assert.equal(legalCheck({ category: 'forbidden', permit: true }).ok, false);
    G.legality.fineTimesRating = true;
    try {
      assert.equal(legalCheck({ category: 'restricted', rating: 3 }).fine, 15000);
      assert.equal(legalCheck({ category: 'restricted', rating: 0 }).fine, 5000);
    } finally { G.legality.fineTimesRating = false; }
  });
  test('summary', () => {
    const s = legalSummary([
      { name: 'Ares Predator', category: 'permit', permit: true },
      { name: 'Grenade', category: 'restricted' },
      { name: 'Assault cannon', category: 'forbidden' },
      { name: 'Stim patch', category: 'legal' },
    ]);
    assert.deepEqual(s.problems.map((p) => p.name), ['Grenade', 'Assault cannon']);
    assert.equal(s.totalFine, 30000);
    assert.deepEqual(legalSummary([]), { problems: [], totalFine: 0 });
  });
});

describe('v0.58.0 token visibility', () => {
  test('invisible when projecting or concealed', () => {
    assert.deepEqual(tokenInvisible({ astralMode: 'projecting' }), { invisible: true, why: 'astral form' });
    assert.deepEqual(tokenInvisible({ astralMode: 'perceiving' }), { invisible: false, why: '' });
    assert.deepEqual(tokenInvisible({ concealment: [{ kind: 'silence' }, { kind: 'improvedInvisibility' }] }), { invisible: true, why: 'Improved invisibility' });
    assert.deepEqual(tokenInvisible({ concealment: [{ kind: 'invisibility' }] }), { invisible: true, why: 'Invisibility' });
    assert.deepEqual(tokenInvisible({}), { invisible: false, why: '' });
  });
  test('disabled', () => {
    G.visibility.enabled = false;
    try { assert.equal(tokenInvisible({ astralMode: 'projecting' }).invisible, false); } finally { G.visibility.enabled = true; }
  });
});
