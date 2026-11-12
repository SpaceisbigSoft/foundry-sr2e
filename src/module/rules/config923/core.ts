/**
 * v0.92.3 book alignment: Core mechanics and characters. Read through RULES.CORE_V923. Every value here was checked against the SR2 books
 * (book and page in each comment). Each switch's first choice is the book's way (the default); the other puts the
 * old v0.92.2 behaviour back. The pure functions are in rules/core923.ts.
 *
 * Creation
 * - priorities: 'book' — the Master Character Creation Table (Core p. 47): Attributes 30/24/20/17/15, Skills
 *   40/30/24/20/17, Resources 1,000,000 / 400,000 / 90,000 / 5,000 / 500¥ with Force Points 50/35/25/15/5 (magicians
 *   only, Core p. 47); a metahuman needs Race A (Core p. 45); Magic A a human magician, B a human adept or a metahuman
 *   magician, C a metahuman adept (Core p. 45). 'old': RULES.CREATION's table (race by metatype, Magic A full / B adept)
 *   and spell points by the Magic priority (RULES.STREET_V61.creation.spellPointsByPriority).
 * - moreMetahumans: the optional More Metahumans rule (Core p. 46): a metahuman needs Race C, Magic A full magician /
 *   B adept for every race, and metahumans start with the standard 1 Karma Pool point (Core p. 47). Off by default.
 * - racialMods: 'book' — the dwarf also has Quickness −1 and the troll Willpower −1 (Racial Modifications Table, Core
 *   p. 45; the Racial Maximum Table, Core p. 43: dwarf Q 5, troll W 5). 'old': without them. Under the Revamp's own
 *   maximums table (URR_V80.coreMetaMax) the old modifiers stay, as the Revamp sets those maximums itself.
 * - startPool: 'book' — a metahuman finishing the creation wizard starts with a Karma Pool of 2, a human 1 (Core p. 47;
 *   1 for everyone with moreMetahumans). 'old': everyone 1 (the Revamp's coreStartPoolByMeta still works either way).
 * - leftoverCash: 'tenth' — unspent Resources nuyen is kept at 10:1 (`cashRatio`; Core p. 47). 'old': the house rule
 *   RULES.STREET_V61.creation.leftoverCash (keep, cap or lose).
 * - startingCash: 'roll' — finishing the creation wizard adds 3D6 × 1,000¥ (`startingCashDice`, `startingCashPer`;
 *   Core p. 47). 'none': nothing more.
 * - nativeLanguage: 'book' — the native language is free at Intelligence + 2 (`nativeBonus`; may exceed 6, Core p. 46).
 *   'old': at Intelligence (the Revamp's coreNativeBonus, when set, wins).
 * - streetDialect: 'book' — a Street lifestyle at creation also gives a free local dialect at half Intelligence, rounded
 *   down (Core p. 46): counted as free points by the build check. 'off': no free dialect.
 *
 * Attributes and the metatypes
 * - aboveMax: 'double' — with the GM's leave an attribute may be raised past its natural maximum at double the Karma,
 *   up to the augmented maximum (1.5 ×; Core p. 190). 'refuse': refused (the old way). The house rule
 *   CHARACTERS_V73.qualities.karmaAboveRacial (on under the Revamp) still wins when it is on.
 * - trollDermal: 'body' — the troll's dermal armor is +1 Body for Damage Resistance Tests (a die, Core p. 45). 'armor':
 *   1 ballistic and 1 impact armor (the old way).
 * - dwarfResistance: 'disease' — the dwarf's +2 Body is against disease only (Core p. 45). 'both': disease and toxins.
 * - (troll running × 2, Core p. 83 Running Table: METATYPES.types.troll.run, moved 3 → 2 in place.)
 *
 * Karma
 * - karmaDice: 'book' — Karma Pool points buy extra dice, one point a die, up to the skill, attribute or rating dice in
 *   the test, not counting pool dice (Core p. 191). 'off': none (the old way); the Revamp's coreKarmaDice (no cap)
 *   wins when on.
 * - afterOops: 'book' — after Karma avoided a disaster no more Karma can be spent on that test (Core p. 191). 'old':
 *   the re-roll and buy buttons stay.
 * - skillKarma: 'book' — a language costs new rating × 1 and a knowledge skill is a general skill (× 2; its
 *   concentration × 1.5, specialization × 1; the Good Karma Cost for Skills table, Core p. 190). 'old': the
 *   Intelligence bands of RULES.UPKEEP.karma.skills.knowledge (the Revamp's coreLanguageKarma wins when set).
 * - newSkill: 'book' — a new skill's first rating point costs 1 Good Karma (Core p. 190). 'old': its rating-1 price.
 * - trainingTime: 'karma' — with timed training (the house rule CHARACTERS_V58.training.mode), the base days are the
 *   Karma spent × 7 for an active, Build/Repair or social skill and an attribute, × 15 for a knowledge or language
 *   skill; a concentration or specialization by its skill's kind (`trainingDaysPerKarma`; the Skill Improvement Table,
 *   Companion p. 50; attributes, Companion p. 53). 'rating': the new rating × CHARACTERS_V58.training.daysPerRating.
 * - awards: 'book' — the individual Karma awards are the book's: roleplaying (1, really good 2), guts (1–2), smarts,
 *   right place–right time, surprise, humor and drama (`individualAwards`; Core p. 199). 'old': the five rows of
 *   CHARACTERS_V58.karmaAward.individual.
 * - (Karma Pool growth: UPKEEP.karma.poolEvery moved to 11 for everyone in place: 10 points to Good Karma, the next
 *   to the pool, Companion p. 76; Core p. 190 has metahumans at the same rate.)
 *
 * Tests
 * - attributeDefault: 'web' — defaulting to an attribute traces the Skill Web from the attribute: +2 per circle (Core
 *   p. 68); with no attribute link the flat ATTRIBUTE_DEFAULT_TN_MOD. 'flat': always the flat modifier (the old way).
 *   Uses the same web links as the Revamp's coreWebAttributes ("Quickness - Firearms: 1").
 * - webArrows: 'book' — a Skill Web link written "A > B" is one-way: a path may only follow the arrow (Core p. 68; the
 *   Revamp's coreWebArrows). 'old': every link works both ways. (The step cap SKILLS.web.maxSteps moved 3 → 99 in
 *   place: the book has none, and any path may be traced, Core p. 68.)
 * - timeRounding: 'nearest' — base time ÷ successes rounds to the nearest whole unit (Core p. 68: 2.66 → 3,
 *   2.5 → 3), at least 1. 'tenth': rounded up to a tenth (the old way).
 * - perception: 'book' — noticing someone is the observer's Intelligence vs TN 4 + the modifiers (Core p. 185); the
 *   sneaker doesn't roll. 'companion' — the Companion's option (p. 90): the sneaker's Stealth (4) Test, each success
 *   +1 to the observer's TN. 'opposed': the old opposed test (Perception, else Intelligence, vs the Stealth rating).
 * - perceptionSounds: 'book' — the Perception Test Modifiers Table's sound, smell, touch and taste rows are offered in
 *   the perception dialogs (Core p. 185; added only when RULES.STREET.perception has no sense rows of its own, as the
 *   Revamp's patched list has). 'off': the house rows only.
 * - languageTns: 'book' — the Language Skills Table (Core p. 184): universal concept 2, basic conversation 4, complex
 *   subject 6, intricate 9, obscure 11 (`languageTable`; dialect +2). 'old': RULES.CHARACTERS_V58.languages.complexity.
 * - (Build/Repair without the tools, CHARACTERS_V58.tools.none, moved in place 'tn' → 'block': usually not allowed,
 *   Core p. 183.)
 * - athletics: 'book' — climbing covers a quarter of (the average of Quickness and Strength + 2 per success) metres a
 *   turn (Fields of Fire p. 75), with the Climbing Table's height and surface modifiers in the dialog
 *   (`climbModifiers`); swimming a fifth of the running distance, Quickness + 1 per success (Cyberpirates, over Fields
 *   of Fire p. 77's quarter). 'old': RULES.STREET.athletics.metresPerSuccess per success. (The climbing TNs,
 *   STREET.athletics.climb, moved in place to 3 / 5 / 8 / 14, Fields of Fire p. 75.) The Revamp's hsAthletics wins.
 *
 * NPCs
 * - threat: 'book' — a Threat Rating adds that many dice to every test the NPC makes (attacks, defence, damage
 *   resistance and other tests), never spent, and the NPC uses no Combat Pool (Core p. 187). 'pool': it adds Combat
 *   Pool dice (the old way, RULES.STREET.threat.addsToPool).
 * - morale: 'book' — an NPC withdraws on its Professional Rating's wound (1 Light, 2 Moderate, 3 Serious; 4 never), and
 *   the GM may let it test Willpower (`moraleWillpowerTn` 4) to stay (Core p. 187); the Morale test is that Willpower
 *   test. 'old': Professional Rating dice vs 4 + 1 per casualty (RULES.MORALE).
 * - recognition: 'book' — whether an NPC has heard of a character: the NPC's Etiquette (else Charisma at +4) vs
 *   (1,000 − rep) ÷ 50, rep the character's career Karma (private rep) or a public rep the GM gives (Core p. 199).
 *   'old': Intelligence vs 10 − Public Awareness.
 * - haggle: 'book' — the seller rolls against the buyer's Willpower (each side against the other's Willpower; the
 *   seller's own Willpower is RULES.STREET.haggle.tn, Core p. 184). 'old': the seller's dice vs RULES.STREET.haggle.tn
 *   (the Revamp's coreHaggleTn wins when set). The 25% cap (STREET.haggle.maxPercent) stays: the book has none, but the
 *   cap also bounds the price a chat card may claim when buying (a forged card could otherwise buy for 0).
 * - interrogation: 'book' — an Interrogation test is one-sided like the other social influence tests (with
 *   DOCS_V79.socialInfluence 'oneSided'): the interrogator's skill vs the subject's Willpower, the subject doesn't roll
 *   (Core p. 73). 'old': an opposed test.
 * - fence: 'book' — at the meet each side rolls Negotiation against the other's Willpower + 2 (the fence's Willpower is
 *   RULES.STREET.fence.tn), and a fence who wins pays at least `fenceMinPercent` 10% (Core p. 188). 'old': both at
 *   RULES.STREET.fence.tn, the share down to 0%.
 * - qualities: 'zero' — when the Edges and Flaws house rule is on, their points must come to 0 (Companion p. 21; surplus
 *   flaws only with CHARACTERS_V73.qualities.surplusFlaws), with no per-side cap. 'old': at most STREET.qualities
 *   maxEdges / maxFlaws, and edges no more than flaws (balance). (Eliminating a flaw, STREET.qualities.karma.flawPerPoint,
 *   moved in place 2 → 10 × its points, Companion p. 22.)
 * - (Karma Pool refresh, KARMA.refresh, moved in place 'manual' → 'combat': full again with the next encounter, Core
 *   p. 191.)
 */
