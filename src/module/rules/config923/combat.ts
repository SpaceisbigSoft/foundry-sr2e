/**
 * v0.92.3 book alignment: Combat. Read through RULES.COMBAT_V923. Every value here was checked against the SR2 books
 * (book and page in each comment). Each switch's first choice is the book's way (the default); the other puts the
 * old v0.92.2 behaviour back.
 *
 * These switches act under the Book Rules source only: under the "SR2E Unified Rules Revamp" source
 * (RULES.URR_V80.active) the Revamp keeps its own rules exactly as before. Where the Revamp already had the book's
 * procedure (clean miss, net staging, knockdown, scatter, shotguns, tracers, reloads,
 * initiative ties), the book way runs through the same code path. Pure logic: rules/combat923.ts.
 *
 * Changed in place (old → new, the GM can set them back in the house-rules window):
 * - ATTACK_STAGING 'afterFirst' → 'all': every 2 net successes stage the damage one level (Core p. 91, the 2 net
 *   successes taking M to S; Core p. 101, 2 net taking 4M Stun to S Stun; Core p. 110). Ranged, melee, combat spells.
 * - COMBAT.melee.tie 'none' → 'attacker': ties go to the attacker, base damage (Core pp. 100–101).
 * - INITIATIVE_WOUNDS.midTurn true → false: wounds count against Reaction when initiative is rolled (Core p. 112).
 * - DELAY.lostAtPassEnd true → false: a delayed action lasts through the later phases (Core p. 80).
 * - COMBAT.grenades apRocket perMetre 0.5 → 2: anti-personnel rockets lose 1 Power per half metre (Core p. 99).
 *   (The anti-vehicle rocket keeps its −1 per 4 m, a deliberate choice; the book's table says −8 per metre.)
 * - COMBAT.demolitions.tn 4 → 2: placing a charge is Demolitions vs 2 (Core p. 98).
 * - COMBAT.ready.rule 'off' → 'action': a weapon must be readied (a Simple Action) before it is used (Core p. 82).
 * - SITUATIONAL_MODIFIERS: target running +2, target stationary −1, attacker in melee +2 per opponent (one or two),
 *   attacker walking / running on difficult ground +2 / +6, smart goggles −1 (Ranged Combat Modifiers Table,
 *   Core p. 89); `rangedRows` below hides them again.
 */
