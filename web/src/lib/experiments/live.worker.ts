/// <reference lib="webworker" />
// Runs the brain half of a live experiment off the main thread.
import { Brain } from "../engine/brain";
import type { BrainVariant, Graph, SpeciesMeta, Target } from "../engine/types";
import { BrainTick } from "./loop";
import type { Channel, SenseInput } from "./types";

export type LiveIn =
  | { type: "init"; graph: Graph; meta: SpeciesMeta; channels: Channel[]; brain: BrainVariant; seed: number; lesion: Target[] }
  | { type: "tick"; id: number; inputs: SenseInput[]; ms: number };

let tick: BrainTick | null = null;

self.onmessage = (e: MessageEvent<LiveIn>) => {
  const m = e.data;
  try {
    if (m.type === "init") {
      const brain = new Brain(m.graph, m.meta, { brain: m.brain, seed: m.seed, lesion: m.lesion });
      tick = new BrainTick(brain, m.channels);
      self.postMessage({ type: "ready", neurons: brain.n });
      return;
    }
    if (m.type === "tick" && tick) {
      const t0 = performance.now();
      const out = tick.run(m.inputs, m.ms);
      self.postMessage({ type: "tick", id: m.id, ...out, computeMs: performance.now() - t0 });
    }
  } catch (err) {
    self.postMessage({ type: "error", message: String(err) });
  }
};
