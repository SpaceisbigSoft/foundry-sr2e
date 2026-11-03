/**
 * v0.72.0: combat and gear items from the v0.69.0 review (docs/REVIEW-v0.69.md, section 3, O1–O7).
 * Read through RULES.COMBAT_V72 (pure logic in rules/fieldsfire.ts). Every row is a house-rule switch, so
 * the GM can put the old behaviour back; numbers recalled from memory are marked VERIFY.
 *
 * - blastBarriers (O1): a wall between a blast and a target. `mode` 'rating' (SR2 as remembered): Power
 *   at the wall is compared with the wall's barrier rating × `holdMultiplier`; at or below it the wall
 *   holds and stops the blast; above it the blast goes through with Power − rating × `reduceMultiplier`
 *   (the wall can then be damaged by the GM's Damage barriers button). 'armor': the rating adds to the
 *   target's armor, as gunfire does. 'block': any movement-blocking wall stops the blast (the old way).
 *   `unratedWalls`: a wall with no SR2 barrier rating set 'block's completely (as before) or counts
 *   RULES.COMBAT.barriers.defaultWallRating ('default'). VERIFY (multipliers, and whether a held wall
 *   also reflects the blast: the confined-space rule covers that already).
 * - aim (O2): `keepAcrossTurns`: Take Aim lasts into the next Combat Turn while the aimer does nothing else
 *   (false: lost at the end of the turn, the old way). `capBy` 'rolled': the aim cap is half the rating
 *   actually rolled (specialization or concentration); 'base': the base skill (the old way). VERIFY
 * - immunity (O3): immunity to normal weapons stops an attack outright when its modified Power doesn't
 *   exceed the immunity armor (`stopsWeak`; false = it only adds armor, the old way). `compare`
 *   'immunity' (the immunity armor alone) or 'allArmor' (with worn armor too). `ammoCounts`: APDS and
 *   similar ammo multipliers lower the immunity value for this check. VERIFY (may be SR3's hardened armor).
 * - calledShotGap (O4): which armor a called shot "at a gap" bypasses: ids from 'worn', 'adept', 'cyber',
 *   'limb', 'effect'. SR2 as remembered: worn armor only; the old way bypassed worn, adept, cyber and limb.
 * - meleeSmoke (O5): smoke counts in melee as it does at range (false: light only, the old way).
 * - ammo (O6): `dataDriven`: the ammunition list is RULES.COMBAT.ammo plus `extra` (an id in `extra`
 *   replaces the same id in the base list); the GM adds rows in the Advanced JSON. false = RULES.COMBAT.ammo
 *   only. Rows: id, label, power (added), stages (staged up), armorMultiplier, and optionally armorKind,
 *   damageType, setLevel (a fixed damage level), electrical, antiVehicle. The shipped extra rows are from
 *   memory of Fields of Fire: VERIFY.
 * - indirect (O7): indirect fire (Fields of Fire) for blast weapons that can lob (a weapon flagged
 *   `indirect`, or a blast weapon fired with one of `skills`). The firer needs no line of sight but needs a
 *   spotter (or `noSpotter` 'blind': fire blind at RULES.COMBAT.cover.blindFireTn; 'block': not allowed).
 *   `linkTn`: TN by how the spotter passes the target (voice, a datalink, a laser designator). `skill`: ''
 *   fires with the weapon's own skill, else this skill. Scatter: `extraScatterDice` more dice and ×
 *   `scatterMultiplier` metres; each spotter success takes `metresPerSpotterSuccess` metres off. Walking
 *   fire in: each earlier shot at the same spot this combat adds `adjustTnPerShot` (to `adjustMax`).
 *   All VERIFY.
 */
export interface AmmoRow {
  id: string;
  label: string;
  power: number;
  stages: number;
  armorMultiplier: number;
  armorKind?: 'ballistic' | 'impact';
  damageType?: 'physical' | 'stun';
  /** v0.72.0: a fixed damage level (e.g. electrical stun rounds), applied after `stages`. */
  setLevel?: 'L' | 'M' | 'S' | 'D';
  /** v0.72.0: electrical damage (a hook for grounding gear and insulation; informational now). */
  electrical?: boolean;
  /** v0.72.0: hits vehicles and barriers as anti-vehicle. */
  antiVehicle?: boolean;
}

export type GapArmorPart = 'worn' | 'adept' | 'cyber' | 'limb' | 'effect';
export type SpotterLink = 'none' | 'voice' | 'datalink' | 'designator';

export const COMBAT_V72 = {
  blastBarriers: {
    mode: 'rating' as 'rating' | 'armor' | 'block',
    unratedWalls: 'block' as 'block' | 'default',
    /** The wall holds when Power at the wall ≤ rating × this. VERIFY (some remember × 2). */
    holdMultiplier: 1,
    /** Power lost passing through: rating × this. VERIFY */
    reduceMultiplier: 1,
  },
  aim: {
    keepAcrossTurns: true,
    capBy: 'rolled' as 'rolled' | 'base',
  },
  immunity: {
    stopsWeak: true,
    compare: 'immunity' as 'immunity' | 'allArmor',
    ammoCounts: false,
  },
  calledShotGap: {
    bypasses: ['worn'] as GapArmorPart[],
  },
  meleeSmoke: true,
  ammo: {
    dataDriven: true,
    extra: [
      // Fields of Fire, from memory (VERIFY every number): electrical stun rounds against half impact armor.
      { id: 'stickShock', label: 'Stick-n-Shock', power: -2, stages: 0, armorMultiplier: 0.5, armorKind: 'impact', damageType: 'stun', setLevel: 'S', electrical: true },
      // Assault cannon and anti-vehicle rounds: full damage against vehicles. VERIFY
      { id: 'antiVehicle', label: 'Anti-vehicle (AV)', power: 0, stages: 0, armorMultiplier: 0.5, antiVehicle: true },
    ] as AmmoRow[],
  },
  indirect: {
    enabled: true,
    /** Which blast weapons may fire indirect besides those flagged `indirect` (by skill name). */
    skills: ['Launch Weapons', 'Gunnery'] as string[],
    /** '' = the weapon's own skill. */
    skill: '',
    noSpotter: 'blind' as 'blind' | 'block',
    /** TN by the spotter's link to the firer. VERIFY */
    linkTn: { voice: 2, datalink: 1, designator: 0 } as Record<Exclude<SpotterLink, 'none'>, number>,
    extraScatterDice: 1,
    scatterMultiplier: 2,
    metresPerSpotterSuccess: 2,
    /** The most spotter successes that count (the spotter's Perception successes are typed into the dialog). */
    maxSpotterSuccesses: 6,
    adjustTnPerShot: -1,
    adjustMax: -3,
  },
};
