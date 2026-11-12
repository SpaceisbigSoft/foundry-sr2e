/**
 * v0.92.3: the "rules changes" notice. On the first load after the update the lead GM gets one whispered card listing
 * the actors whose numbers change because v0.92.3 made the books' rules the default, grouped by reason, each with the
 * house rule that puts the v0.92.2 way back. It changes no data: derived values are worked out twice, once as the rules
 * now stand and once with that reason's switches at their v0.92.2 choice (the actor's derived data is prepared again
 * afterwards), and the rest are simple predicates.
 */
import { RULES } from './rules/index.ts';
import { escHtml } from './rules/html.ts';
import { t as tx, tKey } from './helpers/i18n.ts';

/** A reason the notice lists actors under. */
export type Notice923Id = 'racialMods' | 'magicFromEssence' | 'essence' | 'status' | 'bodyIndex' | 'load' | 'threat' | 'karmaPool' | 'creation' | 'notReady' | 'shotgun';

/** The reasons in the order the card lists them, each with the house rules (path → their v0.92.2 value) that restore it. */
export const NOTICE923_REASONS: ReadonlyArray<{ id: Notice923Id; restore: Readonly<Record<string, unknown>> }> = [
  { id: 'racialMods', restore: { 'CORE_V923.racialMods': 'old' } },
  { id: 'magicFromEssence', restore: { 'SORCERY_V923.magicFromEssence': 'v922' } },
  { id: 'essence', restore: { 'GEAR_V923.limbHoused': 'capacity', 'GEAR_V923.awakenedBioware': 'magic', 'GEAR_V923.grades': 'old' } },
  { id: 'status', restore: { 'HEALTH_V923.death': 'total', 'GEAR_V923.essenceZero': 'dead' } },
  { id: 'bodyIndex', restore: { 'HEALTH_V72.qualities.sensitiveSystem.bodyIndexMultiplier': 1 } },
  { id: 'load', restore: { 'GEAR_V923.load': 'old' } },
  { id: 'threat', restore: { 'CORE_V923.threat': 'pool' } },
  { id: 'karmaPool', restore: { 'UPKEEP.karma.poolEvery.human': 10, 'UPKEEP.karma.poolEvery.metahuman': 20 } },
  { id: 'creation', restore: { 'CORE_V923.priorities': 'old' } },
  { id: 'notReady', restore: { 'COMBAT.ready.rule': 'off' } },
  { id: 'shotgun', restore: { 'COMBAT_V923.shotgun': 'old' } },
];

const restoreOf = (id: Notice923Id) => NOTICE923_REASONS.find((r) => r.id === id)!.restore;

/** A RULES path's value (undefined when there is none). */
function getRule(path: string): unknown {
  let o: any = RULES;
  for (const k of path.split('.')) { if (o == null || typeof o !== 'object') return undefined; o = o[k]; }
  return o;
}

/**
 * Run `fn` (synchronous) with these RULES paths set, and put every one back afterwards (also when `fn` throws). Paths
 * that don't exist are left alone.
 */
export function withRulesPatch<T>(patch: Readonly<Record<string, unknown>>, fn: () => T): T {
  const saved: Array<[any, string, unknown]> = [];
  try {
    for (const [path, value] of Object.entries(patch)) {
      const keys = path.split('.');
      let o: any = RULES;
      for (const k of keys.slice(0, -1)) o = o?.[k];
      const last = keys[keys.length - 1]!;
      if (!o || typeof o !== 'object' || !(last in o)) continue;
      saved.push([o, last, o[last]]);
      o[last] = value;
    }
    return fn();
  } finally {
    for (const [o, k, v] of saved.reverse()) o[k] = v;
  }
}

/** Whether every path of a patch already has that value (the world plays that way already: nothing changed). */
export function patchIsCurrent(patch: Readonly<Record<string, unknown>>): boolean {
  return Object.entries(patch).every(([p, v]) => getRule(p) === undefined || getRule(p) === v);
}

/** Pure: the Karma Pool points career Karma gives at one rate and at another (every N, rounded down). */
export function karmaPoolByCareer(career: number, every: number): number {
  const e = Math.max(1, Math.floor(Number(every) || 1));
  return Math.floor(Math.max(0, Number(career) || 0) / e);
}

