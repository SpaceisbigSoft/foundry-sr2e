# VERIFY changes: v0.98.0 fix2 vsec (second-round findings R1, R2)

For docs/VERIFY.md, section "#### Building security and vehicle upkeep (v0.98.0, RULES.VSEC_V98)". Each replacement row is quoted by its first cell.

## Replacement rows

Row "Accessing a rigged system":

| Accessing a rigged system | not built | the site's Technical Rating (TN) and Vigilance Code (Blue 1 … Red 4 successes); the GM's request card for tap (tap rating + Electronics), decryption (module + Intelligence), protocols (emulation module + Intelligence); the intruder's owner rolls; the lead GM pins the first roll card for the request (its id and dice) on the GM's request card when it is posted; the GM applies it from the roll card or from the request card's own "Apply the pinned roll" button (which works from the pin alone); only the pinned card counts (without a pin: the first roll card still in the chat, and the GM's confirmation says the pin is missing and how many roll cards there are); its author must own the intruder; its dice are re-counted with the request's dice and TN; the GM confirms (gmMay), then the step is recorded on the site or (failed decryption/protocols) the site goes on alert (`accessAlert`, default active, VERIFY: the book says "on alert"); a pinned card later deleted, whose dice differ from the pinned ones or don't make the test, or which no longer names its request, counts as a failed test (a deleted one gets the GM a card with its own Apply, the request found from the GM's request cards); the request is used up (a flag the GM writes on the request) once applied | Rigger 2 p. 79; CSH p. 104 | `VSEC_V98.access`, `accessAlert` |

## New notes

- Fix2 R1: the `deleteChatMessage` hook and `lostRoll` find the request by scanning the GM's open request cards for a pin naming the deleted card's id; the deleted card's own flags (player-written) are not read, so stripping or changing its `vsec98Res.reqId` before deleting it no longer dodges the failure. The GM's request card carries an "Apply the pinned roll" button (GM only, under the GM lock, once via `vsec98Used`), so a player who edits the roll card's flags or content can't keep the GM from reaching the pinned roll. A pinned card whose `vsec98Res.reqId` no longer names the request counts as failed.
- Fix2 R2: when the lead GM's window is ready (after the GM windows settle), each open request with no pin gets the earliest roll card still in the chat pinned, marked `unpinned`; the GM's confirmation says the roll was pinned late. Without any pin, the confirmation says so and how many roll cards for the request exist.

## Known limits

- Replaces the fix1 limit "An access roll posted while no lead GM is connected is not pinned …": such a roll is pinned when the lead GM next comes online (marked late, shown in the confirmation); a failed card deleted before then still cannot be told apart, and the GM is told the pin was late or missing.
