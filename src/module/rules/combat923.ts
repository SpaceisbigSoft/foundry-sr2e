/**
 * v0.92.3 book alignment (area: combat): pure functions for RULES.COMBAT_V923 (config923/combat.ts). Each switch acts
 * only under the Book Rules source: under the Unified Rules Revamp (RULES.URR_V80.active) every function here answers
 * the v0.92.2 way, so the Revamp keeps its own rules unchanged.
 */
import { RULES, type DamageLevel } from './config.ts';
import type { TargetNumberModifier } from './dice.ts';
import { t as tx } from '../helpers/i18n.ts';

const V = () => RULES.COMBAT_V923;
const num = (x: unknown): number => (Number.isFinite(Number(x)) ? Number(x) : 0);

type Sw = typeof RULES.COMBAT_V923;
/** Whether a switch is at the given value, never under the Revamp source. */
function is<K extends keyof Sw>(key: K, value: Sw[K]): boolean {
  return !RULES.URR_V80?.active && V()[key] === value;
}

// ---------------------------------------------------------------- defense (Core pp. 87, 91, 102)

/** Ranged defense the book's way: no dodge, the pool goes to the resistance test (Core p. 91). */
export function rangedDefenseBook(): boolean { return is('rangedDefense', 'book'); }

/** Full defense the book's way: no extra dice, no pool on the melee test, a clean miss at the soak (Core p. 102). */
export function fullDefenseBook(): boolean { return is('fullDefense', 'book'); }

/** Initiative that declaring full defense out of turn costs: none the book's way. */
export function fullDefenseInitiativeCost(): number {
  return fullDefenseBook() ? 0 : Math.max(0, num(RULES.COMBAT.fullDefense.initiativeCost));
}

/**
 * The clean-miss tally a melee hit on a full-defense defender carries to the soak the book's way: the attacker's
 * successes (the clean-miss check) and `apart` (the hit was already staged by the net melee successes; the soak
 * stages down on its own). Null when the rule isn't in play.
 */
export function fullDefenseTally(attackSuccesses: number, net: number, fullDefense: boolean): { hits: number; net: number; apart: true } | null {
  if (!fullDefense || !fullDefenseBook() || RULES.URR_V80.cbtDefense === 'cleanMiss') return null;
  return { hits: Math.max(0, Math.floor(num(attackSuccesses))), net: Math.max(0, Math.floor(num(net))), apart: true };
}

// ---------------------------------------------------------------- Combat Pool refresh (Core pp. 78, 84)

/** Whether the Combat Pool refreshes at each of the character's actions (not at the new Combat Turn). */
export function poolRefreshPerAction(): boolean { return is('poolRefresh', 'action'); }

/** The key of one action (round, pass, combatant): the pool refreshes once per key. */
export function actionKey(o: { combatId: string; round: number; pass: number; combatantId: string }): string {
  return `${o.combatId}|${num(o.round)}|${num(o.pass)}|${o.combatantId}`;
}

// ---------------------------------------------------------------- knockdown (Core pp. 92, 102)

export function knockdownBook(): boolean { return is('knockdown', 'book'); }

/**
 * The knockdown test's TN the book's way: ranged half the Power (round down), gel rounds the Power, melee the
 * attacker's Strength (the Power when unknown); never below the minimum TN.
 */
export function knockdownTnBook(o: { power: number; melee: boolean; gel?: boolean; strength?: number | null }): number {
  const p = Math.max(0, Math.floor(num(o.power)));
  const tn = o.melee ? (o.strength != null && num(o.strength) > 0 ? Math.floor(num(o.strength)) : p) : o.gel ? p : Math.floor(p / 2);
  return Math.max(RULES.MIN_TARGET_NUMBER, tn);
}

/** The threshold to beat: half the wound, rounded off (L 1, M 2, S 3); Deadly always knocks down. */
const THRESHOLD: Record<DamageLevel, number> = { L: 1, M: 2, S: 3, D: 99 };

/** The book's outcome: down (none, or Deadly), staggered 1 m (some, not past the threshold), or standing. */
export function knockdownResultBook(successes: number, level: DamageLevel): { down: boolean; staggerMetres: number } {
  const s = Math.max(0, Math.floor(num(successes)));
  if (level === 'D' || s <= 0) return { down: true, staggerMetres: 0 };
  return { down: false, staggerMetres: s > THRESHOLD[level] ? 0 : 1 };
}

// ---------------------------------------------------------------- blasts (Core p. 97)

/** The tally a blast's damage carries to each target's soak the book's way (null: the v0.92.2 way). */
export function blastTally(successes: number): { hits: number; net: number; noClean: true } | null {
  if (!is('blastStaging', 'book') || RULES.URR_V80.cbtBlastStaging) return null;
  const s = Math.max(0, Math.floor(num(successes)));
  return { hits: s, net: s, noClean: true };
}

// ---------------------------------------------------------------- scatter (Core pp. 97, 99)

