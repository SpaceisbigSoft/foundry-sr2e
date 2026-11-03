import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  RULES, beforeValues, afterValues, inverseUpdate, changedSince, logChange, newestStep, stepLabel, describeEntry,
  fieldLabel, shortValue, cardTitle, sanitizeLog, dieChance, successOdds, parseModifierLines, percent, timeSteps,
  formatWorldTime, describeSpan, stepChecks, pathsOverlap, pickUndo, purgeHistory, changePaths, forgetMatch, normalizePreset, describePreset, partyTotals, getAt, hasAt, undoLimits,
  type UndoStep, type UndoEntry,
} from '../index.ts';

/** Foundry-like merge of an update (dotted keys, -= / == keys) for the round-trip tests. */
function applyUpdate(src: any, upd: Record<string, unknown>): any {
  const out = JSON.parse(JSON.stringify(src));
  for (const [k, v] of Object.entries(upd)) {
    const segs = k.split('.');
    let last = segs.pop()!;
    let o = out;
    for (const s of segs) { o[s] ??= {}; o = o[s]; }
    if (last.startsWith('-=')) { delete o[last.slice(2)]; continue; }
    if (last.startsWith('==')) { o[last.slice(2)] = JSON.parse(JSON.stringify(v)); continue; }
    const merge = (t: any, key: string, val: any) => {
      if (val && typeof val === 'object' && !Array.isArray(val) && t[key] && typeof t[key] === 'object' && !Array.isArray(t[key])) {
        for (const [kk, vv] of Object.entries(val)) merge(t[key], kk, vv);
      } else t[key] = JSON.parse(JSON.stringify(val));
    };
    merge(o, last, v);
  }
  return out;
}

const expand = (flat: Record<string, unknown>) => {
  const out: any = {};
  for (const [k, v] of Object.entries(flat)) { const segs = k.split('.'); let o = out; for (const s of segs.slice(0, -1)) { o[s] ??= {}; o = o[s]; } o[segs.at(-1)!] = v; }
  return out;
};

describe('v0.51.0 undo: what a change was before', () => {
  const src = { name: 'Ganger', system: { monitor: { physical: 2, stun: 0 }, nuyen: 100, ledger: [{ a: 1 }], deep: { x: { y: 1 } } }, flags: { sr2e: { a: 1 } } };

  test('leaves are recorded with their old values; plain objects are walked into', () => {
    const f = beforeValues(src, expand({ 'system.monitor.physical': 5, 'system.nuyen': 50, name: 'Boss' }));
    assert.deepEqual(f.map((x) => [x.path, x.had, x.before]), [['system.monitor.physical', true, 2], ['system.nuyen', true, 100], ['name', true, 'Ganger']]);
  });
  test('arrays and new keys are whole; _id and _stats are skipped', () => {
    const f = beforeValues(src, { _id: 'x', _stats: {}, system: { ledger: [], newThing: { z: 1 } } });
    assert.deepEqual(f.map((x) => [x.path, x.had]), [['system.ledger', true], ['system.newThing', false]]);
    assert.deepEqual(f[0]!.before, [{ a: 1 }]);
  });
  test('-= and == keys (and dotted keys) record the field whole', () => {
    const f = beforeValues(src, { flags: { sr2e: { '-=a': null } }, 'system.==deep': { q: 1 } });
    assert.deepEqual(f.map((x) => x.path), ['flags.sr2e.a', 'system.deep']);
    assert.deepEqual(f[1]!.before, { x: { y: 1 } });
  });
  test("Foundry's operator objects (class instances) are leaves", () => {
    class ForcedDeletion {}
    const f = beforeValues(src, { system: { deep: new ForcedDeletion() } });
    assert.deepEqual(f.map((x) => x.path), ['system.deep']);
  });
  test('recursive: false records top-level keys whole', () => {
    const f = beforeValues(src, { system: { nuyen: 5 } }, { recursive: false });
    assert.deepEqual(f.map((x) => x.path), ['system']);
  });
  test('the inverse puts everything back (values, whole objects, removed new keys)', () => {
    const upd = { system: { monitor: { physical: 9 }, ledger: [], newThing: { z: 1 }, deep: { x: { y: 7 } } }, flags: { sr2e: { b: 2 } } };
    const fields = beforeValues(src, upd);
    const after = applyUpdate(src, upd as any);
    const inv = inverseUpdate(fields);
    assert.deepEqual(applyUpdate(after, inv), src);
    assert.ok('system.-=newThing' in inv && 'flags.sr2e.-=b' in inv);
  });
  test('the inverse replaces an object that was overwritten whole', () => {
    const fields = beforeValues(src, { 'system.==deep': { q: 1 } });
    const after = applyUpdate(src, { 'system.==deep': { q: 1 } });
    assert.deepEqual(applyUpdate(after, inverseUpdate(fields)), src);
  });
  test('changed since: only fields whose value now differs from what the change left', () => {
    const fields = afterValues({ system: { nuyen: 50, monitor: { physical: 5 } } }, beforeValues(src, expand({ 'system.nuyen': 50, 'system.monitor.physical': 5 })));
    assert.deepEqual(changedSince({ system: { nuyen: 50, monitor: { physical: 6 } } }, fields).map((f) => f.path), ['system.monitor.physical']);
    assert.deepEqual(changedSince({ system: { nuyen: 50, monitor: { physical: 5 } } }, fields), []);
    // A field removed since counts as changed; unknown "after" never does.
    assert.deepEqual(changedSince({ system: { monitor: { physical: 5 } } }, fields).map((f) => f.path), ['system.nuyen']);
    assert.deepEqual(changedSince({}, beforeValues(src, { name: 'x' })), []);
  });
  test('path helpers', () => {
    assert.equal(getAt(src, 'system.deep.x.y'), 1);
    assert.equal(hasAt(src, 'system.deep.x.z'), false);
    assert.equal(hasAt(src, 'system.monitor.stun'), true);
  });
});

