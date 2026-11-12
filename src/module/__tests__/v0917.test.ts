/**
 * v0.91.7: the Scene builder. The pure rules (rules/scenebuilder.ts: the spec, the kinds' defaults, backdrops, time of
 * day, placement, the document data, the generated site, checks and the summary) and the wiring (the window's text
 * keys, the tools entry, the GM panel buttons, the generator's create context, GM-only building).
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  RULES, BACKDROPS, backdropById, defaultSpec, switchKind, withBackdrop, normalizeSpec, normalizeRow, defaultRow, darknessForHour, sceneDarkness,
  secondsUntilHour, spotsInZone, zonesFor, sceneCreateData, sceneFlags, backdropDocuments, rectRegionData, wardArea, generatedSiteSystem, specProblems,
  specSummary, templateOf, normalizeTemplates, stepTouched, stepMoveTo, tokenCount, dispositionOf, kindDefaults, DARKNESS, SCENE_STEPS, SCENE_LIMITS, geoOf,
} from '../rules/index.ts';
import { TOOLS } from '../rules/tools.ts';

const ROOT = process.cwd();
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), 'utf8');
const EN = JSON.parse(read('public', 'lang', 'en.json'));
const key = (k: string): unknown => k.split('.').reduce((o: any, p) => (o && typeof o === 'object' ? o[p] : undefined), EN);

describe('v0.91.7 the spec and the kinds', () => {
  test('a new real-world scene starts on the night street with its size, walls and night', () => {
    const s = defaultSpec('real');
    const b = backdropById('street')!;
    assert.ok(b, 'the street backdrop exists');
    assert.equal(s.backdrop, 'street');
    assert.equal(s.width, b.width);
    assert.equal(s.height, b.height);
    assert.equal(s.walls, true);
    assert.equal(s.hour, 22);
    assert.equal(s.tokenVision, true);
    assert.equal(s.host.mode, 'none');
  });
  test('switching to a Matrix host takes its defaults and a generated host, keeping what the GM set', () => {
    const s = { ...defaultSpec('real'), name: 'ZZ host run', weather: 'heavyRain' };
    const m = switchKind(s, 'matrix');
    assert.equal(m.kind, 'matrix');
    assert.equal(m.backdrop, 'matrix-host');
    assert.equal(m.globalLight, true);
    assert.equal(m.darkness, 0);
    assert.equal(m.tokenVision, false);
    assert.equal(m.host.mode, 'generate');
    assert.equal(m.name, 'ZZ host run');
    // The weather was the GM's own choice, not the real world's default: it stays.
    assert.equal(m.weather, 'heavyRain');
    assert.equal(sceneDarkness(m), 0);
    // And back: the generated host goes when nothing else needs it.
    const r = switchKind(m, 'real');
    assert.equal(r.host.mode, 'none');
    assert.equal(r.backdrop, 'street');
  });
  test('the astral kind is lit, with the astral backdrop', () => {
    const a = switchKind(defaultSpec('real'), 'astral');
    assert.equal(a.backdrop, 'astral');
    assert.equal(a.globalLight, true);
    assert.equal(sceneDarkness(a), 0);
    assert.deepEqual(Object.keys(kindDefaults('astral')).includes('backdrop'), true);
  });
  test('a backdrop brings its size, colour, environment and terrain; the GM\'s own environment stays', () => {
    const b = BACKDROPS.find((x) => x.kind === 'real' && x.id !== 'street')!;
    const s = withBackdrop(defaultSpec('real'), b.id);
    assert.equal(s.width, b.width);
    assert.equal(s.color, b.background);
    assert.equal(s.environment, b.environment);
    const own = withBackdrop({ ...defaultSpec('real'), environment: 'zz swamp' }, b.id);
    assert.equal(own.environment, 'zz swamp');
    const plain = withBackdrop(s, '');
    assert.equal(plain.backdrop, '');
    assert.equal(plain.walls, false);
  });
  test('normalizeSpec checks and clamps every field', () => {
    const s = normalizeSpec({ kind: 'nope', width: 99999, height: -4, grid: 7, weather: 'acid', terrain: 'lava', hour: '', darkness: 4, background: 99,
      ward: { on: 1, rating: 99, kind: 'zz', area: 'zz' }, people: Array.from({ length: 80 }, () => ({ source: 'generate', id: 'bad id!' })), pcs: ['a', 'a', ''],
      combat: 'zz', show: 'zz', color: 'red', backdrop: 'no-such' });
    assert.equal(s.kind, 'real');
    assert.equal(s.width, SCENE_LIMITS.maxMetres);
    assert.equal(s.height, SCENE_LIMITS.minMetres);
    assert.equal(s.grid, SCENE_LIMITS.minGrid);
    assert.equal(s.weather, 'clear');
    assert.equal(s.terrain, '');
    assert.equal(s.hour, null);
    assert.equal(s.darkness, 1);
    assert.equal(s.background, 20);
    assert.deepEqual(s.ward, { on: true, rating: 20, kind: 'ward', area: 'scene' });
    assert.equal(s.people.length, SCENE_LIMITS.maxRows);
    assert.ok(s.people.every((r) => /^[A-Za-z0-9]{16}$/.test(r.id)));
    assert.deepEqual(s.pcs, ['a']);
    assert.equal(s.combat, 'none');
    assert.equal(s.show, 'view');
    assert.equal(s.color, defaultSpec('real').color);
    assert.equal(s.backdrop, '');
  });
  test('people rows: counts, threat and attitude clamped; defaults hidden and grouped', () => {
    const r = normalizeRow({ source: 'actor', uuid: 'Actor.x', count: 500, threat: 9, attitude: 'zz' })!;
    assert.equal(r.count, SCENE_LIMITS.maxCount);
    assert.equal(r.threat, SCENE_LIMITS.maxThreat);
    assert.equal(r.attitude, 'hostile');
    assert.equal(normalizeRow(null), null);
    const d = defaultRow('generate');
    assert.equal(d.hidden, true);
    assert.equal(d.morale, true);
    assert.equal(dispositionOf('friendly'), 1);
    assert.equal(dispositionOf('neutral'), 0);
    assert.equal(dispositionOf('hostile'), -1);
  });
  test('steps: ticks and moving between them', () => {
    const s = defaultSpec('real');
    assert.equal(stepTouched(s, 'basics'), false);
    assert.equal(stepTouched({ ...s, name: 'x' }, 'basics'), true);
    assert.equal(stepMoveTo('basics', -1), 'basics');
    assert.equal(stepMoveTo('basics', 1), 'map');
    assert.equal(stepMoveTo('finish', 1), 'finish');
    assert.equal(SCENE_STEPS.length, 7);
  });
});

describe('v0.91.7 time of day', () => {
  test('darkness by the hour: day, dusk and dawn, night, the wilds, indoors', () => {
    assert.equal(darknessForHour(12), DARKNESS.day);
    assert.equal(darknessForHour(0), DARKNESS.night);
    assert.equal(darknessForHour(RULES.MAGIC_V56.natureSpirits.sunrise), DARKNESS.twilight);
    assert.equal(darknessForHour(RULES.MAGIC_V56.natureSpirits.sunset), DARKNESS.twilight);
    assert.equal(darknessForHour(2, { wild: true }), DARKNESS.wildNight);
    assert.equal(darknessForHour(12, { indoor: true }), DARKNESS.indoor);
  });
  test('the scene\'s darkness: the GM\'s number wins, then the hour (with the backdrop and environment), then night', () => {
    const s = defaultSpec('real');
    assert.equal(sceneDarkness({ ...s, darkness: 0.3 }), 0.3);
    assert.equal(sceneDarkness({ ...s, hour: 12 }), DARKNESS.day);
    assert.equal(sceneDarkness({ ...s, hour: 2, environment: 'wilderness' }), DARKNESS.wildNight);
    assert.equal(sceneDarkness({ ...s, hour: null }), DARKNESS.night);
    const indoor = BACKDROPS.find((b) => b.kind === 'real' && b.indoor);
    if (indoor) assert.equal(sceneDarkness({ ...withBackdrop(s, indoor.id), hour: 12 }), DARKNESS.indoor);
  });
  test('moving world time only goes forward, to the next time it is that hour', () => {
    assert.equal(secondsUntilHour(0, 22), 22 * 3600);
    assert.equal(secondsUntilHour(23.5 * 3600, 22), 22.5 * 3600);
    assert.equal(secondsUntilHour(22.25 * 3600, 22), 0);
    assert.ok(secondsUntilHour(86400 * 3 + 5, 6) > 0);
  });
});

describe('v0.91.7 placing tokens', () => {
  test('spots fill the zone on the grid, inside it, one square apart first', () => {
    const s = defaultSpec('real');
    const z = zonesFor(s).npcs;
    const spots = spotsInZone(6, z, s);
    assert.equal(spots.length, 6);
    const px = s.grid / s.gridDistance;
    for (const p of spots) {
      assert.equal(p.x % s.grid, 0);
      assert.equal(p.y % s.grid, 0);
      assert.ok(p.x >= z.x * px - s.grid && p.x <= (z.x + z.w) * px, `x ${p.x} in the zone`);
      assert.ok(p.y >= z.y * px - s.grid && p.y <= (z.y + z.h) * px, `y ${p.y} in the zone`);
    }
    assert.equal(new Set(spots.map((p) => `${p.x},${p.y}`)).size, 6);
  });
  test('more tokens than the zone holds still all get a spot on the map', () => {
    const s = normalizeSpec({ ...defaultSpec('real'), backdrop: '', width: 10, height: 6 });
    const spots = spotsInZone(40, zonesFor(s).pcs, s);
    assert.equal(spots.length, 40);
    for (const p of spots) { assert.ok(p.x >= 0 && p.x <= s.width * 100 - 100); assert.ok(p.y >= 0 && p.y <= s.height * 100 - 100); }
  });
  test('a plain map has the left and right thirds as zones', () => {
    const s = normalizeSpec({ ...defaultSpec('real'), backdrop: '', width: 30, height: 20 });
    const z = zonesFor(s);
    assert.ok(z.pcs.x + z.pcs.w < z.npcs.x);
  });
});

describe('v0.91.7 the documents', () => {
  test('the scene\'s data: metres to pixels, metre grid, darkness, the picture only when there is one', () => {
    const s = { ...defaultSpec('real'), name: 'ZZ', width: 30, height: 20, grid: 100, gridDistance: 1, hour: 12 };
    const d: any = sceneCreateData(s, { imagePath: '', flags: { sr2e: { a: 1 } } });
    assert.equal(d.width, 3000);
    assert.equal(d.height, 2000);
    assert.equal(d.padding, 0);
    assert.deepEqual(d.grid, { type: 1, size: 100, distance: 1, units: 'm' });
    assert.equal(d.environment.darknessLevel, DARKNESS.day);
    assert.equal('background' in d, false);
    const h: any = sceneCreateData({ ...s, gridDistance: 2, gridless: true }, { imagePath: 'systems/sr2e/backdrops/street.svg', flags: {} });
    assert.equal(h.width, 1500);
    assert.equal(h.grid.type, 0);
    assert.equal(h.background.src, 'systems/sr2e/backdrops/street.svg');
    assert.deepEqual(Object.keys(sceneFlags(s)).sort(), ['backgroundCount', 'backgroundSources', 'environment', 'terrain', 'weather']);
  });
  test('a backdrop\'s walls, windows, doors and lamps in pixels', () => {
    const b = backdropById('street')!;
    const d = backdropDocuments(b, { grid: 100, gridDistance: 1 });
    assert.equal(d.walls.length, b.walls.length + b.windows.length);
    const win = d.walls.slice(b.walls.length);
    for (const w of win) { assert.equal(w.move, 20); assert.equal(w.sight, 0); assert.equal(w.light, 0); }
    assert.equal(d.doors.length, b.doors.length);
    for (const x of d.doors) { assert.equal(x.data.door, 1); assert.equal(x.data.ds, 0); }
    if (b.walls[0]) assert.deepEqual(d.walls[0].c, b.walls[0].map((v) => Math.round(v * 100)));
    assert.equal(d.lights.length, b.lights.length);
    if (b.lights[0]) assert.equal(d.lights[0].config.dim, b.lights[0].dim);
  });
  test('a ward region covers the scene or the NPCs\' zone', () => {
    const s = defaultSpec('real');
    assert.deepEqual(wardArea(s), { x: 0, y: 0, w: s.width, h: s.height });
    assert.deepEqual(wardArea({ ...s, ward: { ...s.ward, area: 'npcs' } }), zonesFor(s).npcs);
    const r: any = rectRegionData({ x: 1, y: 2, w: 3, h: 4 }, { grid: 100, gridDistance: 1 }, { name: 'w', color: '#000000', flags: { sr2e: { env: { wardUuid: 'Actor.w' } } } });
    assert.deepEqual(r.shapes[0], { type: 'rectangle', x: 100, y: 200, width: 300, height: 400 });
  });
  test('a generated site: a maglock per secure door, cameras and an alarm, valid kinds, rated by Threat', () => {
    for (let t = 0; t <= 5; t++) {
      const sys: any = generatedSiteSystem({ threat: t, hostUuid: 'Actor.h', sceneId: 'S', doors: [{ wallId: 'W1', name: 'Back door' }, { wallId: 'W2', name: 'Office' }] });
      const kinds = sys.devices.map((d: any) => d.kind);
      assert.equal(kinds.filter((k: string) => k === 'maglock').length, 2);
      assert.ok(kinds.includes('camera') && kinds.includes('alarm'));
      for (const d of sys.devices) {
        assert.ok(RULES.SECURITY.deviceKinds.includes(d.kind));
        assert.equal(d.rating, 2 + t);
        assert.match(d.id, /^[A-Za-z0-9]{16}$/);
        if (d.lockType) assert.ok(RULES.SECURITY_V57.lockTypes.some((l: any) => l.id === d.lockType));
        if (d.sense) assert.ok(RULES.SECURITY.senses.includes(d.sense));
      }
      assert.equal(new Set(sys.devices.map((d: any) => d.id)).size, sys.devices.length);
      assert.equal(sys.hostUuid, 'Actor.h');
      assert.equal(sys.devices[0].wallId, 'W1');
      assert.ok(String(sys.response.force).length > 3);
    }
  });
});

describe('v0.91.7 checks, summary and templates', () => {
  test('what stops a build', () => {
    const s = defaultSpec('real');
    assert.ok(specProblems(s).length >= 1, 'a name is needed');
    const named = { ...s, name: 'ZZ' };
    assert.deepEqual(specProblems(named), []);
    assert.equal(specProblems({ ...named, backdrop: 'custom', image: '' }).length, 1);
    assert.equal(specProblems({ ...named, backdrop: 'custom', image: '' }, { edit: true }).length, 0);
    assert.equal(specProblems({ ...switchKind(named, 'matrix'), host: { mode: 'none', uuid: '', threat: 2, corporation: true } }).length, 1);
    assert.equal(specProblems({ ...named, pcs: ['Actor.gone'] }, { known: () => false }).length, 1);
    assert.equal(specProblems({ ...named, people: [{ ...defaultRow('actor'), uuid: '' }] }).length, 1);
    assert.equal(specProblems({ ...named, people: Array.from({ length: 4 }, () => ({ ...defaultRow('actor'), uuid: 'Actor.a', count: 20 })) }).length, 1);
    assert.equal(tokenCount({ ...named, pcs: ['a', 'b'], people: [{ ...defaultRow('actor'), uuid: 'x', count: 3 }, { ...defaultRow('actor'), uuid: 'y', count: 3, linked: true }] }), 6);
  });
  test('the summary reads as text, never as keys', () => {
    const s = { ...switchKind({ ...defaultSpec('real'), name: 'ZZ' }, 'matrix'), ward: { on: true, rating: 5, kind: 'ward', area: 'scene' as const }, background: 2,
      pcs: ['Actor.a'], people: [{ ...defaultRow('generate'), kind: 'group' as const }, { ...defaultRow('actor'), uuid: 'Actor.b', count: 3 }], site: { mode: 'generate' as const, uuid: '', threat: 3 } };
    const rows = specSummary(s, { pc: () => 'Pell', actor: () => 'Ganger' });
    assert.ok(rows.length >= 8);
    for (const r of rows) {
      assert.ok(!/SR2E\./.test(r.label) && !/SR2E\./.test(r.value), `${r.label}: ${r.value}`);
      assert.ok(r.label.length > 0);
    }
    assert.ok(rows.some((r) => r.value.includes('Ganger ×3')));
  });
  test('templates keep every choice but the folder, and bad ones are dropped', () => {
    const s = { ...defaultSpec('real'), name: 'ZZ', folderId: 'F1', pcs: ['Actor.a'] };
    const t = templateOf('T1', ' Docks meet ', s);
    assert.equal(t.name, 'Docks meet');
    assert.equal(t.spec.folderId, '');
    assert.deepEqual(t.spec.pcs, ['Actor.a']);
    const list = normalizeTemplates([t, null, { name: 'no id' }, 'x']);
    assert.equal(list.length, 1);
    assert.equal(normalizeTemplates('nope').length, 0);
  });
});

describe('v0.91.7 wiring', () => {
  const app = read('src', 'module', 'applications', 'scenebuilder.ts');
  const rules = read('src', 'module', 'rules', 'scenebuilder.ts');
  const tpl = read('public', 'templates', 'scene-builder.hbs');
  test('every SceneBuilder key the code and templates use is in the language file', () => {
    const used = new Set<string>();
    for (const src of [app, rules, tpl, read('public', 'templates', 'gm-panel.hbs')]) {
      // Literal keys only (a key built from a value, `…kind.${k}`, is checked value by value below).
      for (const m of src.matchAll(/SR2E\.SceneBuilder\.([A-Za-z0-9.]*[A-Za-z0-9])(?![A-Za-z0-9.]*\$\{)/g)) used.add(m[1]!);
    }
    const missing = [...used].filter((k) => typeof key(`SR2E.SceneBuilder.${k}`) !== 'string');
    assert.deepEqual(missing, []);
    // The keys built from a value: each value has its text.
    for (const k of ['real', 'astral', 'matrix']) { assert.equal(typeof key(`SR2E.SceneBuilder.kind.${k}`), 'string'); assert.equal(typeof key(`SR2E.SceneBuilder.kindHint.${k}`), 'string'); }
    for (const k of SCENE_STEPS) { assert.equal(typeof key(`SR2E.SceneBuilder.step.${k}`), 'string'); assert.equal(typeof key(`SR2E.SceneBuilder.stepHint.${k}`), 'string'); }
    for (const k of ['npc', 'group', 'spirit', 'critter']) assert.equal(typeof key(`SR2E.SceneBuilder.gen.${k}`), 'string');
    for (const k of ['hostile', 'neutral', 'friendly']) assert.equal(typeof key(`SR2E.SceneBuilder.attitude.${k}`), 'string');
    for (const k of ['none', 'ready', 'roll']) assert.equal(typeof key(`SR2E.SceneBuilder.combat.${k}`), 'string');
    for (const k of ['none', 'view', 'activate']) assert.equal(typeof key(`SR2E.SceneBuilder.show.${k}`), 'string');
    for (const k of ['ward', 'manabarrier', 'astralbarrier', 'physicalbarrier']) assert.equal(typeof key(`SR2E.SceneBuilder.wardKind.${k}`), 'string');
    for (const k of ['normal', 'partial', 'minimal', 'darkness']) assert.equal(typeof key(`SR2E.SceneBuilder.light.${k}`), 'string');
    for (let t = 0; t <= 5; t++) assert.equal(typeof key(`SR2E.SceneBuilder.response${t}`), 'string');
    for (const b of BACKDROPS) for (const d of b.doors) assert.equal(typeof key(d.name), 'string', d.name);
    for (const b of BACKDROPS) { assert.equal(typeof key(b.labelKey), 'string', b.labelKey); assert.equal(typeof key(b.hintKey), 'string', b.hintKey); }
  });
  test('the tools window and toolbar have it, for the GM', () => {
    const t = TOOLS.find((x) => x.id === 'sceneBuilder');
    assert.ok(t);
    assert.equal(t!.who, 'gm');
    assert.equal(typeof key('SR2E.Tools.sceneBuilder.label'), 'string');
    assert.equal(typeof key('SR2E.Tools.sceneBuilder.hint'), 'string');
    assert.match(read('src', 'module', 'applications', 'tools.ts'), /sceneBuilder: \(\) => \{ if \(isGm\(\)\) openSceneBuilder\(\{ sceneId: '' \}\); \}/);
  });
  test('the GM panel\'s Scene tab opens it, new or on the viewed scene', () => {
    assert.match(read('public', 'templates', 'gm-panel.hbs'), /data-action="sceneBuilder"[\s\S]*data-action="sceneBuilderHere"/);
    assert.match(read('src', 'module', 'applications', 'ui.ts'), /sceneBuilderHere: \(\) =>/);
  });
  test('only the GM builds or removes, and one at a time', () => {
    assert.match(app, /async function build\([^)]*\)[^{]*\{\s*const g: any = game;\s*if \(!g\.user\?\.isGM\) throw/);
    assert.match(app, /export function removeBuiltScene[\s\S]{0,300}if \(!g\.user\?\.isGM\) throw/);
    assert.match(app, /function exclusive/);
    assert.match(app, /if \(!isGm\(\)\) \{ ui\.notifications\?\.warn\?\.\(tx\('SR2E\.SceneBuilder\.gmOnly'\)\); return null; \}/);
  });
  test('remove deletes only what it made (not copies), and only a built scene', () => {
    assert.match(app, /const madeFor = \(d: any, sceneId: string\): boolean => d\?\.flags\?\.\[SYSTEM\.id\]\?\.\[SB_FLAG\]\?\.sceneId === sceneId\s*&& !d\?\._stats\?\.duplicateSource && !d\?\._stats\?\.compendiumSource/);
    assert.match(app, /if \(!d\.scene \|\| !sceneFlag\(d\.scene\)\)/);
  });
  test('the generator\'s create context returns the actors and places no tokens of its own', () => {
    const gen = read('src', 'module', 'applications', 'npcgen.ts');
    assert.match(gen, /if \(ctx\.made\) ctx\.made\.push\(\.\.\.actors\);\s*if \(s\.tokens && !ctx\.made && actors\.length\) await placeTokens/);
    assert.match(gen, /export async function createFromPlan\(p: Plan, s: GenState, ctx: CreateContext = \{\}\)/);
  });
  test('the journal escapes the GM\'s notes', () => {
    assert.match(app, /<p>\$\{esc\(p\)\.replace/);
  });
});

describe('v0.91.7 review fixes', () => {
  const app = read('src', 'module', 'applications', 'scenebuilder.ts');
  test('#1: an existing scene\'s padding moves tokens, walls and regions onto its map', () => {
    const s = defaultSpec('real');
    const g = { ...geoOf(s), originX: 1000, originY: 700 };
    const z = zonesFor(s).pcs;
    for (const p of spotsInZone(4, z, g)) { assert.ok(p.x >= 1000 + z.x * 100 - 100 && p.x < 1000 + (z.x + z.w) * 100); assert.ok(p.y >= 700); }
    const b = backdropById('street')!;
    const d = backdropDocuments(b, g);
    assert.deepEqual(d.walls[0].c, [b.walls[0]![0] * 100 + 1000, b.walls[0]![1] * 100 + 700, b.walls[0]![2] * 100 + 1000, b.walls[0]![3] * 100 + 700]);
    if (b.lights[0]) assert.equal(d.lights[0].x, Math.round(b.lights[0].x * 100) + 1000);
    const r: any = rectRegionData({ x: 0, y: 0, w: 2, h: 2 }, g, { name: 'w', color: '#000000', flags: {} });
    assert.equal(r.shapes[0].x, 1000);
    assert.match(app, /export function geoOfScene/);
    assert.match(app, /sceneX/);
  });
  test('#2: a new scene on a built-in backdrop has its size; a changed scene keeps its own; walls only at that size', () => {
    const b = backdropById('street')!;
    assert.equal(normalizeSpec({ ...defaultSpec('real'), width: 20 }).width, b.width);
    assert.equal(normalizeSpec({ ...defaultSpec('real'), width: 20, keepSize: true }).width, 20);
    assert.equal(normalizeSpec({ ...defaultSpec('real'), backdrop: '', width: 20 }).width, 20);
    assert.match(app, /geo\.width === b\.width && geo\.height === b\.height/);
    assert.equal(templateOf('t', 'x', { ...defaultSpec('real'), keepSize: true }).spec.keepSize, false);
  });
  test('#3: a Matrix scene being changed needs no new host, and its host gets no second token', () => {
    const m = { ...switchKind({ ...defaultSpec('real'), name: 'ZZ' }, 'matrix'), host: { mode: 'none' as const, uuid: '', threat: 2, corporation: true } };
    assert.equal(specProblems(m, { edit: true }).length, 0);
    assert.match(app, /const hostToken = spec\.kind === 'matrix' && host && !onScene\.has\(host\.uuid\)/);
  });
  test('#4: every "new scene" entry opens a new scene (not the last one built)', () => {
    assert.match(read('src', 'module', 'applications', 'ui.ts'), /sceneBuilder: \(\) => \{ openSceneBuilder\(\{ sceneId: '' \}\); \}/);
    assert.match(app, /openSceneBuilder\(\{ sceneId: '' \}\); \}\);/);
  });
  test('#5: remove deletes only the combat it made, and counts the tokens elsewhere', () => {
    assert.match(app, /combats: \[\.\.\.\(g\.combats \?\? \[\]\)\]\.filter\(\(c: any\) => madeFor\(c, sceneId\)\)/);
    assert.match(app, /C\.create\(\{ scene: sceneId, active: false, flags: tag \}\)/);
    assert.match(app, /removeTokensAsk/);
  });
  test('#6: changing a scene writes only what changed', () => {
    assert.match(app, /const changed = \(k: keyof SceneSpec\) =>/);
    assert.doesNotMatch(app, /\[`flags\.\$\{SYSTEM\.id\}`\]: \{ \.\.\.sceneFlags\(spec\)/);
  });
  test('#7: doors and tokens are matched by a tag, not by their order', () => {
    assert.match(app, /\[SB_FLAG\]: \{ door: i \}/);
    assert.match(app, /\[SB_FLAG\]: \{ row: gi \}/);
    assert.match(app, /principal/);
  });
  test('#9: switching kinds drops the old backdrop\'s environment', () => {
    const st = defaultSpec('real');
    assert.equal(st.environment, backdropById('street')!.environment);
    assert.equal(switchKind(st, 'astral').environment, backdropById('astral')!.environment);
  });
  test('#11: critters count as one token; a crowd stays inside its zone', () => {
    assert.equal(tokenCount({ ...defaultSpec('real'), people: [{ ...defaultRow('generate'), kind: 'critter', count: 6 }] }), 1);
    const s = { ...defaultSpec('real'), gridDistance: 2 };
    const z = { x: 2, y: 2, w: 4, h: 4 };
    const spots = spotsInZone(30, z, s);
    const px = s.grid / s.gridDistance;
    for (const p of spots) { assert.ok(p.x >= z.x * px && p.x < (z.x + z.w) * px, `x ${p.x}`); assert.ok(p.y >= z.y * px && p.y < (z.y + z.h) * px, `y ${p.y}`); }
  });
  test('#12: journal links carry no label to break', () => {
    assert.match(app, /<li>@UUID\[\$\{esc\(a\.uuid\)\}\]<\/li>/);
  });
});

describe('v0.91.7 live-run fixes', () => {
  test('a short spec (the API) takes the kind\'s and the backdrop\'s defaults for what it leaves out', () => {
    const s = normalizeSpec({ name: 'ZZ', backdrop: 'street' });
    const b = backdropById('street')!;
    assert.equal(s.terrain, b.terrain);
    assert.equal(s.environment, b.environment);
    assert.equal(s.hour, 22);
    assert.equal(s.walls, true);
    assert.equal(normalizeSpec({ name: 'ZZ', backdrop: 'street', terrain: '', hour: null }).terrain, '');
    assert.equal(normalizeSpec({ name: 'ZZ', backdrop: 'street', hour: null }).hour, null);
    assert.equal(normalizeSpec({ kind: 'matrix' }).darkness, 0);
  });
  test('player characters\' tokens are friendly', () => {
    assert.match(read('src', 'module', 'applications', 'scenebuilder.ts'), /actorLink: true, hidden: false, disposition: 1/);
  });
});

describe('v0.91.7 one look for module windows (Monk\'s Enhanced Journal)', async () => {
  const { mejDarkChanges, MEJ_DARK } = await import('../applications/modules.ts');
  const all = { 'background-colour': ['none', 'black', 'red'], 'background-image': ['none', 'solidBlack', 'parchment'], 'sidebar-image': ['none', 'solidBlack'] };
  test('settings still at Monk\'s default get its dark choices', () => {
    assert.deepEqual(mejDarkChanges({ 'background-colour': 'none', 'background-image': 'none', 'sidebar-image': 'none' }, all), { ...MEJ_DARK });
  });
  test('a user\'s own choice is kept', () => {
    assert.deepEqual(mejDarkChanges({ 'background-colour': 'red', 'background-image': 'parchment', 'sidebar-image': 'none' }, all), { 'sidebar-image': 'solidBlack' });
  });
  test('a setting Monk\'s no longer has, or a choice it no longer offers, is left alone', () => {
    assert.deepEqual(mejDarkChanges({}, { 'background-colour': null, 'background-image': ['none', 'parchment'], 'sidebar-image': ['none', 'solidBlack'] }), { 'sidebar-image': 'solidBlack' });
  });
  test('once per user, only when Foundry is dark and Monk\'s is active, with a GM switch', () => {
    const src = read('src', 'module', 'applications', 'modules.ts');
    assert.match(src, /if \(!on \|\| !g\.modules\?\.get\?\.\(MEJ_ID\)\?\.active \|\| !foundryDark\(\)\) return \{\};/);
    assert.match(src, /if \(done\?\.\[MEJ_ID\]\) return \{\};/);
    const set = read('src', 'module', 'settings.ts');
    assert.match(set, /"moduleSupportLook", \{[\s\S]{0,200}scope: "world", config: true, type: Boolean, default: true/);
    assert.match(set, /"moduleLookDone", \{ scope: "client", config: false/);
    assert.equal(typeof key('SR2E.Settings.moduleSupportLook.Name'), 'string');
  });
});
