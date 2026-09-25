// Training runs: what gets saved, exported, imported and (when signed in)
// synced to the user's account. Imported files are validated field by field.
import type { CemConfig, CemState } from "./cem";
import { CIRCUIT_LABEL, type CircuitVariant } from "./types";

export type GenStat = { gen: number; best: number; mean: number; heldOut: number; seconds: number };

export type RunRecord = {
  v: 1;
  id: string;
  name: string;
  taskId: string;
  variant: CircuitVariant;
  cem: CemConfig;
  state: CemState;
  history: GenStat[];
  createdAt: string;
  updatedAt: string;
};

const KEY = "connectome-lab.training-runs.v1";
const MAX_RUNS = 40;
const MAX_GENS = 2000;
const MAX_DIM = 512;

export const newRunId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `run-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export const runLabel = (r: Pick<RunRecord, "variant" | "history">) => {
  const last = r.history[r.history.length - 1];
  return `${CIRCUIT_LABEL[r.variant]} · ${r.history.length} generations${last ? ` · held out ${last.heldOut.toFixed(1)}` : ""}`;
};

const isNum = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
const isNumArr = (x: unknown, max = MAX_DIM): x is number[] => Array.isArray(x) && x.length <= max && x.every(isNum);

/** Returns a clean RunRecord or throws with a readable reason. */
export function validateRun(x: unknown): RunRecord {
  if (!x || typeof x !== "object") throw new Error("Not a training run file");
  const r = x as Record<string, unknown>;
  if (r.v !== 1) throw new Error("Unsupported run file version");
  if (typeof r.taskId !== "string" || r.taskId.length > 80) throw new Error("Missing task");
  if (typeof r.variant !== "string" || !(r.variant in CIRCUIT_LABEL)) throw new Error("Unknown circuit variant");
  const cem = r.cem as Record<string, unknown>;
  if (!cem || ![cem.population, cem.elites, cem.initStd, cem.extraNoise, cem.seed].every(isNum)) throw new Error("Bad optimiser settings");
  const st = r.state as Record<string, unknown>;
  if (!st || !isNumArr(st.mean) || !isNumArr(st.std) || st.mean.length !== st.std.length || !isNum(st.generation) || !isNum(st.rngState))
    throw new Error("Bad optimiser state");
  if (!Array.isArray(r.history) || r.history.length > MAX_GENS) throw new Error("Bad history");
  const history: GenStat[] = r.history.map((h) => {
    const g = h as Record<string, unknown>;
    if (![g.gen, g.best, g.mean, g.heldOut, g.seconds].every(isNum)) throw new Error("Bad history entry");
    return { gen: g.gen as number, best: g.best as number, mean: g.mean as number, heldOut: g.heldOut as number, seconds: g.seconds as number };
  });
  const clampInt = (v: unknown, a: number, b: number) => Math.max(a, Math.min(b, Math.round(v as number)));
  return {
    v: 1,
    id: typeof r.id === "string" && r.id.length <= 64 ? r.id : newRunId(),
    name: typeof r.name === "string" ? r.name.slice(0, 120) : "Imported run",
    taskId: r.taskId,
    variant: r.variant as CircuitVariant,
    cem: {
      population: clampInt(cem.population, 4, 128),
      // elites must be fewer than the population, or selection keeps everyone
      elites: clampInt(cem.elites, 2, Math.max(2, clampInt(cem.population, 4, 128) - 1)),
      initStd: Math.max(0.01, Math.min(5, cem.initStd as number)),
      extraNoise: Math.max(0, Math.min(1, cem.extraNoise as number)),
      seed: clampInt(cem.seed, 0, 1e9),
    },
    state: { mean: st.mean as number[], std: st.std as number[], generation: st.generation as number, rngState: st.rngState as number },
    history,
    createdAt: typeof r.createdAt === "string" ? r.createdAt.slice(0, 40) : new Date().toISOString(),
    updatedAt: typeof r.updatedAt === "string" ? r.updatedAt.slice(0, 40) : new Date().toISOString(),
  };
}

/** Runs saved in this browser. Storage can be unavailable (private mode); then nothing is kept. */
export function loadLocalRuns(): RunRecord[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    const out: RunRecord[] = [];
    for (const x of arr) {
      try {
        out.push(validateRun(x));
      } catch {
        /* skip damaged entries */
      }
    }
    return out;
  } catch {
    return [];
  }
}

export function saveLocalRun(run: RunRecord): boolean {
  try {
    const runs = loadLocalRuns().filter((r) => r.id !== run.id);
    runs.unshift(run);
    localStorage.setItem(KEY, JSON.stringify(runs.slice(0, MAX_RUNS)));
    return true;
  } catch {
    return false;
  }
}

export function deleteLocalRun(id: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify(loadLocalRuns().filter((r) => r.id !== id)));
  } catch {
    /* ignore */
  }
}
