/**
 * v0.92.3 book alignment: Gear, cyberware and bioware. Read through RULES.GEAR_V923. Every value here was checked against the SR2 books
 * (book and page in each comment). Each switch's first choice is the book's way (the default); the other puts the
 * old v0.92.2 behaviour back. Under the Unified Rules Revamp source every switch reads as its old choice
 * (rules/gear923.ts `gearBook`), so the Revamp behaves exactly as before.
 *
 * - grades: 'book' — ware grades cost Essence × 0.8 / 0.6 / 0.5 (alpha, beta, delta) rounded up to the hundredth and
 *   never below .05, and nuyen × 3 / 7 / 10 (SSC Custom Cyberware; Cybertechnology p. 44). 'old': beta × 0.7,
 *   nuyen × 2 / 4 / 8, no rounding up.
 * - essenceZero: 'survive' — only Essence below 0 kills; exactly 0 is survivable (Core p. 246). 'dead': 0 is death.
 * - dermal: 'body' — dermal plating adds its rating to Body (Core p. 248) instead of being armor, and stops
 *   flechette's extra Damage Level (Core p. 93). 'armor': its rating is ballistic and impact armor (the old way).
 * - limbPairs: 'body' — each pair of full cyberarms or cyberlegs counts as a level of dermal armor, +1 Body (Core
 *   p. 249; Cybertechnology p. 49). 'off': no bonus.
 * - limbHoused: 'book' — ware housed in a cyberlimb costs its full Essence except the short list of Cybertechnology
 *   p. 49 (fingertip compartment, spurs and razors 0; smartlinks and orientation systems .25; tactical computer
 *   −25%). 'capacity': housed ware costs no Essence, only the limb's capacity (the old way).
 * - boneLacing: 'book' — plastic +1 Body; aluminum +1 Body, +1 impact; titanium +2 Body, +1 impact, +1 ballistic
 *   (armor that adds to worn armor); with three cyber replacements the lacing armor is 1 less, with more no bonus at
 *   all (Shadowtech p. 42; Cybertechnology pp. 49–50). 'dice': +1/+2/+3 Body dice on damage resistance only.
 * - bioware: 'book' — Shadowtech's effects: muscle augmentation +1 Quickness and +1 Strength per level (p. 35);
 *   adrenal pump also +2 Reaction per level, its Quickness not raising Reaction (p. 19); cerebral booster 2 a Task
 *   Pool die (p. 23); orthoskin +1/0, +1/+1, +2/+1 impact/ballistic (p. 17); enhanced articulation +1 die on every
 *   Active Skill and +1 Reaction (p. 34); pain editor −1 Intelligence, no general Perception penalty (p. 26).
 *   'old': the v0.92.2 effects.
 * - wareTables: 'book' — the statblock importer's Essence and Body Cost guesses follow the book (boosted reflexes'
 *   Reaction, cyberhands, skillwires, filtration, encephalon, vision magnification, muscle augmentation, adrenal pump,
 *   cerebral booster, synaptic accelerator, orthoskin, suprathyroid, mnemonic enhancer). 'old': the old guesses.
 * - awakenedBioware: 'essence' — a magician or adept pays Essence equal to the bioware's Body Cost (Shadowtech p. 5),
 *   so Magic falls through Essence. 'magic': Magic −floor(Body Index × 0.5) (the old way).
 * - overBodyIndex: 'shock' — over the Body Index the character is in system shock: +1 TN per point (or part) over
 *   on Body tests (Shadowtech p. 6). 'rejection': the old rejection test.
 * - (Body Index on healing: one switch, RULES.HEALTH_V923.bodyIndexHealing.)
 * - cultured: 'book' — cultured bioware costs Body Cost × .75; neural bioware is always cultured and its listed cost
 *   and Body Cost already count it (Shadowtech p. 6). 'old': no Body Cost change; ×4 nuyen on neural ware too.
 * - adrenalCrash: 'book' — an adrenal pump runs 1D6 turns per level; afterwards Deadly Stun with Power = half the
 *   turns (rounded down), resisted with Body (Shadowtech p. 19). 'old': Body vs 6, Moderate/Serious Stun.
 * - load: 'book' — Strength × 5 kg free; × 10 counts as a Light Stun wound, × 15 Moderate (no running, half
 *   movement), × 20 Serious (quarter movement), more and the character passes out (Core p. 185). 'old': Strength ×
 *   10 kg free, then −1 Quickness per Strength × 5 kg over.
 * - armorEncumbrance: 'book' — only heavy armor (partial and full suits, a helmet with them) costs 1 Combat Pool
 *   die per point of Ballistic over Quickness (Core p. 84). 'old': any worn armor over Quickness lowers Quickness.
 * - surgery: 'book' — installing cyberware: Biotech vs 10 − the Essence left after it (rounded down); the successes
 *   change its Essence cost by +15% (none), +10% (1), 0 (2–3), −10% (4–5) or −20% (6+) (Cybertechnology pp. 53–54);
 *   no successes still installs it. 'old': Biotech vs 4 + grade; no successes is complications.
 * - (The surgery wound's size bands: one switch, RULES.HEALTH_V923.surgeryBands.)
 * - cyberDamage: 'book' — a Serious or Deadly physical wound checks for system damage: 1D6 − 4 (Serious) or − 2
 *   (Deadly) systems hit, picked at random (a repeat hits nothing); each rolls 1D6 for its damage (Moderate or worse
 *   stops it working; 7 destroyed); alpha, beta and delta ware rolls 5 dice against 5/6, 4/5, 3/4 and one success
 *   ignores the damage (Shadowtech p. 36; Cybertechnology p. 44). 'old': the GEAR.cyberDamage roll.
 * - filtration: 'opposed' — a toxin or gas opposes the filtration system's rating (each rolls against the other); a
 *   filter that wins stops it, one that fails adds nothing (Core p. 248). 'dice': the rating adds resistance dice.
 */
