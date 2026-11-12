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
| Dwarf resistance | +2 dice vs disease and toxins | +2 dice vs disease only | Core p. 45 | `CORE_V923.dwarfResistance` |
| Troll running | × 3 | × 2 | Core p. 83 | `METATYPES.types.troll.run` 3 → 2 (the Revamp's patch sets 2 too) |
| Native language | free at Intelligence | free at Intelligence + 2 | Core p. 46 | `CORE_V923.nativeLanguage` |
| Street dialect | none | a Street lifestyle's dialect (City Speak, Tunnel Talk) free at half Intelligence (build check) | Core p. 46 | `CORE_V923.streetDialect` |
| Leftover Resources | kept whole | kept at 10:1 | Core p. 47 | `CORE_V923.leftoverCash`, `.cashRatio` |
| Starting cash | none | + 3D6 × 1,000¥ when the wizard finishes | Core p. 47 | `CORE_V923.startingCash` |
| Starting Karma Pool | 1 for everyone | metahuman 2, human 1 (1 with More Metahumans) | Core p. 47 | `CORE_V923.startPool` |
| Attribute Karma | new rating × 2 | new rating × 1 | Core p. 190 | `UPKEEP.karma.attributeMultiplier` 2 → 1 (the Revamp's patch sets 1.5) |
| Past the natural maximum | refused | with the GM's leave, double Karma, up to the augmented maximum | Core p. 190 | `CORE_V923.aboveMax` (the house rule `karmaAboveRacial`, on under the Revamp, wins) |
| Karma Pool growth | every 10 career Karma (metahumans 20) | 10 to Good Karma, the next point to the pool (every 11th), everyone | Companion p. 76; Core p. 190 | `UPKEEP.karma.poolEvery` human 10 → 11, metahuman 20 → 11 |
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
| Threat Rating | + Combat Pool dice | + dice on every test (attacks, defence, damage resistance, tests through the test path), never spent; no Combat Pool | Core p. 187 | `CORE_V923.threat` |
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
