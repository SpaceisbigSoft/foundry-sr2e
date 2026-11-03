export interface Attributes {
  body: number;
  quickness: number;
  strength: number;
  charisma: number;
  intelligence: number;
  willpower: number;
}

/** Reaction = (Quickness + Intelligence) / 2, rounded down, plus any bonus. */
export function reaction(a: Pick<Attributes, 'quickness' | 'intelligence'>, bonus = 0): number {
  return Math.floor((a.quickness + a.intelligence) / 2) + bonus;
}

/** Combat Pool = (Quickness + Intelligence + Willpower) / 2, rounded down. VERIFY against your book. */
export function combatPool(a: Pick<Attributes, 'quickness' | 'intelligence' | 'willpower'>): number {
  return Math.floor((a.quickness + a.intelligence + a.willpower) / 2);
}

/** Spell Pool = (Intelligence + Willpower + Magic) / 3, rounded down. VERIFY against your book. */
export function spellPool(
  a: Pick<Attributes, 'intelligence' | 'willpower'>,
  magic: number,
): number {
  if (magic <= 0) return 0;
  return Math.floor((a.intelligence + a.willpower + magic) / 3);
}

export interface DerivedStats {
  reaction: number;
  combatPool: number;
  spellPool: number;
}

export function deriveStats(
  a: Attributes,
  opts: { magic?: number; reactionBonus?: number } = {},
): DerivedStats {
  return {
    reaction: reaction(a, opts.reactionBonus ?? 0),
    combatPool: combatPool(a),
    spellPool: spellPool(a, opts.magic ?? 0),
  };
}
