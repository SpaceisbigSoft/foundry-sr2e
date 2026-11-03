/**
 * v0.78.0: rules the book models differently from the old code, found by the v0.77.0 book check
 * (docs/VERIFY.md, "Book check", "Changed in v0.78.0"), plus the owner's
 * decisions on the open questions (23 Oct 2026). Read through RULES.BOOK_V78. Every row is a house-rule
 * switch: the first choice is the book's way (the default), the other puts the old behaviour back.
 *
 * - legwork: 'book' — TNs 2 / 4 / 6 / 8 / 12 / 14 (general information … top secret), −2 when it is the
 *   contact's specialty, −3 for a fixer or Mr. Johnson, +2 through a friend of a friend; a closer contact
 *   adds dice (`levelDice` by contact level) instead of lowering the TN. 'tn': the old table (3 / 4 / 6 / 8,
 *   −1 TN per contact level; RULES.UPKEEP.contacts). Core Rules (contact knowledge table).
 * - flash: 'book' — a flash grenade adds `baseTn` to the TNs of everyone with a clear line to it, −1 per
 *   `metresPerPoint` m, nothing beyond `maxMetres`; flare compensation halves it (round down); it lasts
 *   `turns` Combat Turns, −1 per `successesPerTurn` successes on a Body (`bodyTn`) test; the 5L blast still
 *   hits within 1 m. 'blind': the old blind status (RULES.STATUSES.blind, flare compensation immune).
 *   Street Samurai Catalog (AFR-7). Facing isn't modelled: everyone with a clear line counts as looking.
 * - patches.stim: 'book' — the stim patch wears off in `stimMinutesDice`D6 minutes; 'hours': rating hours.
 *   patches.tranq: 'opposed' — patch rating dice vs TN Body, the patient's Body dice vs TN rating, each net
 *   patch success is a Stun box; 'body': Body vs TN rating, boxes = rating − successes. Core Rules.
 * - toxinBioware: 'power' — the toxin extractor takes floor(level ÷ 2) off the Power of injected toxins
 *   and the tracheal filter floor(level ÷ 2) off inhaled ones (no dice); 'dice': +1 die per level (old).
 *   Shadowtech.
 * - symbiotes: 'time' — natural healing time × `healingTimeFactor` by level (90 / 70 / 50 %); 'dice': +1
 *   die per level (old). Shadowtech.
 * - encephalon: 'shadowtech' — +`intelligence` (by level) to Intelligence when defaulting on Intelligence
 *   active skills, knowledge and B/R skills, plus a Task Pool of `taskPool` dice (by level) for those
 *   skill tests, refreshed each Combat Turn like the other pools (not spent out of combat); 'dice': +rating
 *   dice on those skills (the old way, as SR3 Man & Machine). Shadowtech.
 * - senseAllowance: cybereyes take vision enhancements up to `eyesFree` Essence at no further Essence cost;
 *   cyberears take `earsFeatures` feature(s) of at most `earsMaxEach` Essence free (Core Rules). Used for
 *   the stat-block importer's eye and ear options and the shipped templates. false = every option costs.
 * - manaBarrier.spells: 'casterTn' — a mana barrier adds its rating to the TN of a magician casting across
 *   it; 'resistDice': the rating as the target's resistance dice (old). Wards keep resistance dice
 *   (`wards`; the notes don't cover wards). manaBarrier.rating: 'halfForce' — a Mana Barrier spell's rating
 *   is half its Force (round down, at least 1); 'force': as Physical Barrier (old). Core Rules.
 * - invisibility: 'perception' — an observer sees through with a Perception Test against TN
 *   `tnPerSuccess` × the caster's successes (one success is enough); thermographic vision sees through
 *   (mana) Invisibility (`thermographicSeesMana`); 'resist': Intelligence resistance vs the Force (old).
 *   Core Rules.
 * - focusKarma: 'book' — bonding (and enchanting, and starting foci) Karma × rating: specific spell 1,
 *   spell category 3, spirit 2, power 5, weapon focus small 4 / large 5; a spell lock 1 flat; 'flat': the
 *   old RULES.ENCHANTING.focusKarma table. Core Rules (focus bonding table).
 * - powerFocus: 'magic' — an active power focus raises the Magic used for the drain type (so higher Force
 *   without physical drain) and adds its rating to the Spell Pool; it no longer adds dice to Sorcery and
 *   Conjuring tests; 'dice': the old RULES.MAGIC.powerFocusTests dice. Core Rules.
 * - insectFlesh: 'byRole' — flesh-form soldiers are the host's physical attributes + Force, workers host − 1
 *   (role from the spirit type's name; `defaultRole` otherwise); 'halfForce': host + half Force (old).
 *   Grimoire, Bug City.
 * - critterToxins: 'dice' — Immunity to Poisons (toxins and drugs) and to Pathogens (disease) gives
 *   `dicePerEssence` × Essence extra resistance dice; 'stop': no effect at all (old). Core Rules.
 * - paralysis: 'drain' — Paralyzing Touch lowers Quickness by the being's Essence for `minutesDice`D6
 *   minutes (touches stack); at Quickness 0 the victim is paralysed; 'noActions': no actions for net
 *   successes Combat Turns (old). Core Rules (Bug City's version differs: VERIFY).
 * - combatSense: 'pool' — the adept power adds its level to the Combat Pool (and lets the Combat Pool help
 *   on surprise tests); 'dice': dice on dodge, melee defense and surprise (old). Core Rules.
 * - spellResistanceVsPowers: false — Magic (spell) Resistance helps against spells only; true: also against
 *   critter powers (old). Awakenings.
 * - allergy: 'book' — Nuisance no effect, Mild +1 TN, Severe +2 Power for weapons of the substance,
 *   Extreme +2 Power and contact causes a Light wound; a saved 'moderate' counts as Mild (owner's decision:
 *   the Ghoul note's "Moderate"); 'legacy': RULES.CRITTERS.allergy (old). Core Rules.
 * - tamper: 'tn' — an anti-tamper alarm's rating adds to the casing test's TN (to the circuit test when the
 *   lock has no casing, `noCasing` 'circuit'); 0 successes on that test trips it; 'opposed': the old
 *   tamper roll after the circuit opens (RULES.SECURITY.tamper). Corporate Security Handbook.
 * - barriers: 'book' — a barrier's rating is doubled against firearms, melee and combat spells
 *   (`ratingMultiplier`); base Power (before burst or auto-fire); below half the adjusted rating nothing,
 *   up to it −1, above it −1 and a ½ m hole per half-rating step over; an ordinary door breaks at half
 *   its rating, a security door at 0; 'subtract': Power − rating comes off the rating (old). Core Rules.
 * - voiceLocks: 'deception' — a voice lock can't be bypassed physically: a voice-deception device (gear
 *   with the bypass tool 'voiceDeception', or a voice modulator) rolls its rating against TN = the lock's
 *   rating while the lock rolls its rating against TN = the device's; ties repeat; 'electronics': the old
 *   Electronics bypass at +2. Corporate Security Handbook.
 * - adaptation: 'text' — remote adaptation 2,500¥ × Body; rigger adaptation 2,800¥ and needs the remote
 *   adaptation first (the notes' texts; their tables have the two swapped: owner to check); 'single': one
 *   rigger adaptation at 2,500¥ × Body (old). Core Rules. VERIFY
 *
 * Also in v0.78.0 (plain values, the old value in a comment): the monofilament whip's self-hit
 * (RULES.COMBAT_V61.monowhip.on 'defended'), the anti-vehicle rocket's falloff (−1 per 4 m; owner's
 * default, VERIFY), the riot shield's parry 0 (owner), the passkey template at 10,000¥ × rating (SR2 core;
 * Corporate Security says rating², VERIFY), corrected cybereyes / cyberears templates, and the importer's
 * Hibernate (Physical, touch, TN 4, sustained, (F/2)S).
 */
