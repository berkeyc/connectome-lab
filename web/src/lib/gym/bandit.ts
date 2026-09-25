// Two flowers, one richer than the other, and the richer one changes side
// halfway through. A classic test of learning from reward (a two armed bandit).
// After each visit the fly tastes sugar if the flower paid, and sees which
// flower it is on. Doing better than chance needs a memory of the last choice
// and its outcome until the next decision. The circuit has no learning, so any
// success has to come from activity that is still echoing in the network.

import type { SenseInput, Theme } from "../experiments/types";
import { clamp, mulberry } from "../experiments/types";
import type { GymProp, GymSnap } from "../three/snap";
import type { EpisodeSpec, TrainWorld } from "../training/types";
import { drawGym, metric, SENSE } from "./common";

export type BanditSpec = EpisodeSpec & { rich: number; poor: number; trials: number; gapMs: number };

const CHOOSE_MS = 200;
const FEEDBACK_MS = 200;

export class BanditWorld implements TrainWorld {
  timeMs = 0;
  private rnd: () => number;
  private k = 0;
  private t = 0;
  private sum = 0;
  private n = 0;
  private choice: 0 | 1 | null = null; // 0 left, 1 right
  private paid = false;
  private expected = 0;
  private rewards = 0;
  private done = 0;
  private richFirst: 0 | 1;
  private events: string[] = [];

  constructor(readonly spec: BanditSpec, seed: number) {
    this.rnd = mulberry(seed * 41 + 9);
    this.richFirst = this.rnd() < 0.5 ? 0 : 1;
  }

  /** Which flower pays more on this trial: switches halfway. */
  private richSide(): 0 | 1 {
    return (this.k < this.spec.trials / 2 ? this.richFirst : 1 - this.richFirst) as 0 | 1;
  }

  private get phase(): "choose" | "feedback" | "gap" {
    if (this.t < CHOOSE_MS) return "choose";
    if (this.t < CHOOSE_MS + FEEDBACK_MS) return "feedback";
    return "gap";
  }

  sense(): SenseInput[] {
    const out: SenseInput[] = [];
    if (this.phase === "choose") out.push({ targets: SENSE.lc16, hz: 60 });
    if (this.phase === "feedback" && this.choice !== null) {
      // the fly sees the flower it landed on, and tastes sugar if it paid
      out.push({ targets: SENSE.lplc1(this.choice === 0 ? "left" : "right"), hz: 120 });
      if (this.paid) out.push({ targets: SENSE.sugar, hz: 150 });
    }
    return out;
  }

  act(action: number[], dtMs: number) {
    this.timeMs += dtMs;
    const was = this.phase;
    this.t += dtMs;
    if (was === "choose") {
      this.sum += action[0];
      this.n++;
    }
    if (was === "choose" && this.phase !== "choose") {
      const c: 0 | 1 = (this.n ? this.sum / this.n : 0) < 0 ? 0 : 1;
      const p = c === this.richSide() ? this.spec.rich : this.spec.poor;
      this.choice = c;
      this.paid = this.rnd() < p;
      this.expected += p;
      this.rewards += this.paid ? 1 : 0;
      this.done++;
      this.events.push(`Trial ${this.done}: ${c === 0 ? "left" : "right"} flower · ${this.paid ? "sugar" : "nothing"}${c === this.richSide() ? "" : " (the poorer one)"}`);
    }
    if (this.t >= CHOOSE_MS + FEEDBACK_MS + this.spec.gapMs) {
      this.t = 0;
      this.k++;
      this.sum = 0;
      this.n = 0;
    }
  }

  /** Expected reward per visit (not the lucky draws), 0.5 x (rich + poor) is chance. */
  fitness() {
    return this.done ? this.expected / this.done : 0;
  }

  metrics() {
    const chance = (this.spec.rich + this.spec.poor) / 2;
    return [
      metric("Expected reward per visit", this.done ? this.fitness().toFixed(2) : "none yet"),
      metric("Chance", chance.toFixed(2)),
      metric("Best possible", this.spec.rich.toFixed(2)),
      metric("Sugar found", `${this.rewards} of ${this.done}`),
      metric("Rich flower", this.richSide() === 0 ? "left" : "right"),
    ];
  }

  drainEvents() {
    const e = this.events;
    this.events = [];
    return e;
  }

  snapshot(): GymSnap {
    const rich = this.richSide();
    const flower = (side: 0 | 1): GymProp => ({
      id: side === 0 ? "flower-l" : "flower-r",
      kind: "flower",
      x: side === 0 ? 1.4 : -1.4,
      y: 0,
      z: 1.6,
      sx: 0.45,
      color: side === 0 ? "#e7a0c4" : "#f0c75e",
      glow: side === rich ? 0.25 : 0,
    });
    const props: GymProp[] = [flower(0), flower(1)];
    const ph = this.phase;
    let x = 0, z = 0, h = Math.PI / 2;
    if (ph !== "choose" && this.choice !== null) {
      const k = clamp((this.t - CHOOSE_MS) / 150, 0, 1);
      x = (this.choice === 0 ? 1.4 : -1.4) * k;
      z = 1.6 * k - 0.35 * k;
      h = Math.atan2(1.25, x || 0.0001);
      if (this.paid && ph === "feedback") props.push({ id: "sugar", kind: "sphere", x: this.choice === 0 ? 1.4 : -1.4, y: 0.12, z: 1.6, sx: 0.1, color: "#fff2c0", glow: 0.8 });
    }
    return {
      kind: "gym",
      task: "bandit",
      fly: { x, y: 0, z, h, flap: 0, walk: ph === "feedback" ? 0.6 : 0, proboscis: this.paid && ph === "feedback" ? 1 : 0 },
      props,
      view: { mode: "fixed", pos: [0, 3.2, -2.4], look: [0, 0, 1.0] },
      bounds: [-2.5, -0.8, 2.5, 2.6],
      hud: { left: `Trial ${this.done} · rich flower ${rich === 0 ? "left" : "right"}`, right: `${this.rewards} sugar` },
      signal: ph === "choose" ? "choosing" : this.paid ? "sugar" : "nothing",
    };
  }

  draw(ctx: CanvasRenderingContext2D, w: number, h: number, t: Theme) {
    drawGym(ctx, w, h, t, this.snapshot());
  }
}
