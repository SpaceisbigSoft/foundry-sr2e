/**
 * v0.98.0 rules completeness, building security and vehicle upkeep. Read through RULES.VSEC_V98. Book rules from Rigger 2
 * ("The Security Rigger" pp. 77–80, "Standard Vehicle Operations" p. 26, "Vehicle Customization" pp. 118–147, "Vehicle
 * Design" pp. 108–118, 167–171) and the Corporate Security Handbook (CSH, "Gamemaster Information" pp. 94–105) that the
 * system did not have before v0.98.0, each with its page in the comment. Each switch's first choice is the book's way
 * (the default); the other ('v971') puts the v0.97.1 behaviour back. Pure logic lives beside it in rules/vsec98.ts, the
 * Foundry glue in applications/vsec98.ts. A site and its devices stay GM-owned: everything the GM side decides about a
 * site is read from the site (or a GM-authored card), never from a player's actor.
 */
export const VSEC_V98 = {
  /**
   * CCSS device limits (CSH p. 102; Rigger 2 pp. 77–78): a security rigger actively operates as many parts of the
   * system as their Intelligence (the rest run on autopilot), and commands at most as many drones as their remote
   * control deck's rating. The GM's site panel (the "Security and vehicle upkeep" tool) shows both against the site's
   * devices and slaved drones. 'v971': not shown.
   */
  ccss: 'book' as 'book' | 'v971',
  /**
   * The security rigger's dice pools (Rigger 2 p. 78, Rigger Bonuses in a CCSS): while "assuming the body" the rigger
   * has no dice pool but Karma; a device's detection test therefore takes no Control Pool from the site's rigger.
   * 'v971': the rigger's Control Pool may add to a device's detection test (v0.26.0).
   */
  ccssPools: 'book' as 'book' | 'v971',
  /**
   * The Rigger Perception Tests Table (Rigger 2 p. 77; CSH p. 102): the GM's secret Perception Test for the security
   * rigger when something happens on the system: a door or gate opening or closing 5, attempted lock tampering with
   * no alarm 3, successful tampering 3 × the tamper successes, a device destroyed 4, one carefully deactivated 6, −2
   * while the system is on alert; an alarm or a sensor triggered needs no test. 'v971': no such test.
   */
  perception: 'book' as 'book' | 'v971',
  /**
   * Accessing a rigged security system (Rigger 2 p. 79; CSH p. 104): a site's Technical Rating (1–10, the TN) and
   * Vigilance Code (Blue 1, Green 2, Amber 3, Red 4 successes needed); tap a dataline (tap rating + Electronics),
   * defeat encryption (decryption module + Intelligence), adjust to the protocols (emulation module + Intelligence),
   * each a Complex Action; a failed decryption or protocol test puts the system on alert. The intruder's owner rolls
   * from the GM's request card; the GM's Apply re-checks the roll. 'v971': not built.
   */
  access: 'book' as 'book' | 'v971',
  /** The alert a failed decryption or protocol test puts the site on (Rigger 2 p. 79: "goes on alert"; VERIFY). */
  accessAlert: 'active',
  /**
   * Rigger combat (Rigger 2 p. 79; CSH p. 105) and decking a rigged system (Rigger 2 p. 80): an opposed Willpower Test
   * (the attacker may add Control Pool dice, at most their Willpower), the winner does (their Willpower)L Stun, +1
   * level per 2 net successes; the loser resists with Body, adding Control Pool dice up to their Body. A decker: no
   * programs, +2 TN on every test, Initiative −2 with no Response Increase dice, a Control Pool of half the emulation
   * utility's rating (round up), and takes the damage as from non-lethal black IC (Willpower). 'v971': not built.
   */
  riggerCombat: 'book' as 'book' | 'v971',
  /**
   * The rigger's decking penalty (Rigger 2 p. 16, Rigging versus Decking): a character with a vehicle control rig gets
   * +1 TN on every Matrix test and their Hacking Pool is lowered by the VCR level, unless they have both a decker's and
   * a rigger's datajack (p. 18: two installed datajacks, VERIFY). 'v971': no penalty.
   */
  riggerDecking: 'book' as 'book' | 'v971',
  /**
   * Motion and vibration sensors (CSH pp. 99–100): instead of the opposed detection test, the intruder makes a Stealth Test
   * against the device's rating: one success gets past it this turn. Motion: +1 TN for each quarter metre moved over
   * 1 m in the Combat Turn. Vibration: 1 m in the turn +3 TN, faster sets it off. The metres come from the token's
   * movement this Combat Turn (Foundry's movement history); outside combat the GM adds the movement modifier. 'v971':
   * the opposed detection test.
   */
  motion: 'book' as 'book' | 'v971',
  /**
   * The Technical Security Ratings Table (CSH p. 100) and the levels of security (CSH pp. 94–98): device ratings by the
   * site's component levels (alarms, maglocks (+2 biometric), CCTV, CCSS; equipment first available at a lower level
   * rates twice the level), and the Overall Security Level (the levels added, ÷ 6 round down, 0–5). The GM's site
   * panel shows them and can set the site's device ratings. 'v971': not built.
   */
  ratings: 'book' as 'book' | 'v971',
  /**
   * Repair parts (Rigger 2 p. 26): the parts cost 5% of the vehicle's total cost (with its installed modifications) per
   * box to be repaired, with the vehicle's Availability; the repair card says so. 'v971': not shown.
   */
  repairParts: 'book' as 'book' | 'v971',
  /** Percent of the vehicle's cost per box (Rigger 2 p. 26). */
  repairPartsPercent: 5,
  /**
   * Modification prices and Installation Tests per item (Rigger 2 pp. 120–140, Customization Specifications): each
   * modification kind's parts cost, Installation Test TN and base time from its own entry (armour 1,250¥ per point, TN
   * armour ÷ 3, 8 hours per point; sensors, ECM, ECCM, ECD by their tables, 16 hours per level, TN 4; autonav and pilot
   * by rating, TN 8 − Handling; and so on). 'v971': RULES.VEHICLES.modifications' cost × rating and
   * RULES.VEHICLES.install's TN and hours.
   */
  modSpecs: 'book' as 'book' | 'v971',
  /**
   * Vehicle design (Rigger 2 pp. 108–114, the Chassis Table pp. 170–171, the Mark-Up Factors Table): a GM calculator:
   * the chassis' ratings and Design Points, the Design Point Value, the Mark-Up Factor (the chassis category's factor,
   * plus modifiers, times each special-design multiplier in turn) and the price (DPV × factor × 100¥). 'v971': no
   * calculator.
   */
  design: 'book' as 'book' | 'v971',
};

