/**
 * v0.80.0, the "SR2E Unified Rules Revamp" rules source (area: combat). Read through RULES.URR_V80; the GM picks the
 * source in the world setting "Rules source" (settings.ts). Two exports:
 * - URR_V80_COMBAT: this area's new switches and numbers. Their shipped values are the SR2E Book Rules (the mode off),
 *   so nothing changes unless the GM picks the Unified Rules Revamp.
 * - URR80_PATCH_COMBAT: RULES paths → the value the Unified Rules Revamp uses (existing paths, or 'URR_V80.<key>').
 *   Applied under the GM's own house rules, which still win.
 * Source: the Unified Rule Revamp (URR v1.2), cited as "URR" below; a rule marked "house rule for the Revamp"
 * is not in the URR.
 * Pure logic: rules/urr80-combat.ts.
 *
 * Switches (URR_V80.*; shipped = the book):
 * - cbtTies: initiative ties. Revamp 'natural': higher Reaction, then the natural (unaugmented) Reaction, then the
 *   name (the URR says "simultaneous"; Foundry needs an order). Book 'book': RULES.INITIATIVE_TIES (Reaction, then
 *   Quickness). Source: URR (initiative).
 * - cbtDefense: the defense flow. Revamp 'cleanMiss': no dodge test against a ranged attack; an attack needs one
 *   success; the Defend dialog's Combat Pool dice go to the damage resistance test; Combat Pool successes there above
 *   the attacker's successes are a clean miss; otherwise the attack's net successes are compared with the resistance
 *   successes, every 2 either way stage the damage one level up or down. Opposed melee: the winner's damage is staged
 *   the same way at the resistance test (net melee successes vs resistance successes); full defense adds no dice and no
 *   pool to the melee test (its pool dice go to the resistance test instead). Vehicles, the Matrix, astral combat,
 *   blasts, rams, flamethrowers, elemental spells and suppressive fire keep the book path. Book 'dodge': Combat Pool
 *   dodge vs the attacker's TN, net attack successes stage the hit, the soak stages down per 2; full defense
 *   + Quickness dice. Source: URR (resolving attacks; clean miss and full defense).
 * - cbtKnockdown: Revamp 'urr': whenever damage is dealt, Body vs half the Power (ranged; round down) or the attack's
 *   Power (melee: the URR says the attacker's Strength; the Power is the modified Strength), needing 2 / 3 / 4
 *   successes for L / M / S (Deadly: always down); no successes = down, fewer than needed = staggers 1 m per missing
 *   success. Book 'book': RULES.COMBAT.knockdown (Power over Body, Body vs the soak TN, no successes = down). Source: URR.
 * - cbtReload: Revamp 'quickness': a cylinder or internal magazine takes Quickness rounds per Complex Action, a break
 *   action reloads whole. Book 'book': RULES.COMBAT.reloadFeed. Source: URR (reloading firearms).
 * - cbtStrengthRecoil: Revamp on: Strength 5–6 / 7–8 / 9–10 / 11+ takes 1 / 2 / 3 / 4 off the recoil left after
 *   compensation and heavy doubling (not for vehicle mounts). Book off. Source: URR (citing Fields of Fire).
 * - cbtTracers: Revamp 'urr': tracers only in full auto, −1 TN per third round of the burst, none for a smartgun user;
 *   the tracer rounds add no Power (−1 Power per third round). Book 'book': −1 per burst already fired this phase, to −3.
 *   Source: URR (citing Fields of Fire).
 * - cbtShotgun: Revamp 'urr': a shotgun fires a slug (one target) unless loaded with 'shot' ammunition, which counts
 *   as flechette (DOCS_V79.rangedFlechette.ammoIds) and spreads: the cone starts 1 m wide and doubles every choke metres;
 *   each step, the first included, −1 TN and −1 Power. Book 'book': every shotgun spreads (distance ÷ choke m, −1 Power
 *   per metre; RULES.COMBAT.shotgunTnPerMetre). Source: URR (shotguns and scatter);
 *   shot as flechette: house rule for the Revamp (not in the URR).
 * - cbtScatter: Revamp 'urr': metres off per attack success by type: standard grenade 2, aerodynamic 4, launcher 4;
 *   rockets 2D6 −1 m per success, missiles 2D6 −1 m per success and −1 m per Intelligence (guidance). Book 'book':
 *   RULES.COMBAT.scatter.metresPerSuccess for all, rockets by range band. Source: URR.
 * - cbtBlastStaging: Revamp on: a blast's attack successes stage its damage up as for any attack. Book off. Source: URR.
 * - cbtSubdueTn: subduing in melee, + this TN. Revamp 2, book 0. Source: URR.
 * - cbtChargePower: a charging melee attack, + this Power. Revamp 1 (with COMBAT.charging.tn 0), book 0 (the book's
 *   −1 TN). Source: URR.
 * - cbtArmorPool: Revamp 'pool': worn ballistic armor above Quickness takes 1 Combat Pool die per point and doesn't
 *   lower Quickness. Book 'quickness': RULES.COMBAT.encumbrance (the higher of ballistic and impact over Quickness lowers
 *   Quickness). Source: house rule for the Revamp (not in the URR).
 * - cbtArmorLayers: Revamp on: with COMBAT.armorLayering 'highestPlusHalf', only the next piece adds half (two layers
 *   at most). Book off (every other piece adds half). Source: URR.
 * - cbtGradedCover: Revamp on: the graded cover modifiers (25–50% +2, 51–75% +4, 76–99% +6) count as partial cover, so the
 *   found-by-itself +4 isn't added on top. Book off. Source: URR (citing Fields of Fire).
 *
 * Patched existing paths (Revamp value; book value shipped):
 * - INITIATIVE_WOUNDS.midTurn false (book true): a wound changes initiative only at the next roll. URR.
 * - DELAY.lostAtPassEnd false (book true): a delayed action can carry into a later pass of the Combat Turn. URR.
 * - ATTACK_STAGING 'all' (book 'afterFirst'): every 2 net successes stage up. URR.
 * - COMBAT.melee.tie 'attacker' (book 'none'): a melee tie goes to the active character. URR.
 * - COMBAT.spreadFire.wastedRoundsPerMetre 0 (book 1): full auto at several targets wastes no rounds (the URR lets the
 *   shooter size the bursts).
 * - COMBAT_V72.blastBarriers.holdMultiplier 2 (book 1): a blast is held unless its Power beats twice the rating. URR.
 * - COMBAT.grenades: anti-personnel rockets −1 Power per half metre (book 0.5 per metre), anti-vehicle −8 per metre
 *   (book 0.25). URR.
 * - COMBAT.charging.tn 0 (book −1): see cbtChargePower. URR.
 * - COMBAT.armorLayering 'highestPlusHalf' (book 'highest'): the best piece plus half the next. URR.
 * - COMBAT.demolitions.tn 2 (book 4): Demolitions vs 2, +1 Power per success. URR (citing SRII).
 * - SITUATIONAL_MODIFIERS: the URR's ranged rows added: graded cover +2 / +6 (the +4 row is 51–75%), target running
 *   +2 / sprinting +3 / stationary −1, attacker in melee +2 per opponent (one or two), attacker's cover in the way
 *   +1 / +2 / +3, smart goggles −1. URR (ranged combat modifiers).
 * - COMBAT.ammo: a 'shot' row (shotgun shot, as flechette); DOCS_V79.rangedFlechette.ammoIds + 'shot'. House rule for the
 *   Revamp (not in the URR).
 */
