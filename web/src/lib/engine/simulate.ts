// Whole connectome simulation with two neuron models.
//
// "lif"  Leaky integrate and fire, following Shiu et al. (2024, Nature). Every
//        neuron is a point neuron, every chemical synapse adds a fixed kick scaled
//        by synapse count and signed by the sender's transmitter, and stimulated
//        neurons receive Poisson input. Used for flies, whose neurons spike.
// "rate" Graded activity between 0 and 1 with rectified tanh gain, chemical
//        synapses and gap junction coupling. Used for C. elegans, where most
//        neurons signal with graded potentials instead of spikes.

import { buildNetwork, mulberry32, selectNeurons, type Network } from "./network";
import type { ExperimentConfig, Graph, Readout, SimParams, SimResult, SpeciesMeta } from "./types";

const RASTER_CAP = 60000;
const TRACE_EVERY_MS = 10;

type RunOutput = {
  rate: Float32Array; // Hz for lif, percent of max activity for rate
  totalSpikes: number;
  raster: { t: Float32Array; i: Int32Array };
  trace: { dtMs: number; frames: number; data: Float32Array } | null;
};

function runLif(net: Network, p: SimParams, stim: number[], duration: number, rateHz: number, seed: number): RunOutput {
  const n = net.n;
  const dt = p.dt_ms;
  const steps = Math.round(duration / dt);
  const delaySteps = Math.max(1, Math.round(p.delay_ms / dt));
  const refSteps = Math.round(p.t_ref_ms / dt);
  const decayG = Math.exp(-dt / p.tau_syn_ms);
  const leak = dt / p.tau_m_ms;
  const rnd = mulberry32(seed + 1);

  const v = new Float32Array(n).fill(p.v_rest);
  const gsyn = new Float32Array(n);
  const refr = new Int32Array(n);
  const spikes = new Int32Array(n);
  const ring: Float32Array[] = Array.from({ length: delaySteps + 1 }, () => new Float32Array(n));
  const pInput = rateHz * dt * 1e-3;
  const gapCurrent = new Float32Array(n);
  const hasGap = p.g_gap > 0 && net.gapPre.length > 0;
  const rasterT: number[] = [];
  const rasterI: number[] = [];
  let total = 0;

  for (let s = 0; s < steps; s++) {
    const arriving = ring[s % (delaySteps + 1)];
    const future = ring[(s + delaySteps) % (delaySteps + 1)];
    for (const i of stim) if (rnd() < pInput) gsyn[i] += p.input_w_mv;
    if (hasGap) {
      gapCurrent.fill(0);
      for (let k = 0; k < net.gapPre.length; k++) {
        const a = net.gapPre[k], b = net.gapPost[k];
        gapCurrent[b] += p.g_gap * net.gapW[k] * (v[a] - v[b]);
      }
    }
    for (let i = 0; i < n; i++) {
      gsyn[i] = gsyn[i] * decayG + arriving[i];
      arriving[i] = 0;
      if (net.silenced[i]) {
        v[i] = p.v_rest;
        continue;
      }
      if (refr[i] > 0) {
        refr[i]--;
        continue;
      }
      let dv = leak * (p.v_rest - v[i] + gsyn[i]);
      if (hasGap) dv += dt * gapCurrent[i];
      v[i] += dv;
      if (v[i] >= p.v_th) {
        v[i] = p.v_reset;
        refr[i] = refSteps;
        spikes[i]++;
        total++;
        if (rasterT.length < RASTER_CAP) {
          rasterT.push(s * dt);
          rasterI.push(i);
        }
        const { start, post, w } = net.chem;
        for (let k = start[i]; k < start[i + 1]; k++) future[post[k]] += w[k];
      }
    }
  }
  const rate = new Float32Array(n);
  for (let i = 0; i < n; i++) rate[i] = spikes[i] / (duration / 1000);
  return { rate, totalSpikes: total, raster: { t: Float32Array.from(rasterT), i: Int32Array.from(rasterI) }, trace: null };
}