const BV = ['book', 'v971'];
/** The house-rules window's rows for VSEC_V98 (spread into settings.ts HOUSE_RULES). */
export const HOUSE_VSEC_V98: Array<{ path: string; section: string; type: 'number' | 'boolean' | 'select'; choices?: string[]; step?: number }> = [
  ...(['ccss', 'ccssPools', 'perception', 'access', 'riggerCombat', 'riggerDecking', 'motion', 'ratings', 'repairParts', 'modSpecs', 'design'] as const)
    .map((k) => ({ section: 'vehiclesAndRigging', path: `VSEC_V98.${k}`, type: 'select' as const, choices: BV })),
  { section: 'vehiclesAndRigging', path: 'VSEC_V98.accessAlert', type: 'select', choices: ['active', 'passive', 'lockdown'] },
  { section: 'vehiclesAndRigging', path: 'VSEC_V98.repairPartsPercent', type: 'number', step: 1 },
];

/** A chassis of the Chassis Table (Rigger 2 pp. 170–171): its id (name: SR2E.VSec98.Chassis.<id>), its Mark-Up category. */
export interface Chassis98 {
  id: string; cat: string; h: number; ho: number; body: number | null; armor: number | null; cf: number | null; cfMax: number | null;
  autonav: number | null; pilot: number | null; sensor: number | null; dp: number | null;
}

/**
 * The Chassis Table (Rigger 2 pp. 170–171): Handling (on-road / off-road, 0 = one rating), Body, Armor, starting and
 * maximum CF, Autonav, Pilot, Sensor and Design Points (null = NA). The All-terrain Vehicle's 445 points is as printed
 * (VERIFY). Seating, entry points and accessories are left out.
 */
