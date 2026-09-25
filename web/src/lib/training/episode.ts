// Run one episode of a task with a given readout. Pure and synchronous, so it
// runs the same in Node (checks) and in a Web Worker (the training lab).

import { Brain } from "../engine/brain";
import { selectNeurons } from "../engine/network";
import type { Graph, SpeciesMeta } from "../engine/types";
import { Smoother } from "../experiments/loop";
import { readout, type CircuitVariant, type EpisodeSpec, type TrainTask, type TrainWorld } from "./types";

export const TRAIN_DT_MS = 0.25;

export type EpisodeResult = { fitness: number; features: number[] };

/** Keeps one brain per circuit variant and resets it between episodes. */
export class Evaluator {
  private brain: Brain | null;
  private idx: number[][];

  constructor(readonly task: TrainTask, graph: Graph, meta: SpeciesMeta, readonly variant: CircuitVariant, circuitSeed = 1) {
    // Training uses a 0.25 ms time step instead of 0.1 ms: 2.5 times faster, and
    // firing rates in these circuits change by about 2 percent (see docs/TRAINING.md).
    const m = { ...meta, sim: { ...meta.sim, dt_ms: task.dtMs ?? TRAIN_DT_MS } };
    this.brain = variant === "silenced" ? null : new Brain(graph, m, { brain: variant, seed: circuitSeed });
    this.idx = task.features.map((f) => selectNeurons(graph, f.targets));
  }

  /** Run an episode; `onTick` sees every tick (for live playback). */
  run(
    weights: ArrayLike<number>,
    spec: EpisodeSpec,
    seed: number,
    onTick?: (world: TrainWorld, rates: Record<string, number>, spikes: { t: number[]; i: number[] }) => boolean | void,
  ): EpisodeResult {
    const t = this.task;
    const world = t.createWorld(spec, seed);
    this.brain?.reset(seed);
    const smooth = new Smoother(t.smoothMs);
    const action = new Array(t.actions.length).fill(0);
    const sums = new Array(t.features.length).fill(0);
    const raw: Record<string, number> = {};
    let ticks = 0;
    for (let ms = 0; ms < t.episodeMs; ms += t.tickMs) {
      let spikes = { t: [] as number[], i: [] as number[] };
      if (this.brain) {
        this.brain.clearInput();
        for (const inp of world.sense()) this.brain.setInput(inp.targets, inp.hz);
        spikes = this.brain.step(t.tickMs, onTick ? 4000 : 0);
        const counts = this.brain.takeCounts();
        t.features.forEach((f, j) => {
          let s = 0;
          for (const i of this.idx[j]) s += counts[i];
          raw[f.id] = this.idx[j].length ? (s / this.idx[j].length) * (1000 / t.tickMs) : 0;
        });
      } else {
        world.sense(); // the world still updates its sensors; nothing reaches the readout
        for (const f of t.features) raw[f.id] = 0;
      }
      const rates = smooth.update(raw, t.tickMs);
      readout(t, weights, rates, action);
      world.act(action, t.tickMs);
      t.features.forEach((f, j) => (sums[j] += rates[f.id]));
      ticks++;
      if (onTick && onTick(world, rates, spikes) === false) break;
    }
    return { fitness: world.fitness(), features: sums.map((s) => s / Math.max(1, ticks)) };
  }

  /** Mean fitness over several episodes. */
  score(weights: ArrayLike<number>, specs: EpisodeSpec[], seed: number) {
    let f = 0;
    const feats = new Array(this.task.features.length).fill(0);
    specs.forEach((s, k) => {
      const r = this.run(weights, s, seed + k * 101);
      f += r.fitness;
      r.features.forEach((v, j) => (feats[j] += v / specs.length));
    });
    return { fitness: f / specs.length, features: feats };
  }
}
