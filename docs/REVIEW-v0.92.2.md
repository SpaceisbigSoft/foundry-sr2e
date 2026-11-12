# v0.92.2 — release testing

Plan step: release testing (in-Foundry test batches with a full live pass, an upgrade test from an old world, module compatibility, a performance test). Fixes from it go into this version.

## In-Foundry test batches (Quench)

`src/quench/sr2e-quench.ts`, registered on Quench's `quenchReady` hook (nothing runs without Quench). Batches, each as a GM in a test world, each removing what it made (its `ZZ Quench …` actors, its own chat cards, combats, windows, a temporary scene; world time put back; Combat Turns don't move world time while a batch runs):

| Batch | Tests |
|---|---|
| `sr2e.api` | the API's version and functions; the success test |
| `sr2e.documents` | every actor and item type is created and prepares without NaN; every sheet opens with no console error and no untranslated key in any tab |
| `sr2e.rolls` | attribute and skill tests post their cards; a melee attack on a target; a soak card; a combat rolls initiative and moves through turns |
| `sr2e.sheet921` | tweaks, Carried (weight, a weapon left behind can't attack), accessories read from a description, a negation (skipped when the world has those house rules set back) |
| `sr2e.translation` | the language file, every setting's name and hint, every type label, no empty text |
| `sr2e.migrations` | the world is at this version; every actor and item prepares without NaN and passes its schema |
| `sr2e.performance` (opt-in) | a busy table: 50 tokens, a 50-combatant combat through two rounds, 300 cards, a sheet, damage on every token |

Results: 31/31 in SR2E AI Test (202 actors checked), in a copy of a v0.72 world, and as ZZ Testplayer (everything skips; nothing made, no window closed).

## Upgrade test

Two worlds made from Foundry's own backups of the test world:
- **ZZ Upgrade Test v0.72** (an October backup, system 0.72.0, 22 actors, 123 items, one scene): the 0.77.0 and 0.81.1 migrations ran; every document passes its schema with no NaN; all 22 actor and 123 item sheets open clean; all 20 old weapons attack, Defend and Resist work; the scene's 24 tokens show their bars; the Quench batches pass.
- **ZZ Upgrade Test v0.50** (an earlier backup, system 0.50.0; one character): the 0.59.0, 0.77.0 and 0.81.1 migrations ran; its sheet opens and rolls.

Both worlds can be deleted from Foundry's setup screen.

## Modules

| Module | Version | Result |
|---|---|---|
| Item Piles | 3.3.4 | nuyen, prices, quantities, filters set; a transfer of an item and nuyen between two characters works |
| Health Estimate | 36.0.0 | the provider reads the SR2 tracks; hosts, sites, safehouses and barriers left out |
| Monk's Enhanced Journal | 14.01 | its dark backgrounds set once (v0.91.7) |
| PopOut! | 2.24 | its button on SR2e sheets |
| Dice So Nice | 6.4.5 | the SR2e colour set on tests; Rule of Six re-rolls in the gold set |
| Token Action HUD Core | 2.1.2 | the system's own HUD (attributes, tests, skills, combat, magic…); a test and an attack run from it |
| Simple Calendar Reborn | 2.6.1 | follows world time (a Combat Turn moves it 3 s, the undo moves it back); see the clock below |
| libWrapper, socketlib, Tokenizer 2, Hex Size Support, Quench | | load with no errors |

No current ruler module for Foundry v14 was found (Elevation Ruler and Drag Ruler are verified only up to v12); the core v14 token ruler with the system's movement ranges is what was tested.

## Performance (SR2E AI Test, the built-in browser pane, full speed)

| Measure | Result | Budget |
|---|---|---|
| 50 tokens placed | 868 ms | 15 s |
| a turn change (50 combatants) | 77 ms | 400 ms |
| a test card (300 posted) | 120 ms | 400 ms |
| the chat log redrawn (300 cards) | 154 ms | 4 s |
| a character sheet opened | 115 ms | 3 s |
| damage on 50 tokens at once | 1.7 s | 15 s |
| canvas frame rate, idle / 234 SR2e cards in the log | 144 / 144 fps | |

A frame rate read while the browser pane is hidden is unreliable (a background page); with the pane shown, 50 tokens idle at about 143 fps, and the batch (which now waits for Dice So Nice's queued 3D dice before measuring) read 67 fps after 300 cards and 66 after damage on every token. The frame rate drops only for a moment: about a second after damage on all 50 tokens (the floating numbers), and while a hundred unanswered defense prompts are open (69 fps). The pane can't throttle its own CPU, so the budgets leave about four times headroom for a slower computer.

## Found and fixed

1. **A calendar module's jump of world time ran every timer** (found when Simple Calendar Reborn set the date on first load: +57 years). New: the system's clock (`rules/clock.ts`, `helpers/clock.ts`, `applications/clock.ts`). A jump of a week or more outside combat asks the GM: **Count it as time passed** (as before) or **Only the date** (the system's clock keeps the whole days off, so every timer keeps its time left; the time of day stays the calendar's; an exact jump back undoes it). The system's own clock moves (the Scene tab's buttons, the undo log) always count. All 117 timer reads use the system clock; only the undo log, the Scene builder's time of day, the advancement log and the time shown to people read Foundry's. House rules `RULES.CLOCK_V922` (`bigJump: ask | count`, `bigJumpDays`, GM tools). Checked live: a 1-hour Blind survives a 20-day date-only jump and ends an hour later.
2. **Accessory ratings** missed in common phrasings: plural "gas vents 3", "(2)", "(rating 3)", ", rating 2", "recoil compensation (3)", "scope (2)", and a magnification after a low-light or thermographic scope (a v0.92.1 known limit).
3. **A weapon left behind** still showed in the Token Action HUD (with Reload and Clear jam), as the status strip's readied weapon and in a grunt group's stat line.

## Independent review

A fresh agent reviewed the diff: 3 bugs, 3 risks, 2 nits, all fixed:
- the batches deleted every chat message posted during a run (now only their own: this user's, about a test actor);
- a player's run closed every window and failed in cleanup (now nothing starts for a non-GM);
- a combat test's Combat Turn moved world time, so real timers in the world could tick (the round length is 0 during a run);
- cleanup stopped at its first error (each step stands alone; the scene is removed in the same pass);
- a bracketed Roman numeral read as a rating ("gas vent (I think)"), and "2 x spare clips" after a vision scope as magnification;
- a vehicle's mounted weapon with an old Carried tick was hidden from the rigger's HUD (vehicles are left alone now);
- the v0.92.1 batch failed in worlds with those house rules set back (it skips there); `Hooks.once`.
- `src/quench` is outside the source scans of `src/module`: `__tests__/v0922.test.ts` checks it builds no HTML, translates nothing and registers only on Quench's hook.

## Tests

3,629 automated tests (3,625 pass, 4 skipped), tsc clean; 31 Quench tests plus the performance batch (5 tests, about a minute).

## Known limits

- An item handed over through Item Piles keeps its Carried tick (a weapon left behind arrives left behind).
- Quench's window must be open while batches run (its reporter draws into it).
- A big jump made while no GM is logged in is settled by the first GM's client that sees it (the ticks wait for that).
- The question appears for one GM (the lead window); a second GM sees only the whispered note.
