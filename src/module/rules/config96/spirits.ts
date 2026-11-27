/**
 * v0.96.0 rules completeness: conjuring, spirits, astral space, adepts and critter powers. Read through
 * RULES.SPIRITS_V96. Book rules the system did not have before v0.96.0, each with its book and page in the comment.
 * Each switch's first choice is the book's way (the default); the other choice ('v951') puts the v0.95.1 behaviour
 * back. Pure logic lives beside it in rules/spirits96.ts, the Foundry glue in applications/spirits96.ts.
 */
export const SPIRITS_V96 = {
  /**
   * An elemental's day of waiting (Core p. 141): an elemental that has been called and hangs around (here: it has a
   * token on a scene) uses up one more service for every 24 hours of world time, whether it waits or serves; with
   * none left it departs. 'v951': it may wait for ever.
   */
  elementalWaiting: 'book' as 'book' | 'v951',
  /**
   * Aid Sorcery in spell defense (Core p. 141): an elemental's aid is an auxiliary Magic Pool that does not refresh and
   * may augment any sorcery test, spell defense included. 'book': a magician resisting a spell may add dice still left
   * in an aid already started by one of their own elementals of the spell's category (asked for, as Magic Pool dice
   * are); each die used is gone. 'v951': the aid only helps casting (SORCERY_V923.elementalAid).
   */
  aidDefense: 'book' as 'book' | 'v951',
  /**
   * Technological melee enhancements against spirits (Awakenings p. 101): against a manifest spirit a melee weapon
   * does only its base Damage Code. 'book': the Power the weapon's own tweaks add (where a Dikote coat, a monofilament
   * edge or a laser attachment is entered) doesn't count. 'v951': it counts.
   */
  techVsSpirits: 'book' as 'book' | 'v951',
  /**
   * Spirit against spirit (Core p. 143): a Force against Force contest, each rolling its Force against the other's
   * Force; the one with more successes takes the difference off the other's Force; at 0 it is destroyed. 'book': the
   * GM's "Spirits (book rules)" tool rolls it for two selected spirits. 'v951': no such tool.
   */
  spiritDuel: 'book' as 'book' | 'v951',
  /**
   * Disruption (Grimoire p. 64): a disrupted spirit cannot appear for 28 days minus its Force (at least 24 hours).
   * 'book': the card gives its return date on the world clock and the GM's client says when it is back (its damage
   * cleared). 'v951': disrupted with no date.
   */
  disruption: 'book' as 'book' | 'v951',
  /** disruption 'book': the days of the lunar cycle (Grimoire p. 64: 28 − Force days). */
  disruptionDays: 28,
  /**
   * A free spirit and its true name (Grimoire p. 77): only someone who knows a free spirit's true name can banish it.
   * 'book': banishing a free spirit asks the banisher for its true name (its binder knows it); without it, no
   * banishing. 'v951': anyone may banish it.
   */
  freeSpiritBanish: 'book' as 'book' | 'v951',
  /**
   * Watchers (Grimoire p. 73): Conjuring against the hours it is to serve; every 2 successes give 1 point of Force (the
   * summoner may take less); Drain (Force × hours)L, always Stun, resisted with Charisma; it dissolves when its hours
   * run out. 'v951': a Force 1 spirit against its Force with conjuring Drain (SPIRITS_EXTRA.watcherMaxForce).
   */
  watchers: 'book' as 'book' | 'v951',
  /** watchers 'book': the hours a watcher serves when the summoning doesn't say. */
  watcherHours: 1,
  /**
   * The astral attack skill (Core p. 147): a magician fights astrally with Unarmed Combat (Armed Combat with an active
   * weapon focus) or Sorcery in place of either. 'book': the better of the two. 'v951': ASTRAL.attackSkill only.
   */
  astralSkill: 'book' as 'book' | 'v951',
  /**
   * Reading an aura again (Grimoire p. 90): each further attempt on the same subject is at +2 TN; no further attempt
   * once that TN is above the magician's Magic (a first attempt is always allowed). Kept for the scene. 'v951': no
   * limit, no modifier.
   */
  assenseRepeat: 'book' as 'book' | 'v951',
  /**
   * Reflecting (Awakenings p. 99): only the successes of the shielding dice count; more than the caster's and the spell
   * rebounds with a Force of the difference (at most its own), the defender rolling that Force as the new caster's
   * test; a reflecting initiate may reflect it again, but a Force 1 spell reflected again dissipates. 'v951': all the
   * resistance successes over the caster's bounce back as successes (RULES.OCCULT.metamagic.reflecting).
   */
  reflecting: 'book' as 'book' | 'v951',
  /**
   * Cleansing a background count (Awakenings p. 100): only a count at most the initiate's grade; afterwards the
   * initiate resists (count)D Drain with Willpower. 'v951': any count, no Drain.
   */
  cleansing: 'book' as 'book' | 'v951',
  /**
   * Adept power costs (Core pp. 125–126; Awakenings p. 116), in the stat block and character importers: Improved
   * Physical Attributes by band of the racial maximum (.5 / 1 / 1.5 per point), Improved Ability by skill (.25 / .5 /
   * 1 per die), and Distance Strike costing double beside Killing Hands. 'v951': the flat guesses (.5 per level).
   */
  adeptCosts: 'book' as 'book' | 'v951',
  /**
   * Confusion, Fear and Engulf (Predator and Prey pp. 89–92, which replaces the SRII text): opposed tests of the
   * being's Essence against the victim's Willpower. Confusion adds half the net successes (round down) to the victim's
   * target numbers; Fear's net successes give its severity (1 runs, 2 does not return, 4 sweats blood, 6 a phobia);
   * Engulf takes the victim in at one net success, who breaks free with a net success of Strength against Essence.
   * 'v951': the power's own dice and TN; Confusion + the being's Essence (CRITTERS_V56.powerMods), no severity line.
   */
  critterOpposed: 'book' as 'book' | 'v951',
  /**
   * The Astral Combat Pool while only perceiving (Core p. 147: "for all actions in astral space … only one dice pool,
   * the Astral Pool"). 'book': an astrally perceiving magician's astral attacks and defenses draw on the Astral Combat
   * Pool (its own spent count, refreshed with the others); physical actions keep the Combat Pool. VERIFY (the book
   * speaks of magicians in astral space; perceiving is read as being there for the astral action). 'v951': the
   * physical Combat Pool.
   */
  astralPerceiving: 'book' as 'book' | 'v951',
};

