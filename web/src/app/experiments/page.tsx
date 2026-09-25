import type { Metadata } from "next";
import Link from "next/link";
import WorldThumb from "@/components/WorldThumb";
import { getLibrary } from "@/lib/data";
import { EXPERIMENTS } from "@/lib/experiments/catalog";

export const metadata: Metadata = {
  title: "Experiments",
  description: "Watch real connectomes drive bodies and vehicles: a worm backing away from a wall, a FlyWire circuit escaping a shadow and driving a car. Run them in your browser, next to rewired controls.",
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
                {e.brainKind === "synthetic" && <span className="pill synthetic">Teaching brain</span>}
                <span className="pill">{name(e.localSpecies && e.runsIn !== "browser" ? e.localSpecies : e.species)}</span>
              </div>
              <h3>{e.title}</h3>
              <p>{e.tagline}</p>
            </div>
          </Link>
        ))}
      </div>
      <section className="community-teaser">
        <div>
          <div className="eyebrow">From the community</div>
          <h2>Fly Dino, Swat, the Beat Saber fly and many more</h2>
          <p className="muted">Credited to their authors, with their code, and notes on what each method can show.</p>
        </div>
        <Link className="btn primary" href="/community">
          Open the community gallery
        </Link>
      </section>

      <div className="panel block" style={{ marginTop: 28 }}>
        <h3>Why some experiments run locally</h3>
        <p className="sub" style={{ marginBottom: 0 }}>
          A circuit of a thousand or so neurons simulates faster than real time in a browser tab. The complete FlyWire fly
          brain has about 139,000 neurons and 15 million connections, and games like Minecraft need their own client. For those,
          the brain runs in a small program on your computer and this site connects to it, so you keep the same live
          view, signals and controls.
        </p>
      </div>
    </div>
  );
}
