# v0.89.1 review: localization, second slice (the notifications)

## What changed

- Every `ui.notifications.*` text written in the code is a key in `lang/en.json`: `SR2E.Notify.<File>.<key>` (documents/index.ts → `Actor`, applications/chat.ts → `Chat`, applications/sheets.ts → `Sheet`, other files by name), 973 strings in 33 groups.
- Code calls `tx('SR2E.Notify.X.key', { name: value })`, where `tx` is `t` from `helpers/i18n.ts` (imported as `t as tx`: `t` is a common local name for tokens and types). Each `${expr}` became `{name}` with `name: expr`; the values keep their `escHtml` wrappers, so a notification value is still escaped exactly once (the v0.85.0 rule).
- English inside a value (a ternary's branches, a `?? 'default'`, an `escHtml` argument, a nested template) has its own key.
- Counted nouns: `tCount(n, 'SR2E.Notify.Count.<noun>')` picks `.one` / `.other` (or the language's other categories, through `Intl.PluralRules`; a category the file lacks falls back to `.other`). It replaced the five `plural(n, 'word')` calls and the 16 `n === 1 ? '' : 's'` suffixes in notifications.
- `scripts/i18n-notify.mjs` did the conversion (TypeScript AST). `--check` fails when text could still be converted or a plural suffix is chosen in code; it prints notes for what later slices own.
- Tests: the stub `game.i18n` of the tests gives keys back, so `npm test` preloads `__tests__/helpers/english-lang.ts`, which puts the English table on `globalThis.__SR2E_EN__`; `lookup()` uses it only when `localize` returns the key. Foundry never sets it. About 106 tests compare exact notification text and pass, so they also check the round trip.
- The HTML scanner (`__tests__/helpers/html-scan.ts`): `tHtml('literal key', …)` escapes; `t(…)` and `tCount(…)` are judged by the values they fill in; a key or data object that isn't a literal is a `fix`. Probes in `__tests__/fixtures/i18n-probe.ts`.
- The ratchet: 9,248 → 8,526 English strings left in the code.
- New tests: `__tests__/v0891.test.ts` (nothing left to convert, every key exists and is used, each call passes exactly the values its text uses, one key per text per group, no English literal reaches a notification, `tCount`, the English fallback, the scanner probes). 3,258 tests pass (4 skipped).

## The independent review

A fresh reviewer printed every changed file as a canonical AST with each `tx(…)` call turned back into the template literal it stands for, and diffed it against v0.89.0: across about 920 calls the only differences were the imports, a renamed local (`tx` → `tox` in sheets.ts), the removed `plural` helper in setup.ts and the hand-made counted sites. No missing key, no placeholder without a value, no unused value; escaping identical.

| # | Kind | Finding | Outcome |
|---|---|---|---|
| 1 | Nit | `formatText` prints a null value as nothing, where the template literal printed "undefined" (7 `any` names, not escaped) | Accepted: better, and not reachable in practice |
| 2 | Nit | `tCount` uses plural rules, the old helper `n === 1` | Accepted: every count is a number |
| 3 | Risk | The scanner trusted `tHtml` with a non-literal key (an unknown key comes back as itself, unescaped) | Fixed: `full` only with a literal key; a wrapper passing its parameter as the key escapes nothing; two BAD probes added. `counted` is decided by symbol only |
| 4 | Risk | 16 plural suffixes (`'' : 's'`, `'y' : 'ies'`) and one `'unnamed'` left in values, missed by `--check` | Fixed: `tCount` with Count keys; `--check` now fails on a suffix ternary |
| 5 | Nit | Some keys are named after a first word (`Ui.of`, `Actor.on`, `Actor.is`); fragment keys with leading spaces (`Setup.and` = " and {plural}") | Planned: v0.89.5 joins fragments and gives context keys |
| 6 | — | Imports, shadowing, cycles, timing | No issue |
| 7 | Nit | The preload read en.json from the working directory; a stale exemption in `v085.test.ts` | Fixed: found from the file's own URL; exemption removed |
| 8 | — | 10 texts repeat across groups | By design (one key per text in each group) |

## Checked live (25 Oct 2026, GM AI)

- All 973 `SR2E.Notify` keys resolve with `game.i18n.has`.
- First aid on an unhurt ZZ character: "ZZ Notify Tester has no physical damage."
- Reload of a cylinder revolver from the sheet (counted noun and a nested part): "ZZ Revolver: 2 rounds loaded (cylinder); 4 more to go."
- The End-turn and Roll-initiative hotkeys with no combat: "No combat is running." / "No combat to roll for."
- No key or `{placeholder}` shown; no system errors in the console. Clean-up: the ZZ actor deleted, world time back to 0.

## Known limits (for later slices)

- `{name}: {reason}` frames whose reason is text from `rules/` (blocked actions, `can.reason`, `ex`): v0.89.4 moves the rules text.
- `REPLACED_TEXT` in chat.ts (also used on cards): v0.89.3.
- Lists joined with `' and '` (`missing.join(' and ')`): v0.89.5, with `Intl.ListFormat` or a key.
- Fragments with leading spaces and keys named after one word: v0.89.5.
- `INLINE_TEST_USAGE` (inline.ts), `describe(reset)` notes (drops.ts): rule and inline-roll text, v0.89.4.
