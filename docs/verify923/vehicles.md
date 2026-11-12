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
10,000¥ × Rating (CSH p. 100 prints × Rating²; Core p. 243 × Rating); the anti-vehicle rocket falloff −1 per 4 m (the
Core Rocket/Missile table: −8 per metre).

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
