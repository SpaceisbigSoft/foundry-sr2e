import { escHtml } from '../rules/html.ts';

/**
 * v0.89.0: translation. Every user-facing string is moving into `lang/en.json` (in slices: v0.89.0 the templates,
 * the settings and the hotkeys; later versions the notifications, dialogs, chat cards, rule labels and the guide).
 *
 * - In templates: `{{sr2eT "SR2E.UI.key" name=value}}`, written by `scripts/i18n-templates.mjs`.
 * - In code: `t('SR2E.UI.key', { name: value })`.
 * - v0.89.1, the notifications: `tx('SR2E.Notify.<File>.key', { name: escHtml(value) })` (imported as `t as tx`,
 *   since `t` is a common local name), written by `scripts/i18n-notify.mjs`; counted nouns with
 *   `tCount(n, 'SR2E.Count.<noun>')`. A notification value is still escaped with escHtml where it is passed.
 * - v0.89.2, the dialogs: titles, content and button labels are `SR2E.Dialog.<File>.*` (`scripts/i18n-dialogs.mjs`).
 *   Content is HTML: the tags stay in the code and each run of text between them is one string, kept as HTML
 *   source (an entity stays an entity), with its values escaped where they are passed. Static window titles are
 *   keys themselves (`SR2E.Window.<File>.*`; Foundry localizes `window.title`). Counted nouns: `SR2E.Count.*`.
 * - v0.89.3, the chat cards: `SR2E.Card.<File>.*` (`scripts/i18n-cards.mjs`, HTML as for dialogs). Wording chosen
 *   by a count is one counted text: `tCount(n, 'SR2E.Card.<File>.key', { … })` with `one` / `other` forms. Never call
 *   `t()` at module load (a top-level constant): Foundry has no languages yet then, and the key would be kept.
 * - v0.89.4, the rule labels: the house rules are keys from their paths (`SR2E.HouseRules.*`); label maps and setting
 *   choices hold keys (shown with `tKey()`, or translated by Foundry for settings); the tables built at load (RULES, the
 *   Revamp patch, rules/texttables.ts) keep their English and are translated in place at i18nInit (rules/rulestext.ts,
 *   `SR2E.Rules.*`, `SR2E.RulesUrr.*`, `SR2E.Tables.*`); modifier rows' labels are `SR2E.Card.Mod.*`, and the rows the
 *   code looks for carry an id (rules/dice.ts `modifierIs`); the sheet tooltips are `SR2E.Tooltip.*`.
 * Both use Foundry's translation for the user's language (English when a language lacks the key), and fill `{name}`
 * from the data, with nothing for a missing value (Foundry's own `format` would print "undefined").
 */

/**
 * Pure: fill `{name}` placeholders from `data`; a missing or null value is left empty. A function value is called
 * (as `{{name}}` would call it in a template), never printed as source code. `escape` makes each value safe for HTML
 * (for code that puts the result into innerHTML; templates escape the whole result themselves).
 */
export function formatText(template: string, data: Record<string, unknown> = {}, escape?: (s: string) => string): string {
  return String(template ?? '').replace(/\{([A-Za-z_][\w]*)\}/g, (_m, name: string) => {
    let v: unknown = Object.hasOwn(data, name) ? data[name] : undefined;
    if (typeof v === 'function') { try { v = (v as () => unknown)(); } catch { v = ''; } }
    const s = v === undefined || v === null ? '' : String(v);
    return escape ? escape(s) : s;
  });
}

/**
 * The translation of a key in the user's language (the key itself when no language has it).
 * v0.89.1: when `localize` gives the key back, a flat English table on `globalThis.__SR2E_EN__` is used if one is
 * there. Only the test preload (`__tests__/helpers/english-lang.ts`) puts it there, so the stub `game.i18n` of the
 * tests still shows English text; in Foundry it is never set (Foundry falls back to English by itself).
 */
function lookup(key: string): string {
  let out = key;
  try {
    const i18n: any = (globalThis as any).game?.i18n;
    if (typeof i18n?.localize === 'function') out = String(i18n.localize(key));
  } catch { out = key; }
  if (out === key) {
    const en = (globalThis as any).__SR2E_EN__;
    if (en && typeof en === 'object' && Object.hasOwn(en, key) && typeof en[key] === 'string') return en[key];
  }
  return out;
}

