/**
 * v0.96.0 sorcery (RULES.SORCERY_V96): the Foundry side (applications/sorcery96.ts) with small stubs: the foci limit
 * hook, a ward's days on the world clock, the masking test, defaulting, the Cast window's rows, and for each switch
 * that its other choice gives the v0.95.1 behaviour.
 */
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { oldWay } from '../rules/__tests__/oldway.ts';
import * as G from '../applications/sorcery96.ts';
import { setSkillWeb } from '../rules/skills.ts';

const g = globalThis as any;
const chat: any[] = [];
const warnings: string[] = [];
const hooks = new Map<string, Array<(...a: any[]) => any>>();
beforeEach(() => {
  chat.length = 0; warnings.length = 0;
  g.ChatMessage = { create: async (d: any) => { chat.push(d); return d; }, getWhisperRecipients: () => [{ id: 'gm1' }], getSpeaker: () => ({ alias: 'x' }) };
  g.ui = { notifications: { warn: (m: string) => warnings.push(m), info: () => undefined } };
  g.Hooks = { on: (n: string, f: any) => { const l = hooks.get(n) ?? []; l.push(f); hooks.set(n, l); } };
});
const scripted = (faces: number[]) => async (n: number) => faces.splice(0, n);

function actorWith(foci: Array<{ id: string; active: boolean }>, intelligence: number): any {
  const a: any = { documentName: 'Actor', name: 'Mage', system: { attributes: { intelligence: { total: intelligence } } } };
  a.items = foci.map((f) => ({ id: f.id, type: 'focus', system: { active: f.active }, parent: a }));
  return a;
}

describe('v0.96.0 sorcery glue: the active foci limit (Core p. 137)', () => {
  test('one more than Intelligence is refused by the hook; a focus switched off or already on is fine', () => {
    const a = actorWith([{ id: 'f1', active: true }, { id: 'f2', active: true }, { id: 'f3', active: false }], 2);
    const f3 = a.items[2];
    assert.deepEqual(G.fociLimitBlocks(f3, { system: { active: true } }), { refuse: true, why: 'SR2E.Sorcery96.Why.fociLimit' });
    assert.equal(G.fociLimitBlocks(f3, { system: { active: false } }), null);
    assert.equal(G.fociLimitBlocks(a.items[0], { system: { active: true } }), null);
    G.registerSorcery96();
    const pre = hooks.get('preUpdateItem')!.at(-1)!;
    assert.equal(pre(f3, { system: { active: true } }), false);
    assert.equal(warnings.length, 1);
    // Review: only `active` is dropped; the rest of the update goes through.
    const change: any = { name: 'Renamed', system: { active: true, rating: 3 } };
    assert.equal(G.preUpdateFocus(f3, change), undefined);
    assert.deepEqual(change, { name: 'Renamed', system: { rating: 3 } });
    // A GM's own change is only warned about; an actor with no Intelligence isn't checked.
    g.game = { users: { get: (id: string) => (id === 'gm1' ? { isGM: true } : { isGM: false }) } };
    const gmChange: any = { system: { active: true } };
    assert.equal(G.preUpdateFocus(f3, gmChange, 'gm1'), undefined);
    assert.equal(gmChange.system.active, true);
    delete g.game;
    const noInt = actorWith([{ id: 'f1', active: true }, { id: 'f2', active: false }], 1);
    delete noInt.system.attributes.intelligence;
    assert.equal(G.fociLimitBlocks(noInt.items[1], { system: { active: true } }), null);
  });
  test('warn: the update goes ahead with a warning; off: nothing (v0.95.1)', (t) => {
    const a = actorWith([{ id: 'f1', active: true }, { id: 'f3', active: false }], 1);
    G.registerSorcery96();
    const pre = hooks.get('preUpdateItem')!.at(-1)!;
    const back = oldWay({ 'SORCERY_V96.fociLimit': 'warn' });
    assert.equal(pre(a.items[1], { system: { active: true } }), undefined);
    assert.equal(warnings.length, 1);
    back();
    t.after(oldWay({ 'SORCERY_V96.fociLimit': 'off' }));
    assert.equal(pre(a.items[1], { system: { active: true } }), undefined);
    assert.equal(warnings.length, 1);
  });
});

