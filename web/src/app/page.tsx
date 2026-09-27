import Link from "next/link";
import ProjectCard from "@/components/ProjectCard";
import Thumb from "@/components/Thumb";
import { COMMUNITY } from "@/lib/community";
import { getLibrary } from "@/lib/data";
import { EXPERIMENTS } from "@/lib/experiments/catalog";
import { GYM, GYM_RESULTS } from "@/lib/gym/catalog";
import { CLIPS, SPECIES_VISUAL } from "@/lib/site";
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

type Trained = { variants: Record<string, { heldOut: number } | undefined> };

/** The benchmark in one glance: real wiring against the best control, per task. */
function MiniScoreboard() {
  const rows = GYM.filter((g) => g.kind === "trained").map((g) => {
    const r = GYM_RESULTS[g.id] as Trained | undefined;
    const real = r?.variants.real?.heldOut;
    const ctrl = Math.max(...["degree", "random", "silenced"].map((k) => r?.variants[k]?.heldOut ?? -Infinity));
    return { id: g.id, title: g.title, win: real !== undefined && real > ctrl + 0.02 };
  });
  return (
    <ul className="mini-board">
      {rows.map((r) => (
        <li key={r.id}>
          <span>{r.title}</span>
          <span className={r.win ? "win" : "even"}>{r.win ? "real wiring wins" : "no clear winner"}</span>
        </li>
      ))}
    </ul>
  );
}

const FEATURED = ["gym-poker", "fly-looming-escape", "gym-feeding", "gym-flight", "fly-drives-a-car", "worm-food-search", "gym-pong", "gym-chase"];

export default async function Home() {
  const library = await getLibrary();
  const datasets = library.filter((s) => s.available);
  const live = EXPERIMENTS.filter((e) => e.runsIn === "browser");
  const featured = FEATURED.map((id) => EXPERIMENTS.find((e) => e.id === id)).filter((e) => e !== undefined);
  const flywire = library.find((s) => s.id === "fruit-fly-flywire");

  return (
    <>
      <section className="wrap home-hero">
        <div className="home-hero-text">
          <span className="eyebrow">Open connectome laboratory</span>
          <h1>Real fly and worm brains, running live in your browser.</h1>
          <p className="lede">
            Every neuron and synapse of a fruit fly brain and a worm has been mapped. Here those wiring diagrams taste sugar,
            escape shadows, fly through gusts and even play poker, and each result is shown next to rewired brains, so you can
            see what the real wiring does.
          </p>
          <div className="actions">
            <Link className="btn primary" href="/experiments">
              Explore the experiments
            </Link>
            <Link className="btn" href="/gym">
              See the benchmark
            </Link>
          </div>
          <dl className="hero-facts">
            <div>
              <dt>{live.length}</dt>
              <dd>experiments in the browser</dd>
            </div>
            <div>
              <dt>{flywire?.stats ? fmt(flywire.stats.neurons) : "139,000"}</dt>
              <dd>neurons in the full fly brain</dd>
            </div>
            <div>
              <dt>4</dt>
              <dd>circuits compared on every task</dd>
            </div>
          </dl>
        </div>
        <figure className="home-hero-media">
          <Thumb clip="fly-looming-escape" alt="A realistic fruit fly in an LED arena takes off as a dark disc looms" eager />
          <figcaption>
            <span className="dot live" /> Rendered from the live simulation: the FlyWire escape circuit sees a looming disc and
            the Giant Fiber fires.
          </figcaption>
        </figure>
      </section>

      <section className="wrap home-paths" aria-labelledby="paths-head">
        <div className="section-intro">
          <h2 id="paths-head">Where do you want to start?</h2>
          <p className="muted">Four ways into the same library of real circuits.</p>
        </div>
        <div className="paths">
          <Link href="/experiments" className="path path-main">
            <Thumb clip="gym-poker" alt="The fly at a poker table" className="path-media" />
            <div className="path-body">
              <span className="pcard-eyebrow">Watch</span>
              <h3>Experiments</h3>
              <p>{live.length} real circuits driving bodies: reflexes, driving, flight, games and memory tests.</p>
            </div>
          </Link>
          <Link href="/gym" className="path">
            <div className="path-body">
              <span className="pcard-eyebrow">Compare</span>
              <h3>Benchmark</h3>
              <p>Eight tasks, each run on the real wiring and on rewired, random and silenced circuits.</p>
              <MiniScoreboard />
            </div>
          </Link>
          <Link href="/train" className="path">
            <div className="path-body">
              <span className="pcard-eyebrow">Teach</span>
              <h3>Train</h3>
              <p>{TASKS.length} tasks. The wiring stays fixed; a small readout learns while you watch.</p>
              <MiniCurve />
              <span className="small faint">Real circuit (green) against a rewired one, held out score per generation</span>
            </div>
          </Link>
          <Link href="/library" className="path">
            <Thumb image={SPECIES_VISUAL["fruit-fly-flywire"].image} alt="Every neuron of the FlyWire fly brain at its measured position" className="path-media" />
            <div className="path-body">
              <span className="pcard-eyebrow">Explore</span>
              <h3>Library</h3>
              <p>{datasets.length} datasets: the whole FlyWire brain, three circuits cut from it, and the worm.</p>
            </div>
          </Link>
        </div>
      </section>

      <section className="home-featured" aria-labelledby="featured-head">
        <div className="wrap section-intro row-between">
          <div>
            <h2 id="featured-head">Running right now</h2>
            <p className="muted">Each clip is rendered from the simulation itself: the real circuit, the real body, frame by frame.</p>
          </div>
          <Link href="/experiments" className="text-link">
            All experiments →
          </Link>
        </div>
        <div className="scroller" tabIndex={0} aria-label="Featured experiments">
          {featured.map((e) => (
            <ProjectCard key={e.id} href={`/experiments/${e.id}`} title={e.title} text={e.tagline} clip={CLIPS.has(e.id) ? e.id : null} size="compact" />
          ))}
        </div>
      </section>

      <section className="wrap home-how" aria-labelledby="how-head">
        <div className="section-intro">
          <h2 id="how-head">How every experiment works</h2>
        </div>
        <ol className="how-steps">
          <li>
            <span className="how-num">1</span>
            <h3>Senses drive real neurons</h3>
            <p>A looming disc drives the fly&apos;s looming detectors, sugar its taste neurons, a gust its motion sensing HS cells.</p>
          </li>
          <li>
            <span className="how-num">2</span>
            <h3>The measured wiring does the rest</h3>
            <p>Spikes travel through every synapse mapped by electron microscopy to the descending neurons that command the body.</p>
          </li>
          <li>
            <span className="how-num">3</span>
            <h3>The same task on control brains</h3>
            <p>Rewired, random and silenced circuits run the same task. Only a difference from them says the wiring matters.</p>
          </li>
        </ol>
      </section>

      <section className="wrap home-more">
        <Link href="/research" className="more-card">
          <span className="pcard-eyebrow">Research landscape</span>
          <h3>Who else runs connectomes, and where this lab fits</h3>
          <p>Eon Systems&apos; embodied fly, flybench, webgpu-fly, OpenWorm, Cortical Labs and more, compared.</p>
        </Link>
        <Link href="/community" className="more-card">
          <span className="pcard-eyebrow">Community</span>
          <h3>{COMMUNITY.length} projects by others, credited</h3>
          <p>Fly Dino, Swat, the Beat Saber fly and more, with their authors and code. Build your own experiment and share it.</p>
        </Link>
      </section>
    </>
  );
}
