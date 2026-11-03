# v0.68.0 live-test plan: the second interface pass (layouts, status strip, your turn, roll dialogs, steppers, GM dashboard)

Two tabs: **GM** (GM AI) and **PL** (ZZ Testplayer). Drive the UI with JavaScript in the page and read the DOM; take the screenshots marked **[SHOT]** (they go to the user). After a setting change, a click or an update, wait about 500 ms before reading (the combat re-render waits 120 ms, grouped notices 300 ms, the wheel's change 450 ms). Every test document is named "ZZ …". A browser reload (F5) is enough after updating the system (no new document types).

Each check: **steps** → *expected*. Write down anything that differs, plus the console errors seen during the check.

## How to drive it

- New client settings (per tab): `sheetLayout` (`tabs` | `combat` | `compact`), `numberSteppers`, `rememberRolls`, `rememberWindows`, `groupNotes` (bools, default true). `const S = (k, v) => game.settings.set('sr2e', k, v);` Changing `sheetLayout` or `numberSteppers` re-renders open actor sheets.
- Look settings from v0.67: `lookTheme` (`street` | `corp` | `contrast`), `textScale` (90–130).
- localStorage keys (per browser): `sr2e.rollMemory` (`{key: {t, v}}`, keys `cast|<actorUuid>|<spellId>`, `skill|<actorUuid>|<itemId>`, `cyber|<actorUuid>`, `summon|<actorUuid>`), `sr2e.windows` (`{ids, kinds}`), `sr2e.compactFolded` (`{"character:magic": true, …}`), `sr2e.gmMookCards` (`'true'` / `'false'`, missing = on). Read with `JSON.parse(localStorage.getItem('sr2e.rollMemory'))`.
- House rules (GM): `const HR = (enforce) => game.settings.set('sr2e', 'houseRules', { values: { ...(__zzHR.values ?? {}), 'ACTIONS.enforce': enforce }, advanced: __zzHR.advanced ?? {} });` Default enforce is `warn`. The window: `new (game.settings.menus.get('sr2e.houseRulesMenu').type)().render(true)` (id `sr2e-house-rules`).
- Sheets: `await a.sheet.render(true); const E = () => a.sheet.element; const B = () => E().querySelector('.sr2e-sheet');`. Layout class on `B()`: `sr2e-layout-<layout>`; on `E()`: `sr2e-win-<layout>`. Picker: `B().querySelector('.sr2e-sheet-tools select.sr2e-layout-pick')` (set `.value` and dispatch `change`).
- Strip: `B().querySelector('.sr2e-stuck > .sr2e-strip')`; parts `.sr2e-strip-cm .sr2e-cm-mini`, `.sr2e-strip-wound`, `.sr2e-strip-item`, `.sr2e-strip-danger`, `.sr2e-strip-pool` (`small` = C / Sp / H / Ct / KP, pips `a.sr2e-pip[data-action="setPool"][data-pool][data-value]`), `.sr2e-strip-weapon` (`a[data-action="attackWeapon"]`, `small` mode, `b` ammo with `low`, class `out`), `.sr2e-strip-turn` (`i.sr2e-act-pip.on`), `.sr2e-strip-myturn` on the strip.
- Combat column: `B().querySelector('aside.sr2e-combat-col')`. Compact sections: `B().querySelectorAll(':scope > section.sr2e-tab')`, header `.sr2e-tab-head`, folded `sr2e-tab-folded`.
- Steppers: `span.sr2e-stepper > button.sr2e-step-down, input, button.sr2e-step-up`. Monitor: `.sr2e-cm-steps a[data-action="stepMonitor"][data-track][data-delta]`.
- Sheet action without clicking: `game.sr2e.runSheetAction(actor, 'castSpell', { itemId }, { shiftKey: false })`. Newest dialog: `const dlg = () => [...document.querySelectorAll('.application.dialog')].at(-1);`.
- Render counter: `window.__zzR = {}; Hooks.on('renderApplicationV2', (app) => { const n = app.document?.name; if (n?.startsWith('ZZ ')) __zzR[n] = (__zzR[n] ?? 0) + 1; });`.
- No sideways scroll: `const ow = (el) => el.scrollWidth <= el.clientWidth + 1;` on `E().querySelector('.window-content')`.
- GM panel: `const gp = game.sr2e.api.gmPanel(); const G = () => gp.element;`, tabs `[data-action="gmTab"][data-tab="party"|"npcs"|"combat"|…]`. Tracker: `ui.combat.element` (open the Combat sidebar tab).

## Setup

Both tabs save their client settings and storage (copy into the run notes too):
```js
window.__zzC = Object.fromEntries(['sheetLayout','numberSteppers','rememberRolls','rememberWindows','groupNotes','lookTheme','textScale'].map(k => [k, game.settings.get('sr2e', k)]));
window.__zzLS = Object.fromEntries(['rollMemory','windows','compactFolded','gmMookCards','sheetMode'].map(k => [k, localStorage.getItem('sr2e.' + k)]));
```
GM also: `window.__zzHR = foundry.utils.deepClone(game.settings.get('sr2e', 'houseRules'));` (expected `{values:{}, advanced:{}}` or the user's; keep it).

GM creates (`const PL = game.users.getName('ZZ Testplayer'); const own = { default: 0, [PL.id]: 3 };`):
- **ZZ Runner**: character, `ownership: own`, Body 4, Quickness 5, Magic / a tradition so the Magic tab shows (or a spell item), skills Firearms 5, Sorcery 5, Conjuring 4, Perception 3 (specialization on Firearms), `system.karma.pool: 3`, weapons **ZZ Pistol** (modes `SA`, ammoMax 10, ready) and **ZZ Rifle** (modes `SA/BF/FA`, ammoMax 30), spell **ZZ Bolt** (Force 4), a program item only (no deck: the Matrix tab shows with an empty cyberdeck list). Leave contacts, foci, geasa, adept powers, edges/flaws empty.
- **ZZ Ganger**: NPC, Body 5, Firearms 4, weapon ZZ SMG (9M, `SA/BF`), no spells, no gear.
- **ZZ Spirit**: spirit, Force 3, services 2, no attacks or powers.
- **ZZ Van**: vehicle, empty (no cargo, nobody aboard, no modifications).
- **ZZ Scene** (activate; PL views it) with tokens of ZZ Runner (linked) and ZZ Ganger.

Keep both consoles open (`read_console_messages`, pattern `sr2e|Error|error`).

## A. Settings

1. **Settings listed and grouped.** Steps: PL then GM: Configure Settings → System tab; read `h4.sr2e-settings-head` texts and the rows under each. → *Headings in order "Look and layout", "Rolls, dice and chat", "Tokens and the map", "GM and world", "Other" (only those with rows). The five new settings show: "Sheets: layout" (Tabs / Combat column … / Compact …), "Sheets: − / + on numbers", "Windows: remember size and place", "Notifications: group bursts" under Look and layout; "Roll dialogs: remember my last choices" under Rolls. PL sees no GM-world rows. Close and re-open: headings not doubled. Foundry's own Core tab unchanged.*
2. **Client scope.** Steps: PL: `S('sheetLayout','compact')`. GM: read its own value. → *GM still `tabs`; PL keeps `compact` after F5. Then PL: `S('sheetLayout','zz')` and open ZZ Runner: falls back to Tabs, no error. Put PL back to `tabs`.*

## B. Layouts

3. **Tabs (default).** Steps: PL: open ZZ Runner. → *`B()` has `sr2e-layout-tabs`, `E()` has `sr2e-win-tabs`; the `.sr2e-stuck` block holds the strip then the tab bar; tabs carry icons (`.sr2e-tabs .item > i`, e.g. Main `fa-user`, Combat `fa-crosshairs`, Magic `fa-hat-wizard`, Matrix `fa-network-wired`); no `aside.sr2e-combat-col`.*
4. **Picker in the tool bar.** Steps: read the `select.sr2e-layout-pick` (after the stuck block, in `.sr2e-sheet-tools` beside the search box). Pick "Combat column" with a real click. → *Options Tabs / Combat column / Compact, current selected; picking sets the setting (`game.settings.get` reads `combat`), the sheet re-renders once (counter +1, not a loop), the actor is NOT updated (no `updateActor` fired: the select isn't form data). Exactly one picker after the re-render.*
5. **Combat column contents.** Steps: PL, layout `combat`, sheet 760 px wide. → *Grid: two columns (`getComputedStyle(B()).display === 'grid'`); the aside has blocks Defense (Resist, First aid; "Full defense" only in a started combat), Weapons (ZZ Pistol with one `SA` mode button, ZZ Rifle with `SA` `BF` `FA` buttons, reload icon, damage and `x/30` ammo; Unarmed row with Attack), Spells (ZZ Bolt "F4" Cast), Actions (the quick actions). The tabs still work beside it (click Gear: column stays).*
6. **Column buttons work.** Steps: PL: click ZZ Rifle's `BF` button; cancel. Click ZZ Bolt's Cast; cancel. → *The attack dialog opens with mode BF preselected; the Cast dialog opens for ZZ Bolt. No double dialogs.*
7. **Column falls back.** Steps: `a.sheet.setPosition({width: 560})`, then 440. → *Under ~38rem of content the column moves under the stuck block as one column (`display: block`, the aside `position: static`); `ow(...)` true at 560 and 440; back at 760 the two columns return without re-render.*
8. **Compact.** Steps: PL: layout `compact`; read the sections. → *No tab bar shown (`.sr2e-tabs` display none); every tab is a `section.sr2e-tab` with a `.sr2e-tab-head` (caret, tab icon, label, `role="button"`, `tabindex=0`); Main and Combat open (`aria-expanded="true"`), others folded (`sr2e-tab-folded`, content hidden).*
9. **Compact folding remembered.** Steps: click the Magic head; press Enter on the Gear head (focus + `keydown`); fold Main. Close and re-open; then F5 and re-open. → *Magic and Gear open, Main folded, each time; `sr2e.compactFolded` has `character:magic: false`, `character:gear: false`, `character:main: true`. GM's tab (other browser storage) is unaffected.*
10. **Compact search.** Steps: fold Gear; type `pistol` in `.sr2e-sheet-search`. → *`B()` gets `sr2e-searching`; hits inside folded sections show (folded content visible while searching) and are highlighted as before; clearing the box folds them away again; the box keeps focus while typing.*
11. **Setup warning jump.** Steps: Compact with Main folded; click a setup warning link in the summary (`a[data-action="jumpTo"]`, e.g. one pointing at skills or contacts). → *Its section unfolds (`sr2e-tab-folded` removed) and scrolls to the heading. Note: this opening is not written to `sr2e.compactFolded` (expected).*
12. **NPC and spirit.** Steps: PL→GM: open ZZ Ganger and ZZ Spirit in each layout. → *Both carry `sr2e-layout-<layout>` and the picker; Combat column shows the aside (Ganger: ZZ SMG with SA/BF; Spirit: Unarmed only, no Spells block); Compact on these one-page sheets changes nothing else and breaks nothing. ZZ Van and ZZ IC have no picker and stay as before.*
13. **Two sheets, one switch.** Steps: PL: ZZ Runner and ZZ Spirit (owned? else GM: ZZ Runner and ZZ Ganger) open; change the layout from the first sheet's picker. → *Both re-render into the new layout (counters +1 each), both pickers show the new value; no duplicated strips, pickers, icons or tab heads (`querySelectorAll` counts 1 per sheet).*

## C. The status strip

14. **Contents out of combat.** Steps: PL: ZZ Runner, Tabs, Physical 0. → *Strip: mini monitor (P, S, OF bars), no wound, no status, "Init R + 1d6" (Reaction + dice, `title` "Initiative: Reaction + dice"), pool `C` with pips and `n/n`, `Sp` (Spell Pool), `KP` 3/3; no `H` (no deck), no `Ct` (not jumped in); readied weapon. The summary no longer has `.sr2e-cm-chip`, `.sr2e-pools` or the Init chip but keeps status chips, pins, quick actions and setup warnings.*
15. **Strip after damage.** Steps: GM: `runner.update({'system.monitor.physical': 4})`. PL: read the strip without touching the sheet. → *The strip re-renders: P bar 4 filled, `+2 TN` (`.sr2e-strip-wound` "+2"); Physical 10 + 1: status "Dying" with `sr2e-strip-danger`; set back to 0: wound and status gone. Strip stays one element.*
16. **Stuck while scrolling.** Steps: scroll the sheet's `.window-content` to the bottom of Main. → *`.sr2e-stuck` stays at the top (sticky, its `getBoundingClientRect().top` near the content top), with the tab bar; content doesn't show through it.*
17. **Pool pips.** Steps: PL: click Combat Pool pip 2 in the strip, then pip 2 again. Click KP pip 1. → *`system.poolSpent.combat` = total − 2, then total − 1 (clicking the last filled pip empties it); Karma Pool spent 2. The strip, the GM panel party card and the tracker pools agree. Put spent back to 0.*
18. **Readied weapon order.** Steps: no flags: read the weapon. Pin ZZ Rifle (sheet pin). Then attack once with ZZ Pistol (any outcome). → *First: ZZ Pistol or ZZ Rifle, whichever comes first as a ready gun with ammoMax > 0; after pinning: ZZ Rifle; after the attack: ZZ Pistol (`flags.sr2e.lastWeapon`). Mode `SA`; ammo `x/10`.*
19. **Ammo states.** Steps: `pistol.update({'system.ammo': 2})`, then 0; `system.ready: false`; `system.jammed: true`. → *2/10: `b.low`; 0: `.sr2e-strip-weapon.out`; holstered: "holstered"; jammed: "jammed". Restore.*
20. **Click attacks.** Steps: click the strip's weapon link; then Shift-click it. → *Click: the attack dialog for that weapon. Shift-click (event with `shiftKey`): attacks straight away with remembered choices (a card, no dialog).*
21. **Initiative in combat.** Steps: GM: start a ZZ combat with both tokens; set ZZ Runner's initiative 20, ZZ Ganger 12; `startCombat()`. → *PL's strip shows "Init 20" (title "Initiative this pass"); after the pass moves on (see 26) it shows this pass's value (10).*
22. **NPC and spirit strips.** Steps: GM: ZZ Ganger and ZZ Spirit sheets. → *Both have the strip; spirit's mini monitor has no OF bar; no Karma pips unless they have a Karma Pool.*

## D. Your turn

23. **Pips and greying (warn).** Steps: enforce `warn`; ZZ Runner acting (combat from 21). PL: read the strip and the buttons. → *Strip has `sr2e-strip-myturn` and "Your turn" with 2 `i.sr2e-act-pip.on`, label "1 complex or 2 simple"; no button has `sr2e-cant` yet.*
24. **After one simple action.** Steps: PL: `await runner.useAction('perceive','test')`. → *Sheet re-renders: 1 pip on, "1 simple"; complex buttons (Cast, `FA` mode, melee/Unarmed Attack, First aid, skill rolls) get `sr2e-cant`, `aria-disabled="true"` and a title ending "needs a complex action: not enough left this phase"; simple ones (SA/BF attack, reload) stay normal. In `warn` they are still clickable (click Cast: dialog opens; the system warns on spend).*
25. **Block mode for players.** Steps: GM: `HR('block')` with PL's sheet open. → *PL's sheet re-renders by itself (house-rule change, the v14 fix); greyed `button`s are `disabled` for PL. GM's copy of ZZ Runner's sheet: greyed but not disabled.*
26. **Combat moves on.** Steps: GM: `game.combat.nextTurn()` (ZZ Ganger acts). → *Within ~200 ms both open sheets re-render without a click: ZZ Runner's "Your turn" and greying gone; GM's ZZ Ganger sheet now shows "Your turn" with 2 pips. Next `nextTurn()` into pass 2: ZZ Runner acting again, pips reset to 2.*
27. **Off.** Steps: `HR('off')`. → *No pips (strip shows "Your turn" with label "your action" and no pips, or nothing greyed); no `sr2e-cant` anywhere. Put `warn` back.*
28. **Not acting.** Steps: during ZZ Ganger's phase read ZZ Runner's sheet. → *No `sr2e-cant`, no "Your turn"; everything clickable.*

## E. Roll dialogs

29. **Layout of a dialog with a TN preview.** Steps: PL: Cast ZZ Bolt (`runSheetAction(runner,'castSpell',{itemId})`) in a wide window. → *Dialog has `sr2e-roll-dialog`, width about 680 px; `.sr2e-roll-grid` with `.sr2e-roll-main` (choices) and `.sr2e-roll-side` (the `.sr2e-preview` TN breakdown, big TN number); the `pool` and `drainPool` form groups have `sr2e-pool-field`; the OK button is `sr2e-roll-go` with a dice icon, full width, label "Cast". Cancel.*
30. **Narrow dialog.** Steps: re-open; `setPosition({width: 420})`. → *One column (side under main), no sideways scroll; preview still updates when Force changes.*
31. **Steppers in dialogs.** Steps: click Force `+` three times quickly, then `−` once; wheel up on the focused Pool field. → *Force +2 net, kept within min/max (stops at max, never below min); each step fires input (preview updates). Wheel changes only when the field has focus. Clicking a stepper doesn't submit the dialog.*
32. **Cast remembers.** Steps: set Force 3, Pool 2, Drain pool 1, tick focus if shown → Cast. Re-open Cast for ZZ Bolt. → *Fields come back 3 / 2 / 1 (pool clamped to its current max if fewer dice are left); `sr2e.rollMemory` has `cast|<uuid>|<id>`. A different spell starts from defaults.*
33. **Skill remembers.** Steps: roll Firearms skill (`rollSkill`, `{itemId}`), tick specialization, pick a complementary skill → roll. Re-open. → *Specialization ticked and the complementary skill selected again; the TN is not remembered (not a remembered field).*
34. **Summon remembers.** Steps: `runSheetAction(runner,'summonSpirit')`; pick kind, type/element, Force 3, pools, materials → Summon (or cancel after Summon if conditions stop it). Re-open. → *Choices back (only if it was submitted); note if a precondition blocks the dialog.*
35. **Memory off and cancel.** Steps: `S('rememberRolls', false)`; open Cast: defaults. Re-enable; open Cast, change Force, press Cancel / close; re-open. → *Off: no restore, no write. Cancel doesn't store (the last rolled values return).*
36. **Attack dialog.** Steps: GM targets ZZ Runner; ZZ Ganger attacks with ZZ SMG in BF → OK. Re-open. → *Two columns, preview live; BF comes back (per-weapon memory, `flags.sr2e.attackPrefs`, unchanged); `lastWeapon` set.*
37. **Other previews still work.** Steps: GM: open and cancel the dialogs for notice (`perceive`), a plain attribute roll, ZZ Van's Drive and Sensor (`runSheetAction(van,'driveVehicle')`, `'sensorTest'`; give it a driver or a target if it warns). → *Each with a preview becomes a roll dialog; each preview updates when its TN fields change; dialogs without a preview (e.g. a simple confirm) keep their normal layout. Note any that didn't open and why.*
38. **Shift-click quick roll.** Steps: PL: Shift-click a weapon Attack on the sheet and a skill/attribute with a quick path. → *Rolls straight to chat with defaults/remembered choices, no dialog; the card looks as in v0.67.*
39. **Cybercombat (optional).** Steps: only if ZZ Runner can be jacked in with an attack utility and a target: `matrixAttack`, pick program and pool → OK, re-open. → *Program and pool come back. Otherwise mark "not run".*

## F. Steppers and the scroll wheel on sheets

40. **Where they are.** Steps: GM: ZZ Runner, Edit mode. Count `.sr2e-stepper` on Main (attributes), skill row edits, Karma Pool, Combat Pool spent; ZZ Ganger's stat grid and "Grunts down"; ZZ Spirit's services. → *Each of these number fields is wrapped once; text fields and selects are not; buttons have `tabindex=-1` and no `name`.*
41. **Clicks in a row.** Steps: GM: on ZZ Ganger's Body (stat grid) click `+` three times, 100 ms apart; then three times with no gap. → *Ends at Body + 3 in the first case. Fast clicks: note the end value (each click submits; a re-render between clicks may drop one); never a value outside min/max, no error, exactly one stepper per field after the re-renders.*
42. **Wheel.** Steps: focus ZZ Spirit's Services; dispatch `new WheelEvent('wheel',{deltaY:-100,bubbles:true,cancelable:true})` twice, wait 600 ms. Then the same on an unfocused field. → *Focused: +2, one update after the wheel stops (450 ms), page doesn't scroll. Unfocused: no change.*
43. **Play mode hides them.** Steps: ZZ Runner → Play (`[data-action="sheetMode"]`). → *Attribute and row-edit fields are `readonly` and their steppers hidden (`display: none`); fields left editable in play (e.g. `.sr2e-play-ok` Grunts down, Combat Pool spent) keep theirs. Back to Edit: steppers back.*
44. **Steppers off.** Steps: `S('numberSteppers', false)`. → *Open sheets re-render with no `.sr2e-stepper`; dialogs have none; the wheel does nothing. Back on.*
45. **Player raising a locked rating.** Steps: PL (ZZ Runner past creation, if the world marks it so): `+` on an attribute. → *Refused as for typing (the v0.64 Spend Karma rule): value snaps back, no error. If ZZ Runner is still in creation, note that it changes.*

## G. Condition monitor

46. **± per track.** Steps: GM: ZZ Runner Physical 9; Physical `+` three times (waiting each); Stun `+` until it stops; Physical `−` at 0. → *Physical 10, 11, 12 (runs into Overflow), max 10 + Body (4) = 14; Stun stops at 10; `−` at 0 does nothing (no update). ZZ Spirit's Physical `+` stops at 10.*
47. **Keyboard.** Steps: focus Physical box 3 (`tabindex=0`, `role=button`), keydown Enter; then Space on box 3. → *Physical 3, then 2 (toggle back). Focus outline visible (`:focus-visible`, Tab with the real keyboard).*
48. **Hover preview.** Steps: Physical 3; `mouseenter` on box 6; then on box 3; `mouseleave`. → *Box 6: boxes 4–6 `sr2e-would-fill`, title "Physical: click to set 6 boxes"; box 3: box 3 `sr2e-would-clear`, title "… set 2 boxes"; leave: classes gone. Reset monitor to 0.*
49. **Player monitor.** Steps: PL: ± on ZZ Runner (owned). PL: ZZ Ganger if visible. → *Owned: works. Not owned: no `stepMonitor` controls usable / nothing changes, no error beyond Foundry's permission warning.*

## H. Empty lists, order, icons

50. **Empty-list hints.** Steps: read `.sr2e-empty` texts on ZZ Runner (Magic: geasa, foci, adept powers; Matrix: cyberdeck; Bio/Main: contacts, edges and flaws), ZZ Ganger (spells, other gear), ZZ Spirit (attacks, powers), ZZ Van (cargo "Nothing loaded…", aboard "Nobody aboard…", modifications). → *Each says how to add (the + icon, or the named button). Programs: delete the program, add a deck item: "No programs: press + to add some."*
51. **NPC and spirit order.** Steps: GM: list ZZ Ganger's `h2` texts in order (give it a spell and gear temporarily to see all); ZZ Spirit's. → *NPC: Skills, Weapons, Magic (if magical), Conjuring, Spells, Powers, Matrix, Rigging, Other gear; spirit: Skills, Attacks, Powers.*
52. **Section icons once.** Steps: count `.sr2e-sec-icon` per heading on each sheet; re-render 3 times. → *Same headings get the same icon on every sheet (Skills `fa-graduation-cap`, Weapons/Attacks `fa-gun`, Spells `fa-wand-sparkles`…); none doubled after re-renders; none inside the summary, header, combat column or rich text.*

## I. Permissions and GM-only marking

53. **GM-only edges (GM).** Steps: GM: elements with `title*="(GM)"` on ZZ Runner (Magic tab "Set for this scene (GM)" etc.). → *Each has `sr2e-gm-only`: links/buttons a striped amber underline, blocks a striped left edge (`--sr2e-street`).*
54. **Player sees none.** Steps: PL: on ZZ Runner, every tab: `B().querySelectorAll('.sr2e-gm-only, [title*="(GM)"]')`. → *Empty. Known candidates to report if they show for a player: the Matrix "Clear" link on a jammed link ("The jam clears (GM)…") and a vehicle's "Reset" ("Clear all damage (GM)") on an owned vehicle.*
55. **Chat GM tools.** Steps: make a soak card (attack → defend → resist, as in v0.67 #32). GM and PL read its `.sr2e-gm-tools`. → *GM: the "GM:" row (Undo, −1/+1 boxes) with the striped edge; PL: no `.sr2e-gm-tools`.*
56. **GM panel refused.** Steps: PL: `game.sr2e.api.gmPanel()`; look for `[data-sr2e-action="gmPanel"]` in the Actors sidebar. → *Warning "The GM panel is for GMs.", no window; no button. PL's tracker shows the banner but no GM-only data (pools only for owned combatants).*

## J. Grouped notifications

57. **Burst merged.** Steps: GM: `for (const n of ['zA','zB','zC','zD','zE']) game.sr2e.runSheetAction(runner, n);` → *One warning: "ZZ Runner has no zA action. · … zB … · … zC … · …and 2 more".*
58. **Repeat counted.** Steps: run `game.sr2e.runSheetAction(runner,'zX')` once, wait 1 s, run it again, again. → *One notification whose text becomes "… (×2)", then "(×3)" (no new toasts); after 4 s quiet a new one starts at 1.*
59. **Not ours / off.** Steps: console `ui.notifications.warn('ZZ core')` ×3 quickly; then `S('groupNotes', false)` and repeat 57. → *Console calls are not grouped (three toasts); with the setting off, five separate warnings. Back on.*

## K. Window memory

60. **Place kept.** Steps: PL: ZZ Runner `setPosition({left: 150, top: 80, width: 640, height: 700})`, dispatch `pointerup` on `E()`, wait 400 ms, close; re-open; F5 and re-open. → *Opens at 150/80, 640×700 each time; `sr2e.windows.ids[<app id>]` holds it.*
61. **Kind size and off-screen.** Steps: open a ZZ character sheet never opened before (create "ZZ Second" owned by PL). Edit `sr2e.windows` so ZZ Runner's left is 9000, re-open. → *ZZ Second opens at 640×700 (same sheet class); ZZ Runner is pulled back on screen. Delete ZZ Second.*
62. **Dialogs and off.** Steps: move a Cast dialog, close, re-open; `S('rememberWindows', false)` and re-open ZZ Runner. → *Dialogs are never remembered (no entry); with the setting off the sheet opens at Foundry's default. Back on.*

## L. House rules window

63. **Search.** Steps: GM: open the window; type `actions phase` in `.sr2e-hr-find`. → *Only matching rows ("Actions per phase") and their sections show; folded sections with hits open; `xyzzy` shows "No rule matches."; clearing shows all. Enter in the box doesn't submit.*
64. **Links and folding.** Steps: click a section link in the nav, then "Advanced"; click a legend twice. → *Scrolls to the section and unfolds it; legend click folds (`sr2e-folded`) and unfolds; the tools bar stays at the top.*
65. **Save re-renders sheets.** Steps: with ZZ Runner open in both tabs, change "Actions per phase" to `block` in the window → Save. → *Notice "SR2e house rules saved (1 changed)."; both sheets re-render (counters +1) without a click. Put it back (`HR('warn')`).*

## M. GM panel and the combat tracker

66. **Party cards.** Steps: GM: panel → Party. → *A `.sr2e-party-card` for ZZ Runner: portrait, name link, player "ZZ Testplayer", mini monitor, `− P n +` and `− S n +`, wound TN when hurt, initiative in combat (`sr2e-acting` while acting), pool chips (C, Sp, KP…), Good Karma and nuyen, state chips, quick buttons (sheet, pan token, re-roll init in combat).*
67. **Card ± and sync.** Steps: click P `+` twice, S `+` once on the card. → *ZZ Runner Physical +2, Stun +1; card, PL's sheet strip and monitor all agree after re-render. Reset.*
68. **Mook stat cards.** Steps: NPCs tab ("On this scene") and Combat tab. Toggle `.sr2e-mook-toggle`; reload the GM tab. → *ZZ Ganger's row has `sr2e-mook` and `.sr2e-mook-stats` (attributes, Arm b/i, Init, weapon "ZZ SMG 9M"); player-owned ZZ Runner has none. Toggle: plain rows, `sr2e.gmMookCards` = `'false'`, kept after reload; toggle back `'true'`.*
69. **Pass banner.** Steps: combat started, ZZ Runner acting; open the Combat sidebar. → *`.sr2e-pass-banner` over the list: "Combat Turn 1 · Pass 1", "Acting: ZZ Runner"; ZZ Runner's row `sr2e-acting`. `nextTurn()`: "Acting: ZZ Ganger", row highlight moves.*
70. **Delaying and full defense.** Steps: on ZZ Runner's turn PL runs `runner.delayAction()`; GM `ganger.declareFullDefense()`. → *Banner notes "Full defense: 1", "Delaying: 1"; ZZ Runner's row last under a `li.sr2e-tracker-group` "Delaying" with `sr2e-delayed`; ZZ Ganger's name has `.sr2e-badge-fd`.*
71. **Tracker re-renders.** Steps: `ui.combat.render(true)` five times; also update a combatant (`setInitiative`). → *Exactly one banner, one "Delaying" header, one badge, every combatant row once, in turn order with delayers last.*
72. **Tracker for PL.** Steps: PL: Combat sidebar. → *Same banner and grouping; pools only on ZZ Runner's row. End the combat afterwards: banner gone.*
73. **Narrow GM panel.** Steps: `gp.setPosition({width: 440})` on Party and NPCs. → *Cards one per row, `ow` true on the content; mook stat lines wrap.*

## N. Themes, text size, narrow sheets

74. **Three themes.** Steps: PL: `lookTheme` street / corp / contrast with ZZ Runner in Combat column during its turn (strip, pips, greyed button, steppers, compact head, a roll dialog, a GM card in the GM tab). → *Readable on all three: greyed buttons muted, act pips and "Your turn" in the accent, pool field highlight, steppers on the field colours; no white-on-white on Corp. [SHOT] Corp and High contrast.*
75. **Text 130 %.** Steps: PL: `textScale` 130; ZZ Runner in each layout at 760 and 440 px; a Cast dialog. → *Strip wraps onto lines (no overflow), column falls back sooner, compact heads readable, stepper buttons align with fields; `ow` true; clicking a pip and a monitor box hits the right one.*
76. **[SHOT] Layouts and 440 px.** Steps: PL: ZZ Runner at 440 px, Combat column layout, 130 %, Street. → *`ow` true on Main, Combat, Magic; screenshot for the user, plus ZZ Runner at 760 px in Tabs and in Combat column, and Compact at 440 px.*

## O. Regressions, console and clean-up

77. **Unchanged tools.** Steps: PL: folding a section heading (click an `h2`), sheet search on Tabs, the Add window (`a.sr2e-add` on Skills), the creation wizard and Spend Karma on ZZ Runner, a plain roll card and a Karma re-roll. → *All work as in v0.67; the Add window and wizard get steppers only where they're system dialogs with number fields (note any that look wrong).*
78. **Console.** → *No errors from interface.ts ("sr2e | layout picker", "compact", "icons", "your turn", "monitor", "steppers", "roll dialog", "window place", "settings sections", "tracker groups"), no missing partials (status-strip.hbs, combat-column.hbs) in either tab. Expected: Foundry permission warnings in 49, the test warnings of 57–59.*
79. **Clean-up (each tab).** Steps: `for (const [k, v] of Object.entries(__zzC)) await game.settings.set('sr2e', k, v); for (const [k, v] of Object.entries(__zzLS)) v == null ? localStorage.removeItem('sr2e.' + k) : localStorage.setItem('sr2e.' + k, v);` → *Settings and the keys `sr2e.rollMemory`, `sr2e.windows`, `sr2e.compactFolded`, `sr2e.gmMookCards`, `sr2e.sheetMode` as saved.*
80. **Clean-up (GM).** Steps: `await game.settings.set('sr2e','houseRules', __zzHR)`; delete the ZZ combat; `Actor.deleteDocuments(game.actors.filter(a => a.name.startsWith('ZZ ')).map(a => a.id))`; delete ZZ Scene and the ZZ chat cards. → *No ZZ documents left; house rules as saved; PL's view unchanged.*

## Not testable live / risky

- Control Pool in the strip needs a jumped-in rigger (not set up here); the Hacking Pool needs a deck in use; cybercombat memory (39) needs a jacked-in persona with a loaded attack utility.
- Fast stepper clicks (41) race the submit-and-re-render; a lost click is a known risk, not a crash.
- The scroll wheel and hover preview are driven by synthetic events; a real mouse can differ (passive listeners, trackpads).
- Window memory and the 760 px viewport rule for roll dialogs depend on the browser size of the test pane.
- Grouped notifications only catch calls made straight from system code (stack check); notices from other paths or modules are left as they are by design, and a minified build would break the check.
- Players seeing "(GM)"-titled controls (54) is a template question, not a CSS one.
