/**
 * v0.66.0 GM setup tools: the GM panel's Setup tab.
 * - Starter kits: bundles of items made from a sheet (or by dropping items on a kit), given to several
 *   actors at once, or picked in the Add window's Kits tab (free, or bought by a player).
 * - The session checklist (start and end of a session), with buttons that do the step.
 * - Players and characters: who plays which character (the user's character and Owner on it).
 * - One-click token setup: linked, Physical/Stun bars, vision, names and disposition.
 * - Catalogue tools (paste spreadsheet rows, CSV export, a catalogue file between worlds) and the
 *   character stat-block import: see `applications/catalogue.ts`.
 * The rules are in `rules/setup.ts`.
 */
import { findAllPortraits } from './look.ts';
import { defaultArtForAll, standInCount } from './tokenart.ts';
import { cleanFolder } from '../rules/look.ts';
import { SYSTEM } from '../config/system.ts';
import { RULES_SOURCES, URR_V80_PATCH } from '../rules/index.ts';
import {
  normalizeKit, kitFromItems, addToKit, kitSummary, kitLinesFor, kitPrice, normalizeChecklist, toggleChecklistLine, newSession, addChecklistLine,
  removeChecklistLine, checklistProgress, rowAmount, tokenSetupPlan, placedTokenPlan, TOKEN_SETUP_DEFAULTS, assignmentPlan, typeLabel,
  type StarterKit, type SessionChecklist, type TokenSetupOptions, type ChecklistAction,
} from '../rules/index.ts';
import { ITEM_TYPES_FOR } from './drops.ts';
import { createFromBasket } from './sheettools.ts';
import { groupActors } from './groups.ts';
import { syncTokenVision } from './tokens.ts';
import { escHtml } from '../rules/html.ts';
import { createDemo, removeDemo, demoExists } from './demo.ts';
import { t as tx, tCount, tKey } from '../helpers/i18n.ts';

const { DialogV2 } = foundry.applications.api;
/** A-15: the shared escape helper (rules/html.ts). */
const esc = escHtml;
const randomId = () => (foundry.utils as any).randomID?.() ?? Math.random().toString(36).slice(2, 12);
const CONSTS = (): any => (globalThis as any).CONST ?? {};
const isGM = () => Boolean((game as any).user?.isGM);

// ---------------------------------------------------------------- stored data

/** The world's starter kits. */
export function kits(): StarterKit[] {
  let raw: unknown[] = [];
  try { raw = ((game.settings.get(SYSTEM.id, 'starterKits') as unknown[]) ?? []); } catch { raw = []; }
  return raw.map((k) => normalizeKit(k, randomId)).filter((k): k is StarterKit => Boolean(k));
}
export async function saveKits(list: StarterKit[]): Promise<void> {
  await game.settings.set(SYSTEM.id, 'starterKits', list);
}

/** Read-change-write of a world setting, one at a time (quick ticks or drops don't lose each other). */
let chain: Promise<unknown> = Promise.resolve();
export function serial<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn, fn);
  chain = run.catch(() => undefined);
  return run;
}
/** Change the kit list: the change reads the list as it is when its turn comes. */
export function changeKits(fn: (list: StarterKit[]) => StarterKit[] | null): Promise<void> {
  return serial(async () => { const next = fn(kits()); if (next) await saveKits(next); });
}
export function checklist(): SessionChecklist {
  try { return normalizeChecklist(game.settings.get(SYSTEM.id, 'sessionChecklist')); } catch { return normalizeChecklist(null); }
}
async function saveChecklist(c: SessionChecklist): Promise<void> { await game.settings.set(SYSTEM.id, 'sessionChecklist', c); }
export function tokenOptions(): TokenSetupOptions {
  let raw: any = {};
  try { raw = game.settings.get(SYSTEM.id, 'tokenSetup') ?? {}; } catch { raw = {}; }
  const o = { ...TOKEN_SETUP_DEFAULTS };
  for (const k of ['link', 'bars', 'vision'] as const) if (typeof raw[k] === 'boolean') o[k] = raw[k];
  if (['owner-hover', 'owner', 'always', 'hover'].includes(raw.show)) o.show = raw.show;
  if (['auto', 'friendly', 'neutral', 'hostile'].includes(raw.disposition)) o.disposition = raw.disposition;
  return o;
}

let refresh: () => void = () => {};
/** One run at a time per key (a double click opens one dialog). */
const busy = new Set<string>();
export async function once<T>(key: string, fn: () => Promise<T>): Promise<T | undefined> {
  if (busy.has(key)) return undefined;
  busy.add(key);
  try { return await fn(); } finally { busy.delete(key); }
}
/** The GM panel passes its refresh in (no import loop). */
export function setSetupRefresh(fn: () => void): void { refresh = fn; }
/** Re-render the GM panel's Setup tab (when it is open). */
export function refreshSetup(): void { refresh(); }

