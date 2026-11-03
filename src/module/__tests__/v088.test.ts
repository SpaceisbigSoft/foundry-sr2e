/**
 * v0.88.0: the starter demo (rules/demo.ts, applications/demo.ts): the same demo every time, generic names, the
 * journal's text escaped, the scene's layout inside the scene, and the GM panel's buttons.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { join } from 'node:path';
import { demoPlan, demoPages, runnerName, runnerActorData, gangerActorData, demoSiteSystem, DEMO_DOOR_LOCKED, DEMO_SCENE, DEMO_SPOTS, DEMO_WALLS, DEMO_DOOR, DEMO_LIGHTS, DEMO_DRAWINGS, DEMO_FLAG } from '../rules/demo.ts';
import { readEnglish } from './helpers/english.ts';

// v0.89.0: templates are read back in English (their text is in lang/en.json).
const read = (...p: string[]) => readEnglish(join(process.cwd(), ...p));

describe('v0.88.0 the starter demo (pure)', () => {
  test('the same demo every time: four runners, a gang, a corporation, a car and a drone', () => {
    const a = demoPlan();
    const b = demoPlan();
    assert.deepEqual(a.runners.map((r) => r.plan.name), b.runners.map((r) => r.plan.name));
    assert.equal(a.gang.name, b.gang.name);
    assert.deepEqual(a.runners.map((r) => r.label), ['Street samurai', 'Mage', 'Decker', 'Rigger']);
    assert.ok(a.runners[1]!.plan.spells.length > 0, 'the mage has spells');
    assert.ok(a.runners[2]!.plan.deck, 'the decker has a deck');
    assert.ok(a.runners[3]!.plan.controlRig, 'the rigger has a control rig');
    assert.equal(a.car.drone, false);
    assert.equal(a.drone.drone, true);
    assert.ok(a.gang.leader && a.gang.grunts.length >= 3);
    assert.ok(a.org.corporation);
    assert.notEqual(demoPlan(1).runners[0]!.plan.name + demoPlan(1).gang.name, a.runners[0]!.plan.name + a.gang.name, 'the seed matters');
  });

  test('runner names and the journal: escaped, every page there', () => {
    assert.equal(runnerName({ streetName: 'Rook', name: 'Jo Rook' } as any, 'Mage'), 'Rook (Mage)');
    assert.equal(runnerName({ streetName: '', name: 'Jo' } as any, 'Mage'), 'Jo (Mage)');
    const pages = demoPages({ runners: ['<b>A</b>', 'B', 'C', 'D'], gang: 'G&G', leader: 'L', host: 'H<x>', site: 'S', safehouse: 'F', car: 'Car', drone: 'Drone', scene: 'Sc' });
    assert.deepEqual(pages.map((p) => p.name), ['Start here', 'A fight', 'A spell', 'The Matrix', 'Rigging and a chase', 'Security and the safehouse', 'Printing and reporting']);
    const all = pages.map((p) => p.html).join('');
    assert.ok(all.includes('&lt;b&gt;A&lt;/b&gt;') && all.includes('G&amp;G') && all.includes('H&lt;x&gt;'));
    assert.ok(!all.includes('<b>A</b>') && !/<script/i.test(all));
    assert.ok(all.includes('Remove the demo'));
  });

  test('the scene: everything inside it, the door in the building\'s west wall', () => {
    const inside = (x: number, y: number) => x >= 0 && y >= 0 && x <= DEMO_SCENE.width && y <= DEMO_SCENE.height;
    for (const p of [...DEMO_SPOTS.runners, ...DEMO_SPOTS.gang, DEMO_SPOTS.car, DEMO_SPOTS.drone, ...DEMO_LIGHTS]) assert.ok(inside(p.x, p.y), JSON.stringify(p));
    for (const [x1, y1, x2, y2] of [...DEMO_WALLS, DEMO_DOOR]) assert.ok(inside(x1, y1) && inside(x2, y2));
    for (const d of DEMO_DRAWINGS) assert.ok(inside(d.x, d.y) && inside(d.x + d.w, d.y + d.h), d.text);
    assert.equal(DEMO_DOOR[0], DEMO_DOOR[2], 'a vertical door');
    // The door fills a gap: no wall on the same line overlaps it.
    const [dx, dy1, , dy2] = DEMO_DOOR;
    const overlaps = DEMO_WALLS.filter(([x1, y1, x2, y2]) => x1 === dx && x2 === dx && Math.max(Math.min(y1, y2), dy1) < Math.min(Math.max(y1, y2), dy2));
    assert.deepEqual(overlaps, [], 'the door is a gap, not on top of a wall');
    assert.ok(DEMO_WALLS.some(([x1, y1, x2]) => x1 === dx && x2 === dx && y1 === dy1) || DEMO_WALLS.some(([x1, , x2, y2]) => x1 === dx && x2 === dx && y2 === dy1), 'a wall meets the door');
    assert.equal(DEMO_SPOTS.runners.length, 4);
  });
});

describe('v0.88.0 review fixes', () => {
  test('runners: characters with a Karma Pool, no NPC ratings; gangers: unlinked NPCs', () => {
    const d = demoPlan();
    for (const { plan, label } of d.runners) {
      const a = runnerActorData(plan, label);
      assert.equal(a.type, 'character');
      assert.ok(a.system['karma'].pool >= 1, 'a Karma Pool to spend');
      assert.equal(a.system['professionalRating'], 0);
      assert.equal(a.system['threatRating'], 0);
      assert.equal(a.system['grunts'].size, 1);
      assert.equal(a.prototypeToken['actorLink'], true);
      assert.ok(a.items.length > 0);
    }
    const g = gangerActorData(d.gang.leader, d.gang.name, true);
    assert.equal(g.type, 'npc');
    assert.ok(g.name.endsWith(', leader)'));
    assert.equal(g.prototypeToken['actorLink'], false);
  });
  test('the site: a locked keypad maglock on the door, steps that raise the alert, a response', async () => {
    assert.equal(DEMO_DOOR_LOCKED, 2);
    const s: any = demoSiteSystem({ hostUuid: 'H', sceneId: 'S', wallId: 'W' });
    const lock = s.devices.find((x: any) => x.kind === 'maglock');
    assert.deepEqual([lock.sceneId, lock.wallId, lock.lockType], ['S', 'W', 'keypad']);
    const { siteTally } = await import('../rules/security.ts');
    assert.equal(siteTally({ tally: 0, add: 3, alert: 'none', steps: s.steps }).alert, 'passive');
    assert.equal(siteTally({ tally: 3, add: 3, alert: 'passive', steps: s.steps }).alert, 'active');
    assert.ok(s.response.force);
    const { RULES } = await import('../rules/index.ts');
    for (const st of s.steps) assert.ok(RULES.SECURITY.alerts.includes(st.alert), st.alert);
    assert.ok(RULES.SECURITY_V57.lockTypes.some((l: any) => l.id === 'keypad'));
  });
  test('Remove: only flagged documents that aren\'t copies', async () => {
    (globalThis as any).foundry ??= {};
    const { isDemo } = await import('../applications/demo.ts');
    assert.equal(isDemo({ flags: { sr2e: { demo: true } }, _stats: {} }), true);
    assert.equal(isDemo({ flags: { sr2e: { demo: true } }, _stats: { duplicateSource: 'Actor.x' } }), false);
    assert.equal(isDemo({ flags: { sr2e: { demo: true } }, _stats: { compendiumSource: 'Compendium.y' } }), false);
    assert.equal(isDemo({ flags: { sr2e: {} } }), false);
    assert.equal(isDemo(null), false);
  });
});

describe('v0.88.0 wiring', () => {
  test('the glue: flags, folders, no padding, removal by the flag only, GM only', () => {
    const src = read('src', 'module', 'applications', 'demo.ts');
    assert.equal(DEMO_FLAG, 'demo');
    assert.ok(src.includes("if (!g.user?.isGM) return tx('SR2E.App.Demo.onlyTheGmCanCreateThe');"));
    assert.ok(src.includes("if (!g.user?.isGM) return tx('SR2E.App.Demo.onlyTheGmCanRemoveThe');"));
    assert.ok(src.includes('padding: 0,'));
    assert.ok(src.includes("export const isDemo = (d: any): boolean =>"));
    assert.ok(src.includes('runnerActorData(p, label)'), 'the runners are characters (rules/demo.ts)');
    assert.ok(src.includes('ds: DEMO_DOOR_LOCKED'), 'the door starts locked');
    assert.ok(src.includes('return exclusive(buildDemo);'), 'one at a time');
    assert.ok(src.includes('DialogV2.confirm'), 'removal asks first');
  });
  test('the GM panel and the API', () => {
    const hbs = read('public', 'templates', 'gm-panel.hbs');
    assert.ok(hbs.includes('data-action="demoCreate"') && hbs.includes('data-action="demoRemove"') && hbs.includes('<h2>Starter demo</h2>'));
    const setup = read('src', 'module', 'applications', 'setup.ts');
    assert.ok(setup.includes('demoCreate: () =>') && setup.includes('demo: { exists: demoExists() }'));
    assert.ok(read('src', 'module', 'sr2e-system.ts').includes('createDemo, removeDemo,'));
    assert.ok(read('src', 'module', 'rules', 'guide.ts').includes("'Starter demo'"));
  });
});
