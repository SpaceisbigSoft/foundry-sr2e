/**
 * v0.92.3 book alignment: Sorcery. Read through RULES.SORCERY_V923. Every value here was checked against the SR2 books
 * (book and page in each comment). Each switch's first choice is the book's way (the default); the other puts the
 * old v0.92.2 behaviour back.
 *
 * Where the "SR2E Unified Rules Revamp" has its own switch for the same rule (RULES.URR_V80.mag*), the Revamp's
 * source patch already turns it to the book's way, so the Revamp behaves as before; where the Revamp's own rule
 * differs from the book (coreEssenceFloor, magWardDrain), the Revamp's rule still wins while it is on.
 *
 * Casting (Core pp. 128–133)
 * - magicFromEssence: Magic falls by every point or part of a point of Essence lost, whatever it was (Core p. 47:
 *   Magic = Essence rounded down; Ka-Ge 7 Q21: a datajack on Essence 6 / Magic 1 leaves Magic 0) / 'v922': the
 *   MAGIC_ESSENCE_MODE setting (cap at Essence rounded up).
 * - spellTie: a tie on a resisted spell goes to the caster at the spell's minimum effect (combat spells: L); spells
 *   with no minimum effect still need a net success (Core p. 131) / 'v922': no effect.
 * - ruleOfOneDrain: all ones on the Spell Success Test raise the Drain TN by this (Core p. 131: +2) / 0.
 * - restrictedSpells: an exclusive spell takes effect at Force +2, a fetish spell +1 (reusable) or +2 (expendable),
 *   Drain at the normal Force and no Drain TN change (Core p. 133; Grimoire p. 111) / 'v922': Drain TN −2 / −1.
 * - sustainCap: at most Sorcery-rating spells sustained by the magician (Core p. 128) / 'v922': no limit.
 * - sustainProjecting: no sustaining while projecting: self-sustained spells drop when projection starts and a
 *   sustained spell can't be cast while projecting (Core p. 128) / 'v922': allowed.
 * - spellSituation: visibility modifiers apply to every spell, and partial cover too (Core pp. 129–131; touch spells
 *   take only injury) / 'v922': visibility on elemental spells only, no cover.
 * - areaTargets: an area spell's dice are rolled once and counted against each target's own TN (Core p. 130) /
 *   'v922': one test against the highest (MAGIC.areaTn) target's TN.
 * - elementalTn: a ranged damaging manipulation's base TN (Core p. 130; Grimoire p. 112: 4) / 0 = the spell's own TN.
 * - treatTn: the Treat spell's TN base (TN = this − Essence; Core p. 155: 8) / 0 = the Heal base (SPELLCRAFT.healing).
 *
 * Learning and design
 * - learning: learning a spell rolls Sorcery + Magical Theory vs 2 × Force (Core p. 132) / 'v922': Sorcery vs Force.
 *   The formula or teacher needed and the teacher's help stay as in v0.91.8 (FORMULA_V918).
 * - formulaAloneTn: learning from a formula with no teacher: + this TN (Grimoire p. 114: +2) / 0.
 * - design: designing a spell: Magical Theory (rated at most the library or lodge, + 1 die per 2 points it is
 *   higher) vs 2 × Force − Magic + the drain modifiers, base time by drain level L 6 / M 18 / S 30 / D 60 days
 *   (+50% with a higher site) ÷ successes; drain: detection base M, area +1 level, touch −1 TN and −1 level,
 *   sustained +1 TN (detection, health, illusion) (Grimoire pp. 114–115, 117–121) / 'v922': OCCULT.design.
 *
 * Foci and enchanting
 * - spellFocus: a specific spell focus adds its dice to casting and Drain; a category focus to casting, Drain and
 *   resisting that category's spells (Core p. 137) / 'v922': casting only.
 * - spellLock: a spell lock (sustaining focus) holds one spell of any Force (Core p. 138) / 'v922': Force ≤ rating.
 * - weaponFocusKarma: bonding a weapon focus costs this × rating whatever its size (Grimoire p. 27 Magical Item
 *   Bonding Table: 6) / 0 = BOOK_V78.focusKarma small 4 / large 5.
 * - focusAddiction: the test is Magic vs the active foci total; failed, 2D6 ≤ Magic loses 1 Magic, and 2 Magic lost
 *   this way bring a focus geas (+2 TN on magic without a focus) (Awakenings p. 103) / 'v922': MAGIC_V39.addiction.
 * - enchanting: making a focus: TN by type (specific spell 4, category 6, spirit 6, power 8, weapon 6) + its rating,
 *   a spell lock 5; base time 30 days ÷ successes (Grimoire pp. 25–26) / 'v922': ENCHANTING.tasks.focus.
 *
 * Ritual sorcery and wards (Core pp. 133–136; Grimoire p. 92 with Grimoire II errata)
 * - ritualPool: the other members' Magic Pools join the leader's (the spotter's doesn't) / 'v922': ½ each member's
 *   Sorcery (RITUAL.teamDiceFraction).
 * - ritualTeam: no combat spells; at most as many members as the lowest Sorcery among them; a mage needs a hermetic
 *   circle / 'v922': none of these.
 * - ritualMaterials: materials by category (detection and illusion 100¥, health 500¥, manipulation 1,000¥ × Force) /
 *   'v922': MAGIC_V39.ritualStages.materialsPerForce.
 * - ritualResist: the target resists against the higher of Force and the leader's Sorcery / 'v922': the Force.
 * - ritualSpotter: the astral spotter resists Drain too / 'v922': no Drain.
 * - ward: Sorcery vs Force, rating = Force, Drain (Force × successes) L, never Physical, Force at most 2 × the
 *   leader's Magic, Force hours (not ÷ successes), lasting days = successes / 'v922': MAGIC_V56.ward (Conjuring,
 *   Force ÷ 2 M).
 * - siteCost: a library costs rating² × its price per rating (Core p. 123: CD 1,000¥), a hermetic circle takes hours =
 *   its rating (Core p. 124) / 'v922': price × rating, a day per rating.
 *
 * Initiation and metamagic (Grimoire pp. 37–52)
 * - initiation: the first initiation is Grade 0 (stored as grade 0 with the `initiated` flag): the Karma is
 *   (6 + the new grade) × the multiplier, rounded down, and Magic rises by the grade (the first initiation adds none) /
 *   'v922': the first initiation is grade 1, the Karma rounded up. A stored grade keeps its meaning: a character
 *   initiated before v0.92.3 keeps its grade and its Magic (its next initiation is the grade after).
 * - dispelling: only spells of Force ≤ the grade; TN = the higher of Force and the quickening Karma; every 2
 *   successes take 1 Force off (0 = broken); Drain as the spell's own drain code / 'v922': 1 spell success per
 *   success, Drain M at Force ÷ 2.
 * - shielding: spell defense dice of a shielding initiate also raise the caster's TN by as many (Grimoire p. 45) /
 *   'v922': dice only.
 * - centering: a centering test, never automatic, at the TN less the grade; every 2 successes take 1 off the
 *   penalties (Grimoire pp. 43–44) / 'v922': MAGIC_V56.centering (auto: grade points off).
 * - geasa: a broken geas doesn't take Magic away: it adds +2 TN per broken geas to non-astral magical tests
 *   (Grimoire p. 52) / 'v922': an unmet geas takes away the Magic it protects.
 * - magicLoss: the Magic loss test loses a point on 2D6 ≤ Magic (Core p. 115; Awakenings p. 99) / 'v922': below.
 *
 * Elementals (Core p. 141)
 * - elementalAid: an aiding elemental is an auxiliary pool of Force dice: each die used lowers what is left, the
 *   service is paid once when the aid starts, and at 0 it is gone / 'v922': its full Force every cast, a service
 *   each time.
 *
 * Spell effects (Core p. 155)
 * - increaseReflexes: Increase Reflexes can't boost anyone with cybernetic initiative dice / 'v922': the better of
 *   the spell and the ware counts (MAGIC_V56.spellEffects.reflexesExclusive).
 *
 * Detection (Core p. 128)
 * - detectionRange: a sense spell's range comes from a separate Force test vs 4: successes × Magic metres /
 *   'v922': Magic × Force metres (MAGIC_V56.detectionRange).
 */
