import { SYSTEM_ID } from '../config/system.ts';
import { escHtml } from '../rules/html.ts';
import { clearFlag } from '../helpers/flags.ts';
import { RULES, tokenVision, visionMatches, WOUND_STATUS_IDS, midTurnWoundDrop, tokenInvisible, STATE_STATUSES, V61_STATUSES, SR2_CORE_STATUSES, stateStatusChanges, prunedStatusEffects, movementBand, movementColour, metresPerUnit, type StateFlags, trackerGroups, passBanner, astralWoundRules, combatEndUnsets, initiativeWoundScore } from '../rules/index.ts';
import { isLeadGm, madeHere } from './leader.ts';
import { t as tx } from '../helpers/i18n.ts';

/**
 * Tokens and the canvas (v0.36.0): token vision from the character's eyes, Physical and Stun bars,
 * wound icons, a hotbar macro per weapon / spell / skill / power, token HUD buttons, and the pass and
 * pools in the combat tracker.
 */

const PEOPLE = ['character', 'npc', 'spirit'];
const ICON = `systems/${SYSTEM_ID}/icons`;

/** CONFIG additions (run at init): wound status effects and the trackable bar attributes. */
export function configureTokens(): void {
  // v0.89.6: the names are keys (this runs at init, before the languages load); Foundry translates a status's name.
  const wounds = [
    { id: WOUND_STATUS_IDS.L, name: 'SR2E.App.Tokens.lightWound', img: `${ICON}/wound-l.svg` },
    { id: WOUND_STATUS_IDS.M, name: 'SR2E.App.Tokens.moderateWound', img: `${ICON}/wound-m.svg` },
    { id: WOUND_STATUS_IDS.S, name: 'SR2E.App.Tokens.seriousWound', img: `${ICON}/wound-s.svg` },
    { id: WOUND_STATUS_IDS.D, name: 'SR2E.App.Tokens.deadlyWound', img: `${ICON}/wound-d.svg` },
  ];
  let se: any[] = (CONFIG as any).statusEffects ?? [];
  // v0.59.0: only the statuses the system uses (RULES.TOKENS.statusList), and SR2 states as statuses.
  // v14 keeps the list in a proxy behind CONFIG.statusEffects: assign through it, then read it back.
  if (RULES.TOKENS.statusList === 'sr2') { (CONFIG as any).statusEffects = prunedStatusEffects([...se], SR2_CORE_STATUSES); se = (CONFIG as any).statusEffects; }
  for (const w of wounds) if (!se.some((x: any) => x.id === w.id)) se.push({ ...w, hud: false });
  for (const s of STATE_STATUSES) if (!se.some((x: any) => x.id === s.id)) se.push({ id: s.id, name: s.name, img: s.img, hud: false });
  for (const s of V61_STATUSES) if (!se.some((x: any) => x.id === s.id)) se.push({ id: s.id, name: s.name, img: s.img });
  const bars = { bar: ['derived.bars.physical', 'derived.bars.stun'], value: [] as string[] };
  // v0.60.0: the Matrix monitor for characters (deckers), the condition track for vehicles.
  const people = { bar: [...bars.bar, 'derived.bars.matrix'], value: ['derived.combatPoolLeft', 'derived.spellPoolLeft', 'derived.karmaPoolLeft'] };
  (CONFIG.Actor as any).trackableAttributes = { ...((CONFIG.Actor as any).trackableAttributes ?? {}), character: people, npc: people, spirit: bars, vehicle: { bar: ['derived.bars.condition'], value: [] } };
}

