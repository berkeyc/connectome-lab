// Odour T-maze with a delay: a classic test of choice and of short term memory.
// At the start of each trial the fly smells one of two odours; after a delay
// it reaches the junction and has to turn left for odour A and right for
// odour B. With no delay the cue is still in the circuit when the fly decides.
// With a delay the circuit has to hold it, and a network of leaky neurons
// without learning or persistent activity is not expected to manage that:
// the held out delays measure exactly that limit.

import type { SenseInput, Theme } from "../experiments/types";
import { clamp, mulberry } from "../experiments/types";
import type { GymProp, GymSnap } from "../three/snap";
import type { EpisodeSpec, TrainWorld } from "../training/types";
import { drawGym, metric, pct, SENSE } from "./common";

export type TMazeSpec = EpisodeSpec & { delays: string; trials: number };

const CUE_MS = 400;
const DECIDE_MS = 250;
const ITI_MS = 300;
const STEM = 3.2;
const ARM = 2.4;

type Trial = { odour: 0 | 1; delay: number };

export class TMazeWorld implements TrainWorld {
  timeMs = 0;
  private trials: Trial[] = [];
  private k = 0;
  private t = 0;
  private sum = 0;
  private n = 0;
  private soft = 0;
  private correct = 0;
  private done = 0;
  private byDelay = new Map<number, { ok: number; n: number }>();
  private choice: number | null = null;
  private events: string[] = [];

  constructor(readonly spec: TMazeSpec, seed: number) {
    const rnd = mulberry(seed * 23 + 1);
    const delays = String(spec.delays).split(",").map(Number);
    for (let i = 0; i < spec.trials; i++) this.trials.push({ odour: (i % 2) as 0 | 1, delay: delays[Math.floor(i / 2) % delays.length] });
    for (let i = this.trials.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [this.trials[i], this.trials[j]] = [this.trials[j], this.trials[i]];
    }
  }

  private get trial() {
    return this.trials[this.k % this.trials.length];
  }

  private get phase(): "cue" | "delay" | "decide" | "iti" {
    const tr = this.trial;
    if (this.t < CUE_MS) return "cue";
    if (this.t < CUE_MS + tr.delay) return "delay";
    if (this.t < CUE_MS + tr.delay + DECIDE_MS) return "decide";
    return "iti";
  }

  sense(): SenseInput[] {
    const ph = this.phase;
    const out: SenseInput[] = [];
    if (ph === "cue") out.push({ targets: this.trial.odour === 0 ? SENSE.odourA : SENSE.odourB, hz: 160 });
    // the junction comes into view: a go signal that carries no information about the answer
    if (ph === "decide") out.push({ targets: SENSE.lc16, hz: 60 });
    return out;
  }

  act(action: number[], dtMs: number) {
    this.timeMs += dtMs;
    const was = this.phase;
    this.t += dtMs;
    if (was === "decide") {
      this.sum += action[0];
      this.n++;
    }
    if (was === "decide" && this.phase === "iti") {
      const a = this.n ? this.sum / this.n : 0;
      // odour A: turn left (negative), odour B: turn right (positive)
      const want = this.trial.odour === 0 ? -1 : 1;
      const ok = a * want > 0;
      this.choice = a;
      this.soft += clamp(a * want, -1, 1);
      this.correct += ok ? 1 : 0;
      this.done++;
      const d = this.byDelay.get(this.trial.delay) ?? { ok: 0, n: 0 };
      d.ok += ok ? 1 : 0;
      d.n++;
      this.byDelay.set(this.trial.delay, d);
      this.events.push(`Odour ${this.trial.odour === 0 ? "A" : "B"}, delay ${this.trial.delay} ms: turned ${a < 0 ? "left" : "right"} · ${ok ? "correct" : "wrong"}`);
    }
    if (this.t >= CUE_MS + this.trial.delay + DECIDE_MS + ITI_MS) {
      this.t = 0;
      this.k++;
      this.sum = 0;
      this.n = 0;
      this.choice = null;
    }
  }

