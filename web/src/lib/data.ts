// Server side access to the static data bundles in public/data.
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { SpeciesMeta } from "./engine/types";

export type LibraryEntry = Partial<SpeciesMeta> &
  Pick<SpeciesMeta, "id" | "common_name" | "latin_name" | "status" | "summary" | "dataset"> & {
    available: boolean;
  };

export type Summary = {
  id: string;
  browserSimulation: boolean;
  counts: { neurons: number; chemicalPairs: number; gapPairs: number; synapses: number; cellTypes: number };
  classCounts: { cls: string; n: number }[];
  ntCounts: { nt: string; n: number }[];
  flow: { classes: string[]; matrix: number[][] };
  hubs: { id: string; type: string; cls: string; in_syn: number; out_syn: number }[];
  types: { type: string; cls: string; n: number; nt: string; in_syn: number; out_syn: number }[];
  regions: { region: string; syn: number }[];
};

const DATA = path.join(process.cwd(), "public", "data");

export async function getLibrary(): Promise<LibraryEntry[]> {
  return JSON.parse(await readFile(path.join(DATA, "library.json"), "utf8"));
}

export async function getSpecies(id: string): Promise<LibraryEntry | undefined> {
  return (await getLibrary()).find((s) => s.id === id);
}

export async function getSummary(id: string): Promise<Summary | null> {
  try {
    return JSON.parse(await readFile(path.join(DATA, "species", id, "summary.json"), "utf8"));
  } catch {
    return null;
  }
}

export const STATUS_LABEL: Record<string, string> = {
  real: "Real connectome",
  synthetic: "Synthetic demo",
  import: "Import required",
  planned: "Coming",
};
