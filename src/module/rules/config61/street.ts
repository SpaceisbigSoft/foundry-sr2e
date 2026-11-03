/**
 * v0.61.0 street / paperwork rule values (VERIFY: all from memory, none checked against the book).
 * Read through RULES.STREET_V61 (rules/paperwork.ts); house rules may override any key.
 *
 * - radio: radios carry a signal rating and an encryption rating. A jammer blocks a radio when its
 *   rating beats the signal (`jamBeats` 'greaterOrEqual' = ties jam, 'greater' = strictly more).
 *   Listening in on traffic is an `interceptSkill` test. `decryptTnFrom` picks the TN:
 *   'encryption' = the encryption rating itself, but never below `baseInterceptTn` (so an unencrypted
 *   link is just `baseInterceptTn`); 'base+encryption' = `baseInterceptTn` + the encryption rating.
 * - identity: fake SINs and licences against a checker (credstick reader, scanner, cop with a
 *   terminal). The checker rolls dice from `checkDiceFrom` (its rating) against a TN from `tnFrom`
 *   ('fakeRating' = the fake's rating; 'fixed' = `fixedTn`). `spottedOn` 'anySuccess' = one success
 *   spots the fake; 'netSuccess' = the checker must beat the forger's successes. A real ID always
 *   passes when `realAlwaysPasses`. `categoryCoversLower`: a licence for a stricter legality category
 *   (later in GEAR_V58.legality.categories) also covers milder permit categories.
 * - creation: spell points by Magic priority (`spellPointsByPriority`; adepts get none when
 *   `adeptGetsNone`); `nuyenPerSpellPoint` buys extra points from Resources (0 = can't buy more);
 *   `leftoverCash` after creation: 'keep' all, 'cap' at `cap`, or 'lose' it; `lifestyleOutright`:
 *   a lifestyle bought for good costs `months` × its monthly cost.
 * - starterSkills: a starting list of common active and Build/Repair skills with linked attributes
 *   (names follow RULES.SKILLS / statblock guessSkillAttribute; kind 'active' | 'buildRepair').
 * - workshop: the safehouse workshop's rating (absolute value of its Build/Repair TN modifier)
 *   counts as these CHARACTERS_V58.tools levels: the highest row whose `min` it reaches.
 */
export const STREET_V61 = {
  radio: {
    jamBeats: 'greaterOrEqual' as 'greaterOrEqual' | 'greater',
    interceptSkill: 'Electronics',
    decryptTnFrom: 'encryption' as 'encryption' | 'base+encryption',
    baseInterceptTn: 4,
  },
  identity: {
    checkDiceFrom: 'checkerRating' as 'checkerRating',
    tnFrom: 'fakeRating' as 'fakeRating' | 'fixed',
    fixedTn: 4,
    spottedOn: 'anySuccess' as 'anySuccess' | 'netSuccess',
    realAlwaysPasses: true,
    categoryCoversLower: true,
  },
  creation: {
    spellPointsByPriority: { A: 25, B: 25, C: 0, D: 0, E: 0 } as Record<string, number>,
    adeptGetsNone: true,
    nuyenPerSpellPoint: 0,
    leftoverCash: { mode: 'keep' as 'keep' | 'cap' | 'lose', cap: 5000 },
    lifestyleOutright: { months: 100 },
  },
  starterSkills: [
    { name: 'Firearms', attribute: 'quickness', kind: 'active' },
    { name: 'Gunnery', attribute: 'quickness', kind: 'active' },
    { name: 'Launch Weapons', attribute: 'quickness', kind: 'active' },
    { name: 'Throwing Weapons', attribute: 'quickness', kind: 'active' },
    { name: 'Projectile Weapons', attribute: 'quickness', kind: 'active' },
    { name: 'Armed Combat', attribute: 'strength', kind: 'active' },
    { name: 'Unarmed Combat', attribute: 'strength', kind: 'active' },
    { name: 'Stealth', attribute: 'quickness', kind: 'active' },
    // v0.71.0 (R4): Body in SR2 (was Quickness).
    { name: 'Athletics', attribute: 'body', kind: 'active' },
    { name: 'Etiquette', attribute: 'charisma', kind: 'active' },
    { name: 'Negotiation', attribute: 'charisma', kind: 'active' },
    { name: 'Leadership', attribute: 'charisma', kind: 'active' },
    { name: 'Interrogation', attribute: 'charisma', kind: 'active' },
    { name: 'Instruction', attribute: 'charisma', kind: 'active' },
    { name: 'Car', attribute: 'reaction', kind: 'active' },
    { name: 'Bike', attribute: 'reaction', kind: 'active' },
    { name: 'Rotor Aircraft', attribute: 'reaction', kind: 'active' },
    { name: 'Computer', attribute: 'intelligence', kind: 'active' },
    { name: 'Electronics', attribute: 'intelligence', kind: 'active' },
    { name: 'Biotech', attribute: 'intelligence', kind: 'active' },
    { name: 'Demolitions', attribute: 'intelligence', kind: 'active' },
    { name: 'Sorcery', attribute: 'willpower', kind: 'active' },
    { name: 'Conjuring', attribute: 'willpower', kind: 'active' },
    { name: 'Car B/R', attribute: 'intelligence', kind: 'buildRepair' },
    { name: 'Bike B/R', attribute: 'intelligence', kind: 'buildRepair' },
    { name: 'Computer B/R', attribute: 'intelligence', kind: 'buildRepair' },
    { name: 'Electronics B/R', attribute: 'intelligence', kind: 'buildRepair' },
    { name: 'Firearms B/R', attribute: 'intelligence', kind: 'buildRepair' },
  ] as ReadonlyArray<{ name: string; attribute: string; kind: 'active' | 'buildRepair' }>,
  workshop: {
    levelAt: [
      { min: 1, level: 'shop' },
      { min: 3, level: 'facility' },
    ] as ReadonlyArray<{ min: number; level: string }>,
  },
} as const;
