/**
 * v0.92.3 book alignment: Conjuring, spirits, astral, adepts, allies and critters (initiation, metamagic, geasa and
 * wards: RULES.SORCERY_V923). Read through RULES.SPIRITS_V923. Every value here was checked against the SR2 books
 * (book and page in each comment). Each switch's first choice is the book's way (the default); the other puts the
 * old v0.92.2 behaviour back.
 */
export const SPIRITS_V923 = {
  /** Conjuring Drain Table (Core p. 140): L below half Charisma, M up to Charisma, S above, D above twice; S and D Physical / v0.92.2: L up to half, S up to 1.5 ×, Physical over Magic. */
  conjDrain: 'book' as 'book' | 'v922',
  /** Totem and spirit-focus dice also resist conjuring Drain (Core pp. 139–140) / not. */
  conjDrainDice: 'on' as 'on' | 'off',
  /** A manifest spirit's immunity counts only against firearms, ranged weapons (not bows, throwing weapons) and explosions (Core p. 142) / every non-magical attack. */
  immunityScope: 'book' as 'book' | 'v922',
  /** A mundane weapon against a manifest spirit: Willpower instead of the skill, no Combat Pool (Core p. 142) / the skill and pool. */
  mundaneVsSpirits: 'willpower' as 'willpower' | 'v922',
  /** A magician attacked by a spirit may resist with Conjuring instead of the attribute (Core p. 143) / never. */
  conjuringDefense: 'on' as 'on' | 'off',
  /** Banishing: net successes per point of Force (or Magic) lost (Core p. 143: 2; v0.92.2: 1). */
  banishPerPoint: 2 as number,
  /** The spirit winning a banishing round takes 1 Magic per 2 net successes from the banisher (Core p. 143) / nothing. */
  banishBackfire: 'book' as 'book' | 'v922',
  /** Banishing drain: none (Core p. 143 lists no drain) / conjuring drain at the spirit's Force (v0.92.2). */
  banishDrain: 'none' as 'none' | 'conjuring',
  /** Force or Magic lost in banishing comes back at 1 point an hour (Core p. 143) / lost for good. */
  banishRecovery: 'hourly' as 'hourly' | 'v922',
  /** Control contests (Core p. 143): challenger vs Force + 2 against the holder's Conjuring vs Force; an uncontrolled spirit as banishing, 2 net = 1 service / the v0.92.2 banishing-style contest. */
  controlContest: 'book' as 'book' | 'v922',
  /** Banishing your own spirit adds Charisma dice; another's summoner doesn't help (Core p. 143) / the summoner's Conjuring helps the spirit. */
  banishSummoner: 'charisma' as 'charisma' | 'v922',
  /** Binding a free spirit by its true name (Grimoire pp. 78–79): Conjuring vs Force + Spirit Energy, 1 success binds, no services counted, no Karma / opposed, net = services, Karma. */
  trueName: 'book' as 'book' | 'v922',
  /** A summoned spirit with no template takes the Spirit Table's attributes for its type (Core p. 144) / Force for every attribute. */
  spiritTable: 'book' as 'book' | 'v922',
  /** An elemental sustaining a spell holds it Force Combat Turns (Core p. 142) / Force hours (MAGIC_V39.sustainLimit). */
  elementalSustain: 'book' as 'book' | 'v922',
  /** Astral projection (Core pp. 146–147): the body loses 1 Essence every full hour from the start / MAGIC_EXTRA.projection's free 2 × Essence hours, then 1 per hour or part. */
  projection: 'book' as 'book' | 'v922',
  /** The Astral Combat Pool (Intelligence + Willpower + Charisma) ÷ 2 for magicians in astral combat (Core p. 147) / the Spell Pool (ASTRAL.attackPool). */
  astralPool: 'book' as 'book' | 'v922',
  /** Initiates add their grade to astral Reaction and the Astral Combat Pool (Grimoire pp. 38, 91) / not. */
  astralGrade: 'book' as 'book' | 'v922',
  /** A magician's astral damage: unarmed (Charisma)L, weapon focus (Charisma + rating ÷ 2)M (Core p. 147) / Charisma M, a focus adding dice. */
  astralDamage: 'book' as 'book' | 'v922',
  /** Reading an aura (Core p. 145; Grimoire p. 90): the basics at a glance, emotions at 2, cyberware at 4, never exact Essence or Magic / MAGIC_V56.assensing. */
  assensing: 'book' as 'book' | 'v922',
  /** Astral tracking (Core p. 149): −2 TN when the trail's Force is at most the tracker's Sorcery, +2 when higher / no such modifier. */
  tracking: 'book' as 'book' | 'v922',
  /** A barrier that beats an astral intruder hurts it: (rating)L, +1 level per 2 net successes (Core p. 148) / nothing. */
  barrierBacklash: 'book' as 'book' | 'v922',
  /** The asceticism ordeal lowers a Physical attribute only (Grimoire p. 40) / any attribute. */
  asceticism: 'physical' as 'physical' | 'any',
  /** Allies (Grimoire pp. 67–71): 5 × current Force Karma per Force above 1, 1 Magic point, (Force + day)L Stun each ritual day / Karma × Force, no Magic. */
  allyCost: 'book' as 'book' | 'v922',
  /** Regeneration: a Deadly wound calls for 1D6, a 1 (or 2 from fire or explosions) kills (Core p. 219) / it always heals. */
  regenDeath: 'book' as 'book' | 'v922',
};

