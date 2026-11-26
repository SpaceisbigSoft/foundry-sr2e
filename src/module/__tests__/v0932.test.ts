/**
 * v0.93.2: docs, policy and CI. The version policy and the manifest maximum, the take-down and AI statements, the
 * stable scripting interface (every call the system registers is in docs/API.md and the other way round), the CI
 * workflow, manual dice entry (every die goes through Foundry's Roll), the new pages, and the move's empty flags.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';

const ROOT = process.cwd();
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), 'utf8');
const NEW = 'shadowrun2e_unified';

/** The property names of `game.sr2e = {…}` and of its `api: {…}`, read from sr2e-system.ts's syntax tree. */
function registeredApi(): { top: string[]; api: string[] } {
  const src = read('src', 'module', 'sr2e-system.ts');
  const sf = ts.createSourceFile('sr2e-system.ts', src, ts.ScriptTarget.Latest, true);
  let top: ts.ObjectLiteralExpression | null = null;
  const visit = (n: ts.Node) => {
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken && /\.sr2e$/.test(n.left.getText(sf)) && ts.isObjectLiteralExpression(n.right)) top = n.right;
    ts.forEachChild(n, visit);
  };
  visit(sf);
  assert.ok(top, 'game.sr2e = { … } in sr2e-system.ts');
  const names = (o: ts.ObjectLiteralExpression) => o.properties.map((p) => (p.name ? p.name.getText(sf) : p.getText(sf)));
  const apiProp = (top as ts.ObjectLiteralExpression).properties.find((p) => p.name?.getText(sf) === 'api');
  assert.ok(apiProp && ts.isPropertyAssignment(apiProp) && ts.isObjectLiteralExpression(apiProp.initializer), 'api: { … }');
  return { top: names(top!).filter((n) => n !== 'api'), api: names((apiProp as ts.PropertyAssignment).initializer as ts.ObjectLiteralExpression) };
}

/** The call names docs/API.md's tables list for `game.sr2e` (its first table) and `game.sr2e.api` (the rest). */
function documentedApi(): { top: Set<string>; api: Set<string> } {
  const doc = read('docs', 'API.md');
  const sections = doc.split(/\n## /);
  const top = new Set<string>(); const api = new Set<string>();
  for (const sec of sections) {
    const head = sec.split('\n')[0] ?? '';
    const into = /^`game\.sr2e`$/.test(head.trim()) ? top : /game\.sr2e\.api/.test(head) ? api : null;
    if (!into) continue;
    for (const line of sec.split('\n')) {
      if (!line.startsWith('| `')) continue;
      const cell = line.split('|')[1] ?? '';
      for (const m of cell.matchAll(/`([A-Za-z_$][\w$]*)/g)) into.add(m[1]!);
    }
  }
  return { top, api };
}

describe('v0.93.2: the stable scripting interface', () => {
  test('every call on game.sr2e and game.sr2e.api is listed in docs/API.md', () => {
    const reg = registeredApi(); const doc = documentedApi();
    assert.ok(reg.api.length > 40, 'the api object was read');
    assert.deepEqual(reg.top.filter((n) => !doc.top.has(n)), [], 'game.sr2e calls missing from the docs');
    assert.deepEqual(reg.api.filter((n) => !doc.api.has(n)), [], 'game.sr2e.api calls missing from docs/API.md (add them, and an "API changes" line)');
  });

  test('every call docs/API.md lists still exists (a removal needs a deprecation first, docs/API.md "Stability")', () => {
    const reg = registeredApi(); const doc = documentedApi();
    const api = new Set(reg.api); const top = new Set(reg.top);
    assert.deepEqual([...doc.top].filter((n) => !top.has(n)), []);
    assert.deepEqual([...doc.api].filter((n) => !api.has(n)), []);
  });

  test('every sr2e.* hook the code calls is documented', () => {
    const doc = read('docs', 'API.md');
    const files = (readdirSync(join(ROOT, 'src', 'module'), { recursive: true }) as string[])
      .map((f) => String(f).replace(/\\/g, '/')).filter((f) => f.endsWith('.ts') && !f.includes('__tests__')).map((f) => join('src', 'module', f));
    const hooks = new Set<string>();
    for (const f of files) for (const m of read(f).matchAll(/Hooks\.call(?:All)?\(\s*["'](sr2e\.[A-Za-z]+)["']/g)) hooks.add(m[1]!);
    assert.ok(hooks.has('sr2e.ready'));
    assert.deepEqual([...hooks].filter((h) => !doc.includes(`\`${h}\``)), []);
  });

  test('the stability rules, and an "API changes" line for this version in API.md and the changelog', () => {
    const doc = read('docs', 'API.md');
    const version = JSON.parse(read('public', 'system.json')).version as string;
    assert.match(doc, /## Stability/);
    assert.match(doc, /deprecated/);
    assert.ok(doc.includes(`- **v${version}:**`), 'API.md "API changes" names this version');
    const log = read('CHANGELOG.md');
    const entry = log.slice(log.indexOf(`## v${version}`), log.indexOf('\n## v', log.indexOf(`## v${version}`) + 5));
    assert.ok(entry.length > 20, `CHANGELOG.md has a v${version} entry`);
    assert.match(entry, /API changes/);
  });
});

