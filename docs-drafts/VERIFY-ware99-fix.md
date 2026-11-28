# VERIFY draft: v0.99.0 review fixes, cyberware and bioware (RULES.WARE_V99)

Section: "#### Cyberware and bioware effects (v0.99.0, RULES.WARE_V99)".

## Replacement rows

"Cyberlimb Strength and Quickness":

| Cyberlimb Strength and Quickness | the limb's fields as entered (new limbs Strength 4, Quickness 4) | a cyberlimb's Strength is at least 3 (a troll's 8), its Quickness at least 3 (VERIFY: no built-in Quickness in the book; the Strength base is used); a full limb's points past 3 of enhancement cost .4 Essence a point of Strength and .3 a point of Quickness, added to the limb's Essence (a troll's Strength past 8 at once, VERIFY: "Strength enhancements higher than 8 cost … .4 per point" read as no free points over the troll base); hands, feet and lower limbs never. A limb from before v0.99.0 (stamped once by the 0.99.0 migration with its Strength and Quickness then) or from a statblock that states its Essence is charged only for points above its stamp, so its own Essence cost is not paid twice (a Strength 8 arm at 1.8 stays 1.8; raised to 9 it costs .4 more). The enhancement counts wherever the limb's Essence does: the derived Essence, `SR2Actor.essenceOf` (removing the limb gives back what it cost), and the surgery's size points and TN. The sheet row shows the limb's own numbers and the enhancement Essence; tests and attacks the player marks as made with the limb use them (as before, with the book numbers) | Cybertechnology pp. 49–51 | `WARE_V99.limbs` (`limbStrength` 3, `limbStrengthTroll` 8, `limbQuickness` 3, `limbFreePoints` 3, `limbFreePointsTroll` 0, `limbStrengthEssence` .4, `limbQuicknessEssence` .3) |

"Orthoskin and dermal plating":

| Orthoskin and dermal plating | both count (a warning) | installing one beside the other is refused for a player (a GM is only warned; inside a GM's re-run of a player's card the player's refusal applies), and when a player's write still leaves the pair installed (their client skipped the refusal) the lead GM whispers the GMs (nothing is changed). A character who has both working: only the better counts, orthoskin's armor (impact + ballistic) against the plating's Body counted against both kinds (2 × rating), the plating winning a tie; plating at Light damage (`CLINIC_V99.damageLevels`) is compared at half its Body, plating at Moderate or worse is not working and orthoskin counts alone (and is no longer cut by the old conflict rule); the loser gives nothing and the sheet says which counts. With `GEAR_V923.dermal` 'armor' the old "only the armor above" conflict rule stays | Shadowtech p. 17; Shadowtech pp. 36–41 (damage levels) | `WARE_V99.orthoskin` |

"Boosted reflexes, wired reflexes and a control rig":

| Boosted reflexes, wired reflexes and a control rig | allowed together (only the stacking rule: the better reflexes count) | a player switching on (or creating installed, or operating in) wired reflexes or a vehicle control rig beside installed boosted reflexes, or the other way round, is refused with a warning (the item stays or is created uninstalled; the rest of the change goes through); a GM is only warned, but inside a GM's re-run of a player's card the player's refusal applies. When a player's write still leaves the pair installed (the refusal runs on the writer's client), the lead GM whispers the GMs (nothing is changed). A character who has both gets a sheet warning; the better reflexes count (the stacking rule), a control rig keeps its level (VERIFY: the book only forbids the pair, so the GM decides which one goes) | SSC p. 87; Cybertechnology pp. 98–99 | `WARE_V99.boosted` |

## Replacement Accepted paragraph

**Accepted (player-writable, own character only):** the refusals are client-side checks on the player's own character (as the v0.96.0 foci limit): a player who gets around them gains only what the sheet still allows (the better reflexes, only the better of orthoskin and plating), and the lead GM is whispered when a player's write leaves such a pair installed (S9; nothing is undone). The limb's Strength and Quickness fields and its Essence cost are the player's own item fields as before; the book reading only raises a weak field to the base and adds Essence. `flags.<system>.limb99Paid` on a cyberlimb (the points its own Essence already prices; written by the 0.99.0 migration and the statblock importer): a player can raise it on their own limb to skip the enhancement Essence, which is no more than they could already do by typing a lower Essence cost into the limb (each point counts at most 40); it only changes their own character's Essence. Nothing here is read by a GM-side decision against someone else.

## New notes

- The section's intro: replace "No new fields, no flags." with "No new fields; one item flag, `limb99Paid` on cyberlimbs (the 0.99.0 migration's stamp)."
- Delete the "Cut / still not built" bullet "An existing limb's Essence: …" (fixed: the migration stamps existing limbs).
- Migration 0.99.0 ("Cyberlimb enhancements already priced in their Essence"): on the lead GM, once, stamps every cyberlimb (world actors, the items an unlinked token's own delta holds, world items) with `limb99Paid = { strength, quickness }` from its fields; a stamped limb is skipped, so it is safe twice. The GM is asked to back up first (it changes data). New limbs carry no stamp. The statblock importer (NPC import, character import, the catalogue's import) stamps a cyberlimb whose block states its Essence; one whose Essence it guesses (the base cost) gets none.
- Notifications now escape the item names where they are passed (`tx(key, { name: escHtml(…) })`), as the other v0.9x glue does, instead of escaping the whole text.

## Known limits

- A world that already ran a pre-release v0.99.0 build has migration version 0.99.0 stored and will not run the stamp: run `game.settings.set('<system id>', 'migrationVersion', '0.98.0')` and reload as GM (or the lead may give the step a later version).
- A limb whose owner had not typed its enhancement into its Essence cost before v0.99.0 is stamped too, so it keeps costing what it did (no new Essence for those points).
- The GM whisper (S9) covers writes the lead GM's client sees after they land; it does not undo them.
