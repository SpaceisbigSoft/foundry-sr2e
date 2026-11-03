# Full system review after v0.53.0 (20 Oct 2026)

Five independent reviewers compared SR2 (core and the 2nd-edition sourcebooks, from memory) with the code. The merged, de-duplicated list is in the gap checklist ("Still open (found in the v0.53.0 review)" in each section, and "Possible wrong values and bugs" under Rules to verify). These are the reviewers' full reports, with file and function evidence as of v0.53.0. Line numbers will drift.

---

## Gap review: character (v0.53.0)

Scope: creation, skills, tests, Karma, attributes and derived values, contacts, lifestyle, money, social, perception and stealth, Companion options, NPCs, running the shadows, and the SR2 side of the NPC generator and safehouse. The SR2 rules here are from memory, so each item says how sure I am.

### New holes

1. **Wound modifiers don't lower Initiative.** SR2: a character's wound modifier also comes off the Initiative total, so hurt characters act later and get fewer passes. Now: `SR2Combatant.getInitiativeRoll` (documents/index.ts ~11037) rolls `Nd6 + reaction` on every branch (normal, Matrix, rigged, astral) and never uses `derived.woundModifier`. `rules/initiative.ts rollInitiative` has no wound input either. Nothing changes the score when someone is hurt partway through a turn. Source: core. Confidence: high. Size: S. Priority: common at the table.

2. **No unopposed Perception test.** SR2: noticing an object, a detail or a sound is an Intelligence test against TN 4, with modifiers for how obvious it is. Now: `perceive(targetUuid)` (documents/index.ts:2671) always needs a target actor and is always opposed by that actor's Stealth. The sheet's Perceive (sheets.ts:771) opens a person picker. There is no "notice this" test and no obvious/hidden TN table. `RULES.STREET.perception` only has distracted, noisy, crowd and searching. Source: core. Confidence: high. Size: S. Priority: common at the table.

3. **No base time ÷ successes on ordinary skill tests.** SR2: a task that takes time is finished in its base time divided by the successes rolled. This covers research, building gear, Electronics work and the like. Now: only certain features use it: availability (`findTime`), vehicle repair, bypass, modification installs, programming and the safehouse search. `rollSkill` and the Roll dialog have no base-time field and the card shows no time taken (grep finds no baseTime in sheets.ts or `#runTest`). Source: core. Confidence: medium-high. Size: S. Priority: occasional.

4. **Build/Repair has no tools levels and no general gear repair.** SR2: B/R tests depend on having a kit, a shop or a facility (working without the right one makes the TN higher), and B/R skills cover building and repairing gear, not only vehicles. Now: `RULES.SKILLS.vehicleRepair` (flat TN 4) and the separate cyberware, deck, armor and wall repairs exist. There is no kit/shop/facility modifier anywhere (no grep hits), and nothing repairs a damaged weapon or electronics. The safehouse workshop's TN modifier is "shown, not applied" (already listed). Source: core. Confidence: medium. Size: M. Priority: occasional.

5. **Starting resources skip the contact and lifestyle costs.** SR2: at creation, contacts beyond the free ones are bought from Resources (prices rise by level), the lifestyle months are bought from Resources, and the cash you start with is limited or rolled by lifestyle (least sure of that last part). Now: `buildPlan` (street.ts:18) sets cash to the Resources priority minus gear, gives a lifestyle by priority plus a free paid month, and adds 2 contacts at no charge. `buildCheck` (creation.ts) has no contacts or lifestyle row. Source: core. Confidence: medium (contact prices), low (the cash rule). Size: S. Priority: occasional (creation only).

6. **Language skills have no rules of their own.** SR2: every character has a native language at a rating tied to Intelligence, Read/Write runs at a lower rating than speaking, and understanding is tested against a TN set by how complex the speech is. Now: `kind: 'language'` only groups the skill and sets its Karma band (models/index.ts:757). It has no native-language allowance in `buildCheck` (`knowledgePerInt` 0) and no read/write or complexity TN (no grep hits). Source: core. Confidence: medium-low. Size: S. Priority: occasional.

7. **Advancement takes no training time.** SR2 (expanded in the Companion): raising a skill or an attribute takes days or weeks of training, and an instructor's Instruction test shortens it. Now: `improve()` (documents/index.ts ~3355) spends the Karma and raises the rating at once. No world time passes and there is no instructor test. `Instruction` exists only as a social skill. Source: core / Companion. Confidence: medium-low. Size: S. Priority: occasional.

8. **No haggling over a job's pay.** SR2: runners negotiate their fee with Mr. Johnson in an opposed Negotiation test, and the result moves the pay. Now: the job generator prints "Pay … (negotiable)" (npcgen.ts:744). `haggle` works only on item price cards, and `socialTest` reports a margin that changes nothing. Source: core GM chapter / Companion. Confidence: low-medium. Size: S. Priority: occasional.

9. **No help with the Karma award.** SR2: the GM chapter breaks the award into team Karma (survival, objectives, threat) and individual Karma (roleplaying, courage, ideas). Now: `awardKarma` and `awardGroup` (documents/index.ts:3222, 3466) take a bare number, and the GM panel has no breakdown or checklist. Source: core. Confidence: medium. Size: S. Priority: rare/optional.

