/**
 * v0.68.0: the second interface pass, player side. Glue checks with small stubs (the rendering itself is
 * checked in the live run): the status strip's context, the layout setting, template guards (the strip,
 * the stuck block, the combat column, the layout class, the same section order on every sheet, empty
 * lists that say how to add), the wiring in sheets.ts, the roll memory markers and the stylesheet.
 */
import { test, describe, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { join } from 'node:path';
import { readEnglish } from './helpers/english.ts';

const g = globalThis as any;
// v0.89.0: templates are read back in English (their text is in lang/en.json).
const read = (...p: string[]) => readEnglish(join(process.cwd(), ...p));
let ui: typeof import('../applications/interface.ts');
let settings: Record<string, unknown> = {};

before(async () => {
  g.foundry = { applications: { api: { DialogV2: class {} }, instances: new Map() } };
  g.game = {
    settings: { get: (_ns: string, k: string) => { if (!(k in settings)) throw new Error(`not registered: ${k}`); return settings[k]; }, register: () => {} },
    user: { id: 'u1', isGM: false }, combat: null,
  };
  g.Hooks = { on: () => {}, once: () => {} };
  ui = await import('../applications/interface.ts');
});
beforeEach(() => { settings = {}; g.game.combat = null; });

function actorStub(o: any = {}): any {
  const items = o.items ?? [];
  return {
    uuid: 'Actor.a1', id: 'a1', type: o.type ?? 'character', items: Object.assign([...items], { get: (id: string) => items.find((i: any) => i.id === id) }),
    system: { derived: { woundModifier: 1, status: 'ok', reaction: 6, initiativeDice: 2, ...(o.derived ?? {}) }, care: {} },
    flags: { sr2e: o.flags ?? {} },
    getFlag(_ns: string, k: string) { return this.flags.sr2e[k]; },
    isActing: () => Boolean(o.acting), actionsUsed: () => o.used ?? 0,
  };
}

describe('the status strip context', () => {
  test('out of combat: Reaction + dice, pools with pips, the readied weapon and its mode', () => {
    const gun = { id: 'g1', name: 'Ares Predator', type: 'weapon', system: { melee: false, ammo: 10, ammoMax: 15, modes: 'SA', ready: true } };
    const knife = { id: 'k1', name: 'Knife', type: 'weapon', system: { melee: true, ready: true } };
    const s = ui.stripContext(actorStub({ items: [knife, gun] }), [{ key: 'combat', label: 'Combat', left: 2, total: 5 }, { key: 'karma', label: 'Karma', left: 0, total: 0 }]);
    // v0.71.0 (R15): the strip shows what the combatant rolls: Reaction 6 less the +1 wound's initiative penalty.
    assert.equal(s.init, '5 + 2d6');
    assert.equal(s.wound, '+1');
    assert.equal(s.pools.length, 1);
    assert.deepEqual(s.pools[0].pips.map((p: any) => p.filled), [true, true, false, false, false]);
    assert.equal(s.weapon.name, 'Ares Predator');
    assert.equal(s.weapon.mode, 'SA');
    assert.equal(s.weapon.ammo, '10/15');
    assert.equal(s.turn, null);
  });
  test('the weapon used last wins, with its remembered mode', () => {
    const gun = { id: 'g1', name: 'Uzi', type: 'weapon', system: { melee: false, ammo: 5, ammoMax: 24, modes: 'SA/BF/FA', ready: true } };
    const knife = { id: 'k1', name: 'Knife', type: 'weapon', system: { melee: true, ready: true } };
    const s = ui.stripContext(actorStub({ items: [gun, knife], flags: { lastWeapon: 'k1' } }), []);
    assert.equal(s.weapon.name, 'Knife');
    assert.equal(s.weapon.mode, 'melee');
    const s2 = ui.stripContext(actorStub({ items: [gun, knife], flags: { attackPrefs: { g1: { mode: 'FA' } } } }), []);
    assert.equal(s2.weapon.mode, 'FA');
  });
  test('in combat and acting: initiative this pass and your turn', () => {
    const a = actorStub({ acting: true, used: 1 });
    g.game.combat = { started: true, combatants: [{ actor: a, initiative: 13 }] };
    const s = ui.stripContext(a, []);
    assert.equal(s.init, '13');
    assert.equal(s.turn.label, '1 simple');
  });
  test('the layout setting: per player, Tabs when unset, only for people sheets', () => {
    assert.equal(ui.currentLayout('character'), 'tabs');
    settings['sheetLayout'] = 'compact';
    assert.equal(ui.currentLayout('npc'), 'compact');
    assert.equal(ui.currentLayout('vehicle'), 'tabs');
    settings['sheetLayout'] = 'weird';
    assert.equal(ui.currentLayout('character'), 'tabs');
  });
  test('the roll memory marker escapes its key', () => {
    const m = ui.rememberMarker('cast|Actor.a"1|x', ['force', 'pool']);
    assert.match(m, /data-sr2e-remember="cast\|Actor\.a&quot;1\|x"/);
    assert.match(m, /data-fields="force,pool"/);
    assert.match(m, /^<span hidden /);
  });
});

describe('templates', () => {
  const tpl = (f: string) => read('public', 'templates', f);
  test('the strip and the tabs stick together; the combat column only in its layout; the layout class on the root', () => {
    for (const f of ['actor-character-sheet.hbs', 'actor-npc-sheet.hbs', 'actor-spirit-sheet.hbs']) {
      const t = tpl(f);
      assert.match(t, /<div class="sr2e-sheet[^"]* sr2e-layout-\{\{layout\}\}">/, f);
      assert.ok(t.includes('<div class="sr2e-stuck">\n    {{> "systems/sr2e/templates/status-strip.hbs"}}'), f);
      assert.ok(t.includes('{{#if (eq layout "combat")}}{{> "systems/sr2e/templates/combat-column.hbs"}}{{/if}}'), f);
    }
    const c = tpl('actor-character-sheet.hbs');
    const stuck = c.slice(c.indexOf('<div class="sr2e-stuck">'), c.indexOf('</div>', c.indexOf('</nav>')));
    assert.ok(stuck.includes('<nav class="sheet-tabs tabs sr2e-tabs" data-group="primary">'));
    assert.ok(stuck.includes('<i class="{{icon}}" aria-hidden="true"></i> {{label}}'));
  });
  test('the strip shows the monitor, wounds, initiative, pools with pips, the readied weapon and your turn', () => {
    const s = tpl('status-strip.hbs');
    for (const want of ['monitor-mini.hbs', 'strip.wound', 'strip.init', 'data-action="setPool"', 'data-action="attackWeapon" data-item-id="{{strip.weapon.id}}"', 'strip.turn.label', 'sr2e-act-pip']) assert.ok(s.includes(want), want);
  });
  test('the summary no longer repeats what the strip shows', () => {
    const s = tpl('sheet-summary.hbs');
    assert.ok(!s.includes('monitor-mini.hbs') && !s.includes('summary.initiative') && !s.includes('data-action="setPool"'));
    assert.ok(s.includes('sr2e-quickbar') && s.includes('sr2e-pinbar') && s.includes('details class="sr2e-setup"'));
  });
  test('the combat column: defense, weapons with modes, spells, quick actions', () => {
    const s = tpl('combat-column.hbs');
    for (const want of ['data-action="resistDamage"', 'data-action="fullDefense"', 'data-action="attackWeapon" data-item-id="{{../id}}" data-mode="{{this}}"', 'data-action="reloadWeapon"', 'data-action="castSpell"', '{{#each quickActions}}', 'data-item-id="unarmed"']) assert.ok(s.includes(want), want);
  });
  test('the same section order: skills, weapons, magic, spells and powers, gear', () => {
    const npc = tpl('actor-npc-sheet.hbs');
    const at = (x: string) => npc.indexOf(x);
    assert.ok(at('<h2>Skills') < at('<h2>Weapons') && at('<h2>Weapons') < at('<section class="sr2e-magic">') && at('<section class="sr2e-magic">') < at('<section class="sr2e-conjuring">')
      && at('<section class="sr2e-conjuring">') < at('<h2>Spells') && at('<h2>Spells') < at('<h2>Powers') && at('<h2>Powers') < at('<h2>Other gear'));
    const sp = tpl('actor-spirit-sheet.hbs');
    assert.ok(sp.indexOf('<h2>Skills') < sp.indexOf('Attacks <a') && sp.indexOf('Attacks <a') < sp.indexOf('<h2>Powers'));
  });
  test('empty lists say how to add', () => {
    const c = tpl('actor-character-sheet.hbs');
    for (const want of ['No geasa: press', 'No foci: press', 'No adept powers: press', 'No contacts yet: press', 'No edges or flaws: press']) assert.ok(c.includes(want), want);
    assert.ok(tpl('matrix-section.hbs').includes('No cyberdeck: press') && tpl('matrix-section.hbs').includes('No programs: press'));
    assert.ok(tpl('actor-spirit-sheet.hbs').includes('No attacks: press') && tpl('actor-spirit-sheet.hbs').includes('No powers: press'));
    assert.ok(tpl('actor-npc-sheet.hbs').includes('No spells: press') && tpl('actor-npc-sheet.hbs').includes('None: press <i class="fa-solid fa-plus"></i> to add armor'));
    assert.ok(tpl('actor-vehicle-sheet.hbs').includes('Nothing loaded: press'));
  });
  test('the monitor: keyboard boxes and − / + on Physical and Stun only', () => {
    const t = tpl('monitor-track.hbs');
    assert.ok(t.includes('tabindex="0" role="button" data-action="{{../../action}}"'));
    assert.ok(t.includes('{{#if step}}') && t.includes('data-action="stepMonitor"'));
    const m = tpl('monitor.hbs');
    assert.equal((m.match(/step=true/g) ?? []).length, 2);
    assert.ok(!tpl('matrix-section.hbs').includes('step=true'));
  });
  test('GM-only parts are marked', () => {
    assert.ok(tpl('actor-character-sheet.hbs').includes('class="sr2e-gm-only" data-action="recognition"'));
    assert.ok(tpl('item-sheet.hbs').includes('sr2e-template sr2e-gm-only'));
  });
  test('every new partial is loaded', () => {
    const sys = read('src', 'module', 'sr2e-system.ts');
    for (const p of ['status-strip.hbs', 'combat-column.hbs']) assert.ok(sys.includes(`/${p}\``), p);
    assert.ok(sys.includes('registerInterfaceSettings();') && sys.includes('registerInterface();'));
  });
});

describe('wiring', () => {
  const sheets = read('src', 'module', 'applications', 'sheets.ts');
  test('the sheets build the strip from the summary\'s pools and run the interface after the tools', () => {
    assert.ok(sheets.includes('strip: stripContext(actor, summary.pools)'));
    assert.ok(sheets.includes('layout: currentLayout(actor.type)'));
    assert.equal((sheets.match(/decorateSheet\(this\);\n\s+\/\/ v0\.68\.0[^\n]*\n\s+decorateInterface\(this\);|decorateSheet\(this\);\n\s+decorateInterface\(this\);/g) ?? []).length, 2);
    assert.ok(sheets.includes('stepMonitor: SR2CharacterSheet.#onStepMonitor'));
  });
  test('an attack remembers the weapon used last, in the same update as its choices', () => {
    assert.ok(sheets.includes('[`flags.${SYSTEM.id}.lastWeapon`]: weapon.id'));
  });
  test('roll dialogs that remember their choices (never the TN)', () => {
    const marks = [...sheets.matchAll(/rememberMarker\(`([a-z]+)\|[^`]*`, (\[[^\]]*\]|skillRollMemoryFields\(\))\)/g)].map((m) => [m[1], m[2]]);
    assert.deepEqual(marks.map((m) => m[0]).sort(), ['cast', 'cyber', 'skill', 'summon']);
    for (const [, fields] of marks) assert.ok(!/"tn"|"mod"|"target"/.test(fields!), fields);
  });
  test('the toolbar sits after the stuck block; a jump link opens a compact section', () => {
    assert.ok(read('src', 'module', 'applications', 'sheettools.ts').includes("body.querySelector(':scope > .sr2e-stuck') ?? body.querySelector(':scope > .sr2e-tabs')"));
    assert.ok(read('src', 'module', 'applications', 'adding.ts').includes('openCompactTab(root, tab);'));
  });
  test('the house rules window re-renders open windows from the v14 Map', () => {
    const s = read('src', 'module', 'settings.ts');
    assert.ok(s.includes('inst?.values ? [...inst.values()]'));
    assert.ok(s.includes('class="sr2e-hr-find"') && s.includes('settingMatches('));
  });
});

describe('the stylesheet', () => {
  const css = read('public', 'style', 'sr2e.css');
  const part = css.slice(css.indexOf('v0.68.0: the second interface pass (our windows only)'));
  test('the v0.68.0 rules use the palette only (no hard-coded colours, no fades)', () => {
    const bare = part.replace(/\/\*[\s\S]*?\*\//g, '');
    assert.ok(part.length > 1000);
    assert.ok(!/#[0-9a-f]{3,8}\b|rgba?\(|hsl\(/i.test(bare));
    assert.ok(!/opacity:\s*0?\.\d/.test(bare));
  });
  test('layouts, the stuck block, roll dialogs and steppers are styled', () => {
    for (const want of ['.sr2e-sheet.sr2e-layout-combat > .sr2e-combat-col { float: right', '.sr2e-sheet.sr2e-layout-compact > section.tab.sr2e-tab', '.sr2e-sheet > .sr2e-stuck', '.sr2e-roll-grid', 'button.sr2e-roll-go', '.sr2e-stepper', ':is(button, a).sr2e-cant', '.sr2e-gm-only', '@container sr2esheet', '@container sr2eroll']) assert.ok(part.includes(want), want);
  });
});

describe('review fixes', () => {
  const src = read('src', 'module', 'applications', 'interface.ts');
  test('remembered choices: not on a Shift-click quick roll, not on Cancel', () => {
    assert.ok(src.includes("!quickRollArmed(app)) rollMemory(form, marker, ok)"));
    assert.ok(src.includes('if (!by || by === okButton) keep();'));
    assert.ok(read('src', 'module', 'applications', 'hotkeys.ts').includes('if (app) app._sr2eQuick = true;'));
  });
  test('windows with counted ids keep only their kind\'s size', () => {
    assert.ok(src.includes("/^app-\\d+$/.test(id)"));
  });
  test('a combat change re-renders only who stops and starts acting, never a sheet being typed in', () => {
    assert.ok(src.includes("acting.set(combat.id, now);") && src.includes("prose-mirror.active"));
  });
  test('the summon dialog caps restored pool dice', () => {
    assert.ok(read('src', 'module', 'applications', 'sheets.ts').includes('<input name="drainPool" type="number" value="0" min="0" max="${escHtml(actor.system.derived.spellPoolLeft)}">'));
  });
  test('the Combat column floats and sticks (a grid would keep the strip from sticking)', () => {
    const css = read('public', 'style', 'sr2e.css');
    assert.ok(!/sr2e-layout-combat \{[^}]*display: grid/.test(css));
  });
});

describe('live-run fixes', () => {
  test('the Combat column layout hides the summary\'s quick bar (the column has it); the tool bar wraps', () => {
    const css = read('public', 'style', 'sr2e.css');
    assert.ok(css.includes('.sr2e-sheet.sr2e-layout-combat > .sr2e-summary > .sr2e-quickbar { display: none; }'));
    assert.ok(css.includes('.application.sr2e-look .sr2e-sheet-tools { flex-wrap: wrap; }'));
  });
  test('the Roll button always shows the dice icon', () => {
    assert.ok(read('src', 'module', 'applications', 'interface.ts').includes("if (icon) icon.className = 'fa-solid fa-dice';"));
  });
});

