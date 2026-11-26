/**
 * v0.93.1: the new system id (`shadowrun2e_unified`) and moving a world from the old one (`sr2e`): helpers/move.ts and its
 * place in migrations.ts.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (...p: string[]) => readFileSync(join(here, '..', '..', '..', ...p), 'utf8');
const SRC = (p: string) => read('src', 'module', p);
const NEW = 'shadowrun2e_unified';

describe('v0.93.1: moving a world from the old id', () => {
  test('paths: system files and compendium ids move; other text, and other systems\' paths, stay', async () => {
    const { movePathsIn, movePathsDeep } = await import('../helpers/move.ts');
    assert.equal(movePathsIn('systems/sr2e/tokens/a.svg', NEW), `systems/${NEW}/tokens/a.svg`);
    assert.equal(movePathsIn('@UUID[Compendium.sr2e.sr2e-macros.Macro.x]{GM}', NEW), `@UUID[Compendium.${NEW}.sr2e-macros.Macro.x]{GM}`);
    assert.equal(movePathsIn('<img src="systems/sr2e/icons/w.svg"> and systems/sr2e/x', NEW), `<img src="systems/${NEW}/icons/w.svg"> and systems/${NEW}/x`);
    assert.equal(movePathsIn('sr2e.SR2CharacterSheet', NEW), `${NEW}.SR2CharacterSheet`, 'a chosen sheet');
    assert.equal(movePathsIn('{"Actor":{"character":"sr2e.SR2CharacterSheet","npc":"sr2e.SR2NpcSheet"}}', NEW), `{"Actor":{"character":"${NEW}.SR2CharacterSheet","npc":"${NEW}.SR2NpcSheet"}}`);
    for (const keep of ['sr2e.SR2', 'sr2e.window', 'xsr2e.SR2CharacterSheet', 'sr2e-card', 'modules/sr2e/x.png', 'systems/sr2elite/x', 'SR2E.UI.x', '', 'icons/svg/x.svg']) assert.equal(movePathsIn(keep, NEW), keep);
    assert.deepEqual(movePathsDeep({ a: ['systems/sr2e/a'], b: { c: 'systems/sr2e/c', n: 3, z: null } }, NEW), { a: [`systems/${NEW}/a`], b: { c: `systems/${NEW}/c`, n: 3, z: null } });
  });

  test('one document: the old flags copied (paths moved), path fields rewritten, embedded fields left for their own pass', async () => {
    const { moveUpdate } = await import('../helpers/move.ts');
    const src = {
      _id: 'a1', name: 'Runner', img: 'systems/sr2e/tokens/street/samurai.svg',
      prototypeToken: { texture: { src: 'systems/sr2e/tokens/street/samurai.svg' }, name: 'Runner' },
      system: { notes: 'plain', list: ['systems/sr2e/x.png', 'y'] },
      items: [{ _id: 'i1', img: 'systems/sr2e/icons/a.svg' }],
      flags: { sr2e: { test: { kind: 'attack' }, art: 'systems/sr2e/tokens/a.svg' }, core: { sheetClass: 'x' } },
      _stats: { systemId: 'sr2e' },
    };
    const up = moveUpdate(src, NEW, ['items', 'effects'])!;
    assert.deepEqual(up, {
      [`flags.${NEW}`]: { test: { kind: 'attack' }, art: `systems/${NEW}/tokens/a.svg` },
      img: `systems/${NEW}/tokens/street/samurai.svg`,
      'prototypeToken.texture.src': `systems/${NEW}/tokens/street/samurai.svg`,
      'system.list': [`systems/${NEW}/x.png`, 'y'],
    });
    assert.equal(src.flags.sr2e.art, 'systems/sr2e/tokens/a.svg', 'the source is not changed');
    // Run again after the move: nothing left to do (the new flags exist; the paths are new).
    const after = { ...src, img: up['img'], prototypeToken: { texture: { src: up['prototypeToken.texture.src'] }, name: 'Runner' }, system: { notes: 'plain', list: up['system.list'] }, flags: { ...src.flags, [NEW]: up[`flags.${NEW}`] } };
    assert.equal(moveUpdate(after, NEW, ['items', 'effects']), null);
    assert.equal(moveUpdate({ _id: 'b', name: 'x', flags: {} }, NEW), null);
    assert.equal(moveUpdate(null, NEW), null);
  });

  test('review 2: flags merge key by key under what the new id already holds (it wins)', async () => {
    const { moveUpdate, mergeUnder } = await import('../helpers/move.ts');
    const up = moveUpdate({ _id: 'c', flags: { sr2e: { a: 1, b: { x: 1, y: 2 }, art: 'systems/sr2e/t.svg' }, [NEW]: { requests: { r1: 1 }, b: { y: 9 } } } }, NEW)!;
    assert.deepEqual(up[`flags.${NEW}`], { a: 1, b: { x: 1, y: 9 }, art: `systems/${NEW}/t.svg`, requests: { r1: 1 } });
    assert.equal(moveUpdate({ _id: 'c', flags: { sr2e: { a: 1 }, [NEW]: { a: 2 } } }, NEW), null, 'nothing new to add');
    assert.deepEqual(mergeUnder({ a: [1], b: { c: 1 } }, { a: [2], b: { d: 2 } }), { a: [2], b: { c: 1, d: 2 } });
  });

  test('review 8: any old setting marks a world to move (not the other system\'s marker)', async () => {
    const { hasOldSettings, needsMove } = await import('../helpers/move.ts');
    assert.equal(hasOldSettings(['sr2e.houseRules']), true);
    assert.equal(hasOldSettings(['sr2e.systemMigrationVersion', 'core.x']), false);
    assert.equal(needsMove([{ key: 'sr2e.lookTheme', value: '"dark"' }], NEW), true);
  });

  test('settings: registered keys move with their paths; futurekill\'s marker and unknown keys stay', async () => {
    const { settingsToMove } = await import('../helpers/move.ts');
    const stored = [
      { key: 'sr2e.migrationVersion', value: '"0.93.0"' },
      { key: 'sr2e.defaultArt', value: '{"img":"systems/sr2e/tokens/a.svg"}' },
      { key: 'sr2e.systemMigrationVersion', value: '"0.164"' },
      { key: 'sr2e.somethingElse', value: '1' },
      { key: 'core.rollMode', value: '"publicroll"' },
      { key: 'sr2e.layout', value: '"tabs"', user: 'u1' },
    ];
    const reg = new Set(['migrationVersion', 'defaultArt', 'layout', 'systemMigrationVersion']);
    assert.deepEqual(settingsToMove(stored, (k) => reg.has(k), NEW), [
      { key: `${NEW}.migrationVersion`, value: '"0.93.0"', user: null },
      { key: `${NEW}.defaultArt`, value: `{"img":"systems/${NEW}/tokens/a.svg"}`, user: null },
      { key: `${NEW}.layout`, value: '"tabs"', user: 'u1' },
    ]);
  });

  test('a re-run keeps a setting changed since; a default written before the move is replaced', async () => {
    const { mayOverwrite } = await import('../helpers/move.ts');
    assert.equal(mayOverwrite('"tabs"', 'tabs'), true, 'still the default');
    assert.equal(mayOverwrite('{"a":1}', { a: 1 }), true);
    assert.equal(mayOverwrite('"compact"', 'tabs'), false, 'changed: kept');
    assert.equal(mayOverwrite('{"values":{"x":2}}', { values: {} }), false);
    assert.equal(mayOverwrite(undefined, 'tabs'), true);
    assert.equal(mayOverwrite('not json', 'tabs'), true);
  });

  test('which worlds move: old marker present, not yet done, and running under the new id', async () => {
    const { needsMove } = await import('../helpers/move.ts');
    assert.equal(needsMove([{ key: 'sr2e.migrationVersion', value: '"0.93.0"' }], NEW), true);
    assert.equal(needsMove([{ key: 'sr2e.migrationVersion', value: '"0.93.0"' }, { key: `${NEW}.movedFromSr2e`, value: '"2026-11-25"' }], NEW), false);
    assert.equal(needsMove([], NEW), false, 'a new world');
    assert.equal(needsMove([{ key: `${NEW}.migrationVersion`, value: '"0.93.1"' }], NEW), false);
    assert.equal(needsMove([{ key: 'sr2e.migrationVersion', value: '"0.93.0"' }], 'sr2e'), false, 'still under the old id');
    assert.equal(needsMove(null, NEW), false);
  });

  test('client settings: old browser keys copy only when registered and missing under the new id', async () => {
    const { clientKeysToMove } = await import('../helpers/move.ts');
    assert.deepEqual(clientKeysToMove(['sr2e.theme', 'sr2e.layout', `${NEW}.layout`, 'core.x', 'sr2e.foreign'], ['theme', 'layout'], NEW), [{ from: 'sr2e.theme', to: `${NEW}.theme` }]);
  });

  test('hotkeys: the player\'s own keys for this system are copied to the new id', async () => {
    const { keybindingsMoved } = await import('../helpers/move.ts');
    const out = JSON.parse(keybindingsMoved(JSON.stringify({ 'sr2e.openTools': [{ key: 'KeyT', modifiers: ['Alt'] }], 'core.cycleView': [] }), NEW)!);
    assert.deepEqual(out[`${NEW}.openTools`], [{ key: 'KeyT', modifiers: ['Alt'] }]);
    assert.ok(out['sr2e.openTools'] && out['core.cycleView'], 'nothing is removed');
    assert.equal(keybindingsMoved(JSON.stringify({ 'sr2e.a': [], [`${NEW}.a`]: [1] }), NEW), null, 'a new key set is kept');
    assert.equal(keybindingsMoved('not json', NEW), null);
    assert.equal(keybindingsMoved(null, NEW), null);
  });

  test('the move runs after the foreign-world guard and before the update steps; nothing is deleted', () => {
    const mig = SRC('migrations.ts');
    const guard = mig.indexOf('const signs = foreignWorldSigns(data);');
    const move = mig.indexOf('if (needsMove(data.settings, SYSTEM.id)) {');
    const steps = mig.indexOf('const stored = String(game.settings.get(SYSTEM.id, "migrationVersion")');
    assert.ok(guard > 0 && guard < move && move < steps);
    assert.match(mig, /if \(!\(await askMove\(\)\)\) return;/);
    assert.match(mig, /await game\.settings\.set\(SYSTEM\.id, MOVE_DONE_KEY as any/);
    const move_ = SRC('helpers/move.ts');
    assert.doesNotMatch(move_, /\.delete\(|deleteDocuments|deleteEmbeddedDocuments|-=/, 'the move only copies');
    assert.match(SRC('sr2e-system.ts'), /Hooks\.once\("setup", \(\) => \{[\s\S]{0,400}moveClientSettings\(SYSTEM\.id, keys\)/);
    // Review 1: no move write is logged for undo; review 5: a token's delta is moved once; review 7: the Karma refresh waits.
    assert.match(move_, /const MOVE_OPTS = \{ sr2eMove: true, sr2eUndoing: true, sr2eNoAdvance: true \} as const;/);
    assert.doesNotMatch(move_.replace('const MOVE_OPTS = { sr2eMove: true', ''), /sr2eMove: true/);
    assert.match(move_, /if \(name === 'ActorDelta'\) return 0;/);
    assert.match(SRC('applications/chat.ts'), /isForeignWorld\(\) \|\| needsMove\(\(game as any\)\.data\?\.settings, SYSTEM_ID\) \|\| !sessionRefreshDue/);
    assert.match(SRC('applications/interface.ts'), /return id\.startsWith\(`\$\{ID\}\.`\) \? id : '';/);
  });

  test('the report escapes counts, names and the error', async () => {
    const { moveReport } = await import('../migrations.ts');
    const ok = moveReport({ actors: 3, 'pack world.<x>': 1 }, 4, null);
    assert.ok(ok.includes('actors: 3') && ok.includes('pack world.&lt;x&gt;: 1') && !ok.includes('sr2e-warn'));
    const bad = moveReport({}, 0, '<boom>');
    assert.ok(bad.includes('sr2e-warn') && bad.includes('&lt;boom&gt;'));
  });
});