const BV = ['book', 'v951'];
/** The house-rules window's rows for SPIRITS_V96 (spread into settings.ts HOUSE_RULES). */
export const HOUSE_SPIRITS_V96: Array<{ path: string; section: string; type: 'number' | 'boolean' | 'select'; choices?: string[]; step?: number }> = [
  { section: 'magicAndCritters', path: 'SPIRITS_V96.elementalWaiting', type: 'select', choices: BV },
  { section: 'magicAndCritters', path: 'SPIRITS_V96.aidDefense', type: 'select', choices: BV },
  { section: 'magicAndCritters', path: 'SPIRITS_V96.techVsSpirits', type: 'select', choices: BV },
  { section: 'magicAndCritters', path: 'SPIRITS_V96.spiritDuel', type: 'select', choices: BV },
  { section: 'magicAndCritters', path: 'SPIRITS_V96.disruption', type: 'select', choices: BV },
  { section: 'magicAndCritters', path: 'SPIRITS_V96.disruptionDays', type: 'number' },
  { section: 'magicAndCritters', path: 'SPIRITS_V96.freeSpiritBanish', type: 'select', choices: BV },
  { section: 'magicAndCritters', path: 'SPIRITS_V96.watchers', type: 'select', choices: BV },
  { section: 'magicAndCritters', path: 'SPIRITS_V96.watcherHours', type: 'number' },
  { section: 'magicAndCritters', path: 'SPIRITS_V96.astralSkill', type: 'select', choices: BV },
  { section: 'magicAndCritters', path: 'SPIRITS_V96.assenseRepeat', type: 'select', choices: BV },
  { section: 'magicAndCritters', path: 'SPIRITS_V96.reflecting', type: 'select', choices: BV },
  { section: 'magicAndCritters', path: 'SPIRITS_V96.cleansing', type: 'select', choices: BV },
  { section: 'magicAndCritters', path: 'SPIRITS_V96.adeptCosts', type: 'select', choices: BV },
  { section: 'magicAndCritters', path: 'SPIRITS_V96.critterOpposed', type: 'select', choices: BV },
  { section: 'magicAndCritters', path: 'SPIRITS_V96.astralPerceiving', type: 'select', choices: BV },
];
