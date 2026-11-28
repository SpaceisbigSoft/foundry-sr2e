#### Changes to the v0.97.0 MXLIFE_V97 rows (merge into "The decker's life outside a fight")

Replace these two rows:

| Rule | Was | Now (book) | Source | Switch |
| --- | --- | --- | --- | --- |
| Otaku's free Armor | only a loaded Armor utility | the living persona soaks persona damage with Armor = Willpower unless a loaded Armor (utility or complex form) rates ABOVE it (an equal one leaves the free Armor, which never wears down) | VR2 p. 145; otaku errata entry 11 | `MXLIFE_V97.otakuArmor` 'book' / 'v965' |
| IC on the Matrix scene (v0.91.7 known limit) | IC launches from the sheaf without a token | when the host's token (linked or unlinked) stands on the scene the GM is viewing, launched IC gets a token beside it (rows of four to its right, read from the token's stored position), hidden until the GM shows it. A table convenience, not a book rule | (house) | `MXLIFE_V97.icToken` 'scene' / 'v965' |

Add to the Psychotropic recovery row: the card's button is disabled (and the card marked in flight on that client) before the treatment dialog opens, re-enabled on a cancel, and the card's done mark is checked again after the dialog, so a double click or a second GM rolls one batch.

**Accepted (the player's own sheet):** the recovery schedule (`psycheRecovery97`), the paydata day clock (`paydataSince97`) and a deck part's stored Cook/Install result (`cook97.rolled` on the design card) sit on the decker's own actor or the decker's own card. A player who edits them only changes their own character's recovery dates, paydata days or work days, as editing their own sheet already allows; nothing GM-side and no other character depends on them (the recovery roll itself is the GM's, and it reads the IC's rating from the actor's effect, not the card).
