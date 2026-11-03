# v0.89.8 review: every tool in one place

The owner asked (25 Oct 2026) how players and the GM open the guide and the other tools, and for "an easily accessible way to access all the tools". They chose the toolbar plus a tools window.

## What changed

- **The SR2e tools window** (`applications/tools.ts`, `templates/tools.hbs`): every tool the user may use, each with a line on what it does and its current hotkey (read from Configure Controls, so a rebound key shows as rebound). Two sections: "For everyone" (12 tools: guide, your sheet, Defend, Resist, initiative, end turn, the newest chat card, roll privacy, your look and settings, two tours, Report a bug) and "For the GM" (11 tools: GM panel, NPC generator, award, the calculator, undo and the log, requests, setup, house rules, Skill Web, macros, the GM panel tour). The list is `rules/tools.ts`; the texts are `SR2E.Tools.*`.
- **Ways in:** Alt+T (a new hotkey); an "SR2e tools" button in the Actors sidebar for every user (before, players had no sidebar button at all); an "SR2e tools" button at the top of the guide's topic list; and an SR2e group (a toolbox) in Foundry's left toolbar. The group has the window plus the most used tools as buttons: 7 for players, 4 more for the GM.
- **The toolbar group has no canvas layer.** The layer that was active stays active, so the map works as before. A group that turned on the token layer would be switched straight back to the Token controls: in v14, turning on a layer selects that layer's own control (checked live).
- **Settings windows are reused:** House rules, Roll privacy and Skill Web bring an open window forward rather than replacing it, and "Your look and settings" opens Foundry's own Configure Settings at the system's section.
- **GM-only tools refuse a player** (`runTool`), as well as not being shown.
- The hotkey actions moved to module scope (`HOTKEY_ACTIONS`, `runHotkey`) so the window and toolbar share them.
- **The GM panel's tab labels** (Scene … Setup) were English in the code. They are now `SR2E.App.Ui.tab*` keys.
- **The guide:** a new topic "All the tools" (Start here) says where everything opens. The shortcuts topic lists Alt+T, and the GM panel topic mentions the window.

## Checking the output

3,338 tests (3,334 pass, 4 skipped), tsc clean, the converters' checks clean. The new `v0898.test.ts` checks:
- every tool has an action, a label and a hint, and the ids are unique;
- a player gets only the players' tools;
- every hotkey shown is a real one, and bindings are shown as text;
- the ways in exist (toolbar hook, sidebar button for every user, guide button, API);
- a GM tool refuses a player;
- the toolbar group is all buttons with no layer of its own, and its buttons run the tools;
- open settings windows come forward;
- the GM panel tab labels are keys.

## The independent review

| # | Kind | Finding | Outcome |
|---|---|---|---|
| 1 | Risk | The settings tools made a new window every time; one with the same id replaced an open one (a GM could lose house-rule edits) | Fixed: an open window comes forward; settings use Foundry's own Configure Settings window |
| 2 | Risk | A toolbar group on the token layer might bounce back to the Token controls | Confirmed live, fixed: the group has no layer and is all buttons; checked live from Walls and Tokens |
| 3 | Risk | The window grew to the GM's full list and ran off small screens | Fixed: 640 px high, scrolls, resizable |
| 4 | Risk | Fixed button height could clip the hint line | Fixed: auto height, wrapping. The live check also found the look's generic button rule made the text uppercase; fixed with a stronger rule |
| 5 | Risk | The window showed default keys, not a user's rebinding | Fixed: the current binding is shown |
| 6 | Test | Tests only matched source text | The toolbar builder (now pure, `sceneControlSpec`) and `bindingText` are run by the tests |
| 7 | Nits | `aria-label` on `<kbd>`; a minimized window didn't restore; the ratchet total went up by one (the template path, counted like help.ts's) | Fixed the first two; the third is explained in the baseline note |

## Checked live (25 Oct 2026)

- **As GM AI:**
  - The toolbar group stayed open when clicked from Walls and from Tokens, with the token layer still active. Its 12 buttons have tooltips.
  - "All SR2e tools" opened the window: 12 + 11 tools, the "?" on both headings, keys Alt+H/S/D/R/I/E/C/G, no raw keys.
  - Each tool opened where it should:
    - House rules opened once, and a second click didn't make a second window;
    - Setup opened on the GM panel's Setup tab;
    - Configure Settings opened at the system's section;
    - the macros compendium and roll privacy opened;
    - the sidebar button, Alt+T and the guide's button each opened the window.
  - The GM panel's tabs read Scene … Setup.
- **As ZZ Testplayer:**
  - Only the "For everyone" section shows.
  - The toolbar group has 8 buttons (no GM tools).
  - There is no GM button in the sidebar, but the SR2e tools button is there.
  - A direct GM tool call was refused.
  - The guide opened from the toolbar, and Defend with no attack waiting gave its notice.
- Nothing was created in the world; the browser tab was closed.

## Known limits

- The toolbar only shows while a scene is on the canvas (Foundry's rule); the sidebar button and Alt+T work without one.
- The tools window lists the GM panel's tabs, not every button inside them.