describe('v0.96.0 sorcery glue: a focus created active; one quickening at a time', () => {
  test('a player\'s new active focus past the limit is created off; a GM\'s only warned; no Intelligence: unchecked', () => {
    const a = actorWith([{ id: 'f1', active: true }], 1);
    const made: any = { type: 'focus', id: 'new', system: { active: true }, parent: a, updateSource(u: any) { if ('system.active' in u) this.system.active = u['system.active']; } };
    g.game = { users: { get: (id: string) => ({ isGM: id === 'gm1' }) } };
    G.preCreateFocus(made, { system: { active: true } }, 'p1');
    assert.equal(made.system.active, false);
    assert.equal(warnings.length, 1);
    made.system.active = true;
    G.preCreateFocus(made, { system: { active: true } }, 'gm1');
    assert.equal(made.system.active, true);
    delete a.system.attributes.intelligence;
    made.system.active = true;
    G.preCreateFocus(made, { system: { active: true } }, 'p1');
    assert.equal(made.system.active, true);
    delete g.game;
  });
  test('oneQuicken runs one at a time per key', async () => {
    let runs = 0;
    let release: () => void = () => {};
    const slow = () => new Promise<number>((r) => { runs++; release = () => r(1); });
    const p1 = G.oneQuicken('k', slow);
    assert.equal(await G.oneQuicken('k', slow), null);
    release();
    assert.equal(await p1, 1);
    assert.equal(runs, 1);
    assert.equal(await G.oneQuicken('k', async () => 2), 2);
  });
});

describe('v0.96.0 sorcery glue: a ward\'s days (Grimoire p. 92)', () => {
  const ward = (o: any) => { const w: any = { type: 'barrier', name: 'Ward', system: { rating: 4, wardDays96: 1, wardEnds96: 0, ...o }, updates: [] as any[] }; w.update = async (u: any) => { w.updates.push(u); }; return w; };
  test('a new ward gets its end; when the clock passes it falls (rating 0) with a GM card', async () => {
    assert.deepEqual(G.wardStamp(ward({ wardDays96: 2 }), 100), { 'system.wardEnds96': 100 + 2 * 86400 });
    assert.equal(G.wardStamp(ward({ wardDays96: 0 }), 100), null);
    assert.equal(G.wardStamp({ type: 'npc', system: {} }, 100), null);
    const w = ward({ wardEnds96: 500 });
    assert.equal(await G.wardSweep([w], 499), 0);
    assert.equal(await G.wardSweep([w], 500), 1);
    assert.deepEqual(w.updates[0], { 'system.wardEnds96': -1, 'system.rating': 0 });
    assert.deepEqual(chat[0].whisper, ['gm1']);
    // Review: the creation data's end is made from the days alone (a card's own end dropped), days at most 30.
    assert.deepEqual(G.wardCreateSystem96({ wardDays96: 3, wardEnds96: 1e12 }, 100), { wardDays96: 3, wardEnds96: 100 + 3 * 86400 });
    assert.deepEqual(G.wardCreateSystem96({ wardDays96: 999 }, 0), { wardDays96: 30, wardEnds96: 30 * 86400 });
    assert.deepEqual(G.wardCreateSystem96({ wardEnds96: 5 }, 0), { wardDays96: 0, wardEnds96: 0 });
    // One sweep at a time: two at once post one card.
    chat.length = 0;
    const w2 = ward({ wardEnds96: 500 });
    await Promise.all([G.wardSweep([w2], 600), G.wardSweep([w2], 600)]);
    assert.equal(chat.length, 1);
    // Only barriers with days are touched.
    const plain = ward({ wardDays96: 0, wardEnds96: 500 });
    assert.equal(await G.wardSweep([plain], 900), 0);
    assert.equal(G.wardStamp(ward({ wardDays96: 0 }), 100), null);
  });
  test('card: the GMs are told, the rating stays; off: no end kept (v0.95.1)', async (t) => {
    const back = oldWay({ 'SORCERY_V96.wardExpiry': 'card' });
    const w = ward({ wardEnds96: 500 });
    await G.wardSweep([w], 900);
    assert.deepEqual(w.updates[0], { 'system.wardEnds96': -1 });
    back();
    t.after(oldWay({ 'SORCERY_V96.wardExpiry': 'off' }));
    assert.equal(G.wardStamp(ward({ wardDays96: 2 }), 100), null);
    assert.equal(await G.wardSweep([ward({ wardEnds96: 500 })], 900), 0);
  });
});

