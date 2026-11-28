/**
 * v0.97.0 rules completeness, the Matrix: system operations (Virtual Realities 2.0, "System Operations" pp. 108–118,
 * the System Operations Table p. 162, the programs pp. 96–100). Read through RULES.MXOPS_V97. Each switch's first
 * choice is the book's way (the default); the other ('v965') puts the v0.96.5 behaviour back. Pure logic lives beside
 * it in rules/mxops97.ts, the Foundry glue in applications/mxops97.ts.
 */
export const MXOPS_V97 = {
  /**
   * Analyze Host (VR2 p. 111): each net success of the Control Test tells the decker one item of their choice: the
   * host's Security Rating (code and value) or one subsystem's rating (the book's third item, whether the host is a
   * virtual machine, has no field here); `analyzeHostAll` or more successes tell everything. The host's code is
   * "analyzed" (known) only once the Security Rating is told; Analyze Host no longer finds data bombs (Analyze
   * Subsystem does). 'v965': a success tells everything and spots every data bomb.
   */
  analyzeHost: 'book' as 'book' | 'v965',
  analyzeHostAll: 7,
  /**
   * The operations of the System Operations Table (VR2 p. 162; descriptions pp. 111–117) the catalog lacked: Analyze
   * Subsystem (the targeted subsystem, Analyze, Simple: its guarding IC and data bombs), Crash Application (the
   * appropriate subsystem, Crash, Complex), Decoy (Control, Mirrors, Complex: a decoy proactive IC may hit instead),
   * Disinfect (the appropriate subsystem, Disinfect, Complex), Dump Log (Control, Validate, Complex: the access log, a
   * downloadable file), Locate Decker (Index, Scanner, Complex, then a Sensor Test against each decker's Masking +
   * sleaze), Locate Frame (Index, Scanner, Complex: smart frames and agents), Locate IC (Index, Analyze, Complex: the
   * host's IC), Retrain (Access, Commlink, Free) and Scan Icon (Computer against the icon's Masking, Scanner − the
   * target's Sleaze, Simple: an item per success). 'v965': none of them in the catalog.
   */
  operations: 'book' as 'book' | 'v965',
  /**
   * Locate Decker's Sensor Test (VR2 p. 114) has no TN in the book. VERIFY: 4, the standard target number.
   */
  locateDeckerTn: 4,
  /** Decoy (VR2 p. 112): the boxes of a decoy's Condition Monitor (an icon's: 10); it takes full damage, no resistance. */
  decoyBoxes: 10,
  /**
   * Validate Passcode (VR2 p. 118): +2 TN for a superuser passcode, +6 for a supervisor; the passcode lasts 1D6 ×
   * the test's net successes days, and a host that reaches an active alert while its holder is on it deletes it.
   * 'v965': an ordinary passcode that lasts for ever.
   */
  validatePasscode: 'book' as 'book' | 'v965',
  passcodeTn: { user: 0, superuser: 2, supervisor: 6 } as Record<string, number>,
  /**
   * The slow utility (VR2 p. 99): an attack test (the utility's rating + Hacking Pool vs the cybercombat TN by code
   * and status), opposed by the IC's Resistance Test (the host's Security Value vs the Slow rating); every 2 net
   * successes take one action (one Initiative pass, `slowPerAction` points) off the IC this turn; with none left it
   * hangs. Reactive IC (probe, scramble, tar baby, tar pit, barrier) is immune; trace IC only while it hunts.
   * 'v965': Computer + Hacking Pool vs the IC's rating, RULES.MATRIX_V57.utilities.slow.initiativePerNet per net success.
   */
  slow: 'book' as 'book' | 'v965',
  slowPerAction: 10,
  /**
   * The restore utility (VR2 p. 100): a Restore Test (its rating) against the rating of the program that did the damage
   * (the highest, when several did); a point per 2 successes; it cannot mend the deck's permanent damage (gray or
   * black IC), and the book has it lose no rating. 'v965': RULES.MATRIX_V57.utilities.restore (TN 4, a point per
   * success, −1 rating per use).
   */
  restore: 'book' as 'book' | 'v965',
  /**
   * Interrogations (VR2 p. 110): the decker's questions modify the TN (+1 vague, +2 very vague, −1 or −2 for a
   * well-phrased or insightful one; Locate Access Node p. 114: +1 / 0 / −1), and a host that does not hold what is
   * sought says so once 3 successes are counted: Locate File tells "not here" at `notThereAt` successes when no file is
   * left to find. 'v965': no query modifier, no "not here".
   */
  interrogation: 'book' as 'book' | 'v965',
  notThereAt: 3,
  queryTn: { veryVague: 2, vague: 1, plain: 0, sharp: -1, insightful: -2 } as Record<string, number>,
};

const BV = ['book', 'v965'];
/** The house-rules window's rows for MXOPS_V97 (spread into settings.ts HOUSE_RULES). */
export const HOUSE_MXOPS_V97: Array<{ path: string; section: string; type: 'number' | 'boolean' | 'select'; choices?: string[]; step?: number }> = [
  { section: 'magicAndTheMatrix', path: 'MXOPS_V97.analyzeHost', type: 'select', choices: BV },
  { section: 'magicAndTheMatrix', path: 'MXOPS_V97.analyzeHostAll', type: 'number' },
  { section: 'magicAndTheMatrix', path: 'MXOPS_V97.operations', type: 'select', choices: BV },
  { section: 'magicAndTheMatrix', path: 'MXOPS_V97.locateDeckerTn', type: 'number' },
  { section: 'magicAndTheMatrix', path: 'MXOPS_V97.decoyBoxes', type: 'number' },
  { section: 'magicAndTheMatrix', path: 'MXOPS_V97.validatePasscode', type: 'select', choices: BV },
  { section: 'magicAndTheMatrix', path: 'MXOPS_V97.slow', type: 'select', choices: BV },
  { section: 'magicAndTheMatrix', path: 'MXOPS_V97.slowPerAction', type: 'number' },
  { section: 'magicAndTheMatrix', path: 'MXOPS_V97.restore', type: 'select', choices: BV },
  { section: 'magicAndTheMatrix', path: 'MXOPS_V97.interrogation', type: 'select', choices: BV },
  { section: 'magicAndTheMatrix', path: 'MXOPS_V97.notThereAt', type: 'number' },
];
