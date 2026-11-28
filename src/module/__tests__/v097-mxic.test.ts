/**
 * v0.97.0 rules completeness, Matrix IC and cybercombat (RULES.MXIC_V97): the pure rules (rules/mxic97.ts) and the
 * persona speed hook (rules/matrix923.ts personaSpeed), and for each switch that its other value ('v965') gives the
 * v0.96.5 result.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RULES } from '../rules/config.ts';
import { oldWay } from '../rules/__tests__/oldway.ts';
import * as X from '../rules/mxic97.ts';
import { HOUSE_MXIC_V97 } from '../rules/config97/mxic.ts';
import { MXIC_V965_WAY } from '../rules/__tests__/mxic965.ts';
import { personaSpeed, matrixOperations } from '../rules/matrix923.ts';
import { realityFilterEffect } from '../rules/datawar.ts';
import { mx97OwnerOk, describeGmChange, gmApplyShapeOk } from '../rules/trust.ts';

/** English from public/lang/en.json, with this area's draft while it isn't merged. */
function english(): Record<string, string> {
  const flat: Record<string, string> = {};
  const walk = (o: unknown, p: string): void => { if (typeof o === 'string') { flat[p] = o; return; } if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) walk(v, p ? `${p}.${k}` : k); };
  walk(JSON.parse(readFileSync(join('public', 'lang', 'en.json'), 'utf8')), '');
  for (const f of ['mxic97.json', 'mxic97-fix.json']) {
    const draft = join('i18n-drafts', f);
    if (existsSync(draft)) Object.assign(flat, JSON.parse(readFileSync(draft, 'utf8')));
  }
  return flat;
}

// This area's English while its drafts aren't merged (t() reads the preload's table).
(globalThis as any).__SR2E_EN__ = { ...((globalThis as any).__SR2E_EN__ ?? {}), ...english() };

describe('v0.97.0 Matrix IC: the switches', () => {
  test('every switch has a house-rules row, the book first and the default', () => {
    const v: any = RULES.MXIC_V97;
    for (const r of HOUSE_MXIC_V97) {
      const key = r.path.split('.')[1]!;
      assert.ok(key in v, r.path);
      assert.equal(v[key], r.choices![0], `${r.path} defaults to its first choice`);
      assert.deepEqual(r.choices, ['book', 'v965']);
    }
    for (const k of Object.keys(v)) assert.ok(HOUSE_MXIC_V97.some((r) => r.path === `MXIC_V97.${k}`), k);
    assert.equal(Object.keys(MXIC_V965_WAY).length, Object.keys(v).length);
  });
  test('every house-rules row and every key the code uses has English', () => {
    const en = english();
    for (const r of HOUSE_MXIC_V97) assert.ok(en[`SR2E.HouseRules.Rule.${r.path.replace('.', '__')}`], r.path);
    const src = ['src/module/rules/mxic97.ts', 'src/module/applications/mxic97.ts', 'src/module/rules/trust.ts', 'src/module/applications/chat.ts', 'src/module/documents/index.ts', 'src/module/applications/sheets.ts', 'public/templates/matrix-section.hbs']
      .map((f) => readFileSync(join(...f.split('/')), 'utf8')).join('\n');
    const keys = new Set([...src.matchAll(/SR2E\.MxIc97\.[A-Za-z0-9_.]+[A-Za-z0-9]/g)].map((m) => m[0]));
    keys.delete('SR2E.MxIc97.Why');
    for (const why of ['improviseOff', 'improviseNone', 'improviseMore', 'improviseMpcp']) keys.add(`SR2E.MxIc97.Why.${why}`);
    for (const k of keys) assert.ok(en[k], k);
  });
});

