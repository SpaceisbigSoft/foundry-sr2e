/**
 * v0.99.0 rules completeness, clinics, surgery and ware damage. Read through RULES.CLINIC_V99. Book rules from the Street
 * Samurai Catalog (SSC, Optional Rules pp. 93–99), Shadowtech ("Cybertechnology", pp. 36–41) and Cybertechnology
 * ("Cyberware Rules", pp. 44, 53–54) that the system did not have before v0.99.0, each with its page in the comment.
 * Each switch's first choice is the book's way (the default); the other ('v980') puts the v0.98.0 behaviour back. Pure
 * logic lives beside it in rules/clinic99.ts, the Foundry glue in applications/clinic99.ts.
 *
 * Trust: a found clinic and a ware damage level the GM side relies on are kept in GM-written world settings (only a GM
 * client writes them). A level on the ware item itself (player-writable) can only make the damage worse, never better.
 */
export const CLINIC_V99 = {
  /**
   * Finding a shadow clinic (SSC p. 99, "Finding a Shadow Clinic"; delta: Cybertechnology p. 44): the GM's tool rolls
   * the contact's Etiquette (Street) Success Test against 12 (alpha) or 15 (beta) on the street, 11 or 17 through the
   * corps (one success: the contact knows one); a contact who doesn't may search: Intelligence + the lower of Charisma
   * and Etiquette (Street) dice against the same TN, 2 successes for alpha, 3 for beta, base time 5 days ÷ the successes.
   * A delta clinic has no test (the corp has to want the character; the GM records it). The found clinic is kept in a
   * GM-written world setting and the surgery card names it. 'v980': no clinic step.
   */
  clinicSearch: 'book' as 'book' | 'v980',
  /**
   * The surgeon's fee (Cybertechnology p. 54, Medical Costs Table, "Surgery (includes cost of surgeon)"; Core
   * pp. 114–115 for the sizes): minor cosmetic 1,000¥, minor invasive 5,000¥, major invasive 25,000¥, drastic invasive
   * 250,000¥ by the operation's size (Essence: none, up to .4, .41–.99, 1+; bioware by its Body Index bands), charged to
   * the patient once per operation. 'v980': no fee (only the recovery care is charged).
   */
  surgeonFee: 'book' as 'book' | 'v980',
  /**
   * Graded clinic fees (Cybertechnology p. 44, Cost Multiplier and Medical Fees; SSC p. 98): for alpha- and beta-grade
   * cybersurgery the doctor's fees and hospitalization are 50 times the medical rates, for delta-grade 200 times: the
   * surgeon's fee and the recovery care's daily cost are multiplied. 'v980': graded ware pays the standard rates.
   */
  gradedFees: 'book' as 'book' | 'v980',
  /** The graded multipliers (Cybertechnology p. 44): alpha and beta 50, delta 200. */
  feeAlphaBeta: 50,
  feeDelta: 200,
  /**
   * Removing cyberware (Shadowtech pp. 36–41, Cybersystem Implementation; SSC p. 97 for upgrades): the surgeon's
   * Biotech (B/R) or Cybernetics (B/R), whichever is lower, against 10 − the patient's current Essence (round down); no
   * successes and the patient also loses 10% of the ware's Essence cost (rounded up to the tenth) for good. The GM's
   * tool runs it (the surgeon is often an NPC); the ware comes out (its Essence stays lost: an Essence hole). 'v980':
   * no removal test (unticking Installed takes it out).
   */
  removal: 'book' as 'book' | 'v980',
  /**
   * Ware damage levels (Shadowtech pp. 36–41, System Damage): a damaged system is Light (it works at half: its
   * bonuses halved, fractions dropped), Moderate (it stops working), Serious (stops; +1 TN on every test the character
   * makes) or Deadly (stops; +2 TN), each system's penalty adding up; past Deadly it is destroyed (no penalty, it can
   * only be replaced). The system damage check writes the level on the item; the lead GM keeps it in a GM-written
   * record, so lowering the item's own level doesn't lower it. A second hit before repair raises the level one step
   * past the worse of the two (Shadowtech: "accumulates"; VERIFY). 'v980': damaged or not (Moderate or worse stops it).
   */
  damageLevels: 'book' as 'book' | 'v980',
  /**
   * Repair by damage level (Shadowtech pp. 36–41): the lower of Biotech (B/R) and Cybernetics (B/R) against 2 (Light),
   * 3 (Moderate), 4 (Serious) or 8 (Deadly), doubled for alpha and tripled for beta grade (delta: tripled, VERIFY);
   * base time twice the ware's base Essence cost in hours, × 2 Moderate, × 3 Serious, × 4 Deadly (delta × 4 more,
   * Cybertechnology p. 44), ÷ the successes; parts 5% / 10% / 20% / 40% of its cost by level (shown). A destroyed
   * system can't be repaired. 'v980': RULES.CYBERWARE.repair's skill, TN and hours.
   */
  repair: 'book' as 'book' | 'v980',
};

const BV = ['book', 'v980'];
/** The house-rules window's rows for CLINIC_V99 (spread into settings.ts HOUSE_RULES). */
export const HOUSE_CLINIC_V99: Array<{ path: string; section: string; type: 'number' | 'boolean' | 'select'; choices?: string[]; step?: number }> = [
  ...(['clinicSearch', 'surgeonFee', 'gradedFees', 'removal', 'damageLevels', 'repair'] as const)
    .map((k) => ({ section: 'gear', path: `CLINIC_V99.${k}`, type: 'select' as const, choices: BV })),
  { section: 'gear', path: 'CLINIC_V99.feeAlphaBeta', type: 'number', step: 1 },
  { section: 'gear', path: 'CLINIC_V99.feeDelta', type: 'number', step: 1 },
];

/** The tables behind CLINIC_V99 (not house-rule rows). */
export const CLINIC_V99_TABLES = {
  /** SSC p. 99: [alpha, beta] TN by route; successes needed when the contact searches. */
  searchTn: { street: { alpha: 12, beta: 15 }, corp: { alpha: 11, beta: 17 } } as Record<string, Record<string, number>>,
  searchNeed: { alpha: 2, beta: 3 } as Record<string, number>,
  searchDays: 5,
  /** Cybertechnology p. 54: the surgery's cost by its size (the wound it gives, Core p. 114). */
  surgeryFee: { L: 1000, M: 5000, S: 25000, D: 250000 } as Record<string, number>,
  /** Shadowtech pp. 36–41: repair TN, time multiple and parts share by damage level. */
  repairTn: { L: 2, M: 3, S: 4, D: 8 } as Record<string, number>,
  repairTime: { L: 1, M: 2, S: 3, D: 4 } as Record<string, number>,
  repairParts: { L: 0.05, M: 0.1, S: 0.2, D: 0.4 } as Record<string, number>,
  /** Repair TN × by grade (Shadowtech; delta as beta, VERIFY) and repair time × (Cybertechnology p. 44: delta × 4). */
  repairGradeTn: { standard: 1, alpha: 2, beta: 3, delta: 3 } as Record<string, number>,
  repairGradeTime: { standard: 1, alpha: 1, beta: 1, delta: 4 } as Record<string, number>,
  /** Serious +1, Deadly +2 TN on all the character's tests, per system (Shadowtech). */
  feedbackTn: { S: 1, D: 2 } as Record<string, number>,
  /** The removal test's Essence loss on no successes: 10% of the ware's cost, rounded up to the tenth. */
  removalLoss: 0.1,
};
