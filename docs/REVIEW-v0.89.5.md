# v0.89.5 review: localization, sixth slice (ids instead of English, joined fragments, context keys)

## What changed

- **Modifier rows by id.** Every modifier row with a fixed text carries an `id` (139 rows were given the `SR2E.Card.Mod` key's name; `sustainingASpell` → `sustaining`, `prejudiceVs` → `prejudice`, `visibleArmorInALuxurySetting` → `visibleArmor`, as the code already looked them up). `modKey(m)` (rules/dice.ts) is `#<id>` or, for rows built from a name or a table's label, the label; `modIn(keys, m)` also accepts a label, for lists saved before v0.89.5. The roll dialogs' switch-off boxes (`tnPreviewHtml`, the attack dialog's `autoLabels`, the mounted-weapon preview), the actor's filters (`#testModifiers`, perceive, social, sensor, device detection, bypass), "Use again" (its saved list goes through the same filter) and the GM's Change target number dedupe all go by key. The retarget menu entry is found by a mark (`sr2eRetarget`), its label translated when the menu opens.
- **Outcome words.** "Hit!", "Missed.", "Counterattack!", "Resisted.", "Damage fully resisted.", "No drain.", "Clean miss." are `SR2E.Card.Outcome.*`, written by `outcomeWord(id)` with `data-sr2e-outcome`; the "Takes X …" sentences are whole texts per track and noun (`takesPhysicalDamage`, `takesStunDrain`, `takesMatrix`, `takesVehicle` …) inside `takenMark` (`data-sr2e-taken`, `data-sr2e-track`). `outcomeBanner` reads the ids; the banner text is `SR2E.Card.Outcome.taken*`. Monitor statuses and damage types show as words (`SR2E.Card.Status.*`, `SR2E.Card.DamageType.*`), not ids ("Status: OK" instead of "ok"). A contest's verdict line is marked `data-sr2e-contest-result` for the look (old cards found by their English words). The Revamp's clean-miss lead is a key; the soak card knows a clean miss from a flag.
- **Template ids** (`scripts/i18n-headings.mjs`, `--check`): 205 headings carry `data-heading` (their English), read by the guide's "?" links, the section icons, the fold keys and the setup warnings' jumps through `helpers/heading.ts` `headingName`; 17 GM-only controls carry `data-sr2e-gm` (the striped edge); the edit pencils carry `data-sr2e-edit-pencil` (the Play-mode CSS no longer matches `title="Edit"`).
- **Decisions from data, not text:** the safehouse's problems (`counted`, `duplicate` flags), `scatterDirection().along`, build-check rows' `step` (`checkStep(row)`), learning projects' `subject`, `jackOutTest` builds its label (no `replace(/^Break free of/)`), `resistToxin({ from })` instead of rewriting a caller's "Resist …" label, the recent-rolls fallback and the fold caret's label translated.
- **Fragments joined.** `tx(HOST, { part: cond ? tx(PIECE) : '' })` where PIECE was a word or clause of HOST's sentence became `cond ? tx(HOST_With…) : tx(HOST_Plain)` (a script built each new text by putting the piece into the host, so the English is the same): 33 texts in documents/index.ts, 22 in the sheets, chat, NPC generator, demo, setup and settings, a few by hand (moves/jacks in to …, the morale label split across a bracket, "a {category} spell", the bug test's label). English `plural()` words are counted nouns (`tNoun`, `SR2E.Count`); `' and '` joins are `tList` (Intl.ListFormat: "a, b, and c"). Context keys end in `__<context>` (six, e.g. `SR2E.UI.attack__heading`); the dedupe tests allow them. 20 keys (26 texts) are still clauses after a bold part or a name; the v0.89.5 test counts them so a new one is noticed.
- **For translators:** `docs/TRANSLATING.md` and the generated `docs/TRANSLATING-PARTS.md` (`scripts/i18n-context.mjs`, `--check`): every text that goes into another text's placeholder, with the host.
- **The ratchet scanner** no longer counts pieces of code it cut out between nested template literals (they call a translation): 4,382 by the old count was 4,008 by the new one; now 3,999.
- **Older tests:** the rules tests import `__tests__/helpers/assert-rows.ts`, whose `deepEqual` drops a row's id only where the expected row names none; `readEnglish` strips the new template attributes.

