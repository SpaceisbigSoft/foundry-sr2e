import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { RULES } from '../rules/index.ts';
import { oldWay } from '../rules/__tests__/oldway.ts';
import * as M from '../rules/mxlife97.ts';
import { PSYCHE_UNTIL_RECOVERED } from '../rules/matrix923.ts';
import { HOUSE_MXLIFE_V97 } from '../rules/config97/mxlife.ts';

const DAY = 86400;

// Until the lead merges the i18n draft into public/lang/en.json: its English (no draft, no harm).
const draftFile = fileURLToPath(new URL('../../../i18n-drafts/mxlife97.json', import.meta.url));
const draft: Record<string, string> = existsSync(draftFile) ? JSON.parse(readFileSync(draftFile, 'utf8')) : {};
const enFlat: Record<string, string> = {};
const walk = (o: unknown, p: string): void => { if (typeof o === 'string') { enFlat[p] = o; return; } if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) walk(v, p ? `${p}.${k}` : k); };
walk(JSON.parse(readFileSync(fileURLToPath(new URL('../../../public/lang/en.json', import.meta.url)), 'utf8')), '');
const lang = { ...draft, ...enFlat };

describe('v0.97.0 MXLIFE_V97: the switches', () => {
  test('every switch ships the book\'s way first, each has a house-rules row and a label', () => {
    const settings = readFileSync(fileURLToPath(new URL('../settings.ts', import.meta.url)), 'utf8');
    assert.match(settings, /\.\.\.HOUSE_MXLIFE_V97,/, 'the rows are in the house-rules window');
    for (const k of Object.keys(RULES.MXLIFE_V97)) assert.ok(HOUSE_MXLIFE_V97.some((r) => r.path === `MXLIFE_V97.${k}`), k);
    for (const k of ['psychRecovery', 'paydataDecay', 'cookInstall', 'otakuChannels', 'complexForms', 'otakuArmor'] as const) assert.equal(RULES.MXLIFE_V97[k], 'book', k);
    assert.equal(RULES.MXLIFE_V97.icToken, 'scene');
    for (const row of HOUSE_MXLIFE_V97) {
      const v = row.path.split('.').reduce((o: any, k) => o[k], RULES as any);
      assert.equal(row.choices?.[0], v, `${row.path}: the shipped value is the first choice`);
      assert.ok(lang[`SR2E.HouseRules.Rule.${row.path.replace(/\./g, '__')}`], `${row.path} label`);
    }
  });
  test('every language key the new files use has English', () => {
    for (const f of ['../rules/mxlife97.ts', '../applications/mxlife97.ts']) {
      const src = readFileSync(fileURLToPath(new URL(f, import.meta.url)), 'utf8');
      for (const m of src.matchAll(/'(SR2E\.MxLife97\.[A-Za-z.]+[A-Za-z])'/g)) assert.ok(lang[String(m[1])], String(m[1]));
    }
    for (const c of M.CARES_97) assert.ok(lang[`SR2E.MxLife97.Care.${c}`], c);
    for (const k of ['cook', 'install']) assert.ok(lang[`SR2E.MxLife97.Cook.${k}`], k);
    for (const k of ['phobiaUntreated', 'judasUncaught', 'formOperational', 'formHardening', 'formAboveComputer']) assert.ok(lang[`SR2E.MxLife97.Why.${k}`], k);
  });
});

