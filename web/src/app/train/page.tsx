import type { Metadata } from "next";
import Link from "next/link";
import { getLibrary } from "@/lib/data";
import ProjectCard from "@/components/ProjectCard";
import { circuitLabel, clipForTask } from "@/lib/site";
import { TASKS } from "@/lib/training/tasks";

export const metadata: Metadata = {
  title: "Train a connectome",
  description: "Keep a real wiring diagram fixed, train a small readout, and watch the learning curve and the brain's activity live in your browser.",
};

export default async function TrainIndex() {
  const lib = await getLibrary();
  return (
    <div className="wrap">
      <header className="page-intro">
        <div className="crumbs">
          <Link href="/">Home</Link> <span>/</span> Train
        </div>
        <h1>Teach a real connectome a task</h1>
        <p className="lede">
          The wiring stays exactly as it was mapped. A small readout learns to turn the circuit&apos;s activity into movement,
          and you watch the learning curve, the neurons and the body while it happens. Then you train a rewired control and
          find out whether the real wiring made a difference.
        </p>
        <div className="intro-links">
          <Link href="/train/custom" className="text-link">
            Build your own task from a JSON recipe →
          </Link>
        </div>
      </header>
      <div className="card-grid">
        {TASKS.map((t) => {
          const s = lib.find((x) => x.id === t.species);
          return (
            <ProjectCard
              key={t.id}
              href={`/train/${t.id}`}
              eyebrow={s ? circuitLabel(s.common_name) : undefined}
              title={t.title}
              text={t.tagline}
              clip={clipForTask(t.id)}
              tags={[{ label: `${t.features.length * t.actions.length + t.actions.length} trained numbers` }, ...(t.pretrained ? [{ label: "Pretrained readout included", tone: "real" as const }] : [])]}
            />
          );
        })}
      </div>
      <section className="panel block prose" style={{ marginTop: 24 }}>
        <h3>The method, in plain words</h3>
        <p>
          Every task follows the recipe used by the fly connectome demos that went viral in 2026, such as Fly Dino: the
          connectome is a fixed circuit, senses excite fixed input neurons, and a linear readout of chosen output neurons is
          trained with the cross entropy method. Each generation tries a population of readouts, keeps the best quarter, and
          samples the next generation around them.
        </p>
        <p>
          We add what those demos usually leave out: held out test episodes that are never trained on, a hand written readout
          from known biology as a reference, and three controls (rewired, random and silenced circuits) you can train with one
          click and overlay on the same chart.
        </p>
      </section>
    </div>
  );
}
