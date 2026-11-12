### Damage, health and hazards

Switches in `RULES.HEALTH_V923` (`rules/config923/health.ts`, helpers in `rules/health923.ts`); the first choice is the book's way (the default), the other puts the v0.92.2 behaviour back. Where the Unified Rules Revamp already had the same rule as a switch (`URR_V80.hs…`, `magLossLe`), the Revamp's switch still decides under the Revamp source; the `HEALTH_V923` switch gives the Book Rules the book's way.

| Rule | Was | Now (book) | Source | Switch |
| --- | --- | --- | --- | --- |
| Stun overflow | 2 Stun boxes to a Physical box | box for box | Core p. 111 | `STUN_OVERFLOW_PER_PHYSICAL_BOX` 2 → 1 |
| Death | dead when the Overflow reaches the total (augmented) Body | dead only when the Overflow is more than the natural Body (Will to Live still adds boxes); the sheet's Overflow row follows | Core p. 111 | `HEALTH_V923.death` 'natural' / 'total' |
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
