/**
 * v0.92.1: custom tweaks on items (the owner's choice, 2 Nov 2026, after a friend's view on character builders: automated
 * systems struggle with bespoke tweaks, so the record sheet must take them). Any item can carry free-form modifiers, each
 * with a label: an attribute, Reaction, initiative dice, a dice pool, a skill's dice or TN, damage Power, armor, or a plain
 * note. They count while the item does (rules below) and while RULES.SHEET_V921.tweaks is 'on'.
 *
 * Pure: the tweak's shape and its cleaning, when an item counts, the sums the character's derived data adds, and the text
 * the sheets show. The Foundry glue is in models/index.ts (derived data), documents/index.ts (attack Power) and
 * applications/sheets.ts (the item sheet's rows).
 */
import { RULES } from './config.ts';
import { t as tx, tKey } from '../helpers/i18n.ts';

export const TWEAK_TARGETS = ['attribute', 'reaction', 'initiativeDice', 'pool', 'skillDice', 'skillTn', 'damage', 'armor', 'note'] as const;
export type TweakTarget = typeof TWEAK_TARGETS[number];

export const TWEAK_ATTRIBUTES = ['body', 'quickness', 'strength', 'charisma', 'intelligence', 'willpower'] as const;
export const TWEAK_POOLS = ['combat', 'spell', 'hacking', 'control', 'task'] as const;
/** Damage: 'self' = this weapon's attacks (on a weapon; elsewhere it counts as 'all'), or every melee / ranged / any attack. */
export const TWEAK_DAMAGE = ['self', 'melee', 'ranged', 'all'] as const;
export const TWEAK_ARMOR = ['ballistic', 'impact'] as const;

/** The keys a target takes: a fixed list, free text (a skill's name) or none. */
export const TWEAK_KEYS: Record<TweakTarget, readonly string[] | 'text' | null> = {
  attribute: TWEAK_ATTRIBUTES, reaction: null, initiativeDice: null, pool: TWEAK_POOLS,
  skillDice: 'text', skillTn: 'text', damage: TWEAK_DAMAGE, armor: TWEAK_ARMOR, note: null,
};

/** The language keys of the labels (literal, so the translation checks see each one). */
export const TWEAK_TARGET_KEYS: Record<TweakTarget, string> = {
  attribute: 'SR2E.Text.Tweaks.target.attribute', reaction: 'SR2E.Text.Tweaks.target.reaction', initiativeDice: 'SR2E.Text.Tweaks.target.initiativeDice',
  pool: 'SR2E.Text.Tweaks.target.pool', skillDice: 'SR2E.Text.Tweaks.target.skillDice', skillTn: 'SR2E.Text.Tweaks.target.skillTn',
  damage: 'SR2E.Text.Tweaks.target.damage', armor: 'SR2E.Text.Tweaks.target.armor', note: 'SR2E.Text.Tweaks.target.note',
};
const POOL_KEYS: Record<string, string> = {
  combat: 'SR2E.Text.Tweaks.pools.combat', spell: 'SR2E.Text.Tweaks.pools.spell', hacking: 'SR2E.Text.Tweaks.pools.hacking',
  control: 'SR2E.Text.Tweaks.pools.control', task: 'SR2E.Text.Tweaks.pools.task',
};
const SCOPE_KEYS: Record<string, string> = {
  self: 'SR2E.Text.Tweaks.scope.self', melee: 'SR2E.Text.Tweaks.scope.melee', ranged: 'SR2E.Text.Tweaks.scope.ranged', all: 'SR2E.Text.Tweaks.scope.all',
};
const ARMOR_KEYS: Record<string, string> = { ballistic: 'SR2E.Text.Tweaks.armorKind.ballistic', impact: 'SR2E.Text.Tweaks.armorKind.impact' };

/** The most tweaks an item keeps, and the largest value one can have. */
export const TWEAK_MAX = 24;
export const TWEAK_VALUE_MAX = 20;

export interface Tweak { id: string; label: string; target: TweakTarget; key: string; value: number; on: boolean }

const str = (v: unknown, max = 80): string => String(v ?? '').replace(/[\u0000-\u001f]+/g, ' ').trim().slice(0, max);
const int = (v: unknown): number => { const n = Math.trunc(Number(v)); return Number.isFinite(n) ? n : 0; };

