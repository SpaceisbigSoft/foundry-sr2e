/**
 * v0.99.0 rules completeness, gear (RULES.KIT_V99): the Foundry glue for rules/kit99.ts. The attack's receptor and
 * Smartlink II rows (called from SR2Actor's attack), the chemical sniffer's single test and the strip search (called
 * from SR2Actor's search), the Attack dialog's smart goggles tick, and the GM's tool "Police check (book rules, GM)",
 * which rolls the officer's test on the GM's client (Shadowtech p. 103). Nothing here writes a document: the police
 * check only posts a card whispered to the GMs.
 */
import { escHtml } from '../rules/html.ts';
import { t as tx, tKey } from '../helpers/i18n.ts';
import { successTest, type SuccessTestResult, type TargetNumberModifier } from '../rules/dice.ts';
import { searchTargets, searchFinds, type SearchTarget } from '../rules/armory.ts';
import { isCarried, isAtHand } from '../rules/tweaks.ts';
import { SNIFF_99 } from '../rules/config99/kit.ts';
import * as K from '../rules/kit99.ts';
import { templatesFor } from '../rules/items.ts';
import { catalogueTemplates } from './catalogue942.ts';

/** The item sheet's v0.99.0 inputs shown at the switches' values (rules/kit99.ts sheetUi). */
export const sheetUi = K.sheetUi;

const G = (): any => (globalThis as any).game;
const isGm = (): boolean => Boolean(G()?.user?.isGM);
const dialogs = (): any => (globalThis as any).foundry?.applications?.api?.DialogV2;
const warn = (text: string): void => { (globalThis as any).ui?.notifications?.warn?.(text); };
const users = (): any[] => [...(G()?.users ?? [])];
const gmIds = (): string[] => users().filter((u: any) => u.isGM).map((u: any) => u.id);
const int = (v: unknown, min: number, max: number, d = min): number => { const n = Math.floor(Number(v)); return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : d; };
const itemsOf = (a: any): any[] => [...(a?.items ?? [])];
const LI_OPEN = '<li>', LI_CLOSE = '</li>', SELECTED = ' selected', SPACE = ' ';

/** Dice rolled with Foundry (shown by Dice So Nice through the card's rolls). */
function roller(sink: any[]): (count: number) => Promise<number[]> {
  return async (count: number) => {
    const roll = await new (globalThis as any).Roll(`${count}d6`).evaluate();
    sink.push(roll);
    return (roll.dice ?? []).flatMap((term: any) => term.results.map((r: any) => Number(r.result)));
  };
}
const diceText = (r: SuccessTestResult): string => r.dice.map((d) => Number(d.total)).join(', ');

// ================================================================ Smartlinks and smart goggles (attack)

/** The smart goggles an actor wears (gear at hand, working, named so). */
export function gogglesOf(actor: any): { worn: boolean; level2: boolean } {
  return K.smartGogglesWorn(itemsOf(actor).map((i: any) => ({ type: i.type, name: i.name, atHand: isAtHand(i), damaged: Boolean(i.system?.damaged) })));
}

/** Whether the Attack dialog ticks the smart goggles' row by itself for this weapon (KIT_V99.smartGoggles). */
export function gogglesTick(actor: any, w: any): boolean {
  return K.gogglesTicked({ smartgun: Boolean(w?.smartgun), implant: Boolean(actor?.system?.derived?.smartlink), goggles: gogglesOf(actor).worn });
}

/** A rangefinder the attacker carries (gear at hand) or has implanted (installed, working cyberware). */
function hasRangefinder(actor: any): boolean {
  return itemsOf(actor).some((i: any) => K.isRangefinder(i.name) && !i.system?.damaged
    && ((i.type === 'cyberware' && i.system?.installed) || (i.type !== 'cyberware' && isAtHand(i))));
}

/**
 * The attack's receptor rows (KIT_V99.smartGoggles: one receptor, the goggles' row dropped beside the smartlink's) and
 * Smartlink II's rows (KIT_V99.smartlink2, FoF pp. 84–85). Changes `situational` and `notes` in place; returns the rows.
 */
export function smartFire(actor: any, w: any, o: { situational: string[]; notes: string[]; melee: boolean; called: boolean; range?: string | null }): TargetNumberModifier[] {
  if (o.melee) return [];
  const drop = K.receptorDrop(o.situational);
  if (drop.length) {
    for (const id of drop) { const i = o.situational.indexOf(id); if (i >= 0) o.situational.splice(i, 1); }
    o.notes.push(tx('SR2E.Kit99.oneReceptor'));
  }
  if (!K.on('smartlink2') || !w?.smartgun) return [];
  const level = Number(actor?.system?.derived?.cyber?.smartlinkLevel ?? 0);
  const receptor2 = (o.situational.includes('smartlink') && level >= 2) || (o.situational.includes('smartGoggles') && gogglesOf(actor).level2);
  const mods = K.smartlink2Mods({ receptor2, gun2: Boolean(w.smartgun2), called: o.called, range: o.range ?? null, rangefinder: hasRangefinder(actor), launcher: K.linkedLauncher(w) });
  if (mods.length) o.notes.push(tx('SR2E.Kit99.sl2Note'));
  return mods;
}