describe('v0.96.0 sorcery glue: masking (Grimoire p. 46)', () => {
  const who = (grade: number, masking: boolean, magic: number) => ({ name: `G${grade}`, initiate: { grade, techniques: masking ? ['masking'] : [] }, system: { derived: { magic } }, getFlag: () => undefined });
  test('an initiate rolls Magic vs the subject\'s Magic, needing the grade difference; the card is the GMs\'', async () => {
    assert.equal(await G.maskTest(who(2, false, 7), who(4, true, 6), scripted([6, 6, 1, 1, 1, 1, 1, 2, 2])), true);
    assert.deepEqual(chat[0].whisper, ['gm1']);
    assert.equal(await G.maskTest(who(2, false, 7), who(4, true, 6), scripted([6, 1, 1, 1, 1, 1, 1, 2])), false);
    assert.equal(await G.maskTest(who(0, false, 7), who(4, true, 6)), false);
    // Review: the second try is at +2 (TN 8 here).
    assert.equal(await G.maskTest(who(2, false, 7), who(4, true, 6), scripted([6, 6, 1, 1, 1, 1, 1, 1, 1]), true), false);
    assert.equal(await G.maskTest(who(2, false, 7), who(4, false, 6)), null);
  });
  test('a mask that holds shows a mundane aura; foci beyond the grade still show', () => {
    const subj = { awakened: true, magic: 6, tradition: 'hermetic', foci: ['Power focus (power 3)'], sustained: ['Armor'] };
    assert.deepEqual(G.maskedSubject(subj, 3, 4), { awakened: false, magic: 0, tradition: '', foci: [], sustained: [] });
    assert.deepEqual(G.maskedSubject(subj, 5, 4).foci, ['Power focus (power 3)']);
  });
  test('off: no test (v0.95.1 keeps the TN penalty)', async (t) => {
    t.after(oldWay({ 'SORCERY_V96.masking': 'off' }));
    assert.equal(await G.maskTest(who(2, false, 7), who(4, true, 6)), null);
  });
});

describe('v0.96.0 sorcery glue: defaulting, noticing, centering, the Cast window', () => {
  const mage = (skills: Record<string, number>, willpower = 3) => ({ system: { derived: { magic: 5 }, attributes: { willpower: { total: willpower } } }, findSkill: (n: string) => (skills[n] ? { system: { rating: skills[n] } } : null) });
  test('defaulting reads the skills by their names and the GM\'s web', (t) => {
    setSkillWeb([]);
    assert.deepEqual(G.magicDefaultFor(mage({ Conjuring: 4 })), { dice: 4, tn: 2, from: 'conjuring' });
    assert.deepEqual(G.magicDefaultFor(mage({ 'Magical Theory': 4 })), { dice: 4, tn: 2, from: 'magicalTheory' });
    setSkillWeb([{ a: 'Sorcery', b: 'Conjuring', steps: 3 }]);
    assert.deepEqual(G.magicDefaultFor(mage({ Conjuring: 4 })), { dice: 4, tn: 6, from: 'conjuring' });
    setSkillWeb([]);
    assert.equal(G.magicDefaultFor({ ...mage({ Conjuring: 4 }), system: { derived: { magic: 0 }, attributes: { willpower: { total: 3 } } } }), null);
    t.after(oldWay({ 'SORCERY_V96.magicDefault': 'off' }));
    assert.equal(G.magicDefaultFor(mage({ Conjuring: 4 })), null);
  });
  test('the noticing note; off: none', (t) => {
    assert.match(G.noticeNote(6, 4), /notice/i);
    t.after(oldWay({ 'SORCERY_V96.noticing': 'off' }));
    assert.equal(G.noticeNote(6, 4), '');
  });
  test('centering for a spell needs astral perception; for Drain it rolls and posts', async () => {
    assert.equal(await G.centeringRoll({ name: 'M', system: { derived: { astralMode: 'physical' } } }, { use: 'cast', dice: 4, targetNumber: 4, modifiers: [], spellName: 'X' }), 0);
    assert.equal(warnings.length, 1);
    assert.equal(await G.centeringRoll({ name: 'M', system: { derived: { astralMode: 'physical' } } }, { use: 'drain', dice: 3, targetNumber: 4, modifiers: [], spellName: 'X' }, scripted([5, 4, 1])), 2);
    assert.equal(chat.length, 1);
  });
  test('the Cast window rows and what they say; off: no rows', (t) => {
    const actor = { system: { derived: { magic: 6 }, metamagic: { centering: true }, centeringSkill: 'Singing' } };
    const html = G.castRows96(actor, { system: { area: true, learnedForce: 5 } });
    for (const n of ['area96', 'stack96', 'center96']) assert.ok(html.includes(`name="${n}"`), n);
    const form = { elements: { area96: { value: '-2' }, stack96: { value: '1' }, center96: { value: 'drain' } } };
    assert.deepEqual(G.readCast96(form), { area96: -2, stack96: 1, center96: 'drain' });
    assert.deepEqual(G.readCast96({ elements: { area96: { value: '0' }, stack96: { value: '0' }, center96: { value: '' } } }), {});
    assert.equal(G.shapedRadius(6, -2), 4);
    t.after(oldWay({ 'SORCERY_V96.areaShape': 'off', 'SORCERY_V96.stacking': 'off', 'SORCERY_V96.centeringUse': 'off' }));
    assert.equal(G.castRows96(actor, { system: { area: true, learnedForce: 5 } }), '');
    assert.equal(G.shapedRadius(6, -2), 6);
  });
});