describe('v0.97.0 psychotropic recovery (VR2 p. 50)', () => {
  const eff = (kind: string) => ({ kind, icName: 'Psycho-6', rating: 6, until: PSYCHE_UNTIL_RECOVERED });
  test('only the book\'s "until recovered" effects recover by tests; v965 or MATRIX_V923.psychotropic v922: none', (t) => {
    assert.equal(M.recovers(eff('cyberphobia')), true);
    assert.equal(M.recovers({ kind: 'cyberphobia', until: 1000 }), false, 'a fixed-time effect (v922) just runs out');
    const undo = oldWay({ 'MXLIFE_V97.psychRecovery': 'v965' });
    assert.equal(M.recovers(eff('cyberphobia')), false);
    undo();
    t.after(oldWay({ 'MATRIX_V923.psychotropic': 'v922' }));
    assert.equal(M.recovers(eff('cyberphobia')), false);
  });
  test('weekly, daily for Matrix maniac (frenzy); every period passed is one test', () => {
    assert.equal(M.recoveryPeriodDays('cyberphobia'), 7);
    assert.equal(M.recoveryPeriodDays('frenzy'), 1);
    assert.deepEqual(M.recoveryDue('judas', null, 100), { due: 0, next: 100 + 7 * DAY }, 'the clock starts');
    assert.deepEqual(M.recoveryDue('judas', 100 + 7 * DAY, 100 + 3 * DAY), { due: 0, next: 100 + 7 * DAY });
    assert.deepEqual(M.recoveryDue('judas', 100 + 7 * DAY, 100 + 7 * DAY), { due: 1, next: 100 + 14 * DAY });
    assert.deepEqual(M.recoveryDue('frenzy', 0, 3 * DAY + 5), { due: 4, next: 4 * DAY });
    assert.equal(M.recoveryDue('frenzy', 0, 400 * DAY).due, 52, 'capped');
    assert.deepEqual(M.recoveryDue('frenzy', 10 * DAY, 0), { due: 0, next: DAY }, 'a schedule in the future (a clock set back) starts again');
  });
  test('the TN: rating, −1 medication, −2 therapy (not cumulative), −1 spell, +1 conditioning, at least 2', () => {
    assert.equal(M.recoveryTn({ rating: 6, kind: 'judas', care: 'none' }), 6);
    assert.equal(M.recoveryTn({ rating: 6, kind: 'judas', care: 'medication' }), 5);
    assert.equal(M.recoveryTn({ rating: 6, kind: 'judas', care: 'therapy' }), 4);
    assert.equal(M.recoveryTn({ rating: 6, kind: 'judas', care: 'therapy', spell: true }), 3);
    assert.equal(M.recoveryTn({ rating: 6, kind: 'conditioning', care: 'none' }), 7);
    assert.equal(M.recoveryTn({ rating: 2, kind: 'frenzy', care: 'therapy', spell: true }), 2);
  });
  test('cyberphobia needs treatment, Judas needs catching (VR2 p. 49)', () => {
    assert.equal(M.recoveryBlocked({ kind: 'cyberphobia', care: 'none' }), 'SR2E.MxLife97.Why.phobiaUntreated');
    assert.equal(M.recoveryBlocked({ kind: 'cyberphobia', care: 'none', spell: true }), '');
    assert.equal(M.recoveryBlocked({ kind: 'cyberphobia', care: 'medication' }), '');
    assert.equal(M.recoveryBlocked({ kind: 'judas', care: 'therapy' }), 'SR2E.MxLife97.Why.judasUncaught');
    assert.equal(M.recoveryBlocked({ kind: 'judas', care: 'none', caught: true }), '');
    assert.equal(M.recoveryBlocked({ kind: 'frenzy', care: 'none' }), '');
  });
  test('schedule keys hold no dots', () => {
    assert.doesNotMatch(M.psycheKey({ kind: 'judas', icName: 'Judas v2.1', rating: 5 }), /\./);
  });
});

describe('v0.97.0 paydata going stale (VR2 p. 65)', () => {
  test('a point is a paydata file worth one Paydata Point; story files and v922 paydata are left alone', (t) => {
    assert.equal(M.isPaydataPoint({ paydata: true, value: 5000 }), true);
    assert.equal(M.isPaydataPoint({ paydata: true, value: 12000 }), false, 'priced by the GM');
    assert.equal(M.isPaydataPoint({ paydata: false, value: 5000 }), false);
    t.after(oldWay({ 'MATRIX_V923.paydata': 'v922' }));
    assert.equal(M.isPaydataPoint({ paydata: true, value: 5000 }), false);
  });
  test('one point a full day, at most the stock; the clock starts, keeps its day and ends with the stock', () => {
    assert.deepEqual(M.paydataStale(3, null, 50), { lost: 0, since: 50 });
    assert.deepEqual(M.paydataStale(3, 50, 50 + DAY - 1), { lost: 0, since: 50 });
    assert.deepEqual(M.paydataStale(3, 50, 50 + DAY + 10), { lost: 1, since: 50 + DAY });
    assert.deepEqual(M.paydataStale(3, 50, 50 + 2 * DAY), { lost: 2, since: 50 + 2 * DAY });
    assert.deepEqual(M.paydataStale(3, 50, 50 + 9 * DAY), { lost: 3, since: null });
    assert.deepEqual(M.paydataStale(0, 50, 50 + 9 * DAY), { lost: 0, since: null });
    assert.deepEqual(M.paydataStale(2, 900, 50), { lost: 0, since: 50 }, 'a clock in the future starts again');
  });
  test('v965: it keeps', (t) => {
    t.after(oldWay({ 'MXLIFE_V97.paydataDecay': 'v965' }));
    assert.deepEqual(M.paydataStale(3, 50, 50 + 9 * DAY), { lost: 0, since: null });
  });
});

