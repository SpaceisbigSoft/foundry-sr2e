import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  WIZARD_STEPS, stepMove, stepIndex, checkStep, stepStates, priorityTable, metatypeChoices, magicChoices, magicKindOf, attributePoints, prioritiesComplete, swapPriority,
  creationRecordFrom, isCreationRecord, ledgerAdded, composeAdvancement, appendAdvancement, describeLine, advancementTotals, itemRaises, actorRaises, sinceCreation, delta,
  attributeSources, ratingLockApplies, lockedRaises, needsApproval, makeRequest, withRequest, describeRequest, RULES, type LedgerEntry, type AdvanceEvent,
} from '../index.ts';
import { oldWay } from './oldway.ts';

const ctx = (n = 0) => { let i = n; return { by: 'Corvo', at: '2026-10-22T00:00:00.000Z', t: 100, ids: () => `id${i++}` }; };

describe('v0.64.0 wizard steps', () => {
  test('steps run in order and clamp at the ends', () => {
    assert.equal(WIZARD_STEPS[0]!.id, 'priorities');
    assert.equal(WIZARD_STEPS.at(-1)!.id, 'review');
    assert.equal(stepMove('priorities', -1), 'priorities');
    assert.equal(stepMove('priorities', 1), 'metatype');
    assert.equal(stepMove('review', 1), 'review');
    assert.equal(stepIndex('nonsense'), 0);
  });

  test('build-check rows map to their steps', () => {
    assert.equal(checkStep('Priorities'), 'priorities');
    assert.equal(checkStep('Race'), 'metatype');
    assert.equal(checkStep('Attributes'), 'attributes');
    assert.equal(checkStep('Spell points'), 'magic');
    assert.equal(checkStep('Skills'), 'skills');
    assert.equal(checkStep('Resources'), 'resources');
    assert.equal(checkStep('Essence'), 'resources');
    assert.equal(checkStep('Contacts'), 'contacts');
    assert.equal(checkStep('Edges and flaws'), 'review');
    const s = stepStates([{ label: 'Attributes', ok: true }, { label: 'Skills', ok: false }, { label: 'Skills', ok: true }]);
    assert.equal(s.attributes, 'ok');
    assert.equal(s.skills, 'bad');
    assert.equal(s.magic, '');
  });

  test('the priority table: races by letter, magic, points and nuyen from RULES.CREATION', (tt) => {
    // v0.92.3: the old (v0.92.2) rule this test pins (RULES.CORE_V923 / book alignment).
    tt.after(oldWay({ 'CORE_V923.priorities': 'old' }));
    const t = priorityTable();
    assert.equal(t.length, 5);
    const a = t[0]!, e = t[4]!;
    assert.equal(a.letter, 'A');
    assert.match(a.race, /Troll/);
    assert.equal(a.magic, 'Full magician');
    assert.equal(a.resources, RULES.CREATION.priorities.A.resources);
    assert.equal(e.race, 'Human');
    assert.equal(e.magic, '—');
  });

  test('metatypes allowed by the Race letter', (tt) => {
    // v0.92.3: the old (v0.92.2) rule this test pins (RULES.CORE_V923 / book alignment).
    tt.after(oldWay({ 'CORE_V923.priorities': 'old' }));
    const types = { human: { label: 'Human' }, troll: { label: 'Troll' }, dwarf: { label: 'Dwarf' } };
    const d = metatypeChoices('D', types);
    assert.equal(d.find((x) => x.key === 'troll')!.allowed, false);
    assert.equal(d.find((x) => x.key === 'dwarf')!.allowed, true);
    assert.equal(d.find((x) => x.key === 'human')!.allowed, true);
    assert.equal(metatypeChoices(undefined, types).every((x) => x.allowed), true);
  });

  test('magic kinds by the Magic letter, and a tradition\'s kind', (tt) => {
    // v0.92.3: the old (v0.92.2) rule this test pins (RULES.CORE_V923 / book alignment).
    tt.after(oldWay({ 'CORE_V923.priorities': 'old' }));
    assert.deepEqual(magicChoices('A').filter((m) => m.allowed).map((m) => m.key), ['none', 'full', 'adept', 'aspected']);
    assert.deepEqual(magicChoices('B').filter((m) => m.allowed).map((m) => m.key), ['none', 'adept', 'aspected']);
    assert.deepEqual(magicChoices('C').filter((m) => m.allowed).map((m) => m.key), ['none']);
    assert.deepEqual(magicChoices(undefined).filter((m) => m.allowed).map((m) => m.key), ['none']);
    assert.equal(magicKindOf('hermetic', 6), 'full');
    assert.equal(magicKindOf('adept', 6), 'adept');
    assert.equal(magicKindOf('conjurer', 6), 'aspected');
    assert.equal(magicKindOf('none', 0), 'none');
    assert.equal(magicKindOf('none', 3), 'full');
  });

  test('attribute points and complete priorities', (tt) => {
    // v0.92.3: the old (v0.92.2) rule this test pins (RULES.CORE_V923 / book alignment).
    tt.after(oldWay({ 'CORE_V923.priorities': 'old' }));
    assert.deepEqual(attributePoints({ body: 4, quickness: 5, strength: 3.7, charisma: -1 }, 'C'), { used: 12, allowed: RULES.CREATION.priorities.C.attributes, left: RULES.CREATION.priorities.C.attributes - 12 });
    assert.equal(attributePoints({}, undefined).allowed, 0);
    assert.equal(prioritiesComplete({ race: 'A', magic: 'B', attributes: 'C', skills: 'D', resources: 'E' }), true);
    assert.equal(prioritiesComplete({ race: 'A', magic: 'A', attributes: 'C', skills: 'D', resources: 'E' }), false);
    assert.equal(prioritiesComplete({ race: 'A' }), false);
  });

  test('picking a taken letter swaps the two columns', () => {
    const p = swapPriority({ race: 'A', magic: 'B', attributes: 'C' }, 'attributes', 'A');
    assert.deepEqual(p, { race: 'C', magic: 'B', attributes: 'A' });
    // A column with no letter yet: the other column gives the letter up.
    assert.deepEqual(swapPriority({ race: 'A' }, 'magic', 'A'), { magic: 'A' });
    assert.deepEqual(swapPriority({ race: 'A', magic: 'B' }, 'magic', ''), { race: 'A' });
  });
});

