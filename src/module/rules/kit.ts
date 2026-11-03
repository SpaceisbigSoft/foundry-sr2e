import { RULES } from './config.ts';
import type { TargetNumberModifier } from './dice.ts';
import { resolveMelee } from './weapons.ts';
import { num } from './util.ts';
import { t as tx } from '../helpers/i18n.ts';

/**
 * Combat kit rules (v0.61.0): skill gear and cyberware bonuses, hearing (cyberears, deafness, noise),
 * optional superior position in melee, grenade launcher arming range, stun baton charges, the
 * monofilament whip hitting its wielder and smoke grenade clouds. Values in RULES.COMBAT_V61 (VERIFY).
 * Pure rules; no Foundry.
 */

const C = () => RULES.COMBAT_V61;

/** Lower-cased, trimmed text ('' for anything that isn't a string). */
const key = (s: unknown): string => (typeof s === 'string' ? s.trim().toLowerCase() : '');

// ---------------------------------------------------------------- Skill gear

/** v0.61.0: one `skillMods` row on an item: dice and/or TN added to tests of a named skill. */
export interface SkillGearMod { skill: string; dice?: number; tn?: number }

/** v0.61.0: an item carrying `skillMods` rows (its name labels the modifier). */
export interface SkillGearSource { name: string; mods: Array<SkillGearMod> }

/** v0.61.0: does this mod row's skill name the skill, its concentration or its specialization (case-insensitive; '*' and '' never match)? */
export function skillModMatches(modSkill: string, skill: { name: string; specialization?: string; concentration?: string }): boolean {
  const m = key(modSkill);
  if (!m || m === '*' || !skill) return false;
  return [skill.name, skill.concentration, skill.specialization].some((s) => key(s) !== '' && key(s) === m);
}

/**
 * v0.61.0: dice and TN modifiers that gear gives to a test of this skill. Items stack per
 * skillGear.stack: 'sum' = every row on every item adds; 'best' = the most bonus dice from one item
 * and the lowest bonus TN from one item. v0.81.0: in 'best' mode only bonuses (positive dice, negative
 * TN) compete; penalties (negative dice, positive TN) always add, so a bonus never hides a penalty.
 * TN modifiers are labelled with the item name; `names` lists the items that counted.
 */
export function skillGearBonus(
  sources: Array<SkillGearSource>,
  skill: { name: string; specialization?: string; concentration?: string },
): { dice: number; modifiers: TargetNumberModifier[]; names: string[] } {
  const sum = C().skillGear.stack === 'sum';
  /** Per item: its best bonus (bDice > 0, bTn < 0) and its summed penalties (pDice < 0, pTn > 0). */
  const items: Array<{ name: string; bDice: number; pDice: number; bTn: number; pTn: number }> = [];
  for (const src of Array.isArray(sources) ? sources : []) {
    if (!src || !Array.isArray(src.mods)) continue;
    const rows = src.mods.filter((m) => m && skillModMatches(m.skill, skill));
    if (!rows.length) continue;
    const dices = rows.map((r) => Math.trunc(num(r.dice)));
    const tns = rows.map((r) => Math.trunc(num(r.tn)));
    const add = (a: number, b: number) => a + b;
    const it = sum
      ? { bDice: dices.reduce(add, 0), pDice: 0, bTn: tns.reduce(add, 0), pTn: 0 }
      : {
          bDice: Math.max(0, ...dices),
          pDice: dices.filter((d) => d < 0).reduce(add, 0),
          bTn: Math.min(0, ...tns),
          pTn: tns.filter((t) => t > 0).reduce(add, 0),
        };
    if (it.bDice || it.pDice || it.bTn || it.pTn) items.push({ name: String(src.name ?? '').trim() || 'Gear', ...it });
  }
  if (sum) {
    const names = items.map((i) => i.name);
    return {
      dice: items.reduce((a, i) => a + i.bDice, 0),
      modifiers: items.filter((i) => i.bTn).map((i) => ({ label: i.name, value: i.bTn })),
      names,
    };
  }
  type Item = typeof items[number];
  const bestDice = items.filter((i) => i.bDice > 0).reduce<Item | null>((b, i) => (!b || i.bDice > b.bDice ? i : b), null);
  const bestTn = items.filter((i) => i.bTn < 0).reduce<Item | null>((b, i) => (!b || i.bTn < b.bTn ? i : b), null);
  const penDice = items.filter((i) => i.pDice < 0);
  const penTn = items.filter((i) => i.pTn > 0);
  const modifiers: TargetNumberModifier[] = [
    ...(bestTn ? [{ label: bestTn.name, value: bestTn.bTn }] : []),
    ...penTn.map((i) => ({ label: i.name, value: i.pTn })),
  ];
  const names = [...new Set([bestDice, bestTn, ...penDice, ...penTn].filter((i): i is Item => !!i).map((i) => i.name))];
  return { dice: (bestDice?.bDice ?? 0) + penDice.reduce((a, i) => a + i.pDice, 0), modifiers, names };
}