export const SORCERY_V923 = {
  magicFromEssence: 'book' as 'book' | 'v922',
  spellTie: 'book' as 'book' | 'v922',
  ruleOfOneDrain: 2 as number,
  restrictedSpells: 'book' as 'book' | 'v922',
  /** Read only under restrictedSpells 'book': Force bonuses (Core p. 133). */
  restrictedForce: { exclusive: 2, fetishReusable: 1, fetishExpendable: 2 },
  sustainCap: 'book' as 'book' | 'v922',
  sustainProjecting: 'book' as 'book' | 'v922',
  spellSituation: 'book' as 'book' | 'v922',
  areaTargets: 'book' as 'book' | 'v922',
  elementalTn: 4 as number,
  treatTn: 8 as number,
  learning: 'book' as 'book' | 'v922',
  formulaAloneTn: 2 as number,
  design: 'book' as 'book' | 'v922',
  /** Read only under design 'book': base design days by drain level (Grimoire p. 115). */
  designDays: { L: 6, M: 18, S: 30, D: 60 } as Record<string, number>,
  spellFocus: 'book' as 'book' | 'v922',
  spellLock: 'book' as 'book' | 'v922',
  weaponFocusKarma: 6 as number,
  focusAddiction: 'book' as 'book' | 'v922',
  enchanting: 'book' as 'book' | 'v922',
  /** Read only under enchanting 'book': the base TN by focus type (+ rating; a spell lock flat 5) and the days. */
  enchantTn: { spellSpecific: 4, spellCategory: 6, spirit: 6, power: 8, weapon: 6, sustaining: 5 } as Record<string, number>,
  enchantDays: 30 as number,
  ritualPool: 'book' as 'book' | 'v922',
  ritualTeam: 'book' as 'book' | 'v922',
  ritualMaterials: 'book' as 'book' | 'v922',
  ritualResist: 'book' as 'book' | 'v922',
  ritualSpotter: 'book' as 'book' | 'v922',
  ward: 'book' as 'book' | 'v922',
  siteCost: 'book' as 'book' | 'v922',
  initiation: 'book' as 'book' | 'v922',
  dispelling: 'book' as 'book' | 'v922',
  shielding: 'book' as 'book' | 'v922',
  centering: 'book' as 'book' | 'v922',
  geasa: 'book' as 'book' | 'v922',
  magicLoss: 'book' as 'book' | 'v922',
  elementalAid: 'book' as 'book' | 'v922',
  detectionRange: 'book' as 'book' | 'v922',
  increaseReflexes: 'book' as 'book' | 'v922',
};

