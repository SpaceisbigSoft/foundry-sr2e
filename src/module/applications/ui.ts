/**
 * UI polish and GM tools (v0.41.0): field tooltips on every sheet, dice colours (colourblind-safe
 * and high-contrast), Dice So Nice colour sets, dropping a weapon or spell on a token, and the GM
 * panel (scene magic and light, world time, hosts and sites, the party, group rolls and damage).
 */
import { SYSTEM } from '../config/system.ts';
import { applyFieldTooltips } from '../config/tooltips.ts';
import {
  RULES, normalizeGroup, parseGroupSites, formatGroupSites, chargeDisarmTn, timeSteps, formatWorldTime, describeSpan, normalizePreset,
  describePreset, partyTotals, successOdds, parseModifierLines, percent, finalTargetNumber, describeEntry, cardTitle, undoLimits, undoLimitsV73,
  type ScenePreset,
  safehouseUpkeepStatus, lifestyleOf, readRegionEnv, LIGHT_LABELS, monitorView,
  partyCard, readMookCards, writeMookCards,
} from '../rules/index.ts';
import { isOrder } from '../rules/index.ts';
import type { AttributeKey } from '../models/index.ts';
import { useItem, runSheetAction, latestAttackOn } from './tokens.ts';
import { SR2Undo } from './undo.ts';
import { SR2NpcGenerator } from './npcgen.ts';
import { openSceneBuilder } from './scenebuilder.ts';
import { personRow, recentRollRow, poolsLine, combatChips, statusNames } from './groups.ts';
import { openAwardDialog } from './chat.ts';
import { DSN_COLORSETS } from './dice.ts';
import { dropAction, tokenIsActor, overflowBody } from './groups.ts';
import { groupActors } from './groups.ts';
import { envRegions, regionHas, tokenPoint } from './regions.ts';
import { exportTemplatesToCompendium, promptImportTemplates } from './qol.ts';
import { SR2NewEntry } from './newentry.ts';
import { pendingRequests, approveRequest, declineRequest, queueOn, requestsOf, describeRequestData, requestProblems, filerLabel } from './approvals.ts';
import { escHtml } from '../rules/html.ts';
import { underwayRows, projectAction } from './projects.ts';
import { setupContext, SETUP_ACTIONS, bindSetupTab, setSetupRefresh } from './setup.ts';
import { CATALOGUE_ACTIONS } from './catalogue.ts';
import { isItemPile } from './modules.ts';
export { dropAction, groupActors } from './groups.ts';
export { DSN_COLORSETS, dsnColoursOn, dsnColorsetFor } from './dice.ts';

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const ATTRS: AttributeKey[] = ['body', 'quickness', 'strength', 'charisma', 'intelligence', 'willpower'];

// ---------------------------------------------------------------- Dice colours

/** Dice colours on cards: a body class the stylesheet keys on (v0.81.0: in helpers/dicecolours.ts, shared with settings.ts). */
export { applyDiceColours } from '../helpers/dicecolours.ts';
import { applyDiceColours } from '../helpers/dicecolours.ts';
import { t as tx, tCount, tKey } from '../helpers/i18n.ts';

// ---------------------------------------------------------------- Drop a weapon or spell on a token

/** The topmost token under a canvas point. */
function tokenAt(x: number, y: number): any | null {
  const list = [...((canvas as any)?.tokens?.placeables ?? [])].filter((t: any) => t.visible !== false && (t.bounds?.contains?.(x, y)
    || (x >= t.x && y >= t.y && x <= t.x + (t.w ?? t.width ?? 0) && y <= t.y + (t.h ?? t.height ?? 0))));
  return list.sort((a: any, b: any) => (b.document?.sort ?? 0) - (a.document?.sort ?? 0))[0] ?? null;
}

function onDropCanvas(_canvas: any, data: any): boolean | void {
  if (data?.type !== 'Item' || !data.uuid) return;
  const item: any = fromUuidSync(data.uuid);
  const action = item ? dropAction(item.type) : null;
  if (!item?.parent || !action) return;
  const token = tokenAt(Number(data.x), Number(data.y));
  if (!token) return;
  if (!item.parent.isOwner) { ui.notifications.warn(tx('SR2E.Notify.Ui.youDonTOwn', { itemName: escHtml(item.parent.name) })); return false; }
  if (action === 'attack' && tokenIsActor(token, item.parent)) { ui.notifications.warn(tx('SR2E.Notify.Ui.canTAttackThemselves', { itemName: escHtml(item.parent.name) })); return false; }
  try { token.setTarget?.(true, { releaseOthers: true, groupSelection: false }); } catch { /* older API */ }
  void useItem(item.uuid);
  return false;
}

// ---------------------------------------------------------------- The GM panel

const WHO = (): string => `<div class="form-group"><label>${tx('SR2E.App.Ui.who')}</label><select name="who">
  <option value="selected">${tx('SR2E.App.Ui.selectedTokens')}</option><option value="npcs">${tx('SR2E.App.Ui.everyNpcTokenOnTheScene')}</option><option value="party">${tx('SR2E.App.Ui.thePartyPlayerCharacters')}</option></select></div>`;

export class SR2GmPanel extends HandlebarsApplicationMixin(ApplicationV2) {
  /** v0.48.0: the fuel kind last picked in the panel. */
  static fuelKind = '';
  static DEFAULT_OPTIONS: Record<string, any> = {
    id: 'sr2e-gm-panel',
    classes: ['sr2e', 'sr2e-gm-panel'],
    window: { title: 'SR2E.Window.Ui.sr2eGmPanel', resizable: true, icon: 'fa-solid fa-sliders' },
    position: { width: 600, height: 720 },
    actions: {
      // v0.51.0
      gmTab: SR2GmPanel.#onTab,
      combatNext: SR2GmPanel.#onCombatNext,
      combatPrev: SR2GmPanel.#onCombatPrev,
      combatStart: SR2GmPanel.#onCombatStart,
      combatRollNpc: SR2GmPanel.#onCombatRollNpc,
      combatAddSelected: SR2GmPanel.#onCombatAddSelected,
      quick: SR2GmPanel.#onQuick,
      box: SR2GmPanel.#onBox,
      panToken: SR2GmPanel.#onPanToken,
      healSeveral: SR2GmPanel.#onHealSeveral,
      savePreset: SR2GmPanel.#onSavePreset,
      applyPreset: SR2GmPanel.#onApplyPreset,
      deletePreset: SR2GmPanel.#onDeletePreset,
      undo: SR2GmPanel.#onUndo,
      undoTo: SR2GmPanel.#onUndoTo,
      clearUndo: SR2GmPanel.#onClearUndo,
      calcRoll: SR2GmPanel.#onCalcRoll,
      showMessage: SR2GmPanel.#onShowMessage,
      npcGenerator: () => void SR2NpcGenerator.open(),
      // v0.91.7: the Scene builder, for a new scene or the viewed one.
      sceneBuilder: () => { openSceneBuilder({ sceneId: '' }); },
      sceneBuilderHere: () => { const sc: any = (game as any).scenes?.viewed ?? (game as any).scenes?.current; openSceneBuilder(sc ? { sceneId: sc.id } : {}); },
      advanceTime: SR2GmPanel.#onAdvanceTime,
      refreshPools: SR2GmPanel.#onRefreshPools,
      refreshKarma: SR2GmPanel.#onRefreshKarma,
      award: () => void openAwardDialog(),
      openActor: SR2GmPanel.#onOpenActor,
      groupRoll: SR2GmPanel.#onGroupRoll,
      groupDamage: SR2GmPanel.#onGroupDamage,
      resetHost: SR2GmPanel.#onResetHost,
      clearSmoke: SR2GmPanel.#onClearSmoke,
      blowCharge: SR2GmPanel.#onBlowCharge,
      disarmCharge: SR2GmPanel.#onDisarmCharge,
      disarmTest: SR2GmPanel.#onDisarmTest,
      repairWall: SR2GmPanel.#onRepairWall,
      repairWallTest: SR2GmPanel.#onRepairWallTest,
      panWall: SR2GmPanel.#onPanWall,
      newGroup: SR2GmPanel.#onNewGroup,
      editGroup: SR2GmPanel.#onEditGroup,
      deleteGroup: SR2GmPanel.#onDeleteGroup,
      breach: SR2GmPanel.#onBreach,
      clearBreach: SR2GmPanel.#onClearBreach,
      removeGrimoire: SR2GmPanel.#onRemoveGrimoire,
      startFire: SR2GmPanel.#onStartFire,
      spreadFire: SR2GmPanel.#onSpreadFire,
      putOutFire: SR2GmPanel.#onPutOutFire,
      markFuel: SR2GmPanel.#onMarkFuel,
      clearFuel: SR2GmPanel.#onClearFuel,
      panFire: SR2GmPanel.#onPanFire,
      moraleGroup: SR2GmPanel.#onMoraleGroup,
      moraleUngroup: SR2GmPanel.#onMoraleUngroup,
      moraleTest: SR2GmPanel.#onMoraleTest,
      // v0.60.0
      openRegion: SR2GmPanel.#onOpenRegion,
      exportTemplates: () => void exportTemplatesToCompendium(),
      // v0.64.0
      approveRequest: SR2GmPanel.#onApproveRequest,
      // v0.91.1: the Setup tab's New entry… (the GM saves it to the catalogue).
      newEntry: () => { SR2NewEntry.open({}); },
      // v0.91.1: a player's new entry, checked and edited in its form before it goes into the catalogue.
      reviewEntry: (_e: Event, t: HTMLElement) => { SR2NewEntry.open({ review: { actorUuid: t.dataset['uuid'] ?? '', requestId: t.dataset['id'] ?? '' } }); },
      // v0.65.0
      projectTimeGm: (_e: Event, t: HTMLElement) => { const a: any = fromUuidSync(t.dataset['uuid'] ?? ''); void projectAction(a, 'time', t.dataset['projectId'] ?? '', t.dataset['training'] === '1').then(() => SR2GmPanel.refresh()); },
      projectCancelGm: (_e: Event, t: HTMLElement) => { const a: any = fromUuidSync(t.dataset['uuid'] ?? ''); void projectAction(a, 'cancel', t.dataset['projectId'] ?? '', false).then(() => SR2GmPanel.refresh()); },
      projectFinishGm: (_e: Event, t: HTMLElement) => { const a: any = fromUuidSync(t.dataset['uuid'] ?? ''); void projectAction(a, 'finish', t.dataset['projectId'] ?? '', t.dataset['training'] === '1').then(() => SR2GmPanel.refresh()); },
      declineRequest: SR2GmPanel.#onDeclineRequest,
      importTemplates: () => void promptImportTemplates(),
      // v0.66.0: the Setup tab.
      ...SETUP_ACTIONS,
      ...CATALOGUE_ACTIONS,
      startTour: (_e: Event, t: HTMLElement) => void (game as any).sr2e?.api?.startTour?.(t.dataset['tour'] ?? 'gm-panel'),
      openHelp: (_e: Event, t: HTMLElement) => void (game as any).sr2e?.api?.openHelp?.(t.dataset['topic']),
      // v0.68.0: NPC rows or compact stat cards (this browser's choice).
      toggleMookCards: SR2GmPanel.#onToggleMookCards,
    },
  };

