# VERIFY changes: clinic (v0.99.0 review fixes)

## Replacement rows

"| The surgeon's fee |":

| The surgeon's fee | none (only the recovery care was charged) | at the list price by the operation's size: minor cosmetic 1,000¥, minor invasive 5,000¥, major invasive 25,000¥, drastic invasive 250,000¥, by the Essence the ware actually costs (its grade applied, as it stands after the book's surgery changed it: none / up to .4 / .41–.99 / 1+; bioware by its Body Index bands); the graded × 50 / × 200 is not on it. Charged to the patient once per operation and once per ware put in (when it goes in, when "pay" is ticked); the GM's apply confirm shows it. Surgery on ware already installed is refused (remove it first); the sheet's Surgery button opens one dialog per item at a time. The fees use the ware's grade frozen on the surgery card when rolled (and kept in the operation's state). On the GM's client the paid mark is the GM-written world setting `surgeryFees99`; on the player's own client (their own surgery, their own money) the patient's `surgeryFee99` flag. The GM's removal forgets the ware's install, so a new operation pays again | Cybertechnology p. 54 (Medical Costs Table); Core pp. 114–115 | `CLINIC_V99.surgeonFee` |

"| Graded clinic fees |":

| Graded clinic fees | standard rates for all grades | alpha and beta: the daily Doctor's Services and Hospitalization rates (the recovery care's daily cost) × 50; delta × 200 (`feeAlphaBeta`, `feeDelta`); not the surgery's own cost. The recovery keeps what was paid for the care (`paidAmount`): changing the care later refunds no more than that | Cybertechnology p. 44, p. 54 table; Core pp. 114–115; SSC p. 98 | `CLINIC_V99.gradedFees` |

"| Removing cyberware |":

| Removing cyberware | unticking Installed (no test) | the GM's tool: the surgeon's Biotech or Cybertechnology, whichever is lower, vs 10 − the patient's current Essence (round down); no successes: 10% of the ware's Essence cost (rounded up to the tenth) more is lost for good (`essenceShift`); the ware comes out (the Essence hole as before), checked again inside the GM's locked step (still installed, still on that patient). A player's unticking of Installed on cyberware is refused (also inside a GM's re-run of a player's card); a GM acting for themselves is only warned. The tool opens once at a time | Shadowtech pp. 36–41 (Cybersystem Implementation); SSC p. 97 | `CLINIC_V99.removal` |

"| Ware damage levels |":

| Ware damage levels | damaged / not damaged | the book's system damage check keeps the level on the ware: Light (its attribute, Reaction and Initiative dice bonuses halved, fractions dropped), Moderate (stops), Serious (stops, +1 TN on every test the character makes), Deadly (+2), each damaged system adding up; destroyed (past Deadly) no penalty, can't be repaired. A new hit before repair raises it one step past the worse of the two. The level that counts is the worse of the item's own (`ware99Dmg`; "destroyed" on the item alone counts as destroyed: it stops, can't be repaired, no feedback, no better for the player) and the GM's record (`wareDamage99`); the lead GM copies every rise of the item's level into the record; the GM's tool sets or clears a level; the sheet shows it and offers Repair for any level. The record keeps the newest 2,000 entries and at most 100 per character (a write past that is skipped and the GM is whispered once a session); the lead GM drops keys whose item is gone (on its delete and in the start-up sweep), and the sweep ignores an item's own level the GM cleared since that item last changed. A recorded ware a player deletes is noted by character, name and kind (world setting `wareDamage99Meta`): the same ware made again on that character (or moved back) keeps the level, and the GM is whispered | Shadowtech pp. 36–41 (System Damage) | `CLINIC_V99.damageLevels` |

"| Repair by damage level |":

| Repair by damage level | the first skill found vs 4, 4 hours | the lower of Biotech and Cybertechnology vs 2 (Light), 3 (Moderate), 4 (Serious), 8 (Deadly), × 2 alpha, × 3 beta; base time 2 × the ware's base Essence cost hours × 1 / 2 / 3 / 4 (delta × 4), ÷ the successes; parts 5% / 10% / 20% / 40% of the ware's cost (shown on the card, not charged); destroyed ware refused. The GM repairing for themselves clears the record; anyone else's repair (a GM's Change TN / Karma re-run of a player's card included) clears the item's own level and posts a GM card "Clear the damage record (GM)" naming the repair test; a re-run for a player who doesn't own the ware does nothing. A repair that takes time (a project) clears nothing at the start: its effect, when done, clears the item's level and writes the test's id on the ware (`ware99Fix`); the lead GM then clears the record (the GM's own test) or posts the card (only for a test that checks out). The GM's click checks the repair test on the GM's client: its card (by the test's id) is a cyberRepair of this ware and owner, by the clear card's author (for a card the GM's client posted: by someone who owns the ware's character), the repairer is the author's, and its dice counted again give successes at the recorded level's TN; the confirm shows the repairer, successes and TN. A clear card, or a repair test, that cleared a record once is refused (kept in `wareDamage99Meta`). A GM's TN change undoing a repair marks the ware damaged again only for a level that stops it (not Light), and puts the level back (a project repair's too) | Shadowtech pp. 36–41; Cybertechnology p. 44 | `CLINIC_V99.repair` |

