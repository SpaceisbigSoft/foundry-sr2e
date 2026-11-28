/**
 * v0.98.0 rules completeness, vehicles: driving, vehicle combat and chases. Read through RULES.VDRIVE_V98. Book rules
 * from Rigger 2 (whose vehicle rules replace the Core Rulebook's, Rigger 2 p. 20) that the system did not have before
 * v0.98.0, each with its page in the comment. Each switch's first choice is the book's way (the default); the other
 * ('v971') puts the v0.97.1 behaviour back. Pure logic lives beside it in rules/vdrive98.ts, the Foundry glue in
 * applications/vdrive98.ts.
 *
 * Under the "SR2E Unified Rules Revamp" source (RULES.URR_V80.active) the Revamp's own chase rules win (its driving rows
 * "maneuver score ahead / behind"): `chase`, `passengerPhase` and `gunneryRows` read 'v971' there (vdrive98.ts on()).
 */
export const VDRIVE_V98 = {
  /**
   * Off-road Speed (Rigger 2 p. 22, Handling): a ground vehicle (car, bike, truck) moving off-road has half its Speed
   * (round down) unless it has off-road suspension (the vehicle's `offroadSuspension98`; Rigger 2 p. 125). 'v971': the
   * Speed is the same off-road.
   */
  offRoad: 'book' as 'book' | 'v971',
  /**
   * Rigger defaulting (Rigger 2 p. 12, Vehicle Skills and Defaulting): a rigger jumped in through a control rig defaults
   * from another vehicle skill or from Reaction at +1 per dot instead of +2: this system's +2 (a related skill) becomes
   * +1 and its +4 (the attribute) +2. Not to or from a non-vehicle skill. 'v971': the full modifier.
   */
  riggerDefault: 'book' as 'book' | 'v971',
  /**
   * An active autonav in combat maneuvers (Rigger 2 pp. 45–48, the maneuver tables and their key): + its rating on the
   * Accelerate/Brake and Positioning Tests, + (rating + 2) on a Ramming Test, + rating on a Hiding Test, − rating on a
   * Relocating Test. Turned off on the vehicle (`autonavOff98`, a Simple Action; free jumped in, p. 46); off, the autonav
   * adds no dice to driving tests either. 'v971': no such modifier, the autonav always adds its dice.
   */
  autonavCombat: 'book' as 'book' | 'v971',
  /**
   * The ram's range (Rigger 2 p. 47): the distance to the target must be less than the vehicle's Acceleration (the chase
   * gap between the two, else the distance between the tokens); further away, accelerate first. 'v971': no check.
   */
  ramRange: 'book' as 'book' | 'v971',
  /**
   * Walls and barriers (Rigger 2 pp. 51–52): a vehicle at or below Barrier × 20 m per turn stops against the wall (the
   * standard crash); faster, it breaks through and loses Barrier × 20 speed, taking the Barrier Rating as Power at the
   * level of the speed lost (the Impact Damage Levels table, p. 50); restrained passengers take nothing then. A
   * calculator in the GM's "Vehicle chase" tool and a Hit-a-wall action. 'v971': none.
   */
  walls: 'book' as 'book' | 'v971',
  /**
   * Exceeding the Speed (Rigger 2 pp. 22, 25, 45): a vehicle may go up to 1.5 × its Speed, no faster. 'v971': no cap.
   */
  speedCap: 'book' as 'book' | 'v971',
  /**
   * Stress (Rigger 2 pp. 25–26): the vehicle's Stress Points (`stress98`): +1 each time it speeds up past its Speed;
   * the Stress Rule of One (as many 1s on a Driving Test as the driver's skill: + 1D6); a failed Driving Test calls a
   * Stress Test (2D6 below the Stress: a system fails, Crash Test); Stress at twice the Body or more: a system fails.
   * 'v971': no Stress.
   */
  stress: 'book' as 'book' | 'v971',
  /**
   * The Maneuver Score chase (Rigger 2 pp. 41–49): each Combat Turn the GM's tool records every vehicle's score on the
   * combat (Vehicle Points by type, Terrain Points, speed ÷ 10, and the driver's Open Test of skill + Control Pool dice
   * plus last turn's positioning successes and an Escape Bonus). The score difference sets the Accelerate/Brake,
   * Ramming, Hiding and Relocating rows (±2 / ±4; hiding +3 / +6); fleeing more than one vehicle +1 each; positioning
   * successes go to the next turn's Driver Points; Hiding breaks contact (the Escape Bonus), Relocating (a Perception
   * Test against the Signature) finds the vehicle again. The chase turn then moves the gap by speed only. The record is
   * on the combat (GM-owned), never on a vehicle. 'v971': the v0.57.0 positioning chase (RULES.VEHICLES_V57.maneuver).
   */
  chase: 'book' as 'book' | 'v971',
  /**
   * Passengers in vehicle combat (Rigger 2 p. 49): no one aboard but the rigger takes an offensive action (an attack, a
   * spell) in a Combat Phase higher than the vehicle's Driver Points this turn (needs `chase` 'book' and the turn's
   * scores). 'v971': no limit.
   */
  passengerPhase: 'book' as 'book' | 'v971',
  /**
   * Manual gunnery rows (Rigger 2 p. 57): relative motion (moving toward −1, away +1: in a chase, by which of the two is
   * faster) and the Maneuver Score difference (more than 10 ahead −1, behind +1), from the combat's record. Replaces the
   * v0.57.0 position modifier. 'v971': not applied (the v0.57.0 position modifier as before).
   */
  gunneryRows: 'book' as 'book' | 'v971',
  /**
   * Passenger safety gear in collisions and crashes (Rigger 2 p. 50; APPS and crash cages p. 128): a seat belt (the
   * vehicle's `belted98`: everyone aboard wears one) stages the damage down a level; APPS (`apps98`) halves the Power
   * (round up); a crash cage (`crashCage98`) adds 6 dice. 'v971': none.
   */
  passengerSafety: 'book' as 'book' | 'v971',
  /**
   * The rigger's Crash Test Control Pool dice (Rigger 2 p. 50): the dice the rigger put into the Crash Test also go on
   * the passengers' resistance of that crash. 'v971': not carried over.
   */
  cpCarry: 'book' as 'book' | 'v971',
  /**
   * A Deadly hit on a passenger (Rigger 2 p. 53): an attack at a passenger with a Deadly level also does Light damage
   * to the vehicle, not resisted (a GM's button when this client can't write the vehicle). 'v971': nothing.
   */
  deadlyPassenger: 'book' as 'book' | 'v971',
  /**
   * Called shots at external components (Rigger 2 p. 53): the hit must do at least Moderate to the vehicle to knock the
   * component out; Light for fragile parts (sensors, as antennas), Serious for reinforced ones (a turret mount)
   * (`partThreshold`). 'v971': any damage knocks it out.
   */
  calledThreshold: 'book' as 'book' | 'v971',
  /** The levels a called shot must reach on the vehicle, by RULES.VEHICLES_V57.calledShots part (Rigger 2 p. 53; VERIFY by part). */
  partThreshold: { tires: 'M', sensors: 'L', engine: 'M', mount: 'M', turret: 'S' } as Record<string, 'L' | 'M' | 'S' | 'D'>,
  /**
   * Driving by datajack (Rigger 2 p. 124, Datajack Port; p. 16): a character without a control rig driving through a
   * datajack (the Driving Test's "non-rigger driving by datajack" row ticked, and a datajack) has +1 Reaction for the
   * test (the Crash Test's speed rows, defaulting to Reaction). 'v971': no Reaction bonus.
   */
  datajackReaction: 'book' as 'book' | 'v971',
};

