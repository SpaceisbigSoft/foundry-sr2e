/**
 * v0.66.0 GM setup tools (pure): starter kits, the session checklist, one-click token setup and
 * assigning characters to players. No Foundry here: the glue is `applications/setup.ts`.
 */
import { rowAmount, basketPlan, GEAR_STACK_FIELDS, type BasketLine } from './catalogue.ts';
import { typeLabel } from './catalogue.ts';
import { t as tx } from '../helpers/i18n.ts';

// ---------------------------------------------------------------- starter kits

/** One line of a kit: the item it makes and its number (copies, or the quantity/rating/Force for value types, as in the Add window). */
export interface KitLine extends BasketLine { type: string; name: string; system: Record<string, unknown>; amount: number }

/** A starter kit: a named bundle of items given or bought in one go. Self-contained (the item data travels with it). */
export interface StarterKit { id: string; name: string; notes: string; lines: KitLine[] }

/** Fields that are the state of one copy, not what the thing is: a kit never carries them. */
export const KIT_STATE_FIELDS = ['installed', 'worn', 'active', 'bonded', 'loaded', 'loading', 'erased', 'jammed', 'damaged', 'degraded', 'arrived', 'sustained', 'equipped'] as const;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const KIT_MAX_LINES = 60;

/** A clean copy of an item's system data for a kit (state fields dropped). */
export function kitSystem(system: unknown): Record<string, unknown> {
  const out: Record<string, unknown> = isObj(system) ? JSON.parse(JSON.stringify(system)) : {};
  for (const k of KIT_STATE_FIELDS) delete out[k];
  return out;
}

/** The number a kit line keeps for an item: its quantity, rating or Force for value types, else 1 copy. */
export function kitAmountOf(type: string, system: Record<string, unknown>): number {
  const a = rowAmount(type);
  if (a.kind === 'value' && a.field) return Math.max(1, Math.floor(Number(system[a.field] ?? 1)) || 1);
  return 1;
}

/** A kit line from stored data, or null when it isn't one. */
export function normalizeKitLine(raw: unknown, allowedTypes?: readonly string[]): KitLine | null {
  if (!isObj(raw)) return null;
  const type = String(raw['type'] ?? '').trim();
  const name = String(raw['name'] ?? '').trim();
  if (!type || !name) return null;
  if (allowedTypes && !allowedTypes.includes(type)) return null;
  const system = kitSystem(raw['system']);
  const max = rowAmount(type).kind === 'copies' ? 20 : 999;
  const amount = Math.max(1, Math.min(max, Math.floor(Number(raw['amount'] ?? kitAmountOf(type, system))) || 1));
  return { type, name, system, amount };
}

/** A kit from stored data (setting, catalogue file), or null. Lines that aren't items are dropped. */
export function normalizeKit(raw: unknown, makeId: () => string, allowedTypes?: readonly string[]): StarterKit | null {
  if (!isObj(raw)) return null;
  const name = String(raw['name'] ?? '').trim();
  if (!name) return null;
  const lines = (Array.isArray(raw['lines']) ? raw['lines'] : []).map((l) => normalizeKitLine(l, allowedTypes)).filter((l): l is KitLine => Boolean(l)).slice(0, KIT_MAX_LINES);
  const id = String(raw['id'] ?? '').trim() || makeId();
  return { id, name, notes: String(raw['notes'] ?? ''), lines };
}

/**
 * A kit from items on a sheet. Copies of the same thing (same type, name and data) become one line
 * with a number; value types (gear quantity, a spell's Force…) keep their own number.
 */
export function kitFromItems(name: string, items: ReadonlyArray<{ type: string; name: string; system: unknown }>, makeId: () => string, notes = ''): StarterKit {
  const lines: KitLine[] = [];
  for (const it of items) {
    const system = kitSystem(it.system);
    const a = rowAmount(it.type);
    const same = a.kind === 'copies' ? lines.find((l) => l.type === it.type && l.name === it.name && JSON.stringify(l.system) === JSON.stringify(system)) : undefined;
    if (same) { same.amount = Math.min(20, same.amount + 1); continue; }
    lines.push({ type: it.type, name: it.name, system, amount: kitAmountOf(it.type, system) });
  }
  return { id: makeId(), name: name.trim() || tx('SR2E.Text.Setup.newKit'), notes, lines: lines.slice(0, KIT_MAX_LINES) };
}

