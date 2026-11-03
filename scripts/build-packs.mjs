/**
 * v0.60.0: builds the system's compendium packs (public/packs/*) from the sources below with the
 * Foundry CLI. Only system macros: the system ships no rulebook data. Run with `npm run packs`.
 */
import { compilePack } from '@foundryvtt/foundryvtt-cli';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const ICON = 'icons/svg';
/** Each macro: a stable 16-character id, a name, an icon and the script. */
const MACROS = [
  { _id: 'sr2eMacroGmPanel', name: 'GM panel', img: `${ICON}/castle.svg`, command: `game.sr2e.gmPanel();` },
  { _id: 'sr2eMacroNpcGen0', name: 'NPC generator', img: `${ICON}/mystery-man.svg`, command: `game.sr2e.npcGenerator();` },
  { _id: 'sr2eMacroUndo000', name: 'Undo the last change (GM)', img: `${ICON}/clockwork.svg`, command: `game.sr2e.undo();` },
  { _id: 'sr2eMacroTest000', name: 'SR2 test…', img: `${ICON}/dice-target.svg`, command: `// Rolls an SR2 test for the selected token (or your character): an attribute, a skill, perception or a number of dice.
const actor = canvas.tokens?.controlled?.[0]?.actor ?? game.user.character ?? null;
const spec = await foundry.applications.api.DialogV2.prompt({
  window: { title: "SR2 test" },
  content: '<div class="form-group"><label>Test</label><input name="spec" type="text" placeholder="e.g. Firearms tn 5, body tn 4, perception, 6 tn 5" autofocus></div>',
  ok: { label: "Roll", callback: (_e, b) => b.form.elements.spec.value },
  rejectClose: false,
});
if (spec) await game.sr2e.api.rollTest(spec, actor, { quick: false });` },
  { _id: 'sr2eMacroPercep0', name: 'Perception (selected)', img: `${ICON}/eye.svg`, command: `const actors = canvas.tokens?.controlled?.map((t) => t.actor).filter((a) => a?.isOwner) ?? [];
if (!actors.length && game.user.character) actors.push(game.user.character);
if (!actors.length) ui.notifications.warn("Select a token you own.");
for (const a of actors) await game.sr2e.api.rollTest("perception", a, { quick: true });` },
  { _id: 'sr2eMacroAttack0', name: 'Attack (selected)', img: `${ICON}/sword.svg`, command: `const a = canvas.tokens?.controlled?.[0]?.actor ?? game.user.character;
if (!a?.isOwner) ui.notifications.warn("Select a token you own (and target someone).");
else await game.sr2e.runSheetAction(a, "quickAttack");` },
  { _id: 'sr2eMacroCast000', name: 'Cast a spell (selected)', img: `${ICON}/fire.svg`, command: `const a = canvas.tokens?.controlled?.[0]?.actor ?? game.user.character;
if (!a?.isOwner) ui.notifications.warn("Select a token you own.");
else await game.sr2e.runSheetAction(a, "quickCast");` },
  { _id: 'sr2eMacroFullDef', name: 'Full defense (selected)', img: `${ICON}/shield.svg`, command: `const actors = canvas.tokens?.controlled?.map((t) => t.actor).filter((a) => a?.isOwner && a.declareFullDefense) ?? [];
if (!actors.length) ui.notifications.warn("Select tokens you own.");
for (const a of actors) await a.declareFullDefense();` },
  { _id: 'sr2eMacroDefend0', name: 'Defend against the newest attack', img: `${ICON}/combat.svg`, command: `const a = canvas.tokens?.controlled?.[0]?.actor ?? game.user.character;
if (!a?.isOwner) ui.notifications.warn("Select a token you own.");
else if (!game.sr2e.api.defendNewest(a)) ui.notifications.info(a.name + " has no attack to defend against.");` },
  { _id: 'sr2eMacroInit000', name: 'Roll initiative (selected)', img: `${ICON}/d20-grey.svg`, command: `const combat = game.combat;
if (!combat) ui.notifications.warn("No combat.");
else {
  const ids = (canvas.tokens?.controlled ?? []).map((t) => combat.combatants.find((c) => c.tokenId === t.id)).filter((c) => c?.isOwner).map((c) => c.id);
  if (!ids.length) ui.notifications.warn("Select tokens of yours that are in the combat.");
  else await combat.rollInitiative(ids);
}` },
  { _id: 'sr2eMacroSmoke00', name: 'Smoke cloud at the selected token (GM)', img: `${ICON}/blind.svg`, command: `// A 5 m smoke region (SR2e environment: smoke) where the selected token stands. Delete the region to clear it.
if (!game.user.isGM) return ui.notifications.warn("Only the GM can do this.");
const t = canvas.tokens?.controlled?.[0];
if (!t) return ui.notifications.warn("Select a token.");
const units = String(canvas.scene.grid.units || "m").toLowerCase();
const metresPerUnit = /^(ft|feet|foot)/.test(units) ? 0.3048 : /^(yd|yard)/.test(units) ? 0.9144 : /^km/.test(units) ? 1000 : 1;
const ppm = canvas.dimensions.size / ((canvas.dimensions.distance || 1) * metresPerUnit);
await canvas.scene.createEmbeddedDocuments("Region", [{ name: "Smoke", color: "#888888", visibility: 2, shapes: [{ type: "circle", x: t.center.x, y: t.center.y, radius: 5 * ppm }], flags: { sr2e: { env: { smoke: "smoke" } } } }]);` },
  { _id: 'sr2eMacroExport0', name: 'Export item templates to a compendium (GM)', img: `${ICON}/book.svg`, command: `await game.sr2e.api.exportTemplates();` },
];

const out = path.resolve('public/packs/sr2e-macros');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sr2e-packs-'));
for (const [i, m] of MACROS.entries()) {
  if (m._id.length !== 16 || !/^[a-zA-Z0-9]+$/.test(m._id)) throw new Error(`Bad id ${m._id}`);
  const doc = { ...m, type: 'script', scope: 'global', author: null, folder: null, sort: (i + 1) * 100000, ownership: { default: 0 }, flags: { sr2e: { systemMacro: true } }, _key: `!macros!${m._id}` };
  fs.writeFileSync(path.join(tmp, `${m._id}.json`), JSON.stringify(doc, null, 2));
}
fs.rmSync(out, { recursive: true, force: true });
await compilePack(tmp, out, { log: true });
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`Built ${MACROS.length} macros into ${out}`);
