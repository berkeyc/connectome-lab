// The Fly Gym: eight tasks in four families, all on one FlyWire circuit, each
// measured on the real wiring and on control circuits with the same budget.
// This file turns them into playable experiments and describes them for /gym.

import type { Channel, ExperimentDef } from "../experiments/types";
import { PolicyWorld } from "../training/policy-world";
import { CIRCUIT_LABEL, paramCount, type CircuitVariant, type TrainTask } from "../training/types";
import { GYM_SPECIES } from "./common";
import { BackAwayWorld, FeedingWorld } from "./reflex";
import results from "./results.json";
import { GYM_TASKS } from "./tasks";

export type GymFamily = "behaviour" | "game" | "cognition" | "body";

export const FAMILIES: { id: GymFamily; title: string; blurb: string }[] = [
  { id: "behaviour", title: "Real fly behaviours", blurb: "Reflexes of the real circuit, with no training at all: the wiring alone has to produce the behaviour." },
  { id: "game", title: "Games", blurb: "Games a fly never evolved for. A trained readout turns the circuit's activity into moves." },
  { id: "cognition", title: "Cognitive tests", blurb: "Choice and memory. Where a circuit without learning reaches its limits, the results say so." },
  { id: "body", title: "Body and movement", blurb: "Steering in flight and on foot, with the realistic fly body." },
];

export type GymEntry = {
  id: string;
  family: GymFamily;
  title: string;
  measure: string;
  /** "reflex": no training; "trained": a readout trained by the benchmark */
  kind: "reflex" | "trained";
  experimentId: string;
  taskId?: string;
  /** what counts as chance or doing nothing, and the best possible, in score units */
  chance?: number;
  best?: number;
  unit: string;
};

type Stored = { variants: Partial<Record<CircuitVariant, { heldOut: number; train: number; curve: number[]; nash?: number }>>; hand: number | null; generations: number; population: number };
type Reflex = { variants: Partial<Record<string, { metrics: Record<string, string>; score: number }>>; seconds: number; seeds: number };
export const GYM_RESULTS = results as unknown as Record<string, Stored | Reflex | undefined>;

const task = (id: string) => GYM_TASKS.find((t) => t.id === id)!;

const SHOW = new Set(["DNa02_L", "DNa02_R", "MN9"]);
function trainedChannels(t: TrainTask, inputs: Channel[]): Channel[] {
  return [...inputs, ...t.features.map((f) => ({ ...f, tone: (f.id.endsWith("_L") ? "inhib" : f.id === "MN9" ? "warn" : "accent") as Channel["tone"], hidden: !SHOW.has(f.id) }))];
}

function trainedFindings(id: string, unit: string): ExperimentDef["findings"] {
  const r = GYM_RESULTS[id] as Stored | undefined;
  if (!r?.variants?.real) return [{ label: "Benchmark", value: "not run yet (scripts/gym-benchmark.ts)" }];
  const f = (v?: { heldOut: number }) => (v ? `${v.heldOut.toFixed(2)} ${unit}` : "not run");
  const rows = (["real", "degree", "random", "silenced"] as CircuitVariant[]).map((k) => ({ label: `${CIRCUIT_LABEL[k]}, held out`, value: f(r.variants[k]) }));
  if (r.variants.real.nash !== undefined) rows.push({ label: "Real wiring against the equilibrium player", value: `${r.variants.real.nash.toFixed(3)} chips per hand (0 is the best possible)` });
  if (r.hand !== null) rows.push({ label: "Hand written readout (DNa02 right minus left)", value: `${r.hand.toFixed(2)} ${unit}` });
  rows.push({ label: "Measured with", value: `scripts/gym-benchmark.ts: ${r.generations} generations of ${r.population}, same seed and budget for every circuit` });
  return rows;
}

function watch(id: string, experimentId: string, extra: Partial<ExperimentDef>, inputs: Channel[], unit: string): ExperimentDef {
  const t = task(id);
  const weights = t.pretrained?.weights ?? new Array(paramCount(t)).fill(0);
  return {
    id: experimentId,
    title: t.title,
    species: GYM_SPECIES,
    brainKind: "real",
    runsIn: "browser",
    scene3d: "gym",
    tagline: t.tagline,
    question: t.question,
    description: [...t.description, "What you see is the readout the benchmark trained on the real circuit, playing the held out setting. Switch the circuit to a rewired one to watch the same readout on wiring it was not trained for, or train your own in the training lab."],
    senses: t.senses,
    motor: t.actions.map((a) => `Trained readout of 21 output neurons → ${a.label.toLowerCase()}`),
    inspiredBy: t.inspiredBy,
    findings: [...(trainedFindings(id, unit) ?? []), { label: "Train it yourself", value: `/train/${id}` }],
    channels: trainedChannels(t, inputs),
    smoothMs: t.smoothMs,
    dtMs: 0.25,
    createWorld: (seed) => new PolicyWorld(t, weights, t.heldOut[0], seed),
    ...extra,
  };
}

