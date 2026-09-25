// Cross entropy method: sample readouts around a mean, keep the elites,
// move the mean and shrink the spread. Serialisable so runs can be saved
// and resumed.

import { mulberry32 } from "../engine/network";

export type CemConfig = { population: number; elites: number; initStd: number; extraNoise: number; seed: number };

export type CemState = {
  mean: number[];
  std: number[];
  generation: number;
  rngState: number;
};

export const DEFAULT_CEM: CemConfig = { population: 24, elites: 6, initStd: 1, extraNoise: 0.05, seed: 1 };

export function initCem(dim: number, cfg: CemConfig, start?: number[]): CemState {
  return { mean: start ? [...start] : new Array(dim).fill(0), std: new Array(dim).fill(cfg.initStd), generation: 0, rngState: cfg.seed };
}

function gaussian(rnd: () => number) {
  const u = Math.max(1e-12, rnd()), v = rnd();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function sample(state: CemState, cfg: CemConfig): number[][] {
  const rnd = mulberry32(state.rngState * 7919 + state.generation * 104729 + 13);
  const out: number[][] = [];
  // the current mean always competes, so a generation never forgets its best guess
  out.push([...state.mean]);
  while (out.length < cfg.population) out.push(state.mean.map((m, j) => m + state.std[j] * gaussian(rnd)));
  return out;
}

export function update(state: CemState, cfg: CemConfig, candidates: number[][], fitness: number[]): CemState {
  const order = fitness.map((f, i) => [f, i] as const).sort((a, b) => b[0] - a[0]);
  const elite = order.slice(0, cfg.elites).map(([, i]) => candidates[i]);
  const dim = state.mean.length;
  const mean = new Array(dim).fill(0);
  const std = new Array(dim).fill(0);
  for (const e of elite) for (let j = 0; j < dim; j++) mean[j] += e[j] / elite.length;
  for (const e of elite) for (let j = 0; j < dim; j++) std[j] += (e[j] - mean[j]) ** 2 / elite.length;
  const noise = cfg.extraNoise * Math.max(0.1, 1 - state.generation / 60);
  return {
    mean,
    std: std.map((v) => Math.sqrt(v) + noise),
    generation: state.generation + 1,
    rngState: state.rngState,
  };
}
