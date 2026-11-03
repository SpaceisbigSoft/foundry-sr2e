/**
 * v0.61.0 combat-kit rule values (VERIFY: all from memory, none checked against the book).
 * Read through RULES.COMBAT_V61 (rules/kit.ts); house rules may override any key.
 *
 * - skillGear: gear/cyberware `skillMods` rows that add dice or TN to a named skill.
 *   `stack` 'best' = only the best item counts (most dice, lowest TN); 'sum' = every item adds up.
 * - hearing: cyberears and deafness for Perception by ear. `ampPerRating` × the best hearing
 *   amplification rating (capped at `ampMax`) is added to the TN; `adeptHearingTn` for the adept
 *   Improved Senses (hearing) power; `dampenerBlocksDeafening`: a damper stops deafening effects
 *   (flash-bangs, sonic attacks); `noiseTn`: background noise row by id (quiet/noisy/loud).
 *   Deafness itself is RULES.STATUSES.deaf.hearingTn (config.ts).
 * - superiorPosition: melee modifier (v0.79.0: ON by default, SR2 Melee Modifiers Table): the side holding it
 *   adds `holder` to its TN, the other side adds `against` (0 by the book; was 1).
 * - launcher: grenade launcher minimum arming range. `defaultMinRange` (metres) is the suggested
 *   value for a new launcher (`minRange` on the weapon; 0 = none). `dud` closer than that:
 *   'noBlast' = the grenade hits but doesn't explode; 'block' = the attack isn't allowed.
 * - stunBaton: charges on a full stun baton (`charges`), and what an empty one does: 'club' = hits
 *   as a plain club (no stun), 'block' = can't attack with the stun effect at all.
 * - monowhip: when a `selfHit` weapon hits the wielder: 'defended' (v0.78.0, the book, Core Rules) = only when a
 *   melee attack fails solely because of the defender's Combat Pool successes; the wielder then rolls the weapon's
 *   skill against `tn` and is struck on 0 successes, with impact armor × `armorMultiplier`; 'botch' = on a botch
 *   (all ones; the v0.61.0 default); 'miss' = on any missed attack.
 * - smoke: grenade cloud radius (metres) and how long it lingers (Combat Turns); `kinds` maps a
 *   grenade kind id to the cloud type ('smoke' blocks normal/low-light sight, 'thermal' also thermographic).
 */
export const COMBAT_V61 = {
  skillGear: {
    stack: 'best' as 'best' | 'sum',
  },
  hearing: {
    ampPerRating: -1,
    ampMax: 3,
    adeptHearingTn: -1,
    dampenerBlocksDeafening: true,
    noiseTn: { quiet: 0, noisy: 2, loud: 4 } as Readonly<Record<string, number>>,
  },
  // v0.79.0 docs check: on by default, −1 for the holder only, SR2 Melee Modifiers Table (was enabled false, against 1).
  superiorPosition: {
    enabled: true,
    holder: -1,
    against: 0,
  },
  launcher: {
    defaultMinRange: 5,
    dud: 'noBlast' as 'noBlast' | 'block',
  },
  stunBaton: {
    charges: 10,
    emptyAs: 'club' as 'club' | 'block',
  },
  monowhip: {
    /** v0.78.0 book check: 'defended' (was 'botch'): see the header. */
    on: 'defended' as 'defended' | 'botch' | 'miss',
    /** v0.78.0: the wielder's Armed Combat test after a defended miss (0 successes = struck), and the impact armor × against the whip. */
    tn: 6,
    armorMultiplier: 0.5,
  },
  smoke: {
    radiusMetres: 10,
    lingerTurns: 20,
    kinds: { smoke: 'smoke', thermalSmoke: 'thermal' } as Readonly<Record<string, 'smoke' | 'thermal'>>,
  },
} as const;
