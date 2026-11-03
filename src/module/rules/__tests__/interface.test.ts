/** v0.68.0: the second interface pass, pure parts. */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  RULES, LAYOUTS, normalizeLayout, layoutFor, compactFoldKey, compactFolded, sectionIcon, tabIcon, TAB_ICONS, statusStrip, readiedWeapon,
  attackKind, buttonCost, affordable, BUTTON_ACTION_KINDS, memoryFields, rememberRoll, restoredNumber, ROLL_MEMORY_MAX, stepValue,
  groupNotes, repeatedText, rememberWindow, placeWindow, emptyWinMemory, WINDOW_MEMORY_MAX, settingSection, settingMatches,
} from '../index.ts';

describe('layouts', () => {
  test('three layouts; anything else is Tabs', () => {
    assert.deepEqual([...LAYOUTS], ['tabs', 'combat', 'compact']);
    assert.equal(normalizeLayout('combat'), 'combat');
    assert.equal(normalizeLayout('x'), 'tabs');
    assert.equal(normalizeLayout(undefined), 'tabs');
  });
  test('only character, NPC and spirit sheets take a layout', () => {
    assert.equal(layoutFor('character', 'compact'), 'compact');
    assert.equal(layoutFor('npc', 'combat'), 'combat');
    assert.equal(layoutFor('spirit', 'combat'), 'combat');
    assert.equal(layoutFor('vehicle', 'compact'), 'tabs');
    assert.equal(layoutFor('host', 'combat'), 'tabs');
  });
  test('compact: Main and Combat open by default, the player\'s choice wins', () => {
    const k = compactFoldKey('character', 'gear');
    assert.equal(k, 'character:gear');
    assert.equal(compactFolded('main', 'character:main', {}), false);
    assert.equal(compactFolded('combat', 'character:combat', null), false);
    assert.equal(compactFolded('gear', k, {}), true);
    assert.equal(compactFolded('gear', k, { [k]: false }), false);
    assert.equal(compactFolded('main', 'character:main', { 'character:main': true }), true);
  });
});

describe('icons', () => {
  test('the same heading gets the same icon on every sheet', () => {
    assert.equal(sectionIcon('Skills'), sectionIcon('Active skills'));
    assert.equal(sectionIcon('Weapons'), sectionIcon('Attacks'));
    assert.equal(sectionIcon('Gear'), sectionIcon('Other gear'));
    assert.equal(sectionIcon('Adept powers'), 'fa-solid fa-hand-fist');
    assert.equal(sectionIcon('Powers'), 'fa-solid fa-bolt');
    assert.equal(sectionIcon('Conjuring 4'), 'fa-solid fa-ghost');
    assert.equal(sectionIcon('Cyberware'), 'fa-solid fa-microchip');
    assert.equal(sectionIcon('Something odd'), '');
    assert.equal(sectionIcon(''), '');
  });
  test('every tab has an icon', () => {
    for (const t of ['main', 'current', 'combat', 'effects', 'magic', 'matrix', 'rigging', 'gear', 'upkeep', 'creation', 'bio']) assert.ok(TAB_ICONS[t], t);
    assert.equal(tabIcon('nope'), 'fa-solid fa-circle');
  });
});

