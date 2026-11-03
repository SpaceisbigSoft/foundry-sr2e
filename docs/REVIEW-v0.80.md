# Review: v0.79.0 → v0.80.0 (Rules source: SR2E Book Rules / SR2E Unified Rules Revamp)

Reviewer: independent. Scope: every changed hunk in existing files, all new `config80*` / `urr80-*` files, the settings layer, glue in documents/applications/models.
Baseline checks on a copy (`scratchpad/review080`): `npm test` 2685 pass / 4 skipped / 0 fail; `npx tsc --noEmit` clean.
Experiments: `scratchpad/review080/src/module/__rv/x1–x3.test.ts` (patch applies with no problems; book → URR → book restores `RULES` byte-identical to `RULE_DEFAULTS`; no curated row overlaps a patched parent/child path; every patched select/number/boolean row value is valid; house-rules save round trip, see #1).

Summary: **2 bugs, 9 risks, 8 nits**. Book mode: every changed hunk was traced with the switches at their shipped values. Apart from the cases below (all degenerate inputs, wording, or the transient after a source switch in #2), behaviour, chat output, document writes and dialog content are unchanged. No new flags or fields are written in book mode.

---

## Bugs

### 1. bug — Saving the house-rules window drops overrides that equal the *current* source's value. They are lost when the source is switched back
`src/module/settings.ts:1244` (`#onSubmit`: `if (c.ok && c.value !== baseRule(d.path)) values[d.path] = c.value;`), together with `:1164` (the form shows `cur = values[path] ?? baseRule(path)`).

The form rebuilds `values` from scratch and keeps only rows that differ from `baseRule(path)` under the source active **at save time**. A stored value that equals that source's base is dropped silently, even if the GM never touched that row.

Confirmed by simulation (`__rv/x3.test.ts`):
- Book: GM stores `STUN_OVERFLOW_PER_PHYSICAL_BOX = 1` and `URR_V80.coreCriticals = true` (allowed, the rows exist in book mode). They switch to the Revamp and save any unrelated row. Stored `values` becomes `{}`. Back in Book: `STUN_OVERFLOW = 2`, `coreCriticals = false`. The house rules are gone.
- Revamp: GM opts out with `URR_V80.cbtDefense = 'dodge'` (stored). They switch to Book and save anything. The opt-out is dropped. Back in the Revamp, `cbtDefense = 'cleanMiss'`.

Fix: keep a previously stored value unless the GM changed that row in this form. For example, render a hidden `data-stored` marker per row and, on submit, keep `stored.values[path]` when the input still shows it. Alternatively store per-source house rules. At the least, drop a value only when it equals **both** sources' base. Add a round-trip test: book → urr save → book, and urr → book save → urr.

### 2. bug — Switching the rules source doesn't re-prepare actors: derived data stays on the old ruleset (in both directions) until each actor is next updated or the world reloads
`src/module/settings.ts:1289–1294` (`rulesSource` onChange: `applyHouseRules` then `render()` on open windows).

`render()` doesn't call `prepareData`, so everything computed in `models/index.ts` `prepareDerivedData` keeps the previous source's rules. Examples:
- `combatPool` / `combatPoolLeft` with `cbtArmorPool` (`models/index.ts:752,786,791`)
- armor encumbrance on Quickness
- `astralMode` for aspected magicians (`:822`)
- `astral.reaction` ×2 (`astralForm`)
- `attributeMaximums` with `coreMetaMax`
- Magic capped by Essence with `coreEssenceFloor`
- `monitorStatus` with `hsDeathPastOverflow`
- the vehicle working Speed (`veh80DamagedSpeed`, `:2021`)

Rolls read these derived values. Concrete case: the GM switches Revamp → Book mid-session, and a troll in heavy armor keeps the Revamp's reduced Combat Pool and unreduced Quickness for every test until something updates the actor. That is Book-mode behaviour differing from v0.79.0. The same holds for unlinked token actors.

Note: the `houseRules` onChange has the same pre-existing pattern, but a source switch flips 139 rules at once.

Fix: in the onChange, before rendering, re-prepare every world actor and every scene's synthetic token actor (`actor.reset?.()` or `prepareData()`), then render. Also re-render the GM panel (see nit 6).

---

## Risks

### 3. risk — Vehicle damage resistance spends the jumped-in rigger's Control Pool with no ownership check
`src/module/applications/chat.ts:563–569`, `src/module/documents/index.ts:14193–14198`.

`onResist` checks only `target.isOwner` (the vehicle). It then prompts the rigger's pool, and `resistVehicleDamage` calls `cpRigger.#spendPool('control', cp)`, which runs `update()` on the rigger. Scenario: a player owns the vehicle but not the rigger (another player's character is jumped in). The resistance roll is made, then `update` on the unowned rigger is rejected and throws before `#post`, so the soak card never appears and the roll is lost.

The v0.79 evasive-driving path (chat.ts:70) refuses with "Only X's owner or the GM can spend their Control Pool". Do the same here: use `cpRigger` only when `cpRigger.isOwner`, else no pool. Alternatively spend through `requestGm`. Not confirmed live.

### 4. risk — A melee hit can become a "clean miss" at the resistance test
`rules/urr80-combat.ts:62–68` (`cbtSoakLevel` always checks `cbtCleanMiss`), fed by `documents/index.ts:2589,2598` (`cbtMeleeDamage` puts `cleanMiss80` on melee hits).

Scenario: the attacker wins opposed melee with 3 successes (a "Hit!" card). The defender clicks Resist, adds 4 Combat Pool dice, and gets 4 pool successes. The card says "Clean miss" and no damage is taken. The config80-combat header describes the clean miss only for ranged attacks. For melee it says the winner's damage is "staged the same way at the resistance test", so this looks unintended, or is at least undocumented.

Fix: carry `melee: true` (or a `noCleanMiss` flag) in `CleanMiss80` for opposed-melee hits and skip the clean-miss check there. Or document it and add a test.

### 5. risk — Exclusive/fetish Force bonus also raises the casting dice under `magCastDice 'force'` (two magic rules stacking)
`documents/index.ts:7900` and `:9046` (`force = drainForce + urrMagSpellForceBonus(...)`), `:8144` and `:9060` (`urrMagCastingDice({ dice, force })`).

Under the Revamp an exclusive Force 4 spell rolls 6 dice (Force 4 + 2) instead of 4. The switch says the spell "takes effect at + this Force", which plausibly covers its effect, the resistance TN and Power, not the dice of the success test. The boosted Force also goes into the sustaining-focus check (`availableSustainingFocus(..., { force })`), the signature, the sustained record and the ritual resist TN.

Decide which uses get the boosted Force. Most likely the dice should come from `drainForce`.

### 6. risk — Revamp armor-to-Combat-Pool penalty uses the raw sum of worn ballistic, not the layered rating
`models/index.ts:752`.

With the patch, `armorLayering 'highestPlusHalf'` and `cbtArmorLayers` are on: an armor jacket 5 plus a lined coat 4 protect as 5 + 2 = 7. `cbtArmorPoolPenalty` is still fed 9, so Quickness 5 loses 4 pool dice, not 2. The book encumbrance also sums (pre-existing), but the Revamp claims "ballistic armor above Quickness".

Fix: pass the layered ballistic rating (the same value `armorRating('ballistic')` uses), or document that the raw sum is intended.

### 7. risk — The weapon detector's "highest die" ignores the Rule of Six
`documents/index.ts:6391` (`dsHighestDie(await foundryRoller(rolls)(o.dice))`).

`foundryRoller(...)(n)` returns raw d6 faces (no re-roll of 6s; compare `rollOpenEnded`). So any weapon with concealment TN 7 or more can never be found, whatever the detector's rating, unlike every other test in the system. Use `rollOpenEnded(o.dice, foundryRoller(rolls))` and take the highest `total`, or state that the cap at 6 is intended.

### 8. risk — Revamp shotgun cone: who is caught follows the book geometry, while width and Power follow the Revamp
`applications/sheets.ts:3575–3580`.

`atTarget` uses `cbtShotgunSpread` (width 2^(steps−1)), but `tokensInCone(fromToken, to, choke)` still selects bystanders by the book cone (metres ÷ choke). At 20 m with choke 5, the note says "spread 16 m" while the cone only catches people within about 4 m of the line. Pass the Revamp width into the cone test, or derive the cone from `cbtShotgunSpread`.

### 9. risk — Revamp full defense in melee discards the pool entered in the melee dialog
`documents/index.ts:7207` (`cbtMeleeDefensePool(full, pool)` → 0); `chat.ts:83–96` still shows "Combat Pool dice (N left)".

The text says the pool dice "go to the resistance test", but nothing carries them there. The defender has to type them again at Resist. Nothing is spent twice, but the dialog misleads. Either hide or relabel the pool field when full defense is ticked under the Revamp, or carry the number on the damage state as a default for the Resist prompt.

### 10. risk — Revamp Stun recovery still charges hospital/intensive care while ignoring the care modifiers
`documents/index.ts:1443–1462`.

`cost = careCost(care, hours)` is paid (via `adjustNuyen`) before `stunUrr` replaces `careMods` with the wound modifiers. A Revamp Stun rest "in hospital" costs nuyen and gives nothing for it. Skip the cost (or warn) when `stunRecoveryTest` applies.

### 11. risk — URR radio decryption and drone-link decryption only label "needs N successes"; the card doesn't judge pass/fail
`documents/index.ts:4449–4450` (`dsRadioDecrypt` → a `plain` card).

A result with 1 success against a need of 3 shows as a success on a plain card. The drone-link path does judge it (`dsDecryptPassed`). Add a `need` to the snapshot and a verdict line, as in `#dsInterceptDroneLink`.

---

## Nits

1. **nit, book-mode edge cases** (only with degenerate data):
   - `models/index.ts:786,791`: `Math.max(0, d.combatPool - 0)` clamps a negative base pool (old code didn't). This can only happen with negative attribute totals.
   - `urr80-health-social.ts:35` / `documents/index.ts:6081`: `bleedTurnsPerBox` floors Body and maps NaN to 1. The old code was `Math.max(1, body)`, which gave NaN (never ticks) for a missing Body and a fractional period for a fractional one.
   - `netrig.ts:178` `dsDeviceEccm` coerces a non-numeric ECCM to 0 (old: NaN).

   Fine to keep, but they are, strictly, not "identical".
2. **nit, book parse shape:** `rules/skills.ts:87` `parseSkillWeb` now adds `oneWay: true` to every `A > B` link in book mode too. It is harmless (read only under `coreWebArrows`), but the parse result differs from v0.79.0.
3. **nit:** `documents/index.ts:16664`: the voice/keypad wording for the resolution (and re-rolls) is read from the device's *current* `lockType` and defaults to 'voice' when the device is gone. If the GM edits the device between roll and resolution, a book voice-lock card can switch to "Crack … keypad / accepts the code". Store the words (or the lockType) in `bp` at roll time.
4. **nit:** `settings.ts:1029` `isRulesSource` uses `v in RULES_SOURCES`, so `'toString'`, `'constructor'` and `'__proto__'` pass. The patch falls back to `{}`, but the window prints `RULES_SOURCES['constructor']`. Use `Object.hasOwn(RULES_SOURCES, v)`.
5. **nit:** `settings.ts:1264`: Reset says "Put every rule back to the system's defaults?". Under the Revamp it resets to the Revamp's values. Name the active source in the text.
6. **nit:** `settings.ts:1293`: the source onChange re-renders the open house-rules window, discarding unsaved edits. The GM panel (`sr2e-gm-panel`) isn't re-rendered, so its hint ("changes 139 rules" / "the system's default rules") goes stale after a switch.
7. **nit, book UI (expected):** the house-rules window gains the "Rules source: SR2E Book Rules (Game Settings → Rules source)" line and the Revamp rows, and the GM panel gains the Setup section. This is the intended UI for the feature. Listed only because the owner asked that nothing change.
8. **nit, build:** `public/index.mjs` (00:24) is older than `src/module/rules/guide.ts` (00:25). The bundle lacks the `rules-urr` guide topic (`grep -c rules-urr public/index.mjs` → 0). Rebuild before packaging.

---

## Book-mode hunks checked and found equivalent (for the record)
- **arcana / thaumaturgy:** totem dice, environment totem dice, domain conflict, projection Essence.
- **arcanum:** learning TN ×1, ward drain (successes are now passed, but the book formula ignores them).
- **Other rules modules:**
  - `astralForm` ×1
  - `attributeMaximums` / `attributeMaximumsWith` +0
  - `conjuringDrainLevel` / `Type`
  - `firstAidTarget` / `firstAidBoxes`
  - `dyingTick`
  - `monitorStatus` / `overflowView`
  - `canRollStage`
  - `nativeLanguageRating`
  - armor layering `slice(1, undefined)`
  - `resolveCombatSpell` tie
  - ritual site need, `ritualMaterialsCost`, site cost
  - `jamTarget`
  - `bypassPlan` (casing mods `[]`, tool step null)
  - Skill Web arrows
  - `magicLossOutcome`
  - `karmaAward`, `skillCost`
  - overdose
- **Documents / applications / models glue:**
  - first-aid retry gate
  - Stun rest
  - dying text
  - `foci()`
  - knowledge reveal and criticals (`''`)
  - `urrCoreSkillTestDice` → `skillTestDice`
  - Karma dice 0
  - blast scatter dice, metres and text
  - `cbtBlastStaged` returns its input
  - instruction (no `attribute` field written)
  - `urrCoreOpposed` (text identical: a book initiator's win always has net > 0)
  - training days
  - radio
  - athletics
  - haggle TN (`h.tn` is `RULES.STREET.haggle.tn`)
  - find mods `[]`
  - breath (0 turns, same text)
  - falling (`!f.level` never true in book)
  - MAD scan off
  - recoil, heavy and tracers
  - charge Power 0
  - `vehHit` only in the Revamp
  - `veh80FireModifiers` (same three fields)
  - occupant armor
  - gunnery pool
  - cover id
  - scatter extras `{}`
  - clean-miss branch off
  - full-defense dice and pool
  - knockdown TN, due, flag and result
  - casting Force +0, elemental TN, ritual problem null, resist TN `{}`, sustain cap null, cast dice
  - drain mods `[]`, drain type
  - learn +0 dice
  - ward Force cap null, ward drain type
  - astral damage, tracking `[]`
  - drive, ram and evasive pool cap
  - `veh80Incoming` (book returns `vehicleIncomingDamage`, `inc.armor === armor`, so the note is identical)
  - feedback (no `attribute` key in book)
  - passengers, crash, repair TN
  - drone intercept
  - voice step words
  - initiative tie keys and values
  - models encumbrance, astral mode, vehicle Speed
  - advancement `{}`
  - chat Defend and melee dialogs (identical strings)
  - knockdown level null
  - Resist pool prompt
  - sheets dialogs (empty rows only), charging label "-1", subdue mods `[]`, shotgun, reload
- **Settings:** `baseRule('book')` = shipped; `changedRules()` unchanged in book; the patch is applied with `structuredClone` (no aliasing); `URR_V80_PATCH` is never mutated.
- **Karma re-roll safety (Revamp):** `urrAfterFirstAid` is idempotent (`firstAidBy` max; self-stabilisation guarded by `snap.testId`; runs only when `applies`, i.e. the patient is owned or the GM is applying). The Magic loss card and the Karma-dice spend sit outside `#resolve`. Ward drain sits outside `#resolve`. No flag clears were added (the helpers/flags.ts rules are not affected).

## Test gaps
- The house-rules window submit/round trip under each source (#1). No test exercises `#onSubmit` with `baseRule`, nor switching sources between saves.
- The `rulesSource` onChange: actors are not re-prepared (#2), and the GM panel isn't refreshed.
- A melee soak with `cleanMiss80` and pool successes (#4).
- An exclusive/fetish spell under `magCastDice 'force'` (dice count) (#5).
- Layered armor + `cbtArmorPool` (#6).
- MAD scan against concealment of 7 or more (#7).
- Vehicle resist with a rigger the clicking user doesn't own (#3).
- A book-mode golden test of chat card HTML for the touched cards (soak "fully resisted", contest verdicts, bypass voice wording, vehicle resist notes, dying text). The current book tests assert numbers more than strings.
