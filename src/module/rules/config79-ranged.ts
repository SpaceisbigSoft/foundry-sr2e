/**
 * v0.79.0 (ranged): the verified fixes for ranged combat, initiative and surprise. The old code differed from the
 * official SR2 rules on each of these, and each cites its official source (an SRII table or
 * page). Read through
 * RULES.DOCS_V79; every behaviour change is a house-rule switch: the first choice is the book's way (the default),
 * the other puts the old behaviour back. Rules without an official source are not here: see docs/VERIFY.md ("Verified fixes", "Not changed") and the
 * Unified Rules Revamp section (initiative ties, attacker staging, the dodge / clean miss / staging
 * comparison / full defense flow, shotgun shot as flechette).
 *
 * - rangedReload: 'actions' — Insert Clip and Remove Clip are a Simple Action each (a clip reload is two, a smartgun
 *   ejects its clip as a Free Action so it is one); reloading a non-clip weapon (belt, cylinder, internal magazine,
 *   break action) is a Complex Action. The rounds a non-clip reload puts in stay RULES.COMBAT.reloadFeed (house
 *   numbers; now per Complex Action). 'oneSimple': one Simple Action for any reload (old).
 *   Source: SRII pp. 81–83 (combat action chart).
 * - rangedPoolCap: 'skill' — Combat Pool dice added to an offensive test (a ranged or melee attack, the defender's
 *   opposed melee test) are at most the rating of the skill rolled; no limit on damage resistance (or the old dodge).
 *   'none': only what is left in the pool (old). Source: SRII p. 83 (Dice Pools).
 * - rangedStrengthRange: 'book' — a Strength-range weapon whose item still has the shipped default multipliers
 *   (1/2/3/5) takes the book row its name matches (bow, light/medium/heavy crossbow, shuriken, aerodynamic grenade,
 *   grenade); 'item': always the item's own multipliers (old). The bow and grenade templates also carry their rows
 *   (plain value edits). Source: SRII Weapon Range Table and Grenade Range Table.
 * - rangedRecoil: 'book' — recoil counts every round fired in the Combat Phase, except that the first shot of the
 *   phase is free when it is a single shot (SA: +1 for the second shot; burst: +3 per burst, cumulative; full auto:
 *   +1 per round fired); 'freeFirst': the first round of the phase is always free (old: bursts +2, +5; full auto 10
 *   rounds +9). Source: SRII Ranged Combat Modifiers Table.
 * - rangedFlechette: 'armor' — flechette rounds stage the damage up one level only against a target with no armor
 *   (no ballistic or impact rating at all, dermal armor included); against armor they double the higher of its
 *   ballistic and impact ratings and use that; barriers still double (RULES.COMBAT.ammo's armorMultiplier).
 *   'always': +1 level and the attack's armor kind × 2 every time (old). Source: SRII p. 93.
 * - rangedScatter: 'byType' — a grenade scatters by its type: standard 1D6, aerodynamic 2D6, launcher 3D6 metres
 *   (`scatterDice`), less RULES.COMBAT.scatter.metresPerSuccess per success; other blasts (rockets, missiles,
 *   demolition) keep the range-band dice. 'byRange': 1–4 D6 by range band for everything (old). An aerodynamic
 *   grenade is one whose name says "aero". Source: SRII Grenade Range Table.
 * - rangedSurprise: 'order' — the surprise turn: everyone acts once, in order of their Reaction-test successes (the
 *   combatants' initiative is set to successes + 1, at most `maxScore`, so nobody gets a second pass), and nobody may
 *   act against an opponent who rolled more successes than they did; nobody loses a pass or is "unaware".
 *   'losePass': anyone with fewer successes than the best opponent loses the first pass and can't dodge (old).
 *   Source: SRII p. 86.
 *
 * Also in v0.79.0 (plain values, rules/config.ts, the old value in a comment; source the SRII Weapon Range Table): taser 5/10/12/15, sniper rifle 40/80/200/400, assault rifle 15/40/100/250, LMG 20/40/80/150,
 * missile launcher 70/150/450/1500 with a 20 m minimum range; bow Str ×1/10/30/60, thrown grenades Str ×3/5/10/20
 * (SRII Grenade Range Table); smartlink level 2 −2 like level 1 (SRII Ranged Combat Modifiers Table).
 */
export const DOCS_V79_RANGED = {
  rangedReload: 'actions' as 'actions' | 'oneSimple',
  rangedPoolCap: 'skill' as 'skill' | 'none',
  rangedStrengthRange: 'book' as 'book' | 'item',
  /** The book's Strength-range rows (× Strength for short / medium / long / extreme), matched by weapon name in this order. */
  rangedStrengthRows: [
    { id: 'lightCrossbow', match: 'light\\s*crossbow', short: 2, medium: 8, long: 20, extreme: 40 },
    { id: 'mediumCrossbow', match: 'medium\\s*crossbow', short: 3, medium: 12, long: 30, extreme: 50 },
    { id: 'heavyCrossbow', match: 'heavy\\s*crossbow', short: 5, medium: 15, long: 40, extreme: 60 },
    { id: 'bow', match: '\\bbow\\b|longbow|shortbow', short: 1, medium: 10, long: 30, extreme: 60 },
    { id: 'shuriken', match: 'shuriken|throwing\\s*star', short: 1, medium: 2, long: 5, extreme: 7 },
    { id: 'aeroGrenade', match: 'aero', short: 3, medium: 5, long: 20, extreme: 30 },
    { id: 'grenade', match: 'grenade', short: 3, medium: 5, long: 10, extreme: 20 },
  ] as ReadonlyArray<{ id: string; match: string; short: number; medium: number; long: number; extreme: number }>,
  rangedRecoil: 'book' as 'book' | 'freeFirst',
  rangedFlechette: {
    mode: 'armor' as 'armor' | 'always',
    /** Ammunition ids that are flechette rounds. */
    ammoIds: ['flechette'] as readonly string[],
    /** Against armor: the higher of ballistic and impact × this. */
    armorMultiplier: 2,
  },
  rangedScatter: {
    mode: 'byType' as 'byType' | 'byRange',
    scatterDice: { standard: 1, aerodynamic: 2, launcher: 3 } as Record<'standard' | 'aerodynamic' | 'launcher', number>,
  },
  rangedSurprise: {
    mode: 'order' as 'order' | 'losePass',
    /** The highest initiative a surprise-turn score gets (10 = one pass only). */
    maxScore: 10,
  },
};