describe('the status strip', () => {
  const base = { wound: 0, status: 'ok', initiative: null, reaction: 5, initiativeDice: 2, pools: [], karmaPool: null, weapon: null, acting: false, actionsUsed: 0, enforce: 'warn' };
  test('initiative: this pass in combat, else Reaction + dice', () => {
    assert.equal(statusStrip(base).init, '5 + 2d6');
    assert.equal(statusStrip({ ...base, initiative: 14 }).init, '14');
    assert.equal(statusStrip({ ...base, initiative: 0 }).init, '0');
  });
  test('wounds and status', () => {
    const s = statusStrip({ ...base, wound: 2, status: 'dying', stabilised: true });
    assert.equal(s.wound, '+2');
    assert.equal(s.status, 'Dying (stabilised)');
    assert.equal(s.danger, true);
    assert.equal(statusStrip(base).status, '');
    assert.equal(statusStrip(base).wound, '');
  });
  test('pools: empty ones out, short names, empty marked', () => {
    const s = statusStrip({ ...base, pools: [{ key: 'combat', label: 'Combat', left: 0, total: 6 }, { key: 'spell', label: 'Spell', left: 3, total: 4 }, { key: 'hacking', label: 'Hacking', left: 0, total: 0 }, { key: 'karma', label: 'Karma', left: 2, total: 3 }] });
    assert.deepEqual(s.pools.map((p: any) => [p.short, p.empty]), [['C', true], ['Sp', false], ['KP', false]]);
  });
  test('the weapon: mode, ammo, low and out', () => {
    const w = { id: 'w', name: 'Ares Predator', melee: false, ammo: 2, ammoMax: 15, mode: 'SA', jammed: false, ready: true };
    const s = statusStrip({ ...base, weapon: w });
    assert.equal(s.weapon!.ammo, '2/15');
    assert.equal(s.weapon!.low, true);
    assert.equal(s.weapon!.out, false);
    assert.equal(statusStrip({ ...base, weapon: { ...w, ammo: 0 } }).weapon!.out, true);
    assert.equal(statusStrip({ ...base, weapon: { ...w, melee: true, ammoMax: 0 } }).weapon!.mode, 'melee');
    assert.equal(statusStrip({ ...base, weapon: { ...w, ready: false } }).weapon!.holstered, true);
  });
  test('your turn: actions left this phase', () => {
    assert.equal(statusStrip(base).turn, null);
    const t = statusStrip({ ...base, acting: true }).turn!;
    assert.equal(t.left, RULES.ACTIONS.perPhase);
    assert.equal(t.label, '1 complex or 2 simple');
    assert.equal(t.pips.filter((p) => p.on).length, 2);
    assert.equal(statusStrip({ ...base, acting: true, actionsUsed: 1 }).turn!.label, '1 simple');
    assert.equal(statusStrip({ ...base, acting: true, actionsUsed: 2 }).turn!.label, 'free actions only');
    assert.deepEqual(statusStrip({ ...base, acting: true, enforce: 'off' }).turn!.pips, []);
  });
  test('the readied weapon: last used, then pinned, then a ready gun with ammo, then ready, then the first', () => {
    const ws = [
      { id: 'knife', ready: true, melee: true, ammoMax: 0 },
      { id: 'holster', ready: false, melee: false, ammoMax: 10 },
      { id: 'gun', ready: true, melee: false, ammoMax: 10 },
    ];
    assert.equal(readiedWeapon(ws, { last: 'holster' })!.id, 'holster');
    assert.equal(readiedWeapon(ws, { last: 'gone', pins: ['x', 'knife'] })!.id, 'knife');
    assert.equal(readiedWeapon(ws)!.id, 'gun');
    assert.equal(readiedWeapon([ws[0]!, ws[1]!])!.id, 'knife');
    assert.equal(readiedWeapon([ws[1]!])!.id, 'holster');
    assert.equal(readiedWeapon([]), null);
  });
});

describe('your turn: what a button costs', () => {
  test('attacks by weapon and mode, as attackWeapon spends them', () => {
    assert.equal(attackKind({ melee: true }), 'melee');
    assert.equal(attackKind({ blast: true }), 'throw');
    assert.equal(attackKind({ mode: 'FA' }), 'fire:FA');
    assert.equal(attackKind({ modes: ['BF'] }), 'fire:BF');
    assert.equal(attackKind({}), 'fire:SS');
    assert.equal(buttonCost('attackWeapon', { mode: 'FA' }), 'complex');
    assert.equal(buttonCost('attackWeapon', { mode: 'SA' }), 'simple');
    assert.equal(buttonCost('attackWeapon', { melee: true }), 'complex');
    assert.equal(buttonCost('attackWeapon', null), null);
  });
  test('review fix: an Attack button without its own mode costs its cheapest mode; a mode button costs that mode', () => {
    assert.equal(buttonCost('attackWeapon', { mode: 'FA', modes: ['SA', 'BF', 'FA'] }), 'simple');
    assert.equal(buttonCost('attackWeapon', { mode: 'FA', modes: ['SA', 'BF', 'FA'], explicit: true }), 'complex');
    assert.equal(buttonCost('attackWeapon', { mode: 'FA', modes: ['FA'] }), 'complex');
    assert.equal(buttonCost('rollSkill'), null);
    assert.equal(buttonCost('searchPerson'), 'simple');
    assert.equal(settingSection('sr2e.numberSteppers'), 'look');
  });
  test('other buttons map to RULES.ACTIONS.costs; editing is no action', () => {
    assert.equal(buttonCost('castSpell'), 'complex');
    assert.equal(buttonCost('reloadWeapon'), 'simple');
    assert.equal(buttonCost('editItem'), null);
    assert.equal(buttonCost('setMonitor'), null);
    for (const kind of Object.values(BUTTON_ACTION_KINDS)) assert.ok(kind in RULES.ACTIONS.costs, kind);
  });
  test('what still fits the phase', () => {
    assert.equal(affordable('complex', 0), true);
    assert.equal(affordable('complex', 1), false);
    assert.equal(affordable('simple', 1), true);
    assert.equal(affordable('simple', 2), false);
    assert.equal(affordable('free', 2), true);
    assert.equal(affordable(null, 2), true);
  });
});

describe('remembered roll choices', () => {
  test('only plain field names', () => {
    assert.deepEqual(memoryFields('force, pool,drainPool, bad name,<x>,useFocus'), ['force', 'pool', 'drainPool', 'useFocus']);
    assert.deepEqual(memoryFields(undefined), []);
  });
  test('newest first, the oldest dropped', () => {
    let m = rememberRoll({}, 'a', { pool: '2' }, 1);
    m = rememberRoll(m, 'b', { pool: '3' }, 2);
    assert.deepEqual(m['a']!.v, { pool: '2' });
    m = rememberRoll(m, 'a', { pool: '4' }, 3);
    assert.equal(m['a']!.v['pool'], '4');
    let big: any = {};
    for (let i = 0; i < ROLL_MEMORY_MAX + 5; i++) big = rememberRoll(big, `k${i}`, { x: true }, i);
    assert.equal(Object.keys(big).length, ROLL_MEMORY_MAX);
    assert.ok(!('k0' in big) && 'k204' in big);
    assert.deepEqual(rememberRoll(null, '', { x: '1' }), {});
  });
  test('a remembered number stays inside the field\'s limits (pool dice left now)', () => {
    assert.equal(restoredNumber('5', { min: 0, max: 3 }), '3');
    assert.equal(restoredNumber(-2, { min: 0 }), '0');
    assert.equal(restoredNumber('4', {}), '4');
    assert.equal(restoredNumber('', {}), null);
    assert.equal(restoredNumber('abc', {}), null);
  });
});

