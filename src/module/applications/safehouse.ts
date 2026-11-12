/**
 * The safehouse sheet (v0.53.0): pick a location and a size, add any options from the catalog (every
 * option in RULES.SAFEHOUSE, grouped by category), and see the totals: build cost, monthly upkeep,
 * space, security, concealment, comfort, Barrier Rating, ward, medical bay, workshop, garage and
 * supplies. Owners pay to build it and pay its upkeep from a character's nuyen; its devices become a
 * security site actor, its ward a barrier actor, its home host a host actor, and its library, circle
 * or lodge a gear item for a magician. The GM can roll a search for it. The sums are in
 * `rules/safehouse.ts` (house rules).
 */
import { SYSTEM } from '../config/system.ts';
import { sysNow } from '../helpers/clock.ts';
import { dropItemOnActor } from "./drops.ts";
import {
  RULES, safehouseOption, describeOption, defaultRating, optionRating, paySafehouse, safehouseUpkeepStatus, safehouseComfort,
  searchTarget, searchDays, safehouseHostData, siteDevicesFor, lifestyleOf,
} from '../rules/index.ts';
import { SR2Actor } from '../documents/index.ts';
import { escHtml } from '../rules/html.ts';
import { t as tx, tCount } from '../helpers/i18n.ts';

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

/** A-15: the shared escape helper (rules/html.ts). */
const esc = escHtml;
const yen = (n: number): string => `${Math.round(Number(n) || 0).toLocaleString()}¥`;
const lifeLabel = (id: string): string => lifestyleOf(id).label;
const canCreateActors = (): boolean => Boolean((game as any).user?.isGM || (game as any).user?.can?.('ACTOR_CREATE'));
const newId = (): string => (foundry as any).utils?.randomID?.() ?? Math.random().toString(36).slice(2, 18);

/** People who can be owners or residents: characters and NPCs in the world. */
function people(): any[] {
  const gm = Boolean((game as any).user?.isGM);
  return [...((game as any).actors ?? [])].filter((a: any) => ['character', 'npc'].includes(a.type) && (gm || a.testUserPermission?.((game as any).user, 'LIMITED')));
}

/** Refuse a change to a safehouse this user doesn't own. */
function mustOwn(h: any): boolean {
  if (h?.isOwner) return true;
  ui.notifications?.warn?.(tx('SR2E.Notify.Safehouse.youDonTOwn', { hName: escHtml(h?.name ?? tx('SR2E.Notify.Safehouse.thisSafehouse')) }));
  return false;
}

