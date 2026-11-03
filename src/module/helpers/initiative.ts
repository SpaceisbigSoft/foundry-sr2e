import { RULES, icInitiative, initiativeWoundPenalty, projectingInitiativeMinus, jackedInInitiativeMinus } from '../rules/index.ts';

/**
 * v0.71.0 (R15): what an actor's initiative is rolled from: dice, base (Reaction or its stand-in) and the wound
 * penalty. Shared by the combatant's roll and the status strip (which showed Reaction + Nd6 for everyone).
 */
export function initiativeFormula(actor: any): { dice: number; base: number; minus: number; label: string } {
  const d = actor?.system?.derived;
  const out = (dice: number, base: number, minus = 0, label = '') => ({ dice: Number(dice) || 0, base: Number(base) || 0, minus: Number(minus) || 0, label });
  // IC: rating + Nd6, N from its own setting or the host's security code. VERIFY
  if (actor?.type === 'ic') {
    const host: any = actor.system.hostUuid ? (globalThis as any).fromUuidSync?.(actor.system.hostUuid) : null;
    // v0.57.0: or the host's Security Value + dice by its code (RULES.MATRIX_V57.icInitiative).
    const ii = icInitiative({ rating: Number(actor.system.rating ?? 0), securityValue: Number(host?.system?.securityValue ?? 0), code: String(host?.system?.securityCode ?? ''), ownDice: Number(actor.system.initiativeDice ?? 0) });
    return out(ii.dice, ii.base, 0, 'IC');
  }
  // A vehicle: its jumped-in rigger's speed, or its autopilot. VERIFY
  if (actor?.type === 'vehicle') {
    const ctl: any = actor.controller?.();
    const r = actor.system.controlMode === 'jumped' ? ctl?.system?.derived?.rigging : null;
    // v0.54.0: the jumped-in rigger's own wounds slow the vehicle too.
    const cw = r?.jumpedIn ? initiativeWoundPenalty(ctl?.system?.derived?.woundModifier ?? 0) : 0;
    if (r?.jumpedIn) return out(r.initiativeDice, r.reaction, cw, 'rigged');
    // v0.59.0: driven by hand, it acts at its driver's own speed (not the autopilot's).
    const cd = actor.system.controlMode === 'manual' ? ctl?.system?.derived : null;
    if (cd && typeof cd.reaction === 'number') return out(cd.initiativeDice ?? RULES.BASE_INITIATIVE_DICE, cd.reaction, initiativeWoundPenalty(cd.woundModifier ?? 0), 'driver');
    return out(d?.initiativeDice ?? 1, d?.reaction ?? 0, 0, 'autopilot');
  }
  // v0.54.0: the body's wounds lower Initiative (v0.72.0: an astral form's too, MAGIC_V72.astralWounds).
  const w = initiativeWoundPenalty(d?.woundModifier ?? 0);
  // A jacked-in decker acts at Matrix speed. VERIFY
  // v0.73.0 (O23): and the persona's damage (NETRIG_V73.personaInitiative).
  if (d?.matrix?.jackedIn) return out(d.matrix.initiativeDice, d.matrix.reaction, jackedInInitiativeMinus(w, Number(actor?.system?.matrix?.monitor ?? 0)), 'Matrix');
  // A rigger jumped into a vehicle acts at rigged speed. VERIFY
  if (d?.rigging?.jumpedIn) return out(d.rigging.initiativeDice, d.rigging.reaction, w, 'rigged');
  // A projecting magician acts at astral speed. VERIFY
  // v0.72.0 (O20): the astral form's wounds (astral damage marks the same monitor) slow it too (MAGIC_V72.astralWounds).
  if (d?.astralMode === 'projecting' && d.astral) return out(d.astral.initiativeDice, d.astral.initiativeBase, projectingInitiativeMinus(w), 'astral');
  // v0.61.0: a spirit's initiative bonus (its kind, or astral speed) is on the initiative only.
  return out(d?.initiativeDice ?? RULES.BASE_INITIATIVE_DICE, (d?.reaction ?? 0) + (Number(d?.initiativeBonus ?? 0) || 0), w);
}

