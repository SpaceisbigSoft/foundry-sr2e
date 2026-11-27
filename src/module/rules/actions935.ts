/**
 * v0.93.5 (plan item 48, UI-S1.2; the visual review): the sheet's action bar, Foundry-free.
 * - Which actions a character sheet offers, in one fixed order, so nothing moves when a combat starts or ends.
 * - An action that applies to this kind of character but can't be used right now is kept, greyed, with the reason
 *   (a language key) instead of being hidden. One that can never apply to it (a mundane's Summon) stays hidden.
 * - The most-used actions are "primary" (the one row a narrow window shows; the rest go behind More…); the actions
 *   that only show up when something has happened (a jam, fire, being held, prone) come last ("urgent", always shown).
 * - The firing-mode chips' selected mode, and the Matrix / rigging buttons' state.
 */

/** What the bar needs to know about an actor (the sheet fills it from the actor; tests build it by hand). */
export interface ActionFacts {
  actorType: string;
  /** A combat encounter exists (Initiative), and it has started (Full Defense, Hold, Delay). */
  combat: boolean;
  combatStarted: boolean;
  /** It is this actor's action now; it is delaying; it is taking its delayed action. */
  acting: boolean;
  delaying: boolean;
  actingNow: boolean;
  fullDefenseUp: boolean;
  /** Spells on the sheet; awakened with a casting tradition (Magic above 0, not an adept). */
  spells: number;
  caster: boolean;
  conjuring: boolean;
  astral: boolean;
  /** Weapons that take ammunition. */
  ammoWeapons: number;
  jammed: Array<{ id: string; name: string }>;
  /** Has a control rig, a remote control deck or a vehicle (the rigging block exists); controls a vehicle now. */
  rigger: boolean;
  vehicle: boolean;
  jammer: boolean;
  droneLink: boolean;
  /** Cyberdecks on the sheet; one is in use; jacked in. */
  decks: number;
  deckActive: boolean;
  jackedIn: boolean;
  /** Riding a decker's hitcher jack; another decker has hitcher room. */
  riding: boolean;
  hitchAvailable: boolean;
  onFire: boolean;
  held: boolean;
  prone: boolean;
  bypass: boolean;
  rallySkill: boolean;
  morale: boolean;
  /** v0.95.0 (rules/melee95.ts NO_ACTIONS): why the character takes no actions in this fight ('' or left out: it may). */
  noActions?: string;
}

export interface BarAction {
  /** The sheet action (data-action). */
  action: string;
  /** Which button of that action (fullDefenseUp, actNow…: its label); usually the action itself. */
  variant: string;
  enabled: boolean;
  /** Why it can't be used now (a language key), '' when it can. */
  why: string;
  group: 'main' | 'rest' | 'urgent';
  itemId?: string;
  name?: string;
}

/** The fixed order. Primary first (one row at 1024 px), then the rest (behind More… there). */
export const BAR_MAIN = ['quickAttack', 'quickCast', 'quickReload', 'fullDefense', 'delay', 'rollInit'] as const;
export const BAR_REST = ['summonSpirit', 'assense', 'astralAttack', 'holdTarget', 'perceive', 'notice', 'sneak', 'athletics', 'searchPerson',
  'socialTest', 'negotiatePay', 'rally', 'moraleTest', 'firstAid', 'naturalHeal', 'quickBypass', 'driveVehicle', 'jamLink', 'droneLink', 'jack', 'hitchRide'] as const;

export const WHY = {
  noSpells: 'SR2E.App.Sheets.whyNoSpells',
  noConjuring: 'SR2E.App.Sheets.whyNoConjuring',
  notAstral: 'SR2E.App.Sheets.whyNotAstral',
  noAmmoWeapon: 'SR2E.App.Sheets.whyNoAmmoWeapon',
  notInCombat: 'SR2E.App.Sheets.whyNotInCombat',
  notYourAction: 'SR2E.App.Sheets.whyNotYourAction',
  noEncounter: 'SR2E.App.Sheets.whyNoEncounter',
  noVehicle: 'SR2E.App.Sheets.whyNoVehicle',
  noDeckInUse: 'SR2E.App.Sheets.whyNoDeckInUse',
  notJackedIn: 'SR2E.App.Sheets.whyNotJackedIn',
  noControlRig: 'SR2E.App.Sheets.whyNoControlRig',
} as const;

/** Whether greyed buttons apply to this actor type at all (a spirit's bar shows only what it can do). */
function greysFor(actorType: string): boolean { return actorType === 'character' || actorType === 'npc'; }

/**
 * The action bar: every action in the fixed order, each shown enabled, greyed (with why) or left out.
 * `enabledOnly` gives exactly the buttons the bar showed before v0.93.5 (the Combat column uses it).
 */