describe('v0.51.0 undo: steps', () => {
  const who = { userId: 'gm', userName: 'GM' };
  let n = 0;
  const id = () => `s${++n}`;
  const upd = (name: string, path = 'system.nuyen', before: unknown = 1, after: unknown = 2): UndoEntry =>
    ({ op: 'update', docName: 'Actor', uuid: `Actor.${name}`, name, fields: [{ path, had: true, before, hadAfter: true, after }] });

  test('changes within the window join one step; later ones start another', () => {
    const log: UndoStep[] = [];
    logChange(log, upd('A'), who, 1000, id);
    logChange(log, upd('B'), who, 2000, id);
    logChange(log, upd('C'), who, 5000, id);
    assert.equal(log.length, 2);
    assert.equal(log[0]!.entries.length, 2);
    assert.equal(newestStep(log)!.entries[0]!.name, 'C');
  });
  test('other users get their own steps; Undo takes the newest activity first', () => {
    const log: UndoStep[] = [];
    logChange(log, upd('A'), who, 1000, id);
    logChange(log, upd('P'), { userId: 'p', userName: 'Player' }, 1200, id);
    logChange(log, upd('A2'), who, 1500, id);
    assert.equal(log.length, 2);
    // As undo.ts takes a step: the newest, spliced out (v0.81.0: the unused popNewest helper is gone).
    const popNewest = (l: UndoStep[]) => { const s = newestStep(l); if (s) l.splice(l.indexOf(s), 1); return s ?? null; };
    assert.equal(popNewest(log)!.userId, 'gm');
    assert.equal(popNewest(log)!.userId, 'p');
    assert.equal(popNewest(log), null);
  });
  test('a plain chat line never starts a step, but joins one already open', () => {
    const log: UndoStep[] = [];
    const chat: UndoEntry = { op: 'create', docName: 'ChatMessage', uuid: 'ChatMessage.x', name: 'hello', plainChat: true };
    assert.equal(logChange(log, chat, who, 1000, id), null);
    logChange(log, upd('A'), who, 3000, id);
    logChange(log, { ...chat, name: 'GM: A +1 physical' }, who, 3100, id);
    assert.equal(log[0]!.entries.length, 2);
    assert.equal(log[0]!.label, 'GM: A +1 physical');
  });
  test('the log keeps the newest steps; a full step is marked partly undoable', () => {
    const log: UndoStep[] = [];
    const o = { windowMs: 100, maxSteps: 3, maxEntries: 2, skipPlainChat: true };
    for (let i = 0; i < 5; i++) logChange(log, upd(`A${i}`), who, i * 1000, id, o);
    assert.deepEqual(log.map((s) => s.entries[0]!.name), ['A2', 'A3', 'A4']);
    logChange(log, upd('B'), who, 4050, id, o);
    logChange(log, upd('C'), who, 4060, id, o);
    assert.equal(newestStep(log)!.entries.length, 2);
    assert.equal(newestStep(log)!.partial, true);
  });
  test('a step that moved world time stays open for 5 s (timed effects land after it)', () => {
    const log: UndoStep[] = [];
    const time: UndoEntry = { op: 'update', docName: 'Setting', uuid: 'Setting.t', name: 'World time', settingKey: 'core.time', fields: [{ path: 'value', had: true, before: '0', hadAfter: true, after: '604800' }] };
    logChange(log, time, who, 1000, id);
    logChange(log, upd('Drugged'), who, 4500, id);
    assert.equal(log.length, 1);
    logChange(log, upd('Later'), who, 11000, id);
    assert.equal(log.length, 2);
  });
  test('step checks: only the newest change to a field is compared; deleted later = not gone', () => {
    const step: UndoStep = { id: 'x', userId: 'gm', userName: 'GM', started: 0, last: 0, label: '', entries: [
      upd('A', 'system.monitor', { physical: 0 }, { physical: 1 }),
      upd('A', 'system.monitor.physical', 1, 2),
      { op: 'delete', docName: 'Item', uuid: 'Actor.B.Item.i', name: 'i', parentUuid: 'Actor.B', data: {} },
      { op: 'delete', docName: 'Actor', uuid: 'Actor.B', name: 'B', data: {} },
    ] };
    step.entries.splice(2, 0, { ...upd('i'), uuid: 'Actor.B.Item.i' });
    const c = stepChecks(step);
    // Newest first: B deleted, item deleted (its parent is deleted later: no parent check), item update (recreated: no checks), A's physical, A's monitor (covered).
    assert.deepEqual(c.map((x) => [x.entry.name, x.fields.length, x.checkGone, x.checkParent]),
      [['B', 0, false, false], ['i', 0, false, false], ['i', 0, false, false], ['A', 1, true, false], ['A', 0, true, false]]);
    assert.ok(pathsOverlap('system.monitor', 'system.monitor.physical') && !pathsOverlap('system.mon', 'system.monitor'));
  });
  test('labels: a card title wins, then one change in words, then names and a count', () => {
    const s: UndoStep = { id: 'x', userId: 'gm', userName: 'GM', started: 0, last: 0, label: '', entries: [upd('Ganger', 'system.monitor.physical', 2, 5)] };
    assert.equal(stepLabel(s), 'Ganger: Physical 2 → 5');
    s.entries.push(upd('Boss'));
    assert.equal(stepLabel(s), 'Ganger, Boss (2 changes)');
    s.entries.push({ op: 'create', docName: 'ChatMessage', uuid: 'ChatMessage.c', name: 'Attack: Ares Predator' });
    assert.equal(stepLabel(s), 'Attack: Ares Predator');
  });
  test('describing changes', () => {
    assert.equal(describeEntry({ op: 'delete', docName: 'Item', uuid: 'x', name: 'Medkit' }), 'item “Medkit” deleted');
    assert.equal(describeEntry({ op: 'update', docName: 'Setting', uuid: 'x', name: 'World time', settingKey: 'core.time', fields: [{ path: 'value', had: true, before: '0', hadAfter: true, after: '3600' }] }), 'world time 00:00:00 → 01:00:00');
    assert.equal(fieldLabel('system.poolSpent.combat'), 'combat Pool spent');
    assert.equal(fieldLabel('flags.sr2e.cardRolls'), 'flag cardRolls');
    assert.equal(fieldLabel('system.matrix.trace.active'), 'trace active');
    assert.equal(shortValue([1, 2]), '2 items');
    assert.equal(shortValue(undefined), '—');
  });
  test('card titles from HTML and flavor', () => {
    assert.equal(cardTitle('<div class="sr2e-roll"><h3>Attack: <em>Pistol</em> &amp; more</h3><p>x</p></div>'), 'Attack: Pistol & more');
    assert.equal(cardTitle('<p><strong>GM:</strong> undid it.</p>'), 'GM: undid it.');
    assert.equal(cardTitle('<p>x</p>', 'Flavor text'), 'Flavor text');
  });
  test('a stored log is cleaned on load', () => {
    assert.deepEqual(sanitizeLog('nope'), []);
    const s = sanitizeLog([{ id: 'a', last: 1, entries: [{ op: 'update', uuid: 'x' }, { op: 'bad' }, null] }, { id: 2 }]);
    assert.equal(s.length, 1);
    assert.equal(s[0]!.entries.length, 1);
  });
  test('the limits list says what undo cannot do', () => {
    const limits = undoLimits();
    assert.ok(limits.length >= 5);
    assert.ok(limits.some((l) => /Dice/.test(l)) && limits.some((l) => /Token moves/.test(l)));
  });
});

