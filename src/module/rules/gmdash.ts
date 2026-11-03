/**
 * v0.68.0: the GM side of the second interface pass, Foundry-free: the party cards of the GM panel,
 * the compact mook stat line, and the combat tracker's pass banner and delayed group.
 */
import { hudDamageLabel } from './hudactions.ts';
import { t as tx } from '../helpers/i18n.ts';

const num = (v: unknown): number => (Number.isFinite(Number(v)) ? Number(v) : 0);

// ---------------------------------------------------------------- Party cards

/** One pool as a compact chip: "Combat 3/7". */
export interface PoolChip { key: string; label: string; short: string; title: string; left: number; max: number; text: string; empty: boolean }

/** The pools a card shows, in this order (only those the character has). */
export const POOL_KEYS: ReadonlyArray<{ key: string; label: string; short: string }> = [
  { key: 'combat', label: 'Combat', short: 'C' },
  { key: 'spell', label: 'Spell', short: 'Sp' },
  { key: 'hacking', label: 'Hacking', short: 'H' },
  { key: 'control', label: 'Control', short: 'Ct' },
  { key: 'karma', label: 'Karma', short: 'K' },
];

/** Pool chips from `{ combat: [left, max], … }`; pools with no maximum are left out. */
export function poolChips(pools: Record<string, readonly [unknown, unknown] | undefined>): PoolChip[] {
  return POOL_KEYS.flatMap(({ key, label, short }) => {
    const p = pools[key];
    const max = Math.max(0, Math.floor(num(p?.[1])));
    if (!p || max <= 0) return [];
    const left = Math.max(0, Math.min(max, Math.floor(num(p[0]))));
    return [{ key, label, short, title: tx('SR2E.Text.Gmdash.poolLeft', { label, left, max }), left, max, text: `${left}/${max}`, empty: left <= 0 }];
  });
}

export interface PartyCardInput {
  name: string;
  img?: string;
  player?: string;
  status?: string;
  /** The wound modifier to target numbers (0 = none). */
  wound?: number;
  pools?: Record<string, readonly [unknown, unknown] | undefined>;
  goodKarma?: number;
  nuyen?: number;
  astral?: string;
  matrix?: string;
  chips?: readonly string[];
  /** Initiative this pass, when in a started combat (null = not in one, or not rolled). */
  initiative?: number | null;
  inCombat?: boolean;
  acting?: boolean;
}

export interface PartyCardView {
  name: string; img: string; player: string;
  status: string; hurt: boolean; statusText: string;
  wound: number; woundText: string;
  pools: PoolChip[];
  goodKarma: number; nuyen: number; nuyenText: string; karmaText: string;
  state: string[]; chips: string[];
  initiative: string; inCombat: boolean; acting: boolean;
}

/** A party card's view: status if not ok, the wound TN modifier, pool chips, money, the astral/Matrix state and status chips. */
export function partyCard(i: PartyCardInput): PartyCardView {
  const status = String(i.status || 'ok');
  const wound = Math.max(0, Math.floor(num(i.wound)));
  const nuyen = Math.floor(num(i.nuyen));
  const goodKarma = Math.floor(num(i.goodKarma));
  const state = [i.astral ? String(i.astral) : '', i.matrix ? String(i.matrix) : ''].filter(Boolean);
  const seen = new Set(state.map((s) => s.toLowerCase()));
  const chips = (i.chips ?? []).map(String).filter((c) => c && !seen.has(c.toLowerCase()) && (seen.add(c.toLowerCase()), true));
  const init = i.initiative;
  return {
    name: String(i.name ?? '?'), img: String(i.img || 'icons/svg/mystery-man.svg'), player: String(i.player ?? ''),
    status, hurt: status !== 'ok', statusText: status === 'ok' ? '' : status.charAt(0).toUpperCase() + status.slice(1),
    wound, woundText: wound ? `+${wound} TN` : '',
    pools: poolChips(i.pools ?? {}),
    goodKarma, nuyen, nuyenText: `${nuyen.toLocaleString('en-US')}¥`, karmaText: tx('SR2E.Text.Gmdash.goodKarma', { goodKarma }),
    state, chips,
    initiative: i.inCombat && init !== null && init !== undefined && Number.isFinite(Number(init)) ? String(Math.floor(Number(init))) : '',
    inCombat: Boolean(i.inCombat), acting: Boolean(i.acting),
  };
}

// ---------------------------------------------------------------- Mook stat cards

export interface MookInput {
  /** Attribute totals by key (body, quickness, strength, charisma, intelligence, willpower). */
  attributes?: Partial<Record<string, unknown>>;
  reaction?: number;
  initiativeDice?: number;
  /** A flat bonus to the initiative score (spirits). */
  initiativeBonus?: number;
  ballistic?: number;
  impact?: number;
  professionalRating?: number;
  grunts?: { size?: number; down?: number } | null;
  /** Weapons in sheet order: name and system data (damagePower, damageLevel, damageType, strengthPower). */
  weapons?: ReadonlyArray<{ name: string; system?: Record<string, any>; damage?: string }>;
  /** How many weapons to show (default 2). */
  maxWeapons?: number;
}

export interface MookLine {
  attrs: Array<{ k: string; label: string; v: number }>;
  armor: string;
  init: string;
  pr: string;
  group: string;
  weapons: Array<{ name: string; damage: string }>;
  text: string;
}