// ---------------------------------------------------------------- Hearing

/** v0.61.0: hearing fields on a cyberware item of kind 'ears'. */
export interface EarsItem { hearingAmp?: number; dampener?: boolean; highFrequency?: boolean; lowFrequency?: boolean; recorder?: boolean }

/** v0.61.0: combined cyberear options: the best amplification rating (capped at hearing.ampMax), any of the flags, and adept Improved Hearing. */
export function earsDerived(
  items: Array<EarsItem>,
  adeptHearing?: boolean,
): { amp: number; dampener: boolean; highFrequency: boolean; lowFrequency: boolean; recorder: boolean; adept: boolean } {
  const list = (Array.isArray(items) ? items : []).filter((i) => i && typeof i === 'object');
  const cap = Math.max(0, Math.floor(num(C().hearing.ampMax)));
  const amp = Math.min(cap, Math.max(0, ...list.map((i) => Math.floor(num(i.hearingAmp)))));
  return {
    amp,
    dampener: list.some((i) => i.dampener === true),
    highFrequency: list.some((i) => i.highFrequency === true),
    lowFrequency: list.some((i) => i.lowFrequency === true),
    recorder: list.some((i) => i.recorder === true),
    adept: adeptHearing === true,
  };
}

/**
 * v0.61.0: TN modifiers for Perception by ear. Deaf: only the deaf TN (RULES.STATUSES.deaf.hearingTn;
 * amplification, the adept power and noise don't matter). Otherwise: amplification
 * (ampPerRating × amp), adept Improved Hearing and the background noise row (unknown ids add nothing).
 */
export function hearingModifiers(o: { ears: ReturnType<typeof earsDerived> | null; deaf: boolean; noise?: string }): TargetNumberModifier[] {
  const h = C().hearing;
  if (o?.deaf) return [{ id: 'deaf', label: tx('SR2E.Card.Mod.deaf'), value: num(RULES.STATUSES.deaf.hearingTn) }];
  const out: TargetNumberModifier[] = [];
  const ears = o?.ears ?? null;
  const amp = Math.min(Math.max(0, Math.floor(num(ears?.amp))), Math.max(0, Math.floor(num(h.ampMax))));
  const ampTn = amp * num(h.ampPerRating);
  if (ampTn) out.push({ label: tx('SR2E.Card.Mod.hearingAmplification', { n: amp }), value: ampTn });
  if (ears?.adept && num(h.adeptHearingTn)) out.push({ id: 'improvedHearingAdept', label: tx('SR2E.Card.Mod.improvedHearingAdept'), value: num(h.adeptHearingTn) });
  const n = typeof o?.noise === 'string' && Object.prototype.hasOwnProperty.call(h.noiseTn, o.noise) ? num(h.noiseTn[o.noise]) : 0;
  if (n) out.push({ label: tx('SR2E.Card.Mod.noise', { id: o.noise }), value: n });
  return out;
}

/**
 * v0.61.0: can this sound be heard at all? A sound above ('high') or below ('low') human range needs
 * high/low frequency cyberears. Deafness isn't checked here (it's the deaf TN in hearingModifiers).
 * Not wired into the glue yet (v0.81.0): the high/low frequency flags are stored but no test passes a range.
 */
export function canHear(o: { ears: ReturnType<typeof earsDerived> | null; range?: 'normal' | 'high' | 'low' }): boolean {
  const r = o?.range ?? 'normal';
  if (r === 'high') return o?.ears?.highFrequency === true;
  if (r === 'low') return o?.ears?.lowFrequency === true;
  return true;
}

