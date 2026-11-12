### Gear, cyberware and bioware

v0.92.3 book alignment (RULES.GEAR_V923, rules/config923/gear.ts; the rules in rules/gear923.ts). Each switch's first
choice is the book's way and the default; the other puts the v0.92.2 behaviour back. Under the Unified Rules Revamp
source only `armorEncumbrance` (the Revamp's own `URR_V80.cbtArmorPool`) reads as its old choice; the other switches
are book corrections the Revamp is silent on and apply under either source.

| Rule | Was | Now (book) | Source | Switch |
|---|---|---|---|---|
| Grade Essence, beta | ×0.7 | ×0.6 | SSC Custom Cyberware; Cybertechnology p. 44 | `GEAR_V923.grades` |
| Grade nuyen | alpha ×2, beta ×4, delta ×8 | ×3, ×7, ×10 | SSC; Cybertechnology p. 44 | `GEAR_V923.grades` |
| Graded Essence rounding | to the hundredth | rounded up, never below .05 | SSC; Cybertechnology p. 44 | `GEAR_V923.grades` |
| Essence 0 | dead | only below 0 kills | Core p. 246 | `GEAR_V923.essenceZero` |
| Dermal plating | ballistic and impact armor = rating | + rating to Body; stops flechette's extra level | Core pp. 93, 248 | `GEAR_V923.dermal` |
| Pairs of cyberlimbs | nothing | each full pair (arms, legs) +1 Body as dermal armor | Core p. 249; Cybertechnology p. 49 | `GEAR_V923.limbPairs` |
| Ware housed in a cyberlimb | no Essence (limb capacity) | full Essence except fingertip compartment, spurs, razors 0; smartlink, orientation system .25; tactical computer −25% | Cybertechnology p. 49 | `GEAR_V923.limbHoused` |
| Bone lacing | +1/+2/+3 Body dice on damage resistance | plastic +1 Body; aluminum +1 Body, +1 impact; titanium +2 Body, +1 impact, +1 ballistic; 3 cyber replacements −1 armor, more none | Shadowtech p. 42; Cybertechnology pp. 49–50 | `GEAR_V923.boneLacing` |
| Muscle augmentation | +R Strength | +R Quickness and Strength (Quickness raises Reaction) | Shadowtech p. 35 | `GEAR_V923.bioware` |
| Adrenal pump | +R Qui/Str/Wil | also +2R Reaction; its Quickness doesn't raise Reaction | Shadowtech p. 19 | `GEAR_V923.bioware` |
| Cerebral booster 2 | +2 Int | also a Task Pool die | Shadowtech p. 23 | `GEAR_V923.bioware` |
| Orthoskin | impact R, ballistic R/2 | +1/0, +1/+1, +2/+1 | Shadowtech p. 17 | `GEAR_V923.bioware` |
| Enhanced articulation | +1 die on Body/Qui/Str skills | +1 die on every Active Skill, +1 Reaction | Shadowtech p. 34 | `GEAR_V923.bioware` |
| Pain editor | +1 Wil, +1 Perception TN | +1 Wil, −1 Int (the +4 is for tactile Perception only, not modelled) | Shadowtech p. 26 | `GEAR_V923.bioware` |
| Importer Essence / Body Cost guesses | boosted reflexes +1/+2/+3 Reaction; cyberhand .25; skillwires .2R; ingested filter R/10; encephalon .75/1.5; magnification .1/level; muscle aug .2R; cerebral .2/.4; synaptic .4/1; adrenal .25/.75; orthoskin .25/.5/.75; suprathyroid .7; mnemonic .1R; extended volume .2R; pheromones cyberware | —/+1/+2; .35 (forearm .65); .1/.2/.3 × R by band; R/5; .5/.75/1.5/1.75; .2 optical / .1 electronic flat; .8/level; .4/.8; .3/1.6; 1.25/2.5; .5/1/1.5; 1.4; .2R; .2/.3/.4; bioware, Body Cost .4/.6 | SSC p. 87; Cybertechnology p. 98; Core p. 249; FoF pp. 100–104; Shadowtech | `GEAR_V923.wareTables` |
| Bioware for the Awakened | Magic −floor(Body Index × .5) | Essence = Body Cost (Magic follows Essence) | Shadowtech p. 5 | `GEAR_V923.awakenedBioware` |
| Over the Body Index | rejection test | system shock: +1 TN per point (or part) over on Body tests | Shadowtech p. 6 | `GEAR_V923.overBodyIndex` |
| Cultured bioware | ×4 price only; neural ware warned and charged ×4 | Body Cost × .75; neural ware always cultured, price and Body Cost already count it | Shadowtech p. 6 | `GEAR_V923.cultured` |
| Adrenal pump crash | Body vs 6, M (R1) / S (R2) Stun | runs 1D6 turns per level; then Deadly Stun, Power = half the turns | Shadowtech p. 19 | `GEAR_V923.adrenalCrash` |
| Carrying | Str × 10 kg free, −1 Qui per Str × 5 kg over | Str × 5 kg free; to × 10 Light, × 15 Moderate (no running, ½ movement), × 20 Serious (¼ movement), more: passes out | Core p. 185 | `GEAR_V923.load` |
| Armor encumbrance | any armor over Quickness: −Quickness | heavy armor only (by name): −1 Combat Pool die per Ballistic point over Quickness | Core p. 84 | `GEAR_V923.armorEncumbrance` |
| Cybersurgery | Biotech vs 4 + grade; no successes: complications | Biotech vs 10 − Essence left; successes change the Essence cost +15% … −20%; always installs | Cybertechnology pp. 53–54 | `GEAR_V923.surgery` |
| Cyberware damage | Deadly only, 1d6 per item | Serious or Deadly: 1D6 − 4 / − 2 systems at random; 1D6 damage each (Moderate+ stops it, 7 destroyed); graded ware 5 dice vs 5/6, 4/5, 3/4, one success ignores it | Shadowtech p. 36; Cybertechnology p. 44 | `GEAR_V923.cyberDamage` |
| Filtration systems | + rating dice against the toxin | the toxin opposes the rating; a winning filter stops it, a failing one adds nothing | Core p. 248 | `GEAR_V923.filtration` |
| Templates | no Concealability, weight, Availability, Street Index | armor jacket, vest, clothing, helmet, form-fitting, riot shield, the named pistols, rifles, bow, knives, grenades, launchers, melee weapons, taser, datajack, smartlink, wired reflexes, dermal plating (rated 1), medkit, jammer, climbing gear: book numbers | FoF pp. 88–106; Core p. 256; SSC p. 50 | (data) |
| Lined coat | no template | 4/2, Conceal 8, 1 kg, 2/24 hrs, 700¥, SI .75 | Core p. 242 | (data) |
| Remote control deck | 50,000¥ × Rating, Rating × 2 kg | 5,000¥ × Rating, 3 kg, 4/72 hrs, SI 2 | Rigger 2 p. 97 | (data) |
| Weapon detector / cyberware scanner | 1,000¥ R4 / 1,500¥ R4 | 5,000¥ per rating (MAD) / Lone Star portable R3, 5,000¥ | NAGRL pp. 92–93; Lone Star p. 122 | (data) |

**Kept (the owner's decisions)**
- The shop and the street (`SHOP_V91`, `SHOP_V915`, `SHOP_V916`): who rolls Availability (book: the source's skill or Etiquette +2 dice, Core p. 184); the optional +1 TN per 2 rating points (Core p. 184); the street and gray market −2 TN and paying 25% more for −1 TN and −20% time (Shadowtech pp. 101–102); haggling (book: opposed Negotiation vs Willpower, 5% per net success, no cap).
- Legality, permits and fines (`GEAR_V58.legality`, `SHOP_V915`): book: number-plus-category codes (e.g. 6P-CC), permits at Availability +2 TN for 5% (possess) or 10% (possess and transport) of the price, annual; fines by category and charge (Shadowtech pp. 101–105).
- The riot shield's parry 0; the cybereye and cyberear Essence allowance; Carried and the custom tweaks (`SHEET_V921`).

**Not built**
- Shadow clinic search for alpha/beta/delta grades (a contact's Etiquette (Street) vs 12/15, corporate 11/17; SSC): needs a clinic-finding step; the graded Availability TN stays as the stand-in.
- Graded clinic fees (alpha/beta ×50, delta ×200 of the medical rates, Cybertechnology p. 44): needs a surgeon's fee in the surgery flow.
- Removal test (lower of Biotech/Cybernetics vs 10 − Essence, SSC p. 97); repair by damage level (TN 2/3/4/8, ×2 alpha, ×3 beta; time 2 × Essence hours × level): needs ware damage levels (the system keeps damaged / not damaged; Light damage's half efficiency and the Serious/Deadly TN penalties aren't modelled).
- Boosted reflexes forbidding wired reflexes and a control rig (SSC p. 87); smartlink II extras and smart goggles (FoF pp. 84–85; Core); cyberlimb base Strength 3 (troll 8) and enhancement Essence (Cybertechnology pp. 49–51); skillwires capping the total of active softs and a chip replacing the skill (Core pp. 247–249); the Skill Memory Table (Core p. 248); bioware recovery ×3 (cultured ×2) of the normal healing time (Shadowtech p. 6); the trauma damper's Physical-to-Stun shift; orthoskin and dermal plating refused together (the better still counts); the lined coat's +2 Concealability for weapons under it; NAGRL's search table and the chemical sniffer's base TN 10 by explosive carried; the police check against legality (Shadowtech p. 103).
