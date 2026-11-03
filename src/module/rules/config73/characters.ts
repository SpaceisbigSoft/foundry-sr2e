/**
 * v0.73.0 characters, skills, the street and NPCs (docs/REVIEW-v0.69.md, section 3, O29–O38). Read through
 * RULES.CHARACTERS_V73 (the pure functions in rules/charfix.ts read `(RULES as any).CHARACTERS_V73 ?? CHARACTERS_V73`,
 * so put this object into RULES by reference and a house rule that writes RULES.CHARACTERS_V73.… changes what they
 * read). Every fix has a switch that puts the old behaviour back; numbers recalled from memory are marked VERIFY.
 * Deliberately NOT `as const` at the top level, so house rules can write it.
 *
 * - rollMemory (O29): the skill dialog remembers only `skillFields` (Use specialization / concentration). The
 *   complementary skill is a separate, deliberate test, so it is not remembered unless `rememberComplementary`
 *   (true = the old way: every later roll of that skill quietly rolls the complementary test again).
 * - negotiation (O30): `useOpposedAttribute`: the opposed Negotiation test (negotiating pay) takes its TNs from
 *   RULES.CHARACTERS_V58.negotiation.opposedAttribute (the house-rule key that nothing read). false = the old way
 *   (RULES.SOCIAL.skills.Negotiation, Charisma). VERIFY which attribute SR2 uses.
 * - lifestyle (O31): `outrightPermanent`: a lifestyle bought outright is owned for good (system.lifestyle.outright):
 *   never overdue, never lapses (false = the old way: STREET_V61.creation.lifestyleOutright.months paid ahead).
 *   `buyLater`: the Pay dialog offers "Buy outright" after creation, at the same price as at creation
 *   (STREET_V61.creation.lifestyleOutright.months × the monthly cost). `creditPaidMonths`: whole months already paid
 *   ahead come off that price. `keepOnLevelChange`: changing the lifestyle level keeps the outright flag (false:
 *   a different lifestyle is a new rent, unpaid from now).
 * - training (O32): `keepSpecialization`: a new skill learned with training time keeps the specialization typed in
 *   the picker (named, rating 0 until trained with its own ⊕ once the skill is 1). false = the old way (dropped).
 * - skillCost (O33): `agree`: the skill picker and Spend Karma price a skill's Karma band from the same linked
 *   attribute rating: `basis` 'natural' (Reaction = (natural Quickness + natural Intelligence) / 2, as improve()
 *   always did) or 'augmented' (totals and derived Reaction). false = the old way (the picker: derived Reaction,
 *   improve(): natural). VERIFY which one SR2 means (natural is my reading).
 * - racialFloor (O34): racial modifiers can't take an attribute below `min`. `mode` 'floor': the natural rating
 *   is at least `min` and the build check fails until the base is bought high enough; 'warn': only the build
 *   check and a sheet warning; 'off': the old way (it can reach 0, no warning). VERIFY.
 * - npcs (O35): `threatRating`: the generator sets system.threatRating from `threatRatings[Threat Level]`.
 *   `professionalRatings[Threat Level]` replaces NPCGEN.threat[].professionalRating (SR2's 1–4 scale; level 0 no
 *   longer fails every morale test) when `professionalFromTable` is false. `karmaPool`: 'none' (SR2 grunts have no
 *   Karma Pool), 'singles' (only an NPC that isn't a grunt group keeps the table's pool) or 'all' (the old way).
 *   `handMadeKarmaPool`: the Karma Pool a hand-made NPC starts with (the shared schema gives 1; null = leave it).
 *   VERIFY all of these (SR2 Gamemastering: Threat Rating and Professional Rating).
 * - metatypes (O36): `open`: system.metatype has no fixed choices, so house-rule metatypes (RULES.METATYPES.types
 *   in Advanced JSON) validate; an unknown id reads as Human (`metatype()` already does) and is kept on the sheet as
 *   "(not in the metatype list)". false = the lists are built at load (the old way; the schema choice can only
 *   come back by editing the model).
 * - skillNames (O37): `canonical`: one name per skill. The picker, the starter list and the NPC generator use the
 *   vehicle tests' names (RULES.VEHICLES.categories[].skill), and a skill saved under an old alias still matches.
 *   `aliases`: lower-case alias → the name used. false = the old names, matched exactly.
 * - qualities (O38, Shadowrun Companion, VERIFY): `exceptionalAttribute`: an edge whose name matches `match`
 *   (case-insensitive) with an attribute as its target raises that attribute's racial (natural) maximum by `perLevel`
 *   per level (`pointsPerLevel` points a level, 0 = every such edge is one level; at most `maxLevels`), and so its augmented
 *   maximum. Needs RULES.STREET.qualities.enabled. `surplusFlaws` (house rule, off by default): flaw points beyond
 *   the edges' points count toward creation: `use` 'none' (the old way), 'attributes' or 'skills' (points per flaw
 *   point: `perPoint`), or 'nuyen' (`nuyenPerPoint` each), at most `maxPoints` points.
 *   `karmaAboveRacial` (off by default; I think this is SR3's rule, not SR2's): an attribute may be raised with Karma
 *   past its natural maximum up to the augmented maximum (`upTo` 'augmented') at new rating × `multiplier`.
 */
export const CHARACTERS_V73 = {
  rollMemory: {
    skillFields: ['useSpec', 'useConc'] as string[],
    rememberComplementary: false,
  },
  negotiation: {
    useOpposedAttribute: true,
  },
  lifestyle: {
    outrightPermanent: true,
    buyLater: true,
    creditPaidMonths: false,
    keepOnLevelChange: false,
  },
  training: {
    keepSpecialization: true,
  },
  skillCost: {
    agree: true,
    basis: 'natural' as 'natural' | 'augmented',
  },
  racialFloor: {
    mode: 'floor' as 'floor' | 'warn' | 'off',
    min: 1,
  },
  npcs: {
    threatRating: true,
    /** By Threat Level 0–5. VERIFY */
    threatRatings: [0, 1, 2, 3, 4, 5] as number[],
    professionalFromTable: false,
    /** By Threat Level 0–5 (SR2: 1–4). VERIFY */
    professionalRatings: [1, 1, 2, 3, 4, 4] as number[],
    karmaPool: 'none' as 'none' | 'singles' | 'all',
    handMadeKarmaPool: 0 as number | null,
  },
  metatypes: {
    open: true,
  },
  skillNames: {
    canonical: true,
    aliases: {
      'rotorcraft': 'Rotor Aircraft',
      'rotor-craft': 'Rotor Aircraft',
      'vectored thrust': 'Vector Thrust Aircraft',
      'vectored thrust aircraft': 'Vector Thrust Aircraft',
      'vectored-thrust aircraft': 'Vector Thrust Aircraft',
      'vector thrust': 'Vector Thrust Aircraft',
      'fixed wing aircraft': 'Fixed-Wing Aircraft',
      'fixed-wing': 'Fixed-Wing Aircraft',
    } as Record<string, string>,
  },
  qualities: {
    exceptionalAttribute: {
      enabled: true,
      match: 'exceptional attribute',
      perLevel: 1,
      pointsPerLevel: 0,
      maxLevels: 1,
    },
    surplusFlaws: {
      use: 'none' as 'none' | 'attributes' | 'skills' | 'nuyen',
      perPoint: 1,
      nuyenPerPoint: 5000,
      maxPoints: 6,
    },
    karmaAboveRacial: {
      enabled: false,
      upTo: 'augmented' as 'augmented',
      multiplier: 3,
    },
  },
};
