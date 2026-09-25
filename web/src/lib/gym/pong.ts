// Pong for a fly. A ball bounces around a walled court; the fly walks left and
// right behind a paddle. The ball's offset from the paddle drives the fly's
// collision detectors (LPLC1) on that side, more strongly as the ball comes
// closer. A trained readout of the descending neurons sets the walking speed.

import type { SenseInput, Theme } from "../experiments/types";
import { clamp, mulberry } from "../experiments/types";
import type { GymProp, GymSnap } from "../three/snap";
import type { EpisodeSpec, TrainWorld } from "../training/types";
import { drawGym, metric, pct, SENSE } from "./common";

export type PongSpec = EpisodeSpec & { speed: number; spin: number };

const W = 3; // half width of the court
const L = 7; // length of the court
const PADDLE_Z = 0.3;
const PADDLE_HALF = 0.75;
const MAX_V = 4.5;

export class PongWorld implements TrainWorld {
  timeMs = 0;
  private rnd: () => number;
  private ball = { x: 0, z: L - 1, vx: 0, vz: 0 };
  private paddle = 0;
  private v = 0;
  private hits = 0;
  private misses = 0;
  private offsetSum = 0;
  private offsetN = 0;
  private events: string[] = [];
  private flash = 0;

  constructor(readonly spec: PongSpec, seed: number) {
    this.rnd = mulberry(seed * 17 + 3);
    this.serve();
  }

  private serve() {
    const a = (this.rnd() - 0.5) * this.spec.spin;
    this.ball = { x: (this.rnd() - 0.5) * W * 1.6, z: L - 0.8, vx: Math.sin(a) * this.spec.speed, vz: -Math.cos(a) * this.spec.speed };
  }

  sense(): SenseInput[] {
    if (this.ball.vz >= 0) return [];
    const dx = this.ball.x - this.paddle;
    // the fly faces down the court (+z), so a ball at larger x is on its left
    const near = 0.4 + 0.6 * clamp(1 - this.ball.z / L, 0, 1);
    const hz = 150 * near * clamp(Math.abs(dx) / 2, 0, 1) ** 0.6;
    if (hz < 3) return [];
    return [{ targets: SENSE.lplc1(dx > 0 ? "left" : "right"), hz }];
  }

  act(action: number[], dtMs: number) {
    const dt = dtMs / 1000;
    this.timeMs += dtMs;
    // positive action walks towards the fly's right (smaller x)
    this.v += (-action[0] * MAX_V - this.v) * (1 - Math.exp(-dt / 0.08));
    this.paddle = clamp(this.paddle + this.v * dt, -W + PADDLE_HALF, W - PADDLE_HALF);
    const b = this.ball;
    b.x += b.vx * dt;
    b.z += b.vz * dt;
    if (b.x > W - 0.15 || b.x < -W + 0.15) {
      b.vx = -b.vx;
      b.x = clamp(b.x, -W + 0.15, W - 0.15);
    }
    if (b.z > L - 0.15) {
      b.vz = -Math.abs(b.vz);
      b.z = L - 0.15;
    }
    if (b.vz < 0) {
      this.offsetSum += Math.abs(b.x - this.paddle) / W;
      this.offsetN++;
    }
    if (b.z < PADDLE_Z + 0.15 && b.vz < 0) {
      const off = b.x - this.paddle;
      if (Math.abs(off) < PADDLE_HALF + 0.12) {
        this.hits++;
        const sp = Math.hypot(b.vx, b.vz) * 1.03;
        const a = clamp(off / PADDLE_HALF, -1, 1) * 0.7 + (this.rnd() - 0.5) * 0.2;
        b.vx = Math.sin(a) * sp;
        b.vz = Math.cos(a) * sp;
        b.z = PADDLE_Z + 0.16;
        this.flash = 1;
        this.events.push(`Hit · rally ${this.hits}`);
      } else {
        this.misses++;
        this.events.push(`Missed by ${(Math.abs(off) - PADDLE_HALF).toFixed(1)} body lengths`);
        this.serve();
      }
    }
    this.flash = Math.max(0, this.flash - dt * 3);
  }

  /** Returns minus misses, plus hits, minus a little for being far from the ball. */
  fitness() {
    const track = this.offsetN ? this.offsetSum / this.offsetN : 1;
    return this.hits - this.misses - track;
  }

  metrics() {
    const n = this.hits + this.misses;
    return [metric("Hits", String(this.hits)), metric("Misses", String(this.misses)), metric("Returned", n ? pct(this.hits / n) : "none yet"), metric("Ball speed", `${this.spec.speed.toFixed(1)} lengths/s`)];
  }

  drainEvents() {
    const e = this.events;
    this.events = [];
    return e;
  }

  snapshot(): GymSnap {
    const props: GymProp[] = [
      { id: "wall-l", kind: "box", x: W + 0.1, y: 0.15, z: L / 2, sx: 0.2, sy: 0.3, sz: L + 0.4, color: "#3c4a58" },
      { id: "wall-r", kind: "box", x: -W - 0.1, y: 0.15, z: L / 2, sx: 0.2, sy: 0.3, sz: L + 0.4, color: "#3c4a58" },
      { id: "wall-far", kind: "box", x: 0, y: 0.15, z: L + 0.1, sx: 2 * W + 0.4, sy: 0.3, sz: 0.2, color: "#3c4a58" },
      { id: "paddle", kind: "box", x: this.paddle, y: 0.1, z: PADDLE_Z, sx: PADDLE_HALF * 2, sy: 0.2, sz: 0.12, color: "#e8e3d6", glow: this.flash * 0.6 },
      { id: "ball", kind: "sphere", x: this.ball.x, y: 0.18, z: this.ball.z, sx: 0.16, color: "#f2b441", glow: 0.35 },
    ];
    return {
      kind: "gym",
      task: "pong",
      fly: { x: this.paddle, y: 0, z: -0.45, h: Math.PI / 2, flap: 0, walk: Math.min(1, Math.abs(this.v) / 2), proboscis: 0 },
      props,
      view: { mode: "fixed", pos: [0, 4.2, -3.4], look: [0, 0, 2.6] },
      bounds: [-W - 0.5, -1, W + 0.5, L + 0.5],
      hud: { left: `${this.hits} hits · ${this.misses} misses`, right: "" },
      signal: this.ball.vz < 0 ? (Math.abs(this.v) > 0.4 ? (this.v > 0 ? "moving left" : "moving right") : "waiting") : "ball away",
    };
  }

  draw(ctx: CanvasRenderingContext2D, w: number, h: number, t: Theme) {
    drawGym(ctx, w, h, t, this.snapshot());
  }
}
