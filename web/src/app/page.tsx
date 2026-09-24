import Link from "next/link";
import HeroDemo from "@/components/HeroDemo";
import Sigil from "@/components/Sigil";
import { getLibrary, STATUS_LABEL } from "@/lib/data";
import type { SpeciesMeta } from "@/lib/engine/types";

const fmt = (n: number) => n.toLocaleString("en-US");

export default async function Home() {
  const library = await getLibrary();
  const available = library.filter((s) => s.available);
  const later = library.filter((s) => !s.available);
  const worm = library.find((s) => s.id === "c-elegans") as SpeciesMeta | undefined;

  return (
    <>
      <section className="wrap hero">
        <div className="reveal">
          <div className="eyebrow">Open connectome library</div>
          <h1 style={{ marginTop: 14 }}>Run experiments on real nervous systems.</h1>
          <p className="lede" style={{ marginTop: 20 }}>
            Scientists have mapped every neuron and synapse of a worm and a fly. Connectome Lab turns those
            maps into a laboratory: stimulate a sense, remove a neuron, rewire the whole brain, and see what
            the wiring alone produces.
          </p>
          <div className="actions">
            <Link className="btn primary" href="/lab/c-elegans">
              Open the lab
            </Link>
            <Link className="btn" href="#library">
              Browse the library
            </Link>
          </div>
        </div>
        <div className="reveal" style={{ ["--i" as string]: 2 }}>
          {worm && <HeroDemo meta={worm} />}
        </div>
      </section>

      <section className="wrap">
        <div className="steps">
          <div>
            <div className="num">01 · Choose an animal</div>
            <p>
              Every species comes with its full wiring diagram, neuron classes and transmitters, packaged
              in one open format so the same experiment runs on any of them.
            </p>
          </div>
          <div>
            <div className="num">02 · Design</div>
            <p>Pick neurons to stimulate or silence, or start from a classic experiment.</p>
          </div>
          <div>
            <div className="num">03 · Compare</div>
            <p>Run the real brain against randomly rewired brains with the same statistics.</p>
          </div>
        </div>
      </section>

      <section className="wrap" id="library">
        <div className="section-head">
          <div>
            <div className="eyebrow">Library</div>
            <h2 style={{ marginTop: 8 }}>Nervous systems you can open today</h2>
          </div>
          <p className="muted small" style={{ maxWidth: "46ch", margin: 0 }}>
            New datasets are added through a single importer script. See the method page for how to
            bring your own.
          </p>
        </div>

        <div className="library-feature">
          {available.map((s, k) => (
            <Link key={s.id} href={`/species/${s.id}`} className="panel species-card reveal" style={{ ["--i" as string]: k }}>
              <div className="top">
                <div style={{ display: "flex", gap: 14 }}>
                  <Sigil id={s.id} />
                  <div>
                    <h3>{s.common_name}</h3>
                    <div className="latin">{s.latin_name}</div>
                  </div>
                </div>
                <span className={`pill ${s.status}`}>{STATUS_LABEL[s.status]}</span>
              </div>
              <p className="muted" style={{ margin: 0, fontSize: 15 }}>
                {s.summary}
              </p>
              {s.stats && (
                <div className="stats">
                  <div className="stat">
                    <div className="v">{fmt(s.stats.neurons)}</div>
                    <div className="k">neurons</div>
                  </div>
                  <div className="stat">
                    <div className="v">{fmt(s.stats.synapses)}</div>
                    <div className="k">synapses</div>
                  </div>
                  <div className="stat">
                    <div className="v">{s.presets?.length ?? 0}</div>
                    <div className="k">ready experiments</div>
                  </div>
                </div>
              )}
            </Link>
          ))}
        </div>

        <div className="planned">
          {later.map((s) => (
            <div key={s.id} className="planned-row">
              <Sigil id={s.id} muted />
              <div>
                <div style={{ fontWeight: 500 }}>
                  {s.status === "import" ? <Link href={`/species/${s.id}`}>{s.common_name}</Link> : s.common_name}
                </div>
                <div className="latin faint small" style={{ fontStyle: "italic" }}>
                  {s.latin_name}
                </div>
              </div>
              <div className="ref">
                {s.summary}
                <br />
                {s.dataset}
              </div>
              <span className="pill">{STATUS_LABEL[s.status]}</span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
