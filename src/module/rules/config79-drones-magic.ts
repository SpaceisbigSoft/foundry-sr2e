/**
 * v0.79.0 (drones_magic): v0.79.0 verified fixes: the system differed from the official SR2 rules (Rigger 2,
 * SR2 core); each switch cites its book. Read through
 * RULES.DOCS_V79. Every behaviour change is a house-rule switch: the first choice is the book's way (the
 * default), the other puts the old behaviour back.
 *
 * - riggerDumpShock: 'rcd' — a rigger dumped from the remote control network (the drone under primary
 *   control is destroyed, or an electronic-warfare attack cuts the link) resists (RCD rating + `rcdPlus`)
 *   `level` `type` with an ordinary damage resistance test (`attribute`, Body, vs TN = that Power, staged
 *   down by successes); a rigger with no remote control deck (jumped in aboard) keeps the old values.
 *   'willpower': the old RULES.RIGGING.dumpShock (Willpower vs 6, M Stun) for everyone.
 *   Source: Rigger 2 p64 (Dump Shock).
 *   Also (an existing switch, no new key): RULES.RIGGING.jamming.dumpShock now defaults to true (a remote
 *   rigger whose link is jammed is dumped and takes dump shock). Source: Rigger 2 p64.
 * - signalFlux.base: 'table' — a remote control deck with no signal of its own has base flux `rcd` (2), not
 *   its RCD rating; sensors and ECM have rating × `sensorFactor` (round up), cyberware `cyberware` (0), other
 *   transmitters their rating (`baseFlux`). 'rating': every device's flux is its rating (old).
 *   Source: Rigger 2 flux rating table.
 * - signalFlux.perFlux / plusKm: flux past the end of RULES.SIGNAL.rangeKm reaches (perFlux × flux) +
 *   plusKm km (10+: 2 × Flux + 10 km). A plain value with RULES.SIGNAL.rangeKm (now 0.25, 1, 2, 4, 6, 9, 12,
 *   16, 20, 25 km; was 0, 1, 3, 10, 30, 100, 300, 1000, 3000, 10000). perFlux 0 and plusKm 0 = the table's
 *   last entry for anything higher (old). Source: Rigger 2 flux range table.
 * - magicPool.size: 'sorcery' — the Spell (Magic) Pool is the Sorcery skill's rating (+ a power focus, as
 *   v0.78.0; totem bonuses stay as dice on the tests they apply to); 'attributes': (Intelligence + Willpower
 *   + Magic) ÷ 3 (old, SR3's formula). Physical adepts still get none unless RULES.ADEPT.spellPool.
 *   Source: SR2 p85; SRII p83 (Dice Pools).
 * - magicPool.castingCap: 'magic' — at most Magic-rating Spell Pool dice on a spell's success test (drain
 *   resistance and spell defense uncapped); 'none': only the dice left in the pool (old).
 *   Source: SR2 p85.
 * - Also (an existing switch): RULES.MAGIC.spellDefenseSpentOnUse now defaults to true (spell defense dice
 *   used to protect someone are gone until the pool refreshes). Source: SR2 p132 (Spell Defense).
 *
 * Not implemented (no official source; see docs/VERIFY.md, "Verified fixes", "Not changed"; the Unified Rules
 * Revamp section): the subscriber list at 2 × RCD rating, drones acting at the rigger's
 * initiative, and the magic loss roll on 2D6 ≤ Magic.
 */
export const DOCS_V79_DRONES_MAGIC = {
  riggerDumpShock: {
    mode: 'rcd' as 'rcd' | 'willpower',
    rcdPlus: 4,
    level: 'S' as 'L' | 'M' | 'S' | 'D',
    type: 'stun' as 'stun' | 'physical',
    attribute: 'body' as 'body' | 'willpower',
  },
  signalFlux: {
    base: 'table' as 'table' | 'rating',
    rcd: 2,
    sensorFactor: 1.5,
    cyberware: 0,
    perFlux: 2,
    plusKm: 10,
  },
  magicPool: {
    size: 'sorcery' as 'sorcery' | 'attributes',
    castingCap: 'magic' as 'magic' | 'none',
  },
};