/** The sight and detection-mode update a token (or prototype token) needs, or null when it already matches. */
export function visionUpdate(actor: any, token: any): Record<string, unknown> | null {
  if (!RULES.TOKENS.autoVision || !PEOPLE.includes(actor?.type)) return null;
  // v0.58.0: astral perception (or projection) sees invisible and astral tokens (Foundry's see-invisibility mode).
  const mode = actor.system?.derived?.astralMode;
  const want = tokenVision({ ...(actor.system?.derived?.vision ?? {}), astral: mode === 'perceiving' || mode === 'projecting' });
  const update: Record<string, unknown> = {};
  if (!visionMatches(token?.sight, want)) Object.assign(update, { 'sight.enabled': true, 'sight.visionMode': want.visionMode, 'sight.range': want.range });
  const modes: any = token?.detectionModes ?? [];
  const list: any[] = Array.isArray(modes) ? modes : Object.entries(modes).map(([id, m]: any) => ({ id, ...m }));
  if (!want.detection) {
    // v0.54.0: eyes damaged, removed or still healing in: switch off the ultrasound sense we gave.
    // Only a sense the system gave (flag `autoTremor`), never one the GM gave a critter or spirit by hand.
    // Tokens from before v0.54.0 have no flag: ultrasound ware on the sheet (any state) means it was ours.
    const gave = token?.flags?.[SYSTEM_ID]?.autoTremor || [...(actor?.items ?? [])].some((i: any) => (i.type === 'cyberware' && i.system?.ultrasound) || (i.type === 'adeptpower' && i.system?.sense === 'ultrasound'));
    const ours = gave ? list.find((m: any) => m.id === RULES.TOKENS.vision.ultrasound.detection && m.enabled !== false) : null;
    if (ours) {
      update[`flags.${SYSTEM_ID}.autoTremor`] = false;
      if (Array.isArray(modes)) update['detectionModes'] = list.map((m: any) => (m.id === ours.id ? { ...m, enabled: false } : m));
      else update[`detectionModes.${ours.id}.enabled`] = false;
    }
  }
  if (want.detection) {
    const has = list.find((m: any) => m.id === want.detection!.id);
    if (!has || Number(has.range) !== want.detection.range || has.enabled === false) {
      // v14 keeps detection modes as an object keyed by id: set only ours (re-sending the others fails
      // validation, e.g. lightPerception's null range). Older versions keep an array.
      if (Array.isArray(modes)) update['detectionModes'] = [...list.filter((m: any) => m.id !== want.detection!.id), { id: want.detection.id, enabled: true, range: want.detection.range }];
      else update[`detectionModes.${want.detection.id}`] = { enabled: true, range: want.detection.range };
      update[`flags.${SYSTEM_ID}.autoTremor`] = true;
    }
  }
  // v0.58.0: the see-invisibility sense we gave an astral perceiver, on or off (never one the GM gave by hand).
  const seeId = RULES.GEAR_V58.visibility.astralDetection;
  const seeHas = list.find((m: any) => m.id === seeId);
  if (want.seeInvisible) {
    if (!seeHas || seeHas.enabled === false || Number(seeHas.range) !== want.seeInvisible.range) {
      if (Array.isArray(modes)) update['detectionModes'] = [...((update['detectionModes'] as any[] | undefined) ?? list).filter((m: any) => m.id !== seeId), { id: seeId, enabled: true, range: want.seeInvisible.range }];
      else update[`detectionModes.${seeId}`] = { enabled: true, range: want.seeInvisible.range };
      update[`flags.${SYSTEM_ID}.autoSeeInvisible`] = true;
    }
  } else if (seeHas && seeHas.enabled !== false && token?.flags?.[SYSTEM_ID]?.autoSeeInvisible) {
    if (Array.isArray(modes)) update['detectionModes'] = ((update['detectionModes'] as any[] | undefined) ?? list).map((m: any) => (m.id === seeId ? { ...m, enabled: false } : m));
    else update[`detectionModes.${seeId}.enabled`] = false;
    update[`flags.${SYSTEM_ID}.autoSeeInvisible`] = false;
  }
  return Object.keys(update).length ? update : null;
}

/**
 * v0.58.0 (active GM): give an actor Foundry's invisible status while an invisibility spell is on them or
 * they project astrally, and take it off again when we gave it (never one the GM set by hand).
 */
export async function syncInvisibility(actor: any): Promise<boolean> {
  if (!actor || !PEOPLE.includes(actor.type)) return false;
  const active = (game as any).users?.activeGM;
  if (!game.user?.isGM || (active && !isLeadGm())) return false;
  const v = RULES.GEAR_V58.visibility;
  // v0.70.0: an unmaterialized spirit is an astral form too (before, only projecting magicians were hidden); a
  // manifesting form is meant to be seen, so it isn't hidden.
  const manifesting = Boolean(actor.system?.manifesting) && Boolean(RULES.MAGIC_V56?.manifest?.enabled);
  const mode = manifesting ? 'physical' : actor.type === 'spirit' && actor.system?.materialized === false ? 'projecting' : actor.system?.derived?.astralMode;
  const want = tokenInvisible({ astralMode: mode === 'projecting' && !v.projecting ? 'physical' : mode, concealment: actor.concealmentOf?.() ?? [] }).invisible;
  const has = Boolean(actor.statuses?.has?.(v.status));
  const ours = Boolean(actor.getFlag?.(SYSTEM_ID, 'autoInvisible'));
  try {
    if (want && !has) {
      await actor.toggleStatusEffect?.(v.status, { active: true });
      await actor.setFlag(SYSTEM_ID, 'autoInvisible', true);
      return true;
    }
    if (!want && has && ours) {
      await actor.toggleStatusEffect?.(v.status, { active: false });
      // A-13: cleared through the flags helper (null on an unlinked token's actor), not set to false.
      await clearFlag(actor, 'autoInvisible');
      return true;
    }
    if (!want && !has && ours) await clearFlag(actor, 'autoInvisible');
  } catch (err) { console.warn('sr2e | invisibility', err); }
  return false;
}

/** v0.58.0: re-check everyone a change of sustained spells or astral state could touch. */
function invisibilityTouched(actor: any): any[] {
  const out = new Map<string, any>();
  const add = (a: any) => { if (a?.uuid) out.set(a.uuid, a); };
  add(actor);
  for (const e of [...((actor?.system?.sustaining as any[] | undefined) ?? [])]) for (const u of [...(e.targetUuids ?? [])]) { try { add(fromUuidSync(u)); } catch { /* gone */ } }
  // Anyone we made invisible earlier (the spell that did it may just have dropped).
  for (const a of [...((game as any).actors ?? [])]) if (a.getFlag?.(SYSTEM_ID, 'autoInvisible')) add(a);
  for (const sc of [...((game as any).scenes ?? [])]) for (const t of [...(sc.tokens ?? [])]) if (!t.actorLink && t.actor?.getFlag?.(SYSTEM_ID, 'autoInvisible')) add(t.actor);
  return [...out.values()];
}

