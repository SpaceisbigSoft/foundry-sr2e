# VERIFY changes from the v0.98.0 vrig review fixes

For docs/VERIFY.md, section "#### Rigging, drones, sensors and electronic warfare (v0.98.0, RULES.VRIG_V98)". Each replacement row is quoted by its first cell; put the whole new row in place of the old one.

## Replacement rows

"The ECM Test":

| The ECM Test | the target's ECM beyond the scanner's ECCM on the Sensor Test's TN | an opposed test before each Sensor Test, on its own card: the jammer its ECM's Flux (rating × 1.5, round up) vs the scanner's Sensor, the scanner its sensors' Flux vs the ECM Rating; the jammer winning raises its Signature by its successes for that test; ECCM: the scanner's ECCM vs the ECM Rating, opposed by the ECM Rating vs the ECCM, its net successes off the jammer's (VERIFY); each of ECM, ECCM, ECD, ED and Sensor counts at most 20 here (`EW_MAX`: the fields are on player-owned vehicles and become dice on whoever scans) | Rigger 2 pp. 30–31 | `VRIG_V98.ecmTest` |

"Electronic deception (optional)":

| Electronic deception (optional) | none (ECD was "electronic counter-detection": a roll to notice the scan) | a vehicle's ED (new field) rolls vs the scanner's Sensor, +1 Signature per success; the scanner's ECD vs the ED Rating takes one off per success and drains its sensors' Flux by its rating; the ED card goes to the GMs only, and a player's own Sensor card shows no ED row: the ED and ECM increases are one "Electronic warfare: Signature +n" row there (a GM's card keeps the ED row); with the rule on, the v0.25.0 notice roll is gone (ECD is counter-deception) | Rigger 2 p. 32 | `VRIG_V98.ed` (off) |

"Missile timing and fire modes":

| Missile timing and fire modes | resolved at once; no fire mode | the card says the missile strikes at the end of the Combat Turn (Combat Phase 0); the mounted-fire dialog has the fire mode: continuous lock adds half the vehicle's Sensor (round down) to the missile's Intelligence dice and +2 TN on that vehicle's Driving Tests for the rest of the turn (noted on the vehicle only once the attack has rolled: a preview or a refused attack notes nothing); fire-and-forget adds nothing | Rigger 2 p. 59 | `VRIG_V98.missiles` |

"Network drones in the rigger's phase":

| Network drones in the rigger's phase | each drone rolled its own Initiative | after Initiative is rolled, each network drone (subscribed, not driven by hand or from aboard) takes its rigger's score and acts right after the rigger; on a GM's client the combatant acting before the change is still the one acting after it | Rigger 2 p. 66 | `VRIG_V98.dronePhase` |

"Captain's chair vs primary drone":

| Captain's chair vs primary drone | the rig's Initiative only when jumped in | the rigging tab's "Sit in the captain's chair" (shown only with a remote control deck and a control rig): not jumped in, the rigger rolls the rig's Initiative; drone tests from the chair (group commands) already roll Pilot with no pools; a primary drone (jumped in) gives the others +2 on Comprehension Tests (above) | Rigger 2 p. 65 | `VRIG_V98.captainsChair` |

"Flux modifiers":

| Flux modifiers | the deck's plain Flux for its range | the remote link's Flux gets the Situational Range Modifiers: the scene's conditions (the GM's "Rigging conditions" tool: high elevation +4, electrical storm −2, humid air −0.5 (never with a storm), urban −1), the link's encryption −0.5 (the better of the drone's and the rigger's deck's, as the drone-link tests read it), the network's ECCM −half (the vehicle the deck rides in or ECCM gear, the same value ECCM regeneration uses); rounded down to the half; a half step reaches halfway between the table's ranges (VERIFY) | Rigger 2 p. 30 | `VRIG_V98.flux` |

"MIJI and Signal Monitors":

