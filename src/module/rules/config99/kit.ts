/**
 * v0.99.0 rules completeness, gear: smartlinks, skillsofts, concealment, searches and the law. Read through
 * RULES.KIT_V99. Book rules from the Core Rulebook, Fields of Fire (FoF, with its official errata v1.1), the
 * Neo-Anarchist's Guide to Real Life (NAGRL) and Shadowtech that the system did not have before v0.99.0, each with its
 * page in the comment. Each switch's first choice is the book's way (the default); the other ('v980') puts the v0.98.0
 * behaviour back. Pure logic lives beside it in rules/kit99.ts, the Foundry glue in applications/kit99.ts. A police
 * check is the GM's: it is rolled on the GM's client from the GM's tool; what the character carries is read from their
 * own items there.
 */
export const KIT_V99 = {
  /**
   * Smartlink Level II (FoF pp. 84–85, with the FoF errata v1.1 for the called shot): when both the receptor (a
   * smartlink of level 2, or Level II smart goggles) and the smartgun (the weapon's new "Smartgun Level II" box) are
   * Level II: a called shot is +2 instead of +4 (a −2 row); with a rangefinder carried or implanted, −1 at long range
   * and −2 at extreme range; a linked launcher (a fired blast weapon with no Intelligence of its own) −1. 'v980': none
   * of these.
   */
  smartlink2: 'book' as 'book' | 'v980',
  /**
   * Smart goggles (Core pp. 90, 241): worn smart goggles (a gear item at hand named so) are a smartgun's receptor: the
   * Attack dialog ticks the goggles' −1 row by itself for a smartgun when there is no smartlink implant; with the
   * smartlink's row ticked too only the smartlink counts (one receptor feeds the cross hairs; VERIFY). 'v980': the
   * goggles' row only by hand, and both rows add.
   */
  smartGoggles: 'book' as 'book' | 'v980',
  /**
   * Skillwires (Core p. 249): the Skillwire Rating limits the TOTAL rating of all the ActiveSofts in use at once; the
   * running activesofts take the rating in slot order, a later one gets what is left (VERIFY: capped, not refused).
   * 'v980': each activesoft capped at the rating alone.
   */
  skillwires: 'book' as 'book' | 'v980',
  /**
   * A skillsoft replaces the skill (Core p. 248): a running skillsoft for a skill the character has is used at the
   * soft's rating only, even when the character's own is better (the natural ability is lost while accessed); magic
   * skills (Sorcery, Conjuring) cannot be ActiveSofts. 'v980': the better of the two, and any skill.
   */
  softReplaces: 'book' as 'book' | 'v980',
  /**
   * The Skill Memory Table (Core p. 248; Shadowtech p. 48 the same): a knowsoft or linguasoft run from headware memory
   * takes the table's Mp by its skill type (general, concentration, specialization: the chip's new "Skill type"
   * field; a linguasoft is a language) and rating (1–10). 'v980': rating × RULES.CYBERWARE.chips.mpPerRating.
   */
  skillMemory: 'book' as 'book' | 'v980',
  /**
   * The lined coat (Core p. 242): +2 to the Concealability of any weapon hidden under it. A worn lined coat (armor
   * named so) adds 2 to every carried weapon's Concealability against looking someone over and frisking (not against
   * scanners: the coat hides from eyes and hands; VERIFY). 'v980': no change.
   */
  linedCoat: 'book' as 'book' | 'v980',
  /**
   * The Manual Detection Modifiers Table (NAGRL p. 93): a frisk (pat-down) takes the searcher's professionalism
   * (Professional Rating 1 +2, 2 +1, 3 or more +0), the time spent (cursory +2, brisk +1, standard 0, detailed −1,
   * deliberate −2, nearly a strip search −3; a strip search finds every weapon) and the searcher's state (intimidated
   * +2, normal 0, in complete control −2); only a GM may order the strip search. 'v980': no such rows.
   */
  manualSearch: 'book' as 'book' | 'v980',
  /**
   * The chemical sniffer (NAGRL p. 93): an explosive detector rolls its rating once against a base TN 10, −1 for each
   * 8 standard rounds (or part), each 6 explosive rounds, each concussion or fragmentation grenade, each 2 smoke or
   * flash grenades, each 3 mini-grenades, each 30 g of standard explosive and each 100 g of plastique carried; one
   * success finds the explosives and the ammunition (propellant). 'v980': a test per explosive item against its
   * Concealability (RULES.GEAR.concealment.defaultTn when none), ammunition not sniffed.
   */
  sniffer: 'book' as 'book' | 'v980',
  /**
   * The police check (Shadowtech p. 103): the officer's Security or Police Procedures skill against the item's
   * Legality Rating (its restriction number, ±3 for the area's enforcement, never below 2): no success, nothing
   * noticed; one, a warning; more, the officer presses the issue (a permit or an arrest). The GM's tool "Police check
   * (book rules, GM)" rolls it on the GM's client for what the character shows (or everything they carry, when the
   * officer suspects it). 'v980': no police check.
   */
  policeCheck: 'book' as 'book' | 'v980',
  /**
   * The restriction number of an item with no book Legality code set (the item's new "Legality code" field, e.g.
   * "6P-CC"), by the system's legality category (VERIFY: a reading of Shadowtech pp. 103–104's ranges). The stricter of
   * the code and the category's number counts.
   */
  policeTn: { permit: 6, restricted: 4, forbidden: 2 } as Record<string, number>,
};

