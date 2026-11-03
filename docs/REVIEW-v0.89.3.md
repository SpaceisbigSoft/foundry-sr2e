# v0.89.3 review: localization, fourth slice (the chat cards)

## What changed

- **Card text:** about 2,260 strings of chat-card text are keys in `lang/en.json`: `SR2E.Card.<File>.<key>` (documents/index.ts → `Actor`, applications/chat.ts → `Chat`, other files by name; 1,950 texts and 117 counted texts). Code calls `tx('SR2E.Card.Actor.key', { name: value })`. Cards posted before the update stay as they were; a re-roll keeps the language its card was first posted in (labels live in the card's flags).
- **Counts:** a run of text whose wording depends on one count (`n === 1 ? '' : 's'`, `'die' : 'dice'`, `is` / `are`) is one counted text, `tCount(n, 'SR2E.Card.<File>.key', { … })` with `one` / `other` forms (`{count}` is n, and may be left out when the number sits in its own tag). A run with two counts gives each `${n} word${…}` a shared counted noun (`SR2E.Count.*`). Where the English printed the count escaped, the count is `Number(n)`.
- **`scripts/i18n-cards.mjs`** (new). A literal converts only when a data-flow check (the TypeScript checker on each file) says every use of its value ends on screen: the `content` / `flavor` / speaker `alias` of a chat message, a resolved test's `html`, a test's label (`#snapshot`), DOM text written by the card files (`textContent`, `title`, `innerHTML`, `setAttribute('title', …)`), a notification, a `playerMay` confirmation line; through `?:`, `||` / `??` / `+`, the escaping wrappers, template values in text (not inside a tag, except the shown attributes), locals and parameters, arrays that are joined, `.map` callbacks, returns of same-file functions, properties of options objects and of returned objects, constant text maps read by key, and calls from other files into an actor method (judged inside documents/index.ts). Anything else stops it. HTML is handled as in v0.89.2 (tags stay in the code, each text run is one string, kept as HTML source). It loops each file to a fixed point and runs index.ts first, then the rest, then index.ts again with the other files' call sites of its public methods.
- **Hand edits:** chat.ts `REPLACED_TEXT` → `replacedText(why)`; the combat tracker's Delay / Act now / Done buttons; the defend/resist prompt's verb and `promptPlan`'s lines (`SR2E.Dialog.Chat.*`); trust.ts `playerMay`'s fallback line; index.ts `resistToxin` chooses its head ("Resist X" / "Resist infection: X") before the label is built (no search for a translated "Resist"; a caller's own label keeps the old rewrite).
- **Left English on purpose:** the outcome words outcomeBanner reads back from a card ("Hit!", "Missed.", "Counterattack!", "Resisted.", "Takes ", "fully resisted", "No drain.", "Clean miss"): v0.89.5 moves both sides together.
- The ratchet: 8,138 → 7,137. `scripts/i18n-equiv.mjs` now expands counted texts (and the wording they replace) into their two forms.

## Checking the output

The AST comparison (every `tx()` / `tCount()` inlined back from en.json, every class member and top-level statement compared with v0.89.2) finds the English identical except the four intended hand edits (the `REPLACED_TEXT` table and its two reads, the disease label). 3,284 tests pass (4 skipped); tsc is clean.

## The independent review (three reviewers: index.ts 1–9500, index.ts 9500–end, the other files and the scripts)

| # | Kind | Finding | Outcome |
|---|---|---|---|
| 1 | Bug (other languages) | Lists of ids searched with `.includes` were translated: `down3` (statuses: no morale card), `#projectCallArgs` deck parts (a finished deck-part project made nothing), `#ownAttackOptions` situational ids, `masking` / `kinds` (invisibility and silence stopped concealing) | Fixed in the converter: an array that is searched holds ids; a local whose only reads test it is not shown. Test: no list of translations is searched |
| 2 | Bug (all languages) | Three such lists at the top level of a file (`CONTAGION` in chat.ts, `BODY_FLAGS` in look.ts, `DEVICE_LOCKS` in sheets.ts) were translated *at module load*, before Foundry has its languages: they would have held raw keys even in English (no contagion, body classes never removed, no device a lock). The tests hid it (their English preload is ready before import) | Fixed: nothing evaluated at load converts. Test: no `tx` / `tCount` / `tHtml` outside a function |
| 3 | Risk | The flow check counted any search of a string as neutral | Fixed: only a search for markup (a tag, a `data-` attribute, a regular expression) is neutral, as outcomeBanner's are |
| 4 | Risk | Translations inside attributes (`title="${tx(…)}"`) are not escaped: a `"` in a translation ends the attribute | As in v0.89.2: the test that no text used in an attribute holds `"` covers card texts too (escaping would double-escape the values). Translators: no straight double quotes in texts |
| 5 | Risk | outcomeBanner's "Takes M …" reads the word after `</strong>`, now the first word of a translation (Matrix and vehicle soak) | v0.89.5 (build the banner from data) |
| 6 | Risk | Some card texts are written with `textContent` or escaped again (`replacedText`, the GM tools' labels, the tracker buttons, `playerMay` lines): an entity there would show | Documented: translators write plain text and use entities only where the English has one (as in v0.89.2) |
| 7 | Nit | Intl's `one` for −1 and for the string "1" differs from `=== 1` (a past-due "for -1 day"; counts read from flags) | Accepted (no positive count changes); noted for v0.89.5 |
| 8 | Nit | Fallback words inside `.slice()` and `plural(n, 'day')` outputs stay English; fragments split around tags or values | v0.89.5 (fragments and context keys) |

## Checked live (25 Oct 2026)

As ZZ Testplayer (GM AI was held by a stale session): every `SR2E.Card` / `SR2E.Count` key resolves with `game.i18n.has` (1,950 texts, 117 counted), and every key the built code names exists. Real test cards from an unsaved ZZ actor read as before: "3 successes" / "1 success" / "0 successes", the banners "Success (3)" / "Success (1)" / "Failed", "Re-roll 3 failures (Karma 1)" / "Re-roll 2 failures (Karma 1)", "Buy a success (Karma 1, permanent)", the TN hover title; a GM roll card with the speaker "GM". No key, placeholder, "undefined" or "NaN" in any card. Clean-up: the test messages deleted.

## Known limits

- The outcome words and the "Takes …" banner (v0.89.5).
- Sentences split around inline tags and values, leading spaces, `{part}` placeholders, English `plural()` words inside texts (v0.89.5).
- Modifier labels, rule labels, project labels, ledger reasons and other stored or compared text stay English (v0.89.4 for the rule labels; stored text stays data).
- Text that only reaches the screen through another client (the relay's `note` replies) and code-built UI outside the card files (sheets.ts, other applications) is not in this slice.
- A card keeps the language it was posted in.
