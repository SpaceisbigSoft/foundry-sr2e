# v0.75.0 live-test plan: the flag-write sweep (flags cleared on unlinked tokens stay cleared)

Two tabs: **GM** (GM AI) and **PL** (ZZ Testplayer). Drive the UI with JavaScript in the page and read the DOM and documents; take the screenshots marked **[SHOT]**. After a click, an update or a new chat card, wait about 500 ms before reading. Every test document is named "ZZ …". A browser reload (F5) is enough after deploying: there are no new document types and no schema changes in v0.75.0. After F5, log in again through /join, player tab first, then the GM tab.

Each check: **steps** → *expected*. Write down anything that differs, plus the console errors seen during the check. "Record" means: the code's behaviour is not obviously right; write down what happens.

**What changed.** On an unlinked token's actor (a synthetic actor: its changes live in the token's ActorDelta), Foundry v14's `unsetFlag` (a `-=` key) is deleted on the server, but every open client keeps the old value until it reloads, and a delta can't remove a key the base actor has. `setFlag` also merges objects, so keys left out stay. `src/module/helpers/flags.ts` adds `clearFlag`, `clearFlagUpdate`, `dropFlagKeys`, `dropFlagKeysUpdate`, `replaceFlag`, `replaceFlagUpdate` and `deltaSafeUpdate`: on a synthetic actor a cleared flag or dropped map key is written as `null`; on a linked actor it is deleted for real. Converted: `delayed`, `actingNow`, `aim`, `centered`, `moraleGroup` (on token documents), `antidote`, `repeatPower` (now also written whole), `onFire`, `heldBy`, `heldStatus`, `pendingInitiation`, `focusAddict`, `possessing`, `possessedBy`, `quest`, `dyingAt`, `projects.<id>` (Give up, Finish now, time step), `requests.<id>` (a repeat filed, decline, cancel, approve), `build` (written whole) and the undo log's inverse update. Unit tests: `src/module/__tests__/v075.test.ts`.

**The rule for every check below ("read on both").** (1) On the tab that did the action, read the flag **at once, without reloading**. This is where the old bug showed: the cleared value stayed on that client. (2) Read it on the other tab. (3) Check the visible effect (a button gone, a status off, a list row gone, a card that does not come). On a token actor the expected value is `null` from `F()` and `null` from `D()` (an explicit null in the delta, never the old value). Write the values from both tabs into the run notes. They are compared again after the reload (section R).

**Priority.** Checks marked **[core]** are the must-run set (38 of the 41). Checks marked **[extra]** are nice-to-have: run them after the core set, in the same order.

## How to drive it

- **Readers (both tabs).** `const SID = '<ZZ Scene id>';` `const TOK = (tid) => game.scenes.get(SID).tokens.get(tid);` `const TA = (tid) => TOK(tid)?.actor;` (the synthetic actor) `const F = (doc, k) => doc?.getFlag('sr2e', k) ?? null;` `const D = (tid, k) => { const s = TOK(tid)?.delta?._source?.flags?.sr2e ?? {}; return k in s ? s[k] : 'absent'; };` (the raw delta: `null` after a clear. If it still shows the old value, the delete did not stick. The old value showing there after a reload is a fail.) For linked actors: `const has = (a, k) => k in (a.flags.sr2e ?? {});`.
- **Tokens (GM).** The world is paused, so tokens are created, never moved: `const mk = async (a, dx, dy, link = false) => { const td = await a.getTokenDocument({ x: __zzO.x + dx, y: __zzO.y + dy, actorLink: link }); const [t] = await game.scenes.get(SID).createEmbeddedDocuments('Token', [td.toObject()]); return t.id; };`. Write every token id into the run notes and set the same `T1`…`T8` constants on the PL tab.
- **Sheets.** `TA(tid).sheet.render(true)` opens a token actor's sheet. Sheet buttons: `game.sr2e.runSheetAction(actor, action, dataset)`, or click `[data-action="…"]` in the open sheet. Newest dialog: `const dlg = () => [...document.querySelectorAll('.application.dialog')].at(-1);`. A confirm's Yes is `dlg().querySelector('button[data-action="yes"]')`.
- **Cards.** `const last = (f = () => true) => game.messages.contents.filter(f).at(-1);`. A button on a card: `document.querySelector(`#chat-log [data-message-id="${m.id}"] [data-sr2e-action="…"]`)`.
- **Dice:** `window.__zzRU ??= CONFIG.Dice.randomUniform;` then `CONFIG.Dice.randomUniform = () => 0.2` gives all 5s, `() => 0.99` all 1s. Never use a value below 0.17. Dice are rolled in the tab that runs the call, so rig the tab that acts. Restore with `CONFIG.Dice.randomUniform = __zzRU`.
- **Static helpers:** `const SR = CONFIG.Actor.documentClass;` (`SR.setHeld`, `SR.setMoraleGroup`, `SR.setPossession`).
- **Combat (GM).** `const c = await Combat.create({ scene: SID, active: true }); await c.createEmbeddedDocuments('Combatant', [T1, T6, T5].map((tokenId) => ({ tokenId, sceneId: SID })));` then set the initiatives to T1 30, T6 20, T5 10 (`c.setInitiative(id, n)`), then `await c.startCombat()`. To make T1 current again: `c.update({ turn: c.turns.findIndex((t) => t.tokenId === T1) })`. Next Combat Turn: `c.nextRound()`.
- **Active GM.** The project time step, the repeating-power tick and the burning tick run on the active GM's client. Check `game.users.activeGM?.name` at the start. If it is the user's own Gamemaster account and not GM AI, those hooks run there. That client runs the same code, so the results should look the same. Write down who was active.
- **World time:** `window.__zzT = game.time.worldTime` once, and put it back at clean-up. The largest step in this plan is 2 hours.
- **Undo (GM):** `game.sr2e.undoLog.steps()[0]` is the newest step; `game.sr2e.undo()` undoes it. Wait 2 s before and after the change to undo, because changes within 1.5 s are merged into one step.

