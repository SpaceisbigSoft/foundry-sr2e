#### Matrix IC and cybercombat (v0.97.0, RULES.MXIC_V97): rows to change after the security re-review

Replace these rows of the "Matrix IC and cybercombat" table (the other rows stay):

| Rule | Was | Now (book) | Source | Switch |
|---|---|---|---|---|
| Suppressing IC | crashing IC put its points on the tally at once; no suppressing | only the GM side (the IC's own resistance test on the GM's client) posts the crash choice, once per IC (the host notes it; a crash resisted on a player's client keeps the old tally); the answer is recorded on the host (GM-owned, never the decker's flags): Security tally +points, or Suppress (only an IC that really crashed): Detection Factor −1 per suppressed IC while the decker stays in that host; Release (a Free Action) gives the point back and puts the host-recorded points on the tally. A player's click becomes a host change the GM applies; it counts only from someone who owns the decker it names, and only GM-posted cards count; a frame's or agent's crash keeps the old tally | VR2 pp. 40, 120 | `MXIC_V97.suppress` |
| Position maneuver | −net TN (at most 4) on the decker's next attack, a turn long; a lost test did nothing | the winner gets the net: the decker's next attack −TN or +Power (picked in the cybercombat dialog); when the opponent wins it backfires: the opponent's next attack on the decker −net TN, recorded on the host by the GM side (at most the opponent's dice), used up by that attack | VR2 p. 122 | `MXIC_V97.position` |
| Data bombs | Defuse: Decrypt vs the bomb's rating; the blast raised the alert to passive | Defuse: a System Test vs the subsystem the bomb is on (Files for a file), the Defuse utility lowering the TN; a failure leaves it primed, all 1s sets it off; the GM side reads the bomb's rating from the host, and only for the bomb the same host change sets off: its rating goes on the tally unless the decker suppresses it (the choice card, as for IC; no alert; with `suppress` 'v965' no choice: the tally); a frame's blast keeps the alert | VR2 pp. 41, 96 | `MXIC_V97.dataBomb` |

The GM's confirm for a Matrix request names the decker, the opponent (or the bomb) and the net.
