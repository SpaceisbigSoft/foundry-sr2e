/**
 * v0.80.0, the "SR2E Unified Rules Revamp" rules source (area: combat): pure functions. Each reads its switch in
 * RULES.URR_V80 (config80-combat.ts) and behaves the book way while the switch is at its shipped value.
 */
import { RULES, type DamageLevel } from './config.ts';
import type { TargetNumberModifier } from './dice.ts';
import { stageUp, stageDown, stageForNetSuccesses } from './damage.ts';
import { t as tx } from '../helpers/i18n.ts';
// v0.92.3 (RULES.COMBAT_V923): where the Revamp's switch has the book's procedure, the Book Rules use the same path
// through their own switch (inert under the Revamp source, so the Revamp behaves as before).
import * as C923 from './combat923.ts';

const U = () => RULES.URR_V80;
const num = (x: unknown): number => (Number.isFinite(Number(x)) ? Number(x) : 0);

// ---------------------------------------------------------------- initiative ties (URR)

/** The tie-break keys in order: the book's RULES.INITIATIVE_TIES, or Reaction then natural Reaction. */
export function cbtTieKeys(): string[] {
  // v0.92.3 (COMBAT_V923.initiativeTies 'book', Core p. 79): adjusted Reaction, then natural Reaction.
  return U().cbtTies === 'natural' || C923.tiesBook() ? ['reaction', 'naturalReaction'] : [...RULES.INITIATIVE_TIES];
}

/** One tie-break value for an actor's system data: Reaction, natural Reaction ((natural Q + natural I) ÷ 2), or an attribute. */
export function cbtTieValue(key: string, sys: any): number {
  if (key === 'reaction') return sys?.derived?.reaction ?? 0;
  if (key === 'naturalReaction') {
    const q = sys?.attributes?.quickness, i = sys?.attributes?.intelligence;
    return Math.floor((num(q?.natural ?? q?.total) + num(i?.natural ?? i?.total)) / 2);
  }
  return sys?.attributes?.[key]?.total ?? 0;
}

// ---------------------------------------------------------------- the defense flow (URR)

/** Whether the Revamp's clean-miss defense flow is on. */
export function cbtCleanMissOn(): boolean {
  return U().cbtDefense === 'cleanMiss';
}

/**
 * Whether an attack against a character takes the clean-miss path (no dodge; the pool goes to the resistance test).
 * Opposed melee, astral, Matrix, ram, flamethrower, elemental, suppressive and blast attacks keep the book path.
 */
export function cbtCleanMissRanged(a: { astral?: boolean; matrix?: boolean; ram?: unknown; flame?: boolean; elemental?: boolean; suppressive?: boolean; fixedDamage?: boolean; noDodge?: boolean } | null | undefined, opposed: boolean): boolean {
  // v0.92.3 (COMBAT_V923.rangedDefense 'book', Core pp. 87, 91): the book's ranged defense is this procedure.
  if (!(cbtCleanMissOn() || C923.rangedDefenseBook()) || !a || opposed) return false;
  return !(a.astral || a.matrix || a.ram || a.flame || a.elemental || a.suppressive || a.fixedDamage || a.noDodge);
}

/** A clean miss: the Combat Pool successes on the resistance test beat the attacker's successes. */
export function cbtCleanMiss(poolSuccesses: number, attackSuccesses: number): boolean {
  return Math.max(0, Math.floor(num(poolSuccesses))) > Math.max(0, Math.floor(num(attackSuccesses)));
}

/** Net staging: every 2 attack successes over the resistance successes stage up, every 2 under stage down (null = none). */
export function cbtNetStage(level: DamageLevel, attackSuccesses: number, resistSuccesses: number): DamageLevel | null {
  const a = Math.max(0, Math.floor(num(attackSuccesses))), r = Math.max(0, Math.floor(num(resistSuccesses)));
  const per = Math.max(1, RULES.SUCCESSES_PER_STAGE);
  if (a > r) return stageUp(level, Math.floor((a - r) / per));
  return stageDown(level, Math.floor((r - a) / per));
}

/** What an attack carries to the resistance test under the clean-miss flow: the attacker's successes and the net. */
export interface CleanMiss80 { hits: number; net: number; noClean?: boolean }