/** Add an item to a kit (same thing again: one more copy, or a bigger quantity for gear). */
export function addToKit(kit: StarterKit, item: { type: string; name: string; system: unknown }): StarterKit {
  const system = kitSystem(item.system);
  const lines = kit.lines.map((l) => ({ ...l }));
  const same = lines.find((l) => l.type === item.type && l.name === item.name && JSON.stringify(kitStackSystem(l.type, l.system)) === JSON.stringify(kitStackSystem(item.type, system)));
  if (same && (rowAmount(item.type).kind === 'copies' || item.type === 'gear')) {
    same.amount = Math.min(rowAmount(item.type).kind === 'copies' ? 20 : 999, same.amount + kitAmountOf(item.type, system));
  } else if (lines.length < KIT_MAX_LINES) {
    lines.push({ type: item.type, name: item.name, system, amount: kitAmountOf(item.type, system) });
  }
  return { ...kit, lines };
}

/** The system data two kit lines compare by (gear without its quantity). */
function kitStackSystem(type: string, system: Record<string, unknown>): Record<string, unknown> {
  if (type !== 'gear') return system;
  const { quantity: _q, ...rest } = system;
  return rest;
}

/** Plain-English summary of a kit ("Heavy pistol, Armor jacket, Medkit ×3"). */
export function kitSummary(kit: StarterKit, max = 6): string {
  const parts = kit.lines.map((l) => `${l.name}${l.amount > 1 ? (rowAmount(l.type).kind === 'copies' || l.type === 'gear' ? ` ×${l.amount}` : ` ${rowAmount(l.type).label} ${l.amount}`) : ''}`);
  return parts.length > max ? tx('SR2E.Text.Setup.andMore', { list: parts.slice(0, max).join(', '), count: parts.length - max }) : parts.join(', ') || tx('SR2E.Text.Setup.empty');
}

/** The lines of a kit an actor type can hold, and the names of those it can't. */
export function kitLinesFor(kit: StarterKit, allowedTypes: readonly string[]): { lines: KitLine[]; skipped: string[] } {
  const lines = kit.lines.filter((l) => allowedTypes.includes(l.type));
  const skipped = kit.lines.filter((l) => !allowedTypes.includes(l.type)).map((l) => `${l.name} (${typeLabel(l.type, false)})`);
  return { lines, skipped };
}

/** The nuyen price of a kit (each line as the Add window prices it) and any lines with no price. */
export function kitPrice(kit: StarterKit, actorType = 'character'): { nuyen: number; unpriced: string[] } {
  const plan = basketPlan(kit.lines, { payment: 'buy', actorType, nuyen: Number.MAX_SAFE_INTEGER, karma: 0 });
  const unpriced = plan.per.filter((p) => p.nuyen <= 0).map((p) => p.name);
  return { nuyen: plan.nuyen, unpriced };
}

/** Kits merged into a list: same name replaced (keeping the old id) or skipped. */
export function mergeKits(existing: readonly StarterKit[], incoming: readonly StarterKit[], mode: 'replace' | 'skip', makeId: () => string = () => Math.random().toString(36).slice(2, 12)): { list: StarterKit[]; added: number; replaced: number; skipped: number } {
  const list = existing.map((k) => ({ ...k }));
  let added = 0, replaced = 0, skipped = 0;
  for (const k of incoming) {
    const i = list.findIndex((x) => x.name.toLowerCase() === k.name.toLowerCase());
    // A new kit whose id is taken (renamed since the file was saved) gets a fresh one.
    if (i < 0) { let id = k.id; while (!id || list.some((x) => x.id === id)) id = makeId(); list.push({ ...k, id }); added++; continue; }
    if (mode === 'skip') { skipped++; continue; }
    list[i] = { ...k, id: list[i]!.id };
    replaced++;
  }
  return { list, added, replaced, skipped };
}

// ---------------------------------------------------------------- session checklist

/** Things the GM panel can do from a checklist line. */
export const CHECKLIST_ACTIONS = ['refreshKarma', 'refreshPools', 'award', 'tokenSetup', 'tab:scene', 'tab:party', 'tab:world', 'tab:requests', 'tab:combat', 'tab:setup', 'endCombat'] as const;
export type ChecklistAction = typeof CHECKLIST_ACTIONS[number] | '';

