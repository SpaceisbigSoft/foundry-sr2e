import { RULES, type DamageLevel } from './config.ts';
import { DAMAGE_LEVELS as LEVELS, own } from './util.ts';
import { t as tx } from '../helpers/i18n.ts';
import { gearBook } from './gear923.ts';

/**
 * Gear and combat (v0.43.0): concealment and scanners, weapon accessories, spells against vehicles,
 * shields, airburst / impact / smart grenades and bounced throws, wall repair, cyberware damaged by
 * attacks, and cyberlimbs' own Quickness and armor. Pure rules; no Foundry.
 */

const G = () => RULES.GEAR;

// ---------------------------------------------------------------- Concealment and scanners

export type SearchMethod = 'look' | 'frisk' | 'scanner';
export type ScannerKind = '' | 'weapon' | 'cyber' | 'explosive';

/** What a carried item looks like to a search. */
export interface CarriedItem {
  id: string;
  name: string;
  type: string;
  concealability: number;
  /** Armor: worn. Cyberware: installed. Others: carried. */
  worn?: boolean;
  bioware?: boolean;
  /** Cyberware kind (cyberweapon, cyberlimb...). */
  kind?: string;
  /** An explosive (gear with explosive Power, or a blast weapon). */
  explosive?: boolean;
}

/** One item a search tests for: the TN, or null when it can't be hidden (always found). */
export interface SearchTarget { id: string; name: string; type: string; tn: number | null }

/** The items a search can turn up, and the TN for each (RULES.GEAR.concealment). */
export function searchTargets(items: readonly CarriedItem[], method: SearchMethod, scanner: ScannerKind = ''): SearchTarget[] {
  const c = G().concealment;
  const min = RULES.MIN_TARGET_NUMBER;
  const out: SearchTarget[] = [];
  const conc = (i: CarriedItem) => Math.max(0, Math.floor(Number(i.concealability) || 0));
  for (const i of items) {
    if (method === 'scanner') {
      let hit = false;
      if (scanner === 'weapon') hit = i.type === 'weapon' || (c.weaponFindsCyberweapons && i.type === 'cyberware' && i.kind === 'cyberweapon' && i.worn !== false);
      else if (scanner === 'cyber') hit = i.type === 'cyberware' && !i.bioware && i.worn !== false;
      else if (scanner === 'explosive') hit = Boolean(i.explosive);
      if (!hit) continue;
      out.push({ id: i.id, name: i.name, type: i.type, tn: Math.max(min, conc(i) > 0 ? conc(i) : c.defaultTn) });
      continue;
    }
    const k = conc(i);
    if (i.type === 'cyberware' && (i.worn === false || i.bioware)) continue;
    if (i.type === 'armor' && i.worn === false) continue;
    if (k <= 0) {
      // Weapons and worn armor can't be hidden without a Concealability; other gear isn't looked for.
      if (i.type === 'weapon' || i.type === 'armor') out.push({ id: i.id, name: i.name, type: i.type, tn: null });
      continue;
    }
    out.push({ id: i.id, name: i.name, type: i.type, tn: Math.max(min, k + (method === 'frisk' ? c.friskTn : 0)) });
  }
  return out;
}

/** Whether a search's successes against one item find it. */
export function searchFinds(successes: number): boolean {
  return successes >= Math.max(1, G().concealment.minSuccesses);
}

// ---------------------------------------------------------------- Weapon accessories

/** Recoil compensation from accessories: a shock pad always, a bipod or tripod once set up. */
export function accessoryRecoil(w: { shockPad?: boolean; support?: string; supportSetUp?: boolean }, prone = false): { value: number; parts: string[] } {
  const a = G().accessories;
  const parts: string[] = [];
  let value = 0;
  if (w.shockPad) { value += a.shockPad; parts.push(`shock pad ${a.shockPad}`); }
  const s = String(w.support ?? 'none');
  const rc = own(a.support, s) ?? 0;
  if (rc > 0 && (w.supportSetUp || (prone && a.proneIsSetUp))) { value += rc; parts.push(`${s} ${rc}`); }
  return { value, parts };
}

