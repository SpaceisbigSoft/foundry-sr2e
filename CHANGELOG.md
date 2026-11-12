# Changelog

This is the history of the unofficial Shadowrun 2nd Edition system for Foundry VTT (system id `sr2e`), newest version first. Every rules change since v0.70.0 has a house-rule switch that puts the old behaviour back. The system was built with AI (Anthropic's Claude) under human direction, and it has not yet been play-tested at a real table.

## v0.92.0 — Rules interpretations and the layered Magic Pool (12 Nov 2026)
- **Rules interpretations (†):** where the rules as written leave something unclear, the system uses the creator's reading and now marks it with a small †: beside the narrow Spell Pool dice on the sheet's strip, on the formula price, and as a line of links at the foot of a chat card (learning from a formula or teacher, the other tradition, a cast inside Sorcery's concentration or specialization, a find where legality counts, a contact's help or a fixer, a failed find to retry). Hover for a one-line summary; click to open **Rules interpretations** at that entry: what is unclear, how it is resolved, the sources, and the house rule that changes it. The whole list is in the SR2e tools window.
- **The layered Magic Pool:** the Spell Pool is Sorcery's rating for any magical action; Sorcery's concentration adds its extra dice only for actions inside it, and the specialization its extra dice only inside that. Sorcery 4, Spellcasting 6, Combat spells 8: a combat spell can use up to 8 pool dice (still at most your Magic on one test), a health spell 6, anything else 4. Narrow dice are spent first and can pay for that casting's Drain. The strip shows them beside the pool.
- **Casting with a concentration or specialization:** a spell (or dispelling) inside Sorcery's concentration or specialization rolls its rating, like other skills; the card says which.
- The GM can put the old flat pool and plain Sorcery back in the house rules (*Magic and critters*).

## v0.91.8 — Spell formulas (11 Nov 2026)
- **Spell formulas:** out of character creation a magician learns a new spell from a formula they hold, from a teacher, from their group's grimoire, or from a spell they designed. A formula is gear: the scroll on a spell's row in the shop or the Add window opens **Buy a formula…** (the Force and the tradition), and it is found, haggled, bought, approved and delivered like anything else. It can be given, traded or sold.
- **Learn this spell…** on a formula learns it (or raises a spell you know to a higher Force) with the usual learning test and Good Karma. Learn in the Add window uses a formula you hold by itself. Raising a Force needs a formula of the new Force.
- **Learn from a teacher…** (the teacher icon by the *Spells* heading): anyone in the world who knows the spell at that Force can teach it. They roll Instruction, and their successes, up to their Sorcery, are extra dice for your learning test, rolled from the button on their card. A teacher no player plays charges a fee.
- **The other tradition:** a shamanic formula or teacher for a hermetic magician (or the reverse) works, but the learning test is harder and the study takes longer.
- All the new numbers are placeholders to check against your book (`docs/VERIFY.md`); the GM can change them, or turn any part off, in the house rules (*Magic and critters*).

## v0.91.7 — The Scene builder (11 Nov 2026)
- **New: the Scene builder**, a step-by-step window for the GM that builds a whole scene in one go: basics (name, folder, size, grid, and the kind of place: real world, astral or a Matrix host), the map, time and conditions, magic, who's there, security and the Matrix, and a summary before anything is made. Open it from the SR2e tools window, the toolbar, the Scenes sidebar, or **New scene…** in the GM panel's Scene tab.
- **Backdrops drawn for the system:** a night street, an alley, a rooftop, a warehouse, an office floor, a club, sewers, a parking garage, docks, a forest, the astral plane, the astral city, a host and the grid. The real-world maps come with walls, doors and lamps that match the picture. Or use a plain colour or your own picture.
- **Time of day** sets the darkness (and, if you like, moves world time to that hour); weather, terrain, background count, environment tags and a ward are set in the same place.
- **Who's there:** player characters in one start area and everyone else in another; NPCs from your actors (pick or drag them in) or made on the spot by the NPC generator, each row hidden or not, hostile, neutral or friendly, and a morale group. A new security site puts maglocks on the map's secure doors, with cameras and an alarm, and its host; a Matrix scene places the host's token.
- **Finish:** a GM journal with your notes and links to everything made, music, the combat tracker (and the NPCs' initiative), then view the scene or show it to the players. **Save as a template** keeps every choice for next time; **Change this scene…** opens it on an existing scene (it only adds, never deletes); **Remove this scene** deletes exactly what the builder made.
- **One look for module windows:** with Foundry's dark colour scheme, Monk's Enhanced Journal no longer shows light bars next to dark pages: each user's Monk's backgrounds are set once to its own dark choices, only where they are still Monk's default (a GM switch in the settings, *One look for module windows*).
- Rules values are unchanged.

## v0.91.6 — Contacts and fixers (2 Nov 2026)
- **Find things through your contacts:** when a character with contacts finds something (*Find & buy* in the shop, *Find…* or *Buy* on an item), they are asked how: on their own, **helped by a contact**, or, for a contact ticked as a fixer, **let the fixer find it**.
- **A contact's help** works like legwork: a buddy or a friend for life adds dice, you can pay for more dice (up to their Loyalty) or call in a favour, a contact with dice of their own looks too (the better result counts), and their fee is paid when you ask. A restricted or forbidden item is easier to find this way than openly (half the legality TN).
- **A fixer's find** is the fixer's own roll (their dice, or two per level): legality doesn't count, but the price includes their 10% cut, it takes half as long again, and there is no haggling. A favour waives the cut.
- **Contacts** have a new *fixer* tick, and a new contact now keeps everything typed in the form (Loyalty, fee, dice and favours were lost before).
- All the new numbers are placeholders to check against your book (`docs/VERIFY.md`); the GM can change them, or turn this off, in the house rules (*Time to get things*).

## v0.91.5 — Legality and permits (26 Oct 2026)
- **Legality counts when you find things:** found openly, a *Restricted* item is harder to find (TN +2) and a *Forbidden* one, when the GM sells them, harder and slower (TN +4, twice the time). Hover the shop's Legal column, or see the Catalogue page, for what an item's legality means.
- **Warnings:** the find card, the item sheet and the vehicle sheet say what carrying it without a permit risks (the fine).
- **Get a permit…** on an item (or a vehicle or drone you bought) that needs a permit or is restricted: it costs a share of its cost (10%, at least ¥100; restricted 25%, at least ¥500) and comes through after 7 days (restricted 30) of game time, under *Under way*. With the approval queue on, it goes to the GM first. The *Permit* box is now the GM's to tick.
- All the new numbers are placeholders to check against your book (`docs/VERIFY.md`); the GM can change them, or put the old ways back, in the house rules (*Time to get things*).

## v0.91.4 — Vehicles and drones in the shop (26 Oct 2026)
- **A Vehicles tab** in the shop and the Catalogue: the GM's catalogue vehicles and drones (the *Catalogue (SR2e)* actor folder, or any vehicle the GM marks *In the shop*) and vehicle compendiums, sorted into cars, bikes, trucks, boats, aircraft and drones by where they go.
- **Find and buy** a vehicle like anything else (haggling and the approval queue too). It becomes a new vehicle of your own, owned by your player, in the *Owned vehicles* folder; it arrives when the time to get it has passed. The GM's client makes it, so the GM must be logged in.
- Vehicles now have a **cost, Availability, Street Index and legality** (*Cost and legality* on the vehicle sheet). A vehicle with no price set can't be bought by players; the GM can still give it.
- The **Rigging tab** lists the vehicles and drones you bought or were given.
- **New entry…** makes vehicles and drones too: the GM's go into the catalogue folder; a player's go to the GM to review.

## v0.91.3 — The Catalogue (25 Oct 2026)
- **New: the Catalogue**, a book of everything you can get: weapons, armor, gear, ware, foci, programs, decks, spells and adept powers, with a page for each (its kind and category, price, Availability, Street Index, legality, stats and description). It has the shop's tabs, categories and search.
- Open it from the SR2e tools window, the left toolbar, the **Catalogue** button in the shop, or the **i** beside any row in the shop (that row's page). A page's **Buy…** opens the shop at that entry (**Learn…** for spells and adept powers).
- Players see what the GM's shop shows them. The GM can open the item from its page and put it in the shop.

## v0.91.2 — A tidier shop (25 Oct 2026)
- **Categories:** check boxes above the list show only what you tick: Melee, Pistols, SMGs, Rifles, Shotguns, Heavy weapons, Launchers, Grenades & explosives, Thrown, Bows; body armor, helmets, shields; ammunition, medical, electronics, vision, surveillance, chips, explosives, magical supplies; headware, bodyware, cyberlimbs, cyberweapons, bioware; foci, programs and decks by kind; spells by category. With none ticked, everything shows; the list is sorted by category, then name.
- The **Shop** button opens only the tabs that sell things, set to buy (the + on a sheet's heading still opens every tab).
- A tidier list: shorter source names (Catalogue, Built-in; long compendium names are cut short, with the full name on hover), and the Legal column only where something on the tab has a legality.
- In character creation the Shop button still offers Free.

## v0.91.1 — New entries and a Shop button (25 Oct 2026)
- **A Shop button:** in the SR2e tools window, the SR2e group of the left toolbar, and the title bar of your character sheet. It opens the shop ready to buy (for the GM: for the selected token).
- **New entry…** (in the shop, the tools window and the GM panel's Setup tab): make an item, spell, adept power, focus, program or cyberdeck the catalogue lacks, from your own book. Paste the stat line and press **Read it**: the name, numbers and codes fill the form (anything else is shown, never kept); check them, add a line in your own words, and save.
- The GM saves it to the catalogue (in the shop or not) and can give it to a character. A player's entry goes to the GM: **Review…** in the Requests tab opens it to check and edit; saving approves it.
- Foci, programs and cyberdecks now have a cost, Availability, Street Index and legality, so they can be bought in the shop.
- Saving a catalogue file reminds you that what you typed from your books is for your own group.

## v0.91.0 — The shop (25 Oct 2026)
- **The Add window is now the shop.** Every row shows its price (with the Street Index; hover to see it), Availability and legality.
- **Find & buy:** out of character creation, a player character buys by finding the item first. Tick rows and press **Find ticked**: each gets a find card (Etiquette, or Charisma, against its Availability, with the lifestyle, Street Cred and the Karma Pool). The card has **Buy** and **Haggle**; what you buy arrives when the time it took to find has passed (Under way). An item sheet's **Buy** finds first too. The GM, NPCs and characters in the creation wizard still buy at once; the GM can give everyone Buy now back in the house rules.
- **Not found?** Try again once the item's base time has passed in game time (the row shows the wait; a house rule turns the wait off).
- **With the approval queue on**, Buy on a find card sends the purchase, with its price and the wait, to the GM.
- **For the GM:** two new settings choose what players see in the shop (everything, only your catalogue and kits, or only what you mark "in the shop") and whether forbidden items are on sale; a **Shop** column in the window ticks your templates and world items into the shop (the mark travels with catalogue files); the GM panel's Requests tab lists the **open orders** (change the time, deliver now, or cancel with a refund).
- Rules values are unchanged; the new rules are house-rule switches (Time to get things).

## v0.90.2 — The catalogue sorts itself (25 Oct 2026)
- Loading a catalogue file now sorts its actors into subfolders of *Catalogue (SR2e)*: vehicles and drones by kind, spirits, critters and NPCs. Actors an earlier load left at the top of the folder are sorted too; anything you moved elsewhere stays where it is.

## v0.90.1 — Screenshots (25 Oct 2026)
- Two screenshots on the GitHub page and in the system's listing: a character sheet beside an attack in chat, and the SR2e tools window.

## v0.90.0 — Release polish (25 Oct 2026)
- A cover picture: a runner team in a neon alley. New worlds made with the system use it as their background on Foundry's setup screen.
- The author, Spaceisbig, is now listed.
- A smaller download, because the code is now minified.
- This changelog.

## v0.89.8 — Every tool in one place (25 Oct 2026)
- **New: the SR2e tools window.** It lists every tool you can use, with a line on what each does and its hotkey: the guide, your sheet, Defend, Resist, initiative, ending your turn, roll privacy, your look and settings, the tours and Report a bug. The GM also sees the GM panel and its tabs, the NPC generator, awards, the house rules, the Skill Web and the macros.
- Open it with **Alt+T**, the **SR2e tools** button in the Actors sidebar (players have it too), the button at the top of the guide, or the new **toolbox in the left toolbar**, which also has buttons for the most used tools.
- The GM panel's tab names can now be translated.
- Fixed: settings windows no longer open twice, the toolbar group stays open, and the window fits small screens.

## v0.89.7 — Translation, last part: the in-game guide (25 Oct 2026)
- **Ready for other languages:** the in-game guide (every topic and category) can now be translated too, so a translation covers everything people see.
- The "?" beside a heading now also works in other languages on the combat column (Defense, Weapons, Spells, Actions), Conjuring, the remote control deck, magical groups and the GM's session checklist.
- The English guide reads exactly as before.

## v0.89.6 — Translation, part seven: the rest of the text (25 Oct 2026)
- **Ready for other languages:** the remaining text can now be translated: previews, hints, option lists, tours, the printable sheet, the Token Action HUD, import reports, NPC generator descriptions, Apply (GM) lines, catalogue checks and actor messages (about 2,660 texts).
- A few texts stay in English on purpose because the system reads them back (purchase lines in the ledger, "on order" projects) or because they are meant for the maintainers (the bug report).
- Fixed: two places that could show a raw text code, and a refund that would have failed in another language.

## v0.89.5 — Translation, part six: no more reading English back (25 Oct 2026)
- **Ready for other languages:** the system no longer makes decisions by reading its own English text (target-number modifiers, the outcome banners, the guide's "?" links, folding headings, GM-only marks). Sentences built from pieces are now whole sentences a translator can word freely, and counts and lists follow the language. There is a new guide for translators.
- Small visible changes: a condition monitor status reads "OK" (was "ok"); a dart's or bite's toxin card says where it came from; lists read "a, b, and c"; a Revamp clean miss shows the "Resisted" banner. A section you folded before may open once.
- Fixed: magical groups folding together.

## v0.89.4 — Translation, part five: rule and item labels (25 Oct 2026)
- **Ready for other languages:** the house rules window (all 903 rules), the rules tables' labels and notes, the Add window's types, the catalogue help, the NPC generator's flavour lines, the settings' choices and sound names, and the sheet tooltips can now be translated. Names of people, skills and items stay as they are.
- Fixed: the Unified Rules Revamp's own labels went back to the book's when the world loaded.

## v0.89.3 — Translation, part four: the chat cards (25 Oct 2026)
- **Ready for other languages:** every chat card (tests, attacks, damage, spells, healing, the Matrix, vehicles, security, the GM tools on a card) can now be translated, with plural forms ("1 success", "2 successes"). So can the combat tracker's Delay / Act now / Done buttons, the chat sidebar's buttons and the "Replaced" notice. Cards already in the chat stay as they were.
- Fixed: a few rules that would have broken in other languages, and three that could have broken in English too.

## v0.89.2 — Translation, part three: dialogs and window titles (25 Oct 2026)
- **Ready for other languages:** every dialog (title, text, fields and buttons) and every window title can now be translated.
- Fixed: two dialogs (Assense and a healing spell) would have broken in another language.

## v0.89.1 — Translation, part two: notifications (25 Oct 2026)
- **Ready for other languages:** every pop-up notification can now be translated, with plural forms ("1 round", "2 rounds"). In English they read as before.

## v0.89.0 — Translation, part one (24 Oct 2026)
- **Ready for other languages:** all the text on the sheets and windows, the settings and the hotkeys can now be translated. In English everything reads as before.

## v0.88.0 — The starter demo (24 Oct 2026)
- **Create the demo** (GM panel, Setup tab) makes a small world to try the system in: four runners (street samurai, mage, decker, rigger), a gang, the rigger's vehicle and drone, a corporate host, a secured building with a locked maglock door, a camera and an alarm, a safehouse and a night scene.
- The journal "SR2e demo: try this" walks you through a fight, a spell, the Matrix, rigging and a chase, security, and printing.
- **Remove the demo** takes it all out again.

## v0.87.0 — Printable character sheet and "Report a bug" (24 Oct 2026)
- **Print a sheet:** a printer button on character, NPC and spirit sheets prints black on white with little ink, covering everything from attributes and the condition monitor to gear, contacts and notes. Options: an empty monitor for play at the table, or no notes; secret notes are left out unless an owner ticks them in. Print from the browser (which can also save a PDF), open it as a page, or save it as a file.
- **Report a bug:** a button in the guide (and in Configure Settings) shows a text to paste into a GitHub issue: versions, your modules, the rules source, the house rules your GM changed and recent errors. Nothing is sent anywhere.

## v0.86.0 — Keyboard shortcuts and accessibility (24 Oct 2026)
- **Use the system from the keyboard:** Tab reaches every button, link and box on sheets, dialogs, chat cards and the GM panel; Enter or Space presses it, Shift+Enter skips the dialog; tab rows, monitor tracks and pool pips move with the arrow keys; the focus stays sensible when sheets change and dialogs open or close.
- **New hotkeys:** Alt+S opens your sheet, Alt+C goes to the newest chat card, Alt+H opens the guide (plus Alt+D, R, E, I and G; all in Configure Controls).
- **Screen readers and contrast:** every icon button has a name, the condition monitor reads out as "Physical: 3 of 10 boxes", a clear focus ring shows where you are, and Windows' high-contrast mode is supported.
- Licence notices: "Shadowrun" and "Matrix" are trademarks of The Topps Company; the licence covers only the contributors' own work; the description names Topps, Catalyst Game Labs and Black Book Editions.

## v0.85.0 — Open bugs and security leftovers (24 Oct 2026)
- **One GM, two windows:** with the same GM account logged in twice, everything automatic (status cards, timers, answers to players' requests, follow-ups) now happens once. Defend/Resist prompts open in the window used last, and a closed window is taken over within seconds.
- Barriers, Spell wall, Start fire, Jam weapon, Evict, Confirm deed, Region detect, Remove bug and the GM's own Defend and Resist now run one at a time with the GM's other automatic work.
- Names and values in notifications show exactly as typed.

## v0.84.1 — Token art colour pass (24 Oct 2026)
- **One colour per area, everywhere:** a token's rim now uses the same area colour as the sheets and chat cards. People take their archetype's colour; security is blue; plain portraits are neutral steel and critters tan grey; spirits are magic violet, IC and hosts Matrix green, vehicles and drones rigging orange, barriers magic and safehouses street gold.
- **Colour-blind-safe colours:** the area colours of all three themes, and the token rims, were tuned so every pair stays distinct with each kind of colour blindness, while still meeting the contrast minimums.
- A colour legend in the guide ("Pictures and tokens"); the barrier's ward region on the map uses the magic colour.

## v0.84.0 — One-file data import (24 Oct 2026)
- **Catalogue files, version 2:** besides item templates and kits, a catalogue file can now carry vehicles and drones, NPCs and critters, spirits, and NPC stat blocks. New actors go into the folder "Catalogue (SR2e)", and loading the same file again adds nothing twice. Version 1 files still load.
- **Fill in missing values** (on by default): items already in the world with the same type and name get the file's descriptive values (cost, Availability, damage code, ranges, Essence…), but only where theirs are still empty or zero. Values someone set, ratings, quantities, ammo, accessories and switches are never changed, and existing actors are never changed.
- The dialog shows what the file has and asks first; refused values are reported.
- Fixed: focus items could not be created since v0.78.0.

## v0.83.0 — Default token art (24 Oct 2026)
- **202 original pictures and tokens**, drawn by Claude (AI) for the system in one "neon noir" style: people (5 metatypes, 2 figures, 15 archetype badges), critters, spirits, vehicles and drones, IC, hosts, barriers, sites and safehouses. No book art, logos or existing characters.
- **Picked automatically:** new actors with Foundry's stand-in picture get the art, and it follows the actor's changes (metatype, figure, archetype, a control rig or cyberdeck added, tradition, vehicle category, spirit kind). Pictures you set by hand, and portraits found by name, are never replaced.
- **On the sheet:** "Picture and token" on the character's Bio tab and the NPC sheet, with Figure, Archetype, a preview and **Use the default art**.
- **For the GM:** the Setup tab shows how many actors still have the stand-in and can give them the default art (asks first). A world setting turns the feature off.

## v0.82.1 — Adepts, edges and contacts (24 Oct 2026)
- Adepts: the Magic tab now shows Initiate, the initiate grade and the metamagic an adept can learn.
- Edges and flaws added, changed or deleted by hand after creation now go through the approval queue when it is on.
- The contacts topic in the guide explains "Mr. Johnson".

## v0.82.0 — Player and GM documentation (24 Oct 2026)
- The in-game guide was checked against the system line by line: about 47 errors fixed and 100 gaps filled (security, auto-apply and auto-resist, item sheets, the tours, the macros compendium, player settings, rigging, the spirit, IC and barrier sheets, and more).
- The "?" links now work on folded sections; players are never sent to a GM topic; a **Guide** button on every sheet opens the whole guide.
- Setting hints corrected; README updated.
- Small fixes: the dying line, the Effects tab and the Karma tooltip follow the rules in force; Spend Karma's Buy off asks first; the security-door field shows on every wall.

## v0.81.1 — Second review pass, security included (24 Oct 2026)
- More security holes closed, among them: rich text (such as a biography) could run script on the GM's screen; GM re-rolls on a forged card ran with GM rights; forged surgery and mod-install cards could move nuyen; another character's spell defense could be borrowed.
- A GM re-running a player's card now acts as that player. Player chat keeps colours and text styles but loses positioning. Refused house rules and dropped values are reported to the GM.
- New: a **Cover targets** button lets a mage cover allies with spell defense.
- Fixed: surgery, vehicle jobs on someone else's vehicle, slow toxins and timers, summoning re-rolls, Detonate, character import weapon names, availability dashes and Token Action HUD names.

## v0.81.0 — Whole-system review and security audit (24 Oct 2026)
- About 140 bugs fixed, plus security holes: a forged chat card could make a player a GM or hand out nuyen on one GM click; character names could run script on the GM's screen; requests could pose as the GM.
- GM clicks on Apply (GM) cards now show a confirm built from the card's data. "Apply players' GM-only changes by themselves" is now off by default.
- Fixed: spirit drain and Spell Pool, surgery after a TN change, morale, Essence drain re-rolls, round timers across combats, skill-gear penalties, reload action cost, exclusive spells, character import parsing, dismissing spirits, and more.
- Note: Foundry sends every message and actor to every player's browser, so hidden information is hidden in the interface only.

## v0.80.0 — The "SR2E Unified Rules Revamp" rules source (24 Oct 2026)
- A new world setting, **Rules source**: "SR2E Book Rules" (the default, unchanged) or "SR2E Unified Rules Revamp", an alternate ruleset. Switch it in Game Settings or the GM panel's Setup tab; the GM's house rules still win, and the House rules window marks every row the Revamp changes.
- The Revamp changes about 150 rules: no dodging gunfire, knockdown, Strength against recoil, Stun overflow, bleeding, first aid, critical successes, Karma costs, casting and drain, Control Pool limits, vehicle damage, rigger feedback, drone-link interception, locks and detectors, and more. Some larger subsystems are listed but not built.
- The Book Rules behave exactly as in v0.79.0.

## v0.79.0 — Rules checked against the book (23 Oct 2026)
- About 40 rules now follow the book where an official source backs them, each with a switch back: weapon and Strength ranges, recoil, Smartlink II, flechette, grenade scatter, reloads, the Combat Pool cap, surprise order, the Visibility Table, reach, Perception, healing in stages, social attitudes, skill Karma, vehicle speed, crashes and rams, sensors, repair time, dump shock, jamming, Spell Pool and spell defense.
- Fixed: spell defense from another player's protector, a stale self-recovery result after a Karma re-roll, the rest dialog's Stun care rows, weather on vehicle sensors, and more.

## v0.78.0 — Rules changes from the book check (23 Oct 2026)
- About 20 rules now work as the book does, each with a house-rule switch back: legwork, flash grenades, the monowhip, stim and tranq patches, the toxin extractor and tracheal filter, symbiotes, the encephalon, mana barriers, invisibility, focus bonding, power foci, insect forms, critter immunities, Paralyzing Touch, Combat Sense, spell resistance, tamper alarms and barrier damage.
- Also: allergy levels, voice locks needing a voice-deception device, no parry with a riot shield, Hibernate, club reach 1 and the cybereye/cyberear Essence allowance.
- Fixed: paralysis drain, barrier Power, ammunition against barriers, immunity on disease, flash and the already-blind, and the whip check double click.

## v0.77.0 — Rules values corrected (23 Oct 2026)
- About 40 wrong rules values corrected (social tests, grenades, drones and remote decks, locks, spirits and critter powers, adepts, Killing Hands, area spells, starter templates and more).
- Fixed: importer letters, astral spirit initiative, flash falloff, casing time; existing Killing Hands powers are updated automatically.

## v0.76.0 — Player guide and licence (23 Oct 2026)
- The player guide (in-game "?" help) covers everything since v0.66.0 and is organised in categories; searching hides empty ones.
- A clear licence (CC BY-SA 4.0, SRA2 credited, unofficial and trademark notices, no rulebook text) and a release-ready README.
- The README, licence, system description and guide say up front that the system was written by Anthropic's Claude under human direction, with rules numbers from memory.
- Placeholder names without setting names (DocWagon kept).

## v0.75.0 — Cleared values stay cleared (23 Oct 2026)
- Values cleared on an unlinked token's actor now stay cleared on every open client. Before, a released hold, a used delay, an ended quest or a given-up project could still count until a reload.
- Fixed: two Act now clicks at once both went through.

## v0.74.0 — Chat-card cleanup (23 Oct 2026)
- Every chat message gets the SR2e card look, including the system's plain notices, typed chat and Foundry rolls.
- Outcomes read at a glance: green ✔ for success, red ✖ for failure, black ⚠ for disaster, purple ⇄ for a counterattack, amber outline for an attack waiting for the defense; contests show the winner, loser or tie. The colourblind dice setting uses its blue/orange set throughout.
- Fixed: damage taken and hits shown as successes; colourblind contrast on the light palette.

## v0.73.0 — Rare rules items, second half (23 Oct 2026)
- Matrix: players see only hosts they have found, and a host's codes only after Analyze; black IC blocks Graceful Logoff; persona damage lowers Matrix initiative.
- Vehicles and drones: rammer damage after the defense, passengers get hurt, the control rig bonus on gunnery and dodging, sensor locks run out, drone links can be intercepted and spoofed, firmpoints and hardpoints, missiles lock on to Signature.
- Characters and NPCs: Negotiation uses the opposed attribute, lifestyles can be owned outright, training keeps the specialization, NPCs get Threat and Professional Ratings and a Karma Pool, house-rule metatypes allowed; house rules for Exceptional Attribute, surplus flaws and a dearer Karma band. Undo covers map regions; vehicle mod installs are paid up front.
- Fixed: an unnamed vehicle mod never finished installing; unlinked grunts never lost "broken"; ended timed statuses kept repeating their message.

## v0.72.0 — Rare rules items, first half (23 Oct 2026)
- Combat and gear: blasts through walls, Take Aim, armor from its parts, smoke in melee, an ammo table (Stick-n-Shock, AV), indirect fire with a spotter.
- Health: drug doses and overdose, bioware vitals, reflex boosters that don't mix, Will to Live, Pain Tolerance, Toughness, Sensitive System, heat and electric shock.
- Magic: bound spirits when the master dies, astral combat, allowed metamagic, Spell Pool for dispel drain, Mana and Physical Barrier, wards stopping movers, wounds while projecting, innate spells, anchoring and ally Karma.
- Fixed: Will to Live on the GM's card; a critter's innate drain turning Physical.

## v0.71.0 — 21 common rules holes (23 Oct 2026)
- Fixes from the rules review: Karma on street contest cards, specializations on Stealth and Perception, creation foci, a rigger's dodge, MPCP caps on programs, generated sheaves for hosts, counterattack extras, dispel that shrinks a spell, invisibility everywhere, holds, astral switching costs, conjuring drain at the end, vehicle repair with a shop.
- Riggers now need the rigger adaptation to jump into their own non-drone vehicles (drones count as adapted).
- Fixed: a hold released several times at once.

## v0.70.0 — 22 bugs and exploits (23 Oct 2026)
- Fixes from the rules review: re-rolled cards go dead everywhere and Defend is remembered like Resist; one source for wound modifiers; drug TNs on tests; helpless and astral-only characters can't act physically; dying, smoke clouds and site responses run on world time; stun overflow carried box by box.
- Fixed: an attacker could re-roll after the target defended; two fast GM clicks applied a patch twice.

## v0.69.0 — Final rules review (23 Oct 2026)
- No changes in the game: a full rules review area by area. Its findings were fixed in v0.70.0–v0.73.0.

## v0.68.0 — Second interface pass (23 Oct 2026)
- Each player picks a sheet layout: Tabs (default), Combat column or Compact.
- An always-visible status strip (monitor, wound TN, initiative, pools, readied weapon, "Your turn") and a your-turn helper that greys out actions that no longer fit.
- Roll dialogs in two columns with one big Roll button and remembered choices; − / + steppers and the scroll wheel; a clickable condition monitor.
- For the GM: party cards and mook stat cards, a restyled combat tracker, GM-only parts marked with a striped edge, settings in sections, a searchable house rules window, grouped notifications, remembered window size and place.

## v0.67.0 — The look (23 Oct 2026)
- A new look on SR2e's own windows and chat cards.
- Per-player theme (Street dark, Corp light, High contrast), colour preset (Gunmetal cyan, Phosphor green, Magenta, Amber), window opacity, text size and reduced motion. Bundled fonts; every text colour meets WCAG AA contrast.
- Chat cards with an area-coloured header, a big success count and dice tiles; the condition monitor in wound groups with an Overflow row; portraits found by the character's name.

## v0.66.0 — GM setup tools and module support (22 Oct 2026)
- The GM panel's Setup tab: session checklist, players and characters, one-click token setup, starter kits, an item catalogue from pasted rows, CSV or catalogue files, and character stat-block import.
- A Kits tab in the Add window; Item Piles and Health Estimate support.
- The player guide (in-game "?" help) and three guided tours.
- Fixed: weapons and armor vanishing on an Item Piles pick-up.

## v0.65.0 — Things that take time wait for it (22 Oct 2026)
- Karma raises (training), orders with an Availability, spell learning and other timed work now wait for their time instead of happening at once. The GM can change the wait or finish it at once; players can give up and get their Karma or nuyen back.

## v0.64.0 — Creation wizard and advancement (22 Oct 2026)
- A step-by-step creation wizard (priorities, metatype, attributes, skills, magic, shopping, contacts); Finish creation keeps a Creation tab record.
- An advancement log, a read-only Current tab, a Spend Karma window and an optional approval queue (off by default) for player purchases and Karma spending.

## v0.63.0 — Adding things and sheet tidy-ups (22 Oct 2026)
- A + on every list heading opens one Add window (search, templates, compendium and world items; Free, Buy or Learn with Karma), and a simpler skill picker.
- Ratings and quantities edited on the row, duplicate, an Edit / Play switch, folding sections, sheet search, pinned quick actions and a setup warnings banner.
- Fixed: gear not stacking with the same item; the search box losing focus.

## v0.62.0 — The interface pass (20 Oct 2026)
- Every sheet and window scrolls and keeps its place; the tab bar stays at the top.
- Compact fields, NPC and spirit stat lines as small cells, a resizable item sheet grouped under headings, one look for lists, headings, buttons and warnings.
- Fixed: biographies, notes and descriptions showed an empty box (since v0.59.0); pool pips drawn as ammo bars.

## v0.61.0 — Rules gaps
- Health: DocWagon contracts, slow toxins, more drug effects, fire and poison immunity, healing via Apply (GM).
- Magic: seeing through invisibility, spirit initiative, totem drawbacks, paralysis and binding holds, magical links, exclusive spells, wards drawn on the map, bound spirits freed on the master's death, insect hosts.
- Gear, combat and more: skill gear, cyberears, smoke grenades, stun batons, monowhips, superior position, radios, fake SINs and licences, sheaf IC, gas devices; the NPC generator adds totems and riggers' vehicles.

## v0.60.0 — Foundry quality of life
- Scene regions with SR2 environments (background count, wards, smoke, darkness, cameras).
- Token Action HUD support, inline tests (`@SR2Test`, `/sr2`), tracker shortcuts, drag to and from chat, hover cards, NPC auto-resist, roll privacy per kind, sound cues and support for module makers.
- An SR2e Macros compendium.

## v0.59.0 — Foundry integration and play-breaking bugs
- A player can end their turn at the end of a pass, and Apply (GM) cards go through by themselves.
- The tracker's Next/Previous buttons follow SR2 passes; a Combat Turn is 3 seconds.
- Dropped items arrive not installed, bonded or loaded; deckers and riggers are dumped when they go down; spirits are disrupted, not killed.
- Token statuses, an Effects tab, rich text, area templates, a movement ruler, floating damage numbers, Shift-click quick rolls and hotkeys.

## v0.58.0 — Characters, gear and integration
- Plain Perception, time divided by successes, Build/Repair tools and gear repair, creation costs, languages, training time (house rule), pay negotiation, Karma award rows, recognition.
- Essence holes, filtration, bone lacing, surveillance and vision gear, legality, invisible and astral tokens; vehicle skills linked to Reaction.

## v0.57.0 — Matrix, vehicles and security
- Matrix: a security tally per intruder, loading utilities over time, Matrix damage modifiers, black IC holding a decker, shutdowns, Matrix perception and maneuvers, Slow/Restore/Validate, data bombs, comcalls, reality filters, hitcher jacks, BTL chips.
- Vehicles and security: Acceleration, crash tests after damage, called shots at vehicle parts, the driver's evasion, Rigger 2 maneuver scores (house rule), a vehicle design dialog, maglock types, casings, bypass tools.
- Fixed: every sheet edit failing on characters with Good Karma; jacking into a shut-down host.

## v0.56.0 — Magic and critters
- Sustained stat-changing spells, permanent spells, healing drain by the wound, touch spells, detection range, learning tests, ward rituals, manifesting, assensing by successes, centering.
- Totem spirits, nature spirits leaving at sunrise or sunset, taking control of spirits, binding by true name, the adept power-point budget and four adept powers; critter immunities and powers that change TNs and movement.

## v0.55.0 — Combat and health holes
- Take Aim, several targets in a phase, unaware targets, reloading, drawing weapons, armor per weapon, toxin weapons, slap patches, burning, holds, combined blasts, suppressive fire, cyberguns, first aid after magic, surgical trauma (house rule).

## v0.54.0 — Review fixes
- Wounds lower Initiative; physical adepts have no Spell Pool (house rule to give one); damage staging and the elemental rule became house rules; Essence goes at surgery while effects wait for recovery; one ware price everywhere.
- Fixed: Initiative dropping more than once per Combat Turn; a timed charge going off twice; rigged vehicles ignoring the rigger's wounds; bioware priced by grade.

## v0.53.0 — Safehouse construction sheet
- A new safehouse actor: location, size and 54 options in 9 categories, with build cost, upkeep, security, ward and more. It can make a security site, ward, home host and library or lodge.

## v0.52.0 — NPC generator
- Random people, groups, organisations, contacts, spirits, critters, fixers' jobs and street names at Threat Level 0–5, with a preview before anything is created.

## v0.51.0 — GM tools
- A tabbed GM panel (Scene, Combat, Party, NPCs, World, Tools, Log), world-time steps up to a year, and a dice and TN calculator.
- An undo log that takes the system's changes back one step at a time (Ctrl+Z on the canvas too).

## v0.50.0 — Target-number automation
- Modifiers from the scene and the actors (light, smoke, weather, cover, range, movement, background count, wounds…) are found automatically on every kind of test. Each can be switched off in the roll dialog, and the GM's "Change target number…" re-scores a rolled card.

## v0.49.0 — Street, Matrix, rigging and security leftovers
- Skills and gear in the builder, edges and flaws with Karma, contacts' own dice and favours, Heat, otaku channels and complex forms, jamming, programming, deck parts, turret traverse, mod installs, cargo by volume, site guards, tamper alarms, and stat-block import of cyberware, spells and powers.
- Fixed: a wired door re-tripping its alarm; players editing Heat; a fence offering ¥0.

## v0.48.0 — Health, magic and critters leftovers
- Fire through walls and along fuel, smoke from fires, reflecting powers, a possessed body's skills, allies by ritual, more ordeals and spell design options, contagion, radiation sickness, weather on driving, care after surgery.

## v0.47.0 — Combat and gear
- Wall cover from the whole token, melee defaulting to the linked attribute, scatter along the throw, confined blasts, group searches, scope vision, laser range, spells against objects, shields against ranged attacks, disarm tests, cyberware hurt by non-attack damage.

## v0.46.0 — Matrix and rigging
- Party and construct IC, programming and deck building, frames and agents in the turn order, optional otaku; chase tokens on the canvas, signal range and jamming, sensors, firing arcs, cargo, autosofts and vehicle mods; tamper alarms and device senses.

## v0.45.0 — Magic and critters
- Cleansing, divining, invoking, possessing, reflecting; initiation ordeals and group initiation; spell design; magical groups; toxic and insect shamans (optional); fire spreading.
- Bioware recovery and rejection, encephalons, chips, Availability by grade; sustained critter powers, great form spirits, ghoul and vampire diet.

## v0.44.0 — Characters and the street
- A builder that fills the sheet, edges and flaws, reputation, running and athletics, open, complementary and teamwork tests.
- Perception and social tables, rallying, grunts on their own tokens, Threat Rating; contacts' Loyalty, legwork, haggling and fencing.

## v0.43.0 — Gear and combat
- Concealability and searches, laser sights, imaging scopes, bipods and tripods, spells against vehicles, parrying with shields, smart and airburst grenades, timed charges, blasts catching vehicles, wall repair, cyberware damaged by heavy hits, cyberlimb details.
- Fixed: blasts never caught vehicle tokens (since v0.21.0).

## v0.42.0 — Health and environment
- Addiction, tolerance and withdrawal, disease over days, radiation, suffocation, hospital costs, lifestyle healing, protective gear and weather.

## v0.41.0 — Interface polish and GM tools
- Item templates, item layouts per type with warnings, field tooltips, the first GM panel, quick NPC rolls and group damage, drag a weapon onto a token to attack, colourblind-safe dice, Dice So Nice support.
- Fixed: a weapon dropped on its owner's own token attacked itself.

## v0.40.0 — Matrix leftovers
- Psychotropic IC, Shield / Armor / Mirrors / Smoke, agents, grid travel time, security deckers.

## v0.39.0 — Magic and critters
- Elemental secondary effects and the sustain limit, nature spirit domains, focus addiction, circles, libraries and lodges, ritual sending, signatures, the astral perception penalty, adept powers with effects, background count sources, dual-natured critters, weaknesses, Essence drain, shapeshifters.

## v0.38.0 — Skills and character creation
- Knowledge and language skills, concentrations, Build/Repair skills, Parry (house rule), a Skill Web, martial arts, a priority builder with build checks.
- Changed: with Skill Web links, unlinked skills no longer default (a house rule puts the old way back).

## v0.37.0 — Gear and combat leftovers
- Armor layering and shields, encumbrance, armor degrading (house rule), silencers, tracers, full cover, grenades thrown back, flamethrowers and rockets, demolitions, barrier damage, weapon rows with ammo pips and mode buttons.

## v0.36.0 — Tokens and the canvas
- Token vision from the character's eyes, Physical and Stun bars, wound icons, the pass and pools in the tracker, hotbar macros, token HUD buttons, links that pan to the target, roll privacy modes.

## v0.35.0 — Combat flow at the table
- Delaying, full defense as an interrupt, Karma Pool buying successes and refresh timing, Rule of One prompts and weapon jams.
- Outcome banners, folded dice with the TN on hover, GM apply / undo / adjust damage, one-click Resist all for blasts.

## v0.34.0 — Player-side test pass
- GM-only cards posted from a player's client are now hidden from that player.

## v0.33.0 — Upkeep
- Lifestyle with paid-until dates, Karma awards growing the Karma Pool, Karma costs for raises, a nuyen and Karma ledger, contacts and legwork, availability tests and buying, a GM award tool.

## v0.32.0 — Perception, social, grunts and morale
- Opposed perception against Stealth, opposed social tests with pheromones, grunt groups on one sheet, morale tests from Professional Rating.

## v0.31.0 — Toxins, drugs and hazards
- Toxins, drugs (doses, timed bonuses, crashes) and disease; falling, fire, drowning, cold and fatigue; stun weapons; timed blindness and standing up from prone.

## v0.30.0 — Bioware depth
- Bioware kinds (muscle augmentation, cerebral booster, synaptic accelerator and more), cultured bioware, conflicts with cyberware, Body Index side effects, surgery with recovery time.

## v0.29.0 — Cyberware depth
- Cyberlimbs, cyberweapons, stacking and the initiative cap, smartlink levels, vision and ear extras, datajack checks, damage and repair, grade costs, skillsofts and skillwires, Magic from Essence.

## v0.28.0 — The grid, sims, frames and connections
- LTGs and RTGs and logging on through them, hot and cold sim with overload, frames, connection modifiers (cellular, satellite, vehicle, remote).

## v0.27.0 — Matrix IC, operations and paydata
- The IC list (trace, tar, crippler, ripper, blaster and more), persona and IC defense, an operations catalogue, data stores and paydata, deck damage and repair, Medic.

## v0.26.0 — Building security
- A site actor with devices tied to tokens and doors, tally steps, alerts, response and lockdown; detection against Stealth, lock bypassing, security riggers, a Matrix host link.

## v0.25.0 — Vehicle combat
- Gunnery and weapon mounts, firing from and at moving vehicles, sensors, ECM/ECCM/ECD and sensor locks, passenger damage, ramming, remote control decks and drone groups, chases.

## v0.24.0 — Vehicles and rigging
- A vehicle actor with its damage track, driving tests (manual, jumped in, autopilot), crashes, control rigs, the Control Pool, rigged initiative, feedback and dump shock, anti-vehicle weapons.

## v0.23.0 — Sheets and settings
- House rules in Foundry's settings, tabbed character sheets with a summary header and quick-action bar, Defend/Resist prompts, an Attack dialog with a live TN preview and Shift-click quick attack.

## v0.22.0 — Core character rules
- Metatypes, non-magical healing, unconscious / dying / dead, the action economy, initiative ties and surprise.

## v0.21.0 — Combat additions
- Full defense, subduing, prone, friends in melee, charging, barriers, encumbrance, smoke, light sources, gyro mounts, clips, grenade kinds, walls and confined spaces, shotgun cones, walking fire.

## v0.20.0 — Melee and ranged additions
- Opposed melee with counterattacks, reach, unarmed, Strength-based damage, thrown and bow ranges, heavy recoil, ammunition, called shots, grenade scatter, shotgun spread, full auto over several targets, wall cover, light and vision, movement, knockdown.
- Bioware with Body Index, smartlink implants, cyber-vision and dermal armor.

## v0.19.0 — Measured combat distance
- Range bands from the canvas, elevation, scene units, melee reach and out-of-range blocking.

## v0.18.0 — The rest of magic
- Elemental spells and elementals' aid, projection limits and the empty body, area radius and line of sight, masking and anchoring, domains, elemental binding, totem environments, focus bonding and addiction, magic weapons, spells through wards, Karma for spells and initiation, ritual spotters, enchanting materials.

## v0.17.0 — The Matrix
- Cyberdeck and program items, the Hacking Pool, Matrix initiative, a host actor with subsystems, the security tally, sheaf and alerts, system tests, an IC actor, cybercombat, black IC, dump shock.

## v0.16.0 — More spellcraft
- Resisted non-combat spells, healing spells, background count, exclusive and fetish spells, ritual sorcery, magic loss, enchanting, allies, free spirits, watchers, astral quests.

## v0.15.0 — Astral signatures, tracking and geasa
- Signatures that fade with world time, astral tracking, geasa protecting Magic.

## v0.14.0 — Initiation and area magic
- Initiation and metamagic, aspected magicians, area and repeating effects, protective spell defense, barriers (wards).

## v0.13.0 — Sustained spells, foci and adepts
- Sustained spells, spell defense, foci, traditions and totems, adepts, materialization, assensing.

## v0.12.0 — Critter and spirit powers
- A configurable Power item for critters and spirits.

## v0.11.0 — The astral plane
- Astral perception and projection, astral form attributes and initiative, astral combat.

## v0.10.0 — Conjuring
- A spirit actor type, summoning with services, conjuring drain, banishing, immunity to normal weapons.

## v0.9.0 — Skills
- Specialization ratings and defaulting to a related skill at +2.

## v0.8.0 — Karma Pool
- Re-roll failures (rising cost), avoid disaster, refresh.

## v0.7.0 — Firing modes
- SS / SA / BF / FA, recoil and recoil compensation, burst and full-auto damage, magazines and reload, situational modifiers.

## v0.6.0 — Spellcasting
- Casting, drain, resisting spells, the Spell Pool.

## v0.5.0 — NPC sheet
- A compact NPC and critter sheet, stat-block import, clickable condition monitors.

## v0.4.0 — Cyberware
- Essence by grade, attribute, Reaction and initiative bonuses, Magic capped by Essence.

## v0.3.0 — Attacks
- The attack flow: an Attack button with target and range, Defend and Resist buttons on the cards, opposed net successes staging damage, armor by attack type.

## v0.1.0–v0.2.0 — First builds
- Not recorded in detail. The basics (attributes, success tests, damage and the condition monitor, initiative passes) were in place before v0.3.0.
