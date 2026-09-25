// A car on a rounded rectangle track, driven by a trained readout.
// Two range sensors look forward left and forward right; a close wall on one
// side drives that side's LPLC1 neurons, the fly's collision detectors.

import { drawCar, roundRect, stepCar, type Car } from "../experiments/fly";
import { clamp, mulberry, wrapAngle, type Metric, type SenseInput, type Theme } from "../experiments/types";
import type { Target } from "../engine/types";
import type { TrackSnap } from "../three/snap";
import type { EpisodeSpec, TrainWorld } from "./types";

/** Which neurons a close wall on each side excites. */
export type WallSensors = { left: Target[]; right: Target[]; maxHz: number };
export const LPLC1_SENSORS: WallSensors = {
  left: [{ cell_type: "LPLC1", side: "left" }],
  right: [{ cell_type: "LPLC1", side: "right" }],
  maxHz: 160,
};

type P = { x: number; y: number };
export type TrackSpec = EpisodeSpec & { w: number; h: number; r: number; lane: number; dir: number };

const RAY = 3;
const SPEED = 2.4;
const CRASH_PENALTY = 4; // metres

function closest(t: TrackSpec, p: P) {
  const hw = t.w / 2 - t.r, hh = t.h / 2 - t.r;
  const qx = clamp(p.x, -hw, hw), qy = clamp(p.y, -hh, hh);
  const dx = p.x - qx, dy = p.y - qy;
  const d = Math.hypot(dx, dy);
  let nx: number, ny: number;
  if (d > 1e-6) {
    nx = dx / d;
    ny = dy / d;
  } else if (hw - Math.abs(p.x) < hh - Math.abs(p.y)) {
    nx = Math.sign(p.x) || 1;
    ny = 0;
  } else {
    nx = 0;
    ny = Math.sign(p.y) || 1;
  }
  return { offset: d - t.r, center: { x: qx + nx * t.r, y: qy + ny * t.r }, tangent: Math.atan2(nx, -ny) };
}

function ray(t: TrackSpec, p: P, ang: number) {
  for (let s = 0.1; s <= RAY; s += 0.1) {
    if (Math.abs(closest(t, { x: p.x + Math.cos(ang) * s, y: p.y + Math.sin(ang) * s }).offset) > t.lane) return s;
  }
  return RAY;
}

export class TrackWorld implements TrainWorld {
  timeMs = 0;
  private car: Car;
  private events: string[] = [];
  private progress = 0; // metres along the centreline in the driving direction
  private crashes = 0;
  private lastPolar: number;
  private sensors = { pl: 0, pr: 0, dl: RAY, dr: RAY };
  private steer = 0;
  private trail: P[] = [];

  constructor(readonly t: TrackSpec, seed: number, readonly sensorMap: WallSensors = LPLC1_SENSORS) {
    const rnd = mulberry(seed * 7 + 11);
    const s = closest(t, { x: (rnd() - 0.5) * (t.w - 2 * t.r), y: t.h / 2 });
    const h = t.dir > 0 ? s.tangent : s.tangent + Math.PI;
    this.car = { x: s.center.x, y: s.center.y + (rnd() - 0.5) * t.lane * 0.6, h: h + (rnd() - 0.5) * 0.3, v: SPEED * 0.5, steer: 0 };
    this.lastPolar = Math.atan2(this.car.y, this.car.x);
  }

  sense(): SenseInput[] {
    const a = 0.6;
    const dl = ray(this.t, this.car, this.car.h - a);
    const dr = ray(this.t, this.car, this.car.h + a);
    const pl = (1 - dl / RAY) ** 1.5, pr = (1 - dr / RAY) ** 1.5;
    this.sensors = { pl, pr, dl, dr };
    const out: SenseInput[] = [];
    // canvas y points down: heading - a is the car's left
    if (pl > 0.02) out.push({ targets: this.sensorMap.left, hz: this.sensorMap.maxHz * pl });
    if (pr > 0.02) out.push({ targets: this.sensorMap.right, hz: this.sensorMap.maxHz * pr });
    return out;
  }

