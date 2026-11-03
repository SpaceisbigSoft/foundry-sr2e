/**
 * v0.89.7: localization, last slice: the in-game guide. Topic titles, paragraphs and list items, the category labels
 * and the GM-only note are in lang/en.json (`SR2E.Guide`); rules/guide.ts keeps ids, audiences, the English heading
 * ids and each topic's blocks.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readdirSync } from 'node:fs';
import { englishTemplate } from './helpers/english.ts';
import { GUIDE_TOPICS, GUIDE_CATEGORIES, guideTopicKeys, guideKeyPart, guideTopicFor, guideMarkdown, guideTopicHtml, topicForHeading } from '../rules/guide.ts';

const ROOT = process.cwd();
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), 'utf8');
const lang = JSON.parse(read('public', 'lang', 'en.json'));
const get = (key: string): unknown => key.split('.').slice(1).reduce((o: any, p) => o?.[p], lang.SR2E);
const leaves = (o: any, p: string, out: string[] = []): string[] => {
  for (const [k, v] of Object.entries(o ?? {})) { if (v && typeof v === 'object') leaves(v, `${p}.${k}`, out); else out.push(`${p}.${k}`); }
  return out;
};
const TOPIC_IDS = new Set(GUIDE_TOPICS.map((t) => t.id));

describe('v0.89.7 the guide in the language file', () => {
  test('every topic key is a text in lang/en.json, and every guide text belongs to a topic, a category or the GM note', () => {
    const want = new Set<string>(['SR2E.Guide.gmOnly']);
    for (const t of GUIDE_TOPICS) for (const k of guideTopicKeys(t)) want.add(k);
    for (const c of GUIDE_CATEGORIES) want.add(`SR2E.Guide.Category.${guideKeyPart(c.id)}`);
    const missing = [...want].filter((k) => typeof get(k) !== 'string' || !String(get(k)).trim());
    assert.deepEqual(missing, []);
    const extra = leaves(lang.SR2E.Guide, 'SR2E.Guide').filter((k) => !want.has(k));
    assert.deepEqual(extra, []);
  });

  test('guide texts hold only the inline tags, balanced, and their links go to topics', () => {
    const bad: string[] = [];
    for (const k of leaves(lang.SR2E.Guide, 'SR2E.Guide')) {
      const v = String(get(k));
      const stack: string[] = [];
      for (const m of v.matchAll(/<(\/?)([a-z0-9]+)([^>]*)>/g)) {
        const [, close, tag, attrs] = m;
        if (!['strong', 'em', 'kbd', 'code', 'a'].includes(tag!)) { bad.push(`${k}: <${tag}>`); continue; }
        if (close) { if (stack.pop() !== tag) bad.push(`${k}: unbalanced </${tag}>`); continue; }
        if (tag === 'a') {
          const href = /^ href="#([a-z0-9-]+)"$/.exec(attrs ?? '');
          if (!href) bad.push(`${k}: link ${attrs}`);
          else if (!TOPIC_IDS.has(href[1]!)) bad.push(`${k}: link to unknown topic ${href[1]}`);
        } else if (attrs) bad.push(`${k}: <${tag}${attrs}>`);
        stack.push(tag!);
      }
      if (stack.length) bad.push(`${k}: unclosed ${stack.join(', ')}`);
      if (/<|>/.test(v.replace(/<\/?(strong|em|kbd|code)>|<a href="#[a-z0-9-]+">|<\/a>/g, ''))) bad.push(`${k}: a stray < or >`);
    }
    assert.deepEqual(bad, []);
  });

  test('the bodies, titles and labels show text, never a key; guide.ts holds no English text', () => {
    for (const t of GUIDE_TOPICS) {
      assert.ok(!t.title.startsWith('SR2E.') && !t.body.includes('SR2E.Guide'), t.id);
      assert.match(t.body, /^<(p|ul)>/);
    }
    for (const c of GUIDE_CATEGORIES) assert.ok(!c.label.startsWith('SR2E.'), c.id);
    assert.equal(guideTopicFor('gm-panel', false)?.body, '<p>This part of the guide is for the GM.</p>');
    const src = read('src', 'module', 'rules', 'guide.ts');
    assert.ok(!/`\s*<p>[A-Z]/.test(src) && !/label: '/.test(src), 'no topic body or category label left in the code');
  });

  test('a translation is read when the guide is shown (not at load)', () => {
    const en = (globalThis as any).__SR2E_EN__;
    const keys = ['SR2E.Guide.Topic.gettingStarted.title', 'SR2E.Guide.Topic.gettingStarted.b1', 'SR2E.Guide.Category.start'];
    const saved = keys.map((k) => en[k]);
    try {
      en[keys[0]!] = 'Erste Schritte';
      en[keys[1]!] = 'Dieser <strong>Leitfaden</strong>.';
      en[keys[2]!] = 'Hier anfangen';
      assert.ok(guideTopicHtml('getting-started')!.startsWith('<h2>Erste Schritte</h2><p>Dieser <strong>Leitfaden</strong>.</p>'));
      assert.equal(GUIDE_CATEGORIES[0]!.label, 'Hier anfangen');
      assert.match(guideMarkdown(), /\*\*Hier anfangen\*\*/);
    } finally {
      keys.forEach((k, i) => { en[k] = saved[i]; });
    }
  });

  test('the English guide is unchanged (docs/PLAYER-GUIDE.md), and the help link label is a key', () => {
    assert.equal(guideMarkdown(), read('docs', 'PLAYER-GUIDE.md'));
    const help = read('src', 'module', 'applications', 'help.ts');
    assert.ok(help.includes("tx('SR2E.App.Help.helpFor', { title: topic.title })") && !help.includes('`Help: '));
  });

  test('review fixes: braces in a guide text stay; headings the guide explains carry an English id in every template', () => {
    const en = (globalThis as any).__SR2E_EN__;
    const key = 'SR2E.Guide.Topic.inlineTests.b1';
    const saved = en[key];
    try {
      en[key] = 'Zum Beispiel <code>@SR2Test[Firearms tn 5]{Schloss}</code>.';
      assert.ok(guideTopicHtml('inline-tests')!.includes('<code>@SR2Test[Firearms tn 5]{Schloss}</code>'));
    } finally { en[key] = saved; }
    // A heading without data-heading / data-help is found by its shown text, which is translated: no "?" in another language.
    const TPL = join(ROOT, 'public', 'templates');
    const bad: string[] = [];
    for (const f of readdirSync(TPL).filter((x) => x.endsWith('.hbs'))) {
      const src = englishTemplate(read('public', 'templates', f));
      for (const m of src.matchAll(/<(h2|h3|legend)([^>]*)>([\s\S]*?)<\/\1>/g)) {
        if (/data-(heading|help)=/.test(m[2]!)) continue;
        const text = m[3]!.replace(/<(span|button|a|select|label)\b[\s\S]*?<\/\1>/g, ' ').replace(/\{\{[\s\S]*?\}\}/g, ' ').replace(/<[^>]+>/g, ' ');
        const t = topicForHeading(text);
        if (t) bad.push(`${f}: "${text.replace(/\s+/g, ' ').trim()}" → ${t.id}`);
      }
    }
    assert.deepEqual(bad, []);
    // help.ts reads titles only when it decorates or renders (no top-level use of the topics).
    const help = read('src', 'module', 'applications', 'help.ts');
    assert.ok(!/^(export )?const [^=]+= *[^;]*GUIDE_(TOPICS|CATEGORIES)/m.test(help));
  });
});
