/**
 * v0.97.0 rules completeness, the Matrix: IC and cybercombat. Read through RULES.MXIC_V97. Book rules from Virtual
 * Realities 2.0 (VR2, which replaces the Core Rulebook's Matrix rules) that the system did not have before v0.97.0, each
 * with its page in the comment. Each switch's first choice is the book's way (the default); the other ('v965') puts the
 * v0.96.5 behaviour back. Pure logic lives beside it in rules/mxic97.ts, the Foundry glue in applications/mxic97.ts.
 */
export const MXIC_V97 = {
  /**
   * Suppressing IC (VR2 p. 40; Unsuppress IC, a Free Action, p. 120). When a decker crashes IC (or a data bomb goes off
   * on them) they choose at once: the IC's points go on their security tally, or they suppress it and their Detection
   * Factor drops by 1 per suppressed IC while they stay in that host. Releasing it (any time) gives the point back and
   * puts its points on the tally. 'book': the GM side's crash card asks (its points wait for the choice); what was
   * suppressed is recorded on the host (GM-owned), never on the decker. 'v965': the points go on the tally at once
   * (no suppressing).
   */
  suppress: 'book' as 'book' | 'v965',
  /**
   * Black IC's last shot (VR2 p. 48): when lethal black IC kills the decker (non-lethal: knocks them out), it makes one
   * more attack at the MPCP as blaster IC with double its rating (Blaster Test vs MPCP + Hardening, 1 MPCP per 2
   * successes); if the MPCP is destroyed, all data downloaded during the run is deleted and the MPCP is 0. 'v965':
   * nothing more.
   */
  blackIcKill: 'book' as 'book' | 'v965',
  /**
   * Improvised attacks (VR2 pp. 120, 123): a Simple Action writes a one-shot attack program: its Power is points taken
   * from the persona's Evasion and/or Bod (at most the MPCP), and a Computer Test against the Power gives its Damage
   * Level (1 success L, 2 M, 3 S, 4+ D). The points stay off until the attack is made (after a failed test, until the
   * decker's next action). 'v965': no improvised attacks.
   */
  improvised: 'book' as 'book' | 'v965',
  /**
   * The parry-attack maneuver (VR2 p. 122): its +TN lasts until the opponent's next attack on the parrying icon
   * (through the opponent's position maneuvers); an evade maneuver ends it. No cap beyond the decker's dice for the
   * test. Recorded by the GM side on the host (a player's maneuver card asks the GM to apply it). 'v965': until
   * the end of the next Combat Turn (RULES.MATRIX_V57.maneuvers.turns), capped at maneuvers.maxTn.
   */
  parry: 'book' as 'book' | 'v965',
  /**
   * The position-attack maneuver (VR2 p. 122): the winner of the opposed test (the opponent, when they win: it
   * backfires) gets the net successes off the TN or onto the Power of its next attack (the attacker picks), until that
   * attack. No cap. 'v965': only the maneuvering decker gains (−TN), until the end of the next Combat Turn.
   */
  position: 'book' as 'book' | 'v965',
  /**
   * Evade detection (VR2 p. 121): IC finds an evading icon again after as many Combat Turns as the net successes,
   * 1 turn less for every point added to the icon's security tally meanwhile (its end and the tally then recorded on
   * the host by the GM side). 'v965': until the end of the next Combat
   * Turn (RULES.MATRIX_V57.maneuvers.turns).
   */
  evade: 'book' as 'book' | 'v965',
  /**
   * Ripper IC (VR2 p. 43): attacks as a crippler (the icon attribute, until the decker jacks out); whenever it damages
   * the icon, a Ripper Test (its rating) against the MPCP + Hardening takes 1 point per success off the persona chip
   * for good (replace the chip). 'v965': the crippler loss goes on the deck itself.
   */
  ripper: 'book' as 'book' | 'v965',
  /**
   * Tar baby and tar pit (VR2 pp. 42–43): an opposed test: the tar rolls its rating against the utility's rating, the
   * utility its rating against the tar's (the tar's TN −2 in a construct or party); more tar successes crash the
   * utility and the tar (no tally). Passive utilities (armor, sleaze) are not attacked. Tar pit: then a Tar Pit Test
   * (its rating) against the MPCP + Hardening: any success corrupts every copy in the deck (erased); none, and it can be
   * reloaded. 'v965': the IC's attack test (the host's Security Value), tar pit always erases.
   */
  tar: 'book' as 'book' | 'v965',
  /**
   * Scramble IC (VR2 p. 42): poison scramble (a scrambled file without a data bomb) destroys the data only when a
   * Poison Test (its rating) against the decker's Computer skill succeeds after a failed decryption; exploding scramble
   * (with a data bomb) sets the bomb off instead (as before). 'v965': a failed decryption destroys the file.
   */
  scramble: 'book' as 'book' | 'v965',
  /**
   * Data bombs (VR2 p. 41; the Defuse utility p. 96): defusing is a System Test against the subsystem the bomb is on
   * (Files or Slave), the Defuse utility lowering the TN; a failure leaves it primed unless all the dice come up 1 (it
   * goes off). The explosion adds the bomb's rating to the tally (no alert) unless the decker suppresses it (1 point of
   * Detection Factor, as `suppress`). 'v965': Decrypt against the bomb's rating; the alert rises to
   * RULES.MATRIX_V57.bombs.alert.
   */
  dataBomb: 'book' as 'book' | 'v965',
  /**
   * Running a hot deck cool (VR2 p. 85: a hot ASIST deck run cool with a keyboard): 1D6 less Initiative (at least 1D6,
   * VERIFY). Only a deck marked Hot ASIST (cyberdeck `hotAsist97`, off by default) in cold sim; a cool-only deck runs
   * cool with no penalty. 'v965': none.
   */
  coolInit: 'book' as 'book' | 'v965',
  /**
   * Reality filters (VR2 pp. 84, 87; Mapping Matrices p. 69): a filter is one more level of Response Increase (+2
   * Reaction, +1D6), beyond the deck's 3 (5 at most), and lowers the MPCP by 1; in a sculpted host where the MPCP Test
   * fails the bonus is lost. 'v965': +RULES.MATRIX_V57.realityFilter.reaction Reaction and pool on success, +failTn on
   * failure. The book's way needs the book persona speed (RULES.MATRIX_V923.initiative 'book'); with 'v922' the old
   * effect stays (no MPCP cost).
   */
  realityFilter: 'book' as 'book' | 'v965',
  /**
   * Non-combat actions (VR2 p. 120): outside combat a decker has Reaction ÷ 10 (round up) actions per 3-second turn,
   * +1 per Initiative die beyond the first; shown on the persona. 'v965': not shown.
   */
  nonCombat: 'book' as 'book' | 'v965',
};

const BV = ['book', 'v965'];
/** The house-rules window's rows for MXIC_V97 (spread into settings.ts HOUSE_RULES). */
export const HOUSE_MXIC_V97: Array<{ path: string; section: string; type: 'number' | 'boolean' | 'select'; choices?: string[]; step?: number }> = (
  Object.keys(MXIC_V97) as Array<keyof typeof MXIC_V97>
).map((k) => ({ section: 'magicAndTheMatrix', path: `MXIC_V97.${k}`, type: 'select' as const, choices: BV }));
