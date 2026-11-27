/**
 * v0.95.0 rules completeness: Melee, actions and Dice Pools. Read through RULES.MELEE_V95. Book rules the system did not have before v0.95.0, each
 * with its book and page in the comment. Each switch's first choice is the book's way (the default; an optional book
 * rule ships off); the other choice puts the v0.94.2 behaviour back. Pure logic lives beside it in rules/melee95.ts;
 * the Foundry side in applications/melee95.ts.
 *
 * Under the "SR2E Unified Rules Revamp" source (RULES.URR_V80.active) the rules the Revamp changes itself keep the
 * Revamp's way (rules/melee95.ts REVAMP_MELEE_RULES): quick draw rolls Quickness with no holster or second-weapon
 * modifier, there is no total surprise, and every pool refreshes at the new Combat Turn. The other switches are book
 * rules the Revamp is silent on (or has the same) and act under either source.
 */
export const MELEE_V95 = {
  /**
   * Wounds and Reaction (Core p. 112). 'book': a character whose Initiative modifier takes Reaction to 0 or less takes
   * no actions in combat: no turn in the tracker, the action buttons greyed with the reason, actions refused.
   * 'off' (v0.94.2): no check.
   */
  reactionOut: 'book' as 'book' | 'off',
  /**
   * Quick draw (Core p. 82). 'test': attacking with a holstered pistol-sized firearm (Concealability `quickDrawConceal`
   * or more, a mode fired with a Simple Action) rolls Reaction vs `quickDrawTn`, + `quickDrawNoHolsterTn` without a
   * quick-draw holster, + `quickDrawSecondTn` when a second firearm is drawn too; a success draws and fires in the
   * same action, a failure spends the action and fires nothing this phase. A quick-draw holster no longer draws for
   * free. 'holster' (v0.94.2): a quick-draw holster draws for free, any other weapon spends a Simple Action to draw.
   */
  quickDraw: 'test' as 'test' | 'holster',
  quickDrawTn: 4,
  quickDrawNoHolsterTn: 2,
  quickDrawSecondTn: 2,
  quickDrawConceal: 4,
  /**
   * Total surprise (Core p. 86). 'book': in the surprise test a character who out-rolled no opponent, and was
   * out-rolled by at least one, takes no actions at all in the surprise turn (no turn, buttons greyed, actions
   * refused); allies never surprise each other (sides by token disposition, player characters with the friendly side;
   * when everyone shows the same disposition everyone else is an opponent). 'off' (v0.94.2): only the
   * target limit, allies included.
   */
  totalSurprise: 'book' as 'book' | 'off',
  /**
   * Subduing (Core p. 103). 'stunOnly': only a weapon that does Stun damage can subdue (the Attack and Defend
   * windows refuse it otherwise). 'any' (v0.94.2): any melee weapon, its damage turned to Stun.
   */
  subdue: 'stunOnly' as 'stunOnly' | 'any',
  /**
   * Control of a subdued opponent (Core p. 103). 'book': Hold on someone whose Stun track is full, by the one who did
   * subduing Stun to them (recorded when the damage is applied) and within `subdueReachMetres`, takes control with no
   * test (only that subduing Stun counts); the Stun wears off 1 box per `subdueReleaseSeconds` of game time unless control is kept; Hold again
   * is the maintenance test (the best of Unarmed Combat, Strength and Quickness vs the lowest of the other's three;
   * the other resists the same way with wound modifiers and + `subdueResistTn`), each net success putting a box back.
   * Letting go takes the remaining subduing Stun off. 'off' (v0.94.2): Hold is always the Strength vs Body hold.
   */
  subdueControl: 'book' as 'book' | 'off',
  subdueReleaseSeconds: 60,
  subdueResistTn: 2,
  subdueReachMetres: 2,
  /**
   * Knocked back into a wall (Core p. 102). 'book': a knockdown test that staggers the character back, with a wall
   * (one that blocks movement) within `wallMetres` straight behind them, marks them "against a wall": + `wallTn` on
   * their melee attack and melee defense tests until their token moves or the status is taken off. 'off' (v0.94.2): no check.
   */
  wall: 'book' as 'book' | 'off',
  wallTn: 2,
  wallMetres: 1,
  /**
   * Interception (Core p. 83). 'offer': in a fight, when a token's move passes within `interceptMetres` of an
   * opponent who can make a melee attack, that opponent's owners and the GM get a whispered card with an Intercept
   * button: the free melee attack on the mover at TN 4 with only reach, the attacker's movement and condition, the
   * Combat Pool allowed; the mover defends as on full defense (no counterattack). 'off' (v0.94.2): nothing.
   */
  interception: 'offer' as 'offer' | 'off',
  interceptMetres: 1,
  /**
   * The Spell and Hacking Pools (Core p. 84). 'action': they refresh at the start of each of the character's
   * actions, like the Combat Pool, and dice left at the end of a Combat Turn last until the first action of the next
   * (it needs COMBAT_V923.poolRefresh at 'action'); spell defense dice go back to the Spell Pool then (Core p. 132),
   * and the player is told. A character who had no action in a Combat Turn gets them back at the next. 'turn'
   * (v0.94.2): at each new Combat Turn. The Control and Task Pools always refresh each Combat Turn (Rigger 2 p. 16:
   * all pools at the start of each Combat Turn).
   */
  otherPools: 'action' as 'action' | 'turn',
};

/** The house-rules window's rows for MELEE_V95 (spread into settings.ts HOUSE_RULES). */
export const HOUSE_MELEE_V95: Array<{ path: string; section: string; type: 'number' | 'boolean' | 'select'; choices?: string[]; step?: number }> = [
  { section: 'initiativeAndActions', path: 'MELEE_V95.reactionOut', type: 'select', choices: ['book', 'off'] },
  { section: 'initiativeAndActions', path: 'MELEE_V95.quickDraw', type: 'select', choices: ['test', 'holster'] },
  { section: 'initiativeAndActions', path: 'MELEE_V95.quickDrawTn', type: 'number' },
  { section: 'initiativeAndActions', path: 'MELEE_V95.quickDrawNoHolsterTn', type: 'number' },
  { section: 'initiativeAndActions', path: 'MELEE_V95.quickDrawSecondTn', type: 'number' },
  { section: 'initiativeAndActions', path: 'MELEE_V95.totalSurprise', type: 'select', choices: ['book', 'off'] },
  { section: 'melee', path: 'MELEE_V95.subdue', type: 'select', choices: ['stunOnly', 'any'] },
  { section: 'melee', path: 'MELEE_V95.subdueControl', type: 'select', choices: ['book', 'off'] },
  { section: 'melee', path: 'MELEE_V95.subdueReachMetres', type: 'number' },
  { section: 'melee', path: 'MELEE_V95.wall', type: 'select', choices: ['book', 'off'] },
  { section: 'melee', path: 'MELEE_V95.wallTn', type: 'number' },
  { section: 'melee', path: 'MELEE_V95.interception', type: 'select', choices: ['offer', 'off'] },
  { section: 'initiativeAndActions', path: 'MELEE_V95.otherPools', type: 'select', choices: ['action', 'turn'] },
];
