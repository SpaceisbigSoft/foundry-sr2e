import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  readRegionEnv, hasRegionEnv, innermostFirst, regionBackgroundSources, regionEnvironmentTags, regionWeather, regionLight, darknessWithBehaviors,
  segmentSamples, worseSmoke, smokeAlong, crossedRegions, enteredRegions, wardStops, deviceWatches, shapeContains, shapesContain, shapesArea,
  backgroundFor, privacyGroup, privacyFor, legacyRollMode, autoResists, turnChanged, turnRecipients, hoverLines, itemDragData, trackBar, PRIVACY_GROUPS, SOUND_EVENTS,
  type RegionHit,
} from '../index.ts';

const hit = (id: string, env: Record<string, unknown>, area?: number): RegionHit => ({ id, name: `R${id}`, env: readRegionEnv(env), ...(area !== undefined ? { area } : {}) });

describe('v0.60.0 region environments', () => {
  test('flags are read safely: bad values are nothing, numbers are clamped', () => {
    const e = readRegionEnv({ backgroundCount: '3.7', light: 'blinding', smoke: 'thermal', weather: ' fog ', wardUuid: 'Actor.w' });
    assert.equal(e.backgroundCount, 3);
    assert.equal(e.light, '');
    assert.equal(e.smoke, 'thermal');
    assert.equal(e.weather, 'fog');
    assert.equal(readRegionEnv({ backgroundCount: 99 }).backgroundCount, 20);
    assert.equal(readRegionEnv({ backgroundCount: -2 }).backgroundCount, 0);
    assert.equal(readRegionEnv(null).backgroundCount, 0);
    assert.equal(hasRegionEnv(readRegionEnv({})), false);
    assert.equal(hasRegionEnv(readRegionEnv({ siteUuid: 'Actor.s' })), false); // a site with no device does nothing
    assert.equal(hasRegionEnv(readRegionEnv({ siteUuid: 'Actor.s', deviceId: 'd1' })), true);
    assert.equal(hasRegionEnv(e), true);
  });
  test('background count: a region is a source; aspected and toxic regions line up with the right magicians', () => {
    const src = regionBackgroundSources([hit('a', { backgroundCount: 3, backgroundAspect: 'hermetic' }), hit('b', { backgroundCount: 2, backgroundAspect: 'toxic, rat' }), hit('c', { light: 'darkness' })]);
    assert.deepEqual(src, [
      { name: 'Ra', rating: 3, aspect: ['hermetic'], toxic: false },
      { name: 'Rb', rating: 2, aspect: ['rat'], toxic: true },
    ]);
    // A shaman is penalised by the hermetic library; a hermetic is not (aspected sources give bonus dice by default).
    const shaman = backgroundFor(src, 0, ['shamanic', 'bear']);
    assert.equal(shaman.penalty, 3);
    assert.equal(shaman.toxic, true);
    const mage = backgroundFor(src, 1, ['hermetic']);
    assert.equal(mage.penalty, 2);
  });
  test('environment tags add to the scene; weather and light come from the innermost region', () => {
    assert.deepEqual(regionEnvironmentTags(['Urban'], [hit('a', { environment: 'forest, urban' })]), ['urban', 'forest']);
    const big = hit('big', { weather: 'storm', light: 'minimal' }, 10000);
    const room = hit('room', { weather: 'clear', light: 'normal' }, 100);
    assert.equal(regionWeather('heavyRain', [big, room]), 'clear');
    assert.equal(regionWeather('heavyRain', [big]), 'storm');
    assert.equal(regionWeather('heavyRain', []), 'heavyRain');
    assert.equal(regionLight([big, room]), 'normal');
    assert.equal(regionLight([hit('x', { smoke: 'smoke' })]), null);
    assert.deepEqual(innermostFirst([hit('a', {}), hit('b', {})]).map((h) => h.id), ['a', 'b']);
  });
  test("Foundry's darkness behaviours: override, brighten, darken", () => {
    assert.equal(darknessWithBehaviors(0.2, [{ mode: 0, modifier: 0.9 }]), 0.9);
    assert.equal(darknessWithBehaviors(0.8, [{ mode: 1, modifier: 0.5 }]), 0.4);
    assert.ok(Math.abs(darknessWithBehaviors(0.2, [{ mode: 2, modifier: 0.5 }]) - 0.6) < 1e-9);
    assert.equal(darknessWithBehaviors(0.5, []), 0.5);
  });
  test('smoke along a line: sampled points, the worst kind', () => {
    const pts = segmentSamples({ x: 0, y: 0 }, { x: 100, y: 0 }, 25);
    assert.equal(pts.length, 5);
    assert.deepEqual(pts[0], { x: 0, y: 0 });
    assert.deepEqual(pts.at(-1), { x: 100, y: 0 });
    assert.equal(segmentSamples({ x: 0, y: 0 }, { x: 0, y: 0 }, 25).length, 2);
    assert.equal(segmentSamples({ x: 0, y: 0 }, { x: 1e6, y: 0 }, 1, 50).length, 50);
    assert.deepEqual(smokeAlong([[], [hit('a', { smoke: 'smoke' })], [hit('b', { smoke: 'thermal' })]]), { kind: 'thermal', source: 'Rb' });
    assert.deepEqual(smokeAlong([[hit('a', { light: 'darkness' })]]), { kind: 'none', source: '' });
    assert.equal(worseSmoke({ kind: 'smoke', n: 1 }, { kind: 'none', n: 2 }).n, 1);
    assert.equal(worseSmoke({ kind: 'smoke', n: 1 }, { kind: 'thermal', n: 2 }).n, 2);
  });
  test('ward edges and camera entries', () => {
    assert.deepEqual(crossedRegions(['w1', 'w2'], ['w2', 'w3']).sort(), ['w1', 'w3']);
    assert.deepEqual(crossedRegions(['w1'], ['w1']), []);
    assert.deepEqual(enteredRegions(['a'], ['a', 'b']), ['b']);
    assert.equal(wardStops({ astral: true, rating: 4, mode: 'block', gm: false }), 'stop');
    assert.equal(wardStops({ astral: true, rating: 4, mode: 'block', gm: true }), 'warn');
    assert.equal(wardStops({ astral: true, rating: 4, mode: 'warn', gm: false }), 'warn');
    assert.equal(wardStops({ astral: false, rating: 4, mode: 'block', gm: false }), 'pass');
    assert.equal(wardStops({ astral: true, rating: 0, mode: 'block', gm: false }), 'pass');
    assert.equal(wardStops({ astral: true, rating: 4, mode: 'off', gm: false }), 'pass');
    const base = { active: true, bypassed: false, guard: false, hidden: false, astral: false };
    assert.equal(deviceWatches(base), true);
    assert.equal(deviceWatches({ ...base, bypassed: true }), false);
    assert.equal(deviceWatches({ ...base, guard: true }), false);
    assert.equal(deviceWatches({ ...base, hidden: true }), false);
    assert.equal(deviceWatches({ ...base, astral: true, sense: 'thermal' }), false);
  });
  test('region shapes: rectangles (rotated), circles, ellipses, polygons, holes, elevation, area', () => {
    assert.equal(shapeContains({ type: 'rectangle', x: 0, y: 0, width: 100, height: 50 }, { x: 50, y: 25 }), true);
    assert.equal(shapeContains({ type: 'rectangle', x: 0, y: 0, width: 100, height: 50 }, { x: 50, y: 60 }), false);
    // Turned 90° about its centre (50, 25): now 50 wide and 100 tall.
    assert.equal(shapeContains({ type: 'rectangle', x: 0, y: 0, width: 100, height: 50, rotation: 90 }, { x: 50, y: 70 }), true);
    assert.equal(shapeContains({ type: 'rectangle', x: 0, y: 0, width: 100, height: 50, rotation: 90 }, { x: 95, y: 25 }), false);
    assert.equal(shapeContains({ type: 'circle', x: 0, y: 0, radius: 10 }, { x: 6, y: 8 }), true);
    assert.equal(shapeContains({ type: 'ellipse', x: 0, y: 0, radiusX: 20, radiusY: 5 }, { x: 15, y: 0 }), true);
    assert.equal(shapeContains({ type: 'ellipse', x: 0, y: 0, radiusX: 20, radiusY: 5 }, { x: 0, y: 8 }), false);
    const tri = { type: 'polygon', points: [0, 0, 100, 0, 0, 100] };
    assert.equal(shapeContains(tri, { x: 20, y: 20 }), true);
    assert.equal(shapeContains(tri, { x: 80, y: 80 }), false);
    const donut = [{ type: 'circle', x: 0, y: 0, radius: 10 }, { type: 'circle', x: 0, y: 0, radius: 5, hole: true }];
    assert.equal(shapesContain(donut, { x: 7, y: 0 }), true);
    assert.equal(shapesContain(donut, { x: 2, y: 0 }), false);
    assert.equal(shapesContain(donut, { x: 7, y: 0, elevation: 20 }, { bottom: null, top: 10 }), false);
    assert.equal(shapesContain(donut, { x: 7, y: 0, elevation: 5 }, { bottom: 0, top: 10 }), true);
    assert.ok(Math.abs(shapesArea(donut) - Math.PI * 75) < 1e-6);
    assert.equal(shapesArea([tri]), 5000);
    assert.equal(shapesArea([{ type: 'rectangle', x: 0, y: 0, width: 10, height: 10 }]), 100);
  });
});