/** Bring an actor's prototype token and its placed tokens in line with its eyes. */
export async function syncTokenVision(actor: any): Promise<number> {
  if (!actor?.isOwner) return 0;
  let n = 0;
  const proto = visionUpdate(actor, actor.prototypeToken);
  if (proto) {
    await actor.update(Object.fromEntries(Object.entries(proto).map(([k, v]) => [`prototypeToken.${k}`, v])));
    n++;
  }
  // Every placed token of this actor, linked or not, on every scene (an unlinked token's own actor
  // carries the same items unless its delta changed them).
  const base: any = actor.isToken ? actor.token?.baseActor ?? actor : actor;
  const docs: any[] = actor.isToken && actor.token ? [actor.token]
    : [...((game as any).scenes ?? [])].flatMap((sc: any) => [...(sc.tokens ?? [])].filter((t: any) => t.actorId === base.id));
  for (const doc of docs) {
    if (!doc?.isOwner) continue;
    const u = visionUpdate(doc.actor ?? actor, doc);
    if (u) { await doc.update(u); n++; }
  }
  return n;
}

const pendingSync = new Map<string, ReturnType<typeof setTimeout>>();
function queueSync(actor: any): void {
  if (!actor?.uuid) return;
  clearTimeout(pendingSync.get(actor.uuid));
  pendingSync.set(actor.uuid, setTimeout(() => { pendingSync.delete(actor.uuid); void syncTokenVision(actor); }, 300));
}

/** Open the right dialog for an item on its owner's sheet (hotbar macros, the token HUD). */
export async function useItem(uuid: string): Promise<boolean> {
  const item: any = await fromUuid(uuid);
  const actor: any = item?.parent;
  if (!item || !actor) { ui.notifications.warn(tx('SR2E.Notify.Tokens.thatItemIsNoLongerOn')); return false; }
  if (!actor.isOwner) { ui.notifications.warn(tx('SR2E.Notify.Tokens.youDonTOwn', { actorName: escHtml(actor.name) })); return false; }
  const action = ({ weapon: 'attackWeapon', spell: 'castSpell', skill: 'rollSkill', power: 'usePower' } as Record<string, string>)[item.type];
  if (!action) { item.sheet?.render(true); return true; }
  return runSheetAction(actor, action, { itemId: item.id });
}

/** Run one of an actor sheet's actions as if its button had been clicked. */
export async function runSheetAction(actor: any, action: string, dataset: Record<string, string> = {}, event: Partial<MouseEvent> = {}): Promise<boolean> {
  const sheet: any = actor?.sheet;
  const entry = sheet?.options?.actions?.[action];
  const fn = typeof entry === 'function' ? entry : entry?.handler;
  if (typeof fn !== 'function') { ui.notifications.warn(tx('SR2E.Notify.Tokens.hasNoAction', { actorName: escHtml(actor?.name ?? tx('SR2E.Notify.Tokens.thatSheet')), action: escHtml(action) })); return false; }
  const el = document.createElement('a');
  for (const [k, v] of Object.entries(dataset)) el.dataset[k] = v;
  await fn.call(sheet, { shiftKey: false, preventDefault() {}, stopPropagation() {}, currentTarget: el, target: el, ...event }, el);
  return true;
}

/** v0.71.0 (R13): incapacitated states that make a holder let go. */
const DOWN_STATES = new Set(['unconscious', 'dying', 'dead', 'disrupted', 'banished']);

