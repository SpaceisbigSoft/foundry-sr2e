# v0.91.4 review: vehicles and drones in the shop

The plan's shop slice (renumbered after the owner inserted v0.91.2 and v0.91.3): vehicles and drones found, bought and delivered through the shop, with pages in the Catalogue and kinds in the new-entry form.

## What changed

- **Vehicles have a price:** `cost`, `availability`, `streetIndex`, `legality`, `permit` on the vehicle model; a *Cost and legality* section on the vehicle sheet ("No price set: players can't buy it in the shop" when the cost is 0). The world's 169 catalogue vehicles have no price yet (the catalogue file had none: the converter kept costs in the notes), so the GM sets them, or a catalogue file with the fields fills them.
- **A Vehicles tab** (characters) in the shop and the Add window, and in the Catalogue: the GM's vehicles for sale (`vehicleForSale`: in the *Catalogue (SR2e)* actor folder tree, or marked *In the shop*; never one a player owns) and vehicles in Actor compendiums the user can see. Shop key `actor:<uuid>`; the shop lists treat world vehicles as the GM's catalogue. Categories: cars, bikes, trucks & vans, hovercraft, boats & ships, aircraft, other; ground, air, water and other drones. A row's summary: Handling (on/off-road), Speed, Body, Armor, a drone's Pilot. One per row; no Blank button.
- **Buying:** find and haggle as anything else. A purchase or gift is made on the GM's client (`SR2Actor.vehicleShopAsGm`; a player's goes over the relay, op `vehicleShop`), which checks it all again: the user owns the character; the key is read in that user's shop; the price is the list price moved no further than haggling can; the money; the approval queue (for the player, not the GM's client); a wait of at least what ten successes would take; a gift only from the GM (or approved). Paid now; with waiting on, the order is recorded in a GM-only world setting (`vehicleOrders`) and an *order* project names it; `deliverVehicle(orderId)` uses the record up and makes the copy, or gives back what the record says was paid. Only the GM cancels a vehicle order (refunding the record's amount).
- **The copy** (`makeOwnedVehicle`): owned by every player who owns the buyer and by the purchaser (never everyone by default), in the *Owned vehicles* folder, marked `boughtBy`; no ids, owners, shop mark, other system flags or live state (damage, speed, controller, occupants, locks, chases, jamming); linked token; its compendium source kept. A chat line says it arrived.
- **The Rigging tab** lists the character's vehicles and drones, and shows for a character who owns one even without a control rig or deck. Their sheet re-renders when one arrives or goes.
- **New entry…** has *Vehicle* and *Drone* kinds (`VEHICLE_COLUMNS`, the Handling shorthand "4/8"; a bare number first is the Handling, then the vehicle table's order). The GM's goes into its catalogue subfolder (`catalogueFolderFor`; marked in the shop when no folder could be made); given to a character it is their own copy; a player's goes to the GM to review.
- The guide (the shop, vehicle sheets, Rigging, the Catalogue), the changelog and README.

Rules values are unchanged.

## Checking the output

3,429 tests (3,425 pass, 4 skipped), tsc clean. `v0914.test.ts` (15 tests): keys and list modes, prices and categories, the stat-line reader and builder, Catalogue pages, a vehicle for sale and its copy (mocked), the order record (mocked), and the wiring of the relay, the GM's checks, the project call, the Add window and the Rigging tab.

Checked live (GM AI and ZZ Testplayer): the Vehicles tab (the owner's 169 catalogue vehicles plus test ones, categories with counts, no Blank); the player's find and buy over the relay (paid, ordered, the wait floored), the order recorded and named by the project; a player's cancel refused; a forged order project delivering nothing; the GM's cancel refunding the record's amount; a vehicle with no price refused; a player's direct gift refused; with the queue on, a direct relay purchase refused and an approved request delivering to the player; the GM finishing orders: copies in *Owned vehicles*, owned by the player, live state cleared, a chat line; the Rigging tab listing them; a Catalogue vehicle page; a drone from New entry… into *Catalogue (SR2e)/Drones/Rotor Drones*. No console errors from the system. The test world was put back (test actors, folders and chat lines removed; the queue off; world time unchanged).

## The independent review

| # | Kind | Finding | Outcome |
|---|---|---|---|
| B1 | Bug | A forged order project gave a player any vehicle (hidden, forbidden, unmarked), free | Fixed: orders are a GM-only record; a project names only an order id, used up once, for its own buyer; checked live |
| B2 | Bug | An order that couldn't be delivered kept the money | Fixed: the record's amount is given back |
| B3 | Bug | A single Handling number shifted every column | Fixed: it is the first column; test |
| B4 | Bug | An approved free vehicle request was refused | Fixed: the GM's approval is consent |
| R1 | Risk | A relay timeout let Buy be pressed again | Fixed: the card stays spent, with a note to look first |
| R2 | Risk | The relay trusted the player's side (queue, wait, gifts) | Fixed: queue checked for the player, wait floored, gifts GM-only; the price within the haggle range and nuyen the owner can edit are accepted (as for items) |
| R3 | Risk | A thrown error after payment kept the money | Fixed: read as "not made", refunded |
| R4 | Risk | Default-owned buyers' players didn't own the copy | Fixed: every player who owns the buyer |
| R5 | Risk | Every vehicle update reloaded the lists | Fixed: only changes the lists show; folder changes too |
| R6 | Risk | The Rigging tab didn't show a new vehicle | Fixed: the buyer's sheet re-renders |
| R7 | Risk | The request check showed the filed price, not the charged one | Fixed for world vehicles (read from the vehicle); a line without a key is a problem |
| R8 | Risk | A vehicle saved without a folder wasn't for sale | Fixed: marked in the shop |
| N | Nits | Pack branch by text, compendium source and item ids lost, extra flags copied, link label characters, double escaping, compendium actors on the relay, drone kept on a vehicle, English fallback name, a misplaced comment | Fixed |
| N | Nits | NPC purchases are free (as for items); the delivery card's link is the buyer's to open | Kept |

**Kept risks:** the player's nuyen and a price within the haggle range are the player's to set (as for items); a forged order project names no order and delivers nothing, but the GM still sees a "couldn't be finished" line.
