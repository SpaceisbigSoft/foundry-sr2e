import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { RULES } from '../config.ts';
import {
  effectivePersona, programRunRating, programsOverMpcp, mpcpProgramWarnings, canLoadProgram, memoryUse, advanceTally, raiseAlert,
  IC_BEHAVIORS, type Deck, type Program,
} from '../matrix.ts';
import { generateSheaf, sheafFor, SHEAF_GEN, seedFromString } from '../sheafgen.ts';
import { icFromStep } from '../lockdown.ts';
import { generateOrg, hostActorData, makeRng } from '../npcgen.ts';
import { safehouseHostData } from '../safehouse.ts';

const F = RULES.FIXES_V71 as any;
const withFix = (key: string, value: unknown, fn: () => void) => { const old = F[key]; F[key] = value; try { fn(); } finally { F[key] = old; } };

const deck: Deck = { mpcp: 6, bod: 6, evasion: 5, masking: 4, sensors: 6, hardening: 2, responseIncrease: 1, activeMemory: 100 };

describe('v0.71.0 R7: the MPCP caps persona values and programs', () => {
  test('cap: MPCP damage lowers persona values above the new MPCP', () => {
    withFix('mpcpCaps', 'cap', () => {
      const e = effectivePersona(deck, { mpcp: 3 });
      assert.deepEqual([e.mpcp, e.bod, e.evasion, e.masking, e.sensors], [3, 3, 3, 3, 3]);
      assert.deepEqual(e.capped, ['bod', 'evasion', 'masking', 'sensors']);
      // Damage to a persona value still counts below the cap.
      const f = effectivePersona(deck, { mpcp: 1, masking: 3 });
      assert.deepEqual([f.mpcp, f.bod, f.masking], [5, 5, 1]);
      assert.deepEqual(effectivePersona(deck).capped, []);
    });
  });
  test('warn: persona values are only lowered by their own damage (the old way)', () => {
    withFix('mpcpCaps', 'warn', () => {
      const e = effectivePersona(deck, { mpcp: 3 });
      assert.deepEqual([e.mpcp, e.bod, e.evasion], [3, 6, 5]);
      assert.deepEqual(e.capped, []);
    });
    // An explicit option wins over the switch.
    assert.equal(effectivePersona(deck, { mpcp: 3 }, {}, { cap: false }).bod, 6);
  });
  test('programRunRating: capped at the working MPCP, unchanged with warn', () => {
    withFix('mpcpCaps', 'cap', () => {
      assert.deepEqual(programRunRating(10, 4), { rating: 4, capped: true });
      assert.deepEqual(programRunRating(4, 4), { rating: 4, capped: false });
      assert.deepEqual(programRunRating(3, 0), { rating: 0, capped: true });
    });
    withFix('mpcpCaps', 'warn', () => assert.deepEqual(programRunRating(10, 4), { rating: 10, capped: false }));
  });
  test('programsOverMpcp lists loaded, unerased programs above the MPCP, with warnings', () => {
    const progs = [
      { id: 'a', name: 'Attack', kind: 'attack', rating: 8, loaded: true },
      { id: 'b', name: 'Sleaze', kind: 'sleaze', rating: 4, loaded: true },
      { id: 'c', name: 'Browse', kind: 'browse', rating: 9, loaded: false },
      { id: 'd', name: 'Medic', kind: 'medic', rating: 7, loaded: true, erased: true },
    ];
    withFix('mpcpCaps', 'cap', () => {
      const over = programsOverMpcp(progs, 5);
      assert.deepEqual(over, [{ id: 'a', name: 'Attack', kind: 'attack', rating: 8, runs: 5 }]);
      assert.match(mpcpProgramWarnings(over, 5)[0]!, /Attack 8 runs at 5/);
    });
    withFix('mpcpCaps', 'warn', () => {
      const over = programsOverMpcp(progs, 5);
      assert.equal(over[0]!.runs, 8);
      assert.match(mpcpProgramWarnings(over, 5)[0]!, /above MPCP 5/);
    });
  });
});