describe('v0.51.0 calculator odds', () => {
  test('one die: TN 2..6, 7 is the same as 6, 12 needs two sixes', () => {
    assert.equal(dieChance(2), 5 / 6);
    assert.equal(dieChance(4), 0.5);
    assert.equal(dieChance(6), 1 / 6);
    assert.equal(dieChance(7), 1 / 6);
    assert.ok(Math.abs(dieChance(8) - 5 / 36) < 1e-12);
    assert.ok(Math.abs(dieChance(12) - 1 / 36) < 1e-12);
    assert.equal(dieChance(1), 1);
  });
  test('several dice: at least k, expected successes, disaster', () => {
    const o = successOdds(4, 4);
    assert.equal(o.atLeast[0], 1);
    assert.ok(Math.abs(o.atLeast[1]! - (1 - 0.5 ** 4)) < 1e-12);
    assert.ok(Math.abs(o.atLeast[4]! - 0.5 ** 4) < 1e-12);
    assert.equal(o.expected, 2);
    assert.ok(Math.abs(o.disaster - 1 / 1296) < 1e-12);
    assert.deepEqual(successOdds(0, 4).atLeast, [1]);
    // The TN is never below the minimum.
    assert.equal(successOdds(1, 0).perDie, dieChance(RULES.MIN_TARGET_NUMBER));
  });
  test('modifier lines and percentages', () => {
    assert.deepEqual(parseModifierLines('Smoke +4\nWounds: 2\n  \nCover −1\nnonsense\nSmartlink -2'),
      [{ label: 'Smoke', value: 4 }, { label: 'Wounds', value: 2 }, { label: 'Cover', value: -1 }, { label: 'Smartlink', value: -2 }]);
    assert.equal(percent(0.5), '50%');
    assert.equal(percent(0.999), '>99%');
    assert.equal(percent(0.001), '<1%');
    assert.equal(percent(0), '0%');
  });
});

