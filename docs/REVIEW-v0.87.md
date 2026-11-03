# v0.87.0 review: printable character sheet and "Report a bug"

24 Oct 2026. An independent reviewer (a fresh agent that didn't write the code) read the diff against v0.86.0. It found no way to run script in the printed page, but did find 2 bugs and 11 risks and smaller points. All were fixed or settled as below, and the fixes were checked live.

## What changed

- **Print** (`rules/printsheet.ts` builds the page; `applications/print.ts` is the Foundry glue).
  - A printer button sits in the title bar of character, NPC and spirit sheets, for users who can see the sheet. It opens a dialog with three checkboxes: empty condition monitor, leave out the notes, and include the notes' secret sections (owners only).
  - The dialog then offers **Print** (a frame sandboxed without scripts, then the browser's print dialog, which also saves as PDF), **Open as a page** (a blob tab) or **Save as a file** (an `.html` download).
  - The page is black on white: name, facts, attributes (with the base value where it differs), derived values and pools, the condition monitor in wound groups (filled boxes grey with a slash), then every list that has entries, then the cleaned notes.
  - Every value is escaped, and the page carries a no-script Content-Security-Policy.
- **Report a bug** (`rules/bugreport.ts` builds the text; `applications/bugreport.ts` is the glue).
  - The system's last 20 console errors and warnings are kept in this browser, matched by the `sr2e |` prefix or a stack through `systems/sr2e/`.
  - The report window holds Markdown for a GitHub issue: versions, browser, GM or player, rules source, changed house rules, active modules, a few settings and those errors. It has Copy and Refresh buttons. It opens from a button in the guide, from Configure Settings, or from `game.sr2e.api.openBugReport()` (`bugReport()` returns the text).
  - Nothing is sent anywhere by itself. A client setting, *Keep recent errors for bug reports*, turns the log off.
- **Guide:** a new topic, "Printing a sheet and reporting a bug".

## Findings

| # | Kind | Finding | Outcome |
|---|---|---|---|
| 1 | Bug | "Open as a page" built the page after the click, enriching the notes first. A long biography could take longer than the browser's pop-up window allows. | Fixed: the data is gathered while the dialog is open, so the click only builds the HTML and opens the tab. |
| 2 | Bug | In the desktop app, a blob tab may not open at all. | **Save as a file** added (an `.html` download to open in any browser); the guide says when to use it. The desktop app itself wasn't tested here. |
| 3 | Risk | Pictures stored as Foundry paths broke in the tab. | A `<base href>` with Foundry's address is added (`safeBase`: only a plain http(s) address). |
| 4 | Risk | The GM's secret sections in an NPC's notes were printed. | Left out by default (`withoutSecrets`); owners can tick them in. |
| 5 | Risk | Every console call from any module was turned into JSON (deep copies, getters run). | Fixed: `entryText` takes only strings and errors, and objects become `[object]`. A guard stops the log from logging into itself. |
| 6 | Risk | Any logged object from an sr2e world matched "sr2e" and was kept, with its data. | Fixed: only the `sr2e \|` prefix or an `sr2e` stack line counts. Checked live: another module logging an actor isn't kept. |
| 7 | Risk | Wrapping the console makes DevTools show sr2e as the source of every warning. | Kept (it is how the log works). The new client setting turns it off (takes effect after a reload), and the setting's hint says why. |
| 8 | Risk | `system.json` has no `bugs` address yet. | Belongs to the GitHub release step (the plan lists `url` and `bugs`). The window already shows the address once it is set. |
| 9 | Nit | `printInFrame` returned a meaningless value and gave no notice when `print` is missing. | Fixed: it returns nothing and gives the notice in both cases. |
| 10 | Nit | The overflow count worked only by a fallback. | Fixed: `Array.isArray(view.boxes)`. |
| 11 | Nit | The Print button showed for Limited users. | Fixed: shown only to users who can view the sheet. |
| 12 | Nit | The settings menu makes a second window instance. | Left as is: same id, harmless. |
| 13 | Nit | Tests didn't reach the glue. | Added tests: the log (repeat counter, cap), the base address, the overflow count, getters not run, other modules' objects not kept. The glue itself was checked live. |

## Checked live (GM AI, 24 Oct 2026)

- **A test character's printout**, rendered in a frame: elf hermetic with skills, a weapon, armor, a spell, gear, a contact, 4 Physical and 2 Stun.
  - Values are escaped (a name with `<i>` prints as text), the attribute bases show, and the monitor groups with their slashes are there.
  - The drain shows as "(F÷2)+1 M". Empty lists are left out.
  - An `<img onerror>` in the biography lost its handler and ran nothing.
- **Secrets:** left out of the notes without the box, in with it.
- **Other sheets:** an NPC and a spirit print (the spirit has no Overflow).
- **The dialog:** three checkboxes (the GM owns the character) and three buttons. The title shows the name as text.
- **Report a bug:**
  - The window opens from the API and from the guide's button, and the settings menu and setting are registered.
  - The text has the versions, browser, modules and errors.
  - An `sr2e |` error is kept; an unrelated error and another module logging an actor are not.
  - Copy falls back to selecting the text when the clipboard is refused.
- **Not checkable here:** the real print dialog. The pane gives no screenshot of it, but the page stayed responsive and nothing was logged. Please try **Print** once in your own Foundry window and in the desktop app.
