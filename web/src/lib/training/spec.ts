// Community experiments are plain JSON: pick a circuit, a world, which neurons
// the senses excite and which neurons the readout reads. No code is ever
// uploaded or run; a spec is validated and turned into a TrainTask here.

import type { Graph, Target } from "../engine/types";
import { PlateWorld, type OdourSensors, type PlateSpec } from "./chemotaxis";
import { TrackWorld, type TrackSpec, type WallSensors } from "./drive";
import { getTask } from "./tasks";
import type { Feature, TrainTask } from "./types";

export type ExperimentSpec = {
  v: 1;
  title: string;
  summary: string;
  species: string;
  world: "track" | "plate";
  /** track: [left wall, right wall]; plate: [odour down, odour up] */
  sensors: [Target[], Target[]];
  maxHz: number;
  features: Target[];
};

export const SPEC_SPECIES = ["fly-visuomotor-circuit", "fly-escape-circuit", "c-elegans"] as const;
const SIDES = new Set(["left", "right", "center"]);
const NAME = /^[A-Za-z0-9_.+-]{1,40}$/;

function cleanTargets(x: unknown, max: number, what: string): Target[] {
  if (!Array.isArray(x) || x.length === 0 || x.length > max) throw new Error(`${what}: choose between 1 and ${max} cell types`);
  return x.map((t) => {
    const o = t as Record<string, unknown>;
    if (typeof o?.cell_type !== "string" || !NAME.test(o.cell_type)) throw new Error(`${what}: invalid cell type name`);
    if (o.side !== undefined && (typeof o.side !== "string" || !SIDES.has(o.side))) throw new Error(`${what}: invalid side`);
    return o.side ? { cell_type: o.cell_type, side: o.side as Target["side"] } : { cell_type: o.cell_type };
  });
}

/** Validate untrusted JSON (a link, a file or a database row) into a spec. */
export function validateSpec(x: unknown): ExperimentSpec {
  const o = x as Record<string, unknown>;
  if (!o || typeof o !== "object" || o.v !== 1) throw new Error("Not an experiment spec");
  if (typeof o.title !== "string" || o.title.trim().length < 3 || o.title.length > 100) throw new Error("Title must be 3 to 100 characters");
  if (typeof o.summary !== "string" || o.summary.length > 600) throw new Error("Summary is too long");
  if (typeof o.species !== "string" || !(SPEC_SPECIES as readonly string[]).includes(o.species)) throw new Error("Unknown circuit");
  if (o.world !== "track" && o.world !== "plate") throw new Error("Unknown world");
  if (!Array.isArray(o.sensors) || o.sensors.length !== 2) throw new Error("Two sensor groups are needed");
  const maxHz = Number(o.maxHz);
  if (!Number.isFinite(maxHz) || maxHz < 10 || maxHz > 300) throw new Error("Maximum input rate must be 10 to 300 Hz");
  return {
    v: 1,
    title: o.title.trim(),
    summary: o.summary.trim(),
    species: o.species,
    world: o.world,
    sensors: [cleanTargets(o.sensors[0], 8, "First sensor"), cleanTargets(o.sensors[1], 8, "Second sensor")],
    maxHz,
    features: cleanTargets(o.features, 40, "Readout"),
  };
}

/** Cell types in the spec that the circuit does not contain. */
export function missingTypes(spec: ExperimentSpec, graph: Graph): string[] {
  const have = new Set(graph.types);
  const all = [...spec.sensors[0], ...spec.sensors[1], ...spec.features].map((t) => t.cell_type);
  return [...new Set(all.filter((t) => !have.has(t)))];
}

/** Stable short id for a spec, so saved runs stay attached to the right experiment. */
export function specId(spec: ExperimentSpec) {
  let h = 0x811c9dc5;
  const str = JSON.stringify(spec);
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 0x01000193);
  return `custom-${(h >>> 0).toString(36)}`;
}

const featureId = (t: Target) => `${t.cell_type}${t.side ? `_${t.side[0].toUpperCase()}` : ""}`;

export function taskFromSpec(spec: ExperimentSpec): TrainTask {
  const base = getTask(spec.world === "track" ? "fly-steering" : "worm-chemotaxis")!;
  const features: Feature[] = spec.features.map((t) => ({ id: featureId(t), label: `${t.cell_type}${t.side ? ` ${t.side}` : ""}`, targets: [t] }));
  const [a, b] = spec.sensors;
  const senseLabel = (ts: Target[]) => ts.map((t) => `${t.cell_type}${t.side ? ` ${t.side}` : ""}`).join(", ");
  const createWorld =
    spec.world === "track"
      ? (s: Parameters<TrainTask["createWorld"]>[0], seed: number) => new TrackWorld(s as TrackSpec, seed, { left: a, right: b, maxHz: spec.maxHz } satisfies WallSensors)
      : (s: Parameters<TrainTask["createWorld"]>[0], seed: number) => new PlateWorld(s as PlateSpec, seed, { down: a, up: b, maxHz: spec.maxHz } satisfies OdourSensors);
  return {
    ...base,
    id: specId(spec),
    title: spec.title,
    species: spec.species,
    tagline: spec.summary,
    question: spec.summary,
    description: [spec.summary],
    senses:
      spec.world === "track"
        ? [`Wall close on the left → ${senseLabel(a)}`, `Wall close on the right → ${senseLabel(b)}`]
        : [`Odour getting weaker → ${senseLabel(a)}`, `Odour getting stronger → ${senseLabel(b)}`],
    features,
    handDesigned: undefined,
    createWorld,
    inspiredBy: undefined,
  };
}

/** Share a spec in a URL fragment (never sent to the server). */
export function encodeSpec(spec: ExperimentSpec) {
  const json = JSON.stringify(spec);
  return btoa(String.fromCharCode(...new TextEncoder().encode(json))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeSpec(s: string): ExperimentSpec {
  if (s.length > 12000) throw new Error("Link too long");
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return validateSpec(JSON.parse(new TextDecoder().decode(bytes)));
}
