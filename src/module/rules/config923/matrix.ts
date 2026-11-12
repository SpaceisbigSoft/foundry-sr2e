/**
 * v0.92.3 book alignment: The Matrix. Read through RULES.MATRIX_V923. Every value here was checked against the SR2 books
 * (book and page in each comment). Each switch's first choice is the book's way (the default); the other puts the
 * old v0.92.2 behaviour back. Virtual Realities 2.0 (VR2) replaces the Core Rulebook's Matrix rules; the Core is used
 * only where VR2 has no rule (smoke).
 */
export const MATRIX_V923 = {
  /**
   * System tests (VR2 p. 19): an opposed test: the decker needs more successes than the host's Security Value roll, or
   * the operation fails (the host's successes go on the tally either way); Locate Paydata finds a point per net success
   * (VR2 p. 115). 'success': 1+ successes succeed (v0.92.2).
   */
  systemTests: 'opposed' as 'opposed' | 'success',
  /**
   * The persona's Reaction and initiative (VR2 pp. 85, 87, 120): the decker's own Reaction (no cyber or magic Reaction
   * boosts) + 2 per Response Increase; Response Increase at most MPCP ÷ 4 (round down) as well as the deck's 3; a hot deck
   * on DNI counts as one more level (+2 Reaction as well as its +1D6); a tortoise halves the user's Reaction (min 1) and
   * Response Increase gives it only its dice. 'v922': Intelligence + 2 per level, hot sim only +1 die, tortoise as meat.
   */
  initiative: 'book' as 'book' | 'v922',
  /** IC initiative (VR2 p. 120): rating + 1D6 Blue, 2D6 Green, 3D6 Orange, 4D6 Red (black: as Red). 'v922': `oldIcInitiativeDice`. */
  icInitiative: 'book' as 'book' | 'v922',
  oldIcInitiativeDice: { blue: 1, green: 1, orange: 2, red: 2, black: 3 } as Record<string, number>,
  /** A passive alert raises every subsystem rating by this much (VR2 p. 61). 0: none (v0.92.2). */
  passiveAlert: 2,
  /**
   * Crashing IC in cybercombat adds to the attacker's security tally (VR2 p. 40): 'rating' (the IC's rating), 'half'
   * (half its rating, round up: the book's option without utility options), 'none' (v0.92.2).
   */
  crashTally: 'rating' as 'rating' | 'half' | 'none',
  /**
   * Host shutdown (VR2 p. 53): 'dice': the sequence lasts 1D6 per 2 points (or part) of the Security Value Combat Turns.
   * 'fixed': RULES.MATRIX_V57.shutdown.turns (v0.92.2).
   */
  shutdown: 'dice' as 'dice' | 'fixed',
  /**
   * System operations (VR2 p. 161 System Operations Table): the tests, utilities and actions of the table, and Locate
   * File as an interrogation (VR2 p. 110: net successes add up; every 5 locate a file). 'v922': `oldOperations`
   * patches the old values back over RULES.MATRIX.operations, and each success finds a file.
   */
  operations: 'book' as 'book' | 'v922',
  locateFileSuccesses: 5,
  oldOperations: {
    analyzeHost: { action: 'simple' }, analyzeIc: { action: 'simple' }, redirectDatatrail: { utility: 'relocate' },
    crashHost: { utility: '' }, invalidatePasscode: { utility: '' }, validatePasscode: { subsystem: 'access' },
    makeComcall: { subsystem: 'slave', utility: '' }, tapComcall: { subsystem: 'slave', utility: 'spoof' },
    decryptAccess: { action: 'complex' }, gracefulLogoff: { action: 'simple' }, locateSlave: { utility: 'browse' },
    downloadData: { action: 'complex' }, uploadData: { action: 'complex' }, editFile: { action: 'complex' },
    decryptFile: { action: 'complex' }, decryptSlave: { action: 'complex' },
    nullOperation: { subsystem: 'access', utility: '', action: 'simple' },
  } as Record<string, { subsystem?: 'access' | 'control' | 'index' | 'files' | 'slave'; utility?: string; action?: 'simple' | 'complex' }>,
  /** Operations the book's table has that v0.92.2 did not (left out with 'v922'). */
  newOperations: ['relocateTrace', 'locateIcOp', 'dumpLog'] as readonly string[],
  /**
   * Cybercombat (VR2 pp. 40, 121, 123; IC p. 41, p. 52): a decker attacks with the offensive utility's rating (+ Hacking
   * Pool); the TN comes from the host's security code and the target's status (Intruding Blue 6, Green 5, Orange 4,
   * Red 3; Legitimate 3/4/5/6; a validated passcode is Legitimate); IC resist damage and maneuver with the Security
   * Value; party IC: +1 TN per member on their attacks and on attacks on them; a crippler or ripper attack is opposed
   * by the targeted persona attribute (TN = the IC's rating). 'v922': Computer + Hacking Pool vs the IC's rating or
   * the persona's Evasion, IC resist and maneuver with their rating, no party modifier, no opposed roll.
   */
  cybercombat: 'book' as 'book' | 'v922',
  attackTn: {
    intruding: { blue: 6, green: 5, orange: 4, red: 3, black: 3 } as Record<string, number>,
    legitimate: { blue: 3, green: 4, orange: 5, red: 6, black: 6 } as Record<string, number>,
  },
  /** Attacks and combat maneuvers are Simple Actions (VR2 pp. 120–121, 123). 'v922': Complex. */
  actions: 'book' as 'book' | 'v922',
  /** IC damage level by the host's code (VR2 p. 123: Blue/Green M, Orange/Red S), for killer, blaster, sparky and black IC. 'own': the IC's own level. */
  icDamageLevel: 'code' as 'code' | 'own',
  icDamageByCode: { blue: 'M', green: 'M', orange: 'S', red: 'S', black: 'S' } as Record<string, 'L' | 'M' | 'S' | 'D'>,
  /** Persona damage resistance (VR2 p. 123): Bod vs Power − Armor; Hardening protects the deck and the decker, not the icon. 'hardening': Hardening lowers the Power too (v0.92.2). */
  iconHardening: 'none' as 'none' | 'hardening',
  /**
   * Simsense overload (VR2 p. 124): a hot deck, any white or gray IC damage to the icon: Willpower vs Light 2, Moderate 3,
   * Serious 5 (+2 pure DNI hot, −2 ICCM); fail: Light Stun. 'v922': Serious or worse, Willpower vs the Power.
   */
  overload: 'book' as 'book' | 'v922',
  overloadTn: { L: 2, M: 3, S: 5 } as Record<string, number>,
  /**
   * Dump shock (VR2 p. 124): Power = the Security Value, level by code; a cool deck and an ICCM each take 2 off the Power
   * and a level (they add up; an ICCM's dice never count on top); any jack-out without a Graceful Logoff risks it.
   * 'v922': neither reduction, and jacking out on purpose is free (ICCM gives its dice). All of v0.92.2 also needs the
   * values moved in place set back: RULES.MATRIX_V57.dumpShock.levelBy 'fixed', RULES.MATRIX.sim.hot.dumpShockType
   * 'physical', RULES.MATRIX.iccm.dicePerRating 1.
   */
  dumpShock: 'book' as 'book' | 'v922',
  /**
   * Black IC (VR2 pp. 17, 47–50, 86): lethal black IC (Physical) is resisted with Body, non-lethal (Stun) with
   * Willpower, Hardening lowers the Power, no Hacking Pool, and the icon resists the same damage with its Bod; the IC
   * holds a decker only after a hit; jacking out under it: Willpower (IC rating), ICCM −2 TN, no Hacking Pool, and the
   * IC gets one more attack; an ICCM resists with the better of Body or Willpower (it does not turn the damage to Stun).
   * The book's way ignores RULES.MATRIX.iccm.dicePerRating (no ICCM dice on top of the better attribute).
   * 'v922': RULES.MATRIX.blackIcResist + Hacking Pool, no Hardening, held on any attack, ICCM Stun and dice; all of
   * v0.92.2 also needs the values moved in place set back: RULES.MATRIX.iccm.blackIcStun true, dicePerRating 1.
   */
  blackIc: 'book' as 'book' | 'v922',
  /**
   * Psychotropic IC (VR2 pp. 49–50): the hits mark the decker; one Willpower (IC rating) test when they jack out or are
   * dumped (−2 TN on a cool deck; no Shield, no Hacking Pool); cyberphobia adds the IC's rating to computer TNs; the
   * effect lasts until the decker recovers (Willpower (rating) tests, weekly; Matrix maniac daily). 'v922': a test on
   * every hit, rating × RULES.MATRIX.psychotropic.daysPerRating days, cyberphobia +RULES.MATRIX.psychotropic.cyberphobiaTn.
   */
  psychotropic: 'book' as 'book' | 'v922',
  /**
   * Gray IC (VR2 pp. 43–45): the Blaster Test's TN is the MPCP + Hardening; the Sparky Test's MPCP + 2 + Hardening, and
   * its (rating)M to the decker stages up a level per 2 Sparky successes, resisted with Body, Hardening off the Power;
   * gray IC damage is permanent: the damaged chip must be replaced (no repair test). 'v922': rating vs MPCP, sparky
   * RULES.MATRIX.sparky, deck repair tests.
   */
  grayIc: 'book' as 'book' | 'v922',
  /** Probe IC (VR2 p. 42): reactive: a Probe (rating) Test vs the Detection Factor with every System Test, onto the tally. 'active': it rolls only when the GM acts with it. */
  probe: 'reactive' as 'reactive' | 'active',
  /**
   * Trace IC (VR2 pp. 45–47, 114, 117; Grids and Hosts p. 28): the hunt TN is the Trace Factor (Evasion − the trace's
   * rating + Camo + 1 per Redirect Datatrail + the jackpoint's trace modifier); the location cycle is 10 ÷ successes
   * turns, round down (min 1); it reports (proactive IC −1 TN, +1 on every tally increase); jacking out leaves the
   * datatrail up 1D6 − 1 turns (min 1); a Graceful Logoff (TN + the trace's rating) stops it; Redirect Datatrail adds 1
   * to the Trace Factor; Relocate (Control, Simple) spoofs it for a turn. 'v922': Evasion, round up, the IC's trace mode,
   * jacking out ends it, Redirect ends it.
   */
  trace: 'book' as 'book' | 'v922',
  /**
   * Graceful Logoff (VR2 p. 114): leaves the host and the grid (the decker is out) with no dump shock, and stops a trace.
   * 'v922': moves to the parent grid.
   */
  logoff: 'book' as 'book' | 'v922',
  /**
   * Jackpoints (VR2 Grids and Hosts pp. 28–30): the jackpoint modifies Access tests only (legal −2, illegal 0, satellite
   * +2 and −2 Reaction, workstation −4, remote device +4, console: Access and Security Value halved, round down), and the
   * Trace Factor.
   * 'v922': RULES.MATRIX.connections on every Matrix test.
   */
  connections: 'book' as 'book' | 'v922',
  jackpoints: {
    jackpoint: { access: 0, trace: 0 }, legal: { access: -2, trace: -2 }, satellite: { access: 2, trace: 0, reaction: -2 },
    workstation: { access: -4, trace: -4 }, device: { access: 4, trace: 4 }, console: { access: 0, trace: -6 },
    // Not in VR2 (wireless links of this system): their v0.92.2 modifiers, on Access tests only.
    cellular: { access: 1, trace: 0 }, vehicle: { access: 1, trace: 0 }, remote: { access: 2, trace: 0 },
  } as Record<string, { access: number; trace: number; reaction?: number }>,
  /** Armor (VR2 p. 99): loses a point only when it fails to absorb the whole hit. 'every': every hit it soaks (v0.92.2). */
  armorWear: 'failed' as 'failed' | 'every',
  /**
   * Shield (VR2 p. 100): a parry: Shield (rating) vs the attacker's skill (Computer, Security Value, frame rating); its
   * successes come off the attacker's net; −1 rating per use. 'soak': its rating off black IC damage (v0.92.2).
   */
  shield: 'parry' as 'parry' | 'soak',
  /**
   * Frames (VR2 pp. 104–105): a dumb frame acts with its owner's Computer, a smart frame with its rating; the utilities
   * it carries may total no more than its rating. 'v922': rating (+ pool) dice, a count of utilities.
   */
  frames: 'book' as 'book' | 'v922',
  /**
   * Deck parts (VR2 pp. 83–87): design sizes MPCP rating² × 8, Bod and Evasion rating² × 3, Masking and Sensors × 2,
   * Hardening MPCP² × Hardening (TN the MPCP; the worked example of VR2 p. 83), Response Increase MPCP² × (level × 2) with
   * TN level × 2. 'v922': the sizes and TNs of RULES.MATRIX.deckBuilding.parts.
   */
  deckBuilding: 'book' as 'book' | 'v922',
  /**
   * Otaku (VR2 p. 145; otaku errata): MPCP (I + W + C) ÷ 3 round up; Masking (W + C) ÷ 2 round up; Hardening W ÷ 2;
   * Reaction (I + W) ÷ 2. 'v922': MPCP round down, Masking C, no Hardening, Matrix Reaction as a deck's.
   */
  otaku: 'book' as 'book' | 'v922',
  /**
   * Paydata (VR2 p. 65): each file is a Paydata Point worth 5,000¥, 2D6 × 20/15/10/5 Mp (Blue → Red); defenses on 1D6 by
   * code (Green 5 bomb, 6 scramble; Orange 4 bomb, 5–6 scramble; Red 2–3 bomb, 4–5 scramble, 6 both). 'v922':
   * RULES.MATRIX.paydata (size × 5…25 Mp, value per Mp, 4–5 encrypted, 6 scramble).
   */
  paydata: 'book' as 'book' | 'v922',
  paydataPoint: 5000,
  paydataDensity: { blue: 20, green: 15, orange: 10, red: 5, black: 5 } as Record<string, number>,
  /** The 1D6 roll up to which a file has no defense, a data bomb, scramble IC; above: both. */
  paydataDefenses: {
    blue: { none: 6, bomb: 6, scramble: 6 }, green: { none: 4, bomb: 5, scramble: 6 },
    orange: { none: 3, bomb: 4, scramble: 6 }, red: { none: 1, bomb: 3, scramble: 5 }, black: { none: 1, bomb: 3, scramble: 5 },
  } as Record<string, { none: number; bomb: number; scramble: number }>,
};

