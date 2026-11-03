/**
 * v0.80.0, the "SR2E Unified Rules Revamp" rules source (area: vehicles). Read through RULES.URR_V80; the GM picks the
 * source in the world setting "Rules source" (settings.ts). Two exports:
 * - URR_V80_VEHICLES: this area's new switches and numbers. Their shipped values are the SR2E Book Rules (the mode off),
 *   so nothing changes unless the GM picks the Unified Rules Revamp.
 * - URR80_PATCH_VEHICLES: RULES paths → the value the Unified Rules Revamp uses (existing paths, or 'URR_V80.<key>').
 *   Applied under the GM's own house rules, which still win.
 * Source: the Unified Rule Revamp (URR v1.2), cited as "URR" below; a rule marked "house rule for the Revamp"
 * is not in the URR.
 *
 * The switches (pure side in rules/urr80-vehicles.ts):
 * - vehCpCap: Control Pool dice on a driving test (driving, crash, push, ram, evasive driving) at most the driving skill
 *   rolled. Revamp 'skill'; book 'none' (any dice up to the pool left). Source: URR (Control Pool). The pool on
 *   a vehicle's damage resistance has no cap (URR text; its tables print the skill cap).
 * - vehCpGunnery: who rolls which pool on a mounted weapon fired by its jumped-in driver. Revamp 'combat' (Gunnery +
 *   Combat Pool, the pool at most the skill as for any attack); book 'control' (Gunnery + Control Pool). Source: URR
 *   (Control Pool). (Security riggers are left to the security rules.)
 * - vehCpResist: the jumped-in rigger adds Control Pool dice to the vehicle's damage resistance (Body + pool). Revamp
 *   true; book false (no pool). Source: URR (Control Pool).
 * - vehFeedback: rigger feedback. Revamp 'urr': only a hit the vehicle takes at Serious (6M) or Deadly (6S), resisted
 *   like normal damage (Body, Physical); book 'book': every level, Willpower vs the Power, Stun (RULES.RIGGING.feedback).
 *   Source: URR.
 * - vehDamage: weapon damage to vehicles. Revamp 'urr': the Power drops by Body + Armor (at least `minPower` when armor
 *   didn't stop it); a base Power not above the armor does nothing; anti-vehicle and armor-piercing rounds halve the
 *   armor (round down); the level is staged down automatically by Body (`autoStage`), anti-vehicle rounds skip that, a
 *   base Power of `highPower` or more skips one step; staged below Light, no damage. Combat spells: Power − half the
 *   armor, no automatic staging, always a test. Impacts (crashes, rams): TN = Power, armor doesn't count. Book 'book':
 *   normal weapons ×0.5 Power and one level down; armor at or above the Power stops it; TN = Power − Armor. Source: URR.
 * - vehPassengers: Revamp 'urr': a weapon hit on the vehicle doesn't reach the people aboard (they are hit only when
 *   targeted); an impact does, at the vehicle's level and Power; a crash hits them at the vehicle's level. Book 'book':
 *   every hit carries through at Power − Armor, a level lower; crash passengers at RULES.VEHICLES.crash.passengerLevel.
 *   Source: URR.
 * - vehOccupantArmor: shooting someone inside a vehicle. Revamp 'higher': the vehicle's Body or Armor, the higher, adds
 *   to the passenger's armor; book 'book': its Armor. Source: house rule for the
 *   Revamp (not in the URR, which says "Body or Armor").
 * - vehImpact: Revamp 'urr': impact Power rounds up (crash: speed ÷ 10); a ram's Power is the ramming speed ÷ 10
 *   (round up; in a chase between the two, the difference of their speeds), not Body + speed ÷ 10, and the rammer takes
 *   the same Power less its Body + half its Armor (round down), at the same level. Book 'book': rounded down, Body +
 *   speed ÷ 10, the rammer half the Power (RULES.VEHICLES.ram). Source: URR.
 * - vehDamageSpeed: Revamp 'urr': a vehicle at Moderate damage has `moderate` × its Speed, at Serious `serious` ×
 *   (round down); book 'book': no change. Source: house rule for the Revamp (not in the
 *   URR, which says only that speed reductions apply).
 * - vehGunnery: manual gunnery (a mounted weapon, not sensor-enhanced). Revamp 'urr': against a target in (or that is)
 *   a vehicle, the speed difference replaces the moving-vehicle modifiers: roughly equal (ratio up to `equalRatio`) 0,
 *   up to 2× +2, up to 4× +4, more +6; and the target's size: `sizes` by vehicle category, a drone `drone`, a person 0.
 *   Book 'book': firing from a moving vehicle +1 (+2 above half Speed), target moving +1, no size. Source: URR (vehicle
 *   gunnery). The category mapping and `equalRatio` are this system's reading (the URR names kinds of
 *   vehicles and say "roughly equal").
 * - vehMountHeavy: Revamp 'ignore': a heavy weapon's recoil isn't doubled on a vehicle mount; book 'book': doubled
 *   after the mount. Source: URR.
 * - vehRepairTn: Revamp 'stage': the repair test's TN by the worst damage on it (`tn` L/M/S/D); book 'book': the flat
 *   RULES.SKILLS.vehicleRepair.tn. Source: URR (repair).
 *
 * Patched existing values (see URR80_PATCH_VEHICLES): open terrain −2 (URR); the driving test rows (house rule for the Revamp, not in the URR, from the SR2 driving table:
 * non-stressful −1, stressful +3, large / very large vehicle +2 / +3, during combat +2, non-rigger by datajack −1; the
 * URR's congested +2 / heavily congested +4, maneuver score ahead / behind, extra opposing vehicle +1); the sensor test
 * table's "target in the open" −1 (URR); no Control Pool on sensor tests (URR); a sensor test (target
 * lock) is a Complex Action (URR); a guided missile needs a sensor lock (URR); a turret takes a hardpoint (house
 * rule for the Revamp, not in the URR); people in seats don't count against Load (house rule for the Revamp, not in
 * the URR).
 */
