import { HEALTH_V61 } from './config61/health.ts';
import { MAGIC_V61 } from './config61/magic.ts';
import { COMBAT_V61 } from './config61/combat.ts';
import { STREET_V61 } from './config61/street.ts';
import { SECURITY_V61 } from './config61/security.ts';
import { FIXES_V70 } from './config70.ts';
import { FIXES_V71 } from './config71.ts';
import { HEALTH_V72 } from './config72/health.ts';
import { COMBAT_V72 } from './config72/combat.ts';
import { MAGIC_V72 } from './config72/magic.ts';
import { CROSSCUT_V73 } from './config73/crosscut.ts';
import { NETRIG_V73 } from './config73/netrig.ts';
import { DRONES_V73 } from './config73/drones.ts';
import { CHARACTERS_V73 } from './config73/characters.ts';
import { BOOK_V78 } from './config78.ts';
import { SHOP_V91, SHOP_V915, SHOP_V916, FORMULA_V918 } from './config91.ts';
import { MAGIC_V920, SHEET_V921, CLOCK_V922 } from './config92.ts';
import { DOCS_V79 } from './config79.ts';
import { URR_V80 } from './config80.ts';
import { CORE_V923 } from './config923/core.ts';
import { COMBAT_V923 } from './config923/combat.ts';
import { HEALTH_V923 } from './config923/health.ts';
import { SORCERY_V923 } from './config923/sorcery.ts';
import { SPIRITS_V923 } from './config923/spirits.ts';
import { MATRIX_V923 } from './config923/matrix.ts';
import { VEHICLES_V923 } from './config923/vehicles.ts';
import { GEAR_V923 } from './config923/gear.ts';

/**
 * SR2e rules constants.
 *
 * Every number that comes straight from the Shadowrun 2nd Edition rulebook lives in
 * this one object so it can be checked against your copy of the book and tweaked
 * (house rules) without touching the engine. Items marked VERIFY are from memory
 * and should be confirmed against the book you own.
 */