// ================================================================ Searches: the chemical sniffer and the strip search

/** What a carried item looks like to the chemical sniffer. */
function sniffItem(i: any): K.SniffItem {
  const s = i.system ?? {};
  return {
    name: String(i.name ?? ''), type: String(i.type ?? ''), ammo: Number(s.ammo ?? 0), ammoMax: Number(s.ammoMax ?? 0), ammoType: String(s.ammoType ?? ''),
    blast: Boolean(s.blast), blastKind: String(s.blastKind ?? ''), thrown: Boolean(s.strengthRange), melee: Boolean(s.melee),
    rounds: Number(s.rounds ?? 0), quantity: Number(s.quantity ?? 1), explosivePower: Number(s.explosive?.power ?? 0), weight: Number(s.weight ?? 0),
  };
}

/**
 * The chemical sniffer's sweep (KIT_V99.sniffer 'book', NAGRL p. 93): the items that count (each shown at the load's
 * TN), the base TN 10 and the load's rows. null when the search is not a sniffer's or the rule is at 'v980'.
 */
export function sniffFor(target: any, method: string, kind: string): { targets: SearchTarget[]; tn: number; mods: TargetNumberModifier[] } | null {
  if (!K.sniffBook(method, kind)) return null;
  const load = K.sniffLoad(itemsOf(target).filter((i: any) => ['weapon', 'gear'].includes(i.type) && isCarried(i)).map(sniffItem));
  const t = K.sniffTn(load.counts);
  return { targets: load.names.map((name) => ({ id: '', name, type: '', tn: t.tn })), tn: SNIFF_99.baseTn, mods: t.mods };
}

/** One row of the search's GM card (plain text: the caller escapes it) for the sniffer's single test (`hit`) or a strip search (`hit` null: found). */
export function sniffRow(itemName: string, hit: SuccessTestResult | null): { found: boolean; text: string } {
  const found = hit ? searchFinds(hit.successes) : true;
  const text = hit ? tx('SR2E.Kit99.Sniff.row', { name: itemName, tn: hit.targetNumber, successes: hit.successes }) : tx('SR2E.Kit99.Search.stripRow', { name: itemName });
  return { found, text };
}

/**
 * Whether this search is a strip search (KIT_V99.manualSearch 'book'): a frisk a GM ordered as one, on the GM's own
 * client (not a player's action re-run there as its author).
 */
export function stripSearch(method: string, asked: unknown): boolean {
  const cls = (globalThis as any).CONFIG?.Actor?.documentClass;
  return K.on('manualSearch') && method === 'frisk' && asked === true && isGm() && !cls?.actingAuthor && !cls?.inAuthorRun;
}

/** The search dialog's extra rows for a frisk (KIT_V99.manualSearch 'book'); '' at 'v980'. */
export function manualSearchFields(): string {
  if (!K.on('manualSearch')) return '';
  const gm = isGm();
  const sel = (n: string, keys: readonly string[], cur: string, skip: string[] = []): string => {
    const label = (k: string): string => escHtml(tKey(`SR2E.Kit99.Search.${k}`));
    const opts = keys.filter((k) => !skip.includes(k)).map((k) => `<option value="${escHtml(k)}"${k === cur ? SELECTED : ''}>${label(k)}</option>`).join('');
    return `<select name="${n}">${opts}</select>`;
  };
  const row = (label: string, inner: string): string => `<div class="form-group" data-sr2e-kit99-frisk><label>${escHtml(label)}</label>${inner}</div>`;
  return row(tx('SR2E.Kit99.Search.proLabel'), sel('kit99pro', K.SEARCH_PRO_99, 'pr3'))
    + row(tx('SR2E.Kit99.Search.timeLabel'), sel('kit99time', K.SEARCH_TIME_99, 'standard', gm ? [] : ['strip']))
    + row(tx('SR2E.Kit99.Search.stateLabel'), sel('kit99state', K.SEARCH_STATE_99, 'normal'))
    + `<p class="hint">${tx('SR2E.Kit99.Search.hint')}</p>`;
}