describe('v0.64.0 the creation record', () => {
  const view = {
    system: {
      metatype: 'elf', tradition: 'hermetic', magic: 6, essence: 6, derived: { essence: 5.8 }, nuyen: 1234,
      attributes: { body: { base: 3, natural: 3 }, quickness: { base: 5, natural: 6 } },
      contacts: [{ name: 'Fixer', level: 2, role: 'fixer' }], qualities: [{ name: 'Lucky', kind: 'edge', points: 2 }],
      karma: { good: 5, pool: 1, career: 5 }, lifestyle: { level: 'middle', paidUntil: 2592000 },
    },
    items: [
      { type: 'skill', name: 'Sorcery', system: { kind: 'active', rating: 6, specialization: 'Combat', specializationRating: 7 } },
      { type: 'skill', name: 'English', system: { kind: 'language', rating: 4 } },
      { type: 'spell', name: 'Manabolt', system: { learnedForce: 5 } },
      { type: 'weapon', name: 'Heavy pistol', system: { quantity: 1 } },
      { type: 'gear', name: 'Medkit', system: { quantity: 3, rating: 4 } },
      { type: 'cyberware', name: 'Datajack', system: { rating: 0, grade: 'standard', essenceCost: 0.2 } },
      { type: 'adeptpower', name: 'Improved reflexes', system: { level: 1 } },
    ],
  };

  test('freezes everything the Creation tab shows', () => {
    const r = creationRecordFrom(view, { by: 'Corvo', now: '2026-10-22T00:00:00.000Z', worldTime: 50, how: 'wizard', priorities: { magic: 'A' }, checks: [{ label: 'Skills', used: '40', allowed: '40', ok: true }, { label: 'Resources', used: '1', allowed: '0', ok: false, note: 'over' }] });
    assert.ok(isCreationRecord(r));
    assert.equal(r.metatype, 'elf');
    assert.equal(r.magicKind, 'full');
    assert.deepEqual(r.attributes.quickness, { base: 5, natural: 6 });
    assert.equal(r.essence, 5.8);
    assert.deepEqual(r.skills.map((s) => s.name), ['Sorcery', 'English']);
    assert.equal(r.skills[0]!.specializationRating, 7);
    assert.deepEqual(r.spells, [{ name: 'Manabolt', force: 5 }]);
    assert.deepEqual(r.gear.map((g) => `${g.name}×${g.quantity}${g.rating ? `@${g.rating}` : ''}`), ['Heavy pistol×1', 'Medkit×3@4']);
    assert.equal(r.cyberware[0]!.essence, 0.2);
    assert.equal(r.adeptPowers[0]!.level, 1);
    assert.equal(r.contacts[0]!.level, 2);
    assert.equal(r.nuyen, 1234);
    assert.equal(r.karma.good, 5);
    assert.equal(r.failed, 1);
    assert.equal(r.checks[1]!.note, 'over');
    // A copy: changing the view later doesn't change the record.
    view.system.attributes.body.base = 9;
    assert.equal(r.attributes.body!.base, 3);
  });

  test('a flag holding junk is not a record', () => {
    assert.equal(isCreationRecord(null), false);
    assert.equal(isCreationRecord({ v: 2 }), false);
    assert.equal(isCreationRecord({ v: 1, finishedAt: 'x' }), false);
  });
});