export interface ChecklistLine { id: string; text: string; action: ChecklistAction; done: boolean }
export interface SessionChecklist { start: ChecklistLine[]; end: ChecklistLine[]; session: number; startedAt: number | null }

/** The lines a new world starts with (the GM can add, change and remove them). */
export function defaultChecklist(): SessionChecklist {
  const l = (id: string, text: string, action: ChecklistAction = ''): ChecklistLine => ({ id, text, action, done: false });
  return {
    start: [
      l('s-tokens', tx('SR2E.Text.Setup.everyoneHasACharacter'), 'tokenSetup'),
      l('s-requests', tx('SR2E.Text.Setup.answerWaitingRequests'), 'tab:requests'),
      l('s-karma', tx('SR2E.Text.Setup.refreshKarmaPools'), 'refreshKarma'),
      l('s-pools', tx('SR2E.Text.Setup.refreshDicePools'), 'refreshPools'),
      l('s-scene', tx('SR2E.Text.Setup.setTheScene'), 'tab:scene'),
      l('s-upkeep', tx('SR2E.Text.Setup.checkLifestyles'), 'tab:party'),
    ],
    end: [
      l('e-combat', tx('SR2E.Text.Setup.endAnyCombat'), 'endCombat'),
      l('e-award', tx('SR2E.Text.Setup.awardKarmaAndNuyen'), 'award'),
      l('e-time', tx('SR2E.Text.Setup.moveWorldTimeOn'), 'tab:scene'),
      l('e-notes', tx('SR2E.Text.Setup.writeDownWhatHappened')),
      l('e-upkeep', tx('SR2E.Text.Setup.collectLifestyleUpkeep'), 'tab:party'),

    ],
    session: 1,
    startedAt: null,
  };
}

const lineOf = (raw: unknown, i: number, part: string): ChecklistLine | null => {
  if (!isObj(raw)) return null;
  const text = String(raw['text'] ?? '').trim();
  if (!text) return null;
  const action = String(raw['action'] ?? '');
  return { id: String(raw['id'] ?? '').trim() || `${part}-${i}`, text: text.slice(0, 200), action: ((CHECKLIST_ACTIONS as readonly string[]).includes(action) ? action : '') as ChecklistAction, done: Boolean(raw['done']) };
};

/** A checklist from the stored setting (missing or broken: the default). */
export function normalizeChecklist(raw: unknown): SessionChecklist {
  if (!isObj(raw) || (!Array.isArray(raw['start']) && !Array.isArray(raw['end']))) return defaultChecklist();
  const part = (k: 'start' | 'end') => (Array.isArray(raw[k]) ? (raw[k] as unknown[]) : []).map((x, i) => lineOf(x, i, k)).filter((x): x is ChecklistLine => Boolean(x)).slice(0, 40);
  const startedAt = raw['startedAt'];
  return { start: part('start'), end: part('end'), session: Math.max(1, Math.floor(Number(raw['session'] ?? 1)) || 1), startedAt: typeof startedAt === 'number' && Number.isFinite(startedAt) ? startedAt : null };
}

/** Tick or untick a line. */
export function toggleChecklistLine(c: SessionChecklist, id: string, done?: boolean): SessionChecklist {
  const flip = (l: ChecklistLine) => (l.id === id ? { ...l, done: done ?? !l.done } : l);
  return { ...c, start: c.start.map(flip), end: c.end.map(flip) };
}

/** A new session: every tick cleared, the session number one higher, its start time noted. */
export function newSession(c: SessionChecklist, now: number): SessionChecklist {
  const clear = (l: ChecklistLine) => ({ ...l, done: false });
  return { ...c, start: c.start.map(clear), end: c.end.map(clear), session: c.session + 1, startedAt: now };
}

/** Add a line to the start or end list (ids stay unique). */
export function addChecklistLine(c: SessionChecklist, part: 'start' | 'end', text: string, action: ChecklistAction = ''): SessionChecklist {
  const t = String(text ?? '').trim().slice(0, 200);
  if (!t) return c;
  const ids = new Set([...c.start, ...c.end].map((l) => l.id));
  let n = c[part].length + 1;
  while (ids.has(`${part}-u${n}`)) n++;
  return { ...c, [part]: [...c[part], { id: `${part}-u${n}`, text: t, action, done: false }] };
}

