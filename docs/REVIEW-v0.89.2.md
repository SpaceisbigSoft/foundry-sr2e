# v0.89.2 review: localization, third slice (dialogs and window titles)

## What changed

- **Dialogs:** every dialog's title, content and button labels are keys in `lang/en.json`: `SR2E.Dialog.<File>.<key>` (documents/index.ts → `Actor`, applications/chat.ts → `Chat`, applications/sheets.ts → `Sheet`, other files by name), about 1,500 strings. Code calls `tx('SR2E.Dialog.X.key', { name: value })`.
- **Window titles:** the static titles in `DEFAULT_OPTIONS` are the keys themselves (`'SR2E.Window.<File>.<key>'`): Foundry v14 localizes `window.title` (`get title() { return _loc(this.options.window.title) }`) and DialogV2 button labels (`_loc(label)`, set with `innerText`), checked in Foundry's own source. The three `get title()` getters (Add to…, Create a character…, Spend Karma…) use `tx`.
- **Content is HTML.** `scripts/i18n-dialogs.mjs` lexes each template: tags stay in the code; each run of text between tags (with its `${…}` values) becomes one `${tx(…)}`, and so does each `title` / `placeholder` / `aria-label` / `data-tooltip` / `alt` value. The text is kept as HTML source (an entity stays an entity); values keep their `escHtml`. Whitespace inside a run with a line break would become one space (none did; not in `<textarea>` / `<pre>`).
- **What it follows:** content in local variables and same-file helpers (only HTML templates there, never a bare literal: those are code), parameters (`#pickPerson(actor, title, content)`, `pickActors(title, types, verb)`, `importDialog(title)`, `promptPoolDice`'s title), `render` previews (`.textContent =`, `.innerHTML =`, preview helpers' `baseLabel` / `note` / `warn`), `{ action, label }` buttons anywhere in a config, display lists (`const hints = […]`), dialogs called through an alias (`const dlg = …DialogV2`), and `gmMay`'s confirmation title and lines.
- **What it leaves:** values inside tags (option values, `${sel ? 'selected' : ''}`), text used to search other text (`.replace(pattern, …)`, `includes`…), modifier rows `{ label, value }` (the roll code compares their labels), and data a callback returns ("New spell", "Magical group" as default names).
- **Counted nouns** moved from `SR2E.Notify.Count` (v0.89.1) to a shared `SR2E.Count`; the 13 plural suffixes chosen in code inside the new texts became `tCount`.
- **The HTML scanner:** a `tx()` written into an HTML template is judged value by value, each row under its own expression, so the reviewed allow-list entries still match.
- `attackTargetOptions(…, emptyLabel?)` (canvas.ts): the blank option's label is an argument now, and its "(no target)" / "(targeted)" texts are keys.
- The ratchet: 8,526 → 8,138. New tests: `__tests__/v0892.test.ts`; probes in `fixtures/i18n-probe.ts`. 3,271 tests pass (4 skipped).

## Checking the output

An AST comparison (each `tx()` / `tCount()` inlined back from en.json, every class member and top-level statement of every file compared with v0.89.1) finds only the 10 static window titles (now keys), `attackTargetOptions` and its two callers different. A run without whitespace normalisation gives the same result, so no whitespace changed either.

## The independent review

| # | Kind | Finding | Outcome |
|---|---|---|---|
| 1 | Bug (other languages) | Two `.replace()` calls searched for a translated "(no target)" option that `attackTargetOptions` still wrote in English: Assense lost "(a place or thing)", healing spells lost "Name (self)" | Fixed: `emptyLabel` argument, no `.replace()`; the converter never converts text passed to `replace` / `includes` / `indexOf` / `split` / `startsWith` / `endsWith` / `match` / `search`; a test bans `tx(` there |
| 2 | Risk | Translations are written into attributes unescaped (62 placeholders and titles) | A test: no text used inside an attribute holds a straight double quote. (Escaping them would double-escape their values.) |
| 3 | Risk | Dialog texts are HTML source, but some go to `textContent` and preview labels are escaped again: an entity written there would show | Documented here and in `helpers/i18n.ts`; translators write plain text and use entities only where the English has one |
| 4 | Risk | Preview modifier labels ("Other", "Obviousness: …") were translated while the roll sends English, and labels are compared | Fixed: modifier rows `{ label, value }` stay English (both sides together in v0.89.4) |
| 5 | Nit | `{plural}` named ✓/✗ and "+" values | Fixed: `{mark}` / `{sign}`. `{part}` for clauses and sentences split around tags: v0.89.5 |
| 6 | Nit | Not converted: `pickActors` verbs, a cross-file `promptPoolDice` title, `gmMay` titles and lines | Fixed (converter rules and by hand); a test checks every call of the dialog helpers and `gmMay` in every file |
| 7 | Nit | Two source tests matched too loosely; no probe for a raw value beside `tx` in a conditional | Fixed: anchored on the `tx(…)` form; probes added |
| 8 | Nit | `Number()` replaced `escHtml()` around counts | Accepted: a count is a number |

## Checked live (25 Oct 2026, GM AI)

- All 1,528 `SR2E.Dialog` / `SR2E.Window` / `SR2E.Count` keys resolve with `game.i18n.has`.
- The GM panel's title ("SR2e GM panel", a key in `DEFAULT_OPTIONS`), and Heal several at once (title, labels, options with their values `stun` / `physical` / `both`, hint, button).
- A ZZ character's Assense (first option "(a place or thing)" through `emptyLabel`) and Attack dialog (title, labels, range options with their values, the converted hints, the live preview, the button).
- Create a character and Spend Karma (the converted `get title()` getters).
- No key or `{placeholder}` shown anywhere; no system errors. Clean-up: the ZZ actors deleted, world time 0, no chat messages.

## Known limits

- Sentences split around inline tags (`<strong>name</strong>`), fragments with leading spaces and `{part}` placeholders: v0.89.5 (join fragments, context keys).
- Modifier labels and rule labels: v0.89.4 (both the preview and the roll).
- Data defaults ("New spell", "Magical group"): left as data.
- Dialog-card text in chat (`content:` of chat messages): v0.89.3.
