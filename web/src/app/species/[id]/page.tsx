import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import FlowMatrix from "@/components/FlowMatrix";
import Sigil from "@/components/Sigil";
import TypeTable from "@/components/TypeTable";
import { getLibrary, getSpecies, getSummary, STATUS_LABEL } from "@/lib/data";

export async function generateStaticParams() {
  return (await getLibrary()).filter((s) => s.status !== "planned").map((s) => ({ id: s.id }));
}

export async function generateMetadata(props: PageProps<"/species/[id]">): Promise<Metadata> {
  const s = await getSpecies((await props.params).id);
  return { title: s?.common_name ?? "Species", description: s?.summary };
}

const fmt = (n: number) => n.toLocaleString("en-US");
const NT_SIGN_CLASS = (sign: number | undefined) => (sign === 1 ? "" : sign === -1 ? "inh" : "neutral");

export default async function SpeciesPage(props: PageProps<"/species/[id]">) {
  const { id } = await props.params;
  const s = await getSpecies(id);
  if (!s || s.status === "planned") notFound();
  const summary = await getSummary(id);

  return (
    <div className="wrap">
      <div className="page-head">
        <div>
          <div className="row" style={{ gap: 14 }}>
            <Sigil id={s.id} size={52} />
            <div>
              <div className="eyebrow">{s.latin_name}</div>
              <h1 style={{ fontSize: "clamp(30px, 4vw, 44px)", marginTop: 6 }}>{s.common_name}</h1>
            </div>
          </div>
          <p className="lede" style={{ marginTop: 18 }}>
            {s.summary}
          </p>
          <div className="row" style={{ marginTop: 8 }}>
            <span className={`pill ${s.status}`}>{STATUS_LABEL[s.status]}</span>
            <span className="faint small">{s.dataset}</span>
          </div>
        </div>
        {summary?.browserSimulation && (
          <Link className="btn primary" href={`/lab/${s.id}`}>
            Run experiments
          </Link>
        )}
      </div>

      {!summary ? (
        <div className="panel empty">
          <h3>This dataset is not loaded on the site yet</h3>
          <p>
            It is too large to ship with the site, or its licence does not allow redistribution. You can load it
            into your own copy of Connectome Lab with one command after downloading the files from{" "}
            <a href={s.source_url}>{s.source_url}</a>.
          </p>
          <pre className="mono small" style={{ background: "var(--surface-2)", padding: 14, borderRadius: 10, overflow: "auto" }}>
            python pipeline/import_flywire.py --min-syn 5{"\n"}python pipeline/load_postgres.py
          </pre>
          {s.caveats?.length ? (
            <ul className="notes" style={{ marginTop: 16 }}>
              {s.caveats.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : (
        <>
          <div className="statbar">
            {[
              ["neurons", summary.counts.neurons],
              ["cell types", summary.counts.cellTypes],
              ["chemical pairs", summary.counts.chemicalPairs],
              ["gap junction pairs", summary.counts.gapPairs],
              ["synapses", summary.counts.synapses],
            ].map(([k, v]) => (
              <div className="stat" key={k}>
                <div className="v">{fmt(v as number)}</div>
                <div className="k">{k}</div>
              </div>
            ))}
          </div>

          <div className="two-col">
            <div className="panel block">
              <h3>Who talks to whom</h3>
              <p className="sub">Synapses between neuron classes. Cells show the share of the sending class&apos;s output.</p>
              <FlowMatrix classes={summary.flow.classes} matrix={summary.flow.matrix} />
            </div>
            <div style={{ display: "grid", gap: 20, alignContent: "start" }}>
              <div className="panel block">
                <h3>Neuron classes</h3>
                <p className="sub">How the system divides its neurons.</p>
                <div className="bars">
                  {summary.classCounts.map((c) => (
                    <div className="bar" key={c.cls}>
                      <span>{c.cls.replace("_", " ")}</span>
                      <span className="track">
                        <span className="fill" style={{ display: "block", width: `${(100 * c.n) / summary.counts.neurons}%` }} />
                      </span>
                      <span className="mono small" style={{ textAlign: "right" }}>
                        {fmt(c.n)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="panel block">
                <h3>Transmitters</h3>
                <p className="sub">Green excites, blue inhibits, grey is modulatory or unknown in this model.</p>
                <div className="bars">
                  {summary.ntCounts.map((c) => (
                    <div className="bar" key={c.nt}>
                      <span className="mono">{c.nt}</span>
                      <span className="track">
                        <span className={`fill ${NT_SIGN_CLASS(s.sign?.[c.nt === "unknown" ? "" : c.nt])}`} style={{ display: "block", width: `${(100 * c.n) / summary.counts.neurons}%` }} />
                      </span>
                      <span className="mono small" style={{ textAlign: "right" }}>
                        {fmt(c.n)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="two-col" style={{ gridTemplateColumns: "1.6fr 1fr" }}>
            <div className="panel block">
              <h3>Cell types</h3>
              <p className="sub">Sorted by total synapses. Use these names in the lab.</p>
              <TypeTable rows={summary.types} />
            </div>
            <div className="panel block">
              <h3>Hub neurons</h3>
              <p className="sub">The most connected individual cells.</p>
              <table className="data">
                <thead>
                  <tr>
                    <th>Neuron</th>
                    <th>Type</th>
                    <th className="num">Synapses</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.hubs.map((h) => (
                    <tr key={h.id}>
                      <td className="mono small">{h.id.length > 10 ? `…${h.id.slice(-6)}` : h.id}</td>
                      <td>{h.type}</td>
                      <td className="num">{fmt(h.in_syn + h.out_syn)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <div className="two-col">
        <div className="panel block">
          <h3>Read before you conclude</h3>
          <p className="sub">What this dataset and model can and cannot tell you.</p>
          <ul className="notes">
            {(s.caveats ?? []).map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
        <div className="panel block">
          <h3>Cite</h3>
          <p className="sub">{s.license}</p>
          <ul className="notes">
            {(s.citations ?? []).map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
