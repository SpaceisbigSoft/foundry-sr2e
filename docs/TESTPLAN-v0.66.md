# v0.66.0 live-test plan: GM Setup tab, starter kits, catalogue tools, character import, Item Piles, Health Estimate, help and tours

Two tabs: **GM** (GM AI) and **PL** (ZZ Testplayer). Drive the UI with JavaScript in the page and read the DOM; prefer `element.querySelector(...)` checks over screenshots. After a click or a field change, wait about 500 ms before reading (the GM panel re-renders after each setting write). Every test document is named "ZZ …".

Each check: **steps** → *expected*. Write down anything that differs, plus the console errors seen during the check.

## How to drive it

- GM panel: `const gp = game.sr2e.api.gmPanel(); const G = () => gp.element;`. Tabs `[data-action="gmTab"][data-tab="setup"]` (also `scene`, `party`, `npcs`, `requests`, `combat`, `world`). Setup sections: `section.sr2e-checklist`, `.sr2e-assign`, `.sr2e-token-setup`, `.sr2e-kits`, `.sr2e-catalogue`, then "Characters from a stat block" and "Modules".
- Setup actions (`data-action`): `checkNew`, `checkAdd` (`data-part="start"|"end"`), `checkRemove` (`data-id`), `assignSave`, `tokenParty`, `tokenPick`, `kitNew`, `kitEmpty`, `kitGive` / `kitEdit` / `kitDelete` (`data-id`), `catPaste`, `catCsv`, `catList`, `catExport`, `catImport`, `charImportNew`, `startTour` (`data-tour`), `openHelp`. Checklist ticks are `input[data-check="<line id>"]` (fire `change`); a line's button is `a[data-check-act="<action>"]`. Player picks: `select[data-assign="<user id>"]`. Token options: `[data-token-opt="link|bars|vision|show|disposition|placed|relink"]`. Kit rows: `li[data-kit-drop="<kit id>"]`.
- Dialogs (DialogV2): the newest `.application.dialog`. Prompts confirm with `button[data-action="ok"]`; confirms with `yes` / `no`; the paste dialog has `save` ("Make the templates") / `cancel`; the import dialogs `ok` ("Import") / `cancel`. Fields by `name`: kit dialogs `name`, `actor`, `item`, `notes`, `amt-<i>`, `del-<i>`; the actor picker `who` (`list` | `selected` | `party`) and `pick` (value = actor uuid); paste `rows`, `type`; import `text`, `record`; catalogue file `file`, `mode` (`replace` | `skip` | `copy`); manage templates `del`. Live previews read `.sr2e-cat-preview` (set the textarea value, then dispatch `input`).
- Dropping an item on a kit row: `const dt = new DataTransfer(); dt.setData('text/plain', JSON.stringify({type:'Item', uuid: item.uuid})); row.dispatchEvent(new DragEvent('drop', {dataTransfer: dt, bubbles: true, cancelable: true}));`.
- Add window: `game.sr2e.api` has no opener; use the sheet's `a.sr2e-add` or `foundry.applications.instances` to find `.sr2e-add`. Kits tab `[data-action="addTab"][data-type="kit"]`, rows `tr[data-key="kit:<id>"]`, `.sr2e-add-tick`, `.sr2e-add-payment` (`free` / `buy`), `.sr2e-add-total`, `[data-action="addSelected"]`.
- API (v0.66.0): `kits()`, `giveKit(idOrName, actors, {ready})`, `setUpTokens(actors, {placed, relink})`, `importCharacter(actor, text)`, `pasteCatalogueRows(text?, type?)`, `openHelp(topic?)`, `startTour(id)`.
- Downloads: catch them instead of saving: `const save0 = foundry.utils.saveDataToFile; foundry.utils.saveDataToFile = (t, ty, n) => { window.__zzFile = {t, ty, n}; };` (put it back afterwards).

## Setup (GM)

