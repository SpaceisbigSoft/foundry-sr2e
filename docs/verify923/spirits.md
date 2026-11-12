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
| Projection | 2 × Essence hours free, then 1 Essence per hour or part | 1 Essence every full hour from the start | Core pp. 146–147 | `SPIRITS_V923.projection` |
| Projecting initiative | astral Reaction + 20 | astral Reaction + 15 | Core p. 147 | `ASTRAL.initiativeBonus` 20 → 15 |
| Initiates in astral space | nothing | + grade to astral Reaction and to the Astral Combat Pool | Grimoire pp. 38, 91 | `SPIRITS_V923.astralGrade` |
| Astral dice pool | Spell Pool | Astral Combat Pool (I + W + C) ÷ 2 (the Combat Pool's dice while projecting) | Core p. 147 | `SPIRITS_V923.astralPool` |
| A magician's astral damage | (Cha)M, a focus adds dice | unarmed (Cha)L; weapon focus (Cha + rating ÷ 2)M | Core p. 147 | `SPIRITS_V923.astralDamage` |
| A barrier that wins | nothing | (rating)L, +1 level per 2 net successes, astral Body | Core p. 148 | `SPIRITS_V923.barrierBacklash` |
| Reading an aura | 1: health, mood, foci; 2: compare; 3: exact Essence and Magic | basics at a glance; 2: emotions; 4: cyberware; never exact numbers | Core p. 145; Grimoire p. 90 | `SPIRITS_V923.assensing` |
| Astral tracking | 6 h ÷ successes, no Force modifier | 12 h ÷ successes; −2 TN Force ≤ Sorcery, +2 over | Core p. 149 | `TRACKING.baseHours` 6 → 12; `SPIRITS_V923.tracking` |
| Asceticism | any attribute | a Physical attribute | Grimoire p. 40 | `SPIRITS_V923.asceticism` |
| Ally cost | Force × 1 Good Karma | 5 × the current Force per point above 1 + the design's Karma; 1 Magic point (none for the familiar ordeal); Force ÷ successes days; (Force + day)L Stun each day | Grimoire pp. 40, 67–71 | `SPIRITS_V923.allyCost` |
| Regeneration | always heals | a Deadly wound calls for 1D6, a 1 kills (2 from fire or explosions: the GM's call) | Core p. 219 | `SPIRITS_V923.regenDeath` |

**Kept (the owner's decisions):** none in this area. Killing Hands (L/M/S/D at .5/1/2/4) already matches Core p. 126.

**Not built:** an elemental's day of waiting costing a service (Core p. 141); Aid Sorcery as a non-refreshing pool split over tests and spell defense (Core p. 141); an elemental bound to a spell for Force days (Core p. 142); tech melee enhancements doing only base damage against spirits (Awakenings p. 101); spirit against spirit, Force vs Force (Core p. 143); disruption for 28 − Force days (Grimoire p. 64); only a true-name holder banishing a free spirit (Grimoire p. 77); watchers summoned for hours, Force from successes, (Force × hours)L Drain (Grimoire p. 73); the ally design test (Grimoire pp. 70–71); invoking a great form by astral quest (Grimoire p. 64); Unarmed or Armed Combat in place of Sorcery in astral combat (Core p. 147); repeated assensing at +2 TN (Grimoire p. 90); masking by successes (Grimoire p. 46); quickening's sustaining test and second Drain (Grimoire p. 45); reflecting by shielding dice (Awakenings p. 99); cleansing limits and Drain (Awakenings p. 100); meditation's three tests, thesis as a formula, oath, familiar and geas-shedding details (Grimoire pp. 38–41); Distance Strike's double cost with Killing Hands (Awakenings p. 116); adept power costs by band in the importer (Core pp. 125–126); Confusion, Fear, Engulf as opposed tests (Predator and Prey); Essence drain as a feeding process (Core pp. 217–218); critter stat lines.
