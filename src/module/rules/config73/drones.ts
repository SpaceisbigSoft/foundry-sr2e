/**
 * v0.73.0: rare vehicle and drone items from the v0.69.0 review (docs/REVIEW-v0.69.md, section 3, O28:
 * [5-A9, 5-A10, 5-A11]). Read through RULES.DRONES_V73 (pure logic in rules/dronelink.ts). Every part
 * has a switch that puts the old behaviour back; numbers recalled from memory are marked VERIFY.
 *
 * - link (5-A9): electronic warfare against a drone's remote-control link, beyond jamming (Rigger 2 as
 *   remembered). Two GM-run steps, each a test by a character with `skill` (defaulting to `attribute`):
 *   - Intercept: pick up and decrypt the link. `intercept.tnFrom` 'encryption' uses the radio rule
 *     (RULES.STREET_V61.radio: base TN `baseInterceptTn`, raised by the link's encryption); 'signal'
 *     uses the link's signal rating plus the encryption. `eccmAddsTn`: the drone's ECCM adds to the TN.
 *     Any success marks the link intercepted by that character (until the GM clears it). `gear`: what
 *     the interceptor needs ('rcdOrRadio': a remote control deck or a radio; 'rcd'; 'none').
 *   - Spoof: send the drone false commands. `needsIntercept`: only over an intercepted link (else the
 *     encryption adds to the TN). TN from `tnFrom` ('rcd': the controlling deck's rating, or the
 *     drone's Pilot when nobody is subscribed; 'pilot': always the drone's Pilot) + `tnMod`, + ECCM when
 *     `eccmAddsTn`. A rigger jumped in by remote: `jumpedIn` 'immune' (the rigger's own commands win),
 *     'harder' (+`jumpedInTn`), 'normal'. Any success: `effect` 'command' (the drone carries out one
 *     false command, the GM plays it; nothing is stored) or 'takeover' (the link is marked spoofed: a
 *     rigger jumped in by remote is pushed out, the drone falls back to its autopilot under the
 *     spoofer's commands, and its own rigger's group commands and remote jump-ins are refused until the
 *     GM clears it). A drone driven by hand, or by a rigger aboard, has no link to attack.
 *   `enabled` false: no intercept or spoof buttons (the old way: jamming only). VERIFY all of it (the
 *   skill may be Electronic Warfare in Rigger 2; the TNs and the jumped-in rule are the least certain).
 * - mounts (5-A10): firmpoints and hardpoints. A vehicle has `firmpoints` and `hardpoints` (sheet
 *   fields; `capacityFrom` 'body' fills a field left at 0 from Body × `firmPerBody` / `hardPerBody`).
 *   Each mounted weapon (mount in `counts`) takes one point: a hardpoint when the weapon needs one
 *   (its own `mountPoint` 'hard', or, left on auto, anti-vehicle, guided, or a name in `hardNames`), else
 *   a firmpoint; a spare hardpoint takes a firmpoint weapon when `hardTakesFirm`. A turret takes a
 *   hardpoint when `turretNeedsHard`. A vehicle with both counts 0 is not tracked (the old way).
 *   `mode` 'block' refuses mounting past the points, 'warn' only warns, 'off' never checks (old).
 *   VERIFY (Rigger 2 / Fields of Fire: which weapons fit a firmpoint, and the Body numbers).
 * - missiles (5-A11): a guided missile (weapon `guidance` > 0) locks on to its target's Signature:
 *   with `signature` on, the target's Signature replaces the range TN against a vehicle (and against a
 *   person too when `vsPeople` 'signature': RULES.VEHICLES.sensors.personSignature). `ecm`: the target
 *   vehicle's ECM above the firer's ECCM adds to the TN (flares, chaff and jamming). `needsLock`: the
 *   firing vehicle must hold a sensor lock on the target first, else the missile flies unguided (no
 *   Intelligence dice, the range TN). `signature` off: the old way (range TN; Intelligence dice only).
 *   VERIFY (SR2 core missile rules and Fields of Fire as remembered).
 */
export type LinkGear = 'rcdOrRadio' | 'rcd' | 'none';
export type SpoofEffect = 'command' | 'takeover';
export type MountPoint = '' | 'firm' | 'hard';

export const DRONES_V73 = {
  link: {
    enabled: true,
    skill: 'Electronics',
    attribute: 'intelligence',
    intercept: {
      tnFrom: 'encryption' as 'encryption' | 'signal',
      eccmAddsTn: false,
      gear: 'rcdOrRadio' as LinkGear,
    },
    spoof: {
      needsIntercept: true,
      tnFrom: 'rcd' as 'rcd' | 'pilot',
      tnMod: 0,
      eccmAddsTn: true,
      jumpedIn: 'immune' as 'immune' | 'harder' | 'normal',
      jumpedInTn: 2,
      effect: 'command' as SpoofEffect,
      gear: 'rcd' as LinkGear,
    },
  },
  mounts: {
    mode: 'warn' as 'block' | 'warn' | 'off',
    capacityFrom: 'sheet' as 'sheet' | 'body',
    /** Points from Body when `capacityFrom` 'body' and the sheet field is 0. VERIFY */
    firmPerBody: 1,
    hardPerBody: 0.5,
    counts: ['fixed', 'turret', 'pintle', 'ring'] as string[], // v0.79.0: + the ring mount
    hardTakesFirm: true,
    turretNeedsHard: false,
    /** Weapons needing a hardpoint when left on auto (lower case; matched inside the name). VERIFY */
    hardNames: ['medium machine gun', 'mmg', 'heavy machine gun', 'hmg', 'assault cannon', 'autocannon', 'cannon', 'minigun', 'vulcan', 'missile', 'rocket'] as string[],
    /** On auto, anti-vehicle weapons and guided missiles need a hardpoint. */
    antiVehicleHard: true,
    guidedHard: true,
  },
  missiles: {
    signature: true,
    vsPeople: 'range' as 'range' | 'signature',
    ecm: true,
    // v0.92.3 (Rigger 2 p. 59): a missile needs a sensor lock, or it won't hit as a guided weapon (was false).
    needsLock: true,
  },
};
