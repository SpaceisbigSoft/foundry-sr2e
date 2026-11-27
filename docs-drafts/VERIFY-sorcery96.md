#### Sorcery (v0.96.0, RULES.SORCERY_V96)

Switches in `RULES.SORCERY_V96` (`src/module/rules/config96/sorcery.ts`; pure logic `rules/sorcery96.ts`, Foundry side
`applications/sorcery96.ts`). The first choice is the book's way and the default; the other gives v0.95.1. The owner's
decisions are kept: the casting test rolls the skill's rating (MAGIC_V920), the layered Magic Pool and FORMULA_V918;
these rules add to them. Rows marked VERIFY are readings the books didn't settle.

| Rule | Was | Now (book) | Source | Switch |
|---|---|---|---|---|
| Defaulting magical skills | no Sorcery skill, no casting | a magically active caster with no Sorcery defaults to Magical Theory, Conjuring, Enchanting or Willpower at +2 TN a web step (the GM's Skill Web where it links them, else 1 / 2 / 2 / 4 steps; the most dice win). VERIFY: the Awakenings p. 94 web diagram wasn't readable; the steps are a reading. Casting only (not dispelling, wards or castAtObject); the sustain cap still reads the Sorcery rating (0) | Awakenings p. 93; Core p. 68 | `SORCERY_V96.magicDefault` |
| Shaping an area spell | radius = Magic metres | the Cast window's radius change: 2 dice withheld a metre smaller, 1 die a metre larger, at most Force dice; the targets inside the new radius are ticked; the dice come off the casting test | Core p. 130 | `SORCERY_V96.areaShape` |
| Spell stacking | none | the Cast window's "other spells stacked": +2 TN each on the casting and Drain tests (each stacked spell is cast through its own window with the same count; the pool is split by hand). VERIFY: read as +2 per spell beyond the first (the book's two-spell example is +2) | Core p. 129 | `SORCERY_V96.stacking`, `stackTn` 2 |
| Noticing spellcasting | none | the cast card's title names the onlookers' Perception TN: 2 × \|Magic − Force\|, at least 2 (VERIFY: the minimum), −2 for a magician, automatic for the astrally active (not rolled) | Core p. 132 | `SORCERY_V96.noticing`, `noticeMinTn` 2 |
| Active foci | no limit | at most Intelligence active foci; switching one more on is refused (any path: `preUpdateItem`) | Core p. 137 | `SORCERY_V96.fociLimit` 'book' / 'warn' / 'off' |
| The Armor spell | effect per success (MAGIC_V56 step) | one-half the successes count (step 2 for the names in `halfSuccessSpells`) | Core p. 158 | `SORCERY_V96.armorSpell` |
| A ward's days | the card states them | the ward keeps its days (barrier field `wardDays96`); when it rises its end is set on the system clock (`wardEnds96`, lead GM); when the clock passes it the ward falls (rating 0) and the GMs get a card | Grimoire p. 92; Grimoire II errata | `SORCERY_V96.wardExpiry` 'book' / 'card' / 'off' |
| Quickening | Karma = Force at once | the Quicken window asks for the casting test's dice and TN and the Karma (Force to 2 × Force); Sorcery + grade vs the TN; actions to sustain = dice ÷ successes (up, at least 1; none: twice the dice); the Karma is kept for dispelling's TN; a second Drain at the spell's own code. VERIFY: made permanent at once, the card states the actions (the GM holds it back); rounding up | Grimoire pp. 44–45 | `SORCERY_V96.quickening` |
| Anchoring | MAGIC_V72 Karma by Force | Karma = Force + links (a trigger = 1 link); Enchanting vs half the Force (down, VERIFY) + links, at least 2; a minute per Force and link ÷ successes; prepared either way (on the anchoring card) | Grimoire p. 47 | `SORCERY_V96.anchoring` |
| Masking | +TN per grade on assensing | no TN; an initiate assensing a masked initiate makes a secret Magic test vs the subject's Magic needing (subject grade − viewer grade, at least 1) successes (GM card); held or not an initiate: the aura reads as mundane (no Magic, tradition, sustained spells; foci hidden while their rating points ≤ the grade) | Grimoire p. 46 | `SORCERY_V96.masking` |
| Centering for spellcasting and Drain | penalties only | the Cast window offers centering for the spell (astrally perceiving; the spell's TN and modifiers) or against the Drain (the Drain TN with the known modifiers); every 2 successes add a success to a test that has one (kept as bought successes through re-rolls) | Grimoire p. 43 | `SORCERY_V96.centeringUse` |
| Totem dice | added to the casting test | Magic Pool dice for that cast: a bonus pays for the first pool dice asked (casting, then Drain) without spending the pool; a penalty leaves fewer pool dice for the cast; the window's pool limit follows | Core p. 119 | `SORCERY_V96.totemPool` |
| Drain codes in the importer | warned, left at the default | the core spells' drain codes (Core pp. 151–158, Table of Spells p. 159), by name without case or spaces; spells whose level depends on the wound or attribute are left out | Core pp. 151–159 | `SORCERY_V96.drainTable` |
| A dispelled spell's effect | only the Force changes | the effect on each subject is rebuilt capped at the new Force (the GM's Apply card too) | Grimoire p. 45 | `SORCERY_V96.dispelEffect` |
| Grade 0 by hand | not settable | an "Initiated (Grade 0)" tick on the character sheet while the grade is 0 (the `initiated` flag) | Grimoire pp. 37–38 | `SORCERY_V96.gradeZero` |

Cut / still not built
- Splitting a spell's dice over several targets with a Drain test each (Core p. 129): needs the non-area Cast window to take several targets and the cast to run one test and one Drain per target; not done.
- Circle/lodge TN inside another's circle (cut by the lead: needs circles on the map). Healing spells' time/success split (the health area's).
- Quickening's sustaining time is not tracked (the card states the actions); a Centering-against-Drain carried into quickening's second Drain is not applied.
- Deliberate masking (2 × grade dice to raise the threshold) and masking foci beyond the grade by a deliberate test.
- The geas due for every 2 Magic lost; the ritual's link and sending times; elemental secondary effects in full (Grimoire pp. 113–114): not done.
- Defaulting: magical-skill defaults for conjuring, enchanting and dispelling; the Awakenings web diagram itself.
- Noticing: no roll for onlookers (the GM uses the TN shown).