describe('v0.71.0 R8: active memory is a limit', () => {
  const p = (size: number, loaded: boolean, id: string): Program & { id: string; name: string } => ({ id, name: `P${id}`, kind: 'other', rating: 1, size, loaded });
  const programs = [p(40, true, 'a'), p(30, true, 'b'), p(50, false, 'c')];
  const state = { activeMemory: 100, programs };
  test('block: refuses a program that does not fit', () => {
    withFix('activeMemory', 'block', () => {
      const r = canLoadProgram(state, programs[2]!);
      assert.equal(r.ok, false);
      assert.equal(r.free, 30);
      assert.equal(r.need, 50);
      assert.match(r.reason!, /needs 50 Mp/);
      assert.deepEqual(canLoadProgram(state, p(30, false, 'x')), { ok: true, free: 30, need: 30 });
    });
  });
  test('block: unloading a program in the same swap frees its memory', () => {
    withFix('activeMemory', 'block', () => {
      assert.equal(canLoadProgram(state, programs[2]!, { unloading: [programs[1]!] }).ok, true);
      assert.equal(canLoadProgram(state, programs[2]!, { unloading: [{ ...programs[0]!, size: 0 }] }).ok, true); // matched by id
    });
  });
  test('warn: always ok, with a note when over', () => {
    withFix('activeMemory', 'warn', () => {
      const r = canLoadProgram(state, programs[2]!);
      assert.equal(r.ok, true);
      assert.match(r.reason!, /over active memory/);
      assert.equal(canLoadProgram(state, p(10, false, 'y')).reason, undefined);
    });
  });
  test('an already loaded program and a memory-free complex form always fit; agrees with memoryUse', () => {
    withFix('activeMemory', 'block', () => {
      assert.equal(canLoadProgram({ activeMemory: 10, programs }, programs[0]!).ok, false); // 40 > 10 - 30 (others)
      assert.equal(canLoadProgram({ activeMemory: 0, programs: [] }, { ...p(99, false, 'f'), complexForm: true }).ok, RULES.MATRIX.otaku.complexForms.noMemory);
      assert.equal(canLoadProgram(state, programs[2]!).free, memoryUse(programs, 100).free);
    });
  });
});