type Level = 'L' | 'M' | 'S' | 'D';

export const URR_V80_COMBAT = {
  cbtTies: 'book' as 'book' | 'natural',
  cbtDefense: 'dodge' as 'dodge' | 'cleanMiss',
  cbtKnockdown: 'book' as 'book' | 'urr',
  /** cbtKnockdown 'urr': successes needed to stay up by wound level (Deadly: always down). */
  cbtKnockdownNeed: { L: 2, M: 3, S: 4 } as Record<Exclude<Level, 'D'>, number>,
  /** cbtKnockdown 'urr': a ranged hit's knockdown TN = Power × this (rounded down). */
  cbtKnockdownRangedFactor: 0.5,
  cbtReload: 'book' as 'book' | 'quickness',
  cbtStrengthRecoil: false as boolean,
  /** cbtStrengthRecoil: [lowest Strength, recoil off], highest first match wins. */
  cbtStrengthRecoilRows: [[11, 4], [9, 3], [7, 2], [5, 1]] as ReadonlyArray<readonly [number, number]>,
  cbtTracers: 'book' as 'book' | 'urr',
  cbtShotgun: 'book' as 'book' | 'urr',
  /** cbtShotgun 'urr': the ammunition id that is shotgun shot (anything else is a slug). */
  cbtShotAmmo: 'shot',
  cbtScatter: 'book' as 'book' | 'urr',
  /** cbtScatter 'urr': metres off per attack success by grenade type; rockets and missiles: dice and metres. */
  cbtScatterPerSuccess: { standard: 2, aerodynamic: 4, launcher: 4 } as Record<'standard' | 'aerodynamic' | 'launcher', number>,
  cbtScatterRocket: { dice: 2, perSuccess: 1, perIntelligence: 0 },
  cbtScatterMissile: { dice: 2, perSuccess: 1, perIntelligence: 1 },
  cbtBlastStaging: false as boolean,
  cbtSubdueTn: 0,
  cbtChargePower: 0,
  cbtArmorPool: 'quickness' as 'quickness' | 'pool',
  cbtArmorLayers: false as boolean,
  cbtGradedCover: false as boolean,
  /** cbtGradedCover: the SITUATIONAL_MODIFIERS ids that are partial cover (only one counts). */
  cbtCoverIds: ['partialCover', 'partialCoverLight', 'partialCoverHeavy'] as readonly string[],
};

