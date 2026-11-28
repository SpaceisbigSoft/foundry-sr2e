/**
 * v0.98.0 rules completeness, rigging, drones, sensors and electronic warfare (RULES.VRIG_V98): the pure rules
 * (rules/vrig98.ts) and the shared mount-point hook (rules/dronelink.ts), with the book's examples where Rigger 2 gives
 * one, and for each switch that its other value ('v971') gives the v0.97.1 result.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RULES } from '../rules/config.ts';
import { SYSTEM_ID } from '../config/system.ts';
import { oldWay } from '../rules/__tests__/oldway.ts';
import * as X from '../rules/vrig98.ts';
import { HOUSE_VRIG_V98 } from '../rules/config98/vrig.ts';
import { mountCapacity, mountUsage, mountCheck } from '../rules/dronelink.ts';

/** English from public/lang/en.json, with this area's draft while it isn't merged. */
function english(): Record<string, string> {
  const flat: Record<string, string> = {};
  const walk = (o: unknown, p: string): void => { if (typeof o === 'string') { flat[p] = o; return; } if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) walk(v, p ? `${p}.${k}` : k); };
  walk(JSON.parse(readFileSync(join('public', 'lang', 'en.json'), 'utf8')), '');
  const draft = join('i18n-drafts', 'vrig98.json');
  if (existsSync(draft)) Object.assign(flat, JSON.parse(readFileSync(draft, 'utf8')));
  return flat;
}
(globalThis as any).__SR2E_EN__ = { ...((globalThis as any).__SR2E_EN__ ?? {}), ...english() };

/** Every select switch at its v0.97.1 value (and ED off). */
const V971: Record<string, unknown> = Object.fromEntries(HOUSE_VRIG_V98.filter((r) => r.type === 'select').map((r) => [r.path, r.path.endsWith('.ed') ? 'off' : 'v971']));

describe('v0.98.0 rigging: the switches', () => {
  test('every switch has a house-rules row, the first choice is the default; the optional ED rule ships off', () => {
    const v: any = RULES.VRIG_V98;
    for (const r of HOUSE_VRIG_V98) {
      const key = r.path.split('.')[1]!;
      assert.ok(key in v, r.path);
      if (r.type === 'select') assert.equal(v[key], r.choices![0], `${r.path} defaults to its first choice`);
      assert.equal(r.section, 'vehiclesAndRigging');
    }
    for (const k of Object.keys(v)) assert.ok(HOUSE_VRIG_V98.some((r) => r.path === `VRIG_V98.${k}`), k);
    assert.deepEqual(HOUSE_VRIG_V98.find((r) => r.path === 'VRIG_V98.ed')!.choices, ['off', 'book']);
    assert.equal(v.ed, 'off');
    for (const r of HOUSE_VRIG_V98.filter((x) => x.type === 'select' && !x.path.endsWith('.ed'))) assert.deepEqual(r.choices, ['book', 'v971'], r.path);
  });
  test('every house-rules row and every key the code uses has English', () => {
    const en = english();
    for (const r of HOUSE_VRIG_V98) assert.ok(en[`SR2E.HouseRules.Rule.${r.path.replace('.', '__')}`], r.path);
    const src = ['src/module/rules/vrig98.ts', 'src/module/applications/vrig98.ts', 'src/module/rules/dronelink.ts', 'public/templates/rigging-section.hbs', 'public/templates/actor-vehicle-sheet.hbs']
      .map((f) => readFileSync(join(...f.split('/')), 'utf8')).join('\n');
    const keys = new Set([...src.matchAll(/SR2E\.VRig98\.[A-Za-z0-9_.]+[A-Za-z0-9]/g)].map((m) => m[0]));
    for (const partial of ['SR2E.VRig98.Why', 'SR2E.VRig98.Sensor', 'SR2E.VRig98.Flux', 'SR2E.VRig98.Miji.op', 'SR2E.VRig98.Miji.ch', 'SR2E.VRig98.Miji.lostEffect']) keys.delete(partial);
    for (const w of ['mijiOff', 'channel', 'noRcd', 'noNetwork', 'noPem', 'noEcm', 'noEccm', 'intercept']) keys.add(`SR2E.VRig98.Why.${w}`);
    for (const r of ['r0', 'r1', 'r2', 'r3', 'r4']) keys.add(`SR2E.VRig98.Sensor.${r}`);
    for (const c of Object.keys(X.FLUX_CONDITIONS)) keys.add(`SR2E.VRig98.Flux.${c}`);
    for (const o of X.OPS) keys.add(`SR2E.VRig98.Miji.op.${o}`);
    for (const c of X.CHANNELS) { keys.add(`SR2E.VRig98.Miji.ch.${c}`); keys.add(`SR2E.VRig98.Miji.lostEffect.${c}`); }
    for (const k of keys) assert.ok(en[k], k);
    assert.ok(en['SR2E.Tools.rigging98.label'] && en['SR2E.Tools.rigging98.hint']);
  });
});