export function removeChecklistLine(c: SessionChecklist, id: string): SessionChecklist {
  return { ...c, start: c.start.filter((l) => l.id !== id), end: c.end.filter((l) => l.id !== id) };
}

/** "3/6" for each part. */
export function checklistProgress(c: SessionChecklist): { start: string; end: string; allStart: boolean; allEnd: boolean } {
  const p = (ls: ChecklistLine[]) => `${ls.filter((l) => l.done).length}/${ls.length}`;
  return { start: p(c.start), end: p(c.end), allStart: c.start.every((l) => l.done), allEnd: c.end.every((l) => l.done) };
}

// ---------------------------------------------------------------- token setup

/** Foundry's token constants this needs (passed in, so this stays pure). */
export interface TokenConsts { FRIENDLY: number; NEUTRAL: number; HOSTILE: number; OWNER_HOVER: number; OWNER: number; ALWAYS: number; HOVER: number }

export interface TokenSetupOptions {
  /** Link the token to the actor (player-owned characters only: NPC tokens keep their own copies). */
  link: boolean;
  /** Physical and Stun bars (vehicles: the condition track). */
  bars: boolean;
  /** Turn sight on (the eyes themselves come from the actor's vision: `visionUpdate`). */
  vision: boolean;
  /** Who sees the name and bars. */
  show: 'owner-hover' | 'owner' | 'always' | 'hover';
  /** Friendly for player characters, hostile or neutral for others. */
  disposition: 'auto' | 'friendly' | 'neutral' | 'hostile';
}

export const TOKEN_SETUP_DEFAULTS: TokenSetupOptions = { link: true, bars: true, vision: true, show: 'owner-hover', disposition: 'auto' };

/**
 * The prototype-token changes (dotted keys, without the `prototypeToken.` prefix) for an actor:
 * linked, bars on the SR2 tracks, sight on, display modes and disposition.
 */
export function tokenSetupPlan(actor: { type: string; playerOwned: boolean }, o: TokenSetupOptions, C: TokenConsts): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const people = ['character', 'npc', 'spirit'].includes(actor.type);
  if (o.link && actor.playerOwned && actor.type === 'character') out['actorLink'] = true;
  const mode = o.show === 'owner' ? C.OWNER : o.show === 'always' ? C.ALWAYS : o.show === 'hover' ? C.HOVER : C.OWNER_HOVER;
  if (o.bars) {
    if (people) { out['bar1.attribute'] = 'derived.bars.physical'; out['bar2.attribute'] = 'derived.bars.stun'; }
    else if (actor.type === 'vehicle') { out['bar1.attribute'] = 'derived.bars.condition'; out['bar2.attribute'] = null; }
    out['displayBars'] = mode;
  }
  out['displayName'] = mode;
  if (o.vision && (people || actor.type === 'vehicle')) out['sight.enabled'] = true;
  const disp = o.disposition === 'auto' ? (actor.playerOwned ? 'friendly' : actor.type === 'npc' ? 'hostile' : 'neutral') : o.disposition;
  out['disposition'] = disp === 'friendly' ? C.FRIENDLY : disp === 'hostile' ? C.HOSTILE : C.NEUTRAL;
  return out;
}

/** The same changes for a placed token (unlinked tokens of a linked prototype stay as they are: Foundry can't relink them safely). */
export function placedTokenPlan(plan: Record<string, unknown>, tokenLinked: boolean): Record<string, unknown> {
  const out = { ...plan };
  if (!tokenLinked) delete out['actorLink'];
  return out;
}

// ---------------------------------------------------------------- assigning characters to players

export interface AssignUser { id: string; name: string; isGM: boolean; character: string | null }
export interface AssignActor { id: string; name: string; owners: string[] }

/**
 * What changes when each player gets a character: the user's own character, and Owner on that actor
 * for them. Ownership others have is left alone (two players can share a sheet). An empty pick clears
 * the user's character only.
 */
