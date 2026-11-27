/**
 * v0.96.0 rules completeness: Damage, health and hazards. Read through RULES.HEALTH_V96. Book rules the system did not
 * have before v0.96.0, each with its book and page in the comment. Each switch's first choice is the book's way (the
 * default; an optional book rule ships off); the other choice puts the v0.95.1 behaviour back. Pure logic lives beside
 * it in rules/health96.ts, the Foundry glue in applications/health96.ts.
 */
export const HEALTH_V96 = {
  /**
   * Interrupted Stun rest (Core p. 112). 'book': a Stun rest that stops before the track is clear is a rest in
   * progress: the next Stun rest re-tests with the character's current condition, but its successes never count for
   * more than the first roll's (the first roll is kept on the character until the Stun track is clear). 'off'
   * (v0.95.1): every rest is a fresh test.
   */
  stunRestInterrupted: 'book' as 'book' | 'off',
  /**
   * The minimum lifestyle while healing (Core p. 113, Healing Table). 'book': a Physical rest whose lifestyle (a
   * hospital or intensive care counts as hospitalized) is below the wound's minimum gets a warning line on the card;
   * the extra modifiers are the GM's (the book leaves them to the GM). 'off' (v0.95.1): no check.
   */
  healingLifestyle: 'book' as 'book' | 'off',
  /** healingLifestyle 'book': the Healing Table's minimum lifestyle by wound level (Core p. 113); 'hospital' = hospitalized. */
  healingMinLifestyle: { L: 'low', M: 'middle', S: 'high', D: 'hospital' } as Record<'L' | 'M' | 'S' | 'D', string>,
  /**
   * Medical costs (Core p. 113, Medical Costs Table). 'book': a Physical rest with a doctor involved outside a hospital
   * (the Doctoring Table's doctor rows under DOCS_V79.doctoring 'table'; none under 'care') pays the doctor's fee per
   * day by wound level (shown in the Rest dialog; "Pay for hospital care" off waives it), a hospital stay 500¥ a day (the
   * doctor included), intensive care 1,000¥ a day; first aid by an NPC (a paramedic) on a player's character posts the
   * paramedic's fee by wound level with a Pay button. 'off' (v0.95.1): only RULES.HEALTH.careCosts (hospital and
   * intensive care), no paramedic fee.
   */
  medicalCosts: 'book' as 'book' | 'off',
  medicalCostsTable: {
    paramedic: { L: 50, M: 100, S: 200, D: 400 } as Record<'L' | 'M' | 'S' | 'D', number>,
    doctorPerDay: { L: 50, M: 100, S: 200, D: 400 } as Record<'L' | 'M' | 'S' | 'D', number>,
    hospitalPerDay: 500,
    intensivePerDay: 1000,
  },
  /**
   * The healing spells' time (Core p. 155, Treat). 'book': Treat and Heal must be sustained for the base time of the
   * spell's Healing Table (Light 5, Moderate 10, Serious 15, Deadly 20 Combat Turns, by the wound when cast) divided by
   * the successes put to time; the successes go to boxes first, as many as the wound has, the rest to time (the
   * caster's split, VERIFY: the book lets the caster choose; boxes first is the choice that never wastes one).
   * 'off' (v0.95.1): RULES.MAGIC_V56.permanent (Force × turnsPerForce ÷ all the successes).
   */
  healingSpellTime: 'book' as 'book' | 'off',
  healingSpellTurns: { L: 5, M: 10, S: 15, D: 20 } as Record<'L' | 'M' | 'S' | 'D', number>,
  /**
   * The antidote as professional attention (Core pp. 186, 115): an antidote patch slapped on a dying patient gives the
   * GM a button that counts it as professional help when the toxin put them down: first aid may be tried again (a
   * failed one brings the patient's own Body test, as always). 'off' (v0.95.1).
   */
  antidoteAttention: 'book' as 'book' | 'off',
  /**
   * Implants and slap patches (Core p. 250). 'book': dermal armor lowers the rating of any patch but the trauma patch
   * by its armor rating, and blood filtration makes them do nothing (the trauma patch keeps its own test). 'off'
   * (v0.95.1).
   */
  patchImplants: 'book' as 'book' | 'off',
  /**
   * The stim patch and magicians (Core p. 250; Awakenings p. 99). 'core': a magician rolls Magic against the patch's
   * rating; failing it posts the Magic loss test as for a Deadly wound. 'awakenings' (Awakenings' optional rule): the
   * test is against the total rating of the stim patches of the last 24 hours. 'off' (v0.95.1): no test.
   */
  stimMagic: 'core' as 'core' | 'awakenings' | 'off',
  /**
   * The nephritic screen (Shadowtech p. 30). 'book': it lowers the Power of a pathogen (disease) or a blood-vectored
   * toxin by `nephriticPowerCut` (its dice stay as RULES.HEALTH_V72.vitals.nephriticScreen). 'off' (v0.95.1): dice only.
   */
  nephriticPower: 'book' as 'book' | 'off',
  nephriticPowerCut: 1,
  /** nephriticPower 'book': the vectors that are blood-borne (VERIFY: the book says "blood-vectored"; injection). */
  nephriticVectors: ['injection'] as readonly string[],
  /**
   * The trauma damper (Shadowtech p. 29). 'book': a Physical hit shifts one box onto the Stun track (Stun hits keep
   * losing a box as before); not with a pain editor (the system keeps a pain editor on); with a damage compensator only
   * once its boxes are exceeded on both tracks; never a box of the Overflow. 'off' (v0.95.1): Stun hits only.
   */
  traumaDamper: 'book' as 'book' | 'off',
  /**
   * The pain editor (Shadowtech p. 26). 'book': Stun damage can't knock its wearer out (the Stun still overflows into
   * Physical); its −1 Intelligence is GEAR_V923.bioware's. 'off' (v0.95.1).
   */
  painEditor: 'book' as 'book' | 'off',
  /**
   * Addiction leftovers (Shadowtech pp. 87–88). addictionBoth 'book': a drug can be both physically and mentally
   * addictive: a separate test for each (Body and Willpower), and the shorter of the two dose intervals. 'off'.
   */
  addictionBoth: 'book' as 'book' | 'off',
  /** 'wearOff': the addiction and Tolerance tests are rolled when the dose wears off (Shadowtech p. 87); 'dose' (v0.95.1): at the dose. */
  addictionTiming: 'wearOff' as 'wearOff' | 'dose',
  /**
   * 'book': after the recovery the character rests for the drug's Addiction rating in days (VERIFY: the book gives no
   * unit; days, as its boxes come back every three days) at +1 to every TN (+2 concentration), then is cured. 'off'.
   */
  addictionRest: 'book' as 'book' | 'off',
  /** 'book': every 24 hours of forced withdrawal without a dose, the current rating drops 1 (never below the base). 'off'. */
  addictionFall: 'book' as 'book' | 'off',
  /**
   * 'card': every week addicted (not recovering) the GM's client posts a card: ½ Essence lost for good (an Apply
   * button) and a box off each track's maximum (noted; the system has no shorter track). 'off' (v0.95.1).
   */
  addictionAttrition: 'card' as 'card' | 'off',
  addictionAttritionEssence: 0.5,
  /**
   * DocWagon's response time (Neo-Anarchist's Guide p. 95). 'book': 1D6 for the unit (1–4 ground, 5–6 air; −2 minutes
   * by air), then 3D6 minutes, at least 4; the GM adds the area's and Enforcement Rating's modifiers. 'off' (v0.95.1):
   * the contract's fixed minutes (RULES.HEALTH_V61.docwagon).
   */
  docwagonResponse: 'book' as 'book' | 'off',
  docwagonResponseMin: 4,
  docwagonAirModifier: -2,
  /**
   * High Threat Response (Core p. 250). 'book': the HTR charge `htrFee` less the contract's discount: Gold 50 percent,
   * Platinum all of it (VERIFY: the book names no price; the v0.61.0 Gold fee is the undiscounted charge). 'off'
   * (v0.95.1): the tier's own htrFee.
   */
  docwagonHtr: 'book' as 'book' | 'off',
  htrFee: 5000,
  htrDiscount: { basic: 0, gold: 0.5, platinum: 1 } as Record<string, number>,
  /** Extended care (Core p. 250). 'book': a paid-up Gold contract takes 10 percent off care fees, Platinum 50. 'off' (v0.95.1). */
  docwagonExtendedCare: 'book' as 'book' | 'off',
  extendedCareDiscount: { basic: 0, gold: 0.1, platinum: 0.5 } as Record<string, number>,
  /**
   * Neuro-stun (Core p. 186). 'book': anyone exposed is disoriented for an hour (+2 to every TN), even if the Stun is
   * resisted (a toxin whose name says neuro-stun). 'off' (v0.95.1).
   */
  neuroStun: 'book' as 'book' | 'off',
  neuroStunMinutes: 60,
  neuroStunTn: 2,
  /**
   * The medkit's advice (Core p. 250: an expert system with Biotech 3 that advises the user). 'book': first aid with a
   * medkit rolls the kit's Biotech when it beats the healer's dice or the healer would default (then without the
   * defaulting modifier; other modifiers stay) (VERIFY: the book's "advise the user" read as lending its rating).
   * 'off' (v0.95.1).
   */
  medkitAdvice: 'book' as 'book' | 'off',
  medkitBiotech: 3,
};