function reflexFindings(id: string, rows: (m: Record<string, string>) => string): ExperimentDef["findings"] {
  const r = GYM_RESULTS[id] as Reflex | undefined;
  if (!r?.variants?.real) return [{ label: "Benchmark", value: "not run yet (scripts/gym-benchmark.ts reflex)" }];
  const label: Record<string, string> = { real: "Real wiring", degree: "Rewired, same degrees", random: "Random wiring" };
  return [
    ...Object.entries(r.variants).map(([k, v]) => ({ label: label[k] ?? k, value: v ? rows(v.metrics) : "not run" })),
    { label: "Measured with", value: `scripts/gym-benchmark.ts reflex: ${r.seconds} s, ${r.seeds} seeds each, totals` },
  ];
}

const inp = (id: string, label: string, targets: Channel["targets"], tone: Channel["tone"] = "warn"): Channel => ({ id, label, targets, tone });

export const GYM_EXPERIMENTS: ExperimentDef[] = [
  {
    id: "gym-feeding",
    title: "Taste and feed",
    species: GYM_SPECIES,
    brainKind: "real",
    runsIn: "browser",
    scene3d: "gym",
    tagline: "Sugar makes MN9 fire and the proboscis come out; bitter keeps it in. No training: the reflex is in the wiring.",
    question: "Does the real FlyWire wiring from taste neurons to the proboscis motor neuron MN9 produce feeding on its own?",
    description: [
      "The fly walks over a plate with drops of sugar water, bitter water, plain water and sugar mixed with bitter. When its labellum touches a drop, the sugar receptor neurons (LB3, LB2d) or the bitter receptor neurons (LB1) fire.",
      "If MN9 (CB0701 in FlyWire), the motor neuron that extends the proboscis, fires above 40 Hz, the proboscis comes out and the fly drinks. Nothing is trained; only the threshold for 'out' is chosen. The walking path is scripted.",
      "This is the headline result of the whole brain model of Shiu et al. (2024): sugar neurons activate MN9 and bitter neurons suppress it. Here it runs in the 1,846 neuron gym circuit cut from the same connectome.",
    ],
    senses: ["Sugar drop → sugar receptor neurons LB3, LB2d", "Bitter drop → bitter receptor neurons LB1a to LB1e"],
    motor: ["MN9 above 40 Hz → proboscis out, the fly drinks"],
    inspiredBy: "Shiu et al. (2024), A Drosophila computational brain model reveals sensorimotor processing, Nature.",
    findings: reflexFindings("gym-feeding", (m) => `${m["Sugar drops drunk"]} sugar, ${m["Bitter drops drunk"]} bitter and ${m["Sugar with bitter drunk"]} mixed drops drunk; proboscis out on water ${m["Proboscis out on water"]} times`),
    channels: [
      { id: "mn9", label: "Proboscis motor neuron · MN9", targets: [{ cell_type: "CB0701" }], tone: "accent" },
      inp("sugar", "Sugar receptors · LB3, LB2d (input)", [{ cell_type: "LB3" }, { cell_type: "LB2d" }]),
      inp("bitter", "Bitter receptors · LB1 (input)", [{ cell_type: "LB1a,LB1d" }, { cell_type: "LB1b" }, { cell_type: "LB1c" }, { cell_type: "LB1e" }], "inhib"),
    ],
    smoothMs: 40,
    createWorld: (seed) => new FeedingWorld(seed),
  },
  {
    id: "gym-backaway",
    title: "Back away from a wall",
    species: GYM_SPECIES,
    brainKind: "real",
    runsIn: "browser",
    scene3d: "gym",
    tagline: "A wall looms ahead, LC16 fires, the moonwalker neurons take over and the fly walks backwards. No training.",
    question: "Does the real wiring from LC16 to the moonwalker descending neurons turn an approaching wall into backward walking?",
    description: [
      "The fly walks in a square room. The wall straight ahead grows on its retina as it approaches, driving the LC16 visual projection neurons.",
      "If the moonwalker descending neurons (MDN) fire above 40 Hz, the fly walks backwards, then turns away. Otherwise it bumps into the wall. Nothing is trained; the threshold is the only choice.",
      "Activating LC16 makes real flies walk backwards (Wu et al. 2016), and MDN is the command for backward walking (Bidaye et al. 2014).",
    ],
    senses: ["Wall ahead, growing on the retina → LC16"],
    motor: ["MDN above 40 Hz → walk backwards, then turn"],
    inspiredBy: "Wu et al. (2016) on LC16; Bidaye et al. (2014) on the moonwalker neurons.",
    findings: reflexFindings("gym-backaway", (m) => `backed away ${m["Backed away"]} times (${m["Backed away with no wall near"]} with no wall near), bumped into the wall ${m["Bumped into the wall"]} times`),
    channels: [
      { id: "mdn", label: "Moonwalker · MDN", targets: [{ cell_type: "MDN" }], tone: "accent" },
      inp("lc16", "Looming · LC16 (input)", [{ cell_type: "LC16" }]),
      { id: "dna02", label: "Steering · DNa02", targets: [{ cell_type: "DNa02" }], tone: "text" },
    ],
    smoothMs: 40,
    createWorld: (seed) => new BackAwayWorld(seed),
  },
  watch("gym-poker", "gym-poker", {}, [inp("card", "Card seen · LC4, LPLC2, LPLC1 (input)", [{ cell_type: "LC4" }, { cell_type: "LPLC2" }, { cell_type: "LPLC1" }]), inp("bet", "Opponent's action · ORN DM1, DA2 (input)", [{ cell_type: "ORN_DM1" }, { cell_type: "ORN_DA2" }], "inhib")], "chips per hand"),
  watch("gym-pong", "gym-pong", {}, [inp("lplc1", "Ball offset · LPLC1 (input)", [{ cell_type: "LPLC1" }])], "points"),
  watch("gym-tmaze", "gym-tmaze", {}, [inp("odour", "Odours · ORN DM1, DA2 (input)", [{ cell_type: "ORN_DM1" }, { cell_type: "ORN_DA2" }]), inp("go", "Go signal · LC16 (input)", [{ cell_type: "LC16" }], "text")], "(1 perfect, 0 chance)"),
  watch("gym-bandit", "gym-bandit", {}, [inp("sugar", "Reward · sugar receptors (input)", [{ cell_type: "LB3" }, { cell_type: "LB2d" }]), inp("side", "Flower side · LPLC1 (input)", [{ cell_type: "LPLC1" }], "text")], "reward per visit"),
  watch("gym-flight", "gym-flight", {}, [inp("hs", "Self motion · HS cells (input)", [{ cell_type: "HSE" }, { cell_type: "HSN" }, { cell_type: "HSS" }]), inp("bar", "Bar position · LPLC1 (input)", [{ cell_type: "LPLC1" }], "text")], "(1 on course)"),
  watch("gym-chase", "gym-chase", {}, [inp("lplc1", "Target side · LPLC1 (input)", [{ cell_type: "LPLC1" }]), inp("lc4", "Target size · LC4 (input)", [{ cell_type: "LC4" }], "text")], "closeness"),
];

