/**
 * v0.80.0, the "SR2E Unified Rules Revamp" rules source (area: core). Read through RULES.URR_V80; the GM picks the
 * source in the world setting "Rules source" (settings.ts). Two exports:
 * - URR_V80_CORE: this area's new switches and numbers. Their shipped values are the SR2E Book Rules (the mode off),
 *   so nothing changes unless the GM picks the Unified Rules Revamp.
 * - URR80_PATCH_CORE: RULES paths → the value the Unified Rules Revamp uses (existing paths, or 'URR_V80.<key>').
 *   Applied under the GM's own house rules, which still win.
 * Source: the Unified Rule Revamp (URR v1.2), cited as "URR" below; a rule marked "house rule for the Revamp"
 * is not in the URR.
 * The pure functions are in rules/urr80-core.ts.
 *
 * Dice and tests
 * - coreCriticals: Revamp true — a plain test card counts critical successes, one for every full 6 points a die's
 *   total goes over the TN, and says the GM may grant a bonus success. Book false: not shown. Source: URR.
 * - coreTnPresets: Revamp true — the skill and attribute roll dialogs offer the standard difficulty table
 *   (`coreDifficulty`: simple 2 … nearly impossible 10) to set the TN. Book false: the TN is typed. Source: URR
 *   (standard difficulty table).
 * - coreKnowledgeTest: Revamp true — a knowledge skill's roll dialog offers the knowledge table (`coreKnowledgeTns`:
 *   general 3, detailed 5, intricate 8, obscure 12) and its card says what the successes give (`coreKnowledgeReveals`).
 *   Book false. Source: URR (knowledge table; SRII p183).
 * - coreTies: Revamp 'actor' — an opposed perception or social test that ends in a tie goes to the side that made
 *   the test (it needs at least one success: a 0–0 tie is still nobody's). Sneaking already favours the sneaker on a
 *   tie. Book 'none': a tie is a stand-off. Source: URR. (Melee, attacks and spells belong to the combat and magic areas.)
 *
 * Karma Pool
 * - coreKarmaDice: Revamp true — the skill and attribute roll dialogs can buy extra dice from the Karma Pool, one point
 *   a die (spent until the pool refreshes); a skill must be rated (not defaulted). Book false. Source: URR (no
 *   cap but the pool).
 * - coreStartPoolByMeta / coreStartPoolMeta: Revamp true / 2 — a metahuman finishing creation in the wizard starts
 *   with a Karma Pool of 2 (humans keep 1). Book false. Source: URR.
 * - coreKarmaGrowth: Revamp 'perAward' — each Karma award gives its first `coreAwardPool` point(s) to the Karma Pool,
 *   the next `coreAwardGood` to Good Karma, and so on round; it starts over with each award. Book 'career': one
 *   pool point per 10 career Karma (20 for metahumans; RULES.UPKEEP.karma.poolEvery). Source: house rule for the
 *   Revamp (not in the URR: it says the pool grows with Good Karma but gives no ratio).
 *
 * Attributes
 * - coreMetaMax / coreMetaMaxAdjust: Revamp true — natural maximums follow the URR's table, which differs from
 *   6 + the racial modifier in two cells: dwarf Quickness 5 and troll Willpower 5 (−1 each). The racial modifiers
 *   themselves don't change. Book false. Source: URR. (Its Reaction maximums already follow from Quickness and
 *   Intelligence.)
 * - UPKEEP.karma.attributeMultiplier (patched 1.5; book 2): raising an attribute costs new rating × 1.5. Source: URR
 *   (Karma costs).
 * - CHARACTERS_V73.qualities.karmaAboveRacial.enabled (patched true; book false): with the GM's leave an attribute
 *   may go past its natural maximum at double cost (new rating × 3, the shipped multiplier), up to the augmented
 *   maximum. Source: URR.
 * - coreEssenceFloor: Revamp true — Essence counts rounded down, so a magician's Magic is at most current Essence
 *   rounded down (with MAGIC_ESSENCE_MODE 'cap'). Book false: rounded up. Source: URR.
 *
 * Skills and the Skill Web
 * - SKILLS.web.maxSteps (patched 99; book 3): no limit on how far a default may trace across the web. Source: URR.
 * - coreWebArrows: Revamp true — a Skill Web link written "A > B" is one-way: you may default from A to B, never
 *   against the arrow. Book false: every link works both ways. Source: URR.
 * - coreWebAttributes: Revamp true — defaulting to an attribute traces the web too: a link from an attribute to a
 *   skill (e.g. "Quickness - Firearms: 2") costs +2 per step; with no such link it stays the flat
 *   ATTRIBUTE_DEFAULT_TN_MOD. Book false. Source: URR.
 * - coreSubSkillDefault / coreConcDefaultTn / coreSpecDefaultTn: Revamp true — a character without the general skill
 *   may default from its concentration at +2 TN, or from its specialization at +3 (+1 more). Book false: an unrated
 *   skill defaults to a related skill or the attribute. Source: URR.
 * - coreNativeBonus: Revamp 2 (book 0) — the native language comes free at Intelligence + 2. Source: URR.
 * - coreLanguageKarma: Revamp 1 (book 0 = the knowledge bands) — raising a language costs new rating × 1. Source:
 *   house rule for the Revamp (not in the URR as such: it takes a language as a specialization, × 1 too).
 *
 * Training
 * - coreTraining: Revamp 'urr' — training time is Karma spent × `coreTrainHoursPerKarma` (8) hours, trained
 *   `coreTrainDailyHours` (4) hours a day or Willpower hours if more; an instructor's successes divide it as
 *   (1 + successes) (the trainee's own training test is not rolled: it counts as one success); an instructor must
 *   have the skill at the new rating + `coreInstructorMargin` (2) or more, and needs no rating to teach an attribute.
 *   Book 'book': new rating × days by kind (RULES.CHARACTERS_V58.training) ÷ the instructor's successes, the
 *   instructor's rating at least the new one. Source: URR.
 *
 * Gear
 * - coreFindTn: Revamp 2 (book 0) — finding gear is at the Availability TN + 2. Source: house rule for the
 *   Revamp (not in the URR: it gives no acquisition test).
 * - coreHaggleTn: Revamp 'intelligence' — when haggling, the seller's dice roll against the buyer's Intelligence.
 *   Book 'fixed': RULES.STREET.haggle.tn. Source: URR (Negotiation against the other side's
 *   Intelligence).
 */
