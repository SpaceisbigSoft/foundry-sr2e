# VERIFY changes: v0.98.0 fix vsec (review findings S1, S2, P5, P6, P10, C6, C8/P12, motion sensor)

For docs/VERIFY.md, section "#### Building security and vehicle upkeep (v0.98.0, RULES.VSEC_V98)". Each replacement row is quoted by its first cell.

## Replacement rows

Row "Accessing a rigged system":

| Accessing a rigged system | not built | the site's Technical Rating (TN) and Vigilance Code (Blue 1 … Red 4 successes); the GM's request card for tap (tap rating + Electronics), decryption (module + Intelligence), protocols (emulation module + Intelligence); the intruder's owner rolls; the lead GM pins the first roll card for the request (its id and dice) on the GM's request card when it is posted; the GM's Apply takes only that card (without a pin: the first roll card still in the chat), checks its author owns the intruder, re-counts its dice with the request's dice and TN, confirms (gmMay), then records the step on the site or (failed decryption/protocols) puts the site on alert (`accessAlert`, default active, VERIFY: the book says "on alert"); a pinned card later deleted, or whose dice differ from the pinned ones or don't make the test, counts as a failed test (a deleted one gets the GM a card with its own Apply); the request is used up (a flag the GM writes on the request) once applied | Rigger 2 p. 79; CSH p. 104 | `VSEC_V98.access`, `accessAlert` |

Row "Rigger combat":

| Rigger combat | not built | the tool rolls the opposed Willpower Test (TN the other's Willpower; the attacker's Control Pool dice up to their Willpower, spent); the winner does (Willpower)L Stun, +1 level per 2 net successes; a tie nothing; the loser's owner resists from the GM's card: Body vs the Power, Control Pool dice up to Body (spent); the resistance card names the damage card, and the lead GM marks the damage card resisted (only from a resistance card whose author owns the loser); a GM may resist a card already marked after confirming | Rigger 2 p. 79; CSH p. 105 | `VSEC_V98.riggerCombat` |

Row "The rigger's decking penalty":

| The rigger's decking penalty | none | a character with a VCR: +1 TN on every Matrix test (`matrixTestMods`), Hacking Pool − VCR level; none with two installed datajacks (decker's and rigger's, VERIFY: a datajack is an installed ware item of the datajack kind or with "datajack" in its name) | Rigger 2 pp. 16, 18 | `VSEC_V98.riggerDecking` |

Row "Repair parts":

| Repair parts | not shown | the repair card: parts = 5% of the vehicle's cost (with its installed mods' prices: each mod's own cost, else its table price as the sheet shows it) per box repaired, the vehicle's Availability | Rigger 2 p. 26 | `VSEC_V98.repairParts`, `repairPartsPercent` 5 |

Row "Modification prices and install tests": append to the "Now (book)" cell:

"; an installed table item without its own cost is priced from the vehicle's stats before it went in (the level it reached); the Install dialog lists, for each mechanic, the skill the Installation Test rolls (the item's own Electronics or Computer B/R first)"

## Replacement paragraph

Paragraph "**Accepted (player-writable, own character only):**":

**Accepted (player-writable, own character only):** `vsec98Resisted` on a rigger combat loser's actor (the damage cards they have resisted): read only when that player clicks Resist (it stops only themselves); a GM's Resist never reads it. Resisted state the GM side relies on is `vsec98Done` on the GM's own damage card. The rigger decking penalty reads the decker's own VCR rating and their own installed ware (a player can already change their own Matrix dice). Everything the GM side decides about a site (Technical Rating, Vigilance Code, levels, recorded access steps) is on the site; an access step's first roll (`vsec98First`) and its use (`vsec98Used`) are on the GM's request card, written by the GM side; the success comes from the request card the GM posted and the dice of the pinned roll card, whose author owns the intruder. Nothing on the player's roll card (its `vsec98Applied`, its re-written rolls) is trusted.

## New notes

- Fix S1/S2: a lead-GM `createChatMessage` hook (`applications/vsec98.ts` `registerVsec98`, registered in `sr2e-system.ts` next to `registerMxOps97`) pins an access request's first roll card and marks rigger combat damage cards resisted; a `deleteChatMessage` hook posts the GM a card when a pinned roll card is deleted before it was applied. The hooks' writes go through the GM lock and are marked as the GM side's own (`sr2eRelay`).
- Fix C6/P5: the GM's Apply (access) and Resist (rigger combat) write steps run under the GM lock after their dialogs (inline inside a card's re-run); Roll, Apply and Resist ignore a second click while the first is running.
- The resistance test's card (`resistRiggerCombat98`) carries the damage card's id in its test snapshot (`vsec98HitId`).

## Known limits

- An access roll posted while no lead GM is connected is not pinned; the GM's Apply then takes the first roll card still in the chat (a failed card deleted before the GM was back cannot be told apart).
- Motion and vibration sensors read the distance from the intruder's token movement history (Foundry v14 `TokenDocument.movementHistory`). VERIFY live: the token's owner can most likely change it (Foundry v13+ has `TokenDocument#clearMovementHistory`, and the history is a field of the token the owner may update; no Foundry source in the cloud to confirm), so a player can make their character look as if it moved less. The detection card (GM-only) shows the metres it used; the GM adds the movement modifier by hand when it looks wrong. Not taken GM-side (it would need a per-move record written on every token move).
