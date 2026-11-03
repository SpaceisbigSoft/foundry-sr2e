import { RULES } from './config.ts';
import { parseFiringModes } from './firing.ts';
import { t as tx } from '../helpers/i18n.ts';

// ---------------------------------------------------------------- Item sheets (v0.41.0)

/** How a weapon's sheet is laid out, from what it is set up as. */
export type WeaponLayout = 'melee' | 'firearm' | 'shotgun' | 'thrown' | 'grenade' | 'launcher' | 'flamethrower';
export const WEAPON_LAYOUT_LABELS: Record<WeaponLayout, string> = {
  melee: 'Melee weapon', firearm: 'Firearm', shotgun: 'Shotgun', thrown: 'Thrown weapon or bow', grenade: 'Grenade',
  launcher: 'Launcher or missile', flamethrower: 'Flamethrower',
};

export function weaponLayout(s: any): WeaponLayout {
  if (s?.melee) return 'melee';
  if (s?.areaKind === 'flame') return 'flamethrower';
  if (s?.shotgun) return 'shotgun';
  if ((s?.guidance ?? 0) > 0 || (s?.blast && s?.antiVehicle)) return 'launcher';
  if (s?.blast) return 'grenade';
  if (s?.strengthRange) return 'thrown';
  return 'firearm';
}

/** Which groups of fields a weapon layout shows (the rest fold under "Show every field"). */
export function weaponSections(layout: WeaponLayout): Record<string, boolean> {
  const ranged = layout !== 'melee';
  const gun = ['firearm', 'shotgun', 'launcher', 'flamethrower'].includes(layout);
  return {
    melee: layout === 'melee',
    strength: layout === 'melee' || layout === 'thrown',
    gun,
    ammo: gun,
    ranges: ranged && layout !== 'thrown',
    strengthRange: layout === 'thrown' || layout === 'grenade',
    blast: layout === 'grenade' || layout === 'launcher',
    shotgun: layout === 'shotgun',
    launcher: layout === 'launcher',
    flame: layout === 'flamethrower',
  };
}

