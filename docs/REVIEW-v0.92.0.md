# v0.92.0: rules interpretations and the layered Magic Pool. Review and live run

## What it is

**Rules interpretations.** The owner asked on 2 Nov 2026 to show players and the GM, subtly, where the rules as written aren't clear and a creator's interpretation was used.
- A registry (`rules/interpretations.ts`) holds 12 entries. Their text lives in `SR2E.Interp.List.<id>`: title, summary, gap, resolution and sources. Each entry names the house-rule switch that changes it.
- A small † (`interpMark`) appears beside the narrow Spell Pool dice on the strip and beside the formula price.
- A line of † links (`interpLine`) appears at the foot of test cards (`interpsForSnapshot`: learning, teaching, the other tradition, a cast or dispel inside Sorcery's narrow uses) and find cards (`interpsForFind`: legality, a contact, a fixer, a failed find).
- The Rules interpretations window (`applications/interpretations.ts`, `interpretations.hbs`) is grouped by area. It shows each entry's gap, resolution, sources and switch with its current value, plus a house-rules button for the GM. It opens:
  - from any † (a capture-phase click or Enter on `a.sr2e-interp[data-sr2e-interp]`, but not inside editors or fields);
  - from the SR2e tools window;
  - from the API (`game.sr2e.api.interpretations(id)`).
- There is a guide topic, `interpretations`.

**The layered Magic Pool** (`rules/magicpool.ts`, `RULES.MAGIC_V920`). These are the owner's decisions of 2 and 12 Nov 2026.
- The pool is Sorcery's rating for any magical action.
- The concentration's extra dice (its rating − Sorcery's) count only for actions inside it. The specialization's (its rating − the concentration's) count only inside the specialization, which sits inside its concentration.
- Narrow dice are spent first: specialization, then concentration, then general. They are held in `poolSpent.spellConc` / `spellSpec`, refreshed with the other pools, and may pay for that casting's Drain.
- The Magic cap per test still holds.
- A casting (`castSpell`, `castAtObject`) or dispelling test inside a narrow use rolls its rating (`castNarrow`), and the card says which.
- Matching is by name:
  - an action word: Spellcasting, Dispelling, Ritual (Spell Defense is left out: no defense allocation is wired to the layers yet);
  - the spell's own name;
  - the category named on its own ("Combat", "Combat spells").
- The strip shows the narrow dice left (+N) with a tooltip and a †.
- Switches back: `poolLayers` 'flat', `castNarrow` 'off', `drainNarrow` 'off'.

## Independent review (fresh agent)

3 bugs, 4 risks and nits. All bugs and risks are fixed, with tests in `__tests__/v0920.test.ts` ("review fixes").

Bugs:
- **B1:** a specialization pulled in a concentration made for another action (Spell Defense + Combat lit up every combat spell; Spellcasting + Combat leaked into rituals). A specialization now counts only where its concentration does.
- **B2:** a specialization named after a spell ("Combat Sense") matched its whole category. A category now matches only when named on its own.
- **B3:** dispelling rolled the narrow rating silently. It now has the card note and the † line.

Risks:
- **R4:** a specialization below its concentration rolled the lower rating; the rating is never below the concentration.
- **R5:** the cast dialogs offered Drain dice the Drain test can't take with `drainNarrow` off (`drainPoolFor`).
- **R6:** a Spell Defense layer showed on the strip but could never be spent; it is left out.
- **R7:** dispelling ignored the specialization's category; the dispelled spell's category and name now count.

Nits fixed:
- the click handler matches only the system's marks and skips editors and fields (N8);
- a find card has one † line (N9);
- the cast paths use one Sorcery lookup (N11);
- `narrow.layers` reflects the layers the cast falls inside (N13);
- the header comment matches the behaviour (N14).

Open nits:
- clicking a Spell Pool pip on the strip sets only the general dice; narrow dice come back at the refresh (N10);
- under the URR's Force casting the note still names the narrow rating (N12).

## Live run (12 Nov 2026, GM AI and ZZ Testplayer)

As GM:
- The test mage had Sorcery 4, concentration Spellcasting 6 and specialization Combat spells 8. It showed Spell Pool 4 with layers +2/+2, and a combat spell could use 8.
- Casting a combat spell rolled 8 + 5 pool dice (card "[Combat spells 8]") and spent specialization 2, concentration 2 and general 1. Drain took 1 more general die. The card's † line linked The layered Magic Pool and Casting with a concentration or specialization.
- Clicking the † opened the window at that entry (12 entries; the switch `MAGIC_V920.poolLayers = layered`; the GM's house-rules button).
- The strip read "SP 4/4 +4 †" with the layers in the tooltip, and Refresh pools cleared the narrow dice.

As a player:
- The API opened the window at the fixer entry, with no house-rules button.
- The card's † links were visible.

Clean-up: the ZZ actor and its cards were deleted. Actors (202), templates (1,042) and world time 0 are unchanged, and the Safehouse is viewed.

## Known limits

- Spell defense allocation uses general dice only (no Spell Defense layer).
- Conjuring, banishing and other Spell Pool uses don't take narrow dice.
- Interpretations are listed only for v0.91.0–v0.92.0's creator's calls. Older VERIFY placeholders aren't marked yet, so the registry is the place to add them.