/** The shipped situational rows plus the Revamp's (the shipped rows unchanged but the 51–75% label). */
const SITUATIONAL_V80 = [
  { id: 'attackerWalking', label: 'Attacker walking', value: 1 },
  { id: 'attackerRunning', label: 'Attacker running', value: 4 },
  { id: 'calledShot', label: 'Called shot', value: 4 },
  { id: 'partialCoverLight', label: 'Target in partial cover (25–50%)', value: 2 },
  { id: 'partialCover', label: 'Target in partial cover (51–75%)', value: 4 },
  { id: 'partialCoverHeavy', label: 'Target in partial cover (76–99%)', value: 6 },
  { id: 'fullCover', label: 'Target in full cover (blind fire through the barrier)', value: 8 },
  { id: 'targetRunning', label: 'Target running', value: 2 },
  { id: 'targetSprinting', label: 'Target sprinting', value: 3 },
  { id: 'targetStationary', label: 'Target stationary', value: -1 },
  { id: 'attackerInMelee', label: 'Attacker in melee (one opponent)', value: 2 },
  { id: 'attackerInMelee2', label: 'Attacker in melee (two opponents)', value: 4 },
  { id: 'aimImpeded1', label: 'Own cover slightly in the way', value: 1 },
  { id: 'aimImpeded2', label: 'Own cover moderately in the way', value: 2 },
  { id: 'aimImpeded3', label: 'Own cover badly in the way', value: 3 },
  { id: 'smartlink', label: 'Smartlink (smartgun + implant)', value: -2 },
  { id: 'smartGoggles', label: 'Smartlink goggles (smartgun)', value: -1 },
  { id: 'laserSight', label: 'Laser sight', value: -1 },
  { id: 'secondWeapon', label: 'Second weapon (off-hand)', value: 2 },
];