export const VSEC_CHASSIS_98: readonly Chassis98[] = [
  { id: 'scooter', cat: 'bike', h: 3, ho: 6, body: 2, armor: 0, cf: 0, cfMax: 1, autonav: 0, pilot: null, sensor: 0, dp: 30 },
  { id: 'racingCycle', cat: 'bike', h: 3, ho: 6, body: 2, armor: 0, cf: 1, cfMax: 2, autonav: 0, pilot: null, sensor: 0, dp: 10 },
  { id: 'offRoad', cat: 'bike', h: 4, ho: 4, body: 2, armor: 0, cf: 1, cfMax: 8, autonav: 0, pilot: null, sensor: 0, dp: 15 },
  { id: 'chopper', cat: 'bike', h: 4, ho: 6, body: 2, armor: 0, cf: 2, cfMax: 6, autonav: 0, pilot: null, sensor: 0, dp: 15 },
  { id: 'allTerrainVehicle', cat: 'bike', h: 4, ho: 4, body: 2, armor: 0, cf: 2, cfMax: 15, autonav: 0, pilot: null, sensor: 0, dp: 445 },
  { id: 'commuterSubcomp', cat: 'car', h: 4, ho: 8, body: 3, armor: 0, cf: 1, cfMax: 16, autonav: 0, pilot: null, sensor: 0, dp: 30 },
  { id: 'sedan', cat: 'car', h: 4, ho: 8, body: 3, armor: 0, cf: 6, cfMax: 30, autonav: 0, pilot: null, sensor: 0, dp: 50 },
  { id: 'sportsCar', cat: 'car', h: 4, ho: 8, body: 3, armor: 0, cf: 3, cfMax: 18, autonav: 0, pilot: null, sensor: 0, dp: 110 },
  { id: 'limousine', cat: 'car', h: 4, ho: 8, body: 4, armor: 0, cf: 6, cfMax: 250, autonav: 2, pilot: null, sensor: 0, dp: 625 },
  { id: 'pickup', cat: 'car', h: 4, ho: 6, body: 4, armor: 0, cf: 18, cfMax: 42, autonav: 0, pilot: null, sensor: 0, dp: 60 },
  { id: 'van', cat: 'car', h: 4, ho: 10, body: 4, armor: 0, cf: 48, cfMax: 250, autonav: 0, pilot: null, sensor: 0, dp: 60 },
  { id: 'rv', cat: 'car', h: 4, ho: 4, body: 4, armor: 0, cf: 48, cfMax: 250, autonav: 0, pilot: null, sensor: 0, dp: 250 },
  { id: 'sandBuggy', cat: 'car', h: 4, ho: 4, body: 3, armor: 0, cf: 4, cfMax: 15, autonav: 0, pilot: null, sensor: 0, dp: 20 },
  { id: 'mediumTransport', cat: 'car', h: 5, ho: 12, body: 5, armor: 0, cf: 80, cfMax: 400, autonav: 0, pilot: null, sensor: 0, dp: 300 },
  { id: 'heavyTransport', cat: 'car', h: 5, ho: 12, body: 6, armor: 0, cf: 120, cfMax: 800, autonav: 0, pilot: null, sensor: 0, dp: 385 },
  { id: 'tractor', cat: 'car', h: 5, ho: 12, body: 5, armor: 0, cf: 6, cfMax: 52, autonav: 2, pilot: null, sensor: 0, dp: 175 },
  { id: 'apcTracked', cat: 'car', h: 5, ho: 5, body: 7, armor: 6, cf: 18, cfMax: 98, autonav: 0, pilot: null, sensor: 0, dp: 750 },
  { id: 'apcWheeled', cat: 'car', h: 4, ho: 6, body: 7, armor: 6, cf: 18, cfMax: 98, autonav: 0, pilot: null, sensor: 0, dp: 750 },
  { id: 'crawlerMicro', cat: 'car', h: 4, ho: 4, body: 0, armor: 0, cf: 0, cfMax: 0, autonav: null, pilot: 1, sensor: 1, dp: 220 },
  { id: 'crawlerSmall', cat: 'car', h: 4, ho: 4, body: 1, armor: 0, cf: 0, cfMax: 6, autonav: null, pilot: 1, sensor: 1, dp: 115 },
  { id: 'crawlerLarge', cat: 'car', h: 4, ho: 4, body: 2, armor: 0, cf: 2, cfMax: 12, autonav: null, pilot: 1, sensor: 1, dp: 215 },
  { id: 'remotePatrolVehicleRpv', cat: 'car', h: 3, ho: 6, body: 2, armor: 0, cf: 1, cfMax: 6, autonav: null, pilot: 2, sensor: 1, dp: 215 },
  { id: 'hovercraftSmall', cat: 'hovercraft', h: 3, ho: 0, body: 3, armor: 0, cf: 12, cfMax: 30, autonav: 0, pilot: null, sensor: 0, dp: 70 },
  { id: 'hovercraftMedium', cat: 'hovercraft', h: 4, ho: 0, body: 4, armor: 0, cf: 60, cfMax: 240, autonav: 0, pilot: null, sensor: 0, dp: 100 },
  { id: 'hovercraftLarge', cat: 'hovercraft', h: 5, ho: 0, body: 5, armor: 0, cf: 100, cfMax: 480, autonav: 0, pilot: null, sensor: 0, dp: 250 },
  { id: 'skimmerSmall', cat: 'hovercraft', h: 3, ho: 0, body: 1, armor: 0, cf: 0, cfMax: 0, autonav: null, pilot: 1, sensor: 1, dp: 250 },
  { id: 'skimmerLarge', cat: 'hovercraft', h: 3, ho: 0, body: 2, armor: 0, cf: 0, cfMax: 8, autonav: null, pilot: 1, sensor: 1, dp: 350 },
  { id: 'skiff', cat: 'boat', h: 3, ho: 0, body: 3, armor: 0, cf: 6, cfMax: 25, autonav: 0, pilot: null, sensor: 1, dp: 75 },
  { id: 'waterScooter', cat: 'boat', h: 3, ho: 0, body: 2, armor: 0, cf: 0, cfMax: 1, autonav: 0, pilot: null, sensor: 0, dp: 100 },
  { id: 'speedboat', cat: 'boat', h: 3, ho: 0, body: 3, armor: 0, cf: 0, cfMax: 30, autonav: 0, pilot: null, sensor: 0, dp: 110 },
  { id: 'sportCruiser', cat: 'boat', h: 4, ho: 0, body: 5, armor: 0, cf: 36, cfMax: 84, autonav: 1, pilot: null, sensor: 1, dp: 125 },
  { id: 'yacht', cat: 'boat', h: 5, ho: 0, body: 7, armor: 0, cf: 80, cfMax: 108, autonav: 2, pilot: null, sensor: 1, dp: 200 },
  { id: 'minisub', cat: 'boat', h: 4, ho: 0, body: 4, armor: 0, cf: 0, cfMax: 84, autonav: 2, pilot: null, sensor: 1, dp: 200 },
  { id: 'autogyro', cat: 'rotor', h: 4, ho: 0, body: 3, armor: 0, cf: 0, cfMax: 8, autonav: 0, pilot: null, sensor: 0, dp: 20 },
  { id: 'utilityHelicopter', cat: 'rotor', h: 5, ho: 0, body: 4, armor: 0, cf: 50, cfMax: 75, autonav: 1, pilot: null, sensor: 1, dp: 500 },
  { id: 'cargoHelicopter', cat: 'rotor', h: 5, ho: 0, body: 7, armor: 0, cf: 80, cfMax: 600, autonav: 1, pilot: null, sensor: 1, dp: 1000 },
  { id: 'tiltWing', cat: 'rotor', h: 6, ho: 0, body: 5, armor: 0, cf: 48, cfMax: 96, autonav: 1, pilot: null, sensor: 1, dp: 600 },
  { id: 'attackHelicopter', cat: 'rotor', h: 5, ho: 0, body: 5, armor: 0, cf: 4, cfMax: 64, autonav: 2, pilot: null, sensor: 3, dp: 1000 },
  { id: 'rotaryWingUavS', cat: 'rotor', h: 4, ho: 0, body: 0, armor: 0, cf: 0, cfMax: 0, autonav: null, pilot: 1, sensor: 1, dp: 310 },
  { id: 'rotaryWingUavM', cat: 'rotor', h: 4, ho: 0, body: 1, armor: 0, cf: 0, cfMax: 1, autonav: null, pilot: 1, sensor: 1, dp: 710 },
  { id: 'rotaryWingUavL', cat: 'rotor', h: 4, ho: 0, body: 2, armor: 0, cf: 1, cfMax: 12, autonav: null, pilot: 1, sensor: 1, dp: 1210 },
  { id: 'tiltWingUavM', cat: 'rotor', h: 4, ho: 0, body: 2, armor: 0, cf: 1, cfMax: 12, autonav: null, pilot: 1, sensor: 1, dp: 1460 },
  { id: 'tiltWingUavL', cat: 'rotor', h: 4, ho: 0, body: 3, armor: 0, cf: 2, cfMax: 25, autonav: null, pilot: 1, sensor: 1, dp: 2210 },
  { id: 'ultralight', cat: 'fixedWing', h: 4, ho: 0, body: 2, armor: 0, cf: 0, cfMax: 8, autonav: 0, pilot: null, sensor: 0, dp: 20 },
  { id: 'singleEngine', cat: 'fixedWing', h: 5, ho: 0, body: 4, armor: 0, cf: 21, cfMax: 63, autonav: 1, pilot: null, sensor: 1, dp: 75 },
  { id: 'twinEngine', cat: 'fixedWing', h: 5, ho: 0, body: 6, armor: 0, cf: 48, cfMax: 600, autonav: 1, pilot: null, sensor: 1, dp: 125 },
  { id: 'airliner', cat: 'fixedWing', h: 6, ho: 0, body: 9, armor: 0, cf: 500, cfMax: 7500, autonav: 3, pilot: null, sensor: 1, dp: 2000 },
  { id: 'jetFighter', cat: 'fixedWing', h: 6, ho: 0, body: 7, armor: 0, cf: 6, cfMax: 64, autonav: 3, pilot: null, sensor: 5, dp: 2000 },
  { id: 'fixedWingUavS', cat: 'fixedWing', h: 3, ho: 0, body: 1, armor: 0, cf: 0, cfMax: 0, autonav: null, pilot: 1, sensor: 1, dp: 710 },
  { id: 'fixedWingUavM', cat: 'fixedWing', h: 4, ho: 0, body: 2, armor: 0, cf: 1, cfMax: 12, autonav: null, pilot: 1, sensor: 1, dp: 1460 },
  { id: 'fixedWingUavL', cat: 'fixedWing', h: 4, ho: 0, body: 3, armor: 0, cf: 2, cfMax: 25, autonav: null, pilot: 1, sensor: 2, dp: 2210 },
  { id: 'thunderbird', cat: 'vectorThrust', h: 5, ho: 0, body: 6, armor: 0, cf: 16, cfMax: 96, autonav: 2, pilot: null, sensor: 3, dp: 2500 },
  { id: 'jumpJetFighter', cat: 'vectorThrust', h: 6, ho: 0, body: 7, armor: 0, cf: 6, cfMax: 64, autonav: 3, pilot: null, sensor: 5, dp: 2000 },
  { id: 'vectoredThrustUavS', cat: 'vectorThrust', h: 4, ho: 0, body: 2, armor: 0, cf: 1, cfMax: 12, autonav: null, pilot: 1, sensor: 1, dp: 1460 },
  { id: 'vectorThrustUavL', cat: 'vectorThrust', h: 4, ho: 0, body: 3, armor: 0, cf: 2, cfMax: 25, autonav: null, pilot: 1, sensor: 1, dp: 2210 },
  { id: 'zeppelin', cat: 'special', h: 5, ho: 0, body: 8, armor: 0, cf: 48, cfMax: 96, autonav: 1, pilot: null, sensor: 1, dp: 1600 },
  { id: 'miniBlimp', cat: 'special', h: 4, ho: 0, body: 2, armor: 0, cf: 1, cfMax: 6, autonav: null, pilot: 1, sensor: 1, dp: 240 },
  { id: 'anthroform', cat: 'special', h: 3, ho: 0, body: 2, armor: 0, cf: 0, cfMax: 1, autonav: null, pilot: 1, sensor: 1, dp: 400 },
  { id: 'walkerMicro', cat: 'special', h: 4, ho: 4, body: 0, armor: 0, cf: 0, cfMax: 0, autonav: null, pilot: 1, sensor: 1, dp: 265 },
  { id: 'walkerSmall', cat: 'special', h: 4, ho: 4, body: 1, armor: 0, cf: 0, cfMax: 4, autonav: null, pilot: 1, sensor: 1, dp: 165 },
  { id: 'walkerLarge', cat: 'special', h: 4, ho: 4, body: 2, armor: 0, cf: 1, cfMax: 10, autonav: null, pilot: 1, sensor: 1, dp: 240 },
];