describe('suppressing IC and the host\'s record (VR2 pp. 40, 121–122)', () => {
  const rec = { suppressed: [{ decker: 'D1', id: 'a', name: 'a', points: 5 }, { decker: 'D1', id: 'b', name: 'b', points: 4 }, { decker: 'D2', id: 'c', name: 'c', points: 3 }] };
  test('−1 Detection Factor per IC the host records this decker suppressing, never below 2', () => {
    assert.equal(X.suppressedDfLoss(rec, 'D1'), 2);
    assert.equal(X.suppressedDf(5, rec, 'D1'), 3);
    assert.equal(X.suppressedDf(3, rec, 'D1'), 2);
    assert.equal(X.suppressedDf(5, rec, 'D3'), 5);
    assert.equal(X.suppressedDf(5, 'junk', 'D1'), 5);
    assert.equal(X.hostMx({ suppressed: [{ decker: 'D', id: 'a', points: 999 }] }).suppressed[0]!.points, 30, 'bounded');
  });
  test('a request carries who and which only, bounded; a parry is capped by the decker\'s dice', () => {
    assert.deepEqual(X.cleanMx97({ op: 'parry', deckerUuid: 'D', vs: 'I', id: 'e', net: 99, evil: 1 }), { op: 'parry', deckerUuid: 'D', vs: 'I', id: 'e', net: 30 });
    assert.equal(X.cleanMx97({ op: 'hack', deckerUuid: 'D' }), null);
    assert.equal(X.maneuverCap(30, 7), 7);
    assert.deepEqual(X.hostParry({ parry: [{ decker: 'D', vs: 'I', net: 3, id: 'p' }] }, 'D', 'I'), { net: 3, id: 'p' });
    assert.equal(X.hostParry({ parry: [{ decker: 'D', vs: 'I', net: 3, id: 'p' }] }, 'D', 'I', ['p']), null);
  });
  test('v965: no Detection Factor lost', (t) => { t.after(oldWay({ 'MXIC_V97.suppress': 'v965' })); assert.equal(X.suppressedDf(5, rec, 'D1'), 5); });
});

describe('black IC\'s last shot (VR2 p. 48)', () => {
  test('lethal: when it kills; non-lethal: when it knocks out; once; double the rating', () => {
    assert.deepEqual(X.blackIcFinalShot({ lethal: true, before: 'dying', after: 'dead', rating: 6 }), { rating: 12 });
    assert.equal(X.blackIcFinalShot({ lethal: true, before: 'ok', after: 'dying', rating: 6 }), null);
    assert.deepEqual(X.blackIcFinalShot({ lethal: false, before: 'ok', after: 'unconscious', rating: 5 }), { rating: 10 });
    assert.equal(X.blackIcFinalShot({ lethal: false, before: 'unconscious', after: 'unconscious', rating: 5 }), null);
  });
  test('the MPCP is destroyed at its rating; the wipe keeps the files from before the run', () => {
    assert.equal(X.mpcpDestroyed(6, 5), false);
    assert.equal(X.mpcpDestroyed(6, 6), true);
    const files = [{ name: 'old', source: 'Host' }, { name: 'mine' }, { name: 'new', source: 'Ares' }];
    assert.deepEqual(X.wipeRunFiles(files, 2).map((f) => f.name), ['old', 'mine']);
    assert.deepEqual(X.wipeRunFiles(files, null).map((f) => f.name), ['mine'], 'no record: the downloads go');
  });
  test('v965: no last shot', (t) => { t.after(oldWay({ 'MXIC_V97.blackIcKill': 'v965' })); assert.equal(X.blackIcFinalShot({ lethal: true, before: 'ok', after: 'dead', rating: 6 }), null); });
});

describe('improvised attacks (VR2 p. 123)', () => {
  test('Power from Evasion and Bod, at most the MPCP; TN the Power; level by successes', () => {
    assert.deepEqual(X.improvisedPlan({ evasion: 5, bod: 4, fromEvasion: 3, fromBod: 2, mpcp: 6 }), { power: 5, tn: 5 });
    assert.equal(X.improvisedPlan({ evasion: 5, bod: 4, fromEvasion: 4, fromBod: 4, mpcp: 6 }).why, 'SR2E.MxIc97.Why.improviseMpcp');
    assert.equal(X.improvisedPlan({ evasion: 2, bod: 4, fromEvasion: 3, fromBod: 0, mpcp: 6 }).why, 'SR2E.MxIc97.Why.improviseMore');
    assert.equal(X.improvisedPlan({ evasion: 2, bod: 4, fromEvasion: 0, fromBod: 0, mpcp: 6 }).why, 'SR2E.MxIc97.Why.improviseNone');
    assert.deepEqual([0, 1, 2, 3, 4, 7].map(X.improvisedLevel), [null, 'L', 'M', 'S', 'D', 'D']);
  });
  test('the points come back, never below 0', () => {
    assert.deepEqual(X.giveBack({ bod: 1, evasion: 3, masking: 0, sensors: 0 }, { evasion: 2, bod: 2 }), { bod: 0, evasion: 1, masking: 0, sensors: 0 });
    assert.equal(X.improvisedOf({ power: 4, level: 'Q' })!.level, '');
    assert.equal(X.improvisedOf(null), null);
  });
  test('v965: none', (t) => { t.after(oldWay({ 'MXIC_V97.improvised': 'v965' })); assert.equal(X.improvisedPlan({ evasion: 5, bod: 4, fromEvasion: 1, fromBod: 0, mpcp: 6 }).why, 'SR2E.MxIc97.Why.improviseOff'); });
});

