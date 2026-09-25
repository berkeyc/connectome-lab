// A brain you can step in real time: set sensory input, advance a few
// milliseconds, read which neurons fired. Used for closed loop experiments
// where a simulated body or vehicle feeds the senses and reads the motor output.
// Same leaky integrate and fire model as simulate.ts (Shiu et al. 2024).

import { buildNetwork, mulberry32, selectNeurons, type Network } from "./network";
import type { BrainVariant, Graph, SpeciesMeta, Target } from "./types";

export class Brain {
  readonly n: number;
  readonly graph: Graph;
  private p: SpeciesMeta["sim"];
  private net: Network;
  private v: Float32Array;
  private g: Float32Array;
  private refr: Int32Array;
  private ring: Float32Array[];
  private delaySteps: number;
  private refSteps: number;
  private decayG: number;
  private leak: number;
  private gap: Float32Array;
  private rnd: () => number;
  private stepIndex = 0;
  /** Poisson input rate per neuron in Hz, written by the experiment every tick. */
  readonly inputHz: Float32Array;
  /** Spikes per neuron since the last call to takeCounts(). */
  private counts: Int32Array;

  constructor(graph: Graph, meta: SpeciesMeta, opts: { brain?: BrainVariant; seed?: number; lesion?: Target[] } = {}) {
    this.graph = graph;
    this.p = meta.sim;
    const seed = opts.seed ?? 1;
    this.net = buildNetwork(graph, meta.sign, this.p.w_syn_mv, opts.lesion ?? [], opts.brain ?? "real", seed);
    this.n = this.net.n;
    this.v = new Float32Array(this.n).fill(this.p.v_rest);
    this.g = new Float32Array(this.n);
    this.refr = new Int32Array(this.n);
    this.delaySteps = Math.max(1, Math.round(this.p.delay_ms / this.p.dt_ms));
    this.refSteps = Math.round(this.p.t_ref_ms / this.p.dt_ms);
    this.decayG = Math.exp(-this.p.dt_ms / this.p.tau_syn_ms);
    this.leak = this.p.dt_ms / this.p.tau_m_ms;
    this.ring = Array.from({ length: this.delaySteps + 1 }, () => new Float32Array(this.n));
    this.gap = new Float32Array(this.n);
    this.rnd = mulberry32(seed * 31 + 7);
    this.inputHz = new Float32Array(this.n);
    this.counts = new Int32Array(this.n);
  }

  get silenced() {
    return this.net.silenced;
  }

  /** Back to rest with the same wiring (for repeated training episodes). */
  reset(seed = 1) {
    this.v.fill(this.p.v_rest);
    this.g.fill(0);
    this.refr.fill(0);
    for (const r of this.ring) r.fill(0);
    this.gap.fill(0);
    this.inputHz.fill(0);
    this.counts = new Int32Array(this.n);
    this.stepIndex = 0;
    this.rnd = mulberry32(seed * 31 + 7);
  }

  /** Set the Poisson input rate for every neuron matching the targets. */
  setInput(targets: Target[], hz: number) {
    for (const i of selectNeurons(this.graph, targets)) this.inputHz[i] = hz;
  }

  clearInput() {
    this.inputHz.fill(0);
  }

  /**
   * Advance the brain by `ms` milliseconds. Returns the spikes that happened,
   * as parallel arrays of time offsets (ms) and neuron indices (capped).
   */
  step(ms: number, cap = 4000): { t: number[]; i: number[] } {
    const p = this.p;
    const dt = p.dt_ms;
    const steps = Math.round(ms / dt);
    const L = this.delaySteps + 1;
    const { start, post, w } = this.net.chem;
    const hasGap = p.g_gap > 0 && this.net.gapPre.length > 0;
    const events = { t: [] as number[], i: [] as number[] };
    // precompute per step input probabilities only for driven neurons
    const driven: number[] = [];
    for (let i = 0; i < this.n; i++) if (this.inputHz[i] > 0 && !this.net.silenced[i]) driven.push(i);

    for (let s = 0; s < steps; s++) {
      const k = this.stepIndex++;
      const arriving = this.ring[k % L];
      const future = this.ring[(k + this.delaySteps) % L];
      for (const i of driven) if (this.rnd() < this.inputHz[i] * dt * 1e-3) this.g[i] += p.input_w_mv;
      if (hasGap) {
        this.gap.fill(0);
        for (let e = 0; e < this.net.gapPre.length; e++) {
          const a = this.net.gapPre[e], b = this.net.gapPost[e];
          this.gap[b] += p.g_gap * this.net.gapW[e] * (this.v[a] - this.v[b]);
        }
      }
      for (let i = 0; i < this.n; i++) {
        this.g[i] = this.g[i] * this.decayG + arriving[i];
        arriving[i] = 0;
        if (this.net.silenced[i]) {
          this.v[i] = p.v_rest;
          continue;
        }
        if (this.refr[i] > 0) {
          this.refr[i]--;
          continue;
        }
        let dv = this.leak * (p.v_rest - this.v[i] + this.g[i]);
        if (hasGap) dv += dt * this.gap[i];
        this.v[i] += dv;
        if (this.v[i] >= p.v_th) {
          this.v[i] = p.v_reset;
          this.refr[i] = this.refSteps;
          this.counts[i]++;
          if (events.t.length < cap) {
            events.t.push(s * dt);
            events.i.push(i);
          }
          for (let e = start[i]; e < start[i + 1]; e++) future[post[e]] += w[e];
        }
      }
    }
    return events;
  }

  /** Spike counts per neuron since the previous call, then reset. */
  takeCounts(): Int32Array {
    const out = this.counts;
    this.counts = new Int32Array(this.n);
    return out;
  }
}

/** Mean firing rate (Hz) of a neuron group from a count window of `ms`. */
export function groupRate(counts: Int32Array, idx: number[], ms: number) {
  if (!idx.length) return 0;
  let s = 0;
  for (const i of idx) s += counts[i];
  return (s / idx.length) * (1000 / ms);
}
