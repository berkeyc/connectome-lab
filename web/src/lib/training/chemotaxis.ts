// A worm crawls at constant speed on an agar plate with a bacterial food spot.
// It only senses how the odour changes in time, as real worms do with AWC
// (fires when the smell gets weaker) and ASE (fires when it gets stronger).
// A trained readout from interneurons and head motor neurons sets the turning rate.

import { clamp, mulberry, type Metric, type SenseInput, type Theme } from "../experiments/types";
import type { Target } from "../engine/types";
import type { PlateSnap } from "../three/snap";
import type { EpisodeSpec, TrainWorld } from "./types";

/** Which neurons fire when the odour gets weaker (down) or stronger (up). */
export type OdourSensors = { down: Target[]; up: Target[]; maxHz: number };
export const WORM_ODOUR_SENSORS: OdourSensors = {
  down: [{ cell_type: "AWC" }],
  up: [{ cell_type: "ASE", side: "left" }],
  maxHz: 150,
};

type P = { x: number; y: number };
export type PlateSpec = EpisodeSpec & { fx: number; fy: number; sx: number; sy: number };

const DISH_R = 1;
const SPEED = 0.3; // plate radii per second
const SIGMA = 0.5;
const MAX_TURN = 2.5; // rad per second

export class PlateWorld implements TrainWorld {
  timeMs = 0;
  private head: P;
  private heading: number;
  private trail: P[] = [];
  private events: string[] = [];
  private c: number;
  private dlogc = 0; // rate of change of log concentration, per second
  private dist: number;
  private turn = 0;
  private sumClose = 0;
  private n = 0;
  private reached = false;

  constructor(readonly spec: PlateSpec, seed: number, readonly sensorMap: OdourSensors = WORM_ODOUR_SENSORS) {
    const rnd = mulberry(seed * 97 + 3);
    this.head = { x: spec.sx, y: spec.sy };
    this.heading = rnd() * Math.PI * 2;
    this.c = this.conc(this.head);
    this.dist = Math.hypot(spec.sx - spec.fx, spec.sy - spec.fy);
    this.trail.push({ ...this.head });
  }

  private conc(p: P) {
    return Math.exp(-((p.x - this.spec.fx) ** 2 + (p.y - this.spec.fy) ** 2) / (2 * SIGMA ** 2));
  }

  sense(): SenseInput[] {
    const out: SenseInput[] = [];
    // Worms sense relative change (Weber's law), so the drive follows the rate
    // of change of log concentration.
    const m = this.sensorMap;
    if (this.dlogc < -0.05) out.push({ targets: m.down, hz: clamp(-this.dlogc * 60, 0, m.maxHz) });
    if (this.dlogc > 0.05) out.push({ targets: m.up, hz: clamp(this.dlogc * 60, 0, m.maxHz) });
    return out;
  }

  act(action: number[], dtMs: number) {
    const dt = dtMs / 1000;
    this.timeMs += dtMs;
    this.turn = action[0];
    this.heading += this.turn * MAX_TURN * dt;
    this.head = { x: this.head.x + Math.cos(this.heading) * SPEED * dt, y: this.head.y + Math.sin(this.heading) * SPEED * dt };
    const r = Math.hypot(this.head.x, this.head.y);
    if (r > DISH_R) {
      // slide along the wall
      this.head = { x: (this.head.x / r) * DISH_R, y: (this.head.y / r) * DISH_R };
    }
    const c = this.conc(this.head);
    this.dlogc = (Math.log(c) - Math.log(this.c)) / dt;
    this.c = c;
    this.dist = Math.hypot(this.head.x - this.spec.fx, this.head.y - this.spec.fy);
    this.sumClose += 1 - this.dist / 2;
    this.n++;
    if (!this.reached && this.dist < 0.12) {
      this.reached = true;
      this.events.push(`Reached the food after ${(this.timeMs / 1000).toFixed(1)} s`);
    }
    const last = this.trail[this.trail.length - 1];
    if (Math.hypot(this.head.x - last.x, this.head.y - last.y) > 0.01) {
      this.trail.push({ ...this.head });
      if (this.trail.length > 800) this.trail.shift();
    }
  }

  snapshot(): PlateSnap {
    return { kind: "plate", head: this.head, heading: this.heading, trail: this.trail.slice(-240), food: { x: this.spec.fx, y: this.spec.fy }, foodSigma: SIGMA, reversing: false, touching: false };
  }

  /** Mean closeness to the food over the episode, 0 (plate width away) to 100 (on it). */
  fitness() {
    return this.n ? (100 * this.sumClose) / this.n : 0;
  }

  metrics(): Metric[] {
    return [
      { label: "Closeness score", value: this.fitness().toFixed(0) },
      { label: "Distance to food", value: `${(this.dist * 45).toFixed(1)} mm` },
      { label: "Reached food", value: this.reached ? "yes" : "not yet" },
      { label: "Turning", value: this.turn.toFixed(2) },
    ];
  }

  drainEvents() {
    const e = this.events;
    this.events = [];
    return e;
  }

  draw(ctx: CanvasRenderingContext2D, w: number, h: number, t: Theme) {
    ctx.fillStyle = t.bg;
    ctx.fillRect(0, 0, w, h);
    const s = Math.min(w, h) * 0.46;
    const X = (x: number) => w / 2 + x * s, Y = (y: number) => h / 2 + y * s;
    ctx.fillStyle = t.surface;
    ctx.beginPath();
    ctx.arc(X(0), Y(0), s, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = t.line;
    ctx.stroke();
    const g = ctx.createRadialGradient(X(this.spec.fx), Y(this.spec.fy), 0, X(this.spec.fx), Y(this.spec.fy), s * SIGMA * 2.2);
    g.addColorStop(0, "rgba(120,170,90,0.55)");
    g.addColorStop(1, "rgba(120,170,90,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(X(this.spec.fx), Y(this.spec.fy), s * SIGMA * 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = t.accent;
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    this.trail.forEach((p, k) => (k ? ctx.lineTo(X(p.x), Y(p.y)) : ctx.moveTo(X(p.x), Y(p.y))));
    ctx.stroke();
    ctx.globalAlpha = 1;
    // body: last part of the trail, thick
    const body = this.trail.slice(-24);
    ctx.strokeStyle = t.text;
    ctx.lineWidth = Math.max(3, s * 0.018);
    ctx.lineCap = "round";
    ctx.beginPath();
    body.forEach((p, k) => (k ? ctx.lineTo(X(p.x), Y(p.y)) : ctx.moveTo(X(p.x), Y(p.y))));
    ctx.lineTo(X(this.head.x), Y(this.head.y));
    ctx.stroke();
    ctx.lineCap = "butt";
  }
}