/** The house-rules window's rows for MATRIX_V923 (spread into settings.ts HOUSE_RULES). */
export const HOUSE_MATRIX_V923: Array<{ path: string; section: string; type: 'number' | 'boolean' | 'select'; choices?: string[]; step?: number }> = [
  { section: 'magicAndTheMatrix', path: 'MATRIX_V923.systemTests', type: 'select', choices: ['opposed', 'success'] },
  { section: 'magicAndTheMatrix', path: 'MATRIX_V923.initiative', type: 'select', choices: ['book', 'v922'] },
  { section: 'magicAndTheMatrix', path: 'MATRIX_V923.icInitiative', type: 'select', choices: ['book', 'v922'] },
  { section: 'magicAndTheMatrix', path: 'MATRIX_V923.passiveAlert', type: 'number' },
  { section: 'magicAndTheMatrix', path: 'MATRIX_V923.crashTally', type: 'select', choices: ['rating', 'half', 'none'] },
  { section: 'magicAndTheMatrix', path: 'MATRIX_V923.shutdown', type: 'select', choices: ['dice', 'fixed'] },
  { section: 'magicAndTheMatrix', path: 'MATRIX_V923.operations', type: 'select', choices: ['book', 'v922'] },
  { section: 'magicAndTheMatrix', path: 'MATRIX_V923.cybercombat', type: 'select', choices: ['book', 'v922'] },
  { section: 'magicAndTheMatrix', path: 'MATRIX_V923.actions', type: 'select', choices: ['book', 'v922'] },
  { section: 'magicAndTheMatrix', path: 'MATRIX_V923.icDamageLevel', type: 'select', choices: ['code', 'own'] },
  { section: 'magicAndTheMatrix', path: 'MATRIX_V923.iconHardening', type: 'select', choices: ['none', 'hardening'] },
  { section: 'magicAndTheMatrix', path: 'MATRIX_V923.overload', type: 'select', choices: ['book', 'v922'] },
  { section: 'magicAndTheMatrix', path: 'MATRIX_V923.dumpShock', type: 'select', choices: ['book', 'v922'] },
  { section: 'magicAndTheMatrix', path: 'MATRIX_V923.blackIc', type: 'select', choices: ['book', 'v922'] },
  { section: 'magicAndTheMatrix', path: 'MATRIX_V923.psychotropic', type: 'select', choices: ['book', 'v922'] },
  { section: 'magicAndTheMatrix', path: 'MATRIX_V923.grayIc', type: 'select', choices: ['book', 'v922'] },
  { section: 'magicAndTheMatrix', path: 'MATRIX_V923.probe', type: 'select', choices: ['reactive', 'active'] },
  { section: 'magicAndTheMatrix', path: 'MATRIX_V923.trace', type: 'select', choices: ['book', 'v922'] },
  { section: 'magicAndTheMatrix', path: 'MATRIX_V923.logoff', type: 'select', choices: ['book', 'v922'] },
  { section: 'magicAndTheMatrix', path: 'MATRIX_V923.connections', type: 'select', choices: ['book', 'v922'] },
  { section: 'magicAndTheMatrix', path: 'MATRIX_V923.armorWear', type: 'select', choices: ['failed', 'every'] },
  { section: 'magicAndTheMatrix', path: 'MATRIX_V923.shield', type: 'select', choices: ['parry', 'soak'] },
  { section: 'magicAndTheMatrix', path: 'MATRIX_V923.frames', type: 'select', choices: ['book', 'v922'] },
  { section: 'magicAndTheMatrix', path: 'MATRIX_V923.deckBuilding', type: 'select', choices: ['book', 'v922'] },
  { section: 'magicAndTheMatrix', path: 'MATRIX_V923.otaku', type: 'select', choices: ['book', 'v922'] },
  { section: 'magicAndTheMatrix', path: 'MATRIX_V923.paydata', type: 'select', choices: ['book', 'v922'] },
  // Existing values with no row before (their defaults moved to the book's; see docs/verify923/matrix.md).
  { section: 'magicAndTheMatrix', path: 'MATRIX.download.ioPerTurn', type: 'number' },
  { section: 'magicAndTheMatrix', path: 'MATRIX.attributeDamage.minOnHit', type: 'number' },
  { section: 'magicAndTheMatrix', path: 'MATRIX.utilitySize.kinds.smoke', type: 'number' },
  { section: 'magicAndTheMatrix', path: 'MATRIX.utilitySize.kinds.frame', type: 'number' },
  { section: 'magicAndTheMatrix', path: 'MATRIX.utilitySize.kinds.smart' + '-frame', type: 'number' },
];
