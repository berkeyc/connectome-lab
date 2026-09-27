import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ExperimentPlayer from "@/components/ExperimentPlayer";
import { getSpecies } from "@/lib/data";
import type { SpeciesMeta } from "@/lib/engine/types";
import ProjectCard from "@/components/ProjectCard";
import { EXPERIMENTS, getExperiment } from "@/lib/experiments/catalog";
import { getTask } from "@/lib/training/tasks";
import { CLIPS, FAMILY_INFO, groupOf, kindOf } from "@/lib/site";

const KIND = { reflex: "No training: the wiring alone", trained: "Trained readout on fixed wiring", teaching: "Teaching brain (invented numbers)", local: "Local runner" } as const;

export function generateStaticParams() {
  return EXPERIMENTS.map((e) => ({ id: e.id }));
}

export async function generateMetadata(props: PageProps<"/experiments/[id]">): Promise<Metadata> {
  const e = getExperiment((await props.params).id);
  if (!e) return {};
  return {
    title: e.title,
    description: e.tagline,
    openGraph: { title: `${e.title} · Connectome Lab`, description: e.tagline, type: "website" },
  };
}

export default async function ExperimentPage(props: PageProps<"/experiments/[id]">) {
  const { id } = await props.params;
  const e = getExperiment(id);
  if (!e) notFound();
  const species = await getSpecies(e.runsIn === "browser" ? e.species : (e.localSpecies ?? e.species));
  const browserMeta = e.runsIn === "browser" ? ((await getSpecies(e.species)) as SpeciesMeta) : undefined;
  const group = groupOf(e);
  const kind = kindOf(e);
  const trainable = getTask(e.id) ? e.id : e.id === "fly-drives-a-car" ? "fly-steering" : e.id === "worm-food-search" ? "worm-chemotaxis" : null;
  const related = EXPERIMENTS.filter((x) => x.id !== e.id && groupOf(x).family === group.family && x.runsIn === "browser").slice(0, 4);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LearningResource",
    name: e.title,
    description: e.tagline,
    learningResourceType: "Interactive simulation",
    about: ["Connectomics", "Computational neuroscience", species?.latin_name ?? ""],
    isAccessibleForFree: true,
  };

  return (
    <div className="wrap">
      {/* JSON-LD: "<" is escaped so no string can close the script tag */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <header className="page-intro compact">
        <div className="crumbs">
          <Link href="/experiments">Experiments</Link> <span>/</span> <Link href={`/experiments#fam-${group.family}`}>{FAMILY_INFO[group.family].title}</Link>
        </div>
        <h1>{e.title}</h1>
        <p className="lede">{e.question}</p>
        <div className="intro-meta">
          <span className={`tag ${kind === "reflex" ? "real" : kind === "teaching" ? "warn" : "plain"}`}>{KIND[kind]}</span>
          <span className="tag plain">{species?.common_name}</span>
          {trainable && (
            <Link className="text-link" href={`/train/${trainable}`}>
              Train it yourself →
            </Link>
          )}
          {e.id.startsWith("gym-") && (
            <Link className="text-link" href="/gym">
              Benchmark scores →
            </Link>
          )}
        </div>
      </header>

      {e.createWorld ? (
        <ExperimentPlayer experimentId={e.id} meta={browserMeta} />
      ) : (
        <div className="panel empty">
          <span className="pill local">Planned · local runner</span>
          <h3 style={{ marginTop: 12 }}>This experiment is on the roadmap</h3>
          <p>It will run on the local runner once its game bridge is ready. The description below explains the plan.</p>
        </div>
      )}

      {e.brainKind === "synthetic" && (
        <p className="notice" style={{ marginTop: 16 }}>
          This experiment runs on the synthetic teaching brain: a textbook circuit layout with invented numbers. It illustrates an
          idea; it is not a result about real flies.
        </p>
      )}

      {e.findings && (
        <section className="findings">
          <h3>What we measured</h3>
          <dl>
            {e.findings.map((f) => (
              <div key={f.label}>
                <dt>{f.label}</dt>
                <dd>{f.value.startsWith("/") ? <Link href={f.value}>{f.value}</Link> : f.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <div className="two-col">
        <div className="panel block prose" style={{ maxWidth: "none" }}>
          <h3>What happens</h3>
          {e.description.map((p) => (
            <p key={p}>{p}</p>
          ))}
          {e.inspiredBy && <p className="small faint">Inspired by: {e.inspiredBy}</p>}
        </div>
        <div className="panel block">
          <h3>How the brain is wired to the world</h3>
          <p className="sub">The mapping is part of the experiment design. Everything between senses and motor output is the connectome.</p>
          <div className="mapping">
            <div>
              <div className="eyebrow">Senses → neurons</div>
              <ul>
                {e.senses.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
            <div>
              <div className="eyebrow">Neurons → movement</div>
              <ul>
                {e.motor.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
          </div>
          <p className="small faint" style={{ marginTop: 16 }}>
            Dataset: {species?.dataset}.{" "}
            {species && species.status !== "planned" && <Link href={`/species/${species.id}`}>About this dataset</Link>}
          </p>
        </div>
      </div>

      <div className="panel block" style={{ marginTop: 20 }} id="local">
        <h3>Run it locally</h3>
        <p className="sub">
          Every experiment can also use the local runner, which simulates the brain on your own computer. It is required
          for connectomes too large for a browser.
        </p>
        <pre className="mono small" style={{ background: "var(--surface-2)", padding: 14, borderRadius: 10, overflow: "auto" }}>
{`git clone https://github.com/berkeyc/connectome-lab.git
cd connectome-lab
pip install -r local/requirements.txt
python local/runner.py            # listens on ws://localhost:8765`}
        </pre>
        <p className="small muted">Then choose “Local runner” in the player controls and press Restart. Your browser may ask for permission to connect to a local device.</p>
        {e.localNotes && (
          <ul className="notes" style={{ marginTop: 10 }}>
            {e.localNotes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        )}
      </div>
      {related.length > 0 && (
        <section className="related" aria-labelledby="related-head">
          <div className="hub-head">
            <h2 id="related-head">More {FAMILY_INFO[group.family].title.toLowerCase()}</h2>
          </div>
          <div className="card-grid">
            {related.map((r) => (
              <ProjectCard key={r.id} href={`/experiments/${r.id}`} title={r.title} text={r.tagline} clip={CLIPS.has(r.id) ? r.id : null} size="compact" />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
