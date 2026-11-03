import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  RULES, newFire, fireTurn, fireIntensity, fuelKind, segmentPointDistance, smokeRadius, smokeOnLine, wallBurn, burnWall, circleTouchesRect, nearestRectPoint,
  fuelSpan, smokeInhalation, contagionToxinVector, contagionReach, contagionProblem, caughtFrom, infectionFrom, infects, radiationDose, decayedDose,
  sicknessStage, sicknessEntry, isRadiationSickness, weatherDriving, weatherMovement, movementInWeather, careFactor, recoveryWithCare, rescaleRecovery,
  recoveryCareCost, skillCopy, possessedSkillChoice, allyProblem, allyCosts, meditationTn, thesisTn, ordealWeeks, familiarReady, designDrain, ordealById,
  POWER_SPECIALS, CONTAGION_VECTORS, type DiseaseEntry, type SceneFire,
} from '../index.ts';

const withRule = (obj: any, key: string, value: unknown, fn: () => void) => { const old = obj[key]; obj[key] = value; try { fn(); } finally { obj[key] = old; } };
const fire = (o: Partial<SceneFire> = {}): SceneFire => ({ ...newFire({ id: 'f', x: 0, y: 0, source: 'test', now: 0 }), ...o });

describe('v0.48.0 fire: fuel', () => {
  test('fuel kinds: light and heavy; unknown is none', () => {
    assert.equal(fuelKind('light')?.metresPerTurn, 1);
    assert.equal(fuelKind('heavy')?.intensitySteps, 1);
    assert.equal(fuelKind('nope'), null);
    assert.equal(fuelKind(''), null);
  });
  test('a fire on heavy fuel starts a step hotter, grows faster, lasts longer and can cover its fuel', () => {
    const f = newFire({ id: 'a', x: 0, y: 0, source: 's', now: 0, fuel: 'heavy', maxRadius: 10, fuelId: 'd1' });
    assert.equal(f.fuel, 'heavy');
    assert.equal(f.fuelId, 'd1');
    assert.equal(f.intensity, 'burning');
    assert.equal(fireIntensity(0, 'light'), 'small');
    const t = fireTurn(f);
    assert.equal(t.fire.radius, 1 + RULES.FIRE.metresPerTurn + 2);
    // grows past the usual cap (6) up to the fuel's span (10)
    let g = f;
    for (let i = 0; i < 8; i++) g = fireTurn(g).fire;
    assert.equal(g.radius, 10);
    // lasts turns + extraTurns
    let h: SceneFire = f; let out = false; let n = 0;
    while (!out && n < 30) { const r = fireTurn(h); h = r.fire; out = r.out; n++; }
    assert.equal(n, RULES.FIRE.turns + 6);
  });
  test('a plain fire still stops at maxRadius and burns out after turns', () => {
    let g = fire();
    let out = false; let n = 0;
    while (!out) { const r = fireTurn(g); g = r.fire; out = r.out; n++; }
    assert.equal(n, RULES.FIRE.turns);
    assert.ok(g.radius <= RULES.FIRE.maxRadius);
  });
  test('circle against a rectangle; nearest point; span', () => {
    const rect = { x: 100, y: 0, width: 50, height: 50 };
    assert.equal(circleTouchesRect({ x: 0, y: 25 }, 99, rect), false);
    assert.equal(circleTouchesRect({ x: 0, y: 25 }, 100, rect), true);
    assert.equal(circleTouchesRect({ x: 120, y: 20 }, 0, rect), true);
    assert.deepEqual(nearestRectPoint({ x: 0, y: 25 }, rect), { x: 100, y: 25 });
    assert.equal(fuelSpan({ width: 600, height: 800 }, 100), 5);
    assert.equal(fuelSpan({ width: 600, height: 800 }, 0), 0);
  });
});

describe('v0.48.0 fire: walls', () => {
  test('burnable walls lose rating by intensity and burn through at 0', () => {
    assert.equal(wallBurn('small'), 0);
    assert.equal(wallBurn('blaze'), 2);
    assert.deepEqual(burnWall(3, 'burning'), { left: 2, loss: 1, burntThrough: false });
    assert.deepEqual(burnWall(2, 'blaze'), { left: 0, loss: 2, burntThrough: true });
    assert.deepEqual(burnWall(1, 'inferno'), { left: 0, loss: 1, burntThrough: true });
    assert.deepEqual(burnWall(0, 'inferno'), { left: 0, loss: 0, burntThrough: false });
  });
});

