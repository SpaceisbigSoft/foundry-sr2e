# v0.86.0 review: keyboard shortcuts and accessibility

24 Oct 2026. An independent reviewer (a fresh agent that didn't write the code) read the diff against v0.85.0. It found 2 bugs, 4 risks and 5 smaller points. All were fixed or settled as below, and the fixes were checked live.

## What changed

- **`applications/a11y.ts` (new).** Every SR2e control can be reached with Tab and pressed with Enter or Space:
  - About 330 `<a data-action>` links with no address get `tabindex`, `role="button"` and the marker `data-sr2e-kb`.
  - Icon-only controls get their tooltip as their `aria-label`.
  - Monitor tracks, pool pips and the sheets' tab rows are one Tab stop each, moved with the arrow keys.
  - A foldable heading stays a heading; its arrow is the fold button.
  - The focus survives re-renders and returns to the opener when a dialog closes.
- **Hotkeys.** The names and hints are in `lang/en.json` (`SR2E.Keybindings.*`). New: Alt+S opens your sheet, Alt+C goes to the newest chat card, Alt+H opens the guide. The existing ids are unchanged, so players' rebound keys are kept.
- **Templates.** Screen-reader labels on the condition monitor (each box says whether it is filled) and on the mini monitors (`role="img"`). The status strip is a group, not a live region. Eight unlabelled form fields now have labels.
- **CSS.** A visible focus ring on our windows and cards, and forced-colour (Windows high-contrast) rules.
- **Fan-content wording W1–W5** in `LICENSE.md`, the guide, `system.json` and the README.

## Findings

| # | Kind | Finding | Outcome |
|---|---|---|---|
| 1 | Bug | When the pressed control was gone, the fallback focus (and Alt+C) took the first match in page order. That was the message's Delete link, so the next Enter would delete the card. | Fixed: the fallback tries an ordered list scoped to `.message-content` / `.window-content`. Alt+C takes the card's own buttons only. Checked live. |
| 2 | Bug | Headings with a "?" help link became buttons around a button and lost their heading role. | Fixed: headings are never buttons; the fold arrow is always the button. Inner controls are detected more widely (`INNER_CONTROLS`). Checked live: 23 headings, 0 with a role, 23 arrow buttons. |
| 3 | Risk | Mouse users were affected: a clicked button counted as a dialog's opener and got the focus back. | Fixed: a dialog's opener is recorded only from keyboard use (a pending key press, or `:focus-visible`). Any pointer press clears the bookkeeping. The key handler acts only where the focus ring shows. |
| 4 | Risk | Focus could move into any card rendered within 4 s, including a planted one. | Fixed: `cardTakesFocus` allows only the pressed card, or a card this user posted after the press (tests). |
| 5 | Risk | The tab-row and roving handling ran on Foundry's own windows (chat log, tracker, settings), whose tabs could be left with a stale Tab stop. | Fixed: only tab rows we mark (`data-sr2e-tabs`) roam. Core windows have only our parts enhanced (`enhanceParts`). Tab rows follow mouse switches too. |
| 6 | Risk (unverified) | Whether stopping Space at the document keeps it from Foundry's Pause. | Checked live: Space on a focused SR2e control doesn't pause, and Space with nothing focused still pauses. Foundry v14 itself ignores its keys while a control in a window has the focus. |
| — | Nit | `focusKey` escaping | `CSS.escape` (fallback in tests). |
| — | Nit | Shift+Space is also a quick roll | Documented in the guide. |
| — | Nit | Alt+C with the chat sidebar collapsed | It expands the sidebar and opens the chat tab first. Checked live. |
| — | Nit | Alt+S/Alt+H in Firefox's menus | Same kind of clash as the existing Alt keys; rebind in Configure Controls. Foundry v14 has no Alt+S/C/H of its own (checked live). |
| — | Nit | `system.json` didn't say "and Matrix" | Added. |

## Checked live (GM AI, keyboard only, 24 Oct 2026)

- **Condition monitor:** the arrow keys move along the Physical track. Enter fills to box 3, and the focus stays on "Physical box 3 (filled)" after the re-render. Space toggles it back, and the game stays paused.
- **Tabs:** the arrow keys and Enter switch to the Combat tab; `aria-selected` and the one Tab stop follow.
- **Rolling:**
  - Enter on Body opens the dialog with the focus in its TN field; Enter rolls and the focus returns to Body.
  - Escape closes the dialog and the focus returns.
  - Shift+Enter rolls without a dialog.
- **Chat cards:**
  - Alt+C goes to the newest card's first button, after expanding a collapsed sidebar.
  - Enter on a Karma re-roll posts the new card, and the focus moves to its re-roll button.
- **Other hotkeys:** Alt+H opens the guide and Alt+G the GM panel. The GM panel's tabs are a tab list.
- **Fold arrow:** Enter folds and unfolds "Attributes", and `aria-expanded` follows.
- **Mouse:** a mouse-clicked tab shows no focus ring and the key handler leaves it alone.
- **Console:** no errors. A full sheet re-render and a chat log re-render (268 messages) each took about 11 ms.

## Known limits

- There are no DOM tests of `enhance` or the key handler: the test runner has no DOM. The pure helpers, templates and source are tested, and the behaviour was checked live.
- Clicking a sheet tab or an SR2e link now gives it the focus, as clicking a button always did. Space doesn't pause the game until the focus leaves the window (Foundry's own rule).
- The token HUD and Foundry's own window controls keep Foundry's focus style.
- The player client wasn't run separately: the code is the same on every client, and Foundry enforces the GM-only hotkey.
