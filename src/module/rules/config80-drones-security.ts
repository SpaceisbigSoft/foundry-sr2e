/**
 * v0.80.0, the "SR2E Unified Rules Revamp" rules source (area: drones-security). Read through RULES.URR_V80; the GM picks the
 * source in the world setting "Rules source" (settings.ts). Two exports:
 * - URR_V80_DRONES_SECURITY: this area's new switches and numbers. Their shipped values are the SR2E Book Rules (the mode off),
 *   so nothing changes unless the GM picks the Unified Rules Revamp.
 * - URR80_PATCH_DRONES_SECURITY: RULES paths → the value the Unified Rules Revamp uses (existing paths, or 'URR_V80.<key>').
 *   Applied under the GM's own house rules, which still win.
 * Source: the Unified Rule Revamp (URR v1.2), cited as "URR" below; a rule marked "house rule for the Revamp"
 * is not in the URR.
 *
 * The rules (pure logic in rules/urr80-drones-security.ts):
 * - dsLinkIntercept: intercepting a drone's remote link.
 *   Revamp ('rcd'): a decryption test first when the link is encrypted (Electronic Warfare, or Electronics at
 *   +`dsDecryptNoSkillTn`, vs the encryption + `dsDecryptTnPlus`; it needs at least half the target deck's rating in
 *   successes, rounded up; a failed try may be repeated at +`dsDecryptRetryTn` each time, which the GM tracks), then the
 *   interception itself: the interceptor's remote control deck rating in dice vs the target deck's rating +
 *   `dsInterceptTnPlus` (the drone's Pilot when no deck controls it); one success. Needs a remote control deck (patch of
 *   DRONES_V73.link.intercept.gear). The Task Pool is not added. Book ('book'): the link skill vs the radio rule's TN,
 *   raised by the encryption (DRONES_V73.link.intercept). Source: URR (signal interception, network decryption).
 * - dsRadioDecrypt: listening in on encrypted radio traffic.
 *   Revamp ('urr'): Electronics vs the encryption + `dsRadioDecryptTnPlus`, needing at least half the encryption in
 *   successes (rounded down, at least 1); an unencrypted radio stays the book test. Book ('book'): Electronics vs the
 *   encryption, at least 4 (STREET_V61.radio). Source: URR (broadcast encryption). A decryption device's rating is not
 *   added (there is no such gear field).
 * - dsLockCasing: opening a maglock's casing.
 *   Revamp ('byType'): a card reader's casing counts double, a print or retinal scanner's +`dsCasingPlus`. Book ('book'):
 *   the casing rating alone. Source: URR (maglocks: hot-wiring card readers and print scanners).
 * - SECURITY_V57.lockTypes (patched): a retinal scanner adds +4 to rewiring the circuit, as a print scanner does (book: +3).
 *   Source: URR (print, hand and retina scanners).
 * - dsPasskey: a maglock passkey on a card reader.
 *   Revamp ('rating'): the passkey's rating in dice vs the reader's rating, without the card reader's hot-wiring modifier,
 *   no-tools or light modifiers; used when its rating is at least the bypasser's skill dice. Book ('book'): the rating
 *   replaces the skill dice when higher, against the lock's full TN. Source: URR (spoofing the reader).
 * - dsSequencer: a maglock sequencer on a keypad.
 *   Revamp ('opposed'): the sequencer's rating vs the keypad's rating, against the keypad's rating vs the sequencer's: more
 *   successes opens it (in `dsSequencerSeconds` ÷ net successes), a tie does nothing, fewer counts as a failed bypass (the
 *   voice-lock flow); used when its rating is at least the bypasser's skill dice. Book ('book'): the rating replaces the skill dice when higher. Source: URR (cracking with a
 *   sequencer).
 * - dsMadScan: weapon detectors (magnetic anomaly detectors).
 *   Revamp ('highestDie'): roll the rating's dice once; every weapon whose concealment (the TN the book would use, with
 *   its modifiers) is no higher than the highest die is found. Book ('book'): a test per item, rating vs its
 *   Concealability. Source: URR (metal detectors).
 * - dsDumpDisorient: dump shock disorients.
 *   Revamp (true): after resisting dump shock, Willpower vs `dsDisorientTestTn`: +`dsDisorientTn` TN on skill tests for
 *   `dsDisorientTurns` Combat Turns ÷ successes (rounded down; none = the full time). The card says so; the GM applies
 *   the TN. Book (false): no disorientation. Source: URR (dump shock).
 * - dsCommsEccm: a comms device's ECCM when none is set.
 *   Revamp (1): a drone's link counts ECCM 1 against jamming unless the drone has more. Book (0): its own ECCM (0 when not
 *   set). Source: URR (device ECCM ratings).
 */
export const URR_V80_DRONES_SECURITY = {
  dsLinkIntercept: 'book' as 'book' | 'rcd',
  dsInterceptTnPlus: 3,
  dsDecryptSkill: 'Electronic Warfare',
  dsDecryptTnPlus: 4,
  dsDecryptNoSkillTn: 2,
  dsDecryptRetryTn: 2,
  dsRadioDecrypt: 'book' as 'book' | 'urr',
  dsRadioDecryptTnPlus: 3,
  dsLockCasing: 'book' as 'book' | 'byType',
  /** Lock types whose casing counts double ('byType'). */
  dsCasingDouble: ['card'] as string[],
  /** Lock types whose casing adds this ('byType'). */
  dsCasingPlus: { print: 2, retina: 2 } as Record<string, number>,
  dsPasskey: 'book' as 'book' | 'rating',
  dsSequencer: 'book' as 'book' | 'opposed',
  /** The sequencer's base time in seconds, ÷ net successes ('opposed'). */
  dsSequencerSeconds: 10,
  dsMadScan: 'book' as 'book' | 'highestDie',
  dsDumpDisorient: false as boolean,
  dsDisorientTn: 2,
  dsDisorientTurns: 10,
  dsDisorientTestTn: 4,
  dsCommsEccm: 0,
};

export const URR80_PATCH_DRONES_SECURITY: Record<string, unknown> = {
  'URR_V80.dsLinkIntercept': 'rcd',
  'DRONES_V73.link.intercept.gear': 'rcd',
  'URR_V80.dsRadioDecrypt': 'urr',
  'URR_V80.dsLockCasing': 'byType',
  'SECURITY_V57.lockTypes': [
    { id: '', label: '(not set)', tn: 0, tools: ['sequencer', 'passkey', 'maglockKit'] },
    { id: 'keypad', label: 'Keypad', tn: 0, tools: ['sequencer', 'maglockKit'] },
    { id: 'card', label: 'Card reader', tn: 2, tools: ['passkey', 'maglockKit'] },
    { id: 'print', label: 'Print scanner', tn: 4, tools: ['maglockKit'] },
    { id: 'retina', label: 'Retinal scanner', tn: 4, tools: ['maglockKit'] },
    { id: 'voice', label: 'Voice recognition', tn: 2, tools: ['maglockKit'] },
  ],
  'URR_V80.dsPasskey': 'rating',
  'URR_V80.dsSequencer': 'opposed',
  'URR_V80.dsMadScan': 'highestDie',
  'URR_V80.dsDumpDisorient': true,
  'URR_V80.dsCommsEccm': 1,
};
