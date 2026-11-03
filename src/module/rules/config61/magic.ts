/**
 * v0.61.0 magic rule values (VERIFY: all from memory). Read through RULES.MAGIC_V61; house rules may
 * override any key. Pure data; used by rules/glamour.ts.
 *
 * - invisibility: each observer resists an Invisibility / Improved Invisibility spell with `attribute`
 *   dice vs TN = spell Force (`resist` false = nobody resists); they see through when their successes
 *   beat the caster's (`beat` 'greater' = strictly more, 'greaterOrEqual' = ties go to the observer).
 *   `astralSeesMana` / `astralSeesPhysical`: an astral perceiver ignores the mana (Invisibility) /
 *   physical (Improved Invisibility) version.
 * - spiritInitiative: per spirit kind, the Reaction bonus and extra initiative dice (low confidence;
 *   unknown kinds use `other`). An unmaterialized spirit acts in astral space when
 *   `astralWhenUnmaterialized`, adding `astralBonus` to Reaction.
 * - totems: the berserk resistance test (`attribute` dice vs `tn`; rage lasts `turnsBase` − successes
 *   Combat Turns), presets by totem name (`berserk` '' | 'wounded' | 'combat'; `daylightTn` added to
 *   tests in daylight), and `daylight` ('arcanum' = between MAGIC_V56.natureSpirits sunrise and sunset,
 *   or explicit `fromHour` / `toHour` when `source` is 'hours').
 * - holdPowers: what paralysis, petrification and binding do to their target (status id, duration
 *   rule, armor bonus, whether actions/movement are blocked, the attribute that breaks a binding).
 * - attributeSpells: `exclusiveWithCyber` (on since the v0.77.0 book check; off = the old way) = an Increase [Attribute] spell adds
 *   nothing to an attribute that cyberware/bioware already raises.
 * - links: following a magical link (sustained spell, bound spirit, active focus) back to its
 *   magician: base `tn`, `forceModifier` TN per point of the link's Force (0 = none), time
 *   `baseHours` ÷ successes.
 * - exclusive: what sustaining an exclusive spell blocks (casting, sustaining others, all tests).
 * - repeating: prompt for repeating powers once per Combat Turn.
 * - masterDies: what a bound spirit does when its summoner dies ('free' | 'depart' | 'none').
 * - insect: insect spirits need a host body for flesh form; the flesh form adds `fleshAttributeBonus`
 *   (half Force, Force or nothing) to the host's Body, Quickness and Strength.
 */
export const MAGIC_V61 = {
  invisibility: {
    resist: true,
    attribute: 'intelligence' as 'intelligence' | 'willpower',
    beat: 'greater' as 'greater' | 'greaterOrEqual',
    astralSeesMana: true,
    astralSeesPhysical: true,
    kinds: ['invisibility', 'improvedInvisibility'] as ReadonlyArray<string>,
  },
  spiritInitiative: {
    byKind: {
      // v0.77.0 book check (SR2 core): every spirit +10 Initiative when manifest, +20 in astral form (was nature/elemental +10, astral +20 more).
      nature: { reaction: 10, dice: 0 },
      elemental: { reaction: 10, dice: 0 },
      ally: { reaction: 10, dice: 0 },
      free: { reaction: 10, dice: 0 },
      insect: { reaction: 10, dice: 0 },
      other: { reaction: 10, dice: 0 },
    } as Record<string, { reaction: number; dice: number }>,
    astralWhenUnmaterialized: true,
    astralBonus: 10, // v0.77.0: +10 more in astral form (total +20; was 20)
  },
  totems: {
    berserk: { attribute: 'willpower' as 'willpower' | 'charisma' | 'intelligence', tn: 4, turnsBase: 3 },
    presets: [
      { name: 'Bear', berserk: 'wounded', daylightTn: 0 },
      { name: 'Shark', berserk: 'wounded', daylightTn: 0 },
      { name: 'Wolf', berserk: 'combat', daylightTn: 0 },
      { name: 'Owl', berserk: '', daylightTn: 2 },
    ] as ReadonlyArray<{ name: string; berserk: '' | 'wounded' | 'combat'; daylightTn: number }>,
    daylight: { source: 'arcanum' as 'arcanum' | 'hours', fromHour: 6, toHour: 18 },
  },
  holdPowers: {
    paralysis: { status: 'paralysis', turnsPer: 'successes' as 'successes' | 'force', blocksActions: true, armorBonus: 0 },
    petrification: { status: 'sr2ePetrified', armorBonus: 0, blocksActions: true },
    binding: { status: 'restrain', breakAttribute: 'strength' as 'strength' | 'body' | 'quickness', blocksMovement: true, blocksActions: false, armorBonus: 0 },
  },
  attributeSpells: { exclusiveWithCyber: true }, // v0.77.0 book check: Increase [Attribute] doesn't affect cybered attributes (was off)
  links: {
    tn: 4,
    forceModifier: 0,
    baseHours: 1,
    kinds: [
      { id: 'spell', label: 'Sustained spell' },
      { id: 'spirit', label: 'Bound spirit' },
      { id: 'focus', label: 'Active focus' },
    ] as ReadonlyArray<{ id: string; label: string }>,
  },
  exclusive: { blocksCasting: true, blocksSustainingOthers: true, blocksAllTests: false },
  repeating: { autoPrompt: true },
  masterDies: 'free' as 'free' | 'depart' | 'none',
  insect: { needsHost: true, fleshAttributeBonus: 'halfForce' as 'halfForce' | 'force' | 'none' },
} as const;