const BV = ['book', 'v980'];
/** The house-rules window's rows for KIT_V99 (spread into settings.ts HOUSE_RULES). */
export const HOUSE_KIT_V99: Array<{ path: string; section: string; type: 'number' | 'boolean' | 'select'; choices?: string[]; step?: number }> = [
  ...(['smartlink2', 'smartGoggles', 'skillwires', 'softReplaces', 'skillMemory', 'linedCoat', 'manualSearch', 'sniffer', 'policeCheck'] as const)
    .map((k) => ({ section: 'gear', path: `KIT_V99.${k}`, type: 'select' as const, choices: BV })),
  ...(['permit', 'restricted', 'forbidden'] as const).map((k) => ({ section: 'gear', path: `KIT_V99.policeTn.${k}`, type: 'number' as const, step: 1 })),
];

/** The Skill Memory Table (Core p. 248): Mp by skill type, ratings 1–10. */
export const SKILL_MEMORY_99: Readonly<Record<string, readonly number[]>> = {
  general: [10, 20, 30, 200, 250, 300, 700, 800, 900, 2000],
  concentration: [6, 12, 18, 120, 150, 180, 420, 480, 540, 1200],
  specialization: [4, 8, 12, 80, 100, 120, 280, 320, 360, 800],
  language: [3, 6, 9, 24, 30, 36, 70, 80, 90, 300],
};
/** The chip's skill types (the chip's `scope` field; blank = general). */
export const SOFT_SCOPES_99 = ['', 'general', 'concentration', 'specialization'] as const;

/** The Manual Detection Modifiers Table (NAGRL p. 93): row id → TN modifier (null: the weapon is found). */
export const MANUAL_SEARCH_99 = {
  pro: { pr1: 2, pr2: 1, pr3: 0 } as Record<string, number>,
  time: { cursory: 2, brisk: 1, standard: 0, detailed: -1, deliberate: -2, nearStrip: -3, strip: null } as Record<string, number | null>,
  state: { intimidated: 2, normal: 0, control: -2 } as Record<string, number>,
};

/** The Chemical Detection Modifiers Table (NAGRL p. 93): how many of each make one −1 (or part thereof). */
export const SNIFF_99 = { baseTn: 10, standardRounds: 8, explosiveRounds: 6, fragGrenades: 1, smokeGrenades: 2, miniGrenades: 3, standardGrams: 30, plastiqueGrams: 100 };
