/**
 * v0.61.0 rule values (VERIFY: from memory). Read through RULES.SECURITY_V61; house rules can
 * override any of them. No rulebook text: generic table conveniences.
 *
 * - sheafIc: a security sheaf step can launch IC. `autoLaunch`: launch a triggered step's IC
 *   without the GM pressing a button (each step once until the tally is reset). `parseEventText`:
 *   a step without structured IC is read from its event text ("Killer-6 IC", "Tar Baby", "Black IC
 *   8"). `maxCopies`: most copies one step launches. `defaultDamageLevel`: when a step names none.
 *   `blackDamageType`: lethal black IC hits this track (text saying "non-lethal" or "stun" → stun).
 *   `categories`: which IC behaviors are black or gray IC (everything else is white).
 * - gas: security devices of kind 'gas' release a toxin when the site goes into lockdown
 *   (`onLockdown`). `radiusMetres`: the cloud's radius for a new device (0 = its linked regions
 *   only). `defaultToxin`: the toxin when a device names none (a device's rating stands in for the
 *   Power). `cloud`: what the room's region also gets ('' = nothing, 'smoke' = vision-blocking).
 * - npc: the NPC generator's extras. `totems`: generic animal totems for shamanic NPCs (dice by
 *   spell category and conjuring, environment, berserk ('' / 'wounded' / 'combat'), extra TN in
 *   daylight). `riggerVehicles` / `riggerDrones`: how many vehicles and drones a rigger (or anyone
 *   with a control rig) owns, by Threat Level 0–5. `vehicles`: example vehicles and drones
 *   (category ids from RULES.VEHICLES.categories; `minThreat`: lowest Threat Level that owns one).
 */
