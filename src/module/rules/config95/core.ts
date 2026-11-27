/**
 * v0.95.0 rules completeness: Core mechanics and characters. Read through RULES.CORE_V95. Book rules the system did not have before v0.95.0, each
 * with its book and page in the comment. Each switch's first choice is the book's way (the default; an optional book
 * rule ships off); the other choice puts the v0.94.2 behaviour back. Pure logic lives beside it in rules/core95.ts,
 * the Foundry glue in applications/core95.ts.
 */
export const CORE_V95 = {
  /**
   * The Team Karma Pool (Core p. 191, p. 47). 'book': a world pool with a member list. A new team starts with
   * `teamKarmaStart` points; joining costs `teamKarmaJoin` point(s) of the member's own Karma Pool, for good; a member
   * may give more of their own pool, for good; any member may draw on it wherever their own Karma Pool is spent (the
   * table agrees first: the book's vote is not automated); it refreshes with the scene; a bought success is gone for
   * good; a member who leaves takes half of it away (a member who dies takes nothing). 'tracker' (v0.94.2): the plain
   * shared counter of v0.93.3 (world setting "Team Karma tracker").
   */
  teamKarma: 'book' as 'book' | 'tracker',
  /** teamKarma 'book': the points a new team starts with (Core p. 47). */
  teamKarmaStart: 2,
  /** teamKarma 'book': the points of their own Karma Pool a new member pays into the team pool (Core p. 191). */
  teamKarmaJoin: 1,
  /**
   * teamKarma 'book': a member leaving on good terms takes only their share (the pool ÷ the members, round up) instead
   * of half (an optional rule, Companion pp. 89–90; off = the choice is not offered).
   */
  teamKarmaGoodTerms: false,
  /**
   * Racism and Charisma (Core p. 182). 'book': the GM rolls an NPC's racism (2D6 − 6 points against one or two
   * metatypes, or all but their own); the points are added to social target numbers of speakers of those metatypes,
   * less the successes of the speaker's secret Charisma test against twice the points (not rolled when the speaker
   * defaults to Charisma for the social test). An NPC not rolled for keeps the metatype table. 'table' (v0.94.2): the
   * metatype prejudice table (RULES.TN_AUTO.social.prejudice) only.
   */
  racism: 'book' as 'book' | 'table',
  /**
   * Timed training (Companion pp. 50, 52, 53). 'book': the student rolls the skill against the new rating + 2 (an
   * attribute against the new rating; a new skill against 4), the successes divide the base time, none multiplies it
   * by `trainingFailFactor`; an instructor's test adds one success to the student's for every 2 of its own. 'off'
   * (v0.94.2): no self-test, the instructor's successes divide the time. The Revamp's own training (URR_V80
   * coreTraining 'urr') wins.
   */
  trainingTest: 'book' as 'book' | 'off',
  /** trainingTest 'book': the base time × this when the student's test has no successes (Companion p. 50). */
  trainingFailFactor: 1.5,
  /** trainingTest 'book': the instructor's successes for one more of the student's (Companion p. 52). */
  instructorPerSuccess: 2,
  /**
   * Jumping (Fields of Fire p. 76 with the FASA errata). 'book': a standing jump covers half Strength (round down)
   * less natural Body, at least 1 m; a running jump adds Quickness; a vertical jump is a quarter of that; the Athletics
   * test is against the metres to clear (+1 when Strength is below Body) and each success adds 10 percent (round
   * down). 'old' (v0.94.2): RULES.STREET.athletics.jump. The Revamp's own athletics (URR_V80 hsAthletics 'urr') wins.
   */
  jumping: 'book' as 'book' | 'old',
  /**
   * Swimming (Fields of Fire p. 77, Cyberpirates pp. 155–156). 'book': the swimming test is Athletics against 4 (as
   * running), and the dialog adds treading water (against 2 with the Treading Water table) and floating (Body
   * against 4 with the same table, Body × successes Combat Turns). 'old' (v0.94.2): the water-condition target numbers
   * (RULES.STREET.athletics.swim). The Revamp's own athletics wins.
   */
  swimming: 'book' as 'book' | 'old',
  /** swimming 'book': the swimming test's target number. */
  swimTn: 4,
  /** swimming 'book': treading water's base target number, and floating's (Cyberpirates p. 156). */
  treadTn: 2,
  floatTn: 4,
  /** swimming 'book': the Treading Water Modifications Table (Cyberpirates p. 156); the metatype rows are added by themselves. */
  treadModifiers: [
    { id: 'cyberlimb', label: 'Cyberlimb or torso (each)', value: 1 },
    { id: 'boneLacing', label: 'Aluminum or titanium bone lacing', value: 2 },
    { id: 'waterlogged', label: 'Waterlogged clothing', value: 1 },
    { id: 'deadWeight', label: 'Dead weight (per 2 kg)', value: 1 },
    { id: 'obese', label: 'Obese', value: -2 },
    { id: 'outOfShape', label: 'Out of shape', value: 1 },
    { id: 'muscular', label: 'Highly developed muscles or very low body fat', value: 1 },
    { id: 'plank', label: 'Mildly buoyant support (a plank)', value: -1 },
    { id: 'lifeJacket', label: 'Very buoyant support (a life jacket)', value: -2 },
    { id: 'roughSeas', label: 'Rough seas', value: 2 },
  ] as ReadonlyArray<{ id: string; label: string; value: number }>,
  /** swimming 'book': treading water by metatype (Cyberpirates p. 156). */
  treadMetatype: { elf: -1, ork: 1, troll: 1 } as Record<string, number>,
  /**
   * Missed lifestyle payments (Core p. 190). 'book': each month a payment is missed, 1D6 against the months missed in
   * a row; a roll above them is absorbed, else the lifestyle drops a level and the character owes a month of the old
   * one. 'grace' (v0.94.2): RULES.UPKEEP.effects (grace days, then down). RULES.UPKEEP.effects.overdue still says
   * who moves the character down ('auto', a GM card, or 'off' = nothing at all).
   */
  missedPayments: 'book' as 'book' | 'grace',
  /**
   * Selling a permanent lifestyle (Core p. 190). 'book': Middle or better sells for 2D6 × 10 percent of its price
   * (1D6 without a SIN, in a hurry or through an agent). 'off' (v0.94.2): it can't be sold.
   */
  sellLifestyle: 'book' as 'book' | 'off',
  /** sellLifestyle 'book': the lowest lifestyle that can be sold. */
  sellLifestyleFrom: 'middle',
  /**
   * A contact's fee for information (Core p. 200). 'book': after legwork the GM gets a card that works it out:
   * the contact's Etiquette × the successes × (Charisma + Intelligence) × 10 nuyen, with a Pay button for the player.
   * 'flat' (v0.94.2): only the contact's own fixed fee.
   */
  contactFee: 'book' as 'book' | 'flat',
  /**
   * Arranging a meet (Core p. 200). 'book': legwork rolls the secret base time (2D6 × 30 minutes) for the GM, who may
   * trade the player's successes to divide it. 'off' (v0.94.2).
   */
  contactMeet: 'book' as 'book' | 'off',
  /**
   * Contact upkeep (an optional rule, Companion p. 62). 'book': each contact costs `contactUpkeepCost` by level a
   * year; when it falls due the GM's client posts a card to pay it or lower the contact's level. 'off' (the default).
   */
  contactUpkeep: 'off' as 'off' | 'book',
  contactUpkeepCost: { 1: 500, 2: 3000, 3: 7000 } as Record<number, number>,
  /**
   * A group Perception test (Core p. 185): the average Intelligence plus a die per member, in the GM's "Book rules"
   * tool. 'book' / 'off' (v0.94.2: no such tool).
   */
  groupPerception: 'book' as 'book' | 'off',
  /**
   * A group of NPCs without a leader (Core p. 180): their averaged rating as the social target number, in the GM's
   * "Book rules" tool. 'book' / 'off' (v0.94.2).
   */
  groupAverage: 'book' as 'book' | 'off',
};

