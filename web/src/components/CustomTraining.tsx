"use client";
// Opens a shared experiment spec from the link (#spec=...) and trains it.
// The spec is validated and checked against the circuit before anything runs.
import Link from "next/link";
import { useEffect, useState } from "react";
import TrainingLab from "@/components/TrainingLab";
import type { Graph, SpeciesMeta } from "@/lib/engine/types";
import { decodeSpec, missingTypes, type ExperimentSpec } from "@/lib/training/spec";

export default function CustomTraining() {
  const [state, setState] = useState<{ spec: ExperimentSpec; meta: SpeciesMeta } | { error: string } | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const m = window.location.hash.match(/spec=([A-Za-z0-9_-]+)/);
        if (!m) throw new Error("This link does not contain an experiment.");
        const spec = decodeSpec(m[1]);
        const [lib, graph] = await Promise.all([
          fetch("/data/library.json").then((r) => r.json() as Promise<(SpeciesMeta & { id: string })[]>),
          fetch(`/data/species/${spec.species}/graph.json`).then((r) => r.json() as Promise<Graph>),
        ]);
        const miss = missingTypes(spec, graph);
        if (miss.length) throw new Error(`The circuit has no cell types called ${miss.join(", ")}.`);
        const meta = lib.find((s) => s.id === spec.species);
        if (!meta) throw new Error("Unknown circuit.");
        if (alive) setState({ spec, meta });
      } catch (e) {
        if (alive) setState({ error: e instanceof Error ? e.message : String(e) });
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (!state) return <div className="skeleton" style={{ height: 480, borderRadius: 18 }} />;
  if ("error" in state)
    return (
      <div className="empty-state">
        <p>
          <b>Could not open this experiment.</b> {state.error} <Link href="/community/new">Build a new one</Link>.
        </p>
      </div>
    );
  return (
    <>
      <header className="page-head compact">
        <div>
          <div className="eyebrow">
            <Link href="/community">Community</Link> · shared experiment · {state.meta.common_name}
          </div>
          <h1>{state.spec.title}</h1>
          {state.spec.summary && <p className="lede">{state.spec.summary}</p>}
        </div>
      </header>
      <TrainingLab spec={state.spec} meta={state.meta} />
      <p className="small faint" style={{ marginTop: 16 }}>
        This experiment was built by a user from plain choices (inputs and readout neurons); the circuit, the model and the
        training method are the same as in the built in tasks. <Link href="/community/new">Build your own</Link>.
      </p>
    </>
  );
}
