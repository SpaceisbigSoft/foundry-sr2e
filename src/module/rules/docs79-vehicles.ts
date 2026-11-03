/**
 * v0.79.0 (vehicles): the verified fixes, pure rules side. Each function reads its switch in RULES.DOCS_V79 (see
 * rules/config79-vehicles.ts for the rules and their official sources) and falls back to the old behaviour when the
 * switch is set to the old way. No Foundry dependency.
 */
import { RULES, type DamageLevel } from './config.ts';
import type { TargetNumberModifier } from './dice.ts';
import { stageDown } from './damage.ts';
import { recoilModifier } from './firing.ts';
import { heavyRecoil } from './weapons.ts';
import { sensorGunnery, vehicleRepairPlan } from './roadwork.ts';
import { t as tx } from '../helpers/i18n.ts';

const D = () => RULES.DOCS_V79;
const num = (x: unknown): number => { const v = Number(x); return Number.isFinite(v) ? v : 0; };

// ---------------------------------------------------------------- impact damage level by speed (Rigger 2 Impact Damage Levels table)

/** The Impact Damage Levels table: the damage level for a speed in m/turn (1–20 L, 21–60 M, 61–200 S, 201+ D). */
export function impactLevel(speed: number): DamageLevel {
  const s = Math.max(0, num(speed));
  const t = D().vehImpact;
  // v0.81.0 (RB-18): lowest maximum first, whatever order an override lists the rows in.
  for (const row of [...t.table].sort((a, b) => a.max - b.max)) if (s <= row.max) return row.level;
  return t.above;
}

/** The level a crashing vehicle takes: by the table at its speed ('speed'), or the old fixed level ('fixed'). */
export function crashVehicleLevel(speed: number): DamageLevel {
  return D().vehCrashLevel === 'speed' ? impactLevel(speed) : RULES.VEHICLES.crash.vehicleLevel;
}

/**
 * A ram's damage level and the rammer's own: both by the table at the rammer's current speed ('speed'), or the old
 * M (S above half its Speed) with the rammer a level lower ('half').
 */
export function ramLevels(o: { currentSpeed: number; speed: number }): { level: DamageLevel; selfLevel: DamageLevel | null } {
  if (D().vehRamLevel === 'speed') {
    const level = impactLevel(o.currentSpeed);
    return { level, selfLevel: level };
  }
  const r = RULES.VEHICLES.ram;
  const level = num(o.speed) > 0 && num(o.currentSpeed) > num(o.speed) / 2 ? r.fastLevel : r.level;
  return { level, selfLevel: stageDown(level, 1) };
}

// ---------------------------------------------------------------- mounted weapon recoil (Rigger 2 p131)

/** Recoil compensation a mount gives (pintle 2, ring 6) under 'rigger2'; 0 otherwise. */
export function mountRecoilComp(mount: string | null | undefined): number {
  const m = D().vehMountRecoil;
  if (m.mode !== 'rigger2') return 0;
  if (mount === 'pintle') return Math.max(0, num(m.pintleComp));
  if (mount === 'ring') return Math.max(0, num(m.ringComp));
  return 0;
}

/**
 * The recoil TN modifier for a weapon, mounted or not. Not mounted: the usual recoil (heavy weapons doubled).
 * 'rigger2': fixed and turret mounts halve the uncompensated recoil (round down) before compensation; pintle and ring
 * mounts add their compensation. 'old': fixed and turret mounts take no recoil (when RULES.VEHICLES.mountedIgnoreRecoil).
 */
export function mountedRecoil(o: { rounds: number; earlierRoundsThisPhase?: number; recoilComp?: number; mount?: string | null; mounted?: boolean; heavy?: boolean; firstShotSingle?: boolean }): number {
  // v0.79.0 (ranged, RULES.DOCS_V79.rangedRecoil): whether the phase's first shot was a single shot.
  const base = { rounds: o.rounds, earlierRoundsThisPhase: o.earlierRoundsThisPhase ?? 0, ...(typeof o.firstShotSingle === 'boolean' ? { firstShotSingle: o.firstShotSingle } : {}) };
  const comp = Math.max(0, num(o.recoilComp));
  const heavy = Boolean(o.heavy);
  const mount = o.mounted ? String(o.mount ?? 'none') : 'none';
  const fixedOrTurret = mount === 'fixed' || mount === 'turret';
  const m = D().vehMountRecoil;
  if (m.mode !== 'rigger2') {
    if (fixedOrTurret && RULES.VEHICLES.mountedIgnoreRecoil) return 0;
    return heavyRecoil(recoilModifier({ ...base, recoilComp: comp }), heavy);
  }
  if (fixedOrTurret) {
    const raw = recoilModifier({ ...base, recoilComp: 0 });
    const halved = Math.floor(raw * Math.max(0, num(m.fixedTurretFactor)));
    return heavyRecoil(Math.max(0, halved - comp), heavy);
  }
  return heavyRecoil(recoilModifier({ ...base, recoilComp: comp + mountRecoilComp(mount) }), heavy);
}

// ---------------------------------------------------------------- sensor test modifiers (Rigger 2 Sensor Test Modifiers table)

/** The Sensor Test Modifiers table rows the dialog offers ([] when 'off'). */
export function sensorTableRows(): ReadonlyArray<{ id: string; label: string; value: number }> {
  return D().vehSensorTable.mode === 'rigger2' ? D().vehSensorTable.rows : [];
}