```js
const PL = game.users.getName('ZZ Testplayer');
const own = { default: 0, [PL.id]: 3 };
const S = (k) => foundry.utils.deepClone(game.settings.get('sr2e', k));
window.__zz = { kits: S('starterKits'), check: S('sessionChecklist'), tok: S('tokenSetup'), tpl: S('itemTemplates'), queue: game.settings.get('sr2e','approvalQueue'), char: PL.character?.id ?? null };
// Copy __zz into the run notes too (a reload loses window.*).
```
- **ZZ Runner**: character, `ownership: {default: 0}` (nobody owns it yet), ¥20,000, cyberware ZZ Cybereyes (`installed: true`, `lowLight: true`, `essenceCost: 0.2`).
- **ZZ Fresh**: character, `ownership: own`, empty (for creation shopping). **ZZ Unrec**: character, `ownership: own`, no record and no draft (Bio import). **ZZ Other**: character, `ownership: {default: 0, [PL.id]: 2}`.
- **ZZ Ganger**: NPC with skill Firearms 4, spell ZZ Bolt, weapon ZZ Pistol (cost 450, 9M), armor ZZ Jacket (cost 900, 5/3), installed cyberware ZZ Spur (cost 1000, standard grade), gear ZZ Rope (cost 50).
- **ZZ Van**: vehicle. **ZZ Site**: site (only if the world allows placing one).
- World items, `ownership: {default: 2}`: ZZ Medkit (gear, cost 200), ZZ Coat (armor, cost 700, 4/2), ZZ Stunbolt (spell, `learnedForce: 2`).
- A scene "ZZ Scene" (activate and view it). Confirm `game.settings.get('sr2e','moduleSupport') === true` and the approval queue is off. Keep both consoles open.

## A. The Setup tab and the session checklist (GM)

1. **Renders.** Steps: open the GM panel, click the Setup tab. → *`.sr2e-gm-tabs [data-tab="setup"]` is active; all sections render in order; "Session N checklist" with Start (6 default lines) and End (5) and their "x/y" counts; the Modules list shows Item Piles and Health Estimate as "active" (or "installed, not active": note which, as G and H depend on it), Dice So Nice and Token Action HUD Core with their state.*
2. **Tick.** Steps: tick `input[data-check="s-requests"]` (change). → *`sessionChecklist.start` has that line `done: true`; the line gets `.sr2e-done`; Start reads "1/6". Untick: back to 0/6. Tick it in the GM tab and reload the panel: the tick stays.*
3. **Tab buttons.** Steps: click "Requests" (`a[data-check-act="tab:requests"]`), then from Setup "Scene tab" and "Party tab". → *Each switches the panel to that tab; no error.*
4. **Refresh and award.** Steps: click "Refresh" on `s-karma` and on `s-pools`, then "Award…" on `e-award`. → *Each does what the panel's own Refresh Karma Pools / Refresh pools / Award buttons do (same confirms and notifications); the award dialog opens (cancel it).*
5. **Token setup and end combat.** Steps: "Set up…" on `s-tokens` with no party yet; then make a ZZ combat with ZZ Ganger's token and click "End it" on `e-combat`; then click it again with no combat. → *First: "No player characters (assign characters to players first)." The combat ends (after Foundry's own confirm); the second click says "No combat running."*
6. **Add and remove a line.** Steps: `checkAdd` on End → text "ZZ collect the dice", Button "Party tab (tab:party)" → ok; then `checkRemove` on it. Also add one with an empty text. → *The line appears last on End with a "Party tab" chip that works; End reads "0/6". Remove takes only that line. The empty one adds nothing.*
7. **New session.** Steps: tick two lines, click `checkNew` → No, then again → Yes. → *No: nothing changes. Yes: every tick cleared, the heading reads "Session N+1 checklist" and "Started <date>" shows.*

## B. Players, characters and tokens

