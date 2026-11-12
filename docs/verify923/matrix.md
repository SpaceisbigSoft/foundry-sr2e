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
