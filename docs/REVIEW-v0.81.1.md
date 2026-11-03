# v0.81.1: the second review pass, security included (24 Oct 2026)

The owner scheduled "one more pass on code review, including security" for 6:00 am. This is that pass. Rules values did not change: the shipped RULES and the Revamp patch dump identically to v0.81.0.

## How it was done
1. **Ten fresh reviewers** over the code as v0.81.0 left it. Each was told what v0.81.0 had fixed, and asked for what was still open, what the fixes broke, new bugs, and ways around the new security model:
   - three slices of `documents/index.ts`;
   - the sheets and templates;
   - the other application files;
   - three slices of the rules engine;
   - two security auditors.
2. **A hot-fix before the fix round.** A player's biography could run script on the GM's screen, because Foundry stores actor and item HTML fields uncleaned and `enrichHTML` doesn't clean them. `applications/richtext.ts` `cleanRichHtml` now cleans every rich-text field before and after enriching.
3. **Fixes in two rounds.**
   - In each round, three fixers worked on files nobody else was editing, and each fix has a test using the reviewer's failing input.
   - Each round was followed by independent reviewers who hadn't written the code: three after round 1, one after round 2 and one after round 3.
   - The lead fixed the last review's findings (every GM card queued too, the relay margin, house-rule cells) with tests from its probes.
4. **The HTML ratchet was rewritten.** The test helper is `__tests__/helpers/html-scan.ts` and the allow-list is `html-allow.ts`.
   - Escaping is recognised by symbol (an import of `escHtml`), not by name.
   - Casts and `toLocaleString` are looked through.
   - No constant-by-prefix shortcuts.
   - Sinks are judged whatever their shape: `innerHTML`, `insertAdjacentHTML`, `content:`, `flavor:` and tooltips.
   - Every allowed row is keyed by file, function and expression, with a reason. `documents/index.ts` lost its count of 37.
   - The `.hbs` triple-stashes are listed.
   - The reviewers' 35 bypass patterns are a fixture that must all be reported.
   - `npx tsx src/module/__tests__/helpers/scan-dump.mts` regenerates the list.
5. **A live run** as ZZ Testplayer against GM AI, before and after the fixes (`TESTPLAN-v0.81.md`, v0.81.1 section).

## The security model, as changed in v0.81.1
- **A GM re-running a player's card acts as that player.** This covers Change target number, Karma re-roll, Buy a success, Avoid disaster, Use again, Send ritual, Offer to grimoire, Detonate and the blast buttons.
  - `SR2Actor.runAsAuthor` sets the acting author.
  - Every "write directly or post an Apply (GM) card" choice in the resolvers follows what that player owns (`canWriteNow`, `isGmNow`).
  - A write guard (`registerActingAuthorHooks`) cancels any other write to a document the player doesn't own, and warns the GM.
  - Rules gates (the action economy, surprise, sending a ritual early) still follow the real GM.
- **One queue for GM authority** (`applications/gmlock.ts`). These run one at a time:
  - re-runs;
  - the GM's Apply (GM) steps (after their confirm, never around it);
  - auto-apply and auto-resist;
  - relay requests from players;
  - the round and world-time ticks.

  So a re-run can never overlap something that decides by the GM's rights, and a GM's own card never overlaps a player's re-run. Nothing inside a locked task may queue again (a task waiting more than 15 s warns the GM).
- **Relay timing.** A player's client waits 20 s for the GM. The GM's client drops a request whose turn comes more than 10 s after it arrived, so nothing is spent for a requester who stopped waiting. The round's timers are never dropped.
- **The routine rule.** A player's button acts on another player's character without a confirm only for a short list of routine tests (`ROUTINE_ACTIONS`: Defend, Resist, knockdown, an ordinary toxin, catching fire, taking cover and the like), with bounded values. Lasting harm always confirms: cyberware, deck damage, psychotropics, disease, overload, crashes and the like.
- **Auto-apply.** Tallies, site and host changes, alerts and background count never apply by themselves.
- **Test chains.** A card replaces an older card with the same test id only when both have the same author, or the newer one is by a GM.
- **Prompts.** A player's card prompts at most 12 targets on each client.
- **Chat styles.** A player's message keeps its colours and text styling; anything that positions, sizes or hides elements is dropped. GM messages are untouched.
- **Rich text.**
  - Cleaned before and after enriching, also in the editor's starting value (`richSource`).
  - Form controls, SVG animation and script URLs are removed.
  - An item card's picture keeps only a relative path or an http(s) URL.
