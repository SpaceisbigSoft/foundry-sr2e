/**
 * v0.81.0 (lead, after the R2 review): routine tests a card forces on someone go ahead without a confirm when the
 * card's author owns a character the card names as its source; costly or permanent ones still confirm.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const g = globalThis as any;
const confirms: any[] = [];
g.foundry ??= {};
g.foundry.applications ??= { api: {} };
g.foundry.applications.api.DialogV2 = { confirm: async (o: any) => { confirms.push(o); return false; } };
g.ui = { notifications: { warn() {}, info() {}, error() {} } };
const docs = new Map<string, any>();
g.fromUuidSync = (u: string) => docs.get(u) ?? null;

test('playerMay: routine → no confirm when the author owns a named source; otherwise a confirm', async () => {
  const { playerMay } = await import('../applications/trust.ts');
  const player = { id: 'p1', isGM: false, name: 'Player' };
  const mine = { uuid: 'Actor.mine', name: 'Mine', ownership: { p1: 3 } };
  const npc = { uuid: 'Actor.npc', name: 'NPC', ownership: { default: 0 } };
  const other = { uuid: 'Actor.other', name: 'Other', ownership: { default: 0 } };
  for (const d of [mine, npc, other]) docs.set(d.uuid, d);
  const msg = { author: player };
  confirms.length = 0;
  // v0.81.1 (design 2): `routine` names the card's real source fields (the attacker, the caster), never the speaker.
  assert.equal(await playerMay(msg, npc, [mine.uuid], 'NPC defends', { routine: [mine.uuid] }), true);
  assert.equal(confirms.length, 0, 'no confirm for a routine test from the author\'s own character');
  assert.equal(await playerMay(msg, npc, [other.uuid], 'NPC defends', { routine: [other.uuid] }), false);
  assert.equal(confirms.length, 1, 'a source the author does not own asks (and No refuses)');
  assert.equal(await playerMay(msg, npc, [mine.uuid], 'NPC loses Magic'), false);
  assert.equal(confirms.length, 2, 'a non-routine change still asks even from the author\'s own character');
});
