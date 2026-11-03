# v0.91.5 review: legality and permits

The plan's shop slice, split by the owner on 26 Oct 2026 into three: v0.91.5 legality and permits, v0.91.6 contacts and fixers, v0.91.7 spell formulas. The owner's answers: a restricted item (not Forbidden) can be found without a contact, only harder; a fixer will both add dice or find it for a fee (v0.91.6).

## What changed

- **Finding by legality** (`RULES.SHOP_V915.findByLegality` 'graded'; 'off' is the old way): the find test (`#findCore`, so Find… on a sheet item, Find & buy in the shop, kit lines and vehicles) gets a legality row (`findTn`: Needs a permit +0, Restricted +2, Forbidden +4) and the base time × `findTime` (1, 1, 2). The retry wait, Karma re-rolls and GM TN changes use the scaled time (the card's `deal.avHours`). Every other way of getting a thing (Buy now, the basket's order time, the vehicle order's floor) takes the same time through `itemAcquireHours`. Forbidden items are still on sale only when the GM allows them (`shopForbidden`).
- **Warnings** (`rules/legalbuy.ts` `legalWarning`): the find card (the legality kept on the card as an id, worded again from it), the item and vehicle sheets: what carrying it without a permit risks (the v0.58.0 fines). A licence (v0.61.0) covering it silences the warning. The shop's Legal column has a tooltip and the Catalogue page a note: how much harder it is to find, and what a permit takes.
- **Get a permit…** (`SR2Actor.getPermit('item:<id>' | 'vehicle:<uuid>')`, `RULES.SHOP_V915.permits` 'buy'): on an item sheet (the owning character pays) or a vehicle sheet (the character who bought it, else the user's own). A confirm dialog shows the cost (`permitCost`: 10%, at least ¥100; Restricted 25%, at least ¥500) and time (`permitDays`: 7, Restricted 30). Paid now; a `permit` project under Under way sets the Permit box when the time has passed (for a vehicle the checked call `finishPermit`), or at once with waiting off. With the approval queue on, a player's permit is a request (`getPermit` in the request methods; `methodRequestProblems` checks its reference and that the cost is what was filed; the approved run refuses a cost that has changed). Refused: no permit possible (Forbidden, legal), one held, one under way, a real licence covering it, not enough nuyen, a vehicle the player doesn't own.
- **The Permit box** is the GM's with bought permits: a player's sheet can't tick it on (`applications/permits.ts` `refusePermitTick`, in the item and vehicle sheets' form processing; the box shows disabled), and a player changing a permitted thing's legality loses the permit. 'tick' puts the old free box back.
- Bought copies (shop lines, vehicle copies) never bring their source's permit.
- House rules (*Time to get things*): `findByLegality`, `findTn.*`, `findTime.*`, `permits`, `permitCost.*`, `permitDays.*`. The guide (the shop, item sheets, vehicle sheets), `PLAYER-GUIDE.md`, `VERIFY.md` (a new section: every number is a placeholder), the changelog and README.

## Checking the output

`v0915.test.ts` (30 tests; 3,454 in all: 3,450 pass, 4 skipped; tsc clean): the pure rules, the find test's row, time and card, the old ways back, Get a permit… paid at once and under way, the refusals, the approval queue and an approved run, a vehicle's permit, the box's lock and legality change, the sheet row, bought copies, the acquire time, licences.

Checked live (GM AI and ZZ Testplayer, waiting on): a restricted catalogue entry found from the player's client (TN 4 + 2 with the *Restricted (found openly)* row; the template's ticked permit did not count), the GM's TN change re-wording the card with the warning; bought, its order bringing no permit; the rifle's sheet for the player (the box disabled with its hint, the button with cost and time, the warning); a forced tick refused with its notice; Get a permit… (the dialog, ¥1,000 paid, a 30-day project) finished by the GM's clock (the box ticked); changing the legality losing the permit; with the queue on, the knife's permit as a request ("Permit asked of the GM" on the sheet) approved from the Requests tab (¥100, a 7-day project credited to the player and the GM); the drone's permit from its sheet (paid by its buyer, finished by the checked call); the shop's Legal tooltip and the Catalogue page's note; the old ways (tick, off) back from the house rules. No console errors from the system (only the hidden pane's 0×0 canvas). The test world was put back (actors, template, chat lines, house rules, queue; world time unchanged).

## The independent review

| # | Kind | Finding | Outcome |
|---|---|---|---|
| R1 | Risk | A player could buy the cheaper permit (by changing legality) and switch back, or set the cost to 0 | Fixed for legality: changing it loses the permit. Cost stays the owner's to edit (as for every price on a sheet: a table rule) |
| R2 | Risk | Bought copies kept a template's or vehicle's ticked permit; the shop entry's permit silenced the card | Fixed: copies come without; only a sheet item's own permit counts |
| R3 | Risk | Buy now, the basket's order time and the vehicle floor skipped the legality time | Fixed: in `itemAcquireHours` and the floor |
| R4 | Risk | A vehicle permit with no wait could take the money and fail to set the box for a player who doesn't own the vehicle | Fixed: a player must own the vehicle |
| R5 | Risk | Warnings ignored licences and the rating | Fixed: a licence covering it silences the warning and stops a second purchase; the card passes the rating |
| N6 | Nit | Under way keyed by the vehicle's actor id | Fixed: the full uuid |
| N7 | Nit | The button stayed live while a request waited | Fixed: "Permit asked of the GM" |
| N8 | Nits | Unused `legalityPermit`, an unread update option, a misplaced comment, two switches not in the house rules | Fixed |
| N9 | Nit | Kits show no legality column | Kept (kit lines are found one by one, with the legality row) |

## Known limits

- The numbers are placeholders from memory (VERIFY.md).
- A player can still edit an item's cost and legality on their own sheet (as before); the permit follows the legality.
- Contacts and fixers (finding through someone) are v0.91.6.
