# Data formats

Every text, file and stored setting a GM or player can feed into SR2e, written down as the code reads it. Use it to prepare a spreadsheet, check why a paste was refused, or back up a world's catalogue.

- The system ships no book data. Everything below is your own data, typed from your own books: keep it for your own group.
- All examples are invented (names and numbers). They are not book values.
- "Ignoring case" below always means the same thing: upper and lower case are the same, and (for spreadsheet headers and choice values) spaces and punctuation are dropped too, so `Street Index`, `street-index` and `STREETINDEX` are one header.
- The choice lists in the tables are the shipped defaults. Some come from the rules (ammo kinds, legality, toxins, vehicle categories…) and follow the world's house rules, so a world with changed rules may accept other values.
- System id: `shadowrun2e_unified` (it was `sr2e` before v0.93.1). Settings and flags use the id; the scripting names (`game.sr2e`, the `sr2e.*` hooks) did not change.

Contents:

1. [Catalogue rows (spreadsheet paste)](#1-catalogue-rows-spreadsheet-paste)
2. [Templates as CSV (export)](#2-templates-as-csv-export)
3. [Catalogue file (JSON)](#3-catalogue-file-json)
4. [Character write-up import](#4-character-write-up-import)
5. [NPC stat block import](#5-npc-stat-block-import)
6. [New entry: "Paste the stat line"](#6-new-entry-paste-the-stat-line)
7. [Item templates in a world compendium](#7-item-templates-in-a-world-compendium)
8. [Starter kits](#8-starter-kits)
9. [World settings worth backing up](#9-world-settings-worth-backing-up)

---

## 1. Catalogue rows (spreadsheet paste)

Source: `src/module/rules/catalogcsv.ts` (parsing), `src/module/applications/catalogue.ts` (the window).

**Where:** GM panel, **Setup** tab, *Item catalogue*: **Paste spreadsheet rows…**. The window has a *Type for rows without a Type column* list and a text box; a preview under the box shows, 200 ms after you stop typing, how many templates the rows make, what each column became (a column shown in warning colour is ignored) and the first errors. **Make the templates** saves them. From a macro: `game.sr2e.api.pasteCatalogueRows(text, defaultType)` (no window; returns how many templates were added or replaced). GM only: a player gets *Only the GM can change the catalogue.* and 0.

Each row becomes a **world item template** (the `itemTemplates` setting, [section 9](#9-world-settings-worth-backing-up)). Templates show first in every Add window and in the shop.

### Example

Copied from a spreadsheet (tab-separated):

```
Name	Type	Damage	Modes	Ammo	Cost	Street Index	Avail
Example Pistol	weapon	7M	SA	12 (c)	400	1	3/24 hrs
Example Vest	armor				250	1	2/24 hrs
Example Rope	gear				15
```

The same as CSV, typed by hand:

```
Name,Type,Damage,Modes,Ammo,Cost,Street Index,Avail
Example Pistol,weapon,7M,SA,12 (c),400,1,3/24 hrs
Example Vest,armor,,,,250,1,2/24 hrs
Example Rope,gear,,,,15,,
```

Result: three templates. The pistol gets `damagePower` 7, `damageLevel` M, `damageType` physical, `strengthPower` no, `modes` SA, `ammoMax` 12, `ammo` 12, `feed` clip, `cost` 400, `streetIndex` 1, `availability` "3/24 hrs". Empty cells are left out, so the vest and the rope get only what their row gives.

One type for every row (no Type column), semicolons, and a "Type" column that is the spell's own type (`defaultType` `spell`):

```
Name;Type;Category;Drain;Force
Example Bolt;M;combat;+1S;4
```

Here "Type" is read as the spell's `spellType` (M = mana), with the warning *The "Type" column is read as the spell's spellType, since its cells aren't item types.*

### How the text is read

| What | Rule |
|---|---|
| Separator | Read from the first line (outside quotes): a tab if there is one, else `;` when there are more semicolons than commas, else `,`. |
| Quotes | A cell may be in `"…"`; `""` inside is one quote; a quoted cell may hold line breaks. A quote opened and never closed is an error on that row (*A quote (") opened here is never closed, so every row after it was read as one cell.*). |
| Line ends | CRLF or LF. A leading byte-order mark is dropped. |
| Cells | Trimmed. Rows with nothing in them are dropped (they still count for row numbers). |
| Formula guard | A cell starting `'=`, `'+`, `'-` or `'@` loses the `'` (what *Export as CSV* writes). Any other leading `'` stays. |
| Size | At most 1,000,000 characters; the rest is cut off with a warning. |
| Header | The first non-empty row. Row numbers in messages count it as row 1, as a spreadsheet does. |

### The header row

- **Name** (required): a header `Name`, `Item name`, `Item` or `Title`. Without one: *There is no "Name" column.* and nothing is made.
- **Type** (optional): a header `Type` or `Item type`. Without it, every row takes the default type; a row with no type and no default is an error (*No item type (add a Type column or choose a default type).*).
- **Every other header** is matched, ignoring case, spaces and punctuation (`¥` counts as the word `nuyen`), in this order: a shorthand column of the row's type; the field's full path (`range.short` → `rangeshort`); one of its other headers (the tables below); the last part of its path (`short`), when only one field of the type ends that way. If nothing matches, the header is tried again with any `(…)` or `[…]` parts removed, so `Cost (¥)` is `Cost`.
- **`system.<path>`** (for example `system.notes` or `system.range.short`) writes that field directly. Path parts may use letters, digits and `_`; `__proto__`, `prototype` and `constructor` are refused. The cell is read as `true`/`false`, `null`, a number, JSON when it starts with `"`, `[` or `{`, and otherwise as text.
- A header nobody understands is listed in the preview as ignored. A header that means something for some rows' types but not for this row's type gives one warning per type: *The "…" column means nothing for a …; ignored on those rows.*

### Type cells

A Type cell (or the default type) is one of these words, ignoring case, spaces and punctuation. Plurals with an `s` work for the eleven types.

| Item type | Words | Also sets |
|---|---|---|
| `skill` | skill, activeskill, activeskills | `kind` active (for the two "active" words) |
| `skill` | knowledgeskill, knowledgeskills, knowledge | `kind` knowledge |
| `skill` | languageskill, language, languages | `kind` language |
| `weapon` | weapon, gun, guns, firearm, firearms | |
| `weapon` | meleeweapon, meleeweapons, melee | `melee` yes |
| `armor` | armor, armour, armours | |
| `gear` | gear, equipment, item, items | |
| `cyberware` | cyberware, cyber | |
| `cyberware` | bioware, bio | `bioware` yes |
| `spell` | spell | |
| `power` (critter powers) | power, critterpower(s), spiritpower(s) | |
| `focus` | focus, foci | |
| `adeptpower` | adeptpower, adept, adeptpowers | |
| `cyberdeck` | cyberdeck, deck, decks | |
| `program` | program, utility, utilities | |

When a default type is chosen and the Type column's cells are not item types but are all valid values of that type's own "type" field, the column is read as that field instead: a spell's `spellType`, a focus's `focusType`, a program's or cyberware's or skill's `kind`.

### Cell values

| Kind | Accepted |
|---|---|
| number | `1500`, `1,500`, `1 500`, `+2`, `0.5`, `0,5` (decimal comma), `¥1500`, `1500 nuyen` (also `nuy`, `ny`). |
| integer (whole number) | As a number, and `1.500` (dots as thousands separators) is 1500. `2.5` is an error. |
| boolean (yes/no) | Yes: `yes`, `y`, `true`, `t`, `x`, `1`, `on`, ✓ ✔ ☑ ✅. No: `no`, `n`, `false`, `f`, `0`, `off`, ✗ ✘ ☐ ❌. |
| choice | The value itself, one of its other words (in the tables), or the start of exactly one value (`thermo` → `thermographic`), ignoring case and punctuation. `none` means the blank value where the list has one. |
| string (text) | As it is. |
| Empty marks | For anything but text, a cell that is `-`, `–`, `—`, `n/a` or `na` is treated as empty. |
| Minimum, maximum | Checked for numbers (shown in the tables). |

Shorthand columns fill several fields from one cell:

| Shorthand | Accepted |
|---|---|
| Damage (weapon, cyberware) | `9M`, `6S Stun`, `(STR+2)M`, `STR+1 L`, `M`, words `Light`/`Moderate`/`Serious`/`Deadly` for the level, `Stun` or `Phys`/`Physical` for the type. A weapon needs a Power (`9M` or `(STR+1)M`); a Strength code sets `strengthPower`. No type word = physical. |
| Damage (spell, critter power) | The level only, with `Stun` if it is: `M`, `S Stun`. A Power is an error. |
| Damage (program) | The level only (`L`, `M`, `S`, `D`); `Stun` is an error. |
| Drain (spell) | `[(F/2)+1]S`, `(F/2)-1 M`, `+2D`, `S`: the number added to Force ÷ 2 (0 when none) and the level. |
| Range (weapon) | Four numbers: `5/20/40/60`; `0-5/6-20/21-40/41-60` takes the upper end of each; a vertical bar or spaces also separate the numbers. |
| Ammo (weapon) | `15`, or `15 (c)` / `15c` with c clip, b belt, cy cylinder, m internal, bk break (also the words clip, belt, cylinder, magazine, internal, break). Sets the capacity and loads it full. |
| Armor (armor, adept power, cyberware) | `5/3` (Ballistic/Impact). The header `BI` means Armor except on cyberware, where it is Body Index. |
| Persona (cyberdeck) | Four numbers: Bod/Evasion/Masking/Sensors, `3/3/3/3`. |

### Columns per item type

Each table lists the field (its path is also a header), the other headers that mean it, and what the cell may hold. "integer (min 0)" is a whole number of at least 0.

#### skill

| Field (header) | Other headers | Value |
|---|---|---|
| `rating` | rank, level, skillrating | integer (min 0) |
| `attribute` | attr, linkedattribute, linked | choice: body, quickness, strength, charisma, intelligence, willpower, reaction |
| `kind` | skillkind, skilltype, category | choice: active, knowledge, language, buildRepair; also br→buildRepair, buildandrepair→buildRepair, know→knowledge, lang→language |
| `specialization` | spec, specialisation | string |
| `specializationRating` | specrating, specialisationrating | integer (min 0) |
| `concentration` | conc | string |
| `concentrationRating` | concrating | integer (min 0) |
| `native` | nativelanguage, mothertongue | boolean |
| `description` | desc, notes, note, text | string |

#### weapon

| Field (header) | Other headers | Value |
|---|---|---|
| `skill` | weaponskill, attackskill | string |
| `specialization` | spec, specialisation | string |
| `melee` | meleeweapon, handtohand | boolean |
| `damagePower` | power, dmgpower, pow | integer |
| `damageLevel` | level, dmglevel, woundlevel, wound | choice: L, M, S, D; also light→L, moderate→M, serious→S, deadly→D |
| `damageType` | dmgtype | choice: physical, stun |
| `strengthPower` | strpower, powerfromstrength, strengthbased, strbased | boolean |
| `strengthCap` | strcap, maxstr, maxstrength | integer (min 0) |
| `range.short` | short, shortrange | integer (min 0) |
| `range.medium` | medium, mediumrange, med | integer (min 0) |
| `range.long` | long, longrange | integer (min 0) |
| `range.extreme` | extreme, extremerange, ext | integer (min 0) |
| `strengthRange` | thrown, strrange, rangefromstrength | boolean |
| `minRange` | minimumrange, armingrange | number (min 0) |
| `reach` | rch | integer (min 0) |
| `ammoMax` | capacity, clip, magazine, mag, ammocapacity, clipsize | integer (min 0) |
| `ammo` | loaded, roundsloaded, currentammo | integer (min 0) |
| `feed` | feedtype, loading | choice: clip, belt, cylinder, internal, break; also c→clip, b→belt, cy→cylinder, m→internal, magazine→internal, internalmagazine→internal, bk→break, breakaction→break |
| `ammoType` | ammunitiontype, loadedammo | choice: standard, apds, explosive, exex, flechette, gel, tracer, shot |
| `modes` | mode, firingmodes, firingmode, fire | string |
| `recoilComp` | rc, recoil, recoilcompensation | integer (min 0) |
| `smartgun` | smart, smartlink, smartgunlink | boolean |
| `heavy` | heavyweapon | boolean |
| `gyro` | gyromount, gyrorating | integer (min 0) |
| `laserSight` | laser | boolean |
| `scope` | scopemagnification, magnification | integer (min 0, max 3) |
| `scopeVision` | scopemode | choice: (blank), lowLight, thermographic; also ll→lowLight, thermo→thermographic, thermal→thermographic |
| `shockPad` | shock | boolean |
| `support` | mountsupport | choice: none, bipod, tripod |
| `muzzle` | muzzledevice | choice: (blank), silencer, suppressor |
| `blast` | explosive, grenade, area | boolean |
| `blastKind` | grenadetype, grenadekind, blasttype | choice: custom, offensive, defensive, concussion, flash, gas, heRocket, apRocket, avRocket, demolition, smoke, thermalSmoke |
| `blastPerMetre` | falloff, permetre, permeter, powerpermetre, blastfalloff | number (min 0) |
| `fuse` | fusetype | choice: (blank), impact, airburst |
| `smartGrenade` | smartguidance | boolean |
| `shotgun` | shot | boolean |
| `choke` | chokesetting | integer (min 1) |
| `areaKind` | areaeffect | choice: (blank), flame; also flamethrower→flame |
| `guidance` | missileintelligence, intelligence | integer (min 0) |
| `stunWeapon` | taser, stunbaton, stun | boolean |
| `antiVehicle` | av, antivehicleweapon | boolean |
| `armorKind` | armortype, vsarmor | choice: auto, ballistic, impact |
| `magical` | magic, enchanted | boolean |
| `material` | madeof | string |
| `mount` | vehiclemount, mounting | choice: none, fixed, turret, pintle, ring |
| `selfHit` | canhitwielder | boolean |
| `weight` | wt, mass, kg | number (min 0) |
| `concealability` | conceal, conc, cnc, concealment | integer (min 0) |
| `cf` | cargofactor, cargo | number (min 0) |
| `cost` | price, nuyen, yen, costnuyen, pricenuyen | integer (min 0) |
| `availability` | avail, availability, availabilitytn | string |
| `streetIndex` | streetindex, si, index, street | number (min 0) |
| `legality` | legal, law, legalstatus | choice: (blank), legal, permit, restricted, forbidden; also notset→(blank), needsapermit→permit |
| `permit` | haspermit, permitheld | boolean |
| `description` | desc, notes, note, text | string |

Shorthand columns:

- **Damage** (headers: damage, dmg, damagecode, dam) fills damagePower, damageLevel, damageType, strengthPower. Damage code: "9M", "6S Stun", "(STR+2)M".
- **Range** (headers: range, ranges, rangebands) fills range.short, range.medium, range.long, range.extreme. Short/Medium/Long/Extreme in metres, e.g. "5/20/40/60".
- **Ammo** (headers: ammo, ammunition, ammocap) fills ammoMax, ammo, feed. Capacity and how it loads, e.g. "15 (c)" (c clip, b belt, cy cylinder, m internal); it comes loaded.

#### armor

| Field (header) | Other headers | Value |
|---|---|---|
| `ballistic` | bal, ballisticrating, b | integer (min 0) |
| `impact` | imp, impactrating, i | integer (min 0) |
| `adds` | stacks, addstootherarmor, additive | boolean |
| `parry` | parryrating | integer (min 0) |
| `worn` | wearing | boolean |
| `weight` | wt, mass, kg | number (min 0) |
| `concealability` | conceal, conc, cnc, concealment | integer (min 0) |
| `cf` | cargofactor, cargo | number (min 0) |
| `cost` | price, nuyen, yen, costnuyen, pricenuyen | integer (min 0) |
| `availability` | avail, availability, availabilitytn | string |
| `streetIndex` | streetindex, si, index, street | number (min 0) |
| `legality` | legal, law, legalstatus | choice: (blank), legal, permit, restricted, forbidden; also notset→(blank), needsapermit→permit |
| `permit` | haspermit, permitheld | boolean |
| `description` | desc, notes, note, text | string |

Shorthand columns:

- **Armor** (headers: armor, armour, ballisticimpact, armorrating, armourrating, balimp, bi) fills ballistic, impact. Ballistic/Impact, e.g. "5/3".

#### gear

| Field (header) | Other headers | Value |
|---|---|---|
| `quantity` | qty, count, amount, number | integer (min 0) |
| `weight` | wt, mass, kg | number (min 0) |
| `concealability` | conceal, conc, cnc, concealment | integer (min 0) |
| `cf` | cargofactor, cargo | number (min 0) |
| `cost` | price, nuyen, yen, costnuyen, pricenuyen | integer (min 0) |
| `availability` | avail, availability, availabilitytn | string |
| `streetIndex` | streetindex, si, index, street | number (min 0) |
| `legality` | legal, law, legalstatus | choice: (blank), legal, permit, restricted, forbidden; also notset→(blank), needsapermit→permit |
| `permit` | haspermit, permitheld | boolean |
| `material` | enchantingmaterial, materials | choice: (blank), raw, refined, radical, fetish |
| `ammoType` | ammunitiontype, ammo, ammunition | choice: (blank), standard, apds, explosive, exex, flechette, gel, tracer, shot |
| `rounds` | roundsperclip, roundcount | integer (min 0) |
| `medkitRating` | medkit | integer (min 0) |
| `rcdRating` | rcd, remotecontroldeck | integer (min 0) |
| `signal` | signalrating | integer (min 0) |
| `jammer` | jammerrating | integer (min 0) |
| `suite` | programmingsuite | integer (min 0) |
| `patch.kind` | patch, patchkind, slappatch | choice: (blank), stim, tranq, trauma, antidote |
| `patch.rating` | patchrating | integer (min 0) |
| `scanner.kind` | scanner, scannerkind, detector | choice: (blank), weapon, cyber, explosive; also cyberware→cyber |
| `scanner.rating` | scannerrating | integer (min 0) |
| `chip.kind` | chip, chipkind, skillsoft | choice: (blank), activesoft, knowsoft, linguasoft |
| `chip.skill` | chipskill, softskill | string |
| `chip.rating` | chiprating, softrating | integer (min 0) |
| `explosive.power` | explosivepower, chargepower | integer (min 0) |
| `explosive.perMetre` | explosivefalloff, explosivepermetre | number (min 0) |
| `explosive.shaped` | shaped, shapedcharge | boolean |
| `toxin.kind` | toxin, toxinkind, drug | choice: (blank), toxin, drug, disease |
| `toxin.vector` | vector | choice: contact, ingestion, inhalation, injection |
| `toxin.power` | toxinpower | integer (min 0) |
| `toxin.level` | toxinlevel | choice: L, M, S, D; also light→L, moderate→M, serious→S, deadly→D |
| `toxin.damageType` | toxindamagetype | choice: physical, stun |
| `toxin.speed` | speed, toxinspeed | choice: immediate, turn, minute, tenMinutes, hour, day |
| `toxin.addiction` | addiction | integer (min 0) |
| `protection.kind` | protection, protectionkind | choice: (blank), gasMask, respirator, chemsuit |
| `protection.rating` | protectionrating | integer (min 0) |
| `radio.rating` | radio, radiorating | integer (min 0) |
| `radio.encryption` | encryption | integer (min 0) |
| `optics.lowLight` | lowlight | boolean |
| `optics.thermographic` | thermographic, thermo | boolean |
| `optics.flareComp` | flarecomp, flarecompensation | boolean |
| `optics.magnification` | magnification, mag | integer (min 0, max 3) |
| `description` | desc, notes, note, text | string |

#### cyberware

| Field (header) | Other headers | Value |
|---|---|---|
| `essenceCost` | essence, ess, essencecost, esscost | number (min 0) |
| `grade` | cybergrade, waregrade | choice: standard, alpha, beta, delta; also std→standard, alphaware→alpha, betaware→beta, deltaware→delta, normal→standard |
| `kind` | cyberkind, warekind | choice: other, cyberlimb, cyberweapon, datajack, chipjack, skillwires, eyes, ears, pheromones, reflexes, encephalon, memory, iccm, filtration, boneLacing |
| `rating` | level, rtg | integer (min 0) |
| `bioware` | bio, isbioware | boolean |
| `bodyIndex` | bi, bodyindexcost | number (min 0) |
| `bioKind` | biowarekind, biokind | choice: other, muscleAugmentation, cerebralBooster, synapticAccelerator, adrenalPump, orthoskin, toxinExtractor, trachealFilter, plateletFactory, damageCompensator, enhancedArticulation, traumaDamper, painEditor |
| `cultured` | culturedbioware | boolean |
| `installed` | implanted | boolean |
| `attributes.body` | body, bod, bodybonus | integer |
| `attributes.quickness` | quickness, qui, quicknessbonus | integer |
| `attributes.strength` | strength, str, strengthbonus | integer |
| `attributes.charisma` | charisma, cha, charismabonus | integer |
| `attributes.intelligence` | intelligence, int, intelligencebonus | integer |
| `attributes.willpower` | willpower, wil, willpowerbonus | integer |
| `reaction` | rea, reactionbonus | integer |
| `initiativeDice` | initiative, init, initdice | integer (min 0) |
| `armorBallistic` | ballistic, bal | integer (min 0) |
| `armorImpact` | impact, imp | integer (min 0) |
| `reflexes` | reflextype | choice: (blank), wired, boosted, enhancer, synaptic |
| `controlRig` | vcr, controlriglevel, rig | integer (min 0) |
| `smartlink` | smart | boolean |
| `smartlinkLevel` | smartlinklevel | integer (min 0, max 2) |
| `lowLight` | lowlightvision | boolean |
| `thermographic` | thermo, thermographicvision | boolean |
| `flareComp` | flarecompensation | boolean |
| `magnification` | mag, opticalmagnification | integer (min 0, max 3) |
| `ultrasound` | ultrasoundvision | boolean |
| `hearingAmp` | hearingamplification | integer (min 0, max 3) |
| `pheromones` | pheromonerating | integer (min 0) |
| `limb.location` | limb, location, limblocation | choice: leftArm, rightArm, leftLeg, rightLeg, other |
| `limb.strength` | limbstrength, limbstr | integer (min 0) |
| `limb.quickness` | limbquickness, limbqui | integer (min 0) |
| `limb.capacity` | capacity, limbcapacity | number (min 0) |
| `weapon.skill` | weaponskill | string |
| `weapon.damagePower` | power, damagepower | integer |
| `weapon.damageLevel` | damagelevel | choice: L, M, S, D; also light→L, moderate→M, serious→S, deadly→D |
| `weapon.damageType` | damagetype | choice: physical, stun |
| `weapon.strengthPower` | strpower, strengthbased | boolean |
| `weapon.reach` | reach | integer |
| `concealability` | conceal, conc, cnc | integer (min 0) |
| `cost` | price, nuyen, yen, costnuyen, pricenuyen | integer (min 0) |
| `availability` | avail, availability, availabilitytn | string |
| `streetIndex` | streetindex, si, index, street | number (min 0) |
| `legality` | legal, law, legalstatus | choice: (blank), legal, permit, restricted, forbidden; also notset→(blank), needsapermit→permit |
| `permit` | haspermit, permitheld | boolean |
| `description` | desc, notes, note, text | string |

Shorthand columns:

- **Damage** (headers: damage, dmg, damagecode, dam) fills weapon.damagePower, weapon.damageLevel, weapon.damageType, weapon.strengthPower. Damage code: "9M", "6S Stun", "(STR+2)M".
- **Armor** (headers: armor, armour, ballisticimpact, armorrating, armourrating, balimp) fills armorBallistic, armorImpact. Ballistic/Impact, e.g. "5/3".

#### spell

| Field (header) | Other headers | Value |
|---|---|---|
| `category` | spellcategory, class | choice: combat, detection, health, illusion, manipulation |
| `spellType` | spelltype, mp, manaphysical | choice: mana, physical |
| `learnedForce` | force, f, learnedforce, rating | integer (min 1) |
| `duration` | dur | choice: instant, sustained, permanent |
| `range` | spellrange | choice: los, touch; also lineofsight→los, t→touch |
| `area` | areaeffect, aoe | boolean |
| `drainModifier` | drainmod, drainmodifier, drainbonus | integer |
| `drainLevel` | drainlevel | choice: L, M, S, D; also light→L, moderate→M, serious→S, deadly→D |
| `damageLevel` | damagelevel, level | choice: L, M, S, D; also light→L, moderate→M, serious→S, deadly→D |
| `damageType` | damagetype | choice: physical, stun |
| `targetNumber` | tn, target | integer (min 2) |
| `resist` | resistedby, resistance, resistattribute | choice: none, body, quickness, strength, charisma, intelligence, willpower |
| `elemental` | elementalmanipulation | boolean |
| `element` | elementtype | string |
| `heals` | healing | boolean |
| `healTrack` | healstrack | choice: physical, stun |
| `exclusive` | exclusivespell | boolean |
| `fetish` | fetishlimited, fetishspell | boolean |
| `extendedRange` | extended | boolean |
| `description` | desc, notes, note, text | string |

Shorthand columns:

- **Damage** (headers: damage, dmg, damagecode, dam) fills damageLevel, damageType. Damage level, with "Stun" if it is: "M", "S Stun".
- **Drain** (headers: drain, draincode, drainvalue) fills drainModifier, drainLevel. Drain code, e.g. "[(F/2)+1]S" or "+1S".

#### power

| Field (header) | Other headers | Value |
|---|---|---|
| `active` | activepower | boolean |
| `dice` | dicefrom, dicesource | choice: force, rating, body, quickness, strength, charisma, intelligence, willpower, magic |
| `rating` | level, rtg | integer (min 0) |
| `tnSource` | tnfrom, tnsource | choice: fixed, body, quickness, strength, charisma, intelligence, willpower |
| `targetNumber` | tn, target | integer (min 2) |
| `resist` | resistedby, resistance | choice: none, body, quickness, strength, charisma, intelligence, willpower |
| `effect` | result | choice: effect, damage |
| `area` | areaeffect, aoe | boolean |
| `repeating` | repeat | boolean |
| `damageLevel` | damagelevel | choice: L, M, S, D; also light→L, moderate→M, serious→S, deadly→D |
| `damageType` | damagetype | choice: physical, stun |
| `sustained` | sustain | boolean |
| `special` | specialeffect, builtin | choice: (blank), allergy, vulnerability, essenceLoss, essenceDrain, regeneration, dualNatured, infection, immunity, concealment, confusion, movement, fear, guard, paralysis, petrification, binding |
| `substance` | allergen, vulnerableto | string |
| `severity` | allergyseverity | choice: nuisance, mild, moderate, severe, extreme |
| `notes` | rangeduration, details | string |
| `description` | desc, text | string |

Shorthand columns:

- **Damage** (headers: damage, dmg, damagecode, dam) fills damageLevel, damageType. Damage level, with "Stun" if it is: "M", "S Stun".

#### focus

| Field (header) | Other headers | Value |
|---|---|---|
| `focusType` | focustype, focuskind | choice: spell, sustaining, spirit, power, weapon |
| `rating` | force, f, level | integer (min 0) |
| `bonded` | bond | boolean |
| `active` | on | boolean |
| `category` | spellcategory | string |
| `target` | spell, spirit, for | string |
| `cost` | price, nuyen, yen, costnuyen, pricenuyen | integer (min 0) |
| `availability` | avail, availability, availabilitytn | string |
| `streetIndex` | streetindex, si, index, street | number (min 0) |
| `legality` | legal, law, legalstatus | choice: (blank), legal, permit, restricted, forbidden; also notset→(blank), needsapermit→permit |
| `permit` | haspermit, permitheld | boolean |
| `description` | desc, notes, note, text | string |

#### adeptpower

| Field (header) | Other headers | Value |
|---|---|---|
| `cost` | pp, powerpoints, ppcost, pointcost, points | number (min 0) |
| `level` | rating, levels | integer (min 0) |
| `active` | on | boolean |
| `attributes.body` | body, bod, bodybonus | integer |
| `attributes.quickness` | quickness, qui, quicknessbonus | integer |
| `attributes.strength` | strength, str, strengthbonus | integer |
| `attributes.charisma` | charisma, cha, charismabonus | integer |
| `attributes.intelligence` | intelligence, int, intelligencebonus | integer |
| `attributes.willpower` | willpower, wil, willpowerbonus | integer |
| `reaction` | rea | integer |
| `initiativeDice` | initiative, init, initdice | integer (min 0) |
| `skill` | improvedskill | string |
| `skillDice` | dice, skillbonus | integer |
| `ballistic` | bal | integer (min 0) |
| `impact` | imp | integer (min 0) |
| `special` | specialeffect, builtin | choice: (blank), killingHands, combatSense, painResistance, enhancedPerception, astralPerception, rapidHealing, distanceStrike, spellResistance, improvedSenses |
| `sense` | improvedsense | choice: (blank), lowLight, thermographic, ultrasound, hearing |
| `description` | desc, notes, note, text | string |

Shorthand columns:

- **Armor** (headers: armor, armour, ballisticimpact, armorrating, armourrating, balimp, bi) fills ballistic, impact. Ballistic/Impact, e.g. "5/3".

#### cyberdeck

| Field (header) | Other headers | Value |
|---|---|---|
| `mpcp` | mpcprating | integer (min 0) |
| `bod` | body | integer (min 0) |
| `evasion` | eva | integer (min 0) |
| `masking` | mask | integer (min 0) |
| `sensors` | sensor, sens | integer (min 0) |
| `hardening` | hard | integer (min 0) |
| `responseIncrease` | response, ri | integer (min 0) |
| `activeMemory` | active, activemem, am | integer (min 0) |
| `storageMemory` | storage, storagemem, sm | integer (min 0) |
| `ioSpeed` | io, iospeed | integer (min 0) |
| `loadSpeed` | load | integer (min 0) |
| `signal` | signalrating | integer (min 0) |
| `hitchers` | hitcherjacks | integer (min 0) |
| `tortoise` | noasist | boolean |
| `realityFilter` | filter | boolean |
| `living` | livingpersona, otaku | boolean |
| `cost` | price, nuyen, yen, costnuyen | integer (min 0) |
| `availability` | avail, availability, availabilitytn | string |
| `streetIndex` | streetindex, si, index, street | number (min 0) |
| `legality` | legal, law, legalstatus | choice: (blank), legal, permit, restricted, forbidden; also notset→(blank), needsapermit→permit |
| `permit` | haspermit, permitheld | boolean |
| `description` | desc, notes, note, text | string |

Shorthand columns:

- **Persona** (headers: persona, bems, personaprograms, personarating) fills bod, evasion, masking, sensors. Bod/Evasion/Masking/Sensors, e.g. "3/3/3/3".

#### program

| Field (header) | Other headers | Value |
|---|---|---|
| `kind` | utility, programkind, programtype | choice: attack, sleaze, deception, analyze, browse, decrypt, evaluate, read/write, relocate, medic, mirrors, shield, smoke, spoof, validate, track, armor, cloak, lock-on, frame, smart-frame, agent, other, slow, restore, camo, crash, commlink, scanner, defuse |
| `rating` | level, rtg | integer (min 0) |
| `size` | mp, memory, sizemp | integer (min 0) |
| `damageLevel` | damagelevel | choice: L, M, S, D; also light→L, moderate→M, serious→S, deadly→D |
| `complexForm` | complex, otaku | boolean |
| `loaded` | inmemory | boolean |
| `cost` | price, nuyen, yen, costnuyen, pricenuyen | integer (min 0) |
| `availability` | avail, availability, availabilitytn | string |
| `streetIndex` | streetindex, si, index, street | number (min 0) |
| `legality` | legal, law, legalstatus | choice: (blank), legal, permit, restricted, forbidden; also notset→(blank), needsapermit→permit |
| `permit` | haspermit, permitheld | boolean |
| `description` | desc, notes, note, text | string |

Shorthand columns:

- **Damage** (headers: damage, dmg, damagecode, dam) fills damageLevel. Damage level: L, M, S or D.


### What happens to the rows

- A row with any bad cell is **left out** and each problem is reported as *Row N: …*. The other rows are still made. The window shows the first 10 errors; saving shows the first 5 as notifications, then *Catalogue: N new, M replaced* (with how many rows were left out).
- A row with the same type and name (case and outer spaces ignored) as an existing world template **replaces** it and keeps its id (*Row N: "…" replaces the existing … template.*). A replaced template keeps its *in the shop* mark.
- The same type and name twice in one paste: the later row wins (*Row N: "…" (…) appears twice; the later row wins.*).
- Nothing valid: *No templates made (see the messages).* and nothing is saved.

Error and warning texts (in English; `…` is your cell):

| Text | Why |
|---|---|
| `"…" is not an item type.` | The Type cell (or the default type) is not in the Type table. |
| `No name.` | The Name cell is empty. |
| `…: "…" is not a number` / `is not a whole number` | A number column. |
| `…: N is below the minimum M` / `above the maximum M` | Outside the column's limits. |
| `…: "…" is not yes or no` | A yes/no column. |
| `…: "…" is not one of a, b, c…` | A choice column (the first 12 values are listed). |
| `…: "…" is not a damage code (like 9M, 6S Stun or (STR+2)M)` | Damage shorthand. Also `needs a Power, like 9M or (STR+1)M`, `give just the level (L, M, S or D)` and `this damage is always one type`. |
| `…: "…" is not four range bands (like 5/20/40/60)` | Range shorthand. |
| `…: "…" is not an ammo capacity (like 15 or 15 (c))` | Ammo shorthand. |
| `…: "…" is not Ballistic/Impact (like 5/3)` | Armor shorthand. |
| `…: "…" is not a drain code (like (F/2)+1S)` | Drain shorthand. |
| `…: "…" is not four persona ratings (like 3/3/3/3)` | Persona shorthand. |

**Limits:** 1,000,000 characters per paste. If a spreadsheet turns `5/3` into a date, type it in the spreadsheet as `'5/3` (the spreadsheet keeps the `'` out of what it copies).

---

## 2. Templates as CSV (export)

Source: `src/module/rules/catalogcsv.ts` (`templatesToCsv`), `src/module/applications/catalogue.ts`.

**Where:** GM panel, **Setup**, **Export as CSV**. Downloads `sr2e-templates-<world id>.csv` with every world template.

**Layout:** comma-separated, CRLF line ends, a header row `Type,Name,…` then one row per template. After Type and Name comes a column per field any template has: the known fields first (in the tables' order, under the first header that means the same field for every type that has it), then any other field as `system.<path>`, alphabetically. Yes/no fields are written `yes`/`no`; other fields of a `system.` column are written as JSON when needed. A cell that would start a spreadsheet formula (`=`, `+`, `-`, `@`, other than a plain number) gets a leading `'`; cells with commas, quotes, line breaks, `;`, tabs or outer spaces are quoted.

Pasting the file back ([section 1](#1-catalogue-rows-spreadsheet-paste)) gives the same templates. Example (from the paste above):

```
Type,Name,damagePower,damageLevel,damageType,strengthPower,ammoMax,loaded,feed,modes,cost,availability,streetIndex
weapon,Example Pistol,7,M,physical,no,12,12,clip,SA,400,3/24 hrs,1
armor,Example Vest,,,,,,,,,250,2/24 hrs,1
gear,Example Rope,,,,,,,,,15,,
```

(The rounds loaded are written under `loaded`, because the header `Ammo` is the capacity shorthand.)

---

## 3. Catalogue file (JSON)

Source: `src/module/rules/catalogcsv.ts` (`catalogueToJson`, `parseCatalogueJson`, `mergeTemplates`, `missingValues`), `src/module/rules/setup.ts` (`normalizeKit`, `mergeKits`), `src/module/applications/catalogue.ts` (`loadCatalogue`).

**Where:** GM panel, **Setup**: **Save a catalogue file** downloads `sr2e-catalogue-<world id>.json` with the world's templates and starter kits. **Load a catalogue file…** reads one: pick the file, what to do with a template or kit of the same name (*Replace it*, *Keep mine*, *Keep both*: templates get "Name (2)", a kit of the same name keeps yours), and *Fill in missing values*. A second window lists what the file has before anything changes. GM only.

Save writes templates and kits only. A file you make yourself (or get from your group) may also carry **actors**: vehicles and drones, NPCs (with their data, or as stat-block text), critters and spirits.

### Example

```json
{
  "format": "sr2e-catalogue",
  "version": 2,
  "systemVersion": "0.93.2",
  "exportedAt": "2026-11-25T12:00:00.000Z",
  "templates": [
    { "id": "w-exampleid01", "type": "gear", "name": "Example Torch",
      "system": { "cost": 20, "availability": "2/24 hrs" }, "shop": true }
  ],
  "kits": [
    { "id": "kit-example1", "name": "Example Kit", "notes": "", "lines": [
      { "type": "gear", "name": "Example Torch", "system": { "cost": 20, "quantity": 2 }, "amount": 2 }
    ] }
  ],
  "actors": [
    { "type": "vehicle", "name": "Example Van", "system": { "category": "truck", "speed": 20 }, "items": [] },
    { "type": "npc", "name": "Example Guard",
      "statBlock": "B Q S C I W E M R\n3 3 3 2 2 2 6 - 2\nSkills: Firearms 3" }
  ]
}
```

### Fields

| Field | Required | Meaning |
|---|---|---|
| `format` | yes | Must be `"sr2e-catalogue"`. |
| `version` | yes | `1` (templates and kits) or `2` (adds `actors`). A higher number: *Catalogue version N is from a newer version of the system.* |
| `systemVersion`, `exportedAt` | no | Written on save (the system version; an ISO date). Not read. |
| `templates` | no | A list of `{ id, type, name, system, shop? }`. `type` is one of the eleven item types of [section 1](#type-cells) (`skill`, `weapon`, `armor`, `gear`, `cyberware`, `spell`, `power`, `focus`, `adeptpower`, `cyberdeck`, `program`); `name` is not empty; `system` is an object (the item's data, field names as in the tables). `id` is kept when it is free. `shop: true` is the GM's *in the shop* mark. |
| `kits` | no | A list of starter kits ([section 8](#8-starter-kits)). Each needs a `name` and a `lines` list. |
| `actors` | no (v2) | A list of `{ type, name, system?, items?, statBlock?, critter? }`. `type` is `npc`, `vehicle` or `spirit` (never player characters). `system` is an object (default `{}`). `items` is a list of `{ type, name, system }` as templates are. `statBlock` (NPCs only) is text in the [character write-up](#4-character-write-up-import) format. `critter: true` marks an animal (no metatype). |

### What loading does

- **Templates and kits** are merged by type and name (kits by name) with the chosen mode. Kit lines are cleaned as in [section 8](#8-starter-kits).
- **New actors** go into the actor folder *Catalogue (SR2e)* (made when missing), each in a subfolder: vehicles by category, drones (`system.drone: true`) by category, spirits by kind (elementals, nature spirits, other), critters, NPCs. Actors left at the top of that folder by earlier loads are sorted too (also `game.sr2e.api.sortCatalogue()`).
- An NPC with a `statBlock` is made empty and then filled by the character import; its `items` are added after it, unless the import already gave it an item of that type and name. If the import fails, the NPC is removed again.
- An item an actor of that type can't carry (cyberware on a vehicle, for example) is left out and reported.
- **An actor already in the world** (same type and name, case and spacing ignored) is never replaced or changed. With *Fill in missing values*, its items that the file also lists get missing values.
- **Fill in missing values** (on by default): world items, and items on world actors, with the same type and name as a template in the file get the file's value for a field only where the item still holds the empty default (blank text, 0 or an empty list) and the file's value has the same shape. Only descriptive fields are filled (cost, Availability, damage, ranges, modes, Essence…). Never filled: quantity, ammo, rating, level, force and other per-copy values; set-up choices (scope, silencer, recoil compensation, smartlink level, reflexes, concealability, attribute bonuses and similar); on/off states; links and times.
- Problems are listed after loading (the first 5 as notifications, all of them in the console as `sr2e | catalogue load:`).

### Limits

| Limit | Value |
|---|---|
| File size | 30,000,000 characters (*That file is too large for a catalogue.*) |
| Templates per file | 20,000 (the rest are left out and reported) |
| Actors per file | 5,000 |
| Items per actor | 500 |
| One stat block | 20,000 characters |
| Two actors with the same type and name in one file | the first is kept |

Messages for bad entries name the entry: *Template 3 ("…"): unknown item type "…".*, *no name.*, *no system data.*, *Kit 2: needs a name and a list of lines.*, *Actor 1 ("…"): unknown actor type … (npc, vehicle or spirit).*, *only an NPC can have a stat block.*, *"templates" is not a list.*, *Not valid JSON: …*, *Not a catalogue file (format should be "sr2e-catalogue").*

---

## 4. Character write-up import

Source: `src/module/rules/charimport.ts` (`parseCharacterSheet`, `characterImportPlan`), `src/module/rules/statblock.ts` (skills, cyberware, spells and powers entries), `src/module/applications/catalogue.ts` (`importCharacter`).

**Where:**

- A character's **Bio** tab: **Import a stat block…** (shown while the character has no creation record). Fills that character.
- GM panel, **Setup**: **New character from a stat block…** makes a new character (named from the text, else *Imported character*) and fills it; a failed import removes it again. The GM can tick *record it as the character's creation*.
- `game.sr2e.api.importCharacter(actor, text)` returns `{ lines, warnings }` (the summary and the warnings), or throws.
- Catalogue files: an NPC's `statBlock` ([section 3](#3-catalogue-file-json)).

The window previews the summary and warnings 200 ms after you stop typing.

**Who may:** the actor's owner. A player can't import into a character whose creation is finished (*…'s creation is finished: ask the GM to import into it.*) or while the approval queue is on (*The approval queue is on: ask the GM to import it.*). The GM always can.

### Example

```
Name: Sample Runner
Metatype: Ork
Archetype: Street samurai

B  Q  S  C  I  W  E    M  R
5  4  5  2  3  3  5.5  -  3

Skills: Firearms 5 (Pistols 7), Unarmed Combat 3, Stealth 2
Knowledge: Street Gangs 3
Language: English 3 (native), Spanish 1
Cyberware: Smartlink, Dermal Plating 1
Gear: Example Pistol (7M, SA, 12 (c)), Armor vest 4/2, 2x Medkit 3, Rope x2
Contacts: Sample Fixer (Fixer, level 2), Sample Doc - Street doc
Edges: Example Edge +2
Flaws: Example Flaw -2
Nuyen: 1,500¥
Karma: 3 (total 10)
Lifestyle: Low (2 months)
Notes: Invented for the example.
```

### Line shapes

Labels are matched ignoring case; `Label: value` or `Label = value`. A list section runs until a blank line or the next known label; its entries are split on commas and semicolons outside brackets, or one per line (a line ending in `,`, inside open brackets, or starting in lower case continues the entry before it; `-`, `*`, `•` bullets are dropped). Several labels may share a line when separated by two or more spaces, a tab or `|` (`Name: X    Metatype: Elf`). Lines of only `---`, `===`, `***` and the like are skipped.

| Section | Labels | Entries |
|---|---|---|
| Name | `Name`, `Character name`; `Street name`, `Alias`, `Handle`, `AKA`, `Runner name`; `Real name`, `Legal name`, `Full name`; `Player`, `Player name` | The street name wins as the actor's name; real name, player and archetype go to the notes. An unlabelled first line is the name, perhaps with `— Elf Street Samurai` after it. |
| Metatype | `Metatype`, `Race`, `Metarace`, `Species`, `Metavariant` (also without a colon) | human, elf, dwarf, ork (orc), troll, and a house-rule metatype by id or label. Metavariants are imported as their base metatype, with a warning. |
| Archetype | `Archetype`, `Role`, `Concept`, `Occupation`, `Profession`, `Type` | Notes; may also give the tradition. |
| Attributes | A header row of at least four of `B Q S C I W` with only `B Q S C I W E M R A Armor` tokens, values on the next line; or lines like `Body 5`, `Quickness: 4 (6)`, `Str 3`, `Essence 5.2`, `Magic 6`, `Reaction 4 (8)`, `Initiative 4 + 1D6` (also `Bod`, `Qui`, `Cha`, `Int`, `Wil`, `WP`, `Ess`, `Mag`, `Rea`, `Init`) | `4 (6)` or `4/6` is natural (augmented). In the header row `-` is none; `Armor` is `5/3`. |
| Active skills | `Skills`, `Skill`, `Active skills`, `Active` | `Name rating`, `Name rating (specialization rating)`, `Name (specialization) rating`. |
| Knowledge | `Knowledge`, `Knowledge skills` | As skills (linked to Intelligence). `(K)` / `[K]` marks are dropped. |
| Languages | `Language`, `Languages`, `Language skills` | As skills. `native`, `(native)`, `(N)` or a trailing ` N` marks the native language; with no rating it takes Intelligence. `R/W` ratings are dropped (worked out by the system), with a warning. |
| Build/Repair | `Build/Repair`, `B/R`, `Build & repair`, `Build and repair` (+ `skills`) | As skills, named `… B/R`. |
| Cyberware | `Cyberware`, `Cyber`, `Implants`, `Augmentations`, `Cyberware/Bioware` | `Name`, `Name rating`, grade before or after (`Alpha …`, `… beta`, `[Delta]`), and in brackets `Essence 0.5` / `0.5 E`, `Body Index 1` / `BI 1`, `Rating 2`. A missing Essence cost is guessed and the guess is listed. |
| Bioware | `Bioware` | As cyberware (Body Index). |
| Spells | `Spells`, `Spell`, `Spells known` | `Name Force`, with `[Drain +1 S]`, `Exclusive`, `Fetish`, a damage level `S` in brackets. A spell the system doesn't know is guessed from its name (warned). |
| Adept powers | `Powers`, `Adept powers`, `Physical adept powers` | `Name level`, `Name (option) level`, `Killing Hands (S)`. |
| Gear | `Gear`, `Equipment`, `Weapon(s)`, `Possessions`, `Other gear`, `Cyberdeck(s)`, `Electronics`, `Vehicle(s)`, `Items` | A weapon is an entry with a damage code: `(STR+2)M`, or `9M` (after a bare number the level must be capital, so `Rope 100m` is not a weapon), with firing modes `SA/BF`, ammo `15 (c)` / `15 rounds` / `clip 15`, `smart`. Armor is a name with `5/3`. A focus is a name with "focus". A cyberdeck entry is plain gear (warned: make a cyberdeck item). Quantity: `2x Name`, `Name x2`, `Name (x2)`, `Name (qty 2)`, `2 Name`. Rating: `Name 3`, `Name Rating 3`, `Name R3`, `(Rating 3)`. |
| Armor | `Armor`, `Armour`, `Worn armor` | As gear; every entry is armor (no B/I given: 0/0, warned). |
| Foci | `Foci`, `Focus`, `Focuses` | `Power focus 2`, `Spell focus (Combat) 3`; type spell, sustaining, spirit, power or weapon (unknown: spell, warned); no rating: 1 (warned). |
| Contacts | `Contact`, `Contacts` | `Name (role, level 2, loyalty 3)`, `Name - role`, `Name: role`, `Name / role`; levels `level`/`lvl`/`lv`/`l`/`rating`/`r` + number, a bare number, or the words `contact` 1, `buddy` 2, `friend` / `friend for life` 3. |
| Edges and flaws | `Edges`, `Edge`, `Flaws`, `Flaw`, `Edges and flaws`, `Qualities` | `Name +2`, `Name -2`, `Name (2 pts)`, `Edge: Name`, `Flaw: Name`. Without a sign or section, a name that looks like a flaw is a flaw, else an edge (warned). No points: 1 (warned). `none`, `n/a`, `-` are skipped. |
| Nuyen | `Nuyen`, `Cash`, `Money`, `Funds`, `Credstick`, `Credit`, `Nuyen left`, `Savings`, `Resources left` (also without a colon) | `12,500¥`, `¥12.500`, `12 500 nuyen`, `12.5k`, `1.2m`. |
| Karma | `Karma`, `Good Karma`, `Karma Pool`, `Total Karma`, `Career Karma`, `Unspent Karma` (also without a colon) | `5`, `5/23` (good/total), `5 (total 23)`, `Pool 2`. |
| Lifestyle | `Lifestyle` | `Street`, `Squatter`, `Low`, `Middle`, `High`, `Luxury`, with `(2 months)` or `1 year` prepaid. |
| Magic | `Tradition`, `Magic type`, `Path`; `Totem`, `Mentor`, `Patron`; `Initiate grade`, `Grade`, `Initiation` | Tradition words: hermetic, shamanic, adept, sorcerer, conjurer, shamanist, elementalist, toxic, insect, none. A totem with a known totem fills its modifiers. |
| Reputation | `Street Cred`, `Notoriety`, `Public Awareness` | A number. |
| Biography | `Background`, `Biography`, `Bio`, `History`, `Description`, `Appearance`, `Personality`, `Story`; `Age`, `Sex`, `Gender`, `Height`, `Weight`, `Hair`, `Eyes`, `Skin`, `Ethnicity`, `Nationality` | Free text, added to the biography. |
| Notes | `Notes`, `Note`, `Comments`, `Misc`, `GM notes` | Free text, added to the notes. |
| Ignored | `Dice pools`, `Combat Pool`, `Spell Pool`, `Hacking Pool`, `Control Pool`, `Task Pool`, `Astral Pool`, `Magic Pool`, `Condition monitor`, `Movement`, `Threat rating`, `Professional rating` | Worked out by the system (warned). |

Any other line: *Line not recognised: "…"*, and it is kept in the notes under a "not imported" heading.

### What it changes

- Name (and the token's name), metatype, attributes (the natural rating; the augmented one as a modifier, less what the imported cyberware, bioware and adept powers add), Essence, Magic, Reaction, initiative dice (1 to 5), tradition, totem, initiate grade (0 to 20), nuyen, Karma (good, career, pool), lifestyle (prepaid 0 to 120 months), reputation, contacts (level 1 to 3, loyalty 1 to 6), edges and flaws (0 to 10 points).
- Items: skills, weapons, armor, gear, foci, cyberware, bioware, spells and adept powers. An item on the sheet with the same type and name (case and spacing ignored) is updated; others are added.
- Biography and notes are added to, not replaced.

**Limits:** 100,000 characters; a line over 10,000 characters is cut (both warned).

---

## 5. NPC stat block import

Source: `src/module/rules/statblock.ts` (`parseStatBlock`), `src/module/applications/sheets.ts` (the NPC sheet's button), `src/module/documents/index.ts` (`applyStatBlock`).

**Where:** an NPC sheet's **Import** button (*Import a stat block*). Existing attributes are overwritten; items with the same name are updated.

```
B  Q  S  C  I  W  E  M  R  Armor
4  4  4  2  3  3  6  -  4  4/2
Initiative: 4 + 1D6
Karma Pool/Professional Rating: 1/2
Skills: Firearms 4, Unarmed Combat 3
Gear: Example Pistol [7M]
Cyberware: Smartlink
```

| Line | Shape |
|---|---|
| Header row | At least four of `B Q S C I W`, any of `E M R A Armor`; the values on the next non-empty line. A value is `4` or `4 (6)`; `-` is none; Armor is `4/2`. Without it: a warning, the rest still reads. |
| `Initiative` | `7 + 2D6` (the dice are read). |
| `Karma Pool/Professional Rating` | `1/3`; or `Karma Pool 1`, `Professional Rating 3` alone. |
| `Skills:` | `Name rating`, `Name rating (specialization)`, `Name (specialization) rating`. |
| `Gear:`, `Weapons:`, `Equipment:`, `Attacks:` | A weapon is `Name [code]` or `Name (code)` with `9M`, `6S Stun`, `(STR+2)M`, `Reach 1`. Other entries are not read here. |
| `Cyberware:`, `Bioware:`, `Spells:`, `Powers:`, `Critter Powers:`, `Adept Powers:`, `Weaknesses:` | As in the character write-up. A plain `Powers:` list is adept powers for an NPC with Magic and no Sorcery or Conjuring. |

**Limits:** 100,000 characters.

---

## 6. New entry: "Paste the stat line"

Source: `src/module/rules/newentry.ts` (`parseStatLine`, `buildEntry`), `src/module/applications/newentry.ts`.

**Where:** **New entry…** in the shop (the Add window), the SR2e tools window and the GM panel's **Setup** tab. Pick the **Kind**, paste one line into *Paste the stat line* and press **Read it**: the fields fill in, with lists of what was read and of the words that were not read. The pasted line is not kept; words it doesn't know are never stored. The GM saves the entry as a world template (or a vehicle actor in *Catalogue (SR2e)*) and/or gives it to a character; a player sends it to the GM as a request.

### Example

Kind *Weapon*:

```
Example Pistol 7M SA 12(c) 6 2 400 1 4/48 hrs
```

Read: name *Example Pistol*, Availability `4/48 hrs`, Ammo `12(c)`, Damage `7M`, Modes `SA`, then the bare numbers in order: Concealability 6, Weight 2, Cost 400, Street Index 1.

Kind *Vehicle*: `Example Car 4/8 30 10 3 0 2 1 1 20000 1` reads Handling 4/8, Speed 30, Accel 10, Body 3, Armor 0, Signature 2, Autonav 1, Sensor 1, Cost 20000, Street Index 1.

### How a line is read

1. The line is made one line: tabs, `|`, `;` and line breaks become spaces.
2. **Labelled values** first: a field's label, then an optional `:` or `=`, then a value of that field's shape (`Cost 450`, `Conceal: 5`, `SI .75`, `Damage 6M`, `Essence 0.2`, `BI 0.4`, `Avail 4/48 hrs`, `TN 4`, `Ammo 15(c)`, `Persona 3/3/3/3`, `Handling 4/8`). Labels are the field's name, its other headers (section 1 tables), and a few more (`street index`, `body index`, `i/o speed`, `active memory`, `storage memory`, `response increase`).
3. **Codes by their shape:** Availability (`4/48 hrs`, `6/14 days`, `3/1 wk`, `2/1 mo`, `8/4-6 days`, `Always`); ammo `15(c)` (c, b, cy, m, bk or the words); drain `(F/2)+1S`, `[F/2 - 1]M`; damage `9M`, `(STR+2)M`, `6S Stun` (not for spells: give a spell's damage level as `Damage M`); firing modes `SS`, `SA`, `BF`, `FA` joined by `/` (capitals); four numbers `a/b/c/d` (range bands, or a deck's persona); Handling `4/8`; a cost with `¥` or `nuyen`, or with thousands commas (`1,500`); armor `4/2` (Ballistic/Impact); a program's size `12 Mp`.
4. **Words for a choice:** spell category (Combat, Detection, Health, Illusion, Manipulation), range (LOS, Touch), duration (Instant, Sustained, Permanent), spell type (Mana, Physical), grade (Alphaware, Betaware, Deltaware), legality (Legal, Restricted, Forbidden, Permit), focus type (Spell, Sustaining, Spirit, Power, Weapon: from the name, "Power focus"), and a program's utility kind from its name.
5. **The name:** the words before the first number or code (at most 6 words, 60 characters).
6. **Bare numbers** fill the kind's remaining fields in the book-table order below. With fewer numbers than fields, a last number between 0 and 5 is the Street Index, the one before it the Cost, and the rest fill from the front. Numbers left over are listed as not read.

A Strength damage code makes the weapon melee; its bare numbers are then Concealability, Reach, Weight, Cost, Street Index.

| Kind | Fields on the form | Bare numbers, in order |
|---|---|---|
| Weapon | skill, specialization, melee, Damage, modes, Ammo, reach, Range, recoilComp, concealability, weight, availability, cost, streetIndex, legality | concealability, weight, cost, streetIndex |
| Armor | ballistic, impact, adds, concealability, weight, availability, cost, streetIndex, legality | concealability, ballistic, impact, weight, cost, streetIndex |
| Gear | quantity, concealability, weight, availability, cost, streetIndex, legality | concealability, weight, cost, streetIndex |
| Cyberware | essenceCost, rating, grade, concealability, availability, cost, streetIndex, legality | essenceCost, cost, streetIndex |
| Bioware (cyberware marked bioware) | bodyIndex, rating, bioKind, cultured, availability, cost, streetIndex, legality | bodyIndex, cost, streetIndex |
| Spell | category, spellType, duration, range, area, Damage (level), Drain, targetNumber, resist | none |
| Adept power | cost (power points), level, skill, skillDice | cost |
| Focus | focusType, rating, category, target, availability, cost, streetIndex, legality | rating, cost, streetIndex |
| Program | kind, rating, size, damageLevel, availability, cost, streetIndex, legality | rating, size, cost, streetIndex |
| Cyberdeck | mpcp, Persona, hardening, activeMemory, storageMemory, ioSpeed, responseIncrease, availability, cost, streetIndex, legality | mpcp, hardening, activeMemory, storageMemory, ioSpeed, responseIncrease, cost, streetIndex |
| Vehicle | category, Handling, speed, accel, body, armor, signature, autonav, sensor, seating, load, availability, cost, streetIndex, legality | Handling, speed, accel, body, armor, signature, autonav, sensor, cost, streetIndex |
| Drone | as Vehicle, with pilot in place of autonav, no seating | Handling, speed, accel, body, armor, signature, pilot, sensor, cost, streetIndex |

The fields' values follow the section 1 tables (the same columns and shorthands). The vehicle and drone fields, which are not a catalogue item type:

| Field | Other headers | Value |
|---|---|---|
| `category` | class, vehicletype, kind | choice: car, bike, truck, hovercraft, boat, ship, rotor, fixedWing, vectorThrust, lta, other; also rotorcraft→rotor, fixedwingaircraft→fixedWing, vectoredthrust→vectorThrust, lighterthanair→lta |
| `drone` | isdrone, remote | boolean |
| `handling` | hand, hdl | integer (min 0) |
| `handlingOffroad` | offroad, offroadhandling | integer (min 0) |
| `speed` | spd, cruise | integer (min 0) |
| `accel` | acceleration, acc | integer (min 0) |
| `body` | bod | integer (min 0) |
| `armor` | armour, arm | integer (min 0) |
| `signature` | sig | integer (min 0) |
| `autonav` | nav, autopilot | integer (min 0) |
| `pilot` | pil, dronepilot | integer (min 0) |
| `sensor` | sensors, sen | integer (min 0) |
| `seating` | seats | string |
| `load` | cargoload, loadkg | number (min 0) |
| `cost` | price, nuyen, yen, costnuyen, pricenuyen | integer (min 0) |
| `availability` | avail, availability, availabilitytn | string |
| `streetIndex` | streetindex, si, index, street | number (min 0) |
| `legality` | legal, law, legalstatus | choice: (blank), legal, permit, restricted, forbidden; also notset→(blank), needsapermit→permit |
| `permit` | haspermit, permitheld | boolean |

- **Handling** (handling, hand) fills handling, handlingOffroad. Handling, on-road/off-road, e.g. "4/8" (one number: both the same).

**Limits:** the stat line 400 characters (*That is more than a stat line…*), the name 80, each field's value 100, the description 2,000 (kept as plain text, escaped, blank lines as paragraphs). A value a field can't read is named before saving: *…: "…" can't be read.* Without a name: *It needs a name.*

---

## 7. Item templates in a world compendium

Source: `src/module/applications/qol.ts` (`exportTemplatesToCompendium`, `importTemplatesFromCompendium`, `promptImportTemplates`).

**Where:** GM panel, **Setup**: **Templates to a compendium** and **Templates from a compendium…**; from a macro `game.sr2e.api.exportTemplates()` and `game.sr2e.api.importTemplates()` (the second opens the compendium picker). GM only.

### Export

- The pack: a world **Item** compendium named `sr2e-item-templates` (collection `world.sr2e-item-templates`), label *SR2e item templates*. It is made when missing. A locked pack is unlocked for the write and locked again.
- One Item document per world template:

  ```json
  {
    "name": "Example Torch",
    "type": "gear",
    "system": { "cost": 20, "availability": "2/24 hrs" },
    "flags": { "shadowrun2e_unified": { "templateId": "w-exampleid01" } }
  }
  ```

- A document with the same name and type already in the pack is updated; others are created. Two templates with the same type and name: one document (the later one).
- Returns how many templates were written (0 when there are none: *No world item templates to export (save one from an item sheet first).*).

### Import

- Any Item compendium (world, system or module), picked in a list.
- Each document becomes a world template `{ id, type, name, system }`. Documents of a type this system doesn't have are skipped. These fields are dropped from `system`: `description`, `notes`, `installed`, `worn`, `active`, `bonded`, `loaded`, `erased`, `jammed`, `damaged`, `degraded`. Flags are not read.
- A template with exactly the same type and name (here case matters) is replaced and keeps its id and its *in the shop* mark; others get a new id `w-<random>`.
- Returns how many documents were taken in.

---

## 8. Starter kits

Source: `src/module/rules/setup.ts` (`StarterKit`, `normalizeKit`, `normalizeKitLine`, `mergeKits`), `src/module/applications/setup.ts` (`kits`, `saveKits`), `src/module/sr2e-system.ts` (the API).

**Where:** GM panel, **Setup**, *Starter kits*: make one from a sheet or empty, drop items on it, edit it, give it to actors. Players pick kits on the Add window's **Kits** tab. Kits travel in catalogue files ([section 3](#3-catalogue-file-json)). From a macro: `game.sr2e.api.kits()` (the list) and `game.sr2e.api.giveKit(kitIdOrName, actors, { ready })` (GM; `ready` defaults to true; lines an actor can't hold are skipped; returns how many actors got something).

Stored in the world setting `starterKits` as a list:

```json
[
  {
    "id": "kit-example1",
    "name": "Example Kit",
    "notes": "For new runners.",
    "lines": [
      { "type": "weapon", "name": "Example Pistol", "system": { "damagePower": 7, "damageLevel": "M", "cost": 400 }, "amount": 1 },
      { "type": "gear", "name": "Example Torch", "system": { "cost": 20, "quantity": 2 }, "amount": 2 }
    ]
  }
]
```

| Field | Meaning |
|---|---|
| `id` | Text. Made when missing. |
| `name` | Required (a kit without one is dropped). Kits are matched by name, ignoring case, when a catalogue file is loaded. |
| `notes` | Text. |
| `lines` | At most 60. A line needs `type` and `name` (else it is dropped). |
| `lines[].system` | The item's data. These state fields are always removed: `installed`, `worn`, `active`, `bonded`, `loaded`, `loading`, `erased`, `jammed`, `damaged`, `degraded`, `arrived`, `sustained`, `equipped` (the giver chooses whether things arrive ready). |
| `lines[].amount` | For gear its quantity, for a spell its Force, for an adept power its level, for a focus, program or critter power its rating (1 to 999; default the item's own value); for every other type the number of copies (1 to 20; default 1). |

---

## 9. World settings worth backing up

Source: `src/module/settings.ts`, `src/module/migrations.ts`, `src/module/applications/setup.ts`, `src/module/applications/catalogue.ts`, `src/module/rules/skills.ts`.

Foundry's own world backup (setup screen: **Worlds**, then **Backups**) keeps all of these. To carry the catalogue to another world, use a catalogue file ([section 3](#3-catalogue-file-json)): it holds the templates and kits. World settings are stored under `shadowrun2e_unified.<key>` (`sr2e.<key>` in worlds from before v0.93.1, copied across when the world is moved: `docs/MOVING.md`). In a macro or the console, read one with `game.settings.get(game.system.id, 'itemTemplates')`.

| Key | Shape | What it holds |
|---|---|---|
| `itemTemplates` | list of `{ id, type, name, system, shop? }` | The world item templates (the catalogue). `shop: true` is the *in the shop* mark. |
| `starterKits` | list of kits ([section 8](#8-starter-kits)) | The starter kits. |
| `houseRules` | `{ "values": { path: value }, "advanced": { path: value } }` | The house rules. Keys are rule paths (dotted, as in `game.sr2e.api.rules`); `values` are the rows of the house-rules window, `advanced` its *Advanced* box (a JSON object). A path that isn't a rule, or a value of the wrong kind, is ignored and reported to the GM (*SR2e: house rules not applied*). Default `{ "values": {}, "advanced": {} }`. |
| `rulesSource` | text: `book` or `urr` | The rules source (Configure Settings). |
| `skillWeb` | text, one link per line | The Skill Web: `Skill A - Skill B: 2` (also `–`, `—`, `<->`; `>` for one way; the `: steps` part defaults to 1; `#` starts a comment). |
| `sessionChecklist` | `{ start: [...], end: [...], session, startedAt }` | The GM panel's session checklist; each line `{ id, text, action, done }` (at most 40 per list). |
| `tokenSetup` | `{ link, bars, vision, show, disposition }` | The one-click token setup's choices. `show`: `owner-hover`, `owner`, `always`, `hover`; `disposition`: `auto`, `friendly`, `neutral`, `hostile`. |
| `scenePresets`, `sceneTemplates`, `encounterNotes`, `magicGroups`, `vehicleOrders` | lists and objects | GM panel scene presets, Scene builder templates, per-scene encounter notes, magical groups, vehicle orders. Written by their windows; edit them there. |
| `migrationVersion` | text | The last update step that ran on this world. Don't change it. |
| `ignoreForeignWorld` | yes/no, default no | Lets SR2e update a world that looks like another Shadowrun 2e system's (see `docs/TROUBLESHOOTING.md`). |

Each player's own choices (theme, text size, layout, sounds, roll privacy and the like) are client settings, kept in that player's browser, not in the world.