/** The house-rules window's rows for CORE_V95 (spread into settings.ts HOUSE_RULES). */
export const HOUSE_CORE_V95: Array<{ path: string; section: string; type: 'number' | 'boolean' | 'select'; choices?: string[]; step?: number }> = [
  { section: 'testsAndDice', path: 'CORE_V95.teamKarma', type: 'select', choices: ['book', 'tracker'] },
  { section: 'testsAndDice', path: 'CORE_V95.teamKarmaStart', type: 'number' },
  { section: 'testsAndDice', path: 'CORE_V95.teamKarmaJoin', type: 'number' },
  { section: 'testsAndDice', path: 'CORE_V95.teamKarmaGoodTerms', type: 'boolean' },
  { section: 'street', path: 'CORE_V95.racism', type: 'select', choices: ['book', 'table'] },
  { section: 'upkeep', path: 'CORE_V95.trainingTest', type: 'select', choices: ['book', 'off'] },
  { section: 'upkeep', path: 'CORE_V95.trainingFailFactor', type: 'number', step: 0.1 },
  { section: 'upkeep', path: 'CORE_V95.instructorPerSuccess', type: 'number' },
  { section: 'characters', path: 'CORE_V95.jumping', type: 'select', choices: ['book', 'old'] },
  { section: 'characters', path: 'CORE_V95.swimming', type: 'select', choices: ['book', 'old'] },
  { section: 'upkeep', path: 'CORE_V95.missedPayments', type: 'select', choices: ['book', 'grace'] },
  { section: 'upkeep', path: 'CORE_V95.sellLifestyle', type: 'select', choices: ['book', 'off'] },
  { section: 'street', path: 'CORE_V95.contactFee', type: 'select', choices: ['book', 'flat'] },
  { section: 'street', path: 'CORE_V95.contactMeet', type: 'select', choices: ['book', 'off'] },
  { section: 'street', path: 'CORE_V95.contactUpkeep', type: 'select', choices: ['off', 'book'] },
  { section: 'testsAndDice', path: 'CORE_V95.groupPerception', type: 'select', choices: ['book', 'off'] },
  { section: 'street', path: 'CORE_V95.groupAverage', type: 'select', choices: ['book', 'off'] },
];
