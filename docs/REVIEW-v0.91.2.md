# v0.91.2 review: a tidier shop

Inserted by the owner (25 Oct 2026): "the categories and list needs a cleanup pass, too many things in the same window. add checkboxes to sort by things like melee/ranged, pistol/smg/rifle/etc.. do that for all the different categories".

## What changed

- **Categories** (`rules/shopfilters.ts`, pure): every shop tab has check boxes above the list. Weapons: Melee, Pistols, SMGs, Rifles, Shotguns, Heavy weapons, Launchers, Grenades & explosives, Thrown, Bows, Other. Armor: body, helmets, shields, add-ons. Gear: ammunition, accessories, medical, drugs, electronics, media, vision, surveillance, chips, explosives, survival, IDs, magical supplies, other. Cyberware: headware, bodyware, cyberlimbs, cyberweapons, bioware. Foci, programs, decks and spells by kind. Each item is classed from its fields first (melee, blast, shotgun, heavy, specialization, optics, radio, medkit…), else its name. None ticked shows everything; categories with no rows on the tab aren't shown; the list is sorted by category, then name. Ticks and the search work together.
- **Shop mode** (`applications/adding.ts`): the Shop button opens only the tabs that sell things, titled "Shop: name", set to buy (a player: Find & buy or Buy now; the GM: Free and Buy now; in character creation every way to pay). The + on a sheet's heading still opens every tab.
- A tidier list: the source names Catalogue / Built-in, long compendium names cut short (the full name on hover), the Legal column only where something on the tab has a legality.
- The guide's "Adding things" topic mentions the categories. The changelog and README.

Rules values are unchanged.

## Checking the output

3,402 tests (3,398 pass, 4 skipped), tsc clean. `v0912.test.ts` (10 tests): weapons, armor, gear, ware, foci, programs, decks and spells by class; every built-in template in a listed group with a label; the review fixes below; every field the classifier reads is in the compendium index.

Checked live (GM AI and ZZ Testplayer) on the owner's catalogue (1,042 templates; only group counts and a few weapon names were looked at): the Shop window shows only the sellable tabs; check boxes per tab filter with the search; weapons: launchers (grenade launchers, MGL, mortar, LAW) under Launchers, flamethrower and MP-LMGs under Heavy, grenades, Shuriken and Throwing knife where they belong; gear "Other" 17 of 390. The title follows the mode when an open window switches between Add and Shop. No raw keys, no console errors. The test world was put back.

## The independent review

| # | Kind | Finding | Outcome |
|---|---|---|---|
| B1 | Bug | "Grenade launcher" listed under Grenades | Fixed: launchers are tested first; test |
| B2 | Bug | "Flamethrower" listed under Thrown (`/throw/`) | Fixed: flame weapons are heavy; Thrown reads the skill's word start; test |
| B3 | Bug | "Ares MP-LMG" listed under SMGs | Fixed: heavy before SMG ("submachine gun" kept out of heavy); test |
| B4 | Bug | "Explosive sniffer" and "Battery recharger" under Explosives | Fixed: sniffers, detectors and scanners are electronics; `charges?` anchored; test |
| B5 | Bug | The footer said "hidden by the search" for rows a category hides | Fixed: "not shown now"; test |
| R1 | Risk | Compendium rows lacked the fields the classifier reads | Fixed: added to the index; a test keeps them in step |
| R2 | Risk | Firearms with no specialization fell to Other | Fixed: by concealability and firing modes (pistol, SMG, else rifle); test |
| R3 | Risk | The title stayed stale when an open window changed mode | Fixed: the title is passed on render; checked live |
| R4 | Risk | The Shop button in character creation lost Free | Fixed: in creation every way to pay is kept; an NPC's shop is the same as its + (Free) |
| R5 | Risk | The classifier ran inside the sort comparator | Fixed: each entry classed once per render |
| R6 | Risk | Broad gear words (scope, optic, library, instrument, ear, control rig) | Fixed: anchored or narrowed; surgical tools medical; control rigs headware; tests |
| R7 | Risk | Long compendium names widened the table | Fixed: cut short with the full name on hover |
| N | Nits | Shared hidden-row helper, "other" groups for unknown spell categories, `restore` program, count "of", "Catalogue (item)" label, locale sorting, aria-live, brittle source tests, stale ticks on a vanished tab | Kept for later; none changes what a user sees today beyond the wording |
