/**
 * v0.80.0, the "SR2E Unified Rules Revamp" rules source (area: health-social). Read through RULES.URR_V80; the GM picks the
 * source in the world setting "Rules source" (settings.ts). Two exports:
 * - URR_V80_HEALTH_SOCIAL: this area's new switches and numbers. Their shipped values are the SR2E Book Rules (the mode off),
 *   so nothing changes unless the GM picks the Unified Rules Revamp.
 * - URR80_PATCH_HEALTH_SOCIAL: RULES paths → the value the Unified Rules Revamp uses (existing paths, or 'URR_V80.<key>').
 *   Applied under the GM's own house rules, which still win.
 * Source: the Unified Rule Revamp (URR v1.2), cited as "URR" below; a rule marked "house rule for the Revamp"
 * is not in the URR.
 *
 * The rules (Revamp way / book way = shipped / source). Pure functions: rules/urr80-health-social.ts.
 *
 * Damage, bleeding and first aid
 * - Stun overflow (STUN_OVERFLOW_PER_PHYSICAL_BOX, patched): Stun past a full track goes onto Physical box for box /
 *   book: 2 Stun to a Physical box. Source: URR.
 * - hsDeathPastOverflow: dead only when the damage is MORE than 10 + Body (one box past a full Overflow row) / book:
 *   dead when the Overflow row is full. Source: URR.
 * - hsBleedMinutes: a dying character loses another box every this many minutes of game time (10) / book: 0 = every
 *   (Body) Combat Turns (RULES.CONDITIONS.dying). Source: URR.
 * - hsSelfStabilise, hsSelfStabiliseTn: when first aid on a dying patient fails, the patient rolls natural Body vs 10,
 *   no modifiers; a success stops the bleeding / book: no such test. Source: URR.
 * - hsTraumaPatch, hsTraumaPatchTn: 'bodyTest' — a trauma patch gives an extra self-stabilisation test, natural Body
 *   vs 4 + the rating of any dermal armor or blood filter / book 'stabilise': it stabilises outright. Source: URR.
 *   The URR's +2 on a later permanent injury test is not built.
 * - hsStunRecovery, hsStunRecoveryTn: 'urr' — Stun recovery rolls the higher of Body and Willpower vs 2 + all wound
 *   modifiers (no care rows); 1 hour per box ÷ successes as before / book: Body vs 2/4/6/8 by wound, no wound
 *   modifiers. Source: URR.
 * - hsFirstAid: 'level' — any success lowers the wound one level (to the lowest box of the next level down; a Light
 *   wound clears); a Deadly Physical wound can only be stabilised / book 'boxes': 1 box per success, at most half.
 *   Source: URR.
 * - hsFirstAidTime, hsFirstAidMinutes: the first aid card says how long the treatment takes: 10 / 20 / 30 minutes for
 *   Light / Moderate / Serious ÷ successes / book: not shown. Source: URR.
 * - hsFirstAidRetry: first aid may be tried again on the same wound by a healer with a higher Biotech rating than any
 *   before / book: once per wound. Source: URR.
 * - hsMagicLossUntreated: first aid on a magician without the +2 "patient is a magician" modifier calls for a Magic
 *   loss test / book: only a Deadly wound does. Source: URR. (The 2D6 compare is the magic area's.)
 * - hsDeadlyIntensive: a Deadly wound's healing stage needs intensive care / book (v0.79.0): any medical attention.
 *   Source: URR.
 * - Elective surgery (BIOWARE.surgery.trauma.levels, patched): up to 0.4 Essence a Moderate wound, up to 0.99 Serious,
 *   1 or more Deadly / book: 0.5 L, 1.5 M, 3 S, more D. The switch itself (BIOWARE.surgery.trauma.enabled) stays the
 *   GM's. Source: URR.
 * - hsOverdose: a second dose stages the overdose damage up one level; every dose after adds +1 Power / book: +1 Power
 *   per active dose, no stage. Source: URR.
 *
 * Physical feats
 * - Troll running multiplier (METATYPES.types.troll.run, patched): × 2 / book: × 3. Source: URR.
 * - hsBreathHold, hsBreathSecondsPerBody: a character holds their breath 30 seconds per point of Body before drowning
 *   or suffocation tests count / book: none. Source: URR. (Its bonus Body test is not built.)
 * - hsAthletics: 'urr' — Fitness = (Strength + Quickness) ÷ 2: climbing 1 m per success, at most Fitness; jumping
 *   Fitness × 0.5 m standing, × 1 running (round up), +1 Fitness per 2 successes; swimming 25% of the walking (or
 *   running) speed with +1 Quickness per success / book 'book': 2 m per success climbing and swimming, 1 m per success
 *   jumping (× 2 running). Source: URR.
 * - Climbing TNs (STREET.athletics.climb, patched): 3 / 5 / 8 / 14 by surface / book: 2 / 4 / 6 / 8. Source: URR.
 * - hsFalling: 'urr' — no damage up to 2 m; Power = half the metres (round down); level by height (2-4 m L, 4-6 M,
 *   6-8 S, 8+ D); a Body test, no armor / book: Power = metres, Serious, half impact armor. Source: URR.
 *
 * Perception and social
 * - Perception sight rows (DOCS_V79.perceptionSightRows, patched): the book rows plus walking −2, tiptoeing +2, well
 *   camouflaged +4, poorly camouflaged −2 / book: the five book rows. Source: URR.
 * - Perception modifiers (STREET.perception, patched): distracted, sound (gunfire, grenade, yelling, rooms and floors
 *   away), smell, touch and taste rows / book: the house rows (distracted, noisy, crowded, searching). Source: URR
 *   (perception modifiers).
 * - Social attributes (SOCIAL.skills, patched): Negotiation vs Intelligence (bargaining over pay stays vs Willpower) /
 *   book: vs Willpower. Source: URR.
 * - Bargaining (STREET.haggle.percentPerNet and STREET.fence.percentPerNet, patched): 10% per net success / book: 5%.
 *   Source: URR. The seller's TN is core's (URR_V80.coreHaggleTn: the buyer's
 *   Intelligence, the URR).
 * - hsVisibleArmor, hsVisibleArmorTn: the social dialog offers "visible armor in a luxury setting" +2 / book: no row.
 *   Source: URR.
 */