  static PARTS: Record<string, any> = { main: { template: `${SYSTEM.PATH.TEMPLATES}/gm-panel.hbs`, scrollable: [''] } };

  /** v0.64.0: approve a player's request (it runs now, on this client). */
  static #requestBusy = new Set<string>();
  static async #onApproveRequest(this: SR2GmPanel, _e: Event, t: HTMLElement) {
    const id = t.dataset['id'] ?? '';
    const actor: any = fromUuidSync(t.dataset['uuid'] ?? '');
    if (!actor || !id || SR2GmPanel.#requestBusy.has(id)) return;
    // v0.81.0 (A-9, SEC1-10): the GM approves what will run, read from the request's data (the player owns the actor
    // and can change a request after filing it), not the label their client wrote.
    const r = requestsOf(actor).find((x) => x.id === id);
    if (!r) return;
    const problems = requestProblems(actor, r);
    const cost = [r.karma ? `${r.karma} Karma` : '', r.nuyen ? `¥${r.nuyen.toLocaleString()}` : ''].filter(Boolean).join(' + ') || 'nothing';
    const ok = await foundry.applications.api.DialogV2.confirm({
      window: { title: tx('SR2E.Dialog.Ui.approveTheRequest') },
      // v0.81.1 round 2 (F): the filer this GM client saw, else marked as not verified.
      content: `<p><strong>${escHtml(filerLabel(r))}</strong> ${tx('SR2E.Dialog.Ui.for')} <strong>${escHtml(actor.name)}</strong>:</p><p>${escHtml(describeRequestData(r))}</p><p>${tx('SR2E.Dialog.Ui.costs', { cost: escHtml(cost) })}</p>${problems.length ? `<p class="sr2e-warn">${tx('SR2E.Dialog.Ui.itWonTRun', { problems: escHtml(problems.join('; ')) })}</p>` : ''}`,
      rejectClose: false,
    });
    if (!ok) return;
    SR2GmPanel.#requestBusy.add(id);
    (t as HTMLButtonElement).disabled = true;
    try { await approveRequest(actor, id); } finally { SR2GmPanel.#requestBusy.delete(id); SR2GmPanel.refresh(); }
  }

  static async #onDeclineRequest(this: SR2GmPanel, _e: Event, t: HTMLElement) {
    const id = t.dataset['id'] ?? '';
    const actor: any = fromUuidSync(t.dataset['uuid'] ?? '');
    if (!actor || !id) return;
    const reason = await foundry.applications.api.DialogV2.prompt({
      window: { title: tx('SR2E.Dialog.Ui.declineTheRequest') },
      content: `<div class="form-group"><label>${tx('SR2E.Dialog.Ui.whyOptionalWhisperedToThePlayer')}</label><input name="why" type="text" autofocus></div>`,
      ok: { label: tx('SR2E.Dialog.Ui.decline'), callback: (_ev: Event, b: any) => String(b.form.elements.why.value ?? '') },
      rejectClose: false,
    });
    if (reason === null || reason === undefined) return;
    await declineRequest(actor, id, String(reason));
    SR2GmPanel.refresh();
  }