/** The translation of a key, with its placeholders filled (plain text: escape it before putting it into HTML). */
export function t(key: string, data: Record<string, unknown> = {}): string {
  return formatText(lookup(key), data);
}

/**
 * v0.89.4: the translation of a key that comes from a data table, not from the code at the call (a house rule's
 * path, a rules-source map, a privacy group's label). The tables are checked by the tests (every key they name is in
 * lang/en.json); a `tx()` call names its key itself.
 */
export function tKey(key: string, data: Record<string, unknown> = {}): string {
  return t(key, data);
}

/**
 * v0.89.7: the translation of a key as it is, with no placeholders filled: for texts that have none and may show
 * braces of their own (the guide's roll-link examples, `@SR2Test[…]{label}`), which `t()` would empty.
 */
export function tRaw(key: string): string {
  return lookup(key);
}

/** The translation as HTML: the translation is the system's own text, the filled-in values are escaped. */
export function tHtml(key: string, data: Record<string, unknown> = {}): string {
  return formatText(lookup(key), data, escHtml);
}

/** Pure: the plural category of a number in a language (`one`, `few`, `many`, `other` …), `other` when unknown. */
export function pluralCategory(n: number, lang = 'en'): string {
  try { return new Intl.PluralRules(lang).select(n); } catch { return n === 1 ? 'one' : 'other'; }
}

/**
 * v0.89.1: a counted noun ("1 template", "3 templates"). `base` names a group of keys, one per plural category
 * of the language (`SR2E.Count.template.one` / `.other`), each with a `{count}` placeholder; a category
 * the language file lacks falls back to `.other`. Plain text, like `t()`.
 */
export function tCount(n: number, base: string, data: Record<string, unknown> = {}): string {
  return countText(n, base, data);
}

function countText(n: number, base: string, data: Record<string, unknown> = {}): string {
  const lang = String((globalThis as any).game?.i18n?.lang ?? 'en');
  const key = `${base}.${pluralCategory(n, lang)}`;
  const text = lookup(key);
  return formatText(text === key ? lookup(`${base}.other`) : text, { ...data, count: n });
}

/**
 * v0.89.5: the counted nouns the code names by their English word (`tNoun(n, 'day')`, the cards' old `plural()`), each
 * a `SR2E.Count` group, so "3 days" follows the user's language. A new noun needs its group in lang/en.json.
 */
const NOUNS = {
  success: 'SR2E.Count.success',
  'net success': 'SR2E.Count.netSuccess',
  day: 'SR2E.Count.day',
  week: 'SR2E.Count.week',
  hour: 'SR2E.Count.hour',
  minute: 'SR2E.Count.minute',
  'combat turn': 'SR2E.Count.combatTurns',
  box: 'SR2E.Count.box',
  service: 'SR2E.Count.service',
  point: 'SR2E.Count.point',
  skill: 'SR2E.Count.skill',
  template: 'SR2E.Count.template',
  'item template': 'SR2E.Count.itemTemplate',
  'starter kit': 'SR2E.Count.starterKit',
  'new actor': 'SR2E.Count.newActor',
  actor: 'SR2E.Count.actor',
  NPC: 'SR2E.Count.npc',
  entry: 'SR2E.Count.entry',
} as const;
export type CountNoun = keyof typeof NOUNS;

/** v0.89.5: a counted noun named by its English word ("1 day", "3 days" in the user's language). Plain text. */
export function tNoun(n: number, noun: CountNoun): string {
  return countText(n, NOUNS[noun]);
}

/**
 * v0.89.5: a list joined the way the user's language joins one ("a, b and c"; `or` for alternatives), not with
 * English `' and '`. Plain text, like `t()`: escape the items (or the result) before HTML.
 */
export function tList(items: readonly string[], type: 'conjunction' | 'disjunction' = 'conjunction'): string {
  const list = items.map(String).filter((s) => s !== '');
  const lang = String((globalThis as any).game?.i18n?.lang ?? 'en');
  try { return new (Intl as any).ListFormat(lang, { style: 'long', type }).format(list); } catch { return list.join(', '); }
}

/** Register the `sr2eT` template helper (at init, before any sheet renders). */
export function registerI18nHelpers(): void {
  const H: any = (globalThis as any).Handlebars;
  if (!H?.registerHelper) return;
  H.registerHelper('sr2eT', (key: unknown, options: any) => t(String(key ?? ''), (options?.hash ?? {}) as Record<string, unknown>));
}
