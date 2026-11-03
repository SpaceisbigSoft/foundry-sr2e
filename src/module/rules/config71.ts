/**
 * v0.71.0: the common rules holes from the v0.69.0 review (docs/REVIEW-v0.69.md, section 2, R1–R21).
 * Every row is a house-rule switch, so the GM can put the old behaviour back; numbers recalled from
 * memory are marked VERIFY.
 *
 * - contestKarma (R1): Karma Pool re-rolls, avoid-disaster and bought successes on contest and street
 *   cards (perceive, sneak, social and negotiated pay, legwork, finding gear, haggling, fencing), on the
 *   side of each actor who rolled.
 * - contestSkillDice (R2): the sneaker's Stealth and the observer's Perception in contests go through the
 *   shared skill-dice path (named-skill gear, adept skill powers, skillsofts, articulation).
 * - specialization (R3): at creation a specialization or concentration is paid for by lowering the general
 *   skill: each point the narrower rating rises above the paid rating lowers the general skill by `ratio`
 *   points. VERIFY (the ratio).
 * - creationFoci (R21): foci added in the creation wizard are bonded with starting spell points
 *   ('spellPoints': their bonding Karma counts against the spell points) or for nothing ('free', the old way).
 * - riggerDodge (R5): a jumped-in rigger dodges with the vehicle skill + Control Pool ('skill'), or the
 *   Control Pool alone (the old way, 'pool'). VERIFY.
 * - mpcpCaps (R7): programs rated above the (damaged) MPCP: 'cap' runs them at the MPCP and lowers persona
 *   values above it; 'warn' only warns (the old way).
 * - activeMemory (R8): loading a program that doesn't fit in active memory: 'block' or 'warn' (the old way).
 * - sheafOnGenerated (R9): hosts made by the NPC generator and the safehouse builder get a generated sheaf.
 * - counterWeaponExtras (R10): a melee counterattack keeps the defending weapon's extras (stun, silver,
 *   poison, bone lacing, subduing).
 * - dispelShrinks (R11): a partly dispelled spell's effect shrinks with its successes.
 * - invisibilityEverywhere (R12): spells, critter powers, banishing, notice, sneak, guard sweeps, group and
 *   mounted attacks and melee defense try to see through an invisibility spell first.
 * - holds (R13): binding stops movement; a grapple hold restrains and ends when the holder goes down or the
 *   combat ends; berserk shows as a status.
 * - helperCovers (R14) is not a switch: the your-turn helper knows every button that costs an action.
 * - fireTwice (R16): which weapons may fire twice in one phase: 'SA' (SR2: semi-automatic only) or 'SA+SS' (the old way). VERIFY
 * - astralSwitchCost (R19): switching to astral perception or projection costs an action
 *   (RULES.ACTIONS.costs.astralPerceive / astralProject).
 * - conjureDrainAtEnd (R20): a timed elemental summoning's drain is resisted when it finishes, and
 *   summonings under way count against the bound-elemental limit.
 * - vehicleRepair (R18): the B/R tools at hand change the repair TN (a shop is needed, VERIFY); the repair also fixes
 *   shot-out parts (tires, engine, sensors); a destroyed vehicle needs a full rebuild, not box by box.
 */
export const FIXES_V71 = {
  contestKarma: true,
  contestSkillDice: true,
  specialization: { tradeAtCreation: true, ratio: 1 },
  creationFoci: 'spellPoints' as 'spellPoints' | 'free',
  riggerDodge: 'skill' as 'skill' | 'pool',
  mpcpCaps: 'cap' as 'cap' | 'warn',
  activeMemory: 'block' as 'block' | 'warn',
  sheafOnGenerated: true,
  counterWeaponExtras: true,
  dispelShrinks: true,
  invisibilityEverywhere: true,
  holds: true,
  fireTwice: 'SA' as 'SA' | 'SA+SS',
  astralSwitchCost: true,
  conjureDrainAtEnd: true,
  vehicleRepair: {
    enabled: true,
    /** The tools a vehicle repair needs (CHARACTERS_V58.tools levels: less adds TN by the same table). VERIFY */
    needs: 'shop' as string,
    /** Each success fixes one shot-out part (tires, engine, sensors) before boxes. VERIFY */
    partsFirst: true,
    /** A destroyed vehicle: 'rebuild' (a full rebuild project at `rebuildFactor` × the normal time) or 'boxes' (the old way). */
    destroyed: 'rebuild' as 'rebuild' | 'boxes',
    rebuildFactor: 2,
  },
};
