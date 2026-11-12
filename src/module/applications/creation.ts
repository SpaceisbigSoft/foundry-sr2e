/**
 * v0.64.0: the character creation wizard (it replaces the Build… window as the way to make a character).
 * Step by step: priorities, metatype, attributes, magic, skills, resources (shopping through the Add
 * window), contacts, then Finish. Every step writes to the character at once, so the sheet, the Add
 * window and the build check always agree; the running totals are the build check's rows. While the
 * wizard is open the cash follows the Resources priority (nuyen = the allowance less gear, lifestyle,
 * contacts and extra spell points), so free adds and buys come out the same.
 *
 * Finish creation pays the lifestyle ahead, applies the leftover-cash rule and freezes the creation
 * record (`recordCreation`): the Creation tab shows it, and the advancement log starts.
 */
import { SYSTEM } from '../config/system.ts';
import { sysNow } from '../helpers/clock.ts';
import { ATTRIBUTE_KEYS } from '../models/index.ts';
import {
  RULES, BUILD_COLUMNS, WIZARD_STEPS, stepMove, stepStates, checkStep, priorityTable, metatypeChoices, magicChoices, KIND_TRADITIONS, magicKindOf, attributePoints, prioritiesComplete, swapPriority,
  buildCheck, spellPointCheck, spellPointAllowance, lifestyleCost, contactsCost, lifestyleOutright, leftoverCash, starterSkillsMissing, adeptPowerPoints, paidSkillRating,
  type BuildColumn, type Priority, type BuildRow, type BuildMagicKind, type WizardStep,
  creationLifestylePatch,
} from '../rules/index.ts';
import { buildInputFor } from './buildinput.ts';
import { priorityRow, racialModsOf, startingCashRoll } from '../rules/core923.ts';
import { creationRecordOf, inCreation, queueOn, DRAFT_FLAG } from './approvals.ts';
import { recordCreation } from './advancement.ts';
import { SR2AddWindow, openSkillPicker } from './adding.ts';
import { runSheetAction } from './tokens.ts';
import { escHtml } from '../rules/html.ts';
import { t as tx, tCount } from '../helpers/i18n.ts';

const { HandlebarsApplicationMixin, ApplicationV2, DialogV2 } = foundry.applications.api;
const cap = (s: string) => String(s ?? '').charAt(0).toUpperCase() + String(s ?? '').slice(1);
/** A-15: the shared escape helper (rules/html.ts). */
const esc = escHtml;

interface Draft { step: WizardStep; startedAt: string; by: string; months: number; outright: boolean }

export function draftOf(actor: any): Draft | null {
  const d = actor?.flags?.[SYSTEM.id]?.[DRAFT_FLAG];
  if (!d || typeof d !== 'object') return null;
  return { step: (WIZARD_STEPS.some((s) => s.id === d.step) ? d.step : 'priorities') as WizardStep, startedAt: String(d.startedAt ?? ''), by: String(d.by ?? ''),
    months: Math.max(1, Math.floor(Number(d.months) || RULES.STREET.builder.lifestyleMonths || 1)), outright: Boolean(d.outright) };
}

const prioritiesOf = (actor: any): Partial<Record<BuildColumn, Priority>> => Object.fromEntries(Object.entries((actor.getFlag?.(SYSTEM.id, 'build') ?? {}) as Record<string, unknown>).filter(([, v]) => typeof v === 'string' && v)) as any;

