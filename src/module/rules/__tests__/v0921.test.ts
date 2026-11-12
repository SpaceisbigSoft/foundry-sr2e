/**
 * v0.92.1: the flexible record sheet's pure parts: custom tweaks (rules/tweaks.ts), weapon accessories read from the
 * description (rules/accessories.ts) and the reference pane's search (rules/reference.ts).
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { RULES } from '../config.ts';
import {
  normalizeTweak, normalizeTweaks, sumTweaks, attackPowerTweak, tweakText, tweakItemLive, isCarried, tweakKeyChoices, TWEAK_MAX, TWEAK_VALUE_MAX,
} from '../tweaks.ts';
import { readAccessories, accessoryPlan, plainText, ACCESSORY_DEFAULTS, ACCESSORY_NAME_KEYS, ACCESSORY_FIELD_KEYS } from '../accessories.ts';
import { referenceResults, referencePlace, referenceDragData, REFERENCE_DRAG_TYPE, type ReferenceItem } from '../reference.ts';

const S = RULES.SHEET_V921 as any;
function withRule<T>(key: string, value: unknown, fn: () => T): T {
  const prev = S[key];
  S[key] = value;
  try { return fn(); } finally { S[key] = prev; }
}

describe('v0.92.1 custom tweaks: cleaning', () => {
  test('a tweak is cleaned: a known target, a key that fits, a whole value within the limit', () => {
    assert.equal(normalizeTweak({ target: 'nonsense', value: 1 }), null);
    assert.equal(normalizeTweak(null), null);
    const a = normalizeTweak({ id: 'abc', target: 'attribute', key: 'luck', value: 2.7, label: '  Grip ' })!;
    assert.deepEqual(a, { id: 'abc', label: 'Grip', target: 'attribute', key: 'body', value: 2, on: true });
    assert.equal(normalizeTweak({ target: 'pool', key: 'combat', value: 99 })!.value, TWEAK_VALUE_MAX);
    assert.equal(normalizeTweak({ target: 'pool', key: 'combat', value: -99 })!.value, -TWEAK_VALUE_MAX);
    assert.equal(normalizeTweak({ target: 'note', value: 5, label: 'x' })!.value, 0, 'a note has no value');
    assert.equal(normalizeTweak({ target: 'reaction', key: 'whatever', value: 1 })!.key, '', 'no key for Reaction');
    assert.equal(normalizeTweak({ target: 'skillDice', key: ' Firearms ', value: 1 })!.key, 'Firearms', 'a skill is free text');
    assert.equal(normalizeTweak({ target: 'reaction', value: 1, on: false })!.on, false);
    assert.match(normalizeTweak({ id: 'bad id!', target: 'reaction', value: 1 }, () => 'gen1')!.id, /^gen1$/);
  });
  test('a list keeps at most TWEAK_MAX, drops junk and makes ids unique', () => {
    const list = normalizeTweaks([{ id: 'a', target: 'reaction', value: 1 }, { id: 'a', target: 'reaction', value: 2 }, 'junk', { target: '?' }]);
    assert.equal(list.length, 2);
    assert.notEqual(list[0]!.id, list[1]!.id);
    assert.equal(normalizeTweaks(Array.from({ length: 40 }, () => ({ target: 'note' }))).length, TWEAK_MAX);
    assert.deepEqual(normalizeTweaks('nope'), []);
  });
  test('a weapon offers "this weapon" for damage; other items don\'t', () => {
    assert.ok(tweakKeyChoices('damage', 'weapon')!.some((c) => c.key === 'self'));
    assert.ok(!tweakKeyChoices('damage', 'gear')!.some((c) => c.key === 'self'));
    assert.equal(tweakKeyChoices('reaction'), null);
    assert.equal(tweakKeyChoices('skillDice'), null);
  });
});

describe('v0.92.1 custom tweaks: when they count and what they add', () => {
  const tw = (t: any[]) => t;
  const ware = (installed: boolean, tweaks: any[]) => ({ id: 'w', name: 'Ware', type: 'cyberware', system: { installed, damaged: false, tweaks } });
  test('an item counts while it does: installed ware, worn and carried armor, carried gear and weapons', () => {
    assert.equal(tweakItemLive({ type: 'cyberware', system: { installed: true } }), true);
    assert.equal(tweakItemLive({ id: 'x', type: 'cyberware', system: { installed: true } }, { recovering: new Set(['x']) }), false, 'still healing in');
    assert.equal(tweakItemLive({ type: 'armor', system: { worn: true } }), true);
    assert.equal(tweakItemLive({ type: 'armor', system: { worn: true, carried: false } }), false);
    assert.equal(tweakItemLive({ type: 'weapon', system: { carried: false } }), false);
    assert.equal(tweakItemLive({ type: 'gear', system: { quantity: 0 } }), false);
    assert.equal(tweakItemLive({ type: 'focus', system: { bonded: false } }), false);
    assert.equal(tweakItemLive({ id: 'p', type: 'adeptpower', system: { active: true } }, { adeptOver: new Set(['p']) }), false);
    assert.equal(tweakItemLive({ type: 'skill', system: {} }), true);
  });
  test('the sums: attributes, Reaction, initiative, pools, armor, skills and damage', () => {
    const sum = sumTweaks([
      ware(true, tw([{ id: 'a', target: 'attribute', key: 'quickness', value: 1, label: 'Tuned' }, { id: 'b', target: 'reaction', value: 2 }, { id: 'c', target: 'initiativeDice', value: 1 }])),
      { id: 'g', name: 'Goggles', type: 'gear', system: { tweaks: [{ id: 'd', target: 'skillDice', key: 'Firearms', value: 2 }, { id: 'e', target: 'skillTn', key: 'Perception', value: -1 }, { id: 'f', target: 'pool', key: 'combat', value: 1 }] } },
      { id: 'k', name: 'Knife', type: 'weapon', system: { tweaks: [{ id: 'h', target: 'damage', key: 'self', value: 2 }, { id: 'i', target: 'damage', key: 'melee', value: 1 }] } },
      { id: 'r', name: 'Ring', type: 'gear', system: { tweaks: [{ id: 'j', target: 'damage', key: 'self', value: 1 }, { id: 'l', target: 'armor', key: 'impact', value: 2 }, { id: 'm', target: 'note', label: 'Shiny' }] } },
    ]);
    assert.equal(sum.attributes['quickness'], 1);
    assert.equal(sum.reaction, 2);
    assert.equal(sum.initiativeDice, 1);
    assert.equal(sum.pools['combat'], 1);
    assert.deepEqual(sum.armor, { ballistic: 0, impact: 2 });
    assert.deepEqual(sum.skillMods.map((m) => m.mods[0]), [{ skill: 'Firearms', dice: 2, tn: 0 }, { skill: 'Perception', dice: 0, tn: -1 }]);
    assert.deepEqual(sum.weaponSelf, { k: 2 });
    assert.deepEqual(sum.damage, { melee: 1, ranged: 0, all: 1 }, '"this weapon" on a ring counts for every attack');
    assert.equal(sum.list.length, 11);
    assert.ok(sum.list.every((l) => l.active));
    assert.equal(attackPowerTweak(sum, { weaponId: 'k', melee: true }), 4);
    assert.equal(attackPowerTweak(sum, { weaponId: 'other', melee: false }), 1);
  });
  test('switched-off tweaks, items that don\'t count and empty skill names add nothing (but are listed)', () => {
    const sum = sumTweaks([
      ware(false, [{ id: 'a', target: 'attribute', key: 'body', value: 3 }]),
      { id: 'g', name: 'Gear', type: 'gear', system: { tweaks: [{ id: 'b', target: 'pool', key: 'combat', value: 2, on: false }, { id: 'c', target: 'skillDice', key: '', value: 2 }] } },
    ]);
    assert.equal(sum.attributes['body'], 0);
    assert.equal(sum.pools['combat'], 0);
    assert.equal(sum.skillMods.length, 0);
    assert.equal(sum.list.length, 3);
    assert.equal(sum.list[0]!.active, false);
    assert.equal(sum.list[1]!.active, false);
  });
  test('the house rule off: nothing counts, the list stays; Power is 0', () => {
    withRule('tweaks', 'off', () => {
      const sum = sumTweaks([ware(true, [{ id: 'a', target: 'attribute', key: 'body', value: 3 }])]);
      assert.equal(sum.attributes['body'], 0);
      assert.equal(sum.list.length, 1);
      assert.equal(sum.list[0]!.active, false);
      assert.equal(attackPowerTweak({ damage: { melee: 1, ranged: 1, all: 1 }, weaponSelf: {} }, { melee: true }), 0);
    });
  });
  test('Carried: only weapons, armor and gear can be left behind; the house rule off ignores the tick', () => {
    assert.equal(isCarried({ type: 'gear', system: { carried: false } }), false);
    assert.equal(isCarried({ type: 'gear', system: {} }), true, 'an item from before v0.92.1 is carried');
    assert.equal(isCarried({ type: 'cyberware', system: { carried: false } }), true);
    withRule('carried', 'off', () => assert.equal(isCarried({ type: 'gear', system: { carried: false } }), true));
  });
  test('the text says what a tweak does', () => {
    assert.equal(tweakText(normalizeTweak({ target: 'attribute', key: 'quickness', value: 1 })!), 'Quickness +1');
    assert.equal(tweakText(normalizeTweak({ target: 'pool', key: 'spell', value: -2 })!), 'Spell Pool −2');
    assert.equal(tweakText(normalizeTweak({ target: 'skillDice', key: 'Stealth', value: 1 })!), 'Stealth: +1 dice');
    assert.equal(tweakText(normalizeTweak({ target: 'skillTn', key: 'Stealth', value: -1 })!), 'Stealth: TN −1');
    assert.equal(tweakText(normalizeTweak({ target: 'damage', key: 'self', value: 2 })!, 'weapon'), 'Power +2 (this weapon)');
    assert.equal(tweakText(normalizeTweak({ target: 'damage', key: 'self', value: 2 })!, 'gear'), 'Power +2 (every attack)');
    assert.equal(tweakText(normalizeTweak({ target: 'armor', key: 'ballistic', value: 1 })!), 'Ballistic armor +1');
    assert.equal(tweakText(normalizeTweak({ target: 'note', label: 'Engraved' })!), 'Engraved');
  });
});

describe('v0.92.1 accessories from the description', () => {
  test('plain text: tags out, entities read, paragraphs kept apart', () => {
    assert.equal(plainText('<p>Gas&nbsp;vent&amp;co</p><p>next</p>'), 'Gas vent&co. next.');
  });
  test('a stat-block description fills its accessories', () => {
    const hits = readAccessories('<p>Comes with a Gas-Vent 3 system, an integral silencer and a laser sight. Smartgun link.</p>');
    const by = Object.fromEntries(hits.map((h) => [h.field ?? h.id, h.value]));
    assert.equal(by['recoilComp'], 3);
    assert.equal(by['muzzle'], 'silencer');
    assert.equal(by['laserSight'], true);
    assert.equal(by['smartgun'], true);
  });
  test('roman numerals, "recoil compensation 2", a suppressor over a silencer, a bipod, a gyro mount', () => {
    assert.equal(readAccessories('gas vent II').find((h) => h.field === 'recoilComp')!.value, 2);
    assert.equal(readAccessories('Recoil compensation 2').find((h) => h.field === 'recoilComp')!.value, 2);
    assert.equal(readAccessories('a sound suppressor').find((h) => h.field === 'muzzle')!.value, 'suppressor');
    assert.equal(readAccessories('Folding bipod.').find((h) => h.field === 'support')!.value, 'bipod');
    assert.equal(readAccessories('gyro mount 4').find((h) => h.field === 'gyro')!.value, 4);
  });
  test('scopes: magnification, a vision scope is a scope too, at most 3', () => {
    assert.equal(readAccessories('imaging scope, magnification 2').find((h) => h.field === 'scope')!.value, 2);
    const ll = readAccessories('a low-light scope');
    assert.equal(ll.find((h) => h.field === 'scopeVision')!.value, 'lowLight');
    assert.equal(ll.find((h) => h.field === 'scope')!.value, 1);
    assert.equal(readAccessories('a 6x scope').find((h) => h.field === 'scope')!.value, 3);
  });
  test('negations and "could have" are skipped', () => {
    assert.deepEqual(readAccessories('No silencer. The suppressor is sold separately. It can mount a scope.'), []);
    assert.deepEqual(readAccessories('without a laser sight'), []);
    assert.equal(readAccessories('No silencer, but it has a shock pad.').map((h) => h.field).join(), 'shockPad');
  });
  test('accessories without a field are notes; a vent without a rating is a note', () => {
    const hits = readAccessories('Folding stock, sling, gas vent.');
    assert.deepEqual(hits.filter((h) => !h.field).map((h) => h.id).sort(), ['foldingStock', 'gasVent', 'sling']);
  });
  test('the plan fills only fields still at their default; a hand-set value is kept; an undo is respected', () => {
    const desc = 'Gas-vent 2, laser sight, shock pad, folding stock';
    const p = accessoryPlan(desc, { ...ACCESSORY_DEFAULTS, laserSight: false, recoilComp: 1 });
    assert.deepEqual(p.set, { 'system.laserSight': true, 'system.shockPad': true });
    assert.deepEqual(p.before, { 'system.laserSight': false, 'system.shockPad': false });
    assert.deepEqual(p.kept.map((h) => h.id), ['gasVent'], 'recoil compensation set by hand');
    assert.deepEqual(p.notes.map((h) => h.id), ['foldingStock']);
    const again = accessoryPlan(desc, { ...ACCESSORY_DEFAULTS }, { dismissed: ['laserSight'], noted: ['foldingStock'] });
    assert.ok(!('system.laserSight' in again.set));
    assert.deepEqual(again.notes, []);
    assert.deepEqual(accessoryPlan('', {}).set, {});
  });
  test('every accessory and field has its language key', () => {
    for (const id of ['gasVent', 'silencer', 'suppressor', 'smartgun', 'laserSight', 'scope', 'scopeVision', 'shockPad', 'bipod', 'tripod', 'gyro', 'quickDraw', 'foldingStock', 'sling']) assert.ok(ACCESSORY_NAME_KEYS[id], id);
    for (const f of Object.keys(ACCESSORY_DEFAULTS)) assert.ok(ACCESSORY_FIELD_KEYS[f], f);
  });
});

describe('v0.92.1 the reference pane\'s search', () => {
  const items: ReferenceItem[] = [
    { kind: 'guide', id: 'weapons', name: 'Weapons and armor', detail: 'Guide', text: 'Attack buttons' },
    { kind: 'entry', id: 'k1', type: 'weapon', name: 'Heavy pistol', detail: 'Weapon · 9M' },
    { kind: 'entry', id: 'k2', type: 'weapon', name: 'Assault rifle', detail: 'Weapon · 8M pistol grip' },
    { kind: 'interp', id: 'fixer', name: 'Fixers', detail: 'Rules interpretation', text: 'a pistol through a fixer' },
  ];
  test('nothing for an empty search; every word must match; names first, entries before topics', () => {
    assert.deepEqual(referenceResults('  ', items), { results: [], total: 0 });
    assert.deepEqual(referenceResults('pistol', items).results.map((r) => r.id), ['k1', 'k2', 'fixer']);
    assert.deepEqual(referenceResults('heavy pistol', items).results.map((r) => r.id), ['k1']);
    assert.deepEqual(referenceResults('attack', items).results.map((r) => r.id), ['weapons']);
    assert.deepEqual(referenceResults('pistol', items, { kinds: new Set(['interp']) }).results.map((r) => r.id), ['fixer']);
    const many = Array.from({ length: 80 }, (_x, i) => ({ kind: 'entry' as const, id: `e${i}`, name: `Rope ${i}`, detail: '' }));
    const r = referenceResults('rope', many, { limit: 60 });
    assert.equal(r.results.length, 60);
    assert.equal(r.total, 80);
  });
  test('the pane goes right of the sheet when it fits, else left, else over the right edge', () => {
    assert.deepEqual(referencePlace({ left: 100, top: 50, width: 700, height: 800 }, { width: 1600, height: 1000 }), { left: 806, top: 50, width: 340, height: 800 });
    assert.equal(referencePlace({ left: 900, top: 0, width: 650, height: 600 }, { width: 1600, height: 1000 }).left, 554);
    assert.equal(referencePlace({ left: 100, top: 0, width: 1400, height: 600 }, { width: 1600, height: 1000 }).left, 1260);
  });
  test('the drag data names the entry', () => {
    assert.deepEqual(referenceDragData({ id: 'world:abc', type: 'weapon', name: 'Knife' }), { type: REFERENCE_DRAG_TYPE, key: 'world:abc', entryType: 'weapon', name: 'Knife' });
  });
});

describe('v0.92.1 review fixes (pure)', () => {
  test('the reader skips "version", "ready", "compatible" and "available"; the negation window stops at and/with; no bare "can"', () => {
    for (const t of ['Smartgun version available at double cost.', 'Silenced version: +100 nuyen.', 'Smart-gun ready (needs a smartgun adapter, sold separately)', 'Gyro-mount compatible.', 'laser designator', 'It can mount a scope.']) assert.deepEqual(readAccessories(t), [], t);
    assert.deepEqual(readAccessories('A no-frills pistol with a laser sight.').map((h) => h.field), ['laserSight']);
    assert.deepEqual(readAccessories('Sporting rifle with no silencer and a hunting scope.').map((h) => h.field), ['scope']);
    assert.deepEqual(readAccessories('It can fire bursts and has a silencer').map((h) => h.field), ['muzzle']);
    assert.equal(readAccessories('gyro stabilizer (rating 5)')[0]!.value, 5);
    assert.equal(readAccessories('Scope (low-light, magnification 2)').find((h) => h.field === 'scopeVision')!.value, 'lowLight');
  });
  test('armor tweaks only add', () => {
    assert.equal(normalizeTweak({ target: 'armor', key: 'ballistic', value: -2 })!.value, 0);
  });
});
