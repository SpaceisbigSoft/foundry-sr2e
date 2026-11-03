/**
 * v0.79.0 (social_core): see config79.ts. Verified fixes: the system differed from the official SR2 rules; each
 * switch cites its book. Read through RULES.DOCS_V79.
 * Each switch's first choice is the book's way (the default); the other puts the old behaviour back.
 *
 * - socialDesired: 'docs' — the Social Skill Table's "player's desired result" scale, one pick: advantageous to the
 *   NPC −2, of no value 0, annoying +2, harmful +4, disastrous +6 (`rows`). 'old': the old house checkboxes
 *   (RULES.STREET.social.situations: upper hand −2, their upper hand +2, against their interests +2, costs nothing
 *   −1, bribe −1). Source: SRII Social Skill Table.
 *   (The attitude half of the same table, Suspicious +2 (was +1), is a plain value in RULES.STREET.social.attitudes.)
 * - socialInfluence: 'oneSided' — an Etiquette, Leadership or Negotiation test (`skills`) is the speaker's skill
 *   against TN = the target's mental attribute (RULES.SOCIAL.skills) + the social modifiers; `successes` success(es)
 *   pass, more give a better result; the target doesn't roll. Negotiating pay (and haggling, fencing) stays
 *   opposed, and so do Interrogation, Intimidation and Instruction. 'opposed': both sides roll (old).
 *   Source: SRII p180-182 ("Social Influence Tests").
 * - skillKarma: 'flat' — raising an active (or Build/Repair) skill costs new rating × `general`, a concentration
 *   new rating × `concentration`, a specialization new rating × `specialization`, with no bands by the linked
 *   attribute. Knowledge and language skills keep the old bands (no official change made to them).
 *   'bands': the old UPKEEP.karma.skills bands (× 1.5 / 2 / 2.5 by the attribute) with
 *   SKILLS.concentrationFraction and UPKEEP.karma.specializationFraction. Source: official SR2 rules (book page to
 *   verify), the Karma cost table ("Good Karma Cost for Skills").
 */
export const DOCS_V79_SOCIAL_CORE = {
  socialDesired: {
    mode: 'docs' as 'docs' | 'old',
    rows: [
      { id: 'advantageous', label: 'Advantageous to them', value: -2 },
      { id: 'none', label: 'Of no value to them', value: 0 },
      { id: 'annoying', label: 'Annoying to them', value: 2 },
      { id: 'harmful', label: 'Harmful to them', value: 4 },
      { id: 'disastrous', label: 'Disastrous to them', value: 6 },
    ] as ReadonlyArray<{ id: string; label: string; value: number }>,
  },
  socialInfluence: {
    mode: 'oneSided' as 'oneSided' | 'opposed',
    skills: ['Etiquette', 'Leadership', 'Negotiation'] as readonly string[],
    successes: 1,
  },
  skillKarma: {
    mode: 'flat' as 'flat' | 'bands',
    general: 2,
    concentration: 1.5,
    specialization: 1,
  },
};
