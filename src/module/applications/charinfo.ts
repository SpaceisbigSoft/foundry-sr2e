/**
 * v0.64.0: the character sheet's Current and Creation tabs.
 * - Current (beside Main): a read-only reference of where the character stands now: attributes base →
 *   natural → modified (hover for where the total comes from), Reaction, Initiative, every pool, Essence,
 *   Magic, armor, condition, Karma, nuyen, lifestyle, what's in effect, and a "Since creation" column.
 * - Creation: the frozen creation record, the advancement log under it, and what's waiting for the GM.
 */
import { ATTRIBUTE_KEYS, augmentationsOf } from '../models/index.ts';
import { RULES, sinceCreation, attributeSources, describeLine, advancementTotalsV73, isCreationRecord, priorityTable, drugsForBonuses, type CreationRecord } from '../rules/index.ts';
import { creationRecordOf, inCreation, requestsOf, queueOn } from './approvals.ts';
import { advancementOf } from './advancement.ts';
import { effectsContext } from './effects.ts';
import { t as tx, tCount } from '../helpers/i18n.ts';

const cap = (s: string) => String(s ?? '').charAt(0).toUpperCase() + String(s ?? '').slice(1);
const r2 = (n: number) => Math.round(Number(n || 0) * 100) / 100;

/** Named sources of an attribute's augmentation (cyberware, bioware, adept powers, drugs, spells and powers). */
function namedSources(actor: any, key: string): Array<{ name: string; value: number }> {
  const out: Array<{ name: string; value: number }> = [];
  try {
    for (const a of augmentationsOf(actor) as any[]) if (a.installed !== false && !a.damaged && Number(a.attributes?.[key] ?? 0)) out.push({ name: String(a.name ?? 'Cyberware'), value: Number(a.attributes[key]) });
  } catch { /* data not ready */ }
  for (const p of [...(actor.items ?? [])].filter((i: any) => i.type === 'adeptpower' && i.system?.active !== false)) {
    const v = Number(p.system?.attributes?.[key] ?? 0);
    if (v) out.push({ name: p.name, value: v });
  }
  for (const d of drugsForBonuses((actor.system?.drugs ?? []) as any[])) { const v = Number(d?.attributes?.[key] ?? 0); if (v) out.push({ name: String(d.name ?? 'Drug'), value: v }); }
  for (const p of (actor.system?.derived?.powerEffects ?? []) as any[]) { const v = Number(p?.attributes?.[key] ?? 0); if (v) out.push({ name: String(p.name ?? 'Effect'), value: v }); }
  return out;
}

