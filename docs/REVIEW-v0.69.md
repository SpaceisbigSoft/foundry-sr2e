# Final rules review after v0.68.0 (23 Oct 2026)

Plan 6, step 7. Seven fresh, independent reviewers compared the v0.68.0 code with SR2 and the 2nd-edition sourcebooks the system draws on (from memory; no book text is in the project). Six covered one area each:

1. combat and gear
2. health, cyberware and bioware, toxins and hazards
3. magic and critters
4. the Matrix
5. vehicles, rigging and building security
6. characters, skills, the street and upkeep

A seventh checked how the pieces added since v0.53.0 fit together, including what the Plan 6 interface work touched. Each reviewer also re-checked the checklist items ticked as done in its area (about 220 in all) and the VERIFY "Not modeled" and "Least certain" rows.

Two more fresh agents then checked every code claim in the seven reports against the source:

- **190 confirmed**
- **10 partly right** (a detail corrected below)
- **1 refuted:** report 7 said the Wolf totem's "berserk when a fight starts" check never runs. A `combatStart` hook in `applications/chat.ts` does run it, so the claim is dropped.

The reviewers' full reports and the checkers' tables are in the appendix. Line numbers will drift.

**Headline.** After merging duplicates the review found about 90 items. None is a missing SR2 chapter. They fall into three kinds:

- **22 bugs or exploits** that change play today. Examples: card buttons usable twice after a Karma re-roll, rolls taking a different wound penalty from the strip, helpless defenders dodging, players clearing Matrix traces, security responses lost when a combat ends.
- **21 rules holes** a table meets often.
- **About 45 occasional or rare items**, plus new book checks and stale doc rows.

Code changes are not part of this step. **Next: you pick what goes into v0.70.0 and later steps** (proposal in section 5).

Each finding gives its source report and finding id in brackets, for example [1-D1] for report 1, finding D1.

---

## 1. Bugs and exploits (fixed in v0.70.0, 23 Oct 2026)

| # | Problem | Evidence | Size |
|---|---|---|---|
| B1 | After a Karma re-roll the **original card's buttons stay live**: Defend, Resist and grenade Detonate work a second time, and after a reload a re-roll of the old card costs 1 Karma again, which sidesteps the rising cost. [1-D1] | Only the GM's retarget sets `supersededBy`; `decorateCard` (chat.ts ~831) reads that flag, not `SR2Actor.isReplaced`, which knows re-rolls by `testId`. Only `canRetarget` calls `isReplaced`. | S |
| B2 | **Defend isn't remembered once per card.** After a re-render, the Alt+D hotkey or the token HUD, a defender can defend again with fresh pool dice. [1-B1, 1-D3] | `onDefend` (chat.ts 34–101) only disables the DOM button; no flag. Resist is guarded (`resistedOn`). | S |
| B3 | A Karma re-rolled **soak brings back the knockdown, weapon-toxin and infection buttons**, so each can be rolled again. [1-D2] | `#resolveSoak` (~2373–2400); guards are keyed to the message id. The cyberware check keeps a `rolled` mark only in auto mode. | S |
| B4 | **Rolls use a different wound modifier from the one shown.** The pain editor and the v0.61.0 "ignore wounds" / "ignore Stun boxes" drugs change the strip, summary, GM panel and Initiative, but every test still takes the full penalty. [2-D1, 7-A2] | `derived.woundModifier` (models/index.ts:746) vs `SR2Actor.woundModifiers()` (index.ts:1365), which `#allTestModifiers` uses. Spot-checked. | S |
| B5 | **A drug's "TN on own tests" never reaches a roll.** [2-B1, 7-A3] | `derived.effectMods.testsTn` is computed and never read; `#allTestModifiers` reads `testsTn` from the `powerEffects` flag only. | S |
| B6 | **Paralysed, asleep, petrified or bound characters defend at full strength** (dodge with Combat Pool, opposed melee, counterattack, full defense). [7-A1] | `defend()` (~6282) treats only `incapacitated(status)` as helpless; `canAct()` blocks these statuses for acting but `defend()` never calls it. | S |
| B7 | **A projecting magician or an unmaterialized spirit can shoot, drive, give first aid and make physical tests;** the turn helper offers those buttons too. [3-A1, 3-D3] | Only manifesting forms are blocked (`attackWeapon` ~6138); `canAct()` (976) has no astral check; the spirit check at 6148 is on the target. | S |
| B8 | **Unmaterialized spirit tokens are visible to every player.** The v0.58.0 hiding only covers projecting magicians. [3-B1, 3-D5] | `tokenInvisible` (outfit.ts 213) knows `astralMode === 'projecting'` only; spirits are always `'physical'` (models 970); the update hook doesn't watch `system.materialized`. | S |
| B9 | **Critter and spirit powers ignore the astral/physical divide.** An unmaterialized spirit can Engulf or Fear a mundane; a mundane critter can hit an astral form. [3-A2] | `usePower` (~9037) has no `castingPlaneProblem` check; `castSpell` has one (6838–6846). | S |
| B10 | **The players' Matrix "Move" button teleports between hosts.** It skips the logon test, detection and travel time, and it escapes a black IC hold with one click. [4-D3] | `matrix-section.hbs:46` shows Move to any owner; `jackIn(hostUuid)` has no hold check. Its hint calls it the GM's shortcut, but nothing limits it. | S |
| B11 | **"Drop trace" and "Clear crippled" have no GM check,** so a player can end a trace lock-on or a crippler for free. "Clear psychotropic" is GM-only. [4-D4] | `#onDropTrace`, `#onClearCrippled` (sheets.ts ~2393–2400) vs `#onClearPsyche`. | S |
| B12 | **Sheaf IC launch is host-wide while tallies are per decker:** a second decker reaching the same step launches nothing. Launched IC doesn't join a running combat, and repeated launches pile up world actors. [4-D1, 4-D6] | `host.system.launchedSteps` in `#applyTally` (~10158); `SR2Actor.launchIc`. | S |
| B13 | **A security response triggered during a combat is stored as a Combat Turn number only.** It never arrives if the combat ends first, or "arrives" when a later combat reaches the old number. Acceleration and maneuver-position stamps carry over between combats the same way. [5-A1, 5-D4, 5-D5] | `applySiteChange` (~14495) with `response.worldTime = -1`; `responseDue` (rules/security.ts); `speedTurn.round`, `position.round`; nothing on `deleteCombat`. | S |
| B14 | **A site lockdown shuts the linked host down,** dumping the decker with dump shock. **A host shutdown locks the building down,** which since v0.61.0 releases every gas device. A Matrix sheaf step can gas the street team. [5-D1] | `RULES.SECURITY.hostAlert.lockdown = 'shutdown'` and its reverse `siteAlertForHost('shutdown')`; `startShutdown`; `SECURITY_V61.gas.onLockdown`. | S |
| B15 | **Dying only gets worse as combat rounds pass.** A character who goes down outside combat, or while waiting for DocWagon, never dies. A dying, unstabilised character can rest-heal. A stabilised patient who takes more damage stays stabilised. [2-A1] | The only box-adding path is `SR2Combat.#dyingTicks` (~15118); `dyingSince` is a round number; `naturalHeal` (~1204) doesn't check stabilisation. | M |
| B16 | **Stun past a full track loses its odd box on every hit,** so repeated Light Stun never reaches Physical. Tranq patches cap at 10 and spill nothing; stim payback uses the same floor. The 2:1 ratio itself goes to the book checks. [2-A2, 2-D3] | `applyDamageToMonitor` (rules/damage.ts:88–90) floors per hit; `applyPatch` (~6440); `#healthTicks` (5415). | S |
| B17 | **Smoke, gas and blast areas expire in real seconds outside combat** (a 20-turn grenade lasts one real minute), and every area thrown in a combat vanishes when it ends. [7-D3] | `drawArea` (canvas.ts:483) `expires.at = Date.now() + …`; `areaExpired` (526) returns true when the combat is gone. | S |
| B18 | **The approval queue misses several Karma spends.** Quicken spends Karma with no ledger line at all. Otaku channels and complex forms, the ally ritual, binding by true name and "made and bonded" focus enchanting don't ask the GM. An initiation request shows as "free" in the queue. [7-D1, 7-D2] | `quicken()` (8873–8888); `raiseChannel` (11685); `learnComplexForm` (11701); `#resolveAlly` (8063); `#resolveBindName` (8381); `#resolveEnchant` (8713); `advanceInitiation` files no `karma:`. | S |
| B19 | **Combat Pool isn't refreshed when a combat starts,** so the first Combat Turn runs on dice spent earlier. The strip shows them as current. The GM panel's refresh covers the party only, not NPCs. [1-B3, 1-D4] | `SR2Combat.nextRound` returns before `refreshPools` when not started (~15190); no `combatStart` reset; `ui.ts` ~857 `groupActors('party')`. | S |
| B20 | **Slap patches only work on characters the player owns,** with no Apply (GM) fallback, so a tranq patch can't be used on an NPC. A trauma patch stabilises with no roll (the roll is a book check). [2-A4, 2-D4] | `applyPatch` (~6425) `if (!target.isOwner)`; healing has `healApplyRoute`. | S–M |
| B21 | **Inline tests (`@SR2Test`, `/sr2`) add pool dice without spending them;** the card can't be Karma re-rolled. [7-D10] | `plainTest` (applications/inline.ts 89–91, 135). | S |
| B22 | **The program item sheet's "Loaded" box loads instantly,** skipping v0.57.0's Swap Memory time and action, even while jacked in. [4-B1, 4-D2] | `item-sheet.hbs:592`; `SR2Item._preUpdate` doesn't guard it. | S |

## 2. Rules holes a table meets often (fixed in v0.71.0, 23 Oct 2026)

All 21 are in v0.71.0, each behind a house-rule switch in `RULES.FIXES_V71` (`src/module/rules/config71.ts`, rows at the end of the house-rules list) so the old behaviour can be put back. R4 (Athletics) and R14 (the your-turn helper) are plain fixes; R17 turns the existing `RIGGING.needsAdaptation` on (drones count as adapted). Values from memory stay VERIFY: the specialization ratio, the sheaf tables, the repair tools needed (a shop), parts-before-boxes, the rebuild time, the astral switch costs.

| # | Problem | Evidence | Confidence | Size |
|---|---|---|---|---|
| R1 | **The Karma Pool can't be used on perceive, sneak, social, Pay, legwork, finding gear, haggling or fencing.** No re-roll, avoid-disaster or buy-success buttons on those cards. [6-A1] | These call `successTest` directly and post their own cards; contest cards support only the GM's TN change. | High | M |
| R2 | **Stealth and the observer in contests skip the shared skill-dice path,** so named-skill gear (v0.61.0), adept skill powers, skillsofts, articulation and the Stealth specialization never apply. A plain Stealth roll does add them. [6-D1, partly: Perception edges and flaws do reach the observer] | `stealthSide` (4928), `perceive` (3160), `sneakPast` (~4082) work dice from the raw rating. | High (code) | S |
| R3 | **Specializations and concentrations are free at creation.** They aren't counted, capped or paid for by lowering the base skill, so Firearms 6 (Pistols 9) passes. [6-A2] | `buildCheck` (rules/creation.ts) and `buildInputFor` count `system.rating` only; the skill picker sets the specialization to rating + 1. | High (that SR2 trades), medium (ratio) | S |
| R4 | **Athletics is linked to Quickness** in the starter list, the skill picker and the importer. SR2 and the system's own Athletics test use Body. [6-A3] | `config61/street.ts starterSkills`; `statblock.ts SKILL_ATTRIBUTE_HINTS` (`/athlet/` → quickness). Spot-checked. | Medium-high | S |
| R5 | **A jumped-in rigger dodges worse than someone driving by hand:** Control Pool dice only, against the attack TN. A manual driver rolls vehicle skill + Combat Pool. [5-A3, 5-D3] | `#defendVehicle` (~12558) vs `#manualEvasion`. | Medium-high | S |
| R6 | **Every site has the same response time** (one world-wide house rule); the Site actor has no field for its own. [5-A2] | `RULES.SECURITY.response`; `SiteDataModel.response.force` is free text. | High | S |
| R7 | **The MPCP caps nothing:** a rating-10 utility runs on an MPCP-4 deck, and MPCP damage leaves Bod, Evasion, Masking and Sensors at their old values. [4-A1] | `personaWarnings` (rules/matrix.ts:67) warns on base persona only; `effectivePersona` (240). | Medium-high | S |
| R8 | **Active memory only warns,** so a decker keeps everything loaded and Swap Memory never matters. [4-A2] | `memoryUse` flags `over`; `swapProgram` (~11176) has no memory check. | Medium-high | S |
| R9 | **No VR2 sheaf generator.** Hosts the NPC generator and safehouse builder make have no sheaf, so their tallies never trigger alerts or IC. [4-A3] | `npcgen.ts hostActorData`, `safehouse.ts:236`. | Medium | M |
| R10 | **A counterattack loses the defending weapon's extras:** stun-weapon half armor and charges, silver or wood against critters, poisoned blades, bone lacing, subduing. [1-A2] | `#defendMelee` builds a thin `CounterWeapon` (~412, ~6380); `#resolveMeleeDefense` posts no `armorExtras`. | High (code) | S |
| R11 | **A partial dispel doesn't shrink the spell's effect** (Armor dispelled from 5 to 1 successes still gives +5). [3-A5] | `#resolveDispel` (8848) rewrites `successes` only; `scaleBundle` exists. | Medium | S |
| R12 | **Spells, critter powers and banishing ignore invisibility.** The see-through roll happens only in the Attack dialog and Perceive. Notice, Sneak, guards, NPC-group and mounted attacks and melee defense treat invisibility as blind until then. [7-A4, 7-B4] | `#unseenTargets` (7113) and `#spellEnvironment` (7123) check walls only; `seeThroughInvisibility` called from sheets.ts:2984 and `perceive` (3150). | Medium-high | S–M |
| R13 | **Holds do nothing.** Binding's `blocksMovement` is never read. The grapple hold's `restrain`/`heldBy` has no effect and isn't released when the holder goes down or the combat ends. The berserk status has no effect of its own (the GM rules the actions); show it at least. [7-A5, 7-B3a] | `MAGIC_V61.holdPowers.binding.blocksMovement`; `holdTarget`/`setHeld` (6499–6531); `sr2eBerserk` only read to avoid a second roll. | High (code), medium (exact effects) | S–M |
| R14 | **The your-turn helper misses buttons that cost an action:** Matrix perceive, maneuver, utility, system test, release smoke, security action, Sneak, the vehicle sheet's Sensor test and Ram. The speed push spends no action at all. [4-D5, 7-D6 partly (Drive is mapped), 5-B2] | `BUTTON_ACTION_KINDS` (rules/interface.ts:145); handlers call `useAction`. | High (code) | S |
| R15 | **The status strip's initiative before the roll is wrong** for deckers, riggers, projecting magicians, spirits and wounded characters (it shows Reaction + Nd6). [3-D1, 7-D5] | `stripContext` (applications/interface.ts:111–113) vs `SR2Combatant.getInitiativeRoll` (14957–14997). | High (code) | S |
| R16 | **Single-shot weapons can fire twice in a phase** (SR2: only semi-auto). A remembered "Fire twice" also spends two actions on a Shift-click quick attack. [1-A1, 1-D5] | sheets.ts ~3092 and ~3409 `(mode0 === "SA" \|\| mode0 === "SS")`; `attackPrefs`. | Medium | S |
| R17 | **Jumping in needs no rigger adaptation by default.** The machinery exists behind a house rule. [5-A5] | `RIGGING.needsAdaptation: false`; `setController` checks `derived.adaptation`. | Medium | S |
| R18 | **Vehicle repair problems:** a flat TN 4 with no tools or shop; shot-out tires, sensors and engines are never fixed by the test or its timed project; a destroyed vehicle can be repaired box by box and keeps its dead marker; a vehicle destroyed outside the soak path (sheet boxes, botched mod) doesn't dump its rigger. [5-A4, 5-D2, 5-A12] | `repairVehicleTest` (~12815), `finishVehicleRepair`, `repairVehicle`, `#resolveInstall`. | Medium (book TNs), high (code) | M |
| R19 | **Switching to astral perception or projection costs no action.** [3-A4] | `onAstralModeChange` never calls `useAction`; no `RULES.ACTIONS.costs` key. | Medium | S |
| R20 | **Conjuring drain comes at the start of a timed elemental summoning,** not the end. Summonings under way don't count against the bound-elemental limit. [3-A11, 3-D4] | `conjure` rolls `#conjuringDrain` at once (8014); `maxBoundElementals` counts actors only. | Medium | S |
| R21 | **Foci taken free in the creation wizard arrive bonded,** and no spell points are charged. Buying with nuyen is also offered. [6-A4, partly] | adding.ts:170 `ready = payment === 'free'`; `readyPatch` sets `bonded`; `spellPointCheck` counts spells only. | Medium | S |

## 3. Occasional and rare items, and polish (O1–O21 fixed in v0.72.0; O22–O43 fixed in v0.73.0)

v0.72.0 (23 Oct 2026) fixed O1–O21, each behind a house-rule switch in `RULES.COMBAT_V72`, `HEALTH_V72` or `MAGIC_V72` (`rules/config72/*.ts`); see VERIFY.md "Occasional and rare items, part 1". The user agreed "do all"; the list was split in two versions.

v0.73.0 (23 Oct 2026) fixed O22–O43, each behind a house-rule switch in `RULES.NETRIG_V73`, `DRONES_V73`, `CHARACTERS_V73` or `CROSSCUT_V73` (`rules/config73/*.ts`); see VERIFY.md "Occasional and rare items, part 2". Section 3 is done.

**Combat and gear**
- O1: Any movement-blocking wall stops a blast completely, whatever its barrier rating. Gunfire uses the rating, so a window shields fully from a grenade but adds nothing against a pistol. [1-A3]
- O2: Take Aim is lost when a new Combat Turn starts; the aim cap uses the base skill even with a specialization. [1-A4]
- O3: Immunity to normal weapons adds armor but never stops an attack outright when Power doesn't beat it. [1-A5]
- O4: A called shot at an armor gap also ignores dermal and limb armor. [1-A6]
- O5: Light counts in melee but smoke doesn't (attack dialog and `attackSight`). [7-D13]
- O6: The ammunition list is fixed by the weapon model's allowed values; Fields of Fire rounds can't be added. [1-A8, partly]
- O7: No indirect fire (mortars, spotters) from Fields of Fire. [1-A7]

**Health, cyberware and bioware**
- O8: A second dose of a drug adds its bonuses again; there is no overdose beyond the Expose button. [2-A3]
- O9: Shadowtech bioware with health effects can't be set up: symbiotes, nephritic screen, extended-volume lungs. Suprathyroid works as "Other" with bonuses. [2-A6, partly]
- O10: Reaction enhancers stack with boosted reflexes. [2-A7]
- O11: Companion health edges and flaws do nothing: Will to Live, Pain Tolerance, Toughness, Sensitive System. [2-A5]
- O12: No heat or electricity hazards (an elemental shock effect exists for spells). [2-A8, partly]

**Magic and critters**
- O13: Every bound spirit goes free when its master dies; nature spirits and watchers should just leave. [3-A3]
- O14: Adepts fight on the astral plane with Sorcery or Willpower, not Unarmed Combat, and have no pool there. [3-A6]
- O15: No per-adept or per-aspect metamagic limit. [3-A7]
- O16: Dispelling drain gets no Spell Pool dice. [3-A8]
- O17: Mana and Physical Barrier spells create no barrier. [3-A9]
- O18: A spirit's or critter's innate spell needs a hand-added Sorcery skill. [3-A10]
- O19: Dual-natured critters and materialized spirits pass wards on the map. [3-A12]
- O20: A projecting magician's astral wounds count on tests but not on Initiative. [3-D2]
- O21: Partly stale: anchoring has no Karma cost; allies' Grimoire abilities (spells known, sense link) aren't modelled. [3-C]

**Matrix**
- O22: Graceful Logoff escapes a black IC hold. [4-A5]
- O23: Persona damage doesn't lower Matrix initiative. [4-A6]
- O24: Players see every host's code and Security Value in the log-on and Move dialogs (VR2 needs Locate and Analyze). [4-D7]

