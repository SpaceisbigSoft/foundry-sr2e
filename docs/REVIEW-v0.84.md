# v0.84.0 review: the one-file data import

Two independent reviews over the diff against v0.83.0, plus a live dry run of every entry of the owner's catalogue file against the data models (no writes) and a real load of a ZZ subset through the dialog. Rules values are unchanged.

## Found by the data check

- **No focus could be created (since v0.78.0).** The focus `size` field (a choice with a blank default) refused its own default in Foundry v14, so `Item.create` silently returned nothing. Fixed (`blank: true`); a source scan in `v084.test.ts` keeps any choice field with a blank default allowing blank.

## First review: 3 bugs, 12 risks

| # | Finding | Fix |
|---|---|---|
| 1 | "Fill in missing values" treated any model default as missing, so it overwrote real values: a skill at rating 1, an emptied gun, `installed: true`, attributes at 3, metatype human. | A field is missing only when its default is empty (`''`, 0, `[]`) and it still holds that. Booleans and per-copy fields (quantity, ammo, rating, level, force, heat…) are never filled. |
| 2 | A scalar or list aimed at a group of fields replaced it; refused updates were batched with good ones and still counted. | Same-shape check. Each patch is validated (`doc.validate({changes, clean, strict})`) before sending; refusals go to the errors, and counts include only what was sent. |
| 3 | A stat block's Name line renamed the NPC, so loading the file again made a duplicate. | The catalogue name is put back after the import. |
| risks | Duplicates within one file; items an actor type can't carry; the preview miscounting stat-block NPCs; a failed extra-items create deleting a good NPC; the folder made when nothing is created; file size checked only after reading; no entry caps; the portrait lookup on a deleted actor. | All fixed: the first entry wins, `itemTypeProblem` filters, `actorsKept`, the NPC is kept, the folder is made only when needed, `file.size` is checked first, `MAX_CATALOGUE_ENTRIES`, and the timer checks and catches. |

## Second review (of the fixes)

- **Still overwriting real values** through empty defaults that mean "none" or are per-copy setup: silencer, scope, gyro, recoil compensation, mounts, Concealability 0, smartlink level, reflexes, bonuses, links (`…Id`, `…Uuid`, `housedIn`), planted state. Existing NPCs and vehicles also had links, timestamps, damage and money with empty defaults.
- **Fix:** an allow-list. Only an item type's own catalogue columns (`fillablePaths`) are filled, less `FILL_NEVER`, `FILL_SETUP` and anything that is a link or a time. An actor already in the world is never changed itself; only its matching items are filled.
- **Portrait timer:** a rejection after the await is now caught.

## Known limits

- Values whose model default is a real value (a weapon's 6M damage code and 5/20/40/60 ranges, Street Index 1) are never filled. A world item still showing them keeps them.
- Loading 101 stat-block NPCs takes a few minutes, with a progress notice every 25.
- About 1,060 templates sit in one world setting.
- The export (Save a catalogue file) writes templates and kits, not actors.
