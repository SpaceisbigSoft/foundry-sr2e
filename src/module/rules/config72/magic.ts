/**
 * v0.72.0: the magic and critters holes from the v0.69.0 review (docs/REVIEW-v0.69.md, section 3, O13–O21).
 * Every fix has a switch, so the GM can put the old behaviour back; numbers recalled from memory are marked
 * VERIFY. Read through RULES.MAGIC_V72 (house rules mutate this object in place); the pure logic is in
 * rules/sorcery.ts.
 *
 * - masterDies (O13): what a bound spirit does when its summoner dies, by kind ('free' | 'depart' | 'none';
 *   'legacy' = MAGIC_V61.masterDies, the old one-mode-for-all). `byKind` false = the old way for every kind.
 *   Nature spirits, watchers and toxic spirits just go; allies go free; elementals go free (VERIFY: SR2 may
 *   send them home); insect spirits stay put (their hive and host body; the GM decides). VERIFY
 * - adeptAstral (O14): a physical adept with astral perception fights on the astral plane with `skill`
 *   (Unarmed Combat; a better martial art stands in when `martialArts`), defaulting to `fallback`, with the
 *   `pool` (Combat Pool), and active killing hands set the damage level (`killingHands`). `enabled` false =
 *   the old way (Sorcery, defaulting to Willpower, with the Spell Pool an adept doesn't have). VERIFY
 * - metamagicLimits (O15): which techniques a physical adept or an aspected magician may learn.
 *   `adept`: the adept's list (VERIFY: centering and masking as remembered from the Grimoire). An aspected
 *   magician can't take a technique of the art they lack (`sorceryTechniques` need spellcasting,
 *   `conjuringTechniques` need conjuring). `mode` 'block' | 'warn' | 'off' (the old way).
 * - dispelDrainPool (O16): Spell Pool dice may go to dispelling drain (as to casting drain); false = none.
 * - barrierSpells (O17): Mana Barrier and Physical Barrier raise a barrier actor (a `mana barrier` or
 *   `physical barrier`) at `rating` ('force' | 'successes'), drawn on the map like a ward (a region of
 *   `radius` metres: 'magic' = the caster's Magic, 'force' = the spell's Force, or `fixedMetres`), that falls
 *   when the spell is dropped or dispelled. A spell is a barrier spell by its `barrier` field, or by its name
 *   when `matchByName`. VERIFY (the rating and the size)
 * - innateSpells (O18): a spirit or critter (an NPC, or a spell marked innate) without a Sorcery skill casts
 *   its spells with `spiritDice` (spirits: Force) or `critterDice` (critters: Magic, else Essence) as the skill.
 *   `drain` 'normal' (resisted like any caster's) or 'none'. `enabled` false = the old way (Sorcery needed).
 *   VERIFY
 * - wardPresence (O19): what a ward stops on the map: dual-natured critters (`dualNatured`) and materialized
 *   spirits (`materializedSpirits`) have an astral presence too, so a ward stops them; an astrally perceiving
 *   magician only when `perceiving` (off: their body walks through). A physical barrier stops anything with a
 *   physical body. `enabled` false = the old way (only projecting forms and unmaterialized spirits).
 * - astralWounds (O20): a projecting magician's wounds (astral damage marks the same monitor):
 *   'both' = on tests and Initiative (SR2 as remembered), 'neither' = on neither, 'legacy' = tests only (the
 *   old way). VERIFY
 * - anchoring (O21): anchoring a spell costs `karmaPerForce` Good Karma per point of Force (like quickening),
 *   paid when it is anchored and not refunded when released. VERIFY
 * - ally (O21): an ally's Grimoire abilities: `castDice` (an ally casts the spells it knows with its Force as
 *   Sorcery), the Good Karma to teach it a spell (`spellKarmaPerForce` × the spell's Force) and the Karma for
 *   each ability in `abilities` (sense link, astral gateway). VERIFY (all of it)
 */
export const MAGIC_V72 = {
  masterDies: {
    byKind: true,
    kinds: {
      nature: 'depart',
      watcher: 'depart',
      toxic: 'depart',
      elemental: 'free',
      ally: 'free',
      insect: 'none',
      other: 'legacy',
    } as Record<string, 'free' | 'depart' | 'none' | 'legacy'>,
  },
  adeptAstral: {
    // v0.77.0 book check (SR2 core): astral perception lets an adept fight with Sorcery, as a magician does (switched off).
    // The Unarmed Combat rule below is SR3's; it stays available as a house rule (switch on). Was on.
    enabled: false,
    skill: 'Unarmed Combat',
    fallback: 'quickness' as 'quickness' | 'strength' | 'willpower',
    martialArts: true,
    pool: 'combat' as 'combat' | 'spell' | 'none',
    killingHands: true,
  },
  metamagicLimits: {
    mode: 'block' as 'block' | 'warn' | 'off',
    adept: ['centering', 'masking'] as string[],
    sorceryTechniques: ['quickening', 'dispelling', 'shielding', 'reflecting', 'anchoring'] as string[],
    conjuringTechniques: ['invoking', 'possessing'] as string[],
  },
  dispelDrainPool: true,
  barrierSpells: {
    enabled: true,
    matchByName: true,
    rating: 'force' as 'force' | 'successes',
    radius: 'magic' as 'magic' | 'force' | 'fixed',
    fixedMetres: 5,
  },
  innateSpells: {
    enabled: true,
    spiritDice: 'force' as 'force' | 'magic',
    critterDice: 'magic' as 'magic' | 'essence',
    drain: 'normal' as 'normal' | 'none',
  },
  wardPresence: {
    enabled: true,
    dualNatured: true,
    materializedSpirits: true,
    perceiving: false,
  },
  astralWounds: 'both' as 'both' | 'neither' | 'legacy',
  anchoring: { enabled: true, karmaPerForce: 1 },
  ally: {
    enabled: true,
    castDice: 'force' as 'force' | 'intelligence',
    spellKarmaPerForce: 1,
    abilities: [
      { id: 'senseLink', label: 'Sense link (the magician uses the ally’s senses)', karma: 1 },
      { id: 'astralGateway', label: 'Astral gateway (the ally takes the magician onto the astral plane)', karma: 1 },
    ] as Array<{ id: string; label: string; karma: number }>,
  },
};
