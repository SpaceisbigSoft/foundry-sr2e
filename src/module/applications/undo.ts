/**
 * The undo log (v0.51.0). Foundry has no undo for document changes, so the system keeps its own:
 *
 * - Every client, before it changes a document (`preUpdate…` hooks), notes what the changed
 *   fields were and sends that along inside the update's own options (`options.sr2eUndo`, keyed by
 *   document id). Foundry passes custom options through the server to every client, so a
 *   player's change reaches the GM with its "before" values and no socket is needed.
 * - GM clients log what happens (`update…`, `create…`, `delete…` hooks): updates with their
 *   before and after values, creations, and deletions with the whole document. Changes by one user
 *   within `RULES.GM_TOOLS.undo.windowMs` of each other make one step.
 * - Undo takes the newest step back, newest change first: updates put back, creations deleted,
 *   deletions recreated with their old ids. If something not logged changed a field since, the
 *   GM is asked first.
 *
 * The log lives in this browser (localStorage, per world and GM). What it can't undo is listed by
 * `undoLimits()` (rules/gmtools.ts) and shown in the GM panel.
 */
import { SYSTEM } from '../config/system.ts';
import { deltaSafeUpdate } from '../helpers/flags.ts';
import { undoFieldsToKeep } from '../rules/trust.ts';
import { escHtml } from '../rules/html.ts';
import {
  RULES, beforeValues, afterValues, inverseUpdate, changedSince, logChange, newestStep, describeEntry, fieldLabel,
  cardTitle, sanitizeLog, stepChecks, pickUndo, purgeHistory, changePaths, forgetMatch, undoDocsV73, undoSkipsChange, type UndoStep, type UndoEntry, type FieldChange,
} from '../rules/index.ts';
import { t as tx } from '../helpers/i18n.ts';

/** The document kinds the log follows. */
export const LOGGED_DOCS = ['Actor', 'Item', 'ActiveEffect', 'Token', 'Scene', 'Wall', 'Drawing', 'Combat', 'Combatant', 'ChatMessage', 'Setting', 'MeasuredTemplate', 'AmbientLight'] as const;

/** Token fields a move or turn touches (not logged when `skipTokenMoves`). */
const MOVE_KEYS = new Set(['x', 'y', 'elevation', 'rotation', 'sort', '_id', '_stats', 'movementAction', '_movementHistory', 'level']);

/** System settings that change by themselves (not worth a step). */
const UNLOGGED_SETTINGS = new Set([`${SYSTEM.id}.migrationVersion`, `${SYSTEM.id}.karmaRefreshDay`]);

/** Settings worth undoing: the system's world settings and world time. */
export function loggedSetting(key: string): boolean {
  return key === 'core.time' || (key.startsWith(`${SYSTEM.id}.`) && !UNLOGGED_SETTINGS.has(key));
}

/** A deleted document bigger than this (characters of JSON) is logged without its data. */
export const MAX_DELETED_DATA = 200_000;
/** After an undo, another undo click within this many milliseconds is ignored (a double-click). */
export const UNDO_COOLDOWN_MS = 600;
/** The stored log stays under this many characters. */
export const MAX_STORED = 600_000;

/** Only token moves / turns in this change? */
export function onlyMoves(changed: Record<string, unknown>): boolean {
  const keys = Object.keys(changed ?? {});
  return keys.length > 0 && keys.every((k) => MOVE_KEYS.has(k));
}

/**
 * The "before" values filed for this document in the options, by uuid (an unlinked token's actor
 * shares its base actor's id, never its uuid). Foundry v14 fires preUpdateActor for an unlinked
 * token's actor itself; preUpdateActorDelta files under the same actor uuid.
 */
function filedFields(options: any, doc: any): FieldChange[] | undefined {
  return options?.sr2eUndo?.[String(doc?.uuid ?? '')];
}

/** A document's name as the log shows it. */
export function nameOf(doc: any): string {
  const n = doc?.documentName;
  if (n === 'ChatMessage') return cardTitle(String(doc.content ?? ''), String(doc.flavor ?? '')) || tx('SR2E.App.Undo.chatMessage');
  if (n === 'Setting') return doc.key === 'core.time' ? tx('SR2E.App.Undo.worldTime') : String(doc.key ?? 'setting').replace(`${SYSTEM.id}.`, '');
  if (n === 'Wall') return `Wall ${doc.id}`;
  if (n === 'Combat') return 'Combat';
  if (n === 'Drawing') return String(doc.text || doc.getFlag?.(SYSTEM.id, 'fuel') || `Drawing ${doc.id}`);
  if (n === 'Region') return String(doc.name || `Region ${doc.id}`);
  return String(doc?.name ?? doc?.id ?? '');
}

