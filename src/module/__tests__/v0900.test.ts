/**
 * v0.90.0: release polish: the author, the cover, the changelog, the minified build, GitHub's issue forms and the
 * release workflow, and the Undo heading's counted text.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), 'utf8');
const sys = JSON.parse(read('public', 'system.json'));

describe('v0.90.0 release polish', () => {
  test('the author, the cover and its credit', () => {
    assert.deepEqual(sys.authors.map((a: any) => [a.name, a.url]), [['Spaceisbig', 'https://github.com/SpaceisbigSoft']]);
    assert.equal(sys.background, 'systems/sr2e/media/cover.jpg');
    assert.ok(sys.media.some((m: any) => m.type === 'cover' && m.url === 'systems/sr2e/media/cover.jpg'));
    assert.ok(existsSync(join(ROOT, 'public', 'media', 'cover.jpg')) && existsSync(join(ROOT, 'docs', 'media', 'social.jpg')));
    // v0.90.1: the screenshots (the owner's, from the starter demo) ship with the system and show in the README.
    const shots = sys.media.filter((m: any) => m.type === 'screenshot');
    assert.equal(shots.length, 2);
    for (const m of shots) {
      const file = m.url.replace('systems/sr2e/', '');
      assert.ok(existsSync(join(ROOT, 'public', file)) && existsSync(join(ROOT, 'docs', file)) && m.caption, m.url);
      assert.ok(read('README.md').includes(`docs/${file}`), `${file} in the README`);
    }
    assert.equal(read('public', 'media', 'cover.jpg'), read('docs', 'media', 'cover.jpg'), 'the shipped cover is the built one');
    const license = read('LICENSE.md');
    assert.match(license, /Copyright © 2026 Spaceisbig and the sr2e contributors\./);
    assert.match(license, /## Cover picture[\s\S]*ChatGPT/);
    assert.match(read('README.md'), /!\[SR2e for Foundry VTT[^\]]*\]\(docs\/media\/cover\.jpg\)/);
    assert.match(JSON.stringify(JSON.parse(read('public', 'lang', 'en.json')).SR2E.Guide.Topic.credits), /ChatGPT/);
  });

  test('the changelog: every version newest first, nothing internal', () => {
    const log = read('CHANGELOG.md');
    const versions = [...log.matchAll(/^## v(\d+)\.(\d+)\.(\d+)/gm)].map((m) => [Number(m[1]), Number(m[2]), Number(m[3])]);
    assert.ok(versions.length >= 99);
    assert.deepEqual(versions[0], sys.version.split('.').map(Number), 'the newest entry is this version');
    for (let i = 1; i < versions.length; i++) {
      const [a, b] = [versions[i - 1]!, versions[i]!];
      assert.ok(a[0]! * 1e6 + a[1]! * 1e3 + a[2]! > b[0]! * 1e6 + b[1]! * 1e3 + b[2]!, `order at ${b.join('.')}`);
    }
    assert.ok(!/GM AI|ZZ Testplayer|\bZZ |spreadsheet|src\/module|\.test\.ts/.test(log));
  });

  test('the build is minified with names kept; the wrappers found by name in the stack are object methods', () => {
    const pkg = JSON.parse(read('package.json'));
    assert.match(pkg.scripts.build, /&& node scripts\/minify\.mjs$/);
    assert.ok(pkg.devDependencies.esbuild, 'esbuild is a declared dependency (scripts/minify.mjs imports it)');
    assert.match(read('scripts', 'minify.mjs'), /keepNames: true/);
    assert.match(read('src', 'module', 'applications', 'look.ts'), /const sr2eDialogWrap = \(\{\s*sr2eDialogWrap\(this: any/);
    assert.match(read('src', 'module', 'applications', 'interface.ts'), /const sr2eNoteWrap = \(\{ sr2eNoteWrap\(message: unknown/);
    // The built bundle, when there is one (the release workflow builds after the tests).
    const built = join(ROOT, 'public', 'index.mjs');
    if (existsSync(built)) {
      const js = readFileSync(built, 'utf8');
      assert.match(js, /sr2eDialogWrap\(/, 'the dialog wrapper keeps its method name');
      assert.match(js, /sr2eNoteWrap\(/, 'the notification wrapper keeps its method name');
      for (const cls of ['SR2CharacterSheet', 'SR2NpcSheet', 'SR2SafehouseSheet', 'SR2ItemSheet']) assert.ok(js.includes(`"${cls}"`), `${cls} keeps its name (Foundry keys sheets by it)`);
    }
  });

  test('GitHub: the issue forms and the release workflow', () => {
    const bug = read('.github', 'ISSUE_TEMPLATE', 'bug_report.yml');
    assert.match(bug, /Report a bug/);
    assert.match(read('.github', 'ISSUE_TEMPLATE', 'rules_question.yml'), /don't copy rulebook text/);
    const wf = read('.github', 'workflows', 'release.yml');
    for (const step of ['npm ci', 'npm run typecheck', 'npm test', 'npm run build']) assert.ok(wf.includes(`run: ${step}`), step);
    assert.match(wf, /releases\/latest\/download\/system\.json/);
    assert.match(wf, /releases\/download\/' \+ process\.env\.GITHUB_REF_NAME \+ '\/sr2e\.zip/);
    assert.match(wf, /test "v\$v" = "\$\{GITHUB_REF_NAME\}"/);
  });

  test('the Undo heading is one counted text', () => {
    assert.ok(!read('public', 'templates', 'gm-panel.hbs').includes('(eq undo.total 1)'));
    const ui = JSON.parse(read('public', 'lang', 'en.json')).SR2E;
    assert.deepEqual(Object.keys(ui.App.Ui.stepsKept), ['one', 'other']);
    assert.equal(ui.UI.step, undefined);
  });
});