/** The build check as the wizard sees it (its lifestyle months), plus the spell points row. */
export function wizardChecks(actor: any): { rows: BuildRow[]; cash: number | null; life: number; contacts: number; gearCost: number; extraSpell: number; allowance: number; spells: ReturnType<typeof spellPointCheck> | null } {
  const pr = prioritiesOf(actor);
  const d = draftOf(actor);
  const input = buildInputFor(actor, pr);
  const level = String(actor.system.lifestyle?.level ?? 'low');
  const out = d?.outright ? lifestyleOutright({ lifestyle: level }) : null;
  const months = out ? out.months : d?.months ?? RULES.STREET.builder.lifestyleMonths;
  input.lifestyleMonths = months;
  const rows = buildCheck(input);
  const kind = magicKindOf(String(actor.system.tradition ?? 'none'), Number(actor.system.magic ?? 0));
  let spells: ReturnType<typeof spellPointCheck> | null = null;
  if (kind !== 'none' && kind !== 'adept') {
    const list = [...actor.items].filter((i: any) => i.type === 'spell').map((i: any) => ({ learnedForce: Number(i.system?.learnedForce ?? 0), force: Number(i.system?.force ?? 0) }));
    // v0.71.0 (R21): bonded foci take their bonding Karma from the spell points (RULES.FIXES_V71.creationFoci).
    const foci = [...actor.items].filter((i: any) => i.type === 'focus').map((i: any) => ({ name: i.name, focusType: String(i.system?.focusType ?? ''), rating: Number(i.system?.rating ?? 0), bonded: Boolean(i.system?.bonded), target: String(i.system?.target ?? ''), category: String(i.system?.category ?? ''), size: String(i.system?.size ?? '') }));
    spells = spellPointCheck({ allowance: spellPointAllowance({ priority: String(pr.magic ?? ''), tradition: String(actor.system.tradition ?? 'none'), resources: String(pr.resources ?? '') }), spells: list, foci });
    if (spells.allowance > 0 || spells.used > 0) rows.push({ step: 'magic', label: tx('SR2E.App.Creation.spellPoints'), used: spells.foci ? tx('SR2E.App.Creation.foci', { used: spells.used, foci: spells.foci }) : `${spells.used}`, allowed: `${spells.allowance}`, ok: spells.ok, ...(spells.note ? { note: spells.note } : {}) });
  }
  if (kind === 'adept') {
    const powers = [...actor.items].filter((i: any) => i.type === 'adeptpower').map((i: any) => ({ ...i.system, cost: Number(i.system?.cost ?? 0) }));
    const pp = adeptPowerPoints(powers as any, Number(actor.system.derived?.magic ?? actor.system.magic ?? 0));
    rows.push({ step: 'magic', label: tx('SR2E.App.Creation.magicPowerPoints'), used: `${pp.spent}`, allowed: `${pp.available}`, ok: pp.spent <= pp.available, ...(pp.spent < pp.available ? { note: tx('SR2E.App.Creation.unspent', { value: Math.round((pp.available - pp.spent) * 100) / 100 }) } : {}) });
  }
  const life = lifestyleCost(level, months);
  const contacts = contactsCost(input.contacts ?? []).cost;
  const extraSpell = spells?.extraNuyen ?? 0;
  const allowance = pr.resources ? priorityRow(pr.resources).resources : 0;
  const cash = pr.resources ? Math.max(0, Math.floor(allowance - input.gearCost - life - contacts - extraSpell)) : null;
  return { rows, cash, life, contacts, gearCost: input.gearCost, extraSpell, allowance, spells };
}

