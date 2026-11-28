### Rules completeness (v0.97.0), the Matrix's system operations: changes to the rows

Replace the "Analyze Host" row with:

| Rule | Was | Now (book) | Source | Switch |
|---|---|---|---|---|
| Analyze Host | a success tells the code, Security Value, every subsystem and every data bomb | one item per net success out of the book's seven: the Security Rating, each of the five subsystems' ratings, and whether the host is a virtual machine (hosts have no such field, so the card hands that question to the GM); the decker picks what comes first; 7+ successes tell all, which is every item; the code is "analyzed" only once the Security Rating is told; data bombs are Analyze Subsystem's | VR2 p. 111 | `MXOPS_V97.analyzeHost`, `analyzeHostAll` 7 |

In "Cut / still not built", replace the line "Analyze Host's third item (whether the host is a virtual machine, VR2 p. 34): hosts have no such field." with:

- Analyze Host's virtual-machine item (VR2 pp. 34, 111) counts as one of the seven items, but hosts have no virtual-machine field: the card asks the GM to answer it.

Add after "Cut / still not built":

**Accepted (the player's own sheet):** two flags stay on the decker's own actor, which its player can write:
- `crippledBy97` is the rating of the crippler that damaged the icon, used as Restore's TN (VR2 p. 100). Editing it can only lower that decker's own Restore TN, and the card shows the TN used.
- `logs97` lists the hosts whose 24-hour access log the decker has already been given as a file (Dump Log, VR2 p. 113). Editing it only gives a second copy of a log file, and the GM applies that file through the host change.
