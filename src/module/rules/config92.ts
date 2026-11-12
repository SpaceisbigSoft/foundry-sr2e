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

/**
 * v0.92.1 rule values (the flexible record sheet; the owner's choices, 2 and 12 Nov 2026). Read through RULES.SHEET_V921.
 * The first choice of each switch is the new way (the default), the other puts the old behaviour back.
 * - tweaks: 'on' — the custom tweaks on items (rules/tweaks.ts) count. 'off': they are kept but ignored.
 * - carried: 'on' — a weapon, armor or gear not ticked Carried has no weight, isn't found by a search and can't be used,
 *   drawn or worn. 'off': the tick is ignored (everything counts as carried, the old way).
 * - accessories: 'auto' — a weapon's description is read for accessories when it arrives or its description changes
 *   (rules/accessories.ts); only fields still at their default are filled. 'off': never read.
 * - wizard: 'advise' — the creation wizard warns (a metatype or magic the priorities don't pay for, an attribute above the
 *   creation maximum, gear over the budget) but never refuses. 'block': the old way (choices greyed out, clamped, refused).
 * - ratingLock: 'queue' — after creation a player may type a higher rating (a warning says it skipped Spend Karma) unless
 *   the GM's approval queue is on; then the lock holds. 'always': the old lock, queue or not.
 */
export const SHEET_V921 = {
  tweaks: 'on' as 'on' | 'off',
  carried: 'on' as 'on' | 'off',
  accessories: 'auto' as 'auto' | 'off',
  wizard: 'advise' as 'advise' | 'block',
  ratingLock: 'queue' as 'queue' | 'always',
};

/**
 * v0.92.2 (the owner, 12 Nov 2026): a big jump of world time outside combat (a calendar module setting the date, a GM
 * moving the clock weeks on). Read through RULES.CLOCK_V922.
 * - bigJump: 'ask' — the GM is asked whether it counts as time passed (drugs, healing, upkeep, training and timers run)
 *   or only changes the date: then the system's own clock moves by the whole days less (rules/clock.ts), so everything
 *   keeps its time left and the time of day stays the calendar's; the hours left over count. 'count': every change of
 *   world time counts as time passed (the old way).
 * - bigJumpDays: how big a jump is big, in days, either way.
 */
export const CLOCK_V922 = {
  bigJump: 'ask' as 'ask' | 'count',
  bigJumpDays: 7,
};
