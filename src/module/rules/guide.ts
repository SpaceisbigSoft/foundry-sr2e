/**
 * v0.66.0: the player guide. One set of topics feeds two outputs:
 *  - the in-Foundry help window (a "?" beside each sheet heading opens the topic for that heading:
 *    `topicForHeading`, `guideTopicHtml`);
 *  - `docs/PLAYER-GUIDE.md` for the GitHub release (`guideMarkdown`).
 *
 * Pure: no Foundry globals. No rulebook text: the guide explains the system's screens and points to the SR2 rulebook
 * for the rules.
 *
 * v0.89.7: the text is in lang/en.json, `SR2E.Guide.Topic.<topicId>` (the id in camelCase): `title`, then one key per
 * block in order, `b1`, `b2` …: a paragraph is a text, a list is an object of items `i1`, `i2` …. This file keeps each
 * topic's id, audience, the sheet headings it explains (English: they are matched against the templates'
 * `data-heading` ids) and its blocks (`'p'` for a paragraph, a number for a list of that many items). A text may hold
 * the inline tags strong, em, kbd, code and `<a href="#topic-id">` links to other topics (the v0.89.7 test checks them).
 * Category labels are `SR2E.Guide.Category.<id>`.
 *
 * After changing a text or a topic's blocks, regenerate the Markdown (a test compares it):
 *   npx tsx --import ./src/module/__tests__/helpers/english-lang.ts -e "import('./src/module/rules/guide.ts').then(m=>process.stdout.write(m.guideMarkdown()))" > docs/PLAYER-GUIDE.md
 */

import { escHtml } from './html.ts';
import { t as tx, tKey, tRaw } from '../helpers/i18n.ts';

/** A topic's blocks: `'p'` a paragraph, a number a list with that many items. */
export type GuideBlock = 'p' | number;

export interface GuideTopic {
  id: string;
  /** The topic's title, in the user's language. */
  readonly title: string;
  audience: 'player' | 'gm' | 'both';
  /** Sheet heading texts this topic explains (the English heading ids); empty for a general topic. */
  headings: string[];
  blocks: GuideBlock[];
  /** Simple HTML (p, ul, li and the inline tags), in the user's language. */
  readonly body: string;
}

/** A topic id as a key part: "getting-started" → "gettingStarted". */
export const guideKeyPart = (id: string): string => id.replace(/-([a-z0-9])/g, (_m, c: string) => c.toUpperCase());

/** The keys of a topic's texts, in order (a list item is `<block>.i<n>`). */
export function guideTopicKeys(t: Pick<GuideTopic, 'id' | 'blocks'>): string[] {
  const base = `SR2E.Guide.Topic.${guideKeyPart(t.id)}`;
  return [`${base}.title`, ...t.blocks.flatMap((b, i) => b === 'p' ? [`${base}.b${i + 1}`] : Array.from({ length: b }, (_x, j) => `${base}.b${i + 1}.i${j + 1}`))];
}

/**
 * A guide text: HTML on purpose (its inline tags), the system's own translation from the language file. Read as it is
 * (`tRaw`): guide texts have no placeholders, and a `{label}` in a roll-link example must stay.
 */
const guideHtml = (key: string): string => tRaw(key);
const para = (key: string): string => `<p>${guideHtml(key)}</p>`;
const list = (keys: string[]): string => `<ul>${keys.map((k) => `<li>${guideHtml(k)}</li>`).join('')}</ul>`;

const topic = (id: string, audience: GuideTopic['audience'], headings: string[], blocks: GuideBlock[]): GuideTopic => {
  const base = `SR2E.Guide.Topic.${guideKeyPart(id)}`;
  return {
    id, audience, headings, blocks,
    get title() { return tRaw(`${base}.title`); },
    get body() {
      return blocks.map((b, i) => b === 'p'
        ? para(`${base}.b${i + 1}`)
        : list(Array.from({ length: b }, (_x, j) => `${base}.b${i + 1}.i${j + 1}`))).join('');
    },
  };
};