export const SECURITY_V61 = {
  sheafIc: {
    autoLaunch: true,
    parseEventText: true,
    maxCopies: 4,
    defaultDamageLevel: 'M' as 'L' | 'M' | 'S' | 'D',
    blackDamageType: 'physical' as 'physical' | 'stun',
    categories: {
      black: ['psychotropic'] as ReadonlyArray<string>,
      gray: ['killer', 'blaster', 'sparky', 'tarBaby', 'tarPit', 'trace', 'crippler', 'ripper'] as ReadonlyArray<string>,
    },
  },
  gas: {
    onLockdown: true,
    radiusMetres: 5,
    defaultToxin: { name: 'Knockout gas', power: 6, level: 'S' as 'L' | 'M' | 'S' | 'D', damageType: 'stun' as 'physical' | 'stun', vector: 'inhalation', speed: 'turn' },
    cloud: 'smoke' as '' | 'smoke',
  },
  npc: {
    totems: [
      { name: 'Bear', combat: 0, detection: 0, health: 2, illusion: 0, manipulation: 0, conjuring: 2, environment: 'forest', inEnvironment: 0, outEnvironment: 0, spirits: 'forest', berserk: 'wounded', daylightTn: 0 },
      { name: 'Cat', combat: 0, detection: 0, health: 0, illusion: 2, manipulation: 0, conjuring: 2, environment: 'city', inEnvironment: 0, outEnvironment: 0, spirits: 'city', berserk: '', daylightTn: 0 },
      { name: 'Dog', combat: 0, detection: 2, health: 0, illusion: 0, manipulation: 0, conjuring: 2, environment: 'city, field', inEnvironment: 0, outEnvironment: 0, spirits: 'field, hearth', berserk: '', daylightTn: 0 },
      { name: 'Eagle', combat: 0, detection: 2, health: 0, illusion: 0, manipulation: 0, conjuring: 2, environment: 'mountain, wilderness', inEnvironment: 0, outEnvironment: 0, spirits: 'wind', berserk: '', daylightTn: 0 },
      { name: 'Owl', combat: 0, detection: 0, health: 0, illusion: 0, manipulation: 0, conjuring: 0, environment: 'night', inEnvironment: 2, outEnvironment: 0, spirits: '', berserk: '', daylightTn: 2 },
      { name: 'Rat', combat: -1, detection: 2, health: 0, illusion: 2, manipulation: 0, conjuring: 2, environment: 'city', inEnvironment: 0, outEnvironment: 0, spirits: 'city', berserk: '', daylightTn: 0 },
      { name: 'Raven', combat: -1, detection: 0, health: 0, illusion: 0, manipulation: 2, conjuring: 2, environment: 'sky', inEnvironment: 0, outEnvironment: 0, spirits: 'wind', berserk: '', daylightTn: 0 },
      { name: 'Shark', combat: 2, detection: 2, health: 0, illusion: 0, manipulation: 0, conjuring: 2, environment: 'sea', inEnvironment: 0, outEnvironment: 0, spirits: 'sea', berserk: 'wounded', daylightTn: 0 },
      { name: 'Snake', combat: -1, detection: 2, health: 2, illusion: 2, manipulation: 0, conjuring: 2, environment: '', inEnvironment: 0, outEnvironment: 0, spirits: '', berserk: '', daylightTn: 0 },
      { name: 'Wolf', combat: 2, detection: 2, health: 0, illusion: 0, manipulation: 0, conjuring: 2, environment: 'forest, prairie', inEnvironment: 0, outEnvironment: 0, spirits: 'forest, prairie', berserk: 'combat', daylightTn: 0 },
    ] as ReadonlyArray<{ name: string; combat: number; detection: number; health: number; illusion: number; manipulation: number; conjuring: number; environment: string; inEnvironment: number; outEnvironment: number; spirits: string; berserk: '' | 'wounded' | 'combat'; daylightTn: number }>,
    riggerVehicles: [0, 1, 1, 1, 2, 2] as ReadonlyArray<number>,
    riggerDrones: [0, 1, 2, 2, 3, 4] as ReadonlyArray<number>,
    vehicles: [
      { name: 'Motorbike', category: 'bike', drone: false, minThreat: 0, handling: 3, speed: 120, accel: 12, body: 2, armor: 0, signature: 4, autonav: 0, pilot: 0, sensor: 0 },
      { name: 'Compact car', category: 'car', drone: false, minThreat: 0, handling: 4, speed: 90, accel: 8, body: 2, armor: 0, signature: 3, autonav: 1, pilot: 0, sensor: 1 },
      { name: 'Sedan', category: 'car', drone: false, minThreat: 1, handling: 4, speed: 110, accel: 10, body: 3, armor: 0, signature: 2, autonav: 1, pilot: 0, sensor: 1 },
      { name: 'Van', category: 'truck', drone: false, minThreat: 1, handling: 5, speed: 90, accel: 6, body: 4, armor: 0, signature: 2, autonav: 1, pilot: 0, sensor: 1 },
      { name: 'Armoured van', category: 'truck', drone: false, minThreat: 3, handling: 5, speed: 90, accel: 6, body: 5, armor: 4, signature: 2, autonav: 2, pilot: 0, sensor: 2 },
      { name: 'Light helicopter', category: 'rotor', drone: false, minThreat: 4, handling: 4, speed: 200, accel: 15, body: 3, armor: 2, signature: 3, autonav: 2, pilot: 0, sensor: 3 },
      { name: 'Small drone', category: 'rotor', drone: true, minThreat: 0, handling: 3, speed: 60, accel: 10, body: 1, armor: 0, signature: 6, autonav: 0, pilot: 2, sensor: 2 },
      { name: 'Wheeled drone', category: 'car', drone: true, minThreat: 0, handling: 4, speed: 50, accel: 8, body: 2, armor: 0, signature: 5, autonav: 0, pilot: 2, sensor: 2 },
      { name: 'Surveillance drone', category: 'rotor', drone: true, minThreat: 2, handling: 3, speed: 80, accel: 10, body: 1, armor: 0, signature: 7, autonav: 0, pilot: 3, sensor: 4 },
      { name: 'Combat drone', category: 'car', drone: true, minThreat: 4, handling: 4, speed: 60, accel: 8, body: 3, armor: 3, signature: 5, autonav: 0, pilot: 3, sensor: 3 },
    ] as ReadonlyArray<{ name: string; category: string; drone: boolean; minThreat: number; handling: number; speed: number; accel: number; body: number; armor: number; signature: number; autonav: number; pilot: number; sensor: number }>,
  },
} as const;
