import type { Metadata } from "next";
import Link from "next/link";
import ExperimentHub, { type HubItem } from "@/components/ExperimentHub";
import { getLibrary } from "@/lib/data";
import { EXPERIMENTS } from "@/lib/experiments/catalog";
import { circuitLabel, CLIPS, FAMILY_INFO, FAMILY_ORDER, groupOf, kindOf, SPECIES_VISUAL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Experiments",
  description:
    "Real fly and worm circuits driving bodies in your browser: escape, feeding, driving, flight, poker, Pong and more, each next to rewired controls.",
};

export default async function ExperimentsPage() {
  const lib = await getLibrary();
  const name = (id: string) => circuitLabel(lib.find((s) => s.id === id)?.common_name ?? id);
  const items: HubItem[] = EXPERIMENTS.map((e) => {
    const g = groupOf(e);
    const local = e.runsIn !== "browser";
    return {
      id: e.id,
      title: e.title,
      tagline: e.tagline,
      family: g.family,
      animal: g.animal,
      kind: kindOf(e),
      clip: CLIPS.has(e.id) ? e.id : null,
      image: local ? SPECIES_VISUAL["fruit-fly-flywire"]?.image : undefined,
      has2d: Boolean(e.createWorld),
      circuit: name(local && e.localSpecies ? e.localSpecies : e.species),
    };
  });
  const families = FAMILY_ORDER.map((id) => ({ id, ...FAMILY_INFO[id] }));
  const live = items.filter((i) => i.kind !== "local").length;

  return (
    <div className="wrap">
      <header className="page-intro">
        <div className="crumbs">
          <Link href="/">Home</Link> <span>/</span> Experiments
        </div>
        <h1>Experiments</h1>
        <p className="lede">
          Every experiment connects a mapped nervous system to a simulated body and world. The world feeds the senses, the
          real wiring does the rest. {live} run in your browser; switch any of them to a rewired brain and see what survives.
        </p>
        <div className="intro-links">
          <Link href="/gym" className="text-link">
            See how each task scores against controls →
          </Link>
          <Link href="/train" className="text-link">
            Train your own readout →
          </Link>
        </div>
      </header>
      <ExperimentHub items={items} families={families} />
    </div>
  );
}