8. **Assign.** Steps: Setup → `select[data-assign="<PL id>"]` = ZZ Runner → `assignSave`. → *Notification "ZZ Testplayer plays ZZ Runner"; `PL.character.id === ZZ Runner.id`; `ZZ Runner.ownership[PL.id] === 3`; "Characters nobody owns" no longer lists ZZ Runner. Saving again: "Nothing to change." PL tab: ZZ Runner shows in the Actors sidebar and its sheet opens editable.*
9. **Party tokens.** Steps: `tokenParty` with the defaults. → *"Set up the tokens of 1 actor." ZZ Runner's `prototypeToken`: `actorLink` true, `bar1.attribute` `derived.bars.physical`, `bar2.attribute` `derived.bars.stun`, `displayBars` and `displayName` = `CONST.TOKEN_DISPLAY_MODES.OWNER_HOVER`, `disposition` 1 (friendly), `sight.enabled` true and `sight.visionMode === 'lightAmplification'` (its low-light cybereyes). `game.settings.get('sr2e','tokenSetup')` holds the options used.*
10. **Pick actors.** Steps: set Disposition "Players friendly, NPCs hostile", show "Always, to everyone"; `tokenPick` → who "The ones ticked below", tick ZZ Ganger and ZZ Van → Set up. → *ZZ Ganger: disposition −1, Physical/Stun bars, display mode ALWAYS. ZZ Van: `bar1.attribute` `derived.bars.condition`, `bar2.attribute` null, disposition 0. Cancelling the picker: "Nobody picked." and nothing changes.*
11. **Placed tokens and relink.** Steps: GM: set ZZ Ganger's prototype `actorLink: false`, place two of its tokens; untick Linked, run Pick on ZZ Ganger; tick Linked with "Relink unlinked ones" off and run again; then with Relink on. → *Message counts "… and 2 placed tokens". With relink off the placed tokens get the bars/disposition but stay unlinked; with relink on they become `actorLink: true`. Unticking "Also tokens already on scenes" leaves placed tokens alone.*
12. **Vision follows the eyes.** Steps: place ZZ Runner's token; uninstall the ZZ Cybereyes on the sheet. → *The placed and prototype token go back to `visionMode` `basic`; re-install: `lightAmplification` again.*

## C. Starter kits (GM)

13. **From a sheet.** Steps: `kitNew` → name "ZZ Street kit", take the items of ZZ Ganger → Next. → *The second dialog lists the six items; Firearms (skill) is unticked, the rest ticked. Untick ZZ Bolt too (this kit must be buyable in D20). Make the kit: "Kit "ZZ Street kit" made: …"; the row shows "4 lines · ¥2,400" (450 + 900 + 1,000 + 50, if the street index and grade leave the costs as they are); `kits()` lines have no `installed`/`worn`/`bonded` fields.*
14. **Empty kit and drops.** Steps: `kitEmpty` → "ZZ Drop kit"; drop ZZ Medkit on its row twice, then ZZ Coat, then ZZ Stunbolt. → *"ZZ Medkit goes in the kit "ZZ Drop kit"." each time; one Medkit line with ×2 (quantity grows), ZZ Coat, ZZ Stunbolt; the summary and price update (the spell is unpriced: "1 unpriced").*
15. **Edit.** Steps: `kitEdit` on ZZ Drop kit: rename "ZZ Drop kit 2", note "ZZ for tests", Medkit number 3, tick Out on ZZ Coat → Save. → *Name, note and amount saved; ZZ Coat gone. Number 0 or blank saves as 1.*
16. **Give to several.** Steps: `kitGive` on ZZ Street kit → tick ZZ Runner, ZZ Ganger, ZZ Van → Give → Ready? Yes. → *ZZ Runner and ZZ Ganger get every line, cyberware `installed: true`, armor `worn: true`; ZZ Van gets only ZZ Pistol and ZZ Rope and the info "Left out (that actor can't hold it): ZZ Van: ZZ Jacket (armor); ZZ Van: ZZ Spur (cyberware)". "Gave "ZZ Street kit" to 3 actors."; a GM-whispered card names the kit and the actors.*
17. **Not ready.** Steps: give it again to ZZ Ganger with Ready? No. → *The new ZZ Spur has `installed: false` and the new jacket `worn: false`. Giving an empty kit: "The kit is empty: drop items on it first." `game.sr2e.api.giveKit('ZZ Street kit', [ZZ Ganger])` gives it ready and returns 1.*
18. **Delete.** Steps: `kitDelete` → No, then on a scratch kit → Yes. → *No keeps it; Yes removes the row; items already given stay.*