export const BOOK_V78 = {
  legwork: {
    mode: 'book' as 'book' | 'tn',
    difficulties: [
      { id: 'general', label: 'General information', tn: 2 },
      { id: 'details', label: 'More details', tn: 4 },
      { id: 'more', label: 'Even more details', tn: 6 },
      { id: 'insider', label: 'Insider knowledge (8–11)', tn: 8 },
      { id: 'hot', label: 'Hot or classified (12–13)', tn: 12 },
      { id: 'secret', label: 'Top secret (14+)', tn: 14 },
    ] as ReadonlyArray<{ id: string; label: string; tn: number }>,
    /** Extra dice by contact level (1 = contact, 2 = buddy, 3 = friend for life). VERIFY (the notes say +1 or +2). */
    levelDice: [0, 1, 2] as readonly number[],
    specialtyTn: -2,
    fixerTn: -3,
    friendOfFriendTn: 2,
  },
  flash: {
    mode: 'book' as 'book' | 'blind',
    baseTn: 6,
    metresPerPoint: 5,
    maxMetres: 30,
    flareFactor: 0.5,
    turns: 5,
    bodyTn: 5,
    successesPerTurn: 2,
  },
  patches: {
    stim: 'book' as 'book' | 'hours',
    stimMinutesDice: 2,
    tranq: 'opposed' as 'opposed' | 'body',
  },
  toxinBioware: 'power' as 'power' | 'dice',
  symbiotes: {
    mode: 'time' as 'time' | 'dice',
    healingTimeFactor: [0.9, 0.7, 0.5] as readonly number[],
  },
  encephalon: {
    mode: 'shadowtech' as 'shadowtech' | 'dice',
    intelligence: [1, 1, 2, 2] as readonly number[],
    taskPool: [0, 1, 2, 3] as readonly number[],
  },
  senseAllowance: {
    enabled: true,
    eyesFree: 0.5,
    earsFeatures: 1,
    earsMaxEach: 0.2,
  },
  manaBarrier: {
    spells: 'casterTn' as 'casterTn' | 'resistDice',
    wards: 'resistDice' as 'casterTn' | 'resistDice',
    rating: 'halfForce' as 'halfForce' | 'force',
  },
  invisibility: {
    mode: 'perception' as 'perception' | 'resist',
    tnPerSuccess: 2,
    thermographicSeesMana: true,
  },
  focusKarma: {
    mode: 'book' as 'book' | 'flat',
    specificSpell: 1,
    spellCategory: 3,
    spellLockFlat: 1,
    spirit: 2,
    power: 5,
    weaponSmall: 4,
    weaponLarge: 5,
  },
  powerFocus: 'magic' as 'magic' | 'dice',
  insectFlesh: {
    mode: 'byRole' as 'byRole' | 'halfForce',
    defaultRole: 'soldier' as 'soldier' | 'worker',
    workerOffset: -1,
  },
  critterToxins: {
    mode: 'dice' as 'dice' | 'stop',
    dicePerEssence: 2,
  },
  paralysis: {
    mode: 'drain' as 'drain' | 'noActions',
    minutesDice: 2,
  },
  combatSense: 'pool' as 'pool' | 'dice',
  spellResistanceVsPowers: false,
  allergy: {
    mode: 'book' as 'book' | 'legacy',
    levels: {
      nuisance: { tn: 0, power: 0, contact: '' },
      mild: { tn: 1, power: 0, contact: '' },
      moderate: { tn: 1, power: 0, contact: '' },
      severe: { tn: 0, power: 2, contact: '' },
      extreme: { tn: 0, power: 2, contact: 'L' },
    } as Record<string, { tn: number; power: number; contact: '' | 'L' | 'M' | 'S' | 'D' }>,
  },
  tamper: {
    mode: 'tn' as 'tn' | 'opposed',
    noCasing: 'circuit' as 'circuit' | 'none',
  },
  barriers: {
    mode: 'book' as 'book' | 'subtract',
    ratingMultiplier: { firearm: 2, melee: 2, combatSpell: 2, blast: 1, manipulation: 1 } as Record<BarrierAttackKind, number>,
    doors: true,
  },
  voiceLocks: 'deception' as 'deception' | 'electronics',
  adaptation: 'text' as 'text' | 'single',
  /** The rigger adaptation's flat price under 'text' (the remote adaptation is the 'remote' row of RULES.VEHICLES.modifications). VERIFY */
  riggerAdaptationCost: 2800,
};

export type BarrierAttackKind = 'firearm' | 'melee' | 'combatSpell' | 'blast' | 'manipulation';