/** Hooks: vision on create / update, wound icons, hotbar, token HUD, tracker. */
export function registerTokenHooks(): void {
  // v0.71.0 (R13): someone held in a grapple, or bound, can't be moved by a player (the GM can, with a note).
  Hooks.on('preUpdateToken', (doc: any, change: any, _options: any, userId: string) => {
    if (userId !== game.user?.id || (change?.x === undefined && change?.y === undefined)) return;
    const why = doc.actor?.movementHold?.() ?? '';
    if (!why) return;
    if (game.user?.isGM) { ui.notifications?.info?.(tx('SR2E.Notify.Tokens.isMovedByTheGmAnyway', { docName: escHtml(doc.name), why: escHtml(why) })); return; }
    ui.notifications?.warn?.(tx('SR2E.Notify.Tokens.isAndCanTMoveBreak', { docName: escHtml(doc.name), why: escHtml(why) }));
    return false;
  });
  // v0.71.0 (R13): a holder who goes down lets go; a combat that ends frees everyone held in it (the active GM).
  // A-12: only when the status changes into a down state (not on every later update of someone already down).
  const lastStatus = new Map<string, string>();
  Hooks.on('updateActor', (actor: any) => {
    if (!RULES.FIXES_V71.holds || !(game as any).user?.isGM || !actor?.uuid) return;
    const now = String(actor?.system?.derived?.status ?? '');
    const before = lastStatus.get(actor.uuid);
    // v0.85.0: every GM window keeps the record (a window that takes over has it); only the lead one acts.
    lastStatus.set(actor.uuid, now);
    if (!isLeadGm() || !DOWN_STATES.has(now) || before === now) return;
    void (CONFIG.Actor.documentClass as any).releaseHolds?.({ holderUuid: actor.uuid });
  });
  Hooks.on('deleteCombat', (combat: any) => {
    if (!RULES.FIXES_V71.holds || !isLeadGm()) return;
    const uuids = [...(combat?.combatants ?? [])].map((c: any) => c.actor?.uuid).filter(Boolean);
    if (uuids.length) void (CONFIG.Actor.documentClass as any).releaseHolds?.({ uuids });
  });
  // v0.73.0 (O27): sensor locks lapse with time and range (the active GM).
  Hooks.on('updateCombat', (_c: any, change: any) => { if (change?.round !== undefined) void (CONFIG.Actor.documentClass as any).lapseSensorLocks?.(); });
  Hooks.on('updateWorldTime', () => { if (!(game as any).combat?.started) void (CONFIG.Actor.documentClass as any).lapseSensorLocks?.(); });
  // v0.73.0 (O41): morale "broken" ends with the fight (RULES.CROSSCUT_V73.statuses.brokenEndsWithCombat).
  Hooks.on('deleteCombat', (combat: any) => {
    if (!isLeadGm()) return;
    const seen = new Set<string>();
    // Review fix: also the combat scene's tokens (morale-group members that weren't in the tracker).
    const sceneTokens = [...(combat?.scene?.tokens ?? [])].map((t: any) => ({ actor: t.actor }));
    for (const c of [...(combat?.combatants ?? []), ...sceneTokens]) {
      const a: any = c.actor;
      if (!a || seen.has(a.uuid)) continue;
      seen.add(a.uuid);
      // Live fix: not unsetFlag (an unlinked token's delta can't delete the key). A-13: helpers/flags.ts clearFlag writes
      // null there (and deletes the key elsewhere), as every other flag clear does.
      for (const f of combatEndUnsets({ broken: a.getFlag?.(SYSTEM_ID, 'broken') })) void clearFlag(a, f).catch?.(() => {});
    }
  });
  Hooks.on('preCreateActor', (actor: any, data: any) => {
    if (!RULES.TOKENS.bars || !PEOPLE.includes(actor.type)) return;
    const pt = data?.prototypeToken ?? {};
    const set: Record<string, unknown> = {};
    if (!pt.bar1?.attribute) set['prototypeToken.bar1.attribute'] = 'derived.bars.physical';
    if (!pt.bar2?.attribute) set['prototypeToken.bar2.attribute'] = 'derived.bars.stun';
    if (pt.displayBars === undefined) set['prototypeToken.displayBars'] = 40; // owner hover
    if (Object.keys(set).length) actor.updateSource(set);
  });
  Hooks.on('createActor', (actor: any, _o: any, userId: string) => {
    if (madeHere(_o, userId)) queueSync(actor);
    // v0.70.0: a spirit summoned unmaterialized is hidden from mundane eyes at once (the active GM sets it).
    if (actor?.type === 'spirit' && actor.system?.materialized === false && RULES.GEAR_V58.visibility.enabled) void syncInvisibility(actor);
  });
  Hooks.on('preCreateToken', (token: any) => {
    const actor = token.actor;
    const u = actor ? visionUpdate(actor, token) : null;
    if (u) token.updateSource(u);
  });
  Hooks.on('updateActor', (actor: any, change: any, _o: any, userId: string) => {
    // v0.58.0: invisibility and astral forms on the map (the active GM sets the status, whoever made the change).
    // A-11: only the active GM's client sets the status (syncInvisibility), so only it looks for who is touched.
    if (RULES.GEAR_V58.visibility.enabled && isLeadGm() && (change?.system?.astral !== undefined || change?.system?.sustaining !== undefined || change?.system?.magic !== undefined || change?.system?.materialized !== undefined || change?.system?.manifesting !== undefined)) {
      for (const a of invisibilityTouched(actor)) void syncInvisibility(a);
    }
    if (!madeHere(_o, userId)) return;
    // v0.58.0: astral perception changes the token's senses too.
    if (change?.system?.vision !== undefined || change?.system?.metatype !== undefined || change?.system?.recovering !== undefined || change?.system?.astral !== undefined) queueSync(actor);
  });
  // v0.54.0: a wound taken mid-turn lowers the combatant's score at once (RULES.INITIATIVE_WOUNDS).
  // v0.73.0 (O23): persona damage (system.matrix.monitor) counts too while jacked in (NETRIG_V73.personaInitiative).
  const woundScore = (actor: any) => initiativeWoundScore({
    woundModifier: Number(actor.system?.derived?.woundModifier ?? 0),
    jackedIn: Boolean(actor.system?.derived?.matrix?.jackedIn ?? actor.system?.matrix?.jackedIn),
    matrixBoxes: Number(actor.system?.matrix?.monitor ?? 0),
  } as any);
  Hooks.on('preUpdateActor', (actor: any, change: any, options: any, userId: string) => {
    if (userId !== game.user?.id || (change?.system?.monitor === undefined && change?.system?.matrix?.monitor === undefined)) return;
    options.sr2eWound = { ...(options.sr2eWound ?? {}), [actor.uuid]: woundScore(actor) };
  });
  Hooks.on('updateActor', async (actor: any, _change: any, options: any, userId: string) => {
    if (!madeHere(options, userId)) return;
    const before = options?.sr2eWound?.[actor.uuid];
    if (before === undefined) return;
    // An astral form's score carries no physical wounds (as on the roll).
    // v0.72.0 (O20): a projecting magician's wounds lower Initiative too unless MAGIC_V72.astralWounds says otherwise.
    if (actor.system?.derived?.astralMode === 'projecting' && !astralWoundRules().initiative) return;
    const now = woundScore(actor);
    for (const combat of [...((game as any).combats ?? [])].filter((c: any) => c.started)) {
      for (const c of [...(combat.combatants ?? [])]) {
        if (c.actor?.uuid !== actor.uuid || c.initiative === null || c.initiative === undefined || !c.isOwner) continue;
        // The penalty already in this Combat Turn's score (kept on the combatant), so a re-roll of the
        // soak, an undo and re-apply, or the next grunt stepping in never takes it off twice.
        const kept = c.getFlag?.(SYSTEM_ID, 'woundInit') as { round: number; applied: number } | undefined;
        const applied = kept && kept.round === combat.round ? Number(kept.applied) : Number(before);
        const drop = midTurnWoundDrop(applied, now);
        if (!drop) continue;
        await c.update({ initiative: Number(c.initiative) - drop, [`flags.${SYSTEM_ID}.woundInit`]: { round: combat.round, applied: applied + drop } });
      }
    }
  });
  const itemChanged = (item: any, options: any, userId?: string) => {
    // v0.58.0: the active GM re-checks invisibility whoever changed the item.
    if (item?.parent && RULES.GEAR_V58.visibility.enabled && (item.type === 'adeptpower' || item.type === 'gear')) void syncInvisibility(item.parent);
    if (userId && !madeHere(options, userId)) return;
    // v0.56.0: an adept's improved senses change vision too.
    // v0.58.0: and worn vision gear (goggles, visors).
    if (item?.parent && (item.type === 'cyberware' || item.type === 'adeptpower' || (item.type === 'gear' && item.system?.optics))) queueSync(item.parent);
  };
  Hooks.on('createItem', (item: any, o: any, userId: string) => itemChanged(item, o, userId));
  Hooks.on('updateItem', (item: any, _c: any, o: any, userId: string) => itemChanged(item, o, userId));
  Hooks.on('deleteItem', (item: any, o: any, userId: string) => itemChanged(item, o, userId));

  // Hotbar: dragging a weapon, spell, skill or power off a sheet makes a macro that opens its dialog.
  Hooks.on('hotbarDrop', (_bar: any, data: any, slot: number) => {
    if (data?.type !== 'Item' || !data.uuid) return;
    const item: any = fromUuidSync(data.uuid);
    if (!item?.parent || !['weapon', 'spell', 'skill', 'power'].includes(item.type)) return;
    void (async () => {
      const command = `game.sr2e.useItem(${JSON.stringify(item.uuid)});`;
      let macro: any = game.macros?.find?.((m: any) => m.command === command && m.isOwner);
      macro ??= await (globalThis as any).Macro.create({ name: `${item.parent.name}: ${item.name}`, type: 'script', img: item.img, command, flags: { [SYSTEM_ID]: { itemUuid: item.uuid } } });
      await game.user?.assignHotbarMacro(macro, slot);
    })();
    return false;
  });

  Hooks.on('renderTokenHUD', (hud: any, html: HTMLElement) => {
    try { decorateTokenHud(hud, html); } catch (err) { console.warn('sr2e | token HUD', err); }
  });
  Hooks.on('renderCombatTracker', (_app: any, html: HTMLElement) => {
    try { decorateTracker(html); } catch (err) { console.warn('sr2e | tracker', err); }
  });
}