/** The magnification an attack can use: the scope's and the cyber eyes' (the better, or both with `scopeStacks`). */
export function attackMagnification(scope: number, cyber: number): number {
  const a = G().accessories;
  const max = RULES.CYBERWARE.magnification.maxLevel;
  const s = Math.max(0, Math.floor(scope || 0));
  const c = Math.max(0, Math.floor(cyber || 0));
  return Math.min(max, a.scopeStacks ? s + c : Math.max(s, c));
}

/** The situational rows an attack ends up with: a laser sight is dropped next to a smartlink. */
export function laserAndSmartlink(situational: readonly string[]): { situational: string[]; dropped: boolean } {
  const list = [...situational];
  if (G().accessories.laserNotWithSmartlink && list.includes('smartlink') && list.includes('laserSight')) {
    return { situational: list.filter((x) => x !== 'laserSight'), dropped: true };
  }
  return { situational: list, dropped: false };
}

// ---------------------------------------------------------------- Spells against vehicles

/** Whether a spell can affect a vehicle, and the caster's TN against it (its Object Resistance). */
export function spellVsVehicle(o: { spellType: string; objectResistance?: number }): { ok: boolean; tn: number; reason: string } {
  const v = G().spellsVsVehicles;
  const tn = Math.max(RULES.MIN_TARGET_NUMBER, Math.floor(Number(o.objectResistance) || 0) || v.objectResistance);
  if (o.spellType === 'mana' && !v.manaAffects) return { ok: false, tn, reason: 'mana spells only affect living things' };
  return { ok: true, tn, reason: '' };
}

// ---------------------------------------------------------------- Shields

/** The best worn shield's Parry rating, as dice or a TN modifier on melee defense. */
export function shieldParry(armor: ReadonlyArray<{ name: string; worn?: boolean; parry?: number }>): { dice: number; tn: number; name: string } {
  const best = armor.filter((a) => a.worn && (a.parry ?? 0) > 0).sort((a, b) => (b.parry ?? 0) - (a.parry ?? 0))[0];
  if (!best) return { dice: 0, tn: 0, name: '' };
  const p = Math.floor(best.parry ?? 0);
  return G().shields.parryAs === 'tn' ? { dice: 0, tn: -p, name: best.name } : { dice: p, tn: 0, name: best.name };
}

// ---------------------------------------------------------------- Grenades

/** Scatter dice for a blast: by range band, plus extra for a bounced throw. */
export function blastScatterDice(base: number, bounce: boolean): number {
  return Math.max(0, base + (bounce ? G().grenades.bounce.extraDice : 0));
}

/** Metres of scatter after the fuse and a smart grenade's guidance (the dice total less success metres already applied). */
export function fusedScatter(metres: number, o: { fuse?: string; smart?: boolean; successes?: number }): number {
  const g = G().grenades;
  let m = Math.max(0, metres);
  if (o.smart) m = Math.max(0, m - Math.max(0, o.successes ?? 0) * g.smart.metresPerSuccess);
  if (o.fuse === 'airburst') m = Math.floor(m * g.airburst.scatterFactor);
  return m;
}

/** Whether a landed grenade can be thrown back (not rockets, charges, airburst or impact fuses). */
export function canThrowBack(kind: string, fuse: string): boolean {
  const g = G().grenades;
  if (['heRocket', 'apRocket', 'avRocket', 'demolition'].includes(kind) || /Rocket|charge/i.test(kind)) return false;
  if (fuse === 'airburst') return g.airburst.throwBack;
  if (fuse === 'impact') return g.impact.throwBack;
  return true;
}

/** Whether a scattering grenade stops at the first wall on its way. */
export function stopsAtWalls(fuse: string): boolean {
  return RULES.COMBAT.stopAtWalls && !(fuse === 'airburst' && G().grenades.airburst.ignoreWalls);
}

