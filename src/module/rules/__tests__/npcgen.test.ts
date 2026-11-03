import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  RULES, makeRng, weighted, generateNpc, statBlockText, npcActorData, generateGroup, generateOrg, generateJob, generateContact,
  generateSpirit, spiritActorData, generateCritter, critterActorData, generateNames, planHtml, ARCHETYPES, GROUP_KINDS, targetKind, jobWants, hostActorData, adeptPowerCost,
  vehicleActorData,
} from '../index.ts';

const ATTRS = ['body', 'quickness', 'strength', 'charisma', 'intelligence', 'willpower'] as const;
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

describe('v0.52.0 NPC generator: randomness', () => {
  test('the same seed rolls the same person; another seed another', () => {
    assert.deepEqual(generateNpc({ threat: 3 }, makeRng(7)), generateNpc({ threat: 3 }, makeRng(7)));
    assert.notDeepEqual(generateNpc({ threat: 3 }, makeRng(7)).name, generateNpc({ threat: 3 }, makeRng(8)).name);
  });
  test('changing only the Threat Level keeps the same person (name and looks)', () => {
    for (const archetype of ['mage', 'adept', 'ganger', 'elite']) {
      const a = generateNpc({ threat: 1, archetype }, makeRng(77));
      const b = generateNpc({ threat: 5, archetype }, makeRng(77));
      assert.equal(a.name, b.name, archetype);
    }
  });
  test('weighted picks follow the weights and skip zero', () => {
    const r = makeRng(1);
    const n: Record<string, number> = {};
    for (let i = 0; i < 2000; i++) { const k = weighted({ a: 3, b: 1, c: 0 }, r); n[k] = (n[k] ?? 0) + 1; }
    assert.equal(n['c'], undefined);
    assert.ok(n['a']! > 2 * n['b']!);
  });
});

describe('v0.52.0 NPC generator: Threat Level', () => {
  test('higher Threat Levels have better attributes, skills, gear and Professional Rating', () => {
    const avg = (t: number, f: (p: ReturnType<typeof generateNpc>) => number) => mean(Array.from({ length: 60 }, (_, i) => f(generateNpc({ threat: t, archetype: 'guard', metatype: 'human', magic: 'none' }, makeRng(100 + i)))));
    const attr = (p: any) => mean(ATTRS.map((k) => p.attributes[k]));
    const skill = (p: any) => mean(p.skills.filter((s: any) => s.kind === 'active').map((s: any) => s.rating));
    for (let t = 0; t < 5; t++) {
      assert.ok(avg(t + 1, attr) >= avg(t, attr), `attributes rise from ${t}`);
      assert.ok(avg(t + 1, skill) > avg(t, skill), `skills rise from ${t}`);
    }
    assert.equal(generateNpc({ threat: 5, archetype: 'guard' }, makeRng(1)).professionalRating, 4); // v0.73.0 (O35): PR 1–4 by Threat Level
    assert.ok(generateNpc({ threat: 5, archetype: 'guard', magic: 'none' }, makeRng(1)).weapons.includes('assaultRifle'));
    assert.deepEqual(generateNpc({ threat: 0, archetype: 'guard', magic: 'none' }, makeRng(1)).cyber, []);
  });
  test('values stay inside the limits; Threat Level is clamped', () => {
    for (let i = 0; i < 200; i++) {
      const p = generateNpc({ threat: i % 7 - 1 }, makeRng(i));
      assert.ok(p.threat >= 0 && p.threat <= 5);
      for (const k of ATTRS) assert.ok(p.attributes[k] >= 1 && p.attributes[k] <= RULES.NPCGEN.maxAttribute);
      for (const s of p.skills) assert.ok(s.rating >= 1 && s.rating <= RULES.NPCGEN.maxSkill);
    }
  });
  test('every archetype at Threat 5 keeps Essence above 0 (cyberware from the importer tables)', () => {
    for (const a of ARCHETYPES) for (let i = 0; i < 20; i++) {
      const d = npcActorData(generateNpc({ threat: 5, archetype: a.id, magic: 'none' }, makeRng(i)));
      const ess = d.items.filter((it) => it.type === 'cyberware').reduce((n, it) => n + Number(it.system['essenceCost'] ?? 0), 0);
      assert.ok(ess < 6, `${a.id} costs ${ess} Essence`);
    }
  });
  test('magicians keep their Essence: no cyberware but a datajack; spells and adept powers fit Magic', () => {
    for (let i = 0; i < 30; i++) {
      const m = generateNpc({ threat: 4, archetype: 'mage' }, makeRng(i));
      assert.equal(m.tradition, 'hermetic');
      assert.ok(m.magic >= 1 && m.spells.length >= 1);
      assert.deepEqual(m.cyber, []);
      const ad = generateNpc({ threat: 4, archetype: 'adept' }, makeRng(i));
      const items = npcActorData(ad).items.filter((it) => it.type === 'adeptpower');
      const cost = items.reduce((n, it) => n + Number(it.system['cost'] ?? 1), 0);
      assert.ok(cost <= ad.magic + 0.001, `adept powers ${cost} over Magic ${ad.magic}`);
    }
    assert.equal(generateNpc({ threat: 5, archetype: 'mage', magic: 'none' }, makeRng(3)).tradition, 'none');
    assert.notEqual(generateNpc({ threat: 2, archetype: 'guard', magic: 'yes' }, makeRng(3)).tradition, 'none');
  });
});