// ---------------------------------------------------------------- the tab's context

/** v0.89.6: the buttons a checklist line can have (made when used, in the user's language). */
const ACTION_LABELS = (): Record<string, string> => ({
  refreshKarma: tx('SR2E.App.Setup.refresh'), refreshPools: tx('SR2E.App.Setup.refresh'), award: tx('SR2E.App.Setup.award'), tokenSetup: tx('SR2E.App.Setup.setUp'), endCombat: tx('SR2E.App.Setup.endIt'),
  'tab:scene': tx('SR2E.App.Setup.sceneTab'), 'tab:party': tx('SR2E.App.Setup.partyTab'), 'tab:world': tx('SR2E.App.Setup.worldTab'), 'tab:requests': tx('SR2E.App.Setup.requests'), 'tab:combat': tx('SR2E.App.Setup.combatTab'), 'tab:setup': tx('SR2E.App.Setup.setup'),
});

export function setupContext(): Record<string, unknown> {
  const c = checklist();
  const p = checklistProgress(c);
  const labels = ACTION_LABELS();
  const line = (l: any) => ({ ...l, actionLabel: l.action ? labels[l.action] ?? '' : '' });
  const users = [...((game as any).users ?? [])].filter((u: any) => !u.isGM);
  const chars = [...((game as any).actors ?? [])].filter((a: any) => a.type === 'character').sort((a: any, b: any) => a.name.localeCompare(b.name));
  const opts = tokenOptions();
  const k = kits();
  let templates: any[] = [];
  try { templates = (game.settings.get(SYSTEM.id, 'itemTemplates') as any[]) ?? []; } catch { templates = []; }
  const byType = new Map<string, number>();
  for (const t of templates) byType.set(t.type, (byType.get(t.type) ?? 0) + 1);
  const mod = (id: string) => { const m: any = (game as any).modules?.get?.(id); return m ? (m.active ? tx('SR2E.App.Setup.active') : tx('SR2E.App.Setup.installedNotActive')) : tx('SR2E.App.Setup.notInstalled'); };
  let portraitFolder = '';
  try { portraitFolder = cleanFolder(game.settings.get(SYSTEM.id, 'portraitFolder')); } catch { portraitFolder = ''; }
  // v0.80.0: the rules source (Book Rules or the Unified Rules Revamp).
  let source = 'book';
  try { source = String(game.settings.get(SYSTEM.id, 'rulesSource') ?? 'book'); } catch { source = 'book'; }
  return {
    // v0.88.0: whether the starter demo is in the world.
    demo: { exists: demoExists() },
    rulesSource: { id: source, label: tKey((RULES_SOURCES as Record<string, string>)[source] ?? RULES_SOURCES.book), urr: source === 'urr',
      count: Object.keys(URR_V80_PATCH).length - 1,
      choices: Object.entries(RULES_SOURCES).map(([id, label]) => ({ id, label: tKey(label), selected: id === source })) },
    // v0.67.0: portraits found by name.
    portraitFolder,
    // v0.83.0: the default token art.
    defaultArt: (() => { const k = standInCount(); let on = true; try { on = game.settings.get(SYSTEM.id, 'defaultArt') !== false; } catch { on = true; } return { on, standIns: k, one: k === 1 }; })(),
    checklist: { session: c.session, start: c.start.map(line), end: c.end.map(line), progress: p,
      started: c.startedAt ? new Date(c.startedAt).toLocaleString() : '' },
    players: users.map((u: any) => ({ id: u.id, name: u.name, active: Boolean(u.active),
      chars: [{ id: '', name: tx('SR2E.App.Setup.none'), selected: !u.character },
        // Someone already playing an NPC, spirit or vehicle keeps it (it is listed for them).
        ...(u.character && u.character.type !== 'character' ? [{ id: u.character.id, name: `${u.character.name} (${u.character.type})`, selected: true }] : []),
        ...chars.map((a: any) => ({ id: a.id, name: a.name, selected: u.character?.id === a.id }))] })),
    unowned: chars.filter((a: any) => !a.hasPlayerOwner).map((a: any) => a.name).join(', '),
    tokenOpts: { ...opts, shows: [['owner-hover', tx('SR2E.App.Setup.ownerAndOthersOnHover')], ['owner', tx('SR2E.App.Setup.ownerOnly')], ['hover', tx('SR2E.App.Setup.anyoneOnHover')], ['always', tx('SR2E.App.Setup.alwaysToEveryone')]].map(([id, label]) => ({ id, label, selected: id === opts.show })),
      dispositions: [['auto', tx('SR2E.App.Setup.playersFriendlyNpcsHostile')], ['friendly', tx('SR2E.App.Setup.friendly')], ['neutral', tx('SR2E.App.Setup.neutral')], ['hostile', tx('SR2E.App.Setup.hostile')]].map(([id, label]) => ({ id, label, selected: id === opts.disposition })) },
    kits: k.map((x) => { const pr = kitPrice(x); return { id: x.id, name: x.name, notes: x.notes, count: x.lines.length, summary: kitSummary(x), price: pr.nuyen ? `¥${pr.nuyen.toLocaleString()}` : '', unpriced: pr.unpriced.length }; }),
    templateCounts: [...byType.entries()].map(([t, n]) => `${typeLabel(t, n !== 1)} ${n}`).join(' · '),
    templateTotal: templates.length,
    modules: [
      { name: 'Item Piles', state: mod('item-piles'), note: tx('SR2E.App.Setup.lootPilesMerchantsAndTrading') },
      { name: 'Health Estimate', state: mod('healthEstimate'), note: tx('SR2E.App.Setup.aTokensHealthInWords') },
      { name: 'Dice So Nice', state: mod('dice-so-nice'), note: tx('SR2E.App.Setup.3dDiceInSr2eColours') },
      { name: 'Token Action HUD Core', state: mod('token-action-hud-core'), note: tx('SR2E.App.Setup.attacksSpellsSkillsAndPools') },
    ],
  };
}