describe('v0.48.0 fire: smoke', () => {
  test('segment distance', () => {
    assert.equal(segmentPointDistance({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 3 }), 3);
    assert.equal(segmentPointDistance({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: -4, y: 3 }), 5);
    assert.equal(segmentPointDistance({ x: 2, y: 2 }, { x: 2, y: 2 }, { x: 5, y: 6 }), 5);
  });
  test('smoke reaches beyond the flames; flames are thermal, smoke is smoke; burnt out is smoke only', () => {
    const f = fire({ x: 500, y: 0, radius: 2, source: 'van' });
    assert.equal(smokeRadius(f), 2 + RULES.FIRE.smoke.extraMetres);
    // ppm 100: flames to 2 m, smoke to 5 m
    assert.deepEqual(smokeOnLine({ x: 0, y: 100 }, { x: 1000, y: 100 }, [f], 100), { kind: 'thermal', source: 'van', flames: true });
    assert.equal(smokeOnLine({ x: 0, y: 400 }, { x: 1000, y: 400 }, [f], 100).kind, 'smoke');
    assert.equal(smokeOnLine({ x: 0, y: 600 }, { x: 1000, y: 600 }, [f], 100).kind, 'none');
    assert.equal(smokeOnLine({ x: 0, y: 100 }, { x: 1000, y: 100 }, [{ ...f, burntOut: true }], 100).kind, 'smoke');
    withRule(RULES.FIRE.smoke, 'enabled', false, () => assert.equal(smokeOnLine({ x: 0, y: 100 }, { x: 1000, y: 100 }, [f], 100).kind, 'none'));
  });
  test('inhalation grows with intensity; off means none', () => {
    assert.deepEqual(smokeInhalation('small'), { power: 4, level: 'L', type: 'stun' });
    assert.equal(smokeInhalation('blaze')?.power, 6);
    withRule(RULES.FIRE.smoke.inhalation, 'enabled', false, () => assert.equal(smokeInhalation('blaze'), null));
  });
});

describe('v0.48.0 contagion and infection', () => {
  const d = (o: Partial<DiseaseEntry> = {}): DiseaseEntry => ({ name: 'Flu', power: 5, level: 'M', damageType: 'stun', intervalHours: 24, nextAt: 0, recovered: 0, needed: 3, pending: false, treated: false, contagious: 'airborne', infectedAt: 0, incubationHours: 24, ...o });
  test('vectors and reach', () => {
    assert.deepEqual([...CONTAGION_VECTORS], ['', 'airborne', 'contact', 'blood']);
    assert.equal(contagionToxinVector('airborne'), 'inhalation');
    assert.equal(contagionToxinVector('contact'), 'contact');
    assert.equal(contagionToxinVector('blood'), 'injection');
    assert.equal(contagionReach('airborne'), 'nearby');
    assert.equal(contagionReach('blood'), 'targets');
    assert.equal(contagionReach(''), null);
  });
  test('not while incubating (unless the house rule says so), not when not contagious or off', () => {
    assert.match(contagionProblem(d(), 3600), /incubating/);
    assert.equal(contagionProblem(d(), 24 * 3600), '');
    withRule(RULES.HEALTH.contagion, 'duringIncubation', true, () => assert.equal(contagionProblem(d(), 3600), ''));
    assert.match(contagionProblem(d({ contagious: '' }), 99999), /not contagious/);
    assert.match(contagionProblem(null, 0), /gone/);
    withRule(RULES.HEALTH.contagion, 'enabled', false, () => assert.match(contagionProblem(d(), 99999), /off/));
  });
  test('caught from a carrier: Power + the modifier, its timings and vector', () => {
    const c = caughtFrom(d(), 'Bob');
    assert.equal(c.kind, 'disease');
    assert.equal(c.vector, 'inhalation');
    assert.equal(c.power, 5);
    assert.equal(c.damageType, 'stun');
    assert.equal(c.recoveries, 3);
    assert.equal(c.contagious, 'airborne');
    assert.match(c.label, /Bob/);
    withRule(RULES.HEALTH.contagion, 'powerModifier', -2, () => assert.equal(caughtFrom(d(), 'Bob').power, 3));
  });
  test('infection: the power names the disease, Power and level; defaults otherwise; only Physical damage infects', () => {
    assert.ok((POWER_SPECIALS as readonly string[]).includes('infection'));
    const a = infectionFrom({ substance: 'Krieger', rating: 5, damageLevel: 'S' });
    assert.equal(a.name, 'Krieger');
    assert.equal(a.power, 5);
    assert.equal(a.level, 'S');
    assert.equal(a.contagious, RULES.CRITTERS.infection.contagious);
    const b = infectionFrom({});
    assert.equal(b.name, RULES.CRITTERS.infection.name);
    assert.equal(b.power, RULES.CRITTERS.infection.power);
    assert.equal(b.level, 'M');
    assert.equal(infects(1, 'physical'), true);
    assert.equal(infects(0, 'physical'), false);
    assert.equal(infects(3, 'stun'), false);
    withRule(RULES.CRITTERS.infection, 'enabled', false, () => assert.equal(infects(3, 'physical'), false));
  });
});