export const URR_V80_HEALTH_SOCIAL = {
  hsDeathPastOverflow: false as boolean,
  /** 0 = the book's (Body) Combat Turns per box. */
  hsBleedMinutes: 0,
  hsSelfStabilise: false as boolean,
  hsSelfStabiliseTn: 10,
  hsTraumaPatch: 'stabilise' as 'stabilise' | 'bodyTest',
  hsTraumaPatchTn: 4,
  hsStunRecovery: 'book' as 'book' | 'urr',
  hsStunRecoveryTn: 2,
  hsFirstAid: 'boxes' as 'boxes' | 'level',
  hsFirstAidTime: false as boolean,
  hsFirstAidMinutes: { L: 10, M: 20, S: 30 } as Record<'L' | 'M' | 'S', number>,
  hsFirstAidRetry: false as boolean,
  hsMagicLossUntreated: false as boolean,
  hsDeadlyIntensive: false as boolean,
  hsOverdose: 'book' as 'book' | 'urr',
  hsBreathHold: false as boolean,
  hsBreathSecondsPerBody: 30,
  hsAthletics: 'book' as 'book' | 'urr',
  hsFalling: 'book' as 'book' | 'urr',
  hsVisibleArmor: false as boolean,
  hsVisibleArmorTn: 2,
};

