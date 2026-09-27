// How the site is organised: the main sections, how experiments are grouped,
// and which preview picture or clip belongs to which project.

import type { ExperimentDef } from "./experiments/types";

export const SECTIONS = [
  { href: "/experiments", label: "Experiments", blurb: "Real circuits driving bodies, live in your browser" },
  { href: "/gym", label: "Benchmark", blurb: "Eight tasks, real wiring against controls" },
  { href: "/train", label: "Train", blurb: "Teach a fixed circuit a new skill" },
  { href: "/library", label: "Library", blurb: "The mapped nervous systems", match: "/species" },
  { href: "/community", label: "Community", blurb: "Projects by others, credited" },
  { href: "/about", label: "About", blurb: "Method, limits and the research landscape", match: "/research" },
] as const;

export type Family = "behaviour" | "game" | "cognition" | "movement";

export const FAMILY_INFO: Record<Family, { title: string; blurb: string }> = {
  behaviour: { title: "Reflexes and behaviours", blurb: "What the wiring does on its own, with no training: escape, feeding, backing away, turning from a wall." },
  movement: { title: "Movement and steering", blurb: "Driving, flying and chasing, with a readout trained on the fixed circuit." },
  game: { title: "Games", blurb: "Poker, Pong and an obstacle run: tasks a fly never evolved for." },
  cognition: { title: "Choice and memory", blurb: "Where a circuit without learning meets its limits, the results say so." },
};

export const FAMILY_ORDER: Family[] = ["behaviour", "movement", "game", "cognition"];

/** Family and animal of every experiment. */
const GROUP: Record<string, { family: Family; animal: "fly" | "worm" }> = {
  "fly-looming-escape": { family: "behaviour", animal: "fly" },
  "gym-feeding": { family: "behaviour", animal: "fly" },
  "gym-backaway": { family: "behaviour", animal: "fly" },
  "worm-dish-edge": { family: "behaviour", animal: "worm" },
  "worm-food-search": { family: "behaviour", animal: "worm" },
  "flywire-looming-escape": { family: "behaviour", animal: "fly" },
  "fly-drives-a-car": { family: "movement", animal: "fly" },
  "gym-flight": { family: "movement", animal: "fly" },
  "gym-chase": { family: "movement", animal: "fly" },
  "fly-parallel-parks": { family: "movement", animal: "fly" },
  "gym-poker": { family: "game", animal: "fly" },
  "gym-pong": { family: "game", animal: "fly" },
  "fly-runner": { family: "game", animal: "fly" },
  "gym-tmaze": { family: "cognition", animal: "fly" },
  "gym-bandit": { family: "cognition", animal: "fly" },
};

export function groupOf(e: Pick<ExperimentDef, "id" | "species">) {
  return GROUP[e.id] ?? { family: (e.id.includes("minecraft") ? "game" : "behaviour") as Family, animal: e.species.startsWith("c-") ? "worm" : "fly" };
}

/** Preview clips rendered frame by frame from the live simulation (scripts/capture-thumbs.mjs). */
export const CLIPS = new Set([
  "fly-looming-escape",
  "fly-runner",
  "fly-drives-a-car",
  "worm-dish-edge",
  "worm-food-search",
  "gym-feeding",
  "gym-backaway",
  "gym-poker",
  "gym-pong",
  "gym-tmaze",
  "gym-bandit",
  "gym-flight",
  "gym-chase",
]);

/** The experiment whose clip illustrates a training task. */
export const TASK_CLIP: Record<string, string> = {
  "fly-steering": "fly-drives-a-car",
  "worm-chemotaxis": "worm-food-search",
};
export const clipForTask = (taskId: string) => TASK_CLIP[taskId] ?? (CLIPS.has(taskId) ? taskId : null);

/** Anatomy previews rendered from neuron positions (pipeline/make_anatomy_thumbs.py), or a clip of the species at work. */
export const SPECIES_VISUAL: Record<string, { image?: string; clip?: string; world?: string }> = {
  "fruit-fly-flywire": { image: "/thumbs/species-fruit-fly-flywire.webp" },
  "fly-escape-circuit": { image: "/thumbs/species-fly-escape-circuit.webp" },
  "fly-visuomotor-circuit": { image: "/thumbs/species-fly-visuomotor-circuit.webp" },
  "fly-gym-circuit": { image: "/thumbs/species-fly-gym-circuit.webp" },
  "c-elegans": { clip: "worm-food-search" },
  "fruit-fly-synthetic": { world: "fly-parallel-parks" },
};

/** How an experiment's brain is used: the wiring alone, a trained readout, the teaching brain, or the local runner. */
export function kindOf(e: Pick<ExperimentDef, "brainKind" | "runsIn" | "dtMs">): "reflex" | "trained" | "teaching" | "local" {
  if (e.brainKind === "synthetic") return "teaching";
  if (e.runsIn !== "browser") return "local";
  return e.dtMs === 0.25 ? "trained" : "reflex";
}

/** "Fruit fly multisensory circuit (FlyWire)" -> "FlyWire multisensory circuit", for card eyebrows where the animal is a tag already. */
export function circuitLabel(full: string): string {
  const flywire = /\(FlyWire\)/.test(full);
  let short = full.replace(/^Fruit fly,?\s*/i, "").replace(/\s*\(FlyWire\)/, "").replace(/^\((.*)\)$/, "$1");
  if (flywire) return `FlyWire ${short}`;
  short = short.charAt(0).toUpperCase() + short.slice(1);
  return short;
}