export const URR_V80_VEHICLES = {
  vehCpCap: 'none' as 'none' | 'skill',
  vehCpGunnery: 'control' as 'control' | 'combat',
  vehCpResist: false as boolean,
  vehFeedback: {
    mode: 'book' as 'book' | 'urr',
    serious: { tn: 6, level: 'M' as 'L' | 'M' | 'S' | 'D' },
    deadly: { tn: 6, level: 'S' as 'L' | 'M' | 'S' | 'D' },
    type: 'physical' as 'physical' | 'stun',
    attribute: 'body' as 'body' | 'willpower',
  },
  vehDamage: {
    mode: 'book' as 'book' | 'urr',
    minPower: 2,
    /** Automatic staging down by the vehicle's Body: up to `maxBody` → `steps`; above the last, `above`. */
    autoStage: [
      { maxBody: 2, steps: 1 },
      { maxBody: 5, steps: 2 },
      { maxBody: 8, steps: 3 },
    ] as ReadonlyArray<{ maxBody: number; steps: number }>,
    autoStageAbove: 4,
    highPower: 10,
    armorFactor: 0.5,
  },
  vehPassengers: 'book' as 'book' | 'urr',
  vehOccupantArmor: 'book' as 'book' | 'higher',
  vehImpact: 'book' as 'book' | 'urr',
  vehDamageSpeed: { mode: 'book' as 'book' | 'urr', moderate: 0.75, serious: 0.5 },
  vehGunnery: {
    mode: 'book' as 'book' | 'urr',
    equalRatio: 1.25,
    steps: [{ upTo: 2, value: 2 }, { upTo: 4, value: 4 }] as ReadonlyArray<{ upTo: number; value: number }>,
    above: 6,
    sizes: {
      bike: 0, car: -1, truck: -1, hovercraft: -1, boat: -1, ship: -3, rotor: -2, fixedWing: -2, vectorThrust: -2, lta: -6, other: 0,
    } as Record<string, number>,
    drone: 1,
  },
  vehMountHeavy: 'book' as 'book' | 'ignore',
  vehRepairTn: { mode: 'book' as 'book' | 'stage', tn: { L: 2, M: 4, S: 6, D: 8 } as Record<'L' | 'M' | 'S' | 'D', number> },
};

