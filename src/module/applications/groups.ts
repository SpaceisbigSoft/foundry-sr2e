/** Pure helpers for the GM panel and token drops (v0.41.0), importable without Foundry's UI classes. */
import { isCarried } from '../rules/tweaks.ts';
import { monitorView } from '../rules/look.ts';
import { mookLine, type MookLine } from '../rules/gmdash.ts';
import { t as tx, tCount } from '../helpers/i18n.ts';

/**
 * v0.81.1 (SEC2b-1, design 8): the most Overflow boxes a panel builds, one element each. Body comes from the actor (a
 * player writes their own, with no maximum in the schema): 3,000,000 froze the GM's tab, 2^32 threw in the panel.
 */
export const MAX_OVERFLOW_BODY = 50;

/** The Body an actor's Overflow is drawn from, clamped to 0..MAX_OVERFLOW_BODY (for the GM panel and wound groups). */
export function overflowBody(sys: any): number {
  const n = Math.floor(Number(sys?.derived?.vitals?.overflowBody ?? sys?.attributes?.body?.total ?? 0));
  return Number.isFinite(n) ? Math.max(0, Math.min(MAX_OVERFLOW_BODY, n)) : 0;
}

/** What a dropped item does on a token: a weapon attacks it, a spell or power targets it. Null = not ours. */
export function dropAction(itemType: string): 'attack' | 'cast' | 'power' | null {
  return itemType === 'weapon' ? 'attack' : itemType === 'spell' ? 'cast' : itemType === 'power' ? 'power' : null;
}

/** Actors for a group roll or group damage: the selected tokens, the scene's NPC tokens, or the party. */
export function groupActors(who: string): any[] {
  if (who === 'party') return [...((game as any).actors ?? [])].filter((a: any) => a.type === 'character' && a.hasPlayerOwner);
  const tokens = who === 'selected'
    ? [...((canvas as any)?.tokens?.controlled ?? [])]
    : [...((canvas as any)?.tokens?.placeables ?? [])].filter((t: any) => t.actor && !t.actor.hasPlayerOwner && ['npc', 'character', 'spirit'].includes(t.actor.type) && !t.actor.flags?.['item-piles']?.data?.enabled);
  const seen = new Set<string>();
  return tokens.map((t: any) => t.actor).filter((a: any) => a && !seen.has(a.uuid) && (seen.add(a.uuid), true));
}


/** Whether a token stands for this actor: its own token, linked or not (an unlinked token's actor is a copy). */
export function tokenIsActor(token: any, actor: any): boolean {
  if (!token || !actor) return false;
  const doc = token.document ?? token;
  if (token.actor?.uuid && token.actor.uuid === actor.uuid) return true;
  const baseId = actor.isToken ? actor.token?.actorId ?? actor.id : actor.id;
  return Boolean(doc.actorId && doc.actorId === baseId);
}

// ---------------------------------------------------------------- v0.51.0: GM panel rows

const PEOPLE_TYPES = ['character', 'npc', 'spirit'];

/** The pools line for the GM panel ("Combat 3/7 · Karma 1/2"). */
export function poolsLine(a: any): string {
  const d = a?.system?.derived ?? {};
  return [['Combat', d.combatPoolLeft, d.combatPool], ['Spell', d.spellPoolLeft, d.spellPool], ['Hacking', d.hackingPoolLeft, d.hackingPool],
    ['Control', d.controlPoolLeft, d.controlPool], ['Karma', d.karmaPoolLeft, a?.system?.karma?.pool]]
    .filter(([, , max]) => Number(max) > 0).map(([n, left, max]) => `${n} ${left ?? 0}/${max}`).join(' · ');
}

/** v0.68.0: what someone is doing in the combat, as chip words (delaying, acting now, full defense, broken). */
export function combatChips(a: any): string[] {
  const chips: string[] = [];
  try {
    if (a?.isDelaying?.()) chips.push('delaying');
    if (a?.actingNow?.()) chips.push('acting now');
    if (a?.fullDefenseUp?.()) chips.push('full defense');
    if (a?.isBroken?.()) chips.push('broken');
  } catch { /* no combat */ }
  return chips;
}

/** v0.68.0: the status effects on an actor by name (Foundry's status list), for the party cards. */
export function statusNames(a: any): string[] {
  try {
    const ids = [...(a?.statuses ?? [])].map(String);
    if (!ids.length) return [];
    const list: any[] = [...(((globalThis as any).CONFIG?.statusEffects) ?? [])];
    const i18n = (globalThis as any).game?.i18n;
    return ids.map((id) => {
      const e = list.find((x: any) => x?.id === id);
      const raw = String(e?.name ?? e?.label ?? id);
      try { return String(i18n?.localize?.(raw) ?? raw); } catch { return raw; }
    }).filter(Boolean);
  } catch { return []; }
}