/** Token HUD (right-click): Attack / Cast / Defend on your own token; "Attack this" on anyone else's. */
function decorateTokenHud(hud: any, htmlIn: HTMLElement): void {
  const html: HTMLElement = (htmlIn as any)?.querySelector ? htmlIn : (htmlIn as any)?.[0];
  const token: any = hud.object ?? hud.token;
  const actor: any = token?.actor;
  if (!html || !actor || !PEOPLE.includes(actor.type) || html.querySelector('.sr2e-hud')) return;
  const col = html.querySelector('.col.left') ?? html;
  const add = (icon: string, title: string, run: () => unknown) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'control-icon sr2e-hud';
    // A-3: Foundry's tooltip renders data-tooltip as HTML; names in it (a weapon, a token) are escaped.
    b.dataset['tooltip'] = escHtml(title);
    b.title = title;
    b.innerHTML = `<i class="${icon}"></i>`;
    b.addEventListener('click', (ev) => { ev.preventDefault(); ev.stopPropagation(); void run(); });
    col.appendChild(b);
  };
  if (actor.isOwner) {
    add('fa-solid fa-crosshairs', tx('SR2E.App.Tokens.attackPickAWeapon'), () => runSheetAction(actor, 'quickAttack'));
    if ([...actor.items].some((i: any) => i.type === 'spell')) add('fa-solid fa-wand-sparkles', tx('SR2E.App.Tokens.castASpell'), () => runSheetAction(actor, 'quickCast'));
    const pending = latestAttackOn(actor);
    if (pending) add('fa-solid fa-shield-halved', tx('SR2E.App.Tokens.defendAgainst', { label: pending.label }), () => pending.defend());
  } else {
    const me = attackerFor(token);
    if (me) add('fa-solid fa-crosshairs', tx('SR2E.App.Tokens.attacks', { attacker: me.name, target: token.name }), async () => {
      token.setTarget?.(true, { releaseOthers: true });
      await runSheetAction(me, 'quickAttack');
    });
  }
}

