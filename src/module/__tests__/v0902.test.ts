/**
 * v0.90.2: a catalogue load sorts the "Catalogue (SR2e)" actor folder into subfolders (the owner's macro, built in).
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { catalogueFolderPath, CATALOGUE_FOLDER_NAMES } from '../rules/catalogcsv.ts';

const ROOT = process.cwd();
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), 'utf8');
const lang = JSON.parse(read('public', 'lang', 'en.json'));

describe('v0.90.2 the catalogue folder sorts itself', () => {
  test('each kind of actor has its subfolder (as the macro sorted them)', () => {
    const en = (p: string[]) => p.map((id) => lang.SR2E.App.Catalogue.folder[id]);
    assert.deepEqual(en(catalogueFolderPath({ type: 'vehicle', system: { category: 'car' } })), ['Vehicles', 'Cars']);
    assert.deepEqual(en(catalogueFolderPath({ type: 'vehicle', system: { category: 'ship' } })), ['Vehicles', 'Boats & Ships']);
    assert.deepEqual(en(catalogueFolderPath({ type: 'vehicle', system: { category: 'rotor', drone: true } })), ['Drones', 'Rotor Drones']);
    assert.deepEqual(en(catalogueFolderPath({ type: 'vehicle', system: { category: 'odd', drone: true } })), ['Drones', 'Mini-Drones & Other']);
    assert.deepEqual(en(catalogueFolderPath({ type: 'spirit', system: { spiritKind: 'elemental' } })), ['Spirits', 'Elementals']);
    assert.deepEqual(en(catalogueFolderPath({ type: 'spirit', system: { spiritKind: 'toxic' } })), ['Spirits', 'Other Spirits']);
    assert.deepEqual(en(catalogueFolderPath({ type: 'npc', critter: true })), ['Critters']);
    assert.deepEqual(en(catalogueFolderPath({ type: 'npc' })), ['NPCs']);
    assert.deepEqual(en(catalogueFolderPath({ type: 'host' })), ['Other']);
  });
  test('every folder id has a name key, and every name is in lang/en.json', () => {
    for (const [id, key] of Object.entries(CATALOGUE_FOLDER_NAMES)) {
      assert.equal(key, `SR2E.App.Catalogue.folder.${id}`);
      assert.equal(typeof lang.SR2E.App.Catalogue.folder[id], 'string', id);
    }
    const used = new Set<string>();
    for (const type of ['vehicle', 'spirit', 'npc', 'site']) for (const category of ['car', 'bike', 'truck', 'hovercraft', 'boat', 'ship', 'rotor', 'fixedWing', 'vectorThrust', 'lta', 'other', 'x']) for (const drone of [true, false]) for (const spiritKind of ['nature', 'elemental', 'x']) for (const critter of [true, false]) catalogueFolderPath({ type, system: { category, drone, spiritKind }, critter }).forEach((id) => used.add(id));
    assert.deepEqual([...used].filter((id) => !(id in CATALOGUE_FOLDER_NAMES)), []);
  });
  test('the loader puts new actors in their subfolder and sorts the folder after every load; the API can too', () => {
    const src = read('src', 'module', 'applications', 'catalogue.ts');
    assert.match(src, /for \(const d of fresh\) \{ const sf = await subfolder\(/);
    assert.match(src, /const sf = await subfolder\(\{ name: a\.name, type: 'npc'/);
    assert.equal((src.match(/await sortCatalogueFolder\(res\)/g) ?? []).length, 3, 'twice in the load, once in the API notice');
    assert.match(src, /if \(!\(game as any\)\.user\?\.isGM\) return null;/);
    assert.match(read('src', 'module', 'sr2e-system.ts'), /sortCatalogue: \(\) => sortCatalogueWithNotice\(\)/);
    // Review fixes: the path from the actor as made (defaults filled), one root lookup, a flag on each folder, a failed
    // folder not retried, the batch update guarded, one sort at a time, and only the root and its Drones folder emptied.
    assert.match(src, /new ActorCls\(\{ name: d\.name \?\? '-', type: d\.type, system: d\.system \?\? \{\} \}\)\.system/);
    assert.match(src, /const f = catalogueRoot\(\);/);
    assert.match(src, /flags: \{ \[SYSTEM\.id\]: \{ catalogueFolder: id \} \}/);
    assert.match(src, /cache\.set\(key, null\);/);
    assert.match(src, /try \{ await \(CONFIG as any\)\.Actor\.documentClass\.updateDocuments\(updates\); \} catch/);
    assert.match(src, /sortRunning = run\.then/);
    assert.ok(!/'vehicles', 'drones', 'spirits'\]\.map/.test(src), 'Vehicles and Spirits folders are left as they are');
  });
});
