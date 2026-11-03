/**
 * v0.79.0 (melee_vision): the visibility table, Perception sight rows and melee reach, where the system differed
 * from the official SR2 rules, each backed by an SRII table. Read through
 * RULES.DOCS_V79. Every switch: the first choice is the book's way (the default), the other the old way.
 *
 * - visionCyberNatural: 'split' — low-light and thermographic vision have a cybernetic and a natural column
 *   (`visionTable`): low-light cyber / natural partial +1 / 0, minimal +4 / +2, darkness +8 / +8; thermographic
 *   partial +2 / +1, minimal +4 / +2, darkness +4 / +2. Natural = metatype, adept Improved Senses, bioware, the
 *   actor's own vision flags (critters); cyber = cybereyes, worn vision gear, a weapon scope, a vehicle's sensors.
 *   Vision whose source isn't known counts as cybernetic. 'single': the old one column (RULES.COMBAT.vision).
 *   Glare (normal +2, low-light +4 / +2, thermographic +4 / +2) and mist (+2, low-light +2 / 0, thermographic 0)
 *   are new conditions from the same table (both ways; under 'single' the natural column).
 *   source: SR2 Core Rules p. 89, Visibility Table.
 * - visionSmokeRows: 'book' — light smoke +4 (low-light +4 / +2, thermographic 0), heavy smoke +6 (low-light
 *   +6 / +4, thermographic +1 / 0); thermal smoke as smoke for normal and low-light eyes, as the Normal column for
 *   thermographic (`visionSmokeTable`); the smoke kinds 'heavySmoke' and 'heavyThermal' are new. 'old': RULES.COMBAT.smoke
 *   (no heavy smoke: it counts as smoke; one low-light column).
 *   source: SR2 Core Rules p. 89, Visibility Table.
 * - visionWeatherFold: 'smoke' — rain and fog are the table's smoke rows (`visionWeatherAs`): light rain and fog as
 *   light smoke (+4), heavy rain and thick fog as heavy smoke (+6), mist as mist (+2); snow and storm aren't in the
 *   table and keep their RULES.HEALTH.weather numbers; the driving and movement columns don't change. 'own': the old
 *   weather table (RULES.HEALTH.weather). source: SR2 Core Rules p. 89, Visibility Table ("Light/Heavy Smoke/Fog/Rain",
 *   "Mist").
 * - meleeReachShorter: 'both' — the side with the longer reach gets −1 per point on its own test AND the side with
 *   the shorter reach +1 per point on its own (RULES.COMBAT.melee.reachTnPerPoint each); 'longer': only the longer
 *   side's −1 (old). Only with RULES.COMBAT.reach.appliesTo 'longer' (the 'defender' house rule is unchanged).
 *   source: SR2 Core Rules, Melee Modifiers Table ("+1/point shorter").
 * - perceptionSightBook: 'book' — the Perception test's sight rows are the book's (`perceptionSightRows`): very
 *   small object +6, object partially hidden +2, object brightly colored −2, action very obvious −4, action not
 *   obvious +4; they stack (each row once). The old obviousness ids still work (`alias`: same numbers). 'scale':
 *   the old one-choice obviousness scale (RULES.CHARACTERS_V58.notice.obviousness).
 *   source: SR2 Core Rules p. 185, Perception Test Modifiers Table.
 *
 * Also in v0.79.0 for this area (plain values in config.ts, the old value in a comment): normal vision in minimal
 * light +6 (COMBAT.vision.normal.minimal and RULES.VISIBILITY; was +4); the Perception success table's four levels
 * (CHARACTERS_V58.notice.reveals; SR2 Core Rules p. 185 Perception tables); a Mist weather row;
 * superior position in melee on by default with −1 for the holder only (COMBAT_V61.superiorPosition: enabled true,
 * against 0; was off, +1; SR2 Core Rules Melee Modifiers Table).
 */
export type V79Light = 'normal' | 'partial' | 'minimal' | 'darkness' | 'glare' | 'mist';
type Row = Record<V79Light, number>;
type SmokeRow = { normal: number; lowLight: { cyber: number; natural: number }; thermographic: { cyber: number; natural: number } };

export const DOCS_V79_MELEE_VISION = {
  visionCyberNatural: 'split' as 'split' | 'single',
  visionTable: {
    /** The Normal column for the new conditions; the light levels stay in RULES.COMBAT.vision.normal. */
    normal: { glare: 2, mist: 2 } as Record<'glare' | 'mist', number>,
    lowLight: {
      cyber: { normal: 0, partial: 1, minimal: 4, darkness: 8, glare: 4, mist: 2 } as Row,
      natural: { normal: 0, partial: 0, minimal: 2, darkness: 8, glare: 2, mist: 0 } as Row,
    },
    thermographic: {
      cyber: { normal: 0, partial: 2, minimal: 4, darkness: 4, glare: 4, mist: 0 } as Row,
      natural: { normal: 0, partial: 1, minimal: 2, darkness: 2, glare: 2, mist: 0 } as Row,
    },
  },
  visionSmokeRows: 'book' as 'book' | 'old',
  visionSmokeTable: {
    smoke: { normal: 4, lowLight: { cyber: 4, natural: 2 }, thermographic: { cyber: 0, natural: 0 } },
    heavySmoke: { normal: 6, lowLight: { cyber: 6, natural: 4 }, thermographic: { cyber: 1, natural: 0 } },
    /** Thermal smoke: as smoke for normal and low-light eyes; thermographic eyes use the Normal column. */
    thermal: { normal: 4, lowLight: { cyber: 4, natural: 2 }, thermographic: { cyber: 4, natural: 4 } },
    heavyThermal: { normal: 6, lowLight: { cyber: 6, natural: 4 }, thermographic: { cyber: 6, natural: 6 } },
  } as Record<'smoke' | 'heavySmoke' | 'thermal' | 'heavyThermal', SmokeRow>,
  visionWeatherFold: 'smoke' as 'smoke' | 'own',
  /** Weather ids read as a smoke row or the mist condition; ids not listed keep RULES.HEALTH.weather. */
  visionWeatherAs: { lightRain: 'smoke', heavyRain: 'heavySmoke', fog: 'smoke', heavyFog: 'heavySmoke', mist: 'mist' } as Record<string, 'smoke' | 'heavySmoke' | 'mist'>,
  meleeReachShorter: 'both' as 'both' | 'longer',
  perceptionSightBook: 'book' as 'book' | 'scale',
  perceptionSightRows: [
    { id: 'veryObvious', label: 'Action very obvious', value: -4 },
    { id: 'brightlyColored', label: 'Object brightly colored', value: -2, alias: 'obvious' },
    { id: 'normal', label: 'Normal', value: 0 },
    { id: 'partlyHidden', label: 'Object partially hidden', value: 2, alias: 'inconspicuous' },
    { id: 'notObvious', label: 'Action not obvious', value: 4, alias: 'hidden' },
    { id: 'verySmall', label: 'Very small object', value: 6, alias: 'wellHidden' },
  ] as ReadonlyArray<{ id: string; label: string; value: number; alias?: string }>,
};