describe('v0.48.0 radiation sickness', () => {
  test('dose, decay and stages', () => {
    assert.equal(radiationDose(3, 4), 12);
    assert.equal(radiationDose(-1, 4), 0);
    assert.equal(decayedDose(12, 5), 7);
    assert.equal(decayedDose(3, 5), 0);
    assert.equal(sicknessStage(9), -1);
    assert.equal(sicknessStage(10), 0);
    assert.equal(sicknessStage(49), 1);
    assert.equal(sicknessStage(500), 3);
    withRule(RULES.HEALTH.radiationSickness, 'enabled', false, () => assert.equal(sicknessStage(500), -1));
  });
  test('a sickness entry tests after one interval and is recognised', () => {
    const e = sicknessEntry(1, 1000)!;
    assert.equal(e.name, 'Radiation sickness');
    assert.equal(e.level, 'M');
    assert.equal(e.nextAt, 1000 + 24 * 3600);
    assert.equal(e.source, 'radiation');
    assert.ok(isRadiationSickness(e));
    assert.ok(isRadiationSickness({ name: 'Severe radiation sickness' }));
    assert.ok(!isRadiationSickness({ name: 'Flu' }));
    assert.equal(sicknessEntry(9, 0), null);
  });
});

describe('v0.48.0 weather on driving and movement', () => {
  test('driving TN and movement factor by weather; switches', () => {
    assert.equal(weatherDriving('clear'), null);
    assert.deepEqual(weatherDriving('snow'), { label: 'Heavy snow (driving)', value: 3 });
    assert.equal(weatherMovement('storm'), 0.5);
    assert.equal(weatherMovement('fog'), 1);
    assert.deepEqual(movementInWeather({ walk: 5, run: 15 }, 'heavyRain'), { walk: 3.5, run: 11, factor: 0.75 });
    withRule(RULES.HEALTH.weatherOn, 'driving', false, () => assert.equal(weatherDriving('snow'), null));
    withRule(RULES.HEALTH.weatherOn, 'movement', false, () => assert.equal(weatherMovement('storm'), 1));
  });
});

describe('v0.48.0 care while recovering from surgery', () => {
  test('factors by care; at home by lifestyle', () => {
    assert.equal(careFactor('hospital'), 1);
    assert.equal(careFactor('intensive'), 0.75);
    assert.equal(careFactor('none'), 1.5);
    assert.equal(careFactor('home', 'street'), 1.5);
    assert.equal(careFactor('home', 'luxury'), 0.75);
    assert.equal(careFactor('home', 'middle'), 1);
    assert.equal(careFactor('unknown'), 1);
  });
  test('days under care, rescaling what is left, and the bill', () => {
    assert.equal(recoveryWithCare(10, 'intensive'), 8);
    assert.equal(recoveryWithCare(10, 'poor'), 20);
    assert.equal(recoveryWithCare(0, 'hospital'), 1);
    // 10 days left at ×1 → intensive ×0.75 = 7.5 days left
    assert.equal(rescaleRecovery(10 * 86400 + 100, 1, 0.75, 100), 100 + 7.5 * 86400);
    assert.equal(rescaleRecovery(50, 1, 2, 100), 50);
    assert.equal(recoveryCareCost('hospital', 3), 1500);
    assert.equal(recoveryCareCost('none', 3), 0);
  });
});