export class SR2CreationWizard extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS: Record<string, any> = {
    classes: ['sr2e', 'sr2e-wizard-window'],
    window: { title: 'SR2E.Window.Creation.createACharacter', resizable: true, icon: 'fa-solid fa-wand-magic-sparkles' },
    position: { width: 760, height: 720 },
    actions: {
      wizStep: SR2CreationWizard.#onStep,
      wizNext: SR2CreationWizard.#onNext,
      wizBack: SR2CreationWizard.#onBack,
      wizShop: SR2CreationWizard.#onShop,
      wizAddSkill: SR2CreationWizard.#onAddSkill,
      wizDeleteItem: SR2CreationWizard.#onDeleteItem,
      wizOpenItem: SR2CreationWizard.#onOpenItem,
      wizAddContact: SR2CreationWizard.#onAddContact,
      wizDeleteContact: SR2CreationWizard.#onDeleteContact,
      wizAddStarter: SR2CreationWizard.#onAddStarter,
      wizFinish: SR2CreationWizard.#onFinish,
      wizQuickBuild: SR2CreationWizard.#onQuickBuild,
    },
  };
  static PARTS: Record<string, any> = { main: { template: `${SYSTEM.PATH.TEMPLATES}/creation-wizard.hbs`, scrollable: ['.sr2e-wiz-body'] } };

  static #open = new Map<string, SR2CreationWizard>();
  static #hooked = false;

  /** Open the wizard (starting a draft) for a character with no creation record. */
  static async open(actor: any): Promise<SR2CreationWizard | null> {
    if (actor?.type !== 'character') { ui.notifications?.warn?.(tx('SR2E.Notify.Creation.theCreationWizardIsForCharacters')); return null; }
    if (!actor.isOwner) { ui.notifications?.warn?.(tx('SR2E.Notify.Creation.onlySOwnerCanBuildThem', { actorName: escHtml(actor.name) })); return null; }
    if (creationRecordOf(actor)) { ui.notifications?.info?.(tx('SR2E.Notify.Creation.sCreationIsFinishedCreationTab', { actorName: escHtml(actor.name), part: game.user?.isGM ? tx('SR2E.Notify.Creation.reopenItThereToBuildAgain') : tx('SR2E.Notify.Creation.theGmCanReopenIt') })); return null; }
    if (!inCreation(actor)) {
      // A character already in play doesn't slip past the approval queue by starting creation again.
      if (!game.user?.isGM && queueOn() && Number(actor.system.karma?.career ?? 0) > 0) {
        ui.notifications?.warn?.(tx('SR2E.Notify.Creation.hasEarnedKarmaAlreadyAskThe', { actorName: escHtml(actor.name) }));
        return null;
      }
      const draft: Draft = { step: 'priorities', startedAt: new Date().toISOString(), by: String(game.user?.name ?? ''), months: RULES.STREET.builder.lifestyleMonths || 1, outright: false };
      await actor.setFlag(SYSTEM.id, DRAFT_FLAG, draft);
    }
    if (!SR2CreationWizard.#hooked) {
      SR2CreationWizard.#hooked = true;
      const again = (a: any) => { const w = a ? SR2CreationWizard.#open.get(a.uuid) : null; if (w) w.soon(); };
      Hooks.on('updateActor', (a: any) => again(a));
      for (const h of ['createItem', 'updateItem', 'deleteItem']) Hooks.on(h, (i: any) => again(i?.parent));
    }
    let w = SR2CreationWizard.#open.get(actor.uuid);
    if (!w) { w = new SR2CreationWizard({ actorUuid: actor.uuid } as any); SR2CreationWizard.#open.set(actor.uuid, w); }
    void w.render({ force: true });
    return w;
  }

  actorUuid: string;
  #timer: ReturnType<typeof setTimeout> | null = null;
  #busy = false;
  #syncing = false;
  #finishing = false;
  constructor(options: any = {}) { super(options); this.actorUuid = String(options.actorUuid ?? ''); }
  get actor(): any { return fromUuidSync(this.actorUuid); }
  get title(): string { return tx('SR2E.Window.Creation.createACharacterFor', { name: this.actor?.name ?? '' }); }

  soon(): void {
    if (!(this as any).rendered) return;
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = setTimeout(() => {
      this.#timer = null;
      // Not while someone is typing in the wizard (a change event re-renders it anyway).
      const el: HTMLElement | null = (this as any).element ?? null;
      const act = document.activeElement as HTMLElement | null;
      if (el && act && el.contains(act) && ['INPUT', 'TEXTAREA'].includes(act.tagName) && (act as HTMLInputElement).type !== 'checkbox' && (act as HTMLInputElement).type !== 'radio') {
        act.addEventListener('blur', () => this.soon(), { once: true });
        return;
      }
      void this.render();
    }, 200);
  }

  async close(options?: any): Promise<any> {
    SR2CreationWizard.#open.delete(this.actorUuid);
    return super.close(options);
  }

  async #setDraft(patch: Partial<Draft>): Promise<void> {
    const a = this.actor;
    const d = draftOf(a);
    if (!a || !d) return;
    await a.setFlag(SYSTEM.id, DRAFT_FLAG, { ...d, ...patch });
  }

  async _prepareContext(_o: any): Promise<any> {
    const a = this.actor;
    if (!a) return {};
    const d = draftOf(a) ?? { step: 'priorities' as WizardStep, startedAt: '', by: '', months: 1, outright: false };
    if (creationRecordOf(a)) return { finished: true, name: a.name };
    const pr = prioritiesOf(a);
    const chk = wizardChecks(a);
    const states = stepStates(chk.rows);
    const step = d.step;
    const steps = WIZARD_STEPS.map((s, i) => ({ ...s, n: i + 1, active: s.id === step, state: states[s.id] }));
    const here = WIZARD_STEPS.find((s) => s.id === step)!;
    const items: any[] = [...a.items];
    const sys = a.system;
    const table = priorityTable();
    const colText = (k: BuildColumn, l: Priority) => {
      const r = table.find((x) => x.letter === l)!;
      return k === 'race' ? r.race : k === 'magic' ? r.magic : k === 'attributes' ? `${r.attributes} points` : k === 'skills' ? `${r.skills} points` : `¥${r.resources.toLocaleString()}`;
    };
    const kind = magicKindOf(String(sys.tradition ?? 'none'), Number(sys.magic ?? 0));
    // v0.71.0 (R3): each specialized skill shows the rating it was paid for (and why a trade isn't legal).
    const trade = Boolean(RULES.FIXES_V71.specialization?.tradeAtCreation);
    const paidOf = (i: any): { paid?: number; paidBad?: string } => {
      if (!trade || !(Number(i.system.specializationRating) > 0 || Number(i.system.concentrationRating) > 0)) return {};
      const p = paidSkillRating({ rating: Number(i.system.rating ?? 0), specializationRating: Number(i.system.specializationRating ?? 0), concentrationRating: Number(i.system.concentrationRating ?? 0) }, RULES.FIXES_V71.specialization.ratio, RULES.CREATION.skillMax);
      return { paid: p.paid, ...(p.invalid ? { paidBad: p.invalid } : {}) };
    };
    const mtypes = RULES.METATYPES.types;
    const ctx: any = {
      name: a.name, step, steps, hint: here.hint, label: here.label, n: WIZARD_STEPS.indexOf(here) + 1, total: WIZARD_STEPS.length,
      first: step === WIZARD_STEPS[0]!.id, last: step === WIZARD_STEPS.at(-1)!.id,
      is: Object.fromEntries(WIZARD_STEPS.map((s) => [s.id, s.id === step])),
      checks: chk.rows.map((r) => ({ ...r, stepId: checkStep(r), here: checkStep(r) === step })),
      failed: chk.rows.filter((r) => !r.ok).length,
      isGM: Boolean(game.user?.isGM),
      // Priorities
      columns: BUILD_COLUMNS.map((k) => ({ key: k, label: cap(k), cells: (['A', 'B', 'C', 'D', 'E'] as Priority[]).map((l) => ({ letter: l, text: colText(k, l), checked: pr[k] === l })) })),
      prioritiesDone: prioritiesComplete(pr),
      // Metatype
      metatypes: metatypeChoices(pr.race, mtypes).map((m) => ({ ...m, selected: m.key === String(sys.metatype ?? 'human'),
        mods: Object.entries(racialModsOf(m.key)).filter(([, v]) => Number(v)).map(([k, v]) => `${cap(k)} ${Number(v) > 0 ? '+' : ''}${v}`).join(', ') || 'no modifiers' })),
      // Attributes
      attributes: ATTRIBUTE_KEYS.map((k) => ({ key: k, label: cap(k), base: Number(sys.attributes?.[k]?.base ?? 1), racial: Number(sys.attributes?.[k]?.racial ?? 0), natural: Number(sys.attributes?.[k]?.natural ?? 0), over: Number(sys.attributes?.[k]?.base ?? 1) > RULES.CREATION.attributeMax })),
      // v0.92.1 (RULES.SHEET_V921.wizard): 'advise' warns (the build check's rows) but never refuses; 'block' is the old way.
      blocks: RULES.SHEET_V921.wizard === 'block',
      attributeMax: RULES.CREATION.attributeMax,
      points: attributePoints(Object.fromEntries(ATTRIBUTE_KEYS.map((k) => [k, Number(sys.attributes?.[k]?.base ?? 0)])), pr.attributes),
      // Magic
      magicKinds: magicChoices(pr.magic, String(sys.metatype ?? 'human')).map((m) => ({ ...m, selected: m.key === kind })),
      magicKind: kind,
      traditions: (KIND_TRADITIONS[kind] ?? []).map((t) => ({ key: t, label: cap(t), selected: t === String(sys.tradition) })),
      showTraditions: (KIND_TRADITIONS[kind] ?? []).length > 1,
      magicRating: Number(sys.magic ?? 0),
      isShaman: ['shamanic', 'shamanist'].includes(String(sys.tradition)),
      totem: String(sys.totem?.name ?? ''),
      spells: items.filter((i) => i.type === 'spell').map((i) => ({ id: i.id, name: i.name, force: Number(i.system.learnedForce ?? i.system.force ?? 1) })),
      spellPoints: chk.spells,
      powers: items.filter((i) => i.type === 'adeptpower').map((i) => ({ id: i.id, name: i.name, level: Number(i.system.level ?? 0), cost: Number(i.system.cost ?? 0) })),
      castsSpells: kind === 'full' || kind === 'aspected',
      isAdept: kind === 'adept',
      // Skills
      skillGroups: [['active', tx('SR2E.App.Creation.activeSkills')], ['knowledge', tx('SR2E.App.Creation.knowledgeSkills')], ['language', tx('SR2E.App.Creation.languageSkills')], ['buildRepair', tx('SR2E.App.Creation.buildRepairSkills')]].map(([k, label]) => ({
        kind: k, label, skills: items.filter((i) => i.type === 'skill' && (i.system.kind ?? 'active') === k).map((i) => ({ id: i.id, name: i.name, rating: Number(i.system.rating ?? 0), spec: i.system.specialization ?? '', specRating: Number(i.system.specializationRating ?? 0), native: Boolean(i.system.native), ...paidOf(i) })),
      })),
      specTrade: trade ? tx('SR2E.App.Creation.aSpecializationIsPaidFor', { ratio: RULES.FIXES_V71.specialization.ratio, firearms: 5 - RULES.FIXES_V71.specialization.ratio }) : '',
      starters: starterSkillsMissing(items.filter((i) => i.type === 'skill').map((i) => String(i.name))).slice(0, 12).map((s) => ({ ...s, label: `${s.name}${s.kind === 'buildRepair' ? '' : ` (${cap(s.attribute)})`}` })),
      // Resources
      allowance: chk.allowance.toLocaleString(), gearCost: Math.round(chk.gearCost).toLocaleString(), lifeCost: chk.life.toLocaleString(), contactsCost: chk.contacts.toLocaleString(), extraSpell: chk.extraSpell.toLocaleString(),
      cash: chk.cash === null ? null : chk.cash.toLocaleString(),
      leftover: chk.cash === null ? '' : leftoverCash(chk.cash).note,
      lifestyles: RULES.UPKEEP.lifestyles.map((l) => ({ key: l.id, label: tx('SR2E.App.Creation.month', { label: l.label, cost: l.cost.toLocaleString() }), selected: l.id === String(sys.lifestyle?.level ?? 'low') })),
      suggested: pr.resources ? RULES.STREET.builder.lifestyles[pr.resources] ?? '' : '',
      months: d.months, outright: d.outright, outrightMonths: RULES.STREET_V61.creation.lifestyleOutright.months,
      shops: [['weapon', tx('SR2E.App.Creation.weapons')], ['armor', tx('SR2E.App.Creation.armor')], ['gear', tx('SR2E.App.Creation.gear')], ['cyberware', tx('SR2E.App.Creation.cyberBioware')], ['cyberdeck', tx('SR2E.App.Creation.cyberdecks')], ['program', tx('SR2E.App.Creation.programs')], ['focus', tx('SR2E.App.Creation.foci2')]].map(([type, label]) => ({ type, label })),
      bought: items.filter((i) => ['weapon', 'armor', 'gear', 'cyberware', 'focus', 'cyberdeck', 'program'].includes(i.type)).map((i) => ({ id: i.id, name: i.name, type: i.type, qty: Number(i.system.quantity ?? 1),
        cost: Number(i.system.cost ?? 0) ? `¥${Math.round(Number(i.system.cost) * Math.max(1, Number(i.system.quantity ?? 1))).toLocaleString()}` : '—', essence: i.type === 'cyberware' && !i.system.bioware ? Number(i.system.essenceCost ?? 0) : 0 })),
      essence: Math.round(Number(sys.derived?.essence ?? sys.essence ?? 6) * 100) / 100,
      // Contacts
      contacts: [...(sys.contacts ?? [])].map((c: any) => ({ id: c.id, name: c.name, level: c.level, role: c.role })),
      freeContacts: RULES.CHARACTERS_V58.creation.freeContacts,
      cashDiff: chk.cash !== null && chk.cash !== Number(sys.nuyen ?? 0),
      cashValue: chk.cash,
    };
    return ctx;
  }

  async _onRender(context: any, options: any): Promise<void> {
    await (super._onRender as any)?.(context, options);
    const root: HTMLElement | null = (this as any).element ?? null;
    const a = this.actor;
    if (!root || !a) return;
    // The cash follows the Resources priority while creating.
    if (context.cashDiff && !this.#syncing && !this.#finishing && a.isOwner) {
      this.#syncing = true;
      try { await a.update({ 'system.nuyen': context.cashValue }); } finally { this.#syncing = false; }
    }
    for (const el of Array.from(root.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-wiz]'))) {
      el.addEventListener('change', () => void this.#onField(el));
    }
  }

  /** One field changed: write it to the character (or the draft). */
  async #onField(el: HTMLInputElement | HTMLSelectElement): Promise<void> {
    const a = this.actor;
    if (!a) return;
    const what = el.dataset['wiz'] ?? '';
    const v = el.value;
    const n = Math.floor(Number(v) || 0);
    switch (what) {
      case 'priority': {
        const col = el.dataset['column'] as BuildColumn;
        // Every column written (an empty one as null): a flag update merges, so a dropped key would stay.
        const next = swapPriority(prioritiesOf(a), col, v as Priority);
        await a.update({ [`flags.${SYSTEM.id}.build`]: Object.fromEntries(BUILD_COLUMNS.map((k) => [k, next[k] ?? null])) });
        break;
      }
      case 'metatype': await a.update({ 'system.metatype': v }); break;
      case 'attribute': {
        const k = el.dataset['key']!;
        // v0.92.1 (RULES.SHEET_V921.wizard 'advise'): above the creation maximum is allowed (the build check warns).
        await a.update({ [`system.attributes.${k}.base`]: Math.max(1, RULES.SHEET_V921.wizard === 'block' ? Math.min(RULES.CREATION.attributeMax, n) : n) });
        break;
      }
      case 'magicKind': {
        const kind = v as BuildMagicKind;
        const trad = KIND_TRADITIONS[kind]?.[0] ?? 'none';
        await a.update({ 'system.tradition': trad, 'system.magic': kind === 'none' ? 0 : RULES.STREET.builder.magicRating });
        break;
      }
      case 'tradition': await a.update({ 'system.tradition': v }); break;
      case 'totem': await a.update({ 'system.totem.name': String(v).trim() }); break;
      case 'itemField': {
        const item = a.items.get(el.dataset['itemId']);
        const field = el.dataset['field'];
        if (item && field) await item.update({ [field]: field.endsWith('specialization') ? String(v).trim() : Math.max(Number((el as HTMLInputElement).min || 0), n) });
        break;
      }
      case 'lifestyle': await a.update({ 'system.lifestyle.level': v }); break;
      case 'months': await this.#setDraft({ months: Math.max(1, n) }); break;
      case 'outright': await this.#setDraft({ outright: (el as HTMLInputElement).checked }); break;
      case 'contact': {
        const id = el.dataset['id'];
        const field = el.dataset['field'] ?? 'name';
        const list = [...(a.system.contacts ?? [])].map((c: any) => ({ ...c }));
        const c = list.find((x: any) => x.id === id);
        if (!c) return;
        c[field] = field === 'level' ? Math.max(1, Math.min(3, n)) : String(v);
        await a.update({ 'system.contacts': list });
        break;
      }
    }
  }

  async #go(step: WizardStep): Promise<void> { await this.#setDraft({ step }); }

  static async #onStep(this: SR2CreationWizard, _e: Event, t: HTMLElement) { const s = t.dataset['step'] as WizardStep; if (s) await this.#go(s); }
  static async #onNext(this: SR2CreationWizard) { const d = draftOf(this.actor); if (d) await this.#go(stepMove(d.step, 1)); }
  static async #onBack(this: SR2CreationWizard) { const d = draftOf(this.actor); if (d) await this.#go(stepMove(d.step, -1)); }
  static async #onShop(this: SR2CreationWizard, _e: Event, t: HTMLElement) { const a = this.actor; if (a) SR2AddWindow.show(a, t.dataset['type'] ?? 'gear'); }
  static async #onAddSkill(this: SR2CreationWizard, _e: Event, t: HTMLElement) { const a = this.actor; if (a) await openSkillPicker(a, (t.dataset['kind'] as any) || 'active'); }
  static async #onOpenItem(this: SR2CreationWizard, _e: Event, t: HTMLElement) { const i = this.actor?.items.get(t.dataset['itemId']); i?.sheet?.render(true); }

  static async #onDeleteItem(this: SR2CreationWizard, _e: Event, t: HTMLElement) {
    const a = this.actor;
    const item = a?.items.get(t.dataset['itemId']);
    if (!item || this.#busy) return;
    this.#busy = true;
    try { await item.delete(); } finally { this.#busy = false; }
  }

  static async #onAddStarter(this: SR2CreationWizard, _e: Event, t: HTMLElement) {
    const a = this.actor;
    const name = t.dataset['name'];
    if (!a || !name || this.#busy) return;
    const s = starterSkillsMissing([...a.items].filter((i: any) => i.type === 'skill').map((i: any) => String(i.name))).find((x) => x.name === name);
    if (!s) return;
    this.#busy = true;
    try { await a.createEmbeddedDocuments('Item', [{ name: s.name, type: 'skill', system: { kind: s.kind, attribute: s.kind === 'active' || s.kind === 'buildRepair' ? s.attribute : 'intelligence', rating: 1 } }]); } finally { this.#busy = false; }
  }

  static async #onAddContact(this: SR2CreationWizard) {
    const a = this.actor;
    if (!a || this.#busy) return;
    this.#busy = true;
    try {
      const list = [...(a.system.contacts ?? [])];
      list.push({ id: foundry.utils.randomID(), name: `Contact ${list.length + 1}`, level: 1, role: '', notes: 'From character creation', loyalty: 1, skills: '', fee: 0 });
      await a.update({ 'system.contacts': list });
    } finally { this.#busy = false; }
  }

  static async #onDeleteContact(this: SR2CreationWizard, _e: Event, t: HTMLElement) {
    const a = this.actor;
    if (!a) return;
    await a.update({ 'system.contacts': [...(a.system.contacts ?? [])].filter((c: any) => c.id !== t.dataset['id']) });
  }

  static async #onQuickBuild(this: SR2CreationWizard) { const a = this.actor; if (a) await runSheetAction(a, 'buildCheck'); }

  static async #onFinish(this: SR2CreationWizard) {
    const a = this.actor;
    if (!a || this.#busy) return;
    const d = draftOf(a);
    if (!d) return;
    // Busy from the first click (a second click doesn't open a second confirm).
    this.#busy = true;
    try { await this.#finish(a, d); } finally { this.#busy = false; this.#finishing = false; }
  }

  async #finish(a: any, d: Draft): Promise<void> {
    const chk = wizardChecks(a);
    const failed = chk.rows.filter((r) => !r.ok);
    const lc = chk.cash === null ? null : leftoverCash(chk.cash);
    const ok = await DialogV2.confirm({
      window: { title: tx('SR2E.Dialog.Creation.finishCreation', { name: a.name }) },
      content: `${failed.length ? `<p class="sr2e-warning"><strong>${tx('SR2E.Dialog.Creation.buildCheckNotMet', { failedLength: tCount(failed.length, 'SR2E.Count.buildCheck') })}</strong> ${tx('SR2E.Dialog.Creation.theRecordWillSaySo', { failed: failed.map((r) => esc(`${r.label} (${r.used} of ${r.allowed}${r.note ? `; ${r.note}` : ''})`)).join(', ') })}</p>` : `<p>${tx('SR2E.Dialog.Creation.everyBuildCheckIsMet')}</p>`}
        <p>${tx('SR2E.Dialog.Creation.finishingPaysTheLifestyleAndFreezes', { part: d.outright ? (RULES.CHARACTERS_V73.lifestyle.outrightPermanent ? tx('SR2E.Dialog.Creation.outrightOwnedForGood') : tx('SR2E.Dialog.Creation.outrightMonths', { lifestyleOutrightMonths: RULES.STREET_V61.creation.lifestyleOutright.months })) : tx('SR2E.Dialog.Creation.monthAhead', { months: tCount(d.months, 'SR2E.Count.month') }), part2: lc ? tx('SR2E.Dialog.Creation.keepsCash', { lcKept: lc.kept.toLocaleString(), part: lc.lost ? ` (${esc(lc.note)})` : '' }) : '', part3: queueOn() ? tx('SR2E.Dialog.Creation.theGmApprovesPurchasesAndKarma') : '' })}</p>`,
      rejectClose: false,
    });
    if (!ok || creationRecordOf(a)) return;
    this.#finishing = true;
    {
      // Last cash sync, then the lifestyle paid ahead and the leftover-cash rule.
      const now = sysNow();
      const out = d.outright ? lifestyleOutright({ lifestyle: String(a.system.lifestyle?.level ?? 'low') }) : null;
      // v0.73.0 (O31): outright = owned for good (RULES.CHARACTERS_V73.lifestyle.outrightPermanent; off: the months ahead).
      const up: Record<string, unknown> = creationLifestylePatch({ outright: Boolean(out), months: d.months, now } as any);
      if (lc) up['system.nuyen'] = lc.kept;
      // v0.92.3 (RULES.CORE_V923.startingCash 'roll', Core p. 47): every character also starts with 3D6 × 1,000¥.
      const sc = startingCashRoll();
      let cashLine = '';
      const cashRolls: any[] = [];
      if (sc) {
        const roll = await new (globalThis as any).Roll(sc.formula).evaluate();
        cashRolls.push(roll);
        const extra = Math.max(0, Math.floor(Number(roll.total) || 0)) * sc.per;
        up['system.nuyen'] = Math.max(0, Math.floor(Number(lc ? lc.kept : a.system.nuyen ?? 0) || 0)) + extra;
        cashLine = `<p>${tx('SR2E.Card.Creation.startingCash', { formula: esc(sc.formula.toUpperCase()), per: sc.per.toLocaleString(), total: Number(roll.total) || 0, nuyen: extra.toLocaleString() })}</p>`;
      }
      await a.update(up);
      await recordCreation(a, { how: 'wizard', priorities: prioritiesOf(a), checks: chk.rows });
      await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: a }), content: `<p><strong>${esc(a.name)}</strong> ${tx('SR2E.Card.Creation.isCreatedCash', { part: failed.length ? tCount(failed.length, 'SR2E.Card.Creation.buildChecksNotMet') : '', label: esc(RULES.METATYPES.types[String(a.system.metatype)]?.label ?? a.system.metatype), part2: esc(magicKindOf(String(a.system.tradition), Number(a.system.magic)) === 'none' ? tx('SR2E.Card.Creation.mundane') : cap(String(a.system.tradition))), nuyen: Number(a.system.nuyen ?? 0).toLocaleString() })}</p>${cashLine}`, ...(cashRolls.length ? { rolls: cashRolls } : {}) });
      await this.close();
      const sheet: any = a.sheet;
      if (sheet) { sheet.tabGroups = { ...(sheet.tabGroups ?? {}), primary: 'creation' }; void sheet.render(true); }
    }
  }
}