describe('the control rig and other cyberware (Rigger 2 pp. 16–17)', () => {
  test("Monkeywrench's example: move-by-wire 1, 3 and 4 against a level 3 rig (Reaction 4, Control Pool 10)", () => {
    const base = { vcr: 3, encInt: 0, quickness: 4, intelligence: 4 };
    const pool = 10;
    const one = X.rigWareAdjust({ ...base, mbw: 1 });
    assert.deepEqual({ r: 6 + one.reaction, d: 3 + one.dice, p: pool + one.pool }, { r: 4, d: 2, p: 9 });
    const three = X.rigWareAdjust({ ...base, mbw: 3 });
    assert.deepEqual({ r: 6 + three.reaction, d: 3 + three.dice, p: pool + three.pool }, { r: 0, d: 0, p: 7 });
    const four = X.rigWareAdjust({ ...base, mbw: 4 });
    assert.deepEqual({ r: 6 + four.reaction, d: 3 + four.dice, p: pool + four.pool }, { r: 0, d: 0, p: 6 });
  });
  test("an encephalon's Intelligence raises the rigged Reaction and the Control Pool; nothing without a rig", () => {
    assert.deepEqual(X.rigWareAdjust({ vcr: 1, mbw: 0, encInt: 1, quickness: 5, intelligence: 4 }).reaction, 1);    // (5+4)/2 = 4 → (5+5)/2 = 5
    assert.deepEqual(X.rigWareAdjust({ vcr: 1, mbw: 0, encInt: 1, quickness: 4, intelligence: 4 }).pool, 0);        // 4 → 4 (9/2 rounds down)
    assert.equal(X.rigWareAdjust({ vcr: 1, mbw: 0, encInt: 2, quickness: 4, intelligence: 4 }).pool, 1);
    assert.deepEqual(X.rigWareAdjust({ vcr: 0, mbw: 2, encInt: 2, quickness: 4, intelligence: 4 }), { reaction: 0, dice: 0, pool: 0, lost: 0, encReaction: 0 });
  });
  test('move-by-wire is told by its name; its level from the rating, its dice or its Reaction', () => {
    assert.equal(X.moveByWireLevel([{ name: 'Move-by-Wire System', rating: 2 }]), 2);
    assert.equal(X.moveByWireLevel([{ name: 'move by wire', initiativeDice: 3 }]), 3);
    assert.equal(X.moveByWireLevel([{ name: 'MoveByWire', reaction: 2 }]), 1);
    assert.equal(X.moveByWireLevel([{ name: 'Move-by-wire', rating: 2, installed: false }, { name: 'Wired reflexes', rating: 3 }]), 0);
  });
  test("'v971': no change", (t) => {
    t.after(oldWay({ 'VRIG_V98.rigWare': 'v971' }));
    assert.deepEqual(X.rigWareAdjust({ vcr: 3, mbw: 2, encInt: 2, quickness: 4, intelligence: 4 }), { reaction: 0, dice: 0, pool: 0, lost: 0, encReaction: 0 });
  });
});