export const CORE_V923 = {
  priorities: 'book' as 'book' | 'old',
  moreMetahumans: false as boolean,
  /** The Master Character Creation Table (Core p. 47). Race and Magic are worked out by the rules (rules/core923.ts). */
  bookPriorities: {
    A: { attributes: 30, skills: 40, resources: 1000000, forcePoints: 50 },
    B: { attributes: 24, skills: 30, resources: 400000, forcePoints: 35 },
    C: { attributes: 20, skills: 24, resources: 90000, forcePoints: 25 },
    D: { attributes: 17, skills: 20, resources: 5000, forcePoints: 15 },
    E: { attributes: 15, skills: 17, resources: 500, forcePoints: 5 },
  } as Record<'A' | 'B' | 'C' | 'D' | 'E', { attributes: number; skills: number; resources: number; forcePoints: number }>,
  racialMods: 'book' as 'book' | 'old',
  /** The book's racial modifiers missing from RULES.METATYPES (Core p. 45). */
  racialExtra: { dwarf: { quickness: -1 }, troll: { willpower: -1 } } as Record<string, Partial<Record<'body' | 'quickness' | 'strength' | 'charisma' | 'intelligence' | 'willpower', number>>>,
  startPool: 'book' as 'book' | 'old',
  startPoolMetahuman: 2,
  leftoverCash: 'tenth' as 'tenth' | 'old',
  cashRatio: 10,
  startingCash: 'roll' as 'roll' | 'none',
  startingCashDice: 3,
  startingCashPer: 1000,
  nativeLanguage: 'book' as 'book' | 'old',
  nativeBonus: 2,
  streetDialect: 'book' as 'book' | 'off',
  aboveMax: 'double' as 'double' | 'refuse',
  trollDermal: 'body' as 'body' | 'armor',
  dwarfResistance: 'disease' as 'disease' | 'both',
  karmaDice: 'book' as 'book' | 'off',
  afterOops: 'book' as 'book' | 'old',
  skillKarma: 'book' as 'book' | 'old',
  newSkill: 'book' as 'book' | 'old',
  newSkillCost: 1,
  awards: 'book' as 'book' | 'old',
  /** The individual Karma awards (Core p. 199). */
  individualAwards: [
    { id: 'roleplaying', label: 'Roleplaying (really good: 2)', value: 1, max: 2 },
    { id: 'guts', label: 'Guts', value: 1, max: 2 },
    { id: 'smarts', label: 'Smarts', value: 1, max: 2 },
    { id: 'rightPlace', label: 'Right place, right time', value: 1, max: 1 },
    { id: 'surprise', label: 'Surprise', value: 1, max: 1 },
    { id: 'humor', label: 'Humor', value: 1, max: 1 },
    { id: 'drama', label: 'Drama', value: 1, max: 1 },
  ] as ReadonlyArray<{ id: string; label: string; value: number; max: number }>,
  trainingTime: 'karma' as 'karma' | 'rating',
  trainingDaysPerKarma: { active: 7, buildRepair: 7, attribute: 7, knowledge: 15, language: 15 } as Record<string, number>,
  attributeDefault: 'web' as 'web' | 'flat',
  webArrows: 'book' as 'book' | 'old',
  timeRounding: 'nearest' as 'nearest' | 'tenth',
  perception: 'book' as 'book' | 'companion' | 'opposed',
  perceptionTn: 4,
  perceptionSounds: 'book' as 'book' | 'off',
  /** The Perception Test Modifiers Table's sound, smell, touch and taste rows (Core p. 185). */
  senseRows: [
    { id: 'gunshot', label: 'Sound: a single gunshot', value: -2 },
    { id: 'gunshotSilenced', label: 'Sound: a silenced single gunshot', value: 0 },
    { id: 'burst', label: 'Sound: burst fire', value: -4 },
    { id: 'burstSilenced', label: 'Sound: sound-suppressed burst fire', value: -2 },
    { id: 'auto', label: 'Sound: full autofire', value: -6 },
    { id: 'autoSilenced', label: 'Sound: sound-suppressed autofire', value: -4 },
    { id: 'grenade', label: 'Sound: grenade blast', value: -8 },
    { id: 'yelling', label: 'Sound: a person\'s yell', value: -2 },
    { id: 'roomsAway', label: 'Sound is rooms away', value: 2 },
    { id: 'sameFloor', label: 'Sound is on the same floor', value: 4 },
    { id: 'floorsAway', label: 'Sound is floors away', value: 6 },
    { id: 'odorObvious', label: 'Smell: the odor is obvious', value: -4 },
    { id: 'otherOdors', label: 'Smell: other odors present', value: 2 },
    { id: 'temperature', label: 'Touch: extreme temperature', value: -4 },
    { id: 'gloves', label: 'Touch: wearing gloves', value: 2 },
    { id: 'tasteObvious', label: 'Taste: the taste is obvious', value: -4 },
    { id: 'hasCold', label: 'Taste: perceiver has a cold', value: 2 },
  ] as ReadonlyArray<{ id: string; label: string; value: number }>,
  languageTns: 'book' as 'book' | 'old',
  /** The Language Skills Table (Core p. 184). */
  languageTable: [
    { id: 'universal', label: 'Universal concept (hunger, fear)', tn: 2 },
    { id: 'basic', label: 'Basic conversation (daily life)', tn: 4 },
    { id: 'complex', label: 'Complex subject (special interests)', tn: 6 },
    { id: 'intricate', label: 'Intricate subject (technical)', tn: 9 },
    { id: 'obscure', label: 'Obscure subject (deeply technical)', tn: 11 },
  ] as ReadonlyArray<{ id: string; label: string; tn: number }>,
  dialectTn: 2,
  athletics: 'book' as 'book' | 'old',
  /** The Climbing Table's modifiers (Fields of Fire p. 75). */
  climbModifiers: [
    { id: 'height2', label: 'Height 2–4 metres', value: 2 },
    { id: 'height4', label: 'Height 4 metres or more', value: 4 },
    { id: 'wet', label: 'Slippery or wet', value: 2 },
    { id: 'greased', label: 'Greased or gel-treated', value: 4 },
  ] as ReadonlyArray<{ id: string; label: string; value: number }>,
  swimDivisor: 5,
  threat: 'book' as 'book' | 'pool',
  morale: 'book' as 'book' | 'old',
  moraleWillpowerTn: 4,
  /** The wound level at which an NPC of each Professional Rating withdraws (Core p. 187); 4 never. */
  moraleWound: { 1: 'L', 2: 'M', 3: 'S' } as Record<number, 'L' | 'M' | 'S' | 'D'>,
  recognition: 'book' as 'book' | 'old',
  recognitionRep: 1000,
  recognitionPer: 50,
  haggle: 'book' as 'book' | 'old',
  qualities: 'zero' as 'zero' | 'old',
  interrogation: 'book' as 'book' | 'old',
  fence: 'book' as 'book' | 'old',
  fenceSuspicion: 2,
  fenceMinPercent: 10,
};

