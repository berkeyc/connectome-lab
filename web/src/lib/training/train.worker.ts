// Scores readout candidates on a fixed circuit. One Evaluator per worker;
// the main thread splits each generation across a pool of these.
import type { Graph, SpeciesMeta } from "../engine/types";
import { Evaluator } from "./episode";
import { taskFromSpec, validateSpec } from "./spec";
import { getTask } from "./tasks";
import type { CircuitVariant } from "./types";

let ev: Evaluator | null = null;

type Msg =
  | { type: "init"; taskId: string; spec?: unknown; graph: Graph; meta: SpeciesMeta; variant: CircuitVariant; circuitSeed: number }
  | { type: "eval"; id: number; weights: number[][]; set: "train" | "heldOut"; seed: number };

self.onmessage = (e: MessageEvent<Msg>) => {
  const m = e.data;
  try {
    if (m.type === "init") {
      const task = m.spec ? taskFromSpec(validateSpec(m.spec)) : getTask(m.taskId);
      if (!task) throw new Error(`Unknown task ${m.taskId}`);
      ev = new Evaluator(task, m.graph, m.meta, m.variant, m.circuitSeed);
      self.postMessage({ type: "ready" });
    } else if (m.type === "eval") {
      if (!ev) throw new Error("Worker not initialised");
      const specs = m.set === "train" ? ev.task.train : ev.task.heldOut;
      const out = m.weights.map((w) => ev!.score(w, specs, m.seed));
      self.postMessage({ type: "result", id: m.id, fitness: out.map((o) => o.fitness), features: out.map((o) => o.features) });
    }
  } catch (err) {
    self.postMessage({ type: "error", id: "id" in m ? m.id : -1, message: err instanceof Error ? err.message : String(err) });
  }
};