export const RULES = {
  /** A target number can never be modified below this. */
  MIN_TARGET_NUMBER: 2,
  /** Extra TN when a test defaults from a skill to a raw attribute. VERIFY */
  ATTRIBUTE_DEFAULT_TN_MOD: 4,
  /** Extra TN when defaulting from one skill to a related skill. VERIFY */
  SKILL_DEFAULT_TN_MOD: 2,
  /** Safety cap on Rule-of-Six re-roll waves, so a bad RNG can never loop forever. */
  MAX_EXPLOSION_WAVES: 50,

  /** Ranged-combat base target numbers by range band. VERIFY */
  RANGE_TN: { short: 4, medium: 5, long: 6, extreme: 9 },
  /** Base target number for melee attacks. VERIFY */
  MELEE_BASE_TN: 4,

  /** Condition monitor size (boxes) for both Physical and Stun tracks. */
  MONITOR_BOXES: 10,
  /** Boxes of damage taken per damage level. */
  BOXES_PER_LEVEL: { L: 1, M: 3, S: 6, D: 10 },
  /** Successes needed to stage damage up one level (attacker) or down one level (defender). */
  SUCCESSES_PER_STAGE: 2,
  /**
   * v0.54.0: how the attacker's net successes stage damage up. 'afterFirst' (as before): the first net
   * success hits and each further SUCCESSES_PER_STAGE raise a level (2 net: no change, 3: one level).
   * 'all': every SUCCESSES_PER_STAGE net successes raise a level (2 net: one level). VERIFY in the book.
   */
  ATTACK_STAGING: 'afterFirst' as 'afterFirst' | 'all',
  /**
   * Wound modifier (added to all TNs) by boxes marked on a track, as
   * [minBoxes, modifier] pairs, highest first. VERIFY
   */
  WOUND_MODIFIERS: [
    [6, 3],
    [3, 2],
    [1, 1],
  ] as ReadonlyArray<readonly [number, number]>,
  /** If true, Physical and Stun wound modifiers add together; if false, the worse one applies. VERIFY */
  WOUNDS_CUMULATIVE: true,
  /** Stun boxes beyond a full Stun track convert to Physical at this many stun boxes per 1 physical box. VERIFY */
  STUN_OVERFLOW_PER_PHYSICAL_BOX: 2,

  /**
   * Essence cost multiplier by cyberware grade (standard, alpha, beta, delta). VERIFY
   */
  GRADE_ESSENCE_MULTIPLIER: { standard: 1, alpha: 0.8, beta: 0.7, delta: 0.5 },
  /**
   * Essence loss caps Magic: a magic user's effective Magic can never exceed their current
   * Essence rounded up. VERIFY (the book may instead subtract lost Essence from Magic, which
   * differs for characters whose Magic is below 6).
   */
  MAGIC_CAPPED_BY_ESSENCE: true,
  /**
   * How lost Essence lowers Magic when MAGIC_CAPPED_BY_ESSENCE is on (v0.29.0): 'cap' = Magic is at
   * most current Essence rounded up; 'reduce' = Magic − every point (or part of one) of Essence lost. VERIFY
   */
  MAGIC_ESSENCE_MODE: 'cap' as 'cap' | 'reduce',

  /**
   * Cyberware depth (v0.29.0). All VERIFY, from memory of SR2 and the Shadowtech era.
   * - `stacking`: items whose reflex type is in `exclusive` (wired and boosted reflexes) do not
   *   stack: only the one giving the most initiative dice counts (its Reaction too). With
   *   `adeptExclusive`, adept reflex powers don't stack with them either (the better one counts).
   *   Initiative dice in all (with the base 1) are at most `maxInitiativeDice`.
   * - `smartlink`: TN modifier by smartlink level (the Attack dialog's Smartlink row).
   * - `magnification`: each level moves a ranged attack's range band one closer (at most `maxLevel`).
   * - `ultrasound`: vision TNs by light level, and in smoke (sees through it).
   * - `flareCompensation`: immune to flash grenades' blinding.
   * - `pheromones`: tailored pheromones add their rating × `dicePerRating` dice to these skills.
   * - `datajack`: whether decking and rigging need a datajack: 'off', 'warn' or 'block'.
   * - `limbs`: cyberlimb locations; the wearer's Strength-based attacks with a cyberarm use its own
   *   Strength. Cyberware housed in a cyberlimb uses its capacity (its Essence cost) instead of Essence.
   * - `gradeCost`: nuyen cost multiplier by grade.
   * - `repair`: damaged cyberware gives nothing until repaired: the first skill found (Intelligence
   *   at +4 without) vs `tn`; `hours` per repair (shown only).
   * - `skillsofts`: activesofts need skillwires (their rating caps the skill) and a chipjack or
   *   datajack; knowsofts and linguasofts need a chipjack or datajack.
   */
  CYBERWARE: {
    kinds: ['other', 'cyberlimb', 'cyberweapon', 'datajack', 'chipjack', 'skillwires', 'eyes', 'ears', 'pheromones', 'reflexes', 'encephalon', 'memory', 'iccm', 'filtration', 'boneLacing'] as readonly string[],
    reflexTypes: ['', 'wired', 'boosted', 'enhancer', 'synaptic'] as readonly string[],
    stacking: { exclusive: ['wired', 'boosted', 'synaptic'] as readonly string[], adeptExclusive: true, maxInitiativeDice: 5 },
    smartlink: { 1: -2, 2: -2 /* v0.79.0 docs check: SRII table, smartlink I or II −2 (was −3) */ } as Record<number, number>,
    magnification: { maxLevel: 3, bandsPerLevel: 1 },
    ultrasound: {
      vision: { normal: 0, partial: 1, minimal: 1, darkness: 2 },
      smoke: { smoke: 1, thermal: 1 },
    },
    flareCompensation: { blocksFlash: true },
    pheromones: { dicePerRating: 1, skills: ['Etiquette', 'Negotiation', 'Leadership', 'Interrogation', 'Instruction'] as readonly string[] },
    datajack: { decking: 'warn' as 'off' | 'warn' | 'block', rigging: 'off' as 'off' | 'warn' | 'block' },
    limbs: { locations: ['leftArm', 'rightArm', 'leftLeg', 'rightLeg', 'other'] as readonly string[] },
    gradeCost: { standard: 1, alpha: 2, beta: 4, delta: 8 } as Record<string, number>,
    repair: { skills: ['Cybertechnology', 'Biotech'] as readonly string[], tn: 4, hours: 4 },
    skillsofts: { kinds: ['', 'activesoft', 'knowsoft', 'linguasoft'] as readonly string[] },
    /**
     * v0.45.0. `encephalon`: + rating × `dicePerRating` dice on tests of skills linked to these
     * attributes (and knowledge skills). `chips`: chips that run at once: `perChipjack` per
     * chipjack, `perDatajack` through a datajack; knowsofts and linguasofts beyond that need
     * headware memory (a `memory` item's rating in Mp) of `mpPerRating` × rating each;
     * chips over the limit give nothing ('warn' still lists them; 'off' ignores the limit).
     * `gradeAvailability`: Availability TN + `tn` and time × `time` by grade.
     */
    encephalon: { dicePerRating: 1, attributes: ['intelligence'] as readonly string[], knowledge: true },
    chips: { enforce: 'block' as 'off' | 'warn' | 'block', perChipjack: 1, perDatajack: 1, mpPerRating: 3 },
    gradeAvailability: {
      standard: { tn: 0, time: 1 }, alpha: { tn: 2, time: 1.5 }, beta: { tn: 5, time: 2 }, delta: { tn: 9, time: 3 },
    } as Record<string, { tn: number; time: number }>,
  },

  /**
   * Bioware depth (v0.30.0). All VERIFY, from memory of SR2's Shadowtech.
   * - `effects`: what each kind of bioware does at its rating: attribute bonuses, Reaction,
   *   initiative dice (synaptic accelerators count as a reflex system, so they don't stack with
   *   wired or boosted reflexes), armor, extra dice against toxins or inhaled ones, boxes taken off
   *   each Physical hit (platelet factories, never below 1 box), boxes ignored for wound modifiers
   *   (damage compensators). Adrenal pumps give theirs only while active.
   * - `adrenalCrash`: switching an adrenal pump off: resist `attribute` vs `tn`, Stun at a level by rating.
   * - `cultured`: these kinds must be cultured (warned); cultured bioware costs × `costMultiplier`.
   * - `bodyIndex.healingTnPerPoint`: Body Index × this (rounded down) is added to the patient's
   *   first aid and natural healing TNs; `toxinDicePerPoint` takes dice off toxin resistance.
   * - `surgery`: installing cyberware or bioware: the surgeon's skill (Intelligence +4 without) vs
   *   `tn` + `gradeTn`; recovery takes (Essence or Body Index) × `daysPerPoint` ÷ successes days;
   *   no successes = complications: the patient takes `failureLevel` Physical, unresisted.
   * - `conflicts`: bioware that does not work with some cyberware (matched by the cyberware's name):
   *   'armor' = only the better armor counts; 'warn' = a warning on the sheet.
   */
  BIOWARE: {
    kinds: ['other', 'muscleAugmentation', 'cerebralBooster', 'synapticAccelerator', 'adrenalPump', 'orthoskin', 'toxinExtractor', 'trachealFilter', 'plateletFactory', 'damageCompensator', 'enhancedArticulation', 'traumaDamper', 'painEditor'] as readonly string[],
    effects: {
      muscleAugmentation: { attributes: { strength: 1 } },
      cerebralBooster: { attributes: { intelligence: 1 } },
      synapticAccelerator: { initiativeDice: 1, reflexes: 'synaptic' },
      adrenalPump: { attributes: { quickness: 1, strength: 1, willpower: 1 }, whileActive: true },
      orthoskin: { impact: 1, ballistic: 0.5 },
      toxinExtractor: { toxinDice: 1 },
      trachealFilter: { inhalantDice: 1 },
      plateletFactory: { boxesOff: 1, perRating: false },
      damageCompensator: { ignoreBoxes: 1 },
      // v0.45.0: + dice on physical skills (Body, Quickness, Strength), Stun boxes off each hit, pain editors.
      enhancedArticulation: { physicalSkillDice: 1, perRating: false },
      traumaDamper: { stunBoxesOff: 1 },
      painEditor: { ignoreStunWounds: true, attributes: { willpower: 1 }, perceptionTn: 1, perRating: false },
    } as Record<string, { attributes?: Record<string, number>; reaction?: number; initiativeDice?: number; reflexes?: string; impact?: number; ballistic?: number; toxinDice?: number; inhalantDice?: number; boxesOff?: number; perRating?: boolean; ignoreBoxes?: number; whileActive?: boolean; physicalSkillDice?: number; stunBoxesOff?: number; ignoreStunWounds?: boolean; perceptionTn?: number }>,
    adrenalCrash: { attribute: 'body' as 'body' | 'willpower', tn: 6, levelByRating: { 1: 'M', 2: 'S' } as Record<number, 'L' | 'M' | 'S' | 'D'> },
    cultured: { required: ['cerebralBooster', 'synapticAccelerator', 'damageCompensator'] as readonly string[], costMultiplier: 4 },
    bodyIndex: { healingTnPerPoint: 0.5, toxinDicePerPoint: 0.5 },
    surgery: { skill: 'Biotech', tn: 4, gradeTn: { standard: 0, alpha: 1, beta: 2, delta: 3 } as Record<string, number>, daysPerPoint: 10, failureLevel: 'L' as 'L' | 'M' | 'S' | 'D',
      /** v0.55.0 (Shadowtech, optional): the surgery itself wounds the patient by its size (Essence or Body Index points): up to each `upTo`. */
      trauma: { enabled: false, type: 'physical' as 'physical' | 'stun', levels: [{ upTo: 0.5, level: 'L' }, { upTo: 1.5, level: 'M' }, { upTo: 3, level: 'S' }, { upTo: 99, level: 'D' }] as ReadonlyArray<{ upTo: number; level: 'L' | 'M' | 'S' | 'D' }> } },
    conflicts: [
      { bio: 'orthoskin', cyber: 'dermal', rule: 'armor' },
      { bio: 'muscleAugmentation', cyber: 'muscle replacement', rule: 'warn' },
      { bio: 'cerebralBooster', cyber: 'encephalon', rule: 'warn' },
    ] as ReadonlyArray<{ bio: string; cyber: string; rule: 'armor' | 'warn' }>,
    /**
     * v0.45.0. `recovery`: after surgery the new item gives nothing until the recovery days pass
     * (`inactive`), and every test is at +`tn` meanwhile. `rejection`: with Body Index over the
     * limit, a Body test vs `tn` + `tnPerPointOver` × the excess when the item goes in and every
     * `intervalDays` after; failure rejects the newest non-cultured bioware (marked damaged when
     * `rejectItem`) and the patient takes `level` Physical, unresisted. Cultured bioware is never
     * rejected when `culturedImmune`. `availability`: cultured bioware's Availability TN +`tn`,
     * time ×`time`.
     */
    /**
     * v0.48.0 `care`: the recovery days are multiplied by the patient's care (the healing care
     * options); at home by 1 + `homePerTn` × the lifestyle's home-care TN (RULES.HEALTH.homeCare).
     * Changing the care later rescales the days left. Hospital and intensive care can be paid per
     * day (RULES.HEALTH.careCosts) when the surgery is rolled. VERIFY
     */
    recovery: {
      inactive: true, tn: 1,
      care: { none: 1.5, medkit: 1.25, hospital: 1, intensive: 0.75, home: 1, poor: 2 } as Record<string, number>,
      homePerTn: 0.25, defaultCare: 'hospital' as string,
    },
    rejection: { enabled: true, tn: 4, tnPerPointOver: 1, intervalDays: 7, level: 'M' as 'L' | 'M' | 'S' | 'D', rejectItem: true, culturedImmune: true },
    availability: { cultured: { tn: 2, time: 1.5 } },
  },

  /**
   * Firing modes. Rounds per action for each mode; full-auto is a range the attacker picks. VERIFY
   */
  FIRING: {
    roundsPerMode: { SS: 1, SA: 1, BF: 3 },
    fullAutoMin: 3,
    fullAutoMax: 10,
    /** Rounds fired in a phase before recoil starts to apply. */
    recoilFreeRounds: 1,
    /** Burst: Power bonus and damage-level stages. */
    burst: { power: 3, stages: 1 },
    /** Full auto: Power bonus per round, and one damage-level stage per this many rounds. */
    fullAuto: { powerPerRound: 1, roundsPerStage: 3 },
  },
  /**
   * Optional attack modifiers offered as checkboxes in the Attack dialog. Edit freely: ids must
   * stay unique. Negative values make the shot easier. VERIFY every value against the book.
   */
  SITUATIONAL_MODIFIERS: [
    { id: 'attackerWalking', label: 'Attacker walking', value: 1 },
    { id: 'attackerRunning', label: 'Attacker running', value: 4 },
    { id: 'calledShot', label: 'Called shot', value: 4 },
    { id: 'partialCover', label: 'Target in partial cover', value: 4 },
    { id: 'fullCover', label: 'Target in full cover (blind fire through the barrier)', value: 8 },
    { id: 'smartlink', label: 'Smartlink (smartgun + implant)', value: -2 },
    { id: 'laserSight', label: 'Laser sight', value: -1 },
    { id: 'secondWeapon', label: 'Second weapon (off-hand)', value: 2 },
  ] as ReadonlyArray<{ id: string; label: string; value: number }>,
  /** Visibility, as a single choice in the Attack dialog. VERIFY */
  VISIBILITY: [
    { id: 'normal', label: 'Normal light', value: 0 },
    { id: 'partial', label: 'Partial light', value: 2 },
    { id: 'minimal', label: 'Minimal light', value: 6 }, // v0.79.0 docs check: SR2 p. 89 Visibility Table (was 4)
    { id: 'darkness', label: 'Total darkness', value: 8 },
  ] as ReadonlyArray<{ id: string; label: string; value: number }>,

  /**
   * Karma Pool. A re-roll re-rolls every failed die of one test; re-rolling the same test again
   * costs more each time when `escalating` is on (1, then 2, then 3...). Avoiding a disaster
   * (all ones) has its own cost. VERIFY
   */
  KARMA: {
    firstRerollCost: 1, escalating: true, avoidDisasterCost: 1,
    /**
     * Buying successes (v0.35.0): each success costs `buyCost` Karma Pool points; with `buyPermanent`
     * they come off the Karma Pool for good (not just until the refresh); with `buyNeedsSuccess` the
     * test must have rolled at least one success. VERIFY
     */
    buyCost: 1, buyPermanent: true, buyNeedsSuccess: true,
    /** When Karma Pools refill on their own: 'manual', 'session' (the GM's first login on a new day), 'combat' (when a combat ends). */
    // v0.92.3 (book alignment): the pool is full again with the next encounter (Core p. 191): when a combat ends (was 'manual').
    refresh: 'combat' as 'manual' | 'session' | 'combat',
  },

  /**
   * Conjuring (summoning nature spirits and elementals, banishing). All VERIFY.
   * - Summoning: Conjuring skill vs TN = the spirit's Force; each success is one service.
   * - Drain: resisted with `drainAttribute` vs TN = Force. The level comes from Force compared
   *   with the conjurer's Charisma: `drainLevels` lists [ratio, level] pairs, lowest first, and
   *   the first where Force <= ratio x Charisma applies; above them all it is Deadly. Physical
   *   if Force exceeds the conjurer's Magic, otherwise Stun.
   * - Banishing: Conjuring vs TN = the spirit's Force, opposed by the spirit's Force dice vs TN =
   *   the banisher's Magic. Each net success lowers the spirit's Force by 1; at 0 it is banished.
   *   The banisher takes conjuring drain for the spirit's (starting) Force.
   */
  CONJURING: {
    drainAttribute: 'charisma',
    drainLevels: [
      [0.5, 'L'],
      [1, 'M'],
      [1.5, 'S'],
    ] as ReadonlyArray<readonly [number, 'L' | 'M' | 'S' | 'D']>,
    /** Whether Spell Pool dice may be added to the Conjuring test and its drain. */
    spellPoolAllowed: false,
    servicesPerSuccess: 1,
    /** Bound elementals a conjurer may have at once, as a multiple of Charisma (0 = no limit). */
    maxElementalsPerCharisma: 1,
    /** "Immunity to normal weapons" armor (ballistic and impact) per point of Force. */
    immunityArmorPerForce: 2,
  },

  /**
   * Astral plane. All VERIFY.
   * - A magician (Magic > 0) can be physical, perceiving (dual-natured: in both worlds) or projecting
   *   (mind only on the astral plane, body left behind).
   * - In astral form the physical attributes are replaced by mental ones (`formAttributes`).
   *   Spirits are astral natives and use their own attributes.
   * - Projecting: Reaction = `reactionAttribute`, initiative = Reaction + `initiativeBonus` + Nd6.
   * - Perceiving: physical-world weapon attacks take `perceivingTnMod`.
   * - Astral attack: like melee, base TN `attackBaseTn`; magicians roll `attackSkill` (defaulting
   *   to Willpower) with `attackPool` dice, spirits roll Force with Combat Pool. Damage Power is the
   *   attacker's `powerAttribute` (spirits: Force) at `damageLevel`. The defender dodges with astral
   *   Quickness and soaks with astral Body; armor does not count.
   */
  ASTRAL: {
    perceivingTnMod: 2,
    formAttributes: { body: 'willpower', quickness: 'intelligence', strength: 'charisma' },
    reactionAttribute: 'intelligence',
    initiativeBonus: 20,
    initiativeDice: 1,
    attackBaseTn: 4,
    attackSkill: 'Sorcery',
    attackPool: 'spell',
    powerAttribute: 'charisma',
    damageLevel: 'M',
  } as {
    perceivingTnMod: number;
    formAttributes: Record<'body' | 'quickness' | 'strength', 'willpower' | 'intelligence' | 'charisma'>;
    reactionAttribute: 'intelligence' | 'willpower' | 'charisma';
    initiativeBonus: number;
    initiativeDice: number;
    attackBaseTn: number;
    attackSkill: string;
    attackPool: 'spell' | 'combat';
    powerAttribute: 'charisma' | 'willpower' | 'intelligence';
    damageLevel: 'L' | 'M' | 'S' | 'D';
  },

  /**
   * Critter and spirit powers (Power items). Each power item sets its own dice, TN, resistance and
   * effect; only these defaults are global. VERIFY
   */
  POWERS: {
    /** Pool the target may add when resisting a power: 'spell', 'combat' or 'none'. */
    resistPool: 'none',
    /** Pool the user may add to a power test: 'spell', 'combat' or 'none'. */
    usePool: 'none',
  } as { resistPool: 'spell' | 'combat' | 'none'; usePool: 'spell' | 'combat' | 'none' },

  /**
   * Sustained spells, spell defense, foci, traditions/totems, adepts and assensing. All VERIFY.
   */
  MAGIC: {
    /** TN modifier on all of a magician's own tests per spell they sustain themselves. */
    sustainedTnMod: 2,
    /** Spell defense dice: allocated from the Spell Pool in advance, added to every spell resistance
     *  test that Combat Turn. If true, each use spends them instead. */
    // v0.79.0 docs check: dice used to defend someone are lost until the pool refreshes (SR2 p132, Spell
    // Defense). (was false)
    spellDefenseSpentOnUse: true,
    /** Power foci add their rating as dice to these tests. */
    powerFocusTests: ['sorcery', 'conjuring'] as ReadonlyArray<'sorcery' | 'conjuring' | 'astral'>,
    /** Adept power points available per point of Magic. */
    adeptPointsPerMagic: 1,
    /** Assensing: attribute rolled and default TN. */
    assensingAttribute: 'intelligence',
    assensingTn: 4,
    /** Quickening costs this much Good Karma per point of the spell's Force. */
    quickenKarmaPerForce: 1,
    /** Magic gained per initiate grade. */
    magicPerGrade: 1,
    /** Shielding: extra dice per grade when resisting spells. */
    shieldingDicePerGrade: 1,
    /** Centering: TN penalty (wounds, sustaining) removed per grade on Sorcery and Conjuring tests. */
    centeringPerGrade: 1,
    /** Dispelling: drain TN = floor(Force / 2) + this, at `dispelDrainLevel`. */
    dispelDrainModifier: 0,
    dispelDrainLevel: 'M' as 'L' | 'M' | 'S' | 'D',
    /** Area spells and powers: the TN is the highest target's attribute ('highest') or the lowest. */
    areaTn: 'highest' as 'highest' | 'lowest',
    /** Traditions that cannot summon a kind of spirit (warned, not blocked). */
    traditionSpiritWarnings: { hermetic: ['nature', 'toxic', 'insect'], shamanic: ['elemental', 'toxic', 'insect'], toxic: ['nature', 'elemental', 'insect'], insect: ['nature', 'elemental', 'toxic'] } as Record<string, readonly string[]>,
  },

  /**
   * Wards and astral barriers. A magician or spirit forces through by rolling its astral attack dice
   * vs TN = the barrier's rating; the barrier resists with its rating vs TN = the attacker's Magic
   * (spirits: Force). Each net success lowers the barrier's rating by 1; at 0 it is breached. VERIFY
   */
  BARRIERS: { ratingLossPerNetSuccess: 1 },

  /**
   * Astral signatures and tracking. VERIFY
   * - Every spell, summoning, banishing, dispelling, power use and barrier assault leaves a
   *   signature at the scene for `signatureHoursPerForce` hours per point of Force (world time).
   * - Tracking rolls `trackingAttribute` vs a GM-set TN plus a freshness modifier from
   *   `freshness` ([max age in hours, TN modifier], first match; older than all = `staleModifier`).
   *   The trail takes `baseHours` / successes hours to follow.
   */
  TRACKING: {
    signatureHoursPerForce: 1,
    keepPerActor: 50,
    trackingAttribute: 'intelligence',
    trackingTn: 4,
    freshness: [[1, 0], [6, 1], [24, 2]] as ReadonlyArray<readonly [number, number]>,
    staleModifier: 4,
    baseHours: 6,
  },

  /** Geasa: an unmet geas takes away the Magic it protects. VERIFY */
  GEASA: { warnOnCast: true },

  /**
   * More spellcasting rules. All VERIFY.
   * - Healing (health spells marked Heals): TN = 10 - the patient's Essence (min 2) or a fixed TN;
   *   each success heals `boxesPerSuccess` boxes; magic heals a wound only once (warns if the
   *   patient has not taken new damage since the last magical healing).
   * - Exclusive and fetish-limited spells lower the drain TN.
   * - Background count: a per-scene TN modifier on magical tests (casting, conjuring, dispelling,
   *   astral attacks, assensing, tracking) and, if `affectsDrain`, on drain.
   */
  SPELLCRAFT: {
    healing: { tn: 'essence' as 'essence' | 'fixed', base: 10, boxesPerSuccess: 1, oncePerWound: true },
    exclusiveDrainMod: -2,
    fetishDrainMod: -1,
    backgroundCount: { affectsDrain: false },
  },

  /**
   * Ritual sorcery. The leader rolls Sorcery plus `teamDiceFraction` x each other member's Sorcery
   * (rounded down); a material link is needed for a target out of sight; the ritual takes
   * `hoursPerForce` x Force hours; every member resists drain, the leader at +`leaderDrainMod` TN. VERIFY
   */
  RITUAL: { teamDiceFraction: 0.5, needsMaterialLink: true, hoursPerForce: 1, leaderDrainMod: 0 },

  /**
   * Magic loss: when a magician's Physical damage reaches Deadly (a full track), they roll
   * `dice`d6; if the total is below their (natural) Magic they lose `loss` point(s). VERIFY:
   * the book's trigger and comparison may differ.
   */
  MAGIC_LOSS: { enabled: true, dice: 2, loss: 1, compareTo: 'magic' as 'magic' | 'fixed', fixed: 7 },

  /**
   * Enchanting (talismongering, refining, alchemy, making foci). Enchanting skill vs the task TN;
   * time = base days / successes. Making a focus costs Good Karma = rating x `focusKarma[type]`. VERIFY
   */
  ENCHANTING: {
    tasks: {
      gather: { label: 'Gather materials', tn: 4, days: 1 },
      refine: { label: 'Refine materials', tn: 4, days: 2 },
      alchemy: { label: 'Alchemy (radicals)', tn: 5, days: 3 },
      focus: { label: 'Make a focus', tn: 5, days: 7 },
      fetish: { label: 'Make a fetish', tn: 4, days: 1 },
    } as Record<string, { label: string; tn: number; days: number }>,
    focusKarma: { spell: 1, sustaining: 1, spirit: 1, power: 5, weapon: 3 } as Record<string, number>,
  },

  /**
   * Allies and free spirits. Allies serve without counting services. A free spirit adds its
   * spirit energy to its Force when resisting banishing. Watchers are limited to `watcherMaxForce`. VERIFY
   */
  SPIRITS_EXTRA: { freeSpiritEnergyResists: true, watcherMaxForce: 1 },

  /**
   * Astral quests: a series of stages, each an attribute test vs the quest's TN while projecting.
   * A failed stage ends the quest if `failureEnds`. VERIFY
   */
  QUESTS: { failureEnds: true },

  /**
   * The rest of magic (v0.18.0). All VERIFY, from memory.
   */
  MAGIC_EXTRA: {
    /**
     * Elemental manipulation spells (Fireball, Lightning Bolt...): the caster rolls Sorcery vs the
     * spell's own TN; it is then handled like a ranged attack. The target may dodge with Combat
     * Pool (`dodge`) and resists with Body vs Power = Force, armor = `armorFraction` of `armorKind`.
     */
    elemental: { dodge: true, armorKind: 'impact' as 'impact' | 'ballistic', armorFraction: 0.5 },
    /** Spell elements; an elemental of the same element can aid or sustain the spell. */
    elements: ['fire', 'water', 'air', 'earth', 'lightning', 'cold', 'acid'] as ReadonlyArray<string>,
    /** Elementals aiding a spell add their Force as Sorcery dice; aiding and sustaining each cost a service. */
    elementalAid: { costsService: true },
    elementalSustain: { costsService: true },
    /**
     * v0.54.0: which spells an elemental may aid or sustain. 'category' (SR2 as remembered): fire for
     * combat, water for illusion, air for detection, earth for manipulation (`elementalCategories`);
     * 'element': a spell of its own element (v0.18.0); 'any'. VERIFY
     * `elementalCategories` is also the elementalists' table: the category each hermetic element casts.
     */
    elementalMatch: 'category' as 'category' | 'element' | 'any',
    elementalCategories: { fire: 'combat', water: 'illusion', air: 'detection', earth: 'manipulation' } as Record<string, string>,
    /**
     * Astral projection lasts `hoursPerEssence` x Essence hours of world time; each hour (or part)
     * over the limit costs `essenceLossPerHour` Essence when the magician returns. An empty body
     * cannot dodge (`emptyBodyDefenseless`).
     */
    projection: { hoursPerEssence: 2, essenceLossPerHour: 1, emptyBodyDefenseless: true },
    /** Area spells: radius = Force (or Magic) x `metresPerPoint` (line of sight: TN_AUTO.magic.lineOfSight). */
    area: { radiusFrom: 'magic' as 'force' | 'magic', metresPerPoint: 1 }, // v0.77.0 book check: the caster's Magic in metres (was force)
    /** Masking: +grade x `tnPerGrade` to assense the magician or track their signatures. */
    masking: { tnPerGrade: 1 },
    /** Nature spirits: one per domain per magician (warned). */
    domains: { onePerDomain: true },
    /** Elementals need conjuring materials: nuyen per Force, and take hours per Force to summon. */
    binding: { nuyenPerForce: 1000, hoursPerForce: 1 },
    /** Weapons flagged magical (and any weapon with an active weapon focus) ignore immunity to normal weapons. */
    immunity: { magicWeaponsIgnore: true },
    /** Projecting casters reach only astral targets; astral-only targets can only be hit with mana spells. */
    planes: { projectingTargetsAstralOnly: true, astralTargetsNeedMana: true },
    /**
     * Good Karma: spells cost Force x `spellPerForce` (raising one costs the new Force). Initiation to grade N costs
     * (`initiationBase` + N) x the multiplier in RULES.OCCULT.initiation.multipliers (alone or in a group).
     */
    karmaCosts: { spellPerForce: 1, initiationBase: 6 },
    /** Ritual sorcery: a projecting spotter who can see the target replaces the material link. */
    ritual: { spotterReplacesLink: true },
    /**
     * Enchanting materials (gear items with a material kind): gathering adds successes raw units;
     * refining turns up to successes raw into refined; alchemy turns up to successes refined into
     * radicals; a fetish uses one refined unit; a focus needs `focusUnitsPerRating` x rating units
     * of `focusMaterial`.
     */
    materials: { focusMaterial: 'refined' as 'raw' | 'refined' | 'radical', focusUnitsPerRating: 1, fetishUses: 1 },
  },

  /**
   * The Matrix: cyberdecks, personas, hosts, system tests and cybercombat. All VERIFY: written from
   * memory of SR2 / Virtual Realities 2.0, and the least certain block in this file.
   * - Hacking Pool = floor((Intelligence + MPCP) / `hackingPoolDivisor`).
   * - Jacked in, Reaction = Intelligence + `reactionPerResponse` x Response Increase, and
   *   initiative dice = `baseInitiativeDice` + Response Increase. Cyberware Reaction does not count.
   * - Persona programs (Bod, Evasion, Masking, Sensors) are each at most MPCP, and together at most
   *   `personaTotalPerMpcp` x MPCP (warned, not blocked).
   * - Detection Factor = (Masking + the loaded Sleaze utility) / 2, rounded `detectionRounding`.
   * - System test: the `skill` (defaulting to Intelligence) + Hacking Pool vs TN = the subsystem
   *   rating minus the rating of the loaded utility used (`utilityLowersTn`), minimum 2. The host
   *   first rolls its Security Value vs TN = the Detection Factor; its successes go on the tally.
   * - Cybercombat: no dodge. A decker attacks with the skill vs TN = the IC's rating, Power = the
   *   attack utility's rating at its damage level. IC attack with their rating vs TN = the persona's
   *   Evasion, Power = rating. A persona resists with Bod + Hacking Pool vs Power - Hardening; IC
   *   resist with their rating vs Power. Each 2 successes stage the damage down. Black IC hit the
   *   decker's own Physical (or Stun) track, resisted with `blackIcResist` (+ Hacking Pool).
   * - Matrix condition monitor: `monitorBoxes` boxes. A full monitor crashes the persona (the decker
   *   is dumped) or derezzes the IC. Dump shock: Willpower vs TN = the host's Security Value
   *   (`dumpShockTn` without a host), `dumpShockLevel` stun, staged down by successes.
   */
  MATRIX: {
    skill: 'Computer',
    hackingPoolDivisor: 3,
    reactionPerResponse: 2,
    baseInitiativeDice: 1,
    maxResponseIncrease: 3,
    personaTotalPerMpcp: 3,
    detectionRounding: 'up' as 'up' | 'down',
    utilityLowersTn: true,
    monitorBoxes: 10,
    blackIcResist: 'willpower' as 'willpower' | 'body',
    dumpShockLevel: 'M' as 'L' | 'M' | 'S' | 'D',
    dumpShockTn: 6,
    subsystems: ['access', 'control', 'index', 'files', 'slave'] as ReadonlyArray<'access' | 'control' | 'index' | 'files' | 'slave'>,
    securityCodes: ['blue', 'green', 'orange', 'red', 'black'] as ReadonlyArray<'blue' | 'green' | 'orange' | 'red' | 'black'>,
    /** Default IC initiative dice by the host's security code (IC initiative = rating + Nd6). */
    icInitiativeDice: { blue: 1, green: 1, orange: 2, red: 2, black: 3 } as Record<string, number>,
    /** Alert levels, in order; a sheaf step can raise the host to one of them. */
    alerts: ['none', 'passive', 'active', 'shutdown'] as ReadonlyArray<'none' | 'passive' | 'active' | 'shutdown'>,

    // ---- Matrix depth (v0.27.0). All VERIFY, from memory of SR2 and Virtual Realities 2.0. ----

    /**
     * Defending in cybercombat. `persona: 'pool'`: a persona attacked by IC or another decker may
     * roll Hacking Pool dice against the attack's TN, like a dodge (each success cancels one of the
     * attacker's). `ic`: 'none' = IC never defend (as v0.17.0); 'rating' = IC roll their rating
     * against the decker's attack TN.
     */
    defense: { persona: 'pool' as 'pool' | 'none', ic: 'none' as 'none' | 'rating' },
    /**
     * What each IC does (the IC's `behavior`), and the TN its attack rolls against:
     * 'evasion' (the persona's Evasion), 'attribute' (the persona program it targets),
     * 'utility' (the utility it targets), 'detectionFactor'.
     * - killer: persona damage. blaster: persona damage; a crash also damages the MPCP.
     *   sparky: as blaster, and the decker takes biofeedback (`sparky`).
     * - probe, scout: their successes go on the host's security tally; no damage.
     * - trace: a hit locks on; the trace completes after `trace.baseTurns` / net successes Combat
     *   Turns (rounded up), then dumps the decker, reports their location, or burns (dump + MPCP).
     * - tarBaby: a hit crashes (unloads) a utility, and the tar baby derezzes (`tar.tarBabyDerezzes`).
     *   tarPit: also erases the utility from the deck.
     * - crippler: lowers a persona program until the decker jacks out; ripper: on the deck itself
     *   until repaired. Each `attributeDamage.successesPerPoint` net successes = 1 point (at least
     *   `minOnHit` on any hit).
     * - barrier: guards a subsystem: system tests on it are refused until the IC is crashed or
     *   decrypted. scramble: guards a file: a failed Decrypt File destroys it.
     */
    icAttackTn: {
      killer: 'evasion', blaster: 'evasion', sparky: 'evasion', trace: 'evasion', other: 'evasion',
      probe: 'detectionFactor', scout: 'detectionFactor',
      tarBaby: 'utility', tarPit: 'utility', crippler: 'attribute', ripper: 'attribute',
    } as Record<string, 'evasion' | 'attribute' | 'utility' | 'detectionFactor' | 'masking'>,
    attributeDamage: { successesPerPoint: 2, minOnHit: 1 },
    tar: { tarBabyDerezzes: true },
    trace: { baseTurns: 10, secondsPerTurn: 3, burnMpcp: true },
    /** Blaster and sparky crashes: the IC rolls its rating vs TN = MPCP; each `successesPerPoint` successes = 1 MPCP damage. */
    mpcpDamage: { successesPerPoint: 2 },
    /** Sparky biofeedback when it crashes a persona: Power = rating, resisted with `resist` (no pool). */
    sparky: { level: 'M' as 'L' | 'M' | 'S' | 'D', type: 'physical' as 'physical' | 'stun', resist: 'willpower' as 'willpower' | 'body' },
    /**
     * Medic utility: Medic rating (+ Hacking Pool when `pool`) vs a TN by the persona's damage
     * level; each success repairs `boxesPerSuccess` boxes; the utility loses 1 rating per use when
     * `degrades`. A complex action.
     */
    medic: { tnByLevel: { L: 4, M: 5, S: 6, D: 8 } as Record<string, number>, boxesPerSuccess: 1, degrades: true, pool: true },
    /**
     * Repairing a damaged deck (MPCP and persona programs): the first skill found (Intelligence at
     * +4 without), TN `tn`; each success repairs `pointsPerSuccess` points, MPCP first;
     * `hoursPerPoint` is shown only.
     */
    repair: { skills: ['Computer B/R', 'Electronics B/R', 'Computer'] as readonly string[], tn: 4, pointsPerSuccess: 1, hoursPerPoint: 1 },
    /**
     * Utility sizes: rating² × the multiplier for its kind (attack utilities by damage level).
     * Used for memory whenever a program's own Size is 0.
     */
    utilitySize: {
      attack: { L: 2, M: 3, S: 4, D: 5 } as Record<string, number>,
      kinds: {
        sleaze: 3, deception: 2, analyze: 3, browse: 1, decrypt: 1, evaluate: 2, 'read/write': 2, relocate: 2,
        medic: 4, mirrors: 3, shield: 4, smoke: 1, spoof: 3, validate: 4, track: 8, armor: 3, cloak: 3, 'lock-on': 3, other: 0,
        // v0.57.0 (VERIFY)
        slow: 4, restore: 3,
        frame: 3, 'smart-frame': 5, agent: 6,
      } as Record<string, number>,
    },
    /**
     * System operations: the subsystem each uses, the utility that helps, its action, and what it
     * does (`effect`). `tn: 'target'` uses the target's rating (an encrypted file, a barrier IC)
     * instead of the subsystem's. Add or change rows freely; 'custom' does nothing automatic.
     */
    operations: [
      { id: 'analyzeHost', label: 'Analyze host', subsystem: 'control', utility: 'analyze', action: 'simple', effect: 'analyzeHost' },
      { id: 'analyzeIc', label: 'Analyze IC', subsystem: 'control', utility: 'analyze', action: 'simple', effect: 'analyzeIc' },
      { id: 'analyzeSecurity', label: 'Analyze security', subsystem: 'control', utility: 'analyze', action: 'simple', effect: 'analyzeSecurity' },
      { id: 'redirectDatatrail', label: 'Redirect datatrail', subsystem: 'control', utility: 'relocate', action: 'complex', effect: 'redirectTrace' },
      { id: 'crashHost', label: 'Crash host', subsystem: 'control', utility: '', action: 'complex', effect: 'crashHost' },
      { id: 'invalidatePasscode', label: 'Invalidate passcode', subsystem: 'control', utility: '', action: 'complex', effect: 'invalidate' },
      // v0.57.0 (VERIFY): passcodes, data bombs and comcalls.
      { id: 'validatePasscode', label: 'Validate passcode', subsystem: 'access', utility: 'validate', action: 'complex', effect: 'validate' },
      { id: 'scanFile', label: 'Scan file (data bombs)', subsystem: 'files', utility: 'analyze', action: 'simple', effect: 'scanFile' },
      { id: 'defuseBomb', label: 'Defuse data bomb', subsystem: 'files', utility: 'decrypt', action: 'complex', effect: 'defuseBomb', tn: 'target' },
      { id: 'makeComcall', label: 'Make comcall (LTG)', subsystem: 'slave', utility: '', action: 'complex', effect: 'makeCall' },
      { id: 'tapComcall', label: 'Tap comcall (LTG)', subsystem: 'slave', utility: 'spoof', action: 'complex', effect: 'tapCall' },
      { id: 'rerouteComcall', label: 'Reroute comcall (LTG)', subsystem: 'control', utility: 'relocate', action: 'complex', effect: 'rerouteCall' },
      { id: 'decryptAccess', label: 'Decrypt access (barrier IC)', subsystem: 'access', utility: 'decrypt', action: 'complex', effect: 'decryptGuard', tn: 'target' },
      { id: 'gracefulLogoff', label: 'Graceful logoff', subsystem: 'access', utility: 'deception', action: 'simple', effect: 'logoff' },
      { id: 'locateFile', label: 'Locate file', subsystem: 'index', utility: 'browse', action: 'complex', effect: 'locateFile' },
      { id: 'locatePaydata', label: 'Locate paydata', subsystem: 'index', utility: 'evaluate', action: 'complex', effect: 'locatePaydata' },
      { id: 'locateNumber', label: 'Locate LTG number', subsystem: 'index', utility: 'browse', action: 'complex', effect: 'locateNumber' },
      { id: 'locateSlave', label: 'Locate slave', subsystem: 'index', utility: 'browse', action: 'complex', effect: 'locateSlave' },
      { id: 'downloadData', label: 'Download data', subsystem: 'files', utility: 'read/write', action: 'complex', effect: 'download' },
      { id: 'uploadData', label: 'Upload data', subsystem: 'files', utility: 'read/write', action: 'complex', effect: 'upload' },
      { id: 'editFile', label: 'Edit file', subsystem: 'files', utility: 'read/write', action: 'complex', effect: 'editFile' },
      { id: 'decryptFile', label: 'Decrypt file', subsystem: 'files', utility: 'decrypt', action: 'complex', effect: 'decryptFile', tn: 'target' },
      { id: 'controlSlave', label: 'Control slave', subsystem: 'slave', utility: 'spoof', action: 'complex', effect: 'controlSlave' },
      { id: 'editSlave', label: 'Edit slave', subsystem: 'slave', utility: 'spoof', action: 'complex', effect: 'controlSlave' },
      { id: 'monitorSlave', label: 'Monitor slave', subsystem: 'slave', utility: 'spoof', action: 'simple', effect: 'monitorSlave' },
      { id: 'decryptSlave', label: 'Decrypt slave (barrier IC)', subsystem: 'slave', utility: 'decrypt', action: 'complex', effect: 'decryptGuard', tn: 'target' },
      { id: 'logon', label: 'Log on (host, LTG or RTG)', subsystem: 'access', utility: 'deception', action: 'complex', effect: 'logon' },
      { id: 'nullOperation', label: 'Null operation', subsystem: 'access', utility: '', action: 'simple', effect: 'none' },
    ] as ReadonlyArray<{ id: string; label: string; subsystem: 'access' | 'control' | 'index' | 'files' | 'slave'; utility: string; action: 'simple' | 'complex'; effect: string; tn?: 'subsystem' | 'target' }>,
    /** Downloading: Combat Turns = file size ÷ (I/O speed × `ioPerTurn`), rounded up (shown only). */
    download: { ioPerTurn: 1 },
    /**
     * Paydata generated by security code: `points` = Nd6 + mod files; each is `sizeDice`d6 ×
     * `sizeMultiplier` Mp, worth `valuePerMp` nuyen per Mp. Defenses on 1d6: up to `plainUpTo`
     * none, up to `encryptedUpTo` encrypted, above that scramble IC, at the host's Security Value.
     */
    paydata: {
      codes: {
        blue: { pointsDice: 1, pointsMod: -1, sizeDice: 2, sizeMultiplier: 5, valuePerMp: 50 },
        green: { pointsDice: 2, pointsMod: -2, sizeDice: 2, sizeMultiplier: 10, valuePerMp: 75 },
        orange: { pointsDice: 2, pointsMod: 0, sizeDice: 2, sizeMultiplier: 15, valuePerMp: 100 },
        red: { pointsDice: 2, pointsMod: 2, sizeDice: 2, sizeMultiplier: 20, valuePerMp: 150 },
        black: { pointsDice: 2, pointsMod: 2, sizeDice: 2, sizeMultiplier: 25, valuePerMp: 200 },
      } as Record<string, { pointsDice: number; pointsMod: number; sizeDice: number; sizeMultiplier: number; valuePerMp: number }>,
      plainUpTo: 3,
      encryptedUpTo: 5,
    },

    // ---- The grid, sims, frames and connections (v0.28.0). All VERIFY. ----

    /**
     * The grid: a host actor can be a host, an LTG or an RTG (`gridKind`) hanging off a parent
     * grid (`parentUuid`: host → LTG → RTG). Logging on to a node is a system test on that node's
     * Access subsystem (Deception helps), rolled against that node's security. A node can be
     * reached from its parent, its children, or anywhere for a node with no parent (and any LTG or
     * RTG from outside the Matrix, through a jackpoint). `enforcePath`: 'warn' or 'block'.
     * Graceful logoff moves to the parent grid.
     */
    grid: { kinds: ['host', 'ltg', 'rtg'] as ReadonlyArray<'host' | 'ltg' | 'rtg'>, enforcePath: 'warn' as 'warn' | 'block' },
    /**
     * Hot and cold sim. Hot sim: `initiativeDice` more Matrix initiative dice; dump shock is
     * `dumpShockType`; Matrix damage of `overloadAt` or worse calls for a simsense overload test
     * (Willpower vs the damage's Power, `overloadLevel` Stun). Cold sim: with `coldBlackIcStun`
     * (off by default; a house rule), black IC that would do Physical damage do Stun.
     */
    sim: {
      hot: { initiativeDice: 1, dumpShockType: 'physical' as 'physical' | 'stun', overloadAt: 'S' as 'L' | 'M' | 'S' | 'D', overloadLevel: 'L' as 'L' | 'M' | 'S' | 'D' },
      cold: { coldBlackIcStun: false },
    },
    /**
     * Frames: programs a decker launches into a host to run system operations by themselves. A
     * frame rolls its core rating (a smart frame adds `smartPoolPerRating` × rating pool dice)
     * vs the subsystem minus the owner's best loaded utility for the operation; the host's
     * detection roll is against the owner's Detection Factor. Its initiative is rating + 1d6.
     * Frames are IC actors with kind 'frame'; deckers can crash them in cybercombat. The owner must be jacked in.
     */
    frames: { smartPoolPerRating: 0.5, initiativeDice: 1 },
    /**
     * How the decker connects: a TN modifier on every Matrix test, and whether being aboard a
     * moving vehicle adds `movingVehicle` more.
     */
    connections: [
      { id: 'jackpoint', label: 'Jackpoint (hard line)', tn: 0 },
      { id: 'cellular', label: 'Cellular link', tn: 1 },
      { id: 'satellite', label: 'Satellite uplink', tn: 2 },
      { id: 'vehicle', label: "A vehicle's comm system", tn: 1 },
      { id: 'remote', label: 'Remote deck (relayed)', tn: 2 },
    ] as ReadonlyArray<{ id: string; label: string; tn: number }>,
    movingVehicle: 1,

    // ---- Matrix leftovers (v0.40.0). All VERIFY, from memory of Virtual Realities 2.0. ----

    /**
     * Psychotropic IC (black IC with a mind-bending payload). It attacks like black IC (damage on
     * the decker's own track); every hit also offers a psychotropic test: `resist` (+ the loaded
     * Shield's rating as dice when `shieldDice`) vs TN = the IC's rating. Fewer than `successesNeeded`
     * successes and the effect takes hold for rating × `daysPerRating` days of world time (frenzy:
     * until the decker jacks out). Effects: cyberphobia +`cyberphobiaTn` on every Matrix test;
     * frenzy (must attack in cybercombat; a reminder chip); judas (the GM is told, and the host
     * goes to `judasAlert`); conditioning (a reminder chip for the GM to play).
     */
    psychotropic: {
      kinds: ['cyberphobia', 'frenzy', 'judas', 'conditioning'] as ReadonlyArray<'cyberphobia' | 'frenzy' | 'judas' | 'conditioning'>,
      resist: 'willpower' as 'willpower' | 'intelligence',
      successesNeeded: 1,
      shieldDice: true,
      daysPerRating: 1,
      cyberphobiaTn: 2,
      judasAlert: 'passive' as 'none' | 'passive' | 'active',
    },
    /**
     * Defensive utilities.
     * - armor: its rating comes off the Power of Matrix damage to the persona (with Hardening);
     *   it loses `degradesPerHit` rating each time it soaks a hit.
     * - shield: the same against black (and psychotropic) IC damage on the decker's own track.
     * - mirrors: + rating × `tnPerRating` (rounded down, at least 1) to the TN of attacks rolled
     *   against the persona's Evasion (IC attacks, traces, other deckers).
     * - smoke: released into the decker's host: every Matrix test there (deckers, IC, frames,
     *   the user too) gets + rating × `tnPerRating` (rounded down, at least 1) for rating ×
     *   `turnsPerRating` Combat Turns (`secondsPerTurn` of world time each outside combat).
     *   A simple action, no test.
     */
    utilities: {
      armor: { degradesPerHit: 1 },
      shield: { degradesPerHit: 1 },
      mirrors: { tnPerRating: 0.5 },
      smoke: { tnPerRating: 0.5, turnsPerRating: 1, secondsPerTurn: 3 },
    },
    /**
     * Frames and agents carrying utilities. A frame or agent takes copies of the owner's loaded
     * utilities when launched: at most rating × `carryPerRating` of them. Their own utilities
     * lower TNs and give attack Power; without any, a frame uses its owner's (`ownerUtilities`).
     * Frames and agents can attack (rating + pool dice vs the IC's rating or a persona's Evasion,
     * Power = the carried attack utility) and be attacked (TN = their rating; they resist with it).
     * Agents (`agents`): always have pool dice (rating × `poolPerRating`), act when the owner is
     * not jacked in, and the host's detection roll is against their own Detection Factor
     * ((rating + carried Sleaze) ÷ 2, rounded up) instead of the owner's.
     */
    carry: { carryPerRating: 1, ownerUtilities: true },
    agents: { poolPerRating: 0.5, ownDetection: true, initiativeDice: 2 },
    /**
     * Grid travel: each hop between two grids (LTG ↔ RTG ↔ RTG) on the route takes
     * `turnsPerHop` Combat Turns (`secondsPerTurn` of world time each outside combat). Logging on
     * to a host from its own grid, and jacking in at a jackpoint, take no travel. While travelling,
     * the decker's tests in the new node are refused (`blockInTransit`), or warned.
     */
    travel: { turnsPerHop: 1, secondsPerTurn: 3, blockInTransit: true },
    /**
     * Security deckers: characters the GM lists on a host. Their own system tests there have no
     * detection roll (`noDetection`). Security actions roll Computer + Hacking Pool:
     * spot an intruder (TN = the intruder's Detection Factor; success marks them spotted and
     * raises the alert to `spotAlert`); trace an intruder (TN = their Evasion + Mirrors, minus a
     * loaded Track utility; locks on like trace IC in `traceMode`); re-arm a device bypassed
     * through the host's Slave subsystem, or cancel the alert (TN `legitTn`; cancelling also
     * resets the tally when `cancelResetsTally`).
     */
    security: { noDetection: true, spotAlert: 'passive' as 'none' | 'passive' | 'active', traceMode: 'report' as 'dump' | 'report' | 'burn', legitTn: 4, cancelResetsTally: false },

    // ---- Matrix and rigging (v0.46.0). All VERIFY, from memory of SR2 and Virtual Realities 2.0. ----

    /**
     * Party IC: IC launched together share a `party` name. With `sharedInitiative`, every member of
     * a party in a combat acts on the best member's initiative score. "Party attack" has every live
     * member in the host act on one target, one after another, each by its own behavior.
     * Construct IC: one IC that can also act as any of its `construct` behaviors, at its own
     * rating (the GM picks the behavior each time), at most `maxComponents` behaviors in all.
     */
    party: { sharedInitiative: true },
    construct: { maxComponents: 4 },
    /**
     * LTG numbers: a host, LTG or RTG can have a number. A decker who dials a node's number logs on
     * to it from anywhere (`dialAnywhere`) instead of going through its grid. "Locate number"
     * (Index, Browse) learns the numbers of this node and the nodes connected to it.
     */
    numbers: { dialAnywhere: true },
    /**
     * Agents sent across several hosts: the agent logs on to each host in turn (a logon test on
     * that node's Access; the grid path is not enforced), then runs the search there; with
     * `stopOnFind` it stops at the first host where it finds something. At most `maxHosts`.
     */
    agentSearch: { stopOnFind: true, maxHosts: 8 },
    /**
     * Writing programs: `skill` (its `concentration` counts) vs TN = the program's rating + `tnMod`.
     * Base time = the program's size × `daysPerMp` days, ÷ successes (shown); no successes, no
     * program. The new program arrives unloaded.
     */
    programming: {
      skill: 'Computer', concentration: 'Programming', tnMod: 0, daysPerMp: 1,
      /**
       * v0.49.0 (Virtual Realities, VERIFY): a programming suite (gear with a suite rating) adds its
       * rating as dice ('dice') or takes it off the TN ('tn') on programming tests, capped at the
       * programmer's Computer rating (`capAtSkill`); `deckBuilding` lets it help design deck parts too.
       */
      suites: { mode: 'dice' as 'dice' | 'tn', capAtSkill: true, deckBuilding: true },
      /**
       * Program options chosen when writing a program: each multiplies its size (`size`), adds to the
       * TN (`tn`) and multiplies the design time (`days`). Add rows through the Advanced box.
       */
      options: [
        { id: 'optimization', label: 'Optimization (smaller code)', size: 0.75, tn: 1, days: 1.25 },
        { id: 'squeeze', label: 'Squeeze (compressed)', size: 0.5, tn: 2, days: 1.5 },
        { id: 'quick', label: 'Quick and dirty (rushed)', size: 1.25, tn: -1, days: 0.5 },
      ] as ReadonlyArray<{ id: string; label: string; size: number; tn: number; days: number }>,
    },
    /**
     * Building or upgrading a deck, one part at a time: the first of `skills` the builder has
     * (else Intelligence at +4) vs TN = the part's new rating + its `tn`. Time = `days` × rating
     * (× rating again when `squared`) ÷ successes; parts cost `cost` × rating (× rating again when
     * `squared`) nuyen, paid by the builder on success. Persona parts above the deck's MPCP warn.
     */
    deckBuilding: {
      skills: ['Computer B/R', 'Electronics B/R', 'Computer'] as readonly string[],
      /**
       * v0.49.0: each part has a design size in Mp (`size` × rating, × rating again when `squared`);
       * the work takes size × `daysPerMp` days ÷ successes, and its materials (chips, optical
       * boards) cost size × `costPerMp` nuyen. Memory parts (`memory`) are bought in Mp: rating =
       * the Mp added, TN `tn` flat, size = Mp ÷ `mpPerSize`, materials Mp × `costPerMp`.
       */
      daysPerMp: 1,
      parts: {
        mpcp: { label: 'MPCP', tn: 0, size: 2, squared: true, costPerMp: 500 },
        bod: { label: 'Bod', tn: 0, size: 2, squared: false, costPerMp: 250 },
        evasion: { label: 'Evasion', tn: 0, size: 2, squared: false, costPerMp: 250 },
        masking: { label: 'Masking', tn: 0, size: 2, squared: false, costPerMp: 250 },
        sensors: { label: 'Sensors', tn: 0, size: 2, squared: false, costPerMp: 250 },
        hardening: { label: 'Hardening', tn: 2, size: 4, squared: false, costPerMp: 500 },
        responseIncrease: { label: 'Response Increase', tn: 4, size: 7, squared: false, costPerMp: 3500 },
        activeMemory: { label: 'Active memory (Mp)', tn: 4, size: 0, squared: false, costPerMp: 20, memory: true, mpPerSize: 100 },
        storageMemory: { label: 'Storage memory (Mp)', tn: 3, size: 0, squared: false, costPerMp: 5, memory: true, mpPerSize: 200 },
        ioSpeed: { label: 'I/O speed (Mp/turn)', tn: 4, size: 0, squared: false, costPerMp: 50, memory: true, mpPerSize: 20 },
      } as Record<string, { label: string; tn: number; size: number; squared: boolean; costPerMp: number; memory?: boolean; mpPerSize?: number }>,
    },
    /**
     * Tortoises (decks without ASIST): the user works at meat speed (no Matrix initiative, uses
     * their normal Reaction and dice), has `hackingPool` × the Hacking Pool (rounded down), can't
     * run hot (`coldOnly`), is not hurt by black IC (its hits become Matrix damage,
     * `immuneToBlackIc`), takes no dump shock (`dumpShock`), and adds `tn` to Matrix tests.
     */
    tortoise: { hackingPool: 0.5, coldOnly: true, immuneToBlackIc: true, dumpShock: false, tn: 0 },
    /**
     * ICCM biofeedback filter (cyberware kind 'iccm', with a rating): black IC that would do
     * Physical damage do Stun (`blackIcStun`), and + rating × `dicePerRating` dice to resist black
     * IC, dump shock, sparky biofeedback and simsense overload.
     */
    iccm: { blackIcStun: true, dicePerRating: 1 },
    /**
     * Otaku (optional, off): a cyberdeck item ticked "Living persona" takes its ratings from the
     * otaku's attributes: MPCP = the sum of `mpcp` ÷ `divisor` (rounded down), each persona program
     * from its attribute (capped at MPCP), no Hardening, active memory MPCP × `memoryPerMpcp`, and
     * `initiativeDice` more Matrix initiative dice. Damage to the "deck" is damage to the persona.
     */
    otaku: {
      enabled: false,
      mpcp: ['intelligence', 'willpower', 'charisma'] as ReadonlyArray<'intelligence' | 'willpower' | 'charisma'>, divisor: 3,
      persona: { bod: 'willpower', evasion: 'intelligence', masking: 'charisma', sensors: 'intelligence' } as Record<string, 'body' | 'quickness' | 'strength' | 'charisma' | 'intelligence' | 'willpower'>,
      memoryPerMpcp: 100, initiativeDice: 1,
      /**
       * v0.49.0 (Virtual Realities, VERIFY): an otaku's channels (Access, Control, Index, Files,
       * Slave), each at most MPCP (`channels.maxFromMpcp`), raised for new rating × `karmaPerRating`
       * Good Karma. A channel works on its subsystem like a utility of its rating ('utility': the
       * better of it and the loaded utility lowers the TN) or adds its rating as dice ('dice').
       * Complex forms are the otaku's own programs: learned for rating × `karmaPerRating` Karma (at
       * most MPCP), never using memory and never erased.
       */
      channels: { mode: 'utility' as 'utility' | 'dice', maxFromMpcp: true, karmaPerRating: 2 },
      complexForms: { karmaPerRating: 1, maxFromMpcp: true, noMemory: true, neverErased: true },
    },
  },

  /**
   * Wireless signal range (v0.46.0), for cellular and relayed Matrix links and for remote control
   * decks. VERIFY, from memory of Virtual Realities 2.0 and the Rigger rules. Range in km by
   * signal rating (`rangeKm[rating]`, the last entry for anything higher). Past `farFraction` of
   * the range the link adds `farTn` to tests through it; out of range it fails (`outOfRange`:
   * 'block' refuses, 'warn' only warns). A distance of 0 (not entered, no tokens) is not checked.
   */
  SIGNAL: {
    // v0.79.0 docs check: the Rigger 2 flux range table: 250 m, 1, 2, 4, 6, 9,
    // 12, 16, 20, 25 km; past it (2 × Flux) + 10 km (RULES.DOCS_V79.signalFlux). (was 0, 1, 3, 10, 30, 100, 300, 1000, 3000, 10000)
    rangeKm: [0.25, 1, 2, 4, 6, 9, 12, 16, 20, 25] as readonly number[],
    /** v0.79.0: a decker's wireless Matrix link (cellular, relay) keeps the old table: Rigger 2's flux table covers the
     *  rigging radio link, and no official source in the owner's documents gives the decker's. VERIFY */
    matrixRangeKm: [0, 1, 3, 10, 30, 100, 300, 1000, 3000, 10000] as readonly number[],
    farFraction: 0.75,
    farTn: 1,
    outOfRange: 'warn' as 'warn' | 'block',
    wirelessConnections: ['cellular', 'remote'] as readonly string[],
  },

  /**
   * Measuring combat distance with the Foundry canvas (v0.19.0).
   * - `units`: scene distance units → metres. Unknown units are treated as metres (with a note).
   * - `useElevation`: token elevation difference counts (3D distance).
   * - `nearestSpace`: large tokens are measured between their nearest occupied spaces, not centres.
   * - `beyondExtreme` / `outOfReach`: 'block' refuses the attack unless "Attack anyway" is ticked;
   *   'warn' only shows the warning.
   * - `melee`: a melee attack reaches `baseMetres` (or one grid step, diagonals included, if that is
   *   longer) plus `metresPerReach` per point of the weapon's Reach. VERIFY
   */
  DISTANCE: {
    units: {
      m: 1, meter: 1, meters: 1, metre: 1, metres: 1,
      km: 1000, kilometer: 1000, kilometers: 1000, kilometre: 1000, kilometres: 1000,
      ft: 0.3048, foot: 0.3048, feet: 0.3048,
      yd: 0.9144, yard: 0.9144, yards: 0.9144,
      mi: 1609.344, mile: 1609.344, miles: 1609.344,
    } as Record<string, number>,
    useElevation: true,
    nearestSpace: true,
    beyondExtreme: 'block' as 'block' | 'warn',
    outOfReach: 'block' as 'block' | 'warn',
    melee: { baseMetres: 1, metresPerReach: 1 },
  },

  /**
   * Melee and ranged combat additions (v0.20.0). All VERIFY, from memory of SR2.
   */
  COMBAT: {
    /**
     * Melee is an opposed test: attacker and defender each roll their melee skill (+ Combat Pool)
     * vs `baseTn` plus their own modifiers. More successes wins; with `counterattack` a winning
     * defender damages the attacker with their own weapon, staged by the net successes. A tie
     * (`tie`): 'none' = nobody is hurt; 'attacker' / 'defender' = that side hits at its base
     * damage. Reach: each point of reach difference moves the defender's TN by `reachTnPerPoint`
     * (+ if the attacker's weapon is longer, − if the defender's is).
     */
    melee: { opposed: true, counterattack: true, tie: 'none' as 'none' | 'defender' | 'attacker', reachTnPerPoint: 1,
      /**
       * v0.47.0: the attribute a melee attack defaults to without the skill: 'linked' = the skill's
       * own attribute (an owned skill's, else guessed from its name: Armed, Edged, Clubs, Unarmed
       * → Strength), or always 'quickness' (as before) or 'strength'. VERIFY
       */
      defaultAttribute: 'linked' as 'linked' | 'quickness' | 'strength' },
    /**
     * Reach (v0.21.0): the side with the longer weapon gets `reachTnPerPoint` off its own TN per point
     * of difference. The attacker is compared with the target's longest melee weapon when attacking;
     * the defender with the attacker's weapon when defending.
     */
    reach: { appliesTo: 'longer' as 'longer' | 'defender' },
    /** Full defense: the defender adds this attribute's dice and gives up their next action (initiative −`initiativeCost`). */
    /**
     * Full defense (v0.35.0: declared at any time, VERIFY): +attribute dice against every attack until
     * the defender's next action. Declared in their own phase it is their action (`ownPhaseAction`);
     * declared out of turn it costs `initiativeCost` initiative (their next action). The action's
     * cost is RULES.ACTIONS.costs.fullDefense.
     */
    fullDefense: { attribute: 'quickness' as 'quickness' | 'body' | 'willpower', initiativeCost: 10 },
    /** Subduing: a melee attack can deal Stun instead of the weapon's damage type. */
    subdue: { damageType: 'stun' as 'physical' | 'stun' },
    /** Prone: TN modifiers for attacking a prone target, and for a prone attacker. */
    prone: { targetMelee: -2, targetRanged: 1, attackerMelee: 2, attackerRanged: -1 },
    /** Friends in melee: each other ally in melee with the same target gives the attacker this TN. */
    friendsInMelee: { tnPerFriend: -1, max: 4 },
    /** Charging: running into melee this Combat Turn. */
    charging: { tn: -1 },
    /**
     * Shooting through a barrier: its rating is added to the target's armor (`addsToArmor`).
     * Walls carry an SR2 barrier rating (set in the wall's config); walls without one count `defaultWallRating`.
     */
    barriers: { addsToArmor: true, defaultWallRating: 0, avMultiplier: 2, shapedMultiplier: 2 },
    /** Armor encumbrance: worn ballistic or impact above Quickness lowers Quickness by the excess × `penaltyPerPoint`. */
    encumbrance: { enabled: true, penaltyPerPoint: 1 },
    /** Smoke: TN by vision type (added to the light-level TN). */
    smoke: {
      smoke: { normal: 4, lowLight: 4, thermographic: 0 },
      thermal: { normal: 4, lowLight: 4, thermographic: 4 },
    } as Record<'smoke' | 'thermal', Record<'normal' | 'lowLight' | 'thermographic', number>>,
    /** Gyro mounts: the rating cancels recoil (after heavy doubling) and then walking/running penalties. */
    gyro: { offsetsMovement: true },
    /** Unarmed: Unarmed Combat skill, Power = Strength + `powerBonus`, this level and type. */
    unarmed: { name: 'Unarmed', skill: 'Unarmed Combat', powerBonus: 0, level: 'M' as 'L' | 'M' | 'S' | 'D', damageType: 'stun' as 'physical' | 'stun', reach: 0 },
    /** Thrown weapons and bows: default range limits as multiples of (capped) Strength. */
    strengthRange: { short: 1, medium: 2, long: 3, extreme: 5 },
    /** Heavy weapons: uncompensated recoil is multiplied by this. */
    heavyRecoilMultiplier: 2,
    /**
     * Ammunition. Each type changes Power, stages the damage level, multiplies the armor that
     * counts, and can change the armor kind or the damage type.
     */
    ammo: [
      { id: 'standard', label: 'Standard', power: 0, stages: 0, armorMultiplier: 1 },
      { id: 'apds', label: 'APDS', power: 0, stages: 0, armorMultiplier: 0.5 },
      { id: 'explosive', label: 'Explosive', power: 1, stages: 0, armorMultiplier: 1 },
      { id: 'exex', label: 'EX-explosive', power: 2, stages: 0, armorMultiplier: 1 },
      { id: 'flechette', label: 'Flechette', power: 0, stages: 1, armorMultiplier: 2 },
      { id: 'gel', label: 'Gel', power: -2, stages: 0, armorMultiplier: 1, armorKind: 'impact', damageType: 'stun' },
      { id: 'tracer', label: 'Tracer', power: 0, stages: 0, armorMultiplier: 1 },
    ] as ReadonlyArray<{ id: string; label: string; power: number; stages: number; armorMultiplier: number; armorKind?: 'ballistic' | 'impact'; damageType?: 'physical' | 'stun' }>,
    /** Called shot: +TN (in SITUATIONAL_MODIFIERS) and the attacker picks one effect. */
    calledShot: { damageStages: 1, ignoresArmor: true },
    /**
     * Grenades and other blast weapons: Power drops by `powerPerMetre` per metre from the blast
     * point. Successes do not stage the damage. With no successes it scatters `scatterDice`d6
     * metres in a random direction. Targets can dodge if `dodge`; armor kind as given.
     */
    blast: { powerPerMetre: 1, scatterDice: 1, dodge: false, armorKind: 'impact' as 'impact' | 'ballistic' },
    /**
     * Scatter (v0.21.0): every blast rolls `diceByRange`d6 metres for its range band, less
     * `metresPerSuccess` per attack success; 0 = on target. Walls between the blast point and a
     * target stop the blast (`wallsBlock`). Confined spaces: if at least `confinedRays` of 8 rays
     * from the blast point hit a wall within the blast radius, everyone caught takes
     * `confinedBonus` × the Power left at the nearest wall on top.
     */
    /**
     * v0.47.0 `diagram`: 'throw' reads the direction die along the line of the throw (1 = beyond the
     * target, then clockwise every 60°: 2 beyond-right, 3 short-right, 4 short, 5 short-left, 6
     * beyond-left), as the book's scatter diagram does; 'compass' is the old fixed 1 = north. VERIFY
     */
    scatter: { diceByRange: { short: 1, medium: 2, long: 3, extreme: 4 }, metresPerSuccess: 2, diagram: 'throw' as 'throw' | 'compass' },
    wallsBlock: true,
    /** v0.47.0: `enabled`, and `mode`: 'nearest' (bonus × the Power left at the nearest wall) or 'average' (at the walls' average distance). VERIFY */
    confined: { enabled: true, rays: 6, bonus: 0.5, mode: 'nearest' as 'nearest' | 'average' },
    /** Grenade kinds: Power lost per metre, damage type, and an effect instead of damage. */
    grenades: [
      { id: 'custom', label: 'Custom (Power per metre below)' },
      { id: 'offensive', label: 'Offensive', perMetre: 1 },
      { id: 'defensive', label: 'Defensive', perMetre: 2 }, // v0.77.0 book check: −1 per 0.5 m (was 0.5)
      { id: 'concussion', label: 'Concussion', perMetre: 1, damageType: 'stun' },
      { id: 'flash', label: 'Flash', perMetre: 5, effect: 'blind' }, // v0.77.0 book check: 5L in a 1 m blast (was 1 per metre)
      { id: 'gas', label: 'Gas', perMetre: 1, effect: 'gas' },
      { id: 'heRocket', label: 'Rocket / missile: high explosive', perMetre: 1 },
      { id: 'apRocket', label: 'Rocket / missile: anti-personnel', perMetre: 0.5 },
      { id: 'avRocket', label: 'Rocket / missile: anti-vehicle', perMetre: 0.25 }, // v0.78.0 owner's default: −1 per 4 m, as the anti-vehicle mortar round (was 4 per metre). VERIFY
      { id: 'demolition', label: 'Demolition charge', perMetre: 1 },
      // v0.61.0: smoke grenades leave a smoke region (COMBAT_V61.smoke: radius and how long it lingers).
      { id: 'smoke', label: 'Smoke', perMetre: 1, effect: 'smoke' },
      { id: 'thermalSmoke', label: 'Thermal smoke', perMetre: 1, effect: 'smoke' },
    ] as ReadonlyArray<{ id: string; label: string; perMetre?: number; damageType?: 'physical' | 'stun'; effect?: 'blind' | 'gas' | 'smoke' }>,
    /**
     * Shotguns: the spread is (distance / choke) metres across; everyone within half of it of the
     * target is hit, and Power drops `powerPerMetre` per full metre of spread.
     */
    shotgun: { powerPerMetre: 1, minChoke: 1, shape: 'cone' as 'cone' | 'circle' },
    /** Full auto at several targets: the rounds are split; each extra target adds this TN. */
    spreadFire: { extraTargetTn: 0, wastedRoundsPerMetre: 1 },
    /** Wall cover: some of the target hidden = partial cover; all of it = blind fire. */
    /** v0.47.0 `from`: 'token' tests sight lines from every point of the attacker's token and keeps the best (leaning out of cover); 'centre' only from its centre. */
    cover: { autoDetect: true, blindFireTn: 8, from: 'token' as 'token' | 'centre' },
    /**
     * Light from the scene's darkness level (0-1): up to each threshold is that light level.
     * Vision: the TN for each light level by vision type; the best the attacker has is used.
     */
    light: { normal: 0.25, partial: 0.5, minimal: 0.75, useLightSources: true },
    vision: {
      // v0.79.0 docs check: minimal light +6, SR2 p. 89 Visibility Table (was 4). Low-light and thermographic below are
      // the one-column (old) numbers; the book's cybernetic / natural columns: RULES.DOCS_V79.visionTable.
      normal: { normal: 0, partial: 2, minimal: 6, darkness: 8 },
      lowLight: { normal: 0, partial: 0, minimal: 2, darkness: 8 },
      thermographic: { normal: 0, partial: 1, minimal: 2, darkness: 4 },
    } as Record<'normal' | 'lowLight' | 'thermographic', Record<'normal' | 'partial' | 'minimal' | 'darkness', number>>,
    /** Movement this Combat Turn: walking up to Quickness × `walk` metres, running beyond (up to × `run`). */
    movement: { walk: 1, run: 3 },
    /**
     * Knockdown: after taking damage from an attack whose Power exceeds the target's Body
     * (`trigger: 'powerOverBody'`) or at Serious or worse ('serious'), roll Body vs TN = the
     * same TN as the damage resistance. No successes = knocked down (prone).
     */
    knockdown: { enabled: true, trigger: 'powerOverBody' as 'powerOverBody' | 'serious' },
    /**
     * Bioware: costs Body Index instead of Essence. The limit is the natural Body (`maxFrom`);
     * Magic drops by `magicPerBodyIndex` per point of Body Index, rounded down.
     */
    bioware: { maxFrom: 'body' as 'body' | 'essence', magicPerBodyIndex: 0.5 },
    /**
     * Gear and combat leftovers (v0.37.0). All VERIFY, from memory of SR2.
     * - `armorLayering`: 'highest' = only the best worn piece counts for each kind, plus every piece
     *   marked "adds to other armor" (helmets, form-fitting armor, shields); 'sum' = everything adds;
     *   'highestPlusHalf' = the best plus half (rounded down) of the rest. Encumbrance always uses the sum.
     * - `armorDegrade` (off by default, a house rule): a hit of `atLevel` or worse that armor had to
     *   stop takes `points` off the best worn piece of that kind (repaired from the sheet).
     * - `load`: carrying more than Strength × `kgPerStrength` kg costs `penaltyPerStep` Quickness per
     *   Strength × `stepKgPerStrength` kg (or part) over.
     * - `silencer` (SS/SA only) and `suppressor` (any mode): noticing the shot is a Perception test at +TN.
     * - `tracer`: in burst or full auto, `tnPerBurst` per burst already fired this phase, to `maxTn`.
     * - `throwBack`: someone within `metres` of a grenade's landing point can throw it back:
     *   `skill` (or `attribute` at +4) vs `tn`; success lands it near the thrower (scatter d6 − successes m).
     * - `stopAtWalls`: a scattering grenade stops at the first wall in its way instead of passing through.
     * - `flame`: flamethrowers hit everyone in a cone of `choke` to the target at full Power; armor
     *   `armorKind` × `armorMultiplier`; each target hit may catch fire (`catchFire` intensity).
     * - `missileGuidance`: a missile's Intelligence rating adds that many dice to the attack.
     * - `demolitions`: setting a charge is `skill` vs `tn`; each success adds `powerPerSuccess`; a
     *   shaped charge does × `barriers.shapedMultiplier` against a barrier and has no blast beyond it. Charges do `level` damage.
     * - `barriers`: a hit on a barrier (wall rating) does Power − rating to it (× 2 for anti-vehicle and
     *   shaped charges), taken off the rating; at 0 the wall is breached (no longer blocks anything).
     */
    armorLayering: 'highest' as 'highest' | 'sum' | 'highestPlusHalf',
    armorDegrade: { enabled: false, atLevel: 'S' as 'L' | 'M' | 'S' | 'D', points: 1 },
    load: { enabled: true, kgPerStrength: 10, stepKgPerStrength: 5, penaltyPerStep: 1 },
    silencer: { perceptionTn: 4, modes: ['SS', 'SA'] as readonly string[] },
    suppressor: { perceptionTn: 2 },
    tracer: { tnPerBurst: -1, maxTn: -3 },
    throwBack: { enabled: true, metres: 2, skill: 'Throwing', attribute: 'quickness' as const, tn: 4, scatterDice: 1 },
    stopAtWalls: true,
    flame: { choke: 1, armorKind: 'impact' as 'impact' | 'ballistic', armorMultiplier: 0.5, catchFire: 'burning' },
    missileGuidance: true,
    // ---- v0.55.0 (the v0.53.0 review). All VERIFY, from memory of SR2. ----
    /** Take Aim: a Simple Action at one target with one weapon, −1 TN each, at most half the skill (`maxFromSkill`) or `max`; any other action loses it. */
    aim: { tnPerAction: -1, maxFromSkill: 0.5, max: 0 },
    /** Attacking a different target than earlier in the same Combat Phase (ranged): + this TN per target already shot at. */
    multipleTargets: { tnPerTarget: 2 },
    /** A target that doesn't know the attack is coming (or was surprised by the attacker) can't dodge or use Combat Pool against it. */
    unaware: { autoFromSurprise: true },
    /** Rounds loaded per reload action by feed (a clip or belt reloads whole). v0.79.0: under RULES.DOCS_V79.rangedReload 'actions' a non-clip reload is a Complex Action (SRII pp. 81–83); the round counts are still house numbers. VERIFY */
    reloadFeed: { clip: 'all', belt: 'all', cylinder: 2, internal: 2, break: 2 } as Record<string, 'all' | number>,
    /** Drawing a weapon: 'off' (always ready), 'warn' (a note), 'action' (a Simple Action first; a quick-draw holster makes it free). */
    ready: { rule: 'off' as 'off' | 'warn' | 'action' },
    /** Armor against thrown weapons and bows when the weapon says 'auto'. */
    armorFor: { thrown: 'impact' as 'impact' | 'ballistic', bow: 'ballistic' as 'impact' | 'ballistic' },
    /** Shotgun spread: + this TN per metre of spread width at the target (0 = only Power drops). Check the book. */
    shotgunTnPerMetre: 0,
    /** Combining blasts at one spot: the strongest Power + this fraction of each other's Power there. */
    blastCombine: { fraction: 0.5 },
    /** Suppressive fire (Fields of Fire, optional): rounds used, and whether a target that takes cover (prone) is safe. */
    suppressive: { enabled: true, rounds: 10, coverIsSafe: true },
    /** On fire: the hazard each Combat Turn until put out (a Complex Action). */
    burning: { enabled: true, amount: 'burning', putOut: 'complex' as 'simple' | 'complex' },
    /** Holds (subduing): attacker Strength vs the target's Body, target Body vs the attacker's Strength; more successes pins (restrained). */
    hold: { status: 'restrain', attackerAttr: 'strength' as 'strength' | 'body', defenderAttr: 'body' as 'strength' | 'body' },
    demolitions: { skill: 'Demolitions', attribute: 'intelligence' as const, tn: 4, powerPerSuccess: 1, level: 'D' as 'L' | 'M' | 'S' | 'D' },
  },

  /**
   * Metatypes (v0.22.0). All VERIFY, from memory of SR2.
   * - `mods`: racial attribute modifiers, added to the base rating.
   * - Natural maximum = `naturalMax` + the racial modifier; augmented maximum = natural max × `augmentedMultiplier`
   *   (rounded down). Over either is warned on the sheet (`enforce: 'warn'`) or clamped (`'clamp'`).
   * - `vision`, `reach` (melee), `dermal` (armor vs both kinds), `toxinDice` (resisting disease and toxins),
   *   `run` (running multiplier on Quickness).
   */
  METATYPES: {
    naturalMax: 6,
    augmentedMultiplier: 1.5,
    enforce: 'warn' as 'warn' | 'clamp',
    types: {
      human: { label: 'Human', mods: {}, vision: {}, reach: 0, dermal: 0, toxinDice: 0, run: 3 },
      elf: { label: 'Elf', mods: { quickness: 1, charisma: 2 }, vision: { lowLight: true }, reach: 0, dermal: 0, toxinDice: 0, run: 3 },
      dwarf: { label: 'Dwarf', mods: { body: 1, strength: 2, willpower: 1 }, vision: { thermographic: true }, reach: 0, dermal: 0, toxinDice: 2, run: 2 },
      ork: { label: 'Ork', mods: { body: 3, strength: 2, charisma: -1, intelligence: -1 }, vision: { lowLight: true }, reach: 0, dermal: 0, toxinDice: 0, run: 3 },
      // v0.92.3 (book alignment): running × 2 (Core p. 83, Running Table; was × 3). The Revamp's patch sets 2 as well.
      troll: { label: 'Troll', mods: { body: 5, quickness: -1, strength: 4, charisma: -2, intelligence: -2 }, vision: { thermographic: true }, reach: 1, dermal: 1, toxinDice: 0, run: 2 },
    } as Record<string, { label: string; mods: Partial<Record<'body' | 'quickness' | 'strength' | 'charisma' | 'intelligence' | 'willpower', number>>; vision: { lowLight?: boolean; thermographic?: boolean }; reach: number; dermal: number; toxinDice: number; run: number }>,
  },

  /**
   * Non-magical healing (v0.22.0). All VERIFY, from memory.
   * - First aid: `skill` (default to `fallbackAttribute` at +4) vs TN by the track's wound level
   *   (`tnByLevel`), + medkit rating as dice; 1 box per success, at most `maxFraction` of the
   *   damage (rounded down, at least 1), once per wound, within `windowHours` of the damage.
   *   Any success also stabilises a dying patient.
   * - Natural healing: `attribute` vs TN by wound level; time to heal one box = the track's
   *   `periodHours` / successes; resting N hours heals floor(N / that) boxes. Care modifies the TN.
   *   v0.79.0: Stun only by default; Physical heals in stages (RULES.DOCS_V79.healing 'stages', rules/docs79-health.ts).
   */
  HEALING: {
    // v0.79.0 docs check: first aid TNs Light 4 / Moderate 6 / Serious 8 / Deadly 10 (was 2 / 4 / 6 / 8, the Wound
    // Table's numbers). Source: SRII First Aid Table.
    // medkitAddsDice applies only with RULES.DOCS_V79.firstAidMods 'medkitDice' (the old way).
    firstAid: { skill: 'Biotech', fallbackAttribute: 'intelligence' as const, tnByLevel: { L: 4, M: 6, S: 8, D: 10 }, boxesPerSuccess: 1, maxFraction: 0.5, windowHours: 1, medkitAddsDice: true,
      /** v0.55.0: first aid on a wound already healed by magic (since it last grew): false = not allowed. VERIFY */
      afterMagic: false },
    natural: {
      attribute: 'body' as const,
      tnByLevel: { L: 2, M: 4, S: 6, D: 8 },
      periodHours: { stun: 1, physical: 24 },
      care: [
        { id: 'none', label: 'Resting on your own', tn: 0 },
        { id: 'medkit', label: 'With a medkit and care', tn: -1 },
        { id: 'hospital', label: 'Hospital or clinic', tn: -2 },
        { id: 'intensive', label: 'Intensive care', tn: -3 },
        { id: 'home', label: 'At home (by lifestyle)', tn: 0 },
        { id: 'poor', label: 'Poor conditions', tn: 2 },
      ] as ReadonlyArray<{ id: string; label: string; tn: number }>,
    },
  },

  /**
   * Conditions (v0.22.0). Unconscious (full Stun), dying (full Physical) and dead set token
   * statuses; unconscious and dying characters cannot act (`blockActions`), are skipped in
   * combat (`skipInCombat`), drop the spells they sustain themselves (`dropSustained`), and
   * defend with no dice. A dying character takes 1 more Physical box every Body Combat Turns
   * (`dying.turnsPerBox: 'body'`) until stabilised. VERIFY
   * v0.59.0 (`dumpWhenDown`): a decker who goes unconscious or dying is dumped from the Matrix (dump
   * shock), a driver lets go (the vehicle goes to autopilot), and a jumped-in rigger is dumped out
   * (the rigger's dump shock, RULES.RIGGING.dumpShock). The dead just drop out.
   */
  /**
   * v0.59.0: spirits are disrupted, not knocked out or killed: a full Physical track (`disruptOn:
   * 'physical'`), or either track (`'either'`), disrupts the spirit. It takes no more turns, can't be
   * stabilised, and goes back to its plane (the GM decides when a bound spirit can be called again). VERIFY
   */
  SPIRITS_V59: { disruptOn: 'either' as 'physical' | 'either' },

  CONDITIONS: { statuses: true, blockActions: true, skipInCombat: true, dropSustained: true, dumpWhenDown: true, dying: { turnsPerBox: 'body' as 'body' | number } },

  /**
   * Status effects (v0.31.0). VERIFY. `blind`: a blinded character's attacks and spellcasting get
   * `attackTn` (as blind fire) and their other tests `otherTn`; a flash grenade blinds for
   * `flashTurns` Combat Turns (`flashSeconds` outside combat), then the status clears itself.
   * `prone`: standing up is a simple action (`standAction`).
   */
  STATUSES: {
    blind: { attackTn: 8, spellTn: 8, otherTn: 0, flashTurns: 3, flashSeconds: 9 },
    prone: { standAction: 'simple' as 'free' | 'simple' | 'complex' },
    /** v0.59.0: deafened: Perception by ear (a hearing test, or noticing someone unseen) at +`hearingTn`. VERIFY */
    deaf: { hearingTn: 8 },
    /** v0.59.0: paralysed (Foundry's Paralysis) or asleep (Sleep) characters cannot act. */
    paralysis: { blocksActions: true },
  },

  /**
   * Toxins, drugs and disease (v0.31.0). All VERIFY, from memory of SR2.
   * - A toxin, drug or disease is a gear item with a Power and damage level (Physical or Stun),
   *   a vector and a speed. The victim resists with `resistAttribute` (+ the extra dice their
   *   derived `toxinDice` gives: dwarves, toxin extractors, minus Body Index) and, for
   *   `inhalantVector`, tracheal filter dice, vs TN = Power; every 2 successes stage it down. No armor.
   * - `speeds`: how long until it takes effect (shown on the card; the GM rolls when it does).
   * - Drugs: taking one uses a dose and gives its bonuses for its duration; when it wears off
   *   (world time, or Combat Turns in combat) the crash is resisted like a toxin (Power, level, Stun).
   */
  TOXINS: {
    kinds: ['', 'toxin', 'drug', 'disease'] as readonly string[],
    vectors: ['contact', 'ingestion', 'inhalation', 'injection'] as readonly string[],
    resistAttribute: 'body' as 'body' | 'willpower',
    inhalantVector: 'inhalation',
    speeds: [
      { id: 'immediate', label: 'Immediately', seconds: 0 },
      { id: 'turn', label: 'After 1 Combat Turn', seconds: 3 },
      { id: 'minute', label: 'After 1 minute', seconds: 60 },
      { id: 'tenMinutes', label: 'After 10 minutes', seconds: 600 },
      { id: 'hour', label: 'After 1 hour', seconds: 3600 },
      { id: 'day', label: 'After 1 day', seconds: 86400 },
    ] as ReadonlyArray<{ id: string; label: string; seconds: number }>,
    secondsPerTurn: 3,
  },

  /**
   * Hazards (v0.31.0). All VERIFY. Falling: Power = metres × `powerPerMetre`, level `level`, armor
   * `armorKind` × `armorFraction`. Fire: by intensity, armor the same way. Drowning, cold and
   * fatigue: `attribute` vs a TN (drowning: `tn` + `tnPerTurn` per Combat Turn past holding
   * your breath; cold by severity; fatigue + `tnPerHour` per hour past the first), damage
   * `level` `type`, staged down by successes.
   */
  HAZARDS: {
    falling: { powerPerMetre: 1, level: 'S' as 'L' | 'M' | 'S' | 'D', armorKind: 'impact' as 'impact' | 'ballistic', armorFraction: 0.5 },
    fire: {
      intensities: [
        { id: 'small', label: 'Small fire', power: 4, level: 'L' },
        { id: 'burning', label: 'On fire', power: 6, level: 'M' },
        { id: 'blaze', label: 'Blaze', power: 8, level: 'S' },
        { id: 'inferno', label: 'Inferno', power: 10, level: 'D' },
      ] as ReadonlyArray<{ id: string; label: string; power: number; level: 'L' | 'M' | 'S' | 'D' }>,
      armorKind: 'impact' as 'impact' | 'ballistic', armorFraction: 0.5,
    },
    drowning: { attribute: 'body' as const, tn: 4, tnPerTurn: 1, level: 'M' as 'L' | 'M' | 'S' | 'D', type: 'stun' as 'physical' | 'stun' },
    cold: {
      attribute: 'body' as const,
      severities: [
        { id: 'chilly', label: 'Chilly', tn: 2 },
        { id: 'cold', label: 'Cold', tn: 4 },
        { id: 'freezing', label: 'Freezing', tn: 6 },
        { id: 'arctic', label: 'Arctic', tn: 8 },
      ] as ReadonlyArray<{ id: string; label: string; tn: number }>,
      level: 'L' as 'L' | 'M' | 'S' | 'D', type: 'stun' as 'physical' | 'stun',
    },
    fatigue: { attribute: 'body' as const, tn: 4, tnPerHour: 1, level: 'L' as 'L' | 'M' | 'S' | 'D', type: 'stun' as 'physical' | 'stun' },
  },

  /**
   * Health and environment (v0.42.0). All VERIFY, from memory of SR2 and the Shadowrun Companion.
   * - addiction: a drug with an Addiction rating calls for a test on every dose (`auto`): Body
   *   (physical addiction) or Willpower (mental) vs TN = the rating, + `tnPerRecentDose` for each
   *   other dose in the last `recentDays` days. No successes = addicted. Addicted and no dose for
   *   `withdrawalHours`: withdrawal, +`withdrawalTn` on every test. After `kickDays` days clean,
   *   a Willpower test vs the rating ends the addiction. Tolerance: every `dosesPerPoint` doses
   *   while addicted take 1 point off each of the drug's bonuses.
   * - disease: resisting exposure as a toxin; any damage left = infected (no damage yet). After
   *   the disease's incubation, every interval a Body (+ toxin dice) test vs Power: damage staged
   *   down as usual; a test with no damage counts toward recovery (the disease's Recoveries, or
   *   `recoveries`). `treatmentDice` are added under a doctor's or hospital's care.
   * - radiation: Body vs TN = the rad rating, `level` `type` per hour exposed, no armor;
   *   suffocation (a sealed room full of gas or smoke): as drowning.
   * - care costs per day of rest (`careCosts`, nuyen); at home, the lifestyle sets the TN
   *   (`homeCare`).
   * - protection: worn gear. A gas mask makes the wearer immune to inhaled toxins; a respirator
   *   adds its rating as dice against them; a chemsuit adds its rating against contact toxins.
   * - weather: a TN modifier on ranged attacks and Perception, by the best vision of whoever looks.
   */
  HEALTH: {
    addiction: { auto: true, attributes: { physical: 'body', mental: 'willpower' } as Record<string, 'body' | 'willpower'>, tnPerRecentDose: 1, recentDays: 7, withdrawalHours: 24, withdrawalTn: 2, kickDays: 14, dosesPerPoint: 5 },
    disease: { attribute: 'body' as const, recoveries: 3, treatmentDice: 2 },
    radiation: { level: 'M' as 'L' | 'M' | 'S' | 'D', type: 'physical' as 'physical' | 'stun' },
    suffocation: { tn: 4, tnPerTurn: 1, level: 'M' as 'L' | 'M' | 'S' | 'D', type: 'stun' as 'physical' | 'stun' },
    careCosts: { hospital: 500, intensive: 1000 } as Record<string, number>,
    homeCare: { street: 2, squatter: 1, low: 0, middle: 0, high: -1, luxury: -1 } as Record<string, number>,
    protection: { kinds: ['', 'gasMask', 'respirator', 'chemsuit'] as readonly string[] },
    weather: [
      { id: 'clear', label: 'Clear', normal: 0, lowLight: 0, thermographic: 0, driving: 0, movement: 1 },
      // v0.79.0 docs check: the SR2 p. 89 Visibility Table's Mist row (new).
      { id: 'mist', label: 'Mist', normal: 2, lowLight: 0, thermographic: 0, driving: 1, movement: 1 },
      // v0.79.0: light rain is the Visibility Table's light smoke row (RULES.DOCS_V79.visionWeatherFold); light snow, not in
      // the table, gets its own row with the old numbers (was one row, "Light rain or snow").
      { id: 'lightRain', label: 'Light rain', normal: 1, lowLight: 1, thermographic: 1, driving: 1, movement: 1 },
      { id: 'lightSnow', label: 'Light snow', normal: 1, lowLight: 1, thermographic: 1, driving: 1, movement: 1 },
      { id: 'heavyRain', label: 'Heavy rain', normal: 2, lowLight: 2, thermographic: 1, driving: 2, movement: 0.75 },
      { id: 'snow', label: 'Heavy snow', normal: 2, lowLight: 2, thermographic: 2, driving: 3, movement: 0.5 },
      { id: 'fog', label: 'Fog', normal: 2, lowLight: 2, thermographic: 1, driving: 1, movement: 1 },
      { id: 'heavyFog', label: 'Thick fog', normal: 4, lowLight: 4, thermographic: 2, driving: 2, movement: 0.75 },
      { id: 'storm', label: 'Storm or blizzard', normal: 4, lowLight: 4, thermographic: 3, driving: 3, movement: 0.5 },
    ] as ReadonlyArray<{ id: string; label: string; normal: number; lowLight: number; thermographic: number; driving: number; movement: number }>,
    /**
     * v0.48.0. All VERIFY.
     * - weather (above): `driving` is a TN modifier on driving tests (and chases) under that sky,
     *   `movement` multiplies walking and running rates (and athletics distances); `weatherOn`
     *   turns each part off. Vehicles in a covered place are the GM's call (untick in the dialog).
     * - contagion: a disease item can be contagious ('airborne', 'contact', 'blood'). A carrier
     *   exposes others from their sheet or the disease's progress card: airborne reaches everyone
     *   within `radiusMetres` of the carrier's token, contact and blood whoever the carrier targets.
     *   Those exposed resist the disease at its Power + `powerModifier`. Not while it is still
     *   incubating unless `duringIncubation`.
     * - radiationSickness: every radiation exposure adds rating × hours to a running dose; at each
     *   `stages` dose the character has radiation sickness of that stage (a disease that tests every
     *   `intervalHours`, cured after `recoveries` clean tests; a worse stage replaces it). The dose
     *   falls by `decayPerDay` a day (0 = only the GM clears it).
     */
    weatherOn: { driving: true, movement: true },
    contagion: { enabled: true, radiusMetres: 2, powerModifier: 0, duringIncubation: false },
    radiationSickness: {
      enabled: true,
      stages: [
        { dose: 10, name: 'Mild radiation sickness', power: 4, level: 'L' },
        { dose: 25, name: 'Radiation sickness', power: 6, level: 'M' },
        { dose: 50, name: 'Severe radiation sickness', power: 8, level: 'S' },
        { dose: 100, name: 'Acute radiation sickness', power: 10, level: 'D' },
      ] as ReadonlyArray<{ dose: number; name: string; power: number; level: 'L' | 'M' | 'S' | 'D' }>,
      intervalHours: 24, recoveries: 3, damageType: 'physical' as 'physical' | 'stun', decayPerDay: 1,
    },
  },

  /**
   * Gear and combat (v0.43.0). All VERIFY, from memory of SR2 and the Street Samurai Catalog.
   * - concealment: a search is a Perception test (RULES.PERCEPTION's skill, else attribute) vs TN =
   *   each item's Concealability; `minSuccesses` finds it. A frisk adds `friskTn`. Weapons with
   *   Concealability 0 and worn armor with 0 can't be hidden (always seen); other gear and cyberware
   *   with 0 aren't looked for. Scanners roll their rating vs the same TN (`defaultTn` when the item
   *   has none): weapon scanners find weapons (and cyberweapons with `weaponFindsCyberweapons`),
   *   cyberware scanners find installed cyberware (not bioware), explosive sniffers find explosives
   *   and grenades. A site's scanner device that finds something adds `tallyOnFind` per item.
   * - accessories: a laser sight gives the Attack dialog's Laser sight row and is dropped next to a
   *   smartlink (`laserNotWithSmartlink`). An imaging scope's magnification moves the range band like
   *   cyber magnification; the better of the two counts (`scopeStacks` adds them, to the cyber
   *   maximum). Recoil compensation: shock pad always; bipod and tripod only once set up
   *   (RULES.ACTIONS.costs.setUpWeapon; prone attackers count as set up with `proneIsSetUp`).
   * - spellsVsVehicles: mana spells can't affect vehicles (`manaAffects`). A combat spell's TN
   *   against a vehicle is its Object Resistance (the vehicle's own, else `objectResistance`); it
   *   hits like an attack with Power = Force, resisted with the vehicle's Body; armor counts when
   *   `combatArmor`, and spells count as anti-vehicle when `antiVehicle`. Elemental spells hit
   *   vehicles as attacks too; other physical spells just roll against the Object Resistance.
   * - shields: a worn armor item with a Parry rating adds it as dice (`parryAs: 'dice'`) or takes it
   *   off the TN (`'tn'`) on melee defense, including the Parry skill.
   * - grenades: `airburst` (an airburst link or a programmed grenade) scatters × `scatterFactor` and
   *   goes off in the air (no throw-back, ignores walls on the way); `impact` fuses go off where they
   *   land (no throw-back); `smart` grenades with a smartlink take `metresPerSuccess` more off per
   *   success. A bounced throw (off a wall, around a corner) costs `bounce.tn` and rolls
   *   `bounce.extraDice` more scatter dice, but needs no line of sight. A throw can be aimed up to
   *   `aimOffMetres` from the target in a chosen direction.
   * - charges: a set charge can be put on a timer (seconds; a Combat Turn is
   *   RULES.TOXINS.secondsPerTurn); it goes off by itself when the time is up (active GM).
   * - walls: a GM can repair a damaged or breached wall to its original rating, or a character by
   *   `repairPerSuccess` per success of a Build/Repair test (`repairSkill` vs `repairTn`).
   * - cyberDamage: after an attack does `atLevel` or worse Physical damage, each installed cyberware
   *   (and bioware with `bioware`) is damaged on 1d6 ≤ `chance`; a called shot at a limb raises the
   *   chance for that limb and what is housed in it to `calledChance`. `mode`: 'button' (a card
   *   button rolls it), 'auto' (rolled straight away), 'off'.
   * - cyberlimbs: tests made with a cyberlimb use its own Quickness (`quickness`: defaulting to
   *   Quickness, and attribute tests); a cyberlimb's armor counts only against called shots at it
   *   (`armorCalledOnly`).
   */
  GEAR: {
    concealment: { friskTn: -2, minSuccesses: 1, defaultTn: 4, weaponFindsCyberweapons: true, tallyOnFind: 1,
      /** v0.47.0: looking over or scanning several people at once: one action, + this TN per person after the first; frisks are one at a time. */
      groupTnPerPerson: 1 },
    scannerKinds: ['', 'weapon', 'cyber', 'explosive'] as readonly string[],
    accessories: {
      laserNotWithSmartlink: true, scopeStacks: false,
      support: { none: 0, bipod: 2, tripod: 6 } as Record<string, number>,
      shockPad: 1, proneIsSetUp: true,
      /** v0.47.0: a laser sight only helps out to this range (metres; 0 = any); a scope's vision mode (low-light, thermographic) counts for its weapon. */
      laserRangeMetres: 50, scopeVision: true,
    },
    spellsVsVehicles: { manaAffects: false, objectResistance: 8, combatArmor: false, antiVehicle: true },
    /** v0.47.0 `ranged`: 'dice' adds a worn shield's Parry rating as dodge dice against ranged attacks too; 'off' melee only. */
    shields: { parryAs: 'dice' as 'dice' | 'tn', ranged: 'dice' as 'dice' | 'off' },
    /**
     * v0.47.0: spells against objects (doors, walls, machines; vehicles have their own rule): Sorcery
     * vs the object's Object Resistance (`tns`: natural 3, low-tech 5, high-tech 8, highly processed
     * 10); mana spells can't affect objects. A physical combat spell at a wall damages it as a blast
     * of Power = Force + net successes × `powerPerSuccess`. VERIFY
     */
    spellsVsObjects: { tns: { natural: 3, lowTech: 5, highTech: 8, processed: 10 } as Record<string, number>, wallKind: 'lowTech', powerPerSuccess: 1 },
    /**
     * v0.47.0: disarming a set charge: Demolitions (else Intelligence +4) vs `baseTn` + the setter's
     * successes × `tnPerSetterSuccess`; a success disarms it; a disaster sets it off (`disasterBlows`). VERIFY
     */
    disarm: { baseTn: 4, tnPerSetterSuccess: 1, disasterBlows: true },
    grenades: {
      airburst: { scatterFactor: 0.5, throwBack: false, ignoreWalls: true },
      impact: { throwBack: false },
      smart: { metresPerSuccess: 1, needsSmartlink: true },
      bounce: { tn: 2, extraDice: 1 },
      aimOffMetres: 10,
    },
    walls: { repairSkill: 'Building B/R', repairAttribute: 'intelligence' as const, repairTn: 4, repairPerSuccess: 1 },
    /** v0.47.0 `nonAttack`: falls, fire, crashes and blasts check cyberware too. */
    cyberDamage: { mode: 'button' as 'button' | 'auto' | 'off', atLevel: 'D' as 'L' | 'M' | 'S' | 'D', chance: 1, calledChance: 3, bioware: false, nonAttack: true },
    cyberlimbs: { quickness: true, armorCalledOnly: true },
  },

  /**
   * Characters and the street (v0.44.0). All VERIFY, from memory of SR2 and the Shadowrun Companion;
   * items marked "check the book" may not be SR2 at all.
   * - builder: "Fill the sheet" in the build dialog sets the metatype, base attributes, Magic (6 for
   *   a magician or adept, `magicRating`), cash (the Resources priority less gear), a lifestyle by
   *   Resources priority paid `lifestyleMonths` ahead, and `contacts.count` level-`contacts.level`
   *   contacts (placeholders to name).
   * - qualities: edges and flaws (Shadowrun Companion; `enabled` off by default). Each has points
   *   (edges cost, flaws pay) and may give a TN modifier to one skill or attribute. The build check
   *   counts them: at most `maxEdges` / `maxFlaws` points, and edges no more than flaws (`balance`).
   * - movement: walking = Quickness × RULES.COMBAT.movement.walk metres per Combat Turn, running ×
   *   the metatype's run multiplier (dwarves 2).
   * - athletics: climbing, swimming and jumping are `skill` (else `attribute` at +4) vs the TN of the
   *   condition; climbing and swimming cover `metresPerSuccess` per success; a jump covers
   *   `jump.metresPerSuccess` per success (× `jump.runningMultiplier` with a run-up). No successes
   *   climbing: a fall; swimming: start drowning.
   * - threat: an NPC's Threat Rating adds that many dice to its Combat Pool (`addsToPool`; check the book).
   * - tests: an open test rolls with no TN: the highest die (sixes added up) is the result, and sets
   *   the opposing TN. A complementary skill rolled first adds 1 die per `complementary.successesPerDie`
   *   successes. Teamwork: each helper's successes add dice, at most the leader's rating (`teamwork.cap`).
   * - reputation (Companion; `enabled` off by default): Street Cred (career Karma / `credPerKarma`
   *   when `autoCred`), Notoriety and Public Awareness; Street Cred takes `socialTnPerCred` per point
   *   off social and legwork TNs (0 = shown only).
   * - perception: optional modifiers in the Perceive dialog; a sneaker against a group rolls Stealth
   *   once and every observer tests against that roll.
   * - social: the target's attitude and the situation, as TN modifiers in the Social dialog.
   * - rally: Leadership (else Charisma at +4) vs `tn` + `tnPerCasualty` per grunt down rallies a broken
   *   group (morale failures now mark the group "broken").
   * - grunts: a grunt group can be split into one token per grunt; morale and attacks then count the
   *   group's tokens.
   * - contacts: Loyalty (1–6) caps the extra dice bought with payment (one per `nuyenPerDie` paid), and
   *   a fee a contact charges per legwork.
   * - haggle: Negotiation (else Charisma at +4) opposed by the seller's `sellerDice` vs TN 4; each net
   *   success moves the price `percentPerNet`, at most `maxPercent`. fence: a fence pays `basePercent` of
   *   the street price, `percentPerNet` more per net success, at most `maxPercent`.
   */
  STREET: {
    builder: {
      magicRating: 6,
      lifestyles: { A: 'high', B: 'middle', C: 'low', D: 'low', E: 'squatter' } as Record<string, string>,
      lifestyleMonths: 1,
      contacts: { count: 2, level: 1 },
    },
    qualities: {
      enabled: false, maxEdges: 5, maxFlaws: 5, balance: true,
      /**
       * v0.49.0: edges and flaws after creation (Companion, VERIFY): gaining an edge costs its points ×
       * `edgePerPoint` Good Karma; buying off a flaw costs its points × `flawPerPoint`.
       */
      // v0.92.3 (book alignment): eliminating a flaw costs 10 × its points (Companion p. 22; was 2).
      karma: { edgePerPoint: 2, flawPerPoint: 10 },
    },
    athletics: {
      skill: 'Athletics', attribute: 'body' as 'body' | 'quickness' | 'strength',
      // v0.92.3 (book alignment): the Climbing Table, 3 / 5 / 8 / 14 (Fields of Fire p. 75; was 2 / 4 / 6 / 8).
      climb: [{ id: 'easy', label: 'Easily climbable (chain-link fence)', tn: 3 }, { id: 'rough', label: 'Broken surface (debris, tree, loose stone wall)', tn: 5 }, { id: 'smooth', label: 'Flat surface (brick wall)', tn: 8 }, { id: 'sheer', label: 'Sheer surface (metal wall, seamless stone)', tn: 14 }] as ReadonlyArray<{ id: string; label: string; tn: number }>,
      swim: [{ id: 'calm', label: 'Calm water', tn: 3 }, { id: 'choppy', label: 'Choppy', tn: 5 }, { id: 'rough', label: 'Rough', tn: 7 }, { id: 'storm', label: 'Storm or rapids', tn: 9 }] as ReadonlyArray<{ id: string; label: string; tn: number }>,
      metresPerSuccess: 2,
      jump: { tn: 4, metresPerSuccess: 1, runningMultiplier: 2 },
    },
    threat: { addsToPool: true },
    tests: { complementary: { successesPerDie: 2 }, teamwork: { cap: 'rating' as 'rating' | 'none' } },
    reputation: { enabled: false, autoCred: true, credPerKarma: 10, socialTnPerCred: 0 },
    perception: [
      { id: 'distracted', label: 'Observer distracted', value: 2 },
      { id: 'noisy', label: 'Noisy surroundings', value: 2 },
      { id: 'crowd', label: 'Crowded area', value: 2 },
      { id: 'searching', label: 'Observer actively searching', value: -2 },
      // v0.50.0: "Within a few metres" is now measured between the tokens (RULES.TN_AUTO.perception.range).
    ] as ReadonlyArray<{ id: string; label: string; value: number }>,
    social: {
      attitudes: [
        // v0.79.0 docs check: Suspicious +2 (was +1). SRII Social Skill Table.
        { id: 'friendly', label: 'Friendly', value: -2 }, { id: 'neutral', label: 'Neutral', value: 0 }, { id: 'suspicious', label: 'Suspicious', value: 2 },
        { id: 'prejudiced', label: 'Prejudiced', value: 2 }, { id: 'hostile', label: 'Hostile', value: 4 }, { id: 'enemy', label: 'Enemy', value: 6 },
      ] as ReadonlyArray<{ id: string; label: string; value: number }>,
      situations: [
        { id: 'advantage', label: 'The character has the upper hand', value: -2 },
        { id: 'disadvantage', label: 'The target has the upper hand', value: 2 },
        { id: 'against', label: 'What is asked is against their interests', value: 2 },
        { id: 'harmless', label: 'What is asked costs them nothing', value: -1 },
        { id: 'bribe', label: 'A bribe or a favour offered', value: -1 },
      ] as ReadonlyArray<{ id: string; label: string; value: number }>,
    },
    rally: { skill: 'Leadership', attribute: 'charisma' as const, tn: 4, tnPerCasualty: 1 },
    /**
     * v0.49.0 (house rules, VERIFY): a contact with dice of their own (`dice` on the contact) digs
     * too: 'best' (the better of the two results counts), 'add' (their successes add to yours),
     * 'instead' (only theirs counts) or 'off'. A favour (`favours`: + they owe you, − you owe them)
     * called in adds `favourDice` dice and waives their fee (`favourWaivesFee`); asking one of a
     * contact who owes none puts you in their debt. Favours run from −`maxFavours` to +`maxFavours`.
     */
    contacts: { maxLoyalty: 6, nuyenPerDie: 100, ownDice: 'best' as 'best' | 'add' | 'instead' | 'off', favourDice: 2, favourWaivesFee: true, maxFavours: 5 },
    haggle: { skill: 'Negotiation', attribute: 'charisma' as const, sellerDice: 4, tn: 4, percentPerNet: 5, maxPercent: 25 },
    fence: { skill: 'Negotiation', attribute: 'charisma' as const, fenceDice: 4, tn: 4, basePercent: 30, percentPerNet: 5, maxPercent: 50 },
    /**
     * Heat on stolen goods (v0.49.0, house rules, VERIFY): an item's Heat (0–`max`) cools by 1 every
     * `coolDays` days of world time after it was marked. A fence pays `percentPerPoint`% less per
     * point (never below 0) and won't touch anything hotter than `refuseAbove`. On a sale the item's
     * Heat rolls against `traceTn` (`traceRoll`); any success means word gets around (a GM card).
     */
    heat: { enabled: true, max: 10, coolDays: 7, percentPerPoint: 5, refuseAbove: 8, traceRoll: true, traceTn: 4 },
  },

  /**
   * Perception and stealth (v0.32.0). VERIFY. Opposed: the observer rolls `attribute` (+ the
   * `skill` if they have it, instead) vs TN = the sneaker's Stealth rating (at least `minTn`;
   * `noStealthTn` without it); the sneaker rolls Stealth (Quickness at +4 without) vs TN = the
   * observer's `attribute`. More observer successes = noticed.
   */
  PERCEPTION: { attribute: 'intelligence' as const, skill: 'Perception', stealthSkill: 'Stealth', stealthAttribute: 'quickness' as const, minTn: 2, noStealthTn: 2 },
  /**
   * Social tests (v0.32.0). VERIFY. Opposed: each side rolls the skill (the target may use the
   * same skill or default to its attribute at +4) vs TN = the other side's attribute named here.
   * Net successes are the margin; the GM decides what they buy.
   */
  SOCIAL: {
    skills: { Etiquette: 'charisma', Negotiation: 'willpower', Leadership: 'intelligence', /* v0.77.0 book check (SR2 core skill text): was charisma for both */ Interrogation: 'willpower', Intimidation: 'willpower', Instruction: 'intelligence' } as Record<string, 'charisma' | 'willpower' | 'intelligence'>,
  },
  /**
   * Grunt groups (v0.32.0). VERIFY. An NPC with a group size above 1 is that many identical grunts
   * sharing one sheet and one initiative; its condition monitor is the grunt in front. When that
   * grunt goes down (unconscious, dying, dead) the next steps in with a clear monitor. The group
   * can attack as one: every standing grunt makes the attack.
   */
  GRUNTS: { maxSize: 20 },
  /**
   * Morale (v0.32.0). VERIFY. Professional Rating dice vs TN `tn` + `tnPerCasualty` per grunt down
   * (and + `tnHurt` when the grunt in front is wounded Serious or worse); no successes = the group
   * breaks (flees or surrenders). With `onCasualty`, a Morale button follows each grunt going down.
   */
  /**
   * v0.49.0: a mixed group (the GM panel groups tokens of different NPCs for morale) tests on one
   * roll: the `mixed` Professional Rating of its standing members ('highest', 'average' rounded
   * down, 'lowest', or 'leader': the NPC who rolls), counting every member down as a casualty.
   */
  MORALE: { tn: 4, tnPerCasualty: 1, tnHurt: 1, onCasualty: true, mixed: 'highest' as 'highest' | 'average' | 'lowest' | 'leader' },

  /**
   * Upkeep (v0.33.0). All VERIFY, from memory of SR2.
   * - `lifestyles`: nuyen a month; paying extends "paid until" by `monthDays` days a month.
   * - `karma.poolEvery`: every this many points of Karma earned (career total), one point goes
   *   into the Karma Pool instead of Good Karma (`human` for humans, `metahuman` for the rest);
   *   `diverts` off = the pool point is extra, not taken from the award.
   * - `karma.attributeMultiplier`: raising an attribute costs new rating x this (up to the natural
   *   maximum). `karma.skills`: raising a skill costs new rating x the multiplier of the first band
   *   whose `upTo` (x the linked attribute) the new rating fits (active, or knowledge/language vs
   *   Intelligence); a specialization costs `specializationFraction` of that, rounded up.
   * - `contacts`: legwork is `skill` (default Charisma at +4) vs TN = the information's difficulty
   *   - `tnPerLevel` for each contact level above 1 (at least `minTn`); `tiers`: what the
   *   successes buy (0, 1, 2, 3, 4+).
   * - `availability`: finding an item is `skill` vs its Availability TN; the time is the base time
   *   / successes; no successes = not found this time. Its price is cost x Street Index x quantity.
   * - `ledgerMax`: Karma, nuyen and lifestyle entries kept on the sheet.
   */
  UPKEEP: {
    monthDays: 30,
    lifestyles: [
      { id: 'street', label: 'Street', cost: 0 },
      { id: 'squatter', label: 'Squatter', cost: 100 },
      { id: 'low', label: 'Low', cost: 1000 },
      { id: 'middle', label: 'Middle', cost: 5000 },
      { id: 'high', label: 'High', cost: 10000 },
      { id: 'luxury', label: 'Luxury', cost: 100000 },
    ] as ReadonlyArray<{ id: string; label: string; cost: number }>,
    karma: {
      // v0.92.3 (book alignment): 10 points to Good Karma, then the next one to the pool, for everyone (Companion p. 76;
      // Core p. 190 has no metahuman rate). Was human 10, metahuman 20.
      poolEvery: { human: 11, metahuman: 11 },
      diverts: true,
      // v0.92.3 (book alignment): new rating × 1 (Core p. 190: Strength 5 → 6 costs 6). Was 2. The Revamp's patch sets 1.5.
      attributeMultiplier: 1,
      skills: {
        active: [{ upTo: 1, multiplier: 1.5 }, { upTo: 1.5, multiplier: 2 }, { upTo: 99, multiplier: 2.5 }],
        knowledge: [{ upTo: 1, multiplier: 1 }, { upTo: 1.5, multiplier: 1.5 }, { upTo: 99, multiplier: 2 }],
      } as Record<'active' | 'knowledge', ReadonlyArray<{ upTo: number; multiplier: number }>>,
      specializationFraction: 0.5,
    },
    contacts: {
      levels: [
        { level: 1, label: 'Contact' },
        { level: 2, label: 'Buddy' },
        { level: 3, label: 'Friend for life' },
      ] as ReadonlyArray<{ level: number; label: string }>,
      skill: 'Etiquette', attribute: 'charisma' as const, tnPerLevel: 1, minTn: 2,
      difficulties: [
        { id: 'common', label: 'Common knowledge', tn: 3 },
        { id: 'street', label: 'Street talk', tn: 4 },
        { id: 'quiet', label: 'Kept quiet', tn: 6 },
        { id: 'secret', label: 'A real secret', tn: 8 },
      ] as ReadonlyArray<{ id: string; label: string; tn: number }>,
      tiers: ['Nothing useful', 'Rumours', 'The basics', 'Most of it', 'Everything they know'] as readonly string[],
    },
    availability: { skill: 'Etiquette', attribute: 'charisma' as const, defaultHours: 24 },
    ledgerMax: 100,
    /**
     * Lifestyle beyond the bill (v0.49.0, house rules, VERIFY):
     * - `overdue`: more than `graceDays` days unpaid, the landlord moves the character down one
     *   lifestyle: 'prompt' (a GM card with a button), 'auto', or 'off'. Once per unpaid date.
     * - `availabilityTn`: the connections a lifestyle brings, as a TN modifier on finding gear.
     * - `overdueHomeCare`: resting at home while overdue counts as this lifestyle ('' = no change).
     */
    effects: {
      graceDays: 7,
      overdue: 'prompt' as 'prompt' | 'auto' | 'off',
      availabilityTn: { street: 2, squatter: 1, low: 0, middle: 0, high: -1, luxury: -2 } as Record<string, number>,
      overdueHomeCare: 'street',
    },
  },

  /**
   * Delaying (v0.35.0). VERIFY. The acting character may delay; later in the same initiative pass
   * they can act at any moment (before whoever is acting). With `lostAtPassEnd`, a delayed action
   * not taken by the end of the pass is lost.
   */
  DELAY: { lostAtPassEnd: true },

  /**
   * Rule of One disasters (v0.35.0): a GM card suggests a consequence by test kind (house text, not the
   * book's); an attack's disaster can jam the weapon (cleared with a `clearJam` action, or a reload).
   */
  DISASTERS: {
    prompt: true,
    suggestions: {
      attack: 'The weapon jams or the attacker drops it, or loses their footing.',
      defend: 'The defender stumbles: knocked down, or the attacker gets a free shot.',
      spell: 'The spell goes wild: a wrong target, or drain staged up one level.',
      soak: 'The worst case: the damage hits something vital (GM call).',
      drive: 'The vehicle loses control: a crash test.',
      system: 'The host notices: the alert goes up, or the deck takes a hit.',
      plain: 'Something goes badly and obviously wrong (GM call).',
    } as Record<string, string>,
  },

  /**
   * Tokens (v0.36.0). Not book rules: how the system drives Foundry's tokens.
   * - `autoVision`: set each token's vision from the character's eyes. `vision`: the Foundry vision
   *   mode and range (scene units, e.g. metres) for normal eyes, low-light (dim light counts as
   *   bright) and thermographic (sees heat in the dark); ultrasound adds a detection mode.
   * - `bars`: Physical and Stun as token bars (boxes left of `monitorBoxes`).
   * - `woundIcons`: a status icon for the worst wound level (Light, Moderate, Serious, Deadly).
   */
  TOKENS: {
    autoVision: true,
    vision: {
      normal: { mode: 'basic', range: 0 },
      lowLight: { mode: 'lightAmplification', range: 0 },
      thermographic: { mode: 'darkvision', range: 30 },
      ultrasound: { detection: 'feelTremor', range: 50 },
    },
    bars: true,
    monitorBoxes: 10,
    woundIcons: true,
    /**
     * v0.59.0: `statusList` 'sr2' keeps only the token statuses the system uses (Foundry's own list has
     * many that mean nothing in SR2); 'all' keeps Foundry's whole list. `stateIcons`: SR2 states shown
     * as statuses on the token by themselves (full defense, delaying, surprised, on fire, broken morale,
     * jacked in, jumped in).
     */
    statusList: 'sr2' as 'sr2' | 'all',
    stateIcons: true,
    /** v0.59.0: the drag ruler coloured by the mover's walking and running rates (colours as numbers). */
    ruler: { enabled: true, walk: 0x2ecc40, run: 0xffc400, over: 0xff4136 },
  },

  /**
   * Skills (v0.38.0). VERIFY.
   * - Concentrations sit between a skill and its specialization; a test can use the skill, its
   *   concentration or its specialization rating. Raising one costs `concentrationFraction` of the skill's cost.
   * - Skill Web: the GM enters links between skills (Game Settings → SR2e → Skill Web), each a number of
   *   steps. Defaulting to a related skill costs `perStep` TN per step along the shortest path (at most
   *   `maxSteps`); once the web has links, skills with no path can't be defaulted to (`unlinked:
   *   'attribute'`, the attribute only) or default at RULES.SKILL_DEFAULT_TN_MOD (`'flat'`). With no links
   *   at all, every related skill is RULES.SKILL_DEFAULT_TN_MOD.
   * - Parry (`parry`, off by default): melee defense can use the `parrySkill`; it blocks but never counterattacks.
   * - Martial arts: a skill marked as a martial art / unarmed style replaces Unarmed Combat for
   *   unarmed attacks and defense when it is rated higher, with its own Power, stage, reach and defense dice.
   * - Build/Repair skills: `buildRepair` kind; vehicle repair uses the first of `vehicleRepair.skills`
   *   the repairer has vs `vehicleRepair.tn`, each success repairs `boxesPerSuccess` boxes.
   */
  SKILLS: {
    concentrationFraction: 0.75,
    // v0.92.3 (book alignment): no step cap (Core p. 68: any path may be traced; was 3). The Revamp's patch sets 99 too.
    web: { perStep: 2, maxSteps: 99, unlinked: 'attribute' as 'flat' | 'attribute' },
    parry: false, parrySkill: 'Parry',
    vehicleRepair: { skills: ['Car B/R', 'Bike B/R', 'Aircraft B/R', 'Boat B/R', 'Drone B/R', 'Vehicle B/R'] as readonly string[], tn: 4, boxesPerSuccess: 1, hoursPerBox: 1 },
  },

  /**
   * Character creation (v0.38.0): the SR2 priority table, from memory. All VERIFY.
   * Each of Race, Magic, Attributes, Skills and Resources takes one of A–E, each letter once.
   * - `race`: the lowest priority each metatype needs (human anything).
   * - `magic`: A = full magician, B = adept or aspected magician; otherwise no Magic.
   * - Attributes: points for the base ratings (before racial modifiers), each 1 to `attributeMax`.
   * - Skills: points for active skill ratings (concentrations and specializations are free trade-offs),
   *   each at most `skillMax`; knowledge and language skills get Intelligence × `knowledgePerInt` free
   *   points (0 = they come out of the skill points).
   * - Resources: nuyen for gear (item costs, cyberware at its grade) plus the cash kept.
   */
  CREATION: {
    priorities: {
      A: { magic: 'full', attributes: 30, skills: 50, resources: 1000000 },
      B: { magic: 'adept', attributes: 27, skills: 40, resources: 400000 },
      C: { magic: 'none', attributes: 24, skills: 34, resources: 90000 },
      D: { magic: 'none', attributes: 21, skills: 30, resources: 20000 },
      E: { magic: 'none', attributes: 18, skills: 27, resources: 5000 },
    } as Record<'A' | 'B' | 'C' | 'D' | 'E', { magic: 'full' | 'adept' | 'none'; attributes: number; skills: number; resources: number }>,
    race: { human: 'E', elf: 'C', troll: 'C', dwarf: 'D', ork: 'D' } as Record<string, 'A' | 'B' | 'C' | 'D' | 'E'>,
    attributeMax: 6, skillMax: 6, knowledgePerInt: 0,
  },

  /**
   * The rest of magic (v0.39.0). All VERIFY, from memory of SR2 and the Grimoire.
   * - `elementEffects`: what a hit from an elemental manipulation of each element can do on top of
   *   the damage. 'fire': the target may catch fire (RULES.COMBAT.flame.catchFire); 'shock': Body
   *   vs the spell's Force, failing loses `shock.initiativeLoss` initiative (no combat: stunned for
   *   `shock.stunTurns` turns); 'corrode': the best worn armor piece loses `corrode.points`;
   *   'knockdown': a knockdown test at TN = Force; 'none'.
   * - `sustainLimit`: an elemental sustains a spell for at most its Force × `hoursPerForce` hours of
   *   world time (0 = no limit); then the spell drops.
   * - `domains.enforce`: a nature spirit outside its domain (its domain not among the scene's
   *   environment tags): 'warn', 'block' its actions, or 'off'.
   * - `addiction`: the focus addiction test, rolled when active bonded foci total more than Magic:
   *   `attribute` vs TN = that total (or the excess over Magic). Failing makes the magician
   *   addicted: with no focus active, their magical tests take `withdrawalTn`.
   * - `sites`: hermetic libraries and circles, shamanic lodges (gear with a site kind and rating).
   *   Hermetics summoning elementals need a conjuring library and a circle of the element, each
   *   rated at least the Force; ritual sorcery needs a sorcery library (hermetic) or a lodge of the
   *   totem (shamanic) of at least the Force. `enforce`: 'warn', 'block' or 'off'. `nuyenPerRating` is only the
   *   fallback price for a site kind missing from RULES.OCCULT.sites.nuyenPerRating; the live costs and days are
   *   RULES.OCCULT.sites.
   * - `ritualStages`: ritual sorcery is prepared first (materials, Force hours), then sent; the
   *   materials cost Force × `materialsPerForce` nuyen (0 = none). `waitForPrep`: the Send button
   *   warns (or refuses for players) until the preparation time has passed.
   * - `cleaning`: erasing an astral signature, `skill` (defaulting to Magic) vs TN = the
   *   signature's Force; each success takes `hoursPerSuccess` hours off what is left of it.
   *   Foci and enchanted items carry their maker's signature (`objectSignatures`).
   * - `perceiving.allTests`: the astral perception TN modifier applies to every physical test,
   *   not only attacks (dual-natured beings don't take it).
   * - `background`: aspected background count (a source aligned to a tradition, totem or element)
   *   gives aligned magicians its rating as extra dice ('bonus') instead of a penalty, or is
   *   ignored by them ('ignore'). Toxic sources also add to drain (`toxicAffectsDrain`).
   */
  MAGIC_V39: {
    elementEffects: { fire: 'fire', lightning: 'shock', acid: 'corrode', water: 'knockdown', air: 'knockdown', earth: 'knockdown', cold: 'none' } as Record<string, 'fire' | 'shock' | 'corrode' | 'knockdown' | 'none'>,
    shock: { attribute: 'body' as 'body' | 'willpower', initiativeLoss: 10, stunTurns: 1 },
    corrode: { points: 1 },
    sustainLimit: { hoursPerForce: 1 },
    domains: { enforce: 'warn' as 'off' | 'warn' | 'block' },
    addiction: { attribute: 'willpower' as 'willpower' | 'charisma' | 'intelligence', tnFrom: 'total' as 'total' | 'excess', withdrawalTn: 2 },
    sites: { enforce: 'warn' as 'off' | 'warn' | 'block', elementalCircle: true, elementalLibrary: true, ritualSite: true, nuyenPerRating: 1000 },
    ritualStages: { enabled: true, materialsPerForce: 0, waitForPrep: 'block' as 'off' | 'warn' | 'block' },
    cleaning: { skill: 'Sorcery', hoursPerSuccess: 1, needsAstral: true },
    objectSignatures: true,
    perceiving: { allTests: true },
    background: { aspected: 'bonus' as 'bonus' | 'ignore' | 'penalty', toxicAffectsDrain: true },
  },

  /**
   * Adept powers with effects (v0.39.0). A power's "Special" picks one; its level scales it. VERIFY
   * - killingHands: unarmed attacks do Physical damage; damage level by power level (`levels`).
   * - combatSense: + level × `dicePerLevel` dice when dodging or defending in melee and on surprise tests.
   * - painResistance: ignores level × `boxesPerLevel` boxes of damage for wound modifiers.
   * - enhancedPerception: + level dice on Perception tests.
   * - astralPerception: the adept can perceive astrally.
   */
  ADEPT: {
    /** v0.54.0: physical adepts have no Spell Pool in SR2 (they cast no spells); true gives them one. */
    spellPool: false,
    /** v0.59.0 `magical`: killing hands are a magical attack, so they get past immunity to normal weapons. VERIFY */
    killingHands: { levels: ['L', 'M', 'S', 'D'] as ReadonlyArray<'L' | 'M' | 'S' | 'D'>, magical: true }, // v0.77.0 book check: four levels L/M/S/D (was M/S/D)
    combatSense: { dicePerLevel: 1 },
    painResistance: { boxesPerLevel: 1 },
    enhancedPerception: { dicePerLevel: 1 },
  },

  /**
   * Critters (v0.39.0): weaknesses and special powers set on Power items ("Special"). All VERIFY,
   * from memory of SR2 critter rules; no critter data is included.
   * - Allergies by severity: `tn` added to every test while exposed; `contact` = the damage a touch
   *   (or a hit with a weapon of it) does on top, unresisted; '' = none.
   * - Vulnerability: a weapon of that substance (the weapon's Material) stages its damage up
   *   `stageUp` levels and ignores immunity to normal weapons; it cannot be regenerated.
   * - Essence loss: −`points` Essence every `days` days of world time (vampires, ghouls).
   * - Essence drain: a hit with the power moves `perNet` Essence per net success from the victim
   *   to the drainer, who can reach at most `maxEssence`.
   * - Regeneration: at the end of each Combat Turn (and as world time passes, once per hour)
   *   `boxesPerTurn` Physical boxes heal (0 = all), except damage from its vulnerability.
   * - Dual-natured: always astrally active (perceiving), with no astral perception penalty.
   * - Shapeshifters switch form (a complex action, ACTIONS.costs.shapeshift); the human form adds
   *   its own attribute adjustments.
   */
  CRITTERS: {
    allergy: {
      nuisance: { tn: 0, contact: '' },
      mild: { tn: 1, contact: '' },
      moderate: { tn: 2, contact: 'L' },
      severe: { tn: 2, contact: 'M' },
    } as Record<'nuisance' | 'mild' | 'moderate' | 'severe', { tn: number; contact: '' | 'L' | 'M' | 'S' | 'D' }>,
    vulnerability: { stageUp: 1, ignoresImmunity: true },
    essenceLoss: { points: 1, days: 30 },
    essenceDrain: { perNet: 1, maxEssence: 12 },
    regeneration: { boxesPerTurn: 0 },
    /** v0.45.0: ghouls and vampires feeding: a meal resets the Essence loss clock; after `hungerDays` without one, +`hungerTn` on every test. */
    diet: { feedingResets: true, hungerDays: 7, hungerTn: 1, drainFeeds: true },
    /**
     * v0.48.0: a critter power with the Infection special (a ghoul's bite) passes on a disease when
     * its melee attack does at least `minBoxes` Physical boxes to a living target: the damage card
     * gets a "Resist infection" button. The disease is the power's Substance (else `name`), its
     * Power the power's rating (else `power`) at the power's damage level, `vector` and the
     * timings below. VERIFY (the HMHVV strains' real numbers are in the book).
     */
    infection: { enabled: true, minBoxes: 1, name: 'HMHVV (Krieger strain)', power: 6, damageType: 'physical' as 'physical' | 'stun', vector: 'injection', incubationHours: 72, intervalHours: 24, recoveries: 3, contagious: 'blood' as '' | 'airborne' | 'contact' | 'blood' },
  },

  /**
   * Magic and critters, plan 3 step 4 (v0.45.0). All VERIFY, from memory of SR2 and The Grimoire
   * (second edition); none of it is book text.
   * - `metamagic`: the five techniques added this version.
   *   - cleansing: an initiate on the astral plane rolls `skill` (Magic without it) vs TN = the
   *     background count × `tnPerPoint` (+`toxicTn` for a toxic source); every `successesPerPoint`
   *     successes take 1 off the count (the plain count first, then the strongest unaligned source).
   *     `hoursPerPoint` hours of work per point (shown). With `signaturesNeedTechnique`, cleaning a
   *     signature needs the technique too.
   *   - divining: `skill` (Magic without it) vs a TN by the question (`tns`) + `tnPerWeek` per week
   *     ahead; the GM answers with the clarity in `answers` (by successes, last entry for more).
   *     Whispered to the GMs and the diviner's owners.
   *   - invoking: on one of the initiate's own nature spirits or elementals: Conjuring vs TN =
   *     Force + `tnModifier`, costing `servicesCost` service(s); a success makes it a great form
   *     spirit: + `attributeBonus` to every attribute and + `powerBonus` to its powers' potency.
   *     Conjuring drain for Force + `drainForceBonus`.
   *   - possessing: a projecting initiate takes over a body: Willpower + grade dice vs TN = the
   *     target's Willpower, opposed by the target's Willpower vs TN = the initiate's Willpower.
   *     More successes = possessed: the body uses the possessor's mental attributes (`mental`).
   *     Ends when either side ends it or the possessor stops projecting.
   *   - reflecting: when resisting a spell (not a power), resistance successes beyond the caster's
   *     bounce the spell back at the caster with that many successes. `needsSpellDefense`: only
   *     while spell defense dice are held back.
   * - `initiation`: Karma = (base + grade) × the multiplier: `multipliers.self` alone, `.group` in
   *   a magical group; an ordeal takes `ordealReduction` off the multiplier (never below
   *   `minMultiplier`). `ordeals`: id, label and effect ('attribute' = −1 to an attribute's base,
   *   'geas' = a new geas protecting 1 Magic, 'quest' = needs a finished astral quest, '' = noted).
   *   `site`: initiation needs a library (hermetic) or lodge (shamanic) rated at least the new
   *   grade ('off' | 'warn' | 'block').
   * - `design`: designing a spell (Grimoire formula, from memory): the drain level is the spell's
   *   damage level (combat) or `baseLevel` by category; the drain modifier adds `physical`, `area`,
   *   `sustained`, `elemental`, `touch`, `stun` (combat spells doing Stun) and `resisted`
   *   (non-combat spells resisted by an attribute). The design test is `skill` vs TN = Force +
   *   `tnModifier`, a library's rating (hermetic) or lodge's (shamanic) adding `siteDicePerRating`
   *   dice; it takes Force × `daysPerForce` days ÷ successes. Learning it costs the spell's Karma.
   * - `groups`: magical groups (world setting `sr2e.magicGroups`): members share the group's
   *   libraries, circles and lodges (`shareSites`) and its grimoire (spells learned without a
   *   design test); a member with an open stricture breach loses those and group initiation.
   * - `traditions`: toxic and insect shamans as optional traditions (`enabled`). Both use a totem
   *   like shamans. Toxic shamans count toxic background sources as aligned and take no toxic drain
   *   penalty; insect shamans need a hive (a lodge) to summon and summon only insect spirits.
   *   `spirits`: the spirit kinds each may summon (others are warned).
   * - `powers`: sustained critter powers: `attributes` changes last while the power is sustained;
   *   `perSuccess` multiplies them by the net successes (capped at `maxPerSuccess` × the change).
   * - `ritualNotice`: the target of a ritual (when preparation starts) may notice it: awakened
   *   targets roll Intelligence (+ grade) vs `tn` (−`astralBonus` when astrally active); mundanes
   *   only with `mundanes`.
   * - `sites`: building or raising a library, circle or lodge: nuyen per point of rating by kind
   *   (`nuyenPerRating`), days per point.
   */
  OCCULT: {
    metamagic: {
      cleansing: { skill: 'Sorcery', tnPerPoint: 2, toxicTn: 2, successesPerPoint: 2, hoursPerPoint: 1, needsAstral: true, signaturesNeedTechnique: false },
      divining: {
        skill: 'Sorcery', tnPerWeek: 1,
        tns: [{ id: 'general', label: 'General (where is it going?)', tn: 4 }, { id: 'specific', label: 'Specific (who will betray us?)', tn: 6 }, { id: 'exact', label: 'Exact (when and where, to the hour)', tn: 8 }] as ReadonlyArray<{ id: string; label: string; tn: number }>,
        answers: ['No answer comes.', 'A vague image or feeling.', 'A cryptic but true answer.', 'A clear answer.'] as readonly string[],
      },
      invoking: { tnModifier: 0, servicesCost: 1, attributeBonus: 2, powerBonus: 2, drainForceBonus: 2 },
      /**
       * v0.48.0 `skills`: which skills a possessed body tests with: 'possessor' (the possessor's
       * own, copied when the possession starts), 'body' (the body's own), 'best' (the better of the
       * two), or 'split' (skills linked to a mental attribute from the possessor, physical ones from
       * the body).
       */
      possessing: { mental: ['charisma', 'intelligence', 'willpower'] as readonly string[], diceFromGrade: true, skills: 'possessor' as 'possessor' | 'body' | 'best' | 'split' },
      /** v0.48.0 `powers`: critter and spirit powers resisted by the initiate bounce back too. */
      reflecting: { needsSpellDefense: false, powers: true },
    },
    initiation: {
      multipliers: { self: 3, group: 2 },
      ordealReduction: 1,
      minMultiplier: 1,
      ordeals: [
        { id: 'asceticism', label: 'Asceticism (lose 1 point of an attribute)', effect: 'attribute' },
        { id: 'deed', label: 'Deed (a task for the GM to set)', effect: 'deed' },
        { id: 'familiar', label: 'Familiar (bond an ally spirit)', effect: 'familiar' },
        { id: 'geas', label: 'Geas (accept a new geas)', effect: 'geas' },
        { id: 'meditation', label: 'Meditation (time alone)', effect: 'meditation' },
        { id: 'oath', label: 'Oath (to a group or cause)', effect: 'oath' },
        { id: 'quest', label: 'Astral quest (a finished quest)', effect: 'quest' },
        { id: 'thesis', label: 'Thesis (a written work)', effect: 'thesis' },
      ] as ReadonlyArray<{ id: string; label: string; effect: '' | 'attribute' | 'geas' | 'quest' | 'deed' | 'familiar' | 'meditation' | 'oath' | 'thesis' }>,
      site: 'warn' as 'off' | 'warn' | 'block',
      /**
       * v0.48.0, the rest of the ordeals. VERIFY, from memory of The Grimoire.
       * - deed: the initiation waits for the GM to confirm the deed is done (`gmConfirms`); the Karma
       *   is paid then.
       * - familiar: needs an ally spirit the initiate conjured since their last initiation (`needsAlly`).
       * - meditation: `attribute` vs TN `tn` + `tnPerGrade` × the new grade; a failure postpones the
       *   initiation (no Karma spent). Takes `weeksPerGrade` × grade weeks (shown).
       * - oath: sworn to a magical group (`needsGroup`) or a cause; becomes a geas protecting
       *   `geasMagic` Magic, met while the oath is kept.
       * - thesis: `skill` (else `fallback` attribute +4) vs `tn` + `tnPerGrade` × grade, a library or
       *   lodge adding its rating in dice (`siteDice`); a failure postpones. `weeksPerGrade` weeks.
       */
      deed: { gmConfirms: true },
      familiar: { needsAlly: 'block' as 'off' | 'warn' | 'block' },
      meditation: { attribute: 'willpower' as 'willpower' | 'intelligence' | 'charisma', tn: 4, tnPerGrade: 1, weeksPerGrade: 1 },
      oath: { needsGroup: false, geasMagic: 1 },
      thesis: { skill: 'Magical Theory', fallback: 'intelligence' as 'intelligence' | 'willpower', tn: 4, tnPerGrade: 1, siteDice: true, weeksPerGrade: 1 },
    },
    /**
     * v0.48.0: creating an ally spirit by ritual. VERIFY, from memory of The Grimoire. The magician
     * must be an initiate of at least `minGrade`; the ally's Force is at most their Magic
     * (`maxForce` 'magic') or grade ('grade'). Conjuring (+ a library, circle or lodge's rating in
     * dice when `siteDice`) vs TN = Force + `tnModifier`; any success creates it. Ritual materials
     * cost `nuyenPerForce` × Force, the ritual takes `daysPerForce` × Force days (shown), and bonding
     * the ally costs `karmaPerForce` × Force Good Karma on success. Drain as conjuring at the
     * Force. The ally counts for the familiar ordeal of the next initiation.
     */
    ally: { minGrade: 1, maxForce: 'magic' as 'magic' | 'grade', tnModifier: 0, siteDice: true, nuyenPerForce: 1000, daysPerForce: 1, karmaPerForce: 1 },
    design: {
      baseLevel: { detection: 'L', health: 'M', illusion: 'M', manipulation: 'M' } as Record<string, 'L' | 'M' | 'S' | 'D'>,
      /**
       * v0.48.0 adds: `permanent` (a permanent spell), `restricted` (a very restricted target, e.g. one
       * metatype), `extendedRange` (detection spells), `singleSense` (an illusion of one sense).
       * Exclusive and fetish spells are flags on the new spell; their drain TN changes apply when
       * cast (RULES.SPELLCRAFT). VERIFY
       */
      modifiers: { physical: 1, area: 1, sustained: 0, elemental: 1, touch: -1, stun: -1, resisted: 1, permanent: 1, restricted: -1, extendedRange: 1, singleSense: -1 },
      skill: 'Sorcery', tnModifier: 0, siteDicePerRating: 1, daysPerForce: 1,
    },
    groups: { shareSites: true, grimoire: true },
    traditions: {
      enabled: false,
      spirits: { toxic: ['toxic'], insect: ['insect'] } as Record<string, readonly string[]>,
      insectNeedsHive: true,
    },
    powers: { maxPerSuccess: 3 },
    ritualNotice: { enabled: true, tn: 6, astralBonus: 2, mundanes: false, gradeDice: true },
    sites: {
      nuyenPerRating: { library: 1000, circle: 500, lodge: 500 } as Record<string, number>,
      daysPerRating: 1,
    },
  },

  /**
   * Fire on the scene (v0.45.0), from flamethrowers and fire elementals' secondary effect. VERIFY
   * - A fire starts at the burning target's token with `startRadius` metres when `fromHits` is on
   *   (or the GM starts one from the GM panel); each Combat Turn (and each `secondsPerTurn` of
   *   world time outside combat) it grows by `metresPerTurn` up to `maxRadius`, and burns out after
   *   `turns` Combat Turns (0 = until put out).
   * - Everyone inside when it grows is listed on a GM card with Resist buttons: fire damage at the
   *   fire's intensity (RULES.HAZARDS.fire), starting at `intensity` and rising one step every
   *   `escalateTurns` Combat Turns up to `maxIntensity`.
   * - `draw`: a translucent circle drawing on the scene shows it.
   */
  FIRE: {
    fromHits: true,
    startRadius: 1,
    metresPerTurn: 1,
    maxRadius: 6,
    turns: 6,
    secondsPerTurn: 3,
    intensity: 'small' as string,
    escalateTurns: 3,
    maxIntensity: 'blaze' as string,
    draw: true,
    /**
     * v0.48.0. `walls`: solid walls (blocking movement) keep a fire's heat off whoever stands behind
     * them (`block`). A wall ticked "Burns" in its config loses `burnPerTurn[intensity]` points of
     * barrier rating each time the fire spreads while the wall is inside it; burnt through (rating
     * 0) it no longer blocks, so the fire reaches past it. Walls with no rating set count as
     * `defaultRating` for burning.
     */
    walls: {
      block: true,
      burnPerTurn: { small: 0, burning: 1, blaze: 2, inferno: 3 } as Record<string, number>,
      defaultRating: 2,
    },
    /**
     * v0.48.0. `fuel`: drawings the GM marks as fuel (GM panel). A fire that reaches one (not through
     * a wall) sets it alight: a new fire at its centre that grows `metresPerTurn` faster, lasts
     * `extraTurns` longer, starts `intensitySteps` hotter and can grow to cover the whole drawing.
     * A fire started inside fuel takes on its kind. `spreads`: off stops fires catching fuel.
     */
    fuel: {
      spreads: true,
      kinds: {
        light: { label: 'Light fuel (paper, brush, furniture)', metresPerTurn: 1, extraTurns: 3, intensitySteps: 0 },
        heavy: { label: 'Accelerant (petrol, oil, chemicals)', metresPerTurn: 2, extraTurns: 6, intensitySteps: 1 },
      } as Record<string, { label: string; metresPerTurn: number; extraTurns: number; intensitySteps: number }>,
    },
    /**
     * v0.48.0. `smoke`: a fire gives off smoke out to `extraMetres` beyond its flames. A line of fire
     * passing through the smoke counts as `kind` smoke in the Attack dialog (pre-selected), and
     * through the flames themselves as `flamesKind` (the heat blinds thermographic vision); the
     * same applies to Perception tests aimed through it. After a fire burns out the smoke lingers
     * `lingerTurns` Combat Turns. `inhalation`: everyone in the smoke when the fire spreads gets a
     * button to resist Power `power` (+`powerPerIntensity` per intensity step) `level` `type`,
     * staged down by Body successes; gas masks stop it and respirators help (inhaled).
     */
    smoke: {
      enabled: true,
      extraMetres: 3,
      kind: 'smoke' as 'smoke' | 'thermal',
      flamesKind: 'thermal' as 'smoke' | 'thermal',
      lingerTurns: 3,
      inhalation: { enabled: true, power: 4, powerPerIntensity: 1, level: 'L' as 'L' | 'M' | 'S' | 'D', type: 'stun' as 'physical' | 'stun' },
    },
  },

  /** Stun weapons (tasers, stun batons; v0.31.0): Stun damage against `armorKind` × `armorMultiplier`. VERIFY */
  /**
   * v0.55.0: slap patches (gear `patch.kind` and rating). VERIFY, house numbers.
   * stim: takes `rating` Stun boxes off for `hoursPerRating` × rating hours, then they come back plus `backlash`;
   * tranq: the target's Body vs TN rating, Stun boxes = rating − successes;
   * trauma: stabilises a dying patient; antidote: + rating dice against the next toxin within `hoursPerRating` × rating hours.
   */
  PATCHES: { kinds: ['', 'stim', 'tranq', 'trauma', 'antidote'] as readonly string[], stim: { hoursPerRating: 1, backlash: 1 }, antidote: { hoursPerRating: 1 }, action: 'simple' as 'simple' | 'complex' },
  STUN_WEAPONS: { armorKind: 'impact' as 'impact' | 'ballistic', armorMultiplier: 0.5 },

  /**
   * Actions per combat phase (v0.22.0): two simple actions or one complex one, plus free actions.
   * `enforce`: 'warn' tells you when a phase's actions are used up, 'block' refuses (GM can still
   * act), 'off' tracks nothing. `costs` per action kind. VERIFY
   */
  ACTIONS: {
    enforce: 'warn' as 'off' | 'warn' | 'block',
    perPhase: 2,
    costs: {
      'fire:SS': 'simple', 'fire:SA': 'simple', 'fire:BF': 'simple', 'fire:FA': 'complex',
      melee: 'complex', throw: 'simple', reload: 'simple', 'reload:clip': 'complex', 'reload:complex': 'complex', cast: 'complex', summon: 'complex', banish: 'complex',
      power: 'complex', astral: 'complex', assense: 'simple', dispel: 'complex', firstAid: 'complex', skill: 'complex',
      drive: 'complex', stand: 'simple', drug: 'simple', perceive: 'simple', social: 'complex', clearJam: 'simple', fullDefense: 'complex',
      'matrix:simple': 'simple', 'matrix:complex': 'complex', matrixAttack: 'complex', medic: 'complex',
      shapeshift: 'complex', cleanSignature: 'complex',
      // v0.43.0
      setUpWeapon: 'complex', search: 'complex', scan: 'simple',
      // v0.44.0
      athletics: 'complex', rally: 'complex',
      // v0.55.0
      aim: 'simple', draw: 'simple', patch: 'simple', putOutFire: 'complex', hold: 'complex', breakFree: 'complex', suppress: 'complex',
      // v0.59.0: jacking in or out, taking the controls, jumping in or out, a sensor test, a command to drones. VERIFY
      jackIn: 'simple', jackOut: 'simple', takeControls: 'simple', jumpIn: 'simple', jumpOut: 'simple', sensor: 'simple', droneCommand: 'complex' /* v0.77.0 book check: a Complex Action (was simple) */,
      // v0.71.0 (R19): switching to astral perception, or leaving the body to project (RULES.FIXES_V71.astralSwitchCost). VERIFY
      astralPerceive: 'simple', astralProject: 'complex',
    } as Record<string, 'free' | 'simple' | 'complex'>,
  },

  /**
   * Vehicles (v0.24.0). All VERIFY, from memory of SR2 and its rigger rules. Least certain: the
   * terrain and maneuver modifiers, normal weapons against vehicles, and crash damage.
   * - `categories`: the vehicle kinds and the skill each one uses by default.
   * - `damageTnMods`: vehicle damage adds to its tests like wound modifiers (same thresholds).
   * - `defaultAttribute`: vehicle skills default to Reaction (+ ATTRIBUTE_DEFAULT_TN_MOD).
   * - Driving test: skill (+ Control Pool when jumped in) vs Handling (off-road Handling when
   *   off-road) + terrain + maneuver modifiers + vehicle damage + the driver's own penalties.
   * - `damage`: Power at or below the vehicle's Armor does nothing (`armorStops`); otherwise the
   *   vehicle resists with Body vs Power − Armor. Weapons not marked anti-vehicle have their
   *   Power multiplied and their damage level lowered (`normalWeapons`).
   * - `crash`: Power = current speed ÷ `speedPerPower` (rounded down, at least `minPower`); the
   *   vehicle takes it at `vehicleLevel` (its armor counts if `vehicleArmor`), everyone aboard at
   *   `passengerLevel` against their impact armor.
   * - `autopilot`: a vehicle nobody drives uses its Autonav (drones: Pilot) as dice; its Reaction
   *   is the rating × `reactionPerRating`, with `initiativeDice` d6.
   */
  VEHICLES: {
    categories: [
      { id: 'car', label: 'Car', skill: 'Car' },
      { id: 'bike', label: 'Bike', skill: 'Bike' },
      { id: 'truck', label: 'Truck', skill: 'Car' },
      { id: 'hovercraft', label: 'Hovercraft', skill: 'Hovercraft' },
      { id: 'boat', label: 'Boat', skill: 'Motorboat' },
      { id: 'ship', label: 'Ship', skill: 'Ship' },
      { id: 'rotor', label: 'Rotorcraft', skill: 'Rotor Aircraft' },
      { id: 'fixedWing', label: 'Fixed-wing aircraft', skill: 'Fixed-Wing Aircraft' },
      { id: 'vectorThrust', label: 'Vectored thrust', skill: 'Vector Thrust Aircraft' },
      { id: 'lta', label: 'Lighter than air', skill: 'LTA Aircraft' },
      { id: 'other', label: 'Other', skill: '' },
    ] as ReadonlyArray<{ id: string; label: string; skill: string }>,
    conditionBoxes: 10,
    damageTnMods: true,
    defaultAttribute: 'reaction' as 'reaction' | 'quickness' | 'intelligence',
    terrain: [
      { id: 'open', label: 'Open terrain', value: -1 },
      { id: 'normal', label: 'Normal terrain', value: 0 },
      { id: 'restricted', label: 'Restricted terrain', value: 1 },
      { id: 'tight', label: 'Tight terrain', value: 3 },
    ] as ReadonlyArray<{ id: string; label: string; value: number }>,
    /** Situational driving modifiers, picked in the Driving test dialog. Add rows freely. */
    drivingModifiers: [
      { id: 'easy', label: 'Easy maneuver', value: -1 },
      { id: 'hard', label: 'Hard maneuver', value: 2 },
      // v0.79.0 docs check: +1 over the Speed rating (was +2). Rigger 2 Positioning / Accelerate-Brake / Ramming tables.
      { id: 'overSpeed', label: 'Above the vehicle\'s Speed', value: 1 },
      { id: 'unfamiliar', label: 'Unfamiliar vehicle', value: 1 },
      { id: 'poorVisibility', label: 'Poor visibility', value: 2 },
    ] as ReadonlyArray<{ id: string; label: string; value: number }>,
    damage: { armorStops: true, normalWeapons: { powerMultiplier: 0.5, levelDrop: 1 } },
    crash: { speedPerPower: 10, minPower: 2, vehicleLevel: 'S' as 'L' | 'M' | 'S' | 'D', passengerLevel: 'M' as 'L' | 'M' | 'S' | 'D', vehicleArmor: false },
    autopilot: { reactionPerRating: 2, initiativeDice: 1 },
    /**
     * Vehicle combat (v0.25.0). All VERIFY.
     * - Mounted weapons (`mount` fixed / turret / pintle) are fired with `gunnerySkill` unless the
     *   weapon names a skill; fixed and turret mounts ignore recoil (`mountedIgnoreRecoil`).
     *   Fixed mounts: only the driver or the autopilot fires them; turret: also a gunner aboard;
     *   pintle: only a gunner aboard. The driver jumped in uses the Control Pool, anyone else the
     *   Combat Pool, the autopilot no pool.
     * - `firing`: TN for firing from a moving vehicle (`moving` at any speed, `fast` above half its
     *   Speed instead), at a target in a moving vehicle (`targetMoving`), plus the firing vehicle's
     *   damage modifier on mounted weapons.
     * - `sensorLock`: a vehicle holding a sensor lock on the target gets this TN (sensor-enhanced
     *   gunnery) with its mounted weapons.
     * - `passengers`: when a vehicle is damaged by an attack, everyone aboard takes Power − the
     *   vehicle's Armor at the damage level the vehicle took, lowered by `levelDrop` (impact armor).
     * - `ram`: a ramming attack is a driving test vs Handling + `tn`; Power = the rammer's Body +
     *   current speed ÷ `speedPerPower`, at `level` (`fastLevel` above half its Speed); it counts as
     *   anti-vehicle. The rammer takes `selfFraction` of the Power a level lower.
     */
    gunnerySkill: 'Gunnery',
    mountedIgnoreRecoil: true,
    // v0.79.0 docs check: + the ring mount (6 points of recoil compensation, a gunner only; RULES.DOCS_V79.vehMountRecoil). Rigger 2 p131.
    mounts: ['none', 'fixed', 'turret', 'pintle', 'ring'] as ReadonlyArray<'none' | 'fixed' | 'turret' | 'pintle' | 'ring'>,
    firing: { moving: 1, fast: 2, targetMoving: 1 },
    sensorLock: { tn: -2 },
    passengers: { enabled: true, levelDrop: 1 },
    ram: { tn: 0, speedPerPower: 10, level: 'M' as 'L' | 'M' | 'S' | 'D', fastLevel: 'S' as 'L' | 'M' | 'S' | 'D', selfFraction: 0.5 },
    /**
     * Sensors and electronic warfare (v0.25.0). All VERIFY.
     * - Sensor test: the vehicle's Sensor rating as dice (+ Control Pool when its rigger is jumped
     *   in) vs TN = the target's Signature (characters: `personSignature`) + the target's ECM above
     *   the scanner's ECCM. Any success = detected, and a sensor lock for gunnery.
     * - ECD: a target with ECD rolls its rating vs `ecdTn`; a success means it notices the scan.
     */
    sensors: { personSignature: 6, ecdTn: 4, controlPool: true },
    /**
     * Chases (v0.25.0). All VERIFY. Each chase turn the gap changes by (quarry's current speed −
     * pursuer's) × `metresPerSpeed`, then both drivers make a positioning test (driving test);
     * the vehicle with more current speed gets `speedTnPerStep` per full `speedStep` of advantage
     * (at most `maxSpeedTn`); each net success moves the gap `metresPerNet` in the winner's favour.
     */
    chase: { metresPerSpeed: 1, speedStep: 20, speedTnPerStep: -1, maxSpeedTn: -3, metresPerNet: 5, moveTokens: true },

    // ---- v0.46.0. All VERIFY, from memory of SR2 and the Rigger rules. ----

    /**
     * Sensor modes: a vehicle's sensors run active (full effect; a target with ECD may notice) or
     * passive (+`passiveTn` to sensor tests, and ECD never notices when `passiveHidden`).
     */
    sensorModes: { passiveTn: 2, passiveHidden: true },
    /**
     * Firing arcs: a fixed mount can name the side it faces (front, rear, left, right; '' = any).
     * The target must be within `degrees` ÷ 2 of that side, measured from the vehicle token's
     * rotation (`facingOffset` degrees is added to the rotation for tokens whose art faces another
     * way; 0 = the art's top is the front). `enforce`: 'warn' or 'block' (the dialog can override).
     */
    arcs: { degrees: 90, facingOffset: 0, enforce: 'warn' as 'off' | 'warn' | 'block' },
    /**
     * Turrets (v0.49.0, VERIFY): a turret faces somewhere (relative to the vehicle's front), turns at
     * most `traverse` degrees per shot (a weapon's own Traverse overrides it) and only within its
     * Limit (its own, else `limit` degrees centred on the front; 360 = all round). Further than the
     * traverse: +`tnPerStep` TN per traverse step needed beyond the first ('tn'), refused ('block'),
     * or a note ('off'). Firing turns the turret to the target.
     */
    turrets: { traverse: 90, limit: 360, overTraverse: 'tn' as 'tn' | 'block' | 'off', tnPerStep: 2, enforceLimit: 'warn' as 'off' | 'warn' | 'block' },
    /**
     * Cargo and load: a vehicle's Load (kg, 0 = not tracked) against the weight of the items it
     * carries plus `personKg` per person aboard. Overloaded: +`overloadTn` on its driving tests.
     */
    /**
     * v0.49.0: cargo by volume too: a vehicle's Cargo Factor (CF, 0 = not tracked) against its items'
     * CF plus `personCf` per person aboard. Over either limit is overloaded.
     */
    cargo: { personKg: 100, overloadTn: 2, personCf: 4 },
    /**
     * Drone autosofts (Rigger rules): rating dice added to the vehicle's own tests when its
     * autopilot rolls (maneuver: driving tests; targeting: its mounted weapons; clearsight: sensor
     * tests), each capped at its Pilot (or Autonav) rating when `capAtPilot`.
     */
    autosofts: { kinds: ['maneuver', 'targeting', 'clearsight'] as ReadonlyArray<'maneuver' | 'targeting' | 'clearsight'>, capAtPilot: true },
    /**
     * Vehicle modifications: installing one changes a stat by `perRating` × its rating (a Handling
     * upgrade lowers Handling, the TN) and costs `cost` × rating nuyen (× the vehicle's Body too when
     * `perBody`), paid by whoever installs it; taking it out reverses the stat change. 'adaptation'
     * is rigger adaptation (needed to jump in only when RULES.RIGGING.needsAdaptation). Add rows freely.
     */
    modifications: [
      { id: 'armor', label: 'Extra armor', stat: 'armor', perRating: 1, cost: 1000, perBody: true },
      { id: 'engine', label: 'Engine customization', stat: 'speed', perRating: 10, cost: 2000, perBody: false },
      { id: 'handling', label: 'Handling upgrade', stat: 'handling', perRating: -1, cost: 5000, perBody: false },
      { id: 'signature', label: 'Signature masking', stat: 'signature', perRating: 1, cost: 3000, perBody: true },
      { id: 'sensor', label: 'Sensor upgrade', stat: 'sensor', perRating: 1, cost: 2500, perBody: false },
      { id: 'ecm', label: 'ECM suite', stat: 'ecm', perRating: 1, cost: 4000, perBody: false },
      { id: 'eccm', label: 'ECCM suite', stat: 'eccm', perRating: 1, cost: 4000, perBody: false },
      { id: 'ecd', label: 'ECD suite', stat: 'ecd', perRating: 1, cost: 3000, perBody: false },
      { id: 'autonav', label: 'Autonav upgrade', stat: 'autonav', perRating: 1, cost: 1500, perBody: false },
      { id: 'pilot', label: 'Pilot upgrade', stat: 'pilot', perRating: 1, cost: 2000, perBody: false },
      // v0.78.0 (RULES.BOOK_V78.adaptation 'text', the notes' text): remote adaptation 2,500¥ × Body; rigger adaptation
      // 2,800¥ on top of it (RULES.BOOK_V78.riggerAdaptationCost; needs the remote adaptation). 'single': the old one row.
      { id: 'remote', label: 'Remote adaptation', stat: '', perRating: 0, cost: 2500, perBody: true },
      { id: 'adaptation', label: 'Rigger adaptation', stat: '', perRating: 0, cost: 2500, perBody: true },
      { id: 'other', label: 'Other', stat: '', perRating: 0, cost: 0, perBody: false },
    ] as ReadonlyArray<{ id: string; label: string; stat: string; perRating: number; cost: number; perBody: boolean }>,
    /**
     * Installing a modification with a test (v0.49.0, VERIFY): the mechanic's first skill of
     * RULES.SKILLS.vehicleRepair (else Intelligence +4) vs `tn` + `tnPerRating` × the mod's rating;
     * the work takes rating × `hoursPerRating` hours ÷ successes. No successes: nothing goes in (the
     * parts are paid only on success); all ones (a disaster) also costs `botchBoxes` boxes of damage.
     * `required` off keeps v0.46.0's plain Install button as well.
     */
    install: { tn: 4, tnPerRating: 1, hoursPerRating: 4, botchBoxes: 1, required: false },
  },

  /**
   * Rigging (v0.24.0). All VERIFY, from memory. Least certain: the control rig's TN bonus, the
   * Control Pool's source, feedback and dump shock values.
   * - A vehicle control rig (cyberware "Control rig" rating, up to `maxVcr`) lets a character jump
   *   into a vehicle (`jumpInNeedsVcr`). Jumped in, their Reaction is natural Reaction +
   *   `vcr.reactionPerLevel` per level and they roll 1 + `vcr.initiativeDicePerLevel` per level
   *   initiative dice; other cyberware reflexes do not count (`cyberReflexesWhileRigging`).
   *   Vehicle tests jumped in get `vcr.tnPerLevel` per level.
   * - Control Pool = the rigged Reaction ('rigReaction') or the ordinary Reaction ('reaction'),
   *   usable only while jumped in (`controlPool.onlyJumpedIn`); it refreshes each Combat Turn.
   * - `feedback`: damage to a vehicle a rigger is jumped into comes back as Stun: the rigger resists
   *   with Willpower vs TN = the attack's Power ('power') or a fixed number, at the level the
   *   vehicle took.
   * - `dumpShock`: a rigger jumped into a vehicle that is destroyed is dumped: Willpower vs `tn`,
   *   `level` Stun, staged down by successes.
   */
  RIGGING: {
    maxVcr: 3,
    vcr: { reactionPerLevel: 2, initiativeDicePerLevel: 1, tnPerLevel: -1 },
    cyberReflexesWhileRigging: false,
    jumpInNeedsVcr: true,
    controlPool: { from: 'rigReaction' as 'rigReaction' | 'reaction', onlyJumpedIn: true },
    feedback: { enabled: true, tnFrom: 'power' as 'power' | 'fixed', fixedTn: 4, type: 'stun' as 'stun' | 'physical' },
    dumpShock: { tn: 6, level: 'M' as 'L' | 'M' | 'S' | 'D', type: 'stun' as 'stun' | 'physical' },
    /**
     * Remote control decks (v0.25.0). VERIFY. Jumping into a vehicle the rigger is not aboard
     * needs a remote control deck (gear with an RCD rating; `needsRcd`), and adds `tnMod`. The
     * deck holds rating × `dronesPerRating` subscribed drones, which can be sent group commands
     * (each drone acts on its own autopilot).
     */
    remote: { needsRcd: true, tnMod: 0, dronesPerRating: 1 }, // v0.77.0 book check: one slave port per rating point (was 2)
    /**
     * v0.46.0, VERIFY. A remote control deck's signal (gear `signal`; 0 = its RCD rating) reaches
     * RULES.SIGNAL.rangeKm; the rigger's and drone's tokens are measured when both are on the
     * scene. Jamming (`jamming`): a jammer (a vehicle's ECM, or gear with a jammer rating) rolls
     * its rating vs TN = the link's signal (+ the drone's ECCM when `eccmAddsTn`); any success
     * jams the drone: the remote link is cut (a jumped-in rigger is pushed out; dump shock only
     * when `dumpShock`), and remote control and group commands are refused until it is cleared.
     * `needsAdaptation`: jumping in needs a vehicle with the rigger adaptation modification (drones are built
     * for it). v0.71.0 (R17): on by default (SR2 rigging); switch it off for the old way.
     */
    jamming: {
      // v0.79.0 docs check: an electronic-warfare attack that cuts a remote rigger's link dumps them (Rigger 2 p64). (was false)
      eccmAddsTn: true, dumpShock: true,
      /**
       * v0.49.0: jamming a decker on a wireless connection (cellular, relay…): the jammer's rating vs
       * the deck's signal. Jammed, the decker is dumped (`onDecker: 'dump'`, with dump shock) or can't
       * act in the Matrix (`'block'`) until the jam clears; either way they can't jack in again.
       */
      onDecker: 'dump' as 'dump' | 'block',
    },
    needsAdaptation: true,
  },

  /**
   * Building security and security rigging (v0.26.0). All VERIFY, from memory of SR2 and its rigger
   * rules; the detection test, lock bypassing and response times are the least certain.
   * - A site (security network) holds devices: cameras, sensors, maglocks, doors, alarms. A device can
   *   be tied to a token (where it sees from) and a door wall (what it locks).
   * - Detection (`detection`): opposed. The device rolls its rating (+ the security rigger's Control
   *   Pool) vs TN = the intruder's Stealth rating (at least `minTn`); the intruder rolls Stealth
   *   (`skill`, defaulting to `attribute` at +4) vs TN = the device's rating. More device successes =
   *   detected: net successes × `tallyPerNet` go on the site's security tally, and the alert rises to
   *   at least `detectedAlert`. Devices in `needsSight` need line of sight from their token.
   * - Bypassing a maglock (`bypass`): Electronics (Intelligence at +4) vs TN = the lock's rating. A
   *   success opens it (and unlocks its door wall); no successes add `failTally` to the tally; a
   *   disaster raises the alert to `disasterAlert`.
   * - Alerts rise only: none → passive → active → lockdown. At active or above, the response arrives
   *   after `response.turns` Combat Turns (or `response.minutes` of world time outside combat).
   *   Lockdown locks every linked door that has not been bypassed (`lockdownLocksDoors`).
   * - A security rigger (control rig needed, `riggerNeedsVcr`) jumps into the site: rigged initiative
   *   and Control Pool, and fires its slaved turrets and drones with Gunnery + Control Pool.
   * - A linked Matrix host and the site raise each other's alerts (`hostAlert`: site → host level).
   */
  SECURITY: {
    deviceKinds: ['camera', 'sensor', 'maglock', 'door', 'alarm', 'scanner', 'gas', 'other'] as ReadonlyArray<string>,
    alerts: ['none', 'passive', 'active', 'lockdown'] as ReadonlyArray<'none' | 'passive' | 'active' | 'lockdown'>,
    detection: { skill: 'Stealth', attribute: 'quickness' as 'quickness' | 'intelligence', minTn: 2, tallyPerNet: 1, detectedAlert: 'active' as '' | 'passive' | 'active' | 'lockdown', needsSight: ['camera'] as ReadonlyArray<string> },
    bypass: { skill: 'Electronics', attribute: 'intelligence' as 'intelligence' | 'quickness', failTally: 2, disasterAlert: 'active' as '' | 'passive' | 'active' | 'lockdown', unlocksDoor: true },
    response: { turns: 3, minutes: 5 },
    lockdownLocksDoors: true,
    riggerNeedsVcr: true,
    // v0.70.0: a lockdown raises a linked host to active, not shutdown (which dumped the decker), and a host shutdown no
    // longer locks the building down (which released its gas). Put 'shutdown' back to link them as before. VERIFY
    hostAlert: { none: 'none', passive: 'passive', active: 'active', lockdown: 'active' } as Record<string, string>,

    // ---- v0.46.0. All VERIFY, from memory of SR2 and its sourcebooks. ----

    /**
     * What a device senses with ('' = not set: concealment is ignored), and how concealment on an
     * intruder works against it (`concealment[sense][kind]`): 'blind' = the device cannot detect
     * them at all; a number = + that × the concealment's rating to the device's TN; 0 = no effect.
     * Concealment kinds: invisibility (a mana illusion: fools only living minds), improved
     * invisibility (physical: fools cameras), chameleon suits (ruthenium polymers) and thermal
     * masking. Its rating is the spell's successes or the suit's rating.
     */
    senses: ['', 'visual', 'lowLight', 'thermal', 'ultrasound', 'motion', 'pressure', 'acoustic'] as ReadonlyArray<string>,
    concealmentKinds: ['', 'invisibility', 'improvedInvisibility', 'chameleon', 'thermal', 'silence', 'mask', 'physicalMask'] as ReadonlyArray<string>,
    concealment: {
      visual: { invisibility: 0, improvedInvisibility: 'blind', chameleon: 1, thermal: 0, silence: 0 },
      lowLight: { invisibility: 0, improvedInvisibility: 'blind', chameleon: 1, thermal: 0, silence: 0 },
      thermal: { invisibility: 0, improvedInvisibility: 'blind', chameleon: 0, thermal: 1, silence: 0 },
      ultrasound: { invisibility: 0, improvedInvisibility: 0, chameleon: 0, thermal: 0, silence: 0 },
      motion: { invisibility: 0, improvedInvisibility: 0, chameleon: 0, thermal: 0, silence: 0 },
      pressure: { invisibility: 0, improvedInvisibility: 0, chameleon: 0, thermal: 0, silence: 0 },
      acoustic: { invisibility: 0, improvedInvisibility: 0, chameleon: 0, thermal: 0, silence: 'blind' },
    } as Record<string, Record<string, number | 'blind'>>,
    /**
     * Tamper alarms: a device with a tamper rating checks every successful bypass: it rolls its
     * rating vs TN = the bypasser's skill rating (`tnFrom: 'skill'`, at least 2) or `fixedTn`; as
     * many successes as the bypass's (or more) trips it: + `tally` and the alert to `alert`.
     */
    tamper: {
      tnFrom: 'skill' as 'skill' | 'fixed', fixedTn: 4, tally: 3, alert: 'active' as '' | 'passive' | 'active' | 'lockdown',
      /**
       * v0.49.0: tamper alarms also trip, with no roll, when the device's door is forced (its wall
       * damaged or breached: `onBreach`) or the device is smashed or cut out (`onForce`). Smashing a
       * device with no tamper alarm still shows on the board as a dead device: + `deadTally` tally.
       */
      onBreach: true, onForce: true, deadTally: 1,
    },
    /**
     * v0.49.0: the site's guards (NPC actors) look for intruders: each intruder sneaks past all the
     * guards at once (Stealth vs their Perception); every guard who notices adds `tallyPerGuard` to
     * the tally and raises the alert to at least `alert`.
     */
    guards: { tallyPerGuard: 2, alert: 'active' as '' | 'passive' | 'active' | 'lockdown' },
    /**
     * v0.49.0: masking spells against sensors. A device that identifies people (a face or ID check)
     * is fooled by a physical mask: + `identity.physicalMask` × its rating to its TN; a mana mask
     * fools only living minds (`identity.mask`, 0). Silence (a physical spell) leaves acoustic
     * sensors nothing to pick up.
     */
    identity: { mask: 0, physicalMask: 1 } as Record<string, number>,
    /** Time to bypass: base Combat Turns by device kind ÷ successes, rounded up (shown on the card). */
    bypassTime: { baseTurns: { maglock: 20 /* v0.77.0 book check: the circuit 60 s (was 10) */, casing: 20 /* v0.77.0: opening a casing, 60 s (the casing step) */, door: 10, alarm: 6, camera: 6, sensor: 6, scanner: 6, other: 10 } as Record<string, number>, secondsPerTurn: 3 },
  },

  /** Initiative ties: higher Reaction first, then Quickness, then the dice rolled. VERIFY */
  INITIATIVE_TIES: ['reaction', 'quickness'] as ReadonlyArray<'reaction' | 'quickness' | 'intelligence'>,

  /**
   * Surprise (v0.22.0): every combatant rolls `attribute` vs `tn`; anyone with fewer successes
   * than the best on the opposing side (token disposition) is surprised and loses the first
   * initiative pass. VERIFY
   */
  SURPRISE: { attribute: 'reaction' as 'reaction' | 'intelligence', tn: 4, losesPasses: 1 },

  /** Initiative: points subtracted per pass; a character acts on every pass where their score is still > 0. */
  INITIATIVE_PASS_DECREMENT: 10,
  /**
   * v0.54.0: wounds lower Initiative by the wound modifier (Light −1, Moderate −2, Serious −3), on the
   * roll and at once when a wound is taken mid-turn (`midTurn`; healing never raises it). VERIFY
   */
  INITIATIVE_WOUNDS: { enabled: true, midTurn: true },
  /** Base initiative dice (1d6 before cyberware/magic). */
  BASE_INITIATIVE_DICE: 1,
  /**
   * v0.59.0: seconds of world time in a Combat Turn (SR2: a Combat Turn is 3 seconds). Foundry's
   * `CONFIG.time.roundTime` is set from this, so a new Combat Turn moves the clock and the timers
   * (spells, drugs, traces) count in the same seconds in and out of combat.
   */
  COMBAT_TURN_SECONDS: 3,

  /**
   * v0.50.0: target-number automation. Modifiers the system now reads from the canvas, the scene and
   * the actors by itself, with nothing to tick or type. All values VERIFY (from memory of SR2, or
   * house rules where SR2 is silent); switch any part off here.
   */
  TN_AUTO: {
    perception: {
      /** Light at the observed token, by the observer's best vision (the attack visibility table). */
      light: true,
      /** Distance between the tokens: the first band whose `upTo` (metres) covers it. Replaces "Within a few metres". */
      range: [
        { upTo: 2, value: -1, label: 'Within 2 m' },
        { upTo: 20, value: 0, label: '' },
        { upTo: 100, value: 1, label: 'Over 20 m' },
        { upTo: Infinity, value: 2, label: 'Over 100 m' },
      ] as ReadonlyArray<{ upTo: number; value: number; label: string }>,
      /**
       * Walls block every sight line, or the target can't be seen (blinded observer, improved
       * invisibility): 'hearing' = only by ear, at + `hearingTn`; 'block' = not noticed at all
       * (no roll); 'ignore' = roll as if seen.
       */
      noSight: 'hearing' as 'hearing' | 'block' | 'ignore',
      hearingTn: 4,
      /** A sneaker who moved this Combat Turn (token movement, in a started combat): + TN to their Stealth. */
      sneakerMoving: { walking: 0, running: 4 },
      /** Concealment worn or sustained on the observed person, against living eyes ('blind' = unseen; a number × the rating). */
      living: {
        visual: { invisibility: 'blind', improvedInvisibility: 'blind', chameleon: 1, thermal: 0 },
        lowLight: { invisibility: 'blind', improvedInvisibility: 'blind', chameleon: 1, thermal: 0 },
        thermal: { invisibility: 'blind', improvedInvisibility: 'blind', chameleon: 0, thermal: 1 },
      } as Record<string, Record<string, number | 'blind'>>,
      /** Weather is no part of a hands-on search (frisking). */
      friskWeather: false,
    },
    attack: {
      /** The target's concealment against the attacker's eyes (as perception's `living` table): 'blind' = blind fire. */
      concealment: true,
      /** Blinded attacker and blind fire don't add up: the worse one counts; light and weather drop out when blind. */
      blindNotStacked: true,
      /** Walking/running are auto-ticked for melee attacks as well as ranged ones (Charging is ticked either way). */
      movementInMelee: false,
      /** The defender in opposed melee: Blinded, light on the attacker and the attacker's concealment count (by the defender's eyes). */
      meleeDefenseSight: true,
    },
    social: {
      /** Pre-pick the target's attitude from a stored attitude, else its token disposition. */
      attitudeFromToken: true,
      disposition: { '-1': 'suspicious', '0': 'neutral', '1': 'friendly', '-2': 'neutral' } as Record<string, string>,
      /**
       * Metatype prejudice, added by itself (instead of picking "Prejudiced"): +value when the speaker
       * is `from` and the listener `to` (either way round). Empty = off.
       */
      prejudice: [
        { a: 'human', b: 'ork', value: 2 }, { a: 'human', b: 'troll', value: 2 },
        { a: 'elf', b: 'ork', value: 2 }, { a: 'elf', b: 'troll', value: 2 }, { a: 'elf', b: 'dwarf', value: 1 },
      ] as ReadonlyArray<{ a: string; b: string; value: number }>,
      /** The listener's side of an opposed social test gets its full own penalties (wounds, sustaining, drugs…), not wounds only. */
      defenderFullPenalties: true,
      /** Haggling, fencing and finding gear count Street Cred like other social tests. */
      credOnDeals: true,
    },
    magic: {
      /**
       * Light, smoke and weather on spellcasting: 'off' (the caster only needs to see the target),
       * 'elemental' (elemental manipulations, which work like ranged attacks) or 'all'. VERIFY.
       */
      environment: 'elemental' as 'off' | 'elemental' | 'all',
      /** No line of sight from the caster's token to a target: 'warn' or 'block' (casting, powers, banishing). */
      lineOfSight: 'warn' as 'warn' | 'block',
      /** Critter powers count the background count like spells. */
      powersBackground: true,
      /** Background count from the scene the actor's token is on (else the viewed scene). */
      tokenScene: true,
    },
    matrix: {
      /** Blinded and astral perception (meat-body statuses) don't touch a jacked-in decker's Matrix tests. */
      skipBodyStatuses: true,
      /** The host's detection roll is hampered by Smoke in the host like every other test there. */
      smokeOnDetection: true,
      /** IC, frames and agents roll free of their token's statuses. */
      icNoPenalties: true,
    },
    rigging: {
      /** A jumped-in rigger sees through the vehicle's sensors: no Blinded or astral-perception penalty from the body. */
      skipBodyStatuses: true,
      /** Poor visibility on driving tests, by itself, when the light at the vehicle gives at least this visibility TN. */
      poorVisibilityFrom: 4,
      /** Smoke at the vehicle also makes poor visibility. */
      smokeIsPoorVisibility: true,
      /** Over the vehicle's Speed: read from its current speed in every driving test (chases, rams, group drives). */
      overSpeedAuto: true,
      /** Sensor tests: the rigger's own penalties and the vehicle's damage apply. */
      sensorPenalties: true,
      /** Sensor tests against a far target: + per range band beyond short (bands from the vehicle's Sensor rating × these metres). */
      sensorRange: { metresPerRating: [100, 250, 500, 1000] as ReadonlyArray<number>, tnPerBand: 1 },
    },
  },

  /**
   * GM tools (v0.51.0): the GM panel's time steps, undo log, recent rolls and calculator. Not rules
   * from the book: table conveniences.
   */
  GM_TOOLS: {
    /** World-time buttons (seconds). A month and a year are the GM's calendar: change the days here. */
    monthDays: 30,
    yearDays: 365,
    /** Ask before a step of at least this many seconds (0 = never ask). Default: a week. */
    confirmFrom: 604800,
    undo: {
      /** Changes by one user within this many milliseconds of each other make one undo step. */
      windowMs: 1500,
      /** Steps kept (oldest dropped first). */
      maxSteps: 50,
      /** Changes kept in one step; a bigger step is marked partly undoable. */
      maxEntries: 300,
      /** A plain chat message (no system flags, no dice) that starts a step is not logged. */
      skipPlainChat: true,
      /** Token updates that only move or turn a token are not logged (Foundry's own Ctrl+Z undoes moves). */
      skipTokenMoves: true,
    },
    /** Recent rolls listed in the panel's Log tab. */
    recentRolls: 15,
  },

  /**
   * NPC generator (v0.52.0): a table convenience, not book data. Threat Level 0 (no threat) to 5
   * (very, very threatening) sets each generated person's attributes, skills, gear, cyberware,
   * magic and the size of groups. Attributes are before racial modifiers (the sheet adds those).
   * Every number is a design choice for the generator; change them in the house rules.
   */
  NPCGEN: {
    threat: [
      { label: 'No threat', attribute: 2, skill: 1, professionalRating: 0, karmaPool: 0, gear: 0, cyber: 0, magicChance: 0.02, group: 2, nuyen: 20, magic: 2, spells: 1, force: 2 },
      { label: 'Minor', attribute: 3, skill: 2, professionalRating: 1, karmaPool: 0, gear: 1, cyber: 0, magicChance: 0.05, group: 3, nuyen: 150, magic: 3, spells: 2, force: 3 },
      { label: 'Capable', attribute: 3, skill: 3, professionalRating: 2, karmaPool: 1, gear: 2, cyber: 1, magicChance: 0.08, group: 4, nuyen: 600, magic: 4, spells: 3, force: 4 },
      { label: 'Dangerous', attribute: 4, skill: 4, professionalRating: 3, karmaPool: 2, gear: 3, cyber: 2, magicChance: 0.12, group: 4, nuyen: 2000, magic: 4, spells: 4, force: 4 },
      { label: 'Very dangerous', attribute: 5, skill: 5, professionalRating: 4, karmaPool: 3, gear: 4, cyber: 3, magicChance: 0.16, group: 5, nuyen: 6000, magic: 5, spells: 5, force: 5 },
      { label: 'Very, very threatening', attribute: 6, skill: 6, professionalRating: 5, karmaPool: 5, gear: 5, cyber: 4, magicChance: 0.2, group: 6, nuyen: 15000, magic: 6, spells: 6, force: 6 },
    ] as ReadonlyArray<{ label: string; attribute: number; skill: number; professionalRating: number; karmaPool: number; gear: number; cyber: number; magicChance: number; group: number; nuyen: number; magic: number; spells: number; force: number }>,
    /** Rolled attributes and skills vary by up to this much either way. */
    spread: 1,
    /** Highest rolled attribute (before racial modifiers) and skill. */
    maxAttribute: 6,
    maxSkill: 8,
    /** How often each metatype is rolled (weights). */
    metatypes: { human: 60, elf: 12, dwarf: 10, ork: 12, troll: 6 } as Record<string, number>,
    /** Group sizes: Threat Level's `group` + this much extra at most (rolled), by kind. */
    groupExtra: { gang: 4, security: 2, squad: 2, police: 1, bodyguards: 1 } as Record<string, number>,
    /** Pay per runner for a job, low to high, by Threat Level (nuyen). */
    jobPay: [[300, 1000], [1000, 3000], [3000, 8000], [8000, 15000], [15000, 30000], [30000, 75000]] as ReadonlyArray<readonly [number, number]>,
    /** Spirit Force by Threat Level. */
    spiritForce: [1, 2, 3, 4, 5, 6] as ReadonlyArray<number>,
    /** Contact level (1–3) by Threat Level. */
    contactLevel: [1, 1, 2, 2, 3, 3] as ReadonlyArray<number>,
    /** Matrix security code for an organisation's host by Threat Level, and its Security Value. */
    hostCode: ['blue', 'green', 'green', 'orange', 'orange', 'red'] as ReadonlyArray<string>,
    hostValue: [3, 4, 5, 6, 7, 8] as ReadonlyArray<number>,
  },

  /**
   * Item templates (v0.41.0): generic starting points the item sheet's Template menu fills in.
   * v0.49.0: list prices (nuyen, from memory, VERIFY) for the builder's gear list.
   * Generic classes only (no named products); every number is from memory of SR2. VERIFY. The GM
   * can save any item as a world template too (they are listed first). Change these through the
   * house rules' Advanced box, e.g. {"ITEM_TEMPLATES": [...]}.
   */
  /**
   * Safehouse construction (v0.53.0). Nothing here is book data: SR2 has lifestyles but no safehouse
   * construction rules, so every cost, upkeep, space and effect is a table convenience (VERIFY /
   * house rules). A safehouse is a location and a size plus any options; `rules/safehouse.ts` adds
   * them up. Effects per option (× its rating when `perRating`):
   *   security: the summary security score; concealment: + to a searcher's TN; comfort: lifestyle
   *   steps above the size's base (capped by the location); barrier: + to the walls' Barrier Rating;
   *   ward: a ward of that Force; medical: TN modifier for natural healing at home (negative helps);
   *   workshop: TN modifier for Build/Repair tests there (shown, not applied); garage: vehicle
   *   bays; supplies: weeks of food and water; device: a security device for the site actor;
   *   magicSite: a library, circle or lodge of that rating; host: a home host of that Security Value.
   */
  SAFEHOUSE: {
    /** Upkeep is paid monthly (RULES.UPKEEP.monthDays). Overdue past `graceDays`: comfort falls to `overdueComfort`. */
    graceDays: 7,
    overdueComfort: 'squatter',
    /** The most the security score and concealment (either way) can add up to. */
    caps: { security: 12, concealment: 8 },
    /** Searching for it: the searcher's dice vs `baseTn` + concealment; `successes` needed to find it; `days` base time ÷ successes. */
    search: { baseTn: 4, minTn: 2, successes: 1, days: 7, skillHint: 'Etiquette (Street), or Intelligence for legwork' },
    /** Home care: the safehouse's comfort is used when it is better than the resident's own lifestyle. */
    homeCare: true,
    locations: [
      { id: 'barrens', label: 'Abandoned zone', costMult: 0.3, upkeepMult: 0.4, concealment: 2, security: -1, comfortCap: 'low', response: 'none' },
      { id: 'squat', label: 'Condemned or squatted block', costMult: 0.2, upkeepMult: 0.2, concealment: 1, security: -1, comfortCap: 'squatter', response: 'none' },
      { id: 'lowRent', label: 'Low-rent district (C)', costMult: 0.7, upkeepMult: 0.8, concealment: 1, security: 0, comfortCap: 'middle', response: '30+ min' },
      { id: 'industrial', label: 'Industrial zone', costMult: 0.8, upkeepMult: 0.9, concealment: 1, security: 0, comfortCap: 'middle', response: '20 min' },
      { id: 'residential', label: 'Residential suburb (B)', costMult: 1, upkeepMult: 1, concealment: 0, security: 1, comfortCap: 'high', response: '10 min' },
      { id: 'upscale', label: 'Upscale district (A)', costMult: 1.8, upkeepMult: 1.6, concealment: -1, security: 2, comfortCap: 'luxury', response: '5 min' },
      { id: 'corporate', label: 'Corporate enclave (AA/AAA)', costMult: 3, upkeepMult: 2.5, concealment: -2, security: 3, comfortCap: 'luxury', response: '2 min' },
      { id: 'rural', label: 'Rural / wilderness', costMult: 0.6, upkeepMult: 0.6, concealment: 2, security: -1, comfortCap: 'high', response: '1 h+' },
      { id: 'underground', label: 'Undercity / sewers / tunnels', costMult: 0.5, upkeepMult: 0.5, concealment: 3, security: 0, comfortCap: 'low', response: 'none' },
    ] as ReadonlyArray<{ id: string; label: string; costMult: number; upkeepMult: number; concealment: number; security: number; comfortCap: string; response: string }>,
    sizes: [
      { id: 'coffin', label: 'Coffin motel / locker', cost: 500, upkeep: 100, space: 1, comfort: 'squatter', barrier: 4, residents: 1 },
      { id: 'room', label: 'Single room', cost: 3000, upkeep: 300, space: 3, comfort: 'squatter', barrier: 6, residents: 2 },
      { id: 'apartment', label: 'Apartment', cost: 15000, upkeep: 1000, space: 6, comfort: 'low', barrier: 8, residents: 4 },
      { id: 'house', label: 'House', cost: 60000, upkeep: 2500, space: 12, comfort: 'middle', barrier: 8, residents: 8 },
      { id: 'warehouse', label: 'Warehouse / workshop unit', cost: 80000, upkeep: 3000, space: 20, comfort: 'squatter', barrier: 10, residents: 10 },
      { id: 'bunker', label: 'Bunker / hardened cellar', cost: 200000, upkeep: 4000, space: 14, comfort: 'squatter', barrier: 16, residents: 8 },
      { id: 'compound', label: 'Compound (several buildings)', cost: 400000, upkeep: 10000, space: 40, comfort: 'middle', barrier: 12, residents: 25 },
    ] as ReadonlyArray<{ id: string; label: string; cost: number; upkeep: number; space: number; comfort: string; barrier: number; residents: number }>,
    categories: [
      { id: 'structure', label: 'Structure' },
      { id: 'security', label: 'Security devices' },
      { id: 'defence', label: 'Active defences' },
      { id: 'magic', label: 'Magic' },
      { id: 'matrix', label: 'Matrix' },
      { id: 'facilities', label: 'Facilities' },
      { id: 'comfort', label: 'Comfort' },
      { id: 'concealment', label: 'Concealment' },
      { id: 'staff', label: 'Staff' },
    ] as ReadonlyArray<{ id: string; label: string }>,
    /**
     * The options. `rating` [min, max] when it is rated (cost, upkeep, space and number effects are
     * × rating when `perRating`); `repeat` true when it can be taken more than once; `requires` other
     * option ids that must be present; `note` is shown on the sheet.
     */
    options: [
      // Structure
      { id: 'reinforcedWalls', category: 'structure', label: 'Reinforced walls', rating: [1, 4], cost: 5000, upkeep: 0, space: 0, perRating: true, effects: { barrier: 2 }, note: '+2 Barrier Rating per rating.' },
      { id: 'securityDoor', category: 'structure', label: 'Security door with maglock', rating: [1, 8], cost: 800, upkeep: 0, space: 0, perRating: true, repeat: true, effects: { security: 0.5, device: { kind: 'maglock', name: 'Door maglock' } } },
      { id: 'armouredWindows', category: 'structure', label: 'Armoured or bricked-up windows', cost: 4000, upkeep: 0, space: 0, effects: { barrier: 1, security: 1 } },
      { id: 'blastShutters', category: 'structure', label: 'Blast shutters', cost: 12000, upkeep: 50, space: 0, effects: { barrier: 2, security: 1 }, note: 'Close for a lockdown.' },
      { id: 'panicRoom', category: 'structure', label: 'Panic room', cost: 25000, upkeep: 100, space: 1, effects: { security: 1 }, note: 'Barrier 16 inner room, own air for 24 h.' },
      { id: 'escapeTunnel', category: 'structure', label: 'Escape tunnel or bolt hole', cost: 20000, upkeep: 0, space: 0, effects: { concealment: 0 }, note: 'A hidden way out to a nearby street or the sewers.' },
      { id: 'generator', category: 'structure', label: 'Own power (generator, batteries)', cost: 6000, upkeep: 150, space: 1, effects: { concealment: 1 }, note: 'Off the grid: no power-company records; runs 2 weeks without fuel.' },
      // Security devices
      { id: 'camera', category: 'security', label: 'Camera', rating: [1, 8], cost: 300, upkeep: 0, space: 0, perRating: true, repeat: true, effects: { security: 0.5, device: { kind: 'camera', sense: 'visual', name: 'Camera' } } },
      { id: 'lowLightCamera', category: 'security', label: 'Low-light camera', rating: [1, 8], cost: 500, upkeep: 0, space: 0, perRating: true, repeat: true, effects: { security: 0.5, device: { kind: 'camera', sense: 'lowLight', name: 'Low-light camera' } } },
      { id: 'thermalCamera', category: 'security', label: 'Thermographic camera', rating: [1, 8], cost: 700, upkeep: 0, space: 0, perRating: true, repeat: true, effects: { security: 0.5, device: { kind: 'camera', sense: 'thermal', name: 'Thermographic camera' } } },
      { id: 'motionSensor', category: 'security', label: 'Motion sensor', rating: [1, 8], cost: 400, upkeep: 0, space: 0, perRating: true, repeat: true, effects: { security: 0.5, device: { kind: 'sensor', sense: 'motion', name: 'Motion sensor' } } },
      { id: 'pressurePads', category: 'security', label: 'Pressure pads', rating: [1, 8], cost: 300, upkeep: 0, space: 0, perRating: true, repeat: true, effects: { security: 0.5, device: { kind: 'sensor', sense: 'pressure', name: 'Pressure pads' } } },
      { id: 'ultrasound', category: 'security', label: 'Ultrasound sensor', rating: [1, 8], cost: 600, upkeep: 0, space: 0, perRating: true, repeat: true, effects: { security: 0.5, device: { kind: 'sensor', sense: 'ultrasound', name: 'Ultrasound sensor' } } },
      { id: 'acoustic', category: 'security', label: 'Acoustic sensor', rating: [1, 8], cost: 300, upkeep: 0, space: 0, perRating: true, repeat: true, effects: { security: 0.5, device: { kind: 'sensor', sense: 'acoustic', name: 'Acoustic sensor' } } },
      { id: 'alarm', category: 'security', label: 'Alarm system', rating: [1, 8], cost: 250, upkeep: 20, space: 0, perRating: true, effects: { security: 0.5, device: { kind: 'alarm', name: 'Alarm' } } },
      { id: 'idScanner', category: 'security', label: 'Face / ID check at the door', rating: [1, 8], cost: 1200, upkeep: 0, space: 0, perRating: true, effects: { security: 0.5, device: { kind: 'scanner', identifies: true, name: 'ID check' } }, note: 'Masks work against it.' },
      { id: 'weaponScanner', category: 'security', label: 'Weapon detector', rating: [1, 8], cost: 1000, upkeep: 0, space: 0, perRating: true, effects: { security: 0.5, device: { kind: 'scanner', scanKind: 'weapon', name: 'Weapon detector' } } },
      { id: 'cyberScanner', category: 'security', label: 'Cyberware scanner', rating: [1, 8], cost: 1500, upkeep: 0, space: 0, perRating: true, effects: { security: 0.5, device: { kind: 'scanner', scanKind: 'cyber', name: 'Cyberware scanner' } } },
      { id: 'explosiveSniffer', category: 'security', label: 'Explosive sniffer', rating: [1, 8], cost: 2000, upkeep: 0, space: 0, perRating: true, effects: { security: 0.5, device: { kind: 'scanner', scanKind: 'explosive', name: 'Explosive sniffer' } } },
      // Active defences
      { id: 'securityRigging', category: 'defence', label: 'Security rigger station', cost: 15000, upkeep: 100, space: 1, effects: { security: 1 }, note: 'Set the rigger and slave drones and turrets on the site sheet.' },
      { id: 'turret', category: 'defence', label: 'Weapon turret mount', cost: 8000, upkeep: 50, space: 0, repeat: true, requires: ['securityRigging'], effects: { security: 1 }, note: 'Make the turret as a vehicle actor and slave it to the site.' },
      { id: 'droneBay', category: 'defence', label: 'Patrol drone bay', rating: [1, 4], cost: 3000, upkeep: 50, space: 1, perRating: true, spacePerRating: true, requires: ['securityRigging'], effects: { security: 0.5 }, note: 'Drones themselves are bought as vehicles.' },
      { id: 'gasSystem', category: 'defence', label: 'Gas dispensers (knockout)', cost: 9000, upkeep: 100, space: 0, effects: { security: 1 }, note: 'Fill the rooms with a gas toxin on a lockdown.' },
      { id: 'paracritters', category: 'defence', label: 'Guard animals', rating: [1, 4], cost: 2000, upkeep: 200, space: 0, perRating: true, effects: { security: 0.5 }, note: 'Make them with the NPC generator (critters).' },
      // Magic
      { id: 'ward', category: 'magic', label: 'Ward', rating: [1, 12], cost: 1000, upkeep: 0, space: 0, perRating: true, effects: { ward: 1, security: 0.25 }, note: 'Ritual materials per Force; a magician must raise it (Conjuring ritual).' },
      { id: 'lodge', category: 'magic', label: 'Shamanic lodge', rating: [1, 12], cost: 500, upkeep: 0, space: 1, perRating: true, effects: { magicSite: 'lodge' } },
      { id: 'library', category: 'magic', label: 'Hermetic library', rating: [1, 12], cost: 1000, upkeep: 0, space: 1, perRating: true, effects: { magicSite: 'library' } },
      { id: 'circle', category: 'magic', label: 'Hermetic circle', rating: [1, 12], cost: 500, upkeep: 0, space: 1, perRating: true, effects: { magicSite: 'circle' } },
      { id: 'astralCamouflage', category: 'magic', label: 'Astral camouflage (mana-dead décor, no auras on show)', cost: 5000, upkeep: 0, space: 0, effects: { concealment: 1 }, note: 'Harder to find by assensing from outside.' },
      { id: 'spiritGuard', category: 'magic', label: 'Bound or watcher spirit on duty', cost: 0, upkeep: 0, space: 0, repeat: true, effects: { security: 1 }, note: 'Conjure it on the magician’s sheet.' },
      // Matrix
      { id: 'serverRoom', category: 'matrix', label: 'Server room', cost: 8000, upkeep: 200, space: 1, effects: {} },
      { id: 'homeHost', category: 'matrix', label: 'Home host', rating: [1, 8], cost: 6000, upkeep: 150, space: 0, perRating: true, requires: ['serverRoom'], effects: { host: 1 }, note: 'Security Value = rating.' },
      { id: 'isolatedLine', category: 'matrix', label: 'Isolated or spoofed jackpoint', cost: 3000, upkeep: 100, space: 0, effects: { concealment: 1 }, note: 'Harder to trace to the address.' },
      { id: 'faraday', category: 'matrix', label: 'Faraday shielding', cost: 10000, upkeep: 0, space: 0, effects: { concealment: 1, security: 1 }, note: 'No radio in or out: wired only.' },
      { id: 'satUplink', category: 'matrix', label: 'Satellite uplink', cost: 15000, upkeep: 500, space: 0, effects: {}, note: 'Matrix access without the local grid.' },
      // Facilities
      { id: 'medicalBay', category: 'facilities', label: 'Medical bay', rating: [1, 3], cost: 10000, upkeep: 200, space: 1, perRating: true, effects: { medical: -1 }, note: '−1 TN per rating to natural healing at home.' },
      { id: 'workshop', category: 'facilities', label: 'Workshop', rating: [1, 3], cost: 5000, upkeep: 100, space: 1, perRating: true, effects: { workshop: -1 }, note: '−1 TN per rating to Build/Repair tests here (apply by hand).' },
      { id: 'armory', category: 'facilities', label: 'Armoury (locked weapons store)', cost: 4000, upkeep: 0, space: 1, effects: { security: 0.5 } },
      { id: 'garage', category: 'facilities', label: 'Garage bay', rating: [1, 6], cost: 3000, upkeep: 100, space: 2, perRating: true, spacePerRating: true, effects: { garage: 1 }, note: 'One vehicle per bay.' },
      { id: 'supplies', category: 'facilities', label: 'Stored food and water', rating: [1, 12], cost: 200, upkeep: 0, space: 0, perRating: true, effects: { supplies: 1 }, note: 'Weeks for the residents.' },
      { id: 'gym', category: 'facilities', label: 'Gym / training room', cost: 4000, upkeep: 50, space: 2, effects: { comfort: 0 } },
      { id: 'simsense', category: 'facilities', label: 'Simsense and trid suite', cost: 2000, upkeep: 50, space: 0, effects: {} },
      // Comfort
      { id: 'furnishing', category: 'comfort', label: 'Better furnishing and fittings', rating: [1, 3], cost: 5000, upkeep: 400, space: 0, perRating: true, effects: { comfort: 1 }, note: 'One lifestyle step per rating.' },
      { id: 'realFood', category: 'comfort', label: 'Kitchen and real food', cost: 3000, upkeep: 600, space: 0, effects: { comfort: 1 } },
      { id: 'climate', category: 'comfort', label: 'Climate control and clean air', cost: 2500, upkeep: 100, space: 0, effects: { comfort: 0.5 } },
      // Concealment
      { id: 'hiddenEntrance', category: 'concealment', label: 'Hidden entrance', cost: 6000, upkeep: 0, space: 0, effects: { concealment: 1 } },
      { id: 'falseFront', category: 'concealment', label: 'False front (shop, office)', cost: 10000, upkeep: 500, space: 1, effects: { concealment: 2 }, note: 'Cover for people coming and going.' },
      { id: 'fakeOwner', category: 'concealment', label: 'Lease under a fake SIN', rating: [1, 6], cost: 1000, upkeep: 0, space: 0, perRating: true, effects: { concealment: 0.5 }, note: 'Paid like a fake SIN of that rating.' },
      { id: 'cashOnly', category: 'concealment', label: 'Cash-only, no-questions landlord', cost: 0, upkeep: 300, space: 0, effects: { concealment: 1 } },
      { id: 'noiseMasking', category: 'concealment', label: 'Soundproofing', cost: 3000, upkeep: 0, space: 0, effects: { concealment: 0.5 } },
      // Staff
      { id: 'guards', category: 'staff', label: 'Guards', rating: [1, 8], cost: 0, upkeep: 2500, space: 0, perRating: true, effects: { security: 1 }, note: 'Make them with the NPC generator (group).' },
      { id: 'streetDoc', category: 'staff', label: 'Street doc on call', cost: 0, upkeep: 3000, space: 0, effects: { medical: -1 } },
      { id: 'caretaker', category: 'staff', label: 'Caretaker', cost: 0, upkeep: 1000, space: 0, effects: { comfort: 0.5, concealment: 0.5 }, note: 'Keeps it lived-in and stocked while you are away.' },
      { id: 'lookouts', category: 'staff', label: 'Street-kid lookouts', cost: 0, upkeep: 300, space: 0, effects: { security: 0.5 }, note: 'Warn of strangers asking around.' },
    ] as ReadonlyArray<{
      id: string; category: string; label: string; rating?: readonly [number, number]; cost: number; upkeep: number; space: number;
      perRating?: boolean; spacePerRating?: boolean; repeat?: boolean; requires?: ReadonlyArray<string>; note?: string;
      effects: { security?: number; concealment?: number; comfort?: number; barrier?: number; ward?: number; medical?: number; workshop?: number; garage?: number; supplies?: number; host?: number; magicSite?: string; device?: { kind: string; name: string; sense?: string; scanKind?: string; identifies?: boolean } };
    }>,
  },
  ITEM_TEMPLATES: [
    ...([
      ['holdout', 'Hold-out pistol', { cost: 100, skill: 'Firearms', specialization: 'Pistols', damagePower: 4, damageLevel: 'L', modes: 'SS', ammoMax: 6, ammo: 6, range: { short: 5, medium: 15, long: 30, extreme: 50 } }],
      ['lightPistol', 'Light pistol', { cost: 350, skill: 'Firearms', specialization: 'Pistols', damagePower: 6, damageLevel: 'L', modes: 'SA', ammoMax: 12, ammo: 12, range: { short: 5, medium: 15, long: 30, extreme: 50 } }],
      ['heavyPistol', 'Heavy pistol', { cost: 450, skill: 'Firearms', specialization: 'Pistols', damagePower: 9, damageLevel: 'M', modes: 'SA', ammoMax: 10, ammo: 10, range: { short: 5, medium: 20, long: 40, extreme: 60 } }],
      ['smg', 'Submachine gun', { cost: 900, skill: 'Firearms', specialization: 'SMGs', damagePower: 6, damageLevel: 'M', modes: 'SA/BF/FA', ammoMax: 32, ammo: 32, recoilComp: 1, range: { short: 10, medium: 40, long: 80, extreme: 150 } }],
      ['assaultRifle', 'Assault rifle', { cost: 1600, skill: 'Firearms', specialization: 'Assault rifles', damagePower: 8, damageLevel: 'M', modes: 'SA/BF/FA', ammoMax: 40, ammo: 40, range: { short: 15, medium: 40, long: 100, extreme: 250 } /* v0.79.0 docs check: SRII Weapon Range Table (was 50/150/350/550) */ }], // v0.77.0 book check: the 1,600¥ M22A2 holds 40 (was 30)
      ['sniperRifle', 'Sniper rifle', { cost: 4000 /* v0.77.0 book check: book sniper rifles 4,000–6,500¥ (was 8,000) */, skill: 'Firearms', specialization: 'Rifles', damagePower: 14, damageLevel: 'S', modes: 'SA', ammoMax: 6, ammo: 6, range: { short: 40, medium: 80, long: 200, extreme: 400 } /* v0.79.0 docs check: SRII Weapon Range Table (was 100/400/800/1300) */ }],
      ['shotgun', 'Shotgun', { cost: 700, skill: 'Firearms', specialization: 'Shotguns', damagePower: 10, damageLevel: 'S', modes: 'SA', ammoMax: 8, ammo: 8, shotgun: true, choke: 2, range: { short: 10, medium: 20, long: 50, extreme: 100 } }],
      ['lmg', 'Light machine gun', { cost: 2500, skill: 'Gunnery', damagePower: 7, damageLevel: 'S', modes: 'FA', ammoMax: 50, ammo: 50, heavy: true, range: { short: 20, medium: 40, long: 80, extreme: 150 } /* v0.79.0 docs check: SRII Weapon Range Table (was 40/150/400/800, the HMG row) */ }],
      ['bow', 'Bow', { cost: 300, skill: 'Projectile Weapons', damagePower: 2, damageLevel: 'M', strengthPower: true, strengthCap: 3, strengthRange: true, strengthRangeMultipliers: { short: 1, medium: 10, long: 30, extreme: 60 } /* v0.79.0 docs check: SRII Weapon Range Table (was the default 1/2/3/5) */ }], // v0.77.0 book check: (Str Min + 2)M, a Str Min 3 bow at 300¥ (was +0, cap 6)
      ['throwingKnife', 'Throwing knife', { cost: 20, skill: 'Throwing Weapons', damagePower: 0, damageLevel: 'L', strengthPower: true, strengthRange: true }],
      ['offensiveGrenade', 'Offensive grenade', { cost: 30, skill: 'Throwing Weapons', damagePower: 10, damageLevel: 'S', blast: true, blastKind: 'offensive', blastPerMetre: 1, strengthRange: true, strengthRangeMultipliers: { short: 3, medium: 5, long: 10, extreme: 20 } /* v0.79.0 docs check: SRII Grenade Range Table (was 1/2/3/5) */ }],
      ['flashGrenade', 'Flash grenade', { cost: 40, skill: 'Throwing Weapons', damagePower: 5, damageLevel: 'L', blast: true, blastKind: 'flash', blastPerMetre: 5, strengthRange: true, strengthRangeMultipliers: { short: 3, medium: 5, long: 10, extreme: 20 } /* v0.79.0 docs check: SRII Grenade Range Table (was 1/2/3/5) */ }], // v0.77.0 book check: 5L in a 1 m blast, 40¥ (was 1L stun, 30¥)
      ['missileLauncher', 'Missile launcher', { cost: 8000, skill: 'Launch Weapons', damagePower: 16, damageLevel: 'D', modes: 'SS', ammoMax: 4, ammo: 4, blast: true, blastKind: 'heRocket', blastPerMetre: 1, guidance: 3 /* v0.77.0 book check: an HE missile (guidance 3, not anti-vehicle; was 4 + AV) */, antiVehicle: false, minRange: 20, range: { short: 70, medium: 150, long: 450, extreme: 1500 } /* v0.79.0 docs check: SRII Weapon Range Table, minimum 20 m (was 150/450/1200/3000, no minimum) */ }],
      ['flamethrower', 'Flamethrower', { cost: 1600, skill: 'Gunnery', damagePower: 8, damageLevel: 'S', modes: 'SS', ammoMax: 10, ammo: 10, areaKind: 'flame', range: { short: 5, medium: 10, long: 20, extreme: 30 } }],
      ['knife', 'Knife', { cost: 30, skill: 'Edged Weapons', melee: true, damagePower: 0, damageLevel: 'L', strengthPower: true }],
      ['sword', 'Sword', { cost: 500, skill: 'Edged Weapons', melee: true, reach: 1, damagePower: 2 /* v0.77.0 book check: (STR+2)M (was +3) */, damageLevel: 'M', strengthPower: true }],
      ['club', 'Club', { cost: 10, skill: 'Clubs', melee: true, reach: 1 /* v0.77.0 book check */, damagePower: 1, damageLevel: 'M', damageType: 'stun', strengthPower: true }],
      ['polearm', 'Pole arm', { cost: 500, skill: 'Polearms/Staffs', melee: true, reach: 2, damagePower: 0 /* v0.77.0 book check: (STR)S (was +3) */, damageLevel: 'S', strengthPower: true }],
      ['stunBaton', 'Stun baton', { cost: 750, skill: 'Clubs', melee: true, reach: 1, damagePower: 6, damageLevel: 'S', damageType: 'stun', stunWeapon: true, ammoMax: 10, ammo: 10 }],
      // v0.61.0 (VERIFY)
      ['monowhip', 'Monofilament whip', { cost: 3000, skill: 'Whips', melee: true, reach: 2, damagePower: 10, damageLevel: 'S', selfHit: true }],
      ['grenadeLauncher', 'Grenade launcher', { cost: 1600 /* v0.77.0 book check: six-shot SA launcher 1,600¥ (was 2,000) */, skill: 'Launch Weapons', damagePower: 10, damageLevel: 'S', modes: 'SA', ammoMax: 6, ammo: 6, blast: true, blastKind: 'offensive', blastPerMetre: 1, minRange: 5, range: { short: 50, medium: 100, long: 150, extreme: 300 } }],
      ['smokeGrenade', 'Smoke grenade', { cost: 30, skill: 'Throwing Weapons', damagePower: 0, damageLevel: 'L', damageType: 'stun', blast: true, blastKind: 'smoke', blastPerMetre: 1, strengthRange: true, strengthRangeMultipliers: { short: 3, medium: 5, long: 10, extreme: 20 } /* v0.79.0 docs check: SRII Grenade Range Table (was 1/2/3/5) */ }],
      ['taser', 'Taser', { cost: 1000, skill: 'Firearms', damagePower: 10, damageLevel: 'S', damageType: 'stun', stunWeapon: true, modes: 'SA', ammoMax: 4, /* v0.77.0 book check: 10S, SA (was 10M, SS) */ ammo: 4, range: { short: 5, medium: 10, long: 12, extreme: 15 } /* v0.79.0 docs check: SRII Weapon Range Table (was 5/10/15/20) */ }],
    ] as Array<[string, string, Record<string, unknown>]>).map(([id, name, s]) => ({
      id, type: 'weapon', name,
      // Every layout flag is spelled out, so applying a template to another kind of weapon resets it.
      system: {
        skill: '', specialization: '', melee: false, reach: 0, damagePower: 0, damageLevel: 'M', damageType: 'physical', strengthPower: false, strengthCap: 0,
        strengthRange: false, heavy: false, stunWeapon: false, modes: '', recoilComp: 0, ammo: 0, ammoMax: 0, smartgun: false, blast: false, blastKind: 'offensive',
        blastPerMetre: 1, shotgun: false, choke: 1, areaKind: '', guidance: 0, antiVehicle: false, minRange: 0, selfHit: false, range: { short: 0, medium: 0, long: 0, extreme: 0 },
        strengthRangeMultipliers: { short: 1, medium: 2, long: 3, extreme: 5 }, ...s,
      },
    })),
    { id: 'armorJacket', type: 'armor', name: 'Armor jacket', system: { cost: 900, ballistic: 5, impact: 3, worn: true, adds: false } },
    { id: 'armorVest', type: 'armor', name: 'Armor vest', system: { cost: 200, ballistic: 2, impact: 1, worn: true, adds: false } },
    { id: 'armorClothing', type: 'armor', name: 'Armored clothing', system: { cost: 500, ballistic: 3, impact: 0, worn: true, adds: false } },
    { id: 'helmet', type: 'armor', name: 'Helmet', system: { cost: 200, ballistic: 1, impact: 1, worn: true, adds: true } },
    { id: 'formFitting', type: 'armor', name: 'Form-fitting body armor', system: { cost: 500, ballistic: 4, impact: 1, worn: true, adds: false } }, // v0.77.0 book check: full suit 4/1, not worn with other body armor (was 3/1, adds)
    // v0.43.0
    { id: 'riotShield', type: 'armor', name: 'Riot shield', system: { cost: 1500, ballistic: 1, impact: 0, worn: true, adds: true, parry: 0, weight: 2 } }, // v0.77.0 book check: small shield +1 ballistic, 2 kg (was 0/2, 4 kg); v0.78.0 owner: no parry bonus (was parry 1)
    { id: 'datajack', type: 'cyberware', name: 'Datajack', system: { cost: 1000, kind: 'datajack', essenceCost: 0.2, installed: true, bioware: false } },
    { id: 'smartlink', type: 'cyberware', name: 'Smartlink', system: { cost: 2500, kind: 'other', essenceCost: 0.5, installed: true, smartlink: true, smartlinkLevel: 1, bioware: false } },
    { id: 'cybereyes', type: 'cyberware', name: 'Cybereyes (low-light)', system: { cost: 8000, kind: 'eyes', essenceCost: 0.2, installed: true, lowLight: true, bioware: false } }, // v0.78.0 book check: eyes 0.2 / 5,000¥ + low-light 3,000¥ (its 0.2 Essence free inside cybereyes) (was 0.3 / 5,000¥)
    { id: 'wired1', type: 'cyberware', name: 'Wired reflexes 1', system: { cost: 55000, kind: 'reflexes', reflexes: 'wired', rating: 1, essenceCost: 2, installed: true, reaction: 2, initiativeDice: 1, bioware: false } },
    { id: 'dermalPlating1', type: 'cyberware', name: 'Dermal plating 1', system: { cost: 6000, kind: 'other', essenceCost: 0.5, installed: true, armorBallistic: 1, armorImpact: 1, bioware: false } },
    { id: 'combatSpell', type: 'spell', name: 'Combat spell (mana)', system: { category: 'combat', spellType: 'mana', learnedForce: 4, damageLevel: 'S', damageType: 'physical', duration: 'instant', area: false, drainModifier: 0, drainLevel: 'S' } }, // v0.77.0 book check: the book's Mana Bolt is S, drain (F/2)S (was M)
    { id: 'detectionSpell', type: 'spell', name: 'Detection spell', system: { category: 'detection', spellType: 'mana', learnedForce: 4, targetNumber: 4, duration: 'sustained', area: false, drainModifier: 0, drainLevel: 'L' } },
    { id: 'attackUtility', type: 'program', name: 'Attack utility', system: { kind: 'attack', rating: 4, damageLevel: 'M', loaded: true } },
    { id: 'sleaze', type: 'program', name: 'Sleaze', system: { kind: 'sleaze', rating: 4, loaded: true } },
    { id: 'medkit', type: 'gear', name: 'Medkit', system: { cost: 200, quantity: 1, medkitRating: 3 } },
    { id: 'weaponScanner', type: 'gear', name: 'Weapon detector (hand-held)', system: { cost: 1000, quantity: 1, scanner: { kind: 'weapon', rating: 4 } } },
    { id: 'cyberScanner', type: 'gear', name: 'Cyberware scanner (hand-held)', system: { cost: 1500, quantity: 1, scanner: { kind: 'cyber', rating: 4 } } },
    { id: 'sniffer', type: 'gear', name: 'Explosive sniffer', system: { cost: 2000, quantity: 1, scanner: { kind: 'explosive', rating: 4 } } },
    { id: 'powerFocus', type: 'focus', name: 'Power focus', system: { focusType: 'power', rating: 1, active: true, bonded: false } },
    // v0.46.0
    // v0.78.0 owner's decision: SR2 core 10,000¥ × Rating (Corporate Security says × Rating²: VERIFY).
    { id: 'passkey', type: 'gear', name: 'Maglock passkey', system: { cost: 40000, quantity: 1, bypassTool: { kind: 'passkey', rating: 4 } } },
    { id: 'rcd', type: 'gear', name: 'Remote control deck', system: { cost: 100000, quantity: 1, rcdRating: 2, signal: 4, weight: 4 } }, // v0.77.0 book check: Rating × 50,000¥, weight Rating × 2 (was 5,000¥)
    { id: 'jammer', type: 'gear', name: 'Jammer', system: { cost: 4000, quantity: 1, jammer: 4 } },
    { id: 'chameleonSuit', type: 'gear', name: 'Chameleon suit', system: { cost: 8000, quantity: 1, stealth: { kind: 'chameleon', rating: 4, worn: true } } },
    { id: 'iccm', type: 'cyberware', name: 'ICCM biofeedback filter', system: { cost: 10000, kind: 'iccm', rating: 1, essenceCost: 0.2, installed: true, bioware: false } },
    // v0.61.0 (VERIFY)
    { id: 'climbingGear', type: 'gear', name: 'Climbing gear', system: { cost: 250 /* v0.77.0 book check: the ascent/descent kit (was 200) */, quantity: 1, skillMods: [{ skill: 'Athletics', dice: 2, tn: 0 }] } },
    { id: 'cyberears', type: 'cyberware', name: 'Cyberears (amplification 1, damper)', system: { cost: 11000, kind: 'ears', essenceCost: 0.4, installed: true, hearingAmp: 1, dampener: true, bioware: false } }, // v0.78.0 book check: ears 0.3 / 4,000¥ + amplification 0.2 / 3,500¥ (free: the one feature) + damper 0.1 / 3,500¥ (was 0.3 / 4,000¥)
    { id: 'radio', type: 'gear', name: 'Headset radio', system: { cost: 500, quantity: 1, radio: { rating: 4, encryption: 0 } } },
    { id: 'fakeSin', type: 'gear', name: 'Fake SIN', system: { cost: 4000, quantity: 1, identity: { kind: 'sin', rating: 4, fake: true, covers: '' } } },
    { id: 'fakeLicence', type: 'gear', name: 'Fake firearms licence', system: { cost: 800, quantity: 1, identity: { kind: 'licence', rating: 4, fake: true, covers: 'permit' } } },
    { id: 'tortoise', type: 'cyberdeck', name: 'Tortoise', system: { cost: 6000, active: true, mpcp: 3, bod: 2, evasion: 2, masking: 2, sensors: 2, tortoise: true } },
  ] as ReadonlyArray<{ id: string; type: string; name: string; system: Record<string, unknown> }>,

  /**
   * Magic and critters (v0.56.0). All VERIFY, from memory of SR2 and the Grimoire; no book data.
   * - `spellEffects`: sustained spells that change stats (Increase Reflexes, Increase [Attribute],
   *   Armor...). The spell's Effects fields give the change; with "per success" each `step` successes
   *   add one more (capped at the Force when `capAtForce`). `reflexesExclusive`: initiative dice from
   *   spells don't stack with wired / boosted reflexes or adept reflexes (the best counts).
   * - `healing`: a health spell set to drain "by the wound" drains at the level of the wound it heals
   *   (`woundLevels`: boxes on the track → level; the highest level reached). A Treat spell only works
   *   within `treatHours` hours of the newest damage (0 = any time); `treatBlock` refuses, else warns.
   * - `touch`: a touch-range spell needs no line of sight but contact. Against an unwilling target the
   *   caster first rolls `skill` (defaulting as usual) vs `tn`, opposed by the target's `defense`
   *   attribute vs `tn` when `opposed`; the caster needs more successes. `reachMetres`: the caster's
   *   token must be this close ('warn' or 'block' by `distance`; 'off' ignores the canvas).
   * - `learning`: learning (or raising) a spell is a `skill` test vs the Force; it takes
   *   Force × `daysPerForce` days ÷ successes, and a hermetic needs a sorcery library (a shaman a lodge
   *   of the totem) of at least the Force (`site`: 'warn', 'block' or 'off'). Good Karma is paid on
   *   success only. `enabled` false: the old Karma-only purchase.
   * - `permanent`: a permanent spell is sustained for ceil(Force × `turnsPerForce` ÷ successes) Combat
   *   Turns (`secondsPerTurn` of world time each; 0 = Foundry's combat round time, else 3) before it takes; dropped before then, it ends
   *   (healing comes undone when `undoHealing`). `enabled` false: it takes at once.
   * - `ward`: raising a ward by ritual: the leader's `skill` (plus team dice as for ritual sorcery)
   *   vs the Force; it takes Force × `hoursPerForce` hours ÷ successes and costs Force ×
   *   `nuyenPerForce` in materials; every member resists drain at TN floor(Force/2) + `drainModifier`,
   *   level `drainLevel`. Any success makes a ward (a barrier actor) at the Force.
   * - `manifest`: a projecting magician (or an unmaterialized spirit) can manifest: seen and heard in
   *   the physical world but unable to act there (`blocksPhysical`); the token shows at `alpha`.
   * - `detectionRange`: a detection spell reaches Magic × Force × `factor` metres (× `extendedFactor`
   *   for an extended-range spell); a target further away 'warn's or 'block's (`enforce`).
   * - `assensing`: what each number of successes reveals (cumulative); the card is whispered to the
   *   assenser. Keys: health, emotion, awakened, cyberware, essenceCompare, magicCompare, essence,
   *   magic, cyberwareList, foci, signature, sustained.
   * - `centering`: 'auto' (grade × centering points off, as before), 'test' (a Center action rolls the
   *   character's centering skill vs `tn`; each success, up to the grade × centeringPerGrade, comes off
   *   the next magical test's wounds and sustaining penalties, within `windowSeconds`), or
   *   'testIfSkill' (test when a centering skill is named, else auto).
   * - `natureSpirits`: a nature spirit leaves at the next sunrise or sunset (`departs` 'dawnDusk' or
   *   'off'); `sunrise` / `sunset` are hours of the day; world time 0 is `dayStartHour` o'clock.
   * - `control`: instead of banishing, a magician can try to take a spirit over: the same contest,
   *   and with net successes it becomes theirs, owing `services` ('net' = the net successes, 'keep' =
   *   what it still owed). `summonerHelps`: a bound spirit's summoner rolls their conjuring skill vs
   *   the banisher's Magic and adds the successes to the spirit's.
   * - `trueName`: a magician who knows a free spirit's true name binds it with their conjuring skill
   *   vs its Force, opposed by its Force (+ spirit energy) vs their Magic; net successes are services;
   *   it costs Force × `karmaPerForce` Good Karma on success.
   */
  MAGIC_V56: {
    spellEffects: { reflexesExclusive: true, step: 1, capAtForce: true },
    healing: { woundLevels: [[1, 'L'], [3, 'M'], [6, 'S'], [10, 'D']] as ReadonlyArray<readonly [number, 'L' | 'M' | 'S' | 'D']>, treatHours: 1, treatBlock: false },
    touch: { skill: 'Unarmed Combat', tn: 4, opposed: true, defense: 'quickness' as 'quickness' | 'reaction' | 'body', reachMetres: 2, distance: 'warn' as 'warn' | 'block' | 'off' },
    learning: { enabled: true, skill: 'Sorcery', daysPerForce: 1, site: 'warn' as 'warn' | 'block' | 'off' },
    permanent: { enabled: true, turnsPerForce: 1, secondsPerTurn: 0, undoHealing: true },
    ward: { skill: 'Conjuring', hoursPerForce: 1, nuyenPerForce: 0, drainModifier: 0, drainLevel: 'M' as 'L' | 'M' | 'S' | 'D' },
    manifest: { enabled: true, blocksPhysical: true, alpha: 0.5 },
    detectionRange: { factor: 1, extendedFactor: 10, enforce: 'warn' as 'warn' | 'block' | 'off' },
    assensing: [
      { successes: 1, reveals: ['health', 'emotion', 'awakened', 'foci'] },
      { successes: 2, reveals: ['cyberware', 'essenceCompare', 'magicCompare'] },
      { successes: 3, reveals: ['essence', 'magic', 'cyberwareList', 'sustained'] },
      { successes: 4, reveals: ['signature'] },
    ] as ReadonlyArray<{ successes: number; reveals: readonly string[] }>,
    centering: { mode: 'testIfSkill' as 'auto' | 'test' | 'testIfSkill', tn: 4, windowSeconds: 30 },
    natureSpirits: { departs: 'dawnDusk' as 'dawnDusk' | 'off', sunrise: 6, sunset: 18, dayStartHour: 0 },
    control: { enabled: true, services: 'net' as 'net' | 'keep', summonerHelps: true },
    trueName: { karmaPerForce: 1 },
  },

  /**
   * Adepts and critters (v0.56.0). All VERIFY.
   * - `adeptBudget`: when Magic drops below the power points spent, powers past the budget (the last
   *   on the sheet first) stop working ('off'), or the sheet only warns ('warn').
   * - Adept specials: `rapidHealing` adds dice per level to natural healing; `distanceStrike` lets
   *   killing hands reach Magic × `metresPerMagic` metres (+`tn` TN, no counterattack);
   *   `spellResistance` adds dice per level to resist spells and powers; `improvedSenses` gives the
   *   vision named on the power.
   * - `immunity`: a critter power with Special "immunity" names what it is immune to (tags, e.g.
   *   "normal weapons, fire"). Normal weapons: armor of Essence × `armorPerEssence` (ballistic and
   *   impact) against non-magical attacks; fire: no fire hazard or burning; poisons: toxins and drugs
   *   do nothing; pathogens: diseases do nothing; age: a note. The five kinds and their synonyms are fixed
   *   (bestiary.ts critterImmunities).
   * - `powerMods`: what the TN-changing powers put on their target, by Special. Values: a number,
   *   'force' (the power's rating) or 'successes' (net successes). testsTn: every test; perceivedTn:
   *   tests to perceive the bearer; attackedTn: attacks and spells against the bearer;
   *   movementFactor: movement × (a value below 1 divides). Fear also marks the target "afraid".
   */
  CRITTERS_V56: {
    adeptBudget: 'off' as 'off' | 'warn',
    rapidHealing: { dicePerLevel: 1 },
    distanceStrike: { metresPerMagic: 1, tn: 0 },
    spellResistance: { dicePerLevel: 1 },
    immunity: {
      armorPerEssence: 2,
    },
    powerMods: {
      concealment: { perceivedTn: 'force' },
      confusion: { testsTn: 'force' }, // v0.77.0 book check: + the being's Essence (power rating), not net successes
      movement: { movementFactor: 'force' },
      fear: { testsTn: 'successes' },
      guard: { attackedTn: 0 }, // v0.77.0 book check: Guard prevents accidents only (was + rating to attacks)
    } as Record<string, Partial<Record<'testsTn' | 'perceivedTn' | 'attackedTn' | 'movementFactor', number | 'force' | 'successes'>>>,
  },

  /**
   * The Matrix (v0.57.0). All VERIFY, from memory of SR2 and Virtual Realities 2.0.
   * - `tally`: `perDecker` keeps a security tally for each intruder (VR2) instead of one per host;
   *   sheaf steps fire when that decker's own tally reaches them, and the host's alert (shared)
   *   rises. A frame's detection goes on its owner's tally; an agent's on its own (`agentTally`
   *   'own') or its owner's. The host's `tally` field shows the highest one.
   * - `loading`: loading a utility into active memory while jacked in takes ceil(size ÷ load
   *   speed) Combat Turns (`secondsPerTurn` of world time each outside combat), started by a Swap
   *   Memory action (`action`); unloading is instant. The deck's Load Speed (Mp per Combat Turn;
   *   0 = its I/O speed when `fromIo`). Off-line (not jacked in) it is free (`freeOffline`). A
   *   loading utility counts in memory but can't be used.
   * - `wounds`: damage on the Matrix condition monitor gives the persona (and IC, frames, agents)
   *   the usual wound modifier on their Matrix tests (same box bands as `WOUND_MODIFIERS`).
   * - `blackIcHold`: a decker engaged by black IC (a live black IC in the same host has attacked
   *   them) must win `attribute` (+ Hacking Pool) vs TN = the IC's rating, at least `successes`,
   *   to jack out; a failure leaves them in. Breaking contact (evade maneuver) or crashing the IC frees them.
   * - `shutdown`: a host that reaches the shutdown alert (crashed, or a sheaf step) dumps everyone
   *   inside after `turns` Combat Turns (0 = at once; `secondsPerTurn` outside combat), with dump
   *   shock; frames and agents fall off to the parent grid.
   * - `dumpShock.levelBy`: 'fixed' (RULES.MATRIX.dumpShockLevel) or 'code' (`byCode`, VR2/SR3 style).
   * - `icInitiative.from`: 'rating' (rating + dice, RULES.MATRIX.icInitiativeDice) or
   *   'securityValue' (the host's Security Value + `diceByCode`d6). `icAttackDice`: 'rating' or
   *   'securityValue' (the IC rolls the host's Security Value; its rating stays the Power).
   * - `perception`: Locate Decker, Locate IC and Analyze Icon roll `dice` ('sensors' = persona
   *   Sensors; 'computer' = the Computer skill) + Hacking Pool vs the target's Detection Factor
   *   (deckers), rating (IC, frames, agents); Lock-On lowers the TN. Analyze reveals by successes.
   * - `maneuvers`: opposed: the decker's Evasion (+ Hacking Pool, Cloak lowers the TN) vs TN = the
   *   opponent's Sensors (IC: rating); the opponent rolls Sensors (IC: rating) vs TN = the decker's
   *   Evasion (their Lock-On lowers it). Net successes: 'position' −1 TN per net (at most `maxTn`)
   *   on the decker's next attack on that opponent; 'parry' +1 TN per net on the opponent's attacks
   *   on the decker; 'evade' breaks contact (frees a black IC hold, and that IC must find them
   *   again: its attacks are refused until it does, `evadeBlocks`). They last until the end of the
   *   next Combat Turn (`turns`; `secondsPerTurn` outside combat).
   * - `utilities`: `slow` (Computer + Hacking Pool vs the IC's rating; net successes, at most the
   *   Slow rating, each take `initiativePerNet` off the IC's Initiative score this Combat Turn);
   *   `restore` (Restore rating + Hacking Pool vs `tn`; each success restores a crippled point, then
   *   deck damage when `deckDamage`); `validate` (Validate Passcode: the host then rolls detection
   *   against the decker's Detection Factor + `dfBonus`; Invalidate Passcode removes it).
   * - `bombs`: a file (or a subsystem) can carry a data bomb of a rating: the first operation that
   *   touches it sets it off: Matrix damage Power = rating at `level` (Resist button), the file is
   *   erased (a Pavlov bomb leaves it and re-arms), the alert rises to `alert`. Scan File (Analyze)
   *   shows it to that decker; Defuse Bomb (Decrypt vs the rating) removes it.
   * - `comcalls`: on an LTG, Make Comcall places a call to a number, Tap Comcall listens in on one,
   *   Reroute Comcall sends it elsewhere; calls are listed on the LTG (GM sees all).
   * - `realityFilter`: a deck with a reality filter tests MPCP vs the host's Security Value on
   *   entering a host: success gives +`reaction` Matrix Reaction and +`pool` Hacking Pool there;
   *   failure +`failTn` TN on Matrix tests there.
   * - `hitchers`: people riding a deck's hitcher jacks see the run; black IC damage and dump shock
   *   hit each of them too (`blackIc`, `dumpShock`).
   * - `chips`: BTL and simsense chips: playing one needs a chipjack, datajack or simrig (`needs`);
   *   one-use kinds burn out (`burnsOut`); addictive kinds count as a dose of a drug for addiction.
   */
  MATRIX_V57: {
    tally: { perDecker: true, agentTally: 'own' as 'own' | 'owner' },
    loading: { enabled: true, fromIo: true, secondsPerTurn: 3, freeOffline: true, action: 'simple' as 'free' | 'simple' | 'complex' },
    wounds: { enabled: true, ic: true },
    blackIcHold: { enabled: true, attribute: 'willpower' as 'willpower' | 'intelligence', pool: true, successes: 1 },
    shutdown: { enabled: true, turns: 3, secondsPerTurn: 3 },
    dumpShock: { levelBy: 'fixed' as 'fixed' | 'code', byCode: { blue: 'L', green: 'M', orange: 'S', red: 'D', black: 'D' } as Record<string, 'L' | 'M' | 'S' | 'D'> },
    icInitiative: { from: 'rating' as 'rating' | 'securityValue', diceByCode: { blue: 1, green: 2, orange: 3, red: 4, black: 4 } as Record<string, number> },
    icAttackDice: 'rating' as 'rating' | 'securityValue',
    perception: { dice: 'sensors' as 'sensors' | 'computer', pool: true, analyze: [
      { successes: 1, reveals: ['kind'] },
      { successes: 2, reveals: ['rating', 'state'] },
      { successes: 3, reveals: ['details'] },
    ] as ReadonlyArray<{ successes: number; reveals: readonly string[] }> },
    maneuvers: { enabled: true, pool: true, maxTn: 4, turns: 1, secondsPerTurn: 3, evadeBlocks: true },
    utilities: {
      slow: { initiativePerNet: 3 },
      restore: { tn: 4, pool: true, deckDamage: false, degrades: true },
      validate: { dfBonus: 2 },
    },
    bombs: { level: 'M' as 'L' | 'M' | 'S' | 'D', alert: 'passive' as 'none' | 'passive' | 'active' | 'shutdown' },
    comcalls: { needsLtg: true },
    realityFilter: { reaction: 1, pool: 1, failTn: 1 },
    hitchers: { blackIc: true, dumpShock: true },
    chips: {
      kinds: ['', 'simsense', 'btl', 'dreamchip', 'moodchip', 'personafix'] as readonly string[],
      needs: ['chipjack', 'datajack', 'simrig'] as readonly string[],
      burnsOut: ['btl', 'dreamchip'] as readonly string[],
      addictive: ['btl', 'dreamchip', 'moodchip'] as readonly string[],
    },
  },

  /**
   * Vehicles (v0.57.0). All VERIFY, from memory of SR2 and Rigger 2.
   * - `accel`: in a started combat, current speed changes by at most the vehicle's Accel per Combat
   *   Turn (braking: × `brakeMultiplier`); more needs a "push" driving test at +`pushTn`: each success
   *   adds another `perSuccess` × Accel; a failure keeps the normal change; a disaster calls for a
   *   crash test. Outside combat any change is free (`outsideCombat` 'free'), or limited the same way.
   * - `crashAfterDamage`: damage of `at` or worse ('L' = any) to a moving vehicle calls for a crash
   *   test (its driver or autopilot), + the damage modifier.
   * - `calledShots`: aiming at part of a vehicle (+`tn`): tires (a crash test at +`crashTn`, Handling
   *   +`handling` until repaired), sensors (Sensor −`sensor`), a weapon mount (that weapon is jammed),
   *   the engine (Speed × `speedFactor`), an occupant (the damage goes to them, + `tn` more, the
   *   vehicle's armor as extra armor when `armorCounts`).
   * - `maneuver`: chase mode 'gap' (v0.25.0) or 'score' (Rigger 2 style): each chase turn a driver's
   *   maneuver score = positioning successes + min(`maxSpeedPoints`, current speed ÷ `speedPerPoint`)
   *   (+ autopilot dice when unmanned); the higher score wins the position: −1 TN per `netPerTn` net
   *   (at most `maxTn`) for its mounted fire on the other this turn, + the same on the other's; the
   *   gap moves `metresPerNet` per net as before.
   * - `evasion`: a manual driver (not jumped in) evades with a driving test (`manual` 'driving': the
   *   vehicle skill (+ Combat Pool dice chosen) vs Handling + driving modifiers), with Combat Pool
   *   only ('pool', vs the attack TN), or not at all ('none').
   * - `sensorGunnery`: 'flat' (RULES.VEHICLES.sensorLock.tn) or 'signature' (with a lock, the range
   *   TN is replaced by the target's Signature, and Gunnery dice are capped at the Sensor rating).
   * - `design`: build a vehicle from a chassis (Body, Handling, Speed, Accel, Armor, Signature, CF,
   *   design points and a price), a powerplant (multiplies Speed and Accel, a price), and design
   *   points spent on stats at `pointCosts` each. Example rows only, not book data: edit them in the
   *   Advanced box.
   */
  VEHICLES_V57: {
    accel: { enabled: true, brakeMultiplier: 2, pushTn: 2, perSuccess: 1, outsideCombat: 'free' as 'free' | 'limited' },
    crashAfterDamage: { enabled: true, at: 'S' as 'L' | 'M' | 'S' | 'D' },
    calledShots: {
      tn: 4,
      parts: [
        { id: 'tires', label: 'Tires', crashTn: 2, handling: 1 },
        { id: 'sensors', label: 'Sensors', sensor: 2 },
        { id: 'mount', label: 'A weapon mount' },
        { id: 'engine', label: 'Engine', speedFactor: 0.5 },
        { id: 'occupant', label: 'An occupant', tn: 2, armorCounts: true },
      ] as ReadonlyArray<{ id: string; label: string; crashTn?: number; handling?: number; sensor?: number; speedFactor?: number; tn?: number; armorCounts?: boolean }>,
    },
    maneuver: { mode: 'gap' as 'gap' | 'score', speedPerPoint: 20, maxSpeedPoints: 4, netPerTn: 1, maxTn: 3 },
    evasion: { manual: 'driving' as 'driving' | 'pool' | 'none' },
    // v0.79.0 docs check: 'rigger2' (new default) — Gunnery/Pilot + Sensor ÷ 2 vs Signature + ECM, no range or movement
    // modifiers (RULES.DOCS_V79.vehSeg; Rigger 2 Sensor-Enhanced Targeting Modifiers table). Was 'flat'.
    sensorGunnery: 'rigger2' as 'rigger2' | 'flat' | 'signature',
    design: {
      chassis: [
        { id: 'compact', label: 'Compact car (example)', body: 2, handling: 4, speed: 90, accel: 8, armor: 0, signature: 3, cf: 6, points: 10, cost: 15000 },
        { id: 'sedan', label: 'Sedan (example)', body: 3, handling: 4, speed: 110, accel: 10, armor: 0, signature: 2, cf: 12, points: 12, cost: 30000 },
        { id: 'van', label: 'Van (example)', body: 4, handling: 5, speed: 90, accel: 6, armor: 0, signature: 2, cf: 40, points: 14, cost: 40000 },
        { id: 'bike', label: 'Motorbike (example)', body: 2, handling: 3, speed: 120, accel: 12, armor: 0, signature: 4, cf: 1, points: 8, cost: 10000 },
        { id: 'drone', label: 'Small drone (example)', body: 1, handling: 3, speed: 60, accel: 10, armor: 0, signature: 6, cf: 0, points: 6, cost: 5000 },
      ] as ReadonlyArray<{ id: string; label: string; body: number; handling: number; speed: number; accel: number; armor: number; signature: number; cf: number; points: number; cost: number }>,
      powerplants: [
        { id: 'electric', label: 'Electric (example)', speed: 0.8, accel: 0.8, cost: 0 },
        { id: 'gasoline', label: 'Gasoline (example)', speed: 1, accel: 1, cost: 2000 },
        { id: 'performance', label: 'Performance (example)', speed: 1.25, accel: 1.25, cost: 10000 },
      ] as ReadonlyArray<{ id: string; label: string; speed: number; accel: number; cost: number }>,
      /** Design points and nuyen for +1 of each stat (Handling: −1; Speed and Accel: +10 and +2). */
      pointCosts: {
        body: { points: 2, nuyen: 2000, step: 1 },
        armor: { points: 2, nuyen: 3000, step: 1 },
        handling: { points: 3, nuyen: 5000, step: -1 },
        speed: { points: 1, nuyen: 1000, step: 10 },
        accel: { points: 1, nuyen: 1000, step: 2 },
        signature: { points: 2, nuyen: 3000, step: 1 },
        cf: { points: 1, nuyen: 500, step: 2 },
        mounts: { points: 2, nuyen: 2500, step: 1 },
      } as Record<string, { points: number; nuyen: number; step: number }>,
      maxArmorPerBody: 1,
    },
  },

  /**
   * Building security (v0.57.0). All VERIFY, from memory of SR2's gear lists and the Corporate
   * Security Handbook.
   * - `lockTypes`: a maglock's kind adds `tn` to bypassing it; `tools` lists the tool kinds that work
   *   on it. A lock with a casing rating must have its casing opened first (a test vs the casing
   *   rating with `casingSkill`), then the circuit is bypassed.
   * - `tools`: gear with a bypass tool kind and rating. 'dice' adds the rating as dice, 'replace'
   *   rolls the rating instead of the skill when higher, 'tn' takes the rating off the TN (at most
   *   `maxTnOff`). A kit (`kit: true`) counts as having tools; without any tool: +`noToolsTn`.
   * - `light`: light at the lock (the bypasser's token) by the bypasser's vision, from the
   *   visibility table × `factor` (rounded up); off with `enabled` false.
   */
  SECURITY_V57: {
    lockTypes: [
      { id: '', label: '(not set)', tn: 0, tools: ['sequencer', 'passkey', 'maglockKit'] },
      { id: 'keypad', label: 'Keypad', tn: 0, tools: ['sequencer', 'maglockKit'] },
      { id: 'card', label: 'Card reader', tn: 2 /* v0.77.0 book check (was 0) */, tools: ['passkey', 'maglockKit'] },
      { id: 'print', label: 'Print scanner', tn: 4 /* v0.77.0 book check (was 2) */, tools: ['maglockKit'] },
      { id: 'retina', label: 'Retinal scanner', tn: 3, tools: ['maglockKit'] },
      { id: 'voice', label: 'Voice recognition', tn: 2, tools: ['maglockKit'] },
    ] as ReadonlyArray<{ id: string; label: string; tn: number; tools: readonly string[] }>,
    casingSkill: 'Electronics B/R',
    tools: [
      { id: 'sequencer', label: 'Maglock sequencer', mode: 'replace' as 'dice' | 'replace' | 'tn', kit: true },
      { id: 'passkey', label: 'Maglock passkey', mode: 'replace' as 'dice' | 'replace' | 'tn', kit: true },
      { id: 'maglockKit', label: 'Maglock kit', mode: 'tn' as 'dice' | 'replace' | 'tn', kit: true },
      { id: 'electronicsKit', label: 'Electronics kit', mode: 'tn' as 'dice' | 'replace' | 'tn', kit: true },
      // v0.78.0 (RULES.BOOK_V78.voiceLocks 'deception'): a recorder or voice synthesizer that fools voice recognition.
      { id: 'voiceDeception', label: 'Voice deception (recorder, synthesizer)', mode: 'deception' as 'dice' | 'replace' | 'tn' | 'deception', kit: false },
    ] as ReadonlyArray<{ id: string; label: string; mode: 'dice' | 'replace' | 'tn' | 'deception'; kit: boolean }>,
    maxTnOff: 2,
    noToolsTn: 2,
    light: { enabled: true, factor: 0.5 },
  },

  /**
   * v0.58.0 characters (all from memory; VERIFY):
   * - notice: a plain Perception test (Intelligence vs `baseTn`, no opponent) with an obviousness table and
   *   what each number of successes reveals; `sense` 'hearing' ignores light and sight modifiers.
   * - time: base time ÷ successes on any skill test (`units` in seconds; the result rounds up to `roundTo` of the unit).
   * - tools: Build/Repair tool levels; each level short of the one the job needs adds `perStepTn`, and no tools
   *   at all when some are needed adds `noneTn` (or blocks with 'block'). `gearRepair`: base time and TN to repair
   *   a damaged weapon or piece of gear, the B/R skill guessed from the weapon's skill (`skillSuffix`).
   * - creation: contacts beyond `freeContacts` and every lifestyle month are paid from Resources at creation.
   * - languages: the native language at Intelligence (free at creation); Read/Write at half the rating, rounded
   *   up; comprehension TN by how complex the speech or text is.
   * - training: time to raise a skill or attribute (house rule `trainingTime`: 'instant' (old) or 'timed');
   *   days = the new rating × `daysPerRating` for the kind; an instructor's Instruction test (TN `instructionTn`,
   *   their rating must reach the new one) divides the time by successes.
   * - negotiation: an opposed Negotiation test moves a job's pay `perNet` per net success, at most `cap` either way.
   * - karmaAward: the GM chapter's team and individual awards (defaults and maximums per row).
   * - notoriety: Notoriety comes off Street Cred for reputation; recognition: an Intelligence test against
   *   `baseTn` − Public Awareness (at least the minimum TN).
   */
  CHARACTERS_V58: {
    notice: {
      baseTn: 4,
      obviousness: [
        { id: 'obvious', label: 'Obvious', value: -2 },
        { id: 'normal', label: 'Normal', value: 0 },
        { id: 'inconspicuous', label: 'Inconspicuous', value: 2 },
        { id: 'hidden', label: 'Hidden', value: 4 },
        { id: 'wellHidden', label: 'Very well hidden', value: 6 },
      ] as ReadonlyArray<{ id: string; label: string; value: number }>,
      // v0.79.0 docs check: the SR2 p. 185 Perception Success Table, four levels (was three: general picture / details / everything).
      reveals: [
        { successes: 1, text: 'Something is there, but little else.' },
        { successes: 2, text: 'Something is definitely there; suspects the kind of thing it is.' },
        { successes: 3, text: 'Knows what kind of thing it is and suspects its exact nature.' },
        { successes: 4, text: 'Knows what it is, but no specifics without further information or examination.' },
      ] as ReadonlyArray<{ successes: number; text: string }>,
    },
    time: {
      units: [
        { id: 'turns', label: 'Combat Turns', seconds: 3 },
        { id: 'minutes', label: 'minutes', seconds: 60 },
        { id: 'hours', label: 'hours', seconds: 3600 },
        { id: 'days', label: 'days', seconds: 86400 },
        { id: 'weeks', label: 'weeks', seconds: 604800 },
      ] as ReadonlyArray<{ id: string; label: string; seconds: number }>,
      roundTo: 0.1,
    },
    tools: {
      levels: [
        { id: 'none', label: 'No tools' },
        { id: 'kit', label: 'Kit' },
        { id: 'shop', label: 'Shop' },
        { id: 'facility', label: 'Facility' },
      ] as ReadonlyArray<{ id: string; label: string }>,
      perStepTn: 2,
      noneTn: 4,
      // v0.92.3 (book alignment): without the tools a Build/Repair job is usually not allowed (Core p. 183; was 'tn', +4).
      none: 'block' as 'tn' | 'block',
      gearRepair: { tn: 4, baseHours: 2, needs: 'kit', skillSuffix: ' B/R', fallbackSkill: 'Electronics B/R', fallbackAttribute: 'intelligence' },
    },
    creation: {
      freeContacts: 2,
      contactCost: { 1: 5000, 2: 10000, 3: 200000 } as Record<number, number>,
      lifestyleMonthsPaid: true,
    },
    languages: {
      nativeAtIntelligence: true,
      readWrite: 'half' as 'half' | 'same',
      complexity: [
        { id: 'simple', label: 'Simple (greetings, directions)', tn: 3 },
        { id: 'everyday', label: 'Everyday talk', tn: 4 },
        { id: 'detailed', label: 'Detailed or technical', tn: 6 },
        { id: 'complex', label: 'Complex or academic', tn: 8 },
      ] as ReadonlyArray<{ id: string; label: string; tn: number }>,
      reveals: [
        { successes: 1, text: 'Gets the gist.' },
        { successes: 2, text: 'Understands most of it.' },
        { successes: 3, text: 'Understands it all, nuance included.' },
      ] as ReadonlyArray<{ successes: number; text: string }>,
    },
    training: {
      // v0.65.0: 'timed' by default (the user, 22 Oct 2026: things that take time wait for it).
      mode: 'timed' as 'instant' | 'timed',
      daysPerRating: { active: 7, knowledge: 3, language: 3, buildRepair: 7, attribute: 14, specialization: 3, concentration: 5 } as Record<string, number>,
      instructionSkill: 'Instruction',
      instructionTn: 4,
      minimumDays: 1,
    },
    negotiation: { skill: 'Negotiation', perNet: 0.1, cap: 0.5, opposedAttribute: 'willpower' },
    karmaAward: {
      team: [
        { id: 'survival', label: 'Survived the run', value: 1, max: 1 },
        { id: 'objectives', label: 'Objectives met', value: 1, max: 3 },
        { id: 'threat', label: 'Threat faced', value: 1, max: 3 },
      ] as ReadonlyArray<{ id: string; label: string; value: number; max: number }>,
      individual: [
        { id: 'roleplaying', label: 'Good roleplaying', value: 1, max: 1 },
        { id: 'courage', label: 'Courage', value: 1, max: 1 },
        { id: 'ideas', label: 'Inspiration and ideas', value: 1, max: 1 },
        { id: 'humor', label: 'Humor', value: 1, max: 1 },
        { id: 'surviving', label: 'Character development', value: 1, max: 1 },
      ] as ReadonlyArray<{ id: string; label: string; value: number; max: number }>,
    },
    notoriety: { offCred: true },
    recognition: { baseTn: 10, attribute: 'intelligence' },
  },

  /**
   * v0.58.0 gear (all from memory; VERIFY):
   * - essenceHoles: Essence lost to removed cyberware stays lost as a hole that new ware fills first (house rule `essenceHoles`).
   * - filtration: air, blood and ingestion filters add their rating to toxin resistance for the vectors listed.
   * - boneLacing: per lacing kind, dice added to Body for damage resistance only, unarmed Power, and weight.
   * - surveillance: bugs, taps and microphones roll their rating against `listenTn` plus an active white-noise
   *   generator's rating; a bug scanner rolls its rating against the bug's rating; a comm jammer blocks bugs,
   *   taps and comcalls when its rating is at least theirs (`jamBeats` 'greaterOrEqual').
   * - optics: worn vision gear gives low-light, thermographic, flare compensation and magnification like cybereyes.
   * - legality: categories, whether a permit covers them, and a fine when caught without one.
   * - visibility: invisible tokens (Foundry's invisible status) for invisibility spells and astral projection;
   *   astral perceivers get the see-invisibility detection mode.
   */
  GEAR_V58: {
    essenceHoles: { enabled: true },
    filtration: {
      kinds: [
        { id: 'air', label: 'Air filtration', vectors: ['inhalation'] },
        { id: 'blood', label: 'Blood filtration', vectors: ['injection', 'contact'] },
        { id: 'ingested', label: 'Ingested-toxin filtration', vectors: ['ingestion'] },
      ] as ReadonlyArray<{ id: string; label: string; vectors: readonly string[] }>,
    },
    boneLacing: {
      kinds: [
        { id: 'plastic', label: 'Plastic', soakDice: 1, unarmedPower: 1, weight: 5 },
        { id: 'aluminum', label: 'Aluminum', soakDice: 2, unarmedPower: 2, weight: 10 },
        { id: 'titanium', label: 'Titanium', soakDice: 3, unarmedPower: 3, weight: 15 },
      ] as ReadonlyArray<{ id: string; label: string; soakDice: number; unarmedPower: number; weight: number }>,
    },
    surveillance: {
      kinds: [
        { id: 'bug', label: 'Bug', listens: true, transmits: true },
        { id: 'tap', label: 'Line tap', listens: true, transmits: true },
        { id: 'laserMic', label: 'Laser microphone', listens: true, transmits: false },
        { id: 'shotgunMic', label: 'Shotgun microphone', listens: true, transmits: false },
        { id: 'bugScanner', label: 'Bug scanner', listens: false, transmits: false },
        { id: 'whiteNoise', label: 'White-noise generator', listens: false, transmits: false },
        { id: 'commJammer', label: 'Comm jammer', listens: false, transmits: false },
      ] as ReadonlyArray<{ id: string; label: string; listens: boolean; transmits: boolean }>,
      listenTn: 4,
      reveals: [
        { successes: 1, text: 'Snatches of the conversation.' },
        { successes: 2, text: 'Most of what is said.' },
        { successes: 3, text: 'Every word, clearly.' },
      ] as ReadonlyArray<{ successes: number; text: string }>,
      jamBeats: 'greaterOrEqual' as 'greaterOrEqual' | 'greater',
    },
    optics: { magnificationMax: 3 },
    legality: {
      categories: [
        { id: '', label: '(not set)', permit: false, fine: 0 },
        { id: 'legal', label: 'Legal', permit: false, fine: 0 },
        { id: 'permit', label: 'Needs a permit', permit: true, fine: 1000 },
        { id: 'restricted', label: 'Restricted', permit: true, fine: 5000 },
        { id: 'forbidden', label: 'Forbidden', permit: false, fine: 25000 },
      ] as ReadonlyArray<{ id: string; label: string; permit: boolean; fine: number }>,
      fineTimesRating: false,
    },
    /** `projecting`: the projecting magician's token is taken as the astral form (hidden); false = it stays the body. */
    visibility: { enabled: true, projecting: true, status: 'invisible', astralDetection: 'seeInvisibility', concealKinds: ['invisibility', 'improvedInvisibility'] as readonly string[] },
  },
  /**
   * v0.65.0: things that take time wait for it (rules/waiting.ts). `enabled` and each area are on by default
   * (the user, 22 Oct 2026); only player characters wait (not NPCs, and not in the creation wizard).
   * - areas.magic: learning or raising a spell, a spell design, a meditation or thesis ordeal, enchanting,
   *   summoning an elemental, an ally ritual, a ward, building or raising a library, circle or lodge, cleansing.
   * - areas.gear: buying gear (its Availability time: the base time ÷ successes after a find test, or the base
   *   time × `orderFactor` when bought straight from the Add window).
   * - areas.repairs: repairing gear, cyberware and a cyberdeck.
   * - areas.matrix: writing a program, building or upgrading a deck part.
   * - areas.vehicles: repairing a vehicle, installing a vehicle mod.
   * - minimumHours: nothing that waits takes less (0 = as the rule says).
   * Training (raising attributes and skills) is RULES.CHARACTERS_V58.training.mode; ritual preparation is
   * RULES.MAGIC_V39.ritualStages.waitForPrep ('block' by default). VERIFY all times against the books.
   */
  WAITING: {
    enabled: true,
    areas: { magic: true, gear: true, repairs: true, matrix: true, vehicles: true } as Record<'magic' | 'gear' | 'repairs' | 'matrix' | 'vehicles', boolean>,
    orderFactor: 1,
    minimumHours: 0,
  },
  /** v0.61.0 rules gaps: blocks live in rules/config61/*.ts (VERIFY). */
  HEALTH_V61,
  MAGIC_V61,
  COMBAT_V61,
  STREET_V61,
  SECURITY_V61,
  /** v0.70.0: the v0.69.0 review's fixes (house-rule switches; rules/config70.ts). */
  FIXES_V70,
  /** v0.71.0: the v0.69.0 review's common rules holes (house-rule switches; rules/config71.ts). */
  FIXES_V71,
  /** v0.72.0: health, cyberware and bioware (REVIEW-v0.69 O8–O12; house-rule switches; rules/config72/health.ts). */
  HEALTH_V72,
  /** v0.72.0: combat and gear (REVIEW-v0.69 O1–O7; rules/config72/combat.ts). */
  COMBAT_V72,
  /** v0.72.0: magic and critters (REVIEW-v0.69 O13–O21; rules/config72/magic.ts). */
  MAGIC_V72,
  /** v0.73.0: cross-cutting bookkeeping (REVIEW-v0.69 O39–O43; rules/config73/crosscut.ts). */
  CROSSCUT_V73,
  /** v0.73.0: Matrix and rigging (O22–O27; rules/config73/netrig.ts). */
  NETRIG_V73,
  /** v0.73.0: drone links, mount points, missiles (O28; rules/config73/drones.ts). */
  DRONES_V73,
  /** v0.73.0: characters, skills and the street (O29–O38; rules/config73/characters.ts). */
  CHARACTERS_V73,
  /** v0.78.0: the book check's rules changes and the owner's decisions (house-rule switches; rules/config78.ts). */
  BOOK_V78,
  /** v0.79.0: the verified fixes to the official SR2 rules (SRII, SR2 core, Rigger 2; house-rule switches; rules/config79.ts). */
  DOCS_V79,
  /** v0.80.0: the "SR2E Unified Rules Revamp" rules source's switches (book way shipped; rules/config80.ts). */
  URR_V80,
  /** v0.91.0: the shop (finding before buying, the retry wait; house-rule switches; rules/config91.ts). */
  SHOP_V91,
  /** v0.91.5: legality in the shop and permits (house-rule switches; rules/config91.ts). */
  SHOP_V915,
  /** v0.91.6: finding through contacts and fixers (house-rule switches; rules/config91.ts). */
  SHOP_V916,
  /** v0.91.8: spell formulas (house-rule switches; rules/config91.ts). */
  FORMULA_V918,
  /** v0.92.0: the layered Magic Pool and Sorcery's narrow uses (house-rule switches; rules/config92.ts). */
  MAGIC_V920,
  /** v0.92.1: the flexible record sheet (custom tweaks, Carried, accessories from the description, the advising wizard; rules/config92.ts). */
  SHEET_V921,
  CLOCK_V922,
  /** v0.92.3: book alignment, Core mechanics and characters (rules/config923/core.ts). */
  CORE_V923,
  /** v0.92.3: book alignment, Combat (rules/config923/combat.ts). */
  COMBAT_V923,
  /** v0.92.3: book alignment, Damage, health and hazards (rules/config923/health.ts). */
  HEALTH_V923,
  /** v0.92.3: book alignment, Sorcery (rules/config923/sorcery.ts). */
  SORCERY_V923,
  /** v0.92.3: book alignment, Conjuring, spirits, astral, initiation, adepts, allies and critters (rules/config923/spirits.ts). */
  SPIRITS_V923,
  /** v0.92.3: book alignment, The Matrix (rules/config923/matrix.ts). */
  MATRIX_V923,
  /** v0.92.3: book alignment, Vehicles, rigging and building security (rules/config923/vehicles.ts). */
  VEHICLES_V923,
  /** v0.92.3: book alignment, Gear, cyberware and bioware (rules/config923/gear.ts). */
  GEAR_V923,
} as const;

export type RangeBand = keyof typeof RULES.RANGE_TN;
export type DamageLevel = keyof typeof RULES.BOXES_PER_LEVEL;
export type CyberGrade = keyof typeof RULES.GRADE_ESSENCE_MULTIPLIER;