export function currentContext(actor: any): any {
  const sys = actor.system ?? {}, d = sys.derived ?? {};
  const rec = creationRecordOf(actor) as CreationRecord | null;
  const skills = [...(actor.items ?? [])].filter((i: any) => i.type === 'skill');
  const since = sinceCreation(rec, {
    attributes: Object.fromEntries(ATTRIBUTE_KEYS.map((k) => [k, Number(sys.attributes?.[k]?.natural ?? 0)])),
    skills: skills.map((i: any) => ({ name: i.name, rating: Number(i.system?.rating ?? 0) })),
    magic: Number(d.magic ?? 0), essence: r2(Number(d.essence ?? sys.essence ?? 6)), career: Number(sys.karma?.career ?? 0), nuyen: Number(sys.nuyen ?? 0), good: Number(sys.karma?.good ?? 0),
  });
  const notes: Record<string, string[]> = { quickness: [] };
  if (Number(d.encumbrance ?? 0) > 0) notes['quickness']!.push(tx('SR2E.App.Charinfo.armorEncumbrance', { encumbrance: d.encumbrance }));
  if (Number(d.load?.penalty ?? 0) > 0) notes['quickness']!.push(tx('SR2E.App.Charinfo.carriedLoad', { penalty: d.load.penalty }));
  const attributes = ATTRIBUTE_KEYS.map((k) => {
    const a = sys.attributes?.[k] ?? {};
    return {
      key: k, label: cap(k), base: Number(a.base ?? 0), natural: Number(a.natural ?? a.base ?? 0), total: Number(a.total ?? 0),
      augmented: Number(a.total ?? 0) !== Number(a.natural ?? 0),
      sources: attributeSources({ base: Number(a.base ?? 0), racial: Number(a.racial ?? 0), mod: Number(a.mod ?? 0), gear: Number(a.gear ?? 0), total: Number(a.total ?? 0) }, namedSources(actor, k), notes[k] ?? []),
      since: since.attributes[k] ?? '',
    };
  });
  const pools = [
    { label: tx('SR2E.App.Charinfo.combatPool'), left: d.combatPoolLeft ?? 0, total: d.combatPool ?? 0, show: true },
    { label: tx('SR2E.App.Charinfo.spellPool'), left: d.spellPoolLeft ?? 0, total: d.spellPool ?? 0, show: Number(d.spellPool ?? 0) > 0 },
    { label: tx('SR2E.App.Charinfo.hackingPool'), left: d.hackingPoolLeft ?? 0, total: d.hackingPool ?? 0, show: Number(d.hackingPool ?? 0) > 0 },
    { label: tx('SR2E.App.Charinfo.controlPool'), left: d.controlPoolLeft ?? 0, total: d.controlPool ?? 0, show: Number(d.controlPool ?? 0) > 0 && Boolean(d.rigging) },
    { label: tx('SR2E.App.Charinfo.karmaPool'), left: d.karmaPoolLeft ?? 0, total: sys.karma?.pool ?? 0, show: true },
  ].filter((p) => p.show);
  const life = (() => { try { return actor.lifestyleStatus?.() ?? null; } catch { return null; } })();
  const fx = effectsContext(actor);
  const status = String(d.status ?? 'ok');
  return {
    hasRecord: Boolean(rec),
    attributes,
    reaction: { value: Number(d.reaction ?? 0), title: Number(sys.reactionBonus ?? 0) ? tx('SR2E.App.Charinfo.quicknessIntelligence2Bonus', { reactionBonus: sys.reactionBonus }) : tx('SR2E.App.Charinfo.quicknessIntelligence2') },
    initiative: `${d.reaction ?? 0} + ${d.initiativeDice ?? 1}D6`,
    matrixInit: d.matrix ? `${d.matrix.reaction} + ${d.matrix.initiativeDice}D6` : '',
    riggedInit: d.rigging?.jumpedIn ? `${d.rigging.reaction} + ${d.rigging.initiativeDice}D6` : '',
    pools,
    essence: { value: r2(Number(d.essence ?? sys.essence ?? 6)), base: Number(sys.essence ?? 6), loss: r2(Number(d.essenceLoss ?? 0)), hole: r2(Number(d.essenceHole ?? 0)), since: since.essence },
    magic: Number(d.magic ?? 0) > 0 || Number(sys.magic ?? 0) > 0 ? { value: Number(d.magic ?? 0), base: Number(sys.magic ?? 0), tradition: cap(String(sys.tradition ?? 'none')), grade: Number(sys.initiateGrade ?? 0), since: since.magic } : null,
    armor: { ballistic: actor.armorRating?.('ballistic') ?? 0, impact: actor.armorRating?.('impact') ?? 0 },
    condition: { physical: Number(sys.monitor?.physical ?? 0), stun: Number(sys.monitor?.stun ?? 0), boxes: RULES.MONITOR_BOXES, wound: Number(d.woundModifier ?? 0), status: cap(status) },
    karma: { good: Number(sys.karma?.good ?? 0), career: Number(sys.karma?.career ?? 0), pool: Number(sys.karma?.pool ?? 0), earnedSince: since.karmaEarned, goodSince: since.good },
    nuyen: { value: Number(sys.nuyen ?? 0).toLocaleString(), since: since.nuyen },
    lifestyle: life ? (life.days === null ? tx('SR2E.App.Charinfo.neverPaid', { label: life.label }) : life.days < 0 ? tCount(-life.days, 'SR2E.App.Charinfo.daysOverdue', { label: life.label }) : tCount(life.days, 'SR2E.App.Charinfo.daysPaid', { label: life.label })) : '',
    effects: fx.groups.flatMap((g: any) => g.rows.map((r: any) => ({ group: g.name, name: r.name, detail: r.detail ?? '', until: r.until ?? '' }))),
    skills: skills.sort((x: any, y: any) => String(x.system.kind).localeCompare(String(y.system.kind)) || x.name.localeCompare(y.name)).map((i: any) => ({
      name: i.name, kind: i.system.kind ?? 'active', rating: Number(i.system.rating ?? 0),
      extra: [i.system.specialization ? `${i.system.specialization} ${i.system.specializationRating || ''}`.trim() : '', i.system.concentration ? `${i.system.concentration} ${i.system.concentrationRating || ''}`.trim() : ''].filter(Boolean).join(', '),
      since: since.skills[i.name] ?? '',
    })),
    metatype: d.metatype || cap(String(sys.metatype ?? 'human')),
  };
}

