import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { RULES } from '../config.ts';
import { CROSSCUT_V73 } from '../config73/crosscut.ts';
import {
  undoDocsV73, undoSkipsChange, undoLimitsV73, retargetGroupsV73, hearingRowsV73, superiorRowsV73, prejudiceRowsV73,
  combatEndUnsets, timedOutHoldIds, refundedName, refundLogged, composeAdvancementV73, advancementTotalsV73, projectCredit,
  trainingDoneMode, modInstallPayment, type RefundAware,
} from '../bookkeeping.ts';
import { tnCandidates } from '../situation.ts';
import { undoLimits } from '../gmtools.ts';
import type { AdvanceLine } from '../advancement.ts';

/** Set a value at a dotted path in CROSSCUT_V73 (or RULES with a 'RULES.' prefix) for the length of `fn`. */
function withRule(path: string, value: unknown, fn: () => void) {
  const inRules = path.startsWith('RULES.');
  const keys = (inRules ? path.slice(6) : path).split('.');
  let o: any = inRules ? RULES : CROSSCUT_V73;
  for (const k of keys.slice(0, -1)) o = o[k];
  const last = keys.at(-1)!;
  const old = o[last];
  o[last] = value;
  try { fn(); } finally { o[last] = old; }
}

const LOGGED = ['Actor', 'Item', 'Wall', 'Drawing', 'MeasuredTemplate'];
const labels = (gs: Array<{ group: string; rows: Array<{ label: string }> }>, group: string) => gs.find((g) => g.group === group)?.rows.map((r) => r.label) ?? [];

describe('v0.73.0 O39: Region documents in the undo log', () => {
  test('Region is added once, and taken out with the switch off', () => {
    assert.deepEqual(undoDocsV73(LOGGED), [...LOGGED, 'Region']);
    assert.deepEqual(undoDocsV73([...LOGGED, 'Region']), [...LOGGED, 'Region']);
    withRule('undo.regions', false, () => assert.deepEqual(undoDocsV73([...LOGGED, 'Region']), LOGGED));
  });
  test('only a timer sweep deletion of a Region is left out', () => {
    assert.equal(undoSkipsChange('Region', 'delete', { sr2eAreaSweep: 'timer' }), true);
    assert.equal(undoSkipsChange('Region', 'delete', { sr2eAreaSweep: 'clock' }), false);
    assert.equal(undoSkipsChange('Region', 'delete', {}), false);
    assert.equal(undoSkipsChange('Region', 'create', { sr2eAreaSweep: 'timer' }), false);
    assert.equal(undoSkipsChange('Wall', 'delete', { sr2eAreaSweep: 'timer' }), false);
    withRule('undo.skipTimedOut', false, () => assert.equal(undoSkipsChange('Region', 'delete', { sr2eAreaSweep: 'timer' }), false));
  });
  test('the limits list says what happens to regions, either way, once', () => {
    const on = undoLimitsV73(undoLimits());
    assert.equal(on.length, undoLimits().length + 1);
    assert.ok(on.some((l) => /regions .* are logged/i.test(l)));
    // Right after the "not logged" row.
    const i = on.findIndex((l) => /Journals, folders/.test(l));
    assert.match(on[i + 1]!, /Map regions/);
    assert.deepEqual(undoLimitsV73(on), on);
    withRule('undo.regions', false, () => {
      const off = undoLimitsV73(on);
      assert.equal(off.length, undoLimits().length + 1);
      assert.ok(off.some((l) => /are not logged: undoing a smoke grenade/.test(l)));
      assert.ok(!off.some((l) => /regions .* are logged;/i.test(l)));
    });
  });
});

