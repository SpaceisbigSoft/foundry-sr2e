import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  RULES, safehouseTotals, safehouseOption, optionRating, lifestyleStep, betterLifestyle, paySafehouse, safehouseUpkeepStatus,
  safehouseComfort, buildOwed, searchTarget, searchDays, safehouseHomeCare, safehouseHostData, siteDevicesFor, DAY_SECONDS,
} from '../index.ts';

const S = RULES.SAFEHOUSE;

describe('v0.53.0 safehouse: catalog', () => {
  test('every option has a known category, unique id, and sane numbers', () => {
    const cats = new Set(S.categories.map((c) => c.id));
    const ids = new Set<string>();
    for (const o of S.options) {
      assert.ok(cats.has(o.category), o.id);
      assert.ok(!ids.has(o.id), `duplicate ${o.id}`);
      ids.add(o.id);
      assert.ok(o.cost >= 0 && o.upkeep >= 0 && o.space >= 0, o.id);
      if (o.rating) assert.ok(o.rating[0] >= 1 && o.rating[1] >= o.rating[0], o.id);
      for (const r of o.requires ?? []) assert.ok(safehouseOption(r), `${o.id} needs unknown ${r}`);
      const d = o.effects.device;
      if (d) {
        assert.ok(RULES.SECURITY.deviceKinds.includes(d.kind), `${o.id} device kind`);
        if (d.sense) assert.ok(RULES.SECURITY.senses.includes(d.sense), `${o.id} sense`);
        if (d.scanKind) assert.ok(RULES.GEAR.scannerKinds.includes(d.scanKind), `${o.id} scanKind`);
      }
      if (o.effects.magicSite) assert.ok(['library', 'circle', 'lodge'].includes(o.effects.magicSite), o.id);
    }
    const life = RULES.UPKEEP.lifestyles.map((l) => l.id);
    for (const l of S.locations) assert.ok(life.includes(l.comfortCap), l.id);
    for (const z of S.sizes) assert.ok(life.includes(z.comfort), z.id);
    assert.ok(life.includes(S.overdueComfort));
  });

  test('every category has at least one option', () => {
    for (const c of S.categories) assert.ok(S.options.some((o) => o.category === c.id), c.id);
  });
});