export const COMBAT_V923 = {
  /**
   * Ranged defense. 'book': no dodge test; the Defend dialog's Combat Pool dice go into the Damage Resistance Test
   * (Body + pool vs Power − armor); a clean miss when the pool dice's successes alone beat the attacker's; otherwise
   * the attack's successes are compared with the resistance successes and every 2 net either way stage the damage one
   * level (a tie is the base damage) (Core pp. 87, 91; Dice Pools p. 84; Ka-Ge 7 Q4). 'dodge' (v0.92.2): a pool dodge
   * vs the attacker's TN cancels successes, the net stages up, the soak stages down on its own.
   */
  rangedDefense: 'book' as 'book' | 'dodge',
  /**
   * Full defense (an optional rule, Core p. 102). 'book': no extra dice and no Combat Pool on the defender's melee
   * test, the pool goes to the Damage Resistance Test, a clean miss when its successes alone beat the attacker's; it
   * costs no initiative. 'dice' (v0.92.2): + RULES.COMBAT.fullDefense.attribute dice, the pool on the melee test, and
   * RULES.COMBAT.fullDefense.initiativeCost out of turn.
   */
  fullDefense: 'book' as 'book' | 'dice',
  /**
   * When the Combat Pool refreshes. 'action': at the start of each of the character's actions; dice left at the end
   * of a Combat Turn last until the character's first action of the next (Core pp. 78, 84). 'turn' (v0.92.2): at each
   * new Combat Turn. The other pools still refresh each Combat Turn.
   */
  poolRefresh: 'action' as 'action' | 'turn',
  /**
   * Knockdown. 'book': every hit that does damage calls for a Body test, ranged vs half the Power (round down; gel
   * rounds vs the Power), melee vs the attacker's Strength; more successes than half the wound (L 1, M 2, S 3) stays
   * up, some successes stagger 1 m back, none knocks down; Deadly always knocks down (Core pp. 92, 102). 'old'
   * (v0.92.2): RULES.COMBAT.knockdown (Power over Body, Body vs the soak TN, no successes = down).
   */
  knockdown: 'book' as 'book' | 'old',
  /**
   * Grenade and rocket blasts. 'book': each target's resistance successes (Body + Combat Pool vs Power − impact) are
   * compared with the attacker's successes; every 2 net either way stage the damage one level (Core p. 97). 'off'
   * (v0.92.2): the successes only cut the scatter.
   */
  blastStaging: 'book' as 'book' | 'off',
  /**
   * Scatter. 'book': metres off per attack success by type, rockets and missiles 2D6 and as a grenade launcher (4 m a
   * success), a missile also its Intelligence in metres less (Core pp. 97, 99). 'old' (v0.92.2):
   * RULES.COMBAT.scatter.metresPerSuccess for all, rockets by range band.
   */
  scatter: 'book' as 'book' | 'old',
  scatterPerSuccess: { standard: 2, aerodynamic: 4, launcher: 4 } as Record<'standard' | 'aerodynamic' | 'launcher', number>,
  scatterRocket: { dice: 2, perSuccess: 4, perIntelligence: 0 },
  scatterMissile: { dice: 2, perSuccess: 4, perIntelligence: 1 },
  /**
   * Shotguns (Core p. 95). 'book': a shotgun fires a slug unless loaded with shot ('shot' ammunition, the flechette
   * rules); shot spreads 1 m wide for the first choke metres, then 2, 4, 6… m; each widening −1 Power and −1 TN;
   * choke 2–10. 'old' (v0.92.2): every shotgun spreads (distance ÷ choke m, −1 Power per metre).
   */
  shotgun: 'book' as 'book' | 'old',
  /** shotgun 'book': the choke's range (Core p. 95). */
  shotgunChoke: { min: 2, max: 10 },
  /**
   * Tracers (Fields of Fire). 'book': full auto only, −1 TN per 3 rounds of the burst beyond short range, none for a
   * smartgun user, and the tracer rounds add no Power. 'old' (v0.92.2): −1 per burst already fired, to −3.
   */
  tracers: 'book' as 'book' | 'old',
  /**
   * Reloading a cylinder or an internal magazine. 'book': Quickness rounds per Complex Action (a break action 2,
   * Core p. 95). 'old' (v0.92.2): RULES.COMBAT.reloadFeed's rounds.
   */
  reload: 'book' as 'book' | 'old',
  // Heavy armor and the Combat Pool (Core pp. 84, 242): one switch, RULES.GEAR_V923.armorEncumbrance.
  /**
   * Initiative ties. 'book': the higher adjusted Reaction, then the higher natural Reaction (then the name; the book
   * says simultaneous) (Core p. 79). 'quickness' (v0.92.2): RULES.INITIATIVE_TIES (Reaction, then Quickness).
   */
  initiativeTies: 'book' as 'book' | 'quickness',
  /**
   * Visibility in melee. 'half': the Visibility Table at half (round down), except full darkness (Core p. 102).
   * 'full' (v0.92.2): the ranged values.
   */
  meleeVisibility: 'half' as 'half' | 'full',
  /** Subduing in melee: + this TN (Core p. 103; v0.92.2: 0). */
  subdueTn: 2,
  /**
   * Several melee targets in one Complex Action: 'book' +2 per target already attacked this phase (Core p. 102);
   * 'off' (v0.92.2): ranged only.
   */
  meleeTargets: 'book' as 'book' | 'off',
  /**
   * Full auto at several targets (Core p. 93). 'book': +2 per new target engaged (the second burst +2, the third +4),
   * and a smartgun used with a smartlink wastes no rounds walking the fire. 'old' (v0.92.2):
   * RULES.COMBAT.spreadFire.extraTargetTn per extra target on every burst, rounds wasted with any gun.
   */
  spreadFire: 'book' as 'book' | 'old',
  /** spreadFire 'book': + TN per new target engaged that phase. */
  spreadTnPerTarget: 2,
  /**
   * Flechette against armor (Core p. 93). 'book': the higher of double Impact and plain Ballistic. 'double' (v0.92.2):
   * the higher of the two, doubled.
   */
  flechette: 'book' as 'book' | 'double',
  /**
   * Firing through a barrier (Core p. 98). 'book': a barrier rated above the attack's Power stops it; the barrier
   * counts double against flechette and explosive rounds. 'old' (v0.92.2): the rating only adds to armor.
   */
  barriers: 'book' as 'book' | 'old',
  /**
   * Short bursts (Core p. 92). 'book': a burst of 2 rounds (the clip runs short) is +2 Power, no extra level, +2
   * recoil; 1 round is a single shot (burst and full auto). 'off' (v0.92.2): too few rounds for the burst can't fire.
   */
  shortBurst: 'book' as 'book' | 'off',
  /**
   * Friends in melee (Core p. 102). 'book': both sides' friends in the fight are counted; the side with more takes −1
   * per friend more (at most −4), the side with fewer +1 per friend fewer (at most +4). 'old' (v0.92.2): only the
   * attacker's friends, −1 each.
   */
  friends: 'book' as 'book' | 'old',
  /**
   * Called shots (Core p. 92). 'book': single shot, semi-auto and burst only (not full auto), and the choice is +1
   * damage level or a part of a vehicle (no armor-gap option). 'old' (v0.92.2): any mode, and the armor gap.
   */
  calledShot: 'book' as 'book' | 'old',
  /**
   * Take Aim (Core p. 82). 'book': at most half the skill, rounded down (a skill of 1 can't aim). 'old' (v0.92.2): at
   * least 1.
   */
  aim: 'book' as 'book' | 'old',
  /**
   * A second firearm (Core p. 90). 'book': it cancels smartlink, smart goggles and laser sight bonuses (the shared
   * recoil is not modelled). 'off' (v0.92.2): they still count.
   */
  secondFirearm: 'book' as 'book' | 'off',
  /**
   * Surprise (Core p. 86). 'book': an ambusher with a delayed action waiting rolls at TN − 2. 'off' (v0.92.2): no change.
   */
  ambush: 'book' as 'book' | 'off',
  ambushTn: -2,
  /**
   * Delayed actions (Core p. 80). 'book': a delay still held at the end of the Combat Turn carries into the next, and
   * spending any pool dice while delaying breaks it. 'turn' (v0.92.2): it ends with the Combat Turn; pool dice don't
   * matter. Needs DELAY.lostAtPassEnd off.
   */
  delay: 'book' as 'book' | 'turn',
  /** Show the book's extra ranged rows in the Attack dialog (true), or hide them as in v0.92.2 (false). */
  rangedRows: true as boolean,
  /** rangedRows: the SITUATIONAL_MODIFIERS ids added in v0.92.3 (hidden when rangedRows is off). */
  rangedRowIds: ['targetRunning', 'targetStationary', 'attackerInMelee', 'attackerInMelee2', 'attackerWalkingRough', 'attackerRunningRough', 'smartGoggles'] as readonly string[],
};

