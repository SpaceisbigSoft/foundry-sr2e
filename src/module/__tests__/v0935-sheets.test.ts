/**
 * v0.93.5 "interface polish" (Agent B, the sheets): greyed actions with the reason (plan item 48), the action bar's
 * fixed order and More…, firing-mode chips, pins by dragging (plan item 51), the vehicle strip, no metatype chip.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { actionBar, enabledActions, modeChips, matrixActionState, jumpState, BAR_MAIN, BAR_REST, WHY, type ActionFacts } from '../rules/actions935.ts';
import { effectPinKey, isEffectPin, placePin, unpin, pinKeyOfDrop, pinButtons, PIN_MAX, PIN_DRAG_TYPE } from '../rules/pins935.ts';
import { vehicleStrip } from '../rules/vstrip935.ts';

const ROOT = join(import.meta.dirname, '..', '..', '..');
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), 'utf8');
const tpl = (f: string) => read('public', 'templates', f);
const balanced = (s: string) => (s.match(/\{\{#(if|each|unless)\b/g) ?? []).length === (s.match(/\{\{\/(if|each|unless)\}\}/g) ?? []).length;
/** The new strings, before they are merged into lang/en.json. */
const DRAFT = '/home/claude/work/strings-B.json';
const lang = (): Record<string, string> => {
  const flat: Record<string, string> = {};
  const walk = (o: unknown, p: string) => { if (typeof o === 'string') flat[p] = o; else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) walk(v, p ? `${p}.${k}` : k); };
  walk(JSON.parse(read('public', 'lang', 'en.json')), '');
  return { ...flat, ...(existsSync(DRAFT) ? JSON.parse(readFileSync(DRAFT, 'utf8')) : {}) };
};

const base: ActionFacts = {
  actorType: 'character', combat: false, combatStarted: false, acting: false, delaying: false, actingNow: false, fullDefenseUp: false,
  spells: 0, caster: false, conjuring: false, astral: false, ammoWeapons: 1, jammed: [], rigger: false, vehicle: false, jammer: false,
  droneLink: false, decks: 0, deckActive: false, jackedIn: false, riding: false, hitchAvailable: false, onFire: false, held: false,
  prone: false, bypass: false, rallySkill: false, morale: false,
};
const ids = (f: ActionFacts) => actionBar(f).map((a) => a.variant);
const find = (f: ActionFacts, action: string) => actionBar(f).find((a) => a.action === action);