describe('ECM, ECCM, ED and ECD (Rigger 2 pp. 30–32)', () => {
  test('Flux of sensors and ECM: rating × 1.5, rounded up', () => {
    assert.deepEqual([0, 1, 2, 3, 4, 7].map(X.deviceFlux), [0, 2, 3, 5, 6, 11]);
  });
  test("the ECM Test's two sides and the ECCM Test's (M.C. Jammer's t-bird, ECM 3, against an Aguilar's Sensor 7, ECCM 4)", () => {
    const p = X.ecmPlan({ ecm: 3, sensor: 7, eccm: 4 })!;
    assert.deepEqual(p.jammer, { dice: 5, tn: 7 });
    assert.deepEqual(p.scanner, { dice: 11, tn: 3 });
    assert.deepEqual(p.eccm, { counter: { dice: 4, tn: 3 }, jammer: { dice: 3, tn: 4 } });
    assert.equal(X.ecmPlan({ ecm: 0, sensor: 7 }), null);
  });
  test('the Signature rises by the winning jammer\'s successes, less the ECCM\'s net (the example: 4, then 3)', () => {
    assert.equal(X.ecmSignature({ jammer: 4, scanner: 2 }), 4);
    assert.equal(X.ecmSignature({ jammer: 4, scanner: 2, counter: 3, counterJammer: 2 }), 3);
    assert.equal(X.ecmSignature({ jammer: 2, scanner: 2 }), 0);
    assert.equal(X.ecmSignature({ jammer: 3, scanner: 1, counter: 6, counterJammer: 0 }), 0);
  });
  test('ED (optional, off by default): ED vs Sensor, +1 Signature a success, ECD negates and drains the Flux', (t) => {
    assert.equal(X.edPlan({ ed: 5, sensor: 4 }), null);
    t.after(oldWay({ 'VRIG_V98.ed': 'book' }));
    assert.deepEqual(X.edPlan({ ed: 5, sensor: 4, ecd: 2 }), { ed: { dice: 5, tn: 4 }, ecd: { dice: 2, tn: 5 } });
    assert.equal(X.edSignature(4, 1), 3);
    assert.equal(X.ecmPlan({ ecm: 3, sensor: 4, ecd: 2 })!.scanner.dice, 4);    // Flux 6 less ECD 2
  });
  test("'v971': no ECM Test", (t) => {
    t.after(oldWay({ 'VRIG_V98.ecmTest': 'v971' }));
    assert.equal(X.ecmPlan({ ecm: 3, sensor: 7 }), null);
  });
});

describe('Sensor Test results (Rigger 2 p. 28)', () => {
  test('0 to 4+ successes', () => {
    assert.deepEqual([0, 1, 2, 3, 4, 9].map(X.sensorResult), ['r0', 'r1', 'r2', 'r3', 'r4', 'r4']);
  });
});

describe('Flux and range (Rigger 2 p. 30)', () => {
  test("Josie's Dalmatian: Flux 6, high elevation, encryption, ECCM 3 → 8, 20 km", () => {
    const f = X.modifiedFlux({ flux: 6, conditions: ['elevation'], encryption: true, eccm: 3 });
    assert.equal(f.flux, 8);
    assert.equal(X.fluxRangeKm(f.flux), 20);
  });
  test('rounded down to the half; a half step reaches halfway; past the table 2 × Flux + 10', () => {
    assert.equal(X.modifiedFlux({ flux: 4, conditions: ['humid'] }).flux, 3.5);
    assert.equal(X.fluxRangeKm(3.5), 5);
    assert.equal(X.fluxRangeKm(0), 0.25);
    assert.equal(X.fluxRangeKm(12), 34);
    assert.equal(X.modifiedFlux({ flux: 1, conditions: ['storm', 'urban'] }).flux, 0);
  });
  test('humid air never counts with an electrical storm; unknown ids are dropped', () => {
    assert.deepEqual(X.fluxConditions(['storm', 'humid', 'nonsense', 'urban', 'urban']), ['storm', 'urban']);
    assert.deepEqual(X.fluxConditions('elevation'), []);
  });
  test("'v971': the plain Flux", (t) => {
    t.after(oldWay({ 'VRIG_V98.flux': 'v971' }));
    assert.deepEqual(X.modifiedFlux({ flux: 6, conditions: ['elevation'], encryption: true, eccm: 3 }), { flux: 6, mods: [] });
  });
});