const PRIORITY_LABEL = (): Record<string, string> => ({ race: tx('SR2E.App.Charinfo.race'), magic: tx('SR2E.App.Charinfo.magic'), attributes: tx('SR2E.App.Charinfo.attributes'), skills: tx('SR2E.App.Charinfo.skills'), resources: tx('SR2E.App.Charinfo.resources') });

export function creationContext(actor: any): any {
  const rec = creationRecordOf(actor);
  const log = advancementOf(actor);
  const me = String(game.user?.id ?? '');
  const pending = requestsOf(actor).filter((r) => game.user?.isGM || r.userId === me).map((r) => ({ id: r.id, label: r.label, who: r.userName, cost: [r.karma ? tx('SR2E.App.Charinfo.karma', { karma: r.karma }) : '', r.nuyen ? `¥${r.nuyen.toLocaleString()}` : ''].filter(Boolean).join(' + ') || tx('SR2E.App.Charinfo.free') }));
  const base = { isGM: Boolean(game.user?.isGM), inCreation: inCreation(actor), pending, queueOn: queueOn(), canEdit: Boolean(actor.isOwner) };
  if (!isCreationRecord(rec)) return { ...base, record: null, log: [], totals: null };
  const table = priorityTable();
  const when = (() => { try { return new Date(rec.finishedAt).toLocaleString(); } catch { return rec.finishedAt; } })();
  return {
    ...base,
    record: {
      when, by: rec.by, how: rec.how === 'wizard' ? tx('SR2E.App.Charinfo.theCreationWizard') : tx('SR2E.App.Charinfo.recordedAsTheCharacterStood'), failed: rec.failed,
      priorities: Object.entries(rec.priorities ?? {}).filter(([, l]) => l).map(([k, l]) => ({ label: PRIORITY_LABEL()[k] ?? cap(k), letter: l, what: (() => { const t = table.find((x) => x.letter === l); if (!t) return ''; return k === 'race' ? '' : k === 'magic' ? t.magic : k === 'attributes' ? tx('SR2E.App.Charinfo.points', { points: t.attributes }) : k === 'skills' ? tx('SR2E.App.Charinfo.points', { points: t.skills }) : `¥${t.resources.toLocaleString()}`; })() })),
      metatype: RULES.METATYPES.types[rec.metatype]?.label ?? cap(rec.metatype),
      magic: rec.magicKind === 'none' ? tx('SR2E.App.Charinfo.mundane') : tx('SR2E.App.Charinfo.magic2', { tradition: cap(rec.tradition), magic: rec.magic }),
      attributes: Object.entries(rec.attributes).map(([k, a]) => ({ label: cap(k), base: a.base, natural: a.natural })),
      essence: rec.essence,
      skills: rec.skills.map((s) => ({ ...s, extra: [s.specialization ? `${s.specialization} ${s.specializationRating ?? ''}`.trim() : '', s.concentration ? `${s.concentration} ${s.concentrationRating ?? ''}`.trim() : ''].filter(Boolean).join(', ') })),
      spells: rec.spells, adeptPowers: rec.adeptPowers,
      gear: rec.gear, cyberware: rec.cyberware, contacts: rec.contacts, qualities: rec.qualities,
      nuyen: rec.nuyen.toLocaleString(), karma: rec.karma,
      lifestyle: RULES.UPKEEP.lifestyles.find((l) => l.id === rec.lifestyle.level)?.label ?? rec.lifestyle.level,
      checks: rec.checks,
    },
    log: [...log].reverse().map((l) => ({ ...l, text: describeLine(l), when: (() => { try { return new Date(l.at).toLocaleDateString(); } catch { return ''; } })(),
      cost: [l.karma ? `${l.karma > 0 ? '+' : ''}${l.karma} K` : '', l.nuyen ? `${l.nuyen > 0 ? '+' : '−'}¥${Math.abs(l.nuyen).toLocaleString()}` : ''].filter(Boolean).join(' '), cls: l.kind })),
    totals: advancementTotalsV73(log),
  };
}