describe('steppers', () => {
  test('by the step, inside min and max', () => {
    assert.equal(stepValue('3', 1), 4);
    assert.equal(stepValue('0', -1, { min: 0 }), 0);
    assert.equal(stepValue('6', 1, { max: 6 }), 6);
    assert.equal(stepValue('0.2', 1, { step: 0.1 }), 0.3);
    assert.equal(stepValue('', 1, { min: 1 }), 2);
    assert.equal(stepValue('2.5', -1, { step: 0.5 }), 2);
  });
});

describe('grouped notifications', () => {
  test('the same text once with ×N', () => {
    assert.deepEqual(groupNotes([{ type: 'info', message: 'Saved' }, { type: 'info', message: 'Saved' }, { type: 'info', message: 'Saved' }]), [{ type: 'info', message: 'Saved (×3)', count: 3 }]);
  });
  test('a burst of one kind on one line; kinds stay apart; past three: "and N more"', () => {
    const out = groupNotes([
      { type: 'warn', message: 'A' }, { type: 'warn', message: 'B' }, { type: 'info', message: 'I' },
      { type: 'warn', message: 'C' }, { type: 'warn', message: 'A' }, { type: 'warn', message: 'D' }, { type: 'warn', message: 'E' },
    ]);
    assert.deepEqual(out.map((o) => o.type), ['warn', 'info']);
    assert.equal(out[0]!.message, 'A (×2) · B · C · …and 2 more');
    assert.equal(out[0]!.count, 6);
    assert.equal(out[1]!.message, 'I');
  });
  test('the text of a repeat', () => {
    assert.equal(repeatedText('x', 1), 'x');
    assert.equal(repeatedText('x', 4), 'x (×4)');
  });
});

describe('window memory', () => {
  test('a window\'s own place, else its kind\'s size; kept on screen', () => {
    let m = rememberWindow(emptyWinMemory(), 'sheet-1', 'SR2CharacterSheet', { left: 100, top: 50, width: 700, height: 800 }, 1);
    assert.deepEqual(placeWindow(m, 'sheet-1', 'SR2CharacterSheet', { width: 1920, height: 1080 }), { left: 100, top: 50, width: 700, height: 800 });
    assert.deepEqual(placeWindow(m, 'sheet-2', 'SR2CharacterSheet', { width: 1920, height: 1080 }), { width: 700, height: 800 });
    assert.equal(placeWindow(m, 'other', 'Other', { width: 1920, height: 1080 }), null);
    const small = placeWindow(m, 'sheet-1', 'SR2CharacterSheet', { width: 600, height: 500 })!;
    assert.ok(small.width! <= 600 && small.height! <= 500 && small.left! >= 0 && small.top! <= 440);
    m = rememberWindow(m, 'x', 'K', { left: 'auto', width: 'nope' }, 2);
    assert.equal(m.ids['x']?.left, undefined);
    assert.equal(rememberWindow(m, 'y', 'K', null).ids['y'], undefined);
  });
  test('the oldest windows are forgotten', () => {
    let m = emptyWinMemory();
    for (let i = 0; i < WINDOW_MEMORY_MAX + 3; i++) m = rememberWindow(m, `w${i}`, 'K', { left: i, top: 0, width: 300, height: 300 }, i);
    assert.equal(Object.keys(m.ids).length, WINDOW_MEMORY_MAX);
    assert.ok(!('w0' in m.ids));
  });
});

describe('settings sections and search', () => {
  test('each of our settings has a section', () => {
    assert.equal(settingSection('sr2e.lookTheme'), 'look');
    assert.equal(settingSection('sheetLayout'), 'look');
    assert.equal(settingSection('sr2e.rollPrivacy'), 'rolls');
    assert.equal(settingSection('sr2e.defendPrompt'), 'rolls');
    assert.equal(settingSection('sr2e.tokenSetup'), 'tokens');
    assert.equal(settingSection('sr2e.houseRulesMenu'), 'gm');
    assert.equal(settingSection('sr2e.whoKnows'), 'other');
  });
  test('every word must match somewhere', () => {
    assert.equal(settingMatches(['Wound modifiers', 'WOUND_MODIFIERS'], 'wound mod'), true);
    assert.equal(settingMatches(['Wound modifiers'], 'wound armor'), false);
    assert.equal(settingMatches(['x'], '  '), true);
    assert.equal(settingMatches([null, undefined], 'x'), false);
  });
});