/** Who attacks from the HUD: your controlled token's actor, else your assigned character. */
function attackerFor(target: any): any {
  const controlled: any = canvas?.tokens?.controlled?.find?.((t: any) => t !== target && t.actor?.isOwner);
  return controlled?.actor ?? game.user?.character ?? null;
}

/** The newest attack card aimed at this actor that still shows a Defend button. */
export function latestAttackOn(actor: any): { label: string; defend: () => void } | null {
  const msgs = [...(game.messages?.contents ?? [])].slice(-30).reverse();
  for (const m of msgs) {
    const list: any[] = (m.getFlag(SYSTEM_ID, 'attacks') as any[] | undefined) ?? [m.getFlag(SYSTEM_ID, 'attack')].filter(Boolean);
    const i = list.findIndex((a: any) => a?.targetUuid === actor.uuid);
    if (i < 0 || !String(m.content ?? '').includes('data-sr2e-action="defend"')) continue;
    // v0.70.0: skip cards already defended against, or replaced by a newer card (their buttons are dead).
    const shown = document.querySelector<HTMLButtonElement>(`[data-message-id="${m.id}"] button[data-sr2e-action="defend"][data-index="${i}"]`)
      ?? document.querySelector<HTMLButtonElement>(`[data-message-id="${m.id}"] button[data-sr2e-action="defend"]`);
    const rolled = ((actor.getFlag?.(SYSTEM_ID, 'cardRolls') as string[] | undefined) ?? []).includes(`${m.id}:defended:${i}`);
    if (shown?.disabled || rolled || ((m.getFlag(SYSTEM_ID, 'defended') as number[] | undefined) ?? []).includes(i)) continue;
    return {
      label: `${list[i].weaponName}`,
      defend: () => {
        const btn = document.querySelector<HTMLButtonElement>(`[data-message-id="${m.id}"] button[data-sr2e-action="defend"][data-index="${i}"]`)
          ?? document.querySelector<HTMLButtonElement>(`[data-message-id="${m.id}"] button[data-sr2e-action="defend"]`);
        if (btn) btn.click();
        else ui.notifications.warn(tx('SR2E.Notify.Tokens.openTheChatLogToDefend'));
      },
    };
  }
  return null;
}

/** Combat tracker: the initiative pass, and each combatant's pools (for their owners and the GM). */
function decorateTracker(htmlIn: HTMLElement): void {
  const html: HTMLElement = (htmlIn as any)?.querySelector ? htmlIn : (htmlIn as any)?.[0];
  const combat: any = game.combat;
  if (!html || !combat) return;
  // v0.68.0: the pass as a banner over the list, the acting combatant marked, delayers grouped last, full defense badged.
  try { arrangeTracker(html, combat); } catch (err) { console.warn('sr2e | tracker groups', err); }
  for (const li of Array.from(html.querySelectorAll<HTMLElement>('[data-combatant-id]'))) {
    const c: any = combat.combatants.get(li.dataset['combatantId']);
    const a: any = c?.actor;
    // v0.46.0: IC, frames and agents get an Act button in the tracker.
    const owner: any = a?.system?.ownerUuid ? fromUuidSync(a.system.ownerUuid) : null;
    const isProgram = ['frame', 'agent'].includes(a?.system?.kind);
    if (a?.type === 'ic' && a.isOwner && !li.querySelector('.sr2e-ic-act') && !a.system?.derived?.crashed && (!isProgram || owner)) {
      const b = document.createElement('a');
      b.className = 'sr2e-ic-act';
      b.title = isProgram ? tx('SR2E.App.Tokens.runAnOperation', { name: a.name }) : tx('SR2E.App.Tokens.acts', { name: a.name });
      b.innerHTML = ' <i class="fa-solid fa-bolt"></i>';
      b.addEventListener('click', (ev) => {
        ev.preventDefault(); ev.stopPropagation();
        if (isProgram && owner) void runSheetAction(owner, 'systemTest', { frameUuid: a.uuid });
        else void runSheetAction(a, 'icAttack');
      });
      (li.querySelector('.token-name, .name') ?? li).appendChild(b);
    }
    if (!a?.isOwner || li.querySelector('.sr2e-tracker-pools')) continue;
    const d = a.system?.derived ?? {};
    const parts: string[] = [];
    if (d.combatPool) parts.push(`C ${d.combatPoolLeft}/${d.combatPool}`);
    if (d.spellPool) parts.push(`Sp ${d.spellPoolLeft}/${d.spellPool}`);
    if (d.hackingPool) parts.push(`H ${d.hackingPoolLeft}/${d.hackingPool}`);
    if (d.controlPool) parts.push(`Ct ${d.controlPoolLeft}/${d.controlPool}`);
    if (a.system?.karma?.pool) parts.push(`K ${d.karmaPoolLeft}/${a.system.karma.pool}`);
    if (a.fullDefenseUp?.()) parts.push(tx('SR2E.App.Tokens.fullDef'));
    if (a.isDelaying?.()) parts.push(tx('SR2E.App.Tokens.delaying'));
    if (!parts.length) continue;
    const div = document.createElement('div');
    div.className = 'sr2e-tracker-pools';
    div.textContent = parts.join(' · ');
    (li.querySelector('.token-name, .name') ?? li).appendChild(div);
  }
}