describe('v0.52.0 NPC generator: actor data', () => {
  test('a person becomes an npc with nested attributes, skills, template weapons and armor, and imported cyberware', () => {
    const p = generateNpc({ threat: 4, archetype: 'elite', metatype: 'ork', magic: 'none' }, makeRng(5));
    const d = npcActorData(p);
    assert.equal(d.actor.type, 'npc');
    assert.equal((d.actor.system['attributes'] as any).body.base, p.attributes.body);
    assert.equal(d.actor.system['metatype'], 'ork');
    assert.equal(d.actor.system['racialModifiers'], true);
    assert.equal(d.actor.prototypeToken['actorLink'], false);
    const types = new Set(d.items.map((i) => i.type));
    for (const t of ['skill', 'weapon', 'armor', 'cyberware']) assert.ok(types.has(t), t);
    const rifle = d.items.find((i) => i.name === 'Assault rifle')!;
    assert.equal(rifle.system['skill'], 'Firearms');
    assert.ok((rifle.system['range'] as any).short > 0);
    const spec = d.items.find((i) => i.type === 'skill' && i.system['specialization']);
    assert.ok(spec && Number(spec.system['specializationRating']) > Number(spec.system['rating']));
    assert.ok(d.items.every((i) => i.type !== 'skill' || ATTRS.includes(i.system['attribute'] as any)));
    assert.deepEqual(d.warnings, []);
  });
  test('a decker gets a deck and programs; a rigger a remote control deck', () => {
    const dk = npcActorData(generateNpc({ threat: 3, archetype: 'decker' }, makeRng(2)));
    assert.ok(dk.items.some((i) => i.type === 'cyberdeck'));
    assert.equal(dk.items.filter((i) => i.type === 'program').length, 2);
    const rg = generateNpc({ threat: 4, archetype: 'rigger' }, makeRng(2));
    assert.ok(rg.controlRig! >= 1);
    assert.ok(npcActorData(rg).items.some((i) => i.system['rcdRating']));
  });
  test('the stat block shows totals with racial modifiers and lists everything', () => {
    const p = generateNpc({ threat: 2, archetype: 'ganger', metatype: 'troll', magic: 'none' }, makeRng(9));
    const text = statBlockText(p);
    assert.match(text, /Troll, Threat Level 2/);
    const vals = text.split('\n')[2]!.trim().split(/\s+/).map(Number);
    assert.equal(vals[0], p.attributes.body + 5);
    assert.match(text, /Skills: Firearms/);
    assert.doesNotMatch(text, /undefined|NaN/);
  });
  test('critters: no metatype, their natural weapon and senses; racial modifiers off', () => {
    const c = generateCritter({ threat: 1, critter: 'dog' }, makeRng(1));
    assert.doesNotMatch(statBlockText(c), /Human/);
    const d = critterActorData(c);
    assert.equal(d.actor.system['racialModifiers'], false);
    assert.ok(d.items.some((i) => i.type === 'weapon' && i.name === 'Bite' && i.system['strengthPower']));
    assert.ok(d.items.some((i) => i.type === 'power'));
  });
});