describe('v0.93.2: the version policy, take-down and AI statements', () => {
  test('system.json says Foundry 14 is the highest version, and the README has the version table', () => {
    const sys = JSON.parse(read('public', 'system.json'));
    assert.equal(Number(sys.compatibility.minimum), 14);
    assert.equal(Number(sys.compatibility.verified), 14);
    assert.equal(Number(sys.compatibility.maximum), 14, 'raise only after a live run on the new Foundry version');
    const readme = read('README.md');
    assert.match(readme, /## Foundry versions/);
    assert.match(readme, /\*\*v15\*\* \| not yet/);
    assert.match(readme, /releases\/download\/vX\.Y\.Z\/shadowrun2e_unified\.json/, 'how to install an older release');
  });

  test('the take-down statement is in the README, LICENSE.md (both copies) and the guide', () => {
    assert.match(read('README.md'), /If you hold rights in Shadowrun/);
    assert.match(read('LICENSE.md'), /## If you hold rights in Shadowrun/);
    assert.equal(read('public', 'LICENSE.md'), read('LICENSE.md'));
    const lang = JSON.parse(read('public', 'lang', 'en.json'));
    assert.match(lang.SR2E.Guide.Topic.credits.b5, /If you hold rights in Shadowrun/);
  });

  test('the AI statement names the owner\'s decisions', () => {
    const readme = read('README.md');
    assert.match(readme, /\*\*Who decided what\.\*\*/);
    for (const part of ['CC BY-SA 4.0', 'official SR2 books', 'players are untrusted', 'one theme per window', 'shadowrun2e_unified']) {
      assert.ok(readme.slice(readme.indexOf('Who decided what'), readme.indexOf('## Status')).includes(part), part);
    }
    assert.match(read('LICENSE.md'), /The owner chose what to build and made the design and rules decisions/);
  });
});

describe('v0.93.2: CI on every push', () => {
  test('ci.yml runs the type-check, the tests and the build on push and pull requests, on Linux and Windows', () => {
    const ci = read('.github', 'workflows', 'ci.yml');
    assert.match(ci, /^on:\n  push:/m);
    assert.match(ci, /^  pull_request:/m);
    for (const step of ['npm ci', 'npm run typecheck', 'npm test', 'npm run build']) assert.ok(ci.includes(step), step);
    assert.match(ci, /ubuntu-latest, windows-latest/);
    assert.match(ci, /permissions:\n  contents: read/, 'read-only token');
  });
});

describe('v0.93.2: manual dice entry', () => {
  test('every SR2e die is a Foundry Roll evaluated the normal way (so a manual or other fulfilment method can supply it)', () => {
    for (const f of ['documents/index.ts', 'applications/chat.ts', 'applications/inline.ts', 'applications/creation.ts']) {
      const src = read('src', 'module', f);
      assert.doesNotMatch(src, /evaluateSync|allowInteraction:\s*false/, `${f}: no synchronous or non-interactive rolls`);
    }
    // The engine's dice come through one adapter: a Foundry Roll per wave.
    const docs = read('src', 'module', 'documents', 'index.ts');
    assert.match(docs, /function foundryRoller\(sink: any\[\]\): DiceRoller \{\n  return async \(count: number\) => \{\n    const roll = await new Roll\(`\$\{count\}d6`\)\.evaluate\(\);/);
    // A die from Math.random appears once in the test pipeline: the fallback when a Roll can't be made at all (the other
    // Math.random calls make ids).
    assert.equal((docs.match(/Math\.floor\(Math\.random\(\) \*/g) ?? []).length, 1);
    assert.equal((read('src', 'module', 'applications', 'chat.ts').match(/Math\.random\(\)/g) ?? []).length, 0);
  });

  test('the guide explains it, and the in-Foundry batch checks it', () => {
    const lang = JSON.parse(read('public', 'lang', 'en.json'));
    assert.match(lang.SR2E.Guide.Topic.physicalDice.b2.i1, /Dice Configuration/);
    const q = read('src', 'quench', 'sr2e-quench.ts');
    assert.match(q, /CONFIG as any\)\.Dice\?\.fulfillment\?\.methods/);
    assert.match(q, /reg\('cardflow'/);
    assert.match(q, /game\.settings\.set\('core', 'diceConfiguration', oldConfig\)/, 'puts the user\'s dice configuration back');
  });
});

describe('v0.93.2: the move skips empty old flags', () => {
  test('a document whose old flags are {} is not changed', async () => {
    const { moveUpdate } = await import('../helpers/move.ts');
    assert.equal(moveUpdate({ _id: 'a', name: 'x', flags: { sr2e: {} } }, NEW), null);
    assert.equal(moveUpdate({ _id: 'a', name: 'x', flags: { sr2e: {}, [NEW]: { a: 1 } } }, NEW), null);
    assert.deepEqual(moveUpdate({ _id: 'a', flags: { sr2e: {} }, img: 'systems/sr2e/x.svg' }, NEW), { img: `systems/${NEW}/x.svg` });
    assert.deepEqual(moveUpdate({ _id: 'a', flags: { sr2e: { k: 1 } } }, NEW), { [`flags.${NEW}`]: { k: 1 } });
  });
});