/** What the notice reads from an actor's derived data (after prepareDerivedData under some rules). */
interface Snap { quickness: number; willpower: number; magic: number; essence: number; status: string; bodyIndex: number; load: string }

function snapOf(a: any): Snap {
  const s = a?.system ?? {};
  return {
    quickness: Number(s.attributes?.quickness?.total ?? 0), willpower: Number(s.attributes?.willpower?.total ?? 0),
    magic: Number(s.derived?.magic ?? 0), essence: Math.round(Number(s.derived?.essence ?? 0) * 100) / 100, status: String(s.derived?.status ?? ''),
    bodyIndex: Math.round(Number(s.derived?.bodyIndex?.used ?? 0) * 100) / 100,
    load: JSON.stringify([s.derived?.load?.penalty ?? 0, s.derived?.load?.boxes ?? 0, s.derived?.movement?.walk ?? 0, s.derived?.movement?.run ?? 0, Number(s.attributes?.quickness?.total ?? 0)]),
  };
}

/**
 * An actor's values under a patch of the rules: its derived data is prepared with the patch in force, read, and prepared
 * again as the rules stand (nothing is saved). Null when it can't be worked out.
 */
function snapUnder(a: any, patch: Readonly<Record<string, unknown>>): Snap | null {
  const prep = a?.system?.prepareDerivedData;
  if (typeof prep !== 'function') return null;
  try {
    return withRulesPatch(patch, () => { prep.call(a.system); return snapOf(a); });
  } catch {
    return null;
  } finally {
    try { prep.call(a.system); } catch { /* as it was */ }
  }
}

/** A weapon item that is a shotgun loaded with something other than shot (now fires slugs, Core p. 95). */
function shotgunNotShot(i: any): boolean {
  return i?.type === 'weapon' && Boolean(i.system?.shotgun) && String(i.system?.ammoType ?? '') !== String(RULES.URR_V80?.cbtShotAmmo ?? 'shot');
}

/**
 * The actors the notice lists, by reason (names only, in the order given; an actor named once per reason). `actors` are
 * the world's actors and the unlinked tokens' (migrations.ts everyActor); `inCreation` tells a character whose creation
 * wizard is still open. Reads only; the derived data it prepares again is as it was afterwards.
 */
export function collectNotice923(actors: readonly any[], o: { inCreation?: (a: any) => boolean } = {}): Array<{ id: Notice923Id; names: string[] }> {
  const by = new Map<Notice923Id, string[]>();
  const add = (id: Notice923Id, a: any) => {
    const n = String(a?.name ?? '').trim() || '?';
    const list = by.get(id) ?? [];
    if (!list.includes(n)) list.push(n);
    by.set(id, list);
  };
  const live = (id: Notice923Id) => !patchIsCurrent(restoreOf(id));
  const allOld = Object.assign({}, ...NOTICE923_REASONS.filter((r) => ['racialMods', 'magicFromEssence', 'essence', 'status'].includes(r.id)).map((r) => r.restore));
  const urrPerAward = (RULES as any).URR_V80?.coreKarmaGrowth === 'perAward';
  for (const a of actors ?? []) {
    if (!a || !['character', 'npc'].includes(String(a.type))) continue;
    const s: any = a.system ?? {};
    // Prepared again as the rules stand now (the stored derived data may predate the world's house rules).
    const now = snapUnder(a, {}) ?? snapOf(a);
    if (live('racialMods')) {
      const old = snapUnder(a, restoreOf('racialMods'));
      if (old && (old.quickness !== now.quickness || old.willpower !== now.willpower)) add('racialMods', a);
    }
    if (live('magicFromEssence') && Number(s.magic ?? 0) > 0) {
      const old = snapUnder(a, restoreOf('magicFromEssence'));
      if (old && old.magic !== now.magic) add('magicFromEssence', a);
    }
    if (live('essence')) {
      const old = snapUnder(a, restoreOf('essence'));
      if (old && old.essence !== now.essence) add('essence', a);
    }
    if (live('bodyIndex')) {
      const old = snapUnder(a, restoreOf('bodyIndex'));
      if (old && old.bodyIndex !== now.bodyIndex) add('bodyIndex', a);
    }
    if (live('load')) {
      const old = snapUnder(a, restoreOf('load'));
      if (old && old.load !== now.load) add('load', a);
    }
    // Death past the natural Body, Essence 0 survivable, and any Essence change above: the status as v0.92.2 had it.
    const oldAll = snapUnder(a, allOld);
    if (oldAll && oldAll.status !== now.status) add('status', a);
    if (live('threat') && a.type === 'npc' && Number(s.threatRating ?? 0) > 0) add('threat', a);
    if (live('karmaPool') && !urrPerAward && a.type === 'character') {
      const meta = String(s.metatype ?? 'human') !== 'human';
      const r = restoreOf('karmaPool');
      const oldEvery = Number(meta ? r['UPKEEP.karma.poolEvery.metahuman'] : r['UPKEEP.karma.poolEvery.human']);
      const newEvery = Number(meta ? getRule('UPKEEP.karma.poolEvery.metahuman') : getRule('UPKEEP.karma.poolEvery.human'));
      const career = Number(s.karma?.career ?? 0);
      if (karmaPoolByCareer(career, oldEvery) !== karmaPoolByCareer(career, newEvery)) add('karmaPool', a);
    }
    if (live('creation') && o.inCreation?.(a)) add('creation', a);
    const items: any[] = [...(a.items ?? [])];
    if (live('notReady') && items.some((i: any) => i?.type === 'weapon' && i.system?.ready === false && i.system?.carried !== false)) add('notReady', a);
    if (live('shotgun') && !(RULES as any).URR_V80?.active && items.some(shotgunNotShot)) add('shotgun', a);
  }
  return NOTICE923_REASONS.filter((r) => by.get(r.id)?.length).map((r) => ({ id: r.id, names: by.get(r.id)! }));
}

