import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ExperimentPlayer from "@/components/ExperimentPlayer";
import { getSpecies } from "@/lib/data";
import type { SpeciesMeta } from "@/lib/engine/types";
import { EXPERIMENTS, getExperiment } from "@/lib/experiments/catalog";

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
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="page-head" style={{ paddingBottom: 18 }}>
        <div>
          <div className="eyebrow">
            <Link href="/experiments" style={{ textDecoration: "none" }}>
              Experiments
            </Link>{" "}
            · {species?.common_name}
          </div>
          <h1 style={{ fontSize: "clamp(28px, 3.8vw, 44px)", marginTop: 8 }}>{e.title}</h1>
          <p className="lede" style={{ marginTop: 12 }}>
            {e.question}
          </p>
        </div>
      </div>

      {e.createWorld ? (
        <ExperimentPlayer experimentId={e.id} meta={browserMeta} />
      ) : (
        <div className="panel empty">
          <span className="pill local">Planned · local runner</span>
          <h3 style={{ marginTop: 12 }}>This experiment is on the roadmap</h3>
          <p>It will run on the local runner once its game bridge is ready. The description below explains the plan.</p>
        </div>
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
    </div>
  );
}
