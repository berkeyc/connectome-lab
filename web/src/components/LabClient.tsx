"use client";
// The experiment bench: choose stimulus and lesions, run the connectome,
// read the behaviour, compare against control brains, share the setup.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { selectNeurons } from "@/lib/engine/network";
import type { CompareRow } from "@/lib/engine/sim.worker";
import type { BrainVariant, Graph, SimResult, SpeciesMeta, Target } from "@/lib/engine/types";
import { drawRaster, neuronOrder } from "@/lib/raster";

type TypeInfo = { type: string; cls: string; n: number };
type Result = SimResult & { trace: { dtMs: number; frames: number; data: Float32Array } | null };

const BRAINS: { id: BrainVariant; label: string; help: string }[] = [
  { id: "real", label: "Real wiring", help: "The mapped connectome, exactly as measured." },
  { id: "degree", label: "Same degrees", help: "Every neuron keeps its number of partners, but partners are shuffled." },
  { id: "random", label: "Random wiring", help: "Same number of connections and weights, placed at random." },
  { id: "signs", label: "Shuffled transmitters", help: "Real wiring, but excitation and inhibition are reassigned at random." },
];

const encode = (ts: Target[]) => ts.map((t) => (t.side ? `${t.cell_type}@${t.side}` : t.cell_type)).join(",");
const decode = (s: string | null): Target[] =>
  (s ?? "")
    .split(",")
    .filter(Boolean)
    .map((x) => {
      const [cell_type, side] = x.split("@");
      return side === "left" || side === "right" ? { cell_type, side } : { cell_type };
    });

