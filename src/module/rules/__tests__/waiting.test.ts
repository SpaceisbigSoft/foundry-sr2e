import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  RULES, waits, projectHours, readyAt, timeLabel, hoursLeft, dueProjects, projectList, makeProject, retimed, acquireHours, itemAcquireHours,
  describeProject, fromPairs, PROJECT_CALLS,
} from '../index.ts';

const base = { id: 'p1', kind: 'learn', area: 'magic' as const, label: 'Learning Manabolt', startedAt: 1000, by: 'Corvo', effect: { creates: [] } };

describe('v0.65.0 waiting: defaults and who waits', () => {
  test('on by default, every area; training is timed by default; ritual prep blocks', () => {
    assert.equal(RULES.WAITING.enabled, true);
    assert.deepEqual(Object.values(RULES.WAITING.areas), [true, true, true, true, true]);
    assert.equal(RULES.CHARACTERS_V58.training.mode, 'timed');
    assert.equal(RULES.MAGIC_V39.ritualStages.waitForPrep, 'block');
  });

  test('player characters out of creation wait; NPCs and the wizard don\'t; an area switched off doesn\'t', () => {
    assert.equal(waits({ area: 'magic', actorType: 'character', inCreation: false }), true);
    assert.equal(waits({ area: 'magic', actorType: 'npc', inCreation: false }), false);
    assert.equal(waits({ area: 'magic', actorType: 'character', inCreation: true }), false);
    (RULES.WAITING.areas as any).gear = false;
    try { assert.equal(waits({ area: 'gear', actorType: 'character', inCreation: false }), false); } finally { (RULES.WAITING.areas as any).gear = true; }
    (RULES.WAITING as any).enabled = false;
    try { assert.equal(waits({ area: 'magic', actorType: 'character', inCreation: false }), false); } finally { (RULES.WAITING as any).enabled = true; }
  });
});

describe('v0.65.0 waiting: time', () => {
  test('units, the minimum, ready times and labels', () => {
    assert.equal(projectHours(2.345), 2.35);
    (RULES.WAITING as any).minimumHours = 1;
    try { assert.equal(projectHours(0.2), 1); } finally { (RULES.WAITING as any).minimumHours = 0; }
    assert.equal(readyAt(1000, 2), 1000 + 7200);
    assert.equal(timeLabel(0), 'now');
    assert.equal(timeLabel(0.5), '30 min');
    assert.equal(timeLabel(5), '5 h');
    assert.equal(timeLabel(50), '2 d 2 h');
    assert.equal(timeLabel(48), '2 d');
  });

  test('projects: made with the time, due, retimed from their start, listed from a flag map', () => {
    const p = makeProject({ ...base, hours: 24, paid: { karma: 5.9, nuyen: -3 } });
    assert.equal(p.readyAt, 1000 + 86400);
    assert.deepEqual(p.paid, { karma: 5, nuyen: 0 });
    assert.equal(hoursLeft(p, 1000), 24);
    assert.equal(hoursLeft(p, 1000 + 90000), 0);
    assert.deepEqual(dueProjects([p], 1000 + 86400).map((x) => x.id), ['p1']);
    assert.deepEqual(dueProjects([p], 1000 + 86399), []);
    const r = retimed(p, 12);
    assert.equal(r.readyAt, 1000 + 43200);
    assert.equal(r.startedAt, 1000);
    const q = makeProject({ ...base, id: 'p2', hours: 2 });
    assert.deepEqual(projectList({ p1: p, p2: q, junk: { id: 3 } }).map((x) => x.id), ['p2', 'p1'], 'soonest first, junk dropped');
    assert.deepEqual(projectList(null), []);
    const d = describeProject(p, 1000);
    assert.equal(d.left, '1 d');
    assert.equal(d.paid, '5 Karma');
    assert.equal(describeProject(p, 1000 + 90000).due, true);
  });

  test('getting gear takes its Availability time (÷ successes after a find test)', () => {
    assert.equal(acquireHours('6/48 hrs'), 48);
    assert.equal(acquireHours('6/48 hrs', 4), 12);
    assert.equal(acquireHours('4/7 days'), 168);
    assert.equal(acquireHours('5'), RULES.UPKEEP.availability.defaultHours, 'a bare TN takes the default time');
    assert.equal(acquireHours(''), 0);
    assert.equal(acquireHours('Always'), 0);
    (RULES.WAITING as any).orderFactor = 2;
    try { assert.equal(acquireHours('6/48 hrs'), 96); } finally { (RULES.WAITING as any).orderFactor = 1; }
    assert.ok(itemAcquireHours('cyberware', { availability: '6/48 hrs', grade: 'delta' }) >= 48, 'graded cyberware takes at least the base time');
    assert.equal(itemAcquireHours('gear', { availability: '' }), 0);
  });

  test('changes travel as pairs (a flag can\'t hold dotted keys); the calls a project may make', () => {
    const pairs: Array<[string, unknown]> = [['system.rating', 4], ['system.damaged', false]];
    assert.deepEqual(fromPairs(pairs), { 'system.rating': 4, 'system.damaged': false });
    assert.deepEqual(fromPairs([['ok', 1], ['bad'] as any, 3 as any]), { ok: 1, bad: undefined });
    for (const m of ['finishWard', 'finishElemental', 'finishAlly', 'finishEnchant', 'finishDesign', 'finishCleanse', 'finishDeckPart', 'finishVehicleRepair', 'finishModInstall']) assert.ok((PROJECT_CALLS as readonly string[]).includes(m), m);
  });
});
