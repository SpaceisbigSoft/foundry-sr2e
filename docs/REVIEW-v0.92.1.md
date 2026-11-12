# v0.92.1 — the flexible record sheet: review and live run

The owner's choices (2 and 12 Nov 2026), after a friend's view on character builders ("automated systems struggle with bespoke tweaks: favour a quick reference library and a flexible, editable record sheet with only the derived values calculated"), and four items from the owner's feedback spreadsheet.

## What shipped

| Part | Where | Switch (RULES.SHEET_V921) |
|---|---|---|
| Custom tweaks on every item (attribute, Reaction, initiative dice, pools, skill dice/TN, damage Power, armor, note) | `rules/tweaks.ts`; derived data in `models/index.ts`; Power in `documents/index.ts` `planAttack`; item sheet rows in `applications/sheets.ts` (`itemSheetV921`, `tweaksFromForm`); Effects tab | `tweaks` |
| Carried on weapons, armor and gear | `isCarried` (rules/tweaks.ts); `SR2Item.carriedRules`; weight, armor, searches, attacks, parry weapons, medkits, scanners, patches, drugs, charges, radios, RCDs, jammers, kits, bypass tools, licences, optics, chips, stealth suits, protective gear, skill gear | `carried` |
| Accessories read from a weapon's description, with Undo | `rules/accessories.ts`; `SR2Item.readDescriptionInto` (`_preCreate`, `_preUpdate`); item sheet line and `undoDescription` | `accessories` |
| The creation wizard advises (choices not greyed out, attributes not clamped, over-budget gear added) | `applications/creation.ts`, `templates/creation-wizard.hbs`, `applications/adding.ts` | `wizard` |
| Ratings editable after creation unless the approval queue is on (the owner's choice, 12 Nov 2026) | `applications/advancement.ts` `ratingLocked`, `noteUnlockedRaises`, `tweaksRaise` | `ratingLock` |
| The reference pane beside the sheet; a dragged entry opens the shop with it ticked (the owner's choice, 12 Nov 2026) | `applications/reference.ts`, `rules/reference.ts`, `templates/reference.hbs`; `SR2CharacterSheet._onDrop` | — |
| Combat tab → Armory; Essence and price at a ware's grade; the Essence line's ware tooltip | `applications/sheets.ts` (`essenceWareLine`), templates | — |

Rules values are unchanged (VERIFY.md unchanged).

## Independent review (6 bugs, 3 risks, 3 nits): all fixed or settled

- **B1** a new tweak row counted at once (Body +1): it starts as a note now.
- **B2** changing a row's kind to skill dice kept the old key as the skill name: a row whose kind changes drops its key.
- **B3** negative tweaks could take initiative dice below 1 and Reaction below 0: floored.
- **B4** negative armor tweaks did nothing: armor tweaks only add (the value floors at 0). Known limit below.
- **B5** Carried missing in drugs, charges, parry/counterattack weapons, the armor rating, protective gear, stealth suits and shield parry: added (and they hold even if the house rule was off when something was left behind).
- **B6** a value cleared by hand was filled again: an edit reads only accessories the new description newly mentions, and a copy of a weapon already read isn't read again.
- **R7** tweaks got round the rating lock and the approval queue: while the lock holds, a player's new or stronger counting tweak is refused (notes, switching one off or removing it are fine).
- **R8** the accessory reader misfired on common phrasing ("smartgun version available", "silenced version", "smart-gun ready", "gyro-mount compatible", "a no-frills pistol with a laser sight", "can fire bursts and has a silencer", "laser designator"): the negation words and windows were reworked; every example is a test.
- **R9** over-budget gear in creation is added free as a whole basket: kept (the wizard's cash follows the Resources priority, and the build check shows the overspend).
- **N10** a Spell Pool tweak gave mundanes dice; the Power tweak missed barrier attacks: both fixed. **N11** grade names translated. **N12** accessory notes capped at the tweak limit.

## Live run (Foundry v14, GM AI and ZZ Testplayer)

- A character with tweaked ware (Quickness +1, Combat Pool +2) and gear (Firearms +2 dice): totals, pool and skill bonus right; the Effects tab lists them; the Essence tooltip reads "ZZ Wired (alpha): 1.6".
- A weapon created with "integral silencer, a laser sight and a Gas-Vent 2 system. Folding stock. No scope." filled muzzle, laser sight and recoil compensation 2, added a Folding stock note and skipped the scope; the sheet's line and Undo put it back; a later edit read only the newly mentioned shock pad.
- A tweak row added and set to damage, this weapon, +2: the attack's Power 9 → 11.
- Leaving armor, a gun and gear behind: armor off, the gun holstered and refused ("isn't carried"), the skill bonus gone, a search finds only the ware; wearing the armor again carries it.
- The reference pane: placed beside the sheet, 1,210 Catalogue entries, 61 guide topics, 12 interpretations; a dragged Heavy pistol opened the shop on Weapons with it ticked, nothing added.
- The wizard: every metatype selectable at Race E, a troll and Body 9 allowed, the totals marked ✗.
- As the player: a typed raise after creation kept with the notice (queue off); refused with the queue on; a tweak raise refused with the queue on, a new note row allowed.
- The test actors were removed; the approval queue put back off.

## Known limits

- Armor tweaks add to the body-armor part (as cyber armor does): a called shot at a gap still counts them, and they can't lower armor.
- A weapon made before v0.92.1 isn't read until its description newly mentions an accessory (editing it doesn't re-read what was there).
- "Scope (low-light, magnification 2)" gives a low-light scope at magnification 1.
- With no room beside the sheet on either side, the reference pane sits over the sheet's right edge.
- The tweak lock, like the rating lock it extends, is checked on the player's client (Foundry lets an owner write their own items).
- Exempt from Carried on purpose: programming suites, workshops and facilities, magical sites, enchanting materials, spell formulas.
