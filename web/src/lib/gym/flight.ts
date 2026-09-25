// Holding a course in flight. A flying fly is knocked off course by gusts; it
// sees its own turning as wide field motion (the HS cells of the lobula plate,
// which respond to horizontal motion) and a dark bar ahead slides to one side
// of its view (LPLC1 on that side). A trained readout of the descending neurons
// sets the steering torque. This is the classic flight simulator experiment
// of Götz and Reichardt, with a connectome in place of the fly.

import type { SenseInput, Theme } from "../experiments/types";
import { clamp, mulberry, wrapAngle } from "../experiments/types";
import type { GymSnap } from "../three/snap";
import type { EpisodeSpec, TrainWorld } from "../training/types";
import { drawGym, metric, SENSE } from "./common";

export type FlightSpec = EpisodeSpec & { gust: number; every: number };

const TORQUE = 14; // rad/s^2 at full output
const DAMP = 2.5; // aerodynamic damping, 1/s

export class FlightWorld implements TrainWorld {
  timeMs = 0;
  private rnd: () => number;
  private e = 0; // heading error, rad (positive: drifted to the right)
  private w = 0; // yaw rate, rad/s
  private gust = 0;
  private nextGust = 400;
  private cosSum = 0;
  private n = 0;
  private within = 0;
  private events: string[] = [];
  private u = 0;

  constructor(readonly spec: FlightSpec, seed: number) {
    this.rnd = mulberry(seed * 53 + 5);
    this.e = (this.rnd() - 0.5) * 0.8;
  }

  sense(): SenseInput[] {
    const out: SenseInput[] = [];
    // turning right makes the world slide left: front to back motion on the right eye drives right HS cells
    const hs = 150 * clamp(Math.abs(this.w) / 2.5, 0, 1) ** 0.7;
    if (hs > 3) out.push({ targets: SENSE.hs(this.w > 0 ? "right" : "left"), hz: hs });
    // the bar ahead: drifting right puts it on the left of the view
    const bar = 140 * clamp(Math.abs(this.e) / 1.2, 0, 1) ** 0.7;
    if (bar > 3) out.push({ targets: SENSE.lplc1(this.e > 0 ? "left" : "right"), hz: bar });
    return out;
  }

  act(action: number[], dtMs: number) {
    const dt = dtMs / 1000;
    this.timeMs += dtMs;
    if (this.timeMs >= this.nextGust) {
      this.gust = (this.rnd() < 0.5 ? -1 : 1) * this.spec.gust * (0.6 + 0.8 * this.rnd());
      this.nextGust = this.timeMs + this.spec.every * (0.6 + 0.8 * this.rnd());
      this.events.push(`Gust from the ${this.gust > 0 ? "left" : "right"}`);
    }
    this.gust *= Math.exp(-dt / 0.25);
    this.u = action[0];
    // positive action steers right; the error grows when turning right
    this.w += (this.gust - DAMP * this.w + TORQUE * action[0]) * dt;
    this.e = wrapAngle(this.e + this.w * dt);
    this.cosSum += Math.cos(this.e);
    this.n++;
    if (Math.abs(this.e) < 0.26) this.within++;
  }

  /** Mean cosine of the heading error: 1 means straight on course, 0 means lost. */
  fitness() {
    return this.n ? this.cosSum / this.n : 0;
  }

  metrics() {
    return [
      metric("On course (within 15°)", this.n ? `${Math.round((100 * this.within) / this.n)}%` : "none yet"),
      metric("Heading error", `${((this.e * 180) / Math.PI).toFixed(0)}°`),
      metric("Score", this.fitness().toFixed(2)),
    ];
  }

  drainEvents() {
    const e = this.events;
    this.events = [];
    return e;
  }

  snapshot(): GymSnap {
    // the fly hangs in the middle of a striped drum and turns; the course is +x
    return {
      kind: "gym",
      task: "flight",
      fly: { x: 0, y: 1.1, z: 0, h: this.e, flap: 1, walk: 0, proboscis: 0, roll: clamp(this.u * 0.5, -0.5, 0.5) },
      props: [{ id: "bar", kind: "box", x: 3.9, y: 1.3, z: 0, sx: 0.1, sy: 2.4, sz: 0.5, color: "#0b0d10" }],
      drum: { phase: 0 },
      view: { mode: "fixed", pos: [-2.6, 1.9, 1.4], look: [1.0, 1.1, 0] },
      bounds: [-4.2, -4.2, 4.2, 4.2],
      hud: { left: `Heading ${((this.e * 180) / Math.PI).toFixed(0)}°`, right: `${this.n ? Math.round((100 * this.within) / this.n) : 0}% on course` },
      signal: Math.abs(this.e) < 0.26 ? "on course" : this.e > 0 ? "drifting right" : "drifting left",
    };
  }

  draw(ctx: CanvasRenderingContext2D, w: number, h: number, t: Theme) {
    drawGym(ctx, w, h, t, this.snapshot());
  }
}