export class SR2SafehouseSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  /** v0.59.0: dropped items arrive uninstalled / unbonded / unloaded, move between actors, and only fitting types (applications/drops.ts). */
  async _onDropItem(event: any, item: any): Promise<any> {
    return dropItemOnActor(this, event, item, () => (super._onDropItem as any)(event, item));
  }

  static DEFAULT_OPTIONS: Record<string, any> = {
    classes: ['sr2e', 'sheet', 'actor', 'safehouse'],
    position: { width: 760, height: 820 },
    window: { resizable: true },
    form: { submitOnChange: true },
    actions: {
      addOption: SR2SafehouseSheet.#onAddOption,
      removeOption: SR2SafehouseSheet.#onRemoveOption,
      addPerson: SR2SafehouseSheet.#onAddPerson,
      removePerson: SR2SafehouseSheet.#onRemovePerson,
      openActor: SR2SafehouseSheet.#onOpenActor,
      payBuild: SR2SafehouseSheet.#onPayBuild,
      payUpkeep: SR2SafehouseSheet.#onPayUpkeep,
      makeSite: SR2SafehouseSheet.#onMakeSite,
      makeWard: SR2SafehouseSheet.#onMakeWard,
      makeHost: SR2SafehouseSheet.#onMakeHost,
      giveMagicSite: SR2SafehouseSheet.#onGiveMagicSite,
      searchTest: SR2SafehouseSheet.#onSearchTest,
      postSummary: SR2SafehouseSheet.#onPostSummary,
    },
  };

  static PARTS: Record<string, any> = {
    main: { template: `${SYSTEM.PATH.TEMPLATES}/actor-safehouse-sheet.hbs`, scrollable: [''] },
  };

  /** Which catalog categories are open (kept between renders). */
  #open = new Set<string>();

  async _prepareContext(options: any): Promise<any> {
    const context = await super._prepareContext(options);
    const actor: any = this.document;
    const sys = actor.system;
    const d = sys.derived;
    const now = sysNow();
    const st = safehouseUpkeepStatus(Number(sys.paidUntil ?? -1), now);
    const comfortNow = safehouseComfort(d.comfort, st.lapsed);
    const chosen = (sys.options ?? []).map((c: any, index: number) => ({ c, index, def: safehouseOption(c.key) }));
    const lines = d.lines as any[];
    let li = 0;
    const rows = chosen.map(({ c, index, def }: any) => {
      if (!def) return { index, category: '', label: tx('SR2E.App.Safehouse.unknownOption', { key: c.key }), unknown: true, notes: c.notes };
      const line = lines[li++];
      const range = (def as any).rating as [number, number] | undefined;
      return {
        index, category: def.category, label: def.label, rated: Boolean(range), rating: optionRating(def, c.rating), min: range?.[0] ?? 1, max: range?.[1] ?? 1,
        ...(line && line.counted === false
          ? { cost: '—', upkeep: '—', space: '—' }
          : { cost: yen(line?.cost ?? 0), upkeep: line?.upkeep ? `${yen(line.upkeep)}/mo` : '', space: line?.space ?? 0 }),
        problems: (line?.problems ?? []).join(' '), notes: c.notes,
        note: (def as any).note ?? '',
      };
    });
    const counts = new Map<string, number>();
    for (const c of sys.options ?? []) counts.set(c.key, (counts.get(c.key) ?? 0) + 1);
    const categories = RULES.SAFEHOUSE.categories.map((cat) => ({
      id: cat.id, label: cat.label, open: this.#open.has(cat.id),
      chosen: rows.filter((r: any) => r.category === cat.id),
      catalog: RULES.SAFEHOUSE.options.filter((o) => o.category === cat.id).map((o) => {
        const range = (o as any).rating as [number, number] | undefined;
        const have = counts.get(o.id) ?? 0;
        return {
          key: o.id, label: o.label, range: range ? `${range[0]}–${range[1]}` : '', per: (o as any).perRating ? '/rating' : '',
          cost: yen(o.cost), upkeep: o.upkeep ? `${yen(o.upkeep)}/mo` : '', space: o.space, effects: describeOption(o), note: (o as any).note ?? '',
          have, canAdd: (o as any).repeat || !have,
        };
      }),
    }));
    const unknown = rows.filter((r: any) => r.unknown);
    const person = (u: string, role: 'owners' | 'residents') => {
      const a: any = (globalThis as any).fromUuidSync?.(u) ?? null;
      const seen = a && ((game as any).user?.isGM || a.testUserPermission?.((game as any).user, 'LIMITED'));
      return { uuid: u, role, name: a ? (seen ? a.name : '(someone)') : '(gone)', gone: !a, nuyen: seen && a.isOwner && a.system?.nuyen != null ? yen(a.system.nuyen) : '' };
    };
    const link = (u: string) => { const a: any = u ? (globalThis as any).fromUuidSync?.(u) ?? null : null; return a ? { uuid: a.uuid, name: a.name } : null; };
    const s = searchTarget(d.concealment);
    const searchTn = Math.max(RULES.SAFEHOUSE.search.minTn, s.tn + s.modifiers.reduce((a, m) => a + m.value, 0));
    return {
      ...context, actor, system: sys, d,
      isGM: Boolean((game as any).user?.isGM), canCreate: canCreateActors() && actor.isOwner, editable: this.isEditable && actor.isOwner,
      locations: RULES.SAFEHOUSE.locations.map((l) => ({ key: l.id, label: tx('SR2E.App.Safehouse.costUpkeep', { label: l.label, costMult: l.costMult, upkeepMult: l.upkeepMult }) })),
      sizes: RULES.SAFEHOUSE.sizes.map((z) => ({ key: z.id, label: tx('SR2E.App.Safehouse.space', { label: z.label, space: z.space, cost: yen(z.cost) }) })),
      categories, unknown,
      owners: (sys.owners ?? []).map((u: string) => person(u, 'owners')),
      residents: (sys.residents ?? []).map((u: string) => person(u, 'residents')),
      crowded: (sys.owners ?? []).length + (sys.residents ?? []).length > d.residents,
      money: {
        build: yen(d.buildCost), paid: yen(sys.buildPaid), owed: d.owed ? yen(d.owed) : '', upkeep: yen(d.upkeep),
        status: st.days == null ? tx('SR2E.App.Safehouse.neverPaid') : st.lapsed ? tCount(-st.days, 'SR2E.App.Safehouse.lapsedDaySOverdue') : st.overdue ? tCount(-st.days, 'SR2E.App.Safehouse.daySOverdueGrace', { graceDays: RULES.SAFEHOUSE.graceDays }) : tCount(st.days, 'SR2E.App.Safehouse.paidForMoreDayS'),
        late: st.overdue || st.days == null,
      },
      comfort: lifeLabel(d.comfort), comfortNow: comfortNow !== d.comfort ? lifeLabel(comfortNow) : '',
      response: d.location.response,
      searchTn,
      site: link(sys.siteUuid), ward: link(sys.wardUuid), host: link(sys.hostUuid),
      magicSites: d.magicSites.map((m: any) => ({ ...m, kindLabel: m.kind === 'lodge' ? 'Lodge' : m.kind === 'library' ? 'Library' : 'Circle' })),
    };
  }

  async _onRender(context: any, options: any): Promise<void> {
    await (super._onRender as any)?.(context, options);
    const root: HTMLElement = (this as any).element;
    // Ratings and notes of chosen options: one array update (the form can't submit array rows).
    root.querySelectorAll<HTMLInputElement>('[data-opt-field]').forEach((el) => el.addEventListener('change', (ev) => {
      ev.stopPropagation();
      const i = Number(el.closest<HTMLElement>('[data-index]')?.dataset['index']);
      const field = el.dataset['optField'] as 'rating' | 'notes';
      const list = foundry.utils.deepClone(this.document.system.options ?? []) as any[];
      if (!list[i]) return;
      list[i][field] = field === 'rating' ? Math.max(0, Math.floor(Number(el.value) || 0)) : String(el.value ?? '');
      if (field === 'rating') { const def = safehouseOption(list[i].key); if (def) list[i].rating = optionRating(def, list[i].rating); }
      void this.document.update({ 'system.options': list });
    }));
    root.querySelectorAll<HTMLDetailsElement>('details[data-cat]').forEach((el) => el.addEventListener('toggle', () => {
      const id = el.dataset['cat'] ?? '';
      if (el.open) this.#open.add(id); else this.#open.delete(id);
    }));
  }

  // ---------------------------------------------------------------- Options

  static async #onAddOption(this: SR2SafehouseSheet, _e: Event, t: HTMLElement) {
    if (!mustOwn(this.document)) return;
    const def = safehouseOption(t.dataset['key'] ?? '');
    if (!def) return;
    const list = foundry.utils.deepClone(this.document.system.options ?? []) as any[];
    if (!(def as any).repeat && list.some((c) => c.key === def.id)) { ui.notifications?.warn?.(tx('SR2E.Notify.Safehouse.isAlreadyIn', { defLabel: escHtml(def.label) })); return; }
    list.push({ id: newId(), key: def.id, rating: defaultRating(def), notes: '' });
    this.#open.add(def.category);
    await this.document.update({ 'system.options': list });
  }

  static async #onRemoveOption(this: SR2SafehouseSheet, _e: Event, t: HTMLElement) {
    if (!mustOwn(this.document)) return;
    const i = Number(t.closest<HTMLElement>('[data-index]')?.dataset['index']);
    const list = foundry.utils.deepClone(this.document.system.options ?? []) as any[];
    if (!list[i]) return;
    list.splice(i, 1);
    await this.document.update({ 'system.options': list });
  }

  // ---------------------------------------------------------------- People

  static async #onAddPerson(this: SR2SafehouseSheet, _e: Event, t: HTMLElement) {
    if (!mustOwn(this.document)) return;
    const sys: any = this.document.system;
    const role = t.dataset['role'] === 'owners' ? 'owners' : 'residents';
    const taken = new Set([...(sys.owners ?? []), ...(sys.residents ?? [])]);
    const list = people().filter((a: any) => !taken.has(a.uuid));
    if (!list.length) { ui.notifications?.info?.(tx('SR2E.Notify.Safehouse.everyoneIsAlreadyListed')); return; }
    const choice = await foundry.applications.api.DialogV2.prompt({
      window: { title: role === 'owners' ? tx('SR2E.Dialog.Safehouse.addAnOwner') : tx('SR2E.Dialog.Safehouse.addAResident') },
      content: `<div class="form-group"><label>${tx('SR2E.Dialog.Safehouse.who')}</label><select name="who">${list.map((a: any) => `<option value="${esc(a.uuid)}">${esc(a.name)}${a.type === 'npc' ? tx('SR2E.Dialog.Safehouse.npc') : ''}</option>`).join('')}</select></div>`,
      ok: { label: tx('SR2E.Dialog.Safehouse.add'), callback: (_ev: Event, b: any) => String(b.form.elements.who.value ?? '') },
      rejectClose: false,
    });
    if (!choice) return;
    await this.document.update({ [`system.${role}`]: [...(sys[role] ?? []), choice] });
  }

  static async #onRemovePerson(this: SR2SafehouseSheet, _e: Event, t: HTMLElement) {
    if (!mustOwn(this.document)) return;
    const role = t.dataset['role'] === 'owners' ? 'owners' : 'residents';
    const uuid = t.dataset['uuid'] ?? '';
    const sys: any = this.document.system;
    await this.document.update({ [`system.${role}`]: (sys[role] ?? []).filter((u: string) => u !== uuid) });
  }

  static async #onOpenActor(this: SR2SafehouseSheet, _e: Event, t: HTMLElement) {
    const a: any = await fromUuid(t.dataset['uuid'] ?? '');
    a?.sheet?.render(true);
  }

  // ---------------------------------------------------------------- Money

  /** Who can pay: the owners and residents first, then any other character this user owns. */
  #payers(): any[] {
    const sys: any = this.document.system;
    const listed = [...(sys.owners ?? []), ...(sys.residents ?? [])].map((u: string) => (globalThis as any).fromUuidSync?.(u)).filter(Boolean);
    const rest = people().filter((a: any) => !listed.includes(a));
    return [...listed, ...rest].filter((a: any) => a.isOwner && a.system?.nuyen != null);
  }

  static async #onPayBuild(this: SR2SafehouseSheet) {
    if (!mustOwn(this.document)) return;
    const h: any = this.document;
    const owed = Number(h.system.derived?.owed ?? 0);
    if (owed <= 0) { ui.notifications?.info?.(tx('SR2E.Notify.Safehouse.isPaidFor', { hName: escHtml(h.name) })); return; }
    const payers = this.#payers();
    if (!payers.length) { ui.notifications?.warn?.(tx('SR2E.Notify.Safehouse.youOwnNoCharacterWithNuyen')); return; }
    const choice = await foundry.applications.api.DialogV2.prompt({
      window: { title: tx('SR2E.Dialog.Safehouse.payToBuild', { name: h.name }) },
      content: `<div class="form-group"><label>${tx('SR2E.Dialog.Safehouse.paidBy')}</label><select name="payer">${payers.map((a: any) => `<option value="${esc(a.uuid)}">${esc(a.name)} (${yen(a.system.nuyen)})</option>`).join('')}</select></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Safehouse.amount')}</label><input name="amount" type="number" value="${owed}" min="1" max="${owed}"></div>
        <p class="hint">${tx('SR2E.Dialog.Safehouse.stillOwedPayInPartsIf', { yen: yen(owed) })}</p>`,
      ok: { label: tx('SR2E.Dialog.Safehouse.pay'), callback: (_ev: Event, b: any) => ({ payer: String(b.form.elements.payer.value ?? ''), amount: Math.max(0, Math.min(owed, Math.floor(Number(b.form.elements.amount.value) || 0))) }) },
      rejectClose: false,
    });
    if (!choice || !choice.amount) return;
    const payer: any = await fromUuid(choice.payer);
    if (!payer) return;
    if (!(await payer.adjustNuyen(-choice.amount, `Building ${h.name}`))) return;
    await h.update({ 'system.buildPaid': Number(h.system.buildPaid ?? 0) + choice.amount });
    await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: payer }), content: `<p><strong>${esc(payer.name)}</strong> ${tx('SR2E.Card.Safehouse.paysTowardsBuilding', { yen: yen(choice.amount) })} <strong>${esc(h.name)}</strong>${choice.amount >= owed ? tx('SR2E.Card.Safehouse.nowPaidFor') : tx('SR2E.Card.Safehouse.stillOwed', { yen: yen(owed - choice.amount) })}.</p>` });
  }

  static async #onPayUpkeep(this: SR2SafehouseSheet) {
    if (!mustOwn(this.document)) return;
    const h: any = this.document;
    const upkeep = Number(h.system.derived?.upkeep ?? 0);
    const payers = this.#payers();
    if (upkeep > 0 && !payers.length) { ui.notifications?.warn?.(tx('SR2E.Notify.Safehouse.youOwnNoCharacterWithNuyen')); return; }
    const choice = await foundry.applications.api.DialogV2.prompt({
      window: { title: tx('SR2E.Dialog.Safehouse.payUpkeep', { name: h.name }) },
      content: `${upkeep > 0 ? `<div class="form-group"><label>${tx('SR2E.Dialog.Safehouse.paidBy')}</label><select name="payer">${payers.map((a: any) => `<option value="${esc(a.uuid)}">${esc(a.name)} (${yen(a.system.nuyen)})</option>`).join('')}</select></div>` : ''}
        <div class="form-group"><label>${tx('SR2E.Dialog.Safehouse.months')}</label><input name="months" type="number" value="1" min="1" max="24"></div>
        <p class="hint">${tx('SR2E.Dialog.Safehouse.aMonthDaysFromTodayOr', { yen: yen(upkeep), upkeepMonthDays: RULES.UPKEEP.monthDays })}</p>`,
      ok: { label: tx('SR2E.Dialog.Safehouse.pay'), callback: (_ev: Event, b: any) => ({ payer: String(b.form.elements.payer?.value ?? ''), months: Math.max(1, Math.min(24, Math.floor(Number(b.form.elements.months.value) || 1))) }) },
      rejectClose: false,
    });
    if (!choice) return;
    const p = paySafehouse({ upkeep, months: choice.months, paidUntil: Number(h.system.paidUntil ?? -1), now: sysNow() });
    const payer: any = p.cost > 0 ? await fromUuid(choice.payer) : null;
    if (p.cost > 0) {
      if (!payer) return;
      if (!(await payer.adjustNuyen(-p.cost, tCount(Number(choice.months), 'SR2E.App.Safehouse.upkeepMonthS', { name: h.name })))) return;
    }
    await h.update({ 'system.paidUntil': p.paidUntil });
    await ChatMessage.create({ speaker: payer ? ChatMessage.getSpeaker({ actor: payer }) : { alias: h.name }, content: `<p>${tx('SR2E.Card.Safehouse.monthSOfUpkeepOn', { part: payer ? `<strong>${esc(payer.name)}</strong> ${tx('SR2E.Card.Safehouse.pays')}` : tx('SR2E.Card.Safehouse.paid'), yen: yen(p.cost), choiceMonths: esc(choice.months) })} <strong>${esc(h.name)}</strong>.</p>` });
  }

  // ---------------------------------------------------------------- Linked actors

  #needCreate(): boolean {
    if (!mustOwn(this.document)) return false;
    if (canCreateActors()) return true;
    ui.notifications?.warn?.(tx('SR2E.Notify.Safehouse.onlyAGmOrAPlayer'));
    return false;
  }

  static async #onMakeSite(this: SR2SafehouseSheet) {
    if (!this.#needCreate()) return;
    const h: any = this.document;
    const d = h.system.derived;
    if (!d.devices.length) { ui.notifications?.warn?.(tx('SR2E.Notify.Safehouse.addSomeSecurityDevicesFirst')); return; }
    const ids = d.devices.map(() => newId());
    const generated = siteDevicesFor(d.devices, (i) => ids[i]!);
    const old: any = h.system.siteUuid ? await fromUuid(h.system.siteUuid) : null;
    if (old && old.type === 'site') {
      if (!old.isOwner) { ui.notifications?.warn?.(tx('SR2E.Notify.Safehouse.youDonTOwn2', { oldName: escHtml(old.name) })); return; }
      const mine = (x: any) => String(x.notes ?? '').startsWith('Safehouse:');
      const keep = (old.system.devices ?? []).filter((x: any) => !mine(x));
      // A device made before keeps its id, token and door links (matched by name).
      const before = new Map<string, any>((old.system.devices ?? []).filter(mine).map((x: any) => [String(x.name), x]));
      const merged = generated.map((g: any) => {
        const b = before.get(String(g.name));
        return b ? { ...g, id: b.id, tokenUuid: b.tokenUuid ?? '', sceneId: b.sceneId ?? '', wallId: b.wallId ?? '', active: b.active, bypassed: b.bypassed, tamper: b.tamper ?? 0 } : g;
      });
      await old.update({ 'system.devices': [...keep, ...merged] });
      ui.notifications?.info?.(tx('SR2E.Notify.Safehouse.safehouseDeviceSRefreshed', { oldName: escHtml(old.name), generatedLength: generated.length, part: keep.length ? tx('SR2E.Notify.Safehouse.otherDeviceSKept', { keepLength: escHtml(keep.length) }) : '' }));
      old.sheet?.render(true);
      return;
    }
    const site: any = await Actor.create({ name: `${h.name} security`, type: 'site', folder: h.folder?.id ?? null, system: { devices: generated, ...(h.system.hostUuid ? { hostUuid: h.system.hostUuid } : {}) } } as any);
    if (!site) return;
    await h.update({ 'system.siteUuid': site.uuid });
    site.sheet?.render(true);
  }

  static async #onMakeWard(this: SR2SafehouseSheet) {
    if (!this.#needCreate()) return;
    const h: any = this.document;
    const force = Number(h.system.derived?.ward ?? 0);
    if (force <= 0) { ui.notifications?.warn?.(tx('SR2E.Notify.Safehouse.addAWardOptionFirst')); return; }
    const old: any = h.system.wardUuid ? await fromUuid(h.system.wardUuid) : null;
    if (old && old.type === 'barrier') {
      if (!old.isOwner) { ui.notifications?.warn?.(tx('SR2E.Notify.Safehouse.youDonTOwn2', { oldName: escHtml(old.name) })); return; }
      await old.update({ 'system.baseRating': force, 'system.rating': force });
      ui.notifications?.info?.(tx('SR2E.Notify.Safehouse.setToForce', { oldName: escHtml(old.name), force }));
      return;
    }
    const ward: any = await Actor.create({ name: `${h.name} ward`, type: 'barrier', folder: h.folder?.id ?? null, system: { barrierKind: 'ward', rating: force, baseRating: force } } as any);
    if (ward) await h.update({ 'system.wardUuid': ward.uuid });
  }

  static async #onMakeHost(this: SR2SafehouseSheet) {
    if (!this.#needCreate()) return;
    const h: any = this.document;
    const v = Number(h.system.derived?.host ?? 0);
    if (v <= 0) { ui.notifications?.warn?.(tx('SR2E.Notify.Safehouse.addAHomeHostOptionFirst')); return; }
    const old: any = h.system.hostUuid ? await fromUuid(h.system.hostUuid) : null;
    if (old && old.type === 'host') { old.sheet?.render(true); return; }
    const data = safehouseHostData(h.name, v);
    const host: any = await Actor.create({ ...data, folder: h.folder?.id ?? null } as any);
    if (!host) return;
    await h.update({ 'system.hostUuid': host.uuid });
    const site: any = h.system.siteUuid ? await fromUuid(h.system.siteUuid) : null;
    if (site?.type === 'site' && !site.system.hostUuid) await site.update({ 'system.hostUuid': host.uuid });
    host.sheet?.render(true);
  }

  static async #onGiveMagicSite(this: SR2SafehouseSheet, _e: Event, t: HTMLElement) {
    const h: any = this.document;
    if (!mustOwn(h)) return;
    const kind = t.dataset['kind'] ?? '';
    const m = (h.system.derived?.magicSites ?? []).find((x: any) => x.kind === kind);
    if (!m) return;
    const sys: any = h.system;
    const listed = [...(sys.owners ?? []), ...(sys.residents ?? [])].map((u: string) => (globalThis as any).fromUuidSync?.(u)).filter((a: any) => a?.isOwner);
    if (!listed.length) { ui.notifications?.warn?.(tx('SR2E.Notify.Safehouse.addAnOwnerOrResidentYou')); return; }
    const choice = listed.length === 1 ? listed[0].uuid : await foundry.applications.api.DialogV2.prompt({
      window: { title: tx('SR2E.Dialog.Safehouse.whoUsesIt', { label: m.label }) },
      content: `<div class="form-group"><label>${tx('SR2E.Dialog.Safehouse.magician')}</label><select name="who">${listed.map((a: any) => `<option value="${esc(a.uuid)}">${esc(a.name)}</option>`).join('')}</select></div>`,
      ok: { label: tx('SR2E.Dialog.Safehouse.give'), callback: (_ev: Event, b: any) => String(b.form.elements.who.value ?? '') },
      rejectClose: false,
    });
    if (!choice) return;
    const who: any = await fromUuid(choice);
    if (!who) return;
    const existing = [...who.items].find((i: any) => i.type === 'gear' && i.getFlag?.(SYSTEM.id, 'safehouse') === h.uuid && i.system.site?.kind === kind);
    if (existing) {
      await existing.update({ 'system.site.rating': m.rating });
      ui.notifications?.info?.(tx('SR2E.Notify.Safehouse.sIsNowRating', { whoName: escHtml(who.name), existingName: escHtml(existing.name), rating: escHtml(m.rating) }));
      return;
    }
    await who.createEmbeddedDocuments('Item', [{
      name: `${m.label} (${h.name})`, type: 'gear',
      system: { cost: 0, quantity: 1, site: { kind, rating: m.rating, tag: '' } },
      flags: { [SYSTEM.id]: { safehouse: h.uuid } },
    }]);
    ui.notifications?.info?.(tx('SR2E.Notify.Safehouse.nowHasTheRatingSetIts', { whoName: escHtml(who.name), label: escHtml(m.label.toLowerCase()), rating: escHtml(m.rating) }));
  }

  // ---------------------------------------------------------------- Searching for it

  static async #onSearchTest(this: SR2SafehouseSheet) {
    const h: any = this.document;
    const conceal = Number(h.system.derived?.concealment ?? 0);
    const s = RULES.SAFEHOUSE.search;
    const finders = people();
    const choice = await foundry.applications.api.DialogV2.prompt({
      window: { title: tx('SR2E.Dialog.Safehouse.someoneSearchesFor', { name: h.name }) },
      content: `<div class="form-group"><label>${tx('SR2E.Dialog.Safehouse.searcher')}</label><select name="who"><option value="">${tx('SR2E.Dialog.Safehouse.justDice')}</option>${finders.map((a: any) => `<option value="${esc(a.uuid)}" data-int="${esc(a.system?.attributes?.intelligence?.total)}">${esc(a.name)}</option>`).join('')}</select></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Safehouse.dice')}</label><input name="dice" type="number" value="6" min="1" max="60"></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Safehouse.otherTnModifier')}</label><input name="mod" type="number" value="0"></div>
        <p class="hint">${tx('SR2E.Dialog.Safehouse.vsTnConcealmentSuccessFindsIt', { skillHint: esc(s.skillHint), baseTn: s.baseTn, conceal, successes: s.successes, days: s.days })}</p>`,
      render: (_ev: Event, dialog: any) => {
        const form = dialog?.element?.querySelector('form');
        const sel = form?.querySelector('select[name="who"]');
        sel?.addEventListener('change', () => { const n = sel.selectedOptions?.[0]?.dataset?.int; if (n) form.elements.dice.value = n; });
      },
      ok: { label: tx('SR2E.Dialog.Safehouse.roll'), callback: (_ev: Event, b: any) => ({ who: String(b.form.elements.who.value ?? ''), dice: Math.max(1, Math.min(60, Math.floor(Number(b.form.elements.dice.value) || 1))), mod: Math.floor(Number(b.form.elements.mod.value) || 0) }) },
      rejectClose: false,
    });
    if (!choice) return;
    const who: any = choice.who ? (globalThis as any).fromUuidSync?.(choice.who) : null;
    const t = searchTarget(conceal, choice.mod);
    const r = await (SR2Actor as any).gmRoll({ dice: choice.dice, targetNumber: t.tn, modifiers: t.modifiers, label: who ? tx('SR2E.App.Safehouse.searchesFor', { who: who.name, name: h.name }) : tx('SR2E.App.Safehouse.searchingFor', { name: h.name }) });
    const days = searchDays(r.successes);
    const gms = [...((game as any).users ?? [])].filter((u: any) => u.isGM).map((u: any) => u.id);
    await ChatMessage.create({ speaker: { alias: tx('SR2E.Card.Safehouse.gm') }, whisper: gms, content: `<p><em>${tx('SR2E.Card.Safehouse.gmOnly')}</em> · ${days == null ? `<strong>${esc(h.name)}</strong> ${tx('SR2E.Card.Safehouse.isNotFound')}` : `<strong>${esc(h.name)}</strong> ${tx('SR2E.Card.Safehouse.isFoundIn')} <strong>${tx('SR2E.Card.Safehouse.dayS', { days })}</strong> ${tx('SR2E.Card.Safehouse.ofLooking')}`}</p>` });
  }

  static async #onPostSummary(this: SR2SafehouseSheet) {
    const h: any = this.document;
    const d = h.system.derived;
    const lines = (d.lines as any[]).filter((l) => !l.duplicate).map((l) => `${esc(l.label)}${l.rated ? ` ${esc(l.rating)}` : ''}`);
    await ChatMessage.create({
      speaker: { alias: h.name },
      content: `<h3>${esc(h.name)}</h3><p>${esc(d.size.label)} · ${esc(d.location.label)}${h.system.address ? ` · ${esc(h.system.address)}` : ''}</p>
        <p>${tx('SR2E.Card.Safehouse.comfortSecurityConcealmentBarrier', { lifeLabel: esc(lifeLabel(d.comfort)), security: esc(d.security), concealment: esc(d.concealment), barrier: esc(d.barrier), part: d.ward ? tx('SR2E.Card.Safehouse.ward', { ward: esc(d.ward) }) : '' })}</p>
        <p>${tx('SR2E.Card.Safehouse.builtForUpkeepMonthSpace', { yen: yen(d.buildCost), yen2: yen(d.upkeep), spaceUsed: esc(d.spaceUsed), space: esc(d.space) })}</p>
        ${lines.length ? `<p>${lines.join(', ')}</p>` : ''}`,
    });
  }
}