const MOOK_ATTRS: ReadonlyArray<[string, string, string]> = [
  ['B', 'body', 'Body'], ['Q', 'quickness', 'Quickness'], ['S', 'strength', 'Strength'], ['C', 'charisma', 'Charisma'],
  ['I', 'intelligence', 'Intelligence'], ['W', 'willpower', 'Willpower'],
];

/** The dense stat line of a mook: B Q S C I W R, armor B/I, initiative, Professional Rating, group size, 1–2 weapons. */
export function mookLine(i: MookInput): MookLine {
  const a = i.attributes ?? {};
  const attrs = [
    ...MOOK_ATTRS.map(([k, key, label]) => ({ k, label, v: Math.floor(num(a[key])) })),
    { k: 'R', label: 'Reaction', v: Math.floor(num(i.reaction)) },
  ];
  const armor = `${Math.max(0, Math.floor(num(i.ballistic)))}/${Math.max(0, Math.floor(num(i.impact)))}`;
  const base = Math.floor(num(i.reaction)) + Math.floor(num(i.initiativeBonus));
  const dice = Math.max(1, Math.floor(num(i.initiativeDice) || 1));
  const init = `${base} + ${dice}D6`;
  const prN = Math.max(0, Math.floor(num(i.professionalRating)));
  const pr = prN > 0 ? `PR ${prN}` : '';
  const size = Math.max(0, Math.floor(num(i.grunts?.size)));
  const down = Math.max(0, Math.floor(num(i.grunts?.down)));
  const group = size > 1 ? `${Math.max(0, size - down)}/${size} grunts` : '';
  const weapons = (i.weapons ?? []).slice(0, Math.max(0, i.maxWeapons ?? 2))
    .map((w) => ({ name: String(w.name ?? ''), damage: w.damage ?? hudDamageLabel(w.system) }));
  const text = [
    attrs.map((x) => `${x.k} ${x.v}`).join(' '),
    `Armor ${armor}`, `Init ${init}`, pr, group,
    ...weapons.map((w) => `${w.name} ${w.damage}`.trim()),
  ].filter(Boolean).join(' · ');
  return { attrs, armor, init, pr, group, weapons, text };
}

/** The browser key of the GM's choice between rows and stat cards. */
export const MOOK_CARDS_KEY = 'sr2e.gmMookCards';

type StorageLike = { getItem(k: string): string | null; setItem(k: string, v: string): void } | null | undefined;

/** Whether the GM panel shows NPC stat cards (default on; a blocked or empty store reads as on). */
export function readMookCards(storage: StorageLike): boolean {
  try {
    const v = storage?.getItem(MOOK_CARDS_KEY);
    if (v === null || v === undefined) return true;
    return !['false', '0', 'off', '"false"'].includes(String(v).trim().toLowerCase());
  } catch { return true; }
}

/** Keep the GM's choice (quietly does nothing when storage is blocked). */
export function writeMookCards(storage: StorageLike, on: boolean): void {
  try { storage?.setItem(MOOK_CARDS_KEY, on ? 'true' : 'false'); } catch { /* storage blocked */ }
}

// ---------------------------------------------------------------- The combat tracker

export interface TrackerEntry { id: string; delaying?: boolean; actingNow?: boolean; fullDefense?: boolean }

export interface TrackerGroups {
  /** Every id, in display order: the others first, then the delaying ones. */
  order: string[];
  main: string[];
  delayed: string[];
  fullDefense: string[];
  counts: { delayed: number; fullDefense: number };
}

/** The tracker's order: delaying (or acting on a delayed action) last, in their own order; full defense stays put. */
export function trackerGroups(list: readonly TrackerEntry[]): TrackerGroups {
  const main: string[] = [];
  const delayed: string[] = [];
  const fullDefense: string[] = [];
  const seen = new Set<string>();
  for (const e of list) {
    if (!e?.id || seen.has(e.id)) continue;
    seen.add(e.id);
    (e.delaying || e.actingNow ? delayed : main).push(e.id);
    if (e.fullDefense) fullDefense.push(e.id);
  }
  return { order: [...main, ...delayed], main, delayed, fullDefense, counts: { delayed: delayed.length, fullDefense: fullDefense.length } };
}

export interface PassBannerInput { started: boolean; round: number; /** 1-based. */ pass: number; acting?: string; fullDefense?: number; delayed?: number }

export interface PassBanner { title: string; acting: string; notes: string[] }

/** The banner over the tracker: "Combat Turn 2 · Pass 1", who acts, and how many are on full defense or delaying. Null before the start. */
export function passBanner(i: PassBannerInput): PassBanner | null {
  if (!i.started) return null;
  const round = Math.max(1, Math.floor(num(i.round)) || 1);
  const pass = Math.max(1, Math.floor(num(i.pass)) || 1);
  const notes: string[] = [];
  const fd = Math.max(0, Math.floor(num(i.fullDefense)));
  const dl = Math.max(0, Math.floor(num(i.delayed)));
  if (fd) notes.push(tx('SR2E.Text.Gmdash.fullDefense', { fd }));
  if (dl) notes.push(tx('SR2E.Text.Gmdash.delaying', { dl }));
  return { title: tx('SR2E.Text.Gmdash.combatTurnPass', { round, pass }), acting: i.acting ? tx('SR2E.Text.Gmdash.acting', { acting: i.acting }) : '', notes };
}