## D. The Add window's Kits tab (PL)

19. **Free in creation.** Steps: PL: open the wizard on ZZ Fresh and close it (so it has a draft); open its Add window (any +) → Kits tab. → *The Kits tab is there (only kits ZZ Fresh can hold); the creation note shows; the payment offers Free and Buy, no Karma. Tick ZZ Street kit, Free, Add: all its lines arrive (ready, if "ready to use" is ticked); the kit unticks.*
20. **Buy on a finished character.** Steps: PL: ZZ Runner's Creation tab → "Record as it stands". Add window → Kits → Buy → tick ZZ Street kit. → *`.sr2e-add-total` reads "1 ticked · ¥N" with N equal to the GM panel's kit price; Add takes N off `system.nuyen` and adds the items (lines with an Availability time go on order under Upkeep → Under way instead: note which); one advancement line "Bought …".*
21. **A kit with a spell can't be bought.** Steps: tick ZZ Drop kit 2 with Buy → Add. → *Warnings "ZZ Stunbolt: a spell can't be bought here." (and "has no price"); nothing added, no nuyen taken. With Free it goes through.*
22. **Approval queue.** Steps: GM: `game.settings.set('sr2e','approvalQueue', true)`. PL: Buy ZZ Street kit on ZZ Runner. GM: Requests tab → Approve. → *PL: "Sent to the GM for approval: Buy ZZ Pistol, ZZ Jacket, …"; nothing changes until approved. After Approve the items arrive, the nuyen goes once, PL gets "The GM approved …". Turn the queue off.*

## E. The item catalogue (GM)

23. **Paste TSV with the preview.** Steps: `catPaste`; textarea `rows` = `Name\tType\tDamage\tArmor\tCost\nZZ Blade\tweapon\t6M\t\t300\nZZ Vest\tarmor\t\t3/1\t200\nZZ Torch\tgear\t\t\t20` (real tabs), dispatch `input`. → *`.sr2e-cat-preview` reads "3 templates: ZZ Blade (Weapon), ZZ Vest (Armor), ZZ Torch (Gear)" with a chip per column ("Damage → …", "Cost → cost"). Make the templates: "Catalogue: 3 new, 0 replaced." and the Setup hint's count goes up by 3.*
24. **CSV with bad rows and a replace.** Steps: paste `Type,Name,Cost,Damage\nweapon,ZZ Knife,lots,\nweapon,ZZ Bad,10,9Q\nwidget,ZZ Thing,5,\nweapon,,5,\nweapon,ZZ Blade,350,7M`. → *The preview lists the row errors ("Row 2: Cost: "lots" is not a number", "Row 3: Damage: "9Q"…", "Row 4: "widget" is not an item type.", "Row 5: No name.") and "Row 6: "ZZ Blade" replaces the existing weapon template." Save: up to 5 row warnings, "Catalogue: 0 new, 1 replaced, 4 rows left out."; ZZ Blade now costs 350, 7M, and keeps its id.*
25. **Export CSV.** Steps: catch the download (see above), click `catCsv`. → *`__zzFile.n` = `sr2e-templates-<world>.csv`, type `text/csv`; the text has a header and a row for each world template incl. ZZ Blade, 350.*
26. **Catalogue file round trip.** Steps: click `catExport` (catch it), keep `__zzFile.t`. Then paste ZZ Torch with Cost 99. Load it back through `catImport` (set the file input from `new File([text], 'zz.json')` via a DataTransfer) with mode "Keep mine", then "Replace it", then "Keep both". → *The file is `sr2e-catalogue-<world>.json` with `templates` and `kits`. Keep mine: "Loaded 0 templates and 0 kits.", ZZ Torch stays 99. Replace: ZZ Torch back to 20 (same id), kits replaced by name. Keep both: "ZZ Torch (2)" etc. appear, kits are not doubled. A broken file ("{oops"): warning "Catalogue file: Not valid JSON…".*
27. **Manage templates.** Steps: `catList` → tick the "(2)" copies → Delete the ticked. → *"Deleted N templates."; the copies are gone from `itemTemplates`.*
28. **In the Add window.** Steps: PL: ZZ Runner's Add window → Weapons. → *ZZ Blade is listed first with source "World template", ¥350; adding it free makes a ZZ Blade with 7M.*

