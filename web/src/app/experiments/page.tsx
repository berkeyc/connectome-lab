import type { Metadata } from "next";
import Link from "next/link";
import CommunityGrid from "@/components/CommunityGrid";
import WorldThumb from "@/components/WorldThumb";
import { getLibrary } from "@/lib/data";
import { EXPERIMENTS } from "@/lib/experiments/catalog";

export const metadata: Metadata = {
  title: "Experiments",
  description: "Watch real connectomes drive bodies and vehicles: a worm backing away from a wall, a fly escaping a shadow, a fly driving and parking a car. Run them in your browser.",
};

const RUNS = { browser: "Runs in your browser", local: "Local runner", planned: "Planned · local" } as const;

export default async function ExperimentsPage() {
  const lib = await getLibrary();
  const name = (id: string) => lib.find((s) => s.id === id)?.common_name ?? id;
  return (
    <div className="wrap">
      <div className="page-head">
        <div>
          <div className="eyebrow">Experiment library</div>
          <h1 style={{ fontSize: "clamp(32px, 4.4vw, 50px)", marginTop: 10 }}>Brains in bodies</h1>
          <p className="lede" style={{ marginTop: 16 }}>
            Every experiment connects a mapped nervous system to a simulated world. The world feeds the senses, the
            connectome moves the body. Swap in a rewired brain and see whether the behaviour survives.
          </p>
        </div>
      </div>
      <div className="exp-grid">
        {EXPERIMENTS.map((e, k) => (
          <Link key={e.id} href={`/experiments/${e.id}`} className={`panel exp-card reveal ${k < 2 ? "wide" : ""}`} style={{ ["--i" as string]: k }}>
            {e.createWorld ? <WorldThumb id={e.id} /> : <div className="exp-thumb" style={{ display: "grid", placeItems: "center", color: "var(--text-3)" }}>coming to the local runner</div>}
            <div className="exp-body">
              <div className="exp-meta">
                <span className={`pill ${e.runsIn === "browser" ? "real" : "local"}`}>{RUNS[e.runsIn]}</span>
                <span className="pill">{name(e.localSpecies && e.runsIn !== "browser" ? e.localSpecies : e.species)}</span>
              </div>
              <h3>{e.title}</h3>
              <p>{e.tagline}</p>
            </div>
          </Link>
        ))}
      </div>
      <section style={{ marginTop: 56 }} id="community">
        <div className="section-head">
          <div>
            <div className="eyebrow">From the community</div>
            <h2 style={{ marginTop: 8 }}>The experiments that went viral</h2>
          </div>
          <p className="muted small" style={{ maxWidth: "52ch", margin: 0 }}>
            In September 2026 people wired fly connectomes into games, cars and 3D bodies. Play the browser ones in a new
            window, or try our own versions of the same ideas right here, with rewired brains to compare.
          </p>
        </div>
        <CommunityGrid />
      </section>

      <div className="panel block" style={{ marginTop: 28 }}>
        <h3>Why some experiments run locally</h3>
        <p className="sub" style={{ marginBottom: 0 }}>
          A 5,000 neuron brain simulates faster than real time in a browser tab. The complete FlyWire fly brain has
          about 140,000 neurons and millions of connections, and games like Minecraft need their own client. For those,
          the brain runs in a small program on your computer and this site connects to it, so you keep the same live
          view, signals and controls.
        </p>
      </div>
    </div>
  );
}