describe('v0.93.5 greyed actions (rules/actions935.ts)', () => {
  test('out of combat, Full Defense, Delay, Hold and Initiative are greyed with a reason, not hidden', () => {
    for (const a of ['fullDefense', 'delayAction', 'holdTarget', 'rollInit']) {
      const x = find(base, a);
      assert.ok(x, a);
      assert.equal(x!.enabled, false, a);
      assert.ok(x!.why.startsWith('SR2E.'), a);
    }
    assert.equal(find(base, 'fullDefense')!.why, WHY.notInCombat);
    assert.equal(find(base, 'rollInit')!.why, WHY.noEncounter);
  });
  test('nothing moves when a combat starts: the same buttons in the same order', () => {
    const inCombat = { ...base, combat: true, combatStarted: true, acting: true };
    assert.deepEqual(actionBar(base).map((a) => a.action), actionBar(inCombat).map((a) => a.action));
    assert.ok(actionBar(inCombat).every((a) => a.enabled));
    // Waiting for another's action: Delay is greyed with its own reason.
    assert.equal(find({ ...inCombat, acting: false }, 'delayAction')!.why, WHY.notYourAction);
    assert.equal(find({ ...inCombat, fullDefenseUp: true }, 'fullDefense')!.variant, 'fullDefenseUp');
  });
  test('the order is fixed: primary first, the rest, then what has happened (a jam, fire, a hold, prone)', () => {
    const f = { ...base, jammed: [{ id: 'w1', name: 'Gun' }], onFire: true, prone: true, held: true };
    const bar = actionBar(f);
    const groups = bar.map((a) => a.group);
    assert.deepEqual(groups, [...groups].sort((a, b) => ['main', 'rest', 'urgent'].indexOf(a) - ['main', 'rest', 'urgent'].indexOf(b)));
    assert.deepEqual(bar.filter((a) => a.group === 'urgent').map((a) => a.action), ['clearJam', 'putOutFire', 'breakFree', 'standUp']);
    assert.equal(bar.find((a) => a.action === 'clearJam')!.itemId, 'w1');
    // The situational buttons don't move the others.
    assert.deepEqual(bar.filter((a) => a.group !== 'urgent').map((a) => a.action), actionBar(base).map((a) => a.action));
    assert.deepEqual(bar.filter((a) => a.group === 'main').map((a) => a.action), ['quickAttack', 'quickReload', 'fullDefense', 'delayAction', 'rollInit']);
    assert.equal(BAR_MAIN.length + BAR_REST.length, new Set([...BAR_MAIN, ...BAR_REST]).size);
  });
  test('greyed means "applies to this kind of character": a mundane gets no Cast or Summon, a magician gets them greyed', () => {
    assert.ok(!ids(base).includes('quickCast') && !ids(base).includes('summonSpirit') && !ids(base).includes('assense'));
    const mage = { ...base, caster: true };
    assert.equal(find(mage, 'quickCast')!.why, WHY.noSpells);
    assert.equal(find(mage, 'summonSpirit')!.why, WHY.noConjuring);
    assert.equal(find(mage, 'assense')!.why, WHY.notAstral);
    assert.equal(find({ ...mage, spells: 2, conjuring: true, astral: true }, 'quickCast')!.enabled, true);
  });
  test('Matrix and rigging: a deck not in use greys Jack in, a rigger without a vehicle greys Drive; no deck or rig, no button', () => {
    assert.equal(find(base, 'jackIn'), undefined);
    assert.equal(find({ ...base, decks: 1 }, 'jackIn')!.why, WHY.noDeckInUse);
    assert.equal(find({ ...base, decks: 1, deckActive: true }, 'jackIn')!.enabled, true);
    assert.equal(find({ ...base, decks: 1, deckActive: true, jackedIn: true }, 'jackOut')!.enabled, true);
    assert.equal(find(base, 'driveVehicle'), undefined);
    assert.equal(find({ ...base, rigger: true }, 'driveVehicle')!.why, WHY.noVehicle);
    assert.deepEqual(matrixActionState(false), { enabled: false, why: WHY.notJackedIn });
    assert.deepEqual(matrixActionState(true), { enabled: true, why: '' });
    assert.equal(jumpState(0, true).why, WHY.noControlRig);
    assert.equal(jumpState(0, false).enabled, true);
    assert.equal(jumpState(2, true).enabled, true);
  });
  test('reload with no weapon that takes ammunition is greyed (the action refuses it with the same reason)', () => {
    assert.equal(find({ ...base, ammoWeapons: 0 }, 'quickReload')!.why, WHY.noAmmoWeapon);
  });
  test('a spirit shows only what it can do (no greyed buttons); the enabled list is what the bar showed before', () => {
    const sp = { ...base, actorType: 'spirit', ammoWeapons: 0 };
    assert.ok(actionBar(sp).every((a) => a.enabled));
    assert.ok(!ids(sp).includes('negotiatePay') && !ids(sp).includes('fullDefense'));
    assert.deepEqual(enabledActions(base).map((a) => a.action).sort(), ['athletics', 'firstAid', 'naturalHeal', 'negotiatePay', 'notice', 'perceive', 'quickAttack', 'quickReload', 'searchPerson', 'sneak', 'socialTest']);
    const npc = { ...base, actorType: 'npc' };
    assert.ok(!ids(npc).includes('negotiatePay'));
  });
  test('every reason key has its English text', () => {
    const l = lang();
    for (const k of Object.values(WHY)) assert.ok(l[k], k);
  });
});

