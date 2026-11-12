# v0.92.3 review: the rules checked against the books

## What changed

The default rules of eight areas (core and characters, combat, health, sorcery, spirits and the astral, the Matrix, vehicles and security, gear and ware) were compared with the SR2 books and moved to the book's way. Each change has a house-rule switch in `RULES.<AREA>_V923` (`src/module/rules/config923/*.ts`, pure helpers in `rules/core923.ts`, `combat923.ts`, `health923.ts`, `sorcery923.ts`, `spirits923.ts`, `gear923.ts`) whose other choice restores v0.92.2; some values moved in place in the house-rules window. `docs/VERIFY.md`, "Checked against the books (v0.92.3)", lists every change with its book and page, the rules kept as the creator's decisions and those not built.

- **The Revamp:** a rule the Unified Rules Revamp changes itself (its own `URR_V80` switch or a `URR_V80_PATCH` entry) keeps the Revamp's behaviour; a book fix the Revamp is silent on applies there too (`REVAMP_COMBAT_RULES`, `REVAMP_VEHICLE_RULES`, `REVAMP_GEAR_RULES`).
- **Existing worlds:** migration `0.92.3` posts one whispered card to the lead GM listing the actors whose numbers or status change, by reason, with the house rules that restore each (`src/module/notice923.ts`). It changes no data. Creation drafts remember the priority table they were started with.

## Review

Four independent reviews (core and combat; health and gear; sorcery and spirits; the Matrix and vehicles, plus a repo-wide check for personal data and book text) found these, all fixed with tests unless noted:

- **Merge:** heavy armor taken off the Combat Pool twice; a troll's dermal armor not stopping flechette's extra level; dermal plating counted twice in the permanent-damage test; a ram staged up by its own Ramming Test successes; seven rules built twice by two areas (one switch kept each).
- **Core and combat:** Threat dice not counting toward a clean miss; non-opposed melee (helpless targets) staged the ranged way; the per-action pool refresh repeating on Previous Turn and misfiring on round changes with two GMs; a stuck round flag; Threat NPCs keeping their non-combat pools; holstered weapons refusing to attack (an attack now draws the weapon).
- **Health and gear:** Essence holes wrong for ware inside cyberlimbs; the stat-block importer counting the new Body bonuses twice; plating cancelling orthoskin's armor; natural healing rolling augmented Body (new switch `HEALTH_V923.healingBody`); book surgery killing instead of stopping at Essence 0; the adrenal crash trusting card numbers; drastic-surgery Magic loss on the ungraded cost; a second shock hit cutting disorientation short.
- **Sorcery and spirits:** astral projection costing Essence for good (now temporary); imported cybered magicians losing Magic twice; a spirit's former controller's Drain written from the challenger's client (now their own Resist card); focus-addiction Magic loss outside the re-roll path; an expendable fetish overriding the Revamp's value; Force dispels re-checked by the GM's Apply; area-spell TNs when the card's TN was clamped; ritual and ward team dice never spent; Conjuring defense compared with the wrong number; the detection-range test re-rollable for free.
- **Matrix and vehicles:** the connection penalty counted twice under the old switch; datatrail and trace cards made on a player's client readable by that player (now blind); an Autonav 1 autopilot's crash lost; crash passengers unhurt when the vehicle stages the damage away; crash buttons missing on a re-resolved card; dialogs asking for pool dice that are not used; the party IC penalty shrinking; the passkey used against a better skill; black IC holds and psychotropic marks kept after a re-roll miss.

## Known limits

- Only the Combat Pool refreshes per action; the Spell, Hacking and Control Pools stay per Combat Turn (refreshing the Spell Pool would wipe allotted spell defense; Rigger 2 keeps the Control Pool per turn).
- Karma Pool dice are offered in the attribute and skill dialogs, not yet in attack and spell dialogs.
- A dispelled spell's effect is not rebuilt when its Force drops (effects come from successes).
- A GM can't set Grade 0 by hand on the sheet; the Astral Combat Pool applies while projecting, not while only perceiving.
- About 160 book rules the system doesn't model yet are listed under "Not built" in VERIFY.md (team Karma Pool, Maneuver Score chases, radiation, group perception and others).
- The live check covered the notice, creation, a ranged attack and soak, Stun overflow and the house rules; the rest is covered by the 4,100 automated tests.