describe('v0.52.0 NPC generator: groups, organisations, contacts, spirits, jobs, names', () => {
  test('groups: a tougher leader, rank and file on one sheet or each, specialists by Threat Level', () => {
    for (const gk of GROUP_KINDS) for (let t = 0; t <= 5; t++) {
      const g = generateGroup({ threat: t, groupKind: gk.id }, makeRng(t * 10 + 1));
      assert.ok(g.size >= 2 && g.size <= RULES.GRUNTS.maxSize, `${gk.id} ${t}: ${g.size}`);
      assert.equal(g.leader.threat, Math.min(5, t + 1));
      assert.equal(g.grunts.length, 1);
      assert.ok(g.grunts[0]!.grunts >= 1);
    }
    const each = generateGroup({ threat: 3, groupKind: 'security', oneSheet: false }, makeRng(4));
    assert.ok(each.grunts.length >= 1 && each.grunts.every((p) => p.grunts === 1));
    assert.ok(generateGroup({ threat: 4, groupKind: 'security' }, makeRng(4)).extras.some((e) => e.archetype === 'decker'));
    // Specialists come on top: the rank and file keeps at least two, even at Threat 5 with three specialists.
    for (let i = 0; i < 20; i++) { const g = generateGroup({ threat: 5, groupKind: 'security' }, makeRng(i)); assert.ok(g.grunts[0]!.grunts >= 2); assert.equal(g.size, g.grunts[0]!.grunts + 1 + g.extras.length); }
    assert.equal(npcActorData(generateGroup({ threat: 2, groupKind: 'gang' }, makeRng(1)).grunts[0]!).actor.prototypeToken['name'], generateGroup({ threat: 2, groupKind: 'gang' }, makeRng(1)).grunts[0]!.name);
    assert.ok(generateGroup({ threat: 2, groupKind: 'bodyguards' }, makeRng(4)).extras.some((e) => /principal/i.test(e.role)));
    assert.match(generateGroup({ threat: 1, groupKind: 'gang' }, makeRng(4)).name, /^The \S+ \S+/);
  });
  test('organisations: scale, security and host by Threat Level, with three people and a contact', () => {
    const o = generateOrg({ threat: 4, corporation: true }, makeRng(3));
    assert.equal(o.corporation, true);
    assert.deepEqual(o.host, { code: RULES.NPCGEN.hostCode[4], value: RULES.NPCGEN.hostValue[4] });
    assert.equal(o.people.length, 3);
    assert.equal(o.contact.kind, 'contact');
    assert.equal(generateOrg({ threat: 0, corporation: false }, makeRng(3)).corporation, false);
  });
  test('contacts: level by Threat Level, loyalty 1–6, a fee, and a person', () => {
    for (let t = 0; t <= 5; t++) {
      const c = generateContact({ threat: t }, makeRng(t));
      assert.equal(c.level, RULES.NPCGEN.contactLevel[t]);
      assert.ok(c.loyalty >= 1 && c.loyalty <= 6 && c.fee >= 0 && c.skills.length > 0);
    }
    assert.equal(generateContact({ threat: 2, roleId: 'fixer' }, makeRng(1)).roleId, 'fixer');
  });
  test('spirits: Force by Threat Level; actor data for the spirit sheet', () => {
    const s = generateSpirit({ threat: 2, spiritKind: 'elemental' }, makeRng(2));
    assert.equal(s.force, RULES.NPCGEN.spiritForce[2]);
    assert.ok(['fire', 'water', 'air', 'earth'].includes(s.element));
    const d = spiritActorData(s);
    assert.equal(d.actor.type, 'spirit');
    assert.equal(d.actor.system['force'], s.force);
  });
  test('jobs: pay in the Threat Level range, one to three complications, the title names the target', () => {
    for (let t = 0; t <= 5; t++) {
      const j = generateJob({ threat: t }, makeRng(t + 50));
      const [lo, hi] = RULES.NPCGEN.jobPay[t]!;
      assert.ok(j.pay >= Math.floor(lo / 100) * 100 && j.pay <= Math.ceil(hi / 100) * 100);
      assert.ok(j.complications.length >= 1 && j.complications.length <= 3);
      assert.ok(j.title.endsWith(j.target));
    }
  });
  test('jobs fit their targets: people for extractions, data for datasteals, none for sabotage', () => {
    assert.equal(targetKind('a corp researcher'), 'person');
    assert.equal(targetKind("a journalist's notes"), 'data');
    assert.equal(targetKind('an armoured limousine'), 'vehicle');
    assert.equal(targetKind('an encrypted datachip'), 'data');
    assert.equal(targetKind('a priceless painting'), 'thing');
    assert.deepEqual(jobWants('rescue a hostage'), ['person']);
    assert.equal(jobWants('sabotage'), null);
    for (let i = 0; i < 200; i++) {
      const j = generateJob({ threat: i % 6 }, makeRng(i));
      const w = jobWants(j.jobType);
      if (!w) assert.equal(j.target, '');
      else assert.ok(w.includes(targetKind(j.target)), `${j.jobType} → ${j.target}`);
    }
  });
  test('names: a list of real and street names with a look', () => {
    const n = generateNames(10, makeRng(1));
    assert.equal(n.length, 10);
    assert.ok(n.every((x) => x.name.includes(' ') && x.streetName && x.look));
  });
  test('HTML for journals is escaped', () => {
    const p = generateNpc({ threat: 1 }, makeRng(1));
    p.description = 'A <script> & "quote"';
    assert.match(planHtml(p), /A &lt;script&gt; &amp;/);
    for (const plan of [generateGroup({ threat: 2, groupKind: 'gang' }, makeRng(1)), generateOrg({ threat: 2 }, makeRng(1)), generateJob({ threat: 2 }, makeRng(1)), generateContact({ threat: 2 }, makeRng(1)), generateSpirit({ threat: 2 }, makeRng(1))]) {
      assert.doesNotMatch(planHtml(plan), /undefined|NaN/);
    }
  });
});