## F. Character import

29. **New character from a stat block (GM).** Steps: `charImportNew`; paste the write-up below and dispatch `input`. → *The preview lists "ZZ Imported Mage (Human), Combat mage", the attributes, "Essence 5.6, Reaction 4 (6), Initiative 2D6", "Tradition: hermetic", skills, items, "2 contacts", "Nuyen 4,250¥", "Karma: 7 good, 19 total, pool 2", "Lifestyle Middle (2 months paid)"; any guesses in `.sr2e-warn`.*
```
Name: ZZ Imported Mage
Metatype: Human
Archetype: Combat mage
Body 3   Quickness 4   Strength 2
Charisma 4   Intelligence 5   Willpower 5
Essence 5.6   Magic 5
Reaction 4 (6)   Initiative 6 + 2D6
Tradition: Hermetic
Skills: Sorcery 6 (Combat spells 8), Conjuring 4, Firearms 3 (Pistols 5), Etiquette (Corporate) 2
Knowledge skills: Magical Theory 5, Seattle Gangs 2
Languages: English 4 (native), Japanese 2
Cyberware: Datajack, Cybereyes (low-light)
Spells: Manabolt 5, Heal 3, Armor 4
Gear:
  Ares Predator II [9M, SA, 15 (c)]
  Armor jacket 5/3
  Medkit (Rating 3)
  2x Stim patch
Contacts: ZZ Fixer (Level 2), ZZ Talismonger — Talismonger, level 1
Nuyen: 4,250¥
Karma: 7 (total 19)
Karma Pool 2
Lifestyle: Middle (2 months)
Notes: ZZ test character.
```
30. **Import with record.** Steps: tick "Record it as the character's creation" → Import. → *An actor "ZZ Imported Mage" (type character) opens; "Imported into ZZ Imported Mage: …". Main/Current: Essence 5.6, Reaction 6, initiative 6 + 2D6, Magic 5, ¥4,250, Good Karma 7, career 19, Karma Pool 2; Upkeep: Middle lifestyle, `system.lifestyle.paidUntil` ≈ worldTime + 2 × 30 days; skills with specializations, the three spells with Force, both cyberware installed, the Predator 9M, jacket 5/3, two contacts with level 2 and 1. `flags.sr2e.creation.how === 'asIs'`; the Bio tab has no Import button now.*
31. **Re-import updates.** Steps: GM: `await game.sr2e.api.importCharacter(actor, text.replace('Sorcery 6','Sorcery 5').replace('4,250','5,000'))`. → *Item count and contact count are unchanged (no duplicates); Sorcery is 5, ¥5,000; Notes gain a second copy after an `<hr>` (expected). Essence, Reaction and initiative still read 5.6, 6 and 2D6.*
32. **Bio button as the player.** Steps: PL: ZZ Unrec → Bio tab → `[data-action="importCharacter"]`. → *The dialog has no "Record" tick (GM only). Paste the write-up with the name changed to "ZZ Unrec" → Import: the sheet fills as in 30, no creation record. A double `click()` on the Bio button: note whether two dialogs open.*

