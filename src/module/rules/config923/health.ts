/**
 * v0.92.3 book alignment: Damage, health and hazards. Read through RULES.HEALTH_V923. Every value here was checked against the SR2 books
 * (book and page in each comment). Each switch's first choice is the book's way (the default); the other puts the
 * old v0.92.2 behaviour back.
 *
 * Several of these rules already exist as Unified Rules Revamp switches (RULES.URR_V80.hs…). Under the Book Rules
 * source, the switch here gives the book's way; under the Revamp source only the Revamp's own switch counts, so the
 * Revamp behaves exactly as before (rules/health923.ts).
 *
 * Damage and healing (Core pp. 110–115)
 * - death: 'natural' — dead only when the Overflow is MORE than the natural Body (unaugmented by cyberware or magic;
 *   Will to Live boxes still count) (Core p. 111) / 'total': dead when the Overflow reaches the augmented Body.
 * - bleed: 'tenMinutes' — a dying character, unattended, takes another box every 10 minutes (Core pp. 111, 115) /
 *   'bodyTurns': every (Body) Combat Turns (RULES.CONDITIONS.dying).
 * - stunRecovery: 'book' — the higher of Body and Willpower vs 2 + the injury modifiers (Stun and Physical); no care,
 *   home lifestyle or fee helps (Core p. 112) / 'old': Body vs 2/4/6/8 by wound with the care rows.
 * - firstAid: 'level' — any success lowers the wound one Damage Level, never more; a Deadly wound can only be
 *   stabilised (Core p. 115) / 'boxes': 1 box per success, at most half.
 * - firstAidStun: 'physical' — first aid treats Physical damage only; Stun recovers by rest (Core p. 115) /
 *   'both': first aid on either track.
 * - firstAidTime: 'shown' — the first aid card gives the treatment time, 10/20/30 minutes ÷ successes (Core p. 115) /
 *   'hidden'.
 * - selfStabilise: 'test' — when first aid on a dying patient fails, the patient rolls natural Body vs 10 (Core
 *   p. 115) / 'none'.
 * - firstAidRetry: 'better' — a healer with a better Biotech rating may try first aid again (professional help, Core
 *   p. 115) / 'once': once per wound.
 * - traumaPatch: 'bodyTest' — a trauma patch gives an extra natural Body test vs 4 + dermal armor / blood filter
 *   rating (Core p. 115) / 'stabilise': it stabilises outright.
 * - permanentDamage: 'test' — a Deadly Physical wound calls for a Body (4) test (dermal armor counts, +2 after a trauma
 *   patch): 0 successes an attribute point lost, 1 a limb or eye; the card says what and the GM applies it (Core p. 114)
 *   / 'none'.
 * - magicLoss: 'atOrBelow' — Magic is lost when 2D6 is less than or equal to the current Magic (Core p. 115) /
 *   'below': only below it.
 * - magicLossUntreated: 'test' — a magician treated without the +2 "patient is a magician" modifier tests for Magic
 *   loss, twice for a Deadly wound (Core p. 115) / 'none': only a Deadly wound does.
 * - surgeryMagicLoss: 'drastic' — a magician through drastic invasive surgery (1+ Essence; bioware over 1.5 Body Index)
 *   tests for Magic loss after healing (Core p. 114; Shadowtech pp. 5–13, bionetics) / 'none'.
 * - surgeryBands: 'book' — the surgery wound (when RULES.BIOWARE.surgery.trauma is on) by size: cyberware up to 0.4
 *   Essence Moderate, under 1 Serious, 1 or more Deadly (Core p. 114); bioware up to 0.25 Body Index Light, 0.75
 *   Moderate, 1.5 Serious, more Deadly (Shadowtech pp. 5–13, bionetics) / 'table': RULES.BIOWARE.surgery.trauma.levels.
 *
 * Magical healing
 * - treatTn: 'book' — Treat is 8 − Essence, Heal 10 − Essence (Core p. 155; SRII errata) / 'same': every healing
 *   spell RULES.SPELLCRAFT.healing.base − Essence.
 * - bodyIndexHealing: 'magical' — ½ the Body Index (round down) adds to the TN of magical healing only (Shadowtech
 *   pp. 5–13, bionetics; Ka-Ge 12 Q2) / 'natural': to first aid and natural healing, not to spells.
 * - spellsHealStun: 'no' — no healing spell recovers Stun (Core p. 112) / 'yes': a heal spell may target Stun.
 *
 * Hazards
 * - falling: 'book' — Deadly, Power ½ the metres (round down), ½ impact armor, and an Athletics test vs the metres
 *   whose successes each take 1 off the Power (Fields of Fire p. 76) / 'old': RULES.HAZARDS.falling.
 * - breathHold: 'body' — a character holds their breath `breathSecondsPerBody` seconds per point of Body before
 *   drowning or suffocation counts (Fields of Fire p. 76) / 'none'.
 * - drowning: 'boxes' — out of breath: 1 unresisted Stun box an action phase, then Physical, until dead past the
 *   Overflow (Cyberpirates); suffocation the same / 'test': Body vs 4 +1 a turn, Moderate Stun.
 * - burning: 'rising' — burning clothes do 6M at the end of the first Combat Turn, +2 Power each turn after (Grimoire
 *   p. 113 fire effect) / 'flat': RULES.COMBAT.burning.amount each turn.
 * - shock: 'disorient' — a hit from a stun weapon disorients the target (+2 to every TN) for Power − ½ impact armor −
 *   the successes of Body or Willpower (the higher) vs 4 Combat Turns (Core p. 103) / 'none'.
 *
 * Edges, flaws, bioware and gear
 * - lowPainTolerance: 'level' — wounds count one level higher for the wound modifiers (Companion) / 'boxes':
 *   HEALTH_V72.qualities.lowPainTolerance.extraBoxes more boxes.
 * - dwarfResistance: 'disease' — a dwarf's extra dice count against disease only (Core Racial Modifications Table, pp. 42–48) / 'both': toxins too.
 * - respirator: 'immune' — a respirator is its own air supply: no inhaled toxin reaches the wearer (Core p. 244) /
 *   'dice': + its rating as dice.
 *
 * Addiction (Shadowtech pp. 87–89)
 * - addiction: 'book' — an addict needs a dose every Body × 4 hours (physical) or Willpower × 4 hours (mental);
 *   forced withdrawal is +3 to every TN; kicking the habit is Willpower vs the rating +1 (mental), +3 (physical) or
 *   +4 (both) at any time, then recovery at +2 while the rating drops 1 every 3 days (it is over when it is back to
 *   the drug's base rating); every Strength-rating doses add +1 to the character's rating / 'old': withdrawal after
 *   RULES.HEALTH.addiction.withdrawalHours at its withdrawalTn, kicking after kickDays clean vs the rating.
 */
