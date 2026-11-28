#### Gear: smartlinks, skillsofts, concealment, searches and the law (v0.99.0, RULES.KIT_V99)

Switches in `RULES.KIT_V99` (`rules/config99/kit.ts`, house-rules window: Gear); the pure functions are `rules/kit99.ts`, the Foundry glue `applications/kit99.ts`, the GM's tool "Police check (book rules, GM)" (`kit99`). The first choice is the book's way (the default); `v980` puts v0.98.0 back. New fields: weapon `smartgun2` (a "Level II" box beside Smartgun), gear `chip.scope` (the soft's "Skill type"), and `legalCode` on every item with a legality (the book's Legality code, e.g. 6P-CC).

| Rule | Was | Now (book) | Source | Switch |
|---|---|---|---|---|
| Smartlink Level II | the smartlink's level changed nothing but the table row | with a Level II receptor in use (a level 2 smartlink on its row, or Level II smart goggles on theirs) and a Level II smartgun: a called shot +2 instead of +4 (a −2 row), with a rangefinder carried or implanted −1 at long and −2 at extreme range, a linked launcher (a fired blast weapon with no Intelligence of its own) −1 | FoF pp. 57, 84–85; FoF errata v1.1 (called shot) | `KIT_V99.smartlink2` |
| Smart goggles | the −1 row only by hand; with the smartlink's row both added | worn smart goggles (gear at hand named so) tick their row by themselves for a smartgun when there is no smartlink implant; with the smartlink's row ticked only the smartlink counts | Core pp. 90, 241 | `KIT_V99.smartGoggles` |
| Skillwires | each activesoft capped at the Skillwire Rating alone | the running activesofts share the rating in slot order (a later one gets what is left) | Core p. 249 | `KIT_V99.skillwires` |
| A skillsoft replaces the skill | the better of the soft and the character's own skill | a running soft is used at its rating only, even below the character's own; Sorcery and Conjuring can't be softs | Core p. 248 | `KIT_V99.softReplaces` |
| Skill Memory Table | rating × 3 Mp in headware memory | the table's Mp by skill type (general / concentration / specialization, the chip's new field; a linguasoft is a language) and rating 1–10 | Core p. 248; Shadowtech p. 48 | `KIT_V99.skillMemory` |
| Lined coat | no effect | a worn lined coat adds 2 to the Concealability of every hideable carried weapon against looking someone over and frisking | Core p. 242 | `KIT_V99.linedCoat` |
| Manual detection (frisks) | only the frisk's own −2 | the frisk dialog's three rows: professionalism (PR 1 +2, PR 2 +1, PR 3+ 0), time (cursory +2 … nearly a strip search −3) and the searcher's state (intimidated +2, in control −2); a GM's strip search finds every weapon | NAGRL p. 93 | `KIT_V99.manualSearch` |
| Chemical sniffer | a test per explosive item vs its Concealability (else 4); ammunition not sniffed | an explosive detector rolls its rating once vs 10, −1 per 8 standard rounds, 6 explosive rounds, 1 frag/concussion grenade, 2 smoke/flash grenades, 3 mini-grenades, 30 g explosive, 100 g plastique (each or part), never below 2; a success finds every item of the load (loaded guns and clips too) | NAGRL p. 93 | `KIT_V99.sniffer` |
| Police check | none | the GM's tool: the officer's Security or Police Procedures (an officer picked: the better skill, at most 20; else the dice typed) vs each restricted item's Legality number ±3 for enforcement (never below 2): 0 not noticed, 1 a warning, 2+ the officer presses (a permit or an arrest); only items in plain sight unless "everything they carry" is ticked; rolled on the GM's client, whispered to the GMs | Shadowtech p. 103 | `KIT_V99.policeCheck` (`policeTn`) |

**VERIFY notes:**
- Skillwires: the book says the rating "limits the total rating of all the ActiveSofts in use"; a soft that doesn't fit runs at what is left (not refused), as the system already capped a single soft.
- Smart goggles beside a smartlink: the book gives each its row; only one receptor feeds the cross hairs, so only the smartlink's counts (this system's reading).
- Smartlink II: the rangefinder is any carried gear or installed cyberware named "rangefinder"; the launcher bonus applies to any fired blast weapon with no guidance (grenade launchers, rockets), not to thrown grenades or missiles. Level II goggles and smartgun accessories by name ("II" / "Level 2"); the weapon by its new box.
- The lined coat covers every carried weapon (the book's "any weapon hidden under it"); scanners aren't affected.
- The sniffer: a launcher's loaded rockets count as one grenade each, its grenades as mini-grenades; gas grenades with smoke/flash; custom and demolition charges as frag grenades; an explosive with no weight set counts as one lot; a clip with rounds 0 ("fills the weapon") as one round per clip; plastique by name.
- The police check: one test per restricted item (the book uses the number as the TN of "the officer's test"). An item with no Legality code takes its category's number (needs a permit 6, restricted 4, forbidden 2: house-rule numbers, a reading of Shadowtech pp. 103–104's ranges); with a code the stricter (lower) counts. "In plain sight" uses the search's rule (weapons and worn armor with Concealability 0); a concealed item needs a search first (the GM ticks "everything they carry" after one finds it, or when the officer suspects).
- The frisk keeps RULES.GEAR.concealment.friskTn (−2) beside the NAGRL rows.

**Cut / still not built:**
- ActiveSofts giving no Dice Pools (Core p. 248): no Dice Pool here comes from an Active Skill's rating, so nothing to take away.
- The skillsofts' prices (Mp × 150¥ / 100¥ / 50¥, Core p. 248): the chip's cost stays as entered.
- Macroplast weapons' +1/+2 Concealability against metal detectors only (NAGRL p. 92) and a detector's own Concealability (noticing it first).
- The officer's Perception Test for concealed items inside the police check (use a search, then tick "everything they carry"); the permit check itself (the card lists the legality notes, permits and licences for what the officer presses on).
- The searcher's NAGRL dice (Intelligence) for a frisk: the frisk keeps the system's Perception dice.

**Accepted (player-writable, own character only):**
- weapon `smartgun2` (a weapon stat like `smartgun`; only the owner's own attacks).
- gear `chip.scope` (only how much of the owner's headware memory their own softs take).
- `legalCode` on the owner's items: read by the GM's police check on the GM's client; the stricter of the code and the category counts, so a player can't loosen an item beyond its (equally player-writable) category. A player who edits their own items to hide one from the check does so at their own risk.
- the carried items, ammunition, grenades, explosives' weights and Concealability read by the sniffer and the lined coat when a GM-side device or NPC searches a player's character (the same trust as the search's Concealability before v0.99.0).
- the frisk rows a player picks for their own character's search (as the search's free "other" modifier already allows); the strip search only on a GM's own client (not inside a player's action re-run as its author).

**Lead's to-do:** merge `i18n-drafts/kit99.json`, then run `node scripts/i18n-context.mjs` (docs/TRANSLATING-PARTS.md gains the `SR2E.Kit99.Police.head` row); until the merge v0891, v0894, v0898 and v0921 fail on the missing keys (checked: they pass with the draft merged).