/** v0.68.0: an NPC's compact stat line (attributes, Reaction, armor, initiative, Professional Rating, group, weapons). */
export function mookStat(a: any): MookLine | null {
  try {
    const sys = a?.system ?? {};
    const d = sys.derived ?? {};
    const attributes: Record<string, number> = {};
    for (const [k, v] of Object.entries(sys.attributes ?? {})) attributes[k] = Number((v as any)?.total ?? (v as any)?.value ?? (v as any)?.base ?? 0);
    const armor = (kind: 'ballistic' | 'impact'): number => { try { return Number(a?.armorRating?.(kind) ?? 0); } catch { return 0; } };
    const weapons = [...(a?.items ?? [])].filter((i: any) => i.type === 'weapon' && isCarried(i))
      .sort((x: any, y: any) => Number(x.sort ?? 0) - Number(y.sort ?? 0))
      .map((i: any) => ({ name: String(i.name ?? ''), system: i.system ?? {} }));
    return mookLine({
      attributes, reaction: Number(d.reaction ?? 0), initiativeDice: Number(d.initiativeDice ?? 1), initiativeBonus: Number(d.initiativeBonus ?? 0),
      ballistic: armor('ballistic'), impact: armor('impact'), professionalRating: Number(sys.professionalRating ?? 0), grunts: sys.grunts ?? null, weapons,
    });
  } catch { return null; }
}

/**
 * One person (or vehicle, IC…) as a GM panel row: condition, pools, chips and which quick actions
 * fit. `extra` adds the combat fields (initiative, current, defeated).
 */
export function personRow(a: any, extra: Record<string, unknown> = {}): any {
  const sys = a?.system ?? {};
  const d = sys.derived ?? {};
  const people = PEOPLE_TYPES.includes(a?.type);
  const items = [...(a?.items ?? [])];
  const chips: string[] = combatChips(a);
  if (d.astralMode && d.astralMode !== 'physical') chips.push(String(d.astralMode));
  if (d.matrix?.jackedIn) chips.push(`Matrix ${sys.matrix?.monitor ?? 0}/10`);
  if (sys.grunts?.size > 1) chips.push(`${Math.max(0, sys.grunts.size - (sys.grunts.down ?? 0))}/${sys.grunts.size} grunts`);
  const monitor = sys.monitor && typeof sys.monitor.physical === 'number';
  return {
    uuid: String(a?.uuid ?? ''), name: String(a?.name ?? '?'), type: String(a?.type ?? ''),
    status: String(d.status ?? 'ok'), hurt: (d.status ?? 'ok') !== 'ok',
    monitor, physical: sys.monitor?.physical ?? 0, stun: sys.monitor?.stun ?? 0,
    // v0.67.0: the small monitor in wound groups (with Overflow for everyone but spirits).
    cm: monitor ? monitorView(sys.monitor, overflowBody(sys), { overflow: a?.type !== 'spirit' }) : null,
    condition: a?.type === 'vehicle' ? `damage ${sys.condition ?? 0}/10` : '',
    pools: poolsLine(a), chips: chips.join(' · '), player: Boolean(a?.hasPlayerOwner),
    canAttack: people, canCast: people && items.some((i: any) => i.type === 'spell'),
    canPerceive: people, canMorale: people && ((sys.grunts?.size ?? 1) > 1 || (sys.professionalRating ?? 0) > 0),
    // v0.68.0: the compact stat card's line (NPCs and grunts no player owns).
    stat: people && !a?.hasPlayerOwner ? mookStat(a) : null,
    ...extra,
  };
}

/** A recent roll for the GM panel's log: who, what, the outcome. Null for messages without a test or dice. */
export function recentRollRow(m: any, strip: (html: string, flavor?: string) => string): any | null {
  const sys = m?.flags?.sr2e ?? {};
  const snap = sys.test;
  if (!snap && !(m?.rolls?.length)) return null;
  const html = String(m?.content ?? '');
  const banner = (/class="sr2e-banner[^"]*">([^<]*)</.exec(html)?.[1] ?? '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
  const outcome = banner || (snap ? (snap.botch ? tx('SR2E.Card.Actor.disaster2') : tCount(Number(snap.successes ?? 0) || 0, 'SR2E.Count.success')) : sys.gmRoll ? tCount(Number(sys.gmRoll.successes) || 0, 'SR2E.Count.success') : '');
  const ts = Number(m?.timestamp ?? 0);
  return {
    id: String(m?.id ?? ''), who: String(m?.speaker?.alias ?? m?.alias ?? ''), title: strip(html, String(m?.flavor ?? '')),
    outcome, whisper: Boolean(m?.whisper?.length), time: ts ? new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
  };
}