export const HEALTH_V923 = {
  death: 'natural' as 'natural' | 'total',
  bleed: 'tenMinutes' as 'tenMinutes' | 'bodyTurns',
  /** The book's minutes per box while dying unattended (Core p. 111). */
  bleedMinutes: 10,
  stunRecovery: 'book' as 'book' | 'old',
  /** The Stun recovery base TN (Core p. 112). */
  stunRecoveryTn: 2,
  firstAid: 'level' as 'level' | 'boxes',
  firstAidStun: 'physical' as 'physical' | 'both',
  firstAidTime: 'shown' as 'shown' | 'hidden',
  /** First Aid Table treatment times in minutes (Core p. 115). */
  firstAidMinutes: { L: 10, M: 20, S: 30 } as Record<'L' | 'M' | 'S', number>,
  selfStabilise: 'test' as 'test' | 'none',
  /** The self-stabilisation TN (natural Body, Core p. 115). */
  selfStabiliseTn: 10,
  firstAidRetry: 'better' as 'better' | 'once',
  traumaPatch: 'bodyTest' as 'bodyTest' | 'stabilise',
  /** The trauma patch's Body test base TN (Core p. 115). */
  traumaPatchTn: 4,
  permanentDamage: 'test' as 'test' | 'none',
  /** Deadly Wounds and Permanent Damage (Core p. 114): Body vs `tn`, +`traumaPatchTn` after a trauma patch. */
  permanentDamageTest: { tn: 4, traumaPatchTn: 2 },
  magicLoss: 'atOrBelow' as 'atOrBelow' | 'below',
  magicLossUntreated: 'test' as 'test' | 'none',
  surgeryMagicLoss: 'drastic' as 'drastic' | 'none',
  surgeryBands: 'book' as 'book' | 'table',
  treatTn: 'book' as 'book' | 'same',
  /** Treat's base TN (Core p. 155: 8 − Essence; Heal stays RULES.SPELLCRAFT.healing.base). */
  treatBase: 8,
  bodyIndexHealing: 'magical' as 'magical' | 'natural',
  spellsHealStun: 'no' as 'no' | 'yes',
  falling: 'book' as 'book' | 'old',
  breathHold: 'body' as 'body' | 'none',
  /** Seconds of held breath per point of Body (Fields of Fire p. 76). */
  breathSecondsPerBody: 30,
  drowning: 'boxes' as 'boxes' | 'test',
  burning: 'rising' as 'rising' | 'flat',
  /** Burning clothes (Grimoire p. 113): `power``level` at the end of the first turn, +`powerPerTurn` each turn after. */
  burningDamage: { power: 6, level: 'M' as 'L' | 'M' | 'S' | 'D', powerPerTurn: 2 },
  shock: 'disorient' as 'disorient' | 'none',
  /** Shock weapons (Core p. 103): the resistance TN and the TN modifier while disoriented. */
  shockTest: { tn: 4, testsTn: 2 },
  lowPainTolerance: 'level' as 'level' | 'boxes',
  dwarfResistance: 'disease' as 'disease' | 'both',
  respirator: 'immune' as 'immune' | 'dice',
  addiction: 'book' as 'book' | 'old',
  /** Shadowtech p. 87: hours per point of Body (physical) or Willpower (mental) between doses. */
  addictionBook: {
    hoursPerPoint: 4,
    forcedWithdrawalTn: 3,
    recoveryTn: 2,
    kickTn: { mental: 1, physical: 3, both: 4 } as Record<'mental' | 'physical' | 'both', number>,
    recoveryDaysPerPoint: 3,
  },
};

