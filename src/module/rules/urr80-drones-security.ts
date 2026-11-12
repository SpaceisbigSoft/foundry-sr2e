/**
 * v0.80.0, the "SR2E Unified Rules Revamp" rules source (area: drones-security): pure functions. Each reads its switch in
 * RULES.URR_V80 (config80-drones-security.ts) and behaves the book way while the switch is at its shipped value.
 * The rules and their sources are listed in config80-drones-security.ts.
 */
import { RULES } from './config.ts';
import type { TargetNumberModifier } from './dice.ts';
import { veh923 } from './vehicles.ts';
import { t as tx } from '../helpers/i18n.ts';

const U = () => RULES.URR_V80;
const num = (n: unknown): number => (Number.isFinite(Number(n)) ? Number(n) : 0);
const whole = (n: unknown): number => Math.max(0, Math.floor(num(n)));
const sum = (mods: readonly TargetNumberModifier[] | undefined): number => (mods ?? []).reduce((n, m) => n + num(m.value), 0);

// ---------------------------------------------------------------- Drone links: decryption and interception

export interface DsInterceptPlan {
  /** The network decryption test, rolled first (null: the link is not encrypted). */
  decrypt: { skill: string; baseTn: number; modifiers: TargetNumberModifier[]; need: number } | null;
  /** The interception test: dice, TN and what the TN comes from. */
  intercept: { dice: number; baseTn: number; modifiers: TargetNumberModifier[]; from: string };
}

/**
 * The URR's drone-link interception (dsLinkIntercept 'rcd'), or null for the book's test. `ownRcd`: the interceptor's
 * best remote control deck; `targetRcd`: the deck controlling the drone (0: none, the drone's Pilot is used);
 * `hasEwSkill`: whether the interceptor knows the decryption skill (else Electronics at a TN penalty).
 */
export function dsInterceptPlan(o: { ownRcd: number; targetRcd: number; pilot: number; encryption: number; hasEwSkill: boolean }): DsInterceptPlan | null {
  const u = U();
  // v0.92.3 (RULES.VEHICLES_V923.interception 'book', Rigger 2 p. 68): the book's procedure is this one.
  if (u.dsLinkIntercept !== 'rcd' && veh923('interception') !== 'book') return null;
  const enc = whole(o?.encryption);
  const target = whole(o?.targetRcd);
  let decrypt: DsInterceptPlan['decrypt'] = null;
  if (enc > 0) {
    const modifiers: TargetNumberModifier[] = [{ id: 'decryption', label: tx('SR2E.Card.Mod.decryption'), value: num(u.dsDecryptTnPlus) }];
    if (!o?.hasEwSkill && num(u.dsDecryptNoSkillTn)) modifiers.push({ label: tx('SR2E.Card.Mod.noSkill', { dsDecryptSkill: u.dsDecryptSkill }), value: num(u.dsDecryptNoSkillTn) });
    decrypt = { skill: o?.hasEwSkill ? String(u.dsDecryptSkill) : 'Electronics', baseTn: enc, modifiers, need: Math.max(1, Math.ceil(target / 2)) };
  }
  const base = target > 0 ? target : whole(o?.pilot);
  return {
    decrypt,
    intercept: { dice: whole(o?.ownRcd), baseTn: base, modifiers: num(u.dsInterceptTnPlus) ? [{ id: 'interception', label: tx('SR2E.Card.Mod.interception'), value: num(u.dsInterceptTnPlus) }] : [], from: target > 0 ? `remote control deck ${target}` : `Pilot ${whole(o?.pilot)}` },
  };
}

/** Whether a network decryption test's successes break the encryption. */
export function dsDecryptPassed(successes: number, need: number): boolean {
  return whole(successes) >= Math.max(1, whole(need));
}

// ---------------------------------------------------------------- Radio decryption

/**
 * The URR's radio decryption (dsRadioDecrypt 'urr'): Electronics vs the encryption + a modifier, needing half the
 * encryption in successes (rounded down, at least 1). Null under the book, or for an unencrypted radio.
 */
export function dsRadioDecrypt(o: { encryption: number }): { baseTn: number; modifiers: TargetNumberModifier[]; need: number } | null {
  const u = U();
  const enc = whole(o?.encryption);
  if (u.dsRadioDecrypt !== 'urr' || enc <= 0) return null;
  const plus = num(u.dsRadioDecryptTnPlus);
  return { baseTn: enc, modifiers: plus ? [{ id: 'decryption', label: tx('SR2E.Card.Mod.decryption'), value: plus }] : [], need: Math.max(1, Math.floor(enc / 2)) };
}

// ---------------------------------------------------------------- Maglocks

/** The casing test's extra TN for the lock's type (dsLockCasing 'byType'): a card reader's casing doubles, a scanner's adds. */
export function dsCasingModifiers(lockType: string, casing: number): TargetNumberModifier[] {
  const u = U();
  const c = whole(casing);
  const id = String(lockType ?? '');
  // v0.92.3 (RULES.VEHICLES_V923.cardCasing 'double', CSH p. 100): a card reader's casing is opened against twice its rating.
  if (u.dsLockCasing !== 'byType') return c > 0 && id === 'card' && veh923('cardCasing') === 'double' ? [{ id: 'cardReaderCasing', label: tx('SR2E.Card.Mod.cardReaderCasing'), value: c }] : [];
  if (c > 0 && (u.dsCasingDouble ?? []).includes(id)) return [{ id: 'cardReaderCasing', label: tx('SR2E.Card.Mod.cardReaderCasing'), value: c }];
  const plus = num((u.dsCasingPlus ?? {})[id]);
  return plus ? [{ id: 'scannerCasing', label: tx('SR2E.Card.Mod.scannerCasing'), value: plus }] : [];
}