/** The house-rules window's rows for COMBAT_V923 (spread into settings.ts HOUSE_RULES). */
export const HOUSE_COMBAT_V923: Array<{ path: string; section: string; type: 'number' | 'boolean' | 'select'; choices?: string[]; step?: number }> = [
  { section: 'rangedCombat', path: 'COMBAT_V923.rangedDefense', type: 'select', choices: ['book', 'dodge'] },
  { section: 'melee', path: 'COMBAT_V923.fullDefense', type: 'select', choices: ['book', 'dice'] },
  { section: 'initiativeAndActions', path: 'COMBAT_V923.poolRefresh', type: 'select', choices: ['action', 'turn'] },
  { section: 'melee', path: 'COMBAT_V923.knockdown', type: 'select', choices: ['book', 'old'] },
  { section: 'rangedCombat', path: 'COMBAT_V923.blastStaging', type: 'select', choices: ['book', 'off'] },
  { section: 'rangedCombat', path: 'COMBAT_V923.scatter', type: 'select', choices: ['book', 'old'] },
  { section: 'rangedCombat', path: 'COMBAT_V923.shotgun', type: 'select', choices: ['book', 'old'] },
  { section: 'rangedCombat', path: 'COMBAT_V923.tracers', type: 'select', choices: ['book', 'old'] },
  { section: 'rangedCombat', path: 'COMBAT_V923.reload', type: 'select', choices: ['book', 'old'] },
  { section: 'initiativeAndActions', path: 'COMBAT_V923.initiativeTies', type: 'select', choices: ['book', 'quickness'] },
  { section: 'melee', path: 'COMBAT_V923.meleeVisibility', type: 'select', choices: ['half', 'full'] },
  { section: 'melee', path: 'COMBAT_V923.subdueTn', type: 'number' },
  { section: 'melee', path: 'COMBAT_V923.meleeTargets', type: 'select', choices: ['book', 'off'] },
  { section: 'rangedCombat', path: 'COMBAT_V923.spreadFire', type: 'select', choices: ['book', 'old'] },
  { section: 'rangedCombat', path: 'COMBAT_V923.flechette', type: 'select', choices: ['book', 'double'] },
  { section: 'rangedCombat', path: 'COMBAT_V923.barriers', type: 'select', choices: ['book', 'old'] },
  { section: 'rangedCombat', path: 'COMBAT_V923.shortBurst', type: 'select', choices: ['book', 'off'] },
  { section: 'melee', path: 'COMBAT_V923.friends', type: 'select', choices: ['book', 'old'] },
  { section: 'rangedCombat', path: 'COMBAT_V923.calledShot', type: 'select', choices: ['book', 'old'] },
  { section: 'rangedCombat', path: 'COMBAT_V923.aim', type: 'select', choices: ['book', 'old'] },
  { section: 'rangedCombat', path: 'COMBAT_V923.secondFirearm', type: 'select', choices: ['book', 'off'] },
  { section: 'initiativeAndActions', path: 'COMBAT_V923.ambush', type: 'select', choices: ['book', 'off'] },
  { section: 'initiativeAndActions', path: 'COMBAT_V923.delay', type: 'select', choices: ['book', 'turn'] },
  { section: 'rangedCombat', path: 'COMBAT_V923.rangedRows', type: 'boolean' },
];