/** The house-rules window's rows for CORE_V923 (spread into settings.ts HOUSE_RULES). */
export const HOUSE_CORE_V923: Array<{ path: string; section: string; type: 'number' | 'boolean' | 'select'; choices?: string[]; step?: number }> = [
  { section: 'characters', path: 'CORE_V923.priorities', type: 'select', choices: ['book', 'old'] },
  { section: 'characters', path: 'CORE_V923.moreMetahumans', type: 'boolean' },
  { section: 'characters', path: 'CORE_V923.racialMods', type: 'select', choices: ['book', 'old'] },
  { section: 'characters', path: 'CORE_V923.startPool', type: 'select', choices: ['book', 'old'] },
  { section: 'characters', path: 'CORE_V923.leftoverCash', type: 'select', choices: ['tenth', 'old'] },
  { section: 'characters', path: 'CORE_V923.cashRatio', type: 'number' },
  { section: 'characters', path: 'CORE_V923.startingCash', type: 'select', choices: ['roll', 'none'] },
  { section: 'characters', path: 'CORE_V923.nativeLanguage', type: 'select', choices: ['book', 'old'] },
  { section: 'characters', path: 'CORE_V923.streetDialect', type: 'select', choices: ['book', 'off'] },
  { section: 'characters', path: 'CORE_V923.aboveMax', type: 'select', choices: ['double', 'refuse'] },
  { section: 'characters', path: 'CORE_V923.trollDermal', type: 'select', choices: ['body', 'armor'] },
  { section: 'characters', path: 'CORE_V923.dwarfResistance', type: 'select', choices: ['disease', 'both'] },
  { section: 'testsAndDice', path: 'CORE_V923.karmaDice', type: 'select', choices: ['book', 'off'] },
  { section: 'testsAndDice', path: 'CORE_V923.afterOops', type: 'select', choices: ['book', 'old'] },
  { section: 'upkeep', path: 'CORE_V923.skillKarma', type: 'select', choices: ['book', 'old'] },
  { section: 'upkeep', path: 'CORE_V923.newSkill', type: 'select', choices: ['book', 'old'] },
  { section: 'upkeep', path: 'CORE_V923.awards', type: 'select', choices: ['book', 'old'] },
  { section: 'upkeep', path: 'CORE_V923.trainingTime', type: 'select', choices: ['karma', 'rating'] },
  { section: 'testsAndDice', path: 'CORE_V923.attributeDefault', type: 'select', choices: ['web', 'flat'] },
  { section: 'testsAndDice', path: 'CORE_V923.webArrows', type: 'select', choices: ['book', 'old'] },
  { section: 'testsAndDice', path: 'CORE_V923.timeRounding', type: 'select', choices: ['nearest', 'tenth'] },
  { section: 'characters', path: 'CORE_V923.perception', type: 'select', choices: ['book', 'companion', 'opposed'] },
  { section: 'characters', path: 'CORE_V923.perceptionSounds', type: 'select', choices: ['book', 'off'] },
  { section: 'characters', path: 'CORE_V923.languageTns', type: 'select', choices: ['book', 'old'] },
  { section: 'characters', path: 'CORE_V923.athletics', type: 'select', choices: ['book', 'old'] },
  { section: 'street', path: 'CORE_V923.threat', type: 'select', choices: ['book', 'pool'] },
  { section: 'characters', path: 'CORE_V923.morale', type: 'select', choices: ['book', 'old'] },
  { section: 'characters', path: 'CORE_V923.recognition', type: 'select', choices: ['book', 'old'] },
  { section: 'street', path: 'CORE_V923.haggle', type: 'select', choices: ['book', 'old'] },
  { section: 'street', path: 'CORE_V923.qualities', type: 'select', choices: ['zero', 'old'] },
  { section: 'characters', path: 'CORE_V923.interrogation', type: 'select', choices: ['book', 'old'] },
  { section: 'street', path: 'CORE_V923.fence', type: 'select', choices: ['book', 'old'] },
];
