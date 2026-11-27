/**
 * v0.95.0 rules completeness: Ranged combat. Read through RULES.FIRE_V95. Book rules the system did not have before v0.95.0, each
 * with its book and page in the comment. Each switch's first choice is the book's way (the default; an optional book
 * rule ships off); the other choice puts the v0.94.2 behaviour back. Pure logic lives beside it in rules/fire95.ts.
 *
 * The Unified Rules Revamp (RULES.URR_V80.active) has no rule of its own for any of these, so they act under both
 * rules sources.
 */
export const FIRE_V95 = {
  /**
   * A laser sight in bad air (Core p. 90). 'book': mist, smoke, fog or rain (the scene's weather in `laserWeather`,
   * or smoke on the line of fire) cancels the laser sight's bonus by itself. 'off' (v0.94.2): the tick in the Attack
   * dialog is only cleared by hand.
   */
  laser: 'book' as 'book' | 'off',
  /** laser 'book': the RULES.HEALTH.weather ids that cancel a laser sight (the Mist row covers blowing snow, Core p. 89). */
  laserWeather: ['mist', 'lightRain', 'heavyRain', 'fog', 'heavyFog', 'storm', 'lightSnow', 'snow'] as readonly string[],
  /**
   * Two firearms (Core p. 90). 'book': with "Using a second firearm" ticked, each gun builds its own recoil that
   * Combat Phase and the other gun's uncompensated recoil is added to it. 'off' (v0.94.2): every round fired that
   * phase counts as one gun's recoil, against the firing gun's compensation.
   */
  sharedRecoil: 'book' as 'book' | 'off',
  /**
   * An aim held over several Combat Phases (Core p. 82). 'book': using any Dice Pool dice loses it (the aimed shot's
   * own pool dice too). 'off' (v0.94.2): pool dice don't matter.
   */
  aimPool: 'book' as 'book' | 'off',
  /**
   * Explosive rounds (Core p. 93). 'book': an Attack Test of all ones sets the round off in the gun: the shooter
   * resists the weapon's normal round (no Combat Pool) against 1D6 attack successes. 'off' (v0.94.2): no misfire.
   */
  misfire: 'book' as 'book' | 'off',
  /** misfire 'book': the ammunition ids that can misfire (EX-explosive counted as explosive: VERIFY). */
  misfireAmmo: ['explosive', 'exex'] as readonly string[],
  /**
   * Shotgun shot (Core p. 95). 'book': a target in the spread rolls 1 more resistance die for every other target in
   * the spread between it and the gun. 'off' (v0.94.2): no extra dice.
   */
  shotScreen: 'book' as 'book' | 'off',
  /** shotScreen: the most extra dice a card may carry (a bound on card data). */
  shotScreenMax: 10,
  /**
   * A blast in a confined space (Core p. 98). 'book': on the line through the blast and each target, a wall that
   * holds sends the wave back; every pass that still has Power adds that Power to the target's blast. 'nearest'
   * (v0.94.2): RULES.COMBAT.confined (a share of the Power left at the nearest wall, the same for everyone).
   * RULES.COMBAT.confined.enabled off switches both off.
   */
  rebound: 'book' as 'book' | 'nearest',
  /** rebound 'book': the most passes counted for one target (a bound; the Power runs out first in practice). */
  reboundPasses: 12,
  /**
   * Stray shots (Core p. 93, an optional rule: ships off). 'book': full auto walked between targets (not a smartgun
   * with a smartlink) posts a GM card with everyone near the walked line, in random order; each is tested with
   * `strayDice` dice against the range's TN, and a hit is resolved with the test's successes + 1D6. 'off' (v0.94.2).
   */
  stray: 'off' as 'book' | 'off',
  strayDice: 2,
  /** stray: how close to the walked line (metres) a token stands to be listed. */
  strayMetres: 1,
  /**
   * Suppressive fire. 'fof' (Fields of Fire p. 78, an optional rule: ships off): each round covers 1 m for
   * `fofPhases` Combat Phases; whoever shows themselves there is attacked with as many dice as rounds on their metre
   * against TN `fofTn` + cover + the shooter's wounds; every `fofPerHit` successes is a round that hits. 'house'
   * (v0.94.2): RULES.COMBAT.suppressive (one attack at the targeted people, a Take cover button).
   */
  suppression: 'house' as 'fof' | 'house',
  fofPhases: 10,
  fofTn: 4,
  fofPerHit: 2,
};

/** The house-rules window's rows for FIRE_V95 (spread into settings.ts HOUSE_RULES). */
export const HOUSE_FIRE_V95: Array<{ path: string; section: string; type: 'number' | 'boolean' | 'select'; choices?: string[]; step?: number }> = [
  { section: 'rangedCombat', path: 'FIRE_V95.laser', type: 'select', choices: ['book', 'off'] },
  { section: 'rangedCombat', path: 'FIRE_V95.sharedRecoil', type: 'select', choices: ['book', 'off'] },
  { section: 'rangedCombat', path: 'FIRE_V95.aimPool', type: 'select', choices: ['book', 'off'] },
  { section: 'rangedCombat', path: 'FIRE_V95.misfire', type: 'select', choices: ['book', 'off'] },
  { section: 'rangedCombat', path: 'FIRE_V95.shotScreen', type: 'select', choices: ['book', 'off'] },
  { section: 'rangedCombat', path: 'FIRE_V95.rebound', type: 'select', choices: ['book', 'nearest'] },
  { section: 'rangedCombat', path: 'FIRE_V95.stray', type: 'select', choices: ['book', 'off'] },
  { section: 'rangedCombat', path: 'FIRE_V95.suppression', type: 'select', choices: ['fof', 'house'] },
];