  static #instance: SR2GmPanel | null = null;
  /** Open the GM panel (null for a player: A-19). */
  static open(): SR2GmPanel | null {
    if (!game.user?.isGM) { ui.notifications.warn(tx('SR2E.Notify.Ui.theGmPanelIsForGms')); return null; }
    SR2GmPanel.#instance ??= new SR2GmPanel();
    void SR2GmPanel.#instance.render({ force: true });
    return SR2GmPanel.#instance;
  }
  static #timer: ReturnType<typeof setTimeout> | null = null;
  /** Re-render the open panel soon (several changes at once render once). */
  static refresh(): void {
    const p = SR2GmPanel.#instance;
    if (!p?.rendered) return;
    if (SR2GmPanel.#timer) clearTimeout(SR2GmPanel.#timer);
    SR2GmPanel.#timer = setTimeout(() => {
      SR2GmPanel.#timer = null;
      // v0.51.0: don't re-render under someone typing (notes, calculator); catch up when they leave the field.
      const el: HTMLElement | null = (p as any).element ?? null;
      const active = document.activeElement as HTMLElement | null;
      const typing = active?.tagName === 'TEXTAREA' || (active?.tagName === 'INPUT' && ['text', 'number', 'search', ''].includes((active as HTMLInputElement).type));
      if (el && active && el.contains(active) && typing) {
        active.addEventListener('blur', () => SR2GmPanel.refresh(), { once: true });
        return;
      }
      void p.render();
    }, 250);
  }

  async _prepareContext(_options: any): Promise<any> {
    const cls: any = CONFIG.Actor.documentClass;
    const scene: any = game.scenes?.viewed ?? game.scenes?.current;
    const actors = [...((game as any).actors ?? [])];
    const combat: any = (game as any).combat;
    const wt = Number((game as any).time?.worldTime ?? 0);
    const now = cls.matrixNow?.() ?? { round: null, worldTime: wt };
    return {
      scene: scene ? {
        name: scene.name,
        background: cls.backgroundCount?.() ?? 0,
        sources: String(scene.getFlag?.(SYSTEM.id, 'backgroundSources') ?? ''),
        environment: (cls.sceneEnvironment?.() ?? []).join(', '),
        darkness: Number(scene.environment?.darknessLevel ?? scene.darkness ?? 0),
        weather: RULES.HEALTH.weather.map((w) => ({ key: w.id, label: w.label, selected: w.id === (cls.sceneWeather?.() ?? 'clear') })),
        terrain: [{ key: '', label: tx('SR2E.App.Ui.pickInEachTest'), selected: !cls.sceneTerrain?.() }, ...RULES.VEHICLES.terrain.map((t) => ({ key: t.id, label: t.label, selected: t.id === cls.sceneTerrain?.() }))],
      } : null,
      ...SR2GmPanel.#extraContext(scene, combat, wt),
      regions: SR2GmPanel.#envRegions(scene),
      time: { label: formatWorldTime(wt), combat: combat?.started ? (combat.flags?.sr2e?.pass ? tx('SR2E.App.Ui.combatTurnPass', { round: combat.round, pass: combat.flags.sr2e.pass + 1 }) : tx('SR2E.App.Ui.combatTurn', { round: combat.round })) : '' },
      hosts: actors.filter((a: any) => a.type === 'host').map((h: any) => ({
        uuid: h.uuid, name: h.name, kind: (h.system.gridKind ?? 'host').toUpperCase(), code: `${cap(h.system.securityCode)}-${h.system.securityValue}`,
        tally: h.system.tally, alert: h.system.alert, next: h.system.derived?.nextStep?.step ?? null,
        smoke: cls.smokeMods?.(h)?.length ? h.system.smoke.tn : 0,
        deckers: actors.filter((a: any) => a.isJackedIn?.() && a.system.matrix?.hostUuid === h.uuid).map((a: any) => a.name).join(', '),
        alerts: RULES.MATRIX.alerts.map((k: string) => ({ key: k, label: cap(k), selected: k === h.system.alert })),
      })),
      sites: actors.filter((a: any) => a.type === 'site').map((s: any) => ({
        uuid: s.uuid, name: s.name, tally: s.system.tally, alert: s.system.alert,
        alerts: RULES.SECURITY.alerts.map((k: string) => ({ key: k, label: cap(k), selected: k === s.system.alert })),
      })),
      // v0.53.0: safehouses and their upkeep.
      safehouses: actors.filter((a: any) => a.type === 'safehouse').map((h: any) => {
        const d = h.system.derived ?? {};
        const st = safehouseUpkeepStatus(Number(h.system.paidUntil ?? -1), wt);
        return { uuid: h.uuid, name: h.name, upkeep: Number(d.upkeep ?? 0).toLocaleString(), owed: d.owed ? Number(d.owed).toLocaleString() : '',
          status: st.days == null ? tx('SR2E.App.Ui.upkeepNeverPaid') : st.lapsed ? tCount(-st.days, 'SR2E.App.Ui.upkeepLapsedDayS') : st.overdue ? tCount(-st.days, 'SR2E.App.Ui.upkeepDaySLate') : tCount(st.days, 'SR2E.App.Ui.paidForDayS'),
          late: st.overdue || st.days == null, comfort: d.comfort ? lifestyleOf(d.comfort).label : '', residents: (h.system.residents ?? []).length + (h.system.owners ?? []).length };
      }),
      // v0.68.0: the party as cards (portrait, player, monitor, ± boxes, wound TN, initiative, pools, money, state, chips).
      party: actors.filter((a: any) => a.type === 'character' && a.hasPlayerOwner).map((a: any) => SR2GmPanel.#partyCard(a, combat, scene)),
      selected: [...((canvas as any)?.tokens?.controlled ?? [])].map((t: any) => t.name).join(', '),
      // v0.49.0: mixed groups for morale on the viewed scene.
      moraleGroups: (() => {
        if (!scene) return [];
        const by = new Map<string, any[]>();
        for (const t of [...(scene.tokens ?? [])] as any[]) {
          const id = t.getFlag?.(SYSTEM.id, 'moraleGroup');
          if (!id) continue;
          if (!by.has(id)) by.set(id, []);
          by.get(id)!.push(t);
        }
        return [...by.entries()].map(([id, toks]) => ({ id, names: toks.map((t: any) => t.name).join(', '), broken: toks.some((t: any) => t.actor?.isBroken?.()),
          standing: toks.filter((t: any) => !['unconscious', 'dying', 'dead'].includes(t.actor?.system?.derived?.status ?? 'ok')).length, size: toks.length,
          uuid: toks.find((t: any) => !['unconscious', 'dying', 'dead'].includes(t.actor?.system?.derived?.status ?? 'ok'))?.actor?.uuid ?? toks[0]?.actor?.uuid ?? '' }));
      })(),
      moraleMode: RULES.MORALE.mixed,
      now,
      // v0.43.0: timed charges and damaged walls on the viewed scene.
      charges: scene ? (cls.armedCharges?.(scene) ?? []).map((c: any) => ({
        id: c.id, sceneId: scene.id, name: c.name, power: c.power, place: c.place, disarmTn: chargeDisarmTn(c.setterSuccesses ?? 0),
        left: c.at?.worldTime >= 0 ? Math.max(0, Math.ceil(c.at.worldTime - wt)) : null, round: c.at?.round >= 0 ? c.at.round : null,
      })) : [],
      walls: scene ? (cls.damagedWalls?.(scene) ?? []).map((w: any) => ({ id: w.id, rating: w.rating, full: w.full, breached: w.breached })) : [],
      // v0.45.0: magical groups (world) and fires on the viewed scene.
      groups: (cls.magicGroups?.() ?? []).map((g: any) => ({
        id: g.id, name: g.name, tradition: g.tradition,
        members: g.members.map((u: string) => fromUuidSync(u)?.name ?? '(gone)').join(', '),
        strictures: g.strictures.length, sites: g.sites.map((s: any) => `${s.name} (${s.kind} ${s.rating})`).join(', '),
        grimoire: g.grimoire.map((s: any) => ({ name: s.name, id: g.id })),
        breaches: g.breaches.map((b: any) => ({ uuid: b.uuid, id: g.id, name: fromUuidSync(b.uuid)?.name ?? '?', text: g.strictures.find((s: any) => s.id === b.strictureId)?.text ?? '' })),
      })),
      fires: scene ? (cls.sceneFires?.(scene) ?? []).map((f: any) => ({ ...f, sceneId: scene.id, radius: Math.round(f.radius * 10) / 10 })) : [],
      // v0.48.0: fuel drawings on the viewed scene.
      fuelKinds: Object.entries(RULES.FIRE.fuel.kinds).map(([id, k]) => ({ id, label: k.label, selected: id === SR2GmPanel.fuelKind })),
      fuel: scene ? (cls.fuelAreas?.(scene) ?? []).map((a: any) => ({ id: a.id, label: a.label, x: a.rect.x + a.rect.width / 2, y: a.rect.y + a.rect.height / 2,
        status: a.burnt ? 'burnt' : a.burning ? 'burning' : 'not alight' })) : [],
    };
  }

  /** v0.68.0: one party card's context (the row fields the template already used, plus the card's view). */
  static #partyCard(a: any, combat: any, scene: any): any {
    const d = a.system.derived ?? {};
    const users = [...((game as any).users ?? [])];
    const player = users.find((u: any) => !u.isGM && u.character?.id === a.id)
      ?? users.find((u: any) => !u.isGM && a.testUserPermission?.(u, 'OWNER'));
    const cb = combat ? [...(combat.combatants ?? [])].find((c: any) => c.actor?.uuid === a.uuid || c.actorId === a.id) : null;
    const started = Boolean(combat?.started && cb);
    const token = scene ? [...(scene.tokens ?? [])].find((t: any) => t.actor?.uuid === a.uuid || (t.actorLink && t.actorId === a.id)) : null;
    const view = partyCard({
      name: a.name, img: a.img, player: player?.name ?? '', status: d.status ?? 'ok', wound: Number(d.woundModifier ?? 0),
      pools: { combat: [d.combatPoolLeft, d.combatPool], spell: [d.spellPoolLeft, d.spellPool], hacking: [d.hackingPoolLeft, d.hackingPool],
        control: [d.controlPoolLeft, d.controlPool], karma: [d.karmaPoolLeft, a.system.karma?.pool] },
      goodKarma: Number(a.system.karma?.good ?? 0), nuyen: Number(a.system.nuyen ?? 0),
      astral: d.astralMode && d.astralMode !== 'physical' ? `astral: ${d.astralMode}` : '',
      matrix: d.matrix?.jackedIn ? tx('SR2E.App.Ui.inTheMatrix', { monitor: a.system.matrix?.monitor ?? 0 }) : '',
      chips: [...combatChips(a), ...statusNames(a)],
      initiative: started ? cb.initiative : null, inCombat: started, acting: Boolean(started && combat.combatant?.id === cb.id),
    });
    return {
      ...view, uuid: a.uuid, physical: a.system.monitor?.physical ?? 0, stun: a.system.monitor?.stun ?? 0, pools: poolsLine(a), poolChips: view.pools,
      cm: monitorView(a.system.monitor, overflowBody(a.system), { overflow: a.type !== 'spirit' }),
      matrix: d.matrix?.jackedIn ? tx('SR2E.App.Ui.inTheMatrix', { monitor: a.system.matrix?.monitor ?? 0 }) : '', astral: d.astralMode && d.astralMode !== 'physical' ? d.astralMode : '',
      tokenId: token?.id ?? '', sceneId: scene?.id ?? '',
    };
  }

  // ---- v0.51.0: tabs, combat overview, quick actions, presets, notes, calculator, undo, recent rolls

  /** v0.89.8: labels are keys (shown with tKey). */
  static GM_TABS = [
    { id: 'scene', label: 'SR2E.App.Ui.tabScene', icon: 'fa-solid fa-map' },
    { id: 'combat', label: 'SR2E.App.Ui.tabCombat', icon: 'fa-solid fa-burst' },
    { id: 'party', label: 'SR2E.App.Ui.tabParty', icon: 'fa-solid fa-users' },
    { id: 'npcs', label: 'SR2E.App.Ui.tabNpcs', icon: 'fa-solid fa-user-ninja' },
    { id: 'world', label: 'SR2E.App.Ui.tabWorld', icon: 'fa-solid fa-globe' },
    { id: 'tools', label: 'SR2E.App.Ui.tabTools', icon: 'fa-solid fa-calculator' },
    { id: 'log', label: 'SR2E.App.Ui.tabLog', icon: 'fa-solid fa-clock-rotate-left' },
    // v0.64.0: the approval queue.
    { id: 'requests', label: 'SR2E.App.Ui.tabRequests', icon: 'fa-solid fa-user-check' },
    // v0.66.0: kits, catalogue, players, tokens, the session checklist, modules.
    { id: 'setup', label: 'SR2E.App.Ui.tabSetup', icon: 'fa-solid fa-screwdriver-wrench' },
  ];
  /** The open tab (kept across refreshes). */
  static tab = 'scene';
  /** The calculator's inputs (kept across refreshes). */
  static calc = { dice: 6, tn: 4, mods: '', label: '', public: false };

  static presets(): ScenePreset[] {
    try { return ((game.settings.get(SYSTEM.id, 'scenePresets') as any[]) ?? []).map(normalizePreset); } catch { return []; }
  }
  static notes(): Record<string, string> {
    try { return { ...((game.settings.get(SYSTEM.id, 'encounterNotes') as Record<string, string>) ?? {}) }; } catch { return {}; }
  }

  /** The calculator's numbers for the current inputs. */
  static calcResult(c = SR2GmPanel.calc): { tn: number; mods: string; expected: string; disaster: string; perDie: string; rows: Array<{ k: number; p: string }> } {
    const mods = parseModifierLines(c.mods);
    const { targetNumber } = finalTargetNumber(Math.floor(Number(c.tn) || 0), mods);
    const dice = Math.max(0, Math.min(60, Math.floor(Number(c.dice) || 0)));
    const o = successOdds(dice, targetNumber);
    return {
      tn: targetNumber, mods: mods.map((m) => `${m.label} ${m.value >= 0 ? '+' : ''}${m.value}`).join(', '),
      expected: o.expected.toFixed(1), disaster: percent(o.disaster), perDie: percent(o.perDie),
      rows: o.atLeast.slice(1, Math.min(dice, 8) + 1).map((p, i) => ({ k: i + 1, p: percent(p) })),
    };
  }

  static #extraContext(scene: any, combat: any, wt: number): Record<string, unknown> {
    const cls: any = CONFIG.Actor.documentClass;
    const ago = (t: number) => { const s = Math.max(0, Math.round((Date.now() - t) / 1000)); return s < 60 ? `${s} s ago` : s < 3600 ? `${Math.floor(s / 60)} min ago` : `${Math.floor(s / 3600)} h ago`; };
    // Combat overview: every combatant in turn order.
    const turns: any[] = combat ? [...(combat.turns ?? [])] : [];
    const combatRows = turns.map((c: any) => {
      const a = c.actor;
      const base = a ? personRow(a) : { name: c.name, uuid: '', monitor: false };
      return { ...base, name: c.name ?? base.name, initiative: c.initiative === null || c.initiative === undefined ? '—' : String(c.initiative), current: combat?.combatant?.id === c.id, defeated: Boolean(c.isDefeated),
        tokenId: c.tokenId ?? '', sceneId: c.sceneId ?? '', canDefend: Boolean(a && latestAttackOn(a)), hidden: Boolean(c.hidden) };
    });
    // Everyone not a player's on the viewed scene, for quick NPC actions.
    const seen = new Set<string>();
    const people = scene ? [...(scene.tokens ?? [])].filter((t: any) => t.actor && !t.actor.hasPlayerOwner && ['npc', 'character', 'spirit', 'vehicle', 'ic'].includes(t.actor.type) && !isItemPile(t.actor))
      .filter((t: any) => !seen.has(t.actor.uuid) && (seen.add(t.actor.uuid), true)).slice(0, 40)
      .map((t: any) => ({ ...personRow(t.actor), tokenId: t.id, sceneId: scene.id, canDefend: Boolean(latestAttackOn(t.actor)), selected: Boolean(t.object?.controlled) })) : [];
    // Money and Karma.
    const partyActors = [...((game as any).actors ?? [])].filter((a: any) => a.type === 'character' && a.hasPlayerOwner);
    const money = partyActors.map((a: any) => {
      const life = (() => { try { return a.lifestyleStatus?.() ?? null; } catch { return null; } })();
      return { uuid: a.uuid, name: a.name, nuyen: Number(a.system.nuyen ?? 0), karma: Number(a.system.karma?.good ?? 0), pool: Number(a.system.karma?.pool ?? 0),
        poolLeft: Number(a.system.derived?.karmaPoolLeft ?? 0), career: Number(a.system.karma?.career ?? 0),
        lifestyleDays: life?.days ?? null, lifestyle: life ? (life.days === null ? life.label : life.days < 0 ? tx('SR2E.App.Ui.dOverdue', { label: life.label, days: -life.days }) : tx('SR2E.App.Ui.dPaid', { label: life.label, days: life.days })) : '' };
    });
    const totals = partyTotals(money);
    // Undo log, newest first.
    const steps = SR2Undo.steps();
    const newest = steps[0];
    const recent = [...(((game as any).messages?.contents ?? []) as any[])].slice(-80).reverse()
      .map((m) => recentRollRow(m, cardTitle)).filter(Boolean).slice(0, RULES.GM_TOOLS.recentRolls);
    const notes = scene ? SR2GmPanel.notes()[scene.id] ?? '' : '';
    const requests = pendingRequests();
    // v0.65.0: everything under way on player characters.
    const underway = partyActors.flatMap((a: any) => underwayRows(a).map((r) => ({ ...r, uuid: a.uuid, actorName: a.name }))).sort((x: any, y: any) => x.leftHours - y.leftHours);
    // v0.91.0: the shop's open orders (bought, on their way) and the purchases waiting for the GM's yes.
    const orders = underway.filter((r: any) => isOrder(r));
    return {
      underway, orders,
      setup: SR2GmPanel.tab === 'setup' ? setupContext() : null,
      tabs: SR2GmPanel.GM_TABS.map((t) => ({ ...t, label: tKey(t.label), active: t.id === SR2GmPanel.tab, ...(t.id === 'requests' ? { count: requests.length } : {}) })),
      requests, queueOn: queueOn(),
      tab: Object.fromEntries(SR2GmPanel.GM_TABS.map((t) => [t.id, t.id === SR2GmPanel.tab])),
      timeSteps: timeSteps().map((t) => ({ ...t, big: t.seconds >= RULES.GM_TOOLS.confirmFrom && RULES.GM_TOOLS.confirmFrom > 0 })),
      presets: SR2GmPanel.presets().map((p) => ({ ...p, text: describePreset({ ...p, weather: RULES.HEALTH.weather.find((w) => w.id === p.weather)?.label ?? p.weather,
        terrain: RULES.VEHICLES.terrain.find((t: any) => t.id === p.terrain)?.label ?? p.terrain }) })),
      notes,
      combatInfo: combat ? {
        started: Boolean(combat.started), round: combat.round ?? 0, pass: Number(combat.pass ?? combat.flags?.sr2e?.pass ?? 0) + 1,
        current: combat.combatant?.name ?? '', count: turns.length, scene: combat.scene?.name ?? '',
      } : null,
      combatRows,
      people,
      mookCards: SR2GmPanel.mookCards(),
      money, totals: { ...totals, nuyenText: totals.nuyen.toLocaleString(), behind: totals.behind.join(', ') },
      calc: { ...SR2GmPanel.calc, result: SR2GmPanel.calcResult() },
      undo: {
        next: newest ? `${newest.label} (${newest.userName}, ${ago(newest.last)})` : '',
        steps: steps.slice(0, 25).map((s) => ({ id: s.id, label: s.label, user: s.userName, ago: ago(s.last), count: s.entries.length, partial: Boolean(s.partial),
          lines: s.entries.slice(-12).reverse().map((e) => describeEntry(e)), more: Math.max(0, s.entries.length - 12) })),
        // v0.90.0: one counted text (the template built an English plural).
        total: steps.length, keptText: tCount(steps.length, 'SR2E.App.Ui.stepsKept'), limits: undoLimitsV73(undoLimits()),
      },
      recent,
      sceneId: scene?.id ?? '',
      worldTime: wt,
      backgroundSourcesCount: cls.backgroundSources?.()?.length ?? 0,
    };
  }

  /** v0.66.0: a checklist line's button: switch tab, or run one of the panel's own actions. */
  #runChecklistAction(act: string): unknown {
    if (act.startsWith('tab:')) { SR2GmPanel.tab = act.slice(4); return this.render(); }
    const fn: any = (SR2GmPanel.DEFAULT_OPTIONS['actions'] as Record<string, any>)[act];
    return typeof fn === 'function' ? fn.call(this, new Event('click'), (this as any).element) : undefined;
  }

  /** v0.68.0: whether NPC rows show as compact stat cards (kept in this browser, default on). */
  static mookCards(): boolean { return readMookCards(SR2GmPanel.#store()); }

  /** The browser's storage, or null where reading it throws (blocked site data). */
  static #store(): any { try { return (globalThis as any).localStorage ?? null; } catch { return null; } }

  static #onToggleMookCards(this: SR2GmPanel) {
    writeMookCards(SR2GmPanel.#store(), !SR2GmPanel.mookCards());
    void this.render();
  }

  static #onTab(this: SR2GmPanel, _e: Event, target: HTMLElement) {
    SR2GmPanel.tab = target.dataset['tab'] ?? 'scene';
    void this.render();
  }

  static async #onCombatNext(this: SR2GmPanel) { await (game as any).combat?.nextTurn?.(); }
  static async #onCombatPrev(this: SR2GmPanel) { await (game as any).combat?.previousTurn?.(); }
  static async #onCombatStart(this: SR2GmPanel) {
    const c: any = (game as any).combat;
    if (!c) return ui.notifications.warn(tx('SR2E.Notify.Ui.noCombatYetAddTheSelected'));
    if (!c.started) await c.startCombat();
  }
  /** v0.60.0: the viewed scene's regions with an SR2 environment, and who stands in each. */
  static #envRegions(scene: any): Array<{ uuid: string; name: string; summary: string; inside: string }> {
    if (!scene) return [];
    return envRegions(scene).map((r: any) => {
      const e = readRegionEnv(r.flags?.[SYSTEM.id]?.env);
      const parts: string[] = [];
      if (e.backgroundCount) parts.push(`${e.backgroundAspect ? tx('SR2E.App.Ui.backgroundCountAspect', { backgroundCount: e.backgroundCount, aspect: e.backgroundAspect }) : tx('SR2E.App.Ui.backgroundCount', { backgroundCount: e.backgroundCount })}${e.backgroundToxic ? tx('SR2E.App.Ui.toxic') : ''}`);
      if (e.environment) parts.push(e.environment);
      if (e.weather) parts.push(RULES.HEALTH.weather.find((w) => w.id === e.weather)?.label ?? e.weather);
      if (e.light) parts.push(LIGHT_LABELS[e.light] ?? e.light);
      if (e.smoke) parts.push(e.smoke === 'thermal' ? tx('SR2E.App.Ui.thermalSmoke') : tx('SR2E.App.Ui.smoke'));
      if (e.wardUuid) { let b: any = null; try { b = fromUuidSync(e.wardUuid); } catch { b = null; } parts.push(b ? tx('SR2E.App.Ui.edgeOf', { name: b.name, rating: b.system?.rating ?? 0 }) : tx('SR2E.App.Ui.wardMissing')); }
      if (e.siteUuid && e.deviceId) { let st: any = null; try { st = fromUuidSync(e.siteUuid); } catch { st = null; } const d = [...(st?.system?.devices ?? [])].find((x: any) => x.id === e.deviceId); parts.push(d ? tx('SR2E.App.Ui.watchedBy', { name: d.name || d.kind }) : tx('SR2E.App.Ui.deviceMissing')); }
      const inside = [...(scene.tokens ?? [])].filter((t: any) => { const p = tokenPoint(t); return p && regionHas(r, p); }).map((t: any) => t.name).join(', ');
      return { uuid: r.uuid, name: r.name || 'Region', summary: parts.join(' · '), inside };
    });
  }

  static async #onOpenRegion(this: SR2GmPanel, _e: Event, el: HTMLElement) {
    const r: any = await fromUuid(String(el.dataset['uuid'] ?? ''));
    r?.sheet?.render(true);
  }

  static async #onCombatRollNpc(this: SR2GmPanel) { await (game as any).combat?.rollNPC?.(); }

  /** Put the selected tokens into the combat (creating one on this scene if needed). */
  static async #onCombatAddSelected(this: SR2GmPanel) {
    const toks = [...((canvas as any)?.tokens?.controlled ?? [])].filter((t: any) => !t.inCombat);
    if (!toks.length) return ui.notifications.warn(tx('SR2E.Notify.Ui.selectTokensThatArenTIn'));
    const layer: any = (canvas as any).tokens;
    try { await layer.toggleCombat(true, null, { token: null }); }
    catch { await (foundry as any).documents?.TokenDocument?.implementation?.createCombatants?.(toks.map((t: any) => t.document)); }
    SR2GmPanel.refresh();
  }

  /** A quick action for someone in the panel: their sheet's action, the newest attack on them, or their sheet. */
  static async #onQuick(this: SR2GmPanel, _e: Event, target: HTMLElement) {
    const a: any = fromUuidSync(target.dataset['uuid'] ?? '');
    if (!a) return ui.notifications.warn(tx('SR2E.Notify.Ui.theyAreGone'));
    const act = target.dataset['act'] ?? '';
    if (act === 'sheet') return void a.sheet?.render(true);
    if (act === 'defend') { const p = latestAttackOn(a); return p ? p.defend() : void ui.notifications.info(tx('SR2E.Notify.Ui.noAttackOnWaitingForA', { name: escHtml(a.name) })); }
    if (act === 'morale') return void (await a.moraleTest?.());
    if (act === 'init') {
      const c: any = (game as any).combat;
      const cb = c?.combatants?.find?.((x: any) => x.actor?.uuid === a.uuid);
      if (!cb) return ui.notifications.warn(tx('SR2E.Notify.Ui.isnTInTheCombat', { name: escHtml(a.name) }));
      return void (await c.rollInitiative([cb.id]));
    }
    await runSheetAction(a, act);
  }

  static async #onBox(this: SR2GmPanel, _e: Event, target: HTMLElement) {
    const cls: any = CONFIG.Actor.documentClass;
    await cls.gmAdjustBoxes(target.dataset['uuid'] ?? '', target.dataset['track'] === 'stun' ? 'stun' : 'physical', Number(target.dataset['delta']) || 0);
  }

  static async #onPanToken(this: SR2GmPanel, _e: Event, target: HTMLElement) {
    const scene: any = (canvas as any)?.scene;
    if (target.dataset['scene'] && scene?.id !== target.dataset['scene']) return ui.notifications.info(tx('SR2E.Notify.Ui.thatTokenIsOnAnotherScene'));
    const t: any = scene?.tokens?.get?.(target.dataset['token'] ?? '')?.object;
    if (!t) return;
    t.control?.({ releaseOthers: true });
    try { await (canvas as any).animatePan({ x: t.center?.x ?? t.x, y: t.center?.y ?? t.y, duration: 300 }); } catch { /* no canvas */ }
  }

  static async #onHealSeveral(this: SR2GmPanel) {
    const r = await foundry.applications.api.DialogV2.prompt({
      window: { title: tx('SR2E.Dialog.Ui.healSeveralAtOnce') },
      content: `${WHO()}
        <div class="form-group"><label>${tx('SR2E.Dialog.Ui.track')}</label><select name="track"><option value="stun">${tx('SR2E.Dialog.Ui.stun')}</option><option value="physical">${tx('SR2E.Dialog.Ui.physical')}</option><option value="both">${tx('SR2E.Dialog.Ui.both')}</option></select></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Ui.boxesOff')}</label><input name="boxes" type="number" value="1" min="0"></div>
        <label class="sr2e-check"><input type="checkbox" name="all"> ${tx('SR2E.Dialog.Ui.clearTheTrackSCompletely')}</label>
        <p class="hint">${tx('SR2E.Dialog.Ui.noTestTheBoxesJustCome')}</p>`,
      ok: { label: tx('SR2E.Dialog.Ui.heal'), callback: (_e: Event, b: any) => { const el = b.form.elements; return { who: String(el.who.value), track: String(el.track.value), boxes: el.all.checked ? 'all' : Math.max(0, Math.floor(Number(el.boxes.value) || 0)) }; } },
      rejectClose: false,
    });
    if (!r) return;
    const actors = groupActors(r.who);
    if (!actors.length) return ui.notifications.warn(r.who === 'selected' ? tx('SR2E.Notify.Ui.selectSomeTokensFirst') : tx('SR2E.Notify.Ui.nobodyToHeal'));
    const n = await (CONFIG.Actor.documentClass as any).healSeveral(actors, { track: r.track, boxes: r.boxes });
    ui.notifications.info(tx('SR2E.Notify.Ui.healedOf', { n: escHtml(n), actorsLength: actors.length }));
  }

  static async #onSavePreset(this: SR2GmPanel) {
    const cls: any = CONFIG.Actor.documentClass;
    const scene: any = game.scenes?.viewed ?? game.scenes?.current;
    if (!scene) return ui.notifications.warn(tx('SR2E.Notify.Ui.viewASceneFirst'));
    const name = await foundry.applications.api.DialogV2.prompt({
      window: { title: tx('SR2E.Dialog.Ui.saveSceneConditions') },
      content: `<div class="form-group"><label>${tx('SR2E.Dialog.Ui.name')}</label><input name="name" type="text" value="" placeholder="${tx('SR2E.Dialog.Ui.eGRainyNightDowntown')}" autofocus></div>
        <label class="sr2e-check"><input type="checkbox" name="dark" checked> ${tx('SR2E.Dialog.Ui.includeTheDarkness')}</label>
        <p class="hint">${tx('SR2E.Dialog.Ui.savesBackgroundCountAndSourcesEnvironmen', { value: '' })}</p>`,
      ok: { label: tx('SR2E.Dialog.Ui.save'), callback: (_e: Event, b: any) => ({ name: String(b.form.elements.name.value ?? '').trim(), dark: Boolean(b.form.elements.dark.checked) }) },
      rejectClose: false,
    });
    if (!name) return;
    const p = normalizePreset({
      id: (foundry as any).utils.randomID(), name: name.name, background: cls.backgroundCount?.() ?? 0,
      sources: String(scene.getFlag?.(SYSTEM.id, 'backgroundSources') ?? ''), environment: (cls.sceneEnvironment?.() ?? []).join(', '),
      weather: cls.sceneWeather?.() ?? 'clear', terrain: cls.sceneTerrain?.() ?? '',
      darkness: name.dark ? Number(scene.environment?.darknessLevel ?? scene.darkness ?? 0) : null,
    });
    await game.settings.set(SYSTEM.id, 'scenePresets', [...SR2GmPanel.presets(), p]);
    ui.notifications.info(tx('SR2E.Notify.Ui.saved', { name: escHtml(p.name) }));
    SR2GmPanel.refresh();
  }

  static async #onApplyPreset(this: SR2GmPanel, _e: Event, target: HTMLElement) {
    const cls: any = CONFIG.Actor.documentClass;
    const scene: any = game.scenes?.viewed ?? game.scenes?.current;
    const p = SR2GmPanel.presets().find((x) => x.id === target.dataset['id']);
    if (!scene || !p) return;
    await cls.setBackgroundCount(p.background);
    await cls.setBackgroundSources(p.sources);
    await cls.setSceneEnvironment(p.environment);
    await cls.setSceneWeather(p.weather);
    await cls.setSceneTerrain(p.terrain);
    if (p.darkness !== null) await scene.update({ 'environment.darknessLevel': p.darkness });
    ui.notifications.info(`${escHtml(scene.name)}: ${escHtml(p.name)}.`);
    SR2GmPanel.refresh();
  }

  static async #onDeletePreset(this: SR2GmPanel, _e: Event, target: HTMLElement) {
    await game.settings.set(SYSTEM.id, 'scenePresets', SR2GmPanel.presets().filter((x) => x.id !== target.dataset['id']));
    SR2GmPanel.refresh();
  }

  static async #onUndo(this: SR2GmPanel) { await SR2Undo.undoLast(); SR2GmPanel.refresh(); }

  /** Undo every step down to and including this one, newest first (stops if one is cancelled). */
  static async #onUndoTo(this: SR2GmPanel, _e: Event, target: HTMLElement) {
    const id = target.dataset['id'] ?? '';
    const steps = SR2Undo.steps();
    const n = steps.findIndex((s) => s.id === id) + 1;
    if (n <= 0) return;
    // The steps the GM saw when clicking: a step logged meanwhile (a player acting) stops the run.
    const seen = new Set(steps.slice(0, n).map((s) => s.id));
    if (n > 1) {
      const ok = await foundry.applications.api.DialogV2.confirm({ window: { title: tx('SR2E.Dialog.Ui.undoSeveralSteps') }, content: `<p>${tx('SR2E.Dialog.Ui.undoTheNewestStepsOneAt', { n })}</p>`, rejectClose: false });
      if (!ok) return;
    }
    while (seen.size) {
      const top = SR2Undo.newest();
      if (!top) break;
      if (!seen.has(top.id)) { ui.notifications.warn(tx('SR2E.Notify.Ui.stoppedWasLoggedMeanwhileUndoIt', { topLabel: escHtml(top.label), topUserName: escHtml(top.userName) })); break; }
      seen.delete(top.id);
      const r = await SR2Undo.undoLast({ quiet: top.id !== id, chain: true });
      if (!r || top.id === id) break;
    }
    SR2GmPanel.refresh();
  }

  static async #onClearUndo(this: SR2GmPanel) {
    const ok = await foundry.applications.api.DialogV2.confirm({ window: { title: tx('SR2E.Dialog.Ui.clearTheUndoLog') }, content: `<p>${tx('SR2E.Dialog.Ui.forgetEveryLoggedStepNothingIn')}</p>`, rejectClose: false });
    if (ok) SR2Undo.clear();
    SR2GmPanel.refresh();
  }

  static async #onCalcRoll(this: SR2GmPanel) {
    const c = SR2GmPanel.calc;
    const mods = parseModifierLines(c.mods);
    await (CONFIG.Actor.documentClass as any).gmRoll({ dice: Math.max(0, Math.min(60, Math.floor(Number(c.dice) || 0))), targetNumber: Number(c.tn) || 4, modifiers: mods, label: c.label || tx('SR2E.App.Ui.gmRoll'), public: c.public });
  }

  /** Scroll the chat log to a message. */
  static #onShowMessage(this: SR2GmPanel, _e: Event, target: HTMLElement) {
    const id = target.dataset['id'] ?? '';
    try { (ui as any).sidebar?.changeTab?.('chat', 'primary'); } catch { /* older API */ }
    setTimeout(() => {
      const el = document.querySelector<HTMLElement>(`#chat [data-message-id="${id}"], .chat-log [data-message-id="${id}"]`);
      if (!el) return ui.notifications.info(tx('SR2E.Notify.Ui.thatCardIsNoLongerIn'));
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('sr2e-flash');
      setTimeout(() => el.classList.remove('sr2e-flash'), 1500);
    }, 150);
  }

  /** Inputs that save as soon as they change. */
  async _onRender(context: any, options: any): Promise<void> {
    await (super._onRender as any)?.(context, options);
    const root: HTMLElement = (this as any).element;
    const cls: any = CONFIG.Actor.documentClass;
    // v0.66.0: the Setup tab's ticks, kit drops and checklist buttons.
    setSetupRefresh(() => SR2GmPanel.refresh());
    if (SR2GmPanel.tab === 'setup') bindSetupTab(root, (act) => this.#runChecklistAction(act));
    const on = (sel: string, fn: (el: any) => Promise<unknown> | void) => root.querySelectorAll<HTMLElement>(sel).forEach((el) => el.addEventListener('change', () => void fn(el)));
    on('[data-gm="background"]', (el) => cls.setBackgroundCount(Math.max(0, Math.floor(Number(el.value) || 0))));
    on('[data-gm="sources"]', (el) => cls.setBackgroundSources(String(el.value ?? '')));
    on('[data-gm="environment"]', (el) => cls.setSceneEnvironment(String(el.value ?? '')));
    on('[data-gm="weather"]', (el) => cls.setSceneWeather(String(el.value ?? 'clear')));
    on('[data-gm="terrain"]', (el) => cls.setSceneTerrain(String(el.value ?? '')));
    // v0.48.0: the fuel kind picked stays picked across refreshes.
    on('[data-gm="fuelKind"]', (el) => { SR2GmPanel.fuelKind = String(el.value ?? ''); });
    on('[data-gm="darkness"]', (el) => {
      const scene: any = game.scenes?.viewed ?? game.scenes?.current;
      return scene?.update({ 'environment.darknessLevel': Math.max(0, Math.min(1, Number(el.value) || 0)) });
    });
    // v0.51.0: encounter notes for the viewed scene.
    on('[data-gm="notes"]', (el) => {
      const id = el.dataset.scene;
      if (!id) return;
      return game.settings.set(SYSTEM.id, 'encounterNotes', { ...SR2GmPanel.notes(), [id]: String(el.value ?? '') });
    });
    // v0.51.0: the calculator recomputes as you type (no re-render, so the cursor stays put).
    const calcOut = root.querySelector<HTMLElement>('[data-gm="calcOut"]');
    root.querySelectorAll<HTMLInputElement>('[data-calc]').forEach((el) => el.addEventListener('input', () => {
      const k = el.dataset['calc'] as keyof typeof SR2GmPanel.calc;
      (SR2GmPanel.calc as any)[k] = el.type === 'checkbox' ? el.checked : el.type === 'number' ? Number(el.value) : el.value;
      if (calcOut) calcOut.innerHTML = SR2GmPanel.calcHtml();
    }));
    on('[data-gm="hostAlert"]', (el) => fromUuidSync(el.dataset.uuid)?.update({ 'system.alert': el.value }));
    on('[data-gm="siteAlert"]', (el) => cls.applySiteChange(el.dataset.uuid, { minAlert: el.value }).then(async (r: unknown) => {
      // Lowering a site's alert is a straight edit.
      const s: any = fromUuidSync(el.dataset.uuid);
      if (s && s.system.alert !== el.value) await s.update({ 'system.alert': el.value });
      return r;
    }));
  }

  // ---- v0.49.0: mixed groups for morale

  static async #onMoraleGroup(this: SR2GmPanel) {
    const toks = [...((canvas as any)?.tokens?.controlled ?? [])].filter((t: any) => t.actor && ['npc', 'character', 'spirit'].includes(t.actor.type));
    if (toks.length < 2) return ui.notifications.warn(tx('SR2E.Notify.Ui.selectTwoOrMoreTokensTo'));
    const cls: any = CONFIG.Actor.documentClass;
    await cls.setMoraleGroup(toks, true);
    ui.notifications.info(tx('SR2E.Notify.Ui.tokensGroupedForMorale', { toksLength: toks.length }));
    SR2GmPanel.refresh();
  }

  static async #onMoraleUngroup(this: SR2GmPanel, _e: Event, target: HTMLElement) {
    const scene: any = game.scenes?.viewed ?? game.scenes?.current;
    const id = target.dataset['id'];
    const toks = id ? [...(scene?.tokens ?? [])].filter((t: any) => t.getFlag?.(SYSTEM.id, 'moraleGroup') === id) : [...((canvas as any)?.tokens?.controlled ?? [])];
    if (!toks.length) return ui.notifications.warn(tx('SR2E.Notify.Ui.selectTheTokensToTakeOut'));
    const cls: any = CONFIG.Actor.documentClass;
    await cls.setMoraleGroup(toks, false);
    SR2GmPanel.refresh();
  }

  static async #onMoraleTest(this: SR2GmPanel, _e: Event, target: HTMLElement) {
    const a: any = fromUuidSync(target.dataset['uuid'] ?? '');
    if (a) await a.moraleTest?.();
    SR2GmPanel.refresh();
  }

  // ---- v0.45.0: magical groups and fires

  /** The magical group edit dialog (new when `group` is null); returns the edited group or null. */
  static async #groupDialog(group: any | null): Promise<any | null> {
    const g = normalizeGroup(group ?? { id: (foundry as any).utils.randomID(), name: 'New group' });
    const people = [...((game as any).actors ?? [])].filter((a: any) => ['character', 'npc'].includes(a.type))
      .sort((a: any, b: any) => String(a.name).localeCompare(String(b.name)));
    const esc = escHtml;
    const result = await foundry.applications.api.DialogV2.prompt({
      window: { title: group ? tx('SR2E.Dialog.Ui.magicalGroup', { name: g.name }) : tx('SR2E.Dialog.Ui.newMagicalGroup') },
      position: { width: 520 },
      content: `<div class="form-group"><label>${tx('SR2E.Dialog.Ui.name')}</label><input name="name" type="text" value="${esc(g.name)}"></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Ui.tradition')}</label><input name="tradition" type="text" value="${esc(g.tradition)}" placeholder="${tx('SR2E.Dialog.Ui.eGHermetic')}"></div>
        <fieldset class="sr2e-situational"><legend>${tx('SR2E.Dialog.Ui.members')}</legend>${people.map((a: any) => `<label class="sr2e-check"><input type="checkbox" name="member" value="${esc(a.uuid)}" ${g.members.includes(a.uuid) ? 'checked' : ''}> ${esc(a.name)}</label>`).join('')}</fieldset>
        <div class="form-group"><label>${tx('SR2E.Dialog.Ui.stricturesOnePerLine')}</label><textarea name="strictures" rows="3">${esc(g.strictures.map((s) => s.text).join('\n'))}</textarea></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Ui.sharedSitesOnePerLine')}</label><textarea name="sites" rows="3" placeholder="${tx('SR2E.Dialog.Ui.oldLibraryLibrary5SorceryThe')}">${esc(formatGroupSites(g.sites))}</textarea></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Ui.notes')}</label><input name="notes" type="text" value="${esc(g.notes)}"></div>
        <p class="hint">${tx('SR2E.Dialog.Ui.membersInGoodStandingUseThe', { grimoireLength: tCount(g.grimoire.length, 'SR2E.Count.spell') })}</p>`,
      ok: { label: tx('SR2E.Dialog.Ui.save'), callback: (_e: Event, b: any) => {
        const f = b.form as HTMLFormElement; const el: any = f.elements;
        const lines = String(el.strictures.value ?? '').split(/\r?\n/).map((x: string) => x.trim()).filter(Boolean);
        return {
          ...g, name: String(el.name.value ?? '').trim() || 'Magical group', tradition: String(el.tradition.value ?? '').trim(), notes: String(el.notes.value ?? ''),
          members: Array.from(f.querySelectorAll<HTMLInputElement>('input[name="member"]:checked')).map((x) => x.value),
          strictures: lines.map((text: string) => g.strictures.find((s) => s.text === text) ?? { id: (foundry as any).utils.randomID(), text }),
          sites: parseGroupSites(String(el.sites.value ?? '')),
        };
      } },
      rejectClose: false,
    });
    return result ?? null;
  }

  static async #onNewGroup(this: SR2GmPanel) {
    const cls: any = CONFIG.Actor.documentClass;
    const g = await SR2GmPanel.#groupDialog(null);
    if (g) await cls.saveMagicGroups([...cls.magicGroups(), g]);
    SR2GmPanel.refresh();
  }

  static async #onEditGroup(this: SR2GmPanel, _e: Event, target: HTMLElement) {
    const cls: any = CONFIG.Actor.documentClass;
    const old = cls.magicGroups().find((x: any) => x.id === target.dataset['id']);
    if (!old) return;
    const g = await SR2GmPanel.#groupDialog(old);
    if (g) await cls.updateMagicGroup(old.id, () => g);
    SR2GmPanel.refresh();
  }

  static async #onDeleteGroup(this: SR2GmPanel, _e: Event, target: HTMLElement) {
    const cls: any = CONFIG.Actor.documentClass;
    const ok = await foundry.applications.api.DialogV2.confirm({ window: { title: tx('SR2E.Dialog.Ui.deleteMagicalGroup') }, content: `<p>${tx('SR2E.Dialog.Ui.deleteThisGroupItsGrimoireAnd')}</p>`, rejectClose: false });
    if (ok) await cls.updateMagicGroup(target.dataset['id'] ?? '', () => null);
    SR2GmPanel.refresh();
  }

  static async #onBreach(this: SR2GmPanel, _e: Event, target: HTMLElement) {
    const cls: any = CONFIG.Actor.documentClass;
    const g = cls.magicGroups().find((x: any) => x.id === target.dataset['id']);
    if (!g) return;
    if (!g.members.length || !g.strictures.length) return ui.notifications.warn(tx('SR2E.Notify.Ui.theGroupNeedsMembersAndStrictures'));
    const choice = await foundry.applications.api.DialogV2.prompt({
      window: { title: tx('SR2E.Dialog.Ui.strictureBroken', { name: g.name }) },
      content: `<div class="form-group"><label>${tx('SR2E.Dialog.Ui.who')}</label><select name="who">${g.members.map((u: string) => `<option value="${escHtml(u)}">${escHtml(fromUuidSync(u)?.name ?? u)}</option>`).join('')}</select></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Ui.stricture')}</label><select name="st">${g.strictures.map((s: any) => `<option value="${escHtml(s.id)}">${escHtml(s.text)}</option>`).join('')}</select></div>`,
      ok: { label: tx('SR2E.Dialog.Ui.record'), callback: (_e2: Event, b: any) => ({ who: String(b.form.elements.who.value), st: String(b.form.elements.st.value) }) },
      rejectClose: false,
    });
    if (!choice) return;
    await cls.updateMagicGroup(g.id, (x: any) => ({ ...x, breaches: [...x.breaches.filter((b: any) => b.uuid !== choice.who), { uuid: choice.who, strictureId: choice.st, at: Number((game as any).time?.worldTime ?? 0) }] }));
    const text = g.strictures.find((s: any) => s.id === choice.st)?.text ?? '';
    await ChatMessage.create({ speaker: { alias: g.name }, content: `<p><strong>${escHtml(fromUuidSync(choice.who)?.name ?? tx('SR2E.Card.Ui.aMember'))}</strong> ${tx('SR2E.Card.Ui.hasBrokenSStricture', { name: escHtml(g.name) })} <em>${escHtml(text)}</em>${tx('SR2E.Card.Ui.noSharedResourcesOrGroupInitiation')}</p>` });
    SR2GmPanel.refresh();
  }

  static async #onClearBreach(this: SR2GmPanel, _e: Event, target: HTMLElement) {
    const cls: any = CONFIG.Actor.documentClass;
    await cls.updateMagicGroup(target.dataset['id'] ?? '', (x: any) => ({ ...x, breaches: x.breaches.filter((b: any) => b.uuid !== target.dataset['uuid']) }));
    SR2GmPanel.refresh();
  }

  static async #onRemoveGrimoire(this: SR2GmPanel, _e: Event, target: HTMLElement) {
    const cls: any = CONFIG.Actor.documentClass;
    await cls.updateMagicGroup(target.dataset['id'] ?? '', (x: any) => ({ ...x, grimoire: x.grimoire.filter((s: any) => s.name !== target.dataset['name']) }));
    SR2GmPanel.refresh();
  }

  static async #onStartFire(this: SR2GmPanel) {
    const t: any = [...((canvas as any)?.tokens?.controlled ?? [])][0];
    if (!t) return ui.notifications.warn(tx('SR2E.Notify.Ui.selectATokenTheFireStarts'));
    const c = t.center ?? { x: t.x + t.w / 2, y: t.y + t.h / 2 };
    await (CONFIG.Actor.documentClass as any).startFire({ x: c.x, y: c.y }, { source: `at ${t.name}` });
    SR2GmPanel.refresh();
  }

  static async #onSpreadFire(this: SR2GmPanel) {
    await (CONFIG.Actor.documentClass as any).fireTicks({ round: null, worldTime: Number((game as any).time?.worldTime ?? 0) }, 1);
    SR2GmPanel.refresh();
  }

  static async #onPutOutFire(this: SR2GmPanel, _e: Event, target: HTMLElement) {
    await (CONFIG.Actor.documentClass as any).putOutFire(target.dataset['scene'] ?? '', target.dataset['id'] ?? '');
    SR2GmPanel.refresh();
  }

  /** v0.48.0: mark the selected drawings as fuel of the chosen kind. */
  static async #onMarkFuel(this: SR2GmPanel) {
    const root: HTMLElement = (this as any).element;
    const kind = root.querySelector<HTMLSelectElement>('[data-gm="fuelKind"]')?.value ?? '';
    SR2GmPanel.fuelKind = kind;
    const drawings = [...((canvas as any)?.drawings?.controlled ?? [])].map((d: any) => d.document).filter(Boolean);
    if (!drawings.length) return ui.notifications.warn(tx('SR2E.Notify.Ui.selectOneOrMoreDrawingsRectangles'));
    const n = await (CONFIG.Actor.documentClass as any).markFuel(drawings, kind);
    ui.notifications.info(tx('SR2E.Notify.Ui.drawingMarkedAs', { n: tCount(Number(n), 'SR2E.Count.drawing'), label: escHtml(RULES.FIRE.fuel.kinds[kind]?.label.toLowerCase() ?? tx('SR2E.Notify.Ui.fuel')) }));
    SR2GmPanel.refresh();
  }

  static async #onClearFuel(this: SR2GmPanel, _e: Event, target: HTMLElement) {
    const scene: any = game.scenes?.viewed ?? game.scenes?.current;
    const d = scene?.drawings?.get?.(target.dataset['id'] ?? '');
    if (d) await (CONFIG.Actor.documentClass as any).markFuel([d], '');
    SR2GmPanel.refresh();
  }

  static async #onPanFire(this: SR2GmPanel, _e: Event, target: HTMLElement) {
    try { await (canvas as any).animatePan({ x: Number(target.dataset['x']), y: Number(target.dataset['y']), duration: 400 }); } catch { /* no canvas */ }
  }

  static async #onAdvanceTime(this: SR2GmPanel, _e: Event, target: HTMLElement) {
    const seconds = Number(target.dataset['seconds']) || 0;
    // v0.51.0: a week or more asks first (timed effects come due: drugs, diseases, rent, recoveries).
    if (RULES.GM_TOOLS.confirmFrom > 0 && seconds >= RULES.GM_TOOLS.confirmFrom) {
      const ok = await foundry.applications.api.DialogV2.confirm({
        window: { title: tx('SR2E.Dialog.Ui.advance', { span: describeSpan(seconds) }) },
        content: `<p>${tx('SR2E.Dialog.Ui.moveWorldTimeOn')} <strong>${escHtml(describeSpan(seconds))}</strong>${tx('SR2E.Dialog.Ui.to', { worldTime: escHtml(formatWorldTime(Number((game as any).time?.worldTime ?? 0) + seconds)) })}</p>
          <p class="hint">${tx('SR2E.Dialog.Ui.everythingTimedComesDueOnceDrugs')}</p>`,
        rejectClose: false,
      });
      if (!ok) return;
    }
    await (game as any).time.advance(seconds);
  }

  /** The calculator's result block. */
  static calcHtml(): string {
    const r = SR2GmPanel.calcResult();
    const esc = escHtml;
    return `<p><strong>${tx('SR2E.App.Ui.tn', { tn: r.tn })}</strong>${r.mods ? ` <span class="hint">(${esc(r.mods)})</span>` : ''} ${tx('SR2E.App.Ui.eachDieAbout', { perDie: esc(r.perDie) })} <strong>${esc(r.expected)}</strong> ${tx('SR2E.App.Ui.successesDisaster', { disaster: esc(r.disaster) })}</p>
      <table class="sr2e-group"><tr><th>${tx('SR2E.App.Ui.atLeast')}</th>${r.rows.map((x) => `<th>${x.k}</th>`).join('')}</tr><tr><td>${tx('SR2E.App.Ui.chance')}</td>${r.rows.map((x) => `<td>${esc(x.p)}</td>`).join('')}</tr></table>`;
  }

  static async #onRefreshPools(this: SR2GmPanel) {
    let n = 0;
    // v0.70.0: the party and everyone in the viewed combat (NPCs too), once each.
    const who = new Map<string, any>();
    for (const a of groupActors('party')) who.set(a.uuid, a);
    for (const c of [...(((game as any).combat?.combatants) ?? [])]) if (c.actor?.system?.poolSpent) who.set(c.actor.uuid, c.actor);
    for (const a of who.values()) { await a.update({ 'system.poolSpent.combat': 0, 'system.poolSpent.spell': 0, 'system.poolSpent.spellConc': 0, 'system.poolSpent.spellSpec': 0, 'system.poolSpent.hacking': 0, 'system.poolSpent.control': 0, 'system.poolSpent.task': 0 }); n++; }
    ui.notifications.info(tx('SR2E.Notify.Ui.refreshedTheCombatSpellHackingAnd', { n: tCount(n, 'SR2E.Count.character') }));
  }

  static async #onRefreshKarma(this: SR2GmPanel) {
    const n = await (CONFIG.Actor.documentClass as any).refreshAllKarma(tx('SR2E.Card.Ui.gmPanel'));
    ui.notifications.info(tx('SR2E.Notify.Ui.refreshedTheKarmaPoolOfCharacter', { n: tCount(Number(n), 'SR2E.Count.character') }));
  }

  static #onOpenActor(this: SR2GmPanel, _e: Event, target: HTMLElement) {
    fromUuidSync(target.dataset['uuid'] ?? '')?.sheet?.render(true);
  }

  static async #onResetHost(this: SR2GmPanel, _e: Event, target: HTMLElement) {
    const doc: any = fromUuidSync(target.dataset['uuid'] ?? '');
    // v0.70.0: a host's launched sheaf steps (host-wide and per decker) start over too.
    await doc?.update({ 'system.tally': 0, 'system.alert': 'none', ...(doc?.type === 'host' ? { 'system.tallies': [], 'system.launchedSteps': [], 'flags.sr2e.sheafLaunched': [] } : {}) });
  }

  static async #onClearSmoke(this: SR2GmPanel, _e: Event, target: HTMLElement) {
    await fromUuidSync(target.dataset['uuid'] ?? '')?.update({ 'system.smoke': { rating: 0, tn: 0, by: '', round: -1, worldTime: -1 } });
  }

  static async #onBlowCharge(this: SR2GmPanel, _e: Event, target: HTMLElement) {
    await (CONFIG.Actor.documentClass as any).blowCharge(target.dataset['scene'] ?? '', target.dataset['id'] ?? '', tx('SR2E.App.Ui.isSetOffByTheGm'));
    SR2GmPanel.refresh();
  }

  static async #onDisarmCharge(this: SR2GmPanel, _e: Event, target: HTMLElement) {
    await (CONFIG.Actor.documentClass as any).disarmCharge(target.dataset['scene'] ?? '', target.dataset['id'] ?? '');
    SR2GmPanel.refresh();
  }

  /** v0.47.0: the selected token's actor tries to disarm it (Demolitions vs the charge's TN). */
  static async #onDisarmTest(this: SR2GmPanel, _e: Event, target: HTMLElement) {
    const actor: any = (canvas as any)?.tokens?.controlled?.[0]?.actor ?? null;
    if (!actor) return ui.notifications?.warn?.(tx('SR2E.Notify.Ui.selectTheTokenOfWhoeverIs'));
    await actor.disarmChargeTest(target.dataset['scene'] ?? '', target.dataset['id'] ?? '');
    SR2GmPanel.refresh();
  }

  static #wall(target: HTMLElement): any {
    const scene: any = game.scenes?.viewed ?? game.scenes?.current;
    return scene?.walls?.get?.(target.dataset['id'] ?? '') ?? null;
  }

  static async #onRepairWall(this: SR2GmPanel, _e: Event, target: HTMLElement) {
    const w = SR2GmPanel.#wall(target);
    if (w) await (CONFIG.Actor.documentClass as any).repairWall(w, { full: true, label: tx('SR2E.App.Ui.theWall') });
    SR2GmPanel.refresh();
  }

  /** A character's Build/Repair test on a wall (the selected token's actor, else pick one). */
  static async #onRepairWallTest(this: SR2GmPanel, _e: Event, target: HTMLElement) {
    const w = SR2GmPanel.#wall(target);
    if (!w) return;
    // The selected tokens' actors first (unlinked tokens have their own), then everyone else.
    const picked = [...((canvas as any)?.tokens?.controlled ?? [])].map((t: any) => t.actor).filter((a: any) => a && ['character', 'npc'].includes(a.type));
    const rest = [...((game as any).actors ?? [])].filter((a: any) => ['character', 'npc'].includes(a.type) && !picked.some((p: any) => p.uuid === a.uuid));
    const people = [...picked, ...rest];
    const uuid = await foundry.applications.api.DialogV2.prompt({
      window: { title: tx('SR2E.Dialog.Ui.repairAWall') },
      content: `<div class="form-group"><label>${tx('SR2E.Dialog.Ui.whoRepairsIt')}</label><select name="who">${!picked.length ? `<option value="">${tx('SR2E.Dialog.Ui.pickSomeone')}</option>` : ''}${people.map((a: any, i: number) => `<option value="${escHtml(a.uuid)}" ${i === 0 && picked.length ? 'selected' : ''}>${escHtml(a.name)}${picked.includes(a) ? tx('SR2E.Dialog.Ui.selected') : ''}</option>`).join('')}</select></div>
        <p class="hint">${tx('SR2E.Dialog.Ui.orVsRatingPerSuccessUp', { wallsRepairSkill: RULES.GEAR.walls.repairSkill, wallsRepairAttribute: escHtml(cap(RULES.GEAR.walls.repairAttribute)), wallsRepairTn: RULES.GEAR.walls.repairTn, wallsRepairPerSuccess: RULES.GEAR.walls.repairPerSuccess })}</p>`,
      ok: { label: tx('SR2E.Dialog.Ui.roll'), callback: (_e2: Event, b: any) => String(b.form.elements.who.value ?? '') },
      rejectClose: false,
    });
    const a: any = uuid ? fromUuidSync(uuid) : null;
    if (a) await a.repairWallTest(w);
    SR2GmPanel.refresh();
  }

  static #onPanWall(this: SR2GmPanel, _e: Event, target: HTMLElement) {
    const w = SR2GmPanel.#wall(target);
    if (!w) return;
    const [x1, y1, x2, y2] = w.c ?? [0, 0, 0, 0];
    void (canvas as any)?.animatePan?.({ x: (x1 + x2) / 2, y: (y1 + y2) / 2 });
  }

  /** Quick NPC rolls: one test for many actors, one card. */
  static async #onGroupRoll(this: SR2GmPanel) {
    const r = await foundry.applications.api.DialogV2.prompt({
      window: { title: tx('SR2E.Dialog.Ui.groupRoll') },
      content: `${WHO()}
        <div class="form-group"><label>${tx('SR2E.Dialog.Ui.skillBlankTheAttributeOnly')}</label><input name="skill" type="text" placeholder="${tx('SR2E.Dialog.Ui.eGPerceptionStealthFirearms')}"></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Ui.attributeOrTheSkillSFallback')}</label><select name="attribute">${ATTRS.map((k) => `<option value="${escHtml(k)}" ${k === 'intelligence' ? 'selected' : ''}>${escHtml(cap(k))}</option>`).join('')}</select></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Ui.targetNumber')}</label><input name="tn" type="number" value="4" min="2"></div>
        <label class="sr2e-check"><input type="checkbox" name="public"> ${tx('SR2E.Dialog.Ui.showTheCardToThePlayers')}</label>
        <p class="hint">${tx('SR2E.Dialog.Ui.eachRollsWithTheirOwnWound')}</p>`,
      ok: { label: tx('SR2E.Dialog.Ui.roll'), callback: (_e: Event, b: any) => { const el = b.form.elements; return { who: String(el.who.value), skill: String(el.skill.value ?? '').trim(), attribute: String(el.attribute.value), tn: Math.max(2, Math.floor(Number(el.tn.value) || 4)), public: Boolean(el.public.checked) }; } },
      rejectClose: false,
    });
    if (!r) return;
    const actors = groupActors(r.who);
    if (!actors.length) return ui.notifications.warn(r.who === 'selected' ? tx('SR2E.Notify.Ui.selectSomeTokensFirst') : tx('SR2E.Notify.Ui.nobodyToRollFor'));
    await (CONFIG.Actor.documentClass as any).groupRoll(actors, { skill: r.skill || undefined, attribute: r.attribute, targetNumber: r.tn, public: r.public });
  }

  /** Damage several tokens at once. */
  static async #onGroupDamage(this: SR2GmPanel) {
    const r = await foundry.applications.api.DialogV2.prompt({
      window: { title: tx('SR2E.Dialog.Ui.damageSeveralAtOnce') },
      content: `${WHO()}
        <div class="form-group"><label>${tx('SR2E.Dialog.Ui.power')}</label><input name="power" type="number" value="6" min="0"></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Ui.level')}</label><select name="level">${['L', 'M', 'S', 'D'].map((k) => `<option value="${escHtml(k)}" ${k === 'M' ? 'selected' : ''}>${escHtml(k)}</option>`).join('')}</select></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Ui.type')}</label><select name="type"><option value="physical">${tx('SR2E.Dialog.Ui.physical')}</option><option value="stun">${tx('SR2E.Dialog.Ui.stun')}</option></select></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Ui.armorThatCounts')}</label><select name="armor"><option value="ballistic">${tx('SR2E.Dialog.Ui.ballistic')}</option><option value="impact">${tx('SR2E.Dialog.Ui.impact')}</option><option value="none">${tx('SR2E.Dialog.Ui.none')}</option></select></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Ui.how')}</label><select name="mode"><option value="resist">${tx('SR2E.Dialog.Ui.eachResistsBodyVsPowerArmor')}</option><option value="unresisted">${tx('SR2E.Dialog.Ui.applyUnresisted')}</option></select></div>`,
      ok: { label: tx('SR2E.Dialog.Ui.apply'), callback: (_e: Event, b: any) => { const el = b.form.elements; return { who: String(el.who.value), power: Math.max(0, Math.floor(Number(el.power.value) || 0)), level: String(el.level.value), type: String(el.type.value), armor: String(el.armor.value), mode: String(el.mode.value) }; } },
      rejectClose: false,
    });
    if (!r) return;
    const actors = groupActors(r.who);
    if (!actors.length) return ui.notifications.warn(r.who === 'selected' ? tx('SR2E.Notify.Ui.selectSomeTokensFirst') : tx('SR2E.Notify.Ui.nobodyToDamage'));
    const n = await (CONFIG.Actor.documentClass as any).groupDamage(actors, r);
    ui.notifications.info(tx('SR2E.Notify.Ui.of', { power: escHtml(r.power), level: escHtml(r.level), type: escHtml(r.type), part: r.mode === 'resist' ? tx('SR2E.Notify.Ui.resistedBy') : tx('SR2E.Notify.Ui.appliedTo'), n: escHtml(n), actorsLength: actors.length }));
  }
}

