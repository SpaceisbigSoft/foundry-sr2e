/**
 * v0.64.0: the Spend Karma window. Everything Good Karma can buy for one character in one place: raise an
 * attribute, a skill, a specialization or concentration, a spell's Force; learn a new skill or spell;
 * initiate; gain an edge or buy off a flaw. Each goes through the actor's own method (so training time,
 * learning tests and the approval queue apply), and requests waiting for the GM are listed with a cancel.
 */
import { SYSTEM } from '../config/system.ts';
import { ATTRIBUTE_KEYS } from '../models/index.ts';
import { RULES, spellKarmaCost, qualityKarmaCost } from '../rules/index.ts';
import { requestsOf, dropRequest, approvalNeeded, queueOn } from './approvals.ts';
import { openSkillPicker, SR2AddWindow } from './adding.ts';
import { runSheetAction } from './tokens.ts';
import { escHtml } from '../rules/html.ts';
import { t as tx } from '../helpers/i18n.ts';

const { HandlebarsApplicationMixin, ApplicationV2, DialogV2 } = foundry.applications.api;
const cap = (s: string) => String(s ?? '').charAt(0).toUpperCase() + String(s ?? '').slice(1);
/** A-15: the shared escape helper (rules/html.ts). */
const esc = escHtml;

export class SR2SpendKarma extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS: Record<string, any> = {
    classes: ['sr2e', 'sr2e-spend-karma'],
    window: { title: 'SR2E.Window.Spendkarma.spendKarma', resizable: true, icon: 'fa-solid fa-star' },
    position: { width: 560, height: 640 },
    actions: {
      spendRaise: SR2SpendKarma.#onRaise,
      spendSpell: SR2SpendKarma.#onSpell,
      spendNewSkill: SR2SpendKarma.#onNewSkill,
      spendNewSpell: SR2SpendKarma.#onNewSpell,
      spendInitiate: SR2SpendKarma.#onInitiate,
      spendEdge: SR2SpendKarma.#onEdge,
      spendBuyOff: SR2SpendKarma.#onBuyOff,
      cancelRequest: SR2SpendKarma.#onCancel,
    },
  };
  static PARTS: Record<string, any> = { main: { template: `${SYSTEM.PATH.TEMPLATES}/spend-karma.hbs`, scrollable: [''] } };

  static #open = new Map<string, SR2SpendKarma>();
  static #hooked = false;

  static show(actor: any): SR2SpendKarma | null {
    if (actor?.type !== 'character') { ui.notifications?.warn?.(tx('SR2E.Notify.Spendkarma.onlyCharactersSpendKarma')); return null; }
    if (!actor.isOwner) { ui.notifications?.warn?.(tx('SR2E.Notify.Spendkarma.onlySOwnerCanSpendTheir', { actorName: escHtml(actor.name) })); return null; }
    if (!SR2SpendKarma.#hooked) {
      SR2SpendKarma.#hooked = true;
      const again = (a: any) => { const w = a ? SR2SpendKarma.#open.get(a.uuid) : null; if (w) w.soon(); };
      Hooks.on('updateActor', (a: any) => again(a));
      for (const h of ['createItem', 'updateItem', 'deleteItem']) Hooks.on(h, (i: any) => again(i?.parent));
    }
    let w = SR2SpendKarma.#open.get(actor.uuid);
    if (!w) { w = new SR2SpendKarma({ actorUuid: actor.uuid } as any); SR2SpendKarma.#open.set(actor.uuid, w); }
    void w.render({ force: true });
    return w;
  }

  actorUuid: string;
  #timer: ReturnType<typeof setTimeout> | null = null;
  #busy = false;
  constructor(options: any = {}) { super(options); this.actorUuid = String(options.actorUuid ?? ''); }
  get actor(): any { return fromUuidSync(this.actorUuid); }
  get title(): string { return tx('SR2E.Window.Spendkarma.spendKarmaFor', { name: this.actor?.name ?? '' }); }

  /** Re-render soon (several changes at once render once). */
  soon(): void {
    if (!(this as any).rendered) return;
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = setTimeout(() => { this.#timer = null; void this.render(); }, 200);
  }

  async close(options?: any): Promise<any> {
    SR2SpendKarma.#open.delete(this.actorUuid);
    return super.close(options);
  }

  async _prepareContext(_o: any): Promise<any> {
    const a = this.actor;
    if (!a) return {};
    const good = Number(a.system.karma?.good ?? 0);
    const row = (c: any) => ({ ...c, afford: c.ok && c.cost <= good, why: !c.ok ? c.reason : c.cost > good ? tx('SR2E.App.Spendkarma.needsHas', { cost: c.cost, good }) : '' });
    const attributes = ATTRIBUTE_KEYS.map((k) => ({ key: k, label: cap(k), ...row(a.improveCost({ attribute: k })) }));
    const skills = [...a.items].filter((i: any) => i.type === 'skill').sort((x: any, y: any) => String(x.system.kind).localeCompare(String(y.system.kind)) || x.name.localeCompare(y.name)).map((i: any) => ({
      id: i.id, name: i.name, kind: i.system.kind ?? 'active', rating: i.system.rating ?? 0,
      raise: row(a.improveCost({ skillId: i.id })),
      spec: i.system.specialization ? { name: i.system.specialization, ...row(a.improveCost({ skillId: i.id, specialization: true })) } : null,
      conc: i.system.concentration ? { name: i.system.concentration, ...row(a.improveCost({ skillId: i.id, concentration: true })) } : null,
    }));
    const magician = Number(a.system.derived?.magic ?? 0) > 0 && String(a.system.tradition ?? 'none') !== 'adept';
    const spells = magician ? [...a.items].filter((i: any) => i.type === 'spell').map((i: any) => {
      const force = Number(i.system.learnedForce ?? 0), cost = spellKarmaCost(force + 1);
      return { id: i.id, name: i.name, force, to: force + 1, cost, afford: cost <= good, why: cost > good ? tx('SR2E.App.Spendkarma.needsHas', { cost, good }) : '' };
    }) : [];
    const flaws = RULES.STREET.qualities.enabled ? (a.system.qualities ?? []).filter((q: any) => q.kind === 'flaw').map((q: any) => ({ id: q.id, name: q.name, points: q.points, cost: qualityKarmaCost('flaw', q.points) })) : [];
    const me = String(game.user?.id ?? '');
    const pending = requestsOf(a).filter((r) => game.user?.isGM || r.userId === me).map((r) => ({ id: r.id, label: r.label, cost: [r.karma ? `${r.karma} Karma` : '', r.nuyen ? `¥${r.nuyen.toLocaleString()}` : ''].filter(Boolean).join(' + ') || 'free', who: r.userName }));
    const recent = [...(a.system.ledger ?? [])].filter((l: any) => l.kind === 'karma').slice(-6).reverse().map((l: any) => ({ text: `${l.amount > 0 ? '+' : ''}${l.amount} · ${l.reason}` }));
    return {
      name: a.name, good, career: Number(a.system.karma?.career ?? 0), pool: Number(a.system.karma?.pool ?? 0),
      attributes, skills, spells, magician, flaws,
      canInitiate: Number(a.system.derived?.magic ?? 0) > 0,
      edgesOn: RULES.STREET.qualities.enabled,
      timed: RULES.CHARACTERS_V58.training.mode === 'timed',
      learning: RULES.MAGIC_V56.learning.enabled,
      approval: approvalNeeded(a), queueOn: queueOn(),
      pending, recent,
    };
  }

  async #guard(fn: () => Promise<unknown>): Promise<void> {
    if (this.#busy) return;
    this.#busy = true;
    try { await fn(); } finally { this.#busy = false; this.soon(); }
  }

  static async #onRaise(this: SR2SpendKarma, _e: Event, t: HTMLElement) {
    const a = this.actor;
    if (!a || this.#busy) return;
    const target = t.dataset['attribute'] ? { attribute: t.dataset['attribute'] } : { skillId: t.dataset['itemId'], specialization: t.dataset['part'] === 'spec', concentration: t.dataset['part'] === 'conc' };
    const c = a.improveCost(target);
    if (!c.ok) { ui.notifications?.warn?.(tx('SR2E.Notify.Spendkarma.canTRaise', { label: escHtml(c.label), reason: escHtml(c.reason) })); return; }
    this.#busy = true;
    let ok: unknown = false;
    try { ok = await DialogV2.confirm({
      window: { title: tx('SR2E.Dialog.Spendkarma.raise2', { label: c.label }) },
      content: `<p>${tx('SR2E.Dialog.Spendkarma.raise')} <strong>${esc(c.label)}</strong> ${tx('SR2E.Dialog.Spendkarma.fromToFor', { from: esc(c.from), to: esc(c.to) })} <strong>${tx('SR2E.Dialog.Spendkarma.karma', { cost: esc(c.cost) })}</strong>${tx('SR2E.Dialog.Spendkarma.hasGoodKarma', { name: esc(a.name), karmaGood: esc(a.system.karma?.good ?? 0) })}</p>${RULES.CHARACTERS_V58.training.mode === 'timed' ? `<p class="hint">${tx('SR2E.Dialog.Spendkarma.trainingTimeIsOnTheKarma')}</p>` : ''}${approvalNeeded(a) ? `<p class="hint">${tx('SR2E.Dialog.Spendkarma.theApprovalQueueIsOnThis')}</p>` : ''}`,
      rejectClose: false,
    }); } finally { this.#busy = false; }
    if (ok) await this.#guard(() => a.improve(target));
  }

  static async #onSpell(this: SR2SpendKarma, _e: Event, t: HTMLElement) {
    const a = this.actor;
    const spell = a?.items.get(t.dataset['itemId']);
    if (!spell || this.#busy) return;
    const to = Number(spell.system.learnedForce ?? 0) + 1;
    this.#busy = true;
    let ok: unknown = false;
    try { ok = await DialogV2.confirm({
      window: { title: tx('SR2E.Dialog.Spendkarma.force', { spellName: spell.name, to }) },
      content: `<p>${tx('SR2E.Dialog.Spendkarma.learn')} <strong>${esc(spell.name)}</strong> ${tx('SR2E.Dialog.Spendkarma.atForceFor', { to })} <strong>${tx('SR2E.Dialog.Spendkarma.karma2', { spellKarmaCost: spellKarmaCost(to) })}</strong>?</p>${RULES.MAGIC_V56.learning.enabled ? `<p class="hint">${tx('SR2E.Dialog.Spendkarma.learningTestsAreOnIsRolled', { learningSkill: esc(RULES.MAGIC_V56.learning.skill) })}</p>` : ''}${approvalNeeded(a) ? `<p class="hint">${tx('SR2E.Dialog.Spendkarma.theApprovalQueueIsOnThis')}</p>` : ''}`,
      rejectClose: false,
    }); } finally { this.#busy = false; }
    if (ok) await this.#guard(() => a.raiseSpellForce(spell, to));
  }

  static async #onNewSkill(this: SR2SpendKarma) {
    const a = this.actor;
    if (a) await openSkillPicker(a, 'active');
  }

  static async #onNewSpell(this: SR2SpendKarma) {
    const a = this.actor;
    if (!a) return;
    const w = SR2AddWindow.show(a, 'spell');
    if (w) { w.payment = 'karma'; w.readyTouched = false; await w.render(); }
  }

  static async #onInitiate(this: SR2SpendKarma) { const a = this.actor; if (a) await runSheetAction(a, 'advanceInitiation'); }
  static async #onEdge(this: SR2SpendKarma) { const a = this.actor; if (a) await runSheetAction(a, 'gainEdge'); }
  static async #onBuyOff(this: SR2SpendKarma, _e: Event, t: HTMLElement) {
    const a = this.actor;
    const id = t.dataset['qualityId'];
    const q = a && id ? (a.system.qualities ?? []).find((x: any) => x.id === id) : null;
    if (!q || this.#busy) return;
    // v0.82.0 (RV82 B-O12): the same confirm as the Bio tab's coin.
    const cost = qualityKarmaCost('flaw', q.points);
    this.#busy = true;
    let ok: unknown = false;
    try { ok = await DialogV2.confirm({
      window: { title: tx('SR2E.Dialog.Spendkarma.buyOff2', { name: q.name }) },
      content: `<p>${tx('SR2E.Dialog.Spendkarma.buyOff')} <strong>${esc(q.name)}</strong> ${tx('SR2E.Dialog.Spendkarma.pointsFor', { points: esc(q.points) })} <strong>${esc(cost)}</strong> ${tx('SR2E.Dialog.Spendkarma.goodKarmaHas', { name: esc(a.name), karmaGood: esc(a.system.karma?.good ?? 0) })}</p>${approvalNeeded(a) ? `<p class="hint">${tx('SR2E.Dialog.Spendkarma.theApprovalQueueIsOnThis')}</p>` : ''}`,
      rejectClose: false,
    }); } finally { this.#busy = false; }
    if (ok) await this.#guard(() => a.buyOffFlaw(q.id));
  }
  static async #onCancel(this: SR2SpendKarma, _e: Event, t: HTMLElement) {
    const a = this.actor;
    const id = t.dataset['id'];
    if (a && id) await dropRequest(a, id);
  }
}