/** The frisk's rows and strip-search flag from the search dialog's form (KIT_V99.manualSearch). */
export function manualSearchFrom(form: Record<string, unknown>, method: string): { mods: TargetNumberModifier[]; strip99: boolean } {
  if (method !== 'frisk') return { mods: [], strip99: false };
  const r = K.manualSearchMods({ pro: String(form.kit99pro ?? ''), time: String(form.kit99time ?? ''), state: String(form.kit99state ?? '') }, isGm());
  return { mods: r.mods, strip99: r.strip };
}

// ================================================================ The police check (Shadowtech p. 103)

/** A restricted item the character carries, as the check sees it (`catalogue`: the GM's catalogue's stricter number). */
export interface PoliceItem { name: string; restriction: number; code: string; shown: boolean; catalogue: number | null }

/** The GM's catalogue entry (built-in or the world's) of an item's type and name, or null. */
function catalogueEntry(type: string, name: string): { code: unknown; category: unknown } | null {
  const key = name.trim().toLowerCase();
  if (!key) return null;
  try {
    const t = templatesFor(type, catalogueTemplates()).find((x) => String(x.name ?? '').trim().toLowerCase() === key);
    return t ? { code: t.system?.legalCode, category: t.system?.legality } : null;
  } catch { return null; }
}

/**
 * The restricted items a character carries (KIT_V99.policeCheck): every item type with legality fields (K.POLICE_TYPES_99),
 * each with its restriction number and whether it is in plain sight (a weapon or worn armor that can't be hidden, by
 * the search's own rule). Read from the character's own items on the GM's client; an item's legality is checked
 * against the GM's catalogue entry of the same type and name too, and the stricter counts (a player who blanks an
 * item's legality doesn't drop it; one renamed off the catalogue is accepted: own character only).
 */
export function policeItems(subject: any): PoliceItem[] {
  const carried = typeof subject?.carriedItems === 'function' ? subject.carriedItems() : [];
  const plain = new Set(searchTargets(carried, 'look').filter((t) => t.tn === null).map((t) => t.id));
  const out: PoliceItem[] = [];
  for (const i of itemsOf(subject)) {
    if (!(K.POLICE_TYPES_99 as readonly string[]).includes(i.type) || !isCarried(i)) continue;
    if (i.type === 'cyberware' && !i.system?.installed) continue;
    const code = String(i.system?.legalCode ?? '').slice(0, 20);
    const n = K.policeRestriction({ code, category: i.system?.legality }, catalogueEntry(String(i.type), String(i.name ?? '')));
    if (n === null) continue;
    out.push({ name: String(i.name ?? ''), restriction: n.restriction, code, shown: plain.has(i.id), catalogue: n.catalogue });
  }
  return out.slice(0, 60);
}

/**
 * The police check, on the GM's client: the officer's dice (at most 20) against each item's TN (the restriction
 * number ± the enforcement, never below 2); the card is whispered to the GMs. Only items in plain sight unless `all`.
 */
export async function policeCheck(subject: any, o: { dice: number; enforcement: number; all: boolean; officer?: string }): Promise<Array<{ name: string; tn: number; successes: number; outcome: K.PoliceOutcome }> | null> {
  if (!isGm() || !K.on('policeCheck') || !subject) return null;
  const dice = int(o.dice, 0, 20, 0);
  const items = policeItems(subject).filter((i) => o.all || i.shown);
  const rolls: any[] = [];
  const results: Array<{ name: string; tn: number; successes: number; outcome: K.PoliceOutcome }> = [];
  const lines: string[] = [];
  for (const i of items) {
    const tn = K.policeTn(i.restriction, o.enforcement);
    const r = await successTest({ dice, targetNumber: tn, modifiers: [], roll: roller(rolls) });
    const outcome = K.policeOutcome(r.successes);
    const catNote = i.catalogue === null ? '' : SPACE + tx('SR2E.Kit99.Police.catalogue', { n: i.catalogue });
    results.push({ name: i.name, tn, successes: r.successes, outcome });
    lines.push(`${LI_OPEN}${tx('SR2E.Kit99.Police.row', { name: escHtml(i.name), code: escHtml(i.code || '-'), tn, dice: escHtml(diceText(r) || '-'), successes: r.successes })}${catNote} <strong>${escHtml(tKey(`SR2E.Kit99.Police.${outcome}`))}</strong>${LI_CLOSE}`);
  }
  const legal: string[] = subject.legalNotes?.(results.filter((x) => x.outcome === 'press').map((x) => x.name)) ?? [];
  const head = tx('SR2E.Kit99.Police.head', { subject: escHtml(String(subject.name ?? '')), officer: escHtml(o.officer || tx('SR2E.Kit99.Police.anOfficer')), dice, enforcement: int(o.enforcement, -3, 3, 0) });
  const empty = o.all ? tx('SR2E.Kit99.Police.nothing') : tx('SR2E.Kit99.Police.nothingShown');
  const body = items.length ? `<ul>${lines.join('')}</ul>` : `<p>${empty}</p>`;
  const notes = legal.length ? `<ul class="sr2e-legal">${legal.map((x) => LI_OPEN + escHtml(x) + LI_CLOSE).join('')}</ul>` : '';
  await (globalThis as any).ChatMessage.create({ content: `<p><em>${tx('SR2E.Kit99.gmOnly')}</em> ${head}</p>${body}${notes}<p class="hint">${tx('SR2E.Kit99.Police.hint')}</p>`, whisper: gmIds(), blind: true, rolls });
  return results;
}