describe('v0.71.0 R9: generated security sheaves', () => {
  const codes = ['blue', 'green', 'orange', 'red'] as const;
  test('steps come in strictly rising tally order, alerts only go up, shutdown last', () => {
    for (const code of codes) for (let s = 1; s <= 30; s++) {
      const sheaf = generateSheaf({ securityCode: code, securityValue: 6, seed: s });
      assert.ok(sheaf.length >= 3, `${code}/${s}`);
      for (let i = 1; i < sheaf.length; i++) assert.ok(sheaf[i]!.step > sheaf[i - 1]!.step);
      const alerts = sheaf.filter((x) => x.alert).map((x) => x.alert);
      const order = RULES.MATRIX.alerts as readonly string[];
      for (let i = 1; i < alerts.length; i++) assert.ok(order.indexOf(alerts[i]!) > order.indexOf(alerts[i - 1]!), `${code}/${s} ${alerts}`);
      assert.ok(alerts.includes('passive'), `${code}/${s} passive`);
      if (SHEAF_GEN.shutdown[code]) {
        assert.equal(sheaf.at(-1)!.alert, 'shutdown');
        assert.ok(alerts.includes('active'));
      } else assert.ok(!alerts.includes('shutdown'));
    }
  });
  test('every IC step launches through icFromStep with a known behavior and the Security Value as rating', () => {
    for (const code of codes) for (let s = 1; s <= 20; s++) {
      for (const step of generateSheaf({ securityCode: code, securityValue: 7, seed: `h${s}` })) {
        const ic = icFromStep(step, { securityValue: 7, name: 'Host' });
        if (!step.ic.icType) { assert.equal(ic, null, step.event); continue; }
        assert.ok(ic, step.event);
        assert.ok((IC_BEHAVIORS as readonly string[]).includes(step.ic.behavior), step.ic.behavior);
        assert.equal(ic!.behavior, step.ic.behavior);
        assert.equal(ic!.category, step.ic.category);
        assert.equal(ic!.rating, 7);
        assert.ok(!['barrier', 'scramble'].includes(ic!.behavior));
      }
    }
  });
  test('IC categories follow the code: blue white only, green no black, black only after an alert', () => {
    for (let s = 1; s <= 40; s++) {
      assert.ok(generateSheaf({ securityCode: 'blue', securityValue: 3, seed: s }).every((x) => !x.ic.category || x.ic.category === 'white'));
      assert.ok(generateSheaf({ securityCode: 'green', securityValue: 4, seed: s }).every((x) => x.ic.category !== 'black'));
      const red = generateSheaf({ securityCode: 'red', securityValue: 8, seed: s });
      const firstAlert = red.findIndex((x) => x.alert);
      assert.ok(red.slice(0, firstAlert).every((x) => x.ic.category !== 'black'));
    }
  });
  test('deterministic by seed (number or string); different seeds differ', () => {
    const a = generateSheaf({ securityCode: 'orange', securityValue: 6, seed: 'Aztechnology' });
    assert.deepEqual(generateSheaf({ securityCode: 'orange', securityValue: 6, seed: 'Aztechnology' }), a);
    assert.deepEqual(generateSheaf({ securityCode: 'orange', securityValue: 6, seed: 42 }), generateSheaf({ securityCode: 'orange', securityValue: 6, seed: 42 }));
    assert.deepEqual(generateSheaf({ securityCode: 'orange', securityValue: 6, rng: makeRng(seedFromString('Aztechnology')) }), a);
    const all = new Set(Array.from({ length: 10 }, (_, i) => JSON.stringify(generateSheaf({ securityCode: 'orange', securityValue: 6, seed: i + 1 }))));
    assert.ok(all.size > 5);
    assert.deepEqual(sheafFor({ securityCode: 'red', securityValue: 9 }, 7), generateSheaf({ securityCode: 'red', securityValue: 9, seed: 7 }));
    assert.ok(sheafFor({ securityCode: 'nonsense' as any, securityValue: 5 }).length > 0); // unknown code: orange
  });
  test('higher codes have denser trigger steps', () => {
    const avgGap = (code: string) => {
      let gaps = 0, n = 0;
      for (let s = 1; s <= 60; s++) {
        const sh = generateSheaf({ securityCode: code, securityValue: 6, seed: s });
        gaps += sh.at(-1)!.step / sh.length; n++;
      }
      return gaps / n;
    };
    assert.ok(avgGap('red') < avgGap('orange'));
    assert.ok(avgGap('orange') < avgGap('green'));
    assert.ok(avgGap('green') < avgGap('blue'));
  });
  test('a generated sheaf drives the tally: alerts rise as steps are crossed', () => {
    const sheaf = generateSheaf({ securityCode: 'red', securityValue: 8, seed: 3 });
    const { triggered } = advanceTally(0, sheaf.at(-1)!.step, sheaf);
    assert.equal(triggered.length, sheaf.length);
    assert.equal(raiseAlert('none', triggered), 'shutdown');
  });
});

describe('v0.71.0 R9: generated hosts carry a sheaf', () => {
  test('NPC generator organisation hosts', () => {
    const org = generateOrg({ threat: 3 }, makeRng(5));
    const h = hostActorData(org);
    const sheaf = h.system['sheaf'] as any[];
    assert.ok(Array.isArray(sheaf) && sheaf.length > 0);
    assert.deepEqual(hostActorData(org).system['sheaf'], sheaf);
    assert.deepEqual(sheaf, generateSheaf({ securityCode: org.host.code, securityValue: org.host.value, seed: `${org.name}|${org.host.code}|${org.host.value}` }));
    withFix('sheafOnGenerated', false, () => assert.equal(hostActorData(org).system['sheaf'], undefined));
  });
  test('safehouse home hosts', () => {
    const h = safehouseHostData('Den', 7);
    const sheaf = h.system['sheaf'] as any[];
    assert.ok(Array.isArray(sheaf) && sheaf.length > 0);
    assert.deepEqual(safehouseHostData('Den', 7).system['sheaf'], sheaf);
    for (const step of sheaf) if (step.ic.icType) assert.ok(icFromStep(step, { securityValue: 7, name: 'Den host' }));
    withFix('sheafOnGenerated', false, () => assert.equal(safehouseHostData('Den', 7).system['sheaf'], undefined));
  });
});
