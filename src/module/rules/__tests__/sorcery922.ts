/**
 * v0.92.3: the v0.92.2 sorcery rules (every RULES.SORCERY_V923 switch at its old way, and the defaults v0.92.3 moved
 * in place), for older tests that pin the old behaviour. The book's way is tested in v0923-sorcery.test.ts.
 * Use as `t.after(oldWay(SORCERY_V922))` or `before(() => { undo = oldWay(SORCERY_V922); })`.
 */
import { SORCERY_V923 } from '../config923/sorcery.ts';

export const SORCERY_V922: Record<string, unknown> = {
  ...Object.fromEntries(Object.entries(SORCERY_V923).filter(([, v]) => v === 'book').map(([k]) => [`SORCERY_V923.${k}`, 'v922'])),
  'SORCERY_V923.ruleOfOneDrain': 0,
  'SORCERY_V923.elementalTn': 0,
  'SORCERY_V923.formulaAloneTn': 0,
  'SORCERY_V923.weaponFocusKarma': 0,
  'OCCULT.initiation.ordealReduction': 1,
  'MAGIC_V56.ward.nuyenPerForce': 0,
};