/** TN modifiers for the ticked Sensor Test Modifiers rows, plus a concealing spirit's Force. */
export function sensorTableModifiers(o: { ids?: readonly string[]; spiritForce?: number }): TargetNumberModifier[] {
  const t = D().vehSensorTable;
  if (t.mode !== 'rigger2') return [];
  const ids = new Set(o.ids ?? []);
  const out: TargetNumberModifier[] = t.rows.filter((r) => ids.has(r.id) && r.value).map((r) => ({ label: r.label, value: r.value }));
  const f = Math.max(0, Math.floor(num(o.spiritForce)));
  if (f > 0) out.push({ label: tx('SR2E.Card.Mod.force', { spName: t.spiritLabel, spLearnedForce: f }), value: f });
  return out;
}

// ---------------------------------------------------------------- sensor-enhanced gunnery (Rigger 2 Sensor-Enhanced Targeting Modifiers table)

/** Whether sensor-enhanced gunnery runs Rigger 2's way (RULES.VEHICLES_V57.sensorGunnery 'rigger2'). */
export function segRigger2(): boolean {
  return String(RULES.VEHICLES_V57.sensorGunnery) === 'rigger2';
}

/** The Sensor-Enhanced Targeting Modifiers table rows the fire dialog offers ([] unless 'rigger2'). */
export function segRows(): ReadonlyArray<{ id: string; label: string; value: number }> {
  return segRigger2() ? D().vehSeg.rows : [];
}

/** TN modifiers for the ticked Sensor-Enhanced Targeting rows ([] unless 'rigger2'). */
export function segConditionModifiers(ids: readonly string[] = []): TargetNumberModifier[] {
  if (!segRigger2()) return [];
  const set = new Set(ids);
  return D().vehSeg.rows.filter((r) => set.has(r.id) && r.value).map((r) => ({ label: r.label, value: r.value }));
}

export interface SegInput { lock: boolean; signature: number; rangeTn: number; sensor: number; gunneryDice: number; targetEcm?: number; firerEccm?: number }
export interface SegResult { modifiers: TargetNumberModifier[]; dice: number; replaceRange: boolean; note: string; noMovement: boolean }

/**
 * Sensor-enhanced gunnery by RULES.VEHICLES_V57.sensorGunnery. 'rigger2': Gunnery (or Pilot) + Sensor ÷ 2 (round down)
 * dice, the target's Signature in place of the range TN, + its ECM beyond the firer's ECCM; the movement modifiers of
 * firing from or at a moving vehicle don't apply (`noMovement`). 'flat' / 'signature': the old roadwork.sensorGunnery.
 */
export function sensorGunneryByMode(o: SegInput): SegResult {
  if (!segRigger2()) return { ...sensorGunnery(o), noMovement: false };
  const dice = Math.max(0, num(o.gunneryDice));
  if (!o.lock) return { modifiers: [], dice, replaceRange: false, note: '', noMovement: false };
  const sensor = Math.max(0, num(o.sensor));
  const extra = Math.floor(sensor / Math.max(1, num(D().vehSeg.sensorDivisor)));
  const modifiers: TargetNumberModifier[] = [];
  const diff = num(o.signature) - num(o.rangeTn);
  if (diff) modifiers.push({ label: tx('SR2E.Card.Mod.sensorLockSignatureInsteadOfRange', { num: num(o.signature), num2: num(o.rangeTn) }), value: diff });
  const ecm = Math.max(0, num(o.targetEcm) - num(o.firerEccm));
  if (ecm) modifiers.push({ label: tx('SR2E.Card.Mod.ecm', { num: num(o.targetEcm), part: num(o.firerEccm) ? tx('SR2E.Card.Docs79Vehicles.eccm', { num: num(o.firerEccm) }) : '' }), value: ecm });
  return {
    modifiers, dice: dice + extra, replaceRange: true, noMovement: true,
    note: tx('SR2E.Text.Docs79Vehicles.sensorEnhancedGunnery', { extra, sensor }),
  };
}

// ---------------------------------------------------------------- vehicle repair time (Rigger 2 p26)

export interface RepairInput {
  successes: number; condition: number; systems: { tires?: boolean; engine?: boolean; sensors?: boolean };
  destroyed: boolean; boxesPerSuccess: number; hoursPerBox: number; partsFirst: boolean; rebuild: boolean; rebuildFactor: number;
  /** RULES.FIXES_V71.vehicleRepair.enabled (shot-out parts and rebuilds are tracked). */
  fixEnabled: boolean;
}

/**
 * What a vehicle repair test fixes and how long it takes. 'rigger2': any success fixes all the damage (and, with the
 * v0.71.0 fixes on, the shot-out parts; a destroyed vehicle with 'rebuild' is rebuilt at rebuildFactor × the time);
 * the work takes 16 hours per box (a part counts as a box) ÷ the successes. 'perSuccess': the old way.
 */
export function vehicleRepairByMode(o: RepairInput): { boxes: number; parts: string[]; rebuild: boolean; hours: number } {
  const n = Math.max(0, Math.floor(num(o.successes)));
  const condition = Math.max(0, Math.floor(num(o.condition)));
  if (D().vehRepair.mode !== 'rigger2') {
    if (o.fixEnabled) return vehicleRepairPlan(o);
    const boxes = Math.min(condition, n * num(o.boxesPerSuccess));
    return { boxes, parts: [], rebuild: false, hours: boxes * num(o.hoursPerBox) };
  }
  if (n <= 0) return { boxes: 0, parts: [], rebuild: false, hours: 0 };
  const parts = o.fixEnabled ? (['tires', 'engine', 'sensors'] as const).filter((k) => Boolean(o.systems?.[k])).map(String) : [];
  const rebuild = Boolean(o.fixEnabled && o.destroyed && o.rebuild);
  const factor = rebuild ? Math.max(1, num(o.rebuildFactor) || 1) : 1;
  const hours = Math.round(((condition + parts.length) * Math.max(0, num(D().vehRepair.hoursPerBox)) * factor / n) * 10) / 10;
  return { boxes: condition, parts, rebuild, hours };
}
