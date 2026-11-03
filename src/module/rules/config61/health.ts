/**
 * v0.61.0 health rules (all numbers from memory of SR2; VERIFY). Read through RULES.HEALTH_V61.
 * Every number is plain so a house rule can override it.
 * - `docwagon`: DocWagon contracts. `tiers`: per contract `yearlyFee` (¥ per year), `responseMinutes`
 *   (how long until a crew arrives), `htrAvailable` (whether a High Threat Response team is sent at
 *   all into a hostile area), `htrIncluded` (HTR costs nothing extra), `htrFee` (¥ charged when HTR is
 *   sent and not included), `resuscitationFee` (¥ when the client is dead and no free one is left),
 *   `freeResuscitations` (per contract year). `employeeDeathFee`: ¥ per DocWagon employee killed on
 *   the call. `callOn`: the status that calls DocWagon by itself ('deadlyWound' = 'dying': in this
 *   system a full Physical monitor is the 'dying' status). `yearSeconds`: one contract year of world
 *   time. Low confidence on everything but the yearly fees (VERIFY).
 * - `onset`: toxins take effect after their Speed (RULES.TOXINS.speeds; world time, which advances
 *   RULES.TOXINS.secondsPerTurn per Combat Turn in combat). Off: every toxin takes effect at once.
 * - `drugs`: `effectKeys`: the EffectBundle keys (rules/effects.ts) a drug item may carry beyond its
 *   attribute / Reaction / Initiative bonuses (add 'reaction', 'initiativeDice' or 'attributes' to let
 *   the bundle carry those too). Drug-only extras: `ignoreWounds` (ignore wound modifiers, like a
 *   pain editor) and `stunIgnoreBoxes` (Stun boxes that don't count for modifiers), both allowed when
 *   `extras` lists them.
 * - `immunity`: `fireElements`: spell / weapon elements that count as fire damage (stopped by
 *   immunity to fire); `drugsCountAsPoisons`: immunity to poisons also stops drugs.
 */
export const HEALTH_V61 = {
  docwagon: {
    enabled: true,
    tiers: [
      { id: 'basic', label: 'Basic', yearlyFee: 5000, responseMinutes: 10, htrAvailable: false, htrIncluded: false, htrFee: 0, resuscitationFee: 8000, freeResuscitations: 0 },
      { id: 'gold', label: 'Gold', yearlyFee: 25000, responseMinutes: 10, htrAvailable: true, htrIncluded: false, htrFee: 5000, resuscitationFee: 8000, freeResuscitations: 1 },
      { id: 'platinum', label: 'Platinum', yearlyFee: 50000, responseMinutes: 5, htrAvailable: true, htrIncluded: true, htrFee: 0, resuscitationFee: 8000, freeResuscitations: 4 },
    ] as ReadonlyArray<{ id: string; label: string; yearlyFee: number; responseMinutes: number; htrAvailable: boolean; htrIncluded: boolean; htrFee: number; resuscitationFee: number; freeResuscitations: number }>,
    employeeDeathFee: 20000,
    callOn: 'dying' as 'unconscious' | 'dying' | 'deadlyWound' | 'dead',
    yearSeconds: 31536000,
  },
  onset: { enabled: true },
  drugs: {
    effectKeys: ['ballistic', 'impact', 'testsTn', 'perceivedTn', 'attackedTn', 'movementFactor'] as readonly string[],
    extras: ['ignoreWounds', 'stunIgnoreBoxes'] as readonly string[],
  },
  immunity: {
    fireElements: ['fire', 'flame'] as readonly string[],
    drugsCountAsPoisons: true,
  },
} as const;