type AttrKey = 'body' | 'quickness' | 'strength' | 'charisma' | 'intelligence' | 'willpower';

export const URR_V80_CORE = {
  coreCriticals: false as boolean,
  coreTnPresets: false as boolean,
  coreDifficulty: [
    { id: 'simple', label: 'Simple', tn: 2 },
    { id: 'routine', label: 'Routine', tn: 3 },
    { id: 'average', label: 'Average', tn: 4 },
    { id: 'challenging', label: 'Challenging', tn: 5 },
    { id: 'difficult', label: 'Difficult (6–7)', tn: 6 },
    { id: 'strenuous', label: 'Strenuous', tn: 8 },
    { id: 'extreme', label: 'Extreme', tn: 9 },
    { id: 'nearlyImpossible', label: 'Nearly impossible (10+)', tn: 10 },
  ] as ReadonlyArray<{ id: string; label: string; tn: number }>,
  coreKnowledgeTest: false as boolean,
  coreKnowledgeTns: [
    { id: 'general', label: 'General knowledge', tn: 3 },
    { id: 'detailed', label: 'Detailed knowledge', tn: 5 },
    { id: 'intricate', label: 'Intricate knowledge', tn: 8 },
    { id: 'obscure', label: 'Obscure knowledge', tn: 12 },
  ] as ReadonlyArray<{ id: string; label: string; tn: number }>,
  coreKnowledgeReveals: [
    { successes: 1, text: 'The general picture, without detail.' },
    { successes: 2, text: 'Details, but some of them are wrong.' },
    { successes: 3, text: 'Details, with some points unclear or missing.' },
    { successes: 4, text: 'Full and accurate detail.' },
  ] as ReadonlyArray<{ successes: number; text: string }>,
  coreTies: 'none' as 'none' | 'actor',
  coreKarmaDice: false as boolean,
  coreStartPoolByMeta: false as boolean,
  coreStartPoolMeta: 2,
  coreKarmaGrowth: 'career' as 'career' | 'perAward',
  coreAwardPool: 1,
  coreAwardGood: 10,
  coreMetaMax: false as boolean,
  coreMetaMaxAdjust: { dwarf: { quickness: -1 }, troll: { willpower: -1 } } as Record<string, Partial<Record<AttrKey, number>>>,
  coreEssenceFloor: false as boolean,
  coreWebArrows: false as boolean,
  coreWebAttributes: false as boolean,
  coreSubSkillDefault: false as boolean,
  coreConcDefaultTn: 2,
  coreSpecDefaultTn: 1,
  coreNativeBonus: 0,
  coreLanguageKarma: 0,
  coreTraining: 'book' as 'book' | 'urr',
  coreTrainHoursPerKarma: 8,
  coreTrainDailyHours: 4,
  coreInstructorMargin: 2,
  coreFindTn: 0,
  coreHaggleTn: 'fixed' as 'fixed' | 'intelligence',
};

export const URR80_PATCH_CORE: Record<string, unknown> = {
  'URR_V80.coreCriticals': true,
  'URR_V80.coreTnPresets': true,
  'URR_V80.coreKnowledgeTest': true,
  'URR_V80.coreTies': 'actor',
  'URR_V80.coreKarmaDice': true,
  'URR_V80.coreStartPoolByMeta': true,
  'URR_V80.coreKarmaGrowth': 'perAward',
  'URR_V80.coreMetaMax': true,
  'URR_V80.coreEssenceFloor': true,
  'URR_V80.coreWebArrows': true,
  'URR_V80.coreWebAttributes': true,
  'URR_V80.coreSubSkillDefault': true,
  'URR_V80.coreNativeBonus': 2,
  'URR_V80.coreLanguageKarma': 1,
  'URR_V80.coreTraining': 'urr',
  'URR_V80.coreFindTn': 2,
  'URR_V80.coreHaggleTn': 'intelligence',
  'UPKEEP.karma.attributeMultiplier': 1.5,
  'CHARACTERS_V73.qualities.karmaAboveRacial.enabled': true,
  'SKILLS.web.maxSteps': 99,
};
