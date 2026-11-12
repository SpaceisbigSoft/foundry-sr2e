/**
 * v0.72.0 health, cyberware and bioware (docs/REVIEW-v0.69.md, section 3, O8–O12). Read through
 * RULES.HEALTH_V72 (the pure functions in rules/vitals.ts import this object directly, so a house rule that
 * writes RULES.HEALTH_V72.… changes what they read). Every fix has a switch that puts the old behaviour back;
 * numbers recalled from memory are marked VERIFY.
 *
 * - drugs (O8): `doses`: a dose of a drug that is still active 'refresh'es it (the effect runs for the longer
 *   of what is left and a new full duration; the bonuses don't add), 'extend's it (a full duration more on top
 *   of what is left), or 'stack's (the old way: another entry, its bonuses added again). `overdose`: a dose
 *   while one is still active is an overdose: resist it as a toxin (Body + toxin dice vs its Power, staged down
 *   by successes): Power = the drug's own toxin Power ('drug'), its crash Power ('crash'), or `basePower`
 *   ('fixed'), + `powerPerExtraDose` × the doses already active; level `level` ('' = the drug's level), staged
 *   up one per `stageUpEvery` doses already active (0 = never); damage `type`. VERIFY (SR2 core gives no
 *   general overdose rule that I can recall with confidence; this is close to the Companion / SR3 style).
 * - bioware (O9, Shadowtech, VERIFY): new bioware kinds. `kinds` go into the item's bioKind choices always
 *   (so a saved item stays valid when the switch is off); `enabled` gates what they do. `effects` are in the
 *   RULES.BIOWARE.effects shape (attributes, Reaction; bioEffect reads them). `vitals`, per rating:
 *   symbiotes `healingDice` on natural healing; nephritic screen `toxinDice` against toxins (and drug
 *   overdoses) whose vector is in `vectors`; extended volume `breathTurns` more Combat Turns of held breath
 *   before drowning or suffocation turns count. `bodyIndex`: per rating (array by rating, or a number × rating
 *   with `perRating`), for the statblock importer and the Add window. `lifestyleCost`: a suprathyroid's
 *   upkeep multiplier (shown only).
 * - reflexes (O10, Street Samurai Catalog / Shadowtech, VERIFY): `incompatible` pairs of reflex types that
 *   don't work together: `drop` gives no Reaction or dice while a working `with` is installed (reaction
 *   enhancers with boosted reflexes; wired reflexes are fine). Empty = the old way (they stack).
 * - qualities (O11, Shadowrun Companion, VERIFY): edges and flaws with health effects, matched by name
 *   (`match`, case-insensitive). With `needsQualitiesOn` they only work while RULES.STREET.qualities.enabled.
 *   Each level is `pointsPerLevel` points, at most `maxLevels`; a quality with 0 points counts as level 1.
 *   Will to Live: `boxesPerLevel` more Overflow boxes. High Pain Tolerance: `boxesPerLevel` boxes per track
 *   ignored for wound modifiers. Low Pain Tolerance: each damaged track counts `extraBoxes` more boxes for
 *   wound modifiers. Toughness: `dice` more dice to resist damage (`onStun`: Stun too; `onToxins`: toxins
 *   too). Sensitive System: cyberware Essence × `essenceMultiplier`, bioware Body Index × `bodyIndexMultiplier`,
 *   and (`rejectionAlways`) any bioware means rejection tests even under the Body Index limit, at TN
 *   RULES.BIOWARE.rejection.tn + `rejectionTnBonus`.
 * - hazards (O12, VERIFY, house numbers: SR2 core has heat only by analogy with cold): `heat` works like cold:
 *   Body vs the severity's TN, `level` `type` per test (fire immunity stops it when `fireImmune`). `electricity`:
 *   a shock by source: Power and level, Stun or Physical, armor `armorKind` × `armorFraction` (as stun weapons;
 *   insulation adds its rating), then (`shockEffect`) the elemental shock test (MAGIC_V39.shock: Body vs Power,
 *   failing loses initiative or stuns).
 */