## Setup

GM saves: `window.__zzQ = game.settings.get('sr2e','approvalQueue'); window.__zzT = game.time.worldTime; window.__zzActors = new Set(game.actors.map(a => a.id)); window.__zzLogEmpty = game.sr2e.undoLog.steps().length === 0; const PL = game.users.getName('ZZ Testplayer');`. Both tabs: `window.__zzRU = CONFIG.Dice.randomUniform;`. Check `game.sr2e.api.version === '0.75.0'` on both tabs.

GM creates (`const own = { default: 0, [PL.id]: 3 }; const lim = { default: 1 };`):

**Player-owned (`ownership: own`):**
- **ZZ Merc**: character. Body 4, Quickness 5, Strength 6, Charisma 3, Intelligence 4, Willpower 4. Skill Firearms 5. Weapon **ZZ Pistol** (Firearms, 9M, SA, ammo 12/12). Gear **ZZ Antidote** (`patch: { kind: 'antidote', rating: 4 }`, quantity 3). Nuyen 5,000, Good Karma 30. Record its creation (`runSheetAction(merc, 'recordAsIs')`, Yes), so it isn't in creation and the approval queue applies to it.
- **ZZ Mage**: character, full magician (Magic 6), Willpower 6, Charisma 5, `initiateGrade: 1`, `metamagic: { centering: true, possessing: true }`, `centeringSkill: 'ZZ Chant'`, skills **ZZ Chant 4** (Charisma) and Sorcery 5. Good Karma 60. Record its creation.
- **ZZ Heir**: character, defaults, nuyen 1,000. Before it gets a token, the GM sets flags **on the sidebar actor**: `heir.setFlag('sr2e','focusAddict', true)`; `heir.setFlag('sr2e','build', { race: 'E', magic: 'D', attributes: 'A', skills: 'B', resources: 'C' })`; `heir.startProject({ kind: 'gear', area: 'gear', label: 'ZZ Base Job', hours: 10, paid: { nuyen: 200 }, effect: { actor: [] } })`. Note the project id as `__zzBaseP`.
- **ZZ Runner**: character (the **linked** character), defaults, nuyen 2,000, Good Karma 30. Record its creation.

**GM-owned:**
- **ZZ Ganger** (`lim`): NPC, Strength 2, Body 3, Willpower 3.
- **ZZ Critter**: NPC critter. Two powers, both `active: true`, **`repeating: true`**, `dice: 'rating'`, `rating: 4`, `tnSource: 'fixed'`, `targetNumber: 4`, `resist: 'none'`, `effect: 'effect'`, no special: **ZZ Gaze** and **ZZ Howl**.
- **ZZ Grunt** (`lim`): NPC, `professionalRating: 2`.

