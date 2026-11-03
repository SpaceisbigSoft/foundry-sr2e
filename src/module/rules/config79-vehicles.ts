/**
 * v0.79.0 (vehicles): v0.79.0 verified fixes: the system differed from the official SR2 rules, each backed by an
 * official source (a Rigger 2 table or an SR2 /
 * Rigger 2 page). Read through RULES.DOCS_V79. Every behaviour change is a house-rule
 * switch: the first choice is the book's way (the default), the other puts the old behaviour back. Rules without an
 * official source are not here: they are in the alternate ruleset (v0.80.0; see
 * docs/VERIFY.md, "Verified fixes").
 *
 * - vehImpact: the Impact Damage Levels table, by vehicle speed (m/turn): 1–20 L, 21–60 M, 61–200 S, 201+ D (`table`:
 *   the highest speed of each band; above the last, `above`). Source: Rigger 2, Impact Damage Levels
 *   table.
 * - vehCrashLevel: 'speed' — a crashing vehicle takes the crash Power at the table's level for its speed; 'fixed': the
 *   old fixed RULES.VEHICLES.crash.vehicleLevel (S). The Power (speed ÷ 10) and the passengers' level are unchanged.
 *   Source: Rigger 2 Impact Damage Levels table.
 * - vehRamLevel: 'speed' — a ram's damage level comes from the table at the rammer's current speed, and the rammer
 *   takes its share at the same level; 'half': the old M (S above half the vehicle's Speed), the rammer one level
 *   lower. The Power (Body + speed ÷ 10) is unchanged. Source: Rigger 2 Impact Damage Levels
 *   table.
 * - vehMountRecoil: 'rigger2' — fixed and turret mounts halve the uncompensated recoil (`fixedTurretFactor`, round
 *   down) before recoil compensation; a pintle mount gives `pintleComp` (2) and a ring mount `ringComp` (6) points of
 *   recoil compensation; 'old': fixed and turret mounts ignore recoil (RULES.VEHICLES.mountedIgnoreRecoil), pintles
 *   get nothing. Source: Rigger 2 p131. Halving
 *   rounds down.
 * - vehSensorTable: 'rigger2' — the sensor test dialog offers the Sensor Test Modifiers table's rows the system
 *   didn't have (`rows`: direct LOS −2, urban +1, fog/smog/precipitation +1, restricted terrain +1, tight terrain +2;
 *   concealed by a spirit + its Force); 'off': not offered (old). ECM/ECCM and vehicle damage were already counted.
 *   Source: Rigger 2 Sensor Test Modifiers table.
 * - vehSeg: the sensor-enhanced gunnery numbers for RULES.VEHICLES_V57.sensorGunnery 'rigger2' (the existing switch,
 *   new default): Gunnery (a drone on its own: Pilot) + Sensor ÷ `sensorDivisor` (round down) dice vs the target's
 *   Signature in place of the range TN, + the target's ECM beyond the firer's ECCM, + the Sensor-Enhanced Targeting
 *   Modifiers table's rows (`rows`: urban +2, direct LOS −3, interrupted LOS 0); recoil and damage as usual; the
 *   firing/target movement modifiers don't apply. Source: Rigger 2 Sensor-Enhanced Targeting Modifiers
 *   table.
 * - vehRepair: 'rigger2' — a vehicle repair test with any success fixes all the damage (and the shot-out parts); the
 *   work takes `hoursPerBox` (16) hours per box (a part counts as a box) ÷ the successes; 'perSuccess': the old
 *   RULES.SKILLS.vehicleRepair boxes per success at hoursPerBox each (and RULES.FIXES_V71.vehicleRepair). Source:
 *   Rigger 2 p26.
 *
 * Also in v0.79.0 (plain values, in config.ts): over the vehicle's Speed rating is +1 on driving tests (was +2);
 * Rigger 2 Positioning, Accelerate/Brake and Ramming Target Modifiers tables.
 */
export const DOCS_V79_VEHICLES = {
  vehImpact: {
    table: [
      { max: 20, level: 'L' },
      { max: 60, level: 'M' },
      { max: 200, level: 'S' },
    ] as ReadonlyArray<{ max: number; level: 'L' | 'M' | 'S' | 'D' }>,
    above: 'D' as 'L' | 'M' | 'S' | 'D',
  },
  vehCrashLevel: 'speed' as 'speed' | 'fixed',
  vehRamLevel: 'speed' as 'speed' | 'half',
  vehMountRecoil: {
    mode: 'rigger2' as 'rigger2' | 'old',
    fixedTurretFactor: 0.5,
    pintleComp: 2,
    ringComp: 6,
  },
  vehSensorTable: {
    mode: 'rigger2' as 'rigger2' | 'off',
    rows: [
      { id: 'directLos', label: 'Direct line of sight', value: -2 },
      { id: 'urban', label: 'Urban setting', value: 1 },
      { id: 'fog', label: 'Fog / smog / precipitation', value: 1 },
      { id: 'restricted', label: 'Restricted terrain', value: 1 },
      { id: 'tight', label: 'Tight terrain', value: 2 },
    ] as ReadonlyArray<{ id: string; label: string; value: number }>,
    /** Concealed by a spirit: + the spirit's Force. */
    spiritLabel: 'Concealed by a spirit',
  },
  vehSeg: {
    sensorDivisor: 2,
    rows: [
      { id: 'urban', label: 'Urban environment', value: 2 },
      { id: 'directLos', label: 'Direct line of sight', value: -3 },
      { id: 'interruptedLos', label: 'Interrupted line of sight', value: 0 },
    ] as ReadonlyArray<{ id: string; label: string; value: number }>,
  },
  vehRepair: {
    mode: 'rigger2' as 'rigger2' | 'perSuccess',
    hoursPerBox: 16,
  },
};