describe('v0.64.0 the advancement log', () => {
  const L = (amount: number, reason: string, kind: LedgerEntry['kind'] = 'karma', t = 1): LedgerEntry => ({ t, kind, amount, reason });

  test('ledgerAdded finds the new end lines, even when old ones fell off the front', () => {
    const old = [L(5, 'a'), L(-2, 'b'), L(3, 'c')];
    assert.deepEqual(ledgerAdded(old, [...old, L(-1, 'd')]), [L(-1, 'd')]);
    assert.deepEqual(ledgerAdded(old, [L(-2, 'b'), L(3, 'c'), L(-1, 'd'), L(-4, 'e')]), [L(-1, 'd'), L(-4, 'e')]);
    assert.deepEqual(ledgerAdded(old, old), []);
    assert.deepEqual(ledgerAdded([], [L(1, 'x')]), [L(1, 'x')]);
    // Rewritten by hand: nothing counts as new.
    assert.deepEqual(ledgerAdded(old, [L(9, 'z')]), []);
    // Two identical lines in a row: only the second is new.
    assert.deepEqual(ledgerAdded([L(-1, 'same')], [L(-1, 'same'), L(-1, 'same')]), [L(-1, 'same')]);
  });

  test('a purchase is one line with its nuyen; the items it names are not listed again', () => {
    const ev: AdvanceEvent[] = [
      { kind: 'item', type: 'weapon', name: 'Heavy pistol' }, { kind: 'item', type: 'weapon', name: 'Heavy pistol' },
      { kind: 'ledger', entry: L(-900, 'Bought Heavy pistol ×2', 'nuyen') },
    ];
    const lines = composeAdvancement(ev, ctx());
    assert.equal(lines.length, 1);
    assert.equal(lines[0]!.nuyen, -900);
    assert.equal(lines[0]!.what, 'Bought Heavy pistol ×2');
    assert.equal(lines[0]!.by, 'Corvo');
  });

  test('a Karma raise is one line; the raise it names is covered', () => {
    const lines = composeAdvancement([{ kind: 'raise', label: 'Firearms', from: 3, to: 4 }, { kind: 'ledger', entry: L(-8, 'Firearms 3 → 4') }], ctx());
    assert.deepEqual(lines.map((l) => [l.what, l.karma, l.kind]), [['Firearms 3 → 4', -8, 'gain']]);
    const spec = composeAdvancement([{ kind: 'raise', label: 'Firearms (Pistols)', from: 4, to: 5 }, { kind: 'ledger', entry: L(-5, 'Firearms (Pistols) 4 → 5') }], ctx());
    assert.equal(spec.length, 1);
    const force = composeAdvancement([{ kind: 'raise', label: 'Manabolt Force', from: 3, to: 4 }, { kind: 'ledger', entry: L(-4, 'Manabolt Force 3 → 4') }], ctx());
    assert.equal(force.length, 1);
  });

  test('free adds, awards, pool points, and raises with no cost each get a line', () => {
    const lines = composeAdvancement([
      { kind: 'item', type: 'gear', name: 'Medkit', amount: 3 }, { kind: 'item', type: 'spell', name: 'Heal' },
      { kind: 'ledger', entry: L(6, 'Run: the docks') }, { kind: 'ledger', entry: L(1, 'Karma Pool +1 (10 earned)', 'pool') },
      { kind: 'raise', label: 'Body', from: 4, to: 5 },
    ], { ...ctx(), approvedBy: 'GM AI' });
    assert.deepEqual(lines.map((l) => l.what), ['Run: the docks', 'Karma Pool +1 (10 earned)', 'Body 4 → 5', 'Gained Medkit ×3, Heal']);
    assert.deepEqual(lines.map((l) => l.kind), ['award', 'award', 'gain', 'gain']);
    assert.equal(lines[0]!.karma, 6);
    assert.equal(lines.every((l) => l.approvedBy === 'GM AI'), true);
  });

  test('nuyen spent on upkeep is not a gain', () => {
    assert.deepEqual(composeAdvancement([{ kind: 'ledger', entry: L(-1000, 'Low lifestyle, 1 month', 'nuyen') }, { kind: 'ledger', entry: L(500, 'Pay', 'nuyen') }], ctx()), []);
    // But a buy with no item in the burst (bought through the purchase card) still counts.
    assert.equal(composeAdvancement([{ kind: 'ledger', entry: L(-50, 'Bought Medkit', 'nuyen') }], ctx()).length, 1);
  });

  test('a learned spell or skill: the item and its Karma make one line', () => {
    const lines = composeAdvancement([{ kind: 'item', type: 'spell', name: 'Manabolt' }, { kind: 'ledger', entry: L(-5, 'Learned Manabolt') }], ctx());
    assert.deepEqual(lines.map((l) => l.what), ['Learned Manabolt']);
    const sk = composeAdvancement([{ kind: 'item', type: 'skill', name: 'Etiquette' }, { kind: 'ledger', entry: L(-3, 'Learned Etiquette 1') }], ctx());
    assert.equal(sk.length, 1);
  });

  test('appending keeps the newest lines; descriptions and totals', () => {
    const one = composeAdvancement([{ kind: 'ledger', entry: L(-8, 'Firearms 3 → 4') }], ctx())[0]!;
    const log = appendAdvancement(Array.from({ length: 5 }, () => one), [{ ...one, id: 'last' }], 4);
    assert.equal(log.length, 4);
    assert.equal(log.at(-1)!.id, 'last');
    assert.equal(appendAdvancement(null as any, [one]).length, 1);
    assert.equal(describeLine({ ...one, approvedBy: 'GM AI' }), 'Firearms 3 → 4 (-8 Karma), by Corvo, approved by GM AI');
    const totals = advancementTotals([one, { ...one, karma: 10, kind: 'award' }, { ...one, karma: 0, nuyen: -900 }, { ...one, karma: 3, kind: 'gain' }]);
    assert.deepEqual(totals, { karmaIn: 10, karmaSpent: 5, nuyenSpent: 900, lines: 4 }, 'a refund takes off what was spent');
    const back = composeAdvancement([{ kind: 'ledger', entry: L(8, 'Training given up: Firearms 3 → 4') }], ctx());
    assert.equal(back[0]!.kind, 'gain');
    const init = composeAdvancement([{ kind: 'raise', label: 'Initiation', from: 0, to: 1 }, { kind: 'ledger', entry: L(-15, 'Initiation to grade 1') }], ctx());
    assert.equal(init.length, 1, 'the initiation raise is covered by its Karma line');
  });

  test('raises found in item and actor updates (only upward)', () => {
    assert.deepEqual(itemRaises('skill', 'Firearms', { rating: 3 }, { 'system.rating': 4 }), [{ label: 'Firearms', from: 3, to: 4 }]);
    assert.deepEqual(itemRaises('skill', 'Firearms', { rating: 3 }, { 'system.rating': 2 }), []);
    assert.deepEqual(itemRaises('skill', 'Firearms', { rating: 4, specialization: 'Pistols', specializationRating: 0 }, { 'system.specializationRating': 5 }), [{ label: 'Firearms (Pistols)', from: 4, to: 5 }]);
    assert.deepEqual(itemRaises('spell', 'Manabolt', { learnedForce: 3 }, { 'system.learnedForce': 4 }), [{ label: 'Manabolt Force', from: 3, to: 4 }]);
    assert.deepEqual(itemRaises('weapon', 'Gun', {}, { 'system.rating': 4 }), []);
    assert.deepEqual(actorRaises({ attributes: { body: { base: 4 } }, magic: 6, initiateGrade: 0 }, { 'system.attributes.body.base': 5, 'system.magic': 5, 'system.initiateGrade': 1, 'system.nuyen': 5 }),
      [{ label: 'Body', from: 4, to: 5, alias: 'Body' }, { label: 'Initiation', from: 0, to: 1, alias: 'Initiation' }]); // v0.89.6: the English alias
  });
});