/** How far a throw can be aimed off its target (metres, clamped to RULES.GEAR.grenades.aimOffMetres). */
export function aimOffMetres(metres: number): number {
  return Math.max(0, Math.min(G().grenades.aimOffMetres, Math.floor(Number(metres) || 0)));
}

export const BEARINGS: ReadonlyArray<{ id: string; label: string; deg: number }> = [
  { id: 'n', label: 'north', deg: 0 }, { id: 'ne', label: 'north-east', deg: 45 }, { id: 'e', label: 'east', deg: 90 }, { id: 'se', label: 'south-east', deg: 135 },
  { id: 's', label: 'south', deg: 180 }, { id: 'sw', label: 'south-west', deg: 225 }, { id: 'w', label: 'west', deg: 270 }, { id: 'nw', label: 'north-west', deg: 315 },
];

// ---------------------------------------------------------------- Walls

/** A repaired wall's rating: its original (`full`), or up by successes × the repair rate, to the original. */
export function wallRepair(o: { rating: number; original: number; successes?: number; full?: boolean }): number {
  const orig = Math.max(0, o.original);
  if (o.full) return orig;
  return Math.min(orig, Math.max(0, o.rating) + Math.max(0, o.successes ?? 0) * G().walls.repairPerSuccess);
}

// ---------------------------------------------------------------- Cyberware damaged by attacks

/** Whether a hit calls for a cyberware damage check: Physical damage at the threshold level or worse. */
export function cyberDamageDue(level: DamageLevel | null, type: string): boolean {
  const c = G().cyberDamage;
  if (c.mode === 'off' || !level || type !== 'physical') return false;
  // v0.92.3 (RULES.GEAR_V923.cyberDamage 'book', Shadowtech p. 36): any Serious or Deadly physical wound.
  if (gearBook('cyberDamage')) return level === 'S' || level === 'D';
  return LEVELS.indexOf(level) >= LEVELS.indexOf(c.atLevel);
}

export interface CyberPiece { id: string; name: string; bioware?: boolean; damaged?: boolean; kind?: string; housedIn?: string; location?: string }

/** The cyberware a hit can damage, each with its chance on 1d6 (the called limb, and what it houses, higher). */
export function cyberDamageChances(ware: readonly CyberPiece[], calledLocation = ''): Array<{ id: string; name: string; chance: number }> {
  const c = G().cyberDamage;
  const limb = calledLocation ? ware.find((w) => w.kind === 'cyberlimb' && w.location === calledLocation) : null;
  return ware.filter((w) => !w.damaged && (c.bioware || !w.bioware)).map((w) => ({
    id: w.id, name: w.name,
    chance: limb && (w.id === limb.id || w.housedIn === limb.id) ? Math.max(c.chance, c.calledChance) : c.chance,
  })).filter((x) => x.chance > 0);
}

// ---------------------------------------------------------------- Cyberlimbs

export const LIMB_LABELS: Record<string, string> = { leftArm: 'Left arm', rightArm: 'Right arm', leftLeg: 'Left leg', rightLeg: 'Right leg', other: 'Other' };

/** Armor from cyberlimbs that counts against a hit: all of it, or only a called shot's limb (`armorCalledOnly`). */
export function limbArmorFor(limbs: ReadonlyArray<{ location: string; ballistic: number; impact: number }>, kind: 'ballistic' | 'impact', calledLocation = ''): number {
  if (!G().cyberlimbs.armorCalledOnly) return limbs.reduce((n, l) => n + (l[kind] ?? 0), 0);
  if (!calledLocation) return 0;
  return limbs.filter((l) => l.location === calledLocation).reduce((n, l) => n + (l[kind] ?? 0), 0);
}

// ---------------------------------------------------------------- Combat and gear (v0.47.0)

type Attr = 'body' | 'quickness' | 'strength' | 'charisma' | 'intelligence' | 'willpower';
const MELEE_STRENGTH = /armed|edged|club|unarmed|martial|polearm|staff|whip|blade|cyber-implant/i;

