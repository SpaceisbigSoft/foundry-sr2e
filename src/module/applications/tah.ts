/**
 * v0.60.0: native Token Action HUD support (Token Action HUD Core 2.x, module `token-action-hud-core`),
 * so no separate system module is needed. TAH Core calls `tokenActionHudCoreApiReady` with its module;
 * we extend its SystemManager / ActionHandler / RollHandler and hand the SystemManager back through
 * `tokenActionHudSystemReady`. Without TAH installed the hook never fires and nothing happens.
 *
 * The action list itself is built by the pure `hudActions()` (rules/hudactions.ts) from a summary of the
 * actor; each action carries an onClick that runs the matching sheet action (as if clicked on the sheet).
 */
import { hudActions, hudMultiActions, hudDefaults, hudWeaponInfo, hudDamageLabel, encodeHudAction, findHudAction, HUD_GROUPS, type HudAction, type HudActorSummary, type HudItem } from '../rules/hudactions.ts';
import { runSheetAction, latestAttackOn, useItem } from './tokens.ts';
import { escHtml } from '../rules/html.ts';
import { t as tx } from '../helpers/i18n.ts';

export const TAH_SYSTEM_ID = 'sr2e';
const TAH_CORE_ID = 'token-action-hud-core';
const REQUIRED_CORE_VERSION = '2';
const PEOPLE = ['character', 'npc', 'spirit'];
const HUD_TYPES = [...PEOPLE, 'vehicle', 'ic'];

/** A-15: the shared escape helper (rules/html.ts). */
const esc = escHtml;

/**
 * v0.81.1 round 2 (I3): a name with `<` and `>` taken out (no markup, nothing to double-escape). Round 3 (V2 #13):
 * and `"`, so it can't leave an attribute value either.
 */
