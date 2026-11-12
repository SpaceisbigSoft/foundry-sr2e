/**
 * v0.81.0 fixRC: regression tests for the RC review fixes (RV/RC.md RC-1 … RC-17) and the parser/data items of the
 * SEC2 audit in the RC slice (SEC2-7 ReDoS, regexes built from data, escaping). Each test failed before its fix.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { RULES } from '../config.ts';
import { parseStatBlock, splitTopLevel } from '../statblock.ts';
import { parseCharacterSheet, parseContactEntry } from '../charimport.ts';
import { parseModifierLines, undoLimits } from '../gmtools.ts';
import { parseAvailability } from '../upkeep.ts';
import { rowsToTemplates, CATALOGUE_COLUMNS, CATALOGUE_SHORTHANDS, CATALOGUE_TYPES } from '../catalogcsv.ts';
import { gearStackKey, GEAR_STACK_FIELDS } from '../catalogue.ts';
import { itemPilesConfig } from '../setup.ts';
import { generateNpc, makeRng, npcActorData, planHtml } from '../npcgen.ts';
import { guideTopicHtml, GUIDE_TOPICS } from '../guide.ts';
import { fromPairs } from '../waiting.ts';
import { barrierSpellRating } from '../sorcery.ts';
import { contactsCost } from '../everyday.ts';

const ms = (f: () => void): number => {
  const t0 = performance.now();
  f();
  return performance.now() - t0;
};
const makeId = () => 'id';

describe('v0.81.0 fixRC: SEC2-7 importer regexes are linear', () => {
  test('stat-block drain token with a long blank run (was exponential: 100 spaces took minutes)', () => {
    const t = ms(() => parseStatBlock(`Cyberware: Wired Reflexes (drain${' '.repeat(10_000)}x)`));
    assert.ok(t < 200, `${t} ms`);
  });
  test('the drain token still reads its forms', () => {
    const p = parseStatBlock('Spells: Heal 4 (Drain [(F/2)+1]S), Armor 3 (drain  - 1 M)');
    assert.deepEqual(p.spells.map((s) => [s.name, (s as any).drain?.modifier, (s as any).drain?.level]), [['Heal', 1, 'S'], ['Armor', -1, 'M']]);
  });
  test('modifier lines with a long blank or colon run (was cubic)', () => {
    assert.ok(ms(() => parseModifierLines(`a${' '.repeat(10_000)}x`)) < 200);
    assert.ok(ms(() => parseModifierLines(`a${':'.repeat(10_000)}x`)) < 200);
    assert.ok(ms(() => parseModifierLines(`a${' :'.repeat(5_000)}5`)) < 200);
  });
  test('modifier lines read as before', () => {
    assert.deepEqual(parseModifierLines('Smoke +4\nWounds: 2\nCover −1\nnonsense\nSmartlink - 2\nItem 2-3\n7'),
      [{ label: 'Smoke', value: 4 }, { label: 'Wounds', value: 2 }, { label: 'Cover', value: -1 }, { label: 'Smartlink', value: -2 },
        { label: 'Item 2', value: -3 }, { label: 'Modifier', value: 7 }]);
  });
  test('a language with r/w and a long blank run (was cubic)', () => {
    const t = ms(() => parseCharacterSheet(`Languages: English 4 (r/w${' '.repeat(4_000)}2)`));
    assert.ok(t < 300, `${t} ms`);
  });
  test('RC-9: a tab-aligned line with a long blank run (multi-label split was quadratic)', () => {
    const t = ms(() => parseCharacterSheet(`Name: Ghost${' '.repeat(20_000)}Metatype: Elf`));
    assert.ok(t < 300, `${t} ms`);
    const p = parseCharacterSheet('Name: Ghost      Metatype: Elf');
    assert.equal(p.metatype, 'elf');
  });
  test('input size caps warn', () => {
    assert.ok(parseStatBlock('x'.repeat(200_000)).warnings.some((w) => /only the first/.test(w)));
    assert.ok(parseCharacterSheet(`Notes: ${'y'.repeat(20_000)}`).warnings.some((w) => /cut short/.test(w)));
  });
});

describe('v0.81.0 fixRC: character import', () => {
  test('RC-1: a value word inside a list is an entry, not a new value', () => {
    const p = parseCharacterSheet('Nuyen: 12,000\nGear:\n  Ares Predator [9M]\n  Credstick 1500\n  Medkit 3\n  Grade 2 rations x10');
    assert.equal(p.nuyen, 12000);
    assert.equal(p.initiateGrade, undefined);
    const names = p.gear.map((g) => g.name.toLowerCase()).join('|');
    assert.match(names, /credstick/);
    assert.match(names, /medkit/);
    assert.match(names, /rations/);
    assert.deepEqual(p.unknown, []);
  });
  test('RC-1: outside a list a colonless value label still works', () => {
    assert.equal(parseCharacterSheet('Nuyen 12,500').nuyen, 12500);
  });
  test('RC-2: one edge or flaw per line', () => {
    const p = parseCharacterSheet('Edges:\nAmbidexterity +1\nToughness +2\n\nFlaws:\n- Allergy (Mild) -2\n- Bad Luck -4');
    assert.deepEqual(p.qualities.map((q) => [q.name, q.kind, q.points]),
      [['Ambidexterity', 'edge', 1], ['Toughness', 'edge', 2], ['Allergy', 'flaw', 2], ['Bad Luck', 'flaw', 4]]);
  });
  test('RC-2: "Edges: A; Flaws: B" on one line still splits', () => {
    const p = parseCharacterSheet('Qualities: Edges: Toughness +2; Flaws: Bad Luck -4');
    assert.deepEqual(p.qualities.map((q) => [q.name, q.kind]), [['Toughness', 'edge'], ['Bad Luck', 'flaw']]);
  });
  test('RC-7: "2x Rope 100m" keeps its quantity and is not a weapon', () => {
    const p = parseCharacterSheet('Gear: 2x Rope 100m');
    assert.equal(p.weapons.length, 0);
    const rope = p.gear.find((g) => /rope/i.test(g.name));
    assert.equal(rope?.quantity, 2);
  });
  test('RC-7: an upper-case damage code is still a weapon', () => {
    assert.equal(parseCharacterSheet('Gear: Ares Predator 9M').weapons.length, 1);
  });
  test('RC-10: a contact role in brackets is the role', () => {
    assert.deepEqual(parseContactEntry('Bob (Fixer)'), { name: 'Bob', role: 'Fixer', level: 1, notes: '' });
    assert.equal(parseContactEntry('Bob (Fixer, owes me)')!.notes, 'owes me');
  });
  test('RC-14: braces survive both splits', () => {
    assert.deepEqual(splitTopLevel('Foo {a, b}, Bar'), ['Foo {a, b}', 'Bar']);
    assert.deepEqual(splitTopLevel('a; b, c', { semicolons: true }), ['a', 'b', 'c']);
    assert.deepEqual(splitTopLevel('a; b'), ['a; b']);
  });
  test('SEC2-11: a house-rule metatype label with regex characters is matched literally', () => {
    const types = RULES.METATYPES.types as any;
    types['zzkin'] = { ...types.human, label: 'Zz.Kin' };
    try {
      assert.equal(parseCharacterSheet('Metatype: Zz.Kin').metatype, 'zzkin');
      assert.notEqual(parseCharacterSheet('Metatype: ZzXKin').metatype, 'zzkin');
    } finally {
      delete types['zzkin'];
    }
  });
});

describe('v0.81.0 fixRC: catalogue CSV', () => {
  test('RC-5: a "BI" column on bioware is the Body Index', () => {
    const r = rowsToTemplates('Name,Type,BI\nMuscle Aug,bioware,0.4', { makeId });
    assert.deepEqual(r.errors, []);
    assert.equal(r.templates[0]!.system['bodyIndex'], 0.4);
  });
  test('RC-5: no shorthand alias shadows a column of the same type (except the documented Ammo)', () => {
    const n = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    for (const t of CATALOGUE_TYPES) {
      const cols = new Set(CATALOGUE_COLUMNS[t].flatMap((c) => [c.path, c.path.split('.').pop()!, ...c.aliases].map(n)));
      for (const s of CATALOGUE_SHORTHANDS[t] ?? []) for (const a of s.aliases) {
        if (t === 'weapon' && n(a) === 'ammo') continue;
        assert.ok(!cols.has(n(a)), `${t}: shorthand ${s.name} alias ${a}`);
      }
    }
  });
  test('RC-8: choice lists follow house rules (an added ammo type is accepted)', () => {
    const ammo = (RULES.COMBAT as any).ammo as any[];
    const saved = [...ammo];
    (RULES.COMBAT as any).ammo = [...saved, { ...saved[0], id: 'zzTestRound', label: 'ZZ round' }];
    try {
      const r = rowsToTemplates('Name,Type,Ammo Type\nZZ Box,gear,zzTestRound', { makeId });
      assert.deepEqual(r.errors, []);
      assert.equal(r.templates[0]!.system['ammoType'], 'zzTestRound');
    } finally {
      (RULES.COMBAT as any).ammo = saved;
    }
  });
  test('RC-16: an unclosed quote is reported with its row', () => {
    const r = rowsToTemplates('Name,Cost\nGun,100\n"12 inch barrel,5\nKnife,10', { defaultType: 'gear', makeId });
    assert.ok(r.errors.some((e) => e.row === 3 && /never closed/.test(e.message)), JSON.stringify(r.errors));
  });
});

describe('v0.81.0 fixRC: gear stacking and Item Piles', () => {
  test('RC-3: Item Piles compares the same fields as the sheet, all real paths', () => {
    const c = itemPilesConfig({ version: '1', nuyenImg: '' } as any) as any;
    assert.ok(c.ITEM_SIMILARITIES.includes('system.explosive.power'));
    assert.ok(!c.ITEM_SIMILARITIES.includes('system.explosive.rating'));
    for (const f of ['cost', 'rcdRating', 'radio.rating', 'identity.rating', 'material']) assert.ok(c.ITEM_SIMILARITIES.includes(`system.${f}`), f);
    // v0.81.1 (RC2-2): every gear stacking field but the array fields (v0.92.1: the custom tweaks too).
    assert.deepEqual(c.ITEM_SIMILARITIES.slice(2), GEAR_STACK_FIELDS.filter((f) => f !== 'skillMods' && f !== 'tweaks').map((f) => `system.${f}`));
  });
  test('RC-3: the sheet keeps explosives, radios and ammo kinds apart', () => {
    assert.notEqual(gearStackKey('C4', { explosive: { power: 2 } }), gearStackKey('C4', { explosive: { power: 5 } }));
    assert.notEqual(gearStackKey('Radio', { radio: { rating: 2 } }), gearStackKey('Radio', { radio: { rating: 5 } }));
    assert.notEqual(gearStackKey('Rounds', { ammoType: 'apds' }), gearStackKey('Rounds', { ammoType: 'standard' }));
    assert.equal(gearStackKey('Dart', { toxin: { kind: '', power: 6 } }), gearStackKey('Dart', {}));
  });
});

describe('v0.81.0 fixRC: NPCs, upkeep, undo, magic', () => {
  test('RC-4: a low-Threat rigger with drones gets a remote control deck', () => {
    let checked = 0;
    for (let s = 1; s < 400 && checked < 20; s++) {
      const p = generateNpc({ threat: 1, archetype: 'rigger' } as any, makeRng(s));
      if (!(p.vehicles ?? []).some((v) => v.drone)) continue;
      checked++;
      const rcd = npcActorData(p).items.find((i) => Number((i.system as any).rcdRating) > 0);
      assert.ok(rcd, `seed ${s}`);
      const r = Number((rcd!.system as any).rcdRating);
      // v0.92.3: Rigger 2 p. 97: 5,000¥ × Rating, 3 kg (was the core 50,000¥ × Rating, Rating × 2 kg).
      assert.equal((rcd!.system as any).cost, 5000 * r);
      assert.equal((rcd!.system as any).weight, 3);
    }
    assert.ok(checked > 0, 'no Threat 1 rigger with drones found');
  });
  test('RC-6: "4/30 min" is 30 minutes, not 30 months', () => {
    assert.deepEqual(parseAvailability('4/30 min'), { tn: 4, hours: 0.5 });
    assert.deepEqual(parseAvailability('4/90 minutes'), { tn: 4, hours: 1.5 });
    assert.equal(parseAvailability('8/1 mo').hours, 24 * RULES.UPKEEP.monthDays);
    assert.equal(parseAvailability('8/2 m').hours, 48 * RULES.UPKEEP.monthDays);
  });
  test('RC-11: free contact slots cover the cheapest contacts up to a Level 1 price', () => {
    const r = contactsCost([{ level: 3 }, { level: 1 }, { level: 1 }]);
    assert.ok(r.cost >= 0 && r.free <= 3);
  });
  test('RC-12: the undo limits follow the undo rules', () => {
    const u = RULES.GM_TOOLS.undo as any;
    const saved = { maxSteps: u.maxSteps, windowMs: u.windowMs };
    try {
      u.maxSteps = 7;
      u.windowMs = 2000;
      const text = undoLimits().join('\n');
      assert.match(text, /last 7 steps/);
      assert.match(text, /within 2 seconds/);
      assert.match(text, /stays open 5 seconds/);
    } finally {
      Object.assign(u, saved);
    }
    assert.match(undoLimits().join('\n'), new RegExp(`last ${saved.maxSteps} steps`));
  });
  test('RC-17: sorcery reads BOOK_V78 through RULES', () => {
    const saved = (RULES as any).BOOK_V78;
    try {
      (RULES as any).BOOK_V78 = { ...saved, manaBarrier: { ...saved.manaBarrier, rating: 'force' } };
      assert.equal(barrierSpellRating(6, 1, 'mana'), 6);
      (RULES as any).BOOK_V78 = { ...saved, manaBarrier: { ...saved.manaBarrier, rating: 'halfForce' } };
      assert.equal(barrierSpellRating(6, 1, 'mana'), 3);
    } finally {
      (RULES as any).BOOK_V78 = saved;
    }
  });
});

describe('v0.81.0 fixRC: escaping and data paths', () => {
  test('RC-14/SEC2-10: NPC plan HTML escapes quotes as well as tags', () => {
    const p = generateNpc({ threat: 2, archetype: 'ganger' } as any, makeRng(3));
    p.name = `<img src=x onerror="alert(1)">'`;
    const html = planHtml(p);
    assert.ok(!html.includes('<img'), html);
    assert.ok(html.includes('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;&#39;'));
    const data = npcActorData({ ...p, notes: `"q" & 'a'` });
    assert.match(String(data.actor.system['notes']), /&quot;q&quot; &amp; &#39;a&#39;/);
  });
  test('the guide escapes a title with quotes', () => {
    // v0.89.7: the title is a translation; a translation with quotes is escaped too.
    const t = GUIDE_TOPICS[0]!;
    const en = (globalThis as any).__SR2E_EN__;
    const key = 'SR2E.Guide.Topic.gettingStarted.title';
    const saved = en[key];
    try {
      en[key] = `A "b" 'c'`;
      assert.match(guideTopicHtml(t.id)!, /<h2>A &quot;b&quot; &#39;c&#39;<\/h2>/);
    } finally {
      en[key] = saved;
    }
  });
  test('project pairs never write through __proto__, prototype or constructor', () => {
    const out = fromPairs([['__proto__', { polluted: 1 }], ['system.constructor.x', 1], ['system.rating', 4]] as any);
    assert.deepEqual(Object.keys(out), ['system.rating']);
    assert.equal(Object.getPrototypeOf(out), Object.prototype);
    assert.equal(({} as any).polluted, undefined);
  });
});
