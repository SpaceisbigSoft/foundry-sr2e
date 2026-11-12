/**
 * v0.87.0: print a character or NPC (the Foundry glue for `rules/printsheet.ts`).
 *
 * A **Print** button in the title bar of every character, NPC and spirit sheet opens a small dialog (keep the damage
 * or print empty boxes, with or without notes), then prints the sheet through the browser's own print dialog, which
 * also saves it as a PDF. "Open as a page" shows the same page in a new browser tab instead, and "Save as a file"
 * downloads it as an .html file to open in any browser (for the desktop app or a browser where neither works).
 * The secret sections of the notes are left out unless an owner ticks them in.
 *
 * Safety: the page is built from escaped values; the notes are the sheets' cleaned rich text (`enrichFields`, the
 * same cleaner the sheets use). It is printed from a sandboxed frame (`sandbox="allow-modals allow-same-origin"`: no
 * scripts run in it at all) or opened from a blob URL with a Content-Security-Policy that forbids scripts.
 */
import { RULES } from '../rules/index.ts';
import { ATTRIBUTE_KEYS } from '../models/index.ts';
import { printHtml, printTitle, printTrack, type PrintSheet, type PrintTable, type PrintOptions } from '../rules/printsheet.ts';
import { escHtml } from '../rules/html.ts';
import { enrichFields } from './richtext.ts';
import { skillRow, weaponRow, cyberRow, conditionMonitor, TRADITION_LABELS } from './sheets.ts';
import { t as tx, tKey } from '../helpers/i18n.ts';

const esc = escHtml;
/** Actor types with a printable sheet. */
export const PRINTABLE = ['character', 'npc', 'spirit'];

const cap = (s: string) => String(s ?? '').charAt(0).toUpperCase() + String(s ?? '').slice(1);
const num = (v: unknown) => (Number.isFinite(Number(v)) ? String(Number(v)) : '');
const signed = (v: number) => (v > 0 ? `+${v}` : v < 0 ? `−${-v}` : '0');

/** The owners' names (players, not GMs), for "Player" on the sheet. */
function playersOf(actor: any): string {
  const users: any[] = [...((game as any).users ?? [])];
  return users.filter((u) => !u.isGM && actor.testUserPermission?.(u, 'OWNER')).map((u) => String(u.name ?? '')).filter(Boolean).join(', ');
}

/**
 * v0.87.0 review: the secret sections of rich text (`<section class="secret">`, shown to owners) are left out of a
 * print unless asked for, so a GM printing an NPC to hand out doesn't print the GM's secrets.
 */
export function withoutSecrets(html: string): string {
  if (!html || !/secret/i.test(html)) return html;
  const t = document.createElement('template');
  t.innerHTML = html;
  for (const sec of Array.from(t.content.querySelectorAll('section.secret, .secret'))) sec.remove();
  return t.innerHTML;
}