// ---------------------------------------------------------------- picking people

/** Pick actors: the selected tokens, the party, or ticked from a list. Returns [] when cancelled. */
async function pickActors(title: string, types: readonly string[], verb: string): Promise<any[]> {
  const all = [...((game as any).actors ?? [])].filter((a: any) => types.includes(a.type)).sort((a: any, b: any) => a.name.localeCompare(b.name));
  const sel = groupActors('selected').filter((a: any) => types.includes(a.type));
  const r = await DialogV2.prompt({
    window: { title },
    position: { width: 440 },
    content: `<div class="form-group"><label>${tx('SR2E.Dialog.Setup.who')}</label><select name="who">
        <option value="list">${tx('SR2E.Dialog.Setup.theOnesTickedBelow')}</option>
        <option value="selected" ${sel.length ? 'selected' : ''}>${tx('SR2E.Dialog.Setup.selectedTokens', { selLength: sel.length })}</option>
        <option value="party">${tx('SR2E.Dialog.Setup.thePartyPlayerCharacters')}</option></select></div>
      <fieldset class="sr2e-pick-list"><legend>${tx('SR2E.Dialog.Setup.actors')}</legend>${all.map((a: any) => `<label class="sr2e-check"><input type="checkbox" name="pick" value="${esc(a.uuid)}"> ${esc(a.name)} <span class="hint">${esc(a.type)}</span></label>`).join('') || `<em>${tx('SR2E.Dialog.Setup.none')}</em>`}</fieldset>`,
    ok: { label: verb, callback: (_e: Event, b: any) => ({ who: String(b.form.elements.who.value), picks: [...b.form.querySelectorAll('input[name="pick"]:checked')].map((i: any) => String(i.value)) }) },
    rejectClose: false,
  });
  if (!r) return [];
  const out = r.who === 'list' ? r.picks.map((u: string) => fromUuidSync(u)).filter(Boolean) : groupActors(r.who);
  return out.filter((a: any) => types.includes(a.type));
}

// ---------------------------------------------------------------- kits

/** GM: make a kit from items on a sheet (tick which). */
async function newKitFromSheet(): Promise<void> {
  const holders = [...((game as any).actors ?? [])].filter((a: any) => a.items?.size).sort((a: any, b: any) => a.name.localeCompare(b.name));
  if (!holders.length) return void ui.notifications.info(tx('SR2E.Notify.Setup.noActorHoldsItemsYetMake'));
  const first = await DialogV2.prompt({
    window: { title: tx('SR2E.Dialog.Setup.newKitFromASheet') },
    content: `<div class="form-group"><label>${tx('SR2E.Dialog.Setup.kitName')}</label><input name="name" type="text" autofocus placeholder="${tx('SR2E.Dialog.Setup.eGStreetSamuraiStarter')}"></div>
      <div class="form-group"><label>${tx('SR2E.Dialog.Setup.takeTheItemsOf')}</label><select name="actor">${holders.map((a: any) => `<option value="${esc(a.uuid)}">${esc(a.name)} (${esc(a.items.size)})</option>`).join('')}</select></div>`,
    ok: { label: tx('SR2E.Dialog.Setup.next'), callback: (_e: Event, b: any) => ({ name: String(b.form.elements.name.value ?? '').trim(), uuid: String(b.form.elements.actor.value) }) },
    rejectClose: false,
  });
  if (!first) return;
  const actor: any = fromUuidSync(first.uuid);
  if (!actor) return;
  const items = [...actor.items].sort((a: any, b: any) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name));
  const ids = await DialogV2.prompt({
    window: { title: tx('SR2E.Dialog.Setup.kitFrom', { actorName: actor.name }) },
    position: { width: 460 },
    content: `<p class="hint">${tx('SR2E.Dialog.Setup.tickWhatGoesInTheKit')}</p>
      <fieldset class="sr2e-pick-list">${items.map((i: any) => `<label class="sr2e-check"><input type="checkbox" name="item" value="${esc(i.id)}" ${['skill', 'power'].includes(i.type) ? '' : 'checked'}> ${esc(i.name)} <span class="hint">${esc(typeLabel(i.type, false))}</span></label>`).join('')}</fieldset>`,
    ok: { label: tx('SR2E.Dialog.Setup.makeTheKit'), callback: (_e: Event, b: any) => [...b.form.querySelectorAll('input[name="item"]:checked')].map((i: any) => String(i.value)) },
    rejectClose: false,
  });
  if (!ids?.length) return;
  const picked = items.filter((i: any) => ids.includes(i.id)).map((i: any) => ({ type: i.type, name: i.name, system: i.system?.toObject?.() ?? i.system }));
  const kit = kitFromItems(first.name || `${actor.name}'s kit`, picked, randomId);
  await changeKits((l) => [...l, kit]);
  ui.notifications.info(tx('SR2E.Notify.Setup.kitMade', { kitName: escHtml(kit.name), kitSummary: escHtml(kitSummary(kit)) }));
  refresh();
}

