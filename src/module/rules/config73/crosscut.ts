/**
 * v0.73.0 cross-cutting bookkeeping (docs/REVIEW-v0.69.md, section 3, O39–O43). Read through
 * RULES.CROSSCUT_V73 (the pure functions in rules/bookkeeping.ts read `(RULES as any).CROSSCUT_V73 ?? CROSSCUT_V73`,
 * so wire it into RULES by reference). Every fix has a switch that puts the old behaviour back. None of these
 * are book rules (they are how the system keeps its own records), so nothing here is VERIFY except where noted.
 *
 * - undo (O39): `regions`: Region documents (blast areas, environment regions, smoke and gas clouds, wards, and
 *   barrier-spell regions) are in the GM's undo log like walls and drawings; off = not logged (the old way),
 *   and the panel's limits list says so. `skipTimedOut`: a blast area or cloud that runs out on the real-time
 *   backstop (the 10-second sweep, not a world-time step or a new Combat Turn) is taken off without a step of
 *   its own (one that runs out because the GM moved the clock or the Combat Turn joins that step, so undoing the
 *   step brings the cloud back with the time).
 * - retarget (O40): the GM's "Change target number…" list. `noticeAsPerception`: a plain Perception (Notice /
 *   Listen) card gets the Perception groups (visibility, smoke, weather, distance, sight) instead of the catch-all
 *   ones; off = the old catch-all list. (The ritual-notice card, kind 'notice', stays with the magic rows: it is
 *   Intelligence + grade against a ritual, a magical sense.) `hearingRows`: a Hearing group (Deaf, cyberear
 *   amplification 1…max, adept Improved Hearing, background noise) on Perception and Sneak cards, and an
 *   "The observer" group (Blinded, Sustaining). `superiorPosition`: melee superior-position rows on attack and
 *   defend cards: 'whenOn' only while the COMBAT_V61.superiorPosition house rule is on, 'always', or 'never'.
 *   `prejudiceRows`: the metatype prejudice rows (TN_AUTO.social.prejudice) on social cards (all of them go once
 *   any prejudice row is already on the card).
 * - statuses (O41): `brokenEndsWithCombat`: morale "broken" comes off everyone in a combat when it ends (off =
 *   it stays until a rally or a passed morale test). `timedHoldEnds`: when a timed hold (paralysis for N Combat
 *   Turns) runs out, its power-effect entry comes off too (off = the entry stays until the caster drops it).
 *   The grapple hold's restrain and heldBy were already released by v0.71.0 (R13, FIXES_V71.holds).
 * - advancement (O42): `nuyenRefunds`: nuyen given back when a project is given up goes into the log as a
 *   refund line and comes off "nuyen spent": 'matched' (only when the log has the spend it refunds), 'all',
 *   or 'off' (the old way: not logged). `trainingDone`: finished training writes one "Done: Training …" line
 *   credited to whoever started it ('doneLine'), no line at all ('quiet': the start line already has it), or
 *   the old raise line credited to the GM ('old'). `creditRequester`: a project started by a GM-approved
 *   request is credited to the player (and approved by the GM) instead of to the GM.
 * - modInstall (O43): `payUpFront`: a vehicle mod installed over time is paid when the work starts (like every
 *   other project) and given back on Give up or when a re-roll fails; off = paid when it goes in (the old way:
 *   if the payer can't pay then, the time is lost).
 */
export const CROSSCUT_V73 = {
  undo: {
    regions: true,
    skipTimedOut: true,
  },
  retarget: {
    noticeAsPerception: true,
    hearingRows: true,
    superiorPosition: 'whenOn' as 'whenOn' | 'always' | 'never',
    prejudiceRows: true,
  },
  statuses: {
    brokenEndsWithCombat: true,
    timedHoldEnds: true,
  },
  advancement: {
    nuyenRefunds: 'matched' as 'matched' | 'all' | 'off',
    trainingDone: 'doneLine' as 'doneLine' | 'quiet' | 'old',
    creditRequester: true,
  },
  modInstall: {
    payUpFront: true,
  },
};
