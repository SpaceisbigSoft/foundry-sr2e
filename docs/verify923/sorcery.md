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
| Treat TN | 10 − Essence (as Heal) | 8 − Essence | Core p. 155 | `SORCERY_V923.treatTn` (8; 0 = old) |
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
| Magic loss test | lost on 2D6 < Magic | lost on 2D6 ≤ Magic | Core p. 115; Awakenings p. 99 | `SORCERY_V923.magicLoss` |
| Elemental aid | + full Force every cast, a service each time | an auxiliary pool of Force dice: each die used lowers what is left; one service when it starts; at 0 it vanishes | Core p. 141 | `SORCERY_V923.elementalAid` |
| Detection spell range | Magic × Force metres | a separate Force test vs 4 (+ injury): successes × Magic metres | Core p. 128 | `SORCERY_V923.detectionRange` |
| Increase Reflexes and cyber | the better of spell and ware counts | no effect on anyone with cybernetic initiative dice | Core p. 155 | `SORCERY_V923.increaseReflexes` |

Kept (the owner's decisions)
- Spellcasting dice: the test rolls the Sorcery skill's (or concentration's / specialization's) rating (`MAGIC_V920`); the book rolls the spell's Force + Magic Pool (Core pp. 128–131).
- The layered Magic Pool (`MAGIC_V920.poolLayers`); the book resizes the whole pool to the rating in use for the action (Awakenings p. 95).
- Spell formulas and teachers (`FORMULA_V918`): the teacher's fee (`feePerForce`; the book: typically 1,000¥ × Force + living expenses, Core p. 132), the teacher's help (successes as dice; the book: Teaching vs Force − the pupil's Intelligence, min 2, successes lower the pupil's TN), the formula price (`nuyenPerForce`, `combatFactor`; the book: L 50 / M 100 / S 500 / D 1,000¥ × Force) and the other tradition's penalty (`foreign`; the book: +2 on translating the formula, Grimoire p. 115). The learning test itself (2 × Force, Magical Theory, +2 with a formula and no teacher) follows the book on top of these.

Not built
- Defaulting magical skills (Awakenings p. 93); circle/lodge +1 TN per 2 rating for spells cast inside another's circle or lodge (needs circles placed on the map); shaping an area by withheld dice, splitting Force over targets, spell stacking (Core pp. 129–130); noticing spellcasting (Core p. 132); elemental secondary effects in full (Grimoire pp. 113–114); the active foci limit (Intelligence); Heal/Treat successes split with time; the Armor spell's ½ successes; a Drain-code table for the importer; an elemental bound to a spell for days (sustaining by Combat Turns is the spirits section's); quickening's sustain test, second Drain and extra Karma; anchoring's Karma and test; masking's success threshold; the ritual's link and sending times; totem dice as Magic Pool dice; a ward ending when its days run out (the card states them); the geas due for every 2 Magic lost; centering for spellcasting or Drain.
