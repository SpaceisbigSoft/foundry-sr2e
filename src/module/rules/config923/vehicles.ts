/**
 * v0.92.3 book alignment: Vehicles, rigging and building security. Read through RULES.VEHICLES_V923. Every value here was checked against the SR2 books
 * (book and page in each comment). Each switch's first choice is the book's way (the default); the other puts the
 * old v0.92.2 behaviour back.
 *
 * Vehicles follow Rigger 2 first (its vehicle rules replace the core book's, Rigger 2 p. 20); the core book only where
 * Rigger 2 is silent. Building security follows the Corporate Security Handbook (CSH).
 *
 * Under the "SR2E Unified Rules Revamp" rules source a switch for a rule the Revamp changes itself
 * (REVAMP_VEHICLE_RULES below) is read at its old (v0.92.2) choice (VEHICLES_V923_OLD, through veh923() in
 * rules/vehicles.ts), so the Revamp's own URR_V80 switch decides there as before; the other switches are book
 * corrections the Revamp is silent on and read the same under either source.
 *
 * - avArmor: anti-vehicle munitions against vehicle armor. 'half': only half the Armor (round down) comes off the Power,
 *   the level is not lowered, and the armor never stops them outright (Rigger 2 p. 53; Core p. 108). 'full': the whole
 *   Armor comes off and armor at or above the Power stops them.
 * - cpResist: the jumped-in rigger's Control Pool on the vehicle's damage resistance (weapons, rams, crashes), at most the
 *   rigger's skill in the vehicle; a weapon hit that does no damage when the pool dice used exceed the attacker's
 *   successes is a complete miss (Rigger 2 pp. 50, 53). 'none': no pool.
 * - vehicleDodge: 'none': a vehicle makes no dodge test against an attack; its defence is the Control Pool on the
 *   damage resistance (Rigger 2 p. 53). 'old': the jumped-in rigger's evasive-driving test (FIXES_V71.riggerDodge) and a
 *   manual driver's evasion (VEHICLES_V57.evasion.manual).
 * - gunneryPool: 'combat': a jumped-in driver (or security rigger) fires mounted weapons with Gunnery + Combat Pool (at
 *   most the Gunnery skill); the Control Pool may not be used for vehicle weapons or sensors (Rigger 2 p. 16; p. 78).
 *   'control': Gunnery + Control Pool.
 * - cpCap: 'skill': Control Pool dice on a driving test at most the skill rating rolled (Rigger 2 pp. 16, 20, 51).
 *   'none': any dice up to the pool left.
 * - feedback: rigger damage. 'book': only a hit the vehicle sustains at Serious (6M Physical) or Destroyed/Deadly (6S
 *   Physical), and 6S whenever the hit destroys the vehicle, resisted with an ordinary Damage Resistance Test (Body);
 *   a destroyed vehicle's 6S replaces the dump shock for a rigger jumped in aboard (Rigger 2 p. 49). Keyed on the hit's
 *   level, not the condition it leaves: Rigger 2 uses "sustains … damage" for a single hit's level (p. 85's subsystem
 *   damage), and the vehicle's levels are its damage levels (Destroyed = Deadly). 'old': every damaging hit, Willpower vs the Power, at the
 *   vehicle's level, Stun (RULES.RIGGING.feedback), and dump shock when destroyed (RULES.RIGGING.dumpShock).
 * - vcrTn: the control rig's TN bonus (RULES.RIGGING.vcr.tnPerLevel per level). 'byTest': twice that on an ordinary
 *   Driving Test ("rigger in control", Rigger 2 p. 20), once on the combat maneuvers (accelerate or brake, positioning,
 *   ramming, Rigger 2 pp. 45–48), none on crash tests, gunnery, sensor tests or evasion (no such row in their tables,
 *   pp. 52, 28, 57–58). 'flat': once on every jumped-in vehicle test (with NETRIG_V73.controlRig for gunnery and evasion).
 * - autonavDice: 'book': a driver adds the vehicle's Autonav rating in dice to an ordinary Driving Test and a Crash Test
 *   (Rigger 2 pp. 20, 51); not to the combat maneuvers. 'none': skill dice only.
 * - autonavMin: 'book': an autonav of rating 1 can't drive the vehicle by itself (Rigger 2 p. 122); drones' Pilot is
 *   unaffected. 'any': any rating drives.
 * - damageInit: 'book': the vehicle's damage lowers its driver's Initiative by 1 / 2 / 3 at Light / Moderate / Serious
 *   (Rigger 2 p. 49; Core p. 109). 'none': no penalty.
 * - damageSpeed: 'book': a vehicle at Moderate damage loses 25 % of its Speed, at Serious 50 % (Rigger 2 p. 49).
 *   'none': no change.
 * - crashPower: 'up': a crash's Power is its speed ÷ 10 rounded up, with no minimum (Rigger 2 p. 50). 'down': rounded
 *   down, at least RULES.VEHICLES.crash.minPower.
 * - crashMods: the Crash Test's table (Rigger 2 p. 52). 'book': terrain open −1 / normal 0 / restricted +2 / tight +4
 *   (`crashTerrain`), and the speed against the driver's Reaction: below × 20 +0, × 30 +1, × 40 +2, above +4
 *   (`crashSpeed`). 'old': the driving test's terrain row, no speed row.
 * - passengers: 'targeted': a weapon hit on the vehicle doesn't reach the people aboard (they are hurt by weapons only
 *   when they are the declared target), a collision or crash reaches them at the damage the vehicle resists (its Power
 *   and level, even when the vehicle's test leaves it unharmed), with no Combat Pool (Rigger 2 pp. 50, 53; the rigger's
 *   Crash Test Control Pool dice carrying over to them are not built). 'old': every damaging hit carries through at Power −
 *   Armor, a level lower; crash passengers at RULES.VEHICLES.crash.passengerLevel.
 * - occupant: shooting someone inside a vehicle. 'book': the higher of the vehicle's Armor or Body comes off the Power,
 *   and a jacked-in rigger takes +3 TN on the resistance test (Rigger 2 p. 53). 'old': the vehicle's Armor only.
 * - ram: 'book': the Power is the difference in speed between the two ÷ 10 (rounded up; a pedestrian or a still
 *   object: the rammer's speed), the level by that difference (Impact Damage Levels table); the rammer takes the same
 *   less its Body × the ramming test's successes (TN at least 2); the ramming test's terrain row is open −1 / normal 0 /
 *   restricted +1 / tight +2 (`ramTerrain`). A pedestrian takes the speed ÷ 10 at one level higher (a Destroyed-level
 *   hit + half the Power), the vehicle one level lower (Rigger 2 pp. 47–48, 50, 52). 'old': Body + speed ÷ 10
 *   (RULES.VEHICLES.ram), the rammer half.
 * - accel: 'book': safe braking up to Acceleration × 4 in a Combat Turn (Rigger 2 p. 22) and the acceleration test has
 *   no extra TN (p. 45). 'old': VEHICLES_V57.accel.brakeMultiplier and pushTn.
 * - gunneryMods: manual gunnery from or at a vehicle (Rigger 2 p. 57; Core p. 108). 'book': the speed difference and
 *   the target's size (the Revamp's URR_V80.vehGunnery numbers) replace the flat moving-vehicle modifiers.
 *   'old': firing from a moving vehicle +1 (+2 above half Speed), target in a moving vehicle +1.
 * - drivingRows: the Driving Test table (Rigger 2 p. 20). 'book': RULES.VEHICLES.drivingModifiers (non-stressful −1,
 *   stressful +3, large / very large vehicle +2 / +3, during combat +2, non-rigger by datajack −1, unfamiliar +1, over
 *   its Speed +1, poor visibility +2). 'old': `oldDrivingRows` (easy −1, hard +2, over Speed, unfamiliar, poor visibility).
 * - repairTn: 'boxes': the repair test's TN is the boxes to repair + 2 (Rigger 2 p. 26). 'flat':
 *   RULES.SKILLS.vehicleRepair.tn.
 * - interception: 'book': intercepting a drone's link is the interceptor's remote control deck rating vs the target
 *   deck's rating + 3, an encrypted link decrypted first (Electronic Warfare vs the encryption + 4, needing more than
 *   half the deck's rating) (Rigger 2 p. 68): the Revamp's URR_V80.dsLinkIntercept 'rcd' procedure. 'old': the link
 *   skill vs the radio TN (DRONES_V73.link.intercept).
 * - dumpDisorient: 'book': dump shock disorients: +2 TN for 10 Combat Turns, Willpower (4) cuts it to 10 ÷ successes
 *   (Rigger 2 p. 64). 'none': no disorientation.
 * - cardCasing: 'double': a card reader's casing is opened against twice the reader's rating (CSH p. 100). 'single':
 *   the casing rating.
 * - circuitFail: 'passive': a circuit (or keypad) bypass with no successes triggers a passive alert (CSH p. 100), as
 *   well as the tally. 'tally': the tally only (a disaster still alerts).
 * - passkey: 'book': a passkey rolls its rating against the card reader's rating with the casing left in place; no
 *   successes triggers an alarm (CSH p. 100). 'old': the passkey's rating replaces the skill dice when higher, against
 *   the lock's full TN, after the casing.
 * - sequencer: 'book': a sequencer on a keypad is an opposed test of the ratings (after the casing): more successes
 *   opens it, a tie does nothing, more keypad successes a passive alert (CSH p. 100). 'old': the rating replaces the
 *   skill dice when higher.
 * - autoCrash: 'book': a vehicle whose condition monitor fills crashes automatically (Rigger 2 p. 53). 'old': nothing
 *   more (a destroyed vehicle called for no crash test).
 * - body0: 'destroyed': a vehicle or drone with Body 0 is destroyed by any hit that gets through (Rigger 2 p. 53).
 *   'old': it resists with no dice and takes the hit's level.
 *
 * Moved in place (house-rule values, the GM can set them back): RULES.VEHICLES.damage.normalWeapons.powerMultiplier
 * 0.5 → 1 (normal weapons' Power isn't halved, Rigger 2 pp. 23, 53); RULES.GEAR.spellsVsVehicles.combatArmor false →
 * true (a combat spell loses half the armor, as an anti-vehicle weapon, Rigger 2 p. 54); RULES.VEHICLES.sensors.controlPool
 * true → false (no Control Pool on sensor tests, Rigger 2 p. 16); RULES.DRONES_V73.missiles.needsLock false → true (a
 * missile needs a sensor lock, Rigger 2 p. 59); RULES.VEHICLES.cargo.personKg 100 → 0 (Load does not include passengers,
 * Rigger 2 p. 24); RULES.ACTIONS.costs.sensor 'simple' → 'complex' (Rigger 2 p. 58). Each of these is either set by the
 * Revamp's own patch or not read by the Revamp's rule, so the Revamp is unchanged.
 */