describe('v0.73.0 O40: the GM\'s "Change target number…" rows', () => {
  test('a plain Notice or Listen card gets the Perception groups, Hearing and the observer', () => {
    for (const reveal of ['notice', 'listen']) {
      const g = retargetGroupsV73('plain', { reveal });
      const names = g.map((x) => x.group);
      for (const want of ['Perception', 'Visibility', 'Smoke', 'Weather', 'Hearing', 'The observer']) assert.ok(names.includes(want), `${reveal}: ${want}`);
      assert.equal(names.at(-1), 'Skill');
      assert.ok(labels(g, 'Hearing').includes('Deaf'));
      assert.ok(labels(g, 'The observer').includes('Blinded'));
    }
  });
  test('Hearing rows: Deaf at the deaf TN, amplification per rating, noise', () => {
    const rows = hearingRowsV73();
    assert.equal(rows.find((r) => r.label === 'Deaf')?.value, RULES.STATUSES.deaf.hearingTn);
    const h = RULES.COMBAT_V61.hearing;
    for (let n = 1; n <= h.ampMax; n++) assert.equal(rows.find((r) => r.label === `Hearing amplification ${n}`)?.value, n * h.ampPerRating);
    assert.equal(rows.find((r) => r.label === 'Noise: loud')?.value, h.noiseTn['loud']);
    // Zero rows (quiet) are left out.
    assert.ok(!rows.some((r) => r.label === 'Noise: quiet'));
  });
  test('perceive and sneak cards gain Hearing; the ritual-notice card keeps its magic rows', () => {
    assert.ok(retargetGroupsV73('perceive').some((g) => g.group === 'Hearing'));
    assert.ok(retargetGroupsV73('sneak').some((g) => g.group === 'Hearing'));
    assert.deepEqual(retargetGroupsV73('notice'), tnCandidates('notice'));
  });
  test('superior position on attack and defend by the switch and the house rule', () => {
    // v0.79.0: on by default, −1 for the holder only (SR2 Melee Modifiers Table).
    withRule('RULES.COMBAT_V61.superiorPosition.enabled', false, () => assert.ok(!retargetGroupsV73('attack').some((g) => g.group === 'Superior position (melee)')));
    assert.deepEqual(labels(retargetGroupsV73('defend'), 'Superior position (melee)'), ['Superior position']);
    withRule('RULES.COMBAT_V61.superiorPosition.against', 1, () => {
      const g = retargetGroupsV73('defend');
      assert.deepEqual(labels(g, 'Superior position (melee)'), ['Superior position', 'Opponent has superior position']);
    });
    withRule('retarget.superiorPosition', 'always', () => assert.equal(superiorRowsV73().length, 1));
    withRule('retarget.superiorPosition', 'never', () => withRule('RULES.COMBAT_V61.superiorPosition.enabled', true, () => assert.equal(superiorRowsV73().length, 0)));
  });
  test('prejudice rows on social cards, gone once one is applied', () => {
    const rows = prejudiceRowsV73();
    assert.ok(rows.length > 0 && rows.every((r) => /^Prejudice \(/.test(r.label)));
    assert.ok(retargetGroupsV73('social').some((g) => g.group === 'Prejudice'));
    assert.ok(!retargetGroupsV73('social', { applied: [rows[0]!.label] }).some((g) => g.group === 'Prejudice'));
  });
  test('every switch off is exactly tnCandidates', () => {
    withRule('retarget.noticeAsPerception', false, () => withRule('retarget.hearingRows', false, () => withRule('retarget.prejudiceRows', false, () => withRule('retarget.superiorPosition', 'never', () => {
      for (const k of ['plain', 'perceive', 'sneak', 'social', 'attack', 'defend', 'spell', 'notice', 'drive']) {
        assert.deepEqual(retargetGroupsV73(k, { reveal: 'notice' }), tnCandidates(k), k);
      }
    }))));
  });
});

describe('v0.73.0 O41: statuses that outlive their reason', () => {
  test('broken comes off at the end of the combat (switchable)', () => {
    assert.deepEqual(combatEndUnsets({ broken: true }), ['broken']);
    assert.deepEqual(combatEndUnsets({}), []);
    assert.deepEqual(combatEndUnsets(null), []);
    withRule('statuses.brokenEndsWithCombat', false, () => assert.deepEqual(combatEndUnsets({ broken: true }), []));
  });
  test('a timed hold\'s entry goes with its status; a sustained one stays', () => {
    const list = [
      { id: 'a', status: 'paralysis', holdTurns: 3 },
      { id: 'b', status: 'paralysis', holdTurns: 0 },
      { id: 'c', status: 'sr2ePetrified', holdTurns: 2 },
      { id: 'd' },
    ];
    assert.deepEqual(timedOutHoldIds(list, ['paralysis']), ['a']);
    assert.deepEqual(timedOutHoldIds(list, ['paralysis', 'sr2ePetrified']), ['a', 'c']);
    assert.deepEqual(timedOutHoldIds(list, []), []);
    assert.deepEqual(timedOutHoldIds(null, ['paralysis']), []);
    withRule('statuses.timedHoldEnds', false, () => assert.deepEqual(timedOutHoldIds(list, ['paralysis']), []));
  });
});

describe('v0.73.0 O42: the advancement log and projects', () => {
  const ctx = { by: 'Ann', at: '2026-10-23T00:00:00Z', t: 100, ids: (() => { let i = 0; return () => `id${++i}`; })() };
  const spent: AdvanceLine = { id: 's', at: '', t: 0, by: 'Ann', approvedBy: '', karma: 0, nuyen: -5000, kind: 'gain', what: 'Bought Ares Predator' };
  const refund = (reason: string, amount: number) => ({ kind: 'ledger' as const, entry: { kind: 'nuyen' as const, amount, reason } });

  test('refundedName strips the prefix, "on order" and the count', () => {
    assert.equal(refundedName('Given up (refund): Ares Predator ×2 on order'), 'Ares Predator');
    assert.equal(refundedName('Given up (refund): Learning Heal at Force 3'), 'Learning Heal at Force 3');
    assert.equal(refundedName('Earned'), '');
  });
  test('a refund of a logged purchase gets a line; one with no logged spend does not (matched)', () => {
    const lines = composeAdvancementV73([refund('Given up (refund): Ares Predator on order', 5000)], { ...ctx, log: [spent] });
    assert.equal(lines.length, 1);
    assert.equal(lines[0]!.nuyen, 5000);
    assert.equal(lines[0]!.refund, true);
    assert.equal(lines[0]!.by, 'Ann');
    assert.equal(composeAdvancementV73([refund('Given up (refund): Hacking Pool +2', 800)], { ...ctx, log: [spent] }).length, 0);
    withRule('advancement.nuyenRefunds', 'all', () => assert.equal(refundLogged('Given up (refund): Hacking Pool +2', []), true));
    withRule('advancement.nuyenRefunds', 'off', () => assert.equal(composeAdvancementV73([refund('Given up (refund): Ares Predator on order', 5000)], { ...ctx, log: [spent] }).length, 0));
  });
  test('earned nuyen still isn\'t a line', () => {
    assert.equal(composeAdvancementV73([refund('Earned', 5000)], { ...ctx, log: [spent] }).length, 0);
  });
  test('totals take refunds off nuyen spent (never below 0), old refund lines too', () => {
    const back: RefundAware = { ...spent, id: 'r', nuyen: 5000, what: 'Given up (refund): Ares Predator on order', refund: true };
    assert.equal(advancementTotalsV73([spent, back]).nuyenSpent, 0);
    assert.equal(advancementTotalsV73([spent, { ...back, refund: undefined }]).nuyenSpent, 0);
    assert.equal(advancementTotalsV73([back]).nuyenSpent, 0);
    // A GM note with +nuyen that isn't a refund doesn't count.
    assert.equal(advancementTotalsV73([spent, { ...back, refund: undefined, what: 'Found a credstick' }]).nuyenSpent, 5000);
    withRule('advancement.nuyenRefunds', 'off', () => assert.equal(advancementTotalsV73([spent, back]).nuyenSpent, 5000));
  });
  test('an approved request credits the player, approved by the GM', () => {
    assert.deepEqual(projectCredit({ user: 'GM', requester: 'Ann', gm: 'GM' }), { by: 'Ann', approvedBy: 'GM' });
    assert.deepEqual(projectCredit({ user: 'Ann' }), { by: 'Ann', approvedBy: '' });
    withRule('advancement.creditRequester', false, () => assert.deepEqual(projectCredit({ user: 'GM', requester: 'Ann', gm: 'GM' }), { by: 'GM', approvedBy: '' }));
  });
  test('training done mode', () => {
    assert.equal(trainingDoneMode(), 'doneLine');
    withRule('advancement.trainingDone', 'old', () => assert.equal(trainingDoneMode(), 'old'));
    withRule('advancement.trainingDone', 'bogus', () => assert.equal(trainingDoneMode(), 'doneLine'));
  });
});

describe('v0.73.0 O43: vehicle mod installs paid up front', () => {
  test('paid now by the installer: refunded through the project', () => {
    assert.deepEqual(modInstallPayment({ modCost: 0, tableCost: 2500, payerUuid: 'A', installerUuid: 'A', waits: true }), { cost: 2500, upFront: true, refund: 'project' });
  });
  test('paid now by someone else: refunded to them', () => {
    assert.deepEqual(modInstallPayment({ modCost: 1200, tableCost: 2500, payerUuid: 'B', installerUuid: 'A', waits: true }), { cost: 1200, upFront: true, refund: 'payer' });
  });
  test('nobody paying, free, no project, or switched off: paid when it goes in (or not at all)', () => {
    assert.equal(modInstallPayment({ modCost: 0, tableCost: 2500, payerUuid: null, installerUuid: 'A', waits: true }).upFront, false);
    assert.equal(modInstallPayment({ modCost: 0, tableCost: 0, payerUuid: 'A', installerUuid: 'A', waits: true }).upFront, false);
    assert.equal(modInstallPayment({ modCost: 0, tableCost: 2500, payerUuid: 'A', installerUuid: 'A', waits: false }).upFront, false);
    withRule('modInstall.payUpFront', false, () => assert.deepEqual(modInstallPayment({ modCost: 0, tableCost: 2500, payerUuid: 'A', installerUuid: 'A', waits: true }), { cost: 2500, upFront: false, refund: 'none' }));
  });
});
