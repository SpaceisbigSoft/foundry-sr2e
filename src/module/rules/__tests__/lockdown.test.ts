import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { RULES } from '../config.ts';
import { icFromStep, icCategoryOf, stepsToLaunch, gasDeviceToxin, gasDeviceRadius, gasDevicesToRelease } from '../lockdown.ts';
import { advanceTally, IC_BEHAVIORS, type SheafStep } from '../matrix.ts';

const HOST = { securityValue: 7, name: 'Lab host' };
const S = RULES.SECURITY_V61 as any;
/** Run `fn` with house-rule changes to RULES.SECURITY_V61, then put the values back. */
function withRules(patch: (s: any) => void, fn: () => void): void {
  const saved = structuredClone(RULES.SECURITY_V61);
  try { patch(S); fn(); } finally { for (const k of Object.keys(S)) delete S[k]; Object.assign(S, saved); }
}

describe('v0.61.0 config: SECURITY_V61', () => {
  test('has the documented keys and sane values', () => {
    assert.equal(S.sheafIc.autoLaunch, true);
    assert.equal(S.sheafIc.parseEventText, true);
    assert.ok(S.sheafIc.maxCopies >= 1);
    assert.equal(S.gas.onLockdown, true);
    assert.ok(RULES.TOXINS.vectors.includes(S.gas.defaultToxin.vector));
    assert.ok(RULES.TOXINS.speeds.some((s) => s.id === S.gas.defaultToxin.speed));
    for (const b of [...S.sheafIc.categories.black, ...S.sheafIc.categories.gray]) assert.ok((IC_BEHAVIORS as readonly string[]).includes(b), b);
  });
  test('npc tables: totems, counts by Threat Level, vehicles in known categories', () => {
    assert.ok(S.npc.totems.length >= 10);
    const by = (n: string) => S.npc.totems.find((t: any) => t.name === n);
    assert.equal(by('Bear').berserk, 'wounded');
    assert.equal(by('Shark').berserk, 'wounded');
    assert.equal(by('Wolf').berserk, 'combat');
    assert.equal(by('Owl').daylightTn, 2);
    assert.equal(S.npc.riggerVehicles.length, 6);
    assert.equal(S.npc.riggerDrones.length, 6);
    const cats = RULES.VEHICLES.categories.map((c) => c.id);
    for (const v of S.npc.vehicles) assert.ok(cats.includes(v.category), `${v.name}: ${v.category}`);
    assert.ok(S.npc.vehicles.some((v: any) => v.drone) && S.npc.vehicles.some((v: any) => !v.drone));
  });
});

describe('v0.61.0 icFromStep: structured IC', () => {
  test('a structured IC wins over the event text', () => {
    const ic = icFromStep({ event: 'Tar Baby', ic: { icType: 'Killer', category: 'gray', rating: 5, behavior: 'killer', damageLevel: 'S', copies: 2 } }, HOST)!;
    assert.deepEqual(ic, { icType: 'Killer', category: 'gray', rating: 5, behavior: 'killer', damageLevel: 'S', damageType: 'physical', copies: 2, traceMode: '', name: 'Killer-5 (Lab host)' });
  });
  test('rating 0 is the host Security Value; category and behavior fill in from the type', () => {
    const ic = icFromStep({ ic: { icType: 'Tar Pit', category: '', rating: 0, behavior: '', damageLevel: '', copies: 0 } }, HOST)!;
    assert.equal(ic.rating, 7);
    assert.equal(ic.behavior, 'tarPit');
    assert.equal(ic.category, 'gray');
    assert.equal(ic.damageLevel, RULES.SECURITY_V61.sheafIc.defaultDamageLevel);
    assert.equal(ic.copies, 1);
    assert.equal(ic.name, 'Tar Pit-7 (Lab host)');
  });
  test('structured black IC hits the black damage type; copies clamp to maxCopies', () => {
    const ic = icFromStep({ ic: { icType: 'Black IC', category: '', rating: 9, behavior: '', damageLevel: 'D', copies: 99 } }, HOST)!;
    assert.equal(ic.category, 'black');
    assert.equal(ic.behavior, 'killer');
    assert.equal(ic.damageType, RULES.SECURITY_V61.sheafIc.blackDamageType);
    assert.equal(ic.copies, RULES.SECURITY_V61.sheafIc.maxCopies);
  });
  test('an unknown behavior falls back; a trace keeps its mode', () => {
    assert.equal(icFromStep({ ic: { icType: 'Probe', behavior: 'nonsense' } }, HOST)!.behavior, 'probe');
    assert.equal(icFromStep({ ic: { icType: 'Strange thing', behavior: 'nonsense' } }, HOST)!.behavior, 'killer');
    assert.equal(icFromStep({ ic: { icType: 'Trace and Burn', behavior: 'trace' } }, HOST)!.traceMode, 'burn');
  });
  test('an empty structured icType falls back to the event text', () => {
    assert.equal(icFromStep({ event: 'Passive alert', ic: { icType: '', rating: 5 } }, HOST), null);
    assert.equal(icFromStep({ event: 'Scout-4', ic: { icType: '  ' } }, HOST)!.behavior, 'scout');
  });
});