/** The house-rules window's rows for SPIRITS_V923 (spread into settings.ts HOUSE_RULES). */
export const HOUSE_SPIRITS_V923: Array<{ path: string; section: string; type: 'number' | 'boolean' | 'select'; choices?: string[]; step?: number }> = [
  { section: 'magicAndCritters', path: 'SPIRITS_V923.conjDrain', type: 'select', choices: ['book', 'v922'] },
  { section: 'magicAndCritters', path: 'SPIRITS_V923.conjDrainDice', type: 'select', choices: ['on', 'off'] },
  { section: 'magicAndCritters', path: 'SPIRITS_V923.immunityScope', type: 'select', choices: ['book', 'v922'] },
  { section: 'magicAndCritters', path: 'SPIRITS_V923.mundaneVsSpirits', type: 'select', choices: ['willpower', 'v922'] },
  { section: 'magicAndCritters', path: 'SPIRITS_V923.conjuringDefense', type: 'select', choices: ['on', 'off'] },
  { section: 'magicAndCritters', path: 'SPIRITS_V923.banishPerPoint', type: 'number' },
  { section: 'magicAndCritters', path: 'SPIRITS_V923.banishBackfire', type: 'select', choices: ['book', 'v922'] },
  { section: 'magicAndCritters', path: 'SPIRITS_V923.banishDrain', type: 'select', choices: ['none', 'conjuring'] },
  { section: 'magicAndCritters', path: 'SPIRITS_V923.banishRecovery', type: 'select', choices: ['hourly', 'v922'] },
  { section: 'magicAndCritters', path: 'SPIRITS_V923.controlContest', type: 'select', choices: ['book', 'v922'] },
  { section: 'magicAndCritters', path: 'SPIRITS_V923.banishSummoner', type: 'select', choices: ['charisma', 'v922'] },
  { section: 'magicAndCritters', path: 'SPIRITS_V923.trueName', type: 'select', choices: ['book', 'v922'] },
  { section: 'magicAndCritters', path: 'SPIRITS_V923.spiritTable', type: 'select', choices: ['book', 'v922'] },
  { section: 'magicAndCritters', path: 'SPIRITS_V923.elementalSustain', type: 'select', choices: ['book', 'v922'] },
  { section: 'magicAndCritters', path: 'SPIRITS_V923.projection', type: 'select', choices: ['book', 'v922'] },
  { section: 'magicAndCritters', path: 'ASTRAL.initiativeBonus', type: 'number' },
  { section: 'magicAndCritters', path: 'SPIRITS_V923.astralPool', type: 'select', choices: ['book', 'v922'] },
  { section: 'magicAndCritters', path: 'SPIRITS_V923.astralGrade', type: 'select', choices: ['book', 'v922'] },
  { section: 'magicAndCritters', path: 'SPIRITS_V923.astralDamage', type: 'select', choices: ['book', 'v922'] },
  { section: 'magicAndCritters', path: 'SPIRITS_V923.assensing', type: 'select', choices: ['book', 'v922'] },
  { section: 'magicAndCritters', path: 'SPIRITS_V923.tracking', type: 'select', choices: ['book', 'v922'] },
  { section: 'magicAndCritters', path: 'TRACKING.baseHours', type: 'number' },
  { section: 'magicAndCritters', path: 'SPIRITS_V923.barrierBacklash', type: 'select', choices: ['book', 'v922'] },
  { section: 'magicAndCritters', path: 'SPIRITS_V923.asceticism', type: 'select', choices: ['physical', 'any'] },
  { section: 'magicAndCritters', path: 'SPIRITS_V923.allyCost', type: 'select', choices: ['book', 'v922'] },
  { section: 'magicAndCritters', path: 'SPIRITS_V923.regenDeath', type: 'select', choices: ['book', 'v922'] },
];
