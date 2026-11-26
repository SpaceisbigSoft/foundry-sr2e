/**
 * v0.93.3: content fixes from the visual review. NPC looks that name a metatype only come up for that metatype (the
 * demo's ork street samurai is no longer a "towering troll"), and a spirit named an elemental but left at the Kind
 * 'nature' is caught (rules/spiritkind.ts).
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../rules/npcdata.ts';
import { makeRng, generateNpc, rollDescription } from '../rules/npcgen.ts';
import { demoPlan } from '../rules/demo.ts';
import { kindMismatch, guessSpiritKind, SPIRIT_ELEMENTS } from '../rules/spiritkind.ts';
import { RULES } from '../rules/config.ts';

const METATYPES = ['human', 'elf', 'dwarf', 'ork', 'troll'];
/** Words that name a metatype in a look, and the metatypes they may be shown for. */
const NAMES: Array<[RegExp, string[]]> = [
  [/\btusker\b|\btusks?\b/i, ['ork', 'troll']],
  [/\belf\b/i, ['elf']],
  [/\bdwarf\b/i, ['dwarf']],
  [/\btroll\b|\bhorns\b/i, ['troll']],
];

describe('v0.93.3 NPC looks by metatype', () => {
  test('the tagged lines are still in their tables (the tags find them by text)', () => {
    for (const s of D.METATYPE_TAGGED_TEXT.APPEARANCE) assert.ok(D.APPEARANCE.includes(s), s);
    for (const s of D.METATYPE_TAGGED_TEXT.DISTINCTIVE) assert.ok(D.DISTINCTIVE.includes(s), s);
    assert.equal(Object.keys(D.APPEARANCE_METATYPES).length, D.METATYPE_TAGGED_TEXT.APPEARANCE.length);
    assert.equal(Object.keys(D.DISTINCTIVE_METATYPES).length, D.METATYPE_TAGGED_TEXT.DISTINCTIVE.length);
    for (const tags of [...Object.values(D.APPEARANCE_METATYPES), ...Object.values(D.DISTINCTIVE_METATYPES)]) {
      for (const m of tags) assert.ok(RULES.METATYPES.types[m], `metatype ${m}`);
    }
  });

  test('every line that names a metatype is tagged for it', () => {
    for (const [list, tags] of [[D.APPEARANCE, D.APPEARANCE_METATYPES], [D.DISTINCTIVE, D.DISTINCTIVE_METATYPES]] as const) {
      list.forEach((s, i) => {
        for (const [re, allowed] of NAMES) if (re.test(s)) {
          assert.ok(tags[i], `untagged: ${s}`);
          for (const m of tags[i]!) assert.ok(allowed.includes(m), `${s} tagged for ${m}`);
        }
      });
    }
  });

  test('pickForMetatype never picks a line tagged for another metatype, and rolls once', () => {
    for (const m of METATYPES) {
      for (let k = 0; k < 200; k++) {
        let calls = 0;
        const v = (k + 0.5) / 200;
        const s = D.pickForMetatype(D.APPEARANCE, D.APPEARANCE_METATYPES, m, () => { calls++; return v; });
        assert.equal(calls, 1);
        const i = D.APPEARANCE.indexOf(s);
        assert.ok(!D.APPEARANCE_METATYPES[i] || D.APPEARANCE_METATYPES[i]!.includes(m), `${m}: ${s}`);
      }
    }
    // No metatype (a bare name list): anything can come up, as before.
    assert.equal(D.pickForMetatype(D.APPEARANCE, D.APPEARANCE_METATYPES, '', () => 0.9999), D.APPEARANCE[D.APPEARANCE.length - 1]);
  });

  test('rollDescription with a metatype keeps out the others\' looks', () => {
    for (const m of METATYPES) {
      for (let seed = 1; seed <= 300; seed++) {
        const { description } = rollDescription(makeRng(seed), m, 'Role', m);
        for (const [re, allowed] of NAMES) if (!allowed.includes(m)) assert.ok(!re.test(description), `${m}: ${description}`);
      }
    }
  });

  test('generated NPCs: the metatype in the stats is the one in the looks', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const p = generateNpc({ threat: 2 }, makeRng(seed)) as any;
      for (const [re, allowed] of NAMES) if (!allowed.includes(p.metatype)) assert.ok(!re.test(p.description), `${p.metatype}: ${p.description}`);
    }
  });

  test('the demo\'s runners and gang look like their metatypes', () => {
    const d = demoPlan();
    const people = [...d.runners.map((r) => r.plan), d.gang.leader, ...d.gang.grunts, ...(d.gang.extras ?? [])] as any[];
    assert.ok(people.length > 5);
    assert.equal(d.runners[0]!.plan.metatype, 'ork');
    assert.ok(!/troll|horns/i.test(String((d.runners[0]!.plan as any).description)), (d.runners[0]!.plan as any).description);
    for (const p of people) for (const [re, allowed] of NAMES) if (!allowed.includes(p.metatype)) assert.ok(!re.test(String(p.description ?? '')), `${p.metatype}: ${p.description}`);
  });
});

describe('v0.93.3 spirit Kind checks', () => {
  test('kindMismatch: a nature spirit named an elemental, or with an element', () => {
    assert.equal(kindMismatch({ kind: 'nature', name: 'Fire Elemental' }), 'nameSaysElemental');
    assert.equal(kindMismatch({ kind: 'nature', name: 'Bob', spiritType: 'Water elemental' }), 'nameSaysElemental');
    assert.equal(kindMismatch({ kind: 'nature', name: 'Spirit', element: 'Fire' }), 'elementSet');
    assert.equal(kindMismatch({ kind: 'nature', name: 'Spirit', domain: 'earth' }), 'elementSet');
    for (const e of SPIRIT_ELEMENTS) assert.equal(kindMismatch({ kind: 'nature', name: 'X', element: e }), 'elementSet');
  });

  test('kindMismatch: nothing to say', () => {
    assert.equal(kindMismatch({ kind: 'elemental', name: 'Fire Elemental', element: 'fire' }), '');
    assert.equal(kindMismatch({ kind: 'nature', name: 'Forest spirit', domain: 'forest' }), '');
    assert.equal(kindMismatch({ kind: 'nature', name: 'City spirit' }), '');
    assert.equal(kindMismatch({ kind: 'ally', name: 'Elemental ally', element: 'fire' }), '', 'only the default Kind is checked');
    assert.equal(kindMismatch({ kind: 'nature', name: 'Elementary' }), '', 'whole word only');
    assert.equal(kindMismatch({ kind: 'nature' }), '');
  });

  test('guessSpiritKind', () => {
    assert.equal(guessSpiritKind('Fire Elemental', ''), 'elemental');
    assert.equal(guessSpiritKind('ELEMENTALS', undefined), 'elemental');
    assert.equal(guessSpiritKind('Summoned thing', ' Water '), 'elemental');
    assert.equal(guessSpiritKind('Forest spirit', ''), null);
    assert.equal(guessSpiritKind('Mountain spirit', 'stone'), null);
    assert.equal(guessSpiritKind('', ''), null);
  });
});