/** v0.61.0: does a damper in these ears stop a deafening effect (per hearing.dampenerBlocksDeafening)? */
export function deafeningBlocked(ears: ReturnType<typeof earsDerived> | null): boolean {
  return !!C().hearing.dampenerBlocksDeafening && ears?.dampener === true;
}

// ---------------------------------------------------------------- Superior position

/** v0.61.0: melee superior position (house rule, off by default): the holding side gets `holder`, the other `against`. Empty when disabled or nobody holds it. */
export function superiorPositionModifiers(holder: '' | 'attacker' | 'defender', side: 'attacker' | 'defender'): TargetNumberModifier[] {
  const s = C().superiorPosition;
  if (!s.enabled || (holder !== 'attacker' && holder !== 'defender') || (side !== 'attacker' && side !== 'defender')) return [];
  const value = holder === side ? num(s.holder) : num(s.against);
  if (!value) return [];
  return [{ label: holder === side ? tx('SR2E.Card.Mod.superiorPosition') : tx('SR2E.Card.Mod.opponentHasSuperiorPosition'), value }];
}

// ---------------------------------------------------------------- Grenade launcher arming

/**
 * v0.61.0: is a launched grenade armed at this distance (metres)? Closer than `minRange` it isn't:
 * launcher.dud 'noBlast' = it hits but doesn't explode; 'block' = the shot isn't allowed (`blocked`).
 * Unknown distance (null) counts as armed, with a reminder to check.
 */
export function armingCheck(o: { distance: number | null; minRange: number }): { armed: boolean; blocked: boolean; note: string } {
  const min = Math.max(0, num(o?.minRange));
  if (min <= 0) return { armed: true, blocked: false, note: '' };
  if (o?.distance === null || o?.distance === undefined || !Number.isFinite(Number(o.distance))) {
    return { armed: true, blocked: false, note: tx('SR2E.Text.Kit.distanceUnknownCheckThe', { min }) };
  }
  const d = Math.max(0, Number(o.distance));
  if (d >= min) return { armed: true, blocked: false, note: '' };
  if (C().launcher.dud === 'block') return { armed: false, blocked: true, note: tx('SR2E.Text.Kit.tooCloseToFireInside', { min }) };
  return { armed: false, blocked: false, note: tx('SR2E.Text.Kit.insideTheMMinimumArming', { min }) };
}

// ---------------------------------------------------------------- Stun baton charges

/**
 * v0.61.0: stun effect and charge use for a melee attack. Not a stun weapon: no stun. Charges not
 * tracked (ammoMax 0): stun, nothing spent. Charged: stun, spend 1. Empty: stunBaton.emptyAs
 * 'club' = hits as a club without stun; 'block' = the attack is blocked.
 */
export function stunCharge(o: { stunWeapon: boolean; ammo: number; ammoMax: number }): { stun: boolean; spend: number; note: string; blocked: boolean } {
  if (!o?.stunWeapon) return { stun: false, spend: 0, note: '', blocked: false };
  if (Math.floor(num(o.ammoMax)) <= 0) return { stun: true, spend: 0, note: '', blocked: false };
  if (Math.floor(num(o.ammo)) > 0) return { stun: true, spend: 1, note: '', blocked: false };
  if (C().stunBaton.emptyAs === 'block') return { stun: false, spend: 0, note: tx('SR2E.Text.Kit.outOfCharge'), blocked: true };
  return { stun: false, spend: 0, note: tx('SR2E.Text.Kit.outOfChargeHitsAs'), blocked: false };
}

// ---------------------------------------------------------------- Monofilament whip

/** v0.61.0: does a `selfHit` weapon (monofilament whip) hit its wielder? monowhip.on 'botch' = on a botch; 'miss' = on any miss (a botch counts as a miss). */
export function selfHitCheck(o: { selfHit: boolean; botch: boolean; missed: boolean }): boolean {
  if (!o?.selfHit) return false;
  // v0.78.0: 'defended' (the book) is decided by whipBacklash after the defense, not by the attack roll.
  if (C().monowhip.on === 'defended') return false;
  if (C().monowhip.on === 'miss') return o.missed === true || o.botch === true;
  return o.botch === true;
}