describe('missiles (Rigger 2 p. 59)', () => {
  test('continuous lock: + half the Sensor (round down); fire-and-forget nothing', () => {
    assert.equal(X.continuousDice('continuous', 5), 2);
    assert.equal(X.continuousDice('forget', 5), 0);
    assert.equal(X.continuousDice(undefined, 5), 0);
  });
  test('a launch counts for its own Combat Turn of its own combat only', () => {
    const rec = { round: 3, combatId: 'c1' };
    assert.equal(X.continuousLockNow(rec, { round: 3, combatId: 'c1' }), true);
    assert.equal(X.continuousLockNow(rec, { round: 4, combatId: 'c1' }), false);
    assert.equal(X.continuousLockNow(rec, { round: 3, combatId: 'c2' }), false);
    assert.equal(X.continuousLockNow(rec, { round: null, combatId: null }), false);
  });
  test("'v971': neither", (t) => {
    t.after(oldWay({ 'VRIG_V98.missiles': 'v971' }));
    assert.equal(X.continuousDice('continuous', 6), 0);
    assert.equal(X.continuousLockNow({ round: 1, combatId: 'c' }, { round: 1, combatId: 'c' }), false);
  });
});

describe('weapon mounts share the Body (Rigger 2 pp. 22, 131)', () => {
  const w = (name: string, mount = 'fixed', extra: any = {}) => ({ name, mount, ...extra });
  test('Body 3: a hardpoint weapon and a firmpoint one fit; two hardpoint weapons do not', () => {
    const cap = mountCapacity({ body: 3, firmpoints: 0, hardpoints: 0 });
    assert.equal(cap.tracked, true);
    const ok = mountUsage(cap, [w('HMG'), w('LMG')]);
    assert.deepEqual({ over: ok.over, tracked: ok.tracked }, { over: false, tracked: true });
    assert.match(ok.label, /3\/3/);
    const no = mountUsage(cap, [w('HMG'), w('Assault cannon', 'turret')]);
    assert.equal(no.over, true);
    assert.match(no.label, /4\/3/);
    assert.equal(mountUsage(cap, []).tracked, false);    // nothing mounted: nothing shown
    assert.equal(mountCheck({ body: 3, firmpoints: 0, hardpoints: 0, weapons: [w('HMG')], adding: w('Minigun') }).ok, false);
  });
  test("the sheet's points are the mounts: over when 2 × hardpoints + firmpoints is more than the Body", () => {
    const cap = mountCapacity({ body: 3, firmpoints: 2, hardpoints: 1 });
    const u = mountUsage(cap, [w('LMG')]);
    assert.equal(u.over, true);
    assert.match(u.label, /4/);
    assert.equal(mountUsage(mountCapacity({ body: 4, firmpoints: 2, hardpoints: 1 }), [w('LMG')]).over, false);
  });
  test("'v971': separate counts, untracked when both are 0", (t) => {
    t.after(oldWay({ 'VRIG_V98.mountBudget': 'v971' }));
    assert.deepEqual(mountCapacity({ body: 3, firmpoints: 0, hardpoints: 0 }), { tracked: false, firm: 0, hard: 0 });
    assert.equal(X.mountBudget({ body: 3, firmpoints: 0, hardpoints: 0, firmNeeded: 0, hardNeeded: 3 }), null);
  });
});