export const VEHICLES_V923 = {
  avArmor: 'half' as 'half' | 'full',
  cpResist: 'driving' as 'driving' | 'none',
  vehicleDodge: 'none' as 'none' | 'old',
  gunneryPool: 'combat' as 'combat' | 'control',
  cpCap: 'skill' as 'skill' | 'none',
  feedback: 'book' as 'book' | 'old',
  vcrTn: 'byTest' as 'byTest' | 'flat',
  autonavDice: 'book' as 'book' | 'none',
  autonavMin: 'book' as 'book' | 'any',
  damageInit: 'book' as 'book' | 'none',
  damageSpeed: 'book' as 'book' | 'none',
  crashPower: 'up' as 'up' | 'down',
  crashMods: 'book' as 'book' | 'old',
  /** The Crash Test's terrain rows (Rigger 2 p. 52), by RULES.VEHICLES.terrain id. */
  crashTerrain: { open: -1, normal: 0, restricted: 2, tight: 4 } as Record<string, number>,
  /** The Crash Test's speed rows (Rigger 2 p. 52): below Reaction × `below` adds `value`; above the last, `above`. */
  crashSpeed: { steps: [{ below: 20, value: 0 }, { below: 30, value: 1 }, { below: 40, value: 2 }] as ReadonlyArray<{ below: number; value: number }>, above: 4 },
  passengers: 'targeted' as 'targeted' | 'old',
  occupant: 'book' as 'book' | 'old',
  /** A jacked-in rigger shot inside a vehicle: + this TN on the resistance test (Rigger 2 p. 53). */
  occupantRiggerTn: 3,
  ram: 'book' as 'book' | 'old',
  /** The Ramming Test's terrain rows (Rigger 2 p. 48), by RULES.VEHICLES.terrain id. */
  ramTerrain: { open: -1, normal: 0, restricted: 1, tight: 2 } as Record<string, number>,
  accel: 'book' as 'book' | 'old',
  /** Safe deceleration in a Combat Turn: Acceleration × this (Rigger 2 p. 22). */
  brakeMultiplier: 4,
  gunneryMods: 'book' as 'book' | 'old',
  /**
   * The book's relative speed rows (Rigger 2 p. 57): a speed under `floor` counts as `floor` (both under it: none);
   * up to `equalRatio` × "roughly equal" 0; up to 2× +2, up to 3× +4, more +6. Target size: the Revamp's table
   * (RULES.URR_V80.vehGunnery.sizes and .drone, the same rows by vehicle kind). A weapon fired from a vehicle that isn't
   * in a vehicle mount: + `unmounted`.
   */
  gunnerySpeed: { floor: 5, equalRatio: 1.25, steps: [{ upTo: 2, value: 2 }, { upTo: 3, value: 4 }] as ReadonlyArray<{ upTo: number; value: number }>, above: 6, unmounted: 2 },
  drivingRows: 'book' as 'book' | 'old',
  /** The v0.92.2 Driving Test rows (drivingRows 'old'). */
  oldDrivingRows: [
    { id: 'easy', label: 'Easy maneuver', value: -1 },
    { id: 'hard', label: 'Hard maneuver', value: 2 },
    { id: 'overSpeed', label: 'Above the vehicle\'s Speed', value: 1 },
    { id: 'unfamiliar', label: 'Unfamiliar vehicle', value: 1 },
    { id: 'poorVisibility', label: 'Poor visibility', value: 2 },
  ] as ReadonlyArray<{ id: string; label: string; value: number }>,
  repairTn: 'boxes' as 'boxes' | 'flat',
  /** The repair TN's addition to the boxes repaired (Rigger 2 p. 26). */
  repairTnPlus: 2,
  interception: 'book' as 'book' | 'old',
  dumpDisorient: 'book' as 'book' | 'none',
  cardCasing: 'double' as 'double' | 'single',
  circuitFail: 'passive' as 'passive' | 'tally',
  passkey: 'book' as 'book' | 'old',
  sequencer: 'book' as 'book' | 'old',
  autoCrash: 'book' as 'book' | 'old',
  body0: 'destroyed' as 'destroyed' | 'old',
};

