import type { Metadata } from "next";
import Link from "next/link";
import ProjectCard from "@/components/ProjectCard";
import Sigil from "@/components/Sigil";
import { getLibrary, STATUS_LABEL } from "@/lib/data";
import { SPECIES_VISUAL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Library",
  description: "The mapped nervous systems in Connectome Lab: the whole FlyWire fly brain, three circuits cut from it, the C. elegans worm and what comes next.",
};

const fmt = (n: number) => n.toLocaleString("en-US");

export default async function LibraryPage() {
  const lib = await getLibrary();
  const open = lib.filter((s) => s.available);
  const coming = lib.filter((s) => !s.available);
  const whole = open.filter((s) => s.status === "import");
  const circuits = open.filter((s) => s.status === "real");
  const teaching = open.filter((s) => s.status === "synthetic");

  const card = (s: (typeof lib)[number], size: "large" | "normal" = "normal") => {
    const v = SPECIES_VISUAL[s.id] ?? {};
    return (
      <ProjectCard
        key={s.id}
        href={`/species/${s.id}`}
        title={s.common_name}
        eyebrow={s.latin_name}
        text={s.summary}
        clip={v.clip}
        image={v.image}
        world={v.world}
        size={size}
        tags={[
          { label: STATUS_LABEL[s.status], tone: s.status === "real" ? "real" : s.status === "synthetic" ? "warn" : "plain" },
          ...(s.stats ? [{ label: `${fmt(s.stats.neurons)} neurons` }] : []),
        ]}
      />
    );
  };

  return (
    <div className="wrap">
      <header className="page-intro">
        <div className="crumbs">
          <Link href="/">Home</Link> <span>/</span> Library
        </div>
        <h1>Library</h1>
        <p className="lede">
          Every dataset in one open format: who is connected to whom, how strongly, and with which transmitter. Open one to see
          its classes, hubs and pathways, stimulate or silence any cell type, and find the experiments that use it.
        </p>
      </header>

      <section className="hub-section">
        <div className="hub-head">
          <h2>The whole fly brain</h2>
          <p>FlyWire v783, every neuron at its measured position. Too large for a browser tab; it runs on the local runner.</p>
        </div>
        <div className="card-grid">{whole.map((s) => card(s, "large"))}</div>
      </section>

      <section className="hub-section">
        <div className="hub-head">
          <h2>Circuits that run in your browser</h2>
          <p>Cut from the full connectomes with every measured synapse kept. Coloured points are the circuit, the grey haze is the rest of the brain.</p>
        </div>
        <div className="card-grid">{circuits.map((s) => card(s))}</div>
      </section>

      {teaching.length > 0 && (
        <section className="hub-section">
          <div className="hub-head">
            <h2>For teaching</h2>
            <p>A textbook circuit layout with invented numbers, labelled wherever it appears.</p>
          </div>
          <div className="card-grid">{teaching.map((s) => card(s))}</div>
        </section>
      )}

      <section className="hub-section">
        <div className="hub-head">
          <h2>Coming next</h2>
          <p>Datasets that are public and planned. New ones come in through one importer script; the method page explains how to add yours.</p>
        </div>
        <ul className="coming">
          {coming.map((s) => (
            <li key={s.id}>
              <Sigil id={s.id} muted size={34} />
              <div>
                <strong>{s.common_name}</strong>
                <span className="latin">{s.latin_name}</span>
                <p>{s.summary}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