export function noTags(v: unknown): string { return String(v ?? '').replace(/[<>"]/g, ''); }

/** The item data the pure builder reads (a few fields per type, not the whole document). */
const ITEM_FIELDS: Record<string, string[]> = {
  skill: ['rating', 'kind', 'specialization', 'specializationRating'],
  weapon: ['ammo', 'ammoMax', 'modes', 'melee', 'jammed', 'damagePower', 'damageLevel', 'damageType', 'strengthPower'],
  spell: ['learnedForce', 'category', 'spellType'],
  power: ['active', 'special'],
  adeptpower: ['active', 'level', 'special'],
};

function itemSummary(i: any): HudItem {
  const fields = ITEM_FIELDS[i.type] ?? [];
  const system: Record<string, any> = {};
  for (const k of fields) system[k] = i.system?.[k];
  return { id: i.id, type: i.type, name: i.name, img: i.img, system };
}

function safe<T>(fn: () => T, fallback: T): T {
  try { return fn(); } catch { return fallback; }
}

/** A plain summary of an actor for `hudActions()`. */
export function summarizeActor(actor: any): HudActorSummary {
  const sys = actor.system ?? {};
  const d = sys.derived ?? {};
  const items: any[] = [...(actor.items ?? [])];
  const combat: any = (game as any).combat;
  const isPerson = PEOPLE.includes(actor.type);
  const magic = Number(d.magic ?? 0);
  const adept = sys.tradition === 'adept';
  const perceiver = adept ? items.some((i: any) => i.type === 'adeptpower' && i.system?.special === 'astralPerception' && i.system?.active !== false) : true;
  const v: any = isPerson ? safe(() => actor.riggedVehicle?.() ?? null, null) : null;
  const attributes: Record<string, { total?: number }> = {};
  for (const [k, a] of Object.entries(sys.attributes ?? {})) attributes[k] = { total: Number((a as any)?.total ?? 0) };
  const pending = isPerson ? safe(() => latestAttackOn(actor), null) : null;
  return {
    type: actor.type,
    name: actor.name,
    attributes,
    derived: {
      ...(d.reaction !== undefined ? { reaction: Number(d.reaction) } : {}),
      ...(d.initiativeDice !== undefined ? { initiativeDice: Number(d.initiativeDice) } : {}),
      magic,
      ...(d.essence !== undefined ? { essence: Number(d.essence) } : {}),
      astralMode: String(d.astralMode ?? 'physical'),
    },
    tradition: sys.tradition,
    items: items.map(itemSummary),
    cyberWeapons: isPerson ? safe(() => (actor.cyberWeapons?.() ?? []).map((w: any) => ({ id: w.id, name: w.name, system: w.system })), []) : [],
    flags: {
      hasCombat: Boolean(combat),
      inCombat: Boolean(combat?.started && safe(() => actor.myCombatant?.(), null)),
      myTurn: safe(() => Boolean(actor.isActing?.()), false),
      delaying: safe(() => Boolean(actor.isDelaying?.()), false),
      actingNow: safe(() => Boolean(actor.actingNow?.()), false),
      fullDefense: safe(() => Boolean(actor.fullDefenseUp?.()), false),
      prone: safe(() => Boolean(actor.hasStatus?.('prone')), false),
      pendingAttack: pending?.label ?? null,
      hasDeck: isPerson && safe(() => Boolean(actor.activeDeck?.()), false),
      jackedIn: isPerson && safe(() => Boolean(actor.isJackedIn?.()), false),
      hasAttackUtility: items.some((i: any) => i.type === 'program' && i.system?.loaded && !i.system?.erased && i.system?.kind === 'attack'),
      isAstral: isPerson && safe(() => Boolean(actor.isAstral?.()), false),
      canPerceive: isPerson && actor.type !== 'spirit' && magic > 0 && !d.dualNatured && perceiver,
      canProject: isPerson && actor.type !== 'spirit' && magic > 0 && !d.dualNatured && !adept,
      vehicle: v ? {
        name: v.name,
        controlling: v.system?.controllerUuid === actor.uuid,
        jumpedIn: Boolean(sys.rigging?.jumpedIn),
        owned: Boolean(v.isOwner),
        weapons: v.isOwner ? [...(v.items ?? [])].filter((i: any) => i.type === 'weapon').map((i: any) => ({ id: i.id, name: i.name, img: i.img, info: hudWeaponInfo(i.system) || hudDamageLabel(i.system) })) : [],
      } : null,
      icProgram: actor.type === 'ic' && ['frame', 'agent'].includes(sys.kind),
    },
  };
}

/** The HUD's actions for whatever is selected: one owned actor, or several owned tokens. */
function currentList(actor: any, actors: any[]): HudAction[] {
  if (actor) return actor.isOwner && HUD_TYPES.includes(actor.type) ? hudActions(summarizeActor(actor)) : [];
  return owned(actors).length ? hudMultiActions({ hasCombat: Boolean((game as any).combat) }) : [];
}

function owned(actors: any[] | undefined): any[] {
  const seen = new Set<string>();
  return (actors ?? []).filter((a: any) => {
    if (!a?.isOwner || !HUD_TYPES.includes(a.type) || seen.has(a.uuid)) return false;
    seen.add(a.uuid);
    return true;
  });
}

interface ClickMods { right?: boolean; shift?: boolean; alt?: boolean; ctrl?: boolean }

/** Run one HUD action for one actor. */
async function runHudAction(actor: any, a: HudAction, mods: ClickMods = {}): Promise<void> {
  const p = a.payload ?? {};
  const event = { shiftKey: Boolean(mods.shift), altKey: Boolean(mods.alt), ctrlKey: Boolean(mods.ctrl) };
  switch (a.kind) {
    case 'sheet': {
      // Right-click an item's action: its sheet (TAH's usual).
      if (mods.right && p['itemId']) {
        const item = actor.items?.get?.(p['itemId']);
        if (item) { item.sheet?.render(true); return; }
      }
      if (p['onProgramOwner']) {
        const owner: any = actor.system?.ownerUuid ? fromUuidSync(actor.system.ownerUuid) : null;
        if (!owner?.isOwner) { ui.notifications.warn(tx('SR2E.Notify.Tah.hasNoOwnerYouControl', { actorName: escHtml(actor.name) })); return; }
        await runSheetAction(owner, p['action'], { ...(p['dataset'] ?? {}), frameUuid: actor.uuid }, event);
        return;
      }
      await runSheetAction(actor, p['action'], p['dataset'] ?? {}, event);
      return;
    }
    case 'vehicle': {
      const v: any = actor.riggedVehicle?.();
      if (!v?.isOwner) { ui.notifications.warn(tx('SR2E.Notify.Tah.hasNoVehicleYouControl', { actorName: escHtml(actor.name) })); return; }
      if (mods.right && p['dataset']?.itemId) {
        const item = v.items?.get?.(p['dataset'].itemId);
        if (item) { item.sheet?.render(true); return; }
      }
      await runSheetAction(v, p['action'], p['dataset'] ?? {}, event);
      return;
    }
    case 'defend': {
      const pending = latestAttackOn(actor);
      if (pending) pending.defend();
      else ui.notifications.warn(tx('SR2E.Notify.Tah.noAttackCardAimedAtIs', { actorName: escHtml(actor.name) }));
      return;
    }
    case 'astral':
      await actor.update({ 'system.astral': String(p['mode'] ?? 'physical') });
      return;
    case 'initiative':
      if (!(game as any).combat) { ui.notifications.warn(tx('SR2E.Notify.Tah.thereIsNoCombatEncounterTo')); return; }
      await actor.rollInitiative?.({ createCombatants: true });
      return;
    case 'open': {
      const doc: any = p['target'] === 'vehicle' ? actor.riggedVehicle?.() : actor;
      if (!doc?.sheet) return;
      await doc.sheet.render({ force: true });
      if (p['tab']) await runSheetAction(doc, 'tab', { tab: String(p['tab']), group: 'primary' });
      return;
    }
    case 'info':
      ui.notifications.info(`${escHtml(actor.name)}: ${escHtml(String(p['text'] ?? a.name))}`);
      return;
  }
}

/** Run an action for the single actor, or for each selected owned actor in turn. */
async function runForSelection(single: any, many: any[], a: HudAction, mods: ClickMods): Promise<void> {
  const targets = single ? [single] : owned(many);
  for (const actor of targets) {
    if (!actor?.isOwner) continue;
    try { await runHudAction(actor, a, mods); } catch (err) { console.error(`sr2e | Token Action HUD: ${a.id}`, err); }
  }
}

function modsOf(h: any): ClickMods {
  return { right: Boolean(h?.isRightClick), shift: Boolean(h?.isShift), alt: Boolean(h?.isAlt), ctrl: Boolean(h?.isCtrl) };
}

/** Defines the TAH classes once TAH Core's API is up, and registers this system with it. */
function onCoreApiReady(coreModule: any): void {
  const api = coreModule?.api;
  if (!api?.SystemManager || !api?.ActionHandler || !api?.RollHandler) return;
  const i18n = (s: string): string => { try { return api.Utils?.i18n?.(s) ?? s; } catch { return s; } };

  class SR2ActionHandler extends api.ActionHandler {
    async buildSystemActions(_groupIds: string[]): Promise<void> {
      const self: any = this;
      const actor: any = self.actor ?? null;
      const actors: any[] = actor ? [actor] : (self.actors ?? canvas?.tokens?.controlled?.map((t: any) => t.actor) ?? []);
      const list = currentList(actor, actors);
      if (!list.length) return;
      const byGroup = new Map<string, HudAction[]>();
      for (const a of list) byGroup.set(a.groupId, [...(byGroup.get(a.groupId) ?? []), a]);
      for (const [groupId, actions] of byGroup) {
        const groupName = i18n(HUD_GROUPS[groupId as keyof typeof HUD_GROUPS]?.name ?? groupId);
        self.addActions(actions.map((a) => ({
          id: a.id,
          // v0.81.1 round 2 (FIX2-BRIEF I3, V-REST 5): item names are player-written: no markup reaches the HUD, but
          // they aren't entity-escaped either (TAH may escape them itself: "&amp;amp;"). The tooltip stays escaped.
          name: noTags(i18n(a.name)),
          listName: noTags(`${groupName}: ${a.name}`),
          encodedValue: encodeHudAction(a, self.delimiter ?? '|'),
          ...(a.img ? { img: a.img } : {}),
          ...(a.info ? { info1: { text: a.info } } : {}),
          ...(a.tooltip ? { tooltip: esc(a.tooltip) } : {}),
          // TAH calls onClick with no arguments: read the click (right button, modifiers) off the HUD manager.
          onClick: () => { void runForSelection(actor, actors, a, modsOf(self.hudManager)); },
        })), { id: groupId, type: 'system' });
      }
    }
  }

  class SR2RollHandler extends api.RollHandler {
    /** Fallback for an action without its onClick (`kind|id`): rebuild the list and run the match. */
    async handleActionClick(_event: any, encodedValue: string): Promise<void> {
      const self: any = this;
      const actor: any = self.actor ?? null;
      const actors: any[] = actor ? [actor] : (self.actors ?? []);
      const a = findHudAction(currentList(actor, actors), encodedValue, self.delimiter ?? '|');
      if (a) { await runForSelection(actor, actors, a, modsOf(self)); return; }
      // An older saved action naming an item (`item|<id>`): its dialog.
      const [type, id] = String(encodedValue ?? '').split(self.delimiter ?? '|');
      if (type === 'item' && id && actor) {
        const item = actor.items?.get?.(id);
        if (item) await useItem(item.uuid);
      }
    }
  }

  class SR2SystemManager extends api.SystemManager {
    getActionHandler(): any { return new SR2ActionHandler(); }
    getAvailableRollHandlers(): Record<string, string> { return { core: 'SR2e' }; }
    /** Must be an instance: TAH Core does `getRollHandler(id) ?? new RollHandler()`. */
    getRollHandler(_rollHandlerId: string): any { return new SR2RollHandler(); }
    registerSettings(_onChange: unknown): void { /* none of our own */ }
    async registerDefaults(): Promise<any> {
      const d = hudDefaults();
      const tr = (g: any) => ({ ...g, name: i18n(g.name), ...(g.listName ? { listName: i18n(g.listName) } : {}) });
      return { layout: d.layout.map((tab) => ({ ...tr(tab), groups: tab.groups.map(tr) })), groups: d.groups.map(tr) };
    }
  }

  Hooks.call('tokenActionHudSystemReady', { id: TAH_SYSTEM_ID, api: { requiredCoreModuleVersion: REQUIRED_CORE_VERSION, SystemManager: SR2SystemManager } });
}

/** Register the TAH hook (safe without Token Action HUD: the hook never fires). */
export function registerTokenActionHud(): void {
  Hooks.once('tokenActionHudCoreApiReady', (coreModule: any) => {
    try {
      if (coreModule?.id && coreModule.id !== TAH_CORE_ID) return;
      onCoreApiReady(coreModule);
    } catch (err) { console.error('sr2e | Token Action HUD', err); }
  });
}