## G. Item Piles (skip with a note if the module is not active)

33. **Integration.** Steps: GM: `game.modules.get('item-piles')?.active`; `game.itempiles.API.CURRENCIES`; `game.itempiles.API.ITEM_FILTERS`. → *Active; one currency "Nuyen", `data.path` `system.nuyen`, abbreviation `¥{#}`, primary; filters list skill,spell,power,adeptpower, installed and bonded. `ACTOR_CLASS_TYPE` is `npc`, quantity `system.quantity`, price `system.cost`.*
34. **Drop makes a pile.** Steps: GM: drag ZZ Medkit from the Items sidebar onto the canvas (or `game.itempiles.API.createItemPile({position: {x: 500, y: 500}, items: [game.items.getName('ZZ Medkit').toObject()]})`); set the pile actor's `system.nuyen` to 300; give PL Observer or Limited on it if Item Piles asks. → *A pile token "ZZ…"/Item Pile appears; its actor has `flags['item-piles'].data.enabled`; the pile window shows ZZ Medkit with price ¥200 and Nuyen ¥300.*
35. **Pick up as the player.** Steps: PL: select ZZ Runner's token, double-click the pile → take the Medkit and the nuyen. → *ZZ Runner gets ZZ Medkit (gear quantity 1) and +¥300; the pile empties (and goes, per the pile's settings). No sr2e errors.*
36. **Not loot.** Steps: GM: turn ZZ Ganger's token into a pile (`game.itempiles.API.turnTokensIntoItemPiles([token])`). → *The pile shows the weapon, the jacket, the rope and any uninstalled ZZ Spur, but not Firearms, ZZ Bolt or the installed ZZ Spur.*
37. **Not an NPC.** Steps: GM panel → NPCs tab ("On this scene") and the Combat tab's lists. → *Neither pile is listed; ZZ Ganger's normal tokens (if left) are.*

## H. Health Estimate (skip with a note if not active)

38. **People.** Steps: GM: ZZ Ganger `system.monitor.physical = 4`; hover its token. → *A description appears above it (e.g. "Wounded"); `game.healthEstimate.provider.fraction(token)` is 0.6; set Stun 7: 0.3. No "HP is undefined" or other Health Estimate errors in either console, PL hovering too.*
39. **Vehicle and site.** Steps: ZZ Van token, `system.condition = 5`; hover. Hover ZZ Site's token. → *Van: 0.5 with a description; the site shows none and no error.*

## I. Help "?" and the guide

40. **"?" on sheets and the panel.** Steps: open ZZ Runner (character), ZZ Ganger (NPC), ZZ Van (vehicle) and the GM panel Setup tab; count `a.sr2e-help[data-sr2e-help]`. → *Headings such as Attributes, Skills, Cyberware, Contacts (character), Powers, weaknesses and notes (NPC), Control, Sensors (vehicle), Session/Players and characters/Token setup/Starter kits/Item catalogue/Modules (GM panel) each have one "?", once (re-render does not add a second).*
41. **Opens the right topic, no fold.** Steps: click the "?" after Skills on the character sheet; after Starter kits on the panel. → *The "SR2e player guide" window opens (`#sr2e-help`) at "Skills" and then "Setup tab: players, tokens, kits and the catalogue"; the sheet section does not fold (its content stays visible).*
42. **Search and links.** Steps: type "nuyen" in `.sr2e-help-search` (input); clear it; click a `.sr2e-help-body a[href^="#"]` link in "Getting started". → *Non-matching topics get `hidden`; clearing shows all; the link opens its topic in the same window (no browser navigation).*
43. **Players don't see GM topics.** Steps: PL: `game.sr2e.api.openHelp()`, then `openHelp('gm-setup')`. → *No "For the GM" group; the second call opens on Getting started, not the GM topic. PL's sheets show no "?" pointing at a GM topic.*

## J. Tours

