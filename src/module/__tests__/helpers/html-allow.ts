/**
 * v0.81.1: the HTML-escaping ratchet's reviewed exceptions (used by v081-html-scan.test.ts, v0811-scan.test.ts and
 * scan-dump.mts).
 *
 * Every entry is keyed by its file, then by `allowKey(row)`: the enclosing function or class member, the sink
 * (`html` for an interpolation into an HTML template) and the exact expression text. A new `${note}` in another
 * function, or the same `note` sent to a different sink, is a new row that needs its own review. Line numbers are
 * not part of the key, so edits elsewhere in a file don't break it.
 *
 * To regenerate a file's list after its code changes: `npx tsx src/module/__tests__/helpers/scan-dump.mts <file>`
 * (or `all`). It prints the current rows with the reasons below, and `TODO: review` for new ones.
 */
import type { HtmlScanRow } from './html-scan.ts';

export const allowKey = (r: Pick<HtmlScanRow, 'fn' | 'sink' | 'expr'>): string => `${r.fn} | ${r.sink ?? 'html'} | ${r.expr}`;

/** Reviewed: HTML on purpose, or a value the scanner can't follow that was checked by reading the code. */
export const ALLOWED: Record<string, Record<string, string>> = {
  'src/module/rules/printsheet.ts': {
    'printHtml | html | esc(safeBase(opts.base))': "v0.87.0: safeBase keeps only an http(s) address ending in '/' (no javascript:, quotes or angle brackets; tests in v087), escaped as well.",
    'printHtml | html | n.html': "v0.87.0: the actor's rich-text fields for the printout, passed already cleaned by applications/print.ts (enrichFields: cleanRichHtml before and after enrichHTML, as the sheets show them); the page is printed from a frame sandboxed without scripts, or opened under a no-script CSP.",
  },
  'src/module/applications/demo.ts': {
    'buildDemo | content | p.html': 'v0.88.0: the demo journal\'s pages are rules/demo.ts demoPages output: fixed text written by the system, every name in it escaped there (scanned where written; test in v088).',
  },
  'src/module/applications/print.ts': {
    'withoutSecrets | innerHTML | html': 'v0.87.0: already-cleaned rich text (enrichFields) parsed into an inert <template> element (never rendered) to take out the secret sections.',
  },
  'src/module/applications/bugreport.ts': {
    'SR2BugReport._replaceHTML | innerHTML | result': 'v0.87.0: the window\'s own _renderHTML output, whose interpolations are scanned where they are written (the report text is escaped into the textarea).',
  },
  'src/module/rules/guide.ts': {
    'guideTopicHtml | html | t.body': 'GUIDE_TOPICS bodies are HTML built by topic() from the guide texts (para/list below).',
    'para | html | guideHtml(key)': 'v0.89.7: a guide text from the language file, HTML on purpose (strong, em, kbd, code, topic links; the v0.89.7 test checks the English). Language files are part of the system or a translation module, never user data.',
    'list | html | guideHtml(k)': 'v0.89.7: as para: a guide list item from the language file.',
  },
  'src/module/rules/charimport.ts': {
    'characterImportPlan>appendHtml | html | existing': "the actor's own biography/notes (a rich-text HTML field) that the import appends to.",
  },
  'src/module/applications/richtext.ts': {
    'postItemToChat | html | body': "the item's description: cleanRichHtml before and after Foundry's enrichHTML (design 7); goes to ChatMessage content, which Foundry cleans too.",
    'postItemToChat | html | esc(imgSrc)': 'safeImgSrc (v0.81.1) keeps only a relative path or an http(s) URL; anything else becomes the default icon (test in v0811-rich).',
    'cleanRichHtml | innerHTML | s': 'the cleaner itself: foundry.utils.cleanHTML output parsed into an inert <template> element (never rendered) to strip more.',
  },
  'src/module/applications/chat.ts': {
    'detonateAt | html | note': 'detonateAt(note) takes HTML: its chat.ts callers escape names in it (chat.ts escapes rawPb.note before the call); also stored as SR2Actor.detonator and called from documents/index.ts blowCharge.',
    'onApplyPatch | html | text': 'SR2Actor.patchEffect returns HTML whose names are escaped (documents/index.ts).',
    'onApplySite | content | note': 'cls.applySiteChange (documents/index.ts) escapes at its return (SEC2 sink pass); `cls` is `any`, so the scanner cannot follow it.',
    'onApplyHost | content | note': 'cls.applyHostChange (documents/index.ts) escapes at its return (SEC2 sink pass); `cls` is `any`.',
    'onApplyTally | content | note': 'cls.applyTallyCard → SR2Actor.#applyTally (documents/index.ts), escaped names and safeInt successes; `cls` is `any`.',
  },
  'src/module/applications/sheets.ts': {
    'SR2CharacterSheet.#onPayLifestyle | html | st.cost.toLocaleString()': 'actor.lifestyleStatus() is typed { cost: number } (documents/index.ts); `actor` is `any` here, so the scanner sees `any`.',
    'SR2CharacterSheet.#onPayLifestyle | html | (actor.system.nuyen ?? 0).toLocaleString()': 'system.nuyen is a schema NumberField (always a number after data preparation); `actor` is `any` here.',
    'SR2CharacterSheet.#onPayDocwagon | html | (actor.system.nuyen ?? 0).toLocaleString()': 'system.nuyen is a schema NumberField; `actor` is `any` here.',
    'livePreview>refresh | innerHTML | fill(form, excluded)': 'livePreview fill callbacks (19 of them) return tnPreviewHtml or escaped templates (SEC2 sink review); the callback is a parameter, so the scanner cannot follow it.',
  },
  'src/module/applications/tours.ts': {
    'SR2Tour.constructor | content | s.body()': 'tour steps come from the constant TOURS table in this file (system-written HTML).',
  },
  'src/module/config/tooltips.ts': {
    'applyFieldTooltips | data-tooltip | tip': 'FIELD_TOOLTIPS is a constant table of system-written tooltips in this file; the key only picks one.',
  },
  'src/module/settings.ts': {
    'SkillWebConfig._replaceHTML | innerHTML | result': 'the GM-only settings window: `result` is its own _renderHTML output, whose interpolations are scanned where they are written.',
    'RollPrivacyConfig._replaceHTML | innerHTML | result': 'the GM-only settings window: its own _renderHTML output (scanned where written).',
    'HouseRulesConfig._replaceHTML | innerHTML | result': 'the GM-only settings window: its own _renderHTML output (scanned where written).',
  },
  // documents/index.ts: built with scan-dump.mts against the final v0.81.1 code and reviewed row by row (SEC2.md
  // "The 37 allowed documents/index.ts rows" for most reasons). Snapshot numbers and words that the resolvers print
  // raw are coerced by SR2Actor.#cleanSnapshot before #resolve (SEC2b-2, v0.81.1).
  'src/module/documents/index.ts': {
    // v0.89.5: outcome words and the "Takes …" line, marked with ids for the banner (outcomeWord, takenMark)
    'outcomeWord | html | text': 'v0.89.5: a fixed outcome text from lang/en.json (OUTCOME_KEYS, the system\'s own text) in a tag with a fixed id.',
    'takenMark | html | inner': 'v0.89.5: the "Takes X …" sentence built by the caller from a tx() text whose values are escaped there (scanned at the call); the level is escaped here.',
    'outcomeBanner>b | html | text': 'outcomeBanner labels: constants and numbers (Hit, Miss, Takes X…).',
    'SR2Actor.applySurgeryAsGm | html | r.html': '#resolveSurgery HTML: escaped names; the snapshot is #cleanSnapshot-ed and successes safeInt-ed first.',
    'SR2Actor.applyHealAsGm | html | r.html': '#resolveHeal HTML: escaped names; the snapshot is #cleanSnapshot-ed first.',
    'SR2Actor.#resolveKind | html | ee.html': 'elementEffectExtras: an escaped constant label and buttons.',
    'SR2Actor.#resolveSoak | html | body': '`lead` plus `${ctx.type} ${ctx.noun}` (word keys, stripped to [\\w -] by #cleanSnapshot), escaped box counts and the status constant.',
    'SR2Actor.#resolveSoak | html | reflected.html': 'the reflected-spell note: escaped names and numbers; infection/toxin damageType is a #cleanSnapshot word key.',
    'SR2Actor.#post | content | html': "#resolve's HTML (every resolver's own interpolations are scanned where they are written) joined with outcomeBanner, describeResult and #karmaButtons.",
    'SR2Actor.healSeveral | html | r': 'escaped actor name plus "<track> <n> → <n>" (constant tracks, numbers).',
    'SR2Actor.#contestBody | html | total.note': 'contactDigSuccesses note: numbers through Math.max.',
    'SR2Actor.buyLifestyleOutright | html | p.cost.toLocaleString()': 'outrightPurchase (rules/charfix.ts) returns OutrightPurchase { cost: number }; `p` is annotated `any` at the call.',
    'SR2Actor.buyLifestyleOutright | html | p.credit.toLocaleString()': 'outrightPurchase returns { credit: number }; `p` is annotated `any` at the call.',
    'SR2Actor.awardGroup | html | parts.join(\'; \')': 'numbers (awardKarma good/pool, the GM-entered nuyen) and constant text; GM-only award.',
    'SR2Actor.postBlast | html | note': 'postBlast note: every caller escapes (chat.ts detonate/charge handlers, index.ts blowCharge).',
    'SR2Actor.#sustainingDropped | html | what': 'escaped spell and patient names; h.boxes is printed only when Number(h.boxes) > 0 (so it is a numeric string), track is a constant.',
    'SR2Actor.#resolvePsyche | html | what[ps.kind]': 'a constant map of effect texts (the kind only picks one) or a constant.',
    'SR2Actor.playChip | html | what[c.kind]': 'a constant map of effect texts (the kind only picks one) or a constant.',
    'SR2Actor.#resolvePerception | html | out.join(\'; \')': 'escaped IC behaviour/guards labels and numeric matrix ratings.',
    'SR2Actor.finishDesign | content | r.html': '#designCard HTML: its interpolations are scanned where it is built (the call passes `as any`, so the scanner stops).',
    'SR2Actor.gmActorCard | html | text': 'gmActorCard(text) takes HTML: all its callers escape the names in it (SEC2 review).',
    'SR2Actor.changeSite | html | parts.join(\', \')': 'escaped device names with constant bypassed/restored/open words.',
  },
};

