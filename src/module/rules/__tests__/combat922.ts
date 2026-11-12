/**
 * v0.92.3: run a test under the v0.92.2 combat rules (before the book alignment): every COMBAT_V923 switch at its old
 * choice and the defaults moved in place set back. Use as `t.after(combat922())` or `before(() => { undo = combat922(); })`.
 */
import { oldWay } from './oldway.ts';
import { RULES } from '../config.ts';

export function combat922(extra: Record<string, unknown> = {}): () => void {
  const grenades = RULES.COMBAT.grenades.map((g) => (g.id === 'apRocket' ? { ...g, perMetre: 0.5 } : g));
  return oldWay({
    'COMBAT_V923.rangedDefense': 'dodge',
    'COMBAT_V923.fullDefense': 'dice',
    'COMBAT_V923.poolRefresh': 'turn',
    'COMBAT_V923.knockdown': 'old',
    'COMBAT_V923.blastStaging': 'off',
    'COMBAT_V923.scatter': 'old',
    'COMBAT_V923.shotgun': 'old',
    'COMBAT_V923.tracers': 'old',
    'COMBAT_V923.reload': 'old',
    'COMBAT_V923.armorPenalty': 'quickness',
    'COMBAT_V923.initiativeTies': 'quickness',
    'COMBAT_V923.meleeVisibility': 'full',
    'COMBAT_V923.subdueTn': 0,
    'COMBAT_V923.meleeTargets': 'off',
    'COMBAT_V923.spreadFire': 'old',
    'COMBAT_V923.flechette': 'double',
    'COMBAT_V923.barriers': 'old',
    'COMBAT_V923.shortBurst': 'off',
    'COMBAT_V923.secondFirearm': 'off',
    'COMBAT_V923.aim': 'old',
    'COMBAT_V923.calledShot': 'old',
    'COMBAT_V923.friends': 'old',
    'COMBAT_V923.ambush': 'off',
    'COMBAT_V923.delay': 'turn',
    'COMBAT_V923.rangedRows': false,
    'ATTACK_STAGING': 'afterFirst',
    'COMBAT.melee.tie': 'none',
    'INITIATIVE_WOUNDS.midTurn': true,
    'DELAY.lostAtPassEnd': true,
    'COMBAT.grenades': grenades,
    'COMBAT.demolitions.tn': 4,
    'COMBAT.ready.rule': 'off',
    ...extra,
  });
}