export function actionBar(f: ActionFacts): BarAction[] {
  const greys = greysFor(f.actorType);
  const out: BarAction[] = [];
  const add = (action: string, group: BarAction['group'], show: boolean, enabled: boolean, why = '', variant = action, extra: Partial<BarAction> = {}) => {
    if (!show) return;
    // v0.95.0: no actions at all in this fight (Reaction 0 or less from wounds, completely surprised): all but Initiative.
    if (f.noActions && enabled && action !== 'rollInit') { enabled = false; why = f.noActions; }
    if (!enabled && !greys) return;
    out.push({ action, variant, enabled, why: enabled ? '' : why, group, ...extra });
  };
  const slot = (id: string, group: BarAction['group']) => {
    switch (id) {
      case 'quickAttack': return add(id, group, true, true);
      case 'quickCast': return add(id, group, f.spells > 0 || f.caster, f.spells > 0, WHY.noSpells);
      case 'quickReload': return add(id, group, f.ammoWeapons > 0 || greys, f.ammoWeapons > 0, WHY.noAmmoWeapon);
      case 'fullDefense': return add(id, group, true, f.combatStarted, WHY.notInCombat, f.fullDefenseUp && f.combatStarted ? 'fullDefenseUp' : 'fullDefense');
      case 'delay':
        if (f.delaying) return add('actNow', group, true, true);
        if (f.actingNow) return add('endDelayed', group, true, true);
        return add('delayAction', group, true, f.acting && f.combatStarted, f.combatStarted ? WHY.notYourAction : WHY.notInCombat);
      case 'rollInit': return add(id, group, true, f.combat, WHY.noEncounter);
      case 'summonSpirit': return add(id, group, f.conjuring || f.caster, f.conjuring, WHY.noConjuring);
      case 'assense': case 'astralAttack': return add(id, group, f.astral || f.caster, f.astral, WHY.notAstral);
      case 'holdTarget': return add(id, group, true, f.combatStarted, WHY.notInCombat);
      case 'perceive': case 'notice': case 'sneak': case 'athletics': case 'searchPerson': case 'socialTest': case 'firstAid': case 'naturalHeal':
        return add(id, group, true, true);
      case 'negotiatePay': return add(id, group, f.actorType === 'character', true);
      case 'rally': return add(id, group, f.rallySkill, true);
      case 'moraleTest': return add(id, group, f.morale, true);
      case 'quickBypass': return add(id, group, f.bypass, true);
      case 'driveVehicle': return add(id, group, f.vehicle || f.rigger, f.vehicle, WHY.noVehicle);
      case 'jamLink': return add(id, group, f.jammer, true);
      case 'droneLink': return add(id, group, f.droneLink, true);
      case 'jack':
        if (f.deckActive) return add(f.jackedIn ? 'jackOut' : 'jackIn', group, true, true);
        return add('jackIn', group, f.decks > 0, false, WHY.noDeckInUse);
      case 'hitchRide':
        if (f.riding) return add(id, group, true, true, '', 'unhitch');
        return add(id, group, !f.deckActive && f.hitchAvailable, true, '', 'hitch');
      default: return undefined;
    }
  };
  for (const id of BAR_MAIN) slot(id, 'main');
  for (const id of BAR_REST) slot(id, 'rest');
  // Only when something has happened: last, so nothing before them moves.
  for (const w of f.jammed) add('clearJam', 'urgent', true, true, '', 'clearJam', { itemId: w.id, name: w.name });
  add('putOutFire', 'urgent', f.onFire, true);
  add('breakFree', 'urgent', f.held, true);
  add('standUp', 'urgent', f.prone, true);
  return out;
}

/** The buttons that can be used now, in the bar's order (what the bar showed before greyed buttons). */
export function enabledActions(f: ActionFacts): BarAction[] {
  return actionBar(f).filter((a) => a.enabled);
}

/** The firing-mode chips: one per mode, the selected one (remembered from the last attack, else the first) pressed. */
export function modeChips(modes: readonly string[], remembered: unknown): Array<{ mode: string; active: boolean }> {
  const want = typeof remembered === 'string' && modes.includes(remembered) ? remembered : modes[0];
  return modes.map((mode) => ({ mode, active: mode === want }));
}

/** The Matrix tab's in-the-Matrix buttons: shown greyed until the decker is jacked in. */
export function matrixActionState(jackedIn: boolean): { enabled: boolean; why: string } {
  return jackedIn ? { enabled: true, why: '' } : { enabled: false, why: WHY.notJackedIn };
}

/** Jump in: greyed without a control rig when the rule needs one (RULES.RIGGING.jumpInNeedsVcr). */
export function jumpState(vcr: number, needsVcr: boolean): { enabled: boolean; why: string } {
  return vcr > 0 || !needsVcr ? { enabled: true, why: '' } : { enabled: false, why: WHY.noControlRig };
}