/** The house-rules window's rows for HEALTH_V96 (spread into settings.ts HOUSE_RULES). */
export const HOUSE_HEALTH_V96: Array<{ path: string; section: string; type: 'number' | 'boolean' | 'select'; choices?: string[]; step?: number }> = [
  { section: 'characters', path: 'HEALTH_V96.stunRestInterrupted', type: 'select', choices: ['book', 'off'] },
  { section: 'characters', path: 'HEALTH_V96.healingLifestyle', type: 'select', choices: ['book', 'off'] },
  { section: 'characters', path: 'HEALTH_V96.medicalCosts', type: 'select', choices: ['book', 'off'] },
  { section: 'characters', path: 'HEALTH_V96.medicalCostsTable.hospitalPerDay', type: 'number' },
  { section: 'characters', path: 'HEALTH_V96.medicalCostsTable.intensivePerDay', type: 'number' },
  { section: 'magicAndCritters', path: 'HEALTH_V96.healingSpellTime', type: 'select', choices: ['book', 'off'] },
  { section: 'characters', path: 'HEALTH_V96.antidoteAttention', type: 'select', choices: ['book', 'off'] },
  { section: 'characters', path: 'HEALTH_V96.patchImplants', type: 'select', choices: ['book', 'off'] },
  { section: 'magicAndCritters', path: 'HEALTH_V96.stimMagic', type: 'select', choices: ['core', 'awakenings', 'off'] },
  { section: 'characters', path: 'HEALTH_V96.nephriticPower', type: 'select', choices: ['book', 'off'] },
  { section: 'characters', path: 'HEALTH_V96.traumaDamper', type: 'select', choices: ['book', 'off'] },
  { section: 'characters', path: 'HEALTH_V96.painEditor', type: 'select', choices: ['book', 'off'] },
  { section: 'characters', path: 'HEALTH_V96.addictionBoth', type: 'select', choices: ['book', 'off'] },
  { section: 'characters', path: 'HEALTH_V96.addictionTiming', type: 'select', choices: ['wearOff', 'dose'] },
  { section: 'characters', path: 'HEALTH_V96.addictionRest', type: 'select', choices: ['book', 'off'] },
  { section: 'characters', path: 'HEALTH_V96.addictionFall', type: 'select', choices: ['book', 'off'] },
  { section: 'characters', path: 'HEALTH_V96.addictionAttrition', type: 'select', choices: ['card', 'off'] },
  { section: 'characters', path: 'HEALTH_V96.docwagonResponse', type: 'select', choices: ['book', 'off'] },
  { section: 'characters', path: 'HEALTH_V96.docwagonHtr', type: 'select', choices: ['book', 'off'] },
  { section: 'characters', path: 'HEALTH_V96.htrFee', type: 'number' },
  { section: 'characters', path: 'HEALTH_V96.docwagonExtendedCare', type: 'select', choices: ['book', 'off'] },
  { section: 'characters', path: 'HEALTH_V96.neuroStun', type: 'select', choices: ['book', 'off'] },
  { section: 'characters', path: 'HEALTH_V96.medkitAdvice', type: 'select', choices: ['book', 'off'] },
];
