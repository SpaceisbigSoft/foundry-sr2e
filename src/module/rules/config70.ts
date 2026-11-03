/**
 * v0.70.0: the fixes from the v0.69.0 review (docs/REVIEW-v0.69.md, section 1). Values are house-rule
 * switches so the GM can put the old behaviour back; numbers from memory are marked VERIFY.
 *
 * - helplessStatuses: token statuses that leave a defender helpless (no dodge, no opposed melee defense,
 *   no pool dice, no full defense), as unconscious already did. Paralysis, sleep and petrification.
 * - noDodgeStatuses: statuses that stop a ranged dodge but still allow an opposed melee defense (bound or held).
 * - astralBlocksPhysical: a projecting magician, or an unmaterialized spirit, can't make physical actions
 *   (weapon attacks, driving, first aid, physical skill tests, jacking in, rigging).
 * - dyingOutOfCombat: a dying character's condition worsens with world time too (outside combat, and while
 *   waiting for DocWagon), converted to Combat Turns at 3 s each (RULES.CONDITIONS.dying keeps the rate).
 * - unstabilisedRest: 'block' refuses natural healing while dying and not stabilised.
 * - newDamageUnstabilises: new Physical damage on a dying, stabilised patient needs stabilising again.
 * - stunOverflowCarry: Stun past a full track carries its remainder (no box is lost on each hit).
 * - areasWorldTime: smoke, gas and blast areas last their Combat Turns in world time and outlive the combat.
 * - poolsAtCombatStart: everyone in a combat gets fresh pools when it starts.
 * - matrixMoveGmOnly: the Matrix tab's Move (go straight to a host) is the GM's shortcut only.
 */
export const FIXES_V70 = {
  helplessStatuses: ['paralysis', 'sleep', 'sr2ePetrified'] as string[],
  noDodgeStatuses: ['restrain'] as string[],
  astralBlocksPhysical: true,
  dyingOutOfCombat: true,
  unstabilisedRest: 'block' as 'block' | 'allow',
  newDamageUnstabilises: true,
  stunOverflowCarry: true,
  areasWorldTime: true,
  poolsAtCombatStart: true,
  matrixMoveGmOnly: true,
};
