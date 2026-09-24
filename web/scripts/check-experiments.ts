// Headless run of every browser experiment on the real brain and a rewired
// control. npm run check:experiments [experiment-id]
import { readFileSync } from "node:fs";
import { EXPERIMENTS } from "../src/lib/experiments/catalog";
import { runHeadless } from "../src/lib/experiments/loop";
import type { BrainVariant, Graph, SpeciesMeta } from "../src/lib/engine/types";

const lib: SpeciesMeta[] = JSON.parse(readFileSync("public/data/library.json", "utf8"));
const only = process.argv[2];
const seconds = Number(process.env.SECONDS ?? 30);
for (const def of EXPERIMENTS.filter((e) => e.runsIn === "browser" && (!only || e.id === only))) {
  const meta = lib.find((m) => m.id === def.species)!;
  const graph: Graph = JSON.parse(readFileSync(`public/data/species/${def.species}/graph.json`, "utf8"));
  console.log(`\n== ${def.title}`);
  for (const brain of ["real", "degree"] as BrainVariant[]) {
    for (const seed of [1, 2]) {
      const t0 = Date.now();
      const w = runHeadless(def, graph, meta, { seconds, brain, seed });
      console.log(`  ${brain.padEnd(6)} seed ${seed}: ` + w.metrics().map((m) => `${m.label}=${m.value}`).join(" | ") + ` (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
    }
  }
}
