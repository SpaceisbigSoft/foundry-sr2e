/**
 * v0.92.0 rule values. Read through RULES.MAGIC_V920. The first choice of each switch is the new way (the default), the
 * other puts the old behaviour back.
 *
 * MAGIC_V920 (the owner's decisions, 2 and 12 Nov 2026; an interpretation of SR2 pp. 70, 84–85 and Awakenings p. 95,
 * with the Companion's split Karma Pools as precedent; rules/magicpool.ts):
 * - poolLayers: 'layered' — the Spell Pool's dice come in layers: Sorcery's rating for any magical action, then the
 *   concentration's extra dice only for actions inside it, then the specialization's only for actions inside that
 *   (each layer is the rating above the one below). 'flat': one pool of Sorcery's rating (the old way).
 * - castNarrow: 'on' — a casting test (and dispelling) rolls the concentration's or specialization's rating when the
 *   action falls inside it, like other skills. 'off': always Sorcery's rating (the old way).
 * - drainNarrow: 'on' — the narrow dice left may pay for the Drain of that casting. 'off': Drain takes general dice only.
 */
export const MAGIC_V920 = {
  poolLayers: 'layered' as 'layered' | 'flat',
  castNarrow: 'on' as 'on' | 'off',
  drainNarrow: 'on' as 'on' | 'off',
};
