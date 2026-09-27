import type { Metadata } from "next";
import Link from "next/link";
import { GAPS, IDEAS, PEERS, RESEARCH } from "@/lib/research";

export const metadata: Metadata = {
  title: "Research landscape",
  description: "Who else simulates connectomes, puts them in bodies or games, and tests them against controls, and where Connectome Lab fits. September 2026.",
};

export default function ResearchPage() {
  return (
    <div className="wrap">
      <header className="page-intro">
        <div className="crumbs">
          <Link href="/about">About</Link> <span>/</span> Research landscape
        </div>
        <h1>Who else works on this</h1>
        <p className="lede">
          Connectomes are being run, embodied, turned into games and put to the test all over the world. This page maps the
          projects closest to Connectome Lab, what each one does differently, and what we can learn from them. Collected in
          September 2026; every entry links to its source.
        </p>
      </header>

      <section className="research-summary">
        <div className="panel block">
          <h3>Closest peers</h3>
          <ol className="peer-list">
            {PEERS.map((p) => (
              <li key={p.name}>
                <strong>{p.name}</strong> <span className="muted">{p.why}</span>
              </li>
            ))}
          </ol>
        </div>
        <div className="panel block">
          <h3>What only this lab does</h3>
          <ul className="plain-list">
            {GAPS.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
          <h3 style={{ marginTop: 20 }}>Ideas worth borrowing</h3>
          <ul className="plain-list">
            {IDEAS.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
        </div>
      </section>

      <nav className="toc" aria-label="Sections">
        {RESEARCH.map((g) => (
          <a key={g.id} href={`#${g.id}`}>
            {g.title}
          </a>
        ))}
      </nav>

      {RESEARCH.map((g) => (
        <section key={g.id} id={g.id} className="hub-section">
          <div className="hub-head">
            <h2>{g.title}</h2>
            <p>{g.blurb}</p>
          </div>
          <div className="research-grid">
            {g.items.map((i) => (
              <article key={i.name} className="research-card">
                <div className="research-top">
                  <h3>
                    <a href={i.url} target="_blank" rel="noopener noreferrer">
                      {i.name}
                    </a>
                  </h3>
                  {i.when && <span className="tag plain">{i.when}</span>}
                </div>
                <p className="research-who">{i.who}</p>
                <p>{i.what}</p>
                <p className="research-vs">
                  <span>Compared with this lab:</span> {i.vsUs}
                </p>
                {i.checked === false && <p className="small faint">Seen through community lists only.</p>}
              </article>
            ))}
          </div>
        </section>
      ))}

      <p className="small faint" style={{ marginTop: 32 }}>
        Status and details change quickly in this field. If a project is missing or described wrongly, open an issue on{" "}
        <a href="https://github.com/berkeyc/connectome-lab/issues">GitHub</a>.
      </p>
    </div>
  );
}