/** RULES.COMBAT.grenades with the URR's rocket falloffs (the other rows as shipped). */
const GRENADES_V80 = [
  { id: 'custom', label: 'Custom (Power per metre below)' },
  { id: 'offensive', label: 'Offensive', perMetre: 1 },
  { id: 'defensive', label: 'Defensive', perMetre: 2 },
  { id: 'concussion', label: 'Concussion', perMetre: 1, damageType: 'stun' },
  { id: 'flash', label: 'Flash', perMetre: 5, effect: 'blind' },
  { id: 'gas', label: 'Gas', perMetre: 1, effect: 'gas' },
  { id: 'heRocket', label: 'Rocket / missile: high explosive', perMetre: 1 },
  { id: 'apRocket', label: 'Rocket / missile: anti-personnel', perMetre: 2 },
  { id: 'avRocket', label: 'Rocket / missile: anti-vehicle', perMetre: 8 },
  { id: 'demolition', label: 'Demolition charge', perMetre: 1 },
  { id: 'smoke', label: 'Smoke', perMetre: 1, effect: 'smoke' },
  { id: 'thermalSmoke', label: 'Thermal smoke', perMetre: 1, effect: 'smoke' },
];

/** RULES.COMBAT.ammo plus shotgun shot (as flechette). */
const AMMO_V80 = [
  { id: 'standard', label: 'Standard', power: 0, stages: 0, armorMultiplier: 1 },
  { id: 'apds', label: 'APDS', power: 0, stages: 0, armorMultiplier: 0.5 },
  { id: 'explosive', label: 'Explosive', power: 1, stages: 0, armorMultiplier: 1 },
  { id: 'exex', label: 'EX-explosive', power: 2, stages: 0, armorMultiplier: 1 },
  { id: 'flechette', label: 'Flechette', power: 0, stages: 1, armorMultiplier: 2 },
  { id: 'gel', label: 'Gel', power: -2, stages: 0, armorMultiplier: 1, armorKind: 'impact', damageType: 'stun' },
  { id: 'tracer', label: 'Tracer', power: 0, stages: 0, armorMultiplier: 1 },
  { id: 'shot', label: 'Shotgun shot', power: 0, stages: 1, armorMultiplier: 2 },
];

export const URR80_PATCH_COMBAT: Record<string, unknown> = {
  'URR_V80.cbtTies': 'natural',
  'INITIATIVE_WOUNDS.midTurn': false,
  'DELAY.lostAtPassEnd': false,
  'URR_V80.cbtDefense': 'cleanMiss',
  'ATTACK_STAGING': 'all',
  'COMBAT.melee.tie': 'attacker',
  'URR_V80.cbtKnockdown': 'urr',
  'URR_V80.cbtReload': 'quickness',
  'URR_V80.cbtStrengthRecoil': true,
  'URR_V80.cbtTracers': 'urr',
  'URR_V80.cbtShotgun': 'urr',
  'COMBAT.ammo': AMMO_V80,
  'DOCS_V79.rangedFlechette.ammoIds': ['flechette', 'shot'],
  'URR_V80.cbtScatter': 'urr',
  'URR_V80.cbtBlastStaging': true,
  'COMBAT_V72.blastBarriers.holdMultiplier': 2,
  'COMBAT.grenades': GRENADES_V80,
  'COMBAT.spreadFire.wastedRoundsPerMetre': 0,
  'URR_V80.cbtSubdueTn': 2,
  'URR_V80.cbtChargePower': 1,
  'COMBAT.charging.tn': 0,
  'URR_V80.cbtArmorPool': 'pool',
  'COMBAT.armorLayering': 'highestPlusHalf',
  'URR_V80.cbtArmorLayers': true,
  'COMBAT.demolitions.tn': 2,
  'SITUATIONAL_MODIFIERS': SITUATIONAL_V80,
  'URR_V80.cbtGradedCover': true,
};