describe('drones: Comprehension Tests, the phase, the captain\'s chair (Rigger 2 pp. 65–66)', () => {
  test('Pilot dice, + programming up to the Pilot, +2 while the rigger runs a primary drone, + degradation', () => {
    assert.deepEqual(X.comprehensionPlan({ pilot: 3, tn: 5, primaryJumped: true, programming: 5, degradation: 2 }), { dice: 6, extra: 3, tn: 5, modifiers: [{ id: 'primary', value: 2 }, { id: 'degradation', value: 2 }] });
    assert.equal(X.comprehensionPlan({ pilot: 2, primaryJumped: false })!.tn, RULES.VRIG_V98.comprehensionTn);
  });
  test('network drones: subscribed, not driven by hand or from aboard, not destroyed; the rigger first at a tie', () => {
    const base = { subscribed: ['D'], droneUuid: 'D', riggerUuid: 'R' };
    assert.equal(X.inNetwork(base), true);
    assert.equal(X.inNetwork({ ...base, controllerUuid: 'R', controlMode: 'jumped' }), true);
    assert.equal(X.inNetwork({ ...base, controllerUuid: 'R', controlMode: 'jumped', riggerAboard: true }), false);
    assert.equal(X.inNetwork({ ...base, controllerUuid: 'R', controlMode: 'manual' }), false);
    assert.equal(X.inNetwork({ ...base, controllerUuid: 'Other' }), false);
    assert.equal(X.inNetwork({ ...base, droneDestroyed: true }), false);
    assert.equal(X.inNetwork({ ...base, subscribed: [] }), false);
    assert.deepEqual([X.networkSort(true, false), X.networkSort(false, true), X.networkSort(false, false)], [-1, 1, 0]);
  });
  test("the captain's chair keeps the rig's Initiative (a deck, a rig, not jumped in, the flag)", () => {
    const actor = (rig: any, flag: unknown = true) => ({ type: 'character', flags: { [SYSTEM_ID]: { vrig98Chair: flag } }, system: { derived: { rigging: rig } } });
    assert.deepEqual(X.captainInitiative(actor({ rcd: 4, vcr: 2, reaction: 9, initiativeDice: 3, jumpedIn: false })), { base: 9, dice: 3 });
    assert.equal(X.captainInitiative(actor({ rcd: 4, vcr: 2, reaction: 9, initiativeDice: 3, jumpedIn: true })), null);
    assert.equal(X.captainInitiative(actor({ rcd: 0, vcr: 2, reaction: 9, initiativeDice: 3 })), null);
    assert.equal(X.captainInitiative(actor({ rcd: 4, vcr: 0, reaction: 9, initiativeDice: 3 })), null);
    assert.equal(X.captainInitiative(actor({ rcd: 4, vcr: 2, reaction: 9, initiativeDice: 3 }, 'yes')), null);
  });
  test("'v971': no Comprehension Test, no phase rule, no chair", (t) => {
    t.after(oldWay({ 'VRIG_V98.comprehension': 'v971', 'VRIG_V98.dronePhase': 'v971', 'VRIG_V98.captainsChair': 'v971' }));
    assert.equal(X.comprehensionPlan({ pilot: 3, primaryJumped: true }), null);
    assert.equal(X.inNetwork({ subscribed: ['D'], droneUuid: 'D', riggerUuid: 'R' }), false);
    assert.equal(X.captainInitiative({ type: 'character', flags: { [SYSTEM_ID]: { vrig98Chair: true } }, system: { derived: { rigging: { rcd: 4, vcr: 2, reaction: 9, initiativeDice: 3 } } } }), null);
  });
});