const BV: string[] = ['book', 'v922'];

/** The house-rules window's rows for SORCERY_V923 (spread into settings.ts HOUSE_RULES). */
export const HOUSE_SORCERY_V923: Array<{ path: string; section: string; type: 'number' | 'boolean' | 'select'; choices?: string[]; step?: number }> = [
  { section: 'characters', path: 'SORCERY_V923.magicFromEssence', type: 'select', choices: BV },
  { section: 'magicAndCritters', path: 'SORCERY_V923.spellTie', type: 'select', choices: BV },
  { section: 'magicAndCritters', path: 'SORCERY_V923.ruleOfOneDrain', type: 'number' },
  { section: 'magicAndCritters', path: 'SORCERY_V923.restrictedSpells', type: 'select', choices: BV },
  { section: 'magicAndCritters', path: 'SORCERY_V923.sustainCap', type: 'select', choices: BV },
  { section: 'magicAndCritters', path: 'SORCERY_V923.sustainProjecting', type: 'select', choices: BV },
  { section: 'magicAndCritters', path: 'SORCERY_V923.spellSituation', type: 'select', choices: BV },
  { section: 'magicAndCritters', path: 'SORCERY_V923.areaTargets', type: 'select', choices: BV },
  { section: 'magicAndCritters', path: 'SORCERY_V923.elementalTn', type: 'number' },
  { section: 'magicAndCritters', path: 'SORCERY_V923.treatTn', type: 'number' },
  { section: 'magicAndCritters', path: 'SORCERY_V923.learning', type: 'select', choices: BV },
  { section: 'magicAndCritters', path: 'SORCERY_V923.formulaAloneTn', type: 'number' },
  { section: 'magicAndCritters', path: 'SORCERY_V923.design', type: 'select', choices: BV },
  { section: 'magicAndCritters', path: 'SORCERY_V923.spellFocus', type: 'select', choices: BV },
  { section: 'magicAndCritters', path: 'SORCERY_V923.spellLock', type: 'select', choices: BV },
  { section: 'magicAndCritters', path: 'SORCERY_V923.weaponFocusKarma', type: 'number' },
  { section: 'magicAndCritters', path: 'SORCERY_V923.focusAddiction', type: 'select', choices: BV },
  { section: 'magicAndCritters', path: 'SORCERY_V923.enchanting', type: 'select', choices: BV },
  { section: 'magicAndCritters', path: 'SORCERY_V923.enchantDays', type: 'number' },
  { section: 'magicAndCritters', path: 'SORCERY_V923.ritualPool', type: 'select', choices: BV },
  { section: 'magicAndCritters', path: 'SORCERY_V923.ritualTeam', type: 'select', choices: BV },
  { section: 'magicAndCritters', path: 'SORCERY_V923.ritualMaterials', type: 'select', choices: BV },
  { section: 'magicAndCritters', path: 'SORCERY_V923.ritualResist', type: 'select', choices: BV },
  { section: 'magicAndCritters', path: 'SORCERY_V923.ritualSpotter', type: 'select', choices: BV },
  { section: 'magicAndCritters', path: 'SORCERY_V923.ward', type: 'select', choices: BV },
  { section: 'magicAndCritters', path: 'SORCERY_V923.siteCost', type: 'select', choices: BV },
  { section: 'magicAndCritters', path: 'SORCERY_V923.initiation', type: 'select', choices: BV },
  { section: 'magicAndCritters', path: 'SORCERY_V923.dispelling', type: 'select', choices: BV },
  { section: 'magicAndCritters', path: 'SORCERY_V923.shielding', type: 'select', choices: BV },
  { section: 'magicAndCritters', path: 'SORCERY_V923.centering', type: 'select', choices: BV },
  { section: 'magicAndCritters', path: 'SORCERY_V923.geasa', type: 'select', choices: BV },
  { section: 'magicAndCritters', path: 'SORCERY_V923.magicLoss', type: 'select', choices: BV },
  { section: 'magicAndCritters', path: 'SORCERY_V923.elementalAid', type: 'select', choices: BV },
  { section: 'magicAndCritters', path: 'SORCERY_V923.detectionRange', type: 'select', choices: BV },
  { section: 'magicAndCritters', path: 'SORCERY_V923.increaseReflexes', type: 'select', choices: BV },
];