/** Settings that can't work, or quietly do nothing, for an item of this type. */
export function itemWarnings(type: string, s: any): string[] {
  const w: string[] = [];
  if (!s) return w;
  const n = (v: any) => Number(v ?? 0);
  if (type === 'weapon') {
    const r = s.range ?? {};
    const bands = [n(r.short), n(r.medium), n(r.long), n(r.extreme)];
    if (s.melee) {
      // v0.61.0: a stun baton keeps its charges in ammo.
      if ((s.modes && String(s.modes).trim()) || (n(s.ammoMax) > 0 && !s.stunWeapon)) w.push(tx('SR2E.Text.Items.meleeWeaponsUseNoFiring'));
      if (s.blast || s.shotgun || s.areaKind) w.push(tx('SR2E.Text.Items.aMeleeWeaponCanT'));
      if (s.smartgun) w.push(tx('SR2E.Text.Items.aSmartgunLinkDoesNothing'));
    } else {
      if (!s.strengthRange && bands.every((b) => b <= 0)) w.push(tx('SR2E.Text.Items.noRangeBandsEveryShot'));
      else if (!s.strengthRange && bands.some((b, i) => i > 0 && b < bands[i - 1]!)) w.push(tx('SR2E.Text.Items.rangeBandsShouldGrowFrom'));
      if (s.reach > 0) w.push(tx('SR2E.Text.Items.reachOnlyMattersForMelee'));
    }
    if (s.blast && n(s.damagePower) <= 0 && !['smoke', 'thermalSmoke'].includes(String(s.blastKind ?? ''))) w.push(tx('SR2E.Text.Items.aBlastWithPower0'));
    if (s.shotgun && n(s.choke) < 1) w.push(tx('SR2E.Text.Items.aShotgunNeedsAChoke'));
    if (s.blast && s.shotgun) w.push(tx('SR2E.Text.Items.aWeaponIsABlast'));
    if (!s.strengthPower && n(s.damagePower) <= 0 && !s.blast) w.push(tx('SR2E.Text.Items.power0TheWeaponDoes'));
    if (n(s.strengthCap) > 0 && !s.strengthPower && !s.strengthRange) w.push(tx('SR2E.Text.Items.strengthCapDoesNothingWithout'));
    if (n(s.ammoMax) > 0 && n(s.ammo) > n(s.ammoMax)) w.push(tx('SR2E.Text.Items.ammoIsMoreThanThe', { ammo: s.ammo, ammoMax: s.ammoMax }));
    if (s.modes && String(s.modes).trim() && !String(s.modes).toUpperCase().split(/[^A-Z]+/).some((t: string) => ['SS', 'SA', 'BF', 'FA'].includes(t))) w.push(tx('SR2E.Text.Items.firingModesHasNoneOf', { modes: s.modes }));
    if (s.muzzle === 'silencer') {
      const modes = parseFiringModes(s.modes ?? '');
      if (!modes.some((m) => m === 'SS' || m === 'SA')) w.push(tx('SR2E.Text.Items.aSilencerWorksOnlyIn'));
    }
    if (n(s.guidance) > 0 && !s.blast) w.push(tx('SR2E.Text.Items.missileIntelligenceOnlyHelpsA'));
    // v0.43.0
    if (s.melee && (s.laserSight || n(s.scope) > 0 || s.shockPad || (s.support && s.support !== 'none'))) w.push(tx('SR2E.Text.Items.laserSightsScopesShockPads'));
    if ((s.fuse || s.smartGrenade) && !s.blast) w.push(tx('SR2E.Text.Items.aFuseOrSmartGuidance'));
    if (s.smartGrenade && s.fuse === 'impact') w.push(tx('SR2E.Text.Items.anImpactFuseGoesOff'));
  } else if (type === 'armor') {
    if (n(s.ballistic) <= 0 && n(s.impact) <= 0) w.push(tx('SR2E.Text.Items.ballisticAndImpactAreBoth'));
    if (n(s.degraded) > Math.max(n(s.ballistic), n(s.impact))) w.push(tx('SR2E.Text.Items.damagedByMorePointsThan'));
    if (n(s.parry) > 0 && !s.adds) w.push(tx('SR2E.Text.Items.aShieldUsuallyAddsTo'));
  } else if (type === 'cyberware') {
    if (s.bioware) {
      if (n(s.bodyIndex) <= 0) w.push(tx('SR2E.Text.Items.biowareWithBodyIndex0'));
    } else if (n(s.essenceCost) <= 0 && !s.housedIn) w.push(tx('SR2E.Text.Items.essenceCost0IsIt'));
    if (s.kind === 'cyberlimb' && n(s.limb?.strength) <= 0) w.push(tx('SR2E.Text.Items.aCyberlimbWithStrength0'));
    if (s.kind === 'skillwires' && n(s.rating) <= 0) w.push(tx('SR2E.Text.Items.skillwiresRating0CapsEvery'));
  } else if (type === 'skill') {
    if (s.specialization && n(s.specializationRating) <= 0) w.push(tx('SR2E.Text.Items.aSpecializationNeedsARating'));
    if (!s.specialization && n(s.specializationRating) > 0) w.push(tx('SR2E.Text.Items.aSpecializationRatingNeedsA'));
    if (s.concentration && n(s.concentrationRating) <= 0) w.push(tx('SR2E.Text.Items.aConcentrationNeedsARating'));
    if (n(s.specializationRating) > 0 && n(s.specializationRating) <= n(s.rating)) w.push(tx('SR2E.Text.Items.theSpecializationRatingIsNo'));
  } else if (type === 'spell') {
    if (n(s.learnedForce) <= 0) w.push(tx('SR2E.Text.Items.force0ItCanT'));
    if (s.category !== 'combat' && s.resist === 'none' && n(s.targetNumber) <= 0) w.push(tx('SR2E.Text.Items.aNonCombatSpellNeeds'));
    if (s.elemental && !s.element) w.push(tx('SR2E.Text.Items.anElementalSpellNeedsAn'));
  } else if (type === 'focus') {
    if (n(s.rating) <= 0) w.push(tx('SR2E.Text.Items.rating0TheFocusAdds'));
    if (s.active && !s.bonded) w.push(tx('SR2E.Text.Items.activeButNotBondedUnbonded'));
  } else if (type === 'program') {
    if (n(s.rating) <= 0) w.push(tx('SR2E.Text.Items.rating0TheProgramDoes'));
  } else if (type === 'power') {
    if (s.dice === 'rating' && n(s.rating) <= 0) w.push(tx('SR2E.Text.Items.diceFromTheRatingBut'));
    if (s.effect === 'damage' && !s.damageLevel) w.push(tx('SR2E.Text.Items.aDamagingPowerNeedsA'));
    if (s.special === 'allergy' && !s.substance) w.push(tx('SR2E.Text.Items.anAllergyNeedsASubstance'));
  } else if (type === 'gear') {
    if (s.toxin?.kind && n(s.toxin.power) <= 0) w.push(tx('SR2E.Text.Items.aToxinOrDrugWith'));
    if (s.site?.kind && n(s.site.rating) <= 0) w.push(tx('SR2E.Text.Items.aMagicalSiteWithRating'));
    if (s.chip?.kind && n(s.chip.rating) <= 0) w.push(tx('SR2E.Text.Items.aChipWithRating0'));
    if (s.scanner?.kind && n(s.scanner.rating) <= 0) w.push(tx('SR2E.Text.Items.aScannerWithRating0'));
  } else if (type === 'adeptpower') {
    if (n(s.cost) <= 0) w.push(tx('SR2E.Text.Items.powerPointCost0'));
  }
  return w;
}

/** An item template: a type, a name and system values to fill in. */
/** v0.91.0: `shop` = the GM put it "in the shop" (the shop list's "marked" mode). */
export interface ItemTemplate { id: string; type: string; name: string; system: Record<string, unknown>; world?: boolean; shop?: boolean }

/** The built-in templates of a type plus the world's own (world ones first). */
export function templatesFor(type: string, world: readonly ItemTemplate[] = []): ItemTemplate[] {
  return [...world.filter((t) => t.type === type).map((t) => ({ ...t, world: true })), ...RULES.ITEM_TEMPLATES.filter((t) => t.type === type)];
}

/** The flags that make a weapon one kind or another (the item sheet's Kind select). */
export function weaponLayoutFlags(layout: WeaponLayout, s: any = {}): Record<string, unknown> {
  const off = { 'system.melee': false, 'system.blast': false, 'system.shotgun': false, 'system.areaKind': '', 'system.strengthRange': false, 'system.guidance': 0 };
  switch (layout) {
    case 'melee': return { ...off, 'system.melee': true };
    case 'shotgun': return { ...off, 'system.shotgun': true, 'system.choke': Math.max(1, Number(s.choke ?? 1)) };
    case 'thrown': return { ...off, 'system.strengthRange': true };
    case 'grenade': return { ...off, 'system.blast': true, 'system.strengthRange': true };
    case 'launcher': return { ...off, 'system.blast': true, 'system.antiVehicle': true, 'system.guidance': Math.max(1, Number(s.guidance ?? 0)) };
    case 'flamethrower': return { ...off, 'system.areaKind': 'flame' };
    default: return off;
  }
}