const BV = ['book', 'v971'];
/** The house-rules window's rows for VDRIVE_V98 (spread into settings.ts HOUSE_RULES). */
export const HOUSE_VDRIVE_V98: Array<{ path: string; section: string; type: 'number' | 'boolean' | 'select'; choices?: string[]; step?: number }> = (
  Object.keys(VDRIVE_V98) as Array<keyof typeof VDRIVE_V98>
).filter((k) => typeof VDRIVE_V98[k] === 'string').map((k) => ({ section: 'vehiclesAndRigging', path: `VDRIVE_V98.${k}`, type: 'select' as const, choices: BV }));

/**
 * The Maneuver Score tables (Rigger 2 pp. 41, 45–49, 57). Vehicle Points by vehicle type (p. 41); `byCategory` the type
 * a vehicle of a category counts as when its own type isn't set (this system's reading, VERIFY). Terrain Points (p. 41).
 * The score-difference rows (`near` up to 10 ahead / behind, `far` 11 or more): accelerate/brake and ram ±2 / ±4,
 * hiding −2 / −4 ahead, +3 / +6 behind, relocating ±2 / ±4 (pp. 45–49). Over the Speed: accelerate, position, ram +1,
 * hide +2, relocate +4. Terrain: accelerate and position the driving rows; hide open +4, normal +2, restricted 0, tight
 * −2; relocate (the hiding vehicle's terrain) −3 / −1 / 0 / +3. Gunnery: more than 10 apart ±1 (p. 57).
 */
