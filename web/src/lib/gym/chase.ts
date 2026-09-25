// Chasing a moving target, as a courting male follows a female. The target's
// direction relative to the fly drives the collision detectors on that side
// (LPLC1), and when it is close and large the looming detectors (LC4) join in.
// Two trained readouts of the descending neurons set turning and walking speed.

import type { SenseInput, Theme } from "../experiments/types";
import { clamp, mulberry, wrapAngle } from "../experiments/types";
import type { GymSnap } from "../three/snap";
import type { EpisodeSpec, TrainWorld } from "../training/types";
import { drawGym, metric, SENSE } from "./common";

export type ChaseSpec = EpisodeSpec & { speed: number; wiggle: number };

const R = 5; // arena radius
const TURN = 4; // rad/s at full output
const MAX_SPEED = 2.4;

export class ChaseWorld implements TrainWorld {
  timeMs = 0;
  private rnd: () => number;
  private fly: { x: number; z: number; h: number; v: number };
  private tgt: { x: number; z: number; h: number };
  private close = 0;
  private n = 0;
  private near = 0;
  private events: string[] = [];
  private wasNear = false;

  constructor(readonly spec: ChaseSpec, seed: number) {
    this.rnd = mulberry(seed * 61 + 17);
    const a = this.rnd() * Math.PI * 2;
    this.fly = { x: 0, z: 0, h: this.rnd() * Math.PI * 2, v: 0 };
    this.tgt = { x: Math.cos(a) * 2.5, z: Math.sin(a) * 2.5, h: this.rnd() * Math.PI * 2 };
  }

  private rel() {
    const dx = this.tgt.x - this.fly.x, dz = this.tgt.z - this.fly.z;
    return { d: Math.hypot(dx, dz), b: wrapAngle(Math.atan2(dz, dx) - this.fly.h) };
  }

  sense(): SenseInput[] {
    const { d, b } = this.rel();
    const out: SenseInput[] = [];
    // negative bearing is on the fly's left
    const side = b < 0 ? "left" : "right";
    const off = 150 * clamp(Math.abs(b) / 1.2, 0, 1) ** 0.6;
    if (off > 3) out.push({ targets: SENSE.lplc1(side), hz: off });
    const size = 2 * Math.atan(0.3 / Math.max(0.2, d));
    if (size > 0.15 && Math.abs(b) < 1.5) out.push({ targets: SENSE.lc4(side), hz: clamp(size * 160, 0, 150) });
    return out;
  }

  act(action: number[], dtMs: number) {
    const dt = dtMs / 1000;
    this.timeMs += dtMs;
    const f = this.fly;
    f.h = wrapAngle(f.h + action[0] * TURN * dt);
    f.v += ((0.5 + 0.5 * action[1]) * MAX_SPEED - f.v) * (1 - Math.exp(-dt / 0.15));
    f.x += Math.cos(f.h) * f.v * dt;
    f.z += Math.sin(f.h) * f.v * dt;
    // the target wanders and turns back at the arena edge
    const t = this.tgt;
    t.h += (this.rnd() - 0.5) * this.spec.wiggle * dt * 10;
    if (Math.hypot(t.x, t.z) > R - 0.6) t.h = Math.atan2(-t.z, -t.x) + (this.rnd() - 0.5);
    t.x += Math.cos(t.h) * this.spec.speed * dt;
    t.z += Math.sin(t.h) * this.spec.speed * dt;
    const r = Math.hypot(f.x, f.z);
    if (r > R - 0.3) {
      f.x *= (R - 0.3) / r;
      f.z *= (R - 0.3) / r;
    }
    const { d } = this.rel();
    this.close += Math.exp(-d / 1.5);
    this.n++;
    const isNear = d < 1.2;
    if (isNear) this.near++;
    if (isNear && !this.wasNear) this.events.push("Caught up with the target");
    if (!isNear && this.wasNear && d > 2) this.events.push("Lost the target");
    if (d > 2 || isNear) this.wasNear = isNear;
  }

  /** Mean closeness, exp(-distance / 1.5 body lengths): 1 is touching, near 0 is lost. */
  fitness() {
    return this.n ? this.close / this.n : 0;
  }

  metrics() {
    const { d } = this.rel();
    return [
      metric("Time within 1.2 lengths", this.n ? `${Math.round((100 * this.near) / this.n)}%` : "none yet"),
      metric("Distance", `${d.toFixed(1)} body lengths`),
      metric("Score", this.fitness().toFixed(2)),
      metric("Target speed", `${this.spec.speed.toFixed(1)} lengths/s`),
    ];
  }

  drainEvents() {
    const e = this.events;
    this.events = [];
    return e;
  }

  snapshot(): GymSnap {
    const { d, b } = this.rel();
    return {
      kind: "gym",
      task: "chase",
      fly: { x: this.fly.x, y: 0, z: this.fly.z, h: this.fly.h, flap: 0, walk: clamp(this.fly.v / 1.5, 0, 1), proboscis: 0 },
      props: [
        { id: "target", kind: "fly", x: this.tgt.x, y: 0, z: this.tgt.z, rot: this.tgt.h, sx: 0.9, color: "#d6b08a" },
        { id: "arena", kind: "disc", x: 0, y: 0.005, z: 0, sx: R, color: "#1b2530", opacity: 0.6 },
      ],
      view: { mode: "follow", dist: 3.2, height: 2.2 },
      bounds: [-R, -R, R, R],
      hud: { left: `Target ${d.toFixed(1)} lengths away`, right: `${this.n ? Math.round((100 * this.near) / this.n) : 0}% close` },
      signal: d < 1.2 ? "on the target" : Math.abs(b) < 0.3 ? "target ahead" : b < 0 ? "target left" : "target right",
    };
  }

  draw(ctx: CanvasRenderingContext2D, w: number, h: number, t: Theme) {
    drawGym(ctx, w, h, t, this.snapshot());
  }
}
