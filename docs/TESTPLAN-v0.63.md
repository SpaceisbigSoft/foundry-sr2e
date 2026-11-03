# v0.63.0 live-test plan (written by a fresh agent from the diff; condensed)

Setup (GM AI): ZZ Runner (human character, owner ZZ Testplayer; Quickness 4, Intelligence 4, rest 3; ¥5,000; Good Karma 20; no items), ZZ Other (ZZ Testplayer Observer), ZZ Ganger (NPC, also an unlinked token), ZZ Spirit, ZZ Van (vehicle). Keep the GM panel Log tab and the console open.

## A. Add window (ZZ Testplayer on ZZ Runner)
1. Every list heading has a +; Weapons + opens "Add to ZZ Runner" on Weapons, search focused.
2. Tabs: Weapons, Armor, Gear, Cyber/bioware, Spells, Adept powers, Foci, Powers, Cyberdecks, Programs, Skills.
3. Templates listed: Heavy pistol "9M · SA · Firearms" ¥450, Light pistol ¥350, Knife ¥30.
4. Search "firearms pistol" → the three pistols.
5. Tick / click a name ticks; number change auto-ticks; nothing ticked greys out Add.
6. Pay change keeps ticks; tab change clears ticks and search; + from the sheet on another tab clears them too.
7. A second + brings the same window forward on the asked tab.
8. Skills tab: only the explanation and "Open the skill picker".
9. "Blank gear" makes "New gear" and opens its sheet (no card, no ledger).

## B. Paying
10. Buy Heavy pistol ×2 + Medkit qty 3: footer "2 ticked · ¥1,500"; nuyen 5,000 → 3,500; ledger "Bought Heavy pistol, Medkit"; public card; two pistols, Medkit ×3.
11. Buy Medkit qty 2 → stacks to ×5, ¥400. A Medkit with another rating makes a new row.
12. Buy Armor jacket: "Arrives worn" unticked by default for Buy → (not worn).
13. Buy Datajack with "Arrives installed" ticked: installed, Essence 6 → 5.8.
14. Spells: Pay offers Free and Learn with Good Karma. Learning goes through learnFormula: with learning tests on (default), a Sorcery learning test card; Karma paid on success; a known spell is refused; refused spells stay ticked.
15. Free Power focus rating 3, bonded: no money; GMs get a whisper of the free add.
16. GM Free add: no card.
17. NPC: every tab Free only, no money line.
18. Bought focus/program: the number is locked to the listed rating.
19. Copies above 20 are capped to 20 and charged for 20.

## C. Refusals
20. Not enough nuyen: red total with the reason; Add warns, nothing changes.
21. Unpriced bought item: "has no price" warning.
22. Van: Weapons, Gear, Programs only.

## D. Skill picker
23. Attribute guessed: Firearms → Quickness, Car → Reaction, Unarmed Combat → Strength, Etiquette → Charisma, Sorcery → Willpower, other → Intelligence; a hand pick sticks.
24. Firearms 3, Pistols, spec rating 0 → saved as 4; Karma cost shown live equals the sum of the ⊕ step costs; Karma, ledger and card.
25. Knowledge kind: list and attribute (Intelligence, greyed) change.
26. Duplicate name refused; empty name refused; too little Karma refused (no skill made).
27. A second click on + while the picker is open: "already open".

## E–F. Double clicks, permissions
28. Double-click Add ticked: one purchase. Double-click Duplicate: one copy.
29. Observer (ZZ Other): + warns, no Edit/Play button, search and folding work, row inputs read-only.
30. Unlinked token's sheet: adds go to the token only.

## G–K. Toolbar, Play mode, folding, row edits, duplicate, pins
31. Search hides non-matching rows on every tab with tab badges; Enter does nothing; Escape clears; typing survives a re-render.
32. Edit → Play: +, duplicate, delete, skill pen and add/delete of contacts, geasa, qualities, mods hidden; name, metatype, attribute base, Essence, Magic locked; attribute Mod, grunts down, gear quantity, Combat Pool spent, monitor boxes, pool pips, attacks, casts and rolls still work. Remembered per actor and browser across reloads.
33. Folding: heading click folds (not its buttons); stays folded across re-renders, tab switches and reloads; search shows folded rows.
34. Row edits: skill rating, gear quantity (min 0), spell Force (min 1), focus rating, adept level; decimals floored; selecting text in them doesn't drag the row.
35. Duplicate names: Knife (copy), Knife (copy 2); a duplicated installed Datajack arrives not installed (GM + Shift keeps it).
36. Pins: weapon, skill, spell, usable power; pin bar buttons attack, roll, cast; deleted pinned items vanish from the bar.

## L–N. Warnings, other sheets, existing features
37. Setup banner: "No skills yet…", uninstalled cyberware, spells without Magic or Sorcery, empty gun, missing weapon skill, item warnings, failed saved build checks; links switch tab, unfold, scroll and flash; the banner's open state survives a re-render.
38. Spirit: Attacks/Powers/Skills +; Van: Weapons and Cargo +; toolbar on both.
39. Drag-and-drop from the sidebar still works; hotbar drag still works; the gear cart (Find and buy) still works; ⊕ raises still work.
40. Undo (GM panel): one Add is one step; undo removes the items and puts the nuyen back.
41. Light theme and a narrow sheet: Add window header and footer readable; no horizontal scroll.
42. Console: no errors from adding.ts or sheettools.ts; clean up ZZ actors, cards, localStorage keys sr2e.folded and sr2e.sheetMode.