async function newEmptyKit(): Promise<void> {
  const name = await DialogV2.prompt({
    window: { title: tx('SR2E.Dialog.Setup.newEmptyKit') },
    content: `<div class="form-group"><label>${tx('SR2E.Dialog.Setup.kitName')}</label><input name="name" type="text" autofocus></div><p class="hint">${tx('SR2E.Dialog.Setup.thenDropItemsOnItIn')}</p>`,
    ok: { label: tx('SR2E.Dialog.Setup.makeIt'), callback: (_e: Event, b: any) => String(b.form.elements.name.value ?? '').trim() },
    rejectClose: false,
  });
  if (!name) return;
  await changeKits((l) => [...l, { id: randomId(), name, notes: '', lines: [] }]);
  refresh();
}

/** GM: rename a kit, change its numbers and notes, take lines out. */
async function editKit(id: string): Promise<void> {
  const list = kits();
  const kit = list.find((k) => k.id === id);
  if (!kit) return;
  const r = await DialogV2.prompt({
    window: { title: tx('SR2E.Dialog.Setup.editKit', { kitName: kit.name }) },
    position: { width: 480 },
    content: `<div class="form-group"><label>${tx('SR2E.Dialog.Setup.name')}</label><input name="name" type="text" value="${esc(kit.name)}"></div>
      <div class="form-group"><label>${tx('SR2E.Dialog.Setup.notes')}</label><input name="notes" type="text" value="${esc(kit.notes)}" placeholder="${tx('SR2E.Dialog.Setup.eGForNewRunners')}"></div>
      <table class="sr2e-group"><tr><th>${tx('SR2E.Dialog.Setup.item')}</th><th>${tx('SR2E.Dialog.Setup.type')}</th><th>${tx('SR2E.Dialog.Setup.number')} <span class="hint">${tx('SR2E.Dialog.Setup.copiesQuantityRatingOrForce')}</span></th><th title="${tx('SR2E.Dialog.Setup.takeItOutOfTheKit')}">${tx('SR2E.Dialog.Setup.out')}</th></tr>
      ${kit.lines.map((l, i) => `<tr><td>${esc(l.name)}</td><td>${esc(typeLabel(l.type, false))}</td><td title="${esc(rowAmount(l.type).label)}"><input type="number" name="amt-${i}" value="${l.amount}" min="1" max="999" style="width:5em"></td><td><input type="checkbox" name="del-${i}"></td></tr>`).join('') || `<tr><td colspan="4"><em>${tx('SR2E.Dialog.Setup.emptyDropItemsOnTheKit')}</em></td></tr>`}</table>`,
    ok: { label: tx('SR2E.Dialog.Setup.save'), callback: (_e: Event, b: any) => {
      const f = b.form.elements;
      return { name: String(f.name.value ?? '').trim(), notes: String(f.notes.value ?? ''),
        edited: kit.lines.map((_l, i) => ({ out: Boolean(f[`del-${i}`]?.checked), amount: Math.max(1, Math.floor(Number(f[`amt-${i}`]?.value) || 1)) })) };
    } },
    rejectClose: false,
  });
  if (!r) return;
  // Lines dropped on the kit while the dialog was open are kept: edits go to the lines that were shown.
  await changeKits((now) => {
    const cur = now.find((k) => k.id === id);
    if (!cur) return null;
    const shown = kit.lines.map((l) => JSON.stringify([l.type, l.name, l.system]));
    const used = new Set<number>();
    const lines = cur.lines.flatMap((l) => {
      const k = JSON.stringify([l.type, l.name, l.system]);
      const i = shown.findIndex((x, j) => x === k && !used.has(j));
      if (i < 0) return [l];
      used.add(i);
      const e = r.edited[i];
      return e?.out ? [] : [{ ...l, amount: e?.amount ?? l.amount }];
    });
    const next = normalizeKit({ ...cur, name: r.name || cur.name, notes: r.notes, lines }, randomId);
    return next ? now.map((k) => (k.id === id ? next : k)) : null;
  });
  refresh();
}