/** The v0.92.2 choice of each switch (what veh923() reads under the Revamp for REVAMP_VEHICLE_RULES). */
export const VEHICLES_V923_OLD: { [K in keyof typeof VEHICLES_V923]?: (typeof VEHICLES_V923)[K] } = {
  avArmor: 'full', cpResist: 'none', vehicleDodge: 'old', gunneryPool: 'control', cpCap: 'none', feedback: 'old', vcrTn: 'flat',
  autonavDice: 'none', autonavMin: 'any', damageInit: 'none', damageSpeed: 'none', crashPower: 'down', crashMods: 'old',
  passengers: 'old', occupant: 'old', ram: 'old', accel: 'old', gunneryMods: 'old', drivingRows: 'old', repairTn: 'flat',
  interception: 'old', dumpDisorient: 'none', cardCasing: 'single', circuitFail: 'tally', passkey: 'old', sequencer: 'old',
  autoCrash: 'old', body0: 'old',
};

/**
 * The VEHICLES_V923 switches for rules the Unified Rules Revamp changes itself (its own URR_V80 switch or a
 * URR_V80_PATCH entry for the same rule): under the Revamp source veh923() reads their v0.92.2 choice, so the Revamp's
 * rule decides as before. avArmor, body0 (URR_V80.vehDamage), cpResist and vehicleDodge (vehCpResist: the vehicle's
 * defence), gunneryPool (vehCpGunnery), cpCap (vehCpCap), feedback (vehFeedback), damageSpeed (vehDamageSpeed),
 * crashPower and ram (vehImpact), crashMods (VEHICLES.terrain), passengers (vehPassengers), occupant
 * (vehOccupantArmor), gunneryMods (vehGunnery), drivingRows (VEHICLES.drivingModifiers), repairTn (vehRepairTn),
 * interception (dsLinkIntercept), dumpDisorient (dsDumpDisorient), cardCasing (dsLockCasing), passkey (dsPasskey),
 * sequencer (dsSequencer). The others (vcrTn, autonavDice, autonavMin, damageInit, accel, circuitFail, autoCrash)
 * are book corrections the Revamp is silent on: they read the same under either source.
 */
