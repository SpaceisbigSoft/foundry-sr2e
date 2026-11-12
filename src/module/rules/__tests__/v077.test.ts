/**
 * v0.77.0: rules values corrected after the check against the official books (docs/VERIFY.md,
 * "Book check"). These pin each corrected value, so a later edit that puts an old
 * value back shows up here; the old values stay reachable as house rules (set the RULES path back).
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { RULES } from '../config.ts';
import { blastFalloff } from '../weapons.ts';
import { bypassTime } from '../netrig.ts';
import { statBlockItems, parseStatBlock } from '../statblock.ts';

const T = (id: string): any => (RULES.ITEM_TEMPLATES as any[]).find((t) => t.id === id)?.system;

describe('v0.77.0 book check: item templates', () => {
  test('weapons', () => {
    assert.deepEqual([T('taser').damagePower, T('taser').damageLevel, T('taser').modes], [10, 'S', 'SA']);
    assert.deepEqual([T('bow').damagePower, T('bow').strengthCap, T('bow').cost], [2, 3, 300]);
    assert.equal(T('club').reach, 1);
    assert.equal(T('polearm').damagePower, 0);
    assert.equal(T('sword').damagePower, 2);
    assert.deepEqual([T('assaultRifle').ammoMax, T('assaultRifle').ammo], [40, 40]);
    assert.equal(T('sniperRifle').cost, 4000);
    assert.equal(T('grenadeLauncher').cost, 1600);
    assert.deepEqual([T('missileLauncher').guidance, T('missileLauncher').antiVehicle, T('missileLauncher').blastKind], [3, false, 'heRocket']);
    assert.deepEqual([T('flashGrenade').damagePower, T('flashGrenade').damageLevel, T('flashGrenade').damageType ?? 'physical', T('flashGrenade').cost], [5, 'L', 'physical', 40]);
  });
  test('armor, gear and the combat spell', () => {
    assert.deepEqual([T('formFitting').ballistic, T('formFitting').impact, T('formFitting').adds], [4, 1, false]);
    assert.deepEqual([T('riotShield').ballistic, T('riotShield').impact, T('riotShield').weight], [1, 0, 2]);
    // v0.92.3: Rigger 2 p. 97 first: 5,000¥ × Rating, 3 kg (was the core 50,000¥ × Rating).
    assert.deepEqual([T('rcd').cost, T('rcd').rcdRating, T('rcd').weight], [10000, 2, 3]);
    assert.equal(T('climbingGear').cost, 250);
    // The builder's gear lists match templates by name: the name stays "Climbing gear" (v0.77.0 review fix).
    assert.equal((RULES.ITEM_TEMPLATES as any[]).find((t) => t.id === 'climbingGear').name, 'Climbing gear');
    assert.deepEqual([T('combatSpell').damageLevel, T('combatSpell').drainLevel], ['S', 'S']);
  });
});

describe('v0.77.0 book check: rules values', () => {
  test('grenade falloff: defensive −1 per 0.5 m; flash 5L in a 1 m blast (the kind sets the falloff)', () => {
    assert.equal(blastFalloff('defensive', 1), 2);
    assert.equal(blastFalloff('flash', 1), 5);
  });
  test('bypass time: the circuit and the casing each 60 s ÷ successes', () => {
    assert.deepEqual(bypassTime('maglock', 1), { turns: 20, seconds: 60 });
    assert.deepEqual(bypassTime('casing', 1), { turns: 20, seconds: 60 });
    assert.deepEqual(bypassTime('casing', 4), { turns: 5, seconds: 15 });
  });
  test('social, magic, rigging and security values', () => {
    assert.deepEqual([RULES.SOCIAL.skills['Negotiation'], RULES.SOCIAL.skills['Leadership']], ['willpower', 'intelligence']);
    assert.equal((RULES as any).MAGIC_EXTRA.area.radiusFrom, 'magic');
    assert.equal((RULES as any).MAGIC_V61.attributeSpells.exclusiveWithCyber, true);
    assert.equal((RULES as any).MAGIC_V72.adeptAstral.enabled, false);
    assert.deepEqual([...(RULES as any).ADEPT.killingHands.levels], ['L', 'M', 'S', 'D']);
    assert.equal((RULES as any).RIGGING.remote.dronesPerRating, 1);
    assert.equal((RULES as any).ACTIONS.costs.droneCommand, 'complex');
    const lt = (id: string) => (RULES as any).SECURITY_V57.lockTypes.find((l: any) => l.id === id).tn;
    assert.deepEqual([lt('card'), lt('print')], [2, 4]);
    assert.equal((RULES as any).HEALTH_V72.bioware.vitals.extendedVolume.breathTurns, 15);
  });
});

describe('v0.77.0 importer: adept powers and Killing Hands letters', () => {
  const block = `Adept\nB Q S C I W E M R\n4 5 4 3 4 5 6 6 5\nPowers: Killing Hands (L), Improved Reflexes 1, Mystic Armor 2, Spell Resistance 2, Combat Sense 1\n`;
  test('Killing Hands (L) is level 1; costs from the book; mystic armor impact only; reflexes dice only', () => {
    const r = statBlockItems(parseStatBlock(block));
    const s = (n: string) => r.items.find((i: any) => i.name === n) as any;
    assert.equal(s('Killing Hands')?.system.level, 1);
    assert.equal(s('Improved Reflexes')?.system.initiativeDice, 1);
    assert.equal(s('Improved Reflexes')?.system.reaction ?? 0, 0);
    assert.deepEqual([s('Mystic Armor')?.system.impact, s('Mystic Armor')?.system.ballistic ?? 0], [2, 0]);
  });
});
