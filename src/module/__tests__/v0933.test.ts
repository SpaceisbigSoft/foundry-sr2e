/**
 * v0.93.3: table speed and the visual review's fixes. The spell window's area list (the scene's tokens, those in the
 * area first), Defend and Resist marked done per row, "Roll at once" as a player's default, Karma Pool dice in the
 * attack and spell windows, coloured pool and Karma dice (card and Dice So Nice), the Resist preview, and the Team
 * Karma tracker.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { orderAreaTargets } from '../rules/areatargets.ts';
import { tagDice, rerollFailures, successTest, type DieResult } from '../rules/dice.ts';
import { teamKarmaNext, TEAM_KARMA_MAX } from '../rules/teamkarma.ts';
import { dsnFirstWave, dsnPoolColorset, DSN_COLORSETS } from '../applications/dice.ts';
import { quickWanted } from '../applications/hotkeys.ts';
import { TOOLS } from '../rules/tools.ts';

const ROOT = process.cwd();
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), 'utf8');
const LANG = JSON.parse(read('public', 'lang', 'en.json'));
const key = (k: string) => k.split('.').reduce((o: any, p) => o?.[p], LANG);

describe('v0.93.3 the area-target list (visual review finding 4)', () => {
  const p = (uuid: string, onScene: boolean, distance: number | null = null) => ({ uuid, name: uuid, onScene, distance });
  test('only the scene\'s tokens are shown; world actors are folded', () => {
    const r = orderAreaTargets([p('a', true, 5), p('w1', false), p('b', true, 2), p('w2', false)], new Set());
    assert.deepEqual(r.shown.map((x) => x.uuid), ['b', 'a']);
    assert.deepEqual(r.folded.map((x) => x.uuid), ['w1', 'w2']);
  });
  test('ticked ones (in the area) come first, then the nearest', () => {
    const r = orderAreaTargets([p('far', true, 20), p('near', true, 3), p('in', true, 9)], new Set(['in']));
    assert.deepEqual(r.shown.map((x) => x.uuid), ['in', 'near', 'far']);
  });
  test('a ticked actor off the scene stays visible', () => {
    const r = orderAreaTargets([p('a', true), p('t', false)], new Set(['t']));
    assert.deepEqual(r.shown.map((x) => x.uuid), ['a', 't']);
    assert.equal(r.folded.length, 0);
  });
  test('nothing on the scene: the full list, as before', () => {
    const r = orderAreaTargets([p('w1', false), p('w2', false)], new Set());
    assert.deepEqual(r.shown.map((x) => x.uuid), ['w1', 'w2']);
    assert.equal(r.folded.length, 0);
  });
  test('the sheet uses it with a fold and its text', () => {
    const src = read('src', 'module', 'applications', 'sheets.ts');
    assert.ok(src.includes('orderAreaTargets(people, ticked)'));
    assert.ok(src.includes("areaTargetRows(others, game.user.targets, areaTicked, centre)"));
    assert.match(String(key('SR2E.Dialog.Sheet.areaNotOnScene')), /\{n\}/);
  });
});

describe('v0.93.3 Defend and Resist marked done (visual review findings 5, 93)', () => {
  const src = read('src', 'module', 'applications', 'chat.ts');
  test('checked per button against its own row\'s target, for the GM too', () => {
    assert.ok(src.includes('export function markUsedButtons(message: any, html: ParentNode): void'));
    assert.ok(src.includes("const target = rowTarget(message, action, index);"));
    assert.ok(src.includes('markUsedButtons(message, html);'));
    assert.ok(!src.includes("const defended = defendedOn(message, game.user?.character);"), 'the old player-only check is gone');
  });
  test('a player\'s defence on a GM card reaches other clients (the target actor\'s cardRolls)', () => {
    assert.ok(src.includes("Hooks.on('updateActor', (_actor: any, change: any) => {"));
    assert.ok(src.includes('change?.flags?.[SYSTEM_ID]?.cardRolls'));
  });
  test('the GM keeps a second roll (still clickable, the confirm asks); players see it dead', () => {
    assert.ok(src.includes("if (!game.user?.isGM) b.disabled = true;"));
    assert.ok(src.includes("b.classList.add('sr2e-used');"));
    assert.ok(key('SR2E.Card.Chat.defendedDone') && key('SR2E.Card.Chat.resistedDone'));
  });
  test('the Defend hotkey skips a done button', () => {
    assert.ok(read('src', 'module', 'applications', 'hotkeys.ts').includes("b.classList.contains('sr2e-used')"));
  });
});

describe('v0.93.3 "Roll at once" as a player\'s default (report item 9)', () => {
  test('off: Shift arms a quick roll, a plain click doesn\'t', () => {
    assert.equal(quickWanted({ shift: true, atOnce: false, action: 'rollSkill' }), true);
    assert.equal(quickWanted({ shift: false, atOnce: false, action: 'rollSkill' }), false);
  });
  test('on: a plain click arms one, Shift opens the window', () => {
    assert.equal(quickWanted({ shift: false, atOnce: true, action: 'rollSkill' }), true);
    assert.equal(quickWanted({ shift: true, atOnce: true, action: 'castSpell' }), false);
  });
  test('Defend and Resist keep their windows (Shift still skips them)', () => {
    for (const action of ['defend', 'resist', 'soak', 'dodge']) {
      assert.equal(quickWanted({ shift: false, atOnce: true, action }), false, action);
      assert.equal(quickWanted({ shift: true, atOnce: true, action }), true, action);
    }
  });
  test('never on deleting, editing or a tab', () => {
    for (const action of ['deleteItem', 'editItem', 'tab', 'removeSkill']) assert.equal(quickWanted({ shift: false, atOnce: true, action }), false, action);
  });
  test('a user-scope setting with its text', () => {
    const src = read('src', 'module', 'applications', 'interface.ts');
    assert.ok(src.includes("s.register(ID, 'rollAtOnce', {"));
    assert.match(src, /'rollAtOnce'[\s\S]{0,200}scope: 'user'/);
    assert.ok(key('SR2E.Settings.rollAtOnce.Name') && key('SR2E.Settings.rollAtOnce.Hint'));
  });
});

describe('v0.93.3 Karma Pool dice in the attack and spell windows (a known limit)', () => {
  test('the windows offer the row and pass it on', () => {
    const src = read('src', 'module', 'applications', 'sheets.ts');
    assert.ok(src.includes('...(c.karmaDice > 0 ? { karmaDice: c.karmaDice } : {}),'));
    assert.ok(src.includes('...(choice.karmaDice > 0 ? { karmaDice: choice.karmaDice } : {}),\n      useSustainingFocus'));
    assert.ok((src.match(/(?:CO923|C95G)\.karmaDiceRow\(/g) ?? []).length >= 4, 'attribute, skill, attack and spell windows');
  });
  test('attackWith and castSpell hand them to #runTest (which caps and spends them)', () => {
    const src = read('src', 'module', 'documents', 'index.ts');
    assert.ok(src.includes('karmaDice?: number;\n}') || src.includes('/** v0.93.3 (a known limit until now): Karma Pool dice bought for the attack'));
    assert.equal((src.match(/\.\.\.\(opts\.karmaDice \? \{ karmaDice: opts\.karmaDice \} : \{\}\),/g) ?? []).length, 2);
  });
});

describe('v0.93.3 coloured pool and Karma dice (report item 38)', () => {
  const die = (f: number, pool = false): DieResult => ({ faces: [f], total: f, success: f >= 4, ...(pool ? { pool: true } : {}) });
  test('tagDice marks Karma dice and the pool\'s dice, then Threat dice', () => {
    const dice = [die(1), die(2), die(5), die(6, true), die(3, true), die(4, true)];
    tagDice(dice, { base: 2, karma: 1, pool: 2, threat: 1, poolKind: 'spell' });
    assert.deepEqual(dice.map((d) => (d.karma ? 'K' : d.poolKind ?? '-')), ['-', '-', 'K', 'spell', 'spell', 'threat']);
  });
  test('an odd pool name falls back to combat', () => {
    const dice = [die(5, true)];
    tagDice(dice, { base: 0, karma: 0, pool: 1, threat: 0, poolKind: '"><x' });
    assert.equal(dice[0]!.poolKind, 'combat');
  });
  test('a Karma re-roll keeps each re-rolled die\'s colour', async () => {
    const r = await successTest({ dice: 1, poolDice: 1, targetNumber: 6, roll: async (n) => Array(n).fill(2) });
    tagDice(r.dice, { base: 0, karma: 1, pool: 1, threat: 0, poolKind: 'combat' });
    const rr = await rerollFailures(r, async (n) => Array(n).fill(3));
    assert.deepEqual(rr.dice.map((d) => [Boolean(d.karma), d.poolKind ?? '']), [[true, ''], [false, 'combat']]);
  });
  test('Dice So Nice: the first wave in groups, empty ones dropped, a colour set for each', () => {
    assert.deepEqual(dsnFirstWave({ base: 4, karma: 0, pool: 2, threat: 1, poolKind: 'hacking' }),
      [{ n: 4, colorset: 'sr2e-base' }, { n: 2, colorset: 'sr2e-pool-hacking' }, { n: 1, colorset: 'sr2e-pool-combat' }]);
    assert.equal(dsnPoolColorset('astral'), 'sr2e-pool-combat');
    const names = new Set(DSN_COLORSETS.map((c) => c.name));
    for (const g of dsnFirstWave({ base: 1, karma: 1, pool: 1, threat: 1, poolKind: 'control' })) assert.ok(names.has(g.colorset), g.colorset);
    for (const p of ['combat', 'spell', 'hacking', 'control', 'task']) assert.ok(names.has(dsnPoolColorset(p)), p);
  });
  test('#runTest tags the dice; the card prints a class and a fixed title per source', () => {
    const src = read('src', 'module', 'documents', 'index.ts');
    assert.ok(src.includes('roll: foundryRoller(rolls, dsnFirstWave(groups)),'));
    assert.ok(src.includes('tagDice(result.dice, groups);'));
    assert.ok(src.includes('title="${escText(src.title)}"'));
    for (const k of ['Combat', 'Spell', 'Hacking', 'Control', 'Task', 'Threat']) assert.ok(key(`SR2E.Card.Actor.poolDie${k}`), k);
    assert.ok(key('SR2E.Card.Actor.karmaDie'));
    const css = read('public', 'style', 'sr2e.css');
    assert.ok(css.includes('.sr2e-die.sr2e-pool-spell') && css.includes('.sr2e-die.sr2e-karma-die'));
  });
});

describe('v0.93.3 the Resist preview (report item 10)', () => {
  test('one armor and dice working for the roll and the preview', () => {
    const src = read('src', 'module', 'documents', 'index.ts');
    assert.ok(src.includes('resistArmorPlan(damageIn: DamageState, noArmor = false)'));
    assert.ok(src.includes('const ap = this.resistArmorPlan(damage, noArmor);'));
    assert.ok(src.includes('const ap = this.resistArmorPlan(damage, noArmor);\n    const type'), 'the preview uses the same plan');
    assert.ok(src.includes("this.resistDicePlan(type, Boolean(opts.astral), Boolean(opts.spiritAttacker));"));
    assert.ok(src.includes('async resistFromState(damage: DamageState, poolDice = 0, noArmor = false): Promise<void>'));
  });
  test('the window previews the TN and dice, and the armor switch reaches the roll', () => {
    const src = read('src', 'module', 'applications', 'chat.ts');
    assert.ok(src.includes('async function promptResist(target: any, damage: DamageState'));
    assert.ok(src.includes('await target.resistFromState(damage, pool, chosen.noArmor);'));
    for (const k of ['resistPreview', 'resistPreviewImmune', 'resistPreviewStops', 'resistNoArmor']) assert.ok(key(`SR2E.Dialog.Chat.${k}`), k);
    assert.ok(key('SR2E.Card.Actor.armorSkipped'));
  });
});

describe('v0.93.3 the Team Karma tracker (report item 38)', () => {
  test('a player spends one at a time, never below 0', () => {
    assert.deepEqual(teamKarmaNext(2, -1, false), { ok: true, value: 1 });
    assert.deepEqual(teamKarmaNext(0, -1, false), { ok: false, value: 0 });
    assert.deepEqual(teamKarmaNext(2, 1, false), { ok: false, value: 2 });
    assert.deepEqual(teamKarmaNext(2, -2, false), { ok: false, value: 2 });
  });
  test('the GM adds and takes away, up to the cap', () => {
    assert.deepEqual(teamKarmaNext(2, 3, true), { ok: true, value: 5 });
    assert.equal(teamKarmaNext(TEAM_KARMA_MAX, 1, true).ok, false);
    assert.equal(teamKarmaNext(3, 0, true).ok, false);
  });
  test('wired: the relay op, the setting, the tool and its text', () => {
    assert.ok(read('src', 'module', 'applications', 'socket.ts').includes("| 'teamKarma'"));
    const tk = read('src', 'module', 'applications', 'teamkarma.ts');
    assert.ok(tk.includes("onRelay('teamKarma', async (data, user) => {"));
    assert.ok(tk.includes("scope: 'world', config: true, type: Boolean, default: false"), 'off by default');
    assert.ok(read('src', 'module', 'sr2e-system.ts').includes('registerTeamKarma();'));
    assert.ok(TOOLS.some((t) => t.id === 'teamKarma' && t.who === 'player'));
    assert.ok(key('SR2E.Tools.teamKarma.label') && key('SR2E.App.TeamKarma.spentNote'));
  });
});

describe('v0.93.3 review fixes', () => {
  test('Karma Pool dice are spent once: the first target, the first shot, the acting grunt, the acting group member', () => {
    const sh = read('src', 'module', 'applications', 'sheets.ts');
    assert.ok(sh.includes('...common, ...(i > 0 ? { karmaDice: 0 } : {}), sight,'));
    assert.ok(sh.includes('...common, karmaDice: 0, ...distance, targetUuid: choice.targetUuid, earlierRoundsThisPhase: choice.earlier + 1'));
    const doc = read('src', 'module', 'documents', 'index.ts');
    assert.ok(doc.includes('delete own.karmaDice;'));
    assert.ok(doc.includes('...opts, ...(i > 0 ? { karmaDice: 0 } : {}), note: opts.note ?'));
  });
  test('Team Karma: one change at a time on a client', async () => {
    const { oneAtATime } = await import('../rules/teamkarma.ts');
    let runs = 0;
    let release!: () => void;
    const first = oneAtATime(() => new Promise<void>((r) => { runs++; release = r; }));
    await oneAtATime(async () => { runs++; });
    assert.equal(runs, 1, 'the second click is dropped while the first runs');
    release(); await first;
    await oneAtATime(async () => { runs++; });
    assert.equal(runs, 2);
  });
  test('roll request: rows rolled here wait on their tally (no second roll), and a failed roll frees the row', () => {
    const src = read('src', 'module', 'applications', 'rollrequest.ts');
    assert.ok(src.includes('!sent.has(`${message.id}:${i}`)'));
    assert.ok(src.includes('if (!done) sent.delete(key);'));
    assert.ok(src.includes('if (ok) n++; else sent.delete(`${message.id}:${i}`);'));
  });
  test('the Resist preview takes the roll\'s vulnerability and barrier steps', () => {
    const doc = read('src', 'module', 'documents', 'index.ts');
    assert.ok(doc.includes("level: vulnerableLevel(damage.level), ...(RULES.CRITTERS.vulnerability.ignoresImmunity ? { ignoreImmunity: true } : {}) };\n    const allergyPower"));
    assert.ok(doc.includes('threat: 0, barrier: true, occ: false };'));
    assert.ok(key('SR2E.Dialog.Chat.resistPreviewBarrier'));
  });
  test('"Add the book\'s links" adds only missing links (no blank or comment lines piling up)', async () => {
    const { missingWebLines } = await import('../rules/skills.ts');
    const book = '# head\nA - B: 1\n\nC > D: 2\n';
    assert.deepEqual(missingWebLines('', book), ['A - B: 1', 'C > D: 2']);
    assert.deepEqual(missingWebLines('a  -  b: 1 # mine\n', book), ['C > D: 2']);
    assert.deepEqual(missingWebLines('A - B: 1\nC > D: 2', book), []);
  });
  test('the creation wizard keeps the attribute on knowledge and language starters', () => {
    assert.ok(read('src', 'module', 'applications', 'creation.ts').includes("s.kind === 'buildRepair' ? '' : ` (${attributeDisplayLabel(s.attribute)})`"));
  });
});

describe('v0.93.3 live-run fixes', () => {
  test('a row\'s target is read as its uuid (safeStr only checks it), so the GM\'s copy is marked done', () => {
    const src = read('src', 'module', 'applications', 'chat.ts');
    assert.ok(src.includes("const uuid = safeStr(raw, 400) ? String(raw) : '';"));
    assert.ok(!src.includes('const uuid = safeStr(list[index]?.targetUuid, 400);'));
  });
  test('the Defend window previews the resistance test when there is no dodge', () => {
    const src = read('src', 'module', 'applications', 'chat.ts');
    assert.ok(src.includes("const preview = cm80 ? defendPreviewLine(defender, attack, left) : '';"));
    assert.ok(src.includes('content: `${preview}<div class="form-group"><label>${U80C.cbtDefendPoolLabel(left, cm80)}</label>'));
    assert.match(String(key('SR2E.Dialog.Chat.defendPreview')), /\{tn\}/);
  });
});