/** Each reason's line on the card (literal keys, so the language-file checks find them). */
const REASON_KEYS: Readonly<Record<Notice923Id, string>> = {
  racialMods: 'SR2E.Card.Notice923.racialMods', magicFromEssence: 'SR2E.Card.Notice923.magicFromEssence', essence: 'SR2E.Card.Notice923.essence',
  status: 'SR2E.Card.Notice923.status', bodyIndex: 'SR2E.Card.Notice923.bodyIndex', load: 'SR2E.Card.Notice923.load', threat: 'SR2E.Card.Notice923.threat', karmaPool: 'SR2E.Card.Notice923.karmaPool',
  creation: 'SR2E.Card.Notice923.creation', notReady: 'SR2E.Card.Notice923.notReady', shotgun: 'SR2E.Card.Notice923.shotgun',
};

/** At most this many names in a row; the rest are counted. */
const NAMES_SHOWN = 25;

/** The house rules that put a reason's v0.92.2 way back, as the card names them (the house-rule labels, escaped). */
function restoreText(id: Notice923Id): string {
  return Object.entries(restoreOf(id)).map(([p, v]) => {
    const label = tKey(`SR2E.HouseRules.Rule.${p.replace(/\./g, '__')}`);
    return `${escHtml(label)} → <code>${escHtml(String(v))}</code>`;
  }).join('; ');
}

/** Pure (given the language file): the card's HTML for the groups ('' when there are none). Every value is escaped. */
export function notice923Html(groups: ReadonlyArray<{ id: Notice923Id; names: readonly string[] }>): string {
  const rows = groups.filter((g) => g.names.length).map((g) => {
    const shown = g.names.slice(0, NAMES_SHOWN).map((n) => escHtml(n)).join(', ');
    const more = g.names.length > NAMES_SHOWN ? ` ${tx('SR2E.Card.Notice923.more', { count: g.names.length - NAMES_SHOWN })}` : '';
    return `<li><strong>${escHtml(tKey(REASON_KEYS[g.id]))}</strong> ${shown}${more}<br><em>${tx('SR2E.Card.Notice923.restore', { rules: restoreText(g.id) })}</em></li>`;
  });
  if (!rows.length) return '';
  return `<div class="sr2e-notice923"><p><strong>${tx('SR2E.Card.Notice923.title')}</strong> ${tx('SR2E.Card.Notice923.lead')}</p><ul>${rows.join('')}</ul><p>${tx('SR2E.Card.Notice923.after')}</p></div>`;
}
