import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { englishTemplate } from '../../__tests__/helpers/english.ts';
import {
  GUIDE_TOPICS, GUIDE_CATEGORIES, guideGroups, topicForHeading, normaliseHeading, guideMarkdown, guideTopicHtml, bodyMarkdown, markdownAnchor,
  helpTopicFor, guideTopicFor, HELP_HEADING_SELECTOR, HELP_NONE,
} from '../guide.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');

/** Headings built in code rather than written in a template: the file that holds each label. */
const DYNAMIC: Record<string, string> = {
  // skillGroups in sheets.ts (`<h2>{{label}}` on the Main tab)
  'Active skills': 'src/module/applications/sheets.ts',
  'Knowledge skills': 'src/module/applications/sheets.ts',
  'Language skills': 'src/module/applications/sheets.ts',
  'Build/Repair skills': 'src/module/applications/sheets.ts',
  // (v0.82.0: the Effects tab's groups and the creation wizard's step titles name their topic with data-help.)
};

/** The tags help.ts decorates (HELP_HEADING_SELECTOR), as a regex alternation. */
const HELP_TAGS = HELP_HEADING_SELECTOR.split(',').map((t) => t.trim()).join('|');

/**
 * Every heading in the templates that help.ts decorates: its leading text (before any tag or helper), its full text
 * and its `data-help` (undefined when it has none).
 */
function templateHeadings(): Array<{ file: string; tag: string; lead: string; full: string; help: string | undefined }> {
  const dir = join(root, 'public', 'templates');
  const out: Array<{ file: string; tag: string; lead: string; full: string; help: string | undefined }> = [];
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.hbs'))) {
    const src = englishTemplate(readFileSync(join(dir, file), 'utf8'));
    for (const m of src.matchAll(new RegExp(`<(${HELP_TAGS})\\b([^>]*)>([\\s\\S]*?)<\\/\\1>`, 'g'))) {
      const inner = m[3] ?? '';
      const lead = (inner.split(/<|\{\{/)[0] ?? '').replace(/\s+/g, ' ').trim();
      const full = inner.replace(/\{\{[\s\S]*?\}\}/g, '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
      const help = /\bdata-help="([^"]*)"/.exec(m[2] ?? '')?.[1];
      out.push({ file, tag: m[1]!, lead, full, help });
    }
  }
  return out;
}

/** The topic help.ts gives a template heading (helpTopicFor with the heading's data-help, else its text). */
const topicOfHeading = (h: { full: string; help: string | undefined }) => helpTopicFor(h.help, h.full);

const INLINE = ['strong', 'em', 'kbd', 'code', 'a'];

/** Check a body: only the allowed tags, balanced, blocks at the top, li only in ul, no attributes but a's href. */
function checkBody(body: string): string | null {
  const stack: string[] = [];
  const re = /<(\/?)([a-z0-9]+)([^>]*)>/g;
  let m: RegExpExecArray | null;
  let last = 0;
  while ((m = re.exec(body))) {
    const text = body.slice(last, m.index);
    last = re.lastIndex;
    if (text.trim() && !stack.length) return `text outside a block: "${text.trim().slice(0, 30)}"`;
    if (/[<>]/.test(text)) return 'stray < or >';
    const [, close, tag = '', attrs = ''] = m;
    if (!['p', 'ul', 'li', ...INLINE].includes(tag)) return `tag <${tag}> not allowed`;
    if (close) {
      if (stack.pop() !== tag) return `unbalanced </${tag}>`;
      continue;
    }
    if (tag === 'a') { if (!/^ href="#[a-z0-9-]+"$/.test(attrs)) return `bad link attributes: ${attrs}`; }
    else if (attrs.trim()) return `<${tag}> has attributes`;
    const parent = stack.at(-1);
    if ((tag === 'p' || tag === 'ul') && parent !== undefined) return `<${tag}> inside <${parent}>`;
    if (tag === 'li' && parent !== 'ul') return '<li> outside <ul>';
    if (INLINE.includes(tag) && (parent === undefined || parent === 'ul')) return `<${tag}> outside a p or li`;
    if (INLINE.includes(tag) && stack.includes(tag)) return `<${tag}> nested in itself`;
    stack.push(tag);
  }
  if (body.slice(last).trim()) return 'text after the last block';
  if (stack.length) return `unclosed <${stack.at(-1)}>`;
  if (/<ul>(?!<li>)|<\/li>(?!<li>|<\/ul>)/.test(body)) return 'something other than li directly in a ul';
  return null;
}

