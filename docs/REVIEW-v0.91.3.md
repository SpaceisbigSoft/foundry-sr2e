# v0.91.3 review: the Catalogue

The owner (25 Oct 2026): "as part of this shop addition, we also need to create an easily browseable compendium of all the things the players can acquire using the system's current database (either the one imported or created by users in the world) ... the items at the shop can open a link to the compendium page for it". The owner's choices: its own window; players see what the shop shows them; built next (vehicles move to v0.91.4).

## What changed

- **The Catalogue** (`applications/codex.ts`, `templates/codex.hbs`; pure parts `rules/codex.ts`): one window with a tab per kind a character can get (weapons, armor, gear, cyberware, foci, programs, cyberdecks, spells, adept powers), the shop's categories and search on the left, and the picked entry's page on the right.
  - The lists are what the shop reads (`entriesFor`: the GM's catalogue templates, the built-in templates, world items, compendium items), filtered for players by the shop list (`entryShown`).
  - A page: picture (or the tab's icon), kind, category and source; the list's summary line; price (Street Index on hover), Availability, Street Index and legality; **Stats and details** (the new-entry form's fields for its kind, codes written back as a stat line has them: 9M, (STR+2)L Stun, (F/2)+1S, 15 (c), 5/20/40/60, 3/3/3/3; blanks and zeros left out); the description.
  - A page is read through `resolveCatalogueKey` (`applications/shop.ts`; the same checks as a shop key: the user's shop list, forbidden things, pack and item permissions; never a kit line). The description has the GM's secret sections taken out, is cleaned, enriched (secrets off, relative to the item) and cleaned again.
  - **Buy…** opens the shop at the entry (a search for its name); **Learn…** (spells, adept powers) opens the Add window set to Learn with Good Karma where that is offered. The GM also has **Open the item** (world and compendium items) and **In the shop**.
- **Links:** an **i** beside every shop row opens its page (clicking it doesn't tick the row); a **Catalogue** button in the shop; a Catalogue tool in the SR2e tools window and the left toolbar; `game.sr2e.api.openCatalogue({ type, key })`.
- The shop's `openShop` takes `{ type, query, shop, payment }`; `SR2AddWindow.show` takes `query` and `payment`.
- Open Catalogues and shops read their lists again when the GM changes the shop list, the catalogue, a world item or which compendiums are shown.
- The guide: a topic "The Catalogue"; the changelog and README.

Rules values are unchanged.

## Checking the output

3,414 tests (3,410 pass, 4 skipped), tsc clean. `v0913.test.ts` (12 tests): the tabs, a page's stats for each kind (codes, bioware, adept power points, the price line kept out, long text cut), every built-in template's page, link targets, the wiring, and `resolveCatalogueKey` against the shop list modes, forbidden items, kit lines and a hidden compendium (mocked Foundry).

Checked live (GM AI and ZZ Testplayer): the GM's Catalogue (168 weapons with a test world item) and a page with every part; a test description's secret section and an `onerror` image attribute never shown; the player's Catalogue without the forbidden test item; with the shop list set to "marked", the player's weapons tab showing only the marked test item; Buy… opening the player's shop (Find & buy) searched to the entry; Learn… on a spell opening the Add window on Learn with Good Karma; a shop row's i opening its page without ticking the row; the narrow layout. No console errors from the system. The test world was put back (shop list "all", test items and character removed).

## The independent review

| # | Kind | Finding | Outcome |
|---|---|---|---|
| B1 | Bug | Clicking a row's i also ticked the row | Fixed: clicks on an action in the name cell don't tick; test; checked live |
| R1 | Risk | If enrichHTML failed, the fallback could show a secret section | Fixed: secret sections are removed before enriching (parsed inert); relative links resolve against the item |
| R2 | Risk | A double click during the first load could open two windows | Fixed: the one window is kept from its creation |
| R3 | Risk | Showing or hiding a compendium didn't refresh open lists | Fixed: Catalogue and shops re-read on the compendium configuration change |
| R4 | Risk | A page read before a refresh could be cached after it | Fixed: a generation count |
| R5 | Risk | Learn… opened on Free | Fixed: Learn with Good Karma where offered; checked live |
| R6 | Risk | No behavioural test of the page's permission checks | Fixed: `resolveCatalogueKey` tested against every list mode, forbidden, kits and a hidden pack |
| N | Nits | Kind label lowercase; summary line missing; price line hidden with no price; one note for every mode; page kept its scroll; wide images; broad live regions; double render on marking; `openCatalogue(null)`; a misplaced comment | Fixed |
| N | Nits | Choice values shown as ids ("combat", "mana"), as in the new-entry form; tab names from `typeLabel` (as the shop's); Buy… searches by name; gear pages show few stats (the new-entry form's gear fields); the two windows import each other (functions only at load) | Kept |

**For the owner:** spells and adept powers are learned, not bought, so the shop list (and the Catalogue) shows players all of them, as the Add window always has.