describe('v0.64.0 since creation and the Current tab', () => {
  const rec = creationRecordFrom({ system: { attributes: { body: { base: 4, natural: 4 }, quickness: { base: 5, natural: 5 } }, magic: 6, essence: 6, nuyen: 1000, karma: { good: 0, pool: 1, career: 0 } }, items: [{ type: 'skill', name: 'Firearms', system: { rating: 3 } }] },
    { by: 'Corvo', now: 'x', worldTime: 0, how: 'wizard' });

  test('deltas against the record', () => {
    const s = sinceCreation(rec, { attributes: { body: 5, quickness: 5 }, skills: [{ name: 'Firearms', rating: 4 }, { name: 'Etiquette', rating: 1 }], magic: 5, essence: 5.8, career: 12, nuyen: 400, good: 4 });
    assert.equal(s.attributes['body'], '+1');
    assert.equal(s.attributes['quickness'], '');
    assert.equal(s.skills['Firearms'], '+1');
    assert.equal(s.skills['Etiquette'], 'new');
    assert.deepEqual(s.newSkills, ['Etiquette']);
    assert.equal(s.magic, '−1');
    assert.equal(s.essence, '−0.2');
    assert.equal(s.karmaEarned, 12);
    assert.equal(s.nuyen, '−600');
    assert.equal(sinceCreation(null, { attributes: {}, skills: [], magic: 0, essence: 0, career: 0, nuyen: 0, good: 0 }).karmaEarned, 0);
    assert.equal(delta(3, undefined), 'new');
  });

  test('an attribute\'s hover text adds up', () => {
    const t = attributeSources({ base: 4, racial: 2, mod: 0, gear: 2, total: 7 }, [{ name: 'Muscle replacement', value: 2 }], ['Encumbered']);
    assert.equal(t, 'Base 4\nRacial +2\nMuscle replacement +2\nLimits and load −1\nEncumbered\n= 7');
    assert.equal(attributeSources({ base: 3, racial: 0, mod: -1, gear: 1, total: 3 }), 'Base 3\nModifier −1\nAugmentations +1\n= 3');
  });
});

