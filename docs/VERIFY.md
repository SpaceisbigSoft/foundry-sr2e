# Rules to check against your Shadowrun 2nd Edition book

These values were written from memory of SR2 and have unit tests that confirm the code does what is written, but **not** that what is written matches the book. Change them in `src/module/rules/config.ts` and `stats.ts`; the tests will tell you which assertions to update.

| Rule | Current implementation | Where |
|---|---|---|
| Minimum target number | 2 | `MIN_TARGET_NUMBER` |
| Default skill to attribute | +4 TN | `ATTRIBUTE_DEFAULT_TN_MOD` |
| Default skill to related skill | +2 TN; the player picks the related skill in the roll/attack dialog. Skill Web distances since v0.38.0 (+2 TN per step once the GM enters links; see that section) | `SKILL_DEFAULT_TN_MOD`, `skillTestDice` |
| Specializations | A skill item has a specialization name and rating; when used, the specialization rating replaces the skill rating. Weapons can name a specialization that pre-ticks it | `skillTestDice` |
| Range TNs | short 4 / medium 5 / long 6 / extreme 9 | `RANGE_TN` |
| Melee base TN | 4; the base TN of melee attacks (since v0.3.0) and of both sides of opposed melee (since v0.20.0) | `MELEE_BASE_TN` |
| Damage boxes | L=1, M=3, S=6, D=10 | `BOXES_PER_LEVEL` |
| Wound modifiers | 1-2 boxes +1, 3-5 +2, 6-9 +3 | `WOUND_MODIFIERS` |
| Physical + Stun wounds | Add together | `WOUNDS_CUMULATIVE` |
| Stun overflow | 2 stun boxes become 1 physical box | `STUN_OVERFLOW_PER_PHYSICAL_BOX` |
| Death | Physical overflow equal to Body | `monitorStatus` in `damage.ts` |
| Attacker staging up | First net success hits; each further 2 raise the level | `stageForNetSuccesses` |
| Armor vs Power | TN = Power - armor, min 2; no "armor halved if Power is more than twice armor" style special cases | `resistanceTargetNumber` |
| Reaction | (Quickness + Intelligence) / 2, round down | `reaction` in `stats.ts` |
| Combat Pool | (Q + I + W) / 2, round down | `combatPool` in `stats.ts` |
| Spell Pool | Sorcery rating (v0.79.0, SR2 p. 85; the old (I + W + Magic) / 3 is the house rule `DOCS_V79.magicPool.size` 'attributes') | `spellPool` in `stats.ts`, `models/index.ts` |
| Initiative passes | -10 per pass | `INITIATIVE_PASS_DECREMENT` |


## Checked against the books (v0.92.3, 12 Nov 2026)

v0.92.3 compared the default rules with the SR2 books themselves (Core Rulebook, Companion, Grimoire, Awakenings, Virtual Realities 2.0, Rigger 2, Shadowtech, Cybertechnology, Fields of Fire, the Corporate Security Handbook and the others cited) and made the book's way the default. **Where a row below disagrees with an older section of this file, this section is the current rule.** Official FASA errata and Ka-Ge Q&A override the books. Every behaviour change has a house-rule switch (`RULES.<AREA>_V923`, `rules/config923/*.ts`) whose other choice puts the v0.92.2 way back; values moved in place can be set back in the house-rules window. Under the "Unified Rules Revamp" rules source a rule the Revamp changes itself keeps the Revamp's behaviour; a book fix the Revamp has no rule for applies there too (the owner's decision, 12 Nov 2026). On the first load after the update the lead GM gets one card listing the actors whose numbers change, by reason, with the switch that restores each (`notice923.ts`).

### Core mechanics and characters

Switches in `RULES.CORE_V923` (`rules/config923/core.ts`, pure functions in `rules/core923.ts`); the first choice of each is the book's way (the default), the other puts the v0.92.2 behaviour back. Values moved in place are house-rule (or shared) values: the GM can set them back.

| Rule | Was | Now (book) | Source | Switch |
| --- | --- | --- | --- | --- |
| Attribute points by priority | 30 / 27 / 24 / 21 / 18 | 30 / 24 / 20 / 17 / 15 | Core p. 46–47 | `CORE_V923.priorities` |
| Skill points by priority | 50 / 40 / 34 / 30 / 27 | 40 / 30 / 24 / 20 / 17 | Core p. 46–47 | `CORE_V923.priorities` |
| Resources by priority | 1,000,000 / 400,000 / 90,000 / 20,000 / 5,000¥ | 1,000,000 / 400,000 / 90,000 / 5,000 / 500¥ | Core p. 47 | `CORE_V923.priorities` |
| Race priority | human any, elf and troll C, dwarf and ork D | any metahuman A (More Metahumans, optional: C) | Core p. 45–46 | `CORE_V923.priorities`, `.moreMetahumans` |
| Magic priority | A full magician, B adept or aspected, for any race | human: A magician, B adept; metahuman: B magician, C adept (More Metahumans: A / B for all) | Core p. 45 | `CORE_V923.priorities` |
| Spell (Force) Points at creation | by Magic priority: A 25, B 25, else 0 | by Resources priority: 50 / 35 / 25 / 15 / 5, magicians only; foci bonded from them | Core p. 47 | `CORE_V923.priorities` |
| Dwarf modifiers | B+1 S+2 W+1 | also Q−1 (natural maximum 5) | Core p. 43, 45 | `CORE_V923.racialMods` (the Revamp's own maximum table keeps the old modifiers) |
| Troll modifiers | B+5 Q−1 S+4 C−2 I−2 | also W−1 (natural maximum 5) | Core p. 43, 45 | `CORE_V923.racialMods` |
| Troll dermal armor | 1 ballistic and 1 impact armor | +1 Body die on damage resistance | Core p. 45 | `CORE_V923.trollDermal` |
| Troll running | × 3 | × 2 | Core p. 83 | `METATYPES.types.troll.run` 3 → 2 (the Revamp's patch sets 2 too) |
| Native language | free at Intelligence | free at Intelligence + 2 | Core p. 46 | `CORE_V923.nativeLanguage` |
| Street dialect | none | a Street lifestyle's dialect (City Speak, Tunnel Talk) free at half Intelligence (build check) | Core p. 46 | `CORE_V923.streetDialect` |
| Leftover Resources | kept whole | kept at 10:1 | Core p. 47 | `CORE_V923.leftoverCash`, `.cashRatio` |
| Starting cash | none | + 3D6 × 1,000¥ when the wizard finishes | Core p. 47 | `CORE_V923.startingCash` |
| Starting Karma Pool | 1 for everyone | metahuman 2, human 1 (1 with More Metahumans) | Core p. 47 | `CORE_V923.startPool` |
| Attribute Karma | new rating × 2 | new rating × 1 | Core p. 190 | `UPKEEP.karma.attributeMultiplier` 2 → 1 (the Revamp's patch sets 1.5) |
| Past the natural maximum | refused | with the GM's leave, double Karma, up to the augmented maximum | Core p. 190 | `CORE_V923.aboveMax` (the house rule `karmaAboveRacial`, on under the Revamp, wins) |
| Karma Pool growth | every 10 career Karma (metahumans 20) | 10 to Good Karma, the next point to the pool (every 11th), everyone (Core p. 190 splits 90/10 rounding in favour of Good Karma; its "one-tenth, round up" in the Karma Pool section disagrees, and the Companion's clarification settles it as every 11th) | Companion p. 76; Core p. 190 | `UPKEEP.karma.poolEvery` human 10 → 11, metahuman 20 → 11 |
| Karma Pool dice | Revamp only | 1 point a die, up to the test's own skill/attribute/rating dice | Core p. 191 | `CORE_V923.karmaDice` (the Revamp's no-cap rule wins when on) |
| After avoiding a disaster | re-roll and buy buttons stay | no more Karma on that test | Core p. 191 | `CORE_V923.afterOops` |
| Karma Pool refresh | by hand | full again when a combat ends (the next encounter) | Core p. 191 | `KARMA.refresh` 'manual' → 'combat' |
| Language and knowledge Karma | Intelligence bands × 1 / 1.5 / 2 | language × 1; knowledge a general skill × 2 (conc. × 1.5, spec. × 1) | Core p. 190 | `CORE_V923.skillKarma` (the Revamp's language × 1 wins when set) |
| A new skill | its rating-1 price | 1 Good Karma | Core p. 190 | `CORE_V923.newSkill` |
| Training days (timed training) | new rating × days by kind | Karma spent × 7 (active, B/R, social, attributes), × 15 (knowledge, language) | Companion pp. 50, 53 | `CORE_V923.trainingTime` |
| Individual Karma awards | 5 rows of 1 | roleplaying 1–2, guts 1–2, smarts, right place, surprise, humor, drama | Core p. 199 | `CORE_V923.awards` |
| Time ÷ successes | rounded up to 0.1 unit | to the nearest whole unit (at least 1) | Core p. 68 | `CORE_V923.timeRounding` |
| Attribute defaulting | flat +4 | +2 per Skill Web circle from the attribute when the web links it | Core p. 68 | `CORE_V923.attributeDefault` |
| Skill Web paths | both ways, at most 3 steps | "A > B" links one-way (the arrows), no step cap | Core p. 68 | `CORE_V923.webArrows`; `SKILLS.web.maxSteps` 3 → 99 (the Revamp's patch sets 99) |
| Perceiving someone | opposed: Perception (else Int) vs Stealth; Stealth vs Int | Intelligence vs 4 + modifiers, one success; the sneaker doesn't roll | Core p. 185 | `CORE_V923.perception` 'book' / 'companion' (Stealth (4), +1 TN a success, Companion p. 90) / 'opposed' |
| Sound, smell, touch, taste rows | Revamp only | in the Perceive, Notice and Sneak dialogs and the GM's TN checklist | Core p. 185 | `CORE_V923.perceptionSounds`, `.senseRows` |
| Language TNs | 3 / 4 / 6 / 8 | 2 / 4 / 6 / 9 / 11, dialect +2 | Core p. 184 | `CORE_V923.languageTns`, `.languageTable` |
| Build/Repair without tools | +4 TN | not allowed | Core p. 183 | `CHARACTERS_V58.tools.none` 'tn' → 'block' |
| Climbing TNs | 2 / 4 / 6 / 8 | 3 / 5 / 8 / 14 | Fields of Fire p. 75 | `STREET.athletics.climb` (the Revamp's patch sets the same) |
| Climbing and swimming distance | 2 m per success | climb ¼ × ((Q + S) ÷ 2 + 2 per success); height/wet modifiers; swim (Q + successes) × run ÷ 5 | Fields of Fire p. 75; Cyberpirates | `CORE_V923.athletics`, `.climbModifiers` (the Revamp's hsAthletics wins) |
| Threat Rating | + Combat Pool dice | + dice on every test (attacks, defence, damage resistance, tests through the test path), never spent, counted as Combat Pool dice for a clean miss (Core p. 86); no Dice Pools (Combat, Spell, Hacking, Control, Task) | Core pp. 86, 187 | `CORE_V923.threat` |
| Morale | PR dice vs 4 + casualties | withdraws at the PR's wound (1 L, 2 M, 3 S, 4 never); Willpower (4) to stay | Core p. 187 | `CORE_V923.morale`, `.moraleWound` |
| Recognition | Intelligence vs 10 − Public Awareness | the NPC's Etiquette vs (1,000 − rep) ÷ 50 (rep: career Karma, or a public rep) | Core p. 199 | `CORE_V923.recognition` |
| Haggling | the seller vs TN 4 | the seller vs the buyer's Willpower (cap kept, see below) | Core p. 184 | `CORE_V923.haggle` |
| Fencing | both vs 4, share 0–50% | each vs the other's Willpower + 2, share 10–50% | Core p. 188 | `CORE_V923.fence` |
| Interrogation | opposed | one-sided: vs the subject's Willpower | Core p. 73 | `CORE_V923.interrogation` |
| Edges and flaws at creation | ≤ 5 each, edges ≤ flaws | must come to 0 | Companion p. 21 | `CORE_V923.qualities` |
| Eliminating a flaw | 2 Karma a point | 10 × its value | Companion p. 22 | `STREET.qualities.karma.flawPerPoint` 2 → 10 |

Kept (the owner's decisions)

- Timed training (`CHARACTERS_V58.training.mode` 'timed', the decision of 22 Oct 2026); the book's default is instant (training is the Companion's optional rule, p. 50). Only the days now follow the Companion's table.
- Availability tests in the shop (`SHOP_V91` finding before buying): the book has the source (fixer) roll its skill or Etiquette + 2 vs the Availability TN (Core p. 184).

Not built

- Team Karma Pool (Core p. 191, p. 47): a world pool the members feed from their own (for good), starting at 2, drawn on by vote, half lost when a member leaves. Needs a world store, a GM view and a "from the team pool" choice on every Karma button.
- Racism and Charisma (Core p. 182): 2D6−6 racism points against one or two races, added to social TNs, offset by a secret Charisma (2 × racism) test. Needs an NPC field, a GM roll, and an extra test before the social test; the attitude row "Prejudiced" and the metatype prejudice table (`TN_AUTO.social.prejudice`) stand in.
- The training self-test (Companion p. 50: skill vs new rating + 2 divides the time, none × 1.5) and the instructor's 2-successes-per-success help (p. 52).
- Gang/tribe and followers at creation (Core p. 44), a street dialect named automatically, group perception (Core p. 185), a group of NPCs' averaged ratings (Core p. 180), jumping by Strength and Body (Fields of Fire p. 76 with errata), swimming TNs (Cyberpirates), missed lifestyle payments (1D6 vs months missed, Core p. 190), selling a permanent lifestyle, contact fees, contact upkeep (Companion, optional), arranging a meet (Core p. 200).

Not changed

- Creation contact prices (`CHARACTERS_V58.creation.contactCost`, Level 3 ¥200,000): the Core has no Level 3 price (¥200,000 is the Followers price); the Companion reaches Level 3 only by paying upkeep (+3,000 and +7,000¥, p. 62, optional). Left as it is, with the other contact numbers.
- The haggling cap (`STREET.haggle.maxPercent` 25%): the book has none (Core p. 184), but the cap also bounds the price a chat card may claim when buying (without it a forged card could buy for 0).
- Street Cred and Notoriety (`STREET.reputation`, off by default): not SR2 (SR2's reputation is the Karma rep, now used by recognition).
- The Athletics default path: the Skill Web is the GM's; with `attributeDefault` 'web' a link "Quickness - Athletics: 1" gives the Companion's +2.

Existing worlds (migration 0.92.3, `src/module/notice923.ts`): on the first load after the update the lead GM gets one
whispered card, changing no data, that lists by reason the actors whose numbers change with the new defaults (racial
modifiers; Magic from Essence; Essence of housed ware, Awakened bioware and beta grade; condition status; Sensitive
System's Body Index; carrying; Threat-rated NPCs; Karma Pool growth; characters still in the creation wizard; weapons
saved holstered; shotguns not loaded with shot), each with the house rule that restores v0.92.2. A creation draft keeps
the priority table it was started with (a draft saved before v0.92.3 keeps the old table).

### Combat

Every switch is in `RULES.COMBAT_V923` (`src/module/rules/config923/combat.ts`; logic in `rules/combat923.ts`); its first
choice is the book's way, the second puts v0.92.2 back. Under the Unified Rules Revamp (`URR_V80.active`) a switch for
a rule the Revamp changes itself (`REVAMP_COMBAT_RULES`: rangedDefense, fullDefense, knockdown, blastStaging, scatter,
shotgun, tracers, reload, initiativeTies, subdueTn, spreadFire, delay, rangedRows) answers the v0.92.2 way, so the
Revamp's own rule decides as before; the other switches are book corrections the Revamp is silent on and act under
either source. Where the Revamp already had the book's procedure (`urr80-combat.ts`), the Book Rules go through the
same code.

| Rule | Was | Now (book) | Source | Switch |
|---|---|---|---|---|
| Attacker's staging | 'afterFirst': (net − 1) ÷ 2 | every 2 net successes one level (ranged, melee, combat spells) | Core pp. 91, 101, 110 | `ATTACK_STAGING` 'afterFirst' → 'all' |
| Ranged defense | a Combat Pool dodge vs the attack's TN, then the soak on its own | no dodge; pool dice in the resistance test (Body + pool vs Power − armor); attack vs resistance successes, 2 net either way = 1 level, tie = base; clean miss when the pool's successes alone beat the attack's | Core pp. 87, 91; Dice Pools p. 84; Ka-Ge 7 Q4 | `COMBAT_V923.rangedDefense` 'book' / 'dodge' |
| Melee tie | nobody hurt | the attacker, base damage | Core pp. 100–101 | `COMBAT.melee.tie` 'none' → 'attacker' |
| Full defense | + Quickness dice, pool on the melee test, −10 initiative out of turn | no extra dice, no pool on the melee test, pool to the resistance test, clean miss on the pool's successes alone; no initiative cost | Core p. 102 | `COMBAT_V923.fullDefense` 'book' / 'dice' |
| Combat Pool refresh | each Combat Turn | at the start of each of the character's actions; leftovers last until the first action of the next Combat Turn (other pools: still each Combat Turn) | Core pp. 78, 84 | `COMBAT_V923.poolRefresh` 'action' / 'turn' |
| Knockdown | Power > Body; Body vs the soak TN; 0 = prone | every damaging hit; Body vs ½ Power (gel: Power; melee: the attacker's Strength); more than L 1 / M 2 / S 3 stays up, some successes stagger 1 m, none or Deadly = down | Core pp. 92, 102 | `COMBAT_V923.knockdown` 'book' / 'old' |
| Blast staging | successes only cut the scatter | each target's resistance successes vs the attack's, 2 net either way = 1 level | Core p. 97 | `COMBAT_V923.blastStaging` 'book' / 'off' |
| Scatter per success | 2 m for all; rockets by range band | standard 2 m, aerodynamic and launcher 4 m; rockets and missiles 2D6, as a launcher (4 m), missiles also − Intelligence m | Core pp. 97, 99 | `COMBAT_V923.scatter` 'book' / 'old' |
| AP rocket falloff | −0.5 per m | −1 per ½ m | Core p. 99 | `COMBAT.grenades` apRocket perMetre 0.5 → 2 |
| AV rocket falloff (v0.92.4, the owner's decision) | −1 per 4 m | −8 per m | Core p. 99 | `COMBAT.grenades` avRocket perMetre 0.25 → 8; `COMBAT_V923.avRocket` book / old |
| Shotguns | every shotgun spreads; width distance ÷ choke, −1 Power per metre | slug unless loaded with shot ('shot' ammo, flechette rules); 1 m, then 2, 4, 6… m every choke metres, −1 Power and −1 TN per widening; choke 2–10; shot: smartlink −1, no goggles or laser | Core p. 95 | `COMBAT_V923.shotgun` 'book' / 'old' |
| Tracers | −1 per earlier burst, to −3 | full auto only, −1 per 3 rounds beyond short range, none for a smartgun user, no Power from them | Fields of Fire | `COMBAT_V923.tracers` 'book' / 'old' |
| Cylinder / internal magazine reload | 2 rounds per action | Quickness rounds per Complex Action (break action 2) | Core p. 95 | `COMBAT_V923.reload` 'book' / 'old' |
| Initiative ties | Reaction, then Quickness | adjusted Reaction, then natural Reaction | Core p. 79 | `COMBAT_V923.initiativeTies` 'book' / 'quickness' |
| Wounds and initiative | also a mid-turn drop | at the roll only | Core p. 112 | `INITIATIVE_WOUNDS.midTurn` true → false |
| Delayed action | lost at the end of the pass | lasts through the Combat Turn and into the next; pool dice used while delaying break it | Core pp. 80, 84 | `DELAY.lostAtPassEnd` true → false; `COMBAT_V923.delay` 'book' / 'turn' |
| Surprise | — | an ambusher waiting on a delayed action rolls at TN − 2 | Core p. 86 | `COMBAT_V923.ambush` 'book' / 'off' |
| Ranged modifiers | not in the Book list | target running +2, stationary −1, attacker in melee +2 per opponent, walking / running on difficult ground +2 / +6, smart goggles −1 | Core p. 89 | `SITUATIONAL_MODIFIERS` rows; `COMBAT_V923.rangedRows` |
| Melee visibility | full ranged values | half, rounded down, except full darkness | Core p. 102 | `COMBAT_V923.meleeVisibility` 'half' / 'full' |
| Subduing | no TN change | +2 TN | Core p. 103 | `COMBAT_V923.subdueTn` 0 → 2 |
| Several melee targets | ranged only | +2 per other target this phase | Core p. 102 | `COMBAT_V923.meleeTargets` 'book' / 'off' |
| Friends in melee | attacker's friends −1 each | both sides counted: more −1 per friend more (max −4), fewer +1 per friend fewer (max +4) | Core p. 102 | `COMBAT_V923.friends` 'book' / 'old' |
| Full auto at several targets | extra-target TN 0; rounds wasted with any gun | +2 per new target (2nd +2, 3rd +4); a smartlinked smartgun wastes no rounds | Core p. 93 | `COMBAT_V923.spreadFire` 'book' / 'old' |
| Flechette vs armor | higher of B and I, doubled | higher of 2 × Impact and Ballistic | Core p. 93 | `COMBAT_V923.flechette` 'book' / 'double' |
| Firing through a barrier | rating adds to armor | also: double vs flechette and explosive; rated above the Power stops the shot | Core pp. 93, 98 | `COMBAT_V923.barriers` 'book' / 'old' |
| Short bursts | too few rounds can't fire | 2 rounds: +2 Power, no level (2 rounds' recoil); 1 round: a single shot | Core p. 92 | `COMBAT_V923.shortBurst` 'book' / 'off' |
| Second firearm | smartlink, goggles, laser still count | they don't | Core p. 90 | `COMBAT_V923.secondFirearm` 'book' / 'off' |
| Called shots | any mode; armor-gap option | SS/SA/BF only; +1 level or a vehicle part | Core p. 92 | `COMBAT_V923.calledShot` 'book' / 'old' |
| Take Aim cap | half the skill, at least 1 | half the skill, rounded down | Core p. 82 | `COMBAT_V923.aim` 'book' / 'old' |
| Demolitions | Demolitions vs 4 | vs 2 | Core p. 98 | `COMBAT.demolitions.tn` 4 → 2 |
| Readying a weapon | always ready | a Simple Action first | Core p. 82 | `COMBAT.ready.rule` 'off' → 'action' |
| Heavy weapon templates | LMG heavy, shotgun not | shotgun heavy, LMG not (MMG, HMG, shotguns) | Core p. 89 | weapon templates `heavy` |

Kept (the owner's decisions):
- Grenade long-range TN stays 6 (the owner's decision, 12 Nov 2026): the Core prints 8, which a FASA staff ruling calls a misprint for 6.

Not built:
- Interception (Core p. 83): a free melee attack on anyone passing within 1 m; needs movement tracking.
- Stray shots (Core p. 93, optional).
- Suppressive fire as in Fields of Fire (rounds per metre for 10 phases, rounds-fired dice vs 4 + cover).
- Laser sight cancelled by mist, smoke, fog or rain (Core p. 90); the Attack dialog's tick can be cleared.
- A second firearm's shared recoil (Core p. 90); a multi-phase aim lost to pool dice (Core p. 82).
- Explosive-round misfire on all ones (Core p. 93).
- Shotgun shot: +1 resistance die per other target in front (Core p. 95).
- Subduing: Stun weapons only, the maintenance test (Core p. 103).
- Knockback into a wall (+2 TN until free, Core p. 102).
- Blast in a confined space: the rebounding wave's Power in full per target (Core p. 98); the nearest-wall approximation stays.
- Quick draw as a Reaction (4) test (Core p. 82); surprise: no actions at all for 10 phases when out-rolled by everyone (Core p. 86).
- Reaction 0 or less from wounds means no actions (Core p. 112).
- The other Dice Pools at each action (Core p. 84 refreshes all of them at the start of each action): only the Combat
  Pool follows `COMBAT_V923.poolRefresh`; the Spell, Hacking, Control and Task Pools still refresh each Combat Turn
  (Rigger 2 keeps the Control Pool per Combat Turn; per-action Spell Pool would also wipe allotted spell defense dice).

Readying a weapon (`COMBAT.ready.rule` 'action'): an attack with a weapon not yet drawn spends the Simple Action to
draw it itself instead of refusing, so weapons saved holstered by a v0.92.2 world still fire.

### Damage, health and hazards

Switches in `RULES.HEALTH_V923` (`rules/config923/health.ts`, helpers in `rules/health923.ts`); the first choice is the book's way (the default), the other puts the v0.92.2 behaviour back. Where the Unified Rules Revamp already had the same rule as a switch (`URR_V80.hs…`, `magLossLe`), the Revamp's switch still decides under the Revamp source; the `HEALTH_V923` switch gives the Book Rules the book's way.

| Rule | Was | Now (book) | Source | Switch |
| --- | --- | --- | --- | --- |
| Stun overflow | 2 Stun boxes to a Physical box | box for box | Core p. 111 | `STUN_OVERFLOW_PER_PHYSICAL_BOX` 2 → 1 |
| Death | dead when the Overflow reaches the total (augmented) Body | dead only when the Overflow is more than the natural Body (Will to Live still adds boxes); the sheet's Overflow row follows | Core p. 111 | `HEALTH_V923.death` 'natural' / 'total' |
| Natural healing Body | the augmented Body | the natural Body only (cyberware doesn't help) for the Physical healing test | Core p. 112 | `HEALTH_V923.healingBody` 'natural' / 'total' |
| Bleeding out | 1 box every (Body) Combat Turns | 1 box every 10 minutes unattended | Core pp. 111, 115 | `HEALTH_V923.bleed` 'tenMinutes' / 'bodyTurns' (`bleedMinutes` 10) |
| Stun recovery | Body vs 2/4/6/8 by wound, care rows, home lifestyle, hospital fee | the higher of Body and Willpower vs 2 + the injury modifiers (Stun and Physical); no care, no fee | Core p. 112 | `HEALTH_V923.stunRecovery` 'book' / 'old' (`stunRecoveryTn` 2) |
| First aid effect | 1 box per success, at most half | any success lowers the wound one level (to the next level's lowest box; Light clears); a Deadly wound only stabilised | Core p. 115 | `HEALTH_V923.firstAid` 'level' / 'boxes' |
| First aid on Stun | allowed | Physical only (the dialog offers Physical only) | Core p. 115 | `HEALTH_V923.firstAidStun` 'physical' / 'both' |
| First aid time | not shown | the card gives 10/20/30 minutes ÷ successes | Core p. 115 | `HEALTH_V923.firstAidTime` 'shown' / 'hidden' |
| Self-stabilisation | none | failed first aid on the dying: natural Body vs 10 | Core p. 115 | `HEALTH_V923.selfStabilise` 'test' / 'none' |
| Professional help | once per wound | a healer with a higher Biotech may try again | Core p. 115 | `HEALTH_V923.firstAidRetry` 'better' / 'once' |
| Trauma patch | stabilises outright | natural Body vs 4 + dermal armor / blood filter rating | Core p. 115 | `HEALTH_V923.traumaPatch` 'bodyTest' / 'stabilise' |
| Permanent damage | none | a Deadly wound: Body (4) test (dermal armor adds dice, +2 after a trauma patch); 0 successes an attribute point (1D6), 1 a limb or eye (1D6); the damage card has the button, the GM applies the loss | Core p. 114 | `HEALTH_V923.permanentDamage` 'test' / 'none' |
| Magic loss roll | 2D6 below Magic | 2D6 at or below Magic | Core p. 115 | `HEALTH_V923.magicLoss` 'atOrBelow' / 'below' |
| Magic loss triggers | a Deadly wound | also treatment without the magician +2 (twice for a Deadly wound) | Core p. 115 | `HEALTH_V923.magicLossUntreated` 'test' / 'none' |
| Magic loss after surgery | none | drastic invasive surgery (1+ Essence; bioware over 1.5 Body Index) posts a Magic loss card for after healing | Core p. 114; Shadowtech pp. 5–13 | `HEALTH_V923.surgeryMagicLoss` 'drastic' / 'none' |
| Surgery wound bands (rule off by default) | ≤0.5 L, 1.5 M, 3 S, more D | cyberware: ≤0.4 Essence M, under 1 S, 1+ D; bioware: ≤0.25 Body Index L, 0.75 M, 1.5 S, more D (Book Rules only; the Revamp keeps its patched table) | Core p. 114; Shadowtech pp. 5–13 | `HEALTH_V923.surgeryBands` 'book' / 'table' |
| Treat TN | 10 − Essence | 8 − Essence (Heal stays 10 − Essence) | Core p. 155; SRII errata | `HEALTH_V923.treatTn` 'book' / 'same' |
| Treat after an hour | a warning | refused | Core p. 155 | `MAGIC_V56.healing.treatBlock` false → true |
| Body Index and healing | +½ Body Index on first aid and natural healing, not on spells | on magical healing only | Shadowtech pp. 5–13; Ka-Ge 12 Q2 | `HEALTH_V923.bodyIndexHealing` 'magical' / 'natural' |
| Healing spells on Stun | a heal spell may target Stun | refused | Core p. 112 | `HEALTH_V923.spellsHealStun` 'no' / 'yes' |
| Falling | Power = metres, Serious, ½ impact | Deadly, Power ½ the metres, ½ impact; an Athletics test vs the metres takes 1 Power per success | Fields of Fire p. 76 | `HEALTH_V923.falling` 'book' / 'old' |
| Holding breath | none | 30 s per point of Body before drowning or suffocation counts | Fields of Fire p. 76 | `HEALTH_V923.breathHold` 'body' / 'none' (`breathSecondsPerBody` 30) |
| Drowning, suffocation | Body vs 4 +1 a turn, Moderate Stun | 1 unresisted Stun box an action phase (the passes from the combat's initiative, else 1), past the track onto Physical | Cyberpirates (drowning) | `HEALTH_V923.drowning` 'boxes' / 'test' |
| Burning clothes | the "on fire" hazard (6M) each turn | 6M at the end of the first turn, +2 Power each turn after | Grimoire p. 113 | `HEALTH_V923.burning` 'rising' / 'flat' |
| Shock weapons | Stun vs ½ impact only | the hit also disorients: Body or Willpower (higher) vs 4; +2 to every TN for Power − ½ impact − successes Combat Turns (an effect on the target) | Core p. 103 | `HEALTH_V923.shock` 'disorient' / 'none' |
| Low Pain Tolerance | +1 box on each damaged track | the wound counts one level higher (at most Serious) | Shadowrun Companion | `HEALTH_V923.lowPainTolerance` 'level' / 'boxes' |
| Sensitive System | Body Index × 1; rejection tests always | Body Index × 2; no rejection rule of its own | Shadowrun Companion | `HEALTH_V72.qualities.sensitiveSystem.bodyIndexMultiplier` 1 → 2 (now in the window), `rejectionAlways` true → false |
| Dwarf resistance | +2 dice vs toxins and disease | vs disease only | Core Racial Modifications Table | `HEALTH_V923.dwarfResistance` 'disease' / 'both' |
| Respirator | + rating dice vs inhaled toxins | its own air: immune | Core p. 244 | `HEALTH_V923.respirator` 'immune' / 'dice' |
| Toxins: still exposed | resisted once | the exposure card has a GM button to resist again (a fresh card, onset from now) | Core p. 186 | (a GM button) |
| Addiction: dose interval | withdrawal after 24 h | Body × 4 h (physical), Willpower × 4 h (mental) | Shadowtech p. 87 | `HEALTH_V923.addiction` 'book' / 'old' |
| Addiction: withdrawal | +2 to every test | forced +3 (+6 on magical tests) and the pain of a persistent Moderate Stun wound (its +2 when the Stun track's own is less) | Shadowtech p. 88 | `HEALTH_V923.addiction` |
| Addiction: kicking it | after 14 days clean, Willpower vs the rating | any time (the GM's call): Willpower vs the rating +1 (mental) / +3 (physical); then recovery at +2 (+4 magical) while the rating falls 1 every 3 days; over at the base rating; a dose meanwhile is a relapse (+1) | Shadowtech p. 88 | `HEALTH_V923.addiction` |
| Addiction: ratings | +1 TN per dose in the last 7 days; tolerance −1 bonus per 5 doses | every Strength-rating doses +1 to the character's Addiction and Tolerance; −1 per (30 − Strength) clean days; a Tolerance test (Body vs the Tolerance rating) after a dose, no successes = immune for good. Drugs have new Tolerance and Strength fields (0 = none) | Shadowtech pp. 87–88 | `HEALTH_V923.addiction` |

Kept (the owner's decisions): the allergy severity levels (Moderate counts as Mild; not changed here).

Not built:
- Reaction cut to 0 by wounds = no actions that turn (Core p. 112): a hook in the initiative roll and the turn's actions.
- Interrupted Stun rest (re-test, never better than the first roll; Core p. 112): a rest-in-progress clock.
- The minimum lifestyle while healing (Core p. 113; the penalties are the GM's): a lifestyle check in the Rest dialog.
- Paramedic and doctor fees (Medical Costs Table): who treats, and billing first aid and rest.
- Replacement parts (Core p. 114) and the stabilization unit (Core gear): body part items, grades and failure chances.
- The healing spells' sustained time and the split of successes between boxes and time (Core p. 155).
- The antidote as professional attention on a Deadly toxin wound; dermal armor and blood filtration against patches other than the trauma patch (Core p. 250); the stim patch's Magic test (Awakenings).
- The nephritic screen's −1 Power against blood-borne toxins and pathogens; the trauma damper moving a Physical box to Stun; the pain editor's −1 Intelligence and Stun that can't knock out (Shadowtech).
- Addiction: the tests after the effects wear off (rolled at the dose), a drug both physically and mentally addictive, the rest period after recovery, the 24-hour fall during forced withdrawal, and the weekly loss of ½ Essence and a box of each track (Shadowtech pp. 87–88).
- Radiation by rads (Bug City pp. 134–135): a Body test every 100 rads vs rads ÷ 50, sickness by peak rads as Stun with seven clean days in a row, direct burns each Combat Turn; needs the dose kept in rads, a new sickness model and the burn test.
- Treading water and floating (Cyberpirates); the Companion's optional sprint fatigue; over-damage (Fields of Fire, Companion); DocWagon's response time roll (Neo-Anarchist's Guide p. 95), HTR and extended-care discounts (Core p. 250); the medkit's advice and antidote making; Neuro-stun's hour of disorientation.

### Sorcery

v0.92.3 book alignment. Switches in `RULES.SORCERY_V923` (`src/module/rules/config923/sorcery.ts`); pure functions in
`src/module/rules/sorcery923.ts`. Each switch's first choice (`book`, or the number shown) is the default; `v922` (or 0)
puts the v0.92.2 behaviour back. Where the Unified Rules Revamp has its own switch for the same rule, its source patch
already gives the book's way, so the Revamp's results are unchanged; where the Revamp's own rule differs from the book
(`URR_V80.coreEssenceFloor`, `magWardDrain`, `magWardMaxForce`, the Revamp's exclusive/fetish rows) the Revamp's rule
still wins while it is on. This section is the one place for initiation, ordeals, centering, shielding, dispelling,
geasa and wards (the spirits alignment built the same rules; they were merged here). Elementals' aid is here; their
sustaining is in the spirits section (`SPIRITS_V923.elementalSustain`).

| Rule | Was | Now (book) | Source | Switch |
|---|---|---|---|---|
| Magic after Essence loss | Magic capped at Essence rounded up | Magic falls by every point or part of Essence lost (Essence 3.75 → Magic 3; a datajack on Magic 1 → 0) | Core p. 47; Ka-Ge 7 Q21 | `SORCERY_V923.magicFromEssence` |
| Tie on a resisted spell | no effect | the caster wins at the spell's minimum effect (base Damage Level); spells with no minimum effect still need a net success | Core p. 131 | `SORCERY_V923.spellTie` |
| All ones on the casting test | no Drain effect | Drain TN +2 | Core p. 131 | `SORCERY_V923.ruleOfOneDrain` (2; 0 = old) |
| Exclusive and fetish spells | Drain TN −2 / −1 | effect at Force +2 (exclusive), +1 (reusable fetish), +2 (expendable fetish, new spell field `fetishExpendable`); Drain at the normal Force, no TN change; no exclusive spell of any duration while others are sustained | Core pp. 128, 133; Grimoire p. 111 | `SORCERY_V923.restrictedSpells` |
| Spells sustained at once | no limit | at most the Sorcery rating (foci, quickened and elemental-held spells don't count) | Core p. 128 | `SORCERY_V923.sustainCap` |
| Sustaining while projecting | allowed | a sustained spell can't be cast while projecting; the magician's own sustained spells drop when projection starts | Core p. 128 | `SORCERY_V923.sustainProjecting` |
| Visibility and cover on spells | visibility on elemental spells only, no cover | visibility on every spell (`TN_AUTO.magic.environment` 'elemental' read as 'all') and partial cover; touch spells only injury | Core pp. 129–131 | `SORCERY_V923.spellSituation` |
| Area spell test | one test vs the highest target's TN | one roll; the card rolls at the lowest target's TN and each target's Resist counts the dice against its own TN | Core p. 130 | `SORCERY_V923.areaTargets` |
| Ranged damaging manipulation TN | the spell item's TN | base TN 4 (+ situation modifiers) | Core p. 130; Grimoire p. 112 | `SORCERY_V923.elementalTn` (4; 0 = old) |
| Learning test | Sorcery vs Force | Sorcery + Magical Theory vs 2 × Force | Core p. 132 | `SORCERY_V923.learning` |
| Learning from a formula with no teacher | no penalty | +2 TN | Grimoire p. 114 | `SORCERY_V923.formulaAloneTn` (2; 0 = old) |
| Spell design test | Sorcery + site dice vs Force, Force days ÷ successes | Magical Theory (at most the library/lodge rating, + 1 die per 2 points it is higher, +50% time) vs 2 × Force − Magic + drain modifiers; base time L 6 / M 18 / S 30 / D 60 days ÷ successes | Grimoire p. 115 | `SORCERY_V923.design` |
| Spell design drain | detection base L; area +1 TN; sustained 0; touch −1 TN | detection base M; area +1 level; touch −1 TN and −1 level; sustained detection/health/illusion +1 TN | Grimoire pp. 117–121 | `SORCERY_V923.design` |
| Spell focus dice | casting only | specific focus: casting and Drain; category focus: casting, Drain and resisting that category | Core p. 137 | `SORCERY_V923.spellFocus` |
| Spell lock | holds Force ≤ its rating | holds one spell of any Force | Core p. 138 | `SORCERY_V923.spellLock` |
| Weapon focus bonding | 4 (small) / 5 (large) × rating | 6 × rating | Grimoire p. 27 (supersedes Core p. 137) | `SORCERY_V923.weaponFocusKarma` (6; 0 = old) |
| Focus addiction | Willpower vs total; fail = +2 TN withdrawal | Magic vs total; failed, 2D6 ≤ Magic loses 1 Magic (not at Magic 1); 2 lost → the focus geas (+2 TN without a focus) | Awakenings p. 103 | `SORCERY_V923.focusAddiction` |
| Making a focus | TN 5, 7 days | TN specific spell 4, category 6, spirit 6, power 8, weapon 6, + rating; spell lock 5; 30 days ÷ successes | Grimoire pp. 25–26 | `SORCERY_V923.enchanting`, `enchantTn`, `enchantDays` |
| Ritual team dice | leader + ½ each member's Sorcery | the other members' Magic Pools join the leader's (not the spotter's) | Core p. 135 | `SORCERY_V923.ritualPool` |
| Ritual team limits | none | no combat spells; at most the lowest Sorcery in members; a mage needs a hermetic circle | Core p. 135 | `SORCERY_V923.ritualTeam` |
| Ritual materials | none (per-Force row 0) | detection and illusion 100¥, health 500¥, manipulation 1,000¥ × Force | Core p. 135 | `SORCERY_V923.ritualMaterials` |
| Ritual resistance TN | Force | the higher of Force and the leader's Sorcery | Core p. 136 | `SORCERY_V923.ritualResist` |
| Ritual spotter | no Drain | resists Drain | Core p. 135 | `SORCERY_V923.ritualSpotter` |
| Wards | Conjuring vs Force, Force h ÷ successes, Drain F/2 M | Sorcery vs Force, Force hours, lasting days = successes (shown on the card), Drain (Force × successes) L Stun, never Physical, Force ≤ 2 × the magician's Magic | Grimoire p. 92; Grimoire II errata | `SORCERY_V923.ward` |
| Ward materials | 0¥ | 1,000¥ per Force | Grimoire p. 92 | `MAGIC_V56.ward.nuyenPerForce` 0 → 1000 |
| Libraries and circles | price × rating, a day per rating | library rating² × its price, a circle an hour per rating | Core pp. 123–124 | `SORCERY_V923.siteCost` |
| Initiation grades | the first initiation is grade 1 (+1 Magic, (6 + 1) × 3), Karma rounded up | the first is Grade 0 (stored as grade 0 with the `initiated` flag): (6 + 0) × 3 = 18 Karma, Karma always rounded down, no Magic; the next is Grade 1. A stored grade keeps its meaning: a character initiated before v0.92.3 keeps its grade and Magic | Grimoire pp. 37–38 | `SORCERY_V923.initiation` |
| Initiation ordeal | −1 off the multiplier | −0.5 | Grimoire p. 38 | `OCCULT.initiation.ordealReduction` 1 → 0.5 |
| Dispelling | Sorcery vs Force; −1 spell success per success; Drain M at F/2 | only Force ≤ grade; TN the higher of Force and quickening Karma; −1 Force per 2 successes (0 = broken); Drain as the spell's own drain code | Grimoire p. 45 | `SORCERY_V923.dispelling` |
| Shielding | + grade dice | a shielding initiate's spell defense (and grade) dice also raise the caster's TN by as many | Grimoire p. 45 | `SORCERY_V923.shielding` |
| Centering | automatic: grade points off penalties | always a test at the TN less the grade; every 2 successes take 1 off the penalties, no grade cap | Grimoire pp. 43–44 | `SORCERY_V923.centering` |
| Geasa | an unmet geas takes away the Magic it protects | a broken geas adds +2 TN per geas to non-astral magical tests and to every Drain test (spells, conjuring, wards, dispelling); no Magic lost | Grimoire p. 52 | `SORCERY_V923.geasa` |
| Elemental aid | + full Force every cast, a service each time | an auxiliary pool of Force dice: each die used lowers what is left; one service when it starts; at 0 it vanishes | Core p. 141 | `SORCERY_V923.elementalAid` |
| Detection spell range | Magic × Force metres | a separate Force test vs 4 (+ injury): successes × Magic metres | Core p. 128 | `SORCERY_V923.detectionRange` |
| Increase Reflexes and cyber | the better of spell and ware counts | no effect on anyone with cybernetic initiative dice | Core p. 155 | `SORCERY_V923.increaseReflexes` |

Kept (the owner's decisions)
- Spellcasting dice: the test rolls the Sorcery skill's (or concentration's / specialization's) rating (`MAGIC_V920`); the book rolls the spell's Force + Magic Pool (Core pp. 128–131).
- The layered Magic Pool (`MAGIC_V920.poolLayers`); the book resizes the whole pool to the rating in use for the action (Awakenings p. 95).
- Spell formulas and teachers (`FORMULA_V918`): the teacher's fee (`feePerForce`; the book: typically 1,000¥ × Force + living expenses, Core p. 132), the teacher's help (successes as dice; the book: Teaching vs Force − the pupil's Intelligence, min 2, successes lower the pupil's TN), the formula price (`nuyenPerForce`, `combatFactor`; the book: L 50 / M 100 / S 500 / D 1,000¥ × Force) and the other tradition's penalty (`foreign`; the book: +2 on translating the formula, Grimoire p. 115). The learning test itself (2 × Force, Magical Theory, +2 with a formula and no teacher) follows the book on top of these.

Not built
- Defaulting magical skills (Awakenings p. 93); circle/lodge +1 TN per 2 rating for spells cast inside another's circle or lodge (needs circles placed on the map); shaping an area by withheld dice, splitting Force over targets, spell stacking (Core pp. 129–130); noticing spellcasting (Core p. 132); elemental secondary effects in full (Grimoire pp. 113–114); the active foci limit (Intelligence); Heal/Treat successes split with time; the Armor spell's ½ successes; a Drain-code table for the importer; an elemental bound to a spell for days (sustaining by Combat Turns is the spirits section's); quickening's sustain test, second Drain and extra Karma; anchoring's Karma and test; masking's success threshold; the ritual's link and sending times; totem dice as Magic Pool dice; a ward ending when its days run out (the card states them); the geas due for every 2 Magic lost; centering for spellcasting or Drain.

### Conjuring, spirits, astral, initiation, adepts, allies and critters (v0.92.3)

Switches in `RULES.SPIRITS_V923` (`rules/config923/spirits.ts`, house-rules window: Magic and critters); the pure functions are `rules/spirits923.ts`. Initiation (Grade 0, the ordeal's 0.5, the Karma rounding), centering, shielding, dispelling, geasa and wards are one rule each in the Sorcery section (`RULES.SORCERY_V923`); `rules/__tests__/spirits922.ts` puts those back too. The first choice is the book's way (the default); the other puts v0.92.2 back. `rules/__tests__/spirits922.ts` lists every v0.92.2 value.

| Rule | Was | Now (book) | Source | Switch |
|---|---|---|---|---|
| Conjuring Drain level | L ≤ ½ Cha, M ≤ Cha, S ≤ 1.5 × Cha, else D | L < ½ Cha, M ≤ Cha, S > Cha, D > 2 × Cha | Core p. 140 | `SPIRITS_V923.conjDrain` |
| Conjuring Drain type | Physical when Force > Magic | Physical when Force > Charisma (S and D) | Core p. 140 | `SPIRITS_V923.conjDrain` |
| Totem and spirit-focus dice on conjuring Drain | not added | added to Charisma | Core pp. 139–140 | `SPIRITS_V923.conjDrainDice` |
| Nature spirit outside its domain | warned | refused (also checked when summoning) | Core p. 139 | `MAGIC_V39.domains.enforce` warn → block |
| A manifest spirit's immunity | every non-magical attack | firearms, other ranged weapons, crossbows, explosions; not melee, bows, thrown weapons | Core p. 142 | `SPIRITS_V923.immunityScope` |
| A mundane weapon against a manifest spirit | skill + Combat Pool | Willpower, no Combat Pool (not with a focus, killing hands or a vulnerability) | Core p. 142 | `SPIRITS_V923.mundaneVsSpirits` |
| Resisting a spirit's attack | Body | Conjuring instead, when higher | Core p. 143 | `SPIRITS_V923.conjuringDefense` |
| Banishing: Force lost | 1 per net success | 1 per 2 net successes | Core p. 143 | `SPIRITS_V923.banishPerPoint` 1 → 2 |
| Banishing: the spirit wins | nothing | banisher −1 Magic per 2 net successes (flag `banishMagic`) | Core p. 143 | `SPIRITS_V923.banishBackfire` |
| Banishing Drain | conjuring Drain at Force | none (a control contest keeps its Drain) | Core p. 143 | `SPIRITS_V923.banishDrain` |
| Lost Force and Magic | for good | back at 1 point an hour (world time) | Core p. 143 | `SPIRITS_V923.banishRecovery` |
| Summoner and banishing | another's summoner adds Conjuring successes | your own spirit: + Charisma dice; no summoner help | Core p. 143 | `SPIRITS_V923.banishSummoner` |
| Control contest | banishing-style, net = services | challenger vs Force + 2 against the holder's Conjuring vs Force, services kept, the losing holder drains; uncontrolled: 2 net = 1 service | Core p. 143 | `SPIRITS_V923.controlContest` |
| Binding by a true name | opposed, net = services, Force × Karma | Conjuring vs Force + Spirit Energy, 1 success binds, no Karma | Grimoire pp. 78–79 | `SPIRITS_V923.trueName` |
| Spirit attributes | Force + typed offsets | the Spirit Table's offsets and Reaction for a spirit with no template | Core p. 144 | `SPIRITS_V923.spiritTable` |
| Elemental sustaining a spell | Force hours | Force Combat Turns | Core p. 142 | `SPIRITS_V923.elementalSustain` |
| Projection | 2 × Essence hours free, then 1 Essence per hour or part | 1 Essence every full hour from the start, a temporary loss (back at 1 a minute after the return; below 0 the magician dies; nothing is written to the character) | Core pp. 146–147 | `SPIRITS_V923.projection` |
| Projecting initiative | astral Reaction + 20 | astral Reaction + 15 | Core p. 147 | `ASTRAL.initiativeBonus` 20 → 15 |
| Initiates in astral space | nothing | + grade to astral Reaction and to the Astral Combat Pool | Grimoire pp. 38, 91 | `SPIRITS_V923.astralGrade` |
| Astral dice pool | Spell Pool | Astral Combat Pool (I + W + C) ÷ 2 (the Combat Pool's dice while projecting; a magician who only perceives fights astrally with the physical Combat Pool, as before) | Core p. 147 | `SPIRITS_V923.astralPool` |
| A magician's astral damage | (Cha)M, a focus adds dice | unarmed (Cha)L; weapon focus (Cha + rating ÷ 2)M | Core p. 147 | `SPIRITS_V923.astralDamage` |
| A barrier that wins | nothing | (rating)L, +1 level per 2 net successes, astral Body | Core p. 148 | `SPIRITS_V923.barrierBacklash` |
| Reading an aura | 1: health, mood, foci; 2: compare; 3: exact Essence and Magic | basics at a glance; 2: emotions; 4: cyberware; never exact numbers | Core p. 145; Grimoire p. 90 | `SPIRITS_V923.assensing` |
| Astral tracking | 6 h ÷ successes, no Force modifier | 12 h ÷ successes; −2 TN Force ≤ Sorcery, +2 over | Core p. 149 | `TRACKING.baseHours` 6 → 12; `SPIRITS_V923.tracking` |
| Asceticism | any attribute | a Physical attribute | Grimoire p. 40 | `SPIRITS_V923.asceticism` |
| Ally cost | Force × 1 Good Karma | 5 × the current Force per point above 1 + the design's Karma; 1 Magic point (none for the familiar ordeal); Force ÷ successes days; (Force + day)L Stun each day | Grimoire pp. 40, 67–71 | `SPIRITS_V923.allyCost` |
| Regeneration | always heals | a Deadly wound calls for 1D6, a 1 kills (2 from fire or explosions: the GM's call) | Core p. 219 | `SPIRITS_V923.regenDeath` |

**Kept (the owner's decisions):** none in this area. Killing Hands (L/M/S/D at .5/1/2/4) already matches Core p. 126.

**Not built:** an elemental's day of waiting costing a service (Core p. 141); Aid Sorcery as a non-refreshing pool split over tests and spell defense (Core p. 141); an elemental bound to a spell for Force days (Core p. 142); tech melee enhancements doing only base damage against spirits (Awakenings p. 101); spirit against spirit, Force vs Force (Core p. 143); disruption for 28 − Force days (Grimoire p. 64); only a true-name holder banishing a free spirit (Grimoire p. 77); watchers summoned for hours, Force from successes, (Force × hours)L Drain (Grimoire p. 73); the ally design test (Grimoire pp. 70–71); invoking a great form by astral quest (Grimoire p. 64); Unarmed or Armed Combat in place of Sorcery in astral combat (Core p. 147); repeated assensing at +2 TN (Grimoire p. 90); masking by successes (Grimoire p. 46); quickening's sustaining test and second Drain (Grimoire p. 45); reflecting by shielding dice (Awakenings p. 99); cleansing limits and Drain (Awakenings p. 100); meditation's three tests, thesis as a formula, oath, familiar and geas-shedding details (Grimoire pp. 38–41); Distance Strike's double cost with Killing Hands (Awakenings p. 116); adept power costs by band in the importer (Core pp. 125–126); Confusion, Fear, Engulf as opposed tests (Predator and Prey); Essence drain as a feeding process (Core pp. 217–218); critter stat lines.

### The Matrix

Virtual Realities 2.0 (VR2) replaces the Core Rulebook's Matrix rules; the Core is used only where VR2 has no rule
(smoke, Matrix movement). Switches: `RULES.MATRIX_V923` (`rules/config923/matrix.ts`), logic in `rules/matrix923.ts`;
each switch's first choice is the book's way, the other puts v0.92.2 back. Values marked "(window)" are rows of the
house-rules window whose default moved.

| Rule | Was | Now (book) | Source | Switch |
|---|---|---|---|---|
| System test outcome | 1+ successes succeed | opposed: more successes than the host's Security Value roll (the host's successes still go on the tally) | VR2 p. 19 | `MATRIX_V923.systemTests` |
| Locate Paydata | a point per success | a point per net success | VR2 p. 115 | `MATRIX_V923.systemTests` |
| Locate File | a file per success | an interrogation: net successes add up, a file every 5 | VR2 p. 110 | `MATRIX_V923.operations`, `locateFileSuccesses` |
| Operations table | Analyze Host Simple; Analyze IC Simple; Decrypt ×3, Download, Upload, Edit File Complex; Graceful Logoff Simple; Validate on Access; Invalidate and Crash Host with no utility; Redirect with Relocate; Locate Slave with Browse; Null op Access/Simple; Make Comcall Slave; Tap Comcall Spoof | the System Operations Table (Analyze Host Complex, Analyze IC Free, Decrypt/Download/Upload/Edit Simple, Logoff Complex, Validate and Invalidate Control/Validate, Crash Host Control/Crash, Redirect Control/Camo, Locate Slave Index/Analyze, Null op Control/Deception Complex, Make Comcall Files/Commlink, Tap Comcall Commlink); new Relocate (spoof a trace) operation; new utility kinds camo, crash, commlink, scanner, defuse | VR2 p. 161 | `MATRIX_V923.operations` (`oldOperations`) |
| Passive alert | no effect | +2 to every subsystem rating (from passive on) | VR2 p. 61 | `MATRIX_V923.passiveAlert` 2 (0 = old) |
| Crashing IC | no tally | + the IC's rating on the attacker's tally (half as the book's option) | VR2 p. 40 | `MATRIX_V923.crashTally` |
| Host shutdown | 3 Combat Turns | 1D6 per 2 points (or part) of the Security Value | VR2 p. 53 | `MATRIX_V923.shutdown` |
| Matrix Reaction | Intelligence + 2/RI | the decker's own Reaction (no cyber/magic Reaction boosts) + 2/RI | VR2 p. 120 | `MATRIX_V923.initiative` |
| Response Increase cap | 3 | 3 and at most MPCP ÷ 4 (round down); warning on the deck | VR2 p. 87 | `MATRIX_V923.initiative` |
| Hot sim | +1 initiative die | one more RI level: +2 Reaction and +1D6 | VR2 p. 85 | `MATRIX_V923.initiative` |
| Tortoise speed | the user's own Reaction and dice | Reaction halved (min 1), RI gives only its dice | VR2 p. 85 | `MATRIX_V923.initiative` |
| IC initiative dice | 1/1/2/2/3 (Blue … Black) | 1/2/3/4 D6 Blue … Red (black as Red) | VR2 p. 120 | `MATRIX_V923.icInitiative` (`oldIcInitiativeDice`) |
| Party IC initiative | the best member's | each its own | VR2 p. 120 | `MATRIX.party.sharedInitiative` false (window) |
| Decker's attack dice | Computer + Hacking Pool | the offensive utility's rating + Hacking Pool | VR2 p. 123 | `MATRIX_V923.cybercombat` |
| Cybercombat TN | the IC's rating / the persona's Evasion | by code and status: Intruding 6/5/4/3, Legitimate 3/4/5/6 (IC, security deckers and validated passcodes are Legitimate) | VR2 p. 123 | `MATRIX_V923.cybercombat`, `attackTn` |
| IC attack dice | the rating | the host's Security Value | VR2 p. 40 | `MATRIX_V57.icAttackDice` 'securityValue' (window) |
| IC damage resistance | the rating | the host's Security Value | VR2 p. 40 | `MATRIX_V923.cybercombat` |
| IC maneuvers | the rating | the host's Security Value | VR2 p. 121 | `MATRIX_V923.cybercombat` |
| Party IC TN | none | + members on the party's attacks and on attacks on a member | VR2 p. 52 | `MATRIX_V923.cybercombat` |
| Crippler/ripper | rating vs the attribute, at least 1 on a hit | attack test (SV, code TN) opposed by the persona attribute vs the IC's rating; 1 point per 2 net; never below 1 | VR2 p. 41 | `MATRIX_V923.cybercombat`; `MATRIX.attributeDamage.minOnHit` 1 → 0 (new row) |
| Persona dodge | Hacking Pool dice | none | VR2 pp. 121–123 | `MATRIX.defense.persona` 'pool' → 'none' (window) |
| Attack and maneuver actions | Complex | Simple | VR2 pp. 121, 123 | `MATRIX_V923.actions` (`ACTIONS.costs.matrixAttack`, `matrixManeuver` keep the old costs) |
| IC damage level | the IC's own | by code: Blue/Green M, Orange/Red S | VR2 p. 123 | `MATRIX_V923.icDamageLevel` |
| Persona damage resistance | Bod vs Power − Hardening − Armor | Bod vs Power − Armor | VR2 p. 123 | `MATRIX_V923.iconHardening` |
| Simsense overload | Serious+, Willpower vs the Power | any white/gray IC damage on a hot deck: Willpower vs L 2/M 3/S 5, +2 DNI, −2 ICCM | VR2 p. 124 | `MATRIX_V923.overload` |
| Dump shock level | fixed M | by code: Blue L … Red D | VR2 p. 124 | `MATRIX_V57.dumpShock.levelBy` 'code' (window) |
| Dump shock type | Physical on hot sim | Stun | VR2 p. 124 | `MATRIX.sim.hot.dumpShockType` 'stun' (window) |
| Dump shock reductions | ICCM dice | a cool deck and an ICCM each −2 Power and −1 level | VR2 p. 124 | `MATRIX_V923.dumpShock` |
| Jacking out | free | without a Graceful Logoff it risks dump shock | VR2 p. 124 | `MATRIX_V923.dumpShock` |
| Black IC resistance | Willpower + Hacking Pool vs Power | Body (lethal) or Willpower (non-lethal) vs Power − Hardening, no Hacking Pool; the icon resists the same damage with its Bod (second button) | VR2 pp. 17, 47–48 | `MATRIX_V923.blackIc` |
| Cool deck vs lethal black IC | no change | acts as non-lethal (Stun) | VR2 p. 48 | `MATRIX.sim.cold.coldBlackIcStun` true (window) |
| Black IC hold | after any attack; Willpower + Hacking Pool vs rating | after a hit; Complex Action, Willpower vs rating, no Hacking Pool, ICCM −2 TN; the IC gets one more attack (noted) | VR2 pp. 47, 86 | `MATRIX_V923.blackIc` |
| ICCM | black IC → Stun, + rating dice | resists black IC with the better of Body or Willpower, no dice; jack-out −2 TN; dump shock and overload as above | VR2 p. 86 | `MATRIX.iccm.blackIcStun` false, `dicePerRating` 0 (window); `MATRIX_V923.blackIc` |
| Psychotropic IC | a test on every hit (+ Shield dice), rating days, cyberphobia +2 | the hit marks the decker; one Willpower (rating) test at jack-out or dump, −2 TN cool, no Hacking Pool; cyberphobia + the IC's rating; lasts until recovered (the GM clears it) | VR2 pp. 49–50 | `MATRIX_V923.psychotropic`; `MATRIX.psychotropic.shieldDice` false (window) |
| Blaster/Sparky Test | rating vs MPCP | vs MPCP + Hardening (sparky + 2) | VR2 pp. 43–44 | `MATRIX_V923.grayIc` |
| Sparky damage | Willpower vs rating, M Physical | Body vs rating − Hardening, M staged up a level per 2 Sparky successes | VR2 p. 44 | `MATRIX_V923.grayIc` |
| Deck repair | a repair test | gray IC damage is permanent: rebuild the part (its damage clears) | VR2 p. 43 | `MATRIX_V923.grayIc` |
| Probe IC | rolls when the GM acts | reactive: a Probe (rating) Test vs DF with every System Test | VR2 p. 42 | `MATRIX_V923.probe` |
| Trace hunt TN | Evasion | Trace Factor: Evasion − rating + Camo + redirects + jackpoint | VR2 p. 45 | `MATRIX_V923.trace` |
| Trace time | 10 ÷ net, round up | 10 ÷ successes, round down (min 1) | VR2 p. 46 | `MATRIX_V923.trace` |
| Trace outcome | dump / report / burn | report; the host's proactive IC −1 TN and +1 on each tally increase for the run | VR2 p. 46 | `MATRIX_V923.trace` |
| Trace vs jack-out | ends it | the datatrail stays 1D6 − 1 turns (min 1); a Graceful Logoff (TN + trace rating) stops it | VR2 pp. 46–47 | `MATRIX_V923.trace` |
| Redirect Datatrail | ends the trace | +1 Trace Factor per redirect for the run (the Trace IC formula and example add it) | VR2 pp. 45, 117 | `MATRIX_V923.trace` |
| Graceful Logoff | to the parent grid | leaves the Matrix, no dump shock, stops a trace | VR2 p. 114 | `MATRIX_V923.logoff` |
| Jackpoint | connection TN on every Matrix test | Access tests only: legal −2, illegal 0, satellite +2 (−2 Reaction), workstation −4, remote device +4, console halves Access and SV; Trace Factor modifiers | VR2 Grids and Hosts pp. 28–30 | `MATRIX_V923.connections`, `jackpoints` |
| Validated passcode | +2 to the host's detection TN | no effect on System Tests; Legitimate status in cybercombat | VR2 p. 123 | `MATRIX_V57.utilities.validate.dfBonus` 0 (window) |
| Grid travel | 1 Combat Turn a hop | instant | Core p. 177 | `MATRIX.travel.turnsPerHop` 0 (window) |
| I/O speed | Mp per Combat Turn | Mp per second (× 3 a turn; loading too) | VR2 pp. 86, 110 | `MATRIX.download.ioPerTurn` 1 → 3 (new row) |
| Armor utility wear | every hit it soaks | only when it fails to absorb the whole hit | VR2 p. 99 | `MATRIX_V923.armorWear` |
| Shield utility | soaks black IC damage | a parry: Shield rating vs the attacker's skill, −1 per use; adds to the opposed roll vs cripplers | VR2 p. 100 | `MATRIX_V923.shield` |
| Mirrors | + ½ rating to attacks on Evasion | no TN effect under the book's cybercombat (VR2: the Decoy operation) | VR2 p. 161 | `MATRIX_V923.cybercombat` |
| Smoke | + ½ rating TN, size × 1 | + rating TN, size × 2 | Core p. 175 | `MATRIX.utilities.smoke.tnPerRating` 1 (window), `MATRIX.utilitySize.kinds.smoke` 2 (new row) |
| Frame core size | dumb 3, smart 5 | dumb 2, smart 3 | VR2 p. 105 | `MATRIX.utilitySize.kinds.frame`, `.smart-frame` (new rows) |
| Frame dice | rating (+ ½ rating pool if smart) | dumb: the owner's Computer; smart: its rating | VR2 p. 104 | `MATRIX_V923.frames`; `MATRIX.frames.smartPoolPerRating` 0 (window) |
| Frame utilities | a count ≤ rating | combined ratings ≤ rating | VR2 p. 105 | `MATRIX_V923.frames` |
| Programming time | size × 1 day | size × 2 days | VR2 p. 100 | `MATRIX.programming.daysPerMp` 2 (window) |
| Deck part sizes | MPCP 2 × r², persona 2 × r, Hardening 4 × r, RI 7 × r | MPCP r² × 8; Bod/Evasion r² × 3; Masking/Sensors r² × 2; Hardening MPCP² × r (TN MPCP); RI MPCP² × 2r (TN 2r) | VR2 pp. 83–87 | `MATRIX_V923.deckBuilding` |
| Otaku | MPCP round down, Masking C, no Hardening, deck Reaction | MPCP and Masking round up, Hardening W ÷ 2, Reaction (I + W) ÷ 2 with 3D6 | VR2 p. 145; otaku errata 1998 | `MATRIX_V923.otaku` |
| Paydata | 2D6 × 5…25 Mp, 50–200¥ per Mp; 4–5 encrypted, 6 scramble | a 5,000¥ point per file; 2D6 × 20/15/10/5 Mp; defenses by code (bomb, scramble, both) | VR2 p. 65 | `MATRIX_V923.paydata` |
| Book check: "IC TNs (crippler/ripper target a persona program)" | listed as confirmed | correction: the persona attribute is the decker's opposing roll vs the IC's rating, not the IC's TN | VR2 p. 41 | (doc) |
| Book check: "Matrix initiative — Shadowtech" | confirmed | correction: the dice are right; the base is the decker's Reaction, not Intelligence | VR2 p. 120 | (doc) |

**Kept (the owner's decisions):** none in this area.

**Not built:** suppressing IC (−1 Detection Factor per suppressed IC); Black IC's blaster shot at the MPCP after a kill
and the data wipe; improvised attacks; non-combat actions per turn; Analyze Host revealing one item per success;
the missing operations (Analyze Subsystem, Crash Application, Decoy, Disinfect, Dump Log, Locate Decker/Frame/IC as
system operations, Retrain, Scan Icon); Validate Passcode's duration and superuser/supervisor modifiers; the parry
lasting until the opponent's next attack, position as +Power or backfiring, and the evade re-find timing; the ripper's
per-success chip damage; tar baby/tar pit opposed tests and tar pit's corruption test; scramble IC's poison test; the
data bomb's tally and Defuse utility; Slow's and Restore's VR2 tests; construct initiative from the lowest rating;
reality filters as +1 RI; psychotropic recovery tests (weekly/daily; the GM clears the effect); paydata losing a point a
day unsold; deck part cook and install times; otaku channels as skills and complex forms' programming; the otaku's free
Armor; Interrogation query modifiers and "not there" after 3 tries; the keyboard/cool-mode initiative penalty.

### Vehicles, rigging and building security

Rigger 2 first (its vehicle rules replace the core book's, Rigger 2 p. 20); the core book only where Rigger 2 is silent;
building security from the Corporate Security Handbook (CSH). Switches in `RULES.VEHICLES_V923`
(`rules/config923/vehicles.ts`); each one's first choice is the book's way and the other puts v0.92.2 back. Under the
"SR2E Unified Rules Revamp" source a `VEHICLES_V923` switch for a rule the Revamp changes itself
(`REVAMP_VEHICLE_RULES`) reads its v0.92.2 choice (`veh923()` in `rules/vehicles.ts`), so the Revamp's own rule decides
as before; the book corrections the Revamp is silent on (vcrTn, autonavDice, autonavMin, damageInit, accel,
circuitFail, autoCrash) apply under either source.

| Rule | Was | Now (book) | Source | Switch |
|---|---|---|---|---|
| Anti-vehicle weapons vs vehicle armor | full Armor off the Power; armor ≥ Power stops them | half the Armor (round down), no level drop, never stopped | Rigger 2 p. 53; Core p. 108 | `VEHICLES_V923.avArmor` half / full |
| Normal weapons vs vehicles: Power | × 0.5 | not halved (× 1); one level lower; Power − Armor; armor still a barrier | Rigger 2 pp. 23, 53 | `VEHICLES.damage.normalWeapons.powerMultiplier` 0.5 → 1 |
| Control Pool on the vehicle's damage resistance (weapons, rams, crashes) | none | the jumped-in rigger's pool, at most their skill in the vehicle; no damage and more pool dice than the attacker's successes: a complete miss (card note) | Rigger 2 pp. 50, 53 | `VEHICLES_V923.cpResist` driving / none |
| A vehicle's defence | rigger's evasive driving (Car + pool vs Handling) or a manual driver's evasion | no dodge test (the pool goes on the resistance) | Rigger 2 p. 53 | `VEHICLES_V923.vehicleDodge` none / old |
| Pool on mounted weapons (jumped-in driver, security rigger) | Control Pool | Combat Pool (at most Gunnery) | Rigger 2 pp. 16, 78 | `VEHICLES_V923.gunneryPool` combat / control |
| Control Pool on a driving test | any dice | at most the skill rated (autonav dice don't count toward the cap) | Rigger 2 pp. 16, 20, 51 | `VEHICLES_V923.cpCap` skill / none |
| Control Pool on sensor tests | allowed | not allowed | Rigger 2 p. 16 | `VEHICLES.sensors.controlPool` true → false (now a house-rule row) |
| Rigger feedback | every hit: Willpower vs Power, the vehicle's level, Stun | only a hit the vehicle sustains at Serious (6M Physical) or Deadly, or one that destroys it (6S Physical), Body (the hit's level, not the condition it leaves); a rigger aboard a destroyed vehicle takes the 6S instead of dump shock | Rigger 2 p. 49 | `VEHICLES_V923.feedback` book / old |
| Control rig TN | −1 × level on every jumped-in test (driving, crash, gunnery, sensors, evasion) | −2 × level on a Driving Test, −1 × level on accelerate/brake, positioning, ramming; none on crash tests, gunnery, sensor tests | Rigger 2 pp. 20, 45–48, 52, 57–58, 28 | `VEHICLES_V923.vcrTn` byTest / flat |
| Autonav dice | none | + Autonav rating in dice on an ordinary Driving Test and a Crash Test (not the combat maneuvers) | Rigger 2 pp. 20, 51 | `VEHICLES_V923.autonavDice` book / none |
| Autonav rating 1 | drives by itself | can't drive by itself (drones' Pilot unaffected) | Rigger 2 p. 122 | `VEHICLES_V923.autonavMin` book / any |
| Vehicle damage → driver's Initiative | none | −1 / −2 / −3 (Light / Moderate / Serious+), on the vehicle, its jumped-in rigger and a manual driver | Rigger 2 p. 49; Core p. 109 | `VEHICLES_V923.damageInit` book / none |
| Vehicle damage → Speed | none (Revamp only) | Moderate −25 %, Serious −50 % | Rigger 2 p. 49 | `VEHICLES_V923.damageSpeed` book / none |
| Crash Power | speed ÷ 10 round down, min 2 | speed ÷ 10 round up, no minimum | Rigger 2 p. 50 | `VEHICLES_V923.crashPower` up / down |
| Crash Test modifiers | the driving terrain row | terrain −1 / 0 / +2 / +4; speed vs driver's Reaction: < ×20 0, < ×30 +1, < ×40 +2, more +4 | Rigger 2 p. 52 | `VEHICLES_V923.crashMods` book / old (`crashTerrain`, `crashSpeed`) |
| People aboard a vehicle that is hit | every hit carries through at Power − Armor, a level lower; crash passengers at M on the crash card | weapon hits don't reach them (only when targeted); collisions and crashes reach them at the damage the vehicle resists, even when its test leaves it unharmed, with no Combat Pool (the rigger's Crash Test Control Pool dice carrying over: not built) | Rigger 2 pp. 50, 53 | `VEHICLES_V923.passengers` targeted / old |
| Shooting someone inside | the vehicle's Armor | the higher of Armor or Body; no Combat Pool; a jacked-in rigger +3 TN | Rigger 2 p. 53 | `VEHICLES_V923.occupant` book / old; `occupantRiggerTn` 3 |
| Ramming | Body + speed ÷ 10, level by the rammer's speed, the rammer half | Power and level by the difference in speed (÷ 10 round up); the rammer less Body × its test's successes (TN at least 2); collision damage (no armor); any damage calls a Crash Test; ramming terrain −1 / 0 / +1 / +2 | Rigger 2 pp. 47–48, 50 | `VEHICLES_V923.ram` book / old (`ramTerrain`) |
| Vehicle vs pedestrian | as a ram | speed ÷ 10 at one level higher (a Destroyed-level hit + half the Power); the vehicle one level lower | Rigger 2 p. 52 | `VEHICLES_V923.ram` |
| Braking | Accel × 2 per Combat Turn; push test +2 TN | safe braking Accel × 4; no extra TN on the acceleration test | Rigger 2 pp. 22, 45 | `VEHICLES_V923.accel` book / old; `brakeMultiplier` 4 |
| Manual gunnery from/at a vehicle | moving +1 (fast +2), target moving +1 | relative speed 0 / +2 / +4 / +6 (speeds under 5 count as 5), target size by vehicle kind, a weapon fired from a vehicle out of a mount +2 | Rigger 2 p. 57 | `VEHICLES_V923.gunneryMods` book / old (`gunnerySpeed`) |
| Driving Test rows | easy −1, hard +2 | non-stressful −1, stressful +3, large +2, very large +3, during combat +2, non-rigger by datajack −1 | Rigger 2 p. 20 | `VEHICLES_V923.drivingRows` book / old (`oldDrivingRows`) |
| Vehicle repair TN | flat 4 | boxes repaired + 2 | Rigger 2 p. 26 | `VEHICLES_V923.repairTn` boxes / flat |
| A Body 0 vehicle | resists with no dice | destroyed by any hit that gets through | Rigger 2 p. 53 | `VEHICLES_V923.body0` destroyed / old |
| A vehicle whose monitor fills | nothing more | crashes automatically (Crash button) | Rigger 2 p. 53 | `VEHICLES_V923.autoCrash` book / old |
| Combat spells vs vehicle armor | armor ignored | half the armor (anti-vehicle), no level drop | Rigger 2 p. 54 | `GEAR.spellsVsVehicles.combatArmor` false → true |
| Sensor test | Simple Action | Complex Action | Rigger 2 p. 58 | `ACTIONS.costs.sensor` simple → complex (now a house-rule row) |
| Missile lock | not needed | a sensor lock is needed | Rigger 2 p. 59 | `DRONES_V73.missiles.needsLock` false → true |
| Load and passengers | 100 kg per person aboard | Load leaves out passengers | Rigger 2 p. 24 | `VEHICLES.cargo.personKg` 100 → 0 |
| Remote control deck (template) | 50,000¥ × Rating, weight Rating × 2, signal 4 | 5,000¥ × Rating, weight 3, Flux 2 | Rigger 2 p. 97 (= SRII p. 253) | template data |
| Drone-link interception | link skill vs the radio TN | own deck rating vs target deck + 3, decryption first (EW vs encryption + 4, ⌈deck ÷ 2⌉ successes; +2 per failure) | Rigger 2 p. 68 | `VEHICLES_V923.interception` book / old |
| Dump shock disorientation | none | +2 TN for 10 Combat Turns ÷ Willpower (4) successes | Rigger 2 p. 64 | `VEHICLES_V923.dumpDisorient` book / none |
| Card reader casing | casing rating | twice the rating | CSH p. 100 | `VEHICLES_V923.cardCasing` double / single |
| Circuit bypass with no successes | +2 tally | + a passive alert | CSH p. 100 | `VEHICLES_V923.circuitFail` passive / tally |
| Passkey | rating replaces the skill dice, full TN, after the casing | rating vs the reader's rating, casing left shut | CSH p. 100 | `VEHICLES_V923.passkey` book / old |
| Sequencer | rating replaces the skill dice | opposed with the keypad; tie nothing; keypad wins: passive alert | CSH p. 100 | `VEHICLES_V923.sequencer` book / old |

**Kept (the owner's decisions):** voice locks need a voice-deception device (CSH p. 101: opposed, ties repeat; as the
system); the remote / rigger adaptation costs (the rules text: remote 2,500¥ × Body, rigger 2,800¥); the passkey at
10,000¥ × Rating (CSH p. 100 prints × Rating²; Core p. 243 × Rating; the owner chose the Core price, 12 Nov 2026). The
anti-vehicle rocket falloff moved to the book's −8 per metre in v0.92.4 (the owner's decision; see Combat).

**Not built:** off-road halving the Speed (needs an off-road suspension flag); rigger defaulting at +1 per dot; autonav
active in combat maneuvers (+rating TN); cerebral boosters, encephalons and move-by-wire on the rig; the ram range check
(distance < Acceleration); vehicles against walls (Barrier × 20); Stress and exceeding Speed (1.5 ×); the Maneuver
Score chase system with Hiding / Relocating and the passenger-action limit; the relative-motion ±1 and Maneuver-score ±1
gunnery rows; the opposed ECM test and ED; sensor result levels; missile timing; shared mount-point budget; network
drones acting in the rigger's phase; Comprehension Tests; captain's chair vs primary drone; flux modifiers; MIJI
jamming / spoofing with Signal Monitors; datajack +1 Reaction; modification prices and install tests per item; repair
parts (5 % per box); the design tables; passenger safety gear in crashes (seat belt, crash cage, APPS) and a Deadly
passenger hit's Light to the vehicle; called-shot damage thresholds; CCSS device limits, rigger perception table,
rigger combat and decking a rigged system; the rigger's decking penalty (Matrix); motion / vibration sensor tests; the
security ratings table.

### Gear, cyberware and bioware

v0.92.3 book alignment (RULES.GEAR_V923, rules/config923/gear.ts; the rules in rules/gear923.ts). Each switch's first
choice is the book's way and the default; the other puts the v0.92.2 behaviour back. Under the Unified Rules Revamp
source only `armorEncumbrance` (the Revamp's own `URR_V80.cbtArmorPool`) reads as its old choice; the other switches
are book corrections the Revamp is silent on and apply under either source.

| Rule | Was | Now (book) | Source | Switch |
|---|---|---|---|---|
| Grade Essence, beta | ×0.7 | ×0.6 | SSC Custom Cyberware; Cybertechnology p. 44 | `GEAR_V923.grades` |
| Grade nuyen | alpha ×2, beta ×4, delta ×8 | ×3, ×7, ×10 | SSC; Cybertechnology p. 44 | `GEAR_V923.grades` |
| Graded Essence rounding | to the hundredth | rounded up, never below .05 | SSC; Cybertechnology p. 44 | `GEAR_V923.grades` |
| Essence 0 | dead | only below 0 kills | Core p. 246 | `GEAR_V923.essenceZero` |
| Dermal plating | ballistic and impact armor = rating | + rating to Body; stops flechette's extra level | Core pp. 93, 248 | `GEAR_V923.dermal` |
| Pairs of cyberlimbs | nothing | each full pair (arms, legs) +1 Body as dermal armor | Core p. 249; Cybertechnology p. 49 | `GEAR_V923.limbPairs` |
| Ware housed in a cyberlimb | no Essence (limb capacity) | full Essence except fingertip compartment, spurs, razors 0; smartlink, orientation system .25; tactical computer −25% | Cybertechnology p. 49 | `GEAR_V923.limbHoused` |
| Bone lacing | +1/+2/+3 Body dice on damage resistance | plastic +1 Body; aluminum +1 Body, +1 impact; titanium +2 Body, +1 impact, +1 ballistic; 3 cyber replacements −1 armor, more none | Shadowtech p. 42; Cybertechnology pp. 49–50 | `GEAR_V923.boneLacing` |
| Muscle augmentation | +R Strength | +R Quickness and Strength (Quickness raises Reaction) | Shadowtech p. 35 | `GEAR_V923.bioware` |
| Adrenal pump | +R Qui/Str/Wil | also +2R Reaction; its Quickness doesn't raise Reaction | Shadowtech p. 19 | `GEAR_V923.bioware` |
| Cerebral booster 2 | +2 Int | also a Task Pool die | Shadowtech p. 23 | `GEAR_V923.bioware` |
| Orthoskin | impact R, ballistic R/2 | +1/0, +1/+1, +2/+1 | Shadowtech p. 17 | `GEAR_V923.bioware` |
| Enhanced articulation | +1 die on Body/Qui/Str skills | +1 die on every Active Skill, +1 Reaction | Shadowtech p. 34 | `GEAR_V923.bioware` |
| Pain editor | +1 Wil, +1 Perception TN | +1 Wil, −1 Int (the +4 is for tactile Perception only, not modelled) | Shadowtech p. 26 | `GEAR_V923.bioware` |
| Importer Essence / Body Cost guesses | boosted reflexes +1/+2/+3 Reaction; cyberhand .25; skillwires .2R; ingested filter R/10; encephalon .75/1.5; magnification .1/level; muscle aug .2R; cerebral .2/.4; synaptic .4/1; adrenal .25/.75; orthoskin .25/.5/.75; suprathyroid .7; mnemonic .1R; extended volume .2R; pheromones cyberware | —/+1/+2; .35 (forearm .65); .1/.2/.3 × R by band; R/5; .5/.75/1.5/1.75; .2 optical / .1 electronic flat; .8/level; .4/.8; .3/1.6; 1.25/2.5; .5/1/1.5; 1.4; .2R; .2/.3/.4; bioware, Body Cost .4/.6 | SSC p. 87; Cybertechnology p. 98; Core p. 249; FoF pp. 100–104; Shadowtech | `GEAR_V923.wareTables` |
| Bioware for the Awakened | Magic −floor(Body Index × .5) | Essence = Body Cost (Magic follows Essence) | Shadowtech p. 5 | `GEAR_V923.awakenedBioware` |
| Over the Body Index | rejection test | system shock: +1 TN per point (or part) over on Body tests | Shadowtech p. 6 | `GEAR_V923.overBodyIndex` |
| Cultured bioware | ×4 price only; neural ware warned and charged ×4 | Body Cost × .75; neural ware always cultured, price and Body Cost already count it | Shadowtech p. 6 | `GEAR_V923.cultured` |
| Adrenal pump crash | Body vs 6, M (R1) / S (R2) Stun | runs 1D6 turns per level; then Deadly Stun, Power = half the turns | Shadowtech p. 19 | `GEAR_V923.adrenalCrash` |
| Carrying | Str × 10 kg free, −1 Qui per Str × 5 kg over | Str × 5 kg free; to × 10 Light, × 15 Moderate (no running, ½ movement), × 20 Serious (¼ movement), more: passes out | Core p. 185 | `GEAR_V923.load` |
| Armor encumbrance | any armor over Quickness: −Quickness | heavy armor only (by name): −1 Combat Pool die per Ballistic point over Quickness | Core p. 84 | `GEAR_V923.armorEncumbrance` |
| Cybersurgery | Biotech vs 4 + grade; no successes: complications | Biotech vs 10 − Essence left; successes change the Essence cost +15% … −20%; always installs; a cost that would leave the patient below 0 Essence stops at 0 (the patient survives at Essence 0) | Cybertechnology pp. 53–54 | `GEAR_V923.surgery` |
| Cyberware damage | Deadly only, 1d6 per item | Serious or Deadly: 1D6 − 4 / − 2 systems at random; 1D6 damage each (Moderate+ stops it, 7 destroyed); graded ware 5 dice vs 5/6, 4/5, 3/4, one success ignores it | Shadowtech p. 36; Cybertechnology p. 44 | `GEAR_V923.cyberDamage` |
| Filtration systems | + rating dice against the toxin | the toxin opposes the rating; a winning filter stops it, a failing one adds nothing | Core p. 248 | `GEAR_V923.filtration` |
| Templates | no Concealability, weight, Availability, Street Index | armor jacket, vest, clothing, helmet, form-fitting, riot shield, the named pistols, rifles, bow, knives, grenades, launchers, melee weapons, taser, datajack, smartlink, wired reflexes, dermal plating (rated 1), medkit, jammer, climbing gear: book numbers | FoF pp. 88–106; Core p. 256; SSC p. 50 | (data) |
| Lined coat | no template | 4/2, Conceal 8, 1 kg, 2/24 hrs, 700¥, SI .75 | Core p. 242 | (data) |
| Remote control deck | 50,000¥ × Rating, Rating × 2 kg | 5,000¥ × Rating, 3 kg, 4/72 hrs, SI 2 | Rigger 2 p. 97 | (data) |
| Weapon detector / cyberware scanner | 1,000¥ R4 / 1,500¥ R4 | 5,000¥ per rating (MAD) / Lone Star portable R3, 5,000¥ | NAGRL pp. 92–93; Lone Star p. 122 | (data) |

**Kept (the owner's decisions)**
- The shop and the street (`SHOP_V91`, `SHOP_V915`, `SHOP_V916`): who rolls Availability (book: the source's skill or Etiquette +2 dice, Core p. 184); the optional +1 TN per 2 rating points (Core p. 184); the street and gray market −2 TN and paying 25% more for −1 TN and −20% time (Shadowtech pp. 101–102); haggling (book: opposed Negotiation vs Willpower, 5% per net success, no cap).
- Legality, permits and fines (`GEAR_V58.legality`, `SHOP_V915`): book: number-plus-category codes (e.g. 6P-CC), permits at Availability +2 TN for 5% (possess) or 10% (possess and transport) of the price, annual; fines by category and charge (Shadowtech pp. 101–105).
- The riot shield's parry 0; the cybereye and cyberear Essence allowance; Carried and the custom tweaks (`SHEET_V921`).

**Not built**
- Shadow clinic search for alpha/beta/delta grades (a contact's Etiquette (Street) vs 12/15, corporate 11/17; SSC): needs a clinic-finding step; the graded Availability TN stays as the stand-in.
- Graded clinic fees (alpha/beta ×50, delta ×200 of the medical rates, Cybertechnology p. 44): needs a surgeon's fee in the surgery flow.
- Removal test (lower of Biotech/Cybernetics vs 10 − Essence, SSC p. 97); repair by damage level (TN 2/3/4/8, ×2 alpha, ×3 beta; time 2 × Essence hours × level): needs ware damage levels (the system keeps damaged / not damaged; Light damage's half efficiency and the Serious/Deadly TN penalties aren't modelled).
- Boosted reflexes forbidding wired reflexes and a control rig (SSC p. 87); smartlink II extras and smart goggles (FoF pp. 84–85; Core); cyberlimb base Strength 3 (troll 8) and enhancement Essence (Cybertechnology pp. 49–51); skillwires capping the total of active softs and a chip replacing the skill (Core pp. 247–249); the Skill Memory Table (Core p. 248); bioware recovery ×3 (cultured ×2) of the normal healing time (Shadowtech p. 6); the trauma damper's Physical-to-Stun shift; orthoskin and dermal plating refused together (the better still counts); the lined coat's +2 Concealability for weapons under it; NAGRL's search table and the chemical sniffer's base TN 10 by explosive carried; the police check against legality (Shadowtech p. 103).

Note: switching `GEAR_V923.surgery` back to 'old' doesn't undo an Essence cost the book's surgery already wrote on an
item (its cost before surgery stays in the item's flag `surgeryEssence`; set the cost back by hand if needed).
The remote control deck's Flux (signal) Rating is 2 (Rigger 2 p. 30, Flux Rating Table; p. 97); the examples' higher
Flux comes from vehicle and amplifier boosts.

## Verified fixes to the official SR2 rules (v0.79.0, 23 Oct 2026)

v0.79.0 rechecked every rule here against the official SR2 rules: about 610 rows, 230 confirmed, 224 different. A rule changed in v0.79.0 only when **it differs from the system and an official source backs it** (a book table, or an SR2 core / Rigger 2 page). Everything else that differed (rules without an official source, rewrites from other editions, house rules) is kept for the GM-selected alternate ruleset (the Unified Rules Revamp, v0.80.0) and does **not** change the default rules. Where a row further down or in the book-check section below describes a rule changed here, this section is the current one; the older row is what the old way does.

Every behaviour change is a house-rule switch in `RULES.DOCS_V79` (`rules/config79-*.ts`; Configure Settings → House rules); the first choice is the new default, the other the old way. Plain value changes keep the old value in a "(was …)" comment and can be set back as a house rule.

| Rule (switch) | Old way | Now | Official source |
| --- | --- | --- | --- |
| Reloading (`rangedReload`) | one Simple Action | a clip: remove + insert, two Simple Actions (a smartgun with smartlink ejects free); belt, cylinder, internal magazine, break action: a Complex Action (rounds per action `COMBAT.reloadFeed`, house numbers, VERIFY) | SRII pp. 81–83 |
| Combat Pool on offence (`rangedPoolCap`) | no cap | at most the skill rolled (attacks, the melee defender's test, Parry); no limit on resistance | SRII p. 83 |
| Weapon ranges (templates, values) | taser 5/10/15/20, sniper 100/400/800/1300, assault rifle 50/150/350/550, LMG 40/150/400/800, missile launcher 150/450/1200/3000 | taser 5/10/12/15, sniper 40/80/200/400, assault rifle 15/40/100/250, LMG 20/40/80/150, missile launcher 70/150/450/1500 (minimum 20 m). VERIFY: the LMG is a Firearms row in the table but the template keeps Gunnery | SRII Weapon Range Table |
| Strength ranges (`rangedStrengthRange`) | the item's own (default ×1/2/3/5) | bow ×1/10/30/60, crossbows L 2/8/20/40, M 3/12/30/50, H 5/15/40/60, shuriken 1/2/5/7, grenades 3/5/10/20, aerodynamic 3/5/20/30 (by name when the item is on the default) | SRII Weapon and Grenade Range Tables |
| Smartlink II (value) | −3 | −2, as Smartlink I | SRII Ranged Combat Modifiers Table |
| Recoil (`rangedRecoil`) | the first round of the phase always free (burst +2, then +5; full auto +1 per round after the first) | semi-auto 2nd shot +1; +3 per burst (cumulative); full auto +1 per round fired; only a single first shot is free | SRII Ranged Combat Modifiers Table |
| Flechette (`rangedFlechette.mode`) | always +1 level, the attack's armor kind × 2 | +1 level only against no armor at all; against armor the higher of ballistic/impact × 2 | SRII p. 93 |
| Grenade scatter (`rangedScatter.mode`) | 1–4D6 by range band | thrown 1D6, aerodynamic 2D6, launched 3D6, −2 m per success; rockets and missiles still by range band | SRII Grenade Range Table |
| Surprise (`rangedSurprise.mode`) | fewer successes than the best opponent: lose the first pass | a surprise turn in order of successes (initiative = successes + 1); nobody may attack an opponent with more successes | SRII p. 86 |
| Normal vision, minimal light (value) | +4 | +6 | SRII p. 89 Visibility Table |
| Low-light and thermographic (`visionCyberNatural`) | one column | cybereyes / natural: low-light partial +1/0, minimal +4/+2, darkness +8/+8; thermographic partial +2/+1, minimal +4/+2, darkness +4/+2. VERIFY: whether the sheet's vision boxes and bioware count as natural | SRII p. 89 Visibility Table |
| Glare and mist (new choices) | — | glare +2 (low-light +4/+2, thermo +4/+2), mist +2 (low-light +2/0, thermo 0) | SRII p. 89 Visibility Table |
| Smoke (`visionSmokeRows`) | smoke +4 | light smoke +4 (low-light +4/+2, thermo 0), heavy smoke +6 (low-light +6/+4, thermo +1/0) | SRII p. 89 Visibility Table |
| Rain and fog (`visionWeatherFold`) | light rain +1, heavy rain +2, fog +2, thick fog +4 | light rain or fog = light smoke, heavy rain or thick fog = heavy smoke. VERIFY: snow and storm keep their old numbers | SRII p. 89 Visibility Table |
| Reach (`meleeReachShorter`) | the longer side −1 per point | also +1 per point on the shorter side's own test | SRII Melee Modifiers Table |
| Superior position (`COMBAT_V61.superiorPosition.enabled`, `against`) | off | on: −1 for the side that holds it, nothing for the other | SRII Melee Modifiers Table |
| Perception results (value) | 3 levels | 4 levels, the book's wording | SRII p. 185 |
| Perception sight modifiers (`perceptionSightBook`) | one obviousness scale | very small +6, partly hidden +2, brightly colored −2, action very obvious −4, action not obvious +4; they stack | SRII p. 185 |
| Physical healing (`healing`) | Body vs 2/4/6/8, 24 h per box ÷ successes | in stages: Body vs 4/6/8/10, 24 h / 10 / 20 / 30 days ÷ successes (at least 2 h / 1 / 2 / 3 days), one wound level per stage; Stun unchanged | SRII Healing Table |
| Self-recovery (`healingGate`) | none | first natural Body vs 2/4/6, no modifiers, once per wound; failed (or Deadly) needs medical attention. VERIFY: Deadly | SRII Wound Table |
| Doctoring (`doctoring`) | medkit −1, hospital −2, intensive −3, poor +2, home by lifestyle | with a doctor: intensive −2, not in hospital +2, bad +3, terrible +4, magician +2, natural Body and Willpower 0/−1/−2/−3 | SRII Doctoring Table |
| First aid TNs (value) | 2/4/6/8 | 4/6/8/10 | SRII First Aid Table |
| First aid modifiers (`firstAidMods`) | the medkit's rating as dice | no medkit +4, bad +1, terrible +3, magician +2, natural Body 0/−1/−2/−3 | SRII First Aid Table |
| Suspicious NPC (value) | +1 | +2 | SRII Social Skill Table |
| Desired result (`socialDesired.mode`) | house checkboxes | one pick: advantageous −2, no value 0, annoying +2, harmful +4, disastrous +6 | SRII Social Skill Table |
| Etiquette, Leadership, Negotiation (`socialInfluence.mode`) | opposed, net successes | skill vs the target's attribute + modifiers, one success passes (pay, haggling, fencing, Interrogation, Intimidation, Instruction stay opposed) | SRII pp. 180–182 |
| Skill Karma (`skillKarma.mode`) | bands by the attribute | active and B/R skills new rating × 2, concentration × 1.5, specialization × 1 (knowledge and languages unchanged; halves round up, VERIFY) | official SR2 rules (book page to verify): the Karma cost table ("Good Karma Cost for Skills") |
| Over the Speed rating (value) | +2 | +1 | Rigger 2 positioning, acceleration and ramming tables |
| Crash level (`vehCrashLevel`) | always S | by speed: 1–20 L, 21–60 M, 61–200 S, 201+ D (passengers still M) | Rigger 2 Impact Damage Levels table |
| Ram level (`vehRamLevel`) | M (S above half Speed), the rammer a level lower | the same speed table; the rammer the same level | Rigger 2 Impact Damage Levels table |
| Mounted recoil (`vehMountRecoil.mode`) | fixed and turret: none; pintle: nothing | fixed/turret halve it (round down); pintle 2, ring mount 6 compensation (new ring mount, gunner only) | Rigger 2 p. 131 |
| Sensor tests (`vehSensorTable.mode`) | ECM, damage, range, weather, passive | + direct line of sight −2, urban +1, fog +1, restricted +1, tight +2, concealing spirit + Force | Rigger 2 Sensor Test Modifiers table |
| Sensor-enhanced gunnery (`VEHICLES_V57.sensorGunnery` 'rigger2') | −2 TN with a lock | Gunnery (drone: Pilot) + ½ Sensor vs Signature + ECM, no range or movement; urban +2, direct LOS −3 | Rigger 2 Sensor-Enhanced Targeting Modifiers table |
| Vehicle repair (`vehRepair.mode`) | 1 box per success, 1 h per box | any success fixes it all; 16 h per box ÷ successes | Rigger 2 p. 26 |
| Dump shock (`riggerDumpShock.mode`) | Willpower vs 6, M Stun | from a remote control deck: (deck rating + 4)S Stun, Body resists; jumped in aboard keeps the old | Rigger 2 p. 64 |
| Jamming dumps (`RIGGING.jamming.dumpShock`) | no dump shock | dump shock | Rigger 2 p. 64 |
| Flux range (`SIGNAL.rangeKm`, value) | 1, 3, 10, 30 … 10,000 km | 250 m, 1, 2, 4, 6, 9, 12, 16, 20, 25 km; 10+: 2 × flux + 10 km. Rigging links only: a decker's Matrix link keeps the old table (`SIGNAL.matrixRangeKm`, VERIFY) | Rigger 2 flux range table |
| Base flux (`signalFlux.base`) | a deck with no signal: its rating | a remote control deck 2 | Rigger 2 flux rating table |
| Spell Pool (`magicPool.size`) | (I + W + Magic) ÷ 3 | Sorcery rating (+ an active power focus). A critter or NPC with Magic but no Sorcery skill now has no Spell Pool (none for spell resistance or astral combat: give it Sorcery, or use the old way); adepts under the `ADEPT.spellPool` house rule keep the old formula | SR2 p. 85 |
| Casting cap (`magicPool.castingCap`) | none | at most Magic dice on a spell's success test; drain uncapped | SR2 p. 85 |
| Spell defense (`MAGIC.spellDefenseSpentOnUse`) | helps every resistance test that turn | dice used to defend someone are spent until the pools refresh | SRII p. 132 |

**Known limits (v0.79.0):** surprise ordering blocks weapon attacks only (spells, powers, Matrix and astral attacks aren't stopped) and doesn't tell allies from opponents; a healing stage under way is remembered per wound (flag `healStage`) and new Physical damage starts a new one; the Doctoring Table's long-term magical care (−2) isn't offered in the Rest dialog; scene weather "mist" and the Attack dialog's Mist both add +2 if both are set; for exactly the v0.78.0 flux ranges also set `DOCS_V79.signalFlux.perFlux` and `plusKm` to 0 (Advanced) besides `SIGNAL.rangeKm`; the ring mount stays available under the old mounted-recoil rule; a vehicle's sensors don't take the Visibility Table's weather (with the Rigger 2 sensor table on, its fog / precipitation row replaces the automatic weather).

**Not changed (kept for the alternate ruleset):** stun overflow 1:1, the trauma patch's Body test, stun recovery vs 2, first aid lowering one level, bleeding every 10 minutes, Magic loss on 2D6 ≤ Magic and on treatment without the magician modifier, melee and initiative ties, attacker staging, shotgun shot as flechette, the dodge / clean-miss defense flow (the v0.77.0 book check confirms the system's dodge: Core Rules), the Control Pool limits, rigger feedback 6M/6S, passengers, the manual gunnery table, sensor lock as a Complex action, ramming Power from speed, the subscriber list at 2 × rating, drones on the rigger's initiative, going over the natural maximum: no official source backs these.

## The "SR2E Unified Rules Revamp" rules source (v0.80.0, 24 Oct 2026)

A world setting, **Rules source** (`sr2e.rulesSource`), picks **SR2E Book Rules** (the default) or **SR2E Unified Rules Revamp**, the GM's alternate ruleset. The Unified Rules Revamp follows the community document *Shadowrun Classic: Unified Rule Revamp* (v1.2), the URR, with a few house rules where it is silent. **The Book Rules are not changed by any of it:** every switch in `RULES.URR_V80` (`rules/config80*.ts`) ships at the book's way, and only `URR_V80_PATCH` (applied by `settings.ts` `applyHouseRules` when the source is the Revamp, between the shipped values and the house rules) turns them on or changes existing values. The GM's house rules still win over the Revamp; the House rules window shows the Revamp's value as the default and marks the rows it changes. A test (`__tests__/v080.test.ts`) checks every patched path; v0.80.0's shipped RULES are identical to v0.79.0's.

Every rule here cites its source: **URR** is *Shadowrun Classic: Unified Rule Revamp* (v1.2), with the section where it helps; a rule the URR doesn't have is marked "house rule for the Revamp (not in the URR)". Rules without an official source, the URR's redesigns and SR3-looking rules are allowed here (this is not the default). Whole subsystems are listed, not built. All values here are VERIFY in the usual sense: read from the URR, not the book.

### Changed under the Revamp

#### Core

| Rule | Book way (shipped) | Revamp way | Source | Switch |
| --- | --- | --- | --- | --- |
| Critical successes | not shown | a plain test card counts one per full 6 points a die goes over the TN; the GM may grant a bonus success | URR | `URR_V80.coreCriticals` |
| Standard difficulty | the TN is typed | skill and attribute roll dialogs offer Simple 2, Routine 3, Average 4, Challenging 5, Difficult 6 (6–7), Strenuous 8, Extreme 9, Nearly impossible 10 (10+) | URR (standard difficulty table) | `URR_V80.coreTnPresets` |
| Knowledge tests | a plain test | the dialog offers general 3, detailed 5, intricate 8, obscure 12; the card says what 1–4 successes give | URR (knowledge table; SRII p183) | `URR_V80.coreKnowledgeTest` |
| Opposed ties (perception, social) | a stand-off | the side that made the test wins (needs at least 1 success); sneaking already favours the sneaker | URR | `URR_V80.coreTies` |
| Karma Pool: buy dice | — | skill (rated) and attribute dialogs: 1 Karma Pool point a die, until the pool refreshes; no cap but the pool | URR | `URR_V80.coreKarmaDice` |
| Starting Karma Pool | 1 for everyone | 2 for metahumans when the creation wizard finishes | URR | `URR_V80.coreStartPoolByMeta`, `coreStartPoolMeta` |
| Karma Pool growth | 1 per 10 career Karma (20 metahuman), taken from the award | each award: the first point to the pool, the next 10 to Good Karma, round again; starts over each award | house rule for the Revamp (not in the URR) | `URR_V80.coreKarmaGrowth`, `coreAwardPool`, `coreAwardGood` |
| Natural maximums | 6 + racial modifier | dwarf Quickness 5, troll Willpower 5 (the rest unchanged; racial modifiers unchanged) | URR | `URR_V80.coreMetaMax` |
| Raising an attribute | new rating × 2 | new rating × 1.5 (rounded up) | URR | `UPKEEP.karma.attributeMultiplier` |
| Past the natural maximum | refused | with the GM's leave at new rating × 3, up to the augmented maximum | URR | `CHARACTERS_V73.qualities.karmaAboveRacial.enabled` |
| Essence and Magic | Magic ≤ Essence rounded up | Magic ≤ Essence rounded down | URR | `URR_V80.coreEssenceFloor` |
| Skill Web steps | at most 3 | no limit | URR | `SKILLS.web.maxSteps` (99) |
| Skill Web arrows | every link both ways | "A > B" defaults from A to B only | URR | `URR_V80.coreWebArrows` |
| Defaulting to an attribute | flat +4 | traced through the web, +2 a step, when the GM links the attribute; else +4 | URR | `URR_V80.coreWebAttributes` |
| Concentration / specialization defaulting | an unrated skill defaults to a related skill or the attribute | from its concentration +2, or specialization +3 | URR | `URR_V80.coreSubSkillDefault` |
| Native language | free at Intelligence | free at Intelligence + 2 | URR | `URR_V80.coreNativeBonus` |
| Raising a language | the knowledge bands | new rating × 1 | house rule for the Revamp (not in the URR) | `URR_V80.coreLanguageKarma` |
| Training time | new rating × days by kind ÷ instructor's successes | Karma × 8 h, 4 h a day (or Willpower h); ÷ (1 + instructor's successes); the trainee's own test is not rolled | URR | `URR_V80.coreTraining` |
| Instructor | rating ≥ the new rating | skill ≥ new rating + 2; any rating for an attribute | URR | `URR_V80.coreTraining`, `coreInstructorMargin` |
| Finding gear | Etiquette vs Availability | Availability + 2 | house rule for the Revamp (not in the URR) | `URR_V80.coreFindTn` |
| Haggling | seller's 4 dice vs 4 | seller's 4 dice vs the buyer's Intelligence | URR | `URR_V80.coreHaggleTn` |

**Known limits (v0.80.0 core):** critical successes show on plain test cards only (skill and attribute tests, not attacks or spells); the "A > B" arrow works only with `>` ("->" still reads as before); defaulting to an attribute through the web needs the GM to add attribute links ("Quickness - Firearms: 2"); the starting Karma Pool of 2 is set only when the creation wizard finishes (not "Record as it stands"); training money, the trainee's own training test, extended and breakthrough training are not built.

#### Health and social

| Rule | Book way | Revamp way | Source | Switch |
| --- | --- | --- | --- | --- |
| Stun overflow | 2 Stun = 1 Physical box | 1 Stun = 1 Physical box | URR | `STUN_OVERFLOW_PER_PHYSICAL_BOX` 1 |
| Death | Overflow row full (10 + Body boxes) | more than 10 + Body | URR | `URR_V80.hsDeathPastOverflow` |
| Bleeding out | 1 box every (Body) Combat Turns | 1 box every 10 minutes | URR | `URR_V80.hsBleedMinutes` 10 |
| Self-stabilisation | none | after failed first aid on the dying: natural Body vs 10, no modifiers | URR | `URR_V80.hsSelfStabilise`, `hsSelfStabiliseTn` |
| Trauma patch | stabilises outright | natural Body vs 4 + dermal armor / blood filter rating | URR | `URR_V80.hsTraumaPatch` 'bodyTest', `hsTraumaPatchTn` |
| Stun recovery | Body vs 2/4/6/8 by wound, no wound modifiers | higher of Body and Willpower vs 2 + wound modifiers, no care rows | URR | `URR_V80.hsStunRecovery` 'urr', `hsStunRecoveryTn` |
| First aid effect | 1 box per success, at most half | any success lowers one level (Light clears); Deadly Physical: stabilise only | URR | `URR_V80.hsFirstAid` 'level' |
| First aid time | not shown | 10/20/30 minutes ÷ successes on the card | URR | `URR_V80.hsFirstAidTime`, `hsFirstAidMinutes` |
| First aid retry | once per wound | again by a healer with higher Biotech | URR | `URR_V80.hsFirstAidRetry` |
| Magic loss trigger | a Deadly wound | also first aid without the +2 magician modifier | URR | `URR_V80.hsMagicLossUntreated` |
| Deadly wound healing | any medical attention (v0.79.0) | intensive care | URR | `URR_V80.hsDeadlyIntensive` |
| Elective surgery wound | up to 0.5 Ess L, 1.5 M, 3 S, more D | up to 0.4 M, 0.99 S, 1+ D (switch stays the GM's) | URR | `BIOWARE.surgery.trauma.levels` |
| Overdose | +1 Power per active dose | 2nd dose +1 level; each later dose +1 Power | URR | `URR_V80.hsOverdose` 'urr' |
| Troll running | × 3 | × 2 | URR | `METATYPES.types.troll.run` 2 |
| Holding breath | none (lungs bioware only) | 30 s per point of Body | URR | `URR_V80.hsBreathHold`, `hsBreathSecondsPerBody` |
| Climbing | TN 2/4/6/8, 2 m per success | TN 3/5/8/14, 1 m per success up to Fitness | URR | `STREET.athletics.climb`, `URR_V80.hsAthletics` |
| Jumping | 1 m per success (× 2 running) | Fitness × 0.5 m standing, × 1 running, +1 Fitness per 2 successes | URR | `URR_V80.hsAthletics` |
| Swimming | 2 m per success | a quarter of the walking (running) speed, +1 Quickness per success | URR | `URR_V80.hsAthletics` |
| Falling | Power = metres, Serious, half impact armor | Power = half the metres, level by height (2/4/6/8 m), no armor | URR | `URR_V80.hsFalling` 'urr' |
| Perception sight rows | five book rows | plus walking −2, tiptoeing +2, camouflage +4, poor camouflage −2 | URR | `DOCS_V79.perceptionSightRows` |
| Perception modifiers | distracted, noisy, crowded, searching (house) | distracted; sound, smell, touch and taste rows | URR | `STREET.perception` |
| Negotiation (influence) | vs Willpower | vs Intelligence (pay stays vs Willpower) | URR | `SOCIAL.skills` |
| Bargaining | 5% per net success | 10% per net success (the seller's TN: core's row) | URR | `STREET.haggle.percentPerNet`, `STREET.fence.percentPerNet` |
| Visible armor | no row | +2 in a luxury setting (a dialog row) | URR | `URR_V80.hsVisibleArmor`, `hsVisibleArmorTn` |

#### Combat

| Rule | Book way (shipped) | Revamp way | Source | Switch |
| --- | --- | --- | --- | --- |
| Initiative ties | Reaction, then Quickness | Reaction, then natural Reaction, then the name (the URR: simultaneous) | URR | `URR_V80.cbtTies` |
| Wounds and initiative | a wound mid-turn lowers the score at once | only at the next initiative roll | URR | `INITIATIVE_WOUNDS.midTurn` |
| Delaying | lost at the end of the pass | can carry into a later pass of the Combat Turn | URR | `DELAY.lostAtPassEnd` |
| Ranged defense | Combat Pool dodge vs the attacker's TN | no dodge; the pool dice go to the resistance test | URR | `URR_V80.cbtDefense` |
| Clean miss | — | pool successes on the resistance test above the attacker's successes: no damage | URR | `URR_V80.cbtDefense` |
| Staging | the hit stages up by net successes, the soak down per 2, separately | attack (melee: net) successes vs resistance successes, 2 either way = 1 level | URR | `URR_V80.cbtDefense` |
| Attacker staging | the first net success hits, each further 2 stage up | every 2 net successes stage up | URR | `ATTACK_STAGING` |
| Full defense (melee) | + Quickness dice | no dice and no pool on the melee test; the pool goes to the resistance test | URR | `URR_V80.cbtDefense` |
| Melee ties | nobody hurt | the attacker hits | URR | `COMBAT.melee.tie` |
| Knockdown | Power over Body: Body vs the soak TN, no successes = down | any damage: Body vs ½ Power (melee: the Power), 2/3/4 successes for L/M/S, Deadly down, short = 1 m stagger per missing success | URR | `URR_V80.cbtKnockdown` |
| Non-clip reload | house rounds per action | cylinder, internal magazine: Quickness rounds per Complex Action; break action whole | URR | `URR_V80.cbtReload` |
| Strength and recoil | — | Strength 5–6/7–8/9–10/11+: −1/−2/−3/−4 recoil (after compensation and heavy doubling; not mounts) | URR (citing Fields of Fire) | `URR_V80.cbtStrengthRecoil` |
| Tracers | −1 per earlier burst this phase, to −3 | full auto only, −1 per third round, none with a smartgun; the tracers add no Power | URR (citing Fields of Fire) | `URR_V80.cbtTracers` |
| Shotguns | every shotgun spreads, −1 Power per metre of spread | slugs unless loaded with shot; shot is flechette; the cone starts 1 m and doubles every choke metres, each step −1 TN and −1 Power | URR; shot as flechette: house rule for the Revamp (not in the URR) | `URR_V80.cbtShotgun`, `COMBAT.ammo`, `DOCS_V79.rangedFlechette.ammoIds` |
| Scatter per success | 2 m for every blast | standard 2 m, aerodynamic 4 m, launcher 4 m; rockets 2D6 −1 m; missiles 2D6 −1 m and −1 m per Intelligence | URR | `URR_V80.cbtScatter` |
| Blast staging | successes only cut the scatter | they stage the damage up as for any attack | URR | `URR_V80.cbtBlastStaging` |
| Blasts and barriers | held if Power ≤ rating | held unless Power beats twice the rating; through: − the rating | URR | `COMBAT_V72.blastBarriers.holdMultiplier` |
| Rocket warheads | anti-personnel −0.5 per metre, anti-vehicle −0.25 | anti-personnel −1 per half metre, anti-vehicle −8 per metre | URR | `COMBAT.grenades` |
| Full auto at several targets | 1 round wasted per metre between targets | no wasted rounds | URR | `COMBAT.spreadFire.wastedRoundsPerMetre` |
| Subduing | Stun, no TN change | Stun, +2 TN | URR | `URR_V80.cbtSubdueTn` |
| Charging | −1 TN | +1 Power, no TN change | URR | `URR_V80.cbtChargePower`, `COMBAT.charging.tn` |
| Armor and Combat Pool | the higher of ballistic and impact over Quickness lowers Quickness | each point of ballistic over Quickness: −1 Combat Pool; Quickness unchanged | house rule for the Revamp (not in the URR) | `URR_V80.cbtArmorPool` |
| Armor layering | the best piece of each kind (+ pieces that add) | the best plus half the next (two layers at most) | URR | `COMBAT.armorLayering`, `URR_V80.cbtArmorLayers` |
| Demolitions | Demolitions vs 4 | vs 2, +1 Power per success | URR (citing SRII) | `COMBAT.demolitions.tn` |
| Ranged modifiers | partial cover +4 only | cover 25–50% +2, 51–75% +4, 76–99% +6; target running +2, sprinting +3, stationary −1; attacker in melee +2 per opponent; own cover in the way +1/+2/+3; smartlink goggles −1 | URR | `SITUATIONAL_MODIFIERS`, `URR_V80.cbtGradedCover` |

Known limits (Revamp): the clean-miss flow covers characters hit by ranged attacks and opposed melee; vehicles, the Matrix, astral combat, blasts, rams, flamethrowers, elemental spells and suppressive fire keep the dodge path (`cbtCleanMissRanged`). Under it the monofilament whip's backlash still reads the pool successes on the melee test, so a whip beaten only at the resistance test doesn't lash back. The group attack path in the Attack dialog (several attackers at once) still adds the found-by-itself +4 cover when a graded cover row is ticked. The melee knockdown TN is the attack's Power (the URR names the attacker's Strength; the Power is that plus the weapon's bonus). The missile's Intelligence comes off scatter only when fired directly (indirect fire keeps its own scatter).

#### Vehicles

| Rule | Book way (shipped) | Revamp way | Source | Switch |
| --- | --- | --- | --- | --- |
| Control Pool cap | any dice up to the pool left | at most the driving skill on driving, crash, push, ram and evasive driving tests; no cap on damage resistance | URR | URR_V80.vehCpCap |
| Control Pool on gunnery | a jumped-in driver fires with Gunnery + Control Pool | Gunnery + Combat Pool (at most the skill, as any attack) | URR | URR_V80.vehCpGunnery |
| Control Pool on sensor tests | added when jumped in | not added | URR | VEHICLES.sensors.controlPool (patched false) |
| Control Pool on vehicle damage resistance | none | the jumped-in rigger adds dice (asked when Resist is clicked) | URR | URR_V80.vehCpResist |
| Rigger feedback | every damage level, Willpower vs Power, Stun | Serious hit 6M, Deadly hit 6S, Body, Physical; nothing below | URR | URR_V80.vehFeedback.mode |
| Weapon damage to vehicles | normal weapons ×0.5 Power, a level down; armor ≥ Power stops; TN Power − Armor | TN = Power − (Body + Armor), min 2; base Power ≤ armor does nothing; AV/AP halve armor; staged down 1/2/3/4 by Body 1–2/3–5/6–8/9+; AV skips that, base Power 10+ skips one step | URR | URR_V80.vehDamage.mode |
| Combat spells at vehicles | armor doesn't count (house row) | Power − half armor, no automatic staging, always a test | URR | URR_V80.vehDamage.mode |
| Passengers when the vehicle is shot | every hit carries through at Power − Armor, a level lower | only when targeted; impacts (rams) carry through at the vehicle's Power and level | URR | URR_V80.vehPassengers |
| Passengers in a crash | crash Power at M | crash Power at the vehicle's level | URR | URR_V80.vehPassengers |
| Shooting a passenger | vehicle Armor adds to theirs | the higher of Body and Armor | house rule for the Revamp (not in the URR); the URR says Body or Armor | URR_V80.vehOccupantArmor |
| Crash Power | speed ÷ 10 rounded down, min 2 | rounded up, min 2 | URR | URR_V80.vehImpact |
| Ram damage | Body + speed ÷ 10; the rammer half the Power | ramming speed (difference in a chase between the two) ÷ 10, up; the rammer same Power less Body + half Armor; level by the speed table | URR | URR_V80.vehImpact |
| Damage and Speed | none | Moderate ×0.75, Serious ×0.5 | house rule for the Revamp (not in the URR); the URR says only that reductions apply | URR_V80.vehDamageSpeed.mode |
| Manual gunnery movement | firing moving +1 (fast +2), target moving +1 | at a vehicle target: speed ratio up to 1.25 0, ×2 +2, ×4 +4, more +6 | URR | URR_V80.vehGunnery.mode |
| Target size | none | drone +1, bike 0, car/truck/boat/hovercraft −1, aircraft −2, ship −3, LTA −6 | URR | URR_V80.vehGunnery.mode |
| Heavy weapon on a mount | recoil doubled after the mount | not doubled | URR | URR_V80.vehMountHeavy |
| Repair TN | 4 | 2/4/6/8 by the worst damage stage | URR | URR_V80.vehRepairTn.mode |
| Terrain | open −1 | open −2 | URR | VEHICLES.terrain |
| Driving rows | easy −1, hard +2, … | non-stressful −1, stressful +3, large +2, very large +3, in combat +2, by datajack −1, congested +2, heavily congested +4, maneuver ahead −1/−2/−3, behind +2/+4, extra opposing vehicle +1 | house rule for the Revamp (not in the URR), from the SR2 driving table (book page to verify), for the non-stressful, stressful, size, combat and datajack rows; URR for the rest | VEHICLES.drivingModifiers |
| Sensor table | Rigger 2 rows | + target in the open −1 | URR | DOCS_V79.vehSensorTable.rows |
| Sensor test action | Simple | Complex | URR | ACTIONS.costs.sensor |
| Guided missile | flies without a lock | needs a sensor lock | URR | DRONES_V73.missiles.needsLock |
| Turrets | no hardpoint | a hardpoint | house rule for the Revamp (not in the URR) | DRONES_V73.mounts.turretNeedsHard |
| Load | 100 kg per person aboard | seated people don't count | house rule for the Revamp (not in the URR) | VEHICLES.cargo.personKg |

#### Drones, security and EW

| Rule | Book way | Revamp way | Source | Switch |
| --- | --- | --- | --- | --- |
| Drone link interception | The link skill (Electronics) vs the radio rule's TN (4, raised by the encryption); a radio or a deck | An encrypted link is decrypted first: Electronic Warfare (Electronics at +2) vs encryption + 4, at least half the target deck's rating (rounded up) in successes; a failed try may be repeated at +2 each (the GM tracks it). Then the interceptor's deck rating vs the target deck's rating + 3 (the drone's Pilot when no deck controls it); one success. Needs a deck. The Task Pool and a decryption module are not added | URR | `URR_V80.dsLinkIntercept`, `DRONES_V73.link.intercept.gear` 'rcd' |
| Listening in on encrypted radio | Electronics vs the encryption, at least 4 | Electronics vs the encryption + 3; needs half the encryption in successes (rounded down, at least 1). Unencrypted radio: as the book. No decryption device rating (no gear field) | URR | `URR_V80.dsRadioDecrypt` |
| Maglock casing by lock type | The casing rating | A card reader's casing counts double; a print or retinal scanner's +2 | URR | `URR_V80.dsLockCasing` |
| Retinal scanner circuit | +3 | +4, as a print scanner | URR | `SECURITY_V57.lockTypes` (patched) |
| Maglock passkey | The rating replaces the skill dice when higher, vs the lock's TN (card reader +2, light, no-tools) | The passkey's rating vs the reader's rating, nothing else; used when its rating is at least the skill dice. The time stays the maglock's | URR | `URR_V80.dsPasskey` |
| Maglock sequencer | The rating replaces the skill dice when higher | Opposed: sequencer rating vs the keypad's, against the keypad's rating vs the sequencer's (the voice-lock flow); more opens it in 10 s ÷ net successes, a tie does nothing, fewer is a failed bypass (tally); used when its rating is at least the skill dice. The casing comes first, as before | URR | `URR_V80.dsSequencer` |
| Weapon detectors | Rating dice vs each item's Concealability (TN 4 with none) | One roll of the rating's dice; every weapon whose TN (with the search's modifiers) is at most the highest die is found. Cyberware scanners and sniffers: as the book | URR | `URR_V80.dsMadScan` |
| Dump shock disorientation | None | Willpower vs 4 after the dump shock test: +2 TN on skill tests for 10 Combat Turns ÷ successes (rounded down), shown on the card; the GM applies the TN | URR | `URR_V80.dsDumpDisorient` |
| Comms ECCM against jamming | The drone's ECCM (0 when not set) | At least 1 | URR | `URR_V80.dsCommsEccm` |

Rows skipped as already so (v0.79.0 made them the default): dump shock trigger and damage ((RCD + 4)S, Body), jamming dumps a remote rigger with dump shock, the flux range table and base flux by device. Rows left to the vehicles area (the same rule there): Control Pool off gunnery and its cap, rigger feedback damage, sensor test modifiers and action cost, sensor capabilities.

#### Magic

| Rule | Book way | Revamp way | Source | Switch |
| --- | --- | --- | --- | --- |
| Casting dice | Sorcery + Spell Pool | the spell's Force + Spell Pool (innate casters unchanged) | URR | `URR_V80.magCastDice` |
| Ranged manipulation TN | the spell's own TN | 4 | URR | `URR_V80.magElementalTn` |
| Visibility on spells | elemental spells only | every spell | URR | `TN_AUTO.magic.environment` |
| Disaster on casting | no effect on drain | +2 drain TN | URR | `URR_V80.magRuleOfOneDrain` |
| Tie on a damaging spell | no effect | takes effect at L | URR | `URR_V80.magSpellTie` |
| Spells sustained | no limit | at most Sorcery (self-sustained) | URR | `URR_V80.magSustainCap` |
| Exclusive spells | drain TN −2 | effect at Force +2, drain at the normal Force | URR | `URR_V80.magExclusiveForce`, `SPELLCRAFT.exclusiveDrainMod` |
| Fetish spells | drain TN −1 | effect at Force +1 (reusable fetish), drain at the normal Force | URR | `URR_V80.magFetishForce`, `SPELLCRAFT.fetishDrainMod` |
| Learning a spell | Sorcery vs Force | Sorcery + Magical Theory vs 2 × Force | URR | `URR_V80.magLearning` |
| Ritual team size | no limit | at most the lowest Sorcery among the members | URR | `URR_V80.magRitualTeamCap` |
| Combat spells by ritual | allowed | not allowed | URR | `URR_V80.magRitualNoCombat` |
| Hermetic ritual site | a sorcery library | a hermetic circle | URR | `URR_V80.magRitualCircle` |
| Ritual materials | per Force (0) | detection and illusion 100¥, health 500¥, manipulation 1,000¥ × Force | URR | `URR_V80.magRitualMaterials` |
| Ritual spotter | no drain | resists drain | URR | `URR_V80.magSpotterDrain` |
| Resisting a ritual | vs Force | vs the higher of Force and the leader's Sorcery | URR | `URR_V80.magRitualResistTn` |
| Conjuring drain | L ≤ ½ Cha, M ≤ Cha, S ≤ 1.5 × Cha; Physical over Magic | L < ½ Cha, M ≤ Cha, S ≤ 2 × Cha; Physical over Charisma | URR | `CONJURING.drainLevels`, `URR_V80.magConjDrain` |
| Nature spirits | one per domain | one at a time | URR | `URR_V80.magNatureOneOnly` |
| Astral Reaction and initiative | Int; Int + 20 + 1D6 | 2 × Int; that + 15 + 1D6 | URR | `URR_V80.magAstralReaction`, `ASTRAL.initiativeBonus` |
| Projection and Essence | free for Essence × 2 h, then 1 per hour or part | 1 per full hour from the start | URR | `MAGIC_EXTRA.projection.hoursPerEssence`, `URR_V80.magProjFullHours` |
| Magician's astral attack | Charisma M; a weapon focus adds dice | unarmed Charisma L; with a weapon focus Charisma + rating M | URR | `URR_V80.magAstralDamage` |
| Astral tracking | 6 h ÷ successes | 12 h ÷ successes; −2 if the Force is at most the tracker's Sorcery, +2 if higher | URR | `TRACKING.baseHours`, `URR_V80.magTrackRating` |
| Drain while projecting | Stun unless Force over Magic | Physical | URR (citing SR3) | `URR_V80.magAstralDrainPhysical` |
| Wards | Conjuring vs Force; no materials; drain Force ÷ 2 M | Sorcery vs Force; 100¥ × Force; drain Force + successes, L Stun; Force at most 2 × combined Magic | URR | `MAGIC_V56.ward.*`, `URR_V80.magWardDrain`, `URR_V80.magWardMaxForce` |
| Libraries and circles | price × rating; a day per rating | library rating² × 1,000¥ (digital); a circle takes an hour per rating | URR | `URR_V80.magSiteCost` |
| Aspected magicians | astral access | sorcerers and conjurers have none | URR | `URR_V80.magAspectedNoAstral` |
| Shamanists | totem dice | no totem dice (spells and spirits still the totem's) | URR | `URR_V80.magShamanistNoTotem` |
| Adepts and foci | any focus | weapon foci only | URR | `URR_V80.magAdeptFoci` |
| Magic loss | 2D6 < Magic | 2D6 ≤ Magic | URR | `URR_V80.magLossLe` |

Known limits: consumable fetishes (+2 Force) aren't modelled (the system has one fetish flag; it takes the reusable +1). The conjuring drain table is the URR's nature-spirit table, applied to elementals too (the URR's elemental section is empty). The sustain limit counts the Sorcery skill's rating only (no concentration or specialisation). Astral tracking keeps the system's freshness modifiers (the URR has none). The elementalist (a hermetic aspect) keeps astral access; the URR names only one-skill "magical adepts". A circle's build time shows as a fraction of a day.

**Known limits (v0.80.0):**
- **Combat:** the whip backlash doesn't see a clean miss. A group attack can still add +4 cover on top of a graded cover row. Indirect fire keeps the book scatter. Knockdown in melee uses the attack's Power (the URR says the attacker's Strength). A melee clean miss is allowed only on full defense (the URR's melee steps).
- **Magic:** exclusive and fetish spells roll their casting dice at the raised Force (the URR: "cast as if at a Force 2 higher"; drain at the chosen Force). The URR's consumable fetish (+2) isn't modelled. Elementals use the nature-spirit drain table. Elementalist aspected magicians keep the astral plane.
- **Vehicles:** the Control Pool on vehicle damage resistance is uncapped (the URR's text and tables disagree). The "roughly equal" speed band is a ratio of 1.25 or less. Crash passengers are hit at the vehicle's level before it resists. Security riggers still fire with the Control Pool.
- **Drones and security:**
  - Interception and decryption leave out the Task Pool and decryption gear ratings.
  - The +2 per failed decryption retry is only a note on the card.
  - The passkey keeps the maglock time.
  - Disorientation after dump shock is a note on the card; the GM applies the +2.
- **Health:** a Deadly surgery wound still makes the patient "dying". Under the Revamp, the first aid card shows "heals up to 0" for a Deadly wound. First aid retry works only for wounds treated after the switch is on.
- **Core:** a 0–0 tie on an opposed test goes to nobody. The trainee's own training test isn't rolled. The +2 for finding gear goes on the character's own roll.
- **Switching sources:** switching the rules source prepares every actor again and re-renders open sheets. An open House rules window re-renders, losing unsaved edits.

### Listed, not built (the Revamp describes them; the system can't run them yet)

#### Core

| Rule | What it would take |
| --- | --- |
| Trying again (URR) | GM guidance; a per-test memory of failed attempts and their TN/dice to block a retry (new flags on the card and a check in every roll path). |
| Teamwork, pooled successes (URR) | The URR leaves it to the GM; the existing helpers rule stays (house rule `STREET.tests.teamwork.cap` 'none' lifts the cap). Pooling successes would need a new card that sums several actors' results. |
| Team Karma Pool (URR) | A world-level pool (a setting or a party actor) that every sheet can spend from, with refresh and join rules. |
| Karma rolls for luck (URR) | A "Roll Karma Pool" button and dialog on the sheet (new action, not a change to an existing one). |
| Optional Social and Athletics pools (URR) | Two new pools: data-model fields, refresh, sheet rows and pool pickers in every dialog. (The Dodge pool and the pool cap belong to the combat area; the Magic, Astral and Hacking pools to the combat/magic areas.) |
| Languages as specializations of a language family (URR) | Language families as general skills with specializations; a data change for every language skill and the creation build check. |
| Built-in Skill Web | Seeding the GM's web from the URR's skill web diagram; for now the GM types the links. |
| Training test, money, daily limits, extended and breakthrough training (URR) | A trainee's training-test button in Under way, nuyen charged and refunded with the training, a daily-hours schedule with Willpower tests, and two more training modes in Spend Karma. |
| Knowledge skill points at creation (URR) | The URR only notes it as planned (3 × Intelligence?); `CREATION.knowledgePerInt` is already a house rule. |
| Fitness rating (URR) | A new derived value (Strength + Quickness) / 2 and where it is used. |
| Availability of ratings over 6 (house rule for the Revamp (not in the URR)) | Their wording is unclear; a rating-based Availability step in `parseAvailability` for gear with ratings. |
| Upgrading gear and cyberware (house rule for the Revamp (not in the URR)) | An "Upgrade" action pricing the rating difference (+20% labour for B/R items). |
| Lifting extra weight (house rule for the Revamp (not in the URR)) | A lift action (+Strength × D6 kg for Body turns, then 1 Stun a turn); the carrying rules are the health-social area's. |
| Finding a fence and getting caught (house rule for the Revamp (not in the URR)) | A fence-search test (Street Etiquette vs 4, 10 days ÷ successes, team averaging, fence funds 2D6 × ¥100,000) before the Fence button, and a daily heat roll while searching (any 6). |
| Asking a contact to investigate (house rule for the Revamp (not in the URR)) | A legwork option at +2 TN that answers after 2D6 hours (a timed project). |
| Running multiplier, carrying capacity, Negotiation's attribute | Owned by the health-social and combat areas (they patch those paths). |

#### Health and social

| Rule | What it would take |
| --- | --- |
| Minimum lifestyle while healing, and its daily cost (lifestyle ÷ 30) | A cost step in `naturalHeal` comparing the wound's lifestyle with the actor's, charging per day of rest; a new table and a payment prompt. |
| Doctor and paramedic fees (50/100/200/400 per day) | A fee per day in `careCost` for care with a doctor, by wound level; the rest dialog needs a "doctor's fee" line. |
| Permanent injury test on a Deadly wound (Body vs 4, +2 after a trauma patch) | A test card after a Deadly wound heals or stabilises, plus a way to record lost limbs/organs and lowered attribute maximums (new data fields and a migration). |
| Organ and limb replacement | New items or a data model for replacement grades, grow times and costs. |
| Elective surgery for cosmetics (Light wound, no Essence) | Surgery records keyed by Essence; a cosmetic surgery has none, so it needs a surgery kind field. |
| Toxins test every interval while exposed | A timed toxin effect (like diseases) that re-rolls each interval: a new timer on the drug/toxin record. |
| Skill tests while walking/running (+1/+2, difficult +2/+4) | A movement field on every skill test dialog, or tracking movement per phase. |
| Sprinting (Athletics vs 4, +1 Quickness per success for run speed) | A new athletics kind with a run-speed card; the movement ruler would need to read it. |
| Fitness on the sheet | Built only inside the athletics distances; showing it needs a derived field and sheet UI. |
| Encumbrance bands (5×/10×/15×/20× Strength; +1..+3 TN, −1..−3 initiative, walk halved/quartered, pass out) | Replace `COMBAT.load`'s Quickness loss with TN and initiative modifiers fed into every test and the initiative roll. |
| Lifting and carrying heavy objects, throwing heavy objects | A new lift test and a throw-range calculation (no existing mechanic). |
| Holding breath: the bonus Body vs 4 test (+10 s per success) | A roll when breath-holding starts, stored with the drowning turn count. |
| Falling: an Athletics test vs the height adding successes to the Body test | `resistDamage` would need extra successes from a second roll. |
| Climbing condition modifiers (overhang +2, over 4 m +4, wet +2, greased +4), assisted climbing, ascenders, rappelling | New options in the athletics dialog and new athletics kinds with their own distance rules. |
| Group perception (average Intelligence + 1 die per member) | A group selection in the Perceive dialog. |
| Two-stage sneaking, stealth distance on the sneaker, shadowing, sleight of hand | A new stealth flow (environment TN, then perception vs 4 + sneaker successes). |
| Prejudice by random intensity (2D6 − 6) and the Charisma test against it | A stored prejudice on NPCs (metatype and intensity) and a pre-test card. |
| Conspicuous cyberware (+1 per 2 Essence with luxury or no-PR characters) | A "conspicuous" flag on cyberware items (data field and migration). |
| Social perception (Charisma vs the target's Charisma) | A new test kind in the social dialog. |
| Social challenge (open test: the target's attribute vs the challenger's result) | A new open-test social flow. |
| Stun recovery reset when rest is interrupted | A rest-in-progress clock (flag) cleared by damage or actions. |

Skipped (the system already does it, from v0.79.0): self-recovery gate, healing stages and times, doctoring table, first aid TNs, first aid dice and modifiers, the Perception success table, the visibility rows for normal, low-light and thermographic vision, glare, mist, smoke and weather, the one-sided social test, attitudes, desired-result scale.

#### Combat

| Rule | What it would take |
| --- | --- |
| Surprise modifiers (house rule for the Revamp (not in the URR): −2 ambusher, −1 trained, +1 distracted) | a per-combatant pick in the GM's Surprise test (a dialog before `rollSurprise`); the URR's surprise turn itself is v0.79.0's |
| Ambush rating vs response rating (+2 initiative per net success) | a team test and team ratings: a new subsystem |
| Team tactics test (+1 initiative per 2 successes) | a leader's test feeding every teammate's initiative: a new subsystem |
| Quick draw: Quickness (4) test to draw and fire as one Simple Action | a test step in the ready-weapon action |
| Sprint test (Running vs 4, Complex) | movement tests from the token ruler: a new mechanic |
| Interception (a free melee attack at 4 on someone passing within 1 m) | detecting movement past a token and an out-of-turn attack |
| Optional dodge pool (half the pool at the refresh, +1 TN to be hit per success) | a pool split at the refresh and a standing TN modifier: a new pool |
| NPC morale by threat level (Willpower vs 4 after a Light/Moderate/Serious wound by level 1/2/3; level 4 fights to the death) | a per-NPC threat level and a check after each wound; the system's morale is a group test |
| Templates for the sporting rifle, MMG, HMG and assault cannon ranges | new item templates (data in config.ts) |
| Confined spaces: rebound waves by the distance travelled | tracing the rebounds off each wall |
| Melee against several targets (+2 per later target, pool split, a counterattack stops the chain) | a multi-target melee attack with opposed tests per target |
| Pulling punches, physical with stun, knockdown attacks, disarming | new melee options with their own tests |
| Martial arts maneuvers and styles | a maneuver list and style data |
| Suppressive fire as an area (each round covers 1 m for 10 phases; passers roll rounds vs 4) | a region with a per-phase test for anyone crossing it |
| Barrier rating table (glass 2 … hardened 32) | a preset list in the wall config |
| Explosive rounds misfire on all 1s (the round explodes: weapon damage, 1D6 successes) | a disaster effect for explosive ammunition with its own damage card |
| Full auto: the shooter picks each burst's size | per-target round counts in the Attack dialog |
| Anti-personnel warheads also as flechette; anti-vehicle warheads halve armor and barriers | blast extras for the rocket kinds (the falloffs are built) |
| Shot: a smartlink only −1, goggles and laser no help; +1 resistance die per target hit before | the shotgun path in the Attack dialog adjusting those rows and each later target's soak |
| Charging miss: Quickness (5) or fall; counterattacked +2 to the knockdown TN | a follow-up test on the miss card |
| Subdued at 10 Stun boxes, held with Strength tests | a subdued status and its upkeep test |
| Speed loader: a whole cylinder per Complex Action | a speed-loader accessory on weapons |
| Delaying into a later pass forfeits that pass's own action | marking the next pass's action as used when a carried delay is taken |

Not changed (already so, or another area's): reload clips, Combat Pool cap, weapon ranges, Strength ranges, smartlink, minimal light, recoil per burst and per round, flechette, reach, superior position (all v0.79.0 and as the URR gives them); grenade range TNs (the system matches the URR); Spell Pool (v0.79.0); full defense's action cost (the URR doesn't change it); trolls running ×2 (`METATYPES.types.troll.run`, patched by the health-social area); firing from a moving vehicle (the vehicles area's gunnery); the Hacking Pool (no formula in the URR's text to build from; the Matrix pools are left as they are).

#### Vehicles

| Rule | What it would take |
| --- | --- |
| Overflow damage (Body × Body boxes), explosions, the overflow system-damage table | A vehicle condition track beyond 10 boxes (model field, sheet, repair) and a d6 table on the soak card. |
| Stress (points, factor per Body, failure, clearing) and stress dice | A new vehicle track with its own tests and upkeep. |
| Speed boost up to 1.5× Speed | Depends on Stress; the speed window would also need a 1.5× cap. |
| Acceleration as a test for every change (Accel × successes) | Rework of the speed window (no free Accel). |
| Low-speed maneuvers (walk/run at ≤ Accel/2× Accel, no tests) | A mode on the speed window. |
| Chase model by distance bands, maneuver tests and the Rigger 2 maneuver score | A new chase subsystem (bands, lead vehicles, driver actions). |
| Driver actions (position, evasion, stunt, push-off, hide, seek, escape) | New actions, opposed tests and outcomes. |
| A driver who takes no driver action must make a crash test | Turn tracking for drivers in the combat tracker. |
| Passengers can't act in a later phase than the driver | Combatant linking in the combat tracker. |
| Ram range (contact distance) and the opposed ramming test with the Body-Armor factor | Distance bands and an opposed ram test. |
| Barrier collisions (breakthrough force table, impact force) and barrier-free crashes (speed ÷ 20) | A crash dialog that asks what was hit, and the barrier table. |
| Pedestrian collisions (Power speed ÷ 10, a level up; the vehicle one lower) | A new action against a character. |
| Vehicle damage to the driver's initiative (L −1, M −2, S −3) | A hook in the initiative wound penalty for the vehicle's driver. |
| AutoNav assisting a human driver (dice on crash tests, +rating TN in combat) | An "AutoNav active" state on the vehicle. |
| Passenger safety gear (seat belt −1 level, APPS half Power, roll cage +6 dice) and the driver's control dice shared | Vehicle fields for the gear and passenger resist options. |
| Shooting a passenger: no Combat Pool, a jacked-in rigger +3 on resistance, a Deadly hit also L to the vehicle | Options on the resist flow for occupant hits. |
| The full manual gunnery table (walking/running drone, smartlink, cover +2/+4/+6, towards −1 / away +1, maneuver score ±1) | New rows in the Attack dialog for mounted fire. |
| Sensor-enhanced gunnery as a Complex Action | A separate action cost for a locked shot. |
| Optical sensor tests (Pilot or Int + autosoft vs 4) and flux-based sensor ranges | A new sensor test kind and range table (with the drones rules). |
| Ordnance strikes at the end of the turn, scatter | A delayed-strike step in combat. |
| Repair by stages (each stage separately), parts cost 2.5% of value per box, mechanic contacts | A vehicle value field and stage-by-stage repair projects. |
| VCR skill-web defaulting at +1 per step (house rule for the Revamp (not in the URR)) | A rig-aware step size in the skill web defaulting. |
| Turret hardpoints by size (1/2/3/4/6) and weapon value | A turret size field and the Rigger 2 weapon value table. |
| Drone size chart | Reference only. |

Skipped (not a real difference, or the system already does it): control rig −1 per level (the system's value; the URR agrees), over-Speed +1 (v0.79.0), crash test modifiers (terrain, rig, over Speed, damage: already applied through the driving test), the impact damage level table (v0.79.0), mount recoil halving and pintle/ring compensation (v0.79.0), sensor-enhanced gunnery dice and modifiers (v0.79.0), repair time 16 h per box ÷ successes (v0.79.0), vehicle skill default, overload, chase speed advantage and stun against vehicles (system-only rules the URR doesn't cover), the sensor dice (Sensor rating: only the Control Pool part differed).

#### Drones, security and EW

| Rule | What it would take |
| --- | --- |
| Subscriber list 2 × RCD rating, affiliated list 1 × | A second list on the rigger (`rigging.affiliated`), a migration, sheet controls to affiliate (a Simple action), and command gating to affiliated drones only. Patching `RIGGING.remote.dronesPerRating` to 2 alone would let a rigger command twice the URR's affiliated count |
| Captain's Chair mode (and VCR initiative in it) | A new control mode on the rigger with its own initiative source, +2 TN to non-drone actions, and drones rolling Pilot; touches the combat tracker and the control panel |
| Secondary drones while in primary control | Per-drone observe/comprehension state and a +2 TN on comprehension; needs the chair/affiliation model above |
| Comprehension test for commands; preprogrammed commands | A command-complexity dialog (Pilot + Non-Matrix Programming vs complexity) and stored commands on the deck (memory, programming time); new data on the RCD |
| IVIS dice | A per-turn IVIS pool (Vehicle Tactics vs 5) on drones, refreshed each turn; a new pool |
| Drones act at the rigger's initiative (at most Pilot passes) | Combatant linking in the combat tracker (drones without their own roll, acting in the rigger's passes from the lowest) |
| AutoNav on/off as an action | A toggle with an action cost (Free rigged, Simple otherwise) on the vehicle sheet |
| AutoSoft kinds (DataLink, Electronic Warfare, Performance Profile), the 2 × Pilot total and memory | New autosoft fields on the vehicle model, a migration, and a check on loading; the total cap needs a rule for which autosoft gives way |
| Cranial remote deck; hardwired RCD flux (+ Body ÷ 2); vehicle-boosted flux | A deck kind or a vehicle dock link on the gear, read by the rigger's signal |
| Situational flux modifiers (elevation, ECCM, storm, encryption, humidity, urban) | A conditions picker on the remote link (or scene weather/region hooks) feeding the flux rating |
| Opposed ECM and Electronic Deception against sensor tests | A second opposed step inside the sensor test (the vehicles area's sensor test), with ED/ECD as new vehicle stats |
| Spot jamming as a two-step opposed test; barrage jamming; scanning for a frequency | A frequency-known state on links and radios, the ECCM step, a barrage mode on the jam dialog hitting every radio in range at flux − 1, and a scanner test (rating vs device + 3, 30 min ÷ successes) |
| MIJI attacks, the signal condition monitor, signal regeneration, takeover by interference | A 10-box signal track per RCD network with TN steps and per-channel jam/disrupt effects; a URR redesign, a new subsystem |
| Security ratings (technical rating, vigilance code, Overall Security Level) and the level tables | New site fields and a migration, plus GM-guidance tables |
| Alert condition monitor and response by hit level | The URR's alert track (a new subsystem replacing the tally) |
| Per-device detection procedures (motion, vibration, pressure plates); spotting devices | New sense-specific tests on site devices and an Electronics identify test; extends the detection test by device kind |
| Real and phony prints against print scanners | A print item (rating, decay per hour, Biotech fabrication) and an opposed print test; new gear data |
| Cyberware scanning by Essence; chemical sniffer modifiers | Cyberware concealment from Essence and grade (12 − 1 per 0.5 Essence) and explosive quantities on carried items; the search's item data lacks both |
| CCSS access (datatap, decryption, protocol emulation), rigger vs rigger, a rigger's perception of device activity, decking into a CCSS | A security-rigging subsystem on the site (new tests and state) |
| Wire barriers; fiber-optic image links | Barrier presets and a spell TN/drain modifier by cable length; magic-security overlap |
| Pull/lift, mechanical arms, take-off and landing | New vehicle tests (vehicles area) |
| Passkey and sequencer times (10 s ÷ successes) on the circuit | The circuit step's time uses the maglock's base; the passkey's own time would need the tool on the bypass snapshot |

#### Magic

| Rule | What it would take |
| --- | --- |
| Spell stacking (several spells in one action, +2 TN each) | A multi-spell casting dialog and one drain per spell from a shared action: a new casting flow. |
| Area adjusted by withheld dice | A "dice withheld" field in the casting dialog and an area-radius override carried to the template; small, but the area template isn't driven by the cast. |
| Splitting Force over several targets | One success test per target at its share of Force, and a drain test per target at the total: a new casting loop. |
| Detection range from a Force test vs 4 × Magic | A second roll at cast time and the range stored on the sustained spell for the range warning. |
| Cover +2/+4/+6 on spells | A cover choice in the spell dialog (the attack dialog's cover is for weapons). |
| +1 TN per 2 points of someone else's circle or lodge | Knowing whose site the caster stands in (site regions or a dialog pick). |
| Noticing spellcasting | A new perception test against (Magic − Force) × 2, offered to onlookers per cast. |
| Instructor fee and Teaching bonus | A teacher pick in the learning dialog, a fee and a Teaching test lowering the TN. |
| Ritual Magic Pool (the team's pools pooled and split over link, sending, success and drain) | A ritual-pool state across the stages and a split dialog: replaces the ritual flow. |
| Material link and sending tests (TNs 5/7/9/11 and 6/8) | Two new stage tests in the ritual flow, fed by the ritual pool. |
| Ritual time (link and sending each Force ÷ successes) | Follows the two stage tests above. |
| Noticing a ritual (Int vs Force − hours into the sending) | The ritual notice test with the sending's elapsed hours and the target's Magic. |
| Sustaining ritual spells (leftover pool, elementals for Force days) | The ritual pool, and a days-long sustain entry for elementals. |
| Spell signature observe and identify tests; altering a signature | Two new tests (perception vs Magic; Sorcery vs the caster's Sorcery) and an initiation option. |
| Sustaining while projecting (not allowed) | A hook on the astral mode change that drops self-sustained spells. |
| Unconscious summoner: the spirit departs | A hook on the summoner's condition that releases nature spirits. |
| Voudoun and the Loa | A new tradition with mounting: new data and rules. |
| Assensing results table (0–4+ by emotions and cause) | The system reveals facts per level; the URR's table is different content, a rewrite of the assensing card. |
| Assensing through water or flames (+1/+2/+3) | A condition pick in the assensing dialog. |
| Astral examination | A new test (skill vs the creator's skill, Force or 5; +2 per retry) with its own result table. |
| Astral movement rates | Movement isn't modelled on the astral plane. |
| Locating the moved body | A new test (Willpower or Body vs 4, 6 h ÷ successes). |
| Astral Combat Pool ((Cha + Int + Wil) ÷ 2) | A new dice pool with its own refresh and spending (listed in the brief as a whole subsystem). |
| Circles and lodges as astral barriers; magical items as barriers | Barrier actors made from sites and items. |
| Intercepting spells; astral evasion | New astral actions with delayed-action handling. |
| Astral first in the combat order | Combat tracker ordering by plane. |
| Ward size, duration (successes days), permanent wards for Karma | Fields on the ward barrier and an expiry clock. |
| Attenuated, concealment, masking and alarm wards | Ward variants with their own tests. |
| Losing totem advantages for out-of-character play | A GM toggle on the totem and a Magic loss step. |
| Hurling Force (adept power) | A new adept power special with knockback. |
| Stim patch Magic test (Magic vs the stims' total rating in 24 h) | A 24-hour stim log on the actor and a test on each patch (overlaps health-social's patch rules). |

Skipped (already so): Spell Pool from Sorcery, the casting cap at Magic, spell defense spent on use (all v0.79.0, and the URR matches); first aid +2 on magicians (v0.79.0 `DOCS_V79.firstAidMods` has it); attacker staging per 2 net successes is the global `ATTACK_STAGING` (the combat area's); the URR's other conjuring headings are empty; Magic loss on treatment without the +2 is the health-social area's.

## Book check (v0.77.0, 23 Oct 2026; rules changes v0.78.0)

Where a row further down describes a rule this section changed (v0.77.0 values, v0.78.0 rules), this section is the current one; the older row is what the old way (the house rule) does.

The first check of these numbers against the official books (mostly SR2-era books; each row names the book). About 195 rows below were compared: **56 match, 53 were wrong, 85 match in part**; about 540 rows have not been checked yet. SR3 material never overruled SR2. Every change to a `RULES` value keeps the old value reachable as a house rule (set the path back); the stat-block importer's tables (adept power costs, spell types, the Killing Hands letters) are code, not house rules.

### Changed in v0.77.0 (old → new)

| Rule | Was | Now | Official source |
| --- | --- | --- | --- |
| Social tests (`SOCIAL.skills`) | Negotiation and Leadership vs Charisma | Negotiation vs Willpower, Leadership vs Intelligence | Core Rules (skill text) |
| Grenade falloff (`COMBAT.grenades`) | defensive −1 Power per 2 m; flash −1 per metre | defensive −1 per 0.5 m (`perMetre: 2`, counted in whole metres); flash 5 per metre (a 1 m blast) | Core Rules / Fields of Fire / Street Samurai Catalog |
| Increase [Attribute] vs cyberware (`MAGIC_V61.attributeSpells.exclusiveWithCyber`) | off | on | Grimoire |
| Area spell radius (`MAGIC_EXTRA.area.radiusFrom`) | Force metres | the caster's Magic in metres | Core Rules |
| Spirit initiative (`MAGIC_V61.spiritInitiative`) | nature/elemental +10, +20 more astral | every spirit +10 manifest, +20 astral | Core Rules |
| Critter Confusion (`CRITTERS_V56.powerMods.confusion`) | + net successes to TNs | + the power's rating (Essence) | Core Rules |
| Critter Guard (`…powerMods.guard`) | + rating TN to attacks | no TN (prevents accidents only) | Core Rules |
| Adepts in astral combat (`MAGIC_V72.adeptAstral.enabled`) | on (Unarmed Combat, an SR3 rule) | off: they fight with Sorcery as magicians; the Unarmed rule stays a house rule | Core Rules |
| Killing Hands levels (`ADEPT.killingHands.levels`) | M/S/D | L/M/S/D; the world migration moves saved powers up one level so they keep their damage (not when the levels are a house rule); the importer reads L/M/S/D as levels 1–4 | Core Rules |
| Adept power costs (stat-block importer) | improved reflexes 2/3/5 with +2 Reaction; combat sense 1/level; mystic armor 0.5 ballistic+impact; spell resistance 0.5; killing hands 0.5/1/2 | improved reflexes 1/4/6 dice only; combat sense 2/3/4; mystic armor 1 per point, impact only; spell resistance 1; killing hands 0.5/1/2/4 | Core Rules, Awakenings |
| Stat-block spell table | Combat Sense, Antidote, Cure Disease, Detox, Stabilize, Prophylaxis, Hibernate mana; Shapechange resisted by Body | Physical; Shapechange voluntary | Grimoire |
| Remote control deck (`RIGGING.remote.dronesPerRating`) | 2 drones per rating | 1 (one slave port each) | Core Rules |
| Commanding drones (`ACTIONS.costs.droneCommand`) | Simple Action | Complex Action | Core Rules |
| Lock types (`SECURITY_V57.lockTypes`) | card +0, print +2 | card +2, print +4 | Corporate Security Handbook |
| Bypass time (`SECURITY.bypassTime.baseTurns`) | maglock 10 Combat Turns; the casing step took no time | maglock circuit 20 (60 s); casing step 20 (60 s), each ÷ successes | Corporate Security Handbook |
| Extended-volume lungs (`HEALTH_V72.bioware.vitals.extendedVolume.breathTurns`) | 10 turns per level | 15 (45 s) | Shadowtech |
| Item templates | taser 10M SS; bow +0 cap 6; club reach 0; pole arm +3; sword +3; form-fitting 3/1 stacking; riot shield 0/2 4 kg; flash grenade 1L stun 30¥; remote deck 5,000¥; assault rifle 30 rounds; sniper rifle 8,000¥; grenade launcher 2,000¥; missile launcher HE blast with AV guidance; combat spell M; climbing gear 200¥ | taser 10S SA; bow (Str Min 3 + 2)M; club reach 1; pole arm (STR)S; sword (STR+2)M; form-fitting 4/1, not with other body armor; riot shield +1 ballistic, 2 kg; flash grenade 5L in 1 m, 40¥; remote deck rating 2 = 100,000¥; assault rifle 40; sniper rifle 4,000¥; grenade launcher 1,600¥; missile launcher an HE missile (guidance 3, not AV); combat spell = Mana Bolt S, drain S; climbing gear (ascent/descent kit) 250¥ | Core Rules, Street Samurai Catalog, Fields of Fire; the rest official SR2 rules (book page to verify) |

### Changed in v0.78.0: rules the book models differently (each with the old way kept)

Every row is a house-rule switch in `RULES.BOOK_V78` (`rules/config78.ts`; Configure Settings → House rules, each row says "the book" and "old"); the first choice is the book's way and the default.

| Rule (switch) | Old way | Now (the book) | Official source |
| --- | --- | --- | --- |
| Legwork (`legwork.mode`) | TNs 3/4/6/8, −1 TN per contact level | TNs 2/4/6/8/12/14 (general … top secret), contact's specialty −2, fixer or Mr. Johnson −3, friend of a friend +2; a buddy +1 die, a friend for life +2 dice (VERIFY the dice) | Core Rules (contact knowledge table) |
| Flash grenade (`flash.mode`) | blind (+8 attacks/spells) for 3 Combat Turns; flare compensation immune | +6 TN to every test, −1 per 5 m, nothing beyond 30 m, halved by flare compensation, for 5 Combat Turns −1 per 2 successes on Body (5); everyone with a clear line counts as looking toward it (no facing in Foundry); the 5L blast within 1 m still hits | Street Samurai Catalog (AFR-7) |
| Monofilament whip (`COMBAT_V61.monowhip.on` 'defended') | a botch hits the wielder | only an attack turned aside solely by the defender's pool successes: the wielder's whip check (skill vs 6), no successes = struck, impact armor halved | Core Rules |
| Stim patch (`patches.stim`) | back after rating hours | back after 2D6 minutes (+1 box) | Core Rules |
| Tranq patch (`patches.tranq`) | Body vs rating, boxes = rating − successes | opposed: rating vs Body, Body vs rating, net patch successes = Stun boxes | Core Rules |
| Toxin extractor, tracheal filter (`toxinBioware`) | +1 die per level | −floor(level ÷ 2) Power against injected / inhaled toxins (and smoke) | Shadowtech |
| Symbiotes (`symbiotes.mode`) | +1 healing die per level | natural healing time × 90 / 70 / 50 % | Shadowtech |
| Encephalon (`encephalon.mode`) | + rating dice on Intelligence, knowledge and language skills | +1/+1/+2/+2 Intelligence when defaulting on the skills it helps (Intelligence, knowledge, B/R) and a Task Pool of 0/1/2/3 dice (refreshes each Combat Turn, not used up outside combat) | Shadowtech |
| Mana barrier (`manaBarrier`) | the rating as the target's resistance dice; rating = Force | + the rating to the caster's TN (wards keep resistance dice); a Mana Barrier spell's rating = half its Force | Core Rules |
| Invisibility (`invisibility`) | Intelligence vs the Force, more successes than the caster's | Perception vs 2 × the caster's successes, one success sees through; thermographic sight sees through (mana) Invisibility | Core Rules |
| Focus bonding Karma (`focusKarma.mode`) | spell 1, sustaining 1, spirit 1, power 5, weapon 3 (× rating) | named spell 1, spell category 3, spirit 2, power 5, weapon 4 (small) / 5 (large) × rating; a spell lock 1 flat (new focus field: weapon size) | Core Rules (focus bonding table) |
| Power focus (`powerFocus`) | + rating dice to Sorcery and Conjuring | + rating to the Magic for drain and to the Spell Pool | Core Rules |
| Insect flesh forms (`insectFlesh.mode`) | host + half Force | soldier host + Force, worker host − 1 (from the spirit type's name; soldier otherwise) | Grimoire, Bug City |
| Critter immunity to poisons and pathogens (`critterToxins.mode`) | no effect at all | + 2 × Essence resistance dice | Core Rules |
| Paralyzing Touch (`paralysis.mode`) | no actions for net successes Combat Turns | −Essence Quickness for 2D6 minutes (stacks); paralysed at Quickness 0 (Bug City's version differs: VERIFY) | Core Rules |
| Adept Combat Sense (`combatSense`) | + dice on dodge, melee defense and surprise | + level to the Combat Pool; the Combat Pool helps on surprise tests | Core Rules |
| Magic (spell) resistance (`spellResistanceVsPowers`) | against spells and critter powers | against spells only | Awakenings |
| Tamper alarms (`tamper.mode`) | an opposed roll after the circuit opens | the anti-tamper rating adds to the casing TN (the circuit's when there is no casing); 0 successes trips it | Corporate Security Handbook |
| Barrier damage (`barriers.mode`) | Power − rating off the rating | rating doubled against gunfire, melee and combat spells; below half nothing, up to the adjusted rating −1, above it −1 and a ½ m hole per half-rating step over (VERIFY the top row); base Power (before burst or auto); an ordinary door breaks at half its rating, a security door (a wall config tick box) at 0 | Core Rules |

Not done (scoped out): the stim patch's magician Magic test; the antidote patch's dermal-armor and blood-filtration limits; the trauma patch's Body test; spell foci on drain and category foci on resistance; the security rigger's device cap and passive-awareness table; the extra stun-weapon disoriented state.

### The owner's decisions (23 Oct 2026, done in v0.78.0)

| Question | Decision | Done |
| --- | --- | --- |
| Allergy severity levels | the Allergy note's Nuisance / Mild / Severe / Extreme; "Moderate" (the Ghoul note) counts as Mild | `BOOK_V78.allergy` (Severe and Extreme +2 Power for weapons of the substance; Extreme also a Light wound on contact) |
| Voice locks | the book: no Electronics bypass; only a voice-deception device | `BOOK_V78.voiceLocks` 'deception': gear with the bypass tool "Voice deception" or an installed voice modulator/synthesizer; device rating vs the lock's, the lock's rating vs the device's, ties repeat |
| Riot shield melee modifier | no parry bonus | template parry 0 (was 1) |
| Hibernate | the spell page: Physical, touch, TN 4, sustained, (F/2)S, voluntary or unconscious subject (it is a spell, not a critter power; the adept power Suspended State works like it) | the stat-block importer's spell table |
| Club reach | keep 1 | no change |
| Cybereyes and cyberears | the Core Rules allowance: cybereyes take enhancements up to 0.5 Essence free; cyberears one feature of 0.2 or less | `BOOK_V78.senseAllowance` (importer); templates cybereyes (low-light) 0.2 / 8,000¥, cyberears (amplification, damper) 0.4 / 11,000¥ |
| Anti-vehicle rocket falloff | −1 per 4 m for now (as the anti-vehicle mortar round); **v0.92.4: the book's −8 per metre (Core p. 99), the owner's decision of 12 Nov 2026** | `COMBAT.grenades` avRocket perMetre 8 (the old 0.25: `COMBAT_V923.avRocket` 'old'). Fractional falloffs lose whole points of Power (`blastLoss`) |
| Remote / rigger adaptation costs | the rules text for now | `BOOK_V78.adaptation` 'text': remote adaptation 2,500¥ × Body (a new modification row), rigger adaptation 2,800¥ (`riggerAdaptationCost`) on top of it. **VERIFY: the tables have the two swapped** |
| Passkey cost | SR2 core: 10,000¥ × Rating (**final: the owner kept the Core price, 12 Nov 2026**; the Corporate Security Handbook says × Rating²) | a Maglock passkey template (rating 4, 40,000¥) |

### Confirmed against the books (no change needed)

- Adept power points — Awakenings - Second Edition
- Adept powers: distance strike — Awakenings - Second Edition
- Adept powers: improved senses — Core Rules - Second Edition
- Adept powers: rapid healing — Awakenings - Second Edition
- Adept specials: astral perception — Core Rules - Second Edition
- Adept specials: pain resistance — Core Rules - Second Edition
- Ammunition (APDS, EX) — Street Samurai - Second Edition; Fields of Fi
- Armor layering — Core Rules - Second Edition
- Armor templates (jacket, vest, clothing, helmet) — Core Rules - Second Edition
- Bipod, tripod, shock pad — Core Rules - Second Edition
- Blaster, sparky — official SR2 rules (book page to verify)
- Calculator (Rule of Six, TN 7 = TN 6) — SRII (book page to verify)
- Combat Pool — SRII (book page to verify); Street Samurai Catalog
- Combat spell TN — Core Rules - Second Edition; Grimoire - Secon
- Control rig (Reaction, dice, max level) — Core Rules - Second Edition; Corporate Securi
- Control rig (other cyber reflexes do not count) — Fields of Fire / Cybertechnology - Second Edi
- Creation costs (free contacts) — Core Rules - Second Edition
- Drain TN — Core Rules - Second Edition
- Drain damage type — Core Rules - Second Edition
- Elemental manipulation spells — Core Rules - Second Edition
- Essence loss — Core Rules - Second Edition
- Full cover — Core Rulebook - Second Edition
- Grenade kinds (offensive, concussion) — Fields of Fire - Second Edition
- Healing drain — Core Rules - Second Edition
- IC TNs (crippler/ripper target a persona program) — official SR2 rules (book page to verify)
- Importer adept costs: pain resistance, rapid healing, missile parry, distance strike, astral perception — Core Rules - Second Edition; Grimoire - Secon
- Item templates (detection spell) — Core Rules - Second Edition
- Item templates (jammer) — Core Rules - Second Edition
- Item templates (knife, stun baton, monowhip, throwing knife, offensive grenade) — Core Rules - Second Edition; Fields of Fire -
- Item templates (monofilament whip) — Core Rules - Second Edition
- Item templates (power focus) — Core Rules - Second Edition
- Killing hands vs immunity — Core Rules - Second Edition
- MPCP limits — Shadowtech - First Edition
- Magic loss (trigger) — Awakenings - Second Edition
- Magic weapons vs immunity — Core Rules - Second Edition
- Maglock types (casing) — Corporate Security - Second Edition
- Matrix initiative — Shadowtech - First Edition
- NPC ratings (Professional Rating 1–4) — Corporate Security - Second Edition; other SR
- Physical adepts' Spell Pool — Core Rules - Second Edition
- Powers that change TNs: Concealment — Core Rules - Second Edition
- Powers that change TNs: Movement — Core Rules - Second Edition
- Ranged defense / Combat Pool on soak — Core Rules - Second Edition
- Reaction — Street Samurai - Second Edition
- Rule of One — SRII (book page to verify)
- Searching — Core Rules - Second Edition
- Shadowtech bioware (suprathyroid) — Shadowtech - First Edition
- Silencer / suppressor — Core Rules - Second Edition
- Social tests (Etiquette, Interrogation) — FASA7901 - Core Rulebook - Second Edition
- Spell resistance — Core Rules - Second Edition
- Spirit attributes — Core Rules - Second Edition
- Stat-block import (control rig Essence) — Fields of Fire / Cybertechnology - Second Edi
- Stat-block spell table: spells that agree — Core Rules - Second Edition; Grimoire - Secon
- Tar baby, tar pit — official SR2 rules (book page to verify)
- Template list prices (datajack 1,000) — Core Rules - Second Edition
- Time ÷ successes — SRII p68
- Totems (dice) — Core Rules - Second Edition
- Treat time limit — Core Rules - Second Edition
- VERIFY.md line 1197 / 1060: Negotiating pay — FASA7901 - Core Rulebook - Second Edition
- VERIFY.md line 654 / 844: Item templates (LMG) — Street Samurai - Second Edition; Core Rules -
- VERIFY.md line 654 / 844: Item templates (SMG) — Fields of Fire - Second Edition; Street Samur
- VERIFY.md line 654 / 844: Item templates (armor jacket) — Core Rules - Second Edition
- VERIFY.md line 654 / 844: Item templates (armor vest) — Core Rules - Second Edition
- VERIFY.md line 654 / 844: Item templates (armored clothing) — Core Rules - Second Edition
- VERIFY.md line 654 / 844: Item templates (datajack) — Core Rules - Second Edition
- VERIFY.md line 654 / 844: Item templates (dermal plating 1) — Core Rules - Second Edition
- VERIFY.md line 654 / 844: Item templates (heavy pistol) — 1E - Core Rules - pg 119, 135; 2E - Core Rule
- VERIFY.md line 654 / 844: Item templates (helmet) — Core Rules - Second Edition
- VERIFY.md line 654 / 844: Item templates (hold-out pistol) — 1E - Core Rules - pg 135; 1E - Core Rules - p
- VERIFY.md line 654 / 844: Item templates (knife) — Core Rules - Second Edition
- VERIFY.md line 654 / 844: Item templates (light pistol) — 1E - Core Rules - pg 119, 135; 1E - Core Rule
- VERIFY.md line 654 / 844: Item templates (medkit) — Core Rules - Second Edition
- VERIFY.md line 654 / 844: Item templates (offensive grenade) — Fields of Fire - Second Edition
- VERIFY.md line 654 / 844: Item templates (shotgun) — Fields of Fire - Second Edition
- VERIFY.md line 654 / 844: Item templates (smartlink) — Core Rules - Second Edition
- VERIFY.md line 654 / 844: Item templates (smoke grenade) — Fields of Fire - Second Edition
- VERIFY.md line 654 / 844: Item templates (stun baton) — Core Rules - Second Edition; Street Samurai -
- VERIFY.md line 654 / 844: Item templates (throwing knife) — Core Rules - Second Edition
- VERIFY.md line 654 / 844: Item templates (wired reflexes 1) — Core Rules - Second Edition
- VERIFY.md line 691 / 75: Laser sight — Core Rules - Second Edition
- Vehicle stats — Rigger 2 - Second Edition

## Attack flow (v0.3.0), also from memory

| Rule | Current implementation | Where |
|---|---|---|
| Attack roll | Weapon's skill (or Quickness at +4 TN if unskilled; unskilled melee uses the skill's linked attribute since v0.47.0) plus Combat Pool dice vs range/melee base TN plus wounds and a manual modifier | `attackWith` in `documents/index.ts` |
| Ranged defense | Only Combat Pool dice can be spent to dodge; they roll against the attacker's final TN. No pool dice means no defense | `defend` |
| Melee defense | Replaced in v0.20.0 by an opposed test (see the end of this file) | `defend` |
| Hit | Attacker successes minus defender successes; ties and below miss | `resolveAttack` in `rules/combat.ts` |
| Armor type | Ballistic armor vs ranged weapons, impact armor vs melee | `armorKindFor` |
| Melee Power | The weapon's Power, or Strength + Power when "Power from Strength" is ticked (v0.20.0) | weapon item |
| Not modeled | Nothing left from this list: recoil and burst/full-auto came in v0.7.0, called shots in v0.7.0 and v0.20.0, cover in v0.7.0 (partial), v0.20.0 (walls) and v0.37.0 (full cover), visibility in v0.7.0, v0.20.0 (vision, scene light) and v0.21.0 (smoke, light sources) | |

## Cyberware and Essence (v0.4.0), also from memory

| Rule | Current implementation | Where |
|---|---|---|
| Grade Essence multipliers | standard 1, alpha 0.8, beta 0.7, delta 0.5 | `GRADE_ESSENCE_MULTIPLIER` |
| Essence | Base Essence minus installed items' costs, floor 0; at 0 the character is dead | `currentEssence`, `prepareDerivedData` |
| Essence and Magic | Magic capped at current Essence rounded up (the book may subtract instead) | `MAGIC_CAPPED_BY_ESSENCE`, `effectiveMagic` |
| Cyberware bonuses | Flat additions to attributes, Reaction and initiative dice while installed; no caps (since v0.22.0 augmented maximums are warned; since v0.29.0 reflex systems don't stack and initiative dice are at most 5) | `sumBonuses` |
| Not modeled | Nothing left from this list: bioware and Body Index came in v0.20.0 (depth in v0.30.0), attribute maximums by metatype in v0.22.0, smartlink bonuses and cyberware armor in v0.20.0, cyberlimbs and the rest of cyberware in v0.29.0 and v0.43.0 | |

## Karma Pool (v0.8.0), also from memory

Values are in `RULES.KARMA` in `src/module/rules/config.ts`.

| Rule | Current implementation |
|---|---|
| Re-roll failures | Spend Karma Pool to re-roll every failed die of one test (6s explode again; no Rule of One on the re-roll) |
| Re-roll cost | Escalating per test: 1st re-roll 1 point, 2nd 2, 3rd 3... (`escalating: false` makes every re-roll cost `firstRerollCost`) |
| Avoid disaster | 1 point turns an all-ones disaster into an ordinary failure |
| Buying successes | Since v0.35.0: 1 Karma Pool point per success (see that section) |
| Refresh | Manual (refresh icon on the sheet). The book's refresh timing (per session/scene) is up to the GM. Since v0.35.0 a house rule can refresh it every new session or when a combat ends |
| What can be re-rolled | Every test card: attribute and skill tests, attacks, spellcasting, dodge/melee defense, damage soak, drain, and spell resistance. A re-rolled attack or spell updates its Defend/Resist button; a re-rolled defense re-resolves the hit; a re-rolled soak/drain/spell resistance corrects the condition monitor (only if it hasn't changed since, otherwise the card says what it should be) |

## Firing modes and situational modifiers (v0.7.0), also from memory

All of these live in `RULES.FIRING`, `RULES.SITUATIONAL_MODIFIERS` and `RULES.VISIBILITY` in `src/module/rules/config.ts`. The two lists are plain tables: change a value, rename a label, or add a row and it appears in the Attack dialog.

| Rule | Current implementation |
|---|---|
| Rounds per action | SS 1, SA 1, BF 3, FA 3–10 (attacker picks) |
| Recoil | +1 TN per round fired in the phase beyond the first, minus the weapon's recoil compensation, never below 0. During a started combat, rounds carry over automatically between attacks in the same phase (same Combat Turn, initiative pass and acting combatant) and reset when the turn moves on; the dialog pre-fills the count and it can be overridden. Outside combat it is entered by hand |
| Burst damage | +3 Power, +1 damage level |
| Full-auto damage | +1 Power per round, +1 damage level per 3 rounds, capped at Deadly |
| Heavy weapons | Recoil doubled since v0.20.0 (see the end of this file) |
| Called shot | +4 |
| Target in partial cover | +4 |
| Attacker walking / running | +1 / +4 |
| Smartlink | −2 (pre-ticked only when the weapon is a smartgun and the attacker has a smartlink implant, since v0.20.0) |
| Laser sight | −1 |
| Visibility | Partial light +2, minimal light +4, total darkness +8 for normal vision; low-light and thermographic tables since v0.20.0 |
| Ammo | Tracked only if the weapon's capacity is above 0; not enough rounds blocks the attack |

## Magic (v0.6.0), also from memory

| Rule | Current implementation | Where |
|---|---|---|
| Casting test | Sorcery skill + Spell Pool dice; no defaulting (no Sorcery or no Magic = cannot cast) | `castSpell` |
| Combat spell TN | Target's Willpower (mana) or Body (physical), plus the caster's wound modifier | `castSpell`, `spellResistAttribute` |
| Non-combat spell TN | The spell item's TN field | spell item |
| Spell resistance | Target's Willpower/Body + Spell Pool dice vs the spell's Force; successes cancel the caster's | `resistSpell` |
| Combat spell damage | Net successes stage the spell's base level (same staging as weapons: first success hits, each 2 more raise a level); applied directly, armor does not count | `resolveCombatSpell` |
| Drain TN | floor(Force / 2) + the spell's drain modifier, minimum 2 | `drainTargetNumber` |
| Drain test | Willpower + Spell Pool dice; every 2 successes stage the drain level down | `#resistDrain` |
| Drain damage type | Stun, unless Force exceeds the caster's (Essence-capped) Magic, then Physical | `drainDamageType` |
| Force limit | Up to the Force the spell was learned at (Magic does not cap it; going over Magic makes drain Physical) | `clampForce` |
| Not modeled | Nothing left from this list: conjuring and spirits came in v0.10.0, astral perception, projection and combat in v0.11.0, spell defense, sustained spells and their +2 TN, foci, traditions and totems in v0.13.0 (more in v0.18.0) | |

## Stat-block import (v0.5.0)

Not a rules question, but worth checking against the blocks you actually use. The importer guesses each skill's linked attribute from its name (e.g. Firearms → Quickness, Unarmed/Armed Combat → Strength, Etiquette → Charisma, anything unknown → Intelligence) and guesses melee weapons from words like baton, knife, claw or reach. Fix any wrong guess on the item sheet; the import is a starting point. Essence in a block is read as current Essence.

This list was "not implemented yet" at v0.5.0; all of it has been built since, so check imported NPCs against these too: Karma Pool use (re-rolls v0.8.0, buying successes v0.35.0; the importer reads "Karma Pool/Professional Rating"), the Hacking Pool (v0.17.0) and Control Pool (v0.24.0), which are worked out from the deck and control rig rather than read from the block, called shots (v0.7.0, v0.20.0), impact vs ballistic armor by attack (v0.3.0; ammo, blasts and stun weapons in v0.20.0, v0.21.0 and v0.31.0), and visibility and recoil modifiers (v0.7.0, v0.20.0, v0.21.0).

## Conjuring and spirits (v0.10.0), also from memory

Values are in `RULES.CONJURING` in `src/module/rules/config.ts`; the logic is in `src/module/rules/conjuring.ts`.

| Rule | Current implementation |
|---|---|
| Summoning test | Conjuring skill vs TN = the spirit's Force; no Spell Pool (`spellPoolAllowed: false`); no defaulting. Nature spirits and elementals are rolled the same way: no materials, conjuring time, domains or circles are modeled (since v0.18.0: elemental materials and binding time, nature-spirit domains; since v0.39.0: hermetic circles and domains enforced; see those sections) |
| Services | 1 per success (`servicesPerSuccess`); 0 successes = no spirit |
| Conjuring drain TN | The spirit's Force (minimum 2) |
| Conjuring drain resisted with | Charisma (`drainAttribute`) |
| Conjuring drain level | Force ≤ half Charisma L, ≤ Charisma M, ≤ 1.5 × Charisma S, above that D (`drainLevels`) |
| Conjuring drain type | Stun, or Physical if Force exceeds the conjurer's Magic (same rule as spells) |
| Elemental limit | Warns when summoning an elemental while already holding Charisma × 1 elementals with services left (`maxElementalsPerCharisma`); does not block |
| Spirit attributes | Each is Force + an adjustment you set on the spirit sheet (book tables per spirit type are not included); Force also stands in for Essence and Magic |
| Immunity to normal weapons | Adds 2 × Force to both ballistic and impact armor (`immunityArmorPerForce`); no exception yet for magic weapons, spells or elemental damage (since v0.18.0 magical weapons and weapon foci ignore it, since v0.39.0 a weapon of the critter's vulnerability material too; combat spells never count armor; elemental spells still meet it) |
| Banishing | Conjuring vs TN = the spirit's Force, opposed by the spirit's Force dice vs TN = the banisher's Magic. Each net success lowers its Force by 1 (the change is permanent on that actor); Force 0 = banished. The banisher takes conjuring drain for the spirit's starting Force |
| Not modeled | Since built: astral form (v0.11.0), spirit powers as rolls (v0.12.0), materialization (v0.13.0), watchers and allies (v0.16.0; ally ritual v0.48.0), nature-spirit domains and one-per-domain, elemental binding time and cost (v0.18.0). Built in v0.61.0: spirits' own initiative bonuses (`MAGIC_V61.spiritInitiative`) |

## Astral plane (v0.11.0), also from memory

Values are in `RULES.ASTRAL` in `src/module/rules/config.ts`; the logic is in `src/module/rules/astral.ts`.

| Rule | Current implementation |
|---|---|
| Who | Anyone with Magic above 0 can be set to physical, perceiving or projecting on their sheet. Spirits are always on the astral plane. Adepts are not distinguished from magicians (since v0.39.0: adepts perceive only with the astral perception power and never project) |
| Astral form attributes | Body → Willpower, Quickness → Intelligence, Strength → Charisma (`formAttributes`). Spirits use their own attributes |
| Projecting initiative | Reaction = Intelligence; initiative = Intelligence + 20 + 1d6 (`reactionAttribute`, `initiativeBonus`, `initiativeDice`) |
| Perceiving penalty | +2 TN on physical-world weapon attacks, ranged and melee (`perceivingTnMod`). Not applied to other physical tests (since v0.39.0 it applies to every physical test, `perceiving.allTests`) |
| Astral attack TN | 4, like melee (`attackBaseTn`), plus wound modifiers |
| Astral attack dice | Magicians: Sorcery (`attackSkill`); without it, Willpower at +4. Spirits: Force |
| Astral pool | Magicians use the Spell Pool (`attackPool`) to attack, dodge and soak astrally; spirits use their Combat Pool |
| Astral damage | Power = attacker's Charisma (`powerAttribute`; spirits: Force), level M (`damageLevel`); attacker picks Physical or Stun |
| Astral defense and soak | Dodge with astral Quickness plus pool dice against the attacker's TN; soak with astral Body vs Power, no armor (immunity to normal weapons does not apply) |
| Not modeled | Since built: assensing and weapon foci (v0.13.0), astral barriers and wards (v0.14.0), astral signatures and tracking (v0.15.0), the projection time limit and Essence loss, the defenseless empty body and casting across planes (v0.18.0). Still not modeled: Power bonuses from weapon foci (they add dice only) |

## Critter and spirit powers (v0.12.0)

Power items carry their own mechanics, set per power on the item sheet, so the book's power descriptions decide each one. The only global defaults are in `RULES.POWERS`:

| Rule | Current implementation |
|---|---|
| Dice | The power's potency: the spirit's Force, the power's rating, Magic, or an attribute. The same number is the TN for the target's resistance test |
| Test TN | A fixed TN, or the target's attribute when a target is picked (falls back to the fixed TN without one). Wound modifiers apply |
| Resistance | Not resisted, or the target's chosen attribute vs the potency; successes cancel the user's |
| Effect | Damage: net successes stage the power's damage level like a combat spell, no armor. Effect only: net successes are reported, nothing is marked |
| Pools | No pool dice to use or resist powers (`usePool: 'none'`, `resistPool: 'none'`) |
| Not modeled | Since built: area powers and repeating powers such as Engulf (v0.14.0), Essence drain (v0.39.0), sustained powers that change attributes (v0.45.0). Built in v0.61.0: automatic per-turn timing of repeating powers (a prompt once per Combat Turn, `MAGIC_V61.repeating.autoPrompt`) |

## Sustained spells, spell defense, foci, traditions, adepts (v0.13.0), also from memory

Values are in `RULES.MAGIC` in `src/module/rules/config.ts`; the logic is in `src/module/rules/arcana.ts`.

| Rule | Current implementation |
|---|---|
| Sustained spells | A spell item can be Instant, Sustained or Permanent. A sustained spell that scores a success is added to the caster's Sustaining list. Each spell the caster sustains personally adds +2 TN to all their own tests (`sustainedTnMod`), but not to drain, defense or soak. Dropping it removes the penalty. A Karma re-roll that turns a failed sustained spell into a success adds it then; each entry remembers its successes (for dispelling) |
| Sustaining focus | Holds one sustained spell of Force up to its rating, of its category (or any), with no TN penalty; one spell per focus |
| Spell defense | Spell Pool dice set aside on the sheet; they come off Spell Pool left and are added to every spell resistance that Combat Turn (not to power resistance). Not spent on use (`spellDefenseSpentOnUse`); reset when pools refresh. Protecting other people is not modeled (since v0.14.0 it is: see "Protecting others") |
| Spell focus | + rating dice to Sorcery for its category, or for one named spell. The best matching one counts |
| Power focus | + rating dice to Sorcery and Conjuring (`powerFocusTests`); does not raise Magic, Spell Pool or drain |
| Spirit focus | + rating dice to Conjuring (summon and banish) for its spirit kind or type |
| Weapon focus | + rating dice to melee attacks with the named weapon, and the best weapon focus adds to astral attacks; no Power or reach change |
| Foci | Only active foci count; bonding and Karma costs, focus addiction and astral visibility are not modeled (since v0.18.0: bonding and its Karma, the addiction warning, foci seen by assensing; since v0.39.0: the addiction test) |
| Traditions | Hermetic and shamanic only warn when summoning the other tradition's spirits (`traditionSpiritWarnings`). Adepts cannot cast or conjure. "(not set)" applies no rules |
| Totems | Shamans only: bonus or penalty dice per spell category and for Conjuring, entered by hand. Totem-specific penalties outside these (e.g. environment) are not modeled (since v0.18.0: totem environment dice from scene tags) |
| Adept powers | Cost power points (Magic × 1 available, `adeptPointsPerMagic`); while active they add attributes, Reaction, initiative dice, dice to a named skill, and ballistic/impact armor. Killing hands and other special effects are text only (since v0.39.0: killing hands, combat sense, pain resistance, enhanced perception and astral perception work) |
| Materialization | Spirits have a Materialized box (on by default). An unmaterialized spirit cannot be targeted by weapon attacks; astral attacks still reach it |
| Assensing | Intelligence (`assensingAttribute`) vs TN 4 (`assensingTn`, editable when rolling), only while perceiving or projecting; successes are reported (since v0.18.0 a success also lists the subject's active foci; since v0.56.0 a table says what each number of successes reveals: see "Assensing" under v0.56.0) |
| Not modeled | Nothing left from this list: Essence loss from projecting came in v0.18.0 |

## Initiation, metamagic, area effects, protection and barriers (v0.14.0), also from memory

Values are in `RULES.MAGIC` and `RULES.BARRIERS` in `src/module/rules/config.ts`.

| Rule | Current implementation |
|---|---|
| Initiation | Each grade adds +1 Magic (`magicPerGrade`), on top of the Essence-capped rating; raises Spell Pool, adept power points and the Force-over-Magic drain threshold |
| Centering | Cancels up to grade points of wound and sustaining TN penalties on Sorcery, Conjuring, banishing, dispelling and barrier tests (`centeringPerGrade`) |
| Shielding | + grade dice when resisting spells (not powers) (`shieldingDicePerGrade`) |
| Quickening | A sustained spell becomes permanent with no TN penalty, for Good Karma = Force (`quickenKarmaPerForce`). It can still be dispelled |
| Dispelling | Sorcery (+ spell and power foci) vs TN = the spell's Force; each success removes one of the spell's successes, at 0 it ends. Drain M at floor(Force/2) (`dispelDrainLevel`, `dispelDrainModifier`). Works on any actor's sustained spells, including quickened ones |
| Masking, anchoring | Checkboxes only, no effect (both work since v0.18.0) |
| Aspected magicians | "Aspected: sorcerer" cannot conjure; "Aspected: conjurer" cannot cast. Other aspects (elementalist, shamanist) are not modeled (both since v0.18.0) |
| Area spells and powers | One test against the highest target's resisting attribute (`areaTn: 'highest'`); every target gets its own Resist button and resists separately. No area radius or Force-based area (since v0.18.0: Force × 1 m around the target or caster) |
| Repeating powers | The card offers Use again on the same targets (e.g. Engulf each turn). Since v0.61.0 it is also prompted once per Combat Turn (`MAGIC_V61.repeating.autoPrompt`) |
| Protecting others | When resisting a spell, the target may use another actor's spell defense dice instead of their own |
| Barriers | A Barrier actor (ward, mana barrier, astral barrier) with a rating. An astral magician or spirit forces through with their astral attack dice vs TN = rating; the barrier rolls its rating vs TN = their Magic (spirits: Force). Each net success lowers the rating by 1 (`ratingLossPerNetSuccess`); 0 = breached. Restore resets it. Spells cast through barriers and physical barriers are not modeled (since v0.18.0: wards add dice against spells cast through them; since v0.21.0: walls' barrier ratings add to armor; since v0.37.0: damage to walls) |

## Astral signatures, tracking and geasa (v0.15.0), also from memory

Values are in `RULES.TRACKING` and `RULES.GEASA` in `src/module/rules/config.ts`; the logic is in `src/module/rules/tracking.ts`.

| Rule | Current implementation |
|---|---|
| Signatures | Casting, summoning, banishing, dispelling, using a power and forcing a barrier each leave a signature at the scene being viewed (none without a scene), lasting 1 hour per point of Force of world time (`signatureHoursPerForce`). Stored on the actor who left it (last 50) |
| Seeing signatures | The Signatures button lists what lingers in the current scene with age and time left; only the GM sees who left each one, and can clear them |
| Tracking | Intelligence (`trackingAttribute`) vs TN 4 (`trackingTn`, set when rolling) plus a freshness modifier: up to 1 h +0, 6 h +1, 24 h +2, older +4 (`freshness`, `staleModifier`). Time to follow = 6 hours (`baseHours`, set when rolling) / successes; no successes = trail lost. On a success the GM is whispered whose signature it was. Only while perceiving or projecting |
| Geasa | Each geas protects some points of Magic; while it is not met (unticked) that Magic is lost, lowering Spell Pool, power points and the Force-over-Magic drain threshold. Geasa flagged to check warn when casting or summoning while unmet (`warnOnCast`). Whether a geas is met is the GM's call |
| Not modeled | Since built: masking against assensing and tracking (v0.18.0), cleaning signatures and signatures on objects (v0.39.0). Partly built in v0.61.0: magical links follow a sustained spell, a bound spirit or an active focus back to its magician (`MAGIC_V61.links`). Still not modeled: trailing a projecting form (the GM's tracking note only says when the owner is projecting) |

## More spellcraft, ritual, magic loss, enchanting, allies and quests (v0.16.0), also from memory

Values are in `RULES.SPELLCRAFT`, `RULES.RITUAL`, `RULES.MAGIC_LOSS`, `RULES.ENCHANTING`, `RULES.SPIRITS_EXTRA` and `RULES.QUESTS`; the logic is in `src/module/rules/spellcraft.ts`.

| Rule | Current implementation |
|---|---|
| Resisted non-combat spells | A spell can name the attribute an unwilling target resists with. Then the TN is the target's attribute (area: highest), the target gets a Resist button, and net successes are reported (no damage). Non-combat spells without one keep their own TN |
| Healing | Health spells marked Heals: TN = 10 − the patient's Essence, min 2 (`healing.tn`, `healing.base`); each success heals 1 box (`boxesPerSuccess`) of the chosen track; warns if the patient's damage has not grown since the last magical healing (`oncePerWound`). Karma re-rolls correct the healing |
| Background count | Set per scene by the GM; added to the TN of magical tests (casting, conjuring, banishing, dispelling, barriers, enchanting) and astral tests (astral attacks, assensing, tracking, quest stages); not drain (`backgroundCount.affectsDrain`) |
| Exclusive / fetish spells | Drain TN −2 / −1 (`exclusiveDrainMod`, `fetishDrainMod`). A fetish-limited spell cannot be cast with "fetish in hand" unticked. The exclusive spell's other restrictions are not enforced |
| Ritual sorcery | The leader rolls Sorcery plus half of each other member's Sorcery (`teamDiceFraction`); a target needs "in sight or material link" ticked (`needsMaterialLink`); takes 1 hour per Force (`hoursPerForce`, shown only); every member resists drain (leader at +`leaderDrainMod`). Spotters, ritual materials and sending stages are not modeled (since v0.18.0: spotters; since v0.39.0: preparation and sending stages, with materials paid if a house rule sets a cost) |
| Magic loss | When a magician's Physical damage first reaches a full track, a card offers a Magic loss test: 2d6 (`dice`) below natural Magic (`compareTo`) loses 1 Magic (`loss`). **Least certain rule here: check the trigger and comparison** |
| Enchanting | Enchanting skill (Intelligence at +4 without it) vs the task TN (gather 4, refine 4, alchemy 5, focus 5), time = days / successes (1, 2, 3, 7). A focus is created and bonded on success for Good Karma = rating × type cost (spell 1, sustaining 1, spirit 1, power 5, weapon 3). Materials, radicals and fetish making are not tracked (since v0.18.0 they are: gathering adds raw materials, refining turns raw into refined, alchemy turns refined into radicals, a fetish uses refined; foci use refined, or radicals if `materials.focusMaterial` says so) |
| Spirit kinds | Watchers are capped at Force 1 (`watcherMaxForce`). Allies and free spirits are made directly (not summoned) and do not count services (since v0.48.0 an initiate can also conjure an ally by ritual). A free spirit adds its spirit energy to its Force when resisting banishing (`freeSpiritEnergyResists`). True names are a text field |
| Astral quests | A quest has stages and a TN; while projecting, each stage is a chosen attribute test; a success passes the stage, a failure ends the quest (`failureEnds`). The metaplane, dweller and quest results are the GM's |


## The Matrix (v0.17.0), also from memory

Values are in `RULES.MATRIX` in `src/module/rules/config.ts`; the logic is in `src/module/rules/matrix.ts`. **This is the least certain block in the system**: it mixes SR2 core and Virtual Realities 2.0 as remembered. Check every row.

| Rule | Current implementation |
|---|---|
| Hacking Pool | (Intelligence + MPCP) / 3, rounded down (`hackingPoolDivisor`) |
| Matrix initiative | Reaction = Intelligence + 2 per Response Increase level; dice = 1 + Response Increase; levels capped at 3 (`reactionPerResponse`, `baseInitiativeDice`, `maxResponseIncrease`). Cyberware Reaction does not count |
| Persona limits | Bod, Evasion, Masking, Sensors each at most MPCP; together at most 3 × MPCP (`personaTotalPerMpcp`). Warned on the deck and sheet, not blocked |
| Memory | Loaded programs' sizes (entered by hand) against active memory; warned only (since v0.27.0 a Size of 0 uses the utility size table) |
| Detection Factor | (Masking + loaded Sleaze) / 2, rounded up (`detectionRounding`), minimum 2 |
| System test | Host rolls Security Value vs the Detection Factor; its successes go on the security tally. Decker rolls Computer (Intelligence at +4 without it) + Hacking Pool vs TN = the subsystem rating, minus the chosen loaded utility's rating (`utilityLowersTn`). Success = 1+ successes |
| Security tally | Each sheaf step is a tally number with an event and optional alert (passive/active/shutdown). Reaching it posts the event to the GM; alerts only rise. Players' tests post an "Apply (GM)" card instead of changing the host |
| Security code | Sets default IC initiative dice: blue 1, green 1, orange 2, red 2, black 3 (`icInitiativeDice`). It also drives paydata (v0.27.0) and the dump-shock and IC-initiative house rules (v0.57.0) |
| IC initiative | Rating + Nd6 |
| Decker attacks | Computer + Hacking Pool vs TN = the IC's rating (another persona: its Evasion). Power = attack utility rating at its damage level; net successes stage it up like weapons. **No dodge** in cybercombat (changed in v0.27.0: personas defend with Hacking Pool dice; see that section) |
| IC attacks | Rating dice vs TN = the persona's Evasion; Power = rating at the IC's damage level |
| Resisting | Persona: Bod + Hacking Pool vs Power − Hardening. IC: rating vs Power. Every 2 successes stage down. Damage goes on a 10-box Matrix monitor (`monitorBoxes`); full = crashed/derezzed |
| Black IC | Hits the decker's own Physical or Stun track, resisted with Willpower (`blackIcResist`) + Hacking Pool vs Power, no Hardening |
| Dump shock | When the persona crashes: Willpower vs TN = the host's Security Value (6 on the grid, `dumpShockTn`), M stun (`dumpShockLevel`), staged down by successes. Jacking out on purpose has no dump shock |
| Not modeled | Nothing left from this list: trace, tar and other IC effects, IC defending (a house rule), utility sizes and deck damage to MPCP came in v0.27.0; frames, grid LTGs and RTGs and hot vs cold sim in v0.28.0; agents in v0.40.0 |

## The rest of magic (v0.18.0), also from memory

Values are in `RULES.MAGIC_EXTRA` (and the new `fetish` task in `RULES.ENCHANTING`) in `src/module/rules/config.ts`; the logic is in `src/module/rules/thaumaturgy.ts`.

| Rule | Current implementation |
|---|---|
| Elemental manipulation spells | A spell ticked "Elemental" rolls Sorcery vs its own TN, then works like a ranged attack on each target: Power = Force at the spell's level; targets may dodge with Combat Pool (`elemental.dodge`), then resist with Body vs Power minus half their impact armor (`armorKind`, `armorFraction`). Secondary effects (fire, etc.) are not modeled (since v0.39.0 they are: see "Elemental effects") |
| Elemental aid | One of the caster's own elementals, of the spell's element, adds its Force as Sorcery dice; costs one service (`elementalAid`) |
| Elemental sustaining | One of the caster's elementals sustains a spell: no +2 TN; costs one service (`elementalSustain`). No time limit is tracked (since v0.39.0: Force × 1 hour) |
| Projection limit | Essence × 2 hours of world time (`projection.hoursPerEssence`); each hour or part over costs 1 Essence (`essenceLossPerHour`), applied when the magician stops projecting. Base Essence is lowered permanently |
| Empty body | While projecting, the body cannot dodge or use pool dice against physical attacks (`emptyBodyDefenseless`). It still soaks with Body |
| Area radius | Force × 1 m (`area.radiusFrom`, `metresPerPoint`), around the targeted token or the caster. The Cast dialog pre-ticks actors inside it; it does not block others |
| Line of sight | Checked against walls from the caster's token; only warns in the Cast dialog |
| Masking | +grade TN to assense the masked initiate or track their signatures (`masking.tnPerGrade`) |
| Anchoring | Stores a spell with a trigger (no roll); releasing it casts it then, with drain then. No Karma cost or link to the anchoring object |
| Seeing foci | A successful assensing of someone lists their active foci |
| Nature spirit domains | Warns when summoning a second nature spirit in a domain the magician already has one in (`domains.onePerDomain`). Leaving the domain is not enforced (since v0.39.0 it is warned, or blocked by house rule) |
| Elemental binding | Conjuring materials cost 1,000¥ per Force, paid from nuyen when ticked (on by default in the Summon dialog); takes 1 hour per Force, shown only (`binding`) |
| Elementalists | Cast only their element's category (fire combat, water illusion, air detection, earth manipulation; `elementalCategories`, the table elementals serve by) or spells of their element; summon only elementals of their element |
| Shamanists | Cast only categories where their totem gives bonus dice; summon only nature spirits; totem dice apply |
| Totem environment | Scene environment tags set by the GM; a totem's environment tags give "dice in it" or "dice away" to Sorcery and Conjuring |
| Bonding foci | Unbonded foci give no dice; bonding costs rating × the type's Karma (same table as enchanting) |
| Focus addiction | Warned when active, bonded foci total more than Magic. No addiction test (since v0.39.0 there is one: `MAGIC_V39.addiction`) |
| Magic weapons | A weapon ticked Magical, or a melee weapon with an active weapon focus, ignores immunity to normal weapons |
| Spells through wards | A ward or barrier between caster and target adds its rating as resistance dice (`barrierSpells`) |
| Casting across planes | A projecting caster can only target astral beings; an astral-only target (unmaterialized spirit, projecting magician) needs a perceiving or projecting caster and a mana spell (`planes`) |
| Spell Karma | Learning or raising a spell costs Good Karma = the new Force (`karmaCosts.spellPerForce`) |
| Initiation Karma | Grade N costs (6 + N) × 3 Good Karma (`MAGIC_EXTRA.karmaCosts.initiationBase`, `OCCULT.initiation.multipliers`), with one metamagic learned |
| Ritual spotter | An astral team helper who can see the target replaces the material link (`ritual.spotterReplacesLink`). The spotter takes no drain |
| Materials | Gear items with a material kind. Gathering adds successes raw units; refining and alchemy convert up to successes units; a fetish (TN 4, 1 day) uses 1 refined; a focus needs 1 refined per rating (`materials`). Fetish-limited spells tick "fetish in hand" by default only if the caster carries a fetish |

## Measured combat distance (v0.19.0), also from memory

Values are in `RULES.DISTANCE` in `src/module/rules/config.ts`; the logic is in `src/module/rules/distance.ts`.

| Rule | Current implementation |
|---|---|
| Measuring | Between the attacker's token (a controlled one, else its first active token) and the target's token on the viewed scene, with the scene's grid and diagonal rules. Large tokens: nearest occupied spaces (`nearestSpace`) |
| Elevation | Elevation difference counts (`useElevation`): the grid's own 3D measurement if it gives one, otherwise √(flat² + height²) |
| Units | Scene distance units converted to metres (m, km, ft, yd, mi; `units`). Unknown units are read as metres, with a note |
| Range band | The weapon's short/medium/long/extreme limits; a distance on a limit is the nearer band |
| Beyond extreme | Refused unless "Attack anyway" is ticked (`beyondExtreme: 'block'`); if allowed it uses the extreme TN |
| Melee reach | Reaches 1 m (`melee.baseMetres`) or one grid step including diagonals, whichever is longer, plus 1 m per point of the weapon's Reach (`metresPerReach`). Out of reach is refused unless overridden (`outOfReach`) |
| Not modeled | Nothing left from this list: reach TN modifiers came in v0.20.0 (changed in v0.21.0), wall cover and vision vs scene light in v0.20.0, light sources in v0.21.0 |

## Melee and ranged combat additions (v0.20.0), also from memory

Values are in `RULES.COMBAT` in `src/module/rules/config.ts`; the logic is in `src/module/rules/weapons.ts`. **Every row is from memory; the opposed melee rules, knockdown, shotgun spread and bioware are the least certain.**

| Rule | Current implementation |
|---|---|
| Opposed melee | Attacker rolls their melee skill (+ Combat Pool) vs TN 4 + their modifiers; the defender picks a melee weapon (or unarmed) and rolls its skill (+ Combat Pool) vs TN 4 + their own wounds and sustaining penalties. More successes wins and stages its own weapon's damage by the net successes (`melee.opposed`) |
| Counterattack | A defender who wins hits the attacker with their weapon (`melee.counterattack`). A melee attack with no successes still lets the defender roll |
| Ties | Nobody is hurt (`melee.tie: 'none'`; 'attacker' or 'defender' gives that side the hit at base damage) |
| Reach | Changed in v0.21.0: see below |
| Unarmed | Unarmed Combat, Power = Strength, M Stun, reach 0 (`unarmed`); an Unarmed row on every character and NPC sheet |
| Strength-based weapons | "Power from Strength": Power = Strength + the Power field, e.g. (STR+2)M. Bows: "Strength cap" limits the Strength used. Stat blocks with "(STR+2)M" import this way |
| Thrown weapons and bows | "Range from Strength": short/medium/long/extreme = (capped) Strength × 1 / 2 / 3 / 5 by default (`strengthRange`), editable per weapon |
| Heavy weapons | Uncompensated recoil × 2 (`heavyRecoilMultiplier`) |
| Ammunition | Standard; APDS armor × 0.5; explosive +1 Power; EX-explosive +2 Power; flechette +1 damage level, armor × 2; gel −2 Power, Stun, impact armor (`ammo`). Picked per weapon and in the Attack dialog; not applied to blast weapons |
| Called shots | +4 TN, then the attacker picks: +1 damage level, or a gap in the armor (worn, cyber and adept armor ignored; spirit immunity still counts) (`calledShot`) |
| Grenades and blasts | Power −1 per metre from the blast point, measured to each token's nearest space (`blast.powerPerMetre`, per weapon). Successes do not stage it; no dodge (`blast.dodge`); impact armor. Scatter changed in v0.21.0: see below |
| Shotguns | Spread across = distance / choke metres; Power −1 per full metre of spread (`shotgun`). Each target dodges separately. Who is hit changed in v0.21.0: see below |
| Full auto at several targets | Tick extra targets: the rounds are split as evenly as possible, each target is a separate attack test, recoil builds up across them; extra-target TN 0 (`spreadFire.extraTargetTn`). Each extra target gets its own wall-cover check |
| Wall cover | Five sight lines (centre and four inset corners) from the attacker's centre: some blocked = partial cover pre-ticked; all blocked = blind fire +8 pre-selected (`cover`) |
| Scene light | Darkness level up to 0.25 normal, 0.5 partial, 0.75 minimal, above that total darkness (`light`). Light sources on the scene are not taken into account (since v0.21.0 they are) |
| Vision | Normal 0/2/4/8; low-light 0/0/2/8; thermographic 0/1/2/4 for normal/partial/minimal/darkness; the best vision the attacker has counts (`vision`). Vision comes from the character's checkboxes or cyberware |
| Movement | Moved this Combat Turn (Foundry's token movement history, only in a started combat): up to Quickness metres = walking, more = running (`movement`) |
| Knockdown | After damage from an attack whose Power exceeds the target's Body (`knockdown.trigger`), a button rolls Body vs the same TN as the damage resistance, with no wound modifiers; no successes = prone |
| Cyberware | Armor ballistic/impact added while installed; smartlink, low-light and thermographic flags (a cyberware item named "smartlink" also counts) |
| Bioware | A cyberware item ticked Bioware costs its Body Index instead of Essence; the limit is natural Body (`bioware.maxFrom`), shown on the sheet and warned when exceeded; Magic −1 per 2 points of Body Index, rounded down (`magicPerBodyIndex`) |
| Not modeled | Nothing left from this list: Body Index side effects came in v0.30.0, parry as a separate skill in v0.38.0 (a house rule, off by default) |

## Combat fixes (v0.21.0), also from memory

Values are in `RULES.COMBAT` in `src/module/rules/config.ts`; the logic is in `src/module/rules/weapons.ts` and `src/module/applications/canvas.ts`. **All from memory; full defense, charging, prone values, encumbrance, smoke, grenade kinds, scatter and the confined-space rule are the least certain.**

| Rule | Current implementation |
|---|---|
| Reach | The side with the longer weapon gets −1 TN per point of difference on its own roll (`reach.appliesTo: 'longer'`, `melee.reachTnPerPoint`). The attacker is compared with the target's longest melee weapon when attacking; the defender with the attacker's weapon. `'defender'` restores the v0.20.0 rule |
| Full defense | A Defend option: + Quickness dice (`fullDefense.attribute`) to the dodge or melee defense; in a started combat the defender's initiative drops by 10 (`initiativeCost`), giving up their next action |
| Subduing | A melee option: the damage becomes Stun (`subdue.damageType`) |
| Prone | Attacking a prone target: melee −2, ranged +1; a prone attacker: melee +2, ranged −1 (`prone`). Read from the prone status (pre-ticked), editable |
| Friends in melee | −1 TN per other ally (same token disposition as the attacker) in melee reach of the target, at most 4 (`friendsInMelee`). Pre-filled, editable |
| Charging | −1 TN (`charging.tn`), pre-ticked when the attacker ran this Combat Turn |
| Second weapon | +2 TN for an attack with the off-hand weapon (`SITUATIONAL_MODIFIERS`) |
| Shooting through barriers | Solid walls (blocking movement, open doors excluded) between shooter and target: their SR2 barrier rating (set in the wall's config; default 0, `barriers.defaultWallRating`) adds to the target's armor (`barriers.addsToArmor`). Pre-filled, editable |
| Armor encumbrance | Worn ballistic or impact above Quickness lowers Quickness by the excess (`encumbrance.penaltyPerPoint`), and with it Reaction and the Combat Pool |
| Smoke | Smoke +4 (thermographic +0); thermal smoke +4 for every vision type (`smoke`). Added to the light TN; picked in the Attack dialog |
| Light sources | Bright light on the target counts as normal light, dim as partial light, if brighter than the scene's darkness (`light.useLightSources`). Walls blocking a light are respected |
| Gyro mounts | Weapon Gyro rating: cancels recoil (after heavy doubling), then walking/running penalties (`gyro.offsetsMovement`) |
| Ammunition clips | Gear with an ammunition type and rounds per clip; Reload offers them, loads that type and uses one clip |
| Grenade scatter | Every blast is placed with a Detonate button: it scatters 1/2/3/4d6 m at short/medium/long/extreme range (`scatter.diceByRange`), less 2 m per attack success (`metresPerSuccess`); 0 = on target; random direction (6 directions) |
| Blasts and walls | A wall blocking movement between the blast point and a token shields it completely (`wallsBlock`) |
| Confined spaces | If at least 6 of 8 rays from the blast point hit a wall inside the blast radius (`confined.rays`), everyone caught takes extra Power = half the Power left at the nearest wall, rounded down (`confined.bonus`) |
| Grenade kinds | Offensive −1 Power/m, defensive −1 per 2 m, concussion (Stun), flash (sets the blind status on everyone caught; duration is the GM's; since v0.31.0 it wears off after 3 Combat Turns), gas (lists who is in the cloud) (`grenades`). Custom uses the weapon's own Power per metre |
| Shotgun cone | Everyone in the cone from the shooter out to the target is hit: within half the spread at their own distance along the line (plus half their token's width), each at the Power for their distance (`shotgun.shape: 'cone'`; 'circle' restores the v0.20.0 rule) |
| Walking fire | Full auto at several targets wastes 1 round per full metre between consecutive targets (`spreadFire.wastedRoundsPerMetre`); the wasted rounds use ammo and add recoil but no damage |
| Movement | Only read in a started combat; the dialog says so otherwise. Foundry records token movement only while the game is unpaused |

## Core character rules (v0.22.0), also from memory

Values are in `RULES.METATYPES`, `RULES.HEALING`, `RULES.CONDITIONS`, `RULES.ACTIONS`, `RULES.INITIATIVE_TIES` and `RULES.SURPRISE` in `src/module/rules/config.ts`; the logic is in `src/module/rules/core.ts`. **All from memory; the healing TNs and times, the dying rate and the action costs are the least certain.**

| Rule | Current implementation |
|---|---|
| Racial modifiers | Elf Q+1 C+2; dwarf B+1 S+2 W+1; ork B+3 S+2 C−1 I−1; troll B+5 Q−1 S+4 C−2 I−2; human none. Added to the base rating unless "Add racial modifiers" is unticked |
| Maximums | Natural maximum = 6 + the racial modifier; augmented maximum = natural × 1.5, rounded down (`naturalMax`, `augmentedMultiplier`). Warned on the sheet (`enforce: 'warn'`; 'clamp' caps the total) |
| Racial traits | Elves and orks low-light vision; dwarves and trolls thermographic; trolls reach +1 and dermal armor 1 (ballistic and impact); dwarves +2 dice against disease and toxins (stored for when toxins exist; used since v0.31.0); running multiplier ×3 (dwarves ×2, stored; used since v0.44.0) |
| First aid | Biotech (or Intelligence at +4) + medkit rating as dice vs TN by the wound level on that track: Light 2, Moderate 4, Serious 6, Deadly 8. 1 box per success, at most half the damage (at least 1). Once per wound (a failed try counts; again only if the damage grows). Only within 1 hour of the injury (world time; GM override). A complex action |
| Stabilising | Any first-aid success on a dying patient stabilises them |
| Natural healing | Body vs TN by wound level (same table), no wound modifiers; care: medkit −1, hospital −2, poor conditions +2. Hours per box = 1 (Stun) or 24 (Physical) ÷ successes; heals the boxes that fit in the hours rested |
| Unconscious, dying, dead | Full Stun = unconscious; full Physical = dying; Physical overflow of Body = dead. Statuses set on the token (unconscious; dying adds bleeding; dead with the dead overlay and the combatant defeated). Incapacitated characters cannot attack, cast, conjure, banish, use powers, assense or dispel; they defend with 0 dice; they are skipped in combat; they drop personally sustained spells (focus-held, quickened and elemental-held spells stay) |
| Dying | +1 Physical box every Body Combat Turns until stabilised (`dying.turnsPerBox: 'body'`) |
| Least certain | The Stun overflow ratio: 2 Stun boxes to 1 Physical (`STUN_OVERFLOW_PER_PHYSICAL_BOX`); SR2 may be 1:1. The dying rate (`CONDITIONS.dying`), and whether it counts Combat Turns or minutes |
| Actions | Two simple actions or one complex action per phase (`perPhase: 2`). Simple: firing SS/SA/BF, throwing, reloading, assensing. Complex: full auto, melee, casting, summoning, banishing, powers, astral attacks, dispelling, first aid (`costs`). Counted only in a started combat during the actor's own phase; over the limit warns (`enforce: 'warn'`; 'block' refuses players) |
| Fire twice | SA or SS: a second shot as another simple action, with the first round counting for recoil |
| Initiative ties | Higher Reaction, then Quickness, then name (`INITIATIVE_TIES`) |
| Surprise | GM button in the combat tracker: everyone rolls Reaction vs 4; anyone with fewer successes than the best on the other side (token disposition) loses the first initiative pass (`SURPRISE`) |
| Not modeled | Nothing left from this list: toxins came in v0.31.0, delaying and full defense as an interrupt in v0.35.0, hospital costs and diseases in v0.42.0 |

## House rules in Foundry's settings (v0.23.0)

Not rules from the book: this is how to change any value in this list without rebuilding. Game Settings → Configure Settings → SR2e → **Edit house rules** (GM only) shows 148 common rule values in ten sections (tests and dice, characters, initiative and actions, ranged combat, melee, magic and the Matrix, vehicles and rigging, building security), each with its default. The **Advanced** box takes any other value by its path as JSON, e.g. `{"COMBAT.prone.targetMelee": -1}`; the fields win over the same path there. **Reset all to defaults** restores the shipped values. The world setting is `sr2e.houseRules`; the code is `src/module/settings.ts`.

## Vehicles and rigging (v0.24.0), also from memory

Values are in `RULES.VEHICLES` and `RULES.RIGGING` in `src/module/rules/config.ts`; the logic is in `src/module/rules/vehicles.ts`. **All from memory of SR2 and its rigger rules; the terrain and maneuver modifiers, normal weapons against vehicles, crash damage, the control rig's TN bonus, the Control Pool's source, feedback and dump shock are the least certain.**

| Rule | Current implementation |
|---|---|
| Vehicle stats | Handling (and an optional off-road Handling), Speed, Accel, Body, Armor, Signature, Autonav, Pilot (drones), Sensor, seating and cargo as text. Speed has no units: current speed is entered in the same units |
| Vehicle skill | Picked by category (car and truck: Car; bike: Bike; boat: Motorboat; rotorcraft: Rotor Aircraft...) unless the vehicle names one (`categories`). Without it: a related skill at +2, or Reaction at +4 (`defaultAttribute`) |
| Driving test | Skill vs Handling, plus terrain (open −1, normal 0, restricted +1, tight +3; `terrain`), maneuvers (easy −1, hard +2, above the vehicle's Speed +2, unfamiliar +1, poor visibility +2; `drivingModifiers`), vehicle damage, and the driver's own wound and sustaining penalties. A complex action (`ACTIONS.costs.drive`) |
| Vehicle damage | A 10-box track (`conditionBoxes`); its damage adds TN like wound modifiers, 1–2 +1, 3–5 +2, 6–9 +3 (`damageTnMods`). Destroyed at 10, with no overflow |
| Crash | A driving test ticked "crash test" that scores no successes is a crash. Crash Power = current speed ÷ 10, rounded down, at least 2 (`crash.speedPerPower`, `minPower`). The vehicle takes it at S with no armor (`vehicleLevel`, `vehicleArmor`); everyone listed aboard, and a driver at the wheel, takes it at M against impact armor (`passengerLevel`) |
| Autopilot | Nobody at the controls: the vehicle rolls Autonav (drones: Pilot) with no pool. Its Reaction is rating × 2 with 1d6 initiative (`autopilot`) |
| Weapons against vehicles | Weapons not ticked Anti-vehicle have Power × 0.5 (rounded down) and one damage level lower (`damage.normalWeapons`). Power at or below the vehicle's Armor does nothing (`damage.armorStops`). Otherwise Body vs Power − Armor (APDS still halves it), every 2 successes stage down, no pool |
| Vehicle defense | The Control Pool of a rigger jumped into it, against the attack's TN. Since v0.57.0 a driver at the wheel by hand evades too |
| Control rig | A cyberware "Control rig" rating, at most 3 (`maxVcr`). Needed to jump in (`jumpInNeedsVcr`). Jumped in: Reaction = natural Reaction + 2 per level, initiative 1 + 1 per level d6 (`vcr`); wired reflexes and other cyber Reaction and dice do not count (`cyberReflexesWhileRigging`); vehicle tests −1 TN per level (`vcr.tnPerLevel`) |
| Control Pool | The rigged Reaction (`controlPool.from`), usable only while jumped in (`onlyJumpedIn`) for vehicle tests and the vehicle's dodge; refreshed each Combat Turn |
| Initiative | A jumped-in rigger rolls the rigged initiative; a vehicle in the combat uses its jumped-in rigger's, otherwise its autopilot's. Since v0.59.0 a hand-driven vehicle acts at its driver's speed |
| Feedback | Damage to a vehicle a rigger is jumped into: the rigger resists Willpower vs TN = the Power that hit the vehicle, at the level the vehicle took, Stun (`feedback`) |
| Rigger dump shock | The vehicle is destroyed while a rigger is jumped in: the rigger is dumped and resists Willpower vs 6, M Stun (`dumpShock`). Since v0.59.0 a rigger who goes unconscious is dumped too (`CONDITIONS.dumpWhenDown`) |
| Not modeled | Nothing left from this list: spells against vehicles came in v0.43.0. Vehicle combat, sensors, remote decks and chases came in v0.25.0 (below) |

## Vehicle combat, sensors, remote decks and chases (v0.25.0), also from memory

Values are in `RULES.VEHICLES` (`gunnerySkill`, `mountedIgnoreRecoil`, `mounts`, `firing`, `sensorLock`, `passengers`, `ram`, `sensors`, `chase`) and `RULES.RIGGING.remote`; the logic is in `src/module/rules/vehicles.ts`. **All from memory; sensor-enhanced gunnery, the moving-vehicle TNs, passenger damage, ramming, the remote deck's capacity and the chase rules are the least certain. The book's chase rules may work quite differently (range bands rather than metres).** Maneuver scores exist as a house rule since v0.57.0.

| Rule | Current implementation |
|---|---|
| Mounted weapons | A weapon item on a vehicle with a mount: fixed (fired by the driver or the autopilot), turret (also a gunner aboard), pintle (only a gunner aboard). Skill: Gunnery unless the weapon names one (`gunnerySkill`). Fixed and turret mounts absorb recoil (`mountedIgnoreRecoil`); pintle mounts do not |
| Who rolls | The driver jumped in: Gunnery + Control Pool. A driver by hand or a gunner: Gunnery + Combat Pool. The autopilot: Autonav (drones: Pilot), no pool |
| Moving vehicles | Firing from a moving vehicle +1, above half its Speed +2 instead; at a target in a moving vehicle (or a moving vehicle) +1 (`firing`). Mounted weapons also take the firing vehicle's damage modifier. Applies to people firing their own weapons from aboard too |
| Sensor-enhanced gunnery | A vehicle holding a sensor lock on the target fires its mounted weapons at −2 TN (`sensorLock`). Locks last until dropped on the sheet |
| Sensor test | Sensor rating as dice (+ its jumped-in rigger's Control Pool, `sensors.controlPool`) vs the target's Signature (people: 6, `personSignature`) + the target's ECM above the scanner's ECCM. Any success = detected and locked |
| ECD | A scanned vehicle with ECD rolls its rating vs TN 4 (`ecdTn`); a success means it notices the scan |
| Passengers | When an attack (not a crash) damages a vehicle, everyone aboard, and a driver at the wheel, resists Power − the vehicle's Armor at the vehicle's damage level one lower, with impact armor (`passengers`) |
| Ramming | A driving test vs Handling (+0, `ram.tn`). The target defends normally. Damage = the rammer's Body + current speed ÷ 10, M (S above half its Speed), counts as anti-vehicle, impact armor; the rammer takes half the Power one level lower, as a crash (no armor reduction for weapons) (`ram`) |
| Remote control deck | Gear with an RCD rating. Jumping into a vehicle you are not listed aboard needs one (`remote.needsRcd`), +0 TN (`remote.tnMod`). It holds rating × 2 subscribed drones (`dronesPerRating`) |
| Drone groups | Group driving test: every subscribed drone rolls its own test (autopilot, or the rigger if jumped into it). Group attack: every subscribed drone fires its first fixed or turret weapon on autopilot at one target |
| Chases | One vehicle pursues another at a gap in metres (measured between their tokens when both are on the scene). Each chase turn (GM): the gap changes by (quarry's current speed − pursuer's) × 1 m (`metresPerSpeed`); then both drivers roll a positioning (driving) test, the faster vehicle at −1 TN per full 20 speed of advantage, at most −3 (`speedStep`, `speedTnPerStep`, `maxSpeedTn`); each net success moves the gap 5 m (`metresPerNet`). Gap 0 = caught. Mounted weapons use the gap as the range when the tokens cannot be measured |
| Not modeled | Since built (all v0.46.0): moving tokens during a chase, signal range and jamming of remote control, passive sensors, firing arcs of fixed mounts, cargo and load by weight; cargo by volume (v0.49.0). Still not modeled: a cargo's shape (only its CF) |

## Building security and security rigging (v0.26.0), also from memory

Values are in `RULES.SECURITY` in `src/module/rules/config.ts`; the logic is in `src/module/rules/security.ts`. **All from memory; the detection test, lock bypassing, the tally and alert steps (borrowed from the Matrix host sheaf) and response times are the least certain.** Guards' Perception tests (v0.49.0) and maglocks as casing then circuit (v0.57.0) are now built; the doubt is about their numbers.

| Rule | Current implementation |
|---|---|
| Site | A Site actor is a building's security network: devices (camera, sensor, maglock, door, alarm, other) with a rating, each optionally tied to a token (where it sees from) and a door wall (what it locks); a security tally with steps; an alert; the response; a security rigger; slaved turrets and drones; a linked Matrix host |
| Detection | Opposed: the device rolls its rating (+ the security rigger's Control Pool) vs TN = the intruder's Stealth rating (minimum 2); the intruder rolls Stealth (Quickness at +4 without it) vs TN = the device rating, with wound modifiers. More device successes = detected: net successes × 1 go on the tally (`tallyPerNet`) and the alert rises to at least active (`detectedAlert`). Cameras (`needsSight`) need line of sight from their token (walls), unless the GM overrides. Whispered to the GM |
| Bypassing a lock | Electronics (Intelligence at +4) vs TN = the lock's rating, a complex action. A success marks it bypassed and unlocks its door wall (`unlocksDoor`). No successes add 2 to the tally (`failTally`); a disaster raises the alert to active (`disasterAlert`). A player who does not own the site posts an "Apply (GM)" card |
| Tally and alert | Like a Matrix host: steps at tally values with an event and an optional alert. Alerts only rise: none → passive → active → lockdown |
| Response | The first time the alert reaches active: the response arrives after 3 Combat Turns in a started combat, or 5 minutes of world time (`response`). The GM is told when it arrives (new Combat Turn or world time passing) |
| Lockdown | Locks every linked door wall whose device has not been bypassed (`lockdownLocksDoors`) |
| Security rigger | A character with a control rig (`riggerNeedsVcr`) jumps into the site: rigged initiative and Control Pool (refreshed each Combat Turn), Control Pool on detection rolls, and slaved turrets and drones fired with Gunnery + Control Pool (as their driver). The turrets and drones can also fire on their own autopilot (Pilot) |
| Matrix link | A site linked to a host: the site's alert raises the host's (lockdown → shutdown), and the host's alert from its tally raises the site's |
| Not modeled | Since built: decker actions on devices through the Slave subsystem (v0.27.0 Control slave; v0.40.0 security deckers re-arm devices), sensor types against invisibility and chameleon suits, tamper alarms on bypasses and time to bypass (v0.46.0), guards' own Perception tests and tamper alarms on breached or smashed devices (v0.49.0). Still not modeled: tamper alarms on Matrix tampering, guards on patrol routes (the GM triggers each look) |

## Matrix depth: IC, defense, operations, paydata, Medic, deck damage (v0.27.0), also from memory

Values are in `RULES.MATRIX` (`defense`, `icAttackTn`, `attributeDamage`, `tar`, `trace`, `mpcpDamage`, `sparky`, `medic`, `repair`, `utilitySize`, `operations`, `download`, `paydata`) in `src/module/rules/config.ts`; the logic is in `src/module/rules/matrix.ts`. **All from memory of SR2 and Virtual Realities 2.0. Least certain: the persona's Hacking Pool defense, the IC list and its TNs, trace timing, the MPCP damage test, the Medic TNs, the operations table, utility size multipliers and the paydata table.** Change the v0.17.0 "no dodge" rule above: personas now defend.

| Rule | Current implementation |
|---|---|
| Defending in cybercombat | A persona attacked by IC or another decker rolls Hacking Pool dice (no base dice) against the attack's TN, like a dodge; each success cancels one attack success (`defense.persona: 'pool'`; 'none' restores v0.17.0). IC do not defend (`defense.ic: 'none'`; 'rating' makes them roll their rating) |
| IC behaviors | A field on each IC: killer, blaster, sparky, probe, scout, trace, tar baby, tar pit, crippler, ripper, barrier, scramble, other. Category black still means black IC (meat damage). The v0.27.0 migration sets the behavior from the IC type name |
| IC TNs | Killer, blaster, sparky, trace, other: the persona's Evasion. Probe and scout: the Detection Factor. Crippler and ripper: the persona program they go after (Bod, Evasion, Masking or Sensors). Tar baby and tar pit: the utility's rating (`icAttackTn`) |
| Probe and scout | Rating dice vs the Detection Factor; the successes go on the security tally. No damage |
| Crippler, ripper | 1 point per 2 net successes, at least 1 on any hit (`attributeDamage`). Crippler: off the persona until the decker jacks out or crashes. Ripper: off the deck itself until repaired |
| Tar baby, tar pit | A hit crashes (unloads) the utility; a tar baby then derezzes (`tar.tarBabyDerezzes`); a tar pit also erases the program (an Erased box on the program, cleared by hand) |
| Trace | A hit locks on: the trace completes after 10 ÷ net successes Combat Turns, rounded up (`trace.baseTurns`); a Combat Turn is 3 seconds of world time outside combat (`secondsPerTurn`). Then: dump (jacked out, dump shock vs the host's Security Value), report (GM told the jackpoint's location; host alert at least active), or burn (dump plus a deck damage roll, `burnMpcp`). Jacking out, a derezzed trace IC, or a successful Redirect Datatrail ends it |
| Blaster, sparky | Persona damage like killer. When it crashes the persona: the IC rolls its rating vs TN = MPCP; each 2 successes = 1 MPCP damage (`mpcpDamage`). Sparky also gives biofeedback: Willpower vs its rating, M Physical (`sparky`) |
| Barrier IC | Guards one subsystem: every system test on it is refused until the IC is crashed or decrypted (Decrypt Access / Decrypt Slave vs the IC's rating); decrypting lasts until the decker leaves the host. GM can override |
| Scramble | A file's scramble rating: it must be decrypted (TN = the rating) before it can be downloaded; a failed Decrypt File destroys the file |
| Deck damage | MPCP and persona damage on the deck lower the working values (Hacking Pool, Detection Factor, Evasion...) until repaired. Repair: the first of Computer B/R, Electronics B/R, Computer the decker has (else Intelligence +4) vs TN 4; each success repairs 1 point, MPCP first, 1 hour each (`repair`). Since v0.65.0 the repair runs as a project and the deck stays damaged until it's done |
| Medic | Medic rating (+ Hacking Pool) vs a TN by the persona's damage level: Light 4, Moderate 5, Serious 6, Deadly 8; each success repairs 1 box; the Medic utility loses 1 rating each use (`medic.degrades`). A complex action |
| Utility sizes | Rating² × multiplier: attack L 2 / M 3 / S 4 / D 5; sleaze 3, deception 2, analyze 3, browse 1, decrypt 1, evaluate 2, read/write 2, relocate 2, medic 4, mirrors 3, shield 4, smoke 1, spoof 3, validate 4, track 8, armor 3, cloak 3, lock-on 3, frame 3, smart frame 5. Used when the program's own Size is 0 |
| Operations | Analyze host / IC / security, Redirect datatrail, Crash host, Invalidate passcode (Control); Decrypt access, Graceful logoff, Log on, Null operation (Access); Locate file / paydata / slave (Index); Download, Upload, Edit, Decrypt file (Files); Control, Edit, Monitor, Decrypt slave (Slave). Each names its utility and simple or complex action (`operations`). Successes do not grade the result; any success works |
| Locating files | Each success finds one more file this decker has not found (Locate Paydata: paydata only) |
| Downloading | Takes file size ÷ the deck's I/O speed Combat Turns, rounded up (shown only); the file goes into the deck's storage, warned when over |
| Paydata | Files by security code: blue 1d6−1, green 2d6−2, orange 2d6, red and black 2d6+2; each 2d6 × 5 / 10 / 15 / 20 / 25 Mp, worth 50 / 75 / 100 / 150 / 200¥ per Mp; defense 1d6: 1–3 none, 4–5 encrypted, 6 scramble, at the host's Security Value (`paydata`) |
| Control slave | A slave device of a site linked to the host: a success marks it bypassed (and unlocks its door), as a lock bypass would |
| Actions | Matrix operations are simple or complex by the table; cybercombat attacks and Medic are complex |
| Not modeled | Nothing left from this list: psychotropic IC, the Shield, Armor, Mirrors and Smoke utilities and security deckers' tools came in v0.40.0; party and construct IC and upload and edit results in v0.46.0 |

## The grid, hot and cold sim, frames, connections (v0.28.0), also from memory

Values are in `RULES.MATRIX.grid`, `sim`, `frames`, `connections` and `movingVehicle`. **All from memory; least certain: hot sim's effects and the overload test, the connection modifiers, and frames (VR2.0 frames may work quite differently).**

| Rule | Current implementation |
|---|---|
| Grid nodes | A host actor is a host, an LTG or an RTG, on a parent grid (host → LTG → RTG) |
| Logging on | A system test on the target node's Access (Deception helps), with the target node's detection roll. Reachable: the node's parent or children, any node with no parent, and (from outside, at a jackpoint) any LTG or RTG. Others warn (`grid.enforcePath: 'warn'`; 'block' refuses). Graceful logoff moves to the parent grid. The Jack in dialog still moves anywhere with no test (the GM's shortcut) |
| Hot sim | +1 Matrix initiative die (`sim.hot.initiativeDice`); dump shock is Physical (`dumpShockType`); Matrix damage of Serious or worse calls for a simsense overload test: Willpower vs the Power, L Stun (`overloadAt`, `overloadLevel`) |
| Cold sim | No change by default; `sim.cold.coldBlackIcStun` (a house rule) turns black IC Physical damage into Stun |
| Frames | A frame or smart-frame program launched into the decker's host becomes an IC actor of kind frame, owned by the decker. It runs operations from the decker's Matrix tab: its rating as dice (a smart frame adds half its rating as pool dice, `frames.smartPoolPerRating`) vs the subsystem minus the decker's best loaded utility; the host's detection roll is against the decker's Detection Factor; no wound or connection modifiers. Its finds are the decker's; it logs on and off by itself. Initiative rating + 1d6. The decker must be jacked in |
| Connections | TN on every Matrix test by how the decker connects: jackpoint 0, cellular +1, satellite +2, a vehicle's comm system +1, remote deck +2; +1 more when aboard a moving vehicle (`connections`, `movingVehicle`) |
| Not modeled | Nothing left from this list: datajack requirements came in v0.29.0; grid travel time, frames fighting and carrying utilities and agents in v0.40.0; LTG/RTG numbers and signal range in v0.46.0 (satellites still have no range limit) |

## Cyberware depth (v0.29.0), also from memory

Values are in `RULES.CYBERWARE` and `RULES.MAGIC_ESSENCE_MODE` in `src/module/rules/config.ts`; the logic is in `src/module/rules/cyberware.ts`. **All from memory of SR2 and the Shadowtech era. Least certain: the stacking rules and the initiative cap, the Smartlink-2 value, how magnification works, ultrasound's TNs, the pheromone bonus, and the cost multipliers.**

| Rule | Current implementation |
|---|---|
| Kinds | A cyberware item's Kind: other, cyberlimb, cyberweapon, datajack, chipjack, skillwires, eyes, ears, pheromones, reflexes |
| Stacking | Wired reflexes, boosted reflexes (and synaptic accelerators, v0.30.0) don't stack: only the one with the most initiative dice keeps its Reaction and dice. Adept reflex powers compete with them too (`adeptExclusive`). Reaction enhancers stack. The reflex type is the item's Reflexes field, or guessed from its name. Initiative dice in all are at most 5 (`maxInitiativeDice`) |
| Smartlink levels | Smartlink-1 −2 TN (the Attack dialog's Smartlink row), Smartlink-2 −3 (`smartlink`); a ticked Smartlink box counts as level 1 |
| Vision magnification | 1–3: a ranged attack's range band moves that many bands closer, never past short (a dialog box, ticked by default) |
| Ultrasound | A vision type: normal 0, partial +1, minimal +1, darkness +2; in smoke or thermal smoke +1 (`ultrasound`); the best vision counts |
| Flare compensation | Immune to flash grenades' blinding |
| Tailored pheromones | + rating dice to Etiquette, Negotiation, Leadership, Interrogation, Instruction (`pheromones`) |
| Datajack | Decking without one warns (`datajack.decking: 'warn'`; 'block' refuses, 'off' says nothing); rigging needs none by default (`datajack.rigging: 'off'`). A datajack is the Datajack kind or an item named "datajack" |
| Cyberlimbs | Location, Strength, Quickness, capacity. Strength-based attacks (melee with Power from Strength, thrown weapons) made with a cyberarm use its Strength (picked in the Attack dialog). Cyberware housed in a cyberlimb uses its capacity (its Essence cost after grade) instead of Essence; over capacity warns. The limb's Quickness is shown only (since v0.43.0 it is used for tests made with the limb) |
| Cyberweapons | The Cyberweapon kind's attack (skill, Power from Strength + N, level, type, reach) appears as a weapon while installed; it attacks and parries like a melee weapon; housed in a cyberarm, it uses the arm's Strength |
| Damage and repair | A Damaged box: the item gives nothing (bonuses, armor, vision, smartlink, jacks) until repaired; it still costs Essence. Repair: the first of Cybertechnology or Biotech the repairer has (Intelligence +4 without) vs TN 4; a success repairs it, about 4 hours (`repair`). Nothing damages cyberware automatically yet (since v0.43.0 Deadly attacks offer a damage check; since v0.47.0 fire and falls too) |
| Cost | Cost × grade: standard 1, alpha 2, beta 4, delta 8 (`gradeCost`); availability is text (since v0.33.0 Find rolls it; since v0.45.0 the grade raises it) |
| Skillsofts | A gear item's Skillsoft fields: activesoft, knowsoft or linguasoft, the skill, its rating, slotted. Activesofts need skillwires (whose rating caps them) and a chipjack or datajack; knowsofts and linguasofts need a chipjack or datajack. A slotted chip stands in for the skill when it is better than the character's own (not when rolling a specialization) |
| Magic and Essence | `MAGIC_ESSENCE_MODE: 'cap'` (default): Magic at most current Essence rounded up. 'reduce': Magic − every point (or part of one) of Essence lost from the starting Essence |
| Not modeled | Nothing left from this list: availability rules came in v0.33.0 (by grade in v0.45.0), cyberlimb Quickness, limb armor only against called shots and cyberware damage from attacks in v0.43.0, encephalons and knowsoft (chip) limits in v0.45.0 |

## Bioware depth (v0.30.0), also from memory

Values are in `RULES.BIOWARE` in `src/module/rules/config.ts`; the logic is in `src/module/rules/bioware.ts`. **All from memory of Shadowtech. Least certain: every effect's size per rating, the adrenal pump crash, the Body Index side effects, surgery TNs and recovery times, and which bioware must be cultured.**

| Rule | Current implementation |
|---|---|
| Bioware kinds | A bioware item's Kind and Rating: muscle augmentation Strength + rating; cerebral booster Intelligence + rating; synaptic accelerator + rating initiative dice (a reflex system: doesn't stack with wired or boosted reflexes); adrenal pump Quickness, Strength and Willpower + rating while active; orthoskin impact armor + rating, ballistic + half; toxin extractor + rating dice against toxins; tracheal filter + rating against inhaled toxins; platelet factory −1 box off each Physical hit (never below 1); damage compensator ignores the first rating boxes of each track for wound modifiers (`effects`) |
| Adrenal pump crash | Switching it off: Body vs 6, M Stun (rating 1) or S Stun (rating 2), staged down by successes (`adrenalCrash`) |
| Cultured | Cerebral boosters, synaptic accelerators and damage compensators should be cultured (warned); cultured costs × 4 (`cultured`) |
| Conflicts | Orthoskin and dermal plating: only the better armor counts (orthoskin's armor above the plating's); muscle augmentation and muscle replacement, cerebral booster and encephalon: warned (`conflicts`) |
| Body Index side effects | + Body Index × 0.5 (rounded down) to the patient's first aid and natural healing TNs; − Body Index × 0.5 dice against toxins (`bodyIndex`). Toxins themselves are not in yet (since v0.31.0 they are) |
| Surgery | Installing cyberware or bioware: the surgeon's Biotech (Intelligence +4) vs TN 4, +1 alpha, +2 beta, +3 delta. Recovery = Essence (or Body Index) × 10 ÷ successes days, rounded up. No successes: complications, the patient takes L Physical unresisted; try again (`surgery`). A Surgery button on uninstalled items |
| Not modeled | Since built (all v0.45.0): enhanced articulation, trauma dampers, pain editors, bioware rejection, recovery after surgery (care modifiers in v0.48.0). Still not modeled: other Shadowtech items (use "Other" with bonuses) |

## Toxins, drugs, hazards, stun weapons and statuses (v0.31.0), also from memory

Values are in `RULES.TOXINS`, `RULES.HAZARDS`, `RULES.STATUSES` and `RULES.STUN_WEAPONS` in `src/module/rules/config.ts`; the logic is in `src/module/rules/hazards.ts`. **All from memory of SR2 and the Shadowrun Companion. Least certain: the fire, cold and fatigue numbers, drowning, the blind TN, and how stun weapons treat armor.**

| Rule | Current implementation |
|---|---|
| Toxins | A gear item with a toxin section: kind (toxin, drug, disease), vector, Power, level, Physical or Stun, speed. **Expose…** posts a card; each victim resists with Body (+ dwarf and toxin-extractor dice, − Body Index × 0.5; + tracheal filter dice when inhaled) vs TN = Power, every 2 successes stage it down, no armor (`TOXINS`) |
| Speed | Immediately, after a Combat Turn, a minute, 10 minutes, an hour, a day: shown on the card; the GM has the victim roll when it takes effect (`TOXINS.speeds`) |
| Drugs | **Take** uses a dose and gives the drug's attribute, Reaction and initiative-dice bonuses for its duration (by Combat Turns in combat, world time outside); when it wears off a crash card asks the user to resist the crash Power and level as Stun. Addiction is shown, not rolled (since v0.42.0 it is rolled) |
| Falling | Power = metres × 1, S Physical, impact armor × ½ (`HAZARDS.falling`) |
| Fire | Small fire 4L, on fire 6M, blaze 8S, inferno 10D Physical, impact armor × ½ (`HAZARDS.fire`) |
| Drowning | Body vs 4 + 1 per Combat Turn under, M Stun (`HAZARDS.drowning`) |
| Cold | Body vs 2 / 4 / 6 / 8 (chilly to arctic), L Stun (`HAZARDS.cold`) |
| Fatigue | Body vs 4 + 1 per hour past the first, L Stun (`HAZARDS.fatigue`) |
| Stun weapons | A weapon marked Stun weapon (taser, stun baton) does Stun against half impact armor (`STUN_WEAPONS`) |
| Blind | +8 to attacks and spells, nothing extra to other tests by default; flash blindness lasts 3 Combat Turns (9 seconds) and wears off on its own (`STATUSES.blind`) |
| Prone | Standing up is a Simple Action (`STATUSES.prone.standAction`); the prone modifiers are under combat |
| Not modeled | Since built: addiction tests, withdrawal and tolerance, disease progression, radiation and suffocation as hazards (v0.42.0; radiation sickness v0.48.0). Still not modeled: toxins that do something other than damage (use the effect text), gas filling a sealed room (partly built in v0.61.0: gas devices release a toxin on lockdown, `SECURITY_V61.gas`; suffocation is still rolled from the Hazard dialog) |

## Perception, social tests, grunt groups and morale (v0.32.0), also from memory

Values are in `RULES.PERCEPTION`, `RULES.SOCIAL`, `RULES.GRUNTS` and `RULES.MORALE`; the logic is in `src/module/rules/social.ts`. **All from memory of SR2. Least certain: the perception TNs, which attribute each social skill is opposed by, and the whole morale test (SR2 leaves much of it to the GM).**

| Rule | Current implementation |
|---|---|
| Perception vs Stealth | Opposed. The observer rolls Perception (or Intelligence without it) vs TN = the sneaker's Stealth (at least 2; 2 if they have none); the sneaker rolls Stealth (Quickness at +4 without it) vs TN = the observer's Intelligence. More observer successes = noticed. A **Perceive** quick action; the result can be whispered to the GM (`PERCEPTION`) |
| Social tests | Opposed. Etiquette, Negotiation, Leadership vs Charisma; Interrogation, Intimidation vs Willpower; Instruction vs Intelligence. Each side rolls the skill (or defaults at +4) vs the other side's attribute; pheromones add dice; net successes are the margin, the GM decides what they buy. A **Social** quick action (`SOCIAL.skills`) |
| Grunt groups | An NPC with Grunts above 1 is that many identical grunts sharing one sheet and one initiative; the monitor is the grunt in front. When that grunt goes unconscious, dying or dead, Down goes up, the monitor clears and the next steps in. The last grunt just goes down. The Attack dialog can have **the whole group attack**: one attack card per standing grunt (`GRUNTS`) |
| Morale | Professional Rating dice vs TN 4 + 1 per grunt down + 1 when the grunt in front is Seriously hurt; no successes = the group breaks (flees or surrenders). A Morale button follows each grunt going down (PR above 0), and a Morale quick action (`MORALE`) |
| Not modeled | Nothing left from this list: perception modifiers, one Stealth roll against several observers, social modifier tables, rallying with Leadership and grunts on separate tokens all came in v0.44.0 |

## Upkeep: Karma, nuyen, lifestyle, contacts and buying (v0.33.0), also from memory

Values are in `RULES.UPKEEP`; the logic is in `src/module/rules/upkeep.ts`. **All from memory of SR2. Least certain: the Karma costs of raising skills (the bands and multipliers) and attributes, the lifestyle costs, legwork TNs and how much a closer contact helps, and the availability time rule.**

| Rule | Current implementation |
|---|---|
| Lifestyles | Street ¥0, Squatter ¥100, Low ¥1,000, Middle ¥5,000, High ¥10,000, Luxury ¥100,000 a month; paying extends "paid until" by 30 days a month, from now or from the old date if later. Overdue days are shown (`lifestyles`, `monthDays`); since v0.49.0 a character long overdue can be moved down a lifestyle (see "Lifestyle beyond the bill") |
| Karma Pool growth | Every 10 Karma earned (career total; 20 for metahumans), one point goes into the Karma Pool instead of Good Karma (`karma.poolEvery`, `karma.diverts`). Characters made before v0.33.0 start their career count at 0 |
| Raising attributes | New rating × 2 Karma, up to the natural (racial) maximum (`karma.attributeMultiplier`) |
| Raising skills | Active: new rating × 1.5 up to the linked attribute, × 2 up to 1.5 × the attribute, × 2.5 above. Knowledge and language (vs Intelligence): × 1, × 1.5, × 2. A specialization costs half. Rounded up (`karma.skills`, `karma.specializationFraction`) |
| Contacts | Contact, Buddy, Friend for life. Legwork: Etiquette (Charisma at +4) vs the information's difficulty (common 3, street talk 4, kept quiet 6, a real secret 8) − 1 per level above Contact, at least 2. Successes: nothing, rumours, the basics, most of it, everything (`contacts`) |
| Availability | "TN/time" (e.g. 6/14 days). Etiquette vs the TN; it takes the base time ÷ successes; no successes = not found this time. Price = cost × Street Index × quantity (`availability`) |
| Not modeled | Since built: starting build points (v0.38.0 build check, v0.44.0 builder), healing at home (v0.42.0), contacts' Loyalty, paying contacts, haggling and fencing (v0.44.0). The Karma cost of initiation and spells is elsewhere (v0.18.0, v0.45.0). Lifestyle effects beyond the bill (finding gear, resting at home, moving down when overdue) and contacts' own dice came in v0.49.0. Nothing left from this list |

## Combat flow at the table (v0.35.0), also from memory

Values are in `RULES.DELAY`, `RULES.COMBAT.fullDefense`, `RULES.KARMA` and `RULES.DISASTERS`; the logic is in `src/module/rules/flow.ts`. **From memory of SR2. Least certain: whether a delayed action survives into the next pass, how long declared full defense lasts and what it costs out of turn, and every detail of buying successes (cost, permanence, needing a rolled success).**

| Rule | Current implementation |
|---|---|
| Delaying | On your own turn you can delay; the turn moves on. Later in the same initiative pass you can act at any moment ("Act now"), before whoever is acting; your actions count to your own phase. A delayed action not taken by the end of the pass is lost (`DELAY.lostAtPassEnd`) |
| Full defense | Declared any time: +Quickness dice against every attack until your next action (your turn in the next pass, or the end of the Combat Turn). In your own phase it is your action (a complex action, `ACTIONS.costs.fullDefense`); out of turn it costs 10 initiative. Ticking it in the Defend dialog declares it too (`COMBAT.fullDefense`) |
| Buying successes | 1 Karma Pool point per success, permanently off the Karma Pool, only when the test rolled at least one success, never on a disaster (`KARMA.buyCost`, `buyPermanent`, `buyNeedsSuccess`) |
| Karma Pool refresh | Manual by default; or every new session (the GM's first login on a new day) or whenever a combat ends (`KARMA.refresh`) |
| Rule of One | A disaster posts a GM-only card with a suggested consequence by test kind (house text, not the book's); a ranged attack's disaster can jam the weapon, cleared with a Simple action or a reload (`DISASTERS`) |
| Not modeled | Interrupting with something other than an action (e.g. a dodge outside full defense), buying successes with Good Karma. Delaying across passes is a house rule: with `DELAY.lostAtPassEnd` off, a delayed action lasts into later passes of the same Combat Turn |

## Tokens and the canvas (v0.36.0): house choices, not book rules

Values are in `RULES.TOKENS`; the logic is in `src/module/rules/tokens.ts` and `src/module/applications/tokens.ts`. Nothing here is from the book: it is how the system drives Foundry. **Worth checking at the table: whether Foundry's "light amplification" mode feels right for low-light eyes, and the 30 m thermographic and 50 m ultrasound ranges.**

| Setting | Current implementation |
|---|---|
| Token vision | Set automatically from the character's eyes (metatype, the Vision fields, cyber-eyes): normal = Foundry "basic"; low-light = "light amplification" (dim light counts as bright), range 0; thermographic = "darkvision", 30 scene units; ultrasound adds the "feel tremor" detection mode at 50. Kept in step when eyes or metatype change, on the prototype token and every placed token (`TOKENS.autoVision`, `TOKENS.vision`). Taking ultrasound eyes out does not remove the detection mode |
| Bars | New characters, NPCs and spirits get Physical (bar 1) and Stun (bar 2): boxes left of 10, shown to the owner on hover (`TOKENS.bars`, `monitorBoxes`) |
| Wound icons | A status icon (L, M, S, D) for the worst wound level on either track (`TOKENS.woundIcons`) |
| Roll modes | Foundry's message mode (public, GM only, blind, self) applies to test cards, except cards someone else must answer (Defend, Resist, a blast to detonate, a spirit to create, a morale test) |

## Gear and combat leftovers (v0.37.0), also from memory

Values are in `RULES.COMBAT` (`armorLayering`, `armorDegrade`, `load`, `silencer`, `suppressor`, `tracer`, `throwBack`, `stopAtWalls`, `flame`, `missileGuidance`, `demolitions`, `barriers`) and the new ammo and blast kinds; the logic is in `src/module/rules/gear.ts`. **From memory of SR2. Least certain: armor layering, the carrying limit, the silencer and tracer numbers, throwing a grenade back, demolitions (TN, Power per success, damage level), and the barrier damage rule.**

| Rule | Current implementation |
|---|---|
| Armor layering | Only the best worn piece of each kind counts, plus every piece marked "adds to other armor" (helmets, form-fitting armor, shields). House-rule choices: everything adds, or the best plus half of the rest. Armor encumbrance uses the sum of everything worn, not the layered total (confirmed by the user, 19 Oct 2026) (`armorLayering`) |
| Shields | An armor piece that adds to other armor; no separate parry rule (since v0.43.0: a Parry rating adds melee defense dice; since v0.47.0 ranged dodge dice too) |
| Armor degrading | House rule, off by default: a hit of Serious or worse that worn armor stopped takes 1 point off the best piece of that kind; the sheet repairs it (`armorDegrade`) |
| Carried weight | Items have a weight (kg; gear × quantity). Over Strength × 10 kg: −1 Quickness per Strength × 5 kg (or part) over (`load`) |
| Silencer / suppressor | A silencer allows only SS and SA; noticing the shot is Perception +4 (suppressor: any mode, +2) (`silencer`, `suppressor`) |
| Tracers | An ammo type: in burst or full auto, −1 TN per burst already fired this phase, to −3 (`tracer`) |
| Full cover | A situational option: blind fire (+8) through the barrier, whose rating adds to armor; not added twice with the blind-fire visibility (`SITUATIONAL_MODIFIERS.fullCover`) |
| Grenades | A scattering grenade stops at the first wall in its way (`stopAtWalls`). Anyone within 2 m of where it lands can try to throw it back: Throwing (Quickness at +4) vs 4; success lands it 1d6 − successes metres from the thrower; failure, it goes off where it landed. Rockets and charges can't be thrown back (`throwBack`) |
| Flamethrowers | A weapon "Area: flamethrower": everyone in a cone of choke 1 out to the target is hit at full Power, against half impact armor; each hit has a "Catches fire" button (resist being on fire, 6M) (`flame`) |
| Rockets and missiles | New blast kinds: high explosive (−1 Power per metre), anti-personnel (−0.5), anti-vehicle (−4); a missile's Intelligence adds that many dice (`grenades`, `missileGuidance`) |
| Demolitions | Gear with an explosive Power: "Set charge" is Demolitions (Intelligence at +4) vs 4, each success +1 Power, uses one; "Detonate" blasts at the targeted token (else the setter), D damage, −Power per metre as set; a disaster is a dud. Shaped: no blast beyond the target, × 2 against barriers (`demolitions`) |
| Barriers | A hit does Power − rating to a wall (× 2 for anti-vehicle and shaped charges), taken off its rating; at 0 the wall is breached (stops blocking movement, sight, light and sound; its old settings are kept in a flag). The GM applies it from "Barriers…" on attack cards fired through a wall and on blast cards (`barriers`) |
| Weapon rows | Ammo as pips (up to 40 rounds) and a button per firing mode that opens the Attack dialog in that mode (not a rule) |
| Not modeled | Nothing left from this list: shields' parry bonus, bounced and aimed-off throws, smart and airburst grenades, timed charges and wall repair all came in v0.43.0 |

## Skills and character creation (v0.38.0), also from memory

Values are in `RULES.SKILLS` and `RULES.CREATION`; the logic is in `src/module/rules/skills.ts` and `src/module/rules/creation.ts`. **From memory of SR2. Least certain: the whole priority table (every number in it), which metatypes need which priority, whether knowledge and language skills get free points, the concentration cost, the Skill Web step size and the vehicle repair TN.**

| Rule | Current implementation |
|---|---|
| Skill kinds | Active, Knowledge, Language and Build/Repair, grouped on the Skills tab. Build/Repair costs Karma like an active skill |
| Concentrations | A skill can have a concentration (narrower than the skill) and a specialization. Rolled instead of the skill when ticked in the Roll or Attack dialog; a weapon whose specialization names the concentration pre-ticks it. Raising a concentration costs `concentrationFraction` (0.75) of the skill cost, rounded up |
| Skill Web | The GM enters links in Game Settings ("Skill Web…"), one per line, `Skill A - Skill B: steps`. Defaulting to a related skill costs +2 TN per step (`web.perStep`), up to 3 steps (`web.maxSteps`). Once the web has any links, skills with no path can't be defaulted to (attribute only; house rule `flat` gives +2). With no links, every related skill is +2 as before |
| Parry | House rule, off by default: a Parry skill shows as "Parry (block only)" in melee defense; it rolls the Parry skill and does no counter damage (`parry`, `parrySkill`) |
| Martial arts | A skill marked "martial art" with Power +, damage-level steps, reach and defense dice. An unarmed attack uses the best such skill (if higher than Unarmed Combat): its dice, Strength + power, the level staged up, the reach; defending unarmed adds its defense dice |
| Vehicle repair | "Repair test…" on the vehicle sheet: the chosen mechanic's B/R skill (Car B/R, Bike B/R, ...) vs TN 4; each success repairs one box, an hour each (`vehicleRepair`) |
| Least certain | The vehicle repair TN is a flat 4 (`SKILLS.vehicleRepair.tn`); it ignores the damage level and the facilities |
| Priority builder | "Build check…" on the Bio tab: pick A–E for Race, Magic, Attributes, Skills and Resources (each once). Shows a live table: Race (human E, elf / troll C, dwarf / ork D or better), Magic (A full, B adept or aspected), attribute points (A 30, B 27, C 24, D 21, E 18; base ratings, 1–6 each), skill points (A 50, B 40, C 34, D 30, E 27; active plus knowledge and language, each at most 6), Resources (A ¥1,000,000, B ¥400,000, C ¥90,000, D ¥20,000, E ¥5,000; gear cost plus cash) and Essence above 0. The choice saves to the actor (flag `build`). Since v0.64.0 the creation wizard builds the character; the old Build… dialog is now Quick build |
| Not modeled | Since built: starting contacts and lifestyle from Resources (v0.44.0 builder). Still not modeled: free knowledge points (house rule `knowledgePerInt`, 0 by default), the Skill Web as a book diagram (the GM enters it), martial-arts maneuvers |

## Magic leftovers and critters (v0.39.0), also from memory

Values are in `RULES.MAGIC_V39`, `RULES.ADEPT` and `RULES.CRITTERS`; the logic is in `src/module/rules/mysticism.ts` and `src/module/rules/critters.ts`. **From memory of SR2, the Grimoire and the critter books. Least certain: what each element's secondary effect is, how long an elemental sustains a spell, the focus addiction test, which libraries and circles hermetics need, ritual materials, the cleaning test, the allergy table, the vulnerability step, Essence drain per success and the Essence loss rate, and the killing hands levels.**

| Rule | Current implementation |
|---|---|
| Elemental effects | A hit from an elemental manipulation gets a button for its element's effect (`elementEffects`): fire = catches fire (6M, as v0.37.0's flamethrower); lightning = shock: Body vs the Force, no successes = −10 initiative in combat, else stunned 1 turn (`shock`); acid = the best worn armor piece loses 1 (`corrode`); water, air and earth = a knockdown test at TN = Force; cold = none |
| Elemental sustaining | Holds the spell for Force × 1 hour of world time; then the spell drops (`sustainLimit`) |
| Nature spirit domains | Outside its domain = the spirit's domain is not among the scene's environment tags; it is warned (house rule: blocked, or off) whenever it acts (`domains`). The Summon dialog fills the domain from the scene's first tag |
| Spirit types | A spirit template (a spirit actor with no summoner) whose type or name matches the summoned type is copied automatically. No spirit or power tables are included |
| Focus addiction | When active bonded foci total more than Magic, "Addiction test": Willpower vs that total (house rule: vs the excess). Failing = addicted: magic with no focus active takes +2 TN (withdrawal) until the GM clears it (`addiction`) |
| Libraries, circles, lodges | Gear with a site kind, rating and topic / element / totem. Hermetics summoning an elemental need a conjuring library and a circle of the element; ritual sorcery needs a sorcery library (hermetic) or a lodge of the totem (shamanic); each rated at least the Force. Default: warn (house rule: block, off). Building one: rating × 1,000¥ and rating days (shown only) (`sites`) |
| Ritual stages | Ritual sorcery first posts a preparation card (materials paid if the house rule sets a cost per Force; Force hours); "Send the spell" then rolls it with the team, spotter and drain. Sending early warns (house rule: blocks players) (`ritualStages`) |
| Cleaning signatures | From the signatures dialog: Sorcery (or Magic) vs the signature's Force; each success takes 1 hour off what is left; needs astral perception (`cleaning`) |
| Object signatures | A focus made by enchanting carries its maker's signature; tracking can pick it (your items or the targeted token's); it doesn't fade. The GM's tracking note says when the owner is projecting (the trail goes on to the empty body) |
| Astral perception | The +2 TN applies to every physical test while perceiving, not only attacks; not to magical tests; dual-natured beings never take it (`perceiving.allTests`) |
| Background count | Per scene: the plain count plus sources, one per line (`Name: rating aspected to tag, tag; toxic`). The highest unaligned source is the TN penalty. A source aspected to a magician's tradition, totem or element gives them its rating as extra dice on magic instead (house rule: ignore, or penalty). Toxic sources also add to drain (`background`) |
| Adept powers | A power's Special: killing hands (unarmed Physical; level 1 M, 2 S, 3 D), combat sense (+level dice to dodge, melee defense, surprise), pain resistance (ignores level boxes for wound modifiers), enhanced perception (+level dice to Perception), astral perception (perceiving allowed; adepts never project) (`ADEPT`) |
| Allergies | Power with Special allergy: substance and severity. Exposed (a box on the sheet): nuisance +0, mild +1, moderate +2, severe +2 TN on every test. Contact damage, unresisted: moderate L, severe M (a Contact button, and a hit from a weapon of that material) (`allergy`) |
| Vulnerability | A weapon whose Material matches stages the damage up 1 level and ignores immunity to normal weapons; those boxes can't be regenerated (`vulnerability`) |
| Regeneration | Physical damage heals at the end of each Combat Turn (house rule: so many boxes per turn) and once per hour of world time outside combat, except vulnerability damage (`regeneration`) |
| Essence drain | A power with Special Essence drain: each net success moves 1 Essence from the victim to the drainer, who reaches at most 12; the victim's Magic falls with it (`essenceDrain`) |
| Essence loss | −1 Essence every 30 days of world time (`essenceLoss`) |
| Dual-natured | Always perceiving, no penalty |
| Shapeshifters | NPC sheet: shapeshifter, form and the human form's attribute adjustments; "Shift form" is a complex action |
| Not modeled | Since built (all v0.45.0): fire spreading on the scene, a ritual being noticed by its target, ghouls' diet, site costs paid from nuyen, libraries and lodges for initiation. Still not modeled: spirits' power tables |


## Matrix leftovers (v0.40.0), also from memory

Values are in `RULES.MATRIX` (`psychotropic`, `utilities`, `carry`, `agents`, `travel`, `security`); the logic is in `src/module/rules/matrix.ts`. **From memory of Virtual Realities 2.0. Least certain: the psychotropic payloads and how long they last, what Shield and Armor do and whether they wear down, the Mirrors and Smoke numbers, how many utilities a frame carries, agents (they may be a later edition's idea), grid travel time, and what a security decker may do without a test.**

| Rule | Current implementation |
|---|---|
| Psychotropic IC | Behavior "Psychotropic" (guessed from names like Psychotropic, Cyberphobia, Judas, Frenzy, Conditioning); black IC. It attacks like black IC; every hit also has a payload button: the decker rolls Willpower (+ the loaded Shield's rating as dice) vs the IC's rating; 0 successes and it takes hold for rating × 1 day of world time (`psychotropic`). Payloads: cyberphobia +2 TN on every Matrix test; frenzy (lasts until jacking out; a reminder chip); judas (the GM is whispered and the host goes to passive alert); positive conditioning (a reminder chip). A Karma re-roll that succeeds takes the effect off again; the GM can clear one from the sheet |
| Armor utility | Its rating comes off the Power of persona damage together with Hardening; it loses 1 rating each time it soaks a hit (`utilities.armor`) |
| Shield utility | The same against black IC damage on the decker's own track (`utilities.shield`) |
| Mirrors utility | + half its rating (at least 1) to the TN of attacks against the persona's Evasion: IC attacks, traces, other deckers (`utilities.mirrors`) |
| Smoke utility | Released into the decker's host (a simple action, no test): + half its rating (at least 1) to every Matrix test there, for everyone, for rating Combat Turns (3 s each outside combat) (`utilities.smoke`) |
| Frames and agents carry utilities | Launching one copies loaded utilities chosen by the decker, at most its rating in number (`carry.carryPerRating`); its own utilities lower TNs and give attack Power. With none, it uses its owner's (`carry.ownerUtilities`) |
| Frames and agents fight | Rating (+ smart or agent pool) dice vs an IC's rating or a persona's Evasion + Mirrors; Power = the carried attack utility. IC can damage them (TN = their rating; they resist with it) but crippler, tar, trace and the like only work on personas |
| Agents | Program kind "agent" (size rating² × 6). Always have pool dice (rating × 0.5); act while their owner is jacked out; the host's detection roll is against their own Detection Factor ((rating + carried Sleaze) ÷ 2, rounded up); 2 initiative dice (`agents`) |
| Grid travel | Each hop between two grids (LTG ↔ RTG ↔ RTG) on the route takes 1 Combat Turn (3 s outside combat); logging on to a host from its own grid takes none. Until the decker arrives, their tests in the new node are refused (`travel.blockInTransit`; GM can force) |
| Security deckers | Characters the GM lists on a host. In that host: no detection roll on their system tests; a Security button: spot an intruder (Computer + Hacking Pool vs their Detection Factor; spotted, alert to passive), trace an intruder (vs their Evasion + Mirrors, minus a loaded Track; locks on like trace IC, then reports; lost if the security decker jacks out), re-arm a bypassed device (TN 4; its door locks again), cancel the alert (TN 4) (`security`) |
| Not modeled | Since built (all v0.46.0): party and construct IC, signal range for wireless links, agents searching several hosts. Still not modeled: psychotropic effects outside the Matrix (the GM plays them), Shield against non-black attacks |

## UI polish and GM tools (v0.41.0): templates from memory, the rest house choices

The item templates are in `RULES.ITEM_TEMPLATES` in `src/module/rules/config.ts`; the item-sheet logic is in `src/module/rules/items.ts`, the GM panel and drops in `src/module/applications/ui.ts`, field tooltips in `src/module/config/tooltips.ts`. **Only the template numbers are rules from memory: check every Power, range band and capacity against the book's weapon tables.**

| Rule | Current implementation |
|---|---|
| Item templates | Generic classes, no named products: hold-out, light and heavy pistols, SMG, assault and sniper rifles, shotgun, LMG, bow, throwing knife, offensive and flash grenades, missile launcher, flamethrower, knife, sword, club, pole arm, stun baton, taser; armor jacket, vest, armored clothing, helmet, form-fitting armor; datajack, smartlink, cybereyes, wired reflexes 1, dermal plating 1; a combat and a detection spell; Attack and Sleaze utilities; a medkit; a power focus (`ITEM_TEMPLATES`). Applying one replaces the item's settings (and its name while it is still "New …"). The GM's own templates (Save as template) are a world setting and listed first |
| Weapon layouts | The sheet's Kind (melee, firearm, shotgun, thrown or bow, grenade, launcher, flamethrower) is worked out from the weapon's flags and shows only that kind's fields; picking another kind sets the flags; "Show every field" shows them all |
| Item warnings | Shown on the sheet, never blocking: e.g. a shotgun without a choke, a blast with Power 0, no range bands, bands out of order, a melee weapon with firing modes, more ammo than capacity, a silencer without SS/SA, armor with 0 / 0, cyberware costing no Essence, a specialization without a rating, a spell at Force 0, an active focus not bonded, a toxin with Power 0 |
| Group roll | GM panel: the same attribute or skill test for the selected tokens, every NPC token on the scene, or the party; each with their own wounds and defaulting; one card, whispered to the GMs unless ticked; no Karma re-rolls |
| Damage several | GM panel: Power, level, type and which armor counts; each resists with Body (a card each, no pool) or takes it unresisted. Unlinked tokens take it on their own copy |
| Drop on a token | A weapon dropped on a token targets it and opens the Attack dialog; a spell or power opens its dialog with that target. A weapon can't be dropped on its own owner's token |
| Dice colours | Client setting: default (green / grey), colourblind-safe (Okabe–Ito blue and orange, with ✔ marks and dashed misses), high contrast (black and white). Banners follow |
| Dice So Nice | With the module active and the client setting on: SR2e colour sets, the first wave in blue, Rule of Six re-rolls in gold |
| Not modeled | Item templates for every item type (programs, spells and gear have a few), per-type layouts for item types other than weapons (they show their own fields already), dragging a hotbar macro onto a token (drag the weapon, spell or power from its owner's sheet instead; a weapon in the Items sidebar has no owner and does nothing) |

## Health and environment (v0.42.0), also from memory

Values are in `RULES.HEALTH` (and the new `home` and `intensive` care options in `RULES.HEALING.natural.care`); the logic is at the end of `src/module/rules/hazards.ts`. **From memory. Least certain: how SR2 runs addiction (the test, the recent-dose penalty, tolerance and withdrawal), how diseases progress and are cured, the radiation and suffocation numbers, hospital prices, lifestyle effects on healing, and the weather table.**

| Rule | Current implementation |
|---|---|
| Addiction test | A drug with an Addiction rating tests on every dose while the character isn't hooked (house rule `addiction.auto`): Willpower for a mental addiction, Body for a physical one, vs the rating + 1 per other dose in the last 7 days (`tnPerRecentDose`, `recentDays`). 0 successes: addicted |
| Tolerance | Each 5 doses taken while addicted (`dosesPerPoint`) take 1 point off every positive bonus of the drug |
| Withdrawal | An addict without a dose for 24 hours (`withdrawalHours`) is in withdrawal: +2 TN on every test (`withdrawalTn`) until the next dose; announced once in chat |
| Kicking the habit | After 14 days clean (`kickDays`): Willpower vs the rating (withdrawal counts); a success ends the addiction. The GM can clear one from the sheet |
| Disease | A toxin item of kind disease; Expose: the victim resists with Body (+ toxin dice, + protection) vs Power; any damage left means infected. After the incubation it tests every interval: Body (+ 2 dice when treated, `treatmentDice`) vs Power, staged damage; a test with no damage counts toward recovery (3 by default, `recoveries`, or the item's own number) |
| Radiation | Hazard: Body vs the radiation rating, one test per hour, M Physical staged down |
| Suffocation | Hazard, like drowning: Body vs 4 + 1 per Combat Turn without air, M Stun |
| Hospital costs | Hospital 500¥ and intensive care 1,000¥ per started day of rest (`careCosts`), paid from nuyen with a ledger entry unless the GM unticks Pay; intensive care is −3 TN |
| Resting at home | TN by lifestyle: street +2, squatter +1, low and middle 0, high and luxury −1 (`homeCare`) |
| Protective gear | Gear with a protection kind, worn: a gas mask stops inhaled toxins (and diseases); a respirator adds its rating in dice against inhaled ones; a chemsuit adds its rating against contact ones |
| Weather | Scene setting in the GM panel; TN to ranged attacks (not blind fire) and perception, by the viewer's best vision: light rain +1, heavy rain +2 (thermo +1), snow +2, fog +2 (thermo +1), thick fog +4 (thermo +2), storm +4 (thermo +3) (`weather`) |
| Not modeled | Since built (all v0.48.0): contagion between characters, radiation sickness, weather on driving and movement. Still not modeled: overdoses beyond the Expose button, cravings as role-play, hospital stays that heal several boxes in one go (partly true already: natural healing heals every box that fits in the hours rested, and hospital care lowers the TN and charges per day), long-term radiation effects beyond sickness |

## Gear and combat (v0.43.0), also from memory

Values are in `RULES.GEAR` (plus the `scanner` site device kind in `RULES.SECURITY.deviceKinds`, and the action costs `setUpWeapon`, `search` and `scan` in `RULES.ACTIONS.costs`); the logic is in `src/module/rules/armory.ts`. **From memory. Least certain: how SR2 runs searches against Concealability and what scanners roll, the bipod and tripod numbers, how spells hit vehicles (Object Resistance, Body, armor, anti-vehicle), shields in melee, smart and airburst grenades, bounced throws, and the cyberware damage chance.**

| Rule | Current implementation |
|---|---|
| Searching | A Search quick action: look someone over (Perception, else Intelligence, vs each item's Concealability) or frisk them (−2 TN, `friskTn`); 1 success finds an item (`minSuccesses`). Weapons and worn armor with Concealability 0 are always seen; other gear and cyberware with 0 aren't looked for. Whispered to the GMs and the searcher's owners; the rolls and misses only to the GMs. A complex action (`search`) |
| Scanners | Gear with a scanner kind and rating: rating dice vs Concealability (TN 4 for items with none, `defaultTn`). Weapon detectors find weapons and cyberweapons (`weaponFindsCyberweapons`), cyberware scanners installed cyberware (not bioware), explosive sniffers explosives and grenades. A simple action (`scan`). A site's scanner device adds 1 to the tally per item found (`tallyOnFind`) |
| Laser sight | Pre-ticks the Attack dialog's Laser sight row (−1); dropped when the smartlink row is ticked too (`laserNotWithSmartlink`) |
| Imaging scope | Magnification 1–3 moves the range band closer like cyber-eye magnification; the better of the two counts (`scopeStacks` adds them), at most 3 |
| Bipod, tripod, shock pad | Recoil compensation: shock pad 1 always; bipod 2 and tripod 6 once set up (a complex action from the weapon row, `setUpWeapon`) or when the shooter is prone (`proneIsSetUp`) |
| Spells against vehicles | Mana spells can't affect vehicles (`manaAffects`). A combat spell's TN is the vehicle's Object Resistance (8 by default, or the vehicle's own); the successes stage the spell's level like an attack with Power = Force, resisted with the vehicle's Body; armor doesn't count (`combatArmor`) and the spell counts as anti-vehicle (`antiVehicle`). Elemental spells hit vehicles as attacks. Other targeted spells roll against the higher of their TN and the Object Resistance |
| Shields | Armor with a Parry rating (worn): the best one adds its Parry as dice to every melee defense, the Parry skill included (`parryAs: 'tn'` takes it off the TN instead) |
| Airburst and impact fuses | Airburst: the scatter left after successes × 0.5 (`scatterFactor`), can't be thrown back, doesn't stop at walls. Impact: goes off where it lands, can't be thrown back |
| Smart grenades | With the smartlink row ticked and a smartlink (`needsSmartlink`): 1 more metre off the scatter per success (`metresPerSuccess`) |
| Bounced throws | +2 TN (`bounce.tn`), +1 scatter die (`bounce.extraDice`), and no blind-fire penalty (it needs no line of sight). A throw can be aimed up to 10 m off the target in one of 8 directions (`aimOffMetres`) |
| Timed charges | Setting a charge can put it on a timer (seconds; a Combat Turn is 3 s): it waits on the scene and goes off by itself on the GM's client when world time or the Combat Turn passes it. Detonate on the card sets it off early; the GM panel lists armed charges (set off, disarm) |
| Damaging blasts and vehicles | Blasts that do damage (not flash or gas) now catch vehicle tokens too; they resist as non-anti-vehicle damage unless the weapon is anti-vehicle |
| Repairing walls | The GM panel lists damaged and breached walls: Repair restores the original rating (and a breached wall's movement, sight, light and sound); a repair test is Building B/R (Intelligence +4 without) vs 4, +1 rating per success (`repairPerSuccess`) |
| Cyberware damaged by attacks | Physical damage from an attack at Deadly (`atLevel`) gives the soak card a "Cyberware damage check" button (`mode: 'button'`; 'auto' rolls it straight away; 'off'): 1d6 per working installed cyberware (bioware only with `bioware`), damaged on a 1 (`chance`); a called shot at a cyberlimb damages it, and what it houses, on 1–3 (`calledChance`). Rolled once per card, Karma re-rolls included |
| Cyberlimb Quickness | A Quickness test, or an attack defaulting to Quickness, made with a cyberarm uses the arm's own Quickness (`quickness`); the Attack dialog's limb choice now shows for every weapon |
| Cyberlimb armor | A cyberlimb's ballistic and impact armor counts only against a called shot at that limb (`armorCalledOnly`; off = always). The Attack dialog has "Called shot at" (body or a limb) |
| Not modeled | Since built: encephalons (v0.45.0); searching several people at once, scope vision modes, laser range, spells against objects and walls, shields against ranged attacks, disarming a timed charge with a test, cyberware damaged by fire and falls (v0.47.0). Still not modeled: magnetic anomaly detectors vs non-metal weapons beyond Concealability, visible laser beams, bipods on vehicles, spells damaging objects other than walls, grenade arcs over walls (the throw is built as bounced throws, v0.43.0; the blast side is still missing), disarming a charge that isn't on a timer |

## Characters and the street (v0.44.0), also from memory

Values are in `RULES.STREET` (and the action costs `athletics` and `rally`); the logic is in `src/module/rules/street.ts`. **From memory. Least certain: whether SR2 has Threat Ratings, open tests and teamwork as written here (check the book); the builder's lifestyle and free contacts by Resources priority; the athletics TNs and distances; the perception and social tables; rallying; contact Loyalty and payment (Loyalty is from later editions); haggling and fence percentages. Edges and flaws and reputation are Shadowrun Companion rules, off by default.**

| Rule | Current implementation |
|---|---|
| Builder ("Fill the sheet") | The Bio tab's Build… dialog picks priorities, metatype, magic and base attributes, shows the build check live, and fills the sheet: metatype, base attributes, Magic 6 for a magician or adept (`magicRating`; tradition set to hermetic or adept), cash = the Resources priority less gear at cost, a lifestyle by Resources priority (A high, B middle, C and D low, E squatter, `lifestyles`) paid 1 month ahead (`lifestyleMonths`), and up to 2 level-1 contacts (`contacts`) as placeholders. Skills and gear since v0.49.0 (below). Since v0.64.0 the creation wizard replaces this dialog (now Quick build) |
| Edges and flaws | Off by default (`qualities.enabled`). On the Bio tab: name, edge or flaw, points, and an optional TN modifier on one skill or attribute (used on its tests, defaulting to it, and sneaking). The build check: at most 5 points of each (`maxEdges`, `maxFlaws`), edges no more than flaws (`balance`) |
| Running | Walking = Quickness m per Combat Turn, running = Quickness × the metatype's multiplier (3; dwarves 2), shown on the Main tab |
| Athletics | Athletics (Body-linked; else Body +4) vs climbing 2/4/6/8, swimming 3/5/7/9, jumping 4. Climbing and swimming 2 m per success (`metresPerSuccess`); jumping 1 m per success, ×2 with a run-up. No successes: no progress (a disaster climbing is a fall); swimming: goes under (drowning) |
| Threat Rating | An NPC's Threat Rating adds that many dice to its Combat Pool (`threat.addsToPool`) |
| Open tests | Roll and skill dialogs: no TN; the highest die (sixes added up) is the result and sets the opposing TN |
| Complementary skills | Rolled first vs the same TN; +1 die per 2 successes (`successesPerDie`) |
| Teamwork | Helpers on the scene roll the same skill (or default) vs the same TN; their successes add dice, at most the leader's rating (`teamwork.cap`) |
| Reputation | Off by default. Street Cred = career Karma ÷ 10 (`credPerKarma`; or by hand with `autoCred` off), Notoriety, Public Awareness on the Bio tab; Street Cred takes `socialTnPerCred` per point off social and legwork TNs (0 by default: shown only) |
| Perception modifiers | Perceive and Sneak dialogs: distracted +2, noisy +2, crowded +2, actively searching −2 (on the observers' TN; the sneaker gets the opposite). Distance is measured between tokens since v0.50.0 (`perception.range`, below) |
| One sneaker, several observers | Sneak quick action: Stealth (else Quickness +4) once vs the sharpest observer's Intelligence; each observer's Perception (else Intelligence) vs the Stealth rating; more successes than the sneaker notices |
| Social modifiers | Social dialog: attitude friendly −2, neutral 0, suspicious +1, prejudiced +2, hostile +4, enemy +6; the character has the upper hand −2, the target has +2, against their interests +2, costs them nothing −1, a bribe or favour −1 |
| Rallying | A failed morale test marks the group broken (a chip on the sheet). Rally quick action (with Leadership): Leadership (else Charisma +4) vs 4 + 1 per grunt down (`rally`); a success clears it |
| Grunts on tokens | NPC sheet Split (GM, unlinked token): one token per standing grunt beside it, one group. Morale counts the group's tokens that are down, and one going down offers a morale test; the Attack dialog's "whole group attacks" makes every standing token attack (distance and cover are read from the token picked in the dialog) |
| Contacts | Loyalty 1–6 (default 1), what they know, and a fee per legwork (charged with the legwork). Paying extra buys 1 die per ¥100 (`nuyenPerDie`), at most Loyalty dice |
| Haggling | A Haggle button on find cards (once): Negotiation (else Charisma +4) vs 4, opposed by the seller's 4 dice (`sellerDice`); each net success 5% off (or on), at most 25% (`percentPerNet`, `maxPercent`); the new price comes on a new card and the old card's Buy is refused |
| Fencing | Fence… on an owned item's sheet: Negotiation vs 4, opposed by the fence's 4 dice; the fence pays 30% of the street price (`basePercent`) + 5% per net success, at most 50%; Sell removes one (or the item) and adds the nuyen |
| Not modeled | Since built (all v0.49.0): skills and gear in the builder, Karma for edges and flaws, contacts' own dice, favours owed, stolen-goods heat, morale for groups of different NPCs. Still not modeled: Street Cred from deeds, a contact's mood, haggling over services |

## Magic and critters (v0.45.0), also from memory

Values are in `RULES.OCCULT`, `RULES.FIRE`, `RULES.CRITTERS.diet`, and new keys in `RULES.BIOWARE` (`recovery`, `rejection`, `availability`, three new kinds) and `RULES.CYBERWARE` (`encephalon`, `chips`, `gradeAvailability`); the logic is in `src/module/rules/occult.ts` and `implants.ts`. **All from memory of SR2 and the second-edition Grimoire and Shadowtech. Least certain: the cleansing, divining, invoking and possessing tests as written; the initiation multipliers (alone ×3, group ×2, ordeal −1); the spell design formula (its drain modifiers and the design test); the three new bioware kinds' effects; rejection; encephalon dice and chip slots; grade Availability numbers.**

| Rule | Current implementation |
|---|---|
| Cleansing | An initiate perceiving or projecting rolls Sorcery (Magic without it) vs TN = background count × 2 (`tnPerPoint`), +2 for a toxic source (`toxicTn`); the count's own penalty doesn't add on top. Every 2 successes (`successesPerPoint`) take 1 point off, at most the count: the scene's plain count first, then the strongest source not aligned to the initiate. 1 hour of work per point (`hoursPerPoint`, shown). Players' results go on a GM "Apply" card. Cleaning signatures needs the technique only with `signaturesNeedTechnique` (off) |
| Divining | Sorcery (or Magic) vs general 4, specific 6, exact 8 (`tns`), +1 per week ahead (`tnPerWeek`); whispered to the GMs and the diviner's owners. 0 successes: no answer; 1 vague; 2 cryptic; 3+ clear (`answers`); the GM answers |
| Invoking | On the initiate's own nature spirit or elemental: costs 1 service (`servicesCost`), Conjuring (+ foci and totem) vs TN = Force; a success makes it a great form spirit: +2 to every attribute (`attributeBonus`) and +2 to its powers' dice (`powerBonus`). Conjuring drain for Force + 2 (`drainForceBonus`) |
| Possessing | A projecting initiate: Willpower + grade dice (`diceFromGrade`) vs TN = the target's Willpower, opposed by the target's Willpower vs the initiate's. More successes possesses: the body uses the possessor's Charisma, Intelligence and Willpower (`mental`). Ends from either sheet or when the possessor stops projecting. The GM runs the body (no ownership change) |
| Reflecting | Resisting a spell (not a power): resistance successes beyond the caster's go back at the caster as a new spell with that many successes (a Resist button for the caster). A reflected spell can't be reflected again. `needsSpellDefense` (off): only while spell defense dice are held |
| Initiation Karma | (6 + new grade) × 3 alone (`multipliers.self`), × 2 in a magical group (`multipliers.group`); an ordeal takes 1 off the multiplier (`ordealReduction`), never below 1 (`minMultiplier`) |
| Ordeals | Asceticism (−1 to an attribute's base), deed, familiar, geas (a new geas protecting 1 Magic), meditation, oath, astral quest (needs a finished quest), thesis. Asceticism, geas and quest are checked or applied; since v0.48.0 the rest are too (see "Ordeals" under v0.48.0; the GM confirms a deed) |
| Initiation sites | Initiating to grade N needs a library (hermetic) or a lodge of the totem (shamanic) of rating N or more (`initiation.site`: warn by default; 'block' refuses). Group sites count |
| Spell design | Drain level = the damage level (combat) or L (detection), M (health, illusion, manipulation) (`baseLevel`); drain modifier: physical +1, area +1, sustained 0, touch −1, Stun damage −1, resisted non-combat +1; elemental raises the level by 1 (`modifiers`). The design test: Sorcery vs TN = Force (`tnModifier` 0), + the best library's rating as dice (hermetic; sorcery topic) or lodge's (shamanic); takes Force × 1 day ÷ successes (`daysPerForce`). A success gives a formula card: Learn it for Good Karma = Force, or add it to a group's grimoire |
| Magical groups | GM panel: members, strictures, shared sites, a grimoire, breaches. Members in good standing use the group's libraries, circles and lodges (`shareSites`), learn grimoire spells without designing them (`grimoire`), and initiate at the group rate. A recorded stricture breach removes all three until the GM clears it |
| Toxic and insect shamans | Optional traditions (`traditions.enabled`, off). Both follow a totem. Toxic shamans: toxic background sources are aligned (bonus dice, no toxic drain); they summon toxic spirits (others warned). Insect shamans summon insect spirits and need a hive (a lodge) for it (`insectNeedsHive`, enforced by the site house rule) |
| Sustained powers | A Power item can be Sustained with attribute changes (effect "Net successes only"). Not resisted: the changes go on the target (or the user) on a success. Resisted: on the target when it takes effect; "× net successes" multiplies them, at most 3 successes count (`powers.maxPerSuccess`). They last until dropped (either sheet) or the user is knocked out |
| Noticing a ritual | When a ritual's preparation starts, each awakened target (spirits, Magic > 0) gets a whispered card: Intelligence + grade (`gradeDice`) vs 6 (`tn`), −2 if astrally active (`astralBonus`); mundanes only with `mundanes`. 1 success: senses the spell and Force; 2+: who is working it |
| Site costs | Raising a library ¥1,000, a circle or lodge ¥500 per point of rating (`sites.nuyenPerRating`), 1 day per point (shown); paid from nuyen with the ledger |
| Ghouls' and vampires' diet | Feeding (the Feed button, or a successful Essence drain with `drainFeeds`) restarts the Essence loss clock (`feedingResets`); after 7 days without (`hungerDays`), +1 TN on every test (`hungerTn`) |
| Fire spreading | A target catching fire (flamethrower, fire elemental effect) starts a fire at its token (`fromHits`); the GM panel can start one at a selected token. Each Combat Turn (or 3 s of world time outside combat) it grows 1 m (`metresPerTurn`) up to 6 m (`maxRadius`) and gets hotter every 3 turns (`escalateTurns`) from small to blaze (`intensity`, `maxIntensity`); it burns out after 6 turns (`turns`). Everyone inside when it grows gets a Resist button (hazard fire at its intensity). A translucent circle drawing shows it (`draw`) |
| New bioware kinds | Enhanced articulation: +1 die on skills linked to Body, Quickness or Strength. Trauma damper: rating boxes off each Stun hit (never below 1). Pain editor: the Stun track doesn't count for wound modifiers, +1 Willpower, +1 TN on Perception |
| Recovery after surgery | The new implant gives nothing until the recovery days pass (`recovery.inactive`), and every test is at +1 TN meanwhile (`recovery.tn`); a GM can end it from the Gear tab |
| Bioware rejection | With Body Index over the limit: Body vs 4 + 1 per point over (`rejection.tn`, `tnPerPointOver`) when bioware goes in and every 7 days (`intervalDays`); failure rejects the most recently installed bioware (marked damaged, `rejectItem`; cultured bioware is never rejected, `culturedImmune`) and does M Physical, unresisted (`level`) |
| Encephalon | + rating dice (`dicePerRating`) on skills linked to Intelligence and on knowledge and language skills |
| Chips | Running at once: 1 per chipjack (`perChipjack`), 1 through a datajack (`perDatajack`); knowsofts and linguasofts beyond that run from headware memory (a "Headware memory" cyberware's rating in Mp) at 3 Mp per point of rating (`mpPerRating`). Others give nothing (`chips.enforce: 'block'`; 'warn' lists them but they work; 'off') |
| Availability by grade | Alphaware +2 TN ×1.5 time, betaware +5 ×2, deltaware +9 ×3 (`gradeAvailability`); cultured bioware +2 ×1.5 (`BIOWARE.availability.cultured`). Find uses it, and the price uses the grade and culturing |
| Not modeled | Since built (all v0.48.0): deed, meditation, thesis and oath ordeals (the GM confirms a deed), more design options including fetish and exclusive, the familiar ordeal via an ally ritual, a possessed body testing with the possessor's skills, reflecting powers, fire through walls and by fuel, smoke from fires, infection from a bite, care modifiers on bioware recovery. Still not modeled: metamagic beyond these (e.g. later editions' flexible signature), thesis quality, spell design for every option, group initiation ceremonies, the possessor's spirit form taking damage |

## Matrix and rigging (v0.46.0), also from memory

Values are in new keys of `RULES.MATRIX` (`party`, `construct`, `numbers`, `agentSearch`, `programming`, `deckBuilding`, `tortoise`, `iccm`, `otaku`), the new `RULES.SIGNAL`, `RULES.VEHICLES` (`sensorModes`, `arcs`, `cargo`, `autosofts`, `modifications`, `chase.moveTokens`), `RULES.RIGGING` (`jamming`, `needsAdaptation`) and `RULES.SECURITY` (`senses`, `concealment`, `tamper`, `bypassTime`); the logic is in `src/module/rules/netrig.ts`. **All from memory of SR2, Virtual Realities 2.0 and the Rigger rules. Least certain: the signal range table, programming and deck-building times and costs, the tortoise and ICCM effects, the otaku persona formula, the jamming test, the modification table, and which concealment fools which sensor.**

| Rule | Current implementation |
|---|---|
| Party IC | IC with the same party name in the same host act on their best member's initiative (`party.sharedInitiative`). "Party attack" (IC sheet) has every live member act on one target, each by its own behavior; guard IC sit it out. The Launch IC dialog can launch several numbered copies into one party |
| Construct IC | One IC that can also act as up to 3 other behaviors (`construct.maxComponents` 4 in all) at its own rating; its Act dialog asks which |
| LTG numbers | A host, LTG or RTG has a number. Log on with "dial a number" reaches it from anywhere (`numbers.dialAnywhere`), ignoring the grid path; the decker remembers it. Locate LTG number (Index, Browse) learns this node's number and those of the nodes connected to it |
| Upload data | Copies a file from the deck's storage into the host's data stores (found by the uploader); time = size ÷ I/O speed Combat Turns (shown) |
| Edit file | Alter (a note of what changed, shown on the host sheet) or erase a located, unprotected file |
| Agents across hosts | An agent sent to search a list of hosts (at most `agentSearch.maxHosts` 8): for each, a logon test on that node's Access (grid path not enforced), then Locate file or Locate paydata; whatever it finds is its owner's; it stops at the first find when `stopOnFind`. Hops are counted for travel time (shown) |
| Frames and agents in combat | They roll rating + their initiative dice. Derezzed IC, frames and agents, and frames whose owner is not jacked in, are skipped in the turn order (an agent still acts). The tracker shows an Act button on IC, frames and agents |
| Writing programs | Computer (its Programming concentration counts) vs TN = rating (`programming.tnMod` 0); base time = size (book formula) × 1 day per Mp (`daysPerMp`) ÷ successes; the program arrives unloaded |
| Building decks | One part at a time: Computer B/R, else Electronics B/R, else Computer (else Intelligence +4) vs the new rating + the part's TN (hardening +2, Response Increase +4). Time and parts cost by part (`deckBuilding.parts`): MPCP 2 days and ¥1,000 × rating²; persona programs 2 days and ¥500 × rating; hardening 4 days, ¥2,000 × rating; Response Increase 7 days, ¥25,000 × level; ÷ successes; paid on success. Since v0.65.0 each part waits out its time before it's done. Persona parts above MPCP warn |
| Tortoises | A deck ticked Tortoise: normal Reaction and initiative dice in the Matrix, half the Hacking Pool (`tortoise.hackingPool`), cold sim only, black IC hits become Matrix damage (`immuneToBlackIc`), no dump shock (`dumpShock` off), +0 TN (`tn`) |
| ICCM | Cyberware kind ICCM with a rating: black IC Physical damage becomes Stun (`iccm.blackIcStun`); + rating dice (`dicePerRating`) to resist black IC, dump shock, sparky biofeedback and simsense overload |
| Otaku | Off by default (`otaku.enabled`). A deck ticked Living persona: MPCP = (Intelligence + Willpower + Charisma) ÷ 3; Bod = Willpower, Evasion = Intelligence, Masking = Charisma, Sensors = Intelligence (each at most MPCP); no Hardening or Response Increase; memory MPCP × 100 Mp; +1 Matrix initiative die |
| Signal range | Wireless Matrix links (cellular, relayed) and remote control decks reach `SIGNAL.rangeKm` by signal rating: 1 km, 3, 10, 30, 100, 300, 1,000, 3,000, 10,000 km for ratings 1–9. Matrix: the deck's Signal vs the relay distance on the Matrix tab (0 = not checked). Rigging: the RCD's signal (its rating if 0) vs the distance between the rigger's and the drone's tokens. Past 75% of the range +1 TN (`farFraction`, `farTn`); beyond it the link fails (`outOfRange`: warn by default, or block) |
| Jamming | A vehicle's ECM, or gear with a jammer rating, rolls its rating vs TN = the link's signal + the drone's ECCM (`jamming.eccmAddsTn`). Any success jams it: a rigger jumped in from outside is pushed out (no dump shock unless `jamming.dumpShock`), remote jump-ins and group commands are refused until cleared from the vehicle sheet |
| Sensor modes | Passive: +2 TN to sensor tests (`sensorModes.passiveTn`), and ECD never notices (`passiveHidden`). Active: as before |
| Firing arcs | A fixed mount can face front, rear, left or right; the target must be within 45° of it (`arcs.degrees` 90), measured from the vehicle token's rotation (+`facingOffset`). Outside: warned (`enforce`), or refused with 'block'; the Fire dialog can override |
| Cargo and load | Load in kg (0 = not tracked) against the items the vehicle carries (weight × quantity; mounted weapons don't count) + 100 kg per person aboard (`cargo.personKg`). Overloaded: +2 TN on driving tests (`overloadTn`) |
| Autosofts | Maneuver (driving tests), targeting (mounted weapons) and clearsight (sensor tests with nobody at the controls) add their rating in dice when the vehicle's own autopilot rolls, each at most its Pilot/Autonav (`capAtPilot`) |
| Modifications | `VEHICLES.modifications`: extra armor +1 per rating (¥1,000 × rating × Body), engine +10 Speed (¥2,000), Handling −1 (¥5,000; never below 1), signature masking +1 Signature (¥3,000 × Body), sensor, ECM, ECCM, ECD, Autonav, Pilot +1 each, rigger adaptation (¥2,500 × Body; needed to jump in only with `RIGGING.needsAdaptation`). Installing changes the stat and charges the payer; taking it out puts the stat back |
| Least certain | Rigger adaptation is not needed by default (`RIGGING.needsAdaptation` false); SR2 may require it to jump in |
| Chases on the canvas | After a chase turn the pursuer's token is moved the gap behind the quarry's along the line between them (`chase.moveTokens`); not while the game is paused |
| Device senses | A device senses visually, by low-light, thermographic, ultrasound, motion or pressure ('' = not set: concealment ignored). Against visual and low-light cameras: improved invisibility blinds them, invisibility (mana) does nothing, a chameleon suit adds its rating to their TN; thermographic: improved invisibility blinds, thermal masking adds its rating; ultrasound, motion and pressure: none of them count (`SECURITY.concealment`). Concealment comes from worn stealth suits and the intruder's own sustained (Improved) Invisibility (successes = rating), or is set in the Detect dialog |
| Tamper alarms | A device's tamper rating checks every successful bypass: rating dice vs TN = the bypasser's skill rating (`tamper.tnFrom`; or `fixedTn` 4); as many successes as the bypass's trips it: +3 tally (`tally`) and the alert to active (`alert`). Whispered to the GM |
| Bypass time | Base Combat Turns by device kind (maglock and door 10, alarm, camera, sensor, scanner 6, other 10; `bypassTime.baseTurns`) ÷ successes, rounded up; 3 s per turn; shown on the card |
| Not modeled | Since built (all v0.49.0): jamming a decker's wireless link, otaku complex forms and channels, programming suites and optimisation options, deck parts' sizes and materials, cargo by volume, firing arcs for turrets with limited traverse, installation tests for vehicle modifications, masking spells against sensors, tamper alarms on breached or smashed devices. Still not modeled: signal range of satellites (no limit), tamper alarms on Matrix tampering, designing new vehicle modifications (add rows to `VEHICLES.modifications`) |

## Combat and gear (v0.47.0), also from memory

Values are in new keys of `RULES.COMBAT` (`melee.defaultAttribute`, `scatter.diagram`, `confined`, `cover.from`) and `RULES.GEAR` (`concealment.groupTnPerPerson`, `accessories.laserRangeMetres` and `scopeVision`, `shields.ranged`, `spellsVsObjects`, `disarm`, `cyberDamage.nonAttack`); the logic is in `src/module/rules/armory.ts`. **All from memory of SR2. Least certain: the Object Resistance TNs by kind, the laser sight's range, the TN for disarming a charge, the group search penalty, and whether shields help against ranged attacks at all.**

| Rule | Current implementation |
|---|---|
| Wall cover | Checked from the attacker's whole token (`cover.from` 'token': the centre and four corner points inset; the least-blocked one counts) or only its centre ('centre') |
| Melee defaulting | A cyberarm's own Strength counts when defaulting to Strength with it. An unskilled melee attack with no martial art defaults to the skill's linked attribute (Strength for armed, edged, clubs, unarmed, polearms, whips, cyber-implant weapons; `melee.defaultAttribute` 'linked'), or always Quickness or always Strength |
| Grenade scatter | The direction die reads along the throw (`scatter.diagram` 'throw': 1 beyond the target, then clockwise every 60°: beyond-right, short-right, short, short-left, beyond-left), from the thrower's token to the target point; with no token, or 'compass', 1 = north clockwise |
| Confined spaces | A blast is confined when at least `confined.rays` 6 of 8 directions meet a wall within its radius; it gains `bonus` 0.5 × the Power left at the nearest wall (`mode` 'nearest') or at the walls' average distance ('average'); `enabled` turns it off |
| Searching a group | Look over or scan everyone targeted at once (never the searcher): one action, +`groupTnPerPerson` 1 TN per person after the first; a frisk is one person at a time (the one picked) |
| Scope vision | A weapon's scope can carry low-light or thermographic vision (`scopeVision`), which counts for ranged attacks with it |
| Laser range | A laser sight's modifier is pre-ticked only within `laserRangeMetres` 50 m (0 = no limit); re-checked when another target is picked (unless the box was changed by hand); attacks made from macros take the situational modifiers they are given |
| Spells against objects | A physical spell cast at an object (the cube icon by the spell): Sorcery vs the object's TN (natural 3, low-tech 5, high-tech 8, highly processed 10; `spellsVsObjects.tns`); mana spells have no effect. A combat spell at a wall (selected walls, or those between the caster and the target) hits it with Power = Force + `powerPerSuccess` 1 per success. It uses the normal spell test (magical modifiers, foci, totem dice, Spell Pool, Karma; a sustained spell stays up) and drain; a player's cast at a wall posts a card the GM applies |
| Shields against ranged attacks | A worn shield's Parry adds dice to a ranged dodge (`shields.ranged` 'dice', or 'off') |
| Disarming a charge | GM panel, on a timed charge: the selected token's Demolitions vs `disarm.baseTn` 4 + `tnPerSetterSuccess` 1 per success the setter rolled. Any success disarms it; all ones sets it off (`disasterBlows`) |
| Cyberware and non-attack damage | Deadly physical damage from fire (and falls, when deadly) also offers the cyberware damage check (`cyberDamage.nonAttack`) |
| Not modeled | Disarming a charge that isn't on a timer (use its card's Detonate, or delete it), spells against objects other than walls doing damage, scatter for rockets fired from vehicles by their facing |

## Health, magic and critters leftovers (v0.48.0), also from memory

Values are in new keys of `RULES.FIRE` (`walls`, `fuel`, `smoke`), `RULES.OCCULT` (`metamagic.reflecting.powers`, `metamagic.possessing.skills`, `initiation.deed/familiar/meditation/oath/thesis`, `ally`, `design.modifiers`), `RULES.CRITTERS.infection`, `RULES.HEALTH` (`weather` driving/movement, `weatherOn`, `contagion`, `radiationSickness`) and `RULES.BIOWARE.recovery.care`; the logic is in `src/module/rules/afflictions.ts`. **All from memory of SR2, The Grimoire and the Shadowrun Companion. Least certain: the ally ritual's costs and grade, the ordeal TNs, the design modifiers added here, the infection disease's numbers, radiation sickness stages, weather on driving, and the care multipliers.**

| Rule | Current implementation |
|---|---|
| Fire and walls | A solid wall between a fire and a token keeps the heat off (`walls.block`). A wall ticked "Burns" in its config loses `burnPerTurn` rating each spread (small 0, burning 1, blaze 2, inferno 3; unrated walls count as `defaultRating` 2); at 0 it is breached and the fire reaches past it |
| Fuel | Drawings the GM marks as fuel (GM panel): light (paper, brush, furniture: +1 m a turn, +3 turns) or accelerant (petrol, oil, chemicals: +2 m a turn, +6 turns, one intensity step hotter). A fire that reaches one (not through a wall) starts a new fire at its centre that can grow to cover it; a fire started inside fuel takes its kind |
| Smoke | Out to 3 m beyond the flames (`smoke.extraMetres`). A line of fire through the smoke pre-selects Smoke in the Attack dialog, through the flames Thermal smoke (`flamesKind`); Perception through it gets the same modifier. After burning out the smoke lingers 3 Combat Turns (`lingerTurns`) |
| Smoke inhalation | Everyone in the smoke when the fire spreads gets a button: Body vs Power 4 + 1 per intensity step, L Stun, staged down; a gas mask stops it, a respirator and inhalant filters add dice |
| Reflecting powers | Critter and spirit powers resisted by a reflecting initiate bounce back like spells (`reflecting.powers`), resisted with the power's own pool |
| A possessed body's skills | The possessor's skills are copied in when the possession starts; the body tests with them (`possessing.skills` 'possessor'); or the body's own ('body'), the better ('best'), or mental and knowledge skills from the possessor and physical ones from the body ('split') |
| Ally spirits | Initiate grade 1+ (`ally.minGrade`), Force up to Magic (`maxForce`): Conjuring (+ the best circle or lodge rating) vs Force; materials 1,000¥ × Force; Force days; any success creates the ally (no services) and bonds it for 1 Good Karma × Force; conjuring drain at the Force |
| Ordeals | Deed: the GM confirms it on a card and the Karma is paid then. Familiar: needs an ally conjured since the last initiation (`familiar.needsAlly` block). Meditation: Willpower vs 4 + grade, grade weeks. Thesis: Magical Theory (else Intelligence +4) + library or lodge dice vs 4 + grade, grade weeks. A failed meditation or thesis postpones the initiation with no Karma spent. Oath: a geas protecting 1 Magic (`oath.geasMagic`), to a group if `needsGroup` |
| Spell design | Drain modifiers added: permanent +1, very restricted target −1, extended range (detection) +1, one sense (illusion) −1. Exclusive and fetish designs carry those flags, so their drain TN changes apply when cast |
| Infection (a bite) | A critter power with the Infection special: its melee blows that do 1+ Physical box (`minBoxes`) to a character or NPC offer "Resist infection": the power's Substance (else HMHVV (Krieger strain)) at the power's rating and level, Physical, injected, 72 h incubation, a test every 24 h, 3 clean tests to recover, contagious by blood |
| Contagion | A disease item can be contagious (airborne, contact, blood). Airborne reaches everyone within 2 m of the carrier's token (`contagion.radiusMetres`), contact and blood the targeted tokens; from the sheet or the disease's progress card. Not while incubating (`duringIncubation`). Power + `powerModifier` 0. Nobody gets the same disease twice at once |
| Radiation sickness | Each exposure adds rating × hours to a dose. 10: mild (4L), 25: radiation sickness (6M), 50: severe (8S), 100: acute (10D) Physical, tested every 24 h, 3 clean tests to recover; a worse stage replaces a milder one. The dose falls 1 a day (`decayPerDay`) |
| Weather on driving | TN + light rain 1, heavy rain 2, heavy snow 3, fog 1, thick fog 2, storm 3 on driving tests and chases (the drive dialog can untick it for covered places) |
| Weather on movement | Walking, running and athletics distances × heavy rain 0.75, heavy snow 0.5, thick fog 0.75, storm 0.5 |
| Care while recovering | Recovery days after surgery × resting alone 1.5, medkit 1.25, hospital 1, intensive 0.75, poor 2; at home 1 + 0.25 × the lifestyle's home-care TN. Hospital and intensive care can be paid per day at surgery. Changing the care later rescales the days left, charges the new paid care for them and refunds only care that was paid |
| Timers on unlinked tokens | Diseases, drugs, timed statuses, radiation decay and magic timers now also run on unlinked tokens' own actors (they ran only on world actors before) |
| Not modeled | Fire spreading along walls themselves, wind, smoke drifting, ghouls' other strains and the change itself (the GM's call), long-term radiation effects beyond sickness (cancers, Essence), contagion by touch without targeting, allies' own forms and powers (copy a template spirit) |

## Street, Matrix, rigging and security leftovers (v0.49.0), also from memory

Values are in new keys of `RULES.STREET` (`qualities.karma`, `contacts.ownDice/favourDice/favourWaivesFee/maxFavours`, `heat`), `RULES.MORALE.mixed`, `RULES.UPKEEP.effects`, `RULES.MATRIX` (`otaku.channels`, `otaku.complexForms`, `programming.suites`, `programming.options`, `deckBuilding.daysPerMp` and the parts' `size`/`costPerMp`/`memory`), `RULES.RIGGING.jamming.onDecker`, `RULES.VEHICLES` (`turrets`, `install`, `cargo.personCf`) and `RULES.SECURITY` (`guards`, `identity`, `tamper.onBreach/onForce/deadTally`, the `acoustic` sense and the `silence`, `mask`, `physicalMask` concealment kinds); the logic is in `src/module/rules/remnants.ts`. Item templates gained list prices (`cost`). **Program options, deck-part sizes, heat and favours are house rules where SR2 has nothing to check.**

| Rule | Current implementation |
|---|---|
| Builder: skills and gear | The Build dialog takes active, knowledge and language skill lists ("Firearms 5, Stealth 3 (Urban 5)"; a specialization with no rating of its own is the rating + 2) and a gear list ("Heavy pistol, Medkit ×2, Fake SIN ¥5000"). A gear name that matches an item template (world templates first) takes its type, fields and list price unless a price is given. The lists feed the build check and "Fill the sheet" makes the items (a skill already on the sheet is re-rated) |
| Template list prices | Hold-out 100, light pistol 350, heavy pistol 450, SMG 900, assault rifle 1,600, sniper rifle 4,000 (v0.77.0; was 8,000), shotgun 700, LMG 2,500, bow 300, throwing knife 20, grenades 30 (flash 40 since v0.77.0), missile launcher 8,000, flamethrower 1,600, knife 30, sword 500, club 10, pole arm 500, stun baton 750, taser 1,000; armor jacket 900, vest 200, armored clothing 500, helmet 200, form-fitting 500, riot shield 1,500; datajack 1,000, smartlink 2,500, cybereyes 5,000, wired reflexes 1 55,000, dermal plating 1 6,000, ICCM 10,000; medkit 200, weapon detector 1,000, cyberware scanner 1,500, sniffer 2,000, RCD 100,000 (v0.77.0; was 5,000), jammer 4,000, chameleon suit 8,000, tortoise 6,000 |
| Edges and flaws with Karma | In play, gaining an edge costs its points × 2 Good Karma (`qualities.karma.edgePerPoint`); buying off a flaw costs its points × 2 (`flawPerPoint`). The + button still adds either kind for free (character creation) |
| Contacts' own dice | A contact with dice of their own (the contact form) rolls them against the same legwork TN; `contacts.ownDice` 'best' (the better result counts), 'add', 'instead' or 'off' |
| Favours | Each contact keeps a favour count (+ they owe you, − you owe them, within ±5, `maxFavours`). Calling one in adds 2 dice (`favourDice`) and waives the fee (`favourWaivesFee`); asking one of a contact who owes none puts you in their debt. The sheet's handshake icons adjust the count |
| Heat on stolen goods | Weapons, armor, gear and cyberware have a Heat (0–10, set by the GM). Setting it stamps the world time; it cools 1 point every 7 days (`heat.coolDays`). A fence pays 5% less per point (`percentPerPoint`, never below 0%) and refuses anything above 8 (`refuseAbove`). On a sale the item's Heat rolls against 4 (`traceTn`); any success sends the GM a "word gets around" card |
| Mixed groups for morale | The GM panel groups selected tokens (any NPCs) for morale. One test for the group on the highest standing member's Professional Rating (`MORALE.mixed`: highest, average, lowest, or the rolling NPC's), every member down counting as a casualty; all break together and a rally clears all |
| Lifestyle beyond the bill | More than 7 days overdue (`effects.graceDays`), the GM gets a card (once per unpaid date) to move the character down a lifestyle (`effects.overdue` prompt, auto or off); the new lifestyle starts unpaid. Finding gear: street +2, squatter +1, high −1, luxury −2 TN (`effects.availabilityTn`). Resting at home while overdue past the grace days counts as the street (`overdueHomeCare`). In 'auto' mode an unpaid tenant drops one lifestyle each grace period until they pay or reach the street |
| Otaku channels | With otaku on: Access, Control, Index, Files and Slave channels, each at most MPCP, raised for new rating × 2 Good Karma. A channel works on its subsystem's tests like a utility (the better of the channel and the loaded utility lowers the TN; `channels.mode` 'utility') or adds its rating as dice ('dice') |
| Complex forms | An otaku's own programs: learned for rating × 1 Good Karma, at most MPCP; use no memory (`noMemory`) and are never erased by tar pits (`neverErased`) |
| Programming suites | Gear with a suite rating adds that many dice to programming tests (`suites.mode` 'dice'; 'tn' takes it off the TN), capped at the programmer's Computer rating; it also helps design deck parts (`suites.deckBuilding`) |
| Program options | Optimization (size × 0.75, TN +1, time × 1.25), squeeze (size × 0.5, TN +2, time × 1.5), quick and dirty (size × 1.25, TN −1, time × 0.5). Options are stored on the program; the book size uses them |
| Deck parts by size and materials | A part's design size is `size` × rating (MPCP: × rating²): MPCP 2, persona programs 2, Hardening 4, Response Increase 7 Mp per point. Time = size × 1 day (`deckBuilding.daysPerMp`) ÷ successes; materials = size × `costPerMp` (MPCP 500, persona 250, Hardening 500, Response Increase 3,500). Memory parts are bought in Mp: active memory TN 4, ¥20/Mp, 100 Mp per Mp of design; storage TN 3, ¥5/Mp, 200; I/O speed TN 4, ¥50, 20. They add to the deck's memory |
| Jamming a decker | A decker on a wireless connection (cellular, relay…) can be jammed: the jammer's rating vs the deck's signal. Any success dumps them from the Matrix with dump shock (`jamming.onDecker` 'dump'; 'block' holds them unable to act), and they can't jack in over that link until it is cleared (sheet) |
| Turrets | A turret faces somewhere (relative to the vehicle's front), turns 90° a shot (`turrets.traverse`, or the weapon's own) within its limit (360° all round, or the weapon's own). Turning further: +2 TN per extra traverse step (`tnPerStep`; 'block' refuses). Outside the limit warns (`enforceLimit`). Firing turns it to the target (only when the shot is made; past its limit it stops at the edge). A gunner who doesn't own the vehicle has the GM's client turn it |
| Installing modifications | A mechanic's vehicle B/R skill (else Intelligence +4) vs TN 4 + 1 per rating (`install.tn`, `tnPerRating`); 4 hours per rating ÷ successes. The parts are paid on success; all ones does 1 box to the vehicle (`botchBoxes`). `install.required` off keeps the plain "straight in" option |
| Cargo by volume | Vehicles have a Cargo Factor (0 = not tracked); items have a CF each; each person aboard takes 4 (`cargo.personCf`). Over the CF or over the Load is overloaded (+2 TN driving) |
| Guards' Perception | A site's guards (actors) look for the picked intruders: each intruder's Stealth once against all the standing guards (as Sneak, whispered). Each guard who notices anyone adds 2 to the tally once (`guards.tallyPerGuard`) and raises the alert to active (`guards.alert`) |
| Masking spells against sensors | Silence (and Improved Silence, Stealth) blinds acoustic sensors (`concealment.acoustic.silence`). A physical mask adds its successes × 1 to the TN of a device that identifies people (`identity.physicalMask`); a mana mask fools no device (`identity.mask` 0). Spells sustained by someone else on the intruder now count too (sustained spells record their targets) |
| Tamper alarms beyond bypasses | A device whose door wall is breached trips its tamper alarm with no roll (`tamper.onBreach`) and the door counts as bypassed (broken open); smashing or cutting out the device from the site sheet switches it off and trips it too (`onForce`). Each happens once. A smashed device without a tamper alarm goes dead on the board: +1 tally (`deadTally`) |
| Stat-block import: cyberware, spells, powers | Cyberware/Bioware, Spells and Powers / Adept Powers / Critter Powers / Weaknesses lines become items. Essence, Body Index and power point costs the block leaves out come from small tables (VERIFY, listed in `statblock.ts`) and are reported. Wired reflexes 1/2/3: 2/3/5 Essence, +2 Reaction and +1 die per level; boosted reflexes 0.5/1.25/2.8; dermal plating 0.5/1/1.5; datajack 0.2; smartlink 0.5; muscle replacement N; skillwires 0.2 × N; improved reflexes (adept) 2/3/5 points. The importer subtracts the new items' bonuses from the block's shown values, so they are not counted twice |
| Not modeled | Otaku: submerging, echoes and Charisma-based fading (use the channels and complex forms); program options with combat effects (area, penetration); turret traverse by Combat Phase rather than per shot; a vehicle's cargo shape (only its CF); guards on patrol routes (the GM triggers each look); tamper alarms on Matrix tampering; heat on anything but items (wanted characters are the GM's) |

## Target-number automation (v0.50.0), from memory and house rules

Values are in `RULES.TN_AUTO` in `src/module/rules/config.ts`; the logic is in `src/module/rules/situation.ts` and the actor's `sightTo`, `perceptionAgainst`, `attackSight`, `sensorSituation`, `drivingSight` and `#spellEnvironment`. **Most rows are house rules where SR2 says little (perception ranges, hearing only, prejudice, sensor ranges); check the book where it has a table.** Every row can be switched off. In every roll dialog each modifier found this way has a box: unticking it leaves it out of that roll.

| Rule | Current implementation |
|---|---|
| Perception: light | The light at the observed token (scene darkness and light sources) by the observer's best vision, from the attack visibility table (normal 0/2/4/8, low-light 0/0/2/8, thermographic 0/1/2/4) (`perception.light`) |
| Perception: distance | Within 2 m −1, up to 20 m +0, up to 100 m +1, beyond +2 (`perception.range`). Replaces "Within a few metres" in the perception table |
| Perception: can't see | Walls block every sight line, the observer is blinded, or the target is invisible to the observer's senses: by ear only, +4 (`perception.hearingTn`); light, smoke and weather drop out. `noSight` 'block' = can't notice them at all (no roll); 'ignore' = roll as if seen |
| Perception: concealment | Worn stealth gear and masking spells on the observed person, against living eyes (`perception.living`): invisibility and improved invisibility blind eyes; a chameleon suit +1 × rating to visual and low-light eyes, 0 to thermographic; thermal masking +1 × rating to thermographic. The observer uses the sense fooled least |
| Perception: the sneaker | A sneaker who ran this Combat Turn (token movement, started combat): +4 to their Stealth (`perception.sneakerMoving`). The sneaker's side now has their own wounds, penalties and edges and flaws; each observer's side too |
| Sneak and Guards look | The ticked observer conditions (distracted, noisy…) go on each observer's TN, as in Perceive (they used to come off the sneaker's TN) |
| Search | Looking someone over takes the light at them and the weather; a frisk takes neither (`perception.friskWeather`) |
| Device detection | A camera-like device (visual, low-light, thermal, ultrasound) gets the light at the intruder, smoke between and the weather, by its sense |
| Attacks: visibility | Blind fire (walls, full cover, an unseen target) and a blinded attacker count once (the worse); light, smoke and weather drop out when the attacker can't see (`attack.blindNotStacked`). The target's concealment against the attacker's eyes (`attack.concealment`): a chameleon suit +rating; invisibility = blind fire |
| Attacks without the dialog | Mounted guns, grunt group members on their own tokens and other paths read light, cover, smoke, weather, prone, barriers and the target's concealment from the tokens themselves; each group member and each drone in a group attack is measured from its own token (range band) |
| Attacks: movement in melee | Walking/running are ticked by themselves for ranged attacks only (`attack.movementInMelee` false); Charging still is |
| Melee defense | The defender in opposed melee: Blinded, the light on the attacker and the attacker's concealment count by the defender's eyes (`attack.meleeDefenseSight`) |
| Social: prejudice | Added by itself: human or elf vs ork or troll +2, elf vs dwarf +1, either way round (`social.prejudice`); not when "Prejudiced" is picked |
| Social: attitude | Pre-picked from the target token's disposition: hostile → Suspicious, neutral → Neutral, friendly → Friendly (`social.disposition`) |
| Social: the listener | The listener's side has their full own penalties (sustaining, drugs, hunger…), not wounds only (`social.defenderFullPenalties`). Haggling, fencing and finding gear count Street Cred (`social.credOnDeals`) |
| Magic: environment | Light, smoke and weather on spellcasting: 'elemental' spells only (they hit like ranged attacks; default), 'all' spells with a target, or 'off' (`magic.environment`). Blinded counts instead of them when the caster can't see |
| Magic: line of sight | 'warn' (default) or 'block': no spell, power or banishing at a target the caster's token has no line of sight to (a ritual reaches by link) (`magic.lineOfSight`) |
| Magic: powers and the scene | Critter powers count the background count (`magic.powersBackground`). Background count, weather and the totem environment come from the scene the actor's token is on (`magic.tokenScene`). Banishing and the ally ritual get totem environment dice |
| The Matrix | Hacking Pool tests (every decker test) skip the meat body's Blinded and astral perception (`matrix.skipBodyStatuses`); the host's detection roll takes smoke in the host (`matrix.smokeOnDetection`); IC, frames and agents roll free of their token's statuses (`matrix.icNoPenalties`); Medic rolls the utility's rating with no decker penalties |
| Rigging: senses | A jumped-in rigger's driving and gunnery skip the body's Blinded and astral perception (`rigging.skipBodyStatuses`). Jumped in or on autopilot, light, smoke and weather are judged by the vehicle's sensors (new vehicle Sensors: low-light / thermographic boxes); a driver by hand uses their own eyes |
| Rigging: driving | Poor visibility (+2) by itself when the light at the vehicle gives a visibility TN of 4 or more for those eyes (`rigging.poorVisibilityFrom`) or smoke is on it (`smokeIsPoorVisibility`); the weather's driving modifier and poor visibility (also ticked by hand) count once, the worse. Over the vehicle's Speed counts by itself in every driving test (`overSpeedAuto`). The scene's terrain (GM panel) is picked by default |
| Rigging: sensor tests | The jumped-in rigger's own penalties and vehicle damage (`sensorPenalties`), a weak remote link, range +1 per band beyond 100 / 250 / 500 / 1,000 m × the Sensor rating (`sensorRange`), smoke and weather by the sensors, and the target's concealment (improved invisibility: can't pick them up) |
| GM: change a TN afterwards | Right-click a test card (GM only): a checklist of the modifiers it used (ticked), the scene's on the roller now and the others its kind of test can take (unticked), the base TN and a GM adjustment. The dice already rolled are scored again (no new roll; Rule of Six re-rolls always happen, so it is exact; a disaster stays one; bought successes stay) and the outcome is worked out again as a Karma re-roll does; a new card replaces the old one. Contests (perception, social, sneaking): pick the side |
| Not modeled | Since built (all v0.61.0): wards placed on the map (`placeWardRegion`), smoke grenades (`COMBAT_V61.smoke`), hearing-based senses (`COMBAT_V61.hearing`), drug effects beyond their attribute changes (`HEALTH_V61.drugs`). Still not modeled: one-off effects a TN change can't take back (a file found, an alert raised, cyberware installed, a defense or soak already rolled) |

## GM tools (v0.51.0): table conveniences, not book rules

Values are in `RULES.GM_TOOLS` in `src/module/rules/config.ts` (house rules: "GM tools"); the logic is in `src/module/rules/gmtools.ts`, `src/module/applications/undo.ts` and the GM panel (`applications/ui.ts`). Nothing here is from the book except the calculator's dice maths.

| Rule | Current implementation |
|---|---|
| Time steps | +3 s (a Combat Turn), +1 min, +10 min, +1 h, +1 day, +1 week, +1 month (`monthDays`, 30), +1 year (`yearDays`, 365). A step of a week or more asks first (`confirmFrom`). Every timed effect comes due once (fires at most 50 turns) |
| Undo | The system's own log: every client notes a change's old values before making it; GM browsers log changes to actors (also unlinked tokens' actors), items, statuses, tokens (not moves: `skipTokenMoves`), scenes, walls, drawings, templates, lights, combats, combatants, chat cards and the system's world settings and world time. One person's changes within 1.5 s (`undo.windowMs`) are one step (a step that moves world time stays open 5 s for the timed effects it sets off); the last 50 steps (`undo.maxSteps`, and at most about 600,000 characters) are kept in this browser. Undo takes back the newest step, newest change first; a field something else changed since is listed and the GM chooses. A second Undo within 0.6 s (a double-click) is ignored; the GM's own changes for 1.5 s after an undo (what it sets off) aren't logged. What it can't undo is listed in the panel (`UNDO_LIMITS`). Ctrl+Z (GM) takes whichever came last: the newest step here or the newest entry in Foundry's own history of the active canvas layer (each entry is time-stamped; a step at the same moment wins); one undoing a change the other also holds drops it from the other, so nothing is undone twice or redone. Players keep Foundry's Ctrl+Z |
| Calculator | Chance per die with the Rule of Six (TN 2–6: (7 − TN)/6; above 6: 1/6 × the chance of TN − 6), binomial over the dice; a disaster is every die showing 1 ((1/6)^dice). Check: SR2's TN 7 needs a 6 and then any re-roll, the same as TN 6 |
| Heal several | Boxes come off with no test (a GM shortcut, not natural healing) |

## NPC generator (v0.52.0): table conveniences, not book data

Values are in `RULES.NPCGEN` in `src/module/rules/config.ts` (house rules: "NPC generator"); the logic is in `src/module/rules/npcgen.ts`, the flavour tables in `src/module/rules/npcdata.ts` (original, generic; no book text or setting names). Nothing here is a book stat block; check the numbers against how dangerous you want your table's opposition.

| Rule | Current implementation |
|---|---|
| Threat Level 0–5 | Base attribute 2/3/3/4/5/6, base skill 1/2/3/4/5/6, Professional Rating 0–5, Karma Pool 0/0/1/2/3/5, gear tier 0–5, cyberware tier 0–4, chance an "anyone" role is Awakened 2–20%, Magic 2/3/4/4/5/6, spells 1–6 at Force 2/3/4/4/5/6, group base size 2/3/4/4/5/6 (+0–4 by kind), nuyen carried 20–15,000 (`threat`) |
| Attributes | Base ± 1 (`spread`) plus the role's offsets, 1 to 6 before racial modifiers (`maxAttribute`); every total stays 1 or more after racial modifiers (a troll's Charisma) |
| Skills | The role's skills at the Threat Level's rating ± 1, 1 to 8 (`maxSkill`); a specialization at +2 from Threat 2; every weapon carried brings its skill |
| Gear and cyberware | Weapons and armor are copies of the item templates (`ITEM_TEMPLATES`) by gear tier; cyberware by tier in the stat-block importer's words (its Essence table). Magicians carry no cyberware |
| Magic | Mages (hermetic), shamans and talismongers (shamanic), adepts; spells from the importer's spell table by theme; adept powers bought with Magic at the importer's power point costs |
| Groups | A leader one Threat Level up; the rank and file (at least two, on one grunt-group sheet by default); specialists on top by kind and Threat Level (gang shaman/enforcer/decker, security mage/decker/specialist, combat mage/heavy gunner/rigger, police mage, a bodyguard detail's principal) |
| Organisations | Scale and security by Threat Level; a Matrix host blue-3 … red-8 (`hostCode`, `hostValue`) with subsystems about 1.6 × the Security Value |
| Contacts | Level 1/1/2/2/3/3 (`contactLevel`), Loyalty 1–3 + Threat/2, the role's knowledge and fee |
| Spirits | Force 1–6 (`spiritForce`); a spirit of that type kept as a template lends its adjustments and powers |
| Critters | Generic animals (guard dog, wolf, big cat, bear, Awakened wolf) with natural weapons and senses; no metatype maximums |
| Jobs | Pay per runner by Threat Level (`jobPay`), one to three complications, a twist 20–70%, targets that fit the job, an opposition group |

## Safehouses (v0.53.0): table conveniences, not book data

SR2 has lifestyles but no rules for building a safehouse, so everything here is a house rule. Values are in `RULES.SAFEHOUSE` in `src/module/rules/config.ts` (house rules: "Safehouses"); the sums are in `src/module/rules/safehouse.ts`. Check the costs against any sourcebook your table uses (a ward's or a lodge's materials, fake SINs, security devices from the gear lists).

| Rule | Current implementation |
|---|---|
| Location | 9 locations (abandoned zone … corporate enclave, rural, undercity): a build-cost multiplier ×0.2–×3 on the size's cost, an upkeep multiplier ×0.2–×2.5, concealment −2 … +3, security −1 … +3, a cap on comfort (squatter … luxury) and a police response time (shown only) |
| Size | 7 sizes (coffin … compound): cost 500¥–400,000¥, upkeep 100¥–10,000¥ a month, space 1–40, base comfort, wall Barrier Rating 4–16, how many it sleeps |
| Options | 54 options in 9 categories (structure, security devices, active defences, magic, Matrix, facilities, comfort, concealment, staff), each with a cost, monthly upkeep and space, rated ones × rating; some can be taken several times, some need another (a home host needs a server room, turrets and drone bays a rigger station; without it the option is listed but counts for nothing) |
| Totals | Build cost = size × location + options; upkeep = (size + options) × location; security and concealment add up (fractions dropped at the end), security at most 12 and concealment at most ±8 (`caps`); comfort = the size's base + whole steps, capped by the location; Barrier = size + reinforcement; ward = the highest ward Force |
| Paying | Building can be paid in parts from any character the user owns (nothing is refunded when options are removed); upkeep a month (30 days) at a time, from today or the paid-until date if later |
| Lapsed upkeep | Past 7 grace days (`graceDays`), one GM card per unpaid date, and the comfort used for home care falls to Squatter (`overdueComfort`) |
| Home care | Owners and residents resting at home use the better of their own lifestyle and the safehouse's comfort (`homeCare`), plus a medical bay's or street doc's −1 TN each; only once it is fully built and its upkeep is paid (never paid, still owed or lapsed gives nothing) |
| Searching for it | The searcher's dice (Intelligence by default; Etiquette (Street) suits) vs TN 4 + concealment (minimum 2); 1 success finds it in 7 days ÷ successes (`search`) |
| Linked actors | Security devices become a site actor (re-making it replaces only the devices it made); a ward a barrier actor of that Force; a home host a host actor (code blue ≤2, green ≤4, orange ≤6, red; subsystems about 1.5 × the Security Value); a library, circle or lodge a gear item of that rating for an owner or resident |
| Not modelled | Since v0.61.0 a paid-up workshop counts as a Build/Repair tools level (`STREET_V61.workshop`). Garage bays, supplies, panic room, escape tunnel and staff are shown but not applied by themselves |

## Review fixes (v0.54.0), from memory

The full review after v0.53.0 (`docs/REVIEW-v0.53.md`) found these; the "book" ones wait for a check against SR2. House rules: "Tests and dice", "Initiative and actions", "Magic and critters".

| Rule | Current implementation | Where |
|---|---|---|
| Attacker's damage staging | 'afterFirst' (unchanged default): the first net success hits and each further 2 raise the level (2 net: no change). 'all': every 2 net successes raise a level (2 net: one level), which is how I remember SR2. Check the book and pick | `ATTACK_STAGING` |
| Wounds and Initiative | The wound modifier comes off the initiative roll (Light −1, Moderate −2, Serious −3; a jumped-in rigger's wounds on the vehicle's too), and a wound taken mid-turn lowers the combatant's score at once. The penalty already taken this Combat Turn is kept on the combatant, so healing, a re-rolled soak, an undo or the next grunt stepping in never take it twice or give it back. Not on an astral form's initiative | `INITIATIVE_WOUNDS` |
| Physical adepts' Spell Pool | None (SR2 adepts cast no spells); a house rule gives them one | `ADEPT.spellPool` |
| Which spells an elemental aids or sustains | 'category' (new default, as I remember SR2): fire for combat, water for illusion, air for detection, earth for manipulation. 'element': only a spell of its own element (the v0.18.0 behaviour, now for sustaining too). 'any'. Check the book | `MAGIC_EXTRA.elementalMatch`, `elementalCategories` |
| Essence and surgery | Essence (and Magic) go at implant, even while the item heals in; the item's effects (bonuses, jacks, smartlink, vision, limbs) start only when recovery ends | `augmentationsOf`, `cyberDerived` |
| Ware prices | One price everywhere: cyberware by grade, bioware by cultured or not (bioware has no grade) | `wareCost` |
| Orthoskin and dermal plating | Compared kind by kind (ballistic with ballistic, impact with impact) | `bioDerived` |
| Sensor tests | A jumped-in rigger's control rig TN bonus applies, as on driving | `sensorSituation` |

## Combat and health holes (v0.55.0), from memory and house rules

From the review after v0.53.0. Values in `RULES.COMBAT` (aim, multipleTargets, unaware, reloadFeed, ready, armorFor, shotgunTnPerMetre, blastCombine, suppressive, burning, hold), `RULES.PATCHES`, `RULES.HEALING.firstAid.afterMagic` and `RULES.BIOWARE.surgery.trauma`; rules in `src/module/rules/tactics.ts`.

| Rule | Current implementation |
|---|---|
| Take Aim | A Simple Action with one weapon at the targeted token: −1 TN per action on the next attack at it, at most half the skill (at least 1); another target or weapon, any other action, a new Combat Turn or the attack itself ends it. A crosshair button on ranged weapon rows |
| Several targets in a phase | A ranged attack at a different target than earlier in the same Combat Phase: +2 TN per other target already shot at (full-auto spread keeps its own rule) |
| Unaware targets | A target who doesn't know the attack is coming can't dodge, counter or spend pool dice (the Attack dialog's "Target unaware"; automatic for targets the attacker surprised this turn) |
| Melee defender's situation | The defender's own test gets the prone rows (theirs and the attacker's) and their friends in the melee |
| Reloading | A clip or belt fills in one Simple Action; a cylinder, internal magazine or break-action takes 2 rounds per action (house numbers) |
| Drawing weapons | Off by default; 'action' makes drawing a holstered weapon a Simple Action before the attack (free with a quick-draw holster); 'warn' only notes it |
| Armor per weapon | Each weapon can name its armor; 'auto': melee impact, thrown weapons impact, bows ballistic (house rules), others ballistic |
| Toxin weapons | A weapon can carry a toxin (a gear item on the same sheet): darts and capsule rounds on any hit, blades only when they wound; a gas grenade exposes everyone in the cloud (gas masks and filters count) |
| Slap patches | Stim: up to its rating Stun boxes off; after rating hours they come back +1. Tranq: Body vs TN rating, Stun boxes = rating − successes. Trauma: stabilises the dying. Antidote: + rating dice against the next toxin within rating hours. House numbers |
| Burning | Catching fire burns again (the fire hazard) at each new Combat Turn until put out (a Complex Action) |
| Holds | Strength vs the target's Body against their Body vs the Strength; more successes pins (restrained); breaking free is Strength against the holder's |
| Shotgun spread TN | + TN per metre of spread at the target; 0 by default (check the book) |
| Combined blasts | The GM can combine a blast with the one before it: the strongest Power + half of each other's for anyone caught by both |
| Suppressive fire (Fields of Fire) | A full-auto weapon spends 10 rounds at the targeted people: the weapon's base damage, a Defend button each, and a Take cover button that goes prone (the fire then passes over) |
| Cyberguns | A weapon can be built into a piece of cyberware: it works only while that is installed, working and healed in |
| First aid after magic | Not allowed on a wound magic already healed (until it grows) |
| Surgical trauma (Shadowtech) | Off by default: the operation itself leaves a Physical wound by its size (up to 0.5 points L, 1.5 M, 3 S, more D) |

## Magic and critters (v0.56.0), from memory and house rules

From the review after v0.53.0. Values in `RULES.MAGIC_V56` and `RULES.CRITTERS_V56` (house rules: "Magic and critters"); rules in `src/module/rules/arcanum.ts` (spells, healing, touch, learning, permanence, wards, detection range, assensing, centering, sunrise and sunset) and `src/module/rules/bestiary.ts` (totems, spirit control, true names, adept budget and specials, immunities, TN-changing powers). No book data: spell and power values are filled in on each item.

| Rule | Current implementation | Where |
|---|---|---|
| Spells that change stats | A sustained (or permanent) spell's Effects fields (attributes, Reaction, initiative dice, armor, TN on the target's tests, to notice it, to attack it, movement ×) go on the target (the caster with no target) once it succeeds; a resisted one by net successes. "× successes": each success (`spellEffects.step`) adds the values again, capped at the Force. They come off when the spell leaves the caster's Sustaining list, however it leaves. Check Increase Reflexes, Increase [Attribute] and Armor's own numbers | `spellEffects` |
| Magical reflexes | Initiative dice (and that spell's Reaction) from spells don't stack with working wired, boosted or adept reflexes: the better side counts; of several reflex spells only the best counts | `spellEffects.reflexesExclusive` |
| Healing drain | A health spell set to drain "by the wound" drains at the level of the damage it heals (1–2 boxes L, 3–5 M, 6–9 S, 10 D) | `healing.woundLevels` |
| Treat | Only within 1 hour of the newest damage on that track (warns; a house rule refuses) | `healing.treatHours`, `treatBlock` |
| Touch spells | No line of sight needed; the target must be within 2 m (warns); an unwilling target (combat or resisted spell) is touched first: Unarmed Combat vs 4, opposed by the target's Quickness vs 4; no contact, no spell and no drain | `touch` |
| Learning spells | Sorcery vs the Force; Force days ÷ successes; a sorcery library (hermetic) or a lodge of the totem (shaman) of the Force (warns); Good Karma on success only. Raising a known spell's Force works the same | `learning` |
| Permanent spells | Sustained (with the +2 TN) for ceil(Force ÷ successes) Combat Turns (Foundry's combat round time each, else 3 s of world time), then permanent; dropped before then the effect ends and healed boxes come back | `permanent` |
| Wards | A ritual: Conjuring (+ team dice as for ritual sorcery) vs the Force; Force hours ÷ successes; drain Force ÷ 2, M, for every member; any success makes a barrier actor at the Force. Check the skill, time, drain and any Karma | `ward` |
| Manifestation | A projecting magician or an unmaterialized spirit can manifest: shown faintly on the canvas, can't attack physically | `manifest` |
| Detection range | Magic × Force metres (× 10 extended); further targets warn | `detectionRange` |
| Assensing | 1 success: health, mood, awakened or not, active foci; 2: cyberware yes/no, Essence and Magic against the assenser's; 3: exact Essence and Magic, the cyberware, spells sustained; 4: its signatures here. Whispered to the assenser and the GM | `assensing` |
| Centering (Grimoire) | With a centering skill named: a Center test (the skill vs 4) whose successes, up to the grade, come off the next magical test's wound and sustaining penalties within 30 s; without one, automatic as before | `centering` |
| Nature spirits | Leave at the next sunrise (06:00) or sunset (18:00) of world time; world time 0 is midnight | `natureSpirits` |
| Totem spirits | A totem's conjuring dice only for the spirit types or domains it lists (empty: every spirit, as before) | `totem.spirits` on the sheet |
| Spirit control | Banishing can try to take a spirit over instead: net successes make it the banisher's, owing that many services. A bound spirit's summoner rolls Conjuring vs the banisher's Magic and adds the successes to the spirit's | `control` |
| True names | Conjuring vs the free spirit's Force, opposed by its Force + spirit energy vs Magic; net successes are services; Force × 1 Good Karma | `trueName` |
| Adept power points | Powers past the budget (the last on the sheet first; free powers never) stop working when Magic drops | `CRITTERS_V56.adeptBudget` |
| Adept powers | Rapid healing: + level dice to natural healing. Distance strike: unarmed blows reach Magic metres, not opposed (dodged as ranged). Spell resistance: + level dice to resist spells and powers. Improved senses: low-light, thermographic, ultrasound or hearing. Check the book's effects | `CRITTERS_V56.rapidHealing`, `distanceStrike`, `spellResistance` |
| Critter immunities | A power with Special "immunity" names what it covers. Normal weapons: armor of Essence × 2 against non-magical attacks; fire: no fire damage or burning; poisons: toxins do nothing; pathogens: diseases do nothing; age: a note | `CRITTERS_V56.immunity` |
| Powers that change TNs | Concealment: + rating TN to notice the target. Confusion: + net successes TN to its tests. Movement: movement × rating. Fear: + net successes TN, "afraid". Guard: + rating TN to attacks and hostile (combat or resisted) spells at the target. A power's own fields override | `CRITTERS_V56.powerMods` |
| Not modelled | Since built (all v0.61.0): fire immunity against fire attacks and elemental fire spells, immunity to drugs (`HEALTH_V61.immunity`), healing a patient the player doesn't own (the Apply (GM) healing card). Still not modelled: a partial dispel shrinking a spell's effect, the power-point budget by the sheet's sort order (it uses item order), detection spells' sense ranges per spell, a manifested form being perceived by physical senses (the GM decides), a touch spell against a target who is willing but unconscious, ward rituals' Karma, nature spirits outside the scene's day and night (no calendar), age immunity's effect |

## Matrix, vehicles and security (v0.57.0), from memory and house rules

From the review after v0.53.0. Values in `RULES.MATRIX_V57`, `RULES.VEHICLES_V57` and `RULES.SECURITY_V57` (house rules: "Magic and the Matrix", "Vehicles and rigging", "Building security"); rules in `src/module/rules/datawar.ts` (Matrix) and `src/module/rules/roadwork.ts` (vehicles and maglocks). **All from memory of SR2, Virtual Realities 2.0, Rigger 2 and the Corporate Security Handbook; the least certain are the maneuvers, data bombs, comcall subsystems, the reality filter's effect and the design table (examples, not book data).**

| Rule | Current implementation | Where |
|---|---|---|
| Security tally | One for each intruder (VR2): each decker's detection successes go on their own tally, and sheaf steps fire when that decker's tally reaches them; the alert is the host's. A frame's go on its owner's tally, an agent's on its own (house rule: its owner's); probe and scout IC add to their target's. The host's Tally field shows the highest | `tally.perDecker`, `tally.agentTally` |
| Loading utilities | Off-line: free. Jacked in (Swap Memory, a Simple Action): ceil(size ÷ load speed) Combat Turns (3 s each outside combat) before it works; it takes memory meanwhile. The deck's Load Speed in Mp per Combat Turn (0 = its I/O speed). Unloading is instant | `loading` |
| Matrix damage modifiers | Boxes on the Matrix monitor give the usual wound modifier (1–2 +1, 3–5 +2, 6–9 +3) on the persona's Matrix tests; IC, frames and agents on theirs. Not on Medic (its TN already goes by the damage) | `wounds` |
| Black IC holding a decker | A live black IC in the host that has attacked the decker holds them: jacking out is Willpower (+ Hacking Pool) vs the IC's rating, 1 success to get out. An Evade maneuver or crashing the IC frees them | `blackIcHold` |
| Shutdown | A host that reaches the shutdown alert (crashed, a sheaf step, a linked site's lockdown) dumps everyone inside after 3 Combat Turns (9 s outside combat), with dump shock; frames and agents fall to the parent grid. The host sheet can dump them now or cancel it | `shutdown` |
| Dump shock level | Fixed (M, as before) by default; house rule: by the host's security code, Blue L, Green M, Orange S, Red and Black D. **Check the book** | `dumpShock` |
| IC initiative and dice | The IC's rating + dice by code (as before) by default; house rule: the host's Security Value + 1 (Blue), 2 (Green), 3 (Orange), 4 (Red, Black) d6, and IC rolling the Security Value (their rating stays the Power). **Check the book** | `icInitiative`, `icAttackDice` |
| Matrix perception | Locate Decker / Locate IC / Analyze Icon: the persona's Sensors (house rule: Computer) + Hacking Pool vs a persona's Detection Factor (Analyze: its Masking) or an IC's rating; Lock-On lowers the TN. Analyze: 1 success the kind, 2 the rating and damage, 3 the behavior (IC) or persona ratings and loaded utilities. An IC finds a decker who broke contact again with its rating vs their Detection Factor | `perception` |
| Cybercombat maneuvers | Position, parry, evade (a Complex Action): opposed, the decker's Evasion (+ Hacking Pool; Cloak lowers the TN) vs TN = the opponent's Sensors (IC: rating), the opponent's Sensors (IC: rating; Lock-On lowers the TN) vs TN = the decker's Evasion. Net successes, at most 4: position −TN on the decker's next attack on them; parry +TN on their attacks on the decker; evade breaks contact (frees a black IC hold; that IC can't act on them until it finds them again). Until the end of the next Combat Turn | `maneuvers` |
| Slow | Computer + Hacking Pool vs the IC's rating: each net success, up to the Slow rating, takes 3 off the IC's Initiative this Combat Turn | `utilities.slow` |
| Restore | Restore rating + Hacking Pool vs 4: each success restores a crippled persona point (house rule: then deck damage); it loses 1 rating each use | `utilities.restore` |
| Validate Passcode | Access, Validate utility: the host's detection rolls are then against the decker's Detection Factor + 2. Invalidate Passcode (Control) takes it away | `utilities.validate`, operations |
| Data bombs | On a file or a subsystem, a rating: the first successful operation that touches it (download, edit, decrypt; any operation on the subsystem) sets it off: Matrix damage Power = rating, M, a Resist button; the alert rises to passive; the file is erased and the operation does nothing (a Pavlov bomb leaves the file, re-arms, and the operation goes on). Scan File (Files, Analyze) shows a file's bomb; Analyze Host shows subsystem bombs; Defuse Bomb (Files, Decrypt, TN = the rating) removes one | `bombs`, operations |
| Comcalls | On an LTG only: Make Comcall (Slave) places a call to a number, Tap Comcall (Slave, Spoof) listens in, Reroute Comcall (Control, Relocate) sends it elsewhere. **The subsystems are a guess** | `comcalls`, operations |
| Reality filter | A deck with one: on entering a host, MPCP vs its Security Value: success +1 Matrix Reaction and +1 Hacking Pool there; failure +1 TN on Matrix tests there | `realityFilter` |
| Hitcher jacks | A deck's hitcher jacks seat riders (they see the run); black IC hits reach every rider (each resists on their own track), and dump shock too; they come unplugged when the decker leaves | `hitchers` |
| BTL and sim chips | A gear chip (simsense, BTL, dreamchip, moodchip, personafix) plays through a chipjack, datajack or simrig; BTLs and dreamchips burn out; BTLs, dreamchips and moodchips count as a dose (addiction at the chip's rating, mental) | `chips` |
| Acceleration | In a started combat, the speed changes from where the Combat Turn began by at most the Accel (braking: × 2); further is a push: a driving test at +2, each success another Accel this Combat Turn; a disaster calls for a crash test. Outside combat: free (house rule: limited too) | `VEHICLES_V57.accel` |
| Crash test after damage | Serious or worse damage to a moving vehicle (Rigger 2: any, house rule) calls for a crash test by its driver or autopilot | `crashAfterDamage` |
| Called shots at vehicles | +4 TN (an occupant +6): tires (Handling +1 until repaired, a crash test at +2), sensors (Sensor −2), a weapon mount (that weapon jammed), engine (Speed × 0.5), an occupant (the damage is theirs, the vehicle's Armor counts as extra armor) | `calledShots` |
| Maneuver scores | House rule (Rigger 2 style, off by default): a chase turn's score = positioning successes + current speed ÷ 20 (at most 4); the higher wins the position: −1 TN per net (at most 3) for its mounted fire on the other this Combat Turn, + the same the other way | `maneuver` |
| A manual driver's evasion | A driver at the wheel (not jumped in): a driving test (the vehicle skill + Combat Pool dice) vs Handling + the driving modifiers; successes count as dodge successes. House rule: Combat Pool only, or none | `evasion` |
| Sensor-enhanced gunnery | Flat −2 with a lock (as before) by default; house rule: the target's Signature replaces the range TN, and Gunnery dice are capped at the Sensor rating. **Check the book** | `sensorGunnery` |
| Vehicle design | A chassis (Body, Handling, Speed, Accel, Armor, Signature, CF, design points, price), a powerplant (Speed and Accel ×, price) and design points spent on stats (each with a nuyen price); Armor at most Body × 1. **The rows are examples, not book data: enter your own** | `design` |
| Maglock types | Keypad +0, card +0, print +2, retina +3, voice +2 to bypass. A casing (a rating) is opened first with Electronics B/R vs it; then the circuit | `SECURITY_V57.lockTypes`, `casingSkill` |
| Bypass tools | A sequencer (keypads) or passkey (card locks) rolls its rating instead of the skill when higher; a maglock or electronics kit takes its rating off the TN (at most 2); no tools at all +2 | `tools`, `maxTnOff`, `noToolsTn` |
| Light at the lock | Light at the bypasser's token, by their vision, at half the visibility modifier (rounded up) | `light` |
| Sensor tests | A jumped-in rigger's sensor test is posted on the rigger's card (their Karma Pool re-rolls it); the lock stays on the vehicle | (fix) |
| Not modelled | Otaku submerging, echoes and fading; program options with combat effects; turret traverse by Combat Phase; cargo shape; guards on patrol routes; tamper alarms on Matrix tampering (all left to the GM: see `docs/REVIEW-v0.58.md` section 4, "Left to the GM") | |

## Characters, gear and integration (v0.58.0), from memory and house rules

From the review after v0.53.0. Values in `RULES.CHARACTERS_V58` and `RULES.GEAR_V58` (house rules: "Characters", "Gear", "Tokens"); rules in `src/module/rules/everyday.ts` (characters) and `src/module/rules/outfit.ts` (gear). **All from memory of SR2, the Shadowrun Companion and Shadowtech; the least certain are the obviousness table, the training days, the contact prices, the Karma award rows, the recognition TN, the bone lacing numbers, the surveillance TNs and the legality categories and fines (SR2 core may have no legality codes at all).**

| Rule | Current implementation | Where |
|---|---|---|
| Plain Perception | "Notice" on the sheet: Intelligence (+ adept enhanced perception) vs 4, nobody opposing. Obviousness: obvious −2, normal 0, inconspicuous +2, hidden +4, very well hidden +6, plus the street table (distracted, noisy…). By sight: light, smoke and weather where the observer stands (or at a targeted token, with walls and distance); by hearing: none of those. 1 success the general picture, 2 the details that matter, 3 everything | `notice` |
| Vehicle skills | A skill's linked attribute can be Reaction (Car, Bike, Hovercraft, Motorboat, Ship, Submarine, aircraft…): defaulting rolls Reaction at +4, and the Karma band uses natural Reaction ((Quickness + Intelligence) ÷ 2 before augmentation). The importer and the NPC generator link vehicle skills to Reaction | `SkillDataModel.attribute`, `skillAttributeRating` |
| Time ÷ successes | Any skill test (and Notice) can carry a base time: the card shows base ÷ successes, rounded up to a tenth; no successes, not done | `time` |
| Build/Repair tools | No tools, kit, shop, facility. The job needs a level (the roll dialog of a B/R skill); each level short +2 TN; no tools at all +4 (house rule: can't). Tools are gear with a level, for one B/R skill or any; the best owned is pre-picked | `tools` |
| Repairing gear | A broken weapon or piece of gear (the "Broken" box) can't be used (weapons refuse to attack; broken vision gear, tools and surveillance gear give nothing). Repair: the weapon's skill + " B/R" (else Electronics B/R; defaulting to Intelligence) vs 4, needs a kit, 2 hours ÷ successes; a success marks it working | `tools.gearRepair` |
| Creation costs | 2 Level 1 contacts are free (a dearer contact in a free slot pays the difference); others cost ¥5,000 (level 1), ¥10,000 (level 2), ¥200,000 (level 3). The lifestyle's first month is paid from Resources. Both count in the build check's Resources row and in "Fill the sheet" | `creation` |
| Languages | A native language (ticked on the skill) is free at creation up to Intelligence. Read/Write rolls half the rating (rounded up; house rule: the same). The roll dialog's complexity sets the TN: simple 3, everyday 4, detailed 6, complex 8. 1 success the gist, 2 most of it, 3 all | `languages` |
| Training time | On by default since v0.65.0 (`training.mode: 'timed'`): raising a skill or attribute spends the Karma at once and the rating rises after new rating × days (active and B/R skills 7, knowledge and language 3, specialization 3, concentration 5, attributes 14). An instructor's Instruction vs 4 (the instructor's test: their Karma Pool re-rolls it) divides the untaught time by successes (their own rating must reach the new one; a second instructor test replaces the first, it doesn't stack). Training whose rating was reached another way gives its Karma back. Giving it up gives the Karma back | `training` |
| Negotiating pay | "Pay" on the sheet: an opposed Negotiation test with Mr. Johnson (a social test); each net success moves the fee 10%, at most 50% either way, rounded to ¥10. A GM's TN change re-prices it | `negotiation` |
| Karma awards | The award dialog's breakdown: team (survived 1, objectives 1–3, threat 1–3) for everyone ticked; individual (roleplaying, courage, ideas, humor, character development, 1 each) per character. The reason lists the rows | `karmaAward` |
| Notoriety and recognition | Notoriety comes off Street Cred (house rule). "Recognised?" (GM): each picked observer rolls Intelligence vs 10 − Public Awareness (at least 2), whispered to the GM | `notoriety`, `recognition` |
| Essence holes | Cyberware leaving the body (deleted, or unticked as installed) leaves its Essence as a hole; new ware fills the hole first. Editing an item's Essence cost, grade or housing is a correction and changes no hole; a cyberlimb coming out makes the ware housed in it cost Essence (filling the limb's hole). Essence = base − installed ware − hole. The hole is on the sheet (set it by hand to fix a mistake). An undo puts it back step by step | `GEAR_V58.essenceHoles` |
| Filtration | Cyberware kind "filtration": air (inhalation, smoke too), blood (injection, contact), ingested (ingestion) add their rating in dice to resisting toxins and drugs of those vectors; the best of a kind | `filtration` |
| Bone lacing | Plastic +1, aluminum +2, titanium +3 dice to Body for damage resistance only (not drain, toxins or anything else); the same to unarmed Power; 5, 10, 15 kg carried. The best lacing counts | `boneLacing` |
| Surveillance | Bugs and line taps (planted on someone), laser and shotgun microphones (at the targeted token): their rating vs 4 + the strongest white-noise generator switched on where they listen; 1 success snatches, 2 most of it, 3 every word. A comm jammer there at least as strong as a bug or tap leaves only static (microphones aren't jammed). A bug scanner rolls its rating vs each bug's rating; the GM (or the bug's owner) takes a found one off | `surveillance` |
| Vision gear | Worn goggles, glasses, binoculars and visors give low-light, thermographic, flare compensation and magnification (at most 3) like cybereyes, and token vision follows them | `optics` |
| Legality | Legal, needs a permit (¥1,000 fine), restricted (¥5,000), forbidden (¥25,000); a held permit covers the first two. The Gear tab lists unlicensed gear and fines; search cards note what was found. House rule: fines × rating. **SR2 core may have no legality codes: check the book (and the Street Samurai Catalog)** | `legality` |
| Invisible and astral tokens | The active GM gives an actor Foundry's invisible status while an Invisibility or Improved Invisibility spell is on them, or while they project (house rule: a projecting magician's token is the astral form), and takes it off when it ends (never one the GM set by hand). Astral perceivers (and projectors) get Foundry's see-invisibility detection mode | `visibility` |
| Not modelled | Contacts bought after creation (leftover cash: v0.61.0), repair of armor and cyberware through this path (they have their own), bug transmission range, comcalls through a jammer (Matrix comcalls aren't jammed), a projecting magician's empty body as its own token, legality codes in the SR3 style |

## Foundry integration (v0.59.0), from memory and house rules

From the re-check after v0.58.0 (`docs/REVIEW-v0.58.md` section 1). Most of this is how the system drives Foundry, not book rules. The book values are marked.

| Rule | Current implementation | Where |
|---|---|---|
| Combat Turn length | 3 seconds of world time (`CONFIG.time.roundTime`); a new Combat Turn moves the clock, Previous Round moves it back | `COMBAT_TURN_SECONDS` |
| Ending a pass | A player's client asks the active GM's client to end the pass (the system socket); refused when the round, turn or pass has moved on or the player doesn't own the acting combatant. With no GM logged in, the player is told so | `applications/socket.ts` |
| Next Round / Previous Turn / Previous Round | Next Round runs a new Combat Turn (re-roll, pools, pass 0, the timers once). Previous Turn at the start of a pass goes back to the last turn of the pass before (+10 to every score). Previous Round goes back to the last pass of the Combat Turn before, with its scores as they were; only one Combat Turn back (older scores were re-rolled). What the timers did is not undone | `SR2Combat` |
| Apply (GM) cards | Applied by the active GM's client as soon as a player's card arrives (setting "Apply players' GM-only changes by themselves") | `autoApplyGm` |
| Dropped items | Arrive not installed (cyberware), not bonded (foci), not loaded (programs), not worn (armor); a GM holding Shift drops them as they are. Weapons, armor, gear, cyberware, foci and decks move between actors (Alt copies); skills, spells, powers and programs copy | `applications/drops.ts` |
| Items per actor type | Characters and NPCs: all. Spirits: skills, weapons, armor, gear, spells, powers, foci. Vehicles: weapons, gear, programs. Hosts, IC, barriers, sites, safehouses: none | `ITEM_TYPES_FOR` |
| Going down | Unconscious or dying: a decker is dumped from the Matrix (dump shock), a driver lets go (autopilot), a jumped-in rigger is dumped out (the rigger's dump shock, `RIGGING.dumpShock`). Dead (or a disrupted spirit): just out, no shock. **Check the book** for dump shock on an unconscious decker | `CONDITIONS.dumpWhenDown` |
| Stun against vehicles | Does nothing (a crash still hurts) | `vehicleIncomingDamage` |
| Vehicle initiative | Driven by hand: the driver's Reaction and initiative dice (with the driver's wounds). A vehicle driven by hand or by a jumped-in rigger who is in the combat takes no turns of its own (the driver's actions drive and fire it) | `drivenByCombatant` |
| Spirits | Disrupted (gone, defeated in combat, can't be stabilised) when either track is full (house rule: Physical only); the GM decides when it can be called again. **Check the book** | `SPIRITS_V59.disruptOn` |
| Killing hands | A magical attack: gets past immunity to normal weapons. **Check the book** | `ADEPT.killingHands.magical` |
| Action costs | Jacking in, jacking out, taking the controls, jumping in, jumping out, a sensor test and a command to subscribed drones: a Simple Action each. **Check the book** (jacking in/out and drone commands may be free or Complex in SR2) | `ACTIONS.costs` |
| Token statuses | Foundry's list cut to the statuses the system uses (house rule: all of Foundry's); SR2 states shown by themselves: full defense, delaying, surprised, on fire (Burning), morale broken (Fear), jacked in, jumped in. A GM's own Fear or Burning is left alone | `TOKENS.statusList`, `stateIcons` |
| Paralysis, sleep, deaf | Paralysed or asleep: no actions. Deaf: +8 TN to Perception by ear (a hearing Notice, or noticing someone unseen). **Check the book** for the deaf modifier. Hearing gear and cyberears: v0.61.0 | `STATUSES.paralysis`, `STATUSES.deaf` |
| Drag ruler | Green up to the walking rate, yellow up to the running rate, red beyond (the whole drag, metres) | `TOKENS.ruler` |
| Not modelled | Templates other than circles, ruler colours for vehicles, undoing what the timers did when going back a turn |


## Rules gaps (v0.61.0), from memory and house rules

From the re-check after v0.58.0 (`docs/REVIEW-v0.58.md` section 2). Every number here is from memory; the values live in `src/module/rules/config61/*.ts` (`RULES.HEALTH_V61`, `MAGIC_V61`, `COMBAT_V61`, `STREET_V61`, `SECURITY_V61`) and most can be changed in the house rules.

| Rule | Current implementation | Where |
|---|---|---|
| DocWagon | Basic ¥5,000 a year (10 min, no High Threat Response, resuscitation ¥8,000), Gold ¥25,000 (10 min, HTR ¥5,000, 1 free resuscitation a year), Platinum ¥50,000 (5 min, HTR included, 4 free). The biomonitor calls when the wearer becomes dying (or dead); the GM says when the team arrives (stabilised, resuscitation noted, bill paid from nuyen). A dead employee costs ¥20,000. **Only the yearly fees are fairly sure** | `HEALTH_V61.docwagon` |
| Toxin onset | A toxin's Speed delays it: Resist waits until then (the GM may go ahead), and the active GM announces it when the time comes. In combat, 3 s per Combat Turn | `HEALTH_V61.onset` |
| Drug effects | Besides attributes, a drug can add armor, change TNs (own tests, being noticed, being attacked), multiply movement, ignore wound modifiers or ignore Stun boxes (v0.70.0: tests now use the same wound modifier and the drug's own-test TN.) | `HEALTH_V61.drugs` |
| Fire and drug immunity | Immunity to fire stops flamethrower and fire elemental spell damage; immunity to poisons also covers drugs | `HEALTH_V61.immunity` |
| Seeing through invisibility | Each observer resists each Invisibility spell once: Intelligence vs its Force; more successes than the caster's see through it. Astral perceivers see through both kinds (house rule: not Improved Invisibility). Foundry's token vision isn't changed by seeing through | `MAGIC_V61.invisibility` |
| Spirit initiative | Nature spirits and elementals: Reaction +10 (no extra dice); others 0. A spirit's own Adjustments replace this. An unmaterialized spirit: +20 more (astral). **Low confidence** | `MAGIC_V61.spiritInitiative` |
| Totem drawbacks | Bear and Shark: a Willpower (4) test against going berserk when wounded; Wolf: also when a fight starts; berserk for 3 − successes Combat Turns (not yet: see REVIEW-v0.69 R13). Owl: +2 TN on every test by daylight (sunrise to sunset). The totem's own fields override the name | `MAGIC_V61.totems` |
| Hold powers | Paralysis: no actions for net successes Combat Turns. Petrification: turned to stone (no actions) while sustained. Binding: held; Strength vs the power's rating to break free (not yet: see REVIEW-v0.69 R13) | `MAGIC_V61.holdPowers` |
| Increase [Attribute] vs cyberware | House rule, off: the spell adds nothing to an attribute cyber- or bioware raises. **Check the book** | `MAGIC_V61.attributeSpells` |
| Magical links | Astral tracking along a sustained spell, a bound spirit or an active focus to the magician: TN 4, base 1 hour ÷ successes, no fading | `MAGIC_V61.links` |
| Exclusive spells | While one is sustained, no other spellcasting (and no new exclusive spell while sustaining another). House rule: no other tests at all | `MAGIC_V61.exclusive` |
| Bound spirits when the master dies | They go free (house rule: depart, or stay) | `MAGIC_V61.masterDies` |
| Insect spirits | Summoned into a targeted body (flesh form: the host's physical attributes + half the Force); without one, its true form. **Low confidence** | `MAGIC_V61.insect` |
| Skill gear | Gear and cyberware can give dice or a TN change to a named skill (or its concentration or specialization); the best counts (house rule: they add up) | `COMBAT_V61.skillGear` |
| Hearing | Cyberear amplification: −1 TN per point (up to 3) to hearing tests; adept improved hearing −1; a damper stops being deafened; high/low frequency hear ultra- and infrasound | `COMBAT_V61.hearing` |
| Superior position | House rule, off: −1 TN to the side holding it, +1 to the other. **Check the book** | `COMBAT_V61.superiorPosition` |
| Grenade launchers | Inside 5 m the grenade doesn't arm (house rule: the shot is refused) | `COMBAT_V61.launcher` |
| Stun batons | 10 charges, one per blow; empty, it hits as a club (no stun-weapon armor rule) | `COMBAT_V61.stunBaton` |
| Monofilament whip | All ones on the attack: it hits the wielder with its own damage, once (not again on a re-roll). House rule: any miss (when the defender doesn't counterattack) | `COMBAT_V61.monowhip` |
| Smoke grenades | A 10 m smoke (or thermal smoke) region for 20 Combat Turns | `COMBAT_V61.smoke` |
| Radios | A jammer of at least a radio's rating blocks it; listening in is Electronics vs the encryption (at least TN 4) | `STREET_V61.radio` |
| Fake IDs and licences | A checker rolls its rating vs the fake's rating; any success spots it. A licence covers a legality category (and milder ones) or items by name; a real ID passes | `STREET_V61.identity` |
| Creation | Spell points: 25 at Magic priority A or B (adepts none); can't buy more. Leftover cash: kept (house rule: capped at ¥5,000, or lost). A lifestyle bought outright: 100 months. **Low confidence** | `STREET_V61.creation` |
| Safehouse workshop | Rating 1–2: a shop; 3+: a facility, for any Build/Repair skill of its owners and residents while it's paid up, and not while they are in a fight | `STREET_V61.workshop` |
| Sheaf IC | A step launches its IC once (the step's IC fields, else read from the event text, e.g. "Killer-6 IC"); again after the tally is reset. Gray/black categories by kind are a guess | `SECURITY_V61.sheafIc` |
| Gas devices | On lockdown a gas device releases its toxin (default: knockout gas 6S Stun, inhaled, after 1 Combat Turn) on everyone in the regions it watches and within its radius | `SECURITY_V61.gas` |
| NPC generator | Shamans get one of ten animal totems; riggers get vehicles and drones by threat (0–1 vehicles, 0–4 drones), drones subscribed to their remote control deck | `SECURITY_V61.npc` |
| NPC totem table (v0.76.0 note) | The ten totems' bonus dice by spell category and for conjuring, with their environments (`SECURITY_V61.npc.totems` in `src/module/rules/config61/security.ts`), used by the NPC generator and the stat-block import. Written from memory: check each totem against the book's totem list | `SECURITY_V61.npc.totems` |
| Not modelled | The berserk character's forced actions (the GM rules them), observers seeing an invisible token on the map after seeing through, radio range, decryption time, DocWagon response by area, the HTR team as tokens |

## Common rules holes (v0.71.0), from memory and house rules

Every row is a switch in `RULES.FIXES_V71` (`rules/config71.ts`) with the old behaviour one click away.

| Rule | What the system does | Where |
|---|---|---|
| Specializations at creation | A specialization or concentration is paid for by lowering the general skill: each point it rises above the paid rating lowers the skill by `ratio` (1). With both, the higher sets the cost; the skill can't fall below 1 | `FIXES_V71.specialization`, `paidSkillRating` |
| Starting foci | A magician's foci bonded in creation take their bonding Karma from the starting spell points, one point per Karma (`ENCHANTING.focusKarma` as the bonding cost); adepts' and mundanes' foci arrive unbonded | `FIXES_V71.creationFoci` |
| A jumped-in rigger's dodge | A driving test (vehicle skill, the rig's help) against Handling, plus Control Pool dice, like a manual driver with Combat Pool | `FIXES_V71.riggerDodge` |
| MPCP limits | Programs and Bod, Evasion, Masking, Sensors run no higher than the working (damaged) MPCP; frames carry their own rating | `FIXES_V71.mpcpCaps` |
| Active memory | Loading a program that doesn't fit is refused | `FIXES_V71.activeMemory` |
| Generated sheaves | Trigger steps every 1d3 + 4/3/2/1 tally points (blue/green/orange/red); IC by code and alert (white only on blue; black only after an alert); the passive alert by the 4th step, active at most 3 later; orange and red end in shutdown | `rules/sheafgen.ts SHEAF_GEN` |
| Astral switch | Perceiving astrally a Simple Action, projecting a Complex Action; back to the body free | `ACTIONS.costs.astralPerceive/astralProject` |
| Firing twice | Only semi-automatic weapons fire twice in a phase | `FIXES_V71.fireTwice` |
| Rigger adaptation | Needed to jump in (drones are built for it) | `RIGGING.needsAdaptation` |
| Vehicle repair | Needs a shop (less adds the B/R tools TN); each success fixes a shot-out part (tires, engine, sensors) before boxes; a destroyed vehicle is rebuilt whole on any success at 2 × the hours | `FIXES_V71.vehicleRepair` |
| Elemental drain | A timed summoning's drain comes when it ends (or is given up) | `FIXES_V71.conjureDrainAtEnd` |
| Not modelled | A player's roll for a GM-owned observer's invisibility resistance is kept in memory only; invisibility stops spells only with line of sight 'block' | |

## Occasional and rare items, part 1 (v0.72.0), from memory and house rules

Every row is a switch in `RULES.COMBAT_V72`, `RULES.HEALTH_V72` or `RULES.MAGIC_V72` (`rules/config72/*.ts`) with the old behaviour one click away. **Low confidence on most numbers**; some rules may be SR3 read back into SR2.

| Rule | What the system does | Where |
|---|---|---|
| Walls against blasts | A wall with an SR2 barrier rating holds when the Power reaching it is at most the rating (× `holdMultiplier` 1, some remember ×2); otherwise the blast goes through and loses the rating. A wall with no rating set still stops it completely | `COMBAT_V72.blastBarriers` |
| Take Aim | Lasts into the next Combat Turn while the aimer does nothing else; the cap (half the skill) uses the rating rolled (a specialization) | `COMBAT_V72.aim` |
| Immunity to normal weapons | An attack whose Power doesn't exceed the immunity (2 × Essence, or the spirit's armor) does nothing. **May be SR3's hardened armor** | `COMBAT_V72.immunity` |
| Called shot at a gap | Bypasses worn armor only; dermal plating, orthoskin, adept and limb armor still count | `COMBAT_V72.calledShotGap.bypasses` |
| Smoke in melee | Counts as at range (attacker and defender) | `COMBAT_V72.meleeSmoke` |
| Extra rounds | Stick-n-Shock (Power −2, set to S Stun, half impact armor) and AV rounds (anti-vehicle). **Numbers from memory, may be SR3 Cannon Companion** | `COMBAT_V72.ammo.extra` |
| Indirect fire | A spotter's link sets the TN (voice +2, datalink +1, designator +0; none: blind fire, or not allowed); −1 per earlier shot at the same spot (to −3); scatter +1 die × 2, −1 m per spotter success. **All placeholders** | `COMBAT_V72.indirect` |
| Drug doses | Another dose while a drug is in effect renews it (no second bonus) and is an overdose: a toxin of the drug's Power +1 per dose in effect. **No SR2 core rule recalled** | `HEALTH_V72.drugs` |
| Shadowtech bioware | Symbiotes +1 die per rating on natural healing; nephritic screen +1 die per rating against injected and ingested toxins; extended volume +10 Combat Turns per rating of held breath; suprathyroid +1 Body, Quickness, Strength and Reaction. **All uncertain** | `HEALTH_V72.bioware` |
| Reflex systems | Reaction enhancers don't work with boosted reflexes (wired are fine) | `HEALTH_V72.reflexes.incompatible` |
| Health edges and flaws | Will to Live +1 Overflow box per level; High Pain Tolerance ignores 1 box per level for wound modifiers; Low Pain Tolerance counts 1 box more; Toughness +1 die to resist damage; Sensitive System doubles cyberware Essence and calls for bioware rejection tests within the Body Index. **Companion values, SR3 remembered better** | `HEALTH_V72.qualities` |
| Heat and electricity | Heat like cold (Body vs a severity TN, Stun); electric shock by source (half impact armor plus insulation), then the elemental shock test. **House numbers** | `HEALTH_V72.hazards` |
| Master's death | Nature spirits, watchers and toxic spirits leave; allies and elementals go free; insect spirits stay | `MAGIC_V72.masterDies` |
| Adepts in astral combat | Unarmed Combat (or a better martial art), defaulting to Quickness, with the Combat Pool; killing hands sets the damage level | `MAGIC_V72.adeptAstral` |
| Metamagic limits | Adepts learn only centering and masking; aspected sorcerers can't learn invoking or possessing; aspected conjurers can't learn quickening, dispelling, shielding, reflecting or anchoring | `MAGIC_V72.metamagicLimits` |
| Dispelling drain | Spell Pool dice can go to it | `MAGIC_V72.dispelDrainPool` |
| Barrier spells | Mana Barrier and Physical Barrier raise a barrier of the spell's Force (or successes), the caster's Magic in metres, that falls when the spell is dropped; a physical barrier stops bodies and gunfire, not spells or astral forms | `MAGIC_V72.barrierSpells` |
| Innate spells | A spirit without Sorcery casts with its Force (an ally optionally Intelligence); a critter casts a spell marked innate with Magic, else Essence; they take drain | `MAGIC_V72.innateSpells` |
| Wards on the map | Also stop dual-natured critters and materialized spirits (not an astrally perceiving magician's body unless set) | `MAGIC_V72.wardPresence` |
| Projecting wounds | Count on the astral form's tests and Initiative | `MAGIC_V72.astralWounds` |
| Anchoring | Costs Good Karma = Force (like quickening) | `MAGIC_V72.anchoring` |
| Allies | Taught spells cost 1 Good Karma per Force; abilities (sense link, astral gateway) have a Karma price; the sense link is a status only | `MAGIC_V72.ally` |
| Not modelled | Mortar flight time; a physical barrier broken from the physical side (the GM lowers its rating); the sense link moving perception to the ally's token; Bio-Rejection and Allergy edges | |

## Occasional and rare items, part 2 (v0.73.0), from memory and house rules

Every row is a switch in `RULES.NETRIG_V73`, `RULES.DRONES_V73`, `RULES.CHARACTERS_V73` or `RULES.CROSSCUT_V73` (`rules/config73/*.ts`) with the old behaviour one click away. The bookkeeping rows (O39–O43) are not book rules. **Low confidence on most numbers in the first three blocks.**

| Rule | What the system does | Where |
|---|---|---|
| Logging off while held | Graceful Logoff is refused while black IC holds the decker (break free or be dumped); the GM can still log them off | `NETRIG_V73.logoffHold` |
| Persona damage and initiative | The Matrix monitor's wound modifier lowers Matrix initiative too (added to the body wounds, or the worse of the two). **VR2 may not do this at all** | `NETRIG_V73.personaInitiative` |
| Known hosts | Players' log-on, Move and agent-search lists show only hosts their character has located; the code and Security Value only after Analyze. Grids always located | `NETRIG_V73.knownHosts` |
| Ramming | The rammer's damage button comes after the target defends; the rammer's passengers take a share | `NETRIG_V73.ram` |
| Control rig | Its TN bonus also on gunnery and the Control-Pool dodge. **The bonus itself is low-confidence** | `NETRIG_V73.controlRig` |
| Sensor locks | Lapse after N Combat Turns (or world time), out of range (Sensor × metres), off the scene, or with the sensors shot out. **Numbers mine** | `NETRIG_V73.sensorLocks` |
| Drone links | Intercept (radio rule TN, + encryption, + ECCM) then spoof (deck rating or Pilot); spoofing takes over or sends one false command. **Skill and TNs least certain (Rigger 2 as remembered)** | `DRONES_V73.link` |
| Mount points | Firmpoints and hardpoints per vehicle (or from Body); anti-vehicle, guided and named weapons need a hardpoint; block, warn or off | `DRONES_V73.mounts` |
| Missiles | A guided missile uses the target's Signature instead of range; ECM over ECCM adds; optionally needs a sensor lock or flies unguided | `DRONES_V73.missiles` |
| Skill dialog memory | The complementary skill isn't remembered | `CHARACTERS_V73.rollMemory` |
| Negotiating pay | Uses `CHARACTERS_V58.negotiation.opposedAttribute`. **Which attribute SR2 uses: check** | `CHARACTERS_V73.negotiation` |
| Lifestyle bought outright | Owned for good; can be bought later at the creation price (paid months credited) | `CHARACTERS_V73.lifestyle` |
| Training a new skill | Keeps the specialization typed in the picker (rating 0 until trained) | `CHARACTERS_V73.training` |
| Skill Karma bands | Picker and Spend Karma read the same attribute (natural Reaction). **Natural is my reading** | `CHARACTERS_V73.skillCost` |
| Racial floor | Racial modifiers can't take an attribute below 1; build check and sheet warning | `CHARACTERS_V73.racialFloor` |
| NPC ratings | Threat Rating by Threat Level; Professional Rating 1–4; no Karma Pool for grunts; hand-made NPCs start at Karma Pool 0. **SR2 Gamemastering pairs: check** | `CHARACTERS_V73.npcs` |
| Metatypes | No fixed list in the schema, so house-rule metatypes validate | `CHARACTERS_V73.metatypes` |
| Skill names | One name per vehicle skill; old aliases still match | `CHARACTERS_V73.skillNames` |
| Edges and flaws | Exceptional Attribute raises the racial maximum; surplus flaw points (off by default) buy attribute or skill points or nuyen; Karma above the racial maximum (off by default, **probably SR3**) | `CHARACTERS_V73.qualities` |
| Undo | Region documents are logged; areas that time out on the real-time backstop leave no step | `CROSSCUT_V73.undo` |
| Change target number | Perception cards get Perception rows; hearing, observer, superior-position and prejudice rows | `CROSSCUT_V73.retarget` |
| Statuses | Morale "broken" ends with the combat; a timed hold's power entry goes when it runs out | `CROSSCUT_V73.statuses` |
| Advancement log | Nuyen refunds logged; finished training one line credited to its starter; GM-approved projects credited to the player | `CROSSCUT_V73.advancement` |
| Vehicle mod installs | Paid up front, refunded on Give up or a failed re-roll | `CROSSCUT_V73.modInstall` |
| Not modelled | The spoofed drone's false command (the GM plays it); electronic warfare by players without the GM | |

## The shop (v0.91.0), from memory and the owner's decisions

Switches in `RULES.SHOP_V91` (`rules/config91.ts`); the first choice is the new way, the other the old one.

| Rule | What the system does | Where |
|---|---|---|
| Finding before buying | Out of creation a player character buys from the Add window (the shop) or an item sheet's Buy by finding it first: the usual Availability test (Etiquette, else Charisma; lifestyle, Street Cred, Karma Pool), then Buy or Haggle on the card; it arrives after the Availability time ÷ successes. The owner's decision (25 Oct 2026), not a book rule; the GM, NPCs and the creation wizard buy at once | `SHOP_V91.buying` |
| Trying again after a failed find | A character who fails to find an item may try again only once its **base** Availability time has passed (world time); the GM is never held back. **From memory: check the Core Rules' Availability text** (and whether the wait is the base time or something else) | `SHOP_V91.retry` |
| What players see | A world setting (`shopList`): everything, the GM's catalogue and kits, or what the GM marks "in the shop"; Forbidden items hidden unless the GM allows them (`shopForbidden`). Table convenience, not a book rule | settings |

## Legality and permits in the shop (v0.91.5), from memory and the owner's decisions

Switches in `RULES.SHOP_V915` (`rules/config91.ts`); the first choice is the new way, the other the old one. The owner's decision (26 Oct 2026): a restricted item can be found openly, only harder; contacts and fixers come in v0.91.6. **Every number here is a placeholder from memory: check the Core Rules (and Street Samurai Catalog / Fields of Fire) for how legality and permits work in SR2.**

| Rule | What the system does | Where |
|---|---|---|
| Finding by legality | Found openly, the Availability TN goes up by legality: Needs a permit +0, Restricted **+2**, Forbidden **+4** (only on sale when the GM allows Forbidden items); the find time is × 1, × **1**, × **2**. A house choice standing in for the book's legality codes | `SHOP_V915.findByLegality`, `.findTn`, `.findTime` |
| Getting a permit | **Get a permit…** on an item (or an owned vehicle) that needs a permit or is Restricted: costs **10% of its cost, at least ¥100** (Restricted **25%, at least ¥500**) and comes through after **7 days** (Restricted **30**), with the GM's waiting rules; the approval queue holds it for the GM. The Permit box is then the GM's to tick. **From memory** | `SHOP_V915.permits`, `.permitCost`, `.permitDays` |
| The fines | Unchanged from v0.58.0: Needs a permit ¥1,000, Restricted ¥5,000, Forbidden ¥25,000 (shown as warnings on find cards, shop rows and item sheets) | `GEAR_V58.legality` |

## Finding through contacts and fixers (v0.91.6), from memory and the owner's decisions

Switches in `RULES.SHOP_V916` (`rules/config91.ts`); the first choice is the new way, the other the old one. The owner's decisions (26 Oct and 2 Nov 2026): a restricted item can be found without a contact, only harder; a contact helps the way legwork does; a fixer does both (adds dice, or finds it for a fee and more time, the player's choice); the fixer is a tick on the contact. **Every number here is a placeholder: check the Core Rules (Availability, contacts, fixers) and Street Samurai Catalog.**

| Rule | What the system does | Where |
|---|---|---|
| A contact's help | On the character's own find: a buddy **+1** die, a friend for life **+2** (the legwork table; under the old legwork rule −1 TN per level above 1 instead), paid dice (¥100 each, at most their Loyalty), a favour **+2** dice and no fee, the contact's own dice roll too (the better result counts); the contact's fee is paid when asking. A house choice: the book may not let contacts help Availability tests this way | `SHOP_V916.through`, `STREET.contacts`, `BOOK_V78.legwork.levelDice` |
| Legality through a contact | The "found openly" TN row × **0.5** (rounded down: Restricted +1, Forbidden +2); the Forbidden time ×2 stays | `SHOP_V916.contactLegalShare` |
| A fixer's own find | The fixer rolls their own dice (or **2** per contact level) against the Availability TN; legality doesn't count (× **0**); the price has the fixer's **10%** cut on top (a favour waives it); the time is **×1.5**; no Haggle | `SHOP_V916.fixerLegalShare`, `.fixerFee`, `.fixerTime`, `.fixerDicePerLevel` |

## Spell formulas and teachers (v0.91.8), from memory and the owner's decisions

Switches in `RULES.FORMULA_V918` (`rules/config91.ts`); the first choice is the new way, the other the old one. The owner's decisions (11 Nov 2026): a formula is a kind of gear (found and bought like gear); out of creation learning needs a formula, a teacher, the group's grimoire or the magician's own design; a teacher's Instruction test helps the student's own learning test, and NPC teachers charge; the other tradition's formula is allowed but harder. **Every number here is a placeholder: check the Core Rules (learning spells, spell formulas) and the Grimoire.**

| Rule | What the system does | Where |
|---|---|---|
| A formula is needed | Out of creation a player character learns a new spell only from a formula they hold (Force ≥ the Force learned), a teacher, the group's grimoire or their own design; raising a Force needs one of the new Force. NPCs and characters in creation need none | `FORMULA_V918.required`, `.raise` |
| A formula's price | Force × **¥500**, ×**2** for a combat spell | `FORMULA_V918.nuyenPerForce`, `.combatFactor` |
| A formula's Availability | TN = Force (at least 2) / **7 days**; Street Index **1**; no legality | `FORMULA_V918.tnPerForce`, `.availDays`, `.streetIndex` |
| The other tradition | A shamanic formula or teacher for a hermetic magician (or the reverse): learning TN **+2**, study time **×2** | `FORMULA_V918.foreign`, `.foreignTn`, `.foreignTime` |
| A teacher | Knows the spell at the Force or more; rolls Instruction (Charisma default) against TN **4** (the training rule's); the successes, up to the teacher's Sorcery, are extra dice for the student's learning test; a teacher no player plays charges Force × **¥100** | `FORMULA_V918.teacher`, `.feePerForce`, `CHARACTERS_V58.training.instructionSkill`, `.instructionTn` |

## The layered Magic Pool (v0.92.0), the owner's decisions

Switches in `RULES.MAGIC_V920` (`rules/config92.ts`); the first choice is the new way. An interpretation of SR2 Core pp. 70, 84–85 and Awakenings p. 95, with the Companion's split Karma Pools as precedent; listed in the Rules interpretations window.

| Rule | What the system does | Where |
|---|---|---|
| The pool in layers | Sorcery's rating for any magical action; the concentration's extra dice (its rating − Sorcery's) only inside it; the specialization's (its rating − the concentration's, or Sorcery's) only inside that; narrow dice spent first; the Magic cap per test holds | `MAGIC_V920.poolLayers` |
| Casting inside a narrow use | A casting or dispelling test rolls the concentration's or specialization's rating, matched by name (a spell category, the spell's name, or Spellcasting / Spell Defense / Dispelling / Ritual) | `MAGIC_V920.castNarrow` |
| Drain | The narrow dice left may pay for that casting's Drain | `MAGIC_V920.drainNarrow` |
