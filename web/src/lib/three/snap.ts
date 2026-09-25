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

export type Snap = TrackSnap | LoomSnap | RunnerSnap | PlateSnap;

/** Short status line for the fly panel ("SIGNAL LEFT", "TAKE OFF"...). */
export function signalOf(s: Snap | null): string {
  if (!s) return "";
  if (s.kind === "track") return Math.abs(s.car.steer) < 0.08 ? "straight" : s.car.steer > 0 ? "signal right" : "signal left";
  if (s.kind === "loom") return s.jump ? "take off" : s.threat ? "looming" : "resting";
  if (s.kind === "runner") return s.dead ? "crashed" : s.flyY > 0.05 ? "hop" : "running";
  return s.reversing ? "reversing" : "crawling";
}