/**
 * v0.68.0: the tracker's own arrangement. Idempotent (the hook runs on every render, sometimes on a list
 * already arranged): the banner is updated in place, the group header rebuilt, and the rows put back in
 * Foundry's turn order with the delaying ones after a "Delaying" header. Styled with Foundry's variables.
 */
function arrangeTracker(html: HTMLElement, combat: any): void {
  const rows = Array.from(html.querySelectorAll<HTMLElement>('li[data-combatant-id]'));
  const list: HTMLElement | null = rows[0]?.parentElement ?? html.querySelector<HTMLElement>('ol.combat-tracker, .combat-tracker');
  const flags = (id: string) => {
    const a: any = combat.combatants?.get?.(id)?.actor;
    const safe = (f: () => unknown) => { try { return Boolean(f()); } catch { return false; } };
    return { id, delaying: safe(() => a?.isDelaying?.()), actingNow: safe(() => a?.actingNow?.()), fullDefense: safe(() => a?.fullDefenseUp?.()) };
  };
  // Foundry's turn order first (the order it renders), then any row it lists that isn't a turn.
  const turnIds: string[] = [...(combat.turns ?? [])].map((c: any) => String(c.id));
  const present = new Set(rows.map((li) => li.dataset['combatantId'] ?? ''));
  const ids = [...turnIds.filter((id) => present.has(id)), ...rows.map((li) => li.dataset['combatantId'] ?? '').filter((id) => id && !turnIds.includes(id))];
  const groups = trackerGroups(ids.map(flags));
  const delayed = new Set(groups.delayed);
  const fd = new Set(groups.fullDefense);
  const actingId = combat.started ? combat.combatant?.id ?? null : null;
  for (const li of rows) {
    const id = li.dataset['combatantId'] ?? '';
    li.classList.toggle('sr2e-acting', Boolean(actingId) && id === actingId);
    li.classList.toggle('sr2e-delayed', delayed.has(id));
    const name = li.querySelector<HTMLElement>('.token-name, .name') ?? li;
    const badge = li.querySelector('.sr2e-badge-fd');
    if (fd.has(id) && !badge) {
      const b = document.createElement('span');
      b.className = 'sr2e-badge-fd';
      b.title = tx('SR2E.App.Tokens.fullDefense');
      b.innerHTML = '<i class="fa-solid fa-shield-halved"></i>';
      const h = name.querySelector('h4, strong') ?? name;
      h.appendChild(b);
    } else if (!fd.has(id) && badge) badge.remove();
  }
  // The rows back in order, the delaying ones under their own header.
  if (list) {
    list.querySelectorAll(':scope > li.sr2e-tracker-group').forEach((el) => el.remove());
    const byId = new Map(rows.filter((li) => li.parentElement === list).map((li) => [li.dataset['combatantId'] ?? '', li]));
    // Always in full (a list already arranged on an earlier render goes back to the turn order first).
    for (const id of groups.main) { const li = byId.get(id); if (li) list.appendChild(li); }
    if (groups.delayed.length) {
      const head = document.createElement('li');
      head.className = 'sr2e-tracker-group';
      head.textContent = tx('SR2E.App.Tokens.delaying2');
      head.title = tx('SR2E.App.Tokens.holdingADelayedActionOr');
      list.appendChild(head);
      for (const id of groups.delayed) { const li = byId.get(id); if (li) list.appendChild(li); }
    }
  }
  // The banner over the list: the Combat Turn and pass, who acts, how many are on full defense or delaying.
  const view = passBanner({ started: Boolean(combat.started), round: Number(combat.round ?? 1), pass: Number(combat.pass ?? 0) + 1,
    acting: actingId ? String(combat.combatant?.name ?? '') : '', fullDefense: groups.counts.fullDefense, delayed: groups.counts.delayed });
  let banner = html.querySelector<HTMLElement>('.sr2e-pass-banner');
  if (!view) { banner?.remove(); return; }
  if (!banner) {
    banner = document.createElement('div');
    banner.className = 'sr2e-pass-banner';
    banner.setAttribute('role', 'status');
    if (list?.parentElement) list.parentElement.insertBefore(banner, list);
    else (html.querySelector('.combat-tracker-header, header') ?? html).appendChild(banner);
  }
  banner.replaceChildren();
  const title = document.createElement('div');
  title.className = 'sr2e-pass-title';
  title.textContent = view.title;
  banner.appendChild(title);
  if (view.acting || view.notes.length) {
    const sub = document.createElement('div');
    sub.className = 'sr2e-pass-sub';
    if (view.acting) { const s = document.createElement('span'); s.className = 'sr2e-pass-acting'; s.textContent = view.acting; sub.appendChild(s); }
    for (const n of view.notes) { const s = document.createElement('span'); s.className = 'sr2e-pass-note'; s.textContent = n; sub.appendChild(s); }
    banner.appendChild(sub);
  }
}

