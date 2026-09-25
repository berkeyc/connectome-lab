// Plain data a 3D scene needs from a world, read once per animation frame.
// Worlds stay 2D simulations; the 3D view only draws them.

export type P2 = { x: number; y: number };

export type TrackSnap = {
  kind: "track";
  track: { w: number; h: number; r: number; lane: number; dir: number };
  car: { x: number; y: number; h: number; steer: number; v: number };
  rays: { dl: number; dr: number; pl: number; pr: number };
  crashes: number;
};

export type LoomSnap = {
  kind: "loom";
  /** side +1 right, -1 left; dist in object radii */
  threat: { side: number; dist: number } | null;
  /** 0..1 progress of the take off */
  jump: { k: number; dir: number } | null;
  gf: number;
};

export type RunnerSnap = {
  kind: "runner";
  obstacles: { x: number; w: number; h: number; kind: "drop" | "stone" | "spider" }[];
  flyX: number;
  flyY: number;
  dead: boolean;
  scroll: number;
  gf: number;
};

export type PlateSnap = {
  kind: "plate";
  head: P2;
  heading: number;
  trail: P2[];
  food: P2 | null;
  foodSigma: number;
  reversing: boolean;
  touching: boolean;
};

/** A thing in a Fly Gym scene. Units are fly body lengths; x and z on the floor, y up. */
export type GymProp = {
  id: string;
  kind: "box" | "sphere" | "cylinder" | "card" | "disc" | "fly" | "cloud" | "flower";
  x: number;
  y: number;
  z: number;
  /** size along x, y and z (radius for spheres and discs) */
  sx?: number;
  sy?: number;
  sz?: number;
  /** rotation about the vertical axis */
  rot?: number;
  color?: string;
  /** text printed on cards */
  label?: string;
  opacity?: number;
  /** light emitted, 0 to 1 */
  glow?: number;
};

export type GymSnap = {
  kind: "gym";
  task: string;
  fly: { x: number; y: number; z: number; h: number; flap: number; walk: number; proboscis: number; roll?: number };
  props: GymProp[];
  /** a striped drum around the fly (flight arena), rotating with phase */
  drum?: { phase: number };
  /** camera: follow the fly, or a fixed view */
  view: { mode: "follow"; dist: number; height: number } | { mode: "fixed"; pos: [number, number, number]; look: [number, number, number] };
  /** extent of the floor drawn in the 2D map */
  bounds: [number, number, number, number];
  hud: { left: string; right: string };
  signal: string;
};

export type Snap = TrackSnap | LoomSnap | RunnerSnap | PlateSnap | GymSnap;

/** Short status line for the fly panel ("SIGNAL LEFT", "TAKE OFF"...). */
export function signalOf(s: Snap | null): string {
  if (!s) return "";
  if (s.kind === "track") return Math.abs(s.car.steer) < 0.08 ? "straight" : s.car.steer > 0 ? "signal right" : "signal left";
  if (s.kind === "loom") return s.jump ? "take off" : s.threat ? "looming" : "resting";
  if (s.kind === "runner") return s.dead ? "crashed" : s.flyY > 0.05 ? "hop" : "running";
  if (s.kind === "gym") return s.signal;
  return s.reversing ? "reversing" : "crawling";
}

const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const mixAngle = (a: number, b: number, t: number) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;

/**
 * Blend two consecutive world states for drawing. The simulation steps every
 * 20 ms; the screen refreshes every 7 to 17 ms. Drawing the blend between the
 * last two steps removes the judder of showing each step as it lands.
 */
export function lerpSnap(a: Snap, b: Snap, t: number): Snap {
  if (a.kind !== b.kind || t >= 1) return b;
  if (t <= 0) return a;
  if (b.kind === "track" && a.kind === "track") {
    // a jump (crash reset) is shown as a cut, not a slide
    if (Math.hypot(b.car.x - a.car.x, b.car.y - a.car.y) > 1) return b;
    return {
      ...b,
      car: { x: mix(a.car.x, b.car.x, t), y: mix(a.car.y, b.car.y, t), h: mixAngle(a.car.h, b.car.h, t), steer: mix(a.car.steer, b.car.steer, t), v: mix(a.car.v, b.car.v, t) },
      rays: { dl: mix(a.rays.dl, b.rays.dl, t), dr: mix(a.rays.dr, b.rays.dr, t), pl: mix(a.rays.pl, b.rays.pl, t), pr: mix(a.rays.pr, b.rays.pr, t) },
    };
  }
  if (b.kind === "loom" && a.kind === "loom") {
    return {
      ...b,
      threat: a.threat && b.threat && a.threat.side === b.threat.side ? { side: b.threat.side, dist: mix(a.threat.dist, b.threat.dist, t) } : b.threat,
      jump: a.jump && b.jump ? { k: mix(a.jump.k, b.jump.k, t), dir: b.jump.dir } : b.jump,
    };
  }
  if (b.kind === "runner" && a.kind === "runner") {
    const dx = b.scroll - a.scroll;
    if (dx < 0 || dx > 2) return b; // restart
    // obstacles all move by the same scroll, so shift the newer list back
    return { ...b, scroll: mix(a.scroll, b.scroll, t), flyY: mix(a.flyY, b.flyY, t), obstacles: b.obstacles.map((o) => ({ ...o, x: o.x + dx * (1 - t) })) };
  }
  if (b.kind === "gym" && a.kind === "gym") {
    // a teleport (new trial, reset) is a cut
    if (Math.hypot(b.fly.x - a.fly.x, b.fly.z - a.fly.z) > 1.5) return b;
    const prev = new Map(a.props.map((p) => [p.id, p]));
    return {
      ...b,
      fly: { ...b.fly, x: mix(a.fly.x, b.fly.x, t), y: mix(a.fly.y, b.fly.y, t), z: mix(a.fly.z, b.fly.z, t), h: mixAngle(a.fly.h, b.fly.h, t), roll: mix(a.fly.roll ?? 0, b.fly.roll ?? 0, t) },
      drum: a.drum && b.drum ? { phase: mixAngle(a.drum.phase, b.drum.phase, t) } : b.drum,
      props: b.props.map((p) => {
        const q = prev.get(p.id);
        if (!q || Math.hypot(p.x - q.x, p.z - q.z) > 1.5) return p;
        return { ...p, x: mix(q.x, p.x, t), y: mix(q.y, p.y, t), z: mix(q.z, p.z, t), rot: p.rot !== undefined && q.rot !== undefined ? mixAngle(q.rot, p.rot, t) : p.rot };
      }),
    };
  }
  if (b.kind === "plate" && a.kind === "plate") {
    if (Math.hypot(b.head.x - a.head.x, b.head.y - a.head.y) > 0.2) return b;
    return { ...b, head: { x: mix(a.head.x, b.head.x, t), y: mix(a.head.y, b.head.y, t) }, heading: mixAngle(a.heading, b.heading, t) };
  }
  return b;
}
