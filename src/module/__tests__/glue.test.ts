/**
 * Smoke tests for the Foundry glue layer using hand-rolled stubs of the Foundry globals.
 * These verify OUR wiring (derived data, damage flow, initiative passes) -- not that the
 * real Foundry v14 APIs behave as the stubs do. Final verification must happen in Foundry.
 */
import { test, describe, before, after, afterEach } from "node:test";
import { oldWay } from '../rules/__tests__/oldway.ts';
import { SPIRITS_V922_WAY } from '../rules/__tests__/spirits922.ts';
import { matrix922 } from "./helpers/matrix922.ts";
import { SORCERY_V922 } from '../rules/__tests__/sorcery922.ts';
import assert from "node:assert/strict";
import { RULES } from "../rules/index.ts";
import { shown } from "./helpers/shown.ts";
import { useV922Vehicles } from '../rules/__tests__/v922vehicles.ts';
import { combat922 } from '../rules/__tests__/combat922.ts';

// v0.92.3: these tests pin the v0.92.2 combat flow (COMBAT_V923 at its old choices, the moved defaults put back);
// the book alignment is tested in v0923-combat.test.ts.
let undo922: () => void = () => {};
before(() => { undo922 = combat922(); });
after(() => undo922());

const g = globalThis as any;
const faces: number[] = [];
const chat: any[] = [];
const warnings: string[] = [];
const uuidRegistry = new Map<string, any>();

class StubRoll {
  formula: string;
  dice: any[] = [];
  total = 0;
  constructor(formula: string) { this.formula = formula; }
  async evaluate() {
    const m = /^(\d+)d6(?:\s*\+\s*(\d+))?$/.exec(this.formula);
    if (!m) throw new Error(`unexpected formula ${this.formula}`);
    const n = Number(m[1]);
    const results = Array.from({ length: n }, () => {
      const f = faces.shift();
      if (f === undefined) throw new Error("out of scripted faces");
      return { result: f };
    });
    this.dice = [{ results }];
    this.total = results.reduce((a, r) => a + r.result, 0) + Number(m[2] ?? 0);
    return this;
  }
}

function setPath(obj: any, path: string, value: unknown) {
  const parts = path.split(".");
  let o = obj;
  // v0.65.0: flag paths may not exist yet; "-=key" deletes (as Foundry's update does).
  for (const p of parts.slice(0, -1)) o = (o[p] ??= {});
  const last = parts[parts.length - 1] as string;
  if (last.startsWith("-=")) delete o[last.slice(2)]; else o[last] = value;
}

let SpiritDataModel: any;
let CharacterDataModel: any, SR2Actor: any, SR2Combatant: any, SR2Combat: any;

before(async () => {
  // v0.92.3: these tests pin the v0.92.2 conjuring, astral and initiation rules; the book way is v0923-spirits.test.ts's.
  oldWay(SPIRITS_V922_WAY);
  // The disaster GM card (v0.35.0) would be the last message after every all-ones roll; its own test turns it on.
  (RULES.DISASTERS as any).prompt = false;
  // v0.39.0 rules that add steps or warnings are switched on only in their own tests.
  (RULES.MAGIC_V39.ritualStages as any).enabled = false;
  (RULES.MAGIC_V39.sites as any).enforce = 'off';
  (RULES.MAGIC_V39.domains as any).enforce = 'off';
  // v0.56.0: learning tests (the older tests buy spells with Karma alone) and centering tests are switched on in their own tests.
  (RULES.MAGIC_V56.learning as any).enabled = false;
  // v0.91.8: learning needs a spell formula (RULES.FORMULA_V918.required); the older tests learn without one.
  (RULES.FORMULA_V918 as any).required = "off";
  (RULES.MAGIC_V56.centering as any).mode = 'auto';
  // v0.65.0: waiting for time (on by default) is tested in v065.test.ts; these older tests check the instant results.
  (RULES.WAITING as any).enabled = false;
  (RULES.CHARACTERS_V58.training as any).mode = 'instant';
  // v0.71.0 (R17): rigger adaptation is needed by default now; these older tests jump into unadapted cars (v071.test.ts covers it).
  (RULES.RIGGING as any).needsAdaptation = false;
  // v0.92.3: these older tests pin the v0.92.2 sorcery rules (RULES.SORCERY_V923); the book's way is in v0923-sorcery.test.ts.
  oldWay(SORCERY_V922);
  g.foundry = {
    abstract: { TypeDataModel: class {} },
    data: { fields: new Proxy({}, { get: () => class { constructor(..._a: any[]) {} } }) },
  };
  g.Roll = StubRoll;
  g.ChatMessage = { create: async (d: any) => { chat.push(d); }, getSpeaker: () => ({}) };
  g.game = { i18n: { localize: (k: string) => k } };
  g.fromUuidSync = (u: string) => ({ name: u });
  g.ui = { notifications: { warn: (m: string) => { warnings.push(m); }, info: () => {} } };
  g.fromUuid = async (u: string) => uuidRegistry.get(u) ?? null;
  g.Actor = class {
    items: any[] = []; system: any; flags: any = {}; isOwner = true; ownership: any = { default: 0 };
    getFlag(scope: string, key: string) { return this.flags[scope]?.[key]; }
    async setFlag(scope: string, key: string, v: any) { (this.flags[scope] ??= {})[key] = v; }
    async unsetFlag(scope: string, key: string) { if (this.flags[scope]) delete this.flags[scope][key]; }
    async update(d: any) { for (const [k, v] of Object.entries(d)) setPath(this, k, v); this.system.parent ??= this; this.system.prepareDerivedData?.(); }
    async createEmbeddedDocuments(_t: string, docs: any[]) { let n = this.items.length; for (const d of docs) this.items.push({ id: `i${n++}`, ...d, system: { ...d.system } }); this.system.prepareDerivedData?.(); return docs; }
    async updateEmbeddedDocuments(_t: string, ups: any[]) { for (const u of ups) { const it = this.items.find((i) => i.id === u._id); if (it) Object.assign(it.system, u.system); } this.system.prepareDerivedData?.(); }
  };
  g.Item = class {};
  g.Combatant = class { actor: any; };
  g.Combat = class {
    turns: any[] = []; turn: number | null = 0; combatants: any[] = []; flags: any = {};
    setupTurns() { return this.turns; }
    getFlag(_s: string, k: string) { return this.flags[k]; }
    async setFlag(_s: string, k: string, v: any) { this.flags[k] = v; }
    async update(d: any) { for (const [k, v] of Object.entries(d)) { if (k.startsWith("flags.sr2e.")) this.flags[k.slice(11)] = v; else (this as any)[k] = v; } }
    async nextTurn() { (this as any).turn = ((this as any).turn ?? -1) + 1; return this; }
    async previousTurn() { (this as any).turn = ((this as any).turn ?? 1) - 1; return this; }
    async previousRound() { (this as any).round = Math.max(0, ((this as any).round ?? 0) - 1); return this; }
    async updateEmbeddedDocuments(_t: string, ups: any[]) { for (const u of ups) { const c = this.combatants.find((x) => x.id === u._id); if (c) c.initiative = u.initiative; } }
    async nextRound() { (this as any).round = ((this as any).round ?? 0) + 1; }
    // Mirrors real Foundry: rollAll only rolls combatants whose initiative is null.
    async rollAll() {
      (this as any).rolledAll = true;
      for (const c of this.combatants) if (c.initiative === null) c.initiative = 10;
    }
  };
  ({ CharacterDataModel, SpiritDataModel } = await import("../models/index.ts"));
  ({ SR2Actor, SR2Combatant, SR2Combat } = await import("../documents/index.ts"));
});

function makeActor(attrs: Record<string, number>, extra: any = {}) {
  const sys = Object.create(CharacterDataModel.prototype);
  sys.attributes = Object.fromEntries(Object.entries(attrs).map(([k, v]) => [k, { base: v, mod: 0 }]));
  Object.assign(sys, { essence: 6, magic: 0, reactionBonus: 0, initiativeDiceBonus: 0,
    poolSpent: { combat: 0, spell: 0 }, monitor: { physical: 0, stun: 0 }, ...extra });
  sys.prepareDerivedData();
  const actor = new SR2Actor();
  actor.system = sys;
  actor.uuid = `Actor.${(makeActor as any).n = ((makeActor as any).n ?? 0) + 1}`;
  return actor;
}
const A = { body: 5, quickness: 6, strength: 4, charisma: 3, intelligence: 4, willpower: 4 };

describe("CharacterDataModel.prepareDerivedData", () => {
  test("computes totals, reaction, pools, wounds, status", () => {
    const a = makeActor(A, { monitor: { physical: 3, stun: 0 }, initiativeDiceBonus: 1 });
    const d = a.system.derived;
    assert.equal(a.system.attributes.body.total, 5);
    assert.equal(d.reaction, 5);          // (6+4)/2
    assert.equal(d.initiativeDice, 2);
    assert.equal(d.combatPool, 7);        // (6+4+4)/2
    assert.equal(d.woundModifier, 2);     // 3 physical boxes = Moderate
    assert.equal(d.status, "ok");
  });
  test("attribute mods feed the totals", () => {
    const sys = Object.create(CharacterDataModel.prototype);
    sys.attributes = Object.fromEntries(Object.keys(A).map((k) => [k, { base: 3, mod: 0 }]));
    sys.attributes.quickness.mod = 2;
    Object.assign(sys, { essence: 6, magic: 0, reactionBonus: 0, initiativeDiceBonus: 0, poolSpent: { combat: 0, spell: 0 }, monitor: { physical: 0, stun: 0 } });
    sys.prepareDerivedData();
    assert.equal(sys.attributes.quickness.total, 5);
  });
});

describe("SR2Actor tests and damage", () => {
  test("attribute roll posts a chat message, includes wound modifier in the TN", async () => {
    chat.length = 0;
    const a = makeActor(A, { monitor: { physical: 3, stun: 0 } }); // +2 TN
    faces.push(5, 5, 5, 5, 5); // body 5 dice
    const r = await a.rollAttribute("body", { targetNumber: 4 });
    assert.equal(r.targetNumber, 6);
    assert.equal(r.successes, 0); // 5 < 6, no sixes
    assert.equal(chat.length, 1);
    assert.match(chat[0].content, /TN <strong>6<\/strong>/);
  });

  test("pool dice are capped at what is left and then recorded as spent", async () => {
    chat.length = 0;
    const a = makeActor(A); // combat pool 7
    faces.push(3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3); // plenty
    await a.rollAttribute("body", { targetNumber: 4, poolDice: 99 });
    assert.equal(a.system.poolSpent.combat, 7);
  });

  test("resistDamage: Body test vs Power-armor, stages down, marks the monitor", async () => {
    chat.length = 0;
    const a = makeActor(A);
    // 9S, armor 4 -> TN 5. Body 5 dice: 5,5,6,5(+explode 1... ) keep simple: 5,5,5,2,3 = 3 successes
    faces.push(5, 5, 5, 2, 3);
    await a.resistDamage({ power: 9, level: "S", armor: 4, type: "physical" });
    // 3 successes -> stage down 1: S -> M = 3 boxes
    assert.equal(a.system.monitor.physical, 3);
    assert.equal(a.system.monitor.stun, 0);
    assert.match(chat[0].content, /Takes <strong>M<\/strong>/);
  });

  test("fully resisted damage marks nothing", async () => {
    chat.length = 0;
    const a = makeActor(A);
    faces.push(4, 4, 4, 4, 4); // TN 2: five successes, L drops below Light
    await a.resistDamage({ power: 3, level: "L", armor: 5 });
    assert.deepEqual({ ...a.system.monitor }, { physical: 0, stun: 0 });
    assert.match(chat[0].content, /fully resisted/);
  });

  test("resistDamageCode parses and rejects", async () => {
    const a = makeActor(A);
    await assert.rejects(() => a.resistDamageCode("nonsense"), /Not a damage code/);
  });

  test("armorRating sums worn armor only", () => {
    const a = makeActor(A);
    a.items = [
      { type: "armor", system: { worn: true, ballistic: 3, impact: 1 } },
      { type: "armor", system: { worn: false, ballistic: 5, impact: 5 } },
      { type: "gear", system: {} },
    ];
    assert.equal(a.armorRating("ballistic"), 3);
  });
});

describe("initiative and passes", () => {
  test("combatant rolls reaction + Nd6", () => {
    const c = new SR2Combatant();
    c.actor = makeActor(A, { initiativeDiceBonus: 1 });
    assert.equal(c.getInitiativeRoll().formula, "2d6 + 5");
  });

  test("v0.54.0: wounds lower the initiative roll (not an astral form's)", () => {
    const c = new SR2Combatant();
    c.actor = makeActor(A, { initiativeDiceBonus: 1, monitor: { physical: 3, stun: 0 } });
    assert.equal(c.getInitiativeRoll().formula, "2d6 + 5 - 2");
    (RULES.INITIATIVE_WOUNDS as any).enabled = false;
    try { assert.equal(c.getInitiativeRoll().formula, "2d6 + 5"); } finally { (RULES.INITIATIVE_WOUNDS as any).enabled = true; }
  });

  test("combat advances through passes, then starts a new turn and rerolls", async () => {
    g.game.user = { isGM: true, id: "gm1" }; g.game.users = Object.assign([{ id: "gm1", isGM: true }], { activeGM: { id: "gm1", isSelf: true } });
    const combat = new SR2Combat();
    (combat as any).round = 1;
    combat.combatants = [{ id: "a", initiative: 23, isDefeated: false, actor: { refreshPools: async () => {} } },
                         { id: "b", initiative: 8, isDefeated: false, actor: { refreshPools: async () => {} } }];
    combat.turns = combat.combatants;
    combat.turn = 1; // at the last turn of pass 0
    await combat.nextTurn();
    assert.equal(combat.combatants[0].initiative, 13);
    assert.equal(combat.combatants[1].initiative, -2);
    assert.equal(combat.turn, 0);
    assert.equal(combat.pass, 1);
    // end pass 1: 13 -> 3, still > 0
    combat.turns = [combat.combatants[0]]; combat.turn = 0;
    await combat.nextTurn();
    assert.equal(combat.combatants[0].initiative, 3);
    assert.equal(combat.pass, 2);
    // end pass 2: 3 -> -7, nobody left: new combat turn
    await combat.nextTurn();
    assert.equal(combat.pass, 0);
    assert.equal((combat as any).rolledAll, true);
    assert.equal((combat as any).round, 2);
    // everyone must have been re-rolled (not left at a spent negative score)
    assert.ok(combat.combatants.every((c: any) => c.initiative === 10));
    // v0.59.0: the last pass's initiative is kept for Previous Round, and the timers ran once for round 2.
    assert.deepEqual(combat.flags.lastPass, { round: 1, pass: 2, init: { a: 3, b: -12 } });
    assert.equal(combat.flags.tickedRound, 2);
  });

  test("v0.59.0: Next Round from the tracker runs the SR2 new Combat Turn too", async () => {
    g.game.user = { isGM: true, id: "gm1" }; g.game.users = Object.assign([{ id: "gm1", isGM: true }], { activeGM: { id: "gm1", isSelf: true } });
    let refreshed = 0;
    const combat = new SR2Combat();
    (combat as any).round = 3; combat.flags.pass = 1;
    combat.combatants = [{ id: "a", initiative: 7, actor: { refreshPools: async () => { refreshed++; } } }];
    combat.turns = combat.combatants; combat.turn = 0;
    await combat.nextRound();
    assert.equal((combat as any).round, 4);
    assert.equal(combat.pass, 0);
    assert.equal(combat.combatants[0].initiative, 10);
    assert.equal(refreshed, 1);
    assert.deepEqual(combat.flags.lastPass, { round: 3, pass: 1, init: { a: 7 } });
    // The timers run once per Combat Turn, however often they are asked to.
    let ran = 0;
    const orig = SR2Actor.securityResponses;
    (SR2Actor as any).securityResponses = async () => { ran++; };
    try { await combat.runRoundTicks(4); await combat.runRoundTicks(4); } finally { (SR2Actor as any).securityResponses = orig; }
    assert.equal(ran, 0);
  });

  test("v0.59.0: Previous Turn at the start of a pass goes back to the pass before; Previous Round restores the last pass", async () => {
    g.game.user = { isGM: true, id: "gm1" };
    const combat = new SR2Combat();
    (combat as any).round = 2; combat.flags.pass = 1;
    combat.combatants = [{ id: "a", initiative: 5 }, { id: "b", initiative: -4 }];
    combat.turns = [combat.combatants[0]]; combat.turn = 0;
    combat.setupTurns = function () { this.turns = this.combatants.filter((c: any) => c.initiative > 0); return this.turns; };
    await combat.previousTurn();
    assert.equal(combat.pass, 0);
    assert.deepEqual(combat.combatants.map((c: any) => c.initiative), [15, 6]);
    assert.equal(combat.turn, 1); // the last of the two who acted in pass 0
    // At the first turn of pass 0: back to the last pass of Combat Turn 1, as it was kept.
    combat.turn = 0;
    combat.flags.lastPass = { round: 1, pass: 2, init: { a: 2, b: -8 } };
    await combat.previousTurn();
    assert.equal((combat as any).round, 1);
    assert.equal(combat.pass, 2);
    assert.deepEqual(combat.combatants.map((c: any) => c.initiative), [2, -8]);
    assert.equal(combat.turn, 0);
    // No record for the Combat Turn before that: refused, nothing changes.
    (combat as any).round = 5; warnings.length = 0;
    await combat.previousRound();
    assert.equal((combat as any).round, 5);
    assert.match(warnings.join(' '), /only one Combat Turn/);
  });

  test("v0.59.0 review: with Skip Defeated, a defeated combatant last in the pass ends the pass (not the Combat Turn)", async () => {
    g.game.user = { isGM: true, id: "gm1" }; g.game.users = Object.assign([{ id: "gm1", isGM: true }], { activeGM: { id: "gm1", isSelf: true } });
    const combat = new SR2Combat();
    (combat as any).round = 2; (combat as any).settings = { skipDefeated: true }; combat.flags.pass = 0;
    combat.combatants = [{ id: "a", initiative: 15 }, { id: "b", initiative: 12, isDefeated: true }];
    combat.turns = [...combat.combatants]; combat.turn = 0;
    await combat.nextTurn();
    assert.equal((combat as any).round, 2);             // still the same Combat Turn
    assert.equal(combat.pass, 1);
    assert.equal(combat.combatants[0].initiative, 5);
    assert.deepEqual(combat.flags.passBefore, { round: 2, pass: 0, init: { a: 15, b: 12 } });
    // Back again: the scores exactly as they were (null stays null too).
    combat.setupTurns = function () { this.turns = this.combatants.filter((c: any) => c.initiative === null || c.initiative > 0); return this.turns; };
    combat.turn = 0;
    await combat.previousTurn();
    assert.deepEqual(combat.combatants.map((c: any) => c.initiative), [15, 12]);
    assert.equal(combat.pass, 0);
  });

  test("v0.59.0: a player's client asks the GM to end the pass, and the GM checks who asks", async () => {
    const socketMod = await import("../applications/socket.ts");
    const sent: any[] = [];
    const utilsBefore = g.foundry.utils; const usersBefore = g.game.users; const userBefore = g.game.user;
    g.foundry.utils = { ...(utilsBefore ?? {}), randomID: () => "req1" };
    g.game.socket = { emit: (_n: string, m: any) => { sent.push(m); }, on: () => {} };
    g.game.user = { isGM: false, id: "p1" };
    g.game.users = Object.assign([{ id: "gm1", isGM: true }, { id: "p1", isGM: false }], { activeGM: { id: "gm1", isSelf: false } });
    const combat = new SR2Combat();
    (combat as any).id = "c1"; (combat as any).round = 2; combat.flags.pass = 0;
    combat.combatants = [{ id: "a", initiative: 6 }]; combat.turns = combat.combatants; combat.turn = 0;
    const p = combat.nextTurn();
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(sent.length, 1);
    assert.equal(sent[0].op, "nextTurn");
    assert.deepEqual(sent[0].data, { combatId: "c1", state: { round: 2, turn: 0, pass: 0 } });
    assert.equal(combat.combatants[0].initiative, 6); // nothing changed on the player's side
    await socketMod.handleSocket({ type: "reply", id: "req1", to: "p1", ok: true });
    await p;
    // Pure checks the GM's side makes.
    assert.ok(socketMod.sameCombatState({ round: 2, turn: 0, pass: 1 }, { round: 2, turn: 0, pass: 1 }));
    assert.ok(!socketMod.sameCombatState({ round: 2, turn: 0, pass: 1 }, { round: 2, turn: 1, pass: 1 }));
    const owner = { actor: { testUserPermission: (u: any) => u.id === "p1" } };
    assert.ok(socketMod.mayEndTurn({ id: "p1", isGM: false }, owner));
    assert.ok(!socketMod.mayEndTurn({ id: "p2", isGM: false }, owner));
    assert.ok(socketMod.mayEndTurn({ id: "gm", isGM: true }, null));
    // On the GM's side: a request claiming to be from a GM is refused; a forged round never runs the timers.
    g.game.user = { isGM: true, id: "gm1" };
    g.game.users = Object.assign([{ id: "gm1", isGM: true }, { id: "p1", isGM: false }], { activeGM: { id: "gm1", isSelf: true }, get: (id: string) => g.game.users.find((u: any) => u.id === id) });
    const { registerCombatRelay } = await import("../documents/index.ts");
    registerCombatRelay();
    const live = new SR2Combat();
    (live as any).id = "c9"; (live as any).round = 4; (live as any).started = true;
    g.game.combats = { get: (id: string) => (id === "c9" ? live : undefined) };
    sent.length = 0;
    await socketMod.handleSocket({ type: "request", id: "r1", op: "nextTurn", userId: "gm1", data: { combatId: "c9", state: { round: 4, turn: 0, pass: 0 } } } as any, "gm1"); // v0.81.0: the sender comes from the transport
    assert.deepEqual({ ok: sent.at(-1).ok, note: sent.at(-1).note }, { ok: false, note: "Refused." });
    let ticked = -1;
    (live as any).runRoundTicks = async (r: number) => { ticked = r; };
    await socketMod.handleSocket({ type: "request", id: "r2", op: "roundTicks", userId: "gm1", data: { combatId: "c9", round: 9999 } } as any, "gm1"); // v0.81.0: the sender comes from the transport
    assert.equal(ticked, -1);
    assert.deepEqual({ ok: sent.at(-1).ok, note: sent.at(-1).note }, { ok: false, note: "That Combat Turn has passed." });
    await socketMod.handleSocket({ type: "request", id: "r3", op: "roundTicks", userId: "gm1", data: { combatId: "c9", round: 4 } } as any, "gm1"); // v0.81.0: the sender comes from the transport
    assert.equal(ticked, 4);
    delete g.game.combats;
    delete g.game.socket; g.foundry.utils = utilsBefore; g.game.users = usersBefore; g.game.user = userBefore;
  });
});

describe("attack, defend, resist flow", () => {
  const weapon = (over: any = {}) => ({
    name: "Predator",
    system: { melee: false, skill: "Pistols", damagePower: 9, damageLevel: "M", damageType: "physical", ...over },
  });

  test("a hit with a target carries attack state and a Defend button", async () => {
    chat.length = 0;
    const atk = makeActor(A);
    atk.items = [{ type: "skill", name: "Pistols", system: { rating: 5, attribute: "quickness" } }];
    faces.push(5, 5, 5, 2, 2); // 5 dice (skill 5) at TN 5 (short=4? see below) -> plenty of hits
    const r = await atk.attackWith(weapon(), { targetUuid: "Actor.target", range: "medium" });
    assert.equal(r.targetNumber, 5); // medium range base TN
    assert.ok(r.successes >= 1);
    const msg = chat.at(-1);
    assert.match(msg.content, /data-sr2e-action="defend"/);
    assert.equal(msg.flags.sr2e.attack.targetUuid, "Actor.target");
    assert.equal(msg.flags.sr2e.attack.power, 9);
    assert.equal(msg.flags.sr2e.attack.targetNumber, 5);
    assert.equal(msg.flags.sr2e.attack.attackSuccesses, r.successes);
  });

  test("a miss posts no defend button and no state", async () => {
    chat.length = 0;
    const atk = makeActor(A);
    atk.items = [{ type: "skill", name: "Pistols", system: { rating: 3, attribute: "quickness" } }];
    faces.push(2, 3, 2);
    await atk.attackWith(weapon(), { targetUuid: "Actor.target", range: "short" });
    assert.doesNotMatch(chat.at(-1).content, /data-sr2e-action/);
    assert.match(chat.at(-1).content, /missed/i);
    assert.equal(chat.at(-1).flags.sr2e.attack, undefined);
  });

  test("an attack with no target is just a roll", async () => {
    chat.length = 0;
    const atk = makeActor(A);
    atk.items = [{ type: "skill", name: "Pistols", system: { rating: 2, attribute: "quickness" } }];
    faces.push(6, 5); faces.push(1);
    await atk.attackWith(weapon(), { range: "short" });
    assert.doesNotMatch(chat.at(-1).content, /data-sr2e-action|missed/);
  });

  test("a measured distance shows on the card, with a note when attacking out of range", async () => {
    chat.length = 0;
    const atk = makeActor(A);
    atk.items = [{ type: "skill", name: "Pistols", system: { rating: 2, attribute: "quickness" } }];
    faces.push(2, 2);
    await atk.attackWith(weapon(), { range: "long", measuredMetres: 33.27 });
    assert.match(chat.at(-1).content, /Range: long, 33\.3 m,/);
    faces.push(2, 2);
    await atk.attackWith(weapon(), { range: "extreme", measuredMetres: 80, outOfRange: true });
    assert.match(chat.at(-1).content, /80 m — beyond extreme/);
  });

  test("an unskilled attacker defaults to Quickness at a TN penalty", async () => {
    chat.length = 0;
    const atk = makeActor(A); // no skills
    faces.push(1, 2, 3, 4, 5, 6); faces.push(1);
    const r = await atk.attackWith(weapon(), { range: "short" });
    assert.equal(r.totalDice, 6);       // Quickness 6
    assert.equal(r.targetNumber, 8);    // 4 short + 4 default
  });

  test("ranged defense: no pool dice means no dodge roll and the attack lands", async () => {
    chat.length = 0;
    const def = makeActor(A);
    await def.defend({ attackerUuid: "Actor.a", targetUuid: def.uuid, weaponName: "Predator", melee: false,
      damageType: "physical", power: 9, level: "M", attackSuccesses: 2, targetNumber: 5 }, 0);
    const msg = chat.at(-1);
    assert.match(msg.content, /Hit!/);
    assert.match(msg.content, /data-sr2e-action="resist"/);
    assert.deepEqual({ ...msg.flags.sr2e.damage }, { targetUuid: def.uuid, melee: false, damageType: "physical", power: 9, level: "M" });
  });

  test("dodging with pool dice can cancel the attack and spends the pool", async () => {
    chat.length = 0;
    const def = makeActor(A); // combat pool 7
    faces.push(5, 5, 5);      // 3 pool dice, TN 5 -> 3 successes
    await def.defend({ attackerUuid: "Actor.a", targetUuid: def.uuid, weaponName: "Predator", melee: false,
      damageType: "physical", power: 9, level: "M", attackSuccesses: 3, targetNumber: 5 }, 3);
    assert.match(chat.at(-1).content, /Missed/);
    assert.equal(chat.at(-1).flags.sr2e.damage, undefined);
    assert.equal(def.system.poolSpent.combat, 3);
  });

  test("net successes stage the damage up on the damage card", async () => {
    chat.length = 0;
    const def = makeActor(A);
    await def.defend({ attackerUuid: "Actor.a", targetUuid: def.uuid, weaponName: "Predator", melee: false,
      damageType: "physical", power: 9, level: "M", attackSuccesses: 4, targetNumber: 5 }, 0);
    assert.equal(chat.at(-1).flags.sr2e.damage.level, "S"); // 4 net: M -> S
  });

  test("v0.55.0: an unaware target can't dodge or spend pool dice", async () => {
    chat.length = 0;
    const def = makeActor(A);
    await def.defend({ attackerUuid: "Actor.a", targetUuid: def.uuid, weaponName: "Predator", melee: false,
      damageType: "physical", power: 9, level: "M", attackSuccesses: 2, targetNumber: 5, unaware: true }, 3);
    assert.match(chat.at(-1).content, /never saw it coming/);
    assert.equal(def.system.poolSpent.combat, 0);
    assert.match(chat.at(-1).content, /data-sr2e-action="resist"/);
  });

  test("v0.55.0: suppressive fire passes over someone in cover", async () => {
    chat.length = 0;
    const def = makeActor(A);
    def.statuses = new Set(["prone"]);
    await def.defend({ attackerUuid: "Actor.a", targetUuid: def.uuid, weaponName: "AK", melee: false,
      damageType: "physical", power: 8, level: "M", attackSuccesses: 3, targetNumber: 4, suppressive: true }, 0);
    assert.match(chat.at(-1).content, /passes overhead/);
  });

  test("v0.55.0: a weapon's armor kind and toxin travel with the attack", async () => {
    chat.length = 0;
    const atk = makeActor(A);
    atk.items = [{ type: "skill", name: "Throwing Weapons", system: { rating: 5, attribute: "quickness" } },
      { id: "tx", type: "gear", name: "Narcoject", system: { toxin: { kind: "toxin", vector: "injection", power: 8, level: "S", damageType: "stun", speed: "immediate" } } }];
    faces.push(5, 5, 5, 5, 5);
    await atk.attackWith(weapon({ skill: "Throwing Weapons", name: "Dart", toxinId: "tx" }), { targetUuid: "Actor.target", range: "short" });
    const st = chat.at(-1).flags.sr2e.attack;
    assert.equal(st.armorKind, "impact");
    assert.equal(st.toxinHit.name, "Narcoject");
    assert.equal(st.toxinHit.needsWound, false);
  });

  test("v0.55.0: the soak card offers the toxin when it lands", async () => {
    chat.length = 0;
    const def = makeActor(A);
    def.type = "character";
    faces.push(5, 5, 5, 5, 5);
    await def.resistDamage({ power: 2, level: "L", armor: 0, toxinHit: { name: "Narcoject", vector: "injection", power: 8, level: "S", damageType: "stun", from: "X", needsWound: false } });
    const card = chat[0];
    faces.length = 0;
    assert.equal(card.flags.sr2e.toxinHit.toxin.name, "Narcoject");
    assert.match(card.content, /data-sr2e-action="toxinHit"/);
  });

  test("v0.55.0: slap patches: stim takes Stun off and it comes back; antidote dice; trauma stabilises", async (t) => {
    t.after(oldWay({"BOOK_V78.patches.stim": "hours"})); // v0.78.0: the old rule (a house rule)
    chat.length = 0;
    const a = makeActor(A, { monitor: { physical: 0, stun: 5 }, care: { stabilised: false, dyingSince: -1 } });
    a.flags.sr2e = {};
    const items: any[] = [{ id: "p1", type: "gear", name: "Stim patch", system: { quantity: 2, patch: { kind: "stim", rating: 3 } } },
      { id: "p2", type: "gear", name: "Antidote patch", system: { quantity: 1, patch: { kind: "antidote", rating: 4 } } }];
    a.items = Object.assign(items, { get(id: string) { return items.find((i: any) => i.id === id); } });
    for (const it of items) it.update = async (d: any) => { for (const [k, v] of Object.entries(d)) setPath(it, k, v); };
    assert.equal(await a.applyPatch("p1"), true);
    assert.equal(a.system.monitor.stun, 2);
    assert.equal(items[0].system.quantity, 1);
    assert.equal(a.flags.sr2e.stimDebt[0].boxes, 4);
    assert.equal(await a.applyPatch("p2"), true);
    assert.equal(a.flags.sr2e.antidote.dice, 4);
    assert.equal(await a.applyPatch("p2"), false); // none left
  });
  const katanaAttack = (def: any, over: any = {}) => ({ attackerUuid: "Actor.atk", targetUuid: def.uuid, weaponName: "Katana", melee: true,
    damageType: "physical", power: 6, level: "M", attackSuccesses: 1, targetNumber: 4, reach: 1, ...over });

  test("opposed melee: the defender rolls their melee skill vs TN 4 and reach; the attacker winning hits", async (t) => {
    t.after(oldWay({ "DOCS_V79.meleeReachShorter": "longer" })); // v0.79.0: the old reach (a house rule); the book: +1 for the defender
    chat.length = 0;
    const def = makeActor(A);
    def.items = [{ id: "s1", type: "skill", name: "Unarmed Combat", system: { rating: 3, attribute: "strength" } }];
    faces.push(2, 2, 2);                                   // 3 dice, no successes
    await def.defend(katanaAttack(def, { attackSuccesses: 3 }), 0);
    const msg = chat.at(-1);
    assert.match(msg.content, /Melee defense with Unarmed/);
    assert.match(msg.content, /TN <strong>4<\/strong>/);   // the attacker's longer reach helped the attacker, not the defender
    assert.match(msg.content, /Hit!/);
    assert.equal(msg.flags.sr2e.damage.targetUuid, def.uuid);
    assert.equal(msg.flags.sr2e.damage.level, "S");         // 3 net: M -> S
  });

  test("opposed melee: a defender with more successes counterattacks with their own weapon", async () => {
    chat.length = 0;
    const def = makeActor(A);                              // Strength 4
    def.items = [
      { id: "s1", type: "skill", name: "Clubs", system: { rating: 4, attribute: "strength" } },
      { id: "w1", type: "weapon", name: "Club", system: { melee: true, skill: "Clubs", strengthPower: true, damagePower: 1, damageLevel: "M", damageType: "physical", reach: 1 } },
    ];
    faces.push(5, 5, 5, 1);                                 // TN 4 (equal reach): 3 successes
    await def.defend(katanaAttack(def, { attackSuccesses: 1 }), 0, { weaponId: "w1" });
    const msg = chat.at(-1);
    assert.match(msg.content, /Counterattack!/);
    assert.equal(msg.flags.sr2e.damage.targetUuid, "Actor.atk");
    assert.equal(msg.flags.sr2e.damage.power, 5);           // STR 4 + 1
    assert.equal(msg.flags.sr2e.damage.level, "M");         // 2 net: the first hits, a stage needs 2 more
  });

  test("opposed melee: a tie hurts nobody; a melee attack with no successes still offers Defend", async () => {
    chat.length = 0;
    const def = makeActor(A);
    def.items = [{ id: "s1", type: "skill", name: "Unarmed Combat", system: { rating: 1, attribute: "strength" } }];
    faces.push(5);
    await def.defend(katanaAttack(def, { attackSuccesses: 1, reach: 0 }), 0);
    assert.match(chat.at(-1).content, /No damage/);

    chat.length = 0;
    const atk = makeActor(A);
    atk.items = [{ type: "skill", name: "Edged", system: { rating: 2, attribute: "strength" } }];
    faces.push(1, 2);
    await atk.attackWith({ name: "Katana", system: { melee: true, skill: "Edged", damagePower: 3, damageLevel: "M", damageType: "physical", reach: 1, strengthPower: true } }, { targetUuid: def.uuid });
    assert.match(chat.at(-1).content, /may still counterattack/);
    assert.equal(chat.at(-1).flags.sr2e.attack.power, 7);   // STR 4 + 3
    assert.equal(chat.at(-1).flags.sr2e.attack.reach, 1);
  });

  test("resist from state uses ballistic armor for ranged and impact for melee", async () => {
    const armored = () => {
      const a = makeActor(A);
      a.items = [{ type: "armor", system: { worn: true, ballistic: 6, impact: 2 } }];
      return a;
    };
    chat.length = 0;
    faces.push(1, 1, 1, 1, 1);
    await armored().resistFromState({ targetUuid: "x", melee: false, damageType: "physical", power: 10, level: "M" }, 0);
    assert.match(chat.at(-1).content, /vs TN <strong>4<\/strong>/); // 10 - ballistic 6

    chat.length = 0;
    faces.push(2, 2, 2, 2, 2);
    await armored().resistFromState({ targetUuid: "x", melee: true, damageType: "physical", power: 10, level: "M" }, 0);
    assert.match(chat.at(-1).content, /vs TN <strong>8<\/strong>/);  // 10 - impact 2
  });
});

describe("cyberware feeds derived stats", () => {
  // v0.79.0: these fixtures count dice for the old Spell Pool, (Int + Wil + Magic) / 3 (RULES.DOCS_V79.magicPool.size).
  let undoPool79 = () => {}; before(() => { undoPool79 = oldWay({ "DOCS_V79.magicPool.size": "attributes" }); }); after(() => undoPool79());
  const cyber = (over: any = {}) => ({
    type: "cyberware",
    system: {
      essenceCost: 2, grade: "standard", installed: true, reaction: 0, initiativeDice: 0,
      attributes: { body: 0, quickness: 0, strength: 0, charisma: 0, intelligence: 0, willpower: 0 },
      ...over,
    },
  });
  const withCyber = (items: any[], extra: any = {}) => {
    const sys = Object.create(CharacterDataModel.prototype);
    sys.attributes = Object.fromEntries(Object.entries(A).map(([k, v]) => [k, { base: v, mod: 0 }]));
    Object.assign(sys, { essence: 6, magic: 0, reactionBonus: 0, initiativeDiceBonus: 0,
      poolSpent: { combat: 0, spell: 0 }, monitor: { physical: 0, stun: 0 }, parent: { items }, ...extra });
    sys.prepareDerivedData();
    return sys;
  };

  test("installed cyberware adds attributes, Reaction and initiative dice", () => {
    const sys = withCyber([cyber({ reaction: 2, initiativeDice: 1, attributes: { strength: 2, body: 1, quickness: 0, charisma: 0, intelligence: 0, willpower: 0 } })]);
    assert.equal(sys.attributes.strength.total, 6);   // 4 + 2
    assert.equal(sys.attributes.body.total, 6);       // 5 + 1
    assert.equal(sys.derived.reaction, 7);            // (6+4)/2 = 5, +2
    assert.equal(sys.derived.initiativeDice, 2);      // 1 base + 1
  });

  test("essence is reduced by cost and grade", () => {
    const sys = withCyber([cyber({ essenceCost: 2, grade: "alpha" }), cyber({ essenceCost: 1 })]);
    assert.equal(sys.derived.essence, 3.4);           // 6 - 1.6 - 1
    assert.equal(sys.derived.essenceLoss, 2.6);
  });

  test("uninstalled cyberware does nothing", () => {
    const sys = withCyber([cyber({ installed: false, reaction: 5, essenceCost: 3 })]);
    assert.equal(sys.derived.reaction, 5);
    assert.equal(sys.derived.essence, 6);
  });

  test("v0.54.0: ware still healing in costs its Essence at once but does nothing yet", () => {
    const recovering = [{ itemId: "c1", name: "Datajack", until: 1000, care: "", factor: 1 }];
    const items = [{ id: "c1", name: "Datajack", ...cyber({ essenceCost: 0.2, kind: "datajack" }) }];
    const sys = Object.create(CharacterDataModel.prototype);
    sys.attributes = Object.fromEntries(Object.entries(A).map(([k, v]) => [k, { base: v, mod: 0 }]));
    Object.assign(sys, { essence: 6, magic: 0, reactionBonus: 0, initiativeDiceBonus: 0, recovering,
      poolSpent: { combat: 0, spell: 0 }, monitor: { physical: 0, stun: 0 }, parent: { items, system: { recovering } } });
    sys.prepareDerivedData();
    assert.equal(sys.derived.essence, 5.8);
    assert.equal(sys.derived.cyber.datajack, false);
    const had = g.game.time;
    g.game.time = { worldTime: 2000 };
    try { sys.prepareDerivedData(); assert.equal(sys.derived.cyber.datajack, true); assert.equal(sys.derived.essence, 5.8); } finally { g.game.time = had; }
  });

  test("v0.54.0: physical adepts have no Spell Pool (house rule gives one)", () => {
    const sys = withCyber([], { magic: 6, tradition: "adept" });
    assert.equal(sys.derived.spellPool, 0);
    (RULES.ADEPT as any).spellPool = true;
    try { sys.prepareDerivedData(); assert.equal(sys.derived.spellPool, Math.floor((4 + 4 + 6) / 3)); } finally { (RULES.ADEPT as any).spellPool = false; }
    const mageSys = withCyber([], { magic: 6, tradition: "hermetic" });
    assert.equal(mageSys.derived.spellPool, Math.floor((4 + 4 + 6) / 3));
  });

  test("magic is capped by essence and feeds the spell pool", () => {
    const sys = withCyber([cyber({ essenceCost: 2.5 })], { magic: 6 }); // essence 3.5 -> magic cap 4
    assert.equal(sys.derived.magic, 4);
    assert.equal(sys.derived.spellPool, Math.floor((4 + 4 + 4) / 3)); // int 4, wil 4, magic 4
  });

  test("zero essence is death regardless of the monitor", () => {
    const sys = withCyber([cyber({ essenceCost: 9 })]);
    assert.equal(sys.derived.essence, 0);
    assert.equal(sys.derived.status, "dead");
  });

  test("no embedded items is fine", () => {
    const sys = withCyber([]);
    assert.equal(sys.derived.essence, 6);
    assert.equal(sys.derived.status, "ok");
  });
});

describe("applyStatBlock", () => {
  let parseStatBlock: any;
  before(async () => { ({ parseStatBlock } = await import("../rules/statblock.ts")); });

  const BLOCK = `B Q S C I W E M R Armor
4 5 4 2 3 3 5.2 - 5 (7) 5/3
Initiative: 7 + 2D6
Karma Pool/Professional Rating: 1/3
Skills: Firearms 5, Unarmed Combat 4
Gear: Heavy pistol [9M], Stun baton [6S Stun]`;

  const fresh = (items: any[] = []) => {
    const a = makeActor({ body: 3, quickness: 3, strength: 3, charisma: 3, intelligence: 3, willpower: 3 });
    a.items = items;
    a.system.parent = a;
    a.system.reactionBonus = 0; a.system.initiativeDiceBonus = 0; a.system.karma = { pool: 0 }; a.system.professionalRating = 0;
    a.system.prepareDerivedData();
    return a;
  };

  test("sets attributes, ratings and matches shown Reaction and initiative", async () => {
    const a = fresh();
    const r = await a.applyStatBlock(parseStatBlock(BLOCK));
    assert.equal(a.system.attributes.quickness.base, 5);
    assert.equal(a.system.essence, 5.2);
    assert.equal(a.system.magic, 0);
    assert.equal(a.system.derived.reaction, 7);        // shown augmented value
    assert.equal(a.system.reactionBonus, 3);           // natural (5+3)/2 = 4
    assert.equal(a.system.derived.initiativeDice, 2);
    assert.equal(a.system.karma.pool, 1);
    assert.equal(a.system.professionalRating, 3);
    assert.deepEqual(r, { created: 5, updated: 0, warnings: [] });   // 2 skills, 2 weapons, 1 armor
    assert.equal(a.armorRating("ballistic"), 5);
    const baton = a.items.find((i: any) => i.name === "Stun baton");
    assert.equal(baton.system.melee, true);
    assert.equal(baton.system.skill, "Unarmed Combat");
  });

  test("allows for cyberware already on the actor", async () => {
    const a = fresh([{ id: "c1", type: "cyberware", name: "Reflexes", system: {
      essenceCost: 1, grade: "standard", installed: true, reaction: 2, initiativeDice: 1,
      attributes: { body: 0, quickness: 0, strength: 0, charisma: 0, intelligence: 0, willpower: 0 } } }]);
    await a.applyStatBlock(parseStatBlock(BLOCK));
    assert.equal(a.system.derived.reaction, 7);
    assert.equal(a.system.reactionBonus, 1);           // 4 natural + 2 cyber + 1
    assert.equal(a.system.initiativeDiceBonus, 0);     // 1 base + 1 cyber = 2 already
    assert.equal(a.system.derived.essence, 5.2);       // base stored as 6.2, minus 1
  });

  test("re-importing updates instead of duplicating", async () => {
    const a = fresh();
    await a.applyStatBlock(parseStatBlock(BLOCK));
    const r = await a.applyStatBlock(parseStatBlock(BLOCK.replace("Firearms 5", "Firearms 6")));
    assert.deepEqual(r, { created: 0, updated: 5, warnings: [] });
    assert.equal(a.items.filter((i: any) => i.type === "skill").length, 2);
    assert.equal(a.items.find((i: any) => i.name === "Firearms").system.rating, 6);
  });
});

describe("spellcasting", () => {
  // v0.79.0: these fixtures count dice for the old Spell Pool, (Int + Wil + Magic) / 3 (RULES.DOCS_V79.magicPool.size).
  let undoPool79 = () => {}; before(() => { undoPool79 = oldWay({ "DOCS_V79.magicPool.size": "attributes" }); }); after(() => undoPool79());
  const mage = (extra: any = {}) => {
    const a = makeActor({ body: 3, quickness: 4, strength: 2, charisma: 3, intelligence: 5, willpower: 5 }, { magic: 6, ...extra });
    a.items = [{ type: "skill", name: "Sorcery", system: { rating: 5, attribute: "willpower" } }];
    a.name = "Mage";
    return a;
  };
  const target = () => {
    const t = makeActor({ body: 4, quickness: 4, strength: 4, charisma: 2, intelligence: 3, willpower: 3 });
    uuidRegistry.set(t.uuid, Object.assign(t, { name: "Goon" }));
    return t;
  };
  const bolt = (over: any = {}) => ({ name: "Manabolt", system: {
    category: "combat", spellType: "mana", learnedForce: 6, damageLevel: "M", damageType: "physical",
    targetNumber: 4, drainModifier: 0, drainLevel: "M", ...over } });

  test("no Sorcery skill: refuses with a warning and rolls nothing", async () => {
    chat.length = 0; warnings.length = 0;
    const a = makeActor(A, { magic: 6 });
    const r = await a.castSpell(bolt(), { force: 4 });
    assert.equal(r, null);
    assert.equal(chat.length, 0);
    assert.match(warnings[0] ?? "", /no Sorcery/);
  });

  test("combat spell: TN is the target's Willpower, state + button carried, drain follows", async () => {
    chat.length = 0;
    const m = mage(); const t = target();   // spell pool (5+5+6)/3 = 5
    faces.push(4, 4, 2, 1, 6, 2); faces.push(1);   // 5 Sorcery + 1 pool die; the 6 explodes into a 1 (=7)
    faces.push(5, 5, 1, 1, 1);                     // drain: Willpower 5 dice vs TN 3 (F6/2+0) -> 2 successes
    const r = await m.castSpell(bolt(), { force: 6, targetUuid: t.uuid, poolDice: 1 });
    assert.equal(r.targetNumber, 3);               // Goon's Willpower
    assert.equal(r.successes, 3);                  // 4, 4, 7
    assert.equal(chat.length, 2);
    const card = chat[0];
    assert.match(card.content, /data-sr2e-action="resistSpell"/);
    assert.deepEqual({ ...card.flags.sr2e.spell }, { casterUuid: m.uuid, targetUuid: t.uuid, spellName: "Manabolt", force: 6,
      resistAttribute: "willpower", level: "M", damageType: "physical", casterSuccesses: 3 });
    assert.equal(m.system.poolSpent.spell, 1);
    // drain M staged down 1 by 2 successes -> L stun
    assert.match(chat[1].content, /Takes <strong>L<\/strong> stun drain/);
    assert.equal(m.system.monitor.stun, 1);
  });

  test("force above Magic gives physical drain; force is clamped to the learned force", async () => {
    chat.length = 0;
    const m = mage({ magic: 3 });
    faces.push(1, 1, 2, 2, 2);                     // cast fails (no target, TN 4)
    faces.push(1, 1, 1, 1, 1);                     // drain botch: Willpower 5 vs TN 3
    await m.castSpell(bolt({ learnedForce: 5 }), { force: 9 });
    assert.match(chat[0].content, /Force 5/);
    assert.match(chat[1].content, /physical/);
    assert.equal(m.system.monitor.physical, 3);    // M drain unresisted
  });

  test("non-combat spell uses its own TN and has no resist button", async () => {
    chat.length = 0;
    const m = mage(); const t = target();
    faces.push(6, 5, 5, 1, 1); faces.push(2); faces.push(5, 5, 5, 5, 5);
    const r = await m.castSpell(bolt({ category: "detection", targetNumber: 6 }), { force: 2, targetUuid: t.uuid });
    assert.equal(r.targetNumber, 6);
    assert.doesNotMatch(chat[0].content, /resistSpell/);
    assert.equal(chat[0].flags.sr2e.spell, undefined);
  });

  test("resisting: net caster successes stage the damage, applied with no armor", async () => {
    chat.length = 0;
    const t = target();
    faces.push(1, 1, 2);                            // Willpower 3 vs Force 6: no successes
    await t.resistSpell({ casterUuid: "x", targetUuid: t.uuid, spellName: "Manabolt", force: 6,
      resistAttribute: "willpower", level: "M", damageType: "physical", casterSuccesses: 3 }, 0);
    assert.equal(t.system.monitor.physical, 6);     // 3 net: M -> S
    assert.match(chat.at(-1).content, /takes effect/);
  });

  test("resisting fully cancels the spell", async () => {
    chat.length = 0;
    const t = target();
    faces.push(6, 6, 6); faces.push(1, 1, 1);
    await t.resistSpell({ casterUuid: "x", targetUuid: t.uuid, spellName: "Stunbolt", force: 6,
      resistAttribute: "willpower", level: "S", damageType: "stun", casterSuccesses: 2 }, 0);
    assert.deepEqual({ ...t.system.monitor }, { physical: 0, stun: 0 });
    assert.match(chat.at(-1).content, /Resisted/);
  });
});

describe("firing modes, recoil, ammo and situational modifiers", () => {
  const gun = (over: any = {}) => {
    const w: any = { name: "AK-97", system: { melee: false, skill: "Firearms", damagePower: 8, damageLevel: "M", damageType: "physical",
      modes: "SA/BF/FA", recoilComp: 0, ammo: 30, ammoMax: 30, ...over } };
    w.update = async (d: any) => { for (const [k, v] of Object.entries(d)) setPath(w, k, v); };
    return w;
  };
  const shooter = () => {
    const a = makeActor(A);
    a.items = [{ type: "skill", name: "Firearms", system: { rating: 6, attribute: "quickness" } }];
    return a;
  };

  test("burst: +2 recoil, +3 Power, +1 level, 3 rounds spent", async (t) => {
    t.after(oldWay({ 'DOCS_V79.rangedRecoil': 'freeFirst' })); // v0.79.0: the old recoil count (a house rule)
    chat.length = 0;
    const a = shooter(); const w = gun();
    faces.push(6, 6, 1, 1, 1, 1); faces.push(1, 1);       // two 6s (each explodes into a 1) hit TN 6
    const r = await a.attackWith(w, { targetUuid: "Actor.t", range: "short", mode: "BF" });
    assert.equal(r.successes, 2);
    assert.equal(r.targetNumber, 6);                         // 4 short + 2 recoil
    assert.deepEqual(r.modifiers.map((m: any) => m.label), ["Recoil"]);
    assert.equal(chat.at(-1).flags.sr2e.attack.power, 11);
    assert.equal(chat.at(-1).flags.sr2e.attack.level, "S");
    assert.equal(w.system.ammo, 27);
    assert.match(chat.at(-1).content, /\[BF\]/);
  });

  test("recoil compensation and earlier shots this phase", async () => {
    chat.length = 0;
    const a = shooter(); const w = gun({ recoilComp: 1 });
    faces.push(1, 1, 1, 1, 1, 2);
    const r = await a.attackWith(w, { range: "short", mode: "BF", earlierRoundsThisPhase: 3 });
    assert.equal(r.targetNumber, 4 + (6 - 1 - 1));           // 6 rounds in phase, 1 free, RC 1 -> +4
  });

  test("full auto is clamped and spends that many rounds", async () => {
    chat.length = 0;
    const a = shooter(); const w = gun();
    faces.push(1, 1, 1, 1, 1, 2);
    await a.attackWith(w, { range: "short", mode: "FA", fullAutoRounds: 99 });
    assert.equal(w.system.ammo, 20);
    assert.match(chat.at(-1).content, /FA ×10/);
  });

  test("a mode the weapon lacks falls back to its first mode", async () => {
    chat.length = 0;
    const a = shooter(); const w = gun({ modes: "SA" });
    faces.push(1, 1, 1, 1, 1, 2);
    await a.attackWith(w, { range: "short", mode: "FA" });
    assert.equal(w.system.ammo, 29);
    assert.match(chat.at(-1).content, /\[SA\]/);
  });

  test("not enough ammo blocks the attack with a warning and rolls nothing", async () => {
    chat.length = 0; warnings.length = 0;
    const a = shooter(); const w = gun({ ammo: 2 });
    const r = await a.attackWith(w, { range: "short", mode: "BF" });
    assert.equal(r, null);
    assert.equal(chat.length, 0);
    assert.match(warnings[0] ?? "", /2 rounds left, 3 needed/);
    assert.equal(w.system.ammo, 2);
  });

  test("untracked ammo (capacity 0) never blocks or changes", async () => {
    chat.length = 0;
    const a = shooter(); const w = gun({ ammo: 0, ammoMax: 0 });
    faces.push(1, 1, 1, 1, 1, 2);
    const r = await a.attackWith(w, { range: "short", mode: "BF" });
    assert.ok(r);
    assert.equal(w.system.ammo, 0);
  });

  test("situational modifiers and visibility add to the TN", async () => {
    chat.length = 0;
    const a = shooter(); const w = gun();
    faces.push(1, 1, 1, 1, 1, 2);
    const r = await a.attackWith(w, { range: "short", mode: "SA", situational: ["calledShot", "smartlink"], visibility: "minimal" });
    assert.equal(r.targetNumber, 4 + 4 - 2 + 6); // v0.79.0 docs check: minimal light +6 (was +4)
  });

  test("melee ignores modes and ammo but takes situational modifiers", async () => {
    chat.length = 0;
    const a = shooter();
    const knife: any = { name: "Knife", system: { melee: true, skill: "", damagePower: 3, damageLevel: "L", damageType: "physical", modes: "FA", ammo: 0, ammoMax: 5, recoilComp: 0 } };
    faces.push(1, 1, 1, 1, 1, 2);
    const r = await a.attackWith(knife, { mode: "FA", situational: ["calledShot"] });
    assert.equal(r.targetNumber, 4 + 4 + 4);                 // melee 4 + called shot + unskilled default
    assert.doesNotMatch(chat.at(-1).content, /\[FA/);
  });
});

describe("recoil carries over within a combat phase", () => {
  const gun = () => {
    const w: any = { name: "AK-97", system: { melee: false, skill: "Firearms", damagePower: 8, damageLevel: "M", damageType: "physical",
      modes: "SA/BF", recoilComp: 0, ammo: 30, ammoMax: 30 } };
    w.update = async (d: any) => { for (const [k, v] of Object.entries(d)) setPath(w, k, v); };
    return w;
  };
  const shooter = () => {
    const a = makeActor(A);
    a.items = [{ type: "skill", name: "Firearms", system: { rating: 2, attribute: "quickness" } }];
    return a;
  };
  const combat = (over: any = {}) => ({ id: "c1", started: true, round: 1, pass: 0, combatant: { id: "cb1" }, ...over });

  test("second attack in the same phase gets recoil from the first; a new phase resets it", async (t) => {
    t.after(oldWay({ 'DOCS_V79.rangedRecoil': 'freeFirst' })); // v0.79.0: the old recoil count (a house rule)
    const a = shooter(); const w = gun();
    g.game.combat = combat();
    faces.push(1, 2); const r1 = await a.attackWith(w, { range: "short", mode: "BF" });
    assert.equal(r1.targetNumber, 6);                       // 3 rounds: +2
    assert.equal(a.trackedRecoilRounds(), 3);
    faces.push(1, 2); const r2 = await a.attackWith(w, { range: "short", mode: "SA" });
    assert.equal(r2.targetNumber, 7);                       // 3 earlier + 1 = 4 rounds: +3
    assert.equal(a.trackedRecoilRounds(), 4);

    g.game.combat = combat({ combatant: { id: "cb2" } });   // turn moved on
    assert.equal(a.trackedRecoilRounds(), 0);
    faces.push(1, 2); const r3 = await a.attackWith(w, { range: "short", mode: "SA" });
    assert.equal(r3.targetNumber, 4);

    g.game.combat = combat({ combatant: { id: "cb2" }, pass: 1 }); // next initiative pass
    assert.equal(a.trackedRecoilRounds(), 0);
  });

  test("an explicit earlier-rounds value overrides the tracked one and is what gets recorded", async () => {
    const a = shooter(); const w = gun();
    g.game.combat = combat();
    faces.push(1, 2); await a.attackWith(w, { range: "short", mode: "BF" });          // tracked 3
    faces.push(1, 2); const r = await a.attackWith(w, { range: "short", mode: "SA", earlierRoundsThisPhase: 0 });
    assert.equal(r.targetNumber, 4);
    assert.equal(a.trackedRecoilRounds(), 1);
  });

  test("outside a started combat nothing is tracked", async (t) => {
    t.after(oldWay({ 'DOCS_V79.rangedRecoil': 'freeFirst' })); // v0.79.0: the old recoil count (a house rule)
    const a = shooter(); const w = gun();
    g.game.combat = combat({ started: false });
    faces.push(1, 2); await a.attackWith(w, { range: "short", mode: "BF" });
    faces.push(1, 2); const r = await a.attackWith(w, { range: "short", mode: "BF" });
    assert.equal(r.targetNumber, 6);
    assert.equal(a.flags.sr2e, undefined);
    g.game.combat = undefined;
  });
});

describe("Karma Pool", () => {
  // v0.79.0: these fixtures count dice for the old Spell Pool, (Int + Wil + Magic) / 3 (RULES.DOCS_V79.magicPool.size).
  let undoPool79 = () => {}; before(() => { undoPool79 = oldWay({ "DOCS_V79.magicPool.size": "attributes" }); }); after(() => undoPool79());
  const withKarma = (pool: number, attrs: any = A) => {
    const a = makeActor(attrs, { karma: { pool, poolSpent: 0, good: 0 } });
    a.name = "Runner";
    a.items = [{ type: "skill", name: "Pistols", system: { rating: 3, attribute: "quickness" } }];
    return a;
  };
  const pistol = { name: "Predator", system: { melee: false, skill: "Pistols", damagePower: 9, damageLevel: "M", damageType: "physical", modes: "", ammoMax: 0, ammo: 0, recoilComp: 0 } };

  test("cards show karma buttons only when the actor has a Karma Pool", async () => {
    chat.length = 0;
    const none = withKarma(0); faces.push(1, 2, 5);
    await none.attackWith(pistol, { range: "short" });
    assert.doesNotMatch(chat.at(-1).content, /karmaReroll/);
    const some = withKarma(3); faces.push(1, 2, 5);
    await some.attackWith(pistol, { range: "short" });
    assert.match(chat.at(-1).content, /Re-roll 2 failures \(Karma 1\)/);
    assert.equal(chat.at(-1).flags.sr2e.test.kind, "attack");
  });

  test("re-rolling a missed attack can turn it into a hit, with a Defend button and updated state", async () => {
    chat.length = 0;
    const a = withKarma(3);
    faces.push(1, 2, 3);                                      // TN 4: miss
    await a.attackWith(pistol, { targetUuid: "Actor.t", range: "short" });
    assert.match(chat.at(-1).content, /missed/);
    const snap = chat.at(-1).flags.sr2e.test;
    faces.push(5, 4, 1);                                      // re-roll all 3 failures
    await a.karmaReroll(snap);
    const card = chat.at(-1);
    assert.match(card.content, /Karma re-roll #1 \(cost 1\)/);
    assert.match(card.content, /data-sr2e-action="defend"/);
    assert.equal(card.flags.sr2e.attack.attackSuccesses, 2);
    assert.equal(card.flags.sr2e.attack.targetNumber, 4);
    assert.equal(a.system.karma.poolSpent, 1);
    assert.match(card.content, /Re-roll 1 failure \(Karma 2\)/);  // next costs 2
  });

  test("not enough Karma left blocks the re-roll and rolls nothing", async () => {
    chat.length = 0; warnings.length = 0;
    const a = withKarma(1);
    faces.push(1, 2, 3);
    await a.attackWith(pistol, { range: "short" });
    const snap = { ...chat.at(-1).flags.sr2e.test, rerolls: 1 };   // next would cost 2
    const n = chat.length;
    await a.karmaReroll(snap);
    assert.equal(chat.length, n);
    assert.match(warnings.at(-1) ?? "", /1 Karma Pool left; this needs 2/);
    assert.equal(a.system.karma.poolSpent, 0);
  });

  test("re-rolling a dodge re-resolves the hit", async () => {
    chat.length = 0;
    const d = withKarma(2);
    const attack = { attackerUuid: "x", targetUuid: d.uuid, weaponName: "Predator", melee: false,
      damageType: "physical", power: 9, level: "M", attackSuccesses: 2, targetNumber: 4 };
    faces.push(1, 2, 3);                                      // 3 pool dice, no successes: hit
    await d.defend(attack, 3);
    assert.match(chat.at(-1).content, /Hit!/);
    faces.push(5, 5, 1);                                      // re-roll: 2 successes, ties = miss
    await d.karmaReroll(chat.at(-1).flags.sr2e.test);
    assert.match(chat.at(-1).content, /Missed\.<\/strong> 2 attack vs 2 defense/);
    assert.equal(chat.at(-1).flags.sr2e.damage, undefined);
  });

  test("re-rolling a soak corrects the condition monitor", async () => {
    chat.length = 0;
    const a = withKarma(2);                                   // Body 5
    faces.push(1, 2, 2, 3, 3);                                // vs TN 4: no successes, 9M -> 3 boxes
    await a.resistDamage({ power: 9, level: "M", armor: 5 });
    assert.equal(a.system.monitor.physical, 3);
    faces.push(4, 4, 4, 1, 1);                                // 3 successes: M -> L
    await a.karmaReroll(chat.at(-1).flags.sr2e.test);
    assert.equal(a.system.monitor.physical, 1);
    assert.match(chat.at(-1).content, /Takes <strong>L<\/strong> physical damage/);
  });

  test("a soak re-roll leaves the monitor alone if it changed in between, and says so", async () => {
    chat.length = 0;
    const a = withKarma(2);
    faces.push(1, 2, 2, 3, 3);
    await a.resistDamage({ power: 9, level: "M", armor: 5 });
    const snap = chat.at(-1).flags.sr2e.test;
    await a.update({ "system.monitor.physical": 5 });         // someone else hurt them meanwhile
    faces.push(4, 4, 4, 4, 1);
    await a.karmaReroll(snap);
    assert.equal(a.system.monitor.physical, 5);
    assert.match(chat.at(-1).content, /changed since this was rolled/);
  });

  test("chained soak re-rolls keep correcting from the original", async () => {
    chat.length = 0;
    const a = withKarma(5);
    faces.push(1, 2, 2, 3, 3);
    await a.resistDamage({ power: 9, level: "S", armor: 5 });  // S = 6 boxes
    assert.equal(a.system.monitor.physical, 6);
    faces.push(4, 4, 1, 1, 1);                                 // 2 successes: S -> M
    await a.karmaReroll(chat.at(-1).flags.sr2e.test);
    assert.equal(a.system.monitor.physical, 3);
    faces.push(4, 4, 1);                                       // 3 failures re-rolled: 4 total -> L
    await a.karmaReroll(chat.at(-1).flags.sr2e.test);
    assert.equal(a.system.monitor.physical, 1);
    assert.equal(a.system.karma.poolSpent, 3);                 // 1 + 2
  });

  test("avoiding a disaster clears it and costs 1", async () => {
    chat.length = 0;
    const a = withKarma(2);
    faces.push(1, 1, 1, 1, 1);
    await a.rollAttribute("body", { targetNumber: 4 });
    assert.match(chat.at(-1).content, /Disaster/);
    assert.match(chat.at(-1).content, /avoidDisaster/);
    await a.avoidDisaster(chat.at(-1).flags.sr2e.test);
    assert.doesNotMatch(chat.at(-1).content, /Disaster: every die/);
    assert.match(chat.at(-1).content, /disaster avoided/);
    assert.equal(a.system.karma.poolSpent, 1);
    assert.equal(chat.at(-1).flags.sr2e.test.botch, false);
  });

  test("refresh restores the pool", async () => {
    const a = withKarma(3);
    await a.update({ "system.karma.poolSpent": 3 });
    assert.equal(a.system.derived.karmaPoolLeft, 0);
    await a.refreshKarmaPool();
    assert.equal(a.system.derived.karmaPoolLeft, 3);
  });
});

describe("specializations and skill-to-skill defaulting", () => {
  const actorWith = (items: any[]) => {
    const a = makeActor(A);
    a.items = items;
    (a.items as any).get = (id: string) => items.find((i) => i.id === id);
    return a;
  };
  const firearms = { id: "s1", type: "skill", name: "Firearms", system: { rating: 4, attribute: "quickness", specialization: "Pistols", specializationRating: 6 } };
  const gun = { name: "Predator", system: { melee: false, skill: "Firearms", damagePower: 9, damageLevel: "M", damageType: "physical", modes: "", ammoMax: 0, ammo: 0, recoilComp: 0, specialization: "Pistols" } };

  test("attack with the specialization rolls its rating and names it", async () => {
    chat.length = 0;
    const a = actorWith([firearms]);
    faces.push(1, 1, 1, 1, 2, 2);
    const r = await a.attackWith(gun, { range: "short", useSpecialization: true });
    assert.equal(r.totalDice, 6);
    assert.match(chat.at(-1).content, /\(Pistols 6\)/);
  });

  test("attack without the specialization rolls the skill", async () => {
    chat.length = 0;
    const a = actorWith([firearms]);
    faces.push(1, 1, 1, 2);
    const r = await a.attackWith(gun, { range: "short" });
    assert.equal(r.totalDice, 4);
  });

  test("unskilled attack defaults to a chosen related skill at +2", async () => {
    chat.length = 0;
    const gunnery = { id: "s2", type: "skill", name: "Gunnery", system: { rating: 5, attribute: "intelligence" } };
    const a = actorWith([gunnery]);
    faces.push(1, 1, 1, 1, 2);
    const r = await a.attackWith(gun, { range: "short", relatedSkillId: "s2" });
    assert.equal(r.totalDice, 5);
    assert.equal(r.targetNumber, 6);
    assert.match(chat.at(-1).content, /defaulting to Gunnery/);
  });

  test("skill roll with specialization", async () => {
    chat.length = 0;
    const a = actorWith([firearms]);
    faces.push(1, 1, 1, 1, 2, 2);
    const r = await a.rollSkill(firearms, { targetNumber: 4, useSpecialization: true });
    assert.equal(r.totalDice, 6);
  });

  test("an unrated skill item defaults to its attribute, or to a related skill", async () => {
    chat.length = 0;
    const biotech = { id: "s3", type: "skill", name: "Biotech", system: { rating: 0, attribute: "intelligence" } };
    const computers = { id: "s4", type: "skill", name: "Computers", system: { rating: 3, attribute: "intelligence" } };
    const a = actorWith([biotech, computers]);
    faces.push(1, 1, 1, 2);
    let r = await a.rollSkill(biotech, { targetNumber: 4 });
    assert.equal(r.totalDice, 4); assert.equal(r.targetNumber, 8);            // Intelligence 4, +4
    faces.push(1, 1, 2);
    r = await a.rollSkill(biotech, { targetNumber: 4, relatedSkillId: "s4" });
    assert.equal(r.totalDice, 3); assert.equal(r.targetNumber, 6);            // Computers 3, +2
  });

  test("stat-block import splits a specialization into name and rating", async () => {
    const { parseStatBlock } = await import("../rules/statblock.ts");
    const a = makeActor(A);
    a.items = []; a.system.parent = a;
    a.system.karma = { pool: 0, poolSpent: 0 }; a.system.professionalRating = 0;
    await a.applyStatBlock(parseStatBlock("B Q S C I W\n4 4 4 4 4 4\nSkills: Unarmed Combat 4 (Martial Arts 6)"));
    const skill = a.items.find((i: any) => i.name === "Unarmed Combat");
    assert.equal(skill.system.specialization, "Martial Arts");
    assert.equal(skill.system.specializationRating, 6);
  });
});

describe("conjuring: spirits, summoning, banishing", () => {
  // v0.79.0: these fixtures count dice for the old Spell Pool, (Int + Wil + Magic) / 3 (RULES.DOCS_V79.magicPool.size).
  let undoPool79 = () => {}; before(() => { undoPool79 = oldWay({ "DOCS_V79.magicPool.size": "attributes" }); }); after(() => undoPool79());
  const world: any[] = [];
  const created: any[] = [];
  let spiritN = 0;

  /** Build a spirit actor the way the data model would from creation data. */
  const spiritFrom = (data: any) => {
    const sys = Object.create(SpiritDataModel.prototype);
    sys.attributes = Object.fromEntries(Object.keys(A).map((k) => [k, { base: 0, mod: 0 }]));
    Object.assign(sys, {
      essence: 6, magic: 0, reactionBonus: 0, initiativeDiceBonus: 0, karma: { pool: 0, poolSpent: 0, good: 0 },
      poolSpent: { combat: 0, spell: 0 }, monitor: { physical: 0, stun: 0 },
      force: 4, spiritKind: "nature", spiritType: "", services: 0, summonerUuid: "", immuneNormalWeapons: true,
      offsets: Object.fromEntries(Object.keys(A).map((k) => [k, 0])),
      ...data.system,
    });
    const actor = new SR2Actor();
    actor.system = sys;
    actor.type = "spirit";
    actor.name = data.name ?? "Spirit";
    actor.ownership = data.ownership ?? { default: 0 };
    actor.uuid = `Actor.spirit${++spiritN}`;
    actor.items = (data.items ?? []).map((i: any, n: number) => ({ id: `s${n}`, ...i }));
    sys.prepareDerivedData();
    uuidRegistry.set(actor.uuid, actor);
    return actor;
  };

  const shaman = (attrs: any = {}, extra: any = {}) => {
    const a = makeActor({ ...A, charisma: 6, ...attrs }, { magic: 6, karma: { pool: 3, poolSpent: 0, good: 0 }, ...extra });
    a.items = [{ type: "skill", name: "Conjuring", system: { rating: 5, attribute: "charisma" } }];
    a.name = "Shaman";
    a.ownership = { default: 0, user1: 3 };
    uuidRegistry.set(a.uuid, a);
    return a;
  };

  before(() => {
    g.game.actors = world;
    g.game.user = { isGM: true, can: () => true };
    g.Actor.implementation = { create: async (d: any) => { created.push(d); const s = spiritFrom(d); world.push(s); return s; } };
  });
  const reset = () => { chat.length = 0; warnings.length = 0; created.length = 0; world.length = 0; g.game.user = { isGM: true, can: () => true }; };

  test("spirit attributes come from Force plus offsets; Force stands in for Essence and Magic", () => {
    const s = spiritFrom({ system: { force: 5, offsets: { body: 1, quickness: 0, strength: -2, charisma: 0, intelligence: 0, willpower: 0 } } });
    assert.equal(s.system.attributes.body.total, 6);
    assert.equal(s.system.attributes.strength.total, 3);
    assert.equal(s.system.derived.reaction, 5);          // (5 + 5) / 2
    // v0.61.0: the nature-spirit bonus is on the initiative only; unmaterialized, astral speed instead (not on top).
    assert.equal(s.system.derived.initiativeBonus, RULES.MAGIC_V61.spiritInitiative.byKind.nature!.reaction);
    const astral = spiritFrom({ system: { force: 5, materialized: false, offsets: { body: 0, quickness: 0, strength: 0, charisma: 0, intelligence: 0, willpower: 0 } } });
    assert.equal(astral.system.derived.reaction, 5);
    assert.equal(astral.system.derived.initiativeBonus, 20); // v0.77.0 book check: +10 manifest, +20 astral
    assert.equal(s.system.derived.essence, 5);
    assert.equal(s.system.derived.magic, 5);
    assert.equal(s.system.derived.status, "ok");
  });

  test("immunity to normal weapons adds 2 x Force armor; banished at Force 0", () => {
    const s = spiritFrom({ system: { force: 4 } });
    s.items = [{ type: "armor", system: { worn: true, ballistic: 1, impact: 0 } }];
    assert.equal(s.armorRating("ballistic"), 9);
    assert.equal(s.armorRating("impact"), 8);
    const plain = spiritFrom({ system: { force: 4, immuneNormalWeapons: false } });
    assert.equal(plain.armorRating("ballistic"), 0);
    assert.equal(spiritFrom({ system: { force: 0 } }).system.derived.status, "banished");
  });

  test("no Conjuring skill: refuses and rolls nothing", async () => {
    reset();
    const a = makeActor(A, { magic: 6 });
    assert.equal(await a.conjure({ force: 4 }), null);
    assert.equal(chat.length, 0);
    assert.match(warnings[0] ?? "", /no Conjuring/);
  });

  test("successful summoning creates a spirit owing one service per success, then drain", async () => {
    reset();
    const a = shaman();
    faces.push(4, 5, 1, 2, 3);           // Conjuring 5 vs TN 4: 2 successes
    faces.push(4, 4, 1, 1, 2, 2);        // drain: Charisma 6 vs TN 4, Force 4 <= Cha 6 -> M; 2 successes -> L
    const r = await a.conjure({ force: 4, spiritKind: "nature", spiritType: "Forest spirit" });
    assert.equal(r.targetNumber, 4);
    assert.equal(r.successes, 2);
    assert.equal(created.length, 1);
    const d = created[0];
    assert.equal(d.name, "Forest spirit (F4)");
    assert.equal(d.type, "spirit");
    assert.deepEqual(d.ownership, { default: 0, user1: 3 });
    assert.equal(d.prototypeToken.actorLink, true);
    assert.deepEqual({ force: d.system.force, services: d.system.services, summonerUuid: d.system.summonerUuid, spiritKind: d.system.spiritKind },
      { force: 4, services: 2, summonerUuid: a.uuid, spiritKind: "nature" });
    assert.equal(chat.length, 2);
    assert.match(chat[0].content, /answers, owing <strong>2<\/strong> services/);
    assert.match(chat[1].content, /Conjuring drain M \(TN 4\)/);
    assert.equal(a.system.monitor.stun, 1);
    assert.deepEqual(a.summonedSpirits().map((s: any) => s.name), ["Forest spirit (F4)"]);
  });

  test("Force over Magic makes drain physical; over 1.5 x Charisma it is Deadly", async () => {
    reset();
    const a = shaman({ charisma: 4 }, { magic: 5 });
    faces.push(1, 2, 3, 4, 5);           // Conjuring vs TN 7: no successes
    faces.push(1, 2, 3, 4);              // drain: Charisma 4 vs TN 7: nothing -> D physical (10 boxes)
    await a.conjure({ force: 7 });
    assert.equal(created.length, 0);
    assert.match(chat[0].content, /no spirit answers/);
    assert.match(chat[1].content, /Conjuring drain D \(TN 7\): Force over Magic, physical/);
    assert.equal(a.system.monitor.physical, 10);
  });

  test("a Karma re-roll of a failed summoning brings the spirit; another re-roll adjusts its services", async () => {
    reset();
    const a = shaman();
    faces.push(1, 2, 3, 2, 3);           // 0 successes vs TN 4
    faces.push(5, 5, 5, 5, 5, 5);        // drain: fully resisted
    await a.conjure({ force: 4, spiritType: "Hearth spirit" });
    const snap = chat[0].flags.sr2e.test;
    assert.equal(snap.kind, "conjure");
    faces.push(4, 1, 1, 1, 1);           // re-roll 5 failures: 1 success
    await a.karmaReroll(snap);
    assert.equal(created.length, 1);
    const spirit = world[0];
    assert.equal(spirit.system.services, 1);
    const snap2 = chat.at(-1).flags.sr2e.test;
    assert.equal(snap2.conjure.spiritUuid, spirit.uuid);
    faces.push(5, 5, 1, 1);              // re-roll the 4 remaining failures: 2 more -> 3 services
    await a.karmaReroll(snap2);
    assert.equal(created.length, 1);     // no second spirit
    assert.equal(spirit.system.services, 3);
    assert.match(chat.at(-1).content, /now owes <strong>3<\/strong> services/);
  });

  test("a player who cannot create actors gets a Create spirit button for the GM", async () => {
    reset();
    g.game.user = { isGM: false, can: () => false };
    const a = shaman();
    faces.push(4, 4, 4, 1, 1);
    faces.push(5, 5, 5, 5, 5, 5);
    await a.conjure({ force: 4 });
    assert.equal(created.length, 0);
    assert.match(chat[0].content, /data-sr2e-action="createSpirit"/);
    assert.equal(chat[0].flags.sr2e.pendingSpirit.system.services, 3);
  });

  test("a template spirit is copied: its offsets and items come along", async () => {
    reset();
    const template = spiritFrom({ name: "Fire elemental", system: { spiritKind: "elemental", spiritType: "Fire elemental",
      offsets: { body: 1, quickness: 2, strength: -1, charisma: 0, intelligence: 0, willpower: 0 } } });
    template.toObject = () => ({ _id: "x", name: template.name, type: "spirit", folder: "f", system: { ...template.system },
      items: [{ name: "Engulf", type: "weapon", system: {} }] });
    const a = shaman();
    faces.push(4, 1, 1, 1, 1);
    faces.push(5, 5, 5, 5, 5, 5);
    await a.conjure({ force: 3, spiritKind: "elemental", templateUuid: template.uuid });
    const d = created[0];
    assert.equal(d.name, "Fire elemental (F3)");
    assert.equal(d._id, undefined);
    assert.equal(d.folder, undefined);
    assert.equal(d.system.offsets.quickness, 2);
    assert.equal(d.system.force, 3);
    assert.equal(d.items[0].name, "Engulf");
    assert.equal(world[0].system.attributes.quickness.total, 5);
  });

  test("summoning more elementals than Charisma allows warns", async () => {
    reset();
    const a = shaman({ charisma: 1 });
    world.push(spiritFrom({ system: { spiritKind: "elemental", services: 2, summonerUuid: a.uuid } }));
    faces.push(1, 1, 2, 2, 2);
    faces.push(5);
    await a.conjure({ force: 2, spiritKind: "elemental" });
    assert.match(warnings[0] ?? "", /already has 1 bound elemental \(limit 1\)/);
  });

  test("banishing: the spirit resists with Force vs Magic; net successes lower its Force; drain follows", async () => {
    reset();
    const a = shaman();
    const s = spiritFrom({ name: "Wild spirit", system: { force: 5 } });
    faces.push(1, 2, 3, 4, 5);           // spirit: 5 dice vs TN 6 (Magic) -> 0
    faces.push(5, 5, 5, 1, 2);           // banisher: Conjuring 5 vs TN 5 -> 3
    faces.push(2, 2, 2, 2, 2, 3);        // drain: TN 5, Force 5 <= Cha 6 -> M; 0 successes -> 3 stun
    const r = await a.banish(s);
    assert.equal(r.successes, 3);
    assert.equal(s.system.force, 2);
    assert.equal(chat.length, 3);
    assert.match(chat[0].content, /Resist banishing \(Force 5 vs Shaman's Magic 6\)/);
    assert.match(chat[1].content, /Wild spirit weakens:<\/strong> Force 5 → 2/);
    assert.equal(a.system.monitor.stun, 3);
  });

  test("a Karma re-roll of a banishing corrects the spirit's Force, and can banish it", async () => {
    reset();
    const a = shaman();
    const s = spiritFrom({ name: "Wild spirit", system: { force: 5 } });
    faces.push(1, 1, 1, 1, 2);           // spirit: 5 dice vs TN 6 -> 0
    faces.push(5, 5, 1, 1, 1);           // banisher: 2 -> Force 3
    faces.push(5, 5, 5, 5, 5, 5);
    await a.banish(s);
    assert.equal(s.system.force, 3);
    faces.push(5, 6, 1, 1);              // re-roll 3 failures: 5, 6(+1=7), 1 -> 4 successes, Force 1
    await a.karmaReroll(chat[1].flags.sr2e.test);
    assert.equal(s.system.force, 1);
    assert.equal(s.system.derived.status, "ok");
    s.system.force = 3;                  // something else changed it
    faces.push(5);                       // re-roll the last failure: 5 successes -> would banish
    await a.karmaReroll(chat.at(-1).flags.sr2e.test);
    assert.equal(s.system.force, 3);
    assert.match(chat.at(-1).content, /is banished!.*Force changed since this was rolled/);
  });

  test("banishing refuses a non-spirit or one already banished", async () => {
    reset();
    const a = shaman();
    assert.equal(await a.banish(makeActor(A)), null);
    assert.equal(await a.banish(spiritFrom({ system: { force: 0 } })), null);
    assert.equal(chat.length, 0);
  });

  test("using a service counts down and posts; none left warns", async () => {
    reset();
    const s = spiritFrom({ name: "Hearth spirit", system: { services: 1 } });
    await s.useService();
    assert.equal(s.system.services, 0);
    assert.match(chat[0].content, /performs a service. That was its last/);
    await s.useService();
    assert.match(warnings[0] ?? "", /owes no services/);
    assert.equal(chat.length, 1);
    const gone = spiritFrom({ name: "Banished", system: { force: 0, services: 2 } });
    await gone.useService();
    assert.equal(gone.system.services, 2);
    assert.match(warnings[1] ?? "", /is banished/);
  });
});

describe("astral plane", () => {
  // v0.79.0: these fixtures count dice for the old Spell Pool, (Int + Wil + Magic) / 3 (RULES.DOCS_V79.magicPool.size).
  let undoPool79 = () => {}; before(() => { undoPool79 = oldWay({ "DOCS_V79.magicPool.size": "attributes" }); }); after(() => undoPool79());
  const M = { body: 3, quickness: 4, strength: 2, charisma: 5, intelligence: 5, willpower: 6 };
  const mage = (astral = "perceiving", sorcery = 4) => {
    const a = makeActor(M, { magic: 6, astral });
    a.name = "Mage";
    a.items = sorcery ? [{ type: "skill", name: "Sorcery", system: { rating: sorcery, attribute: "willpower" } }] : [];
    uuidRegistry.set(a.uuid, a);
    return a;
  };
  const spirit = (force = 4) => {
    const sys = Object.create(SpiritDataModel.prototype);
    sys.attributes = Object.fromEntries(Object.keys(A).map((k) => [k, { base: 0, mod: 0 }]));
    Object.assign(sys, {
      essence: 6, magic: 0, reactionBonus: 0, initiativeDiceBonus: 0, karma: { pool: 0, poolSpent: 0, good: 0 },
      poolSpent: { combat: 0, spell: 0 }, monitor: { physical: 0, stun: 0 }, astral: "physical",
      force, spiritKind: "nature", spiritType: "", services: 1, summonerUuid: "", immuneNormalWeapons: true,
      offsets: Object.fromEntries(Object.keys(A).map((k) => [k, 0])),
    });
    sys.prepareDerivedData();
    const s = new SR2Actor();
    Object.assign(s, { system: sys, type: "spirit", name: "Spirit", uuid: `Actor.astralspirit${force}${Math.random()}` });
    uuidRegistry.set(s.uuid, s);
    return s;
  };

  test("astral form uses mental attributes; mundanes are always physical", () => {
    const m = mage();
    assert.equal(m.system.derived.astralMode, "perceiving");
    assert.deepEqual({ ...m.system.derived.astral }, { body: 6, quickness: 5, strength: 5, reaction: 5, initiativeBase: 25, initiativeDice: 1 });
    const mundane = makeActor(A, { astral: "projecting" });
    assert.equal(mundane.system.derived.astralMode, "physical");
    assert.equal(mundane.isAstral(), false);
    assert.equal(spirit().isAstral(), true);
  });

  test("a projecting magician rolls astral initiative", () => {
    const c = new SR2Combatant();
    c.actor = mage("projecting");
    assert.equal(c.getInitiativeRoll().formula, "1d6 + 25");
    c.actor = mage("perceiving");
    assert.equal(c.getInitiativeRoll().formula, "1d6 + 4");   // (4 + 5) / 2
  });

  test("perceiving makes physical weapon attacks harder", async () => {
    chat.length = 0;
    const m = mage();
    faces.push(1, 1, 2, 2);                                   // Quickness 4 defaulting
    const r = await m.attackWith({ name: "Pistol", system: { melee: false, skill: "Pistols", damagePower: 6, damageLevel: "M", damageType: "physical", modes: "", ammoMax: 0 } }, { range: "short" });
    assert.ok(r.modifiers.some((x: any) => x.label === "Astral perception" && x.value === 2));
  });

  test("astral attacks need both sides on the astral plane", async () => {
    chat.length = 0; warnings.length = 0;
    assert.equal(await mage("physical").astralAttack({}), null);
    assert.match(warnings.at(-1) ?? "", /not on the astral plane/);
    const mundane = makeActor(A); mundane.name = "Mundane"; uuidRegistry.set(mundane.uuid, mundane);
    assert.equal(await mage().astralAttack({ targetUuid: mundane.uuid }), null);
    assert.match(warnings.at(-1) ?? "", /Mundane is not on the astral plane/);
    assert.equal(chat.length, 0);
  });

  test("magician attacks a spirit: Sorcery + Spell Pool at TN 4 for Charisma M; the spirit dodges and soaks without armor", async () => {
    chat.length = 0;
    const m = mage(); const s = spirit(4);
    faces.push(5, 5, 5, 1, 2);                                // Sorcery 4 + 1 Spell Pool die: 3 successes
    const r = await m.astralAttack({ targetUuid: s.uuid, poolDice: 1 });
    assert.equal(r.targetNumber, 4);
    assert.equal(m.system.poolSpent.spell, 1);
    const attack = chat.at(-1).flags.sr2e.attack;
    assert.deepEqual({ astral: attack.astral, power: attack.power, level: attack.level, melee: attack.melee }, { astral: true, power: 5, level: "M", melee: true });
    // Spirit: astral Quickness = its own (Force 4) plus Combat Pool dice
    faces.push(5, 1, 1, 1, 1);                                // 4 + 1 pool die: 1 success -> net 2
    await s.defend(attack, 1);
    assert.equal(s.system.poolSpent.combat, 1);
    const damage = chat.at(-1).flags.sr2e.damage;
    assert.equal(damage.astral, true);
    // Soak: Body 4 vs TN 5 (Power 5, immunity armor ignored astrally)
    faces.push(5, 5, 1, 1);                                   // 2 successes: M -> L
    await s.resistFromState(damage, 0);
    assert.match(chat.at(-1).content, /Resist astral 5M physical/);
    assert.match(chat.at(-1).content, /TN <strong>5<\/strong>/);
    assert.equal(s.system.monitor.physical, 1);
  });

  test("magician defends with astral Quickness (Intelligence) and soaks with Willpower using the Spell Pool", async () => {
    chat.length = 0;
    const m = mage("projecting");
    const attack = { attackerUuid: "x", targetUuid: m.uuid, weaponName: "Astral attack", melee: true, damageType: "stun", power: 4, level: "M", attackSuccesses: 3, targetNumber: 4, astral: true };
    faces.push(1, 1, 1, 1, 2, 2);                             // Intelligence 5 + 1 Spell Pool die: 0
    await m.defend(attack, 1);
    assert.equal(m.system.poolSpent.spell, 1);
    assert.equal(m.system.poolSpent.combat, 0);
    assert.match(chat.at(-1).content, /Astral defense/);
    faces.push(1, 1, 1, 1, 1, 2);                             // Willpower 6 vs TN 4: none
    await m.resistFromState(chat.at(-1).flags.sr2e.damage, 0);
    assert.match(chat.at(-1).content, /6 dice vs TN/);
    assert.ok(m.system.monitor.stun > 0);
  });

  test("without Sorcery a magician defaults to Willpower at +4; a spirit attacks with Force for Force damage", async () => {
    chat.length = 0;
    const m = mage("perceiving", 0); const s = spirit(5);
    faces.push(1, 1, 1, 1, 1, 2);                             // Willpower 6
    const r = await m.astralAttack({ targetUuid: s.uuid });
    assert.equal(r.targetNumber, 8);
    faces.push(5, 5, 1, 1, 1);                                // Force 5
    await s.astralAttack({ targetUuid: m.uuid, damageType: "stun" });
    const attack = chat.at(-1).flags.sr2e.attack;
    assert.equal(attack.power, 5);
    assert.equal(attack.damageType, "stun");
  });
});

describe("critter and spirit powers", () => {
  // v0.79.0: these fixtures count dice for the old Spell Pool, (Int + Wil + Magic) / 3 (RULES.DOCS_V79.magicPool.size).
  let undoPool79 = () => {}; before(() => { undoPool79 = oldWay({ "DOCS_V79.magicPool.size": "attributes" }); }); after(() => undoPool79());
  const spiritUser = (force = 5) => {
    const sys = Object.create(SpiritDataModel.prototype);
    sys.attributes = Object.fromEntries(Object.keys(A).map((k) => [k, { base: 0, mod: 0 }]));
    Object.assign(sys, {
      essence: 6, magic: 0, reactionBonus: 0, initiativeDiceBonus: 0, karma: { pool: 2, poolSpent: 0, good: 0 },
      poolSpent: { combat: 0, spell: 0 }, monitor: { physical: 0, stun: 0 }, astral: "physical",
      force, spiritKind: "nature", spiritType: "", services: 1, summonerUuid: "", immuneNormalWeapons: true,
      offsets: Object.fromEntries(Object.keys(A).map((k) => [k, 0])),
    });
    sys.prepareDerivedData();
    const s = new SR2Actor();
    Object.assign(s, { system: sys, type: "spirit", name: "Storm spirit", uuid: `Actor.powerspirit${Math.random()}` });
    uuidRegistry.set(s.uuid, s);
    return s;
  };
  const victim = () => {
    const v = makeActor({ ...A, willpower: 3 }); v.name = "Victim"; uuidRegistry.set(v.uuid, v); return v;
  };
  const power = ({ name = "Engulf", ...over }: any = {}) => ({ name, system: {
    active: true, dice: "force", rating: 0, tnSource: "willpower", targetNumber: 4, resist: "body",
    effect: "damage", damageLevel: "M", damageType: "physical", ...over } });

  test("a damage power rolls Force vs the target's attribute and carries a Resist power button", async () => {
    chat.length = 0;
    const s = spiritUser(5); const v = victim();
    faces.push(4, 4, 4, 1, 1);                                // 5 dice vs Willpower 3: 3 successes
    const r = await s.usePower(power(), { targetUuid: v.uuid });
    assert.equal(r.targetNumber, 3);
    const card = chat.at(-1);
    assert.match(card.content, /Engulf \(5 dice; TN = Victim's Willpower\)/);
    assert.match(card.content, /data-sr2e-action="resistSpell" data-index="0">Resist power \(/);
    const st = card.flags.sr2e.spell;
    assert.deepEqual({ force: st.force, attr: st.resistAttribute, noun: st.noun, pool: st.resistPool, eff: st.effectOnly },
      { force: 5, attr: "body", noun: "power", pool: "none", eff: undefined });
    // Victim resists with Body 5 vs TN 5; pool dice are ignored when the power allows none
    faces.push(5, 1, 1, 1, 1);                                // 1 success -> net 2 -> M stays M
    await v.resistSpell(st, 4);
    assert.equal(v.system.poolSpent.combat, 0);
    assert.match(chat.at(-1).content, /Resist Engulf \(Body vs rating 5\)/);
    assert.match(chat.at(-1).content, /Takes <strong>M<\/strong> physical damage/);
    assert.equal(v.system.monitor.physical, 3);
  });

  test("an effect-only power reports net successes and leaves the monitor alone", async () => {
    chat.length = 0;
    const s = spiritUser(4); const v = victim();
    faces.push(5, 5, 5, 2);                                   // 3 successes vs Willpower 3
    await s.usePower(power({ name: "Fear", resist: "willpower", effect: "effect" }), { targetUuid: v.uuid });
    const st = chat.at(-1).flags.sr2e.spell;
    assert.equal(st.effectOnly, true);
    faces.push(4, 1, 1);                                      // Willpower 3 vs TN 4: 1 success
    await v.resistSpell(st, 0);
    assert.match(chat.at(-1).content, /Fear takes effect<\/strong> with <strong>2<\/strong> net successes/);
    assert.deepEqual({ ...v.system.monitor }, { physical: 0, stun: 0 });
  });

  test("without a target the fixed TN is used and there is no Resist button", async () => {
    chat.length = 0;
    const s = spiritUser(3);
    faces.push(5, 5, 1);
    const r = await s.usePower(power({ targetNumber: 6 }));
    assert.equal(r.targetNumber, 6);
    assert.doesNotMatch(chat.at(-1).content, /resistSpell/);
  });

  test("an unresistable power is a plain test; passive powers do not roll", async () => {
    chat.length = 0; warnings.length = 0;
    const s = spiritUser(3); const v = victim();
    faces.push(5, 5, 1);
    await s.usePower(power({ resist: "none" }), { targetUuid: v.uuid });
    assert.equal(chat.at(-1).flags.sr2e.test.kind, "plain");
    assert.equal(await s.usePower(power({ active: false })), null);
    assert.match(warnings.at(-1) ?? "", /passive power/);
  });

  test("an NPC rolls the power's rating; a Karma re-roll keeps the power wording", async () => {
    chat.length = 0;
    const npc = makeActor(A, { karma: { pool: 2, poolSpent: 0, good: 0 } }); npc.name = "Barghest";
    const v = victim();
    faces.push(1, 1, 2, 2);                                   // rating 4: no successes
    await npc.usePower(power({ name: "Paralyzing Howl", dice: "rating", rating: 4, effect: "effect" }), { targetUuid: v.uuid });
    assert.match(chat.at(-1).content, /The power failed/);
    faces.push(5, 5, 5, 1);                                   // re-roll all 4
    await npc.karmaReroll(chat.at(-1).flags.sr2e.test);
    assert.match(chat.at(-1).content, /Resist power \(/);
    assert.equal(chat.at(-1).flags.sr2e.spell.casterSuccesses, 3);
  });
});

describe("finishing magic: sustaining, foci, totems, adepts, spell defense, materialization, assensing", () => {
  // v0.79.0: these fixtures count dice for the old Spell Pool, (Int + Wil + Magic) / 3 (RULES.DOCS_V79.magicPool.size).
  let undoPool79 = () => {}; before(() => { undoPool79 = oldWay({ "DOCS_V79.magicPool.size": "attributes" }); }); after(() => undoPool79());
  const M = { body: 3, quickness: 4, strength: 2, charisma: 5, intelligence: 5, willpower: 6 };
  const caster = (extra: any = {}, items: any[] = []) => {
    const a = makeActor(M, { magic: 6, ...extra });
    a.name = "Caster";
    a.items = [
      { id: "sk1", type: "skill", name: "Sorcery", system: { rating: 4, attribute: "willpower" } },
      { id: "sk2", type: "skill", name: "Conjuring", system: { rating: 4, attribute: "charisma" } },
      ...items,
    ];
    a.system.parent = a;
    a.system.prepareDerivedData();
    uuidRegistry.set(a.uuid, a);
    return a;
  };
  const armorSpell = { name: "Armor", system: { category: "manipulation", spellType: "physical", learnedForce: 4, damageLevel: "M", damageType: "physical",
    targetNumber: 4, drainModifier: 0, drainLevel: "M", duration: "sustained" } };
  const focusItem = (id: string, system: any) => ({ id, type: "focus", name: id, system: { rating: 2, active: true, bonded: true, category: "", target: "", ...system } });

  test("a successful sustained spell stays up and adds +2 TN to later tests until dropped", async () => {
    chat.length = 0;
    const a = caster();
    faces.push(5, 5, 1, 1);                                   // Sorcery 4 vs TN 4: 2 successes
    faces.push(5, 5, 5, 5, 5, 5);                             // drain fully resisted
    await a.castSpell(armorSpell, { force: 4 });
    assert.deepEqual(a.system.sustaining.map((x: any) => ({ ...x, effectId: /^sp/.test(x.effectId) })), [{ spellName: "Armor", force: 4, category: "manipulation", focusId: "", successes: 2, quickened: false, targetUuids: [], effectId: true, permanentAt: -1, exclusive: false }]);
    faces.push(5, 5, 5);
    const r = await a.rollAttribute("body", { targetNumber: 4 });
    assert.equal(r.targetNumber, 6);
    assert.ok(r.modifiers.some((m: any) => m.label === "Sustaining 1 spell"));
    await a.dropSustained(0);
    assert.equal(a.system.sustaining.length, 0);
  });

  test("a sustaining focus holds the spell with no TN penalty", async () => {
    const a = caster({}, [focusItem("sf", { focusType: "sustaining", rating: 4 })]);
    faces.push(5, 5, 1, 1);
    faces.push(5, 5, 5, 5, 5, 5);
    await a.castSpell(armorSpell, { force: 4, useSustainingFocus: true });
    assert.equal(a.system.sustaining[0].focusId, "sf");
    faces.push(1, 1, 1);
    const r = await a.rollAttribute("body", { targetNumber: 4 });
    assert.equal(r.targetNumber, 4);
  });

  test("spell and power foci and a shaman's totem add dice to Sorcery and are named on the card", async (t) => {
    t.after(oldWay({"BOOK_V78.powerFocus": "dice"})); // v0.78.0: the old rule (a house rule)
    chat.length = 0;
    const a = caster({ tradition: "shamanic", totem: { name: "Bear", combat: 0, detection: 0, health: 0, illusion: 0, manipulation: -1, conjuring: 2 } }, [
      focusItem("spf", { focusType: "spell", rating: 2, category: "manipulation" }),
      focusItem("pf", { focusType: "power", rating: 1 }),
    ]);
    faces.push(1, 1, 1, 1, 1, 2);                             // 4 + 2 + 1 - 1 = 6 dice
    faces.push(5, 5, 5, 5, 5, 5);
    const r = await a.castSpell({ ...armorSpell, system: { ...armorSpell.system, duration: "instant" } }, { force: 4 });
    assert.equal(r.totalDice, 6);
    assert.match(chat[0].content, /\[spell focus \+2, power focus \+1, totem -1\]/);
  });

  test("adepts cannot cast or summon; their powers add Reaction, initiative dice, skill dice and armor", async () => {
    chat.length = 0; warnings.length = 0;
    const powers = [
      { id: "ap1", type: "adeptpower", name: "Improved Reflexes", system: { cost: 3, active: true, reaction: 2, initiativeDice: 1, attributes: {} } },
      { id: "ap2", type: "adeptpower", name: "Improved Ability", system: { cost: 1, active: true, skill: "Unarmed Combat", skillDice: 2, attributes: {} } },
      { id: "ap3", type: "adeptpower", name: "Mystic Armor", system: { cost: 1, active: true, impact: 2, ballistic: 0, attributes: {} } },
    ];
    const a = caster({ tradition: "adept" }, [{ id: "sk3", type: "skill", name: "Unarmed Combat", system: { rating: 3, attribute: "strength" } }, ...powers]);
    assert.equal(await a.castSpell(armorSpell, { force: 2 }), null);
    assert.match(warnings.at(-1) ?? "", /Adepts cannot cast/);
    assert.equal(await a.conjure({ force: 2 }), null);
    assert.equal(a.system.derived.reaction, 4 + 2);           // (4 + 5) / 2 + 2
    assert.equal(a.system.derived.initiativeDice, 2);
    assert.deepEqual({ ...a.system.derived.adeptPoints }, { spent: 5, available: 6 });
    assert.equal(a.armorRating("impact"), 2);
    faces.push(1, 1, 1, 1, 1);                                // 3 + 2 dice
    const r = await a.rollSkill(a.items.find((i: any) => i.name === "Unarmed Combat"), { targetNumber: 4 });
    assert.equal(r.totalDice, 5);
    assert.match(chat.at(-1).content, /\(adept \+2\)/);
  });

  test("spell defense dice come out of the Spell Pool and are added to every spell resistance this turn", async (t) => {
    t.after(oldWay({ "MAGIC.spellDefenseSpentOnUse": false }));  // v0.79.0: the old way (now spent on use by default)
    chat.length = 0;
    const a = caster({ spellDefense: 2 });                    // Spell Pool (5 + 6 + 6) / 3 = 5
    assert.equal(a.system.derived.spellPoolLeft, 3);
    const state = { casterUuid: "x", targetUuid: a.uuid, spellName: "Manabolt", force: 5, resistAttribute: "willpower", level: "M", damageType: "physical", casterSuccesses: 1 };
    faces.push(5, 5, 5, 5, 5, 6, 1, 1, 1);                    // Willpower 6 + 2 defense dice; the 6 explodes into a 1
    await a.resistSpell(state, 0);
    assert.match(chat.at(-1).content, /\+ 2 spell defense/);
    assert.match(chat.at(-1).content, /8 dice vs TN/);
    assert.equal(a.system.spellDefense, 2);                   // not spent by default
    await a.refreshPools();
    assert.equal(a.system.spellDefense, 0);
  });

  test("hermetics are warned about nature spirits; spirit foci and totems add Conjuring dice", async () => {
    chat.length = 0; warnings.length = 0;
    g.game.actors = []; g.game.user = { isGM: true, can: () => true };
    const created: any[] = [];
    g.Actor.implementation = { create: async (d: any) => { created.push(d); return { uuid: "Actor.made" }; } };
    const herm = caster({ tradition: "hermetic" }, [focusItem("spirf", { focusType: "spirit", rating: 2, target: "nature" })]);
    faces.push(1, 1, 1, 1, 1, 1);                             // 4 + 2 dice
    faces.push(5, 5, 5, 5, 5);
    const r = await herm.conjure({ force: 3, spiritKind: "nature" });
    assert.match(warnings.at(-1) ?? "", /Hermetic magicians do not normally summon nature spirits/);
    assert.equal(r.totalDice, 6);
  });

  test("an unmaterialized spirit cannot be attacked physically", async () => {
    chat.length = 0; warnings.length = 0;
    const s = makeActor(A); s.type = "spirit"; s.name = "Ghost"; s.system.materialized = false; s.system.force = 3;
    uuidRegistry.set(s.uuid, s);
    const shooter = makeActor(A);
    const r = await shooter.attackWith({ name: "Pistol", system: { melee: false, skill: "Pistols", damagePower: 6, damageLevel: "M", damageType: "physical", modes: "", ammoMax: 0 } }, { targetUuid: s.uuid, range: "short" });
    assert.equal(r, null);
    assert.match(warnings.at(-1) ?? "", /Ghost is not materialized/);
  });

  test("a weapon focus adds its rating to melee attacks with that weapon", async () => {
    chat.length = 0;
    const a = caster({}, [focusItem("wf", { focusType: "weapon", rating: 3, target: "Spirit Blade" })]);
    a.items.push({ id: "sk9", type: "skill", name: "Edged Weapons", system: { rating: 3, attribute: "strength" } });
    faces.push(1, 1, 1, 1, 1, 1);
    const r = await a.attackWith({ name: "Spirit Blade", system: { melee: true, skill: "Edged Weapons", damagePower: 5, damageLevel: "M", damageType: "physical" } }, {});
    assert.equal(r.totalDice, 6);
    assert.match(chat.at(-1).content, /\[weapon focus \+3\]/);
  });

  test("assensing needs the astral plane and rolls Intelligence", async () => {
    chat.length = 0; warnings.length = 0;
    assert.equal(await caster({ astral: "physical" }).assense(), null);
    faces.push(5, 5, 1, 1, 1);
    const r = await caster({ astral: "perceiving" }).assense({ targetNumber: 4 });
    assert.equal(r.totalDice, 5);
    assert.equal(r.successes, 2);
  });
});

describe("magic, final pieces: area effects, protection, initiation, dispelling, quickening, barriers", () => {
  // v0.79.0: these fixtures count dice for the old Spell Pool, (Int + Wil + Magic) / 3 (RULES.DOCS_V79.magicPool.size).
  let undoPool79 = () => {}; before(() => { undoPool79 = oldWay({ "DOCS_V79.magicPool.size": "attributes" }); }); after(() => undoPool79());
  const M = { body: 3, quickness: 4, strength: 2, charisma: 5, intelligence: 5, willpower: 6 };
  const mage = (extra: any = {}, items: any[] = []) => {
    const a = makeActor(M, { magic: 6, karma: { pool: 3, poolSpent: 0, good: 10 }, ...extra });
    a.name = extra.name ?? "Mage";
    a.items = [{ id: "s1", type: "skill", name: "Sorcery", system: { rating: 4, attribute: "willpower" } },
      { id: "s2", type: "skill", name: "Conjuring", system: { rating: 4, attribute: "charisma" } }, ...items];
    a.system.parent = a;
    a.system.prepareDerivedData();
    uuidRegistry.set(a.uuid, a);
    return a;
  };
  const target = (wil: number, name: string) => {
    const t = makeActor({ ...A, willpower: wil }); t.name = name; uuidRegistry.set(t.uuid, t); return t;
  };
  const bolt = { name: "Manaball", uuid: "Item.ball", system: { category: "combat", spellType: "mana", learnedForce: 5, damageLevel: "M", damageType: "physical",
    targetNumber: 4, drainModifier: 1, drainLevel: "S", duration: "instant", area: true } };
  const armorSpell = { name: "Armor", system: { category: "manipulation", spellType: "physical", learnedForce: 4, damageLevel: "M", damageType: "physical",
    targetNumber: 4, drainModifier: 0, drainLevel: "M", duration: "sustained" } };

  test("initiation adds grade to Magic", () => {
    assert.equal(mage({ initiateGrade: 2 }).system.derived.magic, 8);
  });

  test("a Karma re-roll that turns a failed sustained spell into a success puts it on the list; another updates its successes", async () => {
    chat.length = 0;
    const a = mage();
    faces.push(1, 1, 1, 2);                                   // 0 successes vs TN 4
    faces.push(5, 5, 5, 5, 5, 5);
    await a.castSpell(armorSpell, { force: 4 });
    assert.equal(a.system.sustaining?.length ?? 0, 0);
    const snap = chat[0].flags.sr2e.test;
    faces.push(5, 1, 1, 1);                                   // 1 success
    await a.karmaReroll(snap);
    assert.equal(a.system.sustaining.length, 1);
    assert.equal(a.system.sustaining[0].successes, 1);
    faces.push(5, 5, 1);                                      // 3 failures left: 2 more
    await a.karmaReroll(chat.at(-1).flags.sr2e.test);
    assert.equal(a.system.sustaining.length, 1);
    assert.equal(a.system.sustaining[0].successes, 3);
  });

  test("an area spell rolls once against the highest target attribute and gives each target a Resist button", async () => {
    chat.length = 0;
    const a = mage(); const t1 = target(3, "Ganger A"); const t2 = target(5, "Ganger B");
    faces.push(5, 5, 6, 1, 1);
    faces.push(5, 5, 5, 5, 5, 5);
    const r = await a.castSpell(bolt, { force: 5, targetUuids: [t1.uuid, t2.uuid] });
    assert.equal(r.targetNumber, 5);
    const card = chat[0];
    assert.match(card.content, /highest Willpower of 2 targets/);
    assert.equal(card.flags.sr2e.spells.length, 2);
    assert.match(card.content, /data-index="1"/);
    assert.deepEqual(card.flags.sr2e.spells.map((x: any) => x.targetUuid), [t1.uuid, t2.uuid]);
  });

  test("an area, repeating power hits several targets and offers Use again", async () => {
    chat.length = 0;
    const s = makeActor(A); s.type = "spirit"; s.system.force = 4; s.name = "Toxic spirit";
    const t1 = target(3, "A"); const t2 = target(2, "B");
    faces.push(5, 5, 5, 1);
    await s.usePower({ name: "Noxious Breath", uuid: "Item.breath", system: { active: true, dice: "force", rating: 0, tnSource: "willpower", targetNumber: 4,
      resist: "body", effect: "damage", damageLevel: "S", damageType: "stun", area: true, repeating: true } }, { targetUuids: [t1.uuid, t2.uuid] });
    const card = chat.at(-1);
    assert.equal(card.flags.sr2e.spells.length, 2);
    assert.match(card.content, /data-sr2e-action="repeatPower"/);
    assert.deepEqual(card.flags.sr2e.repeat, { powerUuid: "Item.breath", targetUuids: [t1.uuid, t2.uuid], modifiers: [], exclude: [] });
  });

  test("a protector's spell defense and the target's own shielding are added to spell resistance", async () => {
    chat.length = 0;
    const guard = mage({ name: "Guard", spellDefense: 3 });
    const ward = mage({ name: "Ward", initiateGrade: 2, metamagic: { shielding: true } });
    const state = { casterUuid: "x", targetUuid: ward.uuid, spellName: "Manabolt", force: 5, resistAttribute: "willpower", level: "M", damageType: "physical", casterSuccesses: 1 };
    faces.push(...Array(11).fill(5));                         // Willpower 6 + 3 defense + 2 shielding
    await ward.resistSpell(state, 0, { protectorUuid: guard.uuid });
    assert.match(chat.at(-1).content, /\+ 3 spell defense from Guard \+ 2 shielding/);
    assert.match(chat.at(-1).content, /11 dice vs TN/);
  });

  test("centering cancels wound and sustaining penalties on Sorcery, up to the grade", async () => {
    chat.length = 0;
    const a = mage({ initiateGrade: 1, metamagic: { centering: true }, monitor: { physical: 3, stun: 0 } });   // wounds +2
    faces.push(1, 1, 1, 1);
    faces.push(5, 5, 5, 5, 5, 5);
    const r = await a.castSpell({ ...armorSpell, system: { ...armorSpell.system, duration: "instant" } }, { force: 4 });
    assert.ok(r.modifiers.some((m: any) => m.label === "Centering" && m.value === -1));
    assert.equal(r.targetNumber, 5);                          // 4 + 2 wounds - 1
  });

  test("dispelling wears down a sustained spell's successes and can end it; a Karma re-roll follows through", async () => {
    chat.length = 0;
    const victim = mage({ name: "Victim", sustaining: [{ spellName: "Armor", force: 4, category: "manipulation", focusId: "", successes: 3, quickened: false }] });
    const d = mage({ name: "Dispeller", metamagic: { dispelling: true } });
    faces.push(5, 5, 1, 1);                                   // 2 successes vs TN 4 -> 1 left
    faces.push(5, 5, 5, 5, 5, 5);                             // drain
    await d.dispel(victim, 0);
    assert.equal(victim.system.sustaining[0].successes, 1);
    assert.match(chat[0].content, /Armor weakens:<\/strong> 1 success left/);
    faces.push(5, 1);                                         // re-roll 2 failures: 1 more -> dispelled
    await d.karmaReroll(chat[0].flags.sr2e.test);
    assert.equal(victim.system.sustaining.length, 0);
    assert.match(chat.at(-1).content, /Armor is dispelled/);
  });

  test("dispelling needs the metamagic", async () => {
    warnings.length = 0;
    const victim = mage({ sustaining: [{ spellName: "Armor", force: 4, category: "", focusId: "", successes: 1, quickened: false }] });
    assert.equal(await mage().dispel(victim, 0), null);
    assert.match(warnings.at(-1) ?? "", /does not know the dispelling metamagic/);
  });

  test("quickening costs Good Karma equal to Force and removes the TN penalty", async () => {
    chat.length = 0; warnings.length = 0;
    const a = mage({ metamagic: { quickening: true }, sustaining: [{ spellName: "Armor", force: 4, category: "", focusId: "", successes: 2, quickened: false }] });
    await a.quicken(0);
    assert.equal(a.system.sustaining[0].quickened, true);
    assert.equal(a.system.karma.good, 6);
    faces.push(1, 1, 1);
    assert.equal((await a.rollAttribute("body", { targetNumber: 4 })).targetNumber, 4);
  });

  test("aspected sorcerers cannot summon; aspected conjurers cannot cast", async () => {
    warnings.length = 0;
    assert.equal(await mage({ tradition: "sorcerer" }).conjure({ force: 3 }), null);
    assert.match(warnings.at(-1) ?? "", /sorcerers cannot summon/);
    assert.equal(await mage({ tradition: "conjurer" }).castSpell(armorSpell, { force: 2 }), null);
  });

  test("forcing through a barrier: opposed by its rating vs Magic; net successes lower the rating", async () => {
    chat.length = 0; warnings.length = 0;
    const barrier = new SR2Actor();
    Object.assign(barrier, { type: "barrier", name: "Ward", uuid: "Actor.ward", system: { rating: 5, baseRating: 5 } });
    uuidRegistry.set(barrier.uuid, barrier);
    assert.equal(await mage({ astral: "physical" }).breachBarrier(barrier), null);
    assert.match(warnings.at(-1) ?? "", /must be on the astral plane/);
    const a = mage({ astral: "projecting" });
    faces.push(1, 1, 1, 1, 6);                                // barrier: 5 dice vs Magic 6: the 6 explodes...
    faces.push(1);                                            // ...6+1 = 7: 1 success
    faces.push(5, 5, 5, 6, 3);                                // Sorcery 4 vs TN 5: 5,5,5 and the 6 explodes into a 3 (=9): 4 successes
    const r = await a.breachBarrier(barrier);
    assert.equal(r.targetNumber, 5);
    assert.equal(barrier.system.rating, 2);
    assert.match(chat.at(-1).content, /Ward weakens:<\/strong> rating 5 → 2 \(4 vs 1\)/);
  });
});

describe("astral signatures, tracking and geasa", () => {
  // v0.79.0: these fixtures count dice for the old Spell Pool, (Int + Wil + Magic) / 3 (RULES.DOCS_V79.magicPool.size).
  let undoPool79 = () => {}; before(() => { undoPool79 = oldWay({ "DOCS_V79.magicPool.size": "attributes" }); }); after(() => undoPool79());
  const M = { body: 3, quickness: 4, strength: 2, charisma: 5, intelligence: 5, willpower: 6 };
  const mage = (extra: any = {}) => {
    const a = makeActor(M, { magic: 6, karma: { pool: 0, poolSpent: 0, good: 0 }, ...extra });
    a.name = extra.name ?? "Mage";
    a.items = [{ id: "s1", type: "skill", name: "Sorcery", system: { rating: 4, attribute: "willpower" } }];
    a.system.parent = a; a.system.prepareDerivedData();
    uuidRegistry.set(a.uuid, a);
    return a;
  };
  const spell = { name: "Stunbolt", system: { category: "combat", spellType: "mana", learnedForce: 4, damageLevel: "M", damageType: "stun",
    targetNumber: 4, drainModifier: 0, drainLevel: "M", duration: "instant" } };
  const H = 3600;
  before(() => { g.game.scenes = { viewed: { id: "scene1" } }; g.game.time = { worldTime: 10 * H }; g.game.users = [{ id: "gm1", isGM: true }, { id: "p1", isGM: false }]; });

  test("casting leaves a signature at the scene that fades after Force hours", async () => {
    chat.length = 0;
    const a = mage();
    g.game.actors = [a];
    faces.push(1, 1, 1, 1);
    faces.push(5, 5, 5, 5, 5, 5);
    await a.castSpell(spell, { force: 4 });
    const here = (SR2Actor as any).signaturesAt("scene1");
    assert.equal(here.length, 1);
    assert.deepEqual({ label: here[0].label, force: here[0].force, by: here[0].actorName, kind: here[0].kind }, { label: "Stunbolt", force: 4, by: "Mage", kind: "spell" });
    assert.equal((SR2Actor as any).signaturesAt("elsewhere").length, 0);
    g.game.time.worldTime = 15 * H;                           // 5 hours later: a Force 4 signature has faded
    assert.equal((SR2Actor as any).signaturesAt("scene1").length, 0);
    g.game.time.worldTime = 10 * H;
    await a.clearSignatures("scene1");
    assert.equal((SR2Actor as any).signaturesAt("scene1").length, 0);
  });

  test("no scene, no signature", async () => {
    const saved = g.game.scenes; g.game.scenes = undefined;
    const a = mage(); g.game.actors = [a];
    await a.leaveSignature("spell", "x", 3);
    g.game.scenes = saved;
    assert.equal((SR2Actor as any).signaturesAt("scene1").length, 0);
  });

  test("tracking a signature: astral only, freshness raises the TN, the card gives the time and the GM learns the source", async () => {
    chat.length = 0; warnings.length = 0;
    assert.equal(await mage({ astral: "physical" }).track({}), null);
    assert.match(warnings.at(-1) ?? "", /must be perceiving or projecting/);
    const t = mage({ astral: "perceiving", name: "Tracker" });
    const sig = { id: "a", sceneId: "scene1", kind: "spell", label: "Stunbolt", force: 6, worldTime: 7 * H, actorName: "Culprit" };  // 3 h old -> +1
    faces.push(5, 5, 5, 1, 1);                                // Intelligence 5 vs TN 5: 3 successes
    const r = await t.track({ signature: sig, targetNumber: 4 });
    assert.equal(r.targetNumber, 5);
    const card = chat.at(-2);
    assert.match(card.content, /Trail followed<\/strong> \(Stunbolt, Force 6\) in <strong>2 hours<\/strong>/);
    const whisper = chat.at(-1);
    assert.deepEqual(whisper.whisper, ["gm1"]);
    assert.match(whisper.content, /leads to <strong>Culprit<\/strong>/);
  });

  test("a lost trail tells nobody anything", async () => {
    chat.length = 0;
    const t = mage({ astral: "projecting" });
    faces.push(1, 1, 1, 2, 2);
    await t.track({ signature: { id: "b", sceneId: "scene1", kind: "spell", label: "x", force: 3, worldTime: 10 * H, actorName: "Culprit" } });
    assert.equal(chat.length, 1);
    assert.match(chat[0].content, /The trail is lost/);
  });

  test("an unmet geas takes away its Magic and warns when casting", async () => {
    chat.length = 0; warnings.length = 0;
    const a = mage({ geasa: [
      { text: "Must chant", magic: 1, met: true, checkOnCast: true },
      { text: "Only by moonlight", magic: 2, met: false, checkOnCast: true },
    ] });
    assert.equal(a.system.derived.magic, 4);
    assert.equal(a.system.derived.geasaPenalty, 2);
    faces.push(5, 5, 1, 1);
    faces.push(5, 5, 5, 5, 5, 5);
    await a.castSpell(spell, { force: 4 });
    assert.match(warnings.at(-1) ?? "", /casts with a geas not met \(Only by moonlight\): Magic is 4/);
    await a.setGeasa(a.geasa().map((x: any) => ({ ...x, met: true })));
    assert.equal(a.system.derived.magic, 6);
  });
});

describe("spellcraft: resisted spells, healing, background count, spell options, ritual, magic loss, enchanting, allies, quests", () => {
  // v0.79.0: these fixtures count dice for the old Spell Pool, (Int + Wil + Magic) / 3 (RULES.DOCS_V79.magicPool.size).
  let undoPool79 = () => {}; before(() => { undoPool79 = oldWay({ "DOCS_V79.magicPool.size": "attributes" }); }); after(() => undoPool79());
  const M = { body: 4, quickness: 4, strength: 2, charisma: 5, intelligence: 5, willpower: 6 };
  const mage = (extra: any = {}, items: any[] = []) => {
    const a = makeActor(M, { magic: 6, karma: { pool: 3, poolSpent: 0, good: 10 }, ...extra });
    a.name = extra.name ?? "Mage";
    a.items = [{ id: "s1", type: "skill", name: "Sorcery", system: { rating: 4, attribute: "willpower" } }, ...items];
    a.system.parent = a; a.system.prepareDerivedData();
    uuidRegistry.set(a.uuid, a);
    return a;
  };
  const spell = (name: string, sys: any) => ({ name, system: { category: "manipulation", spellType: "mana", learnedForce: 4, damageLevel: "M", damageType: "physical",
    targetNumber: 4, drainModifier: 0, drainLevel: "M", duration: "instant", resist: "none", heals: false, healTrack: "physical", exclusive: false, fetish: false, ...sys } });
  const scene = { id: "sc", flags: {} as any, getFlag(_s: string, k: string) { return this.flags[k]; }, async setFlag(_s: string, k: string, v: any) { this.flags[k] = v; } };
  before(() => { g.game.scenes = { viewed: scene }; g.game.time = { worldTime: 0 }; });

  test("a non-combat spell that names a resisting attribute uses the target's attribute and gives a Resist button (effect only)", async () => {
    chat.length = 0;
    const a = mage(); const t = mage({ name: "Guard", willpower: undefined }); t.system.attributes.willpower.total = 3;
    faces.push(5, 5, 1, 1);
    faces.push(5, 5, 5, 5, 5, 5);
    const r = await a.castSpell(spell("Confusion", { category: "illusion", resist: "willpower" }), { force: 4, targetUuid: t.uuid });
    assert.equal(r.targetNumber, 3);
    const st = chat[0].flags.sr2e.spell;
    assert.equal(st.resistAttribute, "willpower");
    assert.equal(st.effectOnly, true);
    assert.match(chat[0].content, /Resist spell/);
  });

  test("an unresisted non-combat spell keeps its own TN and has no Resist button", async () => {
    chat.length = 0;
    const a = mage(); const t = mage({ name: "Friend" });
    faces.push(5, 1, 1, 1);
    faces.push(5, 5, 5, 5, 5, 5);
    const r = await a.castSpell(spell("Armor", {}), { force: 3, targetUuid: t.uuid });
    assert.equal(r.targetNumber, 4);
    assert.doesNotMatch(chat[0].content, /resistSpell/);
  });

  test("healing: TN 10 - Essence, heals a box per success, warns on a second healing, and a Karma re-roll corrects it", async () => {
    chat.length = 0; warnings.length = 0;
    const a = mage();
    const p = mage({ name: "Patient", essence: 5, monitor: { physical: 5, stun: 0 } });   // TN 10 - 5 = 5 (+ caster has no wounds)
    const heal = spell("Heal", { category: "health", heals: true, healTrack: "physical" });
    faces.push(5, 5, 1, 1);                                   // 2 successes
    faces.push(5, 5, 5, 5, 5, 5);
    const r = await a.castSpell(heal, { force: 4, targetUuid: p.uuid });
    assert.equal(r.targetNumber, 5);
    assert.equal(p.system.monitor.physical, 3);
    assert.match(chat[0].content, /heals 2 physical boxes \(5 → 3\)/);
    faces.push(6, 1);                                         // re-roll 2 failures: the 6 explodes (6+1 = 7), 1 more success
    faces.push(1);
    await a.karmaReroll(chat[0].flags.sr2e.test);
    assert.equal(p.system.monitor.physical, 2);
    faces.push(5, 1, 1, 1);
    faces.push(5, 5, 5, 5, 5, 5);
    await a.castSpell(heal, { force: 4, targetUuid: p.uuid });
    assert.match(warnings.at(-1) ?? "", /already been healed by magic/);
  });

  test("background count raises magical TNs but not mundane ones", async () => {
    chat.length = 0;
    scene.flags.backgroundCount = 2;
    const a = mage();
    faces.push(1, 1, 1, 1);
    faces.push(5, 5, 5, 5, 5, 5);
    const r = await a.castSpell(spell("Armor", {}), { force: 3 });
    assert.equal(r.targetNumber, 6);
    faces.push(1, 1, 1, 1);
    assert.equal((await a.rollAttribute("body", { targetNumber: 4 })).targetNumber, 4);
    scene.flags.backgroundCount = 0;
  });

  test("exclusive and fetish spells lower drain; a fetish spell needs the fetish", async () => {
    chat.length = 0; warnings.length = 0;
    const a = mage();
    const s = spell("Stunball", { exclusive: true, fetish: true, drainModifier: 2 });
    assert.equal(await a.castSpell(s, { force: 4, fetishInHand: false }), null);
    assert.match(warnings.at(-1) ?? "", /needs the fetish/);
    faces.push(1, 1, 1, 1);
    faces.push(1, 1, 1, 1, 1, 2);
    await a.castSpell(s, { force: 4 });
    assert.match(chat[1].content, /TN <strong>2<\/strong>/);   // 4/2 + 2 - 2 - 1 = 1 -> min 2
    assert.match(chat[1].content, /Exclusive -2, Fetish -1/);
  });

  test("ritual sorcery: the team adds half their Sorcery, a target needs a material link, and every member resists drain", async () => {
    chat.length = 0; warnings.length = 0;
    const lead = mage({ name: "Leader" });
    const m1 = mage({ name: "Acolyte 1" }); const m2 = mage({ name: "Acolyte 2" });
    const victim = mage({ name: "Victim" });
    const bolt = spell("Death Touch", { category: "combat", resist: "none" });
    assert.equal(await lead.castSpell(bolt, { force: 4, targetUuid: victim.uuid, ritual: { teamUuids: [m1.uuid, m2.uuid], materialLink: false } }), null);
    assert.match(warnings.at(-1) ?? "", /needs a material link/);
    faces.push(...Array(8).fill(1));                          // 4 + 2 + 2 dice
    faces.push(...Array(18).fill(5));                         // three drain tests
    const r = await lead.castSpell(bolt, { force: 4, targetUuid: victim.uuid, ritual: { teamUuids: [m1.uuid, m2.uuid], materialLink: true } });
    assert.equal(r.totalDice, 8);
    assert.match(chat[0].content, /\[ritual: 3 members, team \+4, 4 h\]/);
    assert.equal(chat.filter((c: any) => /Ritual drain \(Death Touch\)/.test(c.content)).length, 2);
  });

  test("reaching Deadly physical damage prompts a Magic loss test, after the damage card; the test can cost Magic", async () => {
    chat.length = 0;
    const a = mage({ monitor: { physical: 7, stun: 0 } });
    faces.push(1, 1, 1, 1);                                   // Body 4: no successes vs 9S -> 6 boxes -> 13
    await a.resistDamage({ power: 9, level: "S" });
    assert.match(chat.at(-2).content, /Resist 9S/);
    // v0.92.3 (RULES.HEALTH_V923.permanentDamage, Core p. 114): the damage card also offers the permanent damage test.
    assert.match(chat.at(-2).content, /data-sr2e-action="permanentDamage923"/);
    assert.match(chat.at(-1).content, /data-sr2e-action="magicLoss"/);
    faces.push(1, 2);                                         // 2d6 = 3 < Magic 6
    const out = await a.rollMagicLoss();
    assert.deepEqual(out, { total: 3, lost: 1 });
    assert.equal(a.system.magic, 5);
    const mundane = makeActor(A, { monitor: { physical: 7, stun: 0 } });
    chat.length = 0;
    faces.push(1, 1, 1, 1, 1);
    await mundane.resistDamage({ power: 9, level: "S" });
    assert.doesNotMatch(chat.at(-1).content, /magicLoss/);
  });

  test("enchanting: time by successes; making a focus creates it and costs Good Karma", async () => {
    chat.length = 0; warnings.length = 0;
    const a = mage({}, [{ id: "e1", type: "skill", name: "Enchanting", system: { rating: 4, attribute: "intelligence" } },
      { id: "m1", type: "gear", name: "Refined materials", system: { quantity: 2, material: "refined" } }]);
    faces.push(5, 5, 1, 1);
    await a.enchant({ task: "focus", focus: { name: "Ruby", focusType: "power", rating: 2 } });
    assert.match(chat.at(-1).content, /done in <strong>3.5 days<\/strong>/);
    assert.match(chat.at(-1).content, /Ruby<\/strong> is made and bonded for 10 Good Karma \(using 2 refined materials\)/);
    assert.equal(a.materialStock().refined, 0);
    assert.equal(a.system.karma.good, 0);
    assert.equal(a.items.filter((i: any) => i.type === "focus").length, 1);
    assert.equal(await a.enchant({ task: "focus", focus: { name: "Opal", focusType: "power", rating: 1 } }), null);
    assert.match(warnings.at(-1) ?? "", /costs 5 Good Karma/);
    faces.push(1, 1, 1, 1);
    await a.enchant({ task: "gather" });
    assert.match(chat.at(-1).content, /The work fails/);
  });

  test("free spirits add spirit energy against banishing; allies act without spending services; allies are not summoned", async () => {
    chat.length = 0; warnings.length = 0;
    const s = makeActor(A); s.type = "spirit"; s.name = "Free spirit"; Object.assign(s.system, { force: 4, spiritKind: "free", spiritEnergy: 3, services: 0 });
    uuidRegistry.set(s.uuid, s);
    const banisher = mage({}, [{ id: "c1", type: "skill", name: "Conjuring", system: { rating: 4, attribute: "charisma" } }]);
    faces.push(...Array(7).fill(1));                          // 4 + 3 dice
    faces.push(1, 1, 1, 1);
    faces.push(5, 5, 5, 5, 5);
    await banisher.banish(s);
    assert.match(chat[0].content, /Force 4 \+ spirit energy 3/);
    assert.match(chat[0].content, /7 dice/);
    const ally = makeActor(A); ally.type = "spirit"; ally.name = "Ally"; Object.assign(ally.system, { force: 4, spiritKind: "ally", services: 0 });
    await ally.useService();
    assert.match(chat.at(-1).content, /allies do not count services/);
    assert.equal(await banisher.conjure({ force: 3, spiritKind: "ally" }), null);
  });

  test("astral quests: projecting only, stages pass on success, the quest fails on a failed stage", async () => {
    chat.length = 0; warnings.length = 0;
    const a = mage({ astral: "physical" });
    await a.startQuest({ name: "Dweller on the Threshold", stages: 2, targetNumber: 5 });
    assert.equal(await a.questStage("willpower"), null);
    assert.match(warnings.at(-1) ?? "", /must be projecting/);
    const b = mage({ astral: "projecting" });
    await b.startQuest({ name: "Dweller", stages: 2, targetNumber: 5 });
    faces.push(5, 1, 1, 1, 1, 1);
    await b.questStage("willpower");
    assert.equal(b.quest().passed, 1);
    faces.push(1, 1, 1, 1, 1, 2);
    await b.questStage("willpower");
    assert.equal(b.quest().failed, true);
    assert.match(chat.at(-1).content, /Dweller has failed/);
  });
});

describe("the Matrix: decks, hosts, system tests, cybercombat, dump shock", () => {
  // v0.92.3: these pin the v0.92.2 Matrix rules (the book's defaults: v0923-matrix tests).
  let undo922 = () => {}; before(() => { undo922 = matrix922(); }); after(() => undo922());
  // v0.79.0: these fixtures count dice for the old Spell Pool, (Int + Wil + Magic) / 3 (RULES.DOCS_V79.magicPool.size).
  let undoPool79 = () => {}; before(() => { undoPool79 = oldWay({ "DOCS_V79.magicPool.size": "attributes" }); }); after(() => undoPool79());
  let HostDataModel: any, IcDataModel: any;
  const D = { body: 4, quickness: 5, strength: 3, charisma: 3, intelligence: 6, willpower: 5 };
  const withGet = (list: any[]) => Object.assign(list, { get(id: string) { return list.find((i: any) => i.id === id); } });
  const decker = (extra: any = {}) => {
    const a = makeActor(D, { karma: { pool: 3, poolSpent: 0, good: 0 }, poolSpent: { combat: 0, spell: 0, hacking: 0 }, matrix: { jackedIn: false, hostUuid: "", monitor: 0 }, ...extra });
    a.name = extra.name ?? "Decker"; a.type = "character";
    a.items = withGet([
      { id: "sk", type: "skill", name: "Computer", system: { rating: 5, attribute: "intelligence" } },
      { id: "deck", type: "cyberdeck", name: "Fuchi Cyber-6", system: { active: true, mpcp: 6, bod: 4, evasion: 5, masking: 5, sensors: 4, hardening: 2, responseIncrease: 1, activeMemory: 300 } },
      { id: "sl", type: "program", name: "Sleaze", system: { kind: "sleaze", rating: 4, size: 96, loaded: true } },
      { id: "de", type: "program", name: "Deception", system: { kind: "deception", rating: 3, size: 54, loaded: true } },
      { id: "at", type: "program", name: "Attack", system: { kind: "attack", rating: 5, size: 75, loaded: true, damageLevel: "M" } },
    ]);
    a.system.parent = a; a.system.prepareDerivedData();
    uuidRegistry.set(a.uuid, a);
    return a;
  };
  const host = () => {
    const h = new SR2Actor();
    const sys = Object.create(HostDataModel.prototype);
    Object.assign(sys, { securityCode: "red", securityValue: 6, subsystems: { access: 7, control: 9, index: 6, files: 8, slave: 7 }, tally: 0, alert: "none",
      sheaf: [{ step: 2, event: "Probe IC", alert: "" }, { step: 8, event: "Killer IC", alert: "passive" }] });
    sys.prepareDerivedData();
    Object.assign(h, { type: "host", name: "Ares host", uuid: "Actor.host1", system: sys });
    uuidRegistry.set(h.uuid, h);
    return h;
  };
  const ic = (extra: any = {}) => {
    const i = new SR2Actor();
    const sys = Object.create(IcDataModel.prototype);
    Object.assign(sys, { rating: 5, category: "white", icType: "Killer", damageLevel: "M", damageType: "physical", initiativeDice: 0, hostUuid: "Actor.host1", matrix: { monitor: 0 }, ...extra });
    sys.prepareDerivedData();
    Object.assign(i, { type: "ic", name: extra.name ?? "Killer-5", uuid: `Actor.ic${(ic as any).n = ((ic as any).n ?? 0) + 1}`, system: sys, items: [] });
    uuidRegistry.set(i.uuid, i);
    return i;
  };
  before(async () => {
    ({ HostDataModel, IcDataModel } = await import("../models/index.ts"));
    g.fromUuidSync = (u: string) => uuidRegistry.get(u) ?? { name: u };
    g.game.users = [{ id: "gm1", isGM: true }];
  });

  test("a deck in use gives the Hacking Pool, Matrix initiative and Detection Factor; no deck, no Matrix", () => {
    const a = decker();
    const m = a.system.derived.matrix;
    assert.equal(a.system.derived.hackingPool, 4);               // (6 + 6) / 3
    assert.deepEqual({ r: m.reaction, d: m.initiativeDice, df: m.detectionFactor }, { r: 8, d: 2, df: 5 });
    assert.deepEqual(m.memory, { used: 225, free: 75, over: false });
    const plain = makeActor(D);
    assert.equal(plain.system.derived.matrix, null);
    const c = new SR2Combatant();
    c.actor = a;
    assert.equal(c.getInitiativeRoll().formula, "1d6 + 5");      // meat Reaction while not jacked in
    a.system.matrix.jackedIn = true; a.system.prepareDerivedData();
    assert.equal(c.getInitiativeRoll().formula, "2d6 + 8");
    host();
    const i = ic();
    c.actor = i;
    assert.equal(c.getInitiativeRoll().formula, "2d6 + 5");      // red host: 2 dice
  });

  test("a system test: the host rolls against the Detection Factor and raises the tally; the decker rolls vs subsystem − utility", async () => {
    chat.length = 0; warnings.length = 0;
    const h = host();
    const a = decker();
    assert.equal(await a.systemTest("files"), null);
    assert.match(warnings.at(-1) ?? "", /not jacked in/);
    await a.jackIn(h.uuid);
    chat.length = 0;
    faces.push(5, 5, 5, 1, 1, 1);                                // host: 6 dice vs DF 5 -> 3
    faces.push(5, 5, 1, 1, 1, 1, 1);                             // decker: Computer 5 + 2 pool vs 8 - 3 = 5 -> 2
    const r = await a.systemTest("files", { programId: "de", poolDice: 2, operation: "Locate file" });
    assert.equal(r.targetNumber, 5);
    assert.equal(h.system.tally, 3);
    assert.deepEqual(chat[0].whisper, ["gm1"]);
    assert.match(chat[0].content, /[Ss]ecurity tally 0 → <strong>3<\/strong>/);
    assert.match(chat[0].content, /Step 2: <strong>Probe IC/);
    assert.match(chat[1].content, /Locate file succeeds<\/strong> \(Files, 2 successes\)/);
    assert.equal(a.system.poolSpent.hacking, 2);
    faces.push(5, 5, 5, 5, 5, 1);                                // 5 more: tally 8, Killer IC, passive alert
    faces.push(1, 1, 1, 1, 2);
    await a.systemTest("access");
    assert.equal(h.system.tally, 8);
    assert.equal(h.system.alert, "passive");
    assert.match(chat.at(-1).content, /fails/);
  });

  test("cybercombat against IC: no dodge, the IC resists with its rating, and a full monitor derezzes it", async () => {
    chat.length = 0;
    const h = host();
    const a = decker(); await a.jackIn(h.uuid);
    const i = ic();
    chat.length = 0;
    faces.push(5, 5, 5, 1, 1);                                   // Computer 5 vs IC rating 5: 3 net -> 5M becomes 5S
    await a.matrixAttack({ targetUuid: i.uuid, programId: "at" });
    const dmg = chat[0].flags.sr2e.damage;
    assert.deepEqual({ m: dmg.matrix, p: dmg.power, l: dmg.level }, { m: true, p: 5, l: "S" });
    assert.match(chat[0].content, /Resist \(Killer-5\)/);
    faces.push(1, 1, 1, 2, 2);
    await i.resistFromState(dmg);
    assert.equal(i.system.matrix.monitor, 6);
    faces.push(5, 5, 5, 5, 5);                                   // 5 net: Deadly
    await a.matrixAttack({ targetUuid: i.uuid, programId: "at" });
    faces.push(2, 2, 2, 2, 2);
    await i.resistFromState(chat.at(-1).flags.sr2e.damage);
    assert.equal(i.system.matrix.monitor, 10);
    assert.match(chat.at(-1).content, /Killer-5 is derezzed!/);
    assert.equal(await i.icAttack({ targetUuid: a.uuid }), null);
    assert.equal(await a.matrixAttack({ targetUuid: i.uuid, programId: "sl" }), null);   // not an attack utility
  });

  test("IC attack the persona: Bod + Hacking Pool vs Power − Hardening, Karma corrects it, a crash dumps the decker", async () => {
    chat.length = 0;
    const h = host();
    const a = decker(); await a.jackIn(h.uuid);
    const i = ic({ rating: 6, name: "Killer-6" });
    chat.length = 0;
    faces.push(5, 5, 1, 1, 1, 1);                                // 6 dice vs Evasion 5: 2 -> 6M
    await i.icAttack({ targetUuid: a.uuid });
    assert.match(chat[0].content, /data-sr2e-action="defend"/);   // v0.27.0: the persona may defend with Hacking Pool
    await a.defend(chat[0].flags.sr2e.attack, 0);                // no pool dice: nothing cancelled
    const dmg = chat.at(-1).flags.sr2e.damage;
    faces.push(4, 1, 1, 1, 1);                                   // Bod 4 + 1 pool vs 6 - 2 = 4: 1 success
    await a.resistFromState(dmg, 1);
    assert.equal(a.system.matrix.monitor, 3);
    assert.equal(a.system.poolSpent.hacking, 1);
    faces.push(4, 4, 1, 1);                                      // Karma re-roll of 4 failures: 2 more -> 3 -> L
    await a.karmaReroll(chat.at(-1).flags.sr2e.test);
    assert.equal(a.system.matrix.monitor, 1);
    await a.update({ "system.matrix.monitor": 8 });
    faces.push(5, 5, 1, 1, 1, 1);
    await i.icAttack({ targetUuid: a.uuid });
    await a.defend(chat.at(-1).flags.sr2e.attack, 0);
    faces.push(1, 1, 1, 2);
    await a.resistFromState(chat.at(-1).flags.sr2e.damage);
    assert.equal(a.system.matrix.monitor, 10);
    assert.equal(a.system.matrix.jackedIn, false);
    assert.match(chat.at(-2).content, /The persona crashes!/);
    assert.match(chat.at(-1).content, /data-sr2e-action="dumpShock"/);
    assert.equal(chat.at(-1).flags.sr2e.dumpShockTn, 6);
    faces.push(1, 1, 1, 2, 2);                                   // Willpower 5 vs 6: no successes, M stun
    await a.rollDumpShock(6);
    assert.equal(a.system.monitor.stun, 3);
    assert.match(chat.at(-1).content, /Takes <strong>M<\/strong> stun damage/);
    assert.equal(await a.jackIn(h.uuid), false);                 // crashed persona must be repaired first
  });

  test("black IC hit the decker's own track, resisted with Willpower", async () => {
    chat.length = 0;
    const h = host();
    const a = decker(); await a.jackIn(h.uuid);
    const i = ic({ rating: 6, category: "black", damageType: "physical", name: "Black-6" });
    chat.length = 0;
    faces.push(5, 5, 5, 1, 1, 1);                                // 3 net: 6M -> 6S
    await i.icAttack({ targetUuid: a.uuid });
    await a.defend(chat[0].flags.sr2e.attack, 0);
    const dmg = chat.at(-1).flags.sr2e.damage;
    assert.equal(dmg.black, true);
    faces.push(1, 1, 1, 2, 2);
    await a.resistFromState(dmg);
    assert.equal(a.system.monitor.physical, 6);
    assert.equal(a.system.matrix.monitor, 0);
    assert.match(chat.at(-1).content, /Resist black IC 6S physical \(Willpower\)/);
  });
});

describe("v0.79.0 Spell Pool = Sorcery (RULES.DOCS_V79.magicPool)", () => {
  const M = { body: 4, quickness: 4, strength: 2, charisma: 5, intelligence: 5, willpower: 6 };
  const sorc = (rating: number) => ({ id: "s79", type: "skill", name: "Sorcery", system: { rating, attribute: "willpower" } });
  const pf = { id: "pf79", type: "focus", name: "Power focus", system: { focusType: "power", rating: 2, active: true, bonded: true, category: "", target: "" } };
  const who = (items: any[]) => {
    const a = makeActor(M, { magic: 3, tradition: "hermetic" });
    a.items = items; a.system.parent = a; a.system.prepareDerivedData(); uuidRegistry.set(a.uuid, a);
    return a;
  };
  test("the pool is the Sorcery rating; a power focus still adds (v0.78.0); no Sorcery, no pool", () => {
    assert.equal(who([sorc(5)]).system.derived.spellPool, 5);
    assert.equal(who([sorc(5), pf]).system.derived.spellPool, 7);
    assert.equal(who([]).system.derived.spellPool, 0);
  });
  test("the old way: (Int + Wil + Magic) / 3", (t) => {
    t.after(oldWay({ "DOCS_V79.magicPool.size": "attributes" }));
    const a = who([sorc(5)]);
    assert.equal(a.system.derived.spellPool, Math.floor((5 + 6 + 3) / 3));
  });
});

describe("the rest of magic: elemental spells and services, projection, masking, domains, aspects, foci, Karma, materials", () => {
  // v0.79.0: these fixtures count dice for the old Spell Pool, (Int + Wil + Magic) / 3 (RULES.DOCS_V79.magicPool.size).
  let undoPool79 = () => {}; before(() => { undoPool79 = oldWay({ "DOCS_V79.magicPool.size": "attributes" }); }); after(() => undoPool79());
  const M = { body: 4, quickness: 4, strength: 2, charisma: 5, intelligence: 5, willpower: 6 };
  const H = 3600;
  const withGet = (list: any[]) => Object.assign(list, { get(id: string) { return list.find((i: any) => i.id === id); } });
  const item = (x: any) => ({ ...x, async update(d: any) { for (const [k, v] of Object.entries(d)) setPath(this, k, v); } });
  const mage = (extra: any = {}, items: any[] = []) => {
    const a = makeActor(M, { magic: 6, karma: { pool: 0, poolSpent: 0, good: 30 }, metamagic: {}, initiateGrade: 0, nuyen: 0, ...extra });
    a.name = extra.name ?? "Mage"; a.type = extra.type ?? "character";
    a.items = withGet([item({ id: "s1", type: "skill", name: "Sorcery", system: { rating: 4, attribute: "willpower" } }), ...items.map(item)]);
    a.system.parent = a; a.system.prepareDerivedData();
    uuidRegistry.set(a.uuid, a);
    return a;
  };
  const spell = (name: string, sys: any) => item({ id: `sp-${name}`, name, type: "spell", system: { category: "combat", spellType: "mana", learnedForce: 4, damageLevel: "M", damageType: "stun",
    targetNumber: 4, drainModifier: 0, drainLevel: "M", duration: "instant", resist: "none", heals: false, healTrack: "physical", exclusive: false, fetish: false,
    elemental: false, element: "", area: false, ...sys } });
  const spirit = (sys: any) => {
    const s = makeActor(A); s.type = "spirit"; s.name = sys.name ?? "Spirit"; Object.assign(s.system, { force: 3, services: 2, ...sys });
    s.update = async function (d: any) { for (const [k, v] of Object.entries(d)) setPath(this, k, v); };
    uuidRegistry.set(s.uuid, s);
    return s;
  };
  const scene = { id: "magicScene", flags: {} as any, getFlag(_s: string, k: string) { return this.flags[k]; }, async setFlag(_s: string, k: string, v: any) { this.flags[k] = v; } };
  before(() => { g.game.scenes = { viewed: scene }; g.game.time = { worldTime: 0 }; });
  const fireball = spell("Fireball", { spellType: "physical", elemental: true, element: "fire", learnedForce: 5, damageType: "physical", area: true });

  test("an elemental spell is a ranged attack on each target: Power = Force, half impact armor counts", async () => {
    chat.length = 0;
    const a = mage();
    const g1 = mage({ name: "Guard 1" }, [{ id: "ar", type: "armor", name: "Jacket", system: { worn: true, ballistic: 2, impact: 4 } }]);
    const g2 = mage({ name: "Guard 2" });
    faces.push(5, 5, 1, 1);                                   // Sorcery 4 vs the spell's TN 4: 2 successes
    faces.push(5, 5, 5, 5, 5, 5);                             // drain
    const r = await a.castSpell(fireball, { force: 5, targetUuids: [g1.uuid, g2.uuid] });
    assert.equal(r.targetNumber, 4);
    const attacks = chat[0].flags.sr2e.attacks;
    assert.equal(attacks.length, 2);
    assert.deepEqual({ p: attacks[0].power, l: attacks[0].level, e: attacks[0].elemental }, { p: 5, l: "M", e: true });
    assert.equal((chat[0].content.match(/data-sr2e-action="defend"/g) ?? []).length, 2);
    await g1.defend({ ...attacks[0], attackSuccesses: 2, targetNumber: 4 }, 0);
    const dmg = chat.at(-1).flags.sr2e.damage;
    assert.equal(dmg.elemental, true);
    faces.push(1, 1, 1, 2);                                   // Body 4 vs 5 - floor(4 / 2) = 3: no successes
    await g1.resistFromState(dmg);
    assert.match(chat.at(-1).content, /TN <strong>3<\/strong>/);
    assert.equal(g1.system.monitor.physical, 3);
  });

  test("an elemental of the spell's element aids it with its Force, for a service; another element cannot", async () => {
    chat.length = 0; warnings.length = 0;
    const a = mage();
    const fire = spirit({ name: "Fire elemental", spiritKind: "elemental", element: "fire", summonerUuid: a.uuid, force: 3 });
    const water = spirit({ name: "Water elemental", spiritKind: "elemental", element: "water", summonerUuid: a.uuid, force: 3 });
    faces.push(1, 1, 1, 1, 1, 1, 2);
    faces.push(5, 5, 5, 5, 5, 5);
    const r = await a.castSpell(fireball, { force: 5, aidUuid: fire.uuid });
    assert.equal(r.totalDice, 7);
    assert.equal(fire.system.services, 1);
    assert.match(chat[0].content, /Fire elemental aids \+3/);
    faces.push(1, 1, 1, 2);
    faces.push(5, 5, 5, 5, 5, 5);
    const r2 = await a.castSpell(fireball, { force: 5, aidUuid: water.uuid });
    assert.equal(r2.totalDice, 4);
    assert.match(warnings.at(-1) ?? "", /can only aid illusion spells/);
  });

  test("an elemental can sustain a spell for a service, removing the TN penalty", async () => {
    const a = mage({ sustaining: [{ spellName: "Armor", force: 3, category: "manipulation", focusId: "", successes: 2, quickened: false, spiritUuid: "" }] });
    const el = spirit({ name: "Air elemental", spiritKind: "elemental", element: "air", summonerUuid: a.uuid });
    faces.push(1, 1, 1, 2);
    assert.equal((await a.rollAttribute("body", { targetNumber: 4 })).targetNumber, 6);
    // v0.54.0: an air elemental serves detection spells: Armor (manipulation) is refused by default.
    assert.equal(await a.sustainWithElemental(0, el.uuid), false);
    assert.equal(el.system.services, 2);
    (RULES.MAGIC_EXTRA as any).elementalMatch = "any";
    try { assert.equal(await a.sustainWithElemental(0, el.uuid), true); } finally { (RULES.MAGIC_EXTRA as any).elementalMatch = "category"; }
    assert.equal(el.system.services, 1);
    faces.push(1, 1, 1, 2);
    assert.equal((await a.rollAttribute("body", { targetNumber: 4 })).targetNumber, 4);
  });

  test("v0.54.0: an elemental sustains only the spells it could aid (by category, or by element)", async () => {
    const a = mage({ sustaining: [
      { spellName: "Flamethrower", force: 3, category: "combat", focusId: "", successes: 2, quickened: false, spiritUuid: "" },
      { spellName: "Ice Lance", force: 3, category: "combat", focusId: "", successes: 2, quickened: false, spiritUuid: "" },
      { spellName: "Mask", force: 3, category: "illusion", focusId: "", successes: 2, quickened: false, spiritUuid: "" },
    ] }, [
      { id: "f1", type: "spell", name: "Flamethrower", system: { element: "fire", force: 3 } },
      { id: "f2", type: "spell", name: "Ice Lance", system: { element: "cold", force: 3 } },
    ]);
    const el = spirit({ name: "Fire elemental", spiritKind: "elemental", element: "fire", summonerUuid: a.uuid, services: 5 });
    // 'category' (default): fire serves combat spells.
    assert.equal(await a.sustainWithElemental(2, el.uuid), false);
    assert.equal(await a.sustainWithElemental(1, el.uuid), true);
    // 'element': only its own element.
    (RULES.MAGIC_EXTRA as any).elementalMatch = "element";
    try {
      assert.equal(await a.sustainWithElemental(1, el.uuid), false);
      assert.equal(await a.sustainWithElemental(0, el.uuid), true);
    } finally { (RULES.MAGIC_EXTRA as any).elementalMatch = "category"; }
    assert.equal(el.system.services, 3);
  });

  test("projection lasts 2 x Essence hours; overstaying costs Essence; an empty body cannot dodge", async () => {
    chat.length = 0;
    g.game.time.worldTime = 0;
    const a = mage();
    await a.onAstralModeChange("physical", "projecting");
    a.system.astral = "projecting"; a.system.prepareDerivedData();
    g.game.time.worldTime = 15 * H;
    assert.deepEqual(a.projectionStatus(), { hours: 15, limit: 12, over: 3 });
    a.system.astral = "physical"; a.system.prepareDerivedData();
    await a.onAstralModeChange("projecting", "physical");
    assert.equal(a.system.essence, 3);
    assert.match(chat.at(-1).content, /Overstayed 3 h: loses 3 Essence/);
    g.game.time.worldTime = 0;
    const b = mage({ astral: "projecting" });
    await b.defend({ attackerUuid: "x", targetUuid: b.uuid, weaponName: "Gun", melee: false, damageType: "physical", power: 6, level: "M", attackSuccesses: 2, targetNumber: 4 }, 3);
    assert.match(chat.at(-1).content, /Defenseless \(body empty while projecting\)/);
    assert.equal(b.system.poolSpent.combat, 0);
  });

  test("masking makes a magician harder to assense and their signatures harder to track", async () => {
    chat.length = 0;
    const masked = mage({ name: "Masked", initiateGrade: 2, metamagic: { masking: true } }, [{ id: "f1", type: "focus", name: "Ring", system: { focusType: "power", rating: 2, active: true, bonded: true, category: "", target: "" } }]);
    const seer = mage({ name: "Seer", astral: "perceiving" });
    faces.push(6, 1, 1, 1, 1);
    faces.push(1);                                            // 6 + 1 = 7 beats TN 6
    const r = await seer.assense({ targetUuid: masked.uuid, targetNumber: 4 });
    assert.equal(r.targetNumber, 6);
    assert.match(chat.at(-1).content, /Active foci: Ring \(power 2\)/);
    await masked.leaveSignature("spell", "Stunbolt", 4);
    const sig = masked.getFlag("sr2e", "signatures").at(-1);
    assert.equal(sig.masking, 2);
    faces.push(1, 1, 1, 1, 2);
    const t = await seer.track({ signature: { ...sig, actorName: "Masked" }, targetNumber: 4 });
    assert.equal(t.targetNumber, 6);
  });

  test("nature spirit domains warn on a second spirit; elementals can cost conjuring materials", async () => {
    warnings.length = 0;
    const c = mage({ nuyen: 1000 }, [{ id: "c1", type: "skill", name: "Conjuring", system: { rating: 4, attribute: "charisma" } }]);
    const old = spirit({ name: "Forest spirit", spiritKind: "nature", domain: "Forest", summonerUuid: c.uuid, services: 1 });
    g.game.actors = [old];
    faces.push(1, 1, 1, 2);
    faces.push(5, 5, 5, 5, 5);
    await c.conjure({ force: 2, spiritKind: "nature", domain: "forest" });
    assert.ok(warnings.some((w) => /only one per domain/.test(w)));
    assert.equal(await c.conjure({ force: 2, spiritKind: "elemental", spiritType: "Fire elemental", useMaterials: true }), null);
    assert.match(warnings.at(-1) ?? "", /cost 2000¥/);
    c.system.nuyen = 5000;
    chat.length = 0;
    faces.push(1, 1, 1, 2);
    faces.push(5, 5, 5, 5, 5);
    await c.conjure({ force: 2, spiritKind: "elemental", spiritType: "Fire elemental", useMaterials: true });
    assert.equal(c.system.nuyen, 3000);
    assert.match(chat[0].content, /materials 2000¥, 2 h/);
    g.game.actors = [];
  });

  test("elementalists and shamanists are limited by their aspect", async () => {
    warnings.length = 0;
    const el = mage({ tradition: "elementalist", aspectElement: "fire" });
    assert.equal(await el.castSpell(spell("Heal", { category: "health" }), { force: 2 }), null);
    assert.match(warnings.at(-1) ?? "", /fire elementalist casts only combat/);
    const sh = mage({ tradition: "shamanist", totem: { combat: 2 } }, [{ id: "c1", type: "skill", name: "Conjuring", system: { rating: 4, attribute: "charisma" } }]);
    assert.equal(await sh.conjure({ force: 2, spiritKind: "elemental" }), null);
    assert.match(warnings.at(-1) ?? "", /only nature spirits/);
  });

  test("a totem's environment adds (or takes) dice depending on the scene", async () => {
    chat.length = 0;
    scene.flags.environment = "Forest, wilderness";
    const sh = mage({ tradition: "shamanic", totem: { name: "Bear", combat: 0, environment: "forest", inEnvironment: 2, outEnvironment: -1 } });
    faces.push(1, 1, 1, 1, 1, 2);
    faces.push(5, 5, 5, 5, 5, 5);
    assert.equal((await sh.castSpell(spell("Stunbolt", {}), { force: 3 })).totalDice, 6);
    assert.match(chat[0].content, /totem environment \+2/);
    scene.flags.environment = "urban";
    faces.push(1, 1, 2);
    faces.push(5, 5, 5, 5, 5, 5);
    assert.equal((await sh.castSpell(spell("Stunbolt", {}), { force: 3 })).totalDice, 3);
    scene.flags.environment = "";
  });

  test("only bonded foci work; bonding costs Good Karma; active foci over Magic risk addiction", async () => {
    const a = mage({}, [{ id: "f1", type: "focus", name: "Opal", system: { focusType: "power", rating: 2, active: true, bonded: false, category: "", target: "" } },
      { id: "f2", type: "focus", name: "Staff", system: { focusType: "spell", rating: 5, active: true, bonded: true, category: "", target: "" } }]);
    assert.equal(a.system.derived.focusAddiction.total, 5);
    assert.equal(a.system.derived.focusAddiction.risk, false);
    assert.equal(await a.bondFocus(a.items.get("f1")), true);
    a.system.prepareDerivedData();
    assert.equal(a.system.karma.good, 20);
    assert.deepEqual(a.system.derived.focusAddiction, { total: 7, risk: true });
  });

  test("a magical weapon ignores immunity to normal weapons", async () => {
    chat.length = 0;
    const a = mage({}, [{ id: "w1", type: "weapon", name: "Silver sword", system: { melee: true, magical: true, skill: "Edged", damagePower: 5, damageLevel: "M", damageType: "physical", modes: "" } }]);
    const s = spirit({ name: "Watcher", spiritKind: "nature", force: 4, immuneNormalWeapons: true, materialized: true });
    faces.push(1, 1, 1, 2);
    await a.attackWith(a.items.get("w1"), { targetUuid: s.uuid });
    faces.length = 0;   // v0.47.0: unskilled melee defaults to the linked attribute (Strength), fewer dice
    assert.equal(chat.at(-1).flags.sr2e.test.attack.ignoreImmunity, true);
    assert.equal(s.armorRating("impact"), 8);
    assert.equal(s.armorRating("impact", { ignoreImmunity: true }), 0);
  });

  test("casting across planes is limited; a ward adds resistance dice", async () => {
    chat.length = 0; warnings.length = 0;
    const stunbolt = spell("Stunbolt", {});
    const proj = mage({ astral: "projecting" });
    const t = mage({ name: "Target" });
    assert.equal(await proj.castSpell(stunbolt, { force: 4, targetUuid: t.uuid }), null);
    assert.match(warnings.at(-1) ?? "", /only cast at astral targets/);
    const ward = new SR2Actor();
    Object.assign(ward, { type: "barrier", name: "Ward", uuid: "Actor.ward2", system: { rating: 3 } });
    uuidRegistry.set(ward.uuid, ward);
    const a = mage();
    faces.push(6, 6, 1, 1);                                   // vs the target's Willpower 6
    faces.push(1, 1);                                         // 7, 7: 2 successes
    faces.push(5, 5, 5, 5, 5, 5);
    await a.castSpell(stunbolt, { force: 4, targetUuid: t.uuid, barrierUuid: ward.uuid });
    const st = chat[0].flags.sr2e.spell;
    assert.equal(st.barrierDice, 3);
    faces.push(...Array(9).fill(1).map((_, i) => (i === 8 ? 2 : 1)));
    await t.resistSpell(st, 0);
    assert.match(chat.at(-1).content, /\+ 3 Ward/);
    assert.match(chat.at(-1).content, /9 dice/);
  });

  test("Good Karma raises a spell's Force and buys initiation with a metamagic", async () => {
    const a = mage();
    const s = spell("Stunbolt", {});
    assert.equal(await a.raiseSpellForce(s, 5), true);
    assert.equal(s.system.learnedForce, 5);
    assert.equal(a.system.karma.good, 25);
    assert.equal(await a.advanceInitiation("masking"), true);
    assert.equal(a.system.initiateGrade, 1);
    assert.equal(a.system.metamagic.masking, true);
    assert.equal(a.system.karma.good, 4);
    assert.equal(await a.advanceInitiation(null), false);
  });

  test("a ritual can use an astral spotter instead of a material link", async () => {
    chat.length = 0; warnings.length = 0;
    const lead = mage({ name: "Leader" });
    const spotter = mage({ name: "Spotty", astral: "projecting" });
    const victim = mage({ name: "Victim" });
    faces.push(1, 1, 1, 2);
    faces.push(5, 5, 5, 5, 5, 5);
    const r = await lead.castSpell(spell("Stunbolt", {}), { force: 4, targetUuid: victim.uuid, ritual: { teamUuids: [], materialLink: false, spotterUuid: spotter.uuid } });
    assert.ok(r);
    assert.match(chat[0].content, /spotter Spotty/);
  });

  test("enchanting moves materials: gather raw, refine it, make a fetish", async () => {
    chat.length = 0;
    const a = mage({}, [{ id: "e1", type: "skill", name: "Enchanting", system: { rating: 4, attribute: "intelligence" } }]);
    faces.push(5, 5, 1, 1);
    await a.enchant({ task: "gather" });
    assert.equal(a.materialStock().raw, 2);
    faces.push(5, 1, 1, 1);
    await a.enchant({ task: "refine" });
    assert.deepEqual({ raw: a.materialStock().raw, refined: a.materialStock().refined }, { raw: 1, refined: 1 });
    faces.push(5, 1, 1, 1);
    await a.enchant({ task: "fetish", fetishFor: "Stunbolt" });
    assert.equal(a.materialStock().refined, 0);
    assert.equal(a.materialStock().fetish, 1);
    assert.ok(a.items.some((i: any) => i.name === "Fetish (Stunbolt)"));
  });

  test("anchoring stores a spell and releasing it casts it", async () => {
    chat.length = 0; warnings.length = 0;
    const s = spell("Stunbolt", {});
    const a = mage({ metamagic: { anchoring: true } }, [s]);
    assert.equal(await a.castSpell(a.items.get(s.id), { force: 3, anchor: { trigger: "the door opens" } }), null);
    assert.equal(a.system.anchored.length, 1);
    // v0.72.0 (O21): anchoring costs Good Karma by Force (MAGIC_V72.anchoring).
    assert.match(chat.at(-1).content, /anchors Stunbolt \(Force 3\)( for 3 Good Karma)?, to trigger when: <em>the door opens/);
    faces.push(1, 1, 1, 2);
    faces.push(5, 5, 5, 5, 5, 5);
    const r = await a.releaseAnchored(0);
    assert.ok(r);
    assert.equal(a.system.anchored.length, 0);
    const b = mage();
    assert.equal(await b.castSpell(s, { anchor: { trigger: "x" } }), null);
    assert.match(warnings.at(-1) ?? "", /does not know the anchoring/);
  });
});

describe("v0.20.0 combat additions", () => {
  const rifle = (over: any = {}): any => ({ name: "Rifle", update: async (_d?: any) => {}, system: { melee: false, skill: "Rifles", damagePower: 8, damageLevel: "M", damageType: "physical", modes: "SA/BF/FA", ammo: 30, ammoMax: 30, recoilComp: 0, ammoType: "standard", ...over } });
  const shooter = () => { const a = makeActor(A); a.items = [{ type: "skill", name: "Rifles", system: { rating: 3, attribute: "quickness" } }]; return a; };

  test("ammunition changes Power, damage type and the armor that counts", async () => {
    chat.length = 0;
    faces.push(5, 5, 5);
    await shooter().attackWith(rifle({ ammoType: "gel" }), { targetUuid: "Actor.t", range: "short" });
    const atk = chat.at(-1).flags.sr2e.attack;
    assert.equal(atk.power, 6);
    assert.equal(atk.damageType, "stun");
    assert.equal(atk.armorKind, "impact");
    assert.match(chat.at(-1).content, /\[Gel\]/);

    chat.length = 0;
    const t = makeActor(A);
    t.items = [{ type: "armor", system: { worn: true, ballistic: 6, impact: 2 } }];
    faces.push(1, 1, 1, 1, 1);
    await t.resistFromState({ targetUuid: "x", melee: false, damageType: "physical", power: 10, level: "M", armorMultiplier: 0.5 }, 0);
    assert.match(chat.at(-1).content, /vs TN <strong>7<\/strong>/);   // 10 - floor(6 * 0.5)
  });

  test("called shots: +4 TN and either a damage stage or no armor", async () => {
    chat.length = 0;
    faces.push(2, 2, 2);
    const r = await shooter().attackWith(rifle(), { targetUuid: "Actor.t", range: "short", calledShot: "damage" });
    assert.equal(r.targetNumber, 8);
    faces.push(6, 6, 2, 2, 2);                           // two 6s explode to 8: 2 successes vs TN 8
    await shooter().attackWith(rifle(), { targetUuid: "Actor.t", range: "short", calledShot: "armor" });
    assert.equal(chat.at(-1).flags.sr2e.attack.ignoreArmor, true);

    chat.length = 0;
    const t = makeActor(A);
    t.items = [{ type: "armor", system: { worn: true, ballistic: 6, impact: 2 } }];
    faces.push(1, 1, 1, 1, 1);
    await t.resistFromState({ targetUuid: "x", melee: false, damageType: "physical", power: 8, level: "M", ignoreArmor: true }, 0);
    assert.match(chat.at(-1).content, /vs TN <strong>8<\/strong>/);
  });

  test("heavy weapons double recoil; split full auto fires the rounds given", async (t) => {
    t.after(oldWay({ 'DOCS_V79.rangedRecoil': 'freeFirst' })); // v0.79.0: the old recoil count (a house rule)
    chat.length = 0;
    faces.push(2, 2, 2);
    const r = await shooter().attackWith(rifle({ heavy: true }), { range: "short", mode: "BF", earlierRoundsThisPhase: 0 });
    assert.equal(r.targetNumber, 4 + 4);                 // BF: 3 rounds, 2 uncompensated, doubled
    const gun = rifle();
    gun.update = async (d: any) => { gun.system.ammo = d["system.ammo"]; };
    faces.push(2, 2, 2);
    await shooter().attackWith(gun, { range: "short", mode: "FA", rounds: 2, spreadExtraTargets: 1, earlierRoundsThisPhase: 0 });
    assert.equal(gun.system.ammo, 28);
    assert.match(chat.at(-1).content, /FA ×2/);
  });

  test("blasts: every target gets its own fixed damage and a Resist button; a miss scatters", async () => {
    chat.length = 0;
    const g: any = { name: "Grenade", system: { melee: false, skill: "Throwing", damagePower: 10, damageLevel: "S", damageType: "physical", modes: "", ammo: 0, ammoMax: 0, recoilComp: 0, blast: true, blastPerMetre: 1 } };
    const thrower = () => { const a = makeActor(A); a.items = [{ type: "skill", name: "Throwing", system: { rating: 2, attribute: "quickness" } }]; return a; };
    faces.push(5, 5);
    await thrower().attackWith(g, { range: "short", hits: [{ targetUuid: "Actor.a1", power: 10 }, { targetUuid: "Actor.a2", power: 7 }], blastPoint: { x: 0, y: 0, elevation: 0 } });
    let msg = chat.at(-1);
    assert.match(msg.content, /Blast!/);
    assert.equal(msg.flags.sr2e.damages.length, 2);
    assert.deepEqual([msg.flags.sr2e.damages[1].power, msg.flags.sr2e.damages[1].level], [7, "S"]);   // not staged by successes
    assert.equal(msg.flags.sr2e.damages[0].armorKind, "impact");
    faces.push(5, 2);
    await thrower().attackWith(g, { range: "medium", blastPoint: { x: 0, y: 0, elevation: 0 } });
    msg = chat.at(-1);
    assert.match(msg.content, /blastScatter/);                       // every thrown blast detonates via the card
    assert.match(msg.content, /scatter 1d6 m − 2 m/);                // v0.79.0 (DOCS_V79.rangedScatter 'byType'): a standard grenade 1D6 (was 2D6 by range)
    assert.equal(msg.flags.sr2e.blast.power, 10);
    assert.equal(msg.flags.sr2e.blast.successes, 1);
    assert.equal(msg.flags.sr2e.blast.range, "medium");

    chat.length = 0;
    await makeActor(A).postBlast(msg.flags.sr2e.blast, [{ targetUuid: "Actor.a1", name: "A1", metres: 3.5 }, { targetUuid: "Actor.a2", name: "A2", metres: 12 }], "Scattered 4 m");
    assert.equal(chat.at(-1).flags.sr2e.damages.length, 1);
    assert.equal(chat.at(-1).flags.sr2e.damages[0].power, 7);
  });

  test("a heavy hit offers a knockdown test", async () => {
    chat.length = 0;
    faces.push(1, 1, 1, 1, 1);
    await makeActor(A).resistFromState({ targetUuid: "x", melee: false, damageType: "physical", power: 9, level: "M" }, 0);   // Power 9 > Body 5
    assert.match(chat.at(-1).content, /Knockdown test \(Body vs 9\)/);
    assert.equal(chat.at(-1).flags.sr2e.knockdown.tn, 9);
    chat.length = 0;
    faces.push(1, 1, 1, 1, 1);
    await makeActor(A).resistFromState({ targetUuid: "x", melee: false, damageType: "physical", power: 4, level: "M" }, 0);
    assert.doesNotMatch(chat.at(-1).content, /Knockdown/);
    chat.length = 0;
    faces.push(2, 2, 2, 2, 2);
    const r = await makeActor(A).rollKnockdown(6);
    assert.equal(r.successes, 0);
    assert.match(chat.at(-1).content, /knocked down/);
  });

  test("cyberware armor, smartlink and vision; bioware costs Body Index and Magic, not Essence", (t) => {
    t.after(oldWay({ "GEAR_V923.dermal": "armor", "GEAR_V923.awakenedBioware": "magic" })); // v0.92.3: the old way (v0.92.2); __tests__/v0923-gear.test.ts has the book's
    const sys = Object.create(CharacterDataModel.prototype);
    sys.attributes = Object.fromEntries(Object.entries(A).map(([k, v]) => [k, { base: v, mod: 0 }]));
    Object.assign(sys, { essence: 6, magic: 5, reactionBonus: 0, initiativeDiceBonus: 0, poolSpent: { combat: 0, spell: 0 }, monitor: { physical: 0, stun: 0 } });
    sys.parent = { items: [
      { type: "cyberware", name: "Dermal plating", system: { essenceCost: 1, grade: "standard", installed: true, armorBallistic: 2, armorImpact: 2 } },
      { type: "cyberware", name: "Smartlink", system: { essenceCost: 0.5, grade: "standard", installed: true } },
      { type: "cyberware", name: "Cybereyes", system: { essenceCost: 0.2, grade: "standard", installed: true, lowLight: true } },
      { type: "cyberware", name: "Muscle augmentation", system: { essenceCost: 9, grade: "standard", installed: true, bioware: true, bodyIndex: 2 } },
    ] };
    sys.prepareDerivedData();
    assert.equal(sys.derived.essence, 4.3);              // bioware's Essence cost ignored
    assert.deepEqual({ ...sys.derived.cyberArmor }, { ballistic: 2, impact: 2 });
    assert.equal(sys.derived.smartlink, true);
    assert.equal(sys.derived.vision.lowLight, true);
    assert.equal(sys.derived.vision.thermographic, false);
    assert.equal(sys.derived.bodyIndex.used, 2);
    assert.equal(sys.derived.magic, 4);                  // min(5, ceil 4.3 = 5) - floor(2 * 0.5)
  });
});

describe("v0.21.0 combat fixes", () => {
  test("full defense adds Quickness dice to a dodge", async () => {
    chat.length = 0;
    const def = makeActor(A);                                  // Quickness 6
    faces.push(5, 5, 5, 1, 1, 1);
    await def.defend({ attackerUuid: "Actor.a", targetUuid: def.uuid, weaponName: "Gun", melee: false,
      damageType: "physical", power: 9, level: "M", attackSuccesses: 2, targetNumber: 5 }, 0, { fullDefense: true });
    assert.match(chat.at(-1).content, /Full defense \(\+6 dice\)/);
    assert.match(chat.at(-1).content, /6 dice vs TN/);
    assert.match(chat.at(-1).content, /Missed/);               // 3 defense successes beat 2
  });

  test("subduing deals stun; barriers shot through add to armor; attacker reach lowers the attack TN", async () => {
    chat.length = 0;
    const atk = makeActor(A);
    atk.items = [{ type: "skill", name: "Clubs", system: { rating: 3, attribute: "strength" } }];
    faces.push(5, 5, 5);
    const r = await atk.attackWith({ name: "Staff", system: { melee: true, skill: "Clubs", damagePower: 2, damageLevel: "M", damageType: "physical", reach: 2, strengthPower: true } }, { targetUuid: "Actor.t", subdue: true, targetReach: 0 });
    assert.equal(r.targetNumber, 2);                           // 4 − reach 2
    assert.equal(chat.at(-1).flags.sr2e.attack.damageType, "stun");
    chat.length = 0;
    const t = makeActor(A);
    t.items = [{ type: "armor", system: { worn: true, ballistic: 2, impact: 1 } }];
    faces.push(1, 1, 1, 1, 1);
    await t.resistFromState({ targetUuid: "x", melee: false, damageType: "physical", power: 10, level: "M", extraArmor: 4 }, 0);
    assert.match(chat.at(-1).content, /vs TN <strong>4<\/strong>/);   // 10 − (2 + 4)
  });

  test("a gyro mount cancels recoil", async (t) => {
    t.after(oldWay({ 'DOCS_V79.rangedRecoil': 'freeFirst' })); // v0.79.0: the old recoil count (a house rule)
    chat.length = 0;
    const a = makeActor(A);
    a.items = [{ type: "skill", name: "Rifles", system: { rating: 3, attribute: "quickness" } }];
    faces.push(2, 2, 2);
    const r = await a.attackWith({ name: "HMG", update: async (_d?: any) => {}, system: { melee: false, skill: "Rifles", damagePower: 10, damageLevel: "S", damageType: "physical", modes: "BF", ammo: 0, ammoMax: 0, recoilComp: 0, heavy: true, gyro: 3 } }, { range: "short", mode: "BF", earlierRoundsThisPhase: 0 });
    assert.equal(r.targetNumber, 4 + 4 - 3);                   // heavy recoil 4, gyro −3
  });

  test("armor heavier than Quickness lowers Quickness and the Combat Pool", (t) => {
    t.after(oldWay({ "GEAR_V923.armorEncumbrance": "old" })); // v0.92.3: the old way (v0.92.2); __tests__/v0923-gear.test.ts has the book's
    const sys = Object.create(CharacterDataModel.prototype);
    sys.attributes = Object.fromEntries(Object.entries(A).map(([k, v]) => [k, { base: v, mod: 0 }]));
    Object.assign(sys, { essence: 6, magic: 0, reactionBonus: 0, initiativeDiceBonus: 0, poolSpent: { combat: 0, spell: 0 }, monitor: { physical: 0, stun: 0 } });
    sys.parent = { items: [{ type: "armor", name: "Hardened", system: { worn: true, ballistic: 8, impact: 5 } }] };
    sys.prepareDerivedData();
    assert.equal(sys.derived.encumbrance, 2);                  // 8 − Quickness 6
    assert.equal(sys.attributes.quickness.total, 4);
    assert.equal(sys.derived.combatPool, 6);                   // (4 + 4 + 4) / 2
  });

  test("flash grenades blind instead of damaging; confined blasts add Power", async (t) => {
    t.after(oldWay({"BOOK_V78.flash.mode": "blind"})); // v0.78.0: the old rule (a house rule)
    chat.length = 0;
    const a = makeActor(A);
    const victim = makeActor(A);
    let blinded = false;
    (victim as any).toggleStatusEffect = async (id: string) => { if (id === "blind") blinded = true; };
    uuidRegistry.set(victim.uuid, victim);
    await a.postBlast({ attackerUuid: a.uuid, weaponName: "Flashbang", power: 8, level: "M", damageType: "stun", perMetre: 1, point: { x: 0, y: 0, elevation: 0 }, dodge: false, kind: "flash" },
      [{ targetUuid: victim.uuid, name: "V", metres: 2 }], "On target.");
    assert.equal(blinded, true);
    assert.match(chat.at(-1).content, /V: blinded/);
    chat.length = 0;
    await a.postBlast({ attackerUuid: a.uuid, weaponName: "Grenade", power: 10, level: "S", damageType: "physical", perMetre: 1, point: { x: 0, y: 0, elevation: 0 }, dodge: false, kind: "offensive" },
      [{ targetUuid: "Actor.z", name: "Z", metres: 3 }], "On target.", 4);
    assert.equal(chat.at(-1).flags.sr2e.damages[0].power, 11);  // 10 − 3 + 4
    assert.match(chat.at(-1).content, /Confined space: \+4 Power/);
  });

  test("wasted walking-fire rounds use ammo and add recoil, not damage", async () => {
    chat.length = 0;
    const a = makeActor(A);
    a.items = [{ type: "skill", name: "Rifles", system: { rating: 3, attribute: "quickness" } }];
    const gun: any = { name: "SMG", system: { melee: false, skill: "Rifles", damagePower: 6, damageLevel: "M", damageType: "physical", modes: "FA", ammo: 30, ammoMax: 30, recoilComp: 0 } };
    gun.update = async (d: any) => { gun.system.ammo = d["system.ammo"]; };
    faces.push(2, 2, 2);
    const r = await a.attackWith(gun, { range: "short", mode: "FA", rounds: 3, wastedRounds: 2, earlierRoundsThisPhase: 3 });
    assert.equal(gun.system.ammo, 25);
    assert.equal(r.targetNumber, 4 + (3 + 3 + 2 - 1));          // recoil counts the earlier 3, the 2 wasted and these 3
    assert.match(chat.at(-1).content, /FA ×3/);
    assert.match(chat.at(-1).content, /9S/);                     // 6 + 3 rounds, one stage; the wasted ones add nothing
    assert.match(chat.at(-1).content, /2 rounds wasted walking fire/);
  });
});

describe("v0.22.0 core rules", () => {
  const troll = () => {
    const sys = Object.create(CharacterDataModel.prototype);
    sys.attributes = Object.fromEntries(Object.entries({ body: 6, quickness: 4, strength: 6, charisma: 2, intelligence: 3, willpower: 3 }).map(([k, v]) => [k, { base: v, mod: 0 }]));
    Object.assign(sys, { essence: 6, magic: 0, reactionBonus: 0, initiativeDiceBonus: 0, poolSpent: { combat: 0, spell: 0 }, monitor: { physical: 0, stun: 0 }, metatype: "troll", racialModifiers: true });
    sys.parent = { items: [] };
    sys.prepareDerivedData();
    return sys;
  };

  test("metatypes: racial modifiers, vision, reach, dermal armor and limit warnings", () => {
    const sys = troll();
    assert.equal(sys.attributes.body.total, 11);
    assert.equal(sys.attributes.charisma.total, 1);   // v0.73.0 (O34): base 2 − 2 floors at 1, with a warning
    assert.equal(sys.derived.vision.thermographic, true);
    assert.equal(sys.derived.reachBonus, 1);
    assert.deepEqual({ ...sys.derived.cyberArmor }, { ballistic: 1, impact: 1 });
    assert.equal(sys.derived.metatype, "Troll");
    assert.equal(sys.derived.attributeWarnings.length, 1);
    assert.match(sys.derived.attributeWarnings[0], /Charisma/);
    sys.attributes.strength.base = 8;                 // 8 + 4 = 12 > natural max 10
    sys.prepareDerivedData();
    assert.ok(sys.derived.attributeWarnings.some((w: string) => /Strength 12 is above the natural maximum 10/.test(w)));
    sys.racialModifiers = false;
    sys.prepareDerivedData();
    assert.equal(sys.attributes.body.total, 6);        // base already includes the racial modifiers
  });

  test("first aid: Biotech vs the wound's TN, capped at half, once per wound, stabilises the dying", async (t) => {
    // v0.92.3: the old first aid too (boxes, once per wound, no self-stabilisation; the book's: v0923-health.test.ts).
    t.after(oldWay({ 'HEALING.firstAid.tnByLevel': { L: 2, M: 4, S: 6, D: 8 }, 'DOCS_V79.firstAidMods': 'medkitDice', 'HEALTH_V923.firstAid': 'boxes', 'HEALTH_V923.firstAidRetry': 'once', 'HEALTH_V923.selfStabilise': 'none' }));
    chat.length = 0;
    const medic = makeActor(A);
    medic.items = [{ id: "s1", type: "skill", name: "Biotech", system: { rating: 4, attribute: "intelligence" } }, { id: "k1", type: "gear", name: "Medkit", system: { medkitRating: 2 } }];
    const patient = makeActor(A, { monitor: { physical: 6, stun: 0 } });
    uuidRegistry.set(patient.uuid, patient);
    faces.push(6, 6, 6, 1, 1, 1, 1, 1, 1);                // 6 dice (4 + medkit 2) vs TN 6: three 6s explode to 7
    const r = await medic.firstAid(patient, { track: "physical", medkitId: "k1" });
    assert.match(chat.at(-1).content, /First aid on/);
    assert.match(chat.at(-1).content, /6 dice vs TN <strong>6<\/strong>/);
    assert.ok(r.successes >= 3);
    assert.equal(patient.system.monitor.physical, 3);    // at most half of 6
    assert.equal(await medic.firstAid(patient, { track: "physical" }), null);   // the same wound again
    assert.match(warnings.at(-1) ?? "", /already had first aid/);

    const dying = makeActor(A, { monitor: { physical: 10, stun: 0 }, care: { stabilised: false, dyingSince: 0 } });
    uuidRegistry.set(dying.uuid, dying);
    faces.push(6, 2, 1, 1, 2);                            // TN 8 (Deadly): 6 + 2 = 8 is one success
    await medic.firstAid(dying, { track: "physical" });
    assert.equal(dying.system.monitor.physical, 9);        // one box healed: no longer dying
    assert.match(chat.at(-1).content, /is stabilised/);
    const failed = makeActor(A, { monitor: { physical: 3, stun: 0 } });
    uuidRegistry.set(failed.uuid, failed);
    faces.push(1, 1, 1, 1);
    await medic.firstAid(failed, { track: "physical" });
    assert.equal(await medic.firstAid(failed, { track: "physical" }), null);   // a failed attempt uses it up too
  });

  test("natural healing: hours per box from Body successes, no wound modifiers", async () => {
    chat.length = 0;
    const a = makeActor(A, { monitor: { physical: 0, stun: 4 } });
    uuidRegistry.set(a.uuid, a);
    faces.push(5, 5, 1, 1, 1);                            // Body 5 vs TN 4 (Moderate): 2 successes = 0.5 h per box
    await a.naturalHeal({ track: "stun", hours: 1, care: "none" });
    assert.equal(a.system.monitor.stun, 2);
    assert.match(chat.at(-1).content, /0.5 h per box/);
  });

  test("unconscious characters cannot attack and defend with no dice", async () => {
    chat.length = 0;
    const a = makeActor(A, { monitor: { physical: 0, stun: 10 } });
    assert.equal(a.system.derived.status, "unconscious");
    assert.equal(await a.attackWith({ name: "Gun", system: { melee: false, skill: "", damagePower: 6, damageLevel: "M", damageType: "physical", modes: "", ammo: 0, ammoMax: 0 } }, {}), null);
    assert.match(warnings.at(-1) ?? "", /is unconscious and cannot/);
    await a.defend({ attackerUuid: "x", targetUuid: a.uuid, weaponName: "Gun", melee: false, damageType: "physical", power: 6, level: "M", attackSuccesses: 1, targetNumber: 4 }, 3);
    assert.match(chat.at(-1).content, /Defenseless \(unconscious\)/);
    assert.match(chat.at(-1).content, /0 dice vs TN/);
  });

  test("combat: incapacitated and surprised combatants are skipped; ties go to Reaction", async () => {
    const mk = (id: string, init: number, react: number, status = "ok") => ({ id, name: id, initiative: init, actor: { system: { derived: { status, reaction: react }, attributes: { quickness: { total: 3 } } } } });
    const combat = new SR2Combat();
    const turns = [mk("a", 10, 4), mk("b", 10, 6), mk("c", 12, 1, "unconscious")];
    assert.ok(combat._sortCombatants(turns[1], turns[0]) < 0);   // b (Reaction 6) before a
    (Object.getPrototypeOf(SR2Combat.prototype) as any).setupTurns = function () { return [...turns].sort((x, y) => this._sortCombatants(x, y)); };
    combat.flags = { surprise: { round: 1, ids: ["a"] } };
    (combat as any).round = 1;
    const active = combat.setupTurns();
    assert.deepEqual(active.map((c: any) => c.id), ["b"]);
  });

  test("migrations: pending versions", async () => {
    const { pendingMigrations, compareVersions } = await import("../migrations.ts");
    assert.ok(compareVersions("0.22.0", "0.21.9") > 0);
    assert.deepEqual(pendingMigrations("0.21.0", [{ version: "0.22.0" }, { version: "0.23.0" }]), ["0.22.0", "0.23.0"]);
    assert.deepEqual(pendingMigrations("0.22.0", [{ version: "0.22.0" }, { version: "0.23.0" }]), ["0.23.0"]);
  });
});

describe("v0.23.0 sheets and prompts", () => {
  test("the Attack dialog preview gives the same TN and dice as the roll", async () => {
    chat.length = 0;
    const a = makeActor(A, { monitor: { physical: 3, stun: 0 } });       // wounds +2
    a.items = [{ type: "skill", name: "Rifles", system: { rating: 4, attribute: "quickness" } }];
    const gun: any = { name: "AK", update: async () => {}, system: { melee: false, skill: "Rifles", damagePower: 8, damageLevel: "M", damageType: "physical", modes: "SA/BF", ammo: 30, ammoMax: 30, recoilComp: 0, heavy: true } };
    const opts = { range: "medium", mode: "BF", earlierRoundsThisPhase: 0, situational: ["partialCover"], calledShot: "damage", poolDice: 3, modifiers: [{ label: "Smoke", value: 4 }] };
    const pv = a.previewAttack(gun, opts);
    faces.push(1, 1, 1, 1, 1, 1, 1);
    const r = await a.attackWith(gun, opts);
    assert.equal(pv.tn, r.targetNumber);
    assert.equal(pv.dice + pv.pool, r.totalDice);
    assert.equal(pv.level, "D");                                        // BF stage + called shot stage: M → S → D
    assert.ok(pv.modifiers.some((m: any) => m.label === "Wounds"));
  });

  test("the preview warns when the magazine is short", () => {
    const a = makeActor(A);
    const gun: any = { name: "SMG", system: { melee: false, skill: "", damagePower: 6, damageLevel: "M", damageType: "physical", modes: "FA", ammo: 2, ammoMax: 30, recoilComp: 0 } };
    assert.match(a.previewAttack(gun, { mode: "FA", fullAutoRounds: 5 }).ammoShort, /2 rounds left, 5 needed/);
  });

  test("v0.59.0: Apply (GM) actions are found on a card and skipped once applied", async () => {
    const { pendingGmApplies, GM_APPLY_ACTIONS } = await import("../applications/chat.ts");
    const card = '<p><button type="button" data-sr2e-action="applyHost">Apply (GM)</button> <button data-sr2e-action="applyTally">x</button></p>';
    assert.deepEqual(pendingGmApplies(card, () => false), ["applyHost", "applyTally"]);
    assert.deepEqual(pendingGmApplies(card, (f) => f === "hostApplied"), ["applyTally"]);
    assert.deepEqual(pendingGmApplies("<p>nothing</p>", () => false), []);
    assert.equal(GM_APPLY_ACTIONS["applySurgery"], "surgeryApplied");
  });

  test("v0.59.0 review: only bounded Apply (GM) changes go through by themselves", async () => {
    const { safeAutoApply } = await import("../applications/chat.ts");
    // v0.81.0: the author binding came in (the card's author owns the actor the change comes from); here they do.
    const t = { authorIsGm: false, owns: () => true };
    const src = { sourceUuid: "Actor.me" };
    // v0.81.1 round 2 (FIX2-BRIEF B): a tally, a site or a host change never applies by itself.
    assert.equal(safeAutoApply("applyTally", { tally: { hostUuid: "Actor.h", successes: 3, ...src } }, t), false);
    assert.equal(safeAutoApply("applyTally", { tally: { hostUuid: "Actor.h", successes: 9999, ...src } }, t), false);
    assert.equal(safeAutoApply("applyActorUpdate", { actorUpdate: { uuid: "Actor.n", monitor: { track: "physical", boxes: -2 }, ...src } }, t), true);
    // Ownership or any other free-form change waits for the GM's click.
    assert.equal(safeAutoApply("applyActorUpdate", { actorUpdate: { uuid: "Actor.n", update: { ownership: { p1: 3 } } } }, t), false);
    assert.equal(safeAutoApply("applyActorUpdate", { actorUpdate: { uuid: "Actor.n", update: {}, monitor: { track: "stun", boxes: 1 } } }, t), false);
    for (const a of ["applySurgery", "applyPowerEffect", "applyPossession", "somethingElse"]) assert.equal(safeAutoApply(a, {}, t), false, a);
    assert.equal(safeAutoApply("applySite", { siteChange: { siteUuid: "Actor.s", add: 2, ...src } }, t), false);
    assert.equal(safeAutoApply("applySite", { siteChange: {} }, t), false);
  });

  test("prompts go to an active owning player, else the active GM", async () => {
    const { promptRecipients } = await import("../applications/chat.ts");
    const target = { testUserPermission: (u: any) => u.owns };
    const users = [{ id: "gm", isGM: true, active: true, owns: true }, { id: "p1", isGM: false, active: true, owns: true }, { id: "p2", isGM: false, active: false, owns: true }, { id: "p3", isGM: false, active: true, owns: false }];
    assert.deepEqual(promptRecipients(target, users, "gm"), ["p1"]);
    assert.deepEqual(promptRecipients(target, users.filter((u) => u.id !== "p1"), "gm"), ["gm"]);
    assert.deepEqual(promptRecipients(target, [], null), []);
  });
});

describe("v0.24.0 vehicles and rigging", () => {
  useV922Vehicles(); // v0.92.3: these pin the v0.92.2 vehicle rules
  let VehicleDataModel: any;
  const R = { body: 4, quickness: 5, strength: 3, charisma: 3, intelligence: 5, willpower: 5 };
  const withGet = (list: any[]) => Object.assign(list, { get(id: string) { return list.find((i: any) => i.id === id); } });
  const rigger = (vcr = 2, extra: any = {}) => {
    const a = makeActor(R, { poolSpent: { combat: 0, spell: 0, hacking: 0, control: 0 }, rigging: { vehicleUuid: "", jumpedIn: false }, ...extra });
    a.name = extra.name ?? "Rigger"; a.type = "character";
    a.items = withGet([
      { id: "car", type: "skill", name: "Car", system: { rating: 5, attribute: "quickness", specialization: "", specializationRating: 0 } },
      ...(vcr ? [{ id: "vcr", type: "cyberware", name: "Control rig", system: { installed: true, essenceCost: 2, grade: "standard", attributes: {}, reaction: 0, initiativeDice: 0, controlRig: vcr } }] : []),
      { id: "wr", type: "cyberware", name: "Wired reflexes", system: { installed: true, essenceCost: 2, grade: "standard", attributes: {}, reaction: 2, initiativeDice: 1 } },
    ]);
    a.system.parent = a; a.system.prepareDerivedData();
    uuidRegistry.set(a.uuid, a);
    return a;
  };
  const vehicle = (extra: any = {}) => {
    const v = new SR2Actor();
    const sys = Object.create(VehicleDataModel.prototype);
    Object.assign(sys, { category: "car", skill: "", drone: false, handling: 4, handlingOffroad: 8, speed: 90, accel: 10, body: 4, armor: 3, signature: 2, autonav: 2, pilot: 0, sensor: 1,
      condition: 0, currentSpeed: 60, offroad: false, controllerUuid: "", controlMode: "autopilot", occupants: [], ...extra });
    sys.prepareDerivedData();
    Object.assign(v, { type: "vehicle", name: extra.name ?? "Americar", uuid: `Actor.veh${(vehicle as any).n = ((vehicle as any).n ?? 0) + 1}`, system: sys, items: withGet([]) });
    uuidRegistry.set(v.uuid, v);
    return v;
  };
  before(async () => {
    ({ VehicleDataModel } = await import("../models/index.ts"));
    g.fromUuidSync = (u: string) => uuidRegistry.get(u) ?? null;
  });

  test("a control rig gives rigged Reaction, initiative and a Control Pool usable only jumped in", () => {
    const a = rigger(2);
    const r = a.system.derived.rigging;
    assert.equal(a.system.derived.reaction, 7);                         // 5 + wired reflexes 2
    assert.deepEqual({ vcr: r.vcr, reaction: r.reaction, dice: r.initiativeDice, jumped: r.jumpedIn }, { vcr: 2, reaction: 9, dice: 3, jumped: false });
    assert.equal(a.system.derived.controlPool, 9);
    assert.equal(a.system.derived.controlPoolLeft, 0);
    assert.equal(makeActor(R).system.derived.rigging, null);
    const v = vehicle();
    assert.deepEqual({ r: v.system.derived.reaction, d: v.system.derived.initiativeDice, skill: v.system.derived.skill }, { r: 4, d: 1, skill: "Car" });
  });

  test("taking the controls links driver and vehicle; jumping in needs a control rig; one vehicle at a time", async () => {
    chat.length = 0; warnings.length = 0;
    const v = vehicle();
    const plain = rigger(0, { name: "Driver" });
    assert.equal(await plain.takeControl(v, "jumped"), false);
    assert.match(warnings.at(-1) ?? "", /no control rig/);
    assert.equal(await plain.takeControl(v, "manual"), true);
    assert.deepEqual({ c: v.system.controllerUuid, m: v.system.controlMode, r: plain.system.rigging.vehicleUuid }, { c: plain.uuid, m: "manual", r: v.uuid });
    const a = rigger(2);
    v.system.occupants.push(a.uuid); await a.takeControl(v, "jumped");
    assert.equal(plain.system.rigging.vehicleUuid, "");                 // the previous driver is let go
    assert.equal(a.system.rigging.jumpedIn, true);
    assert.equal(a.system.derived.controlPoolLeft, 9);
    assert.match(chat.at(-1).content, /Rigger<\/strong> jumps into <strong>Americar/);
    const v2 = vehicle({ name: "Bulldog" });
    await a.takeControl(v2, "manual");
    assert.deepEqual({ c: v.system.controllerUuid, m: v.system.controlMode }, { c: "", m: "autopilot" });
    await a.releaseVehicle();
    assert.equal(v2.system.controllerUuid, "");
    assert.equal(a.system.rigging.vehicleUuid, "");
    assert.match(chat.at(-1).content, /lets go of <strong>Bulldog/);
  });

  test("v0.59.0: a hand-driven vehicle rolls its driver's initiative and takes no turns while its driver is in the combat", async () => {
    const v = vehicle();
    const d = rigger(0, { name: "Driver" });
    await d.takeControl(v, "manual");
    const c = new SR2Combatant(); (c as any).actor = v;
    assert.equal(c.getInitiativeRoll().formula, `${d.system.derived.initiativeDice}d6 + ${d.system.derived.reaction}`);
    const cv = { id: "v", actor: v }, cd = { id: "d", actor: d };
    assert.equal(SR2Combat.drivenByCombatant(cv, [cv, cd]), true);
    assert.equal(SR2Combat.drivenByCombatant(cv, [cv]), false);         // driver not in the fight: the vehicle acts
    assert.equal(SR2Combat.canTakeTurns(cv, [cv, cd]), false);
    await d.releaseVehicle();
    assert.equal(SR2Combat.drivenByCombatant(cv, [cv, cd]), false);     // autopilot: it acts on its own
  });

  test("v0.59.0: a jumped-in rigger who goes unconscious is dumped out with the rigger's dump shock", async () => {
    chat.length = 0;
    const v = vehicle();
    const a = rigger(2);
    v.system.occupants.push(a.uuid);
    await a.takeControl(v, "jumped");
    a.system.monitor.stun = RULES.MONITOR_BOXES; a.system.prepareDerivedData();
    await a.syncCondition("ok", { physical: false, stun: true });
    assert.equal(a.system.rigging.vehicleUuid, "");
    assert.equal(v.system.controlMode, "autopilot");
    const card = chat.find((m: any) => m.flags?.sr2e?.riggerShock);
    assert.ok(card);
    assert.match(card.content, /dumped out of <strong>Americar/);
    assert.equal(card.flags.sr2e.riggerShock.kind, "dump");
    a.system.monitor.stun = 0; a.system.prepareDerivedData();
  });

  test("driving tests: skill vs Handling and modifiers; Reaction at +4 without the skill; jumped in uses the Control Pool and the rig", async () => {
    chat.length = 0;
    const v = vehicle({ condition: 3 });
    const a = rigger(2);
    await a.takeControl(v, "manual");
    faces.push(5, 5, 1, 1, 1);
    let r = await a.driveTest({ terrain: "tight", situational: ["hard"] });
    assert.equal(r.targetNumber, 11);                                  // 4 + 3 tight + 2 hard + 2 damage
    assert.equal(r.totalDice, 5);
    assert.match(chat.at(-1).content, /Americar: Driving test \(manual, Handling 4\)/);
    v.system.occupants.push(a.uuid); await a.takeControl(v, "jumped");
    faces.push(5, 5, 5, 5, 1, 1, 1, 1);
    r = await a.driveTest({ offroad: true, poolDice: 3 });
    assert.equal(r.targetNumber, 8);                                   // off-road 8 + damage 2 − rig 2
    assert.equal(r.totalDice, 8);
    assert.equal(a.system.poolSpent.control, 3);
    assert.match(chat.at(-1).content, /jumped in, Handling 8 off-road/);
    const b = rigger(0, { name: "Novice" });
    b.items = withGet([]); b.system.prepareDerivedData();
    const v2 = vehicle({ name: "Scooter" });
    await b.takeControl(v2, "manual");
    faces.push(1, 1, 1, 1, 1);
    r = await b.driveTest();
    assert.equal(r.totalDice, 5);                                      // Reaction 5
    assert.equal(r.targetNumber, 8);                                   // 4 + defaulting 4
    assert.match(chat.at(-1).content, /no Car skill: Reaction/);
    assert.equal(await b.driveTest({ vehicle: v }), null);             // not at its controls
  });

  test("autopilot rolls Autonav; a vehicle with a driver hands the test to them; no rating refuses", async () => {
    chat.length = 0; warnings.length = 0;
    const v = vehicle();
    faces.push(5, 5);
    const r = await v.driveTest({ terrain: "open" });
    assert.equal(r.totalDice, 2);
    assert.equal(r.targetNumber, 3);
    assert.match(chat.at(-1).content, /autopilot, Handling 4\) \(Autonav 2\)/);
    const drone = vehicle({ name: "Doberman", drone: true, pilot: 3, autonav: 0 });
    faces.push(1, 1, 1);
    assert.equal((await drone.driveTest()).totalDice, 3);
    const a = rigger(2);
    await a.takeControl(v, "manual");
    faces.push(1, 1, 1, 1, 1);
    await v.driveTest();
    assert.match(chat.at(-1).content, /manual, Handling 4\)/);
    assert.equal(await vehicle({ autonav: 0 }).driveTest(), null);
    assert.match(warnings.at(-1) ?? "", /no Autonav rating/);
  });

  test("a failed crash test crashes: the vehicle and everyone aboard resist crash damage", async () => {
    chat.length = 0;
    const v = vehicle({ currentSpeed: 95 });
    const a = rigger(2);
    const p = makeActor(R); p.name = "Passenger"; uuidRegistry.set(p.uuid, p);
    v.system.occupants = [p.uuid];
    await a.takeControl(v, "manual");
    faces.push(1, 1, 1, 1, 1);
    await a.driveTest({ crashTest: true });
    assert.match(chat.at(-1).content, /Crash!/);
    assert.deepEqual(chat.at(-1).flags.sr2e.crash, { vehicleUuid: v.uuid, speed: 95 });
    await v.crash(95);
    const d = chat.at(-1).flags.sr2e.damages;
    assert.equal(d.length, 3);                                          // vehicle, passenger, the driver
    assert.deepEqual({ p: d[0].power, l: d[0].level, crash: d[0].crash, ia: d[0].ignoreArmor }, { p: 9, l: "S", crash: true, ia: true });
    assert.deepEqual({ p: d[1].power, l: d[1].level, k: d[1].armorKind }, { p: 9, l: "M", k: "impact" });
    faces.push(5, 5, 1, 1);                                             // Body 4 vs 9: none
    await v.resistFromState(d[0]);
    assert.equal(v.system.condition, 6);
  });

  test("attacks on a vehicle: normal weapons reduced, armor stops weak hits, anti-vehicle hits mark the track; feedback and dump shock", async () => {
    chat.length = 0;
    const v = vehicle({ armor: 3, body: 4 });
    const a = rigger(2);
    a.items.push({ id: "rcd", type: "gear", name: "RCD", system: { rcdRating: 1 } }); a.system.prepareDerivedData();
    await a.takeControl(v, "jumped");
    const stopped = { targetUuid: v.uuid, melee: false, damageType: "physical", power: 6, level: "M" };
    await v.resistFromState(stopped);
    assert.match(chat.at(-1).content, /No damage<\/strong> \(not anti-vehicle; armor 3 stops Power 3\)/);
    assert.equal(v.system.condition, 0);
    faces.push(1, 1, 1, 1);                                             // AV 10M: Body 4 vs 7
    await v.resistFromState({ ...stopped, power: 10, antiVehicle: true });
    assert.equal(v.system.condition, 3);
    assert.match(chat.at(-2).content, /resists 10M \(Body 4, armor 3\)/);
    assert.match(chat.at(-1).content, /data-sr2e-action="riggerShock"/);
    assert.deepEqual({ ...chat.at(-1).flags.sr2e.riggerShock, riggerUuid: 0 }, { riggerUuid: 0, riggerName: "Rigger", tn: 10, level: "M", type: "stun", kind: "feedback" });
    faces.push(1, 1, 1, 1, 1);
    await a.rollRiggerShock(chat.at(-1).flags.sr2e.riggerShock);
    assert.equal(a.system.monitor.stun, 3);
    faces.push(1, 1, 1, 1);
    await v.resistFromState({ ...stopped, power: 12, level: "D", antiVehicle: true });
    assert.equal(v.system.condition, 10);
    assert.equal(v.system.derived.status, "destroyed");
    assert.match(chat.at(-2).content, /Destroyed!/);
    assert.equal(chat.at(-1).flags.sr2e.riggerShock.kind, "dump");
    assert.equal(a.system.rigging.jumpedIn, false);
    assert.equal(v.system.controllerUuid, "");
    assert.equal(await a.driveTest({ vehicle: v }), null);
  });

  test("a vehicle dodges only with its jumped-in rigger's Control Pool", async () => {
    chat.length = 0;
    const v = vehicle();
    const atk = { attackerUuid: "x", targetUuid: v.uuid, weaponName: "Gun", melee: false, damageType: "physical", power: 8, level: "M", attackSuccesses: 2, targetNumber: 4, antiVehicle: true };
    await v.defend(atk, 3);
    assert.match(chat.at(-1).content, /Defense \(no Control Pool dice\)/);
    assert.equal(chat.at(-1).flags.sr2e.damage.antiVehicle, true);
    const a = rigger(2);
    v.system.occupants.push(a.uuid); await a.takeControl(v, "jumped");
    faces.push(5, 5, 5);
    // v0.71.0 (R5): the pool alone is the old way (riggerDodge 'pool'); the new default adds a driving test.
    RULES.FIXES_V71.riggerDodge = "pool";
    try { await v.defend(atk, 3); } finally { RULES.FIXES_V71.riggerDodge = "skill"; }
    assert.equal(a.system.poolSpent.control, 3);
    assert.match(chat.at(-1).content, /Evasive driving \(Rigger, Control Pool\)/);
    assert.match(chat.at(-1).content, /Missed/);
  });

  test("initiative: jumped-in riggers and the vehicles they ride; autopilots; pools refresh", async () => {
    const v = vehicle();
    const a = rigger(2);
    const c = new SR2Combatant();
    c.actor = v;
    assert.equal(c.getInitiativeRoll().formula, "1d6 + 4");
    c.actor = a;
    assert.equal(c.getInitiativeRoll().formula, "2d6 + 7");            // wired reflexes, not rigged
    v.system.occupants.push(a.uuid); await a.takeControl(v, "jumped");
    assert.equal(c.getInitiativeRoll().formula, "3d6 + 9");
    c.actor = v;
    assert.equal(c.getInitiativeRoll().formula, "3d6 + 9");
    await a.update({ "system.poolSpent.control": 4 });
    await a.refreshPools();
    assert.equal(a.system.poolSpent.control, 0);
  });
});

describe("v0.25.0 vehicle combat, sensors, remote decks, chases", () => {
  useV922Vehicles(); // v0.92.3: these pin the v0.92.2 vehicle rules
  let VehicleDataModel: any;
  const R = { body: 4, quickness: 5, strength: 3, charisma: 3, intelligence: 5, willpower: 5 };
  const withGet = (list: any[]) => Object.assign(list, { get(id: string) { return list.find((i: any) => i.id === id); } });
  const person = (name: string, items: any[] = [], extra: any = {}) => {
    const a = makeActor(R, { poolSpent: { combat: 0, spell: 0, hacking: 0, control: 0 }, rigging: { vehicleUuid: "", jumpedIn: false, subscribed: [] }, ...extra });
    a.name = name; a.type = "character"; a.items = withGet(items);
    a.system.parent = a; a.system.prepareDerivedData();
    uuidRegistry.set(a.uuid, a);
    return a;
  };
  const rigItems = () => [
    { id: "gun", type: "skill", name: "Gunnery", system: { rating: 6, attribute: "intelligence" } },
    { id: "car", type: "skill", name: "Car", system: { rating: 5, attribute: "quickness" } },
    { id: "vcr", type: "cyberware", name: "Control rig", system: { installed: true, essenceCost: 2, grade: "standard", attributes: {}, reaction: 0, initiativeDice: 0, controlRig: 1 } },
  ];
  const veh = (name: string, extra: any = {}, weapons: any[] = []) => {
    const v = new SR2Actor();
    const sys = Object.create(VehicleDataModel.prototype);
    Object.assign(sys, { category: "car", skill: "", drone: false, handling: 4, handlingOffroad: 0, speed: 100, accel: 10, body: 4, armor: 4, signature: 3, autonav: 2, pilot: 0, sensor: 4,
      ecm: 0, eccm: 0, ecd: 0, locks: [], chase: { quarryUuid: "", metres: 0 }, condition: 0, currentSpeed: 0, offroad: false, controllerUuid: "", controlMode: "autopilot", occupants: [], ...extra });
    sys.prepareDerivedData();
    Object.assign(v, { type: "vehicle", name, uuid: `Actor.v25${(veh as any).n = ((veh as any).n ?? 0) + 1}`, system: sys, items: withGet(weapons) });
    uuidRegistry.set(v.uuid, v);
    return v;
  };
  const mg = (mount: string, extra: any = {}) => ({ id: `w${mount}`, name: `MG (${mount})`, type: "weapon", update: async () => {}, system: { melee: false, skill: "", mount, damagePower: 7, damageLevel: "S", damageType: "physical", modes: "SA/BF/FA", ammo: 0, ammoMax: 0, recoilComp: 0, antiVehicle: false, ...extra } });
  before(async () => {
    ({ VehicleDataModel } = await import("../models/index.ts"));
    g.fromUuidSync = (u: string) => uuidRegistry.get(u) ?? null;
  });

  test("mounted weapons: Gunnery, Control Pool when jumped in, half recoil on a turret; who may fire which mount", async (t) => {
    t.after(oldWay({ 'DOCS_V79.rangedRecoil': 'freeFirst' })); // v0.79.0: the old recoil count (a house rule)
    chat.length = 0; warnings.length = 0;
    const v = veh("Bulldog", {}, [mg("turret"), mg("pintle"), mg("fixed")]);
    const rig = person("Rigger", rigItems());
    const gunner = person("Gunner", [{ id: "g", type: "skill", name: "Gunnery", system: { rating: 3, attribute: "intelligence" } }]);
    v.system.occupants = [rig.uuid, gunner.uuid];
    await rig.takeControl(v, "jumped");
    faces.push(5, 5, 5, 1, 1, 1, 1, 1, 1);
    const r = await rig.fireMounted(v, v.items.get("wturret"), { range: "short", mode: "BF", poolDice: 3, earlierRoundsThisPhase: 0 });
    assert.equal(r.totalDice, 9);                                      // Gunnery 6 + 3 Control Pool
    assert.equal(r.targetNumber, 4);                                   // short range, burst recoil 2 halved on a turret (v0.79.0, DOCS_V79.vehMountRecoil); v0.73.0 (O26): control rig −1
    assert.equal(rig.system.poolSpent.control, 3);
    assert.match(chat.at(-1).content, /turret mount/);
    assert.equal(await gunner.fireMounted(v, v.items.get("wfixed"), { range: "short" }), null);
    assert.match(warnings.at(-1) ?? "", /cannot be fired by a gunner/);
    assert.equal(await rig.fireMounted(v, v.items.get("wpintle"), { range: "short" }), null);
    faces.push(1, 1, 1);
    const g2 = await gunner.fireMounted(v, v.items.get("wpintle"), { range: "short", mode: "BF", earlierRoundsThisPhase: 0 });
    assert.equal(g2.targetNumber, 4);                                  // v0.79.0: the pintle's 2 points of compensation cancel the burst recoil +2
    const outsider = person("Bystander");
    assert.equal(await outsider.fireMounted(v, v.items.get("wturret"), {}), null);
  });

  test("autopilot fire, moving vehicles, vehicle damage and a sensor lock", async (t) => {
    t.after(oldWay({ "VEHICLES_V57.sensorGunnery": "flat" })); // v0.79.0: the old rule (a house rule)
    chat.length = 0;
    const drone = veh("Doberman", { drone: true, pilot: 3, autonav: 0, currentSpeed: 30, condition: 3 }, [mg("turret")]);
    const target = veh("Target car", { currentSpeed: 40, signature: 3 });
    faces.push(1, 1, 1);
    let r = await drone.fireMounted(drone, drone.items.get("wturret"), { range: "short", targetUuid: target.uuid });
    assert.equal(r.totalDice, 3);
    assert.equal(r.targetNumber, 8);                                   // 4 + moving 1 + damage 2 + target moving 1
    assert.match(chat.at(-1).content, /\(Pilot 3\)/);
    faces.push(5, 5, 1, 1);                                            // Sensor 4 vs Signature 3
    await drone.sensorTest(target.uuid);
    assert.deepEqual(drone.system.locks.map((l: any) => l.targetUuid), [target.uuid]);
    assert.match(chat.at(-1).content, /detected<\/strong> \(2 successes\): sensor lock/);
    faces.push(1, 1, 1);
    r = await drone.fireMounted(drone, drone.items.get("wturret"), { range: "short", targetUuid: target.uuid });
    assert.equal(r.targetNumber, 6);                                   // sensor lock −2
    await drone.clearLocks();
    assert.equal(drone.system.locks.length, 0);
    // A passenger with a pistol in a moving car.
    const car = veh("Ride", { currentSpeed: 70 });
    const p = person("Shooter", [{ id: "s", type: "skill", name: "Pistols", system: { rating: 4, attribute: "quickness" } }]);
    car.system.occupants = [p.uuid];
    g.game.actors = [car, target, drone];
    faces.push(1, 1, 1, 1);
    r = await p.attackWith({ name: "Pistol", system: { melee: false, skill: "Pistols", damagePower: 9, damageLevel: "M", damageType: "physical", modes: "SA", ammo: 0, ammoMax: 0, recoilComp: 0 } }, { range: "short", targetUuid: target.uuid });
    assert.equal(r.targetNumber, 7);                                   // 4 + fast vehicle 2 + target moving 1
    delete g.game.actors;
  });

  test("ECM, ECCM and ECD in a sensor test", async () => {
    chat.length = 0;
    const scanner = veh("Scanner", { sensor: 3, eccm: 1 });
    const stealth = veh("Stealth", { signature: 5, ecm: 3, ecd: 2 });
    faces.push(1, 1, 1);                                              // 3 dice vs 5 + (3 − 1)
    faces.push(5, 1);                                                  // ECD 2 vs 4: noticed
    const r = await scanner.sensorTest(stealth.uuid);
    assert.equal(r.targetNumber, 7);
    assert.match(chat.at(-2).content, /not detected/);
    assert.match(chat.at(-1).content, /Stealth notices the scan/);
  });

  test("a hit on a vehicle carries through to everyone aboard; crashes do not", async () => {
    chat.length = 0;
    const v = veh("Van", { armor: 4, body: 4 });
    const a = person("Rider");
    v.system.occupants = [a.uuid];
    faces.push(1, 1, 1, 1);
    await v.resistFromState({ targetUuid: v.uuid, melee: false, damageType: "physical", power: 12, level: "S", antiVehicle: true });
    assert.equal(v.system.condition, 6);
    const d = chat.at(-1).flags.sr2e.damages;
    assert.deepEqual({ t: d[0].targetUuid, p: d[0].power, l: d[0].level, k: d[0].armorKind }, { t: a.uuid, p: 8, l: "M", k: "impact" });
    chat.length = 0;
    faces.push(1, 1, 1, 1);
    await v.resistFromState({ targetUuid: v.uuid, melee: false, damageType: "physical", power: 9, level: "S", crash: true, ignoreArmor: true });
    assert.equal(chat.length, 1);
  });

  test("ramming: a driving test that the target defends; the rammer takes its share", async () => {
    chat.length = 0;
    const v = veh("Ram truck", { body: 6, currentSpeed: 60, speed: 100 });
    const rig = person("Driver", rigItems());
    const victim = veh("Victim", {});
    await rig.takeControl(v, "manual");
    faces.push(5, 5, 1, 1, 1);
    await rig.ram(victim.uuid);
    const card = chat.at(-1);
    // v0.79.0 (DOCS_V79.vehRamLevel 'speed'): speed 60 is Moderate on the impact table, the rammer at the same level.
    assert.match(card.content, /Ram truck rams Victim \(manual, Handling 4, 12M\)/);
    assert.deepEqual({ p: card.flags.sr2e.attack.power, l: card.flags.sr2e.attack.level, av: card.flags.sr2e.attack.antiVehicle }, { p: 12, l: "M", av: true });
    // v0.73.0 (O25): the rammer's share rides on the attack and is offered after the target's defense.
    assert.deepEqual({ t: card.flags.sr2e.attack.ram.vehicleUuid, p: card.flags.sr2e.attack.ram.power, l: card.flags.sr2e.attack.ram.level }, { t: v.uuid, p: 6, l: "M" });
    assert.equal(card.flags.sr2e.ramSelf, undefined);
    assert.doesNotMatch(card.content, /data-sr2e-action="ramSelf"/);
  });

  test("remote control decks: jumping in from outside needs one; drones subscribe up to capacity and take group commands", async () => {
    chat.length = 0; warnings.length = 0;
    const rig = person("Remote rigger", rigItems());
    const d1 = veh("Drone 1", { drone: true, pilot: 3, autonav: 0 }, [mg("turret")]);
    const d2 = veh("Drone 2", { drone: true, pilot: 2, autonav: 0 }, [mg("fixed")]);
    const d3 = veh("Drone 3", { drone: true, pilot: 2, autonav: 0 });
    assert.equal(await rig.takeControl(d1, "jumped"), false);
    assert.match(warnings.at(-1) ?? "", /no remote control deck/);
    rig.items.push({ id: "rcd", type: "gear", name: "RCD", system: { rcdRating: 1 } });
    rig.system.prepareDerivedData();
    assert.equal(rig.system.derived.rigging.rcdCapacity, 1); // v0.77.0 book check: one drone per rating point
    rig.items.find((i: any) => i.id === "rcd").system.rcdRating = 2; rig.system.prepareDerivedData();
    assert.equal(await rig.takeControl(d1, "jumped"), true);
    assert.match(chat.at(-1).content, /by remote control deck/);
    faces.push(1, 1, 1, 1, 1);
    await rig.driveTest();
    assert.match(chat.at(-1).content, /jumped in, remote/);
    await rig.subscribeDrone(d2); await rig.subscribeDrone(d3);
    assert.equal(rig.system.rigging.subscribed.length, 2);
    await rig.subscribeDrone(d1);
    assert.match(warnings.at(-1) ?? "", /holds 2 drones/);
    await rig.unsubscribeDrone(d3.uuid);
    await rig.subscribeDrone(d1);
    chat.length = 0;
    faces.push(...Array(20).fill(1));
    assert.equal(await rig.groupDrive({ terrain: "open" }), 2);         // d2 autopilot, d1 hands the test to its rigger
    assert.match(chat[0].content, /Drone 2: Driving test \(autopilot/);
    assert.match(chat[1].content, /Drone 1: Driving test \(jumped in, remote/);
    const target = veh("Target", {});
    chat.length = 0;
    assert.equal(await rig.groupAttack(target.uuid), 2);               // each drone fires its own mounted weapon on autopilot
    assert.ok(chat.every((m: any) => /mount, autopilot/.test(m.content)));
    faces.length = 0;
  });

  test("chases: speed drift and positioning move the gap", async () => {
    chat.length = 0; faces.length = 0;
    const p = veh("Pursuer", { currentSpeed: 100, autonav: 3 });
    const q = veh("Quarry", { currentSpeed: 70, autonav: 2 });
    await p.startChase(q, 100);
    assert.equal(SR2Actor.chaseGap(q, p), 100);
    faces.push(5, 5, 1);                                               // pursuer: 3 dice vs 4 − 1 (faster) = 2 successes
    faces.push(1, 1);                                                  // quarry: none
    const r = await p.chaseTurn();
    assert.equal(r.metres, 60);                                        // 100 − 30 drift − 10 positioning
    assert.match(chat.at(-1).content, /Gap <strong>100 → 60 m/);
    await p.endChase();
    assert.equal(p.system.chase.quarryUuid, "");
  });
});

describe("v0.26.0 building security and security rigging", () => {
  useV922Vehicles(); // v0.92.3: these pin the v0.92.2 vehicle rules
  let SiteDataModel: any, VehicleDataModel: any, HostDataModel: any;
  const R = { body: 4, quickness: 5, strength: 3, charisma: 3, intelligence: 5, willpower: 5 };
  const withGet = (list: any[]) => Object.assign(list, { get(id: string) { return list.find((i: any) => i.id === id); } });
  const person = (name: string, items: any[] = []) => {
    const a = makeActor(R, { poolSpent: { combat: 0, spell: 0, hacking: 0, control: 0 }, rigging: { vehicleUuid: "", jumpedIn: false, subscribed: [] } });
    a.name = name; a.type = "character"; a.items = withGet(items);
    a.system.parent = a; a.system.prepareDerivedData();
    uuidRegistry.set(a.uuid, a);
    return a;
  };
  const doors: Record<string, any> = {};
  const site = (extra: any = {}) => {
    const s = new SR2Actor();
    const sys = Object.create(SiteDataModel.prototype);
    Object.assign(sys, {
      devices: [
        { id: "cam", name: "Lobby camera", kind: "camera", rating: 4, tokenUuid: "", sceneId: "", wallId: "", active: true, bypassed: false, notes: "" },
        { id: "lock", name: "Lab maglock", kind: "maglock", rating: 5, tokenUuid: "", sceneId: "sc1", wallId: "w1", active: true, bypassed: false, notes: "" },
        { id: "lock2", name: "Vault maglock", kind: "maglock", rating: 8, tokenUuid: "", sceneId: "sc1", wallId: "w2", active: true, bypassed: false, notes: "" },
      ],
      tally: 0, alert: "none", steps: [{ step: 3, event: "Guards check", alert: "passive" }, { step: 8, event: "Lockdown", alert: "lockdown" }],
      response: { round: -1, worldTime: -1, arrived: false, force: "Guard squad" }, riggerUuid: "", slaved: [], hostUuid: "", ...extra,
    });
    sys.prepareDerivedData();
    Object.assign(s, { type: "site", name: "Ares lab", uuid: `Actor.site${(site as any).n = ((site as any).n ?? 0) + 1}`, system: sys, items: withGet([]) });
    uuidRegistry.set(s.uuid, s);
    return s;
  };
  before(async () => {
    ({ SiteDataModel, VehicleDataModel, HostDataModel } = await import("../models/index.ts"));
    g.fromUuidSync = (u: string) => uuidRegistry.get(u) ?? null;
    g.game.users = [{ id: "gm1", isGM: true }];
    g.game.user = { isGM: true, id: "gm1" };
    const wall = (id: string) => ({ id, ds: 0, async update(d: any) { Object.assign(this, d); } });
    doors.w1 = wall("w1"); doors.w2 = wall("w2");
    g.game.scenes = { get: (id: string) => (id === "sc1" ? { walls: { get: (w: string) => doors[w] } } : null) };
  });

  test("detection: the camera rolls its rating vs Stealth, the intruder Stealth vs the rating; detection raises tally and alert and calls the response", async () => {
    chat.length = 0;
    const s = site();
    const sneak = person("Sneak", [{ id: "st", type: "skill", name: "Stealth", system: { rating: 3, attribute: "quickness" } }]);
    faces.push(5, 5, 5, 1);                                             // camera 4 dice vs TN 3: 3 successes
    faces.push(5, 1, 1);                                                // Stealth 3 vs TN 4: 1
    const r = await s.detect("cam", sneak.uuid);
    assert.equal(r.detected, true);
    assert.equal(s.system.tally, 2);
    assert.equal(s.system.alert, "active");
    assert.equal(s.system.response.worldTime, 300);                     // no combat: 5 minutes of world time
    assert.deepEqual(chat.at(-2).whisper, ["gm1"]);
    assert.match(chat.at(-2).content, /Sneak is detected<\/strong> \(2 net\)/);
    assert.match(chat.at(-1).content, /Security tally 0 → <strong>2<\/strong> · alert: <strong>active<\/strong>/);
    // No line of sight from a camera: nothing rolls.
    chat.length = 0;
    assert.deepEqual(await s.detect("cam", sneak.uuid, { sight: false }), { detected: false });
    assert.match(chat.at(-1).content, /no line of sight/);
    // The response turns up once its time comes.
    await SR2Actor.securityResponses({ worldTime: 299 });
    assert.equal(s.system.response.arrived, false);
    g.game.actors = [s];
    await SR2Actor.securityResponses({ worldTime: 300 });
    assert.equal(s.system.response.arrived, true);
    assert.match(chat.at(-1).content, /response arrives at Ares lab<\/strong>: Guard squad/);
    delete g.game.actors;
  });

  test("bypassing a maglock: success opens it and its door; failure adds to the tally; a disaster sets off the alarm", async () => {
    chat.length = 0;
    const s = site();
    const tech = person("Tech", [{ id: "el", type: "skill", name: "Electronics", system: { rating: 5, attribute: "intelligence" } }]);
    doors.w1.ds = 2;
    faces.push(6, 2, 1, 1, 1, 1);                                       // 5 dice vs 5: one 6 explodes to 8
    const r = await tech.bypassLock(s, "lock");
    assert.equal(r.successes, 1);
    assert.equal(s.device("lock").bypassed, true);
    assert.equal(doors.w1.ds, 0);
    assert.match(chat.at(-2).content, /Lab maglock is open/);
    assert.match(chat.at(-1).content, /Lab maglock bypassed; its door is unlocked/);
    faces.push(1, 2, 3, 4, 4);                                          // vs 8: nothing
    await tech.bypassLock(s, "lock2");
    assert.equal(s.system.tally, 2);
    assert.equal(s.system.alert, "none");
    faces.push(1, 1, 1, 1, 1);                                          // a disaster
    await tech.bypassLock(s, "lock2");
    assert.equal(s.system.tally, 4);                                    // 2 more, crossing step 3 (passive)…
    assert.equal(s.system.alert, "active");                            // …and the disaster sets off the alarm
    assert.match(chat.at(-2).content, /The alarm goes off!/);
    assert.equal(await tech.bypassLock(s, "lock"), null);              // already open
  });

  test("lockdown locks every door not bypassed; a player's change goes to the GM as a card", async () => {
    chat.length = 0;
    const s = site();
    s.system.devices[0].bypassed = false;
    doors.w1.ds = 0; doors.w2.ds = 0;
    s.system.devices[1].bypassed = true;
    const note = await SR2Actor.applySiteChange(s.uuid, { add: 8 });
    assert.equal(s.system.alert, "lockdown");
    assert.deepEqual([doors.w1.ds, doors.w2.ds], [0, 2]);
    assert.match(note, /lockdown: 1 door locked/);
    assert.match(note, /Step 8: <strong>Lockdown/);
    const s2 = site(); s2.isOwner = false;
    await SR2Actor.changeSite(s2, { add: 2 }, "Test");
    assert.match(chat.at(-1).content, /data-sr2e-action="applySite"/);
    assert.deepEqual(chat.at(-1).flags.sr2e.siteChange, { siteUuid: s2.uuid, add: 2 });
    assert.equal(s2.system.tally, 0);
  });

  test("a security rigger jumps in (control rig needed), uses the Control Pool on detection and fires slaved turrets with Gunnery", async () => {
    chat.length = 0; warnings.length = 0;
    const s = site();
    const plain = person("No rig");
    assert.equal(await s.setRigger(plain), false);
    assert.match(warnings.at(-1) ?? "", /no control rig/);
    const rig = person("Sec rigger", [
      { id: "gun", type: "skill", name: "Gunnery", system: { rating: 5, attribute: "intelligence" } },
      { id: "vcr", type: "cyberware", name: "Control rig", system: { installed: true, essenceCost: 2, grade: "standard", attributes: {}, reaction: 0, initiativeDice: 0, controlRig: 1 } },
    ]);
    assert.equal(await s.setRigger(rig), true);
    assert.deepEqual({ v: rig.system.rigging.vehicleUuid, j: rig.system.rigging.jumpedIn }, { v: s.uuid, j: true });
    assert.equal(rig.system.derived.controlPoolLeft, 7);
    const sneak = person("Sneak 2");
    faces.push(1, 1, 1, 1, 5, 5);                                       // camera 4 + 2 Control Pool vs TN 2 (no Stealth)
    faces.push(1, 1, 1, 1, 1);                                          // Quickness 5 vs 4+4
    await s.detect("cam", sneak.uuid, { poolDice: 2 });
    assert.equal(rig.system.poolSpent.control, 2);
    assert.match(chat.at(-2).content, /\+ 2 Control Pool/);
    // A slaved turret.
    const turret = new SR2Actor();
    const tsys = Object.create(VehicleDataModel.prototype);
    Object.assign(tsys, { category: "other", skill: "", drone: true, handling: 4, handlingOffroad: 0, speed: 0, accel: 0, body: 4, armor: 6, signature: 4, autonav: 0, pilot: 2, sensor: 3, ecm: 0, eccm: 0, ecd: 0, locks: [], chase: { quarryUuid: "", metres: 0 }, condition: 0, currentSpeed: 0, offroad: false, controllerUuid: "", controlMode: "autopilot", occupants: [] });
    tsys.prepareDerivedData();
    const gun = { id: "tg", name: "Turret gun", type: "weapon", update: async () => {}, system: { melee: false, skill: "", mount: "turret", damagePower: 8, damageLevel: "S", damageType: "physical", modes: "SA", ammo: 0, ammoMax: 0, recoilComp: 0 } };
    Object.assign(turret, { type: "vehicle", name: "Turret", uuid: "Actor.turret1", system: tsys, items: withGet([gun]) });
    uuidRegistry.set(turret.uuid, turret);
    s.system.slaved = [turret.uuid];
    g.game.actors = [s, turret];
    faces.push(1, 1, 1, 1, 1, 1, 1);
    const r = await rig.fireMounted(turret, gun, { range: "short", poolDice: 2 });
    assert.equal(r.totalDice, 7);                                       // Gunnery 5 + 2 Control Pool
    assert.equal(rig.system.poolSpent.control, 4);
    faces.push(1, 1);
    assert.equal((await turret.fireMounted(turret, gun, { range: "short" })).totalDice, 2);   // or on its own (Pilot 2)
    delete g.game.actors;
    // Jumping out.
    await rig.releaseVehicle();
    assert.equal(s.system.riggerUuid, "");
    assert.equal(rig.system.rigging.jumpedIn, false);
  });

  test("a linked Matrix host and the site raise each other's alerts", async () => {
    chat.length = 0;
    const h = new SR2Actor();
    const hsys = Object.create(HostDataModel.prototype);
    Object.assign(hsys, { securityCode: "orange", securityValue: 5, subsystems: { access: 6, control: 6, index: 6, files: 6, slave: 6 }, tally: 0, alert: "none", sheaf: [{ step: 2, event: "Alert", alert: "active" }] });
    hsys.prepareDerivedData();
    Object.assign(h, { type: "host", name: "Lab host", uuid: "Actor.labhost", system: hsys, isOwner: true });
    uuidRegistry.set(h.uuid, h);
    const s = site({ hostUuid: h.uuid });
    await SR2Actor.applySiteChange(s.uuid, { minAlert: "passive" });
    assert.equal(h.system.alert, "passive");
    g.game.actors = [s, h];
    await SR2Actor.applyTallyCard(h.uuid, 2);
    assert.equal(h.system.alert, "active");
    assert.equal(s.system.alert, "active");
    delete g.game.actors;
  });
});

describe("v0.27.0 Matrix depth: IC behaviors, defense, operations, paydata, Medic, deck damage", () => {
  // v0.92.3: these pin the v0.92.2 Matrix rules (the book's defaults: v0923-matrix tests).
  let undo922 = () => {}; before(() => { undo922 = matrix922(); }); after(() => undo922());
  let HostDataModel: any, IcDataModel: any;
  const D = { body: 4, quickness: 5, strength: 3, charisma: 3, intelligence: 6, willpower: 5 };
  const withGet = (list: any[]) => Object.assign(list, { get(id: string) { return list.find((i: any) => i.id === id); } });
  const run = () => ({ jackedIn: false, hostUuid: "", monitor: 0, crippled: { bod: 0, evasion: 0, masking: 0, sensors: 0 }, passed: [],
    trace: { active: false, icUuid: "", icName: "", mode: "dump", rating: 0, hostUuid: "", round: -1, worldTime: -1 } });
  const decker = (extra: any = {}) => {
    const a = makeActor(D, { karma: { pool: 3, poolSpent: 0, good: 0 }, poolSpent: { combat: 0, spell: 0, hacking: 0 }, matrix: run(), ...extra });
    a.name = extra.name ?? "Decker"; a.type = "character";
    const item = (data: any) => ({ ...data, async update(d: any) { for (const [k, v] of Object.entries(d)) setPath(this, k, v); a.system.prepareDerivedData(); } });
    a.items = withGet([
      item({ id: "sk", type: "skill", name: "Computer", system: { rating: 5, attribute: "intelligence" } }),
      item({ id: "deck", type: "cyberdeck", name: "Fuchi Cyber-6", system: { active: true, mpcp: 6, bod: 4, evasion: 5, masking: 5, sensors: 4, hardening: 2, responseIncrease: 1, activeMemory: 400, storageMemory: 500, ioSpeed: 100, damage: { mpcp: 0, bod: 0, evasion: 0, masking: 0, sensors: 0 }, files: [] } }),
      item({ id: "sl", type: "program", name: "Sleaze", system: { kind: "sleaze", rating: 4, size: 96, loaded: true, erased: false } }),
      item({ id: "de", type: "program", name: "Deception", system: { kind: "deception", rating: 3, size: 54, loaded: true, erased: false } }),
      item({ id: "at", type: "program", name: "Attack", system: { kind: "attack", rating: 5, size: 75, loaded: true, erased: false, damageLevel: "M" } }),
      item({ id: "md", type: "program", name: "Medic", system: { kind: "medic", rating: 4, size: 0, loaded: true, erased: false } }),
    ]);
    a.system.parent = a; a.system.prepareDerivedData();
    uuidRegistry.set(a.uuid, a);
    return a;
  };
  const host = (extra: any = {}) => {
    const h = new SR2Actor();
    const sys = Object.create(HostDataModel.prototype);
    Object.assign(sys, { securityCode: "red", securityValue: 6, subsystems: { access: 4, control: 4, index: 4, files: 4, slave: 4 }, tally: 0, alert: "none", sheaf: [],
      files: [
        { id: "a", name: "Memo", size: 10, value: 0, paydata: false, encrypted: 0, scramble: 0, foundBy: [] },
        { id: "b", name: "R&D", size: 60, value: 6000, paydata: true, encrypted: 5, scramble: 0, foundBy: [] },
        { id: "c", name: "Payroll", size: 40, value: 4000, paydata: true, encrypted: 0, scramble: 4, foundBy: [] },
      ], ...extra });
    sys.prepareDerivedData();
    Object.assign(h, { type: "host", name: "Ares host", uuid: `Actor.dh${(host as any).n = ((host as any).n ?? 0) + 1}`, system: sys });
    uuidRegistry.set(h.uuid, h);
    return h;
  };
  const ic = (h: any, extra: any = {}) => {
    const i = new SR2Actor();
    const sys = Object.create(IcDataModel.prototype);
    Object.assign(sys, { rating: 6, category: "white", icType: "", damageLevel: "M", damageType: "physical", initiativeDice: 0, hostUuid: h.uuid, matrix: { monitor: 0 },
      behavior: "killer", guards: "", traceMode: "dump", attribute: "evasion", ...extra });
    sys.prepareDerivedData();
    Object.assign(i, { type: "ic", name: extra.name ?? `${extra.behavior ?? "killer"}-${sys.rating}`, uuid: `Actor.dic${(ic as any).n = ((ic as any).n ?? 0) + 1}`, system: sys, items: withGet([]) });
    uuidRegistry.set(i.uuid, i);
    return i;
  };
  const noDetect = () => faces.push(1, 1, 1, 1, 1, 1);           // the host's Security Value 6 detection roll: nothing
  before(async () => {
    ({ HostDataModel, IcDataModel } = await import("../models/index.ts"));
    g.fromUuidSync = (u: string) => uuidRegistry.get(u) ?? null;
    g.game.users = [{ id: "gm1", isGM: true }];
    g.game.user = { isGM: true, id: "gm1" };
    g.game.time = { worldTime: 0 };
  });

  test("a persona defends with Hacking Pool dice; IC can be made to defend with their rating", async () => {
    chat.length = 0;
    const h = host();
    const a = decker(); await a.jackIn(h.uuid);
    const k = ic(h, { name: "Killer-6" });
    chat.length = 0;
    faces.push(5, 5, 5, 1, 1, 1);                                  // 3 successes vs Evasion 5
    await k.icAttack({ targetUuid: a.uuid });
    assert.match(chat[0].content, /Defend \(Decker\)/);
    faces.push(5, 5);                                              // 2 Hacking Pool dice: 2 successes
    await a.defend(chat[0].flags.sr2e.attack, 2);
    assert.equal(a.system.poolSpent.hacking, 2);
    assert.match(chat.at(-1).content, /Hit!<\/strong> 3 attack vs 2 defense: 1 net: <strong>6M<\/strong> Matrix damage/);
    // IC do not defend by default; with the house rule they roll their rating.
    chat.length = 0;
    faces.push(5, 5, 5, 5, 1);                                     // Computer 5 vs a rating-5 IC: 4 successes
    const k5 = ic(h, { rating: 5, name: "Killer-5" });
    await a.matrixAttack({ targetUuid: k5.uuid, programId: "at" });
    assert.match(chat.at(-1).content, /data-sr2e-action="resist"/);
    (RULES.MATRIX.defense as any).ic = "rating";
    try {
      faces.push(5, 5, 5, 5, 1);                                   // 4 successes
      await a.matrixAttack({ targetUuid: k5.uuid, programId: "at" });
      assert.match(chat.at(-1).content, /Defend \(Killer-5\)/);
      faces.push(5, 5, 1, 1, 1);                                   // the IC's rating 5: 2 successes
      await k5.defend(chat.at(-1).flags.sr2e.attack, 0);
      assert.match(chat.at(-1).content, /Killer-5 defends \(rating 5\)/);
      assert.match(chat.at(-1).content, /4 attack vs 2 defense: 2 net: <strong>5M<\/strong>/);
    } finally { (RULES.MATRIX.defense as any).ic = "none"; }
  });

  test("cripplers lower a persona program until jack-out; rippers damage the deck until it is repaired", async () => {
    chat.length = 0;
    const h = host();
    const a = decker(); await a.jackIn(h.uuid);
    const c = ic(h, { behavior: "crippler", attribute: "evasion", name: "Crippler-6" });
    faces.push(5, 5, 5, 5, 1, 1);                                  // 4 vs Evasion 5
    await c.icAttack({ targetUuid: a.uuid });
    await a.defend(chat.at(-1).flags.sr2e.attack, 0);
    assert.equal(a.system.matrix.crippled.evasion, 2);            // 4 net: 2 points
    assert.equal(a.system.derived.matrix.evasion, 3);
    assert.match(chat.at(-1).content, /Crippler-6 cripples Evasion −2/);
    assert.equal(chat.at(-1).flags.sr2e.test.matrixEffect.applied, true);
    await a.jackOut();
    assert.equal(a.system.derived.matrix.evasion, 5);
    await a.jackIn(h.uuid);
    const r = ic(h, { behavior: "ripper", attribute: "masking", name: "Ripper-6" });
    faces.push(5, 5, 1, 1, 1, 1);                                  // 2 vs Masking 5: 1 point
    await r.icAttack({ targetUuid: a.uuid });
    await a.defend(chat.at(-1).flags.sr2e.attack, 0);
    assert.equal(a.items.get("deck").system.damage.masking, 1);
    assert.equal(a.system.derived.matrix.masking, 4);
    assert.equal(a.system.derived.matrix.detectionFactor, 4);     // (4 + Sleaze 4) / 2
    await a.jackOut();
    assert.equal(a.system.derived.matrix.masking, 4);             // still damaged
    faces.push(5, 1, 1, 1, 1);                                     // Computer 5 vs TN 4: 1 success
    await a.repairDeckTest();
    assert.equal(a.items.get("deck").system.damage.masking, 0);
    assert.match(chat.at(-1).content, /fully repaired/);
  });

  test("tar baby crashes a utility and derezzes; tar pit also erases it", async () => {
    chat.length = 0;
    const h = host();
    const a = decker(); await a.jackIn(h.uuid);
    const tb = ic(h, { behavior: "tarBaby", rating: 5, name: "Tar baby-5" });
    faces.push(5, 5, 1, 1, 1);                                     // 2 vs Sleaze 4
    await tb.icAttack({ targetUuid: a.uuid, programId: "sl" });
    assert.match(chat.at(-1).content, /goes after Sleaze \(TN = the utility's rating 4\)/);
    await a.defend(chat.at(-1).flags.sr2e.attack, 0);
    assert.equal(a.items.get("sl").system.loaded, false);
    assert.equal(tb.system.matrix.monitor, 10);
    assert.equal(a.system.derived.matrix.detectionFactor, 3);     // no Sleaze loaded now: (5 + 0) / 2 rounded up
    const tp = ic(h, { behavior: "tarPit", rating: 5, name: "Tar pit-5" });
    faces.push(5, 1, 1, 1, 1);                                     // 1 vs Deception 3
    await tp.icAttack({ targetUuid: a.uuid, programId: "de" });
    await a.defend(chat.at(-1).flags.sr2e.attack, 0);
    assert.deepEqual({ l: a.items.get("de").system.loaded, e: a.items.get("de").system.erased }, { l: false, e: true });
    assert.match(chat.at(-1).content, /erases it from the deck/);
    assert.equal(tp.system.matrix.monitor, 0);                    // tar pits stay
  });

  test("trace IC lock on; the trace completes by world time and dumps, reports or burns; redirecting the datatrail shakes it", async () => {
    chat.length = 0;
    g.game.time.worldTime = 0;
    const h = host();
    const a = decker(); await a.jackIn(h.uuid);
    const t = ic(h, { behavior: "trace", traceMode: "dump", name: "Trace-6" });
    g.game.actors = [a, t, h];
    faces.push(5, 5, 5, 1, 1, 1);                                  // 3 net: 10 / 3 -> 4 Combat Turns
    await t.icAttack({ targetUuid: a.uuid });
    await a.defend(chat.at(-1).flags.sr2e.attack, 0);
    assert.match(chat.at(-1).content, /Trace-6 locks on to Decker<\/strong>: the trace completes in <strong>4 Combat Turns/);
    assert.deepEqual({ on: a.system.matrix.trace.active, w: a.system.matrix.trace.worldTime }, { on: true, w: 12 });
    assert.equal(a.system.derived.matrix.trace.icName, "Trace-6");
    await SR2Actor.matrixTraces({ worldTime: 9 });
    assert.equal(a.system.matrix.jackedIn, true);
    await SR2Actor.matrixTraces({ worldTime: 12 });
    assert.equal(a.system.matrix.jackedIn, false);
    assert.equal(a.system.matrix.trace.active, false);
    assert.match(chat.at(-1).content, /Trace complete:<\/strong> Trace-6 dumps Decker/);
    assert.equal(chat.at(-1).flags.sr2e.dumpShockTn, 6);
    // Trace and burn: dump plus a deck damage button; trace and report: whispered location and host alert.
    await a.jackIn(h.uuid);
    await t.update({ "system.traceMode": "burn" });
    faces.push(5, 5, 5, 5, 5, 1);
    await t.icAttack({ targetUuid: a.uuid });
    await a.defend(chat.at(-1).flags.sr2e.attack, 0);
    await SR2Actor.matrixTraces({ worldTime: 100 });
    assert.equal(chat.at(-1).flags.sr2e.deckDamage.rating, 6);
    await a.jackIn(h.uuid);
    await t.update({ "system.traceMode": "report" });
    faces.push(5, 5, 5, 5, 5, 1);
    await t.icAttack({ targetUuid: a.uuid });
    await a.defend(chat.at(-1).flags.sr2e.attack, 0);
    await SR2Actor.matrixTraces({ worldTime: 200 });
    assert.equal(a.system.matrix.jackedIn, true);
    assert.equal(h.system.alert, "active");
    assert.match(chat.at(-1).content, /has located Decker's jackpoint/);
    // Redirect datatrail.
    faces.push(5, 5, 5, 5, 5, 1);
    await t.icAttack({ targetUuid: a.uuid });
    await a.defend(chat.at(-1).flags.sr2e.attack, 0);
    noDetect(); faces.push(5, 1, 1, 1, 1);                         // Control 4: 1 success
    await a.systemTest("", { operationId: "redirectDatatrail" });
    assert.equal(a.system.matrix.trace.active, false);
    assert.match(chat.at(-1).content, /shakes off Trace-6's trace/);
    // A derezzed trace IC loses its trace.
    faces.push(5, 5, 5, 5, 5, 1);
    await t.icAttack({ targetUuid: a.uuid });
    await a.defend(chat.at(-1).flags.sr2e.attack, 0);
    await t.update({ "system.matrix.monitor": 10 });
    await SR2Actor.matrixTraces({ worldTime: 210 });
    assert.equal(a.system.matrix.trace.active, false);
    assert.match(chat.at(-1).content, /is gone: its trace on Decker is lost/);
    delete g.game.actors;
  });

  test("probe IC add their successes to the tally; barrier IC refuse system tests until decrypted", async () => {
    chat.length = 0;
    warnings.length = 0;
    const h = host();
    const a = decker(); await a.jackIn(h.uuid);
    const p = ic(h, { behavior: "probe", rating: 4, name: "Probe-4" });
    faces.push(5, 5, 5, 1);                                        // vs Detection Factor 5: 3
    await p.icAttack({ targetUuid: a.uuid });
    assert.equal(h.system.tally, 3);
    assert.match(chat.at(-1).content, /Probe-4 probes Decker \(rating 4 vs the Detection Factor 5\)/);
    const b = ic(h, { behavior: "barrier", guards: "index", rating: 5, name: "Barrier-5" });
    g.game.actors = [a, p, b, h];
    assert.equal(await b.icAttack({ targetUuid: a.uuid }), null);
    assert.equal(await a.systemTest("", { operationId: "locateFile" }), null);
    assert.match(warnings.at(-1) ?? "", /Barrier-5 guards the Index subsystem/);
    noDetect(); faces.push(5, 5, 1, 1, 1);                         // vs the barrier's rating 5: 2
    const r = await a.systemTest("", { operationId: "decryptAccess", targetUuid: b.uuid });
    assert.equal(r.targetNumber, 5);
    assert.deepEqual([...a.system.matrix.passed], [b.uuid]);
    noDetect(); faces.push(5, 1, 1, 1, 1);
    assert.ok(await a.systemTest("", { operationId: "locateFile" }));
    delete g.game.actors;
  });

  test("operations: analyze, locate files and paydata, download, decrypt (scramble destroys on a failure), control a slave", async () => {
    chat.length = 0;
    warnings.length = 0;
    const h = host();
    const a = decker(); await a.jackIn(h.uuid);
    noDetect(); faces.push(5, 1, 1, 1, 1);
    await a.systemTest("", { operationId: "analyzeHost" });
    assert.match(chat.at(-1).content, /Ares host: <strong>Red-6<\/strong>. Access 4, Control 4/);
    noDetect(); faces.push(5, 5, 1, 1, 1);                         // 2 successes: 2 files
    await a.systemTest("", { operationId: "locateFile" });
    assert.match(chat.at(-2).content, /Found: <strong>Memo<\/strong>.*<strong>R&amp;D<\/strong>/);
    assert.deepEqual(SR2Actor.foundFiles(h, a.uuid).map((f: any) => f.id), ["a", "b"]);
    noDetect(); faces.push(5, 1, 1, 1, 1);
    await a.systemTest("", { operationId: "locatePaydata" });     // paydata only: Payroll
    assert.deepEqual(SR2Actor.foundFiles(h, a.uuid).map((f: any) => f.id), ["a", "b", "c"]);
    assert.equal(await a.systemTest("", { operationId: "downloadData", fileId: "b" }), null);
    assert.match(shown(warnings.at(-1)), /R&D is encrypted: decrypt it first/);
    noDetect(); faces.push(5, 1, 1, 1, 1);
    await a.systemTest("", { operationId: "downloadData", fileId: "a" });
    assert.deepEqual(a.items.get("deck").system.files.map((f: any) => f.name), ["Memo"]);
    assert.match(chat.at(-1).content, /takes <strong>1 Combat Turn<\/strong>/);
    noDetect(); faces.push(5, 5, 1, 1, 1);                         // vs encryption 5
    const d = await a.systemTest("", { operationId: "decryptFile", fileId: "b" });
    assert.equal(d.targetNumber, 5);
    assert.equal(h.system.files.find((f: any) => f.id === "b").encrypted, 0);
    noDetect(); faces.push(1, 1, 2, 2, 2);                         // vs scramble 4: fails
    await a.systemTest("", { operationId: "decryptFile", fileId: "c" });
    assert.equal(h.system.files.some((f: any) => f.id === "c"), false);
    assert.match(chat.at(-2).content, /Scramble IC destroys Payroll/);
    // A site linked to the host: Control Slave bypasses its device.
    const site = new SR2Actor();
    Object.assign(site, { type: "site", name: "Lab", uuid: "Actor.dsite", system: { devices: [{ id: "cam", name: "Camera", kind: "camera", rating: 4, wallId: "", active: true, bypassed: false }], tally: 0, alert: "none", steps: [], response: { round: -1, worldTime: -1, arrived: false }, hostUuid: h.uuid, prepareDerivedData() {} } });
    uuidRegistry.set(site.uuid, site);
    g.game.actors = [a, h, site];
    noDetect(); faces.push(5, 1, 1, 1, 1);
    await a.systemTest("", { operationId: "controlSlave", siteUuid: site.uuid, deviceId: "cam" });
    assert.equal(site.system.devices[0].bypassed, true);
    delete g.game.actors;
  });

  test("a blaster crash damages the MPCP; Medic repairs the persona and wears down; book sizes fill in memory", async () => {
    chat.length = 0;
    const h = host();
    const a = decker(); await a.jackIn(h.uuid);
    assert.equal(a.system.derived.matrix.memory.used, 96 + 54 + 75 + 64);  // Medic 4: 4² × 4 from the book
    await a.update({ "system.matrix.monitor": 8 });
    const bl = ic(h, { behavior: "blaster", rating: 4, name: "Blaster-4" });
    faces.push(5, 5, 1, 1);                                        // 2 vs Evasion 5: 4M
    await bl.icAttack({ targetUuid: a.uuid });
    await a.defend(chat.at(-1).flags.sr2e.attack, 0);
    faces.push(1, 1, 1, 1);                                        // Bod 4 vs 2: no successes, M
    await a.resistFromState(chat.at(-1).flags.sr2e.damage);
    assert.equal(a.system.matrix.jackedIn, false);
    assert.match(chat.at(-1).content, /Blaster-4<\/strong> blasts Decker's deck/);
    const dd = chat.at(-1).flags.sr2e.deckDamage;
    faces.push(6, 6, 6, 1, 1, 1, 1);                               // rating 4 vs MPCP 6: 3 successes (sixes re-rolled)
    const pts = await a.takeDeckDamage(dd.icName, dd.rating, dd.reason);
    assert.equal(pts, 1);
    assert.equal(a.system.derived.matrix.mpcp, 5);
    assert.equal(a.system.derived.hackingPool, 3);                 // (6 + 5) / 3
    await a.update({ "system.matrix.monitor": 4 });               // Moderate: TN 5
    faces.push(5, 5, 1, 1);
    await a.runMedic("md");                                      // (v0.57.0: Medic is not slowed by the persona's own damage)
    assert.equal(a.system.matrix.monitor, 2);
    assert.equal(a.items.get("md").system.rating, 3);
    assert.match(chat.at(-1).content, /Repairs <strong>2 boxes<\/strong>/);
  });

  test("paydata is generated from the host's security code", async () => {
    chat.length = 0;
    const h = host({ files: [] });
    faces.push(1, 1);                                              // red: 2d6 + 2 = 4 files
    faces.push(1, 1, 1, 2, 2, 4, 3, 3, 6, 1, 2, 2);               // each: 2d6 × 20 Mp, then a defense d6
    const n = await SR2Actor.generatePaydata(h);
    assert.equal(n, 4);
    assert.deepEqual(h.system.files.map((f: any) => [f.size, f.encrypted, f.scramble]), [[40, 0, 0], [80, 6, 0], [120, 0, 6], [60, 0, 0]]);
    assert.equal(h.system.files[1].value, 80 * 150);
    assert.deepEqual(chat.at(-1).whisper, ["gm1"]);
  });

  test("the v0.27.0 migration sets IC behaviors from their names", async () => {
    const { icBehaviorUpdate } = await import("../migrations.ts");
    assert.equal(icBehaviorUpdate("Trace and Report", "killer"), "trace");
    assert.equal(icBehaviorUpdate("Killer", "killer"), null);
    assert.equal(icBehaviorUpdate("Psychotropic", "killer"), "psychotropic");   // v0.40.0
    assert.equal(icBehaviorUpdate("Party cluster", "killer"), null);
    assert.equal(icBehaviorUpdate(undefined, undefined), null);
  });
});

describe("v0.28.0 the grid, hot and cold sim, frames, connections", () => {
  // v0.92.3: these pin the v0.92.2 Matrix rules (the book's defaults: v0923-matrix tests).
  let undo922 = () => {}; before(() => { undo922 = matrix922(); }); after(() => undo922());
  let HostDataModel: any, IcDataModel: any;
  const D = { body: 4, quickness: 5, strength: 3, charisma: 3, intelligence: 6, willpower: 5 };
  const withGet = (list: any[]) => Object.assign(list, { get(id: string) { return list.find((i: any) => i.id === id); } });
  const decker = (matrix: any = {}) => {
    const a = makeActor(D, { karma: { pool: 0, poolSpent: 0, good: 0 }, poolSpent: { combat: 0, spell: 0, hacking: 0 },
      matrix: { jackedIn: false, hostUuid: "", monitor: 0, sim: "cold", connection: "jackpoint", crippled: { bod: 0, evasion: 0, masking: 0, sensors: 0 }, passed: [],
        trace: { active: false, icUuid: "", icName: "", mode: "dump", rating: 0, hostUuid: "", round: -1, worldTime: -1 }, ...matrix } });
    a.name = "Decker"; a.type = "character";
    const item = (data: any) => ({ ...data, async update(d: any) { for (const [k, v] of Object.entries(d)) setPath(this, k, v); a.system.prepareDerivedData(); } });
    a.items = withGet([
      item({ id: "sk", type: "skill", name: "Computer", system: { rating: 5, attribute: "intelligence" } }),
      item({ id: "deck", type: "cyberdeck", name: "Deck", system: { active: true, mpcp: 6, bod: 4, evasion: 5, masking: 5, sensors: 4, hardening: 2, responseIncrease: 1, activeMemory: 400, storageMemory: 500, ioSpeed: 100, files: [] } }),
      item({ id: "de", type: "program", name: "Deception", system: { kind: "deception", rating: 2, size: 0, loaded: true } }),
      item({ id: "fr", type: "program", name: "Smart frame", system: { kind: "smart-frame", rating: 5, size: 0, loaded: true } }),
    ]);
    a.system.parent = a; a.system.prepareDerivedData();
    uuidRegistry.set(a.uuid, a);
    return a;
  };
  const node = (name: string, gridKind: string, parentUuid = "", extra: any = {}) => {
    const h = new SR2Actor();
    const sys = Object.create(HostDataModel.prototype);
    Object.assign(sys, { gridKind, parentUuid, securityCode: "green", securityValue: 4, subsystems: { access: 5, control: 5, index: 5, files: 5, slave: 5 }, tally: 0, alert: "none", sheaf: [],
      files: [{ id: "a", name: "Memo", size: 10, value: 0, paydata: false, encrypted: 0, scramble: 0, foundBy: [] }], ...extra });
    sys.prepareDerivedData();
    Object.assign(h, { type: "host", name, uuid: `Actor.g${name}`, system: sys });
    uuidRegistry.set(h.uuid, h);
    return h;
  };
  const none = () => faces.push(1, 1, 1, 1);                      // a node's Security Value 4 detection roll: nothing
  before(async () => {
    ({ HostDataModel, IcDataModel } = await import("../models/index.ts"));
    g.fromUuidSync = (u: string) => uuidRegistry.get(u) ?? null;
    g.game.users = [{ id: "gm1", isGM: true }];
    g.game.user = { isGM: true, id: "gm1" };
    g.game.time = { worldTime: 0 };
  });

  test("logging on through the grid: a jackpoint to the LTG, down to a host, not across to a sibling; graceful logoff goes back up", async () => {
    chat.length = 0; warnings.length = 0;
    const rtg = node("RTG", "rtg"), ltg = node("LTG", "ltg", rtg.uuid), a1 = node("HostA", "host", ltg.uuid), b1 = node("HostB", "host", ltg.uuid);
    const d = decker({ jackedIn: true });
    none(); faces.push(5, 1, 1, 1, 1);                             // Computer 5 vs LTG Access 5 − Deception 2 = 3
    const r = await d.systemTest("", { operationId: "logon", targetUuid: ltg.uuid });
    assert.equal(r.targetNumber, 3);
    assert.equal(d.system.matrix.hostUuid, ltg.uuid);
    assert.match(chat.at(-1).content, /logs on to <strong>LTG<\/strong>/);
    none(); faces.push(5, 1, 1, 1, 1);
    await d.systemTest("", { operationId: "logon", targetUuid: a1.uuid });
    assert.equal(d.system.matrix.hostUuid, a1.uuid);
    (RULES.MATRIX.grid as any).enforcePath = "block";
    try {
      assert.equal(await d.systemTest("", { operationId: "logon", targetUuid: b1.uuid }), null);
      assert.match(warnings.at(-1) ?? "", /HostB is not reachable from HostA: go through its grid \(LTG\)/);
    } finally { (RULES.MATRIX.grid as any).enforcePath = "warn"; }
    none(); faces.push(5, 1, 1, 1, 1);
    await d.systemTest("", { operationId: "gracefulLogoff" });
    assert.equal(d.system.matrix.hostUuid, ltg.uuid);
    assert.match(chat.at(-1).content, /logs off HostA to LTG/);
    // From outside the grid, a host under an LTG cannot be logged on to directly (warned only by default).
    const out = decker({ jackedIn: true });
    none(); faces.push(5, 1, 1, 1, 1);
    await out.systemTest("", { operationId: "logon", targetUuid: a1.uuid });
    assert.equal(out.system.matrix.hostUuid, a1.uuid);
  });

  test("hot sim: an extra initiative die, Physical dump shock, and a simsense overload after Serious Matrix damage", async () => {
    chat.length = 0;
    const h = node("HotHost", "host");
    const cold = decker({ jackedIn: true, hostUuid: h.uuid });
    const hot = decker({ jackedIn: true, hostUuid: h.uuid, sim: "hot" });
    assert.equal(hot.system.derived.matrix.initiativeDice, cold.system.derived.matrix.initiativeDice + 1);
    faces.push(1, 1, 1, 2);                                        // Bod 4 vs 8 − 2: nothing; 8S stays S
    await hot.resistFromState({ targetUuid: hot.uuid, melee: false, damageType: "physical", power: 8, level: "S", matrix: true });
    assert.equal(hot.system.matrix.monitor, 6);
    assert.match(chat.at(-1).content, /Simsense overload!/);
    assert.equal(chat.at(-1).flags.sr2e.overload.tn, 8);
    faces.push(1, 1, 1, 1, 2);
    await hot.rollOverload(8);
    assert.equal(hot.system.monitor.stun, 1);                     // L stun
    faces.push(1, 1, 1, 1, 2);
    await hot.rollDumpShock(6);
    assert.equal(hot.system.monitor.physical, 3);                 // M physical in hot sim
    faces.push(1, 1, 1, 2);
    chat.length = 0;
    await cold.resistFromState({ targetUuid: cold.uuid, melee: false, damageType: "physical", power: 8, level: "S", matrix: true });
    assert.doesNotMatch(chat.map((m) => m.content).join(""), /overload/);
  });

  test("frames run operations in their own host with their rating, untouched by the decker's wounds; the finds are the decker's", async () => {
    chat.length = 0;
    const h = node("FrameHost", "host");
    const d = decker({ jackedIn: true, hostUuid: "", connection: "satellite" });
    await d.update({ "system.monitor.physical": 6 });              // Serious wound: +3 to the decker's own tests; the satellite link does not slow the frame either
    const f = new SR2Actor();
    const sys = Object.create(IcDataModel.prototype);
    Object.assign(sys, { kind: "frame", ownerUuid: d.uuid, smart: true, rating: 5, category: "white", icType: "", damageLevel: "M", damageType: "physical", initiativeDice: 1, hostUuid: h.uuid, matrix: { monitor: 0 }, behavior: "other", guards: "", traceMode: "dump", attribute: "evasion" });
    sys.prepareDerivedData();
    Object.assign(f, { type: "ic", name: "Frame-5", uuid: "Actor.frame5", system: sys, items: withGet([]) });
    uuidRegistry.set(f.uuid, f);
    none(); faces.push(5, 1, 1, 1, 1, 1, 1);                       // 5 + 2 smart pool dice vs Index 5, no wound modifier
    const r = await d.systemTest("", { operationId: "locateFile", frameUuid: f.uuid });
    assert.equal(r.totalDice, 7);
    assert.equal(r.targetNumber, 5);
    assert.match(chat.at(-2).content, /Frame-5: Locate file/);
    assert.match(chat.at(-1).content, /Frame-5 locates Memo/);
    assert.deepEqual(SR2Actor.foundFiles(h, d.uuid).map((x: any) => x.id), ["a"]);
    none(); faces.push(5, 1, 1, 1, 1, 1, 1);
    await d.systemTest("", { operationId: "gracefulLogoff", frameUuid: f.uuid });
    assert.equal(f.system.hostUuid, "");
    assert.equal(d.system.matrix.hostUuid, "");                   // the decker did not move
    const other = decker({ jackedIn: true });
    assert.equal(await other.systemTest("", { operationId: "locateFile", frameUuid: f.uuid }), null);   // not their frame
  });

  test("launching a frame makes an IC actor of kind frame owned by the decker", async () => {
    const h = node("LaunchHost", "host");
    const d = decker({ jackedIn: true, hostUuid: h.uuid });
    let made: any = null;
    g.Actor.implementation = { create: async (data: any) => { made = data; return { name: data.name }; } };
    try {
      await d.launchFrame("fr");
    } finally { delete g.Actor.implementation; }
    assert.deepEqual({ k: made.system.kind, o: made.system.ownerUuid, s: made.system.smart, r: made.system.rating, h: made.system.hostUuid, t: made.type },
      { k: "frame", o: d.uuid, s: true, r: 5, h: h.uuid, t: "ic" });
    assert.equal(await d.launchFrame("de"), null);                // not a frame program
  });

  test("connections and a moving vehicle add to Matrix TNs", async () => {
    chat.length = 0;
    const h = node("SatHost", "host");
    const d = decker({ jackedIn: true, hostUuid: h.uuid, connection: "satellite" });
    none(); faces.push(5, 1, 1, 1, 1);
    const r = await d.systemTest("", { operationId: "analyzeHost" });
    assert.equal(r.targetNumber, 7);                               // Control 5 + satellite 2
    assert.ok(r.modifiers.some((m: any) => m.label === "Satellite uplink" && m.value === 2));
  });
});

describe("v0.29.0 cyberware depth", () => {
  const C = { body: 5, quickness: 5, strength: 3, charisma: 4, intelligence: 5, willpower: 4 };
  const withGet = (list: any[]) => Object.assign(list, { get(id: string) { return list.find((i: any) => i.id === id); } });
  const cw = (id: string, name: string, sys: any = {}) => ({ id, type: "cyberware", name, system: { essenceCost: 1, grade: "standard", installed: true, attributes: {}, reaction: 0, initiativeDice: 0, kind: "other", reflexes: "", damaged: false, housedIn: "", ...sys } });
  const sam = (items: any[], extra: any = {}) => {
    const a = makeActor(C, { poolSpent: { combat: 0, spell: 0, hacking: 0, control: 0 }, matrix: { jackedIn: false, hostUuid: "", monitor: 0 }, karma: { pool: 0, poolSpent: 0 }, ...extra });
    a.name = "Pell"; a.type = "character";
    const items2 = items.map((it) => ({ ...it, async update(d: any) { for (const [k, v] of Object.entries(d)) setPath(this, k, v); a.system.prepareDerivedData(); } }));
    a.items = withGet(items2);
    a.system.parent = a; a.system.prepareDerivedData();
    uuidRegistry.set(a.uuid, a);
    return a;
  };
  before(() => {
    g.fromUuidSync = (u: string) => uuidRegistry.get(u) ?? null;
    g.game.users = [{ id: "gm1", isGM: true }];
    g.game.user = { isGM: true, id: "gm1" };
  });

  test("wired and boosted reflexes don't stack; initiative dice are capped; damaged cyberware gives nothing until repaired", async () => {
    chat.length = 0;
    const a = sam([
      cw("w", "Wired Reflexes 2", { essenceCost: 3, reaction: 4, initiativeDice: 2 }),
      cw("b", "Boosted Reflexes 1", { reaction: 2, initiativeDice: 1 }),
      { id: "sk", type: "skill", name: "Biotech", system: { rating: 4, attribute: "intelligence" } },
    ]);
    assert.equal(a.system.derived.initiativeDice, 3);           // 1 + wired 2, not + boosted 1
    assert.equal(a.system.derived.reaction, 5 + 4);
    assert.match(a.system.derived.cyberWarnings[0], /Boosted Reflexes 1 does not stack with Wired Reflexes 2/);
    assert.equal(a.system.derived.essence, 2);                   // both still cost Essence
    await a.update({ "system.initiativeDiceBonus": 4 });
    assert.equal(a.system.derived.initiativeDice, 5);
    assert.ok(a.system.derived.cyberWarnings.some((w: string) => /capped at 5/.test(w)));
    await a.update({ "system.initiativeDiceBonus": 0 });
    await a.items.get("w").update({ "system.damaged": true });
    assert.equal(a.system.derived.initiativeDice, 2);           // the boosted reflexes now count
    faces.push(5, 1, 1, 1);                                      // Biotech 4 vs TN 4: 1 success
    await a.repairCyberware("w");
    assert.equal(a.items.get("w").system.damaged, false);
    assert.match(chat.at(-1).content, /Wired Reflexes 2 is repaired/);
    assert.equal(await a.repairCyberware("w"), null);            // not damaged now
  });

  test("cyberlimbs: housed cyberware costs capacity instead of Essence; attacks with the arm use its Strength; cyberweapons attack and parry", async (t) => {
    t.after(oldWay({ "GEAR_V923.limbHoused": "capacity", "GEAR_V923.limbPairs": "off" })); // v0.92.3: the old way (v0.92.2); __tests__/v0923-gear.test.ts has the book's
    const a = sam([
      cw("arm", "Cyberarm", { essenceCost: 1, kind: "cyberlimb", limb: { location: "rightArm", strength: 7, quickness: 5, capacity: 0.5 } }),
      cw("spur", "Spur", { essenceCost: 0.3, kind: "cyberweapon", housedIn: "arm", weapon: { skill: "Armed Combat", strengthPower: true, damagePower: 0, damageLevel: "M", damageType: "physical", reach: 0 } }),
      cw("gun", "Smartgun link", { essenceCost: 0.5, housedIn: "arm", smartlinkLevel: 2 }),
    ]);
    assert.equal(a.system.derived.essence, 5);                   // only the arm itself
    const limb = a.system.derived.cyber.limbs[0];
    assert.deepEqual({ s: limb.strength, used: limb.capacity.used, over: limb.capacity.over }, { s: 7, used: 0.8, over: true });
    assert.ok(a.system.derived.cyberWarnings.some((w: string) => /Cyberarm: capacity 0.8 of 0.5/.test(w)));
    assert.equal(a.previewAttack(SR2Actor.unarmed(), {}).power, 3);
    assert.equal(a.previewAttack(SR2Actor.unarmed(), { limbId: "arm" }).power, 7);
    const spur = a.cyberWeapons()[0];
    assert.equal(spur.id, "cyber-spur");
    assert.equal(a.previewAttack(spur, {}).power, 7);            // housed in the arm: its Strength
    assert.ok(a.meleeWeapons().some((w: any) => w.id === "cyber-spur"));
    assert.equal(a.weaponById("cyber-spur").name, "Spur");
    // Smartlink-2: v0.79.0 docs check (SRII table): −2 like level 1, so no extra row (was another −1).
    const smartgun = { id: "sg", name: "Ares Predator", system: { melee: false, skill: "Firearms", damagePower: 9, damageLevel: "M", damageType: "physical", modes: "SA", ammo: 10, ammoMax: 10, recoilComp: 0, smartgun: true } };
    const mods = a.previewAttack(smartgun, { range: "short", situational: ["smartlink"] }).modifiers;
    assert.ok(!mods.some((m: any) => m.label === "Smartlink-2"));
  });

  test("vision magnification brings the range band closer; pheromones help social skills; skillsofts stand in for skills", async () => {
    chat.length = 0;
    const a = sam([
      cw("eyes", "Cybereyes", { magnification: 2, ultrasound: true }),
      cw("ph", "Tailored pheromones", { pheromones: 2 }),
      cw("wires", "Skillwires 3", { kind: "skillwires", rating: 3 }),
      cw("cj", "Chipjack", { kind: "chipjack" }),
      { id: "neg", type: "skill", name: "Negotiation", system: { rating: 3, attribute: "charisma" } },
      { id: "fa", type: "skill", name: "Firearms", system: { rating: 1, attribute: "quickness" } },
      { id: "chip", type: "gear", name: "Pistols chip", system: { quantity: 1, chip: { kind: "activesoft", skill: "Firearms", rating: 5, slotted: true } } },
      { id: "jp", type: "gear", name: "Japanese chip", system: { quantity: 1, chip: { kind: "linguasoft", skill: "Japanese", rating: 4, slotted: false } } },
    ]);
    const gun = { id: "g", name: "Rifle", system: { melee: false, skill: "Firearms", damagePower: 8, damageLevel: "S", damageType: "physical", modes: "SA", ammo: 10, ammoMax: 10, recoilComp: 0 } };
    assert.equal(a.previewAttack(gun, { range: "long" }).base, RULES.RANGE_TN.long);
    assert.equal(a.previewAttack(gun, { range: "long", magnify: true }).base, RULES.RANGE_TN.short);
    assert.equal(a.system.derived.vision.ultrasound, true);
    faces.push(1, 1, 1, 1, 1);
    const r = await a.rollSkill(a.items.get("neg"), { targetNumber: 4 });
    assert.equal(r.totalDice, 5);                                // 3 + pheromones 2
    assert.match(chat.at(-1).content, /pheromones \+2/);
    const fa = a.findSkill("Firearms");
    assert.deepEqual({ soft: fa.soft, r: fa.system.rating }, { soft: true, r: 3 });   // the chip, capped by skillwires 3
    assert.equal(a.previewAttack(gun, { range: "short" }).dice, 3);
    assert.equal(a.findSkill("Japanese"), undefined);           // not slotted
    assert.deepEqual(a.softSkills().map((x: any) => x.name), ["Firearms"]);
    faces.push(1, 1, 1);
    const r2 = await a.rollSkill(a.items.get("fa"), { targetNumber: 4 });
    assert.equal(r2.totalDice, 3);
    assert.match(chat.at(-1).content, /skillsoft: Pistols chip/);
  });

  test("decking without a datajack warns (or is refused as a house rule); flare compensation stops a flash", async (t) => {
    t.after(oldWay({"BOOK_V78.flash.mode": "blind"})); // v0.78.0: the old rule (a house rule)
    warnings.length = 0;
    const deck = { id: "deck", type: "cyberdeck", name: "Deck", system: { active: true, mpcp: 4, bod: 3, evasion: 3, masking: 3, sensors: 3, hardening: 0, responseIncrease: 0, activeMemory: 100 } };
    const a = sam([deck]);
    assert.equal(await a.jackIn(null), true);
    assert.match(warnings.at(-1) ?? "", /no datajack \(jacking in anyway\)/);
    await a.jackOut();
    (RULES.CYBERWARE.datajack as any).decking = "block";
    try {
      assert.equal(await a.jackIn(null), false);
      const b = sam([deck, cw("dj", "Datajack", { essenceCost: 0.2 })]);
      assert.equal(await b.jackIn(null), true);
    } finally { (RULES.CYBERWARE.datajack as any).decking = "warn"; }
    chat.length = 0;
    const plain = sam([]), flare = sam([cw("fc", "Cybereyes", { flareComp: true })]);
    const blinded: string[] = [];
    for (const x of [plain, flare]) (x as any).toggleStatusEffect = async (id: string) => { if (id === "blind") blinded.push(x.uuid); };
    await plain.postBlast({ attackerUuid: plain.uuid, weaponName: "Flash-bang", power: 6, level: "M", damageType: "stun", perMetre: 1, point: { x: 0, y: 0, elevation: 0 }, dodge: false, kind: "flash" },
      [{ targetUuid: plain.uuid, name: "Plain", metres: 1 }, { targetUuid: flare.uuid, name: "Flare", metres: 1 }], "");
    assert.deepEqual(blinded, [plain.uuid]);
    assert.match(chat.at(-1).content, /flare compensation: not blinded/);
  });
});

describe("v0.30.0 bioware depth", () => {
  const C = { body: 6, quickness: 4, strength: 3, charisma: 3, intelligence: 4, willpower: 4 };
  const withGet = (list: any[]) => Object.assign(list, { get(id: string) { return list.find((i: any) => i.id === id); } });
  const bw = (id: string, name: string, sys: any = {}) => ({ id, type: "cyberware", name, system: { essenceCost: 0, grade: "standard", installed: true, attributes: {}, reaction: 0, initiativeDice: 0, kind: "other", reflexes: "", damaged: false, housedIn: "", bioware: true, bodyIndex: 0.5, bioKind: "other", rating: 0, cultured: false, bioActive: false, ...sys } });
  const person = (items: any[], extra: any = {}) => {
    const a = makeActor(C, { poolSpent: { combat: 0, spell: 0, hacking: 0, control: 0 }, karma: { pool: 0, poolSpent: 0 }, ...extra });
    a.name = "Bio"; a.type = "character";
    a.items = withGet(items.map((it) => ({ ...it, async update(d: any) { for (const [k, v] of Object.entries(d)) setPath(this, k, v); a.system.prepareDerivedData(); } })));
    a.system.parent = a; a.system.prepareDerivedData();
    uuidRegistry.set(a.uuid, a);
    return a;
  };
  before(() => {
    g.fromUuidSync = (u: string) => uuidRegistry.get(u) ?? null;
    g.game.users = [{ id: "gm1", isGM: true }];
    g.game.user = { isGM: true, id: "gm1" };
    g.game.time = { worldTime: 0 };
  });

  test("bioware kinds add their effects; synaptic accelerators don't stack with wired reflexes; cultured and conflict warnings", (t) => {
    t.after(oldWay({ "GEAR_V923.bioware": "old", "GEAR_V923.cultured": "old", "GEAR_V923.dermal": "armor" })); // v0.92.3: the old way (v0.92.2); __tests__/v0923-gear.test.ts has the book's
    const a = person([
      bw("mus", "Muscle Augmentation 2", { bioKind: "muscleAugmentation", rating: 2, bodyIndex: 0.8 }),
      bw("cb", "Cerebral Booster 1", { bioKind: "cerebralBooster", rating: 1, bodyIndex: 0.4 }),
      bw("syn", "Synaptic Accelerator 2", { bioKind: "synapticAccelerator", rating: 2, bodyIndex: 1, cultured: true }),
      { id: "wr", type: "cyberware", name: "Wired Reflexes 1", system: { essenceCost: 2, grade: "standard", installed: true, attributes: {}, reaction: 2, initiativeDice: 1 } },
      bw("or", "Orthoskin 3", { bioKind: "orthoskin", rating: 3, bodyIndex: 0.75 }),
      { id: "dp", type: "cyberware", name: "Dermal Plating 2", system: { essenceCost: 1, grade: "standard", installed: true, attributes: {}, armorBallistic: 2, armorImpact: 2 } },
    ]);
    assert.equal(a.system.attributes.strength.total, 5);
    assert.equal(a.system.attributes.intelligence.total, 5);
    assert.equal(a.system.derived.initiativeDice, 3);            // synaptic 2 beats wired 1; they don't stack
    assert.equal(a.system.derived.reaction, Math.floor((4 + 5) / 2));  // wired's +2 Reaction is dropped too
    assert.ok(a.system.derived.cyberWarnings.some((w: string) => /Cerebral Booster 1 should be cultured/.test(w)));
    assert.ok(a.system.derived.cyberWarnings.some((w: string) => /Orthoskin 3 and Dermal Plating 2 don't stack/.test(w)));
    assert.deepEqual(a.system.derived.cyberArmor, { ballistic: 2, impact: 3 });   // plating 2/2, plus orthoskin 1/3 only above 2
  });

  test("damage compensators ignore wound boxes; platelet factories take a box off Physical hits; toxin extractors add dice", async (t) => {
    t.after(oldWay({"BOOK_V78.toxinBioware": "dice"})); // v0.78.0: the old rule (a house rule)
    chat.length = 0;
    const a = person([
      bw("dc", "Damage Compensator 2", { bioKind: "damageCompensator", rating: 2, bodyIndex: 0.4 }),
      bw("pf", "Platelet Factory", { bioKind: "plateletFactory", rating: 1, bodyIndex: 0.4 }),
      bw("tx", "Toxin Extractor 3", { bioKind: "toxinExtractor", rating: 3, bodyIndex: 0.6 }),
    ]);
    await a.update({ "system.monitor.physical": 2 });
    assert.equal(a.system.derived.woundModifier, 0);
    assert.deepEqual(a.woundModifiers(), []);
    await a.update({ "system.monitor.physical": 3 });
    assert.equal(a.system.derived.woundModifier, 1);             // 3 − 2 = 1 box: Light
    await a.update({ "system.monitor.physical": 0 });
    faces.push(1, 1, 1, 1, 1, 2);                                // Body 6 vs 9 − 0: nothing; S = 6 boxes, −1
    await a.resistDamage({ power: 9, level: "S", armor: 0, type: "physical" });
    assert.equal(a.system.monitor.physical, 5);
    assert.equal(a.system.derived.toxinDice, 3 - 0);             // Body Index 1.4 × 0.5 → −0 dice
  });

  test("Body Index raises the patient's healing TNs", async (t) => {
    t.after(oldWay({ "GEAR_V923.bioHealing": "all" })); // v0.92.3: the old way (v0.92.2); __tests__/v0923-gear.test.ts has the book's
    chat.length = 0;
    const a = person([bw("big", "Lots of bioware", { bodyIndex: 4 })]);
    await a.update({ "system.monitor.stun": 2 });
    // v0.92.3 (RULES.HEALTH_V923.bodyIndexHealing 'magical', Shadowtech bionetics): only magical healing by the book.
    faces.push(1, 1, 1, 1, 1, 1);
    const b = await a.naturalHeal({ track: "stun", hours: 1 });
    assert.ok(!b.modifiers.some((m: any) => /^Body Index/.test(String(m.label))));
    t.after(oldWay({ 'HEALTH_V923.bodyIndexHealing': 'natural' }));
    faces.push(1, 1, 1, 1, 1, 1);
    const r = await a.naturalHeal({ track: "stun", hours: 1 });
    assert.ok(r.modifiers.some((m: any) => m.label === "Body Index 4" && m.value === 2));
  });

  test("adrenal pumps: bonuses while active, a Stun crash when switched off", async (t) => {
    t.after(oldWay({ "GEAR_V923.bioware": "old", "GEAR_V923.adrenalCrash": "old" })); // v0.92.3: the old way (v0.92.2); __tests__/v0923-gear.test.ts has the book's
    chat.length = 0;
    const a = person([bw("ap", "Adrenal Pump 1", { bioKind: "adrenalPump", rating: 1, bodyIndex: 1.25 })]);
    assert.equal(a.system.attributes.quickness.total, 4);
    await a.setAdrenalPump("ap", true);
    assert.equal(a.system.attributes.quickness.total, 5);
    assert.equal(a.system.attributes.strength.total, 4);
    await a.setAdrenalPump("ap", false);
    assert.equal(a.system.attributes.quickness.total, 4);
    assert.match(chat.at(-1).content, /Resist the crash \(Body vs 6, M Stun\)/);
    faces.push(1, 1, 1, 1, 1, 2);
    await a.rollAdrenalCrash(1);
    assert.equal(a.system.monitor.stun, 3);
  });

  test("surgery installs the item and sets recovery; no successes means complications", async (t) => {
    t.after(oldWay({ "GEAR_V923.surgery": "old" })); // v0.92.3: the old way (v0.92.2); __tests__/v0923-gear.test.ts has the book's
    chat.length = 0;
    const doc = person([{ id: "bt", type: "skill", name: "Biotech", system: { rating: 5, attribute: "intelligence" } }]);
    const patient = person([{ id: "ww", type: "cyberware", name: "Wired Reflexes 1", system: { essenceCost: 2, grade: "alpha", installed: false, attributes: {}, reaction: 2, initiativeDice: 1 } }]);
    faces.push(1, 1, 1, 2, 2);                                   // vs TN 5 (alpha): nothing
    await patient.surgery("ww", { surgeon: doc });
    assert.equal(patient.system.monitor.physical, 1);
    assert.match(chat.at(-1).content, /Complications/);
    faces.push(5, 5, 1, 1, 1);                                   // 2 successes: 2 × 10 / 2 = 10 days
    await patient.surgery("ww", { surgeon: doc });
    assert.equal(patient.items.get("ww").system.installed, true);
    assert.match(chat.at(-1).content, /recovers in <strong>10 days<\/strong>/);
  });
});

describe("v0.31.0 toxins, drugs, hazards, stun weapons, statuses", () => {
  const P = { body: 4, quickness: 5, strength: 3, charisma: 3, intelligence: 4, willpower: 4 };
  const withGet = (list: any[]) => Object.assign(list, { get(id: string) { return list.find((i: any) => i.id === id); } });
  const person = (items: any[] = [], extra: any = {}) => {
    const a = makeActor(P, { poolSpent: { combat: 0, spell: 0, hacking: 0, control: 0 }, karma: { pool: 0, poolSpent: 0 }, drugs: [], ...extra });
    a.name = extra.name ?? "Runner"; a.type = "character";
    a.items = withGet(items.map((it) => ({ ...it, async update(d: any) { for (const [k, v] of Object.entries(d)) setPath(this, k, v); a.system.prepareDerivedData(); } })));
    const st = new Set<string>(extra.statuses ?? []);
    (a as any).statuses = st;
    (a as any).toggleStatusEffect = async (id: string, o: any) => { if (o?.active === false) st.delete(id); else st.add(id); };
    a.system.parent = a; a.system.prepareDerivedData();
    uuidRegistry.set(a.uuid, a);
    return a;
  };
  const tox = (id: string, name: string, toxin: any) => ({ id, type: "gear", name, system: { quantity: 3, toxin: { kind: "toxin", vector: "injection", power: 6, level: "M", damageType: "physical", speed: "immediate", effect: "", attributes: {}, reaction: 0, initiativeDice: 0, durationMinutes: 0, crashPower: 0, crashLevel: "", addiction: 0, ...toxin } } });
  before(() => {
    g.fromUuidSync = (u: string) => uuidRegistry.get(u) ?? null;
    g.game.users = [{ id: "gm1", isGM: true }];
    g.game.user = { isGM: true, id: "gm1" };
    g.game.time = { worldTime: 0 };
    delete g.game.combat;
  });

  test("toxins: an Expose card, then Body + toxin dice (inhalant dice when inhaled) vs Power, staged, no armor", async (t) => {
    t.after(oldWay({"BOOK_V78.toxinBioware": "dice"})); // v0.78.0: the old rule (a house rule)
    t.after(oldWay({ 'HEALTH_V923.dwarfResistance': 'both' })); // v0.92.3: the old dwarf dice vs toxins (the book: disease only)
    chat.length = 0;
    const gm = person();
    const dwarf = person([{ id: "tf", type: "cyberware", name: "Tracheal Filter 2", system: { bioware: true, bodyIndex: 0.4, bioKind: "trachealFilter", rating: 2, installed: true, essenceCost: 0, grade: "standard", attributes: {} } }], { metatype: "dwarf", name: "Dwarf" });
    const gas = tox("g", "Neuro-stun", { vector: "inhalation", power: 8, level: "S", damageType: "stun" });
    await gm.exposeTo(gas, [dwarf.uuid]);
    const state = chat.at(-1).flags.sr2e.toxins[0];
    assert.match(chat.at(-1).content, /Neuro-stun<\/strong> \(toxin, inhalation, 8S stun\): immediately/);
    // Body 5 (dwarf +1) + 2 dwarf toxin dice + 2 tracheal filter = 9 dice
    faces.push(1, 1, 1, 1, 1, 1, 1, 1, 2);
    await dwarf.resistToxin(state);
    assert.match(chat.at(-1).content, /9 dice vs TN <strong>8<\/strong>/);
    assert.equal(dwarf.system.monitor.stun, 6);
  });

  test("drugs: a dose gives bonuses for its duration; when it wears off the crash is resisted", async () => {
    chat.length = 0;
    g.game.time.worldTime = 0;
    const a = person([tox("j", "Jazz", { kind: "drug", attributes: { quickness: 1 }, reaction: 2, initiativeDice: 2, durationMinutes: 10, crashPower: 6, crashLevel: "M" })]);
    const before = { q: a.system.attributes.quickness.total, d: a.system.derived.initiativeDice, r: a.system.derived.reaction };
    assert.equal(await a.takeDrug("j"), true);
    assert.equal(a.items.get("j").system.quantity, 2);
    assert.deepEqual({ q: a.system.attributes.quickness.total, d: a.system.derived.initiativeDice }, { q: before.q + 1, d: before.d + 2 });
    assert.equal(a.system.derived.reaction, before.r + 3);       // Quickness 6: (6 + 4) / 2 = 5 (was 4), +2 from the drug
    g.game.actors = [a];
    try {
      await SR2Actor.timedEffects({ worldTime: 500 });
      assert.equal(a.system.drugs.length, 1);
      await SR2Actor.timedEffects({ worldTime: 600 });
      assert.equal(a.system.drugs.length, 0);
    } finally { delete g.game.actors; }
    assert.equal(a.system.derived.initiativeDice, before.d);
    const c = chat.at(-1).flags.sr2e.drugCrash;
    assert.deepEqual({ p: c.power, l: c.level }, { p: 6, l: "M" });
    faces.push(1, 1, 1, 2);
    await a.resistToxin({ name: c.name, vector: "ingestion", power: c.power, level: c.level, damageType: "stun", label: "Jazz crash" });
    assert.equal(a.system.monitor.stun, 3);
  });

  test("blinded characters fire blind and cast blind; flash blindness wears off; prone characters stand up", async () => {
    chat.length = 0;
    const a = person([], { statuses: ["blind", "prone"] });
    const gun = { id: "g", name: "Pistol", system: { melee: false, skill: "Firearms", damagePower: 6, damageLevel: "M", damageType: "physical", modes: "SA", ammo: 10, ammoMax: 10, recoilComp: 0 } };
    assert.ok(a.previewAttack(gun, { range: "short" }).modifiers.some((m: any) => m.label === "Blinded" && m.value === 8));
    assert.ok(!a.previewAttack(gun, { range: "short", visibility: "blind" }).modifiers.some((m: any) => m.label === "Blinded"));
    assert.equal(await a.standUp(), true);
    assert.equal(a.hasStatus("prone"), false);
    const b = person();
    await b.setTimedStatus("blind", 9);
    assert.equal(b.hasStatus("blind"), true);
    g.game.actors = [b];
    try { await SR2Actor.timedEffects({ worldTime: 9 }); } finally { delete g.game.actors; }
    assert.equal(b.hasStatus("blind"), false);
    assert.match(chat.at(-1).content, /no longer blind/);
  });

  test("stun weapons do Stun against half impact armor; hazards: falling, fire, drowning", async (t) => {
    // v0.92.3: the old falling and drowning (the book's: v0923-health glue tests).
    t.after(oldWay({ 'HEALTH_V923.falling': 'old', 'HEALTH_V923.drowning': 'test', 'HEALTH_V923.breathHold': 'none' }));
    chat.length = 0;
    const a = person([{ id: "arm", type: "armor", name: "Vest", system: { worn: true, ballistic: 4, impact: 4 } }]);
    const taser = { id: "t", name: "Taser", system: { melee: false, skill: "Firearms", damagePower: 10, damageLevel: "S", damageType: "physical", modes: "SS", ammo: 4, ammoMax: 4, recoilComp: 0, stunWeapon: true } };
    const plan = a.planAttack(taser, { range: "short" });
    assert.deepEqual({ t: plan.damageType, k: plan.extras.armorKind, m: plan.extras.armorMultiplier }, { t: "stun", k: "impact", m: 0.5 });
    faces.push(1, 1, 1, 2);                                       // Body 4 vs 8 − 2 (half impact 4)
    await a.resistHazard("falling", 8);
    assert.match(chat.at(-1).content, /Resist 8S physical, armor 2/);
    assert.equal(a.system.monitor.physical, 6);
    faces.push(1, 1, 1, 2);
    await a.resistHazard("fire", "burning");
    assert.match(chat.at(-1).content, /Resist 6M physical, armor 2/);
    faces.push(1, 1, 1, 2);
    await a.resistHazard("drowning", 2);
    assert.match(chat.at(-1).content, /Drowning \(2 turns under\)/);
    assert.match(chat.at(-1).content, /TN <strong>6<\/strong>/);
    assert.equal(a.system.monitor.stun, 3);
  });
});

describe("v0.32.0 perception, social tests, grunt groups, morale", () => {
  const P = { body: 4, quickness: 5, strength: 3, charisma: 3, intelligence: 4, willpower: 4 };
  const withGet = (list: any[]) => Object.assign(list, { get(id: string) { return list.find((i: any) => i.id === id); } });
  const person = (items: any[] = [], extra: any = {}) => {
    const a = makeActor(P, { poolSpent: { combat: 0, spell: 0, hacking: 0, control: 0 }, karma: { pool: 0, poolSpent: 0 }, drugs: [], ...extra });
    a.name = extra.name ?? "Runner"; a.type = extra.type ?? "character";
    a.items = withGet(items);
    (a as any).statuses = new Set<string>();
    a.system.parent = a; a.system.prepareDerivedData();
    uuidRegistry.set(a.uuid, a);
    return a;
  };
  const skill = (id: string, name: string, rating: number) => ({ id, type: "skill", name, system: { rating, attribute: "intelligence", specializations: [] } });
  before(() => {
    g.fromUuidSync = (u: string) => uuidRegistry.get(u) ?? null;
    g.game.users = [{ id: "gm1", isGM: true }];
    g.game.user = { isGM: true, id: "gm1" };
    g.game.time = { worldTime: 0 };
    delete g.game.combat;
  });

  test("perception: Perception vs the sneaker's Stealth, opposed by Stealth vs the observer's Intelligence", async () => {
    chat.length = 0;
    const guard = person([skill("p", "Perception", 3)], { name: "Guard" });
    const ninja = person([skill("s", "Stealth", 5)], { name: "Ninja" });
    faces.push(5, 5, 1);              // guard: 3 dice vs TN 5 → 2 successes
    faces.push(5, 1, 1, 1, 1);        // ninja: 5 dice vs TN 4 → 1 success
    const r = await guard.perceive(ninja.uuid, { whisper: true });
    assert.deepEqual(r, { noticed: true, net: 1 });
    assert.match(chat.at(-1).content, /Guard notices Ninja/);
    assert.deepEqual(chat.at(-1).whisper, ["gm1"]);
  });

  test("social tests: skill vs the target's attribute; pheromones add dice", async (t) => {
    t.after(oldWay({ 'DOCS_V79.socialInfluence.mode': 'opposed' })); // v0.79.0: the old opposed test (a house rule)
    chat.length = 0;
    const face = person([skill("n", "Negotiation", 4), { id: "ph", type: "cyberware", name: "Tailored pheromones", system: { installed: true, essenceCost: 0.4, grade: "standard", attributes: {}, pheromones: 2 } }], { name: "Face" });
    const fixer = person([skill("n2", "Negotiation", 3)], { name: "Fixer" });
    faces.push(4, 4, 1, 1, 1, 1);     // face: 4 + 2 pheromones vs Fixer's Charisma 3
    faces.push(1, 1, 1);
    const r = await face.socialTest("Negotiation", fixer.uuid);
    assert.deepEqual(r, { winner: "initiator", net: 2 });
    assert.match(chat.at(-1).content, /pheromones \+2/);
    assert.match(chat.at(-1).content, /Face wins/);
  });

  test("v0.79.0 one-sided social test (DOCS_V79.socialInfluence): only the speaker rolls; one success passes", async () => {
    chat.length = 0;
    const face = person([skill("n", "Etiquette", 3)], { name: "Face" });
    const mark = person([skill("n2", "Etiquette", 3)], { name: "Mark" });
    faces.push(4, 1, 1);                              // Etiquette 3 vs Mark's Charisma: one success
    const n = faces.length;
    const r = await face.socialTest("Etiquette", mark.uuid);
    assert.equal(faces.length, n - 3, "the target doesn't roll");
    assert.deepEqual(r, { winner: "initiator", net: 1 });
    assert.equal(chat.at(-1).flags.sr2e.contest.oneSided, true);
    assert.equal(chat.at(-1).flags.sr2e.contest.sides.length, 1);
    assert.match(chat.at(-1).content, /It works\./);
    faces.push(2, 1, 1);
    assert.deepEqual(await face.socialTest("Etiquette", mark.uuid), { winner: "none", net: 0 });
    assert.match(chat.at(-1).content, /No luck: Mark isn/);
  });

  test("grunt groups: when the front grunt goes down the next steps in; the group attacks with every grunt; morale", async () => {
    chat.length = 0;
    const g4 = person([], { name: "Lone Star", type: "npc", professionalRating: 2, grunts: { size: 3, down: 0 }, care: { dyingSince: -1, stabilised: false } });
    g4.system.monitor.physical = 10; g4.system.prepareDerivedData();
    await g4.syncCondition("ok", { physical: true, stun: false });
    assert.deepEqual({ d: g4.system.grunts.down, p: g4.system.monitor.physical }, { d: 1, p: 0 });
    assert.match(chat.at(-1).content, /2 standing/);
    assert.equal(chat.at(-1).flags.sr2e.morale.actorUuid, g4.uuid);
    // The group attacks with each standing grunt.
    let calls = 0;
    const orig = g4.attackWith;
    (g4 as any).attackWith = async () => { calls++; return {}; };
    try { assert.equal(await g4.gruntAttack({ name: "SMG" }, {}), 2); } finally { (g4 as any).attackWith = orig; }
    assert.equal(calls, 2);
    // Morale: PR 2 dice vs 4 + 1 down = 5.
    faces.push(1, 4);
    assert.deepEqual(await g4.moraleTest(), { broken: true });
    assert.match(chat.at(-1).content, /TN <strong>5<\/strong>/);
    assert.match(chat.at(-1).content, /Lone Star breaks/);
    // The last grunt down is just down: no handover.
    g4.system.grunts.down = 2; g4.system.monitor.physical = 10; g4.system.prepareDerivedData();
    await g4.syncCondition("ok", { physical: true, stun: false });
    assert.equal(g4.system.grunts.down, 2);
  });
});

describe("v0.33.0 upkeep: Karma, nuyen, lifestyle, contacts, buying", () => {
  const P = { body: 4, quickness: 5, strength: 3, charisma: 4, intelligence: 4, willpower: 4 };
  const withGet = (list: any[]) => Object.assign(list, { get(id: string) { return list.find((i: any) => i.id === id); } });
  const person = (items: any[] = [], extra: any = {}) => {
    const a = makeActor(P, { poolSpent: { combat: 0, spell: 0, hacking: 0, control: 0 }, karma: { good: 0, pool: 1, poolSpent: 0, career: 0 }, drugs: [], nuyen: 0, lifestyle: { level: "low", paidUntil: -1 }, contacts: [], ledger: [], metatype: "human", ...extra });
    a.name = extra.name ?? "Runner"; a.type = "character";
    a.items = withGet(items.map((it) => ({ ...it, async update(d: any) { for (const [k, v] of Object.entries(d)) setPath(this, k, v); a.system.prepareDerivedData(); } })));
    (a as any).statuses = new Set<string>();
    a.system.parent = a; a.system.prepareDerivedData();
    uuidRegistry.set(a.uuid, a);
    return a;
  };
  before(() => {
    g.fromUuidSync = (u: string) => uuidRegistry.get(u) ?? null;
    g.game.users = [{ id: "gm1", isGM: true }];
    g.game.user = { isGM: true, id: "gm1" };
    g.game.time = { worldTime: 0 };
    delete g.game.combat;
  });

  test("Karma awards feed the Karma Pool every 10 earned; the ledger records it", async () => {
    const a = person([], { karma: { good: 2, pool: 3, poolSpent: 0, career: 8 } });
    assert.deepEqual(await a.awardKarma(5, "The run"), { good: 4, pool: 1 });
    assert.deepEqual({ g: a.system.karma.good, p: a.system.karma.pool, c: a.system.karma.career }, { g: 6, p: 4, c: 13 });
    assert.deepEqual(a.system.ledger.map((e: any) => [e.kind, e.amount]), [["karma", 4], ["pool", 1]]);
    const elf = person([], { metatype: "elf", karma: { good: 0, pool: 1, poolSpent: 0, career: 8 } });
    assert.deepEqual(await elf.awardKarma(5), { good: 5, pool: 0 });
  });

  test("nuyen and lifestyle: paying a month, refusing to go below zero", async () => {
    chat.length = 0;
    const a = person([], { nuyen: 1500 });
    assert.equal(await a.adjustNuyen(-2000, "Too much"), false);
    assert.equal(await a.payLifestyle(1), true);
    assert.equal(a.system.nuyen, 500);
    assert.equal(a.lifestyleStatus().days, 30);
    assert.match(chat.at(-1).content, /pays 1 month of Low lifestyle \(¥1,000\): paid for 30 days/);
    g.game.time.worldTime = 35 * 86400;
    try { assert.equal(a.lifestyleStatus().days, -5); } finally { g.game.time.worldTime = 0; }
    assert.equal(await a.payLifestyle(1), false);              // ¥500 left
  });

  test("raising attributes and skills with Good Karma", async () => {
    chat.length = 0;
    const a = person([{ id: "f", type: "skill", name: "Firearms", system: { rating: 4, attribute: "quickness", specialization: "Pistols", specializationRating: 5, kind: "active" } }], { karma: { good: 20, pool: 1, poolSpent: 0, career: 20 } });
    assert.deepEqual(a.improveCost({ attribute: "body" }), { cost: 10, ok: true, reason: "", from: 4, to: 5, label: "Body" });
    assert.equal(await a.improve({ attribute: "body" }), true);
    assert.equal(a.system.attributes.body.base, 5);
    assert.equal(a.system.karma.good, 10);
    // v0.79.0 (RULES.DOCS_V79.skillKarma 'flat', the book table): 5 × 2 = 10; specialization 6 × 1; concentration 5 × 1.5.
    assert.equal(a.improveCost({ skillId: "f" }).cost, 10);
    assert.equal(a.improveCost({ skillId: "f", specialization: true }).cost, 6);
    const restore = oldWay({ 'DOCS_V79.skillKarma.mode': 'bands' }); // the rest of this test: the old bands
    try {
    assert.equal(a.improveCost({ skillId: "f" }).cost, 8);     // 5 ≤ Quickness 5: × 1.5 = 7.5 → 8
    assert.equal(await a.improve({ skillId: "f" }), true);
    assert.equal(a.items.get("f").system.rating, 5);
    assert.equal(a.system.karma.good, 2);
    assert.equal(await a.improve({ skillId: "f", specialization: true }), false); // 6 × 2 ÷ 2 = 6 > 2
    assert.equal(a.improveCost({ attribute: "body" }).cost, 12);
    assert.match(chat.at(-1).content, /raises Firearms from 4 to 5 for 8 Karma/);
    } finally { restore(); }
  });

  test("legwork through a contact; finding and buying gear", async (t) => {
    t.after(oldWay({"BOOK_V78.legwork.mode": "tn"})); // v0.78.0: the old rule (a house rule)
    chat.length = 0;
    const a = person([
      { id: "e", type: "skill", name: "Etiquette", system: { rating: 3, attribute: "charisma", specialization: "", specializationRating: 0 } },
      { id: "m", type: "gear", name: "Medkit", system: { quantity: 1, cost: 200, availability: "4/48 hrs", streetIndex: 1.5 } },
    ], { nuyen: 1000 });
    const id = await a.addContact({ name: "Joe", level: 3, role: "Fixer" });
    faces.push(5, 4, 1);                                        // TN 6 − 2 = 4: 2 successes
    const lw = await a.legwork(id, { difficultyTn: 6 });
    assert.deepEqual(lw, { successes: 2, tier: "The basics" });
    assert.match(chat.at(-1).content, /TN <strong>4<\/strong>/);
    faces.push(5, 5, 1);                                        // 2 successes: 48 / 2 = 24 hours
    const f = await a.findItem("m");
    assert.deepEqual(f, { found: true, hours: 24, price: 300 });
    assert.match(chat.at(-1).content, /Found in <strong>24 hours<\/strong>/);
    assert.deepEqual(chat.at(-1).flags.sr2e.buy, { actorUuid: a.uuid, itemId: "m", price: 300, name: "Medkit", qty: 1, hours: 24 });
    assert.equal(await a.buyItem("m", 300), true);
    assert.equal(a.system.nuyen, 700);
    assert.equal(a.system.ledger.at(-1).reason, "Bought Medkit");
  });

  test("the GM's group award", async () => {
    chat.length = 0;
    const a = person([], { name: "A", karma: { good: 0, pool: 1, poolSpent: 1, career: 9 } });
    const b = person([], { name: "B", nuyen: 0 });
    assert.equal(await SR2Actor.awardGroup([a.uuid, b.uuid], { karma: 3, nuyen: 5000, reason: "Run", refreshPool: true }), 2);
    assert.deepEqual({ g: a.system.karma.good, p: a.system.karma.pool, s: a.system.karma.poolSpent, n: a.system.nuyen }, { g: 2, p: 2, s: 0, n: 5000 });
    assert.match(chat.at(-1).content, /A: 2 Karma, Karma Pool \+1; ¥5,000; Karma Pool refreshed/);
  });
});

describe("v0.34.0 player-client fixes", () => {
  test("a GM card posted from a player's client is blind to that player", async () => {
    chat.length = 0;
    g.game.users = [{ id: "gm1", isGM: true }, { id: "p1", isGM: false }];
    const prevUser = g.game.user;
    g.game.user = { isGM: false, id: "p1" };
    try {
      const host = { uuid: "Actor.hostX", name: "Host X", isOwner: false };
      await SR2Actor.changeHost(host, { minAlert: "active" } as any, "Test change");
      assert.equal(chat.at(-1).blind, true);
      assert.deepEqual(chat.at(-1).whisper, ["gm1"]);
      const site = { uuid: "Actor.siteX", name: "Site X", isOwner: false, device: () => ({ name: "Lock" }) };
      await SR2Actor.changeSite(site, { add: 1 } as any, "Test site");
      assert.equal(chat.at(-1).blind, true);
    } finally { g.game.user = prevUser; }
  });
});

describe("v0.35.0 combat flow: delay, full defense, buying successes, disasters, GM overrides", () => {
  const P = { body: 4, quickness: 5, strength: 3, charisma: 3, intelligence: 4, willpower: 4 };
  const withGet = (list: any[]) => Object.assign(list, { get(id: string) { return list.find((i: any) => i.id === id); } });
  const person = (items: any[] = [], extra: any = {}) => {
    const a = makeActor(P, { poolSpent: { combat: 0, spell: 0, hacking: 0, control: 0 }, karma: { good: 0, pool: 3, poolSpent: 0, career: 0 }, drugs: [], ...extra });
    a.name = extra.name ?? "Runner"; a.type = "character"; (a as any).id = `id-${a.uuid}`;
    a.items = withGet(items.map((it) => ({ ...it, async update(d: any) { for (const [k, v] of Object.entries(d)) setPath(this, k, v); } })));
    (a as any).statuses = new Set<string>();
    a.system.parent = a; a.system.prepareDerivedData();
    uuidRegistry.set(a.uuid, a);
    return a;
  };
  const combatWith = (actors: any[], current = 0) => {
    const combatants = actors.map((a, i) => ({ id: `cb${i}`, actor: a, actorId: a.id, initiative: 20 - i, name: a.name }));
    const c: any = {
      id: "cmb", started: true, round: 1, pass: 0, turn: current, combatants: Object.assign(combatants, { get: (id: string) => combatants.find((x) => x.id === id) }),
      turns: combatants, get combatant() { return this.turns[this.turn]; },
      async nextTurn() { this.turn += 1; }, async updateEmbeddedDocuments(_t: string, ups: any[]) { for (const u of ups) { const x = combatants.find((y) => y.id === u._id); if (x) x.initiative = u.initiative; } },
    };
    g.game.combat = c;
    return c;
  };
  before(() => {
    g.fromUuidSync = (u: string) => uuidRegistry.get(u) ?? null;
    g.game.users = [{ id: "gm1", isGM: true }];
    g.game.user = { isGM: true, id: "gm1" };
    g.game.time = { worldTime: 0 };
  });

  test("delaying: the turn moves on; acting now counts as acting; it is lost at the end of the pass", async () => {
    chat.length = 0;
    const a = person([], { name: "Pell" }); const b = person([], { name: "Ganger" });
    const c = combatWith([a, b], 0);
    try {
      assert.equal(await b.delayAction(), false);                 // not b's turn
      assert.equal(await a.delayAction(), true);
      assert.equal(c.turn, 1);
      assert.equal(a.isDelaying(), true);
      assert.equal(a.isActing(), false);
      assert.equal(await a.actNow(), true);
      assert.equal(a.isActing(), true);
      assert.match(chat.at(-1).content, /takes the delayed action now, before Ganger/);
      assert.equal(a.currentPhaseKey()?.includes("cb0"), true);   // actions count to Pell's phase
      await a.endDelayedAction();
      assert.equal(a.isActing(), false);
      await a.setFlag("sr2e", "delayed", { combatId: "cmb", round: 1, pass: 0 });
      c.pass = 1;
      assert.equal(a.isDelaying(), false);
    } finally { delete g.game.combat; }
  });

  test("full defense: declared out of turn costs initiative, then covers every attack until the next action", async () => {
    chat.length = 0;
    const a = person([], { name: "Pell" }); const b = person([], { name: "Ganger" });
    const c = combatWith([b, a], 0);                               // Ganger is acting
    try {
      assert.equal(await a.declareFullDefense(), true);
      assert.equal(c.combatants[1].initiative, 9);                  // 19 − 10
      assert.equal(a.fullDefenseUp(), true);
      const attack = { attackerUuid: b.uuid, targetUuid: a.uuid, weaponName: "Gun", melee: false, damageType: "physical", power: 6, level: "M", attackSuccesses: 2, targetNumber: 4 } as any;
      faces.push(1, 1, 1, 1, 1);                                    // 5 Quickness dice from full defense, no pool
      await a.defend(attack, 0);
      assert.match(chat.at(-1).content, /Full defense \(\+5 dice\)/);
      assert.equal(c.combatants[1].initiative, 9);                  // no second cost
      c.pass = 1; c.turn = 1;                                       // Pell's turn in the next pass
      assert.equal(a.fullDefenseUp(), false);
    } finally { delete g.game.combat; }
  });

  test("buying a success with Karma Pool (permanent), and a jammed weapon after a disaster", async () => {
    chat.length = 0;
    const gun = { id: "g", type: "weapon", name: "Pistol", system: { melee: false, skill: "Firearms", damagePower: 6, damageLevel: "M", damageType: "physical", modes: "SA", ammo: 10, ammoMax: 10, recoilComp: 0, jammed: false } };
    const a = person([gun]);
    faces.push(5, 1, 1, 1, 1);                                      // 1 success at TN 4
    await a.rollAttribute("quickness", { targetNumber: 4 });
    const snap = chat.at(-1).flags.sr2e.test;
    assert.match(chat.at(-1).content, /data-sr2e-action="buySuccess"/);
    assert.equal(await a.buySuccess(snap), true);
    assert.equal(a.system.karma.pool, 2);
    assert.match(chat.at(-1).content, /bought success #1/);
    assert.equal(chat.at(-1).flags.sr2e.test.successes, 2);
    (RULES.DISASTERS as any).prompt = true;
    try {
      faces.push(1, 1, 1, 1, 1);
      await a.attackWith(a.items.get("g"), { range: "short" });
      const d = chat.at(-1);
      assert.match(d.content, /disaster/);
      assert.match(d.content, /data-sr2e-action="jamWeapon"/);
      assert.equal(await SR2Actor.jamWeapon(a.uuid, "g"), true);
    } finally { (RULES.DISASTERS as any).prompt = false; }
    assert.equal(a.items.get("g").system.jammed, true);
    assert.equal(await a.attackWith(a.items.get("g"), { range: "short" }), null);
    assert.equal(await a.clearJam("g"), true);
    assert.equal(a.items.get("g").system.jammed, false);
  });

  test("GM overrides: undo a resist card, adjust boxes, apply unresisted; resist everyone; refresh Karma", async () => {
    chat.length = 0;
    const a = person([], { name: "A", karma: { good: 0, pool: 3, poolSpent: 2, career: 0 } });
    faces.push(2, 2, 2, 2);
    await a.resistDamage({ power: 6, level: "M", type: "physical" });
    const snap = chat.at(-1).flags.sr2e.test;
    assert.match(chat.at(-1).content, /sr2e-banner-taken">Takes M physical/);
    assert.equal(a.system.monitor.physical, 3);
    assert.equal(await SR2Actor.gmUndoSoak(snap), true);
    assert.equal(a.system.monitor.physical, 0);
    await SR2Actor.gmAdjustBoxes(a.uuid, "stun", 2);
    assert.equal(a.system.monitor.stun, 2);
    await a.applyUnresisted({ targetUuid: a.uuid, damageType: "physical", level: "S", power: 8 } as any);
    assert.equal(a.system.monitor.physical, 6);
    const b = person([], { name: "B" });
    faces.push(5, 5, 1, 1, 5, 5, 1, 1);
    const done = await SR2Actor.resistAll([{ targetUuid: a.uuid, damageType: "stun", level: "L", power: 2, armor: 0 } as any, { targetUuid: b.uuid, damageType: "stun", level: "L", power: 2, armor: 0 } as any], [0, 1]);
    assert.deepEqual(done, [0, 1]);
    g.game.actors = [a, b];
    try { assert.equal(await SR2Actor.refreshAllKarma("test"), 1); } finally { delete g.game.actors; }
    assert.equal(a.system.karma.poolSpent, 0);
  });
});

describe("v0.36.0 tokens: vision, bars, wound icons, roll modes", () => {
  test("token vision follows the eyes, and only changes what differs", async () => {
    const { visionUpdate } = await import("../applications/tokens.ts");
    const dwarf = { type: "character", system: { derived: { vision: { thermographic: true, lowLight: false, ultrasound: false } } } };
    assert.deepEqual(visionUpdate(dwarf, { sight: { enabled: true, visionMode: "basic", range: 0 }, detectionModes: [] }), { "sight.enabled": true, "sight.visionMode": "darkvision", "sight.range": 30 });
    assert.equal(visionUpdate(dwarf, { sight: { enabled: true, visionMode: "darkvision", range: 30 }, detectionModes: [] }), null);
    const sonar = { type: "npc", system: { derived: { vision: { ultrasound: true } } } };
    const u: any = visionUpdate(sonar, { sight: { enabled: true, visionMode: "basic", range: 0 }, detectionModes: [{ id: "basicSight", enabled: true, range: 0 }] });
    assert.deepEqual(u.detectionModes, [{ id: "basicSight", enabled: true, range: 0 }, { id: "feelTremor", enabled: true, range: 50 }]);
    const v14: any = visionUpdate(sonar, { sight: { enabled: true, visionMode: "basic", range: 0 }, detectionModes: { lightPerception: { enabled: true, range: null } } });
    assert.deepEqual(v14["detectionModes.feelTremor"], { enabled: true, range: 50 });
    assert.equal(v14.detectionModes, undefined);
    assert.equal(visionUpdate({ type: "vehicle", system: {} }, {}), null);
  });

  test("bars in derived data; wound icons follow the worst wound", async () => {
    const a = makeActor(A, { monitor: { physical: 4, stun: 1 } });
    assert.deepEqual(a.system.derived.bars, { physical: { value: 6, max: 10 }, stun: { value: 9, max: 10 }, matrix: { value: 10, max: 10 } });
    const st = new Set<string>();
    (a as any).statuses = st;
    (a as any).toggleStatusEffect = async (id: string, o: any) => { if (o?.active === false) st.delete(id); else st.add(id); };
    await a.syncCondition("ok", { physical: true, stun: false });
    assert.deepEqual([...st].filter((x) => x.startsWith("sr2eWound")), ["sr2eWoundM"]);
    a.system.monitor.physical = 0; a.system.monitor.stun = 0; a.system.prepareDerivedData();
    await a.syncCondition("ok", { physical: false, stun: false });
    assert.deepEqual([...st].filter((x) => x.startsWith("sr2eWound")), []);
  });

  test("roll modes: private rolls apply, cards someone must answer stay public", async () => {
    const { withRollMode } = await import("../documents/index.ts");
    const prevSettings = g.game.settings;
    g.game.settings = { get: (_s: string, k: string) => (k === "rollMode" ? "gmroll" : k === "messageMode" ? "gm" : undefined) };
    g.ChatMessage.applyRollMode = (d: any, mode: string) => ({ ...d, whisper: ["gm1"], blind: mode === "blindroll" });
    try {
      assert.deepEqual(withRollMode({ content: "<p>plain</p>" }).whisper, ["gm1"]);
      assert.equal(withRollMode({ content: '<button data-sr2e-action="defend">Defend</button>' }).whisper, undefined);
      // Foundry v14: core.messageMode and ChatMessage.applyMode.
      g.ChatMessage.applyMode = (d: any, mode: string) => { d.whisper = ["gm1"]; d.blind = mode === "blind"; return d; };
      assert.deepEqual(withRollMode({ content: "<p>plain</p>" }).whisper, ["gm1"]);
    } finally { g.game.settings = prevSettings; delete g.ChatMessage.applyRollMode; delete g.ChatMessage.applyMode; }
  });
});

describe("v0.37.0 gear and combat leftovers", () => {
  const P = { body: 4, quickness: 5, strength: 3, charisma: 3, intelligence: 4, willpower: 4 };
  const withGet = (list: any[]) => Object.assign(list, { get(id: string) { return list.find((i: any) => i.id === id); } });
  const person = (items: any[] = [], extra: any = {}) => {
    const a = makeActor(P, { poolSpent: { combat: 0, spell: 0, hacking: 0, control: 0 }, karma: { good: 0, pool: 0, poolSpent: 0, career: 0 }, drugs: [], ...extra });
    a.name = extra.name ?? "Runner"; a.type = "character"; (a as any).id = `id-${a.uuid}`;
    a.items = withGet(items.map((it) => ({ ...it, async update(d: any) { for (const [k, v] of Object.entries(d)) setPath(this, k, v); a.system.prepareDerivedData(); } })));
    (a as any).statuses = new Set<string>();
    a.system.parent = a; a.system.prepareDerivedData();
    uuidRegistry.set(a.uuid, a);
    return a;
  };
  const armor = (id: string, b: number, i: number, extra: any = {}) => ({ id, type: "armor", name: id, system: { ballistic: b, impact: i, worn: true, adds: false, degraded: 0, weight: 0, ...extra } });
  const gun = (extra: any = {}) => ({ id: "g", type: "weapon", name: "SMG", system: { melee: false, skill: "Firearms", damagePower: 6, damageLevel: "M", damageType: "physical", modes: "SA/BF/FA", ammo: 30, ammoMax: 30, recoilComp: 0, ...extra } });
  before(() => {
    g.fromUuidSync = (u: string) => uuidRegistry.get(u) ?? null;
    g.game.users = [{ id: "gm1", isGM: true }];
    g.game.user = { isGM: true, id: "gm1" };
    g.game.time = { worldTime: 0 };
    delete g.game.combat;
  });

  test("armor layering, degrading under a heavy hit, and carried weight", async (t) => {
    t.after(oldWay({ "GEAR_V923.load": "old", "GEAR_V923.armorEncumbrance": "old" })); // v0.92.3: the old way (v0.92.2); __tests__/v0923-gear.test.ts has the book's
    chat.length = 0;
    const a = person([armor("Jacket", 5, 3), armor("Vest", 4, 1), armor("Helmet", 1, 1, { adds: true })]);
    assert.equal(a.armorRating("ballistic"), 6);
    (RULES.COMBAT.armorDegrade as any).enabled = true;
    try {
      faces.push(1, 1, 1, 1);
      await a.resistFromState({ targetUuid: a.uuid, melee: false, damageType: "physical", power: 10, level: "S" } as any, 0);
      assert.match(chat.at(-1).content, /Jacket is damaged \(−1\)/);
      assert.equal(a.items.get("Jacket").system.degraded, 1);
    } finally { (RULES.COMBAT.armorDegrade as any).enabled = false; }
    assert.equal(a.armorRating("ballistic"), 5);                     // Jacket 4 = Vest 4, + helmet 1
    const b = person([{ id: "pack", type: "gear", name: "Pack", system: { quantity: 1, weight: 45 } }]);
    assert.deepEqual(b.system.derived.load, { kg: 45, limit: 30, penalty: 1 });
    assert.equal(b.system.attributes.quickness.total, 4);
  });

  test("silencers, tracers, missile guidance, flamethrowers", () => {
    const a = person([{ id: "f", type: "skill", name: "Firearms", system: { rating: 4, attribute: "quickness" } }]);
    assert.match(String(a.planAttack(gun({ muzzle: "silencer" }), { range: "short", mode: "BF" }).ammoShort), /silencer works only with SS or SA/);
    assert.ok(a.planAttack(gun({ muzzle: "silencer" }), { range: "short", mode: "SA" }).notes.some((n: string) => /silenced: noticing the shot is Perception \+4/.test(n)));
    const tr = a.planAttack(gun({ ammoType: "tracer" }), { range: "short", mode: "BF", earlierRoundsThisPhase: 3 });
    assert.ok(tr.modifiers.some((m: any) => m.label === "Tracers" && m.value === -1));
    assert.equal(a.planAttack(gun({ guidance: 3 }), { range: "short", mode: "SA" }).dice, 7);
    const fl = a.planAttack(gun({ areaKind: "flame", modes: "SS" }), { range: "short" });
    assert.deepEqual({ f: fl.extras.flame, k: fl.extras.armorKind, m: fl.extras.armorMultiplier }, { f: true, k: "impact", m: 0.5 });
  });

  test("barriers break; charges are set with Demolitions; grenades thrown back", async (t) => {
    t.after(oldWay({"BOOK_V78.barriers.mode": "subtract"})); // v0.78.0: the old rule (a house rule)
    chat.length = 0;
    const wall: any = { flags: { sr2e: { barrierRating: 6 } }, move: 20, sight: 20, light: 20, sound: 20, getFlag(_s: string, k: string) { return this.flags.sr2e[k]; }, async update(d: any) { for (const [k, v] of Object.entries(d)) { if (k.startsWith("flags.sr2e.")) this.flags.sr2e[k.slice(11)] = v; else this[k] = v; } } };
    assert.deepEqual(await SR2Actor.damageWall(wall, 9), { damage: 3, left: 3, breached: false });
    assert.deepEqual(await SR2Actor.damageWall(wall, 4, { antiVehicle: true }), { damage: 5, left: 0, breached: true });
    assert.equal(wall.move, 0);
    assert.equal(wall.flags.sr2e.breached.move, 20);
    const a = person([
      { id: "d", type: "skill", name: "Demolitions", system: { rating: 3, attribute: "intelligence" } },
      { id: "c4", type: "gear", name: "C-12", system: { quantity: 2, weight: 0, explosive: { power: 10, perMetre: 1, shaped: false } } },
      { id: "t", type: "skill", name: "Throwing", system: { rating: 4, attribute: "quickness" } },
    ]);
    faces.push(5, 5, 1);
    assert.deepEqual(await a.setCharge("c4"), { power: 12 });
    assert.equal(a.items.get("c4").system.quantity, 1);
    // v0.81.0 (SEC1-12): the card carries the charge's id (storedCharge reads its Power from the setter's record).
    const { chargeId, ...charge } = chat.at(-1).flags.sr2e.charge;
    assert.deepEqual(charge, { actorUuid: a.uuid, name: "C-12", power: 12, perMetre: 1, shaped: false });
    assert.equal(SR2Actor.storedCharge(a, chargeId)?.power, 12);
    faces.push(5, 1, 1, 1);
    assert.equal((await a.throwBackTest()).successes, 1);
  });
});

describe("v0.38.0 skills: concentrations, the Skill Web, martial arts, parry, repairs", () => {
  useV922Vehicles(); // v0.92.3: these pin the v0.92.2 vehicle rules
  const P = { body: 4, quickness: 5, strength: 4, charisma: 3, intelligence: 4, willpower: 4 };
  const withGet = (list: any[]) => Object.assign(list, { get(id: string) { return list.find((i: any) => i.id === id); } });
  const person = (items: any[] = [], extra: any = {}) => {
    const a = makeActor(P, { poolSpent: { combat: 0, spell: 0, hacking: 0, control: 0 }, karma: { good: 30, pool: 0, poolSpent: 0, career: 0 }, drugs: [], ...extra });
    a.name = extra.name ?? "Runner"; a.type = "character"; (a as any).id = `id-${a.uuid}`;
    a.items = withGet(items.map((it) => ({ ...it, async update(d: any) { for (const [k, v] of Object.entries(d)) setPath(this, k, v); a.system.prepareDerivedData(); } })));
    (a as any).statuses = new Set<string>();
    a.system.parent = a; a.system.prepareDerivedData();
    uuidRegistry.set(a.uuid, a);
    return a;
  };
  const skill = (id: string, name: string, rating: number, extra: any = {}) => ({ id, type: "skill", name, system: { rating, attribute: "quickness", specialization: "", specializationRating: 0, concentration: "", concentrationRating: 0, kind: "active", martial: { enabled: false, power: 0, stage: 0, reach: 0, defense: 0 }, ...extra } });
  before(() => {
    g.fromUuidSync = (u: string) => uuidRegistry.get(u) ?? null;
    g.game.users = [{ id: "gm1", isGM: true }];
    g.game.user = { isGM: true, id: "gm1" };
    delete g.game.combat;
  });

  test("a concentration rolls its own rating and costs less to raise", async () => {
    chat.length = 0;
    const a = person([skill("f", "Firearms", 4, { concentration: "Pistols", concentrationRating: 5 })]);
    faces.push(1, 1, 1, 1, 2);
    await a.rollSkill(a.items.get("f"), { targetNumber: 4, useConcentration: true });
    assert.match(chat.at(-1).content, /Firearms \(Pistols 5\)/);
    assert.match(chat.at(-1).content, /5 dice vs TN/);
    assert.equal(a.improveCost({ skillId: "f", concentration: true }).cost, 9);  // 6 ≤ Quickness 5 × 1.5: × 2 = 12, × 0.75 = 9
  });

  test("the Skill Web sets the defaulting TN", async () => {
    const { setSkillWeb, parseSkillWeb } = await import("../rules/index.ts");
    chat.length = 0;
    const a = person([skill("g", "Gunnery", 4)]);
    setSkillWeb(parseSkillWeb("Firearms - Gunnery: 2"));
    try {
      faces.push(1, 1, 1, 1);
      await a.rollSkill({ name: "Firearms", system: { rating: 0, attribute: "quickness" } }, { targetNumber: 4, relatedSkillId: "g" });
      assert.match(chat.at(-1).content, /Defaulting to Gunnery \+4/);
    } finally { setSkillWeb([]); }
  });

  test("martial arts improve unarmed attacks and defense; parry blocks without a counterattack", async () => {
    chat.length = 0;
    const a = person([skill("u", "Unarmed Combat", 2), skill("k", "Karate", 4, { attribute: "strength", martial: { enabled: true, power: 1, stage: 1, reach: 0, defense: 1 } }), skill("p", "Parry", 3)]);
    const plan = a.planAttack(SR2Actor.unarmed(), {});
    assert.deepEqual({ p: plan.power, l: plan.level, d: plan.dice }, { p: 5, l: "S", d: 4 });     // STR 4 + 1, M → S, Karate 4
    assert.ok(plan.notes.includes("Karate"));
    const b = person([skill("x", "Armed Combat", 3)], { name: "Thug" });
    const attack = { attackerUuid: b.uuid, targetUuid: a.uuid, weaponName: "Club", melee: true, damageType: "physical", power: 6, level: "M", attackSuccesses: 1, targetNumber: 4, reach: 0 } as any;
    (RULES.SKILLS as any).parry = true;
    try {
      assert.ok(a.meleeWeapons().some((w: any) => w.id === "parry"));
      faces.push(5, 5, 1);
      await a.defend(attack, 0, { weaponId: "parry" });
      assert.match(chat.at(-1).content, /Parry/);
      assert.match(chat.at(-1).content, /No damage/);
      assert.doesNotMatch(chat.at(-1).content, /Counterattack/);
    } finally { (RULES.SKILLS as any).parry = false; }
    faces.push(5, 5, 5, 1, 1);                                                           // Karate 4 + 1 defense die
    await a.defend(attack, 0, { weaponId: "unarmed" });
    assert.match(chat.at(-1).content, /Counterattack!.*Karate/);
  });

  test("a Build/Repair test fixes vehicle damage", async (t) => {
    t.after(oldWay({ "DOCS_V79.vehRepair.mode": "perSuccess" })); // v0.79.0: the old rule (a house rule)
    chat.length = 0;
    const a = person([skill("c", "Car B/R", 4, { attribute: "intelligence", kind: "buildRepair" })]);
    const car: any = { type: "vehicle", name: "Van", uuid: "Actor.van", system: { condition: 5 }, async update(d: any) { for (const [k, v] of Object.entries(d)) setPath(this, k, v); } };
    faces.push(5, 5, 1, 1);
    // v0.71.0 (R18): the old flat repair (no tools needed); v071.test.ts covers tools, parts and rebuilds.
    RULES.FIXES_V71.vehicleRepair.enabled = false;
    try { assert.deepEqual(await a.repairVehicleTest(car), { repaired: 2 }); } finally { RULES.FIXES_V71.vehicleRepair.enabled = true; }
    assert.equal(car.system.condition, 3);
    assert.match(chat.at(-1).content, /2 boxes repaired/);
  });
});

describe("v0.39.0 magic and critters", () => {
  const M = { body: 4, quickness: 4, strength: 4, charisma: 5, intelligence: 5, willpower: 6 };
  const withGet = (list: any[]) => Object.assign(list, { get(id: string) { return list.find((i: any) => i.id === id); } });
  const item = (x: any) => ({ ...x, async update(d: any) { for (const [k, v] of Object.entries(d)) setPath(this, k, v); } });
  const who = (extra: any = {}, items: any[] = []) => {
    const a = makeActor(M, { magic: 0, karma: { pool: 0, poolSpent: 0, good: 30 }, metamagic: {}, initiateGrade: 0, nuyen: 0, sustaining: [], drugs: [],
      poolSpent: { combat: 0, spell: 0, hacking: 0, control: 0 }, ...extra });
    a.name = extra.name ?? "Someone"; a.type = extra.type ?? "character"; (a as any).id = `id-${a.uuid}`;
    a.items = withGet(items.map(item));
    for (const it of a.items) { const up = it.update; it.update = async function (d: any) { await up.call(this, d); a.system.prepareDerivedData(); }; }
    (a as any).statuses = new Set<string>();
    a.system.parent = a; a.system.prepareDerivedData();
    uuidRegistry.set(a.uuid, a);
    return a;
  };
  const sorcery = { id: "s1", type: "skill", name: "Sorcery", system: { rating: 4, attribute: "willpower" } };
  const mage = (extra: any = {}, items: any[] = []) => who({ magic: 6, tradition: "hermetic", ...extra }, [sorcery, ...items]);
  const spell = (name: string, sys: any = {}) => ({ id: `sp-${name}`, name, type: "spell", system: { category: "combat", spellType: "mana", learnedForce: 4, damageLevel: "M", damageType: "stun",
    targetNumber: 4, drainModifier: 0, drainLevel: "M", duration: "instant", resist: "none", heals: false, healTrack: "physical", exclusive: false, fetish: false,
    elemental: false, element: "", area: false, ...sys } });
  const power = (id: string, name: string, sys: any) => ({ id, name, type: "power", system: { active: true, dice: "rating", rating: 6, tnSource: "fixed", targetNumber: 4, resist: "none",
    effect: "effect", area: false, repeating: false, damageLevel: "M", damageType: "stun", special: "", substance: "", severity: "mild", exposed: false, ...sys } });
  const adept = (id: string, special: string, level: number) => ({ id, name: special, type: "adeptpower", system: { cost: 1, active: true, level, special,
    attributes: { body: 0, quickness: 0, strength: 0, charisma: 0, intelligence: 0, willpower: 0 }, reaction: 0, initiativeDice: 0, skill: "", skillDice: 0, ballistic: 0, impact: 0 } });
  const scene = { id: "s39", flags: {} as any, getFlag(_s: string, k: string) { return this.flags[k]; }, async setFlag(_s: string, k: string, v: any) { this.flags[k] = v; } };
  before(() => {
    g.game.scenes = { viewed: scene }; g.game.time = { worldTime: 0 };
    g.game.user = { isGM: true, id: "gm1" }; g.game.users = [{ id: "gm1", isGM: true }];
    g.fromUuidSync = (u: string) => uuidRegistry.get(u) ?? null;
    delete g.game.combat;
  });
  afterEach(() => { scene.flags = {}; });

  test("elemental spells carry a secondary effect; shock and acid work on the target", async () => {
    chat.length = 0;
    const a = mage();
    const t = who({ name: "Guard" }, [{ id: "ar", type: "armor", name: "Jacket", system: { worn: true, ballistic: 5, impact: 3, degraded: 0 } }]);
    faces.push(5, 5, 1, 1, ...Array(6).fill(5));                      // Sorcery 4: 2 successes; drain
    await a.castSpell(spell("Fireball", { spellType: "physical", elemental: true, element: "fire", learnedForce: 5, damageType: "physical" }), { force: 5, targetUuid: t.uuid });
    await t.defend({ ...chat[0].flags.sr2e.attack, attackSuccesses: 2, targetNumber: 4 }, 0);
    assert.deepEqual(chat.at(-1).flags.sr2e.elementEffect, { targetUuid: t.uuid, kind: "fire", force: 5 });
    assert.match(chat.at(-1).content, /data-sr2e-action="elementEffect"[^>]*>Catches fire/);
    faces.push(1, 1, 1, 1);                                            // Body 4 vs Force 5: stunned
    await t.applyElementEffect("shock", 5);
    assert.match(chat.at(-1).content, /stunned by the shock/);
    await t.applyElementEffect("corrode", 5);
    assert.equal(t.items.get("ar").system.degraded, 1);
  });

  test("an elemental sustains a spell for a limited time", async () => {
    chat.length = 0;
    const a = mage({ sustaining: [{ spellName: "Armor", force: 3, category: "manipulation", focusId: "", successes: 1, quickened: false, spiritUuid: "", until: -1 }] });
    a.update = async function (d: any) { for (const [k, v] of Object.entries(d)) setPath(this, k, v); this.system.prepareDerivedData(); };
    const fire = who({ name: "Fire elemental", type: "spirit", spiritKind: "elemental", element: "fire", summonerUuid: a.uuid, force: 3, services: 2 });
    (RULES.MAGIC_EXTRA as any).elementalMatch = "any";
    try { assert.equal(await a.sustainWithElemental(0, fire.uuid), true); } finally { (RULES.MAGIC_EXTRA as any).elementalMatch = "category"; }
    assert.equal(a.system.sustaining[0].until, 3 * 3600);
    g.game.actors = [a];
    try {
      await SR2Actor.magicTicks({ worldTime: 3 * 3600 - 1, anyGm: true });
      assert.equal(a.system.sustaining.length, 1);
      await SR2Actor.magicTicks({ worldTime: 3 * 3600, anyGm: true });
      assert.equal(a.system.sustaining.length, 0);
      assert.match(chat.at(-1).content, /stops sustaining Armor/);
    } finally { delete g.game.actors; }
  });

  test("aspected and toxic background count", async () => {
    chat.length = 0;
    scene.flags.backgroundSources = "Grove: 3 aspected to bear\nDump: 2; toxic";
    const shaman = mage({ tradition: "shamanic", totem: { name: "Bear" } });
    const hermetic = mage();
    assert.deepEqual(shaman.backgroundInfo().penalty, 2);
    assert.deepEqual(shaman.backgroundInfo().bonusDice, 3);
    assert.equal(hermetic.backgroundInfo().penalty, 3);
    faces.push(...Array(7).fill(1), ...Array(6).fill(5));             // Sorcery 4 + 3 aligned; drain
    const r = await shaman.castSpell(spell("Stunbolt"), { force: 4 });
    assert.equal(r.totalDice, 7);
    assert.match(chat[0].content, /aspected background \+3/);
    assert.ok(chat.some((c: any) => /Toxic background count/.test(c.content)));
  });

  test("hermetics need a library and circle for elementals; rituals are prepared, then sent", async () => {
    chat.length = 0; warnings.length = 0;
    (RULES.MAGIC_V39.sites as any).enforce = "block";
    const conj = { id: "c1", type: "skill", name: "Conjuring", system: { rating: 4, attribute: "charisma" } };
    const a = mage({}, [conj]);
    try {
      assert.equal(await a.conjure({ force: 4, spiritKind: "elemental", element: "fire" }), null);
      assert.match(warnings.at(-1) ?? "", /needs a conjuring library and a hermetic circle \(fire\)/);
    } finally { (RULES.MAGIC_V39.sites as any).enforce = "off"; }
    (RULES.MAGIC_V39.ritualStages as any).enabled = true;
    try {
      const bolt = spell("Death Touch");
      const lead = mage({ name: "Leader" }, [bolt]);
      const victim = mage({ name: "Victim" });
      assert.equal(await lead.castSpell(lead.items.get("sp-Death Touch"), { force: 4, targetUuid: victim.uuid, ritual: { teamUuids: [], materialLink: true } }), null);
      const card = chat.find((c: any) => c.flags?.sr2e?.ritualPrep);
      const prep = card.flags.sr2e.ritualPrep;
      assert.match(card.content, /Ritual: Death Touch \(Force 4\)/);
      // v0.45.0: the (awakened) target gets a chance to notice it.
      assert.equal(chat.at(-1).flags.sr2e.ritualNotice.targetUuid, victim.uuid);
      assert.equal(prep.hours, 4);
      faces.push(5, 5, 1, 1, ...Array(6).fill(5));
      assert.equal(await SR2Actor.sendRitual(prep, true), true);
      assert.ok(chat.some((c: any) => /\[ritual: 1 members, 4 h\]/.test(c.content)));
    } finally { (RULES.MAGIC_V39.ritualStages as any).enabled = false; }
  });

  test("adept killing hands, combat sense and pain resistance", async (t) => {
    t.after(oldWay({"BOOK_V78.combatSense": "dice"})); // v0.78.0: the old rule (a house rule)
    chat.length = 0;
    const a = who({ tradition: "adept", magic: 4, monitor: { physical: 3, stun: 0 } }, [adept("kh", "killingHands", 1), adept("cs", "combatSense", 2), adept("pr", "painResistance", 2)]);
    const plan = a.planAttack(SR2Actor.unarmed(), {});
    assert.deepEqual({ l: plan.level, t: plan.damageType }, { l: "L", t: "physical" }); // v0.77.0: level 1 is L (four levels)
    // v0.59.0: killing hands get past immunity to normal weapons.
    chat.length = 0;
    faces.push(5, 5, 5, 5, 5, 5, 5, 5);
    await a.attackWith(SR2Actor.unarmed(), { targetUuid: "Actor.target" } as any);
    const atk = chat.find((m: any) => m.flags?.sr2e?.attack);
    assert.equal(atk?.flags.sr2e.attack.ignoreImmunity, true);
    faces.length = 0; chat.length = 0;
    assert.deepEqual(a.woundModifiers().map((m: any) => m.value), [1]);    // 3 boxes, 2 ignored: Light
    faces.push(5, 1);                                                        // two combat sense dice
    await a.defend({ attackerUuid: "x", targetUuid: a.uuid, weaponName: "Gun", melee: false, damageType: "physical", power: 6, level: "M", attackSuccesses: 2, targetNumber: 4 } as any, 0);
    assert.match(chat.at(-1).content, /2 dice vs TN/);
  });

  test("critters: allergies, vulnerability and regeneration, Essence drain and loss, shapeshifting, dual-natured", async () => {
    chat.length = 0;
    const c = who({ name: "Wolf", shapeshift: { enabled: true, form: "animal", human: { body: -1, quickness: 0, strength: -2, charisma: 0, intelligence: 0, willpower: 0 } } }, [
      power("al", "Allergy", { special: "allergy", substance: "sunlight", severity: "mild", exposed: true }),
      power("vu", "Vulnerability", { special: "vulnerability", substance: "silver" }),
      power("rg", "Regeneration", { special: "regeneration" }),
      power("ed", "Essence Drain", { special: "essenceDrain", resist: "willpower" }),
      power("el", "Essence Loss", { special: "essenceLoss" }),
      power("dn", "Dual-natured", { special: "dualNatured" }),
    ]);
    c.update = async function (d: any) { for (const [k, v] of Object.entries(d)) setPath(this, k, v); this.system.prepareDerivedData(); };
    faces.push(5, 5, 5, 5);
    await c.rollAttribute("body", { targetNumber: 4 });
    assert.match(chat.at(-1).content, /Allergy \(sunlight\)/);
    assert.doesNotMatch(chat.at(-1).content, /Astral perception/);           // dual-natured: no penalty
    assert.equal(c.system.derived.astralMode, "perceiving");
    // Silver: staged up, and those boxes don't regenerate.
    faces.push(1, 1, 1, 1);
    await c.resistFromState({ targetUuid: c.uuid, melee: false, damageType: "physical", power: 6, level: "M", material: "silver" } as any);
    assert.ok(chat.some((m: any) => /vulnerable to silver/.test(m.content)));
    assert.equal(c.system.monitor.physical, 6);                            // S
    assert.equal(c.getFlag("sr2e", "noRegen"), 6);
    c.system.monitor.physical = 9;
    assert.equal(await c.regenerateTick(), 3);
    assert.equal(c.system.monitor.physical, 6);
    // Essence drain: 3 net successes move 3 Essence.
    c.system.monitor.physical = 0;
    const v = who({ name: "Victim" });
    faces.push(5, 5, 5, 1, 1, 1);
    await c.usePower(c.items.get("ed"), { targetUuid: v.uuid });
    faces.push(1, 1, 1, 1, 1, 1);
    await v.resistSpell(chat.at(-1).flags.sr2e.spell, 0);
    assert.match(chat.at(-1).content, /Victim loses 3 Essence; Wolf gains 3/);
    assert.equal(v.system.derived.essence, 3);
    assert.equal(c.system.derived.essence, 9);
    // Essence loss over time.
    g.game.actors = [c];
    try {
      await SR2Actor.magicTicks({ worldTime: 0, anyGm: true });
      await SR2Actor.magicTicks({ worldTime: 61 * 86400, anyGm: true });
      assert.equal(c.system.derived.essence, 7);
    } finally { delete g.game.actors; }
    // Shapeshifting: human form takes its adjustments.
    assert.equal(c.system.attributes.strength.total, 4);
    assert.equal(await c.shapeshift(), true);
    assert.equal(c.system.attributes.strength.total, 2);
  });

  test("focus addiction, astral perception on all tests, nature spirit domains, cleaning signatures", async () => {
    chat.length = 0; warnings.length = 0;
    const foc = (id: string) => ({ id, name: `Power focus ${id}`, type: "focus", system: { focusType: "power", rating: 4, active: true, bonded: true, category: "", target: "" } });
    const a = mage({ astral: "perceiving" }, [foc("f1"), foc("f2")]);
    faces.push(1, 1, 1, 1, 1, 1);                                         // Willpower 6 vs foci 8
    await a.focusAddictionTest();
    assert.equal(a.getFlag("sr2e", "focusAddict"), true);
    await a.items.get("f1").update({ "system.active": false });
    await a.items.get("f2").update({ "system.active": false });
    faces.push(5, 1, 1, 1, ...Array(6).fill(5));
    await a.castSpell(spell("Stunbolt"), { force: 4 });
    assert.match(chat.find((m: any) => /Stunbolt \(Force 4/.test(m.content))?.content ?? "", /Focus withdrawal/);
    faces.push(5, 5, 5, 5);
    await a.rollAttribute("body", { targetNumber: 4 });
    assert.match(chat.at(-1).content, /Astral perception/);
    // A nature spirit away from its domain.
    scene.flags.environment = "urban";
    (RULES.MAGIC_V39.domains as any).enforce = "block";
    try {
      const s = who({ name: "Forest spirit", type: "spirit", spiritKind: "nature", domain: "forest", force: 4 });
      assert.equal(s.canAct("usePower"), false);
      assert.match(warnings.at(-1) ?? "", /outside its domain/);
    } finally { (RULES.MAGIC_V39.domains as any).enforce = "off"; }
    // Cleaning a signature.
    const owner = who({ name: "Caster" });
    await owner.setFlag("sr2e", "signatures", [{ id: "sg", sceneId: "s39", kind: "spell", label: "Fireball", force: 4, worldTime: 0 }]);
    faces.push(5, 5, 5, 1);
    await a.cleanSignature({ id: "sg", sceneId: "s39", kind: "spell", label: "Fireball", force: 4, worldTime: 0, actorUuid: owner.uuid });
    assert.match(chat.at(-1).content, /1 hour left|1 h left/);
    faces.push(5, 5, 1, 1);
    await a.cleanSignature({ ...owner.getFlag("sr2e", "signatures")[0], actorUuid: owner.uuid });
    assert.equal(owner.getFlag("sr2e", "signatures").length, 0);
  });
});

describe("v0.40.0 Matrix leftovers: psychotropic IC, defensive utilities, frames and agents, grid travel, security deckers", () => {
  // v0.92.3: these pin the v0.92.2 Matrix rules (the book's defaults: v0923-matrix tests).
  let undo922 = () => {}; before(() => { undo922 = matrix922(); }); after(() => undo922());
  let HostDataModel: any, IcDataModel: any;
  const D = { body: 4, quickness: 5, strength: 3, charisma: 3, intelligence: 6, willpower: 5 };
  const withGet = (list: any[]) => Object.assign(list, { get(id: string) { return list.find((i: any) => i.id === id); } });
  const run = () => ({ jackedIn: false, hostUuid: "", monitor: 0, sim: "cold", connection: "jackpoint", crippled: { bod: 0, evasion: 0, masking: 0, sensors: 0 }, passed: [],
    trace: { active: false, icUuid: "", icName: "", mode: "dump", rating: 0, hostUuid: "", round: -1, worldTime: -1 }, psyche: [],
    transit: { hostUuid: "", hops: 0, round: -1, worldTime: -1 } });
  const prog = (id: string, kind: string, rating: number, extra: any = {}) => ({ id, type: "program", name: `${kind[0]!.toUpperCase()}${kind.slice(1)}`, system: { kind, rating, size: 0, loaded: true, erased: false, damageLevel: "M", ...extra } });
  const decker = (name = "Decker", programs: any[] = []) => {
    const a = makeActor(D, { karma: { pool: 0, poolSpent: 0, good: 0 }, poolSpent: { combat: 0, spell: 0, hacking: 0 }, matrix: run() });
    a.name = name; a.type = "character";
    const item = (data: any) => ({ ...data, async update(d: any) { for (const [k, v] of Object.entries(d)) setPath(this, k, v); a.system.prepareDerivedData(); } });
    a.items = withGet([
      item({ id: "sk", type: "skill", name: "Computer", system: { rating: 5, attribute: "intelligence" } }),
      item({ id: "deck", type: "cyberdeck", name: "Deck", system: { active: true, mpcp: 6, bod: 4, evasion: 5, masking: 5, sensors: 4, hardening: 2, responseIncrease: 0, activeMemory: 900, storageMemory: 500, ioSpeed: 100, damage: { mpcp: 0, bod: 0, evasion: 0, masking: 0, sensors: 0 }, files: [] } }),
      item(prog("sl", "sleaze", 4)), item(prog("de", "deception", 3)),
      ...programs.map(item),
    ]);
    a.system.parent = a; a.system.prepareDerivedData();
    uuidRegistry.set(a.uuid, a);
    return a;
  };
  const host = (name = "Host", extra: any = {}) => {
    const h = new SR2Actor();
    const sys = Object.create(HostDataModel.prototype);
    Object.assign(sys, { gridKind: "host", parentUuid: "", securityCode: "red", securityValue: 6, subsystems: { access: 4, control: 4, index: 4, files: 4, slave: 4 }, tally: 0, alert: "none", sheaf: [],
      files: [{ id: "a", name: "Memo", size: 10, value: 0, paydata: false, encrypted: 0, scramble: 0, foundBy: [] }],
      securityDeckers: [], spotted: [], smoke: { rating: 0, tn: 0, by: "", round: -1, worldTime: -1 }, ...extra });
    sys.prepareDerivedData();
    Object.assign(h, { type: "host", name, uuid: `Actor.v40h${(host as any).n = ((host as any).n ?? 0) + 1}`, system: sys });
    uuidRegistry.set(h.uuid, h);
    return h;
  };
  const ic = (h: any, extra: any = {}, items: any[] = []) => {
    const i = new SR2Actor();
    const sys = Object.create(IcDataModel.prototype);
    Object.assign(sys, { rating: 6, category: "white", icType: "", damageLevel: "M", damageType: "physical", initiativeDice: 0, hostUuid: h.uuid, matrix: { monitor: 0 },
      kind: "ic", ownerUuid: "", smart: false, behavior: "killer", guards: "", traceMode: "dump", attribute: "evasion", payload: "", ...extra });
    sys.prepareDerivedData();
    Object.assign(i, { type: "ic", name: extra.name ?? `${extra.behavior ?? "killer"}-${sys.rating}`, uuid: `Actor.v40ic${(ic as any).n = ((ic as any).n ?? 0) + 1}`, system: sys, items: withGet(items) });
    uuidRegistry.set(i.uuid, i);
    return i;
  };
  const noDetect = () => faces.push(1, 1, 1, 1, 1, 1);             // Security Value 6: nothing
  before(async () => {
    ({ HostDataModel, IcDataModel } = await import("../models/index.ts"));
    g.fromUuidSync = (u: string) => uuidRegistry.get(u) ?? null;
    g.game.users = [{ id: "gm1", isGM: true }];
    g.game.user = { isGM: true, id: "gm1" };
    g.game.time = { worldTime: 0 };
  });
  afterEach(() => { delete g.game.actors; g.game.time = { worldTime: 0 }; });

  test("psychotropic IC: a hit offers the payload test; a failure leaves cyberphobia (+2 TN), judas raises the alert, frenzy ends at jack-out", async () => {
    chat.length = 0;
    const h = host();
    const a = decker(); await a.jackIn(h.uuid);
    const p = ic(h, { behavior: "psychotropic", category: "black", damageType: "stun", rating: 5, payload: "cyberphobia", name: "Psycho-5" });
    faces.push(5, 5, 5, 1, 1);                                       // 3 vs Evasion 5
    await p.icAttack({ targetUuid: a.uuid });
    await a.defend(chat.at(-1).flags.sr2e.attack, 0);
    const card = chat.at(-1);
    assert.match(card.content, /stun to the decker/);
    assert.match(card.content, /data-sr2e-action="psychotropic"[^>]*>Resist Cyberphobia \(Willpower vs 5\)/);
    assert.deepEqual(card.flags.sr2e.psychotropic, { deckerUuid: a.uuid, icName: "Psycho-5", rating: 5, kind: "cyberphobia", hostUuid: h.uuid });
    faces.push(1, 1, 1, 2, 2);                                       // Willpower 5 vs 5: nothing
    await a.resistPsychotropic(card.flags.sr2e.psychotropic);
    assert.match(chat.at(-1).content, /Cyberphobia takes hold<\/strong> for 5 days/);
    assert.equal(a.system.derived.matrix.psyche.length, 1);
    noDetect(); faces.push(5, 1, 1, 1, 1);
    const r = await a.systemTest("", { operationId: "analyzeHost" });
    assert.equal(r.targetNumber, 4 + 2);
    assert.ok(r.modifiers.some((m: any) => m.label === "Cyberphobia"));
    // Judas tells the GM and raises the host's alert.
    faces.push(1, 1, 1, 2, 2);
    await a.resistPsychotropic({ icName: "Judas-4", rating: 4, kind: "judas", hostUuid: h.uuid });
    assert.ok(chat.some((m) => /Judas:<\/strong> Decker is compelled/.test(m.content) && m.whisper?.includes("gm1")));
    assert.equal(h.system.alert, "passive");
    // Frenzy lasts only the run; a resisted payload leaves nothing.
    faces.push(1, 1, 1, 2, 2);
    await a.resistPsychotropic({ icName: "Frenzy-4", rating: 4, kind: "frenzy" });
    faces.push(5, 1, 1, 1, 1);
    await a.resistPsychotropic({ icName: "Frenzy-4", rating: 4, kind: "frenzy" });
    assert.match(chat.at(-1).content, /resists Frenzy/);
    assert.equal(a.system.matrix.psyche.length, 3);
    await a.jackOut();
    assert.deepEqual(a.system.matrix.psyche.map((e: any) => e.kind), ["cyberphobia", "judas"]);
    // Time wears the rest off.
    g.game.time.worldTime = 6 * 86400;
    a.system.prepareDerivedData();
    assert.equal(a.system.derived.matrix.psyche.length, 0);
  });

  test("Armor soaks persona damage and Shield black IC damage, each losing a point; Mirrors make the decker harder to hit", async () => {
    chat.length = 0;
    const h = host();
    const a = decker("Decker", [prog("ar", "armor", 3), prog("sh", "shield", 2), prog("mi", "mirrors", 4)]);
    await a.jackIn(h.uuid);
    assert.deepEqual([a.system.derived.matrix.armor, a.system.derived.matrix.shield, a.system.derived.matrix.mirrors], [3, 2, 4]);
    const k = ic(h, { name: "Killer-6" });
    faces.push(1, 1, 1, 2, 2, 2);
    const r = await k.icAttack({ targetUuid: a.uuid });
    assert.equal(r.targetNumber, 5 + 2);                             // Evasion 5 + Mirrors 4 (half)
    assert.ok(r.modifiers.some((m: any) => m.label === "Decker's Mirrors 4" && m.value === 2));
    faces.push(1, 1, 1, 2);                                          // Bod 4 vs 8 − Hardening 2 − Armor 3 = 3: nothing
    await a.resistFromState({ targetUuid: a.uuid, melee: false, damageType: "physical", power: 8, level: "S", matrix: true });
    assert.match(chat.at(-1).content, /Hardening 2, Armor 3/);
    assert.match(chat.at(-1).content, /TN <strong>3<\/strong>/);
    assert.match(chat.at(-1).content, /Armor soaks the hit and drops to rating <strong>2<\/strong>/);
    assert.equal(a.items.get("ar").system.rating, 2);
    assert.equal(a.system.matrix.monitor, 6);
    faces.push(1, 1, 1, 2, 2);                                       // Willpower 5 vs 6 − Shield 2 = 4
    await a.resistFromState({ targetUuid: a.uuid, melee: false, damageType: "stun", power: 6, level: "M", matrix: true, black: true });
    assert.match(chat.at(-1).content, /TN <strong>4<\/strong>/);
    assert.equal(a.items.get("sh").system.rating, 1);
    assert.equal(a.system.monitor.stun, 3);
  });

  test("smoke in a host adds to every Matrix test there until it clears", async () => {
    chat.length = 0;
    const h = host();
    const a = decker("Decker", [prog("sm", "smoke", 4)]);
    assert.equal(await a.releaseSmoke("sm"), null);                  // not in a host
    await a.jackIn(h.uuid);
    const cloud = await a.releaseSmoke("sm");
    assert.equal(cloud.tn, 2);
    assert.equal(h.system.smoke.tn, 2);
    assert.match(chat.at(-2).content, /every Matrix test there is at <strong>\+2 TN<\/strong> for 4 Combat Turns/);
    noDetect(); faces.push(5, 1, 1, 1, 1);
    const r = await a.systemTest("", { operationId: "analyzeHost" });
    assert.equal(r.targetNumber, 6);
    const k = ic(h);
    faces.push(1, 1, 1, 2, 2, 2);
    const r2 = await k.icAttack({ targetUuid: a.uuid });
    assert.ok(r2.modifiers.some((m: any) => m.label === "Smoke 4"));
    g.game.time.worldTime = 12;                                      // 4 Combat Turns × 3 s later
    noDetect(); faces.push(5, 1, 1, 1, 1);
    assert.equal((await a.systemTest("", { operationId: "analyzeHost" })).targetNumber, 4);
  });

  test("frames and agents carry utilities; an agent works with the owner jacked out and its own Detection Factor; they fight and can be attacked", async () => {
    chat.length = 0;
    const h = host();
    const d = decker("Owner", [prog("br", "browse", 3), prog("at", "attack", 5), prog("ag", "agent", 5), prog("fr", "frame", 1)]);
    await d.jackIn(h.uuid);
    let made: any = null;
    g.Actor.implementation = { create: async (data: any) => { made = data; return { name: data.name }; } };
    try {
      await d.launchFrame("ag", { carry: ["br", "at"] });
      assert.deepEqual({ k: made.system.kind, s: made.system.smart, i: made.system.initiativeDice, n: made.items.map((x: any) => x.name), l: made.items.every((x: any) => x.system.loaded) },
        { k: "agent", s: true, i: 2, n: ["Browse", "Attack"], l: true });
      assert.match(chat.at(-1).content, /carrying Browse 3, Attack 5/);
      assert.equal(await d.launchFrame("fr", { carry: ["br", "at"] }), null);   // rating 1 carries 1
      assert.match(warnings.at(-1) ?? "", /can carry at most 1 utility/);
    } finally { delete g.Actor.implementation; }
    await d.jackOut();
    const agent = ic(h, { kind: "agent", ownerUuid: d.uuid, smart: true, rating: 5, behavior: "other", name: "Agent-5" },
      [prog("b2", "browse", 3), prog("s2", "sleaze", 4), prog("a2", "attack", 5)]);
    noDetect(); faces.push(5, 5, 1, 1, 1, 1, 1);                    // rating 5 + 2 pool vs Index 4 − Browse 3 (min 2)
    const r = await d.systemTest("", { operationId: "locateFile", frameUuid: agent.uuid });
    assert.deepEqual([r.totalDice, r.targetNumber], [7, 2]);
    assert.ok(chat.some((m) => /vs Agent-5's Detection Factor 5/.test(m.content)));   // (5 + Sleaze 4) / 2
    assert.deepEqual(SR2Actor.foundFiles(h, d.uuid).map((f: any) => f.id), ["a"]);
    // The agent fights an IC with its carried Attack 5.
    const k = ic(h, { rating: 4, name: "Killer-4" });
    faces.push(5, 5, 5, 1, 1, 1, 1);                                 // 3 successes vs rating 4
    await agent.matrixAttack({ targetUuid: k.uuid });
    assert.match(chat.at(-1).content, /Hit!<\/strong> 3 net successes: <strong>5S<\/strong> Matrix damage/);
    faces.push(1, 1, 1, 2);                                          // the IC's rating 4 vs 5
    await k.resistFromState(chat.at(-1).flags.sr2e.damage);
    assert.equal(k.system.matrix.monitor, 6);
    // IC can damage it (TN = its rating), but not cripple it.
    const k6 = ic(h, { name: "Killer-6" });
    faces.push(5, 5, 5, 1, 1, 1);
    const r2 = await k6.icAttack({ targetUuid: agent.uuid });
    assert.equal(r2.targetNumber, 5);
    assert.match(chat.at(-1).content, /Hit!/);
    const c = ic(h, { behavior: "crippler", name: "Crippler-6" });
    assert.equal(await c.icAttack({ targetUuid: agent.uuid }), null);
    // A frame needs its owner jacked in.
    const frame = ic(h, { kind: "frame", ownerUuid: d.uuid, rating: 4, behavior: "other", name: "Frame-4" });
    assert.equal(await d.systemTest("", { operationId: "locateFile", frameUuid: frame.uuid }), null);
    assert.equal(await frame.matrixAttack({ targetUuid: k.uuid }), null);
  });

  test("grid travel: a hop between grids takes a Combat Turn before the decker can act in the new node", async () => {
    chat.length = 0;
    const rtg = host("RTG", { gridKind: "rtg" });
    const ltg = host("LTG", { gridKind: "ltg", parentUuid: rtg.uuid });
    const hst = host("Corp host", { parentUuid: ltg.uuid });
    const a = decker();
    g.game.actors = [rtg, ltg, hst, a];
    await a.jackIn(ltg.uuid);
    noDetect(); faces.push(5, 1, 1, 1, 1);                           // Computer 5 vs Access 4 − Deception 3
    await a.systemTest("", { operationId: "logon", targetUuid: rtg.uuid });
    assert.equal(a.system.matrix.hostUuid, rtg.uuid);
    assert.match(chat.at(-1).content, /1 hop across the grid: arrives in <strong>1 Combat Turn<\/strong> \(3 s\)/);
    assert.deepEqual(a.system.matrix.transit, { hostUuid: rtg.uuid, hops: 1, round: -1, worldTime: 3 });
    assert.equal(await a.systemTest("", { operationId: "analyzeHost" }), null);
    assert.match(warnings.at(-1) ?? "", /Decker is still on the way to RTG \(3 s left\)/);
    g.game.time.worldTime = 3;
    noDetect(); faces.push(5, 1, 1, 1, 1);
    assert.ok(await a.systemTest("", { operationId: "analyzeHost" }));
    // Into a host from its own grid: no travel.
    await a.jackIn(ltg.uuid);
    noDetect(); faces.push(5, 1, 1, 1, 1);
    await a.systemTest("", { operationId: "logon", targetUuid: hst.uuid });
    assert.doesNotMatch(chat.at(-1).content, /across the grid/);
    assert.equal(a.transitLeft(), null);
  });

  test("security deckers: no detection roll; spot, trace (lost when they jack out), re-arm a device, cancel the alert", async () => {
    chat.length = 0;
    const sd = decker("Sec", [prog("tr", "track", 2)]);
    const intruder = decker("Runner");
    const h = host("Corp host", { securityDeckers: [sd.uuid], alert: "active" });
    const site = new SR2Actor();
    Object.assign(site, { type: "site", name: "Lab", uuid: "Actor.v40site", system: { devices: [{ id: "cam", name: "Camera", kind: "camera", rating: 4, wallId: "", active: true, bypassed: true }], tally: 0, alert: "none", steps: [], response: { round: -1, worldTime: -1, arrived: false }, hostUuid: h.uuid, prepareDerivedData() {} } });
    uuidRegistry.set(site.uuid, site);
    g.game.actors = [sd, intruder, h, site];
    await sd.jackIn(h.uuid); await intruder.jackIn(h.uuid);
    assert.deepEqual(SR2Actor.intruders(h).map((x: any) => x.name), ["Runner"]);
    chat.length = 0;
    faces.push(5, 1, 1, 1, 1);
    await sd.systemTest("", { operationId: "analyzeHost" });
    assert.equal(chat.length, 1);                                    // no detection card
    assert.match(chat[0].content, /\[security decker\]/);
    assert.equal(await intruder.securityAction("cancelAlert"), null);
    faces.push(5, 5, 1, 1, 1);                                       // vs the Runner's Detection Factor 5
    const sp = await sd.securityAction("spotIntruder", { targetUuid: intruder.uuid });
    assert.equal(sp.targetNumber, 5);
    assert.deepEqual(h.system.spotted, [intruder.uuid]);
    faces.push(5, 5, 5, 1, 1);                                       // vs Evasion 5 − Track 2 = 3
    const tr = await sd.securityAction("traceIntruder", { targetUuid: intruder.uuid });
    assert.equal(tr.targetNumber, 3);
    assert.deepEqual({ a: intruder.system.matrix.trace.active, ic: intruder.system.matrix.trace.icUuid, m: intruder.system.matrix.trace.mode }, { a: true, ic: sd.uuid, m: "report" });
    assert.match(chat.at(-1).content, /locks a trace on Runner<\/strong>: it completes in <strong>4 Combat Turns/);
    await sd.jackOut();
    await SR2Actor.matrixTraces({ worldTime: 0 });
    assert.equal(intruder.system.matrix.trace.active, false);
    assert.match(chat.at(-1).content, /Sec has jacked out: their trace on Runner is lost/);
    await sd.jackIn(h.uuid);
    faces.push(5, 1, 1, 1, 1);
    await sd.securityAction("rearmDevice", { siteUuid: site.uuid, deviceId: "cam" });
    assert.equal(site.system.devices[0].bypassed, false);
    faces.push(5, 1, 1, 1, 1);
    await sd.securityAction("cancelAlert");
    assert.equal(h.system.alert, "none");
  });
});

describe("v0.41.0 GM tools and dice", () => {
  const G = { body: 4, quickness: 4, strength: 3, charisma: 3, intelligence: 4, willpower: 4 };
  const withGet = (list: any[]) => Object.assign(list, { get(id: string) { return list.find((i: any) => i.id === id); } });
  const npc = (name: string, extra: any = {}, items: any[] = []) => {
    const a = makeActor(G, { karma: { pool: 0, poolSpent: 0 }, poolSpent: { combat: 0, spell: 0, hacking: 0, control: 0 }, ...extra });
    a.name = name; a.type = "npc";
    a.items = withGet(items.map((i) => ({ ...i })));
    a.system.parent = a; a.system.prepareDerivedData();
    uuidRegistry.set(a.uuid, a);
    return a;
  };
  before(() => {
    g.fromUuidSync = (u: string) => uuidRegistry.get(u) ?? null;
    g.game.users = [{ id: "gm1", isGM: true }];
    g.game.user = { isGM: true, id: "gm1" };
  });

  test("a group roll tests everyone with their own skill and wounds, on one GM-only card", async () => {
    chat.length = 0;
    const a = npc("Guard 1", {}, [{ id: "p", type: "skill", name: "Perception", system: { rating: 3, attribute: "intelligence" } }]);
    const b = npc("Guard 2", { monitor: { physical: 3, stun: 0 } });   // no skill: Intelligence at +4; Moderate wound +2
    faces.push(5, 5, 1);                                                // Guard 1: Perception 3 vs 4
    faces.push(6, 1, 1, 1, 4);                                          // Guard 2: Intelligence 4 vs 4 + 4 + 2 = 10 (the 6 re-rolls a 4)
    const rows = await SR2Actor.groupRoll([a, b], { skill: "Perception", attribute: "intelligence", targetNumber: 4 });
    assert.deepEqual(rows.map((r: any) => [r.name, r.successes]), [["Guard 1", 2], ["Guard 2", 1]]);
    assert.equal(chat.length, 1);
    assert.deepEqual(chat[0].whisper, ["gm1"]);
    assert.match(chat[0].content, /Group roll: Perception \(TN 4\)/);
    assert.match(chat[0].content, /<td>Guard 2[^<]*<em>[^<]*<\/em><\/td><td>4<\/td><td>10<\/td>/);
    assert.equal(chat[0].rolls.length, 3);                              // two first waves and one Rule of Six re-roll
    faces.push(1, 1, 1, 1);
    await SR2Actor.groupRoll([b], { attribute: "body", targetNumber: 4, public: true });
    assert.equal(chat.at(-1).whisper, undefined);
    assert.match(chat.at(-1).content, /Disaster/);
  });

  test("damage several at once: each resists with Body against Power minus the chosen armor, or takes it unresisted", async () => {
    chat.length = 0;
    const a = npc("Ganger 1", {}, [{ id: "ar", type: "armor", name: "Jacket", system: { ballistic: 5, impact: 3, worn: true, adds: false, degraded: 0 } }]);
    const b = npc("Ganger 2");
    faces.push(1, 1, 1, 1);                                             // Ganger 1: Body 4 vs 8 − 5 = 3: nothing; 8M stays M
    faces.push(1, 1, 1, 2);                                             // Ganger 2: Body 4 vs 8
    const n = await SR2Actor.groupDamage([a, b], { power: 8, level: "M", type: "physical", armor: "ballistic", mode: "resist" });
    assert.equal(n, 2);
    assert.match(chat[0].content, /TN <strong>3<\/strong>/);
    assert.match(chat[1].content, /TN <strong>8<\/strong>/);
    assert.equal(a.system.monitor.physical, 3);
    assert.equal(b.system.monitor.physical, 3);
    await SR2Actor.groupDamage([a, b], { power: 8, level: "L", type: "stun", armor: "none", mode: "unresisted" });
    assert.deepEqual([a.system.monitor.stun, b.system.monitor.stun], [1, 1]);
  });

  test("Dice So Nice: SR2e colour sets on rolls when the module is on, Rule of Six re-rolls in gold", async () => {
    const { dsnColorsetFor, dsnColoursOn } = await import("../applications/dice.ts");
    assert.equal(dsnColoursOn(), false);                                 // no module, no settings
    assert.equal(dsnColorsetFor(0), "sr2e-base");
    assert.equal(dsnColorsetFor(2), "sr2e-six");
    g.game.modules = new Map([["dice-so-nice", { active: true }]]);
    g.game.settings = { get: (_s: string, k: string) => k === "dsnColours" };
    const realRoll = g.Roll;
    g.Roll = class extends StubRoll { override async evaluate() { await super.evaluate(); this.dice[0].options = {}; return this; } };
    try {
      chat.length = 0;
      const a = npc("Roller");
      faces.push(6, 2, 3, 4, 5);                                        // Body 4 dice... one 6 re-rolls
      await a.rollAttribute("body", { targetNumber: 4 });
      const rolls = chat.at(-1).rolls;
      assert.deepEqual(rolls.map((r: any) => r.dice[0].options.colorset), ["sr2e-base", "sr2e-six"]);
      assert.equal(rolls[1].dice[0].options.appearance.colorset, "sr2e-six");
    } finally { g.Roll = realRoll; delete g.game.modules; delete g.game.settings; }
  });

  test("a dropped weapon attacks the token, a spell or power targets it; the party is the player-owned characters", async () => {
    const { dropAction, groupActors, tokenIsActor } = await import("../applications/groups.ts");
    const base = { id: "a1", uuid: "Actor.a1" };
    assert.equal(tokenIsActor({ document: { actorId: "a1" }, actor: { uuid: "Scene.s.Token.t.Actor.a1" } }, base), true);   // unlinked: a copy
    assert.equal(tokenIsActor({ document: { actorId: "a2" }, actor: { uuid: "Actor.a2" } }, base), false);
    assert.equal(tokenIsActor({ document: { actorId: "a1" }, actor: { uuid: "Scene.s.Token.t.Actor.a1" } }, { id: "a1", uuid: "Scene.s.Token.t.Actor.a1", isToken: true, token: { actorId: "a1" } }), true);
    assert.equal(dropAction("weapon"), "attack");
    assert.equal(dropAction("spell"), "cast");
    assert.equal(dropAction("power"), "power");
    assert.equal(dropAction("gear"), null);
    const pc = npc("Runner"); pc.type = "character"; pc.hasPlayerOwner = true;
    const other = npc("Johnson"); other.type = "character"; other.hasPlayerOwner = false;
    g.game.actors = [pc, other];
    try { assert.deepEqual(groupActors("party").map((x: any) => x.name), ["Runner"]); } finally { delete g.game.actors; }
  });
});

describe("v0.42.0 health and environment", () => {
  const P = { body: 4, quickness: 5, strength: 3, charisma: 3, intelligence: 4, willpower: 4 };
  const withGet = (list: any[]) => Object.assign(list, { get(id: string) { return list.find((i: any) => i.id === id); } });
  const person = (items: any[] = [], extra: any = {}) => {
    const a = makeActor(P, { poolSpent: { combat: 0, spell: 0, hacking: 0, control: 0 }, karma: { pool: 0, poolSpent: 0 }, drugs: [], addictions: [], diseases: [], nuyen: 0, ledger: [], lifestyle: { level: "low", paidUntil: -1 }, ...extra });
    a.name = extra.name ?? "Runner"; a.type = "character";
    a.items = withGet(items.map((it) => ({ ...it, async update(d: any) { for (const [k, v] of Object.entries(d)) setPath(this, k, v); a.system.prepareDerivedData(); } })));
    (a as any).statuses = new Set<string>();
    a.system.parent = a; a.system.prepareDerivedData();
    uuidRegistry.set(a.uuid, a);
    return a;
  };
  const tox = (id: string, name: string, toxin: any) => ({ id, type: "gear", name, system: { quantity: 9, toxin: { kind: "toxin", vector: "injection", power: 6, level: "M", damageType: "physical", speed: "immediate", effect: "", attributes: {}, reaction: 0, initiativeDice: 0, durationMinutes: 0, crashPower: 0, crashLevel: "", addiction: 0, addictionType: "mental", incubationHours: 24, intervalHours: 24, recoveries: 0, ...toxin } } });
  const H = 3600;
  before(() => {
    g.fromUuidSync = (u: string) => uuidRegistry.get(u) ?? null;
    g.game.users = [{ id: "gm1", isGM: true }];
    g.game.user = { isGM: true, id: "gm1" };
    g.game.time = { worldTime: 0 };
    delete g.game.combat;
  });

  test("addiction: a dose tests Willpower; an addict goes into withdrawal, builds tolerance, and can kick it after two weeks clean", async (t) => {
    t.after(oldWay({ 'HEALTH_V923.addiction': 'old' })); // v0.92.3: the old model (Shadowtech's: v0923-health glue tests)
    chat.length = 0;
    g.game.time.worldTime = 0;
    const a = person([tox("j", "Jazz", { kind: "drug", reaction: 2, initiativeDice: 1, durationMinutes: 10, addiction: 4, addictionType: "mental" })]);
    faces.push(1, 1, 1, 1);                                              // Willpower 4 vs 4: hooked
    await a.takeDrug("j");
    assert.match(chat.at(-1).content, /Addiction test: Jazz \(Willpower vs 4/);
    assert.match(chat.at(-1).content, /addicted to Jazz/);
    assert.equal(a.system.addictions[0].addicted, true);
    g.game.actors = [a];
    try {
      await SR2Actor.timedEffects({ worldTime: 25 * H });
      assert.match(chat.at(-1).content, /in withdrawal<\/strong> from Jazz/);
      const seen = chat.length;
      await SR2Actor.timedEffects({ worldTime: 26 * H });
      assert.equal(chat.length, seen);                                   // announced once
    } finally { delete g.game.actors; }
    g.game.time.worldTime = 26 * H;
    faces.push(1, 1, 1, 1);
    await a.rollAttribute("body", { targetNumber: 4 });
    assert.match(chat.at(-1).content, /Withdrawal \(Jazz\)/);
    // An addict's fifth dose costs a point of every bonus; no new addiction test.
    await a.update({ "system.addictions": [{ ...a.system.addictions[0], dosesAddicted: 5 }] });
    const n = chat.length;
    await a.takeDrug("j");
    assert.equal(chat.length, n + 1);
    assert.match(chat.at(-1).content, /Reaction \+1.*Tolerance: −1/);
    assert.equal(a.system.drugs.at(-1).initiativeDice, 0);
    g.game.time.worldTime = 26 * H + 14 * 86400;
    faces.push(6, 1, 1, 1, 1);                                           // Willpower 4 vs 4 + 2 withdrawal: the 6 re-rolls (1): 7, one success
    await a.drugAddictionTest("Jazz", "kick");
    assert.match(chat.at(-1).content, /kicks the Jazz habit/);
    assert.equal(a.system.addictions[0].addicted, false);
  });

  test("disease: resisting infection, incubation, a due card, damage, then recovery", async () => {
    chat.length = 0;
    g.game.time.worldTime = 0;
    const gm = person();
    const a = person([], { name: "Patient" });
    const flu = tox("v", "VITAS-3", { kind: "disease", vector: "inhalation", power: 5, level: "S", damageType: "physical", incubationHours: 12, intervalHours: 24, recoveries: 2 });
    await gm.exposeTo(flu, [a.uuid]);
    const state = chat.at(-1).flags.sr2e.toxins[0];
    faces.push(1, 1, 1, 1);
    await a.resistToxin(state);
    assert.match(chat.at(-1).content, /infected with VITAS-3/);
    assert.deepEqual({ n: a.system.diseases[0].nextAt, need: a.system.diseases[0].needed }, { n: 12 * H, need: 2 });
    g.game.actors = [a];
    try { await SR2Actor.timedEffects({ worldTime: 12 * H }); } finally { delete g.game.actors; }
    assert.equal(chat.at(-1).flags.sr2e.diseaseTick.name, "VITAS-3");
    assert.equal(a.system.diseases[0].pending, true);
    g.game.time.worldTime = 12 * H;
    faces.push(1, 1, 5, 5);                                              // Body 4 vs 5: two successes, S -> M
    await a.rollDiseaseTick(0);
    assert.equal(a.system.monitor.physical, 3);
    assert.deepEqual({ p: a.system.diseases[0].pending, n: a.system.diseases[0].nextAt }, { p: false, n: 36 * H });
    await a.update({ "system.diseases": [{ ...a.system.diseases[0], treated: true }] });
    faces.push(5, 5, 5, 5, 5, 5);                                        // treated: 6 dice; 6 successes stage S off
    await a.rollDiseaseTick(0);
    assert.match(chat.at(-1).content, /treated \+2/);
    assert.match(chat.at(-1).content, /1 of 2 toward recovery/);
    faces.push(5, 5, 5, 5, 5, 5);
    await a.rollDiseaseTick(0);
    assert.match(chat.at(-1).content, /recovers from VITAS-3/);
    assert.equal(a.system.diseases.length, 0);
  });

  test("protection: a worn gas mask stops a gas, a respirator adds dice; radiation and suffocation", async (t) => {
    // v0.92.3: the old respirator and suffocation (the book's: v0923-health glue tests).
    t.after(oldWay({ 'HEALTH_V923.respirator': 'dice', 'HEALTH_V923.drowning': 'test', 'HEALTH_V923.breathHold': 'none' }));
    chat.length = 0;
    const mask = { id: "m", type: "gear", name: "Gas mask", system: { quantity: 1, protection: { kind: "gasMask", rating: 0, worn: true } } };
    const resp = { id: "r", type: "gear", name: "Respirator", system: { quantity: 1, protection: { kind: "respirator", rating: 2, worn: true } } };
    const a = person([mask]);
    await a.resistToxin({ name: "Neuro-stun", vector: "inhalation", power: 8, level: "S", damageType: "stun" });
    assert.match(chat.at(-1).content, /Gas mask: Neuro-stun has no effect/);
    const b = person([resp]);
    faces.push(1, 1, 1, 1, 1, 2);
    await b.resistToxin({ name: "Neuro-stun", vector: "inhalation", power: 8, level: "S", damageType: "stun" });
    assert.match(chat.at(-1).content, /Respirator 2 \+2/);
    assert.match(chat.at(-1).content, /6 dice vs TN/);
    const c = person();
    faces.push(1, 1, 1, 2, 1, 1, 1, 2);
    await c.resistHazard("radiation", 5, { hours: 2 });
    // v0.48.0: the dose card follows the tests.
    assert.match(chat.at(-2).content, /Radiation 5 \(hour 2 of 2\)/);
    assert.match(chat.at(-1).content, /radiation dose: <strong>10<\/strong>/);
    assert.equal(c.system.monitor.physical, 6);
    faces.push(1, 1, 1, 2);
    await c.resistHazard("suffocation", 2);
    assert.match(chat.at(-1).content, /TN <strong>6<\/strong>/);
    assert.equal(c.system.monitor.stun, 3);
  });

  test("hospital care costs nuyen per day; resting at home uses the lifestyle", async (t) => {
    t.after(oldWay({ 'HEALTH_V923.stunRecovery': 'old' })); // v0.92.3: by the book no care helps Stun (and costs nothing)
    chat.length = 0;
    const a = person([], { nuyen: 1500, monitor: { physical: 0, stun: 3 } });
    faces.push(1, 1, 1, 1);
    await a.naturalHeal({ track: "stun", hours: 30, care: "hospital" });
    assert.equal(a.system.nuyen, 500);
    assert.match(chat.at(-1).content, /paid 1,000¥/);
    assert.equal(await a.naturalHeal({ track: "stun", hours: 30, care: "intensive" }), null);   // can't pay 2,000
    faces.push(1, 1, 1, 1);
    await a.naturalHeal({ track: "stun", hours: 30, care: "intensive", pay: false });
    assert.equal(a.system.nuyen, 500);
    const b = person([], { monitor: { physical: 0, stun: 3 }, lifestyle: { level: "street", paidUntil: -1 } });
    faces.push(1, 1, 1, 1);
    await b.naturalHeal({ track: "stun", hours: 1, care: "home" });
    assert.match(chat.at(-1).content, /Home \(street lifestyle\)/);
  });

  test("weather: ranged attacks and perception, by the best vision; not melee, not blind fire", async (t) => {
    t.after(oldWay({ "DOCS_V79.visionWeatherFold": "own" })); // v0.79.0: the old weather table (a house rule)
    g.game.scenes = { viewed: { getFlag: (_s: string, k: string) => (k === "weather" ? "heavyFog" : undefined) } };
    try {
      const a = person();
      const gun = { id: "g", name: "Pistol", system: { melee: false, skill: "Firearms", damagePower: 6, damageLevel: "M", damageType: "physical", modes: "SA", ammo: 10, ammoMax: 10, recoilComp: 0 } };
      const knife = { id: "k", name: "Knife", system: { melee: true, skill: "Edged Weapons", damagePower: 3, damageLevel: "L", damageType: "physical", strengthPower: true, modes: "", ammo: 0, ammoMax: 0, recoilComp: 0 } };
      assert.ok(a.previewAttack(gun, { range: "short" }).modifiers.some((m: any) => m.label === "Thick fog" && m.value === 4));
      assert.ok(!a.previewAttack(gun, { range: "short", visibility: "blind" }).modifiers.some((m: any) => m.label === "Thick fog"));
      assert.ok(!a.previewAttack(knife, {}).modifiers.some((m: any) => m.label === "Thick fog"));
      a.system.derived.vision = { thermographic: true };
      assert.deepEqual(a.weatherMods(), [{ label: "Thick fog", value: 2 }]);
    } finally { delete g.game.scenes; }
  });
});

describe("v0.43.0 gear and combat", () => {
  useV922Vehicles(); // v0.92.3: these pin the v0.92.2 vehicle rules
  let VehicleDataModel: any;
  const P = { body: 4, quickness: 5, strength: 3, charisma: 3, intelligence: 4, willpower: 4 };
  const withGet = (list: any[]) => Object.assign(list, { get(id: string) { return list.find((i: any) => i.id === id); } });
  const person = (items: any[] = [], extra: any = {}) => {
    const a = makeActor(P, { poolSpent: { combat: 0, spell: 0, hacking: 0, control: 0 }, karma: { good: 0, pool: 0, poolSpent: 0, career: 0 }, drugs: [], ...extra });
    a.name = extra.name ?? "Runner"; a.type = "character"; (a as any).id = `id-${a.uuid}`;
    a.items = withGet(items.map((it) => ({ ...it, async update(d: any) { for (const [k, v] of Object.entries(d)) setPath(this, k, v); a.system.prepareDerivedData(); } })));
    (a as any).statuses = new Set<string>();
    a.system.parent = a; a.system.prepareDerivedData();
    uuidRegistry.set(a.uuid, a);
    return a;
  };
  const gun = (extra: any = {}) => ({ id: "g", type: "weapon", name: "Rifle", system: { melee: false, skill: "Firearms", damagePower: 8, damageLevel: "M", damageType: "physical", modes: "SA/BF/FA", ammo: 30, ammoMax: 30, recoilComp: 0, ...extra } });
  const ware = (id: string, name: string, extra: any = {}) => ({ id, type: "cyberware", name, system: { installed: true, essenceCost: 1, grade: "standard", attributes: {}, reaction: 0, initiativeDice: 0, kind: "other", damaged: false, housedIn: "", bioware: false, armorBallistic: 0, armorImpact: 0, limb: { location: "rightArm", strength: 4, quickness: 4, capacity: 1 }, ...extra } });
  const firearms = { id: "f", type: "skill", name: "Firearms", system: { rating: 4, attribute: "quickness" } };
  before(async () => {
    ({ VehicleDataModel } = await import("../models/index.ts"));
    g.fromUuidSync = (u: string) => uuidRegistry.get(u) ?? null;
    g.game.users = [{ id: "gm1", isGM: true }];
    g.game.user = { isGM: true, id: "gm1" };
    g.game.time = { worldTime: 0 };
    delete g.game.combat;
  });

  test("accessories: shock pad and a set-up bipod cut recoil; a scope brings the range in; a laser sight gives way to the smartlink; called shots at a limb", (t) => {
    t.after(oldWay({ 'DOCS_V79.rangedRecoil': 'freeFirst' })); // v0.79.0: the old recoil count (a house rule)
    const a = person([firearms]);
    const w = gun({ scope: 2, shockPad: true, support: "bipod", supportSetUp: true, laserSight: true });
    const plan = a.planAttack(w, { range: "long", magnify: true, mode: "FA", fullAutoRounds: 6, situational: ["smartlink", "laserSight"], calledShot: "damage", calledLocation: "leftArm" });
    assert.equal(plan.base.value, RULES.RANGE_TN.short);                   // long, two bands closer
    assert.ok(plan.modifiers.some((m: any) => m.label === "Recoil" && m.value === 2));   // 6 rounds (5 recoil) − (shock pad 1 + bipod 2)
    assert.ok(!plan.modifiers.some((m: any) => /Laser/.test(m.label)));
    assert.ok(plan.notes.includes("laser sight not used with the smartlink"));
    assert.ok(plan.notes.includes("shock pad 1, bipod 2"));
    assert.equal(plan.extras.calledLocation, "leftArm");
    // Folded, the bipod gives nothing (unless prone).
    const folded = a.planAttack(gun({ support: "bipod" }), { range: "short", mode: "FA", fullAutoRounds: 6 });
    assert.ok(folded.modifiers.some((m: any) => m.label === "Recoil" && m.value === 5));
    a.statuses.add("prone");
    a.hasStatus = (id: string) => a.statuses.has(id);
    assert.ok(a.planAttack(gun({ support: "bipod" }), { range: "short", mode: "FA", fullAutoRounds: 6 }).modifiers.some((m: any) => m.label === "Recoil" && m.value === 3));
  });

  test("a cyberarm's own Quickness when defaulting and on Quickness tests; its armor only against called shots at it", async () => {
    chat.length = 0;
    const a = person([ware("arm", "Cyberarm", { kind: "cyberlimb", limb: { location: "leftArm", strength: 6, quickness: 8, capacity: 1 }, armorBallistic: 2, armorImpact: 1 })]);
    const plan = a.planAttack(gun(), { range: "short", mode: "SA", limbId: "arm" });
    assert.equal(plan.dice, 8);
    assert.match(plan.suffix, /Quickness 8, Cyberarm/);
    assert.equal(a.planAttack(gun(), { range: "short", mode: "SA" }).dice, 5);
    faces.push(1, 1, 1, 1, 1, 1, 1, 1);
    await a.rollAttribute("quickness", { targetNumber: 4, limbId: "arm" });
    assert.match(chat.at(-1).content, /\(Cyberarm 8\)/);
    assert.equal(faces.length, 0);
    assert.equal(a.armorRating("ballistic"), 0);
    assert.equal(a.armorRating("ballistic", { calledLocation: "leftArm" }), 2);
    assert.equal(a.armorRating("impact", { calledLocation: "rightLeg" }), 0);
  });

  test("a Deadly physical hit offers a cyberware damage check; a called shot's cyberlimb is likelier to break", async (t) => {
    t.after(oldWay({ "GEAR_V923.cyberDamage": "old" })); // v0.92.3: the old way (v0.92.2); __tests__/v0923-gear.test.ts has the book's
    chat.length = 0;
    const a = person([ware("arm", "Cyberarm", { kind: "cyberlimb", limb: { location: "leftArm", strength: 6, quickness: 6, capacity: 1 }, armorBallistic: 2 }), ware("eye", "Cybereyes")]);
    faces.push(1, 1, 1, 1);                                               // Body 4 vs 10 − 2: no successes
    await a.resistFromState({ targetUuid: a.uuid, melee: false, damageType: "physical", power: 10, level: "D", calledLocation: "leftArm" });
    const card = chat.at(-1);
    assert.match(card.content, /armor 2/);
    assert.match(card.content, /data-sr2e-action="cyberDamage"/);
    assert.deepEqual(card.flags.sr2e.cyberDamage, { actorUuid: a.uuid, location: "leftArm", level: "D" }); // v0.92.3: the wound's level rides along
    faces.push(3, 2);                                                     // the arm on 1–3, the eyes on 1
    assert.deepEqual(await a.cyberDamageCheck("leftArm"), ["Cyberarm"]);
    assert.equal(a.items.get("arm").system.damaged, true);
    assert.equal(a.items.get("eye").system.damaged, false);
    // Lighter hits don't call for a check.
    const b = person([ware("eye", "Cybereyes")]);
    faces.push(1, 1, 1, 1);
    await b.resistFromState({ targetUuid: b.uuid, melee: false, damageType: "physical", power: 6, level: "S" });
    assert.doesNotMatch(chat.at(-1).content, /cyberDamage/);
  });

  test("a worn shield's Parry adds dice to melee defense", async () => {
    chat.length = 0;
    const def = person([
      { id: "u", type: "skill", name: "Unarmed Combat", system: { rating: 3, attribute: "strength" } },
      { id: "sh", type: "armor", name: "Riot shield", system: { ballistic: 0, impact: 2, worn: true, adds: true, degraded: 0, weight: 0, parry: 2 } },
    ]);
    faces.push(2, 2, 2, 2, 2);
    await def.defend({ attackerUuid: "Actor.atk", targetUuid: def.uuid, weaponName: "Club", melee: true, damageType: "physical", power: 5, level: "M", attackSuccesses: 2, targetNumber: 4, reach: 0 }, 0);
    assert.match(chat.at(-1).content, /Riot shield \+2/);
    assert.equal(faces.length, 0);
  });

  test("searching: frisking finds what Concealability hides; scanners find weapons; results whispered", async () => {
    chat.length = 0;
    const searcher = person([], { name: "Guard" });
    const runner = person([
      { id: "h", type: "weapon", name: "Hold-out", system: { melee: false, concealability: 6 } },
      { id: "k", type: "weapon", name: "Ceramic knife", system: { melee: true, concealability: 9 } },
      { id: "j", type: "armor", name: "Armor jacket", system: { ballistic: 5, impact: 3, worn: true, concealability: 0 } },
      ware("s", "Spur", { kind: "cyberweapon" }),
    ], { name: "Runner" });
    faces.push(4, 1, 1, 1);                                               // Intelligence 4 vs 6 − 2: found
    faces.push(1, 1, 1, 1);                                               // vs 9 − 2: missed
    const r = await searcher.searchFor(runner.uuid, { method: "frisk" });
    assert.deepEqual(r, { found: ["Hold-out", "Armor jacket"], missed: ["Ceramic knife"] });
    const pub = chat.at(-2);
    assert.match(pub.content, /Guard frisks Runner/);
    assert.match(pub.content, /Found:<\/strong> Hold-out, Armor jacket/);
    assert.ok(Array.isArray(pub.whisper) && pub.whisper.includes("gm1"));
    assert.match(chat.at(-1).content, /GM only.*Ceramic knife \(<span[^>]*>TN 7<\/span>\)/s);
    const sc = person([{ id: "mad", type: "gear", name: "Weapon detector", system: { quantity: 1, scanner: { kind: "weapon", rating: 2 } } }], { name: "Door guard" });
    faces.push(6, 1, 1, 1, 1, 1, 1);                                     // Hold-out TN 6 (6, the six re-rolls a 1: 7); knife TN 9; spur TN 4
    const s2 = await sc.searchFor(runner.uuid, { method: "scanner", scannerId: "mad" });
    assert.deepEqual(s2, { found: ["Hold-out"], missed: ["Ceramic knife", "Spur"] });
    assert.equal(await sc.searchFor(runner.uuid, { method: "scanner", scannerId: "nope" }), null);
  });

  test("spells against vehicles: physical combat spells roll against the Object Resistance and hit like attacks; mana spells can't", async () => {
    chat.length = 0; warnings.length = 0;
    const m = makeActor({ body: 3, quickness: 4, strength: 2, charisma: 3, intelligence: 5, willpower: 5 }, { magic: 6 });
    m.items = [{ type: "skill", name: "Sorcery", system: { rating: 5, attribute: "willpower" } }];
    m.name = "Mage";
    const v = new SR2Actor();
    const sys = Object.create(VehicleDataModel.prototype);
    Object.assign(sys, { category: "car", skill: "", drone: false, handling: 4, handlingOffroad: 8, speed: 90, accel: 10, body: 4, armor: 3, signature: 2, autonav: 2, pilot: 0, sensor: 1, objectResistance: 0,
      condition: 0, currentSpeed: 0, offroad: false, controllerUuid: "", controlMode: "autopilot", occupants: [] });
    sys.prepareDerivedData();
    Object.assign(v, { type: "vehicle", name: "Van", uuid: "Actor.van43", system: sys, items: withGet([]) });
    uuidRegistry.set(v.uuid, v);
    const bolt = (spellType: string) => ({ name: spellType === "mana" ? "Manabolt" : "Powerbolt", system: { category: "combat", spellType, learnedForce: 6, damageLevel: "M", damageType: "physical", targetNumber: 4, drainModifier: 0, drainLevel: "M" } });
    assert.equal(await m.castSpell(bolt("mana"), { force: 6, targetUuid: v.uuid }), null);
    assert.match(warnings.at(-1) ?? "", /can't affect Van: mana spells only affect living things/);
    faces.push(6, 6, 1, 1, 1, 2, 2);                                     // TN 8: two sixes re-roll 2s: 8 and 8
    faces.push(5, 5, 5, 5, 5);                                           // drain
    const r = await m.castSpell(bolt("physical"), { force: 6, targetUuid: v.uuid });
    assert.equal(r.targetNumber, RULES.GEAR.spellsVsVehicles.objectResistance);
    assert.equal(r.successes, 2);
    const card = chat[0];
    assert.match(card.content, /Van's Object Resistance/);
    const d = card.flags.sr2e.damages[0];
    assert.deepEqual({ t: d.targetUuid, p: d.power, l: d.level, av: d.antiVehicle, ia: d.ignoreArmor }, { t: v.uuid, p: 6, l: "M", av: true, ia: true });   // 2 net: hits; a stage needs 2 more
    // The van resists with Body; its armor doesn't count against the spell.
    chat.length = 0;
    faces.push(1, 1, 1, 1);
    await v.resistFromState(d);
    assert.doesNotMatch(chat.at(-1).content, /armor 3/);
  });

  test("grenades: a bounced throw costs TN and carries its extras; smart guidance needs the smartlink; a site scanner raises the tally", async () => {
    const a = person([{ id: "t", type: "skill", name: "Throwing", system: { rating: 4, attribute: "quickness" } }]);
    const nade = { id: "n", type: "weapon", name: "Smart grenade", system: { melee: false, skill: "Throwing", blast: true, blastKind: "offensive", blastPerMetre: 1, damagePower: 10, damageLevel: "S", damageType: "physical", strengthRange: true, modes: "", ammo: 0, ammoMax: 0, recoilComp: 0, fuse: "airburst", smartGrenade: true } };
    const p1 = a.planAttack(nade, { range: "short", bounce: true });
    assert.ok(p1.modifiers.some((m: any) => m.label === "Bounced throw" && m.value === RULES.GEAR.grenades.bounce.tn));
    assert.deepEqual(p1.blastExtras, { fuse: "airburst", bounce: true });          // no smartlink: no guidance
    a.system.derived.smartlink = true;
    assert.deepEqual(a.planAttack(nade, { range: "short", situational: ["smartlink"] }).blastExtras, { fuse: "airburst", smart: true });
    // A site's weapon scanner.
    const { SiteDataModel } = await import("../models/index.ts");
    const site = new SR2Actor();
    const sys = Object.create(SiteDataModel.prototype);
    Object.assign(sys, { devices: [{ id: "mad", name: "Lobby MAD", kind: "scanner", scanKind: "weapon", rating: 3, tokenUuid: "", sceneId: "", wallId: "", active: true, bypassed: false, notes: "" }],
      tally: 0, alert: "none", steps: [], response: { round: -1, worldTime: -1, arrived: false, force: "" }, riggerUuid: "", slaved: [], hostUuid: "" });
    sys.prepareDerivedData();
    Object.assign(site, { type: "site", name: "Lobby", uuid: "Actor.site43", system: sys, items: withGet([]), isOwner: true });
    uuidRegistry.set(site.uuid, site);
    const runner = person([{ id: "h", type: "weapon", name: "Hold-out", system: { melee: false, concealability: 5 } }], { name: "Runner" });
    faces.push(5, 1, 1);
    const r = await site.scanWithDevice("mad", runner.uuid);
    assert.deepEqual(r, { found: ["Hold-out"], missed: [] });
    assert.equal(site.system.tally, RULES.GEAR.concealment.tallyOnFind);
  });

  test("timed charges go off by themselves on the GM's tick; walls are repaired", async (t) => {
    t.after(oldWay({"BOOK_V78.barriers.mode": "subtract"})); // v0.78.0: the old rule (a house rule)
    chat.length = 0;
    const scene: any = { id: "s43", name: "Warehouse", flags: { sr2e: {} }, isOwner: true, getFlag(_s: string, k: string) { return this.flags.sr2e[k]; }, async setFlag(_s: string, k: string, v: any) { this.flags.sr2e[k] = v; } };
    g.game.scenes = Object.assign([scene], { get: (id: string) => (id === scene.id ? scene : undefined) });
    g.canvas = { scene };
    const blown: any[] = [];
    const prev = SR2Actor.detonator;
    SR2Actor.detonator = async (_a: any, ctx: any, point: any, note: string) => { blown.push({ ctx, point, note }); };
    try {
      const a = person([
        { id: "d", type: "skill", name: "Demolitions", system: { rating: 3, attribute: "intelligence" } },
        { id: "c4", type: "gear", name: "C-12", system: { quantity: 2, weight: 0, explosive: { power: 10, perMetre: 1, shaped: false } } },
      ]);
      faces.push(5, 1, 1);
      assert.deepEqual(await a.setCharge("c4", { timerSeconds: 6, point: { x: 10, y: 20, elevation: 0 }, sceneId: "s43", placeName: "Door" }), { power: 11 });
      assert.match(chat.at(-1).content, /Timer: <strong>6 s<\/strong>, on Door/);
      assert.equal(SR2Actor.armedCharges(scene).length, 1);
      g.game.actors = [a];
      await SR2Actor.timedEffects({ worldTime: 3 });
      assert.equal(blown.length, 0);
      await SR2Actor.timedEffects({ worldTime: 6 });
      assert.equal(blown.length, 1);
      assert.deepEqual({ p: blown[0].ctx.power, x: blown[0].point.x, n: blown[0].note }, { p: 11, x: 10, n: "C-12 goes off (timer)." });
      assert.equal(SR2Actor.armedCharges(scene).length, 0);
      // Walls: breached, listed, repaired by a test and then fully.
      const wall: any = { id: "w1", flags: { sr2e: { barrierRating: 4 } }, move: 20, sight: 20, light: 20, sound: 20, getFlag(_s: string, k: string) { return this.flags.sr2e[k]; },
        async update(d: any) { for (const [k, v] of Object.entries(d)) { if (k.startsWith("flags.sr2e.-=")) delete this.flags.sr2e[k.slice(13)]; else if (k.startsWith("flags.sr2e.")) this.flags.sr2e[k.slice(11)] = v; else this[k] = v; } } };
      scene.walls = [wall];
      await SR2Actor.damageWall(wall, 12);
      assert.deepEqual(SR2Actor.damagedWalls(scene).map((w: any) => ({ r: w.rating, f: w.full, b: w.breached })), [{ r: 0, f: 4, b: true }]);
      const builder = person([{ id: "b", type: "skill", name: "Building B/R", system: { rating: 3, attribute: "intelligence" } }]);
      faces.push(5, 5, 1);
      assert.equal(await builder.repairWallTest(wall), 2);
      assert.deepEqual({ m: wall.move, br: wall.flags.sr2e.breached }, { m: 20, br: undefined });
      assert.equal(await SR2Actor.repairWall(wall, { full: true }), 4);
      assert.equal(SR2Actor.damagedWalls(scene).length, 0);
    } finally {
      SR2Actor.detonator = prev;
      delete g.game.scenes; delete g.canvas; delete g.game.actors;
    }
  });
});

describe("v0.44.0 characters and the street", () => {
  const P = { body: 4, quickness: 5, strength: 3, charisma: 4, intelligence: 4, willpower: 4 };
  const withGet = (list: any[]) => Object.assign(list, { get(id: string) { return list.find((i: any) => i.id === id); } });
  const person = (items: any[] = [], extra: any = {}) => {
    const a = makeActor(P, { poolSpent: { combat: 0, spell: 0, hacking: 0, control: 0 }, karma: { good: 0, pool: 0, poolSpent: 0, career: 0 }, drugs: [], nuyen: 0, ledger: [], contacts: [], qualities: [], lifestyle: { level: "low", paidUntil: -1 }, ...extra });
    a.name = extra.name ?? "Runner"; a.type = extra.type ?? "character"; (a as any).id = `id-${a.uuid}`;
    a.items = withGet(items.map((it) => ({ ...it, async update(d: any) { for (const [k, v] of Object.entries(d)) setPath(this, k, v); a.system.prepareDerivedData(); }, async delete() { const i = a.items.indexOf(this); if (i >= 0) a.items.splice(i, 1); } })));
    (a as any).statuses = new Set<string>();
    a.system.parent = a; a.system.prepareDerivedData();
    uuidRegistry.set(a.uuid, a);
    return a;
  };
  const skill = (id: string, name: string, rating: number, attribute = "quickness") => ({ id, type: "skill", name, system: { rating, attribute } });
  before(() => {
    g.fromUuidSync = (u: string) => uuidRegistry.get(u) ?? null;
    g.game.users = [{ id: "gm1", isGM: true }];
    g.game.user = { isGM: true, id: "gm1" };
    g.game.time = { worldTime: 0 };
    delete g.game.combat;
  });

  test("Fill the sheet: metatype, attributes, Magic, cash after gear, lifestyle and free contacts", async () => {
    chat.length = 0;
    const a = person([{ id: "g", type: "gear", name: "Medkit", system: { cost: 500, quantity: 2 } }]);
    const r = await a.applyBuild({ priorities: { race: "D", magic: "B", attributes: "A", skills: "C", resources: "E" }, metatype: "ork", magic: "adept", attributes: { body: 6, quickness: 5, strength: 5, charisma: 2, intelligence: 4, willpower: 4 }, gearCost: 1000 });
    // v0.58.0: the first Squatter month (¥100) is paid from Resources.
    assert.deepEqual(r, { nuyen: 3900, lifestyle: "squatter", contacts: 2, skills: 0, gear: 0 });
    assert.deepEqual({ m: a.system.metatype, t: a.system.tradition, mg: a.system.magic, b: a.system.attributes.body.base, n: a.system.nuyen, c: a.system.contacts.length, l: a.system.lifestyle.level, p: a.system.lifestyle.paidUntil },
      { m: "ork", t: "adept", mg: 6, b: 6, n: 3900, c: 2, l: "squatter", p: 30 * 86400 });
    assert.match(chat.at(-1).content, /is built: ork, adept \(Magic 6\), ¥3,900 cash, Squatter lifestyle/);
  });

  test("edges and flaws on tests; open tests; complementary skills and teamwork", async () => {
    chat.length = 0;
    (RULES.STREET.qualities as any).enabled = true;
    try {
      const a = person([skill("st", "Stealth", 4), skill("at", "Athletics", 4, "body")], { qualities: [{ id: "q", name: "Light step", kind: "edge", points: 1, target: "Stealth", tn: -1, notes: "" }] });
      faces.push(1, 1, 1, 1);
      const r = await a.rollSkill(a.items.get("st"), { targetNumber: 5 });
      assert.equal(r.targetNumber, 4);
      faces.push(3, 6, 2, 1, 4);
      const o = await a.rollSkill(a.items.get("st"), { open: true });
      assert.equal(o.targetNumber, 10);
      assert.match(chat.at(-1).content, /Open test: Stealth.*Result <strong>10<\/strong>/s);
      faces.push(5, 5, 5, 5);                                            // Athletics 4 vs 4: 4 successes, +2 dice
      faces.push(1, 1, 1, 1, 1, 1);                                      // Stealth 4 + 2
      const c = await a.rollSkill(a.items.get("st"), { targetNumber: 4, complementarySkillId: "at" });
      assert.equal(c.totalDice, 6);
      const helper = person([skill("st2", "Stealth", 3)], { name: "Helper" });
      faces.push(5, 5, 5);                                               // helper: 3 successes
      faces.push(1, 1, 1, 1, 1, 1, 1);                                   // 4 + 3 (cap 4)
      const t = await a.rollSkill(a.items.get("st"), { targetNumber: 4, helperUuids: [helper.uuid] });
      assert.equal(t.totalDice, 7);
      assert.match(chat.at(-2).content, /Teamwork adds <strong>3<\/strong> dice/);
    } finally { (RULES.STREET.qualities as any).enabled = false; }
  });

  test("athletics: distance by successes; movement rates by metatype; Threat Rating adds Combat Pool dice", async () => {
    chat.length = 0;
    const a = person([skill("at", "Athletics", 3, "body")]);
    faces.push(5, 5, 1);
    assert.deepEqual(await a.athleticsTest("jump", { running: true }), { successes: 2, metres: 4 });
    assert.match(chat.at(-1).content, /Jumps <strong>4 m<\/strong>/);
    assert.deepEqual(a.system.derived.movement, { walk: 5, run: 15 });
    const d = person([], { metatype: "dwarf" });
    assert.equal(d.system.derived.movement.run, 2 * d.system.attributes.quickness.total);
    const n = person([], { type: "npc", threatRating: 3 });
    const plain = person([], { type: "npc" });
    assert.equal(n.system.derived.combatPool, plain.system.derived.combatPool + 3);
  });

  test("one sneaker against several observers; morale breaks a group and Leadership rallies it", async () => {
    chat.length = 0;
    const s = person([skill("st", "Stealth", 4)], { name: "Sneak" });
    const o1 = person([], { name: "Guard A" });
    const o2 = person([], { name: "Guard B" });
    faces.push(5, 5, 1, 1);                                              // sneaker vs Int 4: 2 successes
    faces.push(5, 5, 5, 1);                                              // A vs Stealth 4: 3 — notices
    faces.push(1, 1, 1, 1);                                              // B: none
    const r = await s.sneakPast([o1.uuid, o2.uuid]);
    assert.deepEqual(r, [{ name: "Guard A", noticed: true }, { name: "Guard B", noticed: false }]);
    assert.match(chat.at(-1).content, /Seen<\/strong> by Guard A/);
    const grunts = person([], { type: "npc", name: "Gangers", professionalRating: 2, grunts: { size: 4, down: 1 } });
    faces.push(1, 1);
    assert.deepEqual(await grunts.moraleTest(), { broken: true });
    assert.equal(grunts.isBroken(), true);
    const boss = person([skill("ld", "Leadership", 4, "charisma")], { name: "Boss" });
    faces.push(5, 1, 1, 1);                                              // vs 4 + 1 down = 5
    assert.equal(await boss.rally(grunts.uuid), true);
    assert.equal(grunts.isBroken(), false);
  });

  test("contacts: the fee and paid dice; haggling posts a new price; fencing sells for a share", async () => {
    chat.length = 0;
    const a = person([skill("et", "Etiquette", 3, "charisma"), skill("ng", "Negotiation", 4, "charisma"),
      { id: "gun", type: "weapon", name: "Pistol", system: { cost: 1000, streetIndex: 1 } }],
      { nuyen: 1000, contacts: [{ id: "c1", name: "Fixer", level: 1, role: "", notes: "", loyalty: 2, skills: "", fee: 50 }] });
    faces.push(1, 1, 1, 1, 1);                                           // 3 + 2 paid
    await a.legwork("c1", { pay: 300 });
    assert.equal(a.system.nuyen, 650);
    assert.match(chat.at(-1).content, /paid \+2/);
    faces.push(5, 5, 5, 1);                                              // 3 successes
    faces.push(5, 1, 1, 1);                                              // seller 1
    assert.equal(await a.haggle({ itemId: "gun", price: 1000, name: "Pistol" }), 900);
    assert.equal(chat.at(-1).flags.sr2e.buy.price, 900);
    faces.push(5, 5, 1, 1);
    faces.push(1, 1, 1, 1);
    assert.equal(await a.fence("gun"), 400);                             // 30% + 2 × 5%
    assert.equal(await a.sellItem("gun", 400), true);
    assert.equal(a.system.nuyen, 1050);
    assert.equal(a.items.get("gun"), undefined);
  });
});

describe("v0.45.0 magic and critters", () => {
  const M = { body: 4, quickness: 4, strength: 4, charisma: 5, intelligence: 5, willpower: 6 };
  const withGet = (list: any[]) => Object.assign(list, { get(id: string) { return list.find((i: any) => i.id === id); } });
  const who = (extra: any = {}, items: any[] = []) => {
    const a = makeActor(M, { magic: 0, karma: { pool: 0, poolSpent: 0, good: 30 }, metamagic: {}, initiateGrade: 0, nuyen: 0, sustaining: [], drugs: [], geasa: [], ledger: [], recovering: [],
      poolSpent: { combat: 0, spell: 0, hacking: 0, control: 0 }, ...extra });
    a.name = extra.name ?? "Someone"; a.type = extra.type ?? "character"; (a as any).id = `id-${a.uuid}`;
    a.items = withGet(items.map((it) => ({ ...it, async update(d: any) { for (const [k, v] of Object.entries(d)) setPath(this, k, v); a.system.prepareDerivedData(); } })));
    (a as any).statuses = new Set<string>();
    a.system.parent = a; a.system.prepareDerivedData();
    uuidRegistry.set(a.uuid, a);
    actors.push(a);
    return a;
  };
  const skill = (id: string, name: string, rating: number, attribute = "willpower", kind = "active") => ({ id, type: "skill", name, system: { rating, attribute, kind } });
  const mage = (extra: any = {}, items: any[] = []) => who({ magic: 6, tradition: "hermetic", ...extra }, [skill("sorc", "Sorcery", 4), skill("conj", "Conjuring", 4, "charisma"), ...items]);
  const scene: any = { id: "s45", name: "Test scene", flags: {} as any, drawings: { get: () => null },
    getFlag(_s: string, k: string) { return this.flags[k]; }, async setFlag(_s: string, k: string, v: any) { this.flags[k] = v; },
    async createEmbeddedDocuments() { return [{ id: "d1" }]; }, async deleteEmbeddedDocuments() { return []; } };
  let groups: any[] = [];
  const actors: any[] = [];
  before(() => {
    g.game.scenes = { viewed: scene, get: (id: string) => (id === scene.id ? scene : null), contents: [scene] };
    g.game.time = { worldTime: 0 };
    g.game.user = { isGM: true, id: "gm1" }; g.game.users = [{ id: "gm1", isGM: true }];
    g.game.actors = actors;
    g.game.settings = { get: (_s: string, k: string) => (k === "magicGroups" ? groups : undefined), set: async (_s: string, k: string, v: any) => { if (k === "magicGroups") groups = v; } };
    g.fromUuidSync = (u: string) => uuidRegistry.get(u) ?? null;
    g.canvas = {};
    delete g.game.combat;
  });
  afterEach(() => { faces.length = 0; scene.flags = {}; groups = []; g.game.time.worldTime = 0; });

  test("initiation: an ordeal and a group lower the cost; asceticism costs an attribute; a broken stricture refuses group initiation", async () => {
    chat.length = 0;
    const a = mage();
    groups = [{ id: "g1", name: "Circle", members: [a.uuid], strictures: [{ id: "s", text: "Never lie" }], sites: [{ name: "Old Library", kind: "library", rating: 3, tag: "" }], grimoire: [], breaches: [] }];
    assert.equal(await a.advanceInitiation("reflecting", { ordeal: "asceticism", attribute: "body", groupId: "g1" }), true);
    assert.deepEqual({ g: a.system.initiateGrade, k: a.system.karma.good, b: a.system.attributes.body.base, r: a.system.metamagic.reflecting }, { g: 1, k: 23, b: 3, r: true });
    assert.match(chat.at(-1).content, /grade 1 for 7 Good Karma \(×1\) \[with Circle; ordeal: Asceticism \(−1 Body\)\]/);
    groups[0].breaches = [{ uuid: a.uuid, strictureId: "s", at: 0 }];
    assert.equal(await a.advanceInitiation(null, { groupId: "g1" }), false);
    assert.match(warnings.at(-1) ?? "", /broken Circle's strictures/);
    // Alone with a geas ordeal: ×2, and a new geas.
    assert.equal(await a.advanceInitiation(null, { ordeal: "geas", geas: "Wear white" }), true);
    assert.equal(a.system.karma.good, 23 - 16);
    assert.equal(a.system.geasa.at(-1).text, "Wear white");
  });

  test("cleansing lowers the background count; divining is whispered", async () => {
    chat.length = 0;
    const a = mage({ astral: "perceiving", metamagic: { cleansing: true, divining: true } });
    scene.flags.backgroundCount = 2;
    faces.push(5, 5, 5, 5);                                   // Sorcery 4 vs 4 (the count is the TN, no extra penalty): 4 successes, 2 points
    const r = await a.cleanse();
    assert.equal(r.successes, 4);
    assert.equal(scene.flags.backgroundCount, 0);
    assert.ok(chat.some((c: any) => /Cleansed 2 points/.test(c.content)));
    faces.push(5, 5, 1, 1);                                    // vs 6 (specific): none
    await a.divine({ question: "specific", text: "Who sold us out?" });
    assert.deepEqual(chat.at(-1).whisper, ["gm1"]);
    assert.match(chat.at(-1).content, /No answer comes/);
    const plain = mage();
    assert.equal(await plain.cleanse(), null);
    assert.match(warnings.at(-1) ?? "", /does not know the cleansing metamagic/);
  });

  test("invoking makes a great form spirit (a service, then drain); great form spirits are stronger", async () => {
    chat.length = 0;
    const a = mage({ metamagic: { invoking: true } });
    const sp: any = { uuid: "Spirit.e1", name: "Fire elemental", type: "spirit", system: { spiritKind: "elemental", summonerUuid: a.uuid, services: 2, force: 3, greatForm: false },
      async update(d: any) { for (const [k, v] of Object.entries(d)) setPath(this, k, v); } };
    uuidRegistry.set(sp.uuid, sp);
    faces.push(5, 5, 1, 1);                                    // Conjuring 4 vs 3: 2 successes
    faces.push(...Array(12).fill(5));                          // drain
    await a.invoke(sp.uuid);
    assert.equal(sp.system.greatForm, true);
    assert.equal(sp.system.services, 1);
    assert.ok(chat.some((c: any) => /takes a great form/.test(c.content)));
    const sys = Object.create(SpiritDataModel.prototype);
    sys.attributes = Object.fromEntries(Object.keys(M).map((k) => [k, { base: 0, mod: 0 }]));
    Object.assign(sys, { essence: 6, magic: 0, reactionBonus: 0, initiativeDiceBonus: 0, karma: { pool: 0, poolSpent: 0, good: 0 }, poolSpent: { combat: 0, spell: 0 }, monitor: { physical: 0, stun: 0 },
      force: 4, spiritKind: "nature", spiritType: "", services: 0, summonerUuid: "", immuneNormalWeapons: true, offsets: Object.fromEntries(Object.keys(M).map((k) => [k, 0])), greatForm: true });
    sys.prepareDerivedData();
    assert.equal(sys.attributes.body.total, 4 + RULES.OCCULT.metamagic.invoking.attributeBonus);
  });

  test("possessing: the body thinks with the possessor's mind until it ends", async () => {
    chat.length = 0;
    const a = mage({ astral: "projecting", metamagic: { possessing: true }, initiateGrade: 1 });
    const t = who({ name: "Body" });
    t.system.attributes.charisma.base = 1; t.system.prepareDerivedData();
    faces.push(6, 6, 6, 1, 1, 1, 1, 1, 1, 1);                // 7 dice vs 6: 3 successes (the sixes roll 1s)
    faces.push(1, 1, 1, 1, 1, 1);                            // the body: none
    assert.equal(await a.possess(t.uuid), true);
    assert.equal(t.getFlag("sr2e", "possessedBy").name, "Someone");
    t.system.prepareDerivedData();
    assert.equal(t.system.attributes.charisma.total, 5);
    assert.equal(t.system.derived.possessedBy, "Someone");
    await a.endPossession();
    assert.equal(t.getFlag("sr2e", "possessedBy"), undefined);
    assert.equal(a.getFlag("sr2e", "possessing"), undefined);
  });

  test("reflecting bounces the extra successes back at the caster", async () => {
    chat.length = 0;
    const caster = mage({ name: "Caster" });
    const t = mage({ name: "Target", metamagic: { reflecting: true } });
    faces.push(5, 5, 5, 1, 1, 1);                             // Willpower 6 vs Force 4: 3
    await t.resistSpell({ casterUuid: caster.uuid, targetUuid: t.uuid, spellName: "Stunbolt", force: 4, resistAttribute: "willpower", level: "M", damageType: "stun", casterSuccesses: 1 }, 0);
    const last = chat.at(-1);
    assert.match(last.content, /Reflected!/);
    assert.deepEqual({ t: last.flags.sr2e.spell.targetUuid, s: last.flags.sr2e.spell.casterSuccesses, c: last.flags.sr2e.spell.casterUuid }, { t: caster.uuid, s: 2, c: t.uuid });
    // A reflected spell isn't reflected again, even by a reflecting caster.
    caster.system.metamagic = { reflecting: true };
    faces.push(5, 5, 5, 5, 5, 5);
    await caster.resistSpell(last.flags.sr2e.spell, 0);
    assert.doesNotMatch(chat.at(-1).content, /Reflected!/);
  });

  test("spell design: a formula card, learning it once; a group's grimoire", async () => {
    chat.length = 0;
    const a = mage();
    faces.push(5, 5, 5, 5);                                  // Sorcery 4 vs Force 5: 4
    await a.designSpell({ name: "Thunderclap", force: 5, category: "combat", spellType: "physical", area: true, damageLevel: "S" });
    const f = chat.at(-1).flags.sr2e.formula;
    assert.deepEqual({ m: f.system.drainModifier, l: f.system.drainLevel }, { m: 2, l: "S" });
    assert.match(chat.at(-1).content, /designed<\/strong> in 2 days/);
    assert.equal(await a.learnFormula(f.name, f.system), true);
    assert.equal(a.system.karma.good, 25);
    assert.equal(await a.learnFormula(f.name, f.system), false);
    groups = [{ id: "g1", name: "Circle", members: [a.uuid], strictures: [], sites: [], grimoire: [{ name: "Mana Bolt", system: { category: "combat", learnedForce: 3 } }], breaches: [] }];
    assert.equal(await a.learnFromGrimoire("g1", "Mana Bolt"), true);
    assert.equal(a.system.karma.good, 22);
    assert.ok(a.items.some((i: any) => i.name === "Mana Bolt"));
    assert.equal(await a.addToGrimoire("g1", { name: "Thunderclap", system: f.system }), true);
    assert.deepEqual(groups[0].grimoire.map((s: any) => s.name), ["Mana Bolt", "Thunderclap"]);
  });

  test("sustained powers change attributes until dropped; resisted ones by net successes", async () => {
    chat.length = 0;
    const pw = { id: "pw", name: "Hardening", type: "power", system: { active: true, dice: "rating", rating: 6, tnSource: "fixed", targetNumber: 4, resist: "none", effect: "effect", area: false, repeating: false,
      damageLevel: "M", damageType: "stun", special: "", sustained: true, perSuccess: false, attributes: { body: 0, quickness: 0, strength: 2, charisma: 0, intelligence: 0, willpower: 0 } } };
    const c = who({ name: "Critter", type: "npc" }, [pw]);
    faces.push(5, 5, 5, 5, 5, 5);
    await c.usePower(c.items.get("pw"));
    assert.equal(c.getFlag("sr2e", "powerEffects").length, 1);
    c.system.prepareDerivedData();
    assert.equal(c.system.attributes.strength.total, 6);
    assert.equal(SR2Actor.powerEffectsFrom([c.uuid]).length, 1);
    assert.equal(await c.dropAllPowerEffects(), 1);
    assert.equal(c.getFlag("sr2e", "powerEffects").length, 0);
    const victim = who({ name: "Victim" });
    faces.push(1, 1, 1, 1, 1, 1);                            // resists with nothing
    await victim.resistSpell({ casterUuid: c.uuid, targetUuid: victim.uuid, spellName: "Slow", force: 6, resistAttribute: "willpower", level: "M", damageType: "stun", casterSuccesses: 4,
      noun: "power", effectOnly: true, resistPool: "none", powerEffect: { name: "Slow", attributes: { quickness: -1 }, perSuccess: true } }, 0);
    assert.equal(victim.getFlag("sr2e", "powerEffects")[0].attributes.quickness, -RULES.OCCULT.powers.maxPerSuccess);
    assert.match(chat.at(-1).content, /Slow: Quickness −3 while Critter sustains it/);
  });

  test("ghouls feed; hunger adds a TN penalty", async () => {
    chat.length = 0;
    const pw = { id: "el", name: "Essence loss", type: "power", system: { active: false, special: "essenceLoss" } };
    const gh = who({ name: "Ghoul", type: "npc" }, [pw]);
    assert.equal(await gh.feed(), true);
    assert.equal(gh.getFlag("sr2e", "lastFed"), 0);
    g.game.time.worldTime = 8 * 86400;
    assert.equal(gh.hungerInfo().hungry, true);
    faces.push(5, 5, 5, 5);
    const r = await gh.rollAttribute("body", { targetNumber: 4 });
    assert.equal(r.targetNumber, 5);
    await gh.feed();
    assert.equal(gh.hungerInfo().hungry, false);
    assert.equal(gh.getFlag("sr2e", "essenceLossAt"), 8 * 86400);
  });

  test("surgery: the ware works after recovery; bioware over the limit risks rejection", async (t) => {
    t.after(oldWay({ "GEAR_V923.overBodyIndex": "rejection", "GEAR_V923.surgery": "old" })); // v0.92.3: the old way (v0.92.2); __tests__/v0923-gear.test.ts has the book's
    chat.length = 0;
    const ware = { id: "mus", name: "Muscle augmentation", type: "cyberware", sort: 0, system: { installed: false, bioware: true, bodyIndex: 5, bioKind: "muscleAugmentation", rating: 2, grade: "standard", cultured: false, essenceCost: 0, attributes: {} } };
    const old = { id: "old", name: "Old filter", type: "cyberware", sort: 5, system: { installed: true, bioware: true, bodyIndex: 0, bioKind: "other", rating: 0, grade: "standard", cultured: false, essenceCost: 0, attributes: {} } };
    const p = who({ name: "Patient" }, [ware, old]);
    const doc = who({ name: "Doc" }, [skill("bt", "Biotech", 4, "intelligence")]);
    faces.push(5, 5, 1, 1);                                   // 2 successes
    await p.surgery("mus", { surgeon: doc });
    assert.equal(p.items.get("mus").system.installed, true);
    assert.equal(p.system.recovering.length, 1);
    p.system.prepareDerivedData();
    assert.equal(p.system.attributes.strength.total, 4);      // not yet
    assert.match(chat.at(-1).content, /Rejection test/);
    assert.equal(chat.at(-1).flags.sr2e.rejection.actorUuid, p.uuid);
    faces.push(2, 2, 1, 1);                                   // Body 4 vs 4 + 1: none
    await p.rejectionTest();
    assert.equal(p.items.get("mus").system.damaged, true);
    assert.equal(p.system.monitor.physical, 3);
    g.game.time.worldTime = 400 * 86400;
    await SR2Actor.timedEffects({ worldTime: 400 * 86400 });
    assert.equal(p.system.recovering.length, 0);
    assert.ok(chat.some((c: any) => /has recovered from surgery: Muscle augmentation/.test(c.content)));
  });

  test("encephalons add dice; chips beyond the jacks don't run; bioware kinds", async (t) => {
    t.after(oldWay({ "GEAR_V923.bioware": "old", "GEAR_V923.cultured": "old" })); // v0.92.3: the old way (v0.92.2); __tests__/v0923-gear.test.ts has the book's
    t.after(oldWay({"BOOK_V78.encephalon.mode": "dice"})); // v0.78.0: the old rule (a house rule)
    chat.length = 0;
    const a = who({}, [
      skill("ch", "Chemistry", 3, "intelligence", "knowledge"),
      { id: "enc", name: "Encephalon", type: "cyberware", system: { installed: true, kind: "encephalon", rating: 2, essenceCost: 0.75, grade: "standard", attributes: {} } },
      { id: "dj", name: "Datajack", type: "cyberware", system: { installed: true, kind: "datajack", rating: 0, essenceCost: 0.2, grade: "standard", attributes: {} } },
      { id: "k1", name: "Chem chip", type: "gear", system: { chip: { kind: "knowsoft", skill: "Biology", rating: 3, slotted: true } } },
      { id: "k2", name: "Law chip", type: "gear", system: { chip: { kind: "knowsoft", skill: "Law", rating: 3, slotted: true } } },
      { id: "ea", name: "Joints", type: "cyberware", system: { installed: true, bioware: true, bodyIndex: 0.5, bioKind: "enhancedArticulation", rating: 1, grade: "standard", essenceCost: 0, attributes: {} } },
      { id: "pe", name: "Pain editor", type: "cyberware", system: { installed: true, bioware: true, bodyIndex: 0.5, bioKind: "painEditor", rating: 1, grade: "standard", essenceCost: 0, attributes: {} } },
    ], );
    faces.push(1, 1, 1, 1, 1);
    const r = await a.rollSkill(a.items.get("ch"), { targetNumber: 4 });
    assert.equal(r.totalDice, 5);
    assert.match(chat.at(-1).content, /encephalon \+2/);
    const softs = a.system.derived.cyber.softs;
    assert.deepEqual(softs.map((s: any) => s.effective), [3, 0]);
    assert.match(softs[1].reason, /no free jack/);
    assert.equal(a.system.derived.bio.physicalSkillDice, 1);
    assert.equal(a.system.attributes.willpower.total, 7);
    await a.update({ "system.monitor.stun": 6 });
    assert.equal(a.system.derived.woundModifier, 0);
  });

  test("graded Availability and price when finding cyberware", async (t) => {
    t.after(oldWay({ "GEAR_V923.grades": "old" })); // v0.92.3: the old way (v0.92.2); __tests__/v0923-gear.test.ts has the book's
    chat.length = 0;
    const a = who({}, [skill("et", "Etiquette", 3, "charisma"), { id: "cw", name: "Wired reflexes", type: "cyberware", system: { installed: false, grade: "beta", cost: 1000, availability: "4/48hrs", streetIndex: 1, essenceCost: 2, attributes: {} } }]);
    faces.push(6, 6, 1, 1, 1);                                // vs 9 (beta): 6+1 = 7 each, no success
    const r = await a.findItem("cw");
    assert.equal(r.price, 4000);
    assert.match(chat.at(-1).content, /Availability 9\/96h \(beta\)/);
  });

  test("a ritual's target notices it; fires start, spread and go out", async () => {
    chat.length = 0;
    const t = mage({ name: "Target" });
    faces.push(5, 5, 1, 1, 1);                                // Intelligence 5 vs 6: none
    await t.noticeRitual(6, { spellName: "Death Touch", force: 4, casterName: "Leader" });
    assert.match(chat.at(-1).content, /notices nothing/);
    faces.push(6, 6, 1, 1, 1, 1, 1);                          // 2 successes: who too
    await t.noticeRitual(6, { spellName: "Death Touch", force: 4, casterName: "Leader" });
    assert.match(chat.at(-1).content, /senses a ritual.*worked by Leader/);
    (RULES.FIRE as any).draw = false;
    try {
      const f = await SR2Actor.startFire({ x: 100, y: 100 }, { source: "test" });
      assert.equal(SR2Actor.sceneFires(scene).length, 1);
      await SR2Actor.fireTicks({ round: null, worldTime: 0 }, 2);
      assert.equal(SR2Actor.sceneFires(scene)[0].radius, f.radius + 2 * RULES.FIRE.metresPerTurn);
      await SR2Actor.putOutFire(scene.id, f.id);
      assert.equal(SR2Actor.sceneFires(scene).length, 0);
    } finally { (RULES.FIRE as any).draw = true; delete g.canvas; }
  });
});

describe("v0.46.0 Matrix and rigging", () => {
  useV922Vehicles(); // v0.92.3: these pin the v0.92.2 vehicle rules
  // v0.92.3: these pin the v0.92.2 Matrix rules (the book's defaults: v0923-matrix tests).
  let undo922 = () => {}; before(() => { undo922 = matrix922(); }); after(() => undo922());
  let HostDataModel: any, IcDataModel: any, VehicleDataModel: any, SiteDataModel: any;
  const D = { body: 4, quickness: 5, strength: 3, charisma: 3, intelligence: 6, willpower: 5 };
  const withGet = (list: any[]) => Object.assign(list, { get(id: string) { return list.find((i: any) => i.id === id); } });
  const run = (extra: any = {}) => ({ jackedIn: false, hostUuid: "", monitor: 0, sim: "cold", connection: "jackpoint", crippled: { bod: 0, evasion: 0, masking: 0, sensors: 0 }, passed: [],
    trace: { active: false, icUuid: "", icName: "", mode: "dump", rating: 0, hostUuid: "", round: -1, worldTime: -1 }, psyche: [],
    transit: { hostUuid: "", hops: 0, round: -1, worldTime: -1 }, relayKm: 0, numbers: [], ...extra });
  const prog = (id: string, kind: string, rating: number, extra: any = {}) => ({ id, type: "program", name: `${kind[0]!.toUpperCase()}${kind.slice(1)}`, system: { kind, rating, size: 0, loaded: true, erased: false, damageLevel: "M", ...extra } });
  const decker = (name = "Decker", opts: { deck?: any; items?: any[]; matrix?: any; extra?: any } = {}) => {
    const a = makeActor(D, { karma: { pool: 0, poolSpent: 0, good: 0 }, poolSpent: { combat: 0, spell: 0, hacking: 0, control: 0 }, matrix: run(opts.matrix), nuyen: 0, ledger: [], ...(opts.extra ?? {}) });
    a.name = name; a.type = "character";
    const item = (data: any) => ({ ...data, async update(d: any) { for (const [k, v] of Object.entries(d)) setPath(this, k, v); a.system.prepareDerivedData(); } });
    a.items = withGet([
      item({ id: "sk", type: "skill", name: "Computer", system: { rating: 5, attribute: "intelligence" } }),
      item({ id: "deck", type: "cyberdeck", name: "Deck", system: { active: true, mpcp: 6, bod: 4, evasion: 5, masking: 5, sensors: 4, hardening: 2, responseIncrease: 1, activeMemory: 900, storageMemory: 500, ioSpeed: 100, signal: 0, tortoise: false, living: false, damage: { mpcp: 0, bod: 0, evasion: 0, masking: 0, sensors: 0 }, files: [], ...(opts.deck ?? {}) } }),
      item(prog("sl", "sleaze", 4)), item(prog("de", "deception", 3)),
      ...(opts.items ?? []).map(item),
    ]);
    a.createEmbeddedDocuments = async (_t: string, docs: any[]) => { const made = docs.map((d, n) => item({ id: `new${a.items.length + n}`, ...d, system: { ...d.system } })); a.items.push(...made); a.system.prepareDerivedData(); return made; };
    a.system.parent = a; a.system.prepareDerivedData();
    uuidRegistry.set(a.uuid, a);
    return a;
  };
  const host = (name = "Host", extra: any = {}) => {
    const h = new SR2Actor();
    const sys = Object.create(HostDataModel.prototype);
    Object.assign(sys, { gridKind: "host", parentUuid: "", ltgNumber: "", securityCode: "red", securityValue: 6, subsystems: { access: 4, control: 4, index: 4, files: 4, slave: 4 }, tally: 0, alert: "none", sheaf: [],
      files: [{ id: "a", name: "Memo", size: 10, value: 0, paydata: false, encrypted: 0, scramble: 0, foundBy: [] }],
      securityDeckers: [], spotted: [], smoke: { rating: 0, tn: 0, by: "", round: -1, worldTime: -1 }, ...extra });
    sys.prepareDerivedData();
    Object.assign(h, { type: "host", name, uuid: `Actor.v46h${(host as any).n = ((host as any).n ?? 0) + 1}`, system: sys });
    uuidRegistry.set(h.uuid, h);
    return h;
  };
  const ic = (h: any, extra: any = {}, items: any[] = []) => {
    const i = new SR2Actor();
    const sys = Object.create(IcDataModel.prototype);
    Object.assign(sys, { rating: 6, category: "white", icType: "", damageLevel: "M", damageType: "physical", initiativeDice: 0, hostUuid: h?.uuid ?? "", matrix: { monitor: 0 },
      kind: "ic", ownerUuid: "", smart: false, behavior: "killer", guards: "", traceMode: "dump", attribute: "evasion", payload: "", party: "", construct: [], ...extra });
    sys.prepareDerivedData();
    Object.assign(i, { type: "ic", name: extra.name ?? `${extra.behavior ?? "killer"}-${sys.rating}`, uuid: `Actor.v46ic${(ic as any).n = ((ic as any).n ?? 0) + 1}`, system: sys, items: withGet(items) });
    uuidRegistry.set(i.uuid, i);
    return i;
  };
  const noDetect = () => faces.push(1, 1, 1, 1, 1, 1);
  before(async () => {
    ({ HostDataModel, IcDataModel, VehicleDataModel, SiteDataModel } = await import("../models/index.ts"));
    g.fromUuidSync = (u: string) => uuidRegistry.get(u) ?? null;
    g.game.users = [{ id: "gm1", isGM: true }];
    g.game.user = { isGM: true, id: "gm1" };
    g.game.time = { worldTime: 0 };
  });
  afterEach(() => { delete g.game.actors; g.game.time = { worldTime: 0 }; delete g.canvas; delete g.game.paused; });

  test("a construct IC acts as one of its component behaviors; others are refused", async () => {
    chat.length = 0; warnings.length = 0;
    const h = host();
    const a = decker(); await a.jackIn(h.uuid);
    const c = ic(h, { name: "Construct-6", construct: ["trace"] });
    assert.equal(await c.icAttack({ targetUuid: a.uuid, behavior: "probe" }), null);
    assert.match(warnings.at(-1) ?? "", /cannot act as Probe IC/);
    faces.push(5, 5, 5, 1, 1, 1);                                     // 3 vs Evasion 5
    const r = await c.icAttack({ targetUuid: a.uuid, behavior: "trace" });
    assert.equal(r.successes, 3);
    assert.match(chat.at(-1).content, /Construct-6 \(Trace, construct\) traces/);
    await a.defend(chat.at(-1).flags.sr2e.attack, 0);
    assert.equal(a.system.matrix.trace.active, true);
    assert.equal(a.system.matrix.trace.icName, "Construct-6");
  });

  test("a tortoise: meat-speed initiative, half Hacking Pool, black IC only do Matrix damage, no dump shock on a crash", async () => {
    chat.length = 0;
    const h = host();
    const a = decker("Turtle", { deck: { tortoise: true }, matrix: { sim: "hot" } });
    const m = a.system.derived.matrix;
    assert.deepEqual({ t: m.tortoise, sim: m.sim, r: m.reaction, d: m.initiativeDice, pool: a.system.derived.hackingPool }, { t: true, sim: "cold", r: 5, d: 1, pool: 2 });
    await a.jackIn(h.uuid);
    const b = ic(h, { name: "Black-6", category: "black" });
    faces.push(5, 5, 5, 1, 1, 1);
    await b.icAttack({ targetUuid: a.uuid });
    assert.match(chat.at(-1).content, /a tortoise: Matrix damage only/);
    await a.defend(chat.at(-1).flags.sr2e.attack, 0);
    const hit = chat.at(-1);
    assert.match(hit.content, /Matrix damage/);
    assert.equal(hit.flags.sr2e.damage.black, undefined);
    a.system.matrix.monitor = 9;
    chat.length = 0;
    faces.push(1, 1, 1, 1);                                           // Bod 4: nothing
    await a.resistFromState(hit.flags.sr2e.damage);
    assert.equal(a.system.matrix.jackedIn, false);
    assert.ok(!chat.some((x) => /data-sr2e-action="dumpShock"/.test(x.content)));
  });

  test("an ICCM filter turns black IC damage to Stun and adds dice to resist it and dump shock", async () => {
    chat.length = 0;
    const h = host();
    const iccm = { id: "iccm", type: "cyberware", name: "ICCM", system: { installed: true, kind: "iccm", rating: 2, essenceCost: 0.2, grade: "standard", attributes: {}, reaction: 0, initiativeDice: 0 } };
    const a = decker("Filtered", { items: [iccm] });
    assert.equal(a.system.derived.cyber.iccm, 2);
    await a.jackIn(h.uuid);
    const b = ic(h, { name: "Black-6", category: "black", damageType: "physical" });
    faces.push(5, 5, 5, 1, 1, 1);
    await b.icAttack({ targetUuid: a.uuid });
    await a.defend(chat.at(-1).flags.sr2e.attack, 0);
    const dmg = chat.at(-1).flags.sr2e.damage;
    assert.equal(dmg.damageType, "stun");
    faces.push(1, 1, 1, 1, 1, 1, 2);                                  // Willpower 5 + ICCM 2 = 7 dice
    await a.resistFromState(dmg);
    assert.match(chat.at(-1).content, /Willpower \+ ICCM 2/);
    assert.equal(dmg.level, "S");                                      // 3 net successes stage M up to S
    assert.equal(a.system.monitor.stun, 6);
    faces.push(1, 1, 1, 1, 1, 1, 2);
    await a.rollDumpShock(6);
    assert.match(chat.at(-1).content, /\[ICCM \+2\]/);
  });

  test("party IC share the best initiative and attack together; derezzed IC and ownerless frames sit out", async () => {
    chat.length = 0;
    const h = host();
    const h2 = host("Other");
    const a = decker(); await a.jackIn(h.uuid);
    const k1 = ic(h, { name: "Killer A", party: "Alpha" });
    const k2 = ic(h, { name: "Killer B", party: "Alpha" });
    const bar = ic(h, { name: "Wall", party: "Alpha", behavior: "barrier", guards: "files" });
    const far = ic(h2, { name: "Elsewhere", party: "Alpha" });
    const combat = new SR2Combat();
    combat.combatants = [{ id: "c1", actor: k1, initiative: 12 }, { id: "c2", actor: k2, initiative: 19 }, { id: "c3", actor: bar, initiative: 8 }, { id: "c4", actor: far, initiative: 3 }];
    assert.equal(await combat.alignParties(), 2);
    assert.deepEqual(combat.combatants.map((c: any) => c.initiative), [19, 19, 19, 3]);
    g.game.actors = [k1, k2, bar, far, a];
    assert.deepEqual(k1.partyMembers().map((x: any) => x.name), ["Killer A", "Killer B", "Wall"]);
    faces.push(1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2);
    assert.equal(await k1.partyAttack(a.uuid), 2);
    // Derezzed IC and a frame whose owner has jacked out skip their turns; an agent still acts.
    k2.system.matrix.monitor = 10; k2.system.prepareDerivedData();
    const frame = ic(h, { kind: "frame", ownerUuid: a.uuid, name: "Frame" });
    const agent = ic(h, { kind: "agent", ownerUuid: a.uuid, name: "Agent" });
    assert.equal(SR2Combat.matrixIdle(k2), true);
    assert.equal(SR2Combat.matrixIdle(frame), false);
    await a.jackOut();
    assert.equal(SR2Combat.matrixIdle(frame), true);
    assert.equal(SR2Combat.matrixIdle(agent), false);
    combat.turns = [{ id: "t1", actor: k2, initiative: 10 }, { id: "t2", actor: frame, initiative: 10 }, { id: "t3", actor: agent, initiative: 10 }, { id: "t4", actor: k1, initiative: 10 }];
    (Object.getPrototypeOf(SR2Combat.prototype) as any).setupTurns = function () { return this.turns; };
    assert.deepEqual(combat.setupTurns().map((c: any) => c.id), ["t3", "t4"]);
  });

  test("dialling an LTG number logs on from anywhere and is remembered; Locate number learns the connected nodes", async () => {
    chat.length = 0; warnings.length = 0;
    const path = RULES.MATRIX.grid.enforcePath;
    (RULES.MATRIX.grid as any).enforcePath = "block";
    try {
      const rtg = host("Seattle RTG", { gridKind: "rtg" });
      const ltg = host("Downtown LTG", { gridKind: "ltg", parentUuid: rtg.uuid, ltgNumber: "NA/UCAS-SEA-2206" });
      const h = host("Mitsuhama", { parentUuid: ltg.uuid });
      const rtg2 = host("Denver RTG", { gridKind: "rtg" });
      const h2 = host("Far host", { parentUuid: rtg2.uuid });
      g.game.actors = [rtg, ltg, h, rtg2, h2];
      const a = decker(); await a.jackIn(h2.uuid);
      noDetect(); faces.push(5, 1, 1, 1, 1);
      assert.equal(await a.systemTest("", { operationId: "logon", targetUuid: ltg.uuid }), null);   // not reachable from Denver
      faces.length = 0;
      assert.equal(await a.systemTest("", { operationId: "logon", number: "555-0000" }), null);
      assert.match(warnings.at(-1) ?? "", /No node answers 555-0000/);
      noDetect(); faces.push(5, 1, 1, 1, 1);
      const r = await a.systemTest("", { operationId: "logon", number: "na ucas sea 2206" });
      assert.equal(r.successes, 1);
      assert.equal(a.system.matrix.hostUuid, ltg.uuid);
      assert.match(chat.at(-1).content, /dials NA\/UCAS-SEA-2206 and logs on to <strong>Downtown LTG/);
      assert.deepEqual(a.system.matrix.numbers, ["NA/UCAS-SEA-2206"]);
      // From the host below it, Locate number finds the LTG's number.
      const b = decker("B"); await b.jackIn(h.uuid);
      noDetect(); faces.push(5, 1, 1, 1, 1);
      await b.systemTest("", { operationId: "locateNumber" });
      assert.match(chat.at(-1).content, /Downtown LTG <strong>NA\/UCAS-SEA-2206/);
      assert.deepEqual(b.system.matrix.numbers, ["NA/UCAS-SEA-2206"]);
    } finally { (RULES.MATRIX.grid as any).enforcePath = path; }
  });

  test("uploading a deck file puts it in the host's data stores; editing alters or erases a located file", async () => {
    chat.length = 0;
    const h = host();
    const a = decker("Decker", { deck: { files: [{ name: "Virus", size: 20, value: 0, paydata: false, source: "" }] } });
    await a.jackIn(h.uuid);
    noDetect(); faces.push(5, 1, 1, 1, 1);
    await a.systemTest("", { operationId: "uploadData", upload: { deckId: "deck", index: 0 } });
    const up = h.system.files.find((f: any) => f.name === "Virus");
    assert.ok(up);
    assert.deepEqual({ by: up.uploadedBy, found: up.foundBy }, { by: "Decker", found: [a.uuid] });
    assert.ok(chat.some((m) => /Uploading <strong>Virus<\/strong> \(20 Mp\) takes <strong>1 Combat Turn/.test(m.content)));
    h.system.files[0].foundBy = [a.uuid];
    noDetect(); faces.push(5, 1, 1, 1, 1);
    await a.systemTest("", { operationId: "editFile", fileId: "a", editMode: "alter", editNote: "adds a pass" });
    assert.equal(h.system.files[0].edited, "Decker: adds a pass");
    noDetect(); faces.push(5, 1, 1, 1, 1);
    await a.systemTest("", { operationId: "editFile", fileId: "a", editMode: "erase" });
    assert.equal(h.system.files.some((f: any) => f.id === "a"), false);
  });

  test("an agent searches two hosts by itself: it logs on to each and what it finds is its owner's", async () => {
    chat.length = 0;
    const h1 = host("Host 1");
    const h2 = host("Host 2", { files: [{ id: "b", name: "Payroll", size: 30, value: 0, paydata: true, encrypted: 0, scramble: 0, foundBy: [] }] });
    const a = decker();
    const agent = ic(null, { kind: "agent", ownerUuid: a.uuid, rating: 4, name: "Agent" });
    g.game.actors = [h1, h2, agent, a];
    for (let i = 0; i < 2; i++) { noDetect(); faces.push(5, 1, 1, 1, 1, 1); noDetect(); faces.push(5, 1, 1, 1, 1, 1); }
    const r = await a.agentSearch(agent.uuid, { hostUuids: [h1.uuid, h2.uuid], stopOnFind: false });
    assert.deepEqual(r, { searched: 2, found: 2, hops: 0 });
    assert.equal(agent.system.hostUuid, h2.uuid);
    assert.deepEqual(h1.system.files[0].foundBy, [a.uuid]);
    assert.deepEqual(h2.system.files[0].foundBy, [a.uuid]);
    assert.match(chat.at(-1).content, /Agent searches 2 hosts.*2 searched, 2 files found/s);
  });

  test("writing a program and building a deck part: the item, the days and the parts' cost", async () => {
    chat.length = 0; warnings.length = 0;
    const a = decker("Coder", { extra: { nuyen: 20000 } });
    faces.push(5, 5, 1, 1, 1);                                         // Computer 5 vs Browse 3
    await a.writeProgram({ kind: "browse", rating: 3 });
    const made = a.items.find((i: any) => i.name === "Browse 3");
    assert.ok(made && made.type === "program" && made.system.loaded === false);
    assert.match(chat.at(-1).content, /<strong>5 days<\/strong> of work \(9 ÷ 2\)/);
    faces.push(5, 5, 1, 1, 1);                                         // a new deck's MPCP 4 (Computer: TN 4)
    await a.buildDeckPart({ part: "mpcp", rating: 4, name: "Homebrew" });
    const deck = a.items.find((i: any) => i.name === "Homebrew");
    assert.equal(deck.system.mpcp, 4);
    assert.equal(a.system.nuyen, 4000);
    assert.match(chat.at(-1).content, /MPCP 4, in <strong>16 days<\/strong>.*materials 16000¥/);
    assert.equal(await a.buildDeckPart({ part: "evasion", rating: 3 }), null);   // a new deck starts with its MPCP
    faces.push(1, 2, 2, 2, 2);
    await a.buildDeckPart({ deckId: deck.id, part: "evasion", rating: 5 });
    assert.match(shown(warnings.join(" ")), /Evasion 5 is above the deck's MPCP 4/);
    assert.match(chat.at(-1).content, /No progress/);
    assert.equal(deck.system.evasion ?? 0, 0);
    assert.equal(a.system.nuyen, 4000);
  });

  test("an otaku's living persona comes from their attributes (house rule)", () => {
    const old = RULES.MATRIX.otaku.enabled;
    (RULES.MATRIX.otaku as any).enabled = true;
    try {
      const a = decker("Otaku", { deck: { living: true, mpcp: 1, bod: 1, evasion: 1, masking: 1, sensors: 1, responseIncrease: 0 } });
      const m = a.system.derived.matrix;
      assert.deepEqual({ mpcp: m.mpcp, bod: m.bod, ev: m.evasion, mask: m.masking, dice: m.initiativeDice, living: m.living }, { mpcp: 4, bod: 4, ev: 4, mask: 3, dice: 2, living: true });
    } finally { (RULES.MATRIX.otaku as any).enabled = old; }
  });

  test("a wireless link: out of range refuses (house rule), near the edge adds TN", async () => {
    warnings.length = 0;
    const old = RULES.SIGNAL.outOfRange;
    (RULES.SIGNAL as any).outOfRange = "block";
    try {
      const h = host();
      const a = decker("Mobile", { deck: { signal: 3 }, matrix: { connection: "cellular", relayKm: 20 } });
      assert.equal(await a.jackIn(h.uuid), false);
      assert.match(warnings.at(-1) ?? "", /out of range: 20 km: out of range \(signal 3 reaches 10 km\)/);  // v0.79.0: a decker's link keeps the old table
      a.system.matrix.relayKm = 9;
      assert.equal(await a.jackIn(h.uuid), true);
      noDetect(); faces.push(5, 1, 1, 1, 1);
      const r = await a.systemTest("", { operationId: "analyzeHost" });
      assert.ok(r.modifiers.some((x: any) => x.label === "Weak signal" && x.value === 1));
    } finally { (RULES.SIGNAL as any).outOfRange = old; }
  });

  const vehicle = (extra: any = {}, items: any[] = []) => {
    const v = new SR2Actor();
    const sys = Object.create(VehicleDataModel.prototype);
    Object.assign(sys, { category: "car", skill: "", drone: true, handling: 4, handlingOffroad: 0, speed: 90, accel: 10, body: 4, armor: 3, signature: 2, autonav: 0, pilot: 3, sensor: 3, ecm: 0, eccm: 0, ecd: 0,
      condition: 0, currentSpeed: 30, offroad: false, controllerUuid: "", controlMode: "autopilot", occupants: [], locks: [], chase: { quarryUuid: "", metres: 0 },
      load: 0, sensorMode: "active", autosofts: { maneuver: 0, targeting: 0, clearsight: 0 }, mods: [], jammed: { active: false, by: "", rating: 0 }, ...extra });
    Object.assign(v, { type: "vehicle", name: extra.name ?? "Drone", uuid: `Actor.v46v${(vehicle as any).n = ((vehicle as any).n ?? 0) + 1}`, system: sys, items: withGet(items) });
    sys.parent = v; sys.prepareDerivedData();
    uuidRegistry.set(v.uuid, v);
    return v;
  };
  const rigger = (name = "Rigger", items: any[] = [], extra: any = {}) => {
    const a = makeActor(D, { poolSpent: { combat: 0, spell: 0, hacking: 0, control: 0 }, rigging: { vehicleUuid: "", jumpedIn: false, subscribed: [] }, nuyen: 0, ledger: [], ...extra });
    a.name = name; a.type = "character";
    a.items = withGet([{ id: "vcr", type: "cyberware", name: "Control rig", system: { installed: true, essenceCost: 2, grade: "standard", attributes: {}, reaction: 0, initiativeDice: 0, controlRig: 2 } }, ...items]);
    a.system.parent = a; a.system.prepareDerivedData();
    uuidRegistry.set(a.uuid, a);
    return a;
  };

  test("autosofts help the autopilot; an overloaded vehicle drives worse; passive sensors are harder but unnoticed", async () => {
    chat.length = 0;
    const someone = rigger("Passenger");
    const v = vehicle({ autosofts: { maneuver: 4, targeting: 0, clearsight: 2 }, load: 100, occupants: [someone.uuid] }, [{ id: "crate", type: "gear", name: "Crate", system: { weight: 80, quantity: 1 } }]);
    assert.deepEqual(v.system.derived.cargo, { kg: 180, load: 100, over: true, tracked: true, cf: RULES.VEHICLES.cargo.personCf, cargoFactor: 0, overCf: false, overKg: true });
    faces.push(1, 1, 1, 1, 1, 2);
    const r = await v.driveTest({});
    assert.equal(r.totalDice, 6);                                       // Pilot 3 + maneuver capped at 3
    assert.equal(r.targetNumber, 6);                                    // Handling 4 + overloaded 2
    assert.match(chat.at(-1).content, /Pilot 3 \+ maneuver autosoft 3/);
    const target = vehicle({ name: "Target", ecd: 3 });
    v.system.sensorMode = "passive";
    chat.length = 0;
    faces.push(1, 1, 1, 1, 2);
    const s = await v.sensorTest(target.uuid);
    assert.equal(s.totalDice, 5);                                       // Sensor 3 + clearsight 2
    assert.equal(s.targetNumber, 4);                                    // Signature 2 + passive 2
    assert.equal(chat.length, 1);                                       // no ECD roll
  });

  test("modifications change a stat and cost the payer; taking one out puts the stat back", async () => {
    chat.length = 0;
    const payer = rigger("Owner", [], { nuyen: 10000 });
    const v = vehicle({ mods: [
      { id: "m1", name: "", kind: "armor", rating: 2, cost: 0, installed: false, stat: "", delta: 0 },
      { id: "m2", name: "Tuned", kind: "handling", rating: 5, cost: 1000, installed: false, stat: "", delta: 0 },
    ] });
    assert.equal(await v.installMod(0, { payer }), true);
    assert.equal(v.system.armor, 5);
    assert.equal(payer.system.nuyen, 2000);
    assert.match(chat.at(-1).content, /Extra armor<\/strong> \(rating 2\) goes into <strong>Drone<\/strong>: Armor \+2, 8000¥ paid by Owner/);
    await v.installMod(1, { payer });
    assert.equal(v.system.handling, 1);                                 // never below 1
    assert.equal(v.system.mods[1].delta, -3);
    assert.equal(payer.system.nuyen, 1000);
    await v.installMod(1, { remove: true });
    assert.equal(v.system.handling, 4);
    await v.installMod(0, { remove: true });
    assert.equal(v.system.armor, 3);
    assert.equal(await v.installMod(0, { payer: rigger("Broke") }), false);  // can't pay
    assert.equal(v.system.armor, 3);
  });

  test("jamming cuts a remote link: the rigger is pushed out and can't jump back in or send commands until it clears", async () => {
    chat.length = 0; warnings.length = 0;
    const r = rigger("Remote", [{ id: "rcd", type: "gear", name: "RCD", system: { rcdRating: 2, signal: 0, quantity: 1 } }]);
    const d = vehicle({ eccm: 1 });
    await d.setController(r, "jumped");
    assert.equal(d.system.controlMode, "jumped");
    await r.subscribeDrone(d);
    const jammer = vehicle({ name: "Jammer van", ecm: 4, drone: false });
    g.game.actors = [r, d, jammer];
    faces.push(5, 1, 1, 1);                                             // ECM 4 vs signal 2 + ECCM 1
    const out = await jammer.jamTest(d.uuid);
    assert.deepEqual(out, { jammed: true });
    assert.match(chat.at(-1).content, /jammer 4 vs signal 2 \+ ECCM 1/);
    assert.match(chat.at(-1).content, /Remote is pushed out of Drone/);
    assert.deepEqual({ j: d.system.jammed.active, c: d.system.controllerUuid, v: r.system.rigging.vehicleUuid }, { j: true, c: "", v: "" });
    assert.equal(await d.setController(r, "jumped"), false);
    assert.match(warnings.at(-1) ?? "", /link is jammed by Jammer van/);
    assert.equal(await r.groupDrive({}), 0);
    await d.unjam();
    assert.equal(await d.setController(r, "jumped"), true);
  });

  test("firing arcs from the token's rotation; chase turns move the pursuer's token", async () => {
    const v = vehicle({ name: "Gunboat" });
    const t = vehicle({ name: "Mark" });
    v.getActiveTokens = () => [{ center: { x: 0, y: 0 }, document: { rotation: 0 } }];
    t.getActiveTokens = () => [{ center: { x: 100, y: 0 }, document: {} }];
    const gun = { system: { mount: "fixed", arc: "front" } };
    assert.deepEqual(SR2Actor.arcCheck(v, gun, t.uuid), { inside: false, offBy: 45 });
    assert.deepEqual(SR2Actor.arcCheck(v, { system: { mount: "fixed", arc: "right" } }, t.uuid), { inside: true, offBy: 0 });
    assert.equal(SR2Actor.arcCheck(v, { system: { mount: "turret", arc: "front" } }, t.uuid), null);
    const old = RULES.VEHICLES.arcs.enforce;
    (RULES.VEHICLES.arcs as any).enforce = "block";
    warnings.length = 0;
    try {
      v.system.occupants = [];
      const auto = await v.fireMounted(v, { name: "Gun", system: { mount: "fixed", arc: "front" } }, { targetUuid: t.uuid });
      assert.equal(auto, null);
      assert.match(shown(warnings.at(-1)), /Mark is 45° outside Gun's front arc/);
    } finally { (RULES.VEHICLES.arcs as any).enforce = old; }
    // Chase tokens.
    const moved: any[] = [];
    const p = vehicle({ name: "Pursuer" });
    const q = vehicle({ name: "Quarry" });
    p.getActiveTokens = () => [{ center: { x: 1000, y: 0 }, w: 100, h: 100, document: { x: 950, y: -50, async update(d: any) { moved.push(d); } } }];
    q.getActiveTokens = () => [{ center: { x: 0, y: 0 }, w: 100, h: 100, document: { x: -50, y: -50 } }];
    g.canvas = { grid: { size: 100, distance: 1 } };
    const note = await SR2Actor.placeChaseTokens(p, q, 4);
    assert.deepEqual(moved, [{ x: 350, y: -50 }]);
    assert.match(note, /moved 4 m behind Quarry/);
    g.game.paused = true;
    assert.match(await SR2Actor.placeChaseTokens(p, q, 4), /paused/);
  });

  test("review fixes: a player's jam goes on a GM card; an agent counts finds on a host the player doesn't own; a guarding construct joins a party attack; party names are trimmed", async () => {
    chat.length = 0;
    const d = vehicle({ name: "Their drone" });
    d.isOwner = false;
    const jammer = vehicle({ name: "Van", ecm: 4, drone: false });
    faces.push(5, 1, 1, 1);
    assert.deepEqual(await jammer.jamTest(d.uuid), { jammed: true });
    assert.equal(d.system.jammed.active, false);
    assert.match(chat.at(-1).content, /data-sr2e-action="applyJam"/);
    // v0.81.0 (SEC1-11): the jammer rides along, so the GM's Apply is bound to it.
    assert.deepEqual(chat.at(-1).flags.sr2e.jam, { droneUuid: d.uuid, by: "Van", rating: 4, jammerUuid: jammer.uuid });
    d.isOwner = true;
    assert.equal(await SR2Actor.applyJam(d.uuid, "Van", 4), true);
    assert.equal(d.system.jammed.active, true);
    // Agent search on a host the player doesn't own: the find waits on a GM card but is still counted.
    const h = host("Theirs");
    h.isOwner = false;
    const a = decker();
    const agent = ic(null, { kind: "agent", ownerUuid: a.uuid, rating: 4, name: "Agent" });
    g.game.actors = [h, agent, a];
    noDetect(); faces.push(5, 1, 1, 1, 1, 1); noDetect(); faces.push(5, 1, 1, 1, 1, 1);
    const r = await a.agentSearch(agent.uuid, { hostUuids: [h.uuid] });
    assert.equal(r.found, 1);
    assert.deepEqual(h.system.files[0].foundBy, []);
    // Constructs and party names.
    const h2 = host();
    const p = decker("Target"); await p.jackIn(h2.uuid);
    const guard = ic(h2, { name: "Guard", behavior: "barrier", guards: "files", construct: ["killer"], party: "Alpha " });
    const k = ic(h2, { name: "Killer", party: "Alpha" });
    g.game.actors = [guard, k, p];
    chat.length = 0;
    faces.push(1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 2);
    assert.equal(await k.partyAttack(p.uuid), 2);
    assert.match(chat[0].content, /Guard \(Killer, construct\) attacks/);
    const combat = new SR2Combat();
    combat.combatants = [{ id: "c1", actor: guard, initiative: 5 }, { id: "c2", actor: k, initiative: 15 }];
    assert.equal(await combat.alignParties(), 1);
    assert.equal(combat.combatants[0].initiative, 15);
  });

  const site = (devices: any[]) => {
    const s = new SR2Actor();
    const sys = Object.create(SiteDataModel.prototype);
    Object.assign(sys, { devices, tally: 0, alert: "none", steps: [], response: { round: -1, worldTime: -1, arrived: false, force: "" }, riggerUuid: "", slaved: [], hostUuid: "" });
    sys.prepareDerivedData();
    Object.assign(s, { type: "site", name: "Lab", uuid: `Actor.v46s${(site as any).n = ((site as any).n ?? 0) + 1}`, system: sys, items: withGet([]) });
    uuidRegistry.set(s.uuid, s);
    return s;
  };
  const dev = (id: string, extra: any = {}) => ({ id, name: id, kind: "camera", rating: 4, tokenUuid: "", sceneId: "", wallId: "", active: true, bypassed: false, scanKind: "", sense: "visual", tamper: 0, notes: "", ...extra });

  test("device senses: improved invisibility blinds a camera, a chameleon suit makes it work harder, ultrasound ignores both", async () => {
    chat.length = 0;
    const s = site([dev("cam"), dev("sonar", { sense: "ultrasound", kind: "sensor" })]);
    const ghost = rigger("Ghost", [{ id: "st", type: "skill", name: "Stealth", system: { rating: 3, attribute: "quickness" } }], { sustaining: [{ spellName: "Improved Invisibility", force: 4, category: "illusion", focusId: "", successes: 3, quickened: false, spiritUuid: "", until: -1 }] });
    assert.deepEqual(ghost.concealmentOf().map(({ kind, rating, source }: any) => ({ kind, rating, source })), [{ kind: "improvedInvisibility", rating: 3, source: "Improved Invisibility" }]);
    assert.deepEqual(await s.detect("cam", ghost.uuid), { detected: false });
    assert.match(chat.at(-1).content, /cannot pick up Ghost: Improved Invisibility 3/);
    faces.push(5, 5, 5, 1, 5, 1, 1);                                    // the sonar sees through it
    assert.deepEqual(await s.detect("sonar", ghost.uuid), { detected: true });
    const suit = rigger("Suit", [{ id: "st", type: "skill", name: "Stealth", system: { rating: 3, attribute: "quickness" } }, { id: "ch", type: "gear", name: "Chameleon suit", system: { stealth: { kind: "chameleon", rating: 3, worn: true } } }]);
    chat.length = 0;
    faces.push(5, 5, 5, 5, 5, 1, 1);                                    // camera vs Stealth 3 + chameleon 3 = 6: nothing
    assert.deepEqual(await s.detect("cam", suit.uuid), { detected: false });
    assert.match(chat.at(-1).content, /Chameleon suit 3/);
  });

  test("a tamper alarm checks a successful bypass and trips on as many successes; the card gives the time it took", async (t) => {
    t.after(oldWay({"BOOK_V78.tamper.mode": "opposed"})); // v0.78.0: the old rule (a house rule)
    chat.length = 0;
    const s = site([dev("lock", { kind: "maglock", rating: 4, tamper: 4, sense: "" })]);
    const thief = rigger("Thief", [{ id: "el", type: "skill", name: "Electronics", system: { rating: 3, attribute: "intelligence" } },
      { id: "kit", type: "gear", name: "Electronics kit", system: { quantity: 1, bypassTool: { kind: "electronicsKit", rating: 1 } } }]);
    faces.push(5, 5, 1);                                                // Electronics 3 vs 4 − kit 1: 2 successes
    faces.push(5, 5, 1, 1);                                             // tamper 4 vs Electronics 3: 2
    await thief.bypassLock(s, "lock");
    assert.equal(s.system.devices[0].bypassed, true);
    assert.deepEqual({ tally: s.system.tally, alert: s.system.alert }, { tally: 3, alert: "active" });
    assert.ok(chat.some((m) => /after 10 Combat Turns \(30 s\) of work\..*tamper alarm trips/s.test(m.content))); // v0.77.0: maglock circuit 20 turns ÷ 2
    assert.ok(chat.some((m) => /tamper alarm 4 vs 3/.test(m.content) && m.whisper?.includes("gm1")));
  });
});

describe("v0.47.0 combat and gear", () => {
  const P = { body: 4, quickness: 5, strength: 3, charisma: 3, intelligence: 4, willpower: 4 };
  const withGet = (list: any[]) => Object.assign(list, { get(id: string) { return list.find((i: any) => i.id === id); } });
  const person = (items: any[] = [], extra: any = {}, attrs: any = P) => {
    const a = makeActor(attrs, { poolSpent: { combat: 0, spell: 0, hacking: 0, control: 0 }, karma: { good: 0, pool: 0, poolSpent: 0, career: 0 }, drugs: [], ...extra });
    a.name = extra.name ?? "Runner"; a.type = "character"; (a as any).id = `id-${a.uuid}`;
    a.items = withGet(items.map((it) => ({ ...it, async update(d: any) { for (const [k, v] of Object.entries(d)) setPath(this, k, v); a.system.prepareDerivedData(); } })));
    (a as any).statuses = new Set<string>();
    a.system.parent = a; a.system.prepareDerivedData();
    uuidRegistry.set(a.uuid, a);
    return a;
  };
  before(() => {
    g.fromUuidSync = (u: string) => uuidRegistry.get(u) ?? null;
    g.game.users = [{ id: "gm1", isGM: true }];
    g.game.user = { isGM: true, id: "gm1" };
    g.game.time = { worldTime: 0 };
    delete g.game.combat;
  });
  afterEach(() => { faces.length = 0; });

  test("unskilled melee defaults to the skill's linked attribute (Strength), or Quickness by house rule", () => {
    const a = person();
    const knife = { name: "Knife", system: { melee: true, skill: "Edged Weapons", damagePower: 3, damageLevel: "L", damageType: "physical", modes: "", reach: 0 } };
    assert.equal(a.planAttack(knife, {}).dice, 3);
    const old = RULES.COMBAT.melee.defaultAttribute;
    (RULES.COMBAT.melee as any).defaultAttribute = "quickness";
    try { assert.equal(a.planAttack(knife, {}).dice, 5); } finally { (RULES.COMBAT.melee as any).defaultAttribute = old; }
    // A cyberarm's own Strength counts when defaulting to Strength with it.
    const borg = person([{ id: "arm", type: "cyberware", name: "Cyberarm", system: { installed: true, essenceCost: 1, grade: "standard", attributes: {}, reaction: 0, initiativeDice: 0, kind: "cyberlimb", damaged: false, housedIn: "", bioware: false, armorBallistic: 0, armorImpact: 0, limb: { location: "rightArm", strength: 8, quickness: 6, capacity: 1 } } }]);
    assert.equal(borg.planAttack(knife, { limbId: "arm" }).dice, 8);
  });

  test("a worn shield's Parry adds dice to a ranged dodge too, unless the house rule turns it off", async () => {
    chat.length = 0;
    const def = person([{ id: "sh", type: "armor", name: "Riot shield", system: { ballistic: 0, impact: 2, worn: true, adds: true, degraded: 0, weight: 0, parry: 2 } }]);
    faces.push(2, 2);
    await def.defend({ attackerUuid: "Actor.atk", targetUuid: def.uuid, weaponName: "Pistol", melee: false, damageType: "physical", power: 6, level: "M", attackSuccesses: 2, targetNumber: 4 }, 0);
    assert.match(chat.at(-1).content, /Dodge defense \(Riot shield \+2\)/);
    assert.equal(faces.length, 0);
    (RULES.GEAR.shields as any).ranged = "off";
    try {
      await def.defend({ attackerUuid: "Actor.atk", targetUuid: def.uuid, weaponName: "Pistol", melee: false, damageType: "physical", power: 6, level: "M", attackSuccesses: 2, targetNumber: 4 }, 0);
      assert.doesNotMatch(chat.at(-1).content, /Riot shield/);
    } finally { (RULES.GEAR.shields as any).ranged = "dice"; }
  });

  test("looking over several people is one action at +1 TN per extra person; a frisk takes one person", async () => {
    chat.length = 0;
    const searcher = person([], { name: "Guard" });
    const a = person([{ id: "h", type: "weapon", name: "Hold-out", system: { melee: false, concealability: 6 } }], { name: "A" });
    const b = person([{ id: "h", type: "weapon", name: "Pistol", system: { melee: false, concealability: 4 } }], { name: "B" });
    faces.push(6, 1, 1, 1, 1);                                            // Hold-out: TN 6 + 1 = 7: the six re-rolls a 1 (7): found
    faces.push(1, 1, 1, 1);                                               // Pistol: TN 5: missed
    const r = await searcher.searchGroup([a.uuid, b.uuid, a.uuid]);
    assert.deepEqual(r.map((x: any) => [x.found, x.missed]), [[["Hold-out"], []], [[], ["Pistol"]]]);
    assert.ok(chat.some((m) => /Hold-out \(<span[^>]*>TN 7<\/span>\)/.test(m.content)));
    assert.ok(chat.some((m) => /Pistol \(<span[^>]*>TN 5<\/span>\)/.test(m.content)));
    // The searcher is never one of the people searched.
    chat.length = 0;
    faces.push(1, 1, 1, 1);
    assert.equal((await searcher.searchGroup([searcher.uuid, a.uuid])).length, 1);
    assert.ok(chat.some((m) => /Hold-out \(<span[^>]*>TN 6<\/span>\)/.test(m.content)));
    chat.length = 0;
    faces.push(1, 1, 1, 1);
    const f = await searcher.searchGroup([a.uuid, b.uuid], { method: "frisk" });
    assert.equal(f.length, 1);
    assert.ok(chat.some((m) => /Guard frisks A/.test(m.content)));
  });

  test("spells against objects: mana can't; a physical combat spell at a wall damages it; drain follows", async () => {
    chat.length = 0; warnings.length = 0;
    const m = makeActor({ body: 3, quickness: 4, strength: 2, charisma: 3, intelligence: 5, willpower: 5 }, { magic: 6, poolSpent: { combat: 0, spell: 0, hacking: 0, control: 0 } });
    m.items = [{ type: "skill", name: "Sorcery", system: { rating: 4, attribute: "willpower" } }];
    m.name = "Mage";
    const bolt = (spellType: string) => ({ name: spellType === "mana" ? "Manabolt" : "Powerbolt", system: { category: "combat", spellType, learnedForce: 5, damageLevel: "M", damageType: "physical", targetNumber: 4, drainModifier: 0, drainLevel: "M" } });
    assert.equal(await m.castAtObject(bolt("mana"), { objectKind: "lowTech" }), null);
    assert.match(warnings.at(-1) ?? "", /mana spell: it has no effect on objects/);
    const wall: any = { id: "w", flags: { sr2e: { barrierRating: 6 } }, move: 20, sight: 20, light: 20, sound: 20, getFlag(_s: string, k: string) { return this.flags.sr2e[k]; }, async update(d: any) { for (const [k, v] of Object.entries(d)) { if (k.startsWith("flags.sr2e.")) this.flags.sr2e[k.slice(11)] = v; else this[k] = v; } } };
    faces.push(5, 5, 1, 1);                                               // Sorcery 4 vs low-tech TN 5: 2 successes
    faces.push(5, 5, 5, 5, 5);                                            // drain
    const r = await m.castAtObject(bolt("physical"), { force: 5, objectKind: "lowTech", wall });
    assert.equal(r.targetNumber, 5);
    assert.equal(r.successes, 2);
    assert.ok(chat.some((c) => /takes Power 7/.test(c.content)));
    assert.equal(wall.flags.sr2e.barrierRating, 5);                       // Power 7 over rating 6: −1
    assert.ok(chat.some((c) => /Drain/.test(c.content)));
    assert.equal(faces.length, 0);
    // A player can't change walls: the GM gets a card to apply it, and the drain still follows.
    chat.length = 0;
    g.game.user = { isGM: false, id: "p1" };
    try {
      wall.uuid = "Scene.s.Wall.w"; wall.canUserModify = () => false;
      faces.push(5, 5, 5, 1);
      faces.push(5, 5, 5, 5, 5);
      await m.castAtObject(bolt("physical"), { force: 5, objectKind: "lowTech", wall });
      const card = chat.find((c) => c.flags?.sr2e?.spellWall);
      assert.deepEqual(card.flags.sr2e.spellWall, { wallUuid: "Scene.s.Wall.w", power: 8, label: "Powerbolt on a wall" });
      assert.equal(wall.flags.sr2e.barrierRating, 5);
      assert.ok(chat.some((c) => /Drain/.test(c.content)));
    } finally { g.game.user = { isGM: true, id: "gm1" }; }
  });

  test("Deadly non-attack damage (an inferno) can damage cyberware too; off by house rule", async () => {
    chat.length = 0;
    const ware = { id: "eye", type: "cyberware", name: "Cybereyes", system: { installed: true, essenceCost: 0.2, grade: "standard", attributes: {}, reaction: 0, initiativeDice: 0, kind: "other", damaged: false, housedIn: "", bioware: false, armorBallistic: 0, armorImpact: 0, limb: { location: "", strength: 0, quickness: 0, capacity: 0 } } };
    const a = person([ware]);
    faces.push(1, 1, 1, 1);
    await a.resistHazard("fire", "inferno");
    assert.match(chat.at(-1).content, /data-sr2e-action="cyberDamage"/);
    (RULES.GEAR.cyberDamage as any).nonAttack = false;
    try {
      faces.push(1, 1, 1, 1);
      await a.resistHazard("fire", "inferno");
      assert.doesNotMatch(chat.at(-1).content, /cyberDamage/);
    } finally { (RULES.GEAR.cyberDamage as any).nonAttack = true; }
  });

  test("disarming a timed charge: Demolitions vs a TN raised by the setter's successes; all ones blows it", async () => {
    chat.length = 0;
    const scene: any = { id: "s47", name: "Vault", flags: { sr2e: {} }, isOwner: true, getFlag(_s: string, k: string) { return this.flags.sr2e[k]; }, async setFlag(_s: string, k: string, v: any) { this.flags.sr2e[k] = v; } };
    g.game.scenes = Object.assign([scene], { get: (id: string) => (id === scene.id ? scene : undefined) });
    g.canvas = { scene };
    const blown: any[] = [];
    const prev = SR2Actor.detonator;
    SR2Actor.detonator = async (_a: any, ctx: any) => { blown.push(ctx); };
    try {
      const setter = person([
        { id: "d", type: "skill", name: "Demolitions", system: { rating: 3, attribute: "intelligence" } },
        { id: "c4", type: "gear", name: "C-12", system: { quantity: 2, weight: 0, explosive: { power: 10, perMetre: 1, shaped: false } } },
      ]);
      faces.push(5, 5, 1);                                                // 2 successes: Power 12, disarm TN 6
      await setter.setCharge("c4", { timerSeconds: 30, point: { x: 0, y: 0, elevation: 0 }, sceneId: "s47" });
      assert.equal(SR2Actor.armedCharges(scene)[0].setterSuccesses, 2);
      const id = SR2Actor.armedCharges(scene)[0].id;
      const tech = person([{ id: "d", type: "skill", name: "Demolitions", system: { rating: 4, attribute: "intelligence" } }], { name: "Tech" });
      faces.push(5, 5, 4, 2);                                             // TN 6: nothing
      assert.equal(await tech.disarmChargeTest("s47", id), "failed");
      assert.match(chat.at(-1).content, /TN 6, set with 2 successes/);
      assert.equal(SR2Actor.armedCharges(scene).length, 1);
      faces.push(6, 1, 1, 1, 1);                                          // a six re-rolls to 7: disarmed
      assert.equal(await tech.disarmChargeTest("s47", id), "disarmed");
      assert.equal(SR2Actor.armedCharges(scene).length, 0);
      faces.push(5, 5, 1);
      await setter.setCharge("c4", { timerSeconds: 30, point: { x: 0, y: 0, elevation: 0 }, sceneId: "s47" });
      faces.push(1, 1, 1, 1);
      assert.equal(await tech.disarmChargeTest("s47", SR2Actor.armedCharges(scene)[0].id), "blown");
      assert.equal(blown.length, 1);
      assert.equal(SR2Actor.armedCharges(scene).length, 0);
    } finally {
      SR2Actor.detonator = prev;
      delete g.game.scenes; delete g.canvas;
    }
  });
});

describe("v0.48.0 health, magic and critters", () => {
  const M = { body: 4, quickness: 4, strength: 4, charisma: 5, intelligence: 5, willpower: 6 };
  const withGet = (list: any[]) => Object.assign(list, { get(id: string) { return list.find((i: any) => i.id === id); } });
  const actors: any[] = [];
  const tokens: any[] = [];
  const who = (extra: any = {}, items: any[] = []) => {
    const a = makeActor(M, { magic: 0, karma: { pool: 0, poolSpent: 0, good: 30 }, metamagic: {}, initiateGrade: 0, nuyen: 0, sustaining: [], drugs: [], geasa: [], ledger: [], recovering: [],
      diseases: [], radiation: { dose: 0, at: 0 }, lifestyle: { level: "middle", paidUntil: -1 }, poolSpent: { combat: 0, spell: 0, hacking: 0, control: 0 }, ...extra });
    a.name = extra.name ?? "Someone"; a.type = extra.type ?? "character"; (a as any).id = `id-${a.uuid}`;
    a.items = withGet(items.map((it) => ({ ...it, async update(d: any) { for (const [k, v] of Object.entries(d)) setPath(this, k, v); a.system.prepareDerivedData(); } })));
    (a as any).statuses = new Set<string>();
    a.system.parent = a; a.system.prepareDerivedData();
    uuidRegistry.set(a.uuid, a);
    actors.push(a);
    return a;
  };
  const skill = (id: string, name: string, rating: number, attribute = "willpower", kind = "active") => ({ id, type: "skill", name, system: { rating, attribute, kind } });
  const mage = (extra: any = {}, items: any[] = []) => who({ magic: 6, tradition: "hermetic", ...extra }, [skill("sorc", "Sorcery", 4), skill("conj", "Conjuring", 4, "charisma"), ...items]);
  /** A token on the stub canvas at (x, y) pixels (100 px = 1 m). */
  const place = (a: any, x: number, y: number) => {
    const t = { actor: a, center: { x, y }, document: { width: 1, height: 1, elevation: 0 }, scene: null };
    tokens.push(t);
    a.getActiveTokens = () => [t];
    return t;
  };
  const drawings: any[] = [];
  const scene: any = { id: "s48", name: "Test scene", flags: {} as any, drawings: Object.assign(drawings, { get: (id: string) => drawings.find((d) => d.id === id) ?? null }),
    getFlag(_s: string, k: string) { return this.flags[k]; }, async setFlag(_s: string, k: string, v: any) { this.flags[k] = v; },
    async createEmbeddedDocuments() { return [{ id: `dr${Math.random()}` }]; }, async deleteEmbeddedDocuments() { return []; } };
  const doc = (data: any) => ({ ...data, flags: { sr2e: { ...(data.flags?.sr2e ?? {}) } },
    getFlag(_s: string, k: string) { return this.flags.sr2e[k]; },
    async update(d: any) { for (const [k, v] of Object.entries(d)) { if (k.startsWith("flags.sr2e.-=")) delete this.flags.sr2e[k.slice(13)]; else if (k.startsWith("flags.sr2e.")) this.flags.sr2e[k.slice(11)] = v; else (this as any)[k] = v; } } });
  const walls: any[] = [];
  before(() => {
    g.game.scenes = { viewed: scene, current: scene, get: (id: string) => (id === scene.id ? scene : null), contents: [scene] };
    g.game.time = { worldTime: 0 };
    g.game.user = { isGM: true, id: "gm1", targets: new Set() }; g.game.users = [{ id: "gm1", isGM: true }];
    g.game.actors = actors;
    g.game.settings = { get: () => undefined, set: async () => {} };
    g.fromUuidSync = (u: string) => uuidRegistry.get(u) ?? null;
    delete g.game.combat;
  });
  const useCanvas = () => {
    g.canvas = {
      scene, grid: { size: 100, distance: 1, units: "m", measurePath: (pts: any[]) => ({ distance: Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y) / 100 }) },
      tokens: { placeables: tokens, controlled: [] }, walls: { placeables: walls.map((d) => ({ document: d })) },
    };
  };
  afterEach(() => { faces.length = 0; scene.flags = {}; drawings.length = 0; walls.length = 0; tokens.length = 0; g.game.time.worldTime = 0; g.game.user.isGM = true; delete g.canvas; });

  test("fire: a burnable wall burns through, fuel catches, smoke lingers and must be breathed", async () => {
    chat.length = 0;
    useCanvas();
    (RULES.FIRE as any).draw = false;
    const prevInt = RULES.FIRE.intensity;
    (RULES.FIRE as any).intensity = "blaze";
    try {
      const wall = doc({ id: "w1", c: [150, -500, 150, 500], move: 20, sight: 20, light: 20, sound: 20, flags: { sr2e: { burns: true, barrierRating: 2 } } });
      walls.push(wall);
      g.canvas.walls.placeables = walls.map((d) => ({ document: d }));
      drawings.push(doc({ id: "fuel1", x: 500, y: -100, shape: { width: 200, height: 200 }, flags: { sr2e: { fuel: "heavy" } } }));
      const victim = who({ name: "Victim" });
      place(victim, 300, 0);                                  // 3 m away: in the smoke, not the flames yet
      const f = await SR2Actor.startFire({ x: 0, y: 0 }, { source: "test" });
      assert.equal(f.fuel, undefined);
      // One spread: radius 2, a blaze: the wall at 1.5 m burns through (rating 2 → 0); the fuel at 5 m isn't reached.
      await SR2Actor.fireTicks({ round: null, worldTime: 0 }, 1);
      assert.equal(wall.flags.sr2e.barrierRating, 0);
      assert.equal(wall.move, 0);
      assert.ok(wall.flags.sr2e.breached);
      const card = chat.at(-1);
      assert.match(card.content, /A wall burns through/);
      assert.match(card.content, /In the smoke/);
      assert.deepEqual(card.flags.sr2e.smokeInhale.uuids, [victim.uuid]);
      // The fuel's nearest edge is 5 m away: radius 3 and 4 don't reach it, 5 does.
      await SR2Actor.fireTicks({ round: null, worldTime: 0 }, 1);
      await SR2Actor.fireTicks({ round: null, worldTime: 0 }, 1);
      assert.equal(SR2Actor.sceneFires(scene).length, 1);
      await SR2Actor.fireTicks({ round: null, worldTime: 0 }, 1);
      const fires = SR2Actor.sceneFires(scene);
      assert.equal(fires.length, 2);
      assert.equal(fires[1].fuel, "heavy");
      assert.equal(drawings[0].flags.sr2e.fuelFire, fires[1].id);
      assert.match(chat.at(-1).content, /Accelerant catches fire/);
      // Burning out leaves smoke for lingerTurns, then it clears.
      const first = SR2Actor.sceneFires(scene)[0];
      await SR2Actor.fireTicks({ round: null, worldTime: 0 }, RULES.FIRE.turns);
      const after = SR2Actor.sceneFires(scene).find((x: any) => x.id === first.id);
      assert.equal(after.burntOut, true);
      assert.equal(after.smokeLeft, RULES.FIRE.smoke.lingerTurns);
      // Breathing it: Body 4 vs Power; a gas mask stops it.
      faces.push(1, 1, 1, 1);
      await victim.resistSmoke({ power: 6, level: "L", type: "stun", source: "test" });
      assert.match(chat.at(-1).content, /Smoke inhalation \(test\): 6/);
      assert.equal(victim.system.monitor.stun, 1);
      const masked = who({ name: "Masked" }, [{ id: "m", type: "gear", name: "Gas mask", system: { quantity: 1, protection: { kind: "gasMask", rating: 0, worn: true } } }]);
      await masked.resistSmoke({ power: 6, level: "L", type: "stun" });
      assert.match(chat.at(-1).content, /Gas mask: the smoke does nothing/);
      await SR2Actor.fireTicks({ round: null, worldTime: 0 }, RULES.FIRE.smoke.lingerTurns);
      assert.equal(SR2Actor.sceneFires(scene).find((x: any) => x.id === first.id), undefined);
    } finally { (RULES.FIRE as any).draw = true; (RULES.FIRE as any).intensity = prevInt; }
  });

  test("fire: a fire started inside fuel burns on it; smoke on the line of sight hampers Perception", async () => {
    chat.length = 0;
    useCanvas();
    (RULES.FIRE as any).draw = false;
    try {
      drawings.push(doc({ id: "fuel2", x: -100, y: -100, shape: { width: 200, height: 200 }, flags: { sr2e: { fuel: "light" } } }));
      const f = await SR2Actor.startFire({ x: 0, y: 0 }, { source: "a match" });
      assert.equal(f.fuel, "light");
      assert.equal(drawings[0].flags.sr2e.fuelFire, f.id);
      const a = who({ name: "Watcher" });
      const b = who({ name: "Sneaker" });
      place(a, -500, 50); place(b, 500, 50);
      const mods = a.fireSmokeMods(b);
      assert.deepEqual(mods, [{ label: "Thermal smoke (flames)", value: RULES.COMBAT.smoke.thermal.normal }]);
      // GM: unmark the fuel.
      await SR2Actor.markFuel([drawings[0]], "");
      assert.equal(drawings[0].flags.sr2e.fuel, undefined);
    } finally { (RULES.FIRE as any).draw = true; }
  });

  test("contagion: a carrier passes an airborne disease to those close by; nobody catches it twice", async () => {
    chat.length = 0;
    useCanvas();
    g.game.time.worldTime = 48 * 3600;
    const carrier = who({ name: "Carrier", diseases: [{ name: "Flu", power: 5, level: "M", damageType: "stun", intervalHours: 24, nextAt: 0, recovered: 0, needed: 3, pending: false, treated: false,
      contagious: "airborne", infectedAt: 0, incubationHours: 24, source: "" }] });
    const near = who({ name: "Near" });
    const far = who({ name: "Far" });
    place(carrier, 0, 0); place(near, 150, 0); place(far, 900, 0);
    assert.equal(await carrier.spreadDisease(0), 1);
    const st = chat.at(-1).flags.sr2e.toxins;
    assert.equal(st.length, 1);
    assert.equal(st[0].targetUuid, near.uuid);
    assert.equal(st[0].vector, "inhalation");
    faces.push(1, 1, 1, 1);                                  // Body 4 vs 5: none
    await near.resistToxin(st[0]);
    assert.equal(near.system.diseases.length, 1);
    assert.equal(near.system.diseases[0].contagious, "airborne");
    assert.equal(near.system.diseases[0].source, "Carrier");
    faces.push(1, 1, 1, 1);
    await near.resistToxin(st[0]);
    assert.equal(near.system.diseases.length, 1);
    assert.match(chat.at(-1).content, /already has Flu/);
    // Still incubating: refused.
    g.game.time.worldTime = 48 * 3600 + 10;
    assert.equal(await near.spreadDisease(0), 0);
    assert.match(warnings.at(-1) ?? "", /incubating/);
  });

  test("a ghoul's bite: the soak card offers the infection when Physical damage gets through", async () => {
    chat.length = 0;
    const ghoul = who({ name: "Ghoul", type: "npc" }, [{ id: "inf", type: "power", name: "Infection", system: { special: "infection", substance: "", rating: 6, damageLevel: "M", active: false } }]);
    const plan = ghoul.planAttack(SR2Actor.unarmed(), {});
    assert.equal(plan.extras.infection.name, RULES.CRITTERS.infection.name);
    assert.equal(plan.extras.infection.from, "Ghoul");
    const victim = who({ name: "Victim" });
    const toxin = { ...(await import("../rules/index.ts")).infectionFrom({ rating: 6, damageLevel: "M" }), from: "Ghoul" };
    faces.push(1, 1, 1, 1);                                  // Body 4: no successes, M = 3 boxes
    await victim.resistDamage({ power: 6, level: "M", type: "physical", armor: 0, infection: toxin });
    const card = chat.at(-1);
    assert.match(card.content, /Resist infection/);
    assert.equal(card.flags.sr2e.infection.targetUuid, victim.uuid);
    faces.push(1, 1, 1, 1);
    await victim.resistToxin({ ...card.flags.sr2e.infection.toxin, kind: "disease" });
    assert.equal(victim.system.diseases[0].name, RULES.CRITTERS.infection.name);
    assert.equal(victim.system.diseases[0].contagious, "blood");
    // Stun damage doesn't infect.
    faces.push(1, 1, 1, 1);
    await victim.resistDamage({ power: 6, level: "M", type: "stun", armor: 0, infection: toxin });
    assert.doesNotMatch(chat.at(-1).content, /Resist infection/);
  });

  test("radiation builds up into radiation sickness; a worse stage replaces it; the dose wears off", async () => {
    chat.length = 0;
    const a = who({ name: "Rad" });
    await a.addRadiation(5, 3);
    assert.equal(a.system.radiation.dose, 15);
    assert.equal(a.system.diseases[0].name, "Mild radiation sickness");
    await a.addRadiation(5, 2);
    assert.equal(a.system.radiation.dose, 25);
    assert.equal(a.system.diseases.length, 1);
    assert.equal(a.system.diseases[0].name, "Radiation sickness");
    g.game.time.worldTime = 2 * 86400 + 5;
    await SR2Actor.timedEffects({ worldTime: g.game.time.worldTime, anyGm: true });
    assert.equal(a.system.radiation.dose, 23);
  });

  test("weather: athletics distances and movement shrink in a storm", async () => {
    chat.length = 0;
    scene.flags.weather = "storm";
    const a = who({ name: "Climber" }, [skill("ath", "Athletics", 4, "body")]);
    assert.deepEqual(a.movementNow(), { walk: Math.floor(a.system.derived.movement.walk * 0.5 * 2) / 2, run: Math.floor(a.system.derived.movement.run * 0.5 * 2) / 2, factor: 0.5 });
    faces.push(5, 5, 5, 5);                                  // 4 successes at TN 2: 8 m, halved
    const r = await a.athleticsTest("climb", { condition: "easy" });
    assert.equal(r.metres, 4);
    assert.match(chat.at(-1).content, /weather ×0.5/);
    faces.push(5, 5, 5, 5);
    assert.equal((await a.athleticsTest("climb", { condition: "easy", weather: false })).metres, 8);
  });

  test("surgery: care stretches or shortens recovery and is paid for; changing it rescales the days left", async (t) => {
    t.after(oldWay({ "GEAR_V923.surgery": "old" })); // v0.92.3: the old way (v0.92.2); __tests__/v0923-gear.test.ts has the book's
    chat.length = 0;
    const patient = who({ name: "Patient", nuyen: 5000 }, [{ id: "cw", type: "cyberware", name: "Wired reflexes", system: { installed: false, bioware: false, essenceCost: 2, grade: "standard", kind: "other" } }]);
    const doc2 = who({ name: "Doc" }, [skill("bt", "Biotech", 4, "intelligence")]);
    faces.push(5, 5, 5, 5);                                  // 4 successes: 2 × 10 / 4 = 5 days; intensive ×0.75 = 4
    await patient.surgery("cw", { surgeon: doc2, care: "intensive", pay: true });
    const rec = patient.system.recovering[0];
    assert.equal(rec.until, 4 * 86400);
    assert.equal(rec.care, "intensive");
    assert.equal(patient.system.nuyen, 5000 - 4 * RULES.HEALTH.careCosts.intensive!);
    assert.equal(patient.system.recovering[0].paid, true);
    assert.match(chat.at(-1).content, /4 days<\/strong> \(intensive care\)/);
    assert.equal(await patient.setRecoveryCare("cw", "none"), 8);
    assert.equal(patient.system.recovering[0].until, 8 * 86400);
  });

  test("possession: the body tests with the possessor's skills (house rule)", async () => {
    chat.length = 0;
    const a = mage({ astral: "projecting", metamagic: { possessing: true }, initiateGrade: 1 }, [skill("fa", "Firearms", 6, "quickness")]);
    const t = who({ name: "Body" }, [skill("fb", "Firearms", 2, "quickness")]);
    faces.push(6, 6, 6, 1, 1, 1, 1, 1, 1, 1);
    faces.push(1, 1, 1, 1, 1, 1);
    assert.equal(await a.possess(t.uuid), true);
    assert.equal(t.possessedSkill(t.items.get("fb")).system.rating, 6);
    faces.push(...Array(6).fill(1));
    await t.rollSkill(t.items.get("fb"));
    assert.match(chat.at(-1).content, /Someone's skill/);
    const prev = RULES.OCCULT.metamagic.possessing.skills;
    try {
      (RULES.OCCULT.metamagic.possessing as any).skills = "body";
      assert.equal(t.possessedSkill(t.items.get("fb")).system.rating, 2);
      (RULES.OCCULT.metamagic.possessing as any).skills = "possessor";
      // A skill only the body has: the possessor's mind doesn't know it.
      const body2 = who({ name: "Body2" }, [skill("dr", "Car", 5, "reaction")]);
      await body2.setFlag("sr2e", "possessedBy", { uuid: a.uuid, name: "Someone", attributes: {}, skills: [] });
      assert.equal(body2.possessedSkill(body2.items.get("dr")).system.rating, 0);
    } finally { (RULES.OCCULT.metamagic.possessing as any).skills = prev; }
  });

  test("an ally by ritual: costs, creation, the familiar ordeal; other ordeals", async () => {
    chat.length = 0;
    const created: any[] = [];
    g.Actor.create = async (data: any) => { const s = { ...data, uuid: `Actor.ally${created.length}` }; created.push(s); return s; };
    try {
      const a = mage({ initiateGrade: 1, nuyen: 5000, karma: { pool: 0, poolSpent: 0, good: 100 } });
      const novice = mage({ name: "Novice" });
      assert.equal(await novice.createAlly({ force: 3 }), null);
      assert.match(warnings.at(-1) ?? "", /initiate grade 1/);
      // Familiar ordeal before any ally: refused.
      assert.equal(await a.advanceInitiation(null, { ordeal: "familiar" }), false);
      assert.match(warnings.at(-1) ?? "", /familiar ordeal needs an ally/);
      faces.push(5, 5, 1, 1);                                  // Conjuring 4 vs 3: 2 successes
      faces.push(...Array(5).fill(5));                         // drain
      await a.createAlly({ force: 3, spiritType: "Raven" });
      assert.equal(created.length, 1);
      assert.equal(created[0].system.spiritKind, "ally");
      assert.equal(created[0].system.services, 0);
      assert.equal(a.system.nuyen, 2000);
      assert.equal(a.system.karma.good, 97);
      assert.equal(a.getFlag("sr2e", "familiar").allyUuid, "Actor.ally0");
      assert.equal(await a.advanceInitiation(null, { ordeal: "familiar" }), true);
      assert.equal(a.system.initiateGrade, 2);
      assert.equal(a.getFlag("sr2e", "familiar").usedForGrade, 2);
      // Meditation: a failure postpones without spending Karma; a success goes ahead.
      const karma = a.system.karma.good;
      faces.push(...Array(6).fill(1));
      assert.equal(await a.advanceInitiation(null, { ordeal: "meditation" }), false);
      assert.equal(a.system.karma.good, karma);
      assert.match(chat.at(-1).content, /the initiation waits/);
      faces.push(6, 1, 1, 1, 1, 1, 1);                         // TN 4 + 3: a 6 that rolls a 1 makes 7, one success
      assert.equal(await a.advanceInitiation(null, { ordeal: "meditation" }), true);
      assert.equal(a.system.initiateGrade, 3);
      // Oath: becomes a geas.
      assert.equal(await a.advanceInitiation(null, { ordeal: "oath", geas: "Guard the grove" }), true);
      assert.match(a.system.geasa.at(-1).text, /Oath: Guard the grove/);
      // Deed: a player's initiation waits for the GM.
      g.game.user.isGM = false;
      assert.equal(await a.advanceInitiation("shielding", { ordeal: "deed" }), false);
      assert.equal(a.getFlag("sr2e", "pendingInitiation").grade, 5);
      assert.match(chat.at(-1).content, /The deed is done \(GM\)/);
      g.game.user.isGM = true;
      const p = a.getFlag("sr2e", "pendingInitiation");
      assert.equal(await a.advanceInitiation(p.technique, { ordeal: p.ordeal, deedDone: true }), true);
      assert.equal(a.system.metamagic.shielding, true);
      assert.equal(a.getFlag("sr2e", "pendingInitiation"), undefined);
    } finally { delete g.Actor.create; }
  });

  test("review fixes: a Burns wall with rating 0 burns; a possessed body uses skills it lacks; radiation never downgrades; care changes are charged", async () => {
    chat.length = 0;
    useCanvas();
    (RULES.FIRE as any).draw = false;
    const prevInt = RULES.FIRE.intensity;
    (RULES.FIRE as any).intensity = "burning";
    try {
      const wall = doc({ id: "w0", c: [100, -500, 100, 500], move: 20, sight: 20, light: 20, sound: 20, flags: { sr2e: { burns: true, barrierRating: 0 } } });
      walls.push(wall);
      g.canvas.walls.placeables = walls.map((d) => ({ document: d }));
      await SR2Actor.startFire({ x: 0, y: 0 }, { source: "test" });
      await SR2Actor.fireTicks({ round: null, worldTime: 0 }, 1);
      assert.equal(wall.flags.sr2e.barrierRating, RULES.FIRE.walls.defaultRating - 1);
    } finally { (RULES.FIRE as any).draw = true; (RULES.FIRE as any).intensity = prevInt; }
    const body = who({ name: "Guard" });
    await body.setFlag("sr2e", "possessedBy", { uuid: "x", name: "Mage", attributes: {}, skills: [{ name: "Athletics", rating: 6, attribute: "body", kind: "active", specialization: "", specializationRating: 0, concentration: "", concentrationRating: 0 }] });
    assert.equal(body.findSkill("Athletics").system.rating, 6);
    const r = who({ name: "Rad2", diseases: [{ name: "Severe radiation sickness", power: 8, level: "S", damageType: "physical", intervalHours: 24, nextAt: 0, recovered: 0, needed: 3, pending: false, treated: false, contagious: "", infectedAt: 0, incubationHours: 0, source: "radiation" }], radiation: { dose: 20, at: 0 } });
    await r.addRadiation(3, 2);
    assert.equal(r.system.radiation.dose, 26);
    assert.equal(r.system.diseases[0].name, "Severe radiation sickness");
    // Care that was never paid is never refunded.
    const unpaid = who({ name: "Unpaid", nuyen: 0, recovering: [{ itemId: "x", name: "Ware", until: 4 * 86400, care: "intensive", factor: 0.75, paid: false }] });
    assert.equal(await unpaid.setRecoveryCare("x", "none"), 8);
    assert.equal(unpaid.system.nuyen, 0);
    const pt = who({ name: "Pt", nuyen: 10000, recovering: [{ itemId: "x", name: "Ware", until: 4 * 86400, care: "none", factor: 1.5 }] });
    assert.equal(await pt.setRecoveryCare("x", "intensive"), 2);
    assert.equal(pt.system.nuyen, 10000 - 2 * RULES.HEALTH.careCosts.intensive!);
    assert.equal(pt.system.recovering[0].paid, true);
    // 2 days of intensive (×0.75) become 3 in hospital (×1): the intensive days are refunded, 3 hospital days charged.
    assert.equal(await pt.setRecoveryCare("x", "hospital"), 3);
    assert.equal(pt.system.nuyen, 10000 - 3 * RULES.HEALTH.careCosts.hospital!);
    const poor = who({ name: "Poor", nuyen: 0, recovering: [{ itemId: "x", name: "Ware", until: 4 * 86400, care: "none", factor: 1.5 }] });
    assert.equal(await poor.setRecoveryCare("x", "intensive"), null);
    assert.equal(poor.system.recovering[0].until, 4 * 86400);
  });

  test("timers also run on unlinked tokens' own actors", async () => {
    const synth = who({ name: "Unlinked" });
    actors.splice(actors.indexOf(synth), 1);
    scene.tokens = [{ actorLink: false, actor: synth }, { actorLink: true, actor: actors[0] }];
    try {
      const list = SR2Actor.tickActors();
      assert.ok(list.includes(synth));
      assert.equal(list.filter((x: any) => x === actors[0]).length, 1);
    } finally { delete scene.tokens; }
  });

  test("reflecting bounces a critter power back; the design keeps exclusive and fetish", async () => {
    chat.length = 0;
    const a = mage({ metamagic: { reflecting: true }, initiateGrade: 1 });
    const spirit = who({ name: "Spirit", type: "spirit" });
    faces.push(5, 5, 5, 5, 5, 5);                              // Willpower 6 vs 4: 6 successes, the power had 2
    await a.resistSpell({ casterUuid: spirit.uuid, targetUuid: a.uuid, spellName: "Fear", force: 4, resistAttribute: "willpower", level: "M", damageType: "stun", casterSuccesses: 2, noun: "power", resistPool: "none", effectOnly: true });
    const card = chat.at(-1);
    assert.match(card.content, /Reflected!/);
    assert.match(card.content, /Resist power/);
    assert.equal(card.flags.sr2e.spells[0].noun, "power");
    assert.equal(card.flags.sr2e.spells[0].casterSuccesses, 4);
    assert.equal(card.flags.sr2e.spells[0].reflected, true);
    const prev = RULES.OCCULT.metamagic.reflecting.powers;
    try {
      (RULES.OCCULT.metamagic.reflecting as any).powers = false;
      faces.push(5, 5, 5, 5, 5, 5);
      await a.resistSpell({ casterUuid: spirit.uuid, targetUuid: a.uuid, spellName: "Fear", force: 4, resistAttribute: "willpower", level: "M", damageType: "stun", casterSuccesses: 2, noun: "power", resistPool: "none", effectOnly: true });
      assert.doesNotMatch(chat.at(-1).content, /Reflected!/);
    } finally { (RULES.OCCULT.metamagic.reflecting as any).powers = prev; }
    faces.push(5, 5, 5, 5);
    await a.designSpell({ name: "Hex", force: 3, category: "combat", spellType: "mana", exclusive: true, fetish: true, restricted: true });
    const d = chat.at(-1).flags.sr2e.formula;
    assert.equal(d.system.exclusive, true);
    assert.equal(d.system.fetish, true);
    assert.equal(d.system.drainModifier, -1);
  });
});

describe("v0.49.0 street, Matrix, rigging and security leftovers", () => {
  // v0.92.3: these pin the v0.92.2 Matrix rules (the book's defaults: v0923-matrix tests).
  let undo922 = () => {}; before(() => { undo922 = matrix922(); }); after(() => undo922());
  let HostDataModel: any, VehicleDataModel: any, SiteDataModel: any, R: any;
  const P = { body: 4, quickness: 5, strength: 3, charisma: 4, intelligence: 6, willpower: 5 };
  const withGet = (list: any[]) => Object.assign(list, { get(id: string) { return list.find((i: any) => i.id === id); } });
  const run = (extra: any = {}) => ({ jackedIn: false, hostUuid: "", monitor: 0, sim: "cold", connection: "jackpoint", crippled: { bod: 0, evasion: 0, masking: 0, sensors: 0 }, passed: [],
    trace: { active: false, icUuid: "", icName: "", mode: "dump", rating: 0, hostUuid: "", round: -1, worldTime: -1 }, psyche: [],
    transit: { hostUuid: "", hops: 0, round: -1, worldTime: -1 }, relayKm: 0, numbers: [], channels: { access: 0, control: 0, index: 0, files: 0, slave: 0 }, jammed: { active: false, by: "", rating: 0 }, ...extra });
  const person = (items: any[] = [], extra: any = {}) => {
    const a = makeActor(P, { poolSpent: { combat: 0, spell: 0, hacking: 0, control: 0 }, karma: { good: 0, pool: 0, poolSpent: 0, career: 0 }, drugs: [], nuyen: 0, ledger: [], contacts: [], qualities: [],
      lifestyle: { level: "low", paidUntil: -1 }, matrix: run(extra.matrix), rigging: { vehicleUuid: "", jumpedIn: false, subscribed: [] }, sustaining: [], ...extra, ...(extra.matrix ? { matrix: run(extra.matrix) } : {}) });
    a.name = extra.name ?? "Runner"; a.type = extra.type ?? "character"; (a as any).id = `id-${a.uuid}`;
    const item = (it: any) => ({ ...it, system: { ...it.system }, async update(d: any) { for (const [k, v] of Object.entries(d)) setPath(this, k, v); a.system.prepareDerivedData(); }, async delete() { const i = a.items.indexOf(this); if (i >= 0) a.items.splice(i, 1); } });
    a.items = withGet(items.map(item));
    a.createEmbeddedDocuments = async (_t: string, docs: any[]) => { const made = docs.map((d, n) => item({ id: `new${a.items.length + n}`, ...d })); a.items.push(...made); a.system.prepareDerivedData(); return made; };
    a.updateEmbeddedDocuments = async (_t: string, ups: any[]) => { for (const u of ups) { const it = a.items.find((i: any) => i.id === u._id); if (it) Object.assign(it.system, u.system); } a.system.prepareDerivedData(); };
    (a as any).statuses = new Set<string>();
    a.system.parent = a; a.system.prepareDerivedData();
    uuidRegistry.set(a.uuid, a);
    return a;
  };
  const skill = (id: string, name: string, rating: number, attribute = "quickness") => ({ id, type: "skill", name, system: { rating, attribute } });
  const deck = (extra: any = {}) => ({ id: "deck", type: "cyberdeck", name: "Deck", system: { active: true, mpcp: 6, bod: 4, evasion: 5, masking: 5, sensors: 4, hardening: 2, responseIncrease: 1, activeMemory: 900, storageMemory: 500, ioSpeed: 100, signal: 0, tortoise: false, living: false, damage: { mpcp: 0, bod: 0, evasion: 0, masking: 0, sensors: 0 }, files: [], ...extra } });
  const host = (name = "Host") => {
    const h = new SR2Actor();
    const sys = Object.create(HostDataModel.prototype);
    Object.assign(sys, { gridKind: "host", parentUuid: "", ltgNumber: "", securityCode: "red", securityValue: 6, subsystems: { access: 4, control: 4, index: 4, files: 4, slave: 4 }, tally: 0, alert: "none", sheaf: [], files: [], securityDeckers: [], spotted: [], smoke: { rating: 0, tn: 0, by: "", round: -1, worldTime: -1 } });
    sys.prepareDerivedData();
    Object.assign(h, { type: "host", name, uuid: `Actor.v49h${(host as any).n = ((host as any).n ?? 0) + 1}`, system: sys });
    uuidRegistry.set(h.uuid, h);
    return h;
  };
  const vehicle = (extra: any = {}, items: any[] = []) => {
    const v = new SR2Actor();
    const sys = Object.create(VehicleDataModel.prototype);
    Object.assign(sys, { category: "car", skill: "", drone: false, handling: 4, handlingOffroad: 0, speed: 90, accel: 10, body: 4, armor: 3, signature: 2, autonav: 0, pilot: 0, sensor: 3, ecm: 0, eccm: 0, ecd: 0,
      condition: 0, currentSpeed: 0, offroad: false, controllerUuid: "", controlMode: "autopilot", occupants: [], locks: [], chase: { quarryUuid: "", metres: 0 },
      load: 0, cargoFactor: 0, sensorMode: "active", autosofts: { maneuver: 0, targeting: 0, clearsight: 0 }, mods: [], jammed: { active: false, by: "", rating: 0 }, ...extra });
    const item = (it: any) => ({ ...it, system: { ...it.system }, async update(d: any) { for (const [k, x] of Object.entries(d)) setPath(this, k, x); } });
    Object.assign(v, { type: "vehicle", name: extra.name ?? "Van", uuid: `Actor.v49v${(vehicle as any).n = ((vehicle as any).n ?? 0) + 1}`, system: sys, items: withGet(items.map(item)) });
    sys.parent = v; sys.prepareDerivedData();
    uuidRegistry.set(v.uuid, v);
    return v;
  };
  const site = (devices: any[], extra: any = {}) => {
    const s = new SR2Actor();
    const sys = Object.create(SiteDataModel.prototype);
    Object.assign(sys, { devices, tally: 0, alert: "none", steps: [], response: { round: -1, worldTime: -1, arrived: false, force: "" }, riggerUuid: "", slaved: [], hostUuid: "", guards: [], ...extra });
    sys.prepareDerivedData();
    Object.assign(s, { type: "site", name: "Lab", uuid: `Actor.v49s${(site as any).n = ((site as any).n ?? 0) + 1}`, system: sys, items: withGet([]) });
    uuidRegistry.set(s.uuid, s);
    return s;
  };
  const dev = (id: string, extra: any = {}) => ({ id, name: id, kind: "camera", rating: 4, tokenUuid: "", sceneId: "", wallId: "", active: true, bypassed: false, scanKind: "", sense: "visual", tamper: 0, identifies: false, notes: "", ...extra });
  const noDetect = () => faces.push(1, 1, 1, 1, 1, 1);
  before(async () => {
    ({ HostDataModel, VehicleDataModel, SiteDataModel } = await import("../models/index.ts"));
    R = await import("../rules/index.ts");
    g.fromUuidSync = (u: string) => uuidRegistry.get(u) ?? null;
    g.game.users = [{ id: "gm1", isGM: true }];
    g.game.user = { isGM: true, id: "gm1" };
    g.game.time = { worldTime: 0 };
    delete g.game.combat;
  });
  afterEach(() => { delete g.game.actors; delete g.game.scenes; g.game.time = { worldTime: 0 }; delete g.canvas; faces.length = 0; });

  test("Fill the sheet with listed skills (re-rating one already there) and gear from the templates", async () => {
    chat.length = 0;
    const a = person([{ id: "s1", type: "skill", name: "Firearms", system: { rating: 2, attribute: "quickness", kind: "active" } }]);
    const gear = R.parseGearList("Heavy pistol, Medkit ×2, Fake SIN ¥5000", RULES.ITEM_TEMPLATES);
    const skills = R.parseSkillList("Firearms 5, Stealth 3 (Urban 5)").skills;
    const r = await a.applyBuild({ priorities: { resources: "C" }, magic: "none", gearCost: gear.total, skills, gear: gear.items });
    assert.equal(r.skills, 2);
    assert.equal(r.gear, 3);
    assert.equal(a.items.find((i: any) => i.name === "Firearms").system.rating, 5);
    const st = a.items.find((i: any) => i.name === "Stealth");
    assert.deepEqual([st.system.rating, st.system.specialization, st.system.specializationRating, st.system.attribute], [3, "Urban", 5, "quickness"]);
    assert.equal(a.items.find((i: any) => i.name === "Heavy pistol").type, "weapon");
    assert.equal(a.items.find((i: any) => i.name === "Medkit").system.quantity, 2);
    assert.equal(a.items.find((i: any) => i.name === "Fake SIN").system.cost, 5000);
    // v0.58.0: less the first Low lifestyle month (¥1,000).
    assert.equal(a.system.nuyen, 90000 - 450 - 400 - 5000 - 1000);
    assert.match(chat.at(-1).content, /2 skills, 3 pieces of gear/);
  });

  test("an edge gained and a flaw bought off with Karma; too little Karma is refused", async () => {
    chat.length = 0; warnings.length = 0;
    const a = person([], { karma: { good: 10, pool: 0, poolSpent: 0, career: 10 }, qualities: [{ id: "f", name: "Bad rep", kind: "flaw", points: 3, target: "", tn: 0, notes: "" }] });
    assert.equal(await a.gainEdge({ name: "Lucky", points: 2 }), true);
    assert.equal(a.system.karma.good, 6);
    assert.equal(a.system.ledger.at(-1).amount, -4);
    assert.equal(await a.buyOffFlaw("f"), true);
    assert.equal(a.system.karma.good, 0);
    assert.deepEqual(a.system.qualities.map((q: any) => q.name), ["Lucky"]);
    assert.equal(await a.gainEdge({ name: "Tough", points: 1 }), false);
    assert.match(warnings.at(-1) ?? "", /costs 2/);
  });

  test("v0.82.1 (owner): edges and flaws by hand: direct for the GM; after creation with the queue on, a request to the GM", async () => {
    const a = person([], { karma: { good: 0, pool: 0, poolSpent: 0, career: 0 }, qualities: [{ id: "f", name: "Bad rep", kind: "flaw", points: 3, target: "", tn: 0, notes: "" }] });
    assert.equal(await a.addQuality({ name: "Lucky", kind: "edge", points: 99, tn: 50 }), true);
    const lucky = a.system.qualities.find((q: any) => q.name === "Lucky");
    assert.deepEqual([lucky.points, lucky.tn], [20, 20], "bounded");
    assert.equal(await a.editQuality(lucky.id, { name: "Very lucky", kind: "edge", points: 2 }), true);
    assert.equal(a.system.qualities.find((q: any) => q.id === lucky.id).name, "Very lucky");
    assert.equal(await a.removeQuality("f"), true);
    assert.deepEqual(a.system.qualities.map((q: any) => q.name), ["Very lucky"]);
    const prevUser = g.game.user, prevSettings = g.game.settings;
    g.game.user = { isGM: false, id: "p1", name: "Corvo" };
    g.game.settings = { get: (_s: string, k: string) => k === "approvalQueue" };
    g.foundry.utils ??= {};
    const prevRandom = g.foundry.utils.randomID; let n = 0;
    g.foundry.utils.randomID = () => `rq${++n}`;
    try {
      const before = JSON.stringify(a.system.qualities);
      assert.equal(await a.addQuality({ name: "Free edge", kind: "edge", points: 3 }), false);
      assert.equal(await a.removeQuality(lucky.id), false);
      assert.equal(await a.editQuality(lucky.id, { name: "Very lucky", kind: "edge", points: 6 }), false);
      assert.equal(JSON.stringify(a.system.qualities), before, "nothing changed until the GM approves");
      const reqs = Object.values(a.flags?.sr2e?.requests ?? {}) as any[];
      assert.deepEqual(reqs.map((r) => r.data.method).sort(), ["addQuality", "editQuality", "removeQuality"]);
      assert.ok(reqs.every((r) => r.kind === "quality" && !r.karma && !r.nuyen));
    } finally { g.game.user = prevUser; g.game.settings = prevSettings; g.foundry.utils.randomID = prevRandom; }
  });

  test("legwork: the contact digs with their own dice (the better counts) and a favour asked of one who owes none is a debt", async () => {
    chat.length = 0;
    const a = person([skill("et", "Etiquette", 3, "charisma")], { nuyen: 1000, contacts: [{ id: "c", name: "Fixer", level: 1, role: "", notes: "", loyalty: 2, skills: "", fee: 200, dice: 3, favours: 0 }] });
    faces.push(5, 5, 1, 1, 1);                                         // Etiquette 3 + favour 2 vs TN 4: 2
    faces.push(5, 5, 5);                                               // the contact's 3 dice: 3
    const r = await a.legwork("c", { favour: true, contactDigs: true });
    assert.equal(r.successes, 3);
    assert.equal(a.system.nuyen, 1000);                                // the favour waived the fee
    assert.equal(a.system.contacts[0].favours, -1);
    assert.match(chat.at(-1).content, /Fixer digs \(3 dice\)/);
    assert.match(chat.at(-1).content, /now owes Fixer a favour/);
    assert.equal(await a.adjustFavours("c", 2), 1);
  });

  test("hot goods: a fence pays less, refuses the hottest, Heat cools with time, and a sale may be traced", async () => {
    chat.length = 0; warnings.length = 0;
    const a = person([{ id: "w", type: "weapon", name: "Hot gun", system: { cost: 1000, streetIndex: 1, heat: 2, heatAt: 0 } }]);
    faces.push(1, 1, 1, 1, 1, 1, 1, 1);                                // net 0
    assert.equal(await a.fence("w"), 200);                             // 30% − 2 × 5%
    assert.equal(chat.at(-1).flags.sr2e.sell.heat, 2);
    g.game.time.worldTime = 15 * 86400;                                // two weeks: cooled by 2
    faces.push(1, 1, 1, 1, 1, 1, 1, 1);
    assert.equal(await a.fence("w"), 300);
    a.items.get("w").system.heat = 9; a.items.get("w").system.heatAt = 15 * 86400;
    assert.equal(await a.fence("w"), null);
    assert.match(warnings.at(-1) ?? "", /too hot/);
    faces.push(5, 1);                                                  // Heat 2 vs 4: 1 success
    assert.equal(await a.sellItem("w", 200, 2), true);
    const trace = chat.find((m: any) => /Word gets around/.test(m.content));
    assert.ok(trace && trace.whisper?.includes("gm1"));
    assert.equal(a.system.nuyen, 200);
  });

  test("a mixed group tests morale once on its highest standing rating and breaks together; rallying clears it", async () => {
    chat.length = 0;
    const scene: any = { tokens: [] };
    const npc = (name: string, pr: number, extra: any = {}) => {
      const a = person([], { name, type: "npc", professionalRating: pr, ...extra });
      const t: any = { actor: a, parent: scene, actorLink: false, flags: { sr2e: { moraleGroup: "M1" } }, getFlag(s: string, k: string) { return this.flags[s]?.[k]; }, async setFlag(s: string, k: string, v: any) { (this.flags[s] ??= {})[k] = v; }, async unsetFlag(s: string, k: string) { delete this.flags[s]?.[k]; } };
      (a as any).token = t; scene.tokens.push(t);
      return a;
    };
    const boss = npc("Boss", 2);
    npc("Veteran", 5, { monitor: { physical: 14, stun: 0 } });         // dead: not counted for the rating
    const ganger = npc("Ganger", 3);
    const g0 = boss.moraleGroup();
    assert.deepEqual([g0.actors.length, g0.standing.length, g0.down, g0.mixed], [3, 2, 1, true]);
    faces.push(1, 1, 1);                                               // PR 3 vs 4 + 1 down
    assert.deepEqual(await boss.moraleTest(), { broken: true });
    assert.match(chat.at(-1).content, /group of 3 \(highest Professional Rating 3, 1 down/);
    assert.ok(boss.isBroken() && ganger.isBroken());
    const leader = person([skill("le", "Leadership", 4, "charisma")], { name: "Lt" });
    faces.push(5, 5, 1, 1);
    assert.equal(await leader.rally(ganger.uuid), true);
    assert.ok(!boss.isBroken() && !ganger.isBroken());
  });

  test("lifestyle: overdue past the grace days, the GM is asked once; moving down; connections when finding gear", async () => {
    chat.length = 0;
    const a = person([{ id: "x", type: "gear", name: "Widget", system: { cost: 100, availability: "4/12 hrs", streetIndex: 1 } }], { lifestyle: { level: "middle", paidUntil: 0 } });
    (a as any).hasPlayerOwner = true;
    g.game.actors = [a];
    g.game.time.worldTime = 10 * 86400;
    await SR2Actor.timedEffects({ worldTime: 10 * 86400 });
    const card = chat.find((m: any) => m.flags?.sr2e?.evict);
    assert.ok(card);
    assert.match(card.content, /10 days overdue/);
    const n = chat.length;
    await SR2Actor.timedEffects({ worldTime: 10 * 86400 + 60 });
    assert.equal(chat.filter((m: any) => m.flags?.sr2e?.evict).length, 1);
    assert.equal(chat.length, n);
    assert.equal(await a.moveLifestyleDown(), "low");
    assert.equal(a.system.lifestyle.level, "low");
    a.system.lifestyle.level = "street";
    faces.push(1, 1, 1, 1);
    await a.findItem("x");
    assert.equal(chat.at(-1).flags?.sr2e?.buy, undefined);             // not found (v0.71.0: a contest card, no Buy)
    assert.match(JSON.stringify(chat.at(-1)), /Street lifestyle/);
  });

  test("otaku: channels and complex forms for Karma; a channel works as a utility on its subsystem", async () => {
    const old = RULES.MATRIX.otaku.enabled;
    (RULES.MATRIX.otaku as any).enabled = true;
    try {
      warnings.length = 0;
      const h = host();
      const a = person([skill("sk", "Computer", 5, "intelligence"), deck({ living: true })], { name: "Otaku", karma: { good: 20, pool: 0, poolSpent: 0, career: 20 }, matrix: {} });
      assert.equal(a.system.derived.matrix.mpcp, 5);                   // (6 + 5 + 4) ÷ 3
      assert.equal(await a.raiseChannel("access"), true);
      assert.equal(a.system.karma.good, 18);
      a.system.matrix.channels.access = 5;
      assert.equal(await a.raiseChannel("access"), false);
      assert.match(warnings.at(-1) ?? "", /above MPCP 5/);
      a.system.matrix.channels.access = 4;
      const form = await a.learnComplexForm({ kind: "sleaze", rating: 3 });
      assert.ok(form.system.complexForm && form.system.loaded);
      assert.equal(a.system.karma.good, 15);
      assert.equal(a.system.derived.matrix.memory.used, 0);
      assert.equal(await a.learnComplexForm({ kind: "sleaze", rating: 6 }), null);
      await a.jackIn(h.uuid);
      noDetect(); faces.push(1, 1, 1, 1, 1, 1, 1);
      const r = await a.systemTest("access");
      assert.ok(r.modifiers.some((m: any) => m.label === "Access channel 4" && m.value === -4));
    } finally { (RULES.MATRIX.otaku as any).enabled = old; }
  });

  test("writing with program options and a programming suite; building memory adds Mp", async () => {
    chat.length = 0;
    const a = person([skill("sk", "Computer", 5, "intelligence"), deck(), { id: "su", type: "gear", name: "Suite", system: { suite: 3, quantity: 1 } }], { name: "Coder", nuyen: 20000 });
    faces.push(5, 5, 1, 1, 1, 1, 1, 1);                                // Computer 5 + suite 3 vs TN 5: 2
    const r = await a.writeProgram({ kind: "browse", rating: 3, options: ["squeeze"] });
    assert.equal(r.totalDice, 8);
    assert.equal(r.targetNumber, 5);
    assert.match(chat.at(-1).content, /Write Browse 3 \(5 Mp; Squeeze \(compressed\), TN = rating 3 → 5\).*suite \+3/s);
    assert.match(chat.at(-1).content, /<strong>4 days<\/strong> of work \(8 ÷ 2\)/);
    assert.deepEqual(a.items.find((i: any) => i.name === "Browse 3").system.options, ["squeeze"]);
    faces.push(5, 5, 1, 1, 1, 1, 1, 1);
    await a.buildDeckPart({ deckId: "deck", part: "activeMemory", rating: 200 });
    assert.equal(a.items.get("deck").system.activeMemory, 1100);
    assert.equal(a.system.nuyen, 16000);
    assert.match(chat.at(-1).content, /Active memory \(Mp\) \+200 \(now 1100\)/);
  });

  test("jamming a decker's wireless link dumps them and keeps them out until it clears", async () => {
    chat.length = 0; warnings.length = 0;
    const h = host();
    const d = person([skill("sk", "Computer", 5, "intelligence"), deck({ signal: 3 })], { name: "Mobile", matrix: { connection: "cellular" } });
    const j = person([{ id: "jm", type: "gear", name: "Jammer", system: { jammer: 4, quantity: 1 } }], { name: "Jammer guy" });
    assert.equal(await d.jackIn(h.uuid), true);
    faces.push(5, 1, 1, 1);                                            // jammer 4 vs signal 3
    assert.deepEqual(await j.jamTest(d.uuid), { jammed: true });
    assert.equal(d.system.matrix.jackedIn, false);
    assert.equal(d.system.matrix.jammed.active, true);
    assert.equal(chat.at(-1).flags.sr2e.dumpShockFor, d.uuid);
    assert.equal(await d.jackIn(h.uuid), false);
    assert.match(warnings.at(-1) ?? "", /jammed by Jammer guy/);
    await d.unjamLink();
    assert.equal(await d.jackIn(h.uuid), true);
    const wired = person([deck()], { name: "Wired" });
    assert.equal(await j.jamTest(wired.uuid), null);
    assert.match(warnings.at(-1) ?? "", /no wireless link/);
  });

  test("a turret turns to the target: TN per traverse step beyond the first, its facing saved; refused when that is the rule", async () => {
    const gunner = person([], { name: "Gunner" });
    const v = vehicle({ occupants: [gunner.uuid] }, [{ id: "mg", type: "weapon", name: "MG", system: { mount: "turret", turret: { facing: 0, traverse: 45, limit: 0 }, modes: "FA", skill: "Gunnery" } }]);
    const saved = SR2Actor.turretAim;
    let got: any = null;
    (gunner as any).attackWith = async (_w: any, o: any) => { got = o; return { ok: true }; };
    try {
      SR2Actor.turretAim = (_v: any, w: any) => R.turretCheck(w.system.turret, 180);
      await gunner.fireMounted(v, v.items.get("mg"), { targetUuid: "x" });
      assert.ok(got.modifiers.some((m: any) => /Turret traverse \(180°\)/.test(m.label) && m.value === 3 * RULES.VEHICLES.turrets.tnPerStep));
      assert.match(got.note, /turret 180°/);
      assert.equal(v.items.get("mg").system.turret.facing, 180);
      const prev = RULES.VEHICLES.turrets.overTraverse;
      (RULES.VEHICLES.turrets as any).overTraverse = "block";
      try {
        v.items.get("mg").system.turret.facing = 0;
        got = null;
        assert.equal(await gunner.fireMounted(v, v.items.get("mg"), { targetUuid: "x" }), null);
        assert.equal(got, null);
        await gunner.fireMounted(v, v.items.get("mg"), { targetUuid: "x", ignoreTurret: true });
        assert.ok(got);
      } finally { (RULES.VEHICLES.turrets as any).overTraverse = prev; }
    } finally { SR2Actor.turretAim = saved; }
  });

  test("installing a modification with a mechanic's test: in once on success (payer pays); a disaster damages the vehicle", async () => {
    chat.length = 0;
    const mech = person([skill("br", "Car B/R", 4, "intelligence")], { name: "Mech", nuyen: 10000 });
    const v = vehicle({ mods: [{ id: "m", name: "", kind: "armor", rating: 2, cost: 0, installed: false, stat: "", delta: 0 }, { id: "n", name: "", kind: "sensor", rating: 1, cost: 0, installed: false, stat: "", delta: 0 }] });
    faces.push(6, 6, 1, 1, 1, 1);                                      // TN 4 + 2: two 7s
    const r = await mech.installModTest(v, 0, { payer: mech });
    assert.equal(r.targetNumber, 6);
    assert.equal(v.system.armor, 5);
    assert.equal(v.system.mods[0].installed, true);
    assert.equal(mech.system.nuyen, 2000);                             // 1,000 × 2 × Body 4
    assert.match(chat.at(-1).content, /goes in<\/strong> after <strong>4 hours<\/strong>/);
    assert.equal(await mech.installModTest(v, 1, { payer: mech }), null);   // can't pay ¥2,500 for the parts
    faces.push(1, 1, 1, 1);
    const b = await mech.installModTest(v, 1, { payer: null });
    assert.ok(b.botch);
    assert.equal(v.system.mods[1].installed, false);
    assert.equal(v.system.condition, RULES.VEHICLES.install.botchBoxes);
    assert.equal(mech.system.nuyen, 2000);
  });

  test("cargo by volume: items' CF and people against the Cargo Factor", () => {
    const p = person([], { name: "Rider" });
    const v = vehicle({ cargoFactor: 10, occupants: [p.uuid] }, [{ id: "c", type: "gear", name: "Crate", system: { cf: 4, quantity: 2, weight: 0 } }]);
    assert.equal(v.system.derived.cargo.cf, 8 + RULES.VEHICLES.cargo.personCf);
    assert.equal(v.system.derived.cargo.overCf, true);
    assert.equal(v.system.derived.cargo.over, true);
  });

  test("security: the guards look (each who notices raises the tally), smashed devices, forced doors and masking spells", async (t) => {
    t.after(oldWay({"BOOK_V78.barriers.mode": "subtract"})); // v0.78.0: the old rule (a house rule)
    chat.length = 0;
    const g1 = person([skill("pe", "Perception", 3, "intelligence")], { name: "Guard 1", type: "npc" });
    const g2 = person([skill("pe", "Perception", 3, "intelligence")], { name: "Guard 2", type: "npc" });
    const sneak = person([skill("st", "Stealth", 3)], { name: "Sneak" });
    const s = site([dev("cam", { tamper: 3 }), dev("mic", { sense: "acoustic", kind: "sensor" }), dev("door", { kind: "maglock", sceneId: "sc1", wallId: "w1", tamper: 2 }), dev("id", { identifies: true })], { guards: [g1.uuid, g2.uuid] });
    faces.push(1, 1, 1);                                               // the sneak: 0
    faces.push(5, 5, 1);                                               // guard 1: 2, notices
    faces.push(1, 1, 1);                                               // guard 2: 0
    assert.deepEqual(await s.guardsWatch([sneak.uuid]), { noticed: 1 });
    assert.equal(s.system.tally, RULES.SECURITY.guards.tallyPerGuard);
    assert.equal(s.system.alert, "active");
    assert.equal(await s.forceDevice("cam", "force", "Sneak"), true);
    assert.equal(s.system.devices[0].active, false);
    assert.equal(s.system.tally, RULES.SECURITY.guards.tallyPerGuard + RULES.SECURITY.tamper.tally);
    // A door wall wired to the site, forced by damage.
    const before = s.system.tally;
    g.game.actors = [s];
    const wall: any = { id: "w1", parent: { id: "sc1" }, move: 20, sight: 20, light: 20, sound: 20, flags: { sr2e: { barrierRating: 4 } },
      getFlag(sc: string, k: string) { return this.flags[sc]?.[k]; }, async update(d: any) { for (const [k, x] of Object.entries(d)) if (!k.startsWith("flags.")) (this as any)[k] = x; else setPath(this, k, x); } };
    await SR2Actor.damageWall(wall, 10);
    assert.equal(s.system.tally, before + RULES.SECURITY.tamper.tally);
    // Silence cast on the sneak by someone else leaves an acoustic sensor deaf; a physical mask works only on a device that identifies.
    const mage = person([], { name: "Mage", sustaining: [{ spellName: "Silence", force: 4, category: "illusion", focusId: "", successes: 2, quickened: false, spiritUuid: "", until: -1, targetUuids: [sneak.uuid] }] });
    g.game.actors = [s, mage, sneak];
    assert.deepEqual(sneak.concealmentOf().map(({ kind, rating, source }: any) => ({ kind, rating, source })), [{ kind: "silence", rating: 2, source: "Silence (Mage)" }]);
    assert.deepEqual(await s.detect("mic", sneak.uuid), { detected: false });
    assert.match(chat.at(-1).content, /cannot pick up Sneak: Silence \(Mage\) 2/);
    assert.deepEqual(SR2Actor.concealmentAgainst("visual", [{ kind: "physicalMask", rating: 3 }], true).modifiers, [{ label: "Physical mask 3", value: 3 }]);
    assert.deepEqual(SR2Actor.concealmentAgainst("visual", [{ kind: "physicalMask", rating: 3 }], false).modifiers, []);
    assert.deepEqual(SR2Actor.concealmentAgainst("visual", [{ kind: "mask", rating: 3 }], true).modifiers, []);
  });

  test("review fixes: a guard counts once, a door trips once (when breached), smashing is once, a one-NPC group doesn't count its fallen twice", async (tc) => {
    tc.after(oldWay({"BOOK_V78.barriers.mode": "subtract"})); // v0.78.0: the old rule (a house rule)
    chat.length = 0;
    const g1 = person([skill("pe", "Perception", 3, "intelligence")], { name: "Guard A", type: "npc" });
    const i1 = person([skill("st", "Stealth", 1)], { name: "One" });
    const i2 = person([skill("st", "Stealth", 1)], { name: "Two" });
    const s = site([dev("cam", { tamper: 3 }), dev("door", { kind: "maglock", sceneId: "sc1", wallId: "w1", tamper: 2 })], { guards: [g1.uuid] });
    faces.push(1, 5, 5, 1);                                            // One: 0; the guard: 2
    faces.push(1, 5, 5, 1);                                            // Two: 0; the guard: 2
    assert.deepEqual(await s.guardsWatch([i1.uuid, i2.uuid, g1.uuid]), { noticed: 1 });
    assert.equal(s.system.tally, RULES.SECURITY.guards.tallyPerGuard);
    const t0 = s.system.tally;
    assert.equal(await s.forceDevice("cam", "force"), true);
    assert.equal(await s.forceDevice("cam", "force"), false);
    assert.equal(s.system.tally, t0 + RULES.SECURITY.tamper.tally);
    g.game.actors = [s];
    const wall: any = { id: "w1", parent: { id: "sc1" }, move: 20, sight: 20, light: 20, sound: 20, flags: { sr2e: { barrierRating: 8 } },
      getFlag(sc: string, k: string) { return this.flags[sc]?.[k]; }, async update(d: any) { for (const [k, x] of Object.entries(d)) setPath(this, k, x); } };
    const t1 = s.system.tally;
    await SR2Actor.damageWall(wall, 10);                               // chipped, not breached
    assert.equal(s.system.tally, t1);
    await SR2Actor.damageWall(wall, 20);                               // breached
    assert.equal(s.system.tally, t1 + RULES.SECURITY.tamper.tally);
    assert.equal(s.system.devices[1].bypassed, true);
    await SR2Actor.damageWall(wall, 20);
    assert.equal(s.system.tally, t1 + RULES.SECURITY.tamper.tally);
    // Two tokens of one grunt-group NPC, each with a grunt down, grouped by the GM: 2 casualties, not 3.
    const scene: any = { tokens: [] };
    const base = person([], { name: "Gangers", type: "npc", professionalRating: 2, grunts: { size: 3, down: 1 } });
    const twin = person([], { name: "Gangers", type: "npc", professionalRating: 2, grunts: { size: 3, down: 1 } });
    (twin as any).id = (base as any).id;
    for (const a of [base, twin]) { const t: any = { actor: a, parent: scene, flags: { sr2e: { moraleGroup: "M2" } }, getFlag(sc: string, k: string) { return this.flags[sc]?.[k]; } }; (a as any).token = t; scene.tokens.push(t); }
    faces.push(5, 5);
    await base.moraleTest();
    assert.match(chat.at(-1).content, /2 down/);
  });

  test("review fixes: the turret turns only when the shot is made, through the GM for a gunner who can't; players can't set Heat or Complex form", async () => {
    chat.length = 0;
    const gunner = person([], { name: "Gunner" });
    const v = vehicle({ occupants: [gunner.uuid] }, [{ id: "mg", type: "weapon", name: "MG", system: { mount: "turret", turret: { facing: 0, traverse: 90, limit: 0 }, modes: "FA" } }]);
    const w = v.items.get("mg");
    const saved = SR2Actor.turretAim;
    try {
      SR2Actor.turretAim = (_v: any, wp: any) => R.turretCheck(wp.system.turret, 90);
      (gunner as any).attackWith = async () => null;                  // refused (no ammo, say)
      await gunner.fireMounted(v, w, { targetUuid: "x" });
      assert.equal(w.system.turret.facing, 0);
      (gunner as any).attackWith = async () => ({ ok: true });
      w.isOwner = false;
      await gunner.fireMounted(v, w, { targetUuid: "x" });
      assert.equal(w.system.turret.facing, 0);
      assert.equal(chat.at(-1).flags.sr2e.turretFacing.facing, 90);
      assert.ok(chat.at(-1).whisper.includes("gm1"));
    } finally { SR2Actor.turretAim = saved; }
    const { SR2Item } = await import("../documents/index.ts");
    const it: any = new SR2Item();
    it.system = { heat: 0 };
    const ch: any = { system: { heat: 0, complexForm: true, quantity: 2 } };
    await it._preUpdate(ch, {}, { isGM: false });
    assert.deepEqual(ch.system, { quantity: 2 });
    const gmCh: any = { system: { heat: 4 } };
    g.game.time.worldTime = 500;
    await it._preUpdate(gmCh, {}, { isGM: true });
    assert.deepEqual(gmCh.system, { heat: 4, heatAt: 500 });
  });

  test("a sustained spell remembers its targets", async () => {
    const a = person([skill("so", "Sorcery", 4, "willpower")], { name: "Caster", magic: 6, tradition: "hermetic" });
    const t = person([], { name: "Friend" });
    a.items.push({ id: "sp", type: "spell", name: "Improved Invisibility", system: { category: "illusion", spellType: "physical", learnedForce: 4, targetNumber: 4, duration: "sustained", area: false, drainModifier: 0, drainLevel: "M" } });
    faces.push(5, 5, 1, 1);                                            // Sorcery 4: 2
    faces.push(5, 5, 5, 5, 5);                                         // drain
    await a.castSpell(a.items.get("sp"), { force: 4, targetUuid: t.uuid });
    assert.deepEqual(a.system.sustaining.at(-1)?.targetUuids, [t.uuid]);
    g.game.actors = [a, t];
    assert.deepEqual(t.concealmentOf().map((c: any) => c.kind), ["improvedInvisibility"]);
    assert.deepEqual(a.concealmentOf(), []);                           // cast on someone else
  });

  test("the stat-block importer adds cyberware and spells without counting their bonuses twice", async () => {
    const a = makeActor({ body: 3, quickness: 3, strength: 3, charisma: 3, intelligence: 3, willpower: 3 });
    a.items = [];
    a.system.parent = a;
    a.system.reactionBonus = 0; a.system.initiativeDiceBonus = 0; a.system.karma = { pool: 0 }; a.system.professionalRating = 0;
    a.system.prepareDerivedData();
    const r = await a.applyStatBlock(R.parseStatBlock(`B Q S C I W E M R Armor
4 5 4 2 3 3 4 - 7 0/0
Initiative: 7 + 2D6
Cyberware: Wired Reflexes 1
Spells: Manabolt 4`));
    assert.ok(a.items.some((i: any) => i.type === "cyberware" && /wired/i.test(i.name)));
    assert.ok(a.items.some((i: any) => i.type === "spell" && i.name === "Manabolt" && i.system.category === "combat"));
    assert.equal(a.system.derived.reaction, 7);
    assert.equal(a.system.reactionBonus, 1);                           // natural 4 + wired 2 = 6
    assert.equal(a.system.initiativeDiceBonus, 0);                     // 1 + wired 1
    assert.equal(a.system.essence, 6);                                 // 4 shown + 2 for the wires
    assert.equal(r.created, 2);
  });
});

describe("v0.50.0 target-number automation, switching modifiers off, the GM's retroactive TN change", () => {
  const P = { body: 4, quickness: 5, strength: 3, charisma: 4, intelligence: 6, willpower: 5 };
  const withGet = (list: any[]) => Object.assign(list, { get(id: string) { return list.find((i: any) => i.id === id); } });
  const person = (items: any[] = [], extra: any = {}) => {
    const a = makeActor(P, { poolSpent: { combat: 0, spell: 0, hacking: 0, control: 0 }, karma: { good: 0, pool: 0, poolSpent: 0, career: 0 }, drugs: [], nuyen: 0, ledger: [], contacts: [], qualities: [],
      rigging: { vehicleUuid: "", jumpedIn: false, subscribed: [] }, sustaining: [], metatype: "human", ...extra });
    a.name = extra.name ?? "Runner"; a.type = extra.type ?? "character"; (a as any).id = `id-${a.uuid}`;
    a.items = withGet(items.map((it: any) => ({ ...it, system: { ...it.system } })));
    (a as any).statuses = new Set<string>(extra.statuses ?? []);
    a.system.parent = a; a.system.prepareDerivedData();
    uuidRegistry.set(a.uuid, a);
    return a;
  };
  const skill = (id: string, name: string, rating: number, attribute = "quickness") => ({ id, type: "skill", name, system: { rating, attribute } });
  const sight = (o: any = {}) => () => ({ light: "normal", lit: false, los: true, smoke: { kind: "none", source: "", flames: false }, metres: null, weather: null, vision: {}, from: null, to: null, ...o });
  const created: any[] = [];
  let savedCreate: any;
  before(() => {
    g.fromUuidSync = (u: string) => uuidRegistry.get(u) ?? null;
    g.game.users = [{ id: "gm1", isGM: true }];
    g.game.user = { isGM: true, id: "gm1" };
    g.game.time = { worldTime: 0 };
    delete g.game.combat;
    savedCreate = g.ChatMessage.create;
    // Messages come back as documents here (the retarget marks the old one).
    g.ChatMessage.create = async (d: any) => { chat.push(d); const m = { id: `m${chat.length}`, ...d }; created.push(m); return m; };
  });
  afterEach(() => { g.ChatMessage.create = savedCreate; g.ChatMessage.create = async (d: any) => { chat.push(d); const m = { id: `m${chat.length}`, ...d }; created.push(m); return m; }; });
  // v0.81.1 (SEC1-1): a card has an author (here the GM's), as every Foundry message does: retarget re-runs it as them.
  const asMessage = (d: any) => ({ author: { id: "gm1", isGM: true }, ...d, getFlag: (s: string, k: string) => d.flags?.[s]?.[k], async update(u: any) { for (const [k, v] of Object.entries(u)) setPath(d, k.replace(/^flags\.sr2e\./, "flags.sr2e."), v); } });

  test("perception reads light and distance by itself; walls mean by ear; 'block' means no roll", async () => {
    chat.length = 0;
    const guard = person([skill("p", "Perception", 3)], { name: "Guard" });
    const ninja = person([skill("s", "Stealth", 4)], { name: "Ninja" });
    guard.sightTo = sight({ light: "minimal", metres: 50 });
    faces.push(1, 1, 1); faces.push(1, 1, 1, 1);
    await guard.perceive(ninja.uuid);
    assert.match(chat.at(-1).content, /Minimal light \+6/);                           // v0.79.0 docs check (was +4)
    assert.match(chat.at(-1).content, /Over 20 m \+1/);
    assert.match(chat.at(-1).content, /TN <strong>11<\/strong>/);                     // Stealth 4 + 6 + 1
    guard.sightTo = sight({ light: "darkness", los: false, metres: 1 });
    faces.push(1, 1, 1); faces.push(1, 1, 1, 1);
    await guard.perceive(ninja.uuid);
    assert.match(chat.at(-1).content, /walls in the way\): by ear \+4/);
    assert.doesNotMatch(chat.at(-1).content, /Total darkness/);
    const old = RULES.TN_AUTO.perception.noSight;
    (RULES.TN_AUTO.perception as any).noSight = "block";
    try {
      const n = faces.length;
      const r = await guard.perceive(ninja.uuid);
      assert.deepEqual(r, { noticed: false, net: 0 });
      assert.equal(faces.length, n);
      assert.match(chat.at(-1).content, /can't notice Ninja/);
    } finally { (RULES.TN_AUTO.perception as any).noSight = old; }
  });

  test("perception: the target's chameleon suit and the sneaker's own penalties count", async () => {
    chat.length = 0;
    const guard = person([skill("p", "Perception", 3)], { name: "Guard" });
    const ninja = person([skill("s", "Stealth", 4), { id: "suit", type: "gear", name: "Suit", system: { stealth: { kind: "chameleon", rating: 3, worn: true } } }], { name: "Ninja", monitor: { physical: 3, stun: 0 } });
    guard.sightTo = sight();
    faces.push(1, 1, 1); faces.push(1, 1, 1, 1);
    await guard.perceive(ninja.uuid);
    assert.match(chat.at(-1).content, /Suit 3 \+3/);
    assert.match(chat.at(-1).content, /Ninja: Stealth 4.*?Moderate wound|Ninja: Stealth 4[\s\S]*?\+2/);
  });

  test("sneaking: the observers' conditions go on the observers' TN, not the sneaker's", async () => {
    chat.length = 0;
    const ninja = person([skill("s", "Stealth", 4)], { name: "Ninja" });
    const guard = person([skill("p", "Perception", 3)], { name: "Guard" });
    guard.sightTo = sight();
    faces.push(1, 1, 1, 1); faces.push(1, 1, 1);
    await ninja.sneakPast([guard.uuid], { observerModifiers: [{ label: "Observers: Noisy surroundings", value: 2 }] });
    const c = chat.at(-1).content;
    assert.match(c, /Observers: Noisy surroundings \+2/);
    assert.match(c, /Guard: <span title="TN: Base 4; Observers: Noisy surroundings \+2">TN 6/);
    assert.match(c, /sharpest Intelligence 6\)[\s\S]*?TN <strong>6<\/strong>/);       // the sneaker's TN is the observer's Intelligence only
  });

  test("social: the listener's own penalties count, and metatype prejudice is added by itself (not twice)", async (t) => {
    t.after(oldWay({ 'DOCS_V79.socialInfluence.mode': 'opposed' })); // v0.79.0: the listener rolls only in the old opposed test
    chat.length = 0;
    const face = person([skill("n", "Negotiation", 4)], { name: "Face", metatype: "human" });
    const ork = person([skill("n2", "Negotiation", 3)], { name: "Boss", metatype: "ork", sustaining: [{ id: "x", spellName: "Armor", force: 3, successes: 2, focusId: "" }] });
    faces.push(1, 1, 1, 1); faces.push(1, 1, 1);
    await face.socialTest("Negotiation", ork.uuid);
    const c = chat.at(-1).content;
    assert.match(c, /Prejudice \(Ork vs Human\) \+2/);
    assert.match(c, /Boss: Negotiation[\s\S]*?Sustaining/);
    faces.push(1, 1, 1, 1); faces.push(1, 1, 1);
    await face.socialTest("Negotiation", ork.uuid, { modifiers: [{ label: "Attitude: Prejudiced", value: 2 }] });
    assert.doesNotMatch(chat.at(-1).content, /Prejudice \(Ork/);
  });

  test("a found-by-itself modifier switched off in the dialog is left out of the roll", async () => {
    chat.length = 0;
    const a = person([], { monitor: { physical: 3, stun: 0 } });
    faces.push(1, 1, 1, 1);
    const r = await a.rollAttribute("body", { targetNumber: 4 });
    assert.equal(r.targetNumber, 6);
    faces.push(1, 1, 1, 1);
    const label = a.woundModifiers()[0].label;
    const r2 = await a.rollAttribute("body", { targetNumber: 4, exclude: [label] });
    assert.equal(r2.targetNumber, 4);
  });

  test("Blinded counts once; a decker's Matrix test and a jumped-in rigger's drive skip the body's statuses", async () => {
    const old = RULES.STATUSES.blind.otherTn;
    (RULES.STATUSES.blind as any).otherTn = 3;
    try {
      const a = person([], { statuses: ["blind"] });
      a.hasStatus = (id: string) => a.statuses.has(id);
      assert.equal(a.previewModifiers({}).filter((m: any) => m.label === "Blinded").length, 1);
      assert.equal(a.previewModifiers({ modifiers: [{ label: "Blinded", value: 8 }] }).filter((m: any) => m.label === "Blinded").length, 1);
      assert.equal(a.previewModifiers({ matrix: true }).filter((m: any) => m.label === "Blinded").length, 0);
      a.isJumpedIn = () => true;
      assert.equal(a.previewModifiers({ vehicle: true }).filter((m: any) => m.label === "Blinded").length, 0);
      a.isJumpedIn = () => false;
      assert.equal(a.previewModifiers({ vehicle: true }).filter((m: any) => m.label === "Blinded").length, 1);
    } finally { (RULES.STATUSES.blind as any).otherTn = old; }
  });

  test("attacks: blind fire and a blinded attacker count once, and weather drops out", async () => {
    const a = person([skill("f", "Firearms", 5)], { statuses: ["blind"] });
    a.hasStatus = (id: string) => a.statuses.has(id);
    a.weatherMods = () => [{ label: "Fog", value: 2 }];
    const gun = { id: "g", type: "weapon", name: "Pistol", system: { skill: "Firearms", melee: false, damagePower: 6, damageLevel: "M", damageType: "physical", modes: "SA", ammo: 10, ammoMax: 10, range: { short: 5, medium: 15, long: 30, extreme: 50 } } };
    a.items.push(gun);
    const pv = a.previewAttack(a.items.get("g"), { range: "short", sight: { blindFire: { label: "Blind fire (no line of sight)", value: 8 } } });
    assert.equal(pv.modifiers.filter((m: any) => m.value === 8).length, 1);
    assert.ok(!pv.modifiers.some((m: any) => m.label === "Fog"));
    a.statuses.clear();
    const pv2 = a.previewAttack(a.items.get("g"), { range: "short", sight: { light: { label: "Partial light", value: 2 } } });
    assert.ok(pv2.modifiers.some((m: any) => m.label === "Fog"));
    assert.ok(pv2.modifiers.some((m: any) => m.label === "Partial light"));
  });

  test("searching: a frisk takes no weather; looking someone over takes the light and weather", async () => {
    chat.length = 0;
    const cop = person([skill("p", "Perception", 3)], { name: "Cop" });
    const runner = person([{ id: "h", type: "weapon", name: "Hold-out", system: { concealability: 6 } }], { name: "Runner" });
    cop.sightTo = sight({ light: "partial", weather: { label: "Rain", value: 1 } });
    cop.useAction = async () => true;
    faces.push(1, 1, 1);
    await cop.searchFor(runner.uuid, { method: "frisk" });
    assert.doesNotMatch(chat.at(-1).content, /Rain|Partial light/);
    faces.push(1, 1, 1);
    await cop.searchFor(runner.uuid, { method: "look" });
    assert.match(chat.at(-1).content, /Partial light \+2/);
    assert.match(chat.at(-1).content, /Rain \+1/);
  });

  test("the GM changes a test's TN afterwards: the same dice are scored again and the old card is replaced", async () => {
    chat.length = 0;
    const a = person([]);
    faces.push(6, 3, 5, 4, 1);                       // body 4 dice; the 6 re-rolls a 1: totals 7, 3, 5, 4
    await a.rollAttribute("body", { targetNumber: 5 });
    const card = asMessage(chat.at(-1));
    assert.equal(card.flags.sr2e.test.successes, 2);
    const n = faces.length;
    await SR2Actor.retarget(card, { baseTargetNumber: 4, modifiers: [{ label: "GM adjustment", value: -0 }] });
    assert.equal(faces.length, n);                   // no dice rolled
    const next = chat.at(-1);
    assert.equal(next.flags.sr2e.test.successes, 3);
    assert.equal(next.flags.sr2e.test.retargets, 1);
    assert.match(next.content, /TN changed by the GM \(5 → 4\)/);
    assert.equal(card.flags.sr2e.supersededBy, created.at(-1).id);
    await SR2Actor.retarget(asMessage(next), { baseTargetNumber: 4, modifiers: [{ label: "Partial light", value: 2 }] });
    assert.equal(chat.at(-1).flags.sr2e.test.successes, 1);   // only the 7 meets 6
    const saved = g.game.user;
    g.game.user = { isGM: false, id: "p1" };
    try { assert.equal(await SR2Actor.retarget(card, { baseTargetNumber: 2, modifiers: [] }), null); } finally { g.game.user = saved; }
  });

  test("the GM changes one side of a contest afterwards; the verdict follows", async () => {
    chat.length = 0;
    const guard = person([skill("p", "Perception", 3)], { name: "Guard" });
    const ninja = person([skill("s", "Stealth", 4)], { name: "Ninja" });
    guard.sightTo = sight();
    faces.push(4, 4, 1); faces.push(5, 1, 1, 1);     // guard 0 vs TN 4? Stealth 4 → TN 4: 2 successes; ninja vs Int 6: 0
    await guard.perceive(ninja.uuid);
    assert.match(chat.at(-1).content, /Guard notices Ninja/);
    const card = asMessage(chat.at(-1));
    await SR2Actor.retarget(card, { baseTargetNumber: 4, modifiers: [{ label: "GM adjustment", value: 2 }], side: 0 });
    assert.match(chat.at(-1).content, /Ninja goes unnoticed/);
    assert.match(chat.at(-1).content, /Guard's TN changed by the GM \(4 → 6\)/);
    assert.ok(card.flags.sr2e.supersededBy);
  });
});

describe("v0.50.0 TN automation: vehicles, the Matrix, magic, sensors", () => {
  let VehicleDataModel: any;
  const P = { body: 4, quickness: 5, strength: 3, charisma: 4, intelligence: 6, willpower: 5 };
  const withGet = (list: any[]) => Object.assign(list, { get(id: string) { return list.find((i: any) => i.id === id); } });
  const person = (items: any[] = [], extra: any = {}) => {
    const a = makeActor(P, { poolSpent: { combat: 0, spell: 0, hacking: 0, control: 0 }, karma: { good: 0, pool: 0, poolSpent: 0, career: 0 }, drugs: [], nuyen: 0, ledger: [], contacts: [], qualities: [],
      rigging: { vehicleUuid: "", jumpedIn: false, subscribed: [] }, sustaining: [], metatype: "human", ...extra });
    a.name = extra.name ?? "Runner"; a.type = extra.type ?? "character"; (a as any).id = `id-${a.uuid}`;
    a.items = withGet(items.map((it: any) => ({ ...it, system: { ...it.system } })));
    (a as any).statuses = new Set<string>(extra.statuses ?? []);
    a.system.parent = a; a.system.prepareDerivedData();
    uuidRegistry.set(a.uuid, a);
    return a;
  };
  const vehicle = (extra: any = {}) => {
    const v = new SR2Actor();
    const sys = Object.create(VehicleDataModel.prototype);
    Object.assign(sys, { category: "car", skill: "", drone: true, handling: 4, handlingOffroad: 0, speed: 90, accel: 10, body: 4, armor: 3, signature: 2, autonav: 0, pilot: 3, sensor: 3, ecm: 0, eccm: 0, ecd: 0,
      condition: 0, currentSpeed: 0, offroad: false, controllerUuid: "", controlMode: "autopilot", occupants: [], locks: [], chase: { quarryUuid: "", metres: 0 },
      load: 0, cargoFactor: 0, sensorMode: "active", sensorVision: { lowLight: false, thermographic: false }, autosofts: { maneuver: 0, targeting: 0, clearsight: 0 }, mods: [], jammed: { active: false, by: "", rating: 0 }, ...extra });
    Object.assign(v, { type: "vehicle", name: "Drone", uuid: `Actor.v50v${(vehicle as any).n = ((vehicle as any).n ?? 0) + 1}`, system: sys, items: withGet([]) });
    sys.parent = v; sys.prepareDerivedData();
    uuidRegistry.set(v.uuid, v);
    return v;
  };
  const weather = (id: string) => ({ viewed: { getFlag: (_s: string, k: string) => (k === "weather" ? id : undefined) } });
  before(async () => {
    ({ VehicleDataModel } = await import("../models/index.ts"));
    g.fromUuidSync = (u: string) => uuidRegistry.get(u) ?? null;
    g.game.users = [{ id: "gm1", isGM: true }];
    g.game.user = { isGM: true, id: "gm1" };
    g.game.time = { worldTime: 0 };
    delete g.game.combat;
  });
  afterEach(() => { faces.length = 0; delete g.game.scenes; });

  test("driving: over its Speed by itself; poor visibility and the weather count once (the worse)", async () => {
    const v = vehicle({ currentSpeed: 120 });
    const pv = v.previewDrive({});
    assert.ok(pv.modifiers.some((m: any) => m.label === "Above the vehicle's Speed"));
    g.game.scenes = weather("heavyFog");
    const fog = RULES.HEALTH.weather.find((w: any) => w.id === "heavyFog")!;
    const pv2 = v.previewDrive({ situational: ["poorVisibility"] });
    const vis = pv2.modifiers.filter((m: any) => /visibility|fog/i.test(m.label));
    assert.equal(vis.length, 1);
    assert.equal(vis[0].value, Math.max(fog.driving, 2));
    faces.push(1, 1, 1);
    const r = await v.driveTest({ situational: ["poorVisibility"], exclude: [vis[0].label] });
    assert.ok(!r.modifiers.some((m: any) => m.label === vis[0].label));
  });

  test("driving: the scene's terrain is used unless one is picked", async () => {
    const v = vehicle();
    g.game.scenes = { viewed: { getFlag: (_s: string, k: string) => (k === "terrain" ? "tight" : undefined) } };
    assert.ok(v.previewDrive({}).modifiers.some((m: any) => m.label === "Tight terrain"));
    assert.ok(!v.previewDrive({ terrain: "open" }).modifiers.some((m: any) => m.label === "Tight terrain"));
  });

  test("the Matrix: a decker's Hacking Pool test skips the body's Blinded and astral perception", async () => {
    const old = RULES.STATUSES.blind.otherTn;
    (RULES.STATUSES.blind as any).otherTn = 3;
    try {
      const d = person([], { statuses: ["blind"] });
      d.hasStatus = (id: string) => d.statuses.has(id);
      assert.ok(d.previewModifiers({}).some((m: any) => m.label === "Blinded"));
      assert.ok(!d.previewModifiers({ pool: "hacking" }).some((m: any) => m.label === "Blinded"));
    } finally { (RULES.STATUSES.blind as any).otherTn = old; }
  });

  test("IC roll free of their token's statuses", async () => {
    const old = RULES.STATUSES.blind.otherTn;
    (RULES.STATUSES.blind as any).otherTn = 3;
    try {
      const ic = person([], { statuses: ["blind"] });
      ic.type = "ic"; ic.hasStatus = () => true;
      assert.deepEqual(ic.previewModifiers({ modifiers: [{ label: "Smoke", value: 2 }] }), [{ label: "Smoke", value: 2 }]);
    } finally { (RULES.STATUSES.blind as any).otherTn = old; }
  });

  test("sensors: a chameleon suit hides a person from visual sensors; thermographic sensors see through it; damage counts", async () => {
    const v = vehicle({ condition: 3 });
    const sneak = person([{ id: "suit", type: "gear", name: "Suit", system: { stealth: { kind: "chameleon", rating: 3, worn: true } } }], { name: "Sneak" });
    const s1 = v.sensorSituation(sneak);
    assert.ok(s1.modifiers.some((m: any) => /Chameleon suit 3/.test(m.label) && m.value === 3));
    assert.ok(s1.modifiers.some((m: any) => m.label === "Vehicle damage"));
    v.system.sensorVision.thermographic = true;
    assert.ok(!v.sensorSituation(sneak).modifiers.some((m: any) => /Chameleon/.test(m.label)));
    const ghost = person([], { name: "Ghost" });
    ghost.concealmentOf = () => [{ kind: "improvedInvisibility", rating: 2, source: "Improved Invisibility" }];
    assert.equal(v.sensorSituation(ghost).blind, true);
  });

  test("magic: an elemental spell takes the light at its target; with the line-of-sight rule on, no sight means no spell", async () => {
    chat.length = 0;
    const mage = person([{ id: "so", type: "skill", name: "Sorcery", system: { rating: 4, attribute: "willpower" } }], { name: "Mage", magic: 6, tradition: "hermetic" });
    const t = person([], { name: "Guard" });
    mage.sightTo = () => ({ light: "minimal", lit: false, los: true, smoke: { kind: "none", source: "", flames: false }, metres: null, weather: null, vision: {}, from: null, to: null });
    const bolt = { id: "fb", type: "spell", name: "Flamethrower", system: { category: "manipulation", spellType: "physical", elemental: true, element: "fire", learnedForce: 4, targetNumber: 4, duration: "instant", area: false, drainModifier: 0, drainLevel: "M", damageLevel: "M", damageType: "physical" } };
    mage.items.push(bolt);
    faces.push(1, 1, 1, 1); faces.push(1, 1, 1, 1, 1);
    await mage.castSpell(mage.items.get("fb"), { force: 4, targetUuid: t.uuid });
    assert.match(chat.find((c) => /Flamethrower/.test(c.content))?.content ?? "", /Minimal light \+6/); // v0.79.0 docs check (was +4)
    const old = RULES.TN_AUTO.magic.lineOfSight;
    const savedTok = SR2Actor.tokenFor;
    (RULES.TN_AUTO.magic as any).lineOfSight = "block";
    g.CONFIG = { ...(g.CONFIG ?? {}), Canvas: { polygonBackends: { sight: { testCollision: () => true } } } };
    SR2Actor.tokenFor = (a: any) => (a ? { center: { x: a === mage ? 0 : 100, y: 0 }, name: a.name } : null);
    try {
      warnings.length = 0;
      const n = faces.length;
      const r = await mage.castSpell(mage.items.get("fb"), { force: 4, targetUuid: t.uuid });
      assert.equal(r, null);
      assert.equal(faces.length, n);
      assert.match(warnings.at(-1) ?? "", /no line of sight to Guard/);
    } finally { (RULES.TN_AUTO.magic as any).lineOfSight = old; SR2Actor.tokenFor = savedTok; delete g.CONFIG.Canvas; }
  });

  test("powers count the background count like spells", async () => {
    chat.length = 0;
    g.game.scenes = { viewed: { getFlag: (_s: string, k: string) => (k === "backgroundCount" ? 2 : undefined) } };
    const critter = person([], { name: "Critter" });
    const pw = { name: "Fear", uuid: "", system: { active: true, dice: "rating", rating: 4, tnSource: "fixed", targetNumber: 4, resist: "none", effect: "effect", damageLevel: "M", damageType: "physical" } };
    faces.push(1, 1, 1, 1);
    const r = await critter.usePower(pw, {});
    assert.equal(r.targetNumber, 6);
  });
});

describe("v0.50.0 review fixes", () => {
  let VehicleDataModel: any;
  const P = { body: 4, quickness: 5, strength: 3, charisma: 4, intelligence: 6, willpower: 5 };
  const withGet = (list: any[]) => Object.assign(list, { get(id: string) { return list.find((i: any) => i.id === id); } });
  const person = (items: any[] = [], extra: any = {}) => {
    const a = makeActor(P, { poolSpent: { combat: 0, spell: 0, hacking: 0, control: 0 }, karma: { good: 0, pool: 3, poolSpent: 0, career: 0 }, drugs: [], nuyen: 0, ledger: [], contacts: [], qualities: [],
      rigging: { vehicleUuid: "", jumpedIn: false, subscribed: [] }, sustaining: [], metatype: "human", ...extra });
    a.name = extra.name ?? "Runner"; a.type = "character"; (a as any).id = `id-${a.uuid}`;
    a.items = withGet(items.map((it: any) => ({ ...it, system: { ...it.system } })));
    (a as any).statuses = new Set<string>();
    a.system.parent = a; a.system.prepareDerivedData();
    uuidRegistry.set(a.uuid, a);
    return a;
  };
  const msgs: any[] = [];
  const asMessage = (d: any) => {
    // v0.81.1 (SEC1-1): an author (the GM's) unless the card names one.
    const m = { author: { id: "gm1", isGM: true }, ...d, id: `fx${msgs.length}`, timestamp: msgs.length, getFlag: (s: string, k: string) => m.flags?.[s]?.[k], async update(u: any) { for (const [k, v] of Object.entries(u)) setPath(m, k, v); } };
    msgs.push(m);
    return m;
  };
  let savedCreate: any;
  before(async () => {
    ({ VehicleDataModel } = await import("../models/index.ts"));
    g.fromUuidSync = (u: string) => uuidRegistry.get(u) ?? null;
    g.game.users = [{ id: "gm1", isGM: true }];
    g.game.user = { isGM: true, id: "gm1" };
    g.game.time = { worldTime: 0 };
    g.game.messages = { contents: msgs };
    savedCreate = g.ChatMessage.create;
    g.ChatMessage.create = async (d: any) => { chat.push(d); return asMessage(d); };
  });
  after(() => { g.ChatMessage.create = savedCreate; delete g.game.messages; });
  afterEach(() => { faces.length = 0; delete g.game.scenes; });

  test("a TN change that turns a sustained spell into a failure drops it", async () => {
    chat.length = 0;
    const mage = person([{ id: "so", type: "skill", name: "Sorcery", system: { rating: 3, attribute: "willpower" } },
      { id: "ar", type: "spell", name: "Armor", system: { category: "manipulation", spellType: "physical", learnedForce: 3, targetNumber: 4, duration: "sustained", area: false, drainModifier: 0, drainLevel: "M" } }], { magic: 6, tradition: "hermetic" });
    faces.push(5, 1, 1); faces.push(5, 5, 5, 5, 5);
    await mage.castSpell(mage.items.get("ar"), { force: 3 });
    assert.equal(mage.system.sustaining.length, 1);
    const card = msgs.find((m) => m.flags?.sr2e?.test?.label?.startsWith("Armor"));
    await SR2Actor.retarget(card, { baseTargetNumber: 6, modifiers: [] });
    assert.equal(mage.system.sustaining.length, 0);
    assert.equal(chat.at(-1).flags.sr2e.test.sustain.applied, false);
  });

  test("a card a Karma re-roll replaced can't have its TN changed; the newer one can", async () => {
    chat.length = 0; warnings.length = 0;
    const a = person();
    faces.push(1, 1, 3, 3);
    await a.rollAttribute("body", { targetNumber: 4 });
    const first = msgs.at(-1);
    faces.push(5, 5, 5, 5);
    await a.karmaReroll(first.flags.sr2e.test);
    const second = msgs.at(-1);
    assert.equal(second.flags.sr2e.test.testId, first.flags.sr2e.test.testId);
    assert.equal(SR2Actor.isReplaced(first), true);
    assert.equal(SR2Actor.isReplaced(second), false);
    assert.equal(await SR2Actor.retarget(first, { baseTargetNumber: 2, modifiers: [] }), null);
    assert.match(warnings.at(-1) ?? "", /replaced by a later one/);
    const third = await SR2Actor.retarget(second, { baseTargetNumber: 6, modifiers: [] });
    assert.ok(third);
    assert.equal(third.flags.sr2e.retargetOf, second.id);
  });

  test("the replacement keeps the original card's author", async () => {
    chat.length = 0;
    const a = person();
    faces.push(5, 5, 1, 1);
    await a.rollAttribute("body", { targetNumber: 4 });
    const card = msgs.at(-1);
    card.author = { id: "p1" };
    // v0.81.1 (SEC1-1): the author must own the roller (else the retarget is refused).
    a.testUserPermission = (u: any) => Boolean(u?.isGM) || u?.id === "p1";
    const next = await SR2Actor.retarget(card, { baseTargetNumber: 5, modifiers: [] });
    assert.equal(next.author, "p1");
  });

  test("poor visibility ticked by hand and the weather: the worse counts, not the weather alone", async () => {
    const v = new SR2Actor();
    const sys = Object.create(VehicleDataModel.prototype);
    Object.assign(sys, { category: "car", skill: "", drone: true, handling: 4, handlingOffroad: 0, speed: 90, accel: 10, body: 4, armor: 3, signature: 2, autonav: 0, pilot: 3, sensor: 3, ecm: 0, eccm: 0, ecd: 0,
      condition: 0, currentSpeed: 0, offroad: false, controllerUuid: "", controlMode: "autopilot", occupants: [], locks: [], chase: { quarryUuid: "", metres: 0 },
      load: 0, cargoFactor: 0, sensorMode: "active", sensorVision: { lowLight: false, thermographic: false }, autosofts: { maneuver: 0, targeting: 0, clearsight: 0 }, mods: [], jammed: { active: false, by: "", rating: 0 } });
    Object.assign(v, { type: "vehicle", name: "Drone", uuid: "Actor.v50fix", system: sys, items: withGet([]) });
    sys.parent = v; sys.prepareDerivedData();
    const light = RULES.HEALTH.weather.filter((w: any) => w.driving > 0).sort((a: any, b: any) => a.driving - b.driving)[0]!;
    g.game.scenes = { viewed: { getFlag: (_s: string, k: string) => (k === "weather" ? light.id : undefined) } };
    const poor = RULES.VEHICLES.drivingModifiers.find((m: any) => m.id === "poorVisibility")!.value;
    const mods = v.previewDrive({ situational: ["poorVisibility"] }).modifiers.filter((m: any) => /visibility|driving/i.test(m.label));
    assert.equal(mods.length, 1);
    assert.equal(mods[0].value, Math.max(poor, light.driving));
  });
});

describe("v0.51.0 GM tools: calculator roll, healing several, panel rows", () => {
  const P = { body: 4, quickness: 5, strength: 3, charisma: 4, intelligence: 6, willpower: 5 };
  const withGet = (list: any[]) => Object.assign(list, { get(id: string) { return list.find((i: any) => i.id === id); } });
  const person = (items: any[] = [], extra: any = {}) => {
    const a = makeActor(P, { poolSpent: { combat: 0, spell: 0, hacking: 0, control: 0 }, karma: { good: 0, pool: 3, poolSpent: 0, career: 0 }, drugs: [], nuyen: 0, ledger: [], contacts: [], qualities: [],
      rigging: { vehicleUuid: "", jumpedIn: false, subscribed: [] }, sustaining: [], metatype: "human", ...extra });
    a.name = extra.name ?? "Runner"; a.type = "character"; (a as any).id = `id-${a.uuid}`;
    a.items = withGet(items.map((it: any) => ({ ...it, system: { ...it.system } })));
    (a as any).statuses = new Set<string>();
    a.system.parent = a; a.system.prepareDerivedData();
    uuidRegistry.set(a.uuid, a);
    return a;
  };
  before(() => { g.game.users = [{ id: "gm1", isGM: true }, { id: "p1", isGM: false }]; g.game.user = { isGM: true, id: "gm1" }; });
  afterEach(() => { faces.length = 0; });

  test("the calculator's roll is an ordinary test card, whispered to the GMs unless public", async () => {
    chat.length = 0;
    faces.push(6, 2, 5, 1, 3);
    const r = await SR2Actor.gmRoll({ dice: 4, targetNumber: 4, modifiers: [{ label: "Smoke", value: 2 }], label: "Guard <Perception>" });
    assert.equal(r.targetNumber, 6);
    assert.equal(r.successes, 1); // 6+3 = 9 only
    const card = chat.at(-1);
    assert.deepEqual(card.whisper, ["gm1"]);
    assert.match(card.content, /Guard &lt;Perception&gt;/);
    assert.match(card.content, /sr2e-banner/);
    assert.equal(card.flags.sr2e.gmRoll.successes, 1);
    faces.push(1, 1);
    await SR2Actor.gmRoll({ dice: 2, targetNumber: 4, public: true });
    assert.equal(chat.at(-1).whisper, undefined);
    assert.equal(chat.at(-1).flags.sr2e.gmRoll.botch, true);
  });

  test("healing several: boxes off one track, both, or cleared; owners only; one GM card", async () => {
    chat.length = 0;
    const a = person([], { name: "A", monitor: { physical: 3, stun: 5 } });
    const b = person([], { name: "B", monitor: { physical: 0, stun: 2 } });
    const c = person([], { name: "C", monitor: { physical: 4, stun: 4 } });
    (c as any).isOwner = false;
    assert.equal(await SR2Actor.healSeveral([a, b, c], { track: "stun", boxes: 3 }), 2);
    assert.deepEqual([a.system.monitor.stun, b.system.monitor.stun, c.system.monitor.stun], [2, 0, 4]);
    assert.match(chat.at(-1).content, /A: stun 5 → 2/);
    assert.deepEqual(chat.at(-1).whisper, ["gm1"]);
    assert.equal(await SR2Actor.healSeveral([a], { track: "both", boxes: "all" }), 1);
    assert.deepEqual([a.system.monitor.physical, a.system.monitor.stun], [0, 0]);
    chat.length = 0;
    assert.equal(await SR2Actor.healSeveral([a, b], { track: "physical", boxes: 2 }), 0);
    assert.equal(chat.length, 0);
  });

  test("panel rows: a person's condition, pools, chips and fitting quick actions", async () => {
    const { personRow, poolsLine, recentRollRow } = await import("../applications/groups.ts");
    const a = person([{ id: "s1", type: "spell", name: "Bolt", system: {} }], { name: "Mage", monitor: { physical: 2, stun: 0 }, professionalRating: 2 });
    const row = personRow(a, { initiative: "12" });
    assert.equal(row.name, "Mage");
    assert.equal(row.monitor, true);
    assert.equal(row.physical, 2);
    assert.equal(row.canCast, true);
    assert.equal(row.canMorale, true);
    assert.equal(row.initiative, "12");
    assert.match(poolsLine(a), /Combat \d+\/\d+/);
    assert.match(poolsLine(a), /Karma 3\/3/);
    const v = { type: "vehicle", name: "Van", uuid: "Actor.v", system: { condition: 3 }, items: [] };
    const vr = personRow(v);
    assert.equal(vr.canAttack, false);
    assert.equal(vr.condition, "damage 3/10");
    // Recent rolls: test cards and dice only; the banner is the outcome.
    const strip = (h: string) => h.replace(/<[^>]*>/g, "").trim();
    assert.equal(recentRollRow({ content: "<p>hi</p>", flags: {} }, strip), null);
    const rr = recentRollRow({ id: "m1", content: '<div class="sr2e-banner sr2e-banner-hit">Hit</div><h3>Attack</h3>', flags: { sr2e: { test: { successes: 2 } } }, speaker: { alias: "Guard" }, whisper: ["gm1"] }, strip);
    assert.equal(rr.outcome, "Hit");
    assert.equal(rr.who, "Guard");
    assert.equal(rr.whisper, true);
  });
});

describe("v0.56.0 magic and critters", () => {
  const M = { body: 4, quickness: 4, strength: 4, charisma: 5, intelligence: 5, willpower: 6 };
  const withGet = (list: any[]) => Object.assign(list, { get(id: string) { return list.find((i: any) => i.id === id); } });
  const actors: any[] = [];
  const who = (extra: any = {}, items: any[] = []) => {
    const a = makeActor(M, { magic: 0, karma: { pool: 0, poolSpent: 0, good: 30 }, metamagic: {}, initiateGrade: 0, nuyen: 0, sustaining: [], drugs: [], geasa: [], ledger: [], recovering: [],
      poolSpent: { combat: 0, spell: 0, hacking: 0, control: 0 }, ...extra });
    a.name = extra.name ?? "Someone"; a.type = extra.type ?? "character"; (a as any).id = `id-${a.uuid}`;
    a.items = withGet(items.map((it) => ({ ...it, async update(d: any) { for (const [k, v] of Object.entries(d)) setPath(this, k, v); a.system.prepareDerivedData(); } })));
    (a as any).statuses = new Set<string>();
    a.system.parent = a; a.system.prepareDerivedData();
    uuidRegistry.set(a.uuid, a);
    actors.push(a);
    return a;
  };
  const skill = (id: string, name: string, rating: number, attribute = "willpower", kind = "active") => ({ id, type: "skill", name, system: { rating, attribute, kind } });
  const mage = (extra: any = {}, items: any[] = []) => who({ magic: 6, tradition: "hermetic", ...extra }, [skill("sorc", "Sorcery", 4), skill("conj", "Conjuring", 4, "charisma"), ...items]);
  const fx = (o: any = {}) => ({ attributes: {}, reaction: 0, initiativeDice: 0, ballistic: 0, impact: 0, testsTn: 0, perceivedTn: 0, attackedTn: 0, movementFactor: 1, ...o });
  const spell = (id: string, name: string, system: any) => ({ id, type: "spell", name, system: { category: "manipulation", spellType: "mana", learnedForce: 4, targetNumber: 4, damageLevel: "M", damageType: "stun",
    duration: "instant", resist: "none", drainModifier: 0, drainLevel: "M", range: "los", effects: fx(), effectPerSuccess: false, healDrain: "fixed", treat: false, ...system } });
  const zeros = { body: 0, quickness: 0, strength: 0, charisma: 0, intelligence: 0, willpower: 0 };
  const power = (id: string, name: string, system: any) => ({ id, type: "power", name, system: { active: true, dice: "rating", rating: 4, tnSource: "fixed", targetNumber: 4, resist: "none", effect: "effect",
    area: false, repeating: false, damageLevel: "M", damageType: "stun", special: "", sustained: false, perSuccess: false, attributes: { ...zeros }, mods: { testsTn: 0, perceivedTn: 0, attackedTn: 0, movementFactor: 1 }, ...system } });
  const hooksDrop = async (a: any, index: number) => {
    const opts: any = {};
    await a._preUpdate({ system: { sustaining: [] } }, opts, null);
    await a.dropSustained(index);
    a._onUpdate({ system: { sustaining: [] } }, opts, "gm1");
    await new Promise((r) => setTimeout(r, 5));
  };
  before(() => {
    g.game.scenes = { viewed: null, get: () => null, contents: [] };
    g.game.time = { worldTime: 0 };
    g.game.user = { isGM: true, id: "gm1" }; g.game.users = [{ id: "gm1", isGM: true }];
    g.game.actors = actors;
    g.game.settings = { get: () => undefined, set: async () => {} };
    g.fromUuidSync = (u: string) => uuidRegistry.get(u) ?? null;
    g.canvas = {};
    delete g.game.combat;
  });
  afterEach(() => { faces.length = 0; g.game.time.worldTime = 0; delete g.Actor.create; });

  test("a sustained spell's changes go on its target and come off when it's dropped; spell reflexes don't stack", async () => {
    chat.length = 0;
    const ir = spell("ir", "Increase Reflexes", { category: "health", duration: "sustained", effects: fx({ reaction: 1, initiativeDice: 1 }) });
    const a = mage({}, [ir]);
    const before0 = { r: a.system.derived.reaction, d: a.system.derived.initiativeDice };
    faces.push(5, 5, 1, 1);                                   // Sorcery 4 vs 4: 2 successes
    faces.push(...Array(6).fill(5));                          // drain resisted
    await a.castSpell(a.items.get("ir"), { force: 4 });
    a.system.prepareDerivedData();
    assert.deepEqual({ r: a.system.derived.reaction, d: a.system.derived.initiativeDice }, { r: before0.r + 1, d: before0.d + 1 });
    const entry = a.system.sustaining[0];
    assert.match(entry.effectId, /^sp/);
    assert.equal(a.getFlag("sr2e", "powerEffects")[0].id, entry.effectId);
    assert.equal(a.getFlag("sr2e", "powerEffects")[0].kind, "spell");
    // Wired reflexes 2 beat the spell's die: it adds nothing, and the sheet says why.
    const sam = who({ name: "Pell" }, [{ id: "wr", type: "cyberware", name: "Wired reflexes 2", system: { installed: true, initiativeDice: 2, reaction: 4, essenceCost: 3, grade: "standard", attributes: {} } }]);
    await SR2Actor.setPowerEffect(sam.uuid, SR2Actor.fxEntry(SR2Actor.spellFx(a.items.get("ir"), 4), 2, "x1", a.uuid, a.name));
    sam.system.prepareDerivedData();
    assert.equal(sam.system.derived.initiativeDice, 3);
    assert.ok(sam.system.derived.cyberWarnings.some((w: string) => /Magical reflexes do not stack/.test(w)));
    // Dropping the spell takes the change off its target.
    await hooksDrop(a, 0);
    assert.equal(a.getFlag("sr2e", "powerEffects").length, 0);
    a.system.prepareDerivedData();
    assert.equal(a.system.derived.initiativeDice, before0.d);
  });

  test("an armor spell adds armor by successes; a resisted spell's change is by net successes", async () => {
    chat.length = 0;
    const a = mage({}, [spell("ar", "Armor", { spellType: "physical", duration: "sustained", effects: fx({ ballistic: 1, impact: 1 }), effectPerSuccess: true })]);
    faces.push(5, 5, 5, 1);                                   // 3 successes
    faces.push(...Array(6).fill(5));
    await a.castSpell(a.items.get("ar"), { force: 4 });
    a.system.prepareDerivedData();
    assert.equal(a.armorRating("ballistic"), 3);
    assert.equal(a.armorRating("impact"), 3);
    const b = mage({ name: "Hexer" }, [spell("sl", "Slow", { duration: "sustained", resist: "willpower", effects: fx({ attributes: { quickness: -1 } }), effectPerSuccess: true })]);
    const v = who({ name: "Victim" });
    faces.push(6, 6, 6, 1, 1, 1, 1);                          // vs Willpower 6: 3 successes (6+1)
    faces.push(...Array(6).fill(5));                          // drain
    await b.castSpell(b.items.get("sl"), { targetUuid: v.uuid, force: 4 });
    const card = chat.find((c: any) => c.flags?.sr2e?.spell);
    assert.ok(card);
    faces.push(...Array(6).fill(1));                          // the victim resists with nothing
    await v.resistSpell(card.flags.sr2e.spell, 0);
    const e = v.getFlag("sr2e", "powerEffects")[0];
    assert.equal(e.attributes.quickness, -3);
    assert.equal(e.id, b.system.sustaining[0].effectId);
    assert.match(chat.at(-1).content, /Slow: Quickness −3 while Hexer sustains it/);
  });

  test("a permanent healing spell is sustained until it takes; dropped early, the wound comes back; drain by the wound", async () => {
    chat.length = 0;
    const heal = spell("he", "Heal", { category: "health", heals: true, healTrack: "physical", duration: "permanent", healDrain: "wound", drainLevel: "L" });
    const a = mage({}, [heal]);
    const p = who({ name: "Patient", monitor: { physical: 6, stun: 0 } });
    faces.push(5, 5, 1, 1);                                   // vs 10 − Essence 6 = 4: 2 successes
    faces.push(...Array(6).fill(5));                          // drain
    await a.castSpell(a.items.get("he"), { targetUuid: p.uuid, force: 4 });
    assert.equal(p.system.monitor.physical, 4);
    assert.ok(chat.some((c: any) => /Drain \(by the wound\) S/.test(c.content)));
    const e = a.system.sustaining[0];
    assert.equal(e.permanentAt, 2 * 3);                       // 2 Combat Turns of 3 s (no Foundry round time here)
    assert.deepEqual({ ...e.healed }, { targetUuid: p.uuid, track: "physical", boxes: 2 });
    await hooksDrop(a, 0);
    assert.equal(p.system.monitor.physical, 6);
    assert.ok(chat.some((c: any) => /dropped before it became permanent/.test(c.content)));
    // Cast again (a fresh caster), and let it take.
    const c = mage({ name: "Healer" }, [heal]);
    faces.push(5, 5, 1, 1);
    faces.push(...Array(6).fill(5));
    await c.castSpell(c.items.get("he"), { targetUuid: p.uuid, force: 4 });
    assert.equal(p.system.monitor.physical, 4);
    await SR2Actor.magicTicks({ worldTime: 6, anyGm: true });
    assert.equal(c.system.sustaining.length, 0);
    assert.match(chat.at(-1).content, /Heal<\/strong> is now permanent/);
    assert.equal(p.system.monitor.physical, 4);
  });

  test("Treat only soon after the wound (refused with the house rule)", async () => {
    const treat = spell("tr", "Treat", { category: "health", heals: true, healTrack: "physical", treat: true });
    const a = mage({}, [treat]);
    const p = who({ name: "Old wound", monitor: { physical: 3, stun: 0 } });
    await p.setFlag("sr2e", "damagedAt", { physical: 0 });
    g.game.time.worldTime = 3 * 3600;
    // v0.92.3: refused is the default now (Core p. 155: Treat "must" be within one hour).
    assert.equal(RULES.MAGIC_V56.healing.treatBlock, true);
    assert.equal(await a.castSpell(a.items.get("tr"), { targetUuid: p.uuid }), null);
    assert.match(warnings.at(-1) ?? "", /Treat only works within 1 hour of the wound \(it was 3 hours ago\)/);
  });

  test("a touch spell: an unwilling target is touched first", async () => {
    chat.length = 0;
    const bolt = spell("tc", "Touch Bolt", { category: "combat", range: "touch" });
    const a = mage({}, [bolt, skill("uc", "Unarmed Combat", 3, "strength")]);
    const t = who({ name: "Mark" });
    faces.push(1, 1, 1);                                      // Unarmed Combat 3 vs 4: none
    faces.push(5, 1, 1, 1);                                   // Mark's Quickness 4 vs 4: 1
    assert.equal(await a.castSpell(a.items.get("tc"), { targetUuid: t.uuid }), null);
    assert.match(chat.at(-1).content, /No contact/);
    faces.push(5, 5, 1);                                      // 2
    faces.push(1, 1, 1, 1);                                   // 0: contact
    faces.push(1, 1, 1, 1);                                   // the spell: no successes
    faces.push(...Array(6).fill(5));                          // drain
    const r = await a.castSpell(a.items.get("tc"), { targetUuid: t.uuid });
    assert.ok(r);
    assert.ok(chat.some((c: any) => /<strong>Contact\.<\/strong>/.test(c.content)));
  });

  test("learning a spell: a test, time, Karma only on success; the library warning", async () => {
    (RULES.MAGIC_V56.learning as any).enabled = true;
    try {
      chat.length = 0;
      const a = mage({}, [spell("mb", "Mana Bolt", { category: "combat", learnedForce: 3 })]);
      faces.push(1, 1, 1, 1);                                 // Sorcery 4 vs 5: none
      assert.equal(await a.raiseSpellForce(a.items.get("mb"), 5), false);
      assert.equal(a.system.karma.good, 30);
      assert.equal(a.items.get("mb").system.learnedForce, 3);
      assert.match(warnings.at(-1) ?? "", /needs a sorcery library to learn Mana Bolt at Force 5/);
      faces.push(5, 5, 1, 1);                                 // 2 successes
      assert.equal(await a.raiseSpellForce(a.items.get("mb"), 5), true);
      assert.equal(a.items.get("mb").system.learnedForce, 5);
      assert.ok(a.system.karma.good < 30);
      assert.match(chat.at(-1).content, /learns Mana Bolt at Force 5<\/strong> in <strong>3 days<\/strong>/);
      // A new spell from a formula is written on success only.
      faces.push(1, 1, 1, 1);
      assert.equal(await a.learnFormula("Light", { category: "illusion", learnedForce: 2 }), false);
      assert.ok(!a.items.some((i: any) => i.name === "Light"));
    } finally { (RULES.MAGIC_V56.learning as any).enabled = false; }
  });

  test("a ward raised by ritual becomes a barrier actor; drain follows", async () => {
    chat.length = 0;
    const made: any[] = [];
    g.Actor.create = async (d: any) => { made.push(d); return { uuid: "Actor.ward1" }; };
    const a = mage();
    faces.push(5, 5, 1, 1);                                   // Conjuring 4 vs 4: 2
    faces.push(...Array(6).fill(5));                          // drain
    await a.raiseWardRitual({ force: 4, name: "Front door ward" });
    assert.deepEqual(made[0], { name: "Front door ward", type: "barrier", system: { barrierKind: "ward", rating: 4, baseRating: 4 } });
    assert.ok(chat.some((c: any) => /Front door ward<\/strong> \(a Force 4 ward\) rises after <strong>2 hours/.test(c.content)));
    assert.ok(chat.some((c: any) => /Ward drain/.test(c.content)));
  });

  test("centering by a skill test: its successes come off the next magical test's wounds", async () => {
    (RULES.MAGIC_V56.centering as any).mode = "testIfSkill";
    try {
      const a = mage({ initiateGrade: 2, metamagic: { centering: true }, centeringSkill: "Singing", monitor: { physical: 3, stun: 0 } }, [skill("sing", "Singing", 3, "charisma")]);
      faces.push(6, 6, 1, 1, 1);                              // Singing 3 vs 4 + 2 wounds: 2 (6+1)
      await a.centeringTest();
      assert.equal(a.centeredSuccesses(), 2);
      faces.push(...Array(6).fill(5));
      const r = await a.rollAttribute("willpower", { targetNumber: 4, magical: true });
      assert.ok(r.modifiers.some((m: any) => m.label === "Centering" && m.value === -2));
      assert.equal(a.centeredSuccesses(), 0);
      // Without a centering skill it works by itself, as before.
      const b = mage({ initiateGrade: 1, metamagic: { centering: true }, monitor: { physical: 3, stun: 0 } });
      faces.push(...Array(6).fill(5));
      const r2 = await b.rollAttribute("willpower", { targetNumber: 4, magical: true });
      assert.ok(r2.modifiers.some((m: any) => m.label === "Centering" && m.value === -1));
    } finally { (RULES.MAGIC_V56.centering as any).mode = "auto"; }
  });

  test("assensing reveals more with more successes, whispered", async () => {
    chat.length = 0;
    const seer = mage({ name: "Seer", astral: "perceiving" });
    const kim = who({ name: "Kim", monitor: { physical: 2, stun: 0 } }, [{ id: "dj", type: "cyberware", name: "Datajack", system: { installed: true, essenceCost: 0.2, grade: "standard", attributes: {} } }]);
    faces.push(5, 5, 1, 1, 1);                                // Intelligence 5 vs 4: 2
    await seer.assense({ targetUuid: kim.uuid });
    const card = chat.at(-1);
    assert.match(card.content, /Kim's aura/);
    assert.match(card.content, /Health: Physical 2 boxes/);
    assert.match(card.content, /Cyberware: yes/);
    assert.doesNotMatch(card.content, /Datajack/);
    assert.deepEqual(card.whisper, ["gm1"]);
  });

  test("nature spirits leave at sunrise or sunset; a totem helps only its spirits", async () => {
    chat.length = 0;
    const sp = who({ name: "Forest spirit", type: "spirit", spiritKind: "nature", departsAt: 100, services: 2, force: 3 });
    await SR2Actor.magicTicks({ worldTime: 99, anyGm: true });
    assert.equal(sp.system.services, 2);
    await SR2Actor.magicTicks({ worldTime: 100, anyGm: true });
    assert.equal(sp.system.services, 0);
    assert.equal(sp.system.departsAt, -1);
    assert.match(chat.at(-1).content, /Forest spirit<\/strong> departs at (sunrise|sunset)/);
    // A shaman whose totem helps forest spirits: +2 dice for one, none for a city spirit.
    const made: any[] = [];
    g.Actor.create = async (d: any) => { made.push(d); return { uuid: `Actor.sp${made.length}` }; };
    const sh = who({ name: "Shaman", magic: 6, tradition: "shamanic", totem: { name: "Bear", conjuring: 2, spirits: "forest", environment: "" } }, [skill("conj", "Conjuring", 4, "charisma")]);
    faces.push(5, 5, 1, 1, 1, 1);                             // 4 + 2 dice vs 3: 2 successes
    faces.push(...Array(5).fill(5));                          // drain
    await sh.conjure({ force: 3, spiritKind: "nature", spiritType: "Forest spirit", domain: "forest" });
    assert.ok(chat.some((c: any) => /Summon Forest spirit \(Force 3; TN 3\) \[totem \+2\]/.test(c.content)));
    assert.equal(made[0].system.departsAt, 6 * 3600);
    faces.push(5, 5, 1, 1);                                   // 4 dice
    faces.push(...Array(5).fill(5));
    await sh.conjure({ force: 3, spiritKind: "nature", spiritType: "City spirit", domain: "city" });
    const city = chat.find((c: any) => /Summon City spirit/.test(c.content));
    assert.doesNotMatch(city.content, /totem/);
    assert.equal(city.flags.sr2e.test.totalDice, 4);
  });

  test("taking control of someone else's spirit (its summoner helps it)", async () => {
    chat.length = 0;
    const owner = mage({ name: "Owner" });
    const thief = mage({ name: "Thief" });
    const sp = who({ name: "Watcher", type: "spirit", force: 3, spiritKind: "elemental", summonerUuid: owner.uuid, services: 2 });
    faces.push(1, 1, 1);                                      // the spirit: Force 3 vs Magic 6: none
    faces.push(6, 1, 1, 1, 1);                                // the owner helps: 1 (6+1)
    faces.push(5, 5, 5, 1);                                   // the thief: 3 vs Force 3
    faces.push(...Array(5).fill(5));                          // drain
    await thief.banish(sp, { control: true });
    assert.equal(sp.system.summonerUuid, thief.uuid);
    assert.equal(sp.system.services, 2);
    assert.equal(sp.system.force, 3);
    assert.ok(chat.some((c: any) => /Owner helps Watcher resist/.test(c.content)));
    assert.match(chat.find((c: any) => /takes control of Watcher/.test(c.content))?.content ?? "", /\(its summoner added 1\)/);
  });

  test("binding a free spirit by its true name", async () => {
    chat.length = 0;
    const { banishResistDice } = await import("../rules/index.ts");
    const free = who({ name: "Freebie", type: "spirit", force: 4, spiritKind: "free", trueName: "Azoth", spiritEnergy: 1 });
    const a = mage();
    assert.equal(await a.bindByTrueName(free, "Bob"), null);
    assert.match(warnings.at(-1) ?? "", /not Freebie's true name/);
    faces.push(...Array(banishResistDice(4, "free", 1)).fill(1)); // it resists with nothing
    faces.push(5, 5, 1, 1);                                   // Conjuring 4 vs 4: 2
    faces.push(...Array(5).fill(5));                          // drain
    await a.bindByTrueName(free, " azoth ");
    assert.equal(free.system.summonerUuid, a.uuid);
    assert.equal(free.system.services, 2);
    assert.equal(a.system.karma.good, 30 - 4 * RULES.MAGIC_V56.trueName.karmaPerForce);
  });

  test("adepts: powers past the budget stop working; senses, spell resistance, rapid healing, distance strike", async () => {
    chat.length = 0;
    const ap = (id: string, name: string, system: any) => ({ id, type: "adeptpower", name, system: { cost: 1, active: true, level: 1, attributes: { ...zeros }, reaction: 0, initiativeDice: 0, skill: "", skillDice: 0, ballistic: 0, impact: 0, special: "", sense: "", ...system } });
    const ad = who({ name: "Adept", magic: 3, tradition: "adept", monitor: { physical: 0, stun: 2 } }, [
      ap("p1", "Improved Reflexes", { cost: 2, reaction: 2, initiativeDice: 1 }),
      ap("p2", "Mystic Armor", { cost: 2, ballistic: 2, impact: 2 }),
      ap("p3", "Cat's eyes", { cost: 0, special: "improvedSenses", sense: "lowLight" }),
      ap("p4", "Spell resistance", { cost: 0, special: "spellResistance", level: 2 }),
      ap("p5", "Rapid healing", { cost: 0, special: "rapidHealing", level: 1 }),
      ap("p6", "Distance strike", { cost: 0, special: "distanceStrike" }),
    ]);
    assert.deepEqual(ad.system.derived.adeptOver.map((o: any) => o.id), ["p2"]);
    assert.equal(ad.armorRating("ballistic"), 0);
    assert.equal(ad.system.derived.vision.lowLight, true);
    assert.equal(ad.distanceStrikeReach(), 3);
    faces.push(...Array(8).fill(1));                          // Willpower 6 + 2 dice
    await ad.resistSpell({ casterUuid: "x", targetUuid: ad.uuid, spellName: "Bolt", force: 4, resistAttribute: "willpower", level: "M", damageType: "stun", casterSuccesses: 0, effectOnly: true }, 0);
    assert.match(chat.at(-1).content, /\+ 2 spell resistance/);
    faces.push(...Array(7).fill(1));                          // v0.92.3 (Core p. 112): Willpower 6 (higher than Body 4) + 1 die
    await ad.naturalHeal({ track: "stun", hours: 1 });
    assert.match(chat.at(-1).content, /rapid healing \+1/);
    const t = who({ name: "Far target" });
    faces.push(1, 1, 1, 1);                                   // unarmed, no successes
    await ad.attackWith(SR2Actor.unarmed(), { targetUuid: t.uuid, distanceStrike: true, measuredMetres: 3 });
    assert.equal(chat.at(-1).flags.sr2e.test.attack.distance, true);
  });

  test("critter immunities: normal weapons armor, fire, poisons", async (t) => {
    t.after(oldWay({"BOOK_V78.critterToxins.mode": "stop"})); // v0.78.0: the old rule (a house rule)
    chat.length = 0;
    const c = who({ name: "Vampire", type: "npc", essence: 4 }, [{ id: "im", type: "power", name: "Immunity", system: { active: false, special: "immunity", substance: "normal weapons, fire, poisons" } }]);
    assert.equal(c.armorRating("ballistic"), 4 * RULES.CRITTERS_V56.immunity.armorPerEssence);
    assert.equal(c.armorRating("ballistic", { ignoreImmunity: true }), 0);
    await c.resistHazard("fire", 6);
    assert.match(chat.at(-1).content, /immune to fire/);
    await c.resistToxin({ name: "Narcoject", vector: "injection", power: 6, level: "S", damageType: "stun" });
    assert.match(chat.at(-1).content, /immune to poisons: Narcoject has no effect/);
  });

  test("powers that change TNs and movement: confusion, concealment, guard, movement", async () => {
    chat.length = 0;
    const c = who({ name: "Critter", type: "npc" }, [
      power("cf", "Confusion", { special: "confusion" }),
      power("cc", "Concealment", { special: "concealment" }),
      power("gd", "Guard", { special: "guard" }),
      power("mv", "Movement", { special: "movement", rating: 2 }),
    ]);
    const v = who({ name: "Victim" });
    faces.push(5, 5, 1, 1);                                   // rating 4 vs 4: 2 successes
    await c.usePower(c.items.get("cf"), { targetUuid: v.uuid });
    faces.push(...Array(4).fill(5));
    const r = await v.rollAttribute("body", { targetNumber: 4 });
    assert.ok(r.modifiers.some((m: any) => m.label === "Confusion (Critter)" && m.value === 4)); // v0.77.0: the rating, not net successes
    faces.push(5, 1, 1, 1);
    await c.usePower(c.items.get("cc"), { targetUuid: v.uuid });
    faces.push(5, 1, 1, 1);
    await c.usePower(c.items.get("gd"), { targetUuid: v.uuid });
    const walk0 = v.system.derived.movement.walk;
    faces.push(5, 1);
    await c.usePower(c.items.get("mv"), { targetUuid: v.uuid });
    v.system.prepareDerivedData();
    assert.deepEqual({ ...v.system.derived.effectMods }, { testsTn: 4, perceivedTn: 4, attackedTn: 0, movementFactor: 2 }); // v0.77.0 book check
    assert.equal(v.system.derived.movement.walk, walk0 * 2);
    assert.deepEqual(SR2Actor.attackedMods([v]), []); // v0.77.0: Guard puts no TN on attacks
    assert.equal(SR2Actor.powerEffectsFrom([c.uuid]).length, 4);
  });

  test("review fixes: a re-rolled cast keeps its effect id; a failed cast sends no GM card; two buffs at once both land", async () => {
    chat.length = 0;
    const ir = spell("ir", "Increase Reflexes", { category: "health", duration: "sustained", effects: fx({ initiativeDice: 1 }) });
    const a = mage({ karma: { pool: 5, poolSpent: 0, good: 30 } }, [ir]);
    const ally = who({ name: "Ally" });
    (ally as any).isOwner = false;
    faces.push(1, 1, 1, 1);                                   // no successes
    faces.push(...Array(6).fill(5));
    await a.castSpell(a.items.get("ir"), { targetUuid: ally.uuid, force: 4 });
    assert.ok(!chat.some((c: any) => /An effect on Ally ends/.test(c.content)));
    const card = chat.find((c: any) => c.flags?.sr2e?.test?.powerEffect);
    faces.push(5, 5, 5, 5);                                   // the Karma re-roll: 4 successes
    await a.karmaReroll(card.flags.sr2e.test);
    const entry = a.system.sustaining[0];
    const gm = chat.find((c: any) => c.flags?.sr2e?.powerEffect?.effect);
    assert.equal(gm.flags.sr2e.powerEffect.effect.id, entry.effectId);
    (ally as any).isOwner = true;
    await Promise.all([
      SR2Actor.setPowerEffect(ally.uuid, { id: "e1", fromUuid: "x", fromName: "X", name: "One", attributes: { body: 1 } }),
      SR2Actor.setPowerEffect(ally.uuid, { id: "e2", fromUuid: "x", fromName: "X", name: "Two", attributes: { strength: 1 } }),
    ]);
    assert.deepEqual(ally.getFlag("sr2e", "powerEffects").map((e: any) => e.id).sort(), ["e1", "e2"]);
  });

  test("review fixes: damaged wired reflexes don't block a spell; only the best reflex spell counts", () => {
    const sam = who({ name: "Sam2" }, [{ id: "wr", type: "cyberware", name: "Wired reflexes 2", system: { installed: true, damaged: true, initiativeDice: 2, reaction: 4, essenceCost: 3, grade: "standard", attributes: {} } }]);
    const base = sam.system.derived.initiativeDice;
    sam.flags.sr2e = { powerEffects: [
      { id: "a", fromUuid: "x", fromName: "X", name: "IR1", kind: "spell", attributes: {}, initiativeDice: 1 },
      { id: "b", fromUuid: "y", fromName: "Y", name: "IR2", kind: "spell", attributes: {}, initiativeDice: 2 },
    ] };
    sam.system.prepareDerivedData();
    assert.equal(sam.system.derived.initiativeDice, base + 2);
    assert.ok(sam.system.derived.cyberWarnings.includes("Only the best reflex spell counts"));
  });

  test("review fixes: two pending heals keep their own records; a permanent spell with the house rule off takes at once", async () => {
    chat.length = 0;
    const heal = spell("he", "Heal", { category: "health", heals: true, healTrack: "physical", duration: "permanent" });
    const a = mage({}, [heal]);
    const p1 = who({ name: "P1", monitor: { physical: 4, stun: 0 } });
    faces.push(5, 5, 1, 1); faces.push(...Array(6).fill(5));
    await a.castSpell(a.items.get("he"), { targetUuid: p1.uuid, force: 4 });
    assert.equal(a.system.sustaining[0].healed.targetUuid, p1.uuid);
    (RULES.MAGIC_V56.permanent as any).enabled = false;
    try {
      faces.length = 0;
      const b = mage({ name: "Instant" }, [spell("ar", "Armor", { spellType: "physical", duration: "permanent", effects: fx({ ballistic: 2 }) })]);
      faces.push(5, 5, 1, 1); faces.push(...Array(6).fill(5));
      await b.castSpell(b.items.get("ar"), { force: 4 });
      assert.equal(b.system.sustaining.length, 0);
      assert.equal(b.getFlag("sr2e", "powerEffects")[0].permanent, true);
    } finally { (RULES.MAGIC_V56.permanent as any).enabled = true; }
  });

  test("review fixes: a re-rolled centering doesn't come back once used; a binding re-rolled to a failure is undone", async () => {
    (RULES.MAGIC_V56.centering as any).mode = "testIfSkill";
    try {
      const a = mage({ initiateGrade: 2, metamagic: { centering: true }, centeringSkill: "Singing", karma: { pool: 5, poolSpent: 0, good: 30 } }, [skill("sing", "Singing", 3, "charisma")]);
      faces.push(5, 1, 1);
      await a.centeringTest();
      const card = chat.at(-1);
      faces.push(...Array(6).fill(5));
      await a.rollAttribute("willpower", { targetNumber: 4, magical: true });
      assert.equal(a.centeredSuccesses(), 0);
      faces.push(5, 5);
      await a.karmaReroll(card.flags.sr2e.test);
      assert.equal(a.centeredSuccesses(), 0);
      assert.match(chat.at(-1).content, /already used/);
    } finally { (RULES.MAGIC_V56.centering as any).mode = "auto"; }
    // A player binding a GM's free spirit: the binding goes to the GM as a card.
    const { banishResistDice } = await import("../rules/index.ts");
    const free = who({ name: "Free2", type: "spirit", force: 2, spiritKind: "free", trueName: "Nix", spiritEnergy: 0 });
    const b = mage({ karma: { pool: 5, poolSpent: 0, good: 30 } });
    g.game.user.isGM = false;
    try {
      faces.push(...Array(banishResistDice(2, "free", 0)).fill(1));
      faces.push(5, 5, 5, 1);                                 // 3 net
      faces.push(...Array(5).fill(5));
      await b.bindByTrueName(free, "Nix");
    } finally { g.game.user.isGM = true; }
    assert.equal(free.system.summonerUuid, undefined);
    assert.equal(b.system.karma.good, 28);
    const gm = chat.find((c: any) => c.flags?.sr2e?.actorUpdate);
    // v0.81.0 (SEC1-1): a typed change (the GM's client works the update out), never a free-form update.
    assert.equal(gm.flags.sr2e.actorUpdate.update, undefined);
    assert.equal(gm.flags.sr2e.actorUpdate.handSpirit.toUuid, b.uuid);
    assert.equal(await SR2Actor.applyActorUpdate(gm.flags.sr2e.actorUpdate), true);
    assert.equal(free.system.summonerUuid, b.uuid);
    assert.equal(free.system.services, 3);
  });

  test("manifesting: only while projecting; it can't act in the physical world", async () => {
    const a = mage({ astral: "physical" });
    assert.equal(await a.setManifesting(true), false);
    a.system.astral = "projecting"; a.system.prepareDerivedData();
    assert.equal(await a.setManifesting(true), true);
    assert.equal(a.isManifesting(), true);
    assert.equal(await a.attackWith(SR2Actor.unarmed(), {}), null);
    // v0.70.0: refused earlier, as any projecting form is (RULES.FIXES_V70.astralBlocksPhysical).
    assert.match(warnings.at(-1) ?? "", /is manifesting|is projecting/);
  });
});

describe("v0.57.0 Matrix, vehicles and security", () => {
  useV922Vehicles(); // v0.92.3: these pin the v0.92.2 vehicle rules
  // v0.92.3: these pin the v0.92.2 Matrix rules (the book's defaults: v0923-matrix tests).
  let undo922 = () => {}; before(() => { undo922 = matrix922(); }); after(() => undo922());
  let HostDataModel: any, IcDataModel: any, VehicleDataModel: any, SiteDataModel: any;
  const D = { body: 4, quickness: 5, strength: 3, charisma: 3, intelligence: 6, willpower: 5 };
  const R = RULES as any;
  const withGet = (list: any[]) => Object.assign(list, { get(id: string) { return list.find((i: any) => i.id === id); } });
  const run = (extra: any = {}) => ({ jackedIn: false, hostUuid: "", monitor: 0, sim: "cold", connection: "jackpoint", crippled: { bod: 0, evasion: 0, masking: 0, sensors: 0 }, passed: [],
    trace: { active: false, icUuid: "", icName: "", mode: "dump", rating: 0, hostUuid: "", round: -1, worldTime: -1 }, psyche: [],
    transit: { hostUuid: "", hops: 0, round: -1, worldTime: -1 }, relayKm: 0, numbers: [], engagedBy: [], maneuvers: [], filter: { hostUuid: "", ok: -1 }, ridingWith: "", ...extra });
  const prog = (id: string, kind: string, rating: number, extra: any = {}) => ({ id, type: "program", name: `${kind[0]!.toUpperCase()}${kind.slice(1)}`, system: { kind, rating, size: 0, loaded: true, erased: false, damageLevel: "M", loading: { round: -1, worldTime: -1 }, ...extra } });
  const decker = (name = "Decker", opts: { deck?: any; items?: any[]; matrix?: any; extra?: any } = {}) => {
    const a = makeActor(D, { karma: { pool: 0, poolSpent: 0, good: 0 }, poolSpent: { combat: 0, spell: 0, hacking: 0, control: 0 }, matrix: run(opts.matrix), nuyen: 0, ledger: [], addictions: [], ...(opts.extra ?? {}) });
    a.name = name; a.type = "character";
    const item = (data: any) => ({ ...data, async update(d: any) { for (const [k, v] of Object.entries(d)) setPath(this, k, v); a.system.prepareDerivedData(); } });
    a.items = withGet([
      item({ id: "sk", type: "skill", name: "Computer", system: { rating: 5, attribute: "intelligence" } }),
      item({ id: "deck", type: "cyberdeck", name: "Deck", system: { active: true, mpcp: 6, bod: 4, evasion: 5, masking: 5, sensors: 4, hardening: 2, responseIncrease: 1, activeMemory: 900, storageMemory: 500, ioSpeed: 100, loadSpeed: 0, realityFilter: false, hitchers: 0, signal: 0, tortoise: false, living: false, damage: { mpcp: 0, bod: 0, evasion: 0, masking: 0, sensors: 0 }, files: [], ...(opts.deck ?? {}) } }),
      item(prog("sl", "sleaze", 4)),
      ...(opts.items ?? []).map(item),
    ]);
    a.system.parent = a; a.system.prepareDerivedData();
    uuidRegistry.set(a.uuid, a);
    return a;
  };
  const host = (name = "Host", extra: any = {}) => {
    const h = new SR2Actor();
    const sys = Object.create(HostDataModel.prototype);
    Object.assign(sys, { gridKind: "host", parentUuid: "", ltgNumber: "", securityCode: "red", securityValue: 6, subsystems: { access: 4, control: 4, index: 4, files: 4, slave: 4 }, tally: 0, alert: "none", sheaf: [],
      files: [{ id: "a", name: "Memo", size: 10, value: 0, paydata: false, encrypted: 0, scramble: 0, foundBy: [], bomb: 0, pavlov: false, bombFoundBy: [] }],
      securityDeckers: [], spotted: [], smoke: { rating: 0, tn: 0, by: "", round: -1, worldTime: -1 },
      tallies: [], shutdown: { pending: false, round: -1, worldTime: -1 }, validated: [], bombs: [], calls: [], ...extra });
    sys.prepareDerivedData();
    Object.assign(h, { type: "host", name, uuid: `Actor.v57h${(host as any).n = ((host as any).n ?? 0) + 1}`, system: sys });
    uuidRegistry.set(h.uuid, h);
    return h;
  };
  const ic = (h: any, extra: any = {}, items: any[] = []) => {
    const i = new SR2Actor();
    const sys = Object.create(IcDataModel.prototype);
    Object.assign(sys, { rating: 4, category: "white", icType: "", damageLevel: "M", damageType: "physical", initiativeDice: 0, hostUuid: h?.uuid ?? "", matrix: { monitor: 0 },
      kind: "ic", ownerUuid: "", smart: false, behavior: "killer", guards: "", traceMode: "dump", attribute: "evasion", payload: "", party: "", construct: [], ...extra });
    sys.prepareDerivedData();
    Object.assign(i, { type: "ic", name: extra.name ?? `${extra.behavior ?? "killer"}-${sys.rating}`, uuid: `Actor.v57ic${(ic as any).n = ((ic as any).n ?? 0) + 1}`, system: sys, items: withGet(items) });
    uuidRegistry.set(i.uuid, i);
    return i;
  };
  const vehicle = (extra: any = {}, items: any[] = []) => {
    const v = new SR2Actor();
    const sys = Object.create(VehicleDataModel.prototype);
    Object.assign(sys, { category: "car", skill: "", drone: true, handling: 2, handlingOffroad: 0, speed: 90, accel: 10, body: 4, armor: 3, signature: 2, autonav: 0, pilot: 3, sensor: 3, ecm: 0, eccm: 0, ecd: 0,
      condition: 0, currentSpeed: 30, offroad: false, controllerUuid: "", controlMode: "autopilot", occupants: [], locks: [], chase: { quarryUuid: "", metres: 0 },
      load: 0, sensorMode: "active", autosofts: { maneuver: 0, targeting: 0, clearsight: 0 }, mods: [], jammed: { active: false, by: "", rating: 0 },
      systems: { tires: false, sensors: false, engine: false }, speedTurn: { round: -1, start: 0, extra: 0 }, position: { winnerUuid: "", loserUuid: "", tn: 0, round: -1 }, ...extra });
    Object.assign(v, { type: "vehicle", name: extra.name ?? "Drone", uuid: `Actor.v57v${(vehicle as any).n = ((vehicle as any).n ?? 0) + 1}`, system: sys, items: withGet(items) });
    sys.parent = v; sys.prepareDerivedData();
    uuidRegistry.set(v.uuid, v);
    return v;
  };
  const person = (name: string, items: any[] = [], extra: any = {}) => {
    const a = makeActor(D, { poolSpent: { combat: 0, spell: 0, hacking: 0, control: 0 }, rigging: { vehicleUuid: "", jumpedIn: false, subscribed: [] }, matrix: run(), addictions: [], nuyen: 0, ledger: [], ...extra });
    a.name = name; a.type = "character";
    a.items = withGet(items.map((d: any) => ({ ...d, async update(u: any) { for (const [k, v] of Object.entries(u)) setPath(this, k, v); a.system.prepareDerivedData(); } })));
    a.system.parent = a; a.system.prepareDerivedData();
    uuidRegistry.set(a.uuid, a);
    return a;
  };
  const noDetect = () => faces.push(1, 1, 1, 1, 1, 2);
  before(async () => {
    ({ HostDataModel, IcDataModel, VehicleDataModel, SiteDataModel } = await import("../models/index.ts"));
    g.fromUuidSync = (u: string) => uuidRegistry.get(u) ?? null;
    g.game.users = [{ id: "gm1", isGM: true }];
    g.game.user = { isGM: true, id: "gm1" };
    g.game.time = { worldTime: 0 };
  });
  afterEach(() => { delete g.game.actors; delete g.game.combat; g.game.time = { worldTime: 0 }; g.game.user = { isGM: true, id: "gm1" }; faces.length = 0; });

  test("each intruder has their own security tally; steps fire on theirs; the host shows the highest; a player's card names whose", async () => {
    chat.length = 0;
    const h = host("Tallies", { sheaf: [{ step: 3, event: "Probe IC", alert: "passive" }] });
    const a = decker("Anna"); const b = decker("Ben");
    await a.jackIn(h.uuid); await b.jackIn(h.uuid);
    faces.push(5, 5, 5, 1, 1, 2, 2, 2, 2, 2, 2);                          // the host: 3; Anna: nothing
    await a.systemTest("access", { operationId: "nullOperation" });
    assert.deepEqual(h.system.tallies.map((t: any) => [t.name, t.tally]), [["Anna", 3]]);
    assert.equal(h.system.tally, 3);
    assert.equal(h.system.alert, "passive");
    assert.ok(chat.some((m) => /Anna's security tally 0 → <strong>3<\/strong>/.test(m.content) && /Probe IC/.test(m.content)));
    faces.push(5, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2);
    await b.systemTest("access", { operationId: "nullOperation" });
    assert.equal(h.system.tallies.find((t: any) => t.key === b.uuid).tally, 1);
    assert.equal(h.system.tally, 3);                                       // the highest
    // A probe IC's successes go on its target's tally.
    const p = ic(h, { behavior: "probe", rating: 4, name: "Probe-4" });
    faces.push(5, 5, 1, 2);                                                // 2 vs Ben's Detection Factor 5
    await p.icAttack({ targetUuid: b.uuid });
    assert.equal(h.system.tallies.find((t: any) => t.key === b.uuid).tally, 3);
    // A player's client posts the card with whose tally it is; the GM applies it.
    h.isOwner = false;
    faces.push(5, 5, 1, 1, 1, 2, 2, 2, 2, 2, 2);
    await a.systemTest("access", { operationId: "nullOperation" });
    const card = chat.find((m) => m.flags?.sr2e?.tally?.key === a.uuid);
    assert.equal(card.flags.sr2e.tally.successes, 2);
    h.isOwner = true;
    await SR2Actor.applyTallyCard(h.uuid, 2, { key: a.uuid, name: "Anna" });
    assert.equal(h.system.tallies.find((t: any) => t.key === a.uuid).tally, 5);
    // The house rule back to one tally per host.
    R.MATRIX_V57.tally.perDecker = false;
    try {
      const h2 = host("Shared");
      await a.jackIn(h2.uuid);
      faces.push(5, 5, 1, 1, 1, 2, 2, 2, 2, 2, 2);
      await a.systemTest("access", { operationId: "nullOperation" });
      assert.equal(h2.system.tally, 2);
      assert.deepEqual(h2.system.tallies, []);
    } finally { R.MATRIX_V57.tally.perDecker = true; }
  });

  test("swap memory: loading takes size ÷ load speed Combat Turns jacked in; a loading utility can't be used; off-line it's instant", async () => {
    chat.length = 0; warnings.length = 0;
    const h = host();
    const a = decker("Loader", { deck: { ioSpeed: 20 }, items: [prog("at", "attack", 5, { loaded: false })] });
    await a.jackIn(h.uuid);
    assert.equal(await a.swapProgram("at", true), true);                 // 75 Mp at 20: 4 Combat Turns
    const p = a.items.get("at");
    assert.equal(p.system.loaded, true);
    assert.deepEqual(p.system.loading, { round: -1, worldTime: 12 });
    assert.equal(SR2Actor.programReady(p), false);
    assert.match(chat.at(-1).content, /ready in <strong>4 Combat Turns<\/strong>/);
    assert.equal(await a.matrixAttack({ programId: "at" }), null);
    assert.match(warnings.at(-1) ?? "", /still loading/);
    assert.equal(a.system.derived.matrix.loading.includes("at"), true);
    g.game.time.worldTime = 12;
    assert.equal(SR2Actor.programReady(p), true);
    assert.equal(await a.swapProgram("at", false), true);                // unloading: instant
    assert.deepEqual(p.system.loading, { round: -1, worldTime: -1 });
    await a.jackOut();
    assert.equal(await a.swapProgram("at", true), true);                 // off-line: instant
    assert.equal(SR2Actor.programReady(p), true);
  });

  test("Matrix damage gives wound modifiers on Matrix tests (persona and IC), not on Medic", async () => {
    const h = host();
    const a = decker("Hurt", { matrix: { monitor: 3 } });
    await a.jackIn(h.uuid);
    noDetect(); faces.push(5, 1, 1, 1, 2);
    const r = await a.systemTest("access", { operationId: "nullOperation" });
    assert.ok(r.modifiers.some((m: any) => m.label === "Matrix damage" && m.value === 2));
    assert.equal(r.targetNumber, 6);
    const k = ic(h, { rating: 4, matrix: { monitor: 1 } });
    faces.push(2, 2, 2, 2);
    const ra = await k.icAttack({ targetUuid: a.uuid });
    assert.ok(ra.modifiers.some((m: any) => m.label === "Matrix damage" && m.value === 1));
  });

  test("black IC hold a decker: jacking out is a Willpower test; an evade maneuver frees them and the IC must find them again", async () => {
    chat.length = 0; warnings.length = 0;
    const h = host();
    const a = decker("Held");
    await a.jackIn(h.uuid);
    const bl = ic(h, { category: "black", rating: 4, name: "Black-4" });
    g.game.actors = [a, h, bl];
    faces.push(2, 2, 2, 2);                                                // the attack misses, but it has engaged them
    await bl.icAttack({ targetUuid: a.uuid });
    assert.deepEqual(a.system.matrix.engagedBy, [bl.uuid]);
    assert.equal(a.blackIcHold()?.uuid, bl.uuid);
    faces.push(2, 2, 2, 2, 2);                                             // Willpower 5 vs 4: no success
    await a.jackOut();
    assert.equal(a.system.matrix.jackedIn, true);
    assert.match(chat.at(-1).content, /Black-4 holds Held/);
    faces.push(5, 2, 2, 2, 2);
    await a.jackOut();
    assert.equal(a.system.matrix.jackedIn, false);
    assert.deepEqual(a.system.matrix.engagedBy, []);
    // Again, and this time break contact.
    await a.jackIn(h.uuid);
    faces.push(2, 2, 2, 2);
    await bl.icAttack({ targetUuid: a.uuid });
    faces.push(2, 2, 2, 2);                                                // the IC's Sensors side: 4 vs Evasion 5
    faces.push(5, 5, 2, 2, 2);                                             // Evasion 5 vs its rating 4: 2 net
    await a.matrixManeuver("evade", bl.uuid);
    assert.deepEqual(a.system.matrix.engagedBy, []);
    assert.equal(a.blackIcHold(), null);
    assert.equal(await bl.icAttack({ targetUuid: a.uuid }), null);
    assert.match(warnings.at(-1) ?? "", /broken contact/);
    faces.push(5, 5, 2, 2);                                                // rating 4 vs their Detection Factor 5
    await bl.icLocate(a.uuid);
    assert.equal(a.system.matrix.maneuvers.some((m: any) => m.kind === "evade"), false);
    faces.push(2, 2, 2, 2);
    assert.ok(await bl.icAttack({ targetUuid: a.uuid }));
  });

  test("a shutdown dumps everyone inside when due, with dump shock (by security code when the house rule says); frames fall to the grid", async () => {
    chat.length = 0;
    const grid = host("LTG", { gridKind: "ltg" });
    const h = host("Shut", { parentUuid: grid.uuid, securityCode: "red" });
    const a = decker("Inside");
    await a.jackIn(h.uuid);
    const f = ic(h, { kind: "frame", ownerUuid: a.uuid, name: "Frame" });
    g.game.actors = [a, h, f, grid];
    R.MATRIX_V57.dumpShock.levelBy = "code";
    try {
      await SR2Actor.startShutdown(h);
      assert.equal(h.system.shutdown.pending, true);
      assert.equal(h.system.shutdown.worldTime, 9);
      await SR2Actor.matrixTraces({ worldTime: 8 });
      assert.equal(a.system.matrix.jackedIn, true);
      await SR2Actor.matrixTraces({ worldTime: 9 });
      assert.equal(a.system.matrix.jackedIn, false);
      assert.equal(f.system.hostUuid, grid.uuid);
      assert.equal(h.system.shutdown.pending, false);
      const card = chat.find((m) => m.flags?.sr2e?.dumpShockFor === a.uuid);
      assert.equal(card.flags.sr2e.dumpShockLevel, "D");
      assert.equal(card.flags.sr2e.dumpShockTn, 6);
    } finally { R.MATRIX_V57.dumpShock.levelBy = "fixed"; }
    // Crashing a host is a shutdown too.
    const h2 = host("Crash");
    await a.jackIn(h2.uuid);
    g.game.actors = [a, h2];
    noDetect(); faces.push(5, 1, 1, 1, 2);
    await a.systemTest("control", { operationId: "crashHost" });
    assert.equal(h2.system.alert, "shutdown");
    assert.equal(h2.system.shutdown.pending, true);
  });

  test("book-value options: IC initiative and attack dice from the host's Security Value", async () => {
    const h = host("SV", { securityValue: 8, securityCode: "red" });
    const k = ic(h, { rating: 4 });
    const c = new SR2Combatant(); (c as any).actor = k;
    assert.equal(c.getInitiativeRoll().formula, "2d6 + 4");
    R.MATRIX_V57.icInitiative.from = "securityValue"; R.MATRIX_V57.icAttackDice = "securityValue";
    try {
      assert.equal(c.getInitiativeRoll().formula, "4d6 + 8");
      const a = decker(); await a.jackIn(h.uuid);
      faces.push(2, 2, 2, 2, 2, 2, 2, 2);
      const r = await k.icAttack({ targetUuid: a.uuid });
      assert.equal(r.totalDice, 8);
    } finally { R.MATRIX_V57.icInitiative.from = "rating"; R.MATRIX_V57.icAttackDice = "rating"; }
  });

  test("Analyze Icon reveals more with more successes; Locate is Sensors vs the Detection Factor", async () => {
    chat.length = 0;
    const h = host();
    const a = decker("Eyes");
    await a.jackIn(h.uuid);
    const k = ic(h, { category: "black", rating: 4, name: "Black-4", guards: "files" });
    faces.push(5, 5, 5, 2);                                                // Sensors 4 vs rating 4: 3
    await a.matrixPerception("analyzeIcon", k.uuid);
    const html = chat.at(-1).content;
    assert.match(html, /Black IC/); assert.match(html, /rating 4/); assert.match(html, /Matrix damage 0\/10/); assert.match(html, /Killer, guards Files/);
    const b = decker("Other"); await b.jackIn(h.uuid);
    faces.push(5, 2, 2, 2);
    const r = await a.matrixPerception("locateDecker", b.uuid);
    assert.equal(r.targetNumber, 5);
    assert.match(chat.at(-1).content, /Other located/);
  });

  test("position and parry maneuvers change the next attacks' TNs; position is used up", async () => {
    chat.length = 0;
    const h = host();
    const a = decker("Fighter", { items: [prog("at", "attack", 5)] });
    await a.jackIn(h.uuid);
    const k = ic(h, { rating: 4 });
    faces.push(2, 2, 2, 2, 5, 5, 5, 2, 2);                                // the IC 0; Fighter 3 net
    await a.matrixManeuver("position", k.uuid);
    assert.match(chat.at(-1).content, /gains position/);
    faces.push(5, 5, 2, 2, 2);
    const r = await a.matrixAttack({ targetUuid: k.uuid, programId: "at" });
    assert.ok(r.modifiers.some((m: any) => m.label === "Position (maneuver)" && m.value === -3));
    assert.equal(a.system.matrix.maneuvers.length, 0);
    faces.push(2, 2, 2, 2, 5, 5, 2, 2, 2);                                // parry: 2 net
    await a.matrixManeuver("parry", k.uuid);
    faces.push(2, 2, 2, 2);
    const ra = await k.icAttack({ targetUuid: a.uuid });
    assert.ok(ra.modifiers.some((m: any) => m.label === "Fighter parries" && m.value === 2));
  });

  test("Slow takes Initiative off an IC in combat; Restore restores crippled points and wears down", async () => {
    chat.length = 0;
    const h = host();
    const a = decker("Util", { matrix: { crippled: { bod: 0, evasion: 2, masking: 0, sensors: 0 } }, items: [prog("sw", "slow", 3), prog("rs", "restore", 3)] });
    await a.jackIn(h.uuid);
    const k = ic(h, { rating: 4 });
    const cb: any = { actor: k, initiative: 12, async update(d: any) { Object.assign(this, d); } };
    g.game.combat = { started: true, round: 1, combatants: [cb] };
    faces.push(5, 5, 2, 2, 2);                                             // Computer 5 vs 4: 2
    await a.useUtility("sw", { targetUuid: k.uuid });
    assert.equal(cb.initiative, 6);
    assert.match(chat.at(-1).content, /−6 Initiative/);
    faces.push(5, 5, 2);                                                   // Restore 3 vs 4: 2
    await a.useUtility("rs");
    assert.equal(a.system.matrix.crippled.evasion, 0);
    assert.equal(a.items.get("rs").system.rating, 2);
  });

  test("Validate Passcode makes a decker harder to detect; data bombs go off, Pavlov bombs re-arm; Scan and Defuse", async () => {
    chat.length = 0;
    const h = host("Bombs", { files: [
      { id: "b1", name: "Trap", size: 10, value: 0, paydata: false, encrypted: 0, scramble: 0, foundBy: [], bomb: 4, pavlov: false, bombFoundBy: [] },
      { id: "b2", name: "Pav", size: 10, value: 0, paydata: false, encrypted: 0, scramble: 0, foundBy: [], bomb: 3, pavlov: true, bombFoundBy: [] },
    ] });
    const a = decker("Bomber");
    h.system.files.forEach((f: any) => f.foundBy.push(a.uuid));
    await a.jackIn(h.uuid);
    noDetect(); faces.push(5, 1, 1, 1, 2);
    await a.systemTest("access", { operationId: "validatePasscode" });
    assert.deepEqual(h.system.validated, [a.uuid]);
    noDetect(); faces.push(5, 1, 1, 1, 2);
    await a.systemTest("files", { operationId: "downloadData", fileId: "b1" });
    assert.ok(chat.some((m) => /Detection Factor 7, passcode validated/.test(m.content)));
    assert.equal(h.system.files.some((f: any) => f.id === "b1"), false);  // erased by its bomb
    assert.equal(a.items.get("deck").system.files.length, 0);             // and nothing downloaded
    const card = chat.find((m) => /A data bomb goes off/.test(m.content));
    assert.deepEqual([card.flags.sr2e.damage.power, card.flags.sr2e.damage.level, card.flags.sr2e.damage.matrix], [4, "M", true]);
    noDetect(); faces.push(5, 1, 1, 1, 2);
    await a.systemTest("files", { operationId: "downloadData", fileId: "b2" });
    assert.equal(h.system.files.find((f: any) => f.id === "b2").bomb, 3);  // a Pavlov bomb stays
    assert.equal(a.items.get("deck").system.files.length, 1);             // and the download goes ahead
    noDetect(); faces.push(5, 1, 1, 1, 2);
    await a.systemTest("files", { operationId: "scanFile", fileId: "b2" });
    assert.deepEqual(h.system.files.find((f: any) => f.id === "b2").bombFoundBy, [a.uuid]);
    noDetect(); faces.push(5, 1, 1, 1, 2);
    const r = await a.systemTest("files", { operationId: "defuseBomb", fileId: "b2" });
    assert.equal(r.baseTargetNumber, 3);
    assert.equal(h.system.files.find((f: any) => f.id === "b2").bomb, 0);
    // A subsystem bomb goes off on any operation there.
    h.system.bombs = [{ subsystem: "index", rating: 5, pavlov: false, foundBy: [] }];
    noDetect(); faces.push(5, 1, 1, 1, 2);
    await a.systemTest("index", { operationId: "locateFile" });
    assert.deepEqual(h.system.bombs, []);
    assert.match(chat.filter((m) => m.flags?.sr2e?.test && /data bomb goes off/.test(m.content)).at(-1).content, /the Index subsystem/);
  });

  test("comcalls on an LTG: make, tap, reroute; not in a host", async () => {
    chat.length = 0; warnings.length = 0;
    const ltg = host("LTG 2206", { gridKind: "ltg", ltgNumber: "2206" });
    const a = decker("Caller");
    await a.jackIn(ltg.uuid);
    noDetect(); faces.push(5, 1, 1, 1, 2);
    await a.systemTest("slave", { operationId: "makeComcall", number: "555-0100" });
    assert.equal(ltg.system.calls.length, 1);
    assert.deepEqual([ltg.system.calls[0].from, ltg.system.calls[0].to, ltg.system.calls[0].by], ["2206", "555-0100", "Caller"]);
    const id = ltg.system.calls[0].id;
    noDetect(); faces.push(5, 1, 1, 1, 2);
    await a.systemTest("slave", { operationId: "tapComcall", callId: id });
    assert.deepEqual(ltg.system.calls[0].tappedBy, ["Caller"]);
    noDetect(); faces.push(5, 1, 1, 1, 2);
    await a.systemTest("control", { operationId: "rerouteComcall", callId: id, number: "555-0199" });
    assert.equal(ltg.system.calls[0].rerouted, "555-0199");
    const h = host("Plain");
    await a.jackIn(h.uuid);
    assert.equal(await a.systemTest("slave", { operationId: "makeComcall", number: "1" }), null);
    assert.match(warnings.at(-1) ?? "", /not an LTG/);
  });

  test("a reality filter tests MPCP vs the host's Security Value: it helps or hinders in that host", async () => {
    chat.length = 0;
    const good = host("Good", { securityValue: 5 });
    const bad = host("Bad", { securityValue: 5 });
    const a = decker("Filter", { deck: { realityFilter: true } });
    const reaction = a.system.derived.matrix.reaction, pool = a.system.derived.hackingPool;
    faces.push(5, 1, 1, 1, 1, 2);
    await a.jackIn(good.uuid);
    assert.deepEqual(a.system.matrix.filter, { hostUuid: good.uuid, ok: 1 });
    assert.equal(a.system.derived.matrix.reaction, reaction + 1);
    assert.equal(a.system.derived.hackingPool, pool + 1);
    faces.push(2, 2, 2, 2, 2, 2);
    await a.jackIn(bad.uuid);
    assert.equal(a.system.matrix.filter.ok, 0);
    assert.ok(a.matrixTestMods().some((m: any) => m.label === "Reality filter fails" && m.value === 1));
  });

  test("hitchers: room on the deck; black IC hits them too; a dump reaches them and unplugs them", async () => {
    chat.length = 0; warnings.length = 0;
    const h = host();
    const a = decker("Driver", { deck: { hitchers: 1 } });
    const r1 = person("Rider"); const r2 = person("Late");
    g.game.actors = [a, r1, r2, h];
    await a.jackIn(h.uuid);
    assert.equal(await r1.rideWith(a.uuid), true);
    assert.equal(await r2.rideWith(a.uuid), false);
    assert.match(warnings.at(-1) ?? "", /all in use/);
    const bl = ic(h, { category: "black", rating: 4 });
    g.game.actors.push(bl);
    faces.push(5, 5, 5, 2);                                                // 3 vs Evasion 5
    await bl.icAttack({ targetUuid: a.uuid });
    await a.defend(chat.at(-1).flags.sr2e.attack, 0);
    const dmg = chat.at(-1).flags.sr2e.damages;
    assert.equal(dmg.length, 2);
    assert.equal(dmg[1].targetUuid, r1.uuid);
    assert.equal(dmg[1].black, true);
    await SR2Actor.startShutdown(h);
    await SR2Actor.matrixTraces({ worldTime: 99 });
    assert.ok(chat.some((m) => m.flags?.sr2e?.dumpShockFor === r1.uuid));
    assert.equal(r1.system.matrix.ridingWith, "");
  });

  test("BTL chips need a jack; one-use chips burn out; addictive ones count as a dose", async () => {
    chat.length = 0; warnings.length = 0;
    R.HEALTH.addiction.auto = false;
    try {
      const btl = { id: "btl", type: "gear", name: "Dreamride", system: { quantity: 2, simchip: { kind: "btl", rating: 5, minutes: 30 } } };
      const nojack = person("Plain", [btl]);
      assert.equal(await nojack.playChip("btl"), false);
      assert.match(warnings.at(-1) ?? "", /chipjack, datajack or simrig/);
      const head = person("Head", [btl, { id: "dj", type: "cyberware", name: "Datajack", system: { installed: true, essenceCost: 0.2, grade: "standard", attributes: {}, reaction: 0, initiativeDice: 0, kind: "datajack" } }]);
      assert.equal(await head.playChip("btl"), true);
      assert.equal(head.items.get("btl").system.quantity, 1);
      assert.match(chat.at(-1).content, /burns out/);
      assert.equal(head.system.addictions[0].drug, "Dreamride");
      assert.equal(head.system.addictions[0].recent.length, 1);
    } finally { R.HEALTH.addiction.auto = true; }
  });

  test("Acceleration limits a change of speed in combat; a push test widens it; a disaster calls for a crash test", async () => {
    chat.length = 0;
    const v = vehicle({ accel: 10, currentSpeed: 30 });
    g.game.combat = { started: true, round: 2, combatants: [] };
    const up: any = { "system.currentSpeed": 60 };
    await v._preUpdate(up, {}, {});
    assert.equal(up["system.currentSpeed"], 40);
    const down: any = { "system.currentSpeed": 0 };
    await v._preUpdate(down, {}, {});
    assert.equal(down["system.currentSpeed"], 10);                         // braking: 2 × Accel
    faces.push(5, 5, 2);                                                   // Pilot 3 vs Handling 2 + 2: 2 successes
    await v.pushSpeed(60);
    assert.equal(v.system.speedTurn.extra, 20);
    assert.equal(v.system.currentSpeed, 60);
    assert.equal(v.speedWindow().max, 60);
    faces.push(1, 1, 1);
    await v.pushSpeed(90);
    assert.ok(chat.at(-1).flags.sr2e.crashTest);
    assert.match(chat.at(-1).content, /vehicleCrashTest/);
    g.game.combat = null;
    const free: any = { "system.currentSpeed": 0 };
    await v._preUpdate(free, {}, {});
    assert.equal(free["system.currentSpeed"], 0);                          // outside combat: free
  });

  test("heavy damage to a moving vehicle calls for a crash test; called shots: tires, a mount, an occupant", async () => {
    chat.length = 0;
    const gun = { id: "mg", type: "weapon", name: "MG", system: { mount: "turret", jammed: false }, async update(d: any) { for (const [k, x] of Object.entries(d)) setPath(this, k, x); } };
    const v = vehicle({ currentSpeed: 40 }, [gun]);
    faces.push(1, 1, 1, 2);                                                // Body 4 vs 7: nothing off
    await v.resistVehicleDamage({ targetUuid: v.uuid, melee: false, damageType: "physical", power: 10, level: "S", antiVehicle: true });
    assert.equal(chat.at(-1).flags.sr2e.crashTest.vehicleUuid, v.uuid);
    // Tires shot out: Handling worse, and a crash test at +2 even after light damage.
    const t = vehicle({ currentSpeed: 40 });
    faces.push(1, 1, 1, 2);
    await t.resistVehicleDamage({ targetUuid: t.uuid, melee: false, damageType: "physical", power: 6, level: "L", antiVehicle: true, vehiclePart: "tires" });
    assert.equal(t.system.systems.tires, true);
    assert.equal(t.system.derived.working.handling, 3);
    assert.equal(chat.at(-1).flags.sr2e.crashTest.tn, 2);
    // A weapon mount: the gun is knocked out.
    faces.push(1, 1, 1, 2);
    await v.resistVehicleDamage({ targetUuid: v.uuid, melee: false, damageType: "physical", power: 6, level: "L", antiVehicle: true, vehiclePart: "mount" });
    assert.equal(gun.system.jammed, true);
    // An occupant shot through the vehicle: the damage is theirs, with the vehicle's armor.
    const rider = person("Passenger");
    const shooter = person("Shooter", [{ id: "pi", type: "skill", name: "Pistols", system: { rating: 5, attribute: "quickness" } }]);
    v.system.occupants = [rider.uuid]; v.system.currentSpeed = 0;
    faces.push(6, 6, 1, 1, 1, 4, 4);                                       // TN 4 + 6: two sixes re-rolled to 10
    await shooter.attackWith({ name: "Predator", system: { melee: false, skill: "Pistols", damagePower: 9, damageLevel: "M", damageType: "physical" } }, { targetUuid: v.uuid, range: "short", vehiclePart: "occupant", occupantUuid: rider.uuid });
    const atkCard = chat.filter((m) => m.flags?.sr2e?.attack).at(-1);
    const attack = atkCard.flags.sr2e.attack;
    assert.equal(attack.occupantUuid, rider.uuid);
    assert.ok(atkCard.flags.sr2e.test.modifiers.some((m: any) => m.label === "Called shot: An occupant" && m.value === 6));
    await v.defend(attack, 0);
    const dmg = chat.at(-1).flags.sr2e.damage;
    assert.equal(dmg.targetUuid, rider.uuid);
    assert.equal(dmg.extraArmor, 3);
  });

  test("a driver at the wheel evades with a driving test and Combat Pool; the sensor test card is the rigger's, the lock the vehicle's", async () => {
    chat.length = 0;
    const drv = person("Wheelman", [{ id: "car", type: "skill", name: "Car", system: { rating: 4, attribute: "quickness" } }]);
    const v = vehicle({ drone: false, handling: 3 });
    v.controller = () => drv;
    v.system.controllerUuid = drv.uuid; v.system.controlMode = "manual";
    drv.system.rigging.vehicleUuid = v.uuid;
    faces.push(5, 5, 2, 2, 2, 2);                                          // Car 4 + 2 Combat Pool vs Handling 3
    await v.defend({ attackerUuid: "x", targetUuid: v.uuid, weaponName: "Gun", melee: false, damageType: "physical", power: 8, level: "M", attackSuccesses: 1, targetNumber: 5 }, 2);
    const card = chat.at(-1);
    assert.match(card.flags.sr2e.test.label, /evasive driving \(Wheelman, Handling 3\)/);
    assert.equal(card.flags.sr2e.test.totalDice, 6);
    assert.equal(drv.system.poolSpent.combat, 2);
    assert.match(card.content, /Missed/);
  });

  test("Rigger 2 maneuver scores win a firing position in a chase; designing a vehicle writes its stats", async () => {
    chat.length = 0;
    R.VEHICLES_V57.maneuver.mode = "score";
    try {
      const p = vehicle({ name: "Hunter", currentSpeed: 80 });
      const q = vehicle({ name: "Prey", currentSpeed: 40 });
      p.system.chase = { quarryUuid: q.uuid, metres: 50 };
      g.game.combat = { started: true, round: 3, combatants: [] };
      faces.push(5, 5, 1, 5, 1, 1);                                        // Hunter 2 (+4 speed), Prey 1 (+2)
      await p.chaseTurn();
      // v0.81.1 (RA2-4): the position carries its combat's id ('' here: the stub combat has none).
      assert.deepEqual(p.system.position, { winnerUuid: p.uuid, loserUuid: q.uuid, tn: 3, round: 3, combatId: '' });
      assert.deepEqual(q.system.position, p.system.position);
      assert.match(chat.at(-1).content, /Hunter<\/strong> has the position/);
    } finally { R.VEHICLES_V57.maneuver.mode = "gap"; }
    const v = vehicle();
    const r = await v.applyDesign({ chassis: "sedan", powerplant: "performance", spend: { armor: 2, handling: 1 } });
    assert.equal(r?.cost, 30000 + 10000 + 2 * 3000 + 5000);
    assert.deepEqual([v.system.body, v.system.handling, v.system.speed, v.system.accel, v.system.armor], [3, 3, 137, 12, 2]);
  });

  test("a jumped-in rigger's sensor test is their card (Karma); with the house rule, a lock replaces range with the Signature and caps Gunnery at the Sensor", async () => {
    chat.length = 0;
    const rig = person("Rigger", [
      { id: "vcr", type: "cyberware", name: "Control rig", system: { installed: true, essenceCost: 2, grade: "standard", attributes: {}, reaction: 0, initiativeDice: 0, controlRig: 1 } },
      { id: "dj", type: "cyberware", name: "Datajack", system: { installed: true, essenceCost: 0.2, grade: "standard", attributes: {}, reaction: 0, initiativeDice: 0, kind: "datajack" } },
      { id: "gun", type: "skill", name: "Gunnery", system: { rating: 6, attribute: "intelligence" } },
    ], { karma: { pool: 3, poolSpent: 0, good: 0 } });
    const mgun = { id: "mg", type: "weapon", name: "MG", update: async () => {}, system: { melee: false, skill: "", mount: "turret", damagePower: 7, damageLevel: "S", damageType: "physical", modes: "SA", ammo: 0, ammoMax: 0, recoilComp: 0, antiVehicle: false } };
    const v = vehicle({ drone: false, sensor: 3, currentSpeed: 0 }, [mgun]);
    const target = vehicle({ name: "Target", signature: 2, currentSpeed: 0 });
    v.system.occupants = [rig.uuid];
    await rig.takeControl(v, "jumped");
    faces.push(5, 5, 1);                                                   // Sensor 3 vs Signature 2: 2
    await v.sensorTest(target.uuid);
    const card = chat.filter((m) => m.flags?.sr2e?.test?.kind === "sensor").at(-1);
    assert.equal(card.flags.sr2e.test.actorUuid, rig.uuid);
    assert.equal(v.system.locks[0].targetUuid, target.uuid);
    {
      const back = oldWay({ "VEHICLES_V57.sensorGunnery": "signature" }); // v0.79.0: restore the shipped default, not 'flat'
      try {
        faces.push(5, 5, 1);
        const r = await rig.fireMounted(v, v.items.get("mg"), { targetUuid: target.uuid, range: "short", mode: "SA" });
        assert.equal(r.totalDice, 3);                                        // Gunnery 6 capped at Sensor 3
        assert.ok(r.modifiers.some((m: any) => /Signature 2 instead of range 4/.test(m.label) && m.value === -2));
      } finally { back(); }
    }
    // v0.79.0 (sensorGunnery 'rigger2', the default): Gunnery 6 + half Sensor 3 (1), Signature in place of range.
    faces.push(5, 5, 1, 1, 1, 1, 1);
    const r2 = await rig.fireMounted(v, v.items.get("mg"), { targetUuid: target.uuid, range: "short", mode: "SA" });
    assert.equal(r2.totalDice, 7);
    assert.ok(r2.modifiers.some((m: any) => /Signature 2 instead of range 4/.test(m.label) && m.value === -2));
  });

  test("review fixes: crash damage calls for no new crash test and stops the vehicle; a failed push can be re-rolled; Slow refused keeps nothing applied", async () => {
    chat.length = 0;
    const v = vehicle({ currentSpeed: 50 });
    await v.crash(50);
    assert.equal(v.system.currentSpeed, 0);
    faces.push(1, 1, 1, 2);
    await v.resistVehicleDamage({ targetUuid: v.uuid, melee: false, damageType: "physical", power: 9, level: "S", crash: true, ignoreArmor: true });
    assert.equal(chat.at(-1).flags.sr2e.crashTest, undefined);
    // A failed push, then a Karma-style re-resolve that succeeds, pushes.
    const p = vehicle({ accel: 10, currentSpeed: 30 });
    g.game.combat = { started: true, round: 1, combatants: [] };
    faces.push(2, 2, 2);                                                    // Pilot 3 vs Handling 2 + 2: no success
    await p.pushSpeed(60);
    const snap = chat.at(-1).flags.sr2e.test;
    assert.equal(snap.drive.pushApplied, false);
    // Slow on a combatant the user can't update.
    const h = host();
    const a = decker("Slower", { items: [prog("sw", "slow", 3)] });
    await a.jackIn(h.uuid);
    const k = ic(h, { rating: 4 });
    g.game.combat = { started: true, round: 1, combatants: [{ actor: k, initiative: 12, async update() { throw new Error("no"); } }] };
    faces.push(5, 5, 2, 2, 2);
    await a.useUtility("sw", { targetUuid: k.uuid });
    assert.equal(chat.at(-1).flags.sr2e.test.mutility.applied, 0);
    assert.match(chat.at(-1).content, /GM: lower its Initiative by 6/);
  });

  test("a maglock's casing comes first; tools and the lock type change the bypass", async () => {
    chat.length = 0;
    const s = new SR2Actor();
    const sys = Object.create(SiteDataModel.prototype);
    Object.assign(sys, { devices: [{ id: "lk", name: "Back door", kind: "maglock", rating: 4, tokenUuid: "", sceneId: "", wallId: "", active: true, bypassed: false, scanKind: "", sense: "", tamper: 0, identifies: false, lockType: "card", casing: 3, casingOpen: false, notes: "" }],
      guards: [], tally: 0, alert: "none", steps: [], response: { round: -1, worldTime: -1, arrived: false, force: "" }, riggerUuid: "", slaved: [], hostUuid: "" });
    sys.prepareDerivedData();
    Object.assign(s, { type: "site", name: "Site", uuid: "Actor.v57site", system: sys, device(id: string) { return this.system.devices.find((d: any) => d.id === id); } });
    uuidRegistry.set(s.uuid, s);
    const thief = person("Thief", [
      { id: "el", type: "skill", name: "Electronics", system: { rating: 3, attribute: "intelligence" } },
      { id: "br", type: "skill", name: "Electronics B/R", system: { rating: 4, attribute: "intelligence" } },
      { id: "pk", type: "gear", name: "Passkey", system: { quantity: 1, bypassTool: { kind: "passkey", rating: 6 } } },
    ]);
    const pv = thief.bypassPreview(s, "lk");
    assert.deepEqual([pv.step, pv.tn, pv.dice], ["casing", 3, 4]);
    faces.push(5, 2, 2, 2);                                                // B/R 4 vs casing 3
    await thief.bypassLock(s, "lk");
    assert.equal(s.system.devices[0].casingOpen, true);
    assert.equal(s.system.devices[0].bypassed, false);
    const pv2 = thief.bypassPreview(s, "lk");
    assert.deepEqual([pv2.step, pv2.tn, pv2.dice, pv2.tool], ["circuit", 4, 6, "Passkey 6"]);
    assert.ok(pv2.modifiers.some((m: any) => m.label === "Card reader" && m.value === 2)); // v0.77.0 book check: card reader +2
    faces.push(6, 6, 2, 2, 2, 2, 1, 1);
    await thief.bypassLock(s, "lk");
    assert.equal(s.system.devices[0].bypassed, true);
    // No tools at all: +2.
    const bare = person("Bare", [{ id: "el", type: "skill", name: "Electronics", system: { rating: 3, attribute: "intelligence" } }]);
    s.system.devices[0].casing = 0;
    assert.ok(bare.bypassPreview(s, "lk").modifiers.some((m: any) => m.label === "No tools" && m.value === 2));
  });
});

describe("v0.58.0 characters, gear and integration", () => {
  const D = { body: 4, quickness: 5, strength: 3, charisma: 3, intelligence: 6, willpower: 5 };
  const R = RULES as any;
  const withGet = (list: any[]) => Object.assign(list, { get(id: string) { return list.find((i: any) => i.id === id); } });
  let itemN = 0;
  const person = (name: string, items: any[] = [], extra: any = {}) => {
    const a = makeActor(D, { poolSpent: { combat: 0, spell: 0, hacking: 0, control: 0 }, karma: { good: 50, pool: 0, poolSpent: 0, career: 0 }, addictions: [], nuyen: 0, ledger: [], training: [], essenceHole: 0, reputation: { streetCred: 0, notoriety: 0, publicAwareness: 0 }, ...extra });
    a.name = name; a.type = "character";
    a.items = withGet(items.map((d: any) => {
      const it: any = { isOwner: true, ...d, parent: a, uuid: `${a.uuid}.Item.${d.id}${++itemN}`, async update(u: any) { for (const [k, v] of Object.entries(u)) setPath(this, k, v); a.system.prepareDerivedData(); } };
      uuidRegistry.set(it.uuid, it);
      return it;
    }));
    a.system.parent = a; a.system.prepareDerivedData();
    uuidRegistry.set(a.uuid, a);
    return a;
  };
  before(() => {
    g.fromUuidSync = (u: string) => uuidRegistry.get(u) ?? null;
    g.game.users = [{ id: "gm1", isGM: true }];
    g.game.user = { isGM: true, id: "gm1" };
    g.game.time = { worldTime: 0 };
    g.foundry.utils ??= {};
    g.foundry.utils.getProperty ??= (o: any, p: string) => p.split(".").reduce((x: any, k: string) => x?.[k], o);
  });
  afterEach(() => { faces.length = 0; g.game.time = { worldTime: 0 }; R.CHARACTERS_V58.training.mode = "instant"; delete g.game.actors; });

  test("a Reaction-linked vehicle skill defaults to Reaction and takes its Karma band from natural Reaction", async () => {
    chat.length = 0;
    const a = person("Rigger", [{ id: "car", type: "skill", name: "Car", system: { rating: 0, attribute: "reaction", kind: "active", specializationRating: 0, concentrationRating: 0 } }]);
    // Reaction (5+6)/2 = 5 dice at +4 TN.
    faces.push(5, 5, 5, 5, 5);
    const r = await a.rollSkill(a.items.get("car"), { targetNumber: 4 });
    assert.equal(r.totalDice ?? r.dice.length, 5);
    assert.equal(r.targetNumber, 8);
    assert.match(chat.at(-1).content, /no skill: Reaction/);
    const c = a.improveCost({ skillId: "car" });
    assert.equal(c.ok, true);
    assert.equal(c.to, 1);
  });

  test("a plain Perception test: Intelligence vs 4 with obviousness; the card says what was noticed", async () => {
    chat.length = 0;
    const a = person("Watcher");
    faces.push(6, 1, 5, 2, 2, 2, 3); // 6 dice (Int 6); the 6 explodes into a 1
    const r = await a.notice({ obviousness: "hidden", sense: "hearing", what: "a voice behind the door", whisper: true });
    assert.equal(r.targetNumber, 8);
    assert.equal(r.successes, 1);
    assert.match(chat.at(-1).content, /Something is there, but little else/); // v0.79.0: the SR2 p. 185 table
    assert.match(chat.at(-1).content, /a voice behind the door/);
    assert.deepEqual(chat.at(-1).whisper, ["gm1"]);
  });

  test("a skill test shows base time ÷ successes; tools short of the job add TN; Read/Write rolls half", async () => {
    chat.length = 0;
    const a = person("Tinker", [
      { id: "br", type: "skill", name: "Electronics B/R", system: { rating: 4, attribute: "intelligence", kind: "buildRepair", specializationRating: 0, concentrationRating: 0 } },
      { id: "jp", type: "skill", name: "Japanese", system: { rating: 5, attribute: "intelligence", kind: "language", specializationRating: 0, concentrationRating: 0 } },
    ]);
    faces.push(5, 5, 1, 1);
    const r = await a.rollSkill(a.items.get("br"), { targetNumber: 4, baseTime: { value: 6, unit: "hours" }, tools: { need: "shop", have: "kit" } });
    assert.equal(r.targetNumber, 6);  // a kit for a shop job: +2
    assert.equal(r.successes, 0);
    assert.match(chat.at(-1).content, /Not done \(no successes\)/);
    faces.push(6, 5, 5, 1); // 5 → Read/Write 3 dice, one explodes
    const r2 = await a.rollSkill(a.items.get("jp"), { targetNumber: 4, language: { readWrite: true, complexity: "everyday" }, baseTime: { value: 30, unit: "minutes" } });
    assert.equal(r2.dice.length >= 3, true);
    assert.equal(r2.successes, 3);
    assert.match(chat.at(-1).content, /Read\/Write 3/);
    assert.match(chat.at(-1).content, /Understands it all/);
    assert.match(chat.at(-1).content, /Time taken: <strong>10 minutes/);
  });

  test("a broken weapon can't attack; a repair test fixes it", async () => {
    chat.length = 0;
    warnings.length = 0;
    const a = person("Merc", [
      { id: "gun", type: "weapon", name: "Pistol", system: { skill: "Firearms", damaged: true, melee: false, damagePower: 9, damageLevel: "M", damageType: "physical", range: { short: 5, medium: 20, long: 40, extreme: 60 } } },
      { id: "fbr", type: "skill", name: "Firearms B/R", system: { rating: 3, attribute: "intelligence", kind: "buildRepair", specializationRating: 0, concentrationRating: 0 } },
      { id: "kit", type: "gear", name: "Gunsmith kit", system: { tools: { level: "kit", skill: "" }, quantity: 1 } },
    ]);
    assert.equal(await a.attackWith(a.items.get("gun"), {}), null);
    assert.match(warnings.at(-1) ?? "", /broken/);
    faces.push(5, 5, 1);
    await a.repairGear("gun");
    assert.equal(a.items.get("gun").system.damaged, false);
    assert.match(chat.at(-1).content, /Pistol is repaired/);
    assert.match(chat.at(-1).content, /Time taken: <strong>1 hours/);
  });

  test("training time: the Karma goes at once, an instructor shortens it, the rating rises when it is done", async () => {
    chat.length = 0;
    R.CHARACTERS_V58.training.mode = "timed";
    const a = person("Student", [{ id: "fa", type: "skill", name: "Firearms", system: { rating: 2, attribute: "quickness", kind: "active", specializationRating: 0, concentrationRating: 0 } }]);
    const teacher = person("Teacher", [
      { id: "ins", type: "skill", name: "Instruction", system: { rating: 4, attribute: "charisma", kind: "active", specializationRating: 0, concentrationRating: 0 } },
      { id: "fa2", type: "skill", name: "Firearms", system: { rating: 6, attribute: "quickness", kind: "active", specializationRating: 0, concentrationRating: 0 } },
    ]);
    const good = a.system.karma.good;
    assert.equal(await a.improve({ skillId: "fa" }), true);
    assert.equal(a.items.get("fa").system.rating, 2);
    assert.equal(a.system.training.length, 1);
    const t = a.system.training[0];
    assert.equal(a.system.karma.good < good, true);
    assert.equal(t.days, 21);                                  // new rating 3 × 7 days
    assert.equal(await a.improve({ skillId: "fa" }), false);   // already training it
    faces.push(5, 5, 5, 1);
    await a.trainWith(t.id, teacher.uuid);
    assert.equal(a.system.training[0].days, 7);                // 21 ÷ 3 successes
    assert.match(chat.at(-1).content, /cuts the training to <strong>7 days/);
    // A second instructor test divides the untaught 21 days again: it doesn't stack.
    faces.push(5, 5, 5, 5);
    await a.trainWith(t.id, teacher.uuid);
    assert.equal(a.system.training[0].days, 6);                // 21 ÷ 4, rounded up
    await SR2Actor.timedEffects({ worldTime: 7 * 86400 - 10, anyGm: true });
    g.game.actors = [a];
    await SR2Actor.timedEffects({ worldTime: 7 * 86400, anyGm: true });
    assert.equal(a.items.get("fa").system.rating, 3);
    assert.equal(a.system.training.length, 0);
    assert.match(chat.at(-1).content, /finishes training/);
  });

  test("training whose rating was reached another way gives its Karma back at the time step", async () => {
    R.CHARACTERS_V58.training.mode = "timed";
    const a = person("Overtaken", [{ id: "fa", type: "skill", name: "Firearms", system: { rating: 2, attribute: "quickness", kind: "active", specializationRating: 0, concentrationRating: 0 } }]);
    const before = a.system.karma.good;
    await a.improve({ skillId: "fa" });
    await a.items.get("fa").update({ "system.rating": 3 });
    g.game.actors = [a];
    await SR2Actor.timedEffects({ worldTime: 30 * 86400, anyGm: true });
    assert.equal(a.system.karma.good, before);
    assert.equal(a.items.get("fa").system.rating, 3);
  });

  test("a cyberlimb's housed ware costs Essence once the limb is out", (t) => {
    t.after(oldWay({ "GEAR_V923.limbHoused": "capacity", "GEAR_V923.limbPairs": "off" })); // v0.92.3: the old way (v0.92.2); __tests__/v0923-gear.test.ts has the book's
    const a = person("Armed", [
      { id: "arm", type: "cyberware", name: "Cyberarm", system: { essenceCost: 1, grade: "standard", installed: true, bioware: false, attributes: {}, kind: "cyberlimb", limb: { location: "rightArm", strength: 4, quickness: 4, capacity: 1 } } },
      { id: "sl", type: "cyberware", name: "Smartlink", system: { essenceCost: 0.5, grade: "standard", installed: true, bioware: false, attributes: {}, kind: "other", housedIn: "arm" } },
    ]);
    assert.equal(SR2Actor.housedEssence(a.items.get("arm")), 0.5);
    assert.equal(SR2Actor.essenceOf(a.items.get("sl")), 0);
  });

  test("giving training up gives the Karma back", async () => {
    R.CHARACTERS_V58.training.mode = "timed";
    const a = person("Quitter", [], {});
    const before = a.system.karma.good;
    await a.improve({ attribute: "body" });
    assert.equal(a.system.attributes.body.base, 4);
    await a.cancelTraining(a.system.training[0].id);
    assert.equal(a.system.karma.good, before);
    assert.equal(a.system.training.length, 0);
  });

  test("negotiating pay: the social contest's net successes move the fee", async () => {
    chat.length = 0;
    const runner = person("Face", [{ id: "neg", type: "skill", name: "Negotiation", system: { rating: 5, attribute: "charisma", kind: "active", specializationRating: 0, concentrationRating: 0 } }]);
    const johnson = person("Mr. Johnson", [{ id: "neg2", type: "skill", name: "Negotiation", system: { rating: 2, attribute: "charisma", kind: "active", specializationRating: 0, concentrationRating: 0 } }]);
    faces.push(6, 1, 6, 1, 6, 1, 1, 1, 1, 1); // runner 5 dice (two 6s re-rolled), Johnson 2 dice
    const r = await runner.negotiatePay(10000, johnson.uuid);
    assert.ok(r);
    assert.equal(r!.net > 0, true);
    assert.match(chat.at(-1).content, /Pay: ¥10,000 → <strong>¥1\d,\d00<\/strong>/);
  });

  test("Essence holes: removed ware leaves a hole, new ware fills it, Essence counts it", async () => {
    chat.length = 0;
    const a = person("Chromed", [{ id: "cw", type: "cyberware", name: "Cybereyes", system: { essenceCost: 0.2, grade: "standard", installed: true, bioware: false, attributes: {}, kind: "eyes" } }]);
    assert.equal(a.system.derived.essence, 5.8);
    assert.equal(SR2Actor.essenceOf(a.items.get("cw")), 0.2);
    await a.openEssenceHole(0.2, "Cybereyes");
    a.items.splice(0, 1);
    a.system.prepareDerivedData();
    assert.equal(a.system.essenceHole, 0.2);
    assert.equal(a.system.derived.essence, 5.8);           // still lost
    await a.fillEssenceHole(0.15);
    assert.equal(a.system.essenceHole, 0.05);
    R.GEAR_V58.essenceHoles.enabled = false;
    a.system.prepareDerivedData();
    assert.equal(a.system.derived.essence, 6);
    R.GEAR_V58.essenceHoles.enabled = true;
  });

  test("filtration adds dice against its vector; bone lacing adds to Body for resistance and to unarmed Power", async (t) => {
    t.after(oldWay({ "GEAR_V923.boneLacing": "dice" })); // v0.92.3: the old way (v0.92.2); __tests__/v0923-gear.test.ts has the book's
    chat.length = 0;
    const a = person("Laced", [
      { id: "f", type: "cyberware", name: "Air filtration", system: { essenceCost: 0.1, grade: "standard", installed: true, bioware: false, attributes: {}, kind: "filtration", filterKind: "air", rating: 3 } },
      { id: "l", type: "cyberware", name: "Bone lacing", system: { essenceCost: 1.15, grade: "standard", installed: true, bioware: false, attributes: {}, kind: "boneLacing", lacing: "aluminum" } },
    ]);
    assert.deepEqual(a.filtrationFor("inhalation"), { dice: 3, label: "Air filtration" });
    assert.equal(a.filtrationFor("injection").dice, 0);
    assert.equal(a.system.derived.cyber.lacing.soakDice, 2);
    assert.equal(a.system.derived.load.kg >= 10, true);
    faces.push(1, 1, 1, 1, 1, 1);   // Body 4 + lacing 2
    await a.resistDamage({ power: 6, level: "M" });
    assert.match(chat.at(-1).content, /Aluminum bone lacing \+2/);
  });

  test("surveillance: a planted bug listens through white noise; a jammer blocks it; a sweep finds it", async () => {
    chat.length = 0;
    const spy = person("Spy", [
      { id: "bug", type: "gear", name: "Bug", system: { quantity: 1, surveillance: { kind: "bug", rating: 4, active: true, plantedOn: "", plantedName: "" } } },
      { id: "sc", type: "gear", name: "Bug scanner", system: { quantity: 1, surveillance: { kind: "bugScanner", rating: 5, active: true, plantedOn: "", plantedName: "" } } },
    ]);
    const mark = person("Mark", [{ id: "wn", type: "gear", name: "White noise", system: { quantity: 1, surveillance: { kind: "whiteNoise", rating: 2, active: true, plantedOn: "", plantedName: "" } } }]);
    assert.equal(await spy.plantBug("bug", mark.uuid), true);
    assert.equal(spy.items.get("bug").system.surveillance.plantedOn, mark.uuid);
    faces.push(6, 1, 6, 2, 1, 1);
    const r = await spy.listenIn("bug");
    assert.equal(r.targetNumber, 6);                       // 4 + white noise 2
    assert.match(chat.at(-1).content, /Most of what is said/);
    mark.items.push({ id: "jam", type: "gear", name: "Jammer", system: { surveillance: { kind: "commJammer", rating: 4, active: true } } });
    assert.equal(await spy.listenIn("bug"), null);
    assert.match(chat.at(-1).content, /only static/);
    g.game.actors = [spy, mark];
    g.game.scenes = [];
    faces.push(5, 1, 1, 1, 1);
    const found = await spy.sweepForBugs("sc", mark.uuid);
    assert.deepEqual(found, ["Bug"]);
    assert.ok(chat.some((m: any) => /data-sr2e-action="removeBug"/.test(m.content)));
    assert.equal(await SR2Actor.removeBug(spy.items.get("bug").uuid), true);
    assert.equal(spy.items.get("bug").system.surveillance.plantedOn, "");
    delete g.game.scenes;
  });

  test("legality: unlicensed gear is listed with its fine, a permit covers it, search cards note it", () => {
    const a = person("Courier", [
      { id: "w", type: "weapon", name: "Assault rifle", system: { legality: "restricted", permit: false } },
      { id: "p", type: "weapon", name: "Hold-out", system: { legality: "permit", permit: true } },
      { id: "x", type: "gear", name: "Smart frame", system: { legality: "forbidden", permit: false } },
    ]);
    const l = a.legalProblems();
    assert.deepEqual(l.problems.map((p: any) => p.name), ["Assault rifle", "Smart frame"]);
    assert.equal(l.totalFine, 30000);
    const notes = a.legalNotes(["Hold-out", "Assault rifle"]);
    assert.match(notes[0], /permit/);
    assert.match(notes[1], /fine ¥5,000/);
  });

  test("Karma awards with the breakdown: team rows for all, individual rows each", async () => {
    chat.length = 0;
    const a = person("One");
    const b = person("Two");
    a.awardKarma = async (n: number, why: string) => { a.got = [n, why]; return { good: n, pool: 0 }; };
    b.awardKarma = async (n: number, why: string) => { b.got = [n, why]; return { good: n, pool: 0 }; };
    const n = await SR2Actor.awardBreakdown({ team: { survival: 1, objectives: 2, threat: 9 }, individual: { [a.uuid]: { roleplaying: true, courage: true }, [b.uuid]: {} }, reason: "The run" });
    assert.equal(n, 2);
    assert.equal(a.got[0], 1 + 2 + 3 + 1 + 1);               // threat capped at 3
    assert.equal(b.got[0], 6);
    assert.match(a.got[1], /The run: .*Good roleplaying \+1/);
    assert.match(chat.at(-1).content, /Karma awarded: The run/);
  });

  test("Notoriety comes off Street Cred; recognition rolls Intelligence vs 10 − Public Awareness", async () => {
    chat.length = 0;
    const a = person("Famous", [], { reputation: { streetCred: 4, notoriety: 1, publicAwareness: 4 } });
    const was = R.STREET.reputation.autoCred;
    R.STREET.reputation.autoCred = false;
    a.system.prepareDerivedData();
    assert.equal(a.system.derived.streetCred, 3);
    R.STREET.reputation.autoCred = was;
    const fan = person("Fan");
    faces.push(6, 1, 1, 1, 1, 1, 1);  // Int 6 vs TN 6
    const who = await a.recognitionCheck([fan.uuid]);
    assert.deepEqual(who, ["Fan"]);
    assert.match(chat.at(-1).content, /Intelligence vs TN 6/);
  });

  test("worn vision gear gives low-light, flare compensation and magnification", () => {
    const a = person("Goggles", [{ id: "g", type: "gear", name: "Goggles", system: { quantity: 1, optics: { worn: true, lowLight: true, thermographic: false, flareComp: true, magnification: 2 } } }]);
    assert.equal(a.system.derived.vision.lowLight, true);
    assert.equal(a.system.derived.cyber.flareComp, true);
    assert.equal(a.system.derived.cyber.magnification, 2);
    a.items.get("g").system.optics.worn = false;
    a.system.prepareDerivedData();
    assert.equal(a.system.derived.vision.lowLight, false);
  });
});

describe("v0.58.0 invisible and astral tokens", () => {
  const D = { body: 4, quickness: 5, strength: 3, charisma: 3, intelligence: 6, willpower: 5 };
  before(() => {
    g.fromUuidSync = (u: string) => uuidRegistry.get(u) ?? null;
    g.game.users = Object.assign([{ id: "gm1", isGM: true, isSelf: true }], { activeGM: { isSelf: true } });
    g.game.user = { isGM: true, id: "gm1" };
  });
  after(() => { g.game.users = [{ id: "gm1", isGM: true }]; delete g.game.actors; delete g.game.scenes; });
  const mage = (astral: string, sustaining: any[] = []) => {
    const a = makeActor(D, { magic: 6, tradition: "hermetic", astral, sustaining, poolSpent: { combat: 0, spell: 0 } });
    a.type = "character"; a.name = "Mage"; a.items = [];
    a.system.parent = a; a.system.prepareDerivedData();
    a.statuses = new Set<string>();
    a.toggleStatusEffect = async (id: string, o: { active: boolean }) => { if (o.active) a.statuses.add(id); else a.statuses.delete(id); };
    uuidRegistry.set(a.uuid, a);
    return a;
  };

  test("an astral perceiver's token gets see-invisibility; it goes again when they stop", async () => {
    const { visionUpdate } = await import("../applications/tokens.ts");
    const a = mage("perceiving");
    const u: any = visionUpdate(a, { sight: { enabled: true, visionMode: "basic", range: 0 }, detectionModes: { lightPerception: { enabled: true, range: null } } });
    assert.deepEqual(u["detectionModes.seeInvisibility"], { enabled: true, range: 10000 });
    assert.equal(u["flags.sr2e.autoSeeInvisible"], true);
    a.system.astral = "physical"; a.system.prepareDerivedData();
    const off: any = visionUpdate(a, { sight: { enabled: true, visionMode: "basic", range: 0 }, detectionModes: { seeInvisibility: { enabled: true, range: 10000 } }, flags: { sr2e: { autoSeeInvisible: true } } });
    assert.equal(off["detectionModes.seeInvisibility.enabled"], false);
    // One the GM gave by hand stays.
    assert.equal(visionUpdate(a, { sight: { enabled: true, visionMode: "basic", range: 0 }, detectionModes: { seeInvisibility: { enabled: true, range: 10000 } } }), null);
  });

  test("projecting or an invisibility spell makes the actor invisible on the map; it comes off when it ends", async () => {
    const { syncInvisibility } = await import("../applications/tokens.ts");
    const a = mage("projecting");
    assert.equal(await syncInvisibility(a), true);
    assert.equal(a.statuses.has("invisible"), true);
    a.system.astral = "physical"; a.system.prepareDerivedData();
    assert.equal(await syncInvisibility(a), true);
    assert.equal(a.statuses.has("invisible"), false);
    g.game.actors = [a];
    a.system.sustaining = [{ spellName: "Invisibility", force: 4, successes: 2, targetUuids: [] }];
    assert.equal(await syncInvisibility(a), true);
    assert.equal(a.statuses.has("invisible"), true);
    // An invisible status the GM set by hand is left alone.
    const b = mage("physical");
    b.statuses.add("invisible");
    assert.equal(await syncInvisibility(b), false);
    assert.equal(b.statuses.has("invisible"), true);
  });
});

describe("v0.60.0 Foundry quality of life (glue)", () => {
  test("roll privacy per kind of test: the user's group mode wins; answered cards stay public", async () => {
    const { withRollMode } = await import("../documents/index.ts");
    const prevSettings = g.game.settings;
    g.game.settings = { get: (s: string, k: string) => (s === "core" && k === "messageMode" ? "public" : s === "sr2e" && k === "rollPrivacy" ? { magic: "blind", matrix: "self" } : undefined) };
    const seen: string[] = [];
    g.ChatMessage.applyMode = (d: any, mode: string) => { seen.push(mode); d.whisper = ["gm1"]; d.blind = mode === "blind"; return d; };
    try {
      const spell = withRollMode({ content: "<p>Fireball</p>", flags: { sr2e: { test: { kind: "spell" } } } });
      assert.equal(spell.blind, true);
      assert.deepEqual(spell.whisper, ["gm1"]);
      assert.equal(withRollMode({ content: "<p>x</p>", flags: { sr2e: { test: { kind: "attack" } } } }).whisper, undefined);
      withRollMode({ content: "<p>x</p>", flags: { sr2e: { test: { kind: "system" } } } });
      assert.deepEqual(seen, ["blind", "self"]);
      // A spell card someone must resist stays public whatever the setting.
      assert.equal(withRollMode({ content: '<button data-sr2e-action="resistSpell">Resist</button>', flags: { sr2e: { test: { kind: "spell" } } } }).whisper, undefined);
      // Foundry v12's applyRollMode gets the old name.
      delete g.ChatMessage.applyMode;
      g.game.settings = { get: (s: string, k: string) => (s === "core" && k === "rollMode" ? "publicroll" : s === "sr2e" && k === "rollPrivacy" ? { magic: "gm" } : undefined) };
      g.ChatMessage.applyRollMode = (d: any, mode: string) => ({ ...d, mode });
      assert.equal(withRollMode({ content: "<p>x</p>", flags: { sr2e: { test: { kind: "spell" } } } }).mode, "gmroll");
    } finally { g.game.settings = prevSettings; delete g.ChatMessage.applyMode; delete g.ChatMessage.applyRollMode; }
  });

  test("NPC auto-resist: only for NPCs, only with the setting, never for blasts or re-scored cards", async () => {
    const { autoResistPlanned } = await import("../applications/chat.ts");
    const prevSettings = g.game.settings, prevUsers = g.game.users;
    let on = true;
    g.game.settings = { get: (s: string, k: string) => (s === "sr2e" && k === "autoResistNpc" ? on : undefined) };
    const player = { id: "p1", isGM: false, active: true };
    g.game.users = [player, { id: "gm", isGM: true, active: true }];
    const npc = { testUserPermission: () => false };
    const pc = { testUserPermission: (u: any) => u.id === "p1" };
    const msg = (content: string, flags: any = {}) => ({ content, getFlag: (_s: string, k: string) => flags[k] });
    try {
      const card = msg('<button data-sr2e-action="resist">Resist</button>');
      assert.equal(autoResistPlanned(card, "resist", 0, npc), true);
      assert.equal(autoResistPlanned(card, "resist", 0, pc), false);
      player.active = false;
      assert.equal(autoResistPlanned(card, "resist", 0, pc), true);      // nobody is there to roll for it
      player.active = true;
      assert.equal(autoResistPlanned(msg('<button data-sr2e-action="resist"></button>', { resisted: [0] }), "resist", 0, npc), false);
      assert.equal(autoResistPlanned(msg('<button data-sr2e-action="resist"></button><button data-sr2e-action="combineBlast"></button>'), "resist", 0, npc), false);
      assert.equal(autoResistPlanned(msg('<button data-sr2e-action="resist"></button>', { retargetOf: "m0" }), "resist", 0, npc), false);
      assert.equal(autoResistPlanned(msg('<button data-sr2e-action="resistSpell"></button>', { spellResisted: [1] }), "resistSpell", 0, npc), true);
      assert.equal(autoResistPlanned(msg('<button data-sr2e-action="resistSpell"></button>', { spellResisted: [0] }), "resistSpell", 0, npc), false);
      on = false;
      assert.equal(autoResistPlanned(card, "resist", 0, npc), false);
    } finally { g.game.settings = prevSettings; g.game.users = prevUsers; }
  });

  test("token bars: Matrix monitor for people, condition for vehicles", async () => {
    const { configureTokens } = await import("../applications/tokens.ts");
    const prevCfg = g.CONFIG;
    g.CONFIG = { Actor: {}, statusEffects: [] };
    try {
      configureTokens();
      assert.ok(g.CONFIG.Actor.trackableAttributes.character.bar.includes("derived.bars.matrix"));
      assert.deepEqual(g.CONFIG.Actor.trackableAttributes.vehicle.bar, ["derived.bars.condition"]);
      assert.ok(g.CONFIG.Actor.trackableAttributes.npc.value.includes("derived.combatPoolLeft"));
    } finally { g.CONFIG = prevCfg; }
  });
});

describe("v0.61.0 rules gaps (glue)", () => {
  const withGame = async (patch: any, fn: () => Promise<void> | void) => {
    const prev = { ...g.game };
    Object.assign(g.game, patch);
    try { await fn(); } finally { for (const k of Object.keys(g.game)) if (!(k in prev)) delete g.game[k]; Object.assign(g.game, prev); }
  };
  const actorWith = (items: any[], extra: any = {}) => {
    const a = makeActor(A, extra);
    a.items = items;
    a.system.parent = a;
    a.name = extra.name ?? "Tester";
    a.system.prepareDerivedData();
    uuidRegistry.set(a.uuid, a);
    return a;
  };

  test("gear and cyberware help a named skill: dice and TN on the test", async () => {
    const a = actorWith([
      { id: "sk", type: "skill", name: "Athletics", system: { rating: 3, attribute: "quickness", kind: "active" } },
      { id: "cg", type: "gear", name: "Climbing gear", system: { quantity: 1, skillMods: [{ skill: "Athletics", dice: 2, tn: 0 }] } },
      { id: "rr", type: "cyberware", name: "Balance tail", system: { installed: true, skillMods: [{ skill: "athletics", dice: 0, tn: -1 }] } },
    ]);
    faces.push(1, 1, 1, 1, 1);
    const r = await a.helpRoll("Athletics", 4, []);
    assert.equal(r.totalDice, 5);                                          // 3 + climbing gear 2
    assert.ok(r.modifiers.some((m: any) => m.label === "Balance tail" && m.value === -1));
    // Broken gear helps no more.
    a.items[1].system.damaged = true; a.system.prepareDerivedData();
    faces.push(1, 1, 1);
    assert.equal((await a.helpRoll("Athletics", 4, [])).totalDice, 3);
  });

  test("cyberears lower hearing TNs; a damper stops being deafened", async () => {
    const a = actorWith([{ id: "e", type: "cyberware", name: "Cyberears", system: { installed: true, kind: "ears", hearingAmp: 2, dampener: true } }]);
    const mods = a.noticeModifiers({ sense: "hearing" });
    assert.ok(mods.some((m: any) => m.value === 2 * RULES.COMBAT_V61.hearing.ampPerRating), JSON.stringify(mods));
    let toggled = false;
    a.toggleStatusEffect = async () => { toggled = true; };
    await a.setTimedStatus("deaf", 30);
    assert.equal(toggled, false);
  });

  test("fire immunity stops fire damage; a drug-immune critter feels no drug", async () => {
    chat.length = 0;
    const c = actorWith([{ id: "p", type: "power", name: "Immunity to fire", system: { special: "immunity", substance: "fire" } }], { name: "Salamander" });
    await c.resistFromState({ targetUuid: c.uuid, melee: false, damageType: "physical", power: 8, level: "S", fire: true });
    assert.match(chat.at(-1).content, /immune to fire/);
    assert.equal(c.system.monitor.physical, 0);
  });

  test("drugs: effects beyond attributes reach armor and wound modifiers", () => {
    const a = actorWith([], { monitor: { physical: 3, stun: 0 }, drugs: [{ name: "Painkiller", attributes: {}, reaction: 0, initiativeDice: 0, extra: { ballistic: 1, impact: 0, testsTn: 0, perceivedTn: 0, attackedTn: 0, movementFactor: 1, ignoreWounds: true, stunIgnoreBoxes: 0 }, round: -1, worldTime: -1 }] });
    assert.equal(a.system.derived.woundModifier, 0);
    assert.equal(a.system.derived.effectArmor.ballistic, 1);
  });

  test("a stun baton spends charges; out of charge it hits as a club", () => {
    const a = actorWith([]);
    const baton = { id: "b", name: "Stun baton", system: { melee: true, reach: 1, damagePower: 6, damageLevel: "S", damageType: "stun", stunWeapon: true, ammo: 0, ammoMax: 10, skill: "Clubs", modes: "" } };
    const plan = a.planAttack(baton, {});
    assert.ok(plan.notes.some((n: string) => /club/i.test(n)), plan.notes.join(";"));
    assert.ok(!plan.notes.includes("stun weapon"));
    const charged = a.planAttack({ ...baton, system: { ...baton.system, ammo: 3 } }, {});
    assert.ok(charged.notes.includes("stun weapon"));
  });

  test("a grenade launcher fired inside its arming range is a dud", () => {
    const a = actorWith([]);
    const gl = { id: "g", name: "Grenade launcher", system: { skill: "Launch Weapons", damagePower: 10, damageLevel: "S", modes: "SA", ammo: 6, ammoMax: 6, blast: true, blastKind: "offensive", blastPerMetre: 1, minRange: 5, range: { short: 50, medium: 100, long: 150, extreme: 300 } } };
    assert.equal(a.planAttack(gl, { measuredMetres: 3, range: "short" }).blastExtras.dud, true);
    assert.equal(a.planAttack(gl, { measuredMetres: 12, range: "short" }).blastExtras.dud, undefined);
  });

  test("slow toxins: the card carries the onset; due ones are announced once", async () => {
    await withGame({ time: { worldTime: 1000 }, messages: { contents: [] } }, async () => {
      chat.length = 0;
      const a = actorWith([], { name: "Poisoner" });
      const v = actorWith([], { name: "Victim" });
      g.fromUuidSync = (u: string) => uuidRegistry.get(u) ?? { name: u };
      await a.exposeToxinState({ name: "Narcoject", vector: "injection", power: 6, level: "S", damageType: "stun", kind: "toxin", from: "dart", needsWound: false, speed: "minute" }, [v.uuid], "Dart");
      const card = chat.at(-1);
      assert.equal(card.flags.sr2e.toxinOnset.at, 1060);
      assert.equal(card.flags.sr2e.toxins[0].onsetAt, 1060);
      assert.match(card.content, /minute/);
      const flags: any = { ...card.flags.sr2e };
      const msg = { getFlag: (_s: string, k: string) => flags[k], setFlag: async (_s: string, k: string, val: any) => { flags[k] = val; } };
      g.game.messages = { contents: [msg] };
      await SR2Actor.toxinOnsetTick(1030);
      assert.equal(flags.toxinOnset.announced, false);
      await SR2Actor.toxinOnsetTick(1060);
      assert.equal(flags.toxinOnset.announced, true);
      assert.match(chat.at(-1).content, /Narcoject takes effect now/);
      const n = chat.length;
      await SR2Actor.toxinOnsetTick(1100);
      assert.equal(chat.length, n);
      g.fromUuidSync = (u: string) => ({ name: u });
    });
  });

  test("DocWagon: the biomonitor's card, and the team stabilises and bills", async () => {
    await withGame({ time: { worldTime: 0 }, user: { isGM: true }, users: [] }, async () => {
      chat.length = 0;
      const a = actorWith([], { name: "Runner", nuyen: 50000, docwagon: { tier: "gold", paidUntil: 10_000_000, resuscitationsUsed: 0 }, care: { stabilised: false, dyingSince: -1 }, monitor: { physical: 10, stun: 0 } });
      assert.equal(a.system.derived.status, "dying");
      await a.callDocwagon({ auto: true });
      assert.match(chat.at(-1).content, /biomonitor alert/);
      assert.match(chat.at(-1).content, /docwagonArrive/);
      await SR2Actor.docwagonArrive(a.uuid, false);
      assert.equal(a.system.care.stabilised, true);
      assert.match(chat.at(-1).content, /stabilised/);
      // A lapsed contract: no one comes.
      a.system.docwagon.paidUntil = -1;
      await a.callDocwagon({ auto: true });
      assert.match(chat.at(-1).content, /lapsed/);
    });
  });

  test("a licence covers what it names; legality notes say so", () => {
    const a = actorWith([
      { id: "w", type: "weapon", name: "Heavy pistol", system: { legality: "permit", permit: false } },
      { id: "l", type: "gear", name: "Firearms licence", system: { quantity: 1, identity: { kind: "licence", rating: 4, fake: true, covers: "permit" } } },
    ]);
    const lp = a.legalProblems();
    assert.equal(lp.problems.length, 0);
    assert.deepEqual(lp.covered, [{ name: "Heavy pistol", by: "Firearms licence", fake: true }]);
    assert.match(a.legalNotes(["Heavy pistol"])[0], /licensed \(Firearms licence, fake/);
  });

  test("an Owl shaman takes the daylight TN; a Bear's berserk follows its name", async () => {
    await withGame({ time: { worldTime: 12 * 3600 } }, async () => {
      const owl = actorWith([], { tradition: "shamanic", totem: { name: "Owl", berserk: "", daylightTn: -1 } });
      faces.push(1, 1, 1, 1, 1, 1);
      const r = await owl.helpRoll("Perception", 4, []);
      assert.ok(r.modifiers.some((m: any) => m.label === "Totem: daylight"), JSON.stringify(r.modifiers));
      const bear = actorWith([], { tradition: "shamanic", totem: { name: "Bear", berserk: "", daylightTn: -1 } });
      assert.equal(bear.totemDrawbacks().berserk, "wounded");
      const tamed = actorWith([], { tradition: "shamanic", totem: { name: "Bear", berserk: "none", daylightTn: -1 } });
      assert.equal(tamed.totemDrawbacks().berserk, "");
      const mage = actorWith([], { tradition: "hermetic", totem: { name: "Bear", berserk: "", daylightTn: -1 } });
      assert.equal(mage.totemDrawbacks().berserk, "");
    });
  });

  test("an exclusive spell being sustained blocks other tests only with the house rule", async () => {
    const a = actorWith([], { sustaining: [{ spellName: "Shapechange", force: 4, category: "manipulation", focusId: "", successes: 2, quickened: false, spiritUuid: "", until: -1, targetUuids: [], exclusive: true }] });
    assert.equal(a.canAct("attack"), true);
    (RULES.MAGIC_V61.exclusive as any).blocksAllTests = true;
    try { assert.equal(a.canAct("attack"), false); } finally { (RULES.MAGIC_V61.exclusive as any).blocksAllTests = false; }
  });

  test("magical links on a target lead back to the caster and the summoner", () => {
    const mage = actorWith([], { name: "Mage" });
    const t = actorWith([], { name: "Mark" });
    mage.system.sustaining = [{ spellName: "Detect Enemies", force: 3, targetUuids: [t.uuid] }];
    const prevTick = SR2Actor.tickActors;
    SR2Actor.tickActors = () => [mage, t];
    try {
      const links = SR2Actor.magicalLinksOn(t);
      assert.equal(links.length, 1);
      assert.equal(links[0].actorName, "Mage");
      assert.equal(links[0].link, "spell");
    } finally { SR2Actor.tickActors = prevTick; }
  });

  test("a sheaf step launches its IC once; a reset tally launches it again", async () => {
    const { HostDataModel } = await import("../models/index.ts");
    const made: any[] = [];
    const prevImpl = g.Actor.implementation;
    g.Actor.implementation = { create: async (d: any) => { made.push(d); return { uuid: `Actor.ic${made.length}` }; } };
    try {
      await withGame({ user: { isGM: true, can: () => true }, users: [] }, async () => {
        const h = new SR2Actor();
        const sys = Object.create(HostDataModel.prototype);
        Object.assign(sys, { securityCode: "orange", securityValue: 5, subsystems: { access: 5, control: 5, index: 5, files: 5, slave: 5 }, tally: 0, alert: "none", tallies: [], launchedSteps: [],
          sheaf: [{ step: 3, event: "Killer-6 IC", alert: "" }, { step: 6, event: "Passive alert", alert: "passive", ic: { icType: "Blaster", category: "", rating: 0, behavior: "", damageLevel: "S", copies: 2 } }] });
        sys.prepareDerivedData();
        Object.assign(h, { type: "host", name: "Test host", uuid: "Actor.hostIc", system: sys, isOwner: true });
        uuidRegistry.set(h.uuid, h);
        const prevPer = RULES.MATRIX_V57.tally.perDecker;
        (RULES.MATRIX_V57.tally as any).perDecker = false;
        try {
          const html = await SR2Actor.applyTallyCard(h.uuid, 7);
          assert.match(String(html), /IC launched: Killer-6 \(Test host\), Blaster-5 \(Test host\) ×2/);
          assert.deepEqual(made.map((d) => d.name), ["Killer-6 (Test host)", "Blaster-5 (Test host) #1", "Blaster-5 (Test host) #2"]);
          assert.deepEqual(h.system.launchedSteps, [3, 6]);
          await h.update({ "system.tally": 0 });
          await SR2Actor.applyTallyCard(h.uuid, 4);
          assert.equal(made.length, 3);                                    // already launched
          await h.update({ "system.tally": 0, "system.launchedSteps": [] });
          await SR2Actor.applyTallyCard(h.uuid, 4);
          assert.equal(made.length, 4);
        } finally { (RULES.MATRIX_V57.tally as any).perDecker = prevPer; }
      });
    } finally { g.Actor.implementation = prevImpl; }
  });

  test("a gas device on lockdown exposes the people in the regions it watches", async () => {
    const { SiteDataModel } = await import("../models/index.ts");
    chat.length = 0;
    const victim = actorWith([], { name: "Intruder" });
    victim.type = "character";
    const tok = { x: 100, y: 100, width: 1, height: 1, center: { x: 150, y: 150 }, document: { x: 100, y: 100, width: 1, height: 1, elevation: 0 }, actor: victim };
    const devTok = { x: 100, y: 100, width: 1, height: 1 };
    const prev = { canvas: g.canvas, fromUuidSync: g.fromUuidSync };
    const room = { flags: { sr2e: { env: { siteUuid: "Actor.site1", deviceId: "g1" } } }, testPoint: () => true };
    g.canvas = { scene: { id: "sc1", regions: [room], grid: { size: 100 }, tokens: [] }, tokens: { placeables: [tok] }, grid: { size: 100 }, dimensions: { distance: 1, size: 100 } };
    g.fromUuidSync = (u: string) => (u === "Scene.sc1.Token.dev" ? devTok : uuidRegistry.get(u) ?? { name: u });
    try {
      await withGame({ scenes: { get: () => g.canvas.scene }, user: { isGM: true }, users: [] }, async () => {
        const site = new SR2Actor();
        const sys = Object.create(SiteDataModel.prototype);
        Object.assign(sys, { devices: [{ id: "g1", name: "Ceiling vent", kind: "gas", rating: 0, tokenUuid: "Scene.sc1.Token.dev", sceneId: "sc1", wallId: "", active: true, bypassed: false, toxin: { name: "", power: 0, level: "S", damageType: "stun", vector: "inhalation", speed: "immediate" }, radius: 0 }],
          guards: [], tally: 0, alert: "none", steps: [{ step: 1, event: "Lockdown", alert: "lockdown" }], response: { round: -1, worldTime: -1, arrived: false, force: "" }, riggerUuid: "", slaved: [], hostUuid: "" });
        sys.prepareDerivedData?.();
        Object.assign(site, { type: "site", name: "Lab", uuid: "Actor.site1", system: sys, isOwner: true });
        uuidRegistry.set(site.uuid, site);
        const prevCloud = RULES.SECURITY_V61.gas.cloud;
        (RULES.SECURITY_V61.gas as any).cloud = "";
        try { await SR2Actor.applySiteChange(site.uuid, { minAlert: "lockdown" }); } finally { (RULES.SECURITY_V61.gas as any).cloud = prevCloud; }
        const card = chat.find((m) => m.flags?.sr2e?.toxins);
        assert.ok(card, chat.map((m) => m.content).join(" | "));
        assert.equal(card.flags.sr2e.toxins[0].targetUuid, victim.uuid);
        assert.equal(card.flags.sr2e.toxins[0].name, RULES.SECURITY_V61.gas.defaultToxin.name);
      });
    } finally { g.canvas = prev.canvas; g.fromUuidSync = prev.fromUuidSync; }
  });

  test("review: a forged Apply (GM) heal card can't add damage; a real one heals", async () => {
    await withGame({ user: { isGM: true }, users: [], messages: { contents: [] } }, async () => {
      chat.length = 0;
      const healer = actorWith([], { name: "Doc" });
      const victim = actorWith([], { name: "Victim", monitor: { physical: 2, stun: 0 } });
      const forged = { kind: "heal", successes: 0, rerolls: 0, heal: { targetUuid: victim.uuid, targetName: "Victim", track: "physical", before: 10, after: 2, mode: "magic" } };
      assert.equal(await SR2Actor.applyHealAsGm(healer.uuid, forged), false);
      assert.equal(victim.system.monitor.physical, 2);
      assert.match(chat.at(-1).content, /not applied/);
      const real = { kind: "heal", successes: 2, rerolls: 0, heal: { targetUuid: victim.uuid, targetName: "Victim", track: "physical", before: 2, mode: "magic" } };
      assert.equal(await SR2Actor.applyHealAsGm(healer.uuid, real), true);
      assert.ok(victim.system.monitor.physical < 2);
    });
  });

  test("review: a lifestyle bought outright needs the cash (else by the month, with a warning)", async () => {
    await withGame({ time: { worldTime: 0 } }, async () => {
      warnings.length = 0;
      const a = actorWith([], { name: "Newbie", nuyen: 0, contacts: [], lifestyle: { level: "low", paidUntil: -1 }, metatype: "human" });
      a.applyBuildItems = async () => ({ skills: 0, gear: 0 });
      const r = await a.applyBuild({ priorities: { resources: "E" }, magic: "none", gearCost: 0, skills: [], gear: [], outright: true });
      assert.ok(warnings.some((w) => /outright/.test(w)), warnings.join("|"));
      assert.ok(a.system.lifestyle.paidUntil < 100 * RULES.UPKEEP.monthDays * 86400);
      assert.ok(r.nuyen >= 0);
    });
  });

  test("invisibility: an observer who saw through it, or perceives astrally, isn't fooled", () => {
    const caster = actorWith([], { name: "Ghost" });
    caster.system.sustaining = [{ spellName: "Invisibility", force: 4, successes: 3, targetUuids: [] }];
    const prevTick = SR2Actor.tickActors;
    SR2Actor.tickActors = () => [caster];
    try {
      const obs = actorWith([], { name: "Guard" });
      const list = caster.concealmentOf();
      assert.equal(list[0].kind, "invisibility");
      assert.equal(caster.concealmentFor(obs).length, 1);
      assert.ok(!String(list[0].key).includes("."));                       // a flag key: no dots
      obs.flags = { sr2e: { seenThrough: { [list[0].key]: true } } };
      assert.equal(caster.concealmentFor(obs).length, 0);
      const astral = actorWith([], { name: "Seer" });
      astral.isAstral = () => true;
      assert.equal(caster.concealmentFor(astral).length, 0);
    } finally { SR2Actor.tickActors = prevTick; }
  });
});


describe("v0.65.0 things that take time wait for it", () => {
  const M = { body: 4, quickness: 4, strength: 4, charisma: 5, intelligence: 5, willpower: 6 };
  const withGet = (list: any[]) => Object.assign(list, { get(id: string) { return list.find((i: any) => i.id === id); } });
  const who = (extra: any = {}, items: any[] = []) => {
    const a = makeActor(M, { magic: 0, karma: { pool: 0, poolSpent: 0, good: 30 }, metamagic: {}, initiateGrade: 0, nuyen: 1000, sustaining: [], drugs: [], geasa: [], ledger: [], recovering: [], training: [],
      poolSpent: { combat: 0, spell: 0, hacking: 0, control: 0 }, ...extra });
    a.name = extra.name ?? "Runner"; a.type = extra.type ?? "character"; (a as any).id = `id-${a.uuid}`;
    a.items = withGet(items.map((it) => ({ ...it, async update(d: any) { for (const [k, v] of Object.entries(d)) setPath(this, k, v); a.system.prepareDerivedData(); }, toObject() { return JSON.parse(JSON.stringify({ name: it.name, type: it.type, system: this.system })); }, async delete() { const i = a.items.indexOf(this); if (i >= 0) a.items.splice(i, 1); } })));
    const create = a.createEmbeddedDocuments.bind(a);
    a.createEmbeddedDocuments = async (t: string, docs: any[]) => { const out = await create(t, docs); for (const it of a.items) { it.update ??= async function (this: any, d: any) { for (const [k, v] of Object.entries(d)) setPath(this, k, v); }; it.toObject ??= function (this: any) { return JSON.parse(JSON.stringify({ name: this.name, type: this.type, system: this.system })); }; it.delete ??= async function (this: any) { const i = a.items.indexOf(this); if (i >= 0) a.items.splice(i, 1); }; } return out; };
    a.system.parent = a; a.system.prepareDerivedData();
    uuidRegistry.set(a.uuid, a);
    return a;
  };
  const skill = (id: string, name: string, rating: number, attribute = "willpower") => ({ id, type: "skill", name, system: { rating, attribute, kind: "active" } });
  before(() => {
    (RULES.WAITING as any).enabled = true;
    (RULES.CHARACTERS_V58.training as any).mode = "timed";
    g.game.user = { isGM: true, id: "gm1", name: "GM AI" };
    g.game.users = Object.assign([{ id: "gm1", isGM: true }], { activeGM: { id: "gm1", isSelf: true } });
    g.game.time = { worldTime: 0 };
    g.foundry.utils = { ...(g.foundry.utils ?? {}), deepClone: (o: any) => JSON.parse(JSON.stringify(o)), randomID: () => Math.random().toString(36).slice(2, 12), getProperty: (o: any, p: string) => p.split(".").reduce((x: any, k: string) => x?.[k], o) };
  });
  after(() => {
    (RULES.WAITING as any).enabled = false;
    (RULES.CHARACTERS_V58.training as any).mode = "instant";
  });

  test("learning a spell: the Karma now, the spell when the study days have passed; a re-roll retimes it", async () => {
    (RULES.MAGIC_V56.learning as any).enabled = true;
    (RULES.MAGIC_V56.learning as any).site = "off";
    try {
      chat.length = 0;
      const a = who({ magic: 6, tradition: "hermetic" }, [skill("sorc", "Sorcery", 4)]);
      faces.push(5, 5, 1, 1);                                   // 2 successes: Force 3 → 3 days ÷ 2 = 2 days (rounded up)
      assert.equal(await a.learnFormula("Light", { category: "illusion", learnedForce: 3 }), true);
      assert.ok(!a.items.some((i: any) => i.name === "Light"), "not known yet");
      assert.ok(a.system.karma.good < 30, "paid now");
      const [p] = a.projects();
      assert.equal(p.kind, "learn");
      assert.equal(p.area, "magic");
      assert.ok(p.hours > 0);
      assert.ok(chat.some((c: any) => /starts: Learning Light at Force 3/.test(c.content)));
      g.game.actors = [a];
      try {
        await SR2Actor.timedEffects({ worldTime: p.readyAt - 1, anyGm: true });
        assert.equal(a.projects().length, 1, "not yet");
        await SR2Actor.timedEffects({ worldTime: p.readyAt, anyGm: true });
      } finally { delete g.game.actors; }
      assert.equal(a.projects().length, 0);
      assert.equal(a.items.find((i: any) => i.name === "Light")?.system.learnedForce, 3);
      assert.ok(chat.some((c: any) => /Learning Light at Force 3 is done/.test(c.content)));
    } finally { (RULES.MAGIC_V56.learning as any).enabled = false; (RULES.MAGIC_V56.learning as any).site = "warn"; }
  });

  test("giving up gives back what was paid; the GM can change the time or finish it now", async () => {
    chat.length = 0;
    const a = who();
    const p = await a.startProject({ kind: "x", area: "magic", label: "Something", hours: 48, paid: { karma: 5, nuyen: 200 }, effect: { actor: [["system.initiateGrade", 1]] } });
    a.system.karma.good = 25; a.system.nuyen = 800;
    assert.equal(await a.setProjectTimeLeft(p.id, 3), true);
    assert.equal(a.projects()[0].readyAt, 3 * 3600);
    assert.equal(await a.cancelProject(p.id), true);
    assert.equal(a.system.karma.good, 30);
    assert.equal(a.system.nuyen, 1000);
    assert.equal(a.system.initiateGrade, 0);
    const q = await a.startProject({ kind: "x", area: "magic", label: "Initiation", hours: 168, effect: { actor: [["system.initiateGrade", 1]] } });
    g.game.user = { isGM: false, id: "p1", name: "Corvo" };
    assert.equal(await a.finishProject(q.id), false, "players can't");
    g.game.user = { isGM: true, id: "gm1", name: "GM AI" };
    assert.equal(await a.finishProject(q.id), true);
    assert.equal(a.system.initiateGrade, 1);
    assert.match(chat.at(-1).content, /done \(the GM finished it early\)/);
  });

  test("buying a found item: paid now, off the sheet until it arrives; giving up brings both back", async () => {
    const a = who({}, [{ id: "mk", type: "gear", name: "Medkit", system: { cost: 200, quantity: 1, availability: "4/48 hrs" } }]);
    assert.equal(await a.buyItem("mk", 200, 24), true);
    assert.equal(a.system.nuyen, 800);
    assert.ok(!a.items.some((i: any) => i.name === "Medkit"));
    const [p] = a.projects();
    assert.equal(p.hours, 24);
    assert.equal(p.paid.nuyen, 200);
    await a.cancelProject(p.id);
    assert.equal(a.system.nuyen, 1000);
    assert.ok(a.items.some((i: any) => i.name === "Medkit"));
    // Arrival.
    assert.equal(await a.buyItem(a.items.find((i: any) => i.name === "Medkit").id, 200, 24), true);
    const [p2] = a.projects();
    await a.finishProject(p2.id);
    assert.ok(a.items.some((i: any) => i.name === "Medkit"));
    assert.equal(a.system.nuyen, 800);
  });

  test("an NPC, or a character with waiting off, gets it at once", async () => {
    const npc = who({ type: "npc" }, [{ id: "mk", type: "gear", name: "Medkit", system: { cost: 200, quantity: 1 } }]);
    npc.type = "npc";
    assert.equal(npc.waitsFor("gear"), false);
    assert.equal(await npc.buyItem("mk", 200, 24), true);
    assert.ok(npc.items.some((i: any) => i.name === "Medkit"));
    const a = who();
    (RULES.WAITING.areas as any).repairs = false;
    try { assert.equal(a.waitsFor("repairs"), false); assert.equal(a.waitsFor("magic"), true); } finally { (RULES.WAITING.areas as any).repairs = true; }
  });

  test("training is timed by default; the GM can finish it now or change its time", async () => {
    const a = who({}, [skill("fa", "Firearms", 3, "quickness")]);
    assert.equal(await a.improve({ skillId: "fa" }), true);
    assert.equal(a.items.get("fa").system.rating, 3, "not yet");
    const t = a.system.training[0];
    assert.ok(t.readyAt > 0);
    assert.equal(await a.setProjectTimeLeft(t.id, 24), true);
    assert.equal(a.system.training[0].readyAt, 24 * 3600);
    assert.equal(await a.finishProject(t.id), true);
    assert.equal(a.items.get("fa").system.rating, 4);
    assert.equal(a.system.training.length, 0);
  });

  test("review fixes: a stack in use stays and the copies arrive beside it; arriving gear stacks; NPCs train at once; no second study", async () => {
    const a = who({}, [{ id: "ammo", type: "gear", name: "Ammo", system: { cost: 10, quantity: 50, availability: "2/24 hrs" } }]);
    assert.equal(await a.buyItem("ammo", 100, 12, 10), true);
    assert.equal(a.items.get("ammo").system.quantity, 50, "the stack stays");
    const [p] = a.projects();
    await a.finishProject(p.id);
    assert.equal(a.items.filter((i: any) => i.name === "Ammo").length, 1, "stacked, not a second row");
    assert.equal(a.items.get("ammo").system.quantity, 60);
    const npc = who({ type: "npc" }, [skill("fa", "Firearms", 3, "quickness")]);
    npc.type = "npc";
    assert.equal(await npc.improve({ skillId: "fa" }), true);
    assert.equal(npc.items.get("fa").system.rating, 4, "NPCs don't train");
    const m = who({ magic: 6, tradition: "hermetic" }, [skill("sorc", "Sorcery", 4), { id: "mb", type: "spell", name: "Mana Bolt", system: { learnedForce: 3 } }]);
    assert.equal(await m.raiseSpellForce(m.items.get("mb"), 4), true);
    const karma = m.system.karma.good;
    assert.equal(await m.raiseSpellForce(m.items.get("mb"), 5), false, "one study at a time");
    assert.equal(m.system.karma.good, karma);
  });

  test("review fixes: a re-roll with no successes gives the project up and pays back", async () => {
    const a = who();
    const p = await a.startProject({ kind: "design", area: "magic", label: "Designing X", hours: 24, paid: { karma: 4 }, effect: { call: { method: "finishDesign", args: ["X", {}, []] } } });
    a.system.karma.good = 26;
    assert.match(await a.dropProjectOnFailure(p.id), /given up/);
    assert.equal(a.projects().length, 0);
    assert.equal(a.system.karma.good, 30);
    assert.equal(await a.dropProjectOnFailure(p.id), "");
  });

  test("a gear repair waits for its hours; the item stays broken until then", async () => {
    const a = who({}, [skill("br", "Firearms B/R", 4, "intelligence"), { id: "gun", type: "weapon", name: "Pistol", system: { damaged: true, skill: "Firearms" } }]);
    const gun = a.items.get("gun");
    gun.uuid = `${a.uuid}.Item.gun`; gun.parent = a; gun.isOwner = true;
    uuidRegistry.set(gun.uuid, gun);
    faces.push(...Array(12).fill(5));
    const r = await a.repairGear("gun", { have: "shop" });
    assert.ok(r, `rolled: ${warnings.at(-1)}`);
    assert.equal(gun.system.damaged, true, "still broken while the work goes on");
    const [p] = a.projects();
    assert.equal(p.kind, "repair");
    await a.finishProject(p.id);
    assert.equal(gun.system.damaged, false);
  });
});

// v0.79.0 (ranged): the documents' fixes in the glue (RULES.DOCS_V79, rules/config79-ranged.ts).
describe("v0.79.0 ranged glue (DOCS_V79 ranged)", () => {
  const skill = { id: "s1", type: "skill", name: "Firearms", system: { rating: 2, attribute: "quickness" } };
  const flechetteGun = { name: "Predator", system: { melee: false, skill: "Firearms", damagePower: 9, damageLevel: "M", damageType: "physical", modes: "", ammoMax: 0, ammo: 0, recoilComp: 0, ammoType: "flechette" } };
  const shooter = () => { const a = makeActor(A); a.items = [skill]; (a.items as any).get = (id: string) => (id === "s1" ? skill : undefined); return a; };

  test("Combat Pool on an attack is at most the skill rolled (SRII p. 83)", async () => {
    chat.length = 0;
    faces.push(1, 1, 1, 1, 1, 1, 1);
    const r = await shooter().attackWith(flechetteGun, { range: "short", poolDice: 5 });
    assert.equal(r.totalDice, 4);                                    // skill 2 + pool 2 (5 asked)
    assert.match(chat.at(-1).content, /Combat Pool at most 2/);
    assert.equal(shooter().previewAttack(flechetteGun, { range: "short", poolDice: 5 }).pool, 2);
  });
  test("the old way: no cap", async (t) => {
    t.after(oldWay({ 'DOCS_V79.rangedPoolCap': 'none' }));
    chat.length = 0;
    faces.push(1, 1, 1, 1, 1, 1, 1);
    const r = await shooter().attackWith(flechetteGun, { range: "short", poolDice: 5 });
    assert.equal(r.totalDice, 7);
  });
  test("flechette: the level waits for the soak; +1 only vs no armor, vs armor the higher rating doubled (SRII p. 93)", async () => {
    const plan = shooter().planAttack(flechetteGun, { range: "short" });
    assert.equal(plan.level, "M");
    assert.equal(plan.extras.flechette, true);
    const hit = { targetUuid: "x", melee: false, damageType: "physical", power: 10, level: "M", armorMultiplier: 2, flechette: true } as any;
    const armored = makeActor(A);
    armored.items = [{ type: "armor", system: { worn: true, ballistic: 2, impact: 3 } }];
    chat.length = 0;
    faces.push(1, 1, 1, 1, 1);
    await armored.resistFromState(hit, 0);
    assert.match(chat.at(-1).content, /Resist 10M/);
    assert.match(chat.at(-1).content, /vs TN <strong>4<\/strong>/);  // 10 − impact 3 × 2
    chat.length = 0;
    faces.push(1, 1, 1, 1, 1);
    await makeActor(A).resistFromState(hit, 0);
    assert.match(chat.at(-1).content, /Resist 10S/);                 // no armor: +1 level
  });
  test("flechette, the old way: staged in the attack, armor kind × 2", (t) => {
    t.after(oldWay({ 'DOCS_V79.rangedFlechette.mode': 'always' }));
    const plan = shooter().planAttack(flechetteGun, { range: "short" });
    assert.equal(plan.level, "S");
    assert.equal(plan.extras.flechette, undefined);
  });
  test("recoil: two bursts in one phase are +3 and +6 (SRII table)", () => {
    const a = shooter();
    const bf = { name: "AK", system: { ...flechetteGun.system, ammoType: "standard", modes: "BF" } };
    assert.ok(a.planAttack(bf, { range: "short", mode: "BF", earlierRoundsThisPhase: 0 }).modifiers.some((m: any) => m.label === "Recoil" && m.value === 3));
    a.getFlag = () => ({ phase: "p", rounds: 3, firstSingle: false });
    a.currentPhaseKey = () => "p";
    assert.ok(a.planAttack(bf, { range: "short", mode: "BF" }).modifiers.some((m: any) => m.label === "Recoil" && m.value === 6));
  });
});

// v0.79.0 (health): the documents' first aid and healing stages in the glue (RULES.DOCS_V79, rules/config79-health.ts).
describe("v0.79.0 health glue (DOCS_V79 health)", () => {
  test("first aid: First Aid Table (no medkit +4, no kit dice), TN 4..10", async () => {
    chat.length = 0;
    const medic = makeActor(A);
    medic.items = [{ id: "s1", type: "skill", name: "Biotech", system: { rating: 4, attribute: "intelligence" } }];
    (medic.items as any).get = () => undefined;
    const patient = makeActor(A, { monitor: { physical: 3, stun: 0 } });
    uuidRegistry.set(patient.uuid, patient);
    faces.push(1, 1, 1, 1);
    await medic.firstAid(patient, { track: "physical" });
    assert.match(chat.at(-1).content, /No medkit/);
    assert.doesNotMatch(chat.at(-1).content, /Medkit \+\d/);
  });
});

// v0.79.0 review fixes.
describe("v0.79.0 review fixes", () => {
  test("self-recovery: the result follows the card, so a Karma re-roll corrects the gate", async () => {
    chat.length = 0; warnings.length = 0; faces.length = 0;
    const a = makeActor(A, { monitor: { physical: 4, stun: 0 }, karma: { pool: 3, poolSpent: 0, good: 0 } });
    uuidRegistry.set(a.uuid, a);
    faces.push(2, 2, 2, 2, 2);                                        // natural Body 5 vs 4: no successes
    assert.equal(await a.naturalHeal({ track: "physical", hours: 24, care: "none" }), null);
    assert.equal(a.getFlag("sr2e", "selfRecovery")?.ok, false);
    const card = chat.find((c) => /Self-recovery test/.test(c.content));
    assert.match(card.content, /Needs medical attention/);
    faces.push(5, 5, 5, 5, 5);
    await a.karmaReroll(card.flags.sr2e.test);
    assert.equal(a.getFlag("sr2e", "selfRecovery")?.ok, true);
  });

  test("a healing stage keeps its successes: the next rest adds hours without a new roll", async () => {
    chat.length = 0; faces.length = 0;
    const a = makeActor(A, { monitor: { physical: 4, stun: 0 } });
    uuidRegistry.set(a.uuid, a);
    await a.setFlag("sr2e", "selfRecovery", { boxes: 4, ok: true, t: 0 });
    faces.push(6, 1, 6, 1, 1, 1, 1);                                  // Moderate: TN 6; 6+1 = 7 and 6+1 = 7: 2 successes = 120 h
    await a.naturalHeal({ track: "physical", hours: 24, care: "none" });
    assert.equal(a.system.monitor.physical, 4);
    assert.equal(a.getFlag("sr2e", "healStage")?.successes, 2);
    const before = faces.length;
    await a.naturalHeal({ track: "physical", hours: 48, care: "none" });  // 72 of 120 h: no roll
    assert.equal(faces.length, before);
    assert.equal(a.getFlag("sr2e", "healStage")?.rested, 72);
    await a.naturalHeal({ track: "physical", hours: 48, care: "none" });  // 120 h: done
    assert.equal(a.system.monitor.physical, 1);                       // Moderate → the lowest Light box
    assert.equal(a.getFlag("sr2e", "healStage") ?? null, null);
  });
});