/** v0.78.0: successes among the pool dice of a roll (dice tagged `pool`). */
export function poolSuccesses(dice: ReadonlyArray<{ success: boolean; pool?: boolean }>): number {
  return (dice ?? []).filter((d) => d.success && d.pool).length;
}

/**
 * v0.78.0 (COMBAT_V61.monowhip.on 'defended', the book): the whip lashes back only when the attack failed
 * solely because of the defender's pool successes: without them the attacker would have won.
 */
export function whipBacklash(o: { attackerSuccesses: number; defenderSuccesses: number; defenderPoolSuccesses: number }): boolean {
  if (C().monowhip.on !== 'defended') return false;
  const dummy = { power: 1, level: 'L' as const };
  const actual = resolveMelee({ attackerSuccesses: o.attackerSuccesses, defenderSuccesses: o.defenderSuccesses, attacker: dummy, defender: null });
  if (actual.winner === 'attacker') return false;
  const without = resolveMelee({ attackerSuccesses: o.attackerSuccesses, defenderSuccesses: Math.max(0, o.defenderSuccesses - Math.max(0, o.defenderPoolSuccesses)), attacker: dummy, defender: null });
  return without.winner === 'attacker';
}

// ---------------------------------------------------------------- Smoke grenades

/** v0.61.0: the smoke cloud a grenade kind makes (null if it isn't a smoke kind). A positive `radiusOverride` replaces smoke.radiusMetres. */
export function grenadeSmoke(kindId: string, radiusOverride?: number): { smoke: 'smoke' | 'thermal'; radius: number; turns: number } | null {
  const s = C().smoke;
  if (typeof kindId !== 'string' || !Object.prototype.hasOwnProperty.call(s.kinds, kindId)) return null;
  const smoke = s.kinds[kindId];
  if (smoke !== 'smoke' && smoke !== 'thermal') return null;
  const r = num(radiusOverride);
  return { smoke, radius: r > 0 ? r : Math.max(0, num(s.radiusMetres)), turns: Math.max(0, Math.floor(num(s.lingerTurns))) };
}

/**
 * v0.61.0: read a "Helps skills" line, e.g. "Athletics +2; Perception TN -1; Stealth +1 TN -1", into
 * `skillMods` rows (`;`, `,` or new lines between entries). Entries with no dice and no TN are dropped.
 */
export function parseSkillMods(text: unknown): Array<{ skill: string; dice: number; tn: number }> {
  const out: Array<{ skill: string; dice: number; tn: number }> = [];
  for (const raw of String(text ?? '').split(/[;,\n]+/)) {
    const part = raw.trim();
    if (!part) continue;
    // A number may be signed (+, - or −) or not (counts as +).
    const sign = (t: string) => Number(t.replace(/\s+/g, '').replace('−', '-'));
    const tnM = part.match(/\bTN\s*([-+−]?\s*\d+)\s*$/i);
    const tn = tnM ? sign(tnM[1]!) : 0;
    const rest = tnM ? part.slice(0, tnM.index).trim() : part;
    const diceM = rest.match(/(?:^|\s)([-+−]?\s*\d+)\s*(?:dice?)?\s*$/i);
    const dice = diceM ? sign(diceM[1]!) : 0;
    const skill = (diceM ? rest.slice(0, diceM.index) : rest).trim().replace(/[:=]$/, '').trim();
    if (!skill || (!dice && !tn) || !Number.isFinite(dice) || !Number.isFinite(tn)) continue;
    out.push({ skill: skill.slice(0, 60), dice: Math.max(-20, Math.min(20, Math.trunc(dice))), tn: Math.max(-20, Math.min(20, Math.trunc(tn))) });
  }
  return out.slice(0, 12);
}

/** v0.61.0: `skillMods` rows back to a "Helps skills" line. */
export function skillModsText(list: unknown): string {
  if (!Array.isArray(list)) return '';
  return list
    .filter((m: any) => m && String(m.skill ?? '').trim() && (Number(m.dice) || Number(m.tn)))
    .map((m: any) => [String(m.skill).trim(), Number(m.dice) ? `${Number(m.dice) > 0 ? '+' : ''}${Number(m.dice)}` : '', Number(m.tn) ? `TN ${Number(m.tn) > 0 ? '+' : ''}${Number(m.tn)}` : ''].filter(Boolean).join(' '))
    .join('; ');
}