describe('combat maneuvers (VR2 pp. 121–122)', () => {
  const base = { vs: 'IC', hostUuid: 'H', id: 'e1' };
  test('position: the winner gets the bonus, it backfires on a loss, a tie does nothing (the book example: 4 vs 5)', () => {
    const won = X.maneuverAfter(null, { ...base, kind: 'position', mine: 4, theirs: 2 });
    assert.deepEqual([won.who, won.net, won.state.pos.length, won.state.exposed.length], ['me', 2, 1, 0]);
    const lost = X.maneuverAfter(null, { ...base, kind: 'position', mine: 4, theirs: 5 });
    assert.deepEqual([lost.who, lost.net, lost.state.pos.length, lost.state.exposed[0]!.net], ['them', 1, 0, 1]);
    assert.equal(X.maneuverAfter(null, { ...base, kind: 'position', mine: 3, theirs: 3 }).entryId, null);
    assert.deepEqual(X.positionUse(2, 'power'), { tn: 0, power: 2 });
    assert.deepEqual(X.positionUse(2, 'tn'), { tn: -2, power: 0 });
  });
  test('parry: until the opponent\'s attack uses it up (no cap); an evade drops it; a re-roll replaces the card\'s entry', () => {
    const p = X.maneuverAfter(null, { ...base, kind: 'parry', mine: 7, theirs: 1 });
    assert.equal(X.bestEntry(p.state.parry, 'IC', 'H')!.net, 6, 'no cap of 4');
    assert.equal(X.bestEntry(p.state.parry, 'IC', 'H', ['e1']), null, 'used up by that attacker');
    assert.equal(X.bestEntry(p.state.parry, 'IC', 'H2'), null, 'another host');
    const ev = X.maneuverAfter(p.state, { ...base, id: 'e2', kind: 'evade', mine: 3, theirs: 1, tally: 7 });
    assert.equal(ev.state.parry.length, 0);
    assert.deepEqual(ev.state.evade, [{ vs: 'IC', tallyAt: 7, hostUuid: 'H' }]);
    const rr = X.maneuverAfter(p.state, { ...base, kind: 'parry', mine: 1, theirs: 1, replaces: 'e1' });
    assert.equal(rr.state.parry.length, 0, 'a re-roll that fails takes it back');
    assert.deepEqual(X.usedAfter(['a'], ['b', 'a']), ['a', 'b']);
  });
  test('evade: net Combat Turns, 1 less per tally point (the book example: 2 net, the tally +2 the next turn)', () => {
    const end = X.evadeEnd({ round: 3, worldTime: 100, net: 2, gain: 0 });
    assert.deepEqual(end, { round: 5, worldTime: 106 });
    const m = { ...end, net: 2, combatId: 'c' };
    assert.equal(X.evadeHolds(m, { round: 5, worldTime: 0, combatId: 'c' }, 0), true);
    assert.equal(X.evadeHolds(m, { round: 6, worldTime: 0, combatId: 'c' }, 0), false);
    assert.equal(X.evadeHolds(m, { round: 4, worldTime: 0, combatId: 'c' }, 2), true, 'the book: found at the end of that turn');
    assert.equal(X.evadeHolds(m, { round: 5, worldTime: 0, combatId: 'c' }, 2), false, 'and attacks the next');
    assert.equal(X.evadeHolds({ round: -1, worldTime: 109, net: 3 }, { round: null, worldTime: 106 }, 1), true);
    assert.equal(X.evadeHolds({ round: -1, worldTime: 109, net: 3 }, { round: null, worldTime: 107 }, 1), false);
  });
});