/**
 * Real sites still to fix: player text reaches HTML. Listed so the ratchet passes while the fix is pending; each
 * entry must be removed when its site is fixed (the stale-entry test enforces it). Never move one to ALLOWED.
 */
export const OPEN: Record<string, Record<string, string>> = {
};

/** Handlebars triple-stashes, keyed `<file> | <expression>`, each with its reason. */
const ENRICHED = 'rich text from richtext.ts enrichFields: cleanRichHtml before and after enrichHTML (v0.81.1 design 7; SEC2b-4).';
export const HBS_ALLOWED: Record<string, string> = {
  'public/templates/status-strip.hbs | narrowMark': 'v0.92.0: interpMark(\'magicPoolLayers\') from rules/interpretations.ts: a fixed id, its language texts escaped with escHtml.',
  'public/templates/actor-barrier-sheet.hbs | enriched.notes': ENRICHED,
  'public/templates/actor-character-sheet.hbs | enriched.biography': ENRICHED,
  'public/templates/actor-character-sheet.hbs | enriched.notes': ENRICHED,
  'public/templates/actor-host-sheet.hbs | enriched.notes': ENRICHED,
  'public/templates/actor-ic-sheet.hbs | enriched.notes': ENRICHED,
  'public/templates/actor-npc-sheet.hbs | enriched.notes': ENRICHED,
  'public/templates/actor-npc-sheet.hbs | enriched.powers': ENRICHED,
  'public/templates/actor-npc-sheet.hbs | enriched.weaknesses': ENRICHED,
  'public/templates/actor-safehouse-sheet.hbs | enriched.notes': ENRICHED,
  'public/templates/actor-site-sheet.hbs | enriched.notes': ENRICHED,
  'public/templates/actor-spirit-sheet.hbs | enriched.notes': ENRICHED,
  'public/templates/actor-spirit-sheet.hbs | enriched.powers': ENRICHED,
  'public/templates/actor-spirit-sheet.hbs | enriched.weaknesses': ENRICHED,
  'public/templates/actor-vehicle-sheet.hbs | enriched.notes': ENRICHED,
  'public/templates/item-sheet.hbs | enriched.description': ENRICHED,
  // v0.91.3: a Catalogue page's description, read through resolveCatalogueKey (the user's own shop rules), cleanRichHtml before and after enrichHTML (secrets off), as postItemToChat.
  'public/templates/codex.hbs | page.description': "a Catalogue page's description: cleanRichHtml before and after Foundry's enrichHTML (secrets: false), as an item's chat card.",
  'public/templates/help.hbs | body': 'help.ts: a GUIDE_TOPICS body (system-written HTML) or a constant.',
  'public/templates/npc-generator.hbs | preview': 'npcgen.ts previewHtml(plan): escaped names in a table (its interpolations are scanned).',
};

/**
 * `ui.notifications.*` with unescaped values (SEC2b-7). Foundry v14 runs a notification through `cleanHTML` (no
 * scripts or handlers, but tags such as <b> or <a> still render), so a name a player typed could style or link a
 * toast. v0.85.0 swept all 730 values (each wrapped in `escHtml`, a `?? fallback` inside the wrap); none may come back.
 */
export const NOTIFICATION_MAX: number = 0;