describe('v0.97.0 Cook and Installation tasks (VR2 pp. 77, 82–88)', () => {
  test('the book\'s base times and TNs by part', () => {
    assert.deepEqual(M.deckTasks('mpcp', 6, 6), { cook: { base: 18, tn: 6 }, install: { base: 12, tn: 6 } });
    assert.deepEqual(M.deckTasks('evasion', 5, 6), { cook: { base: 15, tn: 5 }, install: { base: 10, tn: 5 } });
    assert.deepEqual(M.deckTasks('hardening', 4, 6), { cook: { base: 24, tn: 6 }, install: { base: 48, tn: 6 } });
    assert.deepEqual(M.deckTasks('responseIncrease', 2, 8), { cook: { base: 16, tn: 4 }, install: { base: 10, tn: 4 } });
    assert.deepEqual(M.deckTasks('storageMemory', 450, 6), { cook: null, install: { base: 5, tn: 5 } });
    assert.deepEqual(M.deckTasks('activeMemory', 50, 6), { cook: null, install: { base: 1, tn: 2 } }, 'round up; TN at least 2');
    assert.deepEqual(M.deckTasks('ioSpeed', 150, 6), { cook: null, install: { base: 8, tn: 2 } });
    assert.equal(M.deckTasks('casing', 1, 6), null);
  });
  test('a task\'s days: base ÷ successes; a failure wastes base ÷ 2D6 (round up) and starts again', () => {
    assert.deepEqual(M.taskDays(18, [3], []), { days: 6, done: true, tries: 1 });
    assert.deepEqual(M.taskDays(18, [4], []), { days: 5, done: true, tries: 1 });
    assert.deepEqual(M.taskDays(18, [0, 2], [7]), { days: 3 + 9, done: true, tries: 2 });
    assert.deepEqual(M.taskDays(18, [0, 0], [12, 4]), { days: 2 + 5, done: false, tries: 2 });
  });
  test('v965: no tasks', (t) => {
    t.after(oldWay({ 'MXLIFE_V97.cookInstall': 'v965' }));
    assert.equal(M.deckTasks('mpcp', 6, 6), null);
  });
});

describe('v0.97.0 otaku (VR2 pp. 144–145; otaku errata)', () => {
  test('channels: no MPCP cap (book); v965 keeps MATRIX.otaku.channels.maxFromMpcp', (t) => {
    assert.equal(M.channelCapped(), false);
    t.after(oldWay({ 'MXLIFE_V97.otakuChannels': 'v965' }));
    assert.equal(M.channelCapped(), RULES.MATRIX.otaku.channels.maxFromMpcp);
  });
  test('complex forms: at most Computer, no operational utility, no Hardening; v965 null (the MPCP cap)', (t) => {
    assert.equal(M.complexFormRefusal('attack', 5, 5), '');
    assert.equal(M.complexFormRefusal('attack', 6, 5), 'SR2E.MxLife97.Why.formAboveComputer');
    assert.equal(M.complexFormRefusal('analyze', 3, 6), 'SR2E.MxLife97.Why.formOperational');
    assert.equal(M.complexFormRefusal('read/write', 3, 6), 'SR2E.MxLife97.Why.formOperational');
    assert.equal(M.complexFormRefusal('hardening', 3, 6), 'SR2E.MxLife97.Why.formHardening');
    assert.equal(M.complexFormRefusal('armor', 3, 6), '');
    t.after(oldWay({ 'MXLIFE_V97.complexForms': 'v965' }));
    assert.equal(M.complexFormRefusal('analyze', 9, 1), null);
  });
  test('the task: base = size × 2 days ÷ successes, cut by the otaku task bonus (I + C) ÷ 4 round up', () => {
    assert.equal(M.otakuTaskBonus(6, 5), 3);
    assert.equal(M.otakuTaskBonus(4, 4), 2);
    const one = M.complexFormTask({ kind: 'attack', rating: 4, bonus: 0, successes: 1 });
    assert.equal(one.base, one.size * RULES.MATRIX.programming.daysPerMp);
    assert.equal(one.tn, 4);
    const t2 = M.complexFormTask({ kind: 'attack', rating: 4, bonus: 2, successes: 2 });
    assert.equal(t2.days, Math.ceil(Math.ceil(one.base / 2) / 3));
    assert.equal(t2.done, true);
    const bad = M.complexFormTask({ kind: 'attack', rating: 4, bonus: 2, successes: 0, waste2d6: 6 });
    assert.deepEqual([bad.done, bad.days], [false, Math.ceil(one.base / 6)]);
  });
  test('free Armor = Willpower unless a loaded Armor rates higher; decks and v965 untouched', (t) => {
    assert.deepEqual(M.livingArmor({ living: true, willpower: 5, loaded: 0 }), { rating: 5, free: true });
    assert.deepEqual(M.livingArmor({ living: true, willpower: 5, loaded: 7 }), { rating: 7, free: false });
    assert.equal(M.livingArmor({ living: false, willpower: 5, loaded: 0 }), null);
    t.after(oldWay({ 'MXLIFE_V97.otakuArmor': 'v965' }));
    assert.equal(M.livingArmor({ living: true, willpower: 5, loaded: 0 }), null);
  });
});

describe('v0.97.0 IC on the Matrix scene', () => {
  test('spots beside the host, rows of four', () => {
    assert.deepEqual(M.icSpot(100, 200, 100, 0), { x: 200, y: 200 });
    assert.deepEqual(M.icSpot(100, 200, 100, 3), { x: 500, y: 200 });
    assert.deepEqual(M.icSpot(100, 200, 100, 4), { x: 200, y: 300 });
  });
  test('v965: off', (t) => {
    assert.equal(M.icTokenOn(), true);
    t.after(oldWay({ 'MXLIFE_V97.icToken': 'v965' }));
    assert.equal(M.icTokenOn(), false);
  });
});
