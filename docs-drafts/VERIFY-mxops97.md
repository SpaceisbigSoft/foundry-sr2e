### Rules completeness (v0.97.0): the Matrix's system operations

Virtual Realities 2.0 (VR2) "System Operations" (pp. 108–118), the System Operations Table (p. 162) and the programs
(pp. 96–100). Switches: `RULES.MXOPS_V97` (`rules/config97/mxops.ts`), logic in `rules/mxops97.ts`, glue in
`applications/mxops97.ts`; each switch's first choice is the book's way, the other (`v965`) puts v0.96.5 back.

| Rule | Was | Now (book) | Source | Switch |
|---|---|---|---|---|
| Analyze Host | a success tells the code, Security Value, every subsystem and every data bomb | one item per net success (the Security Rating, or one subsystem's rating; the decker picks what comes first), 7+ tell all; the code is "analyzed" only once the Security Rating is told; data bombs are Analyze Subsystem's | VR2 p. 111 | `MXOPS_V97.analyzeHost`, `analyzeHostAll` 7 |
| Analyze Subsystem | not built | the picked subsystem, Analyze, Simple: lists the IC guarding it and its data bombs (found by the decker; looking does not set the bomb off) | VR2 pp. 111, 162 | `MXOPS_V97.operations` |
| Crash Application | not built | the picked subsystem, Crash, Complex: a GM card (no effect on IC, frames, constructs, deckers) | VR2 pp. 112, 162 | `MXOPS_V97.operations` |
| Decoy | not built | Control, Mirrors, Complex: the net successes go on the decker; a proactive IC's attack (not trace IC's) rolls 1D6 and on the successes or less hits the decoy at full damage (no resistance; L 1/M 3/S 6/D 10 boxes, gone at 10) | VR2 pp. 112, 162 | `MXOPS_V97.operations`, `decoyBoxes` 10 |
| Disinfect | not built (no disinfect utility) | the picked subsystem, Disinfect, Complex: a GM card (worms are not modelled); new utility kind `disinfect` (multiplier 2) | VR2 pp. 96, 112, 161–162 | `MXOPS_V97.operations` |
| Dump Log | not built | Control, Validate, Complex, an interrogation: the GM answers; the 24-hour log (2D6 × 5/2/1 × 100 Mp by Intrusion Difficulty) becomes a file the decker has found, once per host | VR2 pp. 113, 162 | `MXOPS_V97.operations` |
| Locate Decker | a perception test (v0.57.0) only | also as a system operation: Index, Scanner, Complex, then a Sensor Test; located: the other deckers in the host whose Masking + loaded sleaze ≤ its successes | VR2 pp. 114, 162 | `MXOPS_V97.operations`, `locateDeckerTn` 4 (VERIFY) |
| Locate Frame | not built | Index, Scanner, Complex: the host's smart frames and agents (SKs) | VR2 pp. 114–115, 162 | `MXOPS_V97.operations` |
| Locate IC | a perception test (v0.57.0) only | also as a system operation (`locateIcOp`): Index, Analyze, Complex: lists the host's running IC | VR2 pp. 115, 162 | `MXOPS_V97.operations` |
| Retrain | not built | Access (the jackpoint modifiers apply), Commlink, Free: a card (the optional bandwidth rule is not tracked) | VR2 pp. 117, 162 | `MXOPS_V97.operations` |
| Scan Icon | not built | Computer vs the target icon's Masking (frame/agent: its rating), − scanner + the target's sleaze; an item per net success (MPCP, each persona rating, Response Increase; the decker picks the first) | VR2 pp. 117, 162 | `MXOPS_V97.operations` |
| Validate Passcode | a passcode for ever, no level | superuser +2 TN, supervisor +6 (dialog row); lasts 1D6 × net successes days (a record on the decker; past it the passcode no longer counts for detection or Legitimate status); a host going to an active alert deletes the passcodes of the deckers on it | VR2 p. 118 | `MXOPS_V97.validatePasscode`, `passcodeTn` |
| Slow utility | Computer + Hacking Pool vs the IC's rating; 3 Initiative per net success (at most the rating) | an attack test: the Slow rating + Hacking Pool vs the cybercombat TN (code and status), opposed by the IC's Resistance Test (Security Value vs the Slow rating); an action (10 Initiative) per 2 net; with no action left it hangs; refused on reactive IC (probe, scramble, tar baby, tar pit, barrier) and on trace IC once locked on | VR2 p. 99 | `MXOPS_V97.slow`, `slowPerAction` 10 |
| Restore utility | rating vs TN 4, a point per success (deck damage by house rule), −1 rating per use | rating vs the rating of the crippler that did the damage (remembered on the decker; else the host's best crippler; else 4), a point per 2 successes, never the deck's permanent damage, no wear (the book gives none, where Medic's says it wears) | VR2 p. 100 | `MXOPS_V97.restore` |
| Interrogation questions | none | a dialog row: +2 extremely vague, +1 vague, 0, −1 well-phrased, −2 insightful on Locate File, Locate Paydata, Locate Slave, Dump Log; Locate LTG number (Locate Access Node) +1 … −1 | VR2 pp. 110, 114 | `MXOPS_V97.interrogation`, `queryTn` |
| "Not here" | none | Locate File: once 3 successes are counted and no file is left to find, the card says the host does not hold it | VR2 p. 110 | `MXOPS_V97.interrogation`, `notThereAt` 3 |
| Book check: "Interrogation … 'not there' after 3 tries" | (the Not-built list's wording) | correction: after 3 or more successes, not 3 tries | VR2 p. 110 | (doc) |
| Book check: Crash Application's action | — | the table (p. 162) says Complex, the entry (p. 112) Simple: the table's Complex is used, as the catalog follows the table (VERIFY) | VR2 pp. 112, 162 | (doc) |
| Book check: the System Operations Table's page | "VR2 p. 161" in the v0.92.3 rows | the table is on p. 162 (p. 161 is the Utilities Table) | VR2 pp. 161–162 | (doc) |

VERIFY notes:
- Locate Decker's Sensor Test has no TN in the book: 4 (`locateDeckerTn`).
- Dump Log's Intrusion Difficulty is read from the Security Value (VR2 p. 31's assigned numbers overlap): Easy to 6, Average 7–9, Hard 10+.
- Scan Icon's test is "Special": the host still makes its opposed Security Test (VR2 p. 108 says every system operation has one).
- Slow: the book says the IC loses an action "for every 2 net successes the IC achieved"; read as the slow attack's net successes.

**Cut / still not built:**
- Analyze Host's third item (whether the host is a virtual machine, VR2 p. 34): hosts have no such field.
- Disinfect and Crash Application only post a card: worms and host applications are not modelled.
- Retrain: the optional bandwidth rule (VR2 p. 90) is not built, so the operation only posts a card.
- Located deckers and IC are listed on the card; there is no "located" state that gates attacks (the v0.57.0 perception tests remain for that).
- A frame's decoy (VR2 p. 105) is the GM's to run.
- Locate Slave's 3 successes (VR2 p. 115) and Dump Log as an accumulating interrogation (it opens on a success).
- Edit File's notice test, a damaged download's reconstruction, Null Operation's inactivity modifiers (not in this list).