// ---------------------------------------------------------------- Hooks

export function registerUiHooks(): void {
  // Tooltips on every SR2e document sheet's fields.
  Hooks.on('renderDocumentSheetV2', (app: any, element: HTMLElement) => {
    const doc = app?.document;
    if (!doc || !['Actor', 'Item'].includes(doc.documentName)) return;
    applyFieldTooltips(element ?? app.element, doc.type);
  });
  Hooks.on('dropCanvasData', onDropCanvas);
  Hooks.once('diceSoNiceReady', (dice3d: any) => {
    for (const c of DSN_COLORSETS) { try { dice3d.addColorset(c, 'default'); } catch (err) { console.warn('sr2e | Dice So Nice colour set', err); } }
  });
  Hooks.once('ready', () => applyDiceColours());
  // The GM panel follows what it shows.
  for (const h of ['updateActor', 'createActor', 'deleteActor', 'updateScene', 'canvasReady', 'updateWorldTime', 'controlToken', 'updateCombat', 'deleteCombat', 'updateWall', 'updateDrawing', 'deleteDrawing',
    // v0.51.0: the combat overview, recent rolls and the undo log.
    'createCombat', 'createCombatant', 'updateCombatant', 'deleteCombatant', 'createChatMessage', 'deleteChatMessage', 'createToken', 'deleteToken', `${SYSTEM.id}.undoChanged`]) Hooks.on(h, () => SR2GmPanel.refresh());
  // v0.45.0: magical groups changed: the panel and open sheets show them.
  Hooks.on('updateSetting', (setting: any) => {
    // v0.51.0: presets and notes show in the panel.
    if ([`${SYSTEM.id}.scenePresets`, `${SYSTEM.id}.encounterNotes`, `${SYSTEM.id}.approvalQueue`].includes(setting?.key)) return SR2GmPanel.refresh();
    if (setting?.key !== `${SYSTEM.id}.magicGroups`) return;
    SR2GmPanel.refresh();
    for (const a of [...((game as any).actors ?? [])]) { try { if (a.sheet?.rendered) a.sheet.render(); } catch { /* no sheet */ } }
  });
  // A button in the Actors sidebar, beside the award button.
  Hooks.on('renderActorDirectory', (_app: any, html: HTMLElement) => {
    try {
      if (!game.user?.isGM) return;
      const root: HTMLElement = (html as any)?.querySelector ? html : (html as any)?.[0];
      if (!root || root.querySelector('[data-sr2e-action="gmPanel"]')) return;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset['sr2eAction'] = 'gmPanel';
      btn.className = 'sr2e-award';
      btn.innerHTML = `<i class="fa-solid fa-sliders"></i> ${tx('SR2E.App.Ui.gmPanel')}`;
      btn.addEventListener('click', (ev) => { ev.preventDefault(); SR2GmPanel.open(); });
      const anchor = root.querySelector('.directory-footer, footer') ?? root.querySelector('.directory-header, header');
      (anchor ?? root).appendChild(btn);
      // v0.52.0: the NPC generator.
      const gen = document.createElement('button');
      gen.type = 'button';
      gen.dataset['sr2eAction'] = 'npcGenerator';
      gen.className = 'sr2e-award';
      gen.innerHTML = `<i class="fa-solid fa-user-plus"></i> ${tx('SR2E.App.Ui.npcGenerator')}`;
      gen.addEventListener('click', (ev) => { ev.preventDefault(); SR2NpcGenerator.open(); });
      (anchor ?? root).appendChild(gen);
    } catch (err) { console.warn('sr2e | Could not add the GM panel button', err); }
  });
}