  /** Mean signed confidence towards the right arm: 1 is perfect, 0 is chance. */
  fitness() {
    return this.done ? this.soft / this.done : 0;
  }

  metrics() {
    const rows = [...this.byDelay.entries()].sort((a, b) => a[0] - b[0]).map(([d, v]) => metric(`Delay ${d} ms`, `${v.ok} of ${v.n}`));
    return [metric("Correct", this.done ? `${pct(this.correct / this.done)} of ${this.done}` : "none yet"), ...rows];
  }

  drainEvents() {
    const e = this.events;
    this.events = [];
    return e;
  }

  snapshot(): GymSnap {
    const tr = this.trial;
    const ph = this.phase;
    const decideStart = CUE_MS + tr.delay;
    // the fly walks up the stem during the cue and the delay, then into an arm
    const up = clamp(this.t / decideStart, 0, 1);
    let x = 0, z = up * STEM, h = Math.PI / 2;
    if (ph === "iti" && this.choice !== null) {
      const k = clamp((this.t - decideStart - DECIDE_MS) / ITI_MS, 0, 1);
      const dir = this.choice < 0 ? 1 : -1; // left is +x when facing +z
      x = dir * k * ARM * 0.8;
      z = STEM;
      h = dir > 0 ? 0 : Math.PI;
    }
    const wall = "#34404d";
    const props: GymProp[] = [
      { id: "stem-l", kind: "box", x: 0.6, y: 0.2, z: STEM / 2 - 0.3, sx: 0.12, sy: 0.4, sz: STEM + 0.2, color: wall },
      { id: "stem-r", kind: "box", x: -0.6, y: 0.2, z: STEM / 2 - 0.3, sx: 0.12, sy: 0.4, sz: STEM + 0.2, color: wall },
      { id: "top", kind: "box", x: 0, y: 0.2, z: STEM + 0.65, sx: 2 * ARM + 1.2, sy: 0.4, sz: 0.12, color: wall },
      { id: "arm-l", kind: "box", x: ARM / 2 + 0.6, y: 0.2, z: STEM - 0.6, sx: ARM, sy: 0.4, sz: 0.12, color: wall },
      { id: "arm-r", kind: "box", x: -ARM / 2 - 0.6, y: 0.2, z: STEM - 0.6, sx: ARM, sy: 0.4, sz: 0.12, color: wall },
      { id: "food-l", kind: "sphere", x: ARM + 0.4, y: 0.05, z: STEM, sx: 0.18, color: "#9fd17a", glow: 0.3 },
      { id: "food-r", kind: "sphere", x: -ARM - 0.4, y: 0.05, z: STEM, sx: 0.18, color: "#b889e0", glow: 0.3 },
    ];
    if (ph === "cue") props.push({ id: "odour", kind: "cloud", x: 0, y: 0.3, z: z + 0.5, sx: 0.38, color: tr.odour === 0 ? "#9fd17a" : "#b889e0", opacity: 0.35 });
    return {
      kind: "gym",
      task: "tmaze",
      fly: { x, y: 0, z, h, flap: 0, walk: ph === "decide" ? 0 : 0.8, proboscis: 0 },
      props,
      view: { mode: "fixed", pos: [0, 5.5, -2.6], look: [0, 0, 2.2] },
      bounds: [-ARM - 1, -0.8, ARM + 1, STEM + 1],
      hud: { left: `Odour ${tr.odour === 0 ? "A · go left" : "B · go right"} · delay ${tr.delay} ms`, right: this.done ? `${pct(this.correct / this.done)} correct` : "" },
      signal: ph === "cue" ? "smelling" : ph === "delay" ? "waiting" : ph === "decide" ? "choosing" : this.choice !== null ? (this.choice < 0 ? "turned left" : "turned right") : "",
    };
  }

  draw(ctx: CanvasRenderingContext2D, w: number, h: number, t: Theme) {
    drawGym(ctx, w, h, t, this.snapshot());
  }
}