export function assignmentPlan(users: readonly AssignUser[], actors: readonly AssignActor[], picks: Readonly<Record<string, string>>): {
  users: Array<{ id: string; character: string | null }>; owners: Array<{ actorId: string; userId: string }>; lines: string[];
} {
  const outU: Array<{ id: string; character: string | null }> = [];
  const outO: Array<{ actorId: string; userId: string }> = [];
  const lines: string[] = [];
  for (const u of users) {
    if (u.isGM || !(u.id in picks)) continue;
    const want = picks[u.id] || null;
    const a = want ? actors.find((x) => x.id === want) : null;
    if (want && !a) continue;
    if ((u.character ?? null) !== (want ?? null)) {
      outU.push({ id: u.id, character: want });
      lines.push(a ? tx('SR2E.Text.Setup.userPlays', { user: u.name, actor: a.name }) : tx('SR2E.Text.Setup.userHasNoCharacter', { user: u.name }));
    }
    if (a && !a.owners.includes(u.id)) {
      outO.push({ actorId: a.id, userId: u.id });
      if ((u.character ?? null) === want) lines.push(tx('SR2E.Text.Setup.userNowOwns', { user: u.name, actor: a.name }));

    }
  }
  return { users: outU, owners: outO, lines };
}

// ---------------------------------------------------------------- module support

/** Actor types with no condition monitor to estimate (Health Estimate leaves their tokens alone). */
export const NO_HEALTH_TYPES = ['host', 'site', 'safehouse', 'barrier'] as const;

/**
 * How healthy an actor looks, 0 (down) to 1 (unhurt), for Health Estimate: people by the worse of their
 * Physical and Stun tracks (beyond the Physical track is 0), vehicles by their condition track, IC by its
 * Matrix monitor. Null for actor types with no track.
 */
export function healthFraction(a: { type: string; system?: any }, boxes: { people: number; vehicle: number; matrix: number }): number | null {
  const s = a.system ?? {};
  const left = (dmg: unknown, max: number) => (max > 0 ? Math.max(0, Math.min(1, (max - Math.max(0, Number(dmg) || 0)) / max)) : 1);
  if (['character', 'npc', 'spirit'].includes(a.type)) return Math.min(left(s.monitor?.physical, boxes.people), left(s.monitor?.stun, boxes.people));
  if (a.type === 'vehicle') return left(s.condition, boxes.vehicle);
  if (a.type === 'ic') return left(s.matrix?.monitor, boxes.matrix);
  return null;
}

/** The Item Piles integration (pure data; the glue adds the price function and registers it). */
export function itemPilesConfig(o: { version: string; nuyenImg: string }): Record<string, unknown> {
  return {
    VERSION: o.version,
    ACTOR_CLASS_TYPE: 'npc',
    ITEM_CLASS_LOOT_TYPE: 'gear',
    ITEM_CLASS_WEAPON_TYPE: 'weapon',
    ITEM_CLASS_EQUIPMENT_TYPE: 'armor',
    ITEM_QUANTITY_ATTRIBUTE: 'system.quantity',
    ITEM_PRICE_ATTRIBUTE: 'system.cost',
    // Knowledge and magic aren't loot; installed cyberware and bonded foci stay with their owner.
    ITEM_FILTERS: [
      { path: 'type', filters: 'skill,spell,power,adeptpower' },
      { path: 'system.installed', filters: 'true' },
      { path: 'system.bonded', filters: 'true' },
    ],
    // What makes two items the same thing: the system's own gear stacking fields (v0.81.0, RC-3: one shared list;
    // the old copy named a missing `system.explosive.rating`). A rating 3 medkit isn't a rating 6 one.
    // v0.81.1 (RC2-2): the list is every gear field now; the one array field (skillMods) is left out, since a value
    // compare of two arrays is never equal.
    ITEM_SIMILARITIES: ['name', 'type', ...GEAR_STACK_FIELDS.filter((f) => f !== 'skillMods' && f !== 'tweaks').map((f) => `system.${f}`)],
    // Only gear stacks: every other physical item is one thing per item (its quantity is always 1).
    UNSTACKABLE_ITEM_TYPES: ['weapon', 'armor', 'cyberware', 'focus', 'cyberdeck', 'program'],
    CURRENCIES: [{ type: 'attribute', name: 'Nuyen', img: o.nuyenImg, abbreviation: '¥{#}', data: { path: 'system.nuyen' }, primary: true, exchangeRate: 1 }],
    CURRENCY_DECIMAL_DIGITS: 0,
  };
}