/** The resistance test's result under the clean-miss flow: the level (null = no damage), a clean miss, the card's lead. */
export function cbtSoakLevel(level: DamageLevel, cm: CleanMiss80, soakSuccesses: number, poolSuccesses: number): { level: DamageLevel | null; clean: boolean; lead: string } {
  // v0.81.1 (SEC2b-2): `cm` comes from a card's snapshot, which a forged card fills; the lead is HTML, so only whole
  // numbers go into it.
  const hits = Math.max(0, Math.floor(num(cm.hits))), net = Math.max(0, Math.floor(num(cm.net)));
  const pool = Math.max(0, Math.floor(num(poolSuccesses))), soak = Math.max(0, Math.floor(num(soakSuccesses)));
  // Review #4: in melee the URR allows a clean miss only on full defense (noClean on other melee hits).
  if (!cm.noClean && cbtCleanMiss(pool, hits)) {
    return { level: null, clean: true, lead: `${tx('SR2E.Card.Urr80Combat.poolBeatsAttack', { pool, hits })} ` };
  }
  const out = cbtNetStage(level, net, soak);
  return { level: out, clean: false, lead: `${tx('SR2E.Card.Urr80Combat.attackVsResistance', { net, soak })} ` };
}

/** The damage-state fields for an opposed-melee hit under the clean-miss flow ({} the book way): the base level, the tally. */
export function cbtMeleeDamage(baseLevel: DamageLevel, winnerSuccesses: number, net: number, fullDefense = false): { level?: DamageLevel; cleanMiss80?: CleanMiss80 } {
  if (!cbtCleanMissOn()) return {};
  return { level: baseLevel, cleanMiss80: { hits: Math.max(0, Math.floor(num(winnerSuccesses))), net: Math.max(0, Math.floor(num(net))), ...(fullDefense ? {} : { noClean: true }) } };
}

/** Full defense's extra dice: the book's attribute dice, none under the clean-miss flow. */
export function cbtFullDefenseDice(dice: number): number {
  // v0.92.3 (COMBAT_V923.fullDefense 'book', Core p. 102): no extra dice.
  return cbtCleanMissOn() || C923.fullDefenseBook() ? 0 : dice;
}

/** Combat Pool dice on the melee defense test: none on full defense under the clean-miss flow (they go to the soak). */
export function cbtMeleeDefensePool(full: boolean, pool: number): number {
  return (cbtCleanMissOn() || C923.fullDefenseBook()) && full ? 0 : pool;
}

/** The full-defense checkbox's text (attr = the attribute's name). */
export function cbtFullDefenseText(attr: string, held: boolean): string {
  if (cbtCleanMissOn() || C923.fullDefenseBook()) return held ? tx('SR2E.Text.Urr80Combat.noPoolAlreadyDeclared') : tx('SR2E.Text.Urr80Combat.noPoolUntilNextAction');
  return held ? tx('SR2E.Text.Urr80Combat.diceAlreadyDeclared', { attr }) : tx('SR2E.Text.Urr80Combat.diceAgainstEveryAttack', { attr });
}

/** The ranged Defend dialog's pool label. */
export function cbtDefendPoolLabel(left: number, cleanMiss: boolean): string {
  return cleanMiss ? tx('SR2E.Text.Urr80Combat.combatPoolDiceForResistance', { left }) : tx('SR2E.Text.Urr80Combat.combatPoolDiceLeft', { left });
}

// ---------------------------------------------------------------- knockdown (URR)

/** The knockdown test's TN: the book's (the soak TN), or half the Power (ranged) / the Power (melee). */
export function cbtKnockdownTn(o: { power: number; tn: number; melee: boolean; gel?: boolean; strength?: number | null }): number {
  // v0.92.3 (COMBAT_V923.knockdown 'book', Core pp. 92, 102): half the Power, gel the Power, melee the attacker's Strength.
  if (U().cbtKnockdown !== 'urr') return C923.knockdownBook() ? C923.knockdownTnBook(o) : o.tn;
  const p = Math.max(0, num(o.power));
  return Math.max(RULES.MIN_TARGET_NUMBER, o.melee ? Math.floor(p) : Math.floor(p * num(U().cbtKnockdownRangedFactor)));
}

