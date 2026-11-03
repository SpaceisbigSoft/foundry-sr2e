import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const read = (...p: string[]) => readFileSync(join(root, ...p), 'utf8');

describe('v0.74.0 chat-card cleanup', async () => {
  const { plainSystemCard } = await import('../applications/look.ts');
  test('plain system notices count as our cards; typed chat, dice rolls and other packages do not', () => {
    assert.equal(plainSystemCard({ content: '<p><strong>ZZ Rigger</strong> starts: Installing.</p>', flags: {} }), true);
    assert.equal(plainSystemCard({ content: '<p>ZZ Ped is no longer paralysis.</p>' }), true);
    assert.equal(plainSystemCard({ content: 'hello everyone', flags: {} }), false);
    assert.equal(plainSystemCard({ content: '<div>1d6</div>', rolls: [{}] }), false);
    assert.equal(plainSystemCard({ content: '<p>x</p>', flags: { 'dice-so-nice': {} } }), false);
    assert.equal(plainSystemCard({ content: '<p>x</p>', flags: { core: { canPopout: true } } }), true);
    assert.equal(plainSystemCard({ content: '<p>x</p>', flags: { core: { RollTable: 'abc' } } }), false);
    assert.equal(plainSystemCard({ content: '<p>typed</p>', style: 1 }), false);
    assert.equal(plainSystemCard({ content: '<p>Roll <a class="inline-roll">4</a></p>' }), false);
  });
  test('outcomes are classed and styled from the palette', () => {
    const src = read('src', 'module', 'applications', 'look.ts');
    for (const want of ["sr2e-card-chat", "sr2e-count-good", "sr2e-count-zero", "sr2e-outcome-${out}", "sr2e-card-note", "sr2e-count-tie", "'dodged'"]) assert.ok(src.includes(want), want);
    const css = read('public', 'style', 'sr2e.css');
    const part = css.slice(css.indexOf('v0.74.0: outcomes that read at a glance'));
    assert.ok(part.length > 500);
    assert.ok(!/#[0-9a-f]{3,8}\b|rgba?\(/i.test(part.replace(/\/\*[\s\S]*?\*\//g, '')));
    for (const want of ['.sr2e-banner-taken)::before { content: "✖ "; }', '.sr2e-banner-dodged)::before { content: "✔ "; }', '.sr2e-contest-result', 'sr2e-outcome-bad', 'body.sr2e-dice-colourblind li.chat-message.sr2e-card .sr2e-count.sr2e-count-zero']) assert.ok(part.includes(want), want);
    const look = read('src', 'module', 'rules', 'look.ts');
    assert.ok(look.includes("'--sr2e-good-fill': '#1b7a3d'") && look.includes("'--sr2e-bad-fill': '#b3261e'"));
  });
});