## Replacement Accepted paragraph

**Accepted (player-writable, own character only):**
- `ware99Dmg` on a cyberware item (the owner writes it at a hit): it can only make the damage worse (the level counted is the worse of it and the GM's record; "destroyed" from the item alone stops the ware for good, with no feedback penalty).
- `ware99Fix` on a cyberware item (a repair project's effect writes it): it only makes the lead GM look up the repair test it names; nothing is cleared or asked unless that test's card checks out (above), and a test is used once.
- `surgeryFee99` on the patient (the operations and ware whose surgeon's fee was paid on the player's own client): read only on that player's client (their own money, which they can edit anyway); the GM's client ignores it and reads the GM-written `surgeryFees99`. Clearing it only charges the player again.
- The ware's grade frozen on the surgery card (`surgery.grade99`) and kept in the patient's `surgeryState` (as the operation's other state since v0.81.1): the patient's owner changing the item's grade after the roll changes no fee; the GM's apply confirm shows the fee.
- `system.recovering[].paidAmount` on the patient (their own care's money): it only caps their own refund.
- The refusals of unticking Installed and of surgery on installed ware are client-side checks (as the v0.96.0 foci limit): a player who gets around them only takes their own ware out (the Essence stays lost) or pays a surgeon's fee again.
- The "Clear the damage record" card: it names the item and the repair test only; the GM's client reads the item, its owner, the record's level and the repair card (above); the GM confirms every clear.

## New notes

Replace in the clinic section's **VERIFY notes** the sentence "The graded × 50 / × 200 is applied to the surgery fee line as well as to hospitalization (…) × 200 (the specific rule) is used." with: "The graded × 50 / × 200 multiplies the daily Doctor's Services and Hospitalization rates only (the recovery care), not the Surgery line (Cybertechnology p. 44, p. 54 table; Core pp. 114–115: the lead's reading); the surgeon's fee is the list price sized by the Essence actually lost. Cybertechnology p. 44 also says delta's medical costs are "quadruple" standard, which contradicts × 200: × 200 (the specific rule) is used."

Replace the sentence "A ware's "destroyed" level written on the item alone counts as Deadly (destroyed has no feedback penalty): only the GM's record (a GM client's damage check or the GM's tool) makes it destroyed." with: "A ware's "destroyed" level written on the item alone counts as destroyed (it stops, can't be repaired and gives no feedback penalty: no better for the player than Deadly)."

Add:
- New world settings (GM-written): `wareDamage99Meta` (cleared stamps per record key, the used repair tests and clear cards, at most 500, and deleted recorded ware, at most 200) and `surgeryFees99` (fees the GM's client charged, per patient: by operation and by ware put in). New item flag `ware99Fix`. New field `system.recovering[].paidAmount` (a number, default 0) on characters and NPCs: no new types, no restart needed for the data model beyond the usual reload.
- The removal house-rule label names the skill Cybertechnology (the system's skill; the book's "Cybernetics").

## Known limits

- A recorded ware moved to another character keeps no level there (only the same character making it again, or the ware moved back, gets it).
- A repair test's card that was deleted can't back a clear: the GM clears the level with the tool instead.
- A repair test typed from physical dice has no faces: its typed successes are the proof (shown in the GM's confirm).
- The paid mark of a surgeon's fee the player's own client charged is not known to the GM's client; a GM's later apply of another card for the same operation is still guarded by the operation's state (installed) and by the refusal of surgery on installed ware.
- The surgeon's player can still edit the grade frozen on their own card; the GM sees the fee and the care's cost in the apply confirm.

## Changed keys

The wording of these existing keys changes (no "a alpha-grade", no "needs 1 successes"; the removal label names Cybertechnology; the fee labels say the graded multiplier is on the daily care only); the new values are in `i18n-drafts/clinic99-fix-replace.json` as `REPLACE:<key>`:
- `SR2E.Clinic99.roll`
- `SR2E.Clinic99.Search.head`, `SR2E.Clinic99.Search.headTyped`, `SR2E.Clinic99.Search.knows`, `SR2E.Clinic99.Search.foundIn`, `SR2E.Clinic99.Search.notFound`, `SR2E.Clinic99.Search.delta`
- `SR2E.Clinic99.feePaid` (no "× {factor}": the fee is the list price)
- `SR2E.HouseRules.Rule.CLINIC_V99__removal`, `SR2E.HouseRules.Rule.CLINIC_V99__surgeonFee`, `SR2E.HouseRules.Rule.CLINIC_V99__gradedFees`