describe('v0.53.0 safehouse: totals', () => {
  test('an empty apartment in a residential suburb', () => {
    const t = safehouseTotals({ location: 'residential', size: 'apartment', options: [] });
    assert.equal(t.buildCost, 15000);
    assert.equal(t.upkeep, 1000);
    assert.equal(t.space, 6);
    assert.equal(t.spaceUsed, 0);
    assert.equal(t.comfort, 'low');
    assert.equal(t.barrier, 8);
    assert.equal(t.security, 1);
    assert.equal(t.concealment, 0);
    assert.deepEqual(t.warnings, []);
  });

  test('location multiplies the size cost and the upkeep', () => {
    const t = safehouseTotals({ location: 'barrens', size: 'house', options: [{ key: 'realFood' }] });
    assert.equal(t.buildCost, Math.round(60000 * 0.3) + 3000);
    assert.equal(t.upkeep, Math.round((2500 + 600) * 0.4));
  });

  test('rated options scale cost, upkeep and effects; ratings clamp', () => {
    const t = safehouseTotals({ location: 'residential', size: 'house', options: [{ key: 'reinforcedWalls', rating: 3 }, { key: 'medicalBay', rating: 9 }] });
    assert.equal(t.barrier, 8 + 6);
    assert.equal(t.medical, -3);
    assert.equal(t.buildCost, 60000 + 15000 + 30000);
    assert.ok(t.warnings.some((w) => /Medical bay/.test(w)));
    assert.equal(optionRating(safehouseOption('medicalBay')!, 9), 3);
    assert.equal(optionRating(safehouseOption('panicRoom')!, 5), 1);
  });

  test('space: per-rating space and over-space warnings', () => {
    const t = safehouseTotals({ location: 'residential', size: 'coffin', options: [{ key: 'garage', rating: 2 }] });
    assert.equal(t.spaceUsed, 4);
    assert.equal(t.garage, 2);
    assert.ok(t.warnings.some((w) => /space/.test(w)));
  });

  test('non-repeatable options count once; repeatable ones make numbered devices', () => {
    const t = safehouseTotals({ location: 'residential', size: 'house', options: [{ key: 'alarm', rating: 4 }, { key: 'alarm', rating: 6 }, { key: 'camera', rating: 3 }, { key: 'camera', rating: 5 }] });
    assert.equal(t.devices.filter((d) => d.kind === 'alarm').length, 1);
    assert.deepEqual(t.devices.filter((d) => d.kind === 'camera').map((d) => [d.name, d.rating]), [['Camera 1', 3], ['Camera 2', 5]]);
    assert.ok(t.warnings.some((w) => /Only one/.test(w)));
  });

  test('an option missing what it needs is warned about and counts for nothing', () => {
    const t = safehouseTotals({ location: 'residential', size: 'house', options: [{ key: 'homeHost', rating: 4 }] });
    assert.ok(t.warnings.some((w) => /Server room/.test(w)));
    assert.equal(t.host, 0);
    assert.equal(t.buildCost, 60000);
    const ok = safehouseTotals({ location: 'residential', size: 'house', options: [{ key: 'serverRoom' }, { key: 'homeHost', rating: 4 }] });
    assert.ok(!ok.warnings.some((w) => /Server room/.test(w)));
  });

  test('comfort steps from the size, capped by the location', () => {
    assert.equal(safehouseTotals({ location: 'residential', size: 'apartment', options: [{ key: 'furnishing', rating: 2 }] }).comfort, 'high');
    const capped = safehouseTotals({ location: 'barrens', size: 'apartment', options: [{ key: 'furnishing', rating: 3 }] });
    assert.equal(capped.comfort, 'low');
    assert.ok(capped.warnings.some((w) => /capped/.test(w)));
    // Half steps add up.
    assert.equal(safehouseTotals({ location: 'residential', size: 'apartment', options: [{ key: 'climate' }] }).comfort, 'low');
    assert.equal(safehouseTotals({ location: 'residential', size: 'apartment', options: [{ key: 'climate' }, { key: 'caretaker' }] }).comfort, 'middle');
  });

  test('wards, magic sites, concealment', () => {
    const t = safehouseTotals({ location: 'underground', size: 'room', options: [{ key: 'ward', rating: 5 }, { key: 'lodge', rating: 4 }, { key: 'hiddenEntrance' }, { key: 'fakeOwner', rating: 4 }] });
    assert.equal(t.ward, 5);
    assert.deepEqual(t.magicSites.map((m) => [m.kind, m.rating]), [['lodge', 4]]);
    assert.equal(t.concealment, 3 + 1 + 2);
  });

  test('unknown options are ignored with a warning', () => {
    const t = safehouseTotals({ location: 'nowhere', size: 'castle', options: [{ key: 'moat' }] });
    assert.equal(t.location.id, 'residential');
    assert.equal(t.size.id, 'apartment');
    assert.ok(t.warnings.some((w) => /moat/.test(w)));
  });
});