/** Gather everything the print shows from an actor (only what its sheet would show this user). */
export async function printModel(actor: any, opts: { secrets?: boolean } = {}): Promise<PrintSheet> {
  const sys = actor.system ?? {};
  const d = sys.derived ?? {};
  const items: any[] = [...(actor.items ?? [])];
  const of = (type: string) => items.filter((i) => i.type === type).sort((a, b) => String(a.name).localeCompare(String(b.name)));
  const metatype = String(d.metatype ?? (RULES.METATYPES.types as any)[sys.metatype]?.label ?? cap(sys.metatype ?? ''));
  const tradition = sys.tradition && sys.tradition !== 'none' ? (TRADITION_LABELS[sys.tradition] ? tKey(TRADITION_LABELS[sys.tradition]!) : cap(sys.tradition)) : '';
  const lifestyle = RULES.UPKEEP.lifestyles.find((l) => l.id === sys.lifestyle?.level)?.label ?? '';
  const kind = [actor.type === 'npc' ? tx('SR2E.App.Print.npc') : actor.type === 'spirit' ? tx('SR2E.App.Print.spirit') : tx('SR2E.App.Print.character'), metatype, tradition].filter(Boolean).join(' · ');

  const facts: Array<[string, string]> = [];
  if (actor.type === 'character') {
    facts.push([tx('SR2E.App.Print.player'), playersOf(actor)], [tx('SR2E.App.Print.lifestyle'), lifestyle], [tx('SR2E.App.Print.nuyen'), `${Number(sys.nuyen ?? 0).toLocaleString('en')}¥`],
      [tx('SR2E.App.Print.goodKarma'), num(sys.karma?.good)], [tx('SR2E.App.Print.careerKarma'), num(sys.karma?.career)]);
  }
  if (sys.professionalRating) facts.push([tx('SR2E.App.Print.professionalRating'), num(sys.professionalRating)]);
  if (sys.threatRating) facts.push([tx('SR2E.App.Print.threatRating'), num(sys.threatRating)]);
  if (sys.totem?.name) facts.push([tx('SR2E.App.Print.totem'), String(sys.totem.name)]);
  // v0.92.3 review fix: a Grade 0 initiate (RULES.SORCERY_V923.initiation 'book', the `initiated` flag) prints too.
  if (Number(sys.initiateGrade ?? 0) > 0 || actor.getFlag?.('sr2e', 'initiated') || actor.flags?.sr2e?.initiated) facts.push([tx('SR2E.App.Print.initiateGrade'), num(sys.initiateGrade)]);

  const attributes = ATTRIBUTE_KEYS.map((k) => {
    const a = sys.attributes?.[k] ?? {};
    const label = (game as any).i18n?.localize?.(`SR2E.Attribute.${k}`) ?? cap(k);
    return { label, total: Number(a.total ?? a.base ?? 0), base: a.base !== undefined ? Number(a.base) : undefined };
  });

  const derived: Array<[string, string]> = [
    [tx('SR2E.App.Print.essence'), num(d.essence ?? sys.essence)],
    [tx('SR2E.App.Print.magic'), Number(d.magic ?? sys.magic ?? 0) > 0 ? num(d.magic ?? sys.magic) : ''],
    [tx('SR2E.App.Print.reaction'), num(d.reaction)],
    [tx('SR2E.App.Print.initiative'), `${num(d.reaction)} + ${num(d.initiativeDice ?? 1)}d6`],
    [tx('SR2E.App.Print.combatPool'), num(d.combatPool)],
    [tx('SR2E.App.Print.spellPool'), Number(d.spellPool ?? 0) > 0 ? num(d.spellPool) : ''],
    [tx('SR2E.App.Print.hackingPool'), Number(d.hackingPool ?? 0) > 0 ? num(d.hackingPool) : ''],
    [tx('SR2E.App.Print.controlPool'), Number(d.controlPool ?? 0) > 0 ? num(d.controlPool) : ''],
    [tx('SR2E.App.Print.karmaPool'), Number(sys.karma?.pool ?? 0) > 0 ? num(sys.karma?.pool) : ''],
    [tx('SR2E.App.Print.armorBI'), `${num(actor.armorRating?.('ballistic') ?? 0)} / ${num(actor.armorRating?.('impact') ?? 0)}`],
  ];
  const mv = actor.movementNow?.() ?? d.movement;
  if (mv?.walk !== undefined) derived.push([tx('SR2E.App.Print.walkRun'), `${num(mv.walk)} / ${num(mv.run)} m`]);
  const vision = [sys.vision?.lowLight ? tx('SR2E.App.Print.lowLight') : '', sys.vision?.thermographic ? tx('SR2E.App.Print.thermographic') : ''].filter(Boolean).join(', ');
  if (vision) derived.push([tx('SR2E.App.Print.vision'), vision]);

  let monitor: PrintSheet['monitor'] = null;
  try {
    const cm: any = conditionMonitor(actor);
    const physical = printTrack(cm.physical, tx('SR2E.App.Print.physical'));
    const stun = printTrack(cm.stun, tx('SR2E.App.Print.stun'));
    if (physical && stun) {
      const wound = Number(d.woundModifier ?? 0);
      monitor = { physical, stun, overflow: cm.overflow ? printTrack(cm.overflow, tx('SR2E.App.Print.overflow')) : null, woundNote: wound ? tx('SR2E.App.Print.woundModifierTn', { wound: signed(wound) }) : '' };
    }
  } catch { monitor = null; }

  const tables: PrintTable[] = [];
  const skillKinds: Array<[string, string]> = [['active', tx('SR2E.App.Print.activeSkills')], ['knowledge', tx('SR2E.App.Print.knowledgeSkills')], ['language', tx('SR2E.App.Print.languageSkills')], ['buildRepair', tx('SR2E.App.Print.buildRepairSkills')]];
  for (const [k, title] of skillKinds) {
    const rows = of('skill').filter((i) => (i.system.kind ?? 'active') === k).map((i) => {
      const r = skillRow(actor, i);
      const sy = i.system ?? {};
      const spec = sy.specialization ? `${sy.specialization}${sy.specializationRating ? ` (${sy.specializationRating})` : ''}` : '';
      return [String(r.name), num(sy.rating), spec, cap(String(sy.attribute ?? ''))];
    });
    tables.push({ title, columns: [tx('SR2E.App.Print.skill'), tx('SR2E.App.Print.rating'), tx('SR2E.App.Print.specialization'), tx('SR2E.App.Print.attribute')], rows });
  }
  tables.push({
    title: tx('SR2E.App.Print.weapons'), columns: [tx('SR2E.App.Print.weapon'), tx('SR2E.App.Print.damage'), tx('SR2E.App.Print.conceal'), tx('SR2E.App.Print.mode'), tx('SR2E.App.Print.ammo'), tx('SR2E.App.Print.rangeReach')],
    rows: [...of('weapon'), ...((actor.cyberWeapons?.() ?? []) as any[])].map((i) => {
      const r = weaponRow(actor, i);
      const w = i.system ?? {};
      return [String(i.name), String(r.damageLabel ?? ''), num(w.concealability) === '0' ? '' : num(w.concealability), String(w.modes ?? ''),
        w.melee || !(Number(w.ammoMax) > 0) ? '' : `${num(w.ammo)}/${num(w.ammoMax)}${r.ammoLabel ? ` ${r.ammoLabel}` : ''}`,
        w.melee ? (Number(w.reach ?? 0) ? tx('SR2E.App.Print.reach', { reach: num(w.reach) }) : tx('SR2E.App.Print.melee')) : String(r.rangeLabel ?? '')];
    }),
  });
  tables.push({
    title: tx('SR2E.App.Print.armor'), columns: [tx('SR2E.App.Print.armor'), tx('SR2E.App.Print.ballistic'), tx('SR2E.App.Print.impact'), tx('SR2E.App.Print.worn')],
    rows: of('armor').map((i) => [String(i.name), num(i.system.ballistic), num(i.system.impact), i.system.worn ? tx('SR2E.App.Print.yes') : '']),
    note: tx('SR2E.App.Print.armorRatingWorn', { ballistic: num(actor.armorRating?.('ballistic') ?? 0), impact: num(actor.armorRating?.('impact') ?? 0) }),
  });
  tables.push({ title: tx('SR2E.App.Print.cyberwareAndBioware'), columns: [tx('SR2E.App.Print.item'), tx('SR2E.App.Print.details')], rows: of('cyberware').map((i) => [String(i.name), String(cyberRow(actor, i).summary ?? '')]) });
  tables.push({
    title: tx('SR2E.App.Print.spells'), columns: [tx('SR2E.App.Print.spell'), tx('SR2E.App.Print.category'), tx('SR2E.App.Print.type'), tx('SR2E.App.Print.force'), tx('SR2E.App.Print.drain'), tx('SR2E.App.Print.duration')],
    rows: of('spell').map((i) => {
      const s = i.system ?? {};
      const mod = Number(s.drainModifier ?? 0);
      return [String(i.name), cap(String(s.category ?? '')), cap(String(s.spellType ?? '')), num(s.learnedForce),
        `(F÷2)${mod ? signed(mod) : ''} ${String(s.drainLevel ?? '')}`.trim(), cap(String(s.duration ?? ''))];
    }),
  });
  tables.push({ title: tx('SR2E.App.Print.adeptPowers'), columns: [tx('SR2E.App.Print.power'), tx('SR2E.App.Print.level'), tx('SR2E.App.Print.cost')], rows: of('adeptpower').map((i) => [String(i.name), num(i.system.level), num(i.system.cost)]) });
  tables.push({ title: tx('SR2E.App.Print.critterPowers'), columns: [tx('SR2E.App.Print.power'), tx('SR2E.App.Print.notes')], rows: of('power').map((i) => [String(i.name), String(i.system.special ?? '').replace(/^none$/, '')]) });
  tables.push({ title: tx('SR2E.App.Print.foci'), columns: [tx('SR2E.App.Print.focus'), tx('SR2E.App.Print.type'), tx('SR2E.App.Print.rating'), tx('SR2E.App.Print.bonded')], rows: of('focus').map((i) => [String(i.name), cap(String(i.system.focusType ?? '')), num(i.system.rating), i.system.bonded ? 'yes' : '']) });
  tables.push({
    title: tx('SR2E.App.Print.matrix'), columns: [tx('SR2E.App.Print.deckOrProgram'), tx('SR2E.App.Print.rating'), tx('SR2E.App.Print.notes')],
    rows: [...of('cyberdeck').map((i) => [String(i.name), num(i.system.mpcp), tx('SR2E.App.Print.deckMpcp')]), ...of('program').map((i) => [String(i.name), num(i.system.rating), String(i.system.kind ?? i.system.category ?? '')])],
  });
  tables.push({ title: tx('SR2E.App.Print.gear'), columns: [tx('SR2E.App.Print.gear'), tx('SR2E.App.Print.qty'), tx('SR2E.App.Print.rating')], rows: of('gear').map((i) => [String(i.name), num(i.system.quantity ?? 1), Number(i.system.rating ?? 0) ? num(i.system.rating) : '']) });
  tables.push({
    title: tx('SR2E.App.Print.contacts'), columns: [tx('SR2E.App.Print.contact'), tx('SR2E.App.Print.role'), tx('SR2E.App.Print.level'), tx('SR2E.App.Print.loyalty')],
    rows: ((sys.contacts ?? []) as any[]).map((c) => [String(c.name ?? ''), String(c.role ?? ''), num(c.level), num(c.loyalty)]),
  });
  tables.push({
    title: tx('SR2E.App.Print.edgesAndFlaws'), columns: [tx('SR2E.App.Print.quality'), tx('SR2E.App.Print.kind'), tx('SR2E.App.Print.points')],
    rows: ((sys.qualities ?? []) as any[]).map((q) => [String(q.name ?? ''), cap(String(q.kind ?? '')), num(q.points)]),
  });

  const enriched = await enrichFields(actor);
  const rich: Record<string, string> = {};
  for (const [k, v] of Object.entries(enriched)) rich[k] = opts.secrets ? v : withoutSecrets(v);
  const notes = [
    { title: tx('SR2E.App.Print.powers'), html: rich['powers'] ?? '' },
    { title: tx('SR2E.App.Print.weaknesses'), html: rich['weaknesses'] ?? '' },
    { title: tx('SR2E.App.Print.biography'), html: rich['biography'] ?? '' },
    { title: tx('SR2E.App.Print.notes'), html: rich['notes'] ?? '' },
  ];

  const sysVer = String((game as any).system?.version ?? '');
  const date = new Date().toISOString().slice(0, 10);
  return {
    name: String(actor.name ?? ''), kind, facts, attributes, derived, monitor, tables, notes,
    footer: tx('SR2E.App.Print.shadowrun2ndEditionUnofficialFor', { sysVer, date }),
  };
}

