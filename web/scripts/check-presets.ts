// Runs every preset on the real brain and on control brains and prints the
// readouts. Used as a regression check: npm run check
import { readFileSync } from "node:fs";
import { simulate } from "../src/lib/engine/simulate";
import type { BrainVariant, Graph, SpeciesMeta } from "../src/lib/engine/types";

const library: (SpeciesMeta & { available: boolean; browser: boolean })[] = JSON.parse(
  readFileSync("public/data/library.json", "utf8"),
);
const only = process.argv[2];
let failures = 0;
// Regression expectations: the real brain must show these, and beat the controls clearly.
const EXPECT: Record<string, { readout: string; sign: 1 | -1; min: number }> = {
  "c-elegans/nose-touch": { readout: "direction", sign: -1, min: 30 },
  "fruit-fly-synthetic/looming": { readout: "escape", sign: 1, min: 100 },
  "fruit-fly-synthetic/bristle": { readout: "backward", sign: 1, min: 50 },
  "fruit-fly-synthetic/compass": { readout: "steer", sign: 1, min: 10 },
};
for (const meta of library.filter((m) => m.browser && (!only || m.id === only))) {
  const graph: Graph = JSON.parse(readFileSync(`public/data/species/${meta.id}/graph.json`, "utf8"));
  console.log(`\n== ${meta.common_name} (${graph.neuronIds.length} neurons)`);
  const baseline = simulate(graph, meta, { stimulate: [], lesion: [], brain: "real", seed: 1 });
  console.log(`  baseline spikes ${baseline.totalSpikes}`);
  for (const preset of meta.presets) {
    const row: string[] = [];
    const means: Record<string, Record<string, number>> = {};
    for (const brain of ["real", "degree", "random"] as BrainVariant[]) {
      const vals = [1, 2, 3].map((seed) =>
        simulate(graph, meta, { stimulate: preset.stimulate, lesion: preset.lesion, brain, seed }),
      );
      const r = vals[0];
      const mean = (id: string) => vals.reduce((s, v) => s + v.readouts.find((x) => x.id === id)!.value, 0) / vals.length;
      means[brain] = Object.fromEntries(meta.readouts.map((ro) => [ro.id, mean(ro.id)]));
      row.push(`${brain}: ` + meta.readouts.map((ro) => `${ro.id}=${mean(ro.id).toFixed(1)}`).join(" ") + ` active=${r.activeNeurons} ${r.runtimeMs.toFixed(0)}ms`);
    }
    console.log(`  [${preset.id}] expected: ${preset.expected}`);
    const ex = EXPECT[`${meta.id}/${preset.id}`];
    if (ex) {
      const real = means.real[ex.readout] * ex.sign;
      const ctrl = Math.max(Math.abs(means.degree[ex.readout]), Math.abs(means.random[ex.readout]));
      const ok = real >= ex.min && real > 2 * ctrl;
      if (!ok) failures++;
      console.log(`     ${ok ? "PASS" : "FAIL"} ${ex.readout}: real ${real.toFixed(1)} (need >= ${ex.min} and > 2x controls ${ctrl.toFixed(1)})`);
    }
    for (const l of row) console.log(`     ${l}`);
    const top = simulate(graph, meta, { stimulate: preset.stimulate, lesion: preset.lesion, brain: "real", seed: 1 })
      .rateByType.slice(0, 8).map((t) => `${t.type}:${t.hz.toFixed(0)}`).join(" ");
    console.log(`     top types: ${top}`);
  }
}
process.exit(failures ? 1 : 0);
