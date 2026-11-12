/**
 * v0.92.3 (the Matrix book alignment): run a test with the Matrix rules as they were in v0.92.2: every
 * RULES.MATRIX_V923 switch on its old choice and every default the alignment moved back to its old value. For the
 * older tests that pin the v0.92.2 behaviour (their intent kept); the new tests check the book's defaults.
 */
import { oldWay } from '../../rules/__tests__/oldway.ts';

const OLD: Array<[string, unknown]> = [
  ['MATRIX_V923.systemTests', 'success'], ['MATRIX_V923.initiative', 'v922'], ['MATRIX_V923.icInitiative', 'v922'],
  ['MATRIX_V923.passiveAlert', 0], ['MATRIX_V923.crashTally', 'none'], ['MATRIX_V923.shutdown', 'fixed'],
  ['MATRIX_V923.operations', 'v922'], ['MATRIX_V923.cybercombat', 'v922'], ['MATRIX_V923.actions', 'v922'],
  ['MATRIX_V923.icDamageLevel', 'own'], ['MATRIX_V923.iconHardening', 'hardening'], ['MATRIX_V923.overload', 'v922'],
  ['MATRIX_V923.dumpShock', 'v922'], ['MATRIX_V923.blackIc', 'v922'], ['MATRIX_V923.psychotropic', 'v922'],
  ['MATRIX_V923.grayIc', 'v922'], ['MATRIX_V923.probe', 'active'], ['MATRIX_V923.trace', 'v922'], ['MATRIX_V923.logoff', 'v922'],
  ['MATRIX_V923.connections', 'v922'], ['MATRIX_V923.armorWear', 'every'], ['MATRIX_V923.shield', 'soak'],
  ['MATRIX_V923.frames', 'v922'], ['MATRIX_V923.deckBuilding', 'v922'], ['MATRIX_V923.otaku', 'v922'], ['MATRIX_V923.paydata', 'v922'],
  ['MATRIX.defense.persona', 'pool'], ['MATRIX.attributeDamage.minOnHit', 1], ['MATRIX.utilitySize.kinds.smoke', 1],
  ['MATRIX.utilitySize.kinds.frame', 3], ['MATRIX.utilitySize.kinds.smart-frame', 5], ['MATRIX.download.ioPerTurn', 1],
  ['MATRIX.sim.hot.dumpShockType', 'physical'], ['MATRIX.sim.cold.coldBlackIcStun', false], ['MATRIX.frames.smartPoolPerRating', 0.5],
  ['MATRIX.psychotropic.shieldDice', true], ['MATRIX.utilities.smoke.tnPerRating', 0.5], ['MATRIX.travel.turnsPerHop', 1],
  ['MATRIX.party.sharedInitiative', true], ['MATRIX.programming.daysPerMp', 1], ['MATRIX.iccm.blackIcStun', true],
  ['MATRIX.iccm.dicePerRating', 1], ['MATRIX_V57.dumpShock.levelBy', 'fixed'], ['MATRIX_V57.icAttackDice', 'rating'],
  ['MATRIX_V57.utilities.validate.dfBonus', 2],
];

/** Set the v0.92.2 values; returns a function that puts the current ones back. */
export function matrix922(): () => void {
  return oldWay(Object.fromEntries(OLD));
}

/** Run `fn` (sync or async) with the v0.92.2 Matrix rules. */
export function withMatrix922<T>(fn: () => T): T {
  const restore = matrix922();
  let r: T;
  try { r = fn(); } catch (e) { restore(); throw e; }
  if (r && typeof (r as any).then === 'function') return (r as any).finally(restore);
  restore();
  return r;
}