export const CHASE98 = {
  vehiclePoints: {
    car: 0, sportsCar: 3, motorcycle: 5, limousine: -3, heavyTruck: -5, tractorTrailer: -7, tracked: -3, ultralight: 10,
    helicopter: 5, smallAirplane: 0, largeAirplane: -5, fighterJet: 20, zeppelin: -10, suborbital: -15, semiballistic: -25,
    smallMotorboat: 0, racingBoat: 5, yacht: -10, hovercraft: 2, train: -10,
  } as Record<string, number>,
  byCategory: {
    car: 'car', bike: 'motorcycle', truck: 'limousine', hovercraft: 'hovercraft', boat: 'smallMotorboat', ship: 'yacht',
    rotor: 'helicopter', fixedWing: 'smallAirplane', vectorThrust: 'smallAirplane', lta: 'zeppelin', other: 'car',
  } as Record<string, string>,
  terrainPoints: { open: 0, normal: -2, restricted: -4, tight: -10 } as Record<string, number>,
  speedPerPoint: 10,
  near: 10,
  diff: {
    accel: { ahead: [-2, -4], behind: [2, 4] },
    ram: { ahead: [-2, -4], behind: [2, 4] },
    hide: { ahead: [-2, -4], behind: [3, 6] },
    relocate: { ahead: [-2, -4], behind: [2, 4] },
  } as Record<string, { ahead: [number, number]; behind: [number, number] }>,
  overSpeed: { accel: 1, ram: 1, hide: 2, relocate: 4 } as Record<string, number>,
  hideTerrain: { open: 4, normal: 2, restricted: 0, tight: -2 } as Record<string, number>,
  relocateTerrain: { open: -3, normal: -1, restricted: 0, tight: 3 } as Record<string, number>,
  /** + per opposing vehicle beyond the first (fleeing on accelerate/brake, escaping on hiding; Rigger 2 pp. 45, 48). */
  perExtraOpponent: 1,
  /** Ram: + (autonav rating + this) (Rigger 2 p. 47). */
  ramAutonavPlus: 2,
  gunnery: { over: 10, value: 1 },
  /** NPC drivers give up relocating after this many Combat Turns (Rigger 2 p. 49). */
  npcRelocateTurns: 5,
  /** The wall rule's multiplier (Rigger 2 pp. 51–52). */
  barrierSpeed: 20,
  /** Exceeding the Speed: at most this × (Rigger 2 p. 22). */
  maxSpeedFactor: 1.5,
  /** A crash cage's dice (Rigger 2 p. 128). */
  crashCageDice: 6,
};