describe('v0.52.0 review fixes', () => {
  test('every adept power item carries a cost, and they add up to no more than Magic (3,000 adepts)', () => {
    for (let i = 0; i < 3000; i++) {
      const ad = generateNpc({ threat: i % 6, archetype: 'adept' }, makeRng(i));
      const items = npcActorData(ad).items.filter((it) => it.type === 'adeptpower');
      assert.ok(items.every((it) => Number.isFinite(Number(it.system['cost']))));
      const cost = items.reduce((n, it) => n + Number(it.system['cost']), 0);
      assert.ok(cost <= ad.magic + 1e-9, `seed ${i}: ${cost} over ${ad.magic}`);
    }
    assert.ok(adeptPowerCost('Great Leap', 0) > 0);
  });
  test('house rules that are not whole numbers still give whole ratings', () => {
    const old = { ...RULES.NPCGEN };
    Object.assign(RULES.NPCGEN as any, { spread: 0.5, maxAttribute: 6.5, maxSkill: 7.5 });
    try {
      for (let i = 0; i < 100; i++) {
        const p = generateNpc({ threat: i % 6 }, makeRng(i));
        for (const k of ATTRS) assert.ok(Number.isInteger(p.attributes[k]));
        for (const sk of p.skills) assert.ok(Number.isInteger(sk.rating) && (sk.specializationRating === undefined || Number.isInteger(sk.specializationRating)));
      }
    } finally { Object.assign(RULES.NPCGEN as any, old); }
  });
  test('trolls and orks never total below 1 in any attribute', () => {
    for (let i = 0; i < 300; i++) for (const metatype of ['troll', 'ork']) {
      const p = generateNpc({ threat: 0, archetype: 'ganger', metatype }, makeRng(i));
      const mods: any = RULES.METATYPES.types[metatype]!.mods;
      for (const k of ATTRS) assert.ok(p.attributes[k] + (mods[k] ?? 0) >= 1, `${metatype} ${k}`);
    }
  });
  test('everyone has the skill of every weapon they carry; magicians carry no cyberware', () => {
    for (const a of ARCHETYPES) for (let t = 0; t <= 5; t++) {
      const p = generateNpc({ threat: t, archetype: a.id }, makeRng(t));
      const d = npcActorData(p);
      for (const w of d.items.filter((i) => i.type === 'weapon')) assert.ok(p.skills.some((s) => s.name === w.system['skill']), `${a.id}/${t}: ${w.name} needs ${w.system['skill']}`);
      if (p.tradition !== 'none') assert.deepEqual(p.cyber, []);
    }
  });
  test('an organisation host has subsystems that follow its Security Value', () => {
    const lo = hostActorData(generateOrg({ threat: 0 }, makeRng(1)));
    const hi = hostActorData(generateOrg({ threat: 5 }, makeRng(1)));
    const avg = (h: any) => mean(Object.values(h.system.subsystems as Record<string, number>));
    assert.ok(avg(hi) > avg(lo));
    assert.equal(Object.keys(lo.system['subsystems'] as object).length, RULES.MATRIX.subsystems.length);
  });
  test('critters: flagged (no metatype maximums), vision set, token named for the animal', () => {
    const d = critterActorData(generateCritter({ threat: 2, critter: 'cat' }, makeRng(1)));
    assert.equal(d.actor.flags['sr2e'].critter, true);
    assert.deepEqual(d.actor.system['vision'], { lowLight: true, thermographic: false });
    assert.equal(d.actor.prototypeToken['name'], 'Big cat');
    assert.equal(npcActorData(generateNpc({ threat: 2, archetype: 'suit' }, makeRng(1))).actor.prototypeToken['name'], generateNpc({ threat: 2, archetype: 'suit' }, makeRng(1)).realName);
  });
  test('spirits are marked generated (never a template for conjuring)', () => {
    assert.ok((spiritActorData(generateSpirit({ threat: 1 }, makeRng(1))).actor.flags as any).sr2e.generated);
  });
});