function runRate(net: Network, p: SimParams, stim: number[], duration: number, seed: number): RunOutput {
  const n = net.n;
  const dt = p.dt_ms;
  const steps = Math.round(duration / dt);
  const tau = p.tau_ms ?? 20;
  const drive = p.input_drive ?? 1;
  const rnd = mulberry32(seed + 1);
  const x = new Float32Array(n);
  const u = new Float32Array(n);
  const acc = new Float64Array(n);
  const isStim = new Uint8Array(n);
  for (const i of stim) isStim[i] = 1;
  // small per neuron noise makes seeds matter, like trial to trial variability
  const noise = new Float32Array(n);
  const every = Math.max(1, Math.round(TRACE_EVERY_MS / dt));
  const frames = Math.floor(steps / every);
  const trace = new Float32Array(frames * n);
  const { start, post, w } = net.chem;

  for (let s = 0; s < steps; s++) {
    u.fill(0);
    for (let i = 0; i < n; i++) {
      if (x[i] === 0) continue;
      for (let k = start[i]; k < start[i + 1]; k++) u[post[k]] += w[k] * x[i];
    }
    for (let k = 0; k < net.gapPre.length; k++) {
      const a = net.gapPre[k], b = net.gapPost[k];
      u[b] += p.g_gap * net.gapW[k] * (x[a] - x[b]);
    }
    if (s % 50 === 0) for (let i = 0; i < n; i++) noise[i] = (rnd() - 0.5) * 0.02;
    for (let i = 0; i < n; i++) {
      if (net.silenced[i]) {
        x[i] = 0;
        continue;
      }
      const input = u[i] + (isStim[i] ? drive : 0) + noise[i];
      const target = input > 0 ? Math.tanh(input) : 0;
      x[i] += (dt / tau) * (target - x[i]);
      if (x[i] < 1e-6) x[i] = 0;
      acc[i] += x[i];
    }
    if (s % every === every - 1) {
      const f = Math.floor(s / every);
      if (f < frames) trace.set(x, f * n);
    }
  }
  const rate = new Float32Array(n);
  for (let i = 0; i < n; i++) rate[i] = (100 * acc[i]) / steps;
  return { rate, totalSpikes: 0, raster: { t: new Float32Array(0), i: new Int32Array(0) }, trace: { dtMs: TRACE_EVERY_MS, frames, data: trace } };
}

export function simulate(g: Graph, meta: SpeciesMeta, config: ExperimentConfig): SimResult & { trace: RunOutput["trace"] } {
  const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();
  const p = meta.sim;
  const model = p.model ?? "lif";
  const duration = config.durationMs ?? p.duration_ms;
  const net = buildNetwork(g, meta.sign, p.w_syn_mv, config.lesion, config.brain, config.seed);
  const stim = selectNeurons(g, config.stimulate).filter((i) => !net.silenced[i]);
  const out =
    model === "rate"
      ? runRate(net, p, stim, duration, config.seed)
      : runLif(net, p, stim, duration, config.inputRateHz ?? p.input_rate_hz, config.seed);
  const n = net.n;
  const rateByNeuron = out.rate;
  const activeThreshold = model === "rate" ? 1 : 0; // percent vs spikes
  let active = 0;
  for (let i = 0; i < n; i++) if (rateByNeuron[i] > activeThreshold) active++;

  const typeSum = new Float64Array(g.types.length);
  const typeN = new Int32Array(g.types.length);
  const typeCls = new Int32Array(g.types.length);
  const clsSum = new Float64Array(g.classes.length);
  const clsN = new Int32Array(g.classes.length);
  for (let i = 0; i < n; i++) {
    typeSum[g.type[i]] += rateByNeuron[i];
    typeN[g.type[i]]++;
    typeCls[g.type[i]] = g.cls[i];
    clsSum[g.cls[i]] += rateByNeuron[i];
    clsN[g.cls[i]]++;
  }
  const rateByType = g.types
    .map((type, t) => ({ type, cls: g.classes[typeCls[t]], hz: typeN[t] ? typeSum[t] / typeN[t] : 0, n: typeN[t] }))
    .sort((a, b) => b.hz - a.hz);
  const rateByClass = g.classes.map((cls, c) => ({ cls, hz: clsN[c] ? clsSum[c] / clsN[c] : 0, n: clsN[c] }));

  const meanRate = (t: { cell_types: string[]; side?: "left" | "right" | "center" }) => {
    const idx = selectNeurons(g, t.cell_types.map((cell_type) => ({ cell_type, side: t.side })));
    if (!idx.length) return 0;
    let sum = 0;
    for (const i of idx) sum += rateByNeuron[i];
    return sum / idx.length;
  };
  const readouts: Readout[] = meta.readouts.map((r) => {
    const pos = meanRate(r.positive);
    const neg = r.negative ? meanRate(r.negative) : null;
    return {
      id: r.id,
      label: r.label,
      value: pos - (neg ?? 0),
      positiveHz: pos,
      negativeHz: neg,
      positiveLabel: r.positive.label,
      negativeLabel: r.negative?.label ?? null,
    };
  });

  const t1 = typeof performance !== "undefined" ? performance.now() : Date.now();
  return {
    config,
    durationMs: duration,
    neurons: n,
    totalSpikes: out.totalSpikes,
    activeNeurons: active,
    unit: model === "rate" ? "%" : "Hz",
    rateByNeuron,
    rateByType,
    rateByClass,
    readouts,
    raster: out.raster,
    trace: out.trace,
    runtimeMs: t1 - t0,
  };
}