describe('MIJI and the Signal Monitor (Rigger 2 pp. 68–72)', () => {
  const vals = { intruderRcd: 6, intruderFlux: 8, pem: 6, intruderEcm: 0, targetRcd: 3, targetFlux: 5 };
  test("Trixie's meaconing: 8 dice vs TN 3, the corp's 5 vs TN 6; 5 against 1 is 4 boxes, Moderate (+2)", () => {
    const p = X.mijiPlan({ op: 'meaconing', channel: 'system', ...vals });
    assert.equal(p.why, undefined);
    assert.deepEqual({ i: p.intruder, d: p.defender }, { i: { dice: 8, tn: 3 }, d: { dice: 5, tn: 6 } });
    const res = X.mijiOutcome('meaconing', 5, 1);
    assert.deepEqual(res, { target: 4, self: 0 });
    const m = X.degrade(null, 'system', res.target, 'meaconing', { rating: 6, uuid: 'T' });
    assert.equal(X.degradationTn(m.system.boxes), 2);
    assert.equal(X.degradationFor(m, 'pilot'), 2);
    assert.equal(X.degradationFor(m, 'comprehension'), 0);    // meaconing doesn't touch Comprehension Tests (p. 70)
  });
  test('the monitor: 1 box +1, 3 +2, 6 +3, 10 lost; jamming the command channel hits Comprehension Tests', () => {
    assert.deepEqual([0, 1, 2, 3, 5, 6, 9, 10].map(X.degradationTn), [0, 1, 1, 2, 2, 3, 3, 3]);
    let m = X.degrade(null, 'command', 12, 'jamming', { rating: 4, uuid: 'J' });
    assert.equal(m.command.boxes, 10);
    assert.equal(X.channelLost(m, 'command'), true);
    assert.equal(X.degradationFor(m, 'comprehension'), 3);
    m = X.degrade(m, 'simsense', 2, 'jamming', { rating: 4, uuid: 'J' });
    assert.equal(X.degradationFor(m, 'remote'), 1);
  });
  test('jamming is resisted against the intruder\'s ECM; refusals name what is missing', () => {
    assert.deepEqual(X.mijiPlan({ op: 'jamming', channel: 'command', ...vals, intruderEcm: 4 }).defender, { dice: 5, tn: 4 });
    assert.equal(X.mijiPlan({ op: 'jamming', channel: 'command', ...vals }).why, 'SR2E.VRig98.Why.noEcm');
    assert.equal(X.mijiPlan({ op: 'meaconing', channel: 'system', ...vals, pem: 0 }).why, 'SR2E.VRig98.Why.noPem');
    assert.equal(X.mijiPlan({ op: 'interference', channel: 'command', ...vals }).why, 'SR2E.VRig98.Why.channel');
    assert.equal(X.mijiPlan({ op: 'meaconing', channel: 'simsense', ...vals }).why, 'SR2E.VRig98.Why.channel');
    assert.equal(X.mijiPlan({ op: 'intrusion', channel: 'simsense', ...vals, intruderRcd: 0 }).why, 'SR2E.VRig98.Why.noRcd');
    assert.equal(X.mijiPlan({ op: 'intrusion', channel: 'simsense', ...vals, targetRcd: 0 }).why, 'SR2E.VRig98.Why.noNetwork');
  });
  test("interference lost: the defender's net on the intruder's own system channel (M.C. Jammer's duel)", () => {
    assert.deepEqual(X.mijiOutcome('interference', 1, 0), { target: 1, self: 0 });
    assert.deepEqual(X.mijiOutcome('interference', 0, 2), { target: 0, self: 2 });
    assert.deepEqual(X.mijiOutcome('jamming', 0, 2), { target: 0, self: 0 });
  });
  test('ECCM: vs the intruder\'s rating + 3, a box per 2 successes; a cleared channel forgets what hit it', () => {
    assert.deepEqual(X.regenPlan({ eccm: 4, intruderRating: 6 }), { dice: 4, tn: 9 });
    assert.equal(X.regenPlan({ eccm: 0, intruderRating: 6 }).why, 'SR2E.VRig98.Why.noEccm');
    const m = X.degrade(null, 'command', 3, 'jamming', { rating: 4, uuid: 'J' });
    assert.equal(X.regenerate(m, 'command', 5).command.boxes, 1);
    assert.deepEqual(X.regenerate(m, 'command', 7).command, { boxes: 0, ops: [] });
  });
  test('the stored monitor is bounded (malformed reads as clear)', () => {
    const m = X.signalMonitor({ command: { boxes: 99, ops: ['jamming', 'nope', 'jamming'] }, simsense: 'x', by: { rating: 500, uuid: 7 } });
    assert.deepEqual(m.command, { boxes: 10, ops: ['jamming'] });
    assert.deepEqual(m.simsense, { boxes: 0, ops: [] });
    assert.deepEqual(m.by, { rating: 30, uuid: '' });
  });
  test("'v971': no MIJI, no degradation", (t) => {
    const m = X.degrade(null, 'command', 6, 'jamming', { rating: 4, uuid: 'J' });
    t.after(oldWay({ 'VRIG_V98.miji': 'v971' }));
    assert.equal(X.mijiPlan({ op: 'jamming', channel: 'command', ...vals, intruderEcm: 4 }).why, 'SR2E.VRig98.Why.mijiOff');
    assert.equal(X.degradationFor(m, 'comprehension'), 0);
  });
});

describe("every switch at 'v971' together", () => {
  test('the v0.97.1 results', (t) => {
    t.after(oldWay(V971));
    assert.equal(X.ecmPlan({ ecm: 3, sensor: 4 }), null);
    assert.equal(X.edPlan({ ed: 3, sensor: 4 }), null);
    assert.equal(X.comprehensionPlan({ pilot: 3, primaryJumped: false }), null);
    assert.deepEqual(mountCapacity({ body: 4, firmpoints: 0, hardpoints: 0 }), { tracked: false, firm: 0, hard: 0 });
  });
});
