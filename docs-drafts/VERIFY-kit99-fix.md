# VERIFY changes: kit (v0.99.0 review fixes)

## Replacement rows

"| Lined coat |" (the v0.99.0 Rules completeness row, not the Core p. 242 data row):

| Lined coat | no effect | a worn lined coat (armor named so, with its Worn box ticked; one only carried doesn't count) adds 2 to the Concealability of every hideable carried weapon against looking someone over and frisking | Core p. 242 | `KIT_V99.linedCoat` |

"| Police check |":

| Police check | none | the GM's tool: the officer's Security or Police Procedures (an officer picked: the better skill, at most 20; else the dice typed) vs each restricted item's Legality number ±3 for enforcement (never below 2): 0 not noticed, 1 a warning, 2+ the officer presses (a permit or an arrest); every item type with legality fields (weapons, armor, gear, installed cyberware, foci, cyberdecks, programs, vehicles); an item's number is the stricter of its own and the GM's catalogue entry of the same type and name (the card notes when the catalogue's is the one used); only items in plain sight unless "everything they carry" is ticked; rolled on the GM's client, whispered to the GMs | Shadowtech p. 103 | `KIT_V99.policeCheck` (`policeTn`) |

## Replacement Accepted paragraph

**Accepted (player-writable, own character only):**
- weapon `smartgun2` (a weapon stat like `smartgun`; only the owner's own attacks).
- gear `chip.scope` (only how much of the owner's headware memory their own softs take).
- `legality` and `legalCode` on the owner's items: read by the GM's police check on the GM's client; the stricter of the code and the category counts, and the stricter of the item's own number and the GM's catalogue entry of the same type and name (the built-in templates and the world's catalogue, both GM-owned), so blanking an item's legality or setting it to legal doesn't drop a catalogue item from the check; the card notes when the catalogue's number was the one used. An item renamed away from its catalogue name, or one not in the catalogue, is checked by its own fields only: a player who edits their own items to hide one does so at their own risk.
- the carried items, ammunition, grenades, explosives' weights and Concealability read by the sniffer and the lined coat when a GM-side device or NPC searches a player's character (the same trust as the search's Concealability before v0.99.0).
- the frisk rows a player picks for their own character's search (as the search's free "other" modifier already allows); the strip search only on a GM's own client (not inside a player's action re-run as its author).

## New notes

Add to the kit section's **VERIFY notes:**
- The item sheet shows the new inputs only while their switch is at the book's way: the weapon's "Level II" box under `KIT_V99.smartlink2`, a chip's "Skill type" under `KIT_V99.skillMemory` or `KIT_V99.softReplaces` (only skillMemory reads it), the "Legality code" under `KIT_V99.policeCheck`. At `v980` they are hidden (as in v0.98.0); a value already typed stays on the item.
- The lined coat counts only when worn (`SR2Actor.carriedItems()` gives armor its Worn box; an entry with no worn field counts as not worn).
- The police check's catalogue match is by item type and name (case and outer spaces ignored), the world's catalogue first, then the built-in templates (`templatesFor`).

## Known limits

- The catalogue fallback can't see an item a player renamed (or one never in the catalogue); such an item is checked by its own (player-writable) legality, as listed under Accepted.

## Changed keys

The wording of these existing keys changes (counts read the same for one: no "1 successes", "1 standard rounds"); the new values are in `i18n-drafts/kit99-fix-replace.json` as `REPLACE:<key>`:
- `SR2E.Kit99.Sniff.standardRounds`, `SR2E.Kit99.Sniff.explosiveRounds`, `SR2E.Kit99.Sniff.fragGrenades`, `SR2E.Kit99.Sniff.smokeGrenades`, `SR2E.Kit99.Sniff.miniGrenades`
- `SR2E.Kit99.Sniff.row`
- `SR2E.Kit99.Police.head` (then run `node scripts/i18n-context.mjs`: docs/TRANSLATING-PARTS.md quotes it)
- `SR2E.Kit99.Police.row`

New key (`i18n-drafts/kit99-fix.json`): `SR2E.Kit99.Police.catalogue`.