describe('v0.64.0 rating edits after creation', () => {
  test('only players on finished characters', () => {
    assert.equal(ratingLockApplies({ isGM: false, actorType: 'character', finished: true }), true);
    assert.equal(ratingLockApplies({ isGM: true, actorType: 'character', finished: true }), false);
    assert.equal(ratingLockApplies({ isGM: false, actorType: 'character', finished: false }), false);
    assert.equal(ratingLockApplies({ isGM: false, actorType: 'npc', finished: true }), false);
  });

  test('raises of locked fields are found; lowering and other fields pass', () => {
    const cur: Record<string, number> = { 'system.attributes.body.base': 4, 'system.essence': 6, 'system.rating': 3, 'system.learnedForce': 2 };
    const get = (k: string) => cur[k];
    assert.deepEqual(lockedRaises('actor', '', get, { 'system.attributes.body.base': 5, 'system.nuyen': 9, 'system.attributes.body.mod': 2 }), [{ key: 'system.attributes.body.base', from: 4, to: 5 }]);
    assert.deepEqual(lockedRaises('actor', '', get, { 'system.attributes.body.base': 3 }), []);
    assert.equal(lockedRaises('actor', '', get, { 'system.essence': 5 }).length, 1);
    assert.deepEqual(lockedRaises('item', 'skill', get, { 'system.rating': 4 }), [{ key: 'system.rating', from: 3, to: 4 }]);
    assert.deepEqual(lockedRaises('item', 'gear', get, { 'system.rating': 4 }), []);
    assert.deepEqual(lockedRaises('item', 'spell', get, { 'system.learnedForce': 3 }), [{ key: 'system.learnedForce', from: 2, to: 3 }]);
  });
});

describe('v0.64.0 the approval queue', () => {
  test('who waits', () => {
    assert.equal(needsApproval({ queueOn: true, isGM: false, actorType: 'character', inCreation: false }), true);
    assert.equal(needsApproval({ queueOn: false, isGM: false, actorType: 'character', inCreation: false }), false);
    assert.equal(needsApproval({ queueOn: true, isGM: true, actorType: 'character', inCreation: false }), false);
    assert.equal(needsApproval({ queueOn: true, isGM: false, actorType: 'character', inCreation: true }), false);
    assert.equal(needsApproval({ queueOn: true, isGM: false, actorType: 'npc', inCreation: false }), false);
  });

  test('requests: costs clamped, a repeat replaces the older one, a short description', () => {
    const r = makeRequest({ id: 'a', kind: 'improve', label: 'Raise Firearms 3 → 4', karma: 8.7, nuyen: -5, userId: 'u', userName: 'Corvo', at: 1, data: {} });
    assert.equal(r.karma, 8);
    assert.equal(r.nuyen, 0);
    const list = withRequest(withRequest([], r), { ...r, id: 'b' });
    assert.deepEqual(list.map((x) => x.id), ['b']);
    assert.equal(withRequest(list, { ...r, id: 'c', label: 'other' }).length, 2);
    assert.deepEqual(describeRequest(r, { karma: 5, nuyen: 0 }), { text: 'Corvo: Raise Firearms 3 → 4', cost: '8 Karma', short: true });
    assert.equal(describeRequest({ ...r, karma: 0 }, { karma: 0, nuyen: 0 }).cost, 'free');
  });
});