export const GEAR_V923 = {
  grades: 'book' as 'book' | 'old',
  essenceZero: 'survive' as 'survive' | 'dead',
  dermal: 'body' as 'body' | 'armor',
  limbPairs: 'body' as 'body' | 'off',
  limbHoused: 'book' as 'book' | 'capacity',
  boneLacing: 'book' as 'book' | 'dice',
  bioware: 'book' as 'book' | 'old',
  wareTables: 'book' as 'book' | 'old',
  awakenedBioware: 'essence' as 'essence' | 'magic',
  overBodyIndex: 'shock' as 'shock' | 'rejection',
  cultured: 'book' as 'book' | 'old',
  adrenalCrash: 'book' as 'book' | 'old',
  load: 'book' as 'book' | 'old',
  armorEncumbrance: 'book' as 'book' | 'old',
  surgery: 'book' as 'book' | 'old',
  cyberDamage: 'book' as 'book' | 'old',
  filtration: 'opposed' as 'opposed' | 'dice',
};

/** The book's numbers behind GEAR_V923 (not house-rule rows; kept here so tests and the guide read one place). */
export const GEAR_V923_TABLES = {
  /** SSC Custom Cyberware; Cybertechnology p. 44. */
  gradeEssence: { standard: 1, alpha: 0.8, beta: 0.6, delta: 0.5 } as Record<string, number>,
  gradeCost: { standard: 1, alpha: 3, beta: 7, delta: 10 } as Record<string, number>,
  gradeMinEssence: 0.05,
  /** The old (v0.92.2) grade numbers, for grades 'old'. */
  oldGradeEssence: { standard: 1, alpha: 0.8, beta: 0.7, delta: 0.5 } as Record<string, number>,
  oldGradeCost: { standard: 1, alpha: 2, beta: 4, delta: 8 } as Record<string, number>,
  /** Graded ware resisting system damage: 5 dice vs [Serious, Deadly] (Cybertechnology p. 44). */
  gradeResist: { alpha: [5, 6], beta: [4, 5], delta: [3, 4] } as Record<string, [number, number]>,
  gradeResistDice: 5,
  /** Bone lacing (Shadowtech p. 42). */
  boneLacing: {
    plastic: { body: 1, impact: 0, ballistic: 0 },
    aluminum: { body: 1, impact: 1, ballistic: 0 },
    titanium: { body: 2, impact: 1, ballistic: 1 },
  } as Record<string, { body: number; impact: number; ballistic: number }>,
  /** Orthoskin impact/ballistic by level (Shadowtech p. 17). */
  orthoskin: [[1, 0], [1, 1], [2, 1]] as ReadonlyArray<readonly [number, number]>,
  /** Surgery (Cybertechnology pp. 53–54): Essence cost change by successes, [min successes, factor]. */
  surgeryEssence: [[6, 0.8], [4, 0.9], [2, 1], [1, 1.1], [0, 1.15]] as ReadonlyArray<readonly [number, number]>,
  /** System damage (Shadowtech p. 36): 1D6 − this many systems, by wound; the die for each system → its damage. */
  systemsHitLess: { S: 4, D: 2 } as Record<string, number>,
  /** Index = the die (0–7): '' none, then L, M, S, D, 'X' destroyed. */
  systemDamage: ['', 'L', 'L', 'M', 'M', 'S', 'D', 'X'] as readonly string[],
  /** Carrying (Core p. 185): Strength × kg for each step; the wound it counts as; movement factor. */
  load: [
    { times: 5, level: '', boxes: 0, move: 1, run: true },
    { times: 10, level: 'L', boxes: 1, move: 1, run: true },
    { times: 15, level: 'M', boxes: 3, move: 0.5, run: false },
    { times: 20, level: 'S', boxes: 6, move: 0.25, run: false },
  ] as ReadonlyArray<{ times: number; level: string; boxes: number; move: number; run: boolean }>,
  /** Cultured bioware's Body Cost (Shadowtech p. 6). */
  culturedBodyCost: 0.75,
  /** Ware housed in a cyberlimb (Cybertechnology p. 49): [name pattern, Essence or null, factor]. */
  limbHoused: [
    { re: 'fingertip', essence: 0 },
    { re: 'spur', essence: 0 },
    { re: 'razor', essence: 0 },
    { re: 'smart\\s*-?(?:gun\\s*)?link', essence: 0.25 },
    { re: 'orientation', essence: 0.25 },
    { re: 'tactical\\s*computer', factor: 0.75 },
  ] as ReadonlyArray<{ re: string; essence?: number; factor?: number }>,
};

