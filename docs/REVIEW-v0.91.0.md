# v0.91.0 review: the shop, core

The owner's decisions of 25 Oct 2026 ("the shop: buying through the systems already built"), first slice. Before this, buying was two paths that never met: the Add window's Buy now (paid at once, no Availability test) and Find… on an item already on the sheet (the real test, with Buy and Haggle on its card).

## What changed

- **The Add window is the shop.** Every row on the buying tabs shows its price with the Street Index (the index on hover), Availability and a **Legal** column.
- **Find & buy** (`RULES.SHOP_V91.buying` 'find'): a player character out of the creation wizard buys by finding first. **Find ticked** posts one find card per row (a kit line by line): Etiquette (else Charisma) against the Availability TN, with the lifestyle, Street Cred and the Karma Pool, as Find… on a sheet item always did. The card carries the shop key (`flags.sr2e.buy.shop`), not an item id; nothing goes on the sheet until it is bought. The GM, NPCs and characters in the wizard keep Buy now; the house rule 'now' gives everyone Buy now again. An item sheet's **Buy** finds first for such a buyer.
- **Buy** on the card (`SR2Actor.buyFromShop`) reads the entry again from its source (`applications/shop.ts resolveShopKey`: the GM's templates, the built-in templates, world items, compendiums, kit lines), in the buyer's shop; prices it for the quantity, held to the haggling range; pays; and makes the item, or (waiting on) an *order* that arrives after the find time (`addLines` with the agreed price and wait). **Haggle** works on shop cards too.
- **The approval queue:** Buy files a `buyFromShop` request carrying the price and the wait; the card is spent (`requested`). The GM's approval checks the entry in the filer's shop.
- **A failed find** (`RULES.SHOP_V91.retry` 'wait', VERIFY) may be tried again once its base Availability time has passed in world time; the wait is kept per thing in `flags.sr2e.findRetry`, shown on the row, cleared when it is found or bought. The GM is never held back. Sheet items' Find… waits the same way.
- **What players see:** world settings `shopList` (everything / only the GM's catalogue and kits / only what the GM marks "in the shop") and `shopForbidden` (Forbidden items hidden unless on). The GM sees a **Shop** column on the buying tabs to mark world templates (`shop: true`, kept in catalogue files) and world items (`flags.sr2e.shop`). Open shops re-read when any of it changes.
- **Open orders** on the GM panel's Requests tab: every order on its way, with change the time, deliver now and cancel (refund).
- Guide topics (The shop, Under way, The approval queue, Item sheets), `docs/PLAYER-GUIDE.md`, `docs/VERIFY.md` ("The shop"), the changelog and the README.
- **Files:** `rules/shop.ts`, `rules/config91.ts` (pure); `applications/shop.ts` (Foundry glue, imports no window code so documents/index.ts can use it); `applications/adding.ts` (the window, `addLines`' shop path); documents/index.ts (`findFromShop`, `#findCore`, `buyFromShop`, `haggle`, `#findRescored`); chat.ts, approvals.ts, ui.ts, sheets.ts, qol.ts, catalogcsv.ts, settings.ts; templates `add-window.hbs`, `gm-panel.hbs`.

Rules values are unchanged; the two new rules are switches.

## Checking the output

3,370 tests (3,366 pass, 4 skipped), tsc clean. The new `v0910.test.ts` (24 tests) runs the rules, and the find, buy, haggle, retry, queue and approval on the glue stubs, plus each review fix.

Checked live (GM AI and ZZ Testplayer, two tabs): the player's Find & buy and the GM's Buy now; a find card with the shop key; Haggle then Buy; double clicks on Buy pay once; orders under Open orders, delivered now, by world time, and cancelled with a refund; a failed find's wait on the row, refused retry, the GM not held back; the queue (two requests of the same thing, the card spent, Approve buys, Decline whispers); the shop list modes and the Shop column for a template and a world item (the player's window refreshed by itself); Forbidden hidden and allowed; the house rule back to Buy now; the item sheet's Buy finding first; a kit found line by line (1.5 h kept); a world item found and bought; free adds; an NPC unchanged; no raw text keys; the guide topic; no console errors from the system. The test world was put back as it was.

## The independent review

| # | Kind | Finding | Outcome |
|---|---|---|---|
| B1 | Bug | An approved compendium purchase failed when the GM client hadn't seen the filer (the compendium item's own ownership was tested, not its pack's), and the request was lost | Fixed: a compendium item is checked through its pack; test |
| B2 | Bug | Two queued purchases of the same thing collapsed into one request (same label) | Fixed: shop requests never replace each other (`fileRequest` `keepOthers`); test, live |
| B3 | Bug | `buyFromShop` reported "requested" when nothing was filed, killing the card | Fixed: the filing's result; test |
| B4 | Bug | A failed find turned into a success by the Karma Pool or the GM's TN change kept its retry wait; `buyItem` never cleared it | Fixed: re-scored found cards and `buyItem` clear it; test |
| R1 | Risk | With the queue on, a hand-made Buy now add request skipped the find and the Forbidden filter | Fixed: the GM-side check refuses Buy now adds from a character who must find, and Forbidden lines; test |
| R2 | Risk | A wait of 0 from a card made a tested item arrive at once; find times under 1 h were cut to 0 | Fixed: 0 becomes the base time; the fraction is kept; test, live (1.5 h) |
| R3 | Risk | Packs were listed at Observer but resolved at Limited | Fixed: Observer both ways; test |
| R4 | Risk | Buy or Haggle could run twice on one card while the slower shop path ran | Fixed: one deal at a time per card on a client; live |
| R5 | Risk | The retry wait is per source (the same item via another source isn't held), and the flag is on the player's actor | Kept: a table rule, like the approval queue |
| R6 | Risk | No GM button to drop a wait; it needs world time | Kept: the GM's own find isn't held, and the house rule turns the wait off |
| R7 | Risk | The creation wizard also follows the shop list (Forbidden hidden by default) | Kept: the owner's "what players see" covers creation shopping; the setting allows Forbidden |
| R8 | Risk | Saving over, taking in again or replace-importing a template dropped its shop mark (and changed its id) | Fixed: id and mark kept; test |
| N | Nits | An unused context value; raw keys in a notice; an unguarded lookup stopping a find run; refused rows unticked; world-item marks not refreshing open shops | Fixed (the rest: expired waits not pruned, old id-less kits, a double notice, fixed colspan, a declined card stays spent: kept) |
