/**
 * v0.95.0 rules completeness, core mechanics and characters (RULES.CORE_V95): the pure rules (rules/core95.ts), the
 * Team Karma relay's checks (applications/core95.ts teamRelay) and the hooks in the shared files.
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RULES } from '../rules/config.ts';
import { oldWay } from '../rules/__tests__/oldway.ts';
import * as C from '../rules/core95.ts';
import { HOUSE_CORE_V95 } from '../rules/config95/core.ts';

const ROOT = join(import.meta.dirname, '..', '..', '..');
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), 'utf8');
const pool = (members: string[], p: number, spent = 0): C.TeamPool => ({ members, pool: p, spent });

describe('v0.95.0 core: the switches', () => {
  test('every switch has a house-rules row, book first; contact upkeep (optional) ships off', () => {
    const v: any = RULES.CORE_V95;
    for (const r of HOUSE_CORE_V95) {
      const key = r.path.split('.')[1]!;
      assert.ok(key in v, r.path);
      if (r.type === 'select') assert.equal(v[key], r.choices![0], `${r.path} defaults to its first choice`);
    }
    assert.equal(v.contactUpkeep, 'off');
    assert.equal(v.teamKarmaGoodTerms, false);
    assert.equal(v.teamKarmaStart, 2);
    assert.equal(v.teamKarmaJoin, 1);
  });
});

describe('v0.95.0 core: the Team Karma Pool (Core p. 191, p. 47)', () => {
  test('a stored value is read safely', () => {
    assert.deepEqual(C.teamPoolOf(null), pool([], 0));
    assert.deepEqual(C.teamPoolOf({ members: ['a', 'a', 5, ''], pool: -3, spent: 9 }), pool(['a'], 0, 0));
    assert.deepEqual(C.teamPoolOf({ members: ['a'], pool: 5, spent: 9 }), pool(['a'], 5, 5));
    assert.equal(C.teamPoolOf({ pool: 1e9 }).pool, C.TEAM_POOL_MAX);
  });
  test('the first member founds the team: 2 points plus their 1; later members pay 1', () => {
    const a = C.teamJoin(pool([], 0), 'a', 3);
    assert.ok(a.ok); assert.equal(a.own, 1); assert.deepEqual(a.team, pool(['a'], 3));
    const b = C.teamJoin(a.team, 'b', 1);
    assert.ok(b.ok); assert.deepEqual(b.team, pool(['a', 'b'], 4));
    assert.equal(C.teamJoin(b.team, 'b', 5).ok, false, 'already a member');
    assert.equal(C.teamJoin(b.team, 'c', 0).ok, false, 'no Karma Pool left to pay with');
  });
  test('giving moves own points in for good; drawing uses them until the refresh; a bought success is gone', () => {
    const t = pool(['a'], 3);
    assert.deepEqual(C.teamGive(t, 'a', 2, 2).team, pool(['a'], 5));
    assert.equal(C.teamGive(t, 'a', 3, 2).ok, false);
    assert.equal(C.teamGive(t, 'x', 1, 5).ok, false, 'not on the team');
    const s = C.teamSpend(t, 'a', 2);
    assert.deepEqual(s.team, pool(['a'], 3, 2));
    assert.equal(C.teamLeft(s.team), 1);
    assert.equal(C.teamSpend(s.team, 'a', 2).ok, false);
    assert.deepEqual(C.teamSpend(t, 'a', 1, true).team, pool(['a'], 2));
    assert.deepEqual(C.teamRefresh(s.team), pool(['a'], 3, 0));
  });
  test('leaving: half the points go; a death costs nothing; the optional share is pool ÷ members, round up', () => {
    const t = pool(['a', 'b', 'c'], 7, 2);
    const half = C.teamLeave(t, 'b', 'half');
    assert.equal(half.lost, 3); assert.deepEqual(half.team, pool(['a', 'c'], 4, 2));
    assert.equal(C.teamLeave(t, 'b', 'died').lost, 0);
    assert.equal(C.teamLeave(t, 'b', 'share').lost, 3);
    assert.equal(C.teamLeave(t, 'x', 'half').ok, false);
    assert.equal(C.teamLeave(pool(['a'], 5, 5), 'a', 'half').team.spent, 3, 'spent never above the pool');
  });
  test('where a Karma spend comes from', () => {
    const t = pool(['a'], 3);
    assert.equal(C.karmaSources({ points: 1, ownLeft: 2, team: t, member: true }), 'ask');
    assert.equal(C.karmaSources({ points: 1, ownLeft: 0, team: t, member: true }), 'team');
    assert.equal(C.karmaSources({ points: 1, ownLeft: 2, team: t, member: false }), 'own');
    assert.equal(C.karmaSources({ points: 4, ownLeft: 0, team: t, member: true }), 'none');
  });
  test('the tracker choice puts the team pool away', (t) => {
    t.after(oldWay({ 'CORE_V95.teamKarma': 'tracker' }));
    assert.equal(C.karmaSources({ points: 1, ownLeft: 0, team: pool(['a'], 3), member: true }), 'none');
  });
});

describe('v0.95.0 core: racism and Charisma (Core p. 182)', () => {
  test('2D6 − 6 points; the table, own metatype ignored, two biases or all', () => {
    assert.equal(C.racismPoints(5), 0); assert.equal(C.racismPoints(9), 3); assert.equal(C.racismPoints(12), 6);
    assert.deepEqual(C.racismBias([5, 6], 'human'), { all: false, against: ['ork', 'troll'], used: 2, done: true });
    assert.deepEqual(C.racismBias([2, 5, 2], 'human'), { all: false, against: ['ork'], used: 3, done: false }, 'own race rolled twice is ignored');
    assert.deepEqual(C.racismBias([3, 1], 'human'), { all: true, against: [], used: 2, done: true });
    assert.deepEqual(C.racismBias([4, 4], 'elf'), { all: false, against: ['dwarf'], used: 2, done: true });
  });
  test('points against a speaker; the Charisma test at twice the points offsets them', () => {
    const r = C.racismOf({ points: 3, all: false, against: ['ork', 'all', 'bogus'], own: 'human', at: 1 })!;
    assert.deepEqual(r.against, ['ork']);
    assert.equal(C.racismVs(r, 'ork'), 3); assert.equal(C.racismVs(r, 'elf'), 0);
    const all = C.racismOf({ points: 2, all: true, own: 'elf', at: 1 });
    assert.equal(C.racismVs(all, 'elf'), 0); assert.equal(C.racismVs(all, 'troll'), 2);
    assert.equal(C.racismCharismaTn(3), 6);
    assert.equal(C.racismAfter(3, 2), 1); assert.equal(C.racismAfter(3, 5), 0);
    assert.equal(C.racismOf(null), null);
  });
});

describe('v0.95.0 core: training (Companion pp. 50, 52)', () => {
  test('the self-test TN; successes divide; none × 1.5; the instructor adds one per two', () => {
    assert.equal(C.trainingSelfTn({ to: 4 }), 6);
    assert.equal(C.trainingSelfTn({ to: 1 }), 4, 'a new skill');
    assert.equal(C.trainingSelfTn({ attribute: true, to: 6 }), 6);
    assert.equal(C.instructorHelp(2), 1); assert.equal(C.instructorHelp(5), 2);
    assert.equal(C.trainingDays95({ baseDays: 56, self: 2, help: 0 }), 28);
    assert.equal(C.trainingDays95({ baseDays: 56, self: 2, help: 1 }), 19);
    assert.equal(C.trainingDays95({ baseDays: 30, self: 0, help: 0 }), 45);
    assert.equal(C.trainingDays95({ baseDays: 30, self: null, help: 0 }), 30, 'no test rolled yet');
    assert.equal(C.instructorFee(4), 100); assert.equal(C.instructorFee(8), 600);
  });
  test('the Revamp\'s own training wins', (t) => {
    t.after(oldWay({ 'URR_V80.coreTraining': 'urr' }));
    assert.equal(C.trainingBook(), false);
  });
});

describe('v0.95.0 core: jumping and the water (Fields of Fire p. 76 with errata, Cyberpirates)', () => {
  test('half Strength (down) − natural Body, at least 1; a run adds Quickness; vertical a quarter', () => {
    assert.equal(C.jumpBase({ strength: 6, bodyNatural: 2, quickness: 4 }), 1);
    assert.equal(C.jumpBase({ strength: 9, bodyNatural: 2, quickness: 4, running: true }), 6);
    assert.equal(C.jumpBase({ strength: 9, bodyNatural: 2, quickness: 4, running: true, vertical: true }), 1.5);
    assert.equal(C.jumpTn(5, 4, 6), 6, '+1 when Strength is below Body');
    assert.equal(C.jumpDistance(6, 2), 7.2);
  });
  test('swimming against 4; treading water against 2 with the table and metatype; floating Body × successes', () => {
    assert.equal(C.waterTest('swim', 'troll').tn, 4);
    const tr = C.waterTest('tread', 'troll', ['boneLacing']);
    assert.equal(tr.tn, 2); assert.deepEqual(tr.modifiers.map((m) => m.value), [2, 1]);
    assert.equal(C.waterTest('float', 'elf').modifiers[0]!.value, -1);
    assert.equal(C.floatTurns(4, 2), 8);
  });
});

describe('v0.95.0 core: lifestyle (Core p. 190)', () => {
  test('months missed in a row; 1D6 above them is absorbed', () => {
    assert.equal(C.monthsMissed(1, 30), 1); assert.equal(C.monthsMissed(30, 30), 1); assert.equal(C.monthsMissed(31, 30), 2);
    assert.equal(C.monthsMissed(0, 30), 0);
    assert.equal(C.missedAbsorbed(2, 1), true); assert.equal(C.missedAbsorbed(1, 1), false);
    assert.deepEqual(C.missedMarkOf({ key: 5, rolled: 2, carried: 1 }, 5), { rolled: 2, carried: 1 });
    assert.deepEqual(C.missedMarkOf({ key: 4, rolled: 2 }, 5), { rolled: 0, carried: 0 });
  });
  test('Middle or better sells for the dice × 10 percent', () => {
    const order = ['street', 'squatter', 'low', 'middle', 'high', 'luxury'];
    assert.equal(C.canSellLifestyle('low', order), false); assert.equal(C.canSellLifestyle('middle', order), true);
    assert.equal(C.lifestyleSale(500000, 7), 350000);
  });
});

describe('v0.95.0 core: contacts (Core p. 200; Companion p. 62)', () => {
  test('the fee, the meet and upkeep', () => {
    assert.equal(C.contactFee({ etiquette: 5, successes: 2, charisma: 3, intelligence: 5 }), 800);
    assert.equal(C.meetBaseMinutes(7), 210); assert.equal(C.meetMinutes(210, 2), 105); assert.equal(C.meetMinutes(210, 0), 210);
    assert.deepEqual([1, 2, 3].map(C.contactUpkeepCost), [500, 3000, 7000]);
    const first = C.upkeepDue([{ id: 'a' }], {}, 100);
    assert.deepEqual(first.due, []); assert.equal(first.marks['a'], 100 + C.YEAR_SECONDS); assert.ok(first.changed);
    assert.deepEqual(C.upkeepDue([{ id: 'a' }], { a: 50 }, 100).due, ['a']);
    assert.ok(C.upkeepDue([], { gone: 5 }, 100).changed, 'a deleted contact\'s mark goes');
  });
});

describe('v0.95.0 core: groups (Core pp. 185, 180)', () => {
  test('group Perception: the average Intelligence plus a die per member', () => {
    assert.equal(C.groupPerceptionDice([4, 5, 6]), 8);
    assert.equal(C.groupPerceptionDice([]), 0);
    assert.equal(C.average([3, 4]), 4);
  });
});

// ---------------------------------------------------------------- The Team Karma relay (as the GM's client runs it)

describe('v0.95.0 core: the Team Karma relay trusts only the sender', () => {
  const g = globalThis as any;
  const saved: Record<string, any> = {};
  let store: any = { members: [], pool: 0, spent: 0 };
  const chat: string[] = [];
  const mkActor = (id: string, owner: string, poolN: number) => ({
    id, name: id, system: { karma: { pool: poolN, poolSpent: 0 }, derived: { karmaPoolLeft: poolN } },
    testUserPermission: (u: any) => u?.isGM || u?.id === owner,
    async update(d: any) { if ('system.karma.pool' in d) { this.system.karma.pool = d['system.karma.pool']; this.system.derived.karmaPoolLeft = d['system.karma.pool']; } },
  });
  const actors = new Map<string, any>();
  const gm = { id: 'gm', name: 'GM', isGM: true }, pl = { id: 'p1', name: 'Player', isGM: false };
  let relay: (data: any, user: any) => Promise<{ ok: boolean; note?: string }>;
  before(async () => {
    for (const k of ['game', 'ChatMessage']) saved[k] = g[k];
    g.game = { user: gm, settings: { get: () => store, set: async (_s: string, _k: string, v: any) => { store = v; } }, actors: { get: (id: string) => actors.get(id) }, users: [gm, pl] };
    g.ChatMessage = { create: async (d: any) => { chat.push(String(d.content)); return d; }, getSpeaker: () => ({}) };
    actors.set('a', mkActor('a', 'p1', 3)); actors.set('b', mkActor('b', 'p2', 2));
    relay = (await import('../applications/core95.ts')).teamRelay;
  });
  after(() => { for (const k of Object.keys(saved)) g[k] = saved[k]; });

  test('only the GM adds members, refreshes and corrects; a player cannot', async () => {
    assert.equal((await relay({ op: 'join', actorId: 'a' }, pl)).ok, false);
    assert.equal((await relay({ op: 'adjust', delta: 5 }, pl)).ok, false);
    assert.equal(store.pool, 0);
    assert.ok((await relay({ op: 'join', actorId: 'a' }, gm)).ok);
    assert.ok((await relay({ op: 'join', actorId: 'b' }, gm)).ok);
    assert.deepEqual(store, { members: ['a', 'b'], pool: 4, spent: 0 });
    assert.equal(actors.get('a').system.karma.pool, 2, 'the joining point leaves their own pool for good');
  });
  test('a player draws or gives only for a character they own', async () => {
    assert.equal((await relay({ op: 'spend', actorId: 'b', n: 1 }, pl)).ok, false, 'not their character');
    assert.equal((await relay({ op: 'give', actorId: 'b', n: 1 }, pl)).ok, false);
    assert.ok((await relay({ op: 'spend', actorId: 'a', n: 1 }, pl)).ok);
    assert.equal(store.spent, 1);
    assert.ok((await relay({ op: 'give', actorId: 'a', n: 1 }, pl)).ok);
    assert.equal(store.pool, 5); assert.equal(actors.get('a').system.karma.pool, 1);
    assert.equal((await relay({ op: 'spend', actorId: 'a', n: 99 }, pl)).ok, false, 'not more than is left');
  });
  test('a member leaving costs half; names in chat are escaped', async () => {
    actors.get('b').name = '<b>x</b>';
    assert.ok((await relay({ op: 'leave', actorId: 'b', mode: 'half' }, gm)).ok);
    assert.equal(store.pool, 3); assert.deepEqual(store.members, ['a']);
    assert.ok(!chat.some((c) => c.includes('<b>x</b>')));
    assert.equal((await relay({ op: 'leave', actorId: 'a', mode: 'share' }, pl)).ok, false, 'a player cannot remove a member');
  });
});

describe('v0.95.0 core: the hooks in the shared files', () => {
  const doc = read('src', 'module', 'documents', 'index.ts');
  const sheets = read('src', 'module', 'applications', 'sheets.ts');
  test('Karma spends, social tests, athletics, legwork, training and the lifestyle tick call the glue', () => {
    for (const s of ['C95G.karmaFromTeam(this, points)', 'C95G.takeTeamDice(this)', 'C95G.teamKarmaFor(this)', 'C95G.teamRefreshAll()', 'C95G.racismFor(this, target)',
      'C95G.racismCharisma(this, target', 'C95G.athleticsPlan(this, kind', 'C95G.afterLegwork(this, contact', 'C95G.instruction(student95', 'C95G.lifestyleTick(a)', 'C95G.contactUpkeepTick(a)', 'C95G.testExtras(this, snap.c95'])
      assert.ok(doc.includes(s), s);
    for (const s of ['C95G.trainingChoice(actor, id)', 'C95G.athleticsRows(actor)', 'C95G.sellLifestyle(actor)']) assert.ok(sheets.includes(s), s);
    assert.ok(read('src', 'module', 'applications', 'chat.ts').includes("action.startsWith('c95')"));
    assert.ok(read('src', 'module', 'applications', 'teamkarma.ts').includes('if (teamBook()) return teamRelay(data, user);'));
  });
});
