/**
 * v0.59.0: the Effects view: everything acting on a character right now, in one list (conditions, token
 * statuses, combat states, spells and powers, drugs and illness, Matrix and rigging), with when each ends.
 */
import { SYSTEM_ID } from "../config/system.ts";
import { sysNow } from '../helpers/clock.ts';
import { RULES, withdrawalState, WOUND_STATUS_IDS, STATE_STATUSES } from "../rules/index.ts";
import { t as tx, tCount, tNoun, tKey } from "../helpers/i18n.ts";
import { addictWho, addictionBook } from "../rules/health923.ts";

export interface EffectRow { group: string; name: string; detail: string; until: string; statusId?: string }

/** Pure: a time left, e.g. "2 h 5 min", "40 s", "3 days". */
export function timeLeftLabel(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return tx('SR2E.App.Effects.s', { s });
  if (s < 3600) return tx('SR2E.App.Effects.min', { m: Math.round(s / 60) });
  if (s < 86400) { const h = Math.floor(s / 3600), m = Math.round((s % 3600) / 60); return m ? tx('SR2E.App.Effects.hMin', { h, m }) : tx('SR2E.App.Effects.h', { h }); }
  const d = Math.round(s / 86400);
  return tNoun(d, 'day');
}

/** Pure: when a timed thing ends ({round, worldTime}: either may be -1). */
export function untilLabel(e: { round?: number; worldTime?: number } | null | undefined, now: { round: number | null; worldTime: number }): string {
  if (!e) return '';
  const r = Number(e.round ?? -1), w = Number(e.worldTime ?? -1);
  if (r >= 0 && now.round !== null) return r <= now.round ? tx('SR2E.App.Effects.endsNow') : tNoun(r - now.round, 'combat turn');
  if (w >= 0) return w <= now.worldTime ? tx('SR2E.App.Effects.endsNow') : timeLeftLabel(w - now.worldTime);
  return '';
}

