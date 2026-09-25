// Fly Gym benchmark: trains every gym task on the real circuit and on the three
// control circuits with the same optimiser, seed and budget, and records the
// held out scores.
//
//   npx tsx scripts/gym-benchmark.ts train <task,...> [generations] [population] [seed]
//   npx tsx scripts/gym-benchmark.ts merge
//
// `train` writes scripts/out/gym-<task>.json; `merge` combines them into
// src/lib/gym/results.json (shown on /gym) and src/lib/gym/pretrained.json
// (the real circuit's readout, used by the live pages).
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { DEFAULT_CEM, initCem, sample, update } from "../src/lib/training/cem";
import { Evaluator } from "../src/lib/training/episode";
import { getTask } from "../src/lib/training/tasks";
import { GYM_EXPERIMENTS } from "../src/lib/gym/catalog";
import { runHeadless } from "../src/lib/experiments/loop";
import type { BrainVariant } from "../src/lib/engine/types";
import { HELD_OUT_SEED, paramCount, trainSeed, type CircuitVariant } from "../src/lib/training/types";

const OUT = "scripts/out";
const TEST_SEEDS = [HELD_OUT_SEED, HELD_OUT_SEED + 101, HELD_OUT_SEED + 202, HELD_OUT_SEED + 303, HELD_OUT_SEED + 404];
const VARIANTS: CircuitVariant[] = ["real", "degree", "random", "silenced"];
const [mode, list = "", gensArg = "10", popArg = "16", seedArg = "1"] = process.argv.slice(2);

