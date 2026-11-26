# What SR2e does for you

SR2e is an unofficial Shadowrun Second Edition system for Foundry VTT v14. It was built with AI (Anthropic's Claude) under human direction, and it has not yet been play-tested at a real table. By default the rules follow the SR2 books; the GM can change most of them with house-rule switches (Configure Settings, **Edit house rules**), or switch the world to the optional Unified Rules Revamp.

For each area below, the table says how much the system does:

- **Automatic**: the system works it out and applies it.
- **Partly**: the system works it out or proposes it, and a player clicks a button or the GM confirms it.
- **By hand**: the table decides or tracks it; the system gives you a place to write it down, or nothing.

Every test still starts with a click on its button; **Automatic** means that after it there is nothing left to work out or apply.

## No modules needed

SR2e needs no Foundry module. It works with these when they are active (the GM panel's Setup tab, **Modules**, shows which are on):

| Module | What it adds |
|---|---|
| Dice So Nice | 3D dice. With the player setting *Dice So Nice: SR2e colours*, tests roll in the SR2e colour set and Rule of Six re-rolls in gold. |
| Token Action HUD Core (2.x; it needs socketlib) | A token HUD listing the actor's attacks, spells, skills and pools. |
| Health Estimate | A token's health in words, from the worse of its Physical and Stun tracks (a vehicle's condition track, IC's Matrix track). |
| Item Piles | Loot piles, merchants and trading, with nuyen as the currency and item prices with the Street Index and ware grade. |
| Monk's Enhanced Journal | With Foundry's dark scheme, its backgrounds are set dark once per user (setting *One look for module windows*). |
| Quench | The in-Foundry test batches, run by a GM in a test world (see `README.md`, Develop). |

Item Piles and Health Estimate support can be turned off with the world setting *Support for Item Piles and Health Estimate*. With a calendar module, a jump of a week or more asks the GM whether it counts as time passed.

## Characters and creation

| What | How much | Notes |
|---|---|---|
| Creation wizard on the SR2 priority table | **Automatic** | Steps from Priorities to Finish; picking a letter another column holds swaps them. |
| Build checks (attribute points, Force Points, skills, Resources) | **Automatic** | The wizard advises, never refuses (a house rule brings back limits). |
| Starting cash, lifestyle paid and starting Karma Pool at Finish | **Automatic** | A tenth of leftover cash kept, plus 3D6 × ¥1,000. |
| Racial modifiers, Reaction, Initiative, Combat and Spell Pools, Body Index | **Automatic** | Derived from the sheet; hover a total for its sources. |
| Creation record frozen at Finish | **Automatic** | **Record as it stands** for a character made another way. |
| Quick build from typed lists, stat-block import | **Partly** | A preview shows what was read; unread parts are reported; missing Essence or power costs are guessed and flagged. |
| Default portrait and token by metatype and archetype | **Automatic** | Follows the actor until you set your own picture. |
| Contacts: legwork, favours, a contact's own dice | **Partly** | The card rolls and pays the fee. |
| Edges and flaws, reputation | **Partly** | Only when the house rules use them; Street Cred can come from career Karma. |
| Gang, followers, group perception, racism at creation or in play | **By hand** | Listed as not built in `docs/VERIFY.md`. |
| Printing a sheet | **Automatic** | Print, open as a page, or save as an HTML file. |

Known gaps: 4 entries under "Not built" in `docs/VERIFY.md`, *Core mechanics and characters* (one lists several; among them the team Karma Pool and racism).

## Tests and dice

| What | How much | Notes |
|---|---|---|
| Success tests with the Rule of Six | **Automatic** | Sixes re-roll and add. |
| Rule of One (all ones is a disaster) | **Automatic** | Looks at the first roll only. |
| Target-number modifiers: wounds, range, light, smoke, cover, movement, background count | **Automatic** | Measured from tokens and scene; each can be unticked for one roll. |
| Defaulting to an attribute (+4) or a related skill (+2) | **Partly** | The player picks the related skill; Skill Web distances once the GM enters links. |
| Specializations and concentrations | **Partly** | A tick box in the dialog; a weapon can pre-tick its specialization. |
| Combat, Spell, Hacking, Control and Task Pools | **Automatic** | Spent from the dialogs, shown as pips, refilled at the start of a combat and each Combat Turn (the Combat Pool at each action). |
| Karma Pool: re-roll failures, avoid disaster, buy a success | **Partly** | Buttons on the card; re-roll costs rise each time; a new card replaces the old. |
| Karma Pool dice added to a test | **Yes** | In the attribute, skill, attack and spell dialogs (v0.93.3), up to the test's own dice. |
| Karma Pool refresh | **Automatic** | At combat end by default; house rule: each session or by hand. |
| Open, complementary and teamwork tests, group rolls | **Partly** | The roller picks who helps; the card adds it up. |
| Inline roll links (`@SR2Test[...]`) and `/sr2` | **Automatic** | In journals, item text and chat. |
| Roll privacy by kind of test | **Automatic** | Each player sets it; cards others must answer are always public. |
| GM re-scores a card with another TN | **Partly** | Right-click the card; cards that followed from it are not changed. |
| Dice and TN calculator | **Automatic** | Chances of each number of successes and of a disaster. |

Known gaps: see `docs/REVIEW-v0.92.3.md`, Known limits (2 of its entries: pool refresh timing, Karma Pool in attack and spell dialogs).

## Combat

| What | How much | Notes |
|---|---|---|
| Combat tracker with initiative passes | **Automatic** | −10 per pass; a banner shows the turn, the pass and who acts. |
| Wound penalty on initiative | **Automatic** | Applied at the next roll, not mid-turn. |
| Surprise test, delaying, full defense, holds | **Partly** | Buttons in the tracker; the system tracks the state. |
| Ranged attacks: firing modes, recoil, range, called shots, Take Aim | **Automatic** | Range measured on the canvas; ammunition counted; jams and **Clear jam**. |
| Gunfire defence | **Automatic** | No dodge: Combat Pool dice go into the resistance test, a clean miss if they beat the attacker (book default). |
| Melee: opposed tests, counterattack, subduing | **Partly** | The defender picks the weapon on **Defend**. |
| Damage staging and armor (Ballistic or Impact, layering, Power − armor) | **Automatic** | Resolved on the **Resist** card. |
| Condition monitor, Stun overflow, dying and death | **Automatic** | **Resist** fills the boxes; overflow equals Body. |
| Knockdown | **Partly** | The card offers a **Knockdown test** after a hit that hurts. |
| Blasts, grenades and scatter | **Partly** | The player places the area; the card scatters it and lists who is inside. |
| Shooting through walls, barrier damage | **Partly** | The wall's SR2 barrier rating counts; the GM applies wall damage with **Barriers…**. |
| NPCs resisting by themselves | **Partly** | World setting, off by default; blasts still wait for **Resist all…**. |
| Undo or adjust applied damage | **Partly** | GM row on the card: **Undo**, −1 / +1 box. |
| Interception, stray shots, Fields of Fire suppressive fire | **By hand** | Not built. |

Known gaps: 13 entries under "Not built" in `docs/VERIFY.md`, *Combat*.

## Magic

| What | How much | Notes |
|---|---|---|
| Casting: Force, Spell Pool split between casting and drain | **Partly** | The caster picks in the dialog; the target gets **Resist**. |
| Drain | **Automatic** | Rolled with the cast and written to the monitor; the GM can undo it from the card. |
| Sustaining penalty, spell defense held from the Spell Pool | **Automatic** | **Cover targets** for allies. |
| Area spells | **Partly** | Place the area on the map; everyone inside becomes a target. |
| Rituals, anchoring, barriers and wards | **Partly** | A barrier or ward becomes an actor and a map region; the GM creates it when the player can't. |
| Background count, ward regions on the map | **Automatic** | From the scene and regions the GM sets. |
| Conjuring and banishing, services, drain | **Partly** | An elemental arrives after its ritual hours; the GM creates the spirit actor when the player can't. |
| Spirit sheets (Force-based attributes, powers, materializing) | **Automatic** | Attributes follow the Force. |
| Astral perceiving and projecting, projection time | **Automatic** | Physical buttons greyed while projecting; switching costs an action in combat. |
| Astral combat | **Partly** | **Astral attack** button; the Astral Combat Pool counts while projecting, not while only perceiving. |
| Foci: bonding for Karma, focus addiction test | **Partly** | The test is a button; the GM clears an addiction. |
| Adept powers and power points | **Partly** | Over-budget powers are marked, not blocked. |
| Initiation, metamagic, geasa | **Partly** | A deed waits for the GM's confirm; a broken geas adds +2 to magical tests. |
| Learning spells: formulas, teachers, learning test | **Automatic** | Karma is paid only on success; study time runs on the clock. |
| Dispelled spell's effect after its Force drops | **By hand** | Not rebuilt (known limit). |

Known gaps: about 18 items under "Not built" in *Sorcery* and about 22 in *Conjuring, spirits, astral…* (`docs/VERIFY.md`).

## The Matrix

| What | How much | Notes |
|---|---|---|
| Cyberdeck and persona ratings, Hacking Pool, Matrix initiative, Detection Factor | **Automatic** | From the deck in use and loaded programs. |
| Jacking in, logging on, travel to a host | **Partly** | The decker clicks; only found hosts are listed. The GM has **Move**. |
| System operations, attacks, perception, maneuvers | **Partly** | Dialogs per action; the card rolls. |
| Host security tally and alert | **Automatic** | Each decker's tally rises from their tests; a player's test posts a card for the GM to apply. |
| IC launched from the security sheaf | **Automatic** | Each step launches once until the tally is reset. |
| IC acting | **Partly** | IC get an act button in the tracker; the GM clicks **Attack** or **Act**. |
| Dump shock, biofeedback, deck damage, psychotropic IC | **Partly** | Follow-up buttons on the cards. |
| Persona condition track | **Automatic** | Same layout as the physical tracks, with Crash. |
| Programs, frames and agents | **Partly** | Load, launch, recall; loading while jacked in takes time. |
| Writing programs and building deck parts | **Partly** | A test, then time on the clock. |
| Generating a host's sheaf and paydata | **Automatic** | GM buttons on the host sheet. |
| Suppressing IC, several missing operations | **By hand** | Not built. |

Known gaps: about 23 items under "Not built" in `docs/VERIFY.md`, *The Matrix*.

## Rigging and vehicles

| What | How much | Notes |
|---|---|---|
| Vehicle sheet: Handling, Speed, Body, Armor, sensors, autosofts, damage track | **Automatic** | Drone vs vehicle picks the rules that apply. |
| Taking the controls, jumping in, Control Pool | **Partly** | Needs a control rig and a rigger adaptation; Control Pool usable only jumped in. |
| Driving and crash tests, crashes and passengers | **Partly** | Buttons on the sheet and cards; passengers take the damage the vehicle resists. |
| Feedback and dump shock for a rigger | **Partly** | **Resist feedback** or **Resist dump shock** card. |
| Mounted weapons, firmpoints and hardpoints | **Partly** | Pick who fires; the sheet counts mount points and warns. |
| Ramming | **Partly** | **Ram…**; the defense card has **Rammer's damage**. |
| Sensor tests, locks, jamming | **Partly** | A lock shows as a chip and runs out after a few turns. |
| Remote control deck, drone groups | **Partly** | Subscribe drones; group driving and group attacks. |
| Drone link intercept and spoof | **Partly** | On a drone a player doesn't own, the GM applies it. |
| Chases | **Partly** | A gap in metres per chase turn; the Maneuver Score system is not built. |
| Vehicle design, modifications, repairs | **Partly** | A mechanic's test and time on the clock. |
| Off-road speed, stress, vehicles against walls | **By hand** | Not built. |

Known gaps: about 28 items under "Not built" in `docs/VERIFY.md`, *Vehicles, rigging and building security* (shared with Security below).

## Gear, cyberware and Essence

| What | How much | Notes |
|---|---|---|
| Essence from installed ware, at its grade | **Automatic** | Essence can't be typed; an Essence hole fills first. |
| Bioware Body Index and system shock | **Automatic** | +1 TN per point over on Body tests. |
| Surgery and recovery | **Partly** | Pick who operates and the care; recovery days run on the clock. |
| Ware damage and repair | **Partly** | Damaged or not damaged only; no damage levels. |
| Shop: Availability find test, Street Index, haggle, delivery time | **Partly** | The player finds and clicks **Buy**; the item arrives when the time has passed. |
| Legality, permits and fines | **Partly** | The find card shows the risk; the GM ticks *Permit*. |
| Selling (**Fence…**) | **Partly** | A Negotiation test sets the offer. |
| Weapon accessories read from the description | **Automatic** | Fills only fields still at their default; **Undo** puts it back. |
| Custom tweaks on any item | **Partly** | The player sets them; they count only while the item is in use. |
| Carried / left behind, encumbrance warning | **Automatic** | A left-behind item weighs nothing and can't be used. |
| Gear actions: drugs, patches, bugs, radios, IDs, explosives | **Partly** | A button per kind of gear. |
| New entries from your own book | **Partly** | Paste a stat line; a player's entry waits for the GM. |
| Shadow clinic search, graded clinic fees | **By hand** | Not built. |

Known gaps: 4 entries under "Not built" in `docs/VERIFY.md`, *Gear, cyberware and bioware* (several items each).

## Health, healing, toxins and disease

| What | How much | Notes |
|---|---|---|
| Dying and bleeding as game time passes | **Automatic** | In and out of combat; resting waits until stabilised by default. |
| First aid | **Partly** | On the character or the targeted token. |
| Natural healing | **Partly** | **Rest and heal**; the roll and the boxes are done for you. |
| Hazards: falling, fire, drowning, cold, fatigue, radiation, suffocation | **Partly** | **Hazard** button with a damage card. |
| Fires on the scene | **Partly** | The GM starts, spreads and puts out fires from the Scene tab. |
| Toxins and drugs, wearing off | **Partly** | **Expose…** and **Take**; durations run on the clock. |
| Addiction and withdrawal | **Automatic** | Tracked on the Gear tab; **Kick the habit** when you can try. |
| Disease progress and spread | **Partly** | **Resist** when a test is due; **Spread…**. |
| DocWagon contracts | **Partly** | The player pays and calls; a biomonitor calls by itself when the wearer is dying; the GM confirms the team. |
| Interrupted rest, lifestyle while healing, medical fees | **By hand** | Not built. |

Known gaps: 11 entries under "Not built" in `docs/VERIFY.md`, *Damage, health and hazards*.

## Money, Karma and advancement

| What | How much | Notes |
|---|---|---|
| Awarding Karma and nuyen | **By hand** | The GM decides the amount; **Award Karma / nuyen** applies it to several characters. |
| Spending Good Karma on attributes, skills, spells, edges | **Automatic** | **Spend Karma…** shows each cost; unaffordable rows are dimmed. |
| Training time | **Automatic** | On by default: the rating rises when training ends; an instructor shortens it. |
| Rating lock after creation | **Partly** | Typed raises are allowed with a note, or refused while the approval queue is on; it runs in the player's browser. |
| Ledger of nuyen and Karma changes | **Automatic** | The latest 15; **Earn / spend…** writes a line, typing in the box does not. |
| Lifestyle rent, overdue days, owned lifestyles | **Automatic** | Runs on the clock; the GM panel warns when rent is due within a week. |
| Advancement log | **Automatic** | Every gain since creation, with who and when. |
| Things under way (training, orders, repairs) | **Automatic** | Finish when the GM moves time on; the GM can change or finish them. |
| Safehouses: build cost, upkeep | **Partly** | The GM sets one up; the player pays from the sheet. |
| Missed lifestyle payments | **By hand** | Not built. |

Known gaps: in the 4 *Core mechanics and characters* entries.

## Security, scenes and the GM's tools

| What | How much | Notes |
|---|---|---|
| Security sites: devices, tally, alert steps | **Automatic** | Tests on devices raise the tally; the alert follows. |
| Response time | **Partly** | Counted down in Combat Turns or minutes; a card says when it arrives. The GM places responders. |
| Lockdown locking doors, gas devices | **Automatic** | On reaching lockdown. |
| Camera and sensor regions | **Partly** | A whispered card with **Detection test**, or rolled at once (setting). |
| Guards looking, sneaking past | **Partly** | **Guards look…**; contest cards. |
| GM panel: scene, combat, party, NPCs, world, log, requests | **Automatic** | Alt+G. |
| World time and timers | **Partly** | The GM moves time with buttons; everything timed runs then. A GM must be logged in. |
| Scene builder | **Partly** | Map, light, people, site and host in one go; templates; removes what it made. |
| NPC generator | **Automatic** | People, groups, spirits, critters, contacts, jobs by Threat Level. |
| Undo log | **Automatic** | The last 50 steps by default, while a GM has the world open. |
| House rules window | **Automatic** | Searchable; shows each default and what changed. |
| Starter demo | **Automatic** | Four runners, a scene, a site, a host and a walk-through journal; removable. |
| Starter kits, item catalogue from your own data | **Partly** | The GM fills it (pasted rows or a catalogue file). |
| Encounter notes | **By hand** | Hidden on screen, but readable from a player's console. |

Known gaps: building-security items are among the 28 in *Vehicles, rigging and building security* in `docs/VERIFY.md`.

## Players' permissions and the GM-apply cards

Players never change documents they don't own. When a player's test changes something else, a GM applies it.

| What | How much | Notes |
|---|---|---|
| **Apply (GM)** cards | **Partly** | The GM's confirm lists what will change and who posted it. |
| Applying players' GM-only changes by themselves | **Partly** | World setting, off by default; even on, it covers only jams, holds, sensor locks and boxes on what the author owns. |
| Routine tests forced on your character (Defend, Resist, knockdown, toxin) | **Automatic** | Go ahead when the card comes from the other player's own character. |
| Costly or lasting effects from another player's card | **Partly** | *A card from another player* asks you first. |
| Cards with no source character | **Automatic** | Do nothing. |
| Actors a player can't create (spirits, barriers, bought vehicles) | **Partly** | Made by the GM's browser or a **Create … (GM)** button; a GM must be logged in. |
| Approval queue for purchases and Karma | **Partly** | Off by default; **Approve** shows what will run. A table rule, not a lock. |
| Defend or Resist prompts for many targets | **Partly** | At most 12 per card; others get one notice. |
| Hidden information | **By hand** | Whispers, blind rolls and hidden sheets are hidden on screen only. |

Known gaps: the limits in `README.md`, Security (checks that run in the player's browser).

## Testing this page

An outside tester can take each row above into a world (the starter demo is a quick start) and tick it off.
If a row is wrong, report it with the bug template on the project's issue tracker; the **Report a bug** button in the in-game guide gathers the versions, modules and house rules for you. Say which area and row.