/** Whether a hit calls for a knockdown test: `book` (the book's trigger), or any damage dealt. */
export function cbtKnockdownDue(book: boolean, level: DamageLevel | null): boolean {
  // v0.92.3 (COMBAT_V923.knockdown 'book'): every hit that does damage.
  if (U().cbtKnockdown !== 'urr') return C923.knockdownBook() ? RULES.COMBAT.knockdown.enabled && Boolean(level) : book;
  return RULES.COMBAT.knockdown.enabled && Boolean(level);
}

/** Extra knockdown-flag fields: the wound level under the Revamp ({} the book way). */
export function cbtKnockdownFlag(level: DamageLevel | null): { level?: DamageLevel } {
  return (U().cbtKnockdown === 'urr' || C923.knockdownBook()) && level ? { level } : {};
}

/** The knockdown test's outcome: down, or staggered back so many metres (the book: down on no successes). */
export function cbtKnockdownResult(successes: number, level?: DamageLevel | null): { down: boolean; staggerMetres: number } {
  const s = Math.max(0, Math.floor(num(successes)));
  // v0.92.3 (COMBAT_V923.knockdown 'book'): beat half the wound to stand, else 1 m back; none or Deadly: down.
  if (U().cbtKnockdown !== 'urr' && C923.knockdownBook() && level) return C923.knockdownResultBook(s, level);
  if (U().cbtKnockdown !== 'urr' || !level) return { down: s <= 0, staggerMetres: 0 };
  if (level === 'D' || s <= 0) return { down: true, staggerMetres: 0 };
  const need = num(U().cbtKnockdownNeed[level]);
  return { down: false, staggerMetres: Math.max(0, need - s) };
}

// ---------------------------------------------------------------- reloading (URR)

/** Rounds one reload action puts in: `book` (RULES.COMBAT.reloadFeed's), or Quickness rounds (break action: all). */
export function cbtReloadAmount(book: number, feed: string, ammo: number, ammoMax: number, quickness: number): number {
  // v0.92.3 (COMBAT_V923.reload 'book', Core p. 95): a cylinder or internal magazine takes Quickness rounds (a break action 2).
  if (U().cbtReload !== 'quickness' && C923.reloadBook() && ['cylinder', 'internal'].includes(feed)) {
    const room = Math.max(0, Math.floor(num(ammoMax)) - Math.max(0, Math.floor(num(ammo))));
    return Math.min(room, Math.max(1, Math.floor(num(quickness))));
  }
  if (U().cbtReload !== 'quickness' || !['cylinder', 'internal', 'break'].includes(feed)) return book;
  const room = Math.max(0, Math.floor(num(ammoMax)) - Math.max(0, Math.floor(num(ammo))));
  return feed === 'break' ? room : Math.min(room, Math.max(1, Math.floor(num(quickness))));
}

// ---------------------------------------------------------------- recoil and tracers (URR, citing Fields of Fire)

/** The recoil left after a strong shooter's reduction (none the book way, or on a vehicle mount). */
export function cbtStrengthRecoil(recoil: number, strength: number, applies: boolean): number {
  const r = Math.max(0, num(recoil));
  if (!U().cbtStrengthRecoil || !applies || r <= 0) return recoil;
  // v0.81.0 (RB-18): rows scanned highest Strength first, whatever order an override lists them in.
  const row = [...U().cbtStrengthRecoilRows].sort((a, b) => b[0] - a[0]).find(([min]) => num(strength) >= min);
  return Math.max(0, r - (row ? row[1] : 0));
}

/** Tracer rounds: the TN modifier (`bookTn` the book way) and the Power they don't add. */
export function cbtTracer(bookTn: number, o: { ammo: string; mode: string; rounds: number; smartgun: boolean; range?: string | null }): { tn: number; powerOff: number } {
  // v0.92.3 (COMBAT_V923.tracers 'book', Fields of Fire): the same, and no TN help at short range.
  const book = U().cbtTracers !== 'urr' && C923.tracersBook();
  if (U().cbtTracers !== 'urr' && !book) return { tn: bookTn, powerOff: 0 };
  if (o.ammo !== 'tracer' || o.mode !== 'FA') return { tn: 0, powerOff: 0 };
  const thirds = Math.floor(Math.max(0, num(o.rounds)) / 3);
  return { tn: o.smartgun || (book && (o.range ?? 'short') === 'short') ? 0 : -thirds, powerOff: thirds };
}