async function deleteKit(id: string): Promise<void> {
  const kit = kits().find((k) => k.id === id);
  if (!kit) return;
  const ok = await DialogV2.confirm({ window: { title: tx('SR2E.Dialog.Setup.deleteTheKit2') }, content: `<p>${tx('SR2E.Dialog.Setup.deleteTheKit')} <strong>${esc(kit.name)}</strong>${tx('SR2E.Dialog.Setup.itemsAlreadyGivenStayWhereThey')}</p>`, rejectClose: false });
  if (!ok) return;
  await changeKits((l) => l.filter((k) => k.id !== id));
  refresh();
}

/** An item dropped on a kit row goes into the kit. */
export async function dropOnKit(kitId: string, data: any): Promise<boolean> {
  if (!isGM() || data?.type !== 'Item' || !data.uuid) return false;
  const item: any = await fromUuid(data.uuid);
  if (!item) return false;
  let name = '';
  let full = false;
  await changeKits((list) => {
    const kit = list.find((k) => k.id === kitId);
    if (!kit) return null;
    name = kit.name;
    const next = addToKit(kit, { type: item.type, name: item.name, system: item.system?.toObject?.() ?? item.system });
    if (JSON.stringify(next) === JSON.stringify(kit)) { full = true; return null; }
    return list.map((k) => (k.id === kitId ? next : k));
  });
  if (!name) return false;
  if (full) { ui.notifications.warn(tx('SR2E.Notify.Setup.theKitIsFull', { name: escHtml(name) })); return false; }
  ui.notifications.info(tx('SR2E.Notify.Setup.goesInTheKit', { itemName: escHtml(item.name), name: escHtml(name) }));
  refresh();
  return true;
}

/**
 * Give a kit to actors (free; things arrive ready: installed, worn, bonded, when `ready`). Returns how many
 * actors got something. Lines an actor type can't hold are skipped and named.
 */
export async function giveKit(kit: StarterKit, actors: any[], o: { ready: boolean }): Promise<number> {
  if (!isGM()) { ui.notifications.warn(tx('SR2E.Notify.Setup.onlyTheGmGivesKitsPlayers')); return 0; }
  let n = 0;
  const skippedAll = new Set<string>();
  for (const actor of actors) {
    const { lines, skipped } = kitLinesFor(kit, ITEM_TYPES_FOR[actor.type] ?? []);
    for (const s of skipped) skippedAll.add(`${actor.name}: ${s}`);
    if (!lines.length) continue;
    const res = await createFromBasket(actor, lines.map((l) => ({ ...l, data: { name: l.name, type: l.type, system: l.system } })), { ready: o.ready });
    for (const f of res.failed) ui.notifications.warn(tx('SR2E.Notify.Setup.couldnTBeAdded', { actorName: escHtml(actor.name), f: escHtml(f) }));
    if (res.done.length) n++;
  }
  if (skippedAll.size) ui.notifications.info(tx('SR2E.Notify.Setup.leftOutThatActorCanT', { value: escHtml([...skippedAll].join('; ')) }));
  return n;
}

async function giveKitDialog(id: string): Promise<void> {
  const kit = kits().find((k) => k.id === id);
  if (!kit) return;
  if (!kit.lines.length) return void ui.notifications.warn(tx('SR2E.Notify.Setup.theKitIsEmptyDropItems'));
  const actors = await pickActors(tx('SR2E.Dialog.Setup.giveTheKit', { kitName: kit.name }), ['character', 'npc', 'spirit', 'vehicle'], tx('SR2E.Dialog.Setup.give'));
  if (!actors.length) return;
  const ready = await DialogV2.confirm({ window: { title: tx('SR2E.Dialog.Setup.readyToUse') }, content: `<p>${tx('SR2E.Dialog.Setup.giveTheThingsReadyToUse')}</p><p class="hint">${tx('SR2E.Dialog.Setup.noTheyArriveAsIfDropped')}</p>`, rejectClose: false });
  if (ready === null) return;
  const n = await giveKit(kit, actors, { ready: Boolean(ready) });
  ui.notifications.info(tx('SR2E.Notify.Setup.gaveTo', { kitName: escHtml(kit.name), plural: tCount(n, 'SR2E.Count.actor') }));
  const names = actors.map((a: any) => esc(a.name)).join(', ');
  if (n) await ChatMessage.create({ whisper: ChatMessage.getWhisperRecipients?.('GM')?.map((u: any) => u.id) ?? [], content: `<p>${tx('SR2E.Card.Setup.kit')} <strong>${esc(kit.name)}</strong> ${tx('SR2E.Card.Setup.givenTo', { names, kitSummary: esc(kitSummary(kit, 12)) })}</p>` });
}