/** Plain chat: no system flags and no dice (typed chat, not a game change). */
export const isPlainChat = (msg: any): boolean => !msg?.flags?.[SYSTEM.id] && !(msg?.rolls?.length);

/** The source a change is compared against (a setting is just its stored value). */
const sourceOf = (doc: any): any => (doc?.documentName === 'Setting' ? { value: doc._source?.value } : doc?._source);

/** Documents that live on a scene's canvas (Foundry keeps its own per-layer undo history for them). */
const PLACEABLES = new Set(['Token', 'Wall', 'Drawing', 'MeasuredTemplate', 'AmbientLight', 'AmbientSound', 'Tile', 'Note', 'Region']);

/** The canvas layers that keep an undo history. */
function historyLayers(): any[] {
  const c: any = (globalThis as any).canvas;
  const list: any[] = Array.isArray(c?.layers) ? c.layers : Object.values(c?.layers ?? {});
  return list.filter((l: any) => Array.isArray(l?.history));
}

/** When the active layer's newest history entry was made (null: none). */
function canvasNewest(): number | null {
  const layer: any = (globalThis as any).canvas?.activeLayer;
  const h: any[] | undefined = layer?.history;
  if (!Array.isArray(h) || !h.length) return null;
  return Number(h.at(-1)?._sr2eAt ?? 0);
}

export class SR2Undo {
  static log: UndoStep[] = [];
  static #undoing = 0;
  static #loaded = false;
  /** This client's own changes until then follow from an undo (vision syncs, time hooks) and aren't logged. */
  static #quietUntil = 0;
  static #saveTimer: ReturnType<typeof setTimeout> | null = null;

