/**
 * v0.97.0 rules completeness, the Matrix's system operations (RULES.MXOPS_V97): the pure rules (rules/mxops97.ts), the
 * catalog the system test reads (rules/matrix923.ts matrixOperations), and for each switch that its other value
 * ('v965') gives the v0.96.5 result.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { RULES } from '../rules/config.ts';
import { oldWay } from '../rules/__tests__/oldway.ts';
import * as M from '../rules/mxops97.ts';
import { HOUSE_MXOPS_V97 } from '../rules/config97/mxops.ts';
import { matrixOperations } from '../rules/matrix923.ts';
import { UTILITY_KINDS } from '../rules/matrix.ts';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// The new strings come from public/lang/en.json (english-lang.ts); until the lead merges the draft, from the draft.
const DRAFTS = ['mxops97.json', 'mxops97-fix.json'].map((f) => join(import.meta.dirname, '..', '..', '..', 'i18n-drafts', f));
const en = (globalThis as any).__SR2E_EN__ ?? ((globalThis as any).__SR2E_EN__ = {});
for (const d of DRAFTS) if (existsSync(d)) for (const [k, v] of Object.entries(JSON.parse(readFileSync(d, 'utf8')))) if (!(k in en)) en[k] = v;

describe('v0.97.0 system operations: the switches', () => {
  test('every switch has a house-rules row, the book first and the default; numbers as shipped', () => {
    const v: any = RULES.MXOPS_V97;
    for (const r of HOUSE_MXOPS_V97) {
      const key = r.path.split('.')[1]!;
      assert.ok(key in v, r.path);
      if (r.type === 'select') { assert.equal(v[key], r.choices![0], `${r.path} defaults to its first choice`); assert.deepEqual(r.choices, ['book', 'v965']); }
    }
    for (const k of Object.keys(v)) if (typeof v[k] !== 'object') assert.ok(HOUSE_MXOPS_V97.some((r) => r.path === `MXOPS_V97.${k}`), k);
    assert.equal(v.analyzeHostAll, 7);
    assert.equal(v.notThereAt, 3);
    assert.deepEqual(v.passcodeTn, { user: 0, superuser: 2, supervisor: 6 });
  });
});

describe('the System Operations Table rows (VR2 p. 162)', () => {
  test('the new operations join the catalog with their test, utility and action', () => {
    const ops = matrixOperations();
    const by = (id: string) => ops.find((o) => o.id === id) as any;
    for (const id of M.OP_IDS) assert.ok(by(id), id);
    assert.deepEqual([by('analyzeSubsystem').utility, by('analyzeSubsystem').action, by('analyzeSubsystem').anySub], ['analyze', 'simple', true]);
    assert.deepEqual([by('crashApplication').utility, by('crashApplication').action], ['crash', 'complex'], 'the table says Complex (the entry Simple)');
    assert.deepEqual([by('decoy').subsystem, by('decoy').utility, by('decoy').action], ['control', 'mirrors', 'complex']);
    assert.deepEqual([by('disinfect').utility, by('disinfect').action, by('disinfect').anySub], ['disinfect', 'complex', true]);
    assert.deepEqual([by('dumpLog').subsystem, by('dumpLog').utility, by('dumpLog').action], ['control', 'validate', 'complex']);
    assert.deepEqual([by('locateDeckerOp').subsystem, by('locateDeckerOp').utility], ['index', 'scanner']);
    assert.deepEqual([by('locateFrame').subsystem, by('locateFrame').utility], ['index', 'scanner']);
    assert.deepEqual([by('locateIcOp').subsystem, by('locateIcOp').utility], ['index', 'analyze']);
    assert.deepEqual([by('retrain').subsystem, by('retrain').utility, by('retrain').action], ['access', 'commlink', 'free']);
    assert.deepEqual([by('scanIcon').utility, by('scanIcon').action], ['scanner', 'simple']);
    for (const id of M.OP_IDS) assert.ok((UTILITY_KINDS as readonly string[]).includes(by(id).utility), `${id}: a utility kind`);
    assert.equal(RULES.MATRIX.utilitySize.kinds['disinfect'], 2, 'disinfect multiplier (VR2 p. 161)');
    assert.ok(by('decoy').label && !String(by('decoy').label).startsWith('SR2E.'), 'a translated label');
  });
  test('ids stay unique in the catalog', () => {
    const ids = matrixOperations().map((o) => o.id);
    assert.equal(new Set(ids).size, ids.length);
  });
  test('the picked subsystem for a targeted-subsystem row, the row\'s own otherwise', () => {
    assert.equal(M.opSubsystem({ subsystem: 'control', anySub: true }, 'slave'), 'slave');
    assert.equal(M.opSubsystem({ subsystem: 'control', anySub: true }, 'nonsense'), 'control');
    assert.equal(M.opSubsystem({ subsystem: 'index' }, 'slave'), 'index');
    assert.equal(M.opSubsystem(null, 'slave'), null);
  });
  test('v965: the catalog as before', (t) => {
    const before = matrixOperations().length;
    t.after(oldWay({ 'MXOPS_V97.operations': 'v965' }));
    const ops = matrixOperations();
    assert.equal(ops.length, before - M.OP_IDS.length);
    assert.deepEqual(ops.map((o) => o.id), RULES.MATRIX.operations.map((o) => o.id));
  });
});

describe('Analyze Host: an item per success (VR2 p. 111)', () => {
  test('one per net success in the decker\'s order; 7 tell everything', () => {
    assert.deepEqual(M.analyzeHostReveal(1), ['security']);
    assert.deepEqual(M.analyzeHostReveal(2, 'files'), ['files', 'security']);
    assert.deepEqual(M.analyzeHostReveal(0), []);
    assert.deepEqual(M.analyzeHostReveal(6), ['security', 'access', 'control', 'index', 'files', 'slave'], 'six: all but the seventh item');
    assert.deepEqual(M.analyzeHostReveal(7), ['security', 'access', 'control', 'index', 'files', 'slave', 'vm'], 'seven items: seven tell all');
    assert.equal(M.analyzeHostItems().length, RULES.MXOPS_V97.analyzeHostAll, 'the threshold is the number of items');
    assert.deepEqual(M.analyzeHostReveal(3, 'bogus'), ['security', 'access', 'control']);
  });
  test('v965: null (the caller tells everything)', (t) => { t.after(oldWay({ 'MXOPS_V97.analyzeHost': 'v965' })); assert.equal(M.analyzeHostReveal(1), null); });
});

describe('Scan Icon and Locate Decker (VR2 pp. 114, 117)', () => {
  test('Scan Icon: an item per success; the sleaze raises the TN', () => {
    assert.deepEqual(M.scanIconReveal(2), ['mpcp', 'bod']);
    assert.deepEqual(M.scanIconReveal(1, 'masking'), ['masking']);
    assert.equal(M.scanIconSleazeMod(3), 3);
    assert.equal(M.scanIconSleazeMod(-1), 0);
  });
  test('Locate Decker: Masking + sleaze at most the Sensor Test\'s successes', () => {
    assert.equal(M.deckerLocated(5, 4, 1), true);
    assert.equal(M.deckerLocated(4, 4, 1), false);
    assert.equal(M.deckerLocated(4, 4, 0), true);
  });
});

describe('Decoy (VR2 p. 112)', () => {
  test('1D6 at most the successes draws the attack (a tie fools it)', () => {
    assert.equal(M.decoyDraws(3, 3), true);
    assert.equal(M.decoyDraws(4, 3), false);
    assert.equal(M.decoyDraws(1, 0), false);
  });
  test('full damage by level; gone at 10 boxes', () => {
    const d = { deckerUuid: 'd', successes: 3, boxes: 6 };
    assert.deepEqual(M.decoyHit(d, 'M'), { decoy: { ...d, boxes: 9 }, gone: false });
    assert.equal(M.decoyHit(d, 'S').gone, true);
    assert.equal(M.levelBoxes('D'), 10);
  });
  test('the host\'s decoys: one per decker, bounded, cleaned', () => {
    const l = M.withDecoy([], 'd', 3);
    assert.deepEqual(M.decoyFor(l, 'd'), { deckerUuid: 'd', successes: 3, boxes: 0 });
    assert.equal(M.withDecoy(l, 'd', 0).length, 0, 'no successes: no decoy');
    assert.equal(M.withDecoy(l, 'd', 99)[0]!.successes, M.DECOY_MAX);
    assert.deepEqual(M.decoysOf([{ deckerUuid: 'd', successes: 99, boxes: 2 }, { successes: 3 }, 'x']), [{ deckerUuid: 'd', successes: M.DECOY_MAX, boxes: 2 }]);
    assert.equal(M.decoyFor(l, 'other'), null);
  });
});

describe('located icons (VR2 pp. 114–115, 117)', () => {
  test('added per decker; leaving the host drops them everywhere', () => {
    let l = M.withLocated([], 'a', ['x', 'y']);
    l = M.withLocated(l, 'a', ['y', 'z']);
    l = M.withLocated(l, 'x', ['a']);
    assert.deepEqual(M.locatedBy(l, 'a'), ['x', 'y', 'z']);
    const out = M.locatedWithout(l, 'x');
    assert.deepEqual(M.locatedBy(out, 'a'), ['y', 'z']);
    assert.deepEqual(M.locatedBy(out, 'x'), []);
    assert.deepEqual(M.locatedOf([{ deckerUuid: 'a', uuids: ['q', 5, 'q'] }, { deckerUuid: 3 }]), [{ deckerUuid: 'a', uuids: ['q'] }]);
  });
});

describe('Dump Log (VR2 p. 113)', () => {
  test('the log size by Intrusion Difficulty: 2D6 × 5 / × 2 / × 1, × 100 Mp', () => {
    assert.equal(M.logSize(5, 7), 3500);
    assert.equal(M.logSize(8, 7), 1400);
    assert.equal(M.logSize(11, 7), 700);
  });
});

describe('Validate Passcode (VR2 p. 118)', () => {
  test('superuser +2, supervisor +6; 1D6 × net days; expired passcodes stop working; no record fails closed', () => {
    const DAY = 86400;
    assert.equal(M.passcodeLevelTn('superuser'), 2);
    assert.equal(M.passcodeLevelTn('supervisor'), 6);
    assert.equal(M.passcodeLevelTn('user'), 0);
    assert.equal(M.passcodeDays(4, 3), 12);
    assert.equal(M.passcodeDays(6, 99), M.PASSCODE_MAX_DAYS);
    const list = M.withPasscode([], 'd', 2, 'user', 0);
    assert.equal(M.passcodeLive(list, 'd', 2 * DAY - 1), true);
    assert.equal(M.passcodeLive(list, 'd', 2 * DAY), false);
    assert.equal(M.passcodeLive(list, 'other', 0), false, 'no record: not live (fails closed)');
    assert.equal(M.passcodeLive(M.passcodesOf([{ deckerUuid: 'd', from: 0, days: 99999 }]), 'd', 200 * DAY), false, 'days clamped on read');
    assert.equal(M.passcodeLive([{ deckerUuid: 'd', from: 50 * DAY, days: 5, level: 'user' }], 'd', 0), false, 'set in the future');
    assert.equal(M.withPasscode(list, 'd', 9, 'supervisor', 0).length, 1);
    assert.equal(M.alertKillsPasscodes('active'), true);
    assert.equal(M.alertKillsPasscodes('passive'), false);
  });
  test('v965: no level modifier, no days, never expires, no alert deletion', (t) => {
    t.after(oldWay({ 'MXOPS_V97.validatePasscode': 'v965' }));
    assert.equal(M.passcodeLevelTn('supervisor'), 0);
    assert.equal(M.passcodeDays(4, 3), null);
    assert.equal(M.passcodeLive([], 'd', 1e9), true);
    assert.equal(M.alertKillsPasscodes('active'), false);
  });
});

describe('Slow (VR2 p. 99)', () => {
  test('an action per 2 net successes over the Resistance Test', () => {
    assert.deepEqual(M.slowBook(5, 1), { net: 4, actions: 2, initiative: 20 });
    assert.deepEqual(M.slowBook(3, 2), { net: 1, actions: 0, initiative: 0 });
    assert.deepEqual(M.slowBook(1, 4), { net: 0, actions: 0, initiative: 0 });
  });
  test('not on reactive IC; trace IC only while it hunts', () => {
    assert.equal(M.slowRefusal({ behavior: 'probe', traceLocked: false }), 'SR2E.MxOps97.Why.slowReactive');
    assert.equal(M.slowRefusal({ behavior: 'trace', traceLocked: true }), 'SR2E.MxOps97.Why.slowTrace');
    assert.equal(M.slowRefusal({ behavior: 'trace', traceLocked: false }), null);
    assert.equal(M.slowRefusal({ behavior: 'killer', traceLocked: false }), null);
  });
  test('v965: no refusal', (t) => { t.after(oldWay({ 'MXOPS_V97.slow': 'v965' })); assert.equal(M.slowRefusal({ behavior: 'probe', traceLocked: false }), null); });
});

describe('Restore (VR2 p. 100)', () => {
  test('TN the highest damaging rating; a point per 2 successes', () => {
    assert.equal(M.restoreTn([4, 6], 4), 6);
    assert.equal(M.restoreTn([], 4), 4);
    assert.equal(M.restorePoints(5), 2);
    assert.equal(M.crippledBy({ bod: 0, evasion: 0 }, 8, 5), 5, 'fresh damage forgets the old');
    assert.equal(M.crippledBy({ bod: 1 }, 8, 5), 8);
  });
});

describe('Interrogations (VR2 p. 110)', () => {
  test('the question\'s modifier on interrogations only; Locate Access Node within ±1', () => {
    assert.equal(M.queryTn('locateFile', 'veryVague'), 2);
    assert.equal(M.queryTn('locatePaydata', 'insightful'), -2);
    assert.equal(M.queryTn('locateNumber', 'veryVague'), 1);
    assert.equal(M.queryTn('download', 'vague'), 0);
  });
  test('"not here" at 3 successes with nothing left', () => {
    assert.equal(M.notThere(3, 0), true);
    assert.equal(M.notThere(2, 0), false);
    assert.equal(M.notThere(4, 1), false);
  });
  test('v965: neither', (t) => {
    t.after(oldWay({ 'MXOPS_V97.interrogation': 'v965' }));
    assert.equal(M.queryTn('locateFile', 'veryVague'), 0);
    assert.equal(M.notThere(9, 0), false);
  });
});
