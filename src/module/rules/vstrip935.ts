/**
 * v0.93.5 (plan item 51): the vehicle sheet's status strip, Foundry-free: the damage track as text (as the
 * character strip's monitor since v0.93.4), speed and Handling now, the autopilot and Sensor ratings, who drives it
 * (jumped in or not), the mounted guns' rounds, and what is wrong (destroyed, a jammed or spoofed link, systems shot out).
 */

export interface VehicleStripInput {
  condition: number;
  boxes: number;
  damageModifier: number;
  destroyed: boolean;
  currentSpeed: number;
  speed: number;
  handling: number;
  drone: boolean;
  autopilot: number;
  sensor: number;
  /** The driver's name ('' = nobody: the autopilot) and how they drive it. */
  controller: string;
  mode: string;
  /** Mounted weapons with ammunition. */
  guns: Array<{ id: string; name: string; ammo: number; ammoMax: number }>;
  jammed: boolean;
  spoofed: boolean;
  /** Systems shot out (tires, sensors, engine) by their names. */
  systemsOut: string[];
  occupants: number;
}

export interface VehicleStrip {
  damage: { filled: number; boxes: number; mod: string; hurt: boolean };
  destroyed: boolean;
  speed: { now: number; max: number; over: boolean };
  handling: number;
  pilotKind: 'pilot' | 'autonav';
  autopilot: number;
  sensor: number;
  driver: { name: string; jumped: boolean; manual: boolean } | null;
  gun: { id: string; name: string; ammo: string; low: boolean; out: boolean; more: number } | null;
  alerts: string[];
  occupants: number;
}

/** The strip's view. The gun shown is the one with the fewest rounds left (by share), so an empty one is never hidden. */
export function vehicleStrip(v: VehicleStripInput): VehicleStrip {
  const n = (x: unknown) => (Number.isFinite(Number(x)) ? Number(x) : 0);
  const boxes = Math.max(0, n(v.boxes));
  const filled = Math.max(0, Math.min(boxes || Infinity, n(v.condition)));
  const guns = (v.guns ?? []).filter((g) => n(g.ammoMax) > 0);
  const share = (g: { ammo: number; ammoMax: number }) => n(g.ammo) / Math.max(1, n(g.ammoMax));
  const g = guns.length ? [...guns].sort((a, b) => share(a) - share(b))[0]! : null;
  const mode = String(v.mode ?? '');
  return {
    damage: { filled, boxes, mod: n(v.damageModifier) > 0 ? `+${n(v.damageModifier)}` : '', hurt: filled > 0 },
    destroyed: Boolean(v.destroyed),
    speed: { now: n(v.currentSpeed), max: n(v.speed), over: n(v.speed) > 0 && n(v.currentSpeed) > n(v.speed) },
    handling: n(v.handling),
    pilotKind: v.drone ? 'pilot' : 'autonav',
    autopilot: n(v.autopilot),
    sensor: n(v.sensor),
    driver: v.controller && mode !== 'autopilot' ? { name: String(v.controller), jumped: mode === 'jumped', manual: mode === 'manual' } : null,
    gun: g ? { id: g.id, name: g.name, ammo: `${n(g.ammo)}/${n(g.ammoMax)}`, low: n(g.ammo) <= Math.floor(n(g.ammoMax) / 5), out: n(g.ammo) <= 0, more: guns.length - 1 } : null,
    alerts: [...(v.jammed ? ['jammed'] : []), ...(v.spoofed ? ['spoofed'] : []), ...(v.systemsOut ?? []).map(String)],
    occupants: Math.max(0, n(v.occupants)),
  };
}