10. **Notoriety and Public Awareness are stored but do nothing.** Companion: Notoriety, built from flaws and ugly deeds, counts against a character's reputation. Public Awareness decides how likely they are to be recognised. Now: `system.reputation.notoriety` and `publicAwareness` (models/index.ts) are written to the sheet and read nowhere. `streetCred` ignores Notoriety, and nothing tests for being recognised. Street Cred's own TN effect is 0 by default (`socialTnPerCred`). Source: Companion. Confidence: medium. Size: S. Priority: rare/optional.

### Already listed

- Magic capped at Essence vs reduced by Essence lost (Cyberware "Least certain"; house rule `MAGIC_ESSENCE_MODE`).
- Free knowledge points: house rule `knowledgePerInt`, 0 by default (VERIFY Skills).
- The Skill Web as the book's diagram; the GM enters the links (VERIFY Skills, handoff).
- Martial-arts maneuvers (VERIFY Skills).
- Heat on characters (wanted status is the GM's) (handoff, Street leftovers).
- Haggling over services, and a contact's mood (VERIFY v0.44.0 Not modeled).
- Delaying across passes; buying successes with Good Karma (VERIFY Combat flow).
- Other lifestyle effects beyond the bill (VERIFY Upkeep; partly built in v0.49.0).
- NPC generator: totems for shamans, riggers' vehicles, spirit powers without a template, saving groups as templates (handoff).
- Safehouse: workshop, garage, supplies, panic room, escape tunnel and staff shown but not applied; costs of wards, lodges and fake SINs to check (handoff).
- Threat Rating, open tests and teamwork "check the book" (VERIFY v0.44.0 Least certain).

### Possible bugs or non-SR2 values

- config.ts:1622-1626: the priority table's Skills (50/40/34/30/27) and Resources D/E (¥20,000/¥5,000) look like SR3. As I remember SR2: Skills 40/30/24/20/17 and Resources D ¥5,000, E ¥500 (medium confidence). VERIFY already flags the whole table as least certain.
- models/index.ts:752: a skill's linked attribute can't be Reaction. SR2's vehicle skills (Car, Bike…) default to Reaction and use it for their Karma band. `npcgen.ts:193` maps `reaction` to Quickness. Only `driveTest` defaults to Reaction. Plain rolls and Karma costs for vehicle skills use Quickness.
- config.ts:1505: the Karma skill bands switch at 1× and 1.5× the attribute. I remember SR2 using 1× and 2× (low confidence).
- street.ts:18 `buildPlan`: the first lifestyle month is free, not charged to Resources (see hole 5).
- config.ts:1445 / documents/index.ts:2690: perception rolls a "Perception" skill when the character has one, but SR2 has no Perception skill (Intelligence only). It does no harm unless a stat block brings one in. The observer's TN is the sneaker's Stealth rating. SR2 may run Stealth as an open test (highest die = observer TN): `openTestResult` exists but sneaking doesn't use it (low-medium).
- config.ts:1397: complementary dice are `floor(successes / 2)`, so one success adds nothing. Check the book's table (low).

---

## Combat gap review (v0.53.0)

Scope: combat turn and initiative, ranged, melee, damage, blasts, special ammo and weapons, condition monitor, healing, hazards. Every item was checked in the code (src/module/rules/*.ts, documents/index.ts), not only in the docs.

### New holes

1. **Wounds don't lower Initiative.** SR2: each wound level also costs initiative (Light −1, Moderate −2, Serious −3), applied at once when the wound is taken. Now: `SR2Combatant.getInitiativeRoll` (documents/index.ts:11037) builds `Nd6 + Reaction` with no wound term, and nothing in the code changes a combatant's score when damage lands (searched for wound/initiative). Source: core. Confidence: medium-high. Size: S. Priority: common at the table.

2. **No Take Aim action.** SR2: Take Aim is a Simple Action, −1 TN per action spent aiming at the same target, up to a cap (about half the skill), and it is lost if the aim is broken. Now: `RULES.ACTIONS.costs` (config.ts ~1943) has no aim entry, and the code has no aim modifier anywhere. Source: core. Confidence: medium-high. Size: S. Priority: common at the table (snipers, careful shots).

3. **No multiple-target penalty.** SR2: each extra target you attack in the same action phase adds about +2 TN. Now: `spreadFire.extraTargetTn` is 0 (config.ts:1006), and a second SA/SS shot at a different target in the same phase gets nothing (`planAttack` only carries recoil over). Source: core. Confidence: medium. Size: S. Priority: common at the table.

4. **Surprised or unaware targets still defend in full.** SR2: someone caught by surprise, or who doesn't know the attack is coming, can't dodge or use Combat Pool against the attackers who surprised them. Now: surprise only takes the character out of the turn order (`surprisedNow`, index.ts:11131). `defend()` (index.ts:4716) treats only incapacitated or empty-body defenders as helpless, and has no "unaware" option. Source: core. Confidence: medium. Size: S. Priority: occasional (ambushes).

5. **The melee defender's own situation is ignored.** SR2: the melee modifier table applies to both sides of an opposed test. Fighting while prone, each friend the opponent has in the melee (+1 for you, −1 for them), and similar rows all count. Now: `#defendMelee` (index.ts:4787) only uses reach, skill modifiers, a shield and sight. `friendsModifiers` and `proneModifiers` are only used on the attacker's side, and the attacker's TN never rises for friends the defender has nearby. Source: core. Confidence: medium. Size: S–M. Priority: common at the table.

6. **No slap patches.** SR2: stim patches take Stun off for a while and then it comes back worse; trauma patches stabilise a dying character; tranq patches do Stun to the target; antidote patches add dice against a toxin. Now: nothing in the code mentions patches; first aid (`firstAid`, index.ts:947) is the only way to stabilise someone. A tranq patch could be faked as a toxin item, but the stim, trauma and antidote patches have no mechanics. Source: core gear / Street Samurai Catalog. Confidence: medium-high. Size: M. Priority: occasional.

7. **Gas grenades don't deliver their chemical.** SR2: a gas grenade exposes everyone in the cloud to the agent it carries (neuro-stun, tear gas and so on), resisted like that toxin. Now: `postBlast` (index.ts:4679–4699) only lists who is "in the gas cloud (its effect is the GM's call)". The toxin system (`exposeTo`/`resistToxin`) exists but is not wired to it. Source: core. Confidence: high. Size: S–M. Priority: occasional.

8. **Weapons can't carry a toxin.** SR2: narcoject darts, capsule rounds (DMSO) and poisoned blades deliver a toxin when they hit, sometimes in place of damage. Now: weapon data has no toxin link (models/index.ts) and `planAttack` passes none. Only the critter Infection power (index.ts:4432) rides on a hit. Source: core, Street Samurai Catalog. Confidence: medium. Size: M. Priority: occasional.

9. **Thrown weapons and bows always meet ballistic armor.** SR2 (as I remember it): impact armor stops melee, thrown weapons and blasts, and arrows may count differently from bullets. Now: `armorKindFor(melee)` (combat.ts:34) gives ballistic to every non-melee attack, and a weapon has no field to override the armor kind. Source: core / Street Samurai Catalog. Confidence: medium-low. Size: S. Priority: occasional.

10. **Reloading and readying ignore how the weapon feeds.** SR2: a clip goes in with one Simple Action, but a cylinder, internal magazine or break-action is loaded a few rounds per action; drawing or readying a weapon is a Simple Action too. Now: `reload` is always one Simple Action (`ACTIONS.costs.reload`) that fills the weapon, there is no feed-type field, and drawing a weapon is never counted. Source: core. Confidence: medium. Size: S. Priority: occasional.

11. **A burning character doesn't keep burning.** SR2: once you catch fire, you take fire damage every turn until the flames are put out (you can roll or act to put them out). Now: "Catches fire" resolves one 6M hazard (`resistHazard('fire', …)`, index.ts:9612), and the follow-up scene fire stays where it started instead of moving with the character. There is no "on fire" status that does damage each Combat Turn and can be put out. Source: core. Confidence: medium-low. Size: S–M. Priority: occasional.

12. **Subduing is only Stun damage.** SR2: subduing is a hold. You win the opposed unarmed test and compare your net successes with the target's Body or Strength to pin them, and the target can test to break free. Now: `subdue` only turns the damage into Stun (config.ts:923, `planAttack`); grappling and holds appear nowhere in the code. Source: core. Confidence: medium-low. Size: M. Priority: occasional.

13. **Shotgun spread doesn't lower the TN.** SR2 / Street Samurai Catalog (from memory): a wider spread makes the shot easier as well as weaker. Now: `shotgunSpread` (weapons.ts) only lowers Power. Source: core / Street Samurai Catalog. Confidence: low. Size: S. Priority: occasional.

14. **Overlapping blasts don't combine.** SR2: several blasts going off together at one spot combine their Power (the strongest plus part of the others). Now: each `postBlast` card is resolved on its own. Source: core. Confidence: low. Size: S. Priority: rare.

15. **No suppressive fire.** Fields of Fire (from memory): full-auto fire into an area forces anyone there to take cover or test against it. Now: missing from the code. Source: Fields of Fire. Confidence: low. Size: M. Priority: rare/optional.

16. **First aid and magical healing don't know about each other.** SR2: first aid and healing spells limit each other on the same wound (first aid after magic is barred or gets harder). Now: the `firstAidAt` and `healedAt` flags (index.ts:956, 5088) are each checked only against themselves. Source: core / Grimoire. Confidence: low. Size: S. Priority: rare.

### Already listed

- Opposed melee ties and counterattacks follow my reading, not the book (checklist "Simplified").
- Delaying across passes, interrupting with anything but full defense, buying successes with Good Karma (VERIFY, combat flow).
- Martial-arts maneuvers (VERIFY, skills).
- Smoke grenades: only fires make smoke (VERIFY, TN automation).
- Toxins that do something other than damage; gas filling a sealed room (VERIFY, toxins).
- When a toxin takes effect is the GM's call; the GM rolls (VERIFY toxins row).
- Overdoses beyond Expose; hospital stays that heal several boxes in one go (VERIFY, health).
- Disarming a charge that isn't on a timer; spells damaging objects other than walls; rocket scatter by vehicle facing (handoff leftovers).
- Grenade arcs over walls; visible laser beams; bipods on vehicles (VERIFY, v0.43.0).
- Fire spreading along walls, wind, drifting smoke (handoff leftovers).
- Long-term radiation effects beyond sickness (handoff leftovers).
- Hearing-based senses: cyberears, deafness (VERIFY, TN automation).
- Spirits' own initiative bonuses entered by hand (VERIFY, conjuring).
- Least-certain values to check against the book: knockdown, full defense, charging, prone, grenade kinds, scatter, confined spaces, stun overflow, healing TNs and times, the dying rate (checklist).

### Possible bugs or non-SR2 values

- damage.ts:36 `stageForNetSuccesses`: the first net success only hits and each further 2 raise the level, so 2 net successes leave the level unchanged. In SR2 every 2 net successes raise it one level, so 2 net should already stage up (medium-high). This affects weapons, melee (weapons.ts:167) and combat spells (magic.ts:42).
- damage.ts:48 and index.ts:1871: Body resistance successes stage down on their own, without being compared with the attacker's successes. As I remember SR2 (low-medium confidence), the two sides' successes offset each other and only the net stages up or down.
- damage.ts:61: death at Physical overflow equal to Body. SR2 says overflow *greater than* Body kills (low-medium).
- config.ts:1006: `spreadFire.extraTargetTn: 0`. SR2 charges about +2 per extra target (see hole 3).
- config.ts:991: a defensive grenade loses −0.5 Power per metre against −1 for an offensive one; check both against the grenade table (low).
- config.ts:187 `recoilFreeRounds: 1`: a single 3-round burst gets +2 recoil. Check whether SR2 counts a burst's own recoil differently (low).

---

## Gap review: magic (v0.53.0)

Paths are relative to `src/module/`. Rules are from memory, so each item gives a confidence.

### New holes

1. **Spells that change stats do nothing** — In SR2, sustained health and manipulation spells such as Increase Reflexes, Increase [Attribute] and Armor raise attributes, Reaction, initiative dice or armor while they are held. — `SpellDataModel` (models/index.ts:1077) has no attribute, initiative or armor fields. Power items have them (`sustained` plus `attributes`, applied through the `powerEffects` flag in `prepareDerivedData`), but no spell writes to that path. Only invisibility, silence and mask spells do anything, matched by name in `concealmentOf`. — core — high — M (reuse the powerEffects path with the spell's successes) — **common at the table**.
2. **Adepts get a Spell Pool** — In SR2 physical adepts have no Spell Pool. — `spellPool()` (rules/stats.ts:25) only checks for Magic above 0, and `deriveStats` (models/index.ts:533) never looks at the tradition. Adepts therefore get pool dice for astral attack, defense and spell resistance. — core — medium-high — S — **common at the table**.
3. **The totem's conjuring bonus cannot be tied to spirit types** — SR2 totems give bonus dice for particular nature spirits or domains (for example forest or city spirits), not for all summoning. — `totem.conjuring` is one number (models/index.ts:361). `totemDice(…, 'conjuring')` adds it to every summon, banish and invoke. — core — high — S — **common at the table**.
4. **Nature spirits never leave at sunrise or sunset** — A nature spirit stays only until the next sunrise or sunset, or until its services are used up. — There is no timer. Grepping for sunrise, dawn and dusk finds nothing, and spirits leave only when their services run out (documents/index.ts:6484). — core — high — S (world-time check, like the elemental sustain timer) — **common at the table**.
5. **Critters cannot have immunity to normal weapons or other immunities** — Critters with immunity to normal weapons get armor equal to twice their Essence. Critters such as vampires also have immunity to fire, poisons, pathogens and age. — `armorRating` gives immunity only to `this.type === 'spirit'` (documents/index.ts:4950). `POWER_SPECIALS` (rules/critters.ts:23) has no immunity special, so an NPC critter takes full damage. Nothing blocks fire hazards, toxins or diseases for an immune critter. — core / Paranormal Animals — high — M — **common at the table** when critters are used.
6. **Healing drain ignores the wound's level** — The Heal and Treat drain level depends on the damage level being healed, and Treat works only shortly after the wound. — `#resistDrain` always uses the fixed `sp.drainLevel`. The heal context records `before` but never maps it to a drain level, and nothing checks the time since the wound. — core — medium — S — **common at the table**.
7. **No touch range for spells** — SR2 spells are either line-of-sight or touch. A touch spell needs contact, which means an unarmed test against an unwilling target, and needs no sight. — The spell schema has no range field. The design formula prices `touch`, but casting still runs the line-of-sight check (`#unseenTargets`) and has no touch test. — core / Grimoire — medium — S — occasional.
8. **Spirit and critter powers that impose modifiers are effect-only** — Concealment (+TN to find the protected), Confusion (TN penalties), Movement (multiplies or divides speed), Guard and Fear all have mechanical effects. — Power items can only deal damage, report net successes, or change attributes (`PowerDataModel`). They cannot apply a TN modifier or movement change to a target, and the `TN_AUTO` pipeline never reads one. — core — high — M — **common at the table** (spirit services).
9. **Learning a spell is Karma only** — Learning needs a formula, a learning test with time, and a library (hermetic) or lodge (shaman) of at least the Force. — `raiseSpellForce` (documents/index.ts, after `sustainWithElemental`) only charges Good Karma. There is no test, no time and no `missingSites` check. — core / Grimoire — medium — S — occasional.
10. **No contest for control of a spirit** — The summoner can help a bound spirit resist banishing, and a magician can try to take control of another magician's spirit instead of banishing it. — `banish` rolls only the spirit's Force (and spirit energy) against the banisher's Magic, and there is no control option. — core / Grimoire — low-medium — M — occasional.
11. **Overspent power points are only displayed** — When an adept's Magic drops (Essence loss, magic loss, an unmet geas), powers beyond the new total are lost. — The sheet shows `spent / available` (actor-character-sheet.hbs:174), but nothing warns or turns powers off, and the over-budget powers keep their bonuses. — core — high — S — occasional.
12. **Several adept power types have no mechanics** — Rapid healing (faster or better healing), distance strike (killing hands at range), magic or spell resistance (extra dice against spells; Grimoire), and improved senses feeding `derived.vision`. — `ADEPT_SPECIALS` covers only five specials (rules/critters.ts:6). An adept's skill-dice or attribute fields cannot express these. — core / Grimoire — medium — S–M — occasional.
13. **Permanent spells take effect at once** — A Permanent spell has to be sustained for a while before its effect becomes permanent. — `duration: 'permanent'` is resolved like an instant spell, with no sustain period. — core — low-medium — S — occasional.
14. **Ward creation has no test** — Grimoire wards are built by a ritual with Force, time and a team. — Barrier actors are created at any rating with no test or time. — Grimoire — medium-low — S — occasional.
15. **Astral manifestation** — Projecting magicians (and spirits) can manifest: visible and able to speak in the physical world, but not able to act there. — There is no mode or state between unmaterialized and materialized; `ASTRAL_MODES` is physical, perceiving or projecting. — core / Grimoire — low-medium — S — occasional.
16. **Detection spell range** — Detection spells reach a range set by the caster's Magic and Force (extended range exists). — Only area radius is modeled (`areaRadius`). The design prices `extendedRange`, but casting never checks range. — core — low — S — occasional.
17. **Free spirit true names** — A magician who knows a free spirit's true name can bind it and force services (Grimoire). — The true name is a text field only, and there is no binding test. — Grimoire — medium — M — rare/optional.
18. **Centering needs a centering skill** — In the Grimoire, centering is done through a centering skill test (music, dance and so on), not applied automatically. — `centeringModifiers` cuts grade points of penalty with no test. — Grimoire — low — S — rare/optional.

### Already listed

- Spirits' own initiative bonuses (VERIFY, Conjuring "Not modeled").
- Weapon foci give no Power bonus in astral combat (VERIFY, Astral).
- No automatic per-turn timing for repeating powers (VERIFY, Powers).
- Astral tracking across planes is only a GM note (VERIFY, Signatures).
- Exclusive spells' other restrictions are not enforced (VERIFY, v0.16.0).
- Anchoring has no Karma cost and no link to an anchoring object (VERIFY, v0.18.0).
- Assensing has no table of what successes reveal (VERIFY, v0.13.0).
- Allies' own forms and powers (handoff leftovers; VERIFY v0.48.0).
- Metamagic beyond the eleven techniques, thesis quality, group initiation ceremonies, damage to the possessor's spirit form (VERIFY v0.45.0).
- Wards placed on the map (VERIFY v0.50.0).
- Spirit and critter power tables (book data, by design).
- Magic loss trigger and comparison marked least certain (checklist "Magic loss checked").
- Ghouls' other strains and the change itself (handoff leftovers).
- Possessed body's skill list on its sheet (handoff leftovers).

### Possible bugs or non-SR2 values

- documents/index.ts:5273 `sustainWithElemental`: never checks that the elemental's element matches the spell. The cast-time aid does check (`elementMatches`), and the RULES.MAGIC_EXTRA.elements comment says both should.
- rules/config.ts:58 and rules/cyberware.ts:48: the default `'cap'` mode is `min(Magic, ceil(Essence))`, so Essence 5.8 keeps Magic 6. In SR2 any fraction of Essence lost costs a point, which is the `'reduce'` mode. The default looks wrong (medium-high).
- rules/config.ts:447 `area.radiusFrom: 'force'`: I believe SR2's base radius is the caster's Magic in metres (medium).
- rules/config.ts:410 `focusKarma`: specific-spell and category foci both cost 1×, and spirit foci 1×. I recall category 3× and spirit 2× (medium). The schema doesn't separate specific from category foci when pricing.
- rules/config.ts:1687 killing hands has three levels (M, S, D). SR2 may have an L tier as well (low).
- rules/config.ts:333 dispelling drain is fixed at M with TN floor(Force/2). The Grimoire may use the dispelled spell's own drain code (low).

---

## Gap review: Matrix, rigging and building security (v0.53.0)

Reviewer area: `matrix-rigging`. All SR2/VR2.0/Rigger 2 rules here are from memory; confidence is given for each item.

### New holes

1. **Security tally is per host, not per decker** — In VR2.0 the GM keeps a separate tally for each intruding decker, so one clumsy decker doesn't set off the sheaf for everyone. — The host has one `system.tally`; `SR2Actor.addToTally` / `#applyTally` (documents/index.ts ~7375–7416) add every decker's, frame's and agent's detection successes to it. Two deckers in a host trigger steps together. — VR2 — medium-high — M — common at the table.

2. **Program loading, Load Speed and Swap Memory** — Loading a utility into active memory mid-run takes time (size against the deck's load/I/O speed) and an action (Swap Memory). — "Loaded" is a free, instant checkbox toggle (applications/sheets.ts:1433). Decks have no load-speed field, and there is no Swap Memory operation in `RULES.MATRIX.operations`. Deckers can swap their whole kit for free between tests. — VR2 (SR2 core has load speed too) — high — S — common at the table.

3. **Persona damage modifiers (TN automation)** — Damage on the Matrix condition monitor gives the persona (and damaged IC) the usual wound TN modifiers on their Matrix tests. — The 10-box `system.matrix.monitor` is only read for crash and Medic. `matrixTestMods()` (index.ts:6803) has connection, link, tortoise, psyche and smoke, but no monitor modifier. `icAttack` takes nothing from the IC's own monitor. — VR2 — medium — S — common at the table.

4. **Black IC holds the decker** — A decker engaged by black IC can't just jack out. They need a successful test (Willpower or similar vs the IC rating) to escape. — `jackOut()` (index.ts:6768) always succeeds with no dump shock, whatever IC is engaged. — VR2 (definitely SR3) — medium — S — common at the table.

5. **Shutdown alert and Crash Host do nothing to occupants** — When a host shuts down or is crashed, everyone inside is dumped (with dump shock) after a short delay. — `crashHost` only raises the alert to 'shutdown' (index.ts:7204–7209). `#raiseHostAlert` never dumps the deckers in the host or makes frames and agents leave. — VR2 — medium — S — occasional.

6. **Persona Sensors and Evasion maneuvers; Matrix perception** — Sensors drive the persona's "perception" (noticing other icons, Locate Decker / Locate IC / Analyze Icon). Evasion drives cybercombat maneuvers (opposed Evasion tests to position, parry or evade, and to break contact before an IC or trace locks on). — The persona's Sensors is only a crippler/ripper target (`icActionTarget`). The only Evasion use is as the attack TN. There are no Locate Decker/IC, Analyze Icon/Subsystem or maneuver operations (config.ts:585–608). Security deckers can "spot" intruders, but intruders can't spot them. — VR2 — medium — M — common at the table.

7. **Utilities with no effect: Cloak, Lock-On, Slow, Restore, Validate** — VR2 utilities: Cloak helps evasion, Lock-On stops a target evading, Slow cuts IC initiative/actions, Restore repairs or undoes deck damage, and Validate validates a passcode. — Cloak, Lock-On and Validate exist only in `UTILITY_KINDS` and the size table (matrix.ts:8, config.ts:576). Slow and Restore don't exist. There is no Validate Passcode operation, and Invalidate Passcode is `effect: 'none'`. — VR2 — medium — M — occasional.

8. **Data bomb / Pavlov file defenses** — Files and nodes can carry data bombs that explode on access (damage = rating to the persona, file erased) unless found and defused (Evaluate/Decrypt). — The only file defenses are encryption and scramble (`paydata`, `DataFile`); "bomb" appears nowhere in src. — SR2 core / VR2 — medium-high — S — occasional.

9. **Make / Tap Comcall operations** — Placing, tapping or rerouting phone calls through an LTG is a standard VR2 operation (Files or Slave subsystem). — None of these are in `RULES.MATRIX.operations`. LTG numbers exist (v0.46.0), but there is nothing to do with a comcall. — VR2 — medium — S — occasional.

10. **Vehicle Acceleration is never applied** — Speed can change each Combat Turn only by the vehicle's Accel. Pushing harder (or braking hard) needs a driving test. — `accel` is a schema field (models/index.ts:1407), but nothing in rules/ or documents/ reads it. `currentSpeed` is typed freely, so chases and ramming can jump to any speed at once. — SR2 core / Rigger 2 — high — S — common at the table.

11. **Crash test after vehicle damage** — When a vehicle takes damage (at least Serious, or any damage in Rigger 2), the driver makes a crash test (Handling plus damage modifiers). — `#resolveVehicleSoak` (index.ts:9135) applies boxes, feedback and passenger damage, but never calls for a crash test. Crash tests happen only when someone ticks "crash test" by hand. — SR2 core / Rigger 2 — medium — S — common at the table.

12. **Called shots against vehicles** — You can aim at tires, sensors, weapon mounts, the engine or exposed occupants. Each gives its own TN and effect (a crash test, a lost system, a hit on the passenger). — Called shots only exist for cyberlimbs (`cyberDamageCheck`). Grepping for tires or vehicle called shots finds nothing. — Rigger 2 (some in SR2 core) — medium — M — occasional.

13. **Rigger 2 vehicle combat: maneuver scores / positioning** — Rigger 2 runs vehicle combat and chases with maneuver tests and scores (from Handling, speed, terrain and skill). Winners gain position or attack bonuses, or close or open range. — `chaseTurn` (vehicles.ts:223) is a gap-in-metres model. VERIFY only says it "may work quite differently"; it doesn't list it as not modeled. — Rigger 2 — medium — L — occasional.

14. **Vehicle design rules** — Rigger 2 builds vehicles from a chassis, a powerplant and design points (Body, Armor, Speed, Handling, mounts, cargo) with costs. — Only stat-by-stat modifications (`VEHICLES.modifications`). There is no chassis or powerplant design. — Rigger 2 — high — L — rare/optional.

15. **Maglock types and bypass tools** — Maglocks come as keypad, card, print or retina locks, and some are bypassed in steps (open the casing, then bypass the circuit). Sequencers and passkeys add dice or replace the skill, and working without tools or in poor light raises the TN. — `bypassLock` (index.ts:10828) is one Electronics test vs rating. It has no lock subtype, no tool or kit bonus and no light at the lock, so the dialog finds no TN modifiers by itself. VERIFY only says SR2 "may" use a sequence. — SR2 core gear / Corporate Security Handbook — medium — M — common at the table.

16. **Deck hardware options: reality filter, hitcher jacks, vidscreen/offline** — A reality filter gives a Matrix bonus after an MPCP-vs-host test. Hitcher jacks let passengers ride along and take a share of the damage. — Neither is in the cyberdeck schema or in rules/matrix.ts. Tortoises cover the vidscreen case only. — VR2 — medium — M — rare/optional.

17. **BTL and simsense chips** — BTL chips work like drugs: a dose, an addiction rating and tolerance, with dreamchip and personafix variants. — There are no BTL kinds. The generic drug model could carry one, but nothing marks a chip as BTL or ties it to a chipjack or simrig. — SR2 core / Shadowtech — low-medium — S — rare/optional.

### Already listed

- Otaku submerging, echoes and fading (handoff "Matrix leftovers", VERIFY v0.49.0).
- Program options with combat effects: area and penetration (handoff).
- Satellite links with no range limit (VERIFY v0.46.0).
- Psychotropic effects outside the Matrix, and Shield against non-black attacks (VERIFY v0.40.0).
- Agents possibly being a later edition's idea (VERIFY v0.40.0).
- Turret traverse by Combat Phase rather than per shot, and cargo shape (handoff "Vehicles leftovers").
- Chases maybe being range bands or maneuver scores in the book (VERIFY v0.25.0 note; item 13 asks for the mechanic itself).
- Guards on patrol routes, and tamper alarms on Matrix tampering (handoff "Security leftovers").
- Rigger adaptation needed to jump in, off by default (`RIGGING.needsAdaptation`).
- Hacking Pool defense in cybercombat is a house choice (VERIFY v0.27.0).

### Possible bugs or non-SR2 values

- rules/config.ts:509–510, index.ts:7972 — Dump shock is always M, with TN = Security Value. VR2/SR3 set the damage level by security code (Blue L, Green M, Orange S, Red D, Power = Security Value). Medium confidence.
- rules/config.ts:514 — IC initiative = rating + 1/1/2/2/3 d6. VR2/SR3 use the host's Security Value + 1–4 d6 by code (Blue 1 … Red 4). Medium-low.
- index.ts:7709 — An IC rolls its own rating as attack dice. VR2 may roll the host's Security Value instead (the rating is then Power and the TN for the decker). Low.
- rules/config.ts:2033 — Sensor-enhanced gunnery is a flat −2 TN with a lock. SR2 and Rigger 2 replace the range TN with the target's Signature (plus modifiers) and cap Gunnery by the Sensor rating. Low-medium.
- index.ts:9103 — Only a jumped-in rigger can evade with the vehicle. A manual driver gets no defense test at all, while SR2 lets them make a driving-based evasion. Low.
- index.ts:8930–8965 — `sensorTest` calls `successTest` directly, not `#runTest`. Check that Karma re-rolls and the GM's "Change target number…" work on sensor cards. Also, the jumped-in rigger's control-rig TN bonus is not applied to sensor tests, though it is to driving.
- index.ts:7130 — An agent's or frame's detection roll and tally land on the host's shared tally (made worse by item 1).

---

## Gap review: gear-augmentation (v0.53.0)

Scope: cyberware, bioware, Shadowtech, gear and how they hook into Foundry. Checked against the code, not only VERIFY.md. Rules are from memory; each item gives a confidence.

### New holes

1. **Gas grenades and weapon-delivered toxins** — SR2 gas grenades (Neuro-Stun, tear gas) and dart or capsule rounds deliver a toxin, and each person caught resists it (gas masks and filters help) — the gas blast kind posts "in the gas cloud (its effect is the GM's call)" and nothing else (`documents/index.ts` ~4678–4699). Weapons have no link to a toxin item. `exposeTo` exists but can only be started by hand from the gear item (`sheets.ts:1270`). — core — high — M — common at the table.
2. **Slap patches** — SR2 core has four dermal patches with ratings: stim (takes Stun boxes off for a while, then they come back), tranq (Stun vs Body), trauma (helps stabilise the dying) and antidote (rating added to toxin resistance) — nothing in the code (grep "patch" finds no rule). Medkits are the only medical gear. — core — high — M — common.
3. **Health spells that raise attributes** — Increase [Attribute] and Increase Reflexes add to attributes or initiative, and Increase Reflexes doesn't stack with cyber reflexes — `SpellDataModel` has no attribute or initiative fields (`models/index.ts:1077`). Only critter powers get attribute effects (`powerEffects`). So `stackAugmentations` can never see a spell. This overlaps with the magic area. — Grimoire/core — medium-high — M — common.
4. **Essence holes** — in SR2, Essence lost to cyberware stays lost when the ware is taken out, and new ware can go into the hole without costing more Essence (the usual way to upgrade to alphaware) — unticking or deleting an item gives all its Essence back (`totalEssenceLoss` counts only installed items, `cyberware.ts:31`). In 'cap' mode it gives back Magic too. There is no field for the hole. — core/Shadowtech — medium — S — occasional.
5. **Cyber filtration systems** — SR2 core has air, blood and ingested-toxin filters that add their rating to toxin resistance by how the toxin gets in — the stat-block importer creates them as kind 'other' with no effect (`statblock.ts:533`). The effect fields (`inhalantDice`, `toxinDice`) are only read for bioware (`augmentationsOf`/`bioDerived` use them only when `system.bioware` is ticked), so cyberware can't carry them without costing Body Index instead of Essence. — core — medium-high — S — occasional.
6. **Electronic surveillance and countermeasures** — SR2 has bugs, line taps, laser and shotgun microphones, bug scanners (rating against the bug's rating), white-noise generators (they beat audio pickup) and area jammers against radios and phones — scanners only cover weapon, cyber and explosive kinds (`RULES.GEAR.scannerKinds`), and jammers only affect drone and remote-deck signals. No bug or white-noise mechanic exists. — core — high that the gear exists, medium on the numbers — L — occasional.
7. **Vision gear** — goggles, glasses, binoculars and helmet visors with low-light, thermographic, flare compensation or magnification — the derived vision reads only cyberware flags, metatype and the manual `system.vision` boxes (`models/index.ts:582`). Flare compensation is cyberware-only (`cyberDerived`; flash check `documents/index.ts:4685`), and magnification exists only on cybereyes and weapon scopes. Gear has no vision fields. — core — high — S — occasional.
8. **Readying weapons and quick-draw holsters** — drawing a weapon is a Simple action, and a quick-draw (with a holster) lets you draw and fire in one action after a test — there's no drawn/holstered state and no draw action (`RULES.ACTIONS.costs` has none; "holster" isn't in the code). — core — medium — S — occasional.
9. **Bone lacing** — it adds to Body for damage resistance only, adds to unarmed Power, and adds weight — the importer gives it Essence and nothing else (`statblock.ts:532`). Cyberware has no "soak dice" or "unarmed Power" field, and a Body bonus would change Body everywhere. — Shadowtech — medium — S — occasional.
10. **Token visibility for invisibility and astral forms** — invisible characters and astral forms shouldn't show up for mundane viewers — the TN rules handle this (`perception.living`, `attack.concealment`), but tokens are never given Foundry's invisible status, and astral perception has no detection mode (`applications/tokens.ts` sets only basic, low-light and thermographic sight plus ultrasound tremor). So players see every invisible or projecting token on the map. — integration — high (Foundry) — M — occasional.
11. **Assensing reveals Essence and cyberware** — in SR2, assensing successes reveal a target's health, Essence and where their cyberware is — `assense` only lists active foci (`documents/index.ts:1303`). Overlaps with magic. — Grimoire — medium — S — occasional.
12. **Ranged cyberweapons (cyberguns)** — guns built into a limb, with ammo and Essence or capacity cost — the cyberweapon schema has melee fields only (`models/index.ts:1051`), so a cybergun has to be a separate weapon item. — Shadowtech/SSC — medium-low — M — rare/optional.
13. **Legality and permits** — legality codes, permits, and fines or checks when caught with restricted gear — there's no field or rule anywhere ("legal" and "permit" aren't in the rules). — core or SSC (not sure SR2 core has codes) — low — M — rare/optional.
14. **Surgical trauma** — in Shadowtech, the surgery itself leaves the patient wounded, and how badly depends on how big the job is (healed normally) — here only a failed roll does harm (L, `RULES.BIOWARE.surgery.failureLevel`). A successful surgery leaves no wound, only the recovery timer. — Shadowtech — low — S — rare/optional.

### Already listed

- Hearing-based senses: the cyberears kind has no effect (VERIFY v0.50.0 "Not modeled").
- Other Shadowtech bioware (suprathyroid, mnemonic enhancer, nephritic screen, symbiotes, pathogenic defense) beyond "Other with bonuses" (VERIFY v0.30.0; the importer marks them `unmodelled`).
- Body Index limit = natural Body, and Magic −1 per 2 Body Index (checklist "Least certain").
- Armor layering, carrying limit, silencer and tracer numbers, the reflex stacking cap, Smartlink-2, ultrasound TNs, pheromones, grade cost multipliers (VERIFY "Least certain" notes).
- Smoke grenades: only fires make smoke (VERIFY v0.50.0).
- Magnetic anomaly detectors vs non-metal weapons, visible laser beams, bipods on vehicles (VERIFY v0.43.0).
- Hospital stays healing several boxes at once, other lifestyle effects (VERIFY v0.42.0/v0.33.0).

### Possible bugs or non-SR2 values

- `models/index.ts:66` — `augmentationsOf` marks items still recovering from surgery as not installed, and `totalEssenceLoss` skips them. So Essence (and Magic in 'cap' mode) stays at its old value until recovery ends; SR2 takes the Essence at implant.
- `models/index.ts:108` — `cyberDerived` (`live`) ignores recovery. While the patient is still recovering, the smartlink, datajack, chipjack, skillwires, magnification, flare compensation, ultrasound, pheromones and cyberlimbs already work, but attribute bonuses, vision (`:582`) and armor don't.
- `applications/tokens.ts:33-43` — the ultrasound detection mode is only ever added, never turned off when the eyes are damaged or removed. Token vision also isn't re-synced when a surgery recovery ends, because no item update fires.
- `documents/index.ts:3132` — fencing prices cyberware with `cyberCost` only (cultured ×4 is ignored for bioware). `documents/index.ts:3424` (`findItem`) prices bioware with `bioCost` only (the grade is ignored). The sheet (`sheets.ts:4310`) applies both, so the three prices disagree.
- `rules/config.ts:47` — betaware Essence ×0.7. My memory of SR2 Shadowtech is ×0.6 (alpha 0.8, beta 0.6, delta 0.5) — medium confidence.
- `applications/chat.ts:243` and `:1268` — the "once per card" flags (`cyberDamageRolled`, `rejectionRolled`) are set only when the clicker owns the message. A player can re-roll a GM-posted rejection card (the due card from the time hook, `documents/index.ts:4074`) after a re-render.
- `documents/index.ts:1231-1234` — the surgery result updates the patient with no `isOwner` check and no "Apply (GM)" fallback, unlike healing (`:6114`). A Karma re-roll by a surgeon's player who doesn't own the patient fails.
- `models/index.ts:486` — orthoskin's conflict compares both its ballistic and its impact against the larger of the plating's two ratings, not kind by kind.
- `rules/config.ts:142` — enhanced articulation gives only physical-skill dice. I recall +1 Reaction as well — low confidence.
- `rules/cyberware.ts:181` — `bestSoftFor` is dead code. The actor re-implements it (`documents/index.ts:2630`). Harmless.