// ---------------------------------------------------------------- v0.59.0 SR2 states on the token

/** What an actor is doing, as the state statuses read it. */
export function actorStateFlags(actor: any): StateFlags {
  const combat: any = (game as any).combat;
  const mine = combat?.started ? [...(combat.combatants ?? [])].find((c: any) => c.actor?.uuid === actor?.uuid) : null;
  let surprised = false;
  try { surprised = Boolean(mine && (combat.surprisedNow?.() ?? []).includes(mine.id)); } catch { /* no combat */ }
  return {
    fullDefense: Boolean(actor?.fullDefenseUp?.()),
    delaying: Boolean(actor?.isDelaying?.()),
    surprised,
    jackedIn: Boolean(actor?.isJackedIn?.()),
    jumpedIn: Boolean(actor?.system?.rigging?.jumpedIn && actor.system.rigging.vehicleUuid),
    onFire: Boolean(actor?.getFlag?.(SYSTEM_ID, 'onFire')),
    broken: Boolean(actor?.getFlag?.(SYSTEM_ID, 'broken')),
  };
}

const stateBusy = new Map<string, ReturnType<typeof setTimeout>>();

/** Bring an actor's state statuses up to date (the active GM's client does it, a moment after the change). */
export function syncStateStatuses(actor: any): void {
  if (!RULES.TOKENS.stateIcons || !actor || !PEOPLE.includes(actor.type) || !isLeadGm()) return;
  const key = String(actor.uuid);
  const t = stateBusy.get(key);
  if (t) clearTimeout(t);
  stateBusy.set(key, setTimeout(() => {
    stateBusy.delete(key);
    void (async () => {
      const has = new Set<string>([...((actor.statuses ?? []) as Iterable<string>)]);
      const ours = (actor.getFlag?.(SYSTEM_ID, 'autoStatuses') as string[] | undefined) ?? [];
      const ch = stateStatusChanges(actorStateFlags(actor), has, ours);
      for (const id of ch.on) { try { await actor.toggleStatusEffect?.(id, { active: true }); } catch { /* no token */ } }
      for (const id of ch.off) { try { await actor.toggleStatusEffect?.(id, { active: false }); } catch { /* no token */ } }
      if (ch.ours.slice().sort().join() !== [...ours].sort().join()) { try { await actor.setFlag(SYSTEM_ID, 'autoStatuses', ch.ours); } catch { /* not saved */ } }
    })();
  }, 150));
}

export function registerStateStatusHooks(): void {
  Hooks.on('updateActor', (actor: any, change: any) => {
    if (change?.flags?.[SYSTEM_ID]?.autoStatuses !== undefined && Object.keys(change.flags[SYSTEM_ID]).length === 1 && !change.system) return;
    syncStateStatuses(actor);
  });
  const everyone = (combat: any) => { for (const c of [...(combat?.combatants ?? [])]) syncStateStatuses(c.actor); };
  Hooks.on('updateCombat', (combat: any) => everyone(combat));
  Hooks.on('createCombatant', (c: any) => syncStateStatuses(c.actor));
  Hooks.on('deleteCombat', (combat: any) => everyone(combat));
  Hooks.on('deleteCombatant', (c: any) => syncStateStatuses(c.actor));
}

// ---------------------------------------------------------------- v0.59.0 movement colours on the ruler

/** The ruler colour for a waypoint of this token's move (null: Foundry's own). */
export function rulerColour(token: any, waypoint: any): number | null {
  const rates = token?.actor?.system?.derived?.movement;
  const units = Number(waypoint?.measurement?.distance ?? NaN);
  if (!Number.isFinite(units)) return null;
  let perUnit = 1;
  try { perUnit = metresPerUnit(String(canvas?.scene?.grid?.units ?? 'm')) ?? 1; } catch { perUnit = 1; }
  return movementColour(movementBand(units * perUnit, rates));
}

export function registerMovementRuler(): void {
  const Base: any = (CONFIG as any).Token?.rulerClass;
  if (!Base || !RULES.TOKENS.ruler.enabled) return;
  class SR2TokenRuler extends Base {
    _getGridHighlightStyle(waypoint: any, offset: any): any {
      const s = super._getGridHighlightStyle(waypoint, offset);
      if (!s || !(s.alpha > 0)) return s;
      const c = rulerColour((this as any).token, waypoint);
      return c === null ? s : { ...s, color: c };
    }
    _getSegmentStyle(waypoint: any): any {
      const s = super._getSegmentStyle(waypoint);
      if (!s || !(s.width > 0)) return s;
      const c = rulerColour((this as any).token, waypoint);
      return c === null ? s : { ...s, color: c };
    }
  }
  (CONFIG as any).Token.rulerClass = SR2TokenRuler;
}
