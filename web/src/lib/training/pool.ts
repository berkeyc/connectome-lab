// A pool of training workers. evaluate() splits candidates across workers and
// returns fitness in the original order.
import type { Graph, SpeciesMeta } from "../engine/types";
import type { CircuitVariant } from "./types";

type Result = { fitness: number[]; features: number[][] };

export class TrainPool {
  private workers: Worker[] = [];
  private seq = 0;
  private pending = new Map<number, { resolve: (r: Result) => void; reject: (e: Error) => void }>();

  constructor(readonly size: number) {}

  async init(taskId: string, spec: unknown, graph: Graph, meta: SpeciesMeta, variant: CircuitVariant, circuitSeed = 1) {
    const ready: Promise<void>[] = [];
    for (let k = 0; k < this.size; k++) {
      const w = new Worker(new URL("./train.worker.ts", import.meta.url), { type: "module" });
      ready.push(
        new Promise<void>((resolve, reject) => {
          w.onmessage = (e) => {
            const m = e.data;
            if (m.type === "ready") resolve();
            else if (m.type === "result") {
              this.pending.get(m.id)?.resolve(m);
              this.pending.delete(m.id);
            } else if (m.type === "error") {
              const err = new Error(m.message);
              reject(err);
              this.pending.get(m.id)?.reject(err);
              this.pending.delete(m.id);
            }
          };
          w.onerror = (e) => reject(new Error(e.message || "Training worker failed"));
        }),
      );
      w.postMessage({ type: "init", taskId, spec, graph, meta, variant, circuitSeed });
      this.workers.push(w);
    }
    await Promise.all(ready);
  }

  private run(w: Worker, weights: number[][], set: "train" | "heldOut", seed: number) {
    const id = ++this.seq;
    return new Promise<Result>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      w.postMessage({ type: "eval", id, weights, set, seed });
    });
  }

  async evaluate(candidates: number[][], set: "train" | "heldOut", seed: number): Promise<Result> {
    const n = this.workers.length;
    const chunks = this.workers.map((_, k) => candidates.filter((_, i) => i % n === k));
    const parts = await Promise.all(this.workers.map((w, k) => (chunks[k].length ? this.run(w, chunks[k], set, seed) : Promise.resolve({ fitness: [], features: [] }))));
    const fitness = new Array(candidates.length);
    const features = new Array(candidates.length);
    parts.forEach((p, k) => p.fitness.forEach((f, j) => {
      fitness[j * n + k] = f;
      features[j * n + k] = p.features[j];
    }));
    return { fitness, features };
  }

  close() {
    for (const w of this.workers) w.terminate();
    this.workers = [];
    for (const p of this.pending.values()) p.reject(new Error("Training stopped"));
    this.pending.clear();
  }
}