describe('v0.51.0 time steps', () => {
  test('week, month and year buttons follow the calendar settings', () => {
    const s = timeSteps();
    assert.deepEqual(s.slice(-3).map((x) => x.seconds), [7 * 86400, 30 * 86400, 365 * 86400]);
    const old = RULES.GM_TOOLS.monthDays;
    (RULES.GM_TOOLS as any).monthDays = 28;
    try { assert.equal(timeSteps().find((x) => x.label === '+1 month')!.seconds, 28 * 86400); } finally { (RULES.GM_TOOLS as any).monthDays = old; }
  });
  test('world time shows years once there is one', () => {
    assert.equal(formatWorldTime(3661), '01:01:01');
    assert.equal(formatWorldTime(86400 + 60), 'day 2, 00:01:00');
    assert.equal(formatWorldTime(365 * 86400 + 86400 * 44 + 8 * 3600), 'year 2, day 45, 08:00:00');
  });
  test('spans in words', () => {
    assert.equal(describeSpan(7 * 86400), '1 week');
    assert.equal(describeSpan(30 * 86400), '1 month');
    assert.equal(describeSpan(730 * 86400), '2 years');
    assert.equal(describeSpan(2 * 86400), '2 days');
    assert.equal(describeSpan(3 * 3600 + 300), '3 h 5 min');
    assert.equal(describeSpan(-3), '3 s');
  });
});

