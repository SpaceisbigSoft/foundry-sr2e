/**
 * v0.97.0 rules completeness: the decker's life outside a fight (Virtual Realities 2.0, which replaces the Core
 * Rulebook's Matrix rules). Read through RULES.MXLIFE_V97. Book rules the system did not have before v0.97.0, each
 * with its book and page in the comment. Each switch's first choice is the book's way (the default); the other choice
 * ('v965') puts the v0.96.5 behaviour back. Pure logic lives beside it in rules/mxlife97.ts, the Foundry glue in
 * applications/mxlife97.ts.
 */
export const MXLIFE_V97 = {
  /**
   * Recovering from psychotropic effects (VR2 p. 50): a Willpower (the psychotropic IC's rating) Test every week, every
   * day for Matrix maniac (here: frenzy); −1 TN under medication or magical treatment, −2 under intensive psychotherapy
   * (a Hospitalized lifestyle; not cumulative with medication), a further −1 under a sustained, locked or quickened
   * spell; +1 for positive conditioning. Cyberphobia's recovery begins only once the decker is medicated or under
   * magical treatment (VR2 p. 49); the Judas effect's once the companions have caught it and stop the decker (VR2
   * p. 49). 'book': the lead GM's world clock whispers the GM a card when a test is due; the GM rolls it there (with the
   * treatment) and a success takes the effect off. Needs MATRIX_V923.psychotropic 'book' (an effect that lasts until
   * recovered). 'v965': the GM clears the effect by hand.
   */
  psychRecovery: 'book' as 'book' | 'v965',
  /**
   * Paydata going stale (VR2 p. 65): a decker's stock of Paydata Points drops by 1 for each day it stays unsold. Only
   * the random method's points count (a downloaded paydata file worth one Paydata Point, MATRIX_V923.paydataPoint):
   * a file the GM priced for the story is left alone, as the book says. 'book': the lead GM's world clock takes the
   * oldest point off each day (the file stays in storage, worth nothing) and tells the owner. 'v965': it keeps.
   */
  paydataDecay: 'book' as 'book' | 'v965',
  /**
   * Cook and Installation tasks (VR2 pp. 77, 82–88): after the design (software) task a deck part's chips are cooked
   * (Computer B/R against the part's TN, base time by part) and the part installed (a second test and base time); each
   * task's days are its base time ÷ successes (a failed test wastes base ÷ 2D6 days, round up, and the task starts
   * again). 'book': both tests are rolled (secretly, as VR2 p. 77 asks) when the design succeeds, and their days are
   * added to the part's work time. 'v965': the design's days only.
   */
  cookInstall: 'book' as 'book' | 'v965',
  /**
   * Channels as skills (VR2 p. 144; otaku errata, Renraku Arcology: Shutdown 1998, entry 3): the five channels are skills
   * linked to Willpower, improved with Karma like any other skill (the skill Karma rules, CORE_V923.newSkill included)
   * and not capped by the living persona's MPCP. 'v965': new rating × MATRIX.otaku.channels.karmaPerRating, at most
   * MPCP (MATRIX.otaku.channels.maxFromMpcp).
   */
  otakuChannels: 'book' as 'book' | 'v965',
  /**
   * Programming a complex form (VR2 p. 145; otaku errata entries 5, 6): a rating up to the otaku's Computer Skill (not
   * the MPCP); no operational utility (those are channel specializations) and no Hardening (part of the living
   * persona); Karma = the rating; size as a program's, base time size × 2 days (MATRIX.programming.daysPerMp), a Computer
   * (rating) Test divides it, and the otaku task bonus ((Intelligence + Charisma) ÷ 4, round up) shortens it as a task
   * bonus does (VR2 p. 77). The form is ready when its days have passed (a project while WAITING runs for the Matrix).
   * A failed test wastes base ÷ 2D6 days and costs no Karma (VERIFY: the book has the Karma paid before the task and
   * doesn't say whether a flawed attempt loses it). 'v965': learned at once, at most MPCP.
   */
  complexForms: 'book' as 'book' | 'v965',
  /**
   * The otaku's free Armor (VR2 p. 145, Living Persona: Armor = Willpower; p. 145 Armor/Hardening; errata entry 11 calls
   * it a free Armor complex form): the living persona resists persona damage with Armor equal to Willpower, unless an
   * Armor complex form or utility above it is loaded. It never wears down (only a loaded utility does). 'v965': only
   * a loaded Armor utility.
   */
  otakuArmor: 'book' as 'book' | 'v965',
  /**
   * IC on the Matrix scene (a table convenience, not a book rule: the v0.91.7 known limit). 'scene': IC that a host
   * launches gets a token beside the host's token on the scene the GM is viewing (hidden until the GM shows it), when
   * the host stands on that scene. 'v965': IC launches from the sheaf without a token, as before.
   */
  icToken: 'scene' as 'scene' | 'v965',
};

const BV = ['book', 'v965'];
/** The house-rules window's rows for MXLIFE_V97 (spread into settings.ts HOUSE_RULES). */
export const HOUSE_MXLIFE_V97: Array<{ path: string; section: string; type: 'number' | 'boolean' | 'select'; choices?: string[]; step?: number }> = [
  { section: 'magicAndTheMatrix', path: 'MXLIFE_V97.psychRecovery', type: 'select', choices: BV },
  { section: 'magicAndTheMatrix', path: 'MXLIFE_V97.paydataDecay', type: 'select', choices: BV },
  { section: 'magicAndTheMatrix', path: 'MXLIFE_V97.cookInstall', type: 'select', choices: BV },
  { section: 'magicAndTheMatrix', path: 'MXLIFE_V97.otakuChannels', type: 'select', choices: BV },
  { section: 'magicAndTheMatrix', path: 'MXLIFE_V97.complexForms', type: 'select', choices: BV },
  { section: 'magicAndTheMatrix', path: 'MXLIFE_V97.otakuArmor', type: 'select', choices: BV },
  { section: 'magicAndTheMatrix', path: 'MXLIFE_V97.icToken', type: 'select', choices: ['scene', 'v965'] },
];