// ---------------------------------------------------------------- shotguns (URR)

/** Whether a shotgun shot spreads: always the book way; under the Revamp only with shot ammunition (a slug otherwise). */
export function cbtShotgunSpreads(ammoId: string | null | undefined): boolean {
  // v0.92.3 (COMBAT_V923.shotgun 'book', Core p. 95): a slug unless loaded with shot.
  if (U().cbtShotgun !== 'urr' && C923.shotgunBook()) return String(ammoId ?? '') === U().cbtShotAmmo;
  return U().cbtShotgun !== 'urr' || String(ammoId ?? '') === U().cbtShotAmmo;
}

/** The cone's steps at a distance: 1 m wide, doubling every choke metres; the first step counts. */
function shotSteps(metres: number, choke: number): number {
  return Math.floor(Math.max(0, num(metres)) / Math.max(1, num(choke) || 1)) + 1;
}

/** The spread at a distance: its width and the Power lost (`book`: shotgunSpread's; or the doubling cone). */
export function cbtShotgunSpread(book: { width: number; power: number; loss: number }, metres: number, choke: number, power: number): { width: number; power: number; loss: number } {
  // v0.92.3 (COMBAT_V923.shotgun 'book', Core p. 95): 1 m, then 2, 4, 6… m; −1 Power per widening.
  if (U().cbtShotgun !== 'urr' && C923.shotgunBook()) return C923.shotSpreadBook(metres, choke, power);
  if (U().cbtShotgun !== 'urr') return book;
  const steps = shotSteps(metres, choke);
  return { width: 2 ** (steps - 1), power: Math.max(0, num(power) - steps), loss: steps };
}

/** The spread's TN modifier: `book` (RULES.COMBAT.shotgunTnPerMetre's), or −1 per step of the cone. */
export function cbtShotgunTn(book: TargetNumberModifier[], metres: number, choke: number): TargetNumberModifier[] {
  // v0.92.3 (COMBAT_V923.shotgun 'book', Core p. 95): −1 TN per widening.
  if (U().cbtShotgun !== 'urr' && C923.shotgunBook()) {
    const loss = C923.shotSpreadBook(metres, choke, 0).loss;
    return loss ? [{ id: 'shotSpread', label: tx('SR2E.Card.Mod.shotSpread'), value: -loss }] : [];
  }
  if (U().cbtShotgun !== 'urr') return book;
  return [{ id: 'shotSpread', label: tx('SR2E.Card.Mod.shotSpread'), value: -shotSteps(metres, choke) }];
}

// ---------------------------------------------------------------- scatter and blasts (URR)

/** Extra blast-context fields for the Revamp's rocket and missile scatter ({} the book way). */
export function cbtScatterExtras(w: { blastKind?: string | null; name?: string | null; guidance?: number }): Record<string, unknown> {
  if ((U().cbtScatter !== 'urr' && !C923.scatterBook()) || !/rocket/i.test(String(w.blastKind ?? ''))) return {};
  const missile = /missile/i.test(String(w.name ?? '')) || num(w.guidance) > 0;
  return { rocket80: missile ? 'missile' : 'rocket', guidance80: Math.max(0, Math.floor(num(w.guidance))) };
}

type ScatterCtx = { scatterType?: string | null; rocket80?: string; guidance80?: number };

/** The scatter numbers in play: the Revamp's, the book's (v0.92.3, COMBAT_V923.scatter 'book', Core pp. 97, 99), or none. */
function scatterSet(): { perSuccess: Record<string, number>; rocket: { dice: number; perSuccess: number; perIntelligence: number }; missile: { dice: number; perSuccess: number; perIntelligence: number } } | null {
  if (U().cbtScatter === 'urr') return { perSuccess: U().cbtScatterPerSuccess, rocket: U().cbtScatterRocket, missile: U().cbtScatterMissile };
  return C923.scatterBook();
}

