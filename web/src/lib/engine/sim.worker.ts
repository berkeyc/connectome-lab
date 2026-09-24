/// <reference lib="webworker" />
// Runs simulations off the main thread so the page stays responsive.
import { simulate } from "./simulate";
import type { BrainVariant, ExperimentConfig, Graph, SpeciesMeta, Target } from "./types";

let graph: Graph | null = null;
let meta: SpeciesMeta | null = null;

export type WorkerIn =
  | { type: "load"; graph: Graph; meta: SpeciesMeta }
  | { type: "run"; id: number; config: ExperimentConfig }
  | { type: "compare"; id: number; stimulate: Target[]; lesion: Target[]; seeds: number[]; brains: BrainVariant[] };

export type CompareRow = {
  brain: BrainVariant;
  runs: number;
  active: number;
  readouts: { id: string; mean: number; sd: number; values: number[] }[];
};

const stats = (xs: number[]) => {
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, xs.length - 1));
  return { mean, sd };
};

self.onmessage = (e: MessageEvent<WorkerIn>) => {
  const msg = e.data;
  try {
    if (msg.type === "load") {
      graph = msg.graph;
      meta = msg.meta;
      self.postMessage({ type: "ready" });
      return;
    }
    if (!graph || !meta) throw new Error("No species loaded");
    if (msg.type === "run") {
      const result = simulate(graph, meta, msg.config);
      self.postMessage({ type: "result", id: msg.id, result });
      return;
    }
    if (msg.type === "compare") {
      const rows: CompareRow[] = [];
      const total = msg.brains.length * msg.seeds.length;
      let done = 0;
      for (const brain of msg.brains) {
        const perReadout: Record<string, number[]> = {};
        let active = 0;
        for (const seed of msg.seeds) {
          const r = simulate(graph, meta, { stimulate: msg.stimulate, lesion: msg.lesion, brain, seed });
          active += r.activeNeurons;
          for (const ro of r.readouts) (perReadout[ro.id] ??= []).push(ro.value);
          done++;
          self.postMessage({ type: "progress", id: msg.id, done, total });
        }
        rows.push({
          brain,
          runs: msg.seeds.length,
          active: active / msg.seeds.length,
          readouts: Object.entries(perReadout).map(([id, values]) => ({ id, values, ...stats(values) })),
        });
      }
      self.postMessage({ type: "compare", id: msg.id, rows });
    }
  } catch (err) {
    self.postMessage({ type: "error", id: "id" in msg ? msg.id : -1, message: String(err) });
  }
};
