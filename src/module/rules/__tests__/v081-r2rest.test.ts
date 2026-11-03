/**
 * v0.81.0 fix round 2, RF-REST: regression tests for RV/R2-REST.md (the importer regressions 1-3, S-5, S-7, S-15,
 * the orphaned doc comment and urr80-core's escaping). Each failed before its fix. The importer cases use the
 * reviewer's exact probe inputs (RV/../r2rest/t/ci.mts, ci2.mts, csv.mts) plus neighbouring real-world layouts.
 * sheets.ts can't be imported in node, so its checks read the source (and compile two small helpers).
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { RULES } from '../config.ts';
import { parseCharacterSheet } from '../charimport.ts';
import { rowsToTemplates } from '../catalogcsv.ts';
import { urrCoreTnPresetRow } from '../urr80-core.ts';
import { escHtml } from '../html.ts';
import { t as tx } from '../../helpers/i18n.ts';

const makeId = () => 'id';

describe('R2-REST 1: a colonless value label after an inline list ends the list', () => {
  test('the reviewer\'s sheet: karma, nuyen and lifestyle are read, the gear has two entries', () => {
    const p = parseCharacterSheet(`Name: Ghost
Metatype: Elf
Gear: Ares Predator, Armor jacket
Karma 12
Nuyen 5,000¥
Lifestyle Middle

Contacts: Bob (Fixer)
Edges: Ambidextrous
Flaws: Bad luck`);
    assert.deepEqual(p.gear.map((g) => g.name), ['Ares Predator', 'Armor jacket']);
    assert.equal(p.karma.good, 12);
    assert.equal(p.nuyen, 5000);
    assert.equal(p.lifestyle?.level, 'middle');
    assert.deepEqual(p.contacts.map((c) => c.name), ['Bob']);
    assert.deepEqual(p.unknown, []);
  });
  test('a bare "Gear:" header with unindented entries keeps value-like entries (RC-1 still holds)', () => {
    const p = parseCharacterSheet('Nuyen: 12,000\nGear:\nAres Predator [9M]\nCredstick 1500\nMedkit 3');
    assert.equal(p.nuyen, 12000);
    assert.match(p.gear.map((g) => g.name.toLowerCase()).join('|'), /credstick/);
  });
  test('an indented entry under an inline list is still an entry', () => {
    const p = parseCharacterSheet('Nuyen: 300\nGear: Ares Predator\n  Credstick 1500\n  Grade 2 rations');
    assert.equal(p.nuyen, 300);
    assert.equal(p.initiateGrade, undefined);
    const names = p.gear.map((g) => g.name.toLowerCase()).join('|');
    assert.match(names, /credstick/);
    assert.match(names, /rations/);
  });
  test('the RC-1 layout (indented under a bare header) is unchanged', () => {
    const p = parseCharacterSheet('Nuyen: 12,000\nGear:\n  Ares Predator [9M]\n  Credstick 1500\n  Medkit 3\n  Grade 2 rations x10');
    assert.equal(p.nuyen, 12000);
    assert.equal(p.initiateGrade, undefined);
    assert.deepEqual(p.unknown, []);
  });
});

describe('R2-REST 3: a lower-case level after a STR code is a weapon', () => {
  const p = parseCharacterSheet(`Name: X
Gear: Ares Predator 9M, Katana (STR+3)M, Combat axe (Str+4)S, Knife (STR) L, Rope 100m, 2x Ares Predator [9M], Stun baton 6s Stun, Survival knife (str+1)m

Edges: Ambidextrous
Exceptional Attribute (Body)
Flaws: Bad luck
Allergy (common, mild)`);
  test('the reviewer\'s line: "Survival knife (str+1)m" is a weapon named "Survival knife"', () => {
    assert.ok(p.weapons.some((w) => w.name === 'Survival knife'), JSON.stringify(p.weapons.map((w) => w.name)));
    assert.ok(!p.gear.some((g) => /survival knife/i.test(g.name)));
  });
  test('the other STR forms and "9M" are weapons; "Rope 100m" stays gear', () => {
    const names = p.weapons.map((w) => w.name);
    for (const n of ['Ares Predator', 'Katana', 'Combat axe', 'Knife']) assert.ok(names.includes(n), n);
    assert.ok(p.gear.some((g) => g.name === 'Rope 100m'));
  });
  test('neighbouring shapes: "Club (str)s", "Sword (STR+2) m", "Dagger (strength+1)l"', () => {
    const q = parseCharacterSheet('Gear: Club (str)s, Sword (STR+2) m, Dagger (strength+1)l, Cable 20m');
    assert.deepEqual(q.weapons.map((w) => w.name).sort(), ['Club', 'Dagger', 'Sword']);
    assert.deepEqual(q.gear.map((g) => g.name), ['Cable 20m']);
  });
});

describe('R2-REST 2: the "B/I" armor header', () => {
  test('the reviewer\'s row: armor B/I 5/3 gives Ballistic 5 and Impact 3', () => {
    const r = rowsToTemplates('Name,Type,B/I,Cost\nArmor jacket,armor,5/3,900', { makeId });
    assert.deepEqual(r.errors, []);
    assert.deepEqual(r.unknownColumns, []);
    assert.deepEqual(r.templates[0]!.system, { ballistic: 5, impact: 3, cost: 900 });
  });
  test('"BI" and "B / I" headers on armor and adept powers', () => {
    const a = rowsToTemplates('Name,Type,BI\nLined coat,armor,4/2', { makeId });
    assert.equal(a.templates[0]!.system['ballistic'], 4);
    assert.equal(a.templates[0]!.system['impact'], 2);
    const p = rowsToTemplates('Name,Type,B / I\nMystic Armor,adeptpower,1/1', { makeId });
    assert.deepEqual(p.errors, []);
    assert.equal(p.templates[0]!.system['ballistic'], 1);
  });
  test('bioware and cyberware keep "BI" as the Body Index (RC-5)', () => {
    const b = rowsToTemplates('Name,Type,BI\nMuscle Aug,bioware,0.4', { makeId });
    assert.equal(b.templates[0]!.system['bodyIndex'], 0.4);
    const c = rowsToTemplates('Name,Type,BI\nTailored pheromones,cyberware,0.6', { makeId });
    assert.deepEqual(c.errors, []);
    assert.equal(c.templates[0]!.system['bodyIndex'], 0.6);
  });
});

describe('R2-REST 12: urr80-core escapes with escHtml', () => {
  test('a GM-edited TN preset label with a quote and markup is escaped (apostrophe too)', () => {
    const v: any = RULES.URR_V80;
    const saved = { on: v.coreTnPresets, list: v.coreDifficulty };
    v.coreTnPresets = true;
    v.coreDifficulty = [{ id: 'x', label: `Corvo's <b>"hard"</b>`, tn: 6 }];
    try {
      const html = urrCoreTnPresetRow('');
      assert.ok(html.includes(escHtml(`Corvo's <b>"hard"</b>`)));
      assert.ok(html.includes('&#39;') || html.includes('&#x27;'));
      assert.ok(!html.includes('<b>'));
    } finally {
      v.coreTnPresets = saved.on;
      v.coreDifficulty = saved.list;
    }
  });
  test('no local escape helper is left', () => {
    const src = readFileSync(join(process.cwd(), 'src', 'module', 'rules', 'urr80-core.ts'), 'utf8');
    assert.ok(!/const esc\s*=/.test(src));
  });
});

// ---- sheets.ts (read as source)
const SRC = readFileSync(join(process.cwd(), 'src', 'module', 'applications', 'sheets.ts'), 'utf8');
const sf = ts.createSourceFile('sheets.ts', SRC, ts.ScriptTarget.Latest, true);
function walk(n: ts.Node, f: (n: ts.Node) => void): void { f(n); ts.forEachChild(n, (c) => walk(c, f)); }
function fnSource(name: string): string {
  let out = '';
  walk(sf, (n) => {
    if (out) return;
    if (ts.isFunctionDeclaration(n) && n.name?.text === name) out = n.getText();
    if (ts.isMethodDeclaration(n) && n.name.getText() === name) out = n.getText();
  });
  assert.ok(out, `found ${name}`);
  return out;
}
function compile(name: string, scope: Record<string, unknown>): any {
  const js = ts.transpileModule(fnSource(name), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
  const keys = Object.keys(scope);
  return new Function(...keys, `${js}\nreturn ${name};`)(...keys.map((k) => scope[k]));
}

describe('R2-REST 4 (S-5): no invisibility roll before the attack dialog returns', () => {
  test('seeThroughInvisibility is called once, after "if (!choice) return;", for the final target', () => {
    const src = fnSource('#onAttackWeapon');
    const cancel = src.indexOf('if (!choice) return;');
    assert.ok(cancel > 0);
    assert.equal((src.match(/actor\.seeThroughInvisibility\(/g) ?? []).length, 1);
    assert.ok(!src.slice(0, cancel).includes('actor.seeThroughInvisibility('), 'no roll before the dialog');
    assert.ok(!src.includes('seeThroughInvisibility(targetToken.actor)'));
    assert.match(src.slice(cancel), /fromUuidSync\(choice\.targetUuid\)[\s\S]{0,200}await actor\.seeThroughInvisibility\(picked\)/);
  });
  test('an auto-detected blind visibility follows the roll; a hand-picked one is kept', () => {
    const src = fnSource('#onAttackWeapon');
    assert.match(src, /if \(shown\.conceal\?\.blind && !now\.conceal\?\.blind && choice\.visibility === visFor\(shown\)\) choice\.visibility = visFor\(now\);/);
  });
});

describe('R2-REST 5 (S-7): dismissing a spirit is all or nothing', () => {
  const makeWorld = (opts: { refuse?: Set<string>; silent?: boolean; userMay?: (t: any) => boolean } = {}) => {
    const log: string[] = [];
    const mkScene = (id: string, tokenIds: string[]) => {
      const map = new Map(tokenIds.map((t) => [t, { id: t, actorId: 'sp', canUserModify: (_u: any, _a: string) => opts.userMay?.({ id: t, scene: id }) ?? true }]));
      return {
        id, name: id,
        tokens: Object.assign([...map.values()], { get: (k: string) => map.get(k) }),
        async deleteEmbeddedDocuments(_t: string, ids: string[]) {
          if (opts.refuse?.has(id)) {
            if (opts.silent) return [];
            throw new Error('no permission');
          }
          for (const i of ids) map.delete(i);
          log.push(`del ${id}:${ids.join(',')}`);
          (this as any).tokens = Object.assign([...map.values()], { get: (k: string) => map.get(k) });
          return ids;
        },
      };
    };
    const scenes = [mkScene('A', ['a1']), mkScene('B', ['b1', 'b2'])];
    const actor = { id: 'sp', name: 'Fire <Spirit>', canUserModify: () => true, async delete() { log.push('actor deleted'); } };
    const game = { scenes, user: { id: 'u' } };
    const ChatMessage = { getSpeaker: () => ({}), async create(d: any) { log.push(`card ${d.content}`); } };
    const SYSTEM = { LOG: { HEAD: 'sr2e | ' } };
    const quiet = { warn: () => undefined };
    const spiritTokenGroups = compile('spiritTokenGroups', { game });
    // v0.89.3: the dismissal card's text is a translation (tx, English under the test preload).
    const dismissSpiritNow = compile('dismissSpiritNow', { game, ChatMessage, SYSTEM, escHtml, tx, spiritTokenGroups, console: quiet });
    const mayDismissHere = compile('mayDismissHere', { spiritTokenGroups });
    return { log, actor, dismissSpiritNow, mayDismissHere, game };
  };

  test('with every delete allowed: tokens, then the actor, then an escaped card', async () => {
    const w = makeWorld();
    assert.deepEqual(await w.dismissSpiritNow(w.actor), { ok: true });
    assert.deepEqual(w.log, ['del A:a1', 'del B:b1,b2', 'actor deleted', 'card <p><strong>Fire &lt;Spirit&gt;</strong> is dismissed.</p>']);
  });
  test('a refused token delete (thrown, or only warned) keeps the actor and posts no card', async () => {
    for (const silent of [false, true]) {
      const w = makeWorld({ refuse: new Set(['B']), silent });
      const r = await w.dismissSpiritNow(w.actor);
      assert.equal(r.ok, false);
      assert.match(r.note, /from B$/);
      assert.ok(!w.log.includes('actor deleted'));
      assert.ok(!w.log.some((l) => l.startsWith('card')));
    }
  });
  test('a player who may not delete one token is sent to the GM: nothing is deleted on their client', () => {
    const w = makeWorld({ userMay: (t) => t.id !== 'b2' });
    assert.equal(w.mayDismissHere(w.actor, w.game.user), false);
    assert.deepEqual(w.log, []);
    const all = makeWorld();
    assert.equal(all.mayDismissHere(all.actor, all.game.user), true);
    assert.equal(all.mayDismissHere({ ...all.actor, canUserModify: () => false }, all.game.user), false);
  });
  test('#onDismiss: GM or allowed player dismisses here; anyone else asks the GM through the relay', () => {
    const src = fnSource('#onDismiss');
    assert.match(src, /if \(user\?\.isGM \|\| mayDismissHere\(actor, user\)\)/);
    assert.match(src, /requestGm\(DISMISS_SPIRIT_OP, \{ actorUuid: String\(actor\.uuid \?\? ""\) \}/);
    assert.ok(!src.includes('deleteEmbeddedDocuments'), 'no deletion before the decision');
  });
  test('the GM handler checks the server-set sender owns the spirit, and that it is a spirit', () => {
    const i = SRC.indexOf('onRelay(DISMISS_SPIRIT_OP');
    assert.ok(i > 0);
    const h = SRC.slice(i, SRC.indexOf('});', i));
    assert.match(h, /actor\.type !== "spirit"/);
    assert.match(h, /!user\?\.isGM && !actor\.testUserPermission\?\.\(user, "OWNER"\)/);
    assert.match(h, /return dismissSpiritNow\(actor\);/);
  });
});

describe('R2-REST 10, 11 (S-15, S-9): Launch IC cap and the orphaned doc comment', () => {
  test('Launch IC copies use one named cap (still 8), not a literal', () => {
    const src = fnSource('#onLaunchIc');
    assert.ok(!src.includes('Math.min(8,'));
    assert.ok(!src.includes('max="8"'));
    assert.match(src, /Math\.min\(LAUNCH_IC_MAX_COPIES, /);
    assert.match(SRC, /const LAUNCH_IC_MAX_COPIES = 8;/);
  });
  test('no stray "Clickable boxes" doc comment above matrixContext', () => {
    assert.ok(!SRC.includes('Clickable boxes for a Matrix condition monitor.'));
  });
});
