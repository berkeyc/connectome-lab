import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import TrainingLab from "@/components/TrainingLab";
import { getSpecies } from "@/lib/data";
import type { SpeciesMeta } from "@/lib/engine/types";
import { getTask, TASKS } from "@/lib/training/tasks";

export function generateStaticParams() {
  return TASKS.map((t) => ({ id: t.id }));
}

export async function generateMetadata(props: PageProps<"/train/[id]">): Promise<Metadata> {
  const t = getTask((await props.params).id);
  if (!t) return {};
  return { title: t.title, description: t.tagline, openGraph: { title: `${t.title} · Connectome Lab`, description: t.tagline } };
}

export default async function TrainPage(props: PageProps<"/train/[id]">) {
  const { id } = await props.params;
  const task = getTask(id);
  if (!task) notFound();
  const species = await getSpecies(task.species);
  if (!species?.browser) notFound();

  return (
    <div className="wrap">
      <header className="page-head compact">
        <div>
          <div className="eyebrow">
            <Link href="/train">Train</Link> · {species.common_name}
          </div>
          <h1>{task.title}</h1>
          <p className="lede">{task.question}</p>
        </div>
      </header>

      <TrainingLab taskId={task.id} meta={species as SpeciesMeta} />

      <div className="two-col" style={{ marginTop: 20 }}>
        <section className="panel block prose">
          <h3>What is being trained</h3>
          {task.description.map((p) => (
            <p key={p}>{p}</p>
          ))}
          {task.inspiredBy && <p className="small faint">Inspired by: {task.inspiredBy}</p>}
        </section>
        <section className="panel block prose">
          <h3>How to read the result</h3>
          <p>
            <b>Fixed:</b> the wiring, the synapse counts, the transmitter signs and the neuron model (Shiu et al. 2024).
            <b> Learned:</b> {task.features.length * task.actions.length + task.actions.length} readout numbers.
          </p>
          <p>
            A rising curve alone proves little: a trained readout can often make use of any network. The evidence is in the
            comparison. Train the real circuit, save it, train a rewired control, and overlay the two held out curves. If the
            real wiring learns faster or generalises better, the specific map carries information the controls lack.
          </p>
          <p>
            Senses: {task.senses.join("; ")}. Readout neurons: {task.features.map((f) => f.label).join(", ")}.
          </p>
          <p className="small faint">
            Training uses a 0.25 ms simulation step (the lab uses 0.1 ms); firing rates in these circuits differ by about 2
            percent. Dataset: {species.dataset}. <Link href={`/species/${species.id}`}>About this dataset</Link>
          </p>
        </section>
      </div>
    </div>
  );
}
