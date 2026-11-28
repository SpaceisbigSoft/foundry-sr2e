/**
 * v0.99.0 rules completeness, cyberware and bioware effects. Read through RULES.WARE_V99. Book rules from the Street
 * Samurai Catalog (SSC), Cybertechnology and Shadowtech that the system did not have (or had differently) before
 * v0.99.0, each with its page in the comment. Each switch's first choice is the book's way (the default); the other
 * ('v980') puts the v0.98.0 behaviour back. Pure logic lives beside it in rules/ware99.ts, the Foundry glue in
 * applications/ware99.ts. The Unified Rules Revamp has no rule of its own for any of these.
 */
export const WARE_V99 = {
  /**
   * Boosted reflexes (SSC p. 87; Cybertechnology pp. 98–99): their recipient can never use wired reflexes or a vehicle
   * control rig. 'book': installing one of them alongside the other is refused for a player (a GM is only warned), and
   * a character who already has both gets a sheet warning. For such a character the better reflex system counts (the
   * existing stacking rule) and a control rig keeps working (VERIFY: the book only forbids the combination; the GM
   * decides which one goes). 'v980': no refusal, no warning.
   */
  boosted: 'book' as 'book' | 'v980',
  /**
   * Cyberlimb Strength and Quickness (Cybertechnology pp. 49–51). 'book': a full or partial cyberlimb's Strength is at
   * least `limbStrength` (a troll's `limbStrengthTroll`), its Quickness at least `limbQuickness` (VERIFY: the book gives
   * no built-in Quickness; the Strength base is used); a full limb's enhancement past `limbFreePoints` points (a
   * troll's Strength past `limbFreePointsTroll`, VERIFY) costs `limbStrengthEssence` Essence a point of Strength and
   * `limbQuicknessEssence` a point of Quickness, added to the limb's own Essence; partial limbs never cost Essence for
   * it (p. 51). The sheet shows the limb's own numbers and warns when the four limbs' average Strength or Quickness is
   * over twice the natural rating or the rating + 4, whichever is lower (pp. 50–51). Tests and attacks marked as made
   * with the limb use its own Strength (and Quickness) as before. 'v980': the limb's Strength and Quickness fields as
   * entered, no Essence for enhancement, no warning.
   */
  limbs: 'book' as 'book' | 'v980',
  limbStrength: 3,
  limbStrengthTroll: 8,
  limbQuickness: 3,
  limbFreePoints: 3,
  limbFreePointsTroll: 0,
  limbStrengthEssence: 0.4,
  limbQuicknessEssence: 0.3,
  /**
   * Leading with a cyberlimb in melee (Cybertechnology p. 50): a melee attack the player marks as made with a cyberarm
   * uses that limb's Strength, at + (the limb's Strength − the four limbs' average Strength, round down) TN; natural
   * limbs count the character's Strength (VERIFY). 'v980': the limb's Strength, no TN.
   */
  limbLead: 'book' as 'book' | 'v980',
  /**
   * Recovery after bioware surgery (Shadowtech p. 6): triple the normal recovery period, cultured bioware (neural
   * bioware is always cultured, GEAR_V923.cultured) double. The bioware works only after it, as before. 'v980': the
   * same recovery as cyberware.
   */
  bioRecovery: 'book' as 'book' | 'v980',
  bioRecoveryFactor: 3,
  bioRecoveryCultured: 2,
  /**
   * The trauma damper on Stun (Shadowtech p. 29): one box off a Stun wound (the damper has no levels), not with a pain
   * editor, and with a damage compensator only once the compensator's boxes are exceeded on both tracks (as
   * HEALTH_V96.traumaDamper does for the Physical shift). 'v980': the damper's rating in boxes off, pain editor and
   * compensator or not.
   */
  damper: 'book' as 'book' | 'v980',
  /**
   * Orthoskin and dermal plating (Shadowtech p. 17: not compatible with dermal armor). 'book': installing one alongside
   * the other is refused for a player (a GM is only warned); a character who has both gets only the better: orthoskin's
   * armor (impact + ballistic) against the plating's Body counted against both (2 × rating), the plating winning a tie;
   * the other gives nothing and the sheet says so. With GEAR_V923.dermal 'armor' (plating as armor) the old
   * "only the armor above" conflict rule stays. 'v980': no refusal; both count (with the old warning).
   */
  orthoskin: 'book' as 'book' | 'v980',
};

const BV = ['book', 'v980'];
/** The house-rules window's rows for WARE_V99 (spread into settings.ts HOUSE_RULES). */
export const HOUSE_WARE_V99: Array<{ path: string; section: string; type: 'number' | 'boolean' | 'select'; choices?: string[]; step?: number }> = [
  ...(['boosted', 'limbs', 'limbLead', 'bioRecovery', 'damper', 'orthoskin'] as const)
    .map((k) => ({ section: 'gear', path: `WARE_V99.${k}`, type: 'select' as const, choices: BV })),
  ...(['limbStrength', 'limbStrengthTroll', 'limbQuickness', 'limbFreePoints', 'limbFreePointsTroll'] as const)
    .map((k) => ({ section: 'gear', path: `WARE_V99.${k}`, type: 'number' as const, step: 1 })),
  ...(['limbStrengthEssence', 'limbQuicknessEssence'] as const)
    .map((k) => ({ section: 'gear', path: `WARE_V99.${k}`, type: 'number' as const, step: 0.05 })),
  ...(['bioRecoveryFactor', 'bioRecoveryCultured'] as const)
    .map((k) => ({ section: 'gear', path: `WARE_V99.${k}`, type: 'number' as const, step: 0.5 })),
];