44. **Listed.** Steps: GM: Settings → Tours (Tour Management). PL: the same. → *GM sees three: "SR2e: your character sheet", "SR2e: adding things", "SR2e: the GM panel". PL sees the first two.*
45. **Each step on target.** Steps: PL: `game.sr2e.api.startTour('character-sheet')`; then step with `game.tours.get('sr2e.character-sheet').next()`; same for `add-window`; GM: `gm-panel` (also from the Setup tab's `startTour` button). At each step read `t.currentStep.selector` and `document.querySelector(that)`. → *8, 3 and 8 steps. Every selector starts with the window's `#id` and finds the element named (header, summary, tabs, `a.sr2e-add`, `.sr2e-checklist`, `.sr2e-assign`, `.sr2e-kits`, `.sr2e-catalogue`…), never plain `body`; the sheet switches to Main/Current/Upkeep and the panel to Setup as needed. The GM can run the sheet tour too (on the first owned character).*
46. **No character.** Steps: GM: clear PL's character and take away their Owner on every character (check `game.actors.filter(a => a.type==='character' && a.isOwner)` is empty in PL). PL: start the sheet tour. → *"This tour shows your character sheet: you need a character first." and no tour. `startTour('gm-panel')` as PL: "That tour is for the GM." Restore the assignment afterwards.*

## K. Permissions and double clicks

47. **Player paths.** Steps (PL): `game.sr2e.api.gmPanel()`; `game.sr2e.api.pasteCatalogueRows('Name,Type\nZZ X,gear')`; `await game.sr2e.api.importCharacter(game.actors.getName('ZZ Other'), text)`; `game.settings.set('sr2e','starterKits', [])`. → *"The GM panel is for GMs." and no window; "Only the GM can change the catalogue." and no template; the import rejects "Only the owner can import into this character." and ZZ Other is unchanged; the setting write fails on permissions. Also try `game.sr2e.api.giveKit('ZZ Street kit', [ZZ Runner])` and `importCharacter` on recorded ZZ Runner: write down what happens (if it adds items or raises ratings free past the rating lock or the queue, log it as a question for the developer).*
48. **Double-click Give.** Steps: dispatch two `click()`s on `kitGive`. → *Expected: one picker. If two open and both give, log it (no busy guard).*
49. **Double-click Make the templates / Import.** Steps: two `click()`s on the paste dialog's `save`; on `charImportNew`'s `ok`; on `charImportNew` itself. → *One save ("Catalogue: …" once); one new actor; note whether two import dialogs open from the button.*

## L. Console, layout, clean-up

50. **Console.** → *No errors from setup.ts, catalogue.ts, modules.ts, help.ts, tours.ts or adding.ts in either tab (`read_console_messages` pattern `sr2e|Error`); notification warnings are expected.*
51. **Narrow panel.** Steps: `gp.setPosition({width: 440})` on the Setup tab (and the light theme). → *`G().querySelector('.window-content').scrollWidth <= clientWidth + 1`; the checklist parts stack; the token options and catalogue buttons wrap; text is readable.*
52. **Clean-up (GM).** Steps: `foundry.utils.saveDataToFile = save0`; delete the item piles (`canvas.scene.tokens` with the item-piles flag, and their actors); `Actor.deleteDocuments(game.actors.filter(a => a.name.startsWith('ZZ ')).map(a => a.id))`; the same for ZZ world items and ZZ Scene; `for (const k of ['starterKits','sessionChecklist','tokenSetup','itemTemplates']) await game.settings.set('sr2e', k, __zz[{starterKits:'kits',sessionChecklist:'check',tokenSetup:'tok',itemTemplates:'tpl'}[k]])`; `game.settings.set('sr2e','approvalQueue', __zz.queue)`; `PL.update({character: __zz.char})`; end any ZZ combat; restore the colour scheme. → *No ZZ actors, items, piles, kits or templates remain; the four settings equal the saved copies; `PL.character?.id ?? null === __zz.char`; `pendingRequests()` is empty.*