/** The book's scatter numbers (null: not in play). */
export function scatterBook(): { perSuccess: Record<string, number>; rocket: { dice: number; perSuccess: number; perIntelligence: number }; missile: { dice: number; perSuccess: number; perIntelligence: number } } | null {
  if (!is('scatter', 'book')) return null;
  return { perSuccess: V().scatterPerSuccess, rocket: V().scatterRocket, missile: V().scatterMissile };
}

// ---------------------------------------------------------------- shotguns (Core p. 95)

export function shotgunBook(): boolean { return is('shotgun', 'book'); }

/** The choke a shotgun can be set to the book's way (2–10); unchanged otherwise. */
export function shotgunChoke(choke: number): number {
  if (!shotgunBook()) return choke;
  const c = V().shotgunChoke;
  return Math.min(num(c.max) || 10, Math.max(num(c.min) || 2, Math.floor(num(choke) || 0)));
}

/**
 * Shot at a distance the book's way: 1 m wide for the first choke metres, then 2, 4, 6… m; every widening −1 Power
 * (and −1 TN). `power` is what is left.
 */
export function shotSpreadBook(metres: number, choke: number, power: number): { width: number; power: number; loss: number } {
  const c = Math.max(1, num(choke) || 1);
  const m = Math.max(0, num(metres));
  const loss = m <= 0 ? 0 : Math.max(0, Math.ceil(m / c) - 1);
  return { width: loss === 0 ? 1 : 2 * loss, power: Math.max(0, num(power) - loss), loss };
}

// ---------------------------------------------------------------- the rest

export function tracersBook(): boolean { return is('tracers', 'book'); }
export function reloadBook(): boolean { return is('reload', 'book'); }
export function tiesBook(): boolean { return is('initiativeTies', 'book'); }
export function meleeTargetsBook(): boolean { return is('meleeTargets', 'book'); }
export function spreadFireBook(): boolean { return is('spreadFire', 'book'); }
export function barriersBook(): boolean { return is('barriers', 'book'); }
export function delayBook(): boolean { return is('delay', 'book') && !RULES.DELAY.lostAtPassEnd; }

/** Whether friends in melee are counted on both sides the book's way (Core p. 102). */
export function friendsNetBook(): boolean { return is('friends', 'book'); }

/**
 * Friends in melee the book's way: the side with more friends in the fight takes −1 per friend more (at most −4), the
 * side with fewer +1 per friend fewer (at most +4). Null when not in play (the v0.92.2 friendsModifiers).
 */
export function friendsNet(friends: number, foes: number): TargetNumberModifier[] | null {
  if (!friendsNetBook()) return null;
  const net = Math.max(0, Math.floor(num(friends))) - Math.max(0, Math.floor(num(foes)));
  const max = Math.max(0, num(RULES.COMBAT.friendsInMelee.max));
  if (!net) return [];
  return net > 0
    ? [{ id: 'friendsInMelee', label: tx('SR2E.Card.Mod.friendsInMelee', { n: Math.min(max, net) }), value: -Math.min(max, net) }]
    : [{ id: 'foesInMelee', label: tx('SR2E.Card.Mod.foesInMelee', { n: Math.min(max, -net) }), value: Math.min(max, -net) }];
}

/** Whether the armor-gap called shot is offered (not the book's way, Core p. 92). */
export function calledShotGap(): boolean { return !is('calledShot', 'book'); }

/** A called shot the book's way: none in full auto, and no armor gap (Core p. 92). */
export function calledShotAllowed<T extends string>(effect: T, fullAuto: boolean): T | 'none' {
  if (!is('calledShot', 'book') || effect === 'none') return effect;
  return fullAuto || effect === 'armor' ? 'none' : effect;
}

/** The least Take Aim allows with a skill: 0 the book's way (half the skill, rounded down, Core p. 82), else 1. */
export function aimFloor(): number { return is('aim', 'book') ? 0 : 1; }

/** Rounds a full-auto burst wastes walking the fire: none for a smartgun with a smartlink the book's way. */
export function walkingWaste(wasted: number, smartlinked: boolean): number {
  return smartlinked && spreadFireBook() ? 0 : wasted;
}

/** Full auto at several targets the book's way: + TN per new target before this one (index 0 is the first). */
export function spreadTargetModifiers(index: number): TargetNumberModifier[] {
  const v = Math.max(0, Math.floor(num(index))) * num(V().spreadTnPerTarget);
  return v ? [{ id: 'spreadTargets', label: tx('SR2E.Card.Mod.spreadOverTargets', { value: index + 1 }), value: v }] : [];
}

/** Subduing in melee: the TN modifier the book's way (none under the Revamp: its own cbtSubdueTn). */
export function subdueMods(subdue: boolean): TargetNumberModifier[] {
  if (!subdue || RULES.URR_V80.active) return [];
  const v = num(V().subdueTn);
  return v ? [{ id: 'subduing', label: tx('SR2E.Card.Mod.subduing'), value: v }] : [];
}