**ZZ Scene** (activate it; PL views it). GM saves a clear corner as `window.__zzO = {x, y}`. Tokens, all **unlinked** except TL: **T1** = ZZ Merc (+300, +300); **T2** = ZZ Merc (+500, +300); **T3** = ZZ Mage (+700, +300); **T4** = ZZ Heir (+900, +300); **T5** = ZZ Ganger (+300, +700); **T6** = ZZ Critter (+500, +700); **T7**, **T8** = ZZ Grunt (+700, +700), (+900, +700); **TL** = ZZ Runner, `mk(runner, 1100, 300, true)` (linked). Check `TA(T1).isToken === true` and `TOK(TL).actorLink === true`. Check that `TA(T1).uuid !== TA(T2).uuid` (two separate synthetic actors from one base).

Both tabs: check that `F(TA(T4), 'focusAddict') === true` and `TA(T4).projects().map(p => p.id)` includes `__zzBaseP` (inherited from the base). Keep both consoles open (`read_console_messages`, pattern `sr2e|Error|error`).

## A. Delay, Act now, Done (`delayed`, `actingNow`)

GM: start the combat described above (T1, T6, T5). T1 is current.

1. **[core] Delay, then Act now (PL).** Steps: PL: open T1's sheet; click its **Delay** (`[data-action="delayAction"]`). If the turn doesn't pass ("Only the GM can move the turn on"), GM: `c.nextTurn()`. PL: read `F(TA(T1),'delayed')` and `TA(T1).isDelaying()`. PL: click **Act now** (`actNow`) on the sheet. Read on both. → *After Delay: `delayed` is `{combatId, round, pass}`. After Act now, on PL straight away and on GM: `F(TA(T1),'delayed') === null`, `D(T1,'delayed') === null`, `isDelaying()` false, `actingNow()` true. The sheet strip and the tracker button (`.sr2e-delay` on T1's row) now read **Done**, not "Act now". One card: "ZZ Merc takes the delayed action now, before ZZ Critter."*
2. **[core] Act now twice.** Steps: PL: GM puts T1 back in delay (`c.update({turn: idx(T1)})`, PL Delay again, turn passes). PL: call `TA(T1).actNow()` twice without waiting, then a third time 1 s later. → *The first returns true; the others return false with the warning "ZZ Merc has no delayed action this pass." Only one "takes the delayed action now" card. `actingNow` keeps the first call's value. This is the case the old bug broke: a stale `delayed` let the second call through.*
3. **[core] Done (PL, tracker button).** Steps: PL: click the **Done** button on T1's row in the combat tracker. Read on both. → *On PL at once and on GM: `F(TA(T1),'actingNow') === null`, `D(T1,'actingNow') === null`, `actingNow()` false. T1's tracker button is gone, or it reads Delay only on T1's own turn. The sheet strip has no Done.*

## B. Aim (`aim`)

4. **[core] Any other action loses the aim (PL).** Steps: GM makes T1 current. PL: `await TA(T1).takeAim(TA(T1).items.getName('ZZ Pistol').id, TA(T5).uuid)`; read `F(TA(T1),'aim')`. PL: `await TA(T1).useAction('reload', 'reloading')` (the call every non-attack action spends through). Read on both. **[extra]** Repeat it, but end with an attack on T5 instead of the reload (the attack clears the aim after it fires). → *Before: `aim` holds `{targetUuid, weaponId, actions: 1, …}` and the card says "takes aim at ZZ Ganger … −1 TN". After: `F === null`, `D === null` on both. `TA(T1).aimModifier?.(…)` (or the next attack card's modifiers) has no "Aim" line.*

## C. Centering (`centered`)

5. **[core] A magical test uses the centering (PL).** Steps: PL dice 0.2: open T3's sheet and click **Center** (`centeringTest`). Read `F(TA(T3),'centered')`. Without moving the world time (the window is 30 s), PL: `await TA(T3).rollAttribute('willpower', { magical: true })`. Read on both. Then roll a second magical test the same way. → *After Center: `{successes ≥ 1, at, testId}` and the card says "Centered: up to 1 off…". After the first magical test: `F === null`, `D === null` on both, and `TA(T3).centeredSuccesses() === 0`. The second test's card has no "Centering" modifier.*
6. **[extra] A failed centering re-roll clears it.** Steps: PL dice 0.2: Center. PL dice 0.99: Center again (a fresh test with 0 successes). → *`centered` is `null` on both after the second test.*

## D. Morale groups (`moraleGroup`, on token documents)

7. **[core] Group, then Ungroup (GM panel).** Steps: GM: `game.sr2e.gmPanel()`; select T7 and T8 on the canvas; click the morale **Group** button (`moraleGroup`). Read `TOK(T7).getFlag('sr2e','moraleGroup')` on both. GM: click the **×** of that group (`[data-action="moraleUngroup"][data-id=…]`). Read on both. → *Grouped: both tokens carry the same id and the panel lists one group of 2. After Ungroup: `'moraleGroup' in (TOK(T7).flags.sr2e ?? {})` is **false** on both tabs (token documents are not synthetic, so the key is deleted, not nulled), the same for T8, and the panel's group row is gone.*

## E. Antidote (`antidote`)

8. **[core] Used by the next toxin, only once (PL).** Steps: PL: on T2's sheet click **apply** on ZZ Antidote (`runSheetAction(TA(T2), 'applyPatch', { itemId })`, no target). Read `F(TA(T2),'antidote')`. PL: `await TA(T2).resistToxin({ name: 'ZZ Gas', vector: 'inhalation', power: 6, level: 'M', damageType: 'stun' })`. Read on both. Do the same toxin again. → *Patch: `{dice, until, name: 'ZZ Antidote'}` and the card "+N dice against the next toxin within … h". First toxin card: label "…, ZZ Antidote +N". Then `F === null` and `D === null` on both. Second toxin card: **no** ZZ Antidote dice.*

## F. Repeating powers (`repeatPower`, written whole)

The combat from section A is still running (T6 is in it).

9. **[core] A second power replaces the first's modifiers and exclude (GM).** Steps: GM: `await TA(T6).usePower(TA(T6).items.getName('ZZ Gaze'), { targetUuids: [TA(T5).uuid], modifiers: [{ label: 'ZZ cover', value: 2 }], exclude: ['zzExcluded'] })`. Read `F(TA(T6),'repeatPower')`. GM: add a leftover key, `TA(T6).update({ 'flags.sr2e.repeatPower.zzStale': 1 })`. GM: use **ZZ Howl** the same way but with no modifiers and no exclude. Read on both. → *First: `name: 'ZZ Gaze'`, `modifiers: [{label:'ZZ cover', value:2}]`, `exclude: ['zzExcluded']`, `combatId = c.id`. After Howl, on GM at once and on PL: `name: 'ZZ Howl'`, its `powerUuid`, `modifiers: []`, `exclude: []`, `targetUuids` = [T5's actor], and `zzStale` reads `null`/missing. Nothing from Gaze is left.*
10. **[core] The next Combat Turn offers the second power as it was used (GM).** Steps: GM: `c.nextRound()`. Read the newest card and click **Use again** (`[data-sr2e-action="repeatPower"]`). → *One card "ZZ Critter's **ZZ Howl** repeats this Combat Turn." (whispered to the GM). Its `getFlag('sr2e','repeat')` has `modifiers: []` and `exclude: []`. The test from Use again has no "ZZ cover" modifier. `repeatPower.round` is now the new round.*
11. **[core] Cleared when the user goes down (GM).** Steps: GM: `TA(T6).update({ 'system.monitor.stun': 10 })` (unconscious); `c.nextRound()`. Read on both. Then `c.nextRound()` again. → *After the first new round: `F(TA(T6),'repeatPower') === null`, `D === null` on both. No "repeats" card in either round.*

## G. On fire (`onFire`)

12. **[core] Put out from the sheet (PL).** Steps: GM: `TA(T1).setOnFire(true)`. PL: read the flag; T1's sheet strip shows **Put out fire**. PL: click it (`putOutFire`). Read on both. GM: `c.nextRound()`. → *Set: `{combatId, round}`. After the click, on PL at once and on GM: `F === null`, `D === null`. The button is gone from the strip on both tabs' open sheets. Card "ZZ Merc puts out the flames." The new round gives **no** fire damage card for ZZ Merc.*
13. **[core] The chat card's button, twice.** Steps: GM: post the card the way an incendiary hit does (`TA(T1).setOnFire(true)` and then a `ChatMessage.create` with `flags.sr2e.putOutFire.actorUuid = TA(T1).uuid` and a `<button data-sr2e-action="putOutFire">`, or the real card from an incendiary attack). PL: click **Put out the flames** on it; 1 s later click it again (forced click if it is disabled). → *First click: put out, as in 12. Second click: "ZZ Merc isn't burning." and no second "puts out the flames" card. `onFire` stays `null` on both.*

## H. Holds (`heldBy`, `heldStatus`)

14. **[core] Break free (PL).** Steps: GM: `await SR.setHeld(TA(T1), TA(T5).uuid, true)`. Read `heldBy`, `heldStatus` and `TA(T1).statuses.has('restrain')` on both. PL dice 0.2: click **Break free** on T1's sheet (`breakFree`). Read on both. → *Held: `heldBy` is T5's actor uuid, `heldStatus === true`, restrain is on. After: "Strength 6 vs 0. **Free!**". `heldBy` and `heldStatus` are `null` (the same in `D`) on PL at once and on GM. Restrain is off on the token. The Break free button is gone. `TA(T1).movementHold() === ''`.*
15. **[core] Already restrained, let go when the holder goes down (GM).** Steps: GM: `TA(T1).toggleStatusEffect('restrain', { active: true })`; `SR.setHeld(TA(T1), TA(T5).uuid, true)`; read `heldStatus` (expect `false`). GM: `TA(T5).update({ 'system.monitor.physical': 10 })`. Read on both, then heal T5 (`physical: 0`). → *Card "ZZ Merc is free: ZZ Ganger can no longer hold on." Both flags are `null` on both tabs (`heldStatus` was `false`, and it is cleared too). Restrain **stays** on (the hold didn't put it there). Take it off by hand.*

## I. A deed waiting on initiation (`pendingInitiation`)

16. **[core] The player gives up the deed (PL).** Steps: PL: `await TA(T3).advanceInitiation(null, { ordeal: 'deed' })`. If an initiation-site or Karma warning stops it, record it and set the flag instead: `TA(T3).setFlag('sr2e','pendingInitiation', { technique: null, ordeal: 'deed', groupId: null, attribute: null, geas: null, grade: 2 })`. Read on both; the Magic tab shows "deed for grade 2 pending". PL: click its **×** (`cancelDeed`). Read on both. → *Cleared: `F === null`, `D === null` on PL at once and on GM. The "pending" badge is gone on both tabs' open sheets. Good Karma is unchanged (nothing was paid).*
17. **[core] The GM confirms the deed (GM).** Steps: PL: file the deed again (as in 16, the real call, so the whispered card is posted). GM: click **The deed is done (GM)** on that card; read on both; click it again (forced click). → *The initiation goes through (or its ordeal starts as a project "Initiation to grade 2 …"). `pendingInitiation` is `null` on GM at once and on PL. The second click warns "Already confirmed." or "has no initiation waiting on this deed", and nothing is charged twice.*

## J. Focus addiction (`focusAddict`)

18. **[core] Cleared by the GM (GM).** Steps: GM: `TA(T3).setFlag('sr2e','focusAddict', true)`; PL opens T3's sheet (badge "addicted"). GM: click the **×** next to it (`clearFocusAddiction`, GM only). Read on both. PL: `TA(T3).rollAttribute('willpower', { magical: true })`. → *`F === null`, `D === null` on GM at once and on PL. The badge is gone on PL's open sheet without a reload. The PL test has no focus-withdrawal TN modifier (+`RULES.MAGIC_V39.addiction.withdrawalTn`).*

## K. Possession (`possessing`, `possessedBy`)

The possessed body is T5 (GM-owned). The possessor is T3 (player-owned). `possess()` needs a projecting magician, so set up the same state the method leaves (GM): `TA(T3).setFlag('sr2e','possessing', { uuid: TA(T5).uuid, name: 'ZZ Ganger' }); TA(T5).setFlag('sr2e','possessedBy', { uuid: TA(T3).uuid, name: 'ZZ Mage', attributes: { charisma: 5, intelligence: 4, willpower: 6 }, skills: [] });`.

19. **[core] The possessor leaves (PL), the GM applies it.** Steps: PL: click **Leave the body** on T3's sheet (`endPossession`). Read `possessing` on PL at once and on GM. GM: click **Apply (GM)** on the whispered "Possession · ZZ Ganger is free" card. Read `possessedBy` on T5 on GM at once and on PL. → *`possessing` is `null` on T3 at once (the "possessing ZZ Ganger" row is gone). The PL can't change T5, so the card appears. After Apply: `possessedBy` is `null` on T5 on both tabs (the same in `D`), and T5's sheet "Possessed by" line with its Free button is gone.*
20. **[core] The body is freed (GM).** Steps: set both flags again (as above). GM: open T5's sheet, click **Free** (`endPossession`). Read both actors on both tabs. → *T5's `possessedBy` and T3's `possessing` are both `null` (the GM owns both, so no card). Card "ZZ Ganger is free of ZZ Mage." Both sheets' rows are gone on both tabs.*

## L. Astral quests (`quest`)

21. **[core] End the quest (PL).** Steps: PL: `TA(T2).startQuest({ name: 'ZZ Quest', stages: 2, targetNumber: 4 })`; the Magic tab shows the quest. PL: click its **×** (`endQuest`). Read on both. → *`TA(T2).quest() === null`, `F === null`, `D === null` on PL at once and on GM. The quest row is gone from both open sheets.*

## M. Dying (`dyingAt`)

22. **[core] No longer dying (GM).** Steps: GM: `TA(T2).update({ 'system.monitor.physical': 10 })`. Read `dyingAt`, `system.care.dyingSince` and `TA(T2).statuses.has('bleeding')`. GM: `TA(T2).update({ 'system.monitor.physical': 5 })`. Read on both. GM: `game.time.advance(600)`. → *Dying: `dyingAt = {t, boxes: 0}` and bleeding is on. After the heal, on GM at once and on PL: `F(TA(T2),'dyingAt') === null`, `D === null`, `dyingSince === -1`, bleeding and unconscious are off. The time step posts no "loses a box" card for ZZ Merc.*

## N. Projects (`projects.<id>`)

PL makes the projects on T2 (`const mkP = (label, hours, nuyen) => TA(T2).startProject({ kind: 'gear', area: 'gear', label, hours, paid: { nuyen }, effect: { actor: [] } });`). Note T2's nuyen before each check.

23. **[core] Give up (PL, Upkeep tab).** Steps: PL: `mkP('ZZ Job A', 10, 100)`. Open the Upkeep tab ("Under way"). Click the row's **Give up** (`[data-action="projectCancel"][data-project-id=…]`), then Yes. Read `TA(T2).projects()` and `F(TA(T2),'projects')?.[id]` on both. → *`projects()` doesn't list it, and the raw map entry is `null`, on PL at once and on GM. The row is gone on both open sheets and from the GM panel's project list. Nuyen +100 once ("Given up (refund): ZZ Job A"), and one "gives up" card.*
24. **[core] Give up twice.** Steps: PL: `mkP('ZZ Job B', 10, 100)`. PL: `await Promise.all([TA(T2).cancelProject(id), TA(T2).cancelProject(id)])`. Wait 3 s (longer than the 2 s guard) and call `TA(T2).cancelProject(id)` again. Then GM calls it too. → *The first call returns true, every other call false. Nuyen is +100 exactly once and there is one "gives up" card. Under the old bug the stale entry came back after the 2 s guard and refunded again.*
25. **[core] GM Finish now.** Steps: PL: `mkP('ZZ Job C', 10, 0)`. GM: in the GM panel's project list click **Finish now** (`projectFinishGm`), or on T2's sheet `projectFinish`. Read on both. Wait 3 s, then GM `TA(T2).finishProject(id)` again. → *One card "ZZ Merc: ZZ Job C is done (the GM finished it early)." The project is gone from `projects()` on both tabs and from both lists. The second call returns false with no second card.*
26. **[core] Done on a time step (active GM).** Steps: PL: `mkP('ZZ Job D', 1, 0)`. GM: `game.time.advance(3600)`. Read on both. Wait 3 s; GM `game.time.advance(60)`. → *One "ZZ Job D is done." card, and the project is gone on both tabs. The second step posts no second "done" card.*

## O. Approval queue (`requests.<id>`)

GM: `game.settings.set('sr2e','approvalQueue', true)`. Read `const reqs = (a) => Object.entries(F(a,'requests') ?? {}).filter(([, r]) => r).map(([id]) => id);`.

27. **[core] A repeated request replaces the first (PL).** Steps: PL: `TA(T2).improve({ attribute: 'body' })`; note the request id R1. PL: the same call again; note R2. Read on both and in `game.sr2e.api.pendingRequests()` (GM). → *Each call says "Sent to the GM for approval: Raise Body 4 → 5." Afterwards `reqs(TA(T2))` is `[R2]` on both tabs, and `F(TA(T2),'requests')[R1]` is `null`. The GM panel shows **one** row for ZZ Merc.*
28. **[core] The GM declines (GM).** Steps: GM: in the GM panel click **Decline** on that row (`declineRequest`), reason "ZZ test", OK. Read on both. → *`reqs` is `[]` on GM at once and on PL. The panel row is gone, the PL sheet's pending-request row is gone, and PL gets the whisper "The GM declined … : ZZ test". Body is unchanged.*
29. **[core] Cancelled by the player; approved by the GM.** Steps: PL: file it again, then click its **×** on T2's sheet (`[data-action="cancelRequest"][data-id=…]`). Read on both. PL: file it once more; GM: **Approve** it in the panel. Read on both. → *Cancelled: `reqs` is `[]` on both and no GM row. Approved: `reqs` is `[]` on both, Body is 5 (raised once), Good Karma is charged once, and the "The GM approved …" whisper appears.*

GM: put `approvalQueue` back to `__zzQ` after section O.

## P. The builder's priorities (`build`, written whole)

30. **[core] Quick build twice with different priorities (PL).** Steps: PL: `runSheetAction(TA(T2), 'buildCheck')`; set all five selects (race E, magic D, attributes A, skills B, resources C); click **Save priorities** (`button[data-action="save"]`). Read `F(TA(T2),'build')`. Open it again; set race **C** and magic **E**, set the other three to "–"; Save. Read on both and open the dialog again. → *First: the five keys. Second, on PL at once and on GM: `race: 'C'`, `magic: 'E'`, and `attributes`, `skills` and `resources` are `null`. The reopened dialog shows "–" for those three. (Old behaviour: A, B and C stayed.)*
31. **[extra] "Fill the sheet" writes the build whole too.** Steps: PL: the same dialog on T2, all five set, then **Fill the sheet**. Then a second Fill with only race and magic set. → *After the second fill, `build` has only race and magic. The other three are `null` on both tabs.*

## Q. Flags inherited from the base actor (T4 / ZZ Heir)

32. **[core] Focus addiction set on the base, cleared on the token (GM).** Steps: GM: open T4's sheet (badge "addicted", inherited). Click **×** (`clearFocusAddiction`). Read on both, for the token and for the sidebar actor. → *Token: `F(TA(T4),'focusAddict') === null`, `D(T4,'focusAddict') === null`, and the badge is gone on both tabs. Base: `game.actors.getName('ZZ Heir').getFlag('sr2e','focusAddict') === true`, and its own sheet still shows "addicted".*
33. **[core] A project the base carries, given up on the token (PL).** Steps: PL: T4's Upkeep tab, **Give up** on "ZZ Base Job", Yes. Read on both. → *`TA(T4).projects()` is `[]` on both, and the raw entry `__zzBaseP` is `null` on the token. The **base** still lists ZZ Base Job (`heir.projects().length === 1`). The ¥200 refund goes to T4's nuyen (1,200); the base stays 1,000.*
34. **[core] An inherited `build` replaced through the token (PL).** Steps: PL: Quick build on T4 (`buildCheck`); the dialog opens with the base's five letters. Set only race **A**, the rest "–"; Save. Read on both, for the token and for the base. → *Token: `race: 'A'` and the other four are `null` on both tabs. Base: still `{race:'E', magic:'D', attributes:'A', skills:'B', resources:'C'}`.*

## R. Undo (`deltaSafeUpdate`)

35. **[core] Undo a flag that was added (GM).** Steps: GM: wait 2 s; `TA(T2).setOnFire(true)`; wait 2 s. Read `F(TA(T2),'onFire')` on both, and `game.sr2e.undoLog.steps()[0]` (one update of ZZ Merc's token). GM: `await game.sr2e.undo()`. Read on GM at once and on PL. → *Before: set on both. After the undo: `F === null` and `D(T2,'onFire') === null` on both tabs without a reload. The "Put out fire" button is gone from T2's sheet strip, and no "something changed since" prompt appears.*
36. **[core] Undo a map key that was added (GM).** Steps: GM: wait 2 s; `TA(T2).startProject({ kind: 'gear', area: 'gear', label: 'ZZ Job U', hours: 10, effect: { actor: [] } })`; wait 2 s; `game.sr2e.undo()`. Read on both. → *The step held the update (and the start card, which the undo deletes). Afterwards `TA(T2).projects()` doesn't list ZZ Job U on either tab, its raw entry is `null`, and the Upkeep row is gone.*

## S. The linked character (ZZ Runner, token TL): nothing null is left

`const R = game.actors.getName('ZZ Runner');` on both tabs. Each check reads `has(R, key)`, which must be **false** (the key deleted, not written as null).

37. **[core] Delay, Act now, Done.** Steps: GM: add TL to the combat and make it current. PL: Delay; GM moves the turn on if needed; PL: Act now; Done. Read on both after each step. → *After Act now: `has(R,'delayed') === false`. After Done: `has(R,'actingNow') === false`. This holds on both tabs.*
38. **[core] Quest and project.** Steps: PL: `R.startQuest({ name: 'ZZ Q', stages: 1, targetNumber: 4 })`, then `endQuest` on its sheet. PL: `R.startProject({ kind: 'gear', area: 'gear', label: 'ZZ Job L', hours: 10, paid: { nuyen: 50 }, effect: { actor: [] } })`; Give up from the sheet. → *`has(R,'quest') === false`. `id in (R.flags.sr2e.projects ?? {})` is false and there's no `null` value in the map (`Object.values(R.flags.sr2e.projects ?? {}).includes(null) === false`). This holds on both tabs.*
39. **[core] Focus addiction and Quick build twice.** Steps: GM: `R.setFlag('sr2e','focusAddict', true)`, then clear it from the sheet. PL: Quick build on R with all five, Save; again with only race B, Save. → *`has(R,'focusAddict') === false`. `R.getFlag('sr2e','build')` is exactly `{ race: 'B' }`: `Object.keys(...)` is `['race']` with no null values. This holds on both tabs.*
40. **[extra] Undo on the linked actor.** Steps: GM: wait 2 s; `R.setOnFire(true)`; wait 2 s; `game.sr2e.undo()`. → *`has(R,'onFire') === false` on both tabs.*

## T. Reload

41. **[core] What was seen live is what is saved.** Steps: GM: end the combat (`c.delete()`). F5 the **PL** tab and log in again. Re-read every flag from the run notes for T1–T8 and ZZ Runner: `delayed`, `actingNow`, `aim`, `centered`, `antidote`, `repeatPower` (null since 11), `onFire`, `heldBy`, `heldStatus`, `pendingInitiation`, `focusAddict` (token null; ZZ Heir base true), `possessing`, `possessedBy`, `quest`, `dyingAt`, `projects()`, `requests`, `build` (T2: race C, magic E; T4: race A only; base ZZ Heir: all five), the morale-group flags on T7/T8. Open T2's, T3's and T4's sheets. Then F5 the **GM** tab and re-read the same list. → *Every value matches what both tabs read live, and nothing cleared comes back after the reload. `D()` shows `null` for each cleared key. No sheet render errors and no `DataModelValidationError` in either console. (In the old build, the server copy was right and the live copy was wrong, so a mismatch in either direction is a fail.)*

## Not covered

`possess()` itself (needs astral projection; its flags are set by hand in section K), focus addiction gained through `focusAddictionTest`, a second GM sweeping at the same time, old list-shaped `requests` flags, and items or effects inside a token actor (`isSynthetic` covers them; no converted flag lives there).

## Clean-up

1. Both tabs: `CONFIG.Dice.randomUniform = __zzRU`. GM: delete any combat left (`game.combats.contents.forEach(c => c.delete())`). Check the world is still paused (`game.togglePause(true, {broadcast: true})` if not).
2. GM: delete the test tokens from ZZ Scene (or ZZ Scene itself if the run created it).
3. GM: delete every ZZ actor and every actor not in `__zzActors`: `for (const a of game.actors.filter(a => !__zzActors.has(a.id))) await a.delete();`. Delete the ZZ chat messages if wanted.
4. GM: `await game.settings.set('sr2e','approvalQueue', __zzQ); await game.time.advance(__zzT - game.time.worldTime);`. Run `game.sr2e.undoLog.clear()` only if `__zzLogEmpty` was true.
5. F5 both tabs. Check that no ZZ documents are left, `game.time.worldTime === __zzT`, and both consoles are free of `sr2e` errors.

## Run results (23 Oct 2026, GM AI and ZZ Testplayer; GM AI was the active GM)

Run on the Safehouse scene (no ZZ Scene) with 8 unlinked tokens and one linked (ZZ Runner). All 38 core checks and extra check 40 passed; extras 6 and 31 were not run. Every cleared flag read `null` (or absent) at once on the acting tab and on the other tab, and again after a reload of each tab.

- Found and fixed: **check 2**: two Act now calls fired together both got through (two "acts now" cards; a race before either write landed, older than v0.75.0). Fixed with an in-flight guard (`#actNowBusy`); rerun live: `[true, false]`, one card.
- **Check 22**: the cleared `dyingAt` was gone from the token's delta (`absent`), not `null` (Foundry dropped the null key in that update). Reads as not set either way.
- **Check 10**: the repeat card's `repeat` flag carries `zzStale: null` from the planted key (the `...repeat` copy); harmless, usePower ignores it.
- **Check 29**: the approved Body raise is a training entry (training time, v0.65.0), so Body stays 4 until it's done; Karma charged once.
- Seen but not caused by v0.75.0: status cards ("is free", "is dying", "is unconscious") came **twice**, both authored by GM AI ~20 ms apart: a second client logged in as GM AI was open somewhere (the handoff's v0.61.0 note). Cards from player clients came once.
- Console: only the known "ActiveEffect … does not exist!" status race (harmless, since v0.60.0).
- Clean-up done: 9 tokens, 7 actors, combats deleted; approval queue off; world paused; time unchanged (3 s); background count 0.