/** The house-rules window's rows for HEALTH_V923 (spread into settings.ts HOUSE_RULES). */
export const HOUSE_HEALTH_V923: Array<{ path: string; section: string; type: 'number' | 'boolean' | 'select'; choices?: string[]; step?: number }> = [
  { section: 'characters', path: 'HEALTH_V923.death', type: 'select', choices: ['natural', 'total'] },
  { section: 'characters', path: 'HEALTH_V923.bleed', type: 'select', choices: ['tenMinutes', 'bodyTurns'] },
  { section: 'characters', path: 'HEALTH_V923.stunRecovery', type: 'select', choices: ['book', 'old'] },
  { section: 'characters', path: 'HEALTH_V923.firstAid', type: 'select', choices: ['level', 'boxes'] },
  { section: 'characters', path: 'HEALTH_V923.firstAidStun', type: 'select', choices: ['physical', 'both'] },
  { section: 'characters', path: 'HEALTH_V923.firstAidTime', type: 'select', choices: ['shown', 'hidden'] },
  { section: 'characters', path: 'HEALTH_V923.selfStabilise', type: 'select', choices: ['test', 'none'] },
  { section: 'characters', path: 'HEALTH_V923.firstAidRetry', type: 'select', choices: ['better', 'once'] },
  { section: 'characters', path: 'HEALTH_V923.traumaPatch', type: 'select', choices: ['bodyTest', 'stabilise'] },
  { section: 'characters', path: 'HEALTH_V923.permanentDamage', type: 'select', choices: ['test', 'none'] },
  { section: 'magicAndCritters', path: 'HEALTH_V923.magicLoss', type: 'select', choices: ['atOrBelow', 'below'] },
  { section: 'magicAndCritters', path: 'HEALTH_V923.magicLossUntreated', type: 'select', choices: ['test', 'none'] },
  { section: 'magicAndCritters', path: 'HEALTH_V923.surgeryMagicLoss', type: 'select', choices: ['drastic', 'none'] },
  { section: 'characters', path: 'HEALTH_V923.surgeryBands', type: 'select', choices: ['book', 'table'] },
  { section: 'magicAndCritters', path: 'HEALTH_V923.treatTn', type: 'select', choices: ['book', 'same'] },
  { section: 'magicAndCritters', path: 'HEALTH_V923.bodyIndexHealing', type: 'select', choices: ['magical', 'natural'] },
  { section: 'magicAndCritters', path: 'HEALTH_V923.spellsHealStun', type: 'select', choices: ['no', 'yes'] },
  { section: 'characters', path: 'HEALTH_V923.falling', type: 'select', choices: ['book', 'old'] },
  { section: 'characters', path: 'HEALTH_V923.breathHold', type: 'select', choices: ['body', 'none'] },
  { section: 'characters', path: 'HEALTH_V923.drowning', type: 'select', choices: ['boxes', 'test'] },
  { section: 'melee', path: 'HEALTH_V923.burning', type: 'select', choices: ['rising', 'flat'] },
  { section: 'rangedCombat', path: 'HEALTH_V923.shock', type: 'select', choices: ['disorient', 'none'] },
  { section: 'characters', path: 'HEALTH_V923.lowPainTolerance', type: 'select', choices: ['level', 'boxes'] },
  { section: 'characters', path: 'HEALTH_V923.dwarfResistance', type: 'select', choices: ['disease', 'both'] },
  { section: 'gear', path: 'HEALTH_V923.respirator', type: 'select', choices: ['immune', 'dice'] },
  { section: 'characters', path: 'HEALTH_V923.addiction', type: 'select', choices: ['book', 'old'] },
  // v0.92.3: existing values moved to the book's, not in the window before (set them back here).
  { section: 'characters', path: 'HEALTH_V72.qualities.sensitiveSystem.bodyIndexMultiplier', type: 'number', step: 0.25 },
];
