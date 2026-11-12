# v0.91.8 — spell formulas: review and live run

## What it is

The owner's decisions (11 Nov 2026):
- a formula is **a kind of gear** (`system.formula` on a gear item, no new item type);
- out of creation a character **needs a formula** to learn (or a teacher, the group's grimoire, their own design);
- **a teacher's** Instruction test helps the student's own learning test, and an NPC teacher charges;
- **the other tradition's** formula is allowed but harder.

Switches in `RULES.FORMULA_V918` (`rules/config91.ts`); every number VERIFY (`docs/VERIFY.md`, "Spell formulas and teachers").

## Layout

- `rules/formulas.ts` (pure):
  - prices and Availability: `formulaPrice`, `formulaAvailability`;
  - the shop key: `formulaKey` / `parseFormulaKey` (`formula:<force>:<tradition|->:<the spell's key>`);
  - the gear and what it covers: `formulaGearSystem` (strips the caster's fields), `formulaCovers`, `bestFormula` (the learner's own tradition first);
  - the other tradition: `learnerTradition`, `isForeign`, `foreignAdjust`;
  - teachers: `teacherDice`, `teacherFee`, `canTeach`.
- `applications/shop.ts`: `resolveFormulaKey` makes a formula key into the gear it sells. It reads the spell through the user's Catalogue, so `findFromShop`, `buyFromShop`, haggling, the approval queue and orders all work unchanged. It still resolves with formulas switched off, so orders already placed arrive.
- `applications/formulas.ts`: the three dialogs (Buy a formula…, Learn from the formula, Learn from a teacher…) and `teacherChoices` (only actors the user may see).
- `documents/index.ts`:
  - `learnFormula(name, system, from, { origin, formulaId, teachMessage })`. A design or the grimoire needs no formula; anything else does (`#formulaSource`).
  - `raiseSpellForce(spell, force, { formulaId, teachMessage })`, `learnFromFormula(itemId, force)`.
  - `learnFromTeacher(teacherUuid, spell, force)`: the teacher's card, a plain test with `snap.teach`.
  - `learnTaught(messageId)` returns `'used' | 'refused'`.
  - `#teachHelp` reads the help again from the card: author, student, spell and Force; the teacher's Sorcery, fee and tradition are recomputed.
  - `#canStudy` and `#payTeacher`: the fee is only paid when the study can go ahead.
  - `#learnSiteProblem` (shared with the learning test), and `foreign` / `extraDice` on the learn snapshot.
- Sheets:
  - the shop/Add window's scroll on spell rows (`buyFormula`);
  - the shop's Spells tab while formulas are on (players: Learn only);
  - the item sheet's *Spell formula* section and *Learn this spell…* (`learnFormulaItem`);
  - the character sheet's teacher icon by *Spells* (`learnFromTeacher`);
  - the card button `learnTaught` (chat.ts `onLearnTaught`, flag `taught`).
- Gear stacking: `formula.spell/force/tradition/category` are stack fields (two different formulas never stack); `formula.data` is ignored.
- Guide topic `spell-formulas` (a general topic: the formula's heading names it with `data-help`).

## Independent review (fresh agent)

3 bugs, 5 risks, 4 nits. All the bugs and risks are fixed, with tests in `__tests__/v0918.test.ts`.

Bugs:
- **B1:** a teacher's card could be used again after a failed learning test. It is now spent once the learning test is rolled or the request filed; a study refused before that leaves it usable.
- **B2:** the fee was paid and the learning then refused (no Sorcery; the site rule on block). `#canStudy` now runs before any fee.
- **B3:** the teacher's own exclusive/fetish choices were taught. The data now goes through `formulaSpellData`.

Risks:
- **R4/R5:** the request and card carried the help (dice, fee). Only the card's message id travels now, and `#teachHelp` works everything out again on the client that runs it, the GM's for an approved request.
- **R6:** a call without an origin skipped the formula check. Now only `design` and `grimoire` do.
- **R7:** the shop's Spells tab offered Free to players. A player gets only Learn there; a row's scroll buys.
- **R8:** the teacher list showed hidden NPCs. It now lists only actors the user can see (LIMITED).

Nits:
- The header comment named a Catalogue button that doesn't exist (fixed).
- Formula keys stopped resolving when switched off (fixed).
- Open: "Give it free" doesn't stack with an identical formula already held.
- Open: a GM renaming a formula's spell leaves the old spell's data.
- Open: a plain gear item can't be turned into a formula on its sheet (the GM makes formulas in the shop).

## Live run (11–12 Nov 2026, GM AI and ZZ Testplayer)

As GM:
- Learn without a formula was refused, with no Karma spent.
- *Buy now* of a Force 4 combat formula cost ¥4,000. It went on order for 7 days (waiting on) and arrived when world time passed. Its data kept the spell's category.
- *Learn this spell…* at Force 3 ran the learning test (TN 3, Sorcery 5) and started the study.
- A shamanic NPC teacher (Instruction 4, Sorcery 3) taught a hermetic mage:
  - 3 successes gave +3 dice, and the fee was ¥400;
  - the learning test ran at TN 6 (+2, the other tradition) over 8 days (×2).
- The card was spent; a second click said so, with nothing charged and no card posted.
- The Add window's Spells tab showed a scroll on every row and the note. The Buy a formula dialog opened (Force, tradition, Buy now / Give it free).

As a player:
- Finding a formula posted the Availability test card (Etiquette default, TN 2 + 4 defaulting).
- The teacher list showed only actors the player can see; the hidden NPC teacher wasn't listed.

Clean-up: the ZZ actors, their cards and the test template were deleted, and world time was put back to 0. The Safehouse is untouched.

## Known limits

- The teacher's card can be re-rolled with the teacher's Karma Pool before it is used. Once used, the student's learning card has its own re-roll.
- The fee is paid when the learning test is rolled, so it is not refunded on a failed test, as the card says.
- Formulas are sold for every spell the user's Catalogue shows. The GM's shop list (all / catalogue / marked) doesn't filter spells, as before.
- Built-in templates: a formula's name is in the language of the client that made it.