/** A tweak cleaned: a known target, a key that fits it, a whole value within ±TWEAK_VALUE_MAX. Null when it can't be one. */
export function normalizeTweak(raw: unknown, idFor: () => string = () => Math.random().toString(36).slice(2, 10)): Tweak | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const target = String(r['target'] ?? '') as TweakTarget;
  if (!(TWEAK_TARGETS as readonly string[]).includes(target)) return null;
  const keys = TWEAK_KEYS[target];
  let key = str(r['key'], 60);
  if (Array.isArray(keys)) { if (!keys.includes(key)) key = keys[0] as string; }
  else if (keys === null) key = '';
  // v0.92.1 review (B4): armor tweaks add (the armor model has no part below 0 to take them off).
  const value = target === 'note' ? 0 : Math.max(target === 'armor' ? 0 : -TWEAK_VALUE_MAX, Math.min(TWEAK_VALUE_MAX, int(r['value'])));
  const id = /^[A-Za-z0-9]{1,24}$/.test(String(r['id'] ?? '')) ? String(r['id']) : idFor();
  return { id, label: str(r['label']), target, key, value, on: r['on'] !== false };
}

/** An item's tweaks cleaned (at most TWEAK_MAX; ids made unique). */
export function normalizeTweaks(list: unknown, idFor?: () => string): Tweak[] {
  const out: Tweak[] = [];
  const seen = new Set<string>();
  for (const raw of Array.isArray(list) ? list : []) {
    const t = normalizeTweak(raw, idFor);
    if (!t) continue;
    while (seen.has(t.id)) t.id = `${t.id}x`.slice(-24);
    seen.add(t.id);
    out.push(t);
    if (out.length >= TWEAK_MAX) break;
  }
  return out;
}

/** v0.92.1: whether an item counts as carried (RULES.SHEET_V921.carried; only weapons, armor and gear can be left behind). */
export function isCarried(item: { type?: string; system?: any } | null | undefined): boolean {
  if (!item || RULES.SHEET_V921.carried !== 'on') return true;
  if (!['weapon', 'armor', 'gear'].includes(String(item.type ?? ''))) return true;
  return item.system?.carried !== false;
}

/**
 * Whether an item's tweaks count now: worn armor; carried, working weapons and gear; installed, working, healed-in ware;
 * bonded foci; active adept and critter powers; loaded programs; the deck in use; skills and spells always.
 */
export function tweakItemLive(item: { id?: string; type?: string; system?: any }, o: { recovering?: ReadonlySet<string>; adeptOver?: ReadonlySet<string> } = {}): boolean {
  const s = item?.system ?? {};
  switch (String(item?.type ?? '')) {
    case 'cyberware': return Boolean(s.installed) && !s.damaged && !(o.recovering?.has(String(item.id ?? '')));
    case 'armor': return Boolean(s.worn) && isCarried(item);
    case 'weapon': return isCarried(item) && !s.damaged;
    case 'gear': return isCarried(item) && !s.damaged && Number(s.quantity ?? 1) > 0;
    case 'focus': return Boolean(s.bonded) && s.active !== false;
    case 'adeptpower': return s.active !== false && !(o.adeptOver?.has(String(item.id ?? '')));
    case 'power': return s.active !== false;
    case 'program': return Boolean(s.loaded);
    case 'cyberdeck': return Boolean(s.active);
    default: return true;
  }
}

export interface TweakSourceItem { id: string; name: string; type: string; system: any }

export interface TweakSum {
  attributes: Record<string, number>;
  reaction: number;
  initiativeDice: number;
  pools: Record<string, number>;
  armor: { ballistic: number; impact: number };
  /** Skill dice and TN, as the gear skill-bonus sources (rules/kit.ts skillGearBonus): one source per tweak. */
  skillMods: Array<{ name: string; mods: Array<{ skill: string; dice: number; tn: number }> }>;
  /** Power on every melee, ranged or any attack, and per weapon (its own 'self' tweaks). */
  damage: { melee: number; ranged: number; all: number };
  weaponSelf: Record<string, number>;
  /** Every tweak for the sheet: what it is and whether it counts now. */
  list: Array<{ itemId: string; itemName: string; label: string; text: string; active: boolean; target: TweakTarget }>;
}

export function emptyTweakSum(): TweakSum {
  return {
    attributes: Object.fromEntries(TWEAK_ATTRIBUTES.map((k) => [k, 0])), reaction: 0, initiativeDice: 0,
    pools: Object.fromEntries(TWEAK_POOLS.map((k) => [k, 0])), armor: { ballistic: 0, impact: 0 },
    skillMods: [], damage: { melee: 0, ranged: 0, all: 0 }, weaponSelf: {}, list: [],
  };
}