describe('v0.51.0 scene presets and the party summary', () => {
  test('presets are cleaned up; darkness can be left alone', () => {
    const p = normalizePreset({ id: 'a', name: ' ', background: '3.7', weather: '', darkness: '' });
    assert.deepEqual(p, { id: 'a', name: 'Preset', background: 3, sources: '', environment: '', weather: 'clear', terrain: '', darkness: null });
    assert.equal(normalizePreset({ darkness: 2 }).darkness, 1);
    assert.equal(describePreset(normalizePreset({ background: 2, weather: 'fog', darkness: 0.5, environment: 'urban' })), 'background 2 · fog · darkness 0.5 · urban');
  });
  test('party totals and who is behind on rent', () => {
    const t = partyTotals([
      { name: 'A', nuyen: 1000, karma: 5, pool: 2, career: 30, lifestyleDays: 3 },
      { name: 'B', nuyen: 500, karma: 1, pool: 1, career: 10, lifestyleDays: null },
      { name: 'C', nuyen: 0, karma: 0, pool: 1, career: 0, lifestyleDays: 40 },
    ]);
    assert.deepEqual(t, { nuyen: 1500, karma: 6, pool: 4, career: 40, behind: ['A'] });
  });
});

describe('v0.51.0 Ctrl+Z: the canvas and the log, newest first', () => {
  test('whichever came last; a step at the same moment as a canvas entry wins', () => {
    assert.equal(pickUndo(null, null), null);
    assert.equal(pickUndo(1000, null), 'sr2e');
    assert.equal(pickUndo(null, 1000), 'canvas');
    assert.equal(pickUndo(1000, 5000), 'canvas');
    assert.equal(pickUndo(5000, 1000), 'sr2e');
    assert.equal(pickUndo(1000, 1100), 'sr2e');
    // An entry made before the history was stamped (0) is older than any step.
    assert.equal(pickUndo(1, 0), 'sr2e');
  });
  test('purging a layer history of documents the log put back', () => {
    const h = [{ type: 'create', data: [{ _id: 'w1' }] }, { type: 'update', data: [{ _id: 'w1' }, { _id: 'w2' }] }, { type: 'delete', data: [{ _id: 'w3' }] }];
    const out = purgeHistory(h, new Set(['w1']));
    assert.deepEqual(out.map((e) => [e.type, e.data.map((d) => d._id)]), [['update', ['w2']], ['delete', ['w3']]]);
  });
  test('change paths and forgetting what Foundry undid', () => {
    assert.deepEqual(changePaths({ _id: 'x', x: 1, 'flags.sr2e.a': 2, hidden: true }), ['x', 'flags', 'hidden']);
    const who = { userId: 'gm', userName: 'GM' };
    const log: UndoStep[] = [];
    let n = 0;
    logChange(log, { op: 'update', docName: 'Wall', uuid: 'Scene.s.Wall.w', name: 'w', fields: [{ path: 'ds', had: true, before: 0, hadAfter: true, after: 1 }, { path: 'move', had: true, before: 20, hadAfter: true, after: 0 }] }, who, 1000, () => `s${++n}`);
    logChange(log, { op: 'create', docName: 'Wall', uuid: 'Scene.s.Wall.v', name: 'v' }, who, 1100, () => `s${++n}`);
    assert.equal(forgetMatch(log, 'update', 'Scene.s.Wall.w', ['flags']), false);
    assert.equal(forgetMatch(log, 'update', 'Scene.s.Wall.w', ['ds']), true);
    assert.deepEqual(log[0]!.entries[0]!.fields!.map((f) => f.path), ['move']);
    assert.equal(forgetMatch(log, 'create', 'Scene.s.Wall.v'), true);
    assert.equal(forgetMatch(log, 'update', 'Scene.s.Wall.w', ['move']), true);
    assert.equal(log.length, 0);
  });
});

