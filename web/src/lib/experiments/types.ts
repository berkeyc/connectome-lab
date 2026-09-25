// Embodied experiments: a simulated world feeds a connectome's senses and the
// connectome's motor neurons move a body or a vehicle in that world.

import type { Target } from "../engine/types";

export type Theme = {
  bg: string;
  surface: string;
  line: string;
  text: string;
  text2: string;
  accent: string;
  warn: string;
  inhib: string;
};

/** A neuron group whose firing rate is read every tick (motor output or a trace). */
export type Channel = {
  id: string;
  label: string;
  targets: Target[];
  tone?: "accent" | "warn" | "inhib" | "text";
  /** Read by the world but not drawn as a trace. */
  hidden?: boolean;
};

export type SenseInput = { targets: Target[]; hz: number };

export type Metric = { label: string; value: string };

export interface World {
  /** Sensory input for the next tick. */
  sense(): SenseInput[];
  /** Move the body using the smoothed channel rates (Hz). */
  act(rates: Record<string, number>, dtMs: number): void;
  draw(ctx: CanvasRenderingContext2D, w: number, h: number, theme: Theme): void;
  metrics(): Metric[];
  /** New log lines since the last call. */
  drainEvents(): string[];
  /** Brain time since start, ms. */
  timeMs: number;
}

export type ExperimentDef = {
  id: string;
  title: string;
  species: string;
  runsIn: "browser" | "local" | "planned";
  tagline: string;
  question: string;
  description: string[];
  /** Plain words: what feeds the brain, and what the brain drives. */
  senses: string[];
  motor: string[];
  inspiredBy?: string;
  channels: Channel[];
  /** How fast brain time runs compared to the wall clock by default. */
  speed?: number;
  /** Rate smoothing time constant for motor channels. */
  smoothMs?: number;
  createWorld?: (seed: number) => World;
  /** Simulation step override, ms (trained readouts use the training step). */
  dtMs?: number;
  /** Measured results, shown on the experiment page. */
  findings?: { label: string; value: string }[];
  /** "real" for measured wiring, "synthetic" for the invented teaching brain. */
  brainKind?: "real" | "synthetic";
  /** Species used when running on the local runner, if different. */
  localSpecies?: string;
  localNotes?: string[];
};

export const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));

export function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