/** Scatter dice: rockets and missiles 2D6 under the Revamp; otherwise `base` (the book's dice). */
export function cbtScatterDice(ctx: ScatterCtx | null | undefined, base: number): number {
  const set = scatterSet();
  if (!set || !ctx?.rocket80) return base;
  return (ctx.rocket80 === 'missile' ? set.missile : set.rocket).dice;
}

/** Metres off per attack success. */
export function cbtScatterPerSuccess(ctx: ScatterCtx | null | undefined): number {
  const set = scatterSet();
  if (set) {
    if (ctx?.rocket80) return (ctx.rocket80 === 'missile' ? set.missile : set.rocket).perSuccess;
    const t = ctx?.scatterType as string | undefined;
    if (t && t in set.perSuccess) return num(set.perSuccess[t]);
  }
  return RULES.COMBAT.scatter.metresPerSuccess;
}

/** How far the blast lands from its point (`book`: scatterMetres'): the dice less the success metres (and a missile's Intelligence). */
export function cbtScatterMetres(book: number, dice: readonly number[], successes: number, ctx: ScatterCtx | null | undefined): number {
  const set = scatterSet();
  if (!set) return book;
  const g = ctx?.rocket80 ? num(ctx.guidance80) * (ctx.rocket80 === 'missile' ? set.missile : set.rocket).perIntelligence : 0;
  return Math.max(0, dice.reduce((a, b) => a + b, 0) - Math.max(0, num(successes)) * cbtScatterPerSuccess(ctx) - g);
}

/** A blast whose successes stage its damage up (the same context the book way). */
export function cbtBlastStaged<T extends { level: DamageLevel; successes?: number }>(ctx: T): T {
  if (!U().cbtBlastStaging || !(num(ctx.successes) > 0)) return ctx;
  return { ...ctx, level: stageForNetSuccesses(ctx.level, num(ctx.successes)) };
}

// ---------------------------------------------------------------- melee extras (URR)

/** Subduing's TN modifier (none the book way). */
export function cbtSubdueMods(subdue: boolean): TargetNumberModifier[] {
  const v = num(U().cbtSubdueTn);
  return subdue && v ? [{ id: 'subduing', label: tx('SR2E.Card.Mod.subduing'), value: v }] : [];
}

/** A charging attack's extra Power (none the book way). */
export function cbtChargePower(charging: boolean): number {
  return charging ? Math.max(0, num(U().cbtChargePower)) : 0;
}

// ---------------------------------------------------------------- armor (layering: URR; Combat Pool: house rule for the Revamp, not in the URR)

/** Armor encumbrance on Quickness: `book` (encumbrancePenalty's), or none when armor costs Combat Pool instead. */
export function cbtEncumbrance(book: number): number {
  // v0.92.3 (COMBAT_V923.armorPenalty 'pool', Dice Pools p. 85): heavy armor costs Combat Pool dice, not Quickness.
  return U().cbtArmorPool === 'pool' || C923.armorPoolBook() ? 0 : book;
}

/** The Attack dialog's charging label: the TN (and the Power under the Revamp). */
export function cbtChargeLabel(): string {
  const tn = RULES.COMBAT.charging.tn, p = Math.max(0, num(U().cbtChargePower));
  const t = `${tn > 0 ? '+' : ''}${tn}`;
  if (!p) return t;
  return `${tn ? `${t} TN, ` : ''}+${p} Power`;
}

/** Combat Pool dice lost to worn ballistic armor above Quickness (0 the book way). */
export function cbtArmorPoolPenalty(ballistic: number, quickness: number): number {
  if ((U().cbtArmorPool !== 'pool' && !C923.armorPoolBook()) || !RULES.COMBAT.encumbrance.enabled) return 0;
  return Math.max(0, Math.floor(num(ballistic)) - Math.max(0, Math.floor(num(quickness))));
}

// ---------------------------------------------------------------- graded cover (URR)

/** Whether a situational id is partial cover (the found-by-itself +4 isn't added on top of one). */
export function cbtIsCoverId(id: string): boolean {
  return id === 'partialCover' || (U().cbtGradedCover && U().cbtCoverIds.includes(id));
}