describe('v0.93.5 the action bar on the sheet (sheet-summary.hbs, sheets.ts)', () => {
  const s = tpl('sheet-summary.hbs');
  test('the bar: three groups, a More… button for the narrow window, greyed buttons marked for assistive tech and the tooltip', () => {
    assert.ok(balanced(s));
    assert.ok(s.includes('sr2e-quickbar') && s.includes('sr2e-pinbar') && s.includes('details class="sr2e-setup"'));
    for (const g of ['actionBar.main', 'actionBar.rest', 'actionBar.urgent']) assert.ok(s.includes(`{{#each ${g}}}`), g);
    assert.match(s, /class="sr2e-qa-more-btn" aria-expanded="false" aria-controls="\{\{actor\.id\}\}-qa-rest"/);
    assert.match(s, /aria-disabled="true" data-sr2e-unavailable data-tooltip="\{\{tip\}\}"/);
    // The tooltip is escaped once more (Foundry renders data-tooltip as HTML).
    const src = read('src', 'module', 'applications', 'sheets.ts');
    assert.ok(src.includes('tip: escHtml(`${q.title} · ${why}`)'));
    assert.ok(src.includes('actionBar: actionBarContext(actor, items),'));
  });
  test('a greyed button does nothing when clicked; More… closes on Esc and a click outside', () => {
    const g = read('src', 'module', 'applications', 'sheets935.ts');
    assert.ok(g.includes("closest?.('[data-sr2e-unavailable]')") && g.includes('ev.stopImmediatePropagation();\n  }, true);'));
    assert.ok(g.includes("ev.key === 'Escape'") && g.includes("addEventListener('pointerdown'") && g.includes("addEventListener('focusout'"));
    assert.ok(read('src', 'module', 'applications', 'sheets.ts').includes('decorateSheet935(this);'));
  });
  test('the CSS draft: wide layout unchanged (groups take no room), narrow at 1100 px or a narrow sheet', () => {
    const all = read('public', 'style', 'sr2e.css');
    // v0.93.5 (merged): agent B's part of the stylesheet, from its heading to agent C's.
    const css = all.slice(all.indexOf('v0.93.5 (Agent B): sheets'), all.indexOf('v0.93.5 (Agent C)'));
    assert.ok(css.includes('.sr2e-actionbar .sr2e-qa-group,\n.application.sr2e-look .sr2e-actionbar .sr2e-qa-more-wrap { display: contents; }'));
    assert.ok(css.includes('@media (max-width: 1100px) {') && css.includes('@container (max-width: 30rem) {'));
    for (const line of css.split('\n').filter((l) => /^\S.*\{/.test(l) && !l.startsWith('@'))) assert.ok(line.includes('.sr2e-look'), line);
  });
  test('no metatype chip: the Metatype field shows it', () => {
    assert.ok(!s.includes('summary.meta') && !s.includes('sr2e-chip-meta'));
    assert.ok(!read('src', 'module', 'applications', 'sheets.ts').includes('showRow: Boolean(meta'));
  });
  test('Matrix and rigging buttons show greyed with the reason', () => {
    const m = tpl('matrix-section.hbs');
    assert.ok(balanced(m));
    assert.ok(m.includes('{{#unless matrix.jackedIn}}') && m.includes('data-action="matrixAttack" class="sr2e-cant" aria-disabled="true" data-sr2e-unavailable'));
    const r = tpl('rigging-section.hbs');
    assert.ok(balanced(r));
    assert.ok(r.includes('{{#unless rigging.canJump}}<button type="button" data-action="toggleJump" class="sr2e-cant" aria-disabled="true"'));
  });
});

describe('v0.93.5 firing-mode chips', () => {
  test('one mode pressed: the remembered one, else the first', () => {
    assert.deepEqual(modeChips(['SA', 'BF', 'FA'], 'BF'), [{ mode: 'SA', active: false }, { mode: 'BF', active: true }, { mode: 'FA', active: false }]);
    assert.deepEqual(modeChips(['SA', 'BF'], 'FA').map((c) => c.active), [true, false]);
    assert.deepEqual(modeChips(['SA'], undefined).map((c) => c.active), [true]);
    assert.deepEqual(modeChips([], 'SA'), []);
  });
  test('the chips are a group with aria-pressed on the character and NPC sheets', () => {
    for (const f of ['actor-character-sheet.hbs', 'actor-npc-sheet.hbs']) {
      const t = tpl(f);
      assert.ok(balanced(t), f);
      assert.ok(t.includes('<span class="sr2e-mode-group" role="group" aria-label="{{sr2eT "SR2E.UI.firingMode"}}">'), f);
      assert.ok(t.includes('aria-pressed="{{#if (eq this ../modeActive)}}true{{else}}false{{/if}}"'), f);
      assert.ok(t.includes('data-action="attackWeapon" data-item-id="{{../id}}" data-mode="{{this}}"'), f);
    }
    assert.ok(read('public', 'style', 'sr2e.css').includes('button.sr2e-mode[aria-pressed="true"]'));
  });
});

describe('v0.93.5 pins by dragging (rules/pins935.ts)', () => {
  test('effect keys: a status by its id, other rows by group and name', () => {
    assert.equal(effectPinKey({ group: 'Statuses', name: 'Prone', statusId: 'prone' }), 'fx:s:prone');
    assert.equal(effectPinKey({ group: 'Magic', name: 'Sustaining  Armor' }), 'fx:magic:sustaining armor');
    assert.ok(isEffectPin('fx:s:prone') && !isEffectPin('abc123'));
  });
  test('placing: at the end, before another, moving one along; a full bar refuses a new pin; gone items are tidied', () => {
    assert.deepEqual(placePin(['a', 'b'], 'c', null).pins, ['a', 'b', 'c']);
    assert.deepEqual(placePin(['a', 'b'], 'c', 'a').pins, ['c', 'a', 'b']);
    assert.deepEqual(placePin(['a', 'b', 'c'], 'c', 'a').pins, ['c', 'a', 'b']);
    assert.deepEqual(placePin(['a', 'b', 'c'], 'a', null).pins, ['b', 'c', 'a']);
    assert.deepEqual(placePin(['a', 'b'], 'a', 'a').pins, ['a', 'b'], 'dropped on itself: stays');
    const full = Array.from({ length: PIN_MAX }, (_, i) => `i${i}`);
    assert.equal(placePin(full, 'new', null).full, true);
    assert.equal(placePin(full, 'i3', 'i0').full, false);
    assert.deepEqual(placePin(['a', 'gone', 'b'], 'c', null, (k) => k === 'gone').pins, ['a', 'b', 'c']);
    assert.deepEqual(unpin(['a', 'b', 'a'], 'a'), ['b']);
    assert.deepEqual(placePin('junk', 'a', null).pins, ['a']);
  });
  test('what a drop pins: this actor\'s own items (Foundry\'s drag data) and its effect rows; anything else goes on to the sheet', () => {
    const has = (id: string) => id === 'it1';
    assert.deepEqual(pinKeyOfDrop({ type: 'Item', uuid: 'Actor.A1.Item.it1' }, 'Actor.A1', has), { key: 'it1', fromBar: false });
    assert.equal(pinKeyOfDrop({ type: 'Item', uuid: 'Actor.B2.Item.it1' }, 'Actor.A1', has), null);
    assert.equal(pinKeyOfDrop({ type: 'Item', uuid: 'Item.it1' }, 'Actor.A1', has), null);
    assert.equal(pinKeyOfDrop({ type: 'Item', uuid: 'Actor.A1.Item.other' }, 'Actor.A1', has), null);
    assert.deepEqual(pinKeyOfDrop({ type: 'Item', uuid: 'Scene.s.Token.t.Actor.A1.Item.it1' }, 'Scene.s.Token.t.Actor.A1', has), { key: 'it1', fromBar: false });
    assert.deepEqual(pinKeyOfDrop({ type: PIN_DRAG_TYPE, actorUuid: 'Actor.A1', key: 'fx:s:prone' }, 'Actor.A1', has), { key: 'fx:s:prone', fromBar: false });
    assert.deepEqual(pinKeyOfDrop({ type: PIN_DRAG_TYPE, actorUuid: 'Actor.A1', key: 'it1', fromBar: true }, 'Actor.A1', has), { key: 'it1', fromBar: true });
    assert.equal(pinKeyOfDrop({ type: PIN_DRAG_TYPE, actorUuid: 'Actor.B2', key: 'it1' }, 'Actor.A1', has), null);
    assert.equal(pinKeyOfDrop(null, 'Actor.A1', has), null);
    assert.equal(pinKeyOfDrop({ type: 'Actor', uuid: 'Actor.A1' }, 'Actor.A1', has), null);
  });
  test('the bar: items by their pin action (an item with none is not pinnable), effects by name; gone ones not shown', () => {
    const act = (t: string) => (t === 'weapon' ? { action: 'attackWeapon', verb: 'Attack', icon: 'x' } : null);
    const out = pinButtons(['w', 'fx:s:prone', 'g', 'fx:gone', 'deleted'], [{ id: 'w', type: 'weapon', name: 'Gun' }, { id: 'g', type: 'gear', name: 'Rope' }],
      [{ key: 'fx:s:prone', name: 'Prone', detail: 'TN +1' }], act);
    assert.deepEqual(out.map((p) => [p.key, p.kind, p.action]), [['w', 'item', 'attackWeapon'], ['fx:s:prone', 'effect', 'jumpTo']]);
  });
  test('the wiring: the bar for owners, the ✕, effect rows carry their key, a pin dropped on the sheet unpins', () => {
    const s = tpl('sheet-summary.hbs');
    assert.ok(s.includes('{{#if tools.showPinbar}}') && s.includes('{{#if tools.canPin}} data-sr2e-pinbar{{/if}}') && s.includes('data-sr2e-unpin="{{key}}"'));
    assert.match(s, /<div class="sr2e-pinbar" role="group"\{\{#unless tools\.pins\.length\}\} data-sr2e-pin-empty\{\{\/unless\}\}/);
    // Only pinnable items (the v0.63.0 pin actions) are taken from a drop.
    assert.ok(read('src', 'module', 'applications', 'sheets935.ts').includes("pinKeyOfDrop(dragData(ev), uuid, (id) => Boolean(pinAction("));
    // The old pin buttons still work: the same action on the rows.
    assert.ok(tpl('actor-character-sheet.hbs').includes('data-action="pinItem" data-item-id="{{id}}"'));
    assert.ok(tpl('effects-section.hbs').includes('<li data-pin-key="{{pinKey}}">'));
    const st = read('src', 'module', 'applications', 'sheettools.ts');
    assert.ok(st.includes("const canPin = Boolean(actor.isOwner) && ['character', 'npc'].includes(String(actor.type));"));
    const sh = read('src', 'module', 'applications', 'sheets.ts');
    assert.ok(sh.includes('if (await pinDropOnSheet(this, data)) return;'));
    const g = read('src', 'module', 'applications', 'sheets935.ts');
    assert.ok(g.includes('if (!bar || !actor?.isOwner) return;') && g.includes('if (!actor.isOwner) return;'));
    // Only this actor's own rows are taken from the sheet's normal drop (an item from elsewhere is still added).
    assert.ok(g.includes('if (!hit) return;\n    ev.preventDefault();\n    ev.stopPropagation();'));
  });
});

describe('v0.93.5 the vehicle strip (rules/vstrip935.ts)', () => {
  const v = {
    condition: 3, boxes: 10, damageModifier: 1, destroyed: false, currentSpeed: 60, speed: 90, handling: 4, drone: true, autopilot: 3, sensor: 2,
    controller: 'Rigger', mode: 'jumped', guns: [{ id: 'g1', name: 'MG', ammo: 40, ammoMax: 50 }, { id: 'g2', name: 'Rocket', ammo: 0, ammoMax: 4 }],
    jammed: true, spoofed: false, systemsOut: ['tires'], occupants: 2,
  };
  test('the damage as text, speed, pilot and sensor, the driver jumped in, the emptiest gun, what is wrong', () => {
    const s = vehicleStrip(v);
    assert.deepEqual(s.damage, { filled: 3, boxes: 10, mod: '+1', hurt: true });
    assert.deepEqual(s.speed, { now: 60, max: 90, over: false });
    assert.equal(s.pilotKind, 'pilot');
    assert.deepEqual(s.driver, { name: 'Rigger', jumped: true, manual: false });
    assert.deepEqual(s.gun, { id: 'g2', name: 'Rocket', ammo: '0/4', low: true, out: true, more: 1 });
    assert.deepEqual(s.alerts, ['jammed', 'tires']);
  });
  test('the autopilot: no driver; a car shows Autonav; no gun with ammunition, none shown', () => {
    const s = vehicleStrip({ ...v, controller: '', mode: 'autopilot', drone: false, guns: [{ id: 'x', name: 'Ram', ammo: 0, ammoMax: 0 }], jammed: false, systemsOut: [], condition: 0, damageModifier: 0 });
    assert.equal(s.driver, null);
    assert.equal(s.pilotKind, 'autonav');
    assert.equal(s.gun, null);
    assert.deepEqual(s.alerts, []);
    assert.equal(s.damage.hurt, false);
    assert.equal(s.damage.mod, '');
  });
  test('the vehicle sheet has the strip in a stuck block, with the strip look', () => {
    const t = tpl('actor-vehicle-sheet.hbs');
    assert.ok(balanced(t));
    assert.ok(t.includes('<div class="sr2e-stuck">\n  <div class="sr2e-strip sr2e-vstrip" role="group"'));
    assert.ok(t.includes('<b>{{vstrip.damage.filled}}</b><i>/{{vstrip.damage.boxes}}</i>'));
    assert.ok(read('src', 'module', 'applications', 'sheets.ts').includes('vstrip: (() => {'));
  });
});

describe('v0.93.5 strings', () => {
  test('every key the new templates and code use has English text', () => {
    const l = lang();
    const used = new Set<string>();
    for (const f of ['sheet-summary.hbs', 'actor-vehicle-sheet.hbs', 'actor-character-sheet.hbs', 'actor-npc-sheet.hbs', 'matrix-section.hbs', 'rigging-section.hbs']) {
      for (const m of tpl(f).matchAll(/sr2eT "(SR2E\.[\w.]+)"/g)) used.add(m[1]!);
    }
    for (const f of ['sheets935.ts', 'sheettools.ts']) for (const m of read('src', 'module', 'applications', f).matchAll(/tx\('(SR2E\.[\w.]+)'/g)) used.add(m[1]!);
    for (const k of used) assert.ok(l[k], k);
    if (existsSync(DRAFT)) {
      const draft = Object.keys(JSON.parse(readFileSync(DRAFT, 'utf8')));
      const code = ['public/templates/sheet-summary.hbs', 'public/templates/actor-vehicle-sheet.hbs', 'public/templates/actor-character-sheet.hbs', 'src/module/rules/actions935.ts', 'src/module/applications/sheets935.ts', 'src/module/applications/sheettools.ts', 'src/module/applications/sheets.ts'].map((p) => read(p)).join('\n');
      for (const k of draft) assert.ok(code.includes(k), `unused: ${k}`);
    }
  });
});