export const GUIDE_TOPICS: GuideTopic[] = [
  // ---------------------------------------------------------------- getting started
  topic('getting-started', 'both', [], ['p', 'p', 'p', 11, 'p', 'p']),
  // v0.89.8: the SR2e tools window (applications/tools.ts); its headings name this topic (data-help).
  topic('tools', 'both', [], ['p', 'p', 'p']),
  topic('rules-v079', 'both', [], ['p', 11]),
  topic('rules-urr', 'both', [], ['p', 'p', 7, 'p']),
  topic('sheet-tools', 'both', [], ['p', 2, 'p', 'p', 'p', 'p', 'p', 'p', 'p']),
  topic('summary-bar', 'both', [], ['p', 3, 'p', 5, 'p']),
  topic('layouts', 'both', ['Defense', 'Actions'], ['p', 3, 'p', 4, 'p', 'p', 'p']),
  // ---------------------------------------------------------------- rolling
  topic('rolling', 'both', [], ['p', 'p', 'p', 'p', 'p', 'p', 'p']),
  topic('targeting', 'both', [], ['p', 'p', 'p', 'p', 'p']),
  topic('chat-cards', 'both', [], ['p', 5, 'p', 'p', 'p', 3, 'p', 6, 'p', 'p', 'p']),
  topic('look', 'both', [], ['p', 6, 'p', 'p', 'p']),
  topic('karma-pool', 'both', [], ['p', 3, 'p', 'p', 'p', 'p']),
  topic('pools', 'both', ['Initiative and pools'], ['p', 'p', 'p', 'p', 'p']),
  topic('shortcuts', 'both', [], [11, 'p', 'p', 'p', 4, 'p', 'p', 'p', 'p']),
  topic('inline-tests', 'both', [], ['p', 'p', 5]),
  // ---------------------------------------------------------------- Main tab
  topic('attributes', 'both', ['Attributes', 'Derived'], ['p', 'p', 'p', 'p', 'p', 'p', 'p']),
  topic('condition-monitor', 'both', ['Condition Monitor'], ['p', 'p', 'p', 'p', 4, 'p']),
  topic('skills', 'both', ['Skills', 'Active skills', 'Knowledge skills', 'Language skills', 'Build/Repair skills'], ['p', 'p', 'p']),
  topic('skill-picker', 'both', [], ['p', 5, 'p']),
  // ---------------------------------------------------------------- Current tab
  topic('current-tab', 'both', ['Body', 'Karma and money'], ['p', 5]),
  // ---------------------------------------------------------------- Combat tab
  topic('weapons', 'both', ['Weapons', 'Armor'], ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p']),
  topic('effects', 'both', ['In effect', 'Effects'], ['p', 'p', 'p']),
  // ---------------------------------------------------------------- Magic tab
  topic('magic', 'both', ['Magic', 'Geasa', 'Sustaining', 'Anchored', 'Foci', 'Adept powers', 'Sustaining powers', 'Under spells and powers'], ['p', 11, 'p', 3, 'p', 'p', 'p']),
  topic('conjuring', 'both', ['Attacks', 'Ally'], ['p', 'p', 'p', 6, 'p']),
  topic('spells', 'both', ['Spells'], ['p', 'p', 'p', 'p', 'p']),
  // v0.91.8: spell formulas, teachers and the other tradition (RULES.FORMULA_V918); the formula's sheet heading names it (data-help).
  topic('spell-formulas', 'both', [], ['p', 4, 'p']),
  // v0.92.0: the rules interpretations (†).
  topic('interpretations', 'both', [], ['p', 3, 'p']),
  topic('powers', 'both', ['Powers'], ['p', 'p']),
  // ---------------------------------------------------------------- Matrix and Rigging tabs
  topic('matrix', 'both', ['Matrix', 'Cyberdecks', 'Programs', 'Frames and agents', 'Downloaded data'], ['p', 10, 'p', 'p']),
  topic('rigging', 'both', ['Rigging'], ['p', 4, 'p', 'p', 'p', 'p']),
  // ---------------------------------------------------------------- Gear tab
  topic('cyberware', 'both', ['Cyberware'], ['p', 'p', 'p']),
  topic('gear', 'both', ['Gear', 'Other gear'], ['p', 'p', 'p', 'p']),
  topic('item-sheet', 'both', ['Rating and kind', 'Concentration', 'Martial art', 'Firearm', 'Accessories', 'Ammunition', 'Blast', 'Shotgun', 'Missile', 'Flamethrower', 'Range', 'Range from Strength', 'Handling', 'Toxin and cybergun', 'Weight and mount', 'Turret', 'Cyberlimb', 'Cyberweapon', 'Features', 'Cyberears', 'Skill bonuses', 'Essence and grade', 'Bioware', 'Attribute bonuses', 'Identity', 'Magical site', 'Explosives and toxins', 'Chips', 'Tools', 'Vision and surveillance', 'Cost and legality'], ['p', 5, 'p', 'p', 'p']),
  topic('health', 'both', ['Addictions', 'Diseases'], ['p', 2, 'p']),
  // ---------------------------------------------------------------- Upkeep tab
  topic('money', 'both', ['Money and lifestyle', 'Ledger'], ['p', 3, 'p']),
  topic('spend-karma', 'both', ['Karma', 'More', 'Recent Karma'], ['p', 'p', 4, 'p', 'p', 'p']),
  topic('under-way', 'both', ['Under way'], ['p', 'p', 3, 'p']),
  topic('contacts', 'both', ['Contacts'], ['p', 'p', 'p', 'p']),
  // ---------------------------------------------------------------- adding things
  topic('adding', 'both', [], ['p', 9, 'p', 'p', 'p', 'p', 'p']),
  topic('new-entry', 'both', ['Paste the stat line'], ['p', 4, 'p', 'p']),
  // v0.91.3: the Catalogue window.
  topic('catalogue', 'both', ['Stats and details'], ['p', 4, 'p']),
  // ---------------------------------------------------------------- creation
  topic('creation-wizard', 'both', ['Character creation', 'Totals', 'Shopping'], ['p', 8, 'p', 'p', 'p', 'p']),
  topic('creation-record', 'both', ['Creation record', 'Advancement log', 'Build checks at the finish'], ['p', 'p', 'p', 'p']),
  topic('approval', 'both', ['Waiting for the GM', 'Requests from players'], ['p', 'p', 'p', 'p', 3, 'p']),
  // ---------------------------------------------------------------- Bio tab
  topic('bio', 'both', ['Edges and flaws', 'Reputation', 'Biography', 'Notes'], [3, 'p']),
  // ---------------------------------------------------------------- other sheets
  topic('token-art', 'both', ['Picture and token', 'Default token art'], ['p', 4, 'p', 8]),
  topic('npc-sheets', 'both', ['Powers, weaknesses and notes', 'Critter', 'Adjustments'], ['p', 4]),
  topic('vehicles', 'both', ['Control', 'Sensors', 'Chase', 'Aboard', 'Modifications', 'Cargo'], ['p', 7, 'p']),

  topic('printing', 'both', [], ['p', 3, 'p', 'p', 'p']),
  // ================================================================ For the GM
  topic('credits', 'both', [], ['p', 'p', 'p', 'p']),
  topic('gm-panel', 'gm', ['Scene', 'Regions with an SR2e environment', 'Presets', 'Encounter notes', 'Charges on a timer', 'Fires', 'Damaged walls'], ['p', 'p', 'p', 9]),
  topic('gm-time', 'gm', ['Time'], ['p', 'p', 'p']),
  topic('gm-combat', 'gm', ['Combat', 'NPCs and groups', 'On this scene'], ['p', 'p', 'p', 'p', 'p']),
  topic('gm-party', 'gm', ['Party', 'Money and Karma'], ['p', 'p']),
  topic('gm-tools', 'gm', ['NPC generator', 'Preview', 'Dice and TN calculator'], [3]),
  topic('gm-setup', 'gm', ['Start of the session', 'End of the session', 'Players and characters', 'Token setup', 'Starter kits', 'Item catalogue', 'Characters from a stat block', 'Modules', 'Rules source', 'Portraits by name', 'Starter demo'], [10]),
  topic('gm-world', 'gm', ['Magical groups', 'Building security', 'Safehouses', 'Security sheaf', 'IC', 'Data stores', 'Deckers here', 'Security deckers', 'Subsystem data bombs', 'Comcalls', 'Devices', 'Guards', 'Security steps', 'Security rigger', 'Turrets and drones', 'People', 'Build it'], ['p', 4, 'p']),
  // v0.91.7
  topic('scene-builder', 'gm', [], ['p', 7, 'p', 'p']),
  topic('gm-undo', 'gm', ['Undo', "What undo can't do", 'Recent rolls'], ['p', 'p', 'p']),
  topic('gm-cards', 'gm', [], [8, 'p', 10]),
  topic('house-rules', 'gm', [], ['p', 'p', 'p', 'p', 'p', 5, 'p']),
];

// ---------------------------------------------------------------- categories

/** v0.76.0: the guide's categories, in order (the help window's sidebar and the Markdown contents). Labels never equal a topic title (Markdown anchors). */
export interface GuideCategory { id: string; readonly label: string; audience: 'players' | 'gm'; topics: string[] }

const category = (id: string, audience: GuideCategory['audience'], topics: string[]): GuideCategory =>
  ({ id, audience, topics, get label() { return tKey(`SR2E.Guide.Category.${guideKeyPart(id)}`); } });

export const GUIDE_CATEGORIES: GuideCategory[] = [
  category('start', 'players', ['getting-started', 'tools', 'rules-v079', 'rules-urr', 'sheet-tools', 'summary-bar', 'layouts', 'look', 'shortcuts', 'printing', 'interpretations', 'credits']),
  category('rolls', 'players', ['rolling', 'targeting', 'chat-cards', 'karma-pool', 'pools', 'inline-tests']),
  category('character', 'players', ['attributes', 'condition-monitor', 'skills', 'skill-picker', 'current-tab', 'effects', 'health', 'contacts', 'bio', 'token-art']),
  category('gear', 'players', ['weapons', 'cyberware', 'gear', 'item-sheet', 'money', 'adding', 'catalogue', 'new-entry']),
  category('advancement', 'players', ['creation-wizard', 'creation-record', 'spend-karma', 'under-way', 'approval']),
  category('magic', 'players', ['magic', 'conjuring', 'spells', 'spell-formulas', 'powers']),
  category('matrix', 'players', ['matrix', 'rigging']),
  category('sheets', 'players', ['npc-sheets', 'vehicles']),
  category('gm-run', 'gm', ['gm-panel', 'gm-time', 'gm-combat', 'gm-party', 'gm-cards', 'gm-undo']),
  category('gm-setup', 'gm', ['gm-setup', 'scene-builder', 'gm-world', 'gm-tools', 'house-rules']),
];

/** The categories with their topics, for a player or the GM (GM categories only for the GM). */
export function guideGroups(gm: boolean): Array<{ id: string; label: string; topics: GuideTopic[] }> {
  const byId = new Map(GUIDE_TOPICS.map((t) => [t.id, t]));
  return GUIDE_CATEGORIES.filter((c) => gm || c.audience === 'players')
    .map((c) => ({ id: c.id, label: c.label, topics: c.topics.map((id) => byId.get(id)).filter((t): t is GuideTopic => Boolean(t)) }))
    .filter((g) => g.topics.length);
}

// ---------------------------------------------------------------- lookup

/** A heading's text made comparable: case, spacing, counts like "(3)", trailing numbers and icons go. */
export function normaliseHeading(text: string): string {
  let s = String(text ?? '')
    .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ').trim().toLowerCase();
  s = s.replace(/^\d+\.\s+/, ''); // "3. Attributes" (wizard steps)
  for (let i = 0; i < 4; i++) {
    const before = s;
    s = s.replace(/\s*\(\s*[\d/ ]*\)\s*$/, '') // (3), (2 / 5)
      .replace(/[\s+?:·…,.\-–—]+$/, '') // trailing icons and punctuation
      .replace(/\s+[+−-]?\d+(\s*\/\s*\d+)?$/, '') // "Conjuring 5", "3 / 4"
      .trim();
    if (s === before) break;
  }
  return s;
}

let index: Map<string, GuideTopic> | null = null;
function headingIndex(): Map<string, GuideTopic> {
  if (index) return index;
  index = new Map();
  for (const t of GUIDE_TOPICS) for (const h of t.headings) {
    const k = normaliseHeading(h);
    if (k && !index.has(k)) index.set(k, t);
  }
  return index;
}

/** The topic for a sheet heading's text: an exact alias first, then the longest alias the text starts with. */
export function topicForHeading(text: string): GuideTopic | null {
  const s = normaliseHeading(text);
  if (!s) return null;
  const idx = headingIndex();
  const exact = idx.get(s);
  if (exact) return exact;
  let best: { len: number; topic: GuideTopic } | null = null;
  for (const [k, t] of idx) {
    if (s.length > k.length && s.startsWith(k) && !/[\p{L}\p{N}]/u.test(s.charAt(k.length)) && (!best || k.length > best.len)) best = { len: k.length, topic: t };
  }
  return best?.topic ?? null;
}

export function guideTopic(id: string): GuideTopic | null {
  return GUIDE_TOPICS.find((t) => t.id === id) ?? null;
}

/**
 * v0.82.0: the headings a window's "?" links go on (help.ts `decorateHelp`): section headings, field-set legends and
 * the summary line of a folded `<details>` section.
 */
export const HELP_HEADING_SELECTOR = 'h2, h3, legend, summary';

/** v0.82.0: the `data-help` value that keeps a heading without a "?" (a summary whose text is data, not a title). */
export const HELP_NONE = 'none';

/**
 * v0.82.0: the topic a heading's "?" opens. A heading may name its topic with `data-help="<topic id>"` (where its text
 * is shared by two topics, or is built from data); `data-help="none"` means no "?". Otherwise the text decides
 * (`topicForHeading`). An unknown id gives null (the guide test catches it in the templates).
 */
export function helpTopicFor(dataHelp: string | null | undefined, text: string): GuideTopic | null {
  if (dataHelp !== null && dataHelp !== undefined) return dataHelp === HELP_NONE ? null : guideTopic(dataHelp.trim());
  return topicForHeading(text);
}

/**
 * v0.82.0: what the help window shows for a topic id. A player who follows a link to a GM topic gets a short note, not
 * the GM's text and not a silent jump to the first topic.
 */
export function guideTopicFor(id: string, gm: boolean): { title: string; body: string; gmOnly: boolean } | null {
  const t = guideTopic(id);
  if (!t) return null;
  if (t.audience === 'gm' && !gm) return { title: t.title, body: `<p>${tx('SR2E.Guide.gmOnly')}</p>`, gmOnly: true };
  return { title: t.title, body: t.body, gmOnly: false };
}

/** One topic as HTML for the help window: its title as an h2, then the body. Null for an unknown id. */
export function guideTopicHtml(id: string): string | null {
  const t = guideTopic(id);
  return t ? `<h2>${escHtml(t.title)}</h2>${t.body}` : null;
}

// ---------------------------------------------------------------- Markdown

/** GitHub's anchor for a Markdown heading. */
export function markdownAnchor(title: string): string {
  return title.trim().toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/\s/g, '-');
}