export const HEALTH_V72 = {
  drugs: {
    doses: 'refresh' as 'refresh' | 'extend' | 'stack',
    overdose: {
      enabled: true,
      powerFrom: 'drug' as 'drug' | 'crash' | 'fixed',
      basePower: 6,
      powerPerExtraDose: 1,
      level: '' as '' | 'L' | 'M' | 'S' | 'D',
      stageUpEvery: 0,
      type: 'physical' as 'physical' | 'stun',
    },
  },
  bioware: {
    enabled: true,
    kinds: ['symbiotes', 'nephriticScreen', 'extendedVolume', 'suprathyroid'] as readonly string[],
    effects: {
      suprathyroid: { attributes: { body: 1, quickness: 1, strength: 1 }, reaction: 1, perRating: false },
    } as Record<string, { attributes?: Record<string, number>; reaction?: number; initiativeDice?: number; perRating?: boolean }>,
    vitals: {
      symbiotes: { healingDice: 1 },
      nephriticScreen: { toxinDice: 1, vectors: ['injection', 'ingestion'] as readonly string[] },
      extendedVolume: { breathTurns: 15 }, // v0.77.0 book check: +45 s per level (was 10 turns)
    },
    bodyIndex: {
      symbiotes: [0.4, 0.7, 1] as readonly number[],
      nephriticScreen: 0.4,
      extendedVolume: 0.2,
      suprathyroid: 0.7,
    } as Record<string, number | readonly number[]>,
    /** Which kinds' `bodyIndex` numbers are per rating point (else the number is flat). */
    perRating: ['extendedVolume'] as readonly string[],
    maxRating: { symbiotes: 3, nephriticScreen: 1, extendedVolume: 3, suprathyroid: 1 } as Record<string, number>,
    lifestyleCost: { suprathyroid: 1.2 } as Record<string, number>,
  },
  reflexes: {
    incompatible: [{ drop: 'enhancer', with: 'boosted' }] as ReadonlyArray<{ drop: string; with: string }>,
  },
  qualities: {
    enabled: true,
    needsQualitiesOn: true,
    willToLive: { match: ['will to live'] as readonly string[], pointsPerLevel: 1, maxLevels: 3, boxesPerLevel: 1 },
    highPainTolerance: { match: ['high pain tolerance', 'pain tolerance'] as readonly string[], pointsPerLevel: 1, maxLevels: 3, boxesPerLevel: 1 },
    lowPainTolerance: { match: ['low pain tolerance'] as readonly string[], extraBoxes: 1 },
    toughness: { match: ['toughness'] as readonly string[], dice: 1, onStun: true, onToxins: false },
    sensitiveSystem: { match: ['sensitive system'] as readonly string[], essenceMultiplier: 2,
      // v0.92.3 book check (Companion, Sensitive System): twice the Body Index (was 1), and no rejection rule (was true).
      bodyIndexMultiplier: 2, rejectionAlways: false, rejectionTnBonus: 0 },
  },
  hazards: {
    heat: {
      enabled: true,
      attribute: 'body' as 'body' | 'willpower',
      severities: [
        { id: 'warm', label: 'Warm', tn: 2 },
        { id: 'hot', label: 'Hot', tn: 4 },
        { id: 'searing', label: 'Searing (desert noon)', tn: 6 },
        { id: 'extreme', label: 'Extreme (furnace, burning building)', tn: 8 },
      ] as ReadonlyArray<{ id: string; label: string; tn: number }>,
      level: 'L' as 'L' | 'M' | 'S' | 'D',
      type: 'stun' as 'physical' | 'stun',
      fireImmune: true,
    },
    electricity: {
      enabled: true,
      sources: [
        { id: 'household', label: 'Household current', power: 6, level: 'M', type: 'stun' },
        { id: 'fence', label: 'Electrified fence', power: 8, level: 'S', type: 'stun' },
        { id: 'industrial', label: 'Industrial line', power: 10, level: 'S', type: 'physical' },
        { id: 'highVoltage', label: 'High-voltage line or third rail', power: 12, level: 'D', type: 'physical' },
      ] as ReadonlyArray<{ id: string; label: string; power: number; level: 'L' | 'M' | 'S' | 'D'; type: 'physical' | 'stun' }>,
      armorKind: 'impact' as 'impact' | 'ballistic',
      armorFraction: 0.5,
      shockEffect: true,
    },
  },
};