export const GYM: GymEntry[] = [
  { id: "gym-feeding", family: "behaviour", title: "Taste and feed", measure: "Sugar drops drunk; bitter drops refused", kind: "reflex", experimentId: "gym-feeding", unit: "" },
  { id: "gym-backaway", family: "behaviour", title: "Back away from a wall", measure: "Backing away before the wall versus bumping into it", kind: "reflex", experimentId: "gym-backaway", unit: "" },
  { id: "gym-poker", family: "game", title: "Kuhn poker", measure: "Expected chips per hand against an opponent it never met (0.30 is the best possible)", kind: "trained", experimentId: "gym-poker", taskId: "gym-poker", best: 0.296, unit: "chips per hand" },
  { id: "gym-pong", family: "game", title: "Pong", measure: "Hits minus misses with a faster ball", kind: "trained", experimentId: "gym-pong", taskId: "gym-pong", unit: "points" },
  { id: "gym-tmaze", family: "cognition", title: "Odour T-maze with a delay", measure: "Choice confidence towards the right arm (1 perfect, 0 chance)", kind: "trained", experimentId: "gym-tmaze", taskId: "gym-tmaze", chance: 0, best: 1, unit: "" },
  { id: "gym-bandit", family: "cognition", title: "Two flowers", measure: "Expected reward per visit (0.5 chance, 0.8 best)", kind: "trained", experimentId: "gym-bandit", taskId: "gym-bandit", chance: 0.5, best: 0.8, unit: "" },
  { id: "gym-flight", family: "body", title: "Hold a course in flight", measure: "Mean cosine of the heading error in strong gusts (1 on course)", kind: "trained", experimentId: "gym-flight", taskId: "gym-flight", best: 1, unit: "" },
  { id: "gym-chase", family: "body", title: "Chase a moving target", measure: "Mean closeness to a faster target (1 touching)", kind: "trained", experimentId: "gym-chase", taskId: "gym-chase", best: 1, unit: "" },
];
