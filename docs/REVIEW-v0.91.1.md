# v0.91.1 review: new entries and a Shop button

The second shop slice (the owner's decisions, 25 Oct 2026), plus a Shop button the owner asked for during it.

## What changed

- **New entry…** (`applications/newentry.ts`, `templates/new-entry.hbs`; pure parts `rules/newentry.ts`): a form to make an item, spell, adept power, focus, program or cyberdeck the catalogue lacks, typed from the user's own book (or with no catalogue). Vehicles and drones come with v0.91.2.
  - Each kind shows the fields its stat line has (curated catalogue columns and shorthand codes), each with a hint.
  - **Paste the stat line → Read it** fills the form: labelled values, then codes by their shape (Availability, damage, drain, ammo, modes, ranges, persona, B/I, Mp), choice words (Combat, LOS, Instant, Restricted…), then bare numbers in the book's column order. Only the name (at most 6 words), numbers and codes are kept; the other words are shown and dropped; the line itself isn't kept. At most 400 characters.
  - The description is the user's own words, kept as escaped plain text.
  - **GM:** saves it as a world template (In the shop or not; a template of the same kind and name is replaced after a yes, keeping its id and shop mark) and/or gives it to the character the form was opened for.
  - **Player:** sends it to the GM as a request (`entry`): only the kind, the name, the field strings and the description. The GM's Requests tab has **Review…** (the form, filled in, to check and edit; saving approves it); a plain Approve rebuilds it from the strings and saves it, but never replaces an existing template.
  - Opened from the shop (New entry… beside the search), the SR2e tools window, the GM panel's Setup tab and `game.sr2e.api.newEntry({ kind, actorUuid })`.
- **Foci, programs and cyberdecks** have a cost, Availability, Street Index and legality (model fields, catalogue columns, the item sheet's Cost and legality section), so they can be found and bought in the shop.
- **Catalogue files** (CSV and the catalogue file) warn on saving that what was typed from books stays with the group; the Setup tab says so too.
- **A Shop button** (the owner, 25 Oct 2026): in the SR2e tools window and the left toolbar's SR2e group, and in the title bar of a character sheet its owner sees. It opens the Add window set to buy (Find & buy for a player out of creation), titled "Shop: name". Whose shop: the player's assigned character, else one selected token they own, else the character they own by name, else a choice; the GM's: the selected token. `game.sr2e.api.openShop(actor?)`.
- The guide: a topic "New entries"; "The shop" mentions the Shop button. The changelog and README.

Rules values are unchanged.

## Checking the output

3,392 tests (3,388 pass, 4 skipped), tsc clean. The new `v0911.test.ts` (22 tests) runs the reader on a stat line of every kind, the builder and the request's safe reading, the review fixes, the buying fields and the wiring.

Checked live (GM AI and ZZ Testplayer): the GM's form from the API (weapon), Read it on a weapon line (8 fields read, the prose shown and dropped, the line cleared), saved to the catalogue in the shop and given to the character (the description escaped); a player's New entry… from the shop's Gear tab, sent to the GM; Review… from the Requests tab, edited and saved (the request approved, the player told, the player's open shop listing it at once); foci and decks' Cost and legality sections (one cost input on a deck); the Shop button in the title bar (beside Print and the Guide), in the tools window and the toolbar; the GM without a selected token is told to select one. No raw keys, no console errors. The test world was put back.

## The independent review

| # | Kind | Finding | Outcome |
|---|---|---|---|
| B1 | Bug | A plain Approve replaced a GM template of the same name without asking (and reset its shop mark) | Fixed: the request check refuses it and points to Review…, which asks; test |
| B2 | Bug | A 400-character spell line hung the reader for ~36 s (patterns backtracking over the spaces left where text was read) | Fixed: read text is replaced by marks, not spaces; every kind × 8 fillers reads in milliseconds; test |
| B3 | Bug | Choices read as typed ("Combat", "M", "LOS") matched no select option and were lost on the next input | Fixed: turned into their values when read; test |
| B4 | Bug | "Spell focus (Combat)" lost its name (the target's aliases spell/spirit acted as labels) | Fixed: the target is labelled only "target" or "for"; test |
| B5 | Bug | An unlabelled spell line ("Manabolt Combat M P Instant LOS (F/2)D") became all name | Fixed: choice words are read before the name; duration and type words added; test |
| B6 | Bug | Replacing a template dropped its shop mark unless ticked | Fixed: kept; test |
| R1 | Risk | The cyberdeck column order has no Load Speed | Kept: the owner's tables decide; the form shows what was read to check |
| R2 | Risk | A single bare number becomes the cost | Kept: shown before saving |
| R3 | Risk | The name could keep up to 8 words of prose | Fixed: at most 6 words and 60 characters |
| R4 | Risk | Flechette damage "9S(f)" isn't read | Kept: typed in the field |
| R5 | Risk | Review: the request decided elsewhere after the save | Fixed: the GM is told the template stands |
| R6 | Risk | Switching kinds carried an adept power's cost (power points) as nuyen | Fixed; test |
| R7 | Risk | A failed give after a save said nothing | Fixed: a notice |
| R8 | Risk | An import cycle between adding.ts and newentry.ts | Kept: functions only at load (safe; tests and the live run load it) |
| R9 | Risk | A player's description keeps `@UUID` / `[[ ]]` text, enriched on the item sheet | Kept: the GM reviews it; links and rolls only |
| N | Nits | Fixed element ids clashing between two open forms; others | Ids per window; the rest kept |