/** The actors the GM can pick from: the scene's tokens, then the player characters. */
function pickable(): any[] {
  const seen = new Set<string>();
  const out: any[] = [];
  const add = (a: any) => { if (a?.uuid && !seen.has(a.uuid) && typeof a.carriedItems === 'function') { seen.add(a.uuid); out.push(a); } };
  for (const t of (globalThis as any).canvas?.tokens?.placeables ?? []) add(t.actor);
  for (const a of G()?.actors ?? []) if (a.type === 'character') add(a);
  return out.slice(0, 200);
}

let toolBusy = false;
/** The GM's tool "Police check (book rules, GM)" (KIT_V99.policeCheck). */
export async function openKitTool(): Promise<void> {
  if (!isGm()) return;
  if (!K.on('policeCheck')) { warn(tx('SR2E.Kit99.Police.off')); return; }
  if (toolBusy) return;
  toolBusy = true;
  try {
    const list = pickable();
    if (!list.length) { warn(tx('SR2E.Kit99.Police.noOne')); return; }
    const target = [...(G()?.user?.targets ?? [])][0]?.actor;
    const ctl = (globalThis as any).canvas?.tokens?.controlled?.[0]?.actor;
    const opt = (a: any, cur: any) => `<option value="${escHtml(a.uuid)}"${a === cur ? SELECTED : ''}>${escHtml(String(a.name ?? ''))}</option>`;
    const none = `<option value="">${tx('SR2E.Kit99.Police.byDice')}</option>`;
    const enf = [-3, -2, -1, 0, 1, 2, 3].map((n) => `<option value="${n}"${n === 0 ? SELECTED : ''}>${n > 0 ? '+' : ''}${n}</option>`).join('');
    const content = `<p>${tx('SR2E.Kit99.Police.intro')}</p>
      <div class="form-group"><label>${tx('SR2E.Kit99.Police.subject')}</label><select name="subject">${list.map((a) => opt(a, target ?? ctl)).join('')}</select></div>
      <div class="form-group"><label>${tx('SR2E.Kit99.Police.officerLabel')}</label><select name="officer">${none}${list.map((a) => opt(a, target ? ctl : null)).join('')}</select></div>
      <div class="form-group"><label>${tx('SR2E.Kit99.Police.dice')}</label><input name="dice" type="number" value="4" min="0" max="20"></div>
      <div class="form-group"><label>${tx('SR2E.Kit99.Police.enforcement')}</label><select name="enforcement">${enf}</select></div>
      <label class="sr2e-check"><input type="checkbox" name="all"> ${tx('SR2E.Kit99.Police.all')}</label>`;
    const r = await dialogs()?.prompt?.({
      window: { title: tx('SR2E.Kit99.Police.title') }, content,
      ok: { label: tx('SR2E.Kit99.Police.roll'), callback: (_e: Event, b: any) => { const el = b.form.elements; return { subject: String(el.subject.value), officer: String(el.officer.value), dice: el.dice.value, enforcement: el.enforcement.value, all: Boolean(el.all.checked) }; } },
      rejectClose: false,
    }) as { subject: string; officer: string; dice: unknown; enforcement: unknown; all: boolean } | null;
    if (!r) return;
    const subject = list.find((a) => a.uuid === r.subject);
    if (!subject) return;
    const officer = list.find((a) => a.uuid === r.officer) ?? null;
    // An officer picked: the better of their Security and Police Procedures (at most 20); else the dice typed in.
    const dice = officer ? K.officerDice(itemsOf(officer).filter((i: any) => i.type === 'skill').map((i: any) => ({ name: i.name, rating: i.system?.rating }))) : int(r.dice, 0, 20, 0);
    await policeCheck(subject, { dice, enforcement: int(r.enforcement, -3, 3, 0), all: r.all, officer: officer ? String(officer.name ?? '') : '' });
  } finally { toolBusy = false; }
}
