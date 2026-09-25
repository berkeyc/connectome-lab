import Link from "next/link";
import ExperimentPlayer from "@/components/ExperimentPlayer";
import Sigil from "@/components/Sigil";
import WorldThumb from "@/components/WorldThumb";
import { COMMUNITY } from "@/lib/community";
import { getLibrary, STATUS_LABEL } from "@/lib/data";
import type { SpeciesMeta } from "@/lib/engine/types";
import { EXPERIMENTS } from "@/lib/experiments/catalog";
import { TASKS } from "@/lib/training/tasks";

const fmt = (n: number) => n.toLocaleString("en-US");

// Real learning curves from npm run check:training (held out score per generation).
const CURVE_REAL = [6.8, 11.8, 11.8, 11.9, 11.8, 12.0, 12.0, 12.1, 12.1, 12.0];
const CURVE_REWIRED = [0.8, 6.1, 9.0, 9.1, 11.5, 11.5, 11.6, 11.6];

function MiniCurve() {
  const W = 280, H = 110, lo = -1, hi = 13;
  const pts = (a: number[]) => a.map((v, i) => `${(i / 9) * (W - 8) + 4},${H - 6 - ((v - lo) / (hi - lo)) * (H - 12)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mini-curve" aria-label="Learning curves of the real and a rewired fly circuit">
      <polyline points={pts(CURVE_REWIRED)} className="c-rew" />
      <polyline points={pts(CURVE_REAL)} className="c-real" />
    </svg>
  );
}

export default async function Home() {
  const library = await getLibrary();
  const real = library.filter((s) => s.available && s.status === "real");
  const later = library.filter((s) => !s.available || s.status === "import" || s.status === "synthetic");
  const circuit = library.find((s) => s.id === "fly-visuomotor-circuit") as SpeciesMeta | undefined;
  const live = EXPERIMENTS.filter((e) => e.runsIn === "browser" && e.brainKind === "real");
  const playable = COMMUNITY.filter((c) => c.kind === "play").length;

  return (
    <>
      <section className="wrap hero-split">
        <div className="reveal">
          <div className="eyebrow">Open connectome library</div>
          <h1>Real wiring diagrams, running live in your browser.</h1>
        </div>
        <div className="reveal" style={{ ["--i" as string]: 1 }}>
          <p className="lede">
            Every neuron and synapse of a worm and of a fly brain has been mapped. Here those maps escape shadows, taste sugar,
            drive cars and even play poker, and you can train them yourself. Each result is shown next to rewired controls, so
            you can see what the wiring really does.
          </p>
          <div className="actions">
            <Link className="btn primary" href="/gym">
              Enter the Fly Gym
            </Link>
            <Link className="btn" href="/train">
              Train a connectome
            </Link>
            <Link className="btn" href="/experiments">
              Watch experiments
            </Link>
          </div>
        </div>
      </section>

      <section className="wrap reveal" style={{ ["--i" as string]: 2 }}>
        {circuit && <ExperimentPlayer experimentId="fly-drives-a-car" meta={circuit} compact />}
        <p className="small faint caption-line">
          Live: 1,325 neurons from the FlyWire connectome, every synapse as measured. A readout trained on another track steers.{" "}
          <Link href="/experiments/fly-drives-a-car">How it works</Link>
        </p>
      </section>

      <section className="wrap bento">
        <Link href="/experiments" className="tile tile-watch">
          <div className="tile-thumbs">
            {["fly-looming-escape", "worm-food-search"].map((id) => live.find((e) => e.id === id)).filter((e) => e !== undefined).map((e) => (
              <WorldThumb key={e.id} id={e.id} />
            ))}
          </div>
          <div className="tile-text">
            <span className="eyebrow">Watch</span>
            <h2>{live.length} experiments on measured wiring</h2>
            <p>A worm backs away from a wall, a fly takes off from a looming shadow. Swap in a rewired brain and compare.</p>
          </div>
        </Link>
        <Link href="/train" className="tile tile-train">
          <MiniCurve />
          <div className="tile-text">
            <span className="eyebrow">Train</span>
            <h2>Watch a real circuit learn</h2>
            <p>
              {TASKS.length} tasks. The wiring stays fixed, a readout learns. In the fly, the real circuit (green) learned within two
              generations in 4 of 4 runs; rewired circuits (blue) were slower and less reliable.
            </p>
          </div>
        </Link>
        <Link href="/about" className="tile tile-method">
          <div className="tile-text">
            <span className="eyebrow">Method</span>
            <h2>What is measured, what is modelled</h2>
            <p>Wiring, synapse counts and transmitters come from electron microscopy. The neuron model is simple and the same for every cell. We say so on every page.</p>
          </div>
        </Link>
        <Link href="/community" className="tile tile-community">
          <div className="tile-text">
            <span className="eyebrow">Community</span>
            <h2>{COMMUNITY.length} projects, credited</h2>
            <p>
              Fly Dino, Swat, the Beat Saber fly and more, with their authors and code. {playable} play in a new window. Build your
              own experiment and share it.
            </p>
          </div>
        </Link>
      </section>

      <section className="wrap" id="library">
        <div className="section-head">
          <div>
            <div className="eyebrow">Library</div>
            <h2>Nervous systems you can open today</h2>
          </div>
          <p className="muted small head-note">New datasets come in through one importer script. The method page explains how to add yours.</p>
        </div>

        <div className="library-list">
          {real.map((s) => (
            <Link key={s.id} href={`/species/${s.id}`} className="lib-row">
              <Sigil id={s.id} />
              <div>
                <div className="lib-name">{s.common_name}</div>
                <div className="latin">{s.latin_name}</div>
              </div>
              <p>{s.summary}</p>
              <div className="lib-stats mono">
                {s.stats ? `${fmt(s.stats.neurons)} neurons · ${fmt(s.stats.synapses)} synapses` : ""}
              </div>
            </Link>
          ))}
          {later.map((s) => (
            <div key={s.id} className="lib-row muted-row">
              <Sigil id={s.id} muted />
              <div>
                <div className="lib-name">{s.status === "import" ? <Link href={`/species/${s.id}`}>{s.common_name}</Link> : s.common_name}</div>
                <div className="latin">{s.latin_name}</div>
              </div>
              <p>{s.summary}</p>
              <div className="lib-stats">
                <span className="pill">{STATUS_LABEL[s.status]}</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