/** The sums of every counting tweak on an actor's items (nothing while RULES.SHEET_V921.tweaks is 'off', but the list stays). */
export function sumTweaks(items: ReadonlyArray<TweakSourceItem>, o: { recovering?: ReadonlySet<string>; adeptOver?: ReadonlySet<string> } = {}): TweakSum {
  const out = emptyTweakSum();
  const on = RULES.SHEET_V921.tweaks === 'on';
  for (const item of items ?? []) {
    const tweaks = normalizeTweaks(item?.system?.tweaks, () => 'x');
    if (!tweaks.length) continue;
    const live = tweakItemLive(item, o);
    for (const t of tweaks) {
      const active = on && live && t.on && (t.target === 'note' || t.value !== 0) && (t.target !== 'skillDice' && t.target !== 'skillTn' || t.key !== '');
      out.list.push({ itemId: item.id, itemName: item.name, label: t.label, text: tweakText(t, item.type), active: on && live && t.on, target: t.target });
      if (!active) continue;
      switch (t.target) {
        case 'attribute': out.attributes[t.key] = (out.attributes[t.key] ?? 0) + t.value; break;
        case 'reaction': out.reaction += t.value; break;
        case 'initiativeDice': out.initiativeDice += t.value; break;
        case 'pool': out.pools[t.key] = (out.pools[t.key] ?? 0) + t.value; break;
        case 'armor': out.armor[t.key as 'ballistic' | 'impact'] += t.value; break;
        case 'skillDice': case 'skillTn':
          out.skillMods.push({ name: `${item.name}: ${t.label || tweakText(t, item.type)}`, mods: [{ skill: t.key, dice: t.target === 'skillDice' ? t.value : 0, tn: t.target === 'skillTn' ? t.value : 0 }] });
          break;
        case 'damage':
          if (t.key === 'self' && item.type === 'weapon') out.weaponSelf[item.id] = (out.weaponSelf[item.id] ?? 0) + t.value;
          else out.damage[(t.key === 'self' ? 'all' : t.key) as 'melee' | 'ranged' | 'all'] += t.value;
          break;
        default: break;
      }
    }
  }
  return out;
}

/** The Power tweaks add to an attack: the weapon's own, plus every melee or ranged attack's, plus any attack's. */
export function attackPowerTweak(sum: Pick<TweakSum, 'damage' | 'weaponSelf'> | null | undefined, o: { weaponId?: string; melee: boolean }): number {
  if (!sum || RULES.SHEET_V921.tweaks !== 'on') return 0;
  const own = o.weaponId ? Number(sum.weaponSelf?.[o.weaponId] ?? 0) : 0;
  return own + Number((o.melee ? sum.damage?.melee : sum.damage?.ranged) ?? 0) + Number(sum.damage?.all ?? 0);
}

const signed = (n: number): string => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0');

/** What a tweak does, in a few words ("Quickness +1", "Firearms: +1 die", "Power +2 (this weapon)"). */
export function tweakText(t: Tweak, itemType = ''): string {
  switch (t.target) {
    case 'attribute': return `${tKey(`SR2E.Attribute.${t.key}`)} ${signed(t.value)}`;
    case 'reaction': return tx('SR2E.Text.Tweaks.reaction', { value: signed(t.value) });
    case 'initiativeDice': return tx('SR2E.Text.Tweaks.initiativeDice', { value: signed(t.value) });
    case 'pool': return tx('SR2E.Text.Tweaks.pool', { pool: tKey(POOL_KEYS[t.key] ?? ''), value: signed(t.value) });
    case 'skillDice': return tx('SR2E.Text.Tweaks.skillDice', { skill: t.key || '?', value: signed(t.value) });
    case 'skillTn': return tx('SR2E.Text.Tweaks.skillTn', { skill: t.key || '?', value: signed(t.value) });
    case 'damage': return tx('SR2E.Text.Tweaks.damage', { value: signed(t.value), scope: tKey(SCOPE_KEYS[t.key === 'self' && itemType !== 'weapon' ? 'all' : t.key] ?? '') });
    case 'armor': return tx('SR2E.Text.Tweaks.armor', { kind: tKey(ARMOR_KEYS[t.key] ?? ''), value: signed(t.value) });
    case 'note': return t.label || tx('SR2E.Text.Tweaks.note');
    default: return '';
  }
}

/** The choices the item sheet's rows offer (a target's key list, translated). */
export function tweakKeyChoices(target: TweakTarget, itemType = ''): Array<{ key: string; label: string }> | null {
  const keys = TWEAK_KEYS[target];
  if (!Array.isArray(keys)) return null;
  const label = (k: string) => target === 'attribute' ? tKey(`SR2E.Attribute.${k}`)
    : target === 'pool' ? tKey(POOL_KEYS[k] ?? '')
    : target === 'armor' ? tKey(ARMOR_KEYS[k] ?? '')
    : tKey(SCOPE_KEYS[k] ?? '');
  return keys.filter((k) => !(target === 'damage' && k === 'self' && itemType !== 'weapon')).map((k) => ({ key: k, label: label(k) }));
}
