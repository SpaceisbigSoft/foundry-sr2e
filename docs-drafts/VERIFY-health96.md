### Damage, health and hazards (v0.96.0)

Switches in `RULES.HEALTH_V96` (`rules/config96/health.ts`, helpers in `rules/health96.ts`, glue in `applications/health96.ts`); the first choice is the book's way (the default), the other puts the v0.95.1 behaviour back.

| Rule | Was | Now (book) | Source | Switch |
| --- | --- | --- | --- | --- |
| Interrupted Stun rest | every rest a fresh test | a rest that stops before the Stun track is clear keeps its first roll (flag `stunRest96`); the next rest re-tests with the current condition but counts at most the first roll's successes; a clear track ends it | Core p. 112 | `HEALTH_V96.stunRestInterrupted` 'book' / 'off' |
| Minimum lifestyle while healing | no check | the Physical rest card warns when the lifestyle (hospital or intensive care = hospitalized) is below the Healing Table's minimum; the modifiers are the GM's | Core p. 113 | `HEALTH_V96.healingLifestyle` 'book' / 'off' |
| Medical costs | hospital 500¥, intensive 1,000¥ a day | also the doctor's fee per day by wound for care "With a medkit and care" (a doctor outside a hospital; VERIFY: the care rows don't name a doctor), and a paramedic's fee card (Pay button) when an NPC gives a player's character first aid | Core p. 113 (Medical Costs Table) | `HEALTH_V96.medicalCosts` 'book' / 'off' |
| Healing spells' time | sustained Force ÷ successes Combat Turns | the spell's Healing Table: 5/10/15/20 turns by the wound ÷ the successes put to time; successes go to boxes first, the rest to time (VERIFY: the book lets the caster split as they like; there is no split choice in the cast dialog yet) | Core p. 155 | `HEALTH_V96.healingSpellTime` 'book' / 'off' |
| Antidote as professional attention | none | an antidote patch on a dying, unstabilised patient whispers the GM a Stabilise button (the GM judges whether a toxin put them down) | Core p. 186 | `HEALTH_V96.antidoteAttention` 'book' / 'off' |
| Implants and slap patches | no effect | dermal armor lowers a patch's rating by its armor; blood filtration makes any patch but the trauma patch useless | Core p. 250 | `HEALTH_V96.patchImplants` 'book' / 'off' |
| Stim patch and magicians | none | a magician rolls Magic vs the patch rating; failing posts the Magic loss card; optional: vs the total of the last 24 hours | Core p. 250; Awakenings p. 99 | `HEALTH_V96.stimMagic` 'core' / 'awakenings' / 'off' |
| Nephritic screen | +dice vs injected/ingested toxins | also −1 Power vs pathogens and blood-vectored (injected) toxins (VERIFY: "blood-vectored" read as injection) | Shadowtech p. 30 | `HEALTH_V96.nephriticPower` 'book' / 'off' |
| Trauma damper | −1 box on Stun hits | also a Physical hit moves one box onto the Stun track (not with a pain editor, which the system keeps on) | Shadowtech p. 29 | `HEALTH_V96.traumaDamper` 'book' / 'off' |
| Pain editor | Stun wounds ignored | also Stun can't knock the wearer out (derived status and the damage card); its −1 Intelligence was already `GEAR_V923.bioware` | Shadowtech p. 26 | `HEALTH_V96.painEditor` 'book' / 'off' |
| Addiction: both kinds | one kind per drug | a drug can be "Both": a Body and a Willpower test after a dose, the shorter dose clock (drugs' addiction type has a new choice 'both') | Shadowtech p. 87 | `HEALTH_V96.addictionBoth` 'book' / 'off' |
| Addiction: test timing | at the dose | the addiction and Tolerance tests are rolled when the dose wears off | Shadowtech p. 87 | `HEALTH_V96.addictionTiming` 'wearOff' / 'dose' |
| Addiction: rest after recovery | cured at once | a rest of the drug's base rating in days at +1 (+2 concentration), then cured (VERIFY: the book gives no unit for the rest; days) | Shadowtech p. 88 | `HEALTH_V96.addictionRest` 'book' / 'off' |
| Addiction: forced withdrawal's fall | none | each 24 hours of forced withdrawal without a dose the current rating drops 1 (never below the base) | Shadowtech p. 88 | `HEALTH_V96.addictionFall` 'book' / 'off' |
| Addiction: weekly loss | none | each week addicted (not recovering) the GM gets a card: ½ Essence (Apply button, `essenceShift`) and a box off each track's maximum (noted only) | Shadowtech p. 87 | `HEALTH_V96.addictionAttrition` 'card' / 'off' |
| DocWagon response time | the contract's fixed minutes | 1D6 unit (5–6 air), 3D6 minutes −2 by air, at least 4; the GM adds area and Enforcement Rating | Neo-Anarchist's Guide p. 95 | `HEALTH_V96.docwagonResponse` 'book' / 'off' |
| DocWagon HTR | the tier's own fee | `htrFee` less 50 percent (Gold) or all (Platinum) (VERIFY: the book names no price; 5,000¥) | Core p. 250 | `HEALTH_V96.docwagonHtr` 'book' / 'off' |
| DocWagon extended care | none | a paid-up Gold contract takes 10 percent off rest care fees and paramedic fees, Platinum 50 | Core p. 250 | `HEALTH_V96.docwagonExtendedCare` 'book' / 'off' |
| Neuro-stun | Stun only | anyone exposed (not immune) is disoriented an hour: +2 to every TN (a toxin whose name says neuro-stun) | Core p. 186 | `HEALTH_V96.neuroStun` 'book' / 'off' |
| Medkit's advice | none | first aid with a medkit rolls at least the kit's Biotech 3, without defaulting (VERIFY: "advise the user" read as lending its rating) | Core p. 250 | `HEALTH_V96.medkitAdvice` 'book' / 'off' |

Cut / still not built:
- Radiation by rads, replacement body parts and the stabilization unit, over-damage, sprint fatigue (cut by the lead).
- The caster's own split of a healing spell's successes (a field in the cast dialog); boxes first is used.
- The weekly addiction box loss as a shorter track (the system's tracks are fixed at 10 boxes); the card notes it. The recovered boxes during the post-recovery rest likewise.
- The trauma damper with a damage compensator (works only once the compensator is exceeded), and the pain editor's off switch (the system keeps it on); its hidden damage and tactile +4 Perception.
- DocWagon's area table and the loophole (2D6) roll for late arrivals: left to the GM.
- The medkit's antidote making (Biotech vs the toxin's Virulence) and its supplies running out.
