#### Matrix IC and cybercombat (v0.97.0, RULES.MXIC_V97): changes after the test plan

Rows to change in the "Matrix IC and cybercombat" table (the others stay):

| Rule | Was | Now (book) | Source | Switch |
|---|---|---|---|---|
| Suppressing IC | crashing IC put its points on the tally at once; no suppressing | as before (the GM side's choice card, recorded on the host), and: the reduction lasts only the run it was made in (the decker's jack-in stamp: jacking out and in again ends it, with no tally, as leaving the system does); an IC that crashes again after a relaunch or reset gets no second choice: its points go on the tally as usual | VR2 pp. 40, 120 | `MXIC_V97.suppress` |
| Parry / position / evade requests | — | each request a decker's maneuver sends the GM side carries the resolving client's order; the host keeps the newest applied per kind, decker and opponent, and ignores an older one that arrives later (a Karma re-roll's request applied before the first roll's) | VR2 pp. 121–122 | `MXIC_V97.parry`, `position`, `evade` |

Note: the persona sheet's Detection Factor follows a suppression when the decker's sheet is prepared again (any change to the decker); detection rolls always use the current value.

**Accepted (the player's own sheet):** a player can already change their own attack's outcome by editing their own actor (the dialog's free TN modifier, program ratings), so `mx97.pos` (the decker's own position: −TN or +Power on their own attack), `improvised97` (their own improvised attack) and `runFiles97` (their own files kept through black IC's wipe), as well as the jack-in stamp `run97` (changing it only ends their own suppressions early), stay on the decker's actor. GM-side state that affects IC, hosts or other characters (parries, evades, positions won against a decker, suppressed IC, the crash choices offered, the request order) is kept on the host.
