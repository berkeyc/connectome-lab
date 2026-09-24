// The closed loop: senses -> brain -> smoothed motor rates -> world.
// Used directly in Node (headless checks) and split across a worker in the browser.

import { Brain, groupRate } from "../engine/brain";
import { selectNeurons } from "../engine/network";
import type { BrainVariant, Graph, SpeciesMeta, Target } from "../engine/types";
import type { Channel, ExperimentDef, SenseInput, World } from "./types";

export class Smoother {
  private values: Record<string, number> = {};
  constructor(private tauMs: number) {}
  update(raw: Record<string, number>, dtMs: number) {
    const a = 1 - Math.exp(-dtMs / this.tauMs);
    for (const [k, v] of Object.entries(raw)) this.values[k] = (this.values[k] ?? 0) + a * (v - (this.values[k] ?? 0));
    return { ...this.values };
  }
}

/** Brain side of a tick: apply inputs, step, read channel rates. */
export class BrainTick {
  private idx: Record<string, number[]>;
  constructor(readonly brain: Brain, channels: Channel[]) {
    this.idx = Object.fromEntries(channels.map((c) => [c.id, selectNeurons(brain.graph, c.targets)]));
  }
  run(inputs: SenseInput[], ms: number) {
    this.brain.clearInput();
    for (const inp of inputs) this.brain.setInput(inp.targets, inp.hz);
    const spikes = this.brain.step(ms);
    const counts = this.brain.takeCounts();
    const rates: Record<string, number> = {};
    for (const [id, idx] of Object.entries(this.idx)) rates[id] = groupRate(counts, idx, ms);
    let active = 0;
    for (let i = 0; i < counts.length; i++) if (counts[i]) active++;
    return { rates, spikes, active };
  }
}

export function runHeadless(
  def: ExperimentDef,
  graph: Graph,
  meta: SpeciesMeta,
  opts: { seconds: number; brain?: BrainVariant; seed?: number; lesion?: Target[]; tickMs?: number },
): World {
  const seed = opts.seed ?? 1;
  const world = def.createWorld!(seed);
  const brain = new Brain(graph, meta, { brain: opts.brain, seed, lesion: opts.lesion });
  const tick = new BrainTick(brain, def.channels);
  const smooth = new Smoother(def.smoothMs ?? 100);
  const ms = opts.tickMs ?? 20;
  for (let t = 0; t < opts.seconds * 1000; t += ms) {
    const { rates } = tick.run(world.sense(), ms);
    world.act(smooth.update(rates, ms), ms);
  }
  return world;
}
