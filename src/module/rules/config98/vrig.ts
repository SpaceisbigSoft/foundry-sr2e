/**
 * v0.98.0 rules completeness, rigging, drones, sensors and electronic warfare. Read through RULES.VRIG_V98. Book rules
 * from Rigger 2 (which replaces the Core Rulebook's vehicle rules, Rigger 2 p. 20) that the system did not have before
 * v0.98.0, each with its page in the comment. Each select's first choice is the book's way (the default); the other
 * ('v971') puts the v0.97.1 behaviour back; the optional book rule (`ed`) ships 'off'. Pure logic lives beside it in
 * rules/vrig98.ts, the Foundry glue in applications/vrig98.ts.
 */
export const VRIG_V98 = {
  /**
   * Other cyberware on the control rig (Rigger 2 p. 17): each level of move-by-wire lowers the rig's effective level by 1
   * for its Reaction and Initiative bonuses (none once it equals the rig) and the Control Pool by 1; an encephalon's
   * Intelligence bonus raises Reaction (the Control Pool too, p. 16) while rigging. A cerebral booster's Intelligence is
   * already an attribute bonus, so it counts through Reaction as before. 'v971': neither.
   */
  rigWare: 'book' as 'book' | 'v971',
  /**
   * The ECM Test (Rigger 2 p. 31): an opposed test outside the Combat Turn: the jammer rolls its ECM's Flux (rating × 1.5,
   * round up, p. 30) against the scanner's Sensor Rating, the scanner its sensors' Flux against the ECM Rating; the jammer
   * winning raises its Signature by its successes. ECCM: the scanner's ECCM against the ECM Rating, opposed by the ECM
   * Rating against the ECCM; its net successes take jammer successes off. Rolled with each Sensor Test. 'v971': the
   * target's ECM beyond the scanner's ECCM on the TN.
   */
  ecmTest: 'book' as 'book' | 'v971',
  /**
   * Electronic deception, an optional rule (Rigger 2 p. 32): the target's ED dice against the scanner's Sensor Rating,
   * +1 Signature per success; the scanner's ECD dice against the ED Rating take one each off, and the ECD drains its
   * Flux. With it on, ECD is counter-deception, not the v0.25.0 scan-noticing roll. Off by default (the book's
   * optional rule).
   */
  ed: 'off' as 'off' | 'book',
  /** The Sensor Test Results Table (Rigger 2 p. 28): what the successes tell (contact, general, positive, distinguishing). 'v971': not shown. */
  sensorResults: 'book' as 'book' | 'v971',
  /**
   * Missile Combat (Rigger 2 p. 59): missiles strike at the end of the Combat Turn (Combat Phase 0), the card says so;
   * continuous lock mode adds half the vehicle's Sensor (round down) to the missile's Intelligence, and the vehicle's
   * other Driving Tests that turn get +2; fire-and-forget adds nothing. 'v971': no fire mode, no timing line.
   */
  missiles: 'book' as 'book' | 'v971',
  /**
   * Weapon mounts share the Body (Rigger 2 pp. 22, 131): a hardpoint takes 2 points, a firmpoint 1, and all of them
   * together at most the vehicle's Body; the sheet's points when set, else the weapons themselves fill the budget.
   * 'v971': separate firmpoint and hardpoint counts (both 0: not tracked).
   */
  mountBudget: 'book' as 'book' | 'v971',
  /**
   * Network drones (Rigger 2 p. 66): every drone in a remote control network acts in the rigger's Combat Phase, the
   * rigger first (robots roll their own, p. 67, not modelled). 'v971': each drone rolls its own Initiative.
   */
  dronePhase: 'book' as 'book' | 'v971',
  /**
   * Comprehension Tests (Rigger 2 p. 66): a drone sent a command rolls its Pilot against the command's TN
   * (`comprehensionTn`, the GM's rating of it on the Skill Success Table); a rigger jumped into a primary drone gives the
   * others +2 (p. 65); the rigger's Non-Matrix Programming specialization adds dice up to the Pilot; no success, the
   * drone doesn't act on it. 'v971': no test.
   */
  comprehension: 'book' as 'book' | 'v971',
  /** The Comprehension Test's TN when the GM doesn't set one (Rigger 2 p. 66; SRII p. 68 "average" 4). VERIFY */
  comprehensionTn: 4,
  /**
   * The captain's chair (Rigger 2 p. 65): a rigger supervising the network from the remote control deck keeps the
   * control rig's Initiative bonus (no Combat or Control Pool on drone tests, as group commands already roll). 'v971':
   * the rig's Initiative only when jumped in.
   */
  captainsChair: 'book' as 'book' | 'v971',
  /**
   * Flux and range (Rigger 2 p. 30): the remote link's Flux gets the situational range modifiers (high elevation +4,
   * electrical storm −2, humid air −0.5, urban −1: the scene's, set by the GM; encryption −0.5; ECCM −half), rounded
   * down to the nearest half; a half step reaches halfway between the table's ranges (VERIFY). 'v971': the plain Flux.
   */
  flux: 'book' as 'book' | 'v971',
  /**
   * MIJI (Rigger 2 pp. 69–72): meaconing, intrusion, jamming and interference as the opposed MIJI Test (intruder: own
   * deck's Flux against the target deck's rating; defender: own deck's Flux against the intruder's protocol emulation
   * module, or its ECM for jamming); net successes are boxes on the network's Signal Monitor (command, simsense, system
   * channels; 1 / 3 / 6 boxes +1 / +2 / +3 TN, 10 cuts the channel); ECCM regenerates 1 box per 2 successes against the
   * intruder's deck or ECM + 3. 'v971': the link spoof and the jam roll as before.
   */
  miji: 'book' as 'book' | 'v971',
};

const BV = ['book', 'v971'];
const sel = (k: keyof typeof VRIG_V98, choices = BV) => ({ section: 'vehiclesAndRigging', path: `VRIG_V98.${k}`, type: 'select' as const, choices });
/** The house-rules window's rows for VRIG_V98 (spread into settings.ts HOUSE_RULES). */
export const HOUSE_VRIG_V98: Array<{ path: string; section: string; type: 'number' | 'boolean' | 'select'; choices?: string[]; step?: number }> = [
  sel('rigWare'), sel('ecmTest'), sel('ed', ['off', 'book']), sel('sensorResults'), sel('missiles'), sel('mountBudget'),
  sel('dronePhase'), sel('comprehension'), { section: 'vehiclesAndRigging', path: 'VRIG_V98.comprehensionTn', type: 'number', step: 1 },
  sel('captainsChair'), sel('flux'), sel('miji'),
];
