/**
 * v0.79.0 (health): see config79.ts. Verified fixes: the system differed from the official SR2 rules, each
 * backed by an SRII healing table. Read
 * through RULES.DOCS_V79. Each behaviour change is a house-rule switch: the first choice is the book's way
 * (the default), the other puts the old behaviour back.
 *
 * - healing: 'stages' — Physical damage heals in stages, one wound level per stage: Body vs the Healing Table TN
 *   (`healingStages.tnByLevel`, Light 4 / Moderate 6 / Serious 8 / Deadly 10) + doctoring modifiers; the stage
 *   takes the base time (24 h / 10 d / 20 d / 30 d) ÷ successes, never less than the minimum (2 h / 1 d / 2 d /
 *   3 d); at its end the damage drops to the lowest box of the next level down (Light heals to 0). One test per
 *   stage. Stun keeps the old per-box healing. 'boxes': the old way (Body vs L2/M4/S6/D8, 24 h per box ÷
 *   successes, every box that fits the hours rested). Source: SRII Healing Table.
 * - healingGate: 'selfTest' — before a Physical wound starts healing, a self-recovery test: natural Body vs the
 *   Wound Table TN (`healingGateTn`, Light 2 / Moderate 4 / Serious 6), no modifiers of any kind; no successes =
 *   the patient needs medical attention (any care but 'none') before a healing stage can be rolled. The table
 *   stops at Serious: a Deadly wound always needs medical attention (the Healing Table's minimum lifestyle for
 *   Deadly is "Hospitalized"). Only with healing 'stages'. 'none': no gate (old). Source: SRII
 *   Wound Table; SRII Healing Table for Deadly.
 * - doctoring: 'table' — the healing-stage TN takes the book's Doctoring Table when a doctor is involved (any care
 *   but 'none'): intensive care −2, long-term magical care −2, one of not in hospital or clinic +2 / bad
 *   conditions +3 / terrible conditions +4, patient is a magician +2, the patient's natural Body and natural
 *   Willpower 1-3 / 4-6 / 7-9 / 10+ = 0 / −1 / −2 / −3 each. 'care': the old RULES.HEALING.natural.care rows and
 *   lifestyle home care (RULES.HEALTH.homeCare). Source: SRII Doctoring
 *   Table.
 * - firstAidMods: 'table' — first aid rolls Biotech dice only (a medkit adds no dice); its TN takes the book's
 *   First Aid Table modifiers: no medkit +4, bad conditions +1 / terrible +3, patient is a magician +2, the
 *   patient's natural Body 1-3 / 4-6 / 7-9 / 10+ = 0 / −1 / −2 / −3. 'medkitDice': the old way (medkit rating as
 *   dice, no table modifiers). Source: SRII First Aid Table.
 *
 * Also in v0.79.0 (plain value, config.ts): first aid TNs Light 4 / Moderate 6 / Serious 8 / Deadly 10
 * (RULES.HEALING.firstAid.tnByLevel; was 2 / 4 / 6 / 8). Source: SRII First Aid Table.
 *
 * Not done here (no official source: the v0.80.0 alternate ruleset, see
 * docs/VERIFY.md, "Verified fixes"): Stun overflow 1:1, trauma patch Body test, Stun recovery TN 2 + wound modifiers, first
 * aid lowering one level, bleed-out every 10 minutes, Magic loss on treatment without the +2.
 */
export const DOCS_V79_HEALTH = {
  healing: 'stages' as 'stages' | 'boxes',
  healingStages: {
    tnByLevel: { L: 4, M: 6, S: 8, D: 10 } as Record<'L' | 'M' | 'S' | 'D', number>,
    baseHours: { L: 24, M: 240, S: 480, D: 720 } as Record<'L' | 'M' | 'S' | 'D', number>,
    minHours: { L: 2, M: 24, S: 48, D: 72 } as Record<'L' | 'M' | 'S' | 'D', number>,
  },
  healingGate: 'selfTest' as 'selfTest' | 'none',
  /** SRII Wound Table: no Deadly row; a Deadly wound needs medical attention without a test. */
  healingGateTn: { L: 2, M: 4, S: 6 } as Record<'L' | 'M' | 'S', number>,
  doctoring: 'table' as 'table' | 'care',
  doctoringTable: {
    intensive: -2,
    magicalCare: -2,
    /** "Conditions (only one applies)", by the rest dialog's care id; 'none' = no doctor, no doctoring modifiers. */
    conditions: { medkit: 2, home: 2, hospital: 0, intensive: 0, poor: 3, terrible: 4 } as Record<string, number>,
    magician: 2,
    /** Natural Body and natural Willpower each: [at least, modifier], highest first. */
    attributeSteps: [[10, -3], [7, -2], [4, -1]] as ReadonlyArray<readonly [number, number]>,
  },
  firstAidMods: 'table' as 'table' | 'medkitDice',
  firstAidTable: {
    noMedkit: 4,
    conditions: { normal: 0, bad: 1, terrible: 3 } as Record<string, number>,
    magician: 2,
    bodySteps: [[10, -3], [7, -2], [4, -1]] as ReadonlyArray<readonly [number, number]>,
  },
};