describe('v0.61.0 icFromStep: event text', () => {
  const cases: Array<[string, Partial<ReturnType<typeof icFromStep> & object>]> = [
    ['Killer-6 IC', { icType: 'Killer', behavior: 'killer', rating: 6, category: 'gray' }],
    ['Killer 6', { icType: 'Killer', rating: 6 }],
    ['Tar Baby', { icType: 'Tar Baby', behavior: 'tarBaby', rating: 7, category: 'gray' }],
    ['Black IC 8', { icType: 'Black IC', behavior: 'killer', rating: 8, category: 'black', damageType: 'physical' }],
    ['Non-lethal Black IC-6', { category: 'black', damageType: 'stun', rating: 6 }],
    ['Trace and Dump-5', { icType: 'Trace and Dump', behavior: 'trace', rating: 5, traceMode: 'dump', category: 'gray' }],
    ['Launch Probe-4', { icType: 'Probe', behavior: 'probe', rating: 4, category: 'white' }],
    ['Barrier IC', { behavior: 'barrier', category: 'white', rating: 7 }],
    ['Access IC-3', { behavior: 'barrier', rating: 3 }],
    ['Cyberphobia-5', { behavior: 'psychotropic', category: 'black', rating: 5 }],
    ['Positive Conditioning 4', { icType: 'Positive Conditioning', behavior: 'psychotropic', rating: 4 }],
    ['2x Killer-4 IC', { copies: 2, rating: 4 }],
    ['Blaster-5 x3', { behavior: 'blaster', copies: 3 }],
    ['Killer-4 ×9', { copies: 4 }],
  ];
  for (const [text, want] of cases) {
    test(`"${text}"`, () => {
      const ic = icFromStep({ event: text }, HOST);
      assert.ok(ic, text);
      for (const [k, v] of Object.entries(want)) assert.equal((ic as any)[k], v, `${text}: ${k}`);
      assert.equal(ic!.name, `${ic!.icType}-${ic!.rating} (Lab host)`);
    });
  }
  test('events that name no IC give null', () => {
    for (const e of ['Passive alert', 'Active alert', 'Shutdown', 'Access denied', 'Other deckers notified', '', '   ', 'IC', '6']) {
      assert.equal(icFromStep({ event: e }, HOST), null, e);
    }
  });
  test('bad input never throws', () => {
    for (const step of [null, undefined, 5, 'x', {}, { event: 42 }, { event: null, ic: 'Killer' }, { ic: [1, 2] }, { ic: { icType: 7 } }] as any[]) {
      assert.doesNotThrow(() => icFromStep(step, HOST));
    }
    for (const host of [null, undefined, {}, { securityValue: 'x', name: null }, { securityValue: -3, name: 5 }] as any[]) {
      const ic = icFromStep({ event: 'Killer IC' }, host)!;
      assert.equal(ic.rating, 1);
      assert.ok(!/NaN|undefined/.test(ic.name));
    }
    assert.equal(icFromStep({ event: 'Killer IC' }, { securityValue: 0, name: '' })!.name, 'Killer-1');
  });
  test('house rule: parseEventText off reads only structured IC; categories can change', () => {
    withRules((s) => { s.sheafIc.parseEventText = false; }, () => {
      assert.equal(icFromStep({ event: 'Killer-6 IC' }, HOST), null);
      assert.ok(icFromStep({ ic: { icType: 'Killer' } }, HOST));
    });
    withRules((s) => { s.sheafIc.categories = { black: ['killer'], gray: [] }; s.sheafIc.blackDamageType = 'stun'; s.sheafIc.maxCopies = 2; s.sheafIc.defaultDamageLevel = 'D'; }, () => {
      assert.equal(icCategoryOf('killer'), 'black');
      assert.equal(icCategoryOf('tarBaby'), 'white');
      const ic = icFromStep({ event: '3x Killer-6' }, HOST)!;
      assert.equal(ic.category, 'black');
      assert.equal(ic.damageType, 'stun');
      assert.equal(ic.copies, 2);
      assert.equal(ic.damageLevel, 'D');
    });
    assert.equal(icCategoryOf('killer'), 'gray');
    assert.equal(RULES.SECURITY_V61.sheafIc.parseEventText, true);
  });
});