// ---------------------------------------------------------------- checklist

async function checklistTick(id: string, done: boolean): Promise<void> {
  await serial(() => saveChecklist(toggleChecklistLine(checklist(), id, done)));
  refresh();
}

async function checklistNew(): Promise<void> {
  const ok = await DialogV2.confirm({ window: { title: tx('SR2E.Dialog.Setup.startANewSession') }, content: `<p>${tx('SR2E.Dialog.Setup.clearEveryTickAndCountA')}</p>`, rejectClose: false });
  if (!ok) return;
  await serial(() => saveChecklist(newSession(checklist(), Date.now())));
  refresh();
}

async function checklistAdd(part: 'start' | 'end'): Promise<void> {
  const r = await DialogV2.prompt({
    window: { title: part === 'start' ? tx('SR2E.Dialog.Setup.addToTheStartOfA') : tx('SR2E.Dialog.Setup.addToTheEndOfA') },
    content: `<div class="form-group"><label>${tx('SR2E.Dialog.Setup.whatToDo')}</label><input name="text" type="text" autofocus></div>
      <div class="form-group"><label>${tx('SR2E.Dialog.Setup.button')}</label><select name="action"><option value="">${tx('SR2E.Dialog.Setup.none2')}</option>${Object.entries(ACTION_LABELS()).map(([k, v]) => `<option value="${esc(k)}">${esc(v)} (${esc(k)})</option>`).join('')}</select></div>`,
    ok: { label: tx('SR2E.Dialog.Setup.add'), callback: (_e: Event, b: any) => ({ text: String(b.form.elements.text.value ?? ''), action: String(b.form.elements.action.value ?? '') as ChecklistAction }) },
    rejectClose: false,
  });
  if (!r?.text?.trim()) return;
  await serial(() => saveChecklist(addChecklistLine(checklist(), part, r.text, r.action)));
  refresh();
}

async function checklistRemove(id: string): Promise<void> {
  await serial(() => saveChecklist(removeChecklistLine(checklist(), id)));
  refresh();
}

// ---------------------------------------------------------------- players and characters

async function saveAssignments(root: HTMLElement): Promise<void> {
  const picks: Record<string, string> = {};
  for (const sel of Array.from(root.querySelectorAll<HTMLSelectElement>('select[data-assign]'))) picks[sel.dataset['assign']!] = sel.value;
  const users = [...((game as any).users ?? [])].map((u: any) => ({ id: u.id, name: u.name, isGM: Boolean(u.isGM), character: u.character?.id ?? null }));
  const OWNER = Number(CONSTS().DOCUMENT_OWNERSHIP_LEVELS?.OWNER ?? 3);
  const actors = [...((game as any).actors ?? [])]
    .map((a: any) => ({ id: a.id, name: a.name, owners: Object.entries(a.ownership ?? {}).filter(([k, v]) => k !== 'default' && Number(v) >= OWNER).map(([k]) => k) }));
  const plan = assignmentPlan(users, actors, picks);
  if (!plan.users.length && !plan.owners.length) return void ui.notifications.info(tx('SR2E.Notify.Setup.nothingToChange'));
  for (const o of plan.owners) await (game as any).actors.get(o.actorId)?.update({ [`ownership.${o.userId}`]: OWNER });
  for (const u of plan.users) await (game as any).users.get(u.id)?.update({ character: u.character });
  ui.notifications.info(escHtml(plan.lines.join('; ') || tx('SR2E.Notify.Setup.saved')));
  refresh();
}

// ---------------------------------------------------------------- token setup

function readTokenOptions(root: HTMLElement): TokenSetupOptions {
  const q = (s: string) => root.querySelector<HTMLInputElement & HTMLSelectElement>(`[data-token-opt="${s}"]`);
  return {
    link: Boolean(q('link')?.checked ?? true), bars: Boolean(q('bars')?.checked ?? true), vision: Boolean(q('vision')?.checked ?? true),
    show: (q('show')?.value ?? 'owner-hover') as TokenSetupOptions['show'], disposition: (q('disposition')?.value ?? 'auto') as TokenSetupOptions['disposition'],
  };
}