/** The book driving rows (RULES.VEHICLES.drivingModifiers), relabelled and extended for the Revamp. */
const DRIVING_ROWS = [
  { id: 'easy', label: 'Non-stressful situation', value: -1 },
  { id: 'hard', label: 'Stressful situation', value: 3 },
  { id: 'overSpeed', label: 'Above the vehicle\'s Speed', value: 1 },
  { id: 'unfamiliar', label: 'Unfamiliar vehicle', value: 1 },
  { id: 'poorVisibility', label: 'Poor visibility', value: 2 },
  { id: 'large', label: 'Large vehicle of its type', value: 2 },
  { id: 'veryLarge', label: 'Very large vehicle of its type', value: 3 },
  { id: 'inCombat', label: 'Driving during combat', value: 2 },
  { id: 'datajack', label: 'Non-rigger driving by datajack', value: -1 },
  { id: 'congested', label: 'Congested', value: 2 },
  { id: 'heavyCongested', label: 'Heavily congested', value: 4 },
  { id: 'ahead1', label: 'Maneuver: 1-2 net ahead', value: -1 },
  { id: 'ahead3', label: 'Maneuver: 3-4 net ahead', value: -2 },
  { id: 'ahead5', label: 'Maneuver: 5+ net ahead', value: -3 },
  { id: 'behind1', label: 'Maneuver: 1-2 net behind', value: 2 },
  { id: 'behind3', label: 'Maneuver: 3+ net behind', value: 4 },
  { id: 'opposing', label: 'Extra opposing vehicle', value: 1 },
];

export const URR80_PATCH_VEHICLES: Record<string, unknown> = {
  'URR_V80.vehCpCap': 'skill',
  'URR_V80.vehCpGunnery': 'combat',
  'URR_V80.vehCpResist': true,
  'URR_V80.vehFeedback.mode': 'urr',
  'URR_V80.vehDamage.mode': 'urr',
  'URR_V80.vehPassengers': 'urr',
  'URR_V80.vehOccupantArmor': 'higher',
  'URR_V80.vehImpact': 'urr',
  'URR_V80.vehDamageSpeed.mode': 'urr',
  'URR_V80.vehGunnery.mode': 'urr',
  'URR_V80.vehMountHeavy': 'ignore',
  'URR_V80.vehRepairTn.mode': 'stage',
  'VEHICLES.terrain': [
    { id: 'open', label: 'Open terrain', value: -2 },
    { id: 'normal', label: 'Normal terrain', value: 0 },
    { id: 'restricted', label: 'Restricted terrain', value: 1 },
    { id: 'tight', label: 'Tight terrain', value: 3 },
  ],
  'VEHICLES.drivingModifiers': DRIVING_ROWS,
  'VEHICLES.sensors.controlPool': false,
  'VEHICLES.cargo.personKg': 0,
  'DOCS_V79.vehSensorTable.rows': [
    { id: 'directLos', label: 'Direct line of sight', value: -2 },
    { id: 'open', label: 'Target in the open', value: -1 },
    { id: 'urban', label: 'Urban setting', value: 1 },
    { id: 'fog', label: 'Fog / smog / precipitation', value: 1 },
    { id: 'restricted', label: 'Restricted terrain', value: 1 },
    { id: 'tight', label: 'Tight terrain', value: 2 },
  ],
  'ACTIONS.costs.sensor': 'complex',
  'DRONES_V73.missiles.needsLock': true,
  'DRONES_V73.mounts.turretNeedsHard': true,
};