/** Print through a sandboxed frame (no scripts can run in it). */
function printInFrame(html: string): void {
  const frame = document.createElement('iframe');
  frame.setAttribute('sandbox', 'allow-modals allow-same-origin');
  frame.setAttribute('aria-hidden', 'true');
  frame.tabIndex = -1;
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
  frame.srcdoc = html;
  document.body.appendChild(frame);
  const fail = (err?: unknown) => {
    if (err) console.warn('sr2e | print', err);
    ui.notifications?.warn?.(tx('SR2E.Notify.Print.theBrowserDidnTOpenA'));
  };
  // The load event waits for the pictures in the notes (a slow outside picture delays the dialog a little).
  frame.addEventListener('load', () => {
    try {
      const w = frame.contentWindow;
      if (typeof w?.print !== 'function') fail();
      else w.print();
    } catch (err) {
      fail(err);
    } finally {
      // The print dialog is modal in most browsers: by now it has closed. Remove the frame later (Safari prints after load).
      setTimeout(() => frame.remove(), 60_000);
    }
  }, { once: true });
}

/** Open the page as its own browser tab (a blob URL; the page's own policy forbids scripts). */
function openAsPage(html: string): boolean {
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  // Not the 'noopener' feature: with it, window.open returns null even when the tab opened, so a blocked pop-up
  // couldn't be told apart. The page runs no script, and the link back to Foundry is cut by hand.
  const w = window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 120_000);
  if (!w) return false;
  try { w.opener = null; } catch { /* cross-origin: already cut */ }
  return true;
}