/** The house-rules window's rows for GEAR_V923 (spread into settings.ts HOUSE_RULES). */
export const HOUSE_GEAR_V923: Array<{ path: string; section: string; type: 'number' | 'boolean' | 'select'; choices?: string[]; step?: number }> = [
  { section: 'gear', path: 'GEAR_V923.grades', type: 'select', choices: ['book', 'old'] },
  { section: 'gear', path: 'GEAR_V923.essenceZero', type: 'select', choices: ['survive', 'dead'] },
  { section: 'gear', path: 'GEAR_V923.dermal', type: 'select', choices: ['body', 'armor'] },
  { section: 'gear', path: 'GEAR_V923.limbPairs', type: 'select', choices: ['body', 'off'] },
  { section: 'gear', path: 'GEAR_V923.limbHoused', type: 'select', choices: ['book', 'capacity'] },
  { section: 'gear', path: 'GEAR_V923.boneLacing', type: 'select', choices: ['book', 'dice'] },
  { section: 'gear', path: 'GEAR_V923.bioware', type: 'select', choices: ['book', 'old'] },
  { section: 'gear', path: 'GEAR_V923.wareTables', type: 'select', choices: ['book', 'old'] },
  { section: 'gear', path: 'GEAR_V923.awakenedBioware', type: 'select', choices: ['essence', 'magic'] },
  { section: 'gear', path: 'GEAR_V923.overBodyIndex', type: 'select', choices: ['shock', 'rejection'] },
  { section: 'gear', path: 'GEAR_V923.cultured', type: 'select', choices: ['book', 'old'] },
  { section: 'gear', path: 'GEAR_V923.adrenalCrash', type: 'select', choices: ['book', 'old'] },
  { section: 'characters', path: 'GEAR_V923.load', type: 'select', choices: ['book', 'old'] },
  { section: 'characters', path: 'GEAR_V923.armorEncumbrance', type: 'select', choices: ['book', 'old'] },
  { section: 'gear', path: 'GEAR_V923.surgery', type: 'select', choices: ['book', 'old'] },
  { section: 'gear', path: 'GEAR_V923.cyberDamage', type: 'select', choices: ['book', 'old'] },
  { section: 'gear', path: 'GEAR_V923.filtration', type: 'select', choices: ['opposed', 'dice'] },
];