/** Everything acting on `actor` now. */
export function effectRows(actor: any): EffectRow[] {
  const rows: EffectRow[] = [];
  const sys = actor?.system ?? {};
  const d = sys.derived ?? {};
  const combat: any = (game as any).combat;
  const now = { round: combat?.started ? Number(combat.round ?? 0) : null, worldTime: sysNow() };
  const flag = (k: string) => actor?.getFlag?.(SYSTEM_ID, k);

  // Condition.
  if (d.status && d.status !== 'ok') rows.push({ group: 'Condition', name: String(d.status), detail: d.status === 'dying' ? (sys.care?.stabilised ? tx('SR2E.App.Effects.stabilised') : tx('SR2E.App.Effects.losesAPhysicalBox', { every: d.bleedEvery || tx('SR2E.App.Effects.everyBodyCombatTurns') })) : '', until: '' });
  if (Number(d.woundModifier ?? 0) > 0) rows.push({ group: 'Condition', name: tx('SR2E.App.Effects.wounds'), detail: tx('SR2E.App.Effects.toTargetNumbers', { woundModifier: d.woundModifier }), until: '' });

  // Token statuses (the automatic ones are listed under their own groups).
  const auto = new Set<string>([...Object.values(WOUND_STATUS_IDS), ...STATE_STATUSES.filter((s) => s.id.startsWith('sr2e') || (s.state === 'onFire' ? flag('onFire') : flag('broken'))).map((s) => s.id), 'dead', 'unconscious', 'bleeding']);
  const until = (flag('statusUntil') as Record<string, any> | undefined) ?? {};
  const all: any[] = (CONFIG as any)?.statusEffects ?? [];
  for (const id of [...((actor?.statuses ?? []) as Iterable<string>)]) {
    if (auto.has(id)) continue;
    const def = all.find((s: any) => s.id === id);
    const name = def ? String((game as any).i18n?.localize?.(def.name ?? def.label ?? id) ?? id) : id;
    const detail = id === 'blind' ? tx('SR2E.App.Effects.tnToAttacksAndSpells', { attackTn: RULES.STATUSES.blind.attackTn }) : id === 'deaf' ? tx('SR2E.App.Effects.tnToPerceptionByEar', { hearingTn: RULES.STATUSES.deaf.hearingTn })
      : id === 'prone' ? tx('SR2E.App.Effects.standingUpIsAnAction') : (id === 'paralysis' || id === 'sleep') && RULES.STATUSES.paralysis.blocksActions ? tx('SR2E.App.Effects.cannotAct')
      : id === RULES.COMBAT.hold.status && flag('heldBy') ? tx('SR2E.App.Effects.heldBy', { name: (globalThis as any).fromUuidSync?.(flag('heldBy'))?.name ?? tx('SR2E.App.Effects.someone') }) : '';
    rows.push({ group: 'Statuses', name, detail, until: untilLabel(until[id], now), statusId: id });
  }

  // Combat.
  // Burning and Fear are Foundry's own too: they mean "on fire" and "morale broken" only when the system's state says so.
  const ownState = (s: (typeof STATE_STATUSES)[number]) => s.id.startsWith('sr2e') || (s.state === 'onFire' ? Boolean(flag('onFire')) : s.state === 'broken' ? Boolean(flag('broken')) : true);
  const states = STATE_STATUSES.filter((s) => (actor?.statuses as Set<string> | undefined)?.has?.(s.id) && ownState(s));
  for (const s of states) {
    const detail = s.state === 'fullDefense' ? tx('SR2E.App.Effects.diceAgainstAttacksUntilThe', { attribute: RULES.COMBAT.fullDefense.attribute })
      : s.state === 'onFire' ? tx('SR2E.App.Effects.burnsEveryCombatTurnUntil')
      : s.state === 'broken' ? tx('SR2E.App.Effects.theGroupsMoraleHasBroken') : '';
    rows.push({ group: s.state === 'jackedIn' || s.state === 'jumpedIn' ? 'Matrix and rigging' : 'Combat', name: tKey(s.name), detail, until: '' });
  }
  if (flag('aim')) rows.push({ group: 'Combat', name: tx('SR2E.App.Effects.takingAim'), detail: tx('SR2E.App.Effects.lostOnAnyActionButAiming'), until: '' });

  // Magic.
  for (const sp of (actor?.sustained?.() ?? []) as any[]) rows.push({ group: 'Magic', name: tx('SR2E.App.Effects.sustaining', { spellName: sp.spellName }), detail: sp.focusId ? tx('SR2E.App.Effects.forceByAFocus', { force: sp.force }) : sp.quickened ? tx('SR2E.App.Effects.forceQuickened', { force: sp.force }) : sp.spiritUuid ? tx('SR2E.App.Effects.forceByASpirit', { force: sp.force }) : tx('SR2E.App.Effects.force2TnToOtherTests', { force: sp.force }), until: '' });
  for (const p of (d.powerEffects ?? []) as any[]) rows.push({ group: 'Magic', name: p.name, detail: `${p.fromName ? tx('SR2E.App.Effects.from', { fromName: p.fromName }) : ''}${p.summary ?? ''}${p.permanent ? tx('SR2E.App.Effects.permanent') : ''}`, until: '' });
  if (d.possessedBy) rows.push({ group: 'Magic', name: tx('SR2E.App.Effects.possessed'), detail: tx('SR2E.App.Effects.by', { possessedBy: d.possessedBy }), until: '' });

  // Health.
  for (const dr of (sys.drugs ?? []) as any[]) rows.push({ group: 'Health', name: dr.name, detail: tx('SR2E.App.Effects.drugInEffect'), until: untilLabel(dr, now) });
  for (const dz of (sys.diseases ?? []) as any[]) rows.push({ group: 'Health', name: dz.name, detail: dz.treated ? tx('SR2E.App.Effects.towardRecoveryTreated', { power: dz.power, level: dz.level, damageType: dz.damageType, recovered: dz.recovered, needed: dz.needed }) : tx('SR2E.App.Effects.towardRecovery', { power: dz.power, level: dz.level, damageType: dz.damageType, recovered: dz.recovered, needed: dz.needed }), until: Number(dz.nextAt) > now.worldTime ? tx('SR2E.App.Effects.nextIn', { time: timeLeftLabel(Number(dz.nextAt) - now.worldTime) }) : tx('SR2E.App.Effects.due') });
  for (const ad of (sys.addictions ?? []) as any[]) {
    // v0.92.3 (RULES.HEALTH_V923.addiction 'book'): the book's withdrawal timing and penalty.
    try { if (withdrawalState(ad, now.worldTime, addictWho(sys)).withdrawal) rows.push({ group: 'Health', name: tx('SR2E.App.Effects.withdrawal', { drug: ad.drug }), detail: tx('SR2E.App.Effects.tnToEveryTestUntil', { withdrawalTn: addictionBook() ? RULES.HEALTH_V923.addictionBook.forcedWithdrawalTn : RULES.HEALTH.addiction.withdrawalTn }), until: '' }); } catch { /* bad data */ }
  }
  for (const r of (sys.recovering ?? []) as any[]) rows.push({ group: 'Health', name: tx('SR2E.App.Effects.recovering', { name: r.name }), detail: tx('SR2E.App.Effects.doesNotWorkYet'), until: untilLabel({ worldTime: Number(r.until) }, now) });
  for (const x of ((flag('stimDebt') as any[] | undefined) ?? [])) rows.push({ group: 'Health', name: x.name, detail: tCount(Number(x.boxes), 'SR2E.App.Effects.stunBoxEsComeBack'), until: untilLabel({ worldTime: Number(x.at) }, now) });
  if (Number(sys.radiation?.dose ?? 0) > 0) rows.push({ group: 'Health', name: tx('SR2E.App.Effects.radiation'), detail: tx('SR2E.App.Effects.dose', { dose: sys.radiation.dose }), until: '' });

  // Matrix and rigging (beyond the state icons).
  if (actor?.isJackedIn?.() && !states.some((s) => s.state === 'jackedIn')) rows.push({ group: 'Matrix and rigging', name: tx('SR2E.App.Effects.jackedIn'), detail: '', until: '' });
  if (sys.rigging?.jumpedIn && !states.some((s) => s.state === 'jumpedIn')) rows.push({ group: 'Matrix and rigging', name: tx('SR2E.App.Effects.jumpedIn'), detail: '', until: '' });
  // v0.92.1: the custom tweaks on items that count now (rules/tweaks.ts).
  for (const t of ((d.tweaks?.list ?? []) as any[]).filter((x: any) => x?.active)) rows.push({ group: 'Tweaks', name: String(t.label || t.text), detail: t.label && t.text !== t.label ? `${t.text} · ${t.itemName}` : String(t.itemName ?? ''), until: '' });
  return rows;
}

/** The view's context: groups of rows, for the template. */
export function effectsContext(actor: any): { groups: Array<{ name: string; heading: string; rows: EffectRow[] }>; empty: boolean } {
  const rows = effectRows(actor);
  const order = ['Condition', 'Statuses', 'Combat', 'Magic', 'Health', 'Matrix and rigging', 'Tweaks'];
  // v0.89.6: the groups are ids; their names are shown in the user's language.
  const label = (g: string): string => g === 'Condition' ? tx('SR2E.App.Effects.condition') : g === 'Statuses' ? tx('SR2E.App.Effects.statuses') : g === 'Combat' ? tx('SR2E.App.Effects.combat')
    : g === 'Magic' ? tx('SR2E.App.Effects.magic') : g === 'Health' ? tx('SR2E.App.Effects.health') : g === 'Tweaks' ? tx('SR2E.App.Effects.customTweaks') : tx('SR2E.App.Effects.matrixAndRigging');
  // `heading` (the English group id) is the heading's data-heading: the icon and fold key, the same in every language
  const groups = order.map((name) => ({ name: label(name), heading: name, rows: rows.filter((r) => r.group === name) })).filter((g) => g.rows.length);
  return { groups, empty: !rows.length };
}