describe('ripper, tar, scramble, data bombs (VR2 pp. 41–43)', () => {
  test('Ripper and Tar Pit Tests: MPCP + Hardening; 1 chip point per success', () => {
    assert.equal(X.ripperTn(6, 2), 8);
    assert.equal(X.ripperChipLoss(3, 2), 2);
    assert.equal(X.tarPitCorrupts(0), false);
    assert.equal(X.tarPitCorrupts(1), true);
  });
  test('tar: rating vs the utility\'s (−2 in a construct or party), the utility rating vs the tar\'s; passive utilities spared (the book example: Tar Baby 8 vs Analyze 6)', () => {
    assert.equal(X.tarTn(6, false), 6);
    assert.equal(X.tarTn(6, true), 4);
    assert.deepEqual(X.tarDefense(6, 8), { dice: 6, tn: 8 });
    assert.equal(X.tarTargets('armor'), false);
    assert.equal(X.tarTargets('analyze'), true);
  });
  test('tar v965: every utility', (t) => { t.after(oldWay({ 'MXIC_V97.tar': 'v965' })); assert.equal(X.tarTargets('sleaze'), true); });
  test('scramble: poison without a bomb, Poison Test vs Computer', () => {
    assert.equal(X.poisonScramble({ scramble: 5 }), true);
    assert.equal(X.poisonScramble({ scramble: 5, bomb: 4 }), false, 'exploding');
    assert.deepEqual(X.poisonTest(5, 6), { dice: 5, tn: 6 });
  });
  test('scramble v965: no Poison Test', (t) => { t.after(oldWay({ 'MXIC_V97.scramble': 'v965' })); assert.equal(X.poisonScramble({ scramble: 5 }), false); });
  test('data bombs: all 1s on a defuse sets it off; the Defuse utility on the operation', () => {
    assert.equal(X.defuseBlows([{ total: 1 }, { total: 1 }]), true);
    assert.equal(X.defuseBlows([{ total: 1 }, { total: 2 }]), false);
    assert.equal(X.defuseBlows([]), false);
    assert.equal(matrixOperations().find((o) => o.id === 'defuseBomb')!.utility, 'defuse');
    assert.equal(X.defuseSubsystem({ fileBomb: false, bombSubsystem: 'slave' }), 'slave');
  });
  test('data bombs v965: Decrypt, never set off by the dice', (t) => {
    t.after(oldWay({ 'MXIC_V97.dataBomb': 'v965' }));
    assert.equal(X.defuseBlows([{ total: 1 }]), false);
    assert.equal(matrixOperations().find((o) => o.id === 'defuseBomb')!.utility, 'decrypt');
  });
});

describe('persona speed (VR2 pp. 84–87, 120; Mapping Matrices p. 69)', () => {
  const p = { reaction: 5, responseIncrease: 2, mpcp: 8, tortoise: false };
  test('running a hot deck cool costs 1D6 (at least 1); a cool deck runs cool for free', () => {
    assert.deepEqual(personaSpeed({ ...p, sim: 'cold', hotCool: true }), { reaction: 9, dice: 2, counted: 2 });
    assert.deepEqual(personaSpeed({ ...p, responseIncrease: 0, sim: 'cold', hotCool: true }), { reaction: 5, dice: 1, counted: 0 });
    assert.deepEqual(personaSpeed({ ...p, sim: 'cold' }), { reaction: 9, dice: 3, counted: 2 }, 'not a hot deck: no penalty');
    assert.deepEqual(personaSpeed({ ...p, sim: 'hot', hotCool: true }), { reaction: 11, dice: 4, counted: 2 }, 'hot: unchanged');
  });
  test('the reality filter needs the book persona speed: with the old one, no MPCP cost and the old effect', (t) => {
    t.after(oldWay({ 'MATRIX_V923.initiative': 'v922' }));
    assert.equal(X.filterMpcp(6, true), 6);
    assert.equal(X.filterLevel({ realityFilter: true, ok: null }), 0);
    assert.equal(realityFilterEffect(true).pool, RULES.MATRIX_V57.realityFilter.pool);
  });
  test('black IC\'s last shot may carry double a rating of 30', () => {
    assert.equal(X.deckDamageRating(24, true), 24);
    assert.equal(X.deckDamageRating(99, true), 60);
    assert.equal(X.deckDamageRating(24, false), 20);
  });
  test('a reality filter is one more level beyond the deck\'s 3, 5 at most with hot DNI', () => {
    assert.deepEqual(personaSpeed({ ...p, responseIncrease: 3, mpcp: 12, sim: 'hot', filter: 1 }), { reaction: 15, dice: 6, counted: 3 }, '+10 Reaction and 6D6');
    assert.deepEqual(personaSpeed({ ...p, sim: 'hot', filter: 1 }), { reaction: 13, dice: 5, counted: 2 });
    assert.equal(X.filterLevel({ realityFilter: true, ok: 0 }), 0, 'a sculpted host\'s test failed');
    assert.equal(X.filterLevel({ realityFilter: true, ok: null }), 1);
    assert.equal(X.filterMpcp(6, true), 5);
    assert.deepEqual(realityFilterEffect(true), { reaction: 0, pool: 0, modifiers: [] }, 'the old bonus is gone');
  });
  test('v965: no cool penalty, the filter\'s old bonus', (t) => {
    t.after(oldWay({ 'MXIC_V97.coolInit': 'v965', 'MXIC_V97.realityFilter': 'v965' }));
    assert.deepEqual(personaSpeed({ ...p, sim: 'cold', filter: 1, hotCool: true }), { reaction: 9, dice: 3, counted: 2 });
    assert.equal(X.filterMpcp(6, true), 6);
    assert.equal(realityFilterEffect(true).pool, RULES.MATRIX_V57.realityFilter.pool);
  });
  test('non-combat actions: Reaction ÷ 10 round up + 1 per extra die (v965: none)', (t) => {
    assert.equal(X.nonCombatActions(9, 1), 1);
    assert.equal(X.nonCombatActions(13, 3), 4);
    t.after(oldWay({ 'MXIC_V97.nonCombat': 'v965' }));
    assert.equal(X.nonCombatActions(13, 3), null);
  });
});

