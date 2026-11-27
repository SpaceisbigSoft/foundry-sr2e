/**
 * v0.96.0 rules completeness: Sorcery. Read through RULES.SORCERY_V96. Book rules the system did not have before
 * v0.96.0, each with its book and page in the comment. Each switch's first choice is the book's way (the default); the
 * other choice puts the v0.95.1 behaviour back. Pure logic lives beside it in rules/sorcery96.ts, the Foundry glue in
 * applications/sorcery96.ts.
 *
 * The owner's decisions stay as they are (docs/VERIFY.md, "Sorcery", "Kept"): the casting test rolls the skill's
 * rating (MAGIC_V920), the layered Magic Pool (MAGIC_V920.poolLayers) and FORMULA_V918. The rules here add to them.
 */
export const SORCERY_V96 = {
  /**
   * Defaulting a magical skill (Awakenings p. 93; the Skill Web, Core p. 68). 'book': a magically active character
   * with no Sorcery skill may still cast by defaulting to Magical Theory, Conjuring or Enchanting, or to Willpower,
   * at +2 TN per step on the web (the GM's Skill Web when it links them, else `magicDefaultSteps`; the best dice
   * win). 'off' (v0.95.1): no Sorcery skill, no casting.
   */
  magicDefault: 'book' as 'book' | 'off',
  /**
   * magicDefault 'book': steps on the web from Sorcery to each skill or attribute it defaults to, when the GM's web
   * doesn't link them. VERIFY: the Awakenings p. 94 diagram wasn't readable; read as one circle to Magical Theory,
   * two to the other magical skills (through Magical Theory) and four to Willpower (Core p. 69: Willpower to Magical
   * Theory is 3, plus one).
   */
  magicDefaultSteps: { magicalTheory: 1, conjuring: 2, enchanting: 2, willpower: 4 } as Record<string, number>,
  /**
   * Shaping an area spell (Core p. 130). 'book': the Cast window takes a change of radius in metres: every 2 dice
   * withheld from the Spell Success Test take a metre off, every die withheld adds one; at most the spell's Force in
   * dice may be withheld. The targets inside the new radius are ticked. 'off' (v0.95.1): the radius is the Magic in
   * metres, no change.
   */
  areaShape: 'book' as 'book' | 'off',
  /**
   * Spell stacking (Core p. 129). 'book': the Cast window asks how many other spells are stacked into the same
   * Complex Action; every one adds `stackTn` to the casting test and to the Drain test. (Cast each stacked spell
   * through its own window with the same count; the Magic Pool is split by hand.) VERIFY: "+2 per stacked spell"
   * with the book's two-spell example at +2 is read as +2 per spell beyond the first. 'off' (v0.95.1).
   */
  stacking: 'book' as 'book' | 'off',
  stackTn: 2,
  /**
   * Noticing spellcasting (Core p. 132). 'book': every cast's card names the Perception TN for onlookers: twice the
   * difference between the caster's Magic and the Force (at least `noticeMinTn`; −2 for a magician watching;
   * astrally active onlookers notice it automatically). VERIFY: the book's formula reaches 0 when the Force equals the
   * Magic; the minimum TN 2 is the system's reading. 'off' (v0.95.1): no line.
   */
  noticing: 'book' as 'book' | 'off',
  noticeMinTn: 2,
  /**
   * The active foci limit (Core p. 137). 'book': at most Intelligence foci active at once; switching on one more is
   * refused. 'warn': a warning only. 'off' (v0.95.1): no limit.
   */
  fociLimit: 'book' as 'book' | 'warn' | 'off',
  /**
   * The Armor spell (Core p. 158): one-half the successes count. 'book': the spells named in `halfSuccessSpells`
   * (names compared without case, spaces or punctuation) scale their effect by every 2 successes. 'off' (v0.95.1):
   * RULES.MAGIC_V56.spellEffects.step for every spell.
   */
  armorSpell: 'book' as 'book' | 'off',
  halfSuccessSpells: ['armor', 'armour'] as string[],
  /**
   * A ward's days (Grimoire p. 92 with the Grimoire II errata; RULES.SORCERY_V923.ward 'book'): the ward lasts as many
   * days as the ritual's successes. 'book': when those days have passed on the world clock the ward falls (rating 0)
   * and the GMs get a card. 'card': the GMs get a card only. 'off' (v0.95.1): the card at the ritual states the days.
   */
  wardExpiry: 'book' as 'book' | 'card' | 'off',
  /**
   * Quickening (Grimoire pp. 44–45). 'book': the Quicken button asks for the dice used in the Spell Success Test, its
   * TN and the Karma to pay (from the Force to twice the Force); a Sorcery + grade test (only Karma Pool dice may
   * help) divides the dice into the actions it must be sustained (at least one; no success: twice the dice); the Karma
   * paid is kept for dispelling and astral combat; the second Drain test follows. VERIFY: the actions are stated on
   * the card and the spell is made permanent at once (the GM holds it back until they have passed); the division is
   * rounded up. 'off' (v0.95.1): Karma = Force × RULES.MAGIC.quickenKarmaPerForce at once, no test, no second Drain.
   */
  quickening: 'book' as 'book' | 'off',
  /**
   * Anchoring (Grimoire p. 47). 'book': preparing the object costs Karma = the Force + the links (a trigger is one
   * link), and an Enchanting test against half the Force + the links (at least 2) divides the base time of a minute
   * per Force and link (the object is prepared whatever the result). VERIFY: half the Force is rounded down. 'off'
   * (v0.95.1): RULES.MAGIC_V72.anchoring's Karma, no test.
   */
  anchoring: 'book' as 'book' | 'off',
  /**
   * Masking (Grimoire p. 46). 'book': a masked initiate's aura reads as mundane unless an initiate assensing it makes
   * a secret Magic test against the subject's Magic with successes of at least the subject's grade less the viewer's
   * (at least 1); the masking covers foci up to the grade in rating points. 'off' (v0.95.1): masking adds
   * RULES.OCCULT.masking.tnPerGrade × grade to the assensing TN.
   */
  masking: 'book' as 'book' | 'off',
  /**
   * Centering for spellcasting and Drain (Grimoire p. 43). 'book': the Cast window offers a centering test before the
   * cast: for the spell (TN the spell's, astrally perceiving only) every 2 successes add a success to a Spell Success
   * Test that has at least one; for the Drain (TN the Drain's) every 2 successes add one to a Drain test that has at
   * least one. 'off' (v0.95.1): centering only lowers penalties.
   */
  centeringUse: 'book' as 'book' | 'off',
  /**
   * Totem dice as Magic Pool dice (Core p. 119, Shamanic Tradition). 'book': a totem's bonus dice for a spell are Magic
   * Pool dice that exist only for that cast: the Cast window's pool rows may use them (for the test or the Drain)
   * without spending the pool; a penalty takes dice from the pool that cast may use. 'off' (v0.95.1): totem dice are
   * added to the casting test.
   */
  totemPool: 'book' as 'book' | 'off',
  /**
   * Drain codes for the stat-block importer (Core p. 159, the Table of Spells; pp. 151–158, the spell entries). 'book': a spell imported with no
   * drain code takes the book's from rules/sorcery96-drain.ts (the core spells only; spells whose level depends on
   * the wound or the attribute are left out). 'off' (v0.95.1): the importer warns and leaves the default.
   */
  drainTable: 'book' as 'book' | 'off',
  /**
   * A dispelled spell's effect (Grimoire p. 45 with RULES.SORCERY_V923.dispelling 'book'): when dispelling lowers a
   * sustained spell's Force, its effect on each subject is rebuilt capped at the new Force. 'off' (v0.95.1): only the
   * Force in the Sustaining list changes.
   */
  dispelEffect: 'book' as 'book' | 'off',
  /**
   * Grade 0 by hand (Grimoire pp. 37–38 with RULES.SORCERY_V923.initiation 'book'): the sheet's initiation row shows an
   * "Initiated" tick while the grade is 0, so a Grade 0 initiate can be set without initiating in play. 'off'
   * (v0.95.1): no tick.
   */
  gradeZero: 'book' as 'book' | 'off',
};