describe('v0.61.0 stepsToLaunch', () => {
  const sheaf: SheafStep[] = [
    { step: 4, event: 'Passive alert', alert: 'passive' },
    { step: 8, event: 'Killer-6 IC', alert: '' },
    { step: 12, event: 'Tar Baby', alert: 'active' },
  ];
  test('steps not launched yet, in tally order, once each', () => {
    const { triggered } = advanceTally(0, 13, sheaf);
    assert.deepEqual(stepsToLaunch(triggered, []), [4, 8, 12]);
    assert.deepEqual(stepsToLaunch(triggered, [8]), [4, 12]);
    assert.deepEqual(stepsToLaunch([sheaf[2]!, sheaf[1]!, sheaf[1]!], []), [8, 12]);
    assert.deepEqual(stepsToLaunch(triggered, [4, 8, 12]), []);
  });
  test('bad input gives an empty or partial list, never throws', () => {
    assert.deepEqual(stepsToLaunch(null as any, null as any), []);
    assert.deepEqual(stepsToLaunch([null, { step: 'x' }, { step: 3 }] as any, 'nope' as any), [3]);
  });
  test('house rule: autoLaunch off launches nothing', () => {
    withRules((s) => { s.sheafIc.autoLaunch = false; }, () => assert.deepEqual(stepsToLaunch(sheaf, []), []));
    assert.deepEqual(stepsToLaunch(sheaf, []), [4, 8, 12]);
  });
});

describe('v0.61.0 gas devices', () => {
  const def = RULES.SECURITY_V61.gas.defaultToxin;
  test('a device with no toxin uses the default', () => {
    assert.deepEqual(gasDeviceToxin({ name: 'Vent' }), { name: def.name, power: def.power, level: def.level, damageType: def.damageType, vector: def.vector, speed: def.speed });
  });
  test('the device rating stands in for a missing Power; the toxin\'s own Power wins', () => {
    assert.equal(gasDeviceToxin({ rating: 9 }).power, 9);
    assert.equal(gasDeviceToxin({ rating: 9, toxin: { power: 4 } }).power, 4);
  });
  test('a full toxin is kept; bad fields fall back one by one', () => {
    const good = { name: 'Nerve gas', power: 10, level: 'D', damageType: 'physical', vector: 'contact', speed: 'immediate' };
    assert.deepEqual(gasDeviceToxin({ toxin: good }), good);
    const bad = gasDeviceToxin({ toxin: { name: '  ', power: -2, level: 'X', damageType: 'fire', vector: 'osmosis', speed: 'soon' } });
    assert.deepEqual(bad, { name: def.name, power: def.power, level: def.level, damageType: def.damageType, vector: def.vector, speed: def.speed });
    assert.equal(gasDeviceToxin({ toxin: { level: 'm' } }).level, 'M');
  });
  test('bad input never throws', () => {
    for (const d of [null, undefined, 3, 'x', [], { toxin: 'gas' }, { toxin: [1] }, { rating: 'NaN' }] as any[]) {
      const t = gasDeviceToxin(d);
      assert.ok(t.power >= 1 && t.name);
    }
  });
  test('house rule: the default toxin can change', () => {
    withRules((s) => { s.gas.defaultToxin = { name: 'Tear gas', power: 4, level: 'M', damageType: 'stun', vector: 'contact', speed: 'immediate' }; }, () => {
      assert.deepEqual(gasDeviceToxin({}), { name: 'Tear gas', power: 4, level: 'M', damageType: 'stun', vector: 'contact', speed: 'immediate' });
    });
    withRules((s) => { s.gas.defaultToxin = { name: '', power: 0, level: 'Q', damageType: 'x', vector: 'x', speed: 'x' }; }, () => {
      const t = gasDeviceToxin({});
      assert.equal(t.power, 1);
      assert.equal(t.level, 'S');
      assert.ok(RULES.TOXINS.vectors.includes(t.vector));
      assert.ok(RULES.TOXINS.speeds.some((s) => s.id === t.speed));
    });
  });
  test('radius: own value, 0 = linked regions only, missing = the default', () => {
    assert.equal(gasDeviceRadius({ radius: 3 }), 3);
    assert.equal(gasDeviceRadius({ radius: 0 }), 0);
    assert.equal(gasDeviceRadius({}), RULES.SECURITY_V61.gas.radiusMetres);
    assert.equal(gasDeviceRadius({ radius: -4 }), 0);
    assert.equal(gasDeviceRadius(null as any), RULES.SECURITY_V61.gas.radiusMetres);
  });
  test('active, unbypassed gas devices go off on lockdown', () => {
    const devices = [
      { id: 'a', kind: 'gas', active: true, bypassed: false },
      { id: 'b', kind: 'gas', active: false, bypassed: false },
      { id: 'c', kind: 'gas', active: true, bypassed: true },
      { id: 'd', kind: 'camera', active: true, bypassed: false },
      { id: 'e', kind: 'gas', active: true, bypassed: false },
      { id: 'a', kind: 'gas', active: true, bypassed: false },
      { id: '', kind: 'gas', active: true, bypassed: false },
    ];
    assert.deepEqual(gasDevicesToRelease(devices), ['a', 'e']);
    assert.deepEqual(gasDevicesToRelease(null as any), []);
    assert.deepEqual(gasDevicesToRelease([null, 4, { kind: 'gas' }] as any), []);
    withRules((s) => { s.gas.onLockdown = false; }, () => assert.deepEqual(gasDevicesToRelease(devices), []));
  });
});