/**
 * Set up the prototype tokens of these actors (and their tokens already on scenes): linked, bars, sight
 * and the eyes the actor has, display modes and disposition. Placed unlinked tokens are relinked only
 * when asked (their own changes are lost).
 */
export async function setUpTokens(actors: any[], o: TokenSetupOptions, opts: { placed: boolean; relink: boolean }): Promise<{ actors: number; tokens: number }> {
  const T: any = CONSTS().TOKEN_DISPLAY_MODES ?? {};
  const D: any = CONSTS().TOKEN_DISPOSITIONS ?? {};
  const C = { FRIENDLY: D.FRIENDLY ?? 1, NEUTRAL: D.NEUTRAL ?? 0, HOSTILE: D.HOSTILE ?? -1, OWNER_HOVER: T.OWNER_HOVER ?? 20, OWNER: T.OWNER ?? 40, ALWAYS: T.ALWAYS ?? 50, HOVER: T.HOVER ?? 30 };
  let na = 0, nt = 0;
  for (const actor of actors) {
    if (!actor) continue;
    const plan = tokenSetupPlan({ type: actor.type, playerOwned: Boolean(actor.hasPlayerOwner) }, o, C);
    // A selected unlinked token's own copy: set up that token (its prototype is the base actor's business).
    if (actor.isToken) {
      const doc: any = actor.token;
      if (doc?.update) { await doc.update(placedTokenPlan(plan, Boolean(doc.actorLink))); nt++; }
      if (o.vision) { try { await syncTokenVision(actor); } catch (err) { console.warn('sr2e | token vision', err); } }
      continue;
    }
    await actor.update(Object.fromEntries(Object.entries(plan).map(([k, v]) => [`prototypeToken.${k}`, v])));
    na++;
    if (opts.placed) {
      for (const sc of [...((game as any).scenes ?? [])]) {
        const docs = [...(sc.tokens ?? [])].filter((t: any) => t.actorId === actor.id);
        const updates = docs.map((t: any) => ({ _id: t.id, ...placedTokenPlan(plan, Boolean(t.actorLink) || opts.relink) }));
        if (updates.length) { await sc.updateEmbeddedDocuments('Token', updates); nt += updates.length; }
      }
    }
    // The eyes themselves (low-light, thermographic, ultrasound) from the actor.
    if (o.vision) { try { await syncTokenVision(actor); } catch (err) { console.warn('sr2e | token vision', err); } }
  }
  return { actors: na, tokens: nt };
}

async function tokenSetupRun(root: HTMLElement | null, who: 'party' | 'pick'): Promise<void> {
  const o = root ? readTokenOptions(root) : tokenOptions();
  await game.settings.set(SYSTEM.id, 'tokenSetup', o);
  const actors = who === 'party' ? groupActors('party') : await pickActors(tx('SR2E.Dialog.Setup.setUpTokens'), ['character', 'npc', 'spirit', 'vehicle'], tx('SR2E.Dialog.Setup.setUp'));
  if (!actors.length) return void ui.notifications.warn(who === 'party' ? tx('SR2E.Notify.Setup.noPlayerCharactersAssignCharactersTo') : tx('SR2E.Notify.Setup.nobodyPicked'));
  const placed = root?.querySelector<HTMLInputElement>('[data-token-opt="placed"]')?.checked ?? true;
  const relink = root?.querySelector<HTMLInputElement>('[data-token-opt="relink"]')?.checked ?? false;
  const r = await setUpTokens(actors, o, { placed, relink });
  ui.notifications.info(r.actors ? (r.tokens ? tx('SR2E.Notify.Setup.setUpTheTokensOfAndPlaced', { plural: tCount(r.actors, 'SR2E.Count.actor'), tokens: tCount(r.tokens, 'SR2E.Count.placedToken') }) : tx('SR2E.Notify.Setup.setUpTheTokensOf', { plural: tCount(r.actors, 'SR2E.Count.actor') })) : tx('SR2E.Notify.Setup.setUp', { plural: tCount(r.tokens, 'SR2E.Count.token') }));
}

// ---------------------------------------------------------------- the actions

/** GM panel actions of the Setup tab (merged into the panel's action list). */
/** v0.88.0 review: a demo step always says what happened (or what went wrong) and refreshes the tab. */
async function demoStep(fn: () => Promise<string>): Promise<void> {
  try {
    const msg = await fn();
    if (msg) ui.notifications?.info?.(escHtml(msg));
  } catch (err) {
    console.error('sr2e | demo', err);
    ui.notifications?.error?.(tx('SR2E.Notify.Setup.theDemoCouldNotBeFinished'));
  } finally { refresh(); }
}

