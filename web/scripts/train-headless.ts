// Headless training check: npm run check:training -- <task> <variant> [generations] [population] [seed]
// Prints the learning curve (best, mean of population, held out score of the mean readout).
import { readFileSync } from "node:fs";
import { DEFAULT_CEM, initCem, sample, update } from "../src/lib/training/cem";
import { Evaluator } from "../src/lib/training/episode";
import { getTask } from "../src/lib/training/tasks";
import { HELD_OUT_SEED, paramCount, trainSeed, type CircuitVariant } from "../src/lib/training/types";

const [taskId = "fly-steering", variant = "real", gens = "15", pop = "16", seedArg = "1"] = process.argv.slice(2);
const seed = Number(seedArg);
const task = getTask(taskId)!;
const lib = JSON.parse(readFileSync("public/data/library.json", "utf8"));
const meta = lib.find((m: { id: string }) => m.id === task.species);
const graph = JSON.parse(readFileSync(`public/data/species/${task.species}/graph.json`, "utf8"));
// the seed changes both the optimiser and, for rewired circuits, the rewiring
const ev = new Evaluator(task, graph, meta, variant as CircuitVariant, seed);
const cfg = { ...DEFAULT_CEM, initStd: task.initStd ?? DEFAULT_CEM.initStd, population: Number(pop), seed, elites: Math.max(2, Math.round(Number(pop) / 4)) };
let st = initCem(paramCount(task), cfg);
if (task.handDesigned) {
  const h = ev.score(task.handDesigned.weights, task.train, 1).fitness;
  const hh = ev.score(task.handDesigned.weights, task.heldOut, HELD_OUT_SEED).fitness;
  console.log(`hand designed: train ${h.toFixed(1)} held out ${hh.toFixed(1)}`);
}
for (let g = 0; g < Number(gens); g++) {
  const t0 = Date.now();
  const cands = sample(st, cfg);
  const fit = cands.map((c) => ev.score(c, task.train, trainSeed(task, g)).fitness);
  st = update(st, cfg, cands, fit);
  const held = ev.score(st.mean, task.heldOut, HELD_OUT_SEED).fitness;
  const mean = fit.reduce((a, b) => a + b, 0) / fit.length;
  console.log(`${taskId} ${variant} gen ${g + 1}: best ${Math.max(...fit).toFixed(1)} mean ${mean.toFixed(1)} held-out ${held.toFixed(1)} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
}
console.log("weights", st.mean.map((w) => w.toFixed(2)).join(","));