function TargetPicker({
  types,
  value,
  onChange,
  tone,
  placeholder,
}: {
  types: TypeInfo[];
  value: Target[];
  onChange: (t: Target[]) => void;
  tone: "stim" | "les";
  placeholder: string;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const matches = useMemo(() => {
    const s = q.trim().toLowerCase();
    const taken = new Set(value.map((v) => v.cell_type));
    return types.filter((t) => !taken.has(t.type) && (!s || t.type.toLowerCase().includes(s) || t.cls.includes(s))).slice(0, 40);
  }, [q, types, value]);
  const cycleSide = (k: number) => {
    const order: (Target["side"] | undefined)[] = [undefined, "left", "right"];
    const next = order[(order.indexOf(value[k].side) + 1) % order.length];
    onChange(value.map((v, i) => (i === k ? (next ? { cell_type: v.cell_type, side: next } : { cell_type: v.cell_type }) : v)));
  };
  return (
    <div className="picker">
      {value.length > 0 && (
        <div className="chips" style={{ marginBottom: 8 }}>
          {value.map((t, k) => (
            <span key={t.cell_type} className={`chip ${tone}`}>
              <span className="mono" style={{ cursor: "pointer" }} title="Click to switch between both sides, left and right" onClick={() => cycleSide(k)}>
                {t.cell_type}
                <span style={{ opacity: 0.7 }}>{t.side ? ` · ${t.side}` : ""}</span>
              </span>
              <button aria-label={`Remove ${t.cell_type}`} onClick={() => onChange(value.filter((_, i) => i !== k))}>
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        className="search"
        placeholder={placeholder}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && matches[0]) {
            onChange([...value, { cell_type: matches[0].type }]);
            setQ("");
          }
        }}
      />
      {open && matches.length > 0 && (
        <div className="panel picker-list">
          {matches.map((t) => (
            <button
              key={t.type}
              className="picker-item"
              onMouseDown={(e) => {
                e.preventDefault();
                onChange([...value, { cell_type: t.type }]);
                setQ("");
              }}
            >
              <span className="mono">{t.type}</span>
              <span className="faint">
                {t.cls.replace("_", " ")} · {t.n}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ReadoutCard({ r, unit, scale }: { r: SimResult["readouts"][number]; unit: string; scale: number }) {
  const pct = Math.max(-1, Math.min(1, r.value / scale));
  const signed = r.negativeLabel !== null;
  return (
    <div className="readout">
      <div className="eyebrow">{r.label}</div>
      <div className="v">
        {r.value > 0 && signed ? "+" : ""}
        {r.value.toFixed(1)}
        <span className="faint" style={{ fontSize: 15, marginLeft: 6 }}>
          {unit}
        </span>
      </div>
      <div className="small muted">
        {signed
          ? r.value === 0
            ? "no bias"
            : `towards ${r.value > 0 ? r.positiveLabel : r.negativeLabel}`
          : `${r.positiveLabel} activity`}
      </div>
      <div className="meter">
        {signed && <span className="mid" />}
        <span
          className={`fill ${pct < 0 ? "neg" : ""}`}
          style={signed ? { left: pct < 0 ? `${50 + pct * 50}%` : "50%", width: `${Math.abs(pct) * 50}%` } : { left: 0, width: `${Math.abs(pct) * 100}%` }}
        />
      </div>
      {signed && (
        <div className="meter-labels">
          <span>{r.negativeLabel} {r.negativeHz?.toFixed(0)}</span>
          <span>{r.positiveLabel} {r.positiveHz.toFixed(0)}</span>
        </div>
      )}
    </div>
  );
}

export default function LabClient({ meta, types }: { meta: SpeciesMeta; types: TypeInfo[] }) {
  const worker = useRef<Worker | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [graph, setGraph] = useState<Graph | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [presetId, setPresetId] = useState<string | null>(meta.presets[0]?.id ?? null);
  const [stimulate, setStimulate] = useState<Target[]>(meta.presets[0]?.stimulate ?? []);
  const [lesion, setLesion] = useState<Target[]>(meta.presets[0]?.lesion ?? []);
  const [brain, setBrain] = useState<BrainVariant>("real");
  const [seed, setSeed] = useState(1);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [compare, setCompare] = useState<CompareRow[] | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const reqId = useRef(0);
  const hydrated = useRef(false);

  const unit = meta.sim.model === "rate" ? "%" : "Hz";
  const order = useMemo(() => (graph ? neuronOrder(graph) : null), [graph]);
  const preset = meta.presets.find((p) => p.id === presetId);

  // read a shared setup from the URL once
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.has("s") || q.has("l") || q.has("p")) {
      // The URL is an external source of truth here (shared links), read once after hydration.
      /* eslint-disable react-hooks/set-state-in-effect */
      const p = meta.presets.find((x) => x.id === q.get("p"));
      setPresetId(p?.id ?? null);
      setStimulate(q.has("s") ? decode(q.get("s")) : p?.stimulate ?? []);
      setLesion(q.has("l") ? decode(q.get("l")) : p?.lesion ?? []);
      const b = q.get("b") as BrainVariant | null;
      if (b && BRAINS.some((x) => x.id === b)) setBrain(b);
      const sd = Number(q.get("seed"));
      if (sd > 0) setSeed(sd);
      /* eslint-enable react-hooks/set-state-in-effect */
    }
    hydrated.current = true;
  }, [meta.presets]);

  // keep the URL in sync so any setup can be shared
  useEffect(() => {
    if (!hydrated.current) return;
    const q = new URLSearchParams();
    if (presetId) q.set("p", presetId);
    if (stimulate.length) q.set("s", encode(stimulate));
    if (lesion.length) q.set("l", encode(lesion));
    if (brain !== "real") q.set("b", brain);
    if (seed !== 1) q.set("seed", String(seed));
    window.history.replaceState(null, "", `${window.location.pathname}${q.size ? `?${q}` : ""}`);
  }, [presetId, stimulate, lesion, brain, seed]);

  // load the graph and start the worker
  useEffect(() => {
    let alive = true;
    const w = new Worker(new URL("../lib/engine/sim.worker.ts", import.meta.url), { type: "module" });
    worker.current = w;
    w.onmessage = (e) => {
      const m = e.data;
      if (m.type === "ready") setReady(true);
      if (m.type === "error") {
        setError(m.message);
        setRunning(false);
        setProgress(null);
      }
      if (m.id !== reqId.current) return;
      if (m.type === "result") {
        setResult(m.result);
        setRunning(false);
      }
      if (m.type === "progress") setProgress(`${m.done} of ${m.total} runs`);
      if (m.type === "compare") {
        setCompare(m.rows);
        setProgress(null);
      }
    };
    fetch(`/data/species/${meta.id}/graph.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`Could not load the connectome (${r.status})`);
        return r.json();
      })
      .then((g: Graph) => {
        if (!alive) return;
        setGraph(g);
        w.postMessage({ type: "load", graph: g, meta });
      })
      .catch((err) => setError(String(err.message ?? err)));
    return () => {
      alive = false;
      w.terminate();
    };
  }, [meta]);

  const run = useCallback(() => {
    if (!worker.current || !ready) return;
    setRunning(true);
    setCompare(null);
    setError(null);
    const id = ++reqId.current;
    worker.current.postMessage({ type: "run", id, config: { stimulate, lesion, brain, seed } });
  }, [ready, stimulate, lesion, brain, seed]);

  const runCompare = () => {
    if (!worker.current || !ready) return;
    setCompare(null);
    setProgress("starting");
    const id = ++reqId.current;
    worker.current.postMessage({ type: "compare", id, stimulate, lesion, seeds: [1, 2, 3, 4, 5], brains: BRAINS.map((b) => b.id) });
  };

  // first run as soon as the worker is ready
  const autoRan = useRef(false);
  useEffect(() => {
    if (ready && !autoRan.current) {
      autoRan.current = true;
      run();
    }
  }, [ready, run]);

  // draw
  useEffect(() => {
    if (!result || !graph || !order || !canvas.current) return;
    const draw = () =>
      canvas.current &&
      drawRaster(canvas.current, graph, result, order, {
        highlight: new Set(selectNeurons(graph, result.config.stimulate)),
        lesioned: new Set(selectNeurons(graph, result.config.lesion)),
      });
    draw();
    window.addEventListener("resize", draw);
    return () => window.removeEventListener("resize", draw);
  }, [result, graph, order]);

  const choosePreset = (id: string) => {
    const p = meta.presets.find((x) => x.id === id)!;
    setPresetId(id);
    setStimulate(p.stimulate);
    setLesion(p.lesion);
    setCompare(null);
  };

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setToast("Link copied. Anyone with it can rerun this experiment.");
    } catch {
      setToast("Copy the address bar to share this experiment.");
    }
    setTimeout(() => setToast(null), 2600);
  };

  const download = () => {
    if (!result) return;
    const data = {
      species: meta.id,
      dataset: meta.dataset,
      config: result.config,
      model: meta.sim,
      readouts: result.readouts,
      unit,
      activeNeurons: result.activeNeurons,
      rateByType: result.rateByType,
      compare,
      createdAt: new Date().toISOString(),
      url: window.location.href,
    };
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    a.download = `${meta.id}-${presetId ?? "custom"}-${brain}-seed${seed}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const scale = useMemo(() => {
    const vals = (result?.readouts ?? []).map((r) => Math.max(Math.abs(r.positiveHz), Math.abs(r.negativeHz ?? 0)));
    return Math.max(10, ...vals);
  }, [result]);
  const stimSet = useMemo(() => new Set(stimulate.map((s) => s.cell_type)), [stimulate]);
  const topTypes = (result?.rateByType ?? []).filter((t) => t.hz > 0).slice(0, 14);
  const maxType = Math.max(1, ...topTypes.map((t) => t.hz));
  const dirty = result && (encode(result.config.stimulate) !== encode(stimulate) || encode(result.config.lesion) !== encode(lesion) || result.config.brain !== brain || result.config.seed !== seed);

  return (
    <div className="lab">
      <aside className="panel controls">
        <div className="field">
          <span className="label">Start from a classic experiment</span>
          <div className="presets">
            {meta.presets.map((p) => (
              <button key={p.id} className={`preset ${p.id === presetId ? "on" : ""}`} onClick={() => choosePreset(p.id)}>
                <div className="t">{p.label}</div>
                <div className="d">{p.description}</div>
              </button>
            ))}
          </div>
        </div>
        <hr className="rule" />
        <div className="field">
          <span className="label">Stimulate</span>
          <TargetPicker types={types} value={stimulate} onChange={(v) => { setStimulate(v); setPresetId(null); }} tone="stim" placeholder="Add a cell type to excite" />
          <span className="help">These neurons receive strong random input, like a sensory stimulus. Click a chip to pick a side.</span>
        </div>
        <div className="field">
          <span className="label">Silence (lesion)</span>
          <TargetPicker types={types} value={lesion} onChange={(v) => { setLesion(v); setPresetId(null); }} tone="les" placeholder="Add a cell type to remove" />
          <span className="help">Silenced neurons never fire, like a laser ablation or a genetic knockout.</span>
        </div>
        <div className="field">
          <span className="label">Brain</span>
          <div className="segmented">
            {BRAINS.map((b) => (
              <button key={b.id} className={brain === b.id ? "on" : ""} onClick={() => setBrain(b.id)} title={b.help}>
                {b.label}
              </button>
            ))}
          </div>
          <span className="help">{BRAINS.find((b) => b.id === brain)?.help}</span>
        </div>
        <div className="row split">
          <label className="row small muted">
            Seed
            <input type="number" min={1} value={seed} onChange={(e) => setSeed(Math.max(1, Number(e.target.value) || 1))} />
          </label>
          <button className="btn accent" onClick={run} disabled={!ready || running || !stimulate.length}>
            {running ? "Running..." : "Run experiment"}
          </button>
        </div>
        {!stimulate.length && <span className="help">Add at least one cell type to stimulate.</span>}
      </aside>

      <section className="results">
        {error && <div className="error">{error}</div>}

        {!result ? (
          <div className="panel" style={{ padding: 20 }}>
            <div className="skeleton" style={{ height: 110 }} />
            <div className="skeleton" style={{ height: 340, marginTop: 16 }} />
            <p className="faint small" style={{ marginTop: 12 }}>
              Loading {meta.stats?.neurons.toLocaleString("en-US")} neurons and running the first experiment...
            </p>
          </div>
        ) : (
          <>
            <div className="panel" style={{ overflow: "hidden", opacity: running ? 0.6 : 1, transition: "opacity .3s" }}>
              <div className="readouts">
                {result.readouts.map((r) => (
                  <ReadoutCard key={r.id} r={r} unit={unit} scale={scale} />
                ))}
              </div>
              <hr className="rule" />
              <div className="row split" style={{ padding: "12px 20px" }}>
                <span className="small muted">
                  {preset && !dirty ? <>Expected: {preset.expected}</> : dirty ? "Settings changed. Run again to update." : "Custom experiment"}
                </span>
                <span className="row">
                  <button className="btn small" onClick={share}>Copy link</button>
                  <button className="btn small" onClick={download}>Download JSON</button>
                </span>
              </div>
            </div>

            <div className="panel viz">
              <div className="row split">
                <h3>{result.trace ? "Activity" : "Spikes"} over {result.durationMs} ms</h3>
                <span className="mono small faint">
                  {result.activeNeurons.toLocaleString("en-US")} of {result.neurons.toLocaleString("en-US")} neurons active · {result.runtimeMs.toFixed(0)} ms compute
                </span>
              </div>
              <canvas ref={canvas} style={{ height: Math.min(520, Math.max(300, result.neurons * 1.2)), marginTop: 12 }} />
              <div className="legend">
                <span><i style={{ background: "var(--accent)" }} />spike</span>
                <span><i style={{ background: "var(--warn)" }} />stimulated neuron</span>
                <span><i style={{ background: "var(--warn)", opacity: 0.25 }} />silenced row</span>
                <span className="faint">Rows are neurons, grouped by class. Time runs left to right.</span>
              </div>
            </div>

            <div className="panel block">
              <h3>Strongest responses</h3>
              <p className="sub">Mean {unit === "Hz" ? "firing rate" : "activity"} per cell type. Highlighted types were stimulated directly.</p>
              {topTypes.length ? (
                <div className="bars">
                  {topTypes.map((t) => (
                    <div className="bar" key={t.type} style={{ gridTemplateColumns: "150px 1fr 70px" }}>
                      <span className="mono" style={{ color: stimSet.has(t.type) ? "var(--warn)" : undefined }}>
                        {t.type} <span className="faint">· {t.cls.replace("_", " ")}</span>
                      </span>
                      <span className="track">
                        <span className="fill" style={{ display: "block", width: `${(100 * t.hz) / maxType}%`, background: stimSet.has(t.type) ? "var(--warn)" : undefined }} />
                      </span>
                      <span className="mono small" style={{ textAlign: "right" }}>
                        {t.hz.toFixed(1)} {unit}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="muted">Nothing fired. Try stimulating a sensory cell type, or check that the stimulated neurons are not also silenced.</p>
              )}
            </div>

            <div className="panel block compare">
              <div className="row split">
                <div>
                  <h3>Is it the wiring?</h3>
                  <p className="sub" style={{ marginBottom: 0 }}>
                    Run this exact experiment on the real brain and on three kinds of control brain, five seeds each.
                  </p>
                </div>
                <button className="btn" onClick={runCompare} disabled={!ready || !!progress || !stimulate.length}>
                  {progress ? `Running ${progress}` : "Compare with controls"}
                </button>
              </div>
              {compare && (
                <>
                  <table className="data" style={{ marginTop: 16 }}>
                    <thead>
                      <tr>
                        <th>Brain</th>
                        {meta.readouts.map((r) => (
                          <th key={r.id} className="num">{r.label} ({unit})</th>
                        ))}
                        <th className="num">Active neurons</th>
                      </tr>
                    </thead>
                    <tbody>
                      {compare.map((row) => (
                        <tr key={row.brain}>
                          <td className={row.brain === "real" ? "real" : ""}>{BRAINS.find((b) => b.id === row.brain)?.label}</td>
                          {meta.readouts.map((r) => {
                            const x = row.readouts.find((y) => y.id === r.id)!;
                            return (
                              <td key={r.id} className="num">
                                {x.mean.toFixed(1)} <span className="faint">± {x.sd.toFixed(1)}</span>
                              </td>
                            );
                          })}
                          <td className="num">{row.active.toFixed(0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="small muted" style={{ marginTop: 12 }}>
                    {(() => {
                      const main = meta.readouts[0];
                      const real = compare.find((c) => c.brain === "real")!.readouts.find((x) => x.id === main.id)!;
                      const ctrl = compare.filter((c) => c.brain !== "real").map((c) => c.readouts.find((x) => x.id === main.id)!.mean);
                      const best = Math.max(...ctrl.map(Math.abs));
                      return Math.abs(real.mean) > 2 * best + 1
                        ? `On “${main.label}”, the real wiring gives a response more than twice as strong as any control. The behaviour depends on who connects to whom, not just on how many connections there are.`
                        : `On “${main.label}”, the real wiring does not clearly beat the controls for this setup. Either the response is generic, or this model misses something the real animal uses.`;
                    })()}
                  </p>
                </>
              )}
            </div>
          </>
        )}
      </section>
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