export const REVAMP_VEHICLE_RULES: ReadonlySet<keyof typeof VEHICLES_V923> = new Set<keyof typeof VEHICLES_V923>([
  'avArmor', 'body0', 'cpResist', 'vehicleDodge', 'gunneryPool', 'cpCap', 'feedback', 'damageSpeed', 'crashPower', 'ram',
  'crashMods', 'passengers', 'occupant', 'gunneryMods', 'drivingRows', 'repairTn', 'interception', 'dumpDisorient',
  'cardCasing', 'passkey', 'sequencer',
]);

const sel = (path: string, choices: string[], section = 'vehiclesAndRigging') => ({ path: `VEHICLES_V923.${path}`, section, type: 'select' as const, choices });

/** The house-rules window's rows for VEHICLES_V923 (spread into settings.ts HOUSE_RULES). */
export const HOUSE_VEHICLES_V923: Array<{ path: string; section: string; type: 'number' | 'boolean' | 'select'; choices?: string[]; step?: number }> = [
  sel('avArmor', ['half', 'full']),
  sel('cpResist', ['driving', 'none']),
  sel('vehicleDodge', ['none', 'old']),
  sel('gunneryPool', ['combat', 'control']),
  sel('cpCap', ['skill', 'none']),
  sel('feedback', ['book', 'old']),
  sel('vcrTn', ['byTest', 'flat']),
  sel('autonavDice', ['book', 'none']),
  sel('autonavMin', ['book', 'any']),
  sel('damageInit', ['book', 'none']),
  sel('damageSpeed', ['book', 'none']),
  sel('crashPower', ['up', 'down']),
  sel('crashMods', ['book', 'old']),
  sel('passengers', ['targeted', 'old']),
  sel('occupant', ['book', 'old']),
  { path: 'VEHICLES_V923.occupantRiggerTn', section: 'vehiclesAndRigging', type: 'number' },
  sel('ram', ['book', 'old']),
  sel('accel', ['book', 'old']),
  { path: 'VEHICLES_V923.brakeMultiplier', section: 'vehiclesAndRigging', type: 'number', step: 0.5 },
  sel('gunneryMods', ['book', 'old']),
  sel('drivingRows', ['book', 'old']),
  sel('repairTn', ['boxes', 'flat']),
  sel('interception', ['book', 'old']),
  sel('dumpDisorient', ['book', 'none']),
  sel('autoCrash', ['book', 'old']),
  sel('body0', ['destroyed', 'old']),
  sel('cardCasing', ['double', 'single'], 'buildingSecurity'),
  sel('circuitFail', ['passive', 'tally'], 'buildingSecurity'),
  sel('passkey', ['book', 'old'], 'buildingSecurity'),
  sel('sequencer', ['book', 'old'], 'buildingSecurity'),
  // v0.92.3: the Control Pool on sensor tests (Rigger 2 p. 16: not allowed; was on). The value moved to the book's.
  { path: 'VEHICLES.sensors.controlPool', section: 'vehiclesAndRigging', type: 'boolean' },
  // v0.92.3: a sensor test is a Complex Action (Rigger 2 p. 58; was simple). The value moved to the book's.
  { path: 'ACTIONS.costs.sensor', section: 'vehiclesAndRigging', type: 'select', choices: ['complex', 'simple'] },
];