if (mode === "train") {
  mkdirSync(OUT, { recursive: true });
  const lib = JSON.parse(readFileSync("public/data/library.json", "utf8"));
  for (const id of list.split(",").filter(Boolean)) {
    const task = getTask(id)!;
    const meta = lib.find((m: { id: string }) => m.id === task.species);
    const graph = JSON.parse(readFileSync(`public/data/species/${task.species}/graph.json`, "utf8"));
    const seed = Number(seedArg), gens = Number(gensArg), pop = Number(popArg);
    const result: Record<string, unknown> = { task: id, generations: gens, population: pop, seed, variants: {} };
    for (const variant of VARIANTS) {
      const t0 = Date.now();
      const ev = new Evaluator(task, graph, meta, variant, seed);
      const cfg = { ...DEFAULT_CEM, initStd: task.initStd ?? DEFAULT_CEM.initStd, population: pop, seed, elites: Math.max(2, Math.round(pop / 4)) };
      let st = initCem(paramCount(task), cfg);
      const curve: number[] = [];
      for (let g = 0; g < gens; g++) {
        const cands = sample(st, cfg);
        const fit = cands.map((c) => ev.score(c, task.train, trainSeed(task, g)).fitness);
        st = update(st, cfg, cands, fit);
        const held = ev.score(st.mean, task.heldOut, HELD_OUT_SEED).fitness;
        curve.push(Number(held.toFixed(4)));
        console.log(`${id} ${variant} gen ${g + 1}/${gens}: train best ${Math.max(...fit).toFixed(3)} held out ${held.toFixed(3)}`);
      }
      // the readout after the last generation is the result; it is never picked by its held out score.
      // It is then tested on several held out episodes, since single episodes of some tasks are noisy.
      const final = [...st.mean];
      const test = (w: number[], specs = task.heldOut) => TEST_SEEDS.reduce((s, sd) => s + ev.score(w, specs, sd).fitness, 0) / TEST_SEEDS.length;
      const heldOut = test(final);
      const train = ev.score(final, task.train, 12345).fitness;
      const hand = task.handDesigned ? test(task.handDesigned.weights) : null;
      // poker: also the equilibrium player, who cannot be beaten on average
      const nash = id === "gym-poker" ? test(final, [{ id: "nash", label: "Equilibrium", opponent: "nash" }]) : null;
      const best = { held: heldOut, weights: final };
      (result.variants as Record<string, unknown>)[variant] = {
        heldOut: Number(best.held.toFixed(4)),
        train: Number(train.toFixed(4)),
        curve,
        hand: hand === null ? null : Number(hand.toFixed(4)),
        nash: nash === null ? null : Number(nash.toFixed(4)),
        weights: best.weights.map((w) => Number(w.toFixed(3))),
        seconds: Math.round((Date.now() - t0) / 1000),
      };
      writeFileSync(`${OUT}/gym-${id}.json`, JSON.stringify(result, null, 1));
    }
  }
} else if (mode === "reflex") {
  // reflex tasks: no training, the real circuit and two controls, several seeds, totals
  mkdirSync(OUT, { recursive: true });
  const lib = JSON.parse(readFileSync("public/data/library.json", "utf8"));
  const seconds = Number(gensArg) || 40;
  const seeds = [1, 2, 3];
  for (const def of GYM_EXPERIMENTS.filter((d) => (list ? list.split(",") : ["gym-feeding", "gym-backaway"]).includes(d.id))) {
    const meta = lib.find((m: { id: string }) => m.id === def.species);
    const graph = JSON.parse(readFileSync(`public/data/species/${def.species}/graph.json`, "utf8"));
    const variants: Record<string, { metrics: Record<string, string>; score: number }> = {};
    for (const brain of ["real", "degree", "random"] as BrainVariant[]) {
      const sums: Record<string, number> = {};
      for (const seed of seeds) {
        const w = runHeadless(def, graph, meta, { seconds, brain, seed });
        for (const m of w.metrics()) {
          const v = parseFloat(m.value);
          if (Number.isFinite(v) && !m.value.includes("Hz")) sums[m.label] = (sums[m.label] ?? 0) + v;
        }
      }
      variants[brain] = { metrics: Object.fromEntries(Object.entries(sums).map(([k, v]) => [k, String(v)])), score: 0 };
      console.log(def.id, brain, JSON.stringify(sums));
    }
    writeFileSync(`${OUT}/reflex-${def.id}.json`, JSON.stringify({ task: def.id, seconds, seeds: seeds.length, variants }, null, 1));
  }
} else if (mode === "merge") {
  const results: Record<string, unknown> = {};
  const pretrained: Record<string, unknown> = {};
  for (const f of readdirSync(OUT).filter((f) => f.startsWith("reflex-") && f.endsWith(".json"))) {
    const r = JSON.parse(readFileSync(`${OUT}/${f}`, "utf8"));
    results[r.task] = { variants: r.variants, seconds: r.seconds, seeds: r.seeds };
  }
  for (const f of readdirSync(OUT).filter((f) => f.startsWith("gym-") && f.endsWith(".json"))) {
    const r = JSON.parse(readFileSync(`${OUT}/${f}`, "utf8"));
    const variants: Record<string, { heldOut: number; train: number; curve: number[]; hand: number | null; nash?: number | null; weights: number[] }> = r.variants;
    results[r.task] = {
      generations: r.generations,
      population: r.population,
      seed: r.seed,
      variants: Object.fromEntries(Object.entries(variants).map(([k, v]) => [k, { heldOut: v.heldOut, train: v.train, curve: v.curve, ...(v.nash != null ? { nash: v.nash } : {}) }])),
      hand: variants.real?.hand ?? null,
    };
    if (variants.real) pretrained[r.task] = { weights: variants.real.weights, generations: r.generations, heldOut: variants.real.heldOut, population: r.population };
  }
  writeFileSync("src/lib/gym/results.json", JSON.stringify(results, null, 1));
  writeFileSync("src/lib/gym/pretrained.json", JSON.stringify(pretrained, null, 1));
  console.log(`merged ${Object.keys(results).length} tasks`);
} else {
  console.log("usage: gym-benchmark.ts train <task,...> [gens] [pop] [seed] | merge");
}