describe('v0.97.0 review: who may ask the GM side', () => {
  test('a Matrix request only from the decker\'s owner; no crash requests; the confirm names the opponent and the net', () => {
    assert.equal(mx97OwnerOk({ mx97: { op: 'release', deckerUuid: 'Actor.other' } }, (u) => u === 'Actor.mine'), false);
    assert.equal(mx97OwnerOk({ mx97: { op: 'release', deckerUuid: 'Actor.mine' } }, (u) => u === 'Actor.mine'), true);
    assert.equal(mx97OwnerOk({ decrypt: 'f' }, () => false), true, 'not a Matrix request');
    assert.equal(gmApplyShapeOk('applyHost', { hostChange: { hostUuid: 'H', mx97: { op: 'crash', deckerUuid: 'D', id: 'I' } } }), false);
    assert.equal(X.cleanMx97({ op: 'crash', deckerUuid: 'D' }), null);
    const lines = describeGmChange('applyHost', { hostChange: { hostUuid: 'H', mx97: { op: 'parry', deckerUuid: 'D', vs: 'I', net: 3 } } }, (u) => (u === 'I' ? 'Killer-6' : u === 'D' ? 'Decker' : ''));
    assert.ok(lines.some((l) => /Killer-6/.test(l) && /3/.test(l) && /Decker/.test(l)), lines.join(' | '));
  });
  test('a bomb request matches only its own blast', () => {
    assert.equal(X.bombMatches('f:f1', { fileId: 'f1' }), true);
    assert.equal(X.bombMatches('f:f1', { subsystem: 'files' }), false);
    assert.equal(X.bombMatches('s:slave', { subsystem: 'slave' }), true);
    assert.equal(X.bombMatches('s:slave', null), false);
  });
});

describe('v0.97.0 test-plan fixes (pure)', () => {
  test('suppression counts for the decker\'s current run only', () => {
    const rec = { suppressed: [{ decker: 'D', id: 'a', name: 'a', points: 5, run: 'r1' }] };
    assert.equal(X.suppressedDfLoss(rec, 'D', 'r1'), 1);
    assert.equal(X.suppressedDfLoss(rec, 'D', 'r2'), 0);
  });
  test('an older maneuver request than the one applied is ignored; no sequence applies as before', () => {
    const r0 = X.hostMx({});
    const r1 = X.takeSeq(r0, 'parry', 'D', 'I', 200)!;
    assert.equal(X.takeSeq(r1, 'parry', 'D', 'I', 100), null);
    assert.ok(X.takeSeq(r1, 'parry', 'D', 'I', 300));
    assert.ok(X.takeSeq(r1, 'parry', 'D', 'J', 100), 'another opponent');
    assert.equal(X.takeSeq(r1, 'parry', 'D', 'I', undefined), r1);
    assert.equal(X.cleanMx97({ op: 'parry', deckerUuid: 'D', seq: 5 })!.seq, 5);
  });
});