export const URR80_PATCH_HEALTH_SOCIAL: Record<string, unknown> = {
  'STUN_OVERFLOW_PER_PHYSICAL_BOX': 1,
  'URR_V80.hsDeathPastOverflow': true,
  'URR_V80.hsBleedMinutes': 10,
  'URR_V80.hsSelfStabilise': true,
  'URR_V80.hsTraumaPatch': 'bodyTest',
  'URR_V80.hsStunRecovery': 'urr',
  'URR_V80.hsFirstAid': 'level',
  'URR_V80.hsFirstAidTime': true,
  'URR_V80.hsFirstAidRetry': true,
  'URR_V80.hsMagicLossUntreated': true,
  'URR_V80.hsDeadlyIntensive': true,
  'BIOWARE.surgery.trauma.levels': [{ upTo: 0.4, level: 'M' }, { upTo: 0.99, level: 'S' }, { upTo: 99, level: 'D' }],
  'URR_V80.hsOverdose': 'urr',
  'METATYPES.types.troll.run': 2,
  'URR_V80.hsBreathHold': true,
  'URR_V80.hsAthletics': 'urr',
  'STREET.athletics.climb': [
    { id: 'easy', label: 'Easy (chain-link fence, ladder)', tn: 3 },
    { id: 'rough', label: 'Rough or broken (rough stone, trees)', tn: 5 },
    { id: 'smooth', label: 'Flat (brick, masonry, hard rock)', tn: 8 },
    { id: 'sheer', label: 'Sheer (metal, seamless concrete, glass)', tn: 14 },
  ],
  'URR_V80.hsFalling': 'urr',
  'DOCS_V79.perceptionSightRows': [
    { id: 'veryObvious', label: 'Action very obvious (running)', value: -4 },
    { id: 'actionObvious', label: 'Action obvious (walking)', value: -2 },
    { id: 'brightlyColored', label: 'Object brightly colored', value: -2, alias: 'obvious' },
    { id: 'poorCamouflage', label: 'Target poorly camouflaged or conspicuous', value: -2 },
    { id: 'normal', label: 'Normal', value: 0 },
    { id: 'slightlyObvious', label: 'Action slightly obvious (tiptoeing)', value: 2 },
    { id: 'partlyHidden', label: 'Object partially hidden', value: 2, alias: 'inconspicuous' },
    { id: 'notObvious', label: 'Action not obvious (hiding)', value: 4, alias: 'hidden' },
    { id: 'camouflage', label: 'Target well camouflaged', value: 4 },
    { id: 'verySmall', label: 'Very small object', value: 6, alias: 'wellHidden' },
  ],
  'STREET.perception': [
    { id: 'distracted', label: 'Observer distracted', value: 2 },
    { id: 'gunshot', label: 'Sound: a single gunshot', value: -2 },
    { id: 'burst', label: 'Sound: burst fire', value: -4 },
    { id: 'burstSilenced', label: 'Sound: silenced burst fire', value: -2 },
    { id: 'auto', label: 'Sound: full auto', value: -6 },
    { id: 'autoSilenced', label: 'Sound: silenced full auto', value: -4 },
    { id: 'grenade', label: 'Sound: grenade blast', value: -8 },
    { id: 'yelling', label: 'Sound: yelling', value: -2 },
    { id: 'roomAway', label: 'Sound one room away', value: 1 },
    { id: 'roomsAway', label: 'Sound a few rooms away', value: 3 },
    { id: 'roomsFar', label: 'Sound many rooms away', value: 5 },
    { id: 'floorsAway', label: 'Sound floors away', value: 6 },
    { id: 'odorObvious', label: 'Smell: the odor is obvious', value: -4 },
    { id: 'otherOdors', label: 'Smell: other odors around', value: 2 },
    { id: 'temperature', label: 'Touch: extreme temperature', value: -4 },
    { id: 'gloves', label: 'Touch: wearing gloves', value: 2 },
    { id: 'tasteObvious', label: 'Taste: the taste is obvious', value: -4 },
    { id: 'hasCold', label: 'Taste: perceiver has a cold', value: 2 },
  ],
  'SOCIAL.skills': { Etiquette: 'charisma', Negotiation: 'intelligence', Leadership: 'intelligence', Interrogation: 'willpower', Intimidation: 'willpower', Instruction: 'intelligence' },
  'STREET.haggle.percentPerNet': 10,
  'STREET.fence.percentPerNet': 10,
  'URR_V80.hsVisibleArmor': true,
};