export interface DsToolStep {
  step: 'circuit' | 'voice';
  tn: number;
  dice: number;
  modifiers: TargetNumberModifier[];
  tool: { name: string; kind: string; rating: number; mode: 'replace' };
  note: string;
}

/**
 * The URR's passkey and sequencer (dsPasskey 'rating', dsSequencer 'opposed'), or null for the book's way. A passkey on a
 * card reader: its rating in dice vs the reader's rating ('circuit'). A sequencer on a keypad (or a lock with no type set):
 * an opposed test of ratings ('voice', the opposed device flow). Used only when the tool's rating is at least the skill dice.
 */
export function dsLockToolStep(o: { lockType: string; rating: number; skillDice: number; tools: ReadonlyArray<{ kind: string; rating: number; name: string }> }): DsToolStep | null {
  const u = U();
  const id = String(o?.lockType ?? '');
  const best = (kind: string) => (o?.tools ?? []).filter((t) => t.kind === kind && whole(t.rating) > 0)
    .reduce((b: { kind: string; rating: number; name: string } | null, t) => (!b || whole(t.rating) > whole(b.rating) ? t : b), null);
  const rating = whole(o?.rating);
  const tn = Math.max(RULES.MIN_TARGET_NUMBER, rating);
  const skill = whole(o?.skillDice);
  // v0.92.3 (RULES.VEHICLES_V923.passkey 'book', CSH p. 100): the book's passkey is this test, used whenever one is carried
  // (it leaves the casing in place: bypassPlan asks for it before the casing).
  const bookKey = veh923('passkey') === 'book';
  if ((u.dsPasskey === 'rating' || bookKey) && id === 'card') {
    const k = best('passkey');
    if (k && (bookKey || whole(k.rating) >= skill)) {
      return { step: 'circuit', tn, dice: whole(k.rating), modifiers: [], tool: { name: k.name, kind: 'passkey', rating: whole(k.rating), mode: 'replace' }, note: tx('SR2E.Text.Urr80DronesSecurity.spoofTheReaderWith', { name: k.name, rating: whole(k.rating) }) };
    }
  }
  // v0.92.3 (RULES.VEHICLES_V923.sequencer 'book', CSH p. 100): the book's sequencer is this opposed test.
  if ((u.dsSequencer === 'opposed' || veh923('sequencer') === 'book') && (id === 'keypad' || id === '')) {
    const s = best('sequencer');
    if (s && whole(s.rating) >= skill) {
      return { step: 'voice', tn, dice: whole(s.rating), modifiers: [], tool: { name: s.name, kind: 'sequencer', rating: whole(s.rating), mode: 'replace' }, note: tx('SR2E.Text.Urr80DronesSecurity.crackTheKeypadWith', { name: s.name, rating: whole(s.rating) }) };
    }
  }
  return null;
}

/** Words for the opposed device step's card: a voice lock's, or a keypad's when a sequencer cracks it. */
export function dsDeviceStepWords(lockType: string): { verb: string; what: string; accepts: string; rejects: string; answers: string; noun: string } {
  return String(lockType ?? '') === 'voice'
    ? { verb: 'Fool', what: 'voice recognition', accepts: 'accepts the voice', rejects: 'rejects the voice', answers: 'listens', noun: 'voice' }
    : { verb: 'Crack', what: 'keypad', accepts: 'accepts the code', rejects: 'rejects the code', answers: 'answers', noun: 'code' };
}

/** Seconds a sequencer takes to crack a keypad: the base time ÷ net successes, rounded up (0: not opened). */
export function dsSequencerSeconds(net: number): number {
  const n = whole(net);
  return n > 0 ? Math.ceil(whole(U().dsSequencerSeconds) / n) : 0;
}

// ---------------------------------------------------------------- Weapon detectors

/** Whether a scan uses the URR's highest-die method (a weapon detector, with dsMadScan 'highestDie'). */
export function dsMadScanOn(method: string, kind: string): boolean {
  return U().dsMadScan === 'highestDie' && method === 'scanner' && kind === 'weapon';
}

/** The highest face rolled (0 for none). */
export function dsHighestDie(faces: readonly number[]): number {
  return (faces ?? []).reduce((m, f) => Math.max(m, whole(f)), 0);
}

/** Whether a weapon detector's highest die finds an item: its TN (with the search's modifiers) at most that die. */
export function dsMadFinds(highest: number, tn: number, modifiers: readonly TargetNumberModifier[] = []): { found: boolean; need: number } {
  const need = Math.max(RULES.MIN_TARGET_NUMBER, whole(tn) + sum(modifiers));
  return { found: whole(highest) >= need, need };
}

// ---------------------------------------------------------------- Dump shock disorientation

/** Disorientation after dump shock (dsDumpDisorient): the TN, the test's TN, and the turns left for these successes. */
export function dsDisorientation(successes: number): { tn: number; testTn: number; turns: number } {
  const u = U();
  const base = whole(u.dsDisorientTurns);
  const s = whole(successes);
  return { tn: num(u.dsDisorientTn), testTn: Math.max(RULES.MIN_TARGET_NUMBER, whole(u.dsDisorientTestTn)), turns: s > 0 ? Math.floor(base / s) : base };
}

// ---------------------------------------------------------------- Device ECCM

/** A comms device's ECCM: its own, or the default for one with none set (dsCommsEccm; the book's 0 keeps its own). */
export function dsDeviceEccm(eccm: unknown): number {
  const own = Math.max(0, num(eccm));
  const d = whole(U().dsCommsEccm);
  return d > 0 ? Math.max(own, d) : own;
}