function inlineMarkdown(s: string): string {
  return s
    .replace(/<strong>([\s\S]*?)<\/strong>/g, '**$1**')
    .replace(/<em>([\s\S]*?)<\/em>/g, '*$1*')
    .replace(/<code>([\s\S]*?)<\/code>/g, '`$1`')
    .replace(/<a href="#([a-z0-9-]+)">([\s\S]*?)<\/a>/g, (_m, id: string, text: string) => {
      const t = guideTopic(id);
      return t ? `[${text}](#${markdownAnchor(t.title)})` : text;
    })
    // <kbd> stays: GitHub renders it.
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&')
    .trim();
}

/** The limited body HTML (p and ul/li blocks with inline tags) as Markdown. */
export function bodyMarkdown(body: string): string {
  const out: string[] = [];
  const re = /<(p|ul)>([\s\S]*?)<\/\1>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) {
    if (m[1] === 'p') out.push(inlineMarkdown(m[2] ?? ''));
    else out.push([...(m[2] ?? '').matchAll(/<li>([\s\S]*?)<\/li>/g)].map((li) => `- ${inlineMarkdown(li[1] ?? '')}`).join('\n'));
  }
  return out.join('\n\n');
}

/** The whole guide as Markdown (docs/PLAYER-GUIDE.md). */
export function guideMarkdown(): string {
  const groups = guideGroups(true);
  const link = (t: GuideTopic) => `- [${t.title}](#${markdownAnchor(t.title)})`;
  const section = (t: GuideTopic) => `## ${t.title}\n\n${bodyMarkdown(t.body)}`;
  const parts = [
    '# SR2e player guide',
    'How to use the unofficial Shadowrun 2nd Edition system for Foundry VTT: what the sheets, buttons and chat cards do. For the rules themselves, use your SR2 rulebook. In Foundry, the small ? beside a heading on a sheet opens this guide at that topic. The system and this guide were built with AI (Anthropic\'s Claude) under human direction; see Credits and licence.',
    '<!-- Generated by guideMarkdown() (src/module/rules/guide.ts) from the SR2E.Guide texts in public/lang/en.json: edit those, then regenerate this file (the command is in guide.ts). -->',
    '## Contents',
    groups.map((g) => [`**${g.label}**`, '', ...g.topics.map(link)].join('\n')).join('\n\n'),
    ...groups.flatMap((g) => [`# ${g.label}`, ...g.topics.map(section)]),
  ];
  return `${parts.join('\n\n')}\n`;
}