- **Numbers from cards are numbers.** Every snapshot goes through `#cleanSnapshot` before it is resolved.
- **Bounds.**
  - Attributes and the Karma Pool are capped at 1000 in the schema (nuyen isn't capped).
  - Monitor boxes are capped at 100, pips at 50.
  - The importers' regexes are linear (whitespace runs are collapsed at entry), with a timing test.
- **Spell defense.** An ally's dice count when the ally covers the character:
  - the same owner;
  - a covering link (the new **Cover targets** button);
  - the same combat;
  - or tokens on the same scene with the same disposition.

  An enemy's dice never count. The spend is serialized per protector.

## Known limits (security), still open
- **What players can see.** Foundry sends every message and actor to every client; secrecy is in the interface only (unchanged).
- **Notifications.** 731 `ui.notifications` texts interpolate names unescaped. Foundry cleans them, so the worst left is markup in a toast. A count ratchet keeps the number from growing; sweep them later.
- **A GM's own typing during a re-run.** A chat message the GM types by hand in the second or two a re-run takes is authored as that player.
- **Unlocked GM buttons.** These GM-only buttons don't take the GM queue yet: Barriers, Spell wall, Start fire, Jam weapon, Evict, Confirm deed, Region detect and Remove bug. The same goes for the GM's own Defend and Resist clicks.
- **Styles.** A player's message can still use a large border or padding: layout noise, not an overlay.
- **The house-rule report at load.** On the upgrade load, it can list rules the 0.81.1 migration has just moved.
- **Forged projects and the draft flag** (from v0.81.0): unchanged.

## Behaviour changes worth knowing
- **GM re-runs.** A GM's TN change or Karma re-roll on a player's card now posts Apply (GM) cards for what that player doesn't own, exactly as the player's own re-roll would.
- **Surgery.** Rebuilt from the documents: the cyberware item, the care type from the rules table, and the payment state from the patient.
- **Vehicles.**
  - A timed repair or mod install on a vehicle the mechanic's players don't own ends in a GM card (`applyVehicleJob`).
  - Each job settles once.
  - Up-front money goes back if the vehicle is deleted.
- **Cleansing.** A player's timed cleansing ends in a GM card. A cleanse is capped at 20 points, the highest background count.
- **Flash grenades.** A player's flash on someone they don't own ends in a GM card (`applyTimedStatus`).
- **Summoning re-rolls.** Re-rolling after the spirit exists goes through a GM card and checks that its services haven't changed since.
- **Detonate.** A charge whose spent explosive stack was deleted still goes off at its recorded Power (at most 200). A pre-v0.81.0 card goes off only on the GM's confirm.
- **Spirits.** A spirit handed back to nobody has no summoner.
- **Tallies.** A tally key must name a real actor. IC can be a tally source.
- **Training.** Training whose skill or attribute is gone refunds its Karma, at most 100.
- **Smaller fixes:**
  - Burning and "Use again" follow the combat whose round ticked.
  - A burning character outside the tracker burns with their scene's combat.
  - Chase positions and sensor locks carry their combat.
  - Paralysed observers can perceive; unconscious and dying ones can't.
  - A stored charge, a Detonate and a tally refuse what isn't on record.
- **House rules.**
  - Each value must have its default's kind. Only the two tables that mix kinds by design take either kind: `COMBAT.reloadFeed` ('all' or a number) and the concealment table ('blind' or a number).
  - House rules refused at load are whispered to the GM by the 0.81.1 migration.
- **Character import.** Weapons written as a bare damage code ("Shuriken 4L") import as weapons again.
- **Token Action HUD.** Action names lose `<` and `>`.
- **Availability.** "8/2–3 days" with an en dash parses.

## Refactors suggested (not done; the owner decides)
The v0.81.0 list stands (`REVIEW-v0.81.md`), plus:
- **Async context.** Pass an explicit "acting as" context through the resolvers instead of the module-wide `actingAuthor`. That would let a nested call run inline safely and drop the queue for GM UI clicks.
- **Notifications.** Wrap `ui.notifications` once in a helper that escapes, and drop the count ratchet.