export const SETUP_ACTIONS: Record<string, (this: any, ev: Event, t: HTMLElement) => unknown> = {
  // v0.88.0: the starter demo (applications/demo.ts).
  demoCreate: () => once('demo', () => demoStep(async () => { ui.notifications?.info?.(tx('SR2E.Notify.Setup.creatingTheDemo')); return createDemo(); })),
  demoRemove: () => once('demo', () => demoStep(() => removeDemo())),
  kitNew: () => once('kitNew', newKitFromSheet),
  kitEmpty: () => newEmptyKit(),
  kitEdit: (_e, t) => once(`edit:${t.dataset['id']}`, () => editKit(t.dataset['id'] ?? '')),
  kitDelete: (_e, t) => deleteKit(t.dataset['id'] ?? ''),
  kitGive: (_e, t) => once(`give:${t.dataset['id']}`, () => giveKitDialog(t.dataset['id'] ?? '')),
  checkNew: () => checklistNew(),
  checkAdd: (_e, t) => checklistAdd(t.dataset['part'] === 'end' ? 'end' : 'start'),
  checkRemove: (_e, t) => checklistRemove(t.dataset['id'] ?? ''),
  assignSave: (_e, t) => once('assign', () => saveAssignments((t.closest('section') as HTMLElement) ?? document.body)),
  tokenParty: (_e, t) => once('tokens', () => tokenSetupRun(t.closest('section') as HTMLElement | null, 'party')),
  tokenPick: (_e, t) => once('tokens', () => tokenSetupRun(t.closest('section') as HTMLElement | null, 'pick')),
  // v0.67.0
  findPortraits: () => once('portraits', () => findAllPortraits()),
  // v0.83.0: asks first (it changes many actors at once; pictures set by hand are never touched).
  defaultArtAll: () => once('defaultArt', async () => {
    const k = standInCount();
    const ok = await (foundry as any).applications.api.DialogV2.confirm({
      window: { title: tx('SR2E.Dialog.Setup.defaultTokenArt') }, classes: ['sr2e-dialog'],
      content: `<p>${tx('SR2E.Dialog.Setup.giveTheSystemSDefaultPicture', { k: tCount(k, 'SR2E.Count.actor') })}</p>`,
    });
    if (ok) await defaultArtForAll();
  }),
};

/**
 * After the GM panel renders: ticks, items dropped on kits. `runAction` does a checklist line's button
 * (the panel's own actions, switching tabs, or the token setup).
 */
export function bindSetupTab(root: HTMLElement, runAction: (action: string) => unknown): void {
  // v0.80.0: switching the rules source asks first (it changes the rules for everyone at once).
  const src = root.querySelector<HTMLSelectElement>('select[data-sr2e-rules-source]');
  src?.addEventListener('change', () => void (async () => {
    const id = src.value;
    const label = tKey((RULES_SOURCES as Record<string, string>)[id] ?? id);
    const ok = await foundry.applications.api.DialogV2.confirm({ window: { title: tx('SR2E.Dialog.Setup.rulesSource') },
      content: `<p>${tx('SR2E.Dialog.Setup.playWith')} <strong>${esc(label)}</strong>${tx('SR2E.Dialog.Setup.itChangesTheRulesForEveryone')}</p>` });
    if (!ok) { src.value = String(game.settings.get(SYSTEM.id, 'rulesSource') ?? 'book'); return; }
    await game.settings.set(SYSTEM.id, 'rulesSource', id);
    ui.notifications.info(tx('SR2E.Notify.Setup.rulesSource', { label: escHtml(label) }));
  })());
  for (const box of Array.from(root.querySelectorAll<HTMLInputElement>('input[data-check]'))) {
    box.addEventListener('change', () => void checklistTick(box.dataset['check'] ?? '', box.checked));
  }
  for (const b of Array.from(root.querySelectorAll<HTMLElement>('[data-check-act]'))) {
    b.addEventListener('click', (ev) => {
      ev.preventDefault();
      const act = b.dataset['checkAct'] ?? '';
      if (act === 'tokenSetup') return void tokenSetupRun(root.querySelector<HTMLElement>('section.sr2e-token-setup'), 'party');
      if (act === 'endCombat') { const c: any = (game as any).combat; return void (c ? c.endCombat() : ui.notifications.info(tx('SR2E.Notify.Setup.noCombatRunning'))); }
      void runAction(act);
    });
  }
  for (const row of Array.from(root.querySelectorAll<HTMLElement>('[data-kit-drop]'))) {
    row.addEventListener('dragover', (ev) => { ev.preventDefault(); row.classList.add('sr2e-drop-hover'); });
    row.addEventListener('dragleave', () => row.classList.remove('sr2e-drop-hover'));
    row.addEventListener('drop', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      row.classList.remove('sr2e-drop-hover');
      let data: any = null;
      try { data = JSON.parse(ev.dataTransfer?.getData('text/plain') ?? ''); } catch { data = null; }
      void dropOnKit(row.dataset['kitDrop'] ?? '', data);
    });
  }
}
