// Training a readout on a fixed connectome.
//
// The wiring diagram and its dynamics are never changed. Senses drive fixed
// input neurons, the circuit runs, and a small linear readout turns the
// firing rates of chosen output neurons into actions. Only the readout
// weights are learned, with the cross entropy method (CEM), the same recipe
// used by Fly Dino and similar connectome demos. Controls answer the real
// question: does the specific wiring help, or would any network do?

import type { Target } from "../engine/types";
import type { Metric, SenseInput, Theme } from "../experiments/types";

/** A world that takes actions in [-1, 1] and scores the episode. */
export interface TrainWorld {
  timeMs: number;
  sense(): SenseInput[];
  act(action: number[], dtMs: number): void;
  /** Episode score so far; higher is better. */
  fitness(): number;
  metrics(): Metric[];
  drainEvents(): string[];
  draw(ctx: CanvasRenderingContext2D, w: number, h: number, theme: Theme): void;
}

export type Feature = { id: string; label: string; targets: Target[] };

/** One episode setting (a track, a start position, a food location). */
export type EpisodeSpec = { id: string; label: string; [k: string]: number | string };

export type TrainTask = {
  id: string;
  title: string;
  species: string;
  tagline: string;
  question: string;
  description: string[];
  senses: string[];
  /** Neuron groups whose smoothed rates feed the readout. */
  features: Feature[];
  actions: { id: string; label: string }[];
  /** Rates are divided by this before the readout (Hz). */
  featureScale: number;
  smoothMs: number;
  tickMs: number;
  episodeMs: number;
  /** New random start conditions every generation (true) or the same ones (false). */
  varySeeds: boolean;
  /** Starting spread of the readout weights (default 1). */
  initStd?: number;
  /** Simulation time step for training, ms (default 0.25). */
  dtMs?: number;
  /** Training episodes; every candidate is scored on all of them. */
  train: EpisodeSpec[];
  /** Never used for training; scored after every generation. */
  heldOut: EpisodeSpec[];
  /** A readout trained offline (npm run check:training) and shipped with the site. */
  pretrained?: { weights: number[]; generations: number; heldOut: number; population: number };
  /** A readout written by hand from known biology, for comparison. */
  handDesigned?: { label: string; weights: number[] };
  createWorld: (spec: EpisodeSpec, seed: number) => TrainWorld;
  inspiredBy?: string;
};

/** How the circuit is set up for a training run. */
export type CircuitVariant = "real" | "degree" | "random" | "silenced";

export const CIRCUIT_LABEL: Record<CircuitVariant, string> = {
  real: "Real wiring",
  degree: "Rewired, same degrees",
  random: "Random wiring",
  silenced: "Circuit silenced",
};

/** Seed for a generation's training episodes. Held out episodes always use HELD_OUT_SEED. */
export const trainSeed = (t: TrainTask, generation: number) => (t.varySeeds ? 1 + generation : 1);
export const HELD_OUT_SEED = 999;

export const paramCount = (t: TrainTask) => t.actions.length * (t.features.length + 1);

/** Linear readout with tanh squashing. Weights are [action][feature..., bias]. */
export function readout(t: TrainTask, w: ArrayLike<number>, rates: Record<string, number>, out: number[]) {
  const F = t.features.length;
  for (let a = 0; a < t.actions.length; a++) {
    let s = w[a * (F + 1) + F];
    for (let j = 0; j < F; j++) s += w[a * (F + 1) + j] * ((rates[t.features[j].id] ?? 0) / t.featureScale);
    out[a] = Math.tanh(s);
  }
  return out;
}
