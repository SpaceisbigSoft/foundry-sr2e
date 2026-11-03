/**
 * v0.89.4: write the rules tables' texts (labels, notes … see src/module/rules/rulestext.ts) into lang/en.json:
 * `SR2E.Rules.<path>` from RULES as shipped, `SR2E.RulesUrr.<path>` from the Revamp's patch, `SR2E.Tables.<key>.*` from
 * the other tables (rules/texttables.ts). The code keeps the same
 * English; settings.ts translates the tables in place once Foundry has its languages.
 *
 *   npx tsx scripts/i18n-rules.ts           write the keys (the two groups are rebuilt from the tables)
 *   npx tsx scripts/i18n-rules.ts --check   exit 1 when lang/en.json and the tables differ
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { RULES, URR_V80_PATCH } from '../src/module/rules/index.ts';
import { rulesTexts, patchTexts, tableTexts, type RulesText } from '../src/module/rules/rulestext.ts';
import { TEXT_TABLES } from '../src/module/rules/texttables.ts';

const LANG = join(process.cwd(), 'public', 'lang', 'en.json');
const CHECK = process.argv.includes('--check');
const lang = JSON.parse(readFileSync(LANG, 'utf8'));

function nest(list: RulesText[], prefix: string): Record<string, unknown> {
  const root: Record<string, any> = {};
  for (const t of list) {
    const segs = t.key.slice(prefix.length + 1).split('.');
    let o = root;
    for (const s of segs.slice(0, -1)) {
      if (typeof o[s] === 'string') throw new Error(`${t.key}: a text and a group at the same key`);
      o = (o[s] ??= {});
    }
    const last = segs[segs.length - 1]!;
    if (Object.hasOwn(o, last) && o[last] !== t.text) throw new Error(`${t.key}: two texts`);
    if (o[last] && typeof o[last] === 'object') throw new Error(`${t.key}: a group and a text at the same key`);
    o[last] = t.text;
  }
  return root;
}
const rules = nest(rulesTexts(RULES, 'SR2E.Rules'), 'SR2E.Rules');
const urr = nest(patchTexts(URR_V80_PATCH as Record<string, unknown>, 'SR2E.RulesUrr'), 'SR2E.RulesUrr');
const tables = nest(TEXT_TABLES.flatMap((t) => tableTexts(t)), 'SR2E.Tables');
const same = JSON.stringify(lang.SR2E.Rules ?? null) === JSON.stringify(rules) && JSON.stringify(lang.SR2E.RulesUrr ?? null) === JSON.stringify(urr) && JSON.stringify(lang.SR2E.Tables ?? null) === JSON.stringify(tables);
const count = (o: unknown): number => (typeof o === 'string' ? 1 : o && typeof o === 'object' ? Object.values(o).reduce((n: number, v) => n + count(v), 0) : 0);
console.log(`${count(rules)} rules texts, ${count(urr)} Revamp texts, ${count(tables)} table texts${CHECK ? (same ? ': up to date' : ': lang/en.json differs') : ''}`);
if (CHECK) process.exit(same ? 0 : 1);
lang.SR2E.Rules = rules;
lang.SR2E.RulesUrr = urr;
lang.SR2E.Tables = tables;
writeFileSync(LANG, JSON.stringify(lang, null, 2) + '\n');