describe('v0.66.0 player guide topics', () => {
  test('ids are unique and slug-like; titles are unique', () => {
    const ids = GUIDE_TOPICS.map((t) => t.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const id of ids) assert.match(id, /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/);
    const anchors = GUIDE_TOPICS.map((t) => markdownAnchor(t.title));
    assert.equal(new Set(anchors).size, anchors.length);
    assert.ok(!anchors.includes('contents') && !anchors.includes('for-the-gm') && !anchors.includes('sr2e-player-guide'));
    assert.ok(GUIDE_TOPICS.length >= 25 && GUIDE_TOPICS.length <= 70)  // v0.79.0: 51 topics (was <= 50);
    assert.equal(GUIDE_TOPICS[0]!.id, 'getting-started');
  });

  test('every topic has headings or is one of the general topics', () => {
    // v0.87.0: 'printing' (no sheet heading of its own). v0.89.8: 'tools' (the tools window's headings name it with data-help). v0.91.7: 'scene-builder' (likewise). v0.92.3: 'rules-v0923-combat'.
    const general = new Set(['getting-started', 'sheet-tools', 'summary-bar', 'rolling', 'targeting', 'chat-cards', 'karma-pool', 'shortcuts', 'inline-tests', 'skill-picker', 'adding', 'gm-cards', 'house-rules', 'look', 'credits', 'rules-v079', 'rules-v0923-combat', 'rules-urr', 'printing', 'tools', 'scene-builder', 'spell-formulas', 'interpretations']);
    for (const t of GUIDE_TOPICS) {
      if (general.has(t.id)) assert.equal(t.headings.length, 0, t.id);
      else assert.ok(t.headings.length > 0, `${t.id} has no headings`);
      assert.ok(t.title.trim() && t.body.trim(), t.id);
      assert.ok(['player', 'gm', 'both'].includes(t.audience), t.id);
    }
  });

  test('v0.76.0 categories: every topic in exactly one, GM topics only in GM categories, labels never a topic title', () => {
    const seen = new Map<string, string>();
    for (const c of GUIDE_CATEGORIES) for (const id of c.topics) {
      assert.ok(!seen.has(id), `${id} in ${seen.get(id)} and ${c.id}`);
      seen.set(id, c.id);
      const t = GUIDE_TOPICS.find((x) => x.id === id);
      assert.ok(t, `${c.id} lists unknown topic ${id}`);
      assert.equal(t!.audience === 'gm', c.audience === 'gm', `${id} in ${c.id}`);
    }
    for (const t of GUIDE_TOPICS) assert.ok(seen.has(t.id), `${t.id} has no category`);
    const titles = new Set(GUIDE_TOPICS.map((t) => t.title.toLowerCase()));
    for (const c of GUIDE_CATEGORIES) assert.ok(!titles.has(c.label.toLowerCase()), c.label);
    assert.equal(new Set(GUIDE_CATEGORIES.map((c) => c.id)).size, GUIDE_CATEGORIES.length);
    const firstGm = GUIDE_CATEGORIES.findIndex((c) => c.audience === 'gm');
    assert.ok(GUIDE_CATEGORIES.slice(firstGm).every((c) => c.audience === 'gm'));
  });
  test('guideGroups: players never see GM categories; the GM sees all', () => {
    assert.ok(guideGroups(false).every((g) => g.topics.every((t) => t.audience !== 'gm')));
    assert.equal(guideGroups(true).length, GUIDE_CATEGORIES.length);
    assert.equal(guideGroups(true).reduce((n, g) => n + g.topics.length, 0), GUIDE_TOPICS.length);
  });
  test('GM topics come after the players\' topics', () => {
    const firstGm = GUIDE_TOPICS.findIndex((t) => t.audience === 'gm');
    assert.ok(firstGm > 0);
    assert.ok(GUIDE_TOPICS.slice(firstGm).every((t) => t.audience === 'gm'));
  });

  test('bodies use only the allowed tags, balanced', () => {
    for (const t of GUIDE_TOPICS) assert.equal(checkBody(t.body), null, t.id);
    assert.match(checkBody('<p>a <script>x</script></p>') ?? '', /not allowed/);
    assert.match(checkBody('<p>a <strong>b</p>') ?? '', /unbalanced/);
    assert.match(checkBody('<p><a href="https://x">b</a></p>') ?? '', /bad link/);
    assert.match(checkBody('<li>x</li>') ?? '', /outside/);
  });

  test('every link points to a real topic', () => {
    const ids = new Set(GUIDE_TOPICS.map((t) => t.id));
    for (const t of GUIDE_TOPICS) {
      for (const m of t.body.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.has(m[1]!), `${t.id} links to #${m[1]}`);
    }
  });

  test('no heading alias belongs to two topics', () => {
    const seen = new Map<string, string>();
    for (const t of GUIDE_TOPICS) for (const h of t.headings) {
      const k = normaliseHeading(h);
      assert.ok(k, `${t.id}: empty alias`);
      assert.ok(!seen.has(k), `"${h}" is in ${seen.get(k)} and ${t.id}`);
      seen.set(k, t.id);
    }
  });

  test('every heading alias is a heading in a template (or a label the code builds a heading from)', () => {
    // v0.82.0: only headings whose text decides their topic count. A heading with data-help (a named topic, or
    // "none": a folded section that gets no ?) never uses its text, so an alias matching only such a heading is dead.
    const heads = templateHeadings().filter((h) => h.help === undefined);
    const texts = new Set(heads.flatMap((h) => [normaliseHeading(h.lead), normaliseHeading(h.full)]).filter(Boolean));
    assert.ok(texts.has('condition monitor') && texts.has('weapons'), 'the template scan found the usual headings');
    for (const t of GUIDE_TOPICS) for (const h of t.headings) {
      if (texts.has(normaliseHeading(h))) continue;
      const file = DYNAMIC[h];
      assert.ok(file, `${t.id}: "${h}" is not a heading in public/templates`);
      const src = read(file);
      assert.ok(src.includes(`'${h}'`) || src.includes(`"${h}"`), `${t.id}: "${h}" not found in ${file}`);
    }
  });

  test('v0.82.0: every data-help in the templates names a real topic (or "none"), on a heading help.ts decorates', () => {
    const ids = new Set(GUIDE_TOPICS.map((t) => t.id));
    const dir = join(root, 'public', 'templates');
    let n = 0;
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.hbs'))) {
      const src = englishTemplate(readFileSync(join(dir, file), 'utf8'));
      for (const m of src.matchAll(/<([a-z0-9]+)\b[^>]*\bdata-help="([^"]*)"/g)) {
        n++;
        assert.ok(new RegExp(`^(${HELP_TAGS})$`).test(m[1]!), `${file}: data-help on a <${m[1]}>`);
        assert.ok(m[2] === HELP_NONE || ids.has(m[2]!), `${file}: data-help="${m[2]}" names no topic`);
      }
    }
    assert.ok(n >= 20, 'the scan found the data-help headings');
    // And the check itself: a missing topic is caught.
    assert.equal(helpTopicFor('no-such-topic', 'Weapons'), null);
  });

  test('v0.82.0: helpTopicFor: data-help wins over the text; "none" gives no ?; no data-help falls back to the text', () => {
    assert.equal(helpTopicFor('vehicles', 'Weapons')?.id, 'vehicles');
    assert.equal(helpTopicFor(undefined, 'Weapons')?.id, 'weapons');
    assert.equal(helpTopicFor(null, 'Weapons')?.id, 'weapons');
    assert.equal(helpTopicFor(HELP_NONE, 'Weapons'), null);
    assert.equal(helpTopicFor('', 'Weapons'), null);
  });

  test('v0.82.0: shared and dynamic headings open the right topic', () => {
    const heads = templateHeadings();
    const of = (file: string, pred: (h: { full: string; tag: string }) => boolean) => heads.filter((h) => h.file === file && pred(h));
    // The wizard's steps and sections, the creation record and Spend Karma: their own topics, not the sheet's.
    const wiz = of('creation-wizard.hbs', () => true);
    assert.ok(wiz.length >= 6);
    for (const h of wiz) assert.equal(topicOfHeading(h)?.id, 'creation-wizard', h.full);
    for (const h of of('actor-character-sheet.hbs', (x) => ['Build', 'Spells', 'Adept powers', 'Gear', 'Contacts', 'Edges and flaws'].includes(x.full)).filter((x) => x.help)) assert.equal(topicOfHeading(h)?.id, 'creation-record', h.full);
    for (const t of ['Attributes', 'Skills', 'Spells']) assert.equal(topicOfHeading(of('spend-karma.hbs', (x) => x.full === t)[0]!)?.id, 'spend-karma', t);
    // The item sheet's Armor and senses / Sensors and radio (not Weapons and armor / Vehicle sheets).
    for (const t of ['Armor and senses', 'Sensors and radio', 'Cost and legality', 'Firearm']) assert.equal(topicOfHeading(of('item-sheet.hbs', (x) => x.full === t)[0]!)?.id, 'item-sheet', t);
    // The Effects tab's groups (Combat, Magic...) are built from data: the Effects topic, never gm-combat or magic.
    assert.equal(topicOfHeading(of('effects-section.hbs', (x) => x.tag === 'h2')[0]!)?.id, 'effects');
    // The World tab's and the site's Matrix, the safehouse's Notes, the vehicle's Weapons.
    assert.equal(topicOfHeading(of('gm-panel.hbs', (x) => x.full === 'Matrix')[0]!)?.id, 'gm-world');
    assert.equal(topicOfHeading(of('actor-site-sheet.hbs', (x) => x.full === 'Matrix')[0]!)?.id, 'gm-world');
    assert.equal(topicOfHeading(of('actor-safehouse-sheet.hbs', (x) => x.full === 'Notes')[0]!)?.id, 'gm-world');
    assert.equal(topicOfHeading(of('actor-vehicle-sheet.hbs', (x) => x.full === 'Weapons')[0]!)?.id, 'vehicles');
    // Rules source and Portraits by name (GM panel, Setup tab).
    assert.equal(topicOfHeading(of('gm-panel.hbs', (x) => x.full === 'Rules source')[0]!)?.id, 'gm-setup');
    assert.equal(topicOfHeading(of('gm-panel.hbs', (x) => x.full === 'Portraits by name')[0]!)?.id, 'gm-setup');
    // Folded sections: NPC and spirit sheets, the Setup line of the summary bar, the spirit's Ally.
    assert.equal(topicOfHeading(of('actor-npc-sheet.hbs', (x) => x.full === 'Adjustments')[0]!)?.id, 'npc-sheets');
    assert.equal(topicOfHeading(of('actor-npc-sheet.hbs', (x) => x.full === 'Effects')[0]!)?.id, 'effects');
    assert.equal(topicOfHeading(of('actor-spirit-sheet.hbs', (x) => x.full === 'Adjustments')[0]!)?.id, 'conjuring');
    assert.equal(topicOfHeading(of('actor-spirit-sheet.hbs', (x) => x.full === 'Ally')[0]!)?.id, 'conjuring');
    assert.equal(topicOfHeading(of('sheet-summary.hbs', (x) => x.tag === 'summary')[0]!)?.id, 'summary-bar');
    // Summaries built from data (the undo log's steps, the safehouse's option groups) get no ?.
    for (const f of ['gm-panel.hbs', 'actor-safehouse-sheet.hbs']) {
      const dyn = heads.filter((x) => x.file === f && x.tag === 'summary' && x.help === HELP_NONE);
      assert.ok(dyn.length >= 1, f);
      for (const h of dyn) assert.equal(topicOfHeading(h), null, f);
    }
  });

  test('v0.82.0: players never land on a GM topic: no player topic links to one, and the window says so if they do', () => {
    const gmIds = new Set(GUIDE_TOPICS.filter((t) => t.audience === 'gm').map((t) => t.id));
    for (const t of GUIDE_TOPICS.filter((x) => x.audience !== 'gm')) {
      for (const m of t.body.matchAll(/href="#([^"]+)"/g)) assert.ok(!gmIds.has(m[1]!), `${t.id} (for players) links to the GM topic #${m[1]}`);
    }
    assert.equal(guideTopicFor('house-rules', false)?.body, '<p>This part of the guide is for the GM.</p>');
    assert.equal(guideTopicFor('house-rules', false)?.gmOnly, true);
    assert.match(guideTopicFor('house-rules', true)?.body ?? '', /Edit house rules/);
    assert.match(guideTopicFor('weapons', false)?.body ?? '', /Attack/);
    assert.equal(guideTopicFor('nope', true), null);
  });

  test('v0.82.0: the help window decorates folded sections and reads data-help', () => {
    const src = read('src/module/applications/help.ts');
    assert.match(HELP_HEADING_SELECTOR, /\bsummary\b/);
    assert.match(src, /querySelectorAll<HTMLElement>\(HELP_HEADING_SELECTOR\)/);
    assert.match(src, /helpTopicFor\(h\.dataset\['help'\]/);
    assert.match(src, /guideTopicFor\(/);
  });

  test('topicForHeading: exact, counts, spacing, icons and prefixes', () => {
    assert.equal(topicForHeading('Weapons')?.id, 'weapons');
    assert.equal(topicForHeading('  weapons  (3) ')?.id, 'weapons');
    assert.equal(topicForHeading('Weapons +')?.id, 'weapons');
    assert.equal(topicForHeading('CONDITION\n monitor')?.id, 'condition-monitor');
    assert.equal(topicForHeading('Knowledge skills')?.id, 'skills');
    // v0.89.7: headings built with a number or a name name their topic (data-help), so they work in any language.
    assert.equal(helpTopicFor('conjuring', 'Beschwören 5')?.id, 'conjuring');
    assert.equal(helpTopicFor('rigging', 'Fernsteuerdeck 3')?.id, 'rigging');
    assert.equal(helpTopicFor('magic', 'Gruppe: The Silver Lodge')?.id, 'magic');
    assert.equal(topicForHeading('Combat: Combat Turn 2, pass 1')?.id, 'gm-combat');
    assert.equal(topicForHeading('3. Attributes')?.id, 'attributes');
    assert.equal(topicForHeading('Under way')?.id, 'under-way');
    assert.equal(topicForHeading('Magical groups')?.id, 'gm-world');
    assert.equal(topicForHeading('Magic')?.id, 'magic');
    assert.equal(topicForHeading('Rules source')?.id, 'gm-setup');
    assert.equal(topicForHeading('Portraits by name')?.id, 'gm-setup');
    assert.equal(topicForHeading('Ally')?.id, 'conjuring');
    assert.equal(topicForHeading('Adjustments')?.id, 'npc-sheets');
    assert.equal(topicForHeading('Cost and legality')?.id, 'item-sheet');
    assert.equal(topicForHeading('Nothing like this'), null);
    assert.equal(topicForHeading(''), null);
  });

  test('guideTopicHtml', () => {
    assert.match(guideTopicHtml('weapons') ?? '', /^<h2>Weapons and armor<\/h2><p>/);
    assert.equal(guideTopicHtml('nope'), null);
  });

  test('the Markdown converter handles each allowed tag', () => {
    const md = bodyMarkdown('<p>A <strong>b</strong> <em>c</em> <code>d</code> <kbd>Alt</kbd> <a href="#weapons">e</a>.</p><ul><li>x</li><li>y</li></ul>');
    assert.equal(md, 'A **b** *c* `d` <kbd>Alt</kbd> [e](#weapons-and-armor).\n\n- x\n- y');
  });

  test('the Markdown guide has the title, contents and a GM part', () => {
    const md = guideMarkdown();
    assert.ok(md.startsWith('# SR2e player guide\n'));
    assert.ok(md.includes('## Contents'));
    // v0.76.0: one H1 per category, players' categories first.
    for (const c of GUIDE_CATEGORIES) assert.ok(md.includes(`\n# ${c.label}\n`), c.id);
    for (const t of GUIDE_TOPICS) assert.ok(md.includes(`\n## ${t.title}\n`), t.id);
    assert.ok(md.indexOf('## The GM panel') > md.indexOf('# GM: running the game'));
    assert.ok(md.indexOf('# GM: running the game') > md.indexOf('# NPCs and vehicles'));
    assert.ok(!/<(?!\/?kbd>)[a-z/!][^>]*>/.test(md.replace(/<!--[\s\S]*?-->/, '')), 'no HTML tags but kbd');
  });

  // Regenerate after changing the guide:
  //   npx tsx -e "import('./src/module/rules/guide.ts').then(m=>process.stdout.write(m.guideMarkdown()))" > docs/PLAYER-GUIDE.md
  test('docs/PLAYER-GUIDE.md is up to date with guide.ts', () => {
    assert.equal(read('docs/PLAYER-GUIDE.md'), guideMarkdown());
  });
});