**Vehicles and security**
- O25: The rammer's damage button appears before the target defends; the rammer's passengers take no damage. [5-A6]
- O26: The control rig's TN bonus applies to driving and sensor tests but not to gunnery or evasion. [5-A7]
- O27: Sensor locks don't lapse with time or range (a failed later sensor test does drop one). [5-A8, partly]
- O28: Rare: no spoofing or interception of drone links; no mount capacities (firmpoints and hardpoints); missiles ignore Signature. [5-A9, 5-A10, 5-A11]

**Characters, skills and the street**
- O29: The skill dialog remembers the complementary skill, so it quietly rolls again on every later use. [6-D2]
- O30: The house rule `CHARACTERS_V58.negotiation.opposedAttribute` is read by nothing. [6-D3]
- O31: A lifestyle bought outright is 100 months paid ahead and lapses after about 8 game years; it can't be bought outright after creation. [6-B2, 6-D4]
- O32: A new skill learned with training time drops the specialization typed in the picker. [6-D5]
- O33: The skill picker prices Reaction-linked skills from augmented Reaction; `improve()` uses natural Reaction. [7-D7]
- O34: Racial modifiers can take an attribute to 0 with no warning. [6-A7]
- O35: The NPC generator sets no Threat Rating, uses Professional Rating 0–5 (Level 0 fails every morale test) and gives grunts a Karma Pool; hand-made NPCs start with Karma Pool 1. [6-A8]
- O36: Metatype choices are fixed when the code loads, so house-rule metatypes fail validation. [6-A9]
- O37: The starter list says "Rotor Aircraft", the picker "Rotorcraft". [6-B1]
- O38: Rare or unsure: edges and flaws are only TN changes (Exceptional Attribute and similar do nothing, and surplus flaw points do nothing); no dearer Karma band above the racial maximum (may be SR3). [6-A5, 6-A6]

**Cross-cutting**
- O39: Undo doesn't log Region documents (blast areas, environment regions, smoke and gas clouds, wards), and `UNDO_LIMITS` doesn't say so. [7-D4]
- O40: The GM's "Change target number…" list files Notice under magic and never offers Deafened, cyberear amplification, superior position or prejudice rows. [7-D8]
- O41: Statuses that outlive their reason: morale "broken" stays after the combat until a rally or a passed morale test; the hold's restrain and timed paralysis's effect entry linger. [7-D9, partly]
- O42: The advancement log and projects disagree: nuyen refunds on Give up aren't logged (totals too high); finished training writes a second line credited to the GM; a GM-approved order credits the GM. [7-D11]
- O43: A vehicle mod install pays at the end and loses the time if the payer can't pay; every other project pays up front. [7-D12]

## 4. Book checks to add to "Rules to verify"

New (the first two matter most):
- The Stun overflow ratio: now 2 Stun : 1 Physical (`STUN_OVERFLOW_PER_PHYSICAL_BOX`). Two reviewers remember SR2 as 1:1 (medium). The dying rate (`CONDITIONS.dying`), and whether it counts Combat Turns or minutes, is needed for B15.
- The ranged dodge TN is the attacker's final TN, so the attacker's own wounds, aim and recoil change the defender's dodge (low; it changes every ranged fight).
- Whether a skill test in combat is a Complex Action (`ACTIONS.costs.skill` is defined but used only by lock bypassing).
- Magical healing capped at the spell's Force (low; may be SR3).
- The Matrix:
  - A "black" host security code: two reviewers remember four codes, Blue to Red.
  - IC categories: Killer and Crippler are listed as gray; one reviewer remembers them as white.
  - Matrix Reaction: Intelligence + 2 × Response Increase, vs natural Reaction + 2 × Response Increase.
  - Response Increase capped by the MPCP.
  - Lethal black IC resisted with Body.
- Vehicles and security:
  - Rigger adaptation required to jump in (R17).
  - Vehicle repair TN and facilities by damage level.
  - Lockdown mapped to host shutdown (B14).
  - RCD drones per rating.
- Gear:
  - Sniper rifle and LMG ranges.
  - Missile launcher minimum range of 20 m.
  - Taser 10S, not 10M.
  - Bows against impact armor.
  - Reaction enhancers vs boosted reflexes.
  - A trauma patch as a stabilisation test.
- Magic and characters:
  - Spirits on the master's death, by kind.
  - Severe allergy worse than moderate.
  - Buying extra spell points with nuyen at creation.
  - Petrification armor.
  - The Professional Rating scale 1–4.
  - Edge and flaw caps.

Raised confidence on existing rows:
- The reviewer for characters is **highly confident** the priority table's Skills 50/40/34/30/27 and Resources D/E are SR3's numbers. As they remember SR2: Skills 40/30/24/20/17, and Resources A–E ¥1,000,000 / ¥400,000 / ¥90,000 / ¥5,000 / ¥500.
- The same reviewer is **medium-high** that the Karma skill bands switch at 1× and 2× the attribute.
- The same reviewer confirmed from memory: racial modifiers, race priorities, the 1.5× augmented maximum, the Karma Pool rate, attribute Karma, lifestyle and contact prices, and a starting Karma Pool of 1.

## 5. Proposed order (for you to agree)

1. **v0.70.0:** section 1, the 22 bugs and exploits (most are small and touch the shared card, defense and monitor paths), plus correcting the stale doc rows in section 6.
2. **v0.71.0:** section 2, the 21 common rules holes.
3. **v0.72.0:** the section 3 items you pick (or all of them).
4. **Then the v0.9 release.**

Book values stay house rules (the old way by default) until you check them.

## 6. Stale doc rows (VERIFY and the checklist)

Now done but still listed as not modeled, or out of date:

**Built in v0.61.0 but still listed as not modeled:**
- Spirits' initiative bonuses (v0.10.0 row).
- Per-turn timing of repeating powers (v0.12.0).
- Smoke grenades, hearing, drug effects and wards on the map (v0.50.0 "Not modeled": only "one-off effects a TN change can't take back" is still true).
- Fire immunity, drug immunity and Apply (GM) healing (v0.56.0).

**Partly done:**
- Astral tracking across planes (v0.15.0): partly built, through magical links.
- Hospital stays healing several boxes (v0.42.0): partly true already.
- Gas filling a sealed room (v0.31.0): partly built, through gas devices.
- Grenade arcs over walls (v0.43.0): built as bounced throws. Only the blast side is still missing (O1).

**Out of date:**
- Matrix rows: deck repair and deck building now wait out their time (v0.65.0); the security code drives more than IC initiative.
- Vehicle rows (v0.24.0 and v0.25.0): manual-driver evasion, dump when downed, hand-driven initiative, maneuver scores.
- Building security doubts: guards' perception and casing then circuit are built.
- Characters:
  - Training time is on by default (v0.65.0).
  - The safehouse workshop is applied.
  - The priority builder and "Fill the sheet" rows describe the old Build… dialog.
  - Perception distance is measured between tokens.

**To fix in place:**
- The v0.59.0 "Templates other than circles" row has a bracket that belongs to another row.
- Three v0.61.0 rows claim more than the code does: binding "held" (R13), drug TN and ignore-wounds (B4, B5), and the berserk status having an effect.

**Still open in the checklist and correct as listed:** the Bioware least-certain rows, the release tasks, and the book checks.

---

# Appendix A: verification

Two agents checked each code claim against `src/module` at v0.68.0.

| Report | Confirmed | Partly | Refuted | Rules-memory only |
|---|---|---|---|---|
| 1 combat and gear | 19 | 2 | 0 | 1 |
| 2 health and implants | 18 | 3 | 0 | 1 |
| 3 magic and critters | 28 | 0 | 0 | 1 |
| 4 Matrix | 21 | 0 | 0 | 2 |
| 5 rigging and security | 24 | 1 | 0 | 2 |
| 6 characters and street | 19 | 2 | 0 | 2 |
| 7 integration | 27 | 2 | 2 (one claim, made twice) | 0 |

Corrections (already folded into sections 1–3):

**Report 1**
- 1-A8: the house-rules Advanced JSON can replace `COMBAT.ammo`; the weapon model's allowed values block new rounds.
- 1-D2: the cyberware check keeps its mark only in auto mode.

**Report 2**
- 2-A6: symbiotes aren't in the importer's list.
- 2-A8: an elemental shock effect exists.
- 2-D3: the undo log does record the tranq and stim monitor writes.

**Report 5**
- 5-A8: a failed later sensor test drops the lock.

**Report 6**
- 6-A4: a focus can also be bought with nuyen at creation.
- 6-D1: Perception edges and flaws do reach the observer.