  /** True while this client is undoing, or just after (its own changes aren't logged). */
  static get undoing(): boolean { return SR2Undo.#undoing > 0 || Date.now() < SR2Undo.#quietUntil; }

  static #storageKey(): string { return `${SYSTEM.id}.undo.${(game as any).world?.id ?? 'world'}.${game.user?.id ?? 'gm'}`; }

  static load(): void {
    if (SR2Undo.#loaded) return;
    SR2Undo.#loaded = true;
    try { SR2Undo.log = sanitizeLog(JSON.parse(globalThis.localStorage?.getItem(SR2Undo.#storageKey()) ?? '[]')); } catch { SR2Undo.log = []; }
  }

  static #save(): void {
    if (SR2Undo.#saveTimer) clearTimeout(SR2Undo.#saveTimer);
    SR2Undo.#saveTimer = setTimeout(() => {
      SR2Undo.#saveTimer = null;
      try {
        // Stay well inside the browser's storage (Foundry's own client settings share it): keep the
        // newest steps that fit, measuring each once.
        const keep: UndoStep[] = [];
        let size = 2;
        for (const st of [...SR2Undo.log].sort((a, b) => b.last - a.last)) {
          const n = JSON.stringify(st).length + 1;
          if (keep.length && size + n > MAX_STORED) break;
          keep.push(st);
          size += n;
        }
        if (keep.length < SR2Undo.log.length) SR2Undo.log = SR2Undo.log.filter((x) => keep.includes(x));
        globalThis.localStorage?.setItem(SR2Undo.#storageKey(), JSON.stringify(SR2Undo.log));
      } catch { /* storage full or blocked: the log still works until reload */ }
    }, 400);
  }

  static #changed(): void {
    SR2Undo.#save();
    try { Hooks.callAll(`${SYSTEM.id}.undoChanged`); } catch { /* no hooks */ }
  }

  /** Add one change (GM clients). */
  static record(entry: UndoEntry, userId: string, now = Date.now()): UndoStep | null {
    SR2Undo.load();
    const user: any = (game as any).users?.get?.(userId);
    const step = logChange(SR2Undo.log, entry, { userId, userName: String(user?.name ?? 'someone') }, now, () => (foundry as any).utils.randomID());
    if (step) SR2Undo.#changed();
    return step;
  }

  static newest(): UndoStep | null { SR2Undo.load(); return newestStep(SR2Undo.log); }

  /** v0.81.1 (SEC1-15): this user's own newest step (Ctrl+Z takes it; a player's step never takes the GM's key). */
  static newestOwn(userId: string = String(game.user?.id ?? '')): UndoStep | null {
    SR2Undo.load();
    return newestStep(SR2Undo.log.filter((s) => s.userId === userId));
  }

  /** Steps, newest first. */
  static steps(): UndoStep[] { SR2Undo.load(); return [...SR2Undo.log].sort((a, b) => b.last - a.last); }

  /** Foundry's own canvas undo put this back: drop the log's matching entry (no double undo). */
  static forget(op: 'update' | 'create' | 'delete', uuid: string, paths: string[] = []): boolean {
    SR2Undo.load();
    const dropped = forgetMatch(SR2Undo.log, op, uuid, paths);
    if (dropped) SR2Undo.#changed();
    return dropped;
  }

  /**
   * Ctrl+Z (GM): undo whichever came last, the newest step here or the active canvas layer's newest
   * history entry. Returns 'sr2e' when it took a step here (the key is handled), 'canvas' when
   * Foundry's own canvas undo should run, null when there is nothing to undo here or there.
   */
  static ctrlZ(): 'sr2e' | 'canvas' | null {
    if (!game.user?.isGM) return 'canvas';
    if (SR2Undo.#busy) return 'sr2e';
    // v0.81.1 (SEC1-15): the GM's own newest step (a player's edit landing just then isn't undone instead; the
    // panel still undoes anyone's).
    const choice = pickUndo(SR2Undo.newestOwn()?.last ?? null, canvasNewest());
    if (choice === 'sr2e') void SR2Undo.undoLast({ mine: true });
    return choice;
  }

  /** Tests: end the quiet spell after an undo. */
  static endQuiet(): void { SR2Undo.#quietUntil = 0; SR2Undo.#cooldownUntil = 0; }

  static clear(): void { SR2Undo.#loaded = true; SR2Undo.log = []; SR2Undo.#changed(); }

  /** What would get in the way of undoing a step (fields changed since, documents gone). */
  static async problems(step: UndoStep): Promise<string[]> {
    const out: string[] = [];
    for (const { entry: e, fields, checkGone, checkParent } of stepChecks(step)) {
      if (e.op === 'update') {
        if (!checkGone) continue;
        const doc: any = await fromUuid(e.uuid).catch(() => null);
        if (!doc) { out.push(tx('SR2E.App.Undo.isGoneCantBePutBack', { name: e.name || e.docName, entry: describeEntry(e) })); continue; }
        const c = changedSince(sourceOf(doc), fields);
        if (c.length) out.push(tx('SR2E.App.Undo.changedSince', { name: e.name || e.docName, fields: c.map((f) => fieldLabel(f.path)).join(', ') }));
      } else if (e.op === 'delete') {
        if (!e.data) out.push(tx('SR2E.App.Undo.wasTooBigToKeep', { name: e.name || e.docName }));
        else if (checkParent && !(await fromUuid(String(e.parentUuid)).catch(() => null))) out.push(tx('SR2E.App.Undo.cantComeBackWhatHeldIt', { name: e.name || e.docName, parentUuid: e.parentUuid }));
      }
    }
    if (step.partial) out.push(tx('SR2E.App.Undo.thisStepGrewPast', { maxEntries: RULES.GM_TOOLS.undo.maxEntries }));
    return out;
  }

  /**
   * Undo the newest step. Asks first when something changed since (unless `force`). Returns what
   * happened, or null when nothing was undone.
   */
  static async undoLast(opts: { force?: boolean; quiet?: boolean; chain?: boolean; mine?: boolean } = {}): Promise<{ label: string; done: number; failed: string[] } | null> {
    if (!game.user?.isGM) { ui.notifications?.warn?.(tx('SR2E.Notify.Undo.onlyAGmCanUndo')); return null; }
    // One undo at a time: a second click while one runs (or its dialog is open) does nothing, and
    // nor does one just after (a double-click, a held key); `chain` (Undo to here) skips the pause.
    if (SR2Undo.#busy || (!opts.chain && Date.now() < SR2Undo.#cooldownUntil)) return null;
    SR2Undo.#busy = true;
    try {
      const r = await SR2Undo.#undoNewest(opts);
      if (r) SR2Undo.#cooldownUntil = Date.now() + UNDO_COOLDOWN_MS;
      return r;
    } finally { SR2Undo.#busy = false; }
  }

  static #cooldownUntil = 0;

  static #busy = false;
  static get busy(): boolean { return SR2Undo.#busy; }

  static async #undoNewest(opts: { force?: boolean; quiet?: boolean; mine?: boolean }): Promise<{ label: string; done: number; failed: string[] } | null> {
    const step = opts.mine ? SR2Undo.newestOwn() : SR2Undo.newest();
    if (!step) { if (!opts.quiet) ui.notifications?.info?.(tx('SR2E.Notify.Undo.nothingToUndo')); return null; }
    const problems = await SR2Undo.problems(step);
    if (problems.length && !opts.force) {
      const esc = escHtml;
      const ok = await foundry.applications.api.DialogV2.confirm({
        window: { title: tx('SR2E.Dialog.Undo.undoAnyway') },
        content: `<p>${tx('SR2E.Dialog.Undo.undo')} <strong>${esc(step.label)}</strong> (${esc(step.userName)})?</p><ul>${problems.map((p) => `<li>${esc(p)}</li>`).join('')}</ul><p class="hint">${tx('SR2E.Dialog.Undo.undoAnywayPutsTheLoggedValues')}</p>`,
        rejectClose: false,
      });
      if (!ok) return null;
    }
    const failed: string[] = [];
    let done = 0;
    // Foundry's canvas history: what the undo itself adds to it, and the entries for what it puts back, go.
    const layers = historyLayers();
    const before = new Map(layers.map((l: any) => [l, new Set(l.history)]));
    const viewed = (globalThis as any).canvas?.scene?.id;
    const ids = new Set(step.entries.filter((e) => PLACEABLES.has(e.docName) && viewed && e.uuid.startsWith(`Scene.${viewed}.`)).map((e) => e.uuid.split('.').at(-1) ?? ''));
    SR2Undo.#undoing++;
    try {
      for (const e of [...step.entries].reverse()) {
        try { if (await SR2Undo.#revert(e)) done++; } catch (err) { console.warn('sr2e | undo', e, err); failed.push(describeEntry(e)); }
      }
    } finally {
      for (const l of layers) {
        try {
          const keep = purgeHistory(l.history.filter((h: any) => before.get(l)?.has(h)), ids);
          l.history.splice(0, l.history.length, ...keep);
        } catch { /* not a history we know */ }
      }
      SR2Undo.#undoing--;
      // What the undo sets off on this client (vision syncs, world-time hooks) isn't a new step.
      SR2Undo.#quietUntil = Date.now() + 1500;
    }
    const i = SR2Undo.log.indexOf(step);
    if (i >= 0) SR2Undo.log.splice(i, 1);
    SR2Undo.#changed();
    if (!opts.quiet) {
      if (failed.length) ui.notifications?.warn?.(tx('SR2E.Notify.Undo.undoneWithProblemsNotPutBack', { stepLabel: escHtml(step.label), failed: escHtml(failed.join('; ')) }));
      else ui.notifications?.info?.(tx('SR2E.Notify.Undo.undone', { stepLabel: escHtml(step.label) }));
    }
    return { label: step.label, done, failed };
  }

  /** Put one change back. */
  static async #revert(e: UndoEntry): Promise<boolean> {
    const opts = { sr2eUndoing: true };
    if (e.op === 'update') {
      const doc: any = await fromUuid(e.uuid);
      if (!doc) throw new Error('gone');
      if (e.settingKey === 'core.time') {
        const f = e.fields?.find((x) => x.path === 'value');
        const before = Number(JSON.parse(String(f?.before ?? '0')));
        const now = Number((game as any).time?.worldTime ?? 0);
        if (Number.isFinite(before) && before !== now) await (game as any).time.advance(before - now);
        return true;
      }
      // v0.75.0: on an unlinked token's actor a removed flag is written as null (a `-=` stays on open clients).
      const inv = deltaSafeUpdate(doc, inverseUpdate(e.fields ?? []));
      if (!Object.keys(inv).length) return false;
      await doc.update(inv, opts);
      return true;
    }
    if (e.op === 'create' && e.docName === 'Setting') {
      // A setting saved for the first time: put back its default (deleting the document wouldn't tell anyone).
      if (e.settingKey === 'core.time') {
        const now = Number((game as any).time?.worldTime ?? 0);
        if (now) await (game as any).time.advance(-now);
        return true;
      }
      const key = String(e.settingKey ?? '');
      const cfg: any = (game as any).settings?.settings?.get?.(key);
      if (!cfg) return false;
      const dot = key.indexOf('.');
      await game.settings.set(key.slice(0, dot) as any, key.slice(dot + 1) as any, (foundry as any).utils.deepClone?.(cfg.default) ?? cfg.default);
      return true;
    }
    if (e.op === 'create') {
      const doc: any = await fromUuid(e.uuid).catch(() => null);
      if (!doc) return false;
      await doc.delete(opts);
      return true;
    }
    // A deletion: create it again with its old id.
    const data: any = e.data;
    const cls: any = (foundry as any).utils.getDocumentClass?.(e.docName) ?? (globalThis as any)[e.docName];
    if (!cls || !data) throw new Error('no data');
    const parent: any = e.parentUuid ? await fromUuid(e.parentUuid) : null;
    if (e.parentUuid && !parent) throw new Error('parent gone');
    const exists = parent ? parent.getEmbeddedDocument?.(e.docName, data._id) : (game as any).collections?.get?.(e.docName)?.get?.(data._id);
    if (exists) return false;
    // An unlinked token's actor: deleting one of its base actor's items left a tombstone in the
    // token's ActorDelta; removing the tombstone brings the item back.
    const delta: any = parent?.isToken ? parent.token?.delta : null;
    const tomb: any = delta?.collections?.[e.docName === 'ActiveEffect' ? 'effects' : 'items']?.get?.(data._id, { strict: false });
    if (tomb && (tomb._tombstone || tomb.isTombstone || tomb._source?._tombstone)) {
      await delta.deleteEmbeddedDocuments(e.docName, [data._id], opts);
      return true;
    }
    await cls.create(data, { ...opts, keepId: true, ...(parent ? { parent } : {}) });
    return true;
  }
}

// ---------------------------------------------------------------- Hooks

/** Before a change, on the client making it: note the fields' values in the options. */
function stash(doc: any, changes: any, options: any, key: string, source: any): void {
  if (!options || options.sr2eUndoing || SR2Undo.undoing || doc?.pack) return;
  if (doc?.documentName === 'Setting' && !loggedSetting(String(doc.key ?? ''))) return;
  // Moves aren't logged, so their old values (and movement history) needn't travel with every drag.
  if (doc?.documentName === 'Token' && RULES.GM_TOOLS.undo.skipTokenMoves && onlyMoves(changes)) return;
  try {
    let fields: FieldChange[] = beforeValues(source, changes, { recursive: options.recursive });
    // A setting is only its value (its key comes along in the update).
    if (doc?.documentName === 'Setting') fields = fields.filter((f) => f.path === 'value');
    if (!fields.length) return;
    options.sr2eUndo ??= {};
    options.sr2eUndo[key] = fields;
  } catch (err) { console.warn('sr2e | undo: could not note the change', err); }
}

/** GM clients log; an undo's own changes (flagged) and what this client sets off just after one aren't logged. Other users' changes always are. */
const gmLogs = (options: any, doc: any, userId: string): boolean => Boolean(game.user?.isGM) && !options?.sr2eUndoing && !doc?.pack
  && !(userId === game.user?.id && SR2Undo.undoing) && !options?.isUndo;

/** Foundry's own (canvas) undo: not a new step, and the log forgets what it put back. */
function coreUndo(options: any, doc: any, op: 'update' | 'create' | 'delete', paths: string[] = []): void {
  if (!options?.isUndo || !game.user?.isGM || doc?.pack) return;
  SR2Undo.forget(op, String(doc.uuid), paths);
}

export function registerUndoHooks(): void {
  // v0.73.0 (O39): Regions too; whether they are followed is read each time (RULES.CROSSCUT_V73.undo.regions).
  const follows = (name: string): boolean => (undoDocsV73(LOGGED_DOCS) as readonly string[]).includes(name);
  for (const name of [...LOGGED_DOCS, 'Region'] as string[]) {
    Hooks.on(`preUpdate${name}`, (doc: any, changes: any, options: any) => { if (follows(name)) stash(doc, changes, options, String(doc.uuid), sourceOf(doc)); });
    Hooks.on(`update${name}`, (doc: any, changed: any, options: any, userId: string) => {
      coreUndo(options, doc, 'update', changePaths(changed));
      if (!follows(name) || !gmLogs(options, doc, userId)) return;
      if (name === 'Setting' && !loggedSetting(String(doc.key ?? ''))) return;
      if (name === 'Token' && RULES.GM_TOOLS.undo.skipTokenMoves && onlyMoves(changed)) return;
      // v0.81.0 (A-5, SEC1-9): the "before" values come from the changing client's options (a player's, for their
      // own documents): keep only the fields the server really changed, never ownership or Foundry's bookkeeping.
      const filed = filedFields(options, doc);
      const fields = Array.isArray(filed) ? undoFieldsToKeep(filed, changed) : [];
      if (!fields.length) return;
      // Only the fields that really changed (an update re-sending the same value isn't one).
      const after = afterValues(sourceOf(doc), fields)
        .filter((f) => f.had !== f.hadAfter || JSON.stringify(f.before ?? null) !== JSON.stringify(f.after ?? null));
      if (!after.length) return;
      SR2Undo.record({ op: 'update', docName: name, uuid: String(doc.uuid), name: nameOf(doc), fields: after,
        ...(name === 'Setting' ? { settingKey: String(doc.key) } : {}) }, userId);
    });
    Hooks.on(`create${name}`, (doc: any, options: any, userId: string) => {
      coreUndo(options, doc, 'delete');
      if (!follows(name) || !gmLogs(options, doc, userId)) return;
      if (name === 'Setting' && !loggedSetting(String(doc.key ?? ''))) return;
      SR2Undo.record({ op: 'create', docName: name, uuid: String(doc.uuid), name: nameOf(doc),
        ...(name === 'ChatMessage' && isPlainChat(doc) ? { plainChat: true } : {}),
        ...(name === 'Setting' ? { settingKey: String(doc.key) } : {}) }, userId);
    });
    Hooks.on(`delete${name}`, (doc: any, options: any, userId: string) => {
      coreUndo(options, doc, 'create');
      if (!follows(name) || !gmLogs(options, doc, userId) || undoSkipsChange(name, 'delete', options)) return;
      if (name === 'Setting' && !loggedSetting(String(doc.key ?? ''))) return;
      let data: unknown = null;
      try { data = doc.toObject(); if (JSON.stringify(data).length > MAX_DELETED_DATA) data = null; } catch { data = null; }
      SR2Undo.record({ op: 'delete', docName: name, uuid: String(doc.uuid), name: nameOf(doc), parentUuid: doc.parent?.uuid ?? null, data }, userId);
    });
  }
  // An unlinked token's actor changes through its ActorDelta; Foundry then calls updateActor (above).
  Hooks.on('preUpdateActorDelta', (delta: any, changes: any, options: any) => {
    const actor = delta?.parent?.actor;
    if (actor) stash(actor, changes, options, String(actor.uuid), actor._source);
  });
  Hooks.once('ready', () => { if (game.user?.isGM) SR2Undo.load(); });
  stampCanvasHistory();
}

/** Each entry in Foundry's canvas undo history gets the time it was made (for Ctrl+Z's newest-first choice). */
export function stampCanvasHistory(): void {
  const proto: any = (globalThis as any).foundry?.canvas?.layers?.PlaceablesLayer?.prototype;
  if (!proto || typeof proto._storeHistory !== 'function' || proto._sr2eStamped) return;
  const original = proto._storeHistory;
  proto._storeHistory = function (this: any, ...args: any[]) {
    const r = original.apply(this, args);
    try { const e = this.history?.at?.(-1); if (e && e._sr2eAt === undefined) e._sr2eAt = Date.now(); } catch { /* no history */ }
    return r;
  };
  proto._sr2eStamped = true;
}

/** Ctrl+Shift+Z: undo the newest step (GM). */
export function registerUndoKeybinding(): void {
  try {
    (game as any).keybindings?.register?.(SYSTEM.id, 'undo', {
      name: 'SR2E.Keybindings.Undo.Name',
      hint: 'SR2E.Keybindings.Undo.Hint',
      editable: [{ key: 'KeyZ', modifiers: ['Control', 'Shift'] }],
      restricted: true,
      onDown: () => { void SR2Undo.undoLast(); return true; },
    });
    // Ctrl+Z (GM): newest first across Foundry's canvas history and this log. Runs before Foundry's
    // own Undo; when the canvas entry is newer it returns false and Foundry's undo runs as usual.
    (game as any).keybindings?.register?.(SYSTEM.id, 'undoNewest', {
      name: 'SR2E.Keybindings.UndoNewest.Name',
      hint: 'SR2E.Keybindings.UndoNewest.Hint',
      editable: [{ key: 'KeyZ', modifiers: ['Control'] }],
      restricted: true,
      precedence: (globalThis as any).CONST?.KEYBINDING_PRECEDENCE?.PRIORITY ?? 0,
      onDown: () => SR2Undo.ctrlZ() === 'sr2e',
    });
  } catch (err) { console.warn('sr2e | undo keybinding', err); }
}
