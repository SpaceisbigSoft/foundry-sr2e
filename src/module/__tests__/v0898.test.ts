/**
 * v0.89.8: every SR2e tool in one place: the SR2e tools window (Alt+T, the Actors sidebar, the guide), the SR2e group
 * in the left toolbar; the GM panel's tab labels translated.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TOOLS, toolsFor, toolLabelKey, toolHintKey, bindingText, sceneControlSpec } from '../rules/tools.ts';
import { HOTKEYS } from '../applications/hotkeys.ts';

const ROOT = process.cwd();
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), 'utf8');
const lang = JSON.parse(read('public', 'lang', 'en.json'));
const get = (key: string): unknown => key.split('.').slice(1).reduce((o: any, p) => o?.[p], lang.SR2E);
const toolsSrc = read('src', 'module', 'applications', 'tools.ts');

describe('v0.89.8 the SR2e tools', () => {
  test('every tool has an action, a label and a line on what it does; ids are unique', () => {
    assert.equal(new Set(TOOLS.map((t) => t.id)).size, TOOLS.length);
    const actions = toolsSrc.slice(toolsSrc.indexOf('export const TOOL_ACTIONS'), toolsSrc.indexOf('export function runTool'));
    for (const t of TOOLS) {
      assert.match(actions, new RegExp(`\\n  ${t.id}: \\(\\) =>`), `${t.id} has no action`);
      assert.equal(typeof get(toolLabelKey(t.id)), 'string', toolLabelKey(t.id));
      assert.equal(typeof get(toolHintKey(t.id)), 'string', toolHintKey(t.id));
    }
    const ids = new Set(TOOLS.map((t) => t.id));
    for (const m of actions.matchAll(/\n  (\w+): \(\) =>/g)) assert.ok(ids.has(m[1]!), `${m[1]} is not in TOOLS`);
    // Every text in SR2E.Tools is used.
    const extra = Object.keys(lang.SR2E.Tools).filter((k) => !ids.has(k) && !['title', 'allTools', 'sectionPlayers', 'sectionGm'].includes(k));
    assert.deepEqual(extra, []);
  });

  test('a player sees only the players\' tools; the GM sees all, and every hotkey shown is a real one', () => {
    assert.ok(toolsFor(false).every((t) => t.who === 'player'));
    assert.equal(toolsFor(true).length, TOOLS.length);
    for (const id of ['guide', 'sheet', 'defend', 'resist', 'bugReport']) assert.ok(toolsFor(false).some((t) => t.id === id), id);
    for (const id of ['gmPanel', 'npcGenerator', 'award', 'houseRules']) assert.ok(!toolsFor(false).some((t) => t.id === id), id);
    const ids = new Set(HOTKEYS.map((h) => h.id));
    for (const t of TOOLS.filter((x) => x.hotkey)) assert.ok(ids.has(t.hotkey!), `${t.id}: hotkey ${t.hotkey}`);
    // The window shows the current binding (a rebound key shows as rebound).
    assert.equal(bindingText({ key: 'KeyH', modifiers: ['Alt'] }), 'Alt+H');
    assert.equal(bindingText({ key: 'Digit5', modifiers: ['Control', 'Shift'] }), 'Control+Shift+5');
    assert.equal(bindingText(undefined), '');
    assert.ok(HOTKEYS.some((h) => h.id === 'openTools' && h.key === 'KeyT' && !h.gm));
    assert.ok(lang.SR2E.Keybindings.OpenTools.Name && lang.SR2E.Keybindings.OpenTools.Hint);
  });

  test('the ways in: the toolbar group, the Actors sidebar button for every user, the guide, the API', () => {
    assert.match(toolsSrc, /Hooks\.on\('getSceneControlButtons'/);
    const dir = toolsSrc.slice(toolsSrc.indexOf("Hooks.on('renderActorDirectory'"));
    assert.ok(!/isGM/.test(dir.slice(0, dir.indexOf('});'))), 'the sidebar button is for every user');
    assert.match(read('public', 'templates', 'help.hbs'), /data-action="openTools"/);
    assert.match(read('src', 'module', 'applications', 'help.ts'), /openTools: \(\) =>/);
    const sys = read('src', 'module', 'sr2e-system.ts');
    assert.ok(sys.includes('registerTools();') && sys.includes('openTools, runTool,'));
    // A GM tool refuses a player even when called directly.
    assert.match(toolsSrc, /def\.who === 'gm' && !isGm\(\)/);
    // The window's headings open the guide's topic about it.
    assert.match(read('public', 'templates', 'tools.hbs'), /<h2 data-help="tools">/);
  });

  test('the GM panel\'s tab labels are keys, shown translated', () => {
    const ui = read('src', 'module', 'applications', 'ui.ts');
    const tabs = ui.slice(ui.indexOf('static GM_TABS = ['), ui.indexOf('];', ui.indexOf('static GM_TABS = [')));
    const labels = [...tabs.matchAll(/label: '([^']+)'/g)].map((m) => m[1]!);
    assert.equal(labels.length, 9);
    for (const k of labels) assert.equal(typeof get(k), 'string', k);
    assert.match(ui, /label: tKey\(t\.label\)/);
  });

  test('review fixes: the toolbar group is all buttons with no layer of its own (it stays open); its buttons run the tools; open windows come forward', () => {
    const ran: string[] = [];
    let opened = 0;
    const player = sceneControlSpec(false, { id: 'sr2e', openTools: () => { opened++; }, runTool: (id) => { ran.push(id); } });
    assert.equal(player.layer, undefined, 'activating a layer would switch back to its own control');
    assert.equal(player.onChange, undefined);
    assert.ok(Object.values(player.tools).every((t: any) => t.button && !t.toggle));
    assert.ok(!('gmPanel' in player.tools) && 'guide' in player.tools && 'bugReport' in player.tools);
    player.tools.allTools.onChange(); player.tools.guide.onChange();
    assert.deepEqual([opened, ran], [1, ['guide']]);
    const gm = sceneControlSpec(true, { id: 'sr2e', openTools: () => {}, runTool: () => {} });
    assert.ok('gmPanel' in gm.tools && 'houseRules' in gm.tools);
    const src = read('src', 'module', 'applications', 'tools.ts');
    assert.match(src, /if \(bringOpen\(menu\.type\)\) return;/);
    assert.match(src, /game as any\)\.settings\?\.sheet/);
  });
});