/** The attribute a melee attack defaults to without the skill (RULES.COMBAT.melee.defaultAttribute). */
export function meleeDefaultAttribute(skillName: string, owned?: string | null): Attr {
  const mode = RULES.COMBAT.melee.defaultAttribute;
  if (mode === 'quickness' || mode === 'strength') return mode;
  if (owned) return owned as Attr;
  return MELEE_STRENGTH.test(skillName ?? '') ? 'strength' : 'quickness';
}

export const THROW_LABELS = ['beyond the target', 'beyond and to the right', 'short and to the right', 'short of the target', 'short and to the left', 'beyond and to the left'];
export const COMPASS = ['north', 'north-east', 'south-east', 'south', 'south-west', 'north-west'];

/**
 * A scatter direction die read on the diagram: along the throw (1 = beyond, clockwise every 60°)
 * from the throw's bearing, or on the compass (1 = north). Angle in degrees clockwise from north.
 */
export function scatterDirection(die: number, throwBearing: number | null): { angleDeg: number; label: string; along?: boolean } {
  const d = Math.max(1, Math.min(6, Math.floor(die || 1))) - 1;
  if (RULES.COMBAT.scatter.diagram === 'throw' && throwBearing !== null && Number.isFinite(throwBearing)) {
    const angleDeg = ((throwBearing + d * 60) % 360 + 360) % 360;
    // v0.89.5: `along` says the label is relative to the throw (read by the card, never from the label's words).
    return { angleDeg, label: THROW_LABELS[d]!, along: true };
  }
  return { angleDeg: d * 60, label: COMPASS[d]! };
}

/** Looking over or scanning several people at once: the TN per person after the first. */
export function groupSearchModifiers(people: number): Array<{ label: string; value: number }> {
  const extra = Math.max(0, Math.floor(people) - 1) * G().concealment.groupTnPerPerson;
  return extra ? [{ label: tx('SR2E.Card.Mod.searchingPeopleAtOnce', { people }), value: extra }] : [];
}

/** Whether a laser sight reaches the target (unknown distance: yes). */
export function laserInRange(metres: number | null | undefined): boolean {
  const max = G().accessories.laserRangeMetres;
  return !(max > 0) || metres == null || metres <= max;
}

/** The vision used for an attack: the attacker's, plus the weapon's scope's mode. */
export function withScopeVision<T extends { lowLight?: boolean; thermographic?: boolean; ultrasound?: boolean }>(vision: T, scopeVision: string | null | undefined): T {
  if (!G().accessories.scopeVision || !scopeVision) return vision;
  return { ...vision, ...(scopeVision === 'lowLight' ? { lowLight: true } : {}), ...(scopeVision === 'thermographic' ? { thermographic: true } : {}) };
}

/** An object's Object Resistance (spells against objects). */
export function objectResistanceTn(kind: string): number {
  const t = G().spellsVsObjects.tns;
  return Math.max(RULES.MIN_TARGET_NUMBER, own(t, kind) ?? own(t, G().spellsVsObjects.wallKind) ?? 5);
}

/** A physical combat spell's Power against a wall: Force plus net successes. */
export function objectSpellPower(force: number, successes: number): number {
  return Math.max(0, Math.floor(force)) + Math.max(0, successes) * G().spellsVsObjects.powerPerSuccess;
}

/** The TN to disarm a charge set with this many successes. */
export function chargeDisarmTn(setterSuccesses: number): number {
  const d = G().disarm;
  return Math.max(RULES.MIN_TARGET_NUMBER, d.baseTn + Math.max(0, setterSuccesses || 0) * d.tnPerSetterSuccess);
}

/** A shield's Parry dice against a ranged attack (0 when shields help only in melee). */
export function rangedShieldDice(parry: number): number {
  return G().shields.ranged === 'dice' ? Math.max(0, Math.floor(parry || 0)) : 0;
}