describe('v0.61.0 NPC generator: totems and rigger vehicles', () => {
  test('shamanic NPCs get a totem from the table, written to the actor and the stat block', () => {
    const names = RULES.SECURITY_V61.npc.totems.map((t) => t.name);
    const seen = new Set<string>();
    for (let i = 0; i < 60; i++) {
      const p = generateNpc({ threat: 3, archetype: 'shaman' }, makeRng(i));
      assert.ok(p.totem && names.includes(p.totem.name), `seed ${i}`);
      seen.add(p.totem!.name);
      const d = npcActorData(p);
      assert.deepEqual(d.actor.system['totem'], p.totem);
      assert.ok(['', 'wounded', 'combat'].includes((d.actor.system['totem'] as any).berserk));
      assert.match(statBlockText(p), new RegExp(`Totem: ${p.totem!.name}`));
    }
    assert.ok(seen.size >= 5);
    assert.ok(generateNpc({ threat: 3, archetype: 'talismonger' }, makeRng(1)).totem);
    const bear = RULES.SECURITY_V61.npc.totems.find((t) => t.name === 'Bear')!;
    assert.equal(bear.health, 2);
  });
  test('others get no totem: hermetics, adepts, mundanes', () => {
    for (let i = 0; i < 20; i++) {
      for (const archetype of ['mage', 'adept', 'guard']) {
        const p = generateNpc({ threat: 3, archetype, magic: archetype === 'guard' ? 'none' : 'auto' }, makeRng(i));
        assert.equal(p.totem, undefined);
        assert.equal(npcActorData(p).actor.system['totem'], undefined);
        assert.doesNotMatch(statBlockText(p), /Totem:/);
      }
    }
  });
  test('the totem follows the person: same seed, any Threat Level', () => {
    assert.equal(generateNpc({ threat: 1, archetype: 'shaman' }, makeRng(9)).totem!.name, generateNpc({ threat: 5, archetype: 'shaman' }, makeRng(9)).totem!.name);
    assert.deepEqual(generateNpc({ threat: 3, archetype: 'shaman' }, makeRng(9)), generateNpc({ threat: 3, archetype: 'shaman' }, makeRng(9)));
  });
  test('riggers get vehicles and drones scaled by Threat Level', () => {
    const cfg = RULES.SECURITY_V61.npc;
    for (let t = 0; t <= 5; t++) for (let i = 0; i < 10; i++) {
      const p = generateNpc({ threat: t, archetype: 'rigger' }, makeRng(i));
      const vs = p.vehicles ?? [];
      assert.equal(vs.filter((v) => !v.drone).length, cfg.riggerVehicles[t]);
      assert.equal(vs.filter((v) => v.drone).length, cfg.riggerDrones[t]);
      for (const v of vs) {
        const row = cfg.vehicles.find((r) => r.name === v.name)!;
        assert.ok(row && row.minThreat <= t && row.drone === v.drone, `${t}: ${v.name}`);
      }
      if (vs.length) assert.match(statBlockText(p), /Vehicles: /);
    }
    assert.equal(generateNpc({ threat: 0, archetype: 'rigger' }, makeRng(1)).vehicles, undefined);
  });
  test('anyone with a control rig gets vehicles; the squad drone rigger gets drones', () => {
    let found = false;
    for (let i = 0; i < 40 && !found; i++) {
      const p = generateNpc({ threat: 5, archetype: 'smuggler', magic: 'none' }, makeRng(i));
      if (p.cyber.some((c) => /control rig/i.test(c))) { found = true; assert.ok(p.vehicles?.length); }
    }
    assert.ok(found);
    for (let i = 0; i < 10; i++) {
      const g = generateGroup({ threat: 4, groupKind: 'squad' }, makeRng(i));
      const rigger = g.extras.find((e) => e.role === 'Drone rigger')!;
      assert.ok(rigger.vehicles!.some((v) => v.drone));
    }
    const ganger = generateNpc({ threat: 5, archetype: 'ganger', magic: 'none' }, makeRng(1));
    assert.equal(ganger.vehicles, undefined);
  });
  test('vehicleActorData matches VehicleDataModel field names and sanitises', () => {
    const p = generateNpc({ threat: 4, archetype: 'rigger' }, makeRng(3));
    const v = p.vehicles![0]!;
    const d = vehicleActorData(v);
    assert.equal(d.type, 'vehicle');
    assert.equal(d.name, v.name);
    assert.deepEqual(Object.keys(d.system).sort(), ['accel', 'armor', 'autonav', 'body', 'category', 'drone', 'handling', 'pilot', 'sensor', 'signature', 'speed'].sort());
    assert.ok(RULES.VEHICLES.categories.some((c) => c.id === d.system['category']));
    const bad = vehicleActorData({ name: '', category: 'spaceship', drone: true, handling: NaN, speed: -5 } as any);
    assert.equal(bad.system['category'], 'other');
    assert.equal(bad.system['handling'], 0);
    assert.equal(bad.system['speed'], 0);
    assert.equal(bad.name, 'Drone');
    assert.doesNotThrow(() => vehicleActorData(null as any));
  });
  test('house rules: the tables can change', () => {
    const saved = structuredClone(RULES.SECURITY_V61.npc);
    const npc = RULES.SECURITY_V61.npc as any;
    try {
      npc.totems = [{ name: 'Gator', combat: 2, detection: 0, health: 0, illusion: 0, manipulation: 0, conjuring: 2, environment: 'swamp', inEnvironment: 0, outEnvironment: 0, spirits: 'swamp', berserk: 'nope', daylightTn: -1 }];
      npc.riggerDrones = [5, 5, 5, 5, 5, 5];
      const s = generateNpc({ threat: 2, archetype: 'shaman' }, makeRng(1));
      assert.equal(s.totem!.name, 'Gator');
      assert.equal(s.totem!.berserk, '');
      assert.equal(s.totem!.daylightTn, 0);
      assert.equal(generateNpc({ threat: 2, archetype: 'rigger' }, makeRng(1)).vehicles!.filter((v) => v.drone).length, 5);
      npc.totems = [];
      npc.vehicles = [];
      assert.equal(generateNpc({ threat: 2, archetype: 'shaman' }, makeRng(1)).totem, undefined);
      assert.equal(generateNpc({ threat: 2, archetype: 'rigger' }, makeRng(1)).vehicles, undefined);
    } finally { Object.assign(npc, saved); }
  });
});