  act(action: number[], dtMs: number) {
    const dt = dtMs / 1000;
    this.timeMs += dtMs;
    this.steer = action[0];
    stepCar(this.car, SPEED, this.steer * 0.6, dt, 1.1);
    const polar = Math.atan2(this.car.y, this.car.x);
    // progress: polar angle change scaled by the local radius, in the driving direction
    this.progress += wrapAngle(polar - this.lastPolar) * Math.hypot(this.car.x, this.car.y) * this.t.dir;
    this.lastPolar = polar;
    const c = closest(this.t, this.car);
    if (Math.abs(c.offset) > this.t.lane) {
      this.crashes++;
      this.events.push(`Crash into the ${c.offset > 0 ? "outer" : "inner"} wall`);
      this.car.x = c.center.x;
      this.car.y = c.center.y;
      this.car.h = this.t.dir > 0 ? c.tangent : c.tangent + Math.PI;
      this.car.v = SPEED * 0.3;
      this.car.steer = 0;
      this.lastPolar = Math.atan2(this.car.y, this.car.x);
    }
    const last = this.trail[this.trail.length - 1];
    if (!last || Math.hypot(this.car.x - last.x, this.car.y - last.y) > 0.15) {
      this.trail.push({ x: this.car.x, y: this.car.y });
      if (this.trail.length > 200) this.trail.shift();
    }
  }

  fitness() {
    return this.progress - CRASH_PENALTY * this.crashes;
  }

  snapshot(): TrackSnap {
    const c = this.car;
    return {
      kind: "track",
      track: { w: this.t.w, h: this.t.h, r: this.t.r, lane: this.t.lane, dir: this.t.dir },
      car: { x: c.x, y: c.y, h: c.h, steer: c.steer, v: c.v },
      rays: { ...this.sensors },
      crashes: this.crashes,
    };
  }

  metrics(): Metric[] {
    return [
      { label: "Progress", value: `${this.progress.toFixed(1)} m` },
      { label: "Crashes", value: String(this.crashes) },
      { label: "Score", value: this.fitness().toFixed(1) },
      { label: "Steering", value: this.steer.toFixed(2) },
    ];
  }

  drainEvents() {
    const e = this.events;
    this.events = [];
    return e;
  }

  draw(ctx: CanvasRenderingContext2D, w: number, h: number, th: Theme) {
    const t = this.t;
    ctx.fillStyle = th.bg;
    ctx.fillRect(0, 0, w, h);
    const s = Math.min(w / (t.w + t.lane * 2 + 1), h / (t.h + t.lane * 2 + 1));
    const X = (x: number) => w / 2 + x * s, Y = (y: number) => h / 2 + y * s;
    const outline = (off: number) => {
      const hw = t.w / 2 + off, hh = t.h / 2 + off, r = Math.max(0.05, t.r + off);
      roundRect(ctx, X(-hw), Y(-hh), hw * 2 * s, hh * 2 * s, r * s);
    };
    ctx.fillStyle = th.surface;
    outline(t.lane);
    ctx.fill();
    ctx.fillStyle = th.bg;
    outline(-t.lane);
    ctx.fill();
    ctx.strokeStyle = th.line;
    ctx.lineWidth = 1.5;
    outline(t.lane);
    ctx.stroke();
    outline(-t.lane);
    ctx.stroke();
    ctx.strokeStyle = th.accent;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 2;
    ctx.beginPath();
    this.trail.forEach((p, k) => (k ? ctx.lineTo(X(p.x), Y(p.y)) : ctx.moveTo(X(p.x), Y(p.y))));
    ctx.stroke();
    ctx.globalAlpha = 1;
    for (const [a, d, prox] of [
      [-0.6, this.sensors.dl, this.sensors.pl],
      [0.6, this.sensors.dr, this.sensors.pr],
    ]) {
      ctx.strokeStyle = prox > 0.05 ? th.warn : th.text2;
      ctx.globalAlpha = 0.3 + 0.7 * prox;
      ctx.beginPath();
      ctx.moveTo(X(this.car.x), Y(this.car.y));
      ctx.lineTo(X(this.car.x + Math.cos(this.car.h + a) * d), Y(this.car.y + Math.sin(this.car.h + a) * d));
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    drawCar(ctx, X(this.car.x), Y(this.car.y), this.car.h, s * 0.95, s * 0.5, th.accent, th, true);
  }
}
