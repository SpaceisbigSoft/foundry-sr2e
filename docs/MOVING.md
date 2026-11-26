# Moving a world to the new system id (v0.93.1)

Up to v0.93.0 this system's id was `sr2e`. Another Shadowrun 2e system for Foundry uses `sr2e` too, so the two fought over the same install folder and could open (and change) each other's worlds. From v0.93.1 the id is **`shadowrun2e_unified`**. Both can now be installed side by side.

Foundry has no button to change a world's game system ("you cannot change the game system once a Game World has been created"), so a world made with the old id is moved in two steps: you change one line by hand, and SR2e does the rest the first time the GM opens the world.

## Before you start

- **Back up the world.** On Foundry's setup screen open **Worlds**, then the world's **Backups**, and make one. Or quit Foundry and copy the world's folder (`Data/worlds/<your world>`).
- Only worlds made with **this** SR2e (the one from SpaceisbigSoft/foundry-sr2e) need moving. A world made with the other `sr2e` system belongs to that system; leave it alone.

## Steps

1. **Install the new version.** On the setup screen open **Game Systems**, click **Install System**, and paste this manifest address:
   ```
   https://github.com/SpaceisbigSoft/foundry-sr2e/releases/latest/download/shadowrun2e_unified.json
   ```
   It installs as a separate system (folder `Data/systems/shadowrun2e_unified`). Keep the old `sr2e` one until all your worlds are moved.
2. **Quit Foundry** completely.
3. **Open the world's `world.json`** (in `Data/worlds/<your world>/`) in a plain text editor (Notepad is fine, not Word).
   - Change `"system": "sr2e"` to `"system": "shadowrun2e_unified"`.
   - If the file has a `"packs"` list (your world's own compendiums), change each `"system": "sr2e"` there the same way.
   - Save the file.
4. **Start Foundry and launch the world.** Log in as a Gamemaster.
5. SR2e asks: **move this world to the new system id**. Click **Continue**. It copies everything the world stored under the old id to the new one:
   - every document's SR2e data (flags) on actors, items, scenes, tokens, journals, chat cards, combats and users, including unlinked tokens and the world's own compendiums;
   - the world's settings (house rules, the rules source, kits, presets and the rest);
   - stored file paths: token art, the scene backdrops, icons, compendium links, and the sheet each document or type was set to use.
   A chat card tells the GM what was moved, by kind of document. **Reload the world (F5) after the card arrives**, so every setting takes effect.
6. **Players:** each player's own settings (theme, layout, sounds, hotkeys…) live in their browser. They come across the first time that player logs in to the moved world.

That's all. The normal update steps run after the move, and the world carries on as before.

## If something goes wrong

- **Nothing old is deleted.** The move copies; it never removes the old data. If it stops part-way, it runs again at the next load.
- **To go back:** quit Foundry, change `world.json` back to `"system": "sr2e"`, and open the world with the old system (v0.93.0). Anything you did after the move lives only under the new id, so it won't show there. Restoring your backup is the clean way back.
- If the world shows **Requires System Update** on the setup screen, the new system isn't installed (step 1), or `world.json` has a typing mistake.

## What doesn't come across

- **Modules' own data about the system** (for example a Token Action HUD layout saved for `sr2e`): set it again.
- **The guided tours'** "seen" marks: the tours show as new once.
- **Macros you wrote yourself** keep working: the scripting names (`game.sr2e`, the `sr2e.*` hooks) did not change. A macro that reads flags directly (`flags.sr2e…`, `getFlag('sr2e', …)`) needs the new id: `flags.shadowrun2e_unified…`, or `getFlag(game.system.id, …)`.

## On The Forge

The Forge doesn't let you edit `world.json` in place: export the world, change the line in the export's `world.json`, and import it again, then follow step 4 onwards. Pictures the Forge served from its Bazaar copy of the old system (addresses with `bazaar/systems/sr2e/<version>/`) are pointed at the new folder name but keep the old version number in the address; if a token shows a broken picture, pick its art again (the token art button on the sheet).
