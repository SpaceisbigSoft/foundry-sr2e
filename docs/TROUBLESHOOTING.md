# Troubleshooting

Something not working? Find the symptom below. Each entry says what is going on and what to do. If none fits, see [Reporting a bug](#reporting-a-bug).

The in-game guide (**Alt+H**, or the **Guide** button on any sheet) has a short version of this page under *Troubleshooting*.

Contents: [Installing and updating](#installing-and-updating) · [The world won't load or looks wrong](#the-world-wont-load-or-looks-wrong) · [Rolls and chat cards](#rolls-and-chat-cards) · [Permissions and players](#permissions-and-players) · [Modules](#modules) · [Performance](#performance) · [Moving a world from `sr2e`](#moving-a-world-from-sr2e) · [Reporting a bug](#reporting-a-bug)

---

## Installing and updating

**The system won't install, or its worlds won't launch.**
- *Cause:* SR2e needs **Foundry v14**. v13 and older can't load it. Foundry v15 marks it as not compatible, because its `system.json` names 14 as the highest version (on purpose, until SR2e has been tested on v15).
- *Fix:* use Foundry v14. Before you update Foundry itself to a new major version, check the README's *Foundry versions* table.

**After an update, something is missing or doesn't work (a new kind of actor or item, a sheet, a button).**
- *Cause:* some of a system's files, such as its list of actor and item types in `system.json`, are only read when Foundry starts. Reloading the browser is not enough.
- *Fix:* quit Foundry completely (the server or the desktop app, not just the browser tab) and start it again.

**I installed by hand and Foundry doesn't list the system.**
- *Cause:* the folder has the wrong name, or the files are one folder too deep.
- *Fix:* the folder must be `Data/systems/shadowrun2e_unified`, with `system.json` directly inside it (`Data/systems/shadowrun2e_unified/system.json`). Then restart Foundry. Foundry's setup screen shows where `Data` is under **Configuration → User Data Path**.

---

## The world won't load or looks wrong

**When the GM opens the world: "SR2e: back up your world first".**
- *Cause:* this version has updates for the world's data. They can't be undone, so SR2e asks before it changes anything and lists the updates. It asks only when an update changes data and the world has actors or items.
- *Fix:* click **Not now**, make a backup (setup screen: **Worlds**, then **Backups**), open the world again and click **Continue**. Nothing runs and nothing is stored until you do; you are asked again at every load. Afterwards a whispered card lists the steps that ran, and the one that failed if any.

**"SR2e: this world looks like another system's", and nothing was updated.**
- *Cause:* another Shadowrun 2e system for Foundry used the same id (`sr2e`). Its worlds carry marks this system recognises (its own update setting, and actor or item types only it has). SR2e never updates such a world: the window lists the marks it found and nothing is written.
- *Fix:* open the world with the system it was made with. If you are sure the world is SR2e's and you have a backup, a GM can let SR2e update it anyway: run `game.settings.set('shadowrun2e_unified', 'ignoreForeignWorld', true)` in the browser console (F12) and reload. That is the hidden world setting `ignoreForeignWorld`.

**After an update, some characters' numbers changed.**
- *Cause:* a rule was changed to follow the books. After an update the GM is told which characters' numbers changed, and the house rule that puts the old way back.
- *Fix:* keep the new rule, or switch the old way back in **Configure Settings → Edit house rules**.

**A whisper: "SR2e: house rules not applied".**
- *Cause:* a stored house rule names a rule that no longer exists, or has the wrong kind of value (often a typing mistake in the *Advanced* box, which must be one JSON object of rule paths and values). Each refused line is listed.
- *Fix:* open **Edit house rules**, correct or remove the listed lines, and save.

**Text in SR2e's windows is too small or too big, or glows and flashes bother you.**
- *Cause:* these are each player's own look settings, and they change only SR2e's own windows and chat cards (Foundry's sidebar keeps its own look).
- *Fix:* **Configure Settings**, section *Look and layout*: *Look: text size (%)* (90 to 130) and *Look: reduced motion* (no glows, fades or flashes; your computer's reduced-motion setting is honoured anyway). *Look: theme* has a *High contrast* choice.

**The console (F12) shows canvas errors while the Foundry window is hidden.**
- *Cause:* a browser tab or pane that is hidden or minimised can give Foundry a 0×0 canvas, and Foundry logs errors about it. They don't come from SR2e.
- *Fix:* bring the window to the front and reload. Leave those lines out of a bug report.

---

## Rolls and chat cards

**I can't click Defend or Resist (or the button is greyed).**
- *Cause:* only the owner of the character named on the button, or the GM, can use it. Once you have defended, the button stays greyed for you, even after a reload.
- *Fix:* ask the GM to give you Owner on the character, or let the GM click it. The GM gets an *Already defended* question before a second defense.

**My test posted an "Apply (GM)" card and nothing happened.**
- *Cause:* your test changes something you don't own (an NPC, a door, a site, a host…). Players are not trusted, so that change waits for a GM to click **Apply (GM)** and confirm. The setting *Apply players' GM-only changes by themselves* is **off by default**, and even when it is on it only covers a jam, a hold, a sensor lock or boxes on something the card's author owns.
- *Fix:* the GM clicks **Apply (GM)** on the card and reads the confirm (it lists exactly what will change and who posted it).

**"No GM is logged in to do this."**
- *Cause:* some player actions are done by the GM's browser, and so are the Combat Turn and world-time timers, self-resisting NPCs, camera regions and making a bought vehicle.
- *Fix:* keep a GM logged in during play. A GM logged in twice (two tabs, or the app and a browser) is fine: one window runs the automation, and the other takes over within a few seconds if it closes.

**"A card from another player" asks me first.**
- *Cause:* another player's card would act for your character in a way that costs or lasts. Ordinary tests such as Defend and Resist go ahead without asking.
- *Fix:* say yes only if it matches what happened at the table.

**NPCs don't roll their own damage resistance.**
- *Cause:* *NPCs resist damage by themselves* is off by default. When it is on, the GM's browser rolls it (no pool dice) for characters no logged-in player owns. Blasts always wait.
- *Fix:* turn it on (**Configure Settings**, *Rolls, dice and chat*), or use **Resist**, or **Resist all…** on a card with several targets.

---

## Permissions and players

**A player's purchase or Karma spend became a "request".**
- *Cause:* the approval queue is on (*Players' purchases and Karma wait for the GM*; off by default). It doesn't apply in the creation wizard.
- *Fix:* the GM approves or declines it in the GM panel, **Requests** tab. Turn the setting off if you don't want it.

**A player can't import a stat block into their character.**
- *Cause:* players may import only into a character they own whose creation is not finished, and not while the approval queue is on. The messages say which: *…'s creation is finished: ask the GM to import into it.* or *The approval queue is on: ask the GM to import it.*
- *Fix:* the GM does the import.

**"Only the GM can change the catalogue."**
- *Cause:* pasting spreadsheet rows, loading a catalogue file and saving templates are GM jobs.
- *Fix:* a player uses **New entry…** in the shop: it goes to the GM as a request, and the GM's **Review…** checks it before it is saved. Formats: `docs/DATA-FORMATS.md`.

---

## Modules

**Something breaks only with a certain module on.**
- *Cause:* a module may change the same windows or data.
- *Fix:* turn off every module, check again, then turn them back on a few at a time. Say which modules are on when you report it.

**Token Action HUD shows nothing for SR2e.**
- *Cause:* SR2e registers itself with Token Action HUD Core 2.x, and Token Action HUD Core needs the socketlib module.
- *Fix:* install and activate socketlib. No separate SR2e module for the HUD is needed.

**Item Piles or Health Estimate don't see nuyen, prices or the condition monitor.**
- *Cause:* *Support for Item Piles and Health Estimate* (on by default) tells them where those are. Changing it needs a reload.
- *Fix:* make sure it is on, then reload (F5). Turn it off only if you want to set those modules up by hand.

---

## Performance

**The table feels slow with many tokens or a long chat log.**
- *Cause:* SR2e is tested with a busy table (50 tokens, a long combat, 300 chat cards), but a big world, many modules or a slow computer add up.
- *Fix:* first rule out modules (see above). Each player can turn off the extras they don't need in **Configure Settings**: *Floating damage numbers*, *Pools on token hover*, *Sound cues*. *Fold dice on chat cards* keeps cards short. A GM with the Quench module can run the opt-in batch *SR2e: performance on a busy table* in a test world to time it.

---

## Moving a world from `sr2e`

Up to v0.93.0 the system id was `sr2e`; from v0.93.1 it is `shadowrun2e_unified`. The full steps are in [`docs/MOVING.md`](MOVING.md): back up, install the new version beside the old one, change `"system": "sr2e"` to `"system": "shadowrun2e_unified"` in the world's `world.json`, then launch the world as GM and click **Continue** at *SR2e: move this world to the new system id*. Reload (F5) when the GM's report card arrives; each player's own settings come across the first time that player logs in.

**The setup screen says "Requires System Update".**
- *Fix:* the new system isn't installed, or `world.json` has a typing mistake. See `docs/MOVING.md`, *If something goes wrong*.

**The move stopped part-way ("moving this world to the new system id stopped").**
- *Fix:* nothing old is deleted; the move runs again at the next load. The chat card and the console (`sr2e | …` lines) say what failed. Restoring the backup is the clean way back.

**A macro or module stopped finding SR2e's data.**
- *Fix:* `game.sr2e` and the `sr2e.*` hooks are unchanged. Code that reads flags directly needs the new id: `getFlag(game.system.id, …)`. Modules' own saved layouts for `sr2e` (for example Token Action HUD's) must be set again.

---

## Reporting a bug

Report it on the project's GitHub issue tracker with the **Bug report** form (`.github/ISSUE_TEMPLATE/bug_report.yml`).

1. In Foundry, open the guide (**Alt+H**) or the SR2e tools window (**Alt+T**) and press **Report a bug** (also in Configure Settings, or `game.sr2e.api.openBugReport()`). It makes a text with your versions, the active modules, the rules source, the changed house rules and SR2e's recent console errors. Nothing is sent anywhere.
2. Press **Copy** and paste it into the form. If you can't open Foundry, write these by hand:
   - your **Foundry version** (setup screen, or **Settings** sidebar);
   - the **SR2e version** (Game Systems tab, or `game.system.version`);
   - the lines in the browser console (**F12**, *Console*) that start with **`sr2e | `**;
   - your **list of active modules** (and whether it still happens with them off).
3. Say what you did, what you expected and what happened, step by step. A screenshot helps.
4. Read the text before posting: error messages can name things in your world. Don't paste rulebook text.

Rules questions (how the system reads a rule) have their own form on the issue tracker.