/** Save the page as an .html file (the desktop app, or a browser that blocks the tab): open it in any browser to print. */
function saveAsFile(html: string, title: string): void {
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${title}.html`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Foundry's address for the page's <base> (pictures stored as Foundry paths). */
function foundryBase(): string {
  try { return new URL((globalThis as any).foundry?.utils?.getRoute?.('/') ?? '/', window.location.href).href; } catch { return ''; }
}

/** Build the page for an actor (the API and the tests use this). */
export async function printPage(actor: any, opts: PrintOptions & { secrets?: boolean } = {}): Promise<string> {
  return printHtml(await printModel(actor, { secrets: opts.secrets }), { ...opts, title: opts.title ?? printTitle(actor?.name), base: opts.base ?? foundryBase() });
}

/** Ask how to print, then print (or open as a page, or save as a file). */
export async function printActor(actor: any): Promise<void> {
  if (!actor || !PRINTABLE.includes(actor.type)) return;
  if (!actor.testUserPermission?.((game as any).user, 'OBSERVER')) {
    ui.notifications?.warn?.(tx('SR2E.Notify.Print.youCanOnlyPrintASheet'));
    return;
  }
  // v0.87.0 review: the data (the slow part: enriching the notes) is gathered while the dialog is open, so the page
  // opens at once after the click (a browser allows a pop-up only shortly after one).
  const gather = (secrets: boolean) => printModel(actor, { secrets }).catch((err) => { console.warn('sr2e | print', err); return null; });
  const plain = gather(false);
  const withSecrets = actor.isOwner ? gather(true) : plain;
  const DialogV2: any = (foundry as any).applications.api.DialogV2;
  const read = (b: any, how: string) => ({ how, blank: b.form.elements.blank.checked, noNotes: b.form.elements.noNotes.checked, secrets: Boolean(b.form.elements.secrets?.checked) });
  const choice: any = await DialogV2.wait({
    window: { title: tx('SR2E.Dialog.Print.print2', { actorName: actor.name }), icon: 'fa-solid fa-print' },
    classes: ['sr2e-dialog'],
    position: { width: 420 },
    content: `<p class="hint">${tx('SR2E.Dialog.Print.printsSSheetOnWhitePaper', { actorName: esc(actor.name) })}</p>
      <div class="form-group"><label><input type="checkbox" name="blank"> ${tx('SR2E.Dialog.Print.emptyConditionMonitorForPlayAt')}</label></div>
      <div class="form-group"><label><input type="checkbox" name="noNotes"> ${tx('SR2E.Dialog.Print.leaveOutTheBiographyAndNotes')}</label></div>
      ${actor.isOwner ? `<div class="form-group"><label><input type="checkbox" name="secrets"> ${tx('SR2E.Dialog.Print.includeTheNotesSecretSections')}</label></div>` : ''}`,
    buttons: [
      { action: 'print', label: tx('SR2E.Dialog.Print.print'), icon: 'fa-solid fa-print', default: true, callback: (_e: Event, b: any) => read(b, 'print') },
      { action: 'page', label: tx('SR2E.Dialog.Print.openAsAPage'), icon: 'fa-solid fa-up-right-from-square', callback: (_e: Event, b: any) => read(b, 'page') },
      { action: 'file', label: tx('SR2E.Dialog.Print.saveAsAFile'), icon: 'fa-solid fa-file-arrow-down', callback: (_e: Event, b: any) => read(b, 'file') },
    ],
    rejectClose: false,
  });
  if (!choice?.how) return;
  const title = printTitle(actor.name);
  const model = await (choice.secrets ? withSecrets : plain);
  if (!model) { ui.notifications?.error?.(tx('SR2E.Notify.Print.theSheetCouldNotBePut')); return; }
  const html = printHtml(model, { blank: Boolean(choice.blank), noNotes: Boolean(choice.noNotes), title, base: foundryBase() });
  if (choice.how === 'page') {
    if (!openAsPage(html)) ui.notifications?.info?.(tx('SR2E.Notify.Print.noNewTabOpenedBlockedAs'));
    return;
  }
  if (choice.how === 'file') { saveAsFile(html, title); return; }
  printInFrame(html);
}

/** The Print button in the title bar of a printable sheet (beside the Guide button). */
export function addPrintButton(app: any, el: unknown): boolean {
  const root: HTMLElement | null = el instanceof HTMLElement ? el : app?.element ?? null;
  const doc: any = app?.document;
  if (!root?.classList?.contains('sr2e') || doc?.documentName !== 'Actor' || !PRINTABLE.includes(doc.type)) return false;
  if (!doc.testUserPermission?.((game as any).user, 'OBSERVER')) return false;
  const header = root.querySelector<HTMLElement>(':scope > .window-header');
  if (!header || header.querySelector('.sr2e-print-button')) return false;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'header-control icon fa-solid fa-print sr2e-print-button';
  button.dataset['tooltip'] = tx('SR2E.App.Print.print');
  button.setAttribute('aria-label', tx('SR2E.App.Print.printThisSheet'));
  button.addEventListener('click', (ev) => { ev.preventDefault(); ev.stopPropagation(); void printActor(doc); });
  const before = header.querySelector('.sr2e-guide-button, [data-action="toggleControls"], [data-action="close"]');
  if (before?.parentElement) before.parentElement.insertBefore(button, before);
  else header.appendChild(button);
  return true;
}

export function registerPrint(): void {
  Hooks.on('renderApplicationV2', (app: any, el: unknown) => {
    try { addPrintButton(app, el); } catch (err) { console.warn('sr2e | print button', err); }
  });
}