/** Flechette against armor the book's way: the higher of double Impact and plain Ballistic (null: not in play). */
export function flechetteArmorBook(ballistic: number, impact: number, multiplier: number): { armor: number; note: string } | null {
  if (!is('flechette', 'book')) return null;
  const b = Math.max(0, Math.floor(num(ballistic))), i = Math.max(0, Math.floor(num(impact)));
  const m = Math.max(0, num(multiplier));
  const fromImpact = Math.floor(i * m);
  return fromImpact >= b
    ? { armor: fromImpact, note: tx('SR2E.Text.Docs79Ranged.flechetteVsArmorImpact', { best: i, m }) }
    : { armor: b, note: tx('SR2E.Text.Combat923.flechetteVsBallistic', { best: b }) };
}

/**
 * A barrier fired through the book's way: its rating counts double against flechette and explosive rounds; a
 * barrier rated above the attack's (base) Power stops it (Core pp. 93, 98). Null when not in play.
 */
export function barrierThrough(o: { rating: number; power: number; ammoId?: string | null }): { armor: number; stops: boolean } | null {
  if (!barriersBook()) return null;
  const r = Math.max(0, Math.floor(num(o.rating)));
  if (!r) return null;
  const id = String(o.ammoId ?? '');
  const doubled = ['flechette', 'explosive', 'exex'].includes(id) || (RULES.DOCS_V79.rangedFlechette.ammoIds as readonly string[]).includes(id);
  const armor = doubled ? r * 2 : r;
  return { armor, stops: armor > Math.max(0, num(o.power)) };
}

/** A burst short of rounds the book's way: 2 rounds +2 Power and no extra level (+2 recoil), 1 round a single shot. */
export function shortBurst(rounds: number, ammoLeft: number): { rounds: number; power: number; stages: number; recoil: number } | null {
  if (!is('shortBurst', 'book')) return null;
  const left = Math.max(0, Math.floor(num(ammoLeft)));
  if (left >= rounds || left <= 0) return null;
  return left === 2 ? { rounds: 2, power: 2, stages: 0, recoil: 2 } : { rounds: 1, power: 0, stages: 0, recoil: 0 };
}

/**
 * Aiming aids that don't apply (Core pp. 90, 95): a second firearm cancels smartlink, smart goggles and laser sight;
 * shotgun shot takes no goggles or laser and only −1 from a smartlink (`smartlinkAdd` brings the −2 row to −1).
 */
export function sightAidsDropped(o: { melee: boolean; secondWeapon: boolean; shot: boolean }): { drop: string[]; why: 'second' | 'shot' | ''; smartlinkAdd: number } {
  if (o.melee) return { drop: [], why: '', smartlinkAdd: 0 };
  if (o.secondWeapon && is('secondFirearm', 'book')) return { drop: ['smartlink', 'smartGoggles', 'laserSight'], why: 'second', smartlinkAdd: 0 };
  if (o.shot && shotgunBook()) {
    const row = RULES.SITUATIONAL_MODIFIERS.find((m) => m.id === 'smartlink')?.value ?? 0;
    return { drop: ['smartGoggles', 'laserSight'], why: 'shot', smartlinkAdd: row < -1 ? -1 - row : 0 };
  }
  return { drop: [], why: '', smartlinkAdd: 0 };
}

/** The surprise test's TN change for an ambusher waiting on a delayed action (Core p. 86). */
export function ambushTn(delaying: boolean): number {
  return delaying && is('ambush', 'book') ? num(V().ambushTn) : 0;
}

/** Whether a delay flag from `flag.round` still holds at `round` (the book: it carries into the next Combat Turn). */
export function delayCarries(flagRound: number, round: number): boolean {
  return delayBook() && num(flagRound) === num(round) - 1;
}

/** Whether a SITUATIONAL_MODIFIERS row shows in the Attack dialog (the v0.92.3 rows can be hidden). */
export function rangedRowShown(id: string): boolean {
  return V().rangedRows || !V().rangedRowIds.includes(id);
}

/** Visibility in melee the book's way: half (round down), except full darkness (Core p. 102). */
export function meleeVisibility(m: TargetNumberModifier | null | undefined, darkness = false): TargetNumberModifier | null {
  if (!m) return null;
  if (darkness || !is('meleeVisibility', 'half')) return m;
  const v = Math.floor(num(m.value) / 2);
  return v ? { ...m, label: tx('SR2E.Card.Mod.meleeHalf', { label: m.label }), value: v } : null;
}

/**
 * The soak's level under the book's full-defense tally (`apart`): a clean miss when the pool's successes alone beat
 * the attacker's, else the hit (already staged) comes down one level per 2 resistance successes.
 */
export function apartSoak(level: DamageLevel, hits: number, soakSuccesses: number, poolSuccesses: number): { level: DamageLevel | null; clean: boolean } {
  const pool = Math.max(0, Math.floor(num(poolSuccesses))), h = Math.max(0, Math.floor(num(hits)));
  if (pool > h) return { level: null, clean: true };
  const order: DamageLevel[] = ['L', 'M', 'S', 'D'];
  const i = order.indexOf(level) - Math.floor(Math.max(0, Math.floor(num(soakSuccesses))) / Math.max(1, RULES.SUCCESSES_PER_STAGE));
  return { level: i < 0 ? null : order[i]!, clean: false };
}
