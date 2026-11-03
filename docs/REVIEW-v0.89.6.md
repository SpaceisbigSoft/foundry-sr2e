# v0.89.6 review: localization, seventh slice (the text the code builds at run time)

## What changed

- **Two new stores in `lang/en.json`.** `SR2E.App.<File>` holds the windows' code-built text (sheet previews and hints, option labels, window text, tours, the printable sheet, the Token Action HUD labels), `SR2E.Text.<File>` the text the rules build at run time (import reports, Apply (GM) lines, NPC generator descriptions, catalogue checks, statblock warnings, the undo-limits list, build-check rows' wording, the safehouse problems' wording). documents/index.ts went to `SR2E.Card.Actor` / `SR2E.Text.Actor`.
- **Counts, by part (each part done by its own helper with a strict file scope, merged by me):** sheets.ts 548 keys; documents/index.ts 347; the other applications 556; rules A (npcgen, statblock, charimport, demo, items) 283; rules B 515; rules C 414. 10 more fragments in index.ts were joined (the fragment list in the v0.89.5 test is now 16).
- **Module-level tables** are never translated at load (a top-level `tx()` would keep the key). They are translated in place through `rules/texttables.ts` (`scripts/i18n-rules.ts`, now 1,200 table texts): weapon layouts, limbs, scatter throw and compass words, IC behaviours, psychotropic effects, element effects, light, vision, concealment, the HUD groups and layout, the wizard steps (label, hint), the token-art figures and archetypes, the settings sections. Others became key maps read with `tKey` (spirit kinds, traditions, senses, concealment on the sheets; the token state statuses `SR2E.Text.Tokens.*`) or functions (`elementChoices()`, `modeLabel()`, `inlineTestUsage()`, the tours' `body: () => string`).
- **Decisions from data, not text** (the two left over from v0.89.5): the statblock warnings carry codes (`statBlockWarningCode(list, text)`, a side table that also finds a code by text, so a copied list keeps them); the undo-limits list is rows `{ id, text }` (`undoLimitRows`) and the bookkeeping anchors on `notLogged`.
- **Headings:** the skill groups and the effects groups carry their English as `data-heading` (the guide's links, the icons and the fold keys don't change with the language).
- **The ratchet** (`__tests__/helpers/i18n-baseline.json`): 3,999 → 2,453.
- **Escaping:** three values put into translated HTML were not escaped before going in (`describeSpan`, a problem text, a "left" count text): now `escHtml`. The HTML scans accept a `tx()` call whose every value is escaped.

## Checking the output

3,327 tests (3,323 pass, 4 skipped), tsc clean, every converter's `--check` finds nothing. The new `v0896.test.ts`: every `SR2E.Text` / `SR2E.App` key is used, counted texts have `other`, no tags and no keys inside the new texts, no top-level `const X = tx(` in rules or applications, plus a test per review fix. Rules values unchanged (the rules tests pass unchanged apart from tests that read source strings, which now name the keys).

## The independent review (three passes by fresh reviewers over the diff, en.json included)

| # | Kind | Finding | Outcome |
|---|---|---|---|
| 1 | Bug | The summon dialog's Kind list showed raw keys (`SR2E.App.Sheets.spiritKind…`) | Fixed: read with `tKey`. Test, checked live |
| 2 | Bug | A site device's sense label showed a raw key | Fixed: `tKey`. Test, checked live |
| 3 | Bug | "Bought … (on order)" and the "… on order" project labels were translated, but the refund and the advancement log match them in English | Fixed: kept English (comments), keys removed. Test |
| 4 | Bug (minor) | The effects groups' headings had no `data-heading` (icon and fold key would change with the language) | Fixed. Test, checked live |
| 5 | Bug (minor) | Statblock warning codes were lost on a copied list | Fixed: code also found by text. Test |
| 6 | Bug (minor) | In another language a raise was logged twice (the ledger line is English, the raise label translated) | Fixed: raises carry an English `alias` the log also matches. Test |
| 7 | Bug (minor) | The matrix "free" count could go negative | Fixed: clamped at 0 |
| 8 | Nit | The bug report's headings were translated; it is for the maintainers | Reverted to English. Test |
| 9 | Nit | The approvals "asked as" note can mix the asker's and the GM's languages | Kept (known limit) |
| 10 | Nit | The approvals dedupe by label | Kept (minor; same language in one world in practice) |
| 11 | Nit | A few channel and code project labels, the region-limit texts, the printable sheet's `lang="en"`, a `tx` inside a `title=` in urr80-core | Kept (known limits, next pass) |

## Checked live (25 Oct 2026, GM AI, ZZ test actors and a ZZ scene, all deleted after)

- Every actor sheet type (character, NPC, vehicle, host, site, spirit, IC, safehouse), item sheets, the GM panel's tabs, the NPC generator, the tours, the token status names, an attack preview and card: no raw key anywhere in the HTML.
- After the review fixes: the summon dialog's Kind list ("Nature spirit, Elemental, Watcher, Other, Toxic spirit, Insect spirit"), a site camera row ("camera · Visual 3"), the effects tab's group heading (`data-heading="Combat"`, fold key `character:effects:combat`), the skill group heading (`data-heading="Active skills"`, "?" link).

## Known limits

- Text the logic parses stays English: ledger reasons (Bought / Given up (refund) / training refunds), the "on order" project labels, the principal's role (`/principal/`), the statblock text format (`statBlockText`), the bug report.
- Still English tables: DOC_WORDS / FIELD_WORDS (gmtools regex replacements), RAISE_FIELDS, POOL_SHORT, the Dice So Nice colour set descriptions, the demo's names and drawings.
- Relay notes (a spirit's dismissal and the like) are written on the GM's client, in the GM's language.
- 16 fragment texts remain (counted by the test; see `docs/TRANSLATING-PARTS.md`).
- The printable sheet says `lang="en"`.