describe('v0.60.0 quality of life', () => {
  test('privacy: each kind of test has a group; the user\'s group mode wins over Foundry\'s chat mode', () => {
    assert.equal(privacyGroup('attack'), 'combat');
    assert.equal(privacyGroup('spell'), 'magic');
    assert.equal(privacyGroup('system'), 'matrix');
    assert.equal(privacyGroup('heal'), 'health');
    assert.equal(privacyGroup('whatever'), 'other');
    assert.equal(privacyFor('spell', { magic: 'blind' }, 'public'), 'blind');
    assert.equal(privacyFor('spell', { combat: 'gm' }, 'public'), 'public');
    assert.equal(privacyFor('spell', { magic: '' }, 'self'), 'self');
    assert.equal(privacyFor('spell', { magic: 'nonsense' }, 'public'), 'public');
    assert.equal(privacyFor('', { other: 'gm' }, 'public'), 'public');
    assert.equal(legacyRollMode('blind'), 'blindroll');
    assert.equal(legacyRollMode('public'), 'publicroll');
    // No kind is in two groups.
    const kinds = PRIVACY_GROUPS.flatMap((g) => g.kinds);
    assert.equal(new Set(kinds).size, kinds.length);
  });
  test('NPCs resist by themselves only when nobody else should', () => {
    const o = { enabled: true, playerOwned: false, resisted: false, retarget: false, combined: false };
    assert.equal(autoResists(o), true);
    assert.equal(autoResists({ ...o, enabled: false }), false);
    assert.equal(autoResists({ ...o, playerOwned: true }), false);
    assert.equal(autoResists({ ...o, resisted: true }), false);
    assert.equal(autoResists({ ...o, retarget: true }), false);
    assert.equal(autoResists({ ...o, combined: true }), false);
  });
  test('turn pings: which changes start a turn, and who is told', () => {
    assert.equal(turnChanged({ turn: 2 }, 'sr2e'), true);
    assert.equal(turnChanged({ round: 3 }, 'sr2e'), true);
    assert.equal(turnChanged({ flags: { sr2e: { pass: 1 } } }, 'sr2e'), true);
    assert.equal(turnChanged({ flags: { sr2e: { surprise: {} } } }, 'sr2e'), false);
    assert.equal(turnChanged(null, 'sr2e'), false);
    assert.deepEqual(turnRecipients([
      { id: 'gm', active: true, isGM: true, owns: true },
      { id: 'p1', active: true, isGM: false, owns: true },
      { id: 'p2', active: false, isGM: false, owns: true },
      { id: 'p3', active: true, isGM: false, owns: false },
    ]), ['p1']);
  });
  test('hover card lines', () => {
    const lines = hoverLines({ name: 'X', derived: { combatPool: 6, combatPoolLeft: 4, spellPool: 0, woundModifier: 2, karmaPoolLeft: 1 }, karmaPool: 3, initiative: 14, pass: 1, fullDefense: true,
      monitor: { physical: 3, stun: 1, physicalMax: 10, stunMax: 10 }, matrix: { value: 0, max: 10 } });
    assert.deepEqual(lines, ['Combat 4/6 · Karma 1/3', 'Physical 3/10 · Stun 1/10', 'wounds +2 TN · initiative 14 (pass 2) · full defense']);
    assert.deepEqual(hoverLines({ name: 'Car', derived: {}, condition: { value: 4, max: 10 } }), ['Condition 4/10']);
    assert.deepEqual(hoverLines({ name: 'Nobody', derived: {} }), []);
  });
  test('sounds, drag data and token bars', () => {
    assert.ok(SOUND_EVENTS.every((e) => e.id && e.src.startsWith('sounds/')));
    assert.deepEqual(itemDragData('Actor.abc', 'i1'), { type: 'Item', uuid: 'Actor.abc.Item.i1' });
    assert.equal(itemDragData('', 'i1'), null);
    assert.deepEqual(trackBar(3, 10), { value: 7, max: 10 });
    assert.deepEqual(trackBar(15, 10), { value: 0, max: 10 });
    assert.deepEqual(trackBar('x', 10), { value: 10, max: 10 });
    assert.equal(trackBar(0, 0), null);
  });
});
