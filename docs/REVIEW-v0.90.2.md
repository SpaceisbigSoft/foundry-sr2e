# v0.90.2 review: the catalogue sorts itself

The owner asked (25 Oct 2026) for their "Sort Catalogue Folder" macro to run automatically when a catalogue is imported. It is now built in.

## What changed

- **Loading a catalogue file** (GM panel, Setup, Item catalogue) puts each new actor straight into its subfolder of *Catalogue (SR2e)*, the stat-block NPCs too:
  - Vehicles / Cars, Trucks & Vans …; Drones / Rotor Drones …;
  - Spirits / Elementals, Nature Spirits, Other Spirits;
  - Critters; NPCs; Other.
  
  The folder names are the macro's own (`SR2E.App.Catalogue.folder.*`). The path comes from the actor as it will be made: a vehicle with no category is a car, a spirit with no kind a nature spirit.
- **After every load** (and with `game.sr2e.api.sortCatalogue()`, which gives the macro's notices), actors sitting directly in *Catalogue (SR2e)*, or directly in its Drones folder (the macro's first version), move into their subfolder. Anything moved elsewhere by hand stays; only the folder changes; GM only; one sort at a time.
- Folders are made sorted by name and flagged with their id. They're found by that flag, then by their name in this language, then by the English name (Foundry's fallback language). So the folders the macro already made are reused, and a translated world makes no second set.
- **Pure parts:** `catalogueFolderPath` and `CATALOGUE_FOLDER_NAMES` (rules/catalogcsv.ts). **Foundry parts:** `catalogueSubfolder`, `sortCatalogueFolder` and `sortCatalogueWithNotice` (applications/catalogue.ts).
- The guide's Setup topic and the changelog say so.

## Checking the output

3,346 tests (3,342 pass, 4 skipped), tsc clean. The new `v0902.test.ts` checks:
- each kind of actor's path, matching the macro;
- every folder id has a name;
- the loader's and the sort's code paths;
- the review fixes.

## The independent review

| # | Kind | Finding | Outcome |
|---|---|---|---|
| F1 | Bug | The path used the file's raw data: a vehicle with no category (made as a car) went to Other Vehicles, and a spirit with no kind to Other Spirits | Fixed: the path from the actor as made (Foundry's defaults); checked live |
| F2 | Risk | The load found the root folder at any depth, the sort only at the top level | Fixed: one lookup (top-level first) |
| F3 | Risk | A failed folder creation was retried and reported once per actor | Fixed: remembered for the run |
| F4 | Risk | The sort also emptied actors put directly in Vehicles or Spirits on purpose | Fixed: only the root and its Drones folder, as the macro did |
| F5 | Risk | A failed batch move escaped the load and hid its summary | Fixed: caught and reported |
| F6 | Risk | Folders found by translated name only (a second set in another language) | Fixed: a flag on each folder, then this language's name, then English |
| F7 | Risk (low) | Two overlapping sorts could make duplicate folders | Fixed: one sort at a time |
| F8 | Risk (low) | Status-icon sync runs once per moved actor | Kept: it writes nothing unless already out of step |
| F9 | Nit | The API sort gave no notice (the macro did) | Fixed: notices for not-GM, no folder, the count, errors |
| F10 | Nit | The tests only read source | The pure path is run by the tests; the Foundry part was checked live |

## Checked live (25 Oct 2026, GM AI, a test world with no catalogue folder)

- A test *Catalogue (SR2e)* folder with seven ZZ actors was sorted (7 moved):
  - a car to Vehicles / Cars, and a vehicle with no category to Cars too;
  - a rotor drone to Drones / Rotor Drones;
  - an elemental to Spirits / Elementals, and a spirit with no kind to Nature Spirits;
  - a critter to Critters, a ganger to NPCs.
- Every new folder was flagged and sorted by name. A second sort moved nothing.
- A "Boats & Ships" folder made by hand, like the macro's, was reused for a ZZ boat.
- The ZZ actors and all 11 test folders were deleted afterwards.