/** The house-rules window's rows for SORCERY_V96 (spread into settings.ts HOUSE_RULES). */
export const HOUSE_SORCERY_V96: Array<{ path: string; section: string; type: 'number' | 'boolean' | 'select'; choices?: string[]; step?: number }> = [
  { section: 'magicAndCritters', path: 'SORCERY_V96.magicDefault', type: 'select', choices: ['book', 'off'] },
  { section: 'magicAndCritters', path: 'SORCERY_V96.areaShape', type: 'select', choices: ['book', 'off'] },
  { section: 'magicAndCritters', path: 'SORCERY_V96.stacking', type: 'select', choices: ['book', 'off'] },
  { section: 'magicAndCritters', path: 'SORCERY_V96.stackTn', type: 'number' },
  { section: 'magicAndCritters', path: 'SORCERY_V96.noticing', type: 'select', choices: ['book', 'off'] },
  { section: 'magicAndCritters', path: 'SORCERY_V96.noticeMinTn', type: 'number' },
  { section: 'magicAndCritters', path: 'SORCERY_V96.fociLimit', type: 'select', choices: ['book', 'warn', 'off'] },
  { section: 'magicAndCritters', path: 'SORCERY_V96.armorSpell', type: 'select', choices: ['book', 'off'] },
  { section: 'magicAndCritters', path: 'SORCERY_V96.wardExpiry', type: 'select', choices: ['book', 'card', 'off'] },
  { section: 'magicAndCritters', path: 'SORCERY_V96.quickening', type: 'select', choices: ['book', 'off'] },
  { section: 'magicAndCritters', path: 'SORCERY_V96.anchoring', type: 'select', choices: ['book', 'off'] },
  { section: 'magicAndCritters', path: 'SORCERY_V96.masking', type: 'select', choices: ['book', 'off'] },
  { section: 'magicAndCritters', path: 'SORCERY_V96.centeringUse', type: 'select', choices: ['book', 'off'] },
  { section: 'magicAndCritters', path: 'SORCERY_V96.totemPool', type: 'select', choices: ['book', 'off'] },
  { section: 'magicAndCritters', path: 'SORCERY_V96.drainTable', type: 'select', choices: ['book', 'off'] },
  { section: 'magicAndCritters', path: 'SORCERY_V96.dispelEffect', type: 'select', choices: ['book', 'off'] },
  { section: 'magicAndCritters', path: 'SORCERY_V96.gradeZero', type: 'select', choices: ['book', 'off'] },
];