**Report 7**
- 7-D6: the vehicle Drive button is in the action map.
- 7-D9: a passed morale test also clears "broken".
- **Refuted:** 7-B3b and 7-C3c (Wolf's combat-start berserk check runs from a `combatStart` hook in chat.ts).

# Appendix B: the reviewers' reports

The seven reports follow as written (with their own numbering). Where Appendix A corrects a claim, the correction wins.

---

## Combat and gear review (v0.69.0)

Scope: the combat turn, initiative, actions, ranged and melee combat, damage and armor, grenades and blasts, ammo, accessories, weapon types, barriers, Karma Pool in combat; vehicles, Matrix and spells left to the other reviewers. Sources covered (from memory): SR2 core (Combat and Gear chapters), Street Samurai Catalog (2nd ed.), Fields of Fire, Shadowrun Companion.

Method: read `rules/combat.ts`, `firing.ts`, `damage.ts`, `initiative.ts`, `RULES.COMBAT` / `FIRING` / `ACTIONS` / `COMBAT_V61`, and in `documents/index.ts` `planAttack`, `attackWith`, `defend`, `#defendMelee`, `#resolveMeleeDefense`, `resistFromState`, `resistDamage`, `armorRating`, `#resolveSoak`, `#post`, `karmaReroll`, `buySuccess`, `useAction`, `takeAim`, `SR2Combat.*`. In `applications/` I read `sheets.ts` (the attack dialog and its dispatch), `chat.ts` (onDefend, onResist, onKnockdown, onBlastScatter, onKarma, decorateCard, blast detonation), `canvas.ts` (`blastBlocked`), `hotkeys.ts`, `tokens.ts` and `interface.ts`. I checked every finding below against the code. The core of this area is very complete. What is left is mostly follow-up buttons that can be used twice, a few rule details, and some gear numbers.

## A. Rules missing, partly done or done wrongly

1. **Single-shot (SS) weapons can fire twice in a phase.** SR2 (core): a semi-automatic weapon can fire twice in one Combat Phase (two Simple Actions). A single-shot weapon fires once per phase; that is the only real difference between SS and SA. Now: the attack dialog offers "Fire twice (two simple actions; SA/SS only)" for SS weapons too. `sheets.ts` ~3092 and the dispatch at ~3409 (`twice = … (mode0 === "SA" || mode0 === "SS")`) let a hold-out pistol or the taser fire two shots per phase. Also, "twice" is saved in `attackPrefs` and put back by `applyPrefs`, so a Shift-click quick attack can spend both Simple Actions without the player seeing it. Kind: wrong. Confidence: medium. Size: S. Priority: occasional.

2. **The counterattack damage drops the defending weapon's special rules.** SR2 (core): the winner of an opposed melee test hits with their own weapon's damage. Now: `#defendMelee` builds a `CounterWeapon` that holds only name, power, level, damage type, reach, ignoreImmunity and infection (`documents/index.ts` ~412 and ~6380). `#resolveMeleeDefense` then posts a `DamageState` without any of the `armorExtras` the attacker's hit carries. So when the defender wins:
   - a stun baton or shock weapon hits against full impact armor, not half (`STUN_WEAPONS`), and spends no charge;
   - a silver or wooden weapon ignores the critter's vulnerability (`material`);
   - a poisoned blade delivers no toxin (`toxinHit`);
   - bone lacing adds no unarmed Power (the attack path adds `lacePower`, the counter path doesn't);
   - "subduing" can't be chosen for the counterattack.

   Kind: partial. Confidence: high (code). Size: S. Priority: common at the table (every melee a defender wins).

3. **Walls stop blasts completely, whatever their barrier rating.** SR2 (core, Barriers and Grenades): a barrier between a blast and a target protects according to its Barrier Rating. A weak barrier (glass, a thin interior wall) is blown through or only takes Power off. Only a strong one stops the blast. Now: `chat.ts` ~186 drops every token behind any movement-blocking wall (`blastBlocked`, `canvas.ts` ~220, a plain collision test). The wall's `barrierRating` flag is never read there. Gunfire uses the rating (it adds to armor, `barriers.addsToArmor`), so the two disagree: a window with rating 0 shields fully from a grenade, yet adds nothing against a pistol. Suggested fix: treat the rating as extra armor (as gunfire does) or as Power lost, with a full block only when the rating beats the Power at the wall. Kind: partial. Confidence: medium (the exact SR2 rule is unclear; the inconsistency is not). Size: M. Priority: occasional.

4. **Take Aim is lost at the end of each Combat Turn.** SR2 (core): aiming lasts as long as the character does nothing else and keeps the same target and weapon. A new Combat Turn doesn't break it. Now: `aimModifier` / `nextAim` (`rules/tactics.ts` 27–38) need `aim.round === now.round`. Aiming in the last pass and firing in the first pass of the next turn gets no bonus. Also, the cap uses the base skill rating (`skill?.system?.rating`, `takeAim` / `#aimMods`) even when the attack uses a specialization. Kind: wrong (minor). Confidence: low-medium. Size: S. Priority: occasional.

5. **Immunity to normal weapons never stops an attack outright.** SR2 (core critter powers; Paranormal Animals of North America): immunity works as armor equal to twice the Essence (Force for spirits), and an attack whose Power doesn't beat that armor does nothing. Now: `armorRating` only adds `immunityArmor` / `immunityArmorFromEssence` (`rules/conjuring.ts` 42, `bestiary.ts` 143). With TN = max(2, Power − armor), a 4L hold-out still harms a Force 6 spirit at TN 2. There is no "Power at or below the immunity armor: no effect" check. This overlaps with the critter reviewer; I list it here because it is how every weapon meets these targets. Kind: wrong. Confidence: medium-low. Size: S. Priority: occasional (spirit fights).

6. **A called shot "at a gap in the armor" also ignores dermal armor.** SR2 (core): a called shot can aim at a spot the target's worn armor doesn't cover. Now: `armorRating(kind, { noWorn: true })` sets the whole sum to 0: worn armor, adept armor (`adeptArmor`), cyber and dermal armor (`cyberArmor`: dermal plating, orthoskin, a troll's dermal armor) and limb armor (`documents/index.ts` ~6703). Skin-wide armor has no gap to aim at. VERIFY describes this choice, but I think it misreads the rule. Kind: wrong. Confidence: low-medium. Size: S. Priority: occasional.

7. **No indirect fire (mortars, lobbed launcher rounds) from Fields of Fire.** Fields of Fire: indirect fire with a spotter, its own TN and its own scatter. Now: nothing (no `indirect` or `mortar` anywhere). Bounced grenades (`GEAR.grenades.bounce`) are the nearest thing. Kind: missing. Confidence: medium that FoF has it. Size: M. Priority: rare.

8. **The ammunition list is fixed.** SR2 core and Fields of Fire have more rounds than the seven in `COMBAT.ammo` (standard, APDS, explosive, EX-explosive, flechette, gel, tracer). Capsule rounds work through a weapon's toxin. Anything else, such as Fields of Fire's electrical stun rounds or assault-cannon rounds, needs code: `WeaponDataModel.ammoType` takes only the ids in `COMBAT.ammo`, and the house-rules window doesn't edit the list. Kind: partial. Confidence: low (exact FoF list). Size: S–M. Priority: rare.

## B. Checklist items claimed done that aren't (or are broken)

I checked 41 ticked items in my area: Initiative and actions; Melee and ranged; Gear and objects; the "Still open" lists from the v0.40.0 and v0.53.0 reviews; the combat rows of "Found after v0.58.0"; the v0.54.0 bug list. All are wired to a sheet, card or hook except these:

- **"Bug: once-per-card flags … a player can roll a GM card again after a re-render — v0.54.0 (every once-per-card button)".** The Defend button has no once-only memory. `onDefend` (`chat.ts` 34–101) only sets `button.disabled` in the DOM; it writes no flag and checks none. After any re-render (a reload, or a flag update on the message), Defend works again. The defender can roll a second defense with fresh pool dice, and each result card has its own live Resist button. Resist itself is guarded (`resistedOn`); Defend is not. The v0.59.0 hotkey (`newestButton`, which skips only disabled buttons) and the token HUD's `latestAttackOn` (`tokens.ts` ~298) both pick the card again after a reload.
- **"Stun baton charges" (v0.61.0).** A stun baton used for a counterattack spends no charge and loses its stun-weapon armor rule (see A2).
- **"The tracker's Next Round … pools not refreshed" (v0.59.0).** Fixed for Combat Turn 2 onward only:
  - `SR2Combat.nextRound` returns before `refreshPools` when the combat was not yet started (`if (!started) return this`, `documents/index.ts` ~15190).
  - There is no `combatStart` or `deleteCombat` hook that resets `poolSpent`.

  So Combat Pool spent outside combat, or in the last turn of an earlier fight, stays spent through the whole first Combat Turn of the next fight. The GM panel's "Refresh dice pools" resets only the party (`ui.ts` ~857, `groupActors('party')`), so NPCs need their sheets edited by hand.

## C. VERIFY "Not modeled" / "Least certain" rows

- Stale (now done): "Conjuring and spirits (v0.10.0)" Not modeled says "Still not modeled: spirits' own initiative bonuses (enter them under Adjustments)". v0.61.0 built them (`MAGIC_V61.spiritInitiative`, read in `SR2Combatant.getInitiativeRoll` through `d.initiativeBonus`).
- Stale in part: "Gear and combat (v0.43.0)" still lists "grenade arcs over walls" as not modeled. Bounced throws (no line of sight needed, +2 TN, an extra scatter die) cover the throw. What is still missing is the blast side (A3).
- Still a gap worth fixing: "Combat fixes (v0.21.0) — Blasts and walls: a wall … shields it completely". This is the inconsistency with barrier ratings in A3.
- Still a gap worth fixing: "Attack flow — Ranged defense: dodge TN = the attacker's final TN". This choice means the attacker's own wounds, aiming, recoil and so on also change the dodge. I can't confirm SR2's dodge TN from memory, but this row changes every ranged fight. Keep it near the top of the book checks, alongside the staging rows already listed.
- Still a gap: "Combat flow (v0.35.0) — Not modeled: buying successes with Good Karma". Rare; fine to leave.
- Least certain rows (melee ties and counterattacks, reach, knockdown, scatter numbers, armor layering, barrier damage): I have nothing new beyond what is already listed under "Rules to verify", apart from E below.

## D. Integration problems (rules added v0.54.0–v0.68.0)

1. **After a Karma re-roll, the original card's buttons stay live, the re-roll button included.** `karmaReroll` posts a new card through `#post(next, …)` without `like`. Only the GM's retarget sets `supersededBy`, and `decorateCard` (`chat.ts` ~831) goes by that flag alone, not by `SR2Actor.isReplaced`, which does know about re-rolls by `testId`. So on the old card:
   - Defend and Resist still work, giving a second defense or a second soak against the same attack;
   - a grenade's Detonate (`onBlastScatter`, keyed to that message) can go off a second time;
   - after a reload, Karma re-roll costs 1 again, because the old snapshot still has `rerolls: 0`. A player can re-roll the original card again and again at cost 1, getting round the escalating cost (`KARMA.escalating`).

   Fix: have `decorateCard` (and the button handlers) refuse when `SR2Actor.isReplaced(message)` is true. Severity: bug.

2. **Knockdown, weapon toxin (v0.55.0) and infection come back on a Karma re-rolled soak.** `#resolveSoak` (`documents/index.ts` ~2373–2400) adds the knockdown, `toxinHit` and `infection` buttons to every re-rolled soak card. Their guards (`cardDone(message, …, 'knockdownRolled' | 'toxinHitRolled' | …)`) are keyed to the message id, so each new card can be rolled again. The cyberware check alone keeps a `rolled` mark in the snapshot. To trigger: take a hit from a narcoject dart or a poisoned blade, resist the toxin, then Karma re-roll the soak; a second "Resist <toxin>" appears. Severity: bug.

3. **Defend is never remembered (see B).** It shows up more often now, because the v0.59.0 Alt+D hotkey and the HUD defend picker are driven from the DOM and re-arm after any re-render. Severity: bug.

4. **The first Combat Turn starts on stale pools (see B).** This also undercuts the v0.68.0 status strip: it shows "pools left" from the earlier fight as current. Severity: rough edge.

5. **A remembered "Fire twice" spends two actions on a Shift-click quick attack (see A1).** v0.68.0's turn helper greys buttons by the cheapest single-action cost (`buttonCost`). A Shift-click with "twice" remembered can still try to take two Simple Actions after one has already been used this phase. In 'warn' mode it then just warns and fires. Severity: rough edge.

No problems found with: Take Aim against TN automation (in `planAttack`, so it shows in the preview); the multiple-target penalty against full-auto spread and suppressive fire (correctly kept apart); mid-turn wound initiative against delay and full defense; smoke-grenade regions feeding `regionSmokeBetween`; the arming range and minimum range against the scatter path; the monowhip on re-rolls (already guarded).

## E. Possible wrong values (new, not already in Rules to verify)

- `config.ts` ITEM_TEMPLATES `sniperRifle.range` = 100/400/800/1300 m; SR2 as I remember it: 150/300/700/1000. Confidence: low-medium.
- `config.ts` ITEM_TEMPLATES `lmg.range` = 40/150/400/800 m; SR2 as I remember it: 75/200/400/800. Confidence: low.
- `config.ts` ITEM_TEMPLATES `missileLauncher.minRange` = 0 (unset); SR2 as I remember it: a 20 m minimum range for missile launchers (the short band starts at 20). `COMBAT_V61.launcher` already exists to enforce it. Confidence: low-medium.
- `config.ts` ITEM_TEMPLATES `taser` = 10M Stun; SR2 as I remember it (Defiance Super Shock): 10S Stun. Confidence: low.
- `config.ts` `COMBAT.armorFor.bow` = 'ballistic'; SR2 as I remember it: arrows and bolts are stopped by impact armor, like thrown weapons. Confidence: low-medium.
- `config.ts` `ACTIONS.costs['fire:SS']` together with the "twice" option: SS should allow one shot per phase (A1). Confidence: medium.

## F. Summary

Counts: A 8, B 3 (of 41 checked), C 6 rows (2 stale, 4 still a gap), D 5, E 6.

Top 5 to fix:
1. After a Karma re-roll, kill the original card's buttons (Defend, Resist, Detonate, Karma re-roll at the old cost) by checking `isReplaced` (D1).
2. Remember Defend once per card and attack, as Resist already is (B, D3).
3. Keep knockdown, toxin and infection buttons once per test (by `testId`), not once per message (D2).
4. Give the counterattack the defending weapon's extras: stun-weapon armor and charges, material, toxin, bone lacing (A2).
5. Refresh pools at combat start (and for NPCs from the GM panel), and stop SS weapons firing twice (B, A1).

---

## Health, bodies, toxins, hazards and implants review (v0.69.0)

Scope: condition monitor, overflow, dying and stabilising, healing, drugs, toxins, disease, hazards, slap patches, DocWagon, cyberware and bioware. Sources covered (from memory): SR2 core (Damage and healing, Cyberware, Gear), Shadowtech, Street Samurai Catalog, Cybertechnology, Shadowrun Companion. All paths are under `src/module/`.

## A. Rules missing, partly done or done wrongly

1. **Dying only gets worse during combat rounds.** SR2 core: a character past a full Physical track takes another box every so often until someone stabilises them. Time out of combat counts too, and the DocWagon wait (5–10 minutes) is exactly when this matters. Now: the only place that adds a box is `SR2Combat.#dyingTicks` (`documents/index.ts` ~15118), and it runs from the round change only. Nothing on world time adds boxes (`dyingSince` is read nowhere else). So a character who goes down out of combat, or is still dying when the fight ends, stays dying forever. The DocWagon card (`callDocwagon`, ~4488) shows a response time, but the patient can't die while waiting. Related problems in the same code: (a) `naturalHeal` (~1204) lets a dying, unstabilised character rest and heal at TN 8 with no first aid. (b) `dyingSince` holds a round number, so dying that starts in one combat and goes on into the next one (where the round count restarts at 1) doesn't tick until that combat gets past the old round number. (c) A stabilised patient who takes new damage while still dying stays stabilised. SR2 makes them need stabilising again; that part is medium confidence. Kind: partial. Confidence: high for the code; medium for (c). Size: M (a world-time tick in `#healthTicks` turning seconds into Combat Turns, no natural healing while unstabilised, and clearing `stabilised` when Physical goes up). Priority: common at the table.

2. **Stun past a full track loses boxes, and the 2:1 ratio looks like a later edition's.** SR2 core: once the Stun track is full, more Stun damage goes onto the Physical track. As I remember SR2 (and SR3), this is one Physical box per Stun box. The 2 Stun : 1 Physical ratio is SR4/SR5. Now: `applyDamageToMonitor` (`rules/damage.ts`:88–90) uses `Math.floor(overflow / STUN_OVERFLOW_PER_PHYSICAL_BOX)` on **each hit**, so an odd box is lost every time. On a full Stun track, repeated Light Stun hits (stun batons, tranq, drain) never cause any Physical damage. `#healthTicks` (stim payback, `documents/index.ts`:5415) has the same floor. Tranq patches (`applyPatch`, ~6440) cap Stun at 10 and don't carry the rest over at all. Kind: wrong. Confidence: high that remainders are lost; medium on the ratio. Size: S. Priority: common.

3. **A second dose of a drug adds its bonuses again; there is no overdose.** Shadowrun Companion / SR2 drugs: taking more doses while one is active doesn't add to the effect; it risks an overdose (a toxin-style test) and makes addiction likelier. Now: `takeDrug` (`documents/index.ts`:5206) pushes another entry onto `system.drugs`, and `models/index.ts`:626 adds every entry's attributes, Reaction and initiative dice together. Two doses of a +2 Quickness drug give +4, and the crashes pile up too. The only overdose is the Expose button. Kind: partial. Confidence: medium. Size: S–M (one active entry per drug name that refreshes its duration, plus an overdose card for doses that overlap). Priority: occasional.

4. **Slap patches can't be used on people the player doesn't own; trauma patches always work.** SR2 core gear: a tranq patch is meant for someone else (slapped on as a touch attack, then resisted with Body). A trauma patch helps stabilise a dying character: the rating works like a first-aid roll, not a guaranteed success. Now: `applyPatch` (`documents/index.ts`:6425) refuses any target the user doesn't own (`if (!target.isOwner)`), and unlike healing (v0.61.0 `healApplyRoute`) it has no Apply (GM) fallback. So a player can never tranq a guard, and can't use a trauma patch on another player's character or a GM-owned ally. There is no touch attack for an unwilling target. A trauma patch sets `stabilised` with no roll. Kind: partial. Confidence: high for the ownership problem; medium-low for the trauma test. Size: S–M. Priority: occasional.

5. **Companion health edges and flaws do nothing.** Shadowrun Companion: Will to Live (more Overflow boxes), High Pain Tolerance (boxes ignored for wound modifiers), Low Pain Tolerance, Toughness (extra dice to resist damage), Bio-rejection and Sensitive System (limit or penalise ware), allergies on characters. Now: edges and flaws (`RULES.STREET.qualities`, off by default) are only points plus an optional TN change on one skill or attribute. `overflowView`, `monitorStatus` and `compensatedMonitor` take no edge input. Kind: missing. Confidence: medium (Companion, optional). Size: M. Priority: rare.

6. **Shadowtech bioware with health effects can't be set up.** Shadowtech: symbiotes (better natural healing per level), nephritic screen (dice against blood-borne toxins), suprathyroid gland (attribute and Reaction boosts, plus a higher lifestyle cost), mnemonic enhancer, extended-volume lungs (holding breath against drowning and gas). Now: the statblock importer knows them by name but marks them `unmodelled` (`rules/statblock.ts`:566–570). `RULES.BIOWARE.kinds` has no such kinds. Suprathyroid can be typed in as attribute bonuses on an "Other" item. Symbiotes, the nephritic screen and extended volume can't, because no item field gives natural-healing dice, toxin dice or breath time. Kind: partial. Confidence: medium. Size: S each (symbiotes → dice in `naturalHeal`, like `rapidHealingDice`; nephritic screen → `toxinDice` for injection/ingestion; extended volume → drowning/suffocation turns). Priority: occasional.

7. **Reaction enhancers stack with boosted reflexes.** SSC: reaction enhancers work with wired reflexes but not with boosted reflexes. Now: `stackAugmentations` (`rules/cyberware.ts`:95) only makes wired, boosted and synaptic exclusive of each other; `enhancer` stacks with all of them. Kind: wrong. Confidence: low-medium. Size: S. Priority: occasional.

8. **No heat or electricity hazards.** SR2 core / Companion environment: extreme heat (like cold, with Stun from fatigue) and electric shock (live wires, electrified fences; Stun plus a Body test, impact armor not counted as it is for tasers). Now: `resistHazard` (`documents/index.ts`:5274) has falling, fire, drowning, cold, fatigue, radiation and suffocation only. Shocks exist only as stun weapons. Kind: missing. Confidence: low (I'm not sure core SR2 gives numbers). Size: S. Priority: rare.

## B. Checklist items claimed done that aren't (or are broken)

Checked 31 ticked items in my area (Damage/healing lists, Cyberware, Bioware, the v0.58.0 "Rules gaps a table will hit" health rows, the v0.53.0 bug list). Not really done:
- **"Smaller leftovers: … drug effects beyond attributes" (v0.61.0).** A drug's `testsTn` is summed into `derived.effectMods.testsTn` (`models/index.ts`:751) but never read: `#allTestModifiers` (`documents/index.ts`:1825) only adds `testsTn` from the `powerEffects` flag. A drug's `ignoreWounds` / `stunIgnoreBoxes` change the displayed wound modifier and Initiative, but not the TNs of tests (see D1).
- **"Slap patches: stim, tranq, trauma and antidote" (v0.55.0).** A tranq patch can't be put on anyone the player doesn't own, and neither can a trauma patch (A4).
- **"DocWagon contracts … response time".** The response time is text only. A dying patient doesn't lose boxes while waiting (A1), so the contract's main rule (getting there in time) never bites.

## C. VERIFY "Not modeled" / "Least certain" rows

- Stale (now done): the TN automation section's "Not modeled" row (VERIFY.md:892) still lists smoke grenades, hearing-based senses (cyberears, deafness) and drug effects beyond attribute changes. All three were built in v0.61.0 (`COMBAT_V61.smoke`, `COMBAT_V61.hearing`, `HEALTH_V61.drugs`).
- Stale (now done): the v0.56.0 "Not modelled" row (VERIFY.md:1005) still lists fire immunity against fire attacks and spells, immunity to drugs, and healing a patient the player doesn't own. All three are in v0.61.0 (`HEALTH_V61.immunity`, `healApplyRoute`).
- Stale, partly: the Health "Not modeled" row (VERIFY.md:679), "hospital stays that heal several boxes in one go". `naturalHealing` already heals every box that fits in the hours rested, and hospital care lowers the TN and charges per day.
- Stale, partly: the Toxins "Not modeled" row (VERIFY.md:512), "gas filling a sealed room". v0.61.0 gas devices release a toxin into the regions they watch on lockdown. Suffocation itself is still rolled by hand.
- Still a gap worth fixing: "overdoses beyond the Expose button" (VERIFY.md:679), together with doses stacking (A3).
- Still a gap worth fixing: "other Shadowtech items (use Other with bonuses)" (VERIFY.md:493). Symbiotes, nephritic screen and extended volume can't be entered by hand (A6).
- Still least certain and worth the book check: the Stun overflow row (VERIFY.md:16, 2:1) is listed in VERIFY but missing from the checklist's "Rules to verify" list; add it, along with the per-hit remainder bug (A2). Also the dying rate (`CONDITIONS.dying`), and whether it counts Combat Turns or minutes. The fix in A1 needs this value.

## D. Integration problems (rules added v0.54.0–v0.68.0)

1. **Pain editors and drugs change the shown wound modifier, but not the TNs of tests.** `models/index.ts`:746 works out `derived.woundModifier` with the pain editor (`painEditedMonitor`), the drug's `ignoreWounds` and `stunIgnoreBoxes`, damage compensators and adept pain resistance. Initiative (v0.54.0 `initiativeWoundPenalty`) and the v0.68.0 status strip (`applications/interface.ts`:112) read it. But tests take their wound modifier from `SR2Actor.woundModifiers()` (`documents/index.ts`:1365 → `#allTestModifiers`:1802). That uses only `compensatedMonitor` with the compensator and pain resistance. To trigger: a pain editor (or a drug with "ignores wound modifiers") at 4 Stun boxes. The strip shows no wound penalty, and every roll still gets "Wounds +2". Severity: bug. Fix: have `woundModifiers()` return `derived.woundModifier`.
2. **Drug TN changes never reach tests** (B, first item): `effectMods.testsTn` is worked out and never used. Severity: bug.
3. **Tranq-patch Stun and stim payback don't follow the soak path.** `applyPatch` (tranq) caps Stun at 10 with no overflow. Stim payback uses the floor overflow. Neither goes through trauma dampers, and only the stim payback spills into Physical. Both are direct monitor writes, so the Undo log and the Karma re-roll guard don't see them either. Severity: rough edge.
4. **Trauma and tranq patches have no Apply (GM) route** (A4), unlike healing and surgery since v0.54.0/v0.61.0. Severity: rough edge (bug for tranq, whose usual target is an NPC).

## E. Possible wrong values (new, not already in Rules to verify)

- `config.ts:STUN_OVERFLOW_PER_PHYSICAL_BOX` = 2. SR2 as I remember: 1 (box for box). Confidence: medium. (It's in VERIFY.md but not in the checklist's Rules to verify.)
- `config.ts:CYBERWARE.stacking.exclusive` = wired, boosted, synaptic. SSC as I remember: reaction enhancers are also exclusive with boosted reflexes, but not with wired. Confidence: low-medium.
- `config.ts:PATCHES` trauma = automatic stabilisation. SR2 as I remember: the patch rating works as the dice for a stabilisation test. Confidence: low-medium.

## F. Summary

Counts: A 8, B 3 (of 31 checked), C 4 stale or partly stale rows plus 3 still open, D 4, E 3.

Top 5 to fix:
1. Make `woundModifiers()` use `derived.woundModifier`, so pain editors and wound-ignoring drugs change real TNs (D1).
2. Dying on world time, plus no natural healing for an unstabilised dying patient, so DocWagon response time matters (A1).
3. Apply drug `testsTn` in `#allTestModifiers` (D2).
4. Carry Stun overflow box by box with no lost remainder, and send tranq and stim through it (A2, D3).
5. Apply (GM) for slap patches on others, so tranq patches work on NPCs (A4).

---

## Magic and critters review (v0.69.0)

Scope: traditions, sorcery, conjuring, astral, initiation and metamagic, foci, enchanting, allies and free spirits, critters, read against the code at v0.68.0 (baseline copy). Sources covered from memory: SR2 core (Magic, Critters), The Grimoire (2nd ed.), Awakenings, Paranormal Animals of North America / Europe, Shadowrun Companion; Bug City only where the code uses it (insect spirits).

Overall: the magic block is broad. Nearly every SR2 sub-rule has code and is reachable from a sheet or card. The real holes are the plane boundaries (what an astral form or unmaterialized spirit can do in the physical world, and the reverse), a few rules that apply to every spirit kind when they should apply to some, and stale VERIFY rows. I found no checklist row that is plainly fake. One is only partly done.

## A. Rules missing, partly done or done wrongly

1. **A projecting magician (or an unmaterialized spirit) can still act in the physical world.** SR2 (core): while projecting, the body is empty and the mind is on the astral plane. The magician can't shoot, drive, give first aid or make physical skill tests. An unmaterialized spirit has to materialize to touch the physical world. Now: the only block is for *manifesting* forms (`attackWeapon` in `documents/index.ts` ~6138, `isManifesting()` 7566). A projecting magician who isn't manifesting can attack with weapons, make skill, perception, social and driving tests, and use the Matrix or rigging. `canAct()` (976) has no astral check. `onAstralModeChange` (7594) only times the projection. An unmaterialized spirit can also make weapon or melee attacks on physical targets (the check at 6148 is on the *target*, not the attacker). Kind: missing. Confidence: high. Size: S (one check in `canAct`/`useAction` for physical kinds, plus the attacker side in `attackWeapon`). Priority: occasional (every projecting mage in a fight).

2. **Critter and spirit powers ignore the astral/physical divide.** SR2 (core, Grimoire): an unmaterialized spirit can't use powers on physical beings. A physical critter's power can't reach an astral-only target. Now: `usePower` (`documents/index.ts` ~9037) checks line of sight but never calls `castingPlaneProblem` or anything like it, so an unmaterialized spirit can Engulf, Fear or Confuse a mundane, and a mundane critter can hit a projecting astral form. `castSpell` does check (6838–6846). Kind: missing. Confidence: medium. Size: S. Priority: occasional.

3. **Every bound spirit becomes a free spirit when its master dies.** SR2 / Grimoire: nature spirits (and watchers) just go when their summoner dies. Allies, and possibly elementals with services left, are the ones that can go free. Now: `spiritOnMasterDeath` (`rules/glamour.ts` 216) applies one mode, `MAGIC_V61.masterDies` (default `'free'`), to every kind except `free`. So a nature spirit or a Force 1 watcher turns into a free spirit actor (`spiritKind: 'free'`). Kind: wrong. Confidence: medium. Size: S (mode per kind: nature/watcher depart, ally free, elemental by house rule). Priority: rare.

4. **Switching to astral perception or projection costs no action.** SR2 (core): shifting perception takes an action in combat (a Simple Action as I remember), and starting to project takes more. Now: `system.astral` is changed straight from the sheet. `onAstralModeChange` never calls `useAction`, and `RULES.ACTIONS.costs` has no astral-mode key. The v0.68 turn helper therefore never greys it. Kind: missing. Confidence: medium (on the exact cost). Size: S. Priority: occasional.

5. **A partial dispel doesn't shrink a spell's effect.** SR2 (core / Grimoire): dispelling takes successes off the spell, and an effect that scales with successes (Armor, Increase [Attribute] set "× successes") drops with them. Now: `#resolveDispel` (`documents/index.ts` 8848) rewrites `successes` on the Sustaining entry but leaves the target's `powerEffects` bundle as it was cast. Armor at 5 successes dispelled down to 1 still gives +5. VERIFY v0.56.0 lists this as not modelled. Kind: partial. Confidence: medium. Size: S (rescale the bundle with `scaleBundle` when `successes` changes). Priority: occasional.

6. **Adepts in astral combat default to Willpower.** SR2 (Grimoire/Companion as I remember): an adept with astral perception fights on the astral plane with Unarmed Combat, and killing hands apply. Now: `astralAttack` always uses `RULES.ASTRAL.attackSkill` ('Sorcery') and defaults to Willpower at +4. With v0.54.0 an adept also has no Spell Pool for astral attack or defense (`poolFor({astral})` → spell pool 0). Earlier reviews listed this under "check the book". My reading is that the current behaviour under-powers adepts. Kind: wrong. Confidence: low-medium. Size: S. Priority: occasional for adept PCs.

7. **No per-adept or per-aspect limit on metamagic.** SR2 Grimoire: physical adepts can learn only a few techniques (centering and the like), and aspected magicians can't take techniques of the art they lack. Now: `advanceInitiation(technique)` (`documents/index.ts` 7420) accepts any technique from `METAMAGIC` for any tradition. Some, such as quickening and dispelling, fail later on the Sorcery check, but shielding, reflecting, masking, invoking and possessing can be bought and used by an adept. Kind: missing. Confidence: low-medium. Size: S. Priority: rare.

8. **Dispelling drain gets no Spell Pool dice.** SR2: Spell Pool dice can go to drain resistance for sorcery, and dispelling is sorcery. Now: `dispel` calls `#drainTest({... poolDice: 0 })` (8839–8844). Casting drain allows pool dice (`drainPoolDice`). Kind: partial. Confidence: medium. Size: S. Priority: occasional.

9. **Barrier spells don't create a barrier.** SR2 (core): Mana Barrier and Physical Barrier are sustained manipulation spells that raise a barrier of the spell's Force. It stays up while the spell is sustained and falls when it drops. Now: a barrier only comes from a hand-made Barrier actor or a ward ritual (`wardPlan`/`finishWard`). The spell schema (`SpellDataModel`, `models/index.ts` 1403) has no barrier option, so casting the spell does nothing on the map, and dropping or dispelling it leaves any hand-made barrier standing. Kind: missing. Confidence: medium. Size: M. Priority: occasional.

10. **A spirit or critter's innate spell needs a Sorcery skill item.** SR2 Paranormal Animals / Grimoire: some critters cast innate spells, and free spirits cast with their Force/Magic. Now: `castSpell` refuses without a `Sorcery` skill (6776) and Magic > 0, so a spirit actor without a hand-added Sorcery skill can't cast. A power item is the workaround. Kind: partial. Confidence: low-medium. Size: S. Priority: rare.

11. **Conjuring drain comes at the start of a timed elemental summoning.** SR2: drain comes when the conjuring ends. Now: with v0.65.0 waits, `conjure` rolls `#conjuringDrain` straight away (8014) and the elemental arrives hours later. A magician can be knocked out at hour 0 and still get the elemental. The bound-elemental limit (`maxBoundElementals`) also doesn't count summonings still under way. Kind: wrong (timing). Confidence: medium. Size: S. Priority: occasional.

12. **Dual-natured beings and materialized spirits pass wards on the map.** SR2: a ward stops anything with an astral presence. As I remember, dual-natured critters and materialized spirits have to force it too. Now: `astralForm()` (`applications/regions.ts` 146) stops only projecting magicians and unmaterialized spirits. Kind: partial. Confidence: low-medium. Size: S. Priority: rare.

13. **Heal and Treat have no ceiling.** SR2 (as I remember): magical healing heals one box per success, but no more than the spell's Force. Now: `boxesHealed` (`rules/spellcraft.ts` 12) caps only at the boxes marked. Kind: possibly wrong. Confidence: low (the Force cap may be SR3). Size: S. Priority: common for healers if right.

14. **Starting magicians can't spend spell points on foci or buy more points.** SR2 creation (as I remember): starting Force/spell points can bond foci, and extra points can be bought with nuyen. Now: `STREET_V61.creation.nuyenPerSpellPoint: 0` ("can't buy more"), and no path spends spell points on bonding. Kind: missing. Confidence: low-medium (this may be SR3's version). Size: S. Priority: creation.

## B. Checklist items claimed done that aren't (or are broken)

I re-checked 43 ticked rows in my area: Magic and Critters, the v0.40.0 and v0.53.0 "still open" lists, and the magic and critter rows of "Found after v0.58.0". Each one has code reached from a sheet, card or hook. Two exceptions:

- **"Invisible characters and astral forms hidden from mundane viewers on the map" (v0.58.0, UI section)** is only partly done. Unmaterialized spirits stay visible to everyone. `syncInvisibility` (`applications/tokens.ts` 87) asks `tokenInvisible` (`rules/outfit.ts` 213), which only knows `astralMode === 'projecting'`. Spirits always have `derived.astralMode = 'physical'` (`models/index.ts` 970), and the update hook (tokens.ts 195) doesn't watch `system.materialized`. So every unmaterialized spirit token can be seen and clicked by mundane players.
- **"Smaller leftovers: … bound spirits freed when their master dies" (v0.61.0)** works, but it frees every kind, nature spirits and watchers included. See A3.

## C. VERIFY "Not modeled" / "Least certain" rows

- Stale (now done): Conjuring and spirits (v0.10.0), "Still not modeled: spirits' own initiative bonuses". Built in v0.61.0 (`MAGIC_V61.spiritInitiative`, used in `SpiritDataModel.prepareDerivedData`).
- Stale: Critter and spirit powers (v0.12.0), "Still not modeled: automatic per-turn timing of repeating powers". Built in v0.61.0 (`MAGIC_V61.repeating.autoPrompt`, `#repeatPowerTick` index.ts 5390).
- Stale: Magic and critters (v0.56.0) "Not modelled": "Fire immunity against fire attacks and elemental fire spells" and "immunity to drugs" (built in v0.61.0, `HEALTH_V61.immunity`), and "healing a patient the player doesn't own" (built: Apply (GM) healing card, index.ts ~8600).
- Partly stale: Astral signatures (v0.15.0), "Still not modeled: astral tracking across planes". v0.61.0 magical links (`MAGIC_V61.links`, `linkTrackTest`) now follow a sustained spell, spirit or focus back to its magician. Only trailing a projecting form is still a GM note.
- Still a gap worth fixing: "a partial dispel shrinking a spell's effect" (v0.56.0). See A5. It's cheap, and Armor and Increase spells are common.
- Still a gap worth fixing: the v0.65.0 "Still instant" row includes focus bonding and binding by true name. Focus bonding is the one players meet. SR2 bonding takes time (days per rating, as I remember).
- Still a gap, rare: anchoring has "no Karma cost or link to the anchoring object" (v0.18.0). Allies' own forms and powers (v0.48.0) are copied from a template only, so an ally's Grimoire abilities (spells known, sense link, astral gateway) aren't modelled.
- Least certain, my view: Bear "berserk when wounded, Willpower (4), 3 − successes turns" and Owl "+2 TN by daylight" match my memory. Shark's trigger may be wounding or killing a foe, not being wounded (low). Severe allergy has the same +2 TN as moderate (`CRITTERS.allergy.severe.tn`); I remember severe as worse (low).

## D. Integration problems (rules added v0.54.0–v0.68.0)

1. **The status strip shows the wrong initiative for projecting magicians and spirits (v0.68.0).** Outside a rolled combat, `stripContext` (`applications/interface.ts` 111) shows `derived.reaction + initiativeDice` d6. A projecting magician rolls Intelligence + 20 + 1d6 (`getInitiativeRoll` ~14990), and a spirit adds `derived.initiativeBonus` (+10, or +20 unmaterialized, v0.61.0). The strip shows neither. Severity: rough edge.

2. **A projecting magician's wounds count on tests but not on initiative (v0.54.0).** `getInitiativeRoll` skips the wound penalty for an astral form ("carries no physical wounds"), and `tokens.ts` 211 does the same. But astral combat damage goes on the same monitor (`attack.astral` soak), and `#runTest` still applies `woundModifiers()` to every astral test. Either astral damage counts for initiative too (my reading of SR2) or neither should. Severity: rough edge. Confidence: low-medium.

3. **A projecting magician doesn't drop out of tracker or turn-helper physical actions.** Linked to A1: the turn helper (`BUTTON_ACTION_KINDS`) offers Attack, Drive, First aid, Jack in and so on at full cost while the character is projecting, and nothing greys them. Severity: bug (same fix as A1).

4. **v0.65.0 waits and the bound-elemental limit.** An elemental "under way" (a project) isn't counted by `maxBoundElementals` until `finishElemental` makes the actor, so a magician can start Charisma + n summonings in parallel. Severity: rough edge.

5. **Unmaterialized spirit token visibility.** See B. The v0.58.0 sync never fires for spirits. Severity: bug (players see astral spirits).

## E. Possible wrong values (new, not already in Rules to verify)

- `config61/magic.ts:MAGIC_V61.masterDies` = `'free'` for every kind. SR2 as I remember: nature spirits and watchers depart, and only allies (and maybe elementals) go free. Confidence: medium.
- `rules/config.ts:RULES.ACTIONS.costs` has no cost for changing astral mode. SR2 as I remember: a Simple Action to shift perception. Confidence: medium.
- `rules/config.ts:RULES.CRITTERS.allergy.severe.tn` = 2 (the same as moderate). SR2 Paranormal Animals as I remember: severe is a larger TN penalty than moderate. Confidence: low.
- `rules/config61/street.ts:STREET_V61.creation.nuyenPerSpellPoint` = 0. SR2 as I remember: extra spell (Force) points can be bought with nuyen at creation. Confidence: low (could be SR3).
- `rules/spellcraft.ts:boxesHealed` has no Force cap. SR2 as I remember: healing is capped at the spell's Force. Confidence: low.

## F. Summary

Counts: A 14, B 2 (of 43 checked), C 4 stale or partly stale rows and 3 gaps still worth noting (plus least-certain notes), D 5, E 5.

Top 5 to fix:
1. Block physical actions for a projecting magician and an unmaterialized spirit (A1, D3).
2. Hide unmaterialized spirits on the map (B, D5).
3. Add a plane check to `usePower` (A2).
4. Rescale a spell's effect when a dispel removes successes (A5).
5. Bound spirits on the master's death by kind: nature spirits and watchers depart (A3, E).

---

## The Matrix review (v0.69.0)

Scope: cyberdecks, persona, Hacking Pool and Matrix initiative, grid and hosts, tallies and sheaf, operations, utilities, IC, cybercombat, dump shock, deck damage and building, otaku, frames and agents, sims, paydata, jacking in and out. Sources covered (from memory): SR2 core Matrix chapter, Virtual Realities 2.0, Shadowrun Companion (nothing decker-specific that the code lacks and I'm sure of).

Framing note on sources. SR2 core's Matrix uses a node map (CPU, SPU, datastores, I/O ports, SANs, slave nodes). Each node has a security code and rating, and IC sits in the nodes (Access, Barrier and Scramble as white IC; Blaster, Killer, Tar Baby, Tar Pit and Trace as gray; then black). SR2 core has no Detection Factor, no security tally or sheaf, and no ACIFS subsystems. VR2 replaced all of that with hosts (Security Code plus Security Value, and Access, Control, Index, Files, Slave), the per-decker tally and sheaf, Detection Factor, the new IC list and the new utilities. The code's structure is VR2 throughout. The places where SR2-core (or SR1-era) ideas remain are listed in A4.

## A. Rules missing, partly done or done wrongly

1. **MPCP doesn't cap utility or frame ratings, and a damaged MPCP lowers no caps.** SR2 core and VR2: a deck can't run a program rated above its MPCP. The persona programs are also limited by the MPCP, so when blaster, sparky or burn damage lowers the MPCP, everything above the new value stops working at its old rating. Now: `personaWarnings` (rules/matrix.ts:67) checks only persona programs, and only against the *base* deck (`personaWarnings(base)` in models/index.ts `deckerDerived`). It only warns. `bestUtility`, `systemTest`, `matrixAttack`, `launchFrame` and `swapProgram` never compare a program's rating with the MPCP, so a rating-10 attack utility runs on an MPCP-4 deck. `effectivePersona` (matrix.ts:240) subtracts damage from each value separately, so with MPCP 6→3 a Bod of 6 stays 6. Kind: missing. Confidence: medium-high. Size: S. Priority: common at the table (character building and every blaster hit).

2. **Active memory isn't a limit.** SR2 core and VR2: loaded programs must fit in active memory. To load more, you swap something out. Now: `memoryUse` only flags `over` (shown as a warning), and `swapProgram` (documents/index.ts:11176) loads anything with no memory check. This is still the v0.17.0 VERIFY row "warned only". It makes v0.57.0's Swap Memory timing toothless, because a decker just keeps everything loaded. Kind: partial. Confidence: medium-high. Size: S. Priority: common at the table.

3. **No VR2 host and security-sheaf generation.** VR2 builds a host from its security code: a Security Value range, subsystem ratings, and a sheaf whose trigger steps come every few tally points (closer together for higher codes), with IC and alerts drawn from tables by code and alert state. Now: the GM types every sheaf step by hand on the host sheet. The hosts the NPC generator (`npcgen.ts hostActorData`) and safehouse builder (`safehouse.ts:236`) make have a code, a value and subsystems but **no sheaf**, so their tally never triggers anything (no alert, no IC, despite v0.61.0's auto-launch). There is no "Generate sheaf" button the way there is a "Generate paydata" one. Kind: missing. Confidence: medium (that VR2 has the tables; numbers not given here). Size: M. Priority: common at the table (GM prep for every run).

4. **SR2-core ideas mixed into the VR2 frame (the contradictions VERIFY doesn't name).**
   - *Barrier IC guarding a subsystem* (`behavior: 'barrier'`, `guardingIc`, Decrypt Access / Decrypt Slave vs its rating) is SR2 core's node IC. In VR2, Decrypt Access, File and Slave beat *scramble* IC, which can protect a subsystem as well as a file. In the code, scramble guards files only. Low-medium.
   - *Matrix Reaction = Intelligence + 2 × Response Increase* (`matrixReaction`, matrix.ts:57). As I remember SR2 core and VR2, it's the decker's own natural (unaugmented) Reaction plus Response Increase. The code's own note that "cyberware Reaction does not count" fits that reading, but it uses Intelligence instead. Low-medium.
   - *IC dice and initiative from the IC's rating* is SR2-core-style IC. VR2 runs IC off the host's Security Value. That's already in "Rules to verify", so I only note which book each reading comes from.
   - *A 'black' security code* (`MATRIX.securityCodes`, paydata, dump-shock and IC-dice tables) appears in neither book (see E).
   Kind: wrong (mixed). Confidence: as given per point. Size: S each. Priority: common at the table.

5. **Graceful Logoff escapes a black IC hold with no Willpower test.** VR2: a decker engaged by black IC can't simply leave. v0.57.0 makes Jack out a Willpower test. Now: the `logoff` effect in `#resolveSystem` (index.ts ~9908) moves the decker to the parent grid on any success with no `blackIcHold()` check, and `holdingIc` only looks at IC in the current host, so the hold just disappears. I'm not sure whether VR2 lets Graceful Logoff break an engagement; if it doesn't, this is a hole. Kind: partial. Confidence: low. Size: S. Priority: occasional.

6. **Persona damage doesn't lower Matrix initiative.** v0.54.0 made meat wounds lower Initiative, and v0.57.0 gives persona damage the wound TN modifiers on tests. `SR2Combatant.getInitiativeRoll` (index.ts:14986) subtracts the meat wound penalty but not `matrixWoundModifiers`. I'm not sure VR2 applies persona damage to initiative. Kind: partial. Confidence: low. Size: S. Priority: occasional.

## B. Checklist items claimed done that aren't (or are broken)

Checked 23 items: the v0.40.0 and v0.53.0 "Still open" lists for the Matrix, plus "Security sheaf steps launching their IC", "An unconscious or dead decker stays jacked in", "Jacking in or out costs no action" and "Items dropped arrive loaded" from the v0.58.0 sweep. These are not fully done:

- **Loading programs: load speed and a Swap Memory action (v0.57.0).** The Matrix tab's checkbox goes through `swapProgram`, but the program's own item sheet still has a plain `system.loaded` checkbox (public/templates/item-sheet.hbs:592) that loads instantly, with no action, even while jacked in. `SR2Item._preUpdate` doesn't guard it. Also see A2 (no memory limit).
- **Black IC holding a decker who tries to jack out (v0.57.0).** It can be dodged two ways: the players' **Move** button (`#onJackIn` → `jackIn`, which has no hold check; see D3), and Graceful Logoff (A5).
- **Security sheaf steps launching their IC (v0.61.0).** This works for one decker. With the per-decker tally it fails for the second decker (D1). Generated hosts have no sheaf to launch from (A3).

All the others were found wired up: the per-decker tally, persona damage modifiers, Sensors and Evasion maneuvers and perception, shutdown and Crash Host dumping, Cloak, Lock-On, Slow, Restore and Validate, data bombs, comcalls, the reality filter, hitchers, BTL chips, party and construct IC, signal range and numbers, upload and edit, agent search, frames in initiative, programming and deck building, tortoise and ICCM, otaku, dump-when-down, and the action costs.

## C. VERIFY "Not modeled" / "Least certain" rows

- Stale: v0.27.0 "Deck damage … 1 hour each (shown only)". Since v0.65.0 the repair runs as a project and the deck stays damaged until it's done (`repairDeckTest`, index.ts ~11083).
- Stale: v0.46.0 "Building decks … paid on success". Deck parts now wait out their time too (`finishDeckPart`).
- Stale: v0.17.0 "Security code: Only sets default IC initiative dice". It also drives paydata, and the dump-shock and IC-initiative house rules.
- Still a gap worth fixing: v0.17.0 "Memory … warned only". See A2.
- Still a gap worth fixing: v0.17.0 "Persona limits … warned, not blocked". See A1. The check also ignores MPCP damage and utility ratings.
- Still a gap worth fixing: v0.28.0 "The Jack in dialog still moves anywhere with no test". It's open to players, not just the GM (D3).
- Still true, but left to the GM by agreement: satellite range, psychotropic effects outside the Matrix, Shield against non-black attacks, otaku submerging and fading, tamper alarms on Matrix tampering, download time run on the clock.
- Least certain, nothing new to add beyond A4 and E: the otaku persona formula, tortoise effects, the simsense overload test (I don't remember it in VR2: low), agents (likely VR2 smart frames rather than a separate program; already doubted).

## D. Integration problems (rules added v0.54.0–v0.68.0)

1. **Per-decker tally (v0.57.0) × sheaf IC launch (v0.61.0).** `host.system.launchedSteps` is host-wide (`#applyTally`, index.ts ~10158). When decker A's tally reaches step 6, its IC launches. When decker B's own tally later reaches step 6, nothing launches, because the step is already in `launchedSteps`, and nothing clears it until the whole host's tally is reset. The launched IC also isn't tied to the decker whose tally fired it. To trigger it: two deckers in one host with a sheaf step that names IC. Severity: bug.
2. **The item sheet's Loaded checkbox skips Swap Memory (v0.57.0).** See B. Any owner can load a utility mid-run instantly, with no Simple Action. Severity: rough edge.
3. **Players' "Move" button teleports between hosts.** `matrix-section.hbs:46` shows Move to anyone who owns the decker, and `jackIn(hostUuid)` moves with no logon test, no detection roll, no grid path, no travel time (v0.40.0), and **no black IC hold check** (v0.57.0), so being held is escaped with one click. Its hint says it is "the GM's shortcut", but nothing restricts it. Severity: bug.
4. **Trace and crippling can be cleared by a player.** `#onDropTrace` and `#onClearCrippled` (sheets.ts ~2393–2400) have no GM check, though the trace icon's tooltip says "GM: drop the trace". `#onClearPsyche` *is* GM-gated, so the three are inconsistent. A player can end a trace IC lock-on, or undo a crippler, for free, which also makes v0.57.0's Restore utility pointless. Severity: bug.
5. **The Plan 6 turn helper misses most Matrix buttons.** `BUTTON_ACTION_KINDS` (rules/interface.ts:145) has jackIn, jackOut, matrixAttack and runMedic, but not systemTest, matrixPerceive, matrixManeuver, useUtility, releaseSmoke, securityAction or toggleLoaded, though each spends a Simple or Complex Action when clicked (sheets.ts 1957–2388, 11187). So they're never greyed out when a decker has no actions left. Severity: rough edge.
6. **Sheaf-launched IC don't join the combat.** `SR2Actor.launchIc` creates a linked world actor but doesn't add it to a running combat, so an IC that a sheaf step launches mid-fight never acts until the GM adds it by hand. Repeated launches also pile up world actors. Severity: rough edge.
7. **Players see every host's code and Security Value.** The System operation dialog ("Hosts and grids (log on)", sheets.ts ~2046) and the Move dialog list every host actor in the world as "CODE-Value". In VR2, finding a host and learning its rating takes Locate and Analyze. This leaks GM prep. Severity: rough edge.

## E. Possible wrong values (new, not already in Rules to verify)

- `config.ts:RULES.MATRIX.securityCodes` includes `'black'` (with matching rows in `icInitiativeDice`, `paydata.codes`, `MATRIX_V57.dumpShock.byCode` and `icInitiative.diceByCode`). SR2 core and VR2 as I remember them: four codes, Blue, Green, Orange and Red ("black" is an IC category, not a host code). Confidence: medium.
- `config61/security.ts:SECURITY_V61.sheafIc.categories.gray` includes `killer` and `crippler`. VR2 as I remember it: Killer, Crippler, Probe and Scramble are white IC; Blaster, Ripper, Sparky, Tar Baby, Tar Pit and Trace are gray. Only the label and Analyze output are affected (black is what matters mechanically). Confidence: medium.
- `rules/matrix.ts:matrixReaction` = Intelligence + 2 × Response Increase. SR2 and VR2 as I remember them: the decker's natural Reaction + 2 × Response Increase. Confidence: low-medium.
- `config.ts:RULES.MATRIX.maxResponseIncrease` = 3, not tied to the MPCP. In VR2 the maximum Response Increase may depend on the MPCP (roughly MPCP ÷ 4, at most 3). Confidence: low.
- `config.ts:RULES.MATRIX.blackIcResist` = 'willpower' for all black IC. VR2 may resist lethal black IC with Body and non-lethal with Willpower. Confidence: low.

## F. Summary

Counts: A 6, B 3 (of 23 checked), C 3 stale and 3 gaps (plus agreed GM leftovers), D 7, E 5.

Top 5 to fix:
1. D3: gate or test the players' Move button (no logon, detection or travel, and it escapes black IC holds).
2. D4: put a GM check on Drop trace and Clear crippled.
3. A1: the MPCP caps utility and frame ratings, and MPCP damage lowers the persona.
4. A2 and D2: make active memory a limit, and route the item sheet's Loaded box through Swap Memory.
5. D1 and A3: make sheaf IC launch per decker's tally, and add a VR2 sheaf generator (and give generated hosts one).

---

## Vehicles, rigging and building security review (v0.69.0)

Scope: vehicle stats, driving tests and the Control Pool, control rigs, rigger initiative, RCDs and drones, vehicle combat (ramming, crashes, damage, mounts, sensors, ECM/ECCM), chases, design and modifications, repair; building security (sites, maglocks, sensors, guards, response, tally and alerts, barriers, bypass), and the security side of safehouses. Sources covered (from memory): SR2 core (Vehicles and Drones, rigging, street gear security devices), Rigger 2, Corporate Security Handbook, Shadowrun Companion (rigger bits), Fields of Fire (vehicle weapons).

Code read: `rules/vehicles.ts`, `rules/roadwork.ts`, `rules/security.ts`, `rules/netrig.ts`, `rules/config.ts` (`VEHICLES`, `RIGGING`, `SECURITY`, `VEHICLES_V57`, `SECURITY_V57`, `TN_AUTO.rigging`), `rules/config61/security.ts`, `models/index.ts` (vehicle and site models), `documents/index.ts` (setController … repairVehicle, the site functions, `SR2Combatant.getInitiativeRoll`, `syncCondition`/`#downedOut`, `_preUpdate`), `applications/sheets.ts` (vehicle and site sheet handlers), `public/templates/actor-vehicle-sheet.hbs`, `actor-site-sheet.hbs`.

## A. Rules missing, partly done or done wrongly

1. **The security response gets lost or turns up at the wrong time when the alert goes active during a combat.** CSH: once the alarm is raised, the response team turns up after a delay that belongs to the site. Now: `applySiteChange` (documents/index.ts ~14495) stores the due time as a *Combat Turn number* only, with `response.worldTime = -1`, whenever a combat is running (`responseDue` in rules/security.ts). `securityResponses` checks that round against whatever combat is running. If the combat ends first (common: the runners break contact, or the GM ends the fight), the response never arrives; the only fix is Reset on the site. If a new combat starts later, its round counter starts again at 1, so the response "arrives" when the new combat reaches the old number, which has nothing to do with the time that has passed. Nothing on `deleteCombat` turns the remaining Combat Turns into world time (chat.ts ~1029 handles only the Karma refresh). Fix: always store a world-time deadline too (3 s per Combat Turn, now that the clock runs during combat since v0.59.0) and check whichever comes first. Kind: wrong (bug). Confidence: high. Size: S. Priority: common at the table.

2. **One response time for every site.** CSH: how long the response takes depends on the site: guards on site arrive in turns, a corp's reaction team in minutes, a Lone Star or Knight Errant contract by zone, a remote site much longer. Now: `RULES.SECURITY.response` (3 Combat Turns / 5 minutes) is a single world-wide house-rule value. The site model (`SiteDataModel.response`) has only a free-text `force` field and no delay of its own. Add per-site turns and minutes, defaulting to the rule value. Kind: partial. Confidence: high (that it varies by site). Size: S. Priority: common at the table.

3. **A jumped-in rigger evades worse than someone driving by hand.** SR2 and Rigger 2: dodging with a vehicle is the same driving-based defense for everyone; the rigger's advantage is the Control Pool (and their rigged Reaction), used where others would use the Combat Pool. Now: `#defendVehicle` (~12558) gives a jumped-in rigger **only Control Pool dice** (no skill dice) against the attack TN. `#manualEvasion` (v0.57.0, the default `evasion.manual: 'driving'`) gives a manual driver **vehicle skill dice plus Combat Pool dice** against Handling plus the driving modifiers. So a rigger who jumps in loses their skill dice on defense, and is usually worse than a non-rigger in the same car. Make the jumped-in rigger's evasion the same driving test with Control Pool in place of Combat Pool, including the rig's TN bonus (see 7). Kind: wrong. Confidence: medium-high. Size: S. Priority: common at the table (every vehicle fight with a rigger).

4. **Vehicle repair: flat TN, no tools needed, and shot-out systems never fixed.** SR2/Rigger 2: the repair TN and the facilities needed (kit, shop, facility) depend on how badly the vehicle is damaged, and a destroyed vehicle can't simply be patched back up. Now: `repairVehicleTest` (~12815) rolls B/R against the flat `SKILLS.vehicleRepair.tn` 4 with no tool or shop check. The v0.58.0 tool levels (`CHARACTERS_V58.tools`) are used for gear and weapon repair but not here. It only lowers `system.condition`: shot-out tires, sensors and engine (`system.systems`, v0.57.0 called shots) stay broken after the mechanic has repaired every box, and only the GM's full "Repair" button (`repairVehicle`) clears them. A destroyed vehicle (10/10) can be repaired box by box, and its `dead` overlay stays on the token, because only `repairVehicle` removes it and nothing syncs the overlay when `condition` drops (the `_onUpdate` path tracks the vehicle condition only for floating numbers). Kind: partial. Confidence: medium (book TNs), high (the code gaps). Size: M. Priority: occasional.

5. **Rigger adaptation is not required by default.** SR2/Rigger 2: a rigger can jump only into a vehicle with a rigger adaptation (a control interface); ordinary vehicles are driven by hand. Now: `RIGGING.needsAdaptation: false`, so any vehicle can be jumped into, and the `adaptation` modification (2,500¥ × Body) has no effect unless the GM switches the house rule on. The machinery is all there (`setController` checks `derived.adaptation`). Turn the default on, or at least list it under Rules to verify. Kind: wrong default. Confidence: medium. Size: S. Priority: common at the table.

6. **The rammer takes damage even when the ram misses, and the rammer's passengers take none.** Ramming: both vehicles are hurt only when the ram connects. Now: the attack card offers "Rammer's damage" (documents/index.ts ~1989) as soon as the driving test scores a success, before the target has defended. A fully dodged ram still gets the button, and nothing marks it as moot. The rammer's share is applied as `crash: true`, so `#resolveVehicleSoak` skips passenger damage for the people in the ramming vehicle, while the rammed vehicle's passengers do take damage (it comes in as an attack). Kind: partial. Confidence: medium. Size: S. Priority: occasional.

7. **The control rig's TN bonus is missing from gunnery and evasion.** If the rig lowers vehicle-test TNs (the system's own `RIGGING.vcr.tnPerLevel`, −1 per level), it should lower every vehicle test the jumped-in rigger makes. Now: it is added in `drivingModifiers` (driving, ramming, pushes, crash tests) and in `sensorSituation` (sensor tests), but not to mounted-weapon fire by a jumped-in driver (`attackWith` with `mounted.role 'driver'`, ~5953), and not to the rigger's Control Pool dodge (`#defendVehicle`). Either drop it everywhere (if SR2 has no such TN bonus: low confidence that it does) or apply it everywhere. As it stands it is inconsistent. Kind: partial. Confidence: medium on the inconsistency, low on the rule itself. Size: S. Priority: common for riggers.

8. **Sensor locks never lapse.** Rigger 2: a sensor lock is kept up turn to turn and is lost when the target breaks out of sensor range or contact, or jams or spoofs it. Now: `system.locks` entries last "until dropped on the sheet" (VERIFY, the v0.25.0 table). A lock gained at the start of a chase still gives sensor-enhanced gunnery after the target has left the scene or the sensors were shot out (`systems.sensors` doesn't clear locks). A Combat Turn expiry, or dropping a lock when a later sensor test fails or the target moves out of `sensorRange`, would close it. Kind: partial. Confidence: medium. Size: S. Priority: occasional.

9. **No electronic warfare against a drone's control link beyond jamming.** Rigger 2: besides jamming, a hostile rigger or decker can intercept and decrypt a remote-control signal, and spoof commands to take over a drone; RCDs have encryption against this. Now: only `jamTest` (cuts the link). There is no spoofing, interception or link encryption (grep "spoof" finds only Matrix utilities). Kind: missing. Confidence: low-medium (I'm fairly sure Rigger 2 has spoofing; less sure about the details). Size: M. Priority: rare.

10. **Mount types and capacity (firmpoints, hardpoints, turret sizes).** Fields of Fire / Rigger 2: mounts come as firmpoints (light weapons), hardpoints (heavy weapons), turrets of several sizes and pintles, each with Body/CF limits and a cost; what you can mount depends on them. Now: `VEHICLES.mounts` is none/fixed/turret/pintle with no capacity or weight limit, and the v0.57.0 design's `mounts` stat is a plain count. Kind: missing. Confidence: medium. Size: M. Priority: rare.

11. **Missiles against vehicles ignore Signature.** SR2/Fields of Fire (as I remember): a guided missile's Intelligence adds dice, and its lock is against the target vehicle's Signature rather than plain range. Now: `guidance` adds Intelligence dice (`attackWith` ~5956); the target's Signature plays no part unless the firing vehicle holds a sensor lock with the `signature` gunnery house rule. Kind: partial. Confidence: low. Size: S. Priority: occasional.

12. **Destroyed outside the soak path: no dump shock or token status.** When a vehicle reaches 10 boxes some other way (the sheet's condition boxes `setCondition`, a botched mod installation in `#resolveInstall`, which adds `botchBoxes` straight onto the track), the jumped-in rigger isn't dumped and the `dead` overlay isn't set; only `#resolveVehicleSoak` does that. Kind: partial. Confidence: high (code). Size: S. Priority: rare.

## B. Checklist items claimed done that aren't (or are broken)

Checked 42 ticked rows in "Vehicles and rigging", "Security rigging and building security", their "Still open" lists, and the "Found after v0.58.0" rows in this area (unconscious rigger dumped; vehicle Stun immunity; hand-driven vehicle initiative; action costs for jumping, sensors and drone commands; unlinked tokens in passenger and subscribed-drone lookups; security gas on lockdown; NPC generator vehicles). All are present and reachable from a sheet or card. Caveats:

- *Vehicle design rules (Rigger 2)*: ticked, but the chassis, powerplant and point-cost rows are labelled examples, and the system is a simple point-buy rather than Rigger 2's design steps. It works as a tool, but it isn't the book rule; it should stay marked partial until book data goes in.
- *Acceleration limiting speed changes*: works through `_preUpdate`, but the push (`#onPushSpeed` → `pushSpeed` → `driveTest`) is a driving test that spends no action, while the plain Drive button spends a Complex Action (`sheets.ts` 6117). Small, but the turn helper misstates it.
- *Called shots at vehicles*: work, but see A4: the systems they break are never fixed by the repair test.

## C. VERIFY "Not modeled" / "Least certain" rows

- Stale (now done or changed): v0.24.0 table, "Vehicle defense: only the Control Pool of a rigger jumped into it … otherwise no dodge". Manual drivers have evaded since v0.57.0 (`#manualEvasion`).
- Stale: v0.24.0 table, "Rigger dump shock: the vehicle is destroyed while a rigger is jumped in". Since v0.59.0 a rigger who goes unconscious is dumped too (`#downedOut`, `CONDITIONS.dumpWhenDown`).
- Stale: v0.24.0 table, "Initiative: … otherwise its autopilot's". Since v0.59.0 a hand-driven vehicle acts at its driver's speed (`SR2Combatant.getInitiativeRoll`).
- Stale: the Building security header's doubts ("SR2 may use Perception tests by guards … maglock rules may involve a sequence of tests"). Both are built: guards (v0.49.0) and casing then circuit (v0.57.0). The doubt now is about the numbers, not whether the rule exists.
- Stale in part: the v0.25.0 header's "the book's chase rules may work quite differently (range bands and maneuver scores)". Maneuver scores exist as a house rule (v0.57.0).
- Still a gap worth fixing: none of the remaining "Not modeled" rows in this area (cargo shape, guards on patrol routes, tamper alarms on Matrix tampering, turret traverse by Combat Phase) matter much. Patrol routes are the most visible at the table but are fine left to the GM. The real gaps are in A1–A5, which no VERIFY row lists (per-site response time, the response timing bug, rigger evasion, repair TN by damage and facilities, the adaptation default).
- Add to "Least certain": `SKILLS.vehicleRepair.tn` flat 4 (the skills block mentions "the vehicle repair TN", but not that it ignores the damage level and facilities); `RIGGING.needsAdaptation` default.

## D. Integration problems (rules added v0.54.0–v0.68.0)

1. **A site lockdown dumps the decker, and a host shutdown gasses the building.** `RULES.SECURITY.hostAlert` maps a site's `lockdown` to the host's `shutdown` (since v0.26.0). Since v0.57.0, reaching `shutdown` calls `startShutdown`, which dumps everyone in the host after 3 Combat Turns with dump shock. The reverse mapping (`#raiseHostAlert` → `siteAlertForHost('shutdown')` = `lockdown`) means a host reaching shutdown from a sheaf step locks the building down, which since v0.61.0 also sets off every gas device (`SECURITY_V61.gas.onLockdown`). So a physical lockdown (a GM button, a tamper alarm chain) silently ends the team decker's run, and a Matrix sheaf step can knock out the street team with gas. Neither book links the two that tightly. Suggest the default mapping lockdown ↔ active, or a confirm before a linked alert causes a shutdown or a gas release. Severity: bug (surprising at the table). Confidence: medium.
2. **Repair (v0.65.0 timers) vs called shots (v0.57.0).** `finishVehicleRepair` lowers only `condition`, so a vehicle repaired through the timed project keeps its shot-out tires, sensors and engine, and a formerly destroyed vehicle keeps its `dead` overlay (see A4). Two repair projects can also be started on the same boxes, because `repairVehicleTest` reads `condition` before the first project has finished (harmless thanks to the clamp, but the second mechanic's hours are wasted). Severity: rough edge.
3. **Rigger evasion vs manual evasion (v0.57.0).** The new manual-driver evasion is stronger than the old jumped-in rigger dodge (A3). Severity: bug in balance.
4. **Response timing and the v0.59.0 world clock.** Now that a Combat Turn advances world time by 3 s, the response could simply be a world-time deadline in all cases; the round-only path (A1) is what breaks. Severity: bug.
5. **Round-stamped vehicle state across combats.** `speedTurn.round` (Acceleration) and `position.round` (maneuver scores) compare against `game.combat.round`. A new combat restarts at round 1, so a stale stamp from an old combat can match: the Acceleration window then starts from the old speed, or an old position bonus applies for one turn. Clear both on `deleteCombat`. Severity: rough edge.

## E. Possible wrong values (new, not already in Rules to verify)

- `RIGGING.needsAdaptation` = false; SR2/Rigger 2 as I remember: jumping in needs a rigger-adapted vehicle (true). Confidence: medium.
- `SKILLS.vehicleRepair.tn` = 4 for any damage; SR2/Rigger 2 as I remember: the TN rises with the damage level, and Moderate or worse needs a shop or facility. Confidence: medium-low (on the numbers).
- `SECURITY.hostAlert.lockdown` = 'shutdown'; nothing in SR2/VR2/CSH as I remember forces a host shutdown because the building went into lockdown; 'active' fits better. Confidence: medium.
- `RIGGING.remote.dronesPerRating` = 2; I remember Rigger 2's RCD subscription limit working differently (by the deck's rating and Flux, not rating × 2). Confidence: low.

## F. Summary

Counts: A 12, B 0 broken (3 caveats out of 42 checked), C 5 stale rows plus 2 additions, D 5, E 4.

Top 5 to fix:
1. Security response stored as a Combat Turn only: lost when the combat ends, or wrongly due in the next combat (A1/D4); add a world-time deadline.
2. Per-site response time on the Site actor (A2).
3. A jumped-in rigger's evasion should be the driving test with Control Pool (plus the rig bonus), not Control Pool dice alone (A3/D3).
4. Site lockdown ↔ host shutdown mapping auto-dumps deckers and sets off gas from a Matrix sheaf step (D1); default to active.
5. Vehicle repair: TN and facilities by damage level; clear shot-out systems and the destroyed overlay; no box-by-box repair of a destroyed vehicle (A4/D2).

---

## Characters, skills, the street and upkeep review (v0.69.0)

Scope: creation (priorities, metatypes, attributes, skills, resources, contacts, wizard checks), skills (kinds, concentrations and specializations, defaulting and the Skill Web, B/R, complementary, open and teamwork tests), Rule of One / Six, Karma (Good Karma, Karma Pool, awards, raising costs), edges and flaws, advancement and training, social tests, perception and stealth, reputation, contacts and legwork, lifestyles, buying (Availability, Street Index, haggling, fencing, fake IDs), grunts and morale, the NPC generator, safehouses as a street matter. Sources covered from memory: SR2 core (Creating a Shadowrunner, Skills, Running the Shadows, Gamemastering, gear prices), Shadowrun Companion (edges and flaws, alternate creation, advancement), Street Samurai Catalog / Fields of Fire only for prices and availability.

Code read: `rules/creation.ts`, `upkeep.ts`, `street.ts`, `skills.ts`, `karma.ts`, `advancement.ts`, `paperwork.ts`, `npcgen.ts`, `catalogue.ts`, `config.ts` (`KARMA`, `METATYPES`, `PERCEPTION`, `SOCIAL`, `MORALE`, `UPKEEP`, `SKILLS`, `CREATION`, `STREET`, `NPCGEN`, `CHARACTERS_V58`), `config61/street.ts`; in `documents/index.ts`: `rollSkill`, `#skillDice`, `#openTest`, `perceive`, `socialTest`, `#socialSides`, `negotiatePay`, `sneakPast`, `stealthSide`, `notice`, `improveCost`, `improve`, `#startTraining`, `legwork`, `findItem`, `haggle`, `fence`, `#karmaButtons`, `avoidDisaster`, `buySuccess`; `applications/creation.ts`, `buildinput.ts`, `adding.ts`, `spendkarma.ts`, `sheets.ts` (`#onRollSkill`), `chat.ts` (Change TN, award dialog); `models/index.ts` (character schema, derived attributes).

## A. Rules missing, partly done or done wrongly

1. **Karma Pool can't be used on opposed and street tests.** SR2 core: the Karma Pool (re-roll failures, avoid a disaster, buy successes) works on any test the character makes. Now: only cards made by `#runTest` / `#post` get `#karmaButtons` (`documents/index.ts` ~2409). These all call `successTest` directly and post their own card with no Karma buttons, and a disaster gets no avoid-disaster prompt: `perceive` (3140), `sneakPast` (4061), `socialTest` (3221) and so `negotiatePay` (3605), `legwork` (~4590), `findItem` (Availability test), `haggle` (4223) and `fence` (4245). Contest cards (`flags.sr2e.contest`) support only the GM's Change target number (`chat.ts` ~1723). These are some of the commonest player tests (sneaking, perceiving, Etiquette and Negotiation, legwork). Kind: partial. Confidence: high. Size: M (re-roll and buy on one side of a contest, then rescore with `contestContent`). Priority: common at the table.

2. **Specializations and concentrations are free at creation.** SR2 core: at creation a specialization (or concentration) is paid for by lowering the general skill: the narrower rating goes up as the general rating comes down, so specializing doesn't add points. (The v0.58 review raised this under "check the book", but it never made it onto the checklist.) Now: `buildCheck` (`rules/creation.ts`) and `buildInputFor` (`applications/buildinput.ts`) count only `system.rating`. `specializationRating` and `concentrationRating` aren't counted, aren't capped at 6 (`skillMax`) and don't need the base lowered. The skill picker sets the specialization to rating + 1 for nothing (`specRatingOf` in `adding.ts`), and the wizard's skill rows let the player type any specialization rating. So Firearms 6 (Pistols 9) passes the build check. Kind: wrong. Confidence: high that SR2 needs the trade-off, medium on its exact ratio. Size: S. Priority: common at the table (almost every character specializes).

3. **Athletics is linked to Quickness in the starter list, the skill picker and the importer.** SR2: Athletics is a Body skill. The system's own `RULES.STREET.athletics.attribute` is `'body'`, and the NPC generator uses Body. Now: `config61/street.ts` `starterSkills` has `{ name: 'Athletics', attribute: 'quickness' }`. `statblock.ts` `SKILL_ATTRIBUTE_HINTS` sends `/athlet/` to Quickness, and the skill picker (`skillAttributeFor` → `guessSkillAttribute`) and the stat-block or character import both use that table. The result is the wrong defaulting attribute and the wrong Karma cost bands (`improveCost` uses the skill's linked attribute). The athletics test itself reads `STREET.athletics.attribute`, so a player-made Athletics skill disagrees with the system's own athletics test. Kind: wrong. Confidence: medium-high. Size: S. Priority: common.

4. **Foci bought in the creation wizard are bonded for free.** SR2 creation: bonding Karma for starting foci comes from the magician's starting spell points (one point per Karma), since a new character has no Good Karma. Now: in creation the only payment is "free", which defaults to ready (`adding.ts` line 170 `this.ready = this.payment === 'free'`), and `readyPatch` (`sheettools.ts` 22) sets `bonded: true`. No spell points are charged: `spellPointCheck` (`paperwork.ts`) counts only spells. Kind: wrong. Confidence: medium. Size: S. Priority: occasional (every magician who starts with a focus).

5. **Edges and flaws can only be TN modifiers on one skill or attribute.** Companion: many edges and flaws change other rules. Exceptional Attribute raises one racial maximum; Toughness helps damage resistance; Will to Live adds overflow; Bad Luck works on Karma Pool use; Sensitive System affects cyberware Essence; Combat Paralysis affects initiative or surprise; Quick Healer affects healing. Companion creation also lets flaw points pay for edges or be traded for build resources. Now: `Quality` (`street.ts`) is `{ points, target, tn }` only, read by `qualityModifiers`, and `qualityCheck` only checks `edges <= flaws` (`balance`), so surplus flaw points do nothing. `attributeMaximums` can't see an Exceptional Attribute. Kind: partial. Confidence: medium (which edges exist and their numbers: low). Size: M. Priority: occasional (off by default).

6. **Raising an attribute past the racial maximum with Karma is refused outright.** SR2: I remember natural attributes could be raised beyond the racial modified limit (up to the 1.5× attribute maximum) at a higher Karma rate. This may be SR3 only, so check it. Now: `attributeCost` (`upkeep.ts` 37) returns `ok: false` above `attributeMaximums(...).natural`, with no dearer band. Kind: missing (if SR2 has it). Confidence: low. Size: S. Priority: occasional in long campaigns.

7. **Racial modifiers can push an attribute to 0.** SR2: racial modifiers can't take an attribute below 1 (a troll or ork must buy the base high enough). Now: `buildCheck` checks base 1–6 only. `CharacterDataModel.prepareDerivedData` computes `total = Math.max(0, natural + mod + gear)`, so a troll with base Charisma 1 has Charisma 0 and nothing warns. Kind: missing. Confidence: medium-low. Size: S. Priority: rare.

8. **The NPC generator ignores SR2's Threat Rating.** SR2 Gamemastering: NPCs carry a Threat Rating / Professional Rating pair, and the system models Threat Rating (`system.threatRating`, which adds Combat Pool dice through `STREET.threat`). Now: `npcActorData` (`npcgen.ts` ~499) never sets `threatRating`. It gives a Karma Pool from `NPCGEN.threat[].karmaPool` instead (a later-edition idea for grunts). Professional Rating runs 0–5: Threat Level 0 gives PR 0, which fails every morale test, and Level 5 gives PR 5, while I remember SR2's scale as 1–4. Hand-made NPCs also start with Karma Pool 1 (`karma.pool` initial 1 on the shared character schema), which SR2 grunts don't have. Kind: partial. Confidence: low-medium. Size: S. Priority: occasional.

9. **Metatypes are fixed when the code loads, so house-rule metatypes and metavariants can't be picked.** Companion (from memory): metavariants and alternate creation, point-based. Now: `METATYPE_IDS = Object.keys(RULES.METATYPES.types)` runs at import (`rules/core.ts` 8) and is the `choices` of `system.metatype` (`models/index.ts` 268). A metatype added through the house rules' Advanced JSON fails validation. There is no point-based build at all (grep for point-based / build points: none). Kind: missing. Confidence: high on the code, low on what the Companion contains. Size: S for the choices fix, L for point-based creation. Priority: rare.

## B. Checklist items claimed done that aren't (or are broken)

I checked 27 ticked items in my area: the Core character rules "Still open (v0.53.0)" list (10), the Other systems lists (v0.32, v0.40, v0.53; 15), and "Found after v0.58.0" (creation spell points, leftover cash and lifestyle outright; fake SINs; NPC generator totems and vehicles; starter skill list; safehouse workshop). All of them exist and can be reached from a sheet, card or dialog. Partly broken:
- *Smaller leftovers: a starter skill list.* It lists Athletics as Quickness (A3), and has "Rotor Aircraft" where the picker's `COMMON_SKILLS` says "Rotorcraft" (two names for one skill).
- *Creation: buying a lifestyle outright.* "Outright" pays 100 months ahead (`creation.ts` ~371: `paidUntil = now + 30 × 100 days`), and there is no permanent flag. After about 8 in-game years the overdue prompt fires, and you can't buy it outright after creation. See D4.
- *Negotiating a job's pay.* It works, but `CHARACTERS_V58.negotiation.opposedAttribute: 'willpower'` is never read: `negotiatePay` → `socialTest` uses `SOCIAL.skills.Negotiation` = Charisma. See D3.

## C. VERIFY "Not modeled" / "Least certain" rows

- Stale (now done or changed): Characters (v0.58) table, "Training time": still says "House rule, off by default". `CHARACTERS_V58.training.mode` has been `'timed'` by default since v0.65.0.
- Stale: Safehouses, "Not modelled: the workshop's TN modifier … shown but not applied". Since v0.61.0 a paid-up workshop counts as a Build/Repair tools level (`workshopToolsLevel`, `documents/index.ts` ~3315). Garage, supplies, panic room, tunnel and staff are still only shown.
- Stale: Skills and creation, "Priority builder": "Build check… on the Bio tab … It only checks; it doesn't build". The v0.64.0 wizard builds; Build… is now Quick build.
- Stale: Street, "Builder ('Fill the sheet') … Skills and gear are left alone". Skills and gear arrived in v0.49.0 (the section's own Not-modeled row says so), and the wizard replaced the dialog in v0.64.0.
- Stale (small): Street, "Perception modifiers … within a few metres −1". It's measured between tokens since v0.50.0 (`config.ts` comment under `STREET.perception`).
- Still a gap worth fixing: Skills and creation has no row at all for specialization and concentration at creation (A2). Add one, and a Least-certain note on the exact trade-off.
- Still a gap worth fixing: the Upkeep "Least certain" Karma bands. Already under Rules to verify; I agree SR2 is 1× / 2× the attribute (see E).
- Still a fair gap (left to the GM, fine): contacts bought after creation, Street Cred from deeds, a contact's mood, haggling over services. Low value; leave them.

## D. Integration problems (rules added v0.54.0–v0.68.0)

1. **v0.61 named-skill gear (and adept skill powers, skillsofts, articulation) doesn't reach Stealth or the observer in contests.** `stealthSide` (`documents/index.ts` 4928) and the observer's dice in `perceive` (3160) and `sneakPast` (~4082) work the dice out by hand from the raw rating. They skip `#skillDice`, so `skillGearBonus` (a chameleon suit or other gear with a Stealth skill mod), `adeptSkillDice`, a Stealth activesoft, enhanced articulation and the Stealth specialization never apply. The observer also misses edge or flaw modifiers on "Perception" or "Intelligence". To trigger: give a character gear with "Stealth +2 dice" and use Sneak; the dice don't change. A plain skill roll of Stealth does add them, so two Stealth rolls disagree. Severity: bug.
2. **Roll memory brings the complementary skill back.** The skill dialog remembers `comp` (`sheets.ts` 2913: `rememberMarker(..., ["useSpec","useConc","comp"])`). Once a player uses a complementary skill, every later roll of that skill quietly rolls the complementary test first and adds its dice. SR2's complementary test is a separate, deliberate test. Remember only `useSpec` and `useConc`, or show that it was restored. Severity: rough edge.
3. **Dead house-rule key.** `CHARACTERS_V58.negotiation.opposedAttribute` is listed in config and so in the house-rules window, but nothing reads it (grep: only `config.ts` 3113). Changing it does nothing. Severity: rough edge.
4. **A lifestyle bought outright lapses.** See B. It's 100 months paid ahead with no permanent state. The v0.49 overdue rule (`UPKEEP.effects.overdue: 'prompt'`) and the safehouse home-care lapse will eventually treat it as unpaid. Severity: rough edge.
5. **A new skill learned with training time drops its specialization.** With `training.mode 'timed'` (on by default since v0.65), `makeSkill` (`adding.ts` ~506) creates the skill at rating 0 with no `specialization`, then trains it to 1. A specialization typed in the picker disappears, and the dialog's cost text doesn't mention it. Severity: rough edge.

## E. Possible wrong values (new, not already in Rules to verify)

- `config61/street.ts:starterSkills` Athletics = `'quickness'` (and `statblock.ts` `SKILL_ATTRIBUTE_HINTS` `/athlet/` → Quickness); SR2 as I remember: Body. Confidence: medium-high.
- `config.ts:NPCGEN.threat[*].professionalRating` = 0…5; SR2 as I remember: Professional Rating 1–4. Confidence: low.
- `config.ts:STREET.qualities.maxEdges / maxFlaws` = 5 / 5; I don't remember the Companion's caps well (possibly 6 points of flaws). Confidence: low.
- Already on the list but with new confidence: `CREATION.priorities` Skills 50/40/34/30/27 and Resources D/E ¥20,000 / ¥5,000 are SR3's numbers. I'm fairly sure SR2 is Skills 40/30/24/20/17 and Resources ¥1,000,000 / ¥400,000 / ¥90,000 / ¥5,000 / ¥500. Confidence: high. The `UPKEEP.karma.skills` bands should switch at 1× and 2× the attribute (×1.5 / ×2 / ×2.5 active; ×1 / ×1.5 / ×2 knowledge). Confidence: medium-high. Racial modifiers, the race priorities (elf and troll C, dwarf and ork D), the 1.5× augmented maximum, Karma Pool 1 per 10 (humans) or 20 (metahumans), attribute Karma at new rating × 2, lifestyle prices, contact prices (¥5,000 / ¥10,000 / ¥200,000, two free) and the starting Karma Pool of 1 all match what I remember.

## F. Summary

Counts: A 9, B 3 partly broken out of 27 checked, C 5 stale and 2 gaps worth fixing, D 5, E 3 new plus 2 confirmations.

Top 5 to fix:
1. Karma Pool (re-roll, avoid disaster, buy a success) on contest and street cards: perceive, sneak, social, Pay, legwork, find, haggle, fence (A1).
2. Specialization and concentration trade-off at creation, counted and capped in the build check (A2).
3. Athletics linked to Body in the starter list, picker and importer (A3).
4. Stealth and perception contests through `#skillDice`, so gear, adept, skillsoft and specialization bonuses count (D1).
5. Foci bonded at creation charged to spell points, not free (A4). Also apply the priority-table and Karma-band book values already listed under Rules to verify.

---

## Cross-cutting integration review (v0.69.0)

Scope: how the pieces added since v0.53.0 fit together across areas, plus where the Plan 6 interface work (v0.63.0–v0.68.0) changes or misstates a rule. I walked no SR2 chapters. Sources covered: SR2 core (combat, wounds, statuses, Karma), Grimoire (totems, invisibility, critter powers), Shadowtech (pain editor), all from memory. Code read: `src/module` (documents/index.ts, rules/*, applications/*).

Line numbers point to `documents/index.ts` unless another file is named.

## A. Cross-area rules problems

1. **Paralysed, asleep, petrified, bound or held characters still defend at full strength.** SR2: someone who can't act can't dodge or parry. In melee they are as helpless as someone unconscious (core; the Grimoire for paralysis and petrification). Now: `SR2Actor.defend` (~6282) works out `down` from `incapacitated(derived.status)` only. `canAct()` (985–993) blocks the `paralysis`, `sleep` and `sr2ePetrified` statuses for *acting*, but `defend()` never calls it. A paralysed target gets full Combat Pool dice to dodge, full Quickness in opposed melee, can counterattack (`#defendMelee`) and can go on full defense (`fullDefenseUp()`). Kind: wrong. Confidence: high. Size: S (add those statuses, and optionally `restrain`, to `helpless`/`down`). Priority: occasional, but common wherever ghouls, paralysis touch or sleep spells show up.

2. **The wound TN that tests roll with differs from the one shown everywhere else (pain editor, v0.61.0 drugs).** SR2/Shadowtech: a pain editor ignores Stun wound modifiers. In v0.61.0 a drug can "ignore wound modifiers" or ignore some Stun boxes. Now there are two separate calculations:
   - `models/index.ts:746` `derived.woundModifier` applies `painEditedMonitor(…, bw.ignoreStunWounds)`, `drugFx.ignoreWounds` and `drugFx.stunIgnoreBoxes`. The status strip, summary, Effects tab, GM panel and **initiative** (`SR2Combatant.getInitiativeRoll`, 14983) all use this value.
   - `SR2Actor.woundModifiers()` (1365) uses only `compensatedMonitor(monitor, bio.ignoreBoxes + painIgnore)`. This is what `#allTestModifiers` (1802) and so **every test** uses.

   A pain-editor user, or someone on a drug that ignores wounds, sees "+0" on the strip but rolls at +1/+2/+3. Kind: wrong. Confidence: high. Size: S (make `woundModifiers()` read the same inputs, or build it from `derived.woundModifier`). Priority: occasional.

3. **A drug's "TN on own tests" (v0.61.0) never reaches a test.** `models/index.ts:631` folds `combineDrugEffects(...)` into `fxSum`, which becomes `derived.effectMods.testsTn`. Nothing reads `effectMods.testsTn`. `#allTestModifiers` (1826–1829) reads `testsTn` from the `powerEffects` **flag** only, so it covers powers and spells but not drugs. By contrast, `perceivedTn` (4914) and `attackedTn` (7106) do read the derived value, so those two drug effects work. Kind: wrong. Confidence: high. Size: S. Priority: occasional.

4. **Spellcasting ignores invisibility.** SR2: a caster has to see the target, so an Invisibility or Improved Invisibility the caster hasn't seen through stops a targeted spell (Grimoire). Now: `#unseenTargets` (7113) tests walls only (`lineOfSight`). `#spellEnvironment` (7123) has no concealment term, and nothing between lines 6700 and 7300 mentions concealment or invisibility. You can target an invisible character with any spell and get no penalty or block. Critter powers and banishing (9056, 8228) have the same gap. Kind: missing. Confidence: medium-high. Size: S–M (use `target.concealmentFor(caster)` and `seeThroughInvisibility` the way `attackSight` does). Priority: occasional.

5. **Holding statuses restrict nothing and aren't released.**
   - Binding: `MAGIC_V61.holdPowers.binding.blocksMovement: true` is never read. The only `preUpdateToken` hooks are the ward checks in `applications/regions.ts:283,294`.
   - Grapple hold (v0.55.0, `holdTarget`/`setHeld`, 6499–6531): the `restrain` status and the `heldBy` flag do nothing mechanically. There's no movement block, no attack or defense penalty, and nothing stops a held character attacking or casting.
   - Neither hold is released when the holder is knocked out, dies, moves away or the combat ends. The only way out is **Break free**.
   - Petrification `armorBonus: 0` (config61/magic.ts:63) means a statue gets no extra armor. I believe SR2 gives a big one; low confidence on the number.

   Kind: partial. Confidence: high (code), medium (exact SR2 effects). Size: S–M. Priority: occasional.

## B. Checklist items claimed done that aren't (or are broken)

I checked 14 ticked rows in "Found after v0.58.0" and the Plan 6 rows that touch rules.

- *SR2 states as token statuses; "core statuses such as stun or deaf do nothing"*: deaf is fixed. **`stun` (Foundry's Stunned) is kept in `SR2_CORE_STATUSES` (rules/tokens.ts:58) but still does nothing**: no code calls `hasStatus('stun')`. `restrain` does nothing either (see A5).
- *Paralysis, petrification and binding powers holding the target*: partial. No loss of defense (A1). Binding doesn't stop movement (A5). A timed paralysis clears its status through `setTimedStatus`, but its `powerEffects` entry stays on the target until the caster's effect is removed, so the Effects tab still lists it.
- *Totem drawbacks by situation*: partial.
  - The `sr2eBerserk` status has no mechanical effect at all. It is only read at 4450 to avoid a second roll.
  - Wolf's "when a fight starts" never fires. The only `berserkCheck` call (1253) runs on damage and passes `damaged: true`, so `berserkTriggered`'s `'combat'` branch (rules/glamour.ts:98) acts exactly like `'wounded'`. Nothing hooks combat start.
- *Seeing through invisibility*: only the Attack dialog (sheets.ts:2984) and `perceive()` (3150) trigger the resistance roll.
  - `notice()`, Sneak and Guards look, attacks without the dialog (`attackSight` 6020: NPC groups, mounted guns) and melee defense use `concealmentFor`. Until the observer has gone through one of those two paths, invisibility there counts as blind fire or "can't see".
  - Spells never check invisibility at all (A4).
- *Drug effects beyond attributes* (smaller leftovers): own-test TN, ignore wounds and ignore Stun boxes don't reach tests (A2, A3).
- *Smoke grenades*: work, but the cloud's lifetime is broken (D3).

## C. VERIFY "Not modeled" / "Least certain" rows

- **Stale (now done):** VERIFY v0.50.0 "Not modeled" row. Wards placed on the map (v0.61.0 `placeWardRegion`), smoke grenades (v0.61.0 `COMBAT_V61.smoke`), hearing-based senses (v0.61.0 `hearingModifiers`) and drug effects beyond attributes (v0.61.0 `HEALTH_V61.drugs`) are all built. Only "one-off effects a TN change can't take back" is still true.
- **Stale / garbled:** VERIFY v0.59.0 "Not modelled" row says "Templates other than circles (hearing gear and cyberears: v0.61.0)". The bracket belongs to a different row. Templates are still circles only.
- **Claims more than the code does:** VERIFY v0.61.0 rows.
  - "Hold powers … Binding: held": being held does nothing (A5).
  - "Drug effects … change TNs (own tests) … ignore wound modifiers or ignore Stun boxes": display only (A2, A3).
  - "Totem drawbacks … Wolf: also when a fight starts": never triggered (B).
- **Still a gap worth fixing:** VERIFY v0.61.0 "The berserk character's forced actions (the GM rules them)". Fine as GM-ruled, but the status should at least be described on the Effects tab and the strip, because it now changes nothing.
- **Undo limits (`rules/gmtools.ts` `UNDO_LIMITS`)** should add: Region documents (blast areas, smoke and gas clouds, wards drawn on the map) aren't logged (D4).

## D. Integration problems (rules added v0.54.0–v0.68.0)

1. **The approval queue (v0.64.0) misses several Karma spends, and one of them writes no ledger line.**
   - `quicken()` (8873–8888) spends Good Karma with **no ledger line**. So there's no advancement-log line, no approval check, and no "Karma spent" total.
   - These write ledger lines but never call `approvalNeeded`, so a player spends Karma straight away with the queue on:
     - `raiseChannel` (11685)
     - `learnComplexForm` (11701)
     - the ally ritual's Karma (`#resolveAlly` 8063)
     - binding by true name (`#resolveBindName` 8381)
     - "made and bonded" focus enchanting (`#resolveEnchant` 8713). Plain `bondFocus` *does* queue.

   Severity: bug (the queue's whole purpose).

2. **An initiation request shows as "free" in the GM's queue.** `advanceInitiation` (7428) files `fileRequest(... { kind: 'improve', label, data })` with no `karma:`. `describeRequest` (rules/advancement.ts:521) then shows "free", and the "short of Karma" check can't fire. Severity: rough edge.

3. **Smoke and gas clouds expire by real time outside combat and vanish the moment a combat ends.** `drawArea` (applications/canvas.ts:483) sets `expires.at = Date.now() + turns*3 s`. `areaExpired` (526) compares that with `Date.now()`, and `sweep` runs every 10 s. Out of combat, a 20-turn smoke grenade lasts 60 **real** seconds, whatever game time does. In combat, `areaExpired` returns true once the combat is gone (`r === undefined`), so ending the encounter wipes every cloud thrown in it. The rest of the system counts in world time (`COMBAT_TURN_SECONDS`, `effectEnds`). This covers the v0.61.0 smoke grenade (6232), the gas cloud (10201) and the v0.59.0 blast areas. Severity: bug.

4. **Undo can't take back anything drawn as a Region.** `LOGGED_DOCS` (applications/undo.ts:25) has no `Region`. Not logged:
   - v0.59.0 blast and area templates
   - v0.60.0 environment regions
   - v0.61.0 smoke and gas clouds and wards drawn on the map
   - the GM's edits to a region's SR2e environment flags

   `UNDO_LIMITS` doesn't mention any of these. Undoing a smoke grenade throw leaves the cloud, and its TN keeps applying. Everything else added later is stored on actor flags or as items, so it **is** undoable: projects, the advancement log, approval requests, kits (item creates) and portraits (actor `img`). Severity: rough edge (also say it in UNDO_LIMITS).

5. **The status strip's initiative before the roll misstates the real formula.** `stripContext` (applications/interface.ts:113) passes `derived.reaction` and `derived.initiativeDice`. `SR2Combatant.getInitiativeRoll` (14957–14997) actually rolls:
   - Matrix initiative when jacked in
   - rigged initiative when jumped in
   - astral initiative when projecting
   - a spirit's `initiativeBonus`
   - minus the wound penalty

   So a decker, rigger, projecting magician, spirit or wounded character sees the wrong "R + Nd6" on the strip. Once rolled it shows the combat value and is correct. Severity: rough edge.

6. **The your-turn helper never greys several buttons that cost an action.** `BUTTON_ACTION_KINDS` (rules/interface.ts:145) has no entry for the actions below, although their handlers spend an action through `useAction`:
   - `matrixPerceive` (simple, sheets.ts:1957)
   - `matrixManeuver` (complex, 1981)
   - `useUtility` (complex, 2003)
   - `systemTest` (simple or complex, 2110)
   - `releaseSmoke` (simple, 2340)
   - `securityAction` (complex, 2388)
   - `sneak` (simple, 1194)
   - on the vehicle sheet, `sensorTest`, `drive` and `ram`

   A decker with no actions left still sees every Matrix button live. In block mode a player can still click them, and `useAction` then refuses. Also, `rollSkill` costs nothing (as designed), but `RULES.ACTIONS.costs.skill: 'complex'` exists and SR2 normally makes a skill test in combat a Complex Action. That's low confidence, so it's for the book check. Severity: rough edge.

7. **The skill picker prices Reaction-linked skills off augmented Reaction; `improve()` uses natural Reaction.** `attributeRating` (applications/adding.ts:411) returns `derived.reaction`, which includes wired reflexes, drugs and spells. `improveCost` (4548–4551) uses `naturalReaction(natural Q, natural I)`. A wired rigger learns a new vehicle skill in the + Add picker at a cheaper band than Spend Karma would charge for the next point. Severity: bug (small).

8. **The GM's "Change target number…" list misses the v0.59–v0.61 sources, and files Notice under magic.** In `tnCandidates` (rules/situation.ts:230), `'notice'` sits in the list with the magic kinds. A Notice card is offered "Magic" rows (Astral perception, Sustaining, Blinded), gets Visibility, Smoke and Weather only if `magic.environment` isn't off, and gets no hearing rows. Never offered:
   - Deafened (+8)
   - cyberear amplification
   - superior position on attack and defend
   - the prejudice rows on social

   Modifiers already on the card are still listed, so this only bites when the GM adds one. Severity: rough edge.

9. **Statuses that outlive their reason.**
   - Morale `broken` (flag, shown as Foundry's Fear by `actorStateFlags`, applications/tokens.ts:453) is cleared only by a rally (4052). After the combat the NPCs keep the Fear icon for good, because `deleteCombat` re-syncs but the flag stays.
   - The hold's `restrain` and `heldBy` stay after combat (A5).
   - A timed paralysis leaves its `powerEffects` entry behind after the status clears (B).

   `sr2eFullDefense`, `sr2eDelaying` and `sr2eSurprised` are derived from the combat and clear correctly. Severity: rough edge.

10. **Inline tests (v0.60.0) roll pool dice without spending them.** For a plain-dice spec, `rollInlineTest` → `plainTest(actor, …, c.pool)` (applications/inline.ts:135, 89–91) adds `poolDice: extra` to `successTest` but never takes them off the actor's pool. The card has no test flag either, so it can't be Karma re-rolled. The Reaction, Magic and Essence specs (142–145) take `previewModifiers()` but roll the same way. Severity: bug (small).

11. **The advancement log (v0.64.0) and projects (v0.65.0) don't agree on credit and refunds.**
    - A project that is given up refunds nuyen through `adjustNuyen(+n, 'Given up (refund): …')` in `cancelProject` (3427–3431). `composeAdvancement` (rules/advancement.ts:353) logs only nuyen **spent**, so the refund never shows and `advancementTotals.nuyenSpent` stays too high. A Karma refund is handled correctly.
    - Finished training (`#trainingTick`) raises the rating on the GM's client without `sr2eNoAdvance`, so a second "X 3 → 4" line appears credited to the GM.
    - A GM-approved order's project records `by: <GM>` (`startProject` → `makeProject`), so `logProjectDone` credits the GM, not the player.

    Severity: rough edge.

12. **A vehicle mod install project pays at the end, and failure loses the time.** `#resolveInstall` → `finishModInstall` (`installMod(index, { payer })`) charges nuyen when the project completes. If the payer can't pay by then, `#completeProject` posts "couldn't be finished … nothing was given back". Every other project pays up front and refunds on Give up. Severity: rough edge.

13. **Light counts in melee, smoke doesn't.** In the Attack dialog (sheets.ts:3021) and in `attackSight` (6010–6017), melee leaves out smoke (`!melee`) but keeps light at the target, so a dark room counts in melee and a smoke cloud doesn't. I recall SR2's visibility modifiers applying to melee as well, but my confidence is low. Either way the two should go together (or both be a `TN_AUTO.attack` switch). Severity: rough edge.

14. **Checked and fine (no finding):**
    - Karma re-roll and GM TN change against v0.61.0 effects: the monowhip is guarded (2470); `#applySustain` and `#applyPowerEffect` replace rather than add; the binding card is guarded by effect id; every v0.65.0 project-starting resolver (learn, ward, cleanse, repair, code, design, conjure, install, enchant, ally, bind by name) uses `projectId`/`applied`, retimes on a re-roll and gives up on a failed re-roll.
    - Roll memory: only the cast, summon, cybercombat and skill dialogs remember. Numbers are clamped by `restoredNumber` to the field's min/max (cast Force ≤ learned Force, pools ≤ pool left). Summon Force has no max, which matches SR2. Quick rolls skip memory and submit the dialog built with its automatic modifiers already in place.
    - The tracker groups (`trackerGroups`) read `isDelaying`, `actingNow` and `fullDefenseUp` from the combat. `combat.pass` is a getter.
    - Socket relay: new player-triggered changes since v0.59.0 either relay (`drawArea`) or post an Apply (GM) card: holds, power effects, spirits on the master's death. `placeArea`/`placeWardRegion` warn players who lack Create Regions.

## E. Possible wrong values (new, not already in Rules to verify)

- `rules/config61/magic.ts: holdPowers.petrification.armorBonus` = 0. As I remember it, petrification gives a large armor bonus (the target is stone). Confidence: low. Check the Grimoire or the critter book.
- `rules/config.ts: ACTIONS.costs.skill` = 'complex', but nothing spends it except bypassing a lock. Not a wrong number but an unused one; see D6. Confidence: low.
- Nothing else new. The deaf +8 and the v0.59.0 action costs are already flagged for checking.

## F. Summary

Counts: A 5, B 5 rows (of 14 checked), C 5 rows, D 13 problems (plus the checked-fine list), E 2.

Top 5 to fix:
1. A1: paralysed, asleep, petrified and bound characters should be helpless defenders, not full-pool dodgers.
2. A2 + A3: one wound TN for tests and display (pain editor, drug ignore-wounds); apply drugs' own-test TN.
3. D1 + D2: route quicken (and give it a ledger line), channels, complex forms, ally, true-name binding and focus making through the approval queue; give initiation requests their Karma cost.
4. D3 + D4: smoke and gas clouds should time out by world time and survive the end of combat; log Region documents for undo (or list them in UNDO_LIMITS).
5. A4 + B (invisibility): check invisibility in spellcasting and powers, and trigger the see-through roll on every perception and attack path.

---

# Appendix C: the checkers' tables

# Code-claim check of reviews 1–3

Paths are under `src/module/` unless noted. `index.ts` = `documents/index.ts`.

## 1-combat-gear.md
| Finding | Verdict | Evidence (file:line, one or two lines) |
|---|---|---|
| A1 SS fires twice; "twice" remembered for Shift-click | CONFIRMED | sheets.ts:3092 offers it when `m === "SA" \|\| m === "SS"`; 3409 `twice = … (mode0 === "SA" \|\| mode0 === "SS")`; 3396 saves `twice` in attackPrefs, 3280 `applyPrefs` restores it, 3353–3357 Shift-click uses applyPrefs; second `useAction` + `attackWith` at 3514 |
| A2 Counterattack drops weapon extras | CONFIRMED | `CounterWeapon` index.ts:412–421 (name/power/level/type/reach/ignoreImmunity/infection only); counter built 6387–6393 with no lacePower (attack path adds it 5869); counter DamageState 2256–2259 has no `armorExtras` (attacker win uses `...armorExtras(attack)` 2247); stun-weapon armor/charge only in planAttack 5825–5831 |
| A3 Walls stop blasts whatever the rating | CONFIRMED | chat.ts:186 `caught = RULES.COMBAT.wallsBlock ? all.filter(c => !blastBlocked(point, c.token))`; canvas.ts:220–224 plain move-collision test, never reads `barrierRating` (gunfire reads it as `extraArmor`, index.ts:5832) |
| A4 Aim lost at turn end; cap by base skill | CONFIRMED | rules/tactics.ts:29 and 36 require `aim.round === now.round`; index.ts:5722 and 5976 cap with `skill?.system?.rating` |
| A5 No "Power ≤ immunity armor = no effect" | CONFIRMED | index.ts:6712–6714 only adds immunity to armor; rules/damage.ts:44–45 `max(MIN_TN, power − armor)`; resistDamage 6660 has no zero-effect check |
| A6 Gap called shot zeroes dermal/cyber/adept/limb armor | CONFIRMED | index.ts:6705–6710 `opts.noWorn ? 0 : armorTotal(…) + adeptArmor + cyberArmor + limbArmorFor` (the whole sum is in the else branch); noWorn from `damage.ignoreArmor` 6633 |
| A7 No indirect fire | CONFIRMED | no `indirect`/`mortar` in any .ts outside tests; bounce only (config.ts:1401) |
| A8 Ammo list fixed | PARTLY | 7 ids at config.ts:984–991, model `choices` fixed at models/index.ts:1049/1173. But the house-rules "advanced" JSON box can overwrite `COMBAT.ammo` (settings.ts:657 accepts any same-typed object); the real block is the schema choices, not "the window doesn't edit it" |
| B1 Defend not remembered | CONFIRMED | chat.ts:34–101 `onDefend` only sets `button.disabled`, no flag read/written; `defend()` index.ts:6285 has no guard; Resist has `resistedOn` chat.ts:383–404; hotkeys.ts:103 skips only disabled buttons; tokens.ts:299 `latestAttackOn` |
| B2 Stun baton counter: no charge, no stun armor | CONFIRMED | see A2; charge/armor only in planAttack index.ts:5825–5831 |
| B3 First Combat Turn starts on stale pools | CONFIRMED | index.ts:15191 `if (!started) return this` before `refreshPools` (15201); only caller of `refreshPools`. The `combatStart` hook that exists (chat.ts:1844) only does totem berserk checks; GM panel refresh is party-only, ui.ts:857 `groupActors('party')` |
| C1 Spirit initiative row stale | CONFIRMED | models/index.ts:955–966 sets `derived.initiativeBonus`; read in index.ts:14994 |
| C2 Grenade arcs partly stale | CONFIRMED | bounce `{ tn: 2, extraDice: 1 }` config.ts:1401; blast side still A3 |
| C3 Blasts-and-walls row still a gap | CONFIRMED | same as A3 |
| C4 Dodge TN = attacker's final TN | CONFIRMED | index.ts:6315 `targetNumber: attack.targetNumber` |
| C5 Buying successes with Good Karma not modeled | CONFIRMED | `buySuccess` spends Karma Pool (index.ts:2668–2672; `buyPermanent` lowers the Pool), no Good Karma path |
| C6 Least-certain rows: nothing new | UNCHECKABLE | no code claim |
| D1 Karma re-roll leaves old card live | CONFIRMED | `karmaReroll` index.ts:2581 calls `#post(next, …)` with no `like`, so no `supersededBy`; `decorateCard` chat.ts:831 checks only `supersededBy`; `isReplaced` (index.ts:2592) used only by retarget (chat.ts:1827, index.ts:2611); `onKarma` chat.ts:528–540 guards via DOM `disabled` only, snapshot keeps `rerolls` |
| D2 Knockdown/toxin/infection re-offered on re-rolled soak | PARTLY | index.ts:2374–2393 adds the buttons on every soak card; guards are per-message `cardDone` (chat.ts:267). Detail wrong: the cyberware `rolled` mark is set only in `auto` mode (index.ts:2380–2383); in button mode it is per-message too (chat.ts:282) |
| D3 Defend never remembered (more visible via hotkey/HUD) | CONFIRMED | as B1 |
| D4 Stale pools feed the status strip | CONFIRMED | as B3; strip reads pools from derived (interface.ts:111–115) |
| D5 Remembered "twice" spends two actions | CONFIRMED | sheets.ts:3408 first `useAction`, 3514 second; `useAction` in 'warn' mode warns and returns true (index.ts:1116–1131) |

## 2-health-ware.md
| Finding | Verdict | Evidence (file:line, one or two lines) |
|---|---|---|
| A1 Dying ticks only on round change; (a)(b)(c) | CONFIRMED | only adder `#dyingTicks` index.ts:15118–15129, called from nextRound 15220; `dyingSince` set from `game.combat.round` 1299–1301 and read nowhere else; `naturalHeal` 1204–1234 has no dying/stabilised check; nothing clears `stabilised` while status stays `dying`; DocWagon `arriveAt` (4500–4506) is never read |
| A2 Stun overflow floors per hit; stim/tranq | CONFIRMED | rules/damage.ts:90 `Math.floor(overflow / STUN_OVERFLOW_PER_PHYSICAL_BOX)`; stim payback index.ts:5415 same floor; tranq index.ts:6447 `Math.min(max, stun + boxes)` with no carry |
| A3 Drug doses stack, no overdose | CONFIRMED | `takeDrug` index.ts:5247 appends to `system.drugs`; models/index.ts:626 + 661 sums every entry; `combineDrugEffects` rules/lifeline.ts:204–208 adds each |
| A4 Patches only on owned targets; trauma auto | CONFIRMED | index.ts:6432 `if (!target.isOwner)` refuse, no GM route (only caller sheets.ts:1739); trauma 6450–6452 sets `stabilised` with no roll |
| A5 Companion health edges/flaws do nothing | CONFIRMED | qualities config.ts:1453–1459 (points + karma only); no Will to Live/pain tolerance/toughness anywhere; `overflowView` look.ts:354, `monitorStatus` damage.ts:60, `compensatedMonitor` bioware.ts:97 take no edge input |
| A6 Shadowtech health bioware not settable | PARTLY | BIOWARE.kinds config.ts:142 lacks them; statblock.ts:566–570 marks suprathyroid, mnemonic, nephritic, extended volume `unmodelled`. But symbiotes are not in the importer list at all; toxin dice come only from kinds (models/index.ts:146–162) |
| A7 Reaction enhancers stack with boosted | CONFIRMED | config.ts:95 `exclusive: ['wired','boosted','synaptic']`; rules/cyberware.ts:95–99 only those are exclusive |
| A8 No heat or electricity hazards | PARTLY | `resistHazard` kinds index.ts:5274 confirmed. "Shocks exist only as stun weapons" overstated: elemental shock effect exists (rules/mysticism.ts:15–23, `shockOutcome`) |
| B1 Drug `testsTn` never applied | CONFIRMED | summed into `derived.effectMods.testsTn` models/index.ts:751; never read (only `perceivedTn` 4914 and `attackedTn` 7106); `#allTestModifiers` 1825–1828 adds `testsTn` from `powerEffects` flag only |
| B2 Slap patches can't go on others | CONFIRMED | as A4 |
| B3 DocWagon response time text only | CONFIRMED | `arriveAt` written index.ts:4506, read nowhere |
| C1 TN "Not modeled" row stale | CONFIRMED | VERIFY.md:892 still lists smoke, hearing, drugs; built: config61/combat.ts:28,51; config61/health.ts:35 |
| C2 v0.56.0 "Not modelled" row stale | CONFIRMED | VERIFY.md:1005; `HEALTH_V61.immunity` health.ts:39, `healApplyRoute` lifeline.ts:239 used index.ts:8541 |
| C3 Hospital stays partly stale | CONFIRMED | rules/core.ts:68–74 heals `min(boxes, hours / hoursPerBox)` |
| C4 Gas in sealed room partly stale | CONFIRMED | VERIFY.md:512; gas devices in config61/security.ts |
| C5 Overdoses still a gap | CONFIRMED | VERIFY.md:679; see A3 |
| C6 Other Shadowtech still a gap | CONFIRMED | VERIFY.md:493; see A6 |
| C7 Stun overflow row (VERIFY.md:16) missing from checklist | UNCHECKABLE | VERIFY.md:16 row confirmed; the checklist is not in the baseline tree |
| D1 Pain editor/drugs change shown wound mod, not test TNs | CONFIRMED | models/index.ts:746 `derived.woundModifier` uses `painEditedMonitor`, `ignoreWounds`, `stunIgnoreBoxes`; tests use `woundModifiers()` index.ts:1365–1369 (compensator + pain resistance only) via 1802 |
| D2 Drug TN changes never reach tests | CONFIRMED | as B1 |
| D3 Tranq/stim bypass soak path | PARTLY | direct writes index.ts:6447 and 5415, no trauma damper (only in `#resolveSoak` 2326). "Undo log doesn't see them" is wrong: applications/undo.ts:356–369 logs every Actor update on GM clients |
| D4 No Apply (GM) route for patches | CONFIRMED | as A4 |

## 3-magic-critters.md
| Finding | Verdict | Evidence (file:line, one or two lines) |
|---|---|---|
| A1 Projecting mage / unmaterialized spirit acts physically | CONFIRMED | `canAct` index.ts:976–1001 has no astral check; `attackWeapon` 6138–6142 blocks only `isManifesting()` (7566–7568); 6148 checks the target only; `onAstralModeChange` 7594 only manages timing/manifest |
| A2 `usePower` ignores planes | CONFIRMED | index.ts:9037–9140: LOS check only, no `castingPlaneProblem`/astral/materialized; castSpell checks 6840–6841 |
| A3 Every bound spirit goes free | CONFIRMED | rules/glamour.ts:216–222 one mode for all kinds but `free`; config61/magic.ts:79 `masterDies: 'free'`; applied to every summoned spirit index.ts:7899–7901 |
| A4 Astral mode change costs no action | CONFIRMED | `onAstralModeChange` 7594–7625 no `useAction`. Note: `ACTIONS.costs` has an `astral` key (config.ts:2041) but it is for astral attacks (sheets.ts:2670) |
| A5 Partial dispel doesn't shrink effect | CONFIRMED | `#resolveDispel` index.ts:8848–8866 rewrites only `sustaining[i].successes`; `scaleBundle` used only in `fxEntry` 7084 |
| A6 Adepts astral-attack with Sorcery/Willpower, no Spell Pool | CONFIRMED | 7860–7861 `findSkill(RULES.ASTRAL.attackSkill)` default `willpower`; config.ts:293 'Sorcery', 294 pool 'spell'; models/index.ts:727 adepts' spell pool 0 (`ADEPT.spellPool: false`, config.ts:1770) |
| A7 No metamagic limit by tradition/aspect | CONFIRMED | `advanceInitiation` 7420–7506 checks Magic, group, ordeal, site, Karma; sets `system.metamagic.${technique}` 7506 with no tradition check |
| A8 Dispel drain gets no Spell Pool | CONFIRMED | index.ts:8839–8844 `#drainTest({… poolDice: 0 })` |
| A9 Barrier spells make no barrier | CONFIRMED | SpellDataModel models/index.ts:1403 has no barrier field; barrier actors only from wards (7362, safehouse.ts:330); `spellWall` (7761) only damages walls |
| A10 Spirit innate spells need Sorcery item | CONFIRMED | castSpell index.ts:6771–6774 refuses without `Sorcery`; `findSkill` has no Force fallback |
| A11 Conjuring drain at start of timed summoning; limit ignores projects | CONFIRMED | `#conjuringDrain` 8008 right after the test; elemental finishes later via project `finishElemental` (8186, 8205); limit counts actors only 7973–7975 (and only warns) |
| A12 Dual-natured/materialized pass wards | CONFIRMED | applications/regions.ts:146–150 `astralForm` = unmaterialized spirit or projecting only |
| A13 Heal/Treat no Force cap | CONFIRMED | rules/spellcraft.ts:12–13 caps at `marked` only; caller index.ts:8532 |
| A14 No spell points for foci / no buying points | CONFIRMED | config61/street.ts:43 `nuyenPerSpellPoint: 0`; `spellPointCheck` rules/paperwork.ts:180–188 counts spells only |
| B1 Unmaterialized spirits visible | CONFIRMED | `tokenInvisible` rules/outfit.ts:213–219 knows only `projecting`; spirits `derived.astralMode = 'physical'` models/index.ts:970; hook tokens.ts:195 watches astral/sustaining/magic, not `materialized`; no other `materialized` token handling |
| B2 Master-death frees every kind | CONFIRMED | as A3 |
| C1 Spirit initiative row stale | CONFIRMED | models/index.ts:955–966 |
| C2 Repeating powers row stale | CONFIRMED | `#repeatPowerTick` index.ts:5390; `repeating.autoPrompt` config61/magic.ts:78 |
| C3 v0.56.0 row stale | CONFIRMED | health.ts:39; Apply (GM) healing index.ts:8541 |
| C4 Astral tracking partly stale | CONFIRMED | `MAGIC_V61.links` config61/magic.ts:67; `linkTrackTest` index.ts:8458 |
| C5 Partial dispel still a gap | CONFIRMED | as A5 |
| C6 Focus bonding instant | CONFIRMED | `bondFocus` index.ts:7532–7543 sets `bonded` at once, no project (the "Still instant" row was in the project notes, not VERIFY.md) |
| C7 Anchoring / ally abilities gap | CONFIRMED | VERIFY.md:252 "No Karma cost or link to the anchoring object" |
| C8 Least-certain (Bear, Owl, Shark, allergy) | UNCHECKABLE | rules memory; code fact confirmed: config.ts:1798–1799 severe `tn: 2` = moderate |
| D1 Strip shows wrong initiative for projecting/spirits | CONFIRMED | interface.ts:112–113 passes `reaction` + `initiativeDice` only; getInitiativeRoll index.ts:14990–14994 uses astral base / `initiativeBonus` |
| D2 Astral wounds count on tests, not initiative | CONFIRMED | getInitiativeRoll 14990–14991 no wound `less`; tokens.ts:211 skips projecting; `#allTestModifiers` 1802 always adds `woundModifiers()` unless `noPenalties` |
| D3 Turn helper doesn't grey physical actions while projecting | CONFIRMED | rules/interface.ts:145–178 and applications/interface.ts:245 have no astral/projecting check |
| D4 Elementals under way not counted | CONFIRMED | as A11 |
| D5 Unmaterialized spirit visibility | CONFIRMED | as B1 |


# Code-claim check: reports 4 to 7

Paths are under `src/module/` unless a path starts with `public/`. `doc` = `documents/index.ts`.

## 4-matrix.md
| Finding | Verdict | Evidence (file:line, one or two lines) |
|---|---|---|
| A1 MPCP cap | CONFIRMED | rules/matrix.ts:67 personaWarnings checks the persona only; models/index.ts:877 `personaWarnings(base)`. No MPCP compare in utility/attack/frame/swap code (grep for mpcp in doc). effectivePersona matrix.ts:240 subtracts each value on its own. |
| A2 Active memory not a limit | CONFIRMED | matrix.ts:79 memoryUse only returns `over`; doc:11176 swapProgram has no memory check. |
| A3 No sheaf generation; generated hosts have no sheaf | CONFIRMED | npcgen.ts:653 and safehouse.ts:236 return only code, value and subsystems; the host sheet has only "Generate paydata" (public/templates/actor-host-sheet.hbs:60). |
| A4 SR2-core ideas mixed in | CONFIRMED (code part) | barrier `guardingIc` doc:9624; scramble only on files (matrix.ts:300, doc:9671); matrixReaction = Int + 2×RI (matrix.ts:57); 'black' in securityCodes (config.ts:533). The rules readings can't be checked against code. |
| A5 Graceful Logoff skips the black IC hold | CONFIRMED | doc:9908 `logoff` moves to the parent with no blackIcHold() call; holdingIc needs `ic.hostUuid === hostUuid` (rules/datawar.ts:109). |
| A6 Persona damage doesn't lower initiative | CONFIRMED | doc:14983–14989: the jacked-in roll subtracts only the meat `woundModifier` penalty, not matrixWoundModifiers. |
| B1 Item sheet Loaded checkbox | CONFIRMED | public/templates/item-sheet.hbs:592 plain `system.loaded` checkbox; the item `_preUpdate` (doc:14935) strips only heat/heatAt/complexForm. |
| B2 Black IC hold dodged | CONFIRMED | jackIn doc:9244–9286 has no hold check; logoff as in A5. |
| B3 Sheaf IC for the second decker | CONFIRMED | See D1. |
| C1 Deck repair stale | CONFIRMED | doc:11087 repair runs as a project (finishDeckRepair). |
| C2 Deck building stale | CONFIRMED | doc:11802 finishDeckPart project. |
| C3 Security code stale | CONFIRMED | paydata codes config.ts:647; dumpShock.byCode and icInitiative.diceByCode config.ts:2898–2899. |
| C4 Memory gap | CONFIRMED | Same as A2. |
| C5 Persona limits gap | CONFIRMED | Same as A1. |
| C6 Jack in dialog open to players | CONFIRMED | See D3. |
| C7 GM-left items | UNCHECKABLE | A list of agreed GM leftovers, no code claim. |
| C8 Least certain | UNCHECKABLE | Rules doubts only. |
| D1 Host-wide launchedSteps | CONFIRMED | doc:10160 stepsToLaunch(triggered, host.launchedSteps); doc:10175 adds to the host-wide list; cleared only on resetTally (doc:10261). |
| D2 Loaded checkbox skips Swap Memory | CONFIRMED | Same as B1. |
| D3 Move button teleports | CONFIRMED | public/templates/matrix-section.hbs:46 button has no GM condition; sheets.ts:899 #onJackIn lists every host, no GM check; jackIn does no logon test, travel or hold check. |
| D4 Drop trace / Clear crippled not GM-gated | CONFIRMED | sheets.ts:2393 and 2397 have no isGM check; sheets.ts:2346 #onClearPsyche does. |
| D5 Turn helper misses Matrix buttons | CONFIRMED | rules/interface.ts:145 map has jackIn, jackOut, matrixAttack and runMedic only; useAction at sheets.ts:1957, 1981, 2003, 2110, 2340, 2388. |
| D6 Launched IC don't join combat | CONFIRMED | doc:11854 launchIc only does Actor.create; no createActor hook adds combatants (tokens.ts:187, look.ts:278). |
| D7 Players see every host's code | CONFIRMED | sheets.ts:2046 "Hosts and grids (log on)" lists every host with code-value; the Move dialog does the same (sheets.ts:906). |

## 5-rigging-security.md
| Finding | Verdict | Evidence |
|---|---|---|
| A1 Response stored as a Combat Turn only | CONFIRMED | doc:14497–14499 sets worldTime -1 when a combat runs; securityResponses doc:14912 compares the round with any combat's; the deleteCombat hook (chat.ts:1029) only refreshes Karma. |
| A2 One response time | CONFIRMED | models/index.ts:1986 response has round, worldTime, arrived and force only; responseDue reads RULES.SECURITY.response (security.ts:60). |
| A3 Jumped-in rigger: Control Pool only | CONFIRMED | doc:12565–12567 rigger `dice: 0, poolDice: pool`; #manualEvasion doc:12584 skill dice + Combat Pool vs Handling. |
| A4 Repair: flat TN, systems and overlay | CONFIRMED | doc:12823 `targetNumber: vr.tn`, no tool check; finishVehicleRepair doc:12838 lowers condition only; only repairVehicle (doc:12863–12864) clears systems and the dead overlay. |
| A5 Adaptation off by default | CONFIRMED | config.ts:2264 needsAdaptation false; doc:11914 checks it. |
| A6 Rammer's damage on any success | CONFIRMED | doc:1989 `s > 0` (before defense) gives the button; crash:true skips passengers (doc:12650 `!ctx.crash`). |
| A7 Control rig TN only in some tests | CONFIRMED | vehicles.ts:75 drivingModifiers and doc:12312 sensorSituation; the vehicleFireModifiers call (doc:5923) and #defendVehicle have no vcr term. |
| A8 Sensor locks never lapse | PARTLY | No expiry and shot-out sensors don't clear locks, but a later sensor test against the same target that fails does drop its lock (doc:12395–12396 filters it out, re-adds only if s>0). |
| A9 No drone link spoofing | CONFIRMED | "spoof" appears only as a Matrix utility (matrix.ts:8, config.ts:620,632). |
| A10 Mount types | CONFIRMED | config.ts:2127 mounts none/fixed/turret/pintle, no capacity. |
| A11 Missiles ignore Signature | CONFIRMED | doc:5955 guidance dice; Signature only through sensorGunnery with a lock in 'signature' mode (doc:5917–5921). |
| A12 Destroyed outside soak | CONFIRMED | Dump and dead overlay only in #resolveVehicleSoak (doc:12637–12643); install botch (doc:13103) and the sheet's condition boxes do neither. |
| B1 Design examples | CONFIRMED | config.ts:2948 "Example rows only"; rows labelled "(example)" at 2969–2972. |
| B2 Push spends no action | CONFIRMED | sheets.ts:5852 #onPushSpeed → pushSpeed (doc:12718) → driveTest, no useAction; Drive spends one (sheets.ts:6117); pushSpeed isn't in BUTTON_ACTION_KINDS. |
| B3 Called shots not repaired | CONFIRMED | Same as A4. |
| C1 Vehicle defense row stale | CONFIRMED | #manualEvasion doc:12573. |
| C2 Dump shock row stale | CONFIRMED | doc:1326 dumpWhenDown → #downedOut. |
| C3 Initiative row stale | CONFIRMED | doc:14977–14981 manual driver's own speed. |
| C4 Building security header stale | UNCHECKABLE | Not traced in detail. Guards and casing exist per the changelog, not re-read. |
| C5 Chase header stale | CONFIRMED | roadwork.ts:127 maneuver mode 'score'. |
| C6, C7 Notes and additions | UNCHECKABLE | Advice only (refers to A1–A5, config values seen above). |
| D1 Lockdown ↔ shutdown | CONFIRMED | config.ts:2295 lockdown:'shutdown'; doc:14518–14523 site lockdown raises host to shutdown and calls startShutdown; doc:10131–10136 host shutdown → site lockdown; gas on lockdown doc:14510. |
| D2 Repair project vs called shots | CONFIRMED | doc:12838 finishVehicleRepair; doc:12818 reads condition before the project ends. |
| D3 Rigger vs manual evasion | CONFIRMED | Same as A3. |
| D4 Response vs world clock | CONFIRMED | Same as A1. |
| D5 Round-stamped vehicle state | CONFIRMED | speedWindow doc:12705–12708 and positionModifier roadwork.ts:127 compare against the current round; no deleteCombat hook clears them. |

## 6-characters-street.md
| Finding | Verdict | Evidence |
|---|---|---|
| A1 No Karma Pool on contest/street cards | CONFIRMED | #karmaButtons only via #post (doc:2460); perceive, socialTest, sneakPast, haggle, fence, legwork and findItem (doc:3140–4700) call successTest and ChatMessage.create directly; contests get only Change TN (chat.ts:1723). |
| A2 Specializations free at creation | CONFIRMED | No specialization or concentration terms in rules/creation.ts or applications/buildinput.ts; adding.ts:404 specRatingOf = rating+1 for free. |
| A3 Athletics → Quickness | CONFIRMED | config61/street.ts:56 quickness; statblock.ts:114 `athlet` → quickness; catalogue.ts:135–138 picker uses it; STREET.athletics body (config.ts:1462). |
| A4 Creation foci bonded free | PARTLY | Free bonding with no spell-point charge is right (adding.ts:170, sheettools.ts:22, paperwork.ts:181 counts spells only). But "free" isn't the only payment: focus is in BOUGHT_TYPES (catalogue.ts:39), so 'buy' is offered too (it defaults to not ready). |
| A5 Edges/flaws only TN mods | CONFIRMED | street.ts:48 Quality {points,target,tn}; qualityCheck street.ts:65 only checks caps and balance. |
| A6 No attribute raise past max | CONFIRMED (code) | upkeep.ts:37–38 returns ok:false above the max. Whether the rule exists is rules memory. |
| A7 Attribute can hit 0 | CONFIRMED | models/index.ts:687 `Math.max(0, natural + mod + gear)`. |
| A8 NPC generator: no Threat Rating | CONFIRMED | npcgen.ts:502–503 sets professionalRating and karma.pool, no threatRating; config.ts:2507–2512 PR 0–5; karma.pool initial 1 (models/index.ts:286). |
| A9 Metatypes fixed at load | CONFIRMED | rules/core.ts:8; models/index.ts:268 `choices: METATYPE_IDS`. |
| B1 Starter skill list | CONFIRMED | config61/street.ts:56 and 64 "Rotor Aircraft"; catalogue.ts:145 "Rotorcraft". |
| B2 Lifestyle outright = 100 months | CONFIRMED | config61/street.ts:45 months 100; applications/creation.ts:370–372 paidUntil = now + months. |
| B3 Negotiation opposedAttribute unused | CONFIRMED | Only config.ts:3113; SOCIAL skills Negotiation:'charisma' (config.ts:1524). |
| C1 Training row stale | CONFIRMED | config.ts:3107 mode 'timed'. |
| C2 Workshop row stale | CONFIRMED | doc:3318 workshopToolsLevel used. |
| C3 Priority builder row stale | CONFIRMED | Wizard builds; "Quick build…" at public/templates/actor-character-sheet.hbs:625. |
| C4 Builder row stale | UNCHECKABLE | v0.49 history not re-checked; the wizard does exist. |
| C5 Perception distance row stale | CONFIRMED | config.ts:1476 comment, perception.range bands. |
| C6–C8 Gaps | UNCHECKABLE | Advice or rules memory. |
| D1 Stealth/observer skip #skillDice | PARTLY | stealthSide (doc:4928) and the observer dice (doc:3160, 4082) use the raw rating, so gear, adept, skillsoft and specialization bonuses are missed. But the observer does get Perception edge/flaw modifiers: perceptionAgainst adds qualityModifiers for Perception (doc:4912). |
| D2 Roll memory restores comp | CONFIRMED | sheets.ts:2913 rememberMarker(..., ["useSpec","useConc","comp"]). |
| D3 Dead key | CONFIRMED | Same as B3. |
| D4 Outright lifestyle lapses | CONFIRMED | Same as B2. |
| D5 Timed new skill drops spec | CONFIRMED | adding.ts:506–507 creates at rating 0 with no specialization (513, the non-timed path, keeps it). |

## 7-integration.md
| Finding | Verdict | Evidence |
|---|---|---|
| A1 Paralysed etc. defend fully | CONFIRMED | doc:6293 `down` = incapacitated(status) only; defend never calls canAct (doc:976–993 blocks paralysis, sleep and petrified). |
| A2 Two wound calculations | CONFIRMED | models/index.ts:746 (pain editor, drugFx) vs doc:1365–1369 woundModifiers (compensator + painIgnore only), used at doc:1802. |
| A3 Drug testsTn never reaches tests | CONFIRMED | `effectMods.testsTn` is written at models/index.ts:751 and read nowhere; doc:1826–1828 reads the powerEffects flag; perceivedTn and attackedTn are read (doc:4914, 7106). |
| A4 Spells ignore invisibility | CONFIRMED | #unseenTargets doc:7113 walls only; #spellEnvironment doc:7123 has no concealment; nothing in 6700–7300 matches concealment or invisib. |
| A5 Holds restrict nothing | CONFIRMED | `blocksMovement` is read nowhere (only config61/magic.ts:64); preUpdateToken only regions.ts:283/294 (wards and region tracking); heldBy is cleared only in setHeld and breakFree (doc:6527); petrification armorBonus 0 (magic.ts:63). |
| B1 stun / restrain do nothing | CONFIRMED | No hasStatus('stun') or 'restrain' reader (the stun status is set at doc:13289 but never read). |
| B2 Paralysis partial | CONFIRMED | The timedEffects expiry (doc:5377–5384) turns the status off but leaves the powerEffects entry. |
| B3a sr2eBerserk no effect | CONFIRMED | Read only at doc:4450. |
| B3b Wolf "fight starts" never fires | REFUTED | chat.ts:1844–1848 `Hooks.on('combatStart')` calls berserkCheck('combat begins') for totems with berserk === 'combat'. |
| B4 See-through only two paths | CONFIRMED | seeThroughInvisibility called only at sheets.ts:2984 and doc:3150. |
| B5 Drug leftovers | CONFIRMED | Same as A2 and A3. |
| B6 Smoke lifetime | CONFIRMED | See D3. |
| C1 v0.50 Not-modeled stale | CONFIRMED | placeWardRegion canvas.ts:514; smoke and hearing in v0.61 configs. |
| C2 Templates circles only | CONFIRMED | areaRegionData circles only (canvas.ts drawArea/placeArea). |
| C3a Hold claim | CONFIRMED | Same as A5. |
| C3b Drug claim | CONFIRMED | Same as A2 and A3. |
| C3c Wolf claim | REFUTED | Same as B3b. |
| C4 Berserk GM-ruled | CONFIRMED | No mechanical effect (doc:4450 only). |
| C5 UNDO_LIMITS lacks Regions | CONFIRMED | rules/gmtools.ts:337–348 never mentions regions. |
| D1 Karma spends skip the queue | CONFIRMED | quicken doc:8888 updates karma.good with no ledger; raiseChannel doc:11695 and learnComplexForm doc:11711 write ledger lines with no approvalNeeded; the approvalNeeded call sites (doc:4193…13864) don't include ally, bindName or enchant. |
| D2 Initiation shows free | CONFIRMED | doc:7428 fileRequest has no karma; advancement.ts:521 → 'free'. |
| D3 Clouds by real time / end with combat | CONFIRMED | canvas.ts:482 `at: Date.now() + turns*3 s`; areaExpired canvas.ts:526–531: true when the combat is gone. |
| D4 Undo misses Regions | CONFIRMED | undo.ts:25 LOGGED_DOCS has no Region. |
| D5 Strip initiative | CONFIRMED | interface.ts:113 passes derived.reaction and initiativeDice. |
| D6 Turn helper misses buttons | PARTLY | Right for the Matrix buttons, sneak, sensorTest (doc:12357) and ramVehicle (sheets.ts:6009). But the vehicle sheet's Drive button is `driveVehicle`, which is in the map (interface.ts:150 `driveVehicle: 'drive'`). |
| D7 Picker uses augmented Reaction | CONFIRMED | adding.ts:411 derived.reaction; doc:4549–4551 naturalReaction. |
| D8 tnCandidates notice under magic | CONFIRMED | situation.ts:230 'notice' in the magic list; no hearing, deaf or superior-position rows. |
| D9 Statuses outlive reason | PARTLY | broken persists after combat (tokens.ts:453), but it isn't cleared "only by a rally": a later passed morale test clears it too (doc:4317–4319 `#setBroken(broken, group)`). The hold and paralysis parts are right. |
| D10 Inline tests don't spend pool | CONFIRMED | inline.ts:90 poolDice: extra with no pool spend; no test flag. |
| D11 Log vs projects | CONFIRMED | cancelProject doc:3431 adjustNuyen(+n); composeAdvancement advancement.ts:353 logs only nuyen < 0; #trainingTick updates (doc:3570–3583) without sr2eNoAdvance. The "by: GM" bullet wasn't traced. |
| D12 Mod install pays at end | CONFIRMED | doc:12845 finishModInstall "the payer pays then"; doc:3496 "nothing was given back". |
| D13 Light in melee, smoke not | CONFIRMED | doc:6008–6016 light always, smoke only `!o.melee`; sheets.ts:3021 the same. |
| D14 Checked-fine list | n/a | Not a finding. |