describe('v0.48.0 a possessed body\'s skills', () => {
  const firearms = skillCopy({ name: 'Firearms', system: { rating: 6, attribute: 'quickness', kind: 'active' } });
  const etiquette = skillCopy({ name: 'Etiquette', system: { rating: 4, attribute: 'charisma', kind: 'active' } });
  test('copies a skill item', () => {
    assert.deepEqual(firearms, { name: 'Firearms', rating: 6, attribute: 'quickness', kind: 'active', specialization: '', specializationRating: 0, concentration: '', concentrationRating: 0 });
  });
  test('modes: possessor, body, best, split', () => {
    const body = { rating: 3, attribute: 'quickness', kind: 'active' };
    assert.equal(possessedSkillChoice(body, firearms, 'possessor'), 'possessor');
    assert.equal(possessedSkillChoice(body, null, 'possessor'), 'none');
    assert.equal(possessedSkillChoice(body, firearms, 'body'), 'body');
    assert.equal(possessedSkillChoice(null, firearms, 'body'), 'none');
    assert.equal(possessedSkillChoice({ ...body, rating: 7 }, firearms, 'best'), 'body');
    assert.equal(possessedSkillChoice(body, firearms, 'best'), 'possessor');
    assert.equal(possessedSkillChoice(body, firearms, 'split'), 'body');
    assert.equal(possessedSkillChoice({ rating: 2, attribute: 'charisma', kind: 'active' }, etiquette, 'split'), 'possessor');
    assert.equal(possessedSkillChoice({ rating: 2, attribute: 'charisma', kind: 'active' }, null, 'split'), 'none');
  });
});

describe('v0.48.0 allies and ordeals', () => {
  test('ally: grade and Force limits; costs', () => {
    assert.match(allyProblem({ grade: 0, magic: 6, force: 3 }), /grade/);
    assert.match(allyProblem({ grade: 1, magic: 4, force: 5 }), /Magic/);
    assert.equal(allyProblem({ grade: 1, magic: 6, force: 5 }), '');
    withRule(RULES.OCCULT.ally, 'maxForce', 'grade', () => assert.match(allyProblem({ grade: 2, magic: 6, force: 3 }), /grade/));
    assert.deepEqual(allyCosts(4), { tn: 4, nuyen: 4000, days: 4, karma: 4 });
  });
  test('ordeals: every one has an effect now; meditation and thesis TNs and weeks', () => {
    for (const id of ['deed', 'familiar', 'meditation', 'oath', 'thesis']) assert.equal(ordealById(id)?.effect, id);
    assert.equal(meditationTn(2), 6);
    assert.equal(thesisTn(1), 5);
    assert.equal(ordealWeeks('meditation', 3), 3);
    assert.equal(ordealWeeks('geas', 3), 0);
    assert.equal(familiarReady({ allyUuid: 'x', usedForGrade: null }), true);
    assert.equal(familiarReady({ allyUuid: 'x', usedForGrade: 2 }), false);
    assert.equal(familiarReady(null), false);
  });
  test('design: permanent, restricted, extended range and one sense; exclusive and fetish noted', () => {
    assert.equal(designDrain({ category: 'manipulation', spellType: 'mana', duration: 'permanent' }).drainModifier, 1);
    assert.equal(designDrain({ category: 'combat', spellType: 'mana', restricted: true }).drainModifier, -1);
    assert.equal(designDrain({ category: 'detection', spellType: 'mana', extendedRange: true }).drainModifier, 1);
    assert.equal(designDrain({ category: 'combat', spellType: 'mana', extendedRange: true }).drainModifier, 0);
    assert.equal(designDrain({ category: 'illusion', spellType: 'mana', singleSense: true }).drainModifier, -1);
    const x = designDrain({ category: 'combat', spellType: 'mana', exclusive: true, fetish: true });
    assert.equal(x.drainModifier, 0);
    assert.ok(x.notes.some((n) => n.startsWith('exclusive')) && x.notes.some((n) => n.startsWith('fetish')));
  });
});