## Checking the output

3,316 tests pass (4 skipped), tsc is clean, every converter's `--check` finds nothing. The AST comparison with v0.89.4 finds 202 statements different, all from the joins, the ids and the review fixes; the joined texts were built from the old texts by substitution.

## The independent review (one fresh reviewer over the whole diff, en.json included)

It found no bug that changes rules values or breaks a code path; it checked every joined text's placeholders and English against the old composition (all identical), every mass-added id (all on real modifier rows, the looked-up ones unchanged), the preview and roll keys (they match), escaping (every new value escaped; the data attributes take constants or L/M/S/D), and old saved data.

| # | Kind | Finding | Outcome |
|---|---|---|---|
| 1 | Bug (minor) | The magical-group heading ("Group: {name}", one per group) got one `data-heading="Group"`, so every group shared a fold key | Fixed: a heading whose text has a placeholder gets no id (the script takes it off), and keeps its shown text. Test |
| 2 | Nit | The "(from Y)" head shows for every toxin that carries `from` (critter bites, spread diseases, gas), not only darts; a forged card's `label` could replace the dart's head | Kept the wider "(from Y)" (more informative); the dart passes `label: undefined`. Test |
| 3 | Nit | The disease progress line reads "Takes **M** physical damage … Status: OK." (was "**Takes M** physical … ok") | Kept: one wording with the soak card |
| 4 | Nit | The repaired parts were a list inside a list ("the tires, engine, and sensors" after "3 boxes and") | Fixed: the parts joined with commas as before. Test |
| 5 | Nit | A Revamp clean miss now gets the "Resisted" banner (was "N successes" or "Failed") | Kept: it is what happened; noted in the changelog |

The fixes were deployed and checked live again (a gas grenade's "Resist ZZ Gas (from a grenade)", the sheet's headings and links).

## Checked live (25 Oct 2026, GM AI and ZZ Testplayer; the owed GM checks from v0.89.3–v0.89.4)

- As GM: an attack, the defender's "Defend now?" prompt, Defend (banner "Hit", `data-sr2e-outcome="hit"`), Resist: a disaster (Disaster banner), a hit taken ("Takes L physical", "Status: OK"), fully resisted ("Resisted"); a toxin ("Takes S stun"), a disease with `from` ("Resist infection: ZZ Flu (from ZZ Shooter)"); a manabolt (spell card, "No drain." with the Resisted banner, the target's resistance "Takes D physical"); a Karma re-roll and the GM's TN change (both "Replaced" notices); the Change target number menu (added once, translated label) and dialog: an applied row (Partial light, id `partial`) shows once, ticked.
- The attack dialog: the wound row's box is `#wounds`; unticking it rolled at TN 4 with no modifiers.
- A character sheet: 25 headings with `data-heading`, 26 "?" links, 23 section icons, fold keys from the ids; with "Skills" and "Attributes" switched to German in the page the links, icons and fold keys stayed the same; GM-only controls striped; the edit pencils hidden in Play mode; the fold carets' labels.
- The House rules window with each rules source ("SR2E Unified Rules Revamp — it changes 139 rules…", "SR2E Book Rules (Configure Settings…)").
- As ZZ Testplayer: the GM attacked the player's character; the player got "ZZ Runner: attacked", defended (Hit banner) and resisted ("Takes D physical") on their own client.

## Known limits

- 20 keys (26 texts) are still clauses that follow a bold part or a name (durations "for 3 days", " Matrix damage" after the damage code, "by remote control deck"); each reads on its own, and `docs/TRANSLATING-PARTS.md` shows where it goes.
- Saved fold states keyed by a heading's shown text with a suffix (a count) start unfolded once.
- An exclusion list saved before v0.89.5 in another language than the clicker's still can't match (labels); new lists are ids.
- Text built at run time inside `rules/` (catalogue checks, statblock warnings, the undo-limits list, build-check rows' wording, the safehouse problems' wording) and the sheets' code-built text are not in the language file yet; where code decided anything from that text it now uses data (except the undo-limits anchor and the statblock warning filter, which match their own English and are noted for that slice).
- A name check on a new item (`/^New /`) and user-written inline tests (`/resist/`) still look at words: they are user text.
