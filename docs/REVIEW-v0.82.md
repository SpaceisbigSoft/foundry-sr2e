# v0.82.0: player and GM documentation, complete and error-checked (24 Oct 2026)

The owner asked to "make sure the player and GM documentation is complete and error checked" before the token art. Rules values did not change; the shipped RULES and the Revamp patch dump identically to v0.81.1.

## How it was done
1. **Four auditors.** Each took one slice of the guide:
   - start and rolls, plus the README, licence, `API.md` and the help window;
   - character, gear and advancement;
   - magic, Matrix, rigging, NPCs and vehicles;
   - the GM topics, every setting, and the GM-only cards.

   They checked every sentence against the code and enumerated every button, chat-card action, setting and window for what the guide left out. They found about 47 errors, 100 gaps (36 important) and 48 other notes, among them 15 wrong or missing **?** links.
2. **Two writers** applied them, on separate files:
   - one did the guide (`rules/guide.ts`, generated to `docs/PLAYER-GUIDE.md`), the **?** links (`applications/help.ts`) and the template headings;
   - the other did the README, `API.md`, the setting hints and the small code fixes.
3. **An independent review** checked 67 claims against the code, plus privacy, style, the links, the code changes and completeness. Its findings (4 errors, 2 code bugs, 2 minor gaps) were fixed.
4. **A live check in Foundry**, as the GM and as a player:
   - every sheet shows the **Guide** button and the right **?** topics;
   - all 53 topics open with working links;
   - a player sees 43 topics and no GM ones, and a GM link shows "This part of the guide is for the GM".
5. **The topic list's group headers** were restyled at the owner's request: accent colour, a rule underneath, and the topics indented below.

## What changed for users
- **The guide now covers what it used to leave out:**
  - **Security:** the security model as players and the GM meet it (the *A card from another player* confirm, *nothing done*, the 12-prompt cap, the *Not changed* warning, the GM-queue warning, Approve's confirm and "filer not verified"), and auto-apply and auto-resist as they really work.
  - **New topic:** an Item sheets topic.
  - **Undocumented features:**
    - the tours, the SR2e Macros compendium and the players' own settings;
    - the wall config fields, the tracker's Surprise test, Rules source and Portraits by name;
    - rigging's jump-in requirements, Cover targets, the cast dialog's options;
    - the spirit, IC and barrier sheets, the vehicle's Fire and Ram.
- **About 47 corrections.** Among them:
  - roll privacy is each player's own setting;
  - the Karma Pool refreshes only by hand by default;
  - the approval queue covers every character not in the wizard;
  - the Add window's *Arrives…* box;
  - Karma-learned skills train from rating 1;
  - the Drone link needs no deck to show;
  - Ctrl+Z takes only the GM's own step.
- **The ? links.**
  - Folded sections now get one.
  - A heading can name its topic (`data-help`), and that is used wherever a heading's text is shared by two topics.
  - Players are never sent silently to a GM topic.
  - Every SR2e actor and item sheet has a **Guide** button that opens the whole guide.
- **Wording.** The Unified Rules Revamp is described only as "an optional set of revamped rules (a community revamp of the SR1–3 rules plus house rules)", in the guide, the GM panel and the setting hints.
- **Small code fixes:**
  - the dying line and the Effects tab give the bleed rate for the rules in force (Body Combat Turns, a house-ruled number, or the Revamp's minutes);
  - the Karma tooltip follows the rules (career Karma, or the Revamp's per-award pool point);
  - Spend Karma's **Buy off** asks first;
  - the wall config's security-door field shows on every wall;
  - the tour's texts are corrected;
  - the window is titled "SR2e guide".

## The owner's decisions (24 Oct 2026), done in v0.82.1
1. **Adepts and initiation.** The Magic tab shows **Initiate**, the initiate grade and the metamagic tick boxes for adepts. Each tradition sees only the techniques it may learn (plus any it knows): for an adept, centering and masking by default. Quest, Ward… and Geasa stay hidden for adepts.
2. **Edges and flaws.** After creation, with the approval queue on, adding, changing or deleting an edge or flaw by hand becomes a request to the GM. The new actor methods are `addQuality`, `editQuality` and `removeQuality`; they are in the queue's method list, and the request shape is checked. Free in the wizard, for the GM, and when the queue is off.
3. **"Mr. Johnson".** Kept. The contacts topic now says how the term is used in Shadowrun: the name runners give whoever hires them, usually a corporate go-between who never gives a real name.
4. **Sources.**
   - The book ruleset now cites only official sources ("SRII p…", Rigger 2, Grimoire and so on). Where no page was recorded, it says "official SR2 rules (book page to verify)", and VERIFY.md lists those.
   - The Unified Rules Revamp points to the URR document, *Shadowrun Classic: Unified Rule Revamp* (v1.2), or says "house rule for the Revamp (not in the URR)".
   - Every mention of the private rules summaries and the comparison workbook's rows was removed from the source, `docs/VERIFY.md`, the guide, the setting hints and the GM panel.
