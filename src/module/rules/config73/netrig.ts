/**
 * v0.73.0: the Matrix and rigging holes from the v0.69.0 review (docs/REVIEW-v0.69.md, section 3, O22–O27).
 * Read through RULES.NETRIG_V73 (house rules mutate this object in place); the pure logic is in
 * rules/gridwork.ts. Every fix has a switch, so the GM can put the old behaviour back; rules recalled from
 * memory are marked VERIFY.
 *
 * - logoffHold (O22): Graceful Logoff doesn't get a decker away from black IC that holds them
 *   (MATRIX_V57.blackIcHold): the operation is refused before it is rolled, and a logoff that lands while a
 *   hold has started meanwhile leaves the decker where they are. They must break free (Jack out: the
 *   Willpower test) or be dumped (dump shock). `gmOverride`: the GM may still log a held decker off.
 *   `enabled` false = the old way (Graceful Logoff ignores the hold). VERIFY (VR2's wording on logging off
 *   while engaged).
 * - personaInitiative (O23): a jacked-in decker's persona damage (the Matrix condition monitor's wound
 *   modifier, the same bands as on Matrix tests, MATRIX_V57.wounds) lowers their Matrix initiative as body
 *   wounds do (RULES.INITIATIVE_WOUNDS). `combine` 'add' (body and persona penalties add up) or 'max' (the
 *   worse of the two). `enabled` false = the old way (body wounds only). VERIFY (whether VR2 applies icon
 *   damage to initiative at all).
 * - knownHosts (O24): players' log-on, Move and agent-search lists show only the hosts their character knows:
 *   'located' (logged on to, found with Locate LTG number, its LTG number known, its parent grid) or
 *   'analyzed' (Analyze host: shows its code and Security Value). `gmSeesAll`: the GM sees every host with
 *   its code. `grids`: LTGs and RTGs (public grids) are always 'located', always 'analyzed' (code shown),
 *   or 'hidden' (need finding like hosts). `onEntry`: what logging on (or the GM's Move) teaches about the
 *   host: 'located' (VR2: the code needs Analyze) or 'analyzed'. `parentKnown`: the grid above the current
 *   node is always located (Graceful Logoff goes there). `byNumber`: a host whose LTG number the decker knows
 *   counts as located. `enabled` false = the old way (everyone sees every host and its code).
 * - ram (O25): `afterDefense`: the rammer's damage button comes on the target's defense card, and only when
 *   the ram connects after the defense (false: on the attack card as soon as the driving test scores a
 *   success, the old way). `passengers`: the people aboard the ramming vehicle take the passenger share of
 *   its damage like the rammed vehicle's passengers do (false: they take none, the old way). VERIFY
 * - controlRig (O26): the control rig's TN bonus (RULES.RIGGING.vcr.tnPerLevel × level, already on driving
 *   and sensor tests) on every vehicle test a jumped-in rigger makes: `gunnery` (a mounted weapon fired by
 *   the jumped-in driver, or a security rigger jumped into a site's system) and `evasion` (the Control-Pool
 *   dodge when the rigger can't make a driving test; the driving-test dodge has it already). false = the old
 *   way for that test. VERIFY (SR2's control rig TN bonus itself is low-confidence; set
 *   RIGGING.vcr.tnPerLevel to 0 to drop it everywhere).
 * - sensorLocks (O27): a sensor lock lapses `turns` Combat Turns after the sensor test that made or last
 *   refreshed it (out of combat, `turns` × `secondsPerTurn` seconds of world time; 0 = no time limit), when
 *   the target is more than the vehicle's Sensor rating × `maxMetresPerRating` metres away (`range`), when the
 *   target is no longer on the vehicle's scene (`offScene`), and when the vehicle's sensors are shot out
 *   (`sensorsOut`). `enabled` false = the old way (a lock lasts until dropped on the sheet or a later sensor
 *   test on that target fails). VERIFY (Rigger 2: a lock is kept turn to turn while in range; the numbers
 *   are mine).
 */
export const NETRIG_V73 = {
  logoffHold: { enabled: true, gmOverride: true },
  personaInitiative: { enabled: true, combine: 'add' as 'add' | 'max' },
  knownHosts: {
    enabled: true,
    gmSeesAll: true,
    grids: 'located' as 'located' | 'analyzed' | 'hidden',
    onEntry: 'located' as 'located' | 'analyzed',
    parentKnown: true,
    byNumber: true,
  },
  ram: { afterDefense: true, passengers: true },
  controlRig: { gunnery: true, evasion: true },
  sensorLocks: {
    enabled: true,
    turns: 3,
    secondsPerTurn: 3,
    range: true,
    maxMetresPerRating: 1000,
    offScene: true,
    sensorsOut: true,
  },
};