| MIJI and Signal Monitors | the jam roll (jammer rating vs signal) and the link spoof | the drone-link dialog becomes the MIJI dialog: interception (the existing book interception of one of the network's drones, required first) and meaconing / intrusion / jamming / interference against a rigger's network: the intruder rolls its deck's Flux vs the target deck's rating, the defender its deck's Flux vs the intruder's protocol emulation module (jamming: the intruder's ECM); net successes are boxes on the network's Signal Monitor (command, simsense, system; 1 / 3 / 6 boxes +1 / +2 / +3; 10 the channel is lost); a lost interference degrades the intruder's own system channel. On a GM's client both sides roll at once; a player's card rolls only the intruder's side and its Apply (GM) rolls the defender's side on the GM's client (the GM's dialog shows both sides' dice and TNs, the protocol emulation module, the intruder's ECM and the target's ECCM; the GM's card carries the defender's roll). Effects: command channel (not from meaconing) on Comprehension Tests, meaconed channels on the drones' Pilot driving tests, simsense on a rigger rigging through the deck; a lost command channel refuses group commands (one warning), a lost simsense channel refuses rigging through the deck (with the dump-shock line). ECCM regenerates 1 box per 2 successes vs the intruder's deck or ECM (the higher) + 3 (the rigging tab's button) | Rigger 2 pp. 64, 68–72 | `VRIG_V98.miji` |

## Replacement "Accepted (player-writable, own character only)" paragraph

**Accepted (player-writable, own character only):** `flags.<system>.vrig98Signal` on a player rigger (their own network's Signal Monitor: written by the GM when an NPC's MIJI hits it, but the player can edit their own actor; it only changes their own drones' and their own tests and commands); `vrig98Chair` (their own Initiative); `vrig98Lock` on their own vehicle (the +2 on their own Driving Tests after a continuous-lock launch); the subscriber list (`system.rigging.subscribed`, as before): it only counts for drones with exactly the rigger's owners (`sameSide`), so a player can't put an NPC's drone in their network's phase or degradation; a vehicle's `ed` rating is a sheet stat like its ECM and Signature (ECM, ECCM, ECD, ED and Sensor count at most 20 in the EW tests). Degradation on any other network is written by a GM: at once on a GM's client, else by the MIJI card's Apply (GM), which re-reads both riggers' ratings, re-checks the interception (the target's drones), counts only the intruder's dice from the card again (needs the card's author to own the intruder), rolls the defender's test on the GM's client, and writes under the GM lock (inline inside a card re-run). The cards applied are remembered on the target network (`vrig98MijiApplied`: the card's id and its dice signature, written by the GM; a player can only clear it on a network they own, which lets a MIJI card be applied against themselves again), never on the player's card: a card applied once, or a copy of it with the same dice, is refused. The scene's Flux conditions are a scene flag the GM's tool writes. A GM's intruder isn't refused for a missing interception (the target's drones may be a player's).

## New VERIFY notes (append to the section's "VERIFY notes")

The cap of 20 on ECM, ECCM, ECD, ED and Sensor in the EW tests is a guard, not a book number (Rigger 2's devices stay well below it). The dice signature of a MIJI card is the operation, channel, both sides, the player's TN modifier and every die face on the card in order: a fresh roll with the very same faces (1 in 6ⁿ for n dice; only likely with 1–2 dice) is refused as a copy; the player rolls again.

## New known limits (append to "Cut / still not built")

With the optional ED rule on, a player's own Sensor card still rolls against the true TN (Signature + ED's increase), so with no ECM increase the player can work ED's number out from the TN; the row only no longer says it is ED. A MIJI card made before this fix (both sides' dice on it) is still applied with only its intruder dice counted and the defender rolled again by the GM.

## Fixed (for the CHANGELOG)

- S5: the MIJI Apply no longer replays the defender's dice from the player's card; the GM's client rolls them.
- S6 / P4: the MIJI once-guard is GM-side (the target network's record), and a reposted copy is refused.
- S7: EW ratings clamped in the ECM and ED plans.
- C2: network drones taking the rigger's score keep the acting combatant.
- C3 / P3: the continuous-lock launch is noted only after the attack rolled (a preview or a refused attack noted it before).
- P7: the captain's chair button needs a control rig.
- P8: no ED row on a player's own Sensor card.
- P9 / C11: the link's Flux reads the deck's encryption too, and the network's ECCM from one place.
- C9: a lost command channel warns once per group command.
- C6 / P5: the MIJI Apply's write under the GM lock; a double click is one Apply.