describe('v0.53.0 safehouse: upkeep, comfort, search, home care', () => {
  test('pay upkeep extends from now or from the old date', () => {
    const m = RULES.UPKEEP.monthDays * DAY_SECONDS;
    assert.deepEqual(paySafehouse({ upkeep: 1000, months: 2, paidUntil: -1, now: 100 }), { cost: 2000, paidUntil: 100 + 2 * m });
    assert.deepEqual(paySafehouse({ upkeep: 1000, months: 1, paidUntil: 5000, now: 100 }), { cost: 1000, paidUntil: 5000 + m });
  });

  test('status: never paid, due, overdue, lapsed', () => {
    assert.deepEqual(safehouseUpkeepStatus(-1, 0), { days: null, overdue: false, lapsed: false });
    assert.equal(safehouseUpkeepStatus(10 * DAY_SECONDS, 0).days, 10);
    const late = safehouseUpkeepStatus(0, 3 * DAY_SECONDS);
    assert.equal(late.overdue, true);
    assert.equal(late.lapsed, false);
    assert.equal(safehouseUpkeepStatus(0, (S.graceDays + 1) * DAY_SECONDS).lapsed, true);
  });

  test('lapsed upkeep drops comfort but never raises it', () => {
    assert.equal(safehouseComfort('high', true), S.overdueComfort);
    assert.equal(safehouseComfort('street', true), 'street');
    assert.equal(safehouseComfort('high', false), 'high');
  });

  test('build owed', () => {
    assert.equal(buildOwed(10000, 4000), 6000);
    assert.equal(buildOwed(10000, 15000), 0);
  });

  test('search TN and time', () => {
    const s = searchTarget(3);
    assert.equal(s.tn + s.modifiers.reduce((a, m) => a + m.value, 0), S.search.baseTn + 3);
    const low = searchTarget(-9);
    assert.equal(low.tn + low.modifiers.reduce((a, m) => a + m.value, 0), S.search.minTn);
    assert.equal(searchDays(0), null);
    assert.equal(searchDays(1), S.search.days);
    assert.ok((searchDays(3) ?? 99) < S.search.days);
  });

  test('home care picks the better lifestyle and its medical bay', () => {
    assert.deepEqual(safehouseHomeCare('low', []), { lifestyle: 'low', medical: 0, from: '' });
    const r = safehouseHomeCare('low', [{ comfort: 'squatter', medical: 0, name: 'A' }, { comfort: 'middle', medical: -2, name: 'B' }]);
    assert.deepEqual(r, { lifestyle: 'middle', medical: -2, from: 'B' });
    // A worse home with a medical bay still helps.
    const m = safehouseHomeCare('high', [{ comfort: 'squatter', medical: -1, name: 'Bay' }]);
    assert.deepEqual(m, { lifestyle: 'high', medical: -1, from: 'Bay' });
  });

  test('lifestyle steps', () => {
    assert.equal(lifestyleStep('low', 1), 'middle');
    assert.equal(lifestyleStep('luxury', 4), 'luxury');
    assert.equal(lifestyleStep('street', -2), 'street');
    assert.equal(betterLifestyle('low', 'high'), 'high');
  });

  test('host and site data', () => {
    const h = safehouseHostData('Den', 5);
    assert.equal(h.type, 'host');
    assert.equal(h.system.securityValue, 5);
    assert.ok(RULES.MATRIX.securityCodes.includes(h.system.securityCode as any));
    const t = safehouseTotals({ location: 'residential', size: 'house', options: [{ key: 'thermalCamera', rating: 4 }, { key: 'idScanner', rating: 3 }] });
    const d = siteDevicesFor(t.devices, (i) => `d${i}`);
    assert.deepEqual(d.map((x) => [x.id, x.kind, x.sense, x.identifies]), [['d0', 'camera', 'thermal', false], ['d1', 'scanner', '', true]]);
  });
});

describe('v0.53.0 safehouse: catalog text', () => {
  test('describeOption and defaultRating', async () => {
    const { describeOption, defaultRating } = await import('../index.ts');
    assert.match(describeOption(safehouseOption('camera')!), /Security \+0\.5\/rating · Device: camera \(visual\)/);
    assert.match(describeOption(safehouseOption('homeHost')!), /needs Server room/);
    assert.equal(defaultRating(safehouseOption('camera')!), 4);
    assert.equal(defaultRating(safehouseOption('ward')!), 1);
    assert.equal(defaultRating(safehouseOption('panicRoom')!), 1);
    for (const o of RULES.SAFEHOUSE.options) assert.equal(typeof describeOption(o), 'string');
  });
});

describe('v0.53.0 safehouse: caps', () => {
  test('security and concealment are capped', () => {
    const many = Array.from({ length: 20 }, () => ({ key: 'securityDoor', rating: 8 }));
    assert.equal(safehouseTotals({ location: 'corporate', size: 'compound', options: many }).security, RULES.SAFEHOUSE.caps.security);
    const hide = [{ key: 'hiddenEntrance' }, { key: 'falseFront' }, { key: 'cashOnly' }, { key: 'astralCamouflage' }, { key: 'isolatedLine' }, { key: 'faraday' }, { key: 'generator' }, { key: 'fakeOwner', rating: 6 }];
    assert.equal(safehouseTotals({ location: 'underground', size: 'compound', options: hide }).concealment, RULES.SAFEHOUSE.caps.concealment);
  });
});
